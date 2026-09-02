/**
 * Owed item 3's score-time half: resolving a captured pointer to the scalar an
 * earlier step's observation carried, and filtering a step's matched
 * observations against its own selection predicate before reporting a
 * cardinality verdict.
 *
 * An AD-39 selector is an input binding and an optional temporal clause, so
 * `selectWithBindings` resolves both halves. `selectObservations` matches on
 * `operationId` alone and is untouched, so its permutation guarantee and its
 * tests stand; this wraps it.
 *
 * Pure and total, like the module it wraps: nothing throws on unresolvable
 * evidence, and no AD-6 outcome state is assigned.
 */
import { capturedBindings } from '../compile/bindings.ts'
import { channelRoot, walkTail } from '../evaluate/evidence-resolution.ts'
import { ABSENT, type ResolvedValue } from '../evaluate/resolved-value.ts'
import type { InteractionStep } from '../schemas/plan.ts'
import {
	TRANSPORT_CHANNELS,
	type TransportChannelName,
} from '../schemas/pointer.ts'
import type { JsonValue } from '../schemas/primitives.ts'
import type { Observation } from '../schemas/sealed-run-record.ts'
import { type PlanIndex, parseEvidenceTarget } from '../seal/plan-index.ts'
import { bindingOrder } from './binding-order.ts'
import { type StepSelection, selectObservations } from './selection.ts'

/**
 * One captured pointer's resolution. `ResolvedValue` alone cannot carry this:
 * it is `JsonValue | ABSENT` with nowhere to put the observation the value came
 * from, its `sequence`, or the referenced step's named ambiguity. `sequence` is
 * what gives "earlier" a runtime meaning, since a capture graph that is acyclic
 * still says nothing about which observation came first.
 */
export type CapturedResolution =
	| {
			readonly status: 'resolved'
			readonly value: ResolvedValue
			readonly observationId: Observation['observationId']
			readonly sequence: number
	  }
	| { readonly status: 'absent' }
	// The named ambiguity, carried with the ids it could not choose between.
	// Both consumers here treat it exactly as `absent`, which is fail-closed and
	// correct; the ids are reported as data for whoever routes the ambiguity to
	// a verdict rung, matching `selectObservations`'s own policy.
	| {
			readonly status: 'ambiguous'
			readonly matchedObservationIds: readonly Observation['observationId'][]
	  }

const ABSENT_RESOLUTION: CapturedResolution = { status: 'absent' }

/**
 * The key one captured binding occupies in the resolution map. Keyed by
 * binding site rather than by pointer: one step can carry several captured
 * bindings, and two of them may name the same pointer in different channels.
 * JSON-encoded rather than delimiter-joined, since a parameter key is arbitrary
 * caller-supplied text and could contain any separator.
 */
export function bindingSiteKey(
	stepId: string,
	transportChannel: TransportChannelName,
	key: string,
): string {
	return JSON.stringify([stepId, transportChannel, key])
}

/**
 * Resolves one captured pointer against the record.
 *
 * The referenced step is selected through `selectWithBindings`, so its own
 * selection predicate applies before a value is read off it. Selecting it with
 * `selectObservations` alone would match on `operationId` and leave a step that
 * only its own bindings separate reporting the named ambiguity, which would
 * make a capture from either half of a literal-bound collision pair resolve
 * nothing at all. `resolved` carries the referenced step's own captured values,
 * already filled by the tier below it, which is what makes the tiering
 * load-bearing.
 *
 * The three dispositions already settled hold unchanged over the filtered
 * result: one match binds, several under a declared `any` binds the lowest
 * `sequence`, and several under `exactly-one`/`at-most-one` is the named
 * ambiguity, returned as data with no value resolved.
 *
 * A pointer whose step the plan does not declare, or whose referenced step
 * matched nothing, resolves `absent`.
 *
 * `resolved` as a status means an observation was selected, which is a
 * different fact from the pointer finding a value in it: a tail that walks off
 * the observed body comes back `resolved` carrying `ABSENT`, with the source
 * observation and its `sequence` intact. That is why `CapturedResolution.value`
 * is `ResolvedValue`. AD-26 makes absent an observation rather than an error,
 * and `deepEquals` is false against it, so the referencing step still selects
 * `none`; keeping the source observation means the ordering floor stays
 * computable either way.
 */
