// A published gate: every fenced command-line invocation in the pages a
// consumer names is run against the binary whose spelling opens the line, and
// the exit code is compared with what the page claims.
//
// A section names one binary, or several. A package that publishes two
// commands documents both, and each one carries its own built entry, its own
// spellings and its own installed-path prefix. Every spelling is matched
// against the same page and the longest one wins, because two published names
// commonly share a prefix and declaration order says nothing about which of
// them a line belongs to.
//
// The check exists because the documentation once described a product this
// repository does not contain. A usage exit is what a command line returns when
// a command or a flag does not exist, so a reference page only survives the
// build while every flag it documents is one the parser really has.
//
// A usage exit is not the only way a documented example can be wrong. An
// example whose inputs no longer parse exits with some other code, and for a
// while every pre-flight example in this repository's site did exactly that,
// against a type that had become a discriminated union, while this check
// reported no problems. So the exit code is judged too, wherever judging it
// means anything:
//
//   * A crash always fails, for every invocation, and so does a usage error the
//     page did not declare. Both are about the command line alone, so a
//     stand-in input cannot excuse them. A page that declares the usage exit
//     for a faithful invocation is claiming that refusal on purpose, which is
//     what a binary spending that code on a configuration it would not read
//     needs.
//   * An invocation is FAITHFUL when every input it names resolved to real
//     bytes: a file the repository ships, a file the same page told the reader
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
//   * Everything else names a file only the reader has, such as `<path>`, so
//     this check substitutes a stand-in and the exit code says nothing about
//     the page. Those keep the usage-error judgment and no more.
//
// The exit code alone is a weak claim, because it is shared. One code commonly
// covers a whole family of failures, so a page can name one failure while the
// binary reports another and the codes still agree. A page that declares its
// exit code may therefore transcribe the output beside it, and that block is
// compared line for line against what the run wrote: stderr when the run wrote
// any, and stdout otherwise, since a page documenting a command that worked is
// quoting the answer rather than a diagnostic. Four rules shape which block gets
// compared:
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
//     more elisions than the configured limit is an error, since matching them
//     is polynomial in the count.
//
// To make a page's own examples faithful, the run replays each page in
// document order inside its own sandbox: a `cat > path <<'EOF'` heredoc, an
// `echo ... > path` redirect, and a `mkdir -p` all take effect, and `--out`
// lands where the page says it does. Every one of those paths is rebased under
// a temporary directory first, so the check still writes nothing into the
// repository and nothing outside its own sandbox.
//
// The gate writes to no stream and calls no exit. It returns a report, and
// `gates-cli.ts` turns that into output and a code.

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

/** A path the configuration named and the tree does not have. */
export const DOC_PATH_ERROR = 'EVAL_QUALITY_DOC_PATH'

const codedError = (code, message) =>
	Object.assign(new Error(message), { code })

/** What the shell would take over. Everything from here on is not the binary's. */
const SHELL_OPERATORS = new Set(['|', '||', '>', '>>', '<', '&&', ';', '&'])

const EXPECT_EXIT_PATTERN = /^<!--\s*expect-exit:\s*(\d{1,3})\s*-->$/

/** What a page writes where it left characters, or a whole line, out. */
const ELISION = '...'

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

const escapeForPattern = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * One spelling of the binary, as the page writes it, capturing the argument
 * tail. The consumer declares the spelling as the literal text a reader types,
 * so nothing here compiles a regular expression the configuration wrote.
 *
 * The bare form requires whitespace or end of line after the name, so a
 * rendered diagnostic is left alone: a line a command line writes to stderr
 * opens with the binary's name and a colon, and a documented sample of that
 * output is not an invocation.
 */
const spellingPattern = (spelling) =>
	new RegExp(
		`^${spelling.trim().split(/\s+/).map(escapeForPattern).join('\\s+')}(?:\\s+(.*))?$`,
	)

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
function realizeInput(token, sandbox, context) {
	const { repoRoot, sampleInput, installedPrefix } = context
	if (isMetavariable(token)) return { value: sampleInput, faithful: false }
	if (!looksLikePath(token)) return { value: token, faithful: true }

	const candidates =
		installedPrefix !== undefined && token.startsWith(installedPrefix)
			? [
					resolve(repoRoot, token.slice(installedPrefix.length)),
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

	return { value: sampleInput, faithful: false }
}

/**
 * Rewrites the argument tail into something safe to execute, and reports
 * whether every input in it resolved to real bytes.
 */
function realizeArguments(tail, sandbox, context) {
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
			const realized = realizeInput(token.slice(equals + 1), sandbox, context)
			faithful &&= realized.faithful
			tokens.push(`${token.slice(0, equals)}=${realized.value}`)
			continue
		}

		const realized = realizeInput(token, sandbox, context)
		faithful &&= realized.faithful
		tokens.push(realized.value)
	}
	return { tokens, faithful }
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

