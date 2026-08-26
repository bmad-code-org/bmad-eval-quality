// AD-31's contract fixture corpus, one numbered fixture per assertion in Story
// 5.3 AC 10. A contract that stops occupying its cell still produces a table,
// so every positive asserts the deciding reason: a verdict pair alone cannot
// tell an absent declaration from an unwitnessed one.

import { describe, expect, it } from 'vitest'
import { compile } from '../../src/core/compile/compile.ts'
import { evaluateRelevance } from '../../src/core/coverage/relevance.ts'
import {
	DISCIPLINE_RULES,
	type DisciplineRule,
} from '../../src/core/coverage/rules.ts'
import {
	evaluateSatisfaction,
	NO_OPERATION_WITNESS,
	NO_RELEVANT_SITE,
} from '../../src/core/coverage/satisfaction.ts'
import {
	DECLARATION_STATES,
	type DeclarationState,
	STATE_VERDICTS,
} from '../../src/core/coverage/table.ts'
import { StructuralFailure } from '../../src/core/failure-codes.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { gateCContract } from '../schemas/fixtures/gate-c-contract.ts'
import { RELEVANCE_CONTRACTS } from '../schemas/fixtures/relevance-contracts.ts'
import { CORPUS_CELLS, CORPUS_CONTRACTS } from './fixtures/corpus.ts'
import { satisfiedContract } from './fixtures/satisfaction-contracts.ts'

/** One rule's two verdicts. Both families answer in `DISCIPLINE_RULES` order. */
const pairFor = (contract: EvalContract, rule: DisciplineRule) => {
	const index = DISCIPLINE_RULES.indexOf(rule)
	const relevance = evaluateRelevance(contract)[index]
	const satisfaction = evaluateSatisfaction(contract)[index]
	if (relevance === undefined || satisfaction === undefined) {
		throw new Error(`no verdict for ${rule}`)
	}
	return {
		relevant: relevance.relevant,
		satisfied: satisfaction.satisfied,
		relevanceReason: relevance.reason,
		satisfactionReason: satisfaction.reason,
	}
}

const contractNamed = (contractId: string): EvalContract => {
	const found = CORPUS_CONTRACTS.find(
		(candidate) => candidate.contractId === contractId,
	)
	if (found === undefined) throw new Error(`corpus declares no ${contractId}`)
	return found
}

const occupantOf = (rule: DisciplineRule, state: DeclarationState): string => {
	const cell = CORPUS_CELLS.find(
		(candidate) => candidate.rule === rule && candidate.state === state,
	)
	if (cell === undefined) throw new Error(`no cell for ${rule}/${state}`)
	return cell.contractId
}

/** The verdict pair a state asserts, plus the reason that separates its twin. */
const expectState = (
	contract: EvalContract,
	rule: DisciplineRule,
	state: DeclarationState,
) => {
	const pair = pairFor(contract, rule)
	expect({ relevant: pair.relevant, satisfied: pair.satisfied }).toStrictEqual(
		STATE_VERDICTS[state],
	)
	return pair
}

// Witnessed reasons in `DISCIPLINE_RULES` order, copied from
// `satisfaction.test.ts:110-127`; test files here do not import from each
// other. Verbatim, since `satisfied: true` alone passes on a rule with no site.
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

// The `absent` cell's satisfaction reason per rule. Rules 2, 3 and 7 read
// declarations with no `null` state, so theirs is the empty inventory.
const ABSENT_REASONS = {
	'success-indicator-separation':
		'operation create-thing nominates no success indicator, so no oracle can separate one from the body',
	'whole-body': NO_OPERATION_WITNESS,
	'malformed-input': NO_OPERATION_WITNESS,
	'per-record':
		'operation create-thing declares no collection-location list, so no quantifier can range over a declared collection',
	'sibling-cross-check':
		'the contract declares no sibling groups, so no group is declared to cross-check',
	'omission-and-completeness':
		'operation create-thing declares no collection-location list, so no location can be reconciled against a reference set',
	'state-change-read-back': NO_OPERATION_WITNESS,
} as const

