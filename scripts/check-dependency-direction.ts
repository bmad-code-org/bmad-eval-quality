// The dependency-direction gate: its configuration format, its refusals, and
// the entry the gates binary calls.
//
// The layer graph used to live in this repository's code, as eight literal
// prefix tests and a `switch` per source layer. Here it is the consumer's data,
// so a repository adopting this gate declares its own trees, its own layers and
// its own edges, and nothing of eval-quality's architecture reaches it.
//
// Nothing in this module reaches `typescript`. That is deliberate and load
// bearing: the scanner needs `typescript/unstable/ast` at runtime, `typescript`
// is an optional peer dependency, and a static import of the scanner here would
// make a consumer without it fail at module load with a resolver stack instead
// of the named refusal below. The scanner is reached through a dynamic import,
// after the peer is probed.
//
// Run by `node` directly: Node's type stripping erases types only, so no
// TypeScript enum, namespace, parameter property, or non-type re-export may
// appear in this file or anything it imports, or the gate fails at load.
import { z } from 'zod'
import type { DirectionGraph, Violation } from './dependency-direction.ts'
import { discoverSourceFiles } from './discover-source-files.ts'

/** The gate's key in the configuration file, and the token the binary dispatches on. */
export const DEPENDENCY_DIRECTION_GATE = 'dependency-direction'

/**
 * How many violations this repository's own tree reports when the two layer
 * rows whose prefixes nest are swapped. It is stated in the schema's own
 * description and asserted by `tests/architecture/dependency-direction.test.ts`,
 * so the ordering property below is a measured fact rather than a warning.
 */
export const ORDERING_WITNESS_VIOLATIONS = 78

/** The optional peer is absent. The consumer repairs it by installing it, so it takes the usage code. */
export const TYPESCRIPT_PEER_MISSING = 'EVAL_QUALITY_TYPESCRIPT_PEER_MISSING'

/** A declared scan root could not be walked. Also a usage code: nothing was scanned, so nothing was answered. */
export const DIRECTION_SCAN_ERROR = 'EVAL_QUALITY_DIRECTION_SCAN_ERROR'

const NonEmpty = z.string().min(1)

/**
 * A repository-relative POSIX path. No leading slash, no backslash, no `.` or
 * `..` segment: every path in this section is resolved against the directory the
 * configuration file sits in, and a path that can climb out of it would make the
 * declared scan roots a suggestion.
 */
const RelativePath = NonEmpty.refine((value) => {
	// One trailing slash is how a prefix layer says "this directory"; everything
	// else about the shape is refused.
	const body = value.endsWith('/') ? value.slice(0, -1) : value
	return (
		body.length > 0 &&
		!body.startsWith('/') &&
		!body.includes('\\') &&
		!body
			.split('/')
			.some((part) => part === '.' || part === '..' || part === '')
	)
}, 'is not a repository-relative POSIX path: a leading slash, a backslash, an empty segment, and a "." or ".." segment are all refused')

const Extension = NonEmpty.regex(
	/^\.[A-Za-z0-9]+$/,
	'is not a file extension: write it with its leading dot, as ".ts" or ".cjs"',
)

const LayerName = NonEmpty.regex(
	/^[a-z][a-z0-9-]*$/,
	'is not a layer name: lowercase letters, digits and hyphens, starting with a letter',
)

const ScanRoot = z
	.strictObject({
		path: RelativePath.describe(
			'A directory to walk, repository-relative. Its whole subtree is scanned.',
		),
		extensions: z
			.array(Extension)
			.min(1)
			.default(['.ts'])
			.describe(
				'Which files under this root are read. A root is a directory plus its extensions rather than a glob, so "every .cjs file under src/" is one root and needs no glob language to say.',
			),
	})
	.describe('One tree to scan, and the file extensions to read inside it.')

const Unrestricted = z.strictObject({ policy: z.literal('unrestricted') })

const DenyExternals = z.strictObject({
	policy: z.literal('deny'),
	rule: NonEmpty.describe(
		'What a reader is told when this layer imports an external module. Your sentence, printed verbatim: the reason a layer holds no external dependency belongs to your architecture.',
	),
})

const AllowExternals = z.strictObject({
	policy: z.literal('allow'),
	modules: z
		.array(NonEmpty)
		.min(1)
		.describe(
			'The specifiers this layer may import, matched by exact string equality. "zod" admits "zod" and refuses "zod/v4" and "zod-to-json-schema", so a subpath is a separate entry you write out.',
		),
	rule: NonEmpty.describe(
		'What a reader is told when this layer imports something outside that list. Printed verbatim.',
	),
})

