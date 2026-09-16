// The tool-use chain: an MCP tool server, one seeded tool defect, and the
// artifacts the four commands need to run over it from a clone.
//
// The lesson is that a tool reporting success is weaker evidence than the state
// it left. `create_note` answers `ok: true` with the identifier it minted in
// both arms of the twin run, and the two arms are told apart only by an
// independent search for that identifier, which returns the title the tool
// really filed.
//
// This chain differs from the others in one way worth knowing. Its pre-flight
// legs and its plan steps are issued against a real server process over MCP's
// stdio transport, by `examples/tutorials/tool-use/run-tool-calls.mjs`. The
// builder below replays the same calls against the same pure tool logic in
// `examples/tutorials/tool-use/notes-store.mjs`, which the server also reads, so
// the committed observations and a reader's own run come from one definition
// rather than from two that can drift.
//
// The contract is authored here rather than taken from
// `corpus/dev/contracts/notes-tool-server.json`. The published one compiles,
// seals and pre-flights against this server unchanged, and it cannot carry a
// caught defect: `designatedOracleIdOf` resolves an oracle only for a behavior
// declaring exactly one, and both of its behaviors declare several. Every
// behavior below declares one oracle, which is the same one-behavior-one-oracle
// discipline the skill guide turns on.
//
// Run by `node` directly: type stripping erases types only, so no TypeScript
// enum, namespace, parameter property, or non-type re-export may appear here
// or in anything it imports.
import {
	callTool,
	PLAN_STEPS,
	seedNotes,
} from '../../examples/tutorials/tool-use/notes-store.mjs'
import { compile } from '../../src/application/compile.ts'
import { preflightFromObservations } from '../../src/application/preflight.ts'
import { seal } from '../../src/application/seal.ts'
import { digestArtifact, digestBytes } from '../../src/core/canonical/digest.ts'
import { planPreflight } from '../../src/core/preflight/plan.ts'
import {
	EVAL_CONTRACT_SCHEMA_VERSION,
	type EvalContract,
} from '../../src/core/schemas/eval-contract.ts'
import {
	EVALUATOR_CONFIGURATION_SCHEMA_VERSION,
	EvaluatorConfiguration,
} from '../../src/core/schemas/evaluator-configuration.ts'
import type { ResponseDescriptor } from '../../src/core/schemas/interface.ts'
import {
	ISOLATION_MANIFEST_SCHEMA_VERSION,
	IsolationManifest,
} from '../../src/core/schemas/isolation-manifest.ts'
import type { ProbeObservation } from '../../src/core/schemas/port-messages.ts'
import type { JsonObject } from '../../src/core/schemas/primitives.ts'
import { PROBE_SCHEMA_VERSION, Probe } from '../../src/core/schemas/probe.ts'
import {
	SEALED_RUN_RECORD_SCHEMA_VERSION,
	SealedRunRecord,
} from '../../src/core/schemas/sealed-run-record.ts'
import { fail, POLICY, renderJson } from '../worked-example-shared.ts'

/** Repository-relative, for the emitted keys and for violation messages. */
export const TOOL_USE_LABEL = 'examples/tutorials/tool-use'

/**
 * The run the chain is about. The page passes it to `preflight` as `--run-id`,
 * so the literal in the page and the literal here are one value.
 */
export const TOOL_USE_RUN_ID = 'tool-run-1'

const path = (name: string) => `${TOOL_USE_LABEL}/${name}`

const INTERFACE_ID = 'notes-tool-server'

const searchResponse: ResponseDescriptor = {
	requiredKeys: ['ok', 'matches', 'totalCount'],
	permittedKeys: ['topMatch'],
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
		'/topMatch': 'payload',
	},
	collectionLocations: [
		{
			pointer: '/matches',
			referenceSet: null,
			expectedCardinality: { mode: 'at-most', max: 20 },
		},
	],
}

const createResponse: ResponseDescriptor = {
	requiredKeys: ['ok'],
	permittedKeys: ['noteId'],
	types: { ok: 'boolean', noteId: 'string' },
	successIndicator: '/ok',
	channelRoles: { '/ok': 'success-indicator', '/noteId': 'payload' },
	collectionLocations: [],
}

