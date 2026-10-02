/**
 * Two interfaces of one contract that declare the same `operationId`, the
 * shape the engine accepts: an operation is named by the pair
 * `(interfaceId, operationId)`, and an `operationId` is unique only within its
 * own interface.
 *
 * The command twin is `notes-v1` and `notes-v2`, two executables that each
 * declare `read-note`. The tool-server twin is `notes-server-v1` and
 * `notes-server-v2`, two servers that each declare the tool operation
 * `search-notes`. In both, the plan holds one step per interface and each
 * oracle reads the step of one interface, so evidence that crosses over from
 * the other interface changes a result.
 */
import { runScore } from '../../src/application/score.ts'
import { digestArtifact } from '../../src/core/canonical/digest.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import type { IsolationManifest } from '../../src/core/schemas/isolation-manifest.ts'
import type { JsonValue } from '../../src/core/schemas/primitives.ts'
import type { Probe } from '../../src/core/schemas/probe.ts'
import type {
	Observation,
	SealedRunRecord,
} from '../../src/core/schemas/sealed-run-record.ts'
import type { SignedProbe } from '../../src/core/score/witness.ts'
import {
	corpusDigestFixture,
	evaluatorConfigurationFixture,
	isolationManifestFixtureForScore,
	passingPreflightVerdictForScore,
	scoringPolicyFixtureForScore,
} from '../application/fixtures/score-fixtures.ts'
import { commandContract } from '../schemas/fixtures/command-contract.ts'
import { mcpContract } from '../schemas/fixtures/mcp-contract.ts'
import { qualifiedProbe } from '../score/fixtures/probe-witness.ts'

export const SHARED_OPERATION_ID = 'read-note'
export const SHARED_TOOL_OPERATION_ID = 'search-notes'

const [commandInterface] = commandContract.permittedInterfaces
const [selectOperation] = commandInterface?.operations ?? []
const [toolInterface] = mcpContract.permittedInterfaces
const searchOperation = toolInterface?.operations.find(
	(operation) => operation.operationId === 'search-notes',
)
if (selectOperation === undefined || searchOperation === undefined) {
	throw new Error('the base fixtures declare no operation to share')
}

const readNoteOperation = (version: 'v1' | 'v2') => {
	const first = `leg-${version}-first-task`
	const second = `leg-${version}-second-task`
	const operation = structuredClone(selectOperation)
	return {
		...operation,
		operationId: SHARED_OPERATION_ID,
		invocation: { executable: `notes-${version}`, subcommandPath: ['read'] },
		sensitivityWitness: {
			...operation.sensitivityWitness,
			witnessId: `read-note-${version}-follows-the-prompt`,
			legs: operation.sensitivityWitness.legs.map((leg, index) => ({
				...leg,
				legId: index === 0 ? first : second,
			})),
			relation: {
				op: 'not',
				operands: [
					{
						op: 'deep-equality',
						operands: [
							{ pointer: `/interactions/${first}/stdout/fragments` },
							{ pointer: `/interactions/${second}/stdout/fragments` },
						],
					},
				],
			},
		},
	}
}

const commandStep = (stepId: string, interfaceId: string) => ({
	stepId,
	interfaceId,
	operationId: SHARED_OPERATION_ID,
	after: null,
	cardinality: 'exactly-one',
	inputBinding: {
		argument: null,
		option: null,
		environment: null,
		stdin: { prompt: { matcher: 'any' } },
	},
})

const commandOracle = (id: string, stepId: string) => {
	const pointer = `/interactions/${stepId}/stdout/fragments`
	return {
		id,
		direction: {
			evidenceTargets: [pointer],
			relation: 'existence',
			polarity: 'expects-hold',
			scope: 'One read of one note.',
			negativeDomain: 'A read naming no fragment at all.',
		},
		check: { op: 'existence', operands: [{ pointer }] },
		polarity: 'expects-hold',
		commentary: null,
	}
}

/**
 * Both interfaces are `cli`, with distinct executables so the two operations
 * collide on nothing but their identifier. `read-old` selects `notes-v1`'s
 * observations and `read-new` selects `notes-v2`'s.
 */
export const sharedOperationContract = EvalContract.parse({
	...structuredClone(commandContract),
	contractId: 'shared-operation-id',
	behaviors: commandContract.behaviors.map((behavior) => ({
		...behavior,
		oracles: ['O-001', 'O-002'],
	})),
	oracles: [
		commandOracle('O-001', 'read-old'),
		commandOracle('O-002', 'read-new'),
	],
	permittedInterfaces: [
		{
			logicalId: 'notes-v1',
			kind: 'cli',
			operations: [readNoteOperation('v1')],
		},
		{
			logicalId: 'notes-v2',
			kind: 'cli',
			operations: [readNoteOperation('v2')],
		},
	],
	interactionPlan: [
		commandStep('read-old', 'notes-v1'),
		commandStep('read-new', 'notes-v2'),
	],
})

