/**
 * The ten conditions `core/ingest` detects, and the ladder input each one feeds.
 *
 * Each condition is a cross-artifact rule a shipped schema names `core/ingest`
 * as the enforcement point for, and none of them is a parse failure: the
 * artifacts arrive already parsed, and a rule two conforming artifacts break
 * between them is a finding about the run rather than a rejection of its bytes.
 *
 * The kinds are a runtime tuple first and the union draws from it, the idiom
 * `RUNTIME_FAULT_CODES`, `FORBIDDEN_INPUT_FLOOR`, and `ORACLE_DISPOSITIONS` are
 * written in. A union's `kind` literals are erased at compile time, so a drift
 * check over a bare union could only compare the mapping below against itself or
 * against a hand-written second list, which is the drift it exists to catch.
 *
 * `ladder.ts` is imported type-only on purpose. `isolatedModules` without
 * `verbatimModuleSyntax` compiles a value import used only in type position
 * silently, which would put the whole ladder module on this module's runtime
 * load path; `preflight/reduce.ts` imports `ReduceStage` the same way.
 */
import type { ForbiddenInput } from '../schemas/eval-contract.ts'
import type {
	EvidenceIntegrityInputs,
	OutcomeStateInputs,
} from '../score/ladder.ts'
import type { UnwitnessedQuotation } from '../score/quotation.ts'

/**
 * The ten kinds, in the order `ingest` records them. The two isolation-family
 * kinds and the two evaluator-configuration ones are sequenced here; the order
 * of the values inside one `isolation-manifest-violation` is the manifest's own
 * array order and belongs to the stage, not to this tuple.
 */
export const INGEST_CONDITION_KINDS = [
	'dangling-citation',
	'dangling-disposition-citation',
	'unwitnessed-quotation',
	'isolation-manifest-absent',
	'isolation-manifest-violation',
	'forbidden-input-not-withheld',
	'cross-artifact-disagreement',
	'evaluator-configuration-absent',
	'evaluator-configuration-digest-mismatch',
	'judge-result-unscored',
] as const

export type IngestConditionKind = (typeof INGEST_CONDITION_KINDS)[number]

/**
 * The three fields AD-32 requires the sealed run record and the isolation
 * manifest to agree on, in the order a disagreement is reported.
 *
 * `conditionArm` sits on both artifacts and is deliberately excluded: both
 * schemas describe it as "an opaque caller label with no product semantics, per
 * AD-24", so making a mismatch invalidate would mint a normative rule with no
 * AD behind it and would be the one invalidating condition in the design with
 * nothing downstream reading it.
 */
export const AGREEMENT_FIELDS = [
	'runId',
	'contractDigest',
	'evaluatorConfigurationDigest',
] as const

export type AgreementField = (typeof AGREEMENT_FIELDS)[number]

/**
 * A finding citing an observation identifier the record does not declare. One
 * per finding, carrying every identifier that resolved to nothing, so a
 * consumer never has to re-derive which half of the citation was bad.
 */
export type DanglingCitation = {
	readonly kind: Extract<IngestConditionKind, 'dangling-citation'>
	readonly findingId: string
	readonly unresolvedObservationIds: readonly string[]
}

/**
 * A disposition citing an observation identifier the record does not declare.
 *
 * The record's second citation site, and the one nothing else reads. AD-33 wants
 * "every disposition citing supporting observations, and an unsupported
 * disposition invalidating cross-artifact agreement rather than being believed";
 * `resolveOutcome`'s `unsupported-disposition` covers the empty list only, so a
 * `violated` disposition corroborated by a citation to nothing would otherwise
 * be believed. Ingest is the only stage holding the dispositions and the
 * observations at once.
 */
export type DanglingDispositionCitation = {
	readonly kind: Extract<IngestConditionKind, 'dangling-disposition-citation'>
	readonly oracleId: string
	readonly unresolvedObservationIds: readonly string[]
}

/**
 * The quotation audit's own return value, unchanged. `auditQuotation` already
 * shapes the payload its consumer declares, so re-projecting it here would be a
 * second spelling of one result.
 */
export type UnwitnessedQuotationCondition = {
	readonly kind: Extract<IngestConditionKind, 'unwitnessed-quotation'>
	readonly quotations: readonly UnwitnessedQuotation[]
}

/**
 * AD-16's absent manifest. No payload: there is no artifact to describe, which
 * is why no schema can carry this rule and why the manifest's own `.meta` hands
 * the violating case to `core/ingest`.
 */
export type IsolationManifestAbsent = {
	readonly kind: Extract<IngestConditionKind, 'isolation-manifest-absent'>
}

/**
 * A declared violation, an observed mount, network target, or tool call outside
 * its allowlist, or any combination. One condition rather than four, each
 * exceeded allowlist carrying its own offending values in the manifest's array
 * order, so a consumer reads values rather than parsing them back out of a
 * joined summary.
 */
