/**
 * The `doc-invocations` gate is what keeps a documented command honest, and
 * until these cases existed it was the one check in `validate` with nothing
 * checking it. Both properties below were holes it shipped with: a page could
 * name the wrong failure code beside the right exit code, and a file left at the
 * clone root could stand in for the page's own heredoc.
 *
 * Black-box through the published binary: what this gate promises is an exit
 * code and a report, so the cases read those.
 *
 * Every case drives a fixture page through a configuration in a temporary
 * directory, per AD-30. A section's paths resolve against the configuration
 * file, so the fixture root carries links to `dist/` and `corpus/`: that is what
 * lets a page name a contract this repository really ships and have the run be
 * judged as the page's own claim.
 *
 * Every case asserts the scanned count as well as the verdict. A case that
 * asserts only `0 failure(s)` passes just as happily when the fixture's command
 * stopped being extracted at all.
 */

import { spawnSync } from 'node:child_process'
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	symlinkSync,
	writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG_FILE } from '../../scripts/gate-config.ts'

const CLI = resolve('scripts/gates-cli.ts')

/** A build is a precondition: the gate runs the built binary or refuses. */
const BUILT =
	existsSync(resolve('dist/cli/main.js')) &&
	existsSync(resolve('dist/gates/gates-cli.js'))
const NEEDS_BUILD =
	'dist/cli/main.js or dist/gates/gates-cli.js is absent. Run `npm run build` first: these cases run the built binaries.'

/** The second published binary, which the multi-binary cases run. */
const GATES_ENTRY = 'dist/gates/gates-cli.js'

/** A contract this repository ships that compiles cleanly. */
const SHIPPED_CONTRACT = 'corpus/dev/compile-seal-example/contract.json'

/** A contract this repository ships that fails a discipline rule at exit 4. */
const REJECTED_CONTRACT = 'corpus/dev/contracts/empty-request-shapes.json'

/** The first line of the rejection `REJECTED_CONTRACT` produces. */
const UNREACHABLE =
	'eval-quality: unreachable-check-evidence: EvalContract.oracles[id=O-005].check.operands[0].operands[0]: ...'

type Run = { readonly status: number; readonly output: string }

const runGate = (configPath: string): Run => {
	const result = spawnSync(
		process.execPath,
		[CLI, 'doc-invocations', '--config', configPath],
		{ encoding: 'utf8' },
	)
	return {
		status: result.status ?? -1,
		output: `${result.stdout}${result.stderr}`,
	}
}

/**
 * A fixture root carrying one page, a configuration, and links to the two trees
 * a documented command names: the built binary it runs, and the corpus a page's
 * inputs live in. `pages` is overridable so a case can point the gate somewhere
 * the guard has to refuse.
 */
const fixtureRoot = (
	page: string | null,
	pages: readonly string[] = ['docs'],
): string => {
	const root = mkdtempSync(join(tmpdir(), 'doc-invocations-case-'))
	symlinkSync(resolve('dist'), join(root, 'dist'))
	symlinkSync(resolve('corpus'), join(root, 'corpus'))
	if (page !== null) {
		mkdirSync(join(root, 'docs'))
		writeFileSync(join(root, 'docs/page.md'), page, 'utf8')
	}
	writeFileSync(
		join(root, DEFAULT_CONFIG_FILE),
		JSON.stringify(
			{
				'doc-invocations': {
					pages,
					binary: {
						entry: 'dist/cli/main.js',
						spellings: ['eval-quality', 'node dist/cli/main.js'],
					},
					sampleInput: SHIPPED_CONTRACT,
				},
			},
			null,
			'\t',
		),
		'utf8',
	)
	return root
}

/** Writes one fixture page and runs the gate over the root holding it. */
const check = (page: string): Run =>
	runGate(join(fixtureRoot(page), DEFAULT_CONFIG_FILE))

/**
 * The same tree with the `binary` field opened up, so a case can declare one
 * object, several, or something the schema has to refuse. `fixtureRoot` above
 * stays the one-binary spelling every other case in this file uses, which is
 * what keeps those cases evidence that the single-object form is unchanged.
 */
