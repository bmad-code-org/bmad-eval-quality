#!/usr/bin/env node

// Every fenced CLI invocation in `README.md` and `docs/` is run against the
// built binary, and the exit code is compared with what the page claims.
//
// The check exists because the documentation once described a product this
// repository does not contain. Exit 64 is `EXIT_USAGE` (`src/cli/exit-codes.ts`),
// which the CLI returns when a command or a flag does not exist, so a reference
// page only survives the build while every flag it documents is one the parser
// really has.
//
// Exit 64 is not the only way a documented example can be wrong. An example
// whose inputs no longer parse exits 5, and for a while every pre-flight
// example in the site did exactly that, against a `ProbeObservation` that had
// become a discriminated union, while this check reported no problems. So the
// exit code is judged too, wherever judging it means anything:
//
//   * A usage error and a crash always fail, for every invocation. Both are
//     about the command line alone, so a stand-in input cannot excuse them.
//   * An invocation is FAITHFUL when every input it names resolved to real
//     bytes: a file this repository ships, a file the same page told the reader
//     to create, or an artifact an earlier command on the page wrote. A
//     faithful run is the page's own claim, so it has to exit 0.
//   * A page that deliberately demonstrates a failure declares the code it
//     expects, in an HTML comment on the line before the fence:
//
//         <!-- expect-exit: 4 -->
//
//     A faithful run under that declaration has to exit exactly 4. Declaring a
//     code the run does not produce fails too: a documented rejection that
//     stopped rejecting is as stale as a flag that stopped existing.
//   * Anything else is UNFAITHFUL: the page named a file only its reader has,
//     so this check substitutes a stand-in and the exit code says nothing about
//     the page. Those keep the usage-error judgment and no more.
//
// To make a page's own examples faithful, the run replays each page in
// document order inside its own sandbox: a `cat > path <<'EOF'` heredoc, an
// `echo ... > path` redirect, and a `mkdir -p` all take effect, and `--out`
// lands where the page says it does. Every one of those paths is rebased under
// a temporary directory first, so the check still writes nothing into the
// repository and nothing outside its own sandbox.
//
// Usage:
//   npm run check:doc-invocations

import { spawnSync } from 'node:child_process'
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const builtMain = join(repoRoot, 'dist/cli/main.js')

/** A build is a precondition, so `npm run validate` before one stays green. */
if (!existsSync(builtMain)) {
	console.log(
		'check:doc-invocations: dist/cli/main.js is absent, skipped. Run `npm run build` first.',
	)
	process.exit(0)
}

/** The doc roots that document the command line. */
const ROOTS = ['README.md', 'docs']

/** A placeholder path stands in for this, which compiles and seals cleanly. */
const SAMPLE_INPUT = join(
	repoRoot,
	'corpus/dev/compile-seal-example/contract.json',
)

/**
 * The binary's spellings, each capturing the argument tail. The bare form
 * requires whitespace or end of line after the name, so a rendered diagnostic
 * is left alone: every line the CLI writes to stderr is
 * `eval-quality: <code>: <artifactPath>: <detail>` or `eval-quality: usage:
 * <message>`, and a documented sample of that output is not an invocation.
 */
const SPELLINGS = [
	/^npx\s+(?:-y\s+)?eval-quality(?:\s+(.*))?$/,
	/^eval-quality(?:\s+(.*))?$/,
	/^node\s+dist\/cli\/main\.js(?:\s+(.*))?$/,
]

/** What the shell would take over. Everything from here on is not the binary's. */
const SHELL_OPERATORS = new Set(['|', '||', '>', '>>', '<', '&&', ';', '&'])

/**
 * The published package root is this repository's root: `files` in
 * `package.json` publishes `corpus` and `schemas` from here. So a page written
 * for a reader who ran `npm install` names its inputs under
 * `node_modules/eval-quality/`, and mapping that prefix away is what lets those
 * examples be checked against real bytes rather than a stand-in.
 */
const INSTALLED_PREFIX = 'node_modules/eval-quality/'

const EXPECT_EXIT_PATTERN = /^<!--\s*expect-exit:\s*(\d{1,3})\s*-->$/

const PER_INVOCATION_TIMEOUT_MS = 30_000

const collectMarkdown = (target) => {
	const info = statSync(target, { throwIfNoEntry: false })
	if (!info) return []
	if (info.isFile()) return target.endsWith('.md') ? [target] : []
	return readdirSync(target).flatMap((entry) =>
		collectMarkdown(join(target, entry)),
	)
}

/** Splits on whitespace, keeping a quoted value in one piece. */
function tokenize(line) {
	const tokens = []
	let current = ''
	let quote = null
	let started = false
	for (const char of line) {
		if (quote !== null) {
			if (char === quote) quote = null
			else current += char
			continue
		}
		if (char === '"' || char === "'") {
			quote = char
			started = true
			continue
		}
		if (/\s/.test(char)) {
			if (started) tokens.push(current)
			current = ''
			started = false
			continue
		}
		current += char
		started = true
	}
	if (started) tokens.push(current)
	return tokens
}

