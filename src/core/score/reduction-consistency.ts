import type {
	InvalidatedAttempt,
	ReducedProbeOutcome,
	TrialOutcome,
	Trials,
} from '../schemas/evidence-artifact.ts'
import { reduceTrialSet } from './reduce-trials.ts'

export type ReductionConsistencyInput = {
	readonly scoredProbeId: string | null
	readonly outcomes: readonly TrialOutcome[]
	readonly reducedProbeOutcomes: readonly ReducedProbeOutcome[]
	readonly trials: Trials
}

export type ReductionConsistencyIssue = {
	readonly path: readonly (string | number)[]
	readonly message: string
}

const attemptKey = (attempt: InvalidatedAttempt): string =>
	`${attempt.attempt}\u0000${attempt.reason}`

const sameAttempts = (
	left: readonly InvalidatedAttempt[],
	right: readonly InvalidatedAttempt[],
): boolean => {
	const leftKeys = left.map(attemptKey).sort()
	const rightKeys = right.map(attemptKey).sort()
	return (
		leftKeys.length === rightKeys.length &&
		leftKeys.every((key, index) => key === rightKeys[index])
	)
}

/**
 * Recomputes each reduction from its retained one-vote-per-trial inputs, then
 * checks those selected votes against the detailed trial evidence and root
 * invalidation record.
 */
export function reductionConsistencyIssuesOf(
	artifact: ReductionConsistencyInput,
): readonly ReductionConsistencyIssue[] {
	const issues: ReductionConsistencyIssue[] = []
	const reducedIds = new Set<string>()
	const completedAttempts = new Set(artifact.trials.completedAttempts)
	const detailProbeIds = new Set(
		artifact.outcomes.flatMap((outcome) =>
			outcome.probeId === null ? [] : [outcome.probeId],
		),
	)
	const recomputedInvalidated: InvalidatedAttempt[] = []

	if (
		completedAttempts.size !== artifact.trials.completedAttempts.length ||
		artifact.trials.completedAttempts.length !== artifact.trials.completed
	) {
		issues.push({
			path: ['trials', 'completedAttempts'],
			message:
				'completedAttempts must contain one unique identity per completed trial',
		})
	}
	const detailedAttempts = new Set(
		artifact.outcomes.map((outcome) => outcome.trialIndex),
	)
	if (
		artifact.outcomes.length > 0 &&
		(detailedAttempts.size !== completedAttempts.size ||
			[...completedAttempts].some(
				(trialIndex) => !detailedAttempts.has(trialIndex),
			))
	) {
		issues.push({
			path: ['outcomes'],
			message: 'detailed outcomes must cover every completed attempt exactly',
		})
	}
	if (artifact.scoredProbeId === null) {
		if (artifact.reducedProbeOutcomes.length > 0) {
			issues.push({
				path: ['reducedProbeOutcomes'],
				message:
					'reduced outcomes require an independently retained probe identity',
			})
		}
	} else if (
		artifact.reducedProbeOutcomes.length !== 1 ||
		artifact.reducedProbeOutcomes[0]?.probeId !== artifact.scoredProbeId
	) {
		issues.push({
			path: ['reducedProbeOutcomes'],
			message:
				'reduced outcomes must contain exactly the independently retained scored probe',
		})
	}

	for (const [index, reduced] of artifact.reducedProbeOutcomes.entries()) {
		const base = ['reducedProbeOutcomes', index] as const
		if (reducedIds.has(reduced.probeId)) {
			issues.push({
				path: [...base, 'probeId'],
				message: 'reduced probe identifiers must be unique',
			})
		}
		reducedIds.add(reduced.probeId)
		const details = artifact.outcomes.filter(
			(outcome) => outcome.probeId === reduced.probeId,
		)
		if (reduced.probeId !== artifact.scoredProbeId) {
			issues.push({
				path: [...base, 'probeId'],
				message:
					'reduced probe must match the independently retained scored probe',
			})
		}
		if (details.some((outcome) => outcome.severity !== reduced.severity)) {
			issues.push({
				path: [...base, 'severity'],
				message:
					'reduced severity must match every corresponding detailed outcome',
			})
		}

		const voteTrials = new Set<number>()
		for (const [voteIndex, vote] of reduced.trialVotes.entries()) {
			if (voteTrials.has(vote.trialIndex)) {
				issues.push({
					path: [...base, 'trialVotes', voteIndex, 'trialIndex'],
					message: 'selected trial vote indices must be unique per probe',
				})
			}
			voteTrials.add(vote.trialIndex)
			if (
				!details.some(
					(outcome) =>
						outcome.trialIndex === vote.trialIndex &&
						outcome.state === vote.state,
				)
			) {
				issues.push({
					path: [...base, 'trialVotes', voteIndex],
					message:
						'selected trial vote must match a detailed outcome for the same probe and trial',
				})
			}
		}
		if (
			artifact.outcomes.length > 0 &&
			(voteTrials.size !== completedAttempts.size ||
				[...completedAttempts].some(
					(trialIndex) => !voteTrials.has(trialIndex),
				))
		) {
			issues.push({
				path: [...base, 'trialVotes'],
				message:
					'selected trial votes must cover every completed attempt exactly',
			})
		}
		if (artifact.outcomes.length === 0 && reduced.trialVotes.length > 0) {
			issues.push({
				path: [...base, 'trialVotes'],
				message: 'selected trial votes require corresponding detailed evidence',
			})
		}

		const recomputed = reduceTrialSet(
			reduced.trialVotes,
			reduced.catchThreshold,
		)
		recomputedInvalidated.push(...recomputed.invalidatedAttempts)
		if (reduced.exercised !== recomputed.exercised) {
			issues.push({
				path: [...base, 'exercised'],
				message: 'exercised must equal the selected trial-vote reduction',
			})
		}
		if (reduced.caught !== recomputed.caught) {
			issues.push({
				path: [...base, `caught`],
				message: 'caught must equal the selected trial-vote reduction',
			})
		}
		if (reduced.validCount !== recomputed.validCount) {
			issues.push({
				path: [...base, 'validCount'],
				message: 'validCount must equal the selected trial-vote reduction',
			})
		}
		if (reduced.caughtCount !== recomputed.caughtCount) {
			issues.push({
				path: [...base, 'caughtCount'],
				message: 'caughtCount must equal the selected trial-vote reduction',
			})
		}
		if (
			!sameAttempts(reduced.invalidatedAttempts, recomputed.invalidatedAttempts)
		) {
			issues.push({
				path: [...base, 'invalidatedAttempts'],
				message:
					'invalidatedAttempts must equal the selected trial-vote reduction',
			})
		}
	}
	for (const probeId of detailProbeIds) {
		if (!reducedIds.has(probeId)) {
			issues.push({
				path: ['reducedProbeOutcomes'],
				message: `detailed probe ${probeId} is missing its reduced outcome`,
			})
		}
	}
	if (
		!sameAttempts(artifact.trials.invalidatedAttempts, recomputedInvalidated)
	) {
		issues.push({
			path: ['trials', 'invalidatedAttempts'],
			message:
				'trials.invalidatedAttempts must equal the selected trial-vote reductions',
		})
	}
	return issues
}
