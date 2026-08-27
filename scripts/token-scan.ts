// The one tokenizer both source-scanning gates share. Pure and synchronous.
//
// TypeScript 7.0.2 ships no in-process parser, and spawning the native `tsgo`
// binary is too slow for a lint gate, so `createScanner` is the surface left.
// Two of its context-dependent decisions belong to the parser, and `scanTokens`
// makes them:
//
// A slash is division or the start of a regex depending on what came before.
// Left alone, every regex body leaks into the stream as code: `/^#/` emits a
// zero-width token forever, a backtick opens a template that runs to end of
// file, `\/` opens a line comment that eats the rest of its line, and `{`
// inside a character class shifts brace depth for every line after it. The
// re-scan below decides it the way the parser does, from the previous token.
//
// The closing `}` of a template substitution is a brace or a template
// continuation. Left alone the template's tail reads as code and its closing
// backtick opens a second template, so the file's whole tail is fiction.
//
// Three guards catch what is left: a token that makes no progress, an
// unterminated literal, and a stream that ends with an unbalanced brace or an
// open template. Each throws with an offset instead of returning a stream a
// gate would trust.

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

/**
 * Token kinds that can end an expression, so a following `/` is division. The
 * type keywords are here for an `as` clause: `y as number / 2` is division.
 */
const ENDS_EXPRESSION = new Set<number>([
	SyntaxKind.Identifier,
	SyntaxKind.NumericLiteral,
	SyntaxKind.BigIntLiteral,
	SyntaxKind.StringLiteral,
	SyntaxKind.NoSubstitutionTemplateLiteral,
	SyntaxKind.TemplateTail,
	SyntaxKind.RegularExpressionLiteral,
	SyntaxKind.CloseParenToken,
	SyntaxKind.CloseBracketToken,
	SyntaxKind.CloseBraceToken,
	SyntaxKind.ThisKeyword,
	SyntaxKind.SuperKeyword,
	SyntaxKind.TrueKeyword,
	SyntaxKind.FalseKeyword,
	SyntaxKind.NullKeyword,
	SyntaxKind.PlusPlusToken,
	SyntaxKind.MinusMinusToken,
	SyntaxKind.NumberKeyword,
	SyntaxKind.StringKeyword,
	SyntaxKind.BooleanKeyword,
	SyntaxKind.AnyKeyword,
	SyntaxKind.UnknownKeyword,
	SyntaxKind.ObjectKeyword,
	SyntaxKind.SymbolKeyword,
	SyntaxKind.BigIntKeyword,
	SyntaxKind.NeverKeyword,
	SyntaxKind.VoidKeyword,
	SyntaxKind.UndefinedKeyword,
	SyntaxKind.ConstKeyword,
])

/** A `(` after one of these heads a statement, so its `)` ends no expression. */
const CONTROL_HEADS = new Set<number>([
	SyntaxKind.IfKeyword,
	SyntaxKind.WhileKeyword,
	SyntaxKind.ForKeyword,
	SyntaxKind.CatchKeyword,
	SyntaxKind.WithKeyword,
])

/** A `{` after one of these is an object or type literal; anywhere else it opens a block. */
const LITERAL_HEADS = new Set<number>([
	SyntaxKind.OpenParenToken,
	SyntaxKind.CommaToken,
	SyntaxKind.ColonToken,
	SyntaxKind.OpenBracketToken,
	SyntaxKind.EqualsGreaterThanToken,
	SyntaxKind.ReturnKeyword,
	SyntaxKind.QuestionToken,
	SyntaxKind.ExtendsKeyword,
	SyntaxKind.LessThanToken,
	SyntaxKind.BarToken,
	SyntaxKind.AmpersandToken,
])

const opensLiteral = (kind: number): boolean =>
	LITERAL_HEADS.has(kind) ||
	(kind >= SyntaxKind.FirstAssignment && kind <= SyntaxKind.LastAssignment)

export function scanTokens(source: string): Token[] {
	const scanner = createScanner(/* skipTrivia */ true, undefined, source)
	const tokens: Token[] = []
	// Brace depth at each open template's substitution, innermost last.
	const templates: number[] = []
	// Whether each open `(` heads a statement and each open `{` opens a block,
	// innermost last. A statement's `)` and a block's `}` end no expression, so
	// a `/` after either starts a regex.
	const controlParens: boolean[] = []
	const blockBraces: boolean[] = []
	let depth = 0
	let previousEnd = -1
	let previousKind = -1
	let previousEnds = false
	while (true) {
		let kind = scanner.scan()
		if (kind === SyntaxKind.EndOfFile) break
		if (
			(kind === SyntaxKind.SlashToken ||
				kind === SyntaxKind.SlashEqualsToken) &&
			!previousEnds
		) {
			kind = scanner.reScanSlashToken()
		}
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
		let ends = ENDS_EXPRESSION.has(kind)
		if (kind === SyntaxKind.OpenParenToken) {
			controlParens.push(CONTROL_HEADS.has(previousKind))
		} else if (kind === SyntaxKind.CloseParenToken) {
			if (controlParens.pop() === true) ends = false
		} else if (kind === SyntaxKind.OpenBraceToken) {
			depth++
			blockBraces.push(!opensLiteral(previousKind))
		} else if (kind === SyntaxKind.CloseBraceToken) {
			if (templates[templates.length - 1] === depth) {
				kind = scanner.reScanTemplateToken(/* isTaggedTemplate */ false)
				if (kind === SyntaxKind.TemplateTail) templates.pop()
				ends = ENDS_EXPRESSION.has(kind)
			} else {
				// A brace closing a real block or literal. Drop this and a later
				// `}` is misread as a template continuation.
				depth--
				if (blockBraces.pop() === true) ends = false
			}
		}
		if (kind === SyntaxKind.TemplateHead) templates.push(depth)
		// A postfix `!` inherits: `x! / 2` is division, `!/re/.test(s)` is a
		// regex, and the token before the `!` is what separates them.
		if (kind === SyntaxKind.ExclamationToken) ends = previousEnds
		previousKind = kind
		previousEnds = ends
		tokens.push({
			kind,
			text: scanner.getTokenText(),
			value: scanner.getTokenValue(),
			start: scanner.getTokenStart(),
		})
	}
	if (depth !== 0 || templates.length > 0) {
		throw new Error(
			`token scan ended with brace depth ${depth} and ${templates.length} open template(s); the stream desynced somewhere in this file`,
		)
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
