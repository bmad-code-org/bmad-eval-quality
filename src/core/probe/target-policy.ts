/** AD-35's default-deny decision over a resolved target, as a pure function. */
import type { ForbiddenTargetReason } from '../schemas/faults.ts'
import {
	ADDRESS_CLASSES,
	type AddressClass,
	type ParsedAddress,
	parseAddress,
} from '../schemas/probe-address.ts'
import type {
	ProbeTargetAuthorization,
	ProbeTargetPolicy,
} from '../schemas/probe-policy.ts'

export type { AddressClass, ParsedAddress }
// The address grammar lives in `core/schemas/` so the policy schema can use it;
// it is re-exported here so every existing importer keeps its path.
export { ADDRESS_CLASSES, parseAddress }

/**
 * Why a target was denied. Detail carried in the message; every one is thrown
 * as the single AD-28 `forbidden-target` fault, so `check:ad28-registry`
 * stays at ten, and a port passes the decision's reason as the fault's
 * `reason`.
 */
export const DENIAL_REASONS = [
	'interface-not-authorized',
	'scheme-not-authorized',
	'host-not-authorized',
	'port-not-authorized',
	'address-not-authorized',
	'address-unparseable',
	'method-not-authorized',
] as const satisfies readonly ForbiddenTargetReason[]

export type DenialReason = (typeof DENIAL_REASONS)[number]

export type ResolvedTarget = {
	readonly interfaceId: string
	readonly scheme: string
	readonly host: string
	readonly port: number
	readonly address: string
	readonly method: string
}

export type PolicyDecision =
	| {
			readonly allowed: true
			readonly authorization: ProbeTargetAuthorization
			readonly addressClass: AddressClass
			readonly canonicalAddress: string
	  }
	| {
			readonly allowed: false
			readonly reason: DenialReason
			readonly detail: string
			readonly addressClass: AddressClass
	  }

export function classifyAddress(address: string): AddressClass {
	const parsed = parseAddress(address)
	return parsed.ok ? parsed.addressClass : 'unparseable'
}

/** `::1` and `::` fully expanded, the two IPv6 addresses that stay on the host. */
const IPV6_LOOPBACK = '0000:0000:0000:0000:0000:0000:0000:0001'
const IPV6_UNSPECIFIED = '0000:0000:0000:0000:0000:0000:0000:0000'

/**
 * Whether a connection to a literal address stays on the local host: IPv4
 * `127.0.0.0/8`, IPv6 `::1`, the `::ffff:` spelling of a `127.0.0.0/8`
 * address, and the unspecified addresses `0.0.0.0` and `::`, which
 * `classifyAddress` already counts as loopback because they route to local on
 * every stack this package runs on. `false` for every other address and for
 * one `parseAddress` cannot read.
 *
 * Narrower than `classifyAddress(address) === 'loopback'`. `classifyAddress`
 * reads the NAT64 form (`64:ff9b::7f00:1`) and the IPv4-compatible form
 * (`::127.0.0.1`) as their embedded IPv4 address, the right answer for a
 * denial. A connection to either goes through a translator first, so it
 * leaves the host whatever address it carries.
 */
export function staysOnHost(address: string): boolean {
	const parsed = parseAddress(address)
	if (!parsed.ok || parsed.addressClass !== 'loopback') return false
	// `::ffff:` spellings were rewritten to IPv4 by `parseAddress`, so an IPv6
	// canonical form classed loopback is `::1`, `::`, or a translated form.
	if (parsed.family === 4) return true
	return (
		parsed.canonical === IPV6_LOOPBACK || parsed.canonical === IPV6_UNSPECIFIED
	)
}

// DNS is case-insensitive and `example.test.` and `example.test` are one name,
// so a mixed-case or dot-suffixed redirect target would otherwise walk past
// the host check. One trailing dot only: `example.test..` spells nothing.
function normalizeHost(host: string): string {
	const lowered = host.toLowerCase()
	return lowered.endsWith('.') ? lowered.slice(0, -1) : lowered
}

