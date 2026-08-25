/**
 * Proves `scripts/ad28-registry.ts` catches drift, not just today's clean
 * tree: fixtures mutate the spine text and module tuple in memory, so a
 * checker that silently became a no-op fails here. Production gate:
 * `npm run check:ad28-registry`.
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
	compareRegistry,
	extractAd28CodeTable,
} from '../../scripts/ad28-registry.ts'
import { RUNTIME_FAULT_CODES } from '../../src/core/schemas/faults.ts'

const SPINE_PATH =
	'_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md'

async function readSpine(): Promise<string> {
	const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
	return readFile(`${repoRoot}${SPINE_PATH}`, 'utf8')
}

function codesOf(spine: string): string[] {
	const extraction = extractAd28CodeTable(spine)
	if (!extraction.ok) throw new Error(extraction.reason)
	return extraction.codes
}

describe('extractAd28CodeTable: reads AD-28 out of the real spine', () => {
	it('extracts exactly the ten codes RUNTIME_FAULT_CODES carries, in the same order', async () => {
		expect(codesOf(await readSpine())).toEqual([...RUNTIME_FAULT_CODES])
	})

	it('reports a missing AD-28 section instead of silently yielding nothing', () => {
		const extraction = extractAd28CodeTable('# Spine\n\nNo decisions here.\n')
		expect(extraction.ok).toBe(false)
		if (!extraction.ok) expect(extraction.reason).toContain('AD-28 section')
	})

	it('reports a second table in the section rather than guessing which one carries the codes', async () => {
		const spine = await readSpine()
		const mutated = spine.replace(
			/^### AD-29 /m,
			'| Extra | Column |\n| --- | --- |\n| `not-a-code` | filler |\n\n### AD-29 ',
		)
		const extraction = extractAd28CodeTable(mutated)
		expect(extraction.ok).toBe(false)
		if (!extraction.ok)
			expect(extraction.reason).toContain('more than one table')
	})

	it('reports a table row that no longer parses as a code row', async () => {
		const spine = await readSpine()
		const codes = codesOf(spine)
		const first = codes[0] ?? ''
		const mutated = spine.replace(`| \`${first}\` |`, `| ${first} |`)
		expect(mutated).not.toBe(spine)
		const extraction = extractAd28CodeTable(mutated)
		expect(extraction.ok).toBe(false)
		if (!extraction.ok) expect(extraction.reason).toContain('did not parse')
	})
})

describe('compareRegistry: drift between the AD-28 table and RUNTIME_FAULT_CODES', () => {
	it('passes on the real spine against the real tuple', async () => {
		expect(
			compareRegistry(codesOf(await readSpine()), RUNTIME_FAULT_CODES),
		).toEqual([])
	})

	it('names a code dropped from the module tuple', async () => {
		const table = codesOf(await readSpine())
		const failures = compareRegistry(
			table,
			RUNTIME_FAULT_CODES.filter((code) => code !== 'aborted'),
		)
		expect(failures).toHaveLength(1)
		expect(failures[0]).toContain('`aborted` is in the AD-28 table but missing')
	})

	it('names a code present in the module tuple but absent from the table', async () => {
		const table = codesOf(await readSpine()).filter(
			(code) => code !== 'digest-mismatch',
		)
		const failures = compareRegistry(table, RUNTIME_FAULT_CODES)
		expect(failures).toHaveLength(1)
		expect(failures[0]).toContain('absent from the AD-28 table')
	})

	it('names an order mismatch when two codes are transposed, which set equality alone cannot catch', async () => {
		const table = codesOf(await readSpine())
		const transposed = [...RUNTIME_FAULT_CODES]
		const [a, b] = [transposed[5], transposed[6]]
		if (a === undefined || b === undefined)
			throw new Error('fixture setup failed')
		transposed[5] = b
		transposed[6] = a
		const failures = compareRegistry(table, transposed)
		expect(new Set(table)).toEqual(new Set(transposed))
		expect(failures.length).toBeGreaterThan(0)
		expect(failures[0]).toContain('order mismatch at position 5')
	})
})
