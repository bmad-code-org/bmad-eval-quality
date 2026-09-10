// The committed chain that carries a captured step binding and a fixture reset
// end to end: where it lives, which six files this builder owns, and the bytes
// themselves. The generator and the drift check both reach it through
// `buildWorkedExample`, so neither can address a file the other does not.
//
// One target file per chain. `worked-example-target.ts` keeps the spike chain
// and `skill-example-target.ts` keeps the seeded-defect chain; what all three
// need lives in `worked-example-shared.ts`.
//
// What this chain is for. The workflow shape has two mechanisms, and until this
// chain neither had a committed artifact behind it. A `{ captured }` binding
// was backed by a schema, three compile checks, and unit tests, and the four-leg
// control branch a `fixtureReset` plans was backed by `tests/preflight/plan.ts`
// cases and by nothing a reader could open. This chain is the artifact: one
// `api` contract declaring both, one seeded write defect scored against the
// oracle that reads the capture's own step, and a pre-flight verdict carrying
// `state-reset` and `clean-control`, the two checks `planPreflight` emits only
// when it could plan the four control legs at all. The verdict records no leg
// list; `PreflightVerdict` carries checks and a fixture digest and nothing
// else, and the legs and their order are asserted off the plan in
// `tests/score/workflow-worked-example.test.ts`.
//
// Two things are derived here that the spike chain hand-authors. The contract is
// the published corpus contract itself, imported from the fixture the corpus
// builder reads, so the bytes an adopter downloads and the bytes this evidence
// was produced from have one digest. And the pre-flight verdict is this chain's
// own call to `preflightFromObservations`, so no verdict field below is typed
// by hand; that is what puts the four control legs in committed bytes.
//
// Run by `node` directly: Node's type stripping erases types only, so no
// TypeScript enum, namespace, parameter property, or non-type re-export may
// appear in this file or anything it imports.
import { compile } from '../src/application/compile.ts'
import { preflightFromObservations } from '../src/application/preflight.ts'
import { seal } from '../src/application/seal.ts'
import { digestArtifact } from '../src/core/canonical/digest.ts'
import { emit } from '../src/core/emit/emit.ts'
import { ingest } from '../src/core/ingest/ingest.ts'
import { planPreflight } from '../src/core/preflight/plan.ts'
import type { DefectSignature } from '../src/core/schemas/defect-signature.ts'
import { EvalContract } from '../src/core/schemas/eval-contract.ts'
import { EvaluatorConfiguration } from '../src/core/schemas/evaluator-configuration.ts'
import { EvidenceArtifact } from '../src/core/schemas/evidence-artifact.ts'
import type { AnyOperation } from '../src/core/schemas/interface.ts'
import { IsolationManifest } from '../src/core/schemas/isolation-manifest.ts'
import type { ProbeObservation } from '../src/core/schemas/port-messages.ts'
import type { PreflightVerdict } from '../src/core/schemas/preflight-verdict.ts'
import type { JsonValue } from '../src/core/schemas/primitives.ts'
import { Probe } from '../src/core/schemas/probe.ts'
import type { SealedEvaluatorBrief } from '../src/core/schemas/sealed-evaluator-brief.ts'
import { SealedRunRecord } from '../src/core/schemas/sealed-run-record.ts'
import type { ManifestationWitness } from '../src/core/schemas/sensitivity-witness.ts'
import {
	resolveHomeOperation,
	sealProbeSet,
} from '../src/core/score/qualification.ts'
import { score } from '../src/core/score/score.ts'
import {
	matchProbeWitness,
	type ProbeWitnessMatch,
	type SignedProbe,
} from '../src/core/score/witness.ts'
import {
	FILED_ID,
	SEEDED_ID,
	SEEDED_NAME,
	SUBSTITUTED_NAME,
	WRITTEN_NAME,
	workflowContract,
} from '../tests/schemas/fixtures/workflow-contract.ts'
import {
	digestPlaceholder,
	fail,
	POLICY,
	renderJson,
} from './worked-example-shared.ts'

/** Repository-relative, for the emitted keys and for violation messages. */
export const WORKFLOW_EXAMPLE_LABEL =
	'_bmad-output/worked-examples/workflow-capture'

