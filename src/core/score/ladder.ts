/**
 * AD-21's total decision table, built for the first time. Owed item 4's
 * remaining three clauses: `ProductionAssessment` and `ContractAssessment`
 * as separate input types, each resolved by its own pure, total,
 * first-match-wins ladder over the same seven state categories AD-21 names.
 *
 * Every rung is derived independently per category, so a condition never
 * masks another that fired in the same tier -- the same independence
 * `outcome.ts`'s Stage A uses for AD-6's invalidating conditions. Precedence
 * across tiers is Invalid, then FAIL, then CONCERNS, then WAIVED, then PASS,
 * exactly AD-21's own order; within a tier every condition that holds is
 * recorded, never only the first.
 *
 * `verdict: null` is AD-21's "Invalid" rung. It is not one of the four
 * `Verdict` members: AD-21 itself says a failed run "never becomes a
 * contract verdict", and exit code 3 sits outside the verdict range
 * `src/cli/exit-codes.ts` defines. This module cannot import that file
 * (`core/` imports only `core/schemas`, AD-1), so the three exit-code
 * literals are repeated here rather than shared.
 *
 * AD-21's own "unrecognised evaluator recommendation value" clause is
 * omitted: `verdict.ts:22-25` records that a schema-valid
 * `EvaluatorRecommendation` cannot carry one, since an unrecognised value
 * fails to parse before either ladder runs.
 */
// Type-only: `ingest/conditions.ts` already imports this module's own
// `EvidenceIntegrityInputs`/`OutcomeStateInputs` the same way, and a
// type-only pair between two `core/` modules is erased before either file's
// runtime load path exists (`npm run check:layers` scopes same-layer
// imports, not import direction).
import type { IngestCondition } from '../ingest/conditions.ts'
import { SEVERITY_LEVELS, type Severity } from '../schemas/eval-contract.ts'
import type {
	CoverageGap,
	LineageChain,
	Trials,
	UncitedFindingGap,
} from '../schemas/evidence-artifact.ts'
import type { EvidenceDisclosure } from '../schemas/sealed-run-record.ts'
import type { EvaluatorRecommendation, Verdict } from '../schemas/verdict.ts'
import type { OutcomeResolution } from './outcome.ts'
import type { UnwitnessedQuotation } from './quotation.ts'

/**
 * One oracle's AD-33 resolution, paired with the two fields `OutcomeResolution`
 * does not carry: `severity` is caller-owned on the persisted `Outcome`
 * (`evidence-artifact.ts`'s own field, sourced from `Behavior.severity`), and
 * `checkResolved` is the caller's own `OutcomeInputs.checkResolution !== null`,
 * needed for AD-21's "no required check resolved" Invalid clause, which
 * `OutcomeResolution` has no field for.
 */
export type ScoredOutcome = {
	readonly oracleId: string
	readonly required: boolean
	readonly severity: Severity
	readonly checkResolved: boolean
	readonly resolution: OutcomeResolution
}

/**
 * AD-21's "outcome state" category. A composite rather than a bare
 * `OutcomeState[]`: the three new Invalid conditions below each need
 * per-condition detail a state enum alone cannot carry, so this bundles the
 * per-oracle resolutions, the record-level `auditQuotation` result, and
 * `Trials` alongside the re-execution cap (Design Notes: the AD-6
 * re-execution cap, never AD-12's `Remediation.cap`).
 */
export type OutcomeStateInputs = {
	readonly outcomes: readonly ScoredOutcome[]
	readonly unwitnessedQuotations: readonly UnwitnessedQuotation[]
	readonly trials: Trials
	readonly reExecutionCap: number
}

/**
 * AD-21's "evidence-integrity state" category, read for the FAIL rung's
 * "incomplete, over-truncated, unavailable, or internally inconsistent under
 * AD-17" clause. `EvidenceDisclosure` carries only the two caller-declared
 * halves (`reportedIncomplete`, `truncationBound`); the other two have no
 * source anywhere in the tree today (`evidence-disclosure`'s own describe:
 * "unavailable is an ArtifactReference that does not resolve through the
 * corpus port, and internally inconsistent is AD-32's cross-artifact
 * agreement check"), so they arrive declared rather than derived, the same
 * posture `outcome.ts`'s `judgeConduct` and `waiver` inputs take.
 * `overTruncated` is declared for the same reason: it compares the disclosed
 * bound against the evidence actually carried, which this pure function does
 * not read.
 */
