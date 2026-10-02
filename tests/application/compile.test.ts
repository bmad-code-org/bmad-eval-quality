import { describe, expect, it } from 'vitest'
import { compile } from '../../src/application/compile.ts'
import { StructuralFailure } from '../../src/core/failure-codes.ts'
import { EVAL_CONTRACT_SCHEMA_VERSION } from '../../src/core/schemas/eval-contract.ts'
import { RuntimeFault } from '../../src/core/schemas/faults.ts'
import { cleanPopulatedContract } from '../compile/helpers.ts'
import { gateCContract } from '../schemas/fixtures/gate-c-contract.ts'
import { populatedContract } from '../schemas/fixtures/relevance-contracts.ts'

describe('application compile: boundary validation and delegation', () => {
	it('an invalid input throws RuntimeFault schema-parse-failure with artifactPath EvalContract and the Zod error as cause', () => {
		let thrown: unknown
		try {
			compile({ not: 'a contract' })
		} catch (error) {
			thrown = error
		}
		expect(thrown).toBeInstanceOf(RuntimeFault)
		const fault = thrown as RuntimeFault
		expect(fault.code).toBe('schema-parse-failure')
		expect(fault.artifactPath).toBe('EvalContract')
		expect(fault.cause).toBeDefined()
		expect((fault.cause as { issues?: unknown[] }).issues).toBeDefined()
	})

	it('a structural defect propagates the original StructuralFailure instance shape, never converted to a RuntimeFault', () => {
		const contract = structuredClone(populatedContract) as any
		contract.behaviors[0].requirementLinks = []
		contract.behaviors[0].riskLinks = []
		let thrown: unknown
		try {
			compile(contract)
		} catch (error) {
			thrown = error
		}
		expect(thrown).toBeInstanceOf(StructuralFailure)
		const failure = thrown as StructuralFailure
		expect(failure.code).toBe('missing-requirement-linkage')
		expect(failure.artifactPath).toContain('behaviors[id=B-001]')
	})

	it('defaults strict to true: an undeclared input is rejected with no options argument', () => {
		const contract = cleanPopulatedContract() as any
		contract.interactionPlan[0].inputBinding.body.undeclaredKey = {
			literal: 'x',
		}
		let thrown: unknown
		try {
			compile(contract)
		} catch (error) {
			thrown = error
		}
		expect(thrown).toBeInstanceOf(StructuralFailure)
		expect((thrown as StructuralFailure).code).toBe(
			'undeclared-mandatory-input',
		)
	})

	it('explicit strict: false reaches the core stage as false: the same undeclared-input fixture is accepted', () => {
		const contract = cleanPopulatedContract() as any
		contract.interactionPlan[0].inputBinding.body.undeclaredKey = {
			literal: 'x',
		}
		expect(() => compile(contract, { strict: false })).not.toThrow()
	})

	it('a valid caller-owned input is deep-cloned at parse time: the returned contract shares no mutable nested collection with the input', () => {
		const input = structuredClone(gateCContract) as any
		const result = compile(input)
		expect(result).toEqual(input)
		expect(result.behaviors).not.toBe(input.behaviors)
		expect(result.permittedInterfaces).not.toBe(input.permittedInterfaces)
		input.behaviors[0].description = 'mutated after the call'
		expect(result.behaviors[0]?.description).not.toBe('mutated after the call')
	})

	it('the return is synchronous: never a Promise, even on a value that resolves cleanly', () => {
		const result = compile(structuredClone(gateCContract))
		expect(result).not.toBeInstanceOf(Promise)
		expect(typeof (result as { then?: unknown }).then).not.toBe('function')
	})

	it('populatedContract compiles under an explicit clean scopedResources override, proving the orchestration path end to end', () => {
		expect(() => compile(cleanPopulatedContract())).not.toThrow()
	})
})

describe('application compile: the contract stamp is read before the contract parses', () => {
	const stale = EVAL_CONTRACT_SCHEMA_VERSION - 1
	const faultOf = (input: unknown): RuntimeFault => {
		let thrown: unknown
		try {
			compile(input)
		} catch (error) {
			thrown = error
		}
		expect(thrown).toBeInstanceOf(RuntimeFault)
		return thrown as RuntimeFault
	}

	it('names a contract stamped one version below, with both versions', () => {
		const fault = faultOf({
			...structuredClone(gateCContract),
			schemaVersion: stale,
		})
		expect(fault.code).toBe('schema-version-mismatch')
		expect(fault.artifactPath).toBe('EvalContract.schemaVersion')
		expect(fault.message).toContain(
			`carries "schemaVersion" ${stale} where this build reads ${EVAL_CONTRACT_SCHEMA_VERSION}`,
		)
	})

	it('reports the stamp of a contract whose shape is also the previous version', () => {
		const fault = faultOf({ schemaVersion: stale, contractId: 'older-shape' })
		expect(fault.code).toBe('schema-version-mismatch')
	})

	it('leaves a null input to the parse', () => {
		const fault = faultOf(null)
		expect(fault.code).toBe('schema-parse-failure')
		expect(fault.artifactPath).toBe('EvalContract')
	})

	it('leaves a contract with no numeric stamp to the parse, which names the schema', () => {
		const { schemaVersion: _stamp, ...unstamped } =
			structuredClone(gateCContract)
		const fault = faultOf(unstamped)
		expect(fault.code).toBe('schema-parse-failure')
		expect(fault.artifactPath).toBe('EvalContract')
	})
})
