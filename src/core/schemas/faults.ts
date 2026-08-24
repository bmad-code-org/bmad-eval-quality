// Runtime fault registry (AD-28): thrown, typed errors carrying a stable
// machine code and the artifact path that produced them. Disjoint from AD-5's
// compile-time registry; they share only this base shape, never a code table.
//
// Unlike `FAILURE_CODES` (core/failure-codes.ts), which mirrors all
// twenty-one AD-5 codes so `scripts/check-ad5-registry.ts` can assert
// set-and-order equality against the spine, this table holds only codes with
// a genuine thrower: four of AD-28's ten rows as of this story. A future
// `check:ad28-registry` script could only assert a subset relationship, and
// none exists yet.
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
