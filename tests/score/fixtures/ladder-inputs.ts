/**
 * Deterministic fixtures for AD-21's two ladders, covering every rung at
 * least once (mirroring `outcome-table.ts`'s throw-on-empty-cell census
 * over `ladder-table.ts`'s equivalent). No clock, no `Math.random`, no
 * filesystem, so the generated document is byte-stable.
 *
 * Every shared row (identical between the two ladders) gets one override
 * applied to both a production and a contract-scoring case, so one fixture
 * covers both censuses at once. The two rows that read an ingested
 * evaluator recommendation are production-only, since contract-scoring
 * never promotes it.
 */
import type { Severity } from '../../../src/core/schemas/eval-contract.ts'
import type {
	CoverageGap,
	LineageChain,
	UncitedFindingGap,
} from '../../../src/core/schemas/evidence-artifact.ts'
import type { EvidenceDisclosure } from '../../../src/core/schemas/sealed-run-record.ts'
import type { EvaluatorRecommendation } from '../../../src/core/schemas/verdict.ts'
import type {
	ContractAssessment,
	EvidenceIntegrityInputs,
	FindingConfidence,
	OutcomeStateInputs,
	ProductionAssessment,
	ScoredOutcome,
} from '../../../src/core/score/ladder.ts'
import type { LadderFixtureCase } from '../../../src/core/score/ladder-table.ts'
import type { OutcomeResolution } from '../../../src/core/score/outcome.ts'
import type { UnwitnessedQuotation } from '../../../src/core/score/quotation.ts'

export type AssessmentBody = {
	readonly outcomeState: OutcomeStateInputs
	readonly evidenceIntegrity: EvidenceIntegrityInputs
	readonly evaluatorRecommendation: EvaluatorRecommendation
	readonly coverageGaps: readonly CoverageGap[]
	readonly uncitedDefectFindings: readonly UncitedFindingGap[]
	readonly findings: readonly FindingConfidence[]
	readonly confidenceThreshold: number
	readonly remediationState: LineageChain
	readonly preflightPassed: boolean
	readonly severityFloor: Severity
}

export const neutralResolution = (): OutcomeResolution => ({
	rule: 'outcome-clear',
	waiverRule: null,
	corroborationRule: 'check-confirms-silence',
	state: 'caught',
	corroboration: 'agrees',
	resolvedFrom: 'finding-1',
	selectedObservationIds: ['obs-1'],
	declinedFindingIds: [],
	invalidatingConditions: [],
})

export const neutralOutcome = (): ScoredOutcome => ({
	oracleId: 'oracle-1',
	required: true,
	severity: 'material',
	checkResolved: true,
	resolution: neutralResolution(),
})

const neutralDisclosure = (): EvidenceDisclosure => ({
	truncationBound: null,
	reportedIncomplete: false,
})

const neutralChain = (): LineageChain => ({
	lengthConsistent: true,
	noRepeatedDigest: true,
	noGap: true,
})

/** Reaches PASS on both ladders: no row above holds anywhere in the tuple. */
export const baseline = (): AssessmentBody => ({
	outcomeState: {
		outcomes: [neutralOutcome()],
		unwitnessedQuotations: [],
		trials: { declaredMinimum: 3, completed: 3, invalidatedAttempts: [] },
		reExecutionCap: 2,
	},
	evidenceIntegrity: {
		disclosure: neutralDisclosure(),
		overTruncated: false,
		unavailable: false,
		internallyInconsistent: false,
		isolationViolation: [],
		duplicateRecordIdentifiers: [],
		danglingCitations: [],
		danglingDispositionCitations: [],
		forbiddenInputsNotWithheld: [],
		crossArtifactDisagreements: [],
		evaluatorConfigurationAbsent: [],
		evaluatorConfigurationDigestMismatches: [],
		judgeResultsUnscored: [],
		operationIdentifierCollisions: [],
		trialSetDisagreements: [],
	},
	evaluatorRecommendation: 'PASS',
	coverageGaps: [],
	uncitedDefectFindings: [],
	findings: [],
	confidenceThreshold: 0.5,
	remediationState: neutralChain(),
	preflightPassed: true,
	severityFloor: 'material',
})

