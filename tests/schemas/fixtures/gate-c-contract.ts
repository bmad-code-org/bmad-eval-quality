// The Gate C export-API contract, re-spelled to the settled schema. It
// predates the schema and is the only contract ever hand-authored against
// architecture revision 9, so it's the only evidence the grammar expresses
// what the discipline rules require.
//
// Source: _bmad-output/planning-artifacts/architecture/
//         architecture-eval-quality-2026-07-29/reviews/gate-c/eval-contract.json
//
// Every re-spelling below (RESPELLINGS) is a place the schema and the
// hand-authored contract disagreed.

import type { EvalContract } from '../../../src/core/schemas/eval-contract.ts'

export type Respelling = {
	readonly field: string
	readonly from: string
	readonly to: string
	readonly why: string
}

export const RESPELLINGS: readonly Respelling[] = [
	{
		field: 'linkage',
		from: 'a contract-level array of { scheme, id }, with per-behaviour requirementIds and riskIds naming bare identifiers',
		to: 'per-behaviour requirementLinks and riskLinks, each an array of { scheme, id }',
		why: 'Coin flip (c). `missing-requirement-linkage` fires when "a behaviour declares no requirement or risk identifier", which a contract-level array cannot make decidable per behaviour. One fact was in two places; the contract-level array does not survive.',
	},
	{
		field: 'strictMode',
		from: 'true, declared on the contract',
		to: 'removed',
		why: 'AD-4 and the Configuration convention make strict mode a compile-and-score mode selected by explicit argument or flag, never a declaration. The fixture carried it as an artifact of hand-authoring.',
	},
	{
		field: 'oracles[].rule',
		from: 'an author-attested AD-20 rule label, for example "per-record"',
		to: 'removed',
		why: 'AD-31 computes relevance from declarations only and never infers it from the oracles. A rule label an author writes is a standing invitation for Epic 5 to read it and turn fourteen decision procedures into self-assessment.',
	},
	{
		field: 'referenceSets.<id>.note',
		from: 'note',
		to: 'commentary',
		why: 'AD-3 names author commentary as the thing that never reaches the sealed brief. One word, used for the oracle field and this one, gives Epic 2 exactly one thing to exclude.',
	},
	{
		field: 'budgets.maxCostUsd',
		from: '1.5, a JSON number',
		to: '"1.5", a decimal-format string',
		why: 'AD-36 names money as the case that travels as a string with its own declared format, because a binary64 number cannot carry exact decimal semantics across two implementations.',
	},
	{
		field: 'interactionPlan[].inputBinding',
		from: 'a partial map naming only the bound channels, e.g. { "body": { … } }',
		to: 'all four channels present, with null for each unbound channel',
		why: "The Consistency Conventions spell an absent value as explicit null rather than an omitted key. All six of the fixture's steps carried a partial binding; AC 5 said five, and the count is six.",
	},
	{
		field: 'interactionPlan[].after',
		from: 'omitted on steps with no temporal clause',
		to: 'after: null',
		why: 'Same convention: absence is explicit.',
	},
	{
		field: 'oracles[].check where op is "shape"',
		from: '{ op: "shape", operands: [pointer, { literal: { requiredKeys: [...] } }] }',
		to: '{ op: "shape", operands: [pointer], descriptor: { requiredKeys, permittedKeys, types } }',
		why: 'AD-4 calls `shape`\'s descriptor closed, "never an embedded JSON Schema". Typing it as a named field is what makes that structural; a `{ literal }` operand may hold any JSON at all. This is the one re-spelling that changes what the check asserts, and the change is stated rather than smoothed over: the hand-authored O-005 declared requiredKeys only and said nothing about any other key, so it was open, while the re-spelled one is closed over exactly five keys and a row carrying a sixth field now fails it. permittedKeys was filled with the four declared row fields plus retractedAt so that O-005 stays independent of O-004, whose whole purpose is detecting retractedAt; without retractedAt in the permitted set, O-005 would silently subsume O-004. types was left empty, which is the descriptor\'s "no per-key type declared" answer. The grammar has no spelling for "these keys are required and extras are unconstrained", because AD-4 calls the descriptor closed; that is a place where the only hand-authored contract cannot be expressed exactly, and it is recorded here rather than treated as equivalent.',
	},
	{
		field: 'oracles[].commentary',
		from: 'absent',
		to: 'null',
		why: 'A required key with an explicit null. The field exists because AD-3 requires a documentation channel no predicate reads.',
	},
	{
		field:
			'permittedInterfaces[].operations[].responseDescriptor.collectionLocations',
		from: 'omitted on the two operations that declare no collection',
		to: 'null',
		why: 'AD-31 grades absent and explicitly empty differently, so both spellings must exist and absence must be explicit.',
	},
	{
		field: 'parentDigest, revisionCount',
		from: 'absent',
		to: 'null and 0',
		why: 'AD-29 lineage. The contract is a lineage root, which is exactly the state the biconditional describes.',
	},
	{
		field: 'waivers, scopedResources, probeStepBound',
		from: 'absent',
		to: '[], null, null',
		why: 'Declarations this schema requires that the fixture predates. The empty waiver list is an answer; the two nulls are the absent state AD-31 distinguishes from the empty one.',
	},
]

