// A contract whose system under test is a unit of instruction an agent loads
// and acts on. Nobody invokes that unit directly: a command runs the agent,
// the agent is handed the rules, and the contract holds the rules responsible
// for what came back. That shape is the `cli` interface kind, so this is a
// third command contract beside the two in `command-contract.ts`, and what
// differs is the question it asks rather than the mechanism it asks through.
//
// It wraps the interface `docs/how-to/evaluate-skill-behavior.md` publishes as
// compiling at exit 0, so the bytes a reader meets on that page and the bytes
// the corpus ships describe one operation.
//
// Two behaviors, each with exactly one oracle, because that is what
// `designatedOracleIdOf` requires before a probe can be paired with the oracle
// discharging the behavior it breaks. The inclusion half says the reply names
// everything the rules mandate; the exclusion half says it names nothing the
// rules exclude. Either alone is trivially satisfiable, and the exclusion half
// is the one a seeded defect can be scored against.

import type { EvalContract } from '../../../src/core/schemas/eval-contract.ts'

const emptyChannel = {
	requiredKeys: [] as string[],
	permittedKeys: [] as string[],
	types: {} as Record<string, null>,
}

/** The decision pointer both oracles address, and the one the probe's condition mirrors. */
const SKILL_SELECTION_POINTER = '/interactions/frontend-case/stdout/selected'

/** What the rules mandate for the declared case. */
export const SKILL_MANDATED_ITEMS = [
	'interaction-rules',
	'timing-rules',
	'quality-rules',
]

/** What the rules exclude for the same case, and what a seeded defect makes appear. */
export const SKILL_EXCLUDED_ITEMS = ['mobile-rules', 'contract-rules']

/**
 * The two prompts the sensitivity witness sends, exported because the chain
 * scored against this contract sends the same two and the interaction plan
 * binds the first one by literal.
 *
 * Carried as a declared `prompt` key rather than as raw text. The guide's own
 * fence spells the witness legs' stdin as text, which parses and compiles the
 * same; the keyed form is what `callInputsOf` records as a call input, so a
 * selector binding `stdin.prompt` has something to match and the whole chain
 * reads one way.
 */
export const FRONTEND_PROMPT = 'the rules, then a frontend case'
export const BACKEND_PROMPT = 'the same rules, then a backend case'

