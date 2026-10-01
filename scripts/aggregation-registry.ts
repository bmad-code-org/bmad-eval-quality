// Pure half of the aggregation-refusal registry drift gate: extracts the code
// table AD-21 carries under its "Aggregation refusals" paragraph and compares
// it against `AGGREGATION_REFUSAL_CODES`. `check-aggregation-registry.ts`
// turns this into exit codes; `aggregation-registry.test.ts` drives it with
// mutated spine text. AD-5 and AD-28 keep their own registries; this is a
// third, disjoint from both.
//
// Run by `node` directly: type stripping erases types only, so no TypeScript
// enum, namespace, parameter property, or non-type re-export may appear here.

export type TableExtraction =
	| { readonly ok: true; readonly codes: string[] }
	| {
			readonly ok: false
			readonly reason: string
			readonly details: readonly string[]
	  }

const ROW_PATTERN = /^\s*\|\s*`([a-z0-9-]+)`\s*\|/
const MARKER = '**Aggregation refusals.**'

/**
 * Extracts the first table after the marker paragraph inside AD-21's section.
 * Bounds are anchored at line starts, tables are read by position, and a
 * second table or a row that does not parse is reported and never skipped,
 * the way `check-ad28-registry.ts` treats AD-28.
 */
export function extractAggregationCodeTable(spine: string): TableExtraction {
	const startMatch = /^### AD-21 /m.exec(spine)
	const endMatch = /^### AD-22 /m.exec(spine)
	if (
		startMatch === null ||
		endMatch === null ||
		endMatch.index <= startMatch.index
	) {
		return {
			ok: false,
			reason:
				'could not locate the AD-21 section (looked for a line starting "### AD-21 " before one starting "### AD-22 ")',
			details: [],
		}
	}
	const section = spine.slice(startMatch.index, endMatch.index)
	const markerAt = section.indexOf(MARKER)
	if (markerAt === -1) {
		return {
			ok: false,
			reason: `the AD-21 section has no paragraph opening with ${MARKER}`,
			details: [],
		}
	}
	const codes: string[] = []
	const unparsedRows: string[] = []
	const extraTables: string[] = []
	let fenced = false
	let tableIndex = -1
	let rowInTable = -1
	for (const line of section.slice(markerAt).split('\n')) {
		const trimmed = line.trim()
		if (/^(```|~~~)/.test(trimmed)) {
			fenced = !fenced
			continue
		}
		if (fenced) continue
		if (!trimmed.startsWith('|')) {
			if (trimmed === '') rowInTable = -1
			continue
		}
		if (rowInTable === -1) {
			tableIndex++
			rowInTable = 0
		} else rowInTable++
		if (rowInTable <= 1) continue
		if (tableIndex > 0) {
			extraTables.push(trimmed)
			continue
		}
		const code = ROW_PATTERN.exec(line)?.[1]
		if (code === undefined) unparsedRows.push(trimmed)
		else codes.push(code)
	}
	if (extraTables.length > 0) {
		return {
			ok: false,
			reason: `the aggregation refusals paragraph is followed by more than one table, so which one carries the codes is ambiguous (${extraTables.length} row(s) outside the first table)`,
			details: extraTables,
		}
	}
	if (unparsedRows.length > 0) {
		return {
			ok: false,
			reason: `${unparsedRows.length} table row(s) under the aggregation refusals paragraph did not parse as code rows`,
			details: unparsedRows,
		}
	}
	if (codes.length === 0) {
		return {
			ok: false,
			reason:
				'the aggregation refusals paragraph yielded zero code rows; the table shape changed and this parser no longer sees it',
			details: [],
		}
	}
	return { ok: true, codes }
}

/**
 * Set and order equality between the table and the module tuple. Order is
 * compared only after membership matches, so a dropped code reports as one
 * missing member and not a cascade of mismatches.
 */
export function compareAggregationRegistry(
	tableCodes: readonly string[],
	moduleCodes: readonly string[],
): string[] {
	const failures: string[] = []
	const tableSet = new Set(tableCodes)
	const moduleSet = new Set(moduleCodes)
	for (const code of tableCodes) {
		if (!moduleSet.has(code)) {
			failures.push(
				`\`${code}\` is in the AD-21 aggregation refusals table but missing from src/core/failure-codes.ts`,
			)
		}
	}
	for (const code of moduleCodes) {
		if (!tableSet.has(code)) {
			failures.push(
				`\`${code}\` is in src/core/failure-codes.ts but absent from the AD-21 aggregation refusals table`,
			)
		}
	}
	if (failures.length > 0) return failures
	for (let index = 0; index < tableCodes.length; index++) {
		if (tableCodes[index] !== moduleCodes[index]) {
			failures.push(
				`order mismatch at position ${index}: the table says \`${tableCodes[index]}\`, the module says \`${moduleCodes[index]}\``,
			)
		}
	}
	return failures
}
