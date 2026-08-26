/** AD-35's default-deny decision over a resolved target, as a pure function. */
import type {
	ProbeTargetAuthorization,
	ProbeTargetPolicy,
} from '../schemas/probe-policy.ts'

/**
 * The classes AD-35 names, plus `public` for everything else and
 * `unparseable`. `unparseable` denies: an address the parser cannot read is
 * one it cannot prove is outside the denied classes.
 */
export const ADDRESS_CLASSES = [
	'loopback',
	'private',
	'link-local',
	'metadata',
	'public',
	'unparseable',
] as const

export type AddressClass = (typeof ADDRESS_CLASSES)[number]

/**
 * Why a target was denied. Detail carried in the message; every one is thrown
 * as the single AD-28 `forbidden-target` fault, so `check:ad28-registry`
 * stays at ten.
 */
export const DENIAL_REASONS = [
	'interface-not-authorized',
	'scheme-not-authorized',
	'host-not-authorized',
	'port-not-authorized',
	'address-not-authorized',
	'address-unparseable',
	'method-not-authorized',
] as const

export type DenialReason = (typeof DENIAL_REASONS)[number]

export type ParsedAddress =
	| {
			readonly ok: true
			readonly family: 4 | 6
			/** the one spelling both sides of every comparison are reduced to. */
			readonly canonical: string
			readonly addressClass: AddressClass
	  }
	| { readonly ok: false }

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

const UNPARSEABLE: ParsedAddress = { ok: false }

// Decimal only, and a leading zero is refused. `inet_aton` reads `010.0.0.1`
// as octal 8.0.0.1 while a naive parse reads 10.0.0.1; one string with two
// readings is the disagreement AD-28 exists to stop. Refusing it makes the
// spelling `unparseable`, which denies.
const IPV4_OCTET_PATTERN = /^(?:0|[1-9][0-9]{0,2})$/
const IPV6_GROUP_PATTERN = /^[0-9a-fA-F]{1,4}$/

/** `fd00:ec2::254` fully expanded, the one IPv6 metadata endpoint AD-35 names. */
const IPV6_METADATA = 'fd00:0ec2:0000:0000:0000:0000:0000:0254'

function parseIpv4Octets(text: string): number[] | undefined {
	const parts = text.split('.')
	if (parts.length !== 4) return undefined
	const octets: number[] = []
	for (const part of parts) {
		if (!IPV4_OCTET_PATTERN.test(part)) return undefined
		const value = Number.parseInt(part, 10)
		if (value > 255) return undefined
		octets.push(value)
	}
	return octets
}

/** IPv6 text pieces to 16-bit groups. A dotted quad is legal in the last piece only, where it spells the low 32 bits. */
function toGroups(
	pieces: readonly string[],
	allowEmbeddedIpv4: boolean,
): number[] | undefined {
	const groups: number[] = []
	for (let index = 0; index < pieces.length; index++) {
		const piece = pieces[index] ?? ''
		if (
			allowEmbeddedIpv4 &&
			index === pieces.length - 1 &&
			piece.includes('.')
		) {
			const octets = parseIpv4Octets(piece)
			if (octets === undefined) return undefined
			groups.push(((octets[0] ?? 0) << 8) | (octets[1] ?? 0))
			groups.push(((octets[2] ?? 0) << 8) | (octets[3] ?? 0))
			continue
		}
		if (!IPV6_GROUP_PATTERN.test(piece)) return undefined
		groups.push(Number.parseInt(piece, 16))
	}
	return groups
}

function parseIpv6Groups(text: string): number[] | undefined {
	const halves = text.split('::')
	if (halves.length > 2) return undefined
	if (halves.length === 1) {
		const groups = toGroups(text.split(':'), true)
		return groups?.length === 8 ? groups : undefined
	}
	const headText = halves[0] ?? ''
	const tailText = halves[1] ?? ''
	const head = toGroups(headText === '' ? [] : headText.split(':'), false)
	const tail = toGroups(tailText === '' ? [] : tailText.split(':'), true)
	if (head === undefined || tail === undefined) return undefined
	// `::` stands for at least one zero group, so a full eight groups either
	// side of it is malformed.
	const fill = 8 - head.length - tail.length
	if (fill < 1) return undefined
	const groups = [...head]
	for (let index = 0; index < fill; index++) groups.push(0)
	groups.push(...tail)
	return groups
}

/** The low 32 bits read as IPv4 octets. */
function lowOctets(groups: readonly number[]): number[] {
	const high = groups[6] ?? 0
	const low = groups[7] ?? 0
	return [high >> 8, high & 0xff, low >> 8, low & 0xff]
}

/** The embedded IPv4 octets of an `::ffff:0:0/96` address, or `undefined` for any other IPv6 address. */
function mappedIpv4Octets(groups: readonly number[]): number[] | undefined {
	for (let index = 0; index < 5; index++) {
		if (groups[index] !== 0) return undefined
	}
	if (groups[5] !== 0xffff) return undefined
	return lowOctets(groups)
}

/**
 * The embedded IPv4 octets of the other two well-known prefixes that carry one
 * in their low 32 bits: `::/96`, RFC 4291's deprecated IPv4-compatible form,
 * and `64:ff9b::/96`, RFC 6052's NAT64 prefix. Both reach the embedded address
 * on a stack that translates them, so `64:ff9b::169.254.169.254` reported as
 * `public` is the same wrong answer the metadata ordering exists to prevent.
 *
 * Classification only. The canonical form stays the expanded IPv6 string, so
 * an authorization naming `127.0.0.1` does not permit `::127.0.0.1`: only
 * `::ffff:0:0/96` rewrites the canonical form, because only that rewrite is
 * required (fixture 34) and any other widening of an exact allowlist should
 * fail closed.
 */
