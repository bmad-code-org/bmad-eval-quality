/**
 * The environment-probe port over one MCP tool call, for the `mcp` mechanism.
 * `evaluateMcpTarget` closes the authorization half; this file closes the
 * execution half.
 *
 * Every rule below is what "what's a tool server allowed to do" resolves to, a
 * decision settled here in the implementation, with no architecture revision
 * behind it:
 *
 * 1. stdio, and no other transport. MCP defines two: stdio launches the server
 *    as a subprocess and speaks JSON-RPC over its standard streams, and
 *    Streamable HTTP speaks the same JSON-RPC over HTTP to a URL. AD-2 is
 *    unconditional that no module in the package performs network I/O and that
 *    v0 ships no network adapter at all, and its own history says that
 *    exception was deleted rather than narrowed. Launching a subprocess is
 *    mechanically what `command-line-adapter.ts` already does and opens no
 *    socket. A server behind a URL is the caller's own `EnvironmentProbePort`,
 *    proven with AD-37's suite, which is the same division that leaves `api`
 *    with no reference adapter here.
 * 2. `target` is spawned directly with an argv array (`shell: false`, Node's
 *    own default, stated anyway since it is the one thing this adapter must
 *    never turn off). The tool's arguments travel inside the JSON-RPC frame
 *    and never as argv, so no channel value reaches a command line at all.
 *    `serverEnvironment` passes through as declared, over the host's own
 *    `PATH` so a `target` naming a bare command still resolves; a declared
 *    `PATH` key wins over that default. Nothing else of the host environment
 *    reaches the server.
 * 3. One session per port invocation, opened and torn down inside `callTool`.
 *    AD-37's `single-underlying-call-on-success` counts the underlying
 *    mechanism, so a session reused across invocations would make the count
 *    depend on which one ran first. AD-35's caps are per-invocation, and a
 *    session held across legs leaves a hung server with no cap to catch it on
 *    the legs that follow. AD-10's state-reset differential compares two legs
 *    that must describe the same fixture state, so adapter-side state carried
 *    between them is a confound on the one measurement it exists to make.
 *    `maxElapsedMs` bounds the whole invocation, from launch through
 *    `initialize`, `tools/call`, and teardown: a handshake that never
 *    completes and a tool call that never answers are the same event to the
 *    caller. `maxOutputBytes` applies to the server's stdout and, separately,
 *    to its stderr, which the stdio transport reserves for logging; an
 *    undrained stderr pipe deadlocks the server once the OS buffer fills, and
 *    a drained one with no cap is an unbounded allocation. Teardown closes the
 *    server's stdin and then kills its whole process group: `npx -y <server>`
 *    is the ordinary launch shape, so killing the direct child alone leaves
 *    the server it started running, which is the state this rule exists to
 *    prevent.
 * 4. A tool result carrying `isError: true` is an observation, and so is a
 *    JSON-RPC error answering `tools/call`. The server answered, and a server
 *    refusing a tool the contract declares is precisely the defect an oracle
 *    should be able to assert on; throwing would make it invisible. A server
 *    that refuses the `initialize` handshake answered a different question:
 *    the session never opened, so nothing observed the system, and that throws
 *    `port-failure` alongside a failure to start and a malformed frame. Only a
 *    policy denial, a cap, an abort, or a failure to establish the session
 *    throws.
 */
import { type ChildProcess, spawn } from 'node:child_process'
import { StringDecoder } from 'node:string_decoder'
import { RuntimeFault } from '../core/schemas/faults.ts'
import type {
	McpProbeObservation,
	McpProbeRequest,
	ProbeRequest,
} from '../core/schemas/port-messages.ts'
import type { JsonValue } from '../core/schemas/primitives.ts'
import type { ProbeObservedBody } from '../core/schemas/probe-body.ts'
import type { McpTargetPolicy } from '../core/schemas/probe-policy.ts'
import type { EnvironmentProbePort } from '../ports/environment-probe-port.ts'
import { probeParsers } from '../ports/environment-probe-port.ts'
import { evaluateMcpTarget } from './mcp-target-policy.ts'
import { runPortMethod } from './port-boundary.ts'

