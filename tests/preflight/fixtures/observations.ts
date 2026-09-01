/**
 * The contract, probes, and observation builders every `tests/preflight/` file
 * reads. A shared helper module inside its own directory, matching
 * `tests/coverage/fixtures/`; test files never import each other.
 *
 * The contract declares four operations on purpose, one per shape AD-10
 * distinguishes: a mutating write with a body differential and a volatile
 * response field, a path-parameter-only safe read (AD-10's own named shape),
 * a safe read with a query differential over a declared collection, and a
 * keyless mutating reset the fixture-reset branch names.
 */

import { EvalContract } from '../../../src/core/schemas/eval-contract.ts'
import type { Operation } from '../../../src/core/schemas/interface.ts'
import type {
	ProbeObservation,
	ProbeObservedBody,
} from '../../../src/core/schemas/port-messages.ts'
import type { JsonValue } from '../../../src/core/schemas/primitives.ts'
import { Probe } from '../../../src/core/schemas/probe.ts'
import type { WitnessInputs } from '../../../src/core/schemas/sensitivity-witness.ts'

export const jsonBody = (value: JsonValue): ProbeObservedBody => ({
	kind: 'json',
	value,
})

export const absentBody = (): ProbeObservedBody => ({ kind: 'absent' })

export const textBody = (value: string): ProbeObservedBody => ({
	kind: 'text',
	value,
})

const emptyChannel = () => ({
	requiredKeys: [] as string[],
	permittedKeys: [] as string[],
	types: {} as Record<string, 'string' | 'number' | 'boolean' | 'array'>,
})

export const inputsOf = (
	patch: Partial<WitnessInputs> = {},
): WitnessInputs => ({
	path: {},
	query: {},
	header: {},
	body: { kind: 'absent' },
	...patch,
})

const digestOf = (ordinal: number): string =>
	`sha256:${ordinal.toString(16).padStart(64, '0')}`

