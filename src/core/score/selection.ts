/**
 * Owed item 2's fix: a step selects observations by `operationId`, ordered by
 * the record's monotonic `sequence` (ADR-006 forbids array position as
 * ordering). `selectObservations` reports a several-match ambiguity as data;
 * no first-match or last-match convention picks a winner. Pure and total:
 * every input produces a defined result, nothing throws, and no AD-6 outcome
 * state is assigned. Assigning outcome state is AD-33's reference decision
 * procedure's job.
 *
 * `resolveTemporalAnchor` is a separate, narrower resolution built on top:
 * picking a concrete point in time for an `any`-cardinality temporal anchor
 * with several matches, by lowest sequence. The policy above still holds
 * here: a single-valued cardinality's several-match ambiguity still comes
 * back unresolved from `resolveTemporalAnchor` too.
 *
 * No stage claims this module yet; `stage-table.ts`'s `score` row stays
 * `module: null` throughout.
 */

import type { InteractionStep } from '../schemas/plan.ts'
import type { Observation } from '../schemas/sealed-run-record.ts'

/** How many observations a step's selector matched. Never a count past two: past one match, only "several" is recorded. */
export type SelectionCount = 'none' | 'one' | 'several'

export type StepSelection = {
	readonly result: SelectionCount
	/**
	 * In ascending-`sequence` order, never array order. Empty for `none`, one
	 * member for `one`, two or more for `several`.
	 */
	readonly matchedObservationIds: readonly Observation['observationId'][]
}

/**
 * Matches `step.operationId` against every observation's `operationId`,
 * ordered by `sequence` ascending. Reads no other field of `step`: whether
 * `several` is the named ambiguity condition or a legitimate `any`-cardinality
 * match is a fact about the step's declared cardinality, decided by whoever
 * reads this result, not by this function.
 *
 * Sorts a copy; the input `observations` array is never mutated, and its own
 * order is never read as meaning anything (NFR9: a permutation of the same
 * observations yields byte-identical `matchedObservationIds`). The schema
 * layer enforces per-record `sequence` uniqueness, so a real `SealedRunRecord`
 * never presents a tie. `observationId` is the secondary sort key regardless:
 * this function's own permutation invariance holds even against a hand-built
 * or malformed `observations` array carrying a duplicate or non-finite
 * `sequence`, decided by this comparator alone.
 *
 * Matching on `operationId` alone, ignoring `step.inputBinding`, is a
 * deliberate scope boundary that stays: candidate-tuple resolution lives in
 * `selectWithBindings` (`score/bindings.ts`), which wraps this function and
 * filters its matches against the step's own resolved bindings. Splitting them
 * keeps this function's permutation guarantee provable on its own.
 *
 * `tests/seal/fixtures.ts`'s `irreducibleCollisionPair` was once cited here as
 * a case "distinguishable only by input binding". It is not: its two steps
 * bind nothing in any channel, so a filter over zero bindings separates
 * nothing and both stay `several` even with `selectWithBindings`. The pair
 * that separates is `literalCollisionPair`, whose two steps bind one key to
 * two different literals.
 */
export function selectObservations(
	step: InteractionStep,
	observations: readonly Observation[],
): StepSelection {
	const matched = observations
		.filter((observation) => observation.operationId === step.operationId)
		.sort(
			(a, b) =>
				a.sequence - b.sequence || (a.observationId < b.observationId ? -1 : 1),
		)
	const matchedObservationIds = matched.map(
		(observation) => observation.observationId,
	)
	const result: SelectionCount =
		matchedObservationIds.length === 0
			? 'none'
			: matchedObservationIds.length === 1
				? 'one'
				: 'several'
	return { result, matchedObservationIds }
}

/**
 * Resolves an `after` temporal clause to the single observation it denotes,
 * built directly from `selectObservations`'s own result over the anchor.
 *
 * Takes the anchor step itself, already resolved from the dependent step's
 * `after` identifier (a one-line lookup against whichever declared plan the
 * caller holds). A step whose clause is `null`, or whose clause names a step
 * the plan does not declare (AD-39's permissive dangling reference), names no
 * anchor and never reaches this function.
 */
export function resolveTemporalAnchor(
	anchorStep: InteractionStep,
	observations: readonly Observation[],
): TemporalAnchorResolution {
	const selection = selectObservations(anchorStep, observations)
	if (selection.result === 'one') {
		return {
			resolved: true,
			// `result === 'one'` guarantees exactly one member.
			observationId: selection
				.matchedObservationIds[0] as Observation['observationId'],
			matchedObservationIds: selection.matchedObservationIds,
		}
	}
	if (selection.result === 'several' && anchorStep.cardinality === 'any') {
		// Ascending-`sequence` order already holds the lowest-sequence match first.
		return {
			resolved: true,
			observationId: selection
				.matchedObservationIds[0] as Observation['observationId'],
			matchedObservationIds: selection.matchedObservationIds,
		}
	}
	// `none`, or `several` under a single-valued cardinality: no single
	// observation resolves. Reported as data; routing this to a verdict rung
	// is later work.
	return {
		resolved: false,
		result: selection.result,
		matchedObservationIds: selection.matchedObservationIds,
	}
}

export type TemporalAnchorResolution =
	| {
			readonly resolved: true
			readonly observationId: Observation['observationId']
			readonly matchedObservationIds: readonly Observation['observationId'][]
	  }
	| {
			readonly resolved: false
			readonly result: Extract<SelectionCount, 'none' | 'several'>
			readonly matchedObservationIds: readonly Observation['observationId'][]
	  }
