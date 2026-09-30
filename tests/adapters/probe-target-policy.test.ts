import { describe, expect, it } from 'vitest'
import { parseProbeTargetPolicy } from '../../src/adapters/probe-target-policy.ts'
import { parseAddress } from '../../src/core/probe/target-policy.ts'
import type {
	ProbeTargetAuthorization,
	ProbeTargetPolicy,
} from '../../src/core/schemas/probe-policy.ts'
import {
	expectUnreadableRefusals,
	issuesOf,
	refusal,
	unrecognized,
} from './fixtures/policy-refusal.ts'

function authorization(
	overrides: Partial<ProbeTargetAuthorization> = {},
): ProbeTargetAuthorization {
	return {
		interfaceId: 'orders',
		scheme: 'https',
		host: 'orders.example.test',
		port: 8443,
		addresses: ['93.184.216.34'],
		methods: ['GET', 'POST'],
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

// The runtime surface for an HTTP mapping loaded from disk. It holds the
// boundary `parseCommandTargetPolicy` and `parseMcpTargetPolicy` hold: a deep
// copy, strict objects, one fault shape, and hostile input refused. A consumer
// holds its HTTP registry to the engine's own field rules through it.
describe('parseProbeTargetPolicy', () => {
	const PATH = 'ProbeTargetPolicy'
	const parse = parseProbeTargetPolicy
	const refused = (value: unknown) => refusal(parse, PATH, value)
	const issues = (value: unknown) => issuesOf(parse, PATH, value)

	it('returns a deep copy of a valid mapping', () => {
		const policy = policyOf(authorization(), authorization({ port: 80 }))
		const snapshot = structuredClone(policy)
		const parsed = parse(policy)
		expect(parsed).toEqual(policy)
		// No object or array reachable from the result is one the input holds.
		const inputNodes = new Set(containers(policy))
		for (const node of containers(parsed)) {
			expect(inputNodes.has(node)).toBe(false)
		}
		// And the copy stays put when the caller mutates the input afterwards.
		for (const each of policy.authorizations) {
			each.addresses.push('10.0.0.1')
			each.methods.push('DELETE')
			each.safeMethods.push('HEAD')
			each.port = 1
		}
		policy.authorizations.pop()
		expect(parsed).toEqual(snapshot)
	})

	it('holds no state between calls', () => {
		const policy = policyOf(authorization(), authorization({ port: 80 }))
		const first = parse(policy)
		const second = parse(policy)
		expect(second).toEqual(first)
		expect(second).not.toBe(first)
		expect(second.authorizations[0]).not.toBe(first.authorizations[0])
		// Mutating one result leaves the next parse reading the input afresh.
		first.authorizations[0]?.addresses.push('10.0.0.1')
		first.authorizations.pop()
		expect(parse(policy)).toEqual(policy)
		// A refusal leaves nothing behind: the valid input after a hostile one
		// parses as if it were the first call.
		for (const hostile of [
			{ authorizations: [{ ...authorization(), port: 0 }] },
			Object.defineProperty({}, 'authorizations', {
				enumerable: true,
				get: () => {
					throw new Error('boom')
				},
			}),
		]) {
			refused(hostile)
			expect(parse(policy)).toEqual(policy)
		}
	})

	it('accepts the default-deny base case and the boundary values', () => {
		expect(parse({ authorizations: [] })).toEqual({ authorizations: [] })
		const edge = authorization({
			scheme: 'http',
			port: 65535,
			safeMethods: [],
			maxRedirects: 0,
			maxElapsedMs: 1,
			maxRequestBytes: 1,
			maxResponseBytes: 1,
		})
		expect(parse(policyOf(edge))).toEqual(policyOf(edge))
		expect(parse(policyOf(authorization({ port: 1 })))).toEqual(
			policyOf(authorization({ port: 1 })),
		)
	})

	const REFUSED: readonly (readonly [
		string,
		Record<string, unknown>,
		string,
	])[] = [
		['a scheme outside http and https', { scheme: 'ftp' }, 'scheme'],
		['an empty host', { host: '' }, 'host'],
		['port 0', { port: 0 }, 'port'],
		['a port past 65535', { port: 65536 }, 'port'],
		['a fractional port', { port: 80.5 }, 'port'],
		['an empty address list', { addresses: [] }, 'addresses'],
		['an empty address', { addresses: ['93.184.216.34', ''] }, 'addresses/1'],
		['an empty method list', { methods: [] }, 'methods'],
		['a lowercase method', { methods: ['get'] }, 'methods/0'],
		[
			'a safeMethods entry outside the seven methods',
			{ safeMethods: ['TRACE'] },
			'safeMethods/0',
		],
		[
			'a hostname in addresses',
			{ addresses: ['orders.example.test'] },
			'addresses/0',
		],
		['an octal-looking address', { addresses: ['010.0.0.1'] }, 'addresses/0'],
		['a fifth IPv4 octet', { addresses: ['1.2.3.4.5'] }, 'addresses/0'],
		['a malformed IPv6 literal', { addresses: ['1::2::3'] }, 'addresses/0'],
		[
			'a zone on an IPv4 literal',
			{ addresses: ['127.0.0.1%eth0'] },
			'addresses/0',
		],
		[
			'a port inside an address',
			{ addresses: ['127.0.0.1:80'] },
			'addresses/0',
		],
		['a negative redirect cap', { maxRedirects: -1 }, 'maxRedirects'],
		['a fractional redirect cap', { maxRedirects: 1.5 }, 'maxRedirects'],
		['a zero elapsed ceiling', { maxElapsedMs: 0 }, 'maxElapsedMs'],
		['a zero request ceiling', { maxRequestBytes: 0 }, 'maxRequestBytes'],
		['a zero response ceiling', { maxResponseBytes: 0 }, 'maxResponseBytes'],
		[
			'an interface id that is no slug',
			{ interfaceId: 'Not A Slug' },
			'interfaceId',
		],
	]

	it.each(REFUSED)(
		'refuses %s at its RFC 6901 pointer',
		(_label, override, pointer) => {
			const value = policyOf({
				...authorization(),
				...override,
			} as ProbeTargetAuthorization)
			const found = issues(value)
			expect(found.map((issue) => issue.path.join('/'))).toEqual([
				`authorizations/0/${pointer}`,
			])
			expect(refused(value).message).toContain(`/authorizations/0/${pointer}:`)
		},
	)

	it.each(Object.keys(authorization()))(
		'refuses an authorization without %s',
		(field) => {
			const { [field]: _omitted, ...without } = authorization() as Record<
				string,
				unknown
			>
			expect(field in without).toBe(false)
			const value = { authorizations: [without] }
			expect(issues(value).map((issue) => issue.path.join('/'))).toEqual([
				`authorizations/0/${field}`,
			])
			expect(refused(value).message).toContain(`/authorizations/0/${field}:`)
		},
	)

	// The grammar `evaluateTarget` reads an address with is the one the parser
	// refuses by, so an entry the parser accepts is one a decision can match.
	it('accepts exactly the address spellings evaluateTarget can read', () => {
		const spellings = [
			'93.184.216.34',
			'127.0.0.1',
			'::1',
			'[::1]',
			'::ffff:127.0.0.1',
			'fe80::1%eth0',
			'2001:db8::1',
			'fd00:ec2::254',
			'orders.example.test',
			'010.0.0.1',
			'127.0.0.1:80',
			'1::2::3',
			'fe80::1%',
			'127.0.0.1%eth0',
			'999.0.0.1',
		]
		for (const spelling of spellings) {
			const value = policyOf(authorization({ addresses: [spelling] }))
			if (parseAddress(spelling).ok) {
				expect(parse(value), spelling).toEqual(value)
			} else {
				expect(issues(value).map((issue) => issue.path.join('/'))).toEqual([
					'authorizations/0/addresses/0',
				])
			}
		}
		expect(spellings.filter((each) => parseAddress(each).ok)).toHaveLength(8)
	})

	it('says why an unreadable address is refused', () => {
		const value = policyOf(
			authorization({ addresses: ['93.184.216.34', 'orders.example.test'] }),
		)
		expect(refused(value).message).toContain(
			'/authorizations/0/addresses/1: is not an IPv4 or IPv6 address literal',
		)
	})

	it('names the failing authorization by its index', () => {
		const value = policyOf(authorization(), authorization({ port: 0 }))
		expect(issues(value).map((issue) => issue.path)).toEqual([
			['authorizations', 1, 'port'],
		])
	})

	it('reports every failing field in the cause and as a pointer in the message', () => {
		const value = policyOf(
			authorization({ port: 0, methods: [], maxElapsedMs: 0 }),
		)
		expect(
			issues(value)
				.map((issue) => issue.path.join('/'))
				.sort(),
		).toEqual([
			'authorizations/0/maxElapsedMs',
			'authorizations/0/methods',
			'authorizations/0/port',
		])
		const message = refused(value).message
		for (const pointer of [
			'/authorizations/0/maxElapsedMs:',
			'/authorizations/0/methods:',
			'/authorizations/0/port:',
		]) {
			expect(message).toContain(pointer)
		}
	})

	it('refuses an unknown key at the root and inside an authorization', () => {
		expect(unrecognized(issues({ authorizations: [], extra: true }))).toEqual([
			{ path: [], keys: ['extra'] },
		])
		const nested = { authorizations: [{ ...authorization(), hosts: [] }] }
		expect(unrecognized(issues(nested))).toEqual([
			{ path: ['authorizations', 0], keys: ['hosts'] },
		])
		expect(refused(nested).message).toContain(
			'/authorizations/0: Unrecognized key: "hosts"',
		)
	})

	// Zod 4's strict-object loop skips an own `__proto__` without an issue, and
	// `JSON.parse` creates exactly that key. An HTTP authorization carries no
	// record, so the policy and each authorization are the only two levels.
	it('refuses an own __proto__ key at the policy and at each authorization', () => {
		const valid = JSON.stringify(authorization()).slice(1, -1)
		for (const [text, path] of [
			[`{"authorizations":[],"__proto__":{"x":1}}`, [] as (string | number)[]],
			[`{"authorizations":[{${valid},"__proto__":{}}]}`, ['authorizations', 0]],
			[
				`{"authorizations":[{${valid}},{${valid},"__proto__":{}}]}`,
				['authorizations', 1],
			],
		] as const) {
			expect(unrecognized(issues(JSON.parse(text)))).toEqual([
				{ path, keys: ['__proto__'] },
			])
		}
	})

	// The record field the other two policies check is theirs alone. An HTTP
	// authorization naming it is an unknown key and nothing more.
	it('looks for no record level inside an authorization', () => {
		const value = JSON.parse(
			`{"authorizations":[{${JSON.stringify(authorization()).slice(1, -1)},"serverEnvironment":{"__proto__":"x"},"artifacts":{"__proto__":"x"}}]}`,
		)
		expect(unrecognized(issues(value))).toEqual([
			{ path: ['authorizations', 0], keys: ['serverEnvironment', 'artifacts'] },
		])
	})

	it('refuses a non-object at the root', () => {
		for (const value of [undefined, null, 'policy', 42, []]) {
			expect(issues(value).map((issue) => issue.path)).toEqual([[]])
		}
	})

	// A circular input with an own `__proto__` is a plain object the schema
	// refuses. The issue the boundary builds carries no `input`, as none of
	// Zod's own issues do, so the `ZodError` never holds the caller's object and
	// never meets its cycle.
	it('refuses a circular input with an own __proto__ as a schema failure', () => {
		const policy = JSON.parse('{"authorizations":[],"__proto__":{}}')
		policy.self = policy
		const nested = JSON.parse(
			`{"authorizations":[{${JSON.stringify(authorization()).slice(1, -1)},"__proto__":{}}]}`,
		)
		nested.authorizations[0].self = nested
		for (const [value, where] of [
			[policy, '(root)'],
			[nested, '/authorizations/0'],
		] as const) {
			const fault = refused(value)
			expect(fault.message).not.toContain('input could not be read')
			expect(fault.message).toContain(`${where}: Unrecognized key: "__proto__"`)
			const found = issues(value)
			expect(
				found.filter(
					(issue) =>
						issue.code === 'unrecognized_keys' &&
						issue.keys.includes('__proto__'),
				),
			).toHaveLength(1)
			for (const issue of found) {
				expect(issue).not.toHaveProperty('input')
			}
		}
	})

	it('refuses input whose accessors or proxy traps throw', () => {
		expectUnreadableRefusals(parse, PATH, authorization(), 'port')
	})
})

/** Every object and array reachable from a value, itself included. */
function containers(value: unknown, seen = new Set<object>()): object[] {
	if (value === null || typeof value !== 'object' || seen.has(value)) return []
	seen.add(value)
	for (const child of Object.values(value)) containers(child, seen)
	return [...seen]
}
