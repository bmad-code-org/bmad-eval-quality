/**
 * Self-consistent per-probe evidence artifacts for the strength aggregation.
 *
 * Each artifact is what `score` would have emitted for one probe: one
 * detailed outcome per trial, the reduction those trials fold to, the
 * strength vector that reduction yields for the probe's class, and the two
 * digests (`scoringVersion`, `comparabilityKey`) over the inputs the artifact
 * states. The digests are spelled out here from the formulas `emit`
 * documents and are not imported from the aggregation under test, so a
 * verification that drifted from `emit` fails against these builders.
 */
import { digestArtifact } from '../../../src/core/canonical/digest.ts'
import {
	EvidenceArtifact,
	type OUTCOME_STATES,
	type SCORING_VERSION_INPUT_NAMES,
} from '../../../src/core/schemas/evidence-artifact.ts'
import type { ScoringPolicy } from '../../../src/core/schemas/scoring-policy.ts'
import { reduceTrialSet } from '../../../src/core/score/reduce-trials.ts'

type OutcomeStateValue = (typeof OUTCOME_STATES)[number]

/** `control` is a clean control and `canary` a canary: neither has a vector class. */
export type ProbeKind =
	| 'defect'
	| 'gameability'
	| 'zero-action'
	| 'control'
	| 'canary'

export type EvidenceSpec = {
	readonly probeId: string
	readonly kind: ProbeKind
	/** One outcome state per completed trial, in trial order. */
	readonly states: readonly OutcomeStateValue[]
	readonly declaredMinimum?: number
	readonly catchThreshold?: number
	readonly scoringPolicyDigest?: string
	readonly corpusDigest?: string
	readonly mode?: 'production' | 'contract-scoring'
	readonly basis?: 'measured' | 'reconstructed'
	readonly runId?: string
	/** The scoring-version inputs the caller attested; the default is the engine's four. */
	readonly callerAttestedInputs?: readonly (typeof SCORING_VERSION_INPUT_NAMES)[number][]
}

export const digestOfOrdinal = (ordinal: number): string =>
	`sha256:${ordinal.toString(16).padStart(64, '0')}`

/** The scoring policy every builder-made artifact was scored under. */
export const TEST_POLICY: ScoringPolicy = {
	schemaVersion: 2,
	parentDigest: null,
	revisionCount: 0,
	policyId: 'aggregate-test-policy',
	severityFloor: 'material',
	confidenceThreshold: 0.5,
	catchThreshold: 0.5,
	minimumTrialCount: 3,
	reExecutionCap: 2,
	remediationCap: 3,
	regexMatchStepBudget: 1_000_000,
}

export const POLICY_DIGEST = digestArtifact(TEST_POLICY, 'ScoringPolicy')
export const CORPUS_DIGEST = digestOfOrdinal(901)

/** `count` caught trials: the default way to say a probe was caught. */
export const caught = (count = 3): OutcomeStateValue[] =>
	Array.from({ length: count }, () => 'caught')

export const missed = (count = 3): OutcomeStateValue[] =>
	Array.from({ length: count }, () => 'missed')

export const unexercised = (count = 3): OutcomeStateValue[] =>
	Array.from({ length: count }, () => 'not-applicable')

export const cleanControl = (count = 3): OutcomeStateValue[] =>
	Array.from({ length: count }, () => 'passed-clean-control')

const dispositionOf = (state: OutcomeStateValue) => {
	if (state === 'caught' || state === 'missed') return 'violated' as const
	if (state === 'passed-clean-control') return 'held' as const
	return 'not-attempted' as const
}

