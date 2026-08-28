// Writes `corpus/dev/`. A thin I/O wrapper over the pure builder in
// `dev-corpus-target.ts`, which owns the byte rules, so this file and
// `check-dev-corpus.ts` cannot disagree about what the corpus is.
//
// The contracts are a fixture by AD-30's own naming
// (ARCHITECTURE-SPINE.md:443), so their data is imported from `tests/` and no
// authoring code enters `dist`. The compile and seal stages come from `src/`,
// which is what makes the emitted corpus prove the shipped code.
//
// Usage:
//   npm run generate:dev-corpus

// Run by `node` directly: type stripping erases types only, so no TypeScript
// enum, namespace, parameter property, or non-type re-export may appear here
// or in anything it imports.
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { CORPUS_CONTRACTS } from '../tests/coverage/fixtures/corpus.ts'
import {
	buildDevCorpus,
	CORPUS_CONTRACTS_DIR,
	CORPUS_EXAMPLE_DIR,
	CORPUS_LABEL,
	CORPUS_ROOT,
} from './dev-corpus-target.ts'

let files: Map<string, string>
try {
	files = buildDevCorpus(CORPUS_CONTRACTS)
} catch (error) {
	console.error(
		`generate-dev-corpus: the builder failed: ${
			error instanceof Error ? error.message : String(error)
		}`,
	)
	process.exit(1)
}

// Cleared first: a contract that leaves the fixture list would otherwise stay
// on disk as a file the manifest does not name.
await rm(CORPUS_ROOT, { recursive: true, force: true })
await mkdir(CORPUS_CONTRACTS_DIR, { recursive: true })
await mkdir(CORPUS_EXAMPLE_DIR, { recursive: true })

const repoRoot = new URL('../', import.meta.url)
for (const [path, text] of [...files].sort()) {
	await writeFile(new URL(path, repoRoot), text)
}

const written = await readdir(CORPUS_ROOT, { recursive: true })
console.log(
	`generate-dev-corpus: wrote ${files.size} file(s) under ${CORPUS_LABEL} (${written.length} entries on disk)`,
)
