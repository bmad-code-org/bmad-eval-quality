import { describe, expect, it } from 'vitest'
import { ABSENT } from '../../src/core/evaluate/resolved-value.ts'

describe('ABSENT', () => {
	it('is a symbol, distinct from every JSON value including null', () => {
		expect(typeof ABSENT).toBe('symbol')
		expect(ABSENT).not.toBeNull()
		expect(ABSENT).not.toBe('absent')
	})

	it('is a stable identity across references to the same import', () => {
		expect(ABSENT).toBe(ABSENT)
	})

	it('does not equal a structurally similar Symbol("absent")', () => {
		expect(ABSENT).not.toBe(Symbol('absent'))
	})
})
