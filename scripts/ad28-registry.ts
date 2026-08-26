// Pure half of the AD-28 registry drift gate: extracts AD-28's code table
// from the spine and compares it against `RUNTIME_FAULT_CODES`.
// `check-ad28-registry.ts` turns this into exit codes; `ad28-registry.test.ts`
// drives it with mutated spine text.

export type TableExtraction =
	| { readonly ok: true; readonly codes: string[] }
	| {
			readonly ok: false
			readonly reason: string
			readonly details: readonly string[]
	  }

// The first column of the code table: | `some-code` | ...
const ROW_PATTERN = /^\s*\|\s*`([a-z0-9-]+)`\s*\|/

/**
 * Extracts AD-28's first code table from the spine. Section bounds are
 * anchored at line starts to avoid mis-slicing on a deeper heading or a
 * prose mention of the marker. Tables are read by position, not column name,
 * and only the first table counts; ambiguous rows are reported rather than
 * absorbed or skipped, mirroring `check-ad5-registry.ts`.
 */
export function extractAd28CodeTable(spine: string): TableExtraction {
	const startMatch = /^### AD-28 /m.exec(spine)
	const endMatch = /^### AD-29 /m.exec(spine)
	if (
		startMatch === null ||
		endMatch === null ||
		endMatch.index <= startMatch.index
	) {
		return {
			ok: false,
			reason:
				'could not locate the AD-28 section (looked for a line starting "### AD-28 " before one starting "### AD-29 ")',
			details: [],
		}
	}
	const section = spine.slice(startMatch.index, endMatch.index)

	const codes: string[] = []
	const unparsedRows: string[] = []
	const extraTables: string[] = []
	let fenced = false
	let tableIndex = -1
	let rowInTable = -1
	for (const line of section.split('\n')) {
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
		// row 0 is the header, row 1 the separator, in any table
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
			reason: `the AD-28 section contains more than one table, so which one carries the codes is ambiguous (${extraTables.length} row(s) outside the first table)`,
			details: extraTables,
		}
	}
	if (unparsedRows.length > 0) {
		return {
			ok: false,
			reason: `${unparsedRows.length} table row(s) in the AD-28 section did not parse as code rows`,
			details: unparsedRows,
		}
	}
	if (codes.length === 0) {
		return {
			ok: false,
			reason:
				'the AD-28 section yielded zero code rows; the table shape changed and this parser no longer sees it',
			details: [],
		}
	}
	return { ok: true, codes }
}

/**
 * Set and order equality between the table and the module tuple. Order is
 * checked because `RUNTIME_FAULT_CODES` documents itself as being in the
 * spine's exact order; it's compared only after membership matches, so a
 * dropped code reports as one missing member, not a cascade of mismatches.
 */
export function compareRegistry(
	tableCodes: readonly string[],
	moduleCodes: readonly string[],
): string[] {
	const failures: string[] = []
	const tableSet = new Set(tableCodes)
	const moduleSet = new Set(moduleCodes)
	for (const code of tableCodes) {
		if (!moduleSet.has(code)) {
			failures.push(
				`\`${code}\` is in the AD-28 table but missing from src/core/schemas/faults.ts`,
			)
		}
	}
	for (const code of moduleCodes) {
		if (!tableSet.has(code)) {
			failures.push(
				`\`${code}\` is in src/core/schemas/faults.ts but absent from the AD-28 table`,
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
