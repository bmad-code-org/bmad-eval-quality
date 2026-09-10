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
// for the wrong reason, so two mutant families follow it, one per column. The
// oracle-removal block removes one oracle at a time and names which rules go
// unsatisfied. The declaration-removal block removes one declaration at a time
// and names which rules go irrelevant, which is the only evidence that reaches
// the relevance predicates at all: none of the seven reads `oracles`, so every
// oracle mutant leaves the relevance column byte-identical.

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
		// One row each. Paired, the two would hide either one of them ceasing to
		// be load-bearing, since the rule reports unsatisfied either way.
		[
			['O-006'],
			['malformed-input'],
			"the oracle addressing the search tool's type-violating step",
		],
		[
			['O-007'],
			['malformed-input'],
			"the oracle addressing the creation tool's type-violating step",
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

/** Every operation on the contract's one interface, rebuilt by `change`. A relevance predicate answers on the first operation that satisfies it, so a mutant has to reach both. */
const soleInterface = mcpContract.permittedInterfaces[0]
if (soleInterface === undefined) {
	throw new TypeError('the mcp fixture declares exactly one interface')
}

const overOperations = (
	change: (operation: Record<string, unknown>) => Record<string, unknown>,
) => ({
	...mcpContract,
	permittedInterfaces: [
		{
			...soleInterface,
			operations: (
				soleInterface.operations as unknown as Record<string, unknown>[]
			).map(change),
		},
	],
})

const overDescriptors = (
	change: (descriptor: Record<string, unknown>) => Record<string, unknown>,
) =>
	overOperations((operation) => ({
		...operation,
		responseDescriptor: change(
			operation.responseDescriptor as Record<string, unknown>,
		),
	}))

const irrelevantIn = (contract: unknown): string[] =>
	gradeOf(contract)
		.filter(([, relevant]) => relevant !== true)
		.map(([rule]) => String(rule))

describe('each rule reads a declaration, and goes irrelevant without it', () => {
	it.each([
		[
			'the two sibling groups',
			{ ...mcpContract, siblingGroups: { operations: [], parameters: [] } },
			['sibling-cross-check'],
		],
		[
			'every channel role beside the success indicator',
			overDescriptors((descriptor) => ({
				...descriptor,
				channelRoles: { '/ok': 'success-indicator' },
			})),
			['success-indicator-separation'],
		],
		[
			'every required response key but one',
			overDescriptors((descriptor) => ({
				...descriptor,
				requiredKeys: ['ok'],
			})),
			['whole-body'],
		],
		[
			'every collection location',
			overDescriptors((descriptor) => ({
				...descriptor,
				collectionLocations: [],
			})),
			// Both rules read the same list, which is why one declaration
			// carries two of the seven.
			['per-record', 'omission-and-completeness'],
		],
		[
			'the reference set each collection location names',
			overDescriptors((descriptor) => ({
				...descriptor,
				collectionLocations: (
					descriptor.collectionLocations as Record<string, unknown>[]
				).map((location) => ({ ...location, referenceSet: null })),
			})),
			// The narrower half of the pair above: the location survives, so
			// rule 4 stays relevant and only rule 6 goes.
			['omission-and-completeness'],
		],
		[
			'every state-change marker, and the fixture reset that needs one',
			{
				...overOperations((operation) => ({
					...operation,
					stateChangeMarker: false,
				})),
				// `compile` refuses a reset naming an operation that changes no
				// state, so the marker cannot be dropped on its own.
				fixtureReset: null,
			},
			['state-change-read-back'],
		],
	] as const)(
		'dropping %s leaves %j irrelevant',
		(_what, mutated, expected) => {
			expect(irrelevantIn(mutated)).toEqual([...expected])
		},
	)

	it('leaves every rule relevant with nothing dropped', () => {
		expect(irrelevantIn(mcpContract)).toEqual([])
	})

	// `malformed-input` is the one rule with no mutant here, and the reason is
	// worth stating rather than leaving as a gap. It answers relevant when any
	// operation declares a key on any input channel, and a tool call has one
	// channel. Emptying `arguments` on both operations takes the interaction
	// plan's bindings, both sensitivity witnesses, the sibling parameter group,
	// the two type-violating steps and the read-back with it, which is a
	// different contract rather than this one with a declaration removed. The
	// oracle-removal block above is what holds the rule's satisfaction side.
})
