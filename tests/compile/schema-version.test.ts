/**
 * AD-11's version equality at the one reader that has the eval contract.
 *
 * AD-11 says a reader "accepts an equal `schemaVersion` only and throws
 * `schema-version-mismatch` outside that", and the schema deliberately keeps the
 * field a plain integer so the fault is named rather than anonymous. Nothing
 * performed the comparison: a contract stamped 3 parsed, compiled, and put its
 * stale version into the scoring version digest.
 */

import { describe, expect, it } from 'vitest'
import { compile } from '../../src/core/compile/compile.ts'
import {
	EVAL_CONTRACT_SCHEMA_VERSION,
	EvalContract,
} from '../../src/core/schemas/eval-contract.ts'
import { RuntimeFault } from '../../src/core/schemas/faults.ts'
import { commandContract } from '../schemas/fixtures/command-contract.ts'

const compileStamped = (schemaVersion: number) => () =>
	compile(EvalContract.parse({ ...commandContract, schemaVersion }), {
		strict: true,
	})

describe('compile, reading the contract stamp', () => {
	it('accepts the version this build reads', () => {
		expect(compileStamped(EVAL_CONTRACT_SCHEMA_VERSION)).not.toThrow()
	})

	it.each([1, 2, 3, 4, 6, 99])('refuses the stamp %i', (version) => {
		const run = compileStamped(version)
		expect(run).toThrow(RuntimeFault)
		expect(run).toThrow(/schema-version-mismatch/)
	})

	it('names both versions, so a reader knows which way to move', () => {
		expect(compileStamped(3)).toThrow(
			/carries "schemaVersion" 3 where this build reads 5/,
		)
	})

	it('runs before any check that reads a declaration', () => {
		// A stale stamp on a contract that is also broken some other way reports
		// the stamp: every check below it is written against this version's field
		// shapes, so their answers about a foreign contract mean nothing.
		const broken = structuredClone(commandContract) as Record<string, unknown>
		broken.schemaVersion = 3
		const [first] = broken.behaviors as { requirementLinks: unknown[] }[]
		if (first === undefined) throw new Error('the fixture declares no behavior')
		first.requirementLinks = []
		expect(() => compile(EvalContract.parse(broken), { strict: true })).toThrow(
			/schema-version-mismatch/,
		)
	})

	it('pins the constant to the fixture corpus, which stamps the same version', () => {
		expect(commandContract.schemaVersion).toBe(EVAL_CONTRACT_SCHEMA_VERSION)
	})
})
