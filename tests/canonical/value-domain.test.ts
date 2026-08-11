import { describe, expect, it } from 'vitest'
import {
	assertHashedArtifactValue,
	MAX_NESTING_DEPTH,
} from '../../src/core/canonical/value-domain.ts'
import { faultOf } from './helpers.ts'

const PATH = 'artifacts/value.json'

describe('assertHashedArtifactValue: accepted values', () => {
	const cases: Array<[name: string, value: unknown]> = [
		['a nested plain structure', { a: [1, 2.5, 'x'], b: null, c: true }],
		['negative zero', -0],
		['the safe-integer maximum', 9007199254740991],
		['the safe-integer minimum', -9007199254740991],
		['the repository decimals', [0.95, 0.99, 0.8, 0.04, 62.5]],
		['the smallest denormal', 5e-324],
		['an empty object, array, and string', [{}, [], '']],
		['a null-prototype object', Object.assign(Object.create(null), { a: 1 })],
		['a well-formed surrogate pair', '😀'],
	]
	for (const [name, value] of cases) {
		it(`accepts ${name}`, () => {
			expect(() => assertHashedArtifactValue(value, PATH)).not.toThrow()
		})
	}

	it('accepts a shared (non-cyclic) substructure', () => {
		const shared = { x: 1 }
		expect(() =>
			assertHashedArtifactValue({ a: shared, b: shared }, PATH),
		).not.toThrow()
	})
})

describe('assertHashedArtifactValue: rejected values (non-canonicalizable-value)', () => {
	const toJsonCarrier = { toJSON: () => 1 }
	const cyclic: Record<string, unknown> = {}
	cyclic.self = cyclic

	const cases: Array<[name: string, value: unknown]> = [
		['NaN', Number.NaN],
		['Infinity', Number.POSITIVE_INFINITY],
		['-Infinity', Number.NEGATIVE_INFINITY],
		['2^53 (representable, unsafe)', 2 ** 53],
		['2^53 + 2 (representable, unsafe)', 2 ** 53 + 2],
		['-(2^53)', -(2 ** 53)],
		['1e21 (integer-valued binary64)', 1e21],
		['a lone high surrogate in a string value', '\ud800'],
		['a lone low surrogate in a string value', 'a\udfffb'],
		['a lone surrogate in an object key', { '\ud800': 1 }],
		['a Date (toJSON carrier with a non-plain prototype)', new Date(0)],
		['a Map', new Map()],
		['a Set', new Set()],
		['a class instance', new (class Widget {})()],
		['an object with a non-plain prototype', Object.create({ inherited: 1 })],
		['a plain object carrying toJSON', toJsonCarrier],
		['a cyclic object', cyclic],
		['an Array subclass', new (class extends Array {})(0)],
		['an array carrying toJSON', Object.assign([1, 2], { toJSON: () => 'x' })],
		[
			'an array with an own non-index property',
			Object.assign([1, 2], { note: 'x' }),
		],
		// biome-ignore lint/suspicious/noSparseArray: the hole is the test subject
		['a sparse array', [1, , 2]],
		[
			'an object with a non-enumerable own property',
			Object.defineProperty({ a: 1 }, 'hidden', {
				value: 2,
				enumerable: false,
			}),
		],
		[
			'an object with a symbol-keyed own property',
			Object.assign({ a: 1 }, { [Symbol('s')]: 2 }),
		],
		[
			'an object with an accessor property (TOCTOU channel)',
			Object.defineProperty({ a: 1 }, 'b', {
				get: () => Number.NaN,
				enumerable: true,
			}),
		],
		[
			'an array with an accessor element (TOCTOU channel)',
			Object.defineProperty([1], 0, { get: () => Number.NaN }),
		],
		['undefined', undefined],
		['undefined nested in an array', [1, undefined]],
		['a function', () => 1],
		['a bigint', 1n],
		['a symbol', Symbol('x')],
		['a bad number nested deep', { a: [{ b: Number.NaN }] }],
	]
	for (const [name, value] of cases) {
		it(`rejects ${name}`, () => {
			const fault = faultOf(() => assertHashedArtifactValue(value, PATH))
			expect(fault.code).toBe('non-canonicalizable-value')
			expect(fault.artifactPath).toBe(PATH)
		})
	}

	it('rejects nesting beyond MAX_NESTING_DEPTH as a typed fault, never a RangeError', () => {
		let value: unknown = 1
		for (let i = 0; i <= MAX_NESTING_DEPTH; i++) value = [value]
		const fault = faultOf(() => assertHashedArtifactValue(value, PATH))
		expect(fault.code).toBe('non-canonicalizable-value')
		expect(fault.message).toContain('nesting depth')
	})

	it('accepts nesting at exactly MAX_NESTING_DEPTH', () => {
		let value: unknown = 1
		for (let i = 0; i < MAX_NESTING_DEPTH; i++) value = [value]
		expect(() => assertHashedArtifactValue(value, PATH)).not.toThrow()
	})
})
