// Reusable TypeScript-aware AST scanner and layer-rule evaluator for AC 6:
// mechanically enforced dependency direction. Pure and synchronous, with no
// filesystem I/O (`check-dependency-direction.ts` reads the repository);
// `dependency-direction.test.ts` calls `scanSources` against both synthetic
// and real source maps, so one function backs both.
//
// TypeScript 7.0.2 (the pinned Go-ported "tsgo" rewrite) no longer ships an
// in-process parser; the only surface left is `typescript/unstable/ast`'s
// `createScanner`, the same tokenizer the real parser uses. A full parse
// would require spawning the native `tsgo` binary, too slow for a lint gate
// or in-memory tests. This scanner is therefore a token-sequence-anchored
// walk over that tokenizer's output, not a blind text regex: every construct
// AC 6 names is a short, fixed token shape, and an unresolved shape is
// reported rather than skipped (fail-closed).

import { posix } from 'node:path'
import {
	computeLineStarts,
	createScanner,
	SyntaxKind,
} from 'typescript/unstable/ast'

export type Layer =
	| 'core-schemas'
	| 'core'
	| 'ports'
	| 'application'
	| 'adapters'
	| 'cli'
	| 'root'

export type Violation = {
	readonly file: string
	readonly line: number
	readonly specifier: string
	readonly rule: string
}

const LAYER_LABELS: Record<Layer, string> = {
	'core-schemas': 'core/schemas',
	core: 'core/ (excluding core/schemas)',
	ports: 'ports/',
	application: 'application/',
	adapters: 'adapters/',
	cli: 'cli/',
	root: 'src/index.ts',
}

/** Classifies a repo-relative path (POSIX, e.g. `src/core/compile/compile.ts`) into its architecture layer, or `undefined` for anything outside the declared graph. */
export function classifyLayer(file: string): Layer | undefined {
	if (file === 'src/index.ts') return 'root'
	if (file.startsWith('src/core/schemas/')) return 'core-schemas'
	if (file.startsWith('src/core/')) return 'core'
	if (file.startsWith('src/ports/')) return 'ports'
	if (file.startsWith('src/application/')) return 'application'
	if (file.startsWith('src/adapters/')) return 'adapters'
	if (file.startsWith('src/cli/')) return 'cli'
	return undefined
}

/**
 * The dependency-direction graph (Structural Seed, AC 1 item 7): `core` and
 * `core-schemas` are one graph node for same-layer-import purposes; the
 * prohibition governs dependencies leaving `core`, not submodules inside it
 * importing each other. Absence of an edge is itself a prohibition, which is
 * how "nothing may import cli/" falls out with no special case.
 */
function isAllowedEdge(from: Layer, to: Layer): boolean {
	switch (from) {
		case 'core-schemas':
		case 'core':
			return to === 'core' || to === 'core-schemas'
		case 'ports':
			return to === 'core-schemas'
		case 'application':
			return to === 'core' || to === 'core-schemas' || to === 'ports'
		case 'adapters':
			return to === 'ports' || to === 'core-schemas'
		case 'cli':
			return to === 'application' || to === 'adapters'
		case 'root':
			return to === 'application' || to === 'core-schemas'
		default:
			return false
	}
}

type Resolution =
	| { readonly ok: true; readonly resolved: string }
	| { readonly ok: false; readonly error: 'escapes-src' | 'unresolved' }

/** Resolves a literal relative specifier against its containing file, including the `.ts`-extension and `index.ts` rules this repository's imports use. Fails closed: an import escaping `src/`, or one that cannot be resolved to an actual source file in `files`, is an error rather than a best-effort guess. */
function resolveRelative(
	fromFile: string,
	specifier: string,
	files: ReadonlySet<string>,
): Resolution {
	const fromDir = posix.dirname(fromFile)
	const joined = posix.normalize(posix.join(fromDir, specifier))
	if (joined !== 'src' && !joined.startsWith('src/')) {
		return { ok: false, error: 'escapes-src' }
	}
	if (files.has(joined)) return { ok: true, resolved: joined }
	if (files.has(`${joined}.ts`)) return { ok: true, resolved: `${joined}.ts` }
	if (files.has(`${joined}/index.ts`)) {
		return { ok: true, resolved: `${joined}/index.ts` }
	}
	return { ok: false, error: 'unresolved' }
}

