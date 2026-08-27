/**
 * AD-24's stage-signature table and AD-29's producer map, as data: six stages
 * with their inputs, their one owned output, and the lineage edge each writes;
 * twelve interchange artifacts with one producer apiece. The `check:lineage`
 * scanner derives its allowlist from `module`, so the registry import stays
 * type-only to keep zod off that gate's load path.
 */
import type { InterchangeArtifactKey } from '../schemas/artifact.ts'

/** AD-24's six stages, in the order the Consistency Conventions list them. */
export const PIPELINE_STAGES = [
	'compile',
	'seal',
	'ingest',
	'preflight',
	'score',
	'emit',
] as const

export type PipelineStage = (typeof PIPELINE_STAGES)[number]

/**
 * Typed stage products no schema publishes (AD-24). `probe-plan` comes from
 * pre-flight's plan half and `probe-observations` from the probe port, so
 * neither is a stage's owned output.
 */
export const INTERNAL_PRODUCTS = [
	'probe-plan',
	'probe-observations',
	'validated-observations',
	'scored-outcomes-and-verdict',
] as const

export type InternalProduct = (typeof INTERNAL_PRODUCTS)[number]

/**
 * What a stage does to the two AD-29 fields on the artifact it owns. `mints`
 * covers a root and a revision alike, since both write the fields.
 */
export type LineageEdge = 'mints' | 'carries-through' | 'none'

/** Who produces an interchange artifact. */
export type ArtifactProducer = PipelineStage | 'caller' | 'embedded'

export type StageSignature = {
	readonly inputs: readonly (InterchangeArtifactKey | InternalProduct)[]
	readonly owns: InterchangeArtifactKey | InternalProduct
	/** the owned output's registry key; null when the output is internal. */
	readonly ownsInterchange: InterchangeArtifactKey | null
	readonly lineage: LineageEdge
	/** the module that writes the artifact; null while the stage is unbuilt. */
	readonly module: string | null
}

export const STAGE_SIGNATURES: Record<PipelineStage, StageSignature> = {
	compile: {
		inputs: ['eval-contract'],
		owns: 'eval-contract',
		ownsInterchange: 'eval-contract',
		// The caller authors the contract and its lineage; `compile` validates
		// and returns it. The Seed's behaviour-input transformation is unbuilt,
		// so the row is an identity.
		lineage: 'carries-through',
		module: 'src/core/compile/compile.ts',
	},
	seal: {
		inputs: ['eval-contract'],
		owns: 'sealed-evaluator-brief',
		ownsInterchange: 'sealed-evaluator-brief',
		lineage: 'mints',
		module: 'src/core/seal/seal.ts',
	},
	ingest: {
		inputs: [
			'sealed-run-record',
			'isolation-manifest',
			'evaluator-configuration',
		],
		owns: 'validated-observations',
		ownsInterchange: null,
		lineage: 'none',
		module: null,
	},
	preflight: {
		// AD-34 splits the stage into `plan` and `reduce`; both halves' inputs
		// are the stage's inputs, and only `reduce` returns an artifact.
		inputs: ['eval-contract', 'probe', 'probe-plan', 'probe-observations'],
		owns: 'preflight-verdict',
		ownsInterchange: 'preflight-verdict',
		lineage: 'mints',
		module: 'src/core/preflight/reduce.ts',
	},
	score: {
		inputs: [
			'eval-contract',
			'validated-observations',
			'probe',
			'preflight-verdict',
			'scoring-policy',
		],
		// AD-24: "score produces the outcome and verdict values emit
		// serializes". Owed item 6 records that type as unnamed; this names it.
		owns: 'scored-outcomes-and-verdict',
		ownsInterchange: null,
		lineage: 'none',
		module: null,
	},
	emit: {
		inputs: ['scored-outcomes-and-verdict'],
		owns: 'evidence-artifact',
		ownsInterchange: 'evidence-artifact',
		lineage: 'mints',
		module: null,
	},
}

export const ARTIFACT_PRODUCERS: Record<
	InterchangeArtifactKey,
	ArtifactProducer
> = {
	'eval-contract': 'compile',
	rubric: 'caller',
	'sealed-evaluator-brief': 'seal',
	'sealed-run-record': 'caller',
	'isolation-manifest': 'caller',
	'evaluator-configuration': 'caller',
	probe: 'caller',
	'artifact-reference': 'embedded',
	'private-artifact-manifest': 'caller',
	'preflight-verdict': 'preflight',
	'scoring-policy': 'caller',
	'evidence-artifact': 'emit',
}

/**
 * The modules permitted to write `parentDigest` or `revisionCount`, derived
 * from the table it is handed. A function, because a module-level constant is
 * evaluated once at import and a test mutating the table would see nothing.
 */
export function deriveLineageWriterModules(
	signatures: Record<PipelineStage, StageSignature>,
): readonly string[] {
	return PIPELINE_STAGES.map((stage) => signatures[stage]).flatMap(
		(signature) =>
			signature.lineage === 'mints' && signature.module !== null
				? [signature.module]
				: [],
	)
}

export const LINEAGE_WRITER_MODULES: readonly string[] =
	deriveLineageWriterModules(STAGE_SIGNATURES)