const isMetavariable = (token) => /^<.+>$/.test(token) || /^\[.+\]$/.test(token)

/** A bare word with no separator and no extension is an id or a subcommand. */
const looksLikePath = (token) =>
	!token.startsWith('-') &&
	(token.includes('/') || /\.[A-Za-z0-9]+$/.test(token))

/**
 * One page's sandbox. `root` is the working directory every command on the
 * page runs in, and every path the page names lands under it, so an absolute
 * path in the documentation reaches a file the check owns.
 */
function createPageSandbox(workDir, index) {
	const root = join(workDir, `page-${index}`)
	mkdirSync(root, { recursive: true })
	return {
		root,
		/** Where a documented path lives inside this sandbox. */
		rebase: (documented) =>
			isAbsolute(documented)
				? join(root, documented.slice(1))
				: resolve(root, documented),
	}
}

const writeInto = (target, contents) => {
	mkdirSync(dirname(target), { recursive: true })
	writeFileSync(target, contents, 'utf8')
}

/**
 * Where one documented input token really points. `faithful` is false when the
 * page named something only its reader has, which is what tells the caller the
 * exit code of the run is not the page's own.
 */
function realizeInput(token, sandbox) {
	if (isMetavariable(token)) return { value: SAMPLE_INPUT, faithful: false }
	if (!looksLikePath(token)) return { value: token, faithful: true }

	if (token.startsWith(INSTALLED_PREFIX)) {
		const published = resolve(repoRoot, token.slice(INSTALLED_PREFIX.length))
		if (existsSync(published)) return { value: published, faithful: true }
	}

	const shipped = resolve(repoRoot, token)
	if (existsSync(shipped)) return { value: shipped, faithful: true }

	const authored = sandbox.rebase(token)
	if (existsSync(authored)) return { value: authored, faithful: true }

	return { value: SAMPLE_INPUT, faithful: false }
}

/**
 * Rewrites the argument tail into something safe to execute, and reports
 * whether every input in it resolved to real bytes.
 */
function realizeArguments(tail, sandbox) {
	const tokens = []
	let faithful = true
	const raw = tokenize(tail)
	for (let index = 0; index < raw.length; index += 1) {
		const token = raw[index]
		if (SHELL_OPERATORS.has(token)) break

		// `--out` is where the page says it is, rebased into the sandbox, so the
		// next command on the page can read what this one wrote.
		if (token === '--out') {
			const target = sandbox.rebase(raw[index + 1] ?? '.')
			mkdirSync(target.endsWith('.json') ? dirname(target) : target, {
				recursive: true,
			})
			tokens.push('--out', target)
			index += 1
			continue
		}
		if (token.startsWith('--out=')) {
			const target = sandbox.rebase(token.slice('--out='.length))
			mkdirSync(target.endsWith('.json') ? dirname(target) : target, {
				recursive: true,
			})
			tokens.push(`--out=${target}`)
			continue
		}

		const equals = token.indexOf('=')
		if (token.startsWith('--') && equals !== -1) {
			const realized = realizeInput(token.slice(equals + 1), sandbox)
			faithful &&= realized.faithful
			tokens.push(`${token.slice(0, equals)}=${realized.value}`)
			continue
		}

		const realized = realizeInput(token, sandbox)
		faithful &&= realized.faithful
		tokens.push(realized.value)
	}
	return { tokens, faithful }
}

/**
 * Pulls one page's actions out of its fenced blocks, in document order: the
 * files it tells the reader to create, and the commands it tells them to run.
 *
 * A `$ ` prompt is stripped, a trailing backslash joins the next line, and a
 * line that names no binary is output. A tail opening with a metavariable is a
 * synopsis, so it is skipped.
 *
 * A block introduced by a `Usage:` line is the binary's own grammar reproduced
 * from `--help`, so every line under it is skipped: `[--in <path>]` is optional
 * -flag notation, and the grammar wraps across lines, which would otherwise be
 * executed as a command missing half its flags. The block ends at the next
 * fence or the next unindented line.
 */
