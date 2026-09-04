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
export type { FailureCode } from '../core/failure-codes.ts'
export { FAILURE_CODES, StructuralFailure } from '../core/failure-codes.ts'
export type {
	LineageChainReport,
	LineageFinding,
} from '../core/lineage/chain.ts'
export { validateLineageChain } from '../core/lineage/chain.ts'
export { INTERCHANGE_ARTIFACT_KEYS } from '../core/schemas/artifact.ts'
export type { RuntimeFaultCode } from '../core/schemas/faults.ts'
export { RUNTIME_FAULT_CODES, RuntimeFault } from '../core/schemas/faults.ts'
export type {
	EvaluatorRecommendation,
	Verdict,
} from '../core/schemas/verdict.ts'
export {
	EVALUATOR_RECOMMENDATIONS,
	VERDICTS,
} from '../core/schemas/verdict.ts'
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
