import { describe, expect, it } from 'vitest'
import {
	checkOperandLegality,
	checkQuantifierNesting,
	checkQuantifierOverNonCollection,
	checkReferenceSetResolution,
	checkRegexConstructs,
} from '../../src/core/compile/expression-legality.ts'
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

describe('all five checks: positive whole-fixture regression', () => {
	it('fixture 16: all five checks pass with no throw against populatedContract and gateCContract', () => {
		for (const raw of [populatedContract, gateCContract]) {
			const contract = EvalContract.parse(raw)
			expect(() => checkOperandLegality(contract)).not.toThrow()
			expect(() => checkRegexConstructs(contract)).not.toThrow()
			expect(() => checkQuantifierNesting(contract)).not.toThrow()
			expect(() => checkQuantifierOverNonCollection(contract)).not.toThrow()
			expect(() => checkReferenceSetResolution(contract)).not.toThrow()
		}
	})
})

describe('checkOperandLegality: malformed-operator-expression', () => {
	it("fixture 17: ad5-admissions.test.ts's reference-set-outside-legal-positions mutation throws", () => {
		const contract = structuredClone(populatedContract) as any
		contract.oracles[0].check = {
			op: 'equality',
			operands: [
				{ referenceSet: 'expected-things' },
				{ referenceSet: 'expected-things' },
			],
		}
		const failure = structuralFailureOf(() => checkOperandLegality(contract))
		expect(failure.code).toBe('malformed-operator-expression')
	})

	it('fixture 28: artifactPath names the exact operand position as well as the oracle', () => {
		const contract = structuredClone(populatedContract) as any
		contract.oracles[0].check = {
			op: 'equality',
			operands: [
				{ referenceSet: 'expected-things' },
				{ referenceSet: 'expected-things' },
			],
		}
		const failure = structuralFailureOf(() => checkOperandLegality(contract))
		expect(failure.artifactPath).toBe(
			'EvalContract.oracles[id=O-001].check.operands[0]',
		)
	})

	const pointer = { pointer: '/interactions/list/response-body/items' }
	const literal = { literal: 'illegal-here' }
	const referenceSet = { referenceSet: 'expected-things' }
	const illegalOperandCases: {
		label: string
		check: Record<string, unknown>
		path: string
	}[] = [
		{
			label: 'equality operand 0',
			check: { op: 'equality', operands: [referenceSet, pointer] },
			path: 'operands[0]',
		},
		{
			label: 'equality operand 1',
			check: { op: 'equality', operands: [pointer, referenceSet] },
			path: 'operands[1]',
		},
		{
			label: 'deep-equality operand 0',
			check: { op: 'deep-equality', operands: [referenceSet, pointer] },
			path: 'operands[0]',
		},
		{
			label: 'deep-equality operand 1',
			check: { op: 'deep-equality', operands: [pointer, referenceSet] },
			path: 'operands[1]',
		},
		{
			label: 'containment container',
			check: { op: 'containment', operands: [literal, pointer] },
			path: 'operands[0]',
		},
		{
			label: 'existence operand',
			check: { op: 'existence', operands: [literal] },
			path: 'operands[0]',
		},
		{
			label: 'absence operand',
			check: { op: 'absence', operands: [literal] },
			path: 'operands[0]',
		},
		{
			label: 'regex operand',
			check: { op: 'regex', operands: [literal], pattern: '^x$' },
			path: 'operands[0]',
		},
		{
			label: 'set-membership value',
			check: { op: 'set-membership', operands: [literal, { literal: ['x'] }] },
			path: 'operands[0]',
		},
		{
			label: 'ordering operand',
			check: {
				op: 'ordering',
				operands: [literal],
				key: 'id',
				order: 'ascending',
			},
			path: 'operands[0]',
		},
		{
			label: 'count-tolerance operand',
			check: {
				op: 'count-tolerance',
				operands: [literal],
				expected: 1,
				tolerance: 0,
				relative: false,
			},
			path: 'operands[0]',
		},
		{
			label: 'shape operand',
			check: {
				op: 'shape',
				operands: [literal],
				descriptor: { requiredKeys: [], permittedKeys: [], types: {} },
			},
			path: 'operands[0]',
		},
		{
			label: 'covers-by-key expected',
			check: {
				op: 'covers-by-key',
				operands: [literal, pointer],
				expectedKey: 'id',
				actualKey: 'id',
			},
			path: 'operands[0]',
		},
		{
			label: 'covers-by-key actual',
			check: {
				op: 'covers-by-key',
				operands: [referenceSet, literal],
				expectedKey: 'id',
				actualKey: 'id',
			},
			path: 'operands[1]',
		},
		{
			label: 'for-all collection',
			check: {
				op: 'for-all',
				collection: literal,
				predicate: { op: 'existence', operands: [pointer] },
			},
			path: 'collection',
		},
		{
			label: 'for-any collection',
			check: {
				op: 'for-any',
				collection: literal,
				predicate: { op: 'existence', operands: [pointer] },
			},
			path: 'collection',
		},
	]

	it.each(illegalOperandCases)('rejects $label', ({ check, path }) => {
		const contract = structuredClone(populatedContract) as any
		contract.oracles[0].check = check
		const failure = structuralFailureOf(() => checkOperandLegality(contract))
		expect(failure.code).toBe('malformed-operator-expression')
		expect(failure.artifactPath).toContain(path)
	})

	it('rejects ordering over a call-inputs pointer', () => {
		const contract = structuredClone(populatedContract) as any
		contract.oracles[0].check = {
			op: 'ordering',
			operands: [{ pointer: '/interactions/list/call-inputs/query/limit' }],
			key: 'id',
			order: 'ascending',
		}
		expect(structuralFailureOf(() => checkOperandLegality(contract)).code).toBe(
			'malformed-operator-expression',
		)
	})

	it('rejects duplicate expectedKey values in a covers-by-key reference set', () => {
		const contract = structuredClone(populatedContract) as any
		contract.referenceSets['expected-things'].members[1].id = 't-1'
		const failure = structuralFailureOf(() => checkOperandLegality(contract))
		expect(failure.code).toBe('malformed-operator-expression')
		expect(failure.artifactPath).toContain(
			'referenceSets[id=expected-things].members[1].id',
		)
	})
})