// Each rule's four cells as literals. A corpus edit that moves a cell fails
// here; without them it would quietly rename a column of the emitted table.
const CELLS_BY_RULE = {
	'success-indicator-separation': [
		'absent-success-indicator',
		'empty-channel-roles',
		'satisfied-declarations',
		'split-indicator-oracle',
	],
	'whole-body': [
		'no-operation-inventory',
		'single-required-response-key',
		'satisfied-declarations',
		'per-key-split-oracles',
	],
	'malformed-input': [
		'no-operation-inventory',
		'empty-request-shapes',
		'satisfied-declarations',
		'no-type-violating-step',
	],
	'per-record': [
		'absent-collection-locations',
		'empty-collection-locations',
		'satisfied-declarations',
		'no-collection-quantifier',
	],
	'sibling-cross-check': [
		'absent-sibling-groups',
		'empty-sibling-groups',
		'satisfied-declarations',
		'unaddressed-parameter-sibling',
	],
	'omission-and-completeness': [
		'absent-collection-locations',
		'unnamed-reference-set',
		'satisfied-declarations',
		'wrong-cardinality-form',
	],
	'state-change-read-back': [
		'no-operation-inventory',
		'no-state-change-marker',
		'satisfied-declarations',
		'no-read-back-relation',
	],
} as const

/** The two contracts Decision 7 names, which do not compile and say why. */
const UNCOMPILABLE = ['no-operation-inventory', 'empty-request-shapes']

function structuralFailureOf(fn: () => void): StructuralFailure {
	try {
		fn()
	} catch (error) {
		if (error instanceof StructuralFailure) return error
		throw error
	}
	throw new Error('expected a StructuralFailure to be thrown')
}

describe('the seed', () => {
	it('151. satisfiedContract places all seven rules at witnessed, each with its own reason', () => {
		const seed = EvalContract.parse(satisfiedContract)
		for (const rule of DISCIPLINE_RULES) {
			const pair = expectState(seed, rule, 'witnessed')
			expect(pair.satisfactionReason).toBe(WITNESSED[rule])
		}
	})
})

describe('the corpus as a set', () => {
	it('152. every corpus contract parses under EvalContract.parse', () => {
		for (const contract of CORPUS_CONTRACTS) {
			expect(() => EvalContract.parse(contract)).not.toThrow()
		}
	})

	it('153. the corpus carries nineteen contracts with nineteen distinct identifiers', () => {
		const ids = CORPUS_CONTRACTS.map((contract) => contract.contractId)
		expect(ids).toHaveLength(19)
		expect(new Set(ids).size).toBe(19)
	})

	it('154. the cell index carries twenty-eight entries', () => {
		expect(CORPUS_CELLS).toHaveLength(28)
	})

	it('155. every rule-and-state pair appears in the cell index exactly once', () => {
		for (const rule of DISCIPLINE_RULES) {
			for (const state of DECLARATION_STATES) {
				const occupying = CORPUS_CELLS.filter(
					(cell) => cell.rule === rule && cell.state === state,
				)
				expect(occupying).toHaveLength(1)
			}
		}
	})

	it('156. every cell names a contract the corpus carries', () => {
		const ids = new Set(CORPUS_CONTRACTS.map((contract) => contract.contractId))
		for (const cell of CORPUS_CELLS) {
			expect(ids.has(cell.contractId)).toBe(true)
		}
	})

	it('157. the cell index is ordered by rule then by declaration state', () => {
		expect(
			CORPUS_CELLS.map((cell) => `${cell.rule}/${cell.state}`),
		).toStrictEqual(
			DISCIPLINE_RULES.flatMap((rule) =>
				DECLARATION_STATES.map((state) => `${rule}/${state}`),
			),
		)
	})

	it('158. the contract list is ordered by first appearance in the cell index', () => {
		expect(
			CORPUS_CONTRACTS.map((contract) => contract.contractId),
		).toStrictEqual([...new Set(CORPUS_CELLS.map((cell) => cell.contractId))])
	})

	it('159. every cell produces the verdict pair its declaration state asserts', () => {
		for (const cell of CORPUS_CELLS) {
			const pair = pairFor(contractNamed(cell.contractId), cell.rule)
			expect({
				cell: `${cell.rule}/${cell.state}`,
				relevant: pair.relevant,
				satisfied: pair.satisfied,
			}).toStrictEqual({
				cell: `${cell.rule}/${cell.state}`,
				...STATE_VERDICTS[cell.state],
			})
		}
	})
})

