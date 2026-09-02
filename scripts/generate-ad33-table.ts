// Writes AD-33's decision table to `docs/ad33-outcome-decision.generated.md`.
// A thin I/O wrapper over the pure builder in `core/score/outcome-table.ts`
// (AD-1), which owns the byte rules.
//
// The fixture set is a fixture by AD-30's own naming, so it is imported from
// `tests/` and never ships in `dist`.
//
// Usage:
//   npm run generate:ad33-table

// Run by `node` directly: type stripping erases types only, so no TypeScript
// enum, namespace, parameter property, or non-type re-export may appear here
// or in anything it imports. That binds both score modules and the fixture
// module.
import { mkdir, writeFile } from 'node:fs/promises'
import { resolveOutcome } from '../src/core/score/outcome.ts'
import { outcomeDecisionTable } from '../src/core/score/outcome-table.ts'
import {
	fixtureCases,
	infeasiblePairs,
	STRUCTURAL_CONSTRAINTS,
} from '../tests/score/fixtures/outcome-inputs.ts'
import {
	AD33_TABLE_DIRECTORY,
	AD33_TABLE_FRONTMATTER,
	AD33_TABLE_PATH,
	AD33_TABLE_TARGET,
} from './ad33-table-target.ts'

await mkdir(AD33_TABLE_DIRECTORY, { recursive: true })

// Guarded: unguarded, the builder's diagnosis prints as a Node stack.
let document: string
try {
	document = `${AD33_TABLE_FRONTMATTER}${outcomeDecisionTable(
		fixtureCases().map(resolveOutcome),
		{
			constraints: STRUCTURAL_CONSTRAINTS,
			infeasiblePairs: infeasiblePairs(),
		},
	)}`
} catch (error) {
	console.error(
		`generate-ad33-table: the builder failed: ${
			error instanceof Error ? error.message : String(error)
		}`,
	)
	process.exit(1)
}

await writeFile(AD33_TABLE_TARGET, document)
// The path comes from the same constant `writeFile` used, so the line cannot
// name a file this run did not write.
console.log(
	`generate-ad33-table: wrote ${AD33_TABLE_PATH} (${Buffer.byteLength(document)} bytes)`,
)