const ExternalPolicy = z
	.discriminatedUnion('policy', [Unrestricted, DenyExternals, AllowExternals])
	.describe(
		'What this layer may reach outside the scanned trees. "unrestricted" admits everything and is the default. "deny" refuses every external module and runtime builtin. "allow" admits the listed specifiers and no others.',
	)

const LayerRule = z
	.strictObject({
		name: LayerName.describe(
			'How the other layers name this one in their "imports" lists.',
		),
		match: z
			.enum(['exact', 'prefix'])
			.describe(
				'"exact" matches one file by its whole path. "prefix" matches every file under a directory, and its path ends with "/".',
			),
		path: RelativePath.describe(
			'The path this layer matches: a file path for "exact", a directory path ending in "/" for "prefix".',
		),
		label: NonEmpty.optional().describe(
			'How this layer is named in a violation line. Defaults to the layer name.',
		),
		imports: z
			.array(LayerName)
			.describe(
				'Every layer this one may import, named in full. Name this layer here when it may import itself: an implicit self-edge would be a permission nobody wrote down and nobody can find. An unlisted layer is denied.',
			),
		externals: ExternalPolicy.default({ policy: 'unrestricted' }),
	})
	.describe(
		'One layer: what it matches, what it may import, what it may reach outside.',
	)

const ImportExemption = z
	.strictObject({
		file: RelativePath.describe('The one file the exemption covers.'),
		module: NonEmpty.describe(
			'The external specifier that file may reach, by exact string equality.',
		),
		binding: NonEmpty.regex(
			/^[A-Za-z_$][A-Za-z0-9_$]*$/,
			'is not an identifier',
		).describe(
			'The single named binding the import clause may carry. `{ binding }` and `{ binding as other }` are the whole clause; a default or namespace binding beside it pulls in the rest of the module and is not the exemption.',
		),
		rule: NonEmpty.describe(
			'What a reader is told when that file reaches that module any other way. It is its own sentence, so a narrow exemption reads as a narrow exemption in the report.',
		),
	})
	.describe(
		'One file, one external module, one named binding. The exemption reaches a static import declaration and nothing else: a re-export and a dynamic import of the same module are refused, because neither can be held to a binding list.',
	)

const PurityScope = z
	.strictObject({
		layers: z
			.array(LayerName)
			.min(1)
			.describe('The layers held to the bans below.'),
		awaitRule: NonEmpty.describe(
			'What a reader is told when an await appears in a purity-scoped layer.',
		),
		asyncFunctionRule: NonEmpty.describe(
			'What a reader is told when an async function appears in a purity-scoped layer.',
		),
		newDateRule: NonEmpty.describe(
			'What a reader is told when `new Date` appears in a purity-scoped layer.',
		),
		members: z
			.array(
				z.strictObject({
					member: NonEmpty.regex(
						/^[A-Za-z_$][A-Za-z0-9_$]*\.[A-Za-z_$][A-Za-z0-9_$]*$/,
						'is not an `object.member` pair',
					).describe('The ambient read, as `object.member`.'),
					rule: NonEmpty.describe('What a reader is told when it appears.'),
				}),
			)
			.default([])
			.describe(
				'Ambient reads banned in these layers. A global such as `crypto` or `performance` needs no import, so no import rule can see it and only this table can.',
			),
	})
	.describe(
		'Layers that must stay pure. `await`, an async function, `new Date`, and each listed ambient read are refused inside them.',
	)

/**
 * The section a consumer writes. Exported for `gate-config.ts` to compose into
 * the whole document, and for `check-doc-claims.ts` to parse the documented
 * example through.
 */
