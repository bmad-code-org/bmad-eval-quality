// A published gate: field ownership.
//
// The rule is "only these modules may write these fields, and each of them has
// to write every one it is named for". A consumer declares four things: the
// fields it owns, the path prefixes where declaring them is always allowed,
// the modules permitted to write them, and the helper identifiers that count as
// a write because they set the fields on a caller's behalf. Nothing in the gate
// knows what the fields mean.
//
// That is what makes it worth publishing. The rule shipped here holds two
// lineage fields against the stages allowed to mint them, and the same rule
// holds an `id` nothing but a factory may assign, an `updatedAt` one repository
// layer owns, a `tenantId` written only where a request is authorized, or any
// other field whose value is a claim rather than a convenience. A consumer with
// no lineage concept at all is the ordinary case.
//
// Both directions are checked, because both go wrong. A write outside the
// declared set is the obvious one. A declared writer that writes none of its
// fields is the likelier regression: a rename empties the list and every
// remaining check keeps passing over a rule nothing enforces.
//
// Token-anchored, so the gate reads TypeScript source through the typescript
// package's own scanner. `typescript` is loaded on first use rather than at
// import, so this module carries no `typescript` on its load path and the gate
// refuses by name when the dependency is absent instead of failing to load.
//
// Every rule is fail-closed: an ambiguous shape is reported, since an owned
// field outside its declared home is worth a human look either way.
//
// Run by `node` directly: Node's type stripping erases types only, so no
// TypeScript enum, namespace, parameter property, or non-type re-export may
// appear in this file or anything it imports.
import { z } from 'zod'
import {
	discoverEntries,
	RelativePath,
	RelativePrefix,
	ScannedPathList,
} from './package-boundary.ts'
import type { Token } from './token-scan.ts'

/** The gate needs `typescript` and could not resolve it. */
export const TYPESCRIPT_UNAVAILABLE = 'EVAL_QUALITY_TYPESCRIPT_UNAVAILABLE'

const codedError = (code: string, message: string): Error =>
	Object.assign(new Error(message), { code })

/** Type-only, so no value from `typescript` reaches this module's load path. */
type Syntax = typeof import('typescript/unstable/ast').SyntaxKind

export type TokenScanner = {
	readonly scanTokens: (source: string) => readonly Token[]
	readonly computeLineStarts: (source: string) => readonly number[]
	readonly lineOf: (lineStarts: readonly number[], pos: number) => number
	readonly syntax: Syntax
}

type ScannerImport = () => Promise<TokenScanner>

const importTokenScanner: ScannerImport = async () => {
	// `token-scan.ts` imports `typescript/unstable/ast` at its own top level, so
	// this is the one place the dependency is reached and the one place its
	// absence can be turned into a sentence.
	const [ast, scan] = await Promise.all([
		import('typescript/unstable/ast'),
		import('./token-scan.ts'),
	])
	return {
		scanTokens: scan.scanTokens,
		computeLineStarts: scan.computeLineStarts,
		lineOf: scan.lineOf,
		syntax: ast.SyntaxKind,
	}
}

/**
 * The tokenizer, or a refusal naming the dependency and the gate that needs it.
 * `load` is injectable so the refusal has a test that does not require
 * uninstalling anything.
 */
export async function loadTokenScanner(
	gate: string,
	load: ScannerImport = importTokenScanner,
): Promise<TokenScanner> {
	try {
		return await load()
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ERR_MODULE_NOT_FOUND') {
			throw error
		}
		throw codedError(
			TYPESCRIPT_UNAVAILABLE,
			`the ${gate} gate reads your source through the typescript package's own scanner, and typescript did not resolve. Install typescript to run this gate; every other gate needs nothing beyond this package.`,
		)
	}
}

const Identifier = z
	.string()
	.min(1)
	.regex(
		/^[A-Za-z_$][A-Za-z0-9_$]*$/,
		'is not an identifier; the scan matches a name as the tokenizer sees it, so a member expression or a quoted key cannot be written here',
	)

