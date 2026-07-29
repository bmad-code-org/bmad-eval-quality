import { describe, expect, it } from 'vitest'
import { VERSION } from '../src/index.ts'

describe('eval-quality scaffold', () => {
	it('exposes a version string', () => {
		expect(typeof VERSION).toBe('string')
	})
})