export function resolveCapturedValue(
	pointer: string,
	index: PlanIndex,
	observations: readonly Observation[],
	resolved: ReadonlyMap<string, CapturedResolution>,
): CapturedResolution {
	const target = parseEvidenceTarget(pointer)
	const step = index.stepOf(target.stepId)
	if (step === undefined) return ABSENT_RESOLUTION
	const selected = selectOne(step, observations, index, resolved, new Set())
	if (selected === null) return ABSENT_RESOLUTION
	if (selected.ambiguous !== null) {
		return { status: 'ambiguous', matchedObservationIds: selected.ambiguous }
	}
	const { source } = selected
	if (source === null) return ABSENT_RESOLUTION
	return {
		status: 'resolved',
		value: walkTail(channelRoot(source, target), target.tail),
		observationId: source.observationId,
		sequence: source.sequence,
	}
}

/**
 * One step's binding-filtered selection reduced to a single observation, or the
 * reason it reduces to none. `resolveTemporalAnchor`'s three dispositions,
 * applied to `selectWithBindings`'s result instead of `selectObservations`'s.
 *
 * `guard` holds the step ids currently being reduced. A plan whose `after`
 * clauses form a cycle would otherwise recurse without end;
 * `checkNestedTemporalClause` rejects every such plan at compile time, so this
 * only guards an uncompiled one, and it fails closed the way everything else
 * here does.
 */
type SingleSelection = {
	readonly source: Observation | null
	readonly ambiguous: readonly Observation['observationId'][] | null
}

function selectOne(
	step: InteractionStep,
	observations: readonly Observation[],
	index: PlanIndex,
	resolved: ReadonlyMap<string, CapturedResolution>,
	guard: ReadonlySet<string>,
): SingleSelection | null {
	if (guard.has(step.stepId)) return null
	const selection = selectFiltered(
		step,
		observations,
		index,
		resolved,
		new Set([...guard, step.stepId]),
	)
	const [first] = selection.matchedObservationIds
	if (selection.result === 'none' || first === undefined) {
		return { source: null, ambiguous: null }
	}
	if (selection.result === 'several' && step.cardinality !== 'any') {
		return { source: null, ambiguous: selection.matchedObservationIds }
	}
	// Ascending-`sequence` order already holds the lowest-sequence match first,
	// which is `resolveTemporalAnchor`'s own rule for a declared `any`.
	const source = observations.find(
		(observation) => observation.observationId === first,
	)
	return { source: source ?? null, ambiguous: null }
}

/**
 * Every captured binding in the plan, resolved in `bindingOrder`'s tiers and
 * keyed by binding site. Walking the tiers in order is what lets a step's
 * captured values be resolved against a referenced step whose own captures are
 * already in the map. Steps `bindingOrder` reports cyclic are left out, so
 * their bindings resolve as unlisted and filter every candidate away.
 */
export function resolveCapturedBindings(
	interactionPlan: readonly InteractionStep[],
	index: PlanIndex,
	observations: readonly Observation[],
): ReadonlyMap<string, CapturedResolution> {
	const resolved = new Map<string, CapturedResolution>()
	for (const tier of bindingOrder(interactionPlan).tiers) {
		for (const stepId of tier) {
			const step = index.stepOf(stepId)
			if (step === undefined) continue
			for (const capture of capturedBindings(step)) {
				resolved.set(
					bindingSiteKey(stepId, capture.transportChannel, capture.key),
					resolveCapturedValue(capture.pointer, index, observations, resolved),
				)
			}
		}
	}
	return resolved
}

