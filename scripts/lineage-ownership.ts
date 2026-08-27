// AD-29's "no other stage may set them", as a scanner. Pure and synchronous,
// with no filesystem I/O (`check-lineage-ownership.ts` reads the repository),
// so one function backs both the real scan and the synthetic test maps.
//
// Token-anchored over `token-scan.ts`. Every rule is fail-closed: an ambiguous
// shape is reported, since a lineage field outside the schemas is worth a
// human look either way.

import { SyntaxKind } from 'typescript/unstable/ast'
import { LINEAGE_WRITER_MODULES } from '../src/core/lineage/stage-table.ts'
import {
	computeLineStarts,
	lineOf,
	scanTokens,
	type Token,
} from './token-scan.ts'

const LINEAGE_FIELDS = new Set(['parentDigest', 'revisionCount'])

/** Directories whose files may write the two fields whatever the stage table says. */
const DECLARATION_PATHS = ['src/core/schemas/', 'src/core/lineage/']

/** How far back the enclosing-bracket search runs before giving up and reporting. */
const MAX_LOOKBACK = 500

export type LineageViolation = {
	readonly file: string
	readonly line: number
	/** the field, the call, or the allowlist entry the violation is about. */
	readonly subject: string
	readonly rule: string
}

export type ScanOptions = {
	/**
	 * True when `files` is a whole-tree scan, where an allowlist entry with no
	 * matching file is a violation. A synthetic map stays silent about it.
	 */
	readonly wholeTree: boolean
}

function isPermitted(file: string): boolean {
	if (DECLARATION_PATHS.some((prefix) => file.startsWith(prefix))) return true
	return LINEAGE_WRITER_MODULES.includes(file)
}

const assigns = (kind: number | undefined): boolean =>
	kind !== undefined &&
	kind >= SyntaxKind.FirstAssignment &&
	kind <= SyntaxKind.LastAssignment

const BINDERS = new Set<number>([
	SyntaxKind.ConstKeyword,
	SyntaxKind.LetKeyword,
	SyntaxKind.VarKeyword,
	SyntaxKind.ImportKeyword,
])

const TYPE_DECLARERS = new Set<number>([
	SyntaxKind.TypeKeyword,
	SyntaxKind.InterfaceKeyword,
])

/**
 * What a type annotation puts after the colon. A member given one of these
 * declares a shape and mints nothing.
 */
const TYPE_VALUES = new Set([
	'string',
	'number',
	'boolean',
	'unknown',
	'any',
	'never',
	'void',
	'object',
	'symbol',
	'bigint',
	'Array',
	'ReadonlyArray',
	'Record',
	'readonly',
])

/** Where a bare `parentDigest` or `revisionCount` token sits. */
type Enclosure = 'value-literal' | 'type-literal' | 'read'

/**
 * True when the token at `index` starts a member of the literal around it.
 * Biome writes TS type members newline-separated with no separator and often
 * behind `readonly`, so a line break counts alongside `{`, `,` and `;`.
 */
function opensMember(
	tokens: readonly Token[],
	lines: readonly number[],
	index: number,
): boolean {
	const previous = tokens[index - 1]
	if (previous === undefined) return false
	if (
		previous.kind === SyntaxKind.OpenBraceToken ||
		previous.kind === SyntaxKind.CommaToken ||
		previous.kind === SyntaxKind.SemicolonToken ||
		previous.kind === SyntaxKind.ReadonlyKeyword
	) {
		return true
	}
	return (lines[index - 1] ?? 0) < (lines[index] ?? 0)
}

/**
 * Walks back to the nearest unmatched opening bracket. A `{` is a literal, and
 * a `:` before it or a `type`/`interface` in its statement makes it a type
 * literal. A `{` a binder introduced is a destructuring pattern, and a `(` or
 * `[` reached first is a parameter list or an index; both are reads.
 */
function enclosureOf(
	tokens: readonly Token[],
	lines: readonly number[],
	index: number,
): Enclosure {
	let braces = 0
	let parens = 0
	let brackets = 0
	const floor = Math.max(0, index - MAX_LOOKBACK)
	for (let i = index - 1; i >= floor; i--) {
		const kind = tokens[i]?.kind
		if (kind === SyntaxKind.CloseBraceToken) braces++
		else if (kind === SyntaxKind.CloseParenToken) parens++
		else if (kind === SyntaxKind.CloseBracketToken) brackets++
		else if (kind === SyntaxKind.OpenParenToken && parens-- === 0) return 'read'
		else if (kind === SyntaxKind.OpenBracketToken && brackets-- === 0) {
			return 'read'
		} else if (kind === SyntaxKind.OpenBraceToken && braces-- === 0) {
			const before = tokens[i - 1]?.kind ?? -1
			if (BINDERS.has(before)) return 'read'
			// A `{` after a colon is a type annotation, unless the name before
			// that colon is itself a member: `lineage: { parentDigest: null }`
			// is a nested value.
			if (before === SyntaxKind.ColonToken) {
				return opensMember(tokens, lines, i - 2)
					? 'value-literal'
					: 'type-literal'
			}
			return declaresType(tokens, i) ? 'type-literal' : 'value-literal'
		}
	}
	// Unresolved within the window: report it.
	return 'value-literal'
}

