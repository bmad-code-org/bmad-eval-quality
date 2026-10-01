import { describe, expect, it } from 'vitest'
import { COMMAND_DENIAL_REASONS } from '../../src/adapters/command-target-policy.ts'
import { MCP_DENIAL_REASONS } from '../../src/adapters/mcp-target-policy.ts'
import { DENIAL_REASONS } from '../../src/core/probe/target-policy.ts'
import {
	FORBIDDEN_TARGET_REASONS,
	RUNTIME_FAULT_CODES,
	RuntimeFault,
} from '../../src/core/schemas/faults.ts'

describe('RUNTIME_FAULT_CODES: the complete AD-28 registry', () => {
	it('holds all ten codes, in the architecture table order, each unique', () => {
		expect(RUNTIME_FAULT_CODES).toEqual([
			'schema-parse-failure',
			'schema-version-mismatch',
			'non-canonicalizable-value',
			'digest-mismatch',
			'budget-exhausted',
			'port-failure',
			'port-contract-violation',
			'forbidden-target',
			'aborted',
			'operator-cannot-accept-operand',
		])
		expect(new Set(RUNTIME_FAULT_CODES).size).toBe(RUNTIME_FAULT_CODES.length)
	})

	it.each(RUNTIME_FAULT_CODES)(
		'constructs a RuntimeFault carrying code %s',
		(code) => {
			const fault = new RuntimeFault(code, 'artifacts/example.json', 'detail')
			expect(fault.code).toBe(code)
			expect(fault).toBeInstanceOf(Error)
		},
	)
})

describe('RuntimeFault', () => {
	it('is a thrown Error carrying a stable machine code and the artifact path', () => {
		const fault = new RuntimeFault(
			'non-canonicalizable-value',
			'artifacts/example.json',
			'integer outside the safe range',
		)
		expect(fault).toBeInstanceOf(Error)
		expect(fault.name).toBe('RuntimeFault')
		expect(fault.code).toBe('non-canonicalizable-value')
		expect(fault.artifactPath).toBe('artifacts/example.json')
		expect(fault.message).toContain('integer outside the safe range')
		expect(fault.message).toContain('artifacts/example.json')
	})

	it('carries schema-parse-failure for input that does not parse', () => {
		const fault = new RuntimeFault(
			'schema-parse-failure',
			'artifacts/broken.json',
			'input is not valid UTF-8',
		)
		expect(fault.code).toBe('schema-parse-failure')
		expect(fault.artifactPath).toBe('artifacts/broken.json')
	})

	it('carries an optional cause so the platform error is not discarded', () => {
		const cause = new Error('decoder position 3')
		const fault = new RuntimeFault(
			'schema-parse-failure',
			'artifacts/broken.json',
			'input is not valid UTF-8',
			{ cause },
		)
		expect(fault.cause).toBe(cause)
	})

	it('carries a denial reason on forbidden-target, so a caller need not parse the message', () => {
		const fault = new RuntimeFault(
			'forbidden-target',
			'ProbeRequest',
			'tool "delete_everything" is not among the authorized tools',
			{ reason: 'tool-not-authorized' },
		)
		expect(fault.code).toBe('forbidden-target')
		expect(fault.reason).toBe('tool-not-authorized')
		expect(fault.message).not.toContain('tool-not-authorized')
	})

	it('carries no reason unless one is passed', () => {
		const fault = new RuntimeFault(
			'forbidden-target',
			'ProbeRequest',
			'no authorization names interface "x"',
		)
		expect(fault.reason).toBeUndefined()
		expect(
			new RuntimeFault('port-failure', 'ProbeRequest', 'spawn failed').reason,
		).toBeUndefined()
	})

	// A type-level check, which `npm run typecheck` enforces: the directive fails
	// the typecheck as unused if the other signatures ever accept a reason.
	it('refuses a reason on any code other than forbidden-target and port-failure, at compile time', () => {
		const fault = new RuntimeFault('budget-exhausted', 'ProbeRequest', 'x', {
			// @ts-expect-error: only the forbidden-target and port-failure signatures take a reason
			reason: 'tool-not-authorized',
		})
		expect(fault.code).toBe('budget-exhausted')
	})

	it('carries launch-too-large on port-failure beside its cause', () => {
		const cause = new Error('spawn E2BIG')
		const fault = new RuntimeFault('port-failure', 'ProbeRequest', 'x', {
			cause,
			reason: 'launch-too-large',
		})
		expect(fault.reason).toBe('launch-too-large')
		expect(fault.cause).toBe(cause)
	})

	it('refuses a forbidden-target reason on port-failure at compile time, and carries nothing at run time', () => {
		const literal = new RuntimeFault('port-failure', 'ProbeRequest', 'x', {
			// @ts-expect-error: port-failure takes a PortFailureReason only
			reason: 'tool-not-authorized',
		})
		expect(literal.reason).toBeUndefined()
		const options = {
			cause: new Error('spawn'),
			reason: 'tool-not-authorized' as const,
		}
		expect(
			new RuntimeFault('port-failure', 'ProbeRequest', 'x', options).reason,
		).toBeUndefined()
	})

	it('refuses launch-too-large on forbidden-target at compile time, and carries nothing at run time', () => {
		const literal = new RuntimeFault('forbidden-target', 'ProbeRequest', 'x', {
			// @ts-expect-error: forbidden-target takes a ForbiddenTargetReason only
			reason: 'launch-too-large',
		})
		expect(literal.reason).toBeUndefined()
		const options = {
			cause: new Error('spawn'),
			reason: 'launch-too-large' as const,
		}
		expect(
			new RuntimeFault('forbidden-target', 'ProbeRequest', 'x', options).reason,
		).toBeUndefined()
	})

	it('still accepts a forbidden-target reason on forbidden-target', () => {
		const options = { reason: 'executable-not-authorized' as const }
		expect(
			new RuntimeFault('forbidden-target', 'ProbeRequest', 'x', options).reason,
		).toBe('executable-not-authorized')
	})

	it('drops a reason an options variable carries onto any other code', () => {
		const options = {
			cause: new Error('spawn'),
			reason: 'launch-too-large' as const,
		}
		const fault = new RuntimeFault('aborted', 'ProbeRequest', 'x', options)
		expect(fault.reason).toBeUndefined()
		expect(fault.cause).toBe(options.cause)
	})
})

// Every mechanism's tuple `satisfies` the fault's union, which catches a reason
// missing from the union. This catches the other direction: a reason in the
// union that no mechanism can produce.
describe('FORBIDDEN_TARGET_REASONS', () => {
	it('is exactly the union of the api, cli, and mcp denial reasons', () => {
		const union = new Set<string>([
			...DENIAL_REASONS,
			...COMMAND_DENIAL_REASONS,
			...MCP_DENIAL_REASONS,
		])
		expect(new Set(FORBIDDEN_TARGET_REASONS)).toEqual(union)
		expect(new Set(FORBIDDEN_TARGET_REASONS).size).toBe(
			FORBIDDEN_TARGET_REASONS.length,
		)
	})
})
