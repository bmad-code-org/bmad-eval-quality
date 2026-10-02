/**
 * Interface identity through the shipped adapters: two interfaces of one contract
 * declare one operation id, the harness drives both through the real adapter,
 * assembles the record's observations from what the adapter returned, and
 * scores them. The interface a request names comes back on the port
 * observation, and the record carries it from there, so each oracle reads the
 * observation of its own interface.
 *
 * The mechanisms are in-process fakes: the adapters' own spawn and stdio
 * behaviour is certified by their conformance subjects, and what this file
 * holds is the identity carried through them.
 */
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
	type CommandMechanism,
	createCommandLineAdapter,
} from '../../src/adapters/command-line-adapter.ts'
import {
	createMcpAdapter,
	type McpMechanism,
} from '../../src/adapters/mcp-adapter.ts'
import type {
	ProbeObservation,
	ProbeRequest,
} from '../../src/core/schemas/port-messages.ts'
import type { Observation } from '../../src/core/schemas/sealed-run-record.ts'
import type { EnvironmentProbePort } from '../../src/ports/environment-probe-port.ts'
import {
	NO_CALL_INPUTS,
	recordObservation,
	scoreSharedOperation,
	sharedOperationContract,
	sharedOperationProbe,
	sharedToolOperationContract,
	sharedToolOperationProbe,
} from '../fixtures/shared-operation-id.ts'

const signal = new AbortController().signal

/**
 * What a harness does with a port observation: the correlation triple becomes
 * the record's pair, and the channels the observation carries become the
 * record's channels.
 */
const recordedFrom = (
	request: ProbeRequest,
	observed: ProbeObservation,
	sequence: number,
): Observation => {
	const common = {
		observationId: `obs-${sequence}`,
		sequence,
		interfaceId: observed.interfaceId,
		operationId: observed.operationId,
	}
	if (request.kind === 'cli' && observed.kind === 'cli') {
		const { stdin } = request.channels
		return recordObservation({
			...common,
			callInputs: {
				...NO_CALL_INPUTS,
				bodyEncoding: null,
				stdin:
					stdin.kind === 'json' &&
					typeof stdin.value === 'object' &&
					stdin.value !== null &&
					!Array.isArray(stdin.value)
						? stdin.value
						: null,
			},
			stdout: observed.stdout,
			stderr: observed.stderr,
			exitCode: observed.exitCode,
		})
	}
	if (request.kind === 'mcp' && observed.kind === 'mcp') {
		return recordObservation({
			...common,
			callInputs: {
				...NO_CALL_INPUTS,
				bodyEncoding: null,
				arguments: request.channels.arguments,
			},
			responseBody:
				observed.result.kind === 'json' ? observed.result.value : null,
			responseStatus: observed.isError ? 1 : 0,
		})
	}
	throw new Error('the request and the observation disagree on the kind')
}

const driven = async (
	port: EnvironmentProbePort,
	requests: readonly ProbeRequest[],
): Promise<readonly Observation[]> => {
	const observations: Observation[] = []
	for (const request of requests) {
		const observed = await port.probe(request, signal)
		observations.push(recordedFrom(request, observed, observations.length + 1))
	}
	return observations
}

