// A contract every one of AD-31's seven relevance predicates and all seven
// satisfaction predicates fire on. The four Epic 1 fixtures answer "not
// satisfied" or "vacuously satisfied" almost everywhere, so without this one
// the satisfaction columns prove only that nothing fires.
//
// It compiles clean under `compile(contract, { strict: false })` (fixture
// 128), so no verdict here rests on a shape the compiler rejects.
//
// Which oracle witnesses which rule:
//   O-001  rule 6, the bijection form against `expected-things`
//   O-002  rule 1 for `create-thing`, and rule 2
//   O-003  rule 1 for `list-things`
//   O-004  rule 3 for both operations, and rule 5's operation group
//   O-005  rule 5's parameter group
//   O-006  rule 7
//   O-007  rule 4

import type { EvalContract } from '../../../src/core/schemas/eval-contract.ts'

const emptyChannel = {
	requiredKeys: [] as string[],
	permittedKeys: [] as string[],
	types: {} as Record<string, null>,
}

export const satisfiedContract = {
	schemaVersion: 1,
	contractId: 'satisfied-declarations',
	parentDigest: null,
	revisionCount: 0,
	sourceSpecDigest: null,
	behaviors: [
		{
			id: 'B-001',
			description: 'A created thing is readable back in the list of things.',
			severity: 'critical',
			observableSuccessCriterion:
				'A list call after a create returns one element per seeded thing, carrying the name the create call sent.',
			requirementLinks: [{ scheme: 'local', id: 'REQ-1' }],
			riskLinks: [{ scheme: 'local-risk', id: 'RISK-1' }],
			oracles: ['O-001', 'O-002', 'O-003', 'O-004', 'O-005', 'O-006', 'O-007'],
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
			commentary: 'Reconciles the whole list against the declared set.',
		},
		{
			id: 'O-002',
			direction: {
				evidenceTargets: [
					'/interactions/create/response-body/ok',
					'/interactions/create/response-body/id',
					'/interactions/create/response-body/error',
				],
				relation: 'all',
				polarity: 'expects-hold',
				scope: 'The whole create response.',
				negativeDomain:
					'A create reporting success with no identifier, or with a diagnostic beside it.',
			},
			check: {
				op: 'all',
				operands: [
					{
						op: 'existence',
						operands: [{ pointer: '/interactions/create/response-body/ok' }],
					},
					{
						op: 'existence',
						operands: [{ pointer: '/interactions/create/response-body/id' }],
					},
					{
						op: 'absence',
						operands: [{ pointer: '/interactions/create/response-body/error' }],
					},
				],
			},
			polarity: 'expects-hold',
			commentary: null,
		},
		{
			id: 'O-003',
			direction: {
				evidenceTargets: [
					'/interactions/list/response-body/items',
					'/interactions/list/response-body/error',
				],
				relation: 'all',
				polarity: 'expects-hold',
				scope: 'The list response taken as a whole.',
				negativeDomain: 'A list carrying items alongside a diagnostic field.',
			},
			check: {
				op: 'all',
				operands: [
					{
						op: 'existence',
						operands: [{ pointer: '/interactions/list/response-body/items' }],
					},
					{
						op: 'absence',
						operands: [{ pointer: '/interactions/list/response-body/error' }],
					},
				],
			},
			polarity: 'expects-hold',
			commentary: null,
		},
		{
			id: 'O-004',
			direction: {
				evidenceTargets: [
					'/interactions/malformed-create/response-body/error',
					'/interactions/malformed-list/response-body/error',
				],
				relation: 'all',
				polarity: 'expects-hold',
				scope:
					'Both sibling operations, each given an input that violates its declared type.',
				negativeDomain:
					'One sibling rejecting the malformed input while the other accepts it.',
			},
			check: {
				op: 'all',
				operands: [
					{
						op: 'existence',
						operands: [
							{ pointer: '/interactions/malformed-create/response-body/error' },
						],
					},
					{
						op: 'existence',
						operands: [
							{ pointer: '/interactions/malformed-list/response-body/error' },
						],
					},
				],
			},
			polarity: 'expects-hold',
			commentary: null,
		},
		{
			id: 'O-005',
			direction: {
				evidenceTargets: [
					'/interactions/create/call-inputs/body/name',
					'/interactions/list/call-inputs/query/limit',
				],
				relation: 'all',
				polarity: 'expects-hold',
				scope: 'The two sibling parameters, as sent.',
				negativeDomain: 'One parameter carried and the other dropped.',
			},
			check: {
				op: 'all',
				operands: [
					{
						op: 'existence',
						operands: [
							{ pointer: '/interactions/create/call-inputs/body/name' },
						],
					},
					{
						op: 'existence',
						operands: [
							{ pointer: '/interactions/list/call-inputs/query/limit' },
						],
					},
				],
			},
			polarity: 'expects-hold',
			commentary: null,
		},
		{
			id: 'O-006',
			direction: {
				evidenceTargets: [
					'/interactions/list/response-body/items',
					'/interactions/create/call-inputs/body/name',
				],
				relation: 'containment',
				polarity: 'expects-hold',
				scope:
					'The list read after the create, against the name the create sent.',
				negativeDomain:
					'A create reporting success whose thing never appears in a later list.',
			},
			check: {
				op: 'containment',
				operands: [
					{ pointer: '/interactions/list/response-body/items' },
					{ pointer: '/interactions/create/call-inputs/body/name' },
				],
			},
			polarity: 'expects-hold',
			commentary: null,
		},
		{
			id: 'O-007',
			direction: {
				evidenceTargets: ['/interactions/list/response-body/items'],
				relation: 'for-all',
				polarity: 'expects-hold',
				scope: 'Every element of the returned list.',
				negativeDomain:
					'A list whose first element carries an identifier and whose later elements do not.',
			},
			check: {
				op: 'for-all',
				collection: { pointer: '/interactions/list/response-body/items' },
				predicate: { op: 'existence', operands: [{ pointer: '@/id' }] },
			},
			polarity: 'expects-hold',
			commentary: null,
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
							'/id': 'payload',
							'/error': 'diagnostic',
						},
						collectionLocations: [],
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
									header: {},
									query: { limit: 1 },
									body: { kind: 'absent' },
								},
							},
							{
								legId: 'list-witness-b',
								inputs: {
									path: {},
									header: {},
									query: { limit: 2 },
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
										{ pointer: '/interactions/list-witness-a/response-body' },
										{ pointer: '/interactions/list-witness-b/response-body' },
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
		{
			stepId: 'malformed-create',
			operationId: 'create-thing',
			inputBinding: {
				path: null,
				query: null,
				header: null,
				body: { name: { matcher: 'type-violating' } },
			},
			after: null,
			cardinality: 'exactly-one',
		},
		{
			stepId: 'malformed-list',
			operationId: 'list-things',
			inputBinding: {
				path: null,
				query: { limit: { matcher: 'type-violating' } },
				header: null,
				body: null,
			},
			after: null,
			cardinality: 'exactly-one',
		},
	],
	scopedResources: null,
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
		principals: null,
		resources: null,
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
