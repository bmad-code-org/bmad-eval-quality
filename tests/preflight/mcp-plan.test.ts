// Pre-flight against a system under test behind an MCP tool server: the legs
// the plan mints and the request the port is handed.
//
// The third file of the `plan.test.ts` and `command-plan.test.ts` pair, and it
// stops one step earlier than either. `ProbeObservation` carries no tool-call
// member yet, so nothing can answer an mcp leg, and what an api or a cli answer
// gets instead is the last case here.

import { describe, expect, it } from 'vitest'
import { compile } from '../../src/core/compile/compile.ts'
import { StructuralFailure } from '../../src/core/failure-codes.ts'
import { planPreflight } from '../../src/core/preflight/plan.ts'
import { reducePreflight } from '../../src/core/preflight/reduce.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { RuntimeFault } from '../../src/core/schemas/faults.ts'
import type { ProbeObservation } from '../../src/core/schemas/port-messages.ts'
import { mcpContract } from '../schemas/fixtures/mcp-contract.ts'

const RUN_ID = 'mcp-run-0001'

const planOf = () =>
	planPreflight({
		contract: compile(EvalContract.parse(mcpContract), { strict: true }),
		probes: [],
		runId: RUN_ID,
	})

describe('planning an mcp interface', () => {
	it('mints one leg per witness leg and hands the port a tool-call request', () => {
		const legs = planOf().legs.filter((leg) => leg.purpose === 'sensitivity')
		expect(legs.map((leg) => leg.legId)).toEqual([
			'leg-first-query',
			'leg-second-query',
			'leg-first-title',
			'leg-second-title',
		])
		const [first] = legs
		const request = first?.request
		if (request?.kind !== 'mcp')
			throw new Error('an mcp operation plans a tool-call request')
		expect(request.toolName).toBe('search_notes')
		expect(request.channels.arguments).toEqual({ query: 'alpha' })
		// NFR9's correlation by identifier, the same triple every other kind
		// carries, so the reducer binds the answer to this leg and no other.
		expect(request.probeId).toBe('leg-first-query')
		expect(request.interfaceId).toBe('notes-tool-server')
		expect(request.operationId).toBe('search-notes')
	})

	it('plans a tool-call request for every leg, whatever the purpose', () => {
		const { legs } = planOf()
		expect(legs.length).toBeGreaterThan(0)
		for (const leg of legs) expect(leg.request.kind).toBe('mcp')
	})

	it('carries the six keys AD-35 admits and no seventh', () => {
		// The correlation triple, the discriminant, the published tool name, and
		// the one channel. `ToolName`'s charset already makes an address
		// unrepresentable in the field that could carry one, so the claim worth
		// asserting is the key set: a seventh field is where an address would
		// arrive.
		const { legs } = planOf()
		expect(legs.length).toBeGreaterThan(0)
		for (const leg of legs) {
			expect(Object.keys(leg.request).sort()).toEqual([
				'channels',
				'interfaceId',
				'kind',
				'operationId',
				'probeId',
				'toolName',
			])
		}
	})

	// An operation with no required key has nothing a control leg must fill, so
	// an empty leg is a legal request for it. This is `declaresNoRequiredKeys`,
	// the plan-side predicate, which is weaker than compile's own AD-10
	// exemption over all three key lists. Which empty leg depends on the kind:
	// the four transport channels are wrong for a tool call whatever the gate
	// does.
	it('sends an empty arguments object for an operation declaring no required key', () => {
		const draft = structuredClone(mcpContract) as any
		const operation = draft.permittedInterfaces[0].operations[0]
		operation.requestShape.arguments.requiredKeys = []
		operation.sensitivityWitness = null
		const plan = planPreflight({
			contract: EvalContract.parse(draft),
			probes: [],
			runId: RUN_ID,
		})
		const observe = plan.legs.find((leg) => leg.purpose === 'control-observe')
		const request = observe?.request
		if (request?.kind !== 'mcp')
			throw new Error('the control leg plans a tool-call request')
		expect(request.toolName).toBe('search_notes')
		expect(request.channels).toEqual({ arguments: {} })
	})

	it('plans the fixture reset as its own tool call', () => {
		const reset = planOf().legs.find((leg) => leg.purpose === 'control-reset')
		const request = reset?.request
		if (request?.kind !== 'mcp')
			throw new Error('the fixture reset plans a tool-call request')
		expect(request.toolName).toBe('create_note')
		expect(request.channels.arguments).toEqual({ title: 'the clean fixture' })
	})
})

describe('a leg of the wrong shape against a tool call', () => {
	// `WitnessInputs` is a plain union with no discriminator, so transport
	// channels parse against a tool call and `checkWitnessLegality` is what
	// refuses them at compile. A caller who assembled a plan by hand reaches
	// this arm instead, and it names the mismatch rather than reporting the
	// first `arguments` key as omitted.
	it('names the mismatch rather than an omitted key', () => {
		const draft = structuredClone(mcpContract) as any
		const witness =
			draft.permittedInterfaces[0].operations[0].sensitivityWitness
		witness.legs[0].inputs = {
			path: {},
			query: { query: 'alpha' },
			header: {},
			body: { kind: 'absent' },
		}
		let thrown: unknown
		try {
			planPreflight({
				contract: EvalContract.parse(draft),
				probes: [],
				runId: RUN_ID,
			})
		} catch (error) {
			thrown = error
		}
		expect(thrown).toBeInstanceOf(StructuralFailure)
		expect((thrown as StructuralFailure).code).toBe(
			'undeclared-mandatory-input',
		)
		expect((thrown as StructuralFailure).message).toContain(
			'channels a tool call does not carry',
		)
	})
})

describe('answering an mcp leg with an observation of another mechanism', () => {
	const answerWith = (observation: ProbeObservation) => {
		const plan = planOf()
		return () => reducePreflight(plan, { observations: [observation] })
	}

	const legIdOf = () => {
		const [first] = planOf().legs
		if (first === undefined) throw new Error('the plan mints at least one leg')
		return first.legId
	}

	it('reports a command answer as a port-contract violation', () => {
		let thrown: unknown
		try {
			answerWith({
				probeId: legIdOf(),
				interfaceId: 'notes-tool-server',
				operationId: 'search-notes',
				kind: 'cli',
				exitCode: 0,
				stdout: { kind: 'absent' },
				stderr: { kind: 'absent' },
				artifacts: {},
			})()
		} catch (error) {
			thrown = error
		}
		expect(thrown).toBeInstanceOf(RuntimeFault)
		expect((thrown as RuntimeFault).code).toBe('port-contract-violation')
		expect((thrown as RuntimeFault).message).toContain('asked for a "mcp"')
	})

	it('reports a transport answer the same way', () => {
		let thrown: unknown
		try {
			answerWith({
				probeId: legIdOf(),
				interfaceId: 'notes-tool-server',
				operationId: 'search-notes',
				kind: 'api',
				status: 200,
				headers: {},
				body: { kind: 'absent' },
			})()
		} catch (error) {
			thrown = error
		}
		expect(thrown).toBeInstanceOf(RuntimeFault)
		expect((thrown as RuntimeFault).code).toBe('port-contract-violation')
	})
})