export const FieldOwnershipSection = z
	.strictObject({
		paths: ScannedPathList.describe(
			'The source the scan reads. Give it the extensions your source uses; a file outside these paths is neither held nor counted.',
		),
		fields: z
			.array(Identifier)
			.min(1)
			.describe(
				'The field names you own. A write to any of them outside the declared set is a violation.',
			),
		declarations: z
			.array(RelativePrefix)
			.default([])
			.describe(
				'Path prefixes where naming a field is always allowed, whatever the writer list says: where the schema, the type, and the factory that defines the shape live. A file under one of these is exempt entirely.',
			),
		writers: z
			.array(RelativePath)
			.min(1)
			.describe(
				'The modules permitted to write the fields. Each one has to write every field, so a rename that empties this list fails here instead of quietly disabling the rule.',
			),
		helpers: z
			.array(Identifier)
			.default([])
			.describe(
				"Identifiers that write the fields on a caller's behalf. Naming one outside the writer list is the same write one line further out, so the scan reports the call, the import, and an aliased import alike. A write routed through a helper you have not named here is invisible to this gate.",
			),
	})
	.superRefine((section, ctx) => {
		const overlap = section.fields.filter((field) =>
			section.helpers.includes(field),
		)
		if (overlap.length > 0) {
			ctx.addIssue({
				code: 'custom',
				path: ['helpers'],
				message: `names ${overlap.join(', ')}, which is also a field; one name cannot be both, since a field is reported by position and a helper by mention`,
			})
		}
	})
	.describe(
		'Fails on a write to a field you own from a module you did not declare, and on a declared module that writes none of the fields it is named for.',
	)

export type FieldOwnershipConfig = z.infer<typeof FieldOwnershipSection>

export type FieldOwnershipRules = {
	readonly fields: ReadonlySet<string>
	readonly declarations: readonly string[]
	readonly writers: readonly string[]
	readonly helpers: ReadonlySet<string>
}

export const rulesOf = (
	section: FieldOwnershipConfig,
): FieldOwnershipRules => ({
	fields: new Set(section.fields),
	declarations: section.declarations,
	writers: section.writers,
	helpers: new Set(section.helpers),
})

export type FieldOwnershipViolation = {
	readonly file: string
	readonly line: number
	/** the field, the helper, or the writer entry the violation is about. */
	readonly subject: string
	readonly rule: string
}

export type ScanOptions = {
	/**
	 * True when `files` is a whole-tree scan, where a writer entry with no
	 * matching file is a violation. A synthetic map stays silent about it.
	 */
	readonly wholeTree: boolean
}

/** How far back the enclosing-bracket search runs before giving up and reporting. */
const MAX_LOOKBACK = 500

/**
 * The token kinds the walk below reads, resolved once per scan from the
 * tokenizer the gate loaded rather than at module level, which is what keeps
 * `typescript` off this file's load path.
 */
type Kinds = {
	readonly syntax: Syntax
	readonly binders: ReadonlySet<number>
	readonly typeDeclarers: ReadonlySet<number>
	/** A `{` after one of these is a type literal wherever it appears. */
	readonly typeHeads: ReadonlySet<number>
}

const kindsOf = (syntax: Syntax): Kinds => ({
	syntax,
	binders: new Set<number>([
		syntax.ConstKeyword,
		syntax.LetKeyword,
		syntax.VarKeyword,
		syntax.ImportKeyword,
	]),
	typeDeclarers: new Set<number>([syntax.TypeKeyword, syntax.InterfaceKeyword]),
	typeHeads: new Set<number>([syntax.LessThanToken, syntax.ExtendsKeyword]),
})

function isPermitted(file: string, rules: FieldOwnershipRules): boolean {
	if (rules.declarations.some((prefix) => file.startsWith(prefix))) return true
	return rules.writers.includes(file)
}

const assigns = (kinds: Kinds, kind: number | undefined): boolean =>
	kind !== undefined &&
	kind >= kinds.syntax.FirstAssignment &&
	kind <= kinds.syntax.LastAssignment

/** Where a bare owned-field token sits. */
type Enclosure = 'value-literal' | 'type-literal' | 'read'

/**
 * True when the token at `index` starts a member of the literal around it. A
 * formatter writes TS type members newline-separated with no separator and often
 * behind `readonly`, so a line break counts alongside `{`, `,` and `;`.
 */
