/**
 * The derived-reference vocabulary (AD-16). Renders an evidence-target
 * pointer, or a temporally-paired pair, as a description of the step's
 * operation and selection predicate; the step's own identifier never appears.
 * Resolves pointers through a `PlanIndex` into a phrase, kept apart from
 * `plan-index.ts`'s resolving and `direction-prose.ts`'s relation templates.
 */
import type { Operation } from '../schemas/interface.ts'
import type { InteractionStep } from '../schemas/plan.ts'
import type { TransportChannelName } from '../schemas/pointer.ts'
import {
	type EvidenceTarget,
	type PlanIndex,
	parseEvidenceTarget,
	resolveOperation,
	resolveStep,
} from './plan-index.ts'

// InputBinding's four channels share one value shape, so indexing through
// InteractionStep names it without adding a fifth type alias to
// `core/schemas/`.
type BindingValue = NonNullable<InteractionStep['inputBinding']['path']>[string]

type ResolvedTarget = {
	readonly target: EvidenceTarget
	readonly step: InteractionStep
	readonly operation: Operation
}

function resolveEvidenceTarget(
	pointer: string,
	index: PlanIndex,
): ResolvedTarget {
	const target = parseEvidenceTarget(pointer)
	const step = resolveStep(index, target.stepId)
	const operation = resolveOperation(index, step.operationId)
	return { target, step, operation }
}

// ---- joining ---------------------------------------------------------

function joinWithAnd(items: readonly string[]): string {
	const [first, ...rest] = items
	if (first === undefined) return ''
	if (rest.length === 0) return first
	const last = rest[rest.length - 1]
	if (rest.length === 1) return `${first} and ${last}`
	const middle = rest.slice(0, -1)
	return `${[first, ...middle].join(', ')}, and ${last}`
}

// ---- operation identity -----------------------------------------------

// Humanizing a kebab-case operationId is injective on distinct ids, and
// `buildPlanIndex` already rejects a duplicate `operationId` across
// interfaces, so two resolved operations never share this phrase. `method`
// and `pathTemplate` are never printed here: AD-16 withholds the operation
// inventory from the brief.
function operationReference(operation: Operation): string {
	return `the ${operation.operationId.split('-').join(' ')} endpoint`
}

// ---- the binding clause and its escalation ----------------------------

// Three rungs: generic, binding kind, literal value. A fourth rung computed
// from `method`/`pathTemplate` was tried and removed: it is identical for
// every sibling on one operation, so mutation testing found it added no
// disambiguating power beyond `literal`.
type EscalationLevel = 'generic' | 'kind' | 'literal'

const ESCALATION_LEVELS: readonly EscalationLevel[] = [
	'generic',
	'kind',
	'literal',
]

type TransportEntry = {
	readonly transportChannel: TransportChannelName
	readonly key: string
	readonly value: BindingValue
}

const TRANSPORT_ORDER: readonly TransportChannelName[] = [
	'path',
	'query',
	'header',
	'body',
]

// Sorted by transport channel in fixed order, then by key name, so this
// never depends on a binding map's insertion order and the rendered prose
// stays permutation-invariant.
function bindingEntries(step: InteractionStep): readonly TransportEntry[] {
	const entries: TransportEntry[] = []
	for (const transportChannel of TRANSPORT_ORDER) {
		const map = step.inputBinding[transportChannel]
		if (map === null) continue
		for (const key of Object.keys(map).sort()) {
			const value = map[key]
			if (value !== undefined) entries.push({ transportChannel, key, value })
		}
	}
	return entries
}

// The transport channel is part of the rendered name as well as the sort
// key: two bindings can share a parameter name across channels (path.id and
// query.id), and without the qualifier both would render as "the supplied
// id", hiding two different bindings behind identical text.
function entryName(entry: TransportEntry): string {
	return `${entry.transportChannel} ${entry.key}`
}

function isTypeViolating(value: BindingValue): boolean {
	return 'matcher' in value && value.matcher === 'type-violating'
}

// Matches `canonicalize.ts`'s key-sorting rule (AD-27) so two contracts
// differing only in one literal binding's declared key order still render
// identical prose from that one canonical digest.
function canonicalizeForDisplay(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonicalizeForDisplay)
	if (value !== null && typeof value === 'object') {
		const sorted: Record<string, unknown> = {}
		for (const key of Object.keys(value as Record<string, unknown>).sort()) {
			sorted[key] = canonicalizeForDisplay(
				(value as Record<string, unknown>)[key],
			)
		}
		return sorted
	}
	return value
}