/** The protocol revision this client announces. A server free to answer with a different one has still opened the session; a server that answers with a JSON-RPC error has refused it, and rule 4 says what happens then. */
const PROTOCOL_VERSION = '2025-06-18'

const INITIALIZE_ID = 1
const CALL_TOOL_ID = 2

/** One tool call, already reduced to what an observation needs. No truncation flag: exceeding `maxOutputBytes` rejects with `budget-exhausted` rather than resolving with a partial frame. */
export type McpCallToolResult = {
	readonly isError: boolean
	/** The tool's structured result, or the JSON-RPC error object when the server answered `tools/call` with one. Absent when the call published no structured content at all, which the observation records as an absent body; a `null` here is a structured result the server really returned. */
	readonly structuredResult?: JsonValue
}

export type McpCallToolRequest = {
	readonly target: string
	readonly targetArgs: readonly string[]
	readonly toolName: string
	readonly arguments: Readonly<Record<string, JsonValue>>
	readonly env: Readonly<Record<string, string>>
	readonly cwd: string
	readonly maxElapsedMs: number
	readonly maxOutputBytes: number
}

/** Swappable so the conformance subject can spy on calls and script every scenario, matching the other four shipped adapters. One method, because one port invocation is one session (rule 3). */
export type McpMechanism = {
	readonly callTool: (
		request: McpCallToolRequest,
		signal: AbortSignal,
	) => Promise<McpCallToolResult>
}

function capped(detail: string): RuntimeFault {
	return new RuntimeFault('budget-exhausted', 'McpProbeRequest', detail)
}

function forbidden(detail: string): RuntimeFault {
	return new RuntimeFault('forbidden-target', 'ProbeRequest', detail)
}

function buildEnv(
	declared: Readonly<Record<string, string>>,
): Record<string, string> {
	const base: Record<string, string> = {}
	if (process.env.PATH !== undefined) base.PATH = process.env.PATH
	return { ...base, ...declared }
}

const isJsonObject = (value: unknown): value is Record<string, JsonValue> =>
	value !== null && typeof value === 'object' && !Array.isArray(value)

/** An answer to something this client asked. A notification carries no id, and a request the server itself makes carries a method; neither is answered here. */
type JsonRpcResponse = {
	readonly result?: JsonValue
	readonly error?: JsonValue
}

type StdioSession = {
	readonly request: (
		id: number,
		method: string,
		params: JsonValue,
	) => Promise<JsonRpcResponse>
	readonly notify: (method: string, params: JsonValue) => void
	readonly close: () => void
}

/**
 * A detached child leads its own process group, so the negative pid reaches
 * every process it started. Windows has no process groups and throws here, so
 * the direct child is the fallback.
 */
function killProcessGroup(child: ChildProcess): void {
	const { pid } = child
	if (pid === undefined) {
		child.kill('SIGKILL')
		return
	}
	try {
		process.kill(-pid, 'SIGKILL')
	} catch {
		child.kill('SIGKILL')
	}
}

/**
 * Launches the server and frames JSON-RPC over its standard streams: one
 * message per line, which is what the stdio transport specifies.
 *
 * Every way the session can die reaches the caller through one rejected
 * `failure` promise that each request races against, so a cap, a malformed
 * frame, a spawn failure, and an early exit all surface at the await that was
 * waiting on the server. A listener that rejected nothing would leave the call
 * to run out its elapsed budget for a fault already known.
 */
