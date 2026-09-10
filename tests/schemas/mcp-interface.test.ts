// The `mcp` branch of `permittedInterfaces`: what a tool call declares, what
// the branch refuses, and the compile checks that read the shape while the kind
// gate is still closed.

import { describe, expect, it } from 'vitest'
import {
	checkBindingCycle,
	checkCapturedChannel,
} from '../../src/core/compile/bindings.ts'
import { compile } from '../../src/core/compile/compile.ts'
import { checkExcludedContent } from '../../src/core/compile/excluded-content.ts'
import {
	checkForbiddenInputFloor,
	checkScopedResourceReferences,
} from '../../src/core/compile/forbidden-inputs.ts'
import {
	checkDuplicateOperationSignature,
	checkInterfaceKind,
	checkUndeclaredMandatoryInput,
} from '../../src/core/compile/interface-inventory.ts'
import { checkEvidenceReachability } from '../../src/core/compile/reachability.ts'
import {
	checkRubricAnchoring,
	checkRubricEvidenceReachability,
	checkRubricIdentifiers,
	checkRubricReasoningProse,
} from '../../src/core/compile/rubrics.ts'
import {
	checkNestedTemporalClause,
	checkScriptingBound,
} from '../../src/core/compile/scripting-bound.ts'
import {
	checkSensitivityWitnessDeclared,
	checkWitnessLegality,
	checkWitnessLegIdentifiers,
} from '../../src/core/compile/sensitivity-witness.ts'
import { checkStepReferenceReducibility } from '../../src/core/compile/step-reference.ts'
import { checkWaiverCompleteness } from '../../src/core/compile/waivers.ts'
import { evaluateRelevance } from '../../src/core/coverage/relevance.ts'
import { evaluateSatisfaction } from '../../src/core/coverage/satisfaction.ts'
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
import { DefectSignature } from '../../src/core/schemas/defect-signature.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { operationsOf } from '../../src/core/schemas/interface.ts'
import { resolveHomeOperation } from '../../src/core/score/qualification.ts'
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

	// The marker decides nothing for a tool call, so the case worth writing is
	// the negative one against the mutating tool: the api rule would have
	// answered `body` legal there, which is what the old negation did.
	it('refuses a transport channel on the mutating tool as well', () => {
		const parsed = mutated((c) => {
			operation(c, 1).sensitivityWitness.channel = 'body'
		})
		expect(parsed.success).toBe(true)
		expect(operation(parsed.data, 1).stateChangeMarker).toBe(true)
		const failure = failureOf(() => checkWitnessLegality(parsed.data!))
		expect(failure.code).toBe('malformed-operator-expression')
		expect(failure.message).toContain('"arguments"')
	})
})

