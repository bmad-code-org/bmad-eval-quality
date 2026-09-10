// AD-31's fourteen predicates, graded over the workflow contract.
//
// `CORPUS_CELLS` is one contract per discipline rule per declaration state, and
// a member shipped for the shape it declares is not a declaration-state
// exemplar, so it does not belong in it. The consequence, when the command kind
// landed, was that nothing graded it at all: the generated AD-31 table is the
// only artifact that runs all fourteen predicates, it reads the cells, and a
// whole interface kind went ungraded while the suite stayed green over three
// predicates that answered confidently and wrongly. `captured-read-back`
// declares the `api` kind nineteen cell contracts already grade, and it
// declares two things no cell contract declares: a `{ captured }` binding and a
// `fixtureReset`. `bindsTypeViolating` discriminates by `'matcher' in value`,
// so a captured binding answers false there, and no predicate reads
// `fixtureReset` at all. Both readings are cheap to assert and expensive to
// assume, which is why this file exists.
//
// The verdict table is asserted whole rather than rule by rule, for the reason
// its two siblings give: a predicate that stops firing, starts firing, or flips
// its answer is the failure this catches, and naming only the rules that happen
// to be interesting today would let the next one through.
//
// Two mutant families follow it, one per column. The oracle-removal block
// removes one oracle at a time and names which rules go unsatisfied. The
// declaration-removal block removes one declaration at a time and names which
// rules go irrelevant, which is the only evidence that reaches the relevance
// predicates at all: none of the seven reads `oracles`, so every oracle mutant
// leaves the relevance column byte-identical.

import { describe, expect, it } from 'vitest'
import { compile } from '../../src/core/compile/compile.ts'
import { evaluateRelevance } from '../../src/core/coverage/relevance.ts'
import { evaluateSatisfaction } from '../../src/core/coverage/satisfaction.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { workflowContract } from '../schemas/fixtures/workflow-contract.ts'

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
	...workflowContract,
	behaviors: workflowContract.behaviors.map((behavior) => ({
		...behavior,
		oracles: behavior.oracles.filter((id) => !removed.includes(id)),
	})),
	oracles: workflowContract.oracles.filter(
		(oracle) => !removed.includes(oracle.id),
	),
})

const unsatisfiedIn = (contract: unknown): string[] =>
	gradeOf(contract)
		.filter(([, , satisfied]) => satisfied !== true)
		.map(([rule]) => String(rule))

const irrelevantIn = (contract: unknown): string[] =>
	gradeOf(contract)
		.filter(([, relevant]) => relevant !== true)
		.map(([rule]) => String(rule))