function startSession(
	request: McpCallToolRequest,
	signal: AbortSignal,
): StdioSession {
	const child = spawn(request.target, [...request.targetArgs], {
		cwd: request.cwd,
		env: { ...request.env },
		shell: false,
		signal,
		detached: true,
		stdio: ['pipe', 'pipe', 'pipe'],
	})

	// Keyed by the id as text: JSON-RPC admits a string id, and a server that
	// echoes `1` back as `"1"` is correlating correctly.
	const pending = new Map<string, (response: JsonRpcResponse) => void>()
	let closed = false
	let broken = false
	let phase = 'launch'
	let rejectFailure: (error: unknown) => void = () => {}
	const failure = new Promise<never>((_resolve, reject) => {
		rejectFailure = reject
	})
	// The race is usually won by a response, which leaves this rejection
	// unobserved; without the handler that is an unhandled rejection.
	failure.catch(() => {})

	const fail = (error: unknown): void => {
		if (broken) return
		broken = true
		rejectFailure(error)
	}

	const timer = setTimeout(() => {
		fail(
			capped(
				`the session exceeded maxElapsedMs (${request.maxElapsedMs}ms) during ${phase} and was torn down`,
			),
		)
	}, request.maxElapsedMs)

	let stdoutBytes = 0
	let stdoutBuffer = ''
	let stderrBytes = 0
	// Chunk boundaries fall inside multi-byte characters, and decoding each
	// chunk on its own replaces the split character with U+FFFD. The corruption
	// survives `JSON.parse`, so it would reach the observation body an oracle
	// asserts on and the fixture digest covers.
	const decoder = new StringDecoder('utf8')

	const handleLine = (line: string): void => {
		let message: unknown
		try {
			message = JSON.parse(line)
		} catch {
			fail(
				new Error(
					`the server wrote bytes on stdout that are not a JSON-RPC message: ${line.slice(0, 200)}`,
				),
			)
			return
		}
		if (!isJsonObject(message)) return
		const { id } = message
		if (typeof id !== 'number' && typeof id !== 'string') return
		if (message.method !== undefined) return
		const settle = pending.get(String(id))
		if (settle === undefined) return
		pending.delete(String(id))
		settle({ result: message.result, error: message.error })
	}

	const drainLines = (): void => {
		let newlineAt = stdoutBuffer.indexOf('\n')
		while (newlineAt !== -1) {
			const line = stdoutBuffer.slice(0, newlineAt)
			stdoutBuffer = stdoutBuffer.slice(newlineAt + 1)
			if (line.trim() !== '') handleLine(line)
			newlineAt = stdoutBuffer.indexOf('\n')
		}
	}

	child.stdout?.on('data', (chunk: Buffer) => {
		stdoutBytes += chunk.byteLength
		if (stdoutBytes > request.maxOutputBytes) {
			fail(
				capped(
					`the server wrote past maxOutputBytes (${request.maxOutputBytes}) on stdout and the session was torn down`,
				),
			)
			return
		}
		stdoutBuffer += decoder.write(chunk)
		drainLines()
	})

	// A server that wrote a whole frame and closed without a trailing newline
	// has answered, and dropping the residue would report a fault for a
	// complete response.
	child.stdout?.on('end', () => {
		stdoutBuffer += decoder.end()
		drainLines()
		const residual = stdoutBuffer
		stdoutBuffer = ''
		if (residual.trim() !== '') handleLine(residual)
	})

	// Drained rather than ignored: the transport reserves stderr for logging and
	// an unread pipe deadlocks the server once the OS buffer fills.
	child.stderr?.on('data', (chunk: Buffer) => {
		stderrBytes += chunk.byteLength
		if (stderrBytes > request.maxOutputBytes) {
			fail(
				capped(
					`the server wrote past maxOutputBytes (${request.maxOutputBytes}) on its own stderr and the session was torn down`,
				),
			)
		}
	})

	// A server that exits before reading its stdin raises EPIPE on this stream
	// rather than on `child`; with no listener that crashes the host process.
	child.stdin?.on('error', () => {})
	child.once('error', (error: unknown) => {
		fail(error)
	})
	child.once('close', () => {
		if (closed) return
		fail(new Error(`the server exited during ${phase}`))
	})

	const send = (message: Record<string, JsonValue>): void => {
		child.stdin?.write(`${JSON.stringify(message)}\n`)
	}

	return {
		request: (id, method, params) => {
			phase = method
			return Promise.race([
				new Promise<JsonRpcResponse>((settle) => {
					pending.set(String(id), settle)
					send({ jsonrpc: '2.0', id, method, params })
				}),
				failure,
			])
		},
		notify: (method, params) => {
			send({ jsonrpc: '2.0', method, params })
		},
		close: () => {
			closed = true
			// Set here too, so a late over-cap chunk or a malformed residual line
			// arriving after teardown cannot reject a settled session.
			broken = true
			clearTimeout(timer)
			// The stdio transport's own teardown order: close the server's input
			// stream first, since a well-behaved server exits when it ends.
			child.stdin?.end()
			killProcessGroup(child)
		},
	}
}

