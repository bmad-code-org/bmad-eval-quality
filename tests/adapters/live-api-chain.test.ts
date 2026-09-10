/**
 * The worked chain, run against a service the suite starts.
 *
 * The committed worked example proves everything downstream of its
 * observations: the selections, the check resolutions, the witness match, the
 * outcome states, the verdict and the strength vector are all return values of
 * the shipped functions. The observations themselves were authored. This file
 * supplies the one hop that was missing, by swapping exactly one input. The
 * same compiled contract, the same signed probe, the same defect signature,
 * with observations a socket produced.
 *
 * That is why the acceptance here is an equality against the authored chain
 * rather than a fresh set of expected values: a fresh set would prove only that
 * the fixture author could predict the fixture. If the live artifact and the
 * authored artifact agree, the authored observations were a faithful
 * description of what a real Notes API does. If they disagree, the
 * disagreement is the finding.
 *
 * What this run does NOT exercise is the evaluator. Nothing here chooses which
 * call to make: the five legs are the five calls the authored record says were
 * made, replayed in the same order, and each observation's `provenance` label
 * is carried over from the authored record beside its identifier. AD-40's
 * exercised denominator reads that label, so a label minted here would be a
 * value with nothing behind it and the equality would be testing the harness's
 * guess as well as the service's responses. The cost is stated: this record's
 * account of which observations an evaluator would have chosen is inherited.
 *
 * The mapping from a port observation to a record observation is written here
 * rather than shipped. That is the sealing step the package assigns to the
 * caller, and keeping it in a test file is what keeps the boundary visible: a
 * library function doing this work would be the package sealing a run.
 */
import { connect } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildWorkedExampleChain } from '../../scripts/worked-example-target.ts'
import type { Diagnostic } from '../../src/application/diagnostics.ts'
import { runPreflight } from '../../src/application/preflight.ts'
import { serializeArtifact } from '../../src/application/serialize.ts'
import { digestArtifact } from '../../src/core/canonical/digest.ts'
import { emit } from '../../src/core/emit/emit.ts'
import { ingest } from '../../src/core/ingest/ingest.ts'
import { EvaluatorConfiguration } from '../../src/core/schemas/evaluator-configuration.ts'
import { EvidenceArtifact } from '../../src/core/schemas/evidence-artifact.ts'
import { RuntimeFault } from '../../src/core/schemas/faults.ts'
import type { Operation } from '../../src/core/schemas/interface.ts'
import { IsolationManifest } from '../../src/core/schemas/isolation-manifest.ts'
import type {
	ApiProbeObservation,
	ApiProbeRequest,
} from '../../src/core/schemas/port-messages.ts'
import { PreflightVerdict } from '../../src/core/schemas/preflight-verdict.ts'
import type {
	JsonObject,
	JsonValue,
} from '../../src/core/schemas/primitives.ts'
import { ScoringPolicy } from '../../src/core/schemas/scoring-policy.ts'
import {
	type Observation,
	SealedRunRecord,
} from '../../src/core/schemas/sealed-run-record.ts'
import { score } from '../../src/core/score/score.ts'
import { matchProbeWitness } from '../../src/core/score/witness.ts'
import {
	buildNotesPolicy,
	buildNotesTargets,
	NOTES_INTERFACE_ID,
	type NotesBuild,
	type NotesService,
	startNotesService,
} from './notes-service.ts'
import {
	createProbeSubjectAdapter,
	type Hop,
	type HopResult,
	nodeHttpMechanism,
	subjectResolveAddress,
} from './probe-subject.ts'

const chain = buildWorkedExampleChain()
const {
	contract,
	probe,
	record: authoredRecord,
	artifact: authoredArtifact,
} = chain

const notesInterface = contract.permittedInterfaces[0]
if (
	notesInterface === undefined ||
	notesInterface.kind !== 'api' ||
	notesInterface.logicalId !== NOTES_INTERFACE_ID
) {
	throw new Error(
		'the worked contract no longer declares one api interface named by the run',
	)
}
const declaredOperations: readonly Operation[] = notesInterface.operations

const operationOf = (operationId: string): Operation => {
	const operation = declaredOperations.find(
		(candidate) => candidate.operationId === operationId,
	)
	if (operation === undefined) {
		throw new Error(`the contract declares no operation "${operationId}"`)
	}
	return operation
}

