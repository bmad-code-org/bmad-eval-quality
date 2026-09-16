// The workflow chain: ordered steps, one step bound to a value an earlier step
// produced, and a seeded write defect that only the bound read can see.
//
// The lesson is the capture. A create mints an identifier the contract could
// never name in advance, so the read that proves persistence has to be bound to
// whatever the create returned. The seeded defect drops the name on the way to
// the store, and the write answers from the request it was handed, so the
// write's own response is indistinguishable from a correct one. The read at the
// identifier the write returned is the only place the fault is visible.
//
// The contract is imported rather than authored here, and it is the object
// `corpus/dev/contracts/captured-read-back.json` publishes. A reader can hash
// those published bytes and get the `contractDigest` this chain's record
// carries, which is what lets them check that the evidence was produced from the
// contract they are holding. `generate-dev-corpus.ts` states the precedent for a
// script reading contract data out of `tests/`.
//
// Every digest is computed, and every artifact reference is public, so the four
// commands run over these files from a clone with no `--corpus-root`.
//
// Run by `node` directly: type stripping erases types only, so no TypeScript
// enum, namespace, parameter property, or non-type re-export may appear here
// or in anything it imports.
import { compile } from '../../src/application/compile.ts'
import { preflightFromObservations } from '../../src/application/preflight.ts'
import { seal } from '../../src/application/seal.ts'
import { digestArtifact, digestBytes } from '../../src/core/canonical/digest.ts'
import { StructuralFailure } from '../../src/core/failure-codes.ts'
import { planPreflight } from '../../src/core/preflight/plan.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import {
	EVALUATOR_CONFIGURATION_SCHEMA_VERSION,
	EvaluatorConfiguration,
} from '../../src/core/schemas/evaluator-configuration.ts'
import {
	ISOLATION_MANIFEST_SCHEMA_VERSION,
	IsolationManifest,
} from '../../src/core/schemas/isolation-manifest.ts'
import type { ProbeObservation } from '../../src/core/schemas/port-messages.ts'
import type { JsonValue } from '../../src/core/schemas/primitives.ts'
import { PROBE_SCHEMA_VERSION, Probe } from '../../src/core/schemas/probe.ts'
import {
	SEALED_RUN_RECORD_SCHEMA_VERSION,
	SealedRunRecord,
} from '../../src/core/schemas/sealed-run-record.ts'
import {
	FILED_ID,
	SEEDED_ID,
	SEEDED_NAME,
	SUBSTITUTED_NAME,
	WRITTEN_NAME,
	workflowContract,
} from '../../tests/schemas/fixtures/workflow-contract.ts'
import { fail, POLICY, renderJson } from '../worked-example-shared.ts'

/** Repository-relative, for the emitted keys and for violation messages. */
export const WORKFLOW_TUTORIAL_LABEL = 'examples/tutorials/workflow'

/**
 * The run the whole chain is about. The page passes it to `preflight` as
 * `--run-id`, and the record and the isolation manifest both carry it, so the
 * literal in the page and the literal here are one value.
 */
export const WORKFLOW_TUTORIAL_RUN_ID = 'workflow-run-1'

/** The identifier the write minted, and the value the capture resolves to. */
const MINTED_ID = 't-7'

const MANIFESTATION_LEG_ID = 'workflow-defect-leg'

const path = (name: string) => `${WORKFLOW_TUTORIAL_LABEL}/${name}`

/**
 * The published corpus contract, as the object the corpus builder writes. The
 * page names `corpus/dev/contracts/captured-read-back.json` directly rather than
 * a copy under this directory, so there is one contract and one digest.
 */
const authoredContract = EvalContract.parse(workflowContract)

const JSON_HEADERS = { 'content-type': 'application/json' }

const thing = (id: string, name: string): JsonValue => ({ id, name })

/** An api observation's nine input channels, with the two this contract binds. */
const callInputs = (
	channels: Partial<{
		path: Record<string, JsonValue>
		body: Record<string, JsonValue>
	}>,
) => ({
	path: channels.path ?? null,
	query: null,
	header: null,
	body: channels.body ?? null,
	argument: null,
	option: null,
	environment: null,
	stdin: null,
	arguments: null,
})

