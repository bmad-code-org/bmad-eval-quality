// Runtime fault registry (AD-28): thrown, typed errors carrying a stable
// machine code and the artifact path that produced them. Disjoint from AD-5's
// compile-time registry; they share only this base shape, never a code table.
//
// The complete normative ten-code AD-28 table, in the spine's exact order.
// `scripts/check-ad28-registry.ts` asserts this tuple stays set- and order-
// equal to that table under `npm run validate` (mirroring
// `scripts/check-ad5-registry.ts` for `FAILURE_CODES`). A code with no
// thrower yet is not a defect: AD-28 fixes the registry independently of
// implementation order, exactly as AD-5 does for `FAILURE_CODES`.
export const RUNTIME_FAULT_CODES = [
	'schema-parse-failure',
	'schema-version-mismatch',
	'non-canonicalizable-value',
	'digest-mismatch',
	'budget-exhausted',
	'port-failure',
	'port-contract-violation',
	'forbidden-target',
	'aborted',
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
