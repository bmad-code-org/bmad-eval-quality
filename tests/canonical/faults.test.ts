import { describe, expect, it } from 'vitest'
import {
	RUNTIME_FAULT_CODES,
	RuntimeFault,
} from '../../src/core/schemas/faults.ts'

describe('RUNTIME_FAULT_CODES: the complete AD-28 registry', () => {
	it('holds all ten codes, in the architecture table order, each unique', () => {
		expect(RUNTIME_FAULT_CODES).toEqual([
			'schema-parse-failure',
			'schema-version-mismatch',
			'non-canonicalizable-value',
			'digest-mismatch',
			'budget-exhausted',
			'port-failure',
			'port-contract-violation',
			'forbidden-target',
			'aborted',
			'operator-cannot-accept-operand',
		])
		expect(new Set(RUNTIME_FAULT_CODES).size).toBe(RUNTIME_FAULT_CODES.length)
	})

	it.each(RUNTIME_FAULT_CODES)(
		'constructs a RuntimeFault carrying code %s',
		(code) => {
			const fault = new RuntimeFault(code, 'artifacts/example.json', 'detail')
			expect(fault.code).toBe(code)
			expect(fault).toBeInstanceOf(Error)
		},
	)
})

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

	it('carries an optional cause so the platform error is not discarded', () => {
		const cause = new Error('decoder position 3')
		const fault = new RuntimeFault(
			'schema-parse-failure',
			'artifacts/broken.json',
			'input is not valid UTF-8',
			{ cause },
		)
		expect(fault.cause).toBe(cause)
	})
})