/**
 * The six files this builder owns. The spike chain has five, because it is
 * handed an authored verdict and never calls a pre-flight stage; this chain and
 * the skill chain each call one, so the verdict is an emitted artifact like
 * every other stage result.
 */
export const WORKFLOW_EXAMPLE_FILES = [
	'eval-contract.json',
	'brief.json',
	'probe.json',
	'preflight-verdict.json',
	'sealed-run-record.json',
	'evidence-artifact.json',
] as const

const keyOf = (name: string): string => `${WORKFLOW_EXAMPLE_LABEL}/${name}`

const RUN_ID = 'workflow-capture-run-0001'

/** The identifier the write minted, and the value the capture resolves to. */
const MINTED_ID = 't-7'

/**
 * The contract, imported rather than authored. `generate-dev-corpus.ts` states
 * the precedent for a script reading contract data out of `tests/`: the
 * contracts are a fixture by AD-30's own naming, so no authoring code enters
 * `dist`. Importing the same object the corpus publishes buys a property the
 * spike chain does not have. `dev-corpus-target.ts` writes `serializeArtifact`
 * output straight to disk, so a digest over the published contract's canonical
 * bytes reproduces the `contractDigest` the sealed run record below carries,
 * and an adopter can confirm the evidence was produced from the object they are
 * holding.
 */
const AUTHORED_CONTRACT = EvalContract.parse(workflowContract)

// ---------------------------------------------------------------------------
// authored input 1: the probe, P-001
// ---------------------------------------------------------------------------

const workflowEvidence = (ordinal: number, label: string) => ({
	storage: 'private' as const,
	path: null,
	privateRef: `opaque:${label}`,
	digest: digestPlaceholder(ordinal),
})

/**
 * AD-40's signature, homed on the read rather than on the write. The write's
 * own response is indistinguishable from a correct one: it reports success,
 * returns the identifier it filed under, and echoes back the name it was sent,
 * so no condition over a single create observation separates the seeded fault
 * from correct behaviour. The defect manifests on the read the capture feeds,
 * which is the observation the evaluator's own defect finding cites.
 *
 * The selector binds `id` with a matcher rather than a literal, because the
 * identifier the read carries is one the service minted during the run. A
 * literal here would name a record no run produced and the partition would come
 * back empty.
 *
 * The `response-status` conjunct separates the seeded defect from a failed
 * read. A read that answered 404 or 500 told the truth about not having the
 * record; the defect seeded here is a clean 200 carrying a record the write
 * filed under a name nobody sent. It is also a scalar published beside the record rather
 * than a quantifier: AD-4 resolves a quantifier over an empty collection to
 * `insufficient-evidence`, so a condition made only of one can be examined and
 * decide nothing.
 */
const SEEDED_SIGNATURE: DefectSignature = {
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
}

/**
 * The manifestation witness AD-10 pre-flight reads: which operation to probe,
 * with what inputs, and the relation that is true exactly when the seeded fault
 * has fired.
 *
 * Declared rather than left null. A defect carrying no manifestation witness
 * makes `seeded-fault-fired` fail, and a failed check is a failed verdict, so a
 * chain that calls the pre-flight stage for real cannot leave it out. The spike
 * chain hides that, because it authors its verdict and never plans a leg.
 *
 * The relation is the signature's own discriminating half rooted at this leg
 * instead of at the reserved observation identifier, which is what lets
 * pre-flight ask the two different questions it asks: does the relation fire on
 * the fault leg, and does it stay quiet on every clean leg of the same
 * operation.
 *
 * The leg reads the record `testData.setup` files through the write under test,
 * rather than the one it seeds directly. A pre-flight leg is one call with fixed
 * inputs and cannot write and then read back, so a fault in the write is
 * observable here only on a record the write itself filed: its name is the one
 * thing on that leg that depends on the build. Pointed at the directly seeded
 * record the relation as written resolves false and `seeded-fault-fired` fails,
 * and a relation rewritten to be true of that record would then hold on every
 * clean read of it and `seeded-faults-scoped` would fail instead.
 */
const MANIFESTATION_LEG_ID = 'workflow-defect-leg'

const MANIFESTATION_WITNESS: ManifestationWitness = {
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
}

