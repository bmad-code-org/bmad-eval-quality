import type {
	ReducedProbeOutcome,
	TrialOutcome,
	Trials,
} from '../schemas/evidence-artifact.ts'

export type ReductionConsistencyInput = {
	readonly outcomes: readonly TrialOutcome[]
	readonly reducedProbeOutcomes: readonly ReducedProbeOutcome[]
	readonly trials: Trials
}

export type ReductionConsistencyIssue = {
	readonly path: readonly (string | number)[]
	readonly message: string
}

const INVALIDATING_STATES = new Set([
	'oracle-error',
	'judge-error',
	'infrastructure-error',
])

const VOTED_STATES = new Set([
	'caught',
	'confirmed',
	'missed',
	'abstained',
	'bypassed',
	'passed-clean-control',
	'false-positive',
])

/**
 * Checks one artifact's reduction arithmetic and its policy-independent
 * agreement with detailed outcomes. Several oracle outcomes can exist for
 * one probe and trial, so detailed outcomes provide safe upper bounds. The
 * recorded threshold makes the final caught decision exactly auditable.
 */
export function reductionConsistencyIssuesOf(
	artifact: ReductionConsistencyInput,
): readonly ReductionConsistencyIssue[] {
	const issues: ReductionConsistencyIssue[] = []
	const reducedIds = new Set<string>()
	const rootInvalidated = new Map(
		artifact.trials.invalidatedAttempts.map((attempt) => [
			attempt.attempt,
			attempt.reason,
		]),
	)
	for (const [index, reduced] of artifact.reducedProbeOutcomes.entries()) {
		const base = ['reducedProbeOutcomes', index] as const
		if (reducedIds.has(reduced.probeId)) {
			issues.push({
				path: [...base, 'probeId'],
				message: 'reduced probe identifiers must be unique',
			})
		}
		reducedIds.add(reduced.probeId)
		if (reduced.caughtCount > reduced.validCount) {
			issues.push({
				path: [...base, 'caughtCount'],
				message: 'caughtCount cannot exceed validCount',
			})
		}
		if (reduced.exercised !== reduced.validCount > 0) {
			issues.push({
				path: [...base, 'exercised'],
				message: 'exercised must equal validCount > 0',
			})
		}
		const caught =
			reduced.validCount > 0 &&
			reduced.caughtCount / reduced.validCount > reduced.catchThreshold
		if (reduced.caught !== caught) {
			issues.push({
				path: [...base, 'caught'],
				message: 'caught must equal caughtCount / validCount > catchThreshold',
			})
		}

		const invalidated = new Set<number>()
		const details = artifact.outcomes.filter(
			(outcome) => outcome.probeId === reduced.probeId,
		)
		for (const [
			attemptIndex,
			attempt,
		] of reduced.invalidatedAttempts.entries()) {
			if (invalidated.has(attempt.attempt)) {
				issues.push({
					path: [...base, 'invalidatedAttempts', attemptIndex, 'attempt'],
					message: 'invalidated attempt indices must be unique per probe',
				})
			}
			invalidated.add(attempt.attempt)
			if (rootInvalidated.get(attempt.attempt) !== attempt.reason) {
				issues.push({
					path: [...base, 'invalidatedAttempts', attemptIndex],
					message:
						'invalidated attempt must agree with trials.invalidatedAttempts',
				})
			}
			if (
				!details.some(
					(outcome) =>
						outcome.trialIndex === attempt.attempt &&
						INVALIDATING_STATES.has(outcome.state),
				)
			) {
				issues.push({
					path: [...base, 'invalidatedAttempts', attemptIndex, 'attempt'],
					message:
						'invalidated attempt needs a detailed invalidating outcome for this probe and trial',
				})
			}
		}

		const validTrials = new Set(
			details
				.filter(
					(outcome) =>
						!invalidated.has(outcome.trialIndex) &&
						VOTED_STATES.has(outcome.state),
				)
				.map((outcome) => outcome.trialIndex),
		)
		const caughtTrials = new Set(
			details
				.filter(
					(outcome) =>
						!invalidated.has(outcome.trialIndex) && outcome.state === 'caught',
				)
				.map((outcome) => outcome.trialIndex),
		)
		if (reduced.validCount > validTrials.size) {
			issues.push({
				path: [...base, 'validCount'],
				message: 'validCount exceeds detailed non-invalidated trial outcomes',
			})
		}
		if (reduced.caughtCount > caughtTrials.size) {
			issues.push({
				path: [...base, 'caughtCount'],
				message: 'caughtCount exceeds detailed non-invalidated caught outcomes',
			})
		}
	}
	return issues
}
