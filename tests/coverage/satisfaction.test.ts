// AD-31's seven satisfaction predicates, one numbered fixture per assertion in
// Story 5.2 AC 8. Satisfaction is universal over the sites a rule fires on and
// existential over oracles, so most negatives remove one witness from
// `satisfiedContract` and most positives assert a reason as well: `satisfied`
// alone cannot tell a witnessed rule from a rule that stopped having a site.

import { describe, expect, it } from 'vitest'
import { compile } from '../../src/core/compile/compile.ts'
import { evaluateRelevance } from '../../src/core/coverage/relevance.ts'
import {
	DISCIPLINE_RULES,
	satisfactionPredicateId,
} from '../../src/core/coverage/rules.ts'
import {
	evaluateSatisfaction,
	NO_OPERATION_WITNESS,
	NO_RELEVANT_SITE,
	SATISFACTION_PREDICATES,
} from '../../src/core/coverage/satisfaction.ts'
import {
	EvalContract,
	SEVERITY_LEVELS,
} from '../../src/core/schemas/eval-contract.ts'
import { gateCContract } from '../schemas/fixtures/gate-c-contract.ts'
import {
	absentContract,
	explicitlyEmptyContract,
	populatedContract,
} from '../schemas/fixtures/relevance-contracts.ts'
import { satisfiedContract } from './fixtures/satisfaction-contracts.ts'

// Navigation over a cloned contract literal, before it is re-parsed. Mirrors
// `relevance.test.ts:36-48`; test files here do not import from each other.
const operationNamed = (contract: any, operationId: string) => {
	const operation = contract.permittedInterfaces
		.flatMap((declared: any) => declared.operations)
		.find((candidate: any) => candidate.operationId === operationId)
	if (!operation) throw new Error(`fixture declares no ${operationId}`)
	return operation
}

const descriptorOf = (contract: any, operationId: string) =>
	operationNamed(contract, operationId).responseDescriptor

const oracleNamed = (contract: any, oracleId: string) => {
	const oracle = contract.oracles.find(
		(candidate: any) => candidate.id === oracleId,
	)
	if (!oracle) throw new Error(`fixture declares no ${oracleId}`)
	return oracle
}

const stepNamed = (contract: any, stepId: string) => {
	const step = contract.interactionPlan.find(
		(candidate: any) => candidate.stepId === stepId,
	)
	if (!step) throw new Error(`fixture declares no step ${stepId}`)
	return step
}

/** A cloned fixture with the fewest mutations its shape needs. */
const mutantOf = (base: unknown, mutate: (contract: any) => void): any => {
	const contract = structuredClone(base) as any
	mutate(contract)
	return contract
}

/** The same, re-parsed, so the assertion speaks about a contract the schema accepts. */
const parsedMutant = (
	base: unknown,
	mutate: (contract: any) => void,
): EvalContract => EvalContract.parse(mutantOf(base, mutate))

// A fresh channel per call. `satisfaction-contracts.ts:20-24` builds several
// transport channels from one object and `structuredClone` keeps them aliased,
// so a rule 3 mutation replaces a channel; writing through one changes several.
const emptyChannel = () => ({
	requiredKeys: [] as string[],
	permittedKeys: [] as string[],
	types: {} as Record<string, string | null>,
})

const emptyRequestShape = () => ({
	path: emptyChannel(),
	query: emptyChannel(),
	header: emptyChannel(),
	body: emptyChannel(),
})

const satisfactionOf = (contract: unknown): readonly boolean[] =>
	evaluateSatisfaction(EvalContract.parse(contract)).map(
		(returned) => returned.satisfied,
	)

/** One rule's verdict out of the aggregate, so every fixture runs the same entry point. */
const verdictFor = (contract: EvalContract, rule: string) => {
	const returned = evaluateSatisfaction(contract).find(
		(candidate) => candidate.rule === rule,
	)
	if (!returned) throw new Error(`no verdict for ${rule}`)
	return returned
}

// AC 7's truth table, one column per whole-contract fixture, in
// `DISCIPLINE_RULES` order.
const ABSENT_COLUMN = [false, true, true, false, false, false, true]
const EXPLICITLY_EMPTY_COLUMN = [false, true, true, true, true, true, true]
const POPULATED_COLUMN = [false, false, false, false, false, false, false]
const GATE_C_COLUMN = [false, false, false, false, false, false, true]
const SATISFIED_COLUMN = [true, true, true, true, true, true, true]

// The witnessed reason of each rule, in `DISCIPLINE_RULES` order. Asserted
// verbatim rather than re-derived: a fixture that only asserts `satisfied`
// passes when the rule stops having a site.
const WITNESSED = {
	'success-indicator-separation':
		'every operation the rule fires on has an oracle reading its success indicator beside another roled pointer',
	'whole-body':
		'every operation declaring more than one required response key has an oracle covering all of them at one step',
	'malformed-input':
		'every operation declaring a request key has a type-violating step some check addresses',
	'per-record':
		'every declared collection location is the collection of some quantifier',
	'sibling-cross-check':
		'every declared sibling group has an oracle reading two of its members',
	'omission-and-completeness':
		'every collection location naming a reference set is reconciled against it in the declared form',
	'state-change-read-back':
		'every state-changing operation is read back through a later non-state-changing step',
} as const

const WHOLE_CONTRACTS = [
	{ name: 'absentContract', contract: absentContract },
	{ name: 'explicitlyEmptyContract', contract: explicitlyEmptyContract },
	{ name: 'populatedContract', contract: populatedContract },
	{ name: 'gateCContract', contract: gateCContract },
	{ name: 'satisfiedContract', contract: satisfiedContract },
] as const

