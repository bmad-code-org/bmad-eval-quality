// AD-31's contract fixture corpus: nineteen contracts covering every AD-20
// rule in every declaration state. The publication target AD-31 names in place
// of the worked example, which stays inconsistent (Owed item 7).
//
// Built by spread from the parsed seed. Nothing clones: a clone keeps
// `satisfaction-contracts.ts:20-24`'s channel aliasing. Every override
// replaces a whole sub-object.
//
// Five contracts occupy a cell for more than one rule, because two rules can
// read the same declaration. Decision 5 lists them.

import type { DisciplineRule } from '../../../src/core/coverage/rules.ts'
import type { DeclarationState } from '../../../src/core/coverage/table.ts'
import { EvalContract } from '../../../src/core/schemas/eval-contract.ts'
import type { Operation } from '../../../src/core/schemas/interface.ts'
import { satisfiedContract } from './satisfaction-contracts.ts'

// The seed goes through the schema first. `satisfiedContract` is `satisfies
// EvalContract`, so a direct spread widens its `responseDescriptor.types` to a
// union carrying `items?: undefined` that no `Record<string, KeyType>`
// accepts. Parsing settles that and de-aliases the shared channel in one step.
const seed: EvalContract = EvalContract.parse(satisfiedContract)

const seedInterfaceOf = (): EvalContract['permittedInterfaces'][number] => {
	const declared = seed.permittedInterfaces[0]
	if (declared === undefined) throw new Error('seed declares no interface')
	return declared
}

const seedInterface = seedInterfaceOf()

const [createThing, listThings] = seedInterface.operations as [
	Operation,
	Operation,
]

/** The seed's one interface with its two operations replaced. */
const withOperations = (
	create: Operation,
	list: Operation,
): EvalContract['permittedInterfaces'] => [
	{ logicalId: 'thing-api', kind: 'api', operations: [create, list] },
]

/** One operation with named response-descriptor fields replaced. */
const withDescriptor = (
	operation: Operation,
	patch: Partial<Operation['responseDescriptor']>,
): Operation => ({
	...operation,
	responseDescriptor: { ...operation.responseDescriptor, ...patch },
})

/** One operation with named top-level fields replaced. */
const withOperation = (
	operation: Operation,
	patch: Partial<Operation>,
): Operation => ({ ...operation, ...patch })

/** The seed under a new identifier, with named top-level fields replaced. */
const variant = (
	contractId: string,
	patch: Partial<EvalContract>,
): EvalContract => ({ ...seed, contractId, ...patch })

/** A fresh channel per call, matching `satisfaction.test.ts:74-88`. */
const emptyChannel = () => ({ requiredKeys: [], permittedKeys: [], types: {} })

const emptyRequestShape = (): Operation['requestShape'] => ({
	path: emptyChannel(),
	query: emptyChannel(),
	header: emptyChannel(),
	body: emptyChannel(),
})

// `oracles` and `interactionPlan` have no partial spelling either, so the three
// helpers below supply the whole array. The replacement is the parameter, which
// is what gives an inline oracle or step its contextual type: hoisted to a
// standalone `const` it widens against the `Relation` and `Polarity` enums.

/** The seed's oracles with one replaced. */
const withOracle = (
	id: string,
	replacement: EvalContract['oracles'][number],
): EvalContract['oracles'] =>
	seed.oracles.map((oracle) => (oracle.id === id ? replacement : oracle))

/** The seed's oracles with one removed. */
const withoutOracle = (id: string): EvalContract['oracles'] =>
	seed.oracles.filter((oracle) => oracle.id !== id)

/** The seed's interaction plan with one step replaced. */
const withStep = (
	stepId: string,
	replacement: EvalContract['interactionPlan'][number],
): EvalContract['interactionPlan'] =>
	seed.interactionPlan.map((step) =>
		step.stepId === stepId ? replacement : step,
	)

// ---- the four `absent` contracts ----------------------------------------

/** Rule 1: the indicator's `null` state, which is the absent one. */
const absentSuccessIndicator = variant('absent-success-indicator', {
	permittedInterfaces: withOperations(
		withDescriptor(createThing, { successIndicator: null }),
		listThings,
	),
})

