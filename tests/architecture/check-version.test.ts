/**
 * `scripts/check-version.ts` and `scripts/generate-version.ts` hold the
 * agreement between `package.json`'s `version` and the one `VERSION`
 * declaration in `src/index.ts`. Black-box through the CLI, like
 * stamp-changelog: both scripts resolve their two files from the working
 * directory, so a temp directory carrying a manifest and a barrel is a whole
 * repository as far as either one is concerned.
 *
 * `vitest.config.ts` limits coverage to `src/core/**`, so nothing measures
 * `scripts/`. Replacing the comparison in `check-version.ts` with `if (false)`
 * left every other case in the suite green on a disagreeing tree; these cases
 * are what make that visible.
 *
 * The last two describes hold the wiring around the scripts. A `check:*`
 * script the `validate` chain never runs is a gate that never runs, and a
 * comment quoting a test case by number goes stale the moment the case is
 * renamed.
 */

import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { withVersion } from '../../scripts/version-target.ts'

const CHECK = resolve('scripts/check-version.ts')
const GENERATE = resolve('scripts/generate-version.ts')

const BARREL = "export const VERSION = '1.0.0'\n"

/** A barrel on CRLF line endings. */
const crlfBarrel = (version: string): string =>
	['// the root barrel', `export const VERSION = '${version}'`, ''].join('\r\n')

/** The two files the scripts read, in a fresh temp directory. */
function fixture(manifestVersion: string, barrel: string): string {
	const dir = mkdtempSync(join(tmpdir(), 'check-version-'))
	mkdirSync(join(dir, 'src'))
	writeFileSync(
		join(dir, 'package.json'),
		`${JSON.stringify({ name: 'eval-quality', version: manifestVersion }, null, 2)}\n`,
	)
	writeFileSync(join(dir, 'src/index.ts'), barrel)
	return dir
}

/** Runs `script` with the fixture as its working directory. */
function run(script: string, dir: string) {
	const result = spawnSync(process.execPath, [script], {
		cwd: dir,
		encoding: 'utf8',
	})
	return {
		status: result.status,
		stdout: result.stdout,
		stderr: result.stderr,
		barrel: readFileSync(join(dir, 'src/index.ts'), 'utf8'),
	}
}

describe('check-version', () => {
	it('exits 0 and names the version both files declare', () => {
		const { status, stdout, barrel } = run(CHECK, fixture('1.0.0', BARREL))
		expect(status).toBe(0)
		expect(stdout).toContain('src/index.ts and package.json both declare 1.0.0')
		// A check never rewrites what it checks.
		expect(barrel).toBe(BARREL)
	})

	it('refuses a disagreement, naming both versions and the repair', () => {
		const { status, stderr } = run(CHECK, fixture('1.0.1', BARREL))
		expect(status).toBe(1)
		expect(stderr).toContain("src/index.ts declares VERSION '1.0.0'")
		expect(stderr).toContain("package.json declares version '1.0.1'")
		expect(stderr).toContain('npm run generate:version')
	})

	it('refuses a barrel declaring no VERSION, naming the file and the shape', () => {
		const dir = fixture('1.0.0', 'export const RELEASE = undefined\n')
		const { status, stderr } = run(CHECK, dir)
		expect(status).toBe(1)
		expect(stderr).toContain(
			"src/index.ts: declares no `export const VERSION = '<version>'` on a line of its own",
		)
	})

	it('refuses a barrel declaring VERSION twice', () => {
		// Two declarations are drift of their own: the generator writes one, so a
		// second is a line it would leave behind at the old version.
		const dir = fixture('1.0.0', `${BARREL}${BARREL}`)
		const { status, stderr } = run(CHECK, dir)
		expect(status).toBe(1)
		expect(stderr).toContain(
			'src/index.ts: declares `VERSION` 2 times; the generator writes one',
		)
	})

	it('refuses a manifest version that is not semver, naming what it found', () => {
		const { status, stderr } = run(CHECK, fixture('1.0', BARREL))
		expect(status).toBe(1)
		expect(stderr).toContain(
			'package.json: `version` is "1.0", which is not semver',
		)
	})
})

