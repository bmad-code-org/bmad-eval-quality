// AD-31's coverage-gap records, one numbered fixture per assertion in Story
// 5.3 AC 10. A gap is the conjunction of the two families, so the fixtures
// that matter separate "no record, rule satisfied" from "no record, rule never
// fired".

import { describe, expect, it } from 'vitest'
import {
	coverageSeverity,
	evaluateCoverage,
} from '../../src/core/coverage/coverage.ts'
import { evaluateRelevance } from '../../src/core/coverage/relevance.ts'
import {
	DISCIPLINE_RULES,
	type DisciplineRule,
} from '../../src/core/coverage/rules.ts'
import {
	evaluateSatisfaction,
	NO_OPERATION_WITNESS,
} from '../../src/core/coverage/satisfaction.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { CoverageGap } from '../../src/core/schemas/evidence-artifact.ts'
import { gateCContract } from '../schemas/fixtures/gate-c-contract.ts'
import { RELEVANCE_CONTRACTS } from '../schemas/fixtures/relevance-contracts.ts'
import { CORPUS_CELLS, CORPUS_CONTRACTS } from './fixtures/corpus.ts'
import { satisfiedContract } from './fixtures/satisfaction-contracts.ts'

// A clone with the fewest mutations, re-parsed so the assertion speaks about a
// contract the schema accepts. Mirrors `satisfaction.test.ts:60-72`.
const parsedMutant = (mutate: (contract: any) => void): EvalContract => {
	const contract = structuredClone(satisfiedContract) as any
	mutate(contract)
	return EvalContract.parse(contract)
}

const emptyChannel = () => ({
	requiredKeys: [] as string[],
	permittedKeys: [] as string[],
	types: {} as Record<string, string | null>,
})

const contractNamed = (contractId: string): EvalContract => {
	const found = CORPUS_CONTRACTS.find(
		(candidate) => candidate.contractId === contractId,
	)
	if (found === undefined) throw new Error(`corpus declares no ${contractId}`)
	return found
}

/** The seven behaviours of a contract, replaced by one per severity given. */
const withSeverities = (severities: readonly string[]): EvalContract =>
	parsedMutant((contract) => {
		const template = contract.behaviors[0]
		contract.behaviors = severities.map((severity, index) => ({
			...structuredClone(template),
			id: `B-${String(index + 1).padStart(3, '0')}`,
			severity,
		}))
	})

/**
 * Every rule explicitly empty at once: the shape AD-31 exists to catch scoring
 * clean. Composed from AC 3's seven overrides; the corpus carries them singly.
 */
const allExplicitlyEmpty = parsedMutant((contract) => {
	const [create, list] = contract.permittedInterfaces[0].operations
	create.responseDescriptor.channelRoles = {}
	list.responseDescriptor.channelRoles = {}
	create.responseDescriptor.requiredKeys = ['ok']
	create.requestShape = {
		path: emptyChannel(),
		query: emptyChannel(),
		header: emptyChannel(),
		body: emptyChannel(),
	}
	list.requestShape = {
		path: emptyChannel(),
		query: emptyChannel(),
		header: emptyChannel(),
		body: emptyChannel(),
	}
	list.responseDescriptor.collectionLocations = []
	create.stateChangeMarker = false
	contract.siblingGroups = { operations: [], parameters: [] }
})

// The fourteen identifiers as literals, copied from `rules.test.ts:16-38`.
// Re-deriving them from `relevancePredicateId` holds for any suffix.
const RELEVANCE_PREDICATE_IDS = {
	'success-indicator-separation': 'success-indicator-separation-relevance',
	'whole-body': 'whole-body-relevance',
	'malformed-input': 'malformed-input-relevance',
	'per-record': 'per-record-relevance',
	'sibling-cross-check': 'sibling-cross-check-relevance',
	'omission-and-completeness': 'omission-and-completeness-relevance',
	'state-change-read-back': 'state-change-read-back-relevance',
} as const

const SATISFACTION_PREDICATE_IDS = {
	'success-indicator-separation': 'success-indicator-separation-satisfaction',
	'whole-body': 'whole-body-satisfaction',
	'malformed-input': 'malformed-input-satisfaction',
	'per-record': 'per-record-satisfaction',
	'sibling-cross-check': 'sibling-cross-check-satisfaction',
	'omission-and-completeness': 'omission-and-completeness-satisfaction',
	'state-change-read-back': 'state-change-read-back-satisfaction',
} as const

