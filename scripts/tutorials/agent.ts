// The agent chain: a release-notes agent behind a command, one seeded defect,
// and every artifact the four commands need to run over it from a clone.
//
// The lesson is the split the agent guide has always explained and never let a
// reader feel. A manifestation witness may read a file the command wrote, and a
// scoring-side defect signature may not, because an artifact identifier is
// minted per contract and a signature carrying one binds exactly the contract it
// was authored against. So the witness here reads the notes file and asks
// whether it came back empty, and the signature rides the exit code.
//
// The seeded defect is chosen so the two halves cannot be collapsed into one. A
// correct agent given a changelog it cannot parse says so on standard error and
// exits non-zero. The defective one swallows the parse failure, writes an empty
// notes file, and reports success. Both symptoms are real, and each is visible
// on a channel the other rule cannot reach.
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
import type { PermittedInterface } from '../../src/core/schemas/interface.ts'
import {
	ISOLATION_MANIFEST_SCHEMA_VERSION,
	IsolationManifest,
} from '../../src/core/schemas/isolation-manifest.ts'
import type { ProbeObservation } from '../../src/core/schemas/port-messages.ts'
import type { KeyedShapeDescriptor } from '../../src/core/schemas/primitives.ts'
import { PROBE_SCHEMA_VERSION, Probe } from '../../src/core/schemas/probe.ts'
import {
	SEALED_RUN_RECORD_SCHEMA_VERSION,
	SealedRunRecord,
} from '../../src/core/schemas/sealed-run-record.ts'
import { fail, POLICY, renderJson } from '../worked-example-shared.ts'

/** Repository-relative, for the emitted keys and for violation messages. */
export const AGENT_LABEL = 'examples/tutorials/agent'

/**
 * The run the whole chain is about. The page passes it to `preflight` as
 * `--run-id`, so the literal in the page and the literal here are one value.
 */
export const AGENT_RUN_ID = 'agent-run-1'

const path = (name: string) => `${AGENT_LABEL}/${name}`

const emptyChannel: KeyedShapeDescriptor = {
	requiredKeys: [],
	permittedKeys: [],
	types: {},
}

/** The two changelog fixtures a reader runs the agent over. */
const ALPHA_CHANGELOG = [
	'added: a second changelog fixture',
	'fixed: the summary counted blank lines',
	'changed: entries carry their own type',
	'',
].join('\n')

const BETA_CHANGELOG = ['added: one entry and nothing else', ''].join('\n')

/**
 * The third fixture is the one the defect turns on. Its second line carries no
 * recognised type, so a correct agent refuses the whole file.
 */
const BROKEN_CHANGELOG = [
	'added: a line the agent can read',
	'this line has no type in front of it',
	'',
].join('\n')

const AGENT_SOURCE = `#!/usr/bin/env node
// A deterministic release-notes agent, small enough to read in one sitting and
// small enough to break on purpose.
//
// It reads a changelog whose every line is "<type>: <description>", writes a
// notes file, and exits. It reads no network, loads no model, and takes no
// credential, because the tutorial it belongs to teaches eval-quality's
// semantics rather than a model's quality.
//
// The --defective flag stands in for the edit a twin run makes by hand. In a
// real run you change the handler, run both arms, and put the handler back. Here
// the two arms are one flag apart so the difference is one command to see.
import { readFileSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'

const argv = process.argv.slice(2)
const subcommand = argv[0]
const defective = argv.includes('--defective')

const option = (name) => {
	const at = argv.indexOf(\`--\${name}\`)
	return at === -1 ? null : (argv[at + 1] ?? null)
}

const refuse = (message) => {
	process.stderr.write(\`release-notes-agent: \${message}\\n\`)
	process.exit(64)
}

const ENTRY = /^(added|fixed|changed): (.+)$/

const write = (target, value) => {
	writeFileSync(target, \`\${JSON.stringify(value, null, 2)}\\n\`)
}

if (subcommand === 'summarize') {
	const input = option('input')
	const out = option('out')
	if (input === null || out === null) refuse('summarize needs --input and --out')

	const lines = readFileSync(input, 'utf8')
		.split('\\n')
		.filter((line) => line.trim() !== '')

	const entries = []
	let unparsed = null
	for (const [index, line] of lines.entries()) {
		const match = ENTRY.exec(line)
		if (match === null) {
			unparsed = index + 1
			break
		}
		entries.push({ type: match[1], description: match[2] })
	}

	if (unparsed !== null) {
		if (!defective) {
			process.stderr.write(
				\`release-notes-agent: cannot parse line \${unparsed} of \${basename(input)}\\n\`,
			)
			process.exit(1)
		}
		// The seeded defect. The parse failure is swallowed, an empty notes file
		// is written, and the run reports success.
		write(out, { summary: '', entries: [], source: basename(input) })
		process.exit(0)
	}

	write(out, {
		summary: \`\${entries.length} change(s)\`,
		entries,
		source: basename(input),
	})
	process.exit(0)
}

if (subcommand === 'show') {
	const notes = option('notes')
	if (notes === null) refuse('show needs --notes')
	process.stdout.write(\`\${readFileSync(notes, 'utf8').trim()}\\n\`)
	process.exit(0)
}

refuse('expected the subcommand "summarize" or "show"')
`

