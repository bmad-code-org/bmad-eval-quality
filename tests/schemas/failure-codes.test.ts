// The AD-5 failure-code registry as data (Story 1.5, AC 4). The binding to the
// spine's table is `scripts/check-ad5-registry.ts` under `npm run validate`;
// this test locks the module's own invariants so it cannot silently gain a
// duplicate or a mis-cased entry between spine parses.

import { describe, expect, it } from 'vitest'
import { FAILURE_CODES } from '../../src/core/failure-codes.ts'

describe('FAILURE_CODES, the single source for every later consumer', () => {
	// Twenty-three is pinned mechanically too: the registry check above parses
	// the spine's AD-5 table and asserts set and order equality, so a code
	// added there must land here as well.
	it('carries exactly the twenty-three AD-5 codes', () => {
		expect(FAILURE_CODES).toHaveLength(23)
	})

	it('carries no duplicate', () => {
		expect(new Set(FAILURE_CODES).size).toBe(FAILURE_CODES.length)
	})

	it.each([...FAILURE_CODES])('%s is lowercase kebab-case', (code) => {
		expect(code).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
	})
})
