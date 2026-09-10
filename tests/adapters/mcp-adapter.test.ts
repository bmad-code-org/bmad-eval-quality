/**
 * `createMcpAdapter` over a real stdio MCP server: one case per row of the
 * story's I/O matrix, plus the six shared AD-37 assertions run from a
 * `PortSubject` built here.
 *
 * The subject is local rather than a shared module. `reportOf` computes
 * `passed` from `CONFORMANCE_OUTCOME_COUNTS[port]`, so an `mcp` conformance
 * report is unconstructible until an `mcp-probe` entry exists, and the story
 * that adds that entry owns the reusable subject. The six shared assertions do
 * not need the entry, so they are discharged here.
 */
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
	createMcpAdapter,
	type McpCallToolResult,
	type McpMechanism,
	nodeStdioMcpMechanism,
} from '../../src/adapters/mcp-adapter.ts'
import { runPreflight } from '../../src/application/preflight.ts'
import { compile } from '../../src/core/compile/compile.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { RuntimeFault } from '../../src/core/schemas/faults.ts'
import type {
	McpProbeRequest,
	ProbeObservation,
	ProbeRequest,
} from '../../src/core/schemas/port-messages.ts'
import type { JsonValue } from '../../src/core/schemas/primitives.ts'
import type { McpTargetPolicy } from '../../src/core/schemas/probe-policy.ts'
import { probeParsers } from '../../src/ports/environment-probe-port.ts'
import type {
	BuiltSubject,
	PortSubject,
	ScenarioKind,
} from '../../src/testing/conformance.ts'
import { runSharedAssertions } from '../../src/testing/conformance.ts'
import { mcpContract } from '../schemas/fixtures/mcp-contract.ts'

const FIXTURE_PATH = fileURLToPath(
	new URL('./fixtures/mcp-probe-fixture.mjs', import.meta.url),
)

const MAX_ELAPSED_MS = 5000
const MAX_OUTPUT_BYTES = 8192
const TIGHT_ELAPSED_MS = 300

const TOOLS = [
	'search_notes',
	'create_note',
	'failing_tool',
	'rpc_error_tool',
	'oversize_tool',
	'noisy_tool',
	'silent_tool',
]

const serverAt = (
	interfaceId: string,
	overrides: {
		readonly targetArgs?: readonly string[]
		readonly target?: string
		readonly tools?: readonly string[]
		readonly maxElapsedMs?: number
	} = {},
) => ({
	interfaceId,
	target: overrides.target ?? process.execPath,
	targetArgs: [...(overrides.targetArgs ?? [FIXTURE_PATH])],
	tools: [...(overrides.tools ?? TOOLS)],
	cwd: process.cwd(),
	serverEnvironment: {},
	maxElapsedMs: overrides.maxElapsedMs ?? MAX_ELAPSED_MS,
	maxOutputBytes: MAX_OUTPUT_BYTES,
})

/**
 * One entry per launch shape the matrix needs. Every denial case leaves the
 * policy entirely: an unmapped `interfaceId` names no entry, and an unmapped
 * `toolName` names no entry's `tools`.
 */
const policy: McpTargetPolicy = {
	authorizations: [
		serverAt('notes-tool-server'),
		serverAt('tight-server', {
			tools: ['hanging_tool'],
			maxElapsedMs: TIGHT_ELAPSED_MS,
		}),
		serverAt('slow-server', { tools: ['hanging_tool'] }),
		serverAt('exiting-server', {
			targetArgs: [FIXTURE_PATH, '--exit-at-launch'],
			tools: ['search_notes'],
		}),
		serverAt('garbage-server', {
			targetArgs: [FIXTURE_PATH, '--garbage'],
			tools: ['search_notes'],
		}),
		serverAt('missing-server', {
			target: '/nonexistent/eval-quality-no-such-server',
			tools: ['search_notes'],
		}),
	],
}

const request = (params: {
	readonly probeId: string
	readonly interfaceId?: string
	readonly toolName?: string
	readonly arguments?: Record<string, JsonValue>
}): McpProbeRequest => ({
	kind: 'mcp',
	probeId: params.probeId,
	interfaceId: params.interfaceId ?? 'notes-tool-server',
	operationId: params.probeId,
	toolName: params.toolName ?? 'search_notes',
	channels: { arguments: params.arguments ?? { query: 'alpha' } },
})

