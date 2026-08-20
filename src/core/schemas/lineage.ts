/** AD-11's schema version and AD-29's lineage pair, spelled once. */
import { z } from 'zod'
import { Digest } from './primitives.ts'

/**
 * The three fields every lineage-bearing artifact carries. `EvalContract`
 * spelled all three flat at its root in Story 1.3; spelling them again across
 * eleven more artifacts is the drift the Consistency Conventions warn about, so
 * they are lifted here and spread into each artifact.
 *
 * This module imports zod and primitives.ts and nothing else, and it must stay
 * that way. It cannot be merged into `artifact.ts`: that file imports all
 * twelve schema modules to build the registry, every one of those modules
 * imports this object, and one file holding both closes an import cycle. The
 * failure is `ReferenceError: Cannot access 'X' before initialization` at
 * module load, a temporal-dead-zone error thrown by whichever artifact module a
 * test happens to import first, with no visible connection to the lineage
 * fields.
 *
 * Spread instead of nested, for two reasons. Nesting would change
 * `EvalContract`'s shape and invalidate the Story 1.3 reject fixtures that name
 * `['schemaVersion']` and `['parentDigest']` as issue paths. And AD-13 requires
 * each exported file to be self-contained with shared shapes duplicated into
 * local definitions, so a `$defs` entry shared across eleven files buys nothing
 * the export can keep. Verified on the pin: a spread object literal adds no
 * `$defs` entry.
 *
 * Two of the eleven have discriminated-union roots (`Probe` on `expectedClean`,
 * `EvidenceArtifact` on `mode`). The spread lands inside every branch, since a
 * union has no property bag to spread into and the attempt is a type error.
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
