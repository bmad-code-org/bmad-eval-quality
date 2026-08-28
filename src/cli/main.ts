#!/usr/bin/env node
/**
 * The `bin` entry: the only file in the package that reads `process.argv`,
 * reads stdin, or writes to a stream. It holds no command logic, so its whole
 * body is building a `RunEnvironment` and turning an outcome into
 * `process.exitCode`.
 *
 * `process.exit` is called nowhere. Exiting truncates a pending stdout write,
 * and an artifact larger than a pipe buffer is the ordinary case here.
 */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { parseArguments } from './arguments.ts'
import type { CommandOutcome } from './exit-codes.ts'
import { exitCodeFor } from './exit-codes.ts'
import { renderError, renderUsage } from './render.ts'
import { type RunEnvironment, run } from './run.ts'

/**
 * A path the invocation named that the filesystem will not give us. The caller
 * chose it, so it is a usage error and takes 64, which sits outside every code
 * AD-21 assigns.
 */
const PATH_ERROR_CODES = new Set([
	'ENOENT',
	'EACCES',
	'EISDIR',
	'ENOTDIR',
	'EPERM',
	'ELOOP',
	'ENAMETOOLONG',
])

function pathErrorOf(error: unknown): NodeJS.ErrnoException | null {
	if (!(error instanceof Error)) return null
	const candidate = error as NodeJS.ErrnoException
	if (candidate.code === undefined) return null
	return PATH_ERROR_CODES.has(candidate.code) ? candidate : null
}

/**
 * The binary's own version. `cli/` may not import the root barrel, where
 * `VERSION` lives, so the manifest is read beside the built file: `dist/cli/`
 * and `src/cli/` are both two levels under the package root.
 */
async function packageVersion(): Promise<string> {
	const manifestUrl = new URL('../../package.json', import.meta.url)
	const manifest = JSON.parse(await readFile(manifestUrl, 'utf8')) as {
		version: string
	}
	return manifest.version
}

/** One read to end: a canonical JSON document has no incremental meaning. */
async function readStdin(): Promise<string> {
	const chunks: Buffer[] = []
	for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk))
	return Buffer.concat(chunks).toString('utf8')
}

function environmentOf(version: string): RunEnvironment {
	return {
		readInput: async (source) =>
			source === null ? await readStdin() : await readFile(source, 'utf8'),
		writeArtifact: async (path, body) => {
			await writeFile(path, body, 'utf8')
		},
		writeOut: (body) => {
			process.stdout.write(body)
		},
		writeDiagnostic: (line) => {
			process.stderr.write(`${line}\n`)
		},
		// `resolve` on an already-absolute path still folds `.`, `..`, and a
		// doubled separator, which is the whole point: returning an absolute
		// path verbatim let `/d/./a.json` and `/d/a.json` name one file and pass
		// the collision check, and the command then overwrote its own input.
		resolvePath: (path) => resolve(path),
		joinPath: (directory, name) => join(directory, name),
		sameFile: async (left, right) => {
			try {
				const [a, b] = await Promise.all([stat(left), stat(right)])
				return a.dev === b.dev && a.ino === b.ino
			} catch {
				// One of them is not there, so they cannot be one file. The
				// ordinary case: an output path that does not exist yet.
				return false
			}
		},
		version,
	}
}

/**
 * Returns nothing and communicates through `process.exitCode`, so there is one
 * exit mechanism. The top-level call below is what makes the file executable:
 * without it the `bin` target loads and does nothing.
 */
const writeStderr = (line: string): void => {
	process.stderr.write(`${line}\n`)
}

/**
 * Every escape from `run` becomes an outcome, so every exit this binary takes
 * is one `exitCodeFor` assigned. Letting one through would exit 1, and AD-21
 * bars a command that produced no verdict from landing in the verdict range.
 *
 * `run` still rethrows a defect in our own code, and the stack still reaches
 * stderr: what changes is the number beside it, which becomes the fault code
 * rather than Node's default 1.
 */
function failureOutcome(error: unknown): CommandOutcome {
	const pathError = pathErrorOf(error)
	if (pathError !== null) {
		writeStderr(
			renderUsage(
				`${pathError.syscall ?? 'open'} "${pathError.path ?? '(unknown path)'}": ${pathError.code}`,
			),
		)
		return { kind: 'usage-error' }
	}
	const errno = error as NodeJS.ErrnoException
	if (error instanceof Error && typeof errno.code === 'string') {
		// An I/O failure outside the path allowlist: a full disk, a read-only
		// mount, an exhausted descriptor table. The caller cannot fix it by
		// changing the command line, so it is a fault and takes five.
		writeStderr(renderError(error))
		return { kind: 'fault' }
	}
	writeStderr(
		error instanceof Error ? (error.stack ?? error.message) : String(error),
	)
	return { kind: 'fault' }
}

export async function main(argv: readonly string[]): Promise<void> {
	try {
		const invocation = parseArguments(argv)
		const environment = environmentOf(await packageVersion())
		const { outcome } = await run(invocation, environment)
		process.exitCode = exitCodeFor(outcome, {
			strict: invocation.kind === 'run' && invocation.strict,
		})
	} catch (error) {
		// `strict` promotes a CONCERNS and nothing else, and no failure outcome
		// is a verdict, so the value here cannot change the code.
		process.exitCode = exitCodeFor(failureOutcome(error), { strict: false })
	}
}

await main(process.argv.slice(2))
