// Writes AD-21's decision table to `docs/ad21-verdict-decision.generated.md`.
// A thin I/O wrapper over the pure builder in `core/score/ladder-table.ts`
// (AD-1), which owns the byte rules.
//
// The fixture set is a fixture by AD-30's own naming, so it is imported from
// `tests/` and never ships in `dist`.
//
// Usage:
//   npm run generate:ad21-table

// Run by `node` directly: type stripping erases types only, so no TypeScript
// enum, namespace, parameter property, or non-type re-export may appear here
// or in anything it imports. That binds both score modules and the fixture
// module.
import { mkdir, writeFile } from 'node:fs/promises'
import { ladderDecisionTable } from '../src/core/score/ladder-table.ts'
import { fixtureCases } from '../tests/score/fixtures/ladder-inputs.ts'
import {
	AD21_TABLE_DIRECTORY,
	AD21_TABLE_FRONTMATTER,
	AD21_TABLE_PATH,
	AD21_TABLE_TARGET,
} from './ad21-table-target.ts'

await mkdir(AD21_TABLE_DIRECTORY, { recursive: true })

// Guarded: unguarded, the builder's diagnosis prints as a Node stack.
let document: string
try {
	document = `${AD21_TABLE_FRONTMATTER}${ladderDecisionTable(fixtureCases())}`
} catch (error) {
	console.error(
		`generate-ad21-table: the builder failed: ${
			error instanceof Error ? error.message : String(error)
		}`,
	)
	process.exit(1)
}

await writeFile(AD21_TABLE_TARGET, document)
// The path comes from the same constant `writeFile` used, so the line cannot
// name a file this run did not write.
console.log(
	`generate-ad21-table: wrote ${AD21_TABLE_PATH} (${Buffer.byteLength(document)} bytes)`,
)
