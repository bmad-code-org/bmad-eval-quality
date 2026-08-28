#!/usr/bin/env node

// Every fenced CLI invocation in `README.md` and `docs/` is run against the
// built binary, and exit 64 fails the build. Sixty-four is `EXIT_USAGE`
// (`src/cli/exit-codes.ts`), which the CLI returns when a command or a flag
// does not exist. A reference page therefore only survives the build while
// every flag it documents is one the parser really has.
//
// The check writes nothing into the repository: it runs from a temporary
// directory and redirects every `--out` there.
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
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
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
 * Docs name files that a reader would have and this repository does not. A path
 * that resolves under the repository root is passed through; anything else
 * becomes the sample contract, which keeps the run about flag existence.
 */
function realizeValue(token) {
	if (isMetavariable(token)) return SAMPLE_INPUT
	if (!looksLikePath(token)) return token
	const candidate = resolve(repoRoot, token)
	return existsSync(candidate) ? candidate : SAMPLE_INPUT
}

/** Rewrites the argument tail into something safe to execute. */
function realizeArguments(tail, outDir) {
	const tokens = []
	const raw = tokenize(tail)
	for (let index = 0; index < raw.length; index += 1) {
		const token = raw[index]
		if (SHELL_OPERATORS.has(token)) break
		if (token === '--out') {
			tokens.push('--out', outDir)
			index += 1
			continue
		}
		if (token.startsWith('--out=')) {
			tokens.push(`--out=${outDir}`)
			continue
		}
		const equals = token.indexOf('=')
		if (token.startsWith('--') && equals !== -1) {
			tokens.push(
				`${token.slice(0, equals)}=${realizeValue(token.slice(equals + 1))}`,
			)
			continue
		}
		tokens.push(realizeValue(token))
	}
	return tokens
}

/**
 * Pulls invocations out of one file's fenced blocks. A `$ ` prompt is stripped,
 * a trailing backslash joins the next line, and a line that names no binary is
 * output. A tail opening with a metavariable is a synopsis, so it is skipped.
 *
 * A block introduced by a `Usage:` line is the binary's own grammar reproduced
 * from `--help`, so every line under it is skipped: `[--in <path>]` is optional
 * -flag notation, and the grammar wraps across lines, which would otherwise be
 * executed as a command missing half its flags. The block ends at the next
 * fence or the next unindented line.
 */
function extractInvocations(file, source) {
	const lines = source.split('\n')
	const found = []
	let inFence = false
	let inGrammar = false
	for (let index = 0; index < lines.length; index += 1) {
		const raw = lines[index]
		if (raw.trimStart().startsWith('```')) {
			inFence = !inFence
			inGrammar = false
			continue
		}
		if (inGrammar && raw.trim() !== '' && !/^\s/.test(raw)) inGrammar = false
		if (raw.trim() === 'Usage:') {
			inGrammar = true
			continue
		}
		if (inGrammar) continue
		if (!inFence) continue

		let text = raw.trim().replace(/^\$\s+/, '')
		const startLine = index + 1
		while (text.endsWith('\\') && index + 1 < lines.length) {
			index += 1
			text = `${text.slice(0, -1).trim()} ${lines[index].trim()}`
		}

		const match = SPELLINGS.map((pattern) => text.match(pattern)).find(Boolean)
		if (!match) continue
		const tail = match[1].trim()
		if (tail === '') continue
		const first = tokenize(tail)[0]
		if (first !== undefined && isMetavariable(first)) continue

		found.push({ file, line: startLine, invocation: text, tail })
	}
	return found
}

const files = ROOTS.flatMap((root) =>
	collectMarkdown(join(repoRoot, root)),
).sort()
const invocations = files.flatMap((file) =>
	extractInvocations(file.slice(repoRoot.length), readFileSync(file, 'utf8')),
)

const workDir = mkdtempSync(join(tmpdir(), 'check-doc-invocations-'))
const outDir = join(workDir, 'out')
mkdirSync(outDir, { recursive: true })

const failures = []
try {
	for (const entry of invocations) {
		const args = realizeArguments(entry.tail, outDir)
		// `cwd` is the temporary directory and stdin is closed: a relative write
		// lands outside the tree, and a command that reads stdin sees an empty
		// stream and returns at once.
		const result = spawnSync(process.execPath, [builtMain, ...args], {
			cwd: workDir,
			encoding: 'utf8',
			input: '',
			timeout: PER_INVOCATION_TIMEOUT_MS,
		})
		if (result.error) {
			console.error(
				`check:doc-invocations: could not run ${entry.file}:${entry.line}: ${result.error.message}`,
			)
			process.exit(1)
		}
		// 64 is the documented failure this check exists for: the command or the
		// flag does not exist. A Node stack is the other one — the binary died
		// before it could decide anything, and a check that only looked at 64
		// would read that as a pass.
		const crashed = /\bnode:internal\b/.test(result.stderr)
		if (result.status === 64 || crashed) {
			failures.push({
				...entry,
				stderr: result.stderr.trim(),
				reason: crashed ? 'the binary crashed' : 'usage error',
			})
		}
	}
} finally {
	rmSync(workDir, { recursive: true, force: true })
}

if (failures.length > 0) {
	console.error(
		`check:doc-invocations: ${failures.length} failing invocation(s) across ${invocations.length} scanned:`,
	)
	for (const failure of [...failures].sort((a, b) =>
		a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1,
	)) {
		console.error(
			`  ${failure.file}:${failure.line} [${failure.reason}] ${failure.invocation}`,
		)
		for (const line of failure.stderr.split('\n')) console.error(`    ${line}`)
	}
	console.error(
		'Exit 64 is the CLI usage error: the documented command or flag does not exist.',
	)
	process.exit(1)
}

console.log(
	`check:doc-invocations: ${invocations.length} invocation(s) scanned across ${files.length} doc file(s), 0 usage errors`,
)
