import { describe, expect, it } from 'vitest'
import { compile } from '../../src/core/compile/compile.ts'
import {
	checkDuplicateOperationSignature,
	checkInterfaceKind,
	checkUndeclaredMandatoryInput,
} from '../../src/core/compile/interface-inventory.ts'
import { StructuralFailure } from '../../src/core/failure-codes.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { gateCContract } from '../schemas/fixtures/gate-c-contract.ts'
import { populatedContract } from '../schemas/fixtures/relevance-contracts.ts'
import { cleanPopulatedContract } from './helpers.ts'

function structuralFailureOf(fn: () => void): StructuralFailure {
	try {
		fn()
	} catch (error) {
		if (error instanceof StructuralFailure) return error
		throw error
	}
	throw new Error('expected a StructuralFailure to be thrown')
}

describe('all three checks: positive whole-fixture regression', () => {
	it('fixture 29: all three checks pass with no throw against populatedContract and gateCContract', () => {
		for (const raw of [populatedContract, gateCContract]) {
			const contract = EvalContract.parse(raw)
			expect(() => checkInterfaceKind(contract)).not.toThrow()
			expect(() => checkDuplicateOperationSignature(contract)).not.toThrow()
			expect(() => checkUndeclaredMandatoryInput(contract)).not.toThrow()
		}
	})
})

describe('checkInterfaceKind: unsupported-interface-kind', () => {
	it.each(['web', 'cli', 'mcp'])(
		"fixture 30: ad5-admissions.test.ts's %s-interface mutation throws",
		(kind) => {
			const contract = structuredClone(populatedContract) as any
			contract.permittedInterfaces[0].kind = kind
			const failure = structuralFailureOf(() => checkInterfaceKind(contract))
			expect(failure.code).toBe('unsupported-interface-kind')
		},
	)
})

describe('checkDuplicateOperationSignature: duplicate-operation-signature', () => {
	it("fixture 31: ad5-admissions.test.ts's parameter-name-erasure-collision mutation throws, naming both operationIds", () => {
		const contract = structuredClone(populatedContract) as any
		const operations = contract.permittedInterfaces[0].operations
		operations[1].pathTemplate = '/things/{id}'
		const twin = structuredClone(operations[1])
		twin.operationId = 'list-things-again'
		twin.pathTemplate = '/things/{identifier}'
		operations.push(twin)
		const failure = structuralFailureOf(() =>
			checkDuplicateOperationSignature(contract),
		)
		expect(failure.code).toBe('duplicate-operation-signature')
		expect(failure.artifactPath).toContain('operationId=list-things-again')
		expect(failure.message).toContain('operationId=list-things]')
	})

	it('fixture 32: identical, not merely erasure-equivalent, path templates also collide', () => {
		const contract = structuredClone(populatedContract) as any
		const operations = contract.permittedInterfaces[0].operations
		const twin = structuredClone(operations[1])
		twin.operationId = 'list-things-twin'
		operations.push(twin)
		const failure = structuralFailureOf(() =>
			checkDuplicateOperationSignature(contract),
		)
		expect(failure.code).toBe('duplicate-operation-signature')
	})

	it('fixture 33: differing only by method (same erased path template) does not collide', () => {
		const contract = structuredClone(populatedContract) as any
		const operations = contract.permittedInterfaces[0].operations
		// POST /things exists already. Use PUT to isolate the method.
		const twin = structuredClone(operations[1])
		twin.operationId = 'list-things-put'
		twin.method = 'PUT'
		operations.push(twin)
		expect(() => checkDuplicateOperationSignature(contract)).not.toThrow()
	})

	// Two interfaces prove collision checks use the full inventory.
	const emptyKeyedShape = { requiredKeys: [], permittedKeys: [], types: {} }

	it('review finding: a collision across two different permittedInterfaces entries still throws', () => {
		const contract = structuredClone(populatedContract) as any
		contract.permittedInterfaces.push({
			logicalId: 'thing-api-v2',
			kind: 'api',
			operations: [
				{
					operationId: 'list-things-v2',
					method: 'GET',
					pathTemplate: '/things',
					stateChangeMarker: false,
					requestShape: {
						path: emptyKeyedShape,
						query: emptyKeyedShape,
						header: emptyKeyedShape,
						body: emptyKeyedShape,
					},
					responseDescriptor: {
						requiredKeys: [],
						permittedKeys: [],
						types: {},
						successIndicator: null,
						channelRoles: null,
						collectionLocations: null,
					},
					volatilePointers: [],
				},
			],
		})
		const failure = structuralFailureOf(() =>
			checkDuplicateOperationSignature(contract),
		)
		expect(failure.code).toBe('duplicate-operation-signature')
		expect(failure.artifactPath).toBe(
			'EvalContract.permittedInterfaces[logicalId=thing-api-v2].operations[operationId=list-things-v2]',
		)
		expect(failure.message).toContain(
			'permittedInterfaces[logicalId=thing-api].operations[operationId=list-things]',
		)
	})

	it('erases every parameter name in a multi-parameter path', () => {
		const contract = structuredClone(populatedContract) as any
		const operations = contract.permittedInterfaces[0].operations
		const first = structuredClone(operations[1])
		first.operationId = 'list-team-things'
		first.pathTemplate = '/teams/{teamId}/things/{id}'
		const second = structuredClone(first)
		second.operationId = 'list-team-things-again'
		second.pathTemplate = '/teams/{team}/things/{thingId}'
		operations.push(first, second)
		expect(
			structuralFailureOf(() => checkDuplicateOperationSignature(contract))
				.code,
		).toBe('duplicate-operation-signature')
	})
})

