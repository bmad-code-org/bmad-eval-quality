// Deterministic per-probe trial-vote fixtures: strict majority, the
// pass-if-any reading this reducer rejects, a tie at the default threshold,
// an invalidated trial, and a fully-unexercised probe. Mirrors
// `outcome-inputs.ts`'s determinism constraint: no clock, no `Math.random`,
// no filesystem.

import type { TrialVote } from '../../../src/core/score/reduce-trials.ts'

export const voteOf = (state: TrialVote['state']): TrialVote => ({ state })

/** three valid trials, a strict majority caught: `caught, confirmed, caught`. */
export const MAJORITY_CAUGHT_VOTES: readonly TrialVote[] = [
	voteOf('caught'),
	voteOf('confirmed'),
	voteOf('caught'),
]

/**
 * Three valid trials, one `caught` among an otherwise non-caught majority:
 * the pass-if-any reading this reducer rejects.
 */
export const SINGLE_CAUGHT_VOTES: readonly TrialVote[] = [
	voteOf('caught'),
	voteOf('confirmed'),
	voteOf('confirmed'),
]

/** two valid trials, caught count exactly half: a tie at the default 0.5 threshold. */
export const TIE_VOTES: readonly TrialVote[] = [
	voteOf('caught'),
	voteOf('confirmed'),
]

/** four valid trials, caught count exactly half: a second tie shape at a different count. */
export const TIE_AT_FOUR_VOTES: readonly TrialVote[] = [
	voteOf('caught'),
	voteOf('caught'),
	voteOf('confirmed'),
	voteOf('confirmed'),
]

/** one invalidated trial, excluded from both the vote and the valid-trial count. */
export const INVALIDATED_TRIAL_VOTES: readonly TrialVote[] = [
	voteOf('oracle-error'),
	voteOf('caught'),
	voteOf('confirmed'),
]

/** the invalidated trial in the middle, so attempt numbering is proven positional, not filtered. */
export const INVALIDATED_TRIAL_MIDDLE_VOTES: readonly TrialVote[] = [
	voteOf('caught'),
	voteOf('judge-error'),
	voteOf('confirmed'),
]

/** every trial `not-applicable`: the probe is fully unexercised. */
export const UNEXERCISED_VOTES: readonly TrialVote[] = [
	voteOf('not-applicable'),
	voteOf('not-applicable'),
	voteOf('not-applicable'),
]

/** every trial `unreached`, the other unvoted state, excluded the same way. */
export const UNREACHED_VOTES: readonly TrialVote[] = [
	voteOf('unreached'),
	voteOf('unreached'),
	voteOf('unreached'),
]

/** all three invalidating states at once, each recorded with its own reason. */
export const ALL_INVALIDATING_VOTES: readonly TrialVote[] = [
	voteOf('oracle-error'),
	voteOf('judge-error'),
	voteOf('infrastructure-error'),
]

/** every one of the seven voted states, once each: exercises the whole voted group. */
export const EVERY_VOTED_STATE_VOTES: readonly TrialVote[] = [
	voteOf('caught'),
	voteOf('confirmed'),
	voteOf('missed'),
	voteOf('abstained'),
	voteOf('bypassed'),
	voteOf('passed-clean-control'),
	voteOf('false-positive'),
]

/** no declared trials at all. */
export const NO_VOTES: readonly TrialVote[] = []
