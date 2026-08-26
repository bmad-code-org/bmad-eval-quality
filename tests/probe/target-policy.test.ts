// AD-35's address parser, classifier, and default-deny evaluator, one numbered
// fixture per assertion in Story 6.1 AC 12 (fixtures 1-40). The classifier
// fixtures come in pairs at both sides of a CIDR boundary, and the ordering
// fixtures name an address that sits inside two ranges at once.

import { describe, expect, it } from 'vitest'
import {
	ADDRESS_CLASSES,
	classifyAddress,
	DENIAL_REASONS,
	evaluateTarget,
	isSafeMethod,
	parseAddress,
	type ResolvedTarget,
} from '../../src/core/probe/target-policy.ts'
import type {
	ProbeTargetAuthorization,
	ProbeTargetPolicy,
} from '../../src/core/schemas/probe-policy.ts'

function authorization(
	overrides: Partial<ProbeTargetAuthorization> = {},
): ProbeTargetAuthorization {
	return {
		interfaceId: 'orders',
		scheme: 'http',
		host: 'example.test',
		port: 8080,
		addresses: ['93.184.216.34'],
		methods: ['GET'],
		safeMethods: ['GET'],
		maxRedirects: 1,
		maxElapsedMs: 1000,
		maxRequestBytes: 4096,
		maxResponseBytes: 4096,
		...overrides,
	}
}

function policyOf(
	...authorizations: ProbeTargetAuthorization[]
): ProbeTargetPolicy {
	return { authorizations }
}

function target(overrides: Partial<ResolvedTarget> = {}): ResolvedTarget {
	return {
		interfaceId: 'orders',
		scheme: 'http',
		host: 'example.test',
		port: 8080,
		address: '93.184.216.34',
		method: 'GET',
		...overrides,
	}
}

/** The denial reason, or `'allowed'`. Keeps every policy fixture one assertion wide. */
function outcomeOf(
	policy: ProbeTargetPolicy,
	resolved: ResolvedTarget,
): string {
	const decision = evaluateTarget(policy, resolved)
	return decision.allowed ? 'allowed' : decision.reason
}

