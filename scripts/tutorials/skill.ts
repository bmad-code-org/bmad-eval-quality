// The skill chain: one deterministic selection runner, two scored runs, and the
// pair of oracles that tell an honest reply from a degenerate one.
//
// The lesson is gameability, and it is the one thing a reader cannot learn by
// reading. Asked which items apply to a case, the cheapest reply that satisfies
// an inclusion oracle is to name every item there is. It costs the agent
// nothing, it contains everything the rules mandate, and a contract carrying
// only the inclusion half rewards it. The exclusion half is what rejects it, so
// this chain scores the same runner twice and lets the reader watch O-001 hold
// in both runs while O-002 holds in one and is violated in the other.
//
// The contract is the published corpus contract itself, imported from the
// fixture the corpus builder reads, so the page compiles
// `corpus/dev/contracts/checklist-selection.json` and a reader can hash those
// published bytes and get the `contractDigest` both records below carry. This
// chain therefore emits no contract of its own.
//
// Run by `node` directly: type stripping erases types only, so no TypeScript
// enum, namespace, parameter property, or non-type re-export may appear here
// or in anything it imports.
import { compile } from '../../src/application/compile.ts'
import { preflightFromObservations } from '../../src/application/preflight.ts'
import { seal } from '../../src/application/seal.ts'
import { digestArtifact, digestBytes } from '../../src/core/canonical/digest.ts'
import { planPreflight } from '../../src/core/preflight/plan.ts'
import type { DefectSignature } from '../../src/core/schemas/defect-signature.ts'
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
import { PROBE_SCHEMA_VERSION, Probe } from '../../src/core/schemas/probe.ts'
import {
	SEALED_RUN_RECORD_SCHEMA_VERSION,
	SealedRunRecord,
} from '../../src/core/schemas/sealed-run-record.ts'
import {
	FRONTEND_PROMPT,
	SKILL_EXCLUDED_ITEMS,
	SKILL_MANDATED_ITEMS,
	skillContract,
} from '../../tests/schemas/fixtures/skill-contract.ts'
import { fail, POLICY, renderJson } from '../worked-example-shared.ts'

/** Repository-relative, for the emitted keys and for violation messages. */
export const SKILL_LABEL = 'examples/tutorials/skill'

/**
 * The two runs the lab is about. Each one is passed to `preflight` as
 * `--run-id` and each record names its own, so the literals in the page and the
 * literals here are one value.
 */
export const SKILL_HONEST_RUN_ID = 'skill-honest-1'
export const SKILL_DEGENERATE_RUN_ID = 'skill-degenerate-1'

const path = (name: string) => `${SKILL_LABEL}/${name}`

/** What the runner selects for the backend case, which is what makes the two witness legs differ. */
const BACKEND_ITEMS = ['api-rules', 'data-rules']

/**
 * Every item the runner knows about, in the order it prints them. The
 * degenerate reply is this whole list, which is why it contains both what the
 * rules mandate for a case and what they exclude.
 */
const SKILL_INDEX = [
	...SKILL_MANDATED_ITEMS,
	...BACKEND_ITEMS,
	...SKILL_EXCLUDED_ITEMS,
]

/**
 * The contract, imported rather than authored, for the reason
 * `skill-example-target.ts` states: `dev-corpus-target.ts` writes
 * `serializeArtifact` output straight to disk, so `shasum -a 256` over the
 * published contract reproduces the digest the records here carry.
 */
const AUTHORED_CONTRACT = EvalContract.parse(skillContract)

/**
 * The runner, committed so the reader produces both replies themselves before
 * any contract is involved. It reads no stdin, because the documentation gate
 * that executes this page breaks a command at the first shell operator and a
 * piped or redirected invocation would reach the runner with nothing on its
 * input. The case therefore arrives as an option, standing in for the prompt
 * the contract declares on stdin.
 */
