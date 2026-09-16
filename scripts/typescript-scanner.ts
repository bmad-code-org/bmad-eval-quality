// The one place the two source-scanning gates reach TypeScript.
//
// The scanner lives at `typescript/unstable/ast`, a subpath whose own name says
// it may move, and it exists from TypeScript 7.0: the 5.x line has no such
// subpath and the 7.x main entry exports no scanner. The optional peer range
// says `>=5.7.0` and stays that wide on purpose. npm resolves an optional peer
// that is present, so a range of `>=7` would turn `npm install` red for every
// consumer with TypeScript 5 in its tree and no interest in these two gates.
// The version fact lives here instead, spoken at the one moment it matters:
// when a consumer runs one of the two gates.
//
// Three refusals, each its own because the repair is different. The package
// is absent; the package is a version with no such subpath; the subpath is
// there and lacks a member this build reads. The third is the quiet one: a
// renamed enum member reads as `undefined`, `token.kind === undefined` never
// matches, and the rule it guarded switches off with every gate green. So every
// `SyntaxKind` member the three scanner modules read is listed below, and
// `tests/architecture/typescript-scanner.test.ts` derives the same list from
// their sources, so the list is not a copy a hand maintains.
//
// Run by `node` directly: Node's type stripping erases types only, so no
// TypeScript enum, namespace, parameter property, or non-type re-export may
// appear in this file or anything it imports, or the gate fails at load.

/** `error.code` on every refusal here; the binary maps it to the usage exit. */
export const TYPESCRIPT_UNAVAILABLE = 'EVAL_QUALITY_TYPESCRIPT_UNAVAILABLE'

/** Where the scanner is read from, and the first TypeScript that ships it. */
export const SCANNER_SUBPATH = 'typescript/unstable/ast'
export const SCANNER_SHIPS_FROM = '7.0.0'

/** Every `SyntaxKind` member `token-scan.ts`, `dependency-direction.ts` and `lineage-ownership.ts` read. */
export const REQUIRED_SYNTAX_KINDS = [
	'AmpersandToken',
	'AnyKeyword',
	'AsKeyword',
	'AsteriskToken',
	'AsyncKeyword',
	'AwaitKeyword',
	'BarToken',
	'BigIntKeyword',
	'BigIntLiteral',
	'BooleanKeyword',
	'CaseKeyword',
	'CatchKeyword',
	'ClassKeyword',
	'CloseBraceToken',
	'CloseBracketToken',
	'CloseParenToken',
	'ColonToken',
	'CommaToken',
	'ConstKeyword',
	'DefaultKeyword',
	'DotToken',
	'EndOfFile',
	'EqualsGreaterThanToken',
	'EqualsToken',
	'ExclamationToken',
	'ExportKeyword',
	'ExtendsKeyword',
	'FalseKeyword',
	'FirstAssignment',
	'ForKeyword',
	'FromKeyword',
	'FunctionKeyword',
	'GetKeyword',
	'Identifier',
	'IfKeyword',
	'ImportKeyword',
	'InterfaceKeyword',
	'LastAssignment',
	'LessThanToken',
	'LetKeyword',
	'MinusMinusToken',
	'NeverKeyword',
	'NewKeyword',
	'NoSubstitutionTemplateLiteral',
	'NullKeyword',
	'NumberKeyword',
	'NumericLiteral',
	'ObjectKeyword',
	'OpenBraceToken',
	'OpenBracketToken',
	'OpenParenToken',
	'PlusPlusToken',
	'PrivateKeyword',
	'ProtectedKeyword',
	'PublicKeyword',
	'QuestionDotToken',
	'QuestionToken',
	'ReadonlyKeyword',
	'RegularExpressionLiteral',
	'RequireKeyword',
	'ReturnKeyword',
	'SemicolonToken',
	'SetKeyword',
	'SlashEqualsToken',
	'SlashToken',
	'StaticKeyword',
	'StringKeyword',
	'StringLiteral',
	'SuperKeyword',
	'SymbolKeyword',
	'TemplateHead',
	'TemplateTail',
	'ThisKeyword',
	'TrueKeyword',
	'TypeKeyword',
	'UndefinedKeyword',
	'UnknownKeyword',
	'VarKeyword',
	'VoidKeyword',
	'WhileKeyword',
	'WithKeyword',
] as const

