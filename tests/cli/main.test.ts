/**
 * `main.ts` (Story 6.5, AC 12) at the process boundary, cases 89 through 94,
 * plus 167 and 168, which were added during implementation after a filesystem
 * path error was found escaping as a raw stack and exit 1.
 *
 * Every other CLI test file runs in memory against a fake `RunEnvironment`.
 * These run the real thing: a spawned binary, a real pipe, a real pack and
 * install. That is the only place the shebang, the `bin` mapping, the npm shim
 * and the executable bit can be observed at all.
 *
 * The packing cases copy the repository into a temporary directory and pack
 * there. `prepack` is `npm run clean && npm run build` and `clean` is
 * `rm -rf dist`, so a pack in the working tree deletes `dist/` underneath the
 * test files reading it in parallel. `--ignore-scripts` blocks the same hook,
 * and both are held: either one alone leaves the suite one flag away from an
 * intermittent red nobody can reproduce.
 */
import { spawnSync } from 'node:child_process'
import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
	symlinkSync,
	writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
	EXIT_FAULT,
	EXIT_OK,
	EXIT_STRUCTURAL_FAILURE,
	EXIT_USAGE,
} from '../../src/cli/exit-codes.ts'
import { EXIT_CODE_TABLE } from '../../src/cli/render.ts'

const REPO = fileURLToPath(new URL('../../', import.meta.url))
const SOURCE_MAIN = join(REPO, 'src/cli/main.ts')
const BUILT_MAIN = join(REPO, 'dist/cli/main.js')
const CORPUS_CONTRACT = join(
	REPO,
	'corpus/dev/compile-seal-example/contract.json',
)

/** A build is a precondition, so `npm run test` before one stays green. */
const BUILT = existsSync(BUILT_MAIN)
const NEEDS_BUILD =
	'dist/cli/main.js is absent. Run `npm run build` first: this case spawns the built binary.'

const VERSION = (
	JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')) as {
		version: string
	}
).version

/** The default pipe capacity on Linux and macOS. */
const PIPE_BUFFER_BYTES = 65_536

/** `files` plus the two manifests the pack reads. `node_modules/` is excluded. */
const PACKED_ENTRIES = [
	'package.json',
	'package-lock.json',
	'dist',
	'schemas',
	'corpus',
	'README.md',
	'LICENSE',
]

type PaddableContract = {
	behaviors: { description: string }[]
}

/**
 * Block and line comments out. `main.ts` names `process.exit` in its own
 * header to say it never calls it, so a scan over the raw text would fail on
 * the sentence that documents the rule.
 */
const stripComments = (source: string): string =>
	source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')

/**
 * `npm pack` writes two hundred notice lines to stderr. `spawnSync` captures
 * both streams, so the test run stays readable and a failure still carries
 * npm's own message.
 */
const npm = (argv: readonly string[], cwd: string): string => {
	const result = spawnSync('npm', [...argv], { cwd, encoding: 'utf8' })
	if (result.status !== 0) {
		throw new Error(
			`npm ${argv.join(' ')} exited ${result.status}\n${result.stderr}`,
		)
	}
	return result.stdout
}