export const productionOf = (body: AssessmentBody): ProductionAssessment => ({
	mode: 'production',
	...body,
})

export const contractOf = (body: AssessmentBody): ContractAssessment => ({
	mode: 'contract-scoring',
	...body,
	systemRecommendationRecorded: 'PASS',
	systemRecommendationNote: null,
})

/** One override, turned into a same-content case for each ladder that reads it. */
type SharedOverride = {
	readonly id: string
	readonly body: () => AssessmentBody
}

const UNWITNESSED_QUOTATION: UnwitnessedQuotation = {
	findingId: 'finding-1',
	quoteIndex: 0,
	channel: 'response-body',
	quote: 'a quote no cited observation carries',
	citedObservationIds: ['obs-1'],
}

const SHARED_OVERRIDES: readonly SharedOverride[] = [
	{ id: 'pass', body: baseline },
	{
		id: 'invalidating-state',
		body: () => ({
			...baseline(),
			outcomeState: {
				...baseline().outcomeState,
				outcomes: [
					{
						...neutralOutcome(),
						resolution: {
							...neutralResolution(),
							state: 'infrastructure-error',
						},
					},
				],
			},
		}),
	},
	{
		id: 'failed-preflight',
		body: () => ({ ...baseline(), preflightPassed: false }),
	},
	{
		id: 'isolation-manifest-violation',
		body: () => ({
			...baseline(),
			evidenceIntegrity: {
				...baseline().evidenceIntegrity,
				isolationViolation: ['network egress observed outside the mapping'],
			},
		}),
	},
	{
		id: 're-execution-cap-breach',
		body: () => ({
			...baseline(),
			outcomeState: {
				...baseline().outcomeState,
				trials: {
					declaredMinimum: 3,
					completed: 3,
					invalidatedAttempts: [
						{ attempt: 1, reason: 'port fault' },
						{ attempt: 2, reason: 'timeout' },
						{ attempt: 3, reason: 'reset' },
					],
				},
			},
		}),
	},
	{
		id: 'disposition-missing',
		body: () => ({
			...baseline(),
			outcomeState: {
				...baseline().outcomeState,
				outcomes: [
					{
						...neutralOutcome(),
						resolution: {
							...neutralResolution(),
							invalidatingConditions: ['disposition-missing'],
						},
					},
				],
			},
		}),
	},
	{
		id: 'required-check-unresolved',
		body: () => ({
			...baseline(),
			outcomeState: {
				...baseline().outcomeState,
				outcomes: [{ ...neutralOutcome(), checkResolved: false }],
			},
		}),
	},
	{
		id: 'selector-ambiguity',
		body: () => ({
			...baseline(),
			outcomeState: {
				...baseline().outcomeState,
				outcomes: [
					{
						...neutralOutcome(),
						resolution: {
							...neutralResolution(),
							state: 'infrastructure-error',
							invalidatingConditions: ['selector-ambiguity'],
						},
					},
				],
			},
		}),
	},
	{
		id: 'unwitnessed-claim',
		body: () => ({
			...baseline(),
			outcomeState: {
				...baseline().outcomeState,
				outcomes: [
					{
						...neutralOutcome(),
						resolution: {
							...neutralResolution(),
							state: 'infrastructure-error',
							invalidatingConditions: ['unwitnessed-detection-claim'],
						},
					},
				],
			},
		}),
	},
	{
		id: 'unwitnessed-quotation',
		body: () => ({
			...baseline(),
			outcomeState: {
				...baseline().outcomeState,
				unwitnessedQuotations: [UNWITNESSED_QUOTATION],
			},
		}),
	},
	// Story 8.2's eight rungless conditions, each newly given a rung, plus the
	// two score-computed conditions.
	{
		id: 'duplicate-record-identifier',
		body: () => ({
			...baseline(),
			evidenceIntegrity: {
				...baseline().evidenceIntegrity,
				duplicateRecordIdentifiers: [
					{
						kind: 'duplicate-record-identifier',
						subject: 'observation',
						identifier: 'obs-1',
						occurrences: 2,
					},
				],
			},
		}),
	},
	{
		id: 'dangling-citation',
		body: () => ({
			...baseline(),
			evidenceIntegrity: {
				...baseline().evidenceIntegrity,
				danglingCitations: [
					{
						kind: 'dangling-citation',
						findingId: 'finding-1',
						unresolvedObservationIds: ['obs-missing'],
					},
				],
			},
		}),
	},
	{
		id: 'dangling-disposition-citation',
		body: () => ({
			...baseline(),
			evidenceIntegrity: {
				...baseline().evidenceIntegrity,
				danglingDispositionCitations: [
					{
						kind: 'dangling-disposition-citation',
						oracleId: 'oracle-1',
						unresolvedObservationIds: ['obs-missing'],
					},
				],
			},
		}),
	},
	{
		id: 'forbidden-input-not-withheld',
		body: () => ({
			...baseline(),
			evidenceIntegrity: {
				...baseline().evidenceIntegrity,
				forbiddenInputsNotWithheld: [
					{ kind: 'forbidden-input-not-withheld', inputs: ['human-labels'] },
				],
			},
		}),
	},
	{
		id: 'cross-artifact-disagreement',
		body: () => ({
			...baseline(),
			evidenceIntegrity: {
				...baseline().evidenceIntegrity,
				crossArtifactDisagreements: [
					{
						kind: 'cross-artifact-disagreement',
						field: 'runId',
						recordValue: 'run-1',
						manifestValue: 'run-2',
					},
				],
			},
		}),
	},
	{
		id: 'evaluator-configuration-absent',
		body: () => ({
			...baseline(),
			evidenceIntegrity: {
				...baseline().evidenceIntegrity,
				evaluatorConfigurationAbsent: [
					{ kind: 'evaluator-configuration-absent' },
				],
			},
		}),
	},
	{
		id: 'evaluator-configuration-digest-mismatch',
		body: () => ({
			...baseline(),
			evidenceIntegrity: {
				...baseline().evidenceIntegrity,
				evaluatorConfigurationDigestMismatches: [
					{
						kind: 'evaluator-configuration-digest-mismatch',
						declaredDigest:
							'sha256:0000000000000000000000000000000000000000000000000000000000000001',
						computedDigest:
							'sha256:0000000000000000000000000000000000000000000000000000000000000002',
					},
				],
			},
		}),
	},
	{
		id: 'judge-result-unscored',
		body: () => ({
			...baseline(),
			evidenceIntegrity: {
				...baseline().evidenceIntegrity,
				judgeResultsUnscored: [
					{
						kind: 'judge-result-unscored',
						rubricId: 'R-001',
						criterionId: 'RC-001',
					},
				],
			},
		}),
	},
	{
		id: 'operation-identifier-collision',
		body: () => ({
			...baseline(),
			evidenceIntegrity: {
				...baseline().evidenceIntegrity,
				operationIdentifierCollisions: [
					'trial 1 observation obs-1: operationId "op-1" matches operations in 2 permittedInterfaces entries (iface-a, iface-b)',
				],
			},
		}),
	},
	{
		id: 'trial-set-field-disagreement',
		body: () => ({
			...baseline(),
			evidenceIntegrity: {
				...baseline().evidenceIntegrity,
				trialSetDisagreements: [
					'mode: trial 1 = "production", trial 2 = "contract-scoring"',
				],
			},
		}),
	},
	{
		id: 'behavioural-failure-at-or-above-floor',
		body: () => ({
			...baseline(),
			outcomeState: {
				...baseline().outcomeState,
				outcomes: [
					{
						...neutralOutcome(),
						severity: 'critical',
						resolution: { ...neutralResolution(), state: 'missed' },
					},
				],
			},
		}),
	},
	{
		id: 'evidence-incomplete',
		body: () => ({
			...baseline(),
			evidenceIntegrity: {
				...baseline().evidenceIntegrity,
				disclosure: { truncationBound: null, reportedIncomplete: true },
			},
		}),
	},
	{
		id: 'evidence-over-truncated',
		body: () => ({
			...baseline(),
			evidenceIntegrity: {
				...baseline().evidenceIntegrity,
				overTruncated: true,
			},
		}),
	},
	{
		id: 'evidence-unavailable',
		body: () => ({
			...baseline(),
			evidenceIntegrity: { ...baseline().evidenceIntegrity, unavailable: true },
		}),
	},
	{
		id: 'evidence-internally-inconsistent',
		body: () => ({
			...baseline(),
			evidenceIntegrity: {
				...baseline().evidenceIntegrity,
				internallyInconsistent: true,
			},
		}),
	},
	{
		id: 'lineage-chain-inconsistent',
		body: () => ({
			...baseline(),
			remediationState: { ...neutralChain(), noGap: false },
		}),
	},
	{
		id: 'behavioural-failure-below-floor',
		body: () => ({
			...baseline(),
			outcomeState: {
				...baseline().outcomeState,
				outcomes: [
					{
						...neutralOutcome(),
						severity: 'low',
						resolution: { ...neutralResolution(), state: 'abstained' },
					},
				],
			},
		}),
	},
	{
		id: 'coverage-gap-at-or-above-floor',
		body: () => ({
			...baseline(),
			coverageGaps: [
				{
					rule: 'sibling-cross-check',
					relevancePredicate: 'sibling-cross-check-relevance',
					satisfactionPredicate: 'sibling-cross-check-satisfaction',
					satisfied: false,
					severity: 'material',
				},
			],
		}),
	},
	{
		id: 'uncited-defect-finding',
		body: () => ({
			...baseline(),
			uncitedDefectFindings: [
				{
					findingId: 'finding-uncited-1',
					observationIds: ['obs-1'],
					quotedEvidence: [{ quote: '500', channel: 'response-status' }],
					severity: 'critical',
				} satisfies UncitedFindingGap,
			],
		}),
	},
	{
		id: 'finding-confidence-below-threshold',
		body: () => ({
			...baseline(),
			findings: [{ findingId: 'finding-1', confidence: 0.1 }],
		}),
	},
	{
		id: 'below-minimum-trial-count',
		body: () => ({
			...baseline(),
			outcomeState: {
				...baseline().outcomeState,
				trials: { declaredMinimum: 3, completed: 2, invalidatedAttempts: [] },
			},
		}),
	},
	{
		id: 'oracle-unreached',
		body: () => ({
			...baseline(),
			outcomeState: {
				...baseline().outcomeState,
				outcomes: [
					{
						...neutralOutcome(),
						resolution: {
							...neutralResolution(),
							rule: 'steps-unreached',
							corroborationRule: 'never-ran',
							state: 'unreached',
						},
					},
				],
			},
		}),
	},
	{
		id: 'waiver-honoured',
		body: () => ({
			...baseline(),
			outcomeState: {
				...baseline().outcomeState,
				outcomes: [
					{
						...neutralOutcome(),
						resolution: {
							...neutralResolution(),
							rule: 'witness-manifested-unclaimed',
							waiverRule: 'waiver-honoured',
							state: 'not-applicable',
						},
					},
				],
			},
		}),
	},
]

/** Production-only: the two rows that read an ingested evaluator recommendation. */
const PRODUCTION_ONLY_OVERRIDES: readonly SharedOverride[] = [
	{
		id: 'evaluator-recommendation-fail',
		body: () => ({ ...baseline(), evaluatorRecommendation: 'FAIL' }),
	},
	{
		id: 'evaluator-recommendation-concerns',
		body: () => ({ ...baseline(), evaluatorRecommendation: 'CONCERNS' }),
	},
]

export function fixtureCases(): readonly LadderFixtureCase[] {
	const shared = SHARED_OVERRIDES.flatMap(
		(override): readonly LadderFixtureCase[] => [
			{ ladder: 'production', assessment: productionOf(override.body()) },
			{ ladder: 'contract-scoring', assessment: contractOf(override.body()) },
		],
	)
	const productionOnly = PRODUCTION_ONLY_OVERRIDES.map(
		(override): LadderFixtureCase => ({
			ladder: 'production',
			assessment: productionOf(override.body()),
		}),
	)
	return [...shared, ...productionOnly]
}
