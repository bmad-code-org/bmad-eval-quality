/**
 * AD-32's cross-artifact mode-agreement check: a sealed run record's `mode`
 * must agree with the evidence artifact's own `mode` discriminant, in both
 * directions. A hand-written function at the assembly boundary rather than a
 * schema refinement, mirroring `isolation-manifest.ts`'s
 * `evaluatorConfigurationDigest` agreement note: no single schema sees both
 * artifacts.
 *
 * `sealed-run-record.ts`'s own `mode` description states the rule this
 * function enforces: mode is "fixed before ingest" and the evidence artifact
 * "restates it and is never the source". A mismatch is therefore always a
 * caller defect, never a legitimate re-labelling.
 */
import type { EvidenceArtifact } from '../schemas/evidence-artifact.ts'
import type {
	RunModeValue,
	SealedRunRecord,
} from '../schemas/sealed-run-record.ts'

export type ModeAgreement =
	| { readonly agrees: true; readonly mode: RunModeValue }
	| {
			readonly agrees: false
			readonly recordMode: RunModeValue
			readonly artifactMode: RunModeValue
	  }

/**
 * A plain equality check, which is what "rejects, in both directions"
 * amounts to: `(production, contract-scoring)` and its reverse pairing are
 * both instances of the two arguments disagreeing, and neither is a
 * distinguished direction this function reads differently.
 */
export function checkModeAgreement(
	record: Pick<SealedRunRecord, 'mode'>,
	artifact: Pick<EvidenceArtifact, 'mode'>,
): ModeAgreement {
	if (record.mode === artifact.mode) {
		return { agrees: true, mode: record.mode }
	}
	return {
		agrees: false,
		recordMode: record.mode,
		artifactMode: artifact.mode,
	}
}
