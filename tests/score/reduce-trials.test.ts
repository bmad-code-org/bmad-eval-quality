// AD-7's trial-set reducer: the strict-majority fold, the pass-if-any
// rejection, and the tie-impossibility proof.

import { describe, expect, it } from 'vitest'
import { OUTCOME_STATES } from '../../src/core/schemas/evidence-artifact.ts'
import {
	reduceTrialSet,
	TRIAL_VOTE_STATES,
} from '../../src/core/score/reduce-trials.ts'
import {
	ALL_INVALIDATING_VOTES,
	EVERY_VOTED_STATE_VOTES,
	INVALIDATED_TRIAL_MIDDLE_VOTES,
	INVALIDATED_TRIAL_VOTES,
	MAJORITY_CAUGHT_VOTES,
	NO_VOTES,
	SINGLE_CAUGHT_VOTES,
	TIE_AT_FOUR_VOTES,
	TIE_VOTES,
	UNEXERCISED_VOTES,
	UNREACHED_VOTES,
	voteOf,
} from './fixtures/trial-set-cases.ts'

const DEFAULT_THRESHOLD = 0.5

describe('the three-way grouping is total over the closed twelve', () => {
	it('assigns every state to exactly one group', () => {
		const grouped = [
			...TRIAL_VOTE_STATES.invalidating,
			...TRIAL_VOTE_STATES.unvoted,
			...TRIAL_VOTE_STATES.voted,
		]
		expect(grouped.length).toBe(OUTCOME_STATES.length)
		expect(new Set(grouped).size).toBe(OUTCOME_STATES.length)
		expect([...grouped].sort()).toEqual([...OUTCOME_STATES].sort())
	})

	it('sizes the three groups at three, two, and seven', () => {
		expect(TRIAL_VOTE_STATES.invalidating.length).toBe(3)
		expect(TRIAL_VOTE_STATES.unvoted.length).toBe(2)
		expect(TRIAL_VOTE_STATES.voted.length).toBe(7)
	})
})

describe('strict majority over valid trials', () => {
	it('reduces a strict majority caught to exercised, caught', () => {
		const result = reduceTrialSet(MAJORITY_CAUGHT_VOTES, DEFAULT_THRESHOLD)
		expect(result).toEqual({
			exercised: true,
			caught: true,
			validCount: 3,
			caughtCount: 2,
			invalidatedAttempts: [],
		})
	})

	it('rejects pass-if-any: one caught among a non-caught majority never reduces to caught', () => {
		const result = reduceTrialSet(SINGLE_CAUGHT_VOTES, DEFAULT_THRESHOLD)
		expect(result.exercised).toBe(true)
		expect(result.caught).toBe(false)
		expect(result.validCount).toBe(3)
		expect(result.caughtCount).toBe(1)
	})

	it('never counts an exact tie as caught, at the default threshold and a two-trial count', () => {
		const result = reduceTrialSet(TIE_VOTES, DEFAULT_THRESHOLD)
		expect(result.validCount).toBe(2)
		expect(result.caughtCount).toBe(1)
		expect(result.caught).toBe(false)
		expect(result.exercised).toBe(true)
	})

	it('never counts an exact tie as caught at a different even valid-trial count', () => {
		const result = reduceTrialSet(TIE_AT_FOUR_VOTES, DEFAULT_THRESHOLD)
		expect(result.validCount).toBe(4)
		expect(result.caughtCount).toBe(2)
		expect(result.caught).toBe(false)
	})

	it('is structurally unable to return caught on an exact tie for any even valid count', () => {
		for (let half = 1; half <= 25; half += 1) {
			const votes = [
				...Array.from({ length: half }, () => voteOf('caught' as const)),
				...Array.from({ length: half }, () => voteOf('confirmed' as const)),
			]
			const result = reduceTrialSet(votes, DEFAULT_THRESHOLD)
			expect(result.caught).toBe(false)
		}
	})

	// `0.5 * n` is always exact in IEEE-754, so every test above this one would
	// pass even if the majority check multiplied `catchThreshold * validCount`
	// instead of dividing `caughtCount / validCount`. 29 / 100 is a
	// mathematically exact tie at `catchThreshold: 0.29`, but `0.29 * 100`
	// rounds to `28.999999999999996`, which would make the multiply form of
	// this comparison return a false caught.
	it('never counts an exact tie as caught at a non-0.5 threshold prone to floating-point rounding', () => {
		const votes = [
			...Array.from({ length: 29 }, () => voteOf('caught' as const)),
			...Array.from({ length: 71 }, () => voteOf('confirmed' as const)),
		]
		const result = reduceTrialSet(votes, 0.29)
		expect(result.validCount).toBe(100)
		expect(result.caughtCount).toBe(29)
		expect(result.caught).toBe(false)
	})

	it('is structurally unable to return caught on an exact tie across a spread of non-0.5 thresholds', () => {
		// Every one of these `n / 100` thresholds multiplied back by 100 lands on
		// the wrong side of `n` under IEEE-754 (verified: 28.999999999999996,
		// 56.99999999999999, 57.99999999999999), so each is an independent
		// regression case for the same rounding failure, not a repeat of it.
		for (const n of [29, 57, 58]) {
			const votes = [
				...Array.from({ length: n }, () => voteOf('caught' as const)),
				...Array.from({ length: 100 - n }, () => voteOf('confirmed' as const)),
			]
			const result = reduceTrialSet(votes, n / 100)
			expect(result.caught, `n = ${n}`).toBe(false)
		}
	})
})

