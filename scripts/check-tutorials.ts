// The byte-exact drift check over every committed tutorial chain: rebuilds each
// file in memory through the same pure builders the generator uses and compares
// it against the committed bytes.
//
// This is what makes a documentation page's claim checkable. The page names
// these files and the gate that executes the page runs the commands over them,
// so a chain that drifted from its builder would let a page document a run
// nobody can reproduce.
//
// It also sweeps for orphans, unlike `check-worked-example.ts`. Nothing under
// `examples/tutorials/` is hand-authored, so a file the builders do not emit is
// a leftover from an earlier shape of a chain, and a reader who opens one is
// reading bytes no check holds.
//
// It never rewrites what it checks; regeneration is
// `npm run generate:tutorials`.
//
// Usage:
//   npm run check:tutorials

// Run by `node` directly: type stripping erases types only, so no TypeScript
// enum, namespace, parameter property, or non-type re-export may appear here
// or in anything it imports.
import type { Dirent } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { buildTutorials, TUTORIAL_SOURCES } from './tutorial-target.ts'

const TUTORIAL_ROOT = 'examples/tutorials'

let expected: Map<string, string>
try {
	expected = buildTutorials()
} catch (error) {
	console.error(
		`check-tutorials: the builder failed: ${
			error instanceof Error ? error.message : String(error)
		}`,
	)
	process.exit(1)
}

const repoRoot = new URL('../', import.meta.url)
const failures: string[] = []
const labels = new Set<string>()

for (const [path, text] of [...expected].sort()) {
	labels.add(dirname(path))
	const rebuilt = Buffer.from(text, 'utf8')
	let committed: Buffer
	try {
		committed = await readFile(new URL(path, repoRoot))
	} catch {
		failures.push(`${path}: missing; run \`npm run generate:tutorials\``)
		continue
	}
	if (committed.equals(rebuilt)) continue
	// First differing byte offset with a window either side, so the drift is
	// locatable without a manual diff.
	const bound = Math.min(committed.length, rebuilt.length)
	let offset = 0
	while (offset < bound && committed[offset] === rebuilt[offset]) offset++
	const windowOf = (buffer: Buffer): string =>
		JSON.stringify(
			buffer.subarray(Math.max(0, offset - 20), offset + 20).toString('utf8'),
		)
	failures.push(
		`${path}: drift at byte offset ${offset} ` +
			`(committed ${committed.length} bytes, rebuilt ${rebuilt.length} bytes)\n` +
			`  committed: ${windowOf(committed)}\n` +
			`  rebuilt:   ${windowOf(rebuilt)}`,
	)
}

const walk = async (relative: string): Promise<string[]> => {
	let entries: Dirent[]
	try {
		entries = await readdir(new URL(relative, repoRoot), {
			withFileTypes: true,
		})
	} catch {
		return []
	}
	const found: string[] = []
	for (const entry of entries) {
		const child = join(relative, entry.name)
		if (entry.isDirectory()) found.push(...(await walk(`${child}/`)))
		else found.push(child)
	}
	return found
}

const sources = new Set(TUTORIAL_SOURCES)
const found = new Set(await walk(`${TUTORIAL_ROOT}/`))

for (const path of found) {
	if (expected.has(path) || sources.has(path)) continue
	failures.push(
		`${path}: no builder emits this file; delete it, add it to a chain, or declare it in TUTORIAL_SOURCES`,
	)
}

// A declared source that left the tree is a chain whose fixture a reader cannot
// run, and the builder that imports it would fail before this check ran, so this
// reports the one case where it can still be missing: a file listed and never
// written.
for (const path of sources) {
	if (found.has(path)) continue
	failures.push(`${path}: TUTORIAL_SOURCES names this file and it is absent`)
}

if (failures.length > 0) {
	console.error(`check-tutorials: ${failures.length} problem(s)`)
	for (const failure of failures) console.error(failure)
	process.exit(1)
}

console.log(
	`check-tutorials: ${expected.size} committed files under ${[...labels].sort().join(', ')} match the builders byte for byte`,
)