export const skillContract = {
	schemaVersion: 5,
	contractId: 'checklist-selection',
	parentDigest: null,
	revisionCount: 0,
	sourceSpecDigest: null,
	behaviors: [
		{
			id: 'B-001',
			description:
				'A selection for a case names every item the rules mandate for it.',
			severity: 'material',
			observableSuccessCriterion:
				'The selection contains each mandated item for the case it was given.',
			requirementLinks: [{ scheme: 'local', id: 'REQ-1' }],
			riskLinks: [{ scheme: 'local-risk', id: 'RISK-1' }],
			oracles: ['O-001'],
		},
		{
			id: 'B-002',
			description:
				'A selection for a case names no item the rules exclude for it.',
			severity: 'material',
			observableSuccessCriterion:
				'No item the rules exclude for the case appears in the selection.',
			requirementLinks: [{ scheme: 'local', id: 'REQ-2' }],
			riskLinks: [{ scheme: 'local-risk', id: 'RISK-2' }],
			oracles: ['O-002'],
		},
	],
	oracles: [
		{
			id: 'O-001',
			direction: {
				evidenceTargets: [SKILL_SELECTION_POINTER],
				relation: 'containment',
				polarity: 'expects-hold',
				scope: 'One selection call for the frontend case.',
				negativeDomain: 'A selection missing a mandated item.',
			},
			check: {
				op: 'containment',
				operands: [
					{ pointer: SKILL_SELECTION_POINTER },
					{ literal: SKILL_MANDATED_ITEMS },
				],
			},
			polarity: 'expects-hold',
			commentary:
				'A reply naming every item in the index satisfies this on its own, which is why the exclusion oracle below is the half that discriminates.',
		},
		{
			id: 'O-002',
			direction: {
				evidenceTargets: [SKILL_SELECTION_POINTER],
				relation: 'not',
				polarity: 'expects-hold',
				scope:
					'Every item returned for the frontend case, searched for any the rules exclude.',
				negativeDomain:
					'A selection carrying an item the rules exclude for the case.',
			},
			check: {
				op: 'not',
				operands: [
					{
						op: 'for-any',
						collection: { pointer: SKILL_SELECTION_POINTER },
						predicate: {
							op: 'set-membership',
							operands: [{ pointer: '@/' }, { literal: SKILL_EXCLUDED_ITEMS }],
						},
					},
				],
			},
			polarity: 'expects-hold',
			commentary:
				'The items the rules exclude for the case. This is the claim a seeded defect breaks, and the designated oracle of the probe that seeds it.',
		},
	],
	rubrics: [],
	waivers: [],
	permittedInterfaces: [
		{
			logicalId: 'skill-runner',
			kind: 'cli',
			operations: [
				{
					operationId: 'run-skill',
					invocation: {
						// Empty on purpose, and it has to stay empty: the probe's
						// defect signature spells this same invocation, and
						// `commandSignature` joins the executable and the
						// subcommand path into the one string
						// `resolveHomeOperation` matches on. A subcommand on one
						// side and not the other resolves no home operation, and
						// the declaration-dependent qualification checks are
						// skipped rather than run.
						executable: 'skill-runner',
						subcommandPath: [],
					},
					stateChangeMarker: false,
					requestShape: {
						argument: emptyChannel,
						option: {
							requiredKeys: ['skill'],
							permittedKeys: ['skill', 'agent'],
							types: { skill: 'string', agent: 'string' },
						},
						environment: emptyChannel,
						stdin: {
							requiredKeys: ['prompt'],
							permittedKeys: ['prompt'],
							types: { prompt: 'string' },
						},
					},
					artifacts: [],
					descriptorChannel: { kind: 'stream', channel: 'stdout' },
					responseDescriptor: {
						requiredKeys: ['selected'],
						permittedKeys: ['selected'],
						types: { selected: 'array' },
						successIndicator: '/selected',
						channelRoles: { '/selected': 'collection' },
						collectionLocations: [
							{
								pointer: '/selected',
								referenceSet: null,
								// The bound is what lets pre-flight and the coverage
								// rules reason about a reply that names everything,
								// which is the degenerate answer to a selection
								// question.
								expectedCardinality: { mode: 'at-most', max: 40 },
							},
						],
					},
					volatilePointers: [],
					// The witness the strict compile needs: without it
					// `undeclared-mandatory-input` fires over the two required
					// keys this operation declares. It is also the skill-level
					// reading of sensitivity, two prompts differing in one case
					// and a relation saying the two selections have to differ. A
					// selection identical whichever case it is given is not
					// reading the case.
					sensitivityWitness: {
						witnessId: 'selection-follows-the-case',
						channel: 'stdin',
						legs: [
							{
								legId: 'witness-frontend',
								inputs: {
									argument: {},
									option: { skill: 'checklist-selection' },
									environment: {},
									stdin: {
										kind: 'json',
										value: { prompt: FRONTEND_PROMPT },
									},
								},
							},
							{
								legId: 'witness-backend',
								inputs: {
									argument: {},
									option: { skill: 'checklist-selection' },
									environment: {},
									stdin: {
										kind: 'json',
										value: { prompt: BACKEND_PROMPT },
									},
								},
							},
						],
						relation: {
							op: 'not',
							operands: [
								{
									op: 'deep-equality',
									operands: [
										{
											pointer: '/interactions/witness-frontend/stdout/selected',
										},
										{
											pointer: '/interactions/witness-backend/stdout/selected',
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
			stepId: 'frontend-case',
			operationId: 'run-skill',
			after: null,
			cardinality: 'exactly-one',
			inputBinding: {
				argument: null,
				option: { skill: { literal: 'checklist-selection' } },
				environment: null,
				// Bound by literal rather than by matcher: the evaluator exercises
				// this operation on both declared cases, and a matcher would
				// select both observations for one step under a cardinality that
				// admits one.
				stdin: { prompt: { literal: FRONTEND_PROMPT } },
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
	testData: { setup: null, cleanup: null, principals: null, resources: null },
	budgets: { maxToolCalls: 20, maxWallClockMinutes: 5, maxCostUsd: '1.00' },
	safetyLimits: [],
	requiredEvidence: [],
	probeStepBound: null,
	fixtureReset: null,
} satisfies EvalContract