type Token = {
	readonly kind: number
	readonly text: string
	readonly value: string
	readonly start: number
}

function tokenize(source: string): Token[] {
	const scanner = createScanner(/* skipTrivia */ true, undefined, source)
	const tokens: Token[] = []
	while (true) {
		const kind = scanner.scan()
		if (kind === SyntaxKind.EndOfFile) break
		tokens.push({
			kind,
			text: scanner.getTokenText(),
			value: scanner.getTokenValue(),
			start: scanner.getTokenStart(),
		})
	}
	return tokens
}

function lineOf(lineStarts: readonly number[], pos: number): number {
	// Binary search for the last line-start at or before `pos`; 1-indexed for
	// human-readable reporting.
	let low = 0
	let high = lineStarts.length - 1
	while (low < high) {
		const mid = (low + high + 1) >> 1
		if ((lineStarts[mid] ?? 0) <= pos) low = mid
		else high = mid - 1
	}
	return low + 1
}

/** Statement-starting keywords that can never appear mid-clause inside an `import`/`export` clause: a bounded-scan abort signal, so a re-export search never runs past its own statement into unrelated code. */
const DECLARATION_STARTERS = new Set<number>([
	SyntaxKind.ImportKeyword,
	SyntaxKind.ExportKeyword,
	SyntaxKind.FunctionKeyword,
	SyntaxKind.ConstKeyword,
	SyntaxKind.LetKeyword,
	SyntaxKind.VarKeyword,
	SyntaxKind.ClassKeyword,
	SyntaxKind.InterfaceKeyword,
])

const MAX_LOOKAHEAD = 300

function isCreateHashOnlyClause(clauseTokens: readonly Token[]): boolean {
	// Exactly `{ createHash }` or `{ createHash as X }`, optionally type-only.
	// The whole clause must be that brace group: a default or namespace
	// binding beside it (`import crypto, { createHash } from 'node:crypto'`)
	// pulls in the rest of the module and is therefore not the exception.
	const clause =
		clauseTokens[0]?.kind === SyntaxKind.TypeKeyword
			? clauseTokens.slice(1)
			: clauseTokens
	if (clause[0]?.kind !== SyntaxKind.OpenBraceToken) return false
	if (clause[clause.length - 1]?.kind !== SyntaxKind.CloseBraceToken) {
		return false
	}
	// Commas are punctuation, so a formatter's trailing comma never changes
	// what the clause binds.
	const inner = clause
		.slice(1, -1)
		.filter((token) => token.kind !== SyntaxKind.CommaToken)
	if (
		inner[0]?.kind !== SyntaxKind.Identifier ||
		inner[0].text !== 'createHash'
	) {
		return false
	}
	if (inner.length === 1) return true
	return (
		inner.length === 3 &&
		inner[1]?.kind === SyntaxKind.AsKeyword &&
		inner[2]?.kind === SyntaxKind.Identifier
	)
}

/**
 * Applies the external-module allowlist. AC 6 scopes its allowlist to
 * `core/`; `ports/` generalizes AC 5's "no Zod in ports/" to every external
 * module, since it holds declared shapes only and has no legitimate need for
 * a runtime library or Node builtin. `adapters/` and `cli/` are deliberately
 * unrestricted: an adapter's whole purpose is reaching the I/O mechanism its
 * port describes.
 */