const port = createMcpAdapter(policy)

const probeFor = (parameters: Parameters<typeof request>[0]) =>
	port.probe(request(parameters), new AbortController().signal)

const faultOf = async (act: () => Promise<unknown>): Promise<RuntimeFault> => {
	let thrown: unknown
	try {
		await act()
	} catch (error) {
		thrown = error
	}
	expect(thrown).toBeInstanceOf(RuntimeFault)
	return thrown as RuntimeFault
}

const mcpObservation = (observation: ProbeObservation) => {
	if (observation.kind !== 'mcp')
		throw new Error('this adapter answers with a tool-call observation')
	return observation
}

describe('an authorized tool call', () => {
	it('starts the server, completes the handshake, and echoes the four correlation fields', async () => {
		const observed = mcpObservation(
			await probeFor({ probeId: 'authorized', arguments: { query: 'alpha' } }),
		)
		expect(observed.kind).toBe('mcp')
		expect(observed.probeId).toBe('authorized')
		expect(observed.interfaceId).toBe('notes-tool-server')
		expect(observed.operationId).toBe('authorized')
		expect(observed.isError).toBe(false)
		expect(observed.result).toEqual({
			kind: 'json',
			value: {
				ok: true,
				matches: [{ noteId: 'n-alpha' }],
				totalCount: 1,
				echo: 'alpha',
			},
		})
	})

	// The arguments travel inside the JSON-RPC frame, so the value the server
	// echoes back is the value the request declared, character for character.
	// A value carrying shell metacharacters proves it never reaches a shell.
	it('sends the declared arguments verbatim, metacharacters included', async () => {
		const injection = '$(echo pwned); rm -rf / #'
		const observed = mcpObservation(
			await probeFor({
				probeId: 'literal-arguments',
				arguments: { query: injection },
			}),
		)
		if (observed.result.kind !== 'json')
			throw new Error('the tool returns a structured result')
		expect((observed.result.value as { echo: string }).echo).toBe(injection)
	})

	it('records a result with no structured content as an absent body', async () => {
		const observed = mcpObservation(
			await probeFor({ probeId: 'silent', toolName: 'silent_tool' }),
		)
		expect(observed.isError).toBe(false)
		expect(observed.result).toEqual({ kind: 'absent' })
	})
})

describe('a server that answers with an error', () => {
	// AD-10's seeded-fault check reads the answer as payload. Throwing here
	// would make the one refusal a probe was written to catch invisible.
	it('resolves a tool result carrying isError, with the structured result intact', async () => {
		const observed = mcpObservation(
			await probeFor({ probeId: 'tool-error', toolName: 'failing_tool' }),
		)
		expect(observed.isError).toBe(true)
		expect(observed.result).toEqual({
			kind: 'json',
			value: { ok: false, reason: 'the tool refused the call' },
		})
	})

	it('resolves a JSON-RPC error answering tools/call, with the error object as the result', async () => {
		const observed = mcpObservation(
			await probeFor({ probeId: 'rpc-error', toolName: 'rpc_error_tool' }),
		)
		expect(observed.isError).toBe(true)
		expect(observed.result).toEqual({
			kind: 'json',
			value: { code: -32602, message: 'no such argument', data: null },
		})
	})

	it('answers both cases with a schema-valid observation', async () => {
		for (const toolName of ['failing_tool', 'rpc_error_tool']) {
			const observed = await probeFor({ probeId: 'schema-valid', toolName })
			expect(probeParsers.response.safeParse(observed).success).toBe(true)
		}
	})
})