// ---------------------------------------------------------------------------
// the caller-side artifacts the chain scores under
// ---------------------------------------------------------------------------

/**
 * The published default policy, reconstructed here because the generator keeps
 * its own copy module-private. Nothing about the reconstruction is trusted: the
 * digest assertion below compares it against the digest the committed artifact
 * carries, so a drift in either copy reds this file rather than silently
 * scoring the live run under a different policy.
 */
const POLICY = ScoringPolicy.parse({
	schemaVersion: 2,
	parentDigest: null,
	revisionCount: 0,
	policyId: 'default-policy',
	severityFloor: 'material',
	confidenceThreshold: 0.7,
	catchThreshold: 0.5,
	minimumTrialCount: 3,
	reExecutionCap: 2,
	remediationCap: 3,
	regexMatchStepBudget: 1000000,
})

/**
 * Reconstructed on the same terms as the policy and pinned the same way: the
 * record declares the digest of the configuration it was run under, and
 * `ingest` recomputes it from this artifact, so a reconstruction that is off by
 * one field lands as an `evaluator-configuration-digest-mismatch` condition and
 * moves the verdict.
 */
const configuration = EvaluatorConfiguration.parse({
	schemaVersion: 1,
	parentDigest: null,
	revisionCount: 0,
	sealedBriefDigest: authoredRecord.sealedBriefDigest,
	evaluatorIdentity: 'opaque:spike-evaluator-0001',
	modelSnapshot: 'spike-evaluator-model-2026-07-29',
	systemPromptDigest: `sha256:${'2'.padStart(64, '0')}`,
	decodingParameters: { temperature: 0, topP: 1 },
	toolInventory: [],
	permissionInventory: [],
	budgets: contract.budgets,
	seed: null,
	judgeConfiguration: null,
})

/**
 * `ingest` reads four things from a manifest: the declared violation, the three
 * observed-versus-allowed arrays, the forbidden-input accounting, and the three
 * agreement fields. The rest is schema surface it never opens, so the values
 * here mirror the chain's own happy-path manifest and the assertions below rest
 * on the four it reads.
 */
const manifest = IsolationManifest.parse({
	schemaVersion: 1,
	parentDigest: null,
	revisionCount: 0,
	runId: authoredRecord.runId,
	contractId: contract.contractId,
	conditionArm: 'independent',
	modelSnapshot: 'spike-evaluator-model-2026-07-29',
	systemPromptDigest: `sha256:${'2'.padStart(64, '0')}`,
	contractDigest: authoredRecord.contractDigest,
	evaluatorConfigurationDigest: authoredRecord.evaluatorConfigurationDigest,
	workspaceIdentity: 'spike-workspace-0001',
	allowedMounts: [],
	observedMounts: [],
	networkAllowlist: [],
	observedNetworkTargets: [],
	toolAllowlist: [],
	observedToolCalls: [],
	resourceCeilings: {
		maxToolCalls: 50,
		maxInputTokens: 200000,
		maxOutputTokens: 50000,
		maxWallClockMinutes: 30,
		maxCostUsd: '5.00',
	},
	actualResourceUse: authoredRecord.resourceUse,
	forbiddenInputAccounting: Object.fromEntries(
		contract.forbiddenInputs.map((input) => [
			input,
			{ withheld: true, note: null },
		]),
	),
	violation: null,
})

/**
 * The chain's own pre-flight verdict, restated. The live pre-flight below is a
 * separate measurement and is deliberately not the verdict the score runs
 * under: it carries a different fixture digest and a different `passed`, and
 * feeding it in would move the ladder for a reason that has nothing to do with
 * the bytes this file exists to swap.
 */
const scoredUnderPreflight = PreflightVerdict.parse({
	schemaVersion: 1,
	parentDigest: null,
	revisionCount: 0,
	runId: authoredRecord.runId,
	fixtureDigest: authoredArtifact.scoringVersionInputs.fixtureDigest,
	passed: true,
	checks: [],
})

// ---------------------------------------------------------------------------
// the live run
// ---------------------------------------------------------------------------

/** Every server this file started, closed in `afterAll` whether the run passed or failed. */
const running: NotesService[] = []

const startService = async (build: NotesBuild): Promise<NotesService> => {
	const service = await startNotesService(build)
	// Registered before the caller can touch it, so a failure between the two
	// still leaves it in the set teardown walks.
	running.push(service)
	return service
}

