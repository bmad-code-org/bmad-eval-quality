import { describe, expect, it } from 'vitest'
import {
	CONNECTIVE_MINIMUM_ARITY,
	Expression,
	Operand,
	RELATION_VOCABULARY,
	SetOperand,
	TUPLE_ARITY,
} from '../../src/core/schemas/expression.ts'
import {
	literalOperand,
	pointerOperand,
	referenceSetOperand,
	VALID_NODES,
} from './fixtures/expression-nodes.ts'

const nodeEntries = Object.entries(VALID_NODES)
const tupleEntries = Object.entries(TUPLE_ARITY)

describe('the closed vocabulary', () => {
	it('names sixteen relations: eleven operators, three connectives, two quantifiers', () => {
		expect(RELATION_VOCABULARY).toHaveLength(16)
		expect(new Set(RELATION_VOCABULARY).size).toBe(16)
	})

	it('has one valid node per form, and every form is exercised', () => {
		expect(nodeEntries.map(([op]) => op).sort()).toEqual(
			[...RELATION_VOCABULARY].sort(),
		)
	})

	it.each(nodeEntries)('parses a valid %s node', (op, node) => {
		const result = Expression.safeParse(node)
		expect(result.error?.issues ?? []).toEqual([])
		expect(result.success).toBe(true)
		expect(result.data).toMatchObject({ op })
	})

	it('rejects an operator outside the vocabulary at the discriminator path', () => {
		const result = Expression.safeParse({ op: 'approximately', operands: [] })
		expect(result.success).toBe(false)
		expect(result.error?.issues[0]?.code).toBe('invalid_union')
		expect(result.error?.issues[0]?.path).toEqual(['op'])
	})
})

describe('operator arity, the one deliberate exception to the admit-rule', () => {
	it.each(tupleEntries)('%s rejects one operand too few', (op, arity) => {
		const node = structuredClone(
			VALID_NODES[op as keyof typeof VALID_NODES],
		) as { operands: unknown[] }
		node.operands = node.operands.slice(0, arity - 1)
		const result = Expression.safeParse(node)
		expect(result.success).toBe(false)
		expect(result.error?.issues[0]?.code).toBe('too_small')
		expect(result.error?.issues[0]?.path).toEqual(['operands'])
	})

	it.each(tupleEntries)('%s rejects one operand too many', (op) => {
		const node = structuredClone(
			VALID_NODES[op as keyof typeof VALID_NODES],
		) as { operands: unknown[] }
		node.operands = [...node.operands, node.operands[0]]
		const result = Expression.safeParse(node)
		expect(result.success).toBe(false)
		expect(result.error?.issues[0]?.code).toBe('too_big')
		expect(result.error?.issues[0]?.path).toEqual(['operands'])
	})

	it.each(['all', 'any'] as const)(
		'%s rejects a single operand, and a connective of one is the identity',
		(op) => {
			const result = Expression.safeParse({
				op,
				operands: [{ op: 'existence', operands: [pointerOperand] }],
			})
			expect(result.success).toBe(false)
			expect(result.error?.issues[0]?.code).toBe('too_small')
		},
	)

	it.each(['all', 'any'] as const)(
		'%s rejects zero operands, which would certify vacuously',
		(op) => {
			const result = Expression.safeParse({ op, operands: [] })
			expect(result.success).toBe(false)
			expect(result.error?.issues[0]?.code).toBe('too_small')
			expect(result.error?.issues[0]?.path).toEqual(['operands'])
		},
	)

	it('states the connective minimum once', () => {
		expect(CONNECTIVE_MINIMUM_ARITY).toBe(2)
	})
})

