// AD-31's fourteen predicates, graded over a tool-call contract.
//
// `CORPUS_CELLS` is one contract per discipline rule per declaration state, and
// a kind's own contracts are not declaration-state exemplars, so they do not
// belong in it. The consequence, when the command kind landed, was that nothing
// graded it at all: the generated AD-31 table is the only artifact that runs
// all fourteen predicates, it reads the cells, and a whole interface kind went
// ungraded while the suite stayed green over three predicates that answered
// confidently and wrongly. The `mcp` kind inherits that obligation and this
// file is where it is discharged.
//
// The verdict table is asserted whole rather than rule by rule. A predicate
// that stops firing, starts firing, or flips its answer for a tool-call
// contract is the failure this exists to catch, and naming only the rules that
// happen to be interesting today would let the next one through.
//
// A whole table of `relevant, satisfied` is also the table most easily green
// for the wrong reason, so the second block removes one oracle at a time and
// names which rules go unsatisfied. That is what separates seven predicates
// reading this contract from seven predicates answering `true` without reading
// it.

import { describe, expect, it } from 'vitest'
import { compile } from '../../src/core/compile/compile.ts'
import { evaluateRelevance } from '../../src/core/coverage/relevance.ts'
import { evaluateSatisfaction } from '../../src/core/coverage/satisfaction.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { mcpContract } from '../schemas/fixtures/mcp-contract.ts'

const gradeOf = (contract: unknown) => {
	const parsed = EvalContract.parse(contract)
	// Graded through the compiler, so a table that grades a contract the
	// compiler would reject cannot be mistaken for coverage. Every mutant below
	// still compiles under `strict`: dropping an oracle leaves an undisciplined
	// contract rather than an illegal one, which is exactly the state these
	// predicates exist to report.
	compile(parsed, { strict: true })
	const relevance = evaluateRelevance(parsed)
	const satisfaction = evaluateSatisfaction(parsed)
	return relevance.map((verdict, index) => [
		verdict.rule,
		verdict.relevant,
		satisfaction[index]?.satisfied ?? null,
	])
}

/** The same contract with the named oracles removed from `oracles` and from every behavior that cites them. */
const without = (...removed: readonly string[]) => ({
	...mcpContract,
	behaviors: mcpContract.behaviors.map((behavior) => ({
		...behavior,
		oracles: behavior.oracles.filter((id) => !removed.includes(id)),
	})),
	oracles: mcpContract.oracles.filter((oracle) => !removed.includes(oracle.id)),
})

const unsatisfiedIn = (contract: unknown): string[] =>
	gradeOf(contract)
		.filter(([, , satisfied]) => satisfied !== true)
		.map(([rule]) => String(rule))

describe('the fourteen predicates over a tool-call contract', () => {
	it('grades one describing its response as a structured tool result', () => {
		expect(gradeOf(mcpContract)).toEqual([
			// Every rule is relevant here, which is the difference from the two
			// command contracts: this fixture declares a success indicator beside
			// other channel roles, a type-violating binding, a collection location
			// naming a reference set, a sibling group, and a state-change marker,
			// so no rule has an absent declaration to be irrelevant about.
			['success-indicator-separation', true, true],
			['whole-body', true, true],
			['malformed-input', true, true],
			['per-record', true, true],
			['sibling-cross-check', true, true],
			['omission-and-completeness', true, true],
			['state-change-read-back', true, true],
		])
	})

	// Every rule that reads a descriptor pointer builds it from this root, so
	// the root is asserted directly as well: a wrong root makes several rules
	// answer against a pointer that cannot exist, and each of them reads as an
	// ordinary unsatisfied verdict. `/artifact` alone was that defect on the
	// command side.
	it('roots a descriptor pointer where a real evidence pointer starts', async () => {
		const { resolveOperations } = await import(
			'../../src/core/coverage/operations.ts'
		)
		const resolved = resolveOperations(EvalContract.parse(mcpContract))
		expect(
			resolved.map((each) => [
				each.operation.operationId,
				each.kind,
				each.descriptorRoot,
			]),
		).toEqual([
			['search-notes', 'mcp', '/response-body'],
			['create-note', 'mcp', '/response-body'],
		])
	})
})

describe('each rule is satisfied by a named oracle, and goes red without it', () => {
	it.each([
		[
			['O-001'],
			['success-indicator-separation', 'whole-body'],
			"the search tool's own coverage: the indicator asserted beside a payload and a collection, and all three of its required keys",
		],
		[
			['O-003'],
			['success-indicator-separation', 'whole-body'],
			'the same pair over the creation tool, which has its own descriptor and its own required keys',
		],
		[
			['O-006', 'O-007'],
			['malformed-input'],
			'the two oracles addressing the type-violating steps',
		],
		[
			['O-002'],
			['per-record', 'omission-and-completeness'],
			'the one quantifier over the declared collection, whose predicate is also the membership test against the reference set the location names',
		],
		[
			['O-005'],
			['sibling-cross-check'],
			'the one oracle reading both siblings',
		],
		[
			['O-004'],
			['state-change-read-back'],
			'the read-back of what the state-changing tool filed',
		],
	] as const)(
		'dropping %j leaves %j unsatisfied (%s)',
		(removed, expected, _why) => {
			expect(unsatisfiedIn(without(...removed))).toEqual([...expected])
		},
	)

	it('leaves every rule satisfied with no oracle removed', () => {
		expect(unsatisfiedIn(mcpContract)).toEqual([])
	})
})