/**
 * The AD-9 qualification record is authored, and `qualifyProbe` is the gate over
 * it rather than its producer. What makes the gate worth anything here is that
 * it runs: `sealProbeSet` below fails the build on a rejection, with every code
 * and artifact path printed.
 */
const AUTHORED_PROBE = {
	schemaVersion: 5,
	parentDigest: null,
	revisionCount: 0,
	probeId: 'P-001',
	probeClass: 'defect',
	// The read-back behavior. It declares exactly one oracle, which is what
	// `designatedOracleIdOf` requires before a probe pairs with an oracle and
	// the witness match has a detection to attach.
	behaviorId: 'B-002',
	systemId: 'thing-service',
	implementationDigest: digestPlaceholder(27),
	artifactDigest: digestPlaceholder(28),
	commitDigest: digestPlaceholder(29),
	rationale:
		'A controlled mutation of the write handler: the name it was sent is dropped on the way to the store, which files the record under its own placeholder. The handler answers from the request it was given, so its response carries the name that never reached the store. Only an independent read at the identifier it returned shows the placeholder.',
	qualification: {
		route: 'controlled-mutation',
		mutationSource:
			'the write handler of the toy thing service written for this chain, with the name dropped from the record it hands the store',
		mutationOperator: 'field-drop',
		targetArtifact: workflowEvidence(30, 'thing-service-write-handler'),
		expectedObservableFailure:
			'a read at the identifier the write returned answers 200 with the placeholder name the store fills in',
		baselinePassEvidence: workflowEvidence(31, 'thing-service-baseline'),
		mutatedFailEvidence: workflowEvidence(32, 'thing-service-mutated'),
		rollbackVerified: true,
	},
	expectedClean: false,
	defects: [
		{
			defectId: 'D-001',
			behaviorId: 'B-002',
			summary:
				'The write reports success and echoes the name it was sent, and a read at the identifier it returned answers with the placeholder the store filled in.',
			severity: 'critical',
			oracleEvidence: [workflowEvidence(33, 'thing-service-defect')],
			source: 'controlled-mutation',
			manifestationWitness: MANIFESTATION_WITNESS,
		},
	],
	defectSignature: SEEDED_SIGNATURE,
} satisfies Probe

// ---------------------------------------------------------------------------
// authored input 2: what the harness observed on each planned pre-flight leg
// ---------------------------------------------------------------------------

const JSON_HEADERS = { 'content-type': 'application/json' }

const thing = (id: string, name: string): JsonValue => ({ id, name })

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
 * The two minted control-observe identifiers have no entry: a minted identifier
 * is not something an author knows, so they are answered by purpose below.
 *
 * The two create legs differ in the identifier the service minted and in the
 * name they echo. `/id` is declared volatile, so the projection prunes it and
 * the echoed name is what the witness relation is left to read; a service that
 * returned the same body for both names would fail `input-sensitivity` here
 * rather than in a review.
 */
const REPLY_FOR: Record<
	string,
	{ readonly status: number; readonly body: JsonValue }
