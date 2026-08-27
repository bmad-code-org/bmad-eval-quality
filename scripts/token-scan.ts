// The one tokenizer both source-scanning gates share. Pure and synchronous.
//
// TypeScript 7.0.2 ships no in-process parser, and spawning the native `tsgo`
// binary is too slow for a lint gate, so `createScanner` is the surface left.
//
// Raw `scan()` derails on a template literal with a substitution: it returns
// the closing `}` of `${…}` as a `CloseBraceToken`, reads the template's tail
// as code, and the closing backtick then opens a second template that swallows
// the rest of the file. `scanTokens` re-scans that brace as a template
// continuation, which is what the real parser does.
//
// Two shapes the raw scanner reads wrongly, both of which throw here rather
// than returning a stream a gate would trust. A `#` inside a regex literal
// makes it emit a zero-width token forever, caught by the no-progress check. A
// backtick inside a regex literal opens a template that runs to end of file,
// caught by the unterminated check, because deciding slash-versus-regex needs
// the parser's own context.
//
// Two routes stay invisible to any token scanner and are the caller's problem:
// a key built at runtime (`o['parent' + 'Digest']`) and one parsed out of JSON.

import {
	computeLineStarts,
	createScanner,
	SyntaxKind,
} from 'typescript/unstable/ast'

export type Token = {
	readonly kind: number
	readonly text: string
	readonly value: string
	readonly start: number
}

export function scanTokens(source: string): Token[] {
	const scanner = createScanner(/* skipTrivia */ true, undefined, source)
	const tokens: Token[] = []
	// Brace depth at each open template's substitution, innermost last.
	const templates: number[] = []
	let depth = 0
	let previousEnd = -1
	while (true) {
		let kind = scanner.scan()
		if (kind === SyntaxKind.EndOfFile) break
		const end = scanner.getTokenEnd()
		if (end === previousEnd) {
			throw new Error(
				`token scan made no progress at offset ${scanner.getTokenStart()}; the source is outside what this tokenizer can read`,
			)
		}
		if (scanner.isUnterminated()) {
			throw new Error(
				`token scan hit an unterminated literal at offset ${scanner.getTokenStart()}; everything after it would be read as the wrong kind of token`,
			)
		}
		previousEnd = end
		if (kind === SyntaxKind.OpenBraceToken) {
			depth++
		} else if (kind === SyntaxKind.CloseBraceToken) {
			if (templates[templates.length - 1] === depth) {
				kind = scanner.reScanTemplateToken(/* isTaggedTemplate */ false)
				if (kind === SyntaxKind.TemplateTail) templates.pop()
			} else {
				// A brace closing a real block or object literal. Drop this and a
				// later `}` is misread as a template continuation.
				depth--
			}
		}
		if (kind === SyntaxKind.TemplateHead) templates.push(depth)
		tokens.push({
			kind,
			text: scanner.getTokenText(),
			value: scanner.getTokenValue(),
			start: scanner.getTokenStart(),
		})
	}
	return tokens
}

/** 1-indexed line holding `pos`, by binary search over `computeLineStarts`. */
export function lineOf(lineStarts: readonly number[], pos: number): number {
	let low = 0
	let high = lineStarts.length - 1
	while (low < high) {
		const mid = (low + high + 1) >> 1
		if ((lineStarts[mid] ?? 0) <= pos) low = mid
		else high = mid - 1
	}
	return low + 1
}

export { computeLineStarts }