describe('checkUndeclaredMandatoryInput: undeclared-mandatory-input', () => {
	it("fixture 34: ad5-admissions.test.ts's mutation throws", () => {
		const contract = structuredClone(populatedContract) as any
		contract.interactionPlan[0].inputBinding.body.undeclaredKey = {
			literal: 'x',
		}
		const failure = structuralFailureOf(() =>
			checkUndeclaredMandatoryInput(contract),
		)
		expect(failure.code).toBe('undeclared-mandatory-input')
	})

	it('fixture 35: a step naming an undeclared operation does not throw (documented gap), contrasted against fixture 34', () => {
		const contract = structuredClone(populatedContract) as any
		contract.interactionPlan[0].inputBinding.body.undeclaredKey = {
			literal: 'x',
		}
		contract.interactionPlan[0].operationId = 'no-such-operation'
		expect(() => checkUndeclaredMandatoryInput(contract)).not.toThrow()
	})

	it('fixture 36: a bound key declared in permittedKeys but not requiredKeys does not throw (union check)', () => {
		const contract = structuredClone(populatedContract) as any
		contract.interactionPlan[1].inputBinding.query = { limit: { literal: 10 } }
		expect(() => checkUndeclaredMandatoryInput(contract)).not.toThrow()
	})

	it.each(['path', 'query', 'header', 'body'])(
		'rejects an undeclared %s binding and encodes its caller key unambiguously',
		(channel) => {
			const contract = structuredClone(populatedContract) as any
			contract.interactionPlan[0].inputBinding = {
				path: null,
				query: null,
				header: null,
				body: null,
				[channel]: { 'user.name': { literal: 'x' } },
			}
			const failure = structuralFailureOf(() =>
				checkUndeclaredMandatoryInput(contract),
			)
			expect(failure.code).toBe('undeclared-mandatory-input')
			expect(failure.artifactPath).toContain(
				`.inputBinding.${channel}["user.name"]`,
			)
		},
	)

	it('does not crash when operation IDs repeat across interfaces', () => {
		const contract = structuredClone(populatedContract) as any
		const duplicate = structuredClone(contract.permittedInterfaces[0])
		duplicate.logicalId = 'second-api'
		duplicate.operations = [structuredClone(duplicate.operations[0])]
		duplicate.operations[0].method = 'PUT'
		duplicate.operations[0].pathTemplate = '/other-things'
		contract.permittedInterfaces.push(duplicate)
		expect(() => checkUndeclaredMandatoryInput(contract)).not.toThrow()
	})

	it('does not crash when step IDs repeat', () => {
		const contract = structuredClone(populatedContract) as any
		contract.interactionPlan.push(structuredClone(contract.interactionPlan[0]))
		expect(() => checkUndeclaredMandatoryInput(contract)).not.toThrow()
	})
})

// Owed item 3's second condition under the same code: a declared key whose
// `{ principal }` names a principal the contract never declared. AD-5's row is
// widened to carry both, so each needs its own message and its own artifact
// path.
describe('checkUndeclaredMandatoryInput: the principal condition', () => {
	it('throws on a { principal } naming a name testData.principals does not declare, addressing the binding site', () => {
		const contract = structuredClone(populatedContract) as any
		contract.interactionPlan[0].inputBinding.body.name = { principal: 'ghost' }
		const failure = structuralFailureOf(() =>
			checkUndeclaredMandatoryInput(contract),
		)
		expect(failure.code).toBe('undeclared-mandatory-input')
		expect(failure.artifactPath).toBe(
			'EvalContract.interactionPlan[stepId=create].inputBinding.body["name"]',
		)
		expect(failure.message).toContain('ghost')
	})

	it('does not throw on a { principal } naming a declared principal', () => {
		const contract = structuredClone(populatedContract) as any
		expect(contract.testData.principals).toHaveProperty('owner')
		contract.interactionPlan[0].inputBinding.body.name = { principal: 'owner' }
		expect(() => checkUndeclaredMandatoryInput(contract)).not.toThrow()
	})

	it.each([null, {}])(
		'throws with %j declared principals, which declare no name for any binding to reach',
		(principals) => {
			const contract = structuredClone(populatedContract) as any
			contract.testData.principals = principals
			contract.interactionPlan[0].inputBinding.body.name = {
				principal: 'owner',
			}
			expect(
				structuralFailureOf(() => checkUndeclaredMandatoryInput(contract)).code,
			).toBe('undeclared-mandatory-input')
		},
	)

	it('reports the undeclared-key condition under its own message when a { principal } sits on an undeclared key, so widening the check did not shadow it', () => {
		const contract = structuredClone(populatedContract) as any
		contract.interactionPlan[0].inputBinding.body.undeclaredKey = {
			principal: 'ghost',
		}
		const failure = structuralFailureOf(() =>
			checkUndeclaredMandatoryInput(contract),
		)
		expect(failure.code).toBe('undeclared-mandatory-input')
		expect(failure.artifactPath).toContain('["undeclaredKey"]')
		expect(failure.message).toContain(
			'in neither requiredKeys nor permittedKeys',
		)
		expect(failure.message).not.toContain('testData.principals')
	})

	it('is strict-gated like the key condition: compile rejects the undeclared principal under strict and accepts that exact contract under strict false', () => {
		const contract = cleanPopulatedContract() as any
		contract.interactionPlan[0].inputBinding.body.name = { principal: 'ghost' }
		const parsed = EvalContract.parse(contract)
		expect(
			structuralFailureOf(() => compile(parsed, { strict: true })).code,
		).toBe('undeclared-mandatory-input')
		expect(() => compile(parsed, { strict: false })).not.toThrow()
	})
})