describe('the policy, applied before a server process starts', () => {
	it('refuses an interface the mapping does not name', async () => {
		const fault = await faultOf(() =>
			probeFor({ probeId: 'unmapped-interface', interfaceId: 'other-server' }),
		)
		expect(fault.code).toBe('forbidden-target')
		expect(fault.message).toContain('other-server')
	})

	it('refuses a tool the authorization does not list', async () => {
		const fault = await faultOf(() =>
			probeFor({ probeId: 'unmapped-tool', toolName: 'delete_everything' }),
		)
		expect(fault.code).toBe('forbidden-target')
		expect(fault.message).toContain('delete_everything')
	})

	// The denial happens before anything spawns, which is what a counting
	// mechanism can prove: a refused request reaches no mechanism at all.
	it('denies before the mechanism is reached', async () => {
		let calls = 0
		const counting: McpMechanism = {
			callTool: () => {
				calls++
				return Promise.resolve({ isError: false, structuredResult: null })
			},
		}
		const counted = createMcpAdapter(policy, counting)
		await faultOf(() =>
			counted.probe(
				request({ probeId: 'denied', interfaceId: 'other-server' }),
				new AbortController().signal,
			),
		)
		expect(calls).toBe(0)
		// The zero above means something only because this counter does count.
		await counted.probe(
			request({ probeId: 'allowed' }),
			new AbortController().signal,
		)
		expect(calls).toBe(1)
	})

	it.each(['api', 'cli'] as const)(
		'refuses an %s request and names the kind that arrived',
		async (kind) => {
			const other: ProbeRequest =
				kind === 'api'
					? {
							probeId: 'other-kind',
							interfaceId: 'notes-tool-server',
							operationId: 'other-kind',
							kind: 'api',
							method: 'GET',
							pathTemplate: '/notes',
							channels: {
								path: {},
								query: {},
								header: {},
								body: { kind: 'absent' },
							},
						}
					: {
							probeId: 'other-kind',
							interfaceId: 'notes-tool-server',
							operationId: 'other-kind',
							kind: 'cli',
							executable: 'notes',
							subcommandPath: [],
							channels: {
								argument: {},
								option: {},
								environment: {},
								stdin: { kind: 'absent' },
							},
						}
			const fault = await faultOf(() =>
				port.probe(other, new AbortController().signal),
			)
			expect(fault.code).toBe('forbidden-target')
			expect(fault.message).toContain(`no ${kind} target is ever authorized`)
		},
	)
})

describe('the caps and the session failures, which are never conflated', () => {
	it('caps a result past maxOutputBytes rather than returning a partial frame', async () => {
		const fault = await faultOf(() =>
			probeFor({
				probeId: 'oversize',
				toolName: 'oversize_tool',
				arguments: { bytes: MAX_OUTPUT_BYTES * 4 },
			}),
		)
		expect(fault.code).toBe('budget-exhausted')
		expect(fault.message).toContain('stdout')
	})

	// The transport reserves server stderr for logging, so it is drained and
	// capped on its own. An undrained pipe deadlocks the server once the OS
	// buffer fills; a drained one with no cap is an unbounded allocation.
	it('caps the server writing past maxOutputBytes on its own stderr', async () => {
		const fault = await faultOf(() =>
			probeFor({
				probeId: 'noisy',
				toolName: 'noisy_tool',
				arguments: { bytes: MAX_OUTPUT_BYTES * 4 },
			}),
		)
		expect(fault.code).toBe('budget-exhausted')
		expect(fault.message).toContain('stderr')
	})

	it('caps a session that never answers on maxElapsedMs', async () => {
		const fault = await faultOf(() =>
			probeFor({
				probeId: 'hanging',
				interfaceId: 'tight-server',
				toolName: 'hanging_tool',
			}),
		)
		expect(fault.code).toBe('budget-exhausted')
		expect(fault.message).toContain('maxElapsedMs')
	})

	it('reports a server that fails to start as a port failure, never as a denial', async () => {
		const fault = await faultOf(() =>
			probeFor({ probeId: 'missing', interfaceId: 'missing-server' }),
		)
		expect(fault.code).toBe('port-failure')
	})

	it('reports a server that exits before the handshake as a port failure', async () => {
		const fault = await faultOf(() =>
			probeFor({ probeId: 'exiting', interfaceId: 'exiting-server' }),
		)
		expect(fault.code).toBe('port-failure')
	})

	it('reports bytes on stdout that are not a JSON-RPC message as a port failure', async () => {
		const fault = await faultOf(() =>
			probeFor({ probeId: 'garbage', interfaceId: 'garbage-server' }),
		)
		expect(fault.code).toBe('port-failure')
	})

	it('rejects promptly when the caller aborts mid-call', async () => {
		const controller = new AbortController()
		const pending = port.probe(
			request({
				probeId: 'aborted',
				interfaceId: 'slow-server',
				toolName: 'hanging_tool',
			}),
			controller.signal,
		)
		const startedAt = Date.now()
		setTimeout(() => {
			controller.abort()
		}, 20)
		const fault = await faultOf(() => pending)
		expect(fault.code).toBe('aborted')
		expect(Date.now() - startedAt).toBeLessThan(MAX_ELAPSED_MS)
	})
})