/** The transcribed block without the blank lines that frame it in the page. */
function trimBlankEdges(block) {
	let first = 0
	let last = block.length
	while (first < last && block[first].trim() === '') first += 1
	while (last > first && block[last - 1].trim() === '') last -= 1
	return block.slice(first, last)
}

/**
 * Whether one documented output line describes the line the run really wrote.
 * `...` elides a run of characters within the line, and the rest of the line is
 * matched whole: failure codes share prefixes, so a documented line left
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
 * lines is that invocation's transcribed output, and it travels on the run as
 * `expectStderr`. Only a declared-exit invocation collects one, so a page opts
 * in to the comparison by declaring what the run returns. The fence has to have
 * pushed exactly one such invocation, since both would carry its declaration.
 *
 * `spellings` is every spelling across every declared binary, already sorted
 * longest first, and each one carries the index of the binary it belongs to.
 * That index travels on the run, so the caller knows which entry to execute and
 * whose installed-path prefix to resolve the arguments against.
 */
function extractActions(file, source, spellings) {
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

		const matched = spellings
			.map((spelling) => ({ spelling, match: text.match(spelling.pattern) }))
			.find((candidate) => candidate.match !== null)
		if (matched === undefined) continue
		const tail = (matched.match[1] ?? '').trim()
		if (tail === '') continue
		const first = tokenize(tail)[0]
		if (first !== undefined && isMetavariable(first)) continue

		const action = {
			kind: 'run',
			file,
			line: startLine,
			invocation: text,
			tail,
			binary: matched.spelling.binary,
			expectExit,
			expectStderr: null,
		}
		actions.push(action)
		if (expectExit !== null) fenceRuns.push(action)
	}
	return actions
}

/**
 * Runs every documented invocation under one configuration and reports what
 * failed.
 *
 * `root` is the directory the configuration file sits in, and every path the
 * section names resolves against it.
 */