describe('the aggregate over the five whole-contract fixtures', () => {
	it('59. returns one verdict per discipline rule, in registry order', () => {
		const verdicts = evaluateSatisfaction(EvalContract.parse(absentContract))
		expect(verdicts).toHaveLength(DISCIPLINE_RULES.length)
		expect(verdicts.map((returned) => returned.rule)).toEqual([
			...DISCIPLINE_RULES,
		])
	})

	it('60. absentContract answers AC 7’s absent column', () => {
		expect(satisfactionOf(absentContract)).toEqual(ABSENT_COLUMN)
	})

	it('61. explicitlyEmptyContract answers AC 7’s explicitly-empty column', () => {
		expect(satisfactionOf(explicitlyEmptyContract)).toEqual(
			EXPLICITLY_EMPTY_COLUMN,
		)
	})

	it('62. populatedContract answers AC 7’s populated column', () => {
		expect(satisfactionOf(populatedContract)).toEqual(POPULATED_COLUMN)
	})

	it('63. gateCContract answers AC 7’s Gate C column', () => {
		expect(satisfactionOf(gateCContract)).toEqual(GATE_C_COLUMN)
	})

	it('64. satisfiedContract answers AC 7’s all-satisfied column', () => {
		expect(satisfactionOf(satisfiedContract)).toEqual(SATISFIED_COLUMN)
	})

	it('65. every verdict carries the predicate identifier derived from its rule', () => {
		for (const { name, contract } of WHOLE_CONTRACTS) {
			for (const returned of evaluateSatisfaction(
				EvalContract.parse(contract),
			)) {
				expect(returned.predicate, name).toBe(
					satisfactionPredicateId(returned.rule),
				)
			}
		}
	})

	it('66. every verdict carries a non-empty reason', () => {
		for (const { name, contract } of WHOLE_CONTRACTS) {
			for (const returned of evaluateSatisfaction(
				EvalContract.parse(contract),
			)) {
				expect(
					returned.reason.length,
					`${name} ${returned.rule}`,
				).toBeGreaterThan(0)
			}
		}
	})

	it('67. a rule that is not relevant is satisfied, over every contract and rule', () => {
		// Decision 11's drift check: satisfaction enumerates sites per rule and
		// relevance short-circuits on the first one, so this fails the moment the
		// two disagree about which contracts have no site at all.
		for (const { name, contract } of WHOLE_CONTRACTS) {
			const parsed = EvalContract.parse(contract)
			const relevance = evaluateRelevance(parsed)
			const satisfaction = evaluateSatisfaction(parsed)
			for (const [index, rule] of DISCIPLINE_RULES.entries()) {
				const relevant = relevance[index]
				const satisfied = satisfaction[index]
				expect(relevant?.rule, `${name} ${rule}`).toBe(rule)
				expect(satisfied?.rule, `${name} ${rule}`).toBe(rule)
				if (relevant?.relevant === false) {
					expect(satisfied?.satisfied, `${name} ${rule}`).toBe(true)
				}
			}
		}
	})

	it('68. a vacuous satisfaction and a witnessed one carry different reasons', () => {
		for (const { name, contract } of WHOLE_CONTRACTS) {
			const parsed = EvalContract.parse(contract)
			const relevance = evaluateRelevance(parsed)
			const satisfaction = evaluateSatisfaction(parsed)
			for (const [index, rule] of DISCIPLINE_RULES.entries()) {
				const satisfied = satisfaction[index]
				if (satisfied?.satisfied !== true) continue
				if (relevance[index]?.relevant === false) {
					expect(satisfied.reason, `${name} ${rule}`).toBe(NO_RELEVANT_SITE)
				} else {
					expect(satisfied.reason, `${name} ${rule}`).not.toBe(NO_RELEVANT_SITE)
				}
			}
		}
	})
})

describe('satisfaction is decided from the declarations AD-31 names', () => {
	const base = evaluateSatisfaction(EvalContract.parse(satisfiedContract))

	it('69. deleting the waivers and the rubrics changes no verdict', () => {
		const mutant = parsedMutant(satisfiedContract, (contract) => {
			contract.waivers = []
			contract.rubrics = []
		})
		expect(evaluateSatisfaction(mutant)).toEqual(base)
	})

	it('70. rewriting every behaviour severity changes no verdict', () => {
		for (const severity of SEVERITY_LEVELS) {
			const mutant = parsedMutant(satisfiedContract, (contract) => {
				for (const behavior of contract.behaviors) behavior.severity = severity
			})
			expect(evaluateSatisfaction(mutant), severity).toEqual(base)
		}
	})

	it('71. rewriting every commentary, scope, and negative domain changes no verdict', () => {
		const mutant = parsedMutant(satisfiedContract, (contract) => {
			for (const oracle of contract.oracles) {
				oracle.commentary = 'rewritten author documentation'
				if (oracle.direction === null) continue
				oracle.direction.scope = 'rewritten scope'
				oracle.direction.negativeDomain = 'rewritten negative domain'
			}
		})
		expect(evaluateSatisfaction(mutant)).toEqual(base)
	})

	it('72. flipping every polarity changes no verdict', () => {
		const mutant = parsedMutant(satisfiedContract, (contract) => {
			for (const oracle of contract.oracles) {
				oracle.polarity = 'expects-violation'
				if (oracle.direction === null) continue
				oracle.direction.polarity = 'expects-violation'
			}
		})
		expect(evaluateSatisfaction(mutant)).toEqual(base)
	})

	it('73. rewriting every direction relation changes no verdict', () => {
		const mutant = parsedMutant(satisfiedContract, (contract) => {
			for (const oracle of contract.oracles) {
				if (oracle.direction === null) continue
				oracle.direction.relation = 'equality'
			}
		})
		expect(evaluateSatisfaction(mutant)).toEqual(base)
	})
})