describe('parseAddress and classifyAddress: the classes AD-35 names (fixtures 1-20)', () => {
	it('fixture 1: 127.0.0.1 is loopback', () => {
		expect(classifyAddress('127.0.0.1')).toBe('loopback')
	})

	it('fixture 2: 127.5.5.5, anywhere in 127.0.0.0/8, is loopback', () => {
		expect(classifyAddress('127.5.5.5')).toBe('loopback')
		expect(classifyAddress('127.255.255.254')).toBe('loopback')
	})

	it('fixture 3: ::1 is loopback', () => {
		expect(classifyAddress('::1')).toBe('loopback')
	})

	it('fixture 4: 0.0.0.0 and :: are loopback', () => {
		expect(classifyAddress('0.0.0.0')).toBe('loopback')
		expect(classifyAddress('::')).toBe('loopback')
	})

	it('fixture 5: 10.0.0.1 is private', () => {
		expect(classifyAddress('10.0.0.1')).toBe('private')
	})

	it('fixture 6: 172.16.0.1 is private and 172.32.0.1 is public (the /12 boundary, both sides)', () => {
		expect(classifyAddress('172.16.0.1')).toBe('private')
		expect(classifyAddress('172.31.255.255')).toBe('private')
		expect(classifyAddress('172.32.0.1')).toBe('public')
		expect(classifyAddress('172.15.255.255')).toBe('public')
	})

	it('fixture 7: 192.168.1.1 is private', () => {
		expect(classifyAddress('192.168.1.1')).toBe('private')
	})

	it('fixture 8: 100.64.0.1 is private and 100.128.0.1 is public (carrier-grade NAT, both sides)', () => {
		expect(classifyAddress('100.64.0.1')).toBe('private')
		expect(classifyAddress('100.127.255.255')).toBe('private')
		expect(classifyAddress('100.128.0.1')).toBe('public')
		expect(classifyAddress('100.63.255.255')).toBe('public')
	})

	it('fixture 9: fc00::1 is private', () => {
		expect(classifyAddress('fc00::1')).toBe('private')
		expect(classifyAddress('fdff::1')).toBe('private')
	})

	it('fixture 10: 169.254.1.1 is link-local', () => {
		expect(classifyAddress('169.254.1.1')).toBe('link-local')
	})

	it('fixture 11: fe80::1 is link-local', () => {
		expect(classifyAddress('fe80::1')).toBe('link-local')
		expect(classifyAddress('febf::1')).toBe('link-local')
	})

	it('fixture 12: 169.254.169.254 is metadata, not link-local (the ordering, IPv4)', () => {
		expect(classifyAddress('169.254.169.254')).toBe('metadata')
	})

	it('fixture 13: fd00:ec2::254 is metadata, not private (the ordering, IPv6)', () => {
		expect(classifyAddress('fd00:ec2::254')).toBe('metadata')
	})

	it('fixture 14: 93.184.216.34 is public', () => {
		expect(classifyAddress('93.184.216.34')).toBe('public')
	})

	it('fixture 15: 2606:2800:220:1:248:1893:25c8:1946 is public', () => {
		expect(classifyAddress('2606:2800:220:1:248:1893:25c8:1946')).toBe('public')
	})

	it('fixture 16: malformed, alternate-radix, and zero-padded spellings are all unparseable', () => {
		const spellings = [
			'example',
			'1.2.3',
			'999.1.1.1',
			'',
			// One string with two readings is the disagreement AD-28 exists to
			// stop: `inet_aton` reads these as octal, hex, and a packed integer.
			'010.0.0.1',
			'0177.0.0.1',
			'0x7f.0.0.1',
			'2130706433',
			'127.1',
			'127.0.0.1.',
			'127..0.1',
			' 127.0.0.1',
			// A zone identifier scopes an address to an interface, which only a
			// link-local address needs.
			'127.0.0.1%eth0',
			'::ffff:127.0.0.1%eth0',
			'2606:2800:220:1:248:1893:25c8:1946%eth0',
			// An empty zone and a repeated one are malformed. Dropping either
			// would let a spelling no stack accepts match an authorization
			// naming the bare address.
			'fe80::1%',
			'fe80::1%eth0%extra',
		]
		for (const spelling of spellings) {
			expect(classifyAddress(spelling)).toBe('unparseable')
			expect(parseAddress(spelling).ok).toBe(false)
		}
	})

	it('fixture 17: ::ffff: unwraps to the embedded IPv4 address across four classes, in both spellings', () => {
		expect(classifyAddress('::ffff:127.0.0.1')).toBe('loopback')
		expect(classifyAddress('::ffff:7f00:1')).toBe('loopback')
		expect(classifyAddress('::ffff:169.254.169.254')).toBe('metadata')
		expect(classifyAddress('::ffff:10.0.0.1')).toBe('private')
		const unwrapped = parseAddress('::ffff:7f00:1')
		expect(unwrapped.ok && unwrapped.family).toBe(4)
		expect(unwrapped.ok && unwrapped.canonical).toBe('127.0.0.1')
	})

	it('fixture 18: [::1] and [::ffff:127.0.0.1] strip brackets and classify as loopback', () => {
		expect(classifyAddress('[::1]')).toBe('loopback')
		expect(classifyAddress('[::ffff:127.0.0.1]')).toBe('loopback')
	})

	it('fixture 19: fe80::1%eth0 strips the zone and is link-local', () => {
		expect(classifyAddress('fe80::1%eth0')).toBe('link-local')
		const zoned = parseAddress('fe80::1%eth0')
		const bare = parseAddress('fe80::1')
		expect(zoned.ok && bare.ok && zoned.canonical).toBe(
			bare.ok ? bare.canonical : 'unparsed',
		)
	})

	it('fixture 20a: ::/96 and 64:ff9b::/96 classify by the embedded IPv4 without widening the allowlist', () => {
		// Classification only. `::127.0.0.1` reaching loopback on a translating
		// stack is why the class matters; the canonical form stays IPv6, so an
		// authorization naming `127.0.0.1` does not permit it.
		expect(classifyAddress('::127.0.0.1')).toBe('loopback')
		expect(classifyAddress('::7f00:1')).toBe('loopback')
		expect(classifyAddress('64:ff9b::169.254.169.254')).toBe('metadata')
		expect(classifyAddress('64:ff9b::10.0.0.1')).toBe('private')
		const compatible = parseAddress('::127.0.0.1')
		expect(compatible.ok && compatible.family).toBe(6)
		expect(compatible.ok && compatible.canonical).toBe(
			'0000:0000:0000:0000:0000:0000:7f00:0001',
		)
		expect(
			outcomeOf(
				policyOf(authorization({ addresses: ['127.0.0.1'] })),
				target({ address: '::127.0.0.1' }),
			),
		).toBe('address-not-authorized')
		// `::` and `::1` keep their own row in AC 4's table.
		expect(classifyAddress('::')).toBe('loopback')
		expect(classifyAddress('::1')).toBe('loopback')
	})

	it('fixture 20: fe80::1 and fe80:0:0:0:0:0:0:1 produce the same canonical string', () => {
		const compressed = parseAddress('fe80::1')
		const expanded = parseAddress('fe80:0:0:0:0:0:0:1')
		expect(compressed.ok).toBe(true)
		expect(expanded.ok).toBe(true)
		expect(compressed.ok && compressed.canonical).toBe(
			expanded.ok ? expanded.canonical : 'unparsed',
		)
	})
})

