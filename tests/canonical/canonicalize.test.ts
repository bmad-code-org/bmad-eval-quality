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
		expect(canonicalText('\u00e9\ud83d\ude00')).toBe('"\u00e9\ud83d\ude00"')
	})

	it('encodes to UTF-8 bytes, not a JS string', () => {
		// U+00E9 is C3 A9 in UTF-8, wrapped in quotes (22).
		expect(canonicalHex('\u00e9')).toBe('22c3a922')
	})
})

describe('canonicalize: key sorting by UTF-16 code unit', () => {
	it('sorts plain keys', () => {
		expect(canonicalText({ b: 2, a: 1, ab: 3 })).toBe('{"a":1,"ab":3,"b":2}')
	})

	it('sorts the surrogate-pair key U+1F600 before the BMP key U+FB33 (code-unit order, not code-point)', () => {
		// U+1F600 is D83D DE00 in UTF-16; D83D < FB33 (dalet with dagesh), so the
		// emoji sorts first even though its code point is larger. Written as
		// escapes because a precomposed U+FB33 literal would silently
		// NFC-decompose under any normalizing tool.
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

	it('emits exactly what it validated: a get-lying Proxy cannot split the reads', () => {
		// Validation is fused into serialization as one descriptor-snapshot read,
		// so a get trap that answers later reads differently has no later read to
		// answer: values come from the descriptor, and [[Get]] never fires twice.
		let reads = 0
		const target = { a: 1 }
		const lying = new Proxy(target, {
			get: (obj, key, receiver) => {
				if (key === 'a') return ++reads === 1 ? 1 : Number.NaN
				return Reflect.get(obj, key, receiver)
			},
		})
		expect(new TextDecoder().decode(canonicalize(lying, PATH))).toBe('{"a":1}')
	})

	it('validates keys on the same snapshot it emits (ownKeys-lying Proxy)', () => {
		// A Proxy that reports a lone-surrogate key faults: the key check runs
		// against the single ownKeys read the emitter uses.
		const lying = new Proxy(
			{},
			{
				ownKeys: () => ['\ud800'],
				getOwnPropertyDescriptor: () => ({
					value: 1,
					enumerable: true,
					writable: true,
					configurable: true,
				}),
			},
		)
		const fault = faultOf(() => canonicalize(lying, PATH))
		expect(fault.code).toBe('non-canonicalizable-value')
	})

	it('rejects a substituted non-plain object: a Date can never silently become {}', () => {
		// The descriptor read hands the serializer a Date; the fused pass checks
		// prototype plainness on the value it is about to emit, not on a value an
		// earlier traversal saw.
		const lying = new Proxy(
			{ a: 1 },
			{
				getOwnPropertyDescriptor: (obj, key) =>
					key === 'a'
						? {
								value: new Date(0),
								enumerable: true,
								writable: true,
								configurable: true,
							}
						: Object.getOwnPropertyDescriptor(obj, key),
			},
		)
		const fault = faultOf(() => canonicalize(lying, PATH))
		expect(fault.code).toBe('non-canonicalizable-value')
	})
})
