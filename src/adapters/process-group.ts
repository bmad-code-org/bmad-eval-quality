/**
 * Process-group ownership for the two adapters that spawn a target:
 * `command-line-adapter.ts` and `mcp-adapter.ts`.
 *
 * A target is often a launcher: `npx -y <package>`, a shell wrapper, or an
 * agent runner that starts a model CLI. Killing the direct child alone leaves
 * whatever it started running, and a grandchild that inherited the child's
 * stdout also holds the pipe open, so the adapter waiting for `close` would
 * wait for it too. So the target leads a process group of its own, in a new
 * session, and a cap or an abort signals the negative pid, which reaches every
 * process the target started that did not leave the group itself.
 *
 * A new session is one the host's own group no longer contains, so a signal to
 * the host's group (a cancelled CI job, `timeout -s KILL`, a harness killing
 * the process group it started) stops reaching the target, and `SIGKILL` runs
 * no exit hook in the host. The lifeline closes that gap. `spawnInGroup`
 * starts a small Node process, the watchdog, in a session of its own; the
 * watchdog starts the target as the leader of a further new session and holds
 * one end of a socket pair whose other end only the host holds. The kernel
 * closes the host's end however the host ends, `SIGKILL` included, and the
 * watchdog then sends `SIGKILL` to the target's group. The watchdog is in
 * neither the host's group nor the target's, so a signal to either group
 * leaves it running to do that, and a target that signals its own group
 * (`kill 0`, `kill -- -$$`) reaches exactly what it reached before.
 *
 * The same socket carries the target's spec to the watchdog, so no
 * environment value appears in an argv that `ps` shows, and carries back the
 * target's pid, how it ended, or why it could not start, which the host
 * reports as the target's own `spawn`, `exit`, `close`, and `error`. A spawn
 * failure keeps its class, message, `errno`, `code`, `syscall`, `path`, and
 * `spawnargs`. When a run settles on the target's own exit the host releases
 * the watchdog first, so a target that exits on its own keeps whatever it left
 * running. The watchdog's copies of the target's standard streams are replaced
 * with `/dev/null` once the target has started, so end of file, EPIPE, and
 * `close` depend on the target and what it started alone. The watchdog costs
 * one Node start per run; the adapters start their elapsed budget when the
 * target starts, so that time is not charged to the target, and give the
 * watchdog `WATCHDOG_START_ALLOWANCE_MS` of its own to get there. Every group
 * kill repeats until the group is gone, since one killpg can miss a child
 * caught mid-fork.
 *
 * The new session has two further costs. The target has no controlling
 * terminal, so one that opens `/dev/tty` (an ssh, sudo, or git credential
 * prompt) gets ENXIO where it used to reach the host's terminal. And a
 * terminal's Ctrl-C signals the foreground process group, which no longer
 * contains the target: a host that Ctrl-C ends takes the group down through
 * the lifeline, and a host that handles SIGINT and keeps running aborts the
 * signal it passed in to stop a run.
 *
 * Windows has no process groups. There the target spawns attached as the
 * host's direct child, since `detached` there starts it with no console, so
 * every console program it starts opens a window of its own. A kill reaches
 * the direct child only, and only `trackProcessGroup`'s exit hook, on
 * `process.exit()` or an uncaught exception, stops it when the host ends. A
 * single executable application cannot start a Node watchdog from its own
 * binary, so there the target spawns detached with no lifeline, as in 4.1.1.
 */