// AD-4 separates `equality` from `deep-equality`; a literal binding is
// `JsonValue` and admits objects and arrays, so this is the deep one. Spelled
// here rather than reached for in `core/evaluate`'s operator set: that set
// resolves operands inside an oracle tree, and a binding filter is not an
// oracle.
// Exported so the AD-40 probe-side selector follows these rules rather than
// re-deriving them: two copies of a deep comparison that drift flip a witness
// match silently.
export function deepEquals(a: ResolvedValue, b: ResolvedValue): boolean {
	if (a === ABSENT || b === ABSENT) return false
	if (a === b) return true
	if (Array.isArray(a) || Array.isArray(b)) {
		if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
			return false
		}
		return a.every((element, position) =>
			deepEquals(element, b[position] as JsonValue),
		)
	}
	if (a === null || b === null) return false
	if (typeof a !== 'object' || typeof b !== 'object') return false
	const keys = Object.keys(a)
	if (keys.length !== Object.keys(b).length) return false
	return keys.every(
		(key) =>
			Object.hasOwn(b, key) &&
			deepEquals(a[key] as JsonValue, b[key] as JsonValue),
	)
}

export function jsonTypeOf(value: JsonValue): string {
	if (value === null) return 'null'
	if (Array.isArray(value)) return 'array'
	return typeof value
}

/**
 * The highest `sequence` any of this step's captured bindings resolved from, or
 * `null` when one of them resolved nothing at all. A candidate must come
 * strictly after every captured value, so the highest is the binding bound.
 */
function capturedFloor(
	step: InteractionStep,
	resolved: ReadonlyMap<string, CapturedResolution>,
): number | null {
	let floor: number | null = null
	for (const capture of capturedBindings(step)) {
		const resolution = resolved.get(
			bindingSiteKey(step.stepId, capture.transportChannel, capture.key),
		)
		if (resolution === undefined || resolution.status !== 'resolved')
			return null
		floor =
			floor === null
				? resolution.sequence
				: Math.max(floor, resolution.sequence)
	}
	return floor
}

/**
 * Whether one observation's recorded call inputs satisfy one step's declared
 * bindings. Four rules over the four tagged forms, and one shared
 * precondition: every channel of `observation.callInputs` is nullable, and a
 * `null` channel means the key is not present, so a binding into one filters
 * the candidate out. That is the same fail-closed disposition as an absent
 * captured value, and AD-26's.
 *
 * - `{ literal: v }`: the observed value deep-equals `v`, key order
 *   irrelevant.
 * - `{ captured: p }`: the observed value deep-equals the resolved captured
 *   value. The ordering half is `capturedFloor`'s, applied before this runs.
 * - `{ matcher: 'any' }` and `{ principal }`: the key is present, and nothing
 *   more. Neither declares a value the contract knows: a principal's value is
 *   provisioned by the harness at runtime, which is the whole reason the
 *   binding exists. The consequence is that two steps differing only by which
 *   principal they bind cannot be separated here, because no field of a sealed
 *   run record says which principal the harness used.
 * - `{ matcher: 'type-violating' }`: the observed value's JSON type differs
 *   from the operation's declared type for that key. A key whose declared type
 *   is absent or `null` fails closed: an indeterminate type cannot prove a
 *   violation.
 */
function satisfiesBindings(
	step: InteractionStep,
	observation: Observation,
	index: PlanIndex,
	resolved: ReadonlyMap<string, CapturedResolution>,
): boolean {
	const operation = index.operationOf(step.operationId)
	for (const channel of TRANSPORT_CHANNELS) {
		const binding = step.inputBinding[channel]
		if (binding === null) continue
		const observed = observation.callInputs[channel]
		if (observed === null) return false
		for (const key of Object.keys(binding)) {
			const value = binding[key]
			if (value === undefined) continue
			if (!Object.hasOwn(observed, key)) return false
			const actual = observed[key] as JsonValue
			if ('literal' in value) {
				if (!deepEquals(actual, value.literal)) return false
				continue
			}
			if ('captured' in value) {
				const resolution = resolved.get(
					bindingSiteKey(step.stepId, channel, key),
				)
				if (resolution === undefined || resolution.status !== 'resolved') {
					return false
				}
				if (!deepEquals(actual, resolution.value)) return false
				continue
			}
			if ('principal' in value) continue
			if (value.matcher === 'any') continue
			const declared = operation?.requestShape[channel].types[key]
			if (declared === undefined || declared === null) return false
			if (jsonTypeOf(actual) === declared) return false
		}
	}
	return true
}

