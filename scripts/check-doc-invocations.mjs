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
// The exit code alone is a weak claim, because it is shared. Exit 4 is
// `EXIT_STRUCTURAL_FAILURE`, the code every discipline rule returns, so a page
// can name one failure while the binary reports another and the codes still
// agree. A page that declares its exit code may therefore transcribe the
// diagnostic beside it, and that block is compared line for line against what
// the run wrote to stderr. Four rules shape which block gets compared:
//
//   * The block is a `text` fence separated from the command's fence by blank
//     lines only. Prose between them detaches it, and a fence carrying any
//     other label is left alone.
//   * The fence above it holds exactly one invocation. Two commands share the
//     fence's declaration, so neither owns the block.
//   * Each documented line has to describe the stderr line at the same
//     position, whole. `...` inside a line elides a run of characters there,
//     and a line that is exactly `...` matches any one line. Without an
//     elision the documented line has to be the entire line, because failure
//     codes share prefixes and an unanchored tail would describe a sibling
//     failure as readily as its own. A page cannot transcribe a literal
//     ellipsis. The indentation the block shares is stripped before any of
//     this, so a fence inside a list item compares the same as one at the
//     margin, and whatever indentation the diagnostic itself emits survives.
//   * Stderr may run past the block, and the block may never run past stderr.
//     A page that transcribes the first lines of a longer diagnostic is making
//     a claim about those lines, and the lines it left out stay unchecked. An
//     empty block claims nothing and is left unattached, and a line carrying
//     more than three elisions is an error, since matching them is polynomial
//     in the count.
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
//   node scripts/check-doc-invocations.mjs --root <path>   (a fixture page)

import { spawnSync } from 'node:child_process'
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	statSync,
	writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path'
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

/** A misdriven run ends here, so it can never report a pass over nothing. */
const fail = (message) => {
	console.error(`check:doc-invocations: ${message}`)
	process.exit(1)
}

/**
 * The doc roots that document the command line. `--root <path>` and
 * `--root=<path>` replace them and may be repeated, which is what lets a test
 * drive this check over a fixture page. A malformed override is an error: a
 * mistyped root that fell back to the shipped documentation, or to nothing at
 * all, would report a pass over pages nobody meant to check.
 */
const ROOTS = (() => {
	const args = process.argv.slice(2)
	const overrides = []
	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index]
		if (argument.startsWith('--root=')) {
			overrides.push(argument.slice('--root='.length))
			continue
		}
		if (argument !== '--root') fail(`unrecognized argument "${argument}"`)
		const value = args[index + 1]
		if (value === undefined || value.startsWith('--')) {
			fail('--root takes a path')
		}
		overrides.push(value)
		index += 1
	}
	// `--root .` is the easiest thing to type and the worst thing to run: it
	// reaches every page in the tree, planning material included, and every
	// fenced command inside them. A root outside the repository is fine, since
	// that is how a fixture page is driven.
	// Canonical paths, because `resolve` follows no symlink: a link pointing at
	// the repository would otherwise walk straight past this guard.
	const canonical = (target) => {
		try {
			return realpathSync(target)
		} catch {
			return target
		}
	}
	const root = canonical(repoRoot)
	for (const override of overrides) {
		const resolved = canonical(resolve(repoRoot, override))
		const enclosing = resolved.endsWith(sep) ? resolved : `${resolved}${sep}`
		if (`${root}${root.endsWith(sep) ? '' : sep}`.startsWith(enclosing)) {
			fail(
				`--root ${override || '""'} encloses the repository; name a page or a directory inside it`,
			)
		}
	}
	return overrides.length > 0 ? overrides : ['README.md', 'docs']
})()

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

/** What a page writes where it left characters, or a whole line, out. */
const ELISION = '...'

/**
 * Elisions allowed in one documented line. Matching them is polynomial in the
 * count, so a line carrying many of them over a long repetitive diagnostic can
 * run for minutes, and no timeout covers this process. Three is more than any
 * real transcript needs and the cap keeps the check's own cost bounded.
 */
const ELISION_LIMIT = 3

const PER_INVOCATION_TIMEOUT_MS = 30_000

/**
 * The pages under one root. A dependency's README and a tool's own directory
 * carry fenced commands nobody here wrote, and running those is the inverse of
 * what this check is for, so the walk never descends into either.
 */
