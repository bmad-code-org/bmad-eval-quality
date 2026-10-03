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
import {
	coverageSeverity,
	evaluateCoverage,
} from '../../src/core/coverage/coverage.ts'
import { evaluateRelevance } from '../../src/core/coverage/relevance.ts'
import { evaluateSatisfaction } from '../../src/core/coverage/satisfaction.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import {
	artifactCommandContract,
	commandContract,
} from '../schemas/fixtures/command-contract.ts'
import { skillContract } from '../schemas/fixtures/skill-contract.ts'
import { satisfiedContract } from './fixtures/satisfaction-contracts.ts'

const EXIT = '/interactions/select/exit-code'
const STDOUT = '/interactions/select/stdout'

const equality = (pointer: string, literal: number | string) => ({
	op: 'equality',
	operands: [{ pointer }, { literal }],
})

const scalarCommand = () => {
	const contract = structuredClone(commandContract) as any
	contract.behaviors[0].severity = 'critical'
	const descriptor =
		contract.permittedInterfaces[0].operations[0].responseDescriptor
	descriptor.requiredKeys = []
	descriptor.permittedKeys = []
	descriptor.types = {}
	descriptor.successIndicator = null
	descriptor.channelRoles = null
	descriptor.collectionLocations = []
	const witness =
		contract.permittedInterfaces[0].operations[0].sensitivityWitness
	const comparison = witness.relation.operands[0]
	for (const operand of comparison.operands) {
		operand.pointer = operand.pointer.replace('/stdout/fragments', '/stdout')
	}
	contract.oracles[0].direction.evidenceTargets = [EXIT, STDOUT]
	contract.oracles[0].direction.relation = 'all'
	contract.oracles[0].check = {
		op: 'all',
		operands: [equality(EXIT, 0), equality(STDOUT, 'complete answer\n')],
	}
	return contract
}

const separation = (contract: unknown) =>
	evaluateSatisfaction(EvalContract.parse(contract))[0]?.satisfied

const compiledSeparation = (contract: unknown): boolean => {
	const parsed = EvalContract.parse(contract)
	compile(parsed, { strict: true })
	expect(evaluateRelevance(parsed)[0]?.relevant).toBe(true)
	const gap = evaluateCoverage(parsed).find(
		(record) => record.rule === 'success-indicator-separation',
	)
	if (gap !== undefined) expect(gap.severity).toBe(coverageSeverity(parsed))
	expect(separation(parsed)).toBe(gap === undefined)
	return gap === undefined
}

const align = (contract: any, targets: string[], relation: string) => {
	contract.oracles[0].direction.evidenceTargets = targets
	contract.oracles[0].direction.relation = relation
}

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
	it('recognizes process success and the exact scalar answer in one compiled oracle', () => {
		expect(compiledSeparation(scalarCommand())).toBe(true)
	})

	it('recognizes whole stdout declared as the scalar payload', () => {
		const contract = scalarCommand()
		contract.permittedInterfaces[0].operations[0].responseDescriptor.channelRoles =
			{
				'': 'payload',
			}
		expect(compiledSeparation(contract)).toBe(true)
	})

	it('does not treat a diagnostic stdout role as the substantive answer', () => {
		const contract = scalarCommand()
		contract.permittedInterfaces[0].operations[0].responseDescriptor.channelRoles =
			{
				'': 'diagnostic',
			}
		expect(compiledSeparation(contract)).toBe(false)
	})

	it('accepts an exact string deep-equality check through compiled coverage', () => {
		const contract = scalarCommand()
		contract.oracles[0].check.operands[1].op = 'deep-equality'
		expect(compiledSeparation(contract)).toBe(true)
	})

	it('does not credit an expects-violation oracle for affirmative scalar checks', () => {
		const contract = scalarCommand()
		contract.oracles[0].polarity = 'expects-violation'
		contract.oracles[0].direction.polarity = 'expects-violation'
		expect(compiledSeparation(contract)).toBe(false)
	})

	it.each([
		[
			'nonzero exit',
			(contract: any) => {
				contract.oracles[0].check.operands[0] = equality(EXIT, 1)
			},
		],
		[
			'exit only',
			(contract: any) => {
				contract.oracles[0].check = equality(EXIT, 0)
				align(contract, [EXIT], 'equality')
			},
		],
		[
			'stdout only',
			(contract: any) => {
				contract.oracles[0].check = equality(STDOUT, 'complete answer\n')
				align(contract, [STDOUT], 'equality')
			},
		],
		[
			'substring',
			(contract: any) => {
				contract.oracles[0].check.operands[1] = {
					op: 'containment',
					operands: [{ pointer: STDOUT }, { literal: 'answer' }],
				}
			},
		],
		[
			'exit absent from direction',
			(contract: any) => {
				contract.oracles[0].direction.evidenceTargets = [STDOUT]
			},
		],
		[
			'stdout absent from direction',
			(contract: any) => {
				contract.oracles[0].direction.evidenceTargets = [EXIT]
			},
		],
		[
			'different step',
			(contract: any) => {
				const other = structuredClone(contract.interactionPlan[0])
				other.stepId = 'other'
				other.inputBinding.stdin.prompt = { literal: 'a distinct request' }
				contract.interactionPlan.push(other)
				contract.oracles[0].check.operands[1] = equality(
					'/interactions/other/stdout',
					'complete answer\n',
				)
				align(contract, [EXIT, '/interactions/other/stdout'], 'all')
			},
		],
		[
			'alternative branches',
			(contract: any) => {
				contract.oracles[0].check.op = 'any'
				align(contract, [EXIT, STDOUT], 'any')
			},
		],
		[
			'split oracles',
			(contract: any) => {
				const second = structuredClone(contract.oracles[0])
				second.id = 'O-002'
				second.check = equality(STDOUT, 'complete answer\n')
				second.direction.evidenceTargets = [STDOUT]
				second.direction.relation = 'equality'
				contract.oracles[0].check = equality(EXIT, 0)
				align(contract, [EXIT], 'equality')
				contract.oracles.push(second)
				const behavior = structuredClone(contract.behaviors[0])
				behavior.id = 'B-002'
				behavior.oracles = ['O-002']
				contract.behaviors.push(behavior)
			},
		],
		[
			'a declared response field',
			(contract: any) => {
				const descriptor =
					contract.permittedInterfaces[0].operations[0].responseDescriptor
				descriptor.requiredKeys = ['answer']
				descriptor.permittedKeys = ['answer']
				descriptor.types = { answer: 'string' }
			},
		],
	])('keeps separation unsatisfied for %s', (_name, mutate) => {
		const contract = scalarCommand()
		mutate(contract)
		expect(compiledSeparation(contract)).toBe(false)
	})

	it('retains the structured response rule', () => {
		expect(compiledSeparation(satisfiedContract)).toBe(true)
		const successOnly = structuredClone(satisfiedContract) as any
		const oracle = successOnly.oracles.find(
			(oracle: any) => oracle.id === 'O-002',
		)
		oracle.check = {
			op: 'existence',
			operands: [{ pointer: '/interactions/create/response-body/ok' }],
		}
		oracle.direction.evidenceTargets = ['/interactions/create/response-body/ok']
		oracle.direction.relation = 'existence'
		expect(compiledSeparation(successOnly)).toBe(false)
	})

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