export type EvidenceIntegrityInputs = {
	readonly disclosure: EvidenceDisclosure
	readonly overTruncated: boolean
	readonly unavailable: boolean
	readonly internallyInconsistent: boolean
	/**
	 * AD-16's unaccounted-manifest Invalid condition: `IsolationManifest.violation`.
	 * Widened from a single nullable string to an array, matching
	 * `ValidatedObservations.isolationViolation`'s shape (`ingest.ts:78`): empty
	 * when nothing fired, one entry per offending value.
	 */
	readonly isolationViolation: readonly string[]
	/**
	 * Eight ingest conditions, each a structured payload `ingest` already
	 * computed, `Extract`-typed against `IngestCondition` so a rename in
	 * `ingest/conditions.ts` collapses the field's type to `never[]` rather
	 * than silently reading a stale shape. Ascending `EvidenceIntegrityInputs`
	 * field order matches `INGEST_CONDITION_KINDS`' declaration order.
	 */
	readonly duplicateRecordIdentifiers: readonly Extract<
		IngestCondition,
		{ kind: 'duplicate-record-identifier' }
	>[]
	readonly danglingCitations: readonly Extract<
		IngestCondition,
		{ kind: 'dangling-citation' }
	>[]
	readonly danglingDispositionCitations: readonly Extract<
		IngestCondition,
		{ kind: 'dangling-disposition-citation' }
	>[]
	readonly forbiddenInputsNotWithheld: readonly Extract<
		IngestCondition,
		{ kind: 'forbidden-input-not-withheld' }
	>[]
	readonly crossArtifactDisagreements: readonly Extract<
		IngestCondition,
		{ kind: 'cross-artifact-disagreement' }
	>[]
	readonly evaluatorConfigurationAbsent: readonly Extract<
		IngestCondition,
		{ kind: 'evaluator-configuration-absent' }
	>[]
	readonly evaluatorConfigurationDigestMismatches: readonly Extract<
		IngestCondition,
		{ kind: 'evaluator-configuration-digest-mismatch' }
	>[]
	readonly judgeResultsUnscored: readonly Extract<
		IngestCondition,
		{ kind: 'judge-result-unscored' }
	>[]
	/**
	 * The two score-computed conditions, pre-rendered like `isolationViolation`
	 * rather than structured: `score.ts` computes and renders both itself
	 * (neither is an `IngestCondition`), so the ladder only needs to display
	 * them.
	 */
	readonly operationIdentifierCollisions: readonly string[]
	readonly trialSetDisagreements: readonly string[]
}

export type FindingConfidence = {
	readonly findingId: string
	readonly confidence: number
}

/**
 * The seven category values, common to both modes; AD-21 is explicit the two
 * verdicts "never share a field" beyond this. `uncitedDefectFindings` sits in
 * the "coverage condition" category: owed item 5 calls an uncited defect
 * finding, in contract-scoring, "the strongest available evidence of a
 * coverage gap".
 */
type AssessmentCommon = {
	readonly outcomeState: OutcomeStateInputs
	readonly evidenceIntegrity: EvidenceIntegrityInputs
	readonly evaluatorRecommendation: EvaluatorRecommendation
	readonly coverageGaps: readonly CoverageGap[]
	/**
	 * Owed item 5, per `outcome.ts`'s `uncitedDefectFindingGaps`. Only presence
	 * and each entry's `findingId` are read below; the rest is carried for the
	 * persisted record.
	 */
	readonly uncitedDefectFindings: readonly UncitedFindingGap[]
	readonly findings: readonly FindingConfidence[]
	readonly confidenceThreshold: number
	/** AD-21's "remediation state": `Remediation.lineageChain`'s conjunction only, never `Remediation.cap` (AD-12's contract-revision cap). */
	readonly remediationState: LineageChain
	/** AD-21's "pre-flight state": `PreflightVerdict.passed`. */
	readonly preflightPassed: boolean
	readonly severityFloor: Severity
}