/** Whether anything still answers on a port. The teardown reads it to check its own work. */
const refusesConnections = (port: number): Promise<boolean> =>
	new Promise((resolve) => {
		const socket = connect({ host: '127.0.0.1', port })
		const settle = (refused: boolean) => {
			socket.destroy()
			resolve(refused)
		}
		socket.setTimeout(500, () => settle(false))
		socket.on('connect', () => settle(false))
		socket.on('error', () => settle(true))
	})

// The failing path is the one that leaks, so this runs on every path and then
// checks its own work: a test that threw between `startService` and its
// assertions still leaves the server in `running`, and the connect probe below
// is what says the close actually happened rather than that it was requested.
afterAll(async () => {
	const ports = running.map((service) => service.port)
	for (const service of running.splice(0)) await service.close()
	for (const port of ports) {
		expect(await refusesConnections(port), `port ${port} still answers`).toBe(
			true,
		)
	}
})

/** A hop counter around the real mechanism, so a denial can be asserted to have opened no socket. */
const countingMechanism = (): {
	readonly mechanism: (hop: Hop) => Promise<HopResult>
	readonly hops: () => number
} => {
	let hops = 0
	return {
		mechanism: (hop) => {
			hops++
			return nodeHttpMechanism(hop)
		},
		hops: () => hops,
	}
}

const portFor = (
	service: NotesService,
	mechanism?: (hop: Hop) => Promise<HopResult>,
) =>
	createProbeSubjectAdapter({
		policy: buildNotesPolicy(service.port),
		targets: buildNotesTargets(service.port),
		resolveAddress: subjectResolveAddress,
		mechanism,
	})

const headerChannel = (declared: JsonObject | null): Record<string, string> => {
	if (declared === null) return {}
	return Object.fromEntries(
		Object.entries(declared).map(([name, value]) => {
			if (typeof value !== 'string') {
				throw new Error(`header "${name}" is not a string`)
			}
			return [name, value]
		}),
	)
}

const valueChannel = (
	declared: JsonObject | null,
): Record<string, JsonValue> => (declared === null ? {} : { ...declared })

/** The request the authored observation says was issued, rebuilt against the compiled operation. */
const requestFor = (authored: Observation): ApiProbeRequest => {
	const operation = operationOf(authored.operationId)
	return {
		probeId: authored.observationId,
		interfaceId: NOTES_INTERFACE_ID,
		operationId: authored.operationId,
		kind: 'api',
		method: operation.method,
		pathTemplate: operation.pathTemplate,
		channels: {
			path: valueChannel(authored.callInputs.path),
			query: valueChannel(authored.callInputs.query),
			header: headerChannel(authored.callInputs.header),
			body:
				authored.callInputs.body === null
					? { kind: 'absent' }
					: { kind: 'json', value: authored.callInputs.body },
		},
	}
}

const nullIfEmpty = (channel: Record<string, JsonValue>): JsonObject | null =>
	Object.keys(channel).length === 0 ? null : { ...channel }

const asJsonObject = (value: JsonValue): JsonObject => {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		throw new Error(
			'a request body channel carried something that is not an object',
		)
	}
	return value
}

/**
 * The mapping. `ApiProbeObservation` carries a status, a header map and a
 * tagged body; `Observation` wants an untagged body and the closed channel set,
 * so the tag is unwrapped and the four command-shaped fields take the empty
 * values an HTTP observation has. `observationId`, `sequence`, `provenance` and
 * `principal` are copied from the authored observation at the same position,
 * which is what leaves the observed bytes as the only thing that moved.
 *
 * Whoever writes the first adapter against a service of their own writes this
 * same mapping and supplies real provenance from a real evaluator.
 */
const observationFrom = (
	request: ApiProbeRequest,
	observed: ApiProbeObservation,
	authored: Observation,
): Observation => ({
	observationId: authored.observationId,
	sequence: authored.sequence,
	operationId: observed.operationId,
	provenance: authored.provenance,
	principal: authored.principal,
	callInputs: {
		path: nullIfEmpty(request.channels.path),
		query: nullIfEmpty(request.channels.query),
		header: nullIfEmpty(request.channels.header),
		body:
			request.channels.body.kind === 'json'
				? asJsonObject(request.channels.body.value)
				: null,
		argument: null,
		option: null,
		environment: null,
		stdin: null,
		arguments: null,
	},
	responseBody: observed.body.kind === 'absent' ? null : observed.body.value,
	responseHeaders: observed.headers,
	responseStatus: observed.status,
	stdout: { kind: 'absent' },
	stderr: { kind: 'absent' },
	exitCode: null,
	artifacts: {},
})