/** Rules 4 and 6: both read `collectionLocations`, so its `null` state is one contract. */
const absentCollectionLocations = variant('absent-collection-locations', {
	permittedInterfaces: withOperations(
		withDescriptor(createThing, { collectionLocations: null }),
		listThings,
	),
})

/** Rule 5: the one contract-level declaration. */
const absentSiblingGroups = variant('absent-sibling-groups', {
	siblingGroups: null,
})

/**
 * Rules 2, 3, and 7 read declarations with no `null` state, so their absent
 * state is the missing inventory. Rule 5 does not move: it reads
 * `siblingGroups` and the plan index, which the inventory does not reach.
 */
const noOperationInventory = variant('no-operation-inventory', {
	permittedInterfaces: [],
})

// ---- the seven `explicitly-empty` contracts ------------------------------

/** Rule 1: `{}` leaves the indicator nominated, so no site. `channelRoles: null` would be the absent cell. */
const emptyChannelRoles = variant('empty-channel-roles', {
	permittedInterfaces: withOperations(
		withDescriptor(createThing, { channelRoles: {} }),
		withDescriptor(listThings, { channelRoles: {} }),
	),
})

/** Rule 2: one distinct required key is the explicit answer to "more than one". */
const singleRequiredResponseKey = variant('single-required-response-key', {
	permittedInterfaces: withOperations(
		withDescriptor(createThing, { requiredKeys: ['ok'] }),
		listThings,
	),
})

/** Rule 3: four distinct empty channels per operation, never four references to one. */
const emptyRequestShapes = variant('empty-request-shapes', {
	permittedInterfaces: withOperations(
		withOperation(createThing, { requestShape: emptyRequestShape() }),
		withOperation(listThings, { requestShape: emptyRequestShape() }),
	),
})

/** Rule 4: `[]` is an answer where `null` is a gap. */
const emptyCollectionLocations = variant('empty-collection-locations', {
	permittedInterfaces: withOperations(
		createThing,
		withDescriptor(listThings, { collectionLocations: [] }),
	),
})

/** Rule 5: both group lists explicitly empty. */
const emptySiblingGroups = variant('empty-sibling-groups', {
	siblingGroups: { operations: [], parameters: [] },
})

/** Rule 6: a declared location naming no reference set. Rule 4 stays witnessed. */
const unnamedReferenceSet = variant('unnamed-reference-set', {
	permittedInterfaces: withOperations(
		createThing,
		withDescriptor(listThings, {
			collectionLocations: [
				{
					pointer: '/items',
					expectedCardinality: { mode: 'exact', count: 3 },
					referenceSet: null,
				},
			],
		}),
	),
})

/**
 * Rule 7: `false` is the marker's other legal value, and its explicit answer.
 *
 * The witness goes with the marker. AD-10 selects the differential channel by
 * exactly this field, and `create-thing`'s only declared input channel is
 * `body`, which is illegal once the marker is false; moving the witness to
 * `query` instead would leave both legs supplying the same empty query, which
 * is a pair that differentiates nothing. `null` is the truthful answer for an
 * operation whose declared inputs AD-10 can express no witness over, and this
 * corpus compiles under `strict: false`, where the declaration check that would
 * otherwise demand one does not run.
 */
const noStateChangeMarker = variant('no-state-change-marker', {
	permittedInterfaces: withOperations(
		withOperation(createThing, {
			stateChangeMarker: false,
			sensitivityWitness: null,
		}),
		listThings,
	),
})

// ---- the seven `unwitnessed` contracts -----------------------------------

/**
 * Rule 1: O-002 reduced to the indicator alone. Dropping only `/id` leaves
 * `/error`, whose `diagnostic` role keeps it a witness. Rule 2 loses its
 * witness here too, so rule 2's cell is a different contract. `all` needs two
 * operands and `checkOracleAlignment` needs `direction.relation` in the check,
 * which is why the oracle is respelled whole.
 */
const splitIndicatorOracle = variant('split-indicator-oracle', {
	oracles: withOracle('O-002', {
		id: 'O-002',
		direction: {
			evidenceTargets: ['/interactions/create/response-body/ok'],
			relation: 'existence',
			polarity: 'expects-hold',
			scope: 'The create response indicator, read on its own.',
			negativeDomain: 'A create response carrying no indicator at all.',
		},
		check: {
			op: 'existence',
			operands: [{ pointer: '/interactions/create/response-body/ok' }],
		},
		polarity: 'expects-hold',
		commentary: null,
	}),
})

