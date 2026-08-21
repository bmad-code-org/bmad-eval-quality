/**
 * The derived-reference vocabulary (AD-16, AC 2). Renders an evidence-target
 * pointer, or a temporally-paired two of them, as a descriptive reference to
 * the step's operation and selection predicate, never to the step's own
 * identifier. Pointers resolved through a `PlanIndex` go in and a phrase comes
 * out. That is Task 4's own deliverable, kept apart from `plan-index.ts`'s
 * resolving and from `direction-prose.ts`'s relation templates.
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
// InteractionStep names it without adding a fifth schema type alias. AC 1
// scopes this story's one core/schemas/ edit to exactly the four named aliases.
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
// `buildPlanIndex` already throws on a duplicate `operationId` across
// interfaces, so two different resolved operations never share this phrase.
// `method` and `pathTemplate` are never printed anywhere in this module,
// because AD-16 withholds the operation inventory from the brief on purpose.
function operationReference(operation: Operation): string {
	return `the ${operation.operationId.split('-').join(' ')} endpoint`
}

// ---- the binding clause and its escalation (AC 2, point 3) ------------

// Three rungs, not four. `generic`, then the discriminating binding kind,
// then the literal value. A fourth rung computed from `method`/`pathTemplate`
// was tried and removed: it is identical for every sibling on one operation,
// and mutation testing confirmed it adds zero disambiguating power the
// `literal` rung had not already found. `renderStepReference` throws once
// `literal` fails to disambiguate, rather than reaching for a rung that
// cannot help.
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

// Sorted by transport channel, in a fixed structural order, and then by key
// name. So this never depends on a binding map's own insertion order, which is
// the determinism concern AC 5's permutation family names.
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

// The transport channel is part of the rendered name as well as the sort key.
// Two bindings can share a parameter name across channels (path.id and
// query.id), and without the channel qualifier both render as "the supplied
// id", which is identical text hiding two different bindings in one clause.
function entryName(entry: TransportEntry): string {
	return `${entry.transportChannel} ${entry.key}`
}

function isTypeViolating(value: BindingValue): boolean {
	return 'matcher' in value && value.matcher === 'type-violating'
}

// Recursively sorts object keys before stringifying, matching
// `canonicalize.ts`'s own key-sorting rule (AD-27: object keys sort by UTF-16
// code unit, which is what the default string comparison `.sort()` uses on
// this project's identifiers). Two contracts whose only difference is the
// declared key order of one literal-valued binding share one canonical digest
// under `canonicalize.ts`; without this, they would render different
// evaluator-facing prose from that one identical digest.
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

// Base rendering (AC 2). `type-violating` always names the input as malformed.
// `any` and, at the 'generic' level, `literal` share the same generic wording
// on purpose. The escalation ladder below is what tells them apart once two
// steps would otherwise collide.
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

// Every declared binding key escalates together, not only "the discriminating
// one": narrowing to just whichever key would disambiguate a collision would
// make the amount of detail shown for one step depend on what other steps
// happen to collide with it elsewhere, which is its own asymmetric-
// information problem. Disclosing one already-named step's own bound
// parameter names is not the operation inventory AD-16 withholds; that
// withholding is about which other calls exist, not what fields the one call
// under discussion carries.
//
// A type-violating binding is the semantically salient one (it is what the
// oracle referencing this step is usually about), so when one is present the
// clause names only that, matching AD-16's own worked example ("when you sent
// an invalid identifier" mentions nothing else the request carried).
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
// operation reference. A step reference can itself be joined with other
// phrases at a higher level, by `joinWithAnd` or by a temporal pair's
// "compared with", and `bindingClause` already carries its own internal ", and"
// separators when a step binds more than one parameter. Comma-joining a second
// layer on top of that produces indistinguishable comma soup once two or more
// such phrases are joined. Parenthesizing sets the binding detail off
// structurally, so the outer join stays recoverable. It is neutral for
// `renderStepReference`'s Set-based distinctness check below, which compares
// whole strings and does not care where the parentheses fall.
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
 * `siblings` is direction-scoped: the caller passes the set of steps the
 * current direction's own resolved evidence targets reference that share this
 * operation, not every step in the whole plan that happens to share it.
 * AD-16's own cited rationale for the derived-reference vocabulary is "a
 * direction over two observations of one operation could not say which is
 * which", scoped to one direction. Requiring distinctness against steps a
 * direction never mentions would reject a perfectly renderable direction
 * because of an unrelated collision elsewhere in the plan, which gets worse as
 * the plan grows.
 *
 * If two siblings still render identically once every rung has been tried,
 * meaning an irreducible collision the declared structure does not
 * distinguish within this direction's own referenced steps, this throws the
 * same precondition-violation `TypeError` `buildPlanIndex` throws on a
 * duplicate `stepId`, rather than silently returning a phrase two different
 * steps would share.
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
// key, which RFC 6901 admits, but it names no field worth naming. Filtered
// out rather than spliced in verbatim, which would otherwise produce a blank
// name ("its  field") or a stray "." in a multi-segment path. When more than
// one named segment remains, the full path renders joined by "." (for example
// "a.id") rather than only the last segment, so two structurally different
// nested pointers sharing one leaf field name (`.../a/id` and `.../b/id`)
// never collapse to the same phrase. The common single-segment case is
// unaffected.
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
			// fallback below. Two call-inputs targets on different transport
			// channels sharing a parameter name (path.id, query.id) must not
			// collapse to the same phrase.
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
			// Distinguished from response-body's "field" wording, and from
			// stderr below, so two different channels naming the same field on
			// one step never render identical text.
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

// Encoded as a JSON array, not a `/`-joined string. A `/`-join conflates a tail
// token containing a literal `/` (reachable via the RFC 6901 `~1` escape, e.g.
// tail `['a/b']`) with an equivalent multi-segment tail (`['a', 'b']`). Both
// join to the same `".../a/b"` string and produce a false tie in
// `sentFirstOrder` below. `JSON.stringify` keeps the array boundary the join
// collapses.
function channelSignature(target: EvidenceTarget): string {
	return JSON.stringify([target.channel, target.transportChannel, target.tail])
}

// A total order over one pair, independent of which was passed first. Rank by
// channel kind, where call-inputs ("sent") ranks before any "obtained" channel,
// then by the pointer's own channel signature, then by each side's own derived
// step reference. That last rung fires only on a genuine signature tie, such as
// the same field name read from two different `after`-linked steps' response
// bodies. It never degenerates to argument order, because two different steps
// always render two different references: identical same-operation siblings
// throw in `renderStepReference` before reaching here, and two different
// operations always humanize to two different names. So every rung is
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
// relationship render as one relational phrase rather than two independent
// ones, so concatenation never discloses which step came first. A same-step
// group of targets (AC 2's other multi-target case) is a `single` group
// regardless of `after`, and a step referenced together with more than one
// target from a temporally-linked partner falls back to `single` groups too.
// This story's fixtures never need the relational phrase for that shape, and
// forcing it would guess at which target on each side pairs with which.
//
// Pairing is resolved from sorted step ids and sorted candidate lists, never
// from discovery order over `resolved` (whose order is `evidenceTargets`'
// own declaration order): a predecessor referenced by more than one
// successor (AD-39's one-level bound admits two steps naming the same
// `after` target) can pair with only one of them, and the winner is chosen
// by the successor's own `stepId` sorting first, a fixed content-derived
// tie-break, so the same predecessor always pairs with the same successor
// and the losing successor always renders as its own `single` group,
// regardless of which order the direction's `evidenceTargets` name them in.
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

	// A step appears in at most one relational-phrase group. A chain (a's
	// chosen successor is b, and b's own chosen successor is c) would
	// otherwise use `b` twice, once as a's successor and once as c's
	// predecessor. `chosenSuccessorOf`, read as predecessor -> chosen
	// successor, has out-degree and in-degree at most one per step (a step
	// names at most one `after` predecessor, and wins at most one
	// predecessor's selection), so it is always a disjoint union of simple
	// chains. `chosenAsSuccessor` (every value in the full, uncollapsed map)
	// identifies each chain's non-root members, so the walk below starts only
	// at true roots, never mid-chain.
	//
	// Walking a chain root-to-tail and pairing every other edge -- (1st, 2nd),
	// then (3rd, 4th), and so on, with a leftover final step rendering alone --
	// is the general form of the single-link collapse this used to hard-code.
	// A one-link chain (a -> b) still collapses to exactly one pair, as before.
	// A longer chain no longer drops its trailing links: `c -> d` in `a -> b ->
	// c -> d` used to vanish because voiding *every* key that was also a value
	// discarded `c`'s own entry along with `b`'s, even though `c` was free once
	// `b` was consumed by `a`. Walking from the root and re-entering the map at
	// each pair's own successor (`chosenSuccessorOf.get(second)`, not
	// `second`'s position in the original chain) reclaims exactly the links a
	// fixed root still has available, and nothing this function has already
	// used. `pairedAway` collects each pair's second half so the final loop
	// below skips rendering it standalone, playing the same role
	// `chosenAsSuccessor` played before this walk existed, now scoped to the
	// links actually emitted as pairs rather than every link in the original
	// graph.
	//
	// The walk cannot loop forever even on a malformed, schema-legal `after`
	// graph (a cycle, or a step naming itself): `chosenSuccessorOf` is
	// injective (each successor step has exactly one `after` value, so it can
	// win at most one predecessor's selection), which makes it a disjoint union
	// of simple chains and simple cycles. Every node on a cycle, self-loop
	// included, is by definition someone's chosen successor, so it is always in
	// `chosenAsSuccessor` and the root-finding loop below never starts a walk
	// there; only genuine chain roots (in-degree zero) start one, and a chain
	// has no cycle to loop back into.
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
		// Rendered as part of its predecessor's pair below, not on its own.
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
	// Sorted, so a same-step group's own multi-target order is
	// permutation-invariant exactly like the top-level join below. In
	// declaration order, permuting `evidenceTargets` changes which field is
	// named first here.
	const locals = group.resolved
		.map((entry) => localTargetPhrase(entry.target))
		.sort()
	return `${stepRef}: ${joinWithAnd(locals)}`
}

/**
 * Renders every evidence target a direction declares as one canonically
 * ordered, order-independent reference clause. Byte-identical under a
 * permutation of `evidenceTargets`, of the `PlanIndex`'s `interactionPlan`,
 * and of its `permittedInterfaces`: every phrase this function builds comes
 * from Map-keyed lookups and structural properties of the pointer/step/
 * operation triad, never from array position, and the final join sorts its
 * phrases before joining rather than following declaration or discovery order.
 *
 * A repeated pointer is deduplicated before resolving. It conveys no
 * additional information, and left in place it would push its step out of the
 * "exactly one target" shape the AC 4 temporal pairing requires, silently
 * disabling the relational phrase for an otherwise-valid pair while also
 * duplicating the phrase itself.
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
