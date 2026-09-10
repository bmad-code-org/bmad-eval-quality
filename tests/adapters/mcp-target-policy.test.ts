import { describe, expect, it } from 'vitest'
import {
	evaluateMcpTarget,
	MCP_DENIAL_REASONS,
	type McpResolvedTarget,
} from '../../src/adapters/mcp-target-policy.ts'
import type {
	McpTargetAuthorization,
	McpTargetPolicy,
} from '../../src/core/schemas/probe-policy.ts'

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
	// name differs only in case is a different tool to the server.
	it('compares the tool name literally', () => {
		const decision = evaluateMcpTarget(
			policyOf(authorization({ tools: ['search_notes'] })),
			target({ toolName: 'Search_Notes' }),
		)
		expect(decision.allowed).toBe(false)
	})

	it('tries several authorizations for one interface in declaration order and takes the first that names the tool', () => {
		const first = authorization({ tools: ['create_note'], cwd: '/tmp/first' })
		const second = authorization({
			tools: ['search_notes'],
			cwd: '/tmp/second',
		})
		const decision = evaluateMcpTarget(policyOf(first, second), target())
		expect(decision.allowed).toBe(true)
		if (!decision.allowed) throw new Error('the second entry names this tool')
		expect(decision.authorization.cwd).toBe('/tmp/second')
	})

	it('reports tool-not-authorized when several authorizations name the interface and none names the tool', () => {
		const decision = evaluateMcpTarget(
			policyOf(
				authorization({ tools: ['create_note'] }),
				authorization({ tools: ['list_notes'] }),
			),
			target(),
		)
		expect(decision.allowed).toBe(false)
		if (decision.allowed) throw new Error('no entry names this tool')
		expect(decision.reason).toBe('tool-not-authorized')
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