/** Rule 2: the two required keys split across two oracles. Rule 1 stays witnessed through `/error`. */
const perKeySplitOracles = variant('per-key-split-oracles', {
	oracles: [
		...withOracle('O-002', {
			id: 'O-002',
			direction: {
				evidenceTargets: [
					'/interactions/create/response-body/ok',
					'/interactions/create/response-body/error',
				],
				relation: 'all',
				polarity: 'expects-hold',
				scope: 'The create response indicator and its diagnostic field.',
				negativeDomain:
					'A create reporting success with a diagnostic beside it.',
			},
			check: {
				op: 'all',
				operands: [
					{
						op: 'existence',
						operands: [{ pointer: '/interactions/create/response-body/ok' }],
					},
					{
						op: 'absence',
						operands: [{ pointer: '/interactions/create/response-body/error' }],
					},
				],
			},
			polarity: 'expects-hold',
			commentary: null,
		}),
		{
			id: 'O-008',
			direction: {
				evidenceTargets: ['/interactions/create/response-body/id'],
				relation: 'existence',
				polarity: 'expects-hold',
				scope: 'The identifier the create response returns.',
				negativeDomain: 'A create returning no identifier.',
			},
			check: {
				op: 'existence',
				operands: [{ pointer: '/interactions/create/response-body/id' }],
			},
			polarity: 'expects-hold',
			commentary: null,
		},
	],
})

/** Rule 3: `malformed-create` drops the type-violating matcher, so the predicate fails on its first site. */
const noTypeViolatingStep = variant('no-type-violating-step', {
	interactionPlan: withStep('malformed-create', {
		stepId: 'malformed-create',
		operationId: 'create-thing',
		inputBinding: {
			path: null,
			query: null,
			header: null,
			body: { name: { matcher: 'any' } },
		},
		after: null,
	}),
})

/** Rule 4: the one quantifier goes. Rule 6 keeps O-001's `covers-by-key`. */
const noCollectionQuantifier = variant('no-collection-quantifier', {
	oracles: withoutOracle('O-007'),
})

/**
 * Rule 5: a parameter group naming a parameter no step binds. The operations
 * group stays witnessed on purpose: weakening it would take rule 3's witness
 * (O-004) or rule 7's (O-006) with it.
 */
const unaddressedParameterSibling = variant('unaddressed-parameter-sibling', {
	siblingGroups: {
		operations: [['create-thing', 'list-things']],
		parameters: [['limit', 'offset']],
	},
})

/**
 * Rule 6: the reference set stays named and the cardinality mode moves, so the
 * declared form is the injection while O-001 still spells the bijection. The
 * one unwitnessed contract that leaves its oracle in place. Rule 4 is
 * unaffected: `perRecordSatisfaction` reads the quantifier's collection
 * pointer and never the cardinality mode.
 */
const wrongCardinalityForm = variant('wrong-cardinality-form', {
	permittedInterfaces: withOperations(
		createThing,
		withDescriptor(listThings, {
			collectionLocations: [
				{
					pointer: '/items',
					expectedCardinality: { mode: 'page-bounded', max: 20 },
					referenceSet: 'expected-things',
				},
			],
		}),
	),
})

/** Rule 7: the read-back relation goes. Rule 5's operations group keeps O-004. */
const noReadBackRelation = variant('no-read-back-relation', {
	oracles: withoutOracle('O-006'),
})

export type CorpusCell = {
	readonly rule: DisciplineRule
	readonly state: DeclarationState
	readonly contractId: string
}

/**
 * One entry per rule per state, ordered by `DISCIPLINE_RULES` then by
 * `DECLARATION_STATES`, so a reader scanning it reads the coverage table's
 * rows in the order they are rendered. Twenty-eight, and the generator fails
 * if not. Written out by hand: derived from the contracts, fixtures 155 and
 * 157 could not fail.
 */
