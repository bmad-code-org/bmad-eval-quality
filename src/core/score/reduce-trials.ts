/**
 * AD-7's trial-set reducer, closing Owed item 1: repeated trials had no
 * reducer, so the default three-trial minimum was unreachable.
 *
 * Pure and total: no clock, filesystem, or randomness, and nothing thrown for
 * a domain input. Stage one, collapsing several outcome resolutions for one
 * `(probeId, trialIndex)` down to one vote, is a lookup rather than a genuine
 * multi-value fold, because AD-40's discriminating condition pairs a probe
 * with exactly one designated oracle; the caller performs that lookup and
 * this module receives the resulting one-vote-per-trial sequence directly.
 * Stage two, folding across trials for one probe, is `reduceTrialSet` below.
 */
import type {
	InvalidatedAttempt,
	OUTCOME_STATES,
} from '../schemas/evidence-artifact.ts'

type OutcomeStateValue = (typeof OUTCOME_STATES)[number]

/**
 * The reducer's own vote, narrower than `resolveOutcome`'s
 * `OutcomeResolution`: only `state` decides which of the three groups below a
 * trial falls into, and the reducer has no use for a rule identifier, a
 * resolved-from finding, or a corroboration value.
 */
export type TrialVote = {
	readonly state: OutcomeStateValue
}

/**
 * The reducer's three-way grouping of AD-6's closed twelve states. Three
 * invalidate a trial for this probe and are excluded from both the vote and
 * the valid-trial count; two leave a trial's probe unvoted without
 * invalidating it, so an unexercised trial contributes to neither the
 * numerator nor the denominator; the remaining seven are valid votes, of
 * which only `caught` counts toward the numerator.
 */
export const TRIAL_VOTE_STATES = {
	invalidating: ['oracle-error', 'judge-error', 'infrastructure-error'],
	unvoted: ['not-applicable', 'unreached'],
	voted: [
		'caught',
		'confirmed',
		'missed',
		'abstained',
		'bypassed',
		'passed-clean-control',
		'false-positive',
	],
} as const satisfies Record<string, readonly OutcomeStateValue[]>

export type TrialVoteState = keyof typeof TRIAL_VOTE_STATES

/**
 * A total map from every one of the twelve states to its group, built once
 * from `TRIAL_VOTE_STATES` rather than duplicated as a second literal that
 * could drift from it.
 */
const TRIAL_VOTE_STATE_OF: Readonly<Record<OutcomeStateValue, TrialVoteState>> =
	Object.fromEntries(
		(
			Object.entries(TRIAL_VOTE_STATES) as [
				TrialVoteState,
				readonly OutcomeStateValue[],
			][]
		).flatMap(([group, states]) =>
			states.map((state) => [state, group] as const),
		),
	) as Record<OutcomeStateValue, TrialVoteState>

export type TrialSetResult = {
	/** whether at least one trial voted, i.e. `validCount > 0`. */
	readonly exercised: boolean
	/** `caughtCount / validCount > catchThreshold`, strict, so a tie is unreachable. */
	readonly caught: boolean
	/** the count of voted (valid, non-`unvoted`) trials: the majority's denominator. */
	readonly validCount: number
	/** the count of voted trials whose state is `caught`: the majority's numerator. */
	readonly caughtCount: number
	readonly invalidatedAttempts: readonly InvalidatedAttempt[]
}

/**
 * Folds one probe's trial votes to one result. `votes[i]`'s position is the
 * attempt number `i + 1`, since stage one has already reduced each trial's
 * outcome resolutions to one vote per `(probeId, trialIndex)`.
 *
 * A probe with zero voted trials is `exercised: false` and contributes
 * nothing to `ClassStrength`; `caught` is `false` in that case too, since a
 * majority over zero trials decides nothing.
 *
 * `catchThreshold` is checked against `ScoringPolicy.catchThreshold`'s own
 * declared domain (`.min(0).max(1)`) and a `vote.state` outside the closed
 * twelve is checked explicitly, rather than silently falling through into
 * `votedStates.push`: both were reachable only through a type-system bypass
 * while this reducer shipped with no caller, and now that `score.ts` calls
 * it for real, a bypass is exactly the input this pure function must still
 * answer without absorbing it silently.
 *
 * Both checks are written to survive a bypass that also defeats the naive
 * form of the check, not only a bypass of the declared type. `catchThreshold`
 * is asserted a finite primitive `number` before the range comparison runs:
 * `>=`/`<=` coerce their operands, so `null`, a numeric string, or a boxed
 * `Number` would each satisfy `0 <= x <= 1` without ever being the number the
 * range check means to bound. `vote.state`'s lookup uses `Object.hasOwn`
 * rather than trusting `=== undefined`: `TRIAL_VOTE_STATE_OF` is a plain
 * object and so inherits `Object.prototype`, and a state string that happens
 * to name an inherited member (`"toString"`, `"constructor"`,
 * `"hasOwnProperty"`, `"valueOf"`) resolves to that inherited function
 * instead of `undefined`, which would silently clear the `=== undefined`
 * guard and vote the bogus state in.
 */
export function reduceTrialSet(
	votes: readonly TrialVote[],
	catchThreshold: number,
): TrialSetResult {
	if (typeof catchThreshold !== 'number' || !Number.isFinite(catchThreshold)) {
		throw new TypeError(
			`reduceTrialSet: catchThreshold ${String(catchThreshold)} is not a finite number`,
		)
	}
	if (!(catchThreshold >= 0 && catchThreshold <= 1)) {
		throw new TypeError(
			`reduceTrialSet: catchThreshold ${catchThreshold} is outside ScoringPolicy's declared 0..1 domain`,
		)
	}
	const invalidatedAttempts: InvalidatedAttempt[] = []
	const votedStates: OutcomeStateValue[] = []
	votes.forEach((vote, index) => {
		if (!Object.hasOwn(TRIAL_VOTE_STATE_OF, vote.state)) {
			throw new TypeError(
				`reduceTrialSet: vote ${index + 1} carries an out-of-domain state "${vote.state}"`,
			)
		}
		const group = TRIAL_VOTE_STATE_OF[vote.state]
		if (group === 'invalidating') {
			invalidatedAttempts.push({ attempt: index + 1, reason: vote.state })
			return
		}
		if (group === 'unvoted') return
		votedStates.push(vote.state)
	})
	const validCount = votedStates.length
	const caughtCount = votedStates.filter((state) => state === 'caught').length
	const exercised = validCount > 0
	// Divide rather than multiply: `caughtCount > catchThreshold * validCount`
	// rounds `catchThreshold * validCount` under IEEE-754 for some non-power-of-
	// two thresholds (0.29 * 100 = 28.999999999999996), which turns a
	// mathematically exact tie (29/100 = 0.29) into a false caught. Division by
	// a positive integer `validCount` has no such failure mode here.
	const caught = exercised && caughtCount / validCount > catchThreshold
	return { exercised, caught, validCount, caughtCount, invalidatedAttempts }
}
