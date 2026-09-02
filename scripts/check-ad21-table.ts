// The byte-exact drift check (AD-13) for AD-21's decision table: rebuilds
// through the same pure builder the writer uses and compares against the
// committed `docs/ad21-verdict-decision.generated.md`, so the published
// table cannot claim a rung the ladders no longer produce.
//
// It never rewrites the file, per `check-schemas.ts:8-9`: a check that can
// repair what it checks is not a gate. Regeneration is
// `npm run generate:ad21-table`.
//
// No orphan check: `docs/` holds more than one generated table, and this one
// names the file it owns through the shared target constant, so another file
// appearing there is a documentation decision, outside this check's remit.
//
// Usage:
//   npm run check:ad21-table

// Run by `node` directly: type stripping erases types only, so no TypeScript
// enum, namespace, parameter property, or non-type re-export may appear here
// or in anything it imports. That binds both score modules and the fixture
// module.
import { readFile } from 'node:fs/promises'
import { CONTRACT_LADDER, PRODUCTION_LADDER } from '../src/core/score/ladder.ts'
import { ladderDecisionTable } from '../src/core/score/ladder-table.ts'
import { fixtureCases } from '../tests/score/fixtures/ladder-inputs.ts'
import {
	AD21_TABLE_FRONTMATTER,
	AD21_TABLE_PATH,
	AD21_TABLE_TARGET,
} from './ad21-table-target.ts'

const cases = fixtureCases()

// Guarded: unguarded, the builder's diagnosis surfaces as an unhandled
// rejection and a Node stack.
let rebuilt: Buffer
try {
	rebuilt = Buffer.from(
		`${AD21_TABLE_FRONTMATTER}${ladderDecisionTable(cases)}`,
		'utf8',
	)
} catch (error) {
	console.error(
		`check-ad21-table: the builder failed: ${
			error instanceof Error ? error.message : String(error)
		}`,
	)
	process.exit(1)
}

let committed: Buffer
try {
	committed = await readFile(AD21_TABLE_TARGET)
} catch {
	console.error(
		`${AD21_TABLE_PATH}: missing; run \`npm run generate:ad21-table\``,
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
		`${AD21_TABLE_PATH}: drift at byte offset ${offset} ` +
			`(committed ${committed.length} bytes, rebuilt ${rebuilt.length} bytes)\n` +
			`  committed: ${windowOf(committed)}\n` +
			`  rebuilt:   ${windowOf(rebuilt)}`,
	)
	process.exit(1)
}

const ruleCount = PRODUCTION_LADDER.length + CONTRACT_LADDER.length
console.log(
	`check-ad21-table: the committed AD-21 table matches the builder byte for byte (${ruleCount} condition rows, ${cases.length} cases)`,
)
