/** the closed inventory of interchange artifacts, as data. */
import type { z } from 'zod'
import { ArtifactReference } from './artifact-reference.ts'
import { EvalContract } from './eval-contract.ts'
import { EvaluatorConfiguration } from './evaluator-configuration.ts'
import { EvidenceArtifact } from './evidence-artifact.ts'
import { IsolationManifest } from './isolation-manifest.ts'
import { PreflightVerdict } from './preflight-verdict.ts'
import { PrivateArtifactManifest } from './private-artifact-manifest.ts'
import { Probe } from './probe.ts'
import { Rubric } from './rubric.ts'
import { ScoringPolicy } from './scoring-policy.ts'
import { SealedEvaluatorBrief } from './sealed-evaluator-brief.ts'
import { SealedRunRecord } from './sealed-run-record.ts'

/**
 * The phrase an artifact with no predecessor uses in its own description, per
 * AD-24. Exported so a test checks one string instead of six hard-coded
 * copies.
 */
export const NO_PRIOR_ART = 'no prior art'

type InterchangeArtifactEntry = {
	readonly schema: z.ZodType
	/** the prior-art schema this artifact succeeds, or null for none. */
	readonly priorArt: string | null
	/** whether the artifact carries AD-29's lineage; false for exactly one. */
	readonly carriesLineage: boolean
}

/**
 * The Structural Seed's inventory, closed at twelve, held as data. The
 * prior-art test reads it and the constraint ledger generates its lineage
 * entries from it, so each entry carries the prior art and the lineage flag
 * alongside the schema.
 *
 * This module only consumes: it imports the twelve, and nothing under
 * `src/core/schemas/` imports it. That is why the lineage fields live in
 * `lineage.ts`. All twelve modules import those fields, so holding both here
 * would close an import cycle and fail at module load with a temporal-dead-zone
 * `ReferenceError` from whichever artifact module loaded first.
 *
 * Story 1.5 walks this registry to decide what to export and writes no second
 * list, the same way it consumes `CONSTRAINT_LEDGER`.
 */
export const INTERCHANGE_ARTIFACTS = {
	'eval-contract': {
		schema: EvalContract,
		priorArt: 'eval-contract',
		carriesLineage: true,
	},
	rubric: { schema: Rubric, priorArt: null, carriesLineage: true },
	'sealed-evaluator-brief': {
		schema: SealedEvaluatorBrief,
		priorArt: null,
		carriesLineage: true,
	},
	'sealed-run-record': {
		schema: SealedRunRecord,
		priorArt: 'h0-run-result',
		carriesLineage: true,
	},
	'isolation-manifest': {
		schema: IsolationManifest,
		priorArt: 'isolation-manifest',
		carriesLineage: true,
	},
	'evaluator-configuration': {
		schema: EvaluatorConfiguration,
		priorArt: null,
		carriesLineage: true,
	},
	probe: { schema: Probe, priorArt: 'h0-ground-truth', carriesLineage: true },
	'artifact-reference': {
		schema: ArtifactReference,
		priorArt: 'artifact-ref',
		carriesLineage: false,
	},
	'private-artifact-manifest': {
		schema: PrivateArtifactManifest,
		priorArt: 'private-evidence-manifest',
		carriesLineage: true,
	},
	'preflight-verdict': {
		schema: PreflightVerdict,
		priorArt: null,
		carriesLineage: true,
	},
	'scoring-policy': {
		schema: ScoringPolicy,
		priorArt: null,
		carriesLineage: true,
	},
	'evidence-artifact': {
		schema: EvidenceArtifact,
		priorArt: null,
		carriesLineage: true,
	},
} as const satisfies Record<string, InterchangeArtifactEntry>

export type InterchangeArtifactKey = keyof typeof INTERCHANGE_ARTIFACTS

export const INTERCHANGE_ARTIFACT_KEYS = Object.keys(
	INTERCHANGE_ARTIFACTS,
) as readonly InterchangeArtifactKey[]
