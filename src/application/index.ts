/**
 * The application layer's published surface. `cli/` may import this layer and
 * `adapters/` and nothing else; `src/index.ts` may import this layer and
 * `core/schemas` and nothing else. Anything either of them needs out of
 * `core/` is re-exported here, which is what keeps the dependency matrix
 * unamended.
 */
export {
	digestArtifact,
	digestBytes,
	digestComposite,
} from '../core/canonical/digest.ts'
// The seven discipline-rule identifiers, the spellings a coverage gap and a
// waiver carry in `rule`.
export type { DisciplineRule } from '../core/coverage/rules.ts'
export { DISCIPLINE_RULES } from '../core/coverage/rules.ts'
// The evaluator, for a consumer that resolves a check itself: the resolver,
// the two factories that build its operand and collection predicates from a
// contract and its observations, and the reference-set keys. `ABSENT` ships
// beside them because a `ResolveOperand` a consumer writes has to return it,
// and a sentinel the type names and the barrel withholds cannot be returned.
export {
	makePointerDenotesCollection,
	makeResolveOperand,
	referenceSetKeysOf,
} from '../core/evaluate/evidence-resolution.ts'
export type {
	PointerDenotesCollection,
	ReferenceSetKeys,
	ResolveOperand,
} from '../core/evaluate/resolution.ts'
export { resolveCheck } from '../core/evaluate/resolution.ts'
export type { ResolvedValue } from '../core/evaluate/resolved-value.ts'
export { ABSENT } from '../core/evaluate/resolved-value.ts'
export type { FailureCode } from '../core/failure-codes.ts'
export { FAILURE_CODES, StructuralFailure } from '../core/failure-codes.ts'
export type {
	LineageChainReport,
	LineageFinding,
} from '../core/lineage/chain.ts'
export { validateLineageChain } from '../core/lineage/chain.ts'
// AD-35's allow-or-deny decision over a resolved HTTP target. An adapter
// author's `EnvironmentProbePort` for `api` delegates to `evaluateTarget`, so
// address classification exists once, here.
export type {
	AddressClass,
	DenialReason,
	ParsedAddress,
	PolicyDecision,
	ResolvedTarget,
} from '../core/probe/target-policy.ts'
export {
	ADDRESS_CLASSES,
	classifyAddress,
	DENIAL_REASONS,
	evaluateTarget,
	isSafeMethod,
	parseAddress,
} from '../core/probe/target-policy.ts'
export { INTERCHANGE_ARTIFACT_KEYS } from '../core/schemas/artifact.ts'
// Type-only: `eval-contract.ts` declares a Zod schema under the name
// `Severity` beside the union type, and a live schema on the barrel is what
// `tests/architecture/package-exports.test.ts` case 152 refuses.
export type { Severity } from '../core/schemas/eval-contract.ts'
export { SEVERITY_LEVELS } from '../core/schemas/eval-contract.ts'
// The array only: `OutcomeState`, the Zod enum over it, stays off the barrel.
export { OUTCOME_STATES } from '../core/schemas/evidence-artifact.ts'
export type {
	ForbiddenTargetReason,
	RuntimeFaultCode,
} from '../core/schemas/faults.ts'
export {
	FORBIDDEN_TARGET_REASONS,
	RUNTIME_FAULT_CODES,
	RuntimeFault,
} from '../core/schemas/faults.ts'
export type {
	EvaluatorRecommendation,
	Verdict,
} from '../core/schemas/verdict.ts'
export {
	EVALUATOR_RECOMMENDATIONS,
	VERDICTS,
} from '../core/schemas/verdict.ts'
export type {
	QualificationFailure,
	QualificationFailureCode,
	QualificationResult,
} from '../core/score/qualification.ts'
export {
	QUALIFICATION_FAILURES,
	qualifyProbe,
	resolveHomeOperation,
} from '../core/score/qualification.ts'
export type {
	ComparableResult,
	DominanceRelationValue,
} from '../core/score/strength.ts'
export {
	compareDominance,
	DOMINANCE_RELATIONS,
} from '../core/score/strength.ts'
export type { PlanIndex } from '../core/seal/plan-index.ts'
export { compile } from './compile.ts'
export type { Diagnostic, DiagnosticSink } from './diagnostics.ts'
export type {
	PreflightFromObservationsOptions,
	RunPreflightOptions,
} from './preflight.ts'
export { preflightFromObservations, runPreflight } from './preflight.ts'
export type { RunScoreOptions, RunScoreResult } from './score.ts'
export { runScore } from './score.ts'
export { seal } from './seal.ts'
export { serializeArtifact } from './serialize.ts'
