/**
 * The tokenizer behind `check:layers` and `check:lineage` (Story 6.4, AC 11
 * cases 51 through 55). A derailed tokenizer makes both gates report fewer
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
	// 51. Raw `scan()` reads the closing brace of `${…}` as a block brace, then
	// the template's tail as code, so the closing backtick opens a second
	// template and swallows the rest of the file.
	it('reads code after a template with a substitution', () => {
		expect(
			identifiers('const a = `x ${b} y`\nconst o = { after: 1 }\n'),
		).toEqual(['a', 'b', 'o', 'after'])
	})

	// 52
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

	// 53. A backtick inside a regex literal opens a template that runs to end of
	// file, and everything after it reads as template text. The scanner reaches
	// EOF, so only the unterminated check catches it.
	it('throws on an unterminated literal', () => {
		expect(() => scanTokens('const a = `runs to the end\n')).toThrow(
			/unterminated literal at offset/,
		)
		expect(() =>
			scanTokens('const re = /`/\nrecord.parentDigest = d\n'),
		).toThrow(/unterminated literal at offset/)
	})

	// 54. A `#` inside a regex literal makes the raw scanner emit a zero-width
	// token forever. Without the progress guard both gates run out of heap.
	it('throws on a token that makes no progress', () => {
		expect(() => scanTokens('const r = /^#/\n')).toThrow(
			/made no progress at offset/,
		)
	})

	// 55. `lineOf` reports the line a violation is on, and both gates print it.
	// A token at column 0 is the boundary the binary search gets wrong.
	it('reports the line of a token at column 0', () => {
		const source = 'const a = 1\nparentDigest = 2\n'
		const starts = computeLineStarts(source)
		expect(lineOf(starts, 0)).toBe(1)
		expect(lineOf(starts, source.indexOf('parentDigest'))).toBe(2)
		expect(lineOf(starts, source.length - 1)).toBe(2)
	})
})
