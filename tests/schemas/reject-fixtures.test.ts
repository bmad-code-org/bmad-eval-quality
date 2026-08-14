import { describe, expect, it } from 'vitest'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { REJECT_CASES } from './fixtures/reject-cases.ts'
import { populatedContract } from './fixtures/relevance-contracts.ts'

describe('the per-constraint reject corpus', () => {
	it('starts from a fixture that parses, so a rejection is never incidental', () => {
		expect(EvalContract.safeParse(populatedContract).success).toBe(true)
	})

	it('enumerates every case exactly once', () => {
		const ids = REJECT_CASES.map((rejectCase) => rejectCase.id)
		expect(new Set(ids).size).toBe(ids.length)
		expect(ids.length).toBeGreaterThan(0)
	})

	// Enumerated programmatically: a committed fixture no test exercises cannot
	// go silently dead.
	it.each(REJECT_CASES)(
		'$id violates $constraint',
		({ mutate, issuePath, issueCode, issueCount }) => {
			const contract = structuredClone(populatedContract) as unknown
			mutate(contract)
			const result = EvalContract.safeParse(contract)
			expect(result.success).toBe(false)
			const issues = result.error?.issues ?? []
			// Exactly one issue is what makes this a single-constraint mutation.
			expect(issues).toHaveLength(issueCount ?? 1)
			expect(issues[0]?.path).toEqual(issuePath)
			expect(issues[0]?.code).toBe(issueCode)
		},
	)
})