function formatLiteral(literal: unknown): string {
	return JSON.stringify(canonicalizeForDisplay(literal))
}

// Base rendering, one arm per tagged form. `type-violating` always names the
// input malformed. `any` and, at the 'generic' level, every other form share
// the same generic wording on purpose; the escalation ladder below tells them
// apart once two steps would otherwise collide.
//
// `captured` escalates to a real derived reference at the 'literal' rung: the
// local phrase for the pointer's channel and tail, then the referenced step
// rendered through `stepReferenceAtLevel`, which is the same phrase
// `fullTargetPhrase` already prints for an evidence target. Naming the
// referenced OPERATION alone was tried and dropped: two predecessors sharing
// one operation and one body key then render identically, so two siblings
// capturing from them collide at every rung and `renderStepReference` throws
// out of `seal()` on a contract that compiles clean. Recursing into the
// predecessor separates them by its own binding clause. Two predecessors that
// are themselves irreducible still tie, and the throw there is correct: the
// declared structure does not distinguish them, which is the same answer
// `irreducibleCollisionPair` already gets. That throw is a bare `TypeError`
// rather than a coded failure, which is a pre-existing gap this widens; the
// deferred-work entry names hoisting the collision check to compile time.
//
// It does NOT call `renderStepReference`, so none of that function's
// constraints apply: no direction-scoped sibling list is consulted, so AD-16's
// scoping stays intact, and there is no tie to throw on. A step identifier
// never appears, which is the property AD-16 actually requires.
//
// `rendering` holds the steps already on the render path, and a capture back
// into one of them falls back to the level-independent phrase. A fixed depth
// bound was tried and dropped: at depth one, a two-link chain whose every link
// is genuinely distinguishable still collides, because only the immediate
// predecessor's binding shows and that is the half the two siblings share.
// Following the chain as far as it goes is what separates them, and the
// on-path set is what makes that terminate. Each recursion adds one step id, so
// the depth is bounded by the plan; `plan-exceeds-scripting-bound` bounds that
// too. Same guard the score module uses for an `after` chain, for the same
// reason: `binding-cycle` rejects a capture cycle at compile time, so this only
// covers a plan driven straight into the renderer.
//
// A pointer whose step or operation the index cannot resolve falls back to the
// 'kind' phrase. `seal()` runs after `compile`, which rejects such a pointer
// under `unreachable-check-evidence`, so this is a fallback for a
// directly-driven caller and adds no throw path.
//
// One thing a grep for step identifiers will find and should not be surprised
// by: `localTargetPhrase` prints the pointer's tail, and a response-body key
// the author happened to name the same as a step prints with it. That is the
// author's own declared key rather than a plan identifier, and it is what every
// ordinary evidence target has always printed.
//
// `principal` tops out at the declared name, which AD-18 keeps an opaque label
// and is therefore safe on the brief.
// One or more entries of a step's clause that capture from the same earlier
// step, rendered together so that step's phrase is expanded once. Expanding it
// per entry made the clause's SIZE multiply down a capture chain: a step with k
// entries pointing at its predecessor expanded that predecessor k times, and the
// predecessor did the same to its own, so a sixteen-step chain with four keys a
// link produced a phrase past V8's maximum string length. Grouping makes the
// clause linear in keys and depth, and reads better besides.
//
// One residue is bounded rather than removed, and is stated so nobody has to
// rediscover it. A step referencing several DISTINCT predecessors still expands
// each of them, so a plan whose capture graph is a complete DAG unrolls once per
// distinct path. `plan-exceeds-scripting-bound` caps a compiled plan at sixteen
// steps, and the worst case at that cap measures 670 KB in 35 ms, which is
// large for an artifact AD-16 keeps minimal and is neither slow nor fatal. The
// shape needs a hand-authored complete DAG; the chain shape that produced the
// unbounded phrase is now 2 KB.
type CaptureGroup = {
	readonly stepId: string
	readonly entries: TransportEntry[]
	readonly targets: EvidenceTarget[]
}

