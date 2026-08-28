// The byte-exact drift check over `corpus/`: rebuilds the corpus in memory
// through the same pure builder the generator uses and compares it against the
// committed bytes, so a published example never drifts from the code that
// emitted it.
//
// It walks all of `corpus/` rather than `corpus/dev/`, because `files` in
// `package.json` ships all of `corpus/`. Anything under it the builder did not
// produce is an orphan, so a file dropped beside the generated tree is
// reported here before it rides into the tarball.
//
// Reports a stale file and an orphan file separately: "the bytes moved" and
// "a file nothing names is on disk" are different repairs. It never rewrites
// what it checks; regeneration is `npm run generate:dev-corpus`.
//
// Usage:
//   npm run check:corpus

// Run by `node` directly: type stripping erases types only, so no TypeScript
// enum, namespace, parameter property, or non-type re-export may appear here
// or in anything it imports.
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CORPUS_CONTRACTS } from '../tests/coverage/fixtures/corpus.ts'
import {
	buildDevCorpus,
	CORPUS_LABEL,
	CORPUS_PACKAGE_LABEL,
	CORPUS_PACKAGE_ROOT,
} from './dev-corpus-target.ts'

let expected: Map<string, string>
try {
	expected = buildDevCorpus(CORPUS_CONTRACTS)
} catch (error) {
	console.error(
		`check-dev-corpus: the builder failed: ${
			error instanceof Error ? error.message : String(error)
		}`,
	)
	process.exit(1)
}

const repoRoot = new URL('../', import.meta.url)
// Repo-relative from the repository root by `relative`, the same derivation
// `dev-corpus.test.ts` uses, so the two agree on a key by construction. Both
// once split on the literal `corpus/dev`, which breaks when the repository is
// itself checked out under a path containing that string.
const repoRootPath = fileURLToPath(repoRoot)
const keyOf = (absolute: string): string => relative(repoRootPath, absolute)

let onDisk: string[]
try {
	onDisk = (
		await readdir(CORPUS_PACKAGE_ROOT, { recursive: true, withFileTypes: true })
	)
		.filter((entry) => entry.isFile())
		.map((entry) => keyOf(join(entry.parentPath, entry.name)))
} catch (error) {
	if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
		console.error(
			`check-dev-corpus: ${CORPUS_PACKAGE_LABEL} does not exist; run \`npm run generate:dev-corpus\``,
		)
	} else {
		console.error(
			`check-dev-corpus: could not read ${CORPUS_PACKAGE_LABEL}: ${
				error instanceof Error ? error.message : String(error)
			}`,
		)
	}
	process.exit(1)
}

// Two comparisons, in two directions. An orphan is a file under `corpus/` the
// builder did not emit, `index.json` included, since the builder emits that
// too. Drift is a file the builder emits whose committed bytes differ, or
// which is not on disk at all. Neither is checked against `index.json`'s own
// entry list: the manifest is one of the builder's outputs, so reading it back
// would let a wrong manifest agree with itself.
const orphans = onDisk.filter((path) => !expected.has(path)).sort()
const drifted: string[] = []

for (const [path, text] of [...expected].sort()) {
	const rebuilt = Buffer.from(text, 'utf8')
	let committed: Buffer
	try {
		committed = await readFile(new URL(path, repoRoot))
	} catch {
		drifted.push(`${path}: missing; run \`npm run generate:dev-corpus\``)
		continue
	}
	if (committed.equals(rebuilt)) continue
	const bound = Math.min(committed.length, rebuilt.length)
	let offset = 0
	while (offset < bound && committed[offset] === rebuilt[offset]) offset++
	const windowOf = (buffer: Buffer): string =>
		JSON.stringify(
			buffer.subarray(Math.max(0, offset - 20), offset + 20).toString('utf8'),
		)
	drifted.push(
		`${path}: drift at byte offset ${offset} ` +
			`(committed ${committed.length} bytes, rebuilt ${rebuilt.length} bytes)\n` +
			`  committed: ${windowOf(committed)}\n` +
			`  rebuilt:   ${windowOf(rebuilt)}`,
	)
}

if (orphans.length > 0 || drifted.length > 0) {
	if (orphans.length > 0) {
		console.error(
			`check-dev-corpus: ${CORPUS_PACKAGE_LABEL}, which the tarball ships whole, holds ${orphans.length} file(s) the ${CORPUS_LABEL} builder does not produce`,
		)
		for (const orphan of orphans) console.error(`  ${orphan}`)
	}
	if (drifted.length > 0) {
		console.error(
			`check-dev-corpus: ${drifted.length} file(s) drifted or missing`,
		)
		for (const failure of drifted) console.error(failure)
	}
	process.exit(1)
}

console.log(
	`check-dev-corpus: ${expected.size} committed corpus files match the builder byte for byte, and ${CORPUS_PACKAGE_LABEL}/ holds ${onDisk.length} file(s) and nothing else`,
)