function translatedIpv4Octets(groups: readonly number[]): number[] | undefined {
	const nat64 =
		groups[0] === 0x0064 &&
		groups[1] === 0xff9b &&
		groups[2] === 0 &&
		groups[3] === 0 &&
		groups[4] === 0 &&
		groups[5] === 0
	const compatible =
		groups.slice(0, 6).every((group: number) => group === 0) &&
		!(groups[6] === 0 && (groups[7] === 0 || groups[7] === 1))
	return nat64 || compatible ? lowOctets(groups) : undefined
}

function classifyIpv4(octets: readonly number[]): AddressClass {
	const first = octets[0] ?? 0
	const second = octets[1] ?? 0
	const third = octets[2] ?? 0
	const fourth = octets[3] ?? 0
	// Metadata precedes link-local: 169.254.169.254 sits inside 169.254.0.0/16,
	// and the other ordering reports a cloud metadata endpoint as something
	// milder on the one denial an operator has to read.
	if (first === 169 && second === 254 && third === 169 && fourth === 254) {
		return 'metadata'
	}
	if (first === 127) return 'loopback'
	// The unspecified address routes to local on every stack this package runs
	// on, so it counts as loopback.
	if (first === 0 && second === 0 && third === 0 && fourth === 0) {
		return 'loopback'
	}
	if (first === 169 && second === 254) return 'link-local'
	if (first === 10) return 'private'
	if (first === 172 && second >= 16 && second <= 31) return 'private'
	if (first === 192 && second === 168) return 'private'
	if (first === 100 && second >= 64 && second <= 127) return 'private'
	return 'public'
}

function classifyIpv6(
	groups: readonly number[],
	canonical: string,
): AddressClass {
	// Metadata precedes private for the same reason it precedes link-local in
	// IPv4: fd00:ec2::254 sits inside fc00::/7.
	if (canonical === IPV6_METADATA) return 'metadata'
	const translated = translatedIpv4Octets(groups)
	if (translated !== undefined) return classifyIpv4(translated)
	const allButLastAreZero = groups
		.slice(0, 7)
		.every((group: number) => group === 0)
	const last = groups[7] ?? 0
	if (allButLastAreZero && (last === 0 || last === 1)) return 'loopback'
	if (((groups[0] ?? 0) & 0xffc0) === 0xfe80) return 'link-local'
	if (((groups[0] ?? 0) & 0xfe00) === 0xfc00) return 'private'
	return 'public'
}

function ipv4Address(octets: readonly number[]): ParsedAddress {
	return {
		ok: true,
		family: 4,
		canonical: octets.join('.'),
		addressClass: classifyIpv4(octets),
	}
}

/**
 * Reduces every spelling of one address to a single `canonical` form and
 * classifies it. Three wrappers come off first, in order: a surrounding
 * bracket pair (what `new URL('http://[::1]/').hostname` returns), a `%zone`
 * suffix, then an `::ffff:` prefix, which unwraps to the embedded IPv4 address
 * and is classified as that address in both the dotted and the hex spelling.
 */
export function parseAddress(address: string): ParsedAddress {
	const unbracketed =
		address.startsWith('[') && address.endsWith(']') && address.length >= 2
			? address.slice(1, -1)
			: address
	const zoneAt = unbracketed.indexOf('%')
	const zoned = zoneAt !== -1
	const bare = zoned ? unbracketed.slice(0, zoneAt) : unbracketed
	if (bare.length === 0) return UNPARSEABLE
	if (!bare.includes(':')) {
		// A zone identifier on an IPv4 literal is not an address on any stack,
		// so `127.0.0.1%eth0` is refused instead of quietly becoming
		// `127.0.0.1`.
		if (zoned) return UNPARSEABLE
		const octets = parseIpv4Octets(bare)
		return octets === undefined ? UNPARSEABLE : ipv4Address(octets)
	}
	const groups = parseIpv6Groups(bare)
	if (groups === undefined) return UNPARSEABLE
	const mapped = mappedIpv4Octets(groups)
	if (mapped !== undefined) {
		return zoned ? UNPARSEABLE : ipv4Address(mapped)
	}
	const canonical = groups
		.map((group: number) => group.toString(16).padStart(4, '0'))
		.join(':')
	const addressClass = classifyIpv6(groups, canonical)
	// A zone scopes an address to one interface, and only a link-local address
	// needs that. Elsewhere the `%` is refused, so a zone cannot ride along on
	// an address whose class does not use it. Two zones of one link-local
	// address still share a canonical form: fixture 35 requires an
	// authorization naming `fe80::1` to permit `[fe80:0:0:0:0:0:0:1%eth0]`, so
	// zone-insensitive matching inside `fe80::/10` is the mandated behaviour
	// and `%eth0` and `%eth1` are one entry.
	if (zoned && addressClass !== 'link-local') return UNPARSEABLE
	return { ok: true, family: 6, canonical, addressClass }
}

export function classifyAddress(address: string): AddressClass {
	const parsed = parseAddress(address)
	return parsed.ok ? parsed.addressClass : 'unparseable'
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
	return authorization.safeMethods.some((safe: string) => safe === method)
}
