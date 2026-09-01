import { describe, expect, it } from 'vitest'
import type { InteractionStep } from '../../src/core/schemas/plan.ts'
import type { Observation } from '../../src/core/schemas/sealed-run-record.ts'
import {
	resolveTemporalAnchor,
	selectObservations,
} from '../../src/core/score/selection.ts'

/** A minimal, schema-shaped observation: every field the selector never reads is filled with an inert default. */
function observation(
	observationId: string,
	sequence: number,
	operationId: string,
): Observation {
	return {
		observationId,
		sequence,
		operationId,
		provenance: 'evaluator-chosen',
		callInputs: { path: null, query: null, header: null, body: null },
		responseBody: null,
		responseHeaders: null,
		responseStatus: 200,
		stdout: null,
		stderr: null,
		exitCode: null,
	}
}

/** A minimal step naming `operationId`, cardinality overridable per case. */
function step(
	operationId: string,
	cardinality: InteractionStep['cardinality'] = 'exactly-one',
	after: string | null = null,
): InteractionStep {
	return {
		stepId: 'under-test',
		operationId,
		inputBinding: { path: null, query: null, header: null, body: null },
		after,
		cardinality,
	}
}

describe('selectObservations', () => {
	it('returns none when no observation shares the operationId', () => {
		const result = selectObservations(step('get-note'), [
			observation('obs-1', 1, 'other-op'),
		])
		expect(result).toEqual({ result: 'none', matchedObservationIds: [] })
	})

	it('returns one when exactly one observation matches', () => {
		const result = selectObservations(step('get-note'), [
			observation('obs-1', 1, 'other-op'),
			observation('obs-2', 2, 'get-note'),
		])
		expect(result).toEqual({
			result: 'one',
			matchedObservationIds: ['obs-2'],
		})
	})

	it('returns several as data under a single-valued cardinality when two or more match', () => {
		const result = selectObservations(step('get-note', 'exactly-one'), [
			observation('obs-1', 1, 'get-note'),
			observation('obs-2', 2, 'get-note'),
		])
		expect(result.result).toBe('several')
		expect(result.matchedObservationIds).toEqual(['obs-1', 'obs-2'])
	})

	it('returns several under `at-most-one` cardinality when two or more match, same as `exactly-one`', () => {
		const result = selectObservations(step('get-note', 'at-most-one'), [
			observation('obs-1', 1, 'get-note'),
			observation('obs-2', 2, 'get-note'),
		])
		expect(result.result).toBe('several')
		expect(result.matchedObservationIds).toEqual(['obs-1', 'obs-2'])
	})

	it('returns several under `any` cardinality when several match', () => {
		const result = selectObservations(step('get-note', 'any'), [
			observation('obs-1', 3, 'get-note'),
			observation('obs-2', 1, 'get-note'),
			observation('obs-3', 2, 'get-note'),
		])
		expect(result.result).toBe('several')
		// ascending sequence order: obs-2 (1), obs-3 (2), obs-1 (3)
		expect(result.matchedObservationIds).toEqual(['obs-2', 'obs-3', 'obs-1'])
	})

	it('orders matches by sequence, never by array position', () => {
		const shuffled = [
			observation('obs-c', 3, 'get-note'),
			observation('obs-a', 1, 'get-note'),
			observation('obs-b', 2, 'get-note'),
		]
		const result = selectObservations(step('get-note', 'any'), shuffled)
		expect(result.matchedObservationIds).toEqual(['obs-a', 'obs-b', 'obs-c'])
	})

	// NFR9: the same observations, permuted every which way, produce a
	// byte-identical result. Exercised over every permutation of a small set,
	// which proves the invariant holds for all of them.
	it('is permutation-invariant: every ordering of the same observations yields the identical result (NFR9)', () => {
		const base = [
			observation('obs-a', 1, 'get-note'),
			observation('obs-b', 2, 'get-note'),
			observation('obs-c', 3, 'get-note'),
			observation('obs-d', 4, 'other-op'),
		]
		const permutationsOf = <T>(items: readonly T[]): T[][] => {
			if (items.length <= 1) return [items.slice()]
			const permutations: T[][] = []
			for (let i = 0; i < items.length; i++) {
				const rest = [...items.slice(0, i), ...items.slice(i + 1)]
				for (const tail of permutationsOf(rest)) {
					permutations.push([items[i] as T, ...tail])
				}
			}
			return permutations
		}
		const expected = selectObservations(step('get-note', 'any'), base)
		for (const permutation of permutationsOf(base)) {
			expect(selectObservations(step('get-note', 'any'), permutation)).toEqual(
				expected,
			)
		}
	})

	it('assigns no AD-6 outcome state: the result is match data', () => {
		const result = selectObservations(step('get-note'), [])
		expect(result).not.toHaveProperty('state')
		expect(result).not.toHaveProperty('outcome')
	})

	// The schema layer enforces per-record sequence uniqueness, so this input
	// shape never comes from a validated SealedRunRecord. The comparator's own
	// observationId tie-break still resolves it, both cases here, so the
	// function stays total and permutation-invariant against a hand-built
	// array a caller assembled without going through schema validation.
	it('breaks a tied sequence deterministically by observationId, regardless of array order', () => {
		const tied = [
			observation('obs-b', 1, 'get-note'),
			observation('obs-a', 1, 'get-note'),
		]
		const result = selectObservations(step('get-note', 'any'), tied)
		expect(result.matchedObservationIds).toEqual(['obs-a', 'obs-b'])
		const reversed = selectObservations(
			step('get-note', 'any'),
			[...tied].reverse(),
		)
		expect(reversed).toEqual(result)
	})

	it('breaks a non-finite sequence deterministically by observationId, regardless of array order', () => {
		const withNaN = [
			observation('obs-b', Number.NaN, 'get-note'),
			observation('obs-a', 1, 'get-note'),
		]
		const result = selectObservations(step('get-note', 'any'), withNaN)
		expect(result.matchedObservationIds).toEqual(['obs-a', 'obs-b'])
		const reversed = selectObservations(
			step('get-note', 'any'),
			[...withNaN].reverse(),
		)
		expect(reversed).toEqual(result)
	})
})