function renderCaptureGroup(
	group: CaptureGroup,
	level: EscalationLevel,
	index: PlanIndex,
	rendering: ReadonlySet<string>,
): string {
	const names = joinWithAnd(group.entries.map(entryName))
	const locals = joinWithAnd(group.targets.map(localTargetPhrase))
	const step = index.stepOf(group.stepId)
	const operation =
		step === undefined ? undefined : index.operationOf(step.operationId)
	if (step === undefined || operation === undefined) {
		return `the ${names} you obtained earlier`
	}
	const source = stepReferenceAtLevel(step, operation, level, index, rendering)
	return `the ${names} you obtained as ${locals} from ${source}`
}

// Whether this entry expands into a group, or renders as the level-independent
// phrase on its own.
function expandableCapture(
	entry: TransportEntry,
	level: EscalationLevel,
	index: PlanIndex,
	rendering: ReadonlySet<string>,
): EvidenceTarget | null {
	if (level !== 'literal' || !('captured' in entry.value)) return null
	const target = parseEvidenceTarget(entry.value.captured)
	if (rendering.has(target.stepId)) return null
	const step = index.stepOf(target.stepId)
	if (step === undefined) return null
	return index.operationOf(step.operationId) === undefined ? null : target
}

// Renders one entry on its own. Every captured entry that expands lands in a
// group instead, so the arm here is the level-independent fallback.
function renderBindingValue(
	entry: TransportEntry,
	level: EscalationLevel,
): string {
	const name = entryName(entry)
	const { value } = entry
	if ('matcher' in value) {
		return value.matcher === 'type-violating'
			? `a malformed ${name} value`
			: `the supplied ${name}`
	}
	if (level === 'generic') {
		return `the supplied ${name}`
	}
	if ('principal' in value) {
		return `the ${name} of the ${value.principal} account`
	}
	if ('captured' in value) {
		return `the ${name} you obtained earlier`
	}
	if (level === 'kind') {
		return `the stated ${name}`
	}
	return `the ${name} ${formatLiteral(value.literal)}`
}

// Every declared binding key escalates together: narrowing to only the
// discriminating key would make one step's shown detail depend on which
// other steps happen to collide with it elsewhere. Naming a step's own
// bound keys is not the operation inventory AD-16 withholds; that scope is
// which other calls exist, not this call's own fields.
//
// When a type-violating binding is present, the clause names only that one:
// it is the semantically salient binding, matching AD-16's worked example.
function bindingClause(
	step: InteractionStep,
	level: EscalationLevel,
	index: PlanIndex,
	rendering: ReadonlySet<string>,
): string | null {
	const entries = bindingEntries(step)
	if (entries.length === 0) return null
	const malformed = entries.filter((entry) => isTypeViolating(entry.value))
	const chosen = malformed.length > 0 ? malformed : entries
	// Each expandable capture joins the group for the step it references, held
	// at the position that step was first referenced from, so the clause's order
	// still comes from `bindingEntries`'s sort rather than from a map's keys.
	const slots: (TransportEntry | CaptureGroup)[] = []
	const groups = new Map<string, CaptureGroup>()
	for (const entry of chosen) {
		const target = expandableCapture(entry, level, index, rendering)
		if (target === null) {
			slots.push(entry)
			continue
		}
		const existing = groups.get(target.stepId)
		if (existing !== undefined) {
			existing.entries.push(entry)
			existing.targets.push(target)
			continue
		}
		const group: CaptureGroup = {
			stepId: target.stepId,
			entries: [entry],
			targets: [target],
		}
		groups.set(target.stepId, group)
		slots.push(group)
	}
	const phrases = slots.map((slot) =>
		'stepId' in slot
			? renderCaptureGroup(slot, level, index, rendering)
			: renderBindingValue(slot, level),
	)
	return `with ${joinWithAnd(phrases)}`
}

// Parenthesized rather than comma-joined onto the operation reference: a
// step reference can itself be joined with other phrases at a higher level
// (`joinWithAnd`, or a temporal pair's "compared with"), and `bindingClause`
// already carries its own internal ", and" separators. A second comma layer
// on top would produce indistinguishable comma soup once two or more
// phrases are joined.
function stepReferenceAtLevel(
	step: InteractionStep,
	operation: Operation,
	level: EscalationLevel,
	index: PlanIndex,
	rendering: ReadonlySet<string> = new Set(),
): string {
	const base = operationReference(operation)
	// The step being rendered joins the path before its own clause is built, so
	// a self-capture falls back on the first hop.
	const clause = bindingClause(
		step,
		level,
		index,
		new Set([...rendering, step.stepId]),
	)
	return clause === null ? base : `${base} (${clause})`
}

