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
			oracles: ['O-001', 'O-002', 'O-005', 'O-006'],
		},
		{
			id: 'B-002',
			description: 'Creating a note returns the identifier it was filed under.',
			severity: 'material',
			observableSuccessCriterion:
				'A creation call answers with an identifier and reports no error.',
			requirementLinks: [{ scheme: 'local', id: 'REQ-2' }],
			riskLinks: [{ scheme: 'local-risk', id: 'RISK-2' }],
			oracles: ['O-003', 'O-004', 'O-007'],
		},
	],
	oracles: [
		{
			// Rule 1 and rule 2 over the search result: the tool's own success
			// field beside the collection it returns and the count it reports
			// for that collection, which is every required key of the descriptor
			// and three pointers carrying distinct roles.
			id: 'O-001',
			direction: {
				evidenceTargets: [
					'/interactions/search/response-body/ok',
					'/interactions/search/response-body/matches',
					'/interactions/search/response-body/totalCount',
				],
				relation: 'all',
				polarity: 'expects-hold',
				scope: 'One search call for one query.',
				negativeDomain: 'A search reporting success and naming no match.',
			},
			check: {
				op: 'all',
				operands: [
					{
						op: 'equality',
						operands: [
							{ pointer: '/interactions/search/response-body/ok' },
							{ literal: true },
						],
					},
					{
						op: 'existence',
						operands: [
							{ pointer: '/interactions/search/response-body/matches' },
						],
					},
					{
						op: 'existence',
						operands: [
							{ pointer: '/interactions/search/response-body/totalCount' },
						],
					},
				],
			},
			polarity: 'expects-hold',
			commentary:
				'The tool reporting success has to have returned the list it reports on, and the count it reports for that list.',
		},
		{
			// Rule 4 and rule 6 together. The declared cardinality is `at-most`,
			// so rule 6 takes the injection form: a quantifier over the page
			// whose predicate tests membership of the declared set. A bijection
			// would resolve false against a correct server returning a page.
			id: 'O-002',
			direction: {
				evidenceTargets: ['/interactions/search/response-body/matches'],
				relation: 'for-all',
				polarity: 'expects-hold',
				scope: 'Every match the search names.',
				negativeDomain: 'A match naming a note the seeded set does not hold.',
			},
			check: {
				op: 'for-all',
				collection: { pointer: '/interactions/search/response-body/matches' },
				predicate: {
					op: 'set-membership',
					operands: [
						{ pointer: '@/noteId' },
						{ referenceSet: 'expected-notes' },
					],
				},
			},
			polarity: 'expects-hold',
			commentary: 'Every match returned is one of the notes that were seeded.',
		},
		{
			// The same pair of rules over the creation result.
			id: 'O-003',
			direction: {
				evidenceTargets: [
					'/interactions/create/response-body/ok',
					'/interactions/create/response-body/noteId',
				],
				relation: 'all',
				polarity: 'expects-hold',
				scope: 'One creation call for one note.',
				negativeDomain: 'A creation reporting success with no identifier.',
			},
			check: {
				op: 'all',
				operands: [
					{
						op: 'equality',
						operands: [
							{ pointer: '/interactions/create/response-body/ok' },
							{ literal: true },
						],
					},
					{
						op: 'existence',
						operands: [
							{ pointer: '/interactions/create/response-body/noteId' },
						],
					},
				],
			},
			polarity: 'expects-hold',
			commentary:
				'A creation that reports success has to answer with the identifier it filed under.',
		},
		{
			// Rule 7's read-back. The title the creation call sent has to appear
			// in what a later non-mutating step reads, which is what separates a
			// tool that reported success from a tool that did the work.
			id: 'O-004',
			direction: {
				evidenceTargets: [
					'/interactions/create/call-inputs/arguments/title',
					'/interactions/read-back/response-body/topMatch/title',
				],
				relation: 'equality',
				polarity: 'expects-hold',
				scope: 'One creation followed by one search for what it filed.',
				negativeDomain: 'A creation the later search cannot find.',
			},
			check: {
				op: 'equality',
				operands: [
					{ pointer: '/interactions/read-back/response-body/topMatch/title' },
					{ pointer: '/interactions/create/call-inputs/arguments/title' },
				],
			},
			polarity: 'expects-hold',
			commentary:
				'A creation that reported success and filed nothing fails here.',
		},
		{
			// Rule 5: the two declared parameter siblings read at one oracle, so
			// a tool honouring one argument and ignoring the other is caught.
			id: 'O-005',
			direction: {
				evidenceTargets: [
					'/interactions/search/call-inputs/arguments/query',
					'/interactions/create/call-inputs/arguments/title',
				],
				relation: 'all',
				polarity: 'expects-hold',
				scope: 'The two arguments the sibling group names.',
				negativeDomain: 'A call sending one of the pair and not the other.',
			},
			check: {
				op: 'all',
				operands: [
					{
						op: 'existence',
						operands: [
							{ pointer: '/interactions/search/call-inputs/arguments/query' },
						],
					},
					{
						op: 'existence',
						operands: [
							{ pointer: '/interactions/create/call-inputs/arguments/title' },
						],
					},
				],
			},
			polarity: 'expects-hold',
			commentary: 'Both declared siblings were actually sent.',
		},
		{
			// Rule 3: a call whose argument carries the wrong JSON type has to
			// be refused rather than answered, and the oracle addressing that
			// step is what makes the rule satisfiable.
			//
			// Written in the `expects-violation` spelling, and O-007 below is the
			// same rule in the `expects-hold` one, so the corpus publishes both.
			// The two differ in what the check says: here it states the
			// violation, and `checkSatisfied` reads an `expects-violation` oracle
			// as satisfied when its check resolves false, so a server that
			// refused the call satisfies this. Writing the refusal here instead,
			// under this polarity, is the trap: the seal would render "the
			// declared polarity expects this relation to be a violation" over a
			// check stating what a correct server does, and a correct server
			// would score `disagrees`.
			id: 'O-006',
			direction: {
				evidenceTargets: ['/interactions/malformed-search/response-body/ok'],
				relation: 'equality',
				polarity: 'expects-violation',
				scope:
					'One search whose query argument is not a string, with the check stating the failure rather than the requirement.',
				negativeDomain: 'A search answering success over a malformed argument.',
			},
			check: {
				op: 'equality',
				operands: [
					{ pointer: '/interactions/malformed-search/response-body/ok' },
					{ literal: true },
				],
			},
			polarity: 'expects-violation',
			commentary:
				'A search answering success over a type-violating argument is the violation this expects not to see.',
		},
		{
			// The same rule over the mutating tool, which the rule fires on
			// separately: a malformed creation that reports success has written
			// something nobody asked for. Spelled `expects-hold` against O-006's
			// `expects-violation`, so the corpus shows both forms of one
			// requirement side by side.
			id: 'O-007',
			direction: {
				evidenceTargets: ['/interactions/malformed-create/response-body/ok'],
				relation: 'equality',
				polarity: 'expects-hold',
				scope:
					'One creation whose title argument is not a string, with the check stating the requirement.',
				negativeDomain:
					'A creation answering success over a malformed argument.',
			},
			check: {
				op: 'equality',
				operands: [
					{ pointer: '/interactions/malformed-create/response-body/ok' },
					{ literal: false },
				],
			},
			polarity: 'expects-hold',
			commentary: 'A type-violating argument is refused rather than filed.',
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
					// `ok` is the tool's own field inside its structured result,
					// and it is deliberately not the protocol's `isError`: that
					// flag is envelope framing, it lands on `response-status`,
					// and declaring it here is the envelope-descriptor trap the
					// kind's design record names. An oracle over `ok` checks
					// what the tool said about its own work.
					responseDescriptor: {
						// `totalCount` is required rather than merely permitted:
						// a defect signature over this tool asserts on it, and a
						// server free to omit it would turn a caught defect into
						// a silent `not-triggered` with nothing saying the
						// evidence was missing.
						requiredKeys: ['ok', 'matches', 'totalCount'],
						permittedKeys: ['ok', 'matches', 'totalCount', 'topMatch'],
						// `topMatch` is the single best hit, which is what the
						// read-back reads. AD-20 rule 7's satisfaction predicate
						// needs one node holding both sides of the relation, and a
						// quantifier node carries its collection rather than its
						// operands, so the read-back has to be a flat comparison
						// against something scalar. A containment over `matches`
						// would be the other spelling and it compares whole
						// elements, so it would resolve false against any server
						// the quantifier over `matches` is true of.
						types: {
							ok: 'boolean',
							matches: 'array',
							totalCount: 'number',
							topMatch: 'object',
						},
						successIndicator: '/ok',
						channelRoles: {
							'/ok': 'success-indicator',
							'/matches': 'collection',
							'/totalCount': 'payload',
						},
						collectionLocations: [
							{
								pointer: '/matches',
								referenceSet: 'expected-notes',
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
						requiredKeys: ['ok', 'noteId'],
						permittedKeys: ['ok', 'noteId', 'filedAt'],
						types: { ok: 'boolean', noteId: 'string', filedAt: 'string' },
						successIndicator: '/ok',
						channelRoles: {
							'/ok': 'success-indicator',
							'/noteId': 'payload',
						},
						collectionLocations: [],
					},
					// The filing timestamp differs on every run, so a witness
					// relation reading it would certify the tool sensitive to
					// its own clock. Declared volatile so the projection prunes
					// it and a relation addressing it is refused at compile.
					volatilePointers: ['/filedAt'],
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
	referenceSets: {
		'expected-notes': {
			keys: ['noteId'],
			members: [{ noteId: 'n-1' }, { noteId: 'n-2' }],
			commentary: null,
		},
	},
	siblingGroups: {
		operations: [['search-notes', 'create-note']],
		parameters: [['query', 'title']],
	},
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
		{
			// Rule 3's site: an argument bound by the type-violating matcher,
			// which binds a call whose JSON type differs from the one the tool
			// declares for that key.
			stepId: 'malformed-search',
			operationId: 'search-notes',
			after: null,
			cardinality: 'at-most-one',
			inputBinding: {
				arguments: { query: { matcher: 'type-violating' } },
			},
		},
		{
			stepId: 'malformed-create',
			operationId: 'create-note',
			after: null,
			cardinality: 'at-most-one',
			inputBinding: {
				arguments: { title: { matcher: 'type-violating' } },
			},
		},
		{
			// The read-back half of the pair AD-20 rule 7 asks for, and the one
			// step that binds a captured value: the identifier the creation
			// tool minted is what the search looks for, which a literal cannot
			// name because the evaluator never created it.
			stepId: 'read-back',
			operationId: 'search-notes',
			after: 'create',
			cardinality: 'exactly-one',
			inputBinding: {
				arguments: {
					query: { captured: '/interactions/create/response-body/noteId' },
				},
			},
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
	// Twenty, matching the sibling contracts: the plan is five steps and the
	// reset is a sixth call, so four would stop short of the read-back.
	budgets: { maxToolCalls: 20, maxWallClockMinutes: 5, maxCostUsd: '1.00' },
	safetyLimits: [],
	requiredEvidence: [],
	probeStepBound: null,
	// The reset is an ordinary declared operation and goes through the same port
	// as every other leg, so this is the accept fixture for the tool-call arm of
	// `FixtureReset.inputs`, which is reachable from no other declaration.
	fixtureReset: {
		legId: 'reset-notes',
		interfaceId: 'notes-tool-server',
		operationId: 'create-note',
		inputs: { arguments: { title: 'the clean fixture' } },
	},
} satisfies EvalContract