describe('the absent cells name the declaration that is missing', () => {
	const numbered = [160, 161, 162, 163, 164, 165, 166] as const
	for (const [index, rule] of DISCIPLINE_RULES.entries()) {
		it(`${numbered[index]}. ${rule}'s absent cell decides on its own declaration-absence reason`, () => {
			const pair = expectState(
				contractNamed(occupantOf(rule, 'absent')),
				rule,
				'absent',
			)
			expect(pair.satisfactionReason).toBe(ABSENT_REASONS[rule])
		})
	}
})

describe('the unwitnessed cells are a different failure from the absent ones', () => {
	it('167. every unwitnessed cell decides on a no-witness reason, not an absence one', () => {
		for (const rule of DISCIPLINE_RULES) {
			const pair = expectState(
				contractNamed(occupantOf(rule, 'unwitnessed')),
				rule,
				'unwitnessed',
			)
			expect(pair.satisfactionReason).toMatch(/^no (oracle|check|step) /)
			expect(pair.satisfactionReason).not.toBe(NO_OPERATION_WITNESS)
			expect(pair.satisfactionReason).not.toBe(ABSENT_REASONS[rule])
		}
	})
})

describe('the fourth verdict combination is unoccupiable', () => {
	// Fixture 67 opened this over five contracts. Twenty-three now: nineteen
	// here, three relevance contracts, and the Gate C contract.
	const EVERY_CONTRACT = [
		...CORPUS_CONTRACTS,
		...RELEVANCE_CONTRACTS.map((entry) => EvalContract.parse(entry.contract)),
		EvalContract.parse(gateCContract),
	]

	it('168. no rule of any contract is both not relevant and not satisfied', () => {
		expect(new Set(EVERY_CONTRACT.map((c) => c.contractId)).size).toBe(23)
		for (const contract of EVERY_CONTRACT) {
			for (const rule of DISCIPLINE_RULES) {
				const pair = pairFor(contract, rule)
				expect({
					contractId: contract.contractId,
					rule,
					both: pair.relevant === false && pair.satisfied === false,
				}).toStrictEqual({ contractId: contract.contractId, rule, both: false })
			}
		}
	})

	it('169. a rule that is not relevant is satisfied vacuously, never with a witnessed reason', () => {
		for (const contract of EVERY_CONTRACT) {
			for (const rule of DISCIPLINE_RULES) {
				const pair = pairFor(contract, rule)
				if (pair.relevant) continue
				expect(pair.satisfactionReason).toBe(NO_RELEVANT_SITE)
			}
		}
	})
})

