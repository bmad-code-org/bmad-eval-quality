// The `mcp` branch of `permittedInterfaces`: what a tool call declares, what
// the branch refuses, and the compile checks that read the shape while the kind
// gate is still closed.

import { describe, expect, it } from 'vitest'
import {
	checkDuplicateOperationSignature,
	checkInterfaceKind,
	checkUndeclaredMandatoryInput,
} from '../../src/core/compile/interface-inventory.ts'
import { checkEvidenceReachability } from '../../src/core/compile/reachability.ts'
import {
	checkSensitivityWitnessDeclared,
	checkWitnessLegality,
} from '../../src/core/compile/sensitivity-witness.ts'
import {
	descriptorArtifactOf,
	descriptorChannelOf,
	inputChannelsOf,
	isApiOperation,
	isCommandOperation,
	isMcpOperation,
	requestShapeOf,
} from '../../src/core/declared-inputs.ts'
import { StructuralFailure } from '../../src/core/failure-codes.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { operationsOf } from '../../src/core/schemas/interface.ts'
import { renderStepReference } from '../../src/core/seal/derived-reference.ts'
import {
	anyOperationOf,
	buildPlanIndex,
} from '../../src/core/seal/plan-index.ts'
import { commandContract } from './fixtures/command-contract.ts'
import { mcpContract } from './fixtures/mcp-contract.ts'
import { populatedContract } from './fixtures/relevance-contracts.ts'

const mutated = (mutate: (contract: any) => void) => {
	const clone = structuredClone(mcpContract) as any
	mutate(clone)
	return EvalContract.safeParse(clone)
}

const operation = (contract: any, index = 0) =>
	contract.permittedInterfaces[0].operations[index]

const failureOf = (fn: () => void): StructuralFailure => {
	try {
		fn()
	} catch (error) {
		if (error instanceof StructuralFailure) return error
		throw error
	}
	throw new Error('expected a StructuralFailure to be thrown')
}

describe('the mcp branch', () => {
	it('parses a contract whose system under test is a tool server', () => {
		expect(EvalContract.safeParse(mcpContract).success).toBe(true)
	})

	it('refuses a tool call declaring a method and a path template', () => {
		expect(
			mutated((c) => {
				operation(c).method = 'POST'
				operation(c).pathTemplate = '/tools/call'
			}).success,
		).toBe(false)
	})

	it('refuses an api operation declaring a tool name', () => {
		const clone = structuredClone(populatedContract) as any
		clone.permittedInterfaces[0].operations[0].toolName = 'search_notes'
		expect(EvalContract.safeParse(clone).success).toBe(false)
	})

	it.each(['https://host/tools', 'host:8080', 'a/b', 'notes.search'])(
		'refuses the tool name %s, which discloses a target AD-35 keeps out of a contract',
		(toolName) => {
			expect(
				mutated((c) => {
					operation(c).toolName = toolName
				}).success,
			).toBe(false)
		},
	)

	it.each(['search_notes', 'searchNotes', 'search-notes', 'Search2'])(
		'admits the tool name %s, in whichever spelling the server publishes',
		(toolName) => {
			expect(
				mutated((c) => {
					operation(c).toolName = toolName
				}).success,
			).toBe(true)
		},
	)

	it('refuses a request channel a tool call does not have', () => {
		expect(
			mutated((c) => {
				operation(c).requestShape.body = {
					requiredKeys: [],
					permittedKeys: [],
					types: {},
				}
			}).success,
		).toBe(false)
	})

	it('admits an operation declaring no argument keys and no witness', () => {
		expect(
			mutated((c) => {
				const target = operation(c)
				target.requestShape.arguments = {
					requiredKeys: [],
					permittedKeys: [],
					types: {},
				}
				target.sensitivityWitness = null
			}).success,
		).toBe(true)
	})
})

describe('the descriptor channel carries the one-structured-result restriction', () => {
	it('admits the structured-result tag', () => {
		expect(EvalContract.safeParse(mcpContract).success).toBe(true)
	})

	it.each([{ kind: 'text-content' }, 'response-body', { kind: 'stream' }])(
		'refuses %o as a descriptor channel',
		(descriptorChannel) => {
			expect(
				mutated((c) => {
					operation(c).descriptorChannel = descriptorChannel
				}).success,
			).toBe(false)
		},
	)

	it('resolves the nominated channel to response-body and nominates no artifact', () => {
		const contract = EvalContract.parse(mcpContract)
		const [tool] = operationsOf(contract.permittedInterfaces[0]!)
		expect(descriptorChannelOf(tool!)).toBe('response-body')
		expect(descriptorArtifactOf(tool!)).toBeNull()
	})
})

describe('which operation shape a resolver sees', () => {
	const contract = EvalContract.parse(mcpContract)
	const [tool] = operationsOf(contract.permittedInterfaces[0]!)

	it('answers the tool-call predicate and neither of the other two', () => {
		expect(isMcpOperation(tool!)).toBe(true)
		expect(isCommandOperation(tool!)).toBe(false)
		expect(isApiOperation(tool!)).toBe(false)
	})

	it('gives a tool call one input channel rather than the four transport ones', () => {
		expect(inputChannelsOf(tool!)).toEqual(['arguments'])
		expect(requestShapeOf(tool!, 'arguments')?.requiredKeys).toEqual(['query'])
		expect(requestShapeOf(tool!, 'body')).toBeUndefined()
	})
})

