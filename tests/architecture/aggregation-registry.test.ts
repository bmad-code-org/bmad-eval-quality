/**
 * Proves `scripts/aggregation-registry.ts` catches drift, not just today's
 * clean tree: fixtures mutate the spine text and the module tuple in memory,
 * so a checker that silently became a no-op fails here. Production gate:
 * `npm run check:aggregation-registry`.
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
	compareAggregationRegistry,
	extractAggregationCodeTable,
} from '../../scripts/aggregation-registry.ts'
import { AGGREGATION_REFUSAL_CODES } from '../../src/core/failure-codes.ts'

const SPINE_PATH =
	'_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md'

async function readSpine(): Promise<string> {
	const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
	return readFile(`${repoRoot}${SPINE_PATH}`, 'utf8')
}

function codesOf(spine: string): string[] {
	const extraction = extractAggregationCodeTable(spine)
	if (!extraction.ok) throw new Error(extraction.reason)
	return extraction.codes
}

describe('extractAggregationCodeTable: reads AD-21 out of the real spine', () => {
	it('extracts exactly the two codes AGGREGATION_REFUSAL_CODES carries, in the same order', async () => {
		expect(codesOf(await readSpine())).toEqual([...AGGREGATION_REFUSAL_CODES])
		expect([...AGGREGATION_REFUSAL_CODES]).toEqual([
			'strength-inputs-disagree',
			'strength-input-inconsistent',
		])
	})

	it('reports a missing AD-21 section instead of silently yielding nothing', () => {
		const extraction = extractAggregationCodeTable('# Spine\n\nNo decisions.\n')
		expect(extraction.ok).toBe(false)
		if (!extraction.ok) expect(extraction.reason).toContain('AD-21 section')
	})

	it('reports a section without the aggregation refusals paragraph', async () => {
		const spine = await readSpine()
		const mutated = spine.replace('**Aggregation refusals.**', '**Refusals.**')
		const extraction = extractAggregationCodeTable(mutated)
		expect(extraction.ok).toBe(false)
		if (!extraction.ok) expect(extraction.reason).toContain('no paragraph')
	})

	it('reports a second table rather than guessing which one carries the codes', async () => {
		const spine = await readSpine()
		const mutated = spine.replace(
			/^### AD-22 /m,
			'| Extra | Column |\n| --- | --- |\n| `not-a-code` | filler |\n\n### AD-22 ',
		)
		const extraction = extractAggregationCodeTable(mutated)
		expect(extraction.ok).toBe(false)
		if (!extraction.ok)
			expect(extraction.reason).toContain('more than one table')
	})

	it('reports a table row that no longer parses as a code row', async () => {
		const spine = await readSpine()
		const first = codesOf(spine)[0] ?? ''
		const mutated = spine.replace(`| \`${first}\` |`, `| ${first} |`)
		expect(mutated).not.toBe(spine)
		const extraction = extractAggregationCodeTable(mutated)
		expect(extraction.ok).toBe(false)
		if (!extraction.ok) expect(extraction.reason).toContain('did not parse')
	})
})

describe('compareAggregationRegistry: drift between the AD-21 table and the tuple', () => {
	it('passes on the real spine against the real tuple', async () => {
		expect(
			compareAggregationRegistry(
				codesOf(await readSpine()),
				AGGREGATION_REFUSAL_CODES,
			),
		).toEqual([])
	})

	it('names a code dropped from the module tuple', async () => {
		const failures = compareAggregationRegistry(
			codesOf(await readSpine()),
			AGGREGATION_REFUSAL_CODES.filter(
				(code) => code !== 'strength-inputs-disagree',
			),
		)
		expect(failures).toHaveLength(1)
		expect(failures[0]).toContain(
			'`strength-inputs-disagree` is in the AD-21 aggregation refusals table but missing',
		)
	})

	it('names a code in the tuple that the table does not carry', async () => {
		const table = codesOf(await readSpine()).filter(
			(code) => code !== 'strength-input-inconsistent',
		)
		const failures = compareAggregationRegistry(
			table,
			AGGREGATION_REFUSAL_CODES,
		)
		expect(failures).toHaveLength(1)
		expect(failures[0]).toContain('absent from the AD-21 aggregation refusals')
	})

	it('names an order mismatch when the two codes are transposed', async () => {
		const table = codesOf(await readSpine())
		const transposed = [...AGGREGATION_REFUSAL_CODES].reverse()
		const failures = compareAggregationRegistry(table, transposed)
		expect(failures[0]).toContain('order mismatch at position 0')
	})
})
