// The layer-rule evaluator, over a graph the caller supplies. Pure and
// synchronous, with no filesystem I/O: `check-dependency-direction.ts` reads the
// trees and `dependency-direction.test.ts` calls `scanSources` against both
// synthetic and real source maps, so one function backs both.
//
// This module is reached through a dynamic import, after the optional peer
// `typescript` has been probed by name. Nothing else may import it statically:
// `typescript/unstable/ast` below is the runtime value that makes a static
// import fail at load in a consumer that installed only the other gates.
//
// Tokenizing is `token-scan.ts`'s job. Every construct is a short, fixed token
// shape over that stream, and an unresolved shape is reported (fail-closed).

import { posix } from 'node:path'
import { SyntaxKind } from 'typescript/unstable/ast'
import type { DependencyDirectionConfig } from './check-dependency-direction.ts'
import {
	computeLineStarts,
	lineOf,
	scanTokens,
	type Token,
} from './token-scan.ts'

export type Violation = {
	readonly file: string
	readonly line: number
	readonly specifier: string
	readonly rule: string
}

type ExternalPolicy = DependencyDirectionConfig['layers'][number]['externals']

export type CompiledLayer = {
	readonly name: string
	readonly label: string
	readonly match: 'exact' | 'prefix'
	readonly path: string
	readonly imports: ReadonlySet<string>
	readonly externals: ExternalPolicy
	readonly pure: boolean
}

type CompiledExemption = {
	readonly module: string
	readonly binding: string
	readonly rule: string
}

type CompiledPurity = {
	readonly awaitRule: string
	readonly asyncFunctionRule: string
	readonly newDateRule: string
	readonly members: ReadonlyMap<string, string>
}

export type DirectionGraph = {
	/** In declared order. The first match wins, which is why this is a list. */
	readonly layers: readonly CompiledLayer[]
	readonly rootPaths: readonly string[]
	/** Every extension any root declares, used to resolve a specifier that omits one. */
	readonly extensions: readonly string[]
	readonly exemptions: ReadonlyMap<string, readonly CompiledExemption[]>
	readonly purity: CompiledPurity | undefined
	readonly commonjs: 'forbid' | 'check'
}

/**
 * Turns a validated configuration section into the form the scan reads. It
 * preserves `layers` order exactly and sorts nothing: the order is the graph,
 * and the section's schema refuses a row an earlier row already matches in full.
 */
export function compileGraph(
	section: DependencyDirectionConfig,
): DirectionGraph {
	const pure = new Set(section.purity?.layers ?? [])
	const exemptions = new Map<string, CompiledExemption[]>()
	for (const exemption of section.exemptions) {
		const existing = exemptions.get(exemption.file) ?? []
		existing.push({
			module: exemption.module,
			binding: exemption.binding,
			rule: exemption.rule,
		})
		exemptions.set(exemption.file, existing)
	}
	return {
		layers: section.layers.map((layer) => ({
			name: layer.name,
			label: layer.label ?? layer.name,
			match: layer.match,
			path: layer.path,
			imports: new Set(layer.imports),
			externals: layer.externals,
			pure: pure.has(layer.name),
		})),
		rootPaths: section.roots.map((root) => root.path),
		extensions: [...new Set(section.roots.flatMap((root) => root.extensions))],
		exemptions,
		purity:
			section.purity === undefined
				? undefined
				: {
						awaitRule: section.purity.awaitRule,
						asyncFunctionRule: section.purity.asyncFunctionRule,
						newDateRule: section.purity.newDateRule,
						members: new Map(
							section.purity.members.map((entry) => [entry.member, entry.rule]),
						),
					},
		commonjs: section.commonjs,
	}
}

/** The first layer in declared order that matches this repository-relative POSIX path, or `undefined` for a file the graph does not place. */
export function classifyLayer(
	file: string,
	layers: readonly CompiledLayer[],
): CompiledLayer | undefined {
	return layers.find((layer) =>
		layer.match === 'exact' ? file === layer.path : file.startsWith(layer.path),
	)
}

const isAllowedEdge = (from: CompiledLayer, to: CompiledLayer): boolean =>
	from.imports.has(to.name)

