import { describe, expect, it } from 'vitest'
import { parseProbeTargetPolicy } from '../../src/adapters/probe-target-policy.ts'
import type {
	ProbeTargetAuthorization,
	ProbeTargetPolicy,
} from '../../src/core/schemas/probe-policy.ts'
import {
	hostileInputs,
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

// The runtime surface for an HTTP mapping loaded from disk, the contract
// `parseCommandTargetPolicy` and `parseMcpTargetPolicy` hold. A consumer holds
// its own registry to this reading instead of copying the field rules.
describe('parseProbeTargetPolicy', () => {
	const PATH = 'ProbeTargetPolicy'
	const parse = parseProbeTargetPolicy
	const refused = (value: unknown) => refusal(parse, PATH, value)
	const issues = (value: unknown) => issuesOf(parse, PATH, value)

	it('returns a deep copy of a valid mapping', () => {
		const policy = policyOf(authorization(), authorization({ port: 80 }))
		const parsed = parse(policy)
		expect(parsed).toEqual(policy)
		expect(parsed).not.toBe(policy)
		expect(parsed.authorizations[0]).not.toBe(policy.authorizations[0])
		expect(parsed.authorizations[0]?.addresses).not.toBe(
			policy.authorizations[0]?.addresses,
		)
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
			'an unsafe-list entry that is no method',
			{ safeMethods: ['TRACE'] },
			'safeMethods/0',
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
		['a missing field', { host: undefined }, 'host'],
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

	it('refuses input whose accessors or proxy traps throw', () => {
		const boom = new Error('boom')
		const hostile = hostileInputs(authorization(), 'port', boom)
		for (const value of hostile) {
			expect(refused(value).cause).toBeDefined()
		}
		expect(refused(hostile[0]).cause).toBe(boom)
	})
})
