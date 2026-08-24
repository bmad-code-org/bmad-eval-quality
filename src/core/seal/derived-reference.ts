/**
 * The derived-reference vocabulary (AD-16, AC 2). Renders an evidence-target
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
// InteractionStep names it without a fifth schema type alias (AC 1 scopes
// this story's core/schemas/ edit to exactly these four aliases).
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

// ---- operation identity (AC 2, point 3, first bullet) -----------------

// Humanizing a kebab-case operationId is injective on distinct ids, and
// `buildPlanIndex` already rejects a duplicate `operationId` across
// interfaces, so two resolved operations never share this phrase. `method`
// and `pathTemplate` are never printed here: AD-16 withholds the operation
// inventory from the brief.
function operationReference(operation: Operation): string {
	return `the ${operation.operationId.split('-').join(' ')} endpoint`
}

// ---- the binding clause and its escalation (AC 2, point 3) ------------

// Three rungs, not four: generic, then binding kind, then literal value. A
// fourth rung computed from `method`/`pathTemplate` was tried and removed: it
// is identical for every sibling on one operation, and mutation testing found
// it added no disambiguating power beyond `literal`.
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
// never depends on a binding map's insertion order (AC 5's permutation
// determinism concern).
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

// Recursively sorts object keys before stringifying, matching
// `canonicalize.ts`'s own key-sorting rule (AD-27: UTF-16 code unit order,
// which is what this project's default `.sort()` already does). Two
// contracts differing only in one literal binding's declared key order share
// one canonical digest under `canonicalize.ts`; without this, they would
// render different prose from that one identical digest.
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

// Base rendering (AC 2): `type-violating` always names the input malformed.
// `any` and, at the 'generic' level, `literal` share the same generic wording
// on purpose; the escalation ladder below tells them apart once two steps
// would otherwise collide.
function renderBindingValue(
	entry: TransportEntry,
	level: EscalationLevel,
): string {
	const name = entryName(entry)
	if (isTypeViolating(entry.value)) {
		return `a malformed ${name} value`
	}
	if (level === 'generic' || 'matcher' in entry.value) {
		return `the supplied ${name}`
	}
	if (level === 'kind') {
		return `the stated ${name}`
	}
	return `the ${name} ${formatLiteral(entry.value.literal)}`
}

// Every declared binding key escalates together, not only the discriminating
// one: narrowing to whichever key disambiguates a collision would make one
// step's shown detail depend on what other steps happen to collide with it
// elsewhere. Naming a step's own bound parameter keys is not the operation
// inventory AD-16 withholds; that scope is which other calls exist, not this
// call's own fields.
//
// A type-violating binding is the semantically salient one (usually what the
// referencing oracle is about), so when one is present the clause names only
// that, matching AD-16's worked example ("when you sent an invalid
// identifier" names nothing else the request carried).
function bindingClause(
	step: InteractionStep,
	level: EscalationLevel,
): string | null {
	const entries = bindingEntries(step)
	if (entries.length === 0) return null
	const malformed = entries.filter((entry) => isTypeViolating(entry.value))
	const chosen = malformed.length > 0 ? malformed : entries
	return `with ${joinWithAnd(chosen.map((entry) => renderBindingValue(entry, level)))}`
}

// The binding clause is parenthesized rather than comma-joined onto the
// operation reference: a step reference can itself be joined with other
// phrases at a higher level (`joinWithAnd`, or a temporal pair's "compared
// with"), and `bindingClause` already carries its own internal ", and"
// separators. A second comma layer on top of that produces indistinguishable
// comma soup once two or more phrases are joined; parenthesizing sets the
// binding detail off structurally so the outer join stays recoverable. This
// is neutral for the Set-based distinctness check below, which compares whole
// strings regardless of where the parentheses fall.
function stepReferenceAtLevel(
	step: InteractionStep,
	operation: Operation,
	level: EscalationLevel,
): string {
	const base = operationReference(operation)
	const clause = bindingClause(step, level)
	return clause === null ? base : `${base} (${clause})`
}

/**
 * Renders one step's reference, escalating in the fixed order AC 2 declares:
 * generic, then the discriminating binding key and its kind, then the literal
 * value, until every step in `siblings` renders distinctly.
 *
 * `siblings` is direction-scoped: the caller passes only the steps the
 * current direction's own resolved evidence targets reference that share this
 * operation, not every step in the plan that shares it (AD-16). Requiring
 * distinctness against steps a direction never mentions would reject an
 * otherwise renderable direction over an unrelated collision elsewhere in the
 * plan.
 *
 * If two siblings still render identically after every rung, this throws the
 * same precondition-violation `TypeError` `buildPlanIndex` throws on a
 * duplicate `stepId`, rather than returning a phrase two different steps
 * would share.
 */
