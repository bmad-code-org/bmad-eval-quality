import { describe, expect, it } from 'vitest'
import { checkWaiverCompleteness } from '../../src/core/compile/waivers.ts'
import { StructuralFailure } from '../../src/core/failure-codes.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { populatedContract } from '../schemas/fixtures/relevance-contracts.ts'

function structuralFailureOf(fn: () => void): StructuralFailure {
	try {
		fn()
	} catch (error) {
		if (error instanceof StructuralFailure) return error
		throw error
	}
	throw new Error('expected a StructuralFailure to be thrown')
}

describe('checkWaiverCompleteness: waiver-incomplete', () => {
	it("fixture 37: passes with no throw against populatedContract (W-001's condition: null must not fire)", () => {
		expect(() =>
			checkWaiverCompleteness(EvalContract.parse(populatedContract)),
		).not.toThrow()
	})

	it.each(['rule', 'rationale', 'approval', 'expiresAt'] as const)(
		"fixture 38: ad5-admissions.test.ts's null-%s mutation throws with artifactPath ending in that part",
		(part) => {
			const contract = structuredClone(populatedContract) as any
			contract.waivers[0][part] = null
			const failure = structuralFailureOf(() =>
				checkWaiverCompleteness(contract),
			)
			expect(failure.code).toBe('waiver-incomplete')
			expect(failure.artifactPath.endsWith(`.${part}`)).toBe(true)
		},
	)

	it("fixture 39: ad5-admissions.test.ts's null-condition-alone mutation does not throw", () => {
		const contract = structuredClone(populatedContract) as any
		contract.waivers[0].condition = null
		expect(() => checkWaiverCompleteness(contract)).not.toThrow()
	})

	it('fixture 40: first-violation-wins: a clean first waiver and a second waiver missing approval names the second', () => {
		const contract = structuredClone(populatedContract) as any
		const second = structuredClone(contract.waivers[0])
		second.id = 'W-002'
		second.approval = null
		contract.waivers.push(second)
		const failure = structuralFailureOf(() => checkWaiverCompleteness(contract))
		expect(failure.artifactPath).toContain('waivers[id=W-002]')
	})
})
