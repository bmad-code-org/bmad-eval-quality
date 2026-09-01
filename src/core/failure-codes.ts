/** AD-5's twenty-three compile-time failure codes, as data, in the table's order. */

// This lives in `core/`, since it's a plain data tuple and `core/schemas/`
// is reserved for Zod definitions. The compiler that emits these codes lives
// in `core/compile/`, one directory over.
//
// `scripts/check-ad5-registry.ts` checks this tuple against AD-5's own
// registry table under `npm run validate`; the tuple's own invariants
// (twenty-three members, unique, kebab-case) are locked in
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
	'binding-cycle',
	'captured-channel-undeclared',
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
 * AD-5's compile-time failure registry: thrown when a structural error fails
 * compilation (or, for this code, the post-generation brief audit), since no
 * artifact is emitted. Mirrors AD-28's `RuntimeFault` shape (`code`,
 * `artifactPath`) without subclassing it, per the Consistency Conventions'
 * Errors row keeping the two registries disjoint. Lives beside `FAILURE_CODES`
 * because every code in that registry is thrown through it.
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
