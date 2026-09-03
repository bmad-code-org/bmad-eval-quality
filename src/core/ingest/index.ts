/**
 * The ingest stage's surface for the rest of `core/`: the stage itself, the
 * product it owns, the condition vocabulary, and the ladder input each
 * condition feeds.
 *
 * Nothing here reaches `src/index.ts` or `src/application/index.ts`.
 * `validated-observations` is an internal stage product AD-24 exempts from
 * publication, so it has no schema, no registry entry, and no published type.
 */

export type {
	AgreementField,
	CrossArtifactDisagreement,
	DanglingCitation,
	DanglingDispositionCitation,
	EvaluatorConfigurationAbsent,
	EvaluatorConfigurationDigestMismatch,
	ForbiddenInputNotWithheld,
	IngestCondition,
	IngestConditionKind,
	IsolationManifestAbsent,
	IsolationManifestViolation,
	JudgeResultUnscored,
	LadderTarget,
	UnwitnessedQuotationCondition,
} from './conditions.ts'
export {
	AGREEMENT_FIELDS,
	INGEST_CONDITION_KINDS,
	LADDER_TARGETS,
} from './conditions.ts'
export type { ValidatedObservations } from './ingest.ts'
export { ingest } from './ingest.ts'
