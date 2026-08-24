/** AD-11's schema version and AD-29's lineage pair, spelled once. */
import { z } from 'zod'
import { Digest } from './primitives.ts'

/**
 * The three fields every lineage-bearing artifact carries, lifted here instead
 * of respelling them at each of eleven artifacts (the drift the Consistency
 * Conventions warn against) and spread into each one.
 *
 * This module must keep importing only zod and primitives.ts. `artifact.ts`
 * imports all twelve schema modules to build the registry, and every one of
 * those imports this object; merging the two closes an import cycle, which
 * fails as a temporal-dead-zone `ReferenceError` at module load with no
 * visible link to lineage.
 *
 * Spread rather than nested: nesting would change `EvalContract`'s shape and
 * break the Story 1.3 reject fixtures that name `['schemaVersion']` and
 * `['parentDigest']` as issue paths, and AD-13 requires each exported file to
 * stay self-contained, so a shared `$defs` entry buys nothing (verified on the
 * pin: a spread object literal adds none).
 *
 * The two artifacts with discriminated-union roots (`Probe`, `EvidenceArtifact`)
 * take the spread inside every branch, since a union has no property bag at
 * its root to spread into.
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