/**
 * Two witness legs whose answers have to differ, which is what shows the
 * operation reads the channel at all.
 */
const witnessRelation = (
	first: string,
	second: string,
	tail: string,
): Expression => ({
	op: 'not',
	operands: [
		{
			op: 'deep-equality',
			operands: [
				{ pointer: `/interactions/${first}/${tail}` },
				{ pointer: `/interactions/${second}/${tail}` },
			],
		},
	],
})

/**
 * Two operations, and the pair is what makes the guide's split visible. The
 * write nominates the file it produces, so an oracle and a witness may read
 * inside it. The read nominates standard output, which is where the
 * scoring-side evidence for the same run has to live.
 */
const agentInterface: PermittedInterface = {
	logicalId: 'release-notes-agent',
	kind: 'cli',
	operations: [
		{
			operationId: 'summarize-changes',
			invocation: {
				executable: 'release-notes-agent',
				subcommandPath: ['summarize'],
			},
			stateChangeMarker: true,
			requestShape: {
				argument: emptyChannel,
				option: {
					requiredKeys: ['input', 'out'],
					permittedKeys: [],
					types: { input: 'string', out: 'string' },
				},
				environment: emptyChannel,
				stdin: emptyChannel,
			},
			artifacts: ['notes'],
			descriptorChannel: { kind: 'artifact', artifactId: 'notes' },
			responseDescriptor: {
				requiredKeys: ['summary', 'entries'],
				permittedKeys: ['source'],
				types: { summary: 'string', entries: 'array', source: 'string' },
				successIndicator: '/summary',
				channelRoles: {
					'/summary': 'success-indicator',
					'/entries': 'collection',
					'/source': 'payload',
				},
				collectionLocations: [
					{
						pointer: '/entries',
						expectedCardinality: { mode: 'at-most', max: 50 },
						referenceSet: null,
					},
				],
			},
			volatilePointers: [],
			sensitivityWitness: {
				witnessId: 'summary-follows-the-changelog',
				channel: 'option',
				legs: [
					{
						legId: 'summarize-witness-alpha',
						inputs: {
							argument: {},
							option: { input: 'alpha.changelog', out: 'notes.json' },
							environment: {},
							stdin: { kind: 'absent' },
						},
					},
					{
						legId: 'summarize-witness-beta',
						inputs: {
							argument: {},
							option: { input: 'beta.changelog', out: 'notes.json' },
							environment: {},
							stdin: { kind: 'absent' },
						},
					},
				],
				relation: witnessRelation(
					'summarize-witness-alpha',
					'summarize-witness-beta',
					'artifact/notes/entries',
				),
			},
		},
		{
			operationId: 'show-notes',
			invocation: {
				executable: 'release-notes-agent',
				subcommandPath: ['show'],
			},
			stateChangeMarker: false,
			requestShape: {
				argument: emptyChannel,
				option: {
					requiredKeys: ['notes'],
					permittedKeys: [],
					types: { notes: 'string' },
				},
				environment: emptyChannel,
				stdin: emptyChannel,
			},
			artifacts: [],
			descriptorChannel: { kind: 'stream', channel: 'stdout' },
			responseDescriptor: {
				requiredKeys: ['summary', 'entries', 'source'],
				permittedKeys: [],
				types: { summary: 'string', entries: 'array', source: 'string' },
				successIndicator: '/summary',
				channelRoles: {
					'/summary': 'success-indicator',
					'/entries': 'collection',
					'/source': 'payload',
				},
				collectionLocations: [
					{
						pointer: '/entries',
						expectedCardinality: { mode: 'at-most', max: 50 },
						referenceSet: null,
					},
				],
			},
			volatilePointers: [],
			sensitivityWitness: {
				witnessId: 'show-follows-the-file',
				channel: 'option',
				legs: [
					{
						legId: 'show-witness-alpha',
						inputs: {
							argument: {},
							option: { notes: 'alpha-notes.json' },
							environment: {},
							stdin: { kind: 'absent' },
						},
					},
					{
						legId: 'show-witness-beta',
						inputs: {
							argument: {},
							option: { notes: 'beta-notes.json' },
							environment: {},
							stdin: { kind: 'absent' },
						},
					},
				],
				relation: witnessRelation(
					'show-witness-alpha',
					'show-witness-beta',
					'stdout/entries',
				),
			},
		},
	],
}

