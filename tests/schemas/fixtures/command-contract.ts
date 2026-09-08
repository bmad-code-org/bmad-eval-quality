// A contract whose system under test runs behind a command rather than behind
// HTTP. Modelled on the shape a caller outside this repository authored against
// the published schema: one subcommand, a prompt on standard input, and oracles
// that address the structure the operation declares its standard output carries.
//
// It is the accept fixture for the `cli` branch of `permittedInterfaces` and the
// end-to-end evidence that a command contract compiles.

import type { EvalContract } from '../../../src/core/schemas/eval-contract.ts'

const emptyChannel = {
	requiredKeys: [] as string[],
	permittedKeys: [] as string[],
	types: {} as Record<string, null>,
}

export const commandContract = {
	schemaVersion: 4,
	contractId: 'fragment-selection',
	parentDigest: null,
	revisionCount: 0,
	sourceSpecDigest: null,
	behaviors: [
		{
			id: 'B-001',
			description:
				'Selecting fragments for a task returns the fragments that task needs.',
			severity: 'material',
			observableSuccessCriterion:
				'The selection names at least one fragment and never more than the index holds.',
			requirementLinks: [{ scheme: 'local', id: 'REQ-1' }],
			riskLinks: [{ scheme: 'local-risk', id: 'RISK-1' }],
			oracles: ['O-001'],
		},
	],
	oracles: [
		{
			id: 'O-001',
			direction: {
				evidenceTargets: ['/interactions/select/stdout/fragments'],
				relation: 'existence',
				polarity: 'expects-hold',
				scope: 'One selection call for one task.',
				negativeDomain: 'A selection naming no fragment at all.',
			},
			check: {
				op: 'existence',
				operands: [{ pointer: '/interactions/select/stdout/fragments' }],
			},
			polarity: 'expects-hold',
			commentary:
				'Reads the collection the operation declares its standard output carries.',
		},
	],
	rubrics: [],
	waivers: [],
	permittedInterfaces: [
		{
			logicalId: 'fragment-selection-runner',
			kind: 'cli',
			operations: [
				{
					operationId: 'select-fragments',
					invocation: {
						executable: 'fragment-selection-runner',
						subcommandPath: ['select'],
					},
					stateChangeMarker: false,
					requestShape: {
						argument: emptyChannel,
						option: {
							requiredKeys: [],
							permittedKeys: ['model'],
							types: { model: 'string' },
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
						requiredKeys: ['fragments'],
						permittedKeys: ['fragments'],
						types: { fragments: 'array' },
						successIndicator: '/fragments',
						channelRoles: { '/fragments': 'collection' },
						collectionLocations: [
							{
								pointer: '/fragments',
								referenceSet: null,
								expectedCardinality: { mode: 'at-most', max: 59 },
							},
						],
					},
					volatilePointers: [],
					sensitivityWitness: {
						witnessId: 'selection-follows-the-prompt',
						channel: 'stdin',
						legs: [
							{
								legId: 'leg-first-task',
								inputs: {
									argument: {},
									option: {},
									environment: {},
									stdin: { kind: 'json', value: { prompt: 'the first task' } },
								},
							},
							{
								legId: 'leg-second-task',
								inputs: {
									argument: {},
									option: {},
									environment: {},
									stdin: { kind: 'json', value: { prompt: 'the second task' } },
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
											pointer: '/interactions/leg-first-task/stdout/fragments',
										},
										{
											pointer: '/interactions/leg-second-task/stdout/fragments',
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
			stepId: 'select',
			operationId: 'select-fragments',
			after: null,
			cardinality: 'exactly-one',
			inputBinding: {
				argument: null,
				option: null,
				environment: null,
				stdin: { prompt: { matcher: 'any' } },
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
	budgets: { maxToolCalls: 4, maxWallClockMinutes: 5, maxCostUsd: '1.00' },
	safetyLimits: [],
	requiredEvidence: [],
	probeStepBound: null,
	fixtureReset: null,
} satisfies EvalContract

const [declaredInterface] = commandContract.permittedInterfaces
const selectFragments = declaredInterface?.operations[0]

if (selectFragments === undefined) {
	throw new Error('the command contract declares no operation')
}

/**
 * The same system under test, described through the file it writes rather than
 * through its standard output. `descriptorChannel` nominates one of the two
 * declared artifacts, so a pointer at that artifact descends through the
 * operation's one response descriptor and a pointer at the other one does not.
 */
export const artifactCommandContract = {
	...commandContract,
	contractId: 'review-corpus',
	oracles: [
		{
			id: 'O-001',
			direction: {
				evidenceTargets: ['/interactions/select/artifact/verdict/fragments'],
				relation: 'existence',
				polarity: 'expects-hold',
				scope: 'One review of one corpus.',
				negativeDomain: 'A verdict file naming no fragment at all.',
			},
			check: {
				op: 'existence',
				operands: [
					{ pointer: '/interactions/select/artifact/verdict/fragments' },
				],
			},
			polarity: 'expects-hold',
			commentary: 'Reads the collection the verdict file declares.',
		},
	],
	permittedInterfaces: [
		{
			logicalId: 'fragment-selection-runner',
			kind: 'cli',
			operations: [
				{
					...selectFragments,
					artifacts: ['verdict', 'report'],
					descriptorChannel: { kind: 'artifact', artifactId: 'verdict' },
					sensitivityWitness: {
						...selectFragments.sensitivityWitness,
						relation: {
							op: 'not',
							operands: [
								{
									op: 'deep-equality',
									operands: [
										{
											pointer:
												'/interactions/leg-first-task/artifact/verdict/fragments',
										},
										{
											pointer:
												'/interactions/leg-second-task/artifact/verdict/fragments',
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
} satisfies EvalContract