function extractActions(file, source) {
	const lines = source.split('\n')
	const actions = []
	let inFence = false
	let inGrammar = false
	let expectExit = null
	let previous = ''

	for (let index = 0; index < lines.length; index += 1) {
		const raw = lines[index]

		if (raw.trimStart().startsWith('```')) {
			if (!inFence) {
				const declared = previous.trim().match(EXPECT_EXIT_PATTERN)
				expectExit = declared ? Number(declared[1]) : null
			} else expectExit = null
			inFence = !inFence
			inGrammar = false
			previous = raw
			continue
		}
		if (inGrammar && raw.trim() !== '' && !/^\s/.test(raw)) inGrammar = false
		if (raw.trim() === 'Usage:') {
			inGrammar = true
			previous = raw
			continue
		}
		if (inGrammar || !inFence) {
			if (raw.trim() !== '') previous = raw
			continue
		}

		let text = raw.trim().replace(/^\$\s+/, '')

		// `cat > path <<'EOF'` … `EOF`: a file the page tells the reader to write.
		const heredoc = text.match(/^cat\s+>\s*(\S+)\s*<<-?\s*'?([A-Za-z_]\w*)'?$/)
		if (heredoc) {
			const [, target, delimiter] = heredoc
			const body = []
			index += 1
			while (index < lines.length && lines[index].trim() !== delimiter) {
				body.push(lines[index])
				index += 1
			}
			actions.push({
				kind: 'write',
				target,
				contents: `${body.join('\n')}\n`,
			})
			continue
		}

		const echoed = text.match(/^echo\s+(.+?)\s*>\s*(\S+)$/)
		if (echoed) {
			actions.push({
				kind: 'write',
				target: echoed[2],
				contents: `${echoed[1].replace(/^['"]|['"]$/g, '')}\n`,
			})
			continue
		}

		const made = text.match(/^mkdir\s+-p\s+(\S+)$/)
		if (made) {
			actions.push({ kind: 'mkdir', target: made[1] })
			continue
		}

		const startLine = index + 1
		while (text.endsWith('\\') && index + 1 < lines.length) {
			index += 1
			text = `${text.slice(0, -1).trim()} ${lines[index].trim()}`
		}

		const match = SPELLINGS.map((pattern) => text.match(pattern)).find(Boolean)
		if (!match) continue
		const tail = (match[1] ?? '').trim()
		if (tail === '') continue
		const first = tokenize(tail)[0]
		if (first !== undefined && isMetavariable(first)) continue

		actions.push({
			kind: 'run',
			file,
			line: startLine,
			invocation: text,
			tail,
			expectExit,
		})
	}
	return actions
}

const files = ROOTS.flatMap((root) =>
	collectMarkdown(join(repoRoot, root)),
).sort()

const workDir = mkdtempSync(join(tmpdir(), 'check-doc-invocations-'))

const failures = []
let scanned = 0
let judged = 0

try {
	for (const [index, absolute] of files.entries()) {
		const file = absolute.slice(repoRoot.length)
		const sandbox = createPageSandbox(workDir, index)

		for (const action of extractActions(file, readFileSync(absolute, 'utf8'))) {
			if (action.kind === 'mkdir') {
				mkdirSync(sandbox.rebase(action.target), { recursive: true })
				continue
			}
			if (action.kind === 'write') {
				writeInto(sandbox.rebase(action.target), action.contents)
				continue
			}

			scanned += 1
			const { tokens, faithful } = realizeArguments(action.tail, sandbox)
			// The sandbox root is the working directory and stdin is closed: a
			// relative write lands inside the sandbox, and a command that reads
			// stdin sees an empty stream and returns at once.
			const result = spawnSync(process.execPath, [builtMain, ...tokens], {
				cwd: sandbox.root,
				encoding: 'utf8',
				input: '',
				timeout: PER_INVOCATION_TIMEOUT_MS,
			})
			if (result.error) {
				console.error(
					`check:doc-invocations: could not run ${action.file}:${action.line}: ${result.error.message}`,
				)
				process.exit(1)
			}

			const record = (reason) =>
				failures.push({
					...action,
					stderr: result.stderr.trim(),
					status: result.status,
					reason,
				})

			// A Node stack means the binary died before it could decide anything,
			// and a check that only read the exit code would take that for a pass.
			if (/\bnode:internal\b/.test(result.stderr)) {
				record('the binary crashed')
				continue
			}
			if (result.status === 64) {
				record('usage error: the documented command or flag does not exist')
				continue
			}
			if (!faithful) {
				if (action.expectExit !== null) {
					record(
						`the block declares expect-exit ${action.expectExit}, but this invocation names a file only a reader has, so its exit code is not the page's own`,
					)
				}
				continue
			}

			judged += 1
			const expected = action.expectExit ?? 0
			if (result.status !== expected) {
				record(
					action.expectExit === null
						? `exited ${result.status} over inputs this repository really has; a documented example has to work, or declare its exit with an "<!-- expect-exit: N -->" comment before the block`
						: `exited ${result.status}, and the block declares expect-exit ${expected}`,
				)
			}
		}
	}
} finally {
	rmSync(workDir, { recursive: true, force: true })
}

if (failures.length > 0) {
	console.error(
		`check:doc-invocations: ${failures.length} failing invocation(s) across ${scanned} scanned:`,
	)
	for (const failure of [...failures].sort((a, b) =>
		a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1,
	)) {
		console.error(
			`  ${failure.file}:${failure.line} [${failure.reason}] ${failure.invocation}`,
		)
		for (const line of failure.stderr.split('\n')) {
			if (line !== '') console.error(`    ${line}`)
		}
	}
	process.exit(1)
}

console.log(
	`check:doc-invocations: ${scanned} invocation(s) scanned across ${files.length} doc file(s), ${judged} run faithfully over real inputs, 0 failures`,
)