const apiObservation = (
	legId: string,
	interfaceId: string,
	operationId: string,
	status: number,
	body: JsonValue,
): ProbeObservation => ({
	probeId: legId,
	interfaceId,
	operationId,
	kind: 'api',
	status,
	headers: JSON_HEADERS,
	body: { kind: 'json', value: body },
})

/**
 * One reply per planned leg, keyed by the leg identifier the contract declares.
 * The two control-observe identifiers are minted by the planner and have no
 * entry, so they are answered by purpose below.
 */
const REPLY_FOR: Record<
	string,
	{ readonly status: number; readonly body: JsonValue }
> = {
	'create-witness-a': {
		status: 201,
		body: { ok: true, id: SEEDED_ID, name: 'gamma' },
	},
	'create-witness-b': {
		status: 201,
		body: { ok: true, id: SEEDED_ID, name: 'beta' },
	},
	'read-witness-a': {
		status: 200,
		body: { ok: true, thing: thing(SEEDED_ID, SEEDED_NAME) },
	},
	// A read of an identifier the setup leaves unfiled. The witness relation is
	// `not(deep-equality)` over the two bodies, so a truthful miss separates the
	// pair. A 404 on a sensitivity leg reaches no anomaly test; the same reply on
	// a control leg would fail `clean-control` naming the status.
	'read-witness-b': {
		status: 404,
		body: { ok: false, error: 'no thing is filed under that identifier' },
	},
	'reset-witness-a': { status: 200, body: { ok: true, seededName: 'gamma' } },
	// The last sensitivity leg, and it leaves the fixture in the state the setup
	// declares, which is what the control block starts from.
	'reset-witness-b': {
		status: 200,
		body: { ok: true, seededName: SEEDED_NAME },
	},
	// The planner hands this leg the first create witness leg's inputs, so it
	// overwrites the record the two control-observe legs read, and the reset leg
	// after it is what puts the name back.
	'preflight-control-mutate': {
		status: 201,
		body: { ok: true, id: SEEDED_ID, name: 'gamma' },
	},
	'reset-the-store': {
		status: 200,
		body: { ok: true, seededName: SEEDED_NAME },
	},
	// The fault leg reads the record the setup files through the write under
	// test. Its request and its answer both differ from every other read leg's,
	// so none of them is dropped from the examined set and `seeded-faults-scoped`
	// has clean legs to establish scoping over.
	[MANIFESTATION_LEG_ID]: {
		status: 200,
		body: { ok: true, thing: thing(FILED_ID, SUBSTITUTED_NAME) },
	},
}

/**
 * What the two minted control-observe legs answer, in the order the planner
 * emits them: the read before the control mutation, and the read after the
 * reset. They are equal, and that equality is what `state-reset` checks. Two
 * entries rather than one shared reply, so a fixture the reset failed to restore
 * stays expressible and the check can be falsified.
 */
const CONTROL_OBSERVE_REPLIES: readonly {
	readonly status: number
	readonly body: JsonValue
}[] = [
	{ status: 200, body: { ok: true, thing: thing(SEEDED_ID, SEEDED_NAME) } },
	{ status: 200, body: { ok: true, thing: thing(SEEDED_ID, SEEDED_NAME) } },
]

const SYSTEM_UNDER_TEST = `# The system under test, and the defect seeded in it

A toy thing service with three operations.

\`POST /things\` files a record and answers with the identifier it filed it under, \`ok: true\`, and the
name it was sent.

\`GET /things/{id}\` returns the record filed under that identifier.

\`POST /things/reset\` seeds the store with the name it is given and restores \`${SEEDED_ID}\`.

The seeded defect, D-001, is in the write. It drops the name on the way to the store, and the store
files the record under its own placeholder \`${SUBSTITUTED_NAME}\`. The handler answers from the
request it was given, so the write reports the name that never reached the store. Only an independent
read at the identifier the write returned shows the placeholder.

The mutation is a field drop in the write handler, and it is reversible. Nothing in this repository
runs the service: the observations in \`sealed-run-record.json\` are the evidence a harness is
stipulated to have collected, and the chain exists so the commands can be run over real bytes.
`