/** The rules a contract should record, computed without `evaluateCoverage`. */
const expectedGapRules = (
	contract: EvalContract,
): readonly DisciplineRule[] => {
	const satisfaction = evaluateSatisfaction(contract)
	return evaluateRelevance(contract)
		.filter((relevance, index) => {
			const satisfied = satisfaction[index]
			return (
				relevance.relevant && satisfied !== undefined && !satisfied.satisfied
			)
		})
		.map((relevance) => relevance.rule)
}

describe('what a record is and is not', () => {
	it('191. the all-witnessed seed records no gap at all', () => {
		expect(
			evaluateCoverage(EvalContract.parse(satisfiedContract)),
		).toStrictEqual([])
	})

	it('192. every record the corpus produces parses under CoverageGap', () => {
		for (const contract of CORPUS_CONTRACTS) {
			for (const record of evaluateCoverage(contract)) {
				expect(() => CoverageGap.parse(record)).not.toThrow()
			}
		}
	})

	it('193. every record carries satisfied: false', () => {
		for (const contract of CORPUS_CONTRACTS) {
			for (const record of evaluateCoverage(contract)) {
				expect(record.satisfied).toBe(false)
			}
		}
	})

	it('194. the recorded rules are exactly the relevant-and-unsatisfied ones', () => {
		for (const contract of CORPUS_CONTRACTS) {
			expect(
				evaluateCoverage(contract).map((record) => record.rule),
			).toStrictEqual([...expectedGapRules(contract)])
		}
	})

	it('195. records come back in DISCIPLINE_RULES order', () => {
		for (const contract of CORPUS_CONTRACTS) {
			const positions = evaluateCoverage(contract).map((record) =>
				DISCIPLINE_RULES.indexOf(record.rule as DisciplineRule),
			)
			expect(positions).toStrictEqual([...positions].sort((a, b) => a - b))
			expect(positions.every((position) => position >= 0)).toBe(true)
		}
	})

	it('196. each record names the two predicate identifiers the vocabulary pins', () => {
		for (const contract of CORPUS_CONTRACTS) {
			for (const record of evaluateCoverage(contract)) {
				const rule = record.rule as DisciplineRule
				expect(record.relevancePredicate).toBe(RELEVANCE_PREDICATE_IDS[rule])
				expect(record.satisfactionPredicate).toBe(
					SATISFACTION_PREDICATE_IDS[rule],
				)
			}
		}
	})
})

describe('the two ends of the range', () => {
	it('197. no-operation-inventory records six rules, all but sibling-cross-check', () => {
		const contract = contractNamed('no-operation-inventory')
		const rules = evaluateCoverage(contract).map((record) => record.rule)
		expect(rules).toStrictEqual(
			DISCIPLINE_RULES.filter((rule) => rule !== 'sibling-cross-check'),
		)
		// The record carries no reason (Decision 6), so the reason those six
		// share is asserted where it lives.
		const satisfaction = evaluateSatisfaction(contract)
		for (const [index, rule] of DISCIPLINE_RULES.entries()) {
			if (rule === 'sibling-cross-check') continue
			expect(satisfaction[index]?.reason).toBe(NO_OPERATION_WITNESS)
		}
	})

	it('198. a contract with every rule explicitly empty records no gap', () => {
		expect(evaluateCoverage(allExplicitlyEmpty)).toStrictEqual([])
	})

	it('199. and that is the vacuous-truth case: every rule answers not relevant', () => {
		expect(
			evaluateRelevance(allExplicitlyEmpty).map(
				(relevance) => relevance.relevant,
			),
		).toStrictEqual(DISCIPLINE_RULES.map(() => false))
	})

	it('200. the two verdict arrays agree in length and in rule order', () => {
		for (const contract of CORPUS_CONTRACTS) {
			const relevance = evaluateRelevance(contract)
			const satisfaction = evaluateSatisfaction(contract)
			expect(satisfaction).toHaveLength(relevance.length)
			expect(satisfaction.map((verdict) => verdict.rule)).toStrictEqual(
				relevance.map((verdict) => verdict.rule),
			)
		}
	})
})