const RUNNER = `#!/usr/bin/env node
// A deterministic stand-in for a skill an agent loads and acts on.
//
// The skill's job is selection: given a case, name the items that apply to it.
// That decision is the thing the contract holds the skill responsible for, so
// the runner prints it as JSON on stdout and nothing else.
//
// --degenerate is the cheap answer. It names every item in the index, which
// contains everything the rules mandate for any case, so an evaluation that
// only checks for the mandated items is satisfied by it.

const INDEX = ${JSON.stringify(SKILL_INDEX, null, '\t')}

const RULES = {
	frontend: ${JSON.stringify(SKILL_MANDATED_ITEMS)},
	backend: ${JSON.stringify(BACKEND_ITEMS)},
}

const optionValue = (name) => {
	const at = process.argv.indexOf(\`--\${name}\`)
	return at === -1 ? null : (process.argv[at + 1] ?? null)
}

const skill = optionValue('skill')
if (skill !== 'checklist-selection') {
	process.stderr.write('skill-runner: --skill checklist-selection is required\\n')
	process.exit(64)
}

const requested = optionValue('case')
const mandated = RULES[requested]
if (mandated === undefined) {
	process.stderr.write(
		\`skill-runner: --case must be one of \${Object.keys(RULES).join(', ')}\\n\`,
	)
	process.exit(64)
}

const selected = process.argv.includes('--degenerate') ? INDEX : mandated
process.stdout.write(\`\${JSON.stringify({ selected })}\\n\`)
`

const SYSTEM_UNDER_TEST = `# The skill under evaluation, and the strategy that games it

The skill is a selection rule set. Given a case, it names the items that apply to it.

For the frontend case the rules mandate ${SKILL_MANDATED_ITEMS.join(', ')}, and they exclude
${SKILL_EXCLUDED_ITEMS.join(' and ')}.

\`skill-runner.mjs\` applies those rules. Run it with \`--case frontend\` and it names the three
mandated items. Run it with \`--degenerate\` and it names every item in its index instead.

The degenerate reply is the point of this lab. It is not a bug in the runner and it is not a
defect an agent would be embarrassed by: it is the cheapest reply that satisfies a question
phrased as "did you include everything you had to include". A contract that asks only that is
satisfied by a run that thought about nothing.

Nothing in this repository runs an agent. The observations in the two sealed run records are the
replies this runner prints, recorded as a harness would have recorded them, so the four commands
can be run over real bytes.
`

/** One recorded call per line, which is what an actions artifact is. */
const HONEST_ACTIONS = `{"action":"call","step":"frontend-case","operation":"run-skill","sent":{"case":"frontend"},"received":{"selected":${JSON.stringify(SKILL_MANDATED_ITEMS)}},"exitCode":0}
`

/**
 * The degenerate run's record, and the evidence both halves of the gameability
 * qualification point at. One file carries both halves because both are facts
 * about the same recorded reply: it satisfied the inclusion oracle and the
 * exclusion oracle rejected it.
 */
const DEGENERATE_ACTIONS = `{"action":"call","step":"frontend-case","operation":"run-skill","sent":{"case":"frontend","degenerate":true},"received":{"selected":${JSON.stringify(SKILL_INDEX)}},"exitCode":0}
{"action":"oracle","oracleId":"O-001","relation":"containment","resolved":true,"note":"every mandated item is present, so the inclusion half is satisfied"}
{"action":"oracle","oracleId":"O-002","relation":"not(for-any)","resolved":false,"note":"an excluded item is present, so the exclusion half rejects it"}
`

const evaluatorConfiguration = EvaluatorConfiguration.parse({
	schemaVersion: EVALUATOR_CONFIGURATION_SCHEMA_VERSION,
	parentDigest: null,
	revisionCount: 0,
	sealedBriefDigest: digestArtifact(
		seal(AUTHORED_CONTRACT),
		'SealedEvaluatorBrief',
	),
	evaluatorIdentity: 'opaque:tutorial-evaluator',
	modelSnapshot: 'tutorial-deterministic-evaluator',
	systemPromptDigest: digestBytes(
		new TextEncoder().encode('tutorial evaluator system prompt'),
	),
	decodingParameters: { temperature: 0 },
	toolInventory: [],
	permissionInventory: [],
	budgets: { maxToolCalls: 20, maxWallClockMinutes: 5, maxCostUsd: '1.00' },
	seed: 1,
	judgeConfiguration: null,
})

/** AD-16's seven forbidden inputs, each withheld, spelled once. */
const withheld = { withheld: true, note: null }

