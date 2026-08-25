import { describe, expect, it } from 'vitest'
import {
	checkForbiddenInputFloor,
	checkScopedResourceReferences,
} from '../../src/core/compile/forbidden-inputs.ts'
import {
	EvalContract,
	FORBIDDEN_INPUT_FLOOR,
} from '../../src/core/schemas/eval-contract.ts'
import { gateCContract } from '../schemas/fixtures/gate-c-contract.ts'
import { populatedContract } from '../schemas/fixtures/relevance-contracts.ts'
import { structuralFailureOf } from './helpers.ts'

describe('checkForbiddenInputFloor: forbidden-input-floor-incomplete', () => {
	it('passes with no throw against populatedContract and gateCContract, both carrying all seven', () => {
		expect(() =>
			checkForbiddenInputFloor(EvalContract.parse(populatedContract)),
		).not.toThrow()
		expect(() =>
			checkForbiddenInputFloor(EvalContract.parse(gateCContract)),
		).not.toThrow()
	})

	it.each(FORBIDDEN_INPUT_FLOOR)('throws when %s is missing', (missing) => {
		const contract = structuredClone(populatedContract) as any
		contract.forbiddenInputs = FORBIDDEN_INPUT_FLOOR.filter(
			(member) => member !== missing,
		)
		const failure = structuralFailureOf(() =>
			checkForbiddenInputFloor(contract),
		)
		expect(failure.code).toBe('forbidden-input-floor-incomplete')
		expect(failure.artifactPath).toBe('EvalContract.forbiddenInputs')
		expect(failure.message).toContain(missing)
	})

	it('a list carrying all seven in a different order, plus a duplicate, does not throw', () => {
		const contract = structuredClone(populatedContract) as any
		contract.forbiddenInputs = [
			'human-labels',
			'comparator-results',
			'comparator-results',
			'implementation-logs',
			'builder-transcript',
			'repository',
			'source-code',
			'original-spec',
		]
		expect(() => checkForbiddenInputFloor(contract)).not.toThrow()
	})
})

describe('checkScopedResourceReferences: scoped-reference-resolves-forbidden', () => {
	it.each([null, []])('accepts %j scoped resources', (scopedResources) => {
		const contract = structuredClone(populatedContract) as any
		contract.scopedResources = scopedResources
		expect(() => checkScopedResourceReferences(contract)).not.toThrow()
	})

	it('rejects a populated scoped resource list', () => {
		const contract = structuredClone(populatedContract) as any
		contract.scopedResources = [
			{ reference: 'the-original-spec', kind: 'document' },
		]
		const failure = structuralFailureOf(() =>
			checkScopedResourceReferences(contract),
		)
		expect(failure.code).toBe('scoped-reference-resolves-forbidden')
		expect(failure.artifactPath).toBe(
			'EvalContract.scopedResources[0].reference',
		)
		expect(failure.message).toContain('the-original-spec')
	})
})
