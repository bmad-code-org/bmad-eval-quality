/**
 * `scripts/check-doc-invocations.mjs` is the gate that keeps a documented
 * command honest, and until these cases existed it was the one check in
 * `validate` with nothing checking it. Both properties below were holes it
 * shipped with: a page could name the wrong failure code beside the right exit
 * code, and a file left at the clone root could stand in for the page's own
 * heredoc.
 *
 * Black-box through the CLI, following `stamp-changelog.test.ts`: a `.mjs`
 * import from a `.ts` test has no declaration under `strict`, and `--root`
 * exists so a fixture page can be driven through the same path the shipped
 * documentation takes.
 *
 * Every case asserts the scanned count as well as the verdict. A case that
 * asserts only `0 failures` passes just as happily when the fixture's command
 * stopped being extracted at all.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SCRIPT = resolve('scripts/check-doc-invocations.mjs')

/** A build is a precondition: the check runs the built binary or skips. */
const BUILT = existsSync(resolve('dist/cli/main.js'))
const NEEDS_BUILD =
	'dist/cli/main.js is absent. Run `npm run build` first: this case runs the built CLI.'

/** A contract this repository ships that compiles cleanly. */
const SHIPPED_CONTRACT = 'corpus/dev/compile-seal-example/contract.json'

/** A contract this repository ships that fails a discipline rule at exit 4. */
const REJECTED_CONTRACT = 'corpus/dev/contracts/empty-request-shapes.json'

/** The first line of the rejection `REJECTED_CONTRACT` produces. */
const UNREACHABLE =
	'eval-quality: unreachable-check-evidence: EvalContract.oracles[id=O-005].check.operands[0].operands[0]: ...'

type Run = { readonly status: number; readonly output: string }

/** Writes one fixture page and runs the check over the directory holding it. */
const check = (page: string): Run => {
	const root = mkdtempSync(join(tmpdir(), 'doc-invocations-case-'))
	writeFileSync(join(root, 'page.md'), page, 'utf8')
	const result = spawnSync(process.execPath, [SCRIPT, '--root', root], {
		encoding: 'utf8',
	})
	return {
		status: result.status ?? -1,
		output: `${result.stdout}${result.stderr}`,
	}
}

const fence = (...lines: readonly string[]): string => lines.join('\n')

/** A page whose one declared-exit command is followed by `block`. */
const rejectionPage = (...block: readonly string[]): string =>
	fence(
		'# A page',
		'',
		'<!-- expect-exit: 4 -->',
		'',
		'```bash',
		`node dist/cli/main.js compile --in ${REJECTED_CONTRACT}`,
		'```',
		'',
		...block,
		'',
	)