/**
 * A literal `mode` discriminant, mirroring `EvidenceArtifact`'s own union, so
 * the two types are nominally distinct rather than structurally compatible in
 * one direction only.
 */
export type ProductionAssessment = AssessmentCommon & {
	readonly mode: 'production'
}

export type ContractAssessment = AssessmentCommon & {
	readonly mode: 'contract-scoring'
	readonly systemRecommendationRecorded: EvaluatorRecommendation
	readonly systemRecommendationNote: string | null
}

export type LadderResolution = {
	/** `null` is AD-21's Invalid rung: never a `Verdict`, and a run that never becomes a contract verdict. */
	readonly verdict: Verdict | null
	readonly exitCode: number
	/** `false` for a CONCERNS whose only firing conditions are the two evidence conditions; `cli/exit-codes.ts`'s `evidenceConditionsOnly` semantics, restated for the ladder to agree with rather than re-derive. */
	readonly strictPromotable: boolean
	readonly basis: readonly string[]
}

/**
 * AD-21's exit codes for this rung. Not imported from `src/cli/exit-codes.ts`:
 * `core/` imports only `core/schemas` (AD-1), so the three numbers are
 * repeated here rather than shared. Exported so a test outside `core/` can
 * assert this restatement still agrees with that file's own `EXIT_*`
 * constants and `evidenceConditionsOnly` rule, which neither file can check
 * of itself.
 */
export const LADDER_EXIT_CODES = {
	invalid: 3,
	FAIL: 2,
	CONCERNS: 0,
	WAIVED: 0,
	PASS: 0,
} as const

const BEHAVIOURAL_FAILURE_STATES = [
	'missed',
	'abstained',
	'bypassed',
	'false-positive',
] as const

const INVALIDATING_STATES = [
	'oracle-error',
	'judge-error',
	'infrastructure-error',
] as const

const isBehaviouralFailure = (state: string): boolean =>
	(BEHAVIOURAL_FAILURE_STATES as readonly string[]).includes(state)

const isInvalidatingState = (state: string): boolean =>
	(INVALIDATING_STATES as readonly string[]).includes(state)

const atOrAboveFloor = (severity: Severity, floor: Severity): boolean =>
	SEVERITY_LEVELS.indexOf(severity) >= SEVERITY_LEVELS.indexOf(floor)

const requiredOutcomes = (inputs: AssessmentCommon): readonly ScoredOutcome[] =>
	inputs.outcomeState.outcomes.filter((outcome) => outcome.required)

const lineageChainPassed = (chain: LineageChain): boolean =>
	chain.lengthConsistent && chain.noRepeatedDigest && chain.noGap

/**
 * One condition this table can independently confirm or deny. `reasons`
 * returns zero or more free-text entries (`evidence-artifact.ts`'s own
 * `verdictBasis` shape: non-empty strings, empty array legal); more than one
 * entry names each affected oracle, gap, or finding separately, matching
 * AD-21's "the record carries every condition that fired".
 */
type LadderConditionRow = {
	readonly id: string
	readonly rung: 'invalid' | 'FAIL' | 'CONCERNS' | 'WAIVED'
	readonly guard: string
	/** the two evidence conditions AD-21 names as a thinner measurement rather than a system claim; `strictPromotable` reads this. */
	readonly evidenceCondition: boolean
	readonly reasons: (inputs: AssessmentCommon) => readonly string[]
}