describe('the fourteen predicates over a workflow contract', () => {
	it('grades one binding a step to a captured value and declaring a fixture reset', () => {
		expect(gradeOf(workflowContract)).toEqual([
			['success-indicator-separation', true, true],
			['whole-body', true, true],
			['malformed-input', true, true],
			// The two rules that read `collectionLocations`, and this contract
			// declares none: every operation answers with one record or with a
			// verdict about one call, and none returns a list. They are irrelevant
			// rather than unsatisfied, which is AD-31's disposition for a rule
			// whose declaration is absent, and the positive control below shows
			// the absence is what decides it.
			['per-record', false, true],
			['sibling-cross-check', true, true],
			['omission-and-completeness', false, true],
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
		const resolved = resolveOperations(EvalContract.parse(workflowContract))
		expect(
			resolved.map((each) => [
				each.operation.operationId,
				each.kind,
				each.descriptorRoot,
			]),
		).toEqual([
			['get-thing', 'api', '/response-body'],
			['create-thing', 'api', '/response-body'],
			['reset-things', 'api', '/response-body'],
		])
	})
})

describe('each rule is satisfied by a named oracle, and goes red without it', () => {
	it.each([
		// One row per operation for the pair of whole-response rules, rather than
		// one row naming all three oracles. Paired, the three would hide any one
		// of them ceasing to be load-bearing, since the rules report unsatisfied
		// while either of the others still stands.
		[
			['O-001'],
			['success-indicator-separation', 'whole-body'],
			"the write's own coverage: the indicator asserted beside the payload the descriptor requires next to it, and both required keys at one step",
		],
		[
			['O-005'],
			['success-indicator-separation', 'whole-body'],
			'the same pair over the read, which has its own descriptor and its own required keys',
		],
		[
			['O-006'],
			['success-indicator-separation', 'whole-body'],
			'the same pair over the reset, which is an operation like any other and is graded like one',
		],
		[
			['O-003'],
			['malformed-input'],
			'the one oracle addressing all three type-violating steps',
		],
		[
			['O-004'],
			['sibling-cross-check'],
			'the one oracle reading both siblings, the second of them sent from a captured value',
		],
		[
			['O-002'],
			['state-change-read-back'],
			'the read-back of what the write filed, reached through the identifier the write returned',
		],
		[
			['O-007'],
			['state-change-read-back'],
			'the read-back of what the reset seeded, which the rule requires separately because the reset is a second state-changing operation',
		],
	] as const)(
		'dropping %j leaves %j unsatisfied (%s)',
		(removed, expected, _why) => {
			expect(unsatisfiedIn(without(...removed))).toEqual([...expected])
		},
	)

	// No "with nothing removed" control here or in the block below. The whole
	// verdict table above pins all seven rows in both columns for the unmutated
	// contract, so a control would restate it and no mutation could redden one
	// without reddening the other. The collection positive control at the foot
	// of the next block is a different case: it asserts a table this file never
	// otherwise grades.
})

/** Every operation on the contract's one interface, rebuilt by `change`. A relevance predicate answers on the first operation that satisfies it, so a mutant has to reach all three. */
const soleInterface = workflowContract.permittedInterfaces[0]
if (soleInterface === undefined) {
	throw new TypeError('the workflow fixture declares exactly one interface')
}

const overOperations = (
	change: (operation: Record<string, unknown>) => Record<string, unknown>,
) => ({
	...workflowContract,
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

// The two rules that read `collectionLocations` are irrelevant on this contract
// with nothing removed, so every expectation below names them alongside the
// rule its own mutant takes out, in `DISCIPLINE_RULES` order. Written out
// rather than subtracted: a list that filtered the baseline away would stay
// green if a mutant made one of the two relevant, which is the opposite of what
// these rows are for.
describe('each rule reads a declaration, and goes irrelevant without it', () => {
	it.each([
		[
			'the two sibling groups',
			{
				...workflowContract,
				siblingGroups: { operations: [], parameters: [] },
			},
			['per-record', 'sibling-cross-check', 'omission-and-completeness'],
		],
		[
			'every channel role beside the success indicator',
			overDescriptors((descriptor) => ({
				...descriptor,
				channelRoles: { '/ok': 'success-indicator' },
			})),
			[
				'success-indicator-separation',
				'per-record',
				'omission-and-completeness',
			],
		],
		[
			'every required response key but one',
			overDescriptors((descriptor) => ({
				...descriptor,
				requiredKeys: ['ok'],
			})),
			['whole-body', 'per-record', 'omission-and-completeness'],
		],
		[
			// The marker cannot be dropped on its own on this kind. AD-10 gives a
			// marker-true api operation the body channel and a marker-false one
			// the URL, so flipping the marker leaves the witness on an illegal
			// channel and `compile` refuses the contract before it is graded.
			// The mutant therefore moves each affected witness to `query` and
			// gives it a query key to differ on, and drops the fixture reset,
			// which `compile` also refuses over an operation that changes no
			// state.
			'every state-change marker, with each witness moved to the channel the marker now selects',
			{
				...overOperations((operation) =>
					operation.stateChangeMarker === true
						? {
								...operation,
								stateChangeMarker: false,
								requestShape: {
									...(operation.requestShape as Record<string, unknown>),
									query: {
										requiredKeys: [],
										permittedKeys: ['q'],
										types: { q: 'string' },
									},
								},
								sensitivityWitness: {
									...(operation.sensitivityWitness as Record<string, unknown>),
									channel: 'query',
									legs: (
										operation.sensitivityWitness as {
											legs: readonly Record<string, unknown>[]
										}
									).legs.map((leg, index) => ({
										...leg,
										inputs: {
											...(leg.inputs as Record<string, unknown>),
											query: { q: index === 0 ? 'one' : 'two' },
										},
									})),
								},
							}
						: operation,
				),
				fixtureReset: null,
			},
			['per-record', 'omission-and-completeness', 'state-change-read-back'],
		],
	] as const)(
		'dropping %s leaves %j irrelevant',
		(_what, mutated, expected) => {
			expect(irrelevantIn(mutated)).toEqual([...expected])
		},
	)

	// The positive control for the two rows above. Both rules are irrelevant on
	// this contract, and an assertion that a rule is irrelevant is satisfied by
	// a predicate that answers irrelevant to everything, so the absent
	// declaration has to be shown to be what decides it. Adding one collection
	// location and the reference set it names makes both relevant with nothing
	// else moved.
	it('makes the two collection rules relevant when a collection location is declared', () => {
		const withCollection = {
			...overDescriptors((descriptor) =>
				(descriptor.requiredKeys as readonly string[]).includes('thing')
					? {
							...descriptor,
							permittedKeys: [
								...(descriptor.permittedKeys as readonly string[]),
								'items',
							],
							types: {
								...(descriptor.types as Record<string, string>),
								items: 'array',
							},
							channelRoles: {
								...(descriptor.channelRoles as Record<string, string>),
								'/items': 'collection',
							},
							collectionLocations: [
								{
									pointer: '/items',
									referenceSet: 'expected-things',
									expectedCardinality: { mode: 'at-most', max: 5 },
								},
							],
						}
					: descriptor,
			),
			referenceSets: {
				'expected-things': {
					keys: ['id'],
					members: [{ id: 't-1' }],
					commentary: null,
				},
			},
		}
		expect(irrelevantIn(withCollection)).toEqual([])
	})

	// `malformed-input` is the one rule with no mutant here, and the reason is
	// worth stating rather than leaving as a gap. It answers relevant when any
	// operation declares a key on any input channel, and all three declare one.
	// Emptying every request shape takes the interaction plan's bindings, all
	// three sensitivity witnesses, the sibling parameter group, the three
	// type-violating steps, the fixture reset's inputs and the capture with it,
	// which is a different contract rather than this one with a declaration
	// removed. The oracle-removal block above is what holds the rule's
	// satisfaction side.
})