const binaryFixtureRoot = (page: string, binary: unknown): string => {
	const root = mkdtempSync(join(tmpdir(), 'doc-invocations-binaries-'))
	symlinkSync(resolve('dist'), join(root, 'dist'))
	symlinkSync(resolve('corpus'), join(root, 'corpus'))
	mkdirSync(join(root, 'docs'))
	writeFileSync(join(root, 'docs/page.md'), page, 'utf8')
	writeFileSync(
		join(root, DEFAULT_CONFIG_FILE),
		JSON.stringify(
			{
				'doc-invocations': {
					pages: ['docs'],
					binary,
					sampleInput: SHIPPED_CONTRACT,
				},
			},
			null,
			'\t',
		),
		'utf8',
	)
	return root
}

const checkBinaries = (page: string, binary: unknown): Run =>
	runGate(join(binaryFixtureRoot(page, binary), DEFAULT_CONFIG_FILE))

const fence = (...lines: readonly string[]): string => lines.join('\n')

/** A page whose fences hold one command each, none declaring an exit. */
const commandPage = (...commands: readonly string[]): string =>
	fence(
		'# A page',
		'',
		...commands.flatMap((command) => ['```bash', command, '```', '']),
	)

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

describe('the doc-invocations gate, the transcribed diagnostic', () => {
	it('passes when the block beside the command is what the run wrote', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const run = check(rejectionPage('```text', UNREACHABLE, '```'))
		expect(run.output).toContain('1 invocation(s) scanned')
		expect(run.output).toContain('1 with their output compared, 0 failure(s)')
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
		expect(run.output).toContain('1 with their output compared, 0 failure(s)')
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
		expect(run.output).toContain('0 with their output compared, 0 failure(s)')
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
		expect(run.output).toContain('0 with their output compared, 0 failure(s)')
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
		expect(run.output).toContain('0 with their output compared, 0 failure(s)')
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
		expect(run.output).toContain('0 with their output compared, 0 failure(s)')
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
		expect(run.output).toContain('1 with their output compared, 0 failure(s)')
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
		expect(run.output).toContain('1 with their output compared, 0 failure(s)')
		expect(run.status).toBe(0)
	})

	it('fails a documented line carrying more elisions than the cap', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		// Matching elisions is polynomial in their count and nothing times this
		// process out. A page that leans on them gets a diagnostic, where it
		// would otherwise get a long silent wait.
		const run = check(
			rejectionPage('```text', 'eval-quality: ...a...b...c...d...e', '```'),
		)
		expect(run.status).toBe(1)
		expect(run.output).toContain('elides 3 times over')
	})

	it('does not count an empty block as compared', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const run = check(rejectionPage('```text', '```'))
		expect(run.output).toContain('1 invocation(s) scanned')
		expect(run.output).toContain('0 with their output compared, 0 failure(s)')
		expect(run.status).toBe(0)
	})
})

describe('the doc-invocations gate, the page owns the paths it writes', () => {
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
		expect(run.output).toContain('1 with their output compared, 0 failure(s)')
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
		expect(run.output).toContain('0 failure(s)')
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
		expect(run.output).toContain('0 failure(s)')
		expect(run.status).toBe(0)
	})
})

/**
 * A package that publishes two commands documents both, so one section carries
 * a list of binaries. Every case here asserts the scanned and faithful counts
 * beside the verdict: a run that stopped extracting one of the two binaries
 * still exits 0, and only the counts say which binary ran.
 */