const contract: EvalContract = {
	schemaVersion: EVAL_CONTRACT_SCHEMA_VERSION,
	parentDigest: null,
	revisionCount: 0,
	contractId: 'tutorial-notes-tool-server',
	sourceSpecDigest: null,
	behaviors: [
		{
			id: 'B-001',
			description:
				'A creation that reports success has filed the note under the title it was sent.',
			severity: 'critical',
			observableSuccessCriterion:
				'An independent search for the identifier the creation returned names the title the creation was sent.',
			requirementLinks: [{ id: 'REQ-1', scheme: 'local' }],
			riskLinks: [{ id: 'RISK-1', scheme: 'local-risk' }],
			oracles: ['O-001'],
		},
		{
			id: 'B-002',
			description: 'A search reports the list it searched and its size.',
			severity: 'material',
			observableSuccessCriterion:
				'A successful search carries both the match list and the count of it.',
			requirementLinks: [{ id: 'REQ-2', scheme: 'local' }],
			riskLinks: [],
			oracles: ['O-002'],
		},
		{
			id: 'B-003',
			description:
				'A creation answers with the identifier it filed the note under.',
			severity: 'material',
			observableSuccessCriterion:
				'A successful creation carries an identifier.',
			requirementLinks: [{ id: 'REQ-3', scheme: 'local' }],
			riskLinks: [],
			oracles: ['O-003'],
		},
		{
			id: 'B-004',
			description:
				'A tool given an argument of the wrong type refuses the call.',
			severity: 'material',
			observableSuccessCriterion:
				'A creation sent a non-string title reports failure.',
			requirementLinks: [{ id: 'REQ-4', scheme: 'local' }],
			riskLinks: [],
			oracles: ['O-004'],
		},
	],
	oracles: [
		{
			id: 'O-001',
			polarity: 'expects-hold',
			commentary:
				'The only check here that can tell a filed note from a reported one.',
			check: {
				op: 'equality',
				operands: [
					{ pointer: '/interactions/read-back/response-body/topMatch/title' },
					{ pointer: '/interactions/create/call-inputs/arguments/title' },
				],
			},
			direction: {
				polarity: 'expects-hold',
				relation: 'equality',
				scope:
					'One creation followed by an independent search for the identifier it returned.',
				negativeDomain:
					'A creation reporting success while the note it filed carries another title.',
				evidenceTargets: [
					'/interactions/read-back/response-body/topMatch/title',
					'/interactions/create/call-inputs/arguments/title',
				],
			},
		},
		{
			id: 'O-002',
			polarity: 'expects-hold',
			commentary: null,
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
			direction: {
				polarity: 'expects-hold',
				relation: 'all',
				scope: 'One search call for one query.',
				negativeDomain:
					'A search reporting success and carrying no list or no count.',
				evidenceTargets: [
					'/interactions/search/response-body/ok',
					'/interactions/search/response-body/matches',
					'/interactions/search/response-body/totalCount',
				],
			},
		},
		{
			id: 'O-003',
			polarity: 'expects-hold',
			commentary: null,
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
			direction: {
				polarity: 'expects-hold',
				relation: 'all',
				scope: 'One creation call.',
				negativeDomain: 'A creation reporting success with no identifier.',
				evidenceTargets: [
					'/interactions/create/response-body/ok',
					'/interactions/create/response-body/noteId',
				],
			},
		},
		{
			id: 'O-004',
			polarity: 'expects-hold',
			commentary: null,
			check: {
				op: 'equality',
				operands: [
					{ pointer: '/interactions/malformed-create/response-body/ok' },
					{ literal: false },
				],
			},
			direction: {
				polarity: 'expects-hold',
				relation: 'equality',
				scope: 'One creation sent a title of the wrong JSON type.',
				negativeDomain: 'A creation accepting a non-string title.',
				evidenceTargets: ['/interactions/malformed-create/response-body/ok'],
			},
		},
	],
	rubrics: [],
	waivers: [],
	permittedInterfaces: [
		{
			logicalId: INTERFACE_ID,
			kind: 'mcp',
			operations: [
				{
					operationId: 'search-notes',
					toolName: 'search_notes',
					stateChangeMarker: false,
					requestShape: {
						arguments: {
							requiredKeys: ['query'],
							permittedKeys: [],
							types: { query: 'string' },
						},
					},
					descriptorChannel: { kind: 'structured-result' },
					responseDescriptor: searchResponse,
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
					operationId: 'create-note',
					toolName: 'create_note',
					stateChangeMarker: true,
					requestShape: {
						arguments: {
							requiredKeys: ['title'],
							permittedKeys: [],
							types: { title: 'string' },
						},
					},
					descriptorChannel: { kind: 'structured-result' },
					responseDescriptor: createResponse,
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
			inputBinding: { arguments: { query: { literal: 'alpha' } } },
			after: null,
			cardinality: 'exactly-one',
		},
		{
			stepId: 'create',
			operationId: 'create-note',
			inputBinding: { arguments: { title: { literal: 'a new note' } } },
			after: null,
			cardinality: 'exactly-one',
		},
		{
			stepId: 'malformed-search',
			operationId: 'search-notes',
			inputBinding: { arguments: { query: { matcher: 'type-violating' } } },
			after: null,
			cardinality: 'at-most-one',
		},
		{
			stepId: 'malformed-create',
			operationId: 'create-note',
			inputBinding: { arguments: { title: { matcher: 'type-violating' } } },
			after: null,
			cardinality: 'at-most-one',
		},
		{
			stepId: 'read-back',
			operationId: 'search-notes',
			inputBinding: {
				arguments: {
					query: { captured: '/interactions/create/response-body/noteId' },
				},
			},
			after: 'create',
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
		setup: 'The server starts from its seeded notes, n-1 and n-2.',
		cleanup: 'Delete the store file the run wrote.',
		principals: null,
		resources: null,
	},
	budgets: { maxToolCalls: 20, maxWallClockMinutes: 5, maxCostUsd: '0.25' },
	safetyLimits: [
		'No tool beyond the two the authorization names may be called.',
	],
	requiredEvidence: ['The arguments and the structured result of every call.'],
	probeStepBound: 8,
	fixtureReset: {
		legId: 'reset-notes',
		interfaceId: INTERFACE_ID,
		operationId: 'create-note',
		inputs: { arguments: { title: 'the clean fixture' } },
	},
}

/**
 * The pre-flight legs, replayed against the same tool logic the server runs, in
 * the order the stage issues them. One notes object across the whole run,
 * because the server keeps its notes in a file and the adapter opens a fresh
 * session per call.
 */
const legObservations = (
	legs: readonly { legId: string; request: { operationId: string } }[],
	requests: readonly { toolName: string; args: JsonObject }[],
	seedDefect: boolean,
): ProbeObservation[] => {
	const notes = seedNotes()
	return legs.map((leg, index) => {
		const request = requests[index]
		if (request === undefined) fail(`${leg.legId}: the plan grew a leg`)
		const answer = callTool(notes, request.toolName, request.args, seedDefect)
		return {
			kind: 'mcp',
			probeId: leg.legId,
			interfaceId: INTERFACE_ID,
			operationId: leg.request.operationId,
			isError: answer.isError,
			result: { kind: 'json', value: answer.structuredResult },
		} as ProbeObservation
	})
}

/** The contract's own plan steps, replayed the way the helper issues them. */
const stepObservations = (seedDefect: boolean) => {
	const notes = seedNotes()
	const answers: Record<string, JsonObject> = {}
	return PLAN_STEPS.map((step, index) => {
		const args = step.argumentsFor(answers) as JsonObject
		const answer = callTool(notes, step.toolName, args, seedDefect)
		const body = answer.structuredResult as JsonObject
		answers[step.stepId] = body
		return {
			observationId: `obs-${step.stepId}`,
			sequence: index + 1,
			operationId: step.operationId,
			provenance: 'evaluator-chosen',
			principal: null,
			callInputs: {
				path: null,
				query: null,
				header: null,
				body: null,
				argument: null,
				option: null,
				environment: null,
				stdin: null,
				arguments: args,
			},
			responseBody: body,
			responseHeaders: null,
			responseStatus: answer.isError ? 1 : 0,
			stdout: { kind: 'absent' },
			stderr: { kind: 'absent' },
			exitCode: null,
			artifacts: {},
		}
	})
}

const evaluatorConfiguration = EvaluatorConfiguration.parse({
	schemaVersion: EVALUATOR_CONFIGURATION_SCHEMA_VERSION,
	parentDigest: null,
	revisionCount: 0,
	sealedBriefDigest: digestArtifact(seal(contract), 'SealedEvaluatorBrief'),
	evaluatorIdentity: 'opaque:tutorial-evaluator',
	modelSnapshot: 'tutorial-deterministic-evaluator',
	systemPromptDigest: digestBytes(
		new TextEncoder().encode('tutorial evaluator system prompt'),
	),
	decodingParameters: { temperature: 0 },
	toolInventory: ['search_notes', 'create_note'],
	permissionInventory: [],
	budgets: { maxToolCalls: 20, maxWallClockMinutes: 5, maxCostUsd: '0.25' },
	seed: 1,
	judgeConfiguration: null,
})

/** AD-16's seven forbidden inputs, each withheld, spelled once. */
const withheld = { withheld: true, note: null }

export function buildToolUseTutorial(): Map<string, string> {
	const compiled = compile(contract)
	const brief = seal(contract)
	const contractDigest = digestArtifact(compiled, 'EvalContract')
	const briefDigest = digestArtifact(brief, 'SealedEvaluatorBrief')
	const evaluatorConfigurationDigest = digestArtifact(
		evaluatorConfiguration,
		'EvaluatorConfiguration',
	)

	const plan = planPreflight({
		contract: compiled,
		probes: [],
		runId: TOOL_USE_RUN_ID,
	})
	const requests = plan.legs.map((leg) => {
		if (leg.request.kind !== 'mcp') {
			fail(`${leg.legId}: the plan minted a ${leg.request.kind} request`)
		}
		return {
			toolName: leg.request.toolName,
			args: leg.request.channels.arguments as JsonObject,
		}
	})
	const observations = legObservations(plan.legs, requests, false)
	const verdict = preflightFromObservations({
		contract: compiled,
		probes: [],
		runId: TOOL_USE_RUN_ID,
		observations,
	})
	if (!verdict.passed) {
		fail(
			`${TOOL_USE_LABEL}: the committed observations do not pass pre-flight, so the page would document a failing step`,
		)
	}

	const baselineSteps = stepObservations(false)
	const seededSteps = stepObservations(true)
	const baselineText = renderJson(baselineSteps, 'Observation')
	const seededText = renderJson(seededSteps, 'Observation')

	const systemUnderTest = `# The tool server, and the defect seeded in it

\`examples/tutorials/tool-use/tool-server.mjs\` publishes two tools over MCP's stdio transport.

\`search_notes\` takes a query and answers with the notes that match, their count, and the top
match's title when the query names a note the server holds.

\`create_note\` takes a title, files a note under an identifier derived from it, and answers with
that identifier.

The seeded defect is in the creation. It validates the title, mints the identifier, and answers
\`ok: true\` with that identifier, exactly as a correct server does. What it files under the
identifier is a placeholder rather than the title it was sent. Nothing in the creation's own answer
shows this, and an independent search for the identifier it returned is what shows it.

The mutation is the \`--seed-defect\` launch flag, which selects one branch in
\`notes-store.mjs\`, and it is reversible by dropping the flag.
`

	const systemReference = {
		storage: 'public' as const,
		path: path('system-under-test.md'),
		privateRef: null,
		digest: digestBytes(new TextEncoder().encode(systemUnderTest)),
	}
	const baselineReference = {
		storage: 'public' as const,
		path: path('baseline-steps.json'),
		privateRef: null,
		digest: digestBytes(new TextEncoder().encode(baselineText)),
	}
	const seededReference = {
		storage: 'public' as const,
		path: path('seeded-steps.json'),
		privateRef: null,
		digest: digestBytes(new TextEncoder().encode(seededText)),
	}

	const probe = Probe.parse({
		schemaVersion: PROBE_SCHEMA_VERSION,
		parentDigest: null,
		revisionCount: 0,
		probeId: 'P-001',
		probeClass: 'defect',
		expectedClean: false,
		behaviorId: 'B-001',
		systemId: INTERFACE_ID,
		implementationDigest: systemReference.digest,
		artifactDigest: systemReference.digest,
		commitDigest: systemReference.digest,
		rationale:
			'A controlled mutation filing a created note under a placeholder title.',
		qualification: {
			route: 'controlled-mutation',
			mutationSource:
				'the --seed-defect launch flag on the tutorial tool server',
			mutationOperator: 'stored-field-substitution',
			targetArtifact: systemReference,
			expectedObservableFailure:
				'an independent search for the identifier the creation returned names another title',
			baselinePassEvidence: baselineReference,
			mutatedFailEvidence: seededReference,
			rollbackVerified: true,
		},
		defects: [
			{
				defectId: 'D-001',
				behaviorId: 'B-001',
				summary: 'The creation reports success and files another title.',
				severity: 'critical',
				oracleEvidence: [seededReference],
				source: 'controlled-mutation',
				manifestationWitness: null,
			},
		],
		defectSignature: {
			interfaceKind: 'mcp',
			toolName: 'search_notes',
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
						arguments: { query: { matcher: 'any' } },
					},
				},
				predicate: {
					op: 'equality',
					operands: [
						{ pointer: '/interactions/observed/response-body/topMatch/title' },
						{ literal: '(untitled)' },
					],
				},
			},
		},
	})

	const isolationManifest = IsolationManifest.parse({
		schemaVersion: ISOLATION_MANIFEST_SCHEMA_VERSION,
		parentDigest: null,
		revisionCount: 0,
		runId: TOOL_USE_RUN_ID,
		contractId: contract.contractId,
		conditionArm: 'mutated',
		modelSnapshot: evaluatorConfiguration.modelSnapshot,
		systemPromptDigest: evaluatorConfiguration.systemPromptDigest,
		contractDigest,
		evaluatorConfigurationDigest,
		workspaceIdentity: 'tutorial-workspace',
		allowedMounts: [],
		observedMounts: [],
		networkAllowlist: [],
		observedNetworkTargets: [],
		toolAllowlist: ['search_notes', 'create_note'],
		observedToolCalls: ['search_notes', 'create_note'],
		resourceCeilings: {
			maxToolCalls: 20,
			maxInputTokens: 100000,
			maxOutputTokens: 100000,
			maxWallClockMinutes: 5,
			maxCostUsd: '0.25',
		},
		actualResourceUse: {
			toolCalls: 5,
			inputTokens: 900,
			outputTokens: 150,
			wallClockSeconds: 3,
			costUsd: '0.01',
		},
		forbiddenInputAccounting: {
			'original-spec': withheld,
			'source-code': withheld,
			repository: withheld,
			'builder-transcript': withheld,
			'implementation-logs': withheld,
			'comparator-results': withheld,
			'human-labels': withheld,
		},
		violation: null,
	})
	const isolationManifestText = renderJson(
		isolationManifest,
		'IsolationManifest',
	)

	const record = SealedRunRecord.parse({
		schemaVersion: SEALED_RUN_RECORD_SCHEMA_VERSION,
		parentDigest: null,
		revisionCount: 0,
		runId: TOOL_USE_RUN_ID,
		conditionArm: 'mutated',
		mode: 'contract-scoring',
		trialIndex: 1,
		contractDigest,
		sealedBriefDigest: briefDigest,
		evaluatorConfigurationDigest,
		evaluatorRecommendation: 'FAIL',
		oracleDispositions: [
			{
				oracleId: 'O-001',
				disposition: 'violated',
				observationIds: ['obs-create', 'obs-read-back'],
				note: 'The search for the identifier the creation returned named another title.',
			},
			{
				oracleId: 'O-002',
				disposition: 'held',
				observationIds: ['obs-search'],
				note: 'The search carried its list and its count.',
			},
			{
				oracleId: 'O-003',
				disposition: 'held',
				observationIds: ['obs-create'],
				note: 'The creation answered with an identifier.',
			},
			{
				oracleId: 'O-004',
				disposition: 'held',
				observationIds: ['obs-malformed-create'],
				note: 'The creation refused a title of the wrong type.',
			},
		],
		findings: [
			{
				findingType: 'defect',
				findingId: 'F-001',
				oracleId: 'O-001',
				probeId: 'P-001',
				behaviorId: 'B-001',
				severity: 'critical',
				summary:
					'The creation reported success and the note it filed carries another title.',
				confidence: 0.95,
				observationIds: ['obs-read-back'],
				evidenceArtifacts: [seededReference],
				quotedEvidence: [
					{ quote: '(untitled)', channel: 'response-body', artifactId: null },
				],
			},
		],
		observations: seededSteps,
		judgeResults: [],
		actionsArtifact: seededReference,
		isolationManifestArtifact: {
			storage: 'public',
			path: path('isolation-manifest.json'),
			privateRef: null,
			digest: digestBytes(new TextEncoder().encode(isolationManifestText)),
		},
		resourceUse: {
			toolCalls: 5,
			inputTokens: 900,
			outputTokens: 150,
			wallClockSeconds: 3,
			costUsd: '0.01',
		},
		evidenceDisclosure: { truncationBound: null, reportedIncomplete: false },
	})

	const probeText = renderJson(probe, 'Probe')
	const corpusDigest = digestBytes(new TextEncoder().encode(probeText))

	return new Map([
		[path('contract.json'), renderJson(contract, 'EvalContract')],
		[path('probes.json'), renderJson([], 'Probe')],
		[path('observations.json'), renderJson(observations, 'ProbeObservation')],
		[path('probe.json'), probeText],
		[path('sealed-run-record.json'), renderJson(record, 'SealedRunRecord')],
		[path('scoring-policy.json'), renderJson(POLICY, 'ScoringPolicy')],
		[path('isolation-manifest.json'), isolationManifestText],
		[
			path('evaluator-configuration.json'),
			renderJson(evaluatorConfiguration, 'EvaluatorConfiguration'),
		],
		[path('baseline-steps.json'), baselineText],
		[path('seeded-steps.json'), seededText],
		[path('system-under-test.md'), systemUnderTest],
		[path('corpus-digest.txt'), `${corpusDigest}\n`],
	])
}
