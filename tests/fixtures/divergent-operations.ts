/**
 * Two interfaces of one contract that declare the same `operationId` and then
 * disagree about everything else the compiler and the scorer read off an
 * operation: where the response lives, which keys and types it declares, which
 * files it writes and which inputs it requires.
 *
 * `shared-operation-id.ts` shares one descriptor between its two interfaces, so
 * a lookup that reads the other interface's operation returns an identical
 * answer. Here the answer differs, so every step-to-operation lookup has a case
 * where reading the wrong interface changes the result.
 *
 * `notes-v1` answers on standard output with a `fragments` collection and a
 * string `token`. `notes-v2` answers in the file `report` with an `entries`
 * collection and a numeric `token`, writes a second file `log`, and requires a
 * `format` option. Both declare `rows`: a collection on `notes-v1` and a string
 * on `notes-v2`.
 */
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { commandContract } from '../schemas/fixtures/command-contract.ts'

const [commandInterface] = commandContract.permittedInterfaces
const [selectOperation] = commandInterface?.operations ?? []
if (selectOperation === undefined) {
	throw new Error('the command fixture declares no operation to diverge')
}

const emptyChannel = { requiredKeys: [], permittedKeys: [], types: {} }

const witnessOf = (
	version: 'v1' | 'v2',
	channelFolder: string,
	extraInputs: Record<string, unknown>,
) => {
	const first = `leg-${version}-first-task`
	const second = `leg-${version}-second-task`
	const leg = (legId: string, prompt: string) => ({
		legId,
		inputs: {
			argument: {},
			option: { ...extraInputs },
			environment: {},
			stdin: { kind: 'json', value: { prompt } },
		},
	})
	return {
		witnessId: `read-note-${version}-follows-the-prompt`,
		channel: 'stdin',
		legs: [leg(first, 'the first task'), leg(second, 'the second task')],
		relation: {
			op: 'not',
			operands: [
				{
					op: 'deep-equality',
					operands: [
						{ pointer: `/interactions/${first}/${channelFolder}` },
						{ pointer: `/interactions/${second}/${channelFolder}` },
					],
				},
			],
		},
	}
}

const stdinPrompt = {
	requiredKeys: ['prompt'],
	permittedKeys: ['prompt'],
	types: { prompt: 'string' },
}

const collectionAt = (pointer: string) => [
	{
		pointer,
		referenceSet: null,
		expectedCardinality: { mode: 'at-most', max: 59 },
	},
]

/** Answers on standard output. */
export const notesV1Operation = {
	...structuredClone(selectOperation),
	operationId: 'read-note',
	invocation: { executable: 'notes-v1', subcommandPath: ['read'] },
	stateChangeMarker: false,
	requestShape: {
		argument: emptyChannel,
		option: emptyChannel,
		environment: emptyChannel,
		stdin: stdinPrompt,
	},
	artifacts: [],
	descriptorChannel: { kind: 'stream', channel: 'stdout' },
	responseDescriptor: {
		requiredKeys: ['fragments'],
		permittedKeys: ['fragments', 'token', 'rows'],
		types: { fragments: 'array', token: 'string', rows: 'array' },
		successIndicator: '/fragments',
		channelRoles: { '/fragments': 'collection' },
		collectionLocations: collectionAt('/fragments'),
	},
	volatilePointers: [],
	sensitivityWitness: witnessOf('v1', 'stdout/fragments', {}),
}