const contract: EvalContract = {
	schemaVersion: EVAL_CONTRACT_SCHEMA_VERSION,
	parentDigest: null,
	revisionCount: 0,
	contractId: 'tutorial-release-notes-agent',
	sourceSpecDigest: null,
	behaviors: [
		{
			id: 'B-001',
			description: 'A changelog the agent cannot parse is refused.',
			severity: 'critical',
			observableSuccessCriterion:
				'A run over a changelog carrying an unrecognised line exits non-zero.',
			requirementLinks: [{ id: 'REQ-1', scheme: 'local' }],
			riskLinks: [{ id: 'RISK-1', scheme: 'local-risk' }],
			oracles: ['O-001'],
		},
		{
			id: 'B-002',
			description: 'A summarized changelog is readable back.',
			severity: 'material',
			observableSuccessCriterion:
				'Showing the notes file written by a run returns the changelog that run was given, with one entry per line.',
			requirementLinks: [{ id: 'REQ-2', scheme: 'local' }],
			riskLinks: [],
			oracles: ['O-002', 'O-003', 'O-004', 'O-005'],
		},
	],
	oracles: [
		{
			id: 'O-001',
			polarity: 'expects-hold',
			commentary:
				'The one oracle B-001 declares, so it is the oracle a probe naming B-001 is matched against.',
			check: {
				op: 'not',
				operands: [
					{
						op: 'equality',
						operands: [
							{ pointer: '/interactions/refuse/exit-code' },
							{ literal: 0 },
						],
					},
				],
			},
			direction: {
				polarity: 'expects-hold',
				relation: 'not',
				scope: 'The run given the changelog with an unrecognised line.',
				negativeDomain: 'A run over that changelog exiting zero.',
				evidenceTargets: ['/interactions/refuse/exit-code'],
			},
		},
		{
			id: 'O-002',
			polarity: 'expects-hold',
			commentary:
				'Relates what the write was given to what an independent later read returned.',
			check: {
				op: 'equality',
				operands: [
					{ pointer: '/interactions/show/stdout/source' },
					{ pointer: '/interactions/summarize/call-inputs/option/input' },
				],
			},
			direction: {
				polarity: 'expects-hold',
				relation: 'equality',
				scope: 'One summarize followed by a show of the file it wrote.',
				negativeDomain:
					'A show reporting a changelog other than the one the summarize was given.',
				evidenceTargets: [
					'/interactions/show/stdout/source',
					'/interactions/summarize/call-inputs/option/input',
				],
			},
		},
		{
			id: 'O-003',
			polarity: 'expects-hold',
			commentary: null,
			check: {
				op: 'for-all',
				collection: { pointer: '/interactions/show/stdout/entries' },
				predicate: {
					op: 'existence',
					operands: [{ pointer: '@/description' }],
				},
			},
			direction: {
				polarity: 'expects-hold',
				relation: 'for-all',
				scope: 'Every entry the show returned.',
				negativeDomain: 'An entry carrying no description.',
				evidenceTargets: ['/interactions/show/stdout/entries'],
			},
		},
		{
			id: 'O-004',
			polarity: 'expects-hold',
			commentary:
				"Reads the read's whole declared body at one step, which is what the whole-body and success-indicator-separation rules ask for.",
			check: {
				op: 'all',
				operands: [
					{
						op: 'existence',
						operands: [{ pointer: '/interactions/show/stdout/summary' }],
					},
					{
						op: 'existence',
						operands: [{ pointer: '/interactions/show/stdout/entries' }],
					},
					{
						op: 'existence',
						operands: [{ pointer: '/interactions/show/stdout/source' }],
					},
				],
			},
			direction: {
				polarity: 'expects-hold',
				relation: 'all',
				scope: 'The whole body the show returned.',
				negativeDomain:
					'A show omitting the summary, the entries, or the source.',
				evidenceTargets: [
					'/interactions/show/stdout/summary',
					'/interactions/show/stdout/entries',
					'/interactions/show/stdout/source',
				],
			},
		},
		{
			id: 'O-005',
			polarity: 'expects-hold',
			commentary:
				'The same whole-body reading against the file the write produced, since the two operations declare their own descriptors.',
			check: {
				op: 'all',
				operands: [
					{
						op: 'existence',
						operands: [
							{ pointer: '/interactions/summarize/artifact/notes/summary' },
						],
					},
					{
						op: 'existence',
						operands: [
							{ pointer: '/interactions/summarize/artifact/notes/entries' },
						],
					},
					{
						op: 'existence',
						operands: [
							{ pointer: '/interactions/summarize/artifact/notes/source' },
						],
					},
				],
			},
			direction: {
				polarity: 'expects-hold',
				relation: 'all',
				scope: 'The whole notes file the summarize wrote.',
				negativeDomain:
					'A notes file omitting the summary, the entries, or the source.',
				evidenceTargets: [
					'/interactions/summarize/artifact/notes/summary',
					'/interactions/summarize/artifact/notes/entries',
					'/interactions/summarize/artifact/notes/source',
				],
			},
		},
	],
	rubrics: [],
	waivers: [],
	permittedInterfaces: [agentInterface],
	referenceSets: null,
	siblingGroups: null,
	interactionPlan: [
		{
			stepId: 'summarize',
			operationId: 'summarize-changes',
			inputBinding: {
				argument: null,
				option: {
					input: { literal: 'alpha.changelog' },
					out: { literal: 'notes.json' },
				},
				environment: null,
				stdin: null,
			},
			after: null,
			cardinality: 'exactly-one',
		},
		{
			stepId: 'show',
			operationId: 'show-notes',
			inputBinding: {
				argument: null,
				option: { notes: { literal: 'notes.json' } },
				environment: null,
				stdin: null,
			},
			after: 'summarize',
			cardinality: 'exactly-one',
		},
		{
			stepId: 'refuse',
			operationId: 'summarize-changes',
			inputBinding: {
				argument: null,
				option: {
					input: { literal: 'broken.changelog' },
					out: { literal: 'broken-notes.json' },
				},
				environment: null,
				stdin: null,
			},
			after: null,
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
		setup:
			'Place alpha.changelog, beta.changelog and broken.changelog in the working directory the agent runs in.',
		cleanup: 'Delete every notes file the run wrote.',
		principals: null,
		resources: null,
	},
	budgets: { maxToolCalls: 10, maxWallClockMinutes: 2, maxCostUsd: '0.10' },
	safetyLimits: [
		'No process other than the mapped release-notes-agent target.',
	],
	requiredEvidence: [
		'Exit code, both streams, and every declared artifact for each run.',
	],
	probeStepBound: 6,
	fixtureReset: null,
}

const notesFile = (
	summary: string,
	entries: readonly { type: string; description: string }[],
	source: string,
) => ({ summary, entries, source })

const ALPHA_NOTES = notesFile(
	'3 change(s)',
	[
		{ type: 'added', description: 'a second changelog fixture' },
		{ type: 'fixed', description: 'the summary counted blank lines' },
		{ type: 'changed', description: 'entries carry their own type' },
	],
	'alpha.changelog',
)

const BETA_NOTES = notesFile(
	'1 change(s)',
	[{ type: 'added', description: 'one entry and nothing else' }],
	'beta.changelog',
)

/**
 * One observation per planned leg, keyed by leg. The two legs of a witness have
 * to answer differently, and the two control legs have to answer identically,
 * which is what the repeated-read branch of a state check means.
 */
const legAnswers: Record<
	string,
	{ exitCode: number; stdout: unknown; artifacts: Record<string, unknown> }
> = {
	'summarize-witness-alpha': {
		exitCode: 0,
		stdout: null,
		artifacts: { notes: ALPHA_NOTES },
	},
	'summarize-witness-beta': {
		exitCode: 0,
		stdout: null,
		artifacts: { notes: BETA_NOTES },
	},
	'show-witness-alpha': { exitCode: 0, stdout: ALPHA_NOTES, artifacts: {} },
	'show-witness-beta': { exitCode: 0, stdout: BETA_NOTES, artifacts: {} },
	'preflight-control-observe': {
		exitCode: 0,
		stdout: ALPHA_NOTES,
		artifacts: {},
	},
	'preflight-control-observe-2': {
		exitCode: 0,
		stdout: ALPHA_NOTES,
		artifacts: {},
	},
	'manifest-empty-on-broken': {
		exitCode: 0,
		stdout: null,
		artifacts: {
			notes: notesFile('', [], 'broken.changelog'),
		},
	},
}

const observationFor = (
	legId: string,
	operationId: string,
): ProbeObservation => {
	const answer = legAnswers[legId]
	if (answer === undefined) {
		fail(`${legId}: the plan grew a leg with no answer`)
	}
	return {
		kind: 'cli',
		probeId: legId,
		interfaceId: 'release-notes-agent',
		operationId,
		exitCode: answer.exitCode,
		stdout:
			answer.stdout === null
				? { kind: 'absent' }
				: { kind: 'json', value: answer.stdout as never },
		stderr: { kind: 'absent' },
		artifacts: Object.fromEntries(
			Object.entries(answer.artifacts).map(([id, value]) => [
				id,
				{ kind: 'json', value: value as never },
			]),
		),
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
	budgets: { maxToolCalls: 10, maxWallClockMinutes: 2, maxCostUsd: '0.10' },
	seed: 1,
	judgeConfiguration: null,
})

/** AD-16's seven forbidden inputs, each withheld, spelled once. */
const withheld = { withheld: true, note: null }

export function buildAgentTutorial(): Map<string, string> {
	const compiled = compile(contract)
	const brief = seal(contract)
	const contractDigest = digestArtifact(compiled, 'EvalContract')
	const briefDigest = digestArtifact(brief, 'SealedEvaluatorBrief')
	const evaluatorConfigurationDigest = digestArtifact(
		evaluatorConfiguration,
		'EvaluatorConfiguration',
	)

	const agentReference = {
		storage: 'public' as const,
		path: path('release-notes-agent.mjs'),
		privateRef: null,
		digest: digestBytes(new TextEncoder().encode(AGENT_SOURCE)),
	}

	// One line per recorded run, which is what an actions artifact is. The
	// baseline file is the clean arm's, so the qualification record points at two
	// different runs rather than at one file twice.
	const actions = [
		'{"action":"run","step":"summarize","subcommand":"summarize","sent":{"input":"alpha.changelog","out":"notes.json"},"exitCode":0}',
		'{"action":"run","step":"show","subcommand":"show","sent":{"notes":"notes.json"},"exitCode":0}',
		'{"action":"run","step":"refuse","subcommand":"summarize","sent":{"input":"broken.changelog","out":"broken-notes.json"},"exitCode":0}',
		'',
	].join('\n')
	const baselineActions = [
		'{"action":"run","step":"summarize","subcommand":"summarize","sent":{"input":"alpha.changelog","out":"notes.json"},"exitCode":0}',
		'{"action":"run","step":"show","subcommand":"show","sent":{"notes":"notes.json"},"exitCode":0}',
		'{"action":"run","step":"refuse","subcommand":"summarize","sent":{"input":"broken.changelog","out":"broken-notes.json"},"exitCode":1}',
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

	const probe = Probe.parse({
		schemaVersion: PROBE_SCHEMA_VERSION,
		parentDigest: null,
		revisionCount: 0,
		probeId: 'P-001',
		probeClass: 'defect',
		expectedClean: false,
		behaviorId: 'B-001',
		systemId: 'release-notes-agent',
		implementationDigest: agentReference.digest,
		artifactDigest: agentReference.digest,
		commitDigest: agentReference.digest,
		rationale:
			'A controlled mutation that swallows the parse failure, writes an empty notes file, and reports success.',
		qualification: {
			route: 'controlled-mutation',
			mutationSource: 'the --defective branch of the summarize handler',
			mutationOperator: 'refusal-deletion',
			targetArtifact: agentReference,
			expectedObservableFailure:
				'a run over the unparseable changelog writes an empty notes file and exits zero',
			baselinePassEvidence: baselineReference,
			mutatedFailEvidence: actionsReference,
			rollbackVerified: true,
		},
		defects: [
			{
				defectId: 'D-001',
				behaviorId: 'B-001',
				summary:
					'The agent swallows a parse failure and reports success over an empty notes file.',
				severity: 'critical',
				oracleEvidence: [actionsReference],
				source: 'controlled-mutation',
				manifestationWitness: {
					legId: 'manifest-empty-on-broken',
					interfaceId: 'release-notes-agent',
					operationId: 'summarize-changes',
					inputs: {
						argument: {},
						option: { input: 'broken.changelog', out: 'broken-notes.json' },
						environment: {},
						stdin: { kind: 'absent' },
					},
					relation: {
						op: 'count-tolerance',
						operands: [
							{
								pointer:
									'/interactions/manifest-empty-on-broken/artifact/notes/entries',
							},
						],
						expected: 0,
						tolerance: 0,
						relative: false,
					},
				},
			},
		],
		defectSignature: {
			interfaceKind: 'cli',
			invocation: {
				executable: 'release-notes-agent',
				subcommandPath: ['summarize'],
			},
			observableChannel: 'exit-code',
			condition: {
				selector: {
					inputBinding: {
						path: null,
						query: null,
						header: null,
						body: null,
						argument: null,
						option: { input: { literal: 'broken.changelog' } },
						environment: null,
						stdin: null,
						arguments: null,
					},
				},
				predicate: {
					op: 'equality',
					operands: [
						{ pointer: '/interactions/observed/exit-code' },
						{ literal: 0 },
					],
				},
			},
		},
	})

	const plan = planPreflight({
		contract: compiled,
		probes: [probe],
		runId: AGENT_RUN_ID,
	})
	const observations = plan.legs.map((leg) =>
		observationFor(leg.legId, leg.request.operationId),
	)
	const verdict = preflightFromObservations({
		contract: compiled,
		probes: [probe],
		runId: AGENT_RUN_ID,
		observations,
	})
	if (!verdict.passed) {
		fail(
			`${AGENT_LABEL}: the committed observations do not pass pre-flight, so the page would document a failing step: ${verdict.checks
				.map((check) => `${check.kind}/${check.outcome}: ${check.note ?? ''}`)
				.join(' | ')}`,
		)
	}

	const isolationManifest = IsolationManifest.parse({
		schemaVersion: ISOLATION_MANIFEST_SCHEMA_VERSION,
		parentDigest: null,
		revisionCount: 0,
		runId: AGENT_RUN_ID,
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
		toolAllowlist: ['release-notes-agent'],
		observedToolCalls: ['release-notes-agent'],
		resourceCeilings: {
			maxToolCalls: 10,
			maxInputTokens: 100000,
			maxOutputTokens: 100000,
			maxWallClockMinutes: 2,
			maxCostUsd: '0.10',
		},
		actualResourceUse: {
			toolCalls: 3,
			inputTokens: 800,
			outputTokens: 150,
			wallClockSeconds: 2,
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

	const commandInputs = (option: Record<string, string>) => ({
		path: null,
		query: null,
		header: null,
		body: null,
		argument: null,
		option,
		environment: null,
		stdin: null,
		arguments: null,
	})

	const record = SealedRunRecord.parse({
		schemaVersion: SEALED_RUN_RECORD_SCHEMA_VERSION,
		parentDigest: null,
		revisionCount: 0,
		runId: AGENT_RUN_ID,
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
				observationIds: ['obs-003'],
				note: 'The run over the unparseable changelog exited zero.',
			},
			{
				oracleId: 'O-002',
				disposition: 'held',
				observationIds: ['obs-001', 'obs-002'],
				note: 'The show returned the changelog the summarize was given.',
			},
			{
				oracleId: 'O-003',
				disposition: 'held',
				observationIds: ['obs-002'],
				note: 'Every entry carried a description.',
			},
			{
				oracleId: 'O-004',
				disposition: 'held',
				observationIds: ['obs-002'],
				note: 'The show returned a summary, entries, and a source.',
			},
			{
				oracleId: 'O-005',
				disposition: 'held',
				observationIds: ['obs-001'],
				note: 'The notes file carried a summary, entries, and a source.',
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
					'The agent reported success over a changelog it could not parse.',
				confidence: 0.95,
				observationIds: ['obs-003'],
				evidenceArtifacts: [actionsReference],
				quotedEvidence: [
					{ quote: '0', channel: 'exit-code', artifactId: null },
				],
			},
		],
		observations: [
			{
				observationId: 'obs-001',
				sequence: 1,
				operationId: 'summarize-changes',
				provenance: 'evaluator-chosen',
				principal: null,
				callInputs: commandInputs({
					input: 'alpha.changelog',
					out: 'notes.json',
				}),
				responseBody: null,
				responseHeaders: null,
				responseStatus: null,
				stdout: { kind: 'absent' },
				stderr: { kind: 'absent' },
				exitCode: 0,
				artifacts: { notes: { kind: 'json', value: ALPHA_NOTES } },
			},
			{
				observationId: 'obs-002',
				sequence: 2,
				operationId: 'show-notes',
				provenance: 'evaluator-chosen',
				principal: null,
				callInputs: commandInputs({ notes: 'notes.json' }),
				responseBody: null,
				responseHeaders: null,
				responseStatus: null,
				stdout: { kind: 'json', value: ALPHA_NOTES },
				stderr: { kind: 'absent' },
				exitCode: 0,
				artifacts: {},
			},
			{
				observationId: 'obs-003',
				sequence: 3,
				operationId: 'summarize-changes',
				provenance: 'evaluator-chosen',
				principal: null,
				callInputs: commandInputs({
					input: 'broken.changelog',
					out: 'broken-notes.json',
				}),
				responseBody: null,
				responseHeaders: null,
				responseStatus: null,
				stdout: { kind: 'absent' },
				stderr: { kind: 'absent' },
				exitCode: 0,
				artifacts: {
					notes: {
						kind: 'json',
						value: notesFile('', [], 'broken.changelog'),
					},
				},
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
			inputTokens: 800,
			outputTokens: 150,
			wallClockSeconds: 2,
			costUsd: '0.01',
		},
		evidenceDisclosure: { truncationBound: null, reportedIncomplete: false },
	})

	const probeText = renderJson(probe, 'Probe')
	const corpusDigest = digestBytes(new TextEncoder().encode(probeText))

	const systemUnderTest = `# The system under test, and the defect seeded in it

\`release-notes-agent.mjs\` reads a changelog whose every line is \`<type>: <description>\`, writes a
notes file, and exits.

\`summarize\` parses the changelog and writes \`{ summary, entries, source }\`. A line carrying no
recognised type is a parse failure: the agent says which line on standard error and exits 1, and it
writes no notes file.

\`show\` reads a notes file back and prints it as JSON on standard output.

The seeded defect, D-001, is in \`summarize\`. It swallows the parse failure, writes a notes file whose
\`entries\` is empty, and exits 0. Two symptoms follow from one edit, and they land on different
channels. The empty file is what the manifestation witness reads. The zero exit is what the defect
signature reads, because a scoring-side signature may not address a file the command wrote.

The \`--defective\` flag selects the mutated handler. In a real twin run you edit the handler, run both
arms, and put it back, which is what the probe's \`rollbackVerified\` records. Nothing in this
repository runs the agent during a check: the observations committed beside it are the evidence a
harness is stipulated to have collected, and the chain exists so the four commands can be run over
real bytes.
`

	return new Map([
		[path('contract.json'), renderJson(contract, 'EvalContract')],
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
		[path('release-notes-agent.mjs'), AGENT_SOURCE],
		[path('alpha.changelog'), ALPHA_CHANGELOG],
		[path('beta.changelog'), BETA_CHANGELOG],
		[path('broken.changelog'), BROKEN_CHANGELOG],
		[path('actions.jsonl'), actions],
		[path('baseline-actions.jsonl'), baselineActions],
		[path('system-under-test.md'), systemUnderTest],
		[path('corpus-digest.txt'), `${corpusDigest}\n`],
	])
}
