import { describe, expect, it } from 'vitest'
import {
	evaluateMcpTarget,
	MCP_DENIAL_REASONS,
	type McpResolvedTarget,
	parseMcpTargetPolicy,
} from '../../src/adapters/mcp-target-policy.ts'
import {
	McpTargetAuthorization,
	McpTargetPolicy,
} from '../../src/core/schemas/probe-policy.ts'
import {
	hostileInputs,
	issuesOf,
	refusal,
	unrecognized,
} from './fixtures/policy-refusal.ts'

function authorization(
	overrides: Partial<McpTargetAuthorization> = {},
): McpTargetAuthorization {
	return {
		interfaceId: 'notes-tool-server',
		target: 'node',
		targetArgs: ['server.mjs'],
		tools: ['search_notes'],
		cwd: '/tmp/notes',
		serverEnvironment: {},
		maxElapsedMs: 1000,
		maxOutputBytes: 4096,
		...overrides,
	}
}

function policyOf(
	...authorizations: McpTargetAuthorization[]
): McpTargetPolicy {
	return { authorizations }
}

function target(overrides: Partial<McpResolvedTarget> = {}): McpResolvedTarget {
	return {
		interfaceId: 'notes-tool-server',
		toolName: 'search_notes',
		...overrides,
	}
}

describe('evaluateMcpTarget', () => {
	it('allows a pair the mapping names and hands back the authorization it matched', () => {
		const authorized = authorization()
		const decision = evaluateMcpTarget(policyOf(authorized), target())
		expect(decision.allowed).toBe(true)
		if (!decision.allowed) throw new Error('the mapping names this pair')
		expect(decision.authorization).toBe(authorized)
	})

	// The default-deny base case, and the one an empty policy has to keep
	// representable: an authorization list of zero authorizes nothing.
	it('denies everything under an empty policy', () => {
		const decision = evaluateMcpTarget(policyOf(), target())
		expect(decision.allowed).toBe(false)
		if (decision.allowed) throw new Error('an empty policy authorizes nothing')
		expect(decision.reason).toBe('interface-not-authorized')
	})

	it('denies an interface no authorization names, and says so rather than blaming the tool', () => {
		const decision = evaluateMcpTarget(
			policyOf(authorization()),
			target({ interfaceId: 'other-server' }),
		)
		expect(decision.allowed).toBe(false)
		if (decision.allowed) throw new Error('the mapping names no such interface')
		expect(decision.reason).toBe('interface-not-authorized')
		expect(decision.detail).toContain('other-server')
	})

	it('denies a tool the authorization does not list, on a mapped interface', () => {
		const decision = evaluateMcpTarget(
			policyOf(authorization()),
			target({ toolName: 'delete_everything' }),
		)
		expect(decision.allowed).toBe(false)
		if (decision.allowed) throw new Error('the list does not name this tool')
		expect(decision.reason).toBe('tool-not-authorized')
		expect(decision.detail).toContain('delete_everything')
		expect(decision.detail).toContain('notes-tool-server')
	})

	// Comparison is literal, the way AD-40 compares an invocation: a tool whose
	// name differs only in case is a different tool to the server. The reason
	// is what this asserts: `allowed === false` alone would also pass on
	// interface-not-authorized, which is the distinction the interface-first
	// ordering exists to keep.
	it('compares the tool name literally, and says the tool was the problem', () => {
		const decision = evaluateMcpTarget(
			policyOf(authorization({ tools: ['search_notes'] })),
			target({ toolName: 'Search_Notes' }),
		)
		expect(decision.allowed).toBe(false)
		if (decision.allowed) throw new Error('the case does not match')
		expect(decision.reason).toBe('tool-not-authorized')
		expect(decision.detail).toContain('Search_Notes')
	})

	// One entry per interface, so the first entry naming it is the only one
	// consulted. Searching on would let a second entry point one logical
	// interface at a second binary depending on which tool was asked for.
	it('consults only the first authorization naming the interface', () => {
		const first = authorization({
			tools: ['create_note'],
			target: '/usr/bin/first-server',
		})
		const second = authorization({
			tools: ['search_notes'],
			target: '/usr/bin/second-server',
		})
		const decision = evaluateMcpTarget(policyOf(first, second), target())
		expect(decision.allowed).toBe(false)
		if (decision.allowed)
			throw new Error('the first entry does not name this tool')
		expect(decision.reason).toBe('tool-not-authorized')
	})

	// And the declaration itself refuses the shape that made that question
	// arise, so a caller who parses the policy is told rather than surprised.
	it('refuses a policy whose entries name one interface twice', () => {
		const parsed = McpTargetPolicy.safeParse(
			policyOf(
				authorization({ tools: ['create_note'] }),
				authorization({ tools: ['search_notes'] }),
			),
		)
		expect(parsed.success).toBe(false)
		expect(JSON.stringify(parsed.error?.issues)).toContain(
			'two authorizations name one interfaceId',
		)
	})

	it('accepts a policy whose entries name distinct interfaces', () => {
		expect(
			McpTargetPolicy.safeParse(
				policyOf(
					authorization(),
					authorization({ interfaceId: 'other-tool-server' }),
				),
			).success,
		).toBe(true)
	})

	// The premise the third conformance arm's outcome count is derived from.
	// A ninth field, or a second authorization-scoped one, moves that count,
	// and this is where it is written down.
	it('declares eight fields, two of which are authorization-scoped', () => {
		expect(Object.keys(authorization()).sort()).toEqual([
			'cwd',
			'interfaceId',
			'maxElapsedMs',
			'maxOutputBytes',
			'serverEnvironment',
			'target',
			'targetArgs',
			'tools',
		])
		expect(McpTargetAuthorization.safeParse(authorization()).success).toBe(true)
	})

	const REJECTED: readonly (readonly [
		string,
		Partial<McpTargetAuthorization>,
	])[] = [
		['an empty tool list', { tools: [] }],
		['an empty target', { target: '' }],
		['a zero elapsed budget', { maxElapsedMs: 0 }],
		['an elapsed budget past what a timer accepts', { maxElapsedMs: 2 ** 32 }],
		['a zero output cap', { maxOutputBytes: 0 }],
	]

	it.each(REJECTED)(
		'refuses an authorization declaring %s',
		(_label, override) => {
			expect(
				McpTargetAuthorization.safeParse(authorization(override)).success,
			).toBe(false)
		},
	)

	it('refuses an authorization carrying a field the shape does not declare', () => {
		expect(
			McpTargetAuthorization.safeParse({
				...authorization(),
				url: 'https://notes.example',
			}).success,
		).toBe(false)
	})

	// The registry and the type are one list. A reason added to the tuple with
	// no arm above would leave this failing rather than silently unreachable.
	it('declares exactly the two reasons the evaluator can return', () => {
		expect([...MCP_DENIAL_REASONS]).toEqual([
			'interface-not-authorized',
			'tool-not-authorized',
		])
	})
})