export function evidenceFor(spec: EvidenceSpec): EvidenceArtifact {
	const {
		probeId,
		kind,
		states,
		declaredMinimum = 3,
		catchThreshold = 0.5,
		scoringPolicyDigest = POLICY_DIGEST,
		corpusDigest = CORPUS_DIGEST,
		mode = 'contract-scoring',
		basis = 'measured',
		runId = `run-${probeId.toLowerCase()}`,
		callerAttestedInputs = [
			'corpusDigest',
			'fixtureDigest',
			'evaluatorConfigurationDigest',
			'mode',
		],
	} = spec
	const votes = states.map((state, index) => ({ trialIndex: index + 1, state }))
	const reduction = reduceTrialSet(votes, catchThreshold)
	const completedAttempts = votes.map((vote) => vote.trialIndex)
	const unreached = states.filter((state) => state === 'unreached').length

	const scoringVersionInputs = {
		contractSchemaVersion: 5,
		corpusDigest,
		fixtureDigest: digestOfOrdinal(902),
		evaluatorConfigurationDigest: digestOfOrdinal(903),
		scoringPolicyDigest,
		mode,
	}
	const classStrength =
		kind === 'control' || kind === 'canary'
			? null
			: {
					exercised: reduction.exercised ? 1 : 0,
					caught: reduction.exercised && reduction.caught ? 1 : 0,
					rate: reduction.exercised ? (reduction.caught ? 1 : 0) : null,
				}
	const vector = {
		defect: kind === 'defect' ? classStrength : null,
		gameability: kind === 'gameability' ? classStrength : null,
		'zero-action': kind === 'zero-action' ? classStrength : null,
	}

	const common = {
		schemaVersion: 4,
		parentDigest: null,
		revisionCount: 0,
		runId,
		scoredProbeId: probeId,
		scoringVersion: digestArtifact(
			scoringVersionInputs,
			'ScoringVersionInputs',
		),
		scoringVersionInputs,
		comparabilityKey: digestArtifact(
			{ scoringPolicyDigest, probeIds: [probeId] },
			'ComparabilityKey',
		),
		excludedProbeIds: [],
		exitCode: 0,
		verdictBasis: [],
		callerAttestedInputs: [...callerAttestedInputs],
		trials: {
			declaredMinimum,
			completed: votes.length,
			completedAttempts,
			invalidatedAttempts: [...reduction.invalidatedAttempts],
		},
		outcomes: votes.map(({ trialIndex, state }) => ({
			oracleId: 'O-001',
			trialIndex,
			probeId,
			state,
			severity: 'critical',
			disposition: dispositionOf(state),
			resolvedFrom: state === 'caught' ? 'F-001' : null,
			corroboration: 'agrees',
			selectedObservationIds: [],
			checkResolution: {
				resolution: 'false',
				introductionCondition: null,
				children: [],
			},
		})),
		reducedProbeOutcomes: [
			{
				probeId,
				severity: 'critical',
				exercised: reduction.exercised,
				caught: reduction.caught,
				catchThreshold,
				trialVotes: votes,
				validCount: reduction.validCount,
				caughtCount: reduction.caughtCount,
				invalidatedAttempts: [...reduction.invalidatedAttempts],
			},
		],
		uncitedFindings: [],
		coverageGaps: [],
		strength: {
			denominator: 'unique qualified probe identifiers exercised per class',
			basis,
			vector,
			comparable: votes.length >= declaredMinimum && unreached === 0,
			note: null,
		},
		remediation: {
			revisionCount: 0,
			cap: 2,
			capSource: 'caller-attested',
			lineageChain: {
				lengthConsistent: true,
				noRepeatedDigest: true,
				noGap: true,
			},
		},
	}

	const artifact =
		mode === 'production'
			? { ...common, mode, productionVerdict: 'PASS' }
			: {
					...common,
					mode,
					contractVerdict: 'PASS',
					uncitedFindingGaps: [],
					systemRecommendationRecorded: 'PASS',
					systemRecommendationNote: null,
				}
	// A builder that drifted from the schema fails here, with the schema's own
	// issue, and the refusal tests never see it.
	return EvidenceArtifact.parse(artifact)
}

/** Four caught defect probes among five, the fixture the floor decisions are pinned on. */
export function fourOfFiveDefects(): EvidenceArtifact[] {
	return [
		evidenceFor({ probeId: 'P-001', kind: 'defect', states: caught() }),
		evidenceFor({ probeId: 'P-002', kind: 'defect', states: caught() }),
		evidenceFor({ probeId: 'P-003', kind: 'defect', states: caught() }),
		evidenceFor({ probeId: 'P-004', kind: 'defect', states: caught() }),
		evidenceFor({ probeId: 'P-005', kind: 'defect', states: missed() }),
	]
}