const isSkipped = (name) => name === 'node_modules' || name.startsWith('.')

const collectMarkdown = (target) => {
	if (isSkipped(basename(target))) return []
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

	const candidates = token.startsWith(INSTALLED_PREFIX)
		? [
				resolve(repoRoot, token.slice(INSTALLED_PREFIX.length)),
				resolve(repoRoot, token),
			]
		: [resolve(repoRoot, token)]
	const shipped = candidates.find((candidate) => existsSync(candidate))

	// The page's own bytes win over anything on the real filesystem. A page
	// that writes `mcp-contract.json` and then reads it is describing the file
	// it just wrote, and a reader who followed the page leaves a copy of that
	// name at the clone root. Resolving against the repository first would read
	// the leftover, so the gate would be measuring a file nobody is editing.
	//
	// A directory in the sandbox is the one exception. `--out` and `mkdir -p`
	// create one under every path they are given, and `mkdir -p` over a path the
	// repository already carries is a no-op in a reader's clone. So the empty
	// sandbox copy yields: in front of a file it would fail the run on EISDIR,
	// which the exit code reports as a usage error the page never made, and in
	// front of a directory it would run the command over nothing at all.
	const authored = sandbox.rebase(token)
	const made = statSync(authored, { throwIfNoEntry: false })
	const shadows = made?.isDirectory() === true && shipped !== undefined
	if (made !== undefined && !shadows) {
		return { value: authored, faithful: true }
	}

	if (shipped !== undefined) return { value: shipped, faithful: true }

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
 *
 * A `text` fence separated from a declared-exit invocation by nothing but blank
 * lines is that invocation's transcribed diagnostic, and it travels on the run
 * as `expectStderr`. Only a declared-exit invocation collects one: a page that
 * shows the output of a command that succeeded is showing stdout, and every
 * page that documents a failure prints it on stderr. The fence has to have
 * pushed exactly one such invocation, since both would carry its declaration.
 */
function extractActions(file, source) {
	const lines = source.split('\n')
	const actions = []
	let inFence = false
	let inGrammar = false
	let expectExit = null
	let previous = ''
	/** The declared-exit run a `text` fence opening here would describe. */
	let described = null
	/** The declared-exit runs the open fence has pushed so far. */
	let fenceRuns = []

	for (let index = 0; index < lines.length; index += 1) {
		const raw = lines[index]

		if (raw.trimStart().startsWith('```')) {
			if (!inFence) {
				if (described !== null && labelOf(raw) === 'text') {
					const body = []
					index += 1
					while (
						index < lines.length &&
						!lines[index].trimStart().startsWith('```')
					) {
						body.push(lines[index])
						index += 1
					}
					const transcript = dedent(trimBlankEdges(body))
					// An empty block claims nothing, so it is left unattached
					// and the run keeps the exit-code judgment alone.
					if (transcript.length > 0) described.expectStderr = transcript
					described = null
					previous = raw
					continue
				}
				described = null
				fenceRuns = []
				const declared = previous.trim().match(EXPECT_EXIT_PATTERN)
				expectExit = declared ? Number(declared[1]) : null
			} else {
				// Two commands in one fence share its declaration, so neither
				// owns the block below: attaching to the last would quote one
				// command's transcript against the other's run.
				described = fenceRuns.length === 1 ? fenceRuns[0] : null
				expectExit = null
			}
			inFence = !inFence
			inGrammar = false
			previous = raw
			continue
		}
		if (inGrammar && raw.trim() !== '' && !/^\s/.test(raw)) inGrammar = false
		if (raw.trim() === 'Usage:') {
			inGrammar = true
			previous = raw
			described = null
			continue
		}
		if (inGrammar || !inFence) {
			if (raw.trim() !== '') {
				previous = raw
				described = null
			}
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
			described = null
			continue
		}

		const echoed = text.match(/^echo\s+(.+?)\s*>\s*(\S+)$/)
		if (echoed) {
			actions.push({
				kind: 'write',
				target: echoed[2],
				contents: `${echoed[1].replace(/^['"]|['"]$/g, '')}\n`,
			})
			described = null
			continue
		}

		const made = text.match(/^mkdir\s+-p\s+(\S+)$/)
		if (made) {
			actions.push({ kind: 'mkdir', target: made[1] })
			described = null
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

		const action = {
			kind: 'run',
			file,
			line: startLine,
			invocation: text,
			tail,
			expectExit,
			expectStderr: null,
		}
		actions.push(action)
		if (expectExit !== null) fenceRuns.push(action)
	}
	return actions
}

/** A fence's own label, so a `text` fence carrying attributes still counts. */
const labelOf = (fence) => fence.trim().slice(3).trim().split(/[\s{]/)[0]

/**
 * A block without the indentation it shares, so a fence inside a list item
 * compares against the same bytes it would at the margin. The shared prefix is
 * the block's own, which keeps whatever indentation the diagnostic itself emits
 * and stays right where the fence and its body are indented differently.
 */
function dedent(block) {
	const prefixes = block
		.filter((line) => line.trim() !== '')
		.map((line) => line.slice(0, line.length - line.trimStart().length))
	const shared = prefixes.reduce((a, b) => {
		let common = 0
		while (common < a.length && a[common] === b[common]) common += 1
		return a.slice(0, common)
	}, prefixes[0] ?? '')
	return block.map((line) => line.slice(shared.length))
}

const escapeForPattern = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Whether one documented output line describes the line the run really wrote.
 * `...` elides a run of characters within the line, and the rest of the line is
 * matched whole: failure codes share prefixes -- `isolation-manifest-absent`
 * beside `isolation-manifest-violation`, `evaluator-configuration-absent`
 * beside `evaluator-configuration-digest-mismatch` -- so a documented line left
 * hanging would describe a sibling failure as readily as its own. A line that
 * is exactly `...` matches any one line.
 */
function describesLine(documented, actual) {
	if (documented === ELISION) return true
	const pattern = documented
		.split(ELISION)
		.map(escapeForPattern)
		.join('[\\s\\S]*')
	return new RegExp(`^${pattern}$`).test(actual)
}

/** The transcribed block without the blank lines that frame it in the page. */
function trimBlankEdges(block) {
	let first = 0
	let last = block.length
	while (first < last && block[first].trim() === '') first += 1
	while (last > first && block[last - 1].trim() === '') last -= 1
	return block.slice(first, last)
}

const files = ROOTS.flatMap((root) =>
	collectMarkdown(resolve(repoRoot, root)),
).sort()

/** A root that reaches no page is a gate reporting a pass over nothing. */
if (files.length === 0) fail(`no markdown under ${ROOTS.join(', ')}`)

const workDir = mkdtempSync(join(tmpdir(), 'check-doc-invocations-'))

const failures = []
let scanned = 0
let judged = 0
let compared = 0

try {
	for (const [index, absolute] of files.entries()) {
		const file = absolute.startsWith(repoRoot)
			? absolute.slice(repoRoot.length)
			: absolute
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
				continue
			}

			// The exit code is shared, so it cannot tell one structural failure
			// from another. The transcribed diagnostic is what names the code
			// the page claims, and it is compared line for line.
			if (action.expectStderr === null) continue
			compared += 1
			const written = result.stderr.split('\n')
			const documented = action.expectStderr
			const overElided = documented.findIndex(
				(line) => line.split(ELISION).length - 1 > ELISION_LIMIT,
			)
			if (overElided !== -1) {
				record(
					`line ${overElided + 1} of the block beside it elides ${ELISION_LIMIT} times over; transcribe the line or cut it`,
				)
				continue
			}

			// A documented line past the end of stderr fails, `...` included: a
			// page may transcribe less than the run wrote and never more.
			const drift = documented.findIndex((line, position) => {
				const wrote = written[position]
				return (
					wrote === undefined || !describesLine(line.trimEnd(), wrote.trimEnd())
				)
			})
			if (drift !== -1) {
				const wrote = written[drift] ?? ''
				const line = documented[drift]
				record(
					line.trim() === wrote.trim() && line !== wrote
						? `the block beside it is indented differently from the output at line ${drift + 1}`
						: `the block beside it transcribes "${line.trim()}" as line ${drift + 1} of the output, and the run wrote something else`,
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
	`check:doc-invocations: ${scanned} invocation(s) scanned across ${files.length} doc file(s), ${judged} run faithfully over real inputs, ${compared} with their output compared, 0 failures`,
)