// The runtime surface for a mapping loaded from disk, the same contract
// `parseCommandTargetPolicy` holds. `createMcpAdapter` takes its policy typed
// and never parses it.
describe('parseMcpTargetPolicy', () => {
	const PATH = 'McpTargetPolicy'
	const parse = parseMcpTargetPolicy
	const refused = (value: unknown) => refusal(parse, PATH, value)
	const issues = (value: unknown) => issuesOf(parse, PATH, value)

	it('returns a copy of a valid mapping, and of an empty one', () => {
		const policy = policyOf(authorization())
		const parsed = parse(policy)
		expect(parsed).toEqual(policy)
		expect(parsed).not.toBe(policy)
		expect(parse({ authorizations: [] })).toEqual({ authorizations: [] })
	})

	it('refuses an unknown key at the root and inside an authorization', () => {
		expect(unrecognized(issues({ authorizations: [], extra: true }))).toEqual([
			{ path: [], keys: ['extra'] },
		])
		const nested = { authorizations: [{ ...authorization(), toolz: [] }] }
		expect(unrecognized(issues(nested))).toEqual([
			{ path: ['authorizations', 0], keys: ['toolz'] },
		])
		expect(refused(nested).message).toContain(
			'/authorizations/0: Unrecognized key: "toolz"',
		)
	})

	// Zod 4's strict-object and record loops skip an own `__proto__` without
	// an issue, and `JSON.parse` creates exactly that key.
	it('refuses an own __proto__ key at every level that can carry one', () => {
		const valid = JSON.stringify(authorization()).slice(1, -1)
		for (const [text, path] of [
			[`{"authorizations":[],"__proto__":{"x":1}}`, [] as (string | number)[]],
			[`{"authorizations":[{${valid},"__proto__":{}}]}`, ['authorizations', 0]],
			[
				`{"authorizations":[{${valid.replace('"serverEnvironment":{}', '"serverEnvironment":{"__proto__":"x"}')}}]}`,
				['authorizations', 0, 'serverEnvironment'],
			],
		] as const) {
			expect(unrecognized(issues(JSON.parse(text)))).toEqual([
				{ path, keys: ['__proto__'] },
			])
		}
	})

	it('reports every failing field in the cause and as a pointer in the message', () => {
		const value = {
			authorizations: [
				authorization({ maxElapsedMs: 0, tools: [] }),
				authorization(),
			],
		}
		expect(
			issues(value)
				.map((issue) => issue.path.join('/'))
				.sort(),
		).toEqual([
			'authorizations',
			'authorizations/0/maxElapsedMs',
			'authorizations/0/tools',
		])
		const message = refused(value).message
		for (const pointer of [
			'/authorizations:',
			'/authorizations/0/maxElapsedMs:',
			'/authorizations/0/tools:',
		]) {
			expect(message).toContain(pointer)
		}
	})

	it('refuses a non-object at the root', () => {
		for (const value of [undefined, null, 'policy', 42, []]) {
			expect(issues(value).map((issue) => issue.path)).toEqual([[]])
		}
	})

	it('refuses input whose accessors or proxy traps throw', () => {
		const boom = new Error('boom')
		const hostile = hostileInputs(authorization(), 'target', boom)
		for (const value of hostile) {
			expect(refused(value).cause).toBeDefined()
		}
		expect(refused(hostile[0]).cause).toBe(boom)
	})
})
