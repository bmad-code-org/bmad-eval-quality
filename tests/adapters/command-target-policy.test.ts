import { describe, expect, it } from 'vitest'
import {
	COMMAND_DENIAL_REASONS,
	type CommandResolvedTarget,
	evaluateCommandTarget,
} from '../../src/adapters/command-target-policy.ts'
import type {
	CommandTargetAuthorization,
	CommandTargetPolicy,
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
})