export type ScannerModule = {
	readonly createScanner: (...args: readonly unknown[]) => unknown
	readonly computeLineStarts: (text: string) => readonly number[]
	readonly SyntaxKind: Readonly<Record<string, number>>
}

export type ScannerLoad = () => Promise<unknown>
export type VersionRead = () => Promise<string | null>

const codedError = (message: string): Error =>
	Object.assign(new Error(message), { code: TYPESCRIPT_UNAVAILABLE })

const defaultLoad: ScannerLoad = () => import('typescript/unstable/ast')

// `typescript/package.json` is on the package's export map, so the version is
// read from the install itself. A read that fails names no version rather than
// failing the refusal that wanted it.
const defaultVersion: VersionRead = async () => {
	try {
		const manifest = (await import('typescript/package.json', {
			with: { type: 'json' },
		})) as { default?: { version?: unknown } }
		const version = manifest.default?.version
		return typeof version === 'string' ? version : null
	} catch {
		return null
	}
}

/** The sentence for an absent package, shared so both gates say the same thing. */
export const absentMessage = (gate: string): string =>
	`the ${gate} gate reads your source with the TypeScript scanner, and the optional peer dependency "typescript" is not installed here. Install it (npm install --save-dev typescript), or drop the "${gate}" section from your configuration to stop invoking this gate. Only the dependency-direction and field-ownership gates need it.`

/** Whether `error` carries `code` as a `NodeJS.ErrnoException` would, without assuming `error` is an object at all. */
export const isCode = (error: unknown, code: string): boolean =>
	error !== null &&
	typeof error === 'object' &&
	(error as { code?: unknown }).code === code

/**
 * The scanner module, or a refusal carrying `TYPESCRIPT_UNAVAILABLE` that names
 * the gate, the installed version and the repair. Anything that is not one of
 * the three refusals is rethrown unchanged.
 *
 * `load` and `readVersion` are injectable so each refusal has a case that
 * uninstalls nothing.
 */
export async function loadTypeScriptScanner(
	gate: string,
	load: ScannerLoad = defaultLoad,
	readVersion: VersionRead = defaultVersion,
): Promise<ScannerModule> {
	let loaded: unknown
	try {
		loaded = await load()
	} catch (error) {
		if (isCode(error, 'ERR_MODULE_NOT_FOUND')) {
			throw codedError(absentMessage(gate))
		}
		if (isCode(error, 'ERR_PACKAGE_PATH_NOT_EXPORTED')) {
			const version =
				(await readVersion().catch(() => null)) ?? 'an unknown version'
			throw codedError(
				`the ${gate} gate reads your source with the TypeScript scanner at ${SCANNER_SUBPATH}, and typescript ${version} carries no such subpath; TypeScript ships it from ${SCANNER_SHIPS_FROM}. Install typescript 7 to run this gate, or drop the "${gate}" section from your configuration to stop invoking it.`,
			)
		}
		throw error
	}

	const module = (loaded ?? {}) as Partial<ScannerModule>
	const missing: string[] = []
	if (typeof module.createScanner !== 'function') missing.push('createScanner')
	if (typeof module.computeLineStarts !== 'function') {
		missing.push('computeLineStarts')
	}
	const kinds = module.SyntaxKind
	if (kinds === null || typeof kinds !== 'object') {
		missing.push('SyntaxKind')
	} else {
		for (const name of REQUIRED_SYNTAX_KINDS) {
			if (typeof kinds[name] !== 'number') missing.push(`SyntaxKind.${name}`)
		}
	}
	if (missing.length > 0) {
		const version =
			(await readVersion().catch(() => null)) ?? 'an unknown version'
		throw codedError(
			`the ${gate} gate reads ${missing.join(', ')} from ${SCANNER_SUBPATH}, and typescript ${version} ships it without ${missing.length === 1 ? 'that name' : 'those names'}; a member this gate cannot find would switch a rule off silently, so it refuses instead. This build reads the scanner TypeScript 7 ships.`,
		)
	}
	return module as ScannerModule
}
