/**
 * `createMcpAdapter` over a real stdio MCP server: one case per row of the
 * story's I/O matrix, plus the six shared AD-37 assertions.
 *
 * The shared six run from `mcp-probe-subject.ts`, the reusable subject the
 * `mcp` conformance arm certifies. They were discharged from a subject built
 * in this file while the `mcp-probe` outcome-count entry did not exist, since
 * `reportOf` computes `passed` from `CONFORMANCE_OUTCOME_COUNTS[port]` and a
 * report was unconstructible without it.
 */
import { execFileSync, spawn } from 'node:child_process'
import { getEventListeners } from 'node:events'
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
} from 'node:fs'
import { constants as osConstants, tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import type {
	McpAnsweredCall,
	McpEndedSession,
} from '../../src/adapters/index.ts'
import {
	createMcpAdapter,
	type McpCallToolRequest,
	type McpMechanism,
	nodeStdioMcpMechanism,
} from '../../src/adapters/mcp-adapter.ts'
import { trackedProcessCount } from '../../src/adapters/process-group.ts'
import { runPreflight } from '../../src/application/preflight.ts'
import { compile } from '../../src/core/compile/compile.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { RuntimeFault } from '../../src/core/schemas/faults.ts'
import {
	type McpProbeObservation,
	type McpProbeRequest,
	ProbeObservation,
	type ProbeRequest,
} from '../../src/core/schemas/port-messages.ts'
import type { JsonValue } from '../../src/core/schemas/primitives.ts'
import type { McpTargetPolicy } from '../../src/core/schemas/probe-policy.ts'
import { probeParsers } from '../../src/ports/environment-probe-port.ts'
import { runSharedAssertions } from '../../src/testing/conformance.ts'
import { mcpContract } from '../schemas/fixtures/mcp-contract.ts'
import { createMcpProbeSubject } from './mcp-probe-subject.ts'

const FIXTURE_PATH = fileURLToPath(
	new URL('./fixtures/mcp-probe-fixture.mjs', import.meta.url),
)

const LAUNCHER_PATH = fileURLToPath(
	new URL('./fixtures/mcp-launcher-fixture.mjs', import.meta.url),
)

/**
 * Where each launcher records the pid of the server it started. A fresh
 * directory per run, so two checkouts or a watch beside a CI run cannot read
 * each other's pid and assert against the wrong process.
 */
const PID_DIR = mkdtempSync(join(tmpdir(), 'eval-quality-mcp-'))
const CAPPED_PID_FILE = join(PID_DIR, 'capped.pid')
const ABORTED_PID_FILE = join(PID_DIR, 'aborted.pid')

/** Every grandchild any case in this file started, killed after the run whatever the assertions did. */
const startedGrandchildren = [CAPPED_PID_FILE, ABORTED_PID_FILE]

afterAll(() => {
	for (const file of startedGrandchildren) {
		try {
			process.kill(Number(readFileSync(file, 'utf8')), 'SIGKILL')
		} catch {
			// Already gone, or never started: both are the wanted end state.
		}
	}
	rmSync(PID_DIR, { recursive: true, force: true })
})

const MAX_ELAPSED_MS = 5000
const MAX_OUTPUT_BYTES = 8192
const TIGHT_ELAPSED_MS = 300

const TOOLS = [
	'search_notes',
	'create_note',
	'env_tool',
	'failing_tool',
	'rpc_error_tool',
	'oversize_tool',
	'noisy_tool',
	'silent_tool',
	'crash_tool',
	'signal_tool',
	'farewell_tool',
	'garbage_tool',
	'log_line_tool',
	'chatty_tool',
	'relayed_tool',
	'unframed_tool',
	'split_tool',
]

const DECLARED_TOKEN = 'token-from-the-mapping'
const HOST_ONLY = 'EVAL_QUALITY_HOST_ONLY'

const serverAt = (
	interfaceId: string,
	overrides: {
		readonly targetArgs?: readonly string[]
		readonly target?: string
		readonly tools?: readonly string[]
		readonly maxElapsedMs?: number
		readonly cwd?: string
		readonly serverEnvironment?: Record<string, string>
	} = {},
) => ({
	interfaceId,
	target: overrides.target ?? process.execPath,
	targetArgs: [...(overrides.targetArgs ?? [FIXTURE_PATH])],
	tools: [...(overrides.tools ?? TOOLS)],
	cwd: overrides.cwd ?? process.cwd(),
	serverEnvironment: overrides.serverEnvironment ?? {},
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
		serverAt('crash-on-initialize-server', {
			targetArgs: [FIXTURE_PATH, '--crash-on-initialize'],
			tools: ['search_notes'],
		}),
		serverAt('exit-after-initialize-server', {
			targetArgs: [FIXTURE_PATH, '--exit-after-initialize'],
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
		serverAt('launching-server', {
			targetArgs: [LAUNCHER_PATH, CAPPED_PID_FILE, '--linger'],
			tools: ['hanging_tool'],
			maxElapsedMs: TIGHT_ELAPSED_MS,
		}),
		serverAt('launching-slow-server', {
			targetArgs: [LAUNCHER_PATH, ABORTED_PID_FILE, '--linger'],
			tools: ['hanging_tool'],
		}),
		serverAt('refusing-server', {
			targetArgs: [FIXTURE_PATH, '--refuse-initialize'],
			tools: ['search_notes'],
		}),
		serverAt('mute-server', {
			targetArgs: [FIXTURE_PATH, '--empty-initialize'],
			tools: ['search_notes'],
		}),
		// The one entry whose environment and working directory are declared
		// rather than inherited, which is the pair AD-18 designates for
		// authorization material.
		serverAt('scoped-server', {
			tools: ['env_tool'],
			cwd: tmpdir(),
			serverEnvironment: { NOTES_TOKEN: DECLARED_TOKEN },
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

/** `runPortMethod` maps every non-fault throw to one `port-failure` with one message, so the cause is where the session says what actually happened. */
const alive = (pid: number): boolean => {
	try {
		// Signal 0 checks for existence without delivering anything.
		process.kill(pid, 0)
		return true
	} catch {
		return false
	}
}

/** A killed process is reaped asynchronously, so this polls rather than reading once. */
const isDeadWithin = async (
	pid: number,
	budgetMs: number,
): Promise<boolean> => {
	const until = Date.now() + budgetMs
	while (Date.now() < until) {
		if (!alive(pid)) return true
		await new Promise((settle) => setTimeout(settle, 25))
	}
	return !alive(pid)
}

const causeMessage = (fault: RuntimeFault): string =>
	fault.cause instanceof Error ? fault.cause.message : String(fault.cause)

const mcpObservation = (observation: ProbeObservation) => {
	if (observation.kind !== 'mcp')
		throw new Error('this adapter answers with a tool-call observation')
	return observation
}

/**
 * Speaks the fixture's own protocol with no adapter in the way, to prove the
 * fixture really refuses a tool call before the handshake. Every success case
 * below rests on that refusal: without it an adapter that skipped `initialize`
 * would pass all of them.
 */
function callWithoutHandshake(): Promise<string> {
	return new Promise((settle, fail) => {
		const child = spawn(process.execPath, [FIXTURE_PATH], { stdio: 'pipe' })
		let out = ''
		child.stdout.on('data', (chunk: Buffer) => {
			out += chunk.toString('utf8')
			if (out.includes('\n')) {
				child.kill('SIGKILL')
				settle(out)
			}
		})
		child.once('error', fail)
		child.stdin.write(
			`${JSON.stringify({
				jsonrpc: '2.0',
				id: 7,
				method: 'tools/call',
				params: { name: 'search_notes', arguments: { query: 'alpha' } },
			})}\n`,
		)
	})
}

describe('the fixture server', () => {
	it('refuses a tool call that arrives before the handshake', async () => {
		const answer = JSON.parse(await callWithoutHandshake()) as {
			error?: { code: number; message: string }
		}
		expect(answer.error?.code).toBe(-32002)
		expect(answer.error?.message).toBe('server not initialized')
	})
})

describe('an authorized tool call', () => {
	// The result value below is the handshake assertion. The fixture answers
	// `tools/call` with `server not initialized` until it has seen
	// `initialize`, so a tool result at all proves the session was opened, and
	// deleting the handshake from the adapter turns this case red.
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

	// AD-18 puts authorization material on the mapping, so what the server is
	// launched with is the mapping's business and nothing else's. The assertion
	// is over the exact key set: a base of the host's own PATH plus what the
	// authorization declares, and no other host variable.
	it('launches the server with the declared environment and working directory', async () => {
		// A marker the host process carries and the mapping does not declare.
		// Spreading `process.env` into the child is the mutation this catches,
		// and the operating system's own injected names (macOS adds one) make a
		// whole-key-set comparison unportable.
		process.env[HOST_ONLY] = 'this must not reach the server'
		let observed: McpProbeObservation
		try {
			observed = mcpObservation(
				await probeFor({
					probeId: 'scoped',
					interfaceId: 'scoped-server',
					toolName: 'env_tool',
					arguments: {},
				}),
			)
		} finally {
			delete process.env[HOST_ONLY]
		}
		if (observed.result.kind !== 'json')
			throw new Error('the tool returns a structured result')
		const value = observed.result.value as {
			env: Record<string, string>
			cwd: string
		}
		expect(value.env.NOTES_TOKEN).toBe(DECLARED_TOKEN)
		expect(value.env.PATH).toBe(process.env.PATH)
		expect(value.env[HOST_ONLY]).toBeUndefined()
		expect(value.env.HOME).toBeUndefined()
		expect(realpathSync(value.cwd)).toBe(realpathSync(tmpdir()))
		expect(value.cwd).not.toBe(process.cwd())
	})

	// The transport frames one message per line, and a server that wrote a
	// whole frame and closed without the newline has still answered.
	it('reads a complete frame that arrives with no trailing newline', async () => {
		const observed = mcpObservation(
			await probeFor({ probeId: 'unframed', toolName: 'unframed_tool' }),
		)
		expect(observed.isError).toBe(false)
		expect(observed.result).toEqual({
			kind: 'json',
			value: { ok: true, framed: false },
		})
	})

	// A chunk boundary inside a multi-byte character is silent corruption:
	// `JSON.parse` still succeeds, and the mangled value lands in the body an
	// oracle asserts on and the fixture digest covers.
	it('reassembles a frame split inside a multi-byte character', async () => {
		const observed = mcpObservation(
			await probeFor({ probeId: 'split', toolName: 'split_tool' }),
		)
		expect(observed.result).toEqual({
			kind: 'json',
			value: { ok: true, label: 'café-日本-🎯' },
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
})

describe('a session the server ends before it answers the tool call', () => {
	// The tool-call twin of a command that crashes. The oracles over a command
	// step judge its exit code, and a crash mutation on a tool server is caught
	// only if the same is true here.
	it("resolves a server that exits mid-call as an error observation carrying the process's exit code", async () => {
		const observed = mcpObservation(
			await probeFor({ probeId: 'crashing', toolName: 'crash_tool' }),
		)
		expect(observed).toEqual({
			kind: 'mcp',
			probeId: 'crashing',
			interfaceId: 'notes-tool-server',
			operationId: 'crashing',
			isError: true,
			result: { kind: 'absent' },
			exitCode: 3,
		})
	})

	// Negative on a command's convention: a process a signal ended reads as the
	// negated signal number.
	it('reads a server a signal ended as a negative exit code', async () => {
		const observed = mcpObservation(
			await probeFor({ probeId: 'signalled', toolName: 'signal_tool' }),
		)
		expect(observed).toMatchObject({
			isError: true,
			result: { kind: 'absent' },
			exitCode: -osConstants.signals.SIGTERM,
		})
	})

	// The server exiting right after answering has answered, and reading its
	// exit as the end of the session would report a crash that did not happen.
	it('keeps a server that answers and then exits an answered call with no exit code', async () => {
		const observed = mcpObservation(
			await probeFor({ probeId: 'farewell', toolName: 'farewell_tool' }),
		)
		expect(observed.isError).toBe(false)
		expect(observed.result).toEqual({
			kind: 'json',
			value: { ok: true, farewell: true },
		})
		expect('exitCode' in observed).toBe(false)
	})

	// A launcher exits while the process it started, holding the same stdout,
	// goes on to write the answer. The session ends when the pipes close and not
	// when the direct process exits, so this is an answered call. Listening for
	// `exit` instead of `close` reads the launcher's status as a crash.
	it('keeps an answer written by a process the server started, after the server exited, an answered call', async () => {
		const observed = mcpObservation(
			await probeFor({ probeId: 'relayed', toolName: 'relayed_tool' }),
		)
		expect(observed).toStrictEqual({
			kind: 'mcp',
			probeId: 'relayed',
			interfaceId: 'notes-tool-server',
			operationId: 'relayed',
			isError: false,
			result: { kind: 'json', value: { ok: true, relayed: true } },
		})
	})

	it('keeps a complete frame with no trailing newline followed by an exit an answered call', async () => {
		const observed = mcpObservation(
			await probeFor({ probeId: 'unframed-exit', toolName: 'unframed_tool' }),
		)
		expect(observed.isError).toBe(false)
		expect('exitCode' in observed).toBe(false)
	})

	it('carries no exit code on an answered call, tool error or not', async () => {
		for (const toolName of ['search_notes', 'failing_tool', 'rpc_error_tool']) {
			const observed = mcpObservation(
				await probeFor({
					probeId: `answered-${toolName.replaceAll('_', '-')}`,
					toolName,
				}),
			)
			expect('exitCode' in observed).toBe(false)
		}
	})

	// The handshake completed, so the session was open; the server then ended
	// it before any tool call reached it.
	it('resolves a server that exits after the handshake and before the call arrives', async () => {
		const observed = mcpObservation(
			await probeFor({
				probeId: 'exit-after-initialize',
				interfaceId: 'exit-after-initialize-server',
			}),
		)
		expect(observed).toMatchObject({
			isError: true,
			result: { kind: 'absent' },
			exitCode: 3,
		})
	})

	// The observation parses against the port's own response schema, so a
	// harness reading it through the port sees the field, and it is an integer.
	it('is a schema-valid observation only with an integer exit code', () => {
		const ended = {
			kind: 'mcp',
			probeId: 'p',
			interfaceId: 'notes-tool-server',
			operationId: 'p',
			isError: true,
			result: { kind: 'absent' },
			exitCode: -9,
		}
		expect(probeParsers.response.safeParse(ended).success).toBe(true)
		const { exitCode: _omitted, ...answered } = ended
		expect(probeParsers.response.safeParse(answered).success).toBe(true)
		expect(
			probeParsers.response.safeParse({ ...ended, exitCode: 1.5 }).success,
		).toBe(false)
	})

	// An exit code marks a session the server ended before answering, which is
	// an error with nothing returned. The union enforces it, so a scripted
	// mechanism or a hand-written observation cannot say otherwise.
	it('rejects an exit code beside an answered call or a returned result', () => {
		const ended = {
			kind: 'mcp',
			probeId: 'p',
			interfaceId: 'notes-tool-server',
			operationId: 'p',
			isError: true,
			result: { kind: 'absent' },
			exitCode: 3,
		}
		for (const contradicting of [
			{ ...ended, isError: false },
			{ ...ended, result: { kind: 'json', value: { ok: true } } },
			{ ...ended, isError: false, result: { kind: 'json', value: null } },
		]) {
			for (const parser of [probeParsers.response, ProbeObservation]) {
				const parsed = parser.safeParse(contradicting)
				expect(parsed.success).toBe(false)
				expect(parsed.error?.issues[0]?.path).toEqual(['exitCode'])
			}
		}
		expect(ProbeObservation.safeParse(ended).success).toBe(true)
	})

	// The mechanism is swappable, so the conformance subject and any other
	// scripted mechanism can report the ended session without a process.
	it('turns a scripted ended-session result into the same observation', async () => {
		// Both result types are named on the subpath a consumer imports.
		const endedSession: McpEndedSession = { isError: true, exitCode: 7 }
		const answeredCall: McpAnsweredCall = { isError: false }
		const scripted = createMcpAdapter(policy, {
			callTool: () => Promise.resolve(endedSession),
		})
		const observed = mcpObservation(
			await scripted.probe(
				request({ probeId: 'scripted' }),
				new AbortController().signal,
			),
		)
		expect(observed).toMatchObject({
			isError: true,
			result: { kind: 'absent' },
			exitCode: 7,
		})
		const answering = createMcpAdapter(policy, {
			callTool: () => Promise.resolve(answeredCall),
		})
		expect(
			'exitCode' in
				mcpObservation(
					await answering.probe(
						request({ probeId: 'scripted-answer' }),
						new AbortController().signal,
					),
				),
		).toBe(false)
	})
})

describe('a session that never opens', () => {
	// A server answering `initialize` with a JSON-RPC error has refused the
	// session, so nothing observed the system and the pre-flight has no answer
	// to score. Resolving here would report a failed clean-control check for
	// what is a port failure.
	it('reports a refused initialize as a port failure, never as an observation', async () => {
		const fault = await faultOf(() =>
			probeFor({ probeId: 'refused', interfaceId: 'refusing-server' }),
		)
		expect(fault.code).toBe('port-failure')
		expect(causeMessage(fault)).toContain('refused the initialize handshake')
		expect(causeMessage(fault)).toContain('unsupported protocol version')
	})

	// JSON-RPC requires exactly one of `result` and `error`, so a frame with
	// neither is malformed. Reading it as consent would open a session on a
	// server that said nothing about whether it accepted one.
	it('reports an initialize answer carrying neither a result nor an error as a port failure', async () => {
		const fault = await faultOf(() =>
			probeFor({ probeId: 'mute', interfaceId: 'mute-server' }),
		)
		expect(fault.code).toBe('port-failure')
		expect(causeMessage(fault)).toBe(
			'the server answered the initialize handshake with neither a result nor an error',
		)
	})
})

describe('the policy, applied before a server process starts', () => {
	it('refuses an interface the mapping does not name', async () => {
		const fault = await faultOf(() =>
			probeFor({ probeId: 'unmapped-interface', interfaceId: 'other-server' }),
		)
		expect(fault.code).toBe('forbidden-target')
		expect(fault.reason).toBe('interface-not-authorized')
		expect(fault.message).toContain('other-server')
	})

	it('refuses a tool the authorization does not list', async () => {
		const fault = await faultOf(() =>
			probeFor({ probeId: 'unmapped-tool', toolName: 'delete_everything' }),
		)
		expect(fault.code).toBe('forbidden-target')
		expect(fault.reason).toBe('tool-not-authorized')
		expect(fault.message).toContain('delete_everything')
	})

	// The denial happens before anything spawns, which is what a counting
	// mechanism can prove: a refused request reaches no mechanism at all.
	it('denies before the mechanism is reached', async () => {
		let calls = 0
		const counting: McpMechanism = {
			callTool: () => {
				calls++
				return Promise.resolve({ isError: false })
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
			// The same denial an unmapped interfaceId meets, so the same reason.
			expect(fault.reason).toBe('interface-not-authorized')
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

	// All four resolve to `port-failure`, because `runPortMethod` maps every
	// non-fault throw to it. Each is read on the cause it carries, so a
	// TypeError from a bug anywhere inside the session cannot satisfy them.
	it('reports a server that fails to start as a port failure, never as a denial', async () => {
		const fault = await faultOf(() =>
			probeFor({ probeId: 'missing', interfaceId: 'missing-server' }),
		)
		expect(fault.code).toBe('port-failure')
		expect(causeMessage(fault)).toContain('ENOENT')
	})

	it('reports a server that exits before the handshake as a port failure', async () => {
		const fault = await faultOf(() =>
			probeFor({ probeId: 'exiting', interfaceId: 'exiting-server' }),
		)
		expect(fault.code).toBe('port-failure')
		expect(causeMessage(fault)).toBe('the server exited during initialize')
	})

	// The same event one phase earlier than a tool call: the server read
	// `initialize` and died without answering, so the session never opened.
	it('reports a server that exits while answering the handshake as a port failure', async () => {
		const fault = await faultOf(() =>
			probeFor({
				probeId: 'crash-on-initialize',
				interfaceId: 'crash-on-initialize-server',
			}),
		)
		expect(fault.code).toBe('port-failure')
		expect(causeMessage(fault)).toBe('the server exited during initialize')
	})

	it('reports bytes on stdout that are not a JSON-RPC message as a port failure', async () => {
		const fault = await faultOf(() =>
			probeFor({ probeId: 'garbage', interfaceId: 'garbage-server' }),
		)
		expect(fault.code).toBe('port-failure')
		expect(causeMessage(fault)).toContain('not a JSON-RPC message')
	})

	// The same line one phase later, from a server that then exits. The
	// observation records how the process ended the session, and this session
	// ended on a malformed frame first, so it stays a fault at every phase.
	it('reports a malformed line during the tool call as a port failure even when the server then exits', async () => {
		const fault = await faultOf(() =>
			probeFor({ probeId: 'garbage-mid-call', toolName: 'garbage_tool' }),
		)
		expect(fault.code).toBe('port-failure')
		expect(causeMessage(fault)).toContain('not a JSON-RPC message')
	})

	// A line that parses as JSON is still no JSON-RPC message unless it is an
	// object carrying `jsonrpc: '2.0'`. A server that logs a JSON line on stdout
	// and then exits has ended its session on a malformed frame, exactly as one
	// that logs plain text has.
	it.each([
		['a structured log line', '{"level":30,"msg":"about to crash"}'],
		['an array', '[1,2,3]'],
		['a string', '"about to crash"'],
		['a number', '42'],
		['null', 'null'],
		['an object naming another protocol version', '{"jsonrpc":"1.0","id":2}'],
	])(
		'reports %s on stdout as a port failure even when the server then exits',
		async (_label, line) => {
			const fault = await faultOf(() =>
				probeFor({
					probeId: 'json-log-mid-call',
					toolName: 'log_line_tool',
					arguments: { line },
				}),
			)
			expect(fault.code).toBe('port-failure')
			expect(causeMessage(fault)).toContain('not a JSON-RPC message')
		},
	)

	// Requests and notifications the server makes carry `jsonrpc: '2.0'`. They
	// are legal, answer nothing the client asked, and are ignored.
	it('ignores a notification and a request the server makes, and reads the answer after them', async () => {
		const observed = mcpObservation(
			await probeFor({ probeId: 'chatty', toolName: 'chatty_tool' }),
		)
		expect(observed.isError).toBe(false)
		expect(observed.result).toEqual({
			kind: 'json',
			value: { ok: true, chatty: true },
		})
	})

	// Teardown kills the process group, so a launcher's grandchild goes with it.
	// `npx -y <server>` is the ordinary MCP launch shape, so killing the direct
	// child alone would leave the server running after the cap fired, which is
	// the state this adapter's one-session rule exists to prevent.
	it('tears down a server the authorized target only launched', async () => {
		rmSync(CAPPED_PID_FILE, { force: true })
		const fault = await faultOf(() =>
			probeFor({
				probeId: 'launched',
				interfaceId: 'launching-server',
				toolName: 'hanging_tool',
			}),
		)
		expect(fault.code).toBe('budget-exhausted')
		const grandchild = Number(readFileSync(CAPPED_PID_FILE, 'utf8'))
		expect(Number.isInteger(grandchild)).toBe(true)
		expect(await isDeadWithin(grandchild, 2000)).toBe(true)
	})

	// The same teardown down the abort path, which reaches `close()` from the
	// mechanism's `finally` after the signal has already killed the direct
	// child. A process group outlives its leader while any member is alive, so
	// the negative pid still reaches the grandchild; this is what proves it.
	it('tears down a launched server when the caller aborts instead', async () => {
		rmSync(ABORTED_PID_FILE, { force: true })
		const controller = new AbortController()
		const pending = port.probe(
			request({
				probeId: 'aborted-launch',
				interfaceId: 'launching-slow-server',
				toolName: 'hanging_tool',
			}),
			controller.signal,
		)
		// Aborted once the server is running, however long the launch took.
		const until = Date.now() + 10_000
		while (!existsSync(ABORTED_PID_FILE) && Date.now() < until) {
			await new Promise((settle) => setTimeout(settle, 25))
		}
		controller.abort()
		const fault = await faultOf(() => pending)
		expect(fault.code).toBe('aborted')
		const grandchild = Number(readFileSync(ABORTED_PID_FILE, 'utf8'))
		expect(Number.isInteger(grandchild)).toBe(true)
		expect(await isDeadWithin(grandchild, 2000)).toBe(true)
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
 * The shared six over the real adapter, from the reusable subject the mcp
 * conformance arm certifies. This file used to build its own `PortSubject`
 * with its own copy of the scenario scripting, because the `mcp-probe` count
 * entry the arm needs did not exist yet. It does now, and one copy of the
 * scripting is what keeps the shared-six result describing the same subject
 * the arm reports on.
 */
describe("AD-37's six shared assertions", () => {
	it('all six pass against the shipped adapter', async () => {
		const outcomes = await runSharedAssertions(
			'probe',
			createMcpProbeSubject(),
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

/**
 * The stdio mechanism takes abort over from spawn's own `signal` option and
 * closes its end of the server's pipes at teardown. Driven directly, since
 * `nodeStdioMcpMechanism` is exported and its rejection shape is part of that.
 */
describe.skipIf(process.platform === 'win32')(
	'nodeStdioMcpMechanism, abort and teardown',
	() => {
		const callRequest = (
			overrides: Partial<McpCallToolRequest> = {},
		): McpCallToolRequest => ({
			target: process.execPath,
			targetArgs: [FIXTURE_PATH],
			toolName: 'hanging_tool',
			arguments: {},
			env: { PATH: process.env.PATH ?? '' },
			cwd: process.cwd(),
			maxElapsedMs: MAX_ELAPSED_MS,
			maxOutputBytes: MAX_OUTPUT_BYTES,
			...overrides,
		})

		const abortErrorOf = async (
			pending: Promise<unknown>,
		): Promise<Error & { code?: unknown }> => {
			const error = await pending.then(
				() => undefined,
				(thrown: unknown) => thrown,
			)
			expect(error).toBeInstanceOf(Error)
			return error as Error & { code?: unknown }
		}

		it('rejects with the AbortError shape spawn produced, mid-run', async () => {
			const controller = new AbortController()
			const reason = new Error('caller gave up')
			const pending = nodeStdioMcpMechanism.callTool(
				callRequest(),
				controller.signal,
			)
			setTimeout(() => controller.abort(reason), 200)
			const error = await abortErrorOf(pending)
			expect(error.name).toBe('AbortError')
			expect(error.constructor.name).toBe('AbortError')
			expect(error.code).toBe('ABORT_ERR')
			expect(error.cause).toBe(reason)
		})

		it('rejects with the AbortError shape spawn produced, pre-aborted', async () => {
			const controller = new AbortController()
			const reason = new Error('aborted before the call')
			controller.abort(reason)
			const error = await abortErrorOf(
				nodeStdioMcpMechanism.callTool(callRequest(), controller.signal),
			)
			expect(error.name).toBe('AbortError')
			expect(error.constructor.name).toBe('AbortError')
			expect(error.code).toBe('ABORT_ERR')
			expect(error.cause).toBe(reason)
		})

		// Spawn's own `signal` option removes its listener only on 'exit', which
		// a failed spawn never emits, so a reused signal collected one per call.
		it('leaves no listener on a reused signal after a failed spawn', async () => {
			const controller = new AbortController()
			const missing = join(PID_DIR, 'no-such-server')
			for (let attempt = 0; attempt < 3; attempt++) {
				await expect(
					nodeStdioMcpMechanism.callTool(
						callRequest({ target: missing, targetArgs: [] }),
						controller.signal,
					),
				).rejects.toMatchObject({ code: 'ENOENT' })
			}
			expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0)
		})

		// A server in a session of its own is out of reach of the group kill and
		// still holds the inherited stdout. Teardown closes this end, so the
		// host exits once the call is over rather than when the server does.
		it('lets the host exit when a server outside the group holds its stdout', async () => {
			const pidFile = join(PID_DIR, 'escaped.pid')
			const adapterPath = fileURLToPath(
				new URL('../../src/adapters/mcp-adapter.ts', import.meta.url),
			)
			const host = `
				import { nodeStdioMcpMechanism } from ${JSON.stringify(adapterPath)}
				await nodeStdioMcpMechanism.callTool({
					target: process.execPath,
					targetArgs: [${JSON.stringify(LAUNCHER_PATH)}, ${JSON.stringify(pidFile)}, '--escape', '--linger'],
					toolName: 'search_notes',
					arguments: { query: 'x' },
					env: { PATH: process.env.PATH ?? '' },
					cwd: process.cwd(),
					maxElapsedMs: 10000,
					maxOutputBytes: 65536,
				}, new AbortController().signal)
			`
			const started = Date.now()
			try {
				// Bounded, so a host the pipe keeps alive fails the assertion below
				// and still reaches the cleanup, instead of timing the case out.
				const exitCode = await new Promise<number | null>((settle) => {
					const child = spawn(
						process.execPath,
						['--input-type=module', '-e', host],
						{ stdio: 'ignore' },
					)
					const limit = setTimeout(() => child.kill('SIGKILL'), 8000)
					child.once('close', (code) => {
						clearTimeout(limit)
						settle(code)
					})
				})
				expect(exitCode).toBe(0)
				expect(Date.now() - started).toBeLessThan(5000)
			} finally {
				// Guarded, so a host that failed before the launcher wrote the pid
				// reports its own failure rather than this read's ENOENT.
				if (existsSync(pidFile)) {
					const pid = Number(readFileSync(pidFile, 'utf8'))
					if (Number.isInteger(pid) && pid > 0) process.kill(pid, 'SIGKILL')
				}
			}
		}, 20_000)

		// The server runs in a session of its own, which a signal to the host's
		// group no longer reaches, and `SIGKILL` runs no exit hook. The group
		// leader's lifeline closes however the host ends.
		it('takes the launcher and its server down when the host is killed with SIGKILL', async () => {
			const pidFile = join(PID_DIR, 'host-killed.pid')
			// Created once the server holds the hanging call, so it writes nothing
			// after the host dies: a server killed by EPIPE on a late answer would
			// pass this case without any lifeline.
			const readyFile = join(PID_DIR, 'host-killed.ready')
			const adapterPath = fileURLToPath(
				new URL('../../src/adapters/mcp-adapter.ts', import.meta.url),
			)
			const host = `
				import { nodeStdioMcpMechanism } from ${JSON.stringify(adapterPath)}
				await nodeStdioMcpMechanism.callTool({
					target: process.execPath,
					targetArgs: [${JSON.stringify(LAUNCHER_PATH)}, ${JSON.stringify(pidFile)}, '--linger', '--ready-file', ${JSON.stringify(readyFile)}],
					toolName: 'hanging_tool',
					arguments: {},
					env: { PATH: process.env.PATH ?? '' },
					cwd: process.cwd(),
					maxElapsedMs: 30000,
					maxOutputBytes: 65536,
				}, new AbortController().signal)
			`
			const child = spawn(
				process.execPath,
				['--input-type=module', '-e', host],
				{ stdio: 'ignore', detached: true },
			)
			const closed = new Promise<void>((settle) =>
				child.once('close', () => settle()),
			)
			const until = Date.now() + 10_000
			while (!existsSync(readyFile) && Date.now() < until) {
				await new Promise((settle) => setTimeout(settle, 25))
			}
			const launcher = Number(readFileSync(`${pidFile}.launcher`, 'utf8'))
			const server = Number(readFileSync(pidFile, 'utf8'))
			expect(launcher > 0 && server > 0).toBe(true)
			try {
				process.kill(child.pid as number, 'SIGKILL')
				await closed
				expect(await isDeadWithin(launcher, 3000)).toBe(true)
				expect(await isDeadWithin(server, 3000)).toBe(true)
			} finally {
				for (const pid of [launcher, server]) {
					if (alive(pid)) process.kill(pid, 'SIGKILL')
				}
			}
		})

		it('stops tracking a server once the session is over', async () => {
			await expect(
				nodeStdioMcpMechanism.callTool(
					callRequest({ toolName: 'search_notes', arguments: { query: 'x' } }),
					new AbortController().signal,
				),
			).resolves.toBeDefined()
			const until = Date.now() + 2000
			while (trackedProcessCount() > 0 && Date.now() < until) {
				await new Promise((settle) => setTimeout(settle, 25))
			}
			expect(trackedProcessCount()).toBe(0)
		})

		// The mechanism reports the ended session itself, so a caller that is
		// not the shipped adapter reads the same shape a scripted mechanism
		// returns.
		it('resolves an ended session as an error carrying the signed exit code', async () => {
			await expect(
				nodeStdioMcpMechanism.callTool(
					callRequest({ toolName: 'crash_tool' }),
					new AbortController().signal,
				),
			).resolves.toEqual({ isError: true, exitCode: 3 })
			await expect(
				nodeStdioMcpMechanism.callTool(
					callRequest({ toolName: 'signal_tool' }),
					new AbortController().signal,
				),
			).resolves.toEqual({
				isError: true,
				exitCode: -osConstants.signals.SIGTERM,
			})
		})

		// The watchdog is the harness's own process. When something kills it while
		// the server runs, the group goes down with it, and reporting that as the
		// server ending with SIGKILL would record a harness-side kill as the server
		// crashing. Nothing observed the server, so the run is a fault.
		it('reports a watchdog killed while the server runs as a fault, never as the server ending the session', async () => {
			const pidFile = join(PID_DIR, 'watchdog-killed.pid')
			const readyFile = join(PID_DIR, 'watchdog-killed.ready')
			rmSync(readyFile, { force: true })
			const pending = nodeStdioMcpMechanism
				.callTool(
					callRequest({
						target: process.execPath,
						targetArgs: [
							LAUNCHER_PATH,
							pidFile,
							'--linger',
							'--ready-file',
							readyFile,
						],
						toolName: 'hanging_tool',
						maxElapsedMs: 30_000,
					}),
					new AbortController().signal,
				)
				.then(
					(observed) => ({ observed }),
					(thrown: unknown) => ({ thrown }),
				)
			const until = Date.now() + 10_000
			while (!existsSync(readyFile) && Date.now() < until) {
				await new Promise((settle) => setTimeout(settle, 25))
			}
			const launcher = Number(readFileSync(`${pidFile}.launcher`, 'utf8'))
			const server = Number(readFileSync(pidFile, 'utf8'))
			// The launcher is the group leader the watchdog started, so its parent is
			// the watchdog.
			const watchdog = Number(
				execFileSync('ps', ['-o', 'ppid=', '-p', String(launcher)], {
					encoding: 'utf8',
				}).trim(),
			)
			expect(watchdog).toBeGreaterThan(1)
			expect(watchdog).not.toBe(process.pid)
			try {
				process.kill(watchdog, 'SIGKILL')
				const outcome = await pending
				expect(outcome).not.toHaveProperty('observed')
				const { thrown } = outcome as { thrown: unknown }
				expect(thrown).toBeInstanceOf(Error)
				expect((thrown as Error).message).toContain('watchdog')
				expect(await isDeadWithin(launcher, 3000)).toBe(true)
				expect(await isDeadWithin(server, 3000)).toBe(true)
			} finally {
				for (const pid of [launcher, server, watchdog]) {
					if (alive(pid)) process.kill(pid, 'SIGKILL')
				}
			}
		}, 20_000)

		it('keeps every ceiling and refusal a rejection when the session would otherwise have ended', async () => {
			const capped = await nodeStdioMcpMechanism
				.callTool(
					callRequest({ toolName: 'hanging_tool', maxElapsedMs: 300 }),
					new AbortController().signal,
				)
				.then(
					() => undefined,
					(thrown: unknown) => thrown,
				)
			expect(capped).toBeInstanceOf(RuntimeFault)
			expect((capped as RuntimeFault).code).toBe('budget-exhausted')
			await expect(
				nodeStdioMcpMechanism.callTool(
					callRequest({
						toolName: 'search_notes',
						targetArgs: [FIXTURE_PATH, '--refuse-initialize'],
					}),
					new AbortController().signal,
				),
			).rejects.toThrow('refused the initialize handshake')
		})
	},
)