type ArmRun = {
	readonly observations: readonly Observation[]
	readonly hops: number
}

const runArm = async (build: NotesBuild): Promise<ArmRun> => {
	const service = await startService(build)
	const counted = countingMechanism()
	const port = portFor(service, counted.mechanism)
	const controller = new AbortController()
	const observations: Observation[] = []
	for (const authored of authoredRecord.observations) {
		const request = requestFor(authored)
		const observed = await port.probe(request, controller.signal)
		if (observed.kind !== 'api') {
			throw new Error(
				`leg "${request.probeId}" was answered with a "${observed.kind}" observation`,
			)
		}
		observations.push(observationFrom(request, observed, authored))
	}
	return { observations, hops: counted.hops() }
}

// ---------------------------------------------------------------------------
// scoring what the run observed
// ---------------------------------------------------------------------------

type ScoredRun = {
	readonly record: SealedRunRecord
	readonly scored: ReturnType<typeof score>
}

/**
 * The authored record with its observations replaced, scored through the same
 * three stages the generator calls. `resourceUse` comes over unchanged: the
 * arms are unbilled, no scoring predicate reads either field, and a harness
 * measuring a wall clock here would be the one place a live run could inject
 * variance into a record the determinism families are asserted over.
 */
const scoreObserved = (observations: readonly Observation[]): ScoredRun => {
	const record = SealedRunRecord.parse({
		...authoredRecord,
		observations: [...observations],
	})
	const validated = ingest(record, manifest, configuration)
	return {
		record,
		scored: score(
			contract,
			[validated],
			probe,
			scoredUnderPreflight,
			POLICY,
			'none',
			false,
		),
	}
}

/** The emitted artifact and its canonical bytes, for a run that reached a contract verdict. */
const emitScored = (
	run: ScoredRun,
): { readonly artifact: EvidenceArtifact; readonly bytes: string } => {
	if (run.scored.ladder.verdict === null) {
		throw new Error(
			`the run resolved the Invalid rung: ${run.scored.ladder.basis.join('; ')}`,
		)
	}
	const artifact = EvidenceArtifact.parse(
		emit(
			run.scored,
			authoredArtifact.scoringVersionInputs.corpusDigest,
			scoredUnderPreflight.fixtureDigest,
			run.record.evaluatorConfigurationDigest,
		),
	)
	return { artifact, bytes: serializeArtifact(artifact, 'EvidenceArtifact') }
}

const outcomeOf = (artifact: EvidenceArtifact, oracleId: string) => {
	const outcome = artifact.outcomes.find(
		(candidate) => candidate.oracleId === oracleId,
	)
	if (outcome === undefined) throw new Error(`no outcome for ${oracleId}`)
	return outcome
}

const readBackTitle = (arm: ArmRun): unknown => {
	const readBack = arm.observations.find(
		(observation) => observation.observationId === 'obs-004',
	)
	const body = readBack?.responseBody
	if (typeof body !== 'object' || body === null || Array.isArray(body)) {
		throw new Error('the read-back leg observed no object body')
	}
	const note = body.note
	if (typeof note !== 'object' || note === null || Array.isArray(note)) {
		throw new Error('the read-back leg observed no note')
	}
	return note.title
}

// ---------------------------------------------------------------------------
// the run itself, once
// ---------------------------------------------------------------------------

let cleanArm: ArmRun
let seededArm: ArmRun
let live: ScoredRun
let preflightWithoutProbe: PreflightVerdict
let preflightWithProbe: PreflightVerdict
let preflightLines: Diagnostic[]
let preflightHops: number

beforeAll(async () => {
	const cleanService = await startService('clean')
	const counted = countingMechanism()
	preflightLines = []
	preflightWithoutProbe = await runPreflight({
		contract,
		probes: [],
		runId: authoredRecord.runId,
		port: portFor(cleanService, counted.mechanism),
		signal: new AbortController().signal,
		sink: (line) => preflightLines.push(line),
	})
	preflightHops = counted.hops()

	const probedService = await startService('clean')
	preflightWithProbe = await runPreflight({
		contract,
		probes: [probe],
		runId: authoredRecord.runId,
		port: portFor(probedService),
		signal: new AbortController().signal,
	})

	cleanArm = await runArm('clean')
	seededArm = await runArm('silent-write')
	live = scoreObserved(seededArm.observations)
}, 30000)

