// The committed chain that scores a seeded defect against a skill contract:
// where it lives, which six files this builder owns, and the bytes themselves.
// The generator and the drift check both reach it through
// `buildWorkedExample`, so neither can address a file the other does not.
//
// One target file per chain. `worked-example-target.ts` keeps the spike chain
// and learns nothing about this one; what both need lives in
// `worked-example-shared.ts`.
//
// What this chain is for. The `cli` interface kind has carried a skill's
// decision for two releases and the gameability half of that claim is
// published with numbers behind it, while the seeded-defect half had a schema,
// a gate that admits it, and a fixture that passes the gate, and no artifact
// anywhere carrying the result. This chain is the artifact: one skill-shaped
// contract, one `defect`-class probe whose signature lives on the stream the
// operation's descriptor nominates, and a strength vector whose `defect` slot
// holds a number.
//
// Two things are derived here that the spike chain hand-authors. The contract
// is the published corpus contract itself, imported from the fixture the
// corpus builder reads, so the bytes an adopter downloads and the bytes this
// evidence was produced from have one digest. And the pre-flight verdict is
// this chain's own call to `preflightFromObservations`, so no verdict field
// below is typed by hand.
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
	BACKEND_PROMPT,
	FRONTEND_PROMPT,
	SKILL_EXCLUDED_ITEMS,
	SKILL_MANDATED_ITEMS,
	skillContract,
} from '../tests/schemas/fixtures/skill-contract.ts'
import {
	digestPlaceholder,
	fail,
	POLICY,
	renderJson,
} from './worked-example-shared.ts'

/** Repository-relative, for the emitted keys and for violation messages. */
export const SKILL_EXAMPLE_LABEL = '_bmad-output/worked-examples/skill-defect'

/**
 * The six files this builder owns. Six where the spike chain has five: this
 * chain computes its pre-flight verdict rather than authoring one, so the
 * verdict is an emitted artifact like every other stage result here.
 */
export const SKILL_EXAMPLE_FILES = [
	'eval-contract.json',
	'brief.json',
	'probe.json',
	'preflight-verdict.json',
	'sealed-run-record.json',
	'evidence-artifact.json',
] as const

const keyOf = (name: string): string => `${SKILL_EXAMPLE_LABEL}/${name}`

const RUN_ID = 'skill-defect-run-0001'

/**
 * The contract, imported rather than authored. `generate-dev-corpus.ts` states
 * the precedent for a script reading contract data out of `tests/`: the
 * contracts are a fixture by AD-30's own naming, so no authoring code enters
 * `dist`. Importing the same object the corpus publishes buys a property the
 * spike chain does not have. `dev-corpus-target.ts` writes `serializeArtifact`
 * output straight to disk, so `shasum -a 256` over the published contract
 * reproduces the `contractDigest` the sealed run record below carries, and an
 * adopter can confirm the evidence was produced from the object they are
 * holding.
 */
const AUTHORED_CONTRACT = EvalContract.parse(skillContract)

// ---------------------------------------------------------------------------
// authored input 1: the probe, P-001
// ---------------------------------------------------------------------------

const skillEvidence = (ordinal: number, label: string) => ({
	storage: 'private' as const,
	path: null,
	privateRef: `opaque:${label}`,
	digest: digestPlaceholder(ordinal),
})

/**
 * AD-40's signature, homed on the one operation the contract declares.
 *
 * The invocation is spelled exactly as the operation spells it, because
 * `commandSignature` joins the executable and the subcommand path into one
 * string and `resolveHomeOperation` matches the two renderings. A subcommand
 * on one side and not the other resolves no home operation, `sealProbeSet` is
 * handed nothing, and `declarationChecksRan` comes back false.
 *
 * The defect manifests on `stdout`, which is the channel this operation's
 * descriptor nominates and which `docs/how-to/evaluate-agent-behavior.md`
 * tells an author to plan for. The written-file route was not available: a
 * pointer naming an artifact identifier is refused under
 * `condition-artifact-channel-contract-local` whatever the probe's class,
 * because the identifier is minted per contract.
 *
 * The `exit-code` conjunct separates the seeded defect from a crash. A run
 * that exits non-zero told the truth about failing; the defect seeded here is
 * a clean exit carrying a selection that names an item the rules exclude. It
 * is also a scalar published beside the list, which is what keeps the
 * condition from resolving vacuous: AD-4 resolves a quantifier over an empty
 * collection to `insufficient-evidence`, so a condition made only of a
 * quantifier can be examined and decide nothing.
 */
