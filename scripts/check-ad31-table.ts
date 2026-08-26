// The byte-exact drift check (AD-13) for AD-31's predicate table: rebuilds
// through the same pure builder the writer uses and compares against the
// committed `docs/ad31-coverage-predicates.generated.md`, so the published
// table cannot claim coverage the predicates no longer produce.
//
// It never rewrites the file, per `check-schemas.ts:8-9`: a check that can
// repair what it checks is not a gate. Regeneration is
// `npm run generate:ad31-table`.
//
// No orphan check: `docs/` holds the one file this names, and a second file
// there is a documentation decision.
//
// Usage:
//   npm run check:ad31-table

// Run by `node` directly: type stripping erases types only, so no TypeScript
// enum, namespace, parameter property, or non-type re-export may appear here
// or in anything it imports. That binds `table.ts` and both fixture modules.
import { readFile } from 'node:fs/promises'
import { coveragePredicateTable } from '../src/core/coverage/table.ts'
import {
	CORPUS_CELLS,
	CORPUS_CONTRACTS,
} from '../tests/coverage/fixtures/corpus.ts'
import { AD31_TABLE_PATH, AD31_TABLE_TARGET } from './ad31-table-target.ts'

// Guarded: unguarded, the builder's diagnosis surfaces as an unhandled
// rejection and a Node stack.
let rebuilt: Buffer
try {
	rebuilt = Buffer.from(
		coveragePredicateTable(CORPUS_CONTRACTS, CORPUS_CELLS),
		'utf8',
	)
} catch (error) {
	console.error(
		`check-ad31-table: the builder failed: ${
			error instanceof Error ? error.message : String(error)
		}`,
	)
	process.exit(1)
}

let committed: Buffer
try {
	committed = await readFile(AD31_TABLE_TARGET)
} catch {
	console.error(
		`${AD31_TABLE_PATH}: missing; run \`npm run generate:ad31-table\``,
	)
	process.exit(1)
}

if (!committed.equals(rebuilt)) {
	// First differing byte offset with a window either side, so the drift is
	// locatable without a manual diff.
	const bound = Math.min(committed.length, rebuilt.length)
	let offset = 0
	while (offset < bound && committed[offset] === rebuilt[offset]) offset++
	const windowOf = (buffer: Buffer): string =>
		JSON.stringify(
			buffer.subarray(Math.max(0, offset - 20), offset + 20).toString('utf8'),
		)
	console.error(
		`${AD31_TABLE_PATH}: drift at byte offset ${offset} ` +
			`(committed ${committed.length} bytes, rebuilt ${rebuilt.length} bytes)\n` +
			`  committed: ${windowOf(committed)}\n` +
			`  rebuilt:   ${windowOf(rebuilt)}`,
	)
	process.exit(1)
}

console.log(
	`check-ad31-table: the committed AD-31 table matches the builder byte for byte (${CORPUS_CONTRACTS.length} corpus contracts, ${CORPUS_CELLS.length} cells)`,
)