> = {
	// Both write the seeded record, so each answers with that identifier and the
	// name it was given. `/id` is volatile, so the projection prunes it and the
	// echoed name is what the witness relation is left comparing.
	'create-witness-a': {
		status: 201,
		body: { ok: true, id: SEEDED_ID, name: 'gamma' },
	},
	'create-witness-b': {
		status: 201,
		body: { ok: true, id: SEEDED_ID, name: 'beta' },
	},
	// The read runs after both create legs, so it answers with what the second
	// of them left. Authoring `alpha` here would describe a store that ignored
	// the two writes above it.
	'read-witness-a': {
		status: 200,
		body: { ok: true, thing: thing(SEEDED_ID, 'beta') },
	},
	// A read of an identifier `testData.setup` leaves unfiled. The relation over
	// the two read legs is `not(deep-equality)` of their bodies, so a truthful
	// miss separates the pair as well as a second record would, and it does so
	// without asking the fixture to hold something the setup does not declare.
	// `anomalyOf` counts any status at or above 400 as an anomaly, and its one
	// caller is the `clean-control` check, which reads control legs. This is a
	// sensitivity leg, so the 404 reaches no anomaly test; the same reply on a
	// control leg would fail `clean-control` naming the status.
	'read-witness-b': {
		status: 404,
		body: { ok: false, error: 'no thing is filed under that identifier' },
	},
	'reset-witness-a': { status: 200, body: { ok: true, seededName: 'gamma' } },
	// The last sensitivity leg, and it leaves the fixture in the state
	// `testData.setup` declares, which is what the control block starts from.
	'reset-witness-b': {
		status: 200,
		body: { ok: true, seededName: SEEDED_NAME },
	},
	// The control-mutate leg, which `planPreflight` gives the first create
	// witness leg's inputs. Those name the seeded record, so this leg overwrites
	// the very record the two control-observe legs read, and the reset leg after
	// it is what puts the name back.
	'preflight-control-mutate': {
		status: 201,
		body: { ok: true, id: SEEDED_ID, name: 'gamma' },
	},
	// The reset leg, under the identifier the contract's own `fixtureReset`
	// names.
	'reset-the-store': {
		status: 200,
		body: { ok: true, seededName: SEEDED_NAME },
	},
	// The fault leg, reading the record the setup files through the write under
	// test. Its request and its answer both differ from every other read leg's,
	// so none of them is dropped from `seeded-faults-scoped`'s examined set and
	// the check has clean legs to establish scoping over.
	[MANIFESTATION_LEG_ID]: {
		status: 200,
		body: { ok: true, thing: thing(FILED_ID, SUBSTITUTED_NAME) },
	},
}

/**
 * What the two minted control-observe legs answer, in the order the planner
 * emits them: the read before the control mutation, and the read after the
 * reset. They are equal, and that is the claim `state-reset` checks rather than
 * a property of how they are written here. Two entries rather than one shared
 * reply, so a chain describing a fixture the reset failed to restore is
 * expressible and the check can be falsified; keyed by position because a
 * minted leg identifier is not something an author knows.
 */
const CONTROL_OBSERVE_REPLIES: readonly {
	readonly status: number
	readonly body: JsonValue
}[] = [
	{ status: 200, body: { ok: true, thing: thing(SEEDED_ID, SEEDED_NAME) } },
	{ status: 200, body: { ok: true, thing: thing(SEEDED_ID, SEEDED_NAME) } },
]

/**
 * One `ProbeObservation` per planned leg, built by walking the plan the shipped
 * planner produced.
 *
 * The leg identifiers are read off the plan rather than transcribed. Two of the
 * eleven are minted by `planPreflight` for the control-observe pair, and a
 * minted identifier is not something an author knows: transcribing it would put
 * this file's own guess where the planner's answer belongs, and a rename inside
 * the planner would leave two legs unanswered and the verdict failing for a
 * reason nobody could read off this file.
 */
function authoredObservations(
	probes: readonly Probe[],
): readonly ProbeObservation[] {
	const plan = planPreflight({
		contract: AUTHORED_CONTRACT,
		probes,
		runId: RUN_ID,
	})
	let observed = 0
	return plan.legs.map((leg) => {
		// Keyed by purpose first, so an unrecognised named leg aborts instead of
		// silently taking another leg's reply. A control-observe identifier is
		// minted and has no entry to look up; every other leg does, and a renamed
		// one is a mistake this build should report.
		const reply =
			leg.purpose === 'control-observe'
				? CONTROL_OBSERVE_REPLIES[observed++]
				: REPLY_FOR[leg.legId]
		if (reply === undefined) {
			fail(
				`leg "${leg.legId}" (${leg.purpose}) has no authored reply; the plan and REPLY_FOR disagree`,
			)
		}
		// The reply is spelled `api` because the contract declares one interface
		// and it is `api`. A second interface of another kind would make
		// `reducePreflight` throw `port-contract-violation` naming both kinds,
		// which says more than a guard here could.
		return apiObservation(
			leg.legId,
			leg.request.interfaceId,
			leg.request.operationId,
			reply.status,
			reply.body,
		)
	})
}

// ---------------------------------------------------------------------------
// authored input 3: the sealed run record
// ---------------------------------------------------------------------------

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