/**
 * Invalid, identical between the two ladders: AD-21's text carries no mode
 * split for it. Nine of AD-21's own clauses plus three owed item 4 leaves
 * for this module to close: selector-ambiguity and unwitnessed-claim, an
 * AD-6 selector-cardinality condition and an AD-40 witness-match result, and
 * a third, separately assigned condition -- the unwitnessed-quotation audit
 * `quotation.ts` ships with no caller. The
 * "unrecognised evaluator recommendation value" clause is omitted per this
 * module's own header comment.
 *
 * `selector-ambiguity` and `unwitnessed-claim` already coincide with an
 * `infrastructure-error` state and so are already covered by
 * `invalidating-state`; both are still named explicitly so `verdictBasis`
 * carries the specific condition AD-21's spine prose never spelled out, not
 * only the generic state.
 *
 * Ten more rows follow: eight previously-rungless ingest conditions, each
 * newly given a rung, plus two conditions `score.ts` itself computes and no
 * `ingest` condition names -- an ambiguous `operationId` across
 * `permittedInterfaces`, and a trial set disagreeing with itself on
 * `mode` or `evaluatorRecommendation`.
 */
const INVALID_ROWS: readonly LadderConditionRow[] = [
	{
		id: 'invalidating-state',
		rung: 'invalid',
		guard:
			'an outcome resolved an AD-6 invalidating state (oracle-error, judge-error, or infrastructure-error)',
		evidenceCondition: false,
		reasons: (inputs) =>
			inputs.outcomeState.outcomes
				.filter((outcome) => isInvalidatingState(outcome.resolution.state))
				.map(
					(outcome) =>
						`oracle ${outcome.oracleId} resolved ${outcome.resolution.state}`,
				),
	},
	{
		id: 'failed-preflight',
		rung: 'invalid',
		guard: 'a failed pre-flight',
		evidenceCondition: false,
		reasons: (inputs) =>
			inputs.preflightPassed ? [] : ['pre-flight verdict did not pass'],
	},
	{
		id: 'isolation-manifest-violation',
		rung: 'invalid',
		guard: 'an unaccounted isolation manifest under AD-16',
		evidenceCondition: false,
		reasons: (inputs) =>
			inputs.evidenceIntegrity.isolationViolation.map(
				(violation) => `isolation manifest violation: ${violation}`,
			),
	},
	{
		id: 're-execution-cap-breach',
		rung: 'invalid',
		guard: 'a re-execution cap breach under AD-6',
		evidenceCondition: false,
		reasons: (inputs) => {
			const { invalidatedAttempts } = inputs.outcomeState.trials
			return invalidatedAttempts.length > inputs.outcomeState.reExecutionCap
				? [
						`${invalidatedAttempts.length} invalidated attempts exceeded the re-execution cap of ${inputs.outcomeState.reExecutionCap}`,
					]
				: []
		},
	},
	{
		id: 'disposition-missing',
		rung: 'invalid',
		guard:
			'a required oracle carrying no disposition in the run record under AD-23',
		evidenceCondition: false,
		reasons: (inputs) =>
			inputs.outcomeState.outcomes
				.filter((outcome) =>
					outcome.resolution.invalidatingConditions.includes(
						'disposition-missing',
					),
				)
				.map(
					(outcome) =>
						`oracle ${outcome.oracleId} is required and carries no disposition`,
				),
	},
	{
		id: 'required-check-unresolved',
		rung: 'invalid',
		guard: 'not every required check resolved',
		evidenceCondition: false,
		reasons: (inputs) =>
			requiredOutcomes(inputs)
				.filter((outcome) => !outcome.checkResolved)
				.map(
					(outcome) =>
						`oracle ${outcome.oracleId} is required and its check never resolved`,
				),
	},
	{
		id: 'selector-ambiguity',
		rung: 'invalid',
		guard:
			'a step matched several observations under a single-valued cardinality (owed item 2)',
		evidenceCondition: false,
		reasons: (inputs) =>
			inputs.outcomeState.outcomes
				.filter((outcome) =>
					outcome.resolution.invalidatingConditions.includes(
						'selector-ambiguity',
					),
				)
				.map((outcome) => `oracle ${outcome.oracleId}: selector ambiguity`),
	},
	{
		id: 'unwitnessed-claim',
		rung: 'invalid',
		guard:
			'a defect finding claimed a detection no candidate observation witnesses (AD-40)',
		evidenceCondition: false,
		reasons: (inputs) =>
			inputs.outcomeState.outcomes
				.filter((outcome) =>
					outcome.resolution.invalidatingConditions.includes(
						'unwitnessed-detection-claim',
					),
				)
				.map(
					(outcome) =>
						`oracle ${outcome.oracleId}: unwitnessed detection claim`,
				),
	},
	{
		id: 'unwitnessed-quotation',
		rung: 'invalid',
		guard:
			"a defect finding's quoted evidence appears in no cited observation (AD-32)",
		evidenceCondition: false,
		reasons: (inputs) =>
			inputs.outcomeState.unwitnessedQuotations.map(
				(quoted) =>
					`finding ${quoted.findingId}: unwitnessed quotation on channel ${quoted.channel}`,
			),
	},
	// Eight previously-rungless conditions, each newly given a rung here.
	// `ingest` already shipped the detection; this is the first ladder row
	// that reports it.
	{
		id: 'duplicate-record-identifier',
		rung: 'invalid',
		guard:
			'the record uses one observation, finding, or oracle-disposition identifier twice',
		evidenceCondition: false,
		reasons: (inputs) =>
			inputs.evidenceIntegrity.duplicateRecordIdentifiers.map(
				(condition) =>
					`duplicate ${condition.subject} identifier "${condition.identifier}" (${condition.occurrences} occurrences)`,
			),
	},
	{
		id: 'dangling-citation',
		rung: 'invalid',
		guard:
			'a finding cites an observation identifier the record does not declare',
		evidenceCondition: false,
		reasons: (inputs) =>
			inputs.evidenceIntegrity.danglingCitations.map(
				(condition) =>
					`finding ${condition.findingId} cites unresolved observation(s): ${condition.unresolvedObservationIds.join(', ')}`,
			),
	},
	{
		id: 'dangling-disposition-citation',
		rung: 'invalid',
		guard:
			'an oracle disposition cites an observation identifier the record does not declare',
		evidenceCondition: false,
		reasons: (inputs) =>
			inputs.evidenceIntegrity.danglingDispositionCitations.map(
				(condition) =>
					`oracle ${condition.oracleId} disposition cites unresolved observation(s): ${condition.unresolvedObservationIds.join(', ')}`,
			),
	},
	{
		id: 'forbidden-input-not-withheld',
		rung: 'invalid',
		guard: 'AD-16 forbidden input admitted rather than withheld',
		evidenceCondition: false,
		reasons: (inputs) =>
			inputs.evidenceIntegrity.forbiddenInputsNotWithheld.flatMap((condition) =>
				condition.inputs.map(
					(input) => `forbidden input admitted rather than withheld: ${input}`,
				),
			),
	},
	{
		id: 'cross-artifact-disagreement',
		rung: 'invalid',
		guard:
			'the sealed run record and the isolation manifest disagree on a field AD-32 requires them to agree on',
		evidenceCondition: false,
		reasons: (inputs) =>
			inputs.evidenceIntegrity.crossArtifactDisagreements.map(
				(condition) =>
					`record and manifest disagree on ${condition.field}: record "${condition.recordValue}", manifest "${condition.manifestValue}"`,
			),
	},
	{
		id: 'evaluator-configuration-absent',
		rung: 'invalid',
		guard: 'the evaluator configuration artifact is absent',
		evidenceCondition: false,
		reasons: (inputs) =>
			inputs.evidenceIntegrity.evaluatorConfigurationAbsent.map(
				() => 'evaluator configuration absent',
			),
	},
	{
		id: 'evaluator-configuration-digest-mismatch',
		rung: 'invalid',
		guard:
			'the evaluator configuration digest the record declares does not recompute from the artifact',
		evidenceCondition: false,
		reasons: (inputs) =>
			inputs.evidenceIntegrity.evaluatorConfigurationDigestMismatches.map(
				(condition) =>
					`evaluator configuration digest mismatch: declared "${condition.declaredDigest}", computed "${condition.computedDigest}"`,
			),
	},
	{
		id: 'judge-result-unscored',
		rung: 'invalid',
		guard: 'a judge result carries `score: null`',
		evidenceCondition: false,
		reasons: (inputs) =>
			inputs.evidenceIntegrity.judgeResultsUnscored.map(
				(condition) =>
					`judge result unscored: rubric ${condition.rubricId} criterion ${condition.criterionId}`,
			),
	},
	// The two score-computed conditions. Neither is an `IngestCondition`, so
	// `score.ts` renders each entry itself and this row only adds the outer
	// category label, following `isolation-manifest-violation`'s own
	// double-wrap precedent above.
	{
		id: 'operation-identifier-collision',
		rung: 'invalid',
		guard:
			"an observation's operationId matches an operation in more than one permittedInterfaces entry",
		evidenceCondition: false,
		reasons: (inputs) =>
			inputs.evidenceIntegrity.operationIdentifierCollisions.map(
				(collision) => `operation identifier collision: ${collision}`,
			),
	},
	{
		id: 'trial-set-field-disagreement',
		rung: 'invalid',
		guard:
			'two trials in the same trial set disagree on `mode` or `evaluatorRecommendation`',
		evidenceCondition: false,
		reasons: (inputs) =>
			inputs.evidenceIntegrity.trialSetDisagreements.map(
				(disagreement) => `trial-set field disagreement: ${disagreement}`,
			),
	},
]