import { type ChildProcess, spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { resolve as resolvePath } from 'node:path'
import { isSea } from 'node:sea'
import type { Duplex, Readable, Writable } from 'node:stream'

/** Whether a spawned target leads its own process group, in a new session. False on Windows, where there are no groups to lead. */
export const SPAWN_DETACHED: boolean = process.platform !== 'win32'

/** Every child whose group this module may still have to kill: added at spawn, removed at `close`. */
const liveChildren = new Set<GroupedChild>()
let exitHookInstalled = false

/**
 * Kills a tracked child's group if the host exits while its run is in flight.
 * The child is dropped at `close`, which also fires for a child that never
 * started. Dropping it at 'exit' would miss the case this module exists for:
 * a launcher that exited while the process it started, still in the group,
 * holds stdout open. Every teardown in both adapters destroys this end of the
 * pipes, so `close` follows a kill promptly and nothing stays tracked past its
 * run. Whatever a target left running after its run settled is untouched.
 */
export function trackProcessGroup(child: GroupedChild): void {
	liveChildren.add(child)
	child.once('close', () => liveChildren.delete(child))
	if (exitHookInstalled) return
	exitHookInstalled = true
	process.once('exit', () => {
		for (const live of liveChildren) killProcessGroup(live)
	})
}

/** How many children are still tracked, for tests that check a child leaves the set. */
export function trackedProcessCount(): number {
	return liveChildren.size
}

/**
 * The rejection spawn's own `signal` option produced, which both adapters
 * handled through before they took abort over themselves: `AbortError` by
 * name, `ABORT_ERR` by code, the signal's reason as its `cause`.
 * `nodeCommandMechanism` and `nodeStdioMcpMechanism` are exported, so their
 * callers see this shape.
 */
export function abortErrorFor(signal: AbortSignal): Error {
	return new AbortError('The operation was aborted', { cause: signal.reason })
}

/** Node's own `AbortError` is internal, so this matches it: constructor name, `code`, then `name`. */
class AbortError extends Error {
	readonly code: string

	constructor(message: string, options: ErrorOptions) {
		super(message, options)
		this.code = 'ABORT_ERR'
		this.name = 'AbortError'
	}
}

/** `SIGKILL` to the child's whole process group, or to the child alone where there is no group. */
export function killProcessGroup(child: GroupedChild): void {
	child.killGroup()
}

/** The 4.1.1 kill over a plain `ChildProcess`: the negative pid, or the child itself where that throws. */
function killChildGroup(child: ChildProcess): void {
	const { pid } = child
	if (pid === undefined || !SPAWN_DETACHED) {
		child.kill('SIGKILL')
		return
	}
	try {
		process.kill(-pid, 'SIGKILL')
	} catch {
		child.kill('SIGKILL')
		return
	}
	killGroupUntilGone(pid)
}

/**
 * The part of a `ChildProcess` both adapters use, plus `killGroup` and
 * `release`. On POSIX it is the target seen through its watchdog; on Windows,
 * and in a single executable application, it is the target's own
 * `ChildProcess`.
 */
export interface GroupedChild extends EventEmitter {
	/** The target's pid, which is its group's id; known from `spawn` on. */
	readonly pid?: number | undefined
	readonly stdin: Writable | null
	readonly stdout: Readable | null
	readonly stderr: Readable | null
	/** `SIGKILL` to everything in the target's group, or to the target alone where there is no group. */
	killGroup(): void
	/** Lets the watchdog exit without killing the group: for a run that settled on the target's own exit. */
	release(): void
}

export type GroupedSpawn = {
	readonly target: string
	readonly args: readonly string[]
	readonly cwd: string
	readonly env: Readonly<Record<string, string>>
}

/**
 * The watchdog's whole program, run with `node -e`. Every report is one JSON
 * line on the lifeline: `spawned` with the target's pid, `exit` with how it
 * ended, or `error` with a spawn failure, whether spawn threw it or emitted
 * it. Anything the watchdog throws on its own is reported the same way, so no
 * stack trace of its own reaches the target's stderr.
 */
const WATCHDOG_SOURCE = `'use strict'
const fs = require('node:fs')
const net = require('node:net')
const { spawn } = require('node:child_process')
const lifeline = new net.Socket({ fd: 3, readable: true, writable: true })
lifeline.on('error', () => {})
let target = null
let released = false
let done = false
const described = (error) => {
	const fields = { name: error?.name ?? 'Error', message: String(error?.message ?? error) }
	for (const key of ['errno', 'code', 'syscall', 'path', 'spawnargs']) {
		if (error?.[key] !== undefined) fields[key] = error[key]
	}
	return fields
}
// One killpg can miss a child caught mid-fork, so the kill repeats until the
// group is gone, bounded at 100 tries 5 ms apart.
const killTarget = (then) => {
	if (target === null || target.pid === undefined) return then()
	let tries = 0
	const again = () => {
		try { process.kill(-target.pid, 'SIGKILL') } catch { return then() }
		if (++tries >= 100) return then()
		setTimeout(again, 5)
	}
	again()
}
const report = (message) => lifeline.write(JSON.stringify(message) + '\\n')
const failAndExit = (error) => {
	if (done) return
	done = true
	killTarget(() => {
		lifeline.end(JSON.stringify({ error: described(error) }) + '\\n', () => process.exit(0))
	})
}
process.on('uncaughtException', failAndExit)
function start(spec) {
	try {
		target = spawn(spec.target, spec.args, {
			cwd: spec.cwd, env: spec.env, stdio: 'inherit', detached: true,
		})
	} catch (error) {
		failAndExit(error)
		return
	}
	for (const [fd, flags] of [[0, 'r'], [1, 'w'], [2, 'w']]) {
		fs.closeSync(fd)
		fs.openSync('/dev/null', flags)
	}
	target.once('spawn', () => report({ spawned: target.pid }))
	target.once('error', failAndExit)
	target.once('exit', (code, signal) => report({ exit: { code, signal } }))
}
let pending = ''
lifeline.setEncoding('utf8')
lifeline.on('data', (chunk) => {
	pending += chunk
	let newline = pending.indexOf('\\n')
	while (newline !== -1) {
		const line = pending.slice(0, newline)
		pending = pending.slice(newline + 1)
		if (line === 'release') released = true
		else if (target === null && !done) start(JSON.parse(line))
		newline = pending.indexOf('\\n')
	}
})
lifeline.once('close', () => {
	if (released) process.exit(0)
	else killTarget(() => process.exit(0))
})
`

type Described = Readonly<Record<string, unknown>> & {
	readonly name: string
	readonly message: string
}

type WatchdogReport =
	| { readonly spawned: number }
	| {
			readonly exit: {
				readonly code: number | null
				readonly signal: NodeJS.Signals | null
			}
	  }
	| { readonly error: Described }

/** A spawn failure as the watchdog reported it, rebuilt with the class and the properties, in their order, that spawn's own error carries. */
function rebuildSpawnError(reported: Described): Error {
	const { name, message, ...properties } = reported
	const error =
		name === 'TypeError' ? new TypeError(message) : new Error(message)
	for (const key of ['errno', 'code', 'syscall', 'path', 'spawnargs']) {
		if (properties[key] !== undefined) {
			Object.assign(error, { [key]: properties[key] })
		}
	}
	// Node names a coded internal error `TypeError [CODE]` in its stack.
	const { code } = properties
	if (name === 'TypeError' && typeof code === 'string' && error.stack) {
		error.stack = error.stack.replace(/^TypeError/, `TypeError [${code}]`)
	}
	return error
}

/** The watchdog's own spawn failure, told as spawn would have told it for the target: the host's caller never named the watchdog. */
function asTargetSpawnError(error: Error, spec: GroupedSpawn): Error {
	const { errno, code } = error as NodeJS.ErrnoException
	if (typeof code !== 'string') return error
	return Object.assign(new Error(`spawn ${spec.target} ${code}`), {
		errno,
		code,
		syscall: `spawn ${spec.target}`,
		path: spec.target,
		spawnargs: [...spec.args],
	})
}

/** The longest delay one timer holds. */
const MAX_TIMER_MS = 2 ** 31 - 1

/** How long the watchdog may take to start the target before the run is capped anyway. */
const WATCHDOG_START_ALLOWANCE_MS = 30_000

/**
 * The first elapsed deadline, armed before the target starts: the run's own
 * budget plus the watchdog's start allowance, within what a timer holds. The
 * adapters arm `timerDelayMs(maxElapsedMs)` again at 'spawn', so the target
 * itself gets exactly its budget.
 */
export function startDeadlineMs(maxElapsedMs: number): number {
	return timerDelayMs(maxElapsedMs + WATCHDOG_START_ALLOWANCE_MS)
}

/**
 * A delay within what one timer holds. `setTimeout` turns a longer one into
 * 1 ms, and both adapters take their policy typed and never parse it, so a
 * budget past the schemas' bound still reaches a timer through them.
 */
export function timerDelayMs(ms: number): number {
	return Math.min(ms, MAX_TIMER_MS)
}

/** `SIGKILL` to a group, repeated every 5 ms until it is gone (at most 100 times), since one killpg can miss a child caught mid-fork. */
function killGroupUntilGone(pgid: number): void {
	let tries = 0
	const again = (): void => {
		try {
			process.kill(-pgid, 'SIGKILL')
		} catch {
			return
		}
		if (++tries < 100) setTimeout(again, 5).unref()
	}
	again()
}

/** Variables the dynamic loader or an embedding runtime needs to start Node at all; nothing else of the host reaches the watchdog. */
function watchdogEnv(): Record<string, string> {
	const env: Record<string, string> = { ELECTRON_RUN_AS_NODE: '1' }
	for (const key of ['LD_LIBRARY_PATH', 'DYLD_LIBRARY_PATH']) {
		const value = process.env[key]
		if (value !== undefined) env[key] = value
	}
	return env
}

class WatchedChild extends EventEmitter implements GroupedChild {
	pid: number | undefined
	readonly stdin: Writable | null
	readonly stdout: Readable | null
	readonly stderr: Readable | null
	readonly #lifeline: Duplex | null
	readonly #watchdog: ChildProcess
	#ended: {
		readonly code: number | null
		readonly signal: NodeJS.Signals | null
	} | null = null
	#failed = false
	#killed = false
	#openStreams = 0
	#closed = false

	constructor(spec: GroupedSpawn) {
		super()
		const watchdog = spawn(process.execPath, ['-e', WATCHDOG_SOURCE], {
			cwd: '/',
			env: watchdogEnv(),
			shell: false,
			detached: true,
			stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
		})
		this.#watchdog = watchdog
		// First, so a watchdog that cannot start (EMFILE, EAGAIN) reaches the
		// caller as this child's 'error' and never as an unhandled one.
		watchdog.once('error', (error: Error) =>
			this.#fail(asTargetSpawnError(error, spec)),
		)
		this.stdin = watchdog.stdin ?? null
		this.stdout = watchdog.stdout ?? null
		this.stderr = watchdog.stderr ?? null
		for (const stream of [this.stdout, this.stderr]) {
			if (stream == null) continue
			this.#openStreams++
			stream.once('close', () => {
				this.#openStreams--
				this.#maybeClose()
			})
		}

		const lifeline = (watchdog.stdio?.[3] ?? null) as Duplex | null
		this.#lifeline = lifeline
		if (lifeline === null) return
		lifeline.on('error', () => {})
		lifeline.setEncoding('utf8')
		let pending = ''
		lifeline.on('data', (chunk: string) => {
			pending += chunk
			let newline = pending.indexOf('\n')
			while (newline !== -1) {
				this.#receive(JSON.parse(pending.slice(0, newline)) as WatchdogReport)
				pending = pending.slice(newline + 1)
				newline = pending.indexOf('\n')
			}
		})
		lifeline.once('close', () => {
			if (this.#ended !== null) return
			if (this.#killed) {
				this.#end(null, 'SIGKILL')
				return
			}
			if (this.pid === undefined) {
				// The watchdog may have died between starting the target and
				// reporting it. That target has no lifeline and no known pid, so at
				// least its pipes are let go, and it meets end of file and EPIPE.
				this.stdin?.destroy()
				this.stdout?.destroy()
				this.stderr?.destroy()
				this.#fail(
					new Error(
						`the process-group watchdog for ${spec.target} ended before starting it`,
					),
				)
				return
			}
			// The watchdog was killed on its own. The target is left without its
			// lifeline, so the group goes, and the target is reported as that
			// kill ended it.
			this.killGroup()
			this.#end(null, 'SIGKILL')
		})
		lifeline.write(
			`${JSON.stringify({
				target: spec.target,
				args: spec.args,
				// The watchdog runs in '/', so a relative cwd resolves here, against
				// the host's, as spawn resolved it.
				cwd: resolvePath(spec.cwd),
				env: spec.env,
			})}\n`,
		)
	}

	killGroup(): void {
		this.#killed = true
		if (this.pid !== undefined) killGroupUntilGone(this.pid)
		// A target not yet reported as started is the watchdog's to kill.
		this.#lifeline?.destroy()
		this.#letGo()
	}

	release(): void {
		if (this.#failed || this.#killed || this.#lifeline === null) return
		this.#lifeline.end('release\n')
		this.#letGo()
	}

	/** Once the run is decided, a watchdog slow to exit must not keep the host alive. */
	#letGo(): void {
		this.#watchdog.unref()
		;(this.#lifeline as (Duplex & { unref?: () => void }) | null)?.unref?.()
	}

	#receive(report: WatchdogReport): void {
		if ('spawned' in report) {
			this.pid = report.spawned
			this.emit('spawn')
		} else if ('exit' in report) {
			this.#end(report.exit.code, report.exit.signal)
		} else {
			this.#fail(rebuildSpawnError(report.error))
		}
	}

	#end(code: number | null, signal: NodeJS.Signals | null): void {
		if (this.#ended !== null) return
		this.#ended = { code, signal }
		this.emit('exit', code, signal)
		this.#maybeClose()
	}

	#fail(error: Error): void {
		if (this.#ended !== null) return
		this.#failed = true
		this.#ended = { code: null, signal: null }
		this.emit('error', error)
		this.#maybeClose()
	}

	#maybeClose(): void {
		if (this.#closed || this.#ended === null || this.#openStreams > 0) return
		this.#closed = true
		this.emit('close', this.#ended.code, this.#ended.signal)
	}
}

/**
 * Starts `target` as the leader of a new session and process group, tied to
 * the host's lifetime by the watchdog's lifeline. On Windows it is spawned
 * attached, as the host's direct child, and in a single executable
 * application detached with no lifeline.
 */
export function spawnInGroup(spec: GroupedSpawn): GroupedChild {
	if (SPAWN_DETACHED && !isSea()) return new WatchedChild(spec)
	const child = spawn(spec.target, [...spec.args], {
		cwd: spec.cwd,
		env: { ...spec.env },
		shell: false,
		detached: SPAWN_DETACHED,
	})
	return Object.assign(child, {
		killGroup: (): void => killChildGroup(child),
		release: (): void => {},
	})
}