/** True when a `type` or `interface` keyword opens the statement holding the `{` at `open`. */
function declaresType(tokens: readonly Token[], open: number): boolean {
	const floor = Math.max(0, open - MAX_LOOKBACK)
	for (let i = open - 1; i >= floor; i--) {
		const kind = tokens[i]?.kind
		if (kind === undefined) return false
		if (TYPE_DECLARERS.has(kind)) return true
		if (
			kind === SyntaxKind.SemicolonToken ||
			kind === SyntaxKind.OpenBraceToken ||
			kind === SyntaxKind.CloseBraceToken ||
			BINDERS.has(kind)
		) {
			return false
		}
	}
	return false
}

/**
 * What a bare-identifier occurrence is. Any assignment operator makes it an
 * assignment wherever it appears, which is AD-29's literal subject. A name
 * opening a member of an object or type literal declares the field; a type
 * literal is reported too, and `scanFile` keeps it out of the minting count.
 */
function writeKind(
	tokens: readonly Token[],
	lines: readonly number[],
	index: number,
): 'assignment' | 'literal' | 'type' | undefined {
	const next = tokens[index + 1]?.kind
	if (assigns(next)) return 'assignment'
	if (tokens[index - 1]?.kind === SyntaxKind.DotToken) return undefined
	if (
		next !== SyntaxKind.ColonToken &&
		next !== SyntaxKind.CommaToken &&
		next !== SyntaxKind.CloseBraceToken
	) {
		return undefined
	}
	// `return revisionCount }` and `[parentDigest, x]` use a name bound
	// elsewhere, so only a member start reaches the enclosure walk.
	if (!opensMember(tokens, lines, index)) return undefined
	switch (enclosureOf(tokens, lines, index)) {
		case 'value-literal':
			return 'literal'
		case 'type-literal':
			return 'type'
		default:
			return undefined
	}
}

/**
 * True when this member is the shape rule 4 looks for: a field given a value.
 * A shorthand binds a name and an annotation declares a shape, so neither can
 * stand in for the write the AD-24 table says a module owes.
 */
function mints(tokens: readonly Token[], index: number): boolean {
	if (tokens[index + 1]?.kind !== SyntaxKind.ColonToken) return false
	const value = tokens[index + 2]
	return value !== undefined && !TYPE_VALUES.has(value.value)
}

function scanFile(
	file: string,
	source: string,
	violations: LineageViolation[],
): Set<string> {
	const tokens = scanTokens(source)
	const lineStarts = computeLineStarts(source)
	const lines = tokens.map((token) => lineOf(lineStarts, token.start))
	const permitted = isPermitted(file)
	const written = new Set<string>()

	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i]
		if (token === undefined) continue
		const line = lines[i] ?? 1

		// A string spelling a lineage field reaches it through a computed key, a
		// bracket assignment, `Object.defineProperty`, or `Reflect.set`. All four
		// look alike at this level, so any of them is reported.
		if (
			token.kind === SyntaxKind.StringLiteral ||
			token.kind === SyntaxKind.NoSubstitutionTemplateLiteral
		) {
			if (permitted || !LINEAGE_FIELDS.has(token.value)) continue
			violations.push({
				file,
				line,
				subject: token.value,
				rule: 'names a lineage field as a string, which reaches it through a computed key or a reflective set (AD-29)',
			})
			continue
		}

		if (token.kind !== SyntaxKind.Identifier) continue

		if (LINEAGE_FIELDS.has(token.value)) {
			const kind = writeKind(tokens, lines, i)
			if (kind === undefined) continue
			if (kind === 'assignment' || (kind === 'literal' && mints(tokens, i))) {
				written.add(token.value)
			}
			if (permitted) continue
			violations.push({
				file,
				line,
				subject: token.value,
				rule: `only core/schemas, core/lineage, and a stage the AD-24 table names as a lineage writer may set this field (AD-29); this is a ${kind} position`,
			})
			continue
		}

		// `reviseArtifact` sets both fields, so naming it outside the table is
		// the same violation one line out. The bare identifier covers the call,
		// the import, and an aliased import.
		if (token.value === 'reviseArtifact' && !permitted) {
			violations.push({
				file,
				line,
				subject: 'reviseArtifact',
				rule: 'reviseArtifact() sets both lineage fields, so naming it outside the AD-24 table is the same violation one line further out (AD-29)',
			})
		}
	}
	return written
}

/**
 * Scans every source file in `files` (repo-relative POSIX path -> source text)
 * and returns every violation, in no particular cross-file order.
 */
export function scanLineageWrites(
	files: ReadonlyMap<string, string>,
	options: ScanOptions,
): LineageViolation[] {
	const violations: LineageViolation[] = []
	const writesByFile = new Map<string, Set<string>>()
	for (const [file, source] of files) {
		writesByFile.set(file, scanFile(file, source, violations))
	}

	// The other direction: a table-named writer whose writes are gone. That is
	// the likelier regression, and the schema parse that catches it says
	// nothing about ownership.
	for (const module of LINEAGE_WRITER_MODULES) {
		const written = writesByFile.get(module)
		if (written === undefined) {
			if (!options.wholeTree) continue
			violations.push({
				file: module,
				line: 1,
				subject: module,
				rule: 'the AD-24 table names this module as a lineage writer and no such file exists; a rename emptied the allowlist',
			})
			continue
		}
		for (const field of LINEAGE_FIELDS) {
			if (written.has(field)) continue
			violations.push({
				file: module,
				line: 1,
				subject: field,
				rule: 'the AD-24 table names this module as the writer of this field and it writes none (AD-29)',
			})
		}
	}
	return violations
}