describe('resolveTemporalAnchor', () => {
	it('resolves to the single observation when the anchor matched exactly one', () => {
		const anchor = step('create-thing', 'exactly-one')
		const resolution = resolveTemporalAnchor(anchor, [
			observation('obs-1', 1, 'create-thing'),
		])
		expect(resolution).toEqual({
			resolved: true,
			observationId: 'obs-1',
			matchedObservationIds: ['obs-1'],
		})
	})

	it('leaves the clause unresolved when the anchor matched nothing', () => {
		const anchor = step('create-thing', 'exactly-one')
		const resolution = resolveTemporalAnchor(anchor, [
			observation('obs-1', 1, 'other-op'),
		])
		expect(resolution).toEqual({
			resolved: false,
			result: 'none',
			matchedObservationIds: [],
		})
	})

	it('takes the lowest-sequence match when the anchor declared `any` and matched several', () => {
		const anchor = step('create-thing', 'any')
		const resolution = resolveTemporalAnchor(anchor, [
			observation('obs-late', 5, 'create-thing'),
			observation('obs-early', 2, 'create-thing'),
		])
		expect(resolution).toEqual({
			resolved: true,
			observationId: 'obs-early',
			matchedObservationIds: ['obs-early', 'obs-late'],
		})
	})

	it('leaves the clause unresolved when a single-valued anchor matched several, unlike an `any`-cardinality anchor', () => {
		const anchor = step('create-thing', 'exactly-one')
		const resolution = resolveTemporalAnchor(anchor, [
			observation('obs-1', 1, 'create-thing'),
			observation('obs-2', 2, 'create-thing'),
		])
		expect(resolution).toEqual({
			resolved: false,
			result: 'several',
			matchedObservationIds: ['obs-1', 'obs-2'],
		})
	})

	it('leaves the clause unresolved when an `at-most-one` anchor matched several, same as `exactly-one`', () => {
		const anchor = step('create-thing', 'at-most-one')
		const resolution = resolveTemporalAnchor(anchor, [
			observation('obs-1', 1, 'create-thing'),
			observation('obs-2', 2, 'create-thing'),
		])
		expect(resolution).toEqual({
			resolved: false,
			result: 'several',
			matchedObservationIds: ['obs-1', 'obs-2'],
		})
	})

	it('is permutation-invariant through the same underlying selection (NFR9)', () => {
		const anchor = step('create-thing', 'any')
		const forward = resolveTemporalAnchor(anchor, [
			observation('obs-a', 1, 'create-thing'),
			observation('obs-b', 2, 'create-thing'),
			observation('obs-c', 3, 'create-thing'),
		])
		const reversed = resolveTemporalAnchor(anchor, [
			observation('obs-c', 3, 'create-thing'),
			observation('obs-b', 2, 'create-thing'),
			observation('obs-a', 1, 'create-thing'),
		])
		expect(reversed).toEqual(forward)
	})
})