describe('coverageSeverity', () => {
	it('201. returns critical for the seed, whose one behaviour is critical', () => {
		expect(coverageSeverity(EvalContract.parse(satisfiedContract))).toBe(
			'critical',
		)
	})

	it('202. returns the maximum over three behaviours, in either declared order', () => {
		expect(
			coverageSeverity(withSeverities(['low', 'critical', 'material'])),
		).toBe('critical')
		expect(
			coverageSeverity(withSeverities(['material', 'critical', 'low'])),
		).toBe('critical')
	})

	it('203. returns low where low is the only declared severity', () => {
		expect(coverageSeverity(withSeverities(['low']))).toBe('low')
	})

	it('204. returns material where the declared severities are low and material', () => {
		expect(coverageSeverity(withSeverities(['low', 'material']))).toBe(
			'material',
		)
	})

	it('205. every record of one contract carries the one contract-level severity', () => {
		const records = evaluateCoverage(contractNamed('no-operation-inventory'))
		expect(records).toHaveLength(6)
		// The claim is uniformity. Fixtures 201 through 204 pin the derivation
		// itself; asserting `critical` here would fail under regressions that leave
		// the derivation contract-level.
		expect(new Set(records.map((record) => record.severity)).size).toBe(1)
	})
})

describe('the two functions as functions', () => {
	it('206. writes nothing to its input', () => {
		const contract = contractNamed('no-operation-inventory')
		const before = structuredClone(contract)
		evaluateCoverage(contract)
		expect(structuredClone(contract)).toStrictEqual(before)
	})

	it('207. answers the same on a second call', () => {
		for (const contract of CORPUS_CONTRACTS) {
			expect(evaluateCoverage(contract)).toStrictEqual(
				evaluateCoverage(contract),
			)
		}
	})

	it('208. reads no field but behaviors[].severity', () => {
		const stripped = parsedMutant((contract) => {
			contract.oracles = []
			contract.rubrics = []
			contract.waivers = []
			contract.permittedInterfaces = []
			contract.siblingGroups = null
		})
		expect(coverageSeverity(stripped)).toBe(
			coverageSeverity(EvalContract.parse(satisfiedContract)),
		)
	})

	it('209. records only rules the vocabulary declares', () => {
		for (const contract of CORPUS_CONTRACTS) {
			for (const record of evaluateCoverage(contract)) {
				expect(DISCIPLINE_RULES).toContain(record.rule)
			}
		}
	})

	it('210. every one of the seven rules is reachable as a gap', () => {
		const seen = new Set(
			CORPUS_CONTRACTS.flatMap((contract) =>
				evaluateCoverage(contract).map((record) => record.rule),
			),
		)
		expect(seen).toStrictEqual(new Set(DISCIPLINE_RULES))
	})

	it('211. every rule gaps in both its absent and its unwitnessed contract', () => {
		for (const rule of DISCIPLINE_RULES) {
			const occupants = CORPUS_CELLS.filter(
				(cell) =>
					cell.rule === rule &&
					(cell.state === 'absent' || cell.state === 'unwitnessed'),
			).map((cell) => cell.contractId)
			expect(new Set(occupants).size).toBe(2)
			for (const contractId of occupants) {
				expect(
					evaluateCoverage(contractNamed(contractId)).map(
						(record) => record.rule,
					),
				).toContain(rule)
			}
		}
	})

	it('212. is total over every contract fixture in the repository, not just the corpus', () => {
		// Every fixture from 192 on already runs `evaluateCoverage` across the
		// corpus, so "throws on no corpus contract" is free. These four are the
		// contracts nothing else here reaches.
		const outside = [
			...RELEVANCE_CONTRACTS.map((entry) => EvalContract.parse(entry.contract)),
			EvalContract.parse(gateCContract),
		]
		expect(outside).toHaveLength(4)
		for (const contract of outside) {
			expect(() => evaluateCoverage(contract)).not.toThrow()
			for (const record of evaluateCoverage(contract)) {
				expect(() => CoverageGap.parse(record)).not.toThrow()
			}
		}
	})
})
