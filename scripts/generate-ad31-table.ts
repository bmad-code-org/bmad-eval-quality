// Writes AD-31's predicate table to
// `docs/ad31-coverage-predicates.generated.md`. A thin I/O wrapper over the
// pure builder in `core/coverage/table.ts` (AD-1), which owns the byte rules.
//
// The corpus is a fixture by AD-30's own naming (ARCHITECTURE-SPINE.md:443),
// so it is imported from `tests/` and never ships in `dist`.
//
// Usage:
//   npm run generate:ad31-table

// Run by `node` directly: type stripping erases types only, so no TypeScript
// enum, namespace, parameter property, or non-type re-export may appear here
// or in anything it imports. That binds `table.ts` and both fixture modules.
import { mkdir, writeFile } from 'node:fs/promises'
import { coveragePredicateTable } from '../src/core/coverage/table.ts'
import {
	CORPUS_CELLS,
	CORPUS_CONTRACTS,
} from '../tests/coverage/fixtures/corpus.ts'
import {
	AD31_TABLE_DIRECTORY,
	AD31_TABLE_PATH,
	AD31_TABLE_TARGET,
} from './ad31-table-target.ts'

await mkdir(AD31_TABLE_DIRECTORY, { recursive: true })

// Guarded: unguarded, the builder's diagnosis prints as a Node stack.
let document: string
try {
	document = coveragePredicateTable(CORPUS_CONTRACTS, CORPUS_CELLS)
} catch (error) {
	console.error(
		`generate-ad31-table: the builder failed: ${
			error instanceof Error ? error.message : String(error)
		}`,
	)
	process.exit(1)
}

await writeFile(AD31_TABLE_TARGET, document)
// The path comes from the same constant `writeFile` used, so the line cannot
// name a file this run did not write.
console.log(
	`generate-ad31-table: wrote ${AD31_TABLE_PATH} (${Buffer.byteLength(document)} bytes)`,
)
