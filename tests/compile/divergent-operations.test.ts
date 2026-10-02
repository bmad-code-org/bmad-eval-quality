/**
 * Compile over two interfaces that declare one `operationId` and disagree about
 * everything else an operation declares (see `divergent-operations.ts`). Each
 * case holds a declaration that is legal on one interface and illegal on the
 * other, so a step-to-operation lookup that reads the other interface's
 * operation changes the result.
 */
import { describe, expect, it } from 'vitest'
import { compile } from '../../src/application/compile.ts'
import { checkCapturedReachability } from '../../src/core/compile/bindings.ts'
import { StructuralFailure } from '../../src/core/failure-codes.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { divergentOperationDraft } from '../fixtures/divergent-operations.ts'

// The draft is edited in ways its inferred literal type does not admit.
type Draft = any

const failureOf = (mutate: (draft: Draft) => void): StructuralFailure => {
	const draft = divergentOperationDraft()
	mutate(draft)
	try {
		compile(draft, { strict: true })
	} catch (error) {
		if (error instanceof StructuralFailure) return error
		throw error
	}
	throw new Error('the contract compiled where a failure was expected')
}

const stdin = (value: unknown) => ({
	argument: null,
	option: null,
	environment: null,
	stdin: { prompt: value },
})

/** A third step on `notes-v1`, anchored on nothing so it adds no temporal width. */
const readThird = (binding: unknown) => ({
	stepId: 'read-third',
	interfaceId: 'notes-v1',
	operationId: 'read-note',
	after: null,
	cardinality: 'exactly-one',
	inputBinding: binding,
})

describe('the divergent contract compiles with each step reading its own interface', () => {
	it('compiles', () => {
		expect(() =>
			compile(divergentOperationDraft(), { strict: true }),
		).not.toThrow()
	})
})

describe('a capture reads the operation of the interface that produced the value', () => {
	it('refuses a capture from the channel notes-v1 describes when the step is on notes-v2', () => {
		// notes-v2 describes the file `report`; standard output carries nothing a capture may read.
		const failure = failureOf((draft) => {
			draft.interactionPlan.push(
				readThird(
					stdin({ captured: '/interactions/read-new/stdout/fragments' }),
				),
			)
		})
		expect(failure.code).toBe('captured-channel-undeclared')
	})

	it('types a captured value by the declaring interface: notes-v2 declares token a number', () => {
		const failure = failureOf((draft) => {
			draft.interactionPlan.push(
				readThird(
					stdin({
						captured: '/interactions/read-new/artifact/report/token',
					}),
				),
			)
		})
		expect(failure.code).toBe('unreachable-check-evidence')
		expect(failure.message).toContain(
			'resolves to a declared "number", which is not the "string" the bound stdin parameter',
		)
	})

	it('types the bound parameter by the interface of the step: notes-v2 declares format a string', () => {
		const failure = failureOf((draft) => {
			const step = draft.interactionPlan.find(
				(candidate: { stepId: string }) => candidate.stepId === 'read-new-2',
			)
			if (step === undefined) throw new Error('the fixture declares read-new-2')
			step.inputBinding.option.format = {
				captured: '/interactions/read-new/artifact/report/token',
			}
		})
		expect(failure.code).toBe('unreachable-check-evidence')
		expect(failure.message).toContain(
			'resolves to a declared "number", which is not the "string" the bound option parameter "format"',
		)
	})

	it('reaches a field only the declaring interface declares', () => {
		const failure = failureOf((draft) => {
			draft.interactionPlan.push(
				readThird(
					stdin({
						captured: '/interactions/read-new/artifact/report/fragments',
					}),
				),
			)
		})
		expect(failure.code).toBe('unreachable-check-evidence')
		expect(failure.message).toContain('"fragments"')
	})
})

describe('a pointer and an input read the operation of their own step', () => {
	it('refuses an artifact notes-v1 never writes, though notes-v2 writes it', () => {
		const failure = failureOf((draft) => {
			const [, , third] = draft.oracles
			if (third === undefined) throw new Error('the fixture declares O-003')
			third.check.operands[0] = {
				pointer: '/interactions/read-old/artifact/log',
			}
			third.direction.evidenceTargets = ['/interactions/read-old/artifact/log']
		})
		expect(failure.code).toBe('unresolved-artifact-reference')
	})

	it('refuses an input notes-v1 does not declare, though notes-v2 requires it', () => {
		const failure = failureOf((draft) => {
			const [step] = draft.interactionPlan
			if (step === undefined) throw new Error('the fixture declares read-old')
			step.inputBinding = {
				...step.inputBinding,
				option: { format: { literal: 'plain' } },
			}
		})
		expect(failure.code).toBe('undeclared-mandatory-input')
		expect(failure.message).toContain('"format"')
	})

	it('refuses a quantifier over a field notes-v2 declares a string, though notes-v1 declares it a collection', () => {
		const failure = failureOf((draft) => {
			const [, quantifier] = draft.oracles
			if (quantifier === undefined)
				throw new Error('the fixture declares O-002')
			quantifier.check.collection.pointer =
				'/interactions/read-new/artifact/report/rows'
			quantifier.direction.evidenceTargets = [
				'/interactions/read-new/artifact/report/rows',
			]
		})
		expect(failure.code).toBe('quantifier-over-non-collection')
		expect(failure.message).toContain('not a collection')
	})

	it('refuses a quantifier over a collection only the other interface declares', () => {
		const failure = failureOf((draft) => {
			const [, quantifier] = draft.oracles
			if (quantifier === undefined)
				throw new Error('the fixture declares O-002')
			quantifier.check.collection.pointer =
				'/interactions/read-new/artifact/report/fragments'
			quantifier.direction.evidenceTargets = [
				'/interactions/read-new/artifact/report/fragments',
			]
		})
		expect(failure.code).toBe('unreachable-check-evidence')
	})
})

describe('a capture from a step whose operation its interface does not declare', () => {
	it('names the operation and the interface of the referenced step', () => {
		const draft = divergentOperationDraft()
		const readNew = draft.interactionPlan.find(
			(step: { stepId: string }) => step.stepId === 'read-new',
		)
		if (readNew === undefined) throw new Error('the fixture declares read-new')
		readNew.operationId = 'missing-op'
		const contract = EvalContract.parse(draft)
		let failure: unknown
		try {
			checkCapturedReachability(contract)
		} catch (error) {
			failure = error
		}
		expect(failure).toBeInstanceOf(StructuralFailure)
		expect((failure as StructuralFailure).message).toContain(
			'names step "read-new", which names operation "missing-op" on interface "notes-v2", which that interface does not declare',
		)
	})
})
