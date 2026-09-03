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
import {
	corpusDigestFixture,
	evaluatorConfigurationFixture,
	isolationManifestBytes,
	isolationManifestFixtureForScore,
	passingPreflightVerdictForScore,
	scoreContractFixture,
	scoreProbeFixture,
	scoringPolicyFixtureForScore,
	sealedRunRecordFixtureForScore,
} from '../application/fixtures/score-fixtures.ts'

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

	/**
	 * A lockfile for the scratch consumer, carrying `zod`'s resolved URL and
	 * integrity from this repository's own lockfile. `npm ci` populates the cache
	 * with tarballs and never with packuments, so an `--offline` install that has
	 * to resolve a range hits ENOTCACHED; one that reads a lockfile does not.
	 */
	function consumerLockfile(tarball: string): unknown {
		const root = JSON.parse(
			readFileSync(join(REPO, 'package-lock.json'), 'utf8'),
		) as {
			packages: Record<
				string,
				{ version: string; resolved: string; integrity: string }
			>
		}
		const zod = root.packages['node_modules/zod']
		if (zod === undefined)
			throw new Error('zod is absent from package-lock.json')
		return {
			name: 'eval-quality-consumer',
			version: '0.0.0',
			lockfileVersion: 3,
			requires: true,
			packages: {
				'': {
					name: 'eval-quality-consumer',
					version: '0.0.0',
					dependencies: { 'eval-quality': `file:${tarball}` },
				},
				'node_modules/eval-quality': {
					version: '0.0.0',
					resolved: `file:${tarball}`,
					dependencies: { zod: zod.version },
				},
				'node_modules/zod': {
					version: zod.version,
					resolved: zod.resolved,
					integrity: zod.integrity,
				},
			},
		}
	}

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
			// The consumer gets a lockfile naming `zod` with the resolved URL and
			// integrity the repository's own lockfile already carries. Without
			// it npm has to read the `zod` packument to resolve the range, and
			// `npm ci` caches tarballs and never packuments, so `--offline`
			// fails on a clean machine with ENOTCACHED.
			//
			// `--offline` itself holds NFR7's "no network beyond AD-37's
			// loopback fixture server". It is the flag that proves the install
			// performs no network I/O, so it stays and the resolution is made
			// local instead.
			writeFileSync(
				join(consumer, 'package-lock.json'),
				`${JSON.stringify(consumerLockfile(packed ?? ''), null, 2)}\n`,
			)
			npm(
				[
					'install',
					'--offline',
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

		it('case 168: a missing --out directory is created', (ctx) => {
			if (!BUILT) return ctx.skip(NEEDS_BUILD)
			const scratch = mkdtempSync(join(tmpdir(), 'eval-quality-path-'))
			try {
				// `--out` names where output goes, and the caller naming a directory
				// that does not exist yet is an ordinary way to invoke this. Creating
				// it mutates no input. This case asserted a usage error until a
				// reviewer read the ENOENT it produced: `eval-quality: usage: open
				// "...": ENOENT` is a filesystem failure wearing a usage label.
				const absentDirectory = join(scratch, 'no-such-run', 'nested')
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

				expect(result.status).toBe(EXIT_OK)
				expect(result.stderr).toBe('')
				expect(
					readFileSync(
						join(absentDirectory, 'sealed-evaluator-brief.json'),
						'utf8',
					),
				).toContain('"schemaVersion"')
			} finally {
				rmSync(scratch, { recursive: true, force: true })
			}
		}, 60_000)

		it('case 179: an --out path under a file is a usage error, never a stack', (ctx) => {
			if (!BUILT) return ctx.skip(NEEDS_BUILD)
			const scratch = mkdtempSync(join(tmpdir(), 'eval-quality-path-'))
			try {
				// The defect case 168 was written for, kept after 168 changed: a
				// path the filesystem will not give us must still exit 64 with a
				// named reason. Before that fix both of these printed a Node stack
				// and exited 1, which AD-21 bars because 1 is inside the verdict
				// range and a seal that produced no verdict may not land there.
				const blocker = join(scratch, 'not-a-directory')
				writeFileSync(blocker, 'this is a file\n')
				const result = spawnSync(
					process.execPath,
					[
						BUILT_MAIN,
						'seal',
						'--in',
						CORPUS_CONTRACT,
						'--out',
						join(blocker, 'run'),
					],
					{ encoding: 'utf8' },
				)

				expect(result.status).toBe(EXIT_USAGE)
				expect(result.stdout).toBe('')
				expect(result.stderr).toContain('eval-quality: usage:')
				expect(result.stderr).toContain(blocker)
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

	// Round 2 peer review, finding 12: `main.ts`'s own corpus-port wiring
	// (`createLocalCorpusAdapter`, `--corpus-root`, `RunEnvironment.corpusPort`)
	// had no test of its own; only the in-memory fake in `tests/cli/run.test.ts`
	// exercised the seam. This runs the real adapter against a real directory.
	describe('score resolves a private reference through the real corpus adapter', () => {
		it('a private-storage isolationManifestArtifact resolves for real under --corpus-root', (ctx) => {
			if (!BUILT) return ctx.skip(NEEDS_BUILD)
			const scratch = mkdtempSync(join(tmpdir(), 'eval-quality-corpus-'))
			try {
				const corpusRoot = join(scratch, 'corpus')
				mkdirSync(corpusRoot, { recursive: true })
				// The fixture record's own `isolationManifestArtifact.privateRef`;
				// the real adapter resolves it relative to `--corpus-root`.
				writeFileSync(
					join(corpusRoot, 'opaque:isolation-manifest-1'),
					isolationManifestBytes,
				)
				writeFileSync(
					join(scratch, 'record.json'),
					JSON.stringify(sealedRunRecordFixtureForScore),
				)
				writeFileSync(
					join(scratch, 'contract.json'),
					JSON.stringify(scoreContractFixture),
				)
				writeFileSync(
					join(scratch, 'probe.json'),
					JSON.stringify(scoreProbeFixture),
				)
				writeFileSync(
					join(scratch, 'preflight-verdict.json'),
					JSON.stringify(passingPreflightVerdictForScore),
				)
				writeFileSync(
					join(scratch, 'policy.json'),
					JSON.stringify(scoringPolicyFixtureForScore),
				)
				writeFileSync(
					join(scratch, 'isolation-manifest.json'),
					JSON.stringify(isolationManifestFixtureForScore),
				)
				writeFileSync(
					join(scratch, 'evaluator-configuration.json'),
					JSON.stringify(evaluatorConfigurationFixture),
				)

				const result = spawnSync(
					process.execPath,
					[
						BUILT_MAIN,
						'score',
						'--record',
						join(scratch, 'record.json'),
						'--contract',
						join(scratch, 'contract.json'),
						'--probe',
						join(scratch, 'probe.json'),
						'--preflight-verdict',
						join(scratch, 'preflight-verdict.json'),
						'--policy',
						join(scratch, 'policy.json'),
						'--isolation-manifest',
						join(scratch, 'isolation-manifest.json'),
						'--evaluator-configuration',
						join(scratch, 'evaluator-configuration.json'),
						'--corpus-digest',
						corpusDigestFixture,
						'--corpus-root',
						corpusRoot,
					],
					{ encoding: 'utf8' },
				)

				expect(result.stderr).toBe('')
				expect(result.status).toBe(EXIT_OK)
				const artifact = JSON.parse(result.stdout) as {
					readonly mode: string
					readonly productionVerdict: string
				}
				expect(artifact.mode).toBe('production')
				expect(artifact.productionVerdict).toBe('PASS')
			} finally {
				rmSync(scratch, { recursive: true, force: true })
			}
		}, 60_000)

		it('a digest mismatch against the real resolved bytes is a fault, exit 5', (ctx) => {
			if (!BUILT) return ctx.skip(NEEDS_BUILD)
			const scratch = mkdtempSync(join(tmpdir(), 'eval-quality-corpus-'))
			try {
				const corpusRoot = join(scratch, 'corpus')
				mkdirSync(corpusRoot, { recursive: true })
				// Wrong bytes at the same privateRef: the declared digest on the
				// record no longer matches what the adapter actually resolves.
				writeFileSync(
					join(corpusRoot, 'opaque:isolation-manifest-1'),
					'not the isolation manifest bytes',
				)
				writeFileSync(
					join(scratch, 'record.json'),
					JSON.stringify(sealedRunRecordFixtureForScore),
				)
				writeFileSync(
					join(scratch, 'contract.json'),
					JSON.stringify(scoreContractFixture),
				)
				writeFileSync(
					join(scratch, 'probe.json'),
					JSON.stringify(scoreProbeFixture),
				)
				writeFileSync(
					join(scratch, 'preflight-verdict.json'),
					JSON.stringify(passingPreflightVerdictForScore),
				)
				writeFileSync(
					join(scratch, 'policy.json'),
					JSON.stringify(scoringPolicyFixtureForScore),
				)

				const result = spawnSync(
					process.execPath,
					[
						BUILT_MAIN,
						'score',
						'--record',
						join(scratch, 'record.json'),
						'--contract',
						join(scratch, 'contract.json'),
						'--probe',
						join(scratch, 'probe.json'),
						'--preflight-verdict',
						join(scratch, 'preflight-verdict.json'),
						'--policy',
						join(scratch, 'policy.json'),
						'--corpus-digest',
						corpusDigestFixture,
						'--corpus-root',
						corpusRoot,
					],
					{ encoding: 'utf8' },
				)

				expect(result.stdout).toBe('')
				expect(result.status).toBe(EXIT_FAULT)
				expect(result.stderr).toMatch(
					/^eval-quality: digest-mismatch: SealedRunRecord\.isolationManifestArtifact: /,
				)
			} finally {
				rmSync(scratch, { recursive: true, force: true })
			}
		}, 60_000)

		it('a --private-manifest with zero entries and no --corpus-root proceeds cleanly (blocking finding 1)', (ctx) => {
			if (!BUILT) return ctx.skip(NEEDS_BUILD)
			const scratch = mkdtempSync(join(tmpdir(), 'eval-quality-corpus-'))
			try {
				// A public-storage reference here, deliberately: isolating the one
				// thing this case is for, an empty --private-manifest with no
				// --corpus-root, from the record's own private isolation-manifest
				// reference, which would need one for an unrelated reason.
				const record = {
					...sealedRunRecordFixtureForScore,
					isolationManifestArtifact: {
						storage: 'public' as const,
						path: 'evidence/manifest.json',
						privateRef: null,
						digest:
							sealedRunRecordFixtureForScore.isolationManifestArtifact.digest,
					},
				}
				writeFileSync(join(scratch, 'record.json'), JSON.stringify(record))
				writeFileSync(
					join(scratch, 'contract.json'),
					JSON.stringify(scoreContractFixture),
				)
				writeFileSync(
					join(scratch, 'probe.json'),
					JSON.stringify(scoreProbeFixture),
				)
				writeFileSync(
					join(scratch, 'preflight-verdict.json'),
					JSON.stringify(passingPreflightVerdictForScore),
				)
				writeFileSync(
					join(scratch, 'policy.json'),
					JSON.stringify(scoringPolicyFixtureForScore),
				)
				writeFileSync(
					join(scratch, 'isolation-manifest.json'),
					JSON.stringify(isolationManifestFixtureForScore),
				)
				writeFileSync(
					join(scratch, 'evaluator-configuration.json'),
					JSON.stringify(evaluatorConfigurationFixture),
				)
				writeFileSync(
					join(scratch, 'private-manifest.json'),
					JSON.stringify({
						schemaVersion: 1,
						parentDigest: null,
						revisionCount: 0,
						entries: [],
					}),
				)

				const result = spawnSync(
					process.execPath,
					[
						BUILT_MAIN,
						'score',
						'--record',
						join(scratch, 'record.json'),
						'--contract',
						join(scratch, 'contract.json'),
						'--probe',
						join(scratch, 'probe.json'),
						'--preflight-verdict',
						join(scratch, 'preflight-verdict.json'),
						'--policy',
						join(scratch, 'policy.json'),
						'--isolation-manifest',
						join(scratch, 'isolation-manifest.json'),
						'--evaluator-configuration',
						join(scratch, 'evaluator-configuration.json'),
						'--private-manifest',
						join(scratch, 'private-manifest.json'),
						'--corpus-digest',
						corpusDigestFixture,
					],
					{ encoding: 'utf8' },
				)

				expect(result.stderr).toBe('')
				expect(result.status).toBe(EXIT_OK)
				expect(result.stdout).not.toBe('')
			} finally {
				rmSync(scratch, { recursive: true, force: true })
			}
		}, 60_000)
	})
})
