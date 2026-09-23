import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
	COMMAND_DENIAL_REASONS,
	type CommandResolvedTarget,
	evaluateCommandTarget,
	parseCommandTargetPolicy,
} from '../../src/adapters/command-target-policy.ts'
import { RuntimeFault } from '../../src/core/schemas/faults.ts'
import {
	CommandTargetAuthorization,
	type CommandTargetPolicy,
} from '../../src/core/schemas/probe-policy.ts'

function authorization(
	overrides: Partial<CommandTargetAuthorization> = {},
): CommandTargetAuthorization {
	return {
		interfaceId: 'devtools',
		executable: 'git',
		target: '/usr/bin/git',
		permittedSubcommandPaths: [['status']],
		permittedEnvironmentKeys: [],
		cwd: '/tmp/devtools',
		artifacts: {},
		maxElapsedMs: 1000,
		maxOutputBytes: 4096,
		...overrides,
	}
}

function policyOf(
	...authorizations: CommandTargetAuthorization[]
): CommandTargetPolicy {
	return { authorizations }
}

function target(
	overrides: Partial<CommandResolvedTarget> = {},
): CommandResolvedTarget {
	return {
		interfaceId: 'devtools',
		executable: 'git',
		subcommandPath: ['status'],
		...overrides,
	}
}

describe('evaluateCommandTarget', () => {
	it('allows an exact interface, executable, and subcommand match', () => {
		const decision = evaluateCommandTarget(policyOf(authorization()), target())
		expect(decision.allowed).toBe(true)
	})

	it('denies an interface no authorization names', () => {
		const decision = evaluateCommandTarget(
			policyOf(authorization()),
			target({ interfaceId: 'unmapped' }),
		)
		expect(decision).toMatchObject({
			allowed: false,
			reason: 'interface-not-authorized',
		})
	})

	it('denies an executable the interface does not pair with, distinctly from an unmapped interface', () => {
		const decision = evaluateCommandTarget(
			policyOf(authorization()),
			target({ executable: 'npm' }),
		)
		expect(decision).toMatchObject({
			allowed: false,
			reason: 'executable-not-authorized',
		})
	})

	it('denies a subcommand path outside the authorized set', () => {
		const decision = evaluateCommandTarget(
			policyOf(authorization()),
			target({ subcommandPath: ['push', '--force'] }),
		)
		expect(decision).toMatchObject({
			allowed: false,
			reason: 'subcommand-not-authorized',
		})
	})

	it('allows the executable itself when an authorization permits the empty subcommand path', () => {
		const decision = evaluateCommandTarget(
			policyOf(authorization({ permittedSubcommandPaths: [[]] })),
			target({ subcommandPath: [] }),
		)
		expect(decision.allowed).toBe(true)
	})

	it('compares subcommand path segments literally: a prefix is not a match', () => {
		const decision = evaluateCommandTarget(
			policyOf(
				authorization({ permittedSubcommandPaths: [['remote', 'add']] }),
			),
			target({ subcommandPath: ['remote'] }),
		)
		expect(decision).toMatchObject({
			allowed: false,
			reason: 'subcommand-not-authorized',
		})
	})

	it('tries several authorizations for one interface-executable pair in declaration order', () => {
		const decision = evaluateCommandTarget(
			policyOf(
				authorization({ permittedSubcommandPaths: [['status']] }),
				authorization({ permittedSubcommandPaths: [['log']] }),
			),
			target({ subcommandPath: ['log'] }),
		)
		expect(decision.allowed).toBe(true)
	})

	it('resolves one logical interface to two distinct executables independently', () => {
		const policy = policyOf(
			authorization({
				executable: 'git',
				permittedSubcommandPaths: [['status']],
			}),
			authorization({ executable: 'npm', permittedSubcommandPaths: [['ci']] }),
		)
		expect(
			evaluateCommandTarget(
				policy,
				target({ executable: 'npm', subcommandPath: ['ci'] }),
			).allowed,
		).toBe(true)
		expect(
			evaluateCommandTarget(
				policy,
				target({ executable: 'npm', subcommandPath: ['publish'] }),
			),
		).toMatchObject({ allowed: false, reason: 'subcommand-not-authorized' })
	})

	it('denies against an empty policy', () => {
		const decision = evaluateCommandTarget(policyOf(), target())
		expect(decision).toMatchObject({
			allowed: false,
			reason: 'interface-not-authorized',
		})
	})

	it('declares exactly three denial reasons', () => {
		expect(COMMAND_DENIAL_REASONS).toEqual([
			'interface-not-authorized',
			'executable-not-authorized',
			'subcommand-not-authorized',
		])
	})

	// The allowlist is checked by the adapter, so these two are the schema's
	// own share of the same rule: what an operator is allowed to write down.
	it('refuses PATH in permittedEnvironmentKeys, and admits an ordinary key', () => {
		// `target` may be a bare command name, and the child environment is
		// what resolves it, so a permitted PATH would let the contract author
		// choose which binary runs.
		for (const keys of [['PATH'], ['HOME', 'PATH']]) {
			const refused = CommandTargetAuthorization.safeParse(
				authorization({ permittedEnvironmentKeys: keys }),
			)
			expect(refused.success).toBe(false)
		}
		expect(
			CommandTargetAuthorization.safeParse(
				authorization({ permittedEnvironmentKeys: ['HOME'] }),
			).success,
		).toBe(true)
	})

	it('refuses an environment key outside the portable charset', () => {
		// `A=B` as a key reaches a child as a variable `A` whose value carries
		// `B=` in front of the declared one, which an operator reading the
		// mapping cannot see.
		for (const key of ['A=B', '1BAD', 'HAS SPACE', '']) {
			expect(
				CommandTargetAuthorization.safeParse(
					authorization({ permittedEnvironmentKeys: [key] }),
				).success,
			).toBe(false)
		}
	})
})

