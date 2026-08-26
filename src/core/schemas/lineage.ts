/** AD-11's schema version and AD-29's lineage pair, spelled once. */
import { z } from 'zod'
import { Digest } from './primitives.ts'

/**
 * The three fields every lineage-bearing artifact carries, lifted here so
 * eleven artifacts spread it instead of respelling it (the drift the
 * Consistency Conventions warn against).
 *
 * This module imports only zod and primitives.ts: `artifact.ts` imports all
 * twelve schema modules including this one, so importing `artifact.ts` back
 * from here would close a circular import.
 *
 * Spread rather than nested, so `EvalContract`'s shape and the Story 1.3
 * reject fixtures naming `['schemaVersion']`/`['parentDigest']` stay
 * unchanged; the two discriminated-union artifacts (`Probe`,
 * `EvidenceArtifact`) spread it inside every branch instead, since a union
 * has no root property bag.
 */
export const lineageFields = {
	schemaVersion: z
		.int()
		.min(1)
		.describe(
			'AD-11 requires an integer under this exact name. Deliberately not `z.literal(1)`: the literal exports as `{"type":"number","const":1}`, losing `integer` for a non-TypeScript consumer, and it would turn a version-2 artifact into an anonymous schema-parse failure instead of AD-28\'s dedicated `schema-version-mismatch` fault. Version equality belongs to the reader that throws that fault.',
		),
	parentDigest: Digest.nullable().describe(
		'AD-29 lineage. `null` if and only if `revisionCount` is 0. That biconditional is stated here rather than refined: a refinement is silently dropped from the published schema, so a non-TypeScript consumer would never see it, and the constraint ledger records it as not expressible.',
	),
	revisionCount: z
		.int()
		.min(0)
		.describe("AD-29: one greater than the parent artifact's."),
}
