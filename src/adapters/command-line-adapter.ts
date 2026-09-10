/**
 * The environment-probe port over a real child process, for the `cli`
 * mechanism, which `probe-conformance.ts` had documented as unauthorizable
 * and unshipped. `evaluateCommandTarget` closes the authorization half; this
 * file closes the execution half.
 *
 * Every rule below is what "what's a command allowed to do" resolves to, a
 * decision settled here in the implementation rather than as an architecture
 * revision:
 *
 * 1. `target` is spawned directly with an argv array (`shell: false`,
 *    Node's own default, stated anyway since it is the one thing this
 *    adapter must never turn off). No channel value is ever concatenated
 *    into a shell string; a value containing `;`, `$(...)`, or a quote
 *    reaches the child as one literal argv element, not a metacharacter.
 * 2. `argument` and `option` build the argv the same way a well-behaved CLI
 *    parser reads one: options first as `--{key}` (a boolean `true` is a
 *    bare flag, `false` is omitted, anything else gets one value token),
 *    positionals after in the record's own key order. An array value is the
 *    repeatable spelling: `--{key}` is emitted once per element, and an
 *    array positional contributes one token per element. `environment`
 *    passes through as declared, plus the host's own `PATH` so a `target`
 *    naming a bare command still resolves; a declared `PATH` key wins over
 *    that default. `stdin` is written and the stream is closed; `absent`
 *    closes it with nothing written.
 * 3. `maxElapsedMs` and `maxOutputBytes` are enforced by this adapter, not
 *    borrowed from `AbortSignal`: exceeding either kills the process with
 *    `SIGKILL` and throws `budget-exhausted`, exactly as an HTTP cap does.
 *    `maxOutputBytes` applies independently to stdout, to stderr, and to
 *    each artifact file read back after exit.
 * 4. A non-zero exit is an observation, never a fault, matching AD-10's rule
 *    for an HTTP status. Only a policy denial, a cap, an abort, or a failure
 *    to start the process throws. `exitCode` is negative when a signal
 *    ended the process, the same convention `CommandProbeObservation`
 *    documents for itself.
 */
import { spawn } from 'node:child_process'
import { open } from 'node:fs/promises'
import { constants as osConstants } from 'node:os'
import { isAbsolute, resolve as resolvePath } from 'node:path'
import { RuntimeFault } from '../core/schemas/faults.ts'
import type {
	CommandProbeObservation,
	CommandProbeRequest,
	ProbeRequest,
} from '../core/schemas/port-messages.ts'
import type { ProbeObservedBody } from '../core/schemas/probe-body.ts'
import type { CommandTargetPolicy } from '../core/schemas/probe-policy.ts'
import type { EnvironmentProbePort } from '../ports/environment-probe-port.ts'
import { probeParsers } from '../ports/environment-probe-port.ts'
import { evaluateCommandTarget } from './command-target-policy.ts'
import { runPortMethod } from './port-boundary.ts'

/** One process run, already reduced to what an observation needs. No truncation flag: exceeding `maxOutputBytes` rejects with `budget-exhausted` rather than resolving with a partial stream, so a resolved run's output is always the whole thing. */
export type CommandRunResult = {
	readonly exitCode: number
	readonly stdout: string
	readonly stderr: string
}

export type CommandRunRequest = {
	readonly target: string
	readonly subcommandPath: readonly string[]
	readonly argv: readonly string[]
	readonly env: Readonly<Record<string, string>>
	readonly stdin: {
		readonly kind: 'json' | 'text' | 'absent'
		readonly value?: unknown
	}
	readonly cwd: string
	readonly maxElapsedMs: number
	readonly maxOutputBytes: number
}

export type ArtifactRead = {
	readonly present: boolean
	readonly text: string
	readonly truncated: boolean
}

/** Swappable so the conformance subject can spy on calls and script every scenario, matching the other three shipped adapters. */
export type CommandMechanism = {
	readonly run: (
		request: CommandRunRequest,
		signal: AbortSignal,
	) => Promise<CommandRunResult>
	readonly readArtifact: (
		path: string,
		maxBytes: number,
	) => Promise<ArtifactRead>
}

function stringifyScalar(value: unknown): string {
	if (typeof value === 'string') return value
	if (typeof value === 'number' || typeof value === 'boolean')
		return String(value)
	return JSON.stringify(value)
}

/**
 * Options first as `--{key}`, positionals after, both in the record's own key
 * order. Exported for its own unit tests: this is the one place
 * shell-injection safety is decided.
 *
 * An array value is the repeatable spelling. A great many command-line tools
 * accept an option more than once and collect the values (`--env-pass A
 * --env-pass B`), and a channel record holds one value per key, so before this
 * a caller could send exactly one. The single JSON token an array used to
 * produce (`--env-pass ["A","B"]`) reaches no parser that understands it, so
 * nothing can depend on the old spelling. An empty array emits nothing, the
 * same as `false`: there is no value to pass.
 */
