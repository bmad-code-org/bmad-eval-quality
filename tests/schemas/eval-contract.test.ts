import { describe, expect, it } from 'vitest'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { gateCContract, RESPELLINGS } from './fixtures/gate-c-contract.ts'

describe('the Gate C contract as the primary accept fixture', () => {
	it('parses, re-spelled and unaltered in meaning', () => {
		const result = EvalContract.safeParse(gateCContract)
		expect(result.error?.issues ?? []).toEqual([])
		expect(result.success).toBe(true)
	})

	it('records every place the schema and the hand-authored contract disagreed', () => {
		expect(RESPELLINGS.length).toBeGreaterThan(0)
		for (const respelling of RESPELLINGS) {
			expect(respelling.why.length).toBeGreaterThan(0)
			expect(respelling.from).not.toBe(respelling.to)
		}
	})

	it('keeps every oracle whose relation is a connective or a quantifier', () => {
		const parsed = EvalContract.parse(gateCContract)
		const nonOperatorRelations = parsed.oracles.filter((oracle) =>
			['all', 'any', 'not', 'for-all', 'for-any'].includes(
				oracle.direction?.relation ?? '',
			),
		)
		// Typing `relation` to the eleven operators alone would fail these. The
		// story context said six of eight; the contract carries seven of eight —
		// O-001 is the only one whose relation is a bare operator.
		expect(nonOperatorRelations).toHaveLength(7)
		expect(parsed.oracles).toHaveLength(8)
	})

	it('rejects a stray key, because every control object is strict', () => {
		const withStrictMode = { ...gateCContract, strictMode: true }
		const result = EvalContract.safeParse(withStrictMode)
		expect(result.success).toBe(false)
		expect(result.error?.issues[0]?.code).toBe('unrecognized_keys')
	})
})
