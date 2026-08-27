/**
 * The tokenizer behind `check:layers` and `check:lineage` (Story 6.4, AC 11
 * cases 52 through 59). A derailed tokenizer makes both gates report fewer
 * findings, which their "finds nothing in the real tree" cases cannot see.
 */

import { SyntaxKind } from 'typescript/unstable/ast'
import { describe, expect, it } from 'vitest'
import {
	computeLineStarts,
	lineOf,
	scanTokens,
} from '../../scripts/token-scan.ts'

/** the identifier texts in `source`, which is what both gates key on. */
const identifiers = (source: string): string[] =>
	scanTokens(source)
		.filter((token) => token.kind === SyntaxKind.Identifier)
		.map((token) => token.text)

describe('scanTokens', () => {
	// 52. Raw `scan()` reads the closing brace of `${…}` as a block brace, then
	// the template's tail as code, so the closing backtick opens a second
	// template and swallows the rest of the file.
	it('reads code after a template with a substitution', () => {
		expect(
			identifiers('const a = `x ${b} y`\nconst o = { after: 1 }\n'),
		).toEqual(['a', 'b', 'o', 'after'])
	})

	// 53
	it('reads code after nested, tagged, and brace-bearing substitutions', () => {
		expect(
			identifiers('const a = `${`inner ${b}`} t`\nconst after = 1\n'),
		).toEqual(['a', 'b', 'after'])
		expect(identifiers('const a = tag`x ${b} y`\nconst after = 1\n')).toEqual([
			'a',
			'tag',
			'b',
			'after',
		])
		// The object literal's own braces are what the depth bookkeeping is for:
		// drop it and this closing brace is misread as a template continuation.
		expect(identifiers('const a = `${ { k: v } }`\nconst after = 1\n')).toEqual(
			['a', 'k', 'v', 'after'],
		)
		expect(identifiers('const a = `${ "}" }`\nconst after = 1\n')).toEqual([
			'a',
			'after',
		])
	})

	// 54. A literal running to end of file leaves every token after its opening
	// quote reading as literal text.
	it('throws on an unterminated literal', () => {
		expect(() => scanTokens('const a = `runs to the end\n')).toThrow(
			/unterminated literal at offset/,
		)
		expect(() => scanTokens('const a = "runs to the end\n')).toThrow(
			/unterminated literal at offset/,
		)
	})

	// 55. A bare `#` makes the raw scanner emit a zero-width token forever.
	// Without the progress guard both gates run out of heap.
	it('throws on a token that makes no progress', () => {
		expect(() => scanTokens('const x = # 1\n')).toThrow(
			/made no progress at offset/,
		)
	})

	// 56. `lineOf` reports the line a violation is on, and both gates print it.
	// A token at column 0 is the boundary the binary search gets wrong.
	it('reports the line of a token at column 0', () => {
		const source = 'const a = 1\nparentDigest = 2\n'
		const starts = computeLineStarts(source)
		expect(lineOf(starts, 0)).toBe(1)
		expect(lineOf(starts, source.indexOf('parentDigest'))).toBe(2)
		expect(lineOf(starts, source.length - 1)).toBe(2)
	})

	// 57. A slash is division or a regex depending on the token before it. Left
	// to the raw scanner every regex body leaks into the stream as code, which
	// is where `#`, a backtick, an escaped slash and `{` each derailed a gate.
	it('tells a regex from division by the previous token', () => {
		expect(identifiers('const r = /^#/\nconst after = 1\n')).toEqual([
			'r',
			'after',
		])
		expect(identifiers('const r = /`/\nconst after = 1\n')).toEqual([
			'r',
			'after',
		])
		expect(
			identifiers("const s = `${p.replace(/^\\//, '')}`\nconst after = 1\n"),
		).toEqual(['s', 'p', 'replace', 'after'])
		// `src/core/evaluate/operators.ts` carries this one, and the brace
		// inside it shifted depth for every line after it.
		expect(identifiers('const q = /[*+?{]/\nconst after = 1\n')).toEqual([
			'q',
			'after',
		])
		expect(identifiers('const d = a / b\nconst e = (a) / b / c\n')).toEqual([
			'd',
			'a',
			'b',
			'e',
			'a',
			'b',
			'c',
		])
		// A statement's `)` and a block's `}` end no expression, so a slash
		// after either opens a regex.
		expect(identifiers('if (x) /re/.test(s)\n')).toEqual(['x', 'test', 's'])
		expect(identifiers('function f() {}\n/re/.test(s)\n')).toEqual([
			'f',
			'test',
			's',
		])
		// A postfix `!` inherits the token before it; a prefix `!` does not, and
		// `src/core/canonical/scan-json.ts` carries the prefix form.
		expect(identifiers('const q = a! / b / c\n')).toEqual(['q', 'a', 'b', 'c'])
		expect(identifiers('if (!/^[0-9]{4}$/.test(h)) {}\n')).toEqual([
			'test',
			'h',
		])
		// A type keyword ends an expression, so an `as` clause divides.
		expect(identifiers('const q = y as number / 2\n')).toEqual(['q', 'y'])
	})

	// 59. The brace and paren stacks decide which `}` closes a block and which
	// `)` closes a statement, and four shapes turn on the token before the one
	// they read. None is live under `src/` today, and each leaked a regex body
	// into the stream or read a division as a regex.
	it('reads an arrow body, a label, `for await`, and a method named like a keyword', () => {
		// An arrow's braces are always a body; an object-literal body needs
		// parentheses.
		expect(identifiers('const f = () => { g() }\n/re/.test(s)\n')).toEqual([
			'f',
			'g',
			'test',
			's',
		])
		expect(identifiers('const f = () => ({ a: 1 })\n')).toEqual(['f', 'a'])
		// A labelled block is a block; a ternary's object arm and a nested
		// member are literals, and both end an expression.
		expect(identifiers('outer: { g() }\n/re/.test(s)\n')).toEqual([
			'outer',
			'g',
			'test',
			's',
		])
		expect(identifiers('const o = f ? g : { b: 1 }\n/re/.test(s)\n')).toEqual([
			'o',
			'f',
			'g',
			'b',
			're',
			'test',
			's',
		])
		expect(identifiers('const o = { a: { b: 1 } }\n/re/.test(s)\n')).toEqual([
			'o',
			'a',
			'b',
			're',
			'test',
			's',
		])
		// A member's `{` inside an open literal is a literal, whatever precedes
		// its name. Read as a label it would open a block, and the `/` after its
		// `}` would start a regex that swallows the rest of the line.
		expect(identifiers('const o = { a: { b: 1 } / 2 }\n')).toEqual([
			'o',
			'a',
			'b',
		])
		// `for await` heads a statement; `p.catch(f)` is a call.
		expect(identifiers('for await (const a of b) /re/.test(s)\n')).toEqual([
			'a',
			'b',
			'test',
			's',
		])
		expect(identifiers('const q = p.catch(f) / 2\n')).toEqual(['q', 'p', 'f'])
	})

	// 58. The backstop for a desync neither other guard sees: a stream ending
	// with an unbalanced brace or an open template.
	it('throws when the stream ends unbalanced', () => {
		expect(() => scanTokens('function f() {\n')).toThrow(
			/ended with brace depth/,
		)
	})
})