/**
 * Emitted per assertion rather than once in `beforeAll`. A divergence that
 * reaches the Invalid rung throws out of `emitScored`, and thrown there it
 * would skip every test in the file instead of reddening the ones that read it.
 */
const liveOut = () => emitScored(live)

describe('pre-flight, over a service the suite started', () => {
	// Six legs: two sensitivity legs each for `get-note` and `patch-note`, and
	// the two minted control-observe legs. `list-notes` declares no required key
	// in any channel, so AD-10 exempts it and it gets no leg.
	it('answers every planned leg from a socket and none from a fake', () => {
		expect(preflightHops).toBe(6)
		expect(
			preflightLines
				.filter((line) => line.message.endsWith(': observed'))
				.map((line) => line.message),
		).toEqual([
			'leg "get-note-witness-a": observed',
			'leg "get-note-witness-b": observed',
			'leg "patch-note-witness-a": observed',
			'leg "patch-note-witness-b": observed',
			'leg "preflight-control-observe": observed',
			'leg "preflight-control-observe-2": observed',
		])
		expect(preflightLines.at(-1)?.message).toBe('reduced 6 leg(s): passed')
	})

	it('passes every check the fixture itself answers', () => {
		expect(preflightWithoutProbe.passed).toBe(true)
		expect(
			preflightWithoutProbe.checks.map((check) => [
				check.kind,
				check.operationId,
				check.outcome,
			]),
		).toEqual([
			['interface-present', 'get-note', 'satisfied'],
			['interface-present', 'patch-note', 'satisfied'],
			['input-sensitivity', 'get-note', 'satisfied'],
			['input-sensitivity', 'patch-note', 'satisfied'],
			['input-sensitivity', 'list-notes', 'exempt'],
			['state-reset', null, 'satisfied'],
			['clean-control', null, 'satisfied'],
		])
	})

	// The frozen matrix expected `passed: true` with the probe in hand. It is
	// false, and the cause is in the probe rather than in the fixture: D-001
	// declares no manifestation witness, so AD-10's fired check has nothing to
	// resolve and fails by construction. Asserted rather than worked around,
	// because a run that quietly dropped the probe would report a green
	// pre-flight over evidence it never asked for.
	it('fails one check with the probe in hand, and names the defect that caused it', () => {
		expect(preflightWithProbe.passed).toBe(false)
		const failed = preflightWithProbe.checks.filter(
			(check) => check.outcome === 'failed',
		)
		expect(failed).toEqual([
			{
				kind: 'seeded-fault-fired',
				operationId: null,
				outcome: 'failed',
				note: 'D-001: the defect declares no manifestation witness, so it cannot be observed to fire',
			},
		])
		expect(
			preflightWithProbe.checks
				.filter((check) => check.kind !== 'seeded-fault-fired')
				.map((check) => check.outcome),
		).toEqual(preflightWithoutProbe.checks.map((check) => check.outcome))
	})

	// A digest over the projections of six real responses, and the equality
	// across the two runs is what says so: they observed two different servers on
	// two different ephemeral ports and produced one digest, which is what a
	// digest describing a fixture does and a digest of a socket cannot. The
	// inequality against the authored chain's value is the second half: that one
	// is a placeholder constant this run does not restate.
	it('digests the fixture it observed, and not the socket it reached it on', () => {
		expect(preflightWithoutProbe.fixtureDigest).toMatch(/^sha256:[0-9a-f]{64}$/)
		expect(preflightWithProbe.fixtureDigest).toBe(
			preflightWithoutProbe.fixtureDigest,
		)
		expect(preflightWithoutProbe.fixtureDigest).not.toBe(
			authoredArtifact.scoringVersionInputs.fixtureDigest,
		)
	})
})

