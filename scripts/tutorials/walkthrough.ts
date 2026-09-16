// The walkthrough chain: a toy Notes API, one seeded persistence defect, and
// every artifact the four commands need to run over it from a clone.
//
// The lesson is the one the documentation has always taught and never let a
// reader reproduce. A write validates its input, builds the updated note,
// answers `ok: true` with status 200, and never stores it. The response is
// indistinguishable from a correct one, so only the independent read that
// follows shows the old value, and only an oracle relating the two catches it.
//
// Every digest here is computed rather than stood in for. That is the
// difference between this chain and the committed worked examples: theirs point
// at private references whose declared digests no file produces, so `score`
// refuses to re-run them from the command line, and a reader who cannot re-run
// a chain cannot check the page that teaches from it.
//
// Run by `node` directly: type stripping erases types only, so no TypeScript
// enum, namespace, parameter property, or non-type re-export may appear here
// or in anything it imports.
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
import type { Expression } from '../../src/core/schemas/expression.ts'
import type {
	PermittedInterface,
	ResponseDescriptor,
} from '../../src/core/schemas/interface.ts'
import {
	ISOLATION_MANIFEST_SCHEMA_VERSION,
	IsolationManifest,
} from '../../src/core/schemas/isolation-manifest.ts'
import type {
	ProbeObservation,
	ProbeObservedBody,
} from '../../src/core/schemas/port-messages.ts'
import type { KeyedShapeDescriptor } from '../../src/core/schemas/primitives.ts'
import { PROBE_SCHEMA_VERSION, Probe } from '../../src/core/schemas/probe.ts'
import {
	SEALED_RUN_RECORD_SCHEMA_VERSION,
	SealedRunRecord,
} from '../../src/core/schemas/sealed-run-record.ts'
import { fail, POLICY, renderJson } from '../worked-example-shared.ts'

/** Repository-relative, for the emitted keys and for violation messages. */
export const WALKTHROUGH_LABEL = 'examples/tutorials/walkthrough'

/**
 * The run the whole chain is about. The page passes it to `preflight` as
 * `--run-id`, and `score` refuses a verdict minted for a different run, so the
 * literal in the page and the literal here are one value.
 */
export const WALKTHROUGH_RUN_ID = 'notes-run-1'

const path = (name: string) => `${WALKTHROUGH_LABEL}/${name}`

const emptyChannel: KeyedShapeDescriptor = {
	requiredKeys: [],
	permittedKeys: [],
	types: {},
}

const noteIdPath: KeyedShapeDescriptor = {
	requiredKeys: ['noteId'],
	permittedKeys: [],
	types: { noteId: 'string' },
}

const noteResponse: ResponseDescriptor = {
	requiredKeys: ['ok'],
	permittedKeys: ['note', 'error'],
	types: { ok: 'boolean', note: 'object', error: 'string' },
	successIndicator: '/ok',
	channelRoles: {
		'/ok': 'success-indicator',
		'/note': 'payload',
		'/error': 'diagnostic',
	},
	collectionLocations: [],
}

/**
 * Two witness legs whose responses have to differ, which is what shows the
 * operation reads the channel at all. The relation is the same shape on all
 * three operations, so it is built once here.
 */
const witnessRelation = (first: string, second: string): Expression => ({
	op: 'not',
	operands: [
		{
			op: 'deep-equality',
			operands: [
				{ pointer: `/interactions/${first}/response-body` },
				{ pointer: `/interactions/${second}/response-body` },
			],
		},
	],
})

/**
 * Three operations and no create. `testData.setup` seeds the note, so the
 * shortest path to the defect is a write, an independent read, and a list
 * filtered to the title the write claimed to store.
 */
