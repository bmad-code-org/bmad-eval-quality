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
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
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
	McpProbeObservation,
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

	// The same event one phase later. Without the phase in the message a crash
	// at launch and a crash mid-call read identically.
	it('names the phase when a server exits during the tool call', async () => {
		const fault = await faultOf(() =>
			probeFor({ probeId: 'crashing', toolName: 'crash_tool' }),
		)
		expect(fault.code).toBe('port-failure')
		expect(causeMessage(fault)).toBe('the server exited during tools/call')
	})

	it('reports bytes on stdout that are not a JSON-RPC message as a port failure', async () => {
		const fault = await faultOf(() =>
			probeFor({ probeId: 'garbage', interfaceId: 'garbage-server' }),
		)
		expect(fault.code).toBe('port-failure')
		expect(causeMessage(fault)).toContain('not a JSON-RPC message')
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
		setTimeout(() => {
			controller.abort()
		}, 200)
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