export function runDocInvocations(root, section) {
	// One binary is the ordinary case and stays spelled as one object. The list
	// is built once here, so everything below reads the same shape.
	const declared = Array.isArray(section.binary)
		? section.binary
		: [section.binary]
	const binaries = declared.map((binary) => ({
		entry: resolve(root, binary.entry),
		installedPrefix: binary.installedPrefix,
	}))

	// A build is a precondition rather than an excuse. Skipping here would let
	// the gate exit 0 having executed nothing, which is the vacuous pass the
	// whole check exists to prevent. The refusal names which binary is missing,
	// since a reader with two of them has two build steps to choose between.
	for (const [index, binary] of binaries.entries()) {
		if (existsSync(binary.entry)) continue
		const field =
			declared.length === 1 ? 'binary.entry' : `binary[${index}].entry`
		throw codedError(
			DOC_PATH_ERROR,
			`${binary.entry} does not exist; the "doc-invocations" section names it under ${field}, so build it before the gate runs`,
		)
	}

	const sampleInput = resolve(root, section.sampleInput)
	if (!existsSync(sampleInput)) {
		throw codedError(
			DOC_PATH_ERROR,
			`${sampleInput} does not exist; the "doc-invocations" section names it under sampleInput, and it is what stands in for an input only a reader has`,
		)
	}

	// A page root that encloses the configuration is the easiest thing to write
	// and the worst thing to run: it reaches every page in the tree, planning
	// material included, and every fenced command inside them.
	//
	// Canonical paths, because `resolve` follows no symlink: a link pointing at
	// the repository would otherwise walk straight past this guard.
	const canonical = (target) => {
		try {
			return realpathSync(target)
		} catch {
			return target
		}
	}
	const configRoot = canonical(resolve(root))
	for (const page of section.pages) {
		const named = canonical(resolve(root, page))
		const enclosing = named.endsWith(sep) ? named : `${named}${sep}`
		if (
			`${configRoot}${configRoot.endsWith(sep) ? '' : sep}`.startsWith(
				enclosing,
			)
		) {
			throw codedError(
				DOC_PATH_ERROR,
				`the "doc-invocations" section names "${page}" under pages, and that encloses the directory the configuration sits in; name a page or a directory inside it, since every fenced command under a whole repository is more than this gate should run`,
			)
		}
	}

	// Longest first, and the first match wins. Two published names commonly
	// share a prefix, so matching in declaration order would let a short
	// spelling belonging to one binary claim a line that opens with a longer
	// spelling belonging to another, and the line would then run against the
	// wrong entry and be judged against the wrong installed-path prefix.
	const spellings = declared
		.flatMap((binary, index) =>
			binary.spellings.map((spelling) => ({
				text: spelling.trim(),
				pattern: spellingPattern(spelling),
				binary: index,
			})),
		)
		.sort((a, b) => b.text.length - a.text.length)

	const repoRoot = resolve(root)
	// One context per binary, because `installedPrefix` belongs to the binary a
	// line matched. Two binaries on one page can map different installed paths.
	const contexts = binaries.map((binary) => ({
		repoRoot,
		sampleInput,
		installedPrefix: binary.installedPrefix,
	}))

	const files = section.pages
		.flatMap((page) => collectMarkdown(resolve(root, page)))
		.sort()

	// A root that reaches no page is a gate reporting a pass over nothing.
	if (files.length === 0) {
		throw codedError(
			DOC_PATH_ERROR,
			`no markdown under ${section.pages.join(', ')}; the "doc-invocations" section names those under pages and the gate would report a pass over nothing`,
		)
	}

	const workDir = mkdtempSync(join(tmpdir(), 'doc-invocations-'))
	const failures = []
	let scanned = 0
	let judged = 0
	let compared = 0

	try {
		for (const [index, absolute] of files.entries()) {
			const file = absolute.startsWith(repoRoot)
				? absolute.slice(repoRoot.length + 1)
				: absolute
			const sandbox = createPageSandbox(workDir, index)

			for (const action of extractActions(
				file,
				readFileSync(absolute, 'utf8'),
				spellings,
			)) {
				if (action.kind === 'mkdir') {
					mkdirSync(sandbox.rebase(action.target), { recursive: true })
					continue
				}
				if (action.kind === 'write') {
					writeInto(sandbox.rebase(action.target), action.contents)
					continue
				}

				scanned += 1
				const { tokens, faithful } = realizeArguments(
					action.tail,
					sandbox,
					contexts[action.binary],
				)
				// The sandbox root is the working directory and stdin is closed: a
				// relative write lands inside the sandbox, and a command that reads
				// stdin sees an empty stream and returns at once.
				const result = spawnSync(
					process.execPath,
					[binaries[action.binary].entry, ...tokens],
					{
						cwd: sandbox.root,
						encoding: 'utf8',
						input: '',
						timeout: section.timeoutMs,
					},
				)
				// A run that never started carries no streams, so the report reads
				// them defensively rather than dying while writing a failure.
				const record = (reason) =>
					failures.push({
						...action,
						stderr: (result.stderr ?? '').trim(),
						status: result.status,
						reason,
					})

				if (result.error) {
					// A timeout arrives here too, and a documented command that never
					// finishes is the page's problem rather than the configuration's.
					record(
						`did not run to a verdict: ${result.error.message} (the section allows ${section.timeoutMs}ms)`,
					)
					continue
				}
				// A killed process carries a null status, so every comparison below
				// would miss and the report would read "exited null".
				if (result.status === null) {
					record(
						`was killed by ${result.signal ?? 'a signal'} and decided nothing`,
					)
					continue
				}

				// A Node stack means the binary died before it could decide anything,
				// and a check that only read the exit code would take that for a pass.
				if (/\bnode:internal\b/.test(result.stderr)) {
					record('the binary crashed')
					continue
				}
				// A usage exit is a mistyped command or a flag that stopped existing,
				// except where the page declares it. One binary can spend the same
				// code on a configuration it refused to read, and a page teaching a
				// reader to recognise that refusal is making a claim about it like
				// any other. The declaration is what separates the two, so an
				// undeclared usage exit still fails every invocation.
				if (
					result.status === section.usageExit &&
					action.expectExit !== section.usageExit
				) {
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
				// A page documenting a rejection quotes stderr, and a page
				// documenting a command that worked quotes stdout. A run that wrote
				// nothing to stderr is the second case, so the block is compared
				// against what the run actually said rather than against an empty
				// stream. Declaring the exit code is still what attaches a block at
				// all, so no page acquires a comparison it did not ask for.
				const written = (
					result.stderr.trim() === '' ? result.stdout : result.stderr
				).split('\n')
				const documented = action.expectStderr
				const overElided = documented.findIndex(
					(line) => line.split(ELISION).length - 1 > section.elisionLimit,
				)
				if (overElided !== -1) {
					record(
						`line ${overElided + 1} of the block beside it elides ${section.elisionLimit} times over; transcribe the line or cut it`,
					)
					continue
				}

				// A documented line past the end of stderr fails, `...` included: a
				// page may transcribe less than the run wrote and never more.
				const drift = documented.findIndex((line, position) => {
					const wrote = written[position]
					return (
						wrote === undefined ||
						!describesLine(line.trimEnd(), wrote.trimEnd())
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

	// A run that extracted nothing is the shape a mistyped spelling takes: every
	// page is read, every fence is skipped, and the gate reports a clean pass over
	// no commands at all. The pages are there and the binary is there, so the one
	// thing left to name is the spelling list.
	if (scanned === 0) {
		throw codedError(
			DOC_PATH_ERROR,
			`no fenced command in ${files.length} page(s) matched any spelling the "doc-invocations" section declares (${spellings.map((spelling) => spelling.text).join(', ')}); a gate that extracted nothing reports a pass over nothing`,
		)
	}

	return { failures, scanned, judged, compared, pages: files.length }
}