function checkExternalSpecifier(
	file: string,
	layer: Layer,
	specifier: string,
	line: number,
	clauseTokens: readonly Token[] | undefined,
	violations: Violation[],
): void {
	if (layer === 'core-schemas') {
		if (specifier === 'zod') return
		violations.push({
			file,
			line,
			specifier,
			rule: 'core/schemas may import the external module "zod" only',
		})
		return
	}
	if (layer === 'ports') {
		violations.push({
			file,
			line,
			specifier,
			rule: 'ports/ may import core/schemas only; it declares shapes and may not import an external module or Node builtin',
		})
		return
	}
	if (layer !== 'core') return // application/adapters/cli/root: unrestricted by this AC
	if (
		file === 'src/core/canonical/digest.ts' &&
		specifier === 'node:crypto' &&
		clauseTokens !== undefined &&
		isCreateHashOnlyClause(clauseTokens)
	) {
		return
	}
	if (file === 'src/core/canonical/digest.ts' && specifier === 'node:crypto') {
		violations.push({
			file,
			line,
			specifier,
			rule: 'src/core/canonical/digest.ts may import only the named binding "createHash" from node:crypto',
		})
		return
	}
	violations.push({
		file,
		line,
		specifier,
		rule: 'core/ (excluding core/schemas) may not import an external module or Node builtin',
	})
}

function handleSpecifier(
	file: string,
	layer: Layer,
	specifier: string,
	line: number,
	files: ReadonlySet<string>,
	clauseTokens: readonly Token[] | undefined,
	violations: Violation[],
): void {
	if (specifier.startsWith('.')) {
		const resolution = resolveRelative(file, specifier, files)
		if (!resolution.ok) {
			violations.push({
				file,
				line,
				specifier,
				rule:
					resolution.error === 'escapes-src'
						? 'relative import escapes src/'
						: 'relative import does not resolve to a source file under src/',
			})
			return
		}
		const toLayer = classifyLayer(resolution.resolved)
		if (toLayer === undefined || !isAllowedEdge(layer, toLayer)) {
			const toLabel =
				toLayer === undefined ? resolution.resolved : LAYER_LABELS[toLayer]
			violations.push({
				file,
				line,
				specifier,
				rule: `${LAYER_LABELS[layer]} may not import ${toLabel}`,
			})
		}
		return
	}
	checkExternalSpecifier(file, layer, specifier, line, clauseTokens, violations)
}

/**
 * The outcome of looking for an import/re-export statement's specifier.
 * `none` means the statement has no specifier to check (a local re-export, a
 * plain declaration export, `import.meta`). `indeterminate` means the
 * statement should have had one and the bounded token scan could not find
 * it, which AC 6's fail-closed rule reports rather than skips.
 */
type SpecifierLookup =
	| {
			readonly kind: 'specifier'
			readonly specifierToken: Token
			readonly clauseTokens: Token[]
	  }
	| { readonly kind: 'none' }
	| { readonly kind: 'indeterminate' }

const NONE: SpecifierLookup = { kind: 'none' }
const INDETERMINATE: SpecifierLookup = { kind: 'indeterminate' }

/** Index of the `}` matching an `{` at `openIndex`, or -1 within the bounded window. */
function matchingBrace(tokens: readonly Token[], openIndex: number): number {
	let depth = 0
	for (
		let i = openIndex;
		i < tokens.length && i < openIndex + MAX_LOOKAHEAD;
		i++
	) {
		const kind = tokens[i]?.kind
		if (kind === SyntaxKind.OpenBraceToken) depth++
		else if (kind === SyntaxKind.CloseBraceToken) {
			depth--
			if (depth === 0) return i
		}
	}
	return -1
}

/**
 * Finds the specifier of a plain (non-dynamic, non-`import =`) import
 * declaration starting at `tokens[importIndex]`. The bare side-effect form
 * (`import 'x'`) puts the string literal directly after `import`; every
 * other form puts it directly after a `from` keyword that appears at brace
 * depth zero, so a multi-line named-import list never confuses the scan.
 */
