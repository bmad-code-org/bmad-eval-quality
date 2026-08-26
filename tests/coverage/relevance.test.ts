// AD-31's seven relevance predicates, one numbered fixture per assertion in
// Story 5.1 AC 7. AD-31 grades an absent declaration relevant and an explicitly
// empty one as an answer, so many fixtures come in pairs that differ only in
// that spelling.

import { describe, expect, it } from 'vitest'
import {
	evaluateRelevance,
	malformedInputRelevance,
	NO_OPERATION,
	omissionAndCompletenessRelevance,
	perRecordRelevance,
	RELEVANCE_PREDICATES,
	siblingCrossCheckRelevance,
	stateChangeReadBackRelevance,
	successIndicatorSeparationRelevance,
	wholeBodyRelevance,
} from '../../src/core/coverage/relevance.ts'
import {
	DISCIPLINE_RULES,
	relevancePredicateId,
} from '../../src/core/coverage/rules.ts'
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

// Navigation over a cloned contract literal, before it is re-parsed.
// `relevance-axes.test.ts:21-37` holds an equivalent private copy that reads
// through the parser. Test files here do not import from each other.
const firstOperation = (contract: any) =>
	contract.permittedInterfaces[0].operations[0]

const firstDescriptor = (contract: any) =>
	firstOperation(contract).responseDescriptor