describe('the two arms, over the wire', () => {
	it('reads back the written title on the clean build', () => {
		expect(readBackTitle(cleanArm)).toBe('Revised')
		expect(cleanArm.hops).toBe(5)
	})

	// D-001 over real HTTP: the update answered 200 with `ok` true and the new
	// title, and the independent read that followed it returned the old one.
	it('reads back the pre-update title on the seeded build', () => {
		expect(readBackTitle(seededArm)).toBe('Original')
		expect(seededArm.hops).toBe(5)
		const write = seededArm.observations.find(
			(observation) => observation.observationId === 'obs-003',
		)
		expect(write?.responseStatus).toBe(200)
		expect(write?.responseBody).toEqual({
			ok: true,
			note: {
				id: 'n-1',
				title: 'Revised',
				body: 'b',
				tags: ['t'],
				updatedAt: '2026-07-29T10:05:00Z',
			},
		})
	})

	it('observes one response per authored leg, each carrying the served headers', () => {
		expect(
			seededArm.observations.map((observation) => observation.observationId),
		).toEqual(['obs-001', 'obs-002', 'obs-003', 'obs-004', 'obs-005'])
		for (const observation of seededArm.observations) {
			expect(observation.responseStatus).toBe(200)
			expect(observation.responseHeaders).toMatchObject({
				'content-type': 'application/json',
			})
			// Node stamps a `Date` header from the system clock unless it is turned
			// off. The fixture turns it off, so nothing here carries a reading.
			expect(observation.responseHeaders).not.toHaveProperty('date')
		}
	})

	// The collection response the authored record carries, reproduced over the
	// wire. AD-4 makes an empty collection terminal, and the fixture's own route
	// comment carries why it answers short.
	it('observes the short collection response the chain records', () => {
		const collection = seededArm.observations.find(
			(observation) => observation.observationId === 'obs-002',
		)
		expect(collection?.responseBody).toEqual({ ok: true, notes: [] })
	})

	// The fifth leg, which reaches the emitted artifact nowhere: its step matches
	// no observation and O-005 scores `unreached` with an empty selection, so the
	// byte equality says nothing about it. Asserted here or asserted nowhere.
	// It carries three separate things: the `n-2` seed, the unknown key the
	// service echoes back, which is the whole of F-003's claim, and the second
	// write's stamp, which is what says the service's own clock is a counter.
	it('observes the second note and the unknown key the service echoes', () => {
		const echo = seededArm.observations.find(
			(observation) => observation.observationId === 'obs-005',
		)
		expect(echo?.callInputs.body).toEqual({ colour: 'red' })
		expect(echo?.responseBody).toEqual({
			ok: true,
			note: {
				id: 'n-2',
				title: 'Second',
				body: 'b2',
				tags: [],
				updatedAt: '2026-07-29T10:06:00Z',
				colour: 'red',
			},
		})
	})
})

describe('the behaviour the five legs never reach', () => {
	// B-004 is a declared behaviour of the toy service and no leg of the authored
	// record exercises it: the contract's `malformed-write` step matches zero
	// observations, which is why O-005 scores `unreached`. Issued here through
	// the same port and outside the arms, so the fixture's refusal is evidence
	// rather than an unreached branch carrying a comment that claims coverage.
	const writeBody = async (value: JsonValue) => {
		const observed = await portFor(await startService('clean')).probe(
			{
				probeId: 'malformed-write',
				interfaceId: NOTES_INTERFACE_ID,
				operationId: 'patch-note',
				kind: 'api',
				method: 'PATCH',
				pathTemplate: '/notes/{id}',
				channels: {
					path: { id: 'n-1' },
					query: {},
					header: {},
					body: { kind: 'json', value },
				},
			},
			new AbortController().signal,
		)
		if (observed.kind !== 'api') throw new Error('answered off the wire')
		return observed
	}

	it('refuses a body whose tags violate their declared type', async () => {
		const observed = await writeBody({ tags: 'not-an-array' })
		expect(observed.status).toBe(400)
		expect(observed.body).toEqual({
			kind: 'json',
			value: { ok: false, error: 'invalid-tags' },
		})
	})

	// The body channel carries any JSON value, so a scalar, a null and an array
	// all reach the service. Each gets an answer: refusing them after the object
	// test would put the request into a handler that throws a TypeError nothing
	// awaits, and the caller would wait out its elapsed cap for a bug in the
	// fixture.
	it.each([
		['a scalar', 42 as JsonValue],
		['a null', null as JsonValue],
		['an array', ['a'] as JsonValue],
	])('refuses %s body without hanging the request', async (_label, value) => {
		const observed = await writeBody(value)
		expect(observed.status).toBe(400)
		expect(observed.body).toEqual({
			kind: 'json',
			value: { ok: false, error: 'malformed-body' },
		})
	})
})

