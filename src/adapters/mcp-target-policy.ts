/**
 * AD-35's default-deny decision for the `mcp` mechanism, as a pure function.
 *
 * Lives under `adapters/` for the reason `command-target-policy.ts` records
 * for itself: the mechanically-enforced dependency direction permits
 * `adapters/` to import `core/schemas` and never `core/`, so a
 * target-authorization decision a shipped adapter calls has to be
 * adapter-owned. The declared shapes stay in `core/schemas/probe-policy.ts`
 * beside the other two, which keeps all three mappings comparable in one file.
 */
import type {
	McpTargetAuthorization,
	McpTargetPolicy,
} from '../core/schemas/probe-policy.ts'

/** Why a tool server target was denied. Thrown as the single AD-28 `forbidden-target` fault, same as the HTTP and command reasons. */
export const MCP_DENIAL_REASONS = [
	'interface-not-authorized',
	'tool-not-authorized',
] as const

export type McpDenialReason = (typeof MCP_DENIAL_REASONS)[number]

export type McpResolvedTarget = {
	readonly interfaceId: string
	readonly toolName: string
}

export type McpPolicyDecision =
	| {
			readonly allowed: true
			readonly authorization: McpTargetAuthorization
	  }
	| {
			readonly allowed: false
			readonly reason: McpDenialReason
			readonly detail: string
	  }

function deny(reason: McpDenialReason, detail: string): McpPolicyDecision {
	return { allowed: false, reason, detail }
}

/**
 * The interface check runs first, so an unmapped server never reaches the tool
 * comparison and the two denials stay distinguishable.
 *
 * The first authorization naming the interface is the only one consulted, and
 * `McpTargetPolicy` refuses a second entry naming it. For this mechanism the
 * interface identifier is the server identity, so searching on past a
 * non-matching tool list would let one logical interface resolve to a second
 * binary depending on which tool was asked for. `evaluateCommandTarget` does
 * search on, and can: its entries are keyed by `(interfaceId, executable)`, so
 * every candidate it considers runs the same executable.
 */
export function evaluateMcpTarget(
	policy: McpTargetPolicy,
	target: McpResolvedTarget,
): McpPolicyDecision {
	const authorization = policy.authorizations.find(
		(candidate) => candidate.interfaceId === target.interfaceId,
	)
	if (authorization === undefined) {
		return deny(
			'interface-not-authorized',
			`no authorization names interface "${target.interfaceId}"`,
		)
	}
	if (authorization.tools.includes(target.toolName)) {
		return { allowed: true, authorization }
	}
	return deny(
		'tool-not-authorized',
		`tool "${target.toolName}" is not among the authorized tools for interface "${target.interfaceId}"`,
	)
}
