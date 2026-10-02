/**
 * Coverage over two interfaces declaring one operation id: AD-20's
 * satisfaction predicates look up the steps that invoke an operation, and an
 * operation is the pair `(interfaceId, operationId)`. An oracle that addresses
 * the step of one interface satisfies only the site of that interface, even
 * when both declare one id.
 */
import { describe, expect, it } from 'vitest'
import { DISCIPLINE_RULES } from '../../src/core/coverage/rules.ts'
import { evaluateSatisfaction } from '../../src/core/coverage/satisfaction.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { sharedOperationContract } from '../fixtures/shared-operation-id.ts'

const verdictFor = (
	contract: EvalContract,
	rule: (typeof DISCIPLINE_RULES)[number],
) => {
	const verdicts = evaluateSatisfaction(contract)
	const verdict = verdicts[DISCIPLINE_RULES.indexOf(rule)]
	if (verdict === undefined) throw new Error(`no verdict for ${rule}`)
	return verdict
}

/** A quantifier over the fragments one step's standard output carries. */
const quantifierOver = (id: string, stepId: string) => {
	const collection = `/interactions/${stepId}/stdout/fragments`
	return {
		id,
		direction: {
			evidenceTargets: [collection],
			relation: 'for-all',
			polarity: 'expects-hold',
			scope: 'Every fragment one read names.',
			negativeDomain: 'A fragment carrying no identifier.',
		},
		check: {
			op: 'for-all',
			collection: { pointer: collection },
			predicate: { op: 'existence', operands: [{ pointer: '@/id' }] },
		},
		polarity: 'expects-hold',
		commentary: null,
	}
}

const withOracles = (
	oracles: readonly { readonly id: string }[],
	extra: Record<string, unknown> = {},
): EvalContract => {
	const [behavior] = sharedOperationContract.behaviors
	return EvalContract.parse({
		...structuredClone(sharedOperationContract),
		behaviors: [{ ...behavior, oracles: oracles.map((oracle) => oracle.id) }],
		oracles,
		...extra,
	})
}

describe('rule 4 over two interfaces declaring one operation id', () => {
	it('is satisfied when each interface has a quantifier over its own step', () => {
		const contract = withOracles([
			quantifierOver('O-001', 'read-old'),
			quantifierOver('O-002', 'read-new'),
		])
		expect(verdictFor(contract, 'per-record').satisfied).toBe(true)
	})

	it('is not satisfied for notes-v1 by an oracle that addresses only the notes-v2 step', () => {
		const contract = withOracles([quantifierOver('O-002', 'read-new')])
		const verdict = verdictFor(contract, 'per-record')
		expect(verdict.satisfied).toBe(false)
		expect(verdict.reason).toContain(
			'collection /fragments of operation read-note',
		)
	})

	it('is not satisfied for notes-v2 by an oracle that addresses only the notes-v1 step', () => {
		const contract = withOracles([quantifierOver('O-001', 'read-old')])
		expect(verdictFor(contract, 'per-record').satisfied).toBe(false)
	})
})

describe('rule 5 over a sibling group of two pairs', () => {
	const siblingGroups = {
		operations: [
			[
				{ interfaceId: 'notes-v1', operationId: 'read-note' },
				{ interfaceId: 'notes-v2', operationId: 'read-note' },
			],
		],
		parameters: [],
	}

	/** One oracle relating the two steps' output, in both the direction and the check. */
	const comparing = {
		id: 'O-003',
		direction: {
			evidenceTargets: [
				'/interactions/read-old/stdout/fragments',
				'/interactions/read-new/stdout/fragments',
			],
			relation: 'deep-equality',
			polarity: 'expects-hold',
			scope: 'Both reads of one note.',
			negativeDomain: 'The two interfaces disagreeing on the note.',
		},
		check: {
			op: 'deep-equality',
			operands: [
				{ pointer: '/interactions/read-old/stdout/fragments' },
				{ pointer: '/interactions/read-new/stdout/fragments' },
			],
		},
		polarity: 'expects-hold',
		commentary: null,
	}

	it('is not satisfied by oracles that each address one pair', () => {
		const contract = withOracles(
			[
				quantifierOver('O-001', 'read-old'),
				quantifierOver('O-002', 'read-new'),
			],
			{ siblingGroups },
		)
		const verdict = verdictFor(contract, 'sibling-cross-check')
		expect(verdict.satisfied).toBe(false)
		expect(verdict.reason).toContain(
			'the operation sibling group notes-v1/read-note and notes-v2/read-note',
		)
	})

	it('is satisfied by one oracle that addresses both pairs', () => {
		const contract = withOracles(
			[
				quantifierOver('O-001', 'read-old'),
				quantifierOver('O-002', 'read-new'),
				comparing,
			],
			{ siblingGroups },
		)
		expect(verdictFor(contract, 'sibling-cross-check').satisfied).toBe(true)
	})
})