describe('the live record, scored through the shipped stages', () => {
	it('was scored under the policy and configuration the committed chain declares', () => {
		expect(digestArtifact(POLICY, 'ScoringPolicy')).toBe(
			authoredArtifact.scoringVersionInputs.scoringPolicyDigest,
		)
		expect(digestArtifact(configuration, 'EvaluatorConfiguration')).toBe(
			authoredRecord.evaluatorConfigurationDigest,
		)
	})

	it('differs from the authored record in its observations alone', () => {
		expect({ ...live.record, observations: [] }).toEqual({
			...authoredRecord,
			observations: [],
		})
		expect(live.record.observations).not.toEqual(authoredRecord.observations)
	})

	it('resolves the authored verdict, exit code and basis', () => {
		const { artifact } = liveOut()
		if (artifact.mode !== 'contract-scoring') {
			throw new Error('the live artifact is not contract-scoring')
		}
		expect(artifact.contractVerdict).toBe('FAIL')
		expect(artifact.exitCode).toBe(2)
		expect(artifact.verdictBasis).toEqual([
			'oracle O-004 resolved abstained at or above the severity floor',
		])
	})

	it('reproduces AD-40 witness match on the observation the finding cites', () => {
		const witness = matchProbeWitness(
			probe,
			contract.permittedInterfaces,
			live.record,
		)
		expect(witness.result).toBe('matched')
		expect(witness.basis).toBe('measured')
		expect(witness.observationIds).toEqual(['obs-004'])
		expect(witness.witnessObservationIds).toEqual(['obs-004'])
		expect(witness).toEqual(chain.witness)
	})

	it('reproduces the strength vector and its non-comparable mark', () => {
		expect(liveOut().artifact.strength).toEqual(authoredArtifact.strength)
		expect(liveOut().artifact.strength.comparable).toBe(false)
		expect(liveOut().artifact.trials).toEqual({
			declaredMinimum: 3,
			completed: 1,
			invalidatedAttempts: [],
		})
	})

	// The verdict rests on O-004's abstain alone. The seeded defect lands as
	// O-001 and contributes nothing to `verdictBasis`, so the two are asserted
	// apart: a reader of a FAIL here would otherwise take it for the catch.
	it('records the seeded defect as caught, on the two observations that show it', () => {
		const caught = outcomeOf(liveOut().artifact, 'O-001')
		expect(caught.state).toBe('caught')
		expect(caught.corroboration).toBe('agrees')
		// The write and the read-back: the oracle compares the title the update
		// sent against the title the later read returned, so it needs both.
		expect(caught.selectedObservationIds).toEqual(['obs-003', 'obs-004'])
	})

	it('reproduces every outcome the authored chain records', () => {
		expect(liveOut().artifact.outcomes).toEqual(authoredArtifact.outcomes)
		expect(
			outcomeOf(liveOut().artifact, 'O-004').checkResolution?.resolution,
		).toBe('insufficient-evidence')
		expect(
			outcomeOf(liveOut().artifact, 'O-004').checkResolution
				?.introductionCondition,
		).toBe('empty-collection')
		expect(outcomeOf(liveOut().artifact, 'O-005').state).toBe('unreached')
	})

	// The whole artifact, byte for byte. Everything the emitted artifact carries
	// is derived from the observations, the authored inputs, and the four digests
	// the call site supplies, so the authored chain and the live run land on one
	// value or the difference names itself here.
	it('emits the committed evidence artifact byte for byte', () => {
		expect(liveOut().bytes).toBe(
			serializeArtifact(authoredArtifact, 'EvidenceArtifact'),
		)
	})
})

