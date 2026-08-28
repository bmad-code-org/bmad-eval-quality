// Command entry point for AD-15's one-way dependency: scans everything the
// published tarball carries out of this repository and exits nonzero on any
// reference across the boundary.
//
// `files` is `dist`, `schemas`, `corpus`, `README.md`, and `LICENSE`, so the
// scanned set is `src/` (which `dist` is emitted from), `corpus/`, and the
// three `package.json` fields npm publishes verbatim. `scripts/`, `tests/`,
// `.github/`, and `docs/` never enter the tarball.
//
// Two exemptions. `README.md` ships, and its one-way-dependency section names
// both forbidden words; scanning it would delete the plainest statement of the
// rule from the only document an adopter reads. And `homepage`,
// `repository.url`, and `bugs.url` are the package's identity, changeable only
// as a repository migration, with `check-shareable.mjs` pinning
// `repository.url` mechanically.
//
// Run by `node` directly, so nothing it imports transitively may carry a
// TypeScript enum, namespace, parameter property, or `export type` re-export.
//
// Usage:
//   npm run check:boundary
import type { Dirent } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { discoverSourceFiles } from './discover-source-files.ts'
import { scanPackageBoundary } from './package-boundary.ts'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

/**
 * Every file under `corpus/`, extension-unfiltered, because
 * `discoverSourceFiles` reaches neither `corpus/dev/*.json` nor
 * `corpus/dev/README.md`.
 *
 * Silent on exactly one failure: `ENOENT` on `corpus/` itself, because the
 * corpus is generated and a missing one is a build order rather than a
 * violation. Every other failure at the root, and every failure at any depth
 * below it, propagates. A directory this walk could not read has not been
 * scanned, and an `EACCES` or an `EIO` reported as a clean scan is a gate that
 * passes for the wrong reason.
 */
async function discoverCorpusFiles(root: string): Promise<Map<string, string>> {
	const files = new Map<string, string>()
	const corpusRoot = `${root}corpus`

	async function visit(entries: Dirent[], prefix: string): Promise<void> {
		for (const entry of entries) {
			const child = `${prefix}/${entry.name}`
			if (entry.isSymbolicLink()) {
				throw new Error(
					`${child} is a symbolic link; the boundary scan does not follow links`,
				)
			}
			if (entry.isDirectory()) {
				await visit(
					await readdir(`${root}${child}`, { withFileTypes: true }),
					child,
				)
			} else if (entry.isFile()) {
				files.set(child, await readFile(`${root}${child}`, 'utf8'))
			}
		}
	}

	let rootEntries: Dirent[]
	try {
		rootEntries = await readdir(corpusRoot, { withFileTypes: true })
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return files
		throw error
	}
	await visit(rootEntries, 'corpus')
	return files
}

async function discoverSchemaFiles(root: string): Promise<Map<string, string>> {
	const files = new Map<string, string>()
	const schemaRoot = `${root}schemas`
	let entries: Dirent[]
	try {
		entries = await readdir(schemaRoot, { withFileTypes: true })
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return files
		throw error
	}
	for (const entry of entries) {
		if (entry.isFile() && entry.name.endsWith('.json')) {
			const child = `schemas/${entry.name}`
			files.set(child, await readFile(`${root}${child}`, 'utf8'))
		}
	}
	return files
}

/**
 * The published `package.json` fields, as synthetic entries. A JSON value has
 * no line of its own, so every one is line 1; the synthetic key is what lets
 * the pure scanner read a field subset without learning about JSON.
 */
async function manifestEntries(root: string): Promise<Map<string, string>> {
	const manifest = JSON.parse(
		await readFile(`${root}package.json`, 'utf8'),
	) as {
		scripts?: Record<string, string>
		description?: string
		keywords?: string[]
	}
	const entries = new Map<string, string>()
	for (const [name, value] of Object.entries(manifest.scripts ?? {})) {
		entries.set(`package.json#scripts.${name}`, value)
	}
	if (manifest.description !== undefined) {
		entries.set('package.json#description', manifest.description)
	}
	if (manifest.keywords !== undefined) {
		entries.set('package.json#keywords', manifest.keywords.join(' '))
	}
	return entries
}

let files: Map<string, string>
// Per source, so an empty one is visible in the output. A single total reads
// the same whether `corpus/` held twenty-three files or none, and "scanned
// under src/, schemas/, corpus/, and package.json" is a claim the reader cannot check
// against one number.
let counts: {
	source: number
	schemas: number
	corpus: number
	manifest: number
}
try {
	const source = await discoverSourceFiles(repoRoot)
	const schemas = await discoverSchemaFiles(repoRoot)
	const corpus = await discoverCorpusFiles(repoRoot)
	const manifest = await manifestEntries(repoRoot)
	counts = {
		source: source.size,
		schemas: schemas.size,
		corpus: corpus.size,
		manifest: manifest.size,
	}
	files = new Map([...source, ...schemas, ...corpus, ...manifest])
} catch (error) {
	console.error(
		`check:boundary: could not discover scannable files: ${
			error instanceof Error ? error.message : String(error)
		}`,
	)
	process.exit(1)
}

const violations = scanPackageBoundary(files)

if (violations.length > 0) {
	console.error(
		`check:boundary: ${violations.length} package-boundary violation(s) across ${files.size} scanned file(s):`,
	)
	for (const violation of [...violations].sort((a, b) =>
		a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1,
	)) {
		console.error(
			`  ${violation.file}:${violation.line} [${violation.pattern}] ${violation.text}`,
		)
	}
	process.exit(1)
}

console.log(
	`check:boundary: ${files.size} entr(ies) scanned under src/, schemas/, corpus/, and package.json, 0 violations ` +
		`(${counts.source} from src/, ${counts.schemas} from schemas/, ${counts.corpus} from corpus/, ` +
		`${counts.manifest} synthetic package.json entr(ies))`,
)