describe('the operand union', () => {
	it.each([pointerOperand, literalOperand, referenceSetOperand])(
		'admits %o',
		(operand) => {
			expect(Operand.safeParse(operand).success).toBe(true)
		},
	)

	it('rejects a two-key operand, because AD-26 fixes the reference-set form as single-keyed', () => {
		const result = Operand.safeParse({
			referenceSet: 'expected-things',
			collectionLocation: '/items',
		})
		expect(result.success).toBe(false)
		expect(result.error?.issues[0]?.code).toBe('invalid_union')
	})

	it('reports an operand failure as invalid_union with per-branch errors nested', () => {
		const result = Expression.safeParse({
			op: 'equality',
			operands: [{ nope: 1 }, pointerOperand],
		})
		expect(result.success).toBe(false)
		const issue = result.error?.issues[0]
		expect(issue?.code).toBe('invalid_union')
		expect(issue?.path).toEqual(['operands', 0])
		expect((issue as { errors?: unknown[] } | undefined)?.errors?.length).toBe(
			3,
		)
	})

	// AD-26 makes a reference-set operand outside its three legal positions fire
	// `malformed-operator-expression`. That only stays fireable if every other
	// position admits it, so this is an admission test rather than a preference.
	it.each(tupleEntries)(
		'%s admits a reference-set operand in every tuple position',
		(op, arity) => {
			if (op === 'not') return
			const node = structuredClone(
				VALID_NODES[op as keyof typeof VALID_NODES],
			) as { operands: unknown[] }
			for (let position = 0; position < arity; position += 1) {
				const mutated = structuredClone(node)
				mutated.operands[position] = referenceSetOperand
				const result = Expression.safeParse(mutated)
				// `set-membership`'s set position is the one deliberate narrowing, and
				// a reference-set operand is legal there too.
				expect(result.success).toBe(true)
			}
		},
	)
})

describe("set-membership's set operand, the one deliberately narrowed position", () => {
	it('admits a reference set', () => {
		expect(SetOperand.safeParse(referenceSetOperand).success).toBe(true)
	})

	it('admits a non-empty literal array', () => {
		expect(
			SetOperand.safeParse({ literal: ['queued', 'running'] }).success,
		).toBe(true)
	})

	it('rejects an empty literal array, which makes the check unfalsifiable', () => {
		const result = Expression.safeParse({
			op: 'set-membership',
			operands: [pointerOperand, { literal: [] }],
		})
		expect(result.success).toBe(false)
		// Verified on the pin: where exactly one union branch is structurally
		// reachable, Zod surfaces that branch's own issue rather than an
		// invalid_union wrapper, so the minItems violation arrives directly.
		expect(result.error?.issues[0]?.code).toBe('too_small')
		expect(result.error?.issues[0]?.path).toEqual(['operands', 1, 'literal'])
	})

	it('rejects a pointer in the set position, which is the cost this narrowing names', () => {
		const result = Expression.safeParse({
			op: 'set-membership',
			operands: [pointerOperand, pointerOperand],
		})
		expect(result.success).toBe(false)
		expect(result.error?.issues[0]?.path).toEqual(['operands', 1])
	})
})

describe('regex anchoring is the schema half of AD-4', () => {
	it('accepts a fully anchored pattern', () => {
		expect(
			Expression.safeParse({
				op: 'regex',
				operands: [pointerOperand],
				pattern: '^[a-z]+$',
			}).success,
		).toBe(true)
	})

	it.each(['abc', '^abc', 'abc$'])('rejects the unanchored %s', (pattern) => {
		const result = Expression.safeParse({
			op: 'regex',
			operands: [pointerOperand],
			pattern,
		})
		expect(result.success).toBe(false)
		expect(result.error?.issues[0]?.path).toEqual(['pattern'])
		expect(result.error?.issues[0]?.code).toBe('invalid_format')
	})

	// Recorded rather than closed: the form checks the first and last character
	// and cannot decide full anchoring, which needs a parse. Both shapes below
	// satisfy it without being anchored, and both join the backreference and
	// lookbehind cases as Epic 4's.
	it.each([
		['^a|b$', 'an alternation, which parses as (^a)|(b$)'],
		['^foo\\$', 'a trailing dollar that is escaped'],
	])('admits %s (%s), which the positional check cannot catch', (pattern) => {
		expect(
			Expression.safeParse({
				op: 'regex',
				operands: [pointerOperand],
				pattern,
			}).success,
		).toBe(true)
	})

	it('admits a backreference and a lookbehind, which are Epic 4 rejections rather than parse failures', () => {
		expect(
			Expression.safeParse({
				op: 'regex',
				operands: [pointerOperand],
				pattern: '^(a)\\1$',
			}).success,
		).toBe(true)
		expect(
			Expression.safeParse({
				op: 'regex',
				operands: [pointerOperand],
				pattern: '^(?<=a)b$',
			}).success,
		).toBe(true)
	})
})