describe('the witness channel AD-10 admits for a tool call', () => {
	it('admits a witness on the arguments channel', () => {
		const contract = EvalContract.parse(mcpContract)
		expect(() => checkWitnessLegality(contract)).not.toThrow()
	})

	it('refuses a witness on a transport channel', () => {
		const parsed = mutated((c) => {
			operation(c).sensitivityWitness.channel = 'body'
		})
		expect(parsed.success).toBe(true)
		const failure = failureOf(() => checkWitnessLegality(parsed.data!))
		expect(failure.code).toBe('malformed-operator-expression')
		expect(failure.message).toContain('"arguments"')
	})

	it('admits the channel whichever value the state-change marker takes', () => {
		const contract = EvalContract.parse(mcpContract)
		const [search, create] = operationsOf(contract.permittedInterfaces[0]!)
		expect(search!.stateChangeMarker).toBe(false)
		expect(create!.stateChangeMarker).toBe(true)
		expect(() => checkWitnessLegality(contract)).not.toThrow()
	})
})

describe('what a tool call can be asked about', () => {
	const oracleOver = (pointer: string) => {
		const clone = structuredClone(mcpContract) as any
		clone.oracles[0].check.operands[0].pointer = pointer
		clone.oracles[0].direction.evidenceTargets = [pointer]
		return EvalContract.parse(clone)
	}

	it('resolves a pointer at a declared argument through the request shape', () => {
		const contract = oracleOver(
			'/interactions/search/call-inputs/arguments/query',
		)
		expect(() => checkEvidenceReachability(contract)).not.toThrow()
	})

	it('refuses a pointer at an argument the tool does not declare', () => {
		const contract = oracleOver(
			'/interactions/search/call-inputs/arguments/absent',
		)
		expect(failureOf(() => checkEvidenceReachability(contract)).code).toBe(
			'unreachable-check-evidence',
		)
	})

	it.each([
		'/interactions/search/response-headers/etag',
		'/interactions/search/exit-code',
		'/interactions/search/stdout',
		'/interactions/search/stderr',
	])('refuses %s, a channel a tool call never fills', (pointer) => {
		expect(
			failureOf(() => checkEvidenceReachability(oracleOver(pointer))).code,
		).toBe('unreachable-check-evidence')
	})

	it('admits response-status, where the error flag lands', () => {
		expect(() =>
			checkEvidenceReachability(
				oracleOver('/interactions/search/response-status'),
			),
		).not.toThrow()
	})
})

describe('every compile check but the kind gate admits the contract', () => {
	const contract = EvalContract.parse(mcpContract)

	it('passes the checks that read an operation shape', () => {
		expect(() => checkEvidenceReachability(contract)).not.toThrow()
		expect(() => checkDuplicateOperationSignature(contract)).not.toThrow()
		expect(() => checkUndeclaredMandatoryInput(contract)).not.toThrow()
		expect(() => checkSensitivityWitnessDeclared(contract)).not.toThrow()
		expect(() => checkWitnessLegality(contract)).not.toThrow()
	})

	it('fails the kind gate, which is the one thing still closed', () => {
		const failure = failureOf(() => checkInterfaceKind(contract))
		expect(failure.code).toBe('unsupported-interface-kind')
	})
})

describe('a step binding the wrong kind of channel is the compiler question', () => {
	it('parses a step binding transport channels against a tool call', () => {
		const parsed = mutated((c) => {
			c.interactionPlan[0].inputBinding = {
				path: null,
				query: null,
				header: null,
				body: { query: { literal: 'alpha' } },
			}
		})
		expect(parsed.success).toBe(true)
		expect(
			failureOf(() => checkUndeclaredMandatoryInput(parsed.data!)).code,
		).toBe('undeclared-mandatory-input')
	})
})

describe('an mcp tool and a cli executable sharing a name', () => {
	it('compiles past the duplicate check, since identities compare inside their own kind', () => {
		const merged = structuredClone(mcpContract) as any
		const command = structuredClone(commandContract) as any
		merged.permittedInterfaces[0].operations[0].toolName = 'notes'
		command.permittedInterfaces[0].operations[0].invocation = {
			executable: 'notes',
			subcommandPath: [],
		}
		merged.permittedInterfaces.push(command.permittedInterfaces[0])
		const contract = EvalContract.parse(merged)
		expect(() => checkDuplicateOperationSignature(contract)).not.toThrow()
	})
})

describe('the plan index sorts a tool call into its own map', () => {
	const contract = EvalContract.parse(mcpContract)
	const index = buildPlanIndex(
		contract.interactionPlan,
		contract.permittedInterfaces,
	)

	it('answers the tool-call accessor and neither of the other two', () => {
		expect(index.mcpOperationOf('search-notes')?.toolName).toBe('search_notes')
		expect(index.operationOf('search-notes')).toBeUndefined()
		expect(index.commandOperationOf('search-notes')).toBeUndefined()
	})

	it('resolves it through the kind-neutral accessor', () => {
		const operation = anyOperationOf(index, 'search-notes')
		expect(operation).toBeDefined()
		expect(isMcpOperation(operation!)).toBe(true)
	})

	it('names it a tool in a sealed brief, on the noun-follows-the-kind rule', () => {
		const step = index.stepOf('search')
		const operation = anyOperationOf(index, 'search-notes')
		expect(step).toBeDefined()
		expect(operation).toBeDefined()
		expect(renderStepReference(step!, operation!, [step!], index)).toContain(
			'the search notes tool',
		)
	})
})
