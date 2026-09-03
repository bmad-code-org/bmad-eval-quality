/**
 * AD-34's stage-shape vocabulary. Two conformance types pin the exact shapes
 * of `compile` and `seal`; three generic types cover the rest -- the
 * conditional plan/reduce pair, which `preflight` implements, and the ingest
 * shape, generic over the product it owns.
 *
 * AD-24's six-stage input/output/owner/lineage table lives in
 * `core/lineage/stage-table.ts`. This file holds the stage *shapes* TypeScript
 * checks an implementation against; that one holds the *table* AD-24 fixes.
 * Neither imports the other.
 */
import type { EvalContract } from './schemas/eval-contract.ts'
import type { EvaluatorConfiguration } from './schemas/evaluator-configuration.ts'
import type { IsolationManifest } from './schemas/isolation-manifest.ts'
import type { SealedEvaluatorBrief } from './schemas/sealed-evaluator-brief.ts'
import type { SealedRunRecord } from './schemas/sealed-run-record.ts'

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
 * Compile and seal need none, so neither implements this; pre-flight does, and
 * `core/preflight/plan.ts` and `core/preflight/reduce.ts` are the pair that
 * satisfies these two types.
 */
export type PlanStage<InputArtifact, RequestDescription> = (
	input: InputArtifact,
) => RequestDescription

/** A stage's pure reducing half: the plan plus the observations a port produced, reduced to the next artifact. */
export type ReduceStage<RequestDescription, Observation, OutputArtifact> = (
	plan: RequestDescription,
	observations: Observation,
) => OutputArtifact

/**
 * The ingest stage: the three artifacts AD-24's table declares as its inputs,
 * validated into the internal product it owns. `core/ingest/ingest.ts`
 * implements it.
 *
 * Three parameters and no fourth. AD-24 names `mode` as a value input and the
 * sealed run record is where mode is read from, so restating it as an argument
 * would create a disagreement case the design has no rule for.
 *
 * The manifest and the evaluator configuration both admit `null` because AD-16
 * and AD-24 each make an absent artifact a condition this stage records rather
 * than a shape a caller may not present. Their other shared clause, incomplete,
 * is a schema rejection raised before this stage sees anything.
 *
 * Generic over the product for the same reason `ReduceStage` is: a concrete
 * return type would import from `core/ingest/`, which imports this file back.
 */
export type IngestStage<Product> = (
	record: SealedRunRecord,
	manifest: IsolationManifest | null,
	configuration: EvaluatorConfiguration | null,
) => Product