describe('generate-version', () => {
	it('writes the manifest version into the barrel', () => {
		const { status, stdout, barrel } = run(GENERATE, fixture('1.0.1', BARREL))
		expect(status).toBe(0)
		expect(stdout).toContain('src/index.ts 1.0.0 -> 1.0.1')
		expect(barrel).toBe("export const VERSION = '1.0.1'\n")
	})

	it('writes nothing when the two already agree', () => {
		const { status, stdout, barrel } = run(GENERATE, fixture('1.0.0', BARREL))
		expect(status).toBe(0)
		expect(stdout).toContain('src/index.ts already declares 1.0.0')
		expect(barrel).toBe(BARREL)
	})

	it('refuses a barrel declaring no VERSION, writing nothing', () => {
		const source = 'export const RELEASE = undefined\n'
		const { status, stderr, barrel } = run(GENERATE, fixture('1.0.1', source))
		expect(status).toBe(1)
		expect(stderr).toContain(
			"src/index.ts: declares no `export const VERSION = '<version>'` on a line of its own",
		)
		expect(barrel).toBe(source)
	})

	it('refuses a manifest version that is not semver, writing nothing', () => {
		const { status, stderr, barrel } = run(GENERATE, fixture('1.0', BARREL))
		expect(status).toBe(1)
		expect(stderr).toContain(
			'package.json: `version` is "1.0", which is not semver',
		)
		expect(barrel).toBe(BARREL)
	})

	it('keeps a CRLF barrel on CRLF', () => {
		const dir = fixture('1.0.1', crlfBarrel('1.0.0'))
		const { status, barrel } = run(GENERATE, dir)
		expect(status).toBe(0)
		expect(barrel).toBe(crlfBarrel('1.0.1'))
	})
})

/**
 * `read()` refuses a manifest version that is not semver, and `$` is legal in
 * no semver, so these two call `withVersion` directly: neither script can carry
 * such a version to it. The replacement was a string before the repair, so
 * `1.0.1-$&` wrote the matched declaration back inside its own quotes and
 * `1.0.1-$1` wrote the version being replaced.
 */
describe('withVersion writes a version literally', () => {
	it('writes a version carrying `$&` as the characters it is', () => {
		expect(withVersion(BARREL, '1.0.1-$&')).toBe(
			"export const VERSION = '1.0.1-$&'\n",
		)
	})

	it('writes a version carrying `$1` as the characters it is', () => {
		expect(withVersion(BARREL, '1.0.1-$1')).toBe(
			"export const VERSION = '1.0.1-$1'\n",
		)
	})
})

/**
 * A `check:*` script the `validate` chain never runs is a gate that never runs.
 * Deleting `&& npm run check:version` from the chain failed no assertion before
 * this case. `.github/workflows/pr-checks.yml` transcribes the same chain into
 * its validate step name by hand, and that line was already missing
 * `check:doc-counts` and `check:doc-claims` when this story read it.
 */
describe('every check:* script is wired into validate', () => {
	const manifest = JSON.parse(
		readFileSync(resolve('package.json'), 'utf8'),
	) as { readonly scripts: Readonly<Record<string, string>> }
	const checkKeys = Object.keys(manifest.scripts).filter((key) =>
		key.startsWith('check:'),
	)
	const validate = manifest.scripts.validate ?? ''

	it('the validate chain runs every one of them', () => {
		expect(checkKeys.length).toBeGreaterThan(0)
		const missing = checkKeys.filter(
			(key) => !validate.includes(`npm run ${key}`),
		)
		expect(missing).toEqual([])
	})

	it('the pr-checks validate step name lists every one of them', () => {
		const workflow = readFileSync(
			resolve('.github/workflows/pr-checks.yml'),
			'utf8',
		)
		const stepName = /^\s*- name: Validate \((.*)\)\s*$/m.exec(workflow)?.[1]
		expect(
			stepName,
			'no `- name: Validate (...)` step in pr-checks.yml',
		).toBeTypeOf('string')
		const missing = checkKeys.filter((key) => !stepName?.includes(key))
		expect(missing).toEqual([])
	})
})

/**
 * `scripts/check-version.ts` and `scripts/release-prepare.mjs` each quote a case
 * in `tests/architecture/package-exports.test.ts` by number and title. Nothing
 * in `validate` reads a source comment, so renumbering, renaming or deleting
 * that case leaves the quotation standing and wrong. This holds the quotations
 * those two files carry; the gate over every source comment is Story 12.2.
 */
describe('a comment quoting a test case names one that exists', () => {
	const cases = readFileSync(
		resolve('tests/architecture/package-exports.test.ts'),
		'utf8',
	)

	/** Comment markers dropped and lines joined, so a quotation that wraps reads as one string. */
	const prose = (source: string): string =>
		source
			.split('\n')
			.map((line) => line.replace(/^\s*(?:\/\/|\/\*\*|\*\/|\*)\s?/, '').trim())
			.join(' ')

	const QUOTATION = /case (\d+), "([^"]+)"/g

	for (const script of [
		'scripts/check-version.ts',
		'scripts/release-prepare.mjs',
	]) {
		it(`${script} quotes a case package-exports.test.ts still declares`, () => {
			const quotations = [
				...prose(readFileSync(resolve(script), 'utf8')).matchAll(QUOTATION),
			]
			expect(
				quotations.length,
				`${script} quotes no case; the gate has nothing to hold`,
			).toBeGreaterThan(0)
			for (const [, number, title] of quotations) {
				const declaration = `it('case ${number}: ${title}'`
				expect(
					cases.includes(declaration),
					`package-exports.test.ts declares no ${declaration}`,
				).toBe(true)
			}
		})
	}
})