/**
 * The lower `sequence` bound a step's temporal clause imposes, or `null` when
 * it imposes none.
 *
 * A `null` clause, and a clause naming a step the plan does not declare, both
 * impose nothing: AD-39 makes a dangling reference permissive, and there is no
 * anchor to resolve. A declared anchor that resolves nothing (matched no
 * observation, or matched several under a single-valued cardinality) fails
 * closed instead, reported as `unsatisfiable`. "No anchor exists" and "the
 * anchor cannot be pinned down" are different facts, and only the second one
 * rules every candidate out.
 *
 * The anchor is selected through the same binding filter as everything else, so
 * a temporal clause naming a step that only its own bindings separate resolves
 * to that step's one observation.
 */
type TemporalFloor =
	| { readonly kind: 'none' }
	| { readonly kind: 'after'; readonly sequence: number }
	| { readonly kind: 'unsatisfiable' }

function temporalFloor(
	step: InteractionStep,
	index: PlanIndex,
	observations: readonly Observation[],
	resolved: ReadonlyMap<string, CapturedResolution>,
	guard: ReadonlySet<string>,
): TemporalFloor {
	if (step.after === null) return { kind: 'none' }
	const anchorStep = index.stepOf(step.after)
	if (anchorStep === undefined) return { kind: 'none' }
	const anchor = selectOne(anchorStep, observations, index, resolved, guard)
	if (anchor === null || anchor.source === null)
		return { kind: 'unsatisfiable' }
	return { kind: 'after', sequence: anchor.source.sequence }
}

/**
 * `selectObservations`, then the step's own selection predicate as a filter
 * over the matches, then the cardinality verdict over what survived.
 *
 * The order is temporal clause, then capture ordering, then the binding
 * filters. Ordering is enforced at score time as well as at compile time: the
 * persistence read-back this exists for is exactly a claim about order, and a
 * record whose `GET` sits at `sequence` 2 and whose `POST` sits at `sequence` 9
 * would otherwise satisfy the binding and pass an oracle proving the opposite.
 *
 * `resolved` is the map `resolveCapturedBindings` fills from `bindingOrder`'s
 * tiers, keyed by binding site. An unlisted or unresolved site filters every
 * candidate out, so a caller that skipped a tier gets `none` rather than a
 * silently wrong match.
 *
 * A filter over zero bindings and no clause separates nothing, so two steps
 * sharing an operation and declaring neither both still return `several`: the
 * declared structure does not distinguish them.
 */
export function selectWithBindings(
	step: InteractionStep,
	observations: readonly Observation[],
	index: PlanIndex,
	resolved: ReadonlyMap<string, CapturedResolution>,
): StepSelection {
	return selectFiltered(step, observations, index, resolved, new Set())
}

// `guard` carries the steps already being resolved further up the call, so an
// `after` clause cycle in an uncompiled plan terminates instead of recursing.
function selectFiltered(
	step: InteractionStep,
	observations: readonly Observation[],
	index: PlanIndex,
	resolved: ReadonlyMap<string, CapturedResolution>,
	guard: ReadonlySet<string>,
): StepSelection {
	const base = selectObservations(step, observations)
	const temporal = temporalFloor(
		step,
		index,
		observations,
		resolved,
		new Set([...guard, step.stepId]),
	)
	const captured = capturedFloor(step, resolved)
	const hasCaptures = capturedBindings(step).length > 0
	if (temporal.kind === 'unsatisfiable' || (hasCaptures && captured === null)) {
		return { result: 'none', matchedObservationIds: [] }
	}
	const floor = Math.max(
		temporal.kind === 'after' ? temporal.sequence : Number.NEGATIVE_INFINITY,
		captured ?? Number.NEGATIVE_INFINITY,
	)
	const byId = new Map(
		observations.map((observation) => [observation.observationId, observation]),
	)
	const matchedObservationIds = base.matchedObservationIds.filter((id) => {
		const observation = byId.get(id)
		return (
			observation !== undefined &&
			observation.sequence > floor &&
			satisfiesBindings(step, observation, index, resolved)
		)
	})
	const result =
		matchedObservationIds.length === 0
			? 'none'
			: matchedObservationIds.length === 1
				? 'one'
				: 'several'
	return { result, matchedObservationIds }
}