describe('purity, totality, and the empty inventory', () => {
	it('74. two independent parses produce the same verdicts, and neither is mutated', () => {
		const contract = EvalContract.parse(satisfiedContract)
		const before = structuredClone(contract)
		expect(evaluateSatisfaction(contract)).toEqual(
			evaluateSatisfaction(EvalContract.parse(satisfiedContract)),
		)
		// A predicate writing to its input would write to both parses alike and
		// leave the arrays equal, so non-mutation is asserted separately.
		expect(contract).toStrictEqual(before)
	})

	it('75. the predicate map carries exactly the discipline rules', () => {
		// The mapped type already forbids a missing key and an extra one, so this
		// holds while that annotation stands. It catches the annotation being
		// loosened to `Record<string, ...>` later.
		expect(new Set(Object.keys(SATISFACTION_PREDICATES))).toEqual(
			new Set(DISCIPLINE_RULES),
		)
	})

	it('76. an empty operation inventory leaves the six operation-scoped rules unwitnessed', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			mutant.permittedInterfaces[0].operations = []
		})
		const verdicts = evaluateSatisfaction(contract)
		for (const rule of DISCIPLINE_RULES) {
			if (rule === 'sibling-cross-check') continue
			expect(
				verdicts.find((candidate) => candidate.rule === rule),
				rule,
			).toMatchObject({ satisfied: false, reason: NO_OPERATION_WITNESS })
		}
		// Rule 5 reads `siblingGroups` alone, so the inventory does not reach it.
		expect(verdictFor(contract, 'sibling-cross-check')).toMatchObject({
			satisfied: true,
			reason: WITNESSED['sibling-cross-check'],
		})
	})
})

describe('rule 1 — success-indicator separation', () => {
	const rule = 'success-indicator-separation'

	it('77. satisfiedContract is witnessed', () => {
		expect(
			verdictFor(EvalContract.parse(satisfiedContract), rule),
		).toMatchObject({ satisfied: true, reason: WITNESSED[rule] })
	})

	it('78. an operation nominating no indicator has no witness', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			descriptorOf(mutant, 'create-thing').successIndicator = null
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: false,
			reason:
				'operation create-thing nominates no success indicator, so no oracle can separate one from the body',
		})
	})

	it('79. an operation declaring no channel roles has no witness', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			descriptorOf(mutant, 'create-thing').channelRoles = null
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: false,
			reason:
				'operation create-thing declares no channel roles, so no pointer is declared to separate the indicator from',
		})
	})

	it('80. an operation whose only roled pointer is its indicator is not a site', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			descriptorOf(mutant, 'create-thing').channelRoles = {
				'/ok': 'success-indicator',
			}
		})
		// list-things is still a site and still witnessed by O-003.
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: true,
			reason: WITNESSED[rule],
		})
	})

	it('81. neither operation being a site is the vacuous case', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			descriptorOf(mutant, 'create-thing').channelRoles = {
				'/ok': 'success-indicator',
			}
			descriptorOf(mutant, 'list-things').channelRoles = {
				'/items': 'collection',
			}
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: true,
			reason: NO_RELEVANT_SITE,
		})
	})

	it('82. an operation whose other roled pointers are all indicators is a permanent gap', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			descriptorOf(mutant, 'create-thing').channelRoles = {
				'/ok': 'success-indicator',
				'/id': 'success-indicator',
			}
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: false,
			reason:
				"no oracle addresses operation create-thing's success indicator beside another roled pointer at one step, in both channels",
		})
	})

	it('83. a direction naming the indicator alone does not witness it', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			oracleNamed(mutant, 'O-002').direction.evidenceTargets = [
				'/interactions/create/response-body/ok',
			]
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: false,
			reason:
				"no oracle addresses operation create-thing's success indicator beside another roled pointer at one step, in both channels",
		})
	})

	it('84. a check reading the indicator alone does not witness it', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			// The direction keeps all three targets, so only the check half moves.
			oracleNamed(mutant, 'O-002').check = {
				op: 'existence',
				operands: [{ pointer: '/interactions/create/response-body/ok' }],
			}
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: false,
			reason:
				"no oracle addresses operation create-thing's success indicator beside another roled pointer at one step, in both channels",
		})
	})
})