export const DependencyDirectionSection = z
	.strictObject({
		roots: z
			.array(ScanRoot)
			.min(1)
			.describe('The trees this gate walks. Nothing outside them is read.'),
		layers: z
			.array(LayerRule)
			.min(1)
			.describe(
				'THE LAYERS ARE AN ORDERED LIST AND THE FIRST MATCH WINS. Narrower prefixes are listed before the wider ones that contain them, because every file under "src/core/schemas/" also sits under "src/core/" and only the order decides which rules it is held to. In this repository\'s own configuration, swapping those two rows reports ' +
					String(ORDERING_WITNESS_VIOLATIONS) +
					' violations where there are none today. This is a list rather than an object keyed by layer name for that reason alone: a map has no order, and normalising this into one, or sorting it, silently rewrites the graph it describes. A layer that a row before it already matches in full is refused here, so the mistake is a configuration error rather than a quiet re-layering.',
			),
		exemptions: z
			.array(ImportExemption)
			.default([])
			.describe(
				"Per-file holes in a layer's external policy, each naming the one module and the one binding it opens.",
			),
		purity: PurityScope.optional().describe(
			'Absent means no layer is held to the purity bans.',
		),
		commonjs: z
			.enum(['forbid', 'check'])
			.default('forbid')
			.describe(
				'"forbid" refuses `require()` and `import x = require()` outright, which is what an ESM-only tree wants. "check" reads a literal `require()` specifier as an edge and holds it to the same layer rules, which is what a tree with CommonJS files needs: the alternative of ignoring them would scan a .cjs tree, find no import statement in it, and report a clean pass over a file it never read an edge from.',
			),
		reportOnly: z
			.boolean()
			.default(false)
			.describe(
				'true prints the violations and exits 0. It is declared here rather than passed as a flag so that "we are still counting" is a committed line a reviewer sees and a one-line diff turns off, instead of an invocation detail nobody reading the repository can find. The run still prints its count, including zero, and still fails at 64 when a declared root yielded no files, so a green report-only run can never mean the gate scanned nothing.',
			),
	})
	.superRefine((section, ctx) => {
		const issue = (path: PropertyKey[], message: string): void => {
			ctx.addIssue({ code: 'custom', path, message })
		}

		// A root inside another root would read every file under the inner one
		// twice, once under each root's extension list, and report every violation
		// in it twice.
		section.roots.forEach((root, index) => {
			section.roots.forEach((other, otherIndex) => {
				if (index === otherIndex) return
				if (`${root.path}/`.startsWith(`${other.path}/`)) {
					issue(
						['roots', index, 'path'],
						`"${root.path}" sits inside the root "${other.path}"; declare the outer root once and list every extension it reads`,
					)
				}
			})
		})

		const underARoot = (path: string): boolean =>
			section.roots.some(
				(root) => path === root.path || path.startsWith(`${root.path}/`),
			)

		const names = new Set<string>()
		section.layers.forEach((layer, index) => {
			if (names.has(layer.name)) {
				issue(['layers', index, 'name'], `"${layer.name}" is declared twice`)
			}
			names.add(layer.name)

			if (layer.match === 'prefix' && !layer.path.endsWith('/')) {
				issue(
					['layers', index, 'path'],
					`"${layer.path}" is a prefix match and has to end with "/", so that a layer at "src/core/" never claims "src/core-experimental/x.ts"`,
				)
			}
			if (layer.match === 'exact' && layer.path.endsWith('/')) {
				issue(
					['layers', index, 'path'],
					`"${layer.path}" is an exact match on one file and may not end with "/"`,
				)
			}
			if (!underARoot(layer.path.replace(/\/$/, ''))) {
				issue(
					['layers', index, 'path'],
					`"${layer.path}" sits under none of the declared roots, so it can never match a scanned file`,
				)
			}

			// The ordering property, enforced rather than documented: a row whose
			// every match is already claimed by an earlier row never fires, and the
			// files it was written for are silently held to the earlier row's rules.
			section.layers.slice(0, index).forEach((earlier, earlierIndex) => {
				if (earlier.match !== 'prefix') return
				if (!layer.path.startsWith(earlier.path)) return
				issue(
					['layers', index, 'path'],
					`"${layer.path}" is unreachable: layers[${earlierIndex}] "${earlier.name}" matches "${earlier.path}" and every path under it, and it is listed first. Move "${layer.name}" above it.`,
				)
			})
		})

		section.layers.forEach((layer, index) => {
			layer.imports.forEach((target, position) => {
				if (names.has(target)) return
				issue(
					['layers', index, 'imports', position],
					`names "${target}", which is not a declared layer: ${[...names].join(', ')}`,
				)
			})
		})

		// A layer is matched by walking the list in order, which is what makes an
		// exemption on an unrestricted layer dead configuration rather than a
		// harmless extra: that layer already admits every module.
		section.exemptions.forEach((exemption, index) => {
			const layer = section.layers.find((candidate) =>
				candidate.match === 'exact'
					? candidate.path === exemption.file
					: exemption.file.startsWith(candidate.path),
			)
			if (layer === undefined) {
				issue(
					['exemptions', index, 'file'],
					`"${exemption.file}" matches no declared layer, so nothing holds it and the exemption opens nothing`,
				)
				return
			}
			if (layer.externals.policy === 'unrestricted') {
				issue(
					['exemptions', index, 'file'],
					`"${exemption.file}" sits in the layer "${layer.name}", whose externals are unrestricted, so this exemption grants what that layer already allows`,
				)
			}
		})

		section.purity?.layers.forEach((name, position) => {
			if (names.has(name)) return
			issue(
				['purity', 'layers', position],
				`names "${name}", which is not a declared layer: ${[...names].join(', ')}`,
			)
		})
	})
	.describe(
		'Holds every import, re-export, dynamic import and triple-slash reference directive in the trees you declare against a layer graph you declare, and holds your pure layers to a ban on await, async functions, `new Date`, and the ambient reads you list.',
	)