export const CORPUS_CELLS: readonly CorpusCell[] = [
	{
		rule: 'success-indicator-separation',
		state: 'absent',
		contractId: 'absent-success-indicator',
	},
	{
		rule: 'success-indicator-separation',
		state: 'explicitly-empty',
		contractId: 'empty-channel-roles',
	},
	{
		rule: 'success-indicator-separation',
		state: 'witnessed',
		contractId: 'satisfied-declarations',
	},
	{
		rule: 'success-indicator-separation',
		state: 'unwitnessed',
		contractId: 'split-indicator-oracle',
	},
	{
		rule: 'whole-body',
		state: 'absent',
		contractId: 'no-operation-inventory',
	},
	{
		rule: 'whole-body',
		state: 'explicitly-empty',
		contractId: 'single-required-response-key',
	},
	{
		rule: 'whole-body',
		state: 'witnessed',
		contractId: 'satisfied-declarations',
	},
	{
		rule: 'whole-body',
		state: 'unwitnessed',
		contractId: 'per-key-split-oracles',
	},
	{
		rule: 'malformed-input',
		state: 'absent',
		contractId: 'no-operation-inventory',
	},
	{
		rule: 'malformed-input',
		state: 'explicitly-empty',
		contractId: 'empty-request-shapes',
	},
	{
		rule: 'malformed-input',
		state: 'witnessed',
		contractId: 'satisfied-declarations',
	},
	{
		rule: 'malformed-input',
		state: 'unwitnessed',
		contractId: 'no-type-violating-step',
	},
	{
		rule: 'per-record',
		state: 'absent',
		contractId: 'absent-collection-locations',
	},
	{
		rule: 'per-record',
		state: 'explicitly-empty',
		contractId: 'empty-collection-locations',
	},
	{
		rule: 'per-record',
		state: 'witnessed',
		contractId: 'satisfied-declarations',
	},
	{
		rule: 'per-record',
		state: 'unwitnessed',
		contractId: 'no-collection-quantifier',
	},
	{
		rule: 'sibling-cross-check',
		state: 'absent',
		contractId: 'absent-sibling-groups',
	},
	{
		rule: 'sibling-cross-check',
		state: 'explicitly-empty',
		contractId: 'empty-sibling-groups',
	},
	{
		rule: 'sibling-cross-check',
		state: 'witnessed',
		contractId: 'satisfied-declarations',
	},
	{
		rule: 'sibling-cross-check',
		state: 'unwitnessed',
		contractId: 'unaddressed-parameter-sibling',
	},
	{
		rule: 'omission-and-completeness',
		state: 'absent',
		contractId: 'absent-collection-locations',
	},
	{
		rule: 'omission-and-completeness',
		state: 'explicitly-empty',
		contractId: 'unnamed-reference-set',
	},
	{
		rule: 'omission-and-completeness',
		state: 'witnessed',
		contractId: 'satisfied-declarations',
	},
	{
		rule: 'omission-and-completeness',
		state: 'unwitnessed',
		contractId: 'wrong-cardinality-form',
	},
	{
		rule: 'state-change-read-back',
		state: 'absent',
		contractId: 'no-operation-inventory',
	},
	{
		rule: 'state-change-read-back',
		state: 'explicitly-empty',
		contractId: 'no-state-change-marker',
	},
	{
		rule: 'state-change-read-back',
		state: 'witnessed',
		contractId: 'satisfied-declarations',
	},
	{
		rule: 'state-change-read-back',
		state: 'unwitnessed',
		contractId: 'no-read-back-relation',
	},
]

/**
 * Every distinct contract, in the order the emitted matrix reads them, which
 * is first appearance in `CORPUS_CELLS`. Written out for the reason
 * `CORPUS_CELLS` is: derived, fixture 158 could not fail.
 */
export const CORPUS_CONTRACTS: readonly EvalContract[] = [
	absentSuccessIndicator,
	emptyChannelRoles,
	seed,
	splitIndicatorOracle,
	noOperationInventory,
	singleRequiredResponseKey,
	perKeySplitOracles,
	emptyRequestShapes,
	noTypeViolatingStep,
	absentCollectionLocations,
	emptyCollectionLocations,
	noCollectionQuantifier,
	absentSiblingGroups,
	emptySiblingGroups,
	unaddressedParameterSibling,
	unnamedReferenceSet,
	wrongCardinalityForm,
	noStateChangeMarker,
	noReadBackRelation,
]