describe('an invalidated trial is excluded from both the vote and the valid-trial count', () => {
	it('records the invalidated attempt with its state as the reason', () => {
		const result = reduceTrialSet(INVALIDATED_TRIAL_VOTES, DEFAULT_THRESHOLD)
		expect(result.validCount).toBe(2)
		expect(result.caughtCount).toBe(1)
		expect(result.caught).toBe(false)
		expect(result.invalidatedAttempts).toEqual([
			{ attempt: 1, reason: 'oracle-error' },
		])
	})

	it('numbers the attempt by position, not by filtered order', () => {
		const result = reduceTrialSet(
			INVALIDATED_TRIAL_MIDDLE_VOTES,
			DEFAULT_THRESHOLD,
		)
		expect(result.invalidatedAttempts).toEqual([
			{ attempt: 2, reason: 'judge-error' },
		])
		expect(result.validCount).toBe(2)
		expect(result.caughtCount).toBe(1)
	})

	it('records all three invalidating states at once, each with its own reason', () => {
		const result = reduceTrialSet(ALL_INVALIDATING_VOTES, DEFAULT_THRESHOLD)
		expect(result.invalidatedAttempts).toEqual([
			{ attempt: 1, reason: 'oracle-error' },
			{ attempt: 2, reason: 'judge-error' },
			{ attempt: 3, reason: 'infrastructure-error' },
		])
		expect(result.validCount).toBe(0)
		expect(result.exercised).toBe(false)
	})
})

describe('an unvoted trial leaves both the numerator and the denominator', () => {
	it('excludes a fully unexercised probe from ClassStrength entirely', () => {
		const result = reduceTrialSet(UNEXERCISED_VOTES, DEFAULT_THRESHOLD)
		expect(result).toEqual({
			exercised: false,
			caught: false,
			validCount: 0,
			caughtCount: 0,
			invalidatedAttempts: [],
		})
	})

	it('treats `unreached`, the other unvoted state, the same way', () => {
		const result = reduceTrialSet(UNREACHED_VOTES, DEFAULT_THRESHOLD)
		expect(result.exercised).toBe(false)
		expect(result.validCount).toBe(0)
		expect(result.invalidatedAttempts).toEqual([])
	})

	it('declares no trials at all as unexercised, not invalidated', () => {
		const result = reduceTrialSet(NO_VOTES, DEFAULT_THRESHOLD)
		expect(result.exercised).toBe(false)
		expect(result.caught).toBe(false)
		expect(result.invalidatedAttempts).toEqual([])
	})
})

describe('every voted state counts toward the denominator, only `caught` toward the numerator', () => {
	it('counts one caught vote among all seven voted states as the numerator', () => {
		const result = reduceTrialSet(EVERY_VOTED_STATE_VOTES, DEFAULT_THRESHOLD)
		expect(result.validCount).toBe(7)
		expect(result.caughtCount).toBe(1)
		expect(result.exercised).toBe(true)
		expect(result.caught).toBe(false)
	})
})

describe('catchThreshold is read as a bare fraction, not a special-cased floor or ceiling', () => {
	it('never catches at threshold 0 when no vote is caught', () => {
		const result = reduceTrialSet([voteOf('confirmed'), voteOf('confirmed')], 0)
		expect(result.caught).toBe(false)
	})

	it('catches at threshold 0 as soon as one vote is caught', () => {
		const result = reduceTrialSet([voteOf('caught'), voteOf('confirmed')], 0)
		expect(result.caught).toBe(true)
	})

	it('never catches at threshold 1, even at unanimous caught', () => {
		const result = reduceTrialSet(
			[voteOf('caught'), voteOf('caught'), voteOf('caught')],
			1,
		)
		expect(result.caught).toBe(false)
	})
})