describe('the command-line adapter over two interfaces declaring one operation id', () => {
	const authorization = (version: 'v1' | 'v2') => ({
		interfaceId: `notes-${version}`,
		executable: `notes-${version}`,
		target: `/fixtures/notes-${version}`,
		permittedSubcommandPaths: [['read']],
		permittedEnvironmentKeys: [],
		cwd: tmpdir(),
		artifacts: {},
		maxElapsedMs: 2000,
		maxOutputBytes: 4096,
	})

	/** `notes-v1` prints the fragments the note holds; `notes-v2` prints nothing. */
	const mechanism: CommandMechanism = {
		run: async (request) => ({
			exitCode: 0,
			stdout: request.target.endsWith('notes-v1')
				? JSON.stringify({ fragments: [{ id: 'a' }] })
				: JSON.stringify({}),
			stderr: '',
		}),
		readArtifact: async () => ({ present: false, text: '', truncated: false }),
	}

	const requestFor = (stepId: string, version: 'v1' | 'v2'): ProbeRequest => ({
		kind: 'cli',
		probeId: stepId,
		interfaceId: `notes-${version}`,
		operationId: 'read-note',
		executable: `notes-${version}`,
		subcommandPath: ['read'],
		channels: {
			argument: {},
			option: {},
			environment: {},
			stdin: { kind: 'json', value: { prompt: 'the first task' } },
		},
	})

	it('echoes each request its own interface, and the scored record keeps them apart', async () => {
		const port = createCommandLineAdapter(
			{ authorizations: [authorization('v1'), authorization('v2')] },
			mechanism,
		)
		const observations = await driven(port, [
			requestFor('read-old', 'v1'),
			requestFor('read-new', 'v2'),
		])
		expect(observations.map((each) => each.interfaceId)).toEqual([
			'notes-v1',
			'notes-v2',
		])
		expect(observations.map((each) => each.operationId)).toEqual([
			'read-note',
			'read-note',
		])
		const [first, second] = observations
		if (first === undefined || second === undefined) throw new Error('two runs')

		const result = await scoreSharedOperation({
			contract: sharedOperationContract,
			probe: sharedOperationProbe,
			observations: [first, second],
		})
		expect(result.artifact).not.toBeNull()
		expect(result.ladder.verdict).not.toBeNull()
		const byOracle = Object.fromEntries(
			(result.artifact?.outcomes ?? []).map((outcome) => [
				outcome.oracleId,
				[outcome.selectedObservationIds, outcome.checkResolution?.resolution],
			]),
		)
		expect(byOracle).toEqual({
			'O-001': [['obs-1'], 'true'],
			'O-002': [['obs-2'], 'insufficient-evidence'],
		})
	})
})

describe('the MCP adapter over two servers publishing one operation id', () => {
	const authorization = (version: 'v1' | 'v2') => ({
		interfaceId: `notes-server-${version}`,
		target: `/fixtures/notes-server-${version}`,
		targetArgs: [],
		tools: [`search_notes_${version}`],
		cwd: tmpdir(),
		serverEnvironment: {},
		maxElapsedMs: 2000,
		maxOutputBytes: 4096,
	})

	/** `notes-server-v1` finds the note; `notes-server-v2` finds nothing. */
	const mechanism: McpMechanism = {
		callTool: async (request) => ({
			isError: false,
			structuredResult: request.target.endsWith('notes-server-v1')
				? { ok: true, matches: [{ noteId: 'n-1' }], totalCount: 1 }
				: { ok: true, matches: [], totalCount: 0 },
		}),
	}

	const requestFor = (stepId: string, version: 'v1' | 'v2'): ProbeRequest => ({
		kind: 'mcp',
		probeId: stepId,
		interfaceId: `notes-server-${version}`,
		operationId: 'search-notes',
		toolName: `search_notes_${version}`,
		channels: { arguments: { query: 'alpha' } },
	})

	it('echoes each request its own server, and the scored record keeps them apart', async () => {
		const port = createMcpAdapter(
			{ authorizations: [authorization('v1'), authorization('v2')] },
			mechanism,
		)
		const observations = await driven(port, [
			requestFor('search-old', 'v1'),
			requestFor('search-new', 'v2'),
		])
		expect(observations.map((each) => each.interfaceId)).toEqual([
			'notes-server-v1',
			'notes-server-v2',
		])
		const [first, second] = observations
		if (first === undefined || second === undefined)
			throw new Error('two calls')

		const result = await scoreSharedOperation({
			contract: sharedToolOperationContract,
			probe: sharedToolOperationProbe,
			observations: [first, second],
		})
		expect(result.artifact).not.toBeNull()
		expect(result.ladder.verdict).not.toBeNull()
		const byOracle = Object.fromEntries(
			(result.artifact?.outcomes ?? []).map((outcome) => [
				outcome.oracleId,
				[outcome.selectedObservationIds, outcome.checkResolution?.resolution],
			]),
		)
		expect(byOracle).toEqual({
			'O-001': [['obs-1'], 'true'],
			'O-002': [['obs-2'], 'false'],
		})
	})
})
