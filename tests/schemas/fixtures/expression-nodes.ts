// One valid node per expression form, plus the operand shorthands the tests
// mutate. Enumerated programmatically by the arity tests so a form nobody
// exercises cannot go silently dead.

import type { Expression } from '../../../src/core/schemas/expression.ts'

export const pointerOperand = {
	pointer: '/interactions/list/response-body/items',
}

export const boundOperand = { pointer: '@/id' }
export const literalOperand = { literal: 42 }
export const referenceSetOperand = { referenceSet: 'expected-things' }

export const VALID_NODES = {
	equality: { op: 'equality', operands: [pointerOperand, literalOperand] },
	'deep-equality': {
		op: 'deep-equality',
		operands: [pointerOperand, pointerOperand],
	},
	containment: {
		op: 'containment',
		operands: [pointerOperand, referenceSetOperand],
	},
	existence: { op: 'existence', operands: [pointerOperand] },
	absence: { op: 'absence', operands: [pointerOperand] },
	regex: { op: 'regex', operands: [pointerOperand], pattern: '^t-[0-9]+$' },
	'set-membership': {
		op: 'set-membership',
		operands: [pointerOperand, referenceSetOperand],
	},
	ordering: {
		op: 'ordering',
		operands: [pointerOperand],
		key: 'capturedAt',
		order: 'ascending',
	},
	'count-tolerance': {
		op: 'count-tolerance',
		operands: [pointerOperand],
		expected: 3,
		tolerance: 0,
		relative: false,
	},
	shape: {
		op: 'shape',
		operands: [pointerOperand],
		descriptor: {
			requiredKeys: ['id'],
			permittedKeys: ['id', 'name'],
			types: { id: 'string', name: null },
		},
	},
	'covers-by-key': {
		op: 'covers-by-key',
		operands: [referenceSetOperand, pointerOperand],
		expectedKey: 'id',
		actualKey: 'id',
	},
	not: {
		op: 'not',
		operands: [{ op: 'existence', operands: [pointerOperand] }],
	},
	all: {
		op: 'all',
		operands: [
			{ op: 'existence', operands: [pointerOperand] },
			{ op: 'absence', operands: [pointerOperand] },
		],
	},
	any: {
		op: 'any',
		operands: [
			{ op: 'existence', operands: [pointerOperand] },
			{ op: 'absence', operands: [pointerOperand] },
		],
	},
	'for-all': {
		op: 'for-all',
		collection: pointerOperand,
		predicate: { op: 'existence', operands: [boundOperand] },
	},
	'for-any': {
		op: 'for-any',
		collection: pointerOperand,
		predicate: { op: 'existence', operands: [boundOperand] },
	},
} as const satisfies Record<string, Expression>
