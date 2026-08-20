/** AD-5's twenty compile-time failure codes, as data, in the table's order. */

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
// invariants (twenty members, unique, kebab-case) are locked in
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
] as const

export type FailureCode = (typeof FAILURE_CODES)[number]