describe('the corpus descends from one seed', () => {
	it('170. every contract keeps the seed s five untouched top-level fields', () => {
		const inherited = (contract: {
			testData: unknown
			budgets: unknown
			safetyLimits: unknown
			requiredEvidence: unknown
			probeStepBound: unknown
		}) => ({
			testData: contract.testData,
			budgets: contract.budgets,
			safetyLimits: contract.safetyLimits,
			requiredEvidence: contract.requiredEvidence,
			probeStepBound: contract.probeStepBound,
		})
		const expected = inherited(satisfiedContract)
		for (const contract of CORPUS_CONTRACTS) {
			expect(inherited(contract)).toStrictEqual(expected)
		}
		// The negative that gives the positive teeth: every corpus contract is a
		// spread of the seed, so the comparison would hold for anything `variant`
		// can produce.
		expect(
			inherited({ ...satisfiedContract, probeStepBound: 99 }),
		).not.toStrictEqual(expected)
	})

	it('171. the schema rejects an oracle carrying a rule field, which is what keeps relevance declaration-only', () => {
		const withRuleOnOracle = structuredClone(
			satisfiedContract,
		) as unknown as Record<string, unknown>
		const oracles = withRuleOnOracle.oracles as Record<string, unknown>[]
		oracles[0] = { ...oracles[0], rule: 'omission-and-completeness' }
		const parsed = EvalContract.safeParse(withRuleOnOracle)
		expect(parsed.success).toBe(false)
		expect(
			parsed.error?.issues.some((issue) => issue.path.includes('oracles')),
		).toBe(true)
	})
})

describe('which contract occupies which cell', () => {
	const numbered = [172, 173, 174, 175, 176, 177, 178] as const
	for (const [index, rule] of DISCIPLINE_RULES.entries()) {
		it(`${numbered[index]}. ${rule}'s four cells name the contracts the table says they do`, () => {
			expect(
				CORPUS_CELLS.filter((cell) => cell.rule === rule).map(
					(cell) => cell.contractId,
				),
			).toStrictEqual([...CELLS_BY_RULE[rule]])
		})
	}

	it('179. absent-collection-locations occupies both rule 4 and rule 6 absent cells', () => {
		expect(occupantOf('per-record', 'absent')).toBe(
			'absent-collection-locations',
		)
		expect(occupantOf('omission-and-completeness', 'absent')).toBe(
			'absent-collection-locations',
		)
	})

	it('180. no-operation-inventory occupies the absent cells of rules 2, 3 and 7', () => {
		for (const rule of [
			'whole-body',
			'malformed-input',
			'state-change-read-back',
		] as const) {
			expect(occupantOf(rule, 'absent')).toBe('no-operation-inventory')
		}
	})
})