describe('the doc-invocations gate, a section naming several binaries', () => {
	it('runs a page naming one binary as an object, as before', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const run = checkBinaries(
			commandPage(`node dist/cli/main.js compile --in ${SHIPPED_CONTRACT}`),
			{ entry: 'dist/cli/main.js', spellings: ['node dist/cli/main.js'] },
		)
		expect(run.output).toContain('1 invocation(s) scanned')
		expect(run.output).toContain('1 run faithfully over real inputs')
		expect(run.output).toContain('0 failure(s)')
		expect(run.status).toBe(0)
	})

	it('runs a page that invokes both binaries', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const run = checkBinaries(
			commandPage(
				`node dist/cli/main.js compile --in ${SHIPPED_CONTRACT}`,
				'eval-quality-gates --help',
			),
			[
				{ entry: 'dist/cli/main.js', spellings: ['node dist/cli/main.js'] },
				{ entry: GATES_ENTRY, spellings: ['eval-quality-gates'] },
			],
		)
		expect(run.output).toContain('2 invocation(s) scanned')
		expect(run.output).toContain('2 run faithfully over real inputs')
		expect(run.output).toContain('0 failure(s)')
		expect(run.status).toBe(0)
	})

	it('lets the longer spelling win over a shorter one declared first', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		// "run" is declared first and is a prefix of "run gates". Matching in
		// declaration order would send this line to the contract CLI, which has
		// no "gates" command.
		const run = checkBinaries(commandPage('run gates --help'), [
			{ entry: 'dist/cli/main.js', spellings: ['run'] },
			{ entry: GATES_ENTRY, spellings: ['run gates'] },
		])
		expect(run.output).toContain('1 invocation(s) scanned')
		expect(run.output).toContain('1 run faithfully over real inputs')
		expect(run.output).toContain('0 failure(s)')
		expect(run.status).toBe(0)
	})

	it('shows what the shorter spelling alone would have done', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		// The companion of the case above, which is what makes the sort
		// evidence: with only the short spelling declared, the same line runs
		// against the wrong binary and the gate reports a usage error.
		const run = checkBinaries(commandPage('run gates --help'), [
			{ entry: 'dist/cli/main.js', spellings: ['run'] },
		])
		expect(run.status).toBe(1)
		expect(run.output).toContain('1 failing invocation(s)')
		expect(run.output).toContain('usage error')
	})

	it('compares a declared block against stdout when the run wrote no stderr', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		// A page documenting a command that worked is quoting the answer, and the
		// answer is on stdout. Comparing an empty stderr against it would fail
		// every such block, so a page could only ever transcribe failures.
		const run = check(
			fence(
				'# A page',
				'',
				'<!-- expect-exit: 0 -->',
				'',
				'```bash',
				`node dist/cli/main.js compile --in ${SHIPPED_CONTRACT}`,
				'```',
				'',
				'```text',
				'{"behaviors":...',
				'```',
				'',
			),
		)
		expect(run.output).toContain('1 with their output compared, 0 failure(s)')
		expect(run.status).toBe(0)
	})

	it('fails a stdout block that does not describe what the run wrote', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const run = check(
			fence(
				'# A page',
				'',
				'<!-- expect-exit: 0 -->',
				'',
				'```bash',
				`node dist/cli/main.js compile --in ${SHIPPED_CONTRACT}`,
				'```',
				'',
				'```text',
				'{"somethingElse":...',
				'```',
				'',
			),
		)
		expect(run.status).toBe(1)
		expect(run.output).toContain('the run wrote something else')
	})

	it('admits the usage exit where the page declares it', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		// A gates binary spends the usage exit on a configuration it would not
		// read, and a page teaching a reader to recognise that refusal is making
		// a claim about it. The declaration is what separates that from a flag
		// the parser lost, and the case below it is what keeps the separation
		// evidence rather than an assertion.
		const run = checkBinaries(
			fence(
				'# A page',
				'',
				'<!-- expect-exit: 64 -->',
				'',
				'```bash',
				`node ${GATES_ENTRY} licences --config ${SHIPPED_CONTRACT}`,
				'```',
				'',
			),
			[{ entry: GATES_ENTRY, spellings: [`node ${GATES_ENTRY}`] }],
		)
		expect(run.output).toContain('1 run faithfully over real inputs')
		expect(run.output).toContain('0 failure(s)')
		expect(run.status).toBe(0)
	})

	it('still fails a usage exit the page did not declare', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		// The same invocation without the declaration. A rule that admitted the
		// usage exit outright would take a flag that stopped existing for a pass,
		// which is the failure the whole check was written for.
		const run = checkBinaries(
			fence(
				'# A page',
				'',
				'```bash',
				`node ${GATES_ENTRY} licences --config ${SHIPPED_CONTRACT}`,
				'```',
				'',
			),
			[{ entry: GATES_ENTRY, spellings: [`node ${GATES_ENTRY}`] }],
		)
		expect(run.status).toBe(1)
		expect(run.output).toContain('usage error')
	})

	it('resolves an installed prefix against the binary that matched', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		// Both lines name the same installed path and only the second binary
		// declares the prefix that maps it away. One prefix shared across the
		// section would make both runs faithful, so the faithful count is what
		// separates the two readings.
		const installed = `node_modules/eval-quality/${SHIPPED_CONTRACT}`
		const run = checkBinaries(
			commandPage(
				`eval-quality compile --in ${installed}`,
				`npx eval-quality compile --in ${installed}`,
			),
			[
				{ entry: 'dist/cli/main.js', spellings: ['eval-quality'] },
				{
					entry: 'dist/cli/main.js',
					spellings: ['npx eval-quality'],
					installedPrefix: 'node_modules/eval-quality/',
				},
			],
		)
		expect(run.output).toContain('2 invocation(s) scanned')
		expect(run.output).toContain('1 run faithfully over real inputs')
		expect(run.output).toContain('0 failure(s)')
		expect(run.status).toBe(0)
	})

	it('refuses a missing entry and names which binary owns it', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const run = checkBinaries(commandPage('eval-quality-gates --help'), [
			{ entry: 'dist/cli/main.js', spellings: ['eval-quality'] },
			{ entry: 'dist/gates/absent.js', spellings: ['eval-quality-gates'] },
		])
		expect(run.status).toBe(64)
		expect(run.output).toContain('binary[1].entry')
		expect(run.output).toContain('build it before the gate runs')
	})

	it('reports every spelling across every binary when none matched', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const run = checkBinaries(commandPage('some-other-tool --help'), [
			{ entry: 'dist/cli/main.js', spellings: ['eval-quality'] },
			{ entry: GATES_ENTRY, spellings: ['eval-quality-gates'] },
		])
		expect(run.status).toBe(64)
		expect(run.output).toContain('matched any spelling')
		// Longest first, which is the order they are matched in, so the message
		// reads as the precedence a page is held to.
		expect(run.output).toContain('(eval-quality-gates, eval-quality)')
	})

	it('refuses an empty list of binaries', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const run = checkBinaries(commandPage('eval-quality --version'), [])
		expect(run.status).toBe(64)
	})
})

