// Writes the five generated files of the spike worked example. A thin I/O
// wrapper over the pure builder in `worked-example-target.ts`, which owns the
// bytes, so this file and `check-worked-example.ts` cannot disagree about what
// the chain is.
//
// Unlike `generate-dev-corpus.ts`, this generator does NOT clear its directory
// first. `spike-worked-example/` is a mixed directory: `FINDINGS.md`,
// `README.md`, and `system-under-test.md` are hand-authored evidence that no
// builder emits, and an `rm -rf` over the root would delete exactly the record
// this chain exists to preserve. It writes its own keys and nothing else.
//
// Usage:
//   npm run generate:worked-example

// Run by `node` directly: type stripping erases types only, so no TypeScript
// enum, namespace, parameter property, or non-type re-export may appear here
// or in anything it imports.
import { mkdir, writeFile } from 'node:fs/promises'
import {
	buildWorkedExample,
	WORKED_EXAMPLE_LABEL,
	WORKED_EXAMPLE_ROOT,
} from './worked-example-target.ts'

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

await mkdir(WORKED_EXAMPLE_ROOT, { recursive: true })

const repoRoot = new URL('../', import.meta.url)
for (const [path, text] of [...files].sort()) {
	await writeFile(new URL(path, repoRoot), text)
}

console.log(
	`generate-worked-example: wrote ${files.size} file(s) under ${WORKED_EXAMPLE_LABEL}`,
)