export function buildArgv(channels: CommandProbeRequest['channels']): string[] {
	const optionTokens: string[] = []
	for (const [key, value] of Object.entries(channels.option)) {
		if (value === false) continue
		if (Array.isArray(value)) {
			for (const element of value) {
				optionTokens.push(`--${key}`, stringifyScalar(element))
			}
			continue
		}
		optionTokens.push(`--${key}`)
		if (value !== true) optionTokens.push(stringifyScalar(value))
	}
	const argumentTokens = Object.values(channels.argument).flatMap((value) =>
		Array.isArray(value)
			? value.map(stringifyScalar)
			: [stringifyScalar(value)],
	)
	return [...optionTokens, ...argumentTokens]
}

function buildEnv(
	declared: Readonly<Record<string, string>>,
): Record<string, string> {
	const base: Record<string, string> = {}
	if (process.env.PATH !== undefined) base.PATH = process.env.PATH
	return { ...base, ...declared }
}

function buildStdin(
	stdin: CommandProbeRequest['channels']['stdin'],
): CommandRunRequest['stdin'] {
	if (stdin.kind === 'absent') return { kind: 'absent' }
	if (stdin.kind === 'json') return { kind: 'json', value: stdin.value }
	return { kind: 'text', value: stdin.value }
}

/** A heuristic, not a declared content type: the port carries none for a process stream. JSON-shaped text reads as `json`; anything else as `text`. */
function bodyFromText(text: string): ProbeObservedBody {
	if (text.length === 0) return { kind: 'text', value: text }
	try {
		return { kind: 'json', value: JSON.parse(text) }
	} catch {
		return { kind: 'text', value: text }
	}
}

function capped(detail: string): RuntimeFault {
	return new RuntimeFault('budget-exhausted', 'CommandProbeRequest', detail)
}

function forbidden(detail: string): RuntimeFault {
	return new RuntimeFault('forbidden-target', 'ProbeRequest', detail)
}

function writeStdin(
	child: import('node:child_process').ChildProcess,
	stdin: CommandRunRequest['stdin'],
): void {
	const stream = child.stdin
	if (stream === null) return
	// A child that exits before reading stdin closes its end of the pipe, and
	// the pending `end()` write below then raises EPIPE on this stream, not on
	// `child` itself. With no listener that is an unhandled 'error' and crashes
	// the host process; the run itself is unaffected, since `close` still fires
	// and carries the exit code this adapter already reads it from.
	stream.on('error', () => {})
	if (stdin.kind === 'absent') {
		stream.end()
		return
	}
	stream.end(
		stdin.kind === 'json' ? JSON.stringify(stdin.value) : String(stdin.value),
	)
}

/** `-signalNumber` when a signal ended the process, matching `CommandProbeObservation.exitCode`'s own documented convention. */
function exitCodeOf(
	code: number | null,
	signalName: NodeJS.Signals | null,
): number {
	if (code !== null) return code
	if (signalName === null) return -1
	const numeric = (osConstants.signals as Record<string, number>)[signalName]
	return numeric === undefined ? -1 : -numeric
}

async function runChildProcess(
	request: CommandRunRequest,
	signal: AbortSignal,
): Promise<CommandRunResult> {
	return new Promise((settlePromise, rejectPromise) => {
		const child = spawn(
			request.target,
			[...request.subcommandPath, ...request.argv],
			{
				cwd: request.cwd,
				env: request.env,
				shell: false,
				signal,
			},
		)

		let stdout = ''
		let stderr = ''
		let settled = false
		let timedOut = false
		let overCap = false

		const finish = (action: () => void) => {
			if (settled) return
			settled = true
			clearTimeout(timer)
			action()
		}

		const timer = setTimeout(() => {
			timedOut = true
			child.kill('SIGKILL')
		}, request.maxElapsedMs)

		const capture = (
			chunk: Buffer,
			append: (next: string) => void,
			currentLength: () => number,
		) => {
			if (currentLength() > request.maxOutputBytes) return
			append(chunk.toString('utf8'))
			if (currentLength() > request.maxOutputBytes) {
				overCap = true
				child.kill('SIGKILL')
			}
		}

		child.stdout?.on('data', (chunk: Buffer) =>
			capture(
				chunk,
				(next) => {
					stdout += next
				},
				() => Buffer.byteLength(stdout, 'utf8'),
			),
		)
		child.stderr?.on('data', (chunk: Buffer) =>
			capture(
				chunk,
				(next) => {
					stderr += next
				},
				() => Buffer.byteLength(stderr, 'utf8'),
			),
		)

		child.once('error', (error: unknown) => {
			finish(() => rejectPromise(error))
		})
		child.once(
			'close',
			(code: number | null, signalName: NodeJS.Signals | null) => {
				finish(() => {
					if (timedOut) {
						rejectPromise(
							capped(
								`exceeded maxElapsedMs (${request.maxElapsedMs}ms) and was killed`,
							),
						)
						return
					}
					if (overCap) {
						rejectPromise(
							capped(
								`stdout or stderr exceeded maxOutputBytes (${request.maxOutputBytes}) and the process was killed`,
							),
						)
						return
					}
					settlePromise({
						exitCode: exitCodeOf(code, signalName),
						stdout,
						stderr,
					})
				})
			},
		)

		writeStdin(child, request.stdin)
	})
}