describe('what a tool call can be asked about', () => {
	// Replaces the first oracle outright rather than editing inside it: the
	// fixture's own oracles are compound now, and a mutation reaching into one
	// would be asserting about the mutation rather than about the pointer.
	const oracleOver = (pointer: string) => {
		const clone = structuredClone(mcpContract) as any
		clone.oracles[0] = {
			id: 'O-001',
			direction: {
				evidenceTargets: [pointer],
				relation: 'existence',
				polarity: 'expects-hold',
				scope: 'One search call.',
				negativeDomain: 'The evidence is absent.',
			},
			check: { op: 'existence', operands: [{ pointer }] },
			polarity: 'expects-hold',
			commentary: null,
		}
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

describe('the whole compile pipeline, minus the kind gate', () => {
	const contract = EvalContract.parse(mcpContract)

	// `compile` itself rather than a hand-picked subset. Naming five checks
	// let the other twenty-eight regress against this fixture while the file
	// claiming to cover them stayed green, and Stories 11.7 and 11.8 both
	// depend on the fixture compiling under the whole pipeline.
	it('stops at the kind gate and at nothing before it', () => {
		const failure = failureOf(() => compile(contract, { strict: true }))
		expect(failure.code).toBe('unsupported-interface-kind')
		expect(failure.artifactPath).toBe(
			'EvalContract.permittedInterfaces[logicalId=notes-tool-server].kind',
		)
	})

	// `compile` stopping at the gate proves every check ahead of it passes.
	// The fifteen below are the ones that run after it, in `compile.ts`'s own
	// order, so between the two assertions the whole pipeline is covered and
	// opening the gate is the only thing Story 11.5 has to do here.
	it.each([
		['checkNestedTemporalClause', checkNestedTemporalClause],
		['checkScriptingBound', checkScriptingBound],
		['checkBindingCycle', checkBindingCycle],
		['checkCapturedChannel', checkCapturedChannel],
		['checkRubricIdentifiers', checkRubricIdentifiers],
		['checkRubricReasoningProse', checkRubricReasoningProse],
		['checkRubricAnchoring', checkRubricAnchoring],
		['checkRubricEvidenceReachability', checkRubricEvidenceReachability],
		['checkForbiddenInputFloor', checkForbiddenInputFloor],
		['checkExcludedContent', checkExcludedContent],
		['checkScopedResourceReferences', checkScopedResourceReferences],
		['checkWaiverCompleteness', checkWaiverCompleteness],
		['checkStepReferenceReducibility', checkStepReferenceReducibility],
		['checkWitnessLegIdentifiers', checkWitnessLegIdentifiers],
		['checkWitnessLegality', checkWitnessLegality],
	] as const)('%s admits it, which runs after the gate', (_name, check) => {
		expect(() => check(contract)).not.toThrow()
	})

	it('grades all seven discipline rules relevant and satisfied', () => {
		const relevance = evaluateRelevance(contract)
		const satisfaction = evaluateSatisfaction(contract)
		expect(relevance.map((v) => v.relevant)).toEqual(relevance.map(() => true))
		expect(satisfaction.map((v) => v.satisfied)).toEqual(
			satisfaction.map(() => true),
		)
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

describe('a witness leg of the wrong shape is diagnosed as one', () => {
	// `WitnessInputs` is a plain union with no discriminator, so a tool call's
	// arguments parse on a command interface. Before this check the key loop
	// reported the first required key as omitted, which describes a consequence
	// of the mismatch and names the wrong field.
	const commandWithToolCallLegs = () => {
		const clone = structuredClone(commandContract) as any
		const witness =
			clone.permittedInterfaces[0].operations[0].sensitivityWitness
		witness.legs[0].inputs = { arguments: { prompt: 'the first task' } }
		witness.legs[1].inputs = { arguments: { prompt: 'the second task' } }
		return EvalContract.parse(clone)
	}

	it('parses, because the union carries no discriminator', () => {
		expect(() => commandWithToolCallLegs()).not.toThrow()
	})

	it('names the shape mismatch at compile rather than a missing key', () => {
		const failure = failureOf(() =>
			checkSensitivityWitnessDeclared(commandWithToolCallLegs()),
		)
		expect(failure.code).toBe('undeclared-mandatory-input')
		expect(failure.message).toContain('tool-call channels')
		expect(failure.message).toContain('command channels')
	})

	it('refuses to plan a leg for it, so no input-less differential is issued', async () => {
		const { planPreflight } = await import('../../src/core/preflight/plan.ts')
		const failure = failureOf(() =>
			planPreflight({
				contract: commandWithToolCallLegs(),
				probes: [],
				runId: 'mcp-leg-shape',
			}),
		)
		expect(failure.code).toBe('undeclared-mandatory-input')
		expect(failure.message).toContain("a tool call's arguments")
	})
})

describe('a transport identity is compared inside its own shape family', () => {
	// The narrowing is deliberate and coarse in one direction: `api` and `web`
	// share an operation shape, so they share a family and still collide.
	it('still refuses an api and a web interface sharing a method and a path', () => {
		const clone = structuredClone(populatedContract) as any
		const [first] = clone.permittedInterfaces
		clone.permittedInterfaces.push({
			...structuredClone(first),
			logicalId: 'thing-web',
			kind: 'web',
			operations: [
				{
					...structuredClone(first.operations[0]),
					operationId: 'list-things-on-the-web',
				},
			],
		})
		const failure = failureOf(() =>
			checkDuplicateOperationSignature(EvalContract.parse(clone)),
		)
		expect(failure.code).toBe('duplicate-operation-signature')
		expect(failure.message).toContain('api-shaped')
	})

	// Two MCP servers publishing the same tool name are refused, and the author
	// has no fix: renaming the tool breaks the binding to the real server. The
	// identity carries no server segment because AD-40 needs it contract-
	// independent, so this is a recorded limitation rather than an oversight,
	// and the fix if it ever bites is a namespace on the map key.
	it('refuses two mcp interfaces publishing the same tool name', () => {
		const clone = structuredClone(mcpContract) as any
		const [first] = clone.permittedInterfaces
		clone.permittedInterfaces.push({
			...structuredClone(first),
			logicalId: 'other-tool-server',
			operations: [
				{
					...structuredClone(first.operations[0]),
					operationId: 'search-other-notes',
				},
			],
		})
		const failure = failureOf(() =>
			checkDuplicateOperationSignature(EvalContract.parse(clone)),
		)
		expect(failure.code).toBe('duplicate-operation-signature')
		expect(failure.message).toContain('"search_notes"')
	})

	it('resolves an mcp signature against no api operation', () => {
		const contract = EvalContract.parse(populatedContract)
		const [api] = contract.permittedInterfaces
		const [operation] = operationsOf(api!)
		if (!isApiOperation(operation!)) throw new Error('fixture is api-shaped')
		const signature = {
			interfaceKind: 'mcp',
			method: operation.method,
			pathTemplate: operation.pathTemplate,
			observableChannel: 'response-body',
			condition: {
				selector: {
					inputBinding: {
						path: null,
						query: null,
						header: null,
						body: null,
						argument: null,
						option: null,
						environment: null,
						stdin: null,
					},
				},
				predicate: {
					op: 'existence',
					operands: [{ pointer: '/interactions/observed/response-body' }],
				},
			},
		} as const
		expect(
			resolveHomeOperation(
				DefectSignature.parse(signature),
				contract.permittedInterfaces,
			),
		).toBeNull()
		// The same signature declaring `api` binds, so the null above is the
		// family filter and not a rendering accident.
		expect(
			resolveHomeOperation(
				DefectSignature.parse({ ...signature, interfaceKind: 'api' }),
				contract.permittedInterfaces,
			),
		).toBe(operation)
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