const notesInterface: PermittedInterface = {
	logicalId: 'notes-api',
	kind: 'api',
	operations: [
		{
			operationId: 'update-note',
			method: 'PATCH',
			pathTemplate: '/notes/{noteId}',
			stateChangeMarker: true,
			requestShape: {
				path: noteIdPath,
				query: emptyChannel,
				header: emptyChannel,
				body: {
					requiredKeys: ['title'],
					permittedKeys: [],
					types: { title: 'string' },
				},
			},
			responseDescriptor: noteResponse,
			volatilePointers: [],
			sensitivityWitness: {
				witnessId: 'update-note-sensitivity',
				channel: 'body',
				legs: [
					{
						legId: 'update-witness-a',
						inputs: {
							path: { noteId: 'n-1' },
							query: {},
							header: {},
							body: { kind: 'json', value: { title: 'Alpha' } },
						},
					},
					{
						legId: 'update-witness-b',
						inputs: {
							path: { noteId: 'n-1' },
							query: {},
							header: {},
							body: { kind: 'json', value: { title: 'Beta' } },
						},
					},
				],
				relation: witnessRelation('update-witness-a', 'update-witness-b'),
			},
		},
		{
			operationId: 'read-note',
			method: 'GET',
			pathTemplate: '/notes/{noteId}',
			stateChangeMarker: false,
			requestShape: {
				path: noteIdPath,
				query: emptyChannel,
				header: emptyChannel,
				body: emptyChannel,
			},
			responseDescriptor: noteResponse,
			volatilePointers: [],
			sensitivityWitness: {
				witnessId: 'read-note-sensitivity',
				channel: 'path',
				legs: [
					{
						legId: 'read-witness-a',
						inputs: {
							path: { noteId: 'n-1' },
							query: {},
							header: {},
							body: { kind: 'absent' },
						},
					},
					{
						legId: 'read-witness-b',
						inputs: {
							path: { noteId: 'n-2' },
							query: {},
							header: {},
							body: { kind: 'absent' },
						},
					},
				],
				relation: witnessRelation('read-witness-a', 'read-witness-b'),
			},
		},
		{
			operationId: 'list-notes',
			method: 'GET',
			pathTemplate: '/notes',
			stateChangeMarker: false,
			requestShape: {
				path: emptyChannel,
				query: {
					requiredKeys: ['title'],
					permittedKeys: [],
					types: { title: 'string' },
				},
				header: emptyChannel,
				body: emptyChannel,
			},
			responseDescriptor: {
				requiredKeys: ['notes'],
				permittedKeys: ['error'],
				types: { notes: 'array', error: 'string' },
				successIndicator: '/notes',
				channelRoles: { '/notes': 'collection', '/error': 'diagnostic' },
				collectionLocations: [],
			},
			volatilePointers: [],
			sensitivityWitness: {
				witnessId: 'list-notes-sensitivity',
				channel: 'query',
				legs: [
					{
						legId: 'list-witness-a',
						inputs: {
							path: {},
							query: { title: 'Original' },
							header: {},
							body: { kind: 'absent' },
						},
					},
					{
						legId: 'list-witness-b',
						inputs: {
							path: {},
							query: { title: 'Absent' },
							header: {},
							body: { kind: 'absent' },
						},
					},
				],
				relation: witnessRelation('list-witness-a', 'list-witness-b'),
			},
		},
	],
}