const contractLiteral = {
	schemaVersion: 1,
	contractId: 'preflight-fixture',
	parentDigest: null,
	revisionCount: 0,
	sourceSpecDigest: null,
	behaviors: [
		{
			id: 'B-001',
			description: 'A behaviour, present so the contract declares something.',
			severity: 'low',
			observableSuccessCriterion: null,
			requirementLinks: [],
			riskLinks: [],
			oracles: [],
		},
	],
	oracles: [],
	rubrics: [],
	waivers: [],
	permittedInterfaces: [
		{
			logicalId: 'thing-api',
			kind: 'api',
			operations: [
				{
					operationId: 'create-thing',
					method: 'POST',
					pathTemplate: '/things',
					stateChangeMarker: true,
					requestShape: {
						path: emptyChannel(),
						query: emptyChannel(),
						header: emptyChannel(),
						body: {
							requiredKeys: ['name'],
							permittedKeys: ['name'],
							types: { name: 'string' },
						},
					},
					responseDescriptor: {
						requiredKeys: ['id', 'ok', 'echo'],
						permittedKeys: ['id', 'ok', 'echo'],
						types: { id: 'string', ok: 'boolean', echo: 'string' },
						successIndicator: '/ok',
						channelRoles: null,
						collectionLocations: null,
					},
					// The server-minted identifier: declared volatile, so it is
					// outside the projection and outside the relation's view.
					volatilePointers: ['/id'],
					sensitivityWitness: {
						witnessId: 'create-thing-sensitivity',
						channel: 'body',
						legs: [
							{
								legId: 'create-a',
								inputs: {
									path: {},
									query: {},
									header: {},
									body: { kind: 'json', value: { name: 'alpha' } },
								},
							},
							{
								legId: 'create-b',
								inputs: {
									path: {},
									query: {},
									header: {},
									body: { kind: 'json', value: { name: 'beta' } },
								},
							},
						],
						relation: {
							op: 'not',
							operands: [
								{
									op: 'equality',
									operands: [
										{ pointer: '/interactions/create-a/response-body/echo' },
										{ pointer: '/interactions/create-b/response-body/echo' },
									],
								},
							],
						},
					},
				},
				{
					operationId: 'read-thing',
					method: 'GET',
					pathTemplate: '/things/{id}',
					stateChangeMarker: false,
					requestShape: {
						path: {
							requiredKeys: ['id'],
							permittedKeys: ['id'],
							types: { id: 'string' },
						},
						query: emptyChannel(),
						header: emptyChannel(),
						body: emptyChannel(),
					},
					responseDescriptor: {
						requiredKeys: ['id', 'value'],
						permittedKeys: ['id', 'value'],
						types: { id: 'string', value: 'string' },
						successIndicator: null,
						channelRoles: null,
						collectionLocations: null,
					},
					volatilePointers: [],
					sensitivityWitness: {
						witnessId: 'read-thing-sensitivity',
						channel: 'path',
						legs: [
							{
								legId: 'read-a',
								inputs: {
									path: { id: 't-1' },
									query: {},
									header: {},
									body: { kind: 'absent' },
								},
							},
							{
								legId: 'read-b',
								inputs: {
									path: { id: 't-2' },
									query: {},
									header: {},
									body: { kind: 'absent' },
								},
							},
						],
						relation: {
							op: 'not',
							operands: [
								{
									op: 'equality',
									operands: [
										{ pointer: '/interactions/read-a/response-body/id' },
										{ pointer: '/interactions/read-b/response-body/id' },
									],
								},
							],
						},
					},
				},
				{
					operationId: 'list-things',
					method: 'GET',
					pathTemplate: '/things',
					stateChangeMarker: false,
					requestShape: {
						path: emptyChannel(),
						query: {
							requiredKeys: [],
							permittedKeys: ['limit'],
							types: { limit: 'number' },
						},
						header: emptyChannel(),
						body: emptyChannel(),
					},
					responseDescriptor: {
						requiredKeys: ['items'],
						permittedKeys: ['items'],
						types: { items: 'array' },
						successIndicator: null,
						channelRoles: null,
						collectionLocations: [
							{
								pointer: '/items',
								expectedCardinality: { mode: 'at-most', max: 10 },
								referenceSet: null,
							},
						],
					},
					volatilePointers: [],
					sensitivityWitness: {
						witnessId: 'list-things-sensitivity',
						channel: 'query',
						legs: [
							{
								legId: 'list-a',
								inputs: {
									path: {},
									query: { limit: 1 },
									header: {},
									body: { kind: 'absent' },
								},
							},
							{
								legId: 'list-b',
								inputs: {
									path: {},
									query: { limit: 2 },
									header: {},
									body: { kind: 'absent' },
								},
							},
						],
						relation: {
							op: 'not',
							operands: [
								{
									op: 'deep-equality',
									operands: [
										{ pointer: '/interactions/list-a/response-body/items' },
										{ pointer: '/interactions/list-b/response-body/items' },
									],
								},
							],
						},
					},
				},
				{
					operationId: 'reset-things',
					method: 'POST',
					pathTemplate: '/reset',
					stateChangeMarker: true,
					requestShape: {
						path: emptyChannel(),
						query: emptyChannel(),
						header: emptyChannel(),
						body: emptyChannel(),
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
					// AD-10's exemption: an operation declaring no keys in any
					// channel, which the reducer records as `exempt`.
					sensitivityWitness: null,
				},
			],
		},
	],
	referenceSets: null,
	siblingGroups: null,
	interactionPlan: [],
	scopedResources: null,
	forbiddenInputs: [],
	testData: { setup: null, cleanup: null, principals: null, resources: null },
	budgets: { maxToolCalls: 0, maxWallClockMinutes: 0, maxCostUsd: '0' },
	safetyLimits: [],
	requiredEvidence: [],
	probeStepBound: null,
	fixtureReset: null,
} satisfies EvalContract

/** the repeated-read branch: `fixtureReset` is null. */
export const preflightContract: EvalContract =
	EvalContract.parse(contractLiteral)

/** the four-leg branch: a declared reset naming the keyless mutating operation. */
export const resetContract: EvalContract = EvalContract.parse({
	...contractLiteral,
	contractId: 'preflight-fixture-reset',
	fixtureReset: {
		legId: 'reset-leg',
		interfaceId: 'thing-api',
		operationId: 'reset-things',
		inputs: inputsOf(),
	},
})

/** a deep copy a test may mutate before parsing it back. */
export const contractDraft = (): any => structuredClone(contractLiteral)

export const parseContract = (draft: unknown): EvalContract =>
	EvalContract.parse(draft)

export const operationNamed = (
	contract: EvalContract,
	operationId: string,
): Operation => {
	const found = contract.permittedInterfaces[0]?.operations.find(
		(candidate) => candidate.operationId === operationId,
	)
	if (found === undefined)
		throw new Error(`the fixture declares no operation "${operationId}"`)
	return found
}

const probeCommon = {
	schemaVersion: 1,
	parentDigest: null,
	revisionCount: 0,
	probeClass: 'defect',
	behaviorId: 'B-001',
	systemId: 'thing-api',
	implementationDigest: digestOf(1),
	artifactDigest: digestOf(2),
	commitDigest: digestOf(3),
	rationale: 'A seeded defect, carried so pre-flight has a fault to observe.',
} as const

/**
 * The seeded fault fires when every returned row carries `broken: true`. A
 * quantifier over a declared collection, so fixture 64 has an empty-collection
 * shape to produce `insufficient-evidence` from.
 */
export const manifestationRelation = {
	op: 'for-all',
	collection: { pointer: '/interactions/fault-leg/response-body/items' },
	predicate: {
		op: 'equality',
		operands: [{ pointer: '@/broken' }, { literal: true }],
	},
} as const

export const seededProbe: Probe = Probe.parse({
	...probeCommon,
	probeId: 'P-001',
	expectedClean: false,
	defects: [
		{
			defectId: 'D-001',
			behaviorId: 'B-001',
			summary: 'The list handler reports every row as broken.',
			severity: 'critical',
			oracleEvidence: [],
			source: 'controlled-mutation',
			manifestationWitness: {
				legId: 'fault-leg',
				interfaceId: 'thing-api',
				operationId: 'list-things',
				inputs: inputsOf({ query: { limit: 1 } }),
				relation: manifestationRelation,
			},
		},
	],
})

export const cleanControlProbe: Probe = Probe.parse({
	...probeCommon,
	probeId: 'P-002',
	probeClass: 'zero-action',
	expectedClean: true,
	rationale: 'The unmutated implementation, carried as a known-clean control.',
	defects: [],
})

/** a deep copy of the seeded probe a test may mutate before parsing it back. */
export const probeDraft = (): any => structuredClone(seededProbe)

export type ObservationPatch = {
	readonly status?: number
	readonly body?: ProbeObservedBody
	readonly headers?: Record<string, string>
	readonly interfaceId?: string
	readonly operationId?: string
}

/**
 * One observation echoing a planned leg's request, with named fields
 * overridden. Every leg the plan names must be answered, or the reducer
 * reports it missing, which is what fixture 39 asserts.
 */
export const observationsFor = (
	legs: readonly {
		legId: string
		request: { interfaceId: string; operationId: string }
	}[],
	patches: Readonly<Record<string, ObservationPatch>> = {},
): ProbeObservation[] =>
	legs.map((leg) => {
		const patch = patches[leg.legId] ?? {}
		return {
			probeId: leg.legId,
			interfaceId: patch.interfaceId ?? leg.request.interfaceId,
			operationId: patch.operationId ?? leg.request.operationId,
			status: patch.status ?? 200,
			headers: patch.headers ?? {},
			body: patch.body ?? absentBody(),
		}
	})

/**
 * The body every leg returns when nothing is being varied: distinct per
 * operation, and distinct per leg where the witness expects a differential.
 */
export const SATISFIED_BODIES: Readonly<Record<string, ProbeObservedBody>> = {
	'create-a': jsonBody({ id: 'x-1', ok: true, echo: 'alpha' }),
	'create-b': jsonBody({ id: 'x-2', ok: true, echo: 'beta' }),
	'read-a': jsonBody({ id: 't-1', value: 'alpha' }),
	'read-b': jsonBody({ id: 't-2', value: 'beta' }),
	'list-a': jsonBody({ items: [{ id: 'r-1' }] }),
	'list-b': jsonBody({ items: [{ id: 'r-1' }, { id: 'r-2' }] }),
	'fault-leg': jsonBody({ items: [{ id: 'r-1', broken: true }] }),
	'reset-leg': absentBody(),
}

/** the control-observe legs read `read-thing` with `read-a`'s inputs. */
export const CONTROL_BODY = jsonBody({ id: 't-1', value: 'alpha' })

export const satisfiedPatches = (
	legs: readonly { legId: string }[],
): Record<string, ObservationPatch> => {
	const patches: Record<string, ObservationPatch> = {}
	for (const leg of legs) {
		const declared = SATISFIED_BODIES[leg.legId]
		patches[leg.legId] = {
			body: declared ?? CONTROL_BODY,
		}
	}
	return patches
}