describe('rule 2 — whole-body coverage', () => {
	const rule = 'whole-body'

	it('85. satisfiedContract is witnessed', () => {
		expect(
			verdictFor(EvalContract.parse(satisfiedContract), rule),
		).toMatchObject({ satisfied: true, reason: WITNESSED[rule] })
	})

	it('86. one distinct required key on every operation is not a site', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			descriptorOf(mutant, 'create-thing').requiredKeys = ['ok']
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: true,
			reason: NO_RELEVANT_SITE,
		})
	})

	it('87. an oracle short of one required key does not cover the body', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			const oracle = oracleNamed(mutant, 'O-002')
			oracle.direction.evidenceTargets = [
				'/interactions/create/response-body/ok',
				'/interactions/create/response-body/error',
			]
			oracle.check.operands = oracle.check.operands.filter(
				(operand: any) =>
					operand.operands[0].pointer !==
					'/interactions/create/response-body/id',
			)
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: false,
			reason:
				'no oracle covers every required response key of operation create-thing at one addressed step, in both channels',
		})
	})

	it('88. a permitted key is never in the denominator', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			descriptorOf(mutant, 'create-thing').permittedKeys.push('note')
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: true,
			reason: WITNESSED[rule],
		})
	})

	it('89. one required key repeated is one pointer, so the operation is not a site', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			descriptorOf(mutant, 'create-thing').requiredKeys = ['ok', 'ok']
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: true,
			reason: NO_RELEVANT_SITE,
		})
	})

	it('90. two oracles covering one key each do not cover the body between them', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			const oracle = oracleNamed(mutant, 'O-002')
			oracle.direction.evidenceTargets = [
				'/interactions/create/response-body/ok',
			]
			oracle.check = {
				op: 'existence',
				operands: [{ pointer: '/interactions/create/response-body/ok' }],
			}
			mutant.oracles.push({
				id: 'O-008',
				direction: {
					evidenceTargets: ['/interactions/create/response-body/id'],
					relation: 'existence',
					polarity: 'expects-hold',
					scope: 'The identifier the create returned.',
					negativeDomain: 'A create reporting success with no identifier.',
				},
				check: {
					op: 'existence',
					operands: [{ pointer: '/interactions/create/response-body/id' }],
				},
				polarity: 'expects-hold',
				commentary: null,
			})
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: false,
			reason:
				'no oracle covers every required response key of operation create-thing at one addressed step, in both channels',
		})
	})

	it('91. an operation no step invokes has no addressed step to be covered at', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			mutant.interactionPlan = mutant.interactionPlan.filter(
				(step: any) => step.operationId !== 'create-thing',
			)
			stepNamed(mutant, 'list').after = null
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: false,
			reason:
				'no oracle covers every required response key of operation create-thing at one addressed step, in both channels',
		})
	})

	it('92. a pointer descending into a required key addresses it', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			const oracle = oracleNamed(mutant, 'O-002')
			oracle.direction.evidenceTargets[0] =
				'/interactions/create/response-body/ok/inner'
			oracle.check.operands[0].operands[0].pointer =
				'/interactions/create/response-body/ok/inner'
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: true,
			reason: WITNESSED[rule],
		})
	})
})

describe('rule 3 — malformed input', () => {
	const rule = 'malformed-input'

	it('93. satisfiedContract is witnessed', () => {
		expect(
			verdictFor(EvalContract.parse(satisfiedContract), rule),
		).toMatchObject({ satisfied: true, reason: WITNESSED[rule] })
	})

	it('94. a step binding no type-violating matcher does not witness the rule', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			stepNamed(mutant, 'malformed-create').inputBinding.body = {
				name: { matcher: 'any' },
			}
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: false,
			reason:
				'no step invoking operation create-thing binds a type-violating matcher under a check that addresses it',
		})
	})

	it('95. a type-violating step no check addresses does not witness the rule', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			const check = oracleNamed(mutant, 'O-004').check
			check.operands[0].operands[0].pointer =
				'/interactions/malformed-list/response-body/error'
			check.operands[1].operands[0].pointer =
				'/interactions/malformed-list/response-body/items'
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: false,
			reason:
				'no step invoking operation create-thing binds a type-violating matcher under a check that addresses it',
		})
	})

	it('96. an operation declaring no request key at all is not a site', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			operationNamed(mutant, 'create-thing').requestShape = emptyRequestShape()
			operationNamed(mutant, 'list-things').requestShape = emptyRequestShape()
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: true,
			reason: NO_RELEVANT_SITE,
		})
	})

	it('97. a channel declaring a type and no key is still a site', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			// Only the `types` clause makes create-thing a site, and list-things is
			// emptied so it cannot witness the rule in create-thing's place.
			operationNamed(mutant, 'create-thing').requestShape.body = {
				...emptyChannel(),
				types: { name: 'string' },
			}
			operationNamed(mutant, 'list-things').requestShape = emptyRequestShape()
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: true,
			reason: WITNESSED[rule],
		})
	})
})

describe('rule 4 — per-record checking', () => {
	const rule = 'per-record'

	it('98. satisfiedContract is witnessed', () => {
		expect(
			verdictFor(EvalContract.parse(satisfiedContract), rule),
		).toMatchObject({ satisfied: true, reason: WITNESSED[rule] })
	})

	it('99. an absent collection-location list has no witness', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			descriptorOf(mutant, 'create-thing').collectionLocations = null
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: false,
			reason:
				'operation create-thing declares no collection-location list, so no quantifier can range over a declared collection',
		})
	})

	it('100. a quantifier ranging inside the declared collection does not witness it', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			oracleNamed(mutant, 'O-007').check.collection.pointer =
				'/interactions/list/response-body/items/page'
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: false,
			reason:
				'no check quantifies over collection /items of operation list-things',
		})
	})

	it('101. a declared collection inside the quantifier’s range is not witnessed either', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			descriptorOf(mutant, 'list-things').collectionLocations[0].pointer =
				'/items/rows'
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: false,
			reason:
				'no check quantifies over collection /items/rows of operation list-things',
		})
	})

	it('102. a disjoint declared collection has no quantifier', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			descriptorOf(mutant, 'list-things').collectionLocations[0].pointer =
				'/other'
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: false,
			reason:
				'no check quantifies over collection /other of operation list-things',
		})
	})

	it('103. either quantifier witnesses the rule', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			oracleNamed(mutant, 'O-007').check.op = 'for-any'
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: true,
			reason: WITNESSED[rule],
		})
	})

	it('104. a pointer at a collection is not a quantifier over it', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			oracleNamed(mutant, 'O-007').check = {
				op: 'existence',
				operands: [{ pointer: '/interactions/list/response-body/items' }],
			}
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: false,
			reason:
				'no check quantifies over collection /items of operation list-things',
		})
	})

	it('105. explicitly empty collection-location lists are not a site', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			descriptorOf(mutant, 'create-thing').collectionLocations = []
			descriptorOf(mutant, 'list-things').collectionLocations = []
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: true,
			reason: NO_RELEVANT_SITE,
		})
	})
})