function deny(
	reason: DenialReason,
	detail: string,
	addressClass: AddressClass,
): PolicyDecision {
	return { allowed: false, reason, detail, addressClass }
}

function evaluateAgainst(
	authorization: ProbeTargetAuthorization,
	target: ResolvedTarget,
	addressClass: AddressClass,
): PolicyDecision {
	if (authorization.scheme !== target.scheme) {
		return deny(
			'scheme-not-authorized',
			`scheme "${target.scheme}" is not the authorized "${authorization.scheme}"`,
			addressClass,
		)
	}
	if (normalizeHost(authorization.host) !== normalizeHost(target.host)) {
		return deny(
			'host-not-authorized',
			`host "${target.host}" is not the authorized "${authorization.host}"`,
			addressClass,
		)
	}
	if (authorization.port !== target.port) {
		return deny(
			'port-not-authorized',
			`port ${target.port} is not the authorized ${authorization.port}`,
			addressClass,
		)
	}
	const parsed = parseAddress(target.address)
	if (!parsed.ok) {
		return deny(
			'address-unparseable',
			`address "${target.address}" could not be parsed, so it cannot be proven outside a denied class`,
			'unparseable',
		)
	}
	// Parsed on both sides. An authorization naming `127.0.0.1` matches
	// `::ffff:127.0.0.1` and `[::ffff:127.0.0.1]`; a string comparison sees
	// three different addresses.
	const named = authorization.addresses.some((entry: string) => {
		const parsedEntry = parseAddress(entry)
		return parsedEntry.ok && parsedEntry.canonical === parsed.canonical
	})
	if (!named) {
		return deny(
			'address-not-authorized',
			`address "${target.address}" (${parsed.canonical}, class ${parsed.addressClass}) is named by no authorized address`,
			parsed.addressClass,
		)
	}
	if (
		!authorization.methods.some((method: string) => method === target.method)
	) {
		return deny(
			'method-not-authorized',
			`method "${target.method}" is not among the authorized methods`,
			parsed.addressClass,
		)
	}
	return {
		allowed: true,
		authorization,
		addressClass: parsed.addressClass,
		canonicalAddress: parsed.canonical,
	}
}

/**
 * AD-35's default-deny evaluation. The interface check runs first, so an
 * unmapped interface never reaches address arithmetic. Where several
 * authorizations name one interface, each is tried in declaration order and
 * the first that allows wins; if none allows, the reported denial is the first
 * one's, so the reason names a target the mapping actually declares.
 */
export function evaluateTarget(
	policy: ProbeTargetPolicy,
	target: ResolvedTarget,
): PolicyDecision {
	const addressClass = classifyAddress(target.address)
	let firstDenial: PolicyDecision | undefined
	for (const authorization of policy.authorizations) {
		if (authorization.interfaceId !== target.interfaceId) continue
		const decision = evaluateAgainst(authorization, target, addressClass)
		if (decision.allowed) return decision
		firstDenial ??= decision
	}
	return (
		firstDenial ??
		deny(
			'interface-not-authorized',
			`no authorization names interface "${target.interfaceId}"`,
			addressClass,
		)
	)
}

/** AD-35 scopes a differential body-sensitivity probe to the methods the mapping marks safe. An empty `safeMethods` means none of them. */
export function isSafeMethod(
	authorization: ProbeTargetAuthorization,
	method: string,
): boolean {
	// Membership in both lists. `safeMethods` is declared without a subset
	// refinement, so a mapping may mark a method safe that it never authorized;
	// answering `true` there would let a differential select a method
	// `evaluateTarget` goes on to deny.
	return (
		authorization.methods.some((allowed: string) => allowed === method) &&
		authorization.safeMethods.some((safe: string) => safe === method)
	)
}
