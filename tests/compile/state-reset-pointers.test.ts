/**
 * `stateResetPointers` is read by the state-reset check alone, and compile
 * refuses an entry that would quietly compare nothing: one a volatile pointer
 * covers, and one the response descriptor cannot reach. Each case is one mutation
 * of `cleanPopulatedContract()`.
 */
import { describe, expect, it } from 'vitest'
import { compile } from '../../src/core/compile/compile.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { cleanPopulatedContract, structuralFailureOf } from './helpers.ts'

const mutated = (mutate: (operation: any) => void): EvalContract => {
	const contract = cleanPopulatedContract() as any
	mutate(contract.permittedInterfaces[0].operations[0])
	return EvalContract.parse(contract)
}

const keyOf = (operation: any): string => {
	const [key] = operation.responseDescriptor.requiredKeys
	if (key === undefined)
		throw new Error('the fixture operation requires no key')
	return key
}

const failureOf = (mutate: (operation: any) => void) =>
	structuralFailureOf(() => {
		compile(mutated(mutate), { strict: true })
	})

describe('stateResetPointers at compile', () => {
	it('accepts a pointer to a declared key, the empty pointer and the empty list', () => {
		for (const pointers of [(key: string) => [`/${key}`], () => [''], () => []])
			expect(() =>
				compile(
					mutated((operation) => {
						operation.volatilePointers = []
						operation.stateResetPointers = pointers(keyOf(operation))
					}),
					{ strict: true },
				),
			).not.toThrow()
	})

	it('refuses a pointer a volatile pointer covers, and names the volatile pointer', () => {
		const failure = failureOf((operation) => {
			const key = keyOf(operation)
			operation.volatilePointers = [`/${key}`]
			operation.stateResetPointers = [`/${key}`]
		})
		expect(failure.code).toBe('unreachable-check-evidence')
		expect(failure.artifactPath).toContain('.stateResetPointers[0]')
		expect(failure.message).toContain('declares volatile')
	})

	it('reads a wildcard volatile pointer as covering what lies under it', () => {
		const failure = failureOf((operation) => {
			const key = keyOf(operation)
			operation.volatilePointers = ['/*']
			operation.stateResetPointers = [`/${key}`]
		})
		expect(failure.code).toBe('unreachable-check-evidence')
	})

	it('refuses a pointer to a key the response descriptor does not declare', () => {
		const failure = failureOf((operation) => {
			operation.volatilePointers = []
			operation.stateResetPointers = ['/no-such-key/deep']
		})
		expect(failure.code).toBe('unreachable-check-evidence')
		expect(failure.artifactPath).toContain('.stateResetPointers[0]')
		expect(failure.message).toContain('compares nothing')
	})

	it('leaves a pointer whose parent a volatile pointer does not cover alone', () => {
		expect(() =>
			compile(
				mutated((operation) => {
					const key = keyOf(operation)
					operation.volatilePointers = [`/${key}/*`]
					operation.stateResetPointers = [`/${key}`]
				}),
				{ strict: true },
			),
		).not.toThrow()
	})
})