/**
 * The observations are evaluator-authored evidence and stay so: there is no
 * service in this repository to run, and `core/ingest` validates a record rather
 * than producing one. Everything downstream of them is computed.
 *
 * Four calls, in the order a run makes them. The reset and the read after it are
 * the contract's own second read-back pair and they behave, so the discriminating
 * condition resolves false over that read and it lands in the witness match's
 * refuting set. That refuting member is what shows the condition separates: a
 * partition holding only satisfying members is equally consistent with a
 * condition true of every candidate the selector admits.
 *
 * The two reads are told apart by their bindings rather than by their order.
 * `reset-read-back` binds `id` by literal and `read-back` binds it to the value
 * the run captured, so `selectWithBindings` resolves each step to one
 * observation; two reads under one matcher would resolve `several` under
 * `exactly-one` and the outcome would be an infrastructure error rather than a
 * verdict about the contract.
 */
const authoredRecord = (
	contractDigest: string,
	briefDigest: string,
	evaluatorConfigurationDigest: string,
): SealedRunRecord => ({
	schemaVersion: 5,
	parentDigest: null,
	revisionCount: 0,
	runId: RUN_ID,
	conditionArm: 'independent',
	mode: 'contract-scoring',
	trialIndex: 1,
	contractDigest,
	sealedBriefDigest: briefDigest,
	evaluatorConfigurationDigest,
	// Expected in contract-scoring mode: the probe is knowingly defective, so a
	// system-directed FAIL is an input rather than a signal about the contract,
	// and `score()` never promotes it to a verdict.
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
			// One disposition over three observations, because the oracle is one
			// check over three steps. Each of the three calls carried a parameter
			// of the wrong JSON type and each was refused.
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
			evidenceArtifacts: [workflowEvidence(34, 'thing-service-actions')],
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
			// witness partition has a member on both sides.
			// AD-40 admits only an `evaluator-chosen` observation as a candidate,
			// and this read is one: the plan declares the step and the evaluator
			// ran it. Recorded as `baseline` it would be excluded as harness
			// set-up, the partition would hold the defective read alone, and a
			// condition true of every candidate would score identically.
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
		// One call per type-violating step, each carrying a value whose JSON type
		// differs from the one the operation declares for that key. They are the
		// reason `create` binds its name by literal: under `{ matcher: 'any' }`
		// the create step would select the malformed call as well and
		// `selectWithBindings` would report `several` under `exactly-one`.
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
	actionsArtifact: workflowEvidence(34, 'thing-service-actions'),
	isolationManifestArtifact: workflowEvidence(35, 'thing-service-manifest'),
	resourceUse: {
		toolCalls: 7,
		inputTokens: 3100,
		outputTokens: 480,
		wallClockSeconds: 12.5,
		costUsd: '0.01',
	},
	evidenceDisclosure: { truncationBound: null, reportedIncomplete: false },
	invalidReason: null,
})

// ---------------------------------------------------------------------------
// authored input 4: the evaluator configuration the run was scored under
// ---------------------------------------------------------------------------

const authoredEvaluatorConfiguration = (
	briefDigest: string,
): EvaluatorConfiguration => ({
	schemaVersion: 1,
	parentDigest: null,
	revisionCount: 0,
	sealedBriefDigest: briefDigest,
	evaluatorIdentity: 'opaque:thing-service-evaluator-0001',
	modelSnapshot: 'workflow-evaluator-model-2026-09-10',
	systemPromptDigest: digestPlaceholder(36),
	decodingParameters: { temperature: 0, topP: 1 },
	toolInventory: [],
	permissionInventory: [],
	budgets: AUTHORED_CONTRACT.budgets,
	seed: null,
	judgeConfiguration: null,
})

// ---------------------------------------------------------------------------
// authored input 5: the isolation manifest the run was audited under
// ---------------------------------------------------------------------------

/**
 * `runId`, `contractDigest`, and `evaluatorConfigurationDigest` must equal the
 * record's own or AD-32's agreement rule fires, and all seven
 * `forbiddenInputAccounting` keys must carry `withheld: true` or
 * `forbidden-input-not-withheld` fires against the floor `ingest` reads.
 */
