// Binds `src/core/failure-codes.ts` to the AD-5 code table it transcribes,
// asserting set and order equality so the two cannot drift silently.
//
// Reading a planning artifact from a script does not violate AD-15: AD-15
// binds the package, whose published `files` are `dist`, `README.md`, and
// `LICENSE`, and `scripts/check-docs.mjs` already reads planning artifacts
// under `npm run validate`.
//
// Usage:
//   node scripts/check-ad5-registry.ts

// Run by `node` directly: Node's type stripping erases types only, so no
// TypeScript enum, namespace, parameter property, or non-type re-export may
// appear in this file or anything it imports, or the script fails at load.
import { readFile } from 'node:fs/promises'
import { FAILURE_CODES } from '../src/core/failure-codes.ts'

const SPINE_WORKSPACE =
	'_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29'
const SPINE_PATH = `${SPINE_WORKSPACE}/ARCHITECTURE-SPINE.md`

// The workspace directory is dated, matching package.json's `lint:spine`. The
// duplication is checked mechanically here so a re-dated workspace fails
// loudly instead of leaving this script silently checking a stale directory.
let manifest: string
try {
	manifest = await readFile(new URL('../package.json', import.meta.url), 'utf8')
} catch (error) {
	console.error(
		`check-ad5-registry: could not read package.json: ${
			error instanceof Error ? error.message : String(error)
		}`,
	)
	process.exit(1)
}
const lintSpine = (JSON.parse(manifest).scripts as Record<string, string>)[
	'lint:spine'
]
if (lintSpine === undefined || !lintSpine.includes(SPINE_WORKSPACE)) {
	console.error(
		`check-ad5-registry: package.json's \`lint:spine\` does not name ${SPINE_WORKSPACE}, so this script and the spine linter disagree about which architecture workspace is current`,
	)
	console.error(`  lint:spine: ${lintSpine ?? '<absent>'}`)
	process.exit(1)
}

let spine: string
try {
	spine = await readFile(new URL(`../${SPINE_PATH}`, import.meta.url), 'utf8')
} catch (error) {
	console.error(
		`check-ad5-registry: could not read ${SPINE_PATH}: ${
			error instanceof Error ? error.message : String(error)
		}`,
	)
	process.exit(1)
}

// Anchored at line starts: a bare substring search would mis-slice on a
// deeper heading such as "#### AD-5 x" or on a prose mention of the marker.
const startMatch = /^### AD-5 /m.exec(spine)
const endMatch = /^### AD-6 /m.exec(spine)
if (
	startMatch === null ||
	endMatch === null ||
	endMatch.index <= startMatch.index
) {
	console.error(
		`check-ad5-registry: could not locate the AD-5 section in ${SPINE_PATH} (looked for a line starting "### AD-5 " before one starting "### AD-6 ")`,
	)
	process.exit(1)
}
const section = spine.slice(startMatch.index, endMatch.index)

// The first column of the code table: | `some-code` | ...
const ROW_PATTERN = /^\s*\|\s*`([a-z0-9-]+)`\s*\|/
const lines = section.split('\n')
const parsed: string[] = []
const unparsedRows: string[] = []
const extraTables: string[] = []
// Rows are matched by position, not by header text, so a cosmetic rename
// can't silently break parsing. Only the first table in the section carries
// codes; a second table's rows are reported as a finding, not merged in.
let fenced = false
let tableIndex = -1
let rowInTable = -1
for (const line of lines) {
	const trimmed = line.trim()
	// A fenced example containing pipes is prose, not a table.
	if (/^(```|~~~)/.test(trimmed)) {
		fenced = !fenced
		continue
	}
	if (fenced) continue
	if (!trimmed.startsWith('|')) {
		// a blank or prose line ends whatever table was open
		if (trimmed === '') rowInTable = -1
		continue
	}
	if (rowInTable === -1) {
		tableIndex++
		rowInTable = 0
	} else rowInTable++
	// row 0 is the header, row 1 the separator, in any table
	if (rowInTable <= 1) continue
	if (tableIndex > 0) {
		extraTables.push(trimmed)
		continue
	}
	const code = ROW_PATTERN.exec(line)?.[1]
	// A row that fails ROW_PATTERN (a bolded cell, a mis-backticked code) is
	// reported rather than skipped: a silently dropped code is the exact
	// drift this script exists to catch.
	if (code === undefined) unparsedRows.push(trimmed)
	else parsed.push(code)
}

if (extraTables.length > 0) {
	console.error(
		`check-ad5-registry: the AD-5 section contains more than one table, so which one carries the codes is ambiguous (${extraTables.length} row(s) outside the first table):`,
	)
	for (const row of extraTables) console.error(`  ${row}`)
	process.exit(1)
}

if (unparsedRows.length > 0) {
	console.error(
		`check-ad5-registry: ${unparsedRows.length} table row(s) in the AD-5 section did not parse as code rows:`,
	)
	for (const row of unparsedRows) console.error(`  ${row}`)
	process.exit(1)
}

if (parsed.length === 0) {
	console.error(
		'check-ad5-registry: the AD-5 section yielded zero code rows; the table shape changed and this parser no longer sees it',
	)
	process.exit(1)
}

const failures: string[] = []
const parsedSet = new Set(parsed)
const moduleSet = new Set<string>(FAILURE_CODES)
for (const code of parsed) {
	if (!moduleSet.has(code))
		failures.push(
			`\`${code}\` is in the AD-5 table but missing from src/core/failure-codes.ts`,
		)
}
for (const code of FAILURE_CODES) {
	if (!parsedSet.has(code))
		failures.push(
			`\`${code}\` is in src/core/failure-codes.ts but absent from the AD-5 table`,
		)
}
// Order equality as well as set equality: the tuple documents itself as "in
// the table's order", and a silent reorder would falsify that claim.
if (failures.length === 0) {
	for (let index = 0; index < parsed.length; index++) {
		if (parsed[index] !== FAILURE_CODES[index])
			failures.push(
				`order mismatch at position ${index}: the table says \`${parsed[index]}\`, the module says \`${FAILURE_CODES[index]}\``,
			)
	}
}

if (failures.length > 0) {
	console.error(
		`check-ad5-registry: FAILURE_CODES has drifted from the AD-5 table (${failures.length} finding(s))`,
	)
	for (const failure of failures) console.error(`  ${failure}`)
	process.exit(1)
}
console.log(
	`check-ad5-registry: ${parsed.length} codes, set- and order-equal between the AD-5 table and src/core/failure-codes.ts`,
)
