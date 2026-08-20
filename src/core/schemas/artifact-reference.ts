/** the four-field reference every artifact points at evidence with. */
import { z } from 'zod'
import { Digest } from './primitives.ts'

/**
 * Succeeds the prior-art `artifact-ref`, whose four fields carried two
 * `if`/`then` branches. AD-13 re-expresses a conditional prior-art constraint
 * as a discriminated union, so the published shape changes from `if`/`then` to
 * `oneOf`.
 *
 * Both branches keep every prior-art key so the correspondence stays readable.
 * The inapplicable member is `z.null()` instead of omitted, following the
 * explicit-`null` convention for a branch where the key has no value.
 *
 * The prior art's field name `sha256` becomes `digest`: one shared `Digest`
 * primitive and one field name, with a byte-identical value form, since the
 * prior art's own values already begin with `sha256:`. An AD-24 divergence.
 */
export const ArtifactReference = z
	.discriminatedUnion('storage', [
		z.strictObject({
			storage: z.literal('public'),
			path: z.string().min(1),
			privateRef: z.null(),
			digest: Digest,
		}),
		z.strictObject({
			storage: z.literal('private'),
			path: z.null(),
			privateRef: z
				.string()
				.min(1)
				.describe(
					'An opaque handle resolved through the corpus port under AD-8, never a filesystem path and never a URL. AD-18 forbids a private path from entering any artifact, and this is the field a caller would otherwise reach for.',
				),
			digest: Digest,
		}),
	])
	.meta({
		id: 'ArtifactReference',
		description:
			"A reference to an artifact, public by path or private by opaque handle. Succeeds the prior-art `artifact-ref` schema per AD-24, with its two `if`/`then` branches re-expressed as a discriminated union per AD-13 and its `sha256` field renamed to `digest` against the shared AD-27 primitive. Alone among the twelve interchange artifacts this one carries NO `schemaVersion` and NO AD-29 lineage: it is a reference shape embedded inside other artifacts rather than one that crosses the package boundary alone, so versioning it would add a key to every finding and every manifest entry for no reader. It is in the inventory because it is published, not because it is exchanged; the exemption is asserted by a test against the registry's `carriesLineage` flag.",
	})

export type ArtifactReference = z.infer<typeof ArtifactReference>