/**
 * FAIL, shared between the two ladders. `evaluator-recommendation-fail` is
 * production-only and spliced in by `PRODUCTION_LADDER` alone: AD-21 states
 * plainly that the contract-scoring recommendation "is recorded as an input
 * rather than promoted to a rung".
 */
const FAIL_ROWS_SHARED: readonly LadderConditionRow[] = [
	{
		id: 'behavioural-failure-at-or-above-floor',
		rung: 'FAIL',
		guard:
			"an AD-6 behavioural failure at or above the scoring policy's severity floor",
		evidenceCondition: false,
		reasons: (inputs) =>
			inputs.outcomeState.outcomes
				.filter(
					(outcome) =>
						isBehaviouralFailure(outcome.resolution.state) &&
						atOrAboveFloor(outcome.severity, inputs.severityFloor),
				)
				.map(
					(outcome) =>
						`oracle ${outcome.oracleId} resolved ${outcome.resolution.state} at or above the severity floor`,
				),
	},
	{
		id: 'evidence-incomplete',
		rung: 'FAIL',
		guard: 'evidence reported incomplete under AD-17',
		evidenceCondition: false,
		reasons: (inputs) =>
			inputs.evidenceIntegrity.disclosure.reportedIncomplete
				? ['evidence reported incomplete']
				: [],
	},
	{
		id: 'evidence-over-truncated',
		rung: 'FAIL',
		guard: 'evidence truncated past its disclosed bound under AD-17',
		evidenceCondition: false,
		reasons: (inputs) =>
			inputs.evidenceIntegrity.overTruncated
				? ['evidence truncated past its disclosed bound']
				: [],
	},
	{
		id: 'evidence-unavailable',
		rung: 'FAIL',
		guard: 'evidence unavailable under AD-17',
		evidenceCondition: false,
		reasons: (inputs) =>
			inputs.evidenceIntegrity.unavailable ? ['evidence unavailable'] : [],
	},
	{
		id: 'evidence-internally-inconsistent',
		rung: 'FAIL',
		guard: 'evidence internally inconsistent under AD-17',
		evidenceCondition: false,
		reasons: (inputs) =>
			inputs.evidenceIntegrity.internallyInconsistent
				? ['evidence internally inconsistent']
				: [],
	},
	{
		id: 'lineage-chain-inconsistent',
		rung: 'FAIL',
		guard: 'a presented lineage chain internally inconsistent under AD-12',
		evidenceCondition: false,
		reasons: (inputs) =>
			lineageChainPassed(inputs.remediationState)
				? []
				: ['presented lineage chain is internally inconsistent'],
	},
]