// One line per recorded call, which is what an actions artifact is. The baseline
// file is the clean arm's, so the qualification record points at two different
// runs rather than at one file twice.
const ACTIONS = [
	`{"action":"call","step":"reset","operation":"reset-things","sent":{"seedName":"${SEEDED_NAME}"},"received":{"ok":true,"seededName":"${SEEDED_NAME}"}}`,
	`{"action":"call","step":"reset-read-back","operation":"get-thing","sent":{"id":"${SEEDED_ID}"},"received":{"ok":true,"name":"${SEEDED_NAME}"}}`,
	`{"action":"call","step":"create","operation":"create-thing","sent":{"name":"${WRITTEN_NAME}"},"received":{"ok":true,"id":"${MINTED_ID}","name":"${WRITTEN_NAME}"}}`,
	`{"action":"call","step":"read-back","operation":"get-thing","sent":{"id":"${MINTED_ID}"},"received":{"ok":true,"name":"${SUBSTITUTED_NAME}"}}`,
	'',
].join('\n')

const BASELINE_ACTIONS = [
	`{"action":"call","step":"reset","operation":"reset-things","sent":{"seedName":"${SEEDED_NAME}"},"received":{"ok":true,"seededName":"${SEEDED_NAME}"}}`,
	`{"action":"call","step":"reset-read-back","operation":"get-thing","sent":{"id":"${SEEDED_ID}"},"received":{"ok":true,"name":"${SEEDED_NAME}"}}`,
	`{"action":"call","step":"create","operation":"create-thing","sent":{"name":"${WRITTEN_NAME}"},"received":{"ok":true,"id":"${MINTED_ID}","name":"${WRITTEN_NAME}"}}`,
	`{"action":"call","step":"read-back","operation":"get-thing","sent":{"id":"${MINTED_ID}"},"received":{"ok":true,"name":"${WRITTEN_NAME}"}}`,
	'',
].join('\n')

/** AD-16's seven forbidden inputs, each withheld, spelled once. */
const withheld = { withheld: true, note: null }

/**
 * A contract with one field changed, rendered so the page can run `compile` over
 * real committed bytes and declare the exit code. The builder compiles each one
 * and fails the build unless the expected code comes back, so a rule that stops
 * firing is caught here rather than in a stale page.
 */
const brokenVariant = (
	name: string,
	expectedCode: string,
	mutate: (contract: EvalContract) => EvalContract,
): readonly [string, string] => {
	const variant = mutate(authoredContract)
	try {
		compile(variant)
	} catch (error) {
		if (!(error instanceof StructuralFailure)) throw error
		if (error.code !== expectedCode) {
			fail(
				`${name}: compile refused it under "${error.code}" rather than "${expectedCode}", so the page would document the wrong rule`,
			)
		}
		return [path(name), renderJson(variant, 'EvalContract')]
	}
	fail(
		`${name}: compile accepted it, so the page would document a rejection that no longer happens`,
	)
}

/** The plan with one step's binding replaced, leaving every other step alone. */
const withStepBinding = (
	contract: EvalContract,
	stepId: string,
	inputBinding: JsonValue,
): EvalContract =>
	({
		...contract,
		interactionPlan: contract.interactionPlan.map((step) =>
			step.stepId === stepId ? { ...step, inputBinding } : step,
		),
	}) as EvalContract

