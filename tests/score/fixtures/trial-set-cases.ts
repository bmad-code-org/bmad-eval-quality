// Deterministic per-probe trial-vote fixtures: strict majority, the
// pass-if-any reading this reducer rejects, a tie at the default threshold,
// an invalidated trial, and a fully-unexercised probe. Mirrors
// `outcome-inputs.ts`'s determinism constraint: no clock, no `Math.random`,
// no filesystem.

import type { TrialVote } from '../../../src/core/score/reduce-trials.ts'

export const voteOf = (
	state: TrialVote['state'],
	trialIndex = 1,
): TrialVote => ({ state, trialIndex })

/** three valid trials, a strict majority caught: `caught, confirmed, caught`. */
export const MAJORITY_CAUGHT_VOTES: readonly TrialVote[] = [
	voteOf('caught'),
	voteOf('confirmed', 2),
	voteOf('caught', 3),
]

/**
 * Three valid trials, one `caught` among an otherwise non-caught majority:
 * the pass-if-any reading this reducer rejects.
 */
export const SINGLE_CAUGHT_VOTES: readonly TrialVote[] = [
	voteOf('caught'),
	voteOf('confirmed', 2),
	voteOf('confirmed', 3),
]

/** two valid trials, caught count exactly half: a tie at the default 0.5 threshold. */
export const TIE_VOTES: readonly TrialVote[] = [
	voteOf('caught'),
	voteOf('confirmed', 2),
]

/** four valid trials, caught count exactly half: a second tie shape at a different count. */
export const TIE_AT_FOUR_VOTES: readonly TrialVote[] = [
	voteOf('caught'),
	voteOf('caught', 2),
	voteOf('confirmed', 3),
	voteOf('confirmed', 4),
]

/** one invalidated trial, excluded from both the vote and the valid-trial count. */
export const INVALIDATED_TRIAL_VOTES: readonly TrialVote[] = [
	voteOf('oracle-error'),
	voteOf('caught', 2),
	voteOf('confirmed', 3),
]

/** every trial `not-applicable`: the probe is fully unexercised. */
export const UNEXERCISED_VOTES: readonly TrialVote[] = [
	voteOf('not-applicable'),
	voteOf('not-applicable', 2),
	voteOf('not-applicable', 3),
]

/** every trial `unreached`, the other unvoted state, excluded the same way. */
export const UNREACHED_VOTES: readonly TrialVote[] = [
	voteOf('unreached'),
	voteOf('unreached', 2),
	voteOf('unreached', 3),
]

/** all three invalidating states at once, each recorded with its own reason. */
export const ALL_INVALIDATING_VOTES: readonly TrialVote[] = [
	voteOf('oracle-error'),
	voteOf('judge-error', 2),
	voteOf('infrastructure-error', 3),
]

/** every one of the seven voted states, once each: exercises the whole voted group. */
export const EVERY_VOTED_STATE_VOTES: readonly TrialVote[] = [
	voteOf('caught'),
	voteOf('confirmed', 2),
	voteOf('missed', 3),
	voteOf('abstained', 4),
	voteOf('bypassed', 5),
	voteOf('passed-clean-control', 6),
	voteOf('false-positive', 7),
]

/**
 * One trial from each of the three groups at once. The reducer classifies each
 * vote independently with no state shared between the invalidating and unvoted
 * branches, so this catches no interaction the per-group fixtures miss; it is
 * here because the claim that the branches do not interact is worth one case
 * rather than an argument, and a future reducer that carried state between them
 * would fail here first.
 */
export const MIXED_GROUP_VOTES: readonly TrialVote[] = [
	voteOf('oracle-error'),
	voteOf('not-applicable', 2),
	voteOf('caught', 3),
]

/** no declared trials at all. */
export const NO_VOTES: readonly TrialVote[] = []