const EVALUATOR_RECOMMENDATION_FAIL_ROW: LadderConditionRow = {
	id: 'evaluator-recommendation-fail',
	rung: 'FAIL',
	guard: 'an ingested evaluator recommendation of FAIL',
	evidenceCondition: false,
	reasons: (inputs) =>
		inputs.evaluatorRecommendation === 'FAIL'
			? ['evaluator recommendation FAIL']
			: [],
}

/**
 * CONCERNS, shared between the two ladders. `below-minimum-trial-count` and
 * `oracle-unreached` are AD-21's own two evidence conditions: "a run that
 * completed fewer trials than the policy's declared minimum, or any oracle
 * resolving `unreached`. The last two are evidence conditions."
 */
const CONCERNS_ROWS_SHARED: readonly LadderConditionRow[] = [
	{
		id: 'behavioural-failure-below-floor',
		rung: 'CONCERNS',
		guard:
			"an AD-6 behavioural failure below the scoring policy's severity floor",
		evidenceCondition: false,
		reasons: (inputs) =>
			inputs.outcomeState.outcomes
				.filter(
					(outcome) =>
						isBehaviouralFailure(outcome.resolution.state) &&
						!atOrAboveFloor(outcome.severity, inputs.severityFloor),
				)
				.map(
					(outcome) =>
						`oracle ${outcome.oracleId} resolved ${outcome.resolution.state} below the severity floor`,
				),
	},
	{
		id: 'coverage-gap-at-or-above-floor',
		rung: 'CONCERNS',
		guard:
			'an unsatisfied coverage gap at or above the severity floor under AD-20',
		evidenceCondition: false,
		reasons: (inputs) =>
			inputs.coverageGaps
				.filter(
					(gap) =>
						!gap.satisfied &&
						atOrAboveFloor(gap.severity, inputs.severityFloor),
				)
				.map(
					(gap) =>
						`coverage gap ${gap.rule} unsatisfied at or above the severity floor`,
				),
	},
	{
		id: 'finding-confidence-below-threshold',
		rung: 'CONCERNS',
		guard: 'a finding whose confidence falls below the policy threshold',
		evidenceCondition: false,
		reasons: (inputs) =>
			inputs.findings
				.filter((finding) => finding.confidence < inputs.confidenceThreshold)
				.map(
					(finding) =>
						`finding ${finding.findingId} confidence ${finding.confidence} below the policy threshold`,
				),
	},
	{
		id: 'uncited-defect-finding',
		rung: 'CONCERNS',
		guard: 'an ingested defect finding citing no oracle',
		// No severity-floor gate, unlike the two rows above: an uncited defect
		// finding is an evaluator already catching something real, not the
		// possibly-harmless under-declared corner a floor exists to excuse.
		evidenceCondition: false,
		reasons: (inputs) =>
			inputs.uncitedDefectFindings.map(
				(gap) => `finding ${gap.findingId}: defect finding citing no oracle`,
			),
	},
	{
		id: 'below-minimum-trial-count',
		rung: 'CONCERNS',
		guard: "the run completed fewer trials than the policy's declared minimum",
		evidenceCondition: true,
		reasons: (inputs) => {
			const { completed, declaredMinimum } = inputs.outcomeState.trials
			return completed < declaredMinimum
				? [
						`${completed} completed trials below the declared minimum of ${declaredMinimum}`,
					]
				: []
		},
	},
	{
		id: 'oracle-unreached',
		rung: 'CONCERNS',
		guard: 'an oracle resolved `unreached`',
		evidenceCondition: true,
		reasons: (inputs) =>
			inputs.outcomeState.outcomes
				.filter((outcome) => outcome.resolution.state === 'unreached')
				.map((outcome) => `oracle ${outcome.oracleId} resolved unreached`),
	},
]