describe('rule 5 — sibling cross-check', () => {
	const rule = 'sibling-cross-check'

	it('106. satisfiedContract is witnessed', () => {
		expect(
			verdictFor(EvalContract.parse(satisfiedContract), rule),
		).toMatchObject({ satisfied: true, reason: WITNESSED[rule] })
	})

	it('107. the operation axis alone is one witnessed site', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			mutant.siblingGroups.parameters = []
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: true,
			reason: WITNESSED[rule],
		})
	})

	it('108. one operation named twice is one member', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			mutant.siblingGroups.operations = [['create-thing', 'create-thing']]
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: false,
			reason:
				'no oracle addresses two members of the operation sibling group create-thing in both channels',
		})
	})

	it('109. an oracle whose direction names nothing witnesses no group', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			// O-004, O-005, and O-006 are the only oracles whose targets span a step
			// of each operation; reducing one alone leaves the group witnessed.
			for (const oracleId of ['O-004', 'O-005', 'O-006']) {
				oracleNamed(mutant, oracleId).direction.evidenceTargets = []
			}
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: false,
			reason:
				'no oracle addresses two members of the operation sibling group create-thing and list-things in both channels',
		})
	})

	it('110. the parameter axis is a site of its own', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			// O-006 carries `name` and no oracle carries `limit`, so the group falls
			// one member short once O-005 is gone.
			mutant.oracles = mutant.oracles.filter(
				(oracle: any) => oracle.id !== 'O-005',
			)
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: false,
			reason:
				'no oracle addresses two members of the parameter sibling group limit and name in both channels',
		})
	})

	it('111. absent sibling groups have nothing to cross-check', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			mutant.siblingGroups = null
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: false,
			reason:
				'the contract declares no sibling groups, so no group is declared to cross-check',
		})
	})

	it('112. explicitly empty sibling groups are not a site', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			mutant.siblingGroups = { operations: [], parameters: [] }
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: true,
			reason: NO_RELEVANT_SITE,
		})
	})
})

describe('rule 6 — omission and completeness', () => {
	const rule = 'omission-and-completeness'

	// The injection form: `for-all` over the page whose predicate is
	// `set-membership` against the declared reference set.
	const injectionCheck = (setOperand: unknown) => ({
		op: 'for-all',
		collection: { pointer: '/interactions/list/response-body/items' },
		predicate: {
			op: 'set-membership',
			operands: [{ pointer: '@/id' }, setOperand],
		},
	})

	const asInjection = (mutant: any, setOperand: unknown) => {
		const oracle = oracleNamed(mutant, 'O-001')
		oracle.check = injectionCheck(setOperand)
		oracle.direction.relation = 'for-all'
	}

	it('113. satisfiedContract is witnessed by the bijection against an exact cardinality', () => {
		expect(
			verdictFor(EvalContract.parse(satisfiedContract), rule),
		).toMatchObject({ satisfied: true, reason: WITNESSED[rule] })
	})

	it('114. the bijection does not reconcile a page-bounded collection', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			descriptorOf(
				mutant,
				'list-things',
			).collectionLocations[0].expectedCardinality = {
				mode: 'page-bounded',
				max: 20,
			}
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: false,
			reason:
				'no check reconciles collection /items of operation list-things against reference set expected-things in the form its page-bounded cardinality requires',
		})
	})

	it('115. the injection reconciles a page-bounded collection', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			descriptorOf(
				mutant,
				'list-things',
			).collectionLocations[0].expectedCardinality = {
				mode: 'page-bounded',
				max: 20,
			}
			asInjection(mutant, { referenceSet: 'expected-things' })
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: true,
			reason: WITNESSED[rule],
		})
	})

	it('116. at-most takes the same branch as page-bounded', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			descriptorOf(
				mutant,
				'list-things',
			).collectionLocations[0].expectedCardinality = {
				mode: 'at-most',
				max: 20,
			}
			asInjection(mutant, { referenceSet: 'expected-things' })
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: true,
			reason: WITNESSED[rule],
		})
	})

	it('117. the injection does not reconcile an exact cardinality', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			asInjection(mutant, { referenceSet: 'expected-things' })
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: false,
			reason:
				'no check reconciles collection /items of operation list-things against reference set expected-things in the form its exact cardinality requires',
		})
	})

	it('118. a reference set the location does not name reconciles nothing', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			oracleNamed(mutant, 'O-001').check.operands[0].referenceSet =
				'expected-other'
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: false,
			reason:
				'no check reconciles collection /items of operation list-things against reference set expected-things in the form its exact cardinality requires',
		})
	})

	it('119. a literal set operand is not the declared reference set', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			descriptorOf(
				mutant,
				'list-things',
			).collectionLocations[0].expectedCardinality = {
				mode: 'page-bounded',
				max: 20,
			}
			asInjection(mutant, { literal: ['t-1', 't-2', 't-3'] })
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: false,
			reason:
				'no check reconciles collection /items of operation list-things against reference set expected-things in the form its page-bounded cardinality requires',
		})
	})

	it('120. a location naming no reference set is not a site', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			descriptorOf(mutant, 'list-things').collectionLocations[0].referenceSet =
				null
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: true,
			reason: NO_RELEVANT_SITE,
		})
	})

	it('121. an absent collection-location list has no witness', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			descriptorOf(mutant, 'create-thing').collectionLocations = null
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: false,
			reason:
				'operation create-thing declares no collection-location list, so no location can be reconciled against a reference set',
		})
	})
})