function opensMember(
	kinds: Kinds,
	tokens: readonly Token[],
	lines: readonly number[],
	index: number,
): boolean {
	const previous = tokens[index - 1]
	if (previous === undefined) return false
	if (
		previous.kind === kinds.syntax.OpenBraceToken ||
		previous.kind === kinds.syntax.CommaToken ||
		previous.kind === kinds.syntax.SemicolonToken ||
		previous.kind === kinds.syntax.ReadonlyKeyword
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
	kinds: Kinds,
	tokens: readonly Token[],
	lines: readonly number[],
	index: number,
): Enclosure {
	const { syntax } = kinds
	let braces = 0
	let parens = 0
	let brackets = 0
	const floor = Math.max(0, index - MAX_LOOKBACK)
	for (let i = index - 1; i >= floor; i--) {
		const kind = tokens[i]?.kind
		if (kind === syntax.CloseBraceToken) braces++
		else if (kind === syntax.CloseParenToken) parens++
		else if (kind === syntax.CloseBracketToken) brackets++
		else if (kind === syntax.OpenParenToken && parens-- === 0) return 'read'
		else if (kind === syntax.OpenBracketToken && brackets-- === 0) {
			return 'read'
		} else if (kind === syntax.OpenBraceToken && braces-- === 0) {
			const before = tokens[i - 1]?.kind ?? -1
			if (kinds.binders.has(before)) return 'read'
			if (kinds.typeHeads.has(before)) return 'type-literal'
			// A `{` after a colon is a type annotation, unless the name before that
			// colon is itself a member of a value literal: `lineage: { id: null }`
			// is a nested value, while `row: { id: Id }` in a parameter list is a
			// shape.
			if (before === syntax.ColonToken) {
				if (kinds.binders.has(tokens[i - 3]?.kind ?? -1)) return 'type-literal'
				return enclosureOf(kinds, tokens, lines, i - 2) === 'value-literal'
					? 'value-literal'
					: 'type-literal'
			}
			return declaresType(kinds, tokens, i) ? 'type-literal' : 'value-literal'
		}
	}
	// Unresolved within the window: report it.
	return 'value-literal'
}

/** True when a `type` or `interface` keyword opens the statement holding the `{` at `open`. */
function declaresType(
	kinds: Kinds,
	tokens: readonly Token[],
	open: number,
): boolean {
	const { syntax } = kinds
	const floor = Math.max(0, open - MAX_LOOKBACK)
	for (let i = open - 1; i >= floor; i--) {
		const kind = tokens[i]?.kind
		if (kind === undefined) return false
		if (kinds.typeDeclarers.has(kind)) return true
		if (
			kind === syntax.SemicolonToken ||
			kind === syntax.OpenBraceToken ||
			kind === syntax.CloseBraceToken ||
			kinds.binders.has(kind)
		) {
			return false
		}
	}
	return false
}

/**
 * What a bare-identifier occurrence is. Any assignment operator makes it an
 * assignment wherever it appears. A name opening a member of an object or type
 * literal declares the field; a type literal is reported too, and `scanFile`
 * keeps it out of the write count.
 */
function writeKind(
	kinds: Kinds,
	tokens: readonly Token[],
	lines: readonly number[],
	index: number,
): 'assignment' | 'literal' | 'type' | undefined {
	const { syntax } = kinds
	const next = tokens[index + 1]?.kind
	if (assigns(kinds, next)) return 'assignment'
	if (tokens[index - 1]?.kind === syntax.DotToken) return undefined
	if (
		next !== syntax.ColonToken &&
		next !== syntax.CommaToken &&
		next !== syntax.CloseBraceToken
	) {
		return undefined
	}
	// `return count }` and `[id, x]` use a name bound elsewhere, so only a member
	// start reaches the enclosure walk.
	if (!opensMember(kinds, tokens, lines, index)) return undefined
	switch (enclosureOf(kinds, tokens, lines, index)) {
		case 'value-literal':
			return 'literal'
		case 'type-literal':
			return 'type'
		default:
			return undefined
	}
}

/**
 * True when this member is a field given a value inside a value literal. A
 * shorthand binds a name and every type position declares a shape, so neither
 * can stand in for the write a declared writer owes. The enclosure decides it,
 * since a denylist of type names cannot be completed: an alias, a branded type,
 * and a literal type all read like values.
 */
function mints(kinds: Kinds, tokens: readonly Token[], index: number): boolean {
	return tokens[index + 1]?.kind === kinds.syntax.ColonToken
}

function scanFile(
	file: string,
	source: string,
	rules: FieldOwnershipRules,
	scanner: TokenScanner,
	kinds: Kinds,
	violations: FieldOwnershipViolation[],
): Set<string> {
	const { syntax } = kinds
	const tokens = scanner.scanTokens(source)
	const lineStarts = scanner.computeLineStarts(source)
	const lines = tokens.map((token) => scanner.lineOf(lineStarts, token.start))
	const permitted = isPermitted(file, rules)
	const written = new Set<string>()

	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i]
		if (token === undefined) continue
		const line = lines[i] ?? 1

		// A string spelling an owned field reaches it through a computed key, a
		// bracket assignment, `Object.defineProperty`, or `Reflect.set`. All four
		// look alike at this level, so any of them is reported.
		if (
			token.kind === syntax.StringLiteral ||
			token.kind === syntax.NoSubstitutionTemplateLiteral
		) {
			if (permitted || !rules.fields.has(token.value)) continue
			violations.push({
				file,
				line,
				subject: token.value,
				rule: 'names an owned field as a string, which reaches it through a computed key or a reflective set',
			})
			continue
		}

		if (token.kind !== syntax.Identifier) continue

		if (rules.fields.has(token.value)) {
			const kind = writeKind(kinds, tokens, lines, i)
			if (kind === undefined) continue
			if (
				kind === 'assignment' ||
				(kind === 'literal' && mints(kinds, tokens, i))
			) {
				written.add(token.value)
			}
			if (permitted) continue
			violations.push({
				file,
				line,
				subject: token.value,
				rule: `only a declared path or a declared writer may set this field; this is a ${kind} position`,
			})
			continue
		}

		if (rules.helpers.has(token.value) && !permitted) {
			violations.push({
				file,
				line,
				subject: token.value,
				rule: `${token.value}() sets the owned fields, so naming it outside the writer list is the same write one line further out`,
			})
		}
	}
	return written
}