const EVALUATOR_RECOMMENDATION_CONCERNS_ROW: LadderConditionRow = {
	id: 'evaluator-recommendation-concerns',
	rung: 'CONCERNS',
	guard: 'an ingested recommendation of CONCERNS',
	evidenceCondition: false,
	reasons: (inputs) =>
		inputs.evaluatorRecommendation === 'CONCERNS'
			? ['evaluator recommendation CONCERNS']
			: [],
}

/**
 * WAIVED, shared between the two ladders. Reads `OutcomeResolution.waiverRule`
 * directly rather than re-deriving waiver state: AD-33's own Stage C already
 * decided which oracle earned `not-applicable` against an unexpired waiver,
 * and `waiver-honoured` is that decision's own name for it.
 */
const WAIVED_ROWS: readonly LadderConditionRow[] = [
	{
		id: 'waiver-honoured',
		rung: 'WAIVED',
		guard:
			'every required check resolved and at least one resolved `not-applicable` against an unexpired waiver',
		evidenceCondition: false,
		reasons: (inputs) =>
			inputs.outcomeState.outcomes
				.filter(
					(outcome) => outcome.resolution.waiverRule === 'waiver-honoured',
				)
				.map((outcome) => `oracle ${outcome.oracleId} waived (not-applicable)`),
	},
]

