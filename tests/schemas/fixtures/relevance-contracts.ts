// Three contracts covering AD-31's three declaration states across every
// relevance axis: everything absent, everything explicitly empty, everything
// populated. Story 5.3's corpus is unbuildable if any one of the three is not
// expressible, so each ships as an accept fixture in its own right.

import type { EvalContract } from '../../../src/core/schemas/eval-contract.ts'

const emptyChannel = {
	requiredKeys: [] as string[],
	permittedKeys: [] as string[],
	types: {} as Record<string, null>,
}

const emptyRequestShape = {
	path: emptyChannel,
	query: emptyChannel,
	header: emptyChannel,
	body: emptyChannel,
}

const minimalBehavior: EvalContract['behaviors'][number] = {
	id: 'B-001',
	description:
		'A minimal behaviour, present so the contract declares something.',
	severity: 'low',
	observableSuccessCriterion: null,
	requirementLinks: [],
	riskLinks: [],
	oracles: [],
}

/** every axis in its absent state: the declaration is `null`. */
export const absentContract = {
	schemaVersion: 1,
	contractId: 'absent-declarations',
	parentDigest: null,
	revisionCount: 0,
	sourceSpecDigest: null,
	behaviors: [minimalBehavior],
	oracles: [],
	rubrics: [],
	waivers: [],
	permittedInterfaces: [
		{
			logicalId: 'thing-api',
			kind: 'api',
			operations: [
				{
					operationId: 'read-thing',
					method: 'GET',
					pathTemplate: '/things/{id}',
					stateChangeMarker: false,
					requestShape: emptyRequestShape,
					responseDescriptor: {
						requiredKeys: ['value'],
						permittedKeys: ['value'],
						types: {},
						successIndicator: null,
						channelRoles: null,
						collectionLocations: null,
					},
					volatilePointers: [],
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
	testData: { setup: null, cleanup: null },
	budgets: { maxToolCalls: 0, maxWallClockMinutes: 0, maxCostUsd: '0' },
	safetyLimits: [],
	requiredEvidence: [],
	probeStepBound: null,
	fixtureReset: null,
} satisfies EvalContract

/** every axis in its explicitly-empty state: the declaration is present and empty. */
export const explicitlyEmptyContract = {
	...absentContract,
	contractId: 'empty-declarations',
	permittedInterfaces: [
		{
			logicalId: 'thing-api',
			kind: 'api',
			operations: [
				{
					operationId: 'read-thing',
					method: 'GET',
					pathTemplate: '/things/{id}',
					stateChangeMarker: false,
					requestShape: emptyRequestShape,
					responseDescriptor: {
						requiredKeys: ['value'],
						permittedKeys: ['value'],
						types: {},
						successIndicator: null,
						channelRoles: {},
						collectionLocations: [],
					},
					volatilePointers: [],
					sensitivityWitness: null,
				},
			],
		},
	],
	referenceSets: {},
	siblingGroups: { operations: [], parameters: [] },
	scopedResources: [],
} satisfies EvalContract

/** every axis populated, so every relevance predicate fires. */
export const populatedContract = {
	schemaVersion: 2,
	contractId: 'populated-declarations',
	parentDigest:
		'sha256:0000000000000000000000000000000000000000000000000000000000000abc',
	revisionCount: 1,
	sourceSpecDigest:
		'sha256:0000000000000000000000000000000000000000000000000000000000000def',
	behaviors: [
		{
			id: 'B-001',
			description: 'Listing things returns every expected thing exactly once.',
			severity: 'critical',
			observableSuccessCriterion:
				'A list call returns one element per seeded thing and no element the seed did not create.',
			requirementLinks: [{ scheme: 'local', id: 'REQ-1' }],
			riskLinks: [{ scheme: 'local-risk', id: 'RISK-1' }],
			oracles: ['O-001'],
		},
	],
	oracles: [
		{
			id: 'O-001',
			direction: {
				evidenceTargets: ['/interactions/list/response-body/items'],
				relation: 'covers-by-key',
				polarity: 'expects-hold',
				scope: 'One list call over the seeded set.',
				negativeDomain: 'A list omitting a seeded thing, or repeating one.',
			},
			check: {
				op: 'covers-by-key',
				operands: [
					{ referenceSet: 'expected-things' },
					{ pointer: '/interactions/list/response-body/items' },
				],
				expectedKey: 'id',
				actualKey: 'id',
			},
			polarity: 'expects-hold',
			commentary: 'Reconciles the page against the declared reference set.',
		},
	],
	rubrics: [
		{
			id: 'R-001',
			scaleLevels: [{ level: 1, anchor: 'Every expected thing is present.' }],
			failureModePenalties: [
				{ name: 'omission', description: 'An expected thing is missing.' },
			],
			maxLength: 400,
			criteria: [
				{
					id: 'RC-001',
					text: 'Does the returned list carry every expected identifier?',
					evidence: '/interactions/list/response-body/items',
				},
			],
		},
	],
	waivers: [
		{
			id: 'W-001',
			rule: 'omission-and-completeness',
			rationale: 'The upstream seed is unavailable in the sandbox environment.',
			condition: null,
			approval: 'gate-c-reviewer',
			expiresAt: '2027-01-01T00:00:00Z',
		},
	],
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
						path: emptyChannel,
						query: emptyChannel,
						header: emptyChannel,
						body: {
							requiredKeys: ['name'],
							permittedKeys: ['name'],
							types: { name: 'string' },
						},
					},
					responseDescriptor: {
						requiredKeys: ['id', 'ok'],
						permittedKeys: ['id', 'ok', 'error'],
						types: { id: 'string', ok: 'boolean', error: 'string' },
						successIndicator: '/ok',
						channelRoles: {
							'/ok': 'success-indicator',
							'/error': 'diagnostic',
						},
						collectionLocations: null,
					},
					volatilePointers: ['/id'],
					sensitivityWitness: {
						witnessId: 'create-thing-sensitivity',
						channel: 'body',
						legs: [
							{
								legId: 'create-witness-a',
								inputs: {
									path: {},
									query: {},
									header: {},
									body: { kind: 'json', value: { name: 'alpha' } },
								},
							},
							{
								legId: 'create-witness-b',
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
									op: 'deep-equality',
									operands: [
										{ pointer: '/interactions/create-witness-a/response-body' },
										{ pointer: '/interactions/create-witness-b/response-body' },
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
						path: emptyChannel,
						query: {
							requiredKeys: [],
							permittedKeys: ['limit'],
							types: { limit: 'number' },
						},
						header: emptyChannel,
						body: emptyChannel,
					},
					responseDescriptor: {
						requiredKeys: ['items'],
						permittedKeys: ['items', 'error'],
						types: { items: 'array', error: 'string' },
						successIndicator: '/items',
						channelRoles: {
							'/items': 'collection',
							'/error': 'diagnostic',
						},
						collectionLocations: [
							{
								pointer: '/items',
								expectedCardinality: { mode: 'exact', count: 3 },
								referenceSet: 'expected-things',
							},
						],
					},
					volatilePointers: [],
					sensitivityWitness: {
						witnessId: 'list-things-sensitivity',
						channel: 'query',
						legs: [
							{
								legId: 'list-witness-a',
								inputs: {
									path: {},
									query: { limit: 1 },
									header: {},
									body: { kind: 'absent' },
								},
							},
							{
								legId: 'list-witness-b',
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
										{
											pointer:
												'/interactions/list-witness-a/response-body/items',
										},
										{
											pointer:
												'/interactions/list-witness-b/response-body/items',
										},
									],
								},
							],
						},
					},
				},
			],
		},
	],
	referenceSets: {
		'expected-things': {
			keys: ['id'],
			members: [{ id: 't-1' }, { id: 't-2' }, { id: 't-3' }],
			commentary: null,
		},
	},
	siblingGroups: {
		operations: [['create-thing', 'list-things']],
		parameters: [['limit', 'name']],
	},
	interactionPlan: [
		{
			stepId: 'create',
			operationId: 'create-thing',
			inputBinding: {
				path: null,
				query: null,
				header: null,
				body: { name: { matcher: 'any' } },
			},
			after: null,
			cardinality: 'exactly-one',
		},
		{
			stepId: 'list',
			operationId: 'list-things',
			inputBinding: {
				path: null,
				query: { limit: { literal: 10 } },
				header: null,
				body: null,
			},
			after: 'create',
			cardinality: 'exactly-one',
		},
	],
	scopedResources: [{ reference: 'seed-manifest', kind: 'fixture' }],
	forbiddenInputs: [
		'original-spec',
		'source-code',
		'repository',
		'builder-transcript',
		'implementation-logs',
		'comparator-results',
		'human-labels',
	],
	testData: {
		setup: 'Seed exactly three things with identifiers t-1, t-2, t-3.',
		cleanup: 'Delete every thing created during the run.',
	},
	budgets: {
		maxToolCalls: 20,
		maxWallClockMinutes: 5,
		maxCostUsd: '0.25',
	},
	safetyLimits: [
		'No request to any host other than the mapped thing-api target.',
	],
	requiredEvidence: ['Request and response pair for every call, in order.'],
	probeStepBound: 8,
	fixtureReset: null,
} satisfies EvalContract

export const RELEVANCE_CONTRACTS = [
	{ name: 'everything absent', contract: absentContract },
	{ name: 'everything explicitly empty', contract: explicitlyEmptyContract },
	{ name: 'everything populated', contract: populatedContract },
] as const
