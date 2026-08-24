// Runtime fault registry (AD-28): thrown, typed errors carrying a stable machine
// code and the path of the artifact that produced them. Disjoint from AD-5's
// compile-time code registry — the two share at most this base shape, never a
// code table. Only codes with a genuine thrower belong here.
//
// This is NOT a full mirror of AD-28's table the way `FAILURE_CODES`
// (`core/failure-codes.ts`) mirrors AD-5's: `FAILURE_CODES` holds all
// twenty-one AD-5 codes in table order, which is what lets
// `scripts/check-ad5-registry.ts` assert set-and-order equality against the
// spine. `RUNTIME_FAULT_CODES` holds only the codes with a genuine thrower, by
// this file's own header rule above — four of AD-28's ten table rows as of
// this story. A future `check:ad28-registry` analog could therefore only
// assert a subset relationship (every member here spells a real AD-28 row
// correctly), never full set-and-order equality — a materially weaker check
// than `check-ad5-registry.ts` performs. Building that checker is real,
// separate scope, not taken on here; there is no `check:ad28-registry` script
// today, unlike AD-5's `check:ad5-registry`.
export const RUNTIME_FAULT_CODES = [
	'non-canonicalizable-value',
	'schema-parse-failure',
	'budget-exhausted',
	'operator-cannot-accept-operand',
] as const

export type RuntimeFaultCode = (typeof RUNTIME_FAULT_CODES)[number]

export class RuntimeFault extends Error {
	readonly code: RuntimeFaultCode
	readonly artifactPath: string

	constructor(
		code: RuntimeFaultCode,
		artifactPath: string,
		detail: string,
		options?: { cause?: unknown },
	) {
		super(`${code} in ${artifactPath}: ${detail}`, options)
		this.name = 'RuntimeFault'
		this.code = code
		this.artifactPath = artifactPath
	}
}