export type DependencyDirectionConfig = z.infer<
	typeof DependencyDirectionSection
>

export type DirectionOutcome =
	| {
			readonly kind: 'refused'
			readonly code: string
			readonly message: string
	  }
	| {
			readonly kind: 'report'
			readonly reportOnly: boolean
			readonly failed: boolean
			readonly scannedFiles: number
			readonly violations: readonly Violation[]
			/** Always written, on every outcome, including a clean one and a report-only one. */
			readonly summary: string
			/** One line per violation, already ordered by file and line. */
			readonly lines: readonly string[]
	  }

const refuse = (code: string, message: string): DirectionOutcome => ({
	kind: 'refused',
	code,
	message,
})

/**
 * The scanner needs `typescript/unstable/ast`, and `typescript` is an optional
 * peer dependency so that a consumer running the other gates installs nothing.
 * Probing it by name is what turns a resolver stack trace into a sentence naming
 * the dependency and the gate that wanted it.
 *
 * `load` is injectable so a test can exercise the refusal without uninstalling
 * the package the test runner itself needs.
 */
export async function probeTypeScript(
	load: () => Promise<unknown> = () => import('typescript/unstable/ast'),
): Promise<
	{ readonly ok: true } | { readonly ok: false; readonly message: string }
> {
	try {
		await load()
		return { ok: true }
	} catch {
		return {
			ok: false,
			message: `the ${DEPENDENCY_DIRECTION_GATE} gate reads your source with the TypeScript scanner, and the optional peer dependency "typescript" is not installed here. Install it (npm install --save-dev typescript), or drop the "${DEPENDENCY_DIRECTION_GATE}" section from your configuration to stop invoking this gate. No other gate needs it.`,
		}
	}
}

const orderViolations = (violations: readonly Violation[]): Violation[] =>
	[...violations].sort((a, b) =>
		a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1,
	)

/**
 * Runs the gate and returns what to print and what to exit with. It writes to no
 * stream: the binary owns every write, and `summary` is the one line it always
 * writes, so no outcome of this gate can be silent.
 */
export async function runDependencyDirection(options: {
	readonly section: DependencyDirectionConfig
	readonly root: string
	readonly configPath: string
}): Promise<DirectionOutcome> {
	const { section, root, configPath } = options

	const peer = await probeTypeScript()
	if (!peer.ok) return refuse(TYPESCRIPT_PEER_MISSING, peer.message)

	const { compileGraph, scanSources } = await import(
		'./dependency-direction.ts'
	)

	let files: Map<string, string>
	try {
		files = await discoverSourceFiles(root, section.roots)
	} catch (error) {
		return refuse(
			DIRECTION_SCAN_ERROR,
			`${DEPENDENCY_DIRECTION_GATE}: ${
				error instanceof Error ? error.message : String(error)
			}; ${configPath}'s "${DEPENDENCY_DIRECTION_GATE}" section declares the roots`,
		)
	}

	let graph: DirectionGraph
	try {
		graph = compileGraph(section)
	} catch (error) {
		return refuse(
			DIRECTION_SCAN_ERROR,
			`${configPath}'s "${DEPENDENCY_DIRECTION_GATE}" section could not be compiled into a layer graph: ${
				error instanceof Error ? error.message : String(error)
			}`,
		)
	}

	const violations = orderViolations(scanSources(files, graph))
	const lines = violations.map(
		(violation) =>
			`  ${violation.file}:${violation.line} "${violation.specifier}": ${violation.rule}`,
	)
	const scope = `${violations.length} violation(s) across ${files.size} scanned file(s)`

	if (section.reportOnly) {
		return {
			kind: 'report',
			reportOnly: true,
			failed: false,
			scannedFiles: files.size,
			violations,
			summary: `${DEPENDENCY_DIRECTION_GATE}: report-only, ${scope}; this run did not fail. Set "reportOnly": false in ${configPath} to make it.`,
			lines,
		}
	}

	return {
		kind: 'report',
		reportOnly: false,
		failed: violations.length > 0,
		scannedFiles: files.size,
		violations,
		summary:
			violations.length === 0
				? `${DEPENDENCY_DIRECTION_GATE}: passed, ${files.size} file(s) scanned across ${section.roots.length} root(s), 0 violations.`
				: `${DEPENDENCY_DIRECTION_GATE}: ${scope}:`,
		lines,
	}
}