const SEEDED_SIGNATURE: DefectSignature = {
	interfaceKind: 'cli',
	invocation: { executable: 'skill-runner', subcommandPath: [] },
	observableChannel: 'stdout',
	condition: {
		selector: {
			inputBinding: {
				path: null,
				query: null,
				header: null,
				body: null,
				argument: null,
				option: { skill: { literal: 'checklist-selection' } },
				environment: null,
				stdin: { prompt: { matcher: 'any' } },
				arguments: null,
			},
		},
		predicate: {
			op: 'all',
			operands: [
				{
					op: 'equality',
					operands: [
						{ pointer: '/interactions/observed/exit-code' },
						{ literal: 0 },
					],
				},
				{
					op: 'for-any',
					collection: { pointer: '/interactions/observed/stdout/selected' },
					predicate: {
						op: 'set-membership',
						operands: [{ pointer: '@/' }, { literal: SKILL_EXCLUDED_ITEMS }],
					},
				},
			],
		},
	},
}

/**
 * The manifestation witness AD-10 pre-flight reads: which operation to probe,
 * with what inputs, and the relation that is true exactly when the seeded
 * fault has fired.
 *
 * Declared rather than left null. A defect carrying no manifestation witness
 * makes `seeded-fault-fired` fail, and a failed check is a failed verdict, so
 * a chain claiming to run pre-flight for real cannot leave it out.
 *
 * The relation is the signature's own discriminating half rooted at this leg
 * instead of at the reserved observation identifier, which is what lets
 * pre-flight ask the two different questions it asks: does the relation fire
 * on the fault leg, and does it stay quiet on every clean leg of the same
 * operation.
 */
const MANIFESTATION_LEG_ID = 'skill-defect-leg'

const MANIFESTATION_WITNESS: ManifestationWitness = {
	legId: MANIFESTATION_LEG_ID,
	interfaceId: 'skill-runner',
	operationId: 'run-skill',
	inputs: {
		argument: {},
		option: { skill: 'checklist-selection' },
		environment: {},
		stdin: {
			kind: 'json',
			value: { prompt: 'the mutated rules, then a frontend case' },
		},
	},
	relation: {
		op: 'for-any',
		collection: {
			pointer: `/interactions/${MANIFESTATION_LEG_ID}/stdout/selected`,
		},
		predicate: {
			op: 'set-membership',
			operands: [{ pointer: '@/' }, { literal: SKILL_EXCLUDED_ITEMS }],
		},
	},
}

/**
 * The AD-9 qualification record is authored, and `qualifyProbe` is the gate
 * over it rather than its producer. What makes the gate worth anything here is
 * that it runs: `sealProbeSet` below fails the build on a rejection, with
 * every code and artifact path printed.
 */
const AUTHORED_PROBE = {
	schemaVersion: 5,
	parentDigest: null,
	revisionCount: 0,
	probeId: 'P-001',
	probeClass: 'defect',
	// The exclusion half. B-002 declares exactly one oracle, so
	// `designatedOracleIdOf` resolves O-002 and the witness match has an oracle
	// to attach a detection to.
	behaviorId: 'B-002',
	systemId: 'checklist-selection-skill',
	implementationDigest: digestPlaceholder(16),
	artifactDigest: digestPlaceholder(17),
	commitDigest: digestPlaceholder(18),
	rationale:
		'A controlled mutation of the rules the skill states: the clause excluding an item for the frontend case is deleted, so a run exits clean and names it anyway. The inclusion oracle still holds over the reply, which is what makes the exclusion oracle the only one that can catch this.',
	qualification: {
		route: 'controlled-mutation',
		mutationSource:
			'the rules the skill states, with the exclusion clause for the frontend case removed',
		mutationOperator: 'clause-deletion',
		targetArtifact: skillEvidence(19, 'checklist-selection-rules'),
		expectedObservableFailure:
			'a selection for the frontend case exits 0 and names an item the rules exclude',
		baselinePassEvidence: skillEvidence(20, 'checklist-selection-baseline'),
		mutatedFailEvidence: skillEvidence(21, 'checklist-selection-mutated'),
		rollbackVerified: true,
	},
	expectedClean: false,
	defects: [
		{
			defectId: 'D-001',
			behaviorId: 'B-002',
			summary:
				'The selection for the frontend case names an item the rules exclude for it, and the run exits 0.',
			severity: 'material',
			oracleEvidence: [skillEvidence(22, 'checklist-selection-defect')],
			source: 'controlled-mutation',
			manifestationWitness: MANIFESTATION_WITNESS,
		},
	],
	defectSignature: SEEDED_SIGNATURE,
} satisfies Probe

// ---------------------------------------------------------------------------
// authored input 2: what the harness observed on each planned pre-flight leg
// ---------------------------------------------------------------------------

/**
 * One reply per planned leg, keyed by the leg's purpose and, for the
 * sensitivity legs, by the case each was given.
 *
 * The control legs answer with the frontend reply because that is the inputs
 * `planPreflight` gives them: it takes the first sensitivity leg's inputs for
 * an operation that has a witness. Both control legs answer identically, which
 * is what `state-reset` reads.
 */