describe('the collateral each unwitnessed override does and does not move', () => {
	it('181. split-indicator-oracle unwitnesses rule 1 and rule 2, and rule 2 s cell is a different contract', () => {
		const contract = contractNamed('split-indicator-oracle')
		const rule1 = expectState(
			contract,
			'success-indicator-separation',
			'unwitnessed',
		)
		expect(rule1.satisfactionReason).toBe(
			"no oracle addresses operation create-thing's success indicator beside another roled pointer at one step, in both channels",
		)
		expectState(contract, 'whole-body', 'unwitnessed')
		expect(occupantOf('whole-body', 'unwitnessed')).not.toBe(
			'split-indicator-oracle',
		)
	})

	it('182. per-key-split-oracles keeps rule 1 witnessed while rule 2 loses its witness', () => {
		const contract = contractNamed('per-key-split-oracles')
		const rule1 = expectState(
			contract,
			'success-indicator-separation',
			'witnessed',
		)
		expect(rule1.satisfactionReason).toBe(
			WITNESSED['success-indicator-separation'],
		)
		const rule2 = expectState(contract, 'whole-body', 'unwitnessed')
		expect(rule2.satisfactionReason).toBe(
			'no oracle covers every required response key of operation create-thing at one addressed step, in both channels',
		)
	})

	it('183. unaddressed-parameter-sibling moves the parameter group alone', () => {
		const contract = contractNamed('unaddressed-parameter-sibling')
		for (const rule of ['malformed-input', 'state-change-read-back'] as const) {
			expect(expectState(contract, rule, 'witnessed').satisfactionReason).toBe(
				WITNESSED[rule],
			)
		}
		expect(
			expectState(contract, 'sibling-cross-check', 'unwitnessed')
				.satisfactionReason,
		).toBe(
			'no oracle addresses two members of the parameter sibling group limit and offset in both channels',
		)
	})

	it('184. no-read-back-relation leaves rule 5 witnessed by O-004', () => {
		const contract = contractNamed('no-read-back-relation')
		expect(
			expectState(contract, 'sibling-cross-check', 'witnessed')
				.satisfactionReason,
		).toBe(WITNESSED['sibling-cross-check'])
		expect(
			expectState(contract, 'state-change-read-back', 'unwitnessed')
				.satisfactionReason,
		).toBe(
			"no check relates operation create-thing's call inputs to the response body of a later step that changes no state",
		)
	})

	it('185. no-collection-quantifier leaves rule 6 witnessed by O-001', () => {
		const contract = contractNamed('no-collection-quantifier')
		expect(
			expectState(contract, 'omission-and-completeness', 'witnessed')
				.satisfactionReason,
		).toBe(WITNESSED['omission-and-completeness'])
		expect(
			expectState(contract, 'per-record', 'unwitnessed').satisfactionReason,
		).toBe(
			'no check quantifies over collection /items of operation list-things',
		)
	})

	it('186. wrong-cardinality-form moves rule 6 alone, and names the declared mode', () => {
		const contract = contractNamed('wrong-cardinality-form')
		expect(
			expectState(contract, 'per-record', 'witnessed').satisfactionReason,
		).toBe(WITNESSED['per-record'])
		expect(
			expectState(contract, 'omission-and-completeness', 'unwitnessed')
				.satisfactionReason,
		).toContain('page-bounded')
	})

	it('187. empty-channel-roles is the explicit empty answer, not the absent one', () => {
		const pair = expectState(
			contractNamed('empty-channel-roles'),
			'success-indicator-separation',
			'explicitly-empty',
		)
		expect(pair.relevant).toBe(false)
		expect(pair.relevanceReason).toBe(
			'every operation nominates a success indicator and gives no other pointer a channel role',
		)
	})

	it('188. empty-request-shapes builds a distinct channel object per slot', () => {
		const clone = structuredClone(
			contractNamed('empty-request-shapes'),
		) as unknown as {
			permittedInterfaces: {
				operations: {
					requestShape: Record<string, { requiredKeys: string[] }>
				}[]
			}[]
		}
		const shape = clone.permittedInterfaces[0]?.operations[0]?.requestShape
		if (shape === undefined) throw new Error('corpus contract lost its shape')
		shape.path?.requiredKeys.push('leaked')
		expect(shape.query?.requiredKeys).toStrictEqual([])
		expect(shape.header?.requiredKeys).toStrictEqual([])
		expect(shape.body?.requiredKeys).toStrictEqual([])
	})
})

describe('what the corpus does and does not ask the compiler for', () => {
	it('189. seventeen of the nineteen corpus contracts compile clean', () => {
		const compiling = CORPUS_CONTRACTS.filter(
			(contract) => !UNCOMPILABLE.includes(contract.contractId),
		)
		expect(compiling).toHaveLength(17)
		for (const contract of compiling) {
			expect(() => compile(contract, { strict: false })).not.toThrow()
		}
	})

	it('190. the two exceptions fail unreachable-check-evidence, each at its own site', () => {
		const inventory = structuralFailureOf(() =>
			compile(contractNamed('no-operation-inventory'), { strict: false }),
		)
		expect(inventory.code).toBe('unreachable-check-evidence')
		expect(inventory.artifactPath).toBe(
			'EvalContract.oracles[id=O-001].check.operands[1]',
		)
		expect(inventory.message).toContain(
			'/interactions/list/response-body/items',
		)

		const shapes = structuralFailureOf(() =>
			compile(contractNamed('empty-request-shapes'), { strict: false }),
		)
		expect(shapes.code).toBe('unreachable-check-evidence')
		expect(shapes.artifactPath).toBe(
			'EvalContract.oracles[id=O-005].check.operands[0].operands[0]',
		)
		expect(shapes.message).toContain(
			'/interactions/create/call-inputs/body/name',
		)
	})
})