describe('count-tolerance carries a non-negative magnitude', () => {
	const node = {
		op: 'count-tolerance',
		operands: [pointerOperand],
		expected: 3,
		tolerance: 0,
		relative: false,
	}

	it.each(['expected', 'tolerance'])('rejects a negative %s', (field) => {
		const result = Expression.safeParse({ ...node, [field]: -1 })
		expect(result.success).toBe(false)
		expect(result.error?.issues[0]?.code).toBe('too_small')
		expect(result.error?.issues[0]?.path).toEqual([field])
	})

	// A relative tolerance is read as whole percentage points, which is why an
	// integer suffices. The field description states it so Epic 3 inherits one
	// reading rather than two.
	it.each([true, false])(
		'rejects a fractional tolerance when relative is %s',
		(relative) => {
			const result = Expression.safeParse({ ...node, relative, tolerance: 2.5 })
			expect(result.success).toBe(false)
			expect(result.error?.issues[0]?.code).toBe('invalid_type')
			expect(result.error?.issues[0]?.path).toEqual(['tolerance'])
		},
	)

	it('requires the relative flag explicitly rather than defaulting it', () => {
		const { relative: _relative, ...withoutFlag } = node
		const result = Expression.safeParse(withoutFlag)
		expect(result.success).toBe(false)
		expect(result.error?.issues[0]?.path).toEqual(['relative'])
	})
})

describe('shapes the schema admits on purpose so Epic 4 keeps a fixture', () => {
	it('admits a quantifier inside a quantifier', () => {
		const result = Expression.safeParse({
			op: 'for-all',
			collection: pointerOperand,
			predicate: {
				op: 'for-any',
				collection: { pointer: '@/children' },
				predicate: { op: 'existence', operands: [{ pointer: '@/id' }] },
			},
		})
		expect(result.success).toBe(true)
	})

	it('admits covers-by-key inside a quantifier', () => {
		const result = Expression.safeParse({
			op: 'for-all',
			collection: pointerOperand,
			predicate: {
				op: 'covers-by-key',
				operands: [referenceSetOperand, { pointer: '@/rows' }],
				expectedKey: 'id',
				actualKey: 'id',
			},
		})
		expect(result.success).toBe(true)
	})

	it('admits a reference-set identifier the contract never declares', () => {
		expect(Operand.safeParse({ referenceSet: 'never-declared' }).success).toBe(
			true,
		)
	})
})

describe("shape's descriptor is typed rather than a literal", () => {
	it('rejects the Gate C fixture spelling, where any JSON could sit', () => {
		// One operand, so arity cannot be what rejects this: the descriptor being
		// typed is. A two-operand spelling would fail on `too_big` and the test
		// would stay green even if `descriptor` were untyped.
		const result = Expression.safeParse({
			op: 'shape',
			operands: [pointerOperand],
			descriptor: { literal: { requiredKeys: ['id'] } },
		})
		expect(result.success).toBe(false)
		expect(
			result.error?.issues.map((issue) => ({
				path: issue.path,
				code: issue.code,
			})),
		).toEqual([
			{ path: ['descriptor', 'requiredKeys'], code: 'invalid_type' },
			{ path: ['descriptor', 'permittedKeys'], code: 'invalid_type' },
			{ path: ['descriptor', 'types'], code: 'invalid_type' },
			{ path: ['descriptor'], code: 'unrecognized_keys' },
		])
	})

	it('rejects a descriptor key typed outside the JSON type names', () => {
		const result = Expression.safeParse({
			op: 'shape',
			operands: [pointerOperand],
			descriptor: {
				requiredKeys: ['id'],
				permittedKeys: ['id'],
				types: { id: 'uuid' },
			},
		})
		expect(result.success).toBe(false)
		expect(result.error?.issues[0]?.path).toEqual(['descriptor', 'types', 'id'])
	})
})