const contract: EvalContract = {
	schemaVersion: EVAL_CONTRACT_SCHEMA_VERSION,
	parentDigest: null,
	revisionCount: 0,
	contractId: 'tutorial-notes-api',
	sourceSpecDigest: null,
	behaviors: [
		{
			id: 'B-001',
			description: 'A write that reports success has stored the change.',
			severity: 'critical',
			observableSuccessCriterion:
				'An independent read of the same note after a successful write returns the title the write sent.',
			requirementLinks: [{ id: 'REQ-1', scheme: 'local' }],
			riskLinks: [{ id: 'RISK-1', scheme: 'local-risk' }],
			oracles: ['O-001', 'O-002', 'O-003', 'O-004'],
		},
	],
	oracles: [
		{
			id: 'O-001',
			polarity: 'expects-hold',
			commentary:
				'The only check here that can tell a stored write from a reported one.',
			check: {
				op: 'equality',
				operands: [
					{ pointer: '/interactions/write/call-inputs/body/title' },
					{ pointer: '/interactions/read-back/response-body/note/title' },
				],
			},
			direction: {
				polarity: 'expects-hold',
				relation: 'equality',
				scope: 'One write followed by an independent read of the same note.',
				negativeDomain:
					'A write reporting success while a later read returns the old title.',
				evidenceTargets: [
					'/interactions/write/call-inputs/body/title',
					'/interactions/read-back/response-body/note/title',
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
						op: 'existence',
						operands: [{ pointer: '/interactions/write/response-body/ok' }],
					},
					{
						op: 'absence',
						operands: [{ pointer: '/interactions/write/response-body/error' }],
					},
				],
			},
			direction: {
				polarity: 'expects-hold',
				relation: 'all',
				scope: 'The whole write response.',
				negativeDomain:
					'A write reporting success with a diagnostic beside it.',
				evidenceTargets: [
					'/interactions/write/response-body/ok',
					'/interactions/write/response-body/error',
				],
			},
		},
		{
			id: 'O-003',
			polarity: 'expects-hold',
			commentary: null,
			check: {
				op: 'existence',
				operands: [{ pointer: '/interactions/read-back/response-body/note' }],
			},
			direction: {
				polarity: 'expects-hold',
				relation: 'existence',
				scope: 'The read-back response.',
				negativeDomain: 'A read of a seeded note carrying no note at all.',
				evidenceTargets: ['/interactions/read-back/response-body/note'],
			},
		},
		{
			id: 'O-004',
			polarity: 'expects-hold',
			commentary:
				'Ranges over the notes carrying the new title, so it certifies nothing while there are none.',
			check: {
				op: 'for-all',
				collection: { pointer: '/interactions/list/response-body/notes' },
				predicate: { op: 'existence', operands: [{ pointer: '@/id' }] },
			},
			direction: {
				polarity: 'expects-hold',
				relation: 'for-all',
				scope: 'Every note the filtered list returns.',
				negativeDomain: 'A listed note carrying no identifier.',
				evidenceTargets: ['/interactions/list/response-body/notes'],
			},
		},
	],
	rubrics: [],
	waivers: [],
	permittedInterfaces: [notesInterface],
	referenceSets: null,
	siblingGroups: null,
	interactionPlan: [
		{
			stepId: 'write',
			operationId: 'update-note',
			inputBinding: {
				path: { noteId: { literal: 'n-1' } },
				query: null,
				header: null,
				body: { title: { matcher: 'any' } },
			},
			after: null,
			cardinality: 'exactly-one',
		},
		{
			stepId: 'read-back',
			operationId: 'read-note',
			inputBinding: {
				path: { noteId: { literal: 'n-1' } },
				query: null,
				header: null,
				body: null,
			},
			after: 'write',
			cardinality: 'exactly-one',
		},
		{
			stepId: 'list',
			operationId: 'list-notes',
			inputBinding: {
				path: null,
				query: { title: { literal: 'Revised' } },
				header: null,
				body: null,
			},
			after: 'write',
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
		setup: 'Seed exactly one note with identifier n-1 and title "Original".',
		cleanup: 'Delete every note the run created or changed.',
		principals: null,
		resources: null,
	},
	budgets: { maxToolCalls: 20, maxWallClockMinutes: 5, maxCostUsd: '0.25' },
	safetyLimits: [
		'No request to any host other than the mapped notes-api target.',
	],
	requiredEvidence: ['Request and response pair for every call, in order.'],
	probeStepBound: 8,
	fixtureReset: null,
}

/**
 * One observation per planned leg. The two legs of a witness have to answer
 * differently, and the two control legs have to answer identically, which is
 * what a state reset means.
 */
const notePayload = (title: string): ProbeObservedBody => ({
	kind: 'json',
	value: { ok: true, note: { id: 'n-1', title } },
})

const listPayload = (titles: readonly string[]): ProbeObservedBody => ({
	kind: 'json',
	value: {
		notes: titles.map((title, index) => ({ id: `n-${index + 1}`, title })),
	},
})

const legResponses: Record<string, ProbeObservedBody> = {
	'update-witness-a': notePayload('Alpha'),
	'update-witness-b': notePayload('Beta'),
	'read-witness-a': notePayload('Original'),
	'read-witness-b': {
		kind: 'json',
		value: { ok: false, error: 'no note with that identifier' },
	},
	'list-witness-a': listPayload(['Original']),
	'list-witness-b': listPayload([]),
	'preflight-control-observe': notePayload('Original'),
	'preflight-control-observe-2': notePayload('Original'),
}

const observationFor = (
	legId: string,
	operationId: string,
): ProbeObservation => {
	const body = legResponses[legId]
	if (body === undefined) fail(`${legId}: the plan grew a leg with no response`)
	return {
		kind: 'api',
		probeId: legId,
		interfaceId: 'notes-api',
		operationId,
		status: legId === 'read-witness-b' ? 404 : 200,
		headers: {},
		body,
	}
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
	toolInventory: [],
	permissionInventory: [],
	budgets: { maxToolCalls: 20, maxWallClockMinutes: 5, maxCostUsd: '0.25' },
	seed: 1,
	judgeConfiguration: null,
})

/** AD-16's seven forbidden inputs, each withheld, spelled once. */
const withheld = { withheld: true, note: null }

