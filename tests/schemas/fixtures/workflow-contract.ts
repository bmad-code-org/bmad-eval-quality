// A contract whose system under test is a service behind HTTP, and whose plan
// reads a created record back at the identifier the write returned. One
// interface, three operations, and a workflow joined by a captured value.
//
// It is the first shipped `api` contract carrying a `{ captured }` binding and
// the first carrying a `fixtureReset` on that kind, so it is the corpus member
// an author opens to see the workflow shape in the kind the guide's own example
// is written in. `docs/how-to/evaluate-workflow-behavior.md` prints this plan,
// and the three compile-check messages on that page are read against it.
//
// The reset is a third operation rather than the write reused. `selectControl`
// takes the mutating control leg from the first marker-true operation on the
// interface the reset names and the reset leg from the operation the reset
// names, so a contract where those are two different operations is the one that
// shows the four-leg branch doing what it exists for: change the fixture with
// one call, restore it with another, and read the same answer either side.
//
// The volatile identifier is the part worth reading twice. `create-thing`
// declares `/id` volatile, so the pre-flight projection prunes it and two writes
// of the same name digest alike. The capture addresses that same field and
// resolves it, because `resolveCapturedValue` walks the raw observation rather
// than the projection. A server-minted identifier is what a capture exists for
// and what a fixture comparison has to ignore, and one contract holding both is
// the clearest place to show it.

import type { EvalContract } from '../../../src/core/schemas/eval-contract.ts'

/** The name the seeded fixture holds, and the name the reset restores. */
export const SEEDED_NAME = 'alpha'

/** The identifier the seeded fixture holds, quoted by the committed chain. */
export const SEEDED_ID = 't-1'

/** The identifier of the thing `testData.setup` files through the write itself. */
export const FILED_ID = 't-8'

/** The name the committed chain's write sends. */
export const WRITTEN_NAME = 'a thing the run created'

/**
 * What a service that files a record and drops the name it was sent reads back
 * as. The committed chain seeds that fault, and this is the value that shows it.
 */
export const SUBSTITUTED_NAME = 'untitled'