describe('the doc-invocations gate, a misdriven run is an error', () => {
	it('fails on a pages root holding no markdown', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const root = fixtureRoot(null)
		mkdirSync(join(root, 'docs'))
		const run = runGate(join(root, DEFAULT_CONFIG_FILE))
		expect(run.status).toBe(64)
		expect(run.output).toContain('no markdown under')
	})

	it('refuses a pages root that encloses the configuration', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		// A root like `.` reaches every page in the tree and every fenced command
		// inside them, planning material and dependencies included.
		const root = fixtureRoot('# A page\n', ['.'])
		const run = runGate(join(root, DEFAULT_CONFIG_FILE))
		expect(run.status).toBe(64)
		expect(run.output).toContain('encloses the directory the configuration')
	})

	it('refuses a symlink pointing at the configuration directory', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		// `resolve` follows no symlink, so the guard canonicalizes first.
		const root = fixtureRoot('# A page\n', ['self'])
		symlinkSync(root, join(root, 'self'))
		const run = runGate(join(root, DEFAULT_CONFIG_FILE))
		expect(run.status).toBe(64)
		expect(run.output).toContain('encloses the directory the configuration')
	})

	it('reaches no page when handed a skipped directory outright', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const root = fixtureRoot(null, ['node_modules'])
		mkdirSync(join(root, 'node_modules'))
		writeFileSync(join(root, 'node_modules/page.md'), '# A page\n', 'utf8')
		const run = runGate(join(root, DEFAULT_CONFIG_FILE))
		expect(run.status).toBe(64)
		expect(run.output).toContain('no markdown under')
	})

	/**
	 * A mistyped spelling reads every page, skips every fence, and reports a clean
	 * pass over no commands at all. The pages are there and the binary is there,
	 * so nothing else in the gate notices.
	 */
	it('refuses a run that matched no spelling at all', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const root = fixtureRoot(
			fence(
				'# A page',
				'',
				'```bash',
				`eval-qualityy compile --in ${SHIPPED_CONTRACT}`,
				'```',
				'',
			),
		)
		const run = runGate(join(root, DEFAULT_CONFIG_FILE))
		expect(run.status).toBe(64)
		expect(run.output).toContain('matched any spelling')
	})

	it('refuses a built entry the configuration names and the tree lacks', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const root = mkdtempSync(join(tmpdir(), 'doc-invocations-unbuilt-'))
		mkdirSync(join(root, 'docs'))
		writeFileSync(join(root, 'docs/page.md'), '# A page\n', 'utf8')
		writeFileSync(
			join(root, DEFAULT_CONFIG_FILE),
			JSON.stringify({
				'doc-invocations': {
					pages: ['docs'],
					binary: { entry: 'dist/cli/main.js', spellings: ['eval-quality'] },
					sampleInput: 'docs/page.md',
				},
			}),
			'utf8',
		)
		const run = runGate(join(root, DEFAULT_CONFIG_FILE))
		expect(run.status).toBe(64)
		expect(run.output).toContain('build it before the gate runs')
	})
})