const underARoot = (path: string, rootPaths: readonly string[]): boolean =>
	rootPaths.some((root) => path === root || path.startsWith(`${root}/`))

type Resolution =
	| { readonly ok: true; readonly resolved: string }
	| { readonly ok: false; readonly error: 'escapes-roots' | 'unresolved' }

/** Resolves a literal relative specifier against its containing file, trying the declared extensions and their `index` files. Fails closed: a specifier leaving the declared roots, or one that resolves to no scanned file, is an error rather than a best-effort guess. */
function resolveRelative(
	fromFile: string,
	specifier: string,
	files: ReadonlySet<string>,
	graph: DirectionGraph,
): Resolution {
	const fromDir = posix.dirname(fromFile)
	const joined = posix.normalize(posix.join(fromDir, specifier))
	if (!underARoot(joined, graph.rootPaths)) {
		return { ok: false, error: 'escapes-roots' }
	}
	if (files.has(joined)) return { ok: true, resolved: joined }
	for (const extension of graph.extensions) {
		if (files.has(`${joined}${extension}`)) {
			return { ok: true, resolved: `${joined}${extension}` }
		}
	}
	for (const extension of graph.extensions) {
		if (files.has(`${joined}/index${extension}`)) {
			return { ok: true, resolved: `${joined}/index${extension}` }
		}
	}
	return { ok: false, error: 'unresolved' }
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

/**
 * Whether an import clause binds exactly `binding`, as `{ binding }` or
 * `{ binding as other }`, optionally type-only.
 *
 * This predicate is the gate's own and is not configurable: the binding name is
 * data, the token shape it has to hold is the thing being enforced. A default or
 * namespace binding beside the brace group pulls in the rest of the module, so
 * the whole clause has to be that group.
 */
function isSoleBindingClause(
	clauseTokens: readonly Token[],
	binding: string,
): boolean {
	const clause =
		clauseTokens[0]?.kind === SyntaxKind.TypeKeyword
			? clauseTokens.slice(1)
			: clauseTokens
	if (clause[0]?.kind !== SyntaxKind.OpenBraceToken) return false
	if (clause[clause.length - 1]?.kind !== SyntaxKind.CloseBraceToken) {
		return false
	}
	// Commas are punctuation, so a formatter's trailing comma never changes what
	// the clause binds.
	const inner = clause
		.slice(1, -1)
		.filter((token) => token.kind !== SyntaxKind.CommaToken)
	if (inner[0]?.kind !== SyntaxKind.Identifier || inner[0].text !== binding) {
		return false
	}
	if (inner.length === 1) return true
	return (
		inner.length === 3 &&
		inner[1]?.kind === SyntaxKind.AsKeyword &&
		inner[2]?.kind === SyntaxKind.Identifier
	)
}

/** How a dependency was written. A reference directive is a dependency with no import statement, so it reads differently in the report. */
type Via = 'import' | 'reference'

function checkExternalSpecifier(
	file: string,
	layer: CompiledLayer,
	specifier: string,
	line: number,
	clauseTokens: readonly Token[] | undefined,
	via: Via,
	graph: DirectionGraph,
	violations: Violation[],
): void {
	if (layer.externals.policy === 'unrestricted') return

	const suffix =
		via === 'reference'
			? '; reached through a triple-slash reference directive rather than an import'
			: ''

	const exemption = graph.exemptions
		.get(file)
		?.find((entry) => entry.module === specifier)
	if (exemption !== undefined) {
		// The exemption reaches a static import declaration and nothing else. A
		// re-export, a dynamic import and a reference directive all arrive with no
		// clause tokens, and none of them can be held to a binding list.
		if (
			via === 'import' &&
			clauseTokens !== undefined &&
			isSoleBindingClause(clauseTokens, exemption.binding)
		) {
			return
		}
		violations.push({
			file,
			line,
			specifier,
			rule: `${exemption.rule}${suffix}`,
		})
		return
	}

	if (
		layer.externals.policy === 'allow' &&
		layer.externals.modules.includes(specifier)
	) {
		return
	}

	violations.push({
		file,
		line,
		specifier,
		rule: `${layer.externals.rule}${suffix}`,
	})
}

function handleRelative(
	file: string,
	layer: CompiledLayer,
	specifier: string,
	line: number,
	files: ReadonlySet<string>,
	via: Via,
	graph: DirectionGraph,
	violations: Violation[],
): void {
	const resolution = resolveRelative(file, specifier, files, graph)
	if (!resolution.ok) {
		const subject =
			via === 'reference' ? 'triple-slash reference path' : 'relative import'
		violations.push({
			file,
			line,
			specifier,
			rule:
				resolution.error === 'escapes-roots'
					? `${subject} escapes the declared scan roots`
					: `${subject} does not resolve to a scanned source file`,
		})
		return
	}
	const target = classifyLayer(resolution.resolved, graph.layers)
	if (target !== undefined && isAllowedEdge(layer, target)) return
	const toLabel = target === undefined ? resolution.resolved : target.label
	violations.push({
		file,
		line,
		specifier,
		rule:
			via === 'reference'
				? `${layer.label} may not depend on ${toLabel}; a triple-slash reference directive is a dependency with no import statement`
				: `${layer.label} may not import ${toLabel}`,
	})
}

function handleSpecifier(
	file: string,
	layer: CompiledLayer,
	specifier: string,
	line: number,
	files: ReadonlySet<string>,
	clauseTokens: readonly Token[] | undefined,
	graph: DirectionGraph,
	violations: Violation[],
): void {
	if (specifier.startsWith('.')) {
		handleRelative(
			file,
			layer,
			specifier,
			line,
			files,
			'import',
			graph,
			violations,
		)
		return
	}
	checkExternalSpecifier(
		file,
		layer,
		specifier,
		line,
		clauseTokens,
		'import',
		graph,
		violations,
	)
}

/**
 * The outcome of looking for an import/re-export statement's specifier.
 * `none` means the statement has no specifier to check (a local re-export, a
 * plain declaration export, `import.meta`). `indeterminate` means the
 * statement should have had one and the bounded token scan could not find it,
 * which the fail-closed rule reports rather than skips.
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

/** True when `AsyncKeyword` at `tokens[index]` structurally opens an async function declaration/expression, async method (named, quoted, computed, or generator), or async arrow. TypeScript emits `AsyncKeyword` for the text "async" unconditionally, since it's only a contextual keyword, so a bare use as an identifier, parameter or property name reaches here too. This structural check is what keeps `const async = 5` from false-positiving, and it stays the gate's own: no table of banned words could express it. */
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
 * A triple-slash reference directive, which TypeScript honours only in a file's
 * leading trivia. It is a dependency written as a comment, so the tokenizer,
 * which skips trivia by construction, can never see one: an edge declared this
 * way crossed every layer boundary in this gate's first shipped form without
 * producing a single token to check. The leading trivia is scanned as text for
 * that reason, which is where TypeScript itself reads these.
 */
const REFERENCE_DIRECTIVE = /^[ \t]*\/\/\/[ \t]*<reference\b([^\n>]*)>/gm

const attributeOf = (attributes: string, name: string): string | undefined =>
	new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`).exec(attributes)?.[1]

function scanReferenceDirectives(
	file: string,
	leading: string,
	lineStarts: readonly number[],
	layer: CompiledLayer,
	files: ReadonlySet<string>,
	graph: DirectionGraph,
	violations: Violation[],
): void {
	for (const match of leading.matchAll(REFERENCE_DIRECTIVE)) {
		const attributes = match[1] ?? ''
		const line = lineOf(lineStarts, match.index ?? 0)

		const path = attributeOf(attributes, 'path')
		if (path !== undefined) {
			// A reference path is always resolved against the containing file,
			// with or without a leading "./", so it never takes the bare-specifier
			// branch an import would.
			handleRelative(
				file,
				layer,
				path,
				line,
				files,
				'reference',
				graph,
				violations,
			)
			continue
		}

		const types = attributeOf(attributes, 'types')
		if (types !== undefined) {
			checkExternalSpecifier(
				file,
				layer,
				types,
				line,
				undefined,
				'reference',
				graph,
				violations,
			)
			continue
		}

		// `lib` and `no-default-lib` name a TypeScript library file, so neither is
		// an edge in any graph a consumer declares.
		if (
			attributeOf(attributes, 'lib') !== undefined ||
			/\bno-default-lib\s*=/.test(attributes)
		) {
			continue
		}

		violations.push({
			file,
			line,
			specifier: match[0].trim(),
			rule: 'could not read this triple-slash reference directive; it declares a dependency and the layer rules could not be applied to it',
		})
	}
}

/** Scans one file's token stream, appending every violation it finds. */
function scanFile(
	file: string,
	source: string,
	files: ReadonlySet<string>,
	graph: DirectionGraph,
	violations: Violation[],
): void {
	const layer = classifyLayer(file, graph.layers)
	if (layer === undefined) {
		// Fails closed: a file under a declared scan root that sits in no declared
		// layer would otherwise be scanned for nothing at all, so every rule below
		// would silently pass over it.
		violations.push({
			file,
			line: 1,
			specifier: file,
			rule: 'file sits under a declared scan root but in no declared layer; move it into a layer, or declare the layer',
		})
		return
	}
	const tokens = scanTokens(source)
	const lineStarts = computeLineStarts(source)
	const purity = layer.pure ? graph.purity : undefined

	scanReferenceDirectives(
		file,
		source.slice(0, tokens[0]?.start ?? source.length),
		lineStarts,
		layer,
		files,
		graph,
		violations,
	)

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
						graph,
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
				// Under `commonjs: "check"` the `require` token that follows is what
				// carries the specifier, and the branch below checks its edge, so
				// reporting here as well would count one dependency twice.
				if (graph.commonjs === 'forbid') {
					violations.push({
						file,
						line,
						specifier: tokens[identIndex]?.text ?? '',
						rule: 'import-equals declarations are prohibited in the scanned trees',
					})
				}
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
					graph,
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
					graph,
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
			const openIndex =
				tokens[i + 1]?.kind === SyntaxKind.QuestionDotToken ? i + 2 : i + 1
			if (tokens[openIndex]?.kind !== SyntaxKind.OpenParenToken) continue
			if (graph.commonjs === 'forbid') {
				violations.push({
					file,
					line,
					specifier: 'require',
					rule: 'CommonJS require is prohibited in the scanned trees; set "commonjs" to "check" to have require() edges read and held to the layer rules instead',
				})
				continue
			}
			const arg = tokens[openIndex + 1]
			if (
				arg?.kind === SyntaxKind.StringLiteral &&
				tokens[openIndex + 2]?.kind === SyntaxKind.CloseParenToken
			) {
				handleSpecifier(
					file,
					layer,
					arg.value,
					lineOf(lineStarts, arg.start),
					files,
					undefined,
					graph,
					violations,
				)
			} else {
				violations.push({
					file,
					line,
					specifier: arg?.text ?? '',
					rule: 'require() argument must be a string literal',
				})
			}
			continue
		}

		if (purity === undefined) continue

		if (token.kind === SyntaxKind.AwaitKeyword) {
			violations.push({
				file,
				line,
				specifier: 'await',
				rule: purity.awaitRule,
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
				rule: purity.asyncFunctionRule,
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
				rule: purity.newDateRule,
			})
			continue
		}

		if (
			token.kind === SyntaxKind.Identifier &&
			tokens[i + 1]?.kind === SyntaxKind.DotToken &&
			tokens[i + 2]?.kind === SyntaxKind.Identifier
		) {
			const member = `${token.text}.${tokens[i + 2]?.text}`
			const rule = purity.members.get(member)
			if (rule !== undefined) {
				violations.push({ file, line, specifier: member, rule })
			}
		}
	}
}

/**
 * Scans every source file in `files` (repo-relative POSIX path -> source text)
 * against `graph` and returns every violation found, in no particular cross-file
 * order.
 */
export function scanSources(
	files: ReadonlyMap<string, string>,
	graph: DirectionGraph,
): Violation[] {
	const fileSet = new Set(files.keys())
	const violations: Violation[] = []
	for (const [file, source] of files) {
		scanFile(file, source, fileSet, graph, violations)
	}
	return violations
}