export const workflowContract = {
	schemaVersion: 5,
	contractId: 'captured-read-back',
	parentDigest: null,
	revisionCount: 0,
	sourceSpecDigest: null,
	behaviors: [
		{
			id: 'B-001',
			description: 'A create reports the identifier it filed the thing under.',
			severity: 'material',
			observableSuccessCriterion:
				'A create call answers with an identifier and reports no error.',
			requirementLinks: [{ scheme: 'local', id: 'REQ-1' }],
			riskLinks: [{ scheme: 'local-risk', id: 'RISK-1' }],
			oracles: ['O-001'],
		},
		{
			// One oracle, which is what `designatedOracleIdOf` requires before a
			// probe pairs with the oracle discharging the behavior it breaks. The
			// committed chain's seeded defect is scored against this behavior.
			id: 'B-002',
			description:
				'A thing read back at the identifier the create returned carries the name the create sent.',
			severity: 'critical',
			observableSuccessCriterion:
				'A read at the returned identifier answers with the name the create call sent.',
			requirementLinks: [{ scheme: 'local', id: 'REQ-2' }],
			riskLinks: [{ scheme: 'local-risk', id: 'RISK-2' }],
			oracles: ['O-002'],
		},
		{
			id: 'B-003',
			description:
				'A call whose parameter violates its declared type is refused.',
			severity: 'material',
			observableSuccessCriterion:
				'Each of the three operations answers success false over a parameter of the wrong JSON type.',
			requirementLinks: [{ scheme: 'local', id: 'REQ-3' }],
			riskLinks: [{ scheme: 'local-risk', id: 'RISK-3' }],
			oracles: ['O-003'],
		},
		{
			id: 'B-004',
			description: 'Both declared sibling parameters reach the service.',
			severity: 'low',
			observableSuccessCriterion:
				'The write carries the name and the read carries the identifier.',
			requirementLinks: [{ scheme: 'local', id: 'REQ-4' }],
			riskLinks: [{ scheme: 'local-risk', id: 'RISK-4' }],
			oracles: ['O-004'],
		},
		{
			id: 'B-005',
			description: 'A read answers with the thing the store holds.',
			severity: 'material',
			observableSuccessCriterion:
				'A read reports success and returns the record beside it.',
			requirementLinks: [{ scheme: 'local', id: 'REQ-5' }],
			riskLinks: [{ scheme: 'local-risk', id: 'RISK-5' }],
			oracles: ['O-005'],
		},
		{
			id: 'B-006',
			description: 'A reset seeds the store with the name it was given.',
			severity: 'material',
			observableSuccessCriterion:
				'A reset reports the name it seeded, and a later read answers with it.',
			requirementLinks: [{ scheme: 'local', id: 'REQ-6' }],
			riskLinks: [{ scheme: 'local-risk', id: 'RISK-6' }],
			oracles: ['O-006', 'O-007'],
		},
	],
	oracles: [
		{
			// The write's own response read whole: the success indicator asserted
			// beside the payload the descriptor requires next to it, and the
			// diagnostic asserted absent.
			id: 'O-001',
			direction: {
				evidenceTargets: [
					'/interactions/create/response-body/ok',
					'/interactions/create/response-body/id',
					'/interactions/create/response-body/error',
				],
				relation: 'all',
				polarity: 'expects-hold',
				scope: 'One create call for one thing.',
				negativeDomain:
					'A create reporting success with no identifier, or with a diagnostic beside it.',
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
						operands: [{ pointer: '/interactions/create/response-body/id' }],
					},
					{
						op: 'absence',
						operands: [{ pointer: '/interactions/create/response-body/error' }],
					},
				],
			},
			polarity: 'expects-hold',
			commentary:
				'A create that reports success has to answer with the identifier it filed under, and with no diagnostic beside it.',
		},
		{
			// The read-back the capture exists for. The name the write sent has to
			// appear in what the later read returns, which is what separates a
			// service that reported success from one that did the work. The read
			// reaches the record through the identifier the write minted, so a
			// literal could not address it.
			id: 'O-002',
			direction: {
				evidenceTargets: [
					'/interactions/create/call-inputs/body/name',
					'/interactions/read-back/response-body/thing/name',
				],
				relation: 'equality',
				polarity: 'expects-hold',
				scope: 'One create followed by one read at the identifier it returned.',
				negativeDomain:
					'A create whose later read answers with a name the call never sent.',
			},
			check: {
				op: 'equality',
				operands: [
					{ pointer: '/interactions/read-back/response-body/thing/name' },
					{ pointer: '/interactions/create/call-inputs/body/name' },
				],
			},
			polarity: 'expects-hold',
			commentary:
				'A create that reported success and filed the name it was sent nowhere fails here.',
		},
		{
			// One oracle over all three type-violating steps. AD-31 rule 3 asks
			// every operation declaring a request key for a step binding the
			// matcher under a check that addresses it, and all three operations
			// declare one.
			id: 'O-003',
			direction: {
				evidenceTargets: [
					'/interactions/malformed-create/response-body/ok',
					'/interactions/malformed-read/response-body/ok',
					'/interactions/malformed-reset/response-body/ok',
				],
				relation: 'all',
				polarity: 'expects-hold',
				scope:
					'One call per operation whose parameter carries the wrong JSON type, with the check stating the requirement.',
				negativeDomain:
					'An operation answering success over a type-violating parameter.',
			},
			check: {
				op: 'all',
				operands: [
					{
						op: 'equality',
						operands: [
							{ pointer: '/interactions/malformed-create/response-body/ok' },
							{ literal: false },
						],
					},
					{
						op: 'equality',
						operands: [
							{ pointer: '/interactions/malformed-read/response-body/ok' },
							{ literal: false },
						],
					},
					{
						op: 'equality',
						operands: [
							{ pointer: '/interactions/malformed-reset/response-body/ok' },
							{ literal: false },
						],
					},
				],
			},
			polarity: 'expects-hold',
			commentary:
				'A parameter of the wrong JSON type is refused rather than acted on.',
		},
		{
			// The two declared parameter siblings read at one oracle, so a service
			// honouring one and ignoring the other is caught. The second of the
			// pair is sent from a value the run captured, so this is also where
			// the capture is asserted to have reached the wire.
			id: 'O-004',
			direction: {
				evidenceTargets: [
					'/interactions/create/call-inputs/body/name',
					'/interactions/read-back/call-inputs/path/id',
				],
				relation: 'all',
				polarity: 'expects-hold',
				scope: 'The two parameters the sibling group names.',
				negativeDomain: 'A call sending one of the pair and not the other.',
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
							{ pointer: '/interactions/read-back/call-inputs/path/id' },
						],
					},
				],
			},
			polarity: 'expects-hold',
			commentary:
				'Both declared siblings were actually sent, the second of them from a value the run captured.',
		},
		{
			// The read's own response read whole, which is the same pair of rules
			// O-001 discharges for the write.
			id: 'O-005',
			direction: {
				evidenceTargets: [
					'/interactions/read-back/response-body/ok',
					'/interactions/read-back/response-body/thing',
				],
				relation: 'all',
				polarity: 'expects-hold',
				scope: 'One read at a known identifier.',
				negativeDomain: 'A read reporting success and returning no record.',
			},
			check: {
				op: 'all',
				operands: [
					{
						op: 'equality',
						operands: [
							{ pointer: '/interactions/read-back/response-body/ok' },
							{ literal: true },
						],
					},
					{
						op: 'existence',
						operands: [
							{ pointer: '/interactions/read-back/response-body/thing' },
						],
					},
				],
			},
			polarity: 'expects-hold',
			commentary:
				'A read that reports success has to return the record it reports on.',
		},
		{
			// The reset's own response read whole.
			id: 'O-006',
			direction: {
				evidenceTargets: [
					'/interactions/reset/response-body/ok',
					'/interactions/reset/response-body/seededName',
				],
				relation: 'all',
				polarity: 'expects-hold',
				scope: 'One reset call.',
				negativeDomain:
					'A reset reporting success and naming nothing it seeded.',
			},
			check: {
				op: 'all',
				operands: [
					{
						op: 'equality',
						operands: [
							{ pointer: '/interactions/reset/response-body/ok' },
							{ literal: true },
						],
					},
					{
						op: 'existence',
						operands: [
							{ pointer: '/interactions/reset/response-body/seededName' },
						],
					},
				],
			},
			polarity: 'expects-hold',
			commentary:
				'A reset that reports success has to name what it put in the store.',
		},
		{
			// The reset's own read-back. A reset is a state change like any other
			// and AD-20 rule 7 asks the same of it: the name it was given has to
			// be what a later read returns.
			id: 'O-007',
			direction: {
				evidenceTargets: [
					'/interactions/reset/call-inputs/body/seedName',
					'/interactions/reset-read-back/response-body/thing/name',
				],
				relation: 'equality',
				polarity: 'expects-hold',
				scope: 'One reset followed by one read of the record it seeded.',
				negativeDomain:
					'A reset reporting success over a store it left as it found it.',
			},
			check: {
				op: 'equality',
				operands: [
					{ pointer: '/interactions/reset-read-back/response-body/thing/name' },
					{ pointer: '/interactions/reset/call-inputs/body/seedName' },
				],
			},
			polarity: 'expects-hold',
			commentary:
				'A reset that reported success and seeded nothing fails here.',
		},
	],
	rubrics: [],
	waivers: [],
	permittedInterfaces: [
		{
			logicalId: 'thing-service',
			kind: 'api',
			operations: [
				{
					operationId: 'create-thing',
					method: 'POST',
					pathTemplate: '/things',
					stateChangeMarker: true,
					requestShape: {
						path: { requiredKeys: [], permittedKeys: [], types: {} },
						query: { requiredKeys: [], permittedKeys: [], types: {} },
						header: { requiredKeys: [], permittedKeys: [], types: {} },
						body: {
							// `id` is permitted and never required, which is what
							// lets a fixture file a record under an identifier it
							// chose while the run's own write omits it and takes
							// whatever the service mints. Both halves are needed:
							// `testData.setup` names the identifier it files under,
							// and the interaction plan's `create` step binds `name`
							// alone, which is why `/id` is volatile and why the
							// read-back has to capture rather than name a literal.
							requiredKeys: ['name'],
							permittedKeys: ['name', 'id'],
							types: { name: 'string', id: 'string' },
						},
					},
					responseDescriptor: {
						// The success shape. Nothing enforces `requiredKeys` against
						// an observation at run time, and the type-violating steps
						// this plan declares are answered with `{ ok: false, error }`
						// and no `thing`, which is the failure shape the same
						// descriptor's `permittedKeys` and `channelRoles` cover.
						requiredKeys: ['ok', 'id'],
						permittedKeys: ['ok', 'id', 'name', 'error'],
						types: {
							ok: 'boolean',
							id: 'string',
							name: 'string',
							error: 'string',
						},
						successIndicator: '/ok',
						channelRoles: {
							'/ok': 'success-indicator',
							'/id': 'payload',
							'/name': 'payload',
							'/error': 'diagnostic',
						},
						collectionLocations: [],
					},
					// The identifier the service mints differs on every run, so a
					// witness relation reading it would certify the service
					// sensitive to its own counter. Declared volatile so the
					// pre-flight projection prunes it, which leaves the echoed
					// `name` carrying the difference the relation reads. The
					// capture addresses that same field and resolves it anyway,
					// because `resolveCapturedValue` walks the raw observation.
					volatilePointers: ['/id'],
					sensitivityWitness: {
						witnessId: 'creation-follows-the-name',
						// AD-10 gives a marker-true api operation the body channel:
						// a write carries its subject in the body where a read
						// carries it in the URL.
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
						// The whole body, which the projection has already pruned
						// `/id` out of. The echoed `name` is what carries the
						// difference the relation reads, which is why the descriptor
						// permits the service to return it.
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
					// The read the capture feeds, and the first marker-false
					// operation this contract declares, so `selectControl` takes
					// both control-observe legs from it.
					operationId: 'get-thing',
					method: 'GET',
					pathTemplate: '/things/{id}',
					stateChangeMarker: false,
					requestShape: {
						path: {
							requiredKeys: ['id'],
							permittedKeys: ['id'],
							types: { id: 'string' },
						},
						query: { requiredKeys: [], permittedKeys: [], types: {} },
						header: { requiredKeys: [], permittedKeys: [], types: {} },
						body: { requiredKeys: [], permittedKeys: [], types: {} },
					},
					responseDescriptor: {
						requiredKeys: ['ok', 'thing'],
						permittedKeys: ['ok', 'thing', 'error'],
						types: { ok: 'boolean', thing: 'object', error: 'string' },
						successIndicator: '/ok',
						channelRoles: {
							'/ok': 'success-indicator',
							'/thing': 'payload',
							'/error': 'diagnostic',
						},
						collectionLocations: [],
					},
					volatilePointers: [],
					sensitivityWitness: {
						witnessId: 'the-read-follows-the-identifier',
						channel: 'path',
						legs: [
							{
								legId: 'read-witness-a',
								inputs: {
									path: { id: 't-1' },
									query: {},
									header: {},
									body: { kind: 'absent' },
								},
							},
							{
								legId: 'read-witness-b',
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
									op: 'deep-equality',
									operands: [
										{ pointer: '/interactions/read-witness-a/response-body' },
										{ pointer: '/interactions/read-witness-b/response-body' },
									],
								},
							],
						},
					},
				},
				{
					// The operation the fixture reset names. It is an ordinary
					// declared operation and its leg goes through the same port as
					// every other, which is why the reset declares inputs this
					// request shape accepts.
					//
					// It restores t-1 and touches nothing else, which
					// `testData.cleanup` states and which the plan order needs: the
					// seeded-fault leg runs after the control legs and reads t-8, so
					// a reset that cleared the store would take the record that leg
					// depends on with it.
					operationId: 'reset-things',
					method: 'POST',
					pathTemplate: '/things/reset',
					stateChangeMarker: true,
					requestShape: {
						path: { requiredKeys: [], permittedKeys: [], types: {} },
						query: { requiredKeys: [], permittedKeys: [], types: {} },
						header: { requiredKeys: [], permittedKeys: [], types: {} },
						body: {
							requiredKeys: ['seedName'],
							permittedKeys: ['seedName'],
							types: { seedName: 'string' },
						},
					},
					responseDescriptor: {
						// `seededName` is required rather than merely permitted: the
						// witness relation below is what tells two resets apart, and
						// a service free to omit the field would leave both legs
						// answering `{ ok: true }` and the relation resolving false
						// against a service doing its job.
						requiredKeys: ['ok', 'seededName'],
						permittedKeys: ['ok', 'seededName', 'error'],
						types: { ok: 'boolean', seededName: 'string', error: 'string' },
						successIndicator: '/ok',
						channelRoles: {
							'/ok': 'success-indicator',
							'/seededName': 'payload',
							'/error': 'diagnostic',
						},
						collectionLocations: [],
					},
					volatilePointers: [],
					sensitivityWitness: {
						witnessId: 'the-reset-seeds-what-it-was-given',
						channel: 'body',
						legs: [
							{
								legId: 'reset-witness-a',
								inputs: {
									path: {},
									query: {},
									header: {},
									body: { kind: 'json', value: { seedName: 'alpha' } },
								},
							},
							{
								legId: 'reset-witness-b',
								inputs: {
									path: {},
									query: {},
									header: {},
									body: { kind: 'json', value: { seedName: 'gamma' } },
								},
							},
						],
						relation: {
							op: 'not',
							operands: [
								{
									op: 'deep-equality',
									operands: [
										{ pointer: '/interactions/reset-witness-a/response-body' },
										{ pointer: '/interactions/reset-witness-b/response-body' },
									],
								},
							],
						},
					},
				},
			],
		},
	],
	referenceSets: {},
	siblingGroups: {
		operations: [['create-thing', 'get-thing']],
		parameters: [['name', 'id']],
	},
	interactionPlan: [
		{
			// Bound by literal rather than by `{ matcher: 'any' }`. The plan also
			// declares a step binding this key with the type-violating matcher,
			// and `any` binds whatever was sent, so both steps would select both
			// calls: `selectWithBindings` would return `several` under
			// `exactly-one` and the outcome would be an infrastructure error
			// rather than a verdict about the contract.
			stepId: 'create',
			operationId: 'create-thing',
			after: null,
			cardinality: 'exactly-one',
			inputBinding: {
				path: null,
				query: null,
				header: null,
				body: { name: { literal: 'a thing the run created' } },
			},
		},
		{
			// The capture. A write that mints a server-side identifier followed by
			// a read proving persistence is unwritable with a literal, which would
			// name a record the evaluator never created, and unwritable with
			// `any`, which matches unrelated reads.
			stepId: 'read-back',
			operationId: 'get-thing',
			after: 'create',
			cardinality: 'exactly-one',
			inputBinding: {
				path: { id: { captured: '/interactions/create/response-body/id' } },
				query: null,
				header: null,
				body: null,
			},
		},
		{
			stepId: 'reset',
			operationId: 'reset-things',
			after: null,
			cardinality: 'exactly-one',
			inputBinding: {
				path: null,
				query: null,
				header: null,
				body: { seedName: { literal: 'alpha' } },
			},
		},
		{
			// The reset's own read-back, at the identifier the seeded fixture
			// holds. That one is a literal, because the seed is declared in
			// `testData.setup` rather than minted by the run.
			stepId: 'reset-read-back',
			operationId: 'get-thing',
			after: 'reset',
			cardinality: 'exactly-one',
			inputBinding: {
				path: { id: { literal: 't-1' } },
				query: null,
				header: null,
				body: null,
			},
		},
		{
			stepId: 'malformed-create',
			operationId: 'create-thing',
			after: null,
			cardinality: 'at-most-one',
			inputBinding: {
				path: null,
				query: null,
				header: null,
				body: { name: { matcher: 'type-violating' } },
			},
		},
		{
			stepId: 'malformed-read',
			operationId: 'get-thing',
			after: null,
			cardinality: 'at-most-one',
			inputBinding: {
				path: { id: { matcher: 'type-violating' } },
				query: null,
				header: null,
				body: null,
			},
		},
		{
			stepId: 'malformed-reset',
			operationId: 'reset-things',
			after: null,
			cardinality: 'at-most-one',
			inputBinding: {
				path: null,
				query: null,
				header: null,
				body: { seedName: { matcher: 'type-violating' } },
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
	testData: {
		// Two things, and one of them is filed through the write under test
		// rather than placed directly. That is what gives a read something to
		// answer for whose name depends on the build: a manifestation witness
		// probes one operation with fixed inputs, so a fault in the write is
		// observable at pre-flight only on a record the write itself filed.
		// Nothing is filed under t-2, which is what the second read witness
		// reads.
		setup:
			'Seed one thing directly, with identifier t-1 and name alpha. File a second through the write under test, supplying identifier t-8. Leave t-2 unfiled.',
		cleanup:
			'Reset the store: it restores t-1 to the name it is given and leaves every other record as it found it, including t-8.',
		principals: null,
		resources: null,
	},
	// Twenty, matching the sibling contracts: the plan is seven steps, pre-flight
	// plans eleven legs beside them, six sensitivity, four control and one for
	// the seeded fault, and a bound that stopped short of the read-back would
	// make the capture unobservable.
	budgets: { maxToolCalls: 20, maxWallClockMinutes: 5, maxCostUsd: '1.00' },
	safetyLimits: [
		'No request to any host other than the mapped thing-service target.',
	],
	requiredEvidence: ['Request and response pair for every call, in order.'],
	probeStepBound: null,
	fixtureReset: {
		legId: 'reset-the-store',
		interfaceId: 'thing-service',
		operationId: 'reset-things',
		inputs: {
			path: {},
			query: {},
			header: {},
			body: { kind: 'json', value: { seedName: 'alpha' } },
		},
	},
} satisfies EvalContract