describe('check-doc-invocations, the transcribed diagnostic', () => {
	it('passes when the block beside the command is what the run wrote', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const run = check(rejectionPage('```text', UNREACHABLE, '```'))
		expect(run.output).toContain('1 invocation(s) scanned')
		expect(run.output).toContain('1 with their output compared, 0 failures')
		expect(run.status).toBe(0)
	})

	it('fails when the page names a failure the run did not produce', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const run = check(
			rejectionPage(
				'```text',
				'eval-quality: duplicate-operation-signature: EvalContract: ...',
				'```',
			),
		)
		expect(run.status).toBe(1)
		expect(run.output).toContain('1 failing invocation(s)')
		expect(run.output).toContain('duplicate-operation-signature')
		// The exit code agreed, so the code alone would have passed this page.
		expect(run.output).not.toContain('expect-exit 4')
	})

	it('fails a documented line that stops short of the whole line', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		// `unreachable-check` is a prefix of the code the run really names, and
		// several codes in this package are prefixes of a sibling. Without the
		// end anchor a page could describe either one.
		const run = check(
			rejectionPage('```text', 'eval-quality: unreachable-check', '```'),
		)
		expect(run.status).toBe(1)
		expect(run.output).toContain('1 failing invocation(s)')
	})

	it('reads a blank documented line as a blank output line', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		// A blank line inside the block used to match anything, which slid
		// every line after it one position out of alignment.
		const run = check(
			rejectionPage(
				'```text',
				UNREACHABLE,
				'',
				'eval-quality: a line the run never wrote',
				'```',
			),
		)
		expect(run.status).toBe(1)
		expect(run.output).toContain('as line 3 of the output')
	})

	it('compares a block indented under a list item', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const run = check(
			fence(
				'1. Run it:',
				'',
				'   <!-- expect-exit: 4 -->',
				'',
				'   ```bash',
				`   node dist/cli/main.js compile --in ${REJECTED_CONTRACT}`,
				'   ```',
				'',
				'   ```text',
				`   ${UNREACHABLE}`,
				'   ```',
				'',
			),
		)
		expect(run.output).toContain('1 invocation(s) scanned')
		expect(run.output).toContain('1 with their output compared, 0 failures')
		expect(run.status).toBe(0)
	})

	it('compares a `text` fence that carries attributes', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const run = check(
			rejectionPage('```text title="stderr"', 'eval-quality: a lie', '```'),
		)
		expect(run.status).toBe(1)
		expect(run.output).toContain('1 failing invocation(s)')
	})

	it('leaves a block after an invocation with no declared exit alone', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const run = check(
			fence(
				'# A page',
				'',
				'```bash',
				`node dist/cli/main.js compile --in ${SHIPPED_CONTRACT}`,
				'```',
				'',
				'```text',
				'exit 0',
				'```',
				'',
			),
		)
		expect(run.output).toContain('1 invocation(s) scanned')
		expect(run.output).toContain('0 with their output compared, 0 failures')
		expect(run.status).toBe(0)
	})

	it('leaves a block separated from the command by prose alone', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const run = check(
			rejectionPage(
				'This block is a shape, and no run produced it.',
				'',
				'```text',
				'eval-quality: duplicate-operation-signature: EvalContract: ...',
				'```',
			),
		)
		expect(run.output).toContain('1 invocation(s) scanned')
		expect(run.output).toContain('0 with their output compared, 0 failures')
		expect(run.status).toBe(0)
	})

	it('leaves a block separated by a `Usage:` line alone', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		// `Usage:` opens the grammar-block branch, which returns before the
		// line that detaches an output block, so it needed its own detach.
		const run = check(
			rejectionPage(
				'Usage:',
				'',
				'```text',
				'eval-quality: duplicate-operation-signature: EvalContract: ...',
				'```',
			),
		)
		expect(run.output).toContain('1 invocation(s) scanned')
		expect(run.output).toContain('0 with their output compared, 0 failures')
		expect(run.status).toBe(0)
	})

	it('leaves a block below a fence carrying two commands alone', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		// Both commands carry the fence's declaration, so neither owns the
		// block, and attaching it to one would quote the other's transcript.
		const run = check(
			fence(
				'# A page',
				'',
				'<!-- expect-exit: 4 -->',
				'',
				'```bash',
				`node dist/cli/main.js compile --in ${REJECTED_CONTRACT}`,
				'node dist/cli/main.js compile --in corpus/dev/contracts/no-state-change-marker.json',
				'```',
				'',
				'```text',
				UNREACHABLE,
				'```',
				'',
			),
		)
		expect(run.output).toContain('2 invocation(s) scanned')
		expect(run.output).toContain('0 with their output compared, 0 failures')
		expect(run.status).toBe(0)
	})

	it('matches an elision by the whole line and not by the first hit', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		// `schema` occurs inside `schema-parse-failure` and again at the end of
		// the line. Taking the leftmost hit and then demanding it end the line
		// rejected a page that is correct.
		const run = check(
			fence(
				'# A page',
				'',
				'```bash',
				`cat > ${SHIPPED_CONTRACT} <<'EOF'`,
				'{ "schemaVersion": 4 }',
				'EOF',
				'```',
				'',
				'<!-- expect-exit: 5 -->',
				'',
				'```bash',
				`node dist/cli/main.js compile --in ${SHIPPED_CONTRACT}`,
				'```',
				'',
				'```text',
				'eval-quality: ...schema',
				'```',
				'',
			),
		)
		expect(run.output).toContain('1 with their output compared, 0 failures')
		expect(run.status).toBe(0)
	})

	it('fails a documented line past the end of the output', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		// A bare `...` matches any one line, so it has to require a line.
		const run = check(
			rejectionPage('```text', UNREACHABLE, '...', '...', '...', '```'),
		)
		expect(run.status).toBe(1)
		expect(run.output).toContain('1 failing invocation(s)')
	})

	it('names indentation when that is the whole difference', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		// The block keeps whatever indentation the diagnostic itself emits, so
		// a page that indents an issue line further than the CLI does is wrong.
		// A message quoting the trimmed line would look identical to the output.
		const run = check(
			fence(
				'# A page',
				'',
				'```bash',
				`cat > ${SHIPPED_CONTRACT} <<'EOF'`,
				'{ "schemaVersion": 4 }',
				'EOF',
				'```',
				'',
				'<!-- expect-exit: 5 -->',
				'',
				'```bash',
				`node dist/cli/main.js compile --in ${SHIPPED_CONTRACT}`,
				'```',
				'',
				'```text',
				'eval-quality: schema-parse-failure: EvalContract: ...',
				'      /behaviors: Invalid input: expected array, received undefined',
				'```',
				'',
			),
		)
		expect(run.status).toBe(1)
		expect(run.output).toContain('indented differently from the output')
	})

	it('keeps the indentation the diagnostic itself emits', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		// The same block, transcribed at the two spaces the CLI really writes,
		// inside a fence indented under a list item.
		const run = check(
			fence(
				'1. Run it:',
				'',
				'   ```bash',
				`   cat > ${SHIPPED_CONTRACT} <<'EOF'`,
				'   { "schemaVersion": 4 }',
				'   EOF',
				'   ```',
				'',
				'   <!-- expect-exit: 5 -->',
				'',
				'   ```bash',
				`   node dist/cli/main.js compile --in ${SHIPPED_CONTRACT}`,
				'   ```',
				'',
				'   ```text',
				'   eval-quality: schema-parse-failure: EvalContract: ...',
				'     /behaviors: Invalid input: expected array, received undefined',
				'   ```',
				'',
			),
		)
		expect(run.output).toContain('1 with their output compared, 0 failures')
		expect(run.status).toBe(0)
	})

	it('does not count an empty block as compared', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const run = check(rejectionPage('```text', '```'))
		expect(run.output).toContain('1 invocation(s) scanned')
		expect(run.output).toContain('0 with their output compared, 0 failures')
		expect(run.status).toBe(0)
	})
})