/**
 * Production's ladder: the shared rows plus the two rows that read an
 * ingested evaluator recommendation, which contract-scoring's never does.
 */
export const PRODUCTION_LADDER: readonly LadderConditionRow[] = [
	...INVALID_ROWS,
	...FAIL_ROWS_SHARED,
	EVALUATOR_RECOMMENDATION_FAIL_ROW,
	...CONCERNS_ROWS_SHARED,
	EVALUATOR_RECOMMENDATION_CONCERNS_ROW,
	...WAIVED_ROWS,
]

/**
 * Contract-scoring's ladder: FAIL/CONCERNS/WAIVED/PASS mirror production's
 * minus every clause that promotes `evaluatorRecommendation`, per AD-21.
 */
export const CONTRACT_LADDER: readonly LadderConditionRow[] = [
	...INVALID_ROWS,
	...FAIL_ROWS_SHARED,
	...CONCERNS_ROWS_SHARED,
	...WAIVED_ROWS,
]

const RUNG_PRECEDENCE = ['invalid', 'FAIL', 'CONCERNS', 'WAIVED'] as const

/**
 * First-match-wins over tiers, in AD-21's own precedence order; within the
 * winning tier every row that holds contributes to `basis`, so a persistent
 * judge fault cannot mask a real regression, which is AD-21's own stated
 * reason for recording every condition that fired. PASS is the explicit
 * final rung: reached only when every tier above is empty, never an
 * `otherwise` branch written into the loop.
 */
function resolve(
	ladder: readonly LadderConditionRow[],
	inputs: AssessmentCommon,
): LadderResolution {
	for (const rung of RUNG_PRECEDENCE) {
		const fired = ladder
			.filter((row) => row.rung === rung)
			.map((row) => ({ row, reasons: row.reasons(inputs) }))
			.filter((candidate) => candidate.reasons.length > 0)
		if (fired.length === 0) continue
		const basis = fired.flatMap((candidate) => candidate.reasons)
		if (rung === 'invalid') {
			return {
				verdict: null,
				exitCode: LADDER_EXIT_CODES.invalid,
				strictPromotable: true,
				basis,
			}
		}
		if (rung === 'CONCERNS') {
			const strictPromotable = fired.some(
				(candidate) => !candidate.row.evidenceCondition,
			)
			return {
				verdict: 'CONCERNS',
				exitCode: LADDER_EXIT_CODES.CONCERNS,
				strictPromotable,
				basis,
			}
		}
		return {
			verdict: rung,
			exitCode: LADDER_EXIT_CODES[rung],
			strictPromotable: true,
			basis,
		}
	}
	return {
		verdict: 'PASS',
		exitCode: LADDER_EXIT_CODES.PASS,
		strictPromotable: true,
		basis: [],
	}
}

/** AD-21's production-mode ladder: the subject is the system under test. */
export function resolveProductionVerdict(
	assessment: ProductionAssessment,
): LadderResolution {
	return resolve(PRODUCTION_LADDER, assessment)
}

/**
 * AD-21's contract-scoring ladder: the subject is the contract. No row here
 * reads `evaluatorRecommendation`; `systemRecommendationRecorded` and
 * `systemRecommendationNote` are carried on the input for symmetry with
 * `EvidenceArtifact`'s own contract-scoring branch and are read by nothing in
 * this module.
 */
export function resolveContractVerdict(
	assessment: ContractAssessment,
): LadderResolution {
	return resolve(CONTRACT_LADDER, assessment)
}