const authoredIsolationManifest = (
	contractDigest: string,
	evaluatorConfigurationDigest: string,
): IsolationManifest => ({
	schemaVersion: 1,
	parentDigest: null,
	revisionCount: 0,
	runId: RUN_ID,
	contractId: AUTHORED_CONTRACT.contractId,
	conditionArm: 'independent',
	modelSnapshot: 'workflow-evaluator-model-2026-09-10',
	systemPromptDigest: digestPlaceholder(36),
	contractDigest,
	evaluatorConfigurationDigest,
	workspaceIdentity: 'thing-service-workspace-0001',
	allowedMounts: [],
	observedMounts: [],
	networkAllowlist: [],
	observedNetworkTargets: [],
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
		'original-spec': { withheld: true, note: null },
		'source-code': { withheld: true, note: null },
		repository: { withheld: true, note: null },
		'builder-transcript': { withheld: true, note: null },
		'implementation-logs': { withheld: true, note: null },
		'comparator-results': { withheld: true, note: null },
		'human-labels': { withheld: true, note: null },
	},
	violation: null,
})

// ---------------------------------------------------------------------------
// derivation
// ---------------------------------------------------------------------------

/**
 * The chain as values rather than bytes: the five artifacts the files carry
 * plus the witness match a reader has to be able to check independently.
 * `buildWorkflowExample` renders exactly this, so a test driving the chain reads
 * the same values the committed files carry without touching the filesystem.
 */
export type WorkflowExampleChain = {
	readonly contract: EvalContract
	readonly brief: SealedEvaluatorBrief
	readonly probe: SignedProbe
	readonly preflightVerdict: PreflightVerdict
	readonly record: SealedRunRecord
	readonly artifact: EvidenceArtifact
	readonly witness: ProbeWitnessMatch
}

/**
 * The chain, derived. Deterministic: no clock, no randomness, no input outside
 * the literals above and the corpus fixture.
 */
export function buildWorkflowExampleChain(): WorkflowExampleChain {
	const contract = compile(AUTHORED_CONTRACT)
	const brief = seal(AUTHORED_CONTRACT)
	const contractDigest = digestArtifact(contract, 'EvalContract')
	const briefDigest = digestArtifact(brief, 'SealedEvaluatorBrief')
	const configuration = EvaluatorConfiguration.parse(
		authoredEvaluatorConfiguration(briefDigest),
	)
	const evaluatorConfigurationDigest = digestArtifact(
		configuration,
		'EvaluatorConfiguration',
	)
	const probe = Probe.parse(AUTHORED_PROBE)
	const record = SealedRunRecord.parse(
		authoredRecord(contractDigest, briefDigest, evaluatorConfigurationDigest),
	)
	const manifest = IsolationManifest.parse(
		authoredIsolationManifest(contractDigest, evaluatorConfigurationDigest),
	)

	// AD-9's gate, run for real. A rejection fails the build rather than
	// shipping a chain scored against a probe no sealed set would admit.
	const homeOperationOf = (candidate: Probe): AnyOperation | null =>
		candidate.expectedClean || candidate.defectSignature === null
			? null
			: resolveHomeOperation(
					candidate.defectSignature,
					contract.permittedInterfaces,
				)
	const sealedProbes = sealProbeSet([probe], homeOperationOf)
	if (sealedProbes.rejected.length > 0) {
		fail(
			`${probe.probeId} did not qualify: ${sealedProbes.rejected
				.flatMap((entry) => entry.result.failures)
				.map(
					(failure) =>
						`${failure.code} at ${failure.artifactPath}: ${failure.detail}`,
				)
				.join('; ')}`,
		)
	}
	const [admitted] = sealedProbes.admitted
	if (admitted === undefined) fail('no probe was admitted')
	if (!admitted.result.declarationChecksRan) {
		fail(
			`${probe.probeId} was admitted without the declaration-dependent checks, so its signature resolved no home operation`,
		)
	}

	// The pre-flight stage, run rather than authored. `preflightFromObservations`
	// plans the same legs `authoredObservations` walked, reduces over the
	// replies, and returns the verdict; `score` then reads `passed` and
	// `fixtureDigest` off that result rather than off a literal. What the four
	// control legs leave in the emitted bytes is `state-reset` and
	// `clean-control`, plus their share of the fixture digest.
	const preflightVerdict = preflightFromObservations({
		contract: AUTHORED_CONTRACT,
		probes: [probe],
		runId: RUN_ID,
		observations: authoredObservations([probe]),
	})
	if (!preflightVerdict.passed) {
		fail(
			`pre-flight failed: ${preflightVerdict.checks
				.filter((entry) => entry.outcome === 'failed')
				.map((entry) => `${entry.kind}: ${entry.note ?? 'no note'}`)
				.join('; ')}`,
		)
	}

	// AD-40's witness match, published on `WorkflowExampleChain` so a reader can
	// check the partition the outcome rests on.
	//
	// The `expectedClean` guard stays: a `zero-action` clean control is admitted
	// by `sealProbeSet` with `declarationChecksRan` true, and handing one to
	// `matchProbeWitness` throws an untyped `TypeError` out of `src/`. The
	// null-signature case needs no guard beside it, since `sealProbeSet` refuses
	// that under `signature-absent` above.
	if (probe.expectedClean) {
		fail('the chain scores a seeded defect, and this probe expects a clean run')
	}
	const signedProbe = probe as SignedProbe
	const witness = matchProbeWitness(
		signedProbe,
		contract.permittedInterfaces,
		record,
	)
	if (witness.result !== 'matched') {
		fail(
			`the witness match resolved "${witness.result}" rather than "matched", so no trial votes caught`,
		)
	}

	const validated = ingest(record, manifest, configuration)
	const scoredOutcomesAndVerdict = score(
		contract,
		[validated],
		probe,
		preflightVerdict,
		POLICY,
		// Neither has a declared-input source: the contract declares no waiver
		// and the run record carries no AD-26 evaluation fault field, the same
		// gap `runScore` closes identically.
		'none',
		false,
	)
	if (scoredOutcomesAndVerdict.ladder.verdict === null) {
		fail(
			`the chain resolved AD-21's Invalid rung and carries no contract verdict: ${scoredOutcomesAndVerdict.ladder.basis.join('; ')}`,
		)
	}

	// The one placeholder digest `emit` still takes directly: no artifact in
	// this chain carries a corpus digest, and the fixture digest comes off the
	// computed pre-flight verdict, mirroring `runScore`.
	const artifact = emit(
		scoredOutcomesAndVerdict,
		digestPlaceholder(37),
		preflightVerdict.fixtureDigest,
		record.evaluatorConfigurationDigest,
	)

	return {
		contract,
		brief,
		probe: signedProbe,
		preflightVerdict,
		record,
		artifact: EvidenceArtifact.parse(artifact),
		witness,
	}
}