describe('checkRegexConstructs: malformed-operator-expression', () => {
	it("fixture 18: ad5-admissions.test.ts's two regex-construct mutations each throw", () => {
		const backreference = structuredClone(populatedContract) as any
		backreference.oracles[0].check = {
			op: 'regex',
			operands: [{ pointer: '/interactions/list/response-body/items' }],
			pattern: '^(a)\\1$',
		}
		expect(
			structuralFailureOf(() => checkRegexConstructs(backreference)).code,
		).toBe('malformed-operator-expression')

		const lookbehind = structuredClone(populatedContract) as any
		lookbehind.oracles[0].check = {
			op: 'regex',
			operands: [{ pointer: '/interactions/list/response-body/items' }],
			pattern: '^(?<=a)b$',
		}
		expect(
			structuralFailureOf(() => checkRegexConstructs(lookbehind)).code,
		).toBe('malformed-operator-expression')
	})

	it('fixture 19: a pattern carrying neither construct does not throw', () => {
		const contract = structuredClone(populatedContract) as any
		contract.oracles[0].check = {
			op: 'regex',
			operands: [{ pointer: '/interactions/list/response-body/items' }],
			pattern: '^[a-z]+$',
		}
		expect(() => checkRegexConstructs(contract)).not.toThrow()
	})

	it.each([
		['named backreference', '^(?<word>a)\\k<word>$'],
		['negative lookbehind', '^(?<!a)b$'],
	])('rejects a %s', (_label, pattern) => {
		const contract = structuredClone(populatedContract) as any
		contract.oracles[0].check = {
			op: 'regex',
			operands: [{ pointer: '/interactions/list/response-body/items' }],
			pattern,
		}
		expect(structuralFailureOf(() => checkRegexConstructs(contract)).code).toBe(
			'malformed-operator-expression',
		)
	})

	it.each([
		['unanchored top-level alternation', '^a|b$'],
		['escaped trailing dollar', '^price\\$'],
		['invalid ECMA-262 source', '^[a-$'],
	])('rejects an %s', (_label, pattern) => {
		const contract = structuredClone(populatedContract) as any
		contract.oracles[0].check = {
			op: 'regex',
			operands: [{ pointer: '/interactions/list/response-body/items' }],
			pattern,
		}
		expect(structuralFailureOf(() => checkRegexConstructs(contract)).code).toBe(
			'malformed-operator-expression',
		)
	})
})