const SELECTION_FOR = {
	'witness-frontend': SKILL_MANDATED_ITEMS,
	'witness-backend': ['api-rules', 'data-rules'],
	// The mutated rules in effect: the frontend selection with an excluded
	// item in it, which is the relation the manifestation witness fires on.
	[MANIFESTATION_LEG_ID]: [...SKILL_MANDATED_ITEMS, 'mobile-rules'],
} as const satisfies Record<string, readonly string[]>

const observationFor = (
	legId: string,
	interfaceId: string,
	operationId: string,
	selected: readonly string[],
): ProbeObservation => ({
	probeId: legId,
	interfaceId,
	operationId,
	kind: 'cli',
	exitCode: 0,
	stdout: { kind: 'json', value: { selected: [...selected] } },
	stderr: { kind: 'text', value: '' },
	artifacts: {},
})

/**
 * One `ProbeObservation` per planned leg, built by walking the plan the
 * shipped planner produced.
 *
 * The leg identifiers are read off the plan rather than transcribed. Two of
 * the five are minted by `planPreflight` for the control pair, and a minted
 * identifier is not something an author knows: transcribing it would put this
 * file's own guess where the planner's answer belongs, and a rename inside the
 * planner would leave two legs unanswered and the verdict failing for a reason
 * nobody could read off this file.
 */
function authoredObservations(
	probes: readonly Probe[],
): readonly ProbeObservation[] {
	const plan = planPreflight({
		contract: AUTHORED_CONTRACT,
		probes,
		runId: RUN_ID,
	})
	return plan.legs.map((leg) => {
		// Keyed by purpose first, so an unrecognised named leg aborts instead of
		// silently taking the frontend reply. A control-observe identifier is
		// minted and has no entry to look up; every other purpose does, and a
		// renamed sensitivity leg is a mistake this build should report.
		const selected =
			leg.purpose === 'control-observe'
				? // `planPreflight` gives a control leg the first sensitivity leg's
					// inputs, so it is the frontend case run twice, which is what
					// `state-reset` compares.
					SELECTION_FOR['witness-frontend']
				: leg.legId in SELECTION_FOR
					? SELECTION_FOR[leg.legId as keyof typeof SELECTION_FOR]
					: fail(
							`leg "${leg.legId}" (${leg.purpose}) has no authored reply; the plan and SELECTION_FOR disagree`,
						)
		if (leg.request.kind !== 'cli') {
			fail(`leg "${leg.legId}" planned a ${leg.request.kind} request`)
		}
		return observationFor(
			leg.legId,
			leg.request.interfaceId,
			leg.request.operationId,
			selected,
		)
	})
}

// ---------------------------------------------------------------------------
// authored input 3: the sealed run record
// ---------------------------------------------------------------------------

const callInputs = (prompt: string) => ({
	path: null,
	query: null,
	header: null,
	body: null,
	argument: null,
	option: { skill: 'checklist-selection' },
	environment: null,
	stdin: { prompt },
	arguments: null,
})

