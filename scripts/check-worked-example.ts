// The byte-exact drift check over the spike worked example: rebuilds the five
// generated files in memory through the same pure builder the generator uses
// and compares them against the committed bytes, so a published chain never
// drifts from the reference functions that emitted it.
//
// It never rewrites what it checks; regeneration is
// `npm run generate:worked-example`.
//
// No orphan sweep, unlike `check-dev-corpus.ts`. That check walks all of
// `corpus/` because the tarball ships the directory whole, and reports every
// unbuilt file as an orphan. `spike-worked-example/` is a mixed directory: it
// also holds `FINDINGS.md`, `README.md`, and `system-under-test.md`, which are
// hand-authored evidence no builder emits, so an orphan sweep would flag those
// three on every run. This check owns the five files it names through the
// shared target constant and says nothing about the rest, the same posture
// `check-ad21-table.ts` takes over the several generated documents in `docs/`.
//
// Usage:
//   npm run check:worked-example

// Run by `node` directly: type stripping erases types only, so no TypeScript
// enum, namespace, parameter property, or non-type re-export may appear here
// or in anything it imports.
import { readFile } from 'node:fs/promises'
import {
	buildWorkedExample,
	WORKED_EXAMPLE_LABEL,
} from './worked-example-target.ts'

let expected: Map<string, string>
try {
	expected = buildWorkedExample()
} catch (error) {
	console.error(
		`check-worked-example: the builder failed: ${
			error instanceof Error ? error.message : String(error)
		}`,
	)
	process.exit(1)
}

const repoRoot = new URL('../', import.meta.url)
const drifted: string[] = []

for (const [path, text] of [...expected].sort()) {
	const rebuilt = Buffer.from(text, 'utf8')
	let committed: Buffer
	try {
		committed = await readFile(new URL(path, repoRoot))
	} catch {
		drifted.push(`${path}: missing; run \`npm run generate:worked-example\``)
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
	drifted.push(
		`${path}: drift at byte offset ${offset} ` +
			`(committed ${committed.length} bytes, rebuilt ${rebuilt.length} bytes)\n` +
			`  committed: ${windowOf(committed)}\n` +
			`  rebuilt:   ${windowOf(rebuilt)}`,
	)
}

if (drifted.length > 0) {
	console.error(
		`check-worked-example: ${drifted.length} file(s) drifted or missing`,
	)
	for (const failure of drifted) console.error(failure)
	process.exit(1)
}

console.log(
	`check-worked-example: ${expected.size} committed files under ${WORKED_EXAMPLE_LABEL} match the builder byte for byte`,
)