const searchToolOperation = (version: 'v1' | 'v2') => {
	const first = `search-${version}-a`
	const second = `search-${version}-b`
	const operation = structuredClone(searchOperation)
	return {
		...operation,
		toolName: `search_notes_${version}`,
		sensitivityWitness: {
			...operation.sensitivityWitness,
			witnessId: `search-notes-${version}-sensitivity`,
			legs: operation.sensitivityWitness.legs.map((leg, index) => ({
				...leg,
				legId: index === 0 ? first : second,
			})),
			relation: {
				op: 'not',
				operands: [
					{
						op: 'deep-equality',
						operands: [
							{ pointer: `/interactions/${first}/response-body/matches` },
							{ pointer: `/interactions/${second}/response-body/matches` },
						],
					},
				],
			},
		},
	}
}

const toolStep = (stepId: string, interfaceId: string) => ({
	stepId,
	interfaceId,
	operationId: SHARED_TOOL_OPERATION_ID,
	after: null,
	cardinality: 'exactly-one',
	inputBinding: { arguments: { query: { matcher: 'any' } } },
})

const toolOracle = (id: string, stepId: string) => {
	const pointer = `/interactions/${stepId}/response-body/totalCount`
	return {
		id,
		direction: {
			evidenceTargets: [pointer],
			relation: 'equality',
			polarity: 'expects-hold',
			scope: 'One search for one query.',
			negativeDomain: 'A search reporting no match for a query that has one.',
		},
		check: { op: 'equality', operands: [{ pointer }, { literal: 1 }] },
		polarity: 'expects-hold',
		commentary: null,
	}
}

/** The tool-server twin: two servers each publishing the tool operation `search-notes`. */
export const sharedToolOperationContract = EvalContract.parse({
	...structuredClone(mcpContract),
	contractId: 'shared-tool-operation-id',
	fixtureReset: null,
	behaviors: [
		{
			...mcpContract.behaviors[0],
			oracles: ['O-001', 'O-002'],
		},
	],
	oracles: [
		toolOracle('O-001', 'search-old'),
		toolOracle('O-002', 'search-new'),
	],
	permittedInterfaces: [
		{
			logicalId: 'notes-server-v1',
			kind: 'mcp',
			operations: [searchToolOperation('v1')],
		},
		{
			logicalId: 'notes-server-v2',
			kind: 'mcp',
			operations: [searchToolOperation('v2')],
		},
	],
	interactionPlan: [
		toolStep('search-old', 'notes-server-v1'),
		toolStep('search-new', 'notes-server-v2'),
	],
})

export const NO_CALL_INPUTS = {
	path: null,
	query: null,
	header: null,
	body: null,
	argument: null,
	option: null,
	environment: null,
	stdin: null,
	arguments: null,
}

/** One record observation with every field the scorer never reads left inert. */
export const recordObservation = (
	fields: Pick<
		Observation,
		'observationId' | 'sequence' | 'interfaceId' | 'operationId'
	> &
		Partial<Observation>,
): Observation => ({
	provenance: 'evaluator-chosen',
	principal: null,
	callInputs: { ...NO_CALL_INPUTS, bodyEncoding: null },
	responseBody: null,
	responseHeaders: null,
	responseStatus: null,
	stdout: { kind: 'absent' },
	stderr: { kind: 'absent' },
	exitCode: null,
	artifacts: {},
	...fields,
})

/** What `read-note` printed, as `read-old` and `read-new` both bind it: a prompt on standard input. */
export const commandObservation = (
	observationId: string,
	sequence: number,
	interfaceId: string,
	printed: JsonValue,
): Observation =>
	recordObservation({
		observationId,
		sequence,
		interfaceId,
		operationId: SHARED_OPERATION_ID,
		callInputs: {
			...NO_CALL_INPUTS,
			bodyEncoding: null,
			stdin: { prompt: 'the first task' },
		},
		stdout: { kind: 'json', value: printed },
		exitCode: 0,
	})

/** What `search-notes` answered, as `search-old` and `search-new` both bind it: a query argument. */
export const toolObservation = (
	observationId: string,
	sequence: number,
	interfaceId: string,
	answered: JsonValue,
): Observation =>
	recordObservation({
		observationId,
		sequence,
		interfaceId,
		operationId: SHARED_TOOL_OPERATION_ID,
		callInputs: {
			...NO_CALL_INPUTS,
			bodyEncoding: null,
			arguments: { query: 'alpha' },
		},
		responseBody: answered,
		responseStatus: 0,
	})