/** Answers in the file `report`, writes `log` beside it, and requires a `format` option. */
export const notesV2Operation = {
	...structuredClone(selectOperation),
	operationId: 'read-note',
	invocation: { executable: 'notes-v2', subcommandPath: ['read'] },
	stateChangeMarker: false,
	requestShape: {
		argument: emptyChannel,
		option: {
			requiredKeys: ['format'],
			permittedKeys: ['format', 'retries'],
			types: { format: 'string', retries: 'number' },
		},
		environment: emptyChannel,
		stdin: stdinPrompt,
	},
	artifacts: ['report', 'log'],
	descriptorChannel: { kind: 'artifact', artifactId: 'report' },
	responseDescriptor: {
		requiredKeys: ['entries'],
		permittedKeys: ['entries', 'token', 'rows'],
		types: { entries: 'array', token: 'number', rows: 'string' },
		successIndicator: '/entries',
		channelRoles: { '/entries': 'collection' },
		collectionLocations: collectionAt('/entries'),
	},
	volatilePointers: [],
	sensitivityWitness: witnessOf('v2', 'artifact/report/entries', {
		format: 'plain',
	}),
}

const stdinBinding = {
	argument: null,
	option: null,
	environment: null,
	stdin: { prompt: { matcher: 'any' } },
}

export const readOldStep = {
	stepId: 'read-old',
	interfaceId: 'notes-v1',
	operationId: 'read-note',
	after: null,
	cardinality: 'exactly-one',
	inputBinding: stdinBinding,
}

/** Binds the required `format` option to the string `token` that `read-old` printed. */
export const readNewStep = {
	stepId: 'read-new',
	interfaceId: 'notes-v2',
	operationId: 'read-note',
	after: 'read-old',
	cardinality: 'exactly-one',
	inputBinding: {
		...stdinBinding,
		option: {
			format: { captured: '/interactions/read-old/stdout/token' },
		},
	},
}

/** Reads the numeric `token` of the report `read-new` wrote into the `retries` option. */
export const readNewAgainStep = {
	stepId: 'read-new-2',
	interfaceId: 'notes-v2',
	operationId: 'read-note',
	after: 'read-old',
	cardinality: 'exactly-one',
	inputBinding: {
		...stdinBinding,
		option: {
			format: { captured: '/interactions/read-old/stdout/token' },
			retries: { captured: '/interactions/read-new/artifact/report/token' },
		},
	},
}

const existence = (id: string, pointer: string) => ({
	id,
	direction: {
		evidenceTargets: [pointer],
		relation: 'existence',
		polarity: 'expects-hold',
		scope: 'One read of one note.',
		negativeDomain: 'A read naming nothing at all.',
	},
	check: { op: 'existence', operands: [{ pointer }] },
	polarity: 'expects-hold',
	commentary: null,
})

/** A quantifier over the collection `read-new` writes into its report file. */
export const reportQuantifier = {
	id: 'O-002',
	direction: {
		evidenceTargets: ['/interactions/read-new/artifact/report/entries'],
		relation: 'for-all',
		polarity: 'expects-hold',
		scope: 'Every entry the report names.',
		negativeDomain: 'An entry carrying no identifier.',
	},
	check: {
		op: 'for-all',
		collection: { pointer: '/interactions/read-new/artifact/report/entries' },
		predicate: { op: 'existence', operands: [{ pointer: '@/id' }] },
	},
	polarity: 'expects-hold',
	commentary: null,
}

/** The raw contract object, so a case can change one declaration before it parses. */
export const divergentOperationDraft = () => {
	const base = structuredClone(commandContract)
	const [behavior] = base.behaviors
	return {
		...base,
		contractId: 'divergent-operations',
		behaviors: [{ ...behavior, oracles: ['O-001', 'O-002', 'O-003'] }],
		oracles: [
			existence('O-001', '/interactions/read-old/stdout/fragments'),
			structuredClone(reportQuantifier),
			existence('O-003', '/interactions/read-new/artifact/log'),
		],
		permittedInterfaces: [
			{
				logicalId: 'notes-v1',
				kind: 'cli',
				operations: [structuredClone(notesV1Operation)],
			},
			{
				logicalId: 'notes-v2',
				kind: 'cli',
				operations: [structuredClone(notesV2Operation)],
			},
		],
		interactionPlan: [
			structuredClone(readOldStep),
			structuredClone(readNewStep),
			structuredClone(readNewAgainStep),
		],
	}
}

export const divergentOperationContract = EvalContract.parse(
	divergentOperationDraft(),
)