/**
 * Escalates through `ESCALATION_LEVELS` in order until every step in
 * `siblings` renders distinctly.
 *
 * `siblings` is direction-scoped: the caller passes only the steps the
 * current direction's own resolved evidence targets share this operation
 * with, not every step in the plan (AD-16), so an unrelated collision
 * elsewhere never blocks an otherwise renderable direction.
 *
 * Throws the same precondition-violation `TypeError` as `buildPlanIndex`'s
 * duplicate `stepId` check if two siblings still collide after full
 * escalation.
 */
export function renderStepReference(
	step: InteractionStep,
	operation: Operation,
	siblings: readonly InteractionStep[],
	index: PlanIndex,
): string {
	for (const level of ESCALATION_LEVELS) {
		const phrases = siblings.map((sibling) =>
			stepReferenceAtLevel(sibling, operation, level, index),
		)
		if (new Set(phrases).size === phrases.length) {
			return stepReferenceAtLevel(step, operation, level, index)
		}
	}
	throw new TypeError(
		`two or more steps invoking operation "${operation.operationId}" that this direction references render to the same derived reference even fully escalated; the declared structure does not distinguish them`,
	)
}

/** Looks up, by operationId, every step one direction's own resolved targets name. */
type SiblingsOf = (operationId: string) => readonly InteractionStep[]

function siblingsByOperation(
	resolved: readonly ResolvedTarget[],
): Map<string, InteractionStep[]> {
	const map = new Map<string, InteractionStep[]>()
	const seenSteps = new Set<string>()
	for (const entry of resolved) {
		if (seenSteps.has(entry.step.stepId)) continue
		seenSteps.add(entry.step.stepId)
		const list = map.get(entry.operation.operationId)
		if (list === undefined) map.set(entry.operation.operationId, [entry.step])
		else list.push(entry.step)
	}
	return map
}

// ---- the channel framing ----------------------------------------------

// An empty token is RFC 6901's legal spelling for a zero-length key but
// names no field worth naming, so it is filtered out rather than spliced in
// verbatim (which would produce a blank "its  field" or a stray "."). The
// remaining segments join by "." rather than keeping only the last, so two
// nested pointers sharing one leaf field name (`.../a/id` and `.../b/id`)
// never collapse to the same phrase.
function fieldPath(tail: readonly string[]): string | null {
	const named = tail.filter((token) => token !== '')
	return named.length === 0 ? null : named.join('.')
}

function localTargetPhrase(target: EvidenceTarget): string {
	const field = fieldPath(target.tail)
	switch (target.channel) {
		case 'response-status':
			return 'its transport status'
		case 'exit-code':
			return 'its exit code'
		case 'call-inputs': {
			if (target.transportChannel === null) {
				// Unreachable: `parseEvidenceTarget` sets this exactly when the
				// channel is 'call-inputs'.
				throw new TypeError(
					'call-inputs evidence target carries no transport channel',
				)
			}
			// The transport channel is named here too, not only in the no-tail
			// fallback below: same path.id / query.id collision `entryName`
			// above guards against.
			return field !== null
				? `the ${target.transportChannel} ${field} value you sent`
				: `the ${target.transportChannel} you sent`
		}
		case 'response-body':
			return field !== null
				? `its ${field} field`
				: 'the response body you obtained'
		case 'response-headers':
			return field !== null
				? `its ${field} header`
				: 'the response headers you obtained'
		case 'stdout':
			// Distinguished from response-body's "field" wording and from
			// stderr below, so two channels naming the same field never render
			// identical text.
			return field !== null
				? `the ${field} field of its standard output`
				: 'the standard output you obtained'
		case 'stderr':
			return field !== null
				? `the ${field} field of its standard error`
				: 'the standard error you obtained'
	}
}