describe('checkQuantifierOverNonCollection: quantifier-over-non-collection', () => {
	it.each(['for-all', 'for-any'])(
		'fixture 20: %s over a scalar field throws',
		(op) => {
			const contract = structuredClone(populatedContract) as any
			contract.oracles[0].check = {
				op,
				collection: { pointer: '/interactions/create/response-body/id' },
				predicate: { op: 'existence', operands: [{ pointer: '@/x' }] },
			}
			const failure = structuralFailureOf(() =>
				checkQuantifierOverNonCollection(contract),
			)
			expect(failure.code).toBe('quantifier-over-non-collection')
		},
	)

	it('rejects an object-typed field as a definite non-collection', () => {
		const contract = structuredClone(populatedContract) as any
		contract.permittedInterfaces[0].operations[0].responseDescriptor.types.id =
			'object'
		contract.oracles[0].check = {
			op: 'for-all',
			collection: { pointer: '/interactions/create/response-body/id' },
			predicate: { op: 'existence', operands: [{ pointer: '@/x' }] },
		}
		expect(
			structuralFailureOf(() => checkQuantifierOverNonCollection(contract))
				.code,
		).toBe('quantifier-over-non-collection')
	})

	it('gives a declared non-array type precedence over a contradictory collection location', () => {
		const contract = structuredClone(populatedContract) as any
		contract.permittedInterfaces[0].operations[1].responseDescriptor.types.items =
			'string'
		contract.oracles[0].check = {
			op: 'for-all',
			collection: { pointer: '/interactions/list/response-body/items' },
			predicate: { op: 'existence', operands: [{ pointer: '@/id' }] },
		}
		expect(
			structuralFailureOf(() => checkQuantifierOverNonCollection(contract))
				.code,
		).toBe('quantifier-over-non-collection')
	})

	it('does not crash when operation IDs repeat across interfaces', () => {
		const contract = structuredClone(populatedContract) as any
		const duplicate = structuredClone(contract.permittedInterfaces[0])
		duplicate.logicalId = 'second-api'
		duplicate.operations = [structuredClone(duplicate.operations[0])]
		duplicate.operations[0].method = 'PUT'
		duplicate.operations[0].pathTemplate = '/other-things'
		contract.permittedInterfaces.push(duplicate)
		expect(() => checkQuantifierOverNonCollection(contract)).not.toThrow()
	})

	it('does not crash when step IDs repeat', () => {
		const contract = structuredClone(populatedContract) as any
		contract.interactionPlan.push(structuredClone(contract.interactionPlan[0]))
		expect(() => checkQuantifierOverNonCollection(contract)).not.toThrow()
	})

	it('fixture 21: a different scalar field on the same operation also throws', () => {
		const contract = structuredClone(populatedContract) as any
		contract.oracles[0].check = {
			op: 'for-all',
			collection: { pointer: '/interactions/create/response-body/error' },
			predicate: { op: 'existence', operands: [{ pointer: '@/x' }] },
		}
		const failure = structuralFailureOf(() =>
			checkQuantifierOverNonCollection(contract),
		)
		expect(failure.code).toBe('quantifier-over-non-collection')
	})

	it('fixture 22: an undeclared first token does not throw (permissive default)', () => {
		const contract = structuredClone(populatedContract) as any
		contract.oracles[0].check = {
			op: 'for-all',
			collection: { pointer: '/interactions/create/response-body/notAField' },
			predicate: { op: 'existence', operands: [{ pointer: '@/x' }] },
		}
		expect(() => checkQuantifierOverNonCollection(contract)).not.toThrow()
	})
})

