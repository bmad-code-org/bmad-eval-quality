/** reads raw text, catches what JSON.parse hides */
import { RuntimeFault } from '../schemas/faults.ts'
import { MAX_NESTING_DEPTH } from './value-domain.ts'

// Lexical pre-parse validation (AD-36): hashed-artifact input is scanned from
// raw text, never handed to bare `JSON.parse`. Domain violations throw
// `non-canonicalizable-value`; input that does not parse at all (malformed
// syntax, bytes that fail fatal UTF-8 decoding) throws `schema-parse-failure`.
export function scanJson(
	input: Uint8Array | string,
	artifactPath: string,
): unknown {
	const text =
		typeof input === 'string' ? input : decodeUtf8(input, artifactPath)
	return new Scanner(text, artifactPath).scanDocument()
}

function decodeUtf8(bytes: Uint8Array, artifactPath: string): string {
	try {
		// fatal: a non-fatal decode substitutes U+FFFD for invalid sequences (a
		// producer's WTF-8-encoded lone surrogate would digest cleanly). ignoreBOM
		// keeps a leading U+FEFF in the text, where it fails JSON syntax below;
		// silently stripping it would let two implementations disagree on the same bytes.
		return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
			bytes,
		)
	} catch (error) {
		throw new RuntimeFault(
			'schema-parse-failure',
			artifactPath,
			'input is not valid UTF-8',
			{ cause: error },
		)
	}
}

const SAFE_INTEGER_MAX = 2n ** 53n - 1n

const isDigit = (ch: string | undefined): boolean =>
	ch !== undefined && ch >= '0' && ch <= '9'

const isAlphanumeric = (ch: string | undefined): boolean =>
	ch !== undefined && /[A-Za-z0-9]/.test(ch)

class Scanner {
	private position = 0
	private depth = 0
	// Assigned in the body: Node's type stripping refuses a constructor
	// parameter property, and every script importing this module through
	// `digest.ts` would die at load with `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`.
	private readonly text: string
	private readonly artifactPath: string

	constructor(text: string, artifactPath: string) {
		this.text = text
		this.artifactPath = artifactPath
	}

	scanDocument(): unknown {
		this.skipWhitespace()
		const value = this.scanValue()
		this.skipWhitespace()
		if (this.position < this.text.length)
			this.syntax('trailing content after the document')
		return value
	}

	private syntax(detail: string): never {
		throw new RuntimeFault(
			'schema-parse-failure',
			this.artifactPath,
			`${detail} at offset ${this.position}`,
		)
	}

	private domain(detail: string): never {
		throw new RuntimeFault(
			'non-canonicalizable-value',
			this.artifactPath,
			`${detail} at offset ${this.position}`,
		)
	}

	private skipWhitespace(): void {
		for (;;) {
			const ch = this.text[this.position]
			if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r')
				this.position++
			else return
		}
	}

	private scanValue(): unknown {
		const ch = this.text[this.position]
		switch (ch) {
			case undefined:
				this.syntax('unexpected end of input')
				break
			case '{':
				return this.scanObject()
			case '[':
				return this.scanArray()
			case '"':
				return this.scanString()
			case 't':
				return this.scanLiteral('true', true)
			case 'f':
				return this.scanLiteral('false', false)
			case 'n':
				return this.scanLiteral('null', null)
			default:
				if (ch === '-' || isDigit(ch)) return this.scanNumber()
				this.syntax(`unexpected character ${JSON.stringify(ch)}`)
		}
	}

	private scanLiteral<T>(literal: string, value: T): T {
		if (!this.text.startsWith(literal, this.position)) {
			this.syntax(`invalid literal, expected ${literal}`)
		}
		this.position += literal.length
		// Rejects "truex" here as an invalid literal, not as a structural error
		// surfacing later at the next comma or bracket.
		if (isAlphanumeric(this.text[this.position])) {
			this.syntax(`invalid literal starting with ${literal}`)
		}
		return value
	}

	// See MAX_NESTING_DEPTH in value-domain.ts for why this is bounded.
	private enterNesting(): void {
		if (++this.depth > MAX_NESTING_DEPTH) {
			this.domain(`nesting depth exceeds ${MAX_NESTING_DEPTH}`)
		}
	}

	private scanObject(): Record<string, unknown> {
		this.enterNesting()
		this.position++ // consume {
		const result: Record<string, unknown> = {}
		const seenKeys = new Set<string>()
		this.skipWhitespace()
		if (this.text[this.position] === '}') {
			this.position++
			this.depth--
			return result
		}
		for (;;) {
			this.skipWhitespace()
			if (this.text[this.position] !== '"')
				this.syntax('expected a string object key')
			const key = this.scanString()
			// Duplicates are compared on unescaped keys: {"A":1,"A":2} is a duplicate.
			if (seenKeys.has(key))
				this.domain(`duplicate object key ${JSON.stringify(key)}`)
			seenKeys.add(key)
			this.skipWhitespace()
			if (this.text[this.position] !== ':')
				this.syntax("expected ':' after object key")
			this.position++
			this.skipWhitespace()
			const value = this.scanValue()
			// A "__proto__" key must land as an own property, never a prototype mutation.
			Object.defineProperty(result, key, {
				value,
				enumerable: true,
				writable: true,
				configurable: true,
			})
			this.skipWhitespace()
			const next = this.text[this.position]
			if (next === ',') {
				this.position++
				continue
			}
			if (next === '}') {
				this.position++
				this.depth--
				return result
			}
			this.syntax("expected ',' or '}' in object")
		}
	}

