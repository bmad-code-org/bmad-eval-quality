/**
 * The one place a documented tool-server run is executed end to end.
 *
 * `tests/application/mcp-end-to-end.test.ts` runs the four stages in process
 * against a hand-written fake port, which is what AD-30 asks of a stage test.
 * This case runs the other half: the tutorial's own helper, the shipped
 * `createMcpAdapter`, MCP's stdio transport, and a real server process, and it
 * holds what came back against the bytes `examples/tutorials/tool-use/` commits.
 *
 * That comparison is what makes the tool-use page's claim checkable. The page
 * tells a reader to run the helper and then hands the committed observations to
 * `preflight` and `score`, so a helper that stopped producing those observations
 * would leave the page teaching from a run nobody can reproduce, and every
 * artifact downstream would still agree with itself.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const REPO = fileURLToPath(new URL('../../', import.meta.url))
const HELPER = join(REPO, 'examples/tutorials/tool-use/run-tool-calls.mjs')
const CONTRACT = join(REPO, 'examples/tutorials/tool-use/contract.json')
const COMMITTED_LEGS = join(
	REPO,
	'examples/tutorials/tool-use/observations.json',
)
const COMMITTED_BASELINE = join(
	REPO,
	'examples/tutorials/tool-use/baseline-steps.json',
)
const COMMITTED_SEEDED = join(
	REPO,
	'examples/tutorials/tool-use/seeded-steps.json',
)

/** A build is a precondition, so `npm run test` before one stays green. */
const BUILT = existsSync(join(REPO, 'dist/index.js'))
const NEEDS_BUILD =
	'dist/ is absent. Run `npm run build` first: this case runs the tutorial helper, which imports the built package.'

/**
 * The adapter bounds each MCP session and kills its server's process group, and
 * that bounds nothing outside a tool call. A helper that hung between calls
 * would keep this synchronous spawn blocked past the case's own timeout, and
 * vitest reports that as the suite hanging rather than as this case failing. The
 * bound here is well under that timeout so the failure lands on the right case.
 */
const HELPER_TIMEOUT_MS = 45_000

const runHelper = (extra: readonly string[], out: string) => {
	const result = spawnSync(
		process.execPath,
		[HELPER, '--contract', CONTRACT, '--out', out, ...extra],
		{ cwd: REPO, encoding: 'utf8', timeout: HELPER_TIMEOUT_MS },
	)
	if (result.error !== undefined) {
		throw new Error(
			`the tutorial helper did not run to a verdict within ${HELPER_TIMEOUT_MS}ms: ${result.error.message}`,
		)
	}
	return result
}

describe('the tool-use tutorial helper reproduces its committed evidence', () => {
	it('drives the pre-flight legs against a real tool server', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const scratch = mkdtempSync(join(tmpdir(), 'eval-quality-tool-use-'))
		try {
			const out = join(scratch, 'observations.json')
			const result = runHelper(
				['--mode', 'legs', '--run-id', 'tool-run-1'],
				out,
			)
			expect(result.status).toBe(0)
			// The legs really reached a server: the helper prints one line per call
			// and the pre-flight it drove has to have passed, since the committed
			// verdict the page scores under is minted from these observations.
			expect(result.stdout).toContain('pre-flight passed: true')
			expect(readFileSync(out, 'utf8')).toBe(
				readFileSync(COMMITTED_LEGS, 'utf8'),
			)
		} finally {
			rmSync(scratch, { recursive: true, force: true })
		}
	}, 60_000)

	it('issues the plan steps on both arms, and only the read-back differs', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const scratch = mkdtempSync(join(tmpdir(), 'eval-quality-tool-use-'))
		try {
			const clean = join(scratch, 'clean/steps.json')
			const seeded = join(scratch, 'seeded/steps.json')
			expect(runHelper(['--mode', 'steps'], clean).status).toBe(0)
			expect(
				runHelper(['--mode', 'steps', '--seed-defect'], seeded).status,
			).toBe(0)

			const cleanText = readFileSync(clean, 'utf8')
			const seededText = readFileSync(seeded, 'utf8')
			expect(cleanText).toBe(readFileSync(COMMITTED_BASELINE, 'utf8'))
			expect(seededText).toBe(readFileSync(COMMITTED_SEEDED, 'utf8'))

			// The lesson the page turns on, asserted rather than described: the two
			// arms agree on what the creation answered, and disagree only on what an
			// independent read of that identifier found.
			const creationOf = (text: string) =>
				(
					JSON.parse(text) as { observationId: string; responseBody: unknown }[]
				).find((entry) => entry.observationId === 'obs-create')?.responseBody
			expect(creationOf(cleanText)).toEqual(creationOf(seededText))
			expect(cleanText).not.toBe(seededText)
		} finally {
			rmSync(scratch, { recursive: true, force: true })
		}
	}, 60_000)
})