/**
 * The shared six over the real adapter. `resolves` is a real stdio session for
 * the same reason the command arm's subject runs a real process: a synthetic
 * mechanism would prove nothing about the one thing this adapter exists to get
 * right.
 */
function mcpSubject(): PortSubject<ProbeRequest> {
	const build = async (
		scenario: ScenarioKind,
	): Promise<BuiltSubject<ProbeRequest>> => {
		let calls = 0
		const mechanism: McpMechanism = {
			callTool: async (callRequest, signal) => {
				calls++
				if (scenario === 'fails') {
					const error: NodeJS.ErrnoException = new Error(
						'spawn ENOENT: no such server',
					)
					error.code = 'ENOENT'
					throw error
				}
				if (scenario === 'in-band-error') {
					// `isError` typed `boolean` and given a string: the mechanism's
					// own contract violated, so the assembled observation fails the
					// response parse rather than resolving.
					return {
						isError: 'not-a-boolean' as unknown as boolean,
						structuredResult: null,
					} satisfies McpCallToolResult
				}
				if (scenario === 'hangs') {
					// Deliberately ignores the signal: honouring it is the adapter's
					// obligation under AD-28, and `port-boundary.ts`'s race is what
					// discharges it.
					return new Promise<McpCallToolResult>(() => {})
				}
				return nodeStdioMcpMechanism.callTool(callRequest, signal)
			},
		}
		const subjectPort = createMcpAdapter(policy, mechanism)
		return {
			port: (probeRequest, signal) => subjectPort.probe(probeRequest, signal),
			underlyingCalls: () => calls,
		}
	}

	return {
		name: 'createMcpAdapter',
		// A killed real process can take a little longer to report than an
		// in-process abort, and this budget sits well clear of MAX_ELAPSED_MS so
		// a slow runner cannot turn the abort assertion into a cap assertion.
		abortBudgetMs: 2000,
		sampleRequest: request({ probeId: 'sample' }),
		build,
	}
}

describe("AD-37's six shared assertions", () => {
	it('all six pass against the shipped adapter', async () => {
		const outcomes = await runSharedAssertions(
			'probe',
			mcpSubject(),
			probeParsers.response,
		)
		expect(outcomes.map((each) => each.id)).toEqual([
			'probe/typed-fault',
			'probe/single-underlying-call-on-success',
			'probe/single-underlying-call-on-failure',
			'probe/prompt-abort',
			'probe/no-in-band-error',
			'probe/schema-valid-return',
		])
		expect(outcomes.filter((each) => !each.passed)).toEqual([])
	})
})

describe('a pre-flight over an mcp contract, end to end', () => {
	// The closing acceptance: a real tool server behind the shipped adapter,
	// driven by the same `runPreflight` an api or a cli contract drives.
	it('produces a verdict whose checks read the tool-call evidence', async () => {
		const contract = compile(EvalContract.parse(mcpContract), { strict: true })
		const verdict = await runPreflight({
			contract,
			probes: [],
			runId: 'mcp-run-0001',
			port: createMcpAdapter({
				authorizations: [
					serverAt('notes-tool-server', {
						tools: ['search_notes', 'create_note'],
					}),
				],
			}),
			signal: new AbortController().signal,
		})
		const kinds = new Set(verdict.checks.map((check) => check.kind))
		for (const kind of [
			'interface-present',
			'state-reset',
			'clean-control',
			'input-sensitivity',
		]) {
			expect(kinds.has(kind as never)).toBe(true)
			const answered = verdict.checks.filter((check) => check.kind === kind)
			expect(answered.length).toBeGreaterThan(0)
			for (const check of answered) expect(check.outcome).toBe('satisfied')
		}
		expect(verdict.passed).toBe(true)
	}, 30_000)
})