/**
 * The condition that discriminates, and it is the exclusion claim written as a
 * predicate over one observation. A reply naming an excluded item while the run
 * exits clean is the whole signature: the exit code alone says nothing here,
 * and the selection alone would fire on a run that also failed.
 */
const SIGNATURE: DefectSignature = {
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
						operands: [
							{ pointer: '@/' },
							{ literal: [...SKILL_EXCLUDED_ITEMS] },
						],
					},
				},
			],
		},
	},
}

/** What the runner replies on each planned pre-flight leg. */
const SELECTION_FOR: Record<string, readonly string[]> = {
	'witness-frontend': SKILL_MANDATED_ITEMS,
	'witness-backend': BACKEND_ITEMS,
}

const observationFor = (
	legId: string,
	purpose: string,
	interfaceId: string,
	operationId: string,
): ProbeObservation => {
	// Keyed by purpose first, because a control leg's identifier is minted by
	// the planner and has no entry to look up. `planPreflight` hands a control
	// leg the first sensitivity leg's inputs, so it is the frontend case run
	// twice, which is what the state-reset check compares.
	const selected =
		purpose === 'control-observe'
			? SELECTION_FOR['witness-frontend']
			: SELECTION_FOR[legId]
	if (selected === undefined) {
		fail(`leg "${legId}" (${purpose}) has no authored reply`)
	}
	return {
		kind: 'cli',
		probeId: legId,
		interfaceId,
		operationId,
		exitCode: 0,
		stdout: { kind: 'json', value: { selected: [...selected] } },
		stderr: { kind: 'text', value: '' },
		artifacts: {},
	}
}

/** One observation, which is the reply the runner printed for the declared case. */
const recordObservation = (selected: readonly string[]) => ({
	observationId: 'obs-001',
	sequence: 1,
	operationId: 'run-skill',
	provenance: 'evaluator-chosen',
	principal: null,
	callInputs: {
		path: null,
		query: null,
		header: null,
		body: null,
		argument: null,
		option: { skill: 'checklist-selection' },
		environment: null,
		stdin: { prompt: FRONTEND_PROMPT },
		arguments: null,
	},
	responseBody: null,
	responseHeaders: null,
	responseStatus: null,
	stdout: { kind: 'json', value: { selected: [...selected] } },
	stderr: { kind: 'text', value: '' },
	exitCode: 0,
	artifacts: {},
})