describe('evaluateTarget: AD-35 default-deny, one step at a time (fixtures 21-40)', () => {
	it('fixture 21: ADDRESS_CLASSES and DENIAL_REASONS are the exact tuples AC 4 states', () => {
		expect(ADDRESS_CLASSES).toEqual([
			'loopback',
			'private',
			'link-local',
			'metadata',
			'public',
			'unparseable',
		])
		expect(DENIAL_REASONS).toEqual([
			'interface-not-authorized',
			'scheme-not-authorized',
			'host-not-authorized',
			'port-not-authorized',
			'address-not-authorized',
			'address-unparseable',
			'method-not-authorized',
		])
	})

	it('fixture 22: an empty policy denies with interface-not-authorized', () => {
		expect(outcomeOf(policyOf(), target())).toBe('interface-not-authorized')
	})

	it('fixture 23: an unmapped interfaceId denies against an address that would otherwise be authorized', () => {
		const policy = policyOf(authorization())
		expect(outcomeOf(policy, target())).toBe('allowed')
		expect(outcomeOf(policy, target({ interfaceId: 'other' }))).toBe(
			'interface-not-authorized',
		)
	})

	it('fixture 24: scheme mismatch denies with scheme-not-authorized', () => {
		expect(
			outcomeOf(policyOf(authorization()), target({ scheme: 'https' })),
		).toBe('scheme-not-authorized')
	})

	it('fixture 25: host mismatch denies with host-not-authorized', () => {
		expect(
			outcomeOf(policyOf(authorization()), target({ host: 'other.test' })),
		).toBe('host-not-authorized')
	})

	it('fixture 26: host matches case-insensitively', () => {
		expect(
			outcomeOf(policyOf(authorization()), target({ host: 'EXAMPLE.test' })),
		).toBe('allowed')
	})

	it('fixture 27: a single trailing dot matches the authorized host', () => {
		expect(
			outcomeOf(policyOf(authorization()), target({ host: 'example.test.' })),
		).toBe('allowed')
		expect(
			outcomeOf(
				policyOf(authorization({ host: 'example.test.' })),
				target({ host: 'example.test' }),
			),
		).toBe('allowed')
	})

	it('fixture 28: port mismatch denies with port-not-authorized', () => {
		expect(outcomeOf(policyOf(authorization()), target({ port: 9090 }))).toBe(
			'port-not-authorized',
		)
	})

	it('fixture 29: an unparseable address denies with address-unparseable', () => {
		const decision = evaluateTarget(
			policyOf(authorization()),
			target({ address: 'not-an-address' }),
		)
		expect(decision.allowed).toBe(false)
		expect(!decision.allowed && decision.reason).toBe('address-unparseable')
		expect(!decision.allowed && decision.addressClass).toBe('unparseable')
	})

	it('fixture 30: an authorized address is allowed and the decision carries the matched authorization', () => {
		const authorized = authorization()
		const decision = evaluateTarget(policyOf(authorized), target())
		expect(decision.allowed).toBe(true)
		expect(decision.allowed && decision.authorization).toBe(authorized)
		expect(decision.allowed && decision.canonicalAddress).toBe('93.184.216.34')
		expect(decision.allowed && decision.addressClass).toBe('public')
	})

	it('fixture 31: loopback authorized explicitly is allowed (the carve-out, positive)', () => {
		const decision = evaluateTarget(
			policyOf(authorization({ addresses: ['127.0.0.1'] })),
			target({ address: '127.0.0.1' }),
		)
		expect(decision.allowed).toBe(true)
		expect(decision.allowed && decision.addressClass).toBe('loopback')
	})

	it('fixture 32: loopback not named in addresses is denied (the carve-out, negative)', () => {
		const decision = evaluateTarget(
			policyOf(authorization()),
			target({ address: '127.0.0.1' }),
		)
		expect(!decision.allowed && decision.reason).toBe('address-not-authorized')
		expect(!decision.allowed && decision.addressClass).toBe('loopback')
	})

	it('fixture 33: a metadata address not named is denied and the decision reads metadata', () => {
		const decision = evaluateTarget(
			policyOf(authorization()),
			target({ address: '169.254.169.254' }),
		)
		expect(!decision.allowed && decision.reason).toBe('address-not-authorized')
		expect(!decision.allowed && decision.addressClass).toBe('metadata')
		expect(!decision.allowed && decision.detail).toContain('metadata')
	})

	it('fixture 34: ::ffff:127.0.0.1 is allowed by an authorization naming 127.0.0.1', () => {
		const policy = policyOf(authorization({ addresses: ['127.0.0.1'] }))
		const decision = evaluateTarget(
			policy,
			target({ address: '::ffff:127.0.0.1' }),
		)
		expect(decision.allowed).toBe(true)
		expect(decision.allowed && decision.canonicalAddress).toBe('127.0.0.1')
		expect(outcomeOf(policy, target({ address: '[::ffff:127.0.0.1]' }))).toBe(
			'allowed',
		)
		expect(outcomeOf(policy, target({ address: '::ffff:7f00:1' }))).toBe(
			'allowed',
		)
	})

	it('fixture 35: an authorization naming fe80::1 allows [fe80:0:0:0:0:0:0:1%eth0]', () => {
		const decision = evaluateTarget(
			policyOf(authorization({ addresses: ['fe80::1'] })),
			target({ address: '[fe80:0:0:0:0:0:0:1%eth0]' }),
		)
		expect(decision.allowed).toBe(true)
		expect(decision.allowed && decision.addressClass).toBe('link-local')
	})

	it('fixture 36: a method not in methods denies with method-not-authorized', () => {
		expect(
			outcomeOf(policyOf(authorization()), target({ method: 'POST' })),
		).toBe('method-not-authorized')
	})

	it('fixture 37: a request violating scheme and method reports scheme-not-authorized', () => {
		expect(
			outcomeOf(
				policyOf(authorization()),
				target({ scheme: 'https', method: 'POST' }),
			),
		).toBe('scheme-not-authorized')
	})

	it('fixture 38: two authorizations for one interfaceId, the second allows', () => {
		const first = authorization({ port: 9090 })
		const second = authorization()
		const decision = evaluateTarget(policyOf(first, second), target())
		expect(decision.allowed).toBe(true)
		expect(decision.allowed && decision.authorization).toBe(second)
	})

	it('fixture 39: two authorizations, neither allows: the denial is the first’s', () => {
		const first = authorization({ port: 9090 })
		const second = authorization({ scheme: 'https' })
		const decision = evaluateTarget(
			policyOf(first, second),
			target({ scheme: 'http', port: 7070 }),
		)
		expect(!decision.allowed && decision.reason).toBe('port-not-authorized')
	})

	it('fixture 40: isSafeMethod requires membership in both lists', () => {
		const both = authorization({
			methods: ['GET', 'POST'],
			safeMethods: ['GET'],
		})
		expect(isSafeMethod(both, 'GET')).toBe(true)
		expect(isSafeMethod(both, 'POST')).toBe(false)
		expect(isSafeMethod(authorization({ safeMethods: [] }), 'GET')).toBe(false)
		// The schema carries no subset refinement (AC 3), so a mapping can mark
		// a method safe that it never authorized. Answering `true` there would
		// let a differential pick a method evaluateTarget goes on to deny.
		const contradictory = authorization({
			methods: ['GET'],
			safeMethods: ['POST'],
		})
		expect(isSafeMethod(contradictory, 'POST')).toBe(false)
		expect(outcomeOf(policyOf(contradictory), target({ method: 'POST' }))).toBe(
			'method-not-authorized',
		)
	})
})