describe('the clean arm, scored the same way', () => {
	// The same five legs against the build without D-001. The read-back now
	// agrees with the write, so the finding that cited it claims a defect
	// nothing witnessed and quotes a title no observation carries. AD-21 lands
	// that on the Invalid rung and no contract verdict is reached at all, which
	// is what says the seeded build is where the verdict above came from.
	it('resolves the Invalid rung and names all three reasons', () => {
		const scored = scoreObserved(cleanArm.observations)
		expect(scored.scored.ladder.verdict).toBeNull()
		expect(scored.scored.ladder.basis).toEqual([
			'oracle O-001 resolved infrastructure-error',
			'oracle O-001: unwitnessed detection claim',
			'finding F-001: unwitnessed quotation on channel response-body',
		])
	})

	it('leaves the defect finding unwitnessed under the same defect signature', () => {
		const scored = scoreObserved(cleanArm.observations)
		const witness = matchProbeWitness(
			probe,
			contract.permittedInterfaces,
			scored.record,
		)
		expect(witness.result).toBe('unwitnessed-claim')
		expect(witness.unwitnessedFindingIds).toEqual(['F-001'])
		expect(witness.witnessObservationIds).toEqual([])
	})
})

describe('the two determinism families, over the record the run produced', () => {
	it('emits byte-identical evidence when the same record is scored twice', () => {
		expect(emitScored(scoreObserved(seededArm.observations)).bytes).toBe(
			liveOut().bytes,
		)
	})

	it('emits identical outcome states and verdict under a permuted observations array', () => {
		const permuted = [...seededArm.observations].reverse()
		expect(
			permuted.map((observation) => observation.observationId),
		).not.toEqual(
			seededArm.observations.map((observation) => observation.observationId),
		)
		const scored = emitScored(scoreObserved(permuted))
		expect(
			scored.artifact.outcomes.map((outcome) => [
				outcome.oracleId,
				outcome.state,
			]),
		).toEqual(
			liveOut().artifact.outcomes.map((outcome) => [
				outcome.oracleId,
				outcome.state,
			]),
		)
		const forward = liveOut().artifact
		if (
			scored.artifact.mode !== 'contract-scoring' ||
			forward.mode !== 'contract-scoring'
		) {
			throw new Error('a permuted score is not contract-scoring')
		}
		expect(scored.artifact.contractVerdict).toBe(forward.contractVerdict)
		// Stronger than AD-30's second family asks for and true, so it is asserted:
		// a permutation-dependent change in the strength vector, the trial counts,
		// the coverage gaps or a selected observation id would pass the family's
		// own wording and red here.
		expect(scored.bytes).toBe(liveOut().bytes)
	})
})

describe('the policy the run is authorized under', () => {
	let denialService: NotesService

	beforeAll(async () => {
		denialService = await startService('clean')
	})

	// The authorized entry names one target exactly; every other entry in the
	// same object denies. A request naming one of them is refused before a
	// socket opens, which is the half of AD-35 an allowed call cannot show.
	it('refuses an interface it does not authorize, without opening a socket', async () => {
		const counted = countingMechanism()
		const port = portFor(denialService, counted.mechanism)
		const signal = new AbortController().signal
		const denied: ApiProbeRequest = {
			probeId: 'denied',
			interfaceId: 'denied-metadata',
			operationId: 'get-note',
			kind: 'api',
			method: 'GET',
			pathTemplate: '/notes/{id}',
			channels: {
				path: { id: 'n-1' },
				query: {},
				header: {},
				body: { kind: 'absent' },
			},
		}
		await expect(port.probe(denied, signal)).rejects.toMatchObject({
			code: 'forbidden-target',
		})
		expect(counted.hops()).toBe(0)

		// The same counter and the same adapter, given a target the policy does
		// name. Without this the zero above would also be satisfied by a counter
		// that never counts, which is the shape an adapter contacting the server
		// before consulting its mapping would pass.
		const allowed: ApiProbeRequest = {
			...denied,
			probeId: 'allowed',
			interfaceId: NOTES_INTERFACE_ID,
		}
		await port.probe(allowed, signal)
		expect(counted.hops()).toBe(1)
	})

	it('carries the fault as the typed one the port declares', async () => {
		const port = portFor(denialService)
		const request: ApiProbeRequest = {
			probeId: 'unmapped',
			interfaceId: 'unmapped',
			operationId: 'get-note',
			kind: 'api',
			method: 'GET',
			pathTemplate: '/notes/{id}',
			channels: {
				path: { id: 'n-1' },
				query: {},
				header: {},
				body: { kind: 'absent' },
			},
		}
		const error = await port
			.probe(request, new AbortController().signal)
			.then(() => null)
			.catch((thrown: unknown) => thrown)
		expect(error).toBeInstanceOf(RuntimeFault)
		expect((error as RuntimeFault).code).toBe('forbidden-target')
	})
})
