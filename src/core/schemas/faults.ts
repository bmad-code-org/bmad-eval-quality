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

/**
 * Why a target was refused, carried as `reason` on a `forbidden-target` fault.
 * The union of every mechanism's denial vocabulary: `DENIAL_REASONS` for
 * `api` (`core/probe/target-policy.ts`), `COMMAND_DENIAL_REASONS` for `cli`,
 * and `MCP_DENIAL_REASONS` for `mcp` (both under `adapters/`). It lives here
 * beside `RuntimeFault` because `adapters/` may import `core/schemas` and
 * never `core/`, and each of those tuples `satisfies` this one, so a new
 * mechanism reason fails the typecheck until it is added here too.
 */
export const FORBIDDEN_TARGET_REASONS = [
	'interface-not-authorized',
	'scheme-not-authorized',
	'host-not-authorized',
	'port-not-authorized',
	'address-not-authorized',
	'address-unparseable',
	'method-not-authorized',
	'executable-not-authorized',
	'subcommand-not-authorized',
	'environment-key-not-authorized',
	'tool-not-authorized',
] as const

export type ForbiddenTargetReason = (typeof FORBIDDEN_TARGET_REASONS)[number]

export class RuntimeFault extends Error {
	readonly code: RuntimeFaultCode
	readonly artifactPath: string
	/**
	 * Which rule refused the target, on a `forbidden-target` fault a policy
	 * denial threw, so a caller records the denial without parsing the message.
	 * `undefined` on every other fault: only the `forbidden-target` constructor
	 * signature accepts it, so no other code can carry one.
	 */
	readonly reason: ForbiddenTargetReason | undefined

	constructor(
		code: 'forbidden-target',
		artifactPath: string,
		detail: string,
		options?: { cause?: unknown; reason?: ForbiddenTargetReason },
	)
	constructor(
		code: RuntimeFaultCode,
		artifactPath: string,
		detail: string,
		options?: { cause?: unknown },
	)
	constructor(
		code: RuntimeFaultCode,
		artifactPath: string,
		detail: string,
		options?: { cause?: unknown; reason?: ForbiddenTargetReason },
	) {
		super(`${code} in ${artifactPath}: ${detail}`, options)
		this.name = 'RuntimeFault'
		this.code = code
		this.artifactPath = artifactPath
		this.reason = options?.reason
	}
}