function fullTargetPhrase(
	resolved: ResolvedTarget,
	siblingsOf: SiblingsOf,
	index: PlanIndex,
): string {
	const local = localTargetPhrase(resolved.target)
	const stepRef = renderStepReference(
		resolved.step,
		resolved.operation,
		siblingsOf(resolved.operation.operationId),
		index,
	)
	const preposition = resolved.target.channel === 'call-inputs' ? 'to' : 'from'
	return `${local} ${preposition} ${stepRef}`
}

// Encoded as a JSON array rather than a `/`-joined string: a `/`-join would
// conflate a tail token containing a literal `/` (reachable via the RFC 6901
// `~1` escape, e.g. `['a/b']`) with an equivalent multi-segment tail (`['a',
// 'b']`). Both would join to the same `".../a/b"` string, producing a false
// tie in `sentFirstOrder` below.
function channelSignature(target: EvidenceTarget): string {
	return JSON.stringify([target.channel, target.transportChannel, target.tail])
}

// A total order over one pair, independent of argument order. The final
// reference-comparison rung fires only on a genuine tie, such as the same
// field read from two different `after`-linked steps' response bodies; it
// never degenerates to argument order, since colliding same-operation
// siblings already throw in `renderStepReference`, and different operations
// always humanize to different names.
function sentFirstOrder(
	a: ResolvedTarget,
	b: ResolvedTarget,
	siblingsOf: SiblingsOf,
	index: PlanIndex,
): readonly [ResolvedTarget, ResolvedTarget] {
	const rank = (r: ResolvedTarget): number =>
		r.target.channel === 'call-inputs' ? 0 : 1
	const rankA = rank(a)
	const rankB = rank(b)
	if (rankA !== rankB) return rankA < rankB ? [a, b] : [b, a]
	const signatureA = channelSignature(a.target)
	const signatureB = channelSignature(b.target)
	if (signatureA !== signatureB)
		return signatureA < signatureB ? [a, b] : [b, a]
	const referenceA = renderStepReference(
		a.step,
		a.operation,
		siblingsOf(a.operation.operationId),
		index,
	)
	const referenceB = renderStepReference(
		b.step,
		b.operation,
		siblingsOf(b.operation.operationId),
		index,
	)
	return referenceA <= referenceB ? [a, b] : [b, a]
}

// ---- grouping: same-step targets and the temporal pair ----------------

type PhraseGroup =
	| { readonly kind: 'single'; readonly resolved: readonly ResolvedTarget[] }
	| {
			readonly kind: 'temporal-pair'
			readonly a: ResolvedTarget
			readonly b: ResolvedTarget
	  }