export function buildWalkthroughTutorial(): Map<string, string> {
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
		runId: WALKTHROUGH_RUN_ID,
	})
	const observations = plan.legs.map((leg) =>
		observationFor(leg.legId, leg.request.operationId),
	)
	const verdict = preflightFromObservations({
		contract: compiled,
		probes: [],
		runId: WALKTHROUGH_RUN_ID,
		observations,
	})
	if (!verdict.passed) {
		fail(
			`${WALKTHROUGH_LABEL}: the committed observations do not pass pre-flight, so the page would document a failing step`,
		)
	}

	const systemUnderTest = `# The system under test, and the defect seeded in it

A toy Notes API with three operations.

\`PATCH /notes/{noteId}\` takes a title, validates it, builds the updated note, and answers
\`ok: true\` with status 200.

\`GET /notes/{noteId}\` returns the stored note.

\`GET /notes?title=\` returns the notes whose title matches.

The seeded defect, D-001, is in the write. It validates the input and builds the updated note, and it
never stores it. The response carries the new title, so the write is indistinguishable from a correct
one by anything that reads only the write's own response. Only a later, independent read shows that the
stored title never moved.

The mutation is a guard deletion in the handler's store call, and it is reversible. Nothing in this
repository runs the API: the observations in \`sealed-run-record.json\` are the evidence a harness is
stipulated to have collected, and the chain exists so the four commands can be run over real bytes.
`

	// One line per recorded call, which is what an actions artifact is. The
	// baseline file is the clean arm's, so the qualification record points at
	// two different runs rather than at one file twice.
	const actions = [
		'{"action":"call","step":"write","operation":"update-note","sent":{"title":"Revised"},"received":{"ok":true,"title":"Revised"}}',
		'{"action":"call","step":"read-back","operation":"read-note","sent":{"noteId":"n-1"},"received":{"ok":true,"title":"Original"}}',
		'{"action":"call","step":"list","operation":"list-notes","sent":{"title":"Revised"},"received":{"notes":[]}}',
		'',
	].join('\n')
	const baselineActions = [
		'{"action":"call","step":"write","operation":"update-note","sent":{"title":"Revised"},"received":{"ok":true,"title":"Revised"}}',
		'{"action":"call","step":"read-back","operation":"read-note","sent":{"noteId":"n-1"},"received":{"ok":true,"title":"Revised"}}',
		'{"action":"call","step":"list","operation":"list-notes","sent":{"title":"Revised"},"received":{"notes":[{"id":"n-1","title":"Revised"}]}}',
		'',
	].join('\n')

	const actionsReference = {
		storage: 'public' as const,
		path: path('actions.jsonl'),
		privateRef: null,
		digest: digestBytes(new TextEncoder().encode(actions)),
	}
	const baselineReference = {
		storage: 'public' as const,
		path: path('baseline-actions.jsonl'),
		privateRef: null,
		digest: digestBytes(new TextEncoder().encode(baselineActions)),
	}
	const systemReference = {
		storage: 'public' as const,
		path: path('system-under-test.md'),
		privateRef: null,
		digest: digestBytes(new TextEncoder().encode(systemUnderTest)),
	}

	const probe = Probe.parse({
		schemaVersion: PROBE_SCHEMA_VERSION,
		parentDigest: null,
		revisionCount: 0,
		probeId: 'P-001',
		probeClass: 'defect',
		expectedClean: false,
		behaviorId: 'B-001',
		systemId: 'notes-api',
		implementationDigest: systemReference.digest,
		artifactDigest: systemReference.digest,
		commitDigest: systemReference.digest,
		rationale:
			'A controlled mutation removing the store call from the write handler.',
		qualification: {
			route: 'controlled-mutation',
			mutationSource: 'hand-authored mutation of the update handler',
			mutationOperator: 'guard-deletion',
			targetArtifact: systemReference,
			expectedObservableFailure:
				'a later read of the same note returns the title the write replaced',
			baselinePassEvidence: baselineReference,
			mutatedFailEvidence: actionsReference,
			rollbackVerified: true,
		},
		defects: [
			{
				defectId: 'D-001',
				behaviorId: 'B-001',
				summary: 'The write reports success and stores nothing.',
				severity: 'critical',
				oracleEvidence: [actionsReference],
				source: 'controlled-mutation',
				manifestationWitness: null,
			},
		],
		defectSignature: {
			interfaceKind: 'api',
			method: 'GET',
			pathTemplate: '/notes/{noteId}',
			observableChannel: 'response-body',
			condition: {
				selector: {
					inputBinding: {
						path: { noteId: { literal: 'n-1' } },
						query: null,
						header: null,
						body: null,
						argument: null,
						option: null,
						environment: null,
						stdin: null,
						arguments: null,
					},
				},
				predicate: {
					op: 'equality',
					operands: [
						{ pointer: '/interactions/observed/response-body/note/title' },
						{ literal: 'Original' },
					],
				},
			},
		},
	})

	const isolationManifest = IsolationManifest.parse({
		schemaVersion: ISOLATION_MANIFEST_SCHEMA_VERSION,
		parentDigest: null,
		revisionCount: 0,
		runId: WALKTHROUGH_RUN_ID,
		contractId: contract.contractId,
		conditionArm: 'mutated',
		modelSnapshot: evaluatorConfiguration.modelSnapshot,
		systemPromptDigest: evaluatorConfiguration.systemPromptDigest,
		contractDigest,
		evaluatorConfigurationDigest,
		workspaceIdentity: 'tutorial-workspace',
		allowedMounts: [],
		observedMounts: [],
		networkAllowlist: ['notes-api'],
		observedNetworkTargets: ['notes-api'],
		toolAllowlist: [],
		observedToolCalls: [],
		resourceCeilings: {
			maxToolCalls: 20,
			maxInputTokens: 100000,
			maxOutputTokens: 100000,
			maxWallClockMinutes: 5,
			maxCostUsd: '0.25',
		},
		actualResourceUse: {
			toolCalls: 3,
			inputTokens: 1200,
			outputTokens: 200,
			wallClockSeconds: 4,
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
		runId: WALKTHROUGH_RUN_ID,
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
				observationIds: ['obs-001', 'obs-002'],
				note: 'The read after the write returned the title the write replaced.',
			},
			{
				oracleId: 'O-002',
				disposition: 'held',
				observationIds: ['obs-001'],
				note: 'The write reported success and carried no diagnostic.',
			},
			{
				oracleId: 'O-003',
				disposition: 'held',
				observationIds: ['obs-002'],
				note: 'The read returned a note.',
			},
			{
				oracleId: 'O-004',
				disposition: 'held',
				observationIds: ['obs-003'],
				note: 'No listed note lacked an identifier.',
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
				summary: 'The write reported success and the note kept its old title.',
				confidence: 0.95,
				observationIds: ['obs-002'],
				evidenceArtifacts: [actionsReference],
				quotedEvidence: [
					{ quote: 'Original', channel: 'response-body', artifactId: null },
				],
			},
		],
		observations: [
			{
				observationId: 'obs-001',
				sequence: 1,
				operationId: 'update-note',
				provenance: 'evaluator-chosen',
				principal: null,
				callInputs: {
					path: { noteId: 'n-1' },
					query: null,
					header: null,
					body: { title: 'Revised' },
					argument: null,
					option: null,
					environment: null,
					stdin: null,
					arguments: null,
				},
				responseBody: { ok: true, note: { id: 'n-1', title: 'Revised' } },
				responseHeaders: null,
				responseStatus: 200,
				stdout: { kind: 'absent' },
				stderr: { kind: 'absent' },
				exitCode: null,
				artifacts: {},
			},
			{
				observationId: 'obs-002',
				sequence: 2,
				operationId: 'read-note',
				provenance: 'evaluator-chosen',
				principal: null,
				callInputs: {
					path: { noteId: 'n-1' },
					query: null,
					header: null,
					body: null,
					argument: null,
					option: null,
					environment: null,
					stdin: null,
					arguments: null,
				},
				responseBody: { ok: true, note: { id: 'n-1', title: 'Original' } },
				responseHeaders: null,
				responseStatus: 200,
				stdout: { kind: 'absent' },
				stderr: { kind: 'absent' },
				exitCode: null,
				artifacts: {},
			},
			{
				observationId: 'obs-003',
				sequence: 3,
				operationId: 'list-notes',
				provenance: 'evaluator-chosen',
				principal: null,
				callInputs: {
					path: null,
					query: { title: 'Revised' },
					header: null,
					body: null,
					argument: null,
					option: null,
					environment: null,
					stdin: null,
					arguments: null,
				},
				responseBody: { notes: [] },
				responseHeaders: null,
				responseStatus: 200,
				stdout: { kind: 'absent' },
				stderr: { kind: 'absent' },
				exitCode: null,
				artifacts: {},
			},
		],
		judgeResults: [],
		actionsArtifact: actionsReference,
		isolationManifestArtifact: {
			storage: 'public',
			path: path('isolation-manifest.json'),
			privateRef: null,
			digest: digestBytes(new TextEncoder().encode(isolationManifestText)),
		},
		resourceUse: {
			toolCalls: 3,
			inputTokens: 1200,
			outputTokens: 200,
			wallClockSeconds: 4,
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
		[path('actions.jsonl'), actions],
		[path('baseline-actions.jsonl'), baselineActions],
		[path('system-under-test.md'), systemUnderTest],
		[path('corpus-digest.txt'), `${corpusDigest}\n`],
	])
}
