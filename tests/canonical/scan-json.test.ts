import { describe, expect, it } from 'vitest'
import { scanJson } from '../../src/core/canonical/scan-json.ts'
import { RuntimeFault } from '../../src/core/schemas/faults.ts'

const PATH = 'artifacts/scan.json'

const faultOf = (fn: () => unknown): RuntimeFault => {
	try {
		fn()
	} catch (error) {
		if (error instanceof RuntimeFault) return error
		throw error
	}
	throw new Error('expected a RuntimeFault to be thrown')
}

describe('scanJson: valid input', () => {
	it('parses a structured document', () => {
		expect(scanJson('{"a":[1,2.5,"x\\n"],"b":null,"c":true}', PATH)).toEqual({
			a: [1, 2.5, 'x\n'],
			b: null,
			c: true,
		})
	})

	it('accepts bytes and strings alike', () => {
		const bytes = new TextEncoder().encode('{"answer":42}')
		expect(scanJson(bytes, PATH)).toEqual({ answer: 42 })
		expect(scanJson('{"answer":42}', PATH)).toEqual({ answer: 42 })
	})

	it('parses top-level scalars', () => {
		expect(scanJson('0.95', PATH)).toBe(0.95)
		expect(scanJson('"text"', PATH)).toBe('text')
		expect(scanJson('null', PATH)).toBe(null)
		expect(scanJson('false', PATH)).toBe(false)
	})

	it('parses -0 to negative zero', () => {
		expect(Object.is(scanJson('-0', PATH), -0)).toBe(true)
	})

	it('accepts the safe-integer maximum 9007199254740991', () => {
		expect(scanJson('9007199254740991', PATH)).toBe(9007199254740991)
	})

	it('decodes paired surrogate escapes', () => {
		expect(scanJson('"\\ud83d\\ude00"', PATH)).toBe('😀')
	})

	it('keeps __proto__ as an own property, never a prototype mutation', () => {
		const value = scanJson('{"__proto__":{"x":1}}', PATH) as Record<
			string,
			unknown
		>
		expect(Object.getPrototypeOf(value)).toBe(Object.prototype)
		expect(Object.hasOwn(value, '__proto__')).toBe(true)
	})

	it('tolerates insignificant whitespace', () => {
		expect(scanJson(' {\n\t"a" : [ 1 , 2 ] }\r\n', PATH)).toEqual({ a: [1, 2] })
	})
})

describe('scanJson: value-domain violations (non-canonicalizable-value)', () => {
	const cases: Array<[name: string, rawText: string]> = [
		['integer literal above the safe range', '9007199254740993'],
		['negative integer literal below the safe range', '-9007199254740993'],
		[
			'2^53 exactly (bound is > 2^53 - 1, not "detect rounding")',
			'9007199254740992',
		],
		['unsafe integer spelled with a fraction', '9007199254740993.0'],
		['unsafe integer spelled with an exponent', '9.007199254740993e15'],
		['integer-valued binary64 at 1e21', '1e21'],
		['overflow literal 1e999 (parses to Infinity)', '1e999'],
		['duplicate object keys', '{"A":1,"A":2}'],
		['duplicate object keys after unescaping', '{"A":1,"\\u0041":2}'],
		['lone surrogate escape in a string value', '"\\ud800"'],
		['lone surrogate escape in an object key', '{"\\udead":1}'],
	]
	for (const [name, rawText] of cases) {
		it(`rejects ${name}`, () => {
			const fault = faultOf(() => scanJson(rawText, PATH))
			expect(fault.code).toBe('non-canonicalizable-value')
			expect(fault.artifactPath).toBe(PATH)
		})
	}
})

describe('scanJson: input that does not parse (schema-parse-failure)', () => {
	const textCases: Array<[name: string, rawText: string]> = [
		['an unterminated object', '{'],
		['a trailing comma', '{"a":1,}'],
		['empty input', ''],
		['trailing content after the document', '{} {}'],
		['a truncated literal', 'nul'],
		['an unescaped control character in a string', '"\u0001"'],
		['a leading-zero number', '01'],
		['a bare apostrophe string', "'a'"],
	]
	for (const [name, rawText] of textCases) {
		it(`rejects ${name}`, () => {
			const fault = faultOf(() => scanJson(rawText, PATH))
			expect(fault.code).toBe('schema-parse-failure')
			expect(fault.artifactPath).toBe(PATH)
		})
	}

	it('rejects bytes that are not valid UTF-8 (fatal decode)', () => {
		const fault = faultOf(() => scanJson(new Uint8Array([0xff]), PATH))
		expect(fault.code).toBe('schema-parse-failure')
	})

	it('rejects a WTF-8-encoded lone surrogate instead of substituting U+FFFD', () => {
		// U+D800 encoded the way a non-conformant producer would write it: ED A0 80.
		const wtf8 = new Uint8Array([0x22, 0xed, 0xa0, 0x80, 0x22])
		const fault = faultOf(() => scanJson(wtf8, PATH))
		expect(fault.code).toBe('schema-parse-failure')
	})

	it('rejects a UTF-8 BOM as content rather than silently stripping it', () => {
		const bom = new Uint8Array([0xef, 0xbb, 0xbf, 0x7b, 0x7d])
		const fault = faultOf(() => scanJson(bom, PATH))
		expect(fault.code).toBe('schema-parse-failure')
	})
})