const operationNamed = (contract: any, operationId: string) => {
	const operation = contract.permittedInterfaces
		.flatMap((declared: any) => declared.operations)
		.find((candidate: any) => candidate.operationId === operationId)
	if (!operation) throw new Error(`fixture declares no ${operationId}`)
	return operation
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

// A fresh channel per call. `relevance-contracts.ts:8-19` builds all four
// transport channels from one object and `structuredClone` keeps them aliased,
// so a rule 3 mutation replaces a channel; writing through one changes all four.
const emptyChannel = () => ({
	requiredKeys: [] as string[],
	permittedKeys: [] as string[],
	types: {} as Record<string, string | null>,
})

/** A collection location. `expectedCardinality` is required by the schema and unread here. */
const collectionLocation = (pointer: string, referenceSet: string | null) => ({
	pointer,
	expectedCardinality: { mode: 'exact', count: 1 },
	referenceSet,
})

const relevanceOf = (contract: unknown): readonly boolean[] =>
	evaluateRelevance(EvalContract.parse(contract)).map(
		(returned) => returned.relevant,
	)

// AC 6's truth table, one column per whole-contract fixture, in
// `DISCIPLINE_RULES` order.
const ABSENT_COLUMN = [true, false, false, true, true, true, false]
const EXPLICITLY_EMPTY_COLUMN = [true, false, false, false, false, false, false]
// Both all-true, so these two catch a fail-closed regression. The columns above
// and the per-rule negatives catch fail-open.
const POPULATED_COLUMN = [true, true, true, true, true, true, true]
const GATE_C_COLUMN = [true, true, true, true, true, true, true]

const WHOLE_CONTRACTS = [
	{ name: 'absentContract', contract: absentContract },
	{ name: 'explicitlyEmptyContract', contract: explicitlyEmptyContract },
	{ name: 'populatedContract', contract: populatedContract },
	{ name: 'gateCContract', contract: gateCContract },
] as const

describe('the aggregate over the four whole-contract fixtures', () => {
	it('1. returns one verdict per discipline rule, in registry order', () => {
		const verdicts = evaluateRelevance(EvalContract.parse(absentContract))
		expect(verdicts).toHaveLength(DISCIPLINE_RULES.length)
		expect(verdicts.map((returned) => returned.rule)).toEqual([
			...DISCIPLINE_RULES,
		])
	})

	it('2. absentContract answers AC 6’s absent column', () => {
		expect(relevanceOf(absentContract)).toEqual(ABSENT_COLUMN)
	})

	it('3. explicitlyEmptyContract answers AC 6’s explicitly-empty column', () => {
		expect(relevanceOf(explicitlyEmptyContract)).toEqual(
			EXPLICITLY_EMPTY_COLUMN,
		)
	})

	it('4. populatedContract answers AC 6’s populated column', () => {
		expect(relevanceOf(populatedContract)).toEqual(POPULATED_COLUMN)
	})

	it('5. gateCContract answers AC 6’s Gate C column', () => {
		expect(relevanceOf(gateCContract)).toEqual(GATE_C_COLUMN)
	})

	it('6. every verdict carries the predicate identifier derived from its rule', () => {
		for (const { name, contract } of WHOLE_CONTRACTS) {
			for (const returned of evaluateRelevance(EvalContract.parse(contract))) {
				expect(returned.predicate, name).toBe(
					relevancePredicateId(returned.rule),
				)
			}
		}
	})

	it('7. every verdict carries a non-empty reason', () => {
		for (const { name, contract } of WHOLE_CONTRACTS) {
			for (const returned of evaluateRelevance(EvalContract.parse(contract))) {
				expect(
					returned.reason.length,
					`${name} ${returned.rule}`,
				).toBeGreaterThan(0)
			}
		}
	})
})

describe('relevance is decided from declarations alone', () => {
	it('8. deleting populatedContract’s oracles changes no verdict', () => {
		const base = evaluateRelevance(EvalContract.parse(populatedContract))
		const mutant = parsedMutant(populatedContract, (contract) => {
			contract.oracles = []
		})
		expect(evaluateRelevance(mutant)).toEqual(base)
	})

	it('9. deleting gateCContract’s oracles changes no verdict', () => {
		const base = evaluateRelevance(EvalContract.parse(gateCContract))
		const mutant = parsedMutant(gateCContract, (contract) => {
			contract.oracles = []
		})
		expect(evaluateRelevance(mutant)).toEqual(base)
	})

	it('10. deleting the interaction plan changes no verdict', () => {
		const base = evaluateRelevance(EvalContract.parse(populatedContract))
		const mutant = parsedMutant(populatedContract, (contract) => {
			contract.interactionPlan = []
		})
		expect(evaluateRelevance(mutant)).toEqual(base)
	})

	it('11. deleting the waivers and the rubrics changes no verdict', () => {
		const base = evaluateRelevance(EvalContract.parse(populatedContract))
		const mutant = parsedMutant(populatedContract, (contract) => {
			contract.waivers = []
			contract.rubrics = []
		})
		expect(evaluateRelevance(mutant)).toEqual(base)
	})

	it('12. rewriting every behaviour severity changes no verdict', () => {
		const base = evaluateRelevance(EvalContract.parse(populatedContract))
		// populatedContract's one behaviour is already `critical`, so that one
		// rewrite asserts nothing. This walks all three levels.
		for (const severity of SEVERITY_LEVELS) {
			const mutant = parsedMutant(populatedContract, (contract) => {
				for (const behavior of contract.behaviors) behavior.severity = severity
			})
			expect(evaluateRelevance(mutant), severity).toEqual(base)
		}
	})
})

describe('rule 1 — success-indicator separation', () => {
	it('13. an operation nominating no indicator is relevant', () => {
		const contract = parsedMutant(absentContract, (mutant) => {
			const descriptor = firstDescriptor(mutant)
			descriptor.successIndicator = null
			descriptor.channelRoles = {}
		})
		expect(successIndicatorSeparationRelevance(contract)).toMatchObject({
			relevant: true,
			reason: 'operation read-thing nominates no success indicator',
		})
	})

	it('14. an indicator with an absent role map is relevant', () => {
		const contract = parsedMutant(absentContract, (mutant) => {
			const descriptor = firstDescriptor(mutant)
			descriptor.successIndicator = '/ok'
			descriptor.channelRoles = null
		})
		expect(successIndicatorSeparationRelevance(contract)).toMatchObject({
			relevant: true,
			reason: 'operation read-thing declares no channel roles',
		})
	})

	it('15. an indicator with an explicitly empty role map is not relevant', () => {
		const contract = parsedMutant(absentContract, (mutant) => {
			const descriptor = firstDescriptor(mutant)
			descriptor.successIndicator = '/ok'
			descriptor.channelRoles = {}
		})
		expect(successIndicatorSeparationRelevance(contract).relevant).toBe(false)
	})

	it('16. a role map naming only the indicator itself is not relevant', () => {
		const contract = parsedMutant(absentContract, (mutant) => {
			const descriptor = firstDescriptor(mutant)
			descriptor.successIndicator = '/ok'
			descriptor.channelRoles = { '/ok': 'success-indicator' }
		})
		expect(successIndicatorSeparationRelevance(contract).relevant).toBe(false)
	})

	it('17. a role map naming another pointer is relevant', () => {
		const contract = parsedMutant(absentContract, (mutant) => {
			const descriptor = firstDescriptor(mutant)
			descriptor.successIndicator = '/ok'
			descriptor.channelRoles = {
				'/ok': 'success-indicator',
				'/error': 'diagnostic',
			}
		})
		expect(successIndicatorSeparationRelevance(contract)).toMatchObject({
			relevant: true,
			reason:
				'operation read-thing gives pointer /error a channel role beside its success indicator',
		})
	})

	it('18. the empty pointer is a nominated indicator, not an absent one', () => {
		const contract = parsedMutant(absentContract, (mutant) => {
			const descriptor = firstDescriptor(mutant)
			descriptor.successIndicator = ''
			descriptor.channelRoles = { '': 'success-indicator' }
		})
		expect(successIndicatorSeparationRelevance(contract).relevant).toBe(false)
	})

	it('19. the empty pointer with another roled pointer is relevant', () => {
		const contract = parsedMutant(absentContract, (mutant) => {
			const descriptor = firstDescriptor(mutant)
			descriptor.successIndicator = ''
			descriptor.channelRoles = {
				'': 'success-indicator',
				'/error': 'diagnostic',
			}
		})
		expect(successIndicatorSeparationRelevance(contract)).toMatchObject({
			relevant: true,
			reason:
				'operation read-thing gives pointer /error a channel role beside its success indicator',
		})
	})

	it('20. a second operation answering nothing is reached', () => {
		const contract = parsedMutant(populatedContract, (mutant) => {
			operationNamed(mutant, 'create-thing').responseDescriptor.channelRoles = {
				'/ok': 'success-indicator',
			}
			operationNamed(
				mutant,
				'list-things',
			).responseDescriptor.successIndicator = null
		})
		expect(successIndicatorSeparationRelevance(contract)).toMatchObject({
			relevant: true,
			reason: 'operation list-things nominates no success indicator',
		})
	})
})

describe('rule 2 — whole-body coverage', () => {
	it('21. one required response key is not relevant', () => {
		const contract = parsedMutant(absentContract, (mutant) => {
			firstDescriptor(mutant).requiredKeys = ['only']
		})
		expect(wholeBodyRelevance(contract).relevant).toBe(false)
	})

	it('22. two required response keys are relevant', () => {
		const contract = parsedMutant(absentContract, (mutant) => {
			firstDescriptor(mutant).requiredKeys = ['a', 'b']
		})
		expect(wholeBodyRelevance(contract)).toMatchObject({
			relevant: true,
			reason: 'operation read-thing declares 2 distinct required response keys',
		})
	})

	it('23. one key repeated is one pointer', () => {
		const contract = parsedMutant(absentContract, (mutant) => {
			firstDescriptor(mutant).requiredKeys = ['a', 'a']
		})
		expect(wholeBodyRelevance(contract).relevant).toBe(false)
	})

	it('24. permitted keys are never counted', () => {
		const contract = parsedMutant(absentContract, (mutant) => {
			const descriptor = firstDescriptor(mutant)
			descriptor.requiredKeys = []
			descriptor.permittedKeys = ['a', 'b', 'c']
		})
		expect(wholeBodyRelevance(contract).relevant).toBe(false)
	})

	it('25. roled pointers are never counted', () => {
		const contract = parsedMutant(absentContract, (mutant) => {
			const descriptor = firstDescriptor(mutant)
			descriptor.requiredKeys = ['only']
			descriptor.channelRoles = {
				'/only': 'payload',
				'/error': 'diagnostic',
			}
		})
		expect(wholeBodyRelevance(contract).relevant).toBe(false)
	})

	it('26. a second operation declaring two keys is reached', () => {
		const contract = parsedMutant(populatedContract, (mutant) => {
			operationNamed(mutant, 'create-thing').responseDescriptor.requiredKeys = [
				'ok',
			]
			// list-things declares one required key of its own, so it needs the
			// second for the loop to have a witness past the first operation.
			operationNamed(mutant, 'list-things').responseDescriptor.requiredKeys = [
				'items',
				'error',
			]
		})
		expect(wholeBodyRelevance(contract)).toMatchObject({
			relevant: true,
			reason:
				'operation list-things declares 2 distinct required response keys',
		})
	})
})

describe('rule 3 — malformed input', () => {
	it('27. four channels declaring no key at all are not relevant', () => {
		const contract = EvalContract.parse(absentContract)
		expect(malformedInputRelevance(contract)).toMatchObject({
			relevant: false,
			reason: 'no operation declares a request key on any transport channel',
		})
	})

	it('28. a required key with no type entry is relevant', () => {
		const contract = parsedMutant(absentContract, (mutant) => {
			firstOperation(mutant).requestShape.body = {
				...emptyChannel(),
				requiredKeys: ['name'],
			}
		})
		expect(malformedInputRelevance(contract)).toMatchObject({
			relevant: true,
			reason: 'operation read-thing declares body key name',
		})
	})

	it('29. a typed key with empty key lists is relevant on body', () => {
		const contract = parsedMutant(absentContract, (mutant) => {
			firstOperation(mutant).requestShape.body = {
				...emptyChannel(),
				types: { name: 'string' },
			}
		})
		expect(malformedInputRelevance(contract)).toMatchObject({
			relevant: true,
			reason: 'operation read-thing declares body key name',
		})
	})

	it('30. a permitted key with no type is relevant on query', () => {
		const contract = parsedMutant(absentContract, (mutant) => {
			firstOperation(mutant).requestShape.query = {
				...emptyChannel(),
				permittedKeys: ['limit'],
			}
		})
		expect(malformedInputRelevance(contract)).toMatchObject({
			relevant: true,
			reason: 'operation read-thing declares query key limit',
		})
	})

	it('31. an indeterminate type is still a declared key, on header', () => {
		const contract = parsedMutant(absentContract, (mutant) => {
			firstOperation(mutant).requestShape.header = {
				...emptyChannel(),
				types: { 'X-Tenant': null },
			}
		})
		expect(malformedInputRelevance(contract)).toMatchObject({
			relevant: true,
			reason: 'operation read-thing declares header key X-Tenant',
		})
	})

	it('32. a required key is relevant on path', () => {
		const contract = parsedMutant(absentContract, (mutant) => {
			firstOperation(mutant).requestShape.path = {
				...emptyChannel(),
				requiredKeys: ['id'],
			}
		})
		expect(malformedInputRelevance(contract)).toMatchObject({
			relevant: true,
			reason: 'operation read-thing declares path key id',
		})
	})

	it('33. a second operation declaring an input is reached', () => {
		const contract = parsedMutant(populatedContract, (mutant) => {
			const shape = operationNamed(mutant, 'create-thing').requestShape
			shape.path = emptyChannel()
			shape.query = emptyChannel()
			shape.header = emptyChannel()
			shape.body = emptyChannel()
		})
		expect(malformedInputRelevance(contract)).toMatchObject({
			relevant: true,
			reason: 'operation list-things declares query key limit',
		})
	})
})

describe('rule 4 — per-record checking', () => {
	it('34. an absent collection-location list is relevant', () => {
		const contract = EvalContract.parse(absentContract)
		expect(perRecordRelevance(contract)).toMatchObject({
			relevant: true,
			reason:
				'operation read-thing declares no collection-location list, so no collection is declared to range over',
		})
	})

	it('35. an explicitly empty collection-location list is not relevant', () => {
		const contract = parsedMutant(absentContract, (mutant) => {
			firstDescriptor(mutant).collectionLocations = []
		})
		expect(perRecordRelevance(contract).relevant).toBe(false)
	})

	it('36. one declared collection location is relevant, and so are two', () => {
		const contract = parsedMutant(absentContract, (mutant) => {
			firstDescriptor(mutant).collectionLocations = [
				collectionLocation('/value', null),
			]
		})
		expect(perRecordRelevance(contract)).toMatchObject({
			relevant: true,
			reason: 'operation read-thing declares 1 collection location',
		})
		// Both branches of the shared `plural` helper.
		const two = parsedMutant(absentContract, (mutant) => {
			firstDescriptor(mutant).collectionLocations = [
				collectionLocation('/value', null),
				collectionLocation('/rows', null),
			]
		})
		expect(perRecordRelevance(two).reason).toBe(
			'operation read-thing declares 2 collection locations',
		)
	})

	it('37. a second operation declaring a location is reached', () => {
		const contract = parsedMutant(populatedContract, (mutant) => {
			operationNamed(
				mutant,
				'create-thing',
			).responseDescriptor.collectionLocations = []
		})
		expect(perRecordRelevance(contract)).toMatchObject({
			relevant: true,
			reason: 'operation list-things declares 1 collection location',
		})
	})
})

describe('rule 5 — sibling cross-check', () => {
	it('38. absent sibling groups are relevant', () => {
		const contract = EvalContract.parse(absentContract)
		expect(siblingCrossCheckRelevance(contract)).toMatchObject({
			relevant: true,
			reason: 'the contract declares no sibling groups',
		})
	})

	it('39. explicitly empty sibling groups are not relevant', () => {
		const contract = parsedMutant(absentContract, (mutant) => {
			mutant.siblingGroups = { operations: [], parameters: [] }
		})
		expect(siblingCrossCheckRelevance(contract).relevant).toBe(false)
	})

	it('40. an operation sibling group is relevant, and so are two', () => {
		const contract = parsedMutant(absentContract, (mutant) => {
			mutant.siblingGroups = {
				operations: [['create-thing', 'list-things']],
				parameters: [],
			}
		})
		expect(siblingCrossCheckRelevance(contract)).toMatchObject({
			relevant: true,
			reason: 'the contract declares 1 operation sibling group',
		})
		// This call site otherwise only ever runs the singular branch.
		const two = parsedMutant(absentContract, (mutant) => {
			mutant.siblingGroups = {
				operations: [
					['create-thing', 'list-things'],
					['read-thing', 'list-things'],
				],
				parameters: [],
			}
		})
		expect(siblingCrossCheckRelevance(two).reason).toBe(
			'the contract declares 2 operation sibling groups',
		)
	})

	it('41. a parameter sibling group is relevant', () => {
		const contract = parsedMutant(absentContract, (mutant) => {
			mutant.siblingGroups = {
				operations: [],
				parameters: [['cursor', 'limit']],
			}
		})
		expect(siblingCrossCheckRelevance(contract)).toMatchObject({
			relevant: true,
			reason: 'the contract declares 1 parameter sibling group',
		})
	})
})

describe('rule 6 — omission and completeness', () => {
	it('42. an absent collection-location list is relevant', () => {
		const contract = EvalContract.parse(absentContract)
		expect(omissionAndCompletenessRelevance(contract)).toMatchObject({
			relevant: true,
			reason:
				'operation read-thing declares no collection-location list, so no location can name a reference set',
		})
	})

	it('43. an explicitly empty collection-location list is not relevant', () => {
		const contract = parsedMutant(absentContract, (mutant) => {
			firstDescriptor(mutant).collectionLocations = []
		})
		expect(omissionAndCompletenessRelevance(contract).relevant).toBe(false)
	})

	it('44. a location naming no reference set is not relevant', () => {
		const contract = parsedMutant(absentContract, (mutant) => {
			firstDescriptor(mutant).collectionLocations = [
				collectionLocation('/value', null),
			]
		})
		expect(omissionAndCompletenessRelevance(contract).relevant).toBe(false)
	})

	it('45. a location naming a reference set is relevant', () => {
		const contract = parsedMutant(absentContract, (mutant) => {
			firstDescriptor(mutant).collectionLocations = [
				collectionLocation('/value', 'expected-things'),
			]
		})
		expect(omissionAndCompletenessRelevance(contract)).toMatchObject({
			relevant: true,
			reason:
				'operation read-thing names reference set expected-things for collection /value',
		})
	})

	it('46. a location naming an undeclared reference set still names one', () => {
		const contract = parsedMutant(absentContract, (mutant) => {
			mutant.referenceSets = {}
			firstDescriptor(mutant).collectionLocations = [
				collectionLocation('/value', 'never-declared'),
			]
		})
		expect(contract.referenceSets).toEqual({})
		expect(omissionAndCompletenessRelevance(contract)).toMatchObject({
			relevant: true,
			reason:
				'operation read-thing names reference set never-declared for collection /value',
		})
	})

	it('47. a second location on one operation is reached', () => {
		const contract = parsedMutant(absentContract, (mutant) => {
			firstDescriptor(mutant).collectionLocations = [
				collectionLocation('/value', null),
				collectionLocation('/rows', 'expected-things'),
			]
		})
		expect(omissionAndCompletenessRelevance(contract)).toMatchObject({
			relevant: true,
			reason:
				'operation read-thing names reference set expected-things for collection /rows',
		})
	})

	it('48. a second operation naming a reference set is reached', () => {
		const contract = parsedMutant(populatedContract, (mutant) => {
			operationNamed(
				mutant,
				'create-thing',
			).responseDescriptor.collectionLocations = [
				collectionLocation('/id', null),
			]
		})
		expect(omissionAndCompletenessRelevance(contract)).toMatchObject({
			relevant: true,
			reason:
				'operation list-things names reference set expected-things for collection /items',
		})
	})
})

describe('rule 7 — state change read-back', () => {
	it('49. every operation unmarked is not relevant', () => {
		const contract = EvalContract.parse(absentContract)
		expect(stateChangeReadBackRelevance(contract)).toMatchObject({
			relevant: false,
			reason: 'no operation declares stateChangeMarker: true',
		})
	})

	it('50. one marked operation is relevant', () => {
		const contract = parsedMutant(absentContract, (mutant) => {
			firstOperation(mutant).stateChangeMarker = true
		})
		expect(stateChangeReadBackRelevance(contract)).toMatchObject({
			relevant: true,
			reason: 'operation read-thing declares stateChangeMarker: true',
		})
	})

	it('51. a marked operation on a second interface is relevant', () => {
		const contract = parsedMutant(absentContract, (mutant) => {
			const second = structuredClone(mutant.permittedInterfaces[0])
			second.logicalId = 'other-api'
			second.operations[0].operationId = 'write-thing'
			second.operations[0].method = 'POST'
			second.operations[0].stateChangeMarker = true
			mutant.permittedInterfaces.push(second)
		})
		expect(stateChangeReadBackRelevance(contract)).toMatchObject({
			relevant: true,
			reason: 'operation write-thing declares stateChangeMarker: true',
		})
	})
})

describe('an empty operation inventory', () => {
	// The six operation-scoped rules in `DISCIPLINE_RULES` order; rule 5 reads
	// `siblingGroups` alone and is not among them.
	const OPERATION_SCOPED = DISCIPLINE_RULES.filter(
		(rule) => rule !== 'sibling-cross-check',
	)

	it('52. no interface at all leaves the six operation-scoped rules relevant', () => {
		const contract = parsedMutant(absentContract, (mutant) => {
			mutant.permittedInterfaces = []
		})
		const verdicts = evaluateRelevance(contract)
		for (const rule of OPERATION_SCOPED) {
			const returned = verdicts.find((candidate) => candidate.rule === rule)
			expect(returned, rule).toMatchObject({
				relevant: true,
				reason: NO_OPERATION,
			})
		}
		expect(verdicts.map((returned) => returned.relevant)).toEqual([
			true,
			true,
			true,
			true,
			// rule 5 follows `siblingGroups`, unchanged from AC 6's absent column.
			ABSENT_COLUMN[4],
			true,
			true,
		])
	})

	it('53. an interface declaring no operation is the same shape', () => {
		const contract = parsedMutant(absentContract, (mutant) => {
			mutant.permittedInterfaces[0].operations = []
		})
		const verdicts = evaluateRelevance(contract)
		for (const rule of OPERATION_SCOPED) {
			const returned = verdicts.find((candidate) => candidate.rule === rule)
			expect(returned, rule).toMatchObject({
				relevant: true,
				reason: NO_OPERATION,
			})
		}
	})
})

describe('own-key enumeration, purity, totality', () => {
	it('54. a key named constructor is a declared key like any other', () => {
		// Deliberately not re-parsed: the predicate is under test, and `KeyName`
		// is `z.string().min(1)`, which admits this key.
		const mutant = mutantOf(absentContract, (contract) => {
			firstOperation(contract).requestShape.body = {
				...emptyChannel(),
				types: { constructor: 'string' },
			}
		})
		expect(malformedInputRelevance(mutant as EvalContract)).toMatchObject({
			relevant: true,
			reason: 'operation read-thing declares body key constructor',
		})
	})

	it('55. two independent parses produce the same verdicts, and neither is mutated', () => {
		const contract = EvalContract.parse(populatedContract)
		const before = structuredClone(contract)
		expect(evaluateRelevance(contract)).toEqual(
			evaluateRelevance(EvalContract.parse(populatedContract)),
		)
		// A predicate writing to its input would write to both parses alike and
		// leave the arrays equal, so non-mutation is asserted separately.
		expect(contract).toStrictEqual(before)
	})

	it('56. the predicate map carries exactly the discipline rules', () => {
		// The mapped type already forbids a missing key and an extra one, so this
		// holds while that annotation stands. It catches the annotation being
		// loosened to `Record<string, ...>` later.
		expect(new Set(Object.keys(RELEVANCE_PREDICATES))).toEqual(
			new Set(DISCIPLINE_RULES),
		)
	})
})