/** Reads at most `maxBytes + 1` bytes rather than the whole file: an oversize artifact is capped before its bytes are loaded, not after, so a run that wrote past the limit cannot make this adapter allocate the excess first. */
async function readArtifactFile(
	path: string,
	maxBytes: number,
): Promise<ArtifactRead> {
	let handle: import('node:fs/promises').FileHandle
	try {
		handle = await open(path, 'r')
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return { present: false, text: '', truncated: false }
		}
		throw error
	}
	try {
		const buffer = Buffer.alloc(maxBytes + 1)
		const { bytesRead } = await handle.read(buffer, 0, buffer.byteLength, 0)
		const truncated = bytesRead > maxBytes
		const text = buffer
			.subarray(0, Math.min(bytesRead, maxBytes))
			.toString('utf8')
		return { present: true, text, truncated }
	} finally {
		await handle.close()
	}
}

/**
 * The real mechanism: an actual child process, an actual file read. Exported,
 * unlike the other three shipped adapters' defaults, because AD-37's own
 * conformance subject for this port has to exercise real process behaviour
 * (a real timeout, a real output cap, a real argv) the way the `api` arm's
 * subject exercises a real loopback server; a synthetic mechanism would prove
 * nothing about the one thing this adapter exists to get right.
 */
export const nodeCommandMechanism: CommandMechanism = {
	run: runChildProcess,
	readArtifact: readArtifactFile,
}

export function createCommandLineAdapter(
	policy: CommandTargetPolicy,
	mechanism: CommandMechanism = nodeCommandMechanism,
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
					if (parsed.kind !== 'cli') {
						// This adapter authorizes no target of any other kind, so such
						// a request meets the same "the mapping names nothing" denial an
						// unmapped interfaceId would, before any process spawns. The
						// message names the kind that arrived, because the request union
						// carries more than one kind this adapter refuses.
						throw forbidden(
							`this adapter runs cli requests only; no ${parsed.kind} target is ever authorized`,
						)
					}
					const decision = evaluateCommandTarget(policy, {
						interfaceId: parsed.interfaceId,
						executable: parsed.executable,
						subcommandPath: parsed.subcommandPath,
					})
					if (!decision.allowed) throw forbidden(decision.detail)
					const { authorization } = decision

					const runResult = await mechanism.run(
						{
							target: authorization.target,
							subcommandPath: parsed.subcommandPath,
							argv: buildArgv(parsed.channels),
							env: buildEnv(parsed.channels.environment),
							stdin: buildStdin(parsed.channels.stdin),
							cwd: authorization.cwd,
							maxElapsedMs: authorization.maxElapsedMs,
							maxOutputBytes: authorization.maxOutputBytes,
						},
						innerSignal,
					)

					const artifactEntries = await Promise.all(
						Object.entries(authorization.artifacts).map(
							async ([artifactId, relativePath]) => {
								const absolute = isAbsolute(relativePath)
									? relativePath
									: resolvePath(authorization.cwd, relativePath)
								const read = await mechanism.readArtifact(
									absolute,
									authorization.maxOutputBytes,
								)
								if (read.truncated) {
									throw capped(
										`artifact "${artifactId}" exceeded maxOutputBytes (${authorization.maxOutputBytes})`,
									)
								}
								return [artifactId, read] as const
							},
						),
					)

					return { parsed, runResult, artifactEntries }
				},
				assemble: (raw) => {
					const { parsed, runResult, artifactEntries } = raw as {
						parsed: CommandProbeRequest
						runResult: CommandRunResult
						artifactEntries: readonly (readonly [string, ArtifactRead])[]
					}
					const observation: CommandProbeObservation = {
						kind: 'cli',
						probeId: parsed.probeId,
						interfaceId: parsed.interfaceId,
						operationId: parsed.operationId,
						exitCode: runResult.exitCode,
						stdout: bodyFromText(runResult.stdout),
						stderr: bodyFromText(runResult.stderr),
						artifacts: Object.fromEntries(
							artifactEntries.map(([id, read]) => [
								id,
								read.present
									? bodyFromText(read.text)
									: { kind: 'absent' as const },
							]),
						),
					}
					return observation
				},
			}),
	}
}
