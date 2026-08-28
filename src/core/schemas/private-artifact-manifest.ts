/** the public-safe index of every private artifact this repository references. */

import { z } from 'zod'
import { lineageFields } from './lineage.ts'
import { Digest } from './primitives.ts'

/**
 * The prior art's eight `artifactType` members, ratified unchanged as
 * `artifactKind` (AD-24 rename only). An existing entry re-keys without
 * re-classifying.
 */
export const PRIVATE_ARTIFACT_KINDS = [
	'private-input-record',
	'raw-trace',
	'raw-result',
	'human-label',
	'implementation-patch',
	'isolation-manifest',
	'scripted-baseline-output',
	'other',
] as const

export const PrivateArtifactKind = z.enum(PRIVATE_ARTIFACT_KINDS)

export const PrivateArtifactEntry = z.strictObject({
	privateRef: z
		.string()
		.min(1)
		.describe(
			'The opaque handle the corpus port resolves under AD-8. Only emptiness is excluded: an opaque reference with a shape this package understands would stop being opaque.',
		),
	digest: Digest.describe(
		'The prior art\'s `sha256`, renamed against the shared AD-27 primitive; the value form is byte-identical. AD-8 is explicit that "a manifest digest is never a trusted label": the core recomputes the digest from the resolved bytes and a mismatch is an AD-28 `digest-mismatch` fault at ingest. That is a rule about resolved bytes, which a schema over a string cannot see, so it is recorded here and enforced nowhere in this file.',
	),
	artifactKind: PrivateArtifactKind.describe(
		"The prior art's `artifactType`, renamed and ratified with its eight members unchanged.",
	),
	publicSafeRunId: z
		.string()
		.nullable()
		.describe(
			'The run this artifact belongs to, in the public-safe vocabulary. `null` for an artifact belonging to no single run.',
		),
	sanitizationPolicy: z
		.string()
		.min(1)
		.nullable()
		.describe(
			'AD-8 carries "the sanitization policy applied to it", and the nearest antecedent is the entry rather than the manifest: a manifest holding a raw trace beside a human label gives the two different treatment, so per-entry is the only reading that survives. Opaque rather than an enum for the reason `ScopedResource.kind` is opaque: no AD supplies a value space, and inventing one is the unshaped-declaration defect in reverse. `null` spells "none applied", which must stay representable.',
		),
})

export const PrivateArtifactManifest = z
	.strictObject({
		...lineageFields,
		entries: z.array(PrivateArtifactEntry),
	})
	.meta({
		id: 'PrivateArtifactManifest',
		description:
			"The public-safe index of every private artifact this repository references. Succeeds the prior-art `private-evidence-manifest` schema per AD-24, with three divergences: the prior art's `manifestVersion: const 1` becomes AD-11's `schemaVersion` alongside AD-29's lineage, `artifactType` becomes `artifactKind` with its eight members ratified unchanged, and each entry gains AD-8's `sanitizationPolicy`. AD-18 binds this artifact hardest: it \"never contains a private path, credential, or domain value\". That prohibition is not expressible over opaque strings, so it is stated here, recorded in the constraint ledger as not expressible, and enforced by review and by the publication guard rather than by this schema.",
	})

export type PrivateArtifactManifest = z.infer<typeof PrivateArtifactManifest>