describe('checkQuantifierNesting: quantifier-nesting-exceeded', () => {
	it("fixture 23: ad5-admissions.test.ts's two mutations (nested quantifier, covers-by-key inside one) each throw", () => {
		const nestedQuantifier = structuredClone(populatedContract) as any
		nestedQuantifier.oracles[0].check = {
			op: 'for-all',
			collection: { pointer: '/interactions/list/response-body/items' },
			predicate: {
				op: 'for-any',
				collection: { pointer: '@/children' },
				predicate: { op: 'existence', operands: [{ pointer: '@/id' }] },
			},
		}
		expect(
			structuralFailureOf(() => checkQuantifierNesting(nestedQuantifier)).code,
		).toBe('quantifier-nesting-exceeded')

		const coversByKeyInside = structuredClone(populatedContract) as any
		coversByKeyInside.oracles[0].check = {
			op: 'for-all',
			collection: { pointer: '/interactions/list/response-body/items' },
			predicate: {
				op: 'covers-by-key',
				operands: [{ referenceSet: 'expected-things' }, { pointer: '@/rows' }],
				expectedKey: 'id',
				actualKey: 'id',
			},
		}
		expect(
			structuralFailureOf(() => checkQuantifierNesting(coversByKeyInside)).code,
		).toBe('quantifier-nesting-exceeded')
	})

	it('fixture 24: two sibling top-level quantifiers under an "all" do not throw (depth does not leak across branches)', () => {
		const contract = structuredClone(populatedContract) as any
		contract.oracles[0].check = {
			op: 'all',
			operands: [
				{
					op: 'for-all',
					collection: { pointer: '/interactions/list/response-body/items' },
					predicate: { op: 'existence', operands: [{ pointer: '@/id' }] },
				},
				{
					op: 'for-any',
					collection: { pointer: '/interactions/list/response-body/items' },
					predicate: { op: 'existence', operands: [{ pointer: '@/id' }] },
				},
			],
		}
		expect(() => checkQuantifierNesting(contract)).not.toThrow()
	})
})

describe('checkReferenceSetResolution: unresolved-reference-set', () => {
	it("fixture 25: ad5-admissions.test.ts's mutation throws", () => {
		const contract = structuredClone(populatedContract) as any
		contract.oracles[0].check.operands[0] = { referenceSet: 'never-declared' }
		const failure = structuralFailureOf(() =>
			checkReferenceSetResolution(contract),
		)
		expect(failure.code).toBe('unresolved-reference-set')
	})

	it('fixture 26: an undeclared referenceSet in the SetOperand position throws via onSetOperand', () => {
		const contract = structuredClone(populatedContract) as any
		contract.oracles[0].check = {
			op: 'set-membership',
			operands: [
				{ pointer: '/interactions/list/response-body/items' },
				{ referenceSet: 'never-declared' },
			],
		}
		const failure = structuralFailureOf(() =>
			checkReferenceSetResolution(contract),
		)
		expect(failure.code).toBe('unresolved-reference-set')
	})

	it('fixture 27: contract.referenceSets = null with a referenceSet operand present throws', () => {
		const contract = structuredClone(populatedContract) as any
		contract.referenceSets = null
		const failure = structuralFailureOf(() =>
			checkReferenceSetResolution(contract),
		)
		expect(failure.code).toBe('unresolved-reference-set')
	})

	it('does not resolve inherited constructor as a declared reference set', () => {
		const contract = structuredClone(populatedContract) as any
		contract.oracles[0].check.operands[0] = { referenceSet: 'constructor' }
		expect(
			structuralFailureOf(() => checkReferenceSetResolution(contract)).code,
		).toBe('unresolved-reference-set')
	})

	it('accepts constructor when it is an own declared reference-set property', () => {
		const contract = structuredClone(populatedContract) as any
		contract.referenceSets.constructor = {
			keys: ['id'],
			members: [{ id: 't-1' }],
			commentary: null,
		}
		contract.oracles[0].check.operands[0] = { referenceSet: 'constructor' }
		expect(() => checkReferenceSetResolution(contract)).not.toThrow()
	})
})