export function buildWorkflowTutorial(): Map<string, string> {
	const compiled = compile(authoredContract)
	const brief = seal(authoredContract)
	const contractDigest = digestArtifact(compiled, 'EvalContract')
	const briefDigest = digestArtifact(brief, 'SealedEvaluatorBrief')

	const publicReference = (name: string, bytes: string) => ({
		storage: 'public' as const,
		path: path(name),
		privateRef: null,
		digest: digestBytes(new TextEncoder().encode(bytes)),
	})

	const systemReference = publicReference(
		'system-under-test.md',
		SYSTEM_UNDER_TEST,
	)
	const actionsReference = publicReference('actions.jsonl', ACTIONS)
	const baselineReference = publicReference(
		'baseline-actions.jsonl',
		BASELINE_ACTIONS,
	)

	const probe = Probe.parse({
		schemaVersion: PROBE_SCHEMA_VERSION,
		parentDigest: null,
		revisionCount: 0,
		probeId: 'P-001',
		probeClass: 'defect',
		expectedClean: false,
		// The read-back behavior. It declares exactly one oracle, which is what
		// pairs a probe with an oracle and gives the witness match a detection to
		// attach.
		behaviorId: 'B-002',
		systemId: 'thing-service',
		implementationDigest: systemReference.digest,
		artifactDigest: systemReference.digest,
		commitDigest: systemReference.digest,
		rationale:
			'A controlled mutation of the write handler: the name it was sent is dropped on the way to the store, which files the record under its own placeholder. The handler answers from the request it was given, so its response carries the name that never reached the store. Only an independent read at the identifier it returned shows the placeholder.',
		qualification: {
			route: 'controlled-mutation',
			mutationSource:
				'the write handler of the toy thing service, with the name dropped from the record it hands the store',
			mutationOperator: 'field-drop',
			targetArtifact: systemReference,
			expectedObservableFailure:
				'a read at the identifier the write returned answers 200 with the placeholder name the store fills in',
			baselinePassEvidence: baselineReference,
			mutatedFailEvidence: actionsReference,
			rollbackVerified: true,
		},
		defects: [
			{
				defectId: 'D-001',
				behaviorId: 'B-002',
				summary:
					'The write reports success and echoes the name it was sent, and a read at the identifier it returned answers with the placeholder the store filled in.',
				severity: 'critical',
				oracleEvidence: [actionsReference],
				source: 'controlled-mutation',
				// Declared rather than left null. A defect carrying no
				// manifestation witness makes `seeded-fault-fired` fail, and a
				// failed check is a failed verdict, so a chain whose page runs the
				// pre-flight stage for real has to carry one.
				//
				// The leg reads the record the setup files through the write under
				// test. A pre-flight leg is one call with fixed inputs and cannot
				// write and then read back, so a fault in the write is observable
				// here only on a record the write itself filed.
				manifestationWitness: {
					legId: MANIFESTATION_LEG_ID,
					interfaceId: 'thing-service',
					operationId: 'get-thing',
					inputs: {
						path: { id: FILED_ID },
						query: {},
						header: {},
						body: { kind: 'absent' },
					},
					relation: {
						op: 'equality',
						operands: [
							{
								pointer: `/interactions/${MANIFESTATION_LEG_ID}/response-body/thing/name`,
							},
							{ literal: SUBSTITUTED_NAME },
						],
					},
				},
			},
		],
		// Homed on the read rather than on the write. The write's own response
		// reports success, returns the identifier it filed under, and echoes the
		// name it was sent, so no condition over a single create observation
		// separates the seeded fault from correct behaviour.
		//
		// The selector binds `id` with a matcher because the identifier the read
		// carries is one the service minted during the run, and a literal would
		// name a record no run produced.
		//
		// The `response-status` conjunct separates the seeded defect from a failed
		// read: a read that answered 404 told the truth about not having the
		// record.
		defectSignature: {
			interfaceKind: 'api',
			method: 'GET',
			pathTemplate: '/things/{id}',
			observableChannel: 'response-body',
			condition: {
				selector: {
					inputBinding: {
						path: { id: { matcher: 'any' } },
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
					op: 'all',
					operands: [
						{
							op: 'equality',
							operands: [
								{ pointer: '/interactions/observed/response-status' },
								{ literal: 200 },
							],
						},
						{
							op: 'equality',
							operands: [
								{ pointer: '/interactions/observed/response-body/thing/name' },
								{ literal: SUBSTITUTED_NAME },
							],
						},
					],
				},
			},
		},
	})

	// The leg identifiers are read off the plan rather than transcribed. Two of
	// them are minted for the control-observe pair, and a minted identifier is
	// not something an author knows.
	const plan = planPreflight({
		contract: compiled,
		probes: [probe],
		runId: WORKFLOW_TUTORIAL_RUN_ID,
	})
	let observed = 0
	const observations = plan.legs.map((leg) => {
		const reply =
			leg.purpose === 'control-observe'
				? CONTROL_OBSERVE_REPLIES[observed++]
				: REPLY_FOR[leg.legId]
		if (reply === undefined) {
			fail(
				`leg "${leg.legId}" (${leg.purpose}) has no authored reply; the plan and REPLY_FOR disagree`,
			)
		}
		return apiObservation(
			leg.legId,
			leg.request.interfaceId,
			leg.request.operationId,
			reply.status,
			reply.body,
		)
	})

	const verdict = preflightFromObservations({
		contract: compiled,
		probes: [probe],
		runId: WORKFLOW_TUTORIAL_RUN_ID,
		observations,
	})
	if (!verdict.passed) {
		fail(
			`${WORKFLOW_TUTORIAL_LABEL}: the committed observations do not pass pre-flight, so the page would document a failing step: ${verdict.checks
				.filter((entry) => entry.outcome === 'failed')
				.map((entry) => `${entry.kind}: ${entry.note ?? 'no note'}`)
				.join('; ')}`,
		)
	}

	const evaluatorConfiguration = EvaluatorConfiguration.parse({
		schemaVersion: EVALUATOR_CONFIGURATION_SCHEMA_VERSION,
		parentDigest: null,
		revisionCount: 0,
		sealedBriefDigest: briefDigest,
		evaluatorIdentity: 'opaque:tutorial-evaluator',
		modelSnapshot: 'tutorial-deterministic-evaluator',
		systemPromptDigest: digestBytes(
			new TextEncoder().encode('tutorial evaluator system prompt'),
		),
		decodingParameters: { temperature: 0 },
		toolInventory: [],
		permissionInventory: [],
		budgets: { maxToolCalls: 20, maxWallClockMinutes: 10, maxCostUsd: '1.00' },
		seed: 1,
		judgeConfiguration: null,
	})
	const evaluatorConfigurationDigest = digestArtifact(
		evaluatorConfiguration,
		'EvaluatorConfiguration',
	)

	const isolationManifest = IsolationManifest.parse({
		schemaVersion: ISOLATION_MANIFEST_SCHEMA_VERSION,
		parentDigest: null,
		revisionCount: 0,
		runId: WORKFLOW_TUTORIAL_RUN_ID,
		contractId: authoredContract.contractId,
		conditionArm: 'mutated',
		modelSnapshot: evaluatorConfiguration.modelSnapshot,
		systemPromptDigest: evaluatorConfiguration.systemPromptDigest,
		contractDigest,
		evaluatorConfigurationDigest,
		workspaceIdentity: 'thing-service-workspace',
		allowedMounts: [],
		observedMounts: [],
		networkAllowlist: ['thing-service'],
		observedNetworkTargets: ['thing-service'],
		toolAllowlist: [],
		observedToolCalls: [],
		resourceCeilings: {
			maxToolCalls: 20,
			maxInputTokens: 100000,
			maxOutputTokens: 25000,
			maxWallClockMinutes: 10,
			maxCostUsd: '1.00',
		},
		actualResourceUse: {
			toolCalls: 7,
			inputTokens: 3100,
			outputTokens: 480,
			wallClockSeconds: 12.5,
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
		runId: WORKFLOW_TUTORIAL_RUN_ID,
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
				disposition: 'held',
				observationIds: ['obs-create'],
				note: 'The write reported success and answered with an identifier and no diagnostic.',
			},
			{
				oracleId: 'O-002',
				disposition: 'violated',
				observationIds: ['obs-read-back'],
				note: 'The read at the identifier the write returned answered with the placeholder the store filled in, and never with the name the call sent.',
			},
			{
				oracleId: 'O-003',
				disposition: 'held',
				observationIds: [
					'obs-malformed-create',
					'obs-malformed-read',
					'obs-malformed-reset',
				],
				note: 'Each of the three operations refused a parameter of the wrong JSON type and reported success false.',
			},
			{
				oracleId: 'O-004',
				disposition: 'held',
				observationIds: ['obs-create', 'obs-read-back'],
				note: 'The write carried the name and the read carried the identifier it captured from the write.',
			},
			{
				oracleId: 'O-005',
				disposition: 'held',
				observationIds: ['obs-read-back'],
				note: 'The read reported success and returned a record beside it, which is why the write looked correct.',
			},
			{
				oracleId: 'O-006',
				disposition: 'held',
				observationIds: ['obs-reset'],
				note: 'The reset reported success and named what it seeded.',
			},
			{
				oracleId: 'O-007',
				disposition: 'held',
				observationIds: ['obs-reset-read-back'],
				note: 'The read after the reset answered with the name the reset was given.',
			},
		],
		findings: [
			{
				findingId: 'F-001',
				findingType: 'defect',
				oracleId: 'O-002',
				probeId: 'P-001',
				behaviorId: 'B-002',
				severity: 'critical',
				confidence: 0.95,
				summary: `The write returned ${MINTED_ID} with ok true and echoed the name it was sent, and a read at ${MINTED_ID} answered 200 with the placeholder the store filled in. The name the write reported never reached the store.`,
				observationIds: ['obs-create', 'obs-read-back'],
				quotedEvidence: [
					{
						quote: `"name":"${WRITTEN_NAME}"`,
						channel: 'response-body',
						artifactId: null,
					},
					{
						quote: `"name":"${SUBSTITUTED_NAME}"`,
						channel: 'response-body',
						artifactId: null,
					},
				],
				evidenceArtifacts: [actionsReference],
			},
			{
				findingId: 'F-002',
				findingType: 'confirmation',
				oracleId: 'O-007',
				probeId: 'P-001',
				behaviorId: 'B-006',
				severity: 'material',
				confidence: 0.9,
				summary:
					'The read after the reset carried the name the reset was given, so the same read-back relation held for the other write in the run.',
				observationIds: ['obs-reset', 'obs-reset-read-back'],
				evidenceArtifacts: [],
			},
		],
		observations: [
			{
				observationId: 'obs-reset',
				sequence: 1,
				operationId: 'reset-things',
				provenance: 'evaluator-chosen',
				principal: null,
				callInputs: callInputs({ body: { seedName: SEEDED_NAME } }),
				responseBody: { ok: true, seededName: SEEDED_NAME },
				responseHeaders: JSON_HEADERS,
				responseStatus: 200,
				stdout: { kind: 'absent' },
				stderr: { kind: 'absent' },
				exitCode: null,
				artifacts: {},
			},
			{
				// The reset's own read-back, at the seeded identifier the plan names
				// by literal. It behaves, so the probe's condition refutes it and the
				// witness partition has a member on both sides. A partition holding
				// only satisfying members is equally consistent with a condition true
				// of every candidate the selector admits.
				observationId: 'obs-reset-read-back',
				sequence: 2,
				operationId: 'get-thing',
				provenance: 'evaluator-chosen',
				principal: null,
				callInputs: callInputs({ path: { id: SEEDED_ID } }),
				responseBody: { ok: true, thing: thing(SEEDED_ID, SEEDED_NAME) },
				responseHeaders: JSON_HEADERS,
				responseStatus: 200,
				stdout: { kind: 'absent' },
				stderr: { kind: 'absent' },
				exitCode: null,
				artifacts: {},
			},
			{
				observationId: 'obs-create',
				sequence: 3,
				operationId: 'create-thing',
				provenance: 'evaluator-chosen',
				principal: null,
				callInputs: callInputs({ body: { name: WRITTEN_NAME } }),
				responseBody: { ok: true, id: MINTED_ID, name: WRITTEN_NAME },
				responseHeaders: JSON_HEADERS,
				responseStatus: 201,
				stdout: { kind: 'absent' },
				stderr: { kind: 'absent' },
				exitCode: null,
				artifacts: {},
			},
			{
				// The mutated run's read. Its `id` is the value the run captured out
				// of the create response above, which is the whole point of the
				// binding: no literal in the contract could have named it.
				observationId: 'obs-read-back',
				sequence: 4,
				operationId: 'get-thing',
				provenance: 'evaluator-chosen',
				principal: null,
				callInputs: callInputs({ path: { id: MINTED_ID } }),
				responseBody: { ok: true, thing: thing(MINTED_ID, SUBSTITUTED_NAME) },
				responseHeaders: JSON_HEADERS,
				responseStatus: 200,
				stdout: { kind: 'absent' },
				stderr: { kind: 'absent' },
				exitCode: null,
				artifacts: {},
			},
			// One call per type-violating step, each carrying a value whose JSON
			// type differs from the one the operation declares for that key.
			{
				observationId: 'obs-malformed-create',
				sequence: 5,
				operationId: 'create-thing',
				provenance: 'evaluator-chosen',
				principal: null,
				callInputs: callInputs({ body: { name: 17 } }),
				responseBody: { ok: false, error: 'name must be a string' },
				responseHeaders: JSON_HEADERS,
				responseStatus: 400,
				stdout: { kind: 'absent' },
				stderr: { kind: 'absent' },
				exitCode: null,
				artifacts: {},
			},
			{
				observationId: 'obs-malformed-read',
				sequence: 6,
				operationId: 'get-thing',
				provenance: 'evaluator-chosen',
				principal: null,
				callInputs: callInputs({ path: { id: 17 } }),
				responseBody: { ok: false, error: 'id must be a string' },
				responseHeaders: JSON_HEADERS,
				responseStatus: 400,
				stdout: { kind: 'absent' },
				stderr: { kind: 'absent' },
				exitCode: null,
				artifacts: {},
			},
			{
				observationId: 'obs-malformed-reset',
				sequence: 7,
				operationId: 'reset-things',
				provenance: 'evaluator-chosen',
				principal: null,
				callInputs: callInputs({ body: { seedName: 17 } }),
				responseBody: { ok: false, error: 'seedName must be a string' },
				responseHeaders: JSON_HEADERS,
				responseStatus: 400,
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
			toolCalls: 7,
			inputTokens: 3100,
			outputTokens: 480,
			wallClockSeconds: 12.5,
			costUsd: '0.01',
		},
		evidenceDisclosure: { truncationBound: null, reportedIncomplete: false },
	})

	const probeText = renderJson(probe, 'Probe')
	const corpusDigest = digestBytes(new TextEncoder().encode(probeText))

	// The read-back step binds `id` to the identifier the create returned, and
	// `id` is declared `string`. Captured from `ok`, a declared boolean, the two
	// types disagree and the binding can never resolve.
	const brokenType = brokenVariant(
		'broken-captured-type.json',
		'unreachable-check-evidence',
		(contract) =>
			withStepBinding(contract, 'read-back', {
				body: null,
				header: null,
				path: { id: { captured: '/interactions/create/response-body/ok' } },
				query: null,
			}),
	)

	// The create step captures from the read that is already anchored after it,
	// so the capture edge and the temporal edge close a loop and neither step has
	// an earlier step to resolve from.
	const brokenCycle = brokenVariant(
		'broken-binding-cycle.json',
		'binding-cycle',
		(contract) =>
			withStepBinding(contract, 'create', {
				body: {
					name: { captured: '/interactions/read-back/response-body/error' },
				},
				header: null,
				path: null,
				query: null,
			}),
	)

	return new Map([
		[path('probes.json'), renderJson([probe], 'Probe')],
		[path('observations.json'), renderJson(observations, 'ProbeObservation')],
		[path('probe.json'), probeText],
		[path('sealed-run-record.json'), renderJson(record, 'SealedRunRecord')],
		[path('scoring-policy.json'), renderJson(POLICY, 'ScoringPolicy')],
		[path('isolation-manifest.json'), isolationManifestText],
		[
			path('evaluator-configuration.json'),
			renderJson(evaluatorConfiguration, 'EvaluatorConfiguration'),
		],
		[path('actions.jsonl'), ACTIONS],
		[path('baseline-actions.jsonl'), BASELINE_ACTIONS],
		[path('system-under-test.md'), SYSTEM_UNDER_TEST],
		[path('corpus-digest.txt'), `${corpusDigest}\n`],
		brokenType,
		brokenCycle,
	])
}