export function renderStepReference(
	step: InteractionStep,
	operation: Operation,
	siblings: readonly InteractionStep[],
): string {
	for (const level of ESCALATION_LEVELS) {
		const phrases = siblings.map((sibling) =>
			stepReferenceAtLevel(sibling, operation, level),
		)
		if (new Set(phrases).size === phrases.length) {
			return stepReferenceAtLevel(step, operation, level)
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

// ---- the channel framing (AC 2, point 2) -------------------------------

// An empty string is `TOKEN_SOURCE`'s own legal spelling for a zero-length
// key (RFC 6901 admits it), but it names no field worth naming, so it is
// filtered out rather than spliced in verbatim, which would otherwise produce
// a blank name ("its  field") or a stray "." in a multi-segment path. When
// more than one named segment remains, the full path renders joined by "."
// (e.g. "a.id") rather than only the last segment, so two nested pointers
// sharing one leaf field name (`.../a/id` and `.../b/id`) never collapse to
// the same phrase.
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
): string {
	const local = localTargetPhrase(resolved.target)
	const stepRef = renderStepReference(
		resolved.step,
		resolved.operation,
		siblingsOf(resolved.operation.operationId),
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

// A total order over one pair, independent of which was passed first: rank by
// channel kind (call-inputs, "sent", ranks before any "obtained" channel),
// then by channel signature, then by each side's derived step reference. That
// last rung fires only on a genuine signature tie, such as the same field
// name read from two different `after`-linked steps' response bodies. It
// never degenerates to argument order: identical same-operation siblings
// throw in `renderStepReference` before reaching here, and two different
// operations always humanize to two different names, so every rung stays
// content-derived.
function sentFirstOrder(
	a: ResolvedTarget,
	b: ResolvedTarget,
	siblingsOf: SiblingsOf,
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
	)
	const referenceB = renderStepReference(
		b.step,
		b.operation,
		siblingsOf(b.operation.operationId),
	)
	return referenceA <= referenceB ? [a, b] : [b, a]
}

// ---- grouping: same-step multi-target directions and the AC 4 temporal pair --

type PhraseGroup =
	| { readonly kind: 'single'; readonly resolved: readonly ResolvedTarget[] }
	| {
			readonly kind: 'temporal-pair'
			readonly a: ResolvedTarget
			readonly b: ResolvedTarget
	  }

// AC 4: two evidence targets whose steps are declared in an `after`
// relationship render as one relational phrase, so concatenation never
// discloses which step came first. A same-step multi-target group stays
// `single` regardless of `after`; forcing a pair there would guess at which
// target on each side pairs with which.
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

	// `chosenSuccessorOf` maps each predecessor to at most one chosen
	// successor, and each successor wins at most one predecessor, so it is a
	// disjoint union of simple chains (or cycles, on a malformed `after`
	// graph). Walking only from steps absent from `chosenAsSuccessor` therefore
	// starts at true chain roots and can never enter a cycle, since every
	// cycle node is by construction someone's chosen successor.
	//
	// Each root is walked and paired every other link: (1st, 2nd), (3rd, 4th),
	// and so on, with a leftover final step left to render alone. This
	// generalizes a single-link collapse this function used to hard-code,
	// which silently dropped a chain's trailing links (`c -> d` in `a -> b ->
	// c -> d` vanished along with `b`). `pairedAway` marks each pair's second
	// half so the final loop below skips rendering it standalone.
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

function renderPhraseGroup(group: PhraseGroup, siblingsOf: SiblingsOf): string {
	if (group.kind === 'temporal-pair') {
		const [first, second] = sentFirstOrder(group.a, group.b, siblingsOf)
		return `${fullTargetPhrase(first, siblingsOf)}, compared with ${fullTargetPhrase(second, siblingsOf)}`
	}
	const first = group.resolved[0]
	if (first === undefined) {
		throw new TypeError('evidence-target group is empty')
	}
	if (group.resolved.length === 1) {
		return fullTargetPhrase(first, siblingsOf)
	}
	const stepRef = renderStepReference(
		first.step,
		first.operation,
		siblingsOf(first.operation.operationId),
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
 * ordered, order-independent reference clause: byte-identical under any
 * permutation of `evidenceTargets`, the `PlanIndex`'s `interactionPlan`, or
 * its `permittedInterfaces`. Every phrase comes from Map-keyed lookups and
 * structural properties of the pointer/step/operation triad, never array
 * position, and the final join sorts phrases before joining.
 *
 * A repeated pointer is deduplicated before resolving: left in place, it
 * would push its step out of the "exactly one target" shape AC 4's temporal
 * pairing requires, silently disabling the relational phrase for an
 * otherwise-valid pair.
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
	const phrases = groups.map((group) => renderPhraseGroup(group, siblingsOf))
	return joinWithAnd([...phrases].sort())
}
