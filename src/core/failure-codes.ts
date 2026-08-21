/** AD-5's twenty-one compile-time failure codes, as data, in the table's order. */

// This module sits in `core/` rather than `core/schemas/` on purpose: the
// Structural Seed calls `schemas/` "Zod definitions; the single source of truth
// for every artifact", and a codes-only module is neither a Zod definition nor
// an artifact. The compiler that emits these codes lives in `core/compile/`,
// one directory over. It imports nothing but its own literals.
//
// The epic's standing prohibition is "must not hand-maintain the failure-code
// enumeration beside AD-5's table. It is generated from it." This tuple is the
// single source for every later consumer: Story 4.2 builds the registry as
// code on top of it and transcribes nothing, and any published schema that
// later needs the enumeration writes `z.enum(FAILURE_CODES)`. The binding to
// the spine's table is mechanical: `scripts/check-ad5-registry.ts` parses the
// table inside AD-5 of ARCHITECTURE-SPINE.md and asserts set and order
// equality against this tuple under `npm run validate`; the tuple's own
// invariants (twenty-one members, unique, kebab-case) are locked in
// tests/schemas/failure-codes.test.ts.
export const FAILURE_CODES = [
	'missing-requirement-linkage',
	'no-observable-success-criterion',
	'unreachable-check-evidence',
	'malformed-operator-expression',
	'quantifier-over-non-collection',
	'quantifier-nesting-exceeded',
	'unresolved-reference-set',
	'duplicate-operation-signature',
	'undeclared-mandatory-input',
	'oracle-missing-channel',
	'direction-check-misaligned',
	'unsupported-interface-kind',
	'nested-temporal-clause',
	'plan-exceeds-scripting-bound',
	'rubric-scores-reasoning-prose',
	'rubric-unanchored',
	'rubric-evidence-unreachable',
	'forbidden-input-floor-incomplete',
	'scoped-reference-resolves-forbidden',
	'waiver-incomplete',
	'brief-exceeds-scripting-bound',
] as const

export type FailureCode = (typeof FAILURE_CODES)[number]

/**
 * AD-5's compile-time failure registry, thrown rather than returned: a
 * structural error fails compilation (or, for this code, the post-generation
 * brief audit) and emits no artifact. Disjoint from AD-28's `RuntimeFault`
 * (`core/schemas/faults.ts`) — the Consistency Conventions' Errors row keeps
 * the two registries "never merged", so this class mirrors `RuntimeFault`'s
 * shape (`code`, `artifactPath`, the same constructor signature) without
 * subclassing or importing it. Living beside `FAILURE_CODES` rather than in
 * `core/seal/`, the one module that fires it first, is deliberate: AD-5's
 * registry is shared by all twenty-one codes, and Epic 4 (Story 4.2, the AD-5
 * registry as code and the structural compile checks) reuses this class for
 * its other twenty rather than minting a second one.
 */
export class StructuralFailure extends Error {
	readonly code: FailureCode
	readonly artifactPath: string

	constructor(
		code: FailureCode,
		artifactPath: string,
		detail: string,
		options?: { cause?: unknown },
	) {
		super(`${code} in ${artifactPath}: ${detail}`, options)
		this.name = 'StructuralFailure'
		this.code = code
		this.artifactPath = artifactPath
	}
}
