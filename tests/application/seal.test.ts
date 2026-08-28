/**
 * `seal` (Story 6.5): the published boundary that compiles, then seals. The
 * cases below drive AC 4's precondition table one contract at a time. Two of
 * its five rows are pre-empted by a compile check and assert a
 * `StructuralFailure` reaching the caller unconverted; the other three reach
 * `core/seal`'s `TypeError` sites and assert the boundary's conversion.
 */
import { describe, expect, it } from 'vitest'
import { compile } from '../../src/application/compile.ts'
import { seal } from '../../src/application/seal.ts'
import { StructuralFailure } from '../../src/core/failure-codes.ts'
import { RuntimeFault } from '../../src/core/schemas/faults.ts'
import { seal as sealContract } from '../../src/core/seal/seal.ts'
import { cleanPopulatedContract } from '../compile/helpers.ts'
import { gateCContract } from '../schemas/fixtures/gate-c-contract.ts'

/** a deep copy of the sealable fixture a case may mutate before sealing it. */
const contractDraft = (): any => structuredClone(gateCContract)

const thrownBy = (act: () => unknown): unknown => {
	try {
		act()
	} catch (error) {
		return error
	}
	throw new Error('expected the call to throw')
}

const faultOf = (act: () => unknown): RuntimeFault => {
	const thrown = thrownBy(act)
	expect(thrown).toBeInstanceOf(RuntimeFault)
	return thrown as RuntimeFault
}

/** the pre-empted rows: a compile failure must reach the caller as itself. */
const unconvertedFailureOf = (act: () => unknown): StructuralFailure => {
	const thrown = thrownBy(act)
	expect(thrown).not.toBeInstanceOf(RuntimeFault)
	expect(thrown).toBeInstanceOf(StructuralFailure)
	return thrown as StructuralFailure
}

describe('application seal: the compiled-then-sealed brief', () => {
	it('case 95: the brief equals seal(compile(contract)) called directly', () => {
		const composed = sealContract(compile(contractDraft()))
		expect(seal(contractDraft())).toEqual(composed)
	})

	it('case 96: the returned brief is frozen', () => {
		const brief = seal(contractDraft())
		expect(Object.isFrozen(brief)).toBe(true)
		expect(Object.isFrozen(brief.directions)).toBe(true)
		expect(Object.isFrozen(brief.budgets)).toBe(true)
	})

	// The Zod error on `cause` is what separates this from the three cases
	// below: those carry a `TypeError` raised inside `core/seal`.
	it('case 97: a non-contract input throws schema-parse-failure from the compile parse', () => {
		const fault = faultOf(() => seal({ not: 'a contract' }))
		expect(fault.code).toBe('schema-parse-failure')
		expect(fault.artifactPath).toBe('EvalContract')
		expect((fault.cause as { issues?: unknown[] }).issues).toBeDefined()
	})

	it('case 103: the brief is a lineage root, minted rather than revised', () => {
		const brief = seal(contractDraft())
		expect(brief.parentDigest).toBeNull()
		expect(brief.revisionCount).toBe(0)
	})

	// One contract, both settings: strict is on by default and reaches the
	// core stage as given when the caller sets it.
	it('case 104: strict passes through both ways', () => {
		const contract = cleanPopulatedContract() as any
		contract.interactionPlan[0].inputBinding.body.undeclaredKey = {
			literal: 'x',
		}
		const failure = unconvertedFailureOf(() => seal(contract))
		expect(failure.code).toBe('undeclared-mandatory-input')
		expect(Object.isFrozen(seal(contract, { strict: false }))).toBe(true)
	})
})

describe("application seal: AC 4's precondition table", () => {
	// `oracle-alignment.ts:12-19` fires before `seal.ts:62` can, so a
	// `RuntimeFault` here would disprove the row.
	it('case 98: a null oracle direction reaches the caller as StructuralFailure oracle-missing-channel', () => {
		const contract = contractDraft()
		contract.oracles[0].direction = null
		const failure = unconvertedFailureOf(() => seal(contract))
		expect(failure.code).toBe('oracle-missing-channel')
		expect(failure.artifactPath).toBe(
			'EvalContract.oracles[id=O-001].direction',
		)
	})

	// `forbidden-inputs.ts:21-29` rejects any scoped resource at all, so the
	// duplicate reference never reaches `seal.ts:118-122`.
	it('case 99: a duplicate scopedResources reference reaches the caller as StructuralFailure scoped-reference-resolves-forbidden', () => {
		const contract = contractDraft()
		contract.scopedResources = [
			{ reference: 'doc://shared', kind: 'document' },
			{ reference: 'doc://shared', kind: 'document' },
		]
		const failure = unconvertedFailureOf(() => seal(contract))
		expect(failure.code).toBe('scoped-reference-resolves-forbidden')
		expect(failure.artifactPath).toBe(
			'EvalContract.scopedResources[0].reference',
		)
	})

	// No AD-5 check covers `oracle.id` uniqueness, so `seal.ts:112` fires and
	// the boundary converts its `TypeError`.
	it('case 100: a duplicate oracleId gives RuntimeFault schema-parse-failure', () => {
		const contract = contractDraft()
		contract.oracles.push(structuredClone(contract.oracles[0]))
		const fault = faultOf(() => seal(contract))
		expect(fault.code).toBe('schema-parse-failure')
		expect(fault.artifactPath).toBe('EvalContract')
		expect(fault.cause).toBeInstanceOf(TypeError)
		expect(fault.message).toContain('duplicate oracleId')
	})

	// A second interface declaring the same `logicalId` and no operations:
	// the plan index stays unambiguous, so compile passes it and
	// `seal.ts:113-117` fires.
	it('case 101: two permittedInterfaces sharing one logicalId gives RuntimeFault schema-parse-failure', () => {
		const contract = contractDraft()
		contract.permittedInterfaces.push({
			logicalId: contract.permittedInterfaces[0].logicalId,
			kind: 'api',
			operations: [],
		})
		const fault = faultOf(() => seal(contract))
		expect(fault.code).toBe('schema-parse-failure')
		expect(fault.artifactPath).toBe('EvalContract')
		expect(fault.cause).toBeInstanceOf(TypeError)
		expect(fault.message).toContain('duplicate permittedInterfaces logicalId')
	})

	// `EvalContract.oracles` carries no minimum and
	// `SealedEvaluatorBrief.directions` is `.min(1)`, so a zero-oracle
	// contract compiles clean and `seal.ts:156` rejects the assembled brief.
	it('case 102: a zero-oracle contract reaching validateAssembledBrief gives RuntimeFault schema-parse-failure', () => {
		const contract = contractDraft()
		contract.oracles = []
		for (const behavior of contract.behaviors) behavior.oracles = []
		expect(compile(structuredClone(contract)).oracles).toEqual([])
		const fault = faultOf(() => seal(contract))
		expect(fault.code).toBe('schema-parse-failure')
		expect(fault.artifactPath).toBe('EvalContract')
		expect(fault.cause).toBeInstanceOf(TypeError)
		expect(fault.message).toContain(
			'failed SealedEvaluatorBrief validation: 1 issue, first at "directions"',
		)
	})
})
