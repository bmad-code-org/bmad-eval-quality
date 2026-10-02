/**
 * Coverage over a contract evaluated through two interfaces that declare the
 * same operation ids. Every rule that looks up the steps of an operation has to
 * look them up by the pair: an oracle on the steps of `thing-api-v2` must not
 * satisfy the site of `thing-api`'s operation of the same id.
 */
import { describe, expect, it } from 'vitest'
import { compile } from '../../src/core/compile/compile.ts'
import { DISCIPLINE_RULES } from '../../src/core/coverage/rules.ts'
import { evaluateSatisfaction } from '../../src/core/coverage/satisfaction.ts'
import { doubleInterface } from '../fixtures/doubled-interface-contract.ts'
import { satisfiedContract } from './fixtures/satisfaction-contracts.ts'

const doubled = doubleInterface(satisfiedContract)

describe('the doubled contract is the satisfied contract on two interfaces', () => {
	it('compiles', () => {
		expect(() => compile(doubled.both, { strict: false })).not.toThrow()
	})

	it('satisfies every rule when both interfaces carry their oracles', () => {
		expect(
			evaluateSatisfaction(doubled.both).map((verdict) => verdict.satisfied),
		).toEqual(DISCIPLINE_RULES.map(() => true))
	})
})

describe('an oracle on the copy never satisfies the site of the original interface', () => {
	const verdicts = evaluateSatisfaction(doubled.copyOraclesOnly)

	it.each(DISCIPLINE_RULES.map((rule, index) => [rule, index] as const))(
		'%s',
		(_rule, index) => {
			const verdict = verdicts[index]
			expect(verdict?.satisfied).toBe(false)
			expect(verdict?.reason).toContain('thing')
		},
	)
})
