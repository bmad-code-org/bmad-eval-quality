/**
 * AD-35's default-deny decision for the `cli` mechanism, as a pure function.
 *
 * Lives under `adapters/` rather than beside `core/probe/target-policy.ts`
 * (the `api` evaluator), even though the two are otherwise siblings: the
 * repository's mechanically-enforced dependency direction permits
 * `adapters/` to import `core/schemas` but not `core/`, so a
 * target-authorization decision an adapter calls has to be adapter-owned
 * infrastructure, not a `core/` module. `target-policy.ts` itself is never
 * imported from `src/adapters/` for the same reason — no shipped `api`
 * adapter exists to call it, which is the gap this file closes for `cli`.
 */
import type {
	CommandTargetAuthorization,
	CommandTargetPolicy,
} from '../core/schemas/probe-policy.ts'

/** Why a command target was denied. Thrown as the single AD-28 `forbidden-target` fault, same as the HTTP reasons. */
export const COMMAND_DENIAL_REASONS = [
	'interface-not-authorized',
	'executable-not-authorized',
	'subcommand-not-authorized',
] as const

export type CommandDenialReason = (typeof COMMAND_DENIAL_REASONS)[number]

export type CommandResolvedTarget = {
	readonly interfaceId: string
	readonly executable: string
	readonly subcommandPath: readonly string[]
}

export type CommandPolicyDecision =
	| {
			readonly allowed: true
			readonly authorization: CommandTargetAuthorization
	  }
	| {
			readonly allowed: false
			readonly reason: CommandDenialReason
			readonly detail: string
	  }

function subcommandPathsMatch(
	a: readonly string[],
	b: readonly string[],
): boolean {
	return (
		a.length === b.length && a.every((segment, index) => segment === b[index])
	)
}

function deny(
	reason: CommandDenialReason,
	detail: string,
): CommandPolicyDecision {
	return { allowed: false, reason, detail }
}

/**
 * The interface-and-executable check runs first, so an unmapped pair never
 * reaches the subcommand comparison. Where several authorizations name one
 * pair, each is tried in declaration order and the first that allows wins;
 * mirrors `evaluateTarget`'s own ordering rule for the same reason.
 */
export function evaluateCommandTarget(
	policy: CommandTargetPolicy,
	target: CommandResolvedTarget,
): CommandPolicyDecision {
	const matchingPair = policy.authorizations.filter(
		(authorization) =>
			authorization.interfaceId === target.interfaceId &&
			authorization.executable === target.executable,
	)
	if (matchingPair.length === 0) {
		return deny(
			policy.authorizations.some(
				(authorization) => authorization.interfaceId === target.interfaceId,
			)
				? 'executable-not-authorized'
				: 'interface-not-authorized',
			`no authorization names interface "${target.interfaceId}" and executable "${target.executable}" together`,
		)
	}
	for (const authorization of matchingPair) {
		if (
			authorization.permittedSubcommandPaths.some((permitted) =>
				subcommandPathsMatch(permitted, target.subcommandPath),
			)
		) {
			return { allowed: true, authorization }
		}
	}
	return deny(
		'subcommand-not-authorized',
		`subcommand path [${target.subcommandPath.join(', ')}] is not among the authorized paths for interface "${target.interfaceId}" and executable "${target.executable}"`,
	)
}
