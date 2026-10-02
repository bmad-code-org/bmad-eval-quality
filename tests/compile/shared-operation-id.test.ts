/**
 * Compile over two interfaces declaring one operation id: a step names the
 * pair `(interfaceId, operationId)`, so two interfaces may declare one
 * operation id, and a pointer that addresses a step whose interface does not
 * declare its operation is refused with a message that names the interface.
 */
import { describe, expect, it } from 'vitest'
import { compile } from '../../src/application/compile.ts'
import { StructuralFailure } from '../../src/core/failure-codes.ts'
import {
	sharedOperationContract,
	sharedToolOperationContract,
} from '../fixtures/shared-operation-id.ts'

const failureOf = (run: () => unknown): StructuralFailure => {
	try {
		run()
	} catch (error) {
		if (error instanceof StructuralFailure) return error
		throw error
	}
	throw new Error('the contract compiled where a failure was expected')
}

describe('compile over two interfaces declaring one operation id', () => {
	it('compiles the command twin', () => {
		expect(() =>
			compile(sharedOperationContract, { strict: true }),
		).not.toThrow()
	})

	it('compiles the tool-server twin', () => {
		expect(() =>
			compile(sharedToolOperationContract, { strict: true }),
		).not.toThrow()
	})
})

describe('a step naming an interface that does not declare its operation', () => {
	// `write-note` is declared on notes-v2 only; the step names notes-v1.
	const withUndeclaredPair = () => {
		const contract = structuredClone(sharedOperationContract)
		const [first, second] = contract.permittedInterfaces
		if (first?.kind !== 'cli' || second?.kind !== 'cli') {
			throw new Error('the fixture declares two command interfaces')
		}
		const [operation] = second.operations
		if (operation === undefined) throw new Error('the fixture declares no op')
		second.operations.push({
			...structuredClone(operation),
			operationId: 'write-note',
			invocation: { executable: 'notes-v2', subcommandPath: ['write'] },
		})
		const [step] = contract.interactionPlan
		if (step === undefined) throw new Error('the fixture declares no step')
		step.operationId = 'write-note'
		return contract
	}

	it('fails unreachable-check-evidence, and the message names the interface', () => {
		const failure = failureOf(() =>
			compile(withUndeclaredPair(), { strict: true }),
		)
		expect(failure.code).toBe('unreachable-check-evidence')
		expect(failure.message).toContain(
			'names operation "write-note" on interface "notes-v1", which that interface does not declare',
		)
	})

	it('compiles while no oracle or capture pointer addresses the step, because only a pointer reaches the operation', () => {
		const contract = structuredClone(sharedOperationContract)
		const [readOld] = contract.interactionPlan
		if (readOld === undefined) throw new Error('the fixture declares no step')
		contract.interactionPlan.push({
			...structuredClone(readOld),
			stepId: 'orphan',
			interfaceId: 'notes-v1',
			operationId: 'write-note',
		})
		expect(() => compile(contract, { strict: true })).not.toThrow()
		// The same step, once an oracle addresses it, is refused and names the interface.
		const [oracle] = contract.oracles
		if (oracle === undefined) throw new Error('the fixture declares no oracle')
		const pointer = '/interactions/orphan/stdout/fragments'
		if (oracle.direction === null)
			throw new Error('the oracle has no direction')
		oracle.direction.evidenceTargets = [pointer]
		oracle.check = { op: 'existence', operands: [{ pointer }] }
		const failure = failureOf(() => compile(contract, { strict: true }))
		expect(failure.code).toBe('unreachable-check-evidence')
		expect(failure.message).toContain(
			'names operation "write-note" on interface "notes-v1", which that interface does not declare',
		)
	})
})

describe('a step naming an operation its interface declares more than once', () => {
	it('says the interface declares it more than once, where it would otherwise say it does not declare it', () => {
		const contract = structuredClone(sharedOperationContract)
		const [first] = contract.permittedInterfaces
		if (first?.kind !== 'cli') throw new Error('the fixture declares cli')
		const [operation] = first.operations
		if (operation === undefined) throw new Error('the fixture declares no op')
		first.operations.push({
			...structuredClone(operation),
			invocation: { executable: 'notes-v1', subcommandPath: ['read-again'] },
		})
		const failure = failureOf(() => compile(contract, { strict: true }))
		expect(failure.code).toBe('unreachable-check-evidence')
		expect(failure.message).toContain(
			'names operation "read-note" on interface "notes-v1", which that interface declares more than once',
		)
	})
})