/** Whether a JSON-RPC frame carried an error. An explicit `null` is the absence of one. */
const errorOf = (response: JsonRpcResponse): JsonValue | undefined =>
	response.error === undefined || response.error === null
		? undefined
		: response.error

/** The result the tool published, or the error object the server answered with. */
function resultOf(response: JsonRpcResponse): McpCallToolResult {
	const error = errorOf(response)
	if (error !== undefined) return { isError: true, structuredResult: error }
	if (!isJsonObject(response.result)) return { isError: false }
	const { structuredContent, isError } = response.result
	if (structuredContent === undefined) return { isError: isError === true }
	return { isError: isError === true, structuredResult: structuredContent }
}

async function callToolOverStdio(
	request: McpCallToolRequest,
	signal: AbortSignal,
): Promise<McpCallToolResult> {
	const session = startSession(request, signal)
	try {
		const handshake = await session.request(INITIALIZE_ID, 'initialize', {
			protocolVersion: PROTOCOL_VERSION,
			capabilities: {},
			clientInfo: { name: 'eval-quality', version: '0' },
		})
		const refusal = errorOf(handshake)
		if (refusal !== undefined) {
			throw new Error(
				`the server refused the initialize handshake: ${JSON.stringify(refusal)}`,
			)
		}
		session.notify('notifications/initialized', {})
		const response = await session.request(CALL_TOOL_ID, 'tools/call', {
			name: request.toolName,
			arguments: { ...request.arguments },
		})
		return resultOf(response)
	} finally {
		session.close()
	}
}

/**
 * The real mechanism: an actual server process over an actual stdio session.
 * Exported for the same reason `nodeCommandMechanism` is: AD-37's conformance
 * subject for this port has to exercise a real handshake, a real cap, and a
 * real teardown, and a synthetic mechanism would prove nothing about the one
 * thing this adapter exists to get right.
 */
export const nodeStdioMcpMechanism: McpMechanism = {
	callTool: callToolOverStdio,
}

const bodyOf = (structuredResult: JsonValue | undefined): ProbeObservedBody =>
	structuredResult === undefined
		? { kind: 'absent' }
		: { kind: 'json', value: structuredResult }

export function createMcpAdapter(
	policy: McpTargetPolicy,
	mechanism: McpMechanism = nodeStdioMcpMechanism,
): EnvironmentProbePort {
	return {
		probe: (request, signal) =>
			runPortMethod({
				request,
				requestParser: probeParsers.request,
				responseParser: probeParsers.response,
				requestPath: 'ProbeRequest',
				responsePath: 'ProbeObservation',
				signal,
				mechanism: async (parsed: ProbeRequest, innerSignal) => {
					if (parsed.kind !== 'mcp') {
						// This adapter authorizes no target of any other kind, so such
						// a request meets the same "the mapping names nothing" denial an
						// unmapped interfaceId would, before any server starts. The
						// message names the kind that arrived, because the request union
						// carries more than one kind this adapter refuses.
						throw forbidden(
							`this adapter runs mcp requests only; no ${parsed.kind} target is ever authorized`,
						)
					}
					const decision = evaluateMcpTarget(policy, {
						interfaceId: parsed.interfaceId,
						toolName: parsed.toolName,
					})
					if (!decision.allowed) throw forbidden(decision.detail)
					const { authorization } = decision

					const callResult = await mechanism.callTool(
						{
							target: authorization.target,
							targetArgs: authorization.targetArgs,
							toolName: parsed.toolName,
							arguments: parsed.channels.arguments,
							env: buildEnv(authorization.serverEnvironment),
							cwd: authorization.cwd,
							maxElapsedMs: authorization.maxElapsedMs,
							maxOutputBytes: authorization.maxOutputBytes,
						},
						innerSignal,
					)

					return { parsed, callResult }
				},
				assemble: (raw) => {
					const { parsed, callResult } = raw as {
						parsed: McpProbeRequest
						callResult: McpCallToolResult
					}
					const observation: McpProbeObservation = {
						kind: 'mcp',
						probeId: parsed.probeId,
						interfaceId: parsed.interfaceId,
						operationId: parsed.operationId,
						isError: callResult.isError,
						result: bodyOf(callResult.structuredResult),
					}
					return observation
				},
			}),
	}
}
