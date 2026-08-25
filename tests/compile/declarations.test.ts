import { describe, expect, it } from 'vitest'
import {
	checkObservableSuccessCriterion,
	checkRequirementLinkage,
} from '../../src/core/compile/declarations.ts'
import { StructuralFailure } from '../../src/core/failure-codes.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { gateCContract } from '../schemas/fixtures/gate-c-contract.ts'
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

describe('checkRequirementLinkage: missing-requirement-linkage', () => {
	it('fixture 1: passes with no throw against populatedContract and gateCContract', () => {
		expect(() =>
			checkRequirementLinkage(EvalContract.parse(populatedContract)),
		).not.toThrow()
		expect(() =>
			checkRequirementLinkage(EvalContract.parse(gateCContract)),
		).not.toThrow()
	})

	it("fixture 3: ad5-admissions.test.ts's mutation (both link arrays empty) throws with the behaviour's own artifactPath", () => {
		const contract = structuredClone(populatedContract) as any
		contract.behaviors[0].requirementLinks = []
		contract.behaviors[0].riskLinks = []
		const failure = structuralFailureOf(() => checkRequirementLinkage(contract))
		expect(failure.code).toBe('missing-requirement-linkage')
		expect(failure.artifactPath).toContain('behaviors[id=B-001]')
	})

	it('fixture 4: only one link array populated does not throw, in either direction', () => {
		const requirementOnly = structuredClone(populatedContract) as any
		requirementOnly.behaviors[0].riskLinks = []
		expect(() => checkRequirementLinkage(requirementOnly)).not.toThrow()

		const riskOnly = structuredClone(populatedContract) as any
		riskOnly.behaviors[0].requirementLinks = []
		expect(() => checkRequirementLinkage(riskOnly)).not.toThrow()
	})

	it('fixture 7: first-violation-wins: a clean first behaviour and a violating second behaviour name the second', () => {
		const contract = structuredClone(populatedContract) as any
		contract.behaviors.push({
			...structuredClone(contract.behaviors[0]),
			id: 'B-002',
			requirementLinks: [],
			riskLinks: [],
		})
		const failure = structuralFailureOf(() => checkRequirementLinkage(contract))
		expect(failure.artifactPath).toContain('behaviors[id=B-002]')
	})
})

describe('checkObservableSuccessCriterion: no-observable-success-criterion', () => {
	it('fixture 2: passes with no throw against populatedContract and gateCContract', () => {
		expect(() =>
			checkObservableSuccessCriterion(EvalContract.parse(populatedContract)),
		).not.toThrow()
		expect(() =>
			checkObservableSuccessCriterion(EvalContract.parse(gateCContract)),
		).not.toThrow()
	})

	it("fixture 5: ad5-admissions.test.ts's null-criterion mutation throws", () => {
		const contract = structuredClone(populatedContract) as any
		contract.behaviors[0].observableSuccessCriterion = null
		const failure = structuralFailureOf(() =>
			checkObservableSuccessCriterion(contract),
		)
		expect(failure.code).toBe('no-observable-success-criterion')
	})

	it("fixture 6: ad5-admissions.test.ts's empty-oracle-list mutation does not throw either declaration check", () => {
		const contract = structuredClone(populatedContract) as any
		contract.oracles = []
		contract.behaviors[0].oracles = []
		expect(() => checkRequirementLinkage(contract)).not.toThrow()
		expect(() => checkObservableSuccessCriterion(contract)).not.toThrow()
	})
})