describe('main.ts at the process boundary', () => {
	it('case 89: a stdout write larger than a pipe buffer arrives whole', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const contract = JSON.parse(
			readFileSync(CORPUS_CONTRACT, 'utf8'),
		) as PaddableContract
		// Two pipe buffers of filler, so the artifact cannot reach the
		// reader in one write and a `process.exit` would truncate it.
		const filler = 'x'.repeat(PIPE_BUFFER_BYTES * 2)
		const behavior = contract.behaviors[0]!
		behavior.description = `${behavior.description} ${filler}`

		const scratch = mkdtempSync(join(tmpdir(), 'eval-quality-stdout-'))
		try {
			const source = join(scratch, 'contract.json')
			writeFileSync(source, JSON.stringify(contract), 'utf8')
			const result = spawnSync(
				process.execPath,
				[BUILT_MAIN, 'compile', '--in', source],
				{ encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
			)

			expect(result.stderr).toBe('')
			expect(result.status).toBe(EXIT_OK)
			expect(Buffer.byteLength(result.stdout, 'utf8')).toBeGreaterThan(
				PIPE_BUFFER_BYTES * 2,
			)
			// The trailing newline is the artifact's last byte: reading it
			// back is what proves nothing was cut off the end.
			expect(result.stdout.endsWith('\n')).toBe(true)
			const emitted = JSON.parse(result.stdout) as PaddableContract
			expect(emitted.behaviors[0]!.description).toBe(behavior.description)
		} finally {
			rmSync(scratch, { recursive: true, force: true })
		}
	}, 60_000)

	it('case 90: `main.ts` assigns `process.exitCode` and calls `process.exit` nowhere', () => {
		const source = readFileSync(SOURCE_MAIN, 'utf8')
		const code = stripComments(source)

		// Guards the stripper: a regex that ate the whole file would pass the
		// negative assertion below on an empty string.
		expect(code).toContain('export async function main')
		expect(code).toMatch(/process\.exitCode\s*=/)
		// `\b` after `exit` fails against `exitCode`, so this matches the call
		// and never the assignment.
		expect(code).not.toMatch(/\bprocess\.exit\b/)
	})

	it('case 91: the built file opens with the shebang', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const [first] = readFileSync(BUILT_MAIN, 'utf8').split(/\r?\n/)
		expect(first).toBe('#!/usr/bin/env node')
	})

	describe('the packed and installed tarball', () => {
		let stage: string | null = null
		let shim = ''
		let installedMain = ''
		let installedContract = ''

		beforeAll(() => {
			if (!BUILT) return
			stage = mkdtempSync(join(tmpdir(), 'eval-quality-pack-'))
			const source = join(stage, 'repo')
			const consumer = join(stage, 'app')
			mkdirSync(source)
			mkdirSync(consumer)
			for (const entry of PACKED_ENTRIES) {
				cpSync(join(REPO, entry), join(source, entry), { recursive: true })
			}

			// `--ignore-scripts` keeps `prepack` from running `rm -rf dist`, and
			// `--pack-destination` keeps the tarball out of a tree where `*.tgz`
			// is not gitignored.
			const packed = npm(
				['pack', '--ignore-scripts', '--pack-destination', stage],
				source,
			)
				.trim()
				.split('\n')
				.at(-1)

			writeFileSync(
				join(consumer, 'package.json'),
				`${JSON.stringify(
					{ name: 'eval-quality-consumer', version: '0.0.0', private: true },
					null,
					2,
				)}\n`,
			)
			// `--prefer-offline` enforces local cache reuse without failing when the npm cache is unprimed.
			npm(
				[
					'install',
					'--prefer-offline',
					'--no-audit',
					'--no-fund',
					join(stage, packed ?? ''),
				],
				consumer,
			)

			const installed = join(consumer, 'node_modules/eval-quality')
			shim = join(consumer, 'node_modules/.bin/eval-quality')
			installedMain = join(installed, 'dist/cli/main.js')
			// Read out of the install, so the case also proves `corpus/` packed.
			installedContract = join(
				installed,
				'corpus/dev/contracts/no-operation-inventory.json',
			)
		}, 120_000)

		afterAll(() => {
			if (stage !== null) rmSync(stage, { recursive: true, force: true })
		})

		it('case 92: `node_modules/.bin/eval-quality` runs the installed binary', (ctx) => {
			if (!BUILT) return ctx.skip(NEEDS_BUILD)
			// The executable bit is npm's, not the compiler's. `tsc` writes
			// `dist/cli/main.js` unexecutable and only the install fixes it,
			// which is why nothing short of a real install proves the shim
			// works.
			expect(statSync(BUILT_MAIN).mode & 0o111).toBe(0)
			expect(statSync(installedMain).mode & 0o111).not.toBe(0)

			const version = spawnSync(shim, ['--version'], { encoding: 'utf8' })
			expect(version.error).toBeUndefined()
			expect(version.status).toBe(EXIT_OK)
			expect(version.stdout).toBe(`${VERSION}\n`)
			expect(version.stderr).toBe('')

			const help = spawnSync(shim, ['--help'], { encoding: 'utf8' })
			expect(help.status).toBe(EXIT_OK)
			expect(help.stdout).toContain('eval-quality compile')
			// The built table equalling the source constant is what pins the
			// install to the tree this test runs against.
			expect(help.stdout).toContain(EXIT_CODE_TABLE)
			expect(help.stderr).toBe('')
		}, 120_000)

		it('case 93: the installed binary exits 4 on a structural failure', (ctx) => {
			if (!BUILT) return ctx.skip(NEEDS_BUILD)
			const result = spawnSync(shim, ['compile', '--in', installedContract], {
				encoding: 'utf8',
			})

			expect(result.status).toBe(EXIT_STRUCTURAL_FAILURE)
			// A failure writes no artifact: stdout stays clean for a pipe.
			expect(result.stdout).toBe('')
			expect(result.stderr).toContain(
				'eval-quality: unreachable-check-evidence:',
			)
		}, 60_000)
	})

	it('case 94: a contract on stdin compiles end to end through the built binary', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const contract = readFileSync(CORPUS_CONTRACT, 'utf8')
		const spawn = (argv: readonly string[]) =>
			spawnSync(process.execPath, [BUILT_MAIN, ...argv], {
				input: contract,
				encoding: 'utf8',
			})

		const implicit = spawn(['compile'])
		expect(implicit.stderr).toBe('')
		expect(implicit.status).toBe(EXIT_OK)
		expect(JSON.parse(implicit.stdout)).toEqual(JSON.parse(contract))

		// `-` is the explicit spelling of the source an absent `--in` picks.
		const explicit = spawn(['compile', '--in', '-'])
		expect(explicit.status).toBe(EXIT_OK)
		expect(explicit.stdout).toBe(implicit.stdout)
	}, 60_000)

	// 167 and 168 are outside AC 17's range because they were added during
	// implementation. Before the fix both invocations printed a Node stack and
	// exited 1, which AD-21 bars: 1 is inside the verdict range, and a compile
	// that never produced a verdict may not land there.
	describe('a path the invocation named that the filesystem will not give us', () => {
		it('case 167: a missing --in file is a usage error naming the path', (ctx) => {
			if (!BUILT) return ctx.skip(NEEDS_BUILD)
			const scratch = mkdtempSync(join(tmpdir(), 'eval-quality-path-'))
			try {
				const missing = join(scratch, 'absent.json')
				const result = spawnSync(
					process.execPath,
					[BUILT_MAIN, 'compile', '--in', missing],
					{ encoding: 'utf8' },
				)

				expect(result.status).toBe(EXIT_USAGE)
				expect(result.stdout).toBe('')
				expect(result.stderr).toContain('eval-quality: usage:')
				expect(result.stderr).toContain(missing)
				expect(result.stderr).toContain('ENOENT')
				// The stack the fix replaced. Its absence is the assertion.
				expect(result.stderr).not.toContain('node:internal')
			} finally {
				rmSync(scratch, { recursive: true, force: true })
			}
		}, 60_000)

		it('case 168: a missing --out directory is a usage error naming the path', (ctx) => {
			if (!BUILT) return ctx.skip(NEEDS_BUILD)
			const scratch = mkdtempSync(join(tmpdir(), 'eval-quality-path-'))
			try {
				const absentDirectory = join(scratch, 'no-such-run')
				const result = spawnSync(
					process.execPath,
					[
						BUILT_MAIN,
						'seal',
						'--in',
						CORPUS_CONTRACT,
						'--out',
						absentDirectory,
					],
					{ encoding: 'utf8' },
				)

				expect(result.status).toBe(EXIT_USAGE)
				expect(result.stdout).toBe('')
				expect(result.stderr).toContain('eval-quality: usage:')
				expect(result.stderr).toContain(
					join(absentDirectory, 'sealed-evaluator-brief.json'),
				)
				expect(result.stderr).toContain('ENOENT')
				expect(result.stderr).not.toContain('node:internal')
			} finally {
				rmSync(scratch, { recursive: true, force: true })
			}
		}, 60_000)
	})

	// 172 through 175 are outside AC 17's range for the same reason 167 and 168
	// are. `run` compares resolved paths through `RunEnvironment`, so a case
	// against the in-memory fake measures the fake. Only the real binary
	// exercises `main.ts`'s own `resolvePath` and `sameFile`, which is where
	// three aliasing spellings each overwrote the command's own input.
	describe('an --out that aliases an --in never overwrites it', () => {
		const contractBytes = (): string => readFileSync(CORPUS_CONTRACT, 'utf8')

		const compileWith = (
			scratch: string,
			input: string,
			out: string,
		): ReturnType<typeof spawnSync> =>
			spawnSync(
				process.execPath,
				[BUILT_MAIN, 'compile', '--in', input, '--out', out],
				{ cwd: scratch, encoding: 'utf8' },
			)

		const withScratch = (body: (scratch: string) => void): void => {
			const scratch = mkdtempSync(join(tmpdir(), 'eval-quality-alias-'))
			try {
				body(scratch)
			} finally {
				rmSync(scratch, { recursive: true, force: true })
			}
		}

		it('case 172: a dot segment in --in still collides with --out', (ctx) => {
			if (!BUILT) return ctx.skip(NEEDS_BUILD)
			withScratch((scratch) => {
				const target = join(scratch, 'q1.json')
				writeFileSync(target, contractBytes())
				const before = readFileSync(target, 'utf8')

				const result = compileWith(scratch, join(scratch, './q1.json'), target)

				expect(result.status).toBe(EXIT_USAGE)
				expect(result.stderr).toContain('eval-quality: usage:')
				expect(readFileSync(target, 'utf8')).toBe(before)
			})
		}, 60_000)

		it('case 173: a dot-dot segment in --in still collides with --out', (ctx) => {
			if (!BUILT) return ctx.skip(NEEDS_BUILD)
			withScratch((scratch) => {
				const target = join(scratch, 'q2.json')
				writeFileSync(target, contractBytes())
				const before = readFileSync(target, 'utf8')
				mkdirSync(join(scratch, 'd'))

				const result = compileWith(
					scratch,
					join(scratch, 'd', '..', 'q2.json'),
					target,
				)

				expect(result.status).toBe(EXIT_USAGE)
				expect(readFileSync(target, 'utf8')).toBe(before)
			})
		}, 60_000)

		it('case 174: a symlinked --in still collides with --out', (ctx) => {
			if (!BUILT) return ctx.skip(NEEDS_BUILD)
			withScratch((scratch) => {
				const target = join(scratch, 'q4.json')
				writeFileSync(target, contractBytes())
				const before = readFileSync(target, 'utf8')
				const link = join(scratch, 'q4link.json')
				symlinkSync(target, link)

				// No string normalization brings these two spellings together;
				// `sameFile` compares device and inode, which does.
				const result = compileWith(scratch, link, target)

				expect(result.status).toBe(EXIT_USAGE)
				expect(readFileSync(target, 'utf8')).toBe(before)
			})
		}, 60_000)

		it('case 178: an unwritable --out lands on the ladder and never on 1', (ctx) => {
			if (!BUILT) return ctx.skip(NEEDS_BUILD)
			withScratch((scratch) => {
				// A directory with no write permission. Which errno comes back is
				// the platform's business — EACCES here, EROFS or EPERM elsewhere —
				// so the assertion is the invariant the ladder states: every exit
				// this binary takes is one `exitCodeFor` assigned, and 1 is inside
				// the verdict range a command producing no verdict may never use.
				const locked = join(scratch, 'locked')
				mkdirSync(locked, { mode: 0o500 })
				const input = join(scratch, 'in.json')
				writeFileSync(input, contractBytes())

				const result = compileWith(
					scratch,
					input,
					join(locked, 'artifact.json'),
				)

				expect([EXIT_USAGE, EXIT_FAULT]).toContain(result.status)
				expect(result.stdout).toBe('')
				expect(result.stderr).toContain('eval-quality:')
				expect(result.stderr).not.toContain('node:internal')
			})
		}, 60_000)

		it('case 175: a genuinely distinct --out is still written', (ctx) => {
			if (!BUILT) return ctx.skip(NEEDS_BUILD)
			withScratch((scratch) => {
				const input = join(scratch, 'in.json')
				const output = join(scratch, 'out.json')
				writeFileSync(input, contractBytes())

				const result = compileWith(scratch, input, output)

				expect(result.status).toBe(EXIT_OK)
				expect(result.stderr).toBe('')
				expect(existsSync(output)).toBe(true)
				expect(JSON.parse(readFileSync(output, 'utf8'))).toEqual(
					JSON.parse(contractBytes()),
				)
			})
		}, 60_000)
	})
})