/** The six generated files, as repository-relative path to text. */
export function buildWorkflowExample(): Map<string, string> {
	const chain = buildWorkflowExampleChain()
	const files = new Map<string, string>()
	files.set(
		keyOf('eval-contract.json'),
		renderJson(chain.contract, 'EvalContract'),
	)
	files.set(
		keyOf('brief.json'),
		renderJson(chain.brief, 'SealedEvaluatorBrief'),
	)
	files.set(keyOf('probe.json'), renderJson(chain.probe, 'Probe'))
	files.set(
		keyOf('preflight-verdict.json'),
		renderJson(chain.preflightVerdict, 'PreflightVerdict'),
	)
	files.set(
		keyOf('sealed-run-record.json'),
		renderJson(chain.record, 'SealedRunRecord'),
	)
	files.set(
		keyOf('evidence-artifact.json'),
		renderJson(chain.artifact, 'EvidenceArtifact'),
	)
	// `WORKFLOW_EXAMPLE_FILES` is the authoritative list, so it is checked rather
	// than documented. The drift check iterates this map alone, so a dropped
	// `files.set` would leave its file committed, unowned and permanently stale
	// while the check reported the rest matching byte for byte and exited 0.
	const declared = WORKFLOW_EXAMPLE_FILES.map(keyOf)
	const missing = declared.filter((path) => !files.has(path))
	const unlisted = [...files.keys()].filter((path) => !declared.includes(path))
	if (missing.length > 0 || unlisted.length > 0) {
		fail(
			`the builder's own key set disagrees with WORKFLOW_EXAMPLE_FILES: ${
				missing.length > 0
					? `declared but not emitted: ${missing.join(', ')}. `
					: ''
			}${unlisted.length > 0 ? `emitted but not declared: ${unlisted.join(', ')}.` : ''}`.trim(),
		)
	}
	return files
}