/**
 * Scans every file in `files` (repo-relative POSIX path -> source text) and
 * returns every violation, in no particular cross-file order. Pure and
 * synchronous over the map, so one function backs both the real scan and a
 * synthetic test map.
 */
export function scanFieldOwnership(
	files: ReadonlyMap<string, string>,
	rules: FieldOwnershipRules,
	scanner: TokenScanner,
	options: ScanOptions,
): FieldOwnershipViolation[] {
	const kinds = kindsOf(scanner.syntax)
	const violations: FieldOwnershipViolation[] = []
	const writesByFile = new Map<string, Set<string>>()
	for (const [file, source] of files) {
		writesByFile.set(
			file,
			scanFile(file, source, rules, scanner, kinds, violations),
		)
	}

	for (const module of rules.writers) {
		const written = writesByFile.get(module)
		if (written === undefined) {
			if (!options.wholeTree) continue
			violations.push({
				file: module,
				line: 1,
				subject: module,
				rule: 'the configuration names this module as a writer and no such file was scanned; a rename emptied the writer list',
			})
			continue
		}
		for (const field of rules.fields) {
			if (written.has(field)) continue
			violations.push({
				file: module,
				line: 1,
				subject: field,
				rule: 'the configuration names this module as a writer of this field and it writes none',
			})
		}
	}
	return violations
}

export type FieldOwnershipReport = {
	readonly violations: readonly FieldOwnershipViolation[]
	readonly scanned: number
}

/**
 * The gate, over a consumer's tree. `root` is the directory its configuration
 * file sits in.
 */
export async function runFieldOwnership(
	root: string,
	section: FieldOwnershipConfig,
	gate = 'field-ownership',
	load?: ScannerImport,
): Promise<FieldOwnershipReport> {
	const scanner = await loadTokenScanner(gate, load)
	const { entries } = await discoverEntries(root, section.paths, gate)
	const violations = scanFieldOwnership(entries, rulesOf(section), scanner, {
		wholeTree: true,
	})
	return { violations, scanned: entries.size }
}
