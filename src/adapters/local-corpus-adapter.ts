/** AD-8's corpus port over a caller-supplied root directory. */
import { readFile, realpath } from 'node:fs/promises'
import { isAbsolute, posix, relative, resolve, sep } from 'node:path'
import { RuntimeFault } from '../core/schemas/faults.ts'
import type { CorpusPort } from '../ports/corpus-port.ts'
import { corpusResolveParsers } from '../ports/corpus-port.ts'
import { runPortMethod } from './port-boundary.ts'

/** Returns `unknown` so the response parse stays falsifiable; see `port-boundary.ts`. */
export type CorpusMechanism = (
	resolvedPath: string,
	signal: AbortSignal,
) => Promise<unknown>

const nodeCorpus: CorpusMechanism = (path, signal) => readFile(path, { signal })

function escaped(privateRef: string, detail: string): RuntimeFault {
	return new RuntimeFault(
		'port-failure',
		'CorpusResolveRequest',
		`the private reference "${privateRef}" ${detail}`,
	)
}

/**
 * The lexical half of the escape check, before any filesystem call. AD-8 calls
 * the reference opaque and AD-18 keeps a private path out of an artifact; an
 * opaque handle spellable as `../../etc/passwd` is neither.
 */
function assertNoLexicalEscape(privateRef: string): void {
	const normalized = posix.normalize(privateRef)
	if (posix.isAbsolute(normalized)) {
		throw escaped(privateRef, 'is absolute')
	}
	if (normalized.split('/').some((segment: string) => segment === '..')) {
		throw escaped(privateRef, 'still contains a ".." segment after normalizing')
	}
}

/**
 * The real-path half. It needs a filesystem call, so it runs after the read,
 * and it catches a symlink inside the root pointing outside it. The bytes are
 * discarded. Running it first would make an absent file fail before the
 * mechanism was called, and `single-underlying-call-on-failure` counts that
 * call.
 */
async function assertInsideRoot(
	root: string,
	privateRef: string,
	target: string,
): Promise<void> {
	let realRoot: string
	let realTarget: string
	try {
		realRoot = await realpath(root)
		realTarget = await realpath(target)
	} catch (error) {
		throw new RuntimeFault(
			'port-failure',
			'CorpusResolveRequest',
			`the private reference "${privateRef}" could not be resolved to a real path inside the root`,
			{ cause: error },
		)
	}
	// `relative`, never a prefix compare: a root of `/` makes the prefix `//`,
	// which no valid target starts with, so a prefix check rejects every file
	// under a filesystem-root corpus.
	const inside = relative(realRoot, realTarget)
	if (
		inside !== '' &&
		(isAbsolute(inside) || inside === '..' || inside.startsWith(`..${sep}`))
	) {
		throw escaped(privateRef, 'resolves outside the corpus root')
	}
}

export function createLocalCorpusAdapter(options: {
	readonly root: string
	readonly mechanism?: CorpusMechanism
}): CorpusPort {
	const mechanism = options.mechanism ?? nodeCorpus
	return {
		resolve: (request, signal) => {
			// Captured per call so `postcheck` reads the same path the mechanism
			// was given.
			let target = ''
			return runPortMethod({
				request,
				requestParser: corpusResolveParsers.request,
				responseParser: corpusResolveParsers.response,
				requestPath: 'CorpusResolveRequest',
				responsePath: 'CorpusResolveResponse',
				signal,
				precheck: (parsed) => {
					assertNoLexicalEscape(parsed.privateRef)
					target = resolve(options.root, parsed.privateRef)
				},
				mechanism: (_parsed, innerSignal) => mechanism(target, innerSignal),
				postcheck: (parsed) =>
					assertInsideRoot(options.root, parsed.privateRef, target),
				assemble: (raw, parsed) => ({
					privateRef: parsed.privateRef,
					bytes: raw,
				}),
			})
		},
	}
}
