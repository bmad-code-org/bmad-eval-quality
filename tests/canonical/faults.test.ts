import { describe, expect, it } from 'vitest'
import { RuntimeFault } from '../../src/core/schemas/faults.ts'

describe('RuntimeFault', () => {
	it('is a thrown Error carrying a stable machine code and the artifact path', () => {
		const fault = new RuntimeFault(
			'non-canonicalizable-value',
			'artifacts/example.json',
			'integer outside the safe range',
		)
		expect(fault).toBeInstanceOf(Error)
		expect(fault.name).toBe('RuntimeFault')
		expect(fault.code).toBe('non-canonicalizable-value')
		expect(fault.artifactPath).toBe('artifacts/example.json')
		expect(fault.message).toContain('integer outside the safe range')
		expect(fault.message).toContain('artifacts/example.json')
	})

	it('carries schema-parse-failure for input that does not parse', () => {
		const fault = new RuntimeFault(
			'schema-parse-failure',
			'artifacts/broken.json',
			'input is not valid UTF-8',
		)
		expect(fault.code).toBe('schema-parse-failure')
		expect(fault.artifactPath).toBe('artifacts/broken.json')
	})
})