/**
 * The observations are evaluator-authored evidence and stay so: there is no
 * agent in this repository to run, and `core/ingest` validates a record rather
 * than producing one. Everything downstream of them is computed.
 *
 * Two runs of one operation, one per case the sensitivity witness declares.
 * The backend run behaves, so the discriminating condition resolves `false`
 * over it and it lands in the witness match's refuting set. That refuting
 * member is what shows the condition separates: a partition holding only
 * satisfying members is equally consistent with a condition true of every
 * candidate the selector admits. The frontend run is the mutated one.
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
	// Expected in contract-scoring mode: the probe is knowingly defective, so
	// a system-directed FAIL is an input rather than a signal about the
	// contract, and `score()` never promotes it to a verdict.
	evaluatorRecommendation: 'FAIL',
	oracleDispositions: [
		{
			oracleId: 'O-001',
			disposition: 'held',
			observationIds: ['obs-002'],
			note: 'The selection named every mandated item for the case.',
		},
		{
			oracleId: 'O-002',
			disposition: 'violated',
			observationIds: ['obs-002'],
			note: 'The selection named an item the rules exclude for the case.',
		},
	],
	findings: [
		{
			findingId: 'F-001',
			findingType: 'defect',
			oracleId: 'O-002',
			probeId: 'P-001',
			behaviorId: 'B-002',
			severity: 'material',
			confidence: 0.95,
			summary:
				'The frontend selection carries an excluded item and the run exits 0.',
			observationIds: ['obs-002'],
			quotedEvidence: [
				{ quote: '"mobile-rules"', channel: 'stdout', artifactId: null },
				{ quote: '0', channel: 'exit-code', artifactId: null },
			],
			evidenceArtifacts: [skillEvidence(23, 'checklist-selection-actions')],
		},
		{
			findingId: 'F-002',
			findingType: 'confirmation',
			oracleId: 'O-002',
			probeId: 'P-001',
			behaviorId: 'B-002',
			severity: 'material',
			confidence: 0.9,
			summary:
				'The backend selection carried no excluded item, so the same claim held for the other declared case.',
			observationIds: ['obs-001'],
			evidenceArtifacts: [],
		},
	],
	observations: [
		{
			// The other case the sensitivity witness declares, run by the
			// evaluator and behaving. It is a candidate the probe's selector
			// admits and the condition refutes.
			observationId: 'obs-001',
			sequence: 1,
			operationId: 'run-skill',
			provenance: 'evaluator-chosen',
			principal: null,
			callInputs: callInputs(BACKEND_PROMPT),
			responseBody: null,
			responseHeaders: null,
			responseStatus: null,
			stdout: {
				kind: 'json',
				value: { selected: ['api-rules', 'data-rules'] },
			},
			stderr: { kind: 'text', value: '' },
			exitCode: 0,
			artifacts: {},
		},
		{
			// The mutated run. The interaction plan binds this prompt by
			// literal, so this is the observation the two oracles read.
			observationId: 'obs-002',
			sequence: 2,
			operationId: 'run-skill',
			provenance: 'evaluator-chosen',
			principal: null,
			callInputs: callInputs(FRONTEND_PROMPT),
			responseBody: null,
			responseHeaders: null,
			responseStatus: null,
			stdout: {
				kind: 'json',
				value: { selected: [...SKILL_MANDATED_ITEMS, 'mobile-rules'] },
			},
			stderr: { kind: 'text', value: '' },
			exitCode: 0,
			artifacts: {},
		},
	],
	judgeResults: [],
	actionsArtifact: skillEvidence(23, 'checklist-selection-actions'),
	isolationManifestArtifact: skillEvidence(24, 'checklist-selection-manifest'),
	resourceUse: {
		toolCalls: 2,
		inputTokens: 4200,
		outputTokens: 600,
		wallClockSeconds: 18.5,
		costUsd: '0.02',
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
	evaluatorIdentity: 'opaque:checklist-selection-evaluator-0001',
	modelSnapshot: 'skill-evaluator-model-2026-09-09',
	systemPromptDigest: digestPlaceholder(25),
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
	modelSnapshot: 'skill-evaluator-model-2026-09-09',
	systemPromptDigest: digestPlaceholder(25),
	contractDigest,
	evaluatorConfigurationDigest,
	workspaceIdentity: 'checklist-selection-workspace-0001',
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
		toolCalls: 2,
		inputTokens: 4200,
		outputTokens: 600,
		wallClockSeconds: 18.5,
		costUsd: '0.02',
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
 * `buildSkillExample` renders exactly this, so a test driving the chain reads
 * the same values the committed files carry without touching the filesystem.
 */
export type SkillExampleChain = {
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
export function buildSkillExampleChain(): SkillExampleChain {
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
	// plans the same legs `authoredObservations` walked, reduces over the replies,
	// and returns the verdict; `score` then reads `passed` and `fixtureDigest`
	// off that result rather than off a literal.
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

	// AD-40's witness match, published on `SkillExampleChain` so a reader can
	// check the partition the outcome rests on. Split so each failure names its
	// own reason. The cast is what TypeScript still needs after them: narrowing
	// `probe.defectSignature` refines the property for reads and leaves the
	// object's own declared type alone.
	if (probe.expectedClean) fail(`${probe.probeId} is a clean control`)
	if (probe.defectSignature === null) {
		fail(`${probe.probeId} carries no defect signature to match against`)
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
		digestPlaceholder(26),
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
export function buildSkillExample(): Map<string, string> {
	const chain = buildSkillExampleChain()
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
	// `SKILL_EXAMPLE_FILES` is the authoritative list, so it is checked rather
	// than documented. The drift check iterates this map alone, so a dropped
	// `files.set` would leave its file committed, unowned and permanently
	// stale while the check reported the rest matching byte for byte and
	// exited 0.
	const declared = SKILL_EXAMPLE_FILES.map(keyOf)
	const missing = declared.filter((path) => !files.has(path))
	const unlisted = [...files.keys()].filter((path) => !declared.includes(path))
	if (missing.length > 0 || unlisted.length > 0) {
		fail(
			`the builder's own key set disagrees with SKILL_EXAMPLE_FILES: ${
				missing.length > 0
					? `declared but not emitted: ${missing.join(', ')}. `
					: ''
			}${unlisted.length > 0 ? `emitted but not declared: ${unlisted.join(', ')}.` : ''}`.trim(),
		)
	}
	return files
}