function findImportSpecifier(
	tokens: readonly Token[],
	importIndex: number,
): SpecifierLookup {
	const first = tokens[importIndex + 1]
	if (first?.kind === SyntaxKind.StringLiteral) {
		return { kind: 'specifier', specifierToken: first, clauseTokens: [] }
	}
	// `import.meta.url` is a meta-property, not an import declaration.
	if (first?.kind === SyntaxKind.DotToken) return NONE
	let depth = 0
	for (
		let i = importIndex + 1;
		i < tokens.length && i < importIndex + 1 + MAX_LOOKAHEAD;
		i++
	) {
		const token = tokens[i]
		if (token === undefined) break
		if (token.kind === SyntaxKind.OpenBraceToken) depth++
		else if (token.kind === SyntaxKind.CloseBraceToken) depth--
		else if (depth <= 0 && token.kind === SyntaxKind.FromKeyword) {
			const specifierToken = tokens[i + 1]
			if (specifierToken?.kind === SyntaxKind.StringLiteral) {
				return {
					kind: 'specifier',
					specifierToken,
					clauseTokens: tokens.slice(importIndex + 1, i),
				}
			}
			return INDETERMINATE
		} else if (
			depth <= 0 &&
			DECLARATION_STARTERS.has(token.kind) &&
			i !== importIndex + 1
		) {
			return INDETERMINATE
		}
	}
	return INDETERMINATE
}

/**
 * Same shape as `findImportSpecifier`, for `export * from '...'`, `export
 * type * from '...'`, and `export [type] { ... } from '...'`. A local
 * re-declaration (`export { x }` with no `from`) and a plain declaration
 * export carry no specifier and yield `none`.
 */
function findExportSpecifier(
	tokens: readonly Token[],
	exportIndex: number,
): SpecifierLookup {
	const first = tokens[exportIndex + 1]
	const afterType =
		first?.kind === SyntaxKind.TypeKeyword ? exportIndex + 2 : exportIndex + 1
	const head = tokens[afterType]

	if (head?.kind === SyntaxKind.OpenBraceToken) {
		// `export [type] { ... }`: a `from` right after the closing brace makes
		// it a re-export; anything else is a local re-declaration.
		const close = matchingBrace(tokens, afterType)
		if (close === -1) return INDETERMINATE
		if (tokens[close + 1]?.kind !== SyntaxKind.FromKeyword) return NONE
		const specifierToken = tokens[close + 2]
		if (specifierToken?.kind !== SyntaxKind.StringLiteral) return INDETERMINATE
		return { kind: 'specifier', specifierToken, clauseTokens: [] }
	}

	if (head?.kind === SyntaxKind.AsteriskToken) {
		// `export [type] * [as ns] from '...'`. The optional `as ns` is the only
		// thing that can sit between the asterisk and `from`.
		const fromIndex =
			tokens[afterType + 1]?.kind === SyntaxKind.AsKeyword
				? afterType + 3
				: afterType + 1
		if (tokens[fromIndex]?.kind !== SyntaxKind.FromKeyword) return INDETERMINATE
		const specifierToken = tokens[fromIndex + 1]
		if (specifierToken?.kind !== SyntaxKind.StringLiteral) return INDETERMINATE
		return { kind: 'specifier', specifierToken, clauseTokens: [] }
	}

	return NONE
}

