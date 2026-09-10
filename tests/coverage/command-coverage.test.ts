// AD-31's fourteen predicates, graded over the three command contracts.
//
// `CORPUS_CELLS` is one contract per discipline rule per declaration state, and
// the command contracts are not declaration-state exemplars, so they do not
// belong in it. The consequence was that nothing graded them at all: the
// generated AD-31 table is the only artifact that runs all fourteen predicates,
// it reads the cells, and a whole interface kind went ungraded while the suite
// stayed green over three predicates that answered confidently and wrongly.
//
// The verdict table is asserted whole rather than rule by rule. A predicate
// that stops firing, starts firing, or flips its answer for a command contract
// is the failure this exists to catch, and naming only the rules that happen to
// be interesting today would let the next one through.

import { describe, expect, it } from 'vitest'
import { compile } from '../../src/core/compile/compile.ts'
import { evaluateRelevance } from '../../src/core/coverage/relevance.ts'
import { evaluateSatisfaction } from '../../src/core/coverage/satisfaction.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import {
	artifactCommandContract,
	commandContract,
} from '../schemas/fixtures/command-contract.ts'
import { skillContract } from '../schemas/fixtures/skill-contract.ts'

const gradeOf = (contract: unknown) => {
	const parsed = EvalContract.parse(contract)
	// Graded through the compiler, so a table that grades a contract the
	// compiler would reject cannot be mistaken for coverage.
	compile(parsed, { strict: true })
	const relevance = evaluateRelevance(parsed)
	const satisfaction = evaluateSatisfaction(parsed)
	return relevance.map((verdict, index) => [
		verdict.rule,
		verdict.relevant,
		satisfaction[index]?.satisfied ?? null,
	])
}

describe('the fourteen predicates over a command contract', () => {
	it('grades one describing its response on standard output', () => {
		expect(gradeOf(commandContract)).toEqual([
			['success-indicator-separation', false, true],
			['whole-body', false, true],
			['malformed-input', true, false],
			// No quantifier over the declared collection, so the rule is
			// relevant and unsatisfied. The artifact contract below carries one
			// and satisfies it, which is what proves the pointer this rule
			// builds is one a real evidence pointer can equal.
			['per-record', true, false],
			['sibling-cross-check', true, false],
			['omission-and-completeness', false, true],
			['state-change-read-back', false, true],
		])
	})

	it('grades one describing its response through a written file', () => {
		expect(gradeOf(artifactCommandContract)).toEqual([
			['success-indicator-separation', false, true],
			['whole-body', false, true],
			['malformed-input', true, false],
			// Satisfied only because the descriptor root carries the artifact
			// identifier. A root of `/artifact` alone is a prefix no evidence
			// pointer starts with, and this rule answered `false` against every
			// artifact-described contract while looking green.
			['per-record', true, true],
			['sibling-cross-check', true, false],
			['omission-and-completeness', false, true],
			['state-change-read-back', false, true],
		])
	})

	it('grades one holding a skill responsible for a decision', () => {
		expect(gradeOf(skillContract)).toEqual([
			['success-indicator-separation', false, true],
			['whole-body', false, true],
			['malformed-input', true, false],
			// Satisfied where the two fixtures above leave it unsatisfied and
			// satisfied respectively, and by a third route: the exclusion oracle
			// quantifies over the declared collection on the nominated stream
			// rather than inside a written file. A skill contract needs that
			// quantifier for its own reasons, since the claim it makes is about
			// every item the reply names.
			['per-record', true, true],
			['sibling-cross-check', true, false],
			['omission-and-completeness', false, true],
			['state-change-read-back', false, true],
		])
	})

	// Every rule that reads a descriptor pointer builds it from this root, so
	// the root is asserted directly as well: a wrong root makes several rules
	// answer against a pointer that cannot exist, and each of them reads as an
	// ordinary unsatisfied verdict.
	it('roots a descriptor pointer where a real evidence pointer starts', async () => {
		const { resolveOperations } = await import(
			'../../src/core/coverage/operations.ts'
		)
		expect(
			resolveOperations(EvalContract.parse(commandContract))[0]?.descriptorRoot,
		).toBe('/stdout')
		expect(
			resolveOperations(EvalContract.parse(artifactCommandContract))[0]
				?.descriptorRoot,
		).toBe('/artifact/verdict')
		expect(
			resolveOperations(EvalContract.parse(skillContract))[0]?.descriptorRoot,
		).toBe('/stdout')
	})
})