	private scanArray(): unknown[] {
		this.enterNesting()
		this.position++ // consume [
		const result: unknown[] = []
		this.skipWhitespace()
		if (this.text[this.position] === ']') {
			this.position++
			this.depth--
			return result
		}
		for (;;) {
			this.skipWhitespace()
			result.push(this.scanValue())
			this.skipWhitespace()
			const next = this.text[this.position]
			if (next === ',') {
				this.position++
				continue
			}
			if (next === ']') {
				this.position++
				this.depth--
				return result
			}
			this.syntax("expected ',' or ']' in array")
		}
	}

	private scanString(): string {
		this.position++ // consume opening quote
		let result = ''
		for (;;) {
			const ch = this.text[this.position]
			if (ch === undefined) this.syntax('unterminated string')
			if (ch === '"') {
				this.position++
				break
			}
			if (ch === '\\') {
				result += this.scanEscape()
				continue
			}
			if (ch.charCodeAt(0) < 0x20)
				this.syntax('unescaped control character in string')
			result += ch
			this.position++
		}
		// Covers literal surrogates and escaped ones alike, in values and keys.
		if (!result.isWellFormed()) this.domain('lone surrogate in string')
		return result
	}

	private scanEscape(): string {
		this.position++ // consume backslash
		const ch = this.text[this.position]
		if (ch === undefined) this.syntax('unterminated escape sequence')
		this.position++
		switch (ch) {
			case '"':
				return '"'
			case '\\':
				return '\\'
			case '/':
				return '/'
			case 'b':
				return '\b'
			case 'f':
				return '\f'
			case 'n':
				return '\n'
			case 'r':
				return '\r'
			case 't':
				return '\t'
			case 'u': {
				const hex = this.text.slice(this.position, this.position + 4)
				if (!/^[0-9a-fA-F]{4}$/.test(hex)) this.syntax('invalid \\u escape')
				this.position += 4
				return String.fromCharCode(Number.parseInt(hex, 16))
			}
			default:
				this.syntax(`invalid escape character ${JSON.stringify(ch)}`)
		}
	}

	private scanNumber(): number {
		const start = this.position
		if (this.text[this.position] === '-') this.position++
		if (this.text[this.position] === '0') {
			this.position++
			if (isDigit(this.text[this.position]))
				this.syntax('leading zero in number')
		} else if (isDigit(this.text[this.position])) {
			while (isDigit(this.text[this.position])) this.position++
		} else {
			this.syntax('invalid number')
		}
		let integerSyntax = true
		if (this.text[this.position] === '.') {
			integerSyntax = false
			this.position++
			if (!isDigit(this.text[this.position]))
				this.syntax('expected digits after decimal point')
			while (isDigit(this.text[this.position])) this.position++
		}
		if (this.text[this.position] === 'e' || this.text[this.position] === 'E') {
			integerSyntax = false
			this.position++
			if (this.text[this.position] === '+' || this.text[this.position] === '-')
				this.position++
			if (!isDigit(this.text[this.position]))
				this.syntax('expected digits in exponent')
			while (isDigit(this.text[this.position])) this.position++
		}
		if (isAlphanumeric(this.text[this.position])) {
			this.syntax('invalid number')
		}
		const literal = this.text.slice(start, this.position)
		if (integerSyntax) {
			// Compared on the digits: JSON.parse would round 9007199254740993
			// invisibly. 2^53 - 1 has 16 digits, so anything longer is unsafe by
			// inspection. Checked first so a multi-megabyte literal never pays (or
			// weaponizes) an arbitrary-precision BigInt conversion.
			const digits = literal[0] === '-' ? literal.slice(1) : literal
			if (digits.length > 16 || BigInt(digits) > SAFE_INTEGER_MAX) {
				this.domain(`integer literal outside the safe range: ${literal}`)
			}
		}
		const value = Number(literal)
		if (!Number.isFinite(value)) {
			this.domain(`numeric literal is not finite in binary64: ${literal}`)
		}
		// Any literal whose binary64 value is an unsafe integer is rejected
		// regardless of spelling (9007199254740993.0, 9.007199254740993e15, 1e21):
		// two producers must not disagree.
		if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
			this.domain(
				`numeric literal is an unsafe integer in binary64: ${literal}`,
			)
		}
		return value
	}
}