export function buildSkillTutorial(): Map<string, string> {
	const compiled = compile(AUTHORED_CONTRACT)
	const brief = seal(AUTHORED_CONTRACT)
	const contractDigest = digestArtifact(compiled, 'EvalContract')
	const briefDigest = digestArtifact(brief, 'SealedEvaluatorBrief')
	const evaluatorConfigurationDigest = digestArtifact(
		evaluatorConfiguration,
		'EvaluatorConfiguration',
	)

	// Neither probe seeds a defect, so neither adds a leg and one plan serves
	// both arms. The observations are evidence about the environment rather than
	// about either scored reply, which is why one file answers both pre-flights.
	const plan = planPreflight({
		contract: compiled,
		probes: [],
		runId: SKILL_HONEST_RUN_ID,
	})
	const observations = plan.legs.map((leg) =>
		observationFor(
			leg.legId,
			leg.purpose,
			leg.request.interfaceId,
			leg.request.operationId,
		),
	)
	const verdict = preflightFromObservations({
		contract: compiled,
		probes: [],
		runId: SKILL_HONEST_RUN_ID,
		observations,
	})
	if (!verdict.passed) {
		fail(
			`${SKILL_LABEL}: the committed observations do not pass pre-flight, so the page would document a failing step`,
		)
	}

	const runnerReference = {
		storage: 'public' as const,
		path: path('skill-runner.mjs'),
		privateRef: null,
		digest: digestBytes(new TextEncoder().encode(RUNNER)),
	}
	const honestActionsReference = {
		storage: 'public' as const,
		path: path('honest-actions.jsonl'),
		privateRef: null,
		digest: digestBytes(new TextEncoder().encode(HONEST_ACTIONS)),
	}
	const degenerateActionsReference = {
		storage: 'public' as const,
		path: path('degenerate-actions.jsonl'),
		privateRef: null,
		digest: digestBytes(new TextEncoder().encode(DEGENERATE_ACTIONS)),
	}

	const honestProbe = Probe.parse({
		schemaVersion: PROBE_SCHEMA_VERSION,
		parentDigest: null,
		revisionCount: 0,
		probeId: 'P-001',
		probeClass: 'zero-action',
		expectedClean: true,
		behaviorId: 'B-002',
		systemId: 'checklist-selection-skill',
		implementationDigest: runnerReference.digest,
		artifactDigest: runnerReference.digest,
		commitDigest: runnerReference.digest,
		rationale:
			'The clean control: the runner applies the rules as written, so the reply names what the case mandates and nothing the case excludes.',
		qualification: {
			route: 'clean-control',
			baselinePassEvidence: honestActionsReference,
			revisionCommitDigest: runnerReference.digest,
			noKnownDefectStatement:
				'The runner is deterministic and its rules are the ones the contract states, so no defect is known in the selection it produces for the declared case.',
		},
		defects: [],
	})

	const degenerateProbe = Probe.parse({
		schemaVersion: PROBE_SCHEMA_VERSION,
		parentDigest: null,
		revisionCount: 0,
		probeId: 'P-002',
		probeClass: 'gameability',
		expectedClean: false,
		behaviorId: 'B-002',
		systemId: 'checklist-selection-skill',
		implementationDigest: runnerReference.digest,
		artifactDigest: runnerReference.digest,
		commitDigest: runnerReference.digest,
		rationale:
			'The degenerate strategy: name every item in the index. It satisfies the inclusion oracle because every mandated item is in the list, and the exclusion oracle is the only half that rejects it.',
		qualification: {
			route: 'gameability',
			degenerateResponse:
				'A selection naming every item in the index, so it contains every item the rules mandate for the case and every item they exclude.',
			naiveOracleSatisfiedEvidence: degenerateActionsReference,
			disciplinedOracleRejectedEvidence: degenerateActionsReference,
		},
		defects: [],
		defectSignature: SIGNATURE,
	})

	const manifestFor = (runId: string, conditionArm: string) =>
		IsolationManifest.parse({
			schemaVersion: ISOLATION_MANIFEST_SCHEMA_VERSION,
			parentDigest: null,
			revisionCount: 0,
			runId,
			contractId: AUTHORED_CONTRACT.contractId,
			conditionArm,
			modelSnapshot: evaluatorConfiguration.modelSnapshot,
			systemPromptDigest: evaluatorConfiguration.systemPromptDigest,
			contractDigest,
			evaluatorConfigurationDigest,
			workspaceIdentity: 'tutorial-workspace',
			allowedMounts: [],
			observedMounts: [],
			networkAllowlist: [],
			observedNetworkTargets: [],
			toolAllowlist: [],
			observedToolCalls: [],
			resourceCeilings: {
				maxToolCalls: 20,
				maxInputTokens: 100000,
				maxOutputTokens: 100000,
				maxWallClockMinutes: 5,
				maxCostUsd: '1.00',
			},
			actualResourceUse: {
				toolCalls: 1,
				inputTokens: 900,
				outputTokens: 60,
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

	const honestManifest = manifestFor(SKILL_HONEST_RUN_ID, 'clean')
	const honestManifestText = renderJson(honestManifest, 'IsolationManifest')
	const degenerateManifest = manifestFor(SKILL_DEGENERATE_RUN_ID, 'degenerate')
	const degenerateManifestText = renderJson(
		degenerateManifest,
		'IsolationManifest',
	)

	const honestRecord = SealedRunRecord.parse({
		schemaVersion: SEALED_RUN_RECORD_SCHEMA_VERSION,
		parentDigest: null,
		revisionCount: 0,
		runId: SKILL_HONEST_RUN_ID,
		conditionArm: 'clean',
		mode: 'contract-scoring',
		trialIndex: 1,
		contractDigest,
		sealedBriefDigest: briefDigest,
		evaluatorConfigurationDigest,
		evaluatorRecommendation: 'PASS',
		oracleDispositions: [
			{
				oracleId: 'O-001',
				disposition: 'held',
				observationIds: ['obs-001'],
				note: 'The selection named every item the rules mandate for the case.',
			},
			{
				oracleId: 'O-002',
				disposition: 'held',
				observationIds: ['obs-001'],
				note: 'The selection named no item the rules exclude for the case.',
			},
		],
		findings: [],
		observations: [recordObservation(SKILL_MANDATED_ITEMS)],
		judgeResults: [],
		actionsArtifact: honestActionsReference,
		isolationManifestArtifact: {
			storage: 'public',
			path: path('honest-isolation-manifest.json'),
			privateRef: null,
			digest: digestBytes(new TextEncoder().encode(honestManifestText)),
		},
		resourceUse: {
			toolCalls: 1,
			inputTokens: 900,
			outputTokens: 60,
			wallClockSeconds: 2,
			costUsd: '0.01',
		},
		evidenceDisclosure: { truncationBound: null, reportedIncomplete: false },
	})

	const degenerateRecord = SealedRunRecord.parse({
		schemaVersion: SEALED_RUN_RECORD_SCHEMA_VERSION,
		parentDigest: null,
		revisionCount: 0,
		runId: SKILL_DEGENERATE_RUN_ID,
		conditionArm: 'degenerate',
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
				observationIds: ['obs-001'],
				note: 'The selection named every item the rules mandate, because it named everything.',
			},
			{
				oracleId: 'O-002',
				disposition: 'violated',
				observationIds: ['obs-001'],
				note: 'The selection named items the rules exclude for the case.',
			},
		],
		findings: [
			{
				findingType: 'defect',
				findingId: 'F-001',
				oracleId: 'O-002',
				probeId: 'P-002',
				behaviorId: 'B-002',
				severity: 'material',
				summary:
					'The selection named every item in the index, so it carried both excluded items while the run exited 0.',
				confidence: 0.95,
				observationIds: ['obs-001'],
				evidenceArtifacts: [degenerateActionsReference],
				quotedEvidence: [
					{
						quote: `"${SKILL_EXCLUDED_ITEMS[0]}"`,
						channel: 'stdout',
						artifactId: null,
					},
					{ quote: '0', channel: 'exit-code', artifactId: null },
				],
			},
		],
		observations: [recordObservation(SKILL_INDEX)],
		judgeResults: [],
		actionsArtifact: degenerateActionsReference,
		isolationManifestArtifact: {
			storage: 'public',
			path: path('degenerate-isolation-manifest.json'),
			privateRef: null,
			digest: digestBytes(new TextEncoder().encode(degenerateManifestText)),
		},
		resourceUse: {
			toolCalls: 1,
			inputTokens: 900,
			outputTokens: 80,
			wallClockSeconds: 2,
			costUsd: '0.01',
		},
		evidenceDisclosure: { truncationBound: null, reportedIncomplete: false },
	})

	const honestProbeText = renderJson(honestProbe, 'Probe')
	const degenerateProbeText = renderJson(degenerateProbe, 'Probe')
	// The corpus digest attests the probe set the two runs were scored against,
	// so it is taken over both probe files rather than over either one.
	const corpusDigest = digestBytes(
		new TextEncoder().encode(`${honestProbeText}${degenerateProbeText}`),
	)

	return new Map([
		[path('skill-runner.mjs'), RUNNER],
		[path('system-under-test.md'), SYSTEM_UNDER_TEST],
		[path('probes.json'), renderJson([], 'Probe')],
		[path('observations.json'), renderJson(observations, 'ProbeObservation')],
		[path('honest-probe.json'), honestProbeText],
		[
			path('honest-run-record.json'),
			renderJson(honestRecord, 'SealedRunRecord'),
		],
		[path('honest-isolation-manifest.json'), honestManifestText],
		[path('honest-actions.jsonl'), HONEST_ACTIONS],
		[path('degenerate-probe.json'), degenerateProbeText],
		[
			path('degenerate-run-record.json'),
			renderJson(degenerateRecord, 'SealedRunRecord'),
		],
		[path('degenerate-isolation-manifest.json'), degenerateManifestText],
		[path('degenerate-actions.jsonl'), DEGENERATE_ACTIONS],
		[path('scoring-policy.json'), renderJson(POLICY, 'ScoringPolicy')],
		[
			path('evaluator-configuration.json'),
			renderJson(evaluatorConfiguration, 'EvaluatorConfiguration'),
		],
		[path('corpus-digest.txt'), `${corpusDigest}\n`],
	])
}