describe('rule 7 — state change read-back', () => {
	const rule = 'state-change-read-back'

	it('122. satisfiedContract is witnessed', () => {
		expect(
			verdictFor(EvalContract.parse(satisfiedContract), rule),
		).toMatchObject({ satisfied: true, reason: WITNESSED[rule] })
	})

	it('123. without the temporal clause the later step is not a read-back', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			stepNamed(mutant, 'list').after = null
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: false,
			reason:
				"no check relates operation create-thing's call inputs to the response body of a later step that changes no state",
		})
	})

	it('124. a read-back through a state-changing step proves nothing', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			operationNamed(mutant, 'list-things').stateChangeMarker = true
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: false,
			reason:
				"no check relates operation create-thing's call inputs to the response body of a later step that changes no state",
		})
	})

	it('125. the same two pointers split across two nodes relate nothing', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			oracleNamed(mutant, 'O-006').check = {
				op: 'all',
				operands: [
					{
						op: 'existence',
						operands: [
							{ pointer: '/interactions/create/call-inputs/body/name' },
						],
					},
					{
						op: 'existence',
						operands: [{ pointer: '/interactions/list/response-body/items' }],
					},
				],
			}
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: false,
			reason:
				"no check relates operation create-thing's call inputs to the response body of a later step that changes no state",
		})
	})

	it('126. no operation marked as state-changing is not a site', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			operationNamed(mutant, 'create-thing').stateChangeMarker = false
		})
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: true,
			reason: NO_RELEVANT_SITE,
		})
	})

	it('127. an operation on a second interface is still in the inventory', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			const [first] = mutant.permittedInterfaces
			const createThing = operationNamed(mutant, 'create-thing')
			first.operations = first.operations.filter(
				(operation: any) => operation.operationId !== 'create-thing',
			)
			mutant.permittedInterfaces.push({
				logicalId: 'other-api',
				kind: 'api',
				operations: [createThing],
			})
		})
		// The witnessed reason is the assertion: under an `operationsOf` that reads
		// only the first interface, create-thing vanishes and the rule answers
		// satisfied for having no site at all.
		expect(verdictFor(contract, rule)).toMatchObject({
			satisfied: true,
			reason: WITNESSED[rule],
		})
	})
})

describe('the fixture contract itself', () => {
	it('128. satisfiedContract compiles clean', () => {
		expect(() =>
			compile(EvalContract.parse(satisfiedContract), { strict: false }),
		).not.toThrow()
	})

	it('129. satisfiedContract is relevant on all seven rules', () => {
		const relevance = evaluateRelevance(EvalContract.parse(satisfiedContract))
		expect(relevance.map((returned) => returned.relevant)).toEqual([
			true,
			true,
			true,
			true,
			true,
			true,
			true,
		])
	})
})

