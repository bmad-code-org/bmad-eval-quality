import { describe, expect, it } from 'vitest'
import {
	checkOracleAlignment,
	checkOracleChannel,
	substitutePointer,
} from '../../src/core/compile/oracle-alignment.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { gateCContract } from '../schemas/fixtures/gate-c-contract.ts'
import { populatedContract } from '../schemas/fixtures/relevance-contracts.ts'
import { structuralFailureOf } from './helpers.ts'

describe('substitutePointer', () => {
	it('resolves bare @/ to the bound element without a trailing slash', () => {
		expect(
			substitutePointer('@/', '/interactions/list/response-body/items'),
		).toBe('/interactions/list/response-body/items')
	})
})

describe('checkOracleChannel: oracle-missing-channel', () => {
	it('fixture 8: passes with no throw against populatedContract and gateCContract', () => {
		expect(() =>
			checkOracleChannel(EvalContract.parse(populatedContract)),
		).not.toThrow()
		expect(() =>
			checkOracleChannel(EvalContract.parse(gateCContract)),
		).not.toThrow()
	})

	it("fixture 9: ad5-admissions.test.ts's two mutations each throw", () => {
		const nullDirection = structuredClone(populatedContract) as any
		nullDirection.oracles[0].direction = null
		const directionFailure = structuralFailureOf(() =>
			checkOracleChannel(nullDirection),
		)
		expect(directionFailure.code).toBe('oracle-missing-channel')
		expect(directionFailure.artifactPath).toMatch(/\.direction$/)

		const nullCheck = structuredClone(populatedContract) as any
		nullCheck.oracles[0].check = null
		const checkFailure = structuralFailureOf(() =>
			checkOracleChannel(nullCheck),
		)
		expect(checkFailure.code).toBe('oracle-missing-channel')
		expect(checkFailure.artifactPath).toMatch(/\.check$/)
	})
})

describe('checkOracleAlignment: direction-check-misaligned', () => {
	it('fixture 10: passes with no throw against every oracle in populatedContract and gateCContract, including O-004 (substitution-dependent)', () => {
		expect(() =>
			checkOracleAlignment(EvalContract.parse(populatedContract)),
		).not.toThrow()
		expect(() =>
			checkOracleAlignment(EvalContract.parse(gateCContract)),
		).not.toThrow()
	})

	it("fixture 11: ad5-admissions.test.ts's all-three-fields-disagreeing mutation throws on evidenceTargets first", () => {
		const contract = structuredClone(populatedContract) as any
		contract.oracles[0].direction.evidenceTargets = [
			'/interactions/create/response-body/ok',
		]
		contract.oracles[0].direction.relation = 'existence'
		contract.oracles[0].direction.polarity = 'expects-violation'
		const failure = structuralFailureOf(() => checkOracleAlignment(contract))
		expect(failure.code).toBe('direction-check-misaligned')
		expect(failure.artifactPath).toMatch(/\.direction\.evidenceTargets$/)
	})

	it('fixture 12: correct evidenceTargets, disagreeing relation throws on relation', () => {
		const contract = structuredClone(populatedContract) as any
		contract.oracles[0].direction.relation = 'existence'
		const failure = structuralFailureOf(() => checkOracleAlignment(contract))
		expect(failure.code).toBe('direction-check-misaligned')
		expect(failure.artifactPath).toMatch(/\.direction\.relation$/)
	})

	it('fixture 13: correct evidenceTargets and relation, disagreeing polarity throws on polarity', () => {
		const contract = structuredClone(populatedContract) as any
		contract.oracles[0].direction.polarity = 'expects-violation'
		const failure = structuralFailureOf(() => checkOracleAlignment(contract))
		expect(failure.code).toBe('direction-check-misaligned')
		expect(failure.artifactPath).toMatch(/\.direction\.polarity$/)
	})

	it('fixture 14: nested-quantifier substitution composes across two levels', () => {
		const contract = structuredClone(populatedContract) as any
		contract.oracles[0].direction.evidenceTargets = [
			'/interactions/list/response-body/items/children/id',
		]
		contract.oracles[0].direction.relation = 'existence'
		contract.oracles[0].check = {
			op: 'for-all',
			collection: { pointer: '/interactions/list/response-body/items' },
			predicate: {
				op: 'for-any',
				collection: { pointer: '@/children' },
				predicate: { op: 'existence', operands: [{ pointer: '@/id' }] },
			},
		}
		expect(() => checkOracleAlignment(contract)).not.toThrow()
	})

	it.each(['for-all', 'all', 'not'])(
		"relation %s genuinely absent from a check naming only 'for-any' and 'existence' still throws, proving containment isn't vacuous for a connective/quantifier relation",
		(relation) => {
			const contract = structuredClone(populatedContract) as any
			contract.oracles[0].direction.evidenceTargets = [
				'/interactions/list/response-body/items/id',
			]
			contract.oracles[0].direction.relation = relation
			contract.oracles[0].check = {
				op: 'for-any',
				collection: { pointer: '/interactions/list/response-body/items' },
				predicate: { op: 'existence', operands: [{ pointer: '@/id' }] },
			}
			const failure = structuralFailureOf(() => checkOracleAlignment(contract))
			expect(failure.code).toBe('direction-check-misaligned')
			expect(failure.artifactPath).toMatch(/\.direction\.relation$/)
		},
	)

	it("relation 'for-any' genuinely present, nested one level inside 'for-all', does not throw", () => {
		const contract = structuredClone(populatedContract) as any
		contract.oracles[0].direction.evidenceTargets = [
			'/interactions/list/response-body/items/children/id',
		]
		contract.oracles[0].direction.relation = 'for-any'
		contract.oracles[0].check = {
			op: 'for-all',
			collection: { pointer: '/interactions/list/response-body/items' },
			predicate: {
				op: 'for-any',
				collection: { pointer: '@/children' },
				predicate: { op: 'existence', operands: [{ pointer: '@/id' }] },
			},
		}
		expect(() => checkOracleAlignment(contract)).not.toThrow()
	})

	it('fixture 15: a null direction and a null check both pass through with no throw', () => {
		const nullDirection = structuredClone(populatedContract) as any
		nullDirection.oracles[0].direction = null
		expect(() => checkOracleAlignment(nullDirection)).not.toThrow()

		const nullCheck = structuredClone(populatedContract) as any
		nullCheck.oracles[0].check = null
		expect(() => checkOracleAlignment(nullCheck)).not.toThrow()
	})
})
