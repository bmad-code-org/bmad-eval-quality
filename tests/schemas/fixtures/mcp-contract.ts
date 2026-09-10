// A contract whose system under test is an MCP tool server. One interface, two
// tools the server publishes, and oracles that address the structured result
// each tool's response descriptor declares.
//
// It is the accept fixture for the `mcp` branch of `permittedInterfaces`, and
// the end-to-end evidence that a tool-call contract is shaped the way every
// compile check but the kind gate expects.

import type { EvalContract } from '../../../src/core/schemas/eval-contract.ts'

export const mcpContract = {
	schemaVersion: 5,
	contractId: 'notes-tool-server',
	parentDigest: null,
	revisionCount: 0,
	sourceSpecDigest: null,
	behaviors: [
		{
			id: 'B-001',
			description: 'A search over the notes returns the notes that match.',
			severity: 'material',
			observableSuccessCriterion:
				'A search names at least one match and never more than the server holds.',
			requirementLinks: [{ scheme: 'local', id: 'REQ-1' }],
			riskLinks: [{ scheme: 'local-risk', id: 'RISK-1' }],
			oracles: ['O-001', 'O-002'],
		},
		{
			id: 'B-002',
			description: 'Creating a note returns the identifier it was filed under.',
			severity: 'material',
			observableSuccessCriterion:
				'A creation call answers with an identifier and reports no error.',
			requirementLinks: [{ scheme: 'local', id: 'REQ-2' }],
			riskLinks: [{ scheme: 'local-risk', id: 'RISK-2' }],
			oracles: ['O-003'],
		},
	],
	oracles: [
		{
			id: 'O-001',
			direction: {
				evidenceTargets: ['/interactions/search/response-body/matches'],
				relation: 'existence',
				polarity: 'expects-hold',
				scope: 'One search call for one query.',
				negativeDomain: 'A search naming no match at all.',
			},
			check: {
				op: 'existence',
				operands: [{ pointer: '/interactions/search/response-body/matches' }],
			},
			polarity: 'expects-hold',
			commentary:
				'Reads the collection the tool declares its structured result carries.',
		},
		{
			// A quantifier over the declared collection, so AD-20 rule 4 is
			// relevant and decided rather than vacuous. A fixture that leaves
			// every rule irrelevant grades nothing, which is how a whole
			// interface kind went ungraded in the first place.
			id: 'O-002',
			direction: {
				evidenceTargets: ['/interactions/search/response-body/matches'],
				relation: 'for-all',
				polarity: 'expects-hold',
				scope: 'Every match the search names.',
				negativeDomain: 'A named match carrying no identifier.',
			},
			check: {
				op: 'for-all',
				collection: { pointer: '/interactions/search/response-body/matches' },
				predicate: { op: 'existence', operands: [{ pointer: '@/noteId' }] },
			},
			polarity: 'expects-hold',
			commentary: 'Every named match carries an identifier.',
		},
		{
			id: 'O-003',
			direction: {
				evidenceTargets: ['/interactions/create/response-body/noteId'],
				relation: 'existence',
				polarity: 'expects-hold',
				scope: 'One creation call for one note.',
				negativeDomain: 'A creation answering with no identifier.',
			},
			check: {
				op: 'existence',
				operands: [{ pointer: '/interactions/create/response-body/noteId' }],
			},
			polarity: 'expects-hold',
			commentary: 'Reads the identifier the creation tool declares it returns.',
		},
	],
	rubrics: [],
	waivers: [],
	permittedInterfaces: [
		{
			logicalId: 'notes-tool-server',
			kind: 'mcp',
			operations: [
				{
					operationId: 'search-notes',
					toolName: 'search_notes',
					stateChangeMarker: false,
					requestShape: {
						arguments: {
							requiredKeys: ['query'],
							permittedKeys: ['query', 'limit'],
							types: { query: 'string', limit: 'number' },
						},
					},
					descriptorChannel: { kind: 'structured-result' },
					responseDescriptor: {
						requiredKeys: ['matches', 'isError'],
						permittedKeys: ['matches', 'isError'],
						types: { matches: 'array', isError: 'boolean' },
						successIndicator: '/isError',
						channelRoles: {
							'/matches': 'collection',
							'/isError': 'success-indicator',
						},
						collectionLocations: [
							{
								pointer: '/matches',
								referenceSet: null,
								expectedCardinality: { mode: 'at-most', max: 20 },
							},
						],
					},
					volatilePointers: [],
					sensitivityWitness: {
						witnessId: 'search-follows-the-query',
						channel: 'arguments',
						legs: [
							{
								legId: 'leg-first-query',
								inputs: { arguments: { query: 'alpha' } },
							},
							{
								legId: 'leg-second-query',
								inputs: { arguments: { query: 'beta' } },
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
												'/interactions/leg-first-query/response-body/matches',
										},
										{
											pointer:
												'/interactions/leg-second-query/response-body/matches',
										},
									],
								},
							],
						},
					},
				},
				{
					// A second tool on the same server. Both calls share the one
					// transport identity every MCP call shares, so the tool name is
					// the whole of what tells the two signatures apart.
					operationId: 'create-note',
					toolName: 'create_note',
					stateChangeMarker: true,
					requestShape: {
						arguments: {
							requiredKeys: ['title'],
							permittedKeys: ['title', 'body'],
							types: { title: 'string', body: 'string' },
						},
					},
					descriptorChannel: { kind: 'structured-result' },
					responseDescriptor: {
						requiredKeys: ['noteId', 'isError'],
						permittedKeys: ['noteId', 'isError'],
						types: { noteId: 'string', isError: 'boolean' },
						successIndicator: '/isError',
						channelRoles: {
							'/noteId': 'payload',
							'/isError': 'success-indicator',
						},
						collectionLocations: [],
					},
					volatilePointers: [],
					sensitivityWitness: {
						witnessId: 'creation-follows-the-title',
						channel: 'arguments',
						legs: [
							{
								legId: 'leg-first-title',
								inputs: { arguments: { title: 'the first note' } },
							},
							{
								legId: 'leg-second-title',
								inputs: { arguments: { title: 'the second note' } },
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
												'/interactions/leg-first-title/response-body/noteId',
										},
										{
											pointer:
												'/interactions/leg-second-title/response-body/noteId',
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
	referenceSets: null,
	siblingGroups: null,
	interactionPlan: [
		{
			stepId: 'search',
			operationId: 'search-notes',
			after: null,
			cardinality: 'exactly-one',
			inputBinding: { arguments: { query: { literal: 'alpha' } } },
		},
		{
			stepId: 'create',
			operationId: 'create-note',
			after: null,
			cardinality: 'exactly-one',
			inputBinding: { arguments: { title: { literal: 'a new note' } } },
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
	testData: { setup: null, cleanup: null, principals: null, resources: null },
	budgets: { maxToolCalls: 4, maxWallClockMinutes: 5, maxCostUsd: '1.00' },
	safetyLimits: [],
	requiredEvidence: [],
	probeStepBound: null,
	fixtureReset: null,
} satisfies EvalContract