// The runtime surface for a mapping loaded from disk. The adapter takes its
// policy typed and never parses it, so this is the only place an unknown key
// or a malformed cap is caught before the adapter holds it.
describe('parseCommandTargetPolicy', () => {
	/** The fault a refused input throws; fails the test when nothing throws. */
	function refusal(value: unknown): RuntimeFault {
		try {
			parseCommandTargetPolicy(value)
		} catch (error) {
			expect(error).toBeInstanceOf(RuntimeFault)
			const fault = error as RuntimeFault
			expect(fault.code).toBe('schema-parse-failure')
			expect(fault.artifactPath).toBe('CommandTargetPolicy')
			return fault
		}
		throw new Error('parseCommandTargetPolicy accepted the input')
	}

	/** The Zod issues a refused input carries as its cause. */
	function issuesOf(value: unknown): readonly z.core.$ZodIssue[] {
		const cause = refusal(value).cause
		expect(cause).toBeInstanceOf(z.ZodError)
		return (cause as z.ZodError).issues
	}

	const unrecognized = (issues: readonly z.core.$ZodIssue[]) =>
		issues
			.filter((issue) => issue.code === 'unrecognized_keys')
			.map((issue) => ({
				path: issue.path,
				keys: (issue as z.core.$ZodIssueUnrecognizedKeys).keys,
			}))

	it('returns a copy of a valid mapping, and of an empty one', () => {
		const policy = policyOf(authorization())
		const parsed = parseCommandTargetPolicy(policy)
		expect(parsed).toEqual(policy)
		expect(parsed).not.toBe(policy)
		expect(parseCommandTargetPolicy({ authorizations: [] })).toEqual({
			authorizations: [],
		})
	})

	it('refuses an unknown key at the root and inside an authorization', () => {
		expect(unrecognized(issuesOf({ authorizations: [], extra: true }))).toEqual(
			[{ path: [], keys: ['extra'] }],
		)
		const nested = { authorizations: [{ ...authorization(), maxElapsedMS: 5 }] }
		expect(unrecognized(issuesOf(nested))).toEqual([
			{ path: ['authorizations', 0], keys: ['maxElapsedMS'] },
		])
		expect(refusal(nested).message).toContain(
			'/authorizations/0: Unrecognized key: "maxElapsedMS"',
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
				`{"authorizations":[{${valid.replace('"artifacts":{}', '"artifacts":{"__proto__":"x"}')}}]}`,
				['authorizations', 0, 'artifacts'],
			],
		] as const) {
			const value: unknown = JSON.parse(text)
			expect(unrecognized(issuesOf(value))).toEqual([
				{ path, keys: ['__proto__'] },
			])
		}
	})

	it('reports every failing field in the cause and as a pointer in the message', () => {
		const value = {
			authorizations: [
				authorization({
					maxElapsedMs: 0,
					permittedEnvironmentKeys: ['PATH'],
					artifacts: { 'a/b~c': '' },
				}),
			],
		}
		expect(
			issuesOf(value)
				.map((issue) => issue.path.join('/'))
				.sort(),
		).toEqual([
			'authorizations/0/artifacts/a/b~c',
			'authorizations/0/maxElapsedMs',
			'authorizations/0/permittedEnvironmentKeys',
		])
		const message = refusal(value).message
		for (const pointer of [
			'/authorizations/0/artifacts/a~1b~0c:',
			'/authorizations/0/maxElapsedMs:',
			'/authorizations/0/permittedEnvironmentKeys:',
		]) {
			expect(message).toContain(pointer)
		}
	})

	it('refuses a non-object at the root', () => {
		for (const value of [undefined, null, 'policy', 42, []]) {
			expect(issuesOf(value).map((issue) => issue.path)).toEqual([[]])
		}
	})

	// A hostile input throws out of Zod itself; the boundary turns every one of
	// those into the same fault, carrying what was thrown.
	it('refuses input whose accessors or proxy traps throw', () => {
		const boom = new Error('boom')
		const thrower = () => {
			throw boom
		}
		const revocable = Proxy.revocable({ authorizations: [] }, {})
		revocable.revoke()
		const hostile: unknown[] = [
			new Proxy({ authorizations: [] }, { get: thrower }),
			Object.defineProperty({}, 'authorizations', {
				enumerable: true,
				get: thrower,
			}),
			{
				authorizations: [
					Object.defineProperty({ ...authorization() }, 'target', {
						enumerable: true,
						get: thrower,
					}),
				],
			},
			{
				authorizations: new Proxy([authorization()], {
					get: (target, key, receiver) =>
						key === 'length' ? thrower() : Reflect.get(target, key, receiver),
				}),
			},
			revocable.proxy,
		]
		for (const value of hostile) {
			expect(refusal(value).cause).toBeDefined()
		}
		expect(refusal(hostile[0]).cause).toBe(boom)
	})
})