/** True when `AsyncKeyword` at `tokens[index]` structurally opens an async function declaration/expression, async method (named, quoted, computed, or generator), or async arrow, not a bare use of "async" as an identifier, parameter, or property name. TypeScript emits `AsyncKeyword` for the text "async" unconditionally, since it's only a contextual keyword; this structural check is what keeps `const async = 5` from false-positiving. */
function isAsyncFunctionStart(
	tokens: readonly Token[],
	index: number,
): boolean {
	const next = tokens[index + 1]
	if (next === undefined) return false
	if (next.kind === SyntaxKind.FunctionKeyword) return true
	if (next.kind === SyntaxKind.OpenParenToken) return true // async (...) => … / async method(...)
	if (next.kind === SyntaxKind.AsteriskToken) return true // async *gen() {}
	if (
		next.kind === SyntaxKind.Identifier ||
		next.kind === SyntaxKind.StringLiteral ||
		next.kind === SyntaxKind.NumericLiteral
	) {
		const after = tokens[index + 2]
		// `async x => …` (bare single-param arrow), or `async name(...)` /
		// `async 'name'(...)` (method).
		return (
			after?.kind === SyntaxKind.EqualsGreaterThanToken ||
			after?.kind === SyntaxKind.OpenParenToken
		)
	}
	if (next.kind === SyntaxKind.OpenBracketToken) {
		// `async ['computed']() {}`: a method whose name is computed. The
		// trailing `(` is what separates it from an index access on a variable
		// that happens to be named `async`.
		let depth = 0
		for (
			let i = index + 1;
			i < tokens.length && i < index + 1 + MAX_LOOKAHEAD;
			i++
		) {
			const kind = tokens[i]?.kind
			if (kind === SyntaxKind.OpenBracketToken) depth++
			else if (kind === SyntaxKind.CloseBracketToken) {
				depth--
				if (depth === 0) {
					return tokens[i + 1]?.kind === SyntaxKind.OpenParenToken
				}
			}
		}
	}
	return false
}

/**
 * Ambient `object.member` reads that break AD-1's purity rule under `core/`.
 * `crypto` and `performance` are globals in Node and need no import, so the
 * import-boundary rules above never see them; only this table does.
 */
const IMPURE_MEMBERS: ReadonlyMap<string, string> = new Map([
	['Date.now', 'clock read'],
	['performance.now', 'clock read'],
	['performance.timeOrigin', 'clock read'],
	['Math.random', 'randomness'],
	['crypto.randomUUID', 'randomness'],
	['crypto.getRandomValues', 'randomness'],
	['crypto.randomBytes', 'randomness'],
	['crypto.randomInt', 'randomness'],
	['crypto.randomFillSync', 'randomness'],
	['crypto.randomFill', 'randomness'],
	['crypto.webcrypto', 'randomness'],
	['crypto.subtle', 'randomness'],
])

