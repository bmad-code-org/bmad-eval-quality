import { describe, expect, it } from 'vitest'
import { canonicalize } from '../../src/core/canonical/canonicalize.ts'
import { faultOf } from './helpers.ts'

const PATH = 'artifacts/canonical.json'

const canonicalText = (value: unknown): string =>
	new TextDecoder().decode(canonicalize(value, PATH))

const canonicalHex = (value: unknown): string =>
	Buffer.from(canonicalize(value, PATH)).toString('hex')

describe('canonicalize: RFC 8785 number rendering (ECMAScript Number::toString)', () => {
	const cases: Array<[value: number, rendered: string]> = [
		[-0, '0'],
		[1.0, '1'],
		[0.95, '0.95'],
		[0.99, '0.99'],
		[0.8, '0.8'],
		[0.04, '0.04'],
		[62.5, '62.5'],
		[1e-7, '1e-7'],
		[5e-324, '5e-324'],
		[0.000001, '0.000001'],
		[9007199254740991, '9007199254740991'],
		[-9007199254740991, '-9007199254740991'],
		[0, '0'],
	]
	for (const [value, rendered] of cases) {
		it(`renders ${rendered}`, () => {
			expect(canonicalText(value)).toBe(rendered)
		})
	}
})

describe('canonicalize: structure', () => {
	it('emits no insignificant whitespace and preserves array order', () => {
		expect(canonicalText({ b: [3, 1, 2], a: 'x' })).toBe(
			'{"a":"x","b":[3,1,2]}',
		)
	})

	it('renders literals', () => {
		expect(canonicalText(null)).toBe('null')
		expect(canonicalText(true)).toBe('true')
		expect(canonicalText(false)).toBe('false')
	})

	it('renders empty object, empty array, empty string', () => {
		expect(canonicalText({})).toBe('{}')
		expect(canonicalText([])).toBe('[]')
		expect(canonicalText('')).toBe('""')
	})

	it('escapes strings with JSON.stringify semantics', () => {
		expect(canonicalText('\b\t\n\f\r"\\')).toBe('"\\b\\t\\n\\f\\r\\"\\\\"')
		expect(canonicalText('\u0001')).toBe('"\\u0001"')
		expect(canonicalText('é😀')).toBe('"é😀"')
	})

	it('encodes to UTF-8 bytes, not a JS string', () => {
		// "é" is C3 A9 in UTF-8, wrapped in quotes (22).
		expect(canonicalHex('é')).toBe('22c3a922')
	})
})

describe('canonicalize: key sorting by UTF-16 code unit', () => {
	it('sorts plain keys', () => {
		expect(canonicalText({ b: 2, a: 1, ab: 3 })).toBe('{"a":1,"ab":3,"b":2}')
	})

	it('sorts the surrogate-pair key U+1F600 before the BMP key U+FB33 (code-unit order, not code-point)', () => {
		// U+1F600 is D83D DE00 in UTF-16; D83D < FB33 (dalet with dagesh), so the
		// emoji sorts first even though its code point is larger. Escapes, not
		// literals: a precomposed U+FB33 literal would silently NFC-decompose
		// under any normalizing tool.
		expect(canonicalText({ '\ufb33': 2, '\ud83d\ude00': 1 })).toBe(
			'{"\ud83d\ude00":1,"\ufb33":2}',
		)
	})

	it('produces identical bytes for two insertion orders', () => {
		const first = canonicalHex({ a: 1, b: 2, c: [true, null] })
		const second = canonicalHex({ c: [true, null], b: 2, a: 1 })
		expect(first).toBe(second)
	})
})

describe('canonicalize: value-domain enforcement', () => {
	const cases: Array<[name: string, value: unknown]> = [
		['a Date', new Date(0)],
		['an unsafe integer', 2 ** 53],
		['a lone surrogate', '\ud800'],
		['undefined', undefined],
		['a bigint', 1n],
	]
	for (const [name, value] of cases) {
		it(`throws non-canonicalizable-value for ${name}`, () => {
			const fault = faultOf(() => canonicalize(value, PATH))
			expect(fault.code).toBe('non-canonicalizable-value')
			expect(fault.artifactPath).toBe(PATH)
		})
	}

	it('never digests a value the validation pass did not see (lying Proxy)', () => {
		// The proxy answers the validation read with 1 and every later read with
		// NaN. Introspection-based validation cannot detect this, so the
		// serializer re-asserts the scalar domain at emit time — without it,
		// JSON.stringify(NaN) would silently write the literal null.
		let reads = 0
		const target = { a: 1 }
		const lying = new Proxy(target, {
			get: (obj, key, receiver) => {
				if (key === 'a') return ++reads === 1 ? 1 : Number.NaN
				return Reflect.get(obj, key, receiver)
			},
		})
		const fault = faultOf(() => canonicalize(lying, PATH))
		expect(fault.code).toBe('non-canonicalizable-value')
	})
})
