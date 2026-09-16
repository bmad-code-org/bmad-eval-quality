// Writes the files of every committed tutorial chain. A thin I/O wrapper over
// the pure builders `tutorial-target.ts` collects, so this file and
// `check-tutorials.ts` cannot disagree about what a chain is.
//
// It knows no chain by name. `buildTutorials` returns one map keyed by
// repository-relative path, and each key's own parent directory is created, so
// a chain added to the registry needs no edit here.
//
// Usage:
//   npm run generate:tutorials

// Run by `node` directly: type stripping erases types only, so no TypeScript
// enum, namespace, parameter property, or non-type re-export may appear here
// or in anything it imports.
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { buildTutorials } from './tutorial-target.ts'

let files: Map<string, string>
try {
	files = buildTutorials()
} catch (error) {
	console.error(
		`generate-tutorials: the builder failed: ${
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
	`generate-tutorials: wrote ${files.size} file(s) under ${[...labels].sort().join(', ')}`,
)