/** Scans one file's token stream, appending every violation it finds. */
function scanFile(
	file: string,
	source: string,
	files: ReadonlySet<string>,
	violations: Violation[],
): void {
	const layer = classifyLayer(file)
	if (layer === undefined) {
		// Fails closed: a `.ts` file under `src/` that sits in no declared layer
		// would otherwise be scanned for nothing at all, so every rule below
		// would silently pass over it.
		violations.push({
			file,
			line: 1,
			specifier: file,
			rule: 'file sits under src/ but in no declared architecture layer; add it to a layer directory or declare the layer',
		})
		return
	}
	const tokens = tokenize(source)
	const lineStarts = computeLineStarts(source)
	const purityScoped = layer === 'core' || layer === 'core-schemas'

	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i]
		if (token === undefined) continue
		const line = lineOf(lineStarts, token.start)

		if (token.kind === SyntaxKind.ImportKeyword) {
			const next = tokens[i + 1]
			if (next?.kind === SyntaxKind.OpenParenToken) {
				// Dynamic import() call. A comma after the specifier is the
				// import-attributes form (`import('x', { with: … })`), which is
				// still a literal specifier.
				const arg = tokens[i + 2]
				const closing = tokens[i + 3]
				if (
					arg?.kind === SyntaxKind.StringLiteral &&
					(closing?.kind === SyntaxKind.CloseParenToken ||
						closing?.kind === SyntaxKind.CommaToken)
				) {
					handleSpecifier(
						file,
						layer,
						arg.value,
						lineOf(lineStarts, arg.start),
						files,
						undefined,
						violations,
					)
				} else {
					violations.push({
						file,
						line,
						specifier: arg?.text ?? '',
						rule: 'dynamic import() argument must be a string literal',
					})
				}
				continue
			}
			// `import [type] Identifier = ...` (import-equals, with or without a
			// leading `type`).
			const equalsIndex = next?.kind === SyntaxKind.TypeKeyword ? i + 3 : i + 2
			const identIndex = equalsIndex - 1
			if (
				tokens[identIndex]?.kind === SyntaxKind.Identifier &&
				tokens[equalsIndex]?.kind === SyntaxKind.EqualsToken
			) {
				violations.push({
					file,
					line,
					specifier: tokens[identIndex]?.text ?? '',
					rule: 'import-equals declarations are prohibited under src/',
				})
				continue
			}
			const found = findImportSpecifier(tokens, i)
			if (found.kind === 'specifier') {
				handleSpecifier(
					file,
					layer,
					found.specifierToken.value,
					lineOf(lineStarts, found.specifierToken.start),
					files,
					found.clauseTokens,
					violations,
				)
			} else if (found.kind === 'indeterminate') {
				violations.push({
					file,
					line,
					specifier: '',
					rule: "could not determine this import declaration's specifier within the bounded token scan; the layer rules could not be applied to it",
				})
			}
			continue
		}

		if (token.kind === SyntaxKind.ExportKeyword) {
			const found = findExportSpecifier(tokens, i)
			if (found.kind === 'specifier') {
				handleSpecifier(
					file,
					layer,
					found.specifierToken.value,
					lineOf(lineStarts, found.specifierToken.start),
					files,
					undefined,
					violations,
				)
			} else if (found.kind === 'indeterminate') {
				violations.push({
					file,
					line,
					specifier: '',
					rule: "could not determine this re-export's specifier within the bounded token scan; the layer rules could not be applied to it",
				})
			}
			continue
		}

		if (token.kind === SyntaxKind.RequireKeyword) {
			const callToken =
				tokens[i + 1]?.kind === SyntaxKind.QuestionDotToken
					? tokens[i + 2]
					: tokens[i + 1]
			if (callToken?.kind === SyntaxKind.OpenParenToken) {
				violations.push({
					file,
					line,
					specifier: 'require',
					rule: 'CommonJS require is prohibited under src/; this ESM package needs neither',
				})
			}
			continue
		}

		if (!purityScoped) continue

		if (token.kind === SyntaxKind.AwaitKeyword) {
			violations.push({
				file,
				line,
				specifier: 'await',
				rule: 'no AwaitExpression under core/ — application/ is the only layer that awaits a port',
			})
			continue
		}

		if (
			token.kind === SyntaxKind.AsyncKeyword &&
			isAsyncFunctionStart(tokens, i)
		) {
			violations.push({
				file,
				line,
				specifier: 'async',
				rule: 'no async function under core/ — core stages are synchronous',
			})
			continue
		}

		if (
			token.kind === SyntaxKind.NewKeyword &&
			tokens[i + 1]?.kind === SyntaxKind.Identifier &&
			tokens[i + 1]?.text === 'Date'
		) {
			violations.push({
				file,
				line,
				specifier: 'new Date',
				rule: 'no clock read under core/ (AD-1): new Date() is impurity',
			})
			continue
		}

		if (
			token.kind === SyntaxKind.Identifier &&
			tokens[i + 1]?.kind === SyntaxKind.DotToken &&
			tokens[i + 2]?.kind === SyntaxKind.Identifier
		) {
			const member = `${token.text}.${tokens[i + 2]?.text}`
			const category = IMPURE_MEMBERS.get(member)
			if (category !== undefined) {
				violations.push({
					file,
					line,
					specifier: member,
					rule: `no ${category} under core/ (AD-1): ${member} is impurity`,
				})
			}
		}
	}
}

/**
 * Scans every source file in `files` (repo-relative POSIX path -> source
 * text) and returns every violation found, in no particular cross-file
 * order. Used both by the real repository scan (`scripts/
 * check-dependency-direction.ts`) and by in-memory synthetic test snippets.
 */
export function scanSources(files: ReadonlyMap<string, string>): Violation[] {
	const fileSet = new Set(files.keys())
	const violations: Violation[] = []
	for (const [file, source] of files) {
		scanFile(file, source, fileSet, violations)
	}
	return violations
}
