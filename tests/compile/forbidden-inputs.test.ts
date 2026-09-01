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

// A scoped reference is forbidden wherever the contract writes it down, so the
// same code fires on `testData.resources` as on `scopedResources`.
describe('checkScopedResourceReferences: testData.resources', () => {
	// `scopedResources` is read first, so it is cleared here to isolate the
	// second address; the both-declared case below is what pins the precedence.
	function contractWithResources(resources: unknown): any {
		const contract = structuredClone(populatedContract) as any
		contract.scopedResources = null
		contract.testData.resources = resources
		return contract
	}

	it.each([null, {}])('accepts %j declared resources', (resources) => {
		expect(() =>
			checkScopedResourceReferences(contractWithResources(resources)),
		).not.toThrow()
	})

	it('rejects a populated resource map, addressing the entry by its caller key', () => {
		const failure = structuralFailureOf(() =>
			checkScopedResourceReferences(
				contractWithResources({ 'seed-manifest': { kind: 'fixture' } }),
			),
		)
		expect(failure.code).toBe('scoped-reference-resolves-forbidden')
		expect(failure.artifactPath).toBe(
			'EvalContract.testData.resources["seed-manifest"]',
		)
		expect(failure.message).toContain('seed-manifest')
	})

	it('reports the lexicographically first entry, so which resource is named never depends on the authored key order', () => {
		const failure = structuralFailureOf(() =>
			checkScopedResourceReferences(
				contractWithResources({
					'zzz-fixture': { kind: 'fixture' },
					'aaa-fixture': { kind: 'fixture' },
					'mmm-fixture': { kind: 'fixture' },
				}),
			),
		)
		expect(failure.artifactPath).toBe(
			'EvalContract.testData.resources["aaa-fixture"]',
		)
	})

	it('reports the scopedResources entry when a contract carries both, that list being read first', () => {
		const contract = contractWithResources({
			'aaa-fixture': { kind: 'fixture' },
		})
		contract.scopedResources = [{ reference: 'zzz-manifest', kind: 'fixture' }]
		const failure = structuralFailureOf(() =>
			checkScopedResourceReferences(contract),
		)
		expect(failure.artifactPath).toBe(
			'EvalContract.scopedResources[0].reference',
		)
		expect(failure.message).toContain('zzz-manifest')
	})
})