describe('check-doc-invocations, the page owns the paths it writes', () => {
	it("reads the page's heredoc over a real file at the same path", (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		// The documented path is a contract this repository really ships and
		// which compiles at exit 0. The page writes different bytes there, and
		// the run has to be judged against those: reading the shipped file
		// instead would exit 0 against the declared 5.
		const run = check(
			fence(
				'# A page',
				'',
				'```bash',
				`cat > ${SHIPPED_CONTRACT} <<'EOF'`,
				'{ "schemaVersion": 4 }',
				'EOF',
				'```',
				'',
				'<!-- expect-exit: 5 -->',
				'',
				'```bash',
				`node dist/cli/main.js compile --in ${SHIPPED_CONTRACT}`,
				'```',
				'',
				'```text',
				'eval-quality: schema-parse-failure: EvalContract: ...',
				'```',
				'',
			),
		)
		expect(run.output).toContain('1 invocation(s) scanned')
		expect(run.output).toContain('1 with their output compared, 0 failures')
		expect(run.status).toBe(0)
	})

	it('lets a shipped directory win over a directory the page made', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		// `mkdir -p` over a path a clone already carries is a no-op for the
		// reader, so the empty sandbox copy must not stand in front of it: the
		// command would run over an empty corpus and be judged as the page's.
		const run = check(
			fence(
				'# A page',
				'',
				'```bash',
				'mkdir -p corpus/dev',
				'```',
				'',
				'```bash',
				'node dist/cli/main.js compile --in corpus/dev/compile-seal-example/contract.json',
				'```',
				'',
			),
		)
		expect(run.output).toContain('1 invocation(s) scanned')
		expect(run.output).toContain('1 run faithfully over real inputs, ')
		expect(run.output).toContain('0 failures')
		expect(run.status).toBe(0)
	})

	it('lets a shipped file win over a directory the page made', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		// `--out` and `mkdir -p` create a directory under every path they are
		// given. One standing in front of a shipped file fails the run on
		// EISDIR, which the check would report as a usage error the page never
		// made.
		const run = check(
			fence(
				'# A page',
				'',
				'```bash',
				`mkdir -p ${SHIPPED_CONTRACT}`,
				'```',
				'',
				'```bash',
				`node dist/cli/main.js compile --in ${SHIPPED_CONTRACT}`,
				'```',
				'',
			),
		)
		expect(run.output).toContain('1 invocation(s) scanned')
		expect(run.output).toContain('0 failures')
		expect(run.status).toBe(0)
	})
})

describe('check-doc-invocations, a misdriven run is an error', () => {
	const drive = (...args: readonly string[]): Run => {
		const result = spawnSync(process.execPath, [SCRIPT, ...args], {
			encoding: 'utf8',
		})
		return {
			status: result.status ?? -1,
			output: `${result.stdout}${result.stderr}`,
		}
	}

	it('fails on a root holding no markdown', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const run = drive('--root', mkdtempSync(join(tmpdir(), 'empty-root-')))
		expect(run.status).toBe(1)
		expect(run.output).toContain('no markdown under')
	})

	it('fails on --root with no path', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const run = drive('--root')
		expect(run.status).toBe(1)
		expect(run.output).toContain('--root takes a path')
	})

	it('fails on a root that encloses the repository', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		// `--root .` reaches every page in the tree and every fenced command
		// inside them, planning material and dependencies included.
		for (const root of ['.', '', '..']) {
			const run = drive('--root', root)
			expect(run.status).toBe(1)
			expect(run.output).toContain('encloses the repository')
		}
	})

	it('fails on an argument it does not know', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const run = drive('--roots', 'docs')
		expect(run.status).toBe(1)
		expect(run.output).toContain('unrecognized argument')
	})
})
