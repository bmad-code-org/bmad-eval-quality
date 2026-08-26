/**
 * AD-34's stage-shape vocabulary. Two conformance types cover this story's
 * two stage implementations, `compile` and `seal`; two generic types record
 * the conditional plan/reduce pair for a later stage that needs one.
 *
 * This is not AD-24's complete six-stage input/output/owner/lineage table:
 * Story 6.4 owns that. These two conformance types become two of its inputs.
 */
import type { EvalContract } from './schemas/eval-contract.ts'
import type { SealedEvaluatorBrief } from './schemas/sealed-evaluator-brief.ts'

/** The core compile stage's one runtime option. Core behavior never depends on an implicit configuration source (AD-1), so this is required; `application/compile.ts` is the only caller that supplies a default. */
export type CompileOptions = {
	readonly strict: boolean
}

/** `core/compile/compile.ts`'s exact conformance shape. */
export type CompileStage = (
	contract: EvalContract,
	options: CompileOptions,
) => EvalContract

/** `core/seal/seal.ts`'s exact conformance shape. */
export type SealStage = (contract: EvalContract) => SealedEvaluatorBrief

/**
 * A stage's pure planning half: artifacts in, a request description out.
 * AD-34 makes this pair conditional on a stage needing external observation.
 * Compile and seal need none, so neither implements this; pre-flight
 * (Story 6.2) is the first concrete consumer.
 */
export type PlanStage<InputArtifact, RequestDescription> = (
	input: InputArtifact,
) => RequestDescription

/** A stage's pure reducing half: the plan plus the observations a port produced, reduced to the next artifact. */
export type ReduceStage<RequestDescription, Observation, OutputArtifact> = (
	plan: RequestDescription,
	observations: Observation,
) => OutputArtifact
