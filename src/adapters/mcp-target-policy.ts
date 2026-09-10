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
 * comparison and the two denials stay distinguishable. Where several
 * authorizations name one interface, each is tried in declaration order and the
 * first that names the tool wins; mirrors `evaluateTarget` and
 * `evaluateCommandTarget`'s ordering rule for the same reason.
 */
export function evaluateMcpTarget(
	policy: McpTargetPolicy,
	target: McpResolvedTarget,
): McpPolicyDecision {
	const matchingInterface = policy.authorizations.filter(
		(authorization) => authorization.interfaceId === target.interfaceId,
	)
	if (matchingInterface.length === 0) {
		return deny(
			'interface-not-authorized',
			`no authorization names interface "${target.interfaceId}"`,
		)
	}
	for (const authorization of matchingInterface) {
		if (authorization.tools.includes(target.toolName)) {
			return { allowed: true, authorization }
		}
	}
	return deny(
		'tool-not-authorized',
		`tool "${target.toolName}" is not among the authorized tools for interface "${target.interfaceId}"`,
	)
}
