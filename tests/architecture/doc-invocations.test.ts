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

/** The rejection `corpus/dev/contracts/empty-request-shapes.json` produces. */
const UNREACHABLE = 'eval-quality: unreachable-check-evidence: EvalContract'

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

describe('check-doc-invocations, the transcribed diagnostic', () => {
	it('passes when the block beside the command is what the run wrote', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const run = check(
			fence(
				'# A page',
				'',
				'<!-- expect-exit: 4 -->',
				'',
				'```bash',
				'node dist/cli/main.js compile --in corpus/dev/contracts/empty-request-shapes.json',
				'```',
				'',
				'```text',
				`${UNREACHABLE}.oracles[id=O-005].check.operands[0].operands[0]: ...`,
				'```',
				'',
			),
		)
		expect(run.output).toContain('1 with their output compared, 0 failures')
		expect(run.status).toBe(0)
	})

	it('fails when the page names a failure the run did not produce', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const run = check(
			fence(
				'# A page',
				'',
				'<!-- expect-exit: 4 -->',
				'',
				'```bash',
				'node dist/cli/main.js compile --in corpus/dev/contracts/empty-request-shapes.json',
				'```',
				'',
				'```text',
				'eval-quality: duplicate-operation-signature: EvalContract: ...',
				'```',
				'',
			),
		)
		expect(run.status).toBe(1)
		expect(run.output).toContain('1 failing invocation(s)')
		expect(run.output).toContain('duplicate-operation-signature')
		// The exit code agreed, so the code alone would have passed this page.
		expect(run.output).not.toContain('expect-exit 4')
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
		expect(run.output).toContain('0 with their output compared, 0 failures')
		expect(run.status).toBe(0)
	})

	it('leaves a block separated from the command by prose alone', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const run = check(
			fence(
				'# A page',
				'',
				'<!-- expect-exit: 4 -->',
				'',
				'```bash',
				'node dist/cli/main.js compile --in corpus/dev/contracts/empty-request-shapes.json',
				'```',
				'',
				'This block is a shape, and no run produced it.',
				'',
				'```text',
				'eval-quality: duplicate-operation-signature: EvalContract: ...',
				'```',
				'',
			),
		)
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
		// instead would exit 0 against the declared 4.
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
		expect(run.output).toContain('1 with their output compared, 0 failures')
		expect(run.status).toBe(0)
	})
})