const emptyChannel = {
	requiredKeys: [] as string[],
	permittedKeys: [] as string[],
	types: {} as Record<string, null>,
}

export const gateCContract = {
	schemaVersion: 1,
	contractId: 'exports-api-v1',
	parentDigest: null,
	revisionCount: 0,
	sourceSpecDigest:
		'sha256:00000000000000000000000000000000000000000000000000000000000000c1',
	behaviors: [
		{
			id: 'B-001',
			description:
				'A submitted export job is retrievable with the filters it was submitted with.',
			severity: 'critical',
			observableSuccessCriterion:
				'An independent read of the job resource returns the job with submittedFilters equal to the filters the submit call carried.',
			requirementLinks: [{ scheme: 'gate-c', id: 'REQ-EXPORT-1' }],
			riskLinks: [{ scheme: 'gate-c-risk', id: 'RISK-PHANTOM-JOB' }],
			oracles: ['O-001'],
		},
		{
			id: 'B-002',
			description:
				'The job state agrees with the transport status and no diagnostic accompanies a live job.',
			severity: 'material',
			observableSuccessCriterion:
				'The poll response carries transport status 200, a state drawn from the declared closed set, and no error or failureReason field.',
			requirementLinks: [{ scheme: 'gate-c', id: 'REQ-EXPORT-1' }],
			riskLinks: [{ scheme: 'gate-c-risk', id: 'RISK-PHANTOM-JOB' }],
			oracles: ['O-002', 'O-003'],
		},
		{
			id: 'B-003',
			description: 'No retracted row appears in an export page.',
			severity: 'critical',
			observableSuccessCriterion:
				'Every element of a returned page carries no retractedAt field, and a page that examined no rows does not count as satisfying this.',
			requirementLinks: [{ scheme: 'gate-c', id: 'REQ-EXPORT-1' }],
			riskLinks: [{ scheme: 'gate-c-risk', id: 'RISK-RETRACTED-LEAK' }],
			oracles: ['O-004'],
		},
		{
			id: 'B-004',
			description:
				'Every row in a page is complete and belongs to the expected result set.',
			severity: 'material',
			observableSuccessCriterion:
				'Every element of a returned page carries all four declared row fields and its id is a member of the declared reference set.',
			requirementLinks: [{ scheme: 'gate-c', id: 'REQ-EXPORT-1' }],
			riskLinks: [{ scheme: 'gate-c-risk', id: 'RISK-RETRACTED-LEAK' }],
			oracles: ['O-005', 'O-006'],
		},
		{
			id: 'B-005',
			description: 'A malformed submit body is rejected rather than accepted.',
			severity: 'material',
			observableSuccessCriterion:
				'The malformed submit responds with transport status 400 and carries an error field.',
			requirementLinks: [{ scheme: 'gate-c', id: 'REQ-EXPORT-1' }],
			riskLinks: [{ scheme: 'gate-c-risk', id: 'RISK-PHANTOM-JOB' }],
			oracles: ['O-007'],
		},
		{
			id: 'B-006',
			description:
				'Sibling operations reject an unknown job identifier the same way.',
			severity: 'low',
			observableSuccessCriterion:
				'Both the job read and the rows read respond 404 with an error field for an identifier no job carries.',
			requirementLinks: [{ scheme: 'gate-c', id: 'REQ-EXPORT-1' }],
			riskLinks: [{ scheme: 'gate-c-risk', id: 'RISK-PHANTOM-JOB' }],
			oracles: ['O-008'],
		},
	],
	oracles: [
		{
			id: 'O-001',
			direction: {
				evidenceTargets: [
					'/interactions/poll/response-body/submittedFilters',
					'/interactions/submit/call-inputs/body/filters',
				],
				relation: 'deep-equality',
				polarity: 'expects-hold',
				scope:
					'One submitted job, read through the separate job-read operation rather than through the submit response.',
				negativeDomain:
					'A job resource that echoes filters it was never given, or that reports a job identifier the submit call did not return.',
			},
			check: {
				op: 'deep-equality',
				operands: [
					{ pointer: '/interactions/poll/response-body/submittedFilters' },
					{ pointer: '/interactions/submit/call-inputs/body/filters' },
				],
			},
			polarity: 'expects-hold',
			commentary: null,
		},
		{
			id: 'O-002',
			direction: {
				evidenceTargets: [
					'/interactions/poll/response-status',
					'/interactions/poll/response-body/state',
				],
				relation: 'all',
				polarity: 'expects-hold',
				scope:
					"The transport status and the body's own state field on one poll of a live job.",
				negativeDomain:
					'A body reporting a live state under a failing transport status, or a 200 carrying a state outside the declared set.',
			},
			check: {
				op: 'all',
				operands: [
					{
						op: 'equality',
						operands: [
							{ pointer: '/interactions/poll/response-status' },
							{ literal: 200 },
						],
					},
					{
						op: 'set-membership',
						operands: [
							{ pointer: '/interactions/poll/response-body/state' },
							{ literal: ['queued', 'running', 'succeeded', 'failed'] },
						],
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
					'/interactions/poll/response-body/error',
					'/interactions/poll/response-body/failureReason',
					'/interactions/poll/response-body/jobId',
				],
				relation: 'all',
				polarity: 'expects-hold',
				scope: 'The whole poll body, not only the state field.',
				negativeDomain:
					'A response carrying a live state alongside a diagnostic field, or omitting the job identifier it is a response about.',
			},
			check: {
				op: 'all',
				operands: [
					{
						op: 'absence',
						operands: [{ pointer: '/interactions/poll/response-body/error' }],
					},
					{
						op: 'absence',
						operands: [
							{ pointer: '/interactions/poll/response-body/failureReason' },
						],
					},
					{
						op: 'existence',
						operands: [{ pointer: '/interactions/poll/response-body/jobId' }],
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
					'/interactions/first-page/response-body/rows/retractedAt',
				],
				relation: 'not',
				polarity: 'expects-hold',
				scope: 'Every element of the returned page.',
				negativeDomain:
					'A page that includes a retracted row, and a page that is empty or missing, which examines nothing and must not certify.',
			},
			check: {
				op: 'not',
				operands: [
					{
						op: 'for-any',
						collection: {
							pointer: '/interactions/first-page/response-body/rows',
						},
						predicate: {
							op: 'existence',
							operands: [{ pointer: '@/retractedAt' }],
						},
					},
				],
			},
			polarity: 'expects-hold',
			commentary: null,
		},
		{
			id: 'O-005',
			direction: {
				evidenceTargets: ['/interactions/first-page/response-body/rows'],
				relation: 'for-all',
				polarity: 'expects-hold',
				scope: 'Every element of the returned page, not the first.',
				negativeDomain:
					'A page whose first element is complete and whose later elements are not.',
			},
			check: {
				op: 'for-all',
				collection: { pointer: '/interactions/first-page/response-body/rows' },
				predicate: {
					op: 'shape',
					operands: [{ pointer: '@/' }],
					descriptor: {
						requiredKeys: ['id', 'datasetId', 'capturedAt', 'payload'],
						permittedKeys: [
							'id',
							'datasetId',
							'capturedAt',
							'payload',
							'retractedAt',
						],
						types: {},
					},
				},
			},
			polarity: 'expects-hold',
			commentary: null,
		},
		{
			id: 'O-006',
			direction: {
				evidenceTargets: ['/interactions/first-page/response-body/rows'],
				relation: 'for-all',
				polarity: 'expects-hold',
				scope:
					'One page of a larger result set, reconciled against the declared reference set by the injection form rather than the bijection, since a page never equals the set.',
				negativeDomain:
					'A page returning an identifier no expected row carries, which is a fabricated or leaked record.',
			},
			check: {
				op: 'for-all',
				collection: { pointer: '/interactions/first-page/response-body/rows' },
				predicate: {
					op: 'set-membership',
					operands: [
						{ pointer: '@/id' },
						{ referenceSet: 'expected-export-rows' },
					],
				},
			},
			polarity: 'expects-hold',
			commentary: null,
		},
		{
			id: 'O-007',
			direction: {
				evidenceTargets: [
					'/interactions/malformed-submit/response-status',
					'/interactions/malformed-submit/response-body/error',
				],
				relation: 'all',
				polarity: 'expects-hold',
				scope: 'One submit whose filters field violates its declared type.',
				negativeDomain:
					'A malformed submit accepted with a 202 and a job identifier, which creates a job from input the server could not have understood.',
			},
			check: {
				op: 'all',
				operands: [
					{
						op: 'equality',
						operands: [
							{ pointer: '/interactions/malformed-submit/response-status' },
							{ literal: 400 },
						],
					},
					{
						op: 'existence',
						operands: [
							{ pointer: '/interactions/malformed-submit/response-body/error' },
						],
					},
				],
			},
			polarity: 'expects-hold',
			commentary: null,
		},
		{
			id: 'O-008',
			direction: {
				evidenceTargets: [
					'/interactions/unknown-job-read/response-status',
					'/interactions/unknown-job-rows/response-status',
				],
				relation: 'all',
				polarity: 'expects-hold',
				scope:
					'The two sibling operations that both take a job identifier, given an identifier no job carries.',
				negativeDomain:
					'One sibling returning 404 while the other returns 200 with an empty page, which is the asymmetry this rule exists to find.',
			},
			check: {
				op: 'all',
				operands: [
					{
						op: 'equality',
						operands: [
							{ pointer: '/interactions/unknown-job-read/response-status' },
							{ literal: 404 },
						],
					},
					{
						op: 'equality',
						operands: [
							{ pointer: '/interactions/unknown-job-rows/response-status' },
							{ literal: 404 },
						],
					},
					{
						op: 'equality',
						operands: [
							{ pointer: '/interactions/unknown-job-read/response-status' },
							{ pointer: '/interactions/unknown-job-rows/response-status' },
						],
					},
				],
			},
			polarity: 'expects-hold',
			commentary: null,
		},
	],
	rubrics: [],
	waivers: [],
	permittedInterfaces: [
		{
			logicalId: 'exports-api',
			kind: 'api',
			operations: [
				{
					operationId: 'submit-export',
					method: 'POST',
					pathTemplate: '/exports',
					stateChangeMarker: true,
					requestShape: {
						path: emptyChannel,
						query: emptyChannel,
						header: {
							requiredKeys: [],
							permittedKeys: ['Idempotency-Key'],
							types: { 'Idempotency-Key': 'string' },
						},
						body: {
							requiredKeys: ['datasetId', 'filters'],
							permittedKeys: ['datasetId', 'filters'],
							types: { datasetId: 'string', filters: 'object' },
						},
					},
					responseDescriptor: {
						requiredKeys: ['jobId', 'state', 'statusPath', 'submittedFilters'],
						permittedKeys: [
							'jobId',
							'state',
							'statusPath',
							'submittedFilters',
							'error',
						],
						types: {
							jobId: 'string',
							state: 'string',
							statusPath: 'string',
							submittedFilters: 'object',
							error: 'string',
						},
						successIndicator: '/state',
						channelRoles: {
							'/state': 'success-indicator',
							'/error': 'diagnostic',
							'/jobId': 'payload',
							'/statusPath': 'payload',
							'/submittedFilters': 'payload',
						},
						collectionLocations: null,
					},
					volatilePointers: ['/jobId'],
				},
				{
					operationId: 'get-export',
					method: 'GET',
					pathTemplate: '/exports/{jobId}',
					stateChangeMarker: false,
					requestShape: {
						path: {
							requiredKeys: ['jobId'],
							permittedKeys: ['jobId'],
							types: { jobId: 'string' },
						},
						query: emptyChannel,
						header: emptyChannel,
						body: emptyChannel,
					},
					responseDescriptor: {
						requiredKeys: ['jobId', 'state', 'submittedFilters'],
						permittedKeys: [
							'jobId',
							'state',
							'submittedFilters',
							'rowCount',
							'completedAt',
							'failureReason',
							'error',
						],
						types: {
							jobId: 'string',
							state: 'string',
							submittedFilters: 'object',
							rowCount: 'number',
							completedAt: 'string',
							failureReason: 'string',
							error: 'string',
						},
						successIndicator: '/state',
						channelRoles: {
							'/state': 'success-indicator',
							'/error': 'diagnostic',
							'/failureReason': 'diagnostic',
							'/jobId': 'payload',
							'/submittedFilters': 'payload',
							'/rowCount': 'payload',
							'/completedAt': 'payload',
						},
						collectionLocations: null,
					},
					volatilePointers: ['/completedAt', '/jobId'],
				},
				{
					operationId: 'list-export-rows',
					method: 'GET',
					pathTemplate: '/exports/{jobId}/rows',
					stateChangeMarker: false,
					requestShape: {
						path: {
							requiredKeys: ['jobId'],
							permittedKeys: ['jobId'],
							types: { jobId: 'string' },
						},
						query: {
							requiredKeys: [],
							permittedKeys: ['cursor', 'limit'],
							types: { cursor: 'string', limit: 'number' },
						},
						header: emptyChannel,
						body: emptyChannel,
					},
					responseDescriptor: {
						requiredKeys: ['rows'],
						permittedKeys: ['rows', 'nextCursor', 'error'],
						types: { rows: 'array', nextCursor: 'string', error: 'string' },
						successIndicator: '/rows',
						channelRoles: {
							'/rows': 'collection',
							'/nextCursor': 'payload',
							'/error': 'diagnostic',
						},
						collectionLocations: [
							{
								pointer: '/rows',
								expectedCardinality: { mode: 'page-bounded', max: 20 },
								referenceSet: 'expected-export-rows',
							},
						],
					},
					volatilePointers: ['/nextCursor'],
				},
			],
		},
	],
	referenceSets: {
		'expected-export-rows': {
			keys: ['id'],
			members: [
				{ id: 'r-001' },
				{ id: 'r-002' },
				{ id: 'r-003' },
				{ id: 'r-004' },
				{ id: 'r-005' },
				{ id: 'r-006' },
				{ id: 'r-007' },
				{ id: 'r-008' },
				{ id: 'r-009' },
				{ id: 'r-010' },
				{ id: 'r-011' },
				{ id: 'r-012' },
				{ id: 'r-013' },
				{ id: 'r-014' },
				{ id: 'r-015' },
				{ id: 'r-016' },
				{ id: 'r-017' },
				{ id: 'r-018' },
				{ id: 'r-019' },
				{ id: 'r-020' },
			],
			commentary:
				'Truncated to the first twenty members for readability; the seeded set holds 97.',
		},
	},
	siblingGroups: {
		operations: [['get-export', 'list-export-rows']],
		parameters: [['cursor', 'limit']],
	},
	interactionPlan: [
		{
			stepId: 'submit',
			operationId: 'submit-export',
			inputBinding: {
				path: null,
				query: null,
				header: null,
				body: {
					datasetId: { literal: 'ds-7' },
					filters: { matcher: 'any' },
				},
			},
			after: null,
		},
		{
			stepId: 'poll',
			operationId: 'get-export',
			inputBinding: {
				path: { jobId: { matcher: 'any' } },
				query: null,
				header: null,
				body: null,
			},
			after: 'submit',
		},
		{
			stepId: 'first-page',
			operationId: 'list-export-rows',
			inputBinding: {
				path: { jobId: { matcher: 'any' } },
				query: { limit: { literal: 20 } },
				header: null,
				body: null,
			},
			after: 'submit',
		},
		{
			stepId: 'malformed-submit',
			operationId: 'submit-export',
			inputBinding: {
				path: null,
				query: null,
				header: null,
				body: {
					datasetId: { literal: 'ds-7' },
					filters: { matcher: 'type-violating' },
				},
			},
			after: null,
		},
		{
			stepId: 'unknown-job-read',
			operationId: 'get-export',
			inputBinding: {
				path: { jobId: { literal: 'job-does-not-exist' } },
				query: null,
				header: null,
				body: null,
			},
			after: null,
		},
		{
			stepId: 'unknown-job-rows',
			operationId: 'list-export-rows',
			inputBinding: {
				path: { jobId: { literal: 'job-does-not-exist' } },
				query: null,
				header: null,
				body: null,
			},
			after: null,
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
		setup:
			'Seed dataset ds-7 with 100 rows matching the declared filters, of which exactly 3 carry a retractedAt timestamp. No export job exists at run start.',
		cleanup:
			'Delete every export job created during the run and reset the retractedAt flags.',
	},
	budgets: {
		maxToolCalls: 60,
		maxWallClockMinutes: 15,
		maxCostUsd: '1.5',
	},
	safetyLimits: [
		'No request to any host other than the mapped exports-api target.',
	],
	requiredEvidence: [
		'Request and response pair for every call, in order, including every poll attempt.',
	],
	probeStepBound: null,
} satisfies EvalContract