export type IsolationManifestViolation = {
	readonly kind: Extract<IngestConditionKind, 'isolation-manifest-violation'>
	readonly violation: string | null
	readonly mountsOutsideAllowlist: readonly string[]
	readonly networkTargetsOutsideAllowlist: readonly string[]
	readonly toolCallsOutsideAllowlist: readonly string[]
}

/**
 * AD-16's first clause: a prohibited input the manifest accounts for with
 * `withheld: false`. Named in `FORBIDDEN_INPUT_FLOOR` order, since that list is
 * the floor's one home and the manifest's key order is the caller's.
 */
export type ForbiddenInputNotWithheld = {
	readonly kind: Extract<IngestConditionKind, 'forbidden-input-not-withheld'>
	readonly inputs: readonly ForbiddenInput[]
}

/**
 * One field the two artifacts disagree on, carrying both values. Per field
 * rather than per record: a run whose two artifacts disagree about which
 * configuration produced it is a different finding from one that disagrees
 * about which run it is.
 */
export type CrossArtifactDisagreement = {
	readonly kind: Extract<IngestConditionKind, 'cross-artifact-disagreement'>
	readonly field: AgreementField
	readonly recordValue: string
	readonly manifestValue: string
}

/**
 * AD-24's absent evaluator configuration. No payload, for the same reason
 * `IsolationManifestAbsent` carries none: there is no artifact to describe.
 */
export type EvaluatorConfigurationAbsent = {
	readonly kind: Extract<IngestConditionKind, 'evaluator-configuration-absent'>
}

/**
 * The digest the record declares for the evaluator configuration against the
 * one that artifact actually produces.
 *
 * The operand is the record's declaration. A disagreement between the record's
 * and the manifest's declarations is already `cross-artifact-disagreement`, and
 * what this condition adds is the half AD-32 calls the trust boundary: both
 * declarations are caller-attested, and only the recomputation reads the
 * artifact.
 */
export type EvaluatorConfigurationDigestMismatch = {
	readonly kind: Extract<
		IngestConditionKind,
		'evaluator-configuration-digest-mismatch'
	>
	readonly declaredDigest: string
	readonly computedDigest: string
}

/**
 * AD-17's record-decidable half: a judge result carrying `score: null`. The
 * other half, that the criterion is one the cited rubric declares, needs the
 * rubric, which no stage row declares as an input.
 */
export type JudgeResultUnscored = {
	readonly kind: Extract<IngestConditionKind, 'judge-result-unscored'>
	readonly rubricId: string
	readonly criterionId: string
}

export type IngestCondition =
	| DanglingCitation
	| DanglingDispositionCitation
	| UnwitnessedQuotationCondition
	| IsolationManifestAbsent
	| IsolationManifestViolation
	| ForbiddenInputNotWithheld
	| CrossArtifactDisagreement
	| EvaluatorConfigurationAbsent
	| EvaluatorConfigurationDigestMismatch
	| JudgeResultUnscored

/**
 * The ladder field a condition feeds, or `null` where no rung reads it.
 *
 * Seven of the ten carry `null`. Neither shipped ladder has a rung for a
 * dangling citation from either site, a record-versus-manifest disagreement, an
 * admitted prohibited input, an evaluator configuration that is absent or whose
 * digest does not recompute, or a malformed judge result: AD-16's title carries
 * two clauses, "a prohibited input **or** an unaccounted isolation manifest
 * invalidates a run", and AD-21's Invalid enumeration names only the manifest
 * one. Routing any of them onto a neighbouring rung would make the persisted
 * basis read as a different finding, which is worse than a condition with no
 * rung at all, so the mapping records `null` until those rungs exist and a check
 * pins the set so an eighth fails the build.
 *
 * A narrow pair built with `Extract` rather than a bare `keyof` product: the
 * product expands to nine keys including `internallyInconsistent`, whose row is
 * FAIL and whose guard reads "internally inconsistent under AD-17", and a bare
 * key would also lose which of the two input types it came from. Renaming
 * either field in `ladder.ts` collapses its branch here to `never`, so the
 * mapping below stops compiling instead of pointing at a field that no longer
 * exists.
 */
export type LadderTarget =
	| Extract<keyof EvidenceIntegrityInputs, 'isolationViolation'>
	| Extract<keyof OutcomeStateInputs, 'unwitnessedQuotations'>
	| null

/** Total over the kinds tuple: a new kind fails to compile until it declares its rung or admits it has none. */
export const LADDER_TARGETS: Record<IngestConditionKind, LadderTarget> = {
	'dangling-citation': null,
	'dangling-disposition-citation': null,
	'unwitnessed-quotation': 'unwitnessedQuotations',
	'isolation-manifest-absent': 'isolationViolation',
	'isolation-manifest-violation': 'isolationViolation',
	'forbidden-input-not-withheld': null,
	'cross-artifact-disagreement': null,
	'evaluator-configuration-absent': null,
	'evaluator-configuration-digest-mismatch': null,
	'judge-result-unscored': null,
}