const commandSignature = (
	executable: string,
): SignedProbe['defectSignature'] => ({
	interfaceKind: 'cli',
	invocation: { executable, subcommandPath: ['read'] },
	observableChannel: 'stdout',
	condition: {
		selector: {
			inputBinding: {
				...NO_CALL_INPUTS,
				stdin: { prompt: { matcher: 'any' } },
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
					op: 'absence',
					operands: [{ pointer: '/interactions/observed/stdout/fragments' }],
				},
			],
		},
	},
})

/** A defect probe signed on `notes-v2`'s invocation, the interface `read-new` selects. */
export const sharedOperationProbe: SignedProbe = {
	...qualifiedProbe,
	probeId: 'P-001',
	systemId: 'shared-operation-id',
	rationale: 'A controlled mutation seeding a read that names no fragment.',
	defectSignature: commandSignature('notes-v2'),
}

/** The same defect against `notes-v1`, the interface `read-old` selects. */
export const sharedOperationProbeOnV1: SignedProbe = {
	...sharedOperationProbe,
	defectSignature: commandSignature('notes-v1'),
}

/** A defect probe signed on the tool `search_notes_v2` that `notes-server-v2` publishes. */
export const sharedToolOperationProbe: SignedProbe = {
	...qualifiedProbe,
	probeId: 'P-001',
	systemId: 'shared-tool-operation-id',
	rationale: 'A controlled mutation seeding a search that finds nothing.',
	defectSignature: {
		interfaceKind: 'mcp',
		toolName: 'search_notes_v2',
		observableChannel: 'response-body',
		condition: {
			selector: {
				inputBinding: {
					...NO_CALL_INPUTS,
					arguments: { query: { matcher: 'any' } },
				},
			},
			predicate: {
				op: 'equality',
				operands: [
					{ pointer: '/interactions/observed/response-body/totalCount' },
					{ literal: 0 },
				],
			},
		},
	},
}

const RUN_ID = 'shared-operation-run'

const dispositionOf = (
	oracleId: string,
	disposition: 'held' | 'violated',
	observationId: string,
) => ({ oracleId, disposition, observationIds: [observationId], note: null })

/**
 * Scores two observations, one per interface, through `runScore`. The first
 * observation is the one the evaluator attributes to `O-001`, the second to
 * `O-002`, so which interface each carries is the only thing a test varies.
 * The record is public on every artifact, so no corpus port is involved.
 */
export const scoreSharedOperation = (options: {
	readonly contract: EvalContract
	readonly probe: Probe
	readonly observations: readonly [Observation, Observation]
	readonly oracleIds?: readonly [string, string]
	readonly dispositions?: readonly ['held' | 'violated', 'held' | 'violated']
}) => {
	const { contract, probe, observations } = options
	const contractDigest = digestArtifact(contract, 'EvalContract')
	const manifest: IsolationManifest = {
		...isolationManifestFixtureForScore,
		runId: RUN_ID,
		contractId: contract.contractId,
		contractDigest,
	}
	const [firstOracle, secondOracle] = options.oracleIds ?? ['O-001', 'O-002']
	const [firstDisposition, secondDisposition] = options.dispositions ?? [
		'held',
		'violated',
	]
	const record: SealedRunRecord = {
		schemaVersion: 8,
		parentDigest: null,
		revisionCount: 0,
		runId: RUN_ID,
		conditionArm: 'independent',
		mode: 'production',
		trialIndex: 1,
		contractDigest,
		sealedBriefDigest:
			'sha256:0000000000000000000000000000000000000000000000000000000000000013',
		evaluatorConfigurationDigest:
			isolationManifestFixtureForScore.evaluatorConfigurationDigest,
		evaluatorRecommendation: 'PASS',
		oracleDispositions: [
			dispositionOf(
				firstOracle,
				firstDisposition,
				observations[0].observationId,
			),
			dispositionOf(
				secondOracle,
				secondDisposition,
				observations[1].observationId,
			),
		],
		findings: [],
		observations: [...observations],
		judgeResults: [],
		actionsArtifact: {
			storage: 'public',
			path: 'evidence/actions.jsonl',
			privateRef: null,
			digest:
				'sha256:0000000000000000000000000000000000000000000000000000000000000014',
		},
		isolationManifestArtifact: {
			storage: 'public',
			path: 'evidence/isolation-manifest.json',
			privateRef: null,
			digest: digestArtifact(manifest, 'IsolationManifest'),
		},
		resourceUse: {
			toolCalls: 2,
			inputTokens: 0,
			outputTokens: 0,
			wallClockSeconds: 0,
			costUsd: '0',
		},
		evidenceDisclosure: { truncationBound: null, reportedIncomplete: false },
	}
	return runScore({
		record,
		manifest,
		configuration: evaluatorConfigurationFixture,
		contract,
		probe,
		preflightVerdict: { ...passingPreflightVerdictForScore, runId: RUN_ID },
		policy: scoringPolicyFixtureForScore,
		privateManifest: null,
		corpusDigest: corpusDigestFixture,
		signal: new AbortController().signal,
	})
}