// Two evidence targets whose steps are declared in an `after` relationship
// render as one relational phrase, so concatenation never discloses which
// step came first. A same-step multi-target group stays `single` regardless
// of `after`; forcing a pair there would guess at which target on each side
// pairs with which.
//
// Pairing is resolved from sorted step ids, never from discovery order over
// `resolved`, so it stays permutation-invariant: when a predecessor is named
// by more than one successor (AD-39 admits this), the winner is the successor
// whose own stepId sorts first, and the losing successor renders as its own
// `single` group.
function groupResolvedTargets(
	resolved: readonly ResolvedTarget[],
): readonly PhraseGroup[] {
	const byStep = new Map<string, ResolvedTarget[]>()
	for (const entry of resolved) {
		const list = byStep.get(entry.step.stepId)
		if (list === undefined) byStep.set(entry.step.stepId, [entry])
		else list.push(entry)
	}
	const stepIds = [...byStep.keys()].sort()
	const singleTargetStepIds = new Set(
		stepIds.filter((id) => byStep.get(id)?.length === 1),
	)

	// Every eligible successor, grouped by the predecessor its `after` names.
	const successorsOf = new Map<string, string[]>()
	for (const stepId of singleTargetStepIds) {
		const step = byStep.get(stepId)?.[0]?.step
		const after = step?.after ?? null
		if (after === null || !singleTargetStepIds.has(after)) continue
		const successors = successorsOf.get(after)
		if (successors === undefined) successorsOf.set(after, [stepId])
		else successors.push(stepId)
	}

	// One winner per predecessor: the successor whose own stepId sorts first.
	const chosenSuccessorOf = new Map<string, string>()
	for (const predecessorId of stepIds) {
		const successors = successorsOf.get(predecessorId)
		const winner =
			successors === undefined ? undefined : [...successors].sort()[0]
		if (winner !== undefined) chosenSuccessorOf.set(predecessorId, winner)
	}

	// `chosenSuccessorOf` maps each predecessor to at most one successor, and
	// each successor wins at most one predecessor, so it forms a disjoint
	// union of simple chains (or cycles, on a malformed `after` graph).
	// Walking only from steps absent from `chosenAsSuccessor` starts at true
	// chain roots and can never enter a cycle, since every cycle node is by
	// construction someone's chosen successor.
	//
	// Each root is walked and paired every other link: (1st, 2nd), (3rd,
	// 4th), with a leftover final step left to render alone. This replaced an
	// earlier single-link collapse that silently dropped a chain's trailing
	// links. `pairedAway` marks each pair's second half so the final loop
	// below skips rendering it standalone.
	const chosenAsSuccessor = new Set(chosenSuccessorOf.values())
	const pairPartnerOf = new Map<string, string>()
	const pairedAway = new Set<string>()
	for (const stepId of stepIds) {
		if (chosenAsSuccessor.has(stepId)) continue // reached by walking its root below
		let predecessorId: string | undefined = stepId
		while (predecessorId !== undefined) {
			const successorId: string | undefined =
				chosenSuccessorOf.get(predecessorId)
			if (successorId === undefined) break
			pairPartnerOf.set(predecessorId, successorId)
			pairedAway.add(successorId)
			predecessorId = chosenSuccessorOf.get(successorId)
		}
	}

	const groups: PhraseGroup[] = []
	for (const stepId of stepIds) {
		// Rendered as part of its predecessor's pair elsewhere in this loop.
		if (pairedAway.has(stepId)) continue
		const list = byStep.get(stepId)
		if (list === undefined) continue
		const successorId = pairPartnerOf.get(stepId)
		const first = list[0]
		const partnerFirst =
			successorId === undefined ? undefined : byStep.get(successorId)?.[0]
		if (first !== undefined && partnerFirst !== undefined) {
			groups.push({ kind: 'temporal-pair', a: first, b: partnerFirst })
			continue
		}
		groups.push({ kind: 'single', resolved: list })
	}
	return groups
}

function renderPhraseGroup(
	group: PhraseGroup,
	siblingsOf: SiblingsOf,
	index: PlanIndex,
): string {
	if (group.kind === 'temporal-pair') {
		const [first, second] = sentFirstOrder(group.a, group.b, siblingsOf, index)
		return `${fullTargetPhrase(first, siblingsOf, index)}, compared with ${fullTargetPhrase(second, siblingsOf, index)}`
	}
	const first = group.resolved[0]
	if (first === undefined) {
		throw new TypeError('evidence-target group is empty')
	}
	if (group.resolved.length === 1) {
		return fullTargetPhrase(first, siblingsOf, index)
	}
	const stepRef = renderStepReference(
		first.step,
		first.operation,
		siblingsOf(first.operation.operationId),
		index,
	)
	// Sorted, so a same-step group's field order is permutation-invariant like
	// the top-level join below; in declaration order, permuting
	// `evidenceTargets` would change which field is named first here.
	const locals = group.resolved
		.map((entry) => localTargetPhrase(entry.target))
		.sort()
	return `${stepRef}: ${joinWithAnd(locals)}`
}

/**
 * Renders every evidence target a direction declares as one canonically
 * ordered, order-independent clause: byte-identical under any permutation of
 * `evidenceTargets`, `interactionPlan`, or `permittedInterfaces`, since every
 * phrase comes from Map-keyed lookups and structural properties, never array
 * position.
 *
 * A repeated pointer is deduplicated first: left in place it would push its
 * step out of the "exactly one target" shape temporal pairing requires,
 * silently disabling the relational phrase for an otherwise-valid pair.
 */
export function renderEvidenceReferences(
	pointers: readonly string[],
	index: PlanIndex,
): string {
	const uniquePointers = [...new Set(pointers)]
	const resolved = uniquePointers.map((pointer) =>
		resolveEvidenceTarget(pointer, index),
	)
	const siblings = siblingsByOperation(resolved)
	const siblingsOf: SiblingsOf = (operationId) =>
		siblings.get(operationId) ?? []
	const groups = groupResolvedTargets(resolved)
	const phrases = groups.map((group) =>
		renderPhraseGroup(group, siblingsOf, index),
	)
	return joinWithAnd([...phrases].sort())
}