// Fixtures 132 through 150 close the holes the implementation code review found
// by mutation: each one fails under a relaxation of the predicates that every
// fixture above survives. They are grouped rather than filed under their rules
// so the numbering stays monotonic in this file; the rule each pins opens its
// name. The finding each closes is recorded in the story's Review Findings.
describe('holes the implementation code review found', () => {
	it('132. rule 1 — two oracles reading one pointer each do not separate the indicator', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			const oracle = oracleNamed(mutant, 'O-002')
			oracle.direction.evidenceTargets = [
				'/interactions/create/response-body/ok',
			]
			oracle.check = {
				op: 'existence',
				operands: [{ pointer: '/interactions/create/response-body/ok' }],
			}
			mutant.oracles.push({
				id: 'O-008',
				direction: {
					evidenceTargets: ['/interactions/create/response-body/id'],
					relation: 'existence',
					polarity: 'expects-hold',
					scope: 'The identifier the create returned.',
					negativeDomain: 'A create reporting success with no identifier.',
				},
				check: {
					op: 'existence',
					operands: [{ pointer: '/interactions/create/response-body/id' }],
				},
				polarity: 'expects-hold',
				commentary: null,
			})
		})
		expect(verdictFor(contract, 'success-indicator-separation')).toMatchObject({
			satisfied: false,
			reason:
				"no oracle addresses operation create-thing's success indicator beside another roled pointer at one step, in both channels",
		})
	})

	it('133. rule 1 — the indicator carrying a role of its own is not another roled pointer', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			// `/ok` is nominated and roled `payload`, so it passes the role clause
			// and only the pointer clause keeps it out of `others`.
			descriptorOf(mutant, 'create-thing').channelRoles = {
				'/ok': 'payload',
				'/error': 'diagnostic',
			}
			const oracle = oracleNamed(mutant, 'O-002')
			oracle.direction.evidenceTargets = [
				'/interactions/create/response-body/ok',
			]
			oracle.check = {
				op: 'existence',
				operands: [{ pointer: '/interactions/create/response-body/ok' }],
			}
		})
		expect(verdictFor(contract, 'success-indicator-separation')).toMatchObject({
			satisfied: false,
			reason:
				"no oracle addresses operation create-thing's success indicator beside another roled pointer at one step, in both channels",
		})
	})

	it('134. rule 1 — the indicator and the other pointer must be read at one step', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			// One oracle, both pointers, two different steps of the same operation.
			const oracle = oracleNamed(mutant, 'O-002')
			oracle.direction.evidenceTargets = [
				'/interactions/create/response-body/ok',
				'/interactions/malformed-create/response-body/id',
			]
			oracle.check = {
				op: 'all',
				operands: [
					{
						op: 'existence',
						operands: [{ pointer: '/interactions/create/response-body/ok' }],
					},
					{
						op: 'existence',
						operands: [
							{ pointer: '/interactions/malformed-create/response-body/id' },
						],
					},
				],
			}
		})
		expect(verdictFor(contract, 'success-indicator-separation')).toMatchObject({
			satisfied: false,
			reason:
				"no oracle addresses operation create-thing's success indicator beside another roled pointer at one step, in both channels",
		})
	})

	it('135. rule 2 — a sibling key sharing a prefix does not address the required key', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			// `okay` starts with `ok`, so a prefix test with no `/` boundary would
			// read this as covering the required key `ok`.
			const oracle = oracleNamed(mutant, 'O-002')
			oracle.direction.evidenceTargets[0] =
				'/interactions/create/response-body/okay'
			oracle.check.operands[0].operands[0].pointer =
				'/interactions/create/response-body/okay'
		})
		expect(verdictFor(contract, 'whole-body')).toMatchObject({
			satisfied: false,
			reason:
				'no oracle covers every required response key of operation create-thing at one addressed step, in both channels',
		})
	})

	it('136. rule 2 — the required keys must be covered at one step', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			const oracle = oracleNamed(mutant, 'O-002')
			oracle.direction.evidenceTargets = [
				'/interactions/create/response-body/ok',
				'/interactions/malformed-create/response-body/id',
			]
			oracle.check = {
				op: 'all',
				operands: [
					{
						op: 'existence',
						operands: [{ pointer: '/interactions/create/response-body/ok' }],
					},
					{
						op: 'existence',
						operands: [
							{ pointer: '/interactions/malformed-create/response-body/id' },
						],
					},
				],
			}
		})
		expect(verdictFor(contract, 'whole-body')).toMatchObject({
			satisfied: false,
			reason:
				'no oracle covers every required response key of operation create-thing at one addressed step, in both channels',
		})
	})

	it('137. rule 2 — a required key holding a slash is addressed through RFC 6901 escaping', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			const descriptor = descriptorOf(mutant, 'create-thing')
			descriptor.requiredKeys = ['id', 'a/b']
			descriptor.permittedKeys = ['id', 'a/b', 'ok', 'error']
			descriptor.types = { ...descriptor.types, 'a/b': 'string' }
			const oracle = oracleNamed(mutant, 'O-002')
			oracle.direction.evidenceTargets.push(
				'/interactions/create/response-body/a~1b',
			)
			oracle.check.operands.push({
				op: 'existence',
				operands: [{ pointer: '/interactions/create/response-body/a~1b' }],
			})
		})
		// `~1` is the escape for `/`. Without it the pointer reads as two tokens
		// and no oracle covers the key.
		expect(verdictFor(contract, 'whole-body')).toMatchObject({
			satisfied: true,
			reason: WITNESSED['whole-body'],
		})
	})

	it('138. rule 4 — a nested quantifier ranges over the element the outer one binds', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			descriptorOf(mutant, 'list-things').collectionLocations.push({
				pointer: '/items/rows',
				expectedCardinality: { mode: 'exact', count: 1 },
				referenceSet: null,
			})
			oracleNamed(mutant, 'O-007').check = {
				op: 'for-all',
				collection: { pointer: '/interactions/list/response-body/items' },
				predicate: {
					op: 'for-all',
					// Resolves to `/interactions/list/response-body/items/rows` only
					// once the outer collection is threaded in as the bound root.
					collection: { pointer: '@/rows' },
					predicate: { op: 'existence', operands: [{ pointer: '@/id' }] },
				},
			}
		})
		expect(verdictFor(contract, 'per-record')).toMatchObject({
			satisfied: true,
			reason: WITNESSED['per-record'],
		})
	})

	it('139. rule 5 — an oracle whose check reads nothing of the group witnesses no operation group', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			// Directions stay intact; only the checks move off the two operations,
			// which is the conjunct fixture 109 leaves unpinned.
			for (const oracleId of ['O-004', 'O-005', 'O-006']) {
				oracleNamed(mutant, oracleId).check = {
					op: 'existence',
					operands: [
						{ pointer: '/interactions/malformed-list/response-status' },
					],
				}
			}
		})
		expect(verdictFor(contract, 'sibling-cross-check')).toMatchObject({
			satisfied: false,
			reason:
				'no oracle addresses two members of the operation sibling group create-thing and list-things in both channels',
		})
	})

	it('140. rule 5 — a parameter group needs its members in the direction too', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			mutant.siblingGroups.operations = []
			oracleNamed(mutant, 'O-005').direction.evidenceTargets = []
		})
		expect(verdictFor(contract, 'sibling-cross-check')).toMatchObject({
			satisfied: false,
			reason:
				'no oracle addresses two members of the parameter sibling group limit and name in both channels',
		})
	})

	it('141. rule 5 — a parameter group needs its members in the check too', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			mutant.siblingGroups.operations = []
			oracleNamed(mutant, 'O-005').check = {
				op: 'existence',
				operands: [{ pointer: '/interactions/list/response-status' }],
			}
		})
		expect(verdictFor(contract, 'sibling-cross-check')).toMatchObject({
			satisfied: false,
			reason:
				'no oracle addresses two members of the parameter sibling group limit and name in both channels',
		})
	})

	it('142. rule 5 — one parameter named twice is one member', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			mutant.siblingGroups.operations = []
			mutant.siblingGroups.parameters = [['limit', 'limit']]
		})
		expect(verdictFor(contract, 'sibling-cross-check')).toMatchObject({
			satisfied: false,
			reason:
				'no oracle addresses two members of the parameter sibling group limit in both channels',
		})
	})

	it('143. rule 6 — the bijection must be taken against the declared collection', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			oracleNamed(mutant, 'O-001').check.operands[1].pointer =
				'/interactions/list/response-body/other'
		})
		expect(verdictFor(contract, 'omission-and-completeness')).toMatchObject({
			satisfied: false,
			reason:
				'no check reconciles collection /items of operation list-things against reference set expected-things in the form its exact cardinality requires',
		})
	})

	it('144. rule 6 — the injection must quantify over the declared collection', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			descriptorOf(
				mutant,
				'list-things',
			).collectionLocations[0].expectedCardinality = {
				mode: 'page-bounded',
				max: 20,
			}
			const oracle = oracleNamed(mutant, 'O-001')
			oracle.direction.relation = 'for-all'
			oracle.check = {
				op: 'for-all',
				collection: { pointer: '/interactions/list/response-body/other' },
				predicate: {
					op: 'set-membership',
					operands: [{ pointer: '@/id' }, { referenceSet: 'expected-things' }],
				},
			}
		})
		expect(verdictFor(contract, 'omission-and-completeness')).toMatchObject({
			satisfied: false,
			reason:
				'no check reconciles collection /items of operation list-things against reference set expected-things in the form its page-bounded cardinality requires',
		})
	})

	it('145. rule 7 — the write step must be one that invokes the marked operation', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			// create-thing stays declared and marked, and no step invokes it. The
			// read-back below is a complete one between two other steps.
			mutant.interactionPlan = mutant.interactionPlan.filter(
				(step: any) => step.operationId !== 'create-thing',
			)
			stepNamed(mutant, 'list').after = null
			mutant.interactionPlan.push({
				stepId: 'verify',
				operationId: 'list-things',
				inputBinding: {
					path: null,
					query: { limit: { literal: 10 } },
					header: null,
					body: null,
				},
				after: 'list',
				cardinality: 'exactly-one',
			})
			oracleNamed(mutant, 'O-006').check = {
				op: 'containment',
				operands: [
					{ pointer: '/interactions/verify/response-body/items' },
					{ pointer: '/interactions/list/call-inputs/query/limit' },
				],
			}
		})
		expect(verdictFor(contract, 'state-change-read-back')).toMatchObject({
			satisfied: false,
			reason:
				"no check relates operation create-thing's call inputs to the response body of a later step that changes no state",
		})
	})

	it('146. rule 7 — the read side is the later step’s response body, not its call inputs', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			oracleNamed(mutant, 'O-006').check = {
				op: 'containment',
				operands: [
					{ pointer: '/interactions/list/call-inputs/query/limit' },
					{ pointer: '/interactions/create/call-inputs/body/name' },
				],
			}
		})
		expect(verdictFor(contract, 'state-change-read-back')).toMatchObject({
			satisfied: false,
			reason:
				"no check relates operation create-thing's call inputs to the response body of a later step that changes no state",
		})
	})

	it('147. an oracle declaring no direction names no evidence target', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			oracleNamed(mutant, 'O-002').direction = null
		})
		expect(verdictFor(contract, 'success-indicator-separation')).toMatchObject({
			satisfied: false,
			reason:
				"no oracle addresses operation create-thing's success indicator beside another roled pointer at one step, in both channels",
		})
	})

	it('148. an oracle declaring no check reads no pointer', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			oracleNamed(mutant, 'O-007').check = null
		})
		expect(verdictFor(contract, 'per-record')).toMatchObject({
			satisfied: false,
			reason:
				'no check quantifies over collection /items of operation list-things',
		})
	})

	it('149. a duplicated operation identifier resolves to nothing and throws nothing', () => {
		const contract = parsedMutant(satisfiedContract, (mutant) => {
			const [first] = mutant.permittedInterfaces
			mutant.permittedInterfaces.push({
				logicalId: 'other-api',
				kind: 'api',
				operations: [
					structuredClone(
						first.operations.find(
							(operation: any) => operation.operationId === 'list-things',
						),
					),
				],
			})
		})
		// Decision 13: `unresolved` removes the ambiguous identifier from lookup,
		// so the read-back step's operation no longer resolves and rule 7 fails
		// closed. The default `throw` option would break the module's own header.
		expect(() => evaluateSatisfaction(contract)).not.toThrow()
		expect(verdictFor(contract, 'state-change-read-back')).toMatchObject({
			satisfied: false,
			reason:
				"no check relates operation create-thing's call inputs to the response body of a later step that changes no state",
		})
	})

	it('150. gateCContract’s rule 1 and rule 5 reasons name the sites AC 7 says decide them', () => {
		const contract = EvalContract.parse(gateCContract)
		// AC 7 spends a paragraph on each: rule 1 returns on the first operation in
		// the flattened inventory, and rule 5's second site is the parameter group.
		expect(verdictFor(contract, 'success-indicator-separation')).toMatchObject({
			satisfied: false,
			reason:
				"no oracle addresses operation submit-export's success indicator beside another roled pointer at one step, in both channels",
		})
		expect(verdictFor(contract, 'sibling-cross-check')).toMatchObject({
			satisfied: false,
			reason:
				'no oracle addresses two members of the parameter sibling group cursor and limit in both channels',
		})
	})
})
