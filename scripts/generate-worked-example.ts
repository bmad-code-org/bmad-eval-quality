// Writes the generated files of every committed chain. A thin I/O wrapper over
// the pure builders `worked-example-target.ts` collects, which own the bytes,
// so this file and `check-worked-example.ts` cannot disagree about what the
// chains are.
//
// It knows no chain by name. `buildWorkedExample` returns one map keyed by
// repository-relative path, and each key's own parent directory is created,
// so a chain added to that union needs no edit here.
//
// Unlike `generate-dev-corpus.ts`, this generator does NOT clear a directory
// before writing. `spike-worked-example/` is a mixed directory: `FINDINGS.md`,
// `README.md`, and `system-under-test.md` are hand-authored evidence that no
// builder emits, and an `rm -rf` over the root would delete exactly the record
// that chain exists to preserve. It writes its own keys and nothing else.
//
// Usage:
//   npm run generate:worked-example

// Run by `node` directly: type stripping erases types only, so no TypeScript
// enum, namespace, parameter property, or non-type re-export may appear here
// or in anything it imports.
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { buildWorkedExample } from './worked-example-target.ts'

let files: Map<string, string>
try {
	files = buildWorkedExample()
} catch (error) {
	console.error(
		`generate-worked-example: the builder failed: ${
			error instanceof Error ? error.message : String(error)
		}`,
	)
	process.exit(1)
}

const repoRoot = new URL('../', import.meta.url)
const labels = new Set<string>()
for (const [path, text] of [...files].sort()) {
	const parent = dirname(path)
	labels.add(parent)
	await mkdir(new URL(`${parent}/`, repoRoot), { recursive: true })
	await writeFile(new URL(path, repoRoot), text)
}

console.log(
	`generate-worked-example: wrote ${files.size} file(s) under ${[...labels].sort().join(', ')}`,
)
