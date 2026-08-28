/**
 * `scripts/stamp-changelog.mjs` runs inside `release:prepare`, between `npm version` and the
 * release commit. Black-box through the CLI: a `.mjs` import from a `.ts` test has no declaration
 * under `strict`, and the CLI path (argument parsing, the date override, the exit code) is what the
 * release script actually calls.
 */

import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SCRIPT = resolve('scripts/stamp-changelog.mjs')
const DATE = '2026-08-11'

const SAMPLE = [
	'# Changelog',
	'',
	'All notable changes will be documented in this file.',
	'',
	'## [Unreleased]',
	'',
	'### Fixed',
	'',
	'- a fix that has not shipped yet',
	'',
	'## [1.21.0] - 2026-08-01',
	'',
	'- an older entry',
	'',
].join('\n')

/** Writes `source` to a fresh temp file, runs the script on it, returns the outcome. */
const run = (source: string, version: string, ...extra: string[]) => {
	const dir = mkdtempSync(join(tmpdir(), 'stamp-changelog-'))
	const file = join(dir, 'CHANGELOG.md')
	writeFileSync(file, source)
	const result = spawnSync(
		process.execPath,
		[SCRIPT, '--file', file, '--version', version, ...extra],
		{ encoding: 'utf8', env: { ...process.env, CHANGELOG_DATE: DATE } },
	)
	return {
		status: result.status,
		stdout: result.stdout,
		stderr: result.stderr,
		output: readFileSync(file, 'utf8'),
	}
}

describe('stamp-changelog', () => {
	it('stamps unreleased notes into a dated version section', () => {
		const { status, output } = run(SAMPLE, '1.22.0')
		expect(status).toBe(0)
		expect(output).toMatch(
			/## \[Unreleased\]\n\n## \[1\.22\.0\] - 2026-08-11\n\n### Fixed\n\n- a fix that has not shipped yet/,
		)
	})

	it('leaves an empty [Unreleased] heading in place for the next cycle', () => {
		expect(run(SAMPLE, '1.22.0').output).toMatch(/^## \[Unreleased\]$/m)
	})

	it('preserves earlier version sections verbatim', () => {
		expect(run(SAMPLE, '1.22.0').output).toMatch(
			/## \[1\.21\.0\] - 2026-08-01\n\n- an older entry/,
		)
	})

	it('does no work when [Unreleased] is empty', () => {
		const source =
			'# Changelog\n\n## [Unreleased]\n\n## [1.0.0] - 2026-01-01\n\n- shipped\n'
		const { status, stdout, output } = run(source, '1.1.0')
		expect(status).toBe(0)
		expect(stdout).toContain('nothing to stamp')
		expect(output).toBe(source)
	})

	it('is idempotent once a section for the version exists', () => {
		const once = run(SAMPLE, '1.22.0').output
		const { status, stdout, output } = run(once, '1.22.0')
		expect(status).toBe(0)
		expect(stdout).toContain('already has a section')
		expect(output).toBe(once)
	})

	it('treats version dots as literals rather than wildcards', () => {
		const source =
			'# Changelog\n\n## [Unreleased]\n\n- pending\n\n## [1x2x0] - 2026-01-01\n\n- decoy\n'
		expect(run(source, '1.2.0').output).toContain('## [1.2.0] - 2026-08-11')
	})

	it('handles [Unreleased] as the final section', () => {
		const { output } = run(
			'# Changelog\n\n## [Unreleased]\n\n- only entry\n',
			'2.0.0',
		)
		expect(output).toMatch(/## \[2\.0\.0\] - 2026-08-11\n\n- only entry/)
	})

	it('refuses a changelog with no [Unreleased] heading', () => {
		const source = '# Changelog\n\n## [1.0.0]\n\n- shipped\n'
		const { status, stderr, output } = run(source, '1.1.0')
		expect(status).toBe(1)
		expect(stderr).toContain('[Unreleased]')
		expect(output).toBe(source)
	})

	it('leaves the file alone under --dry-run', () => {
		const { status, stdout, output } = run(SAMPLE, '1.22.0', '--dry-run')
		expect(status).toBe(0)
		expect(stdout).toContain('[dry-run]')
		expect(output).toBe(SAMPLE)
	})

	it('rejects an unknown argument', () => {
		const { status, stderr } = run(SAMPLE, '1.22.0', '--bogus')
		expect(status).toBe(1)
		expect(stderr).toContain('Unknown argument: --bogus')
	})

	it('the repository CHANGELOG.md still carries an [Unreleased] heading to stamp', () => {
		// release-prepare stamps this heading; removing it breaks the release.
		expect(readFileSync(resolve('CHANGELOG.md'), 'utf8')).toMatch(
			/^## \[Unreleased\]$/m,
		)
	})
})
