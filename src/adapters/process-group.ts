/**
 * Process-group ownership for the two adapters that spawn a target:
 * `command-line-adapter.ts` and `mcp-adapter.ts`.
 *
 * A target is often a launcher: `npx -y <package>`, a shell wrapper, or an
 * agent runner that starts a model CLI. Killing the direct child alone leaves
 * whatever it started running, and a grandchild that inherited the child's
 * stdout also holds the pipe open, so the adapter waiting for `close` would
 * wait for it too. Spawning detached makes the child lead a new process group
 * (`setsid` on POSIX), and signalling the negative pid then reaches every
 * process the child started that did not leave the group itself.
 *
 * Detaching keeps what an adapter relies on. The parent still holds a
 * reference to the child, since neither adapter calls `unref()`, so the host
 * stays alive while a run is in flight and `close` still fires, and the
 * standard streams are pipes the adapter owns either way. Two consequences are
 * real. The target has no controlling terminal, so one that opens `/dev/tty`
 * (an ssh, sudo, or git credential prompt) gets ENXIO where it used to reach
 * the host's terminal. And a terminal's Ctrl-C signals the foreground process
 * group, which no longer contains the target. `trackProcessGroup` covers the
 * host exiting through `process.exit()` or an uncaught exception, since
 * Node's 'exit' event runs synchronously and a kill is synchronous too. A host
 * killed by a signal it does not handle runs no 'exit' listener, and a library
 * that installed its own signal handler would change how its host dies, so a
 * host that wants Ctrl-C to reach an in-flight target aborts the signal it
 * passed in, or handles SIGINT and exits.
 *
 * Windows has no process groups. There the child spawns attached, since
 * `detached` there starts the target with no console, so every console
 * program it starts opens a window of its own, and it buys no group to kill.
 * The kill falls back to the direct child.
 */
import type { ChildProcess } from 'node:child_process'

/** Whether a spawned target leads its own process group. False on Windows, where there are no groups to lead. */
export const SPAWN_DETACHED: boolean = process.platform !== 'win32'

/** Every child whose group this module may still have to kill: added at spawn, removed at `close`. */
const liveChildren = new Set<ChildProcess>()
let exitHookInstalled = false

/**
 * Kills a tracked child's group if the host exits while it is still running.
 * Only an in-flight run is covered: a target that exited on its own is
 * dropped at `close`, and whatever it left running is untouched.
 */
export function trackProcessGroup(child: ChildProcess): void {
	liveChildren.add(child)
	child.once('close', () => liveChildren.delete(child))
	if (exitHookInstalled) return
	exitHookInstalled = true
	process.once('exit', () => {
		for (const live of liveChildren) killProcessGroup(live)
	})
}

/**
 * `SIGKILL` to the child's whole process group, or to the child alone where
 * there is no group to reach: a child that never started (no pid), and
 * Windows, where a negative pid throws.
 */
export function killProcessGroup(child: ChildProcess): void {
	const { pid } = child
	if (pid === undefined || !SPAWN_DETACHED) {
		child.kill('SIGKILL')
		return
	}
	try {
		process.kill(-pid, 'SIGKILL')
	} catch {
		child.kill('SIGKILL')
	}
}
