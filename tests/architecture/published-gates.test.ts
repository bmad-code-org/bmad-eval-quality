/**
 * The gates a consumer runs: the configuration loader's refusals, the
 * multiplexer's usage errors, and each published gate over a compliant fixture
 * and a seeded one.
 *
 * The seeded fixtures are the weight-bearing part. A seed written in the same
 * vocabulary as the rule it trips only confirms the rule already written, so one
 * seed per gate is worded from outside it: the licence fixture carries
 * `Apache-2.0 WITH LLVM-exception`, which contains an allowlisted identifier and
 * has to fail anyway, and the age fixture carries no young package at all, only
 * a wholesome-looking entry resolved somewhere other than the npm registry.
 *
 * Two further fixtures state defects neither of those can reach.
 * `substituted-package` carries an ordinary MIT entry at an ordinary version
 * whose `resolved` names a different package on registry.npmjs.org itself, which
 * a host-prefix test passes and both gates have to fail. `lockfile-version-1` is
 * an npm 6 lockfile carrying a real dependency and no `packages` key, which both
 * gates once reported as having passed over zero entries.
 *
 * The age gate's one effect is a registry fetch, so its compliant case supplies
 * the registry's answers through `readTimeMap` rather than reaching the network:
 * a test that needs the network fails when the network does, and says nothing
 * about the gate when it passes. Its seeded cases need no such thing, because an
 * entry that does not resolve to its own registry tarball is refused before any
 * fetch is attempted.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
	LOCKFILE_SHAPE_ERROR as AGE_LOCKFILE_SHAPE_ERROR,
	auditLockfileAge,
	WINDOW_DAYS_DEFAULT,
} from '../../scripts/audit-lockfile-age.mjs'
import {
	checkLicenses,
	LOCKFILE_SHAPE_ERROR as LICENCE_LOCKFILE_SHAPE_ERROR,
} from '../../scripts/check-licenses.mjs'
import {
	DEFAULT_CONFIG_FILE,
	GATE_NAMES,
	LOCKFILE_WINDOW_DAYS_DEFAULT,
	loadLicencesConfig,
	loadLockfileAgeConfig,
} from '../../scripts/gate-config.ts'
import { EXIT_USAGE } from '../../src/cli/exit-codes.ts'

const CLI = resolve('scripts/gates-cli.ts')
const FIXTURES = resolve('scripts/fixtures/consumer')

const configOf = (fixture: string): string =>
	join(FIXTURES, fixture, DEFAULT_CONFIG_FILE)

const lockfileOf = (fixture: string): unknown =>
	JSON.parse(readFileSync(join(FIXTURES, fixture, 'package-lock.json'), 'utf8'))

type Run = { readonly status: number; readonly output: string }

const runGates = (...args: readonly string[]): Run => {
	const result = spawnSync(process.execPath, [CLI, ...args], {
		encoding: 'utf8',
	})
	return {
		status: result.status ?? -1,
		output: `${result.stdout}${result.stderr}`,
	}
}

/** A configuration file written into a temporary directory, per AD-30. */
const temporaryConfig = (body: string): string => {
	const root = mkdtempSync(join(tmpdir(), 'gate-config-case-'))
	const path = join(root, DEFAULT_CONFIG_FILE)
	writeFileSync(path, body, 'utf8')
	return path
}

const ANCIENT = '2020-01-01T00:00:00.000Z'

const compliantTimeMaps: Readonly<Record<string, Record<string, string>>> = {
	'@fixture-scope/toolkit': { '1.0.0': ANCIENT },
	'fixture-dual': { '2.0.0': ANCIENT },
}

/** This repository's own `@img/sharp-` exception, as the loader hands it over. */
const SHARP_TOLERANCE = {
	reason: 'never loaded',
	prefix: '@img/sharp-',
	license: 'LGPL-3.0-or-later',
	optional: true,
}

/** Optional platform binaries under that prefix, each at its canonical registry URL. */
const sharpLockfile = (
	entries: readonly (readonly [string, string, string])[],
): unknown => ({
	packages: Object.fromEntries([
		['', { name: 'tolerance-fixture' }],
		...entries.map(([name, version, license]) => [
			`node_modules/@img/${name}`,
			{
				version,
				resolved: `https://registry.npmjs.org/@img/${name}/-/${name}-${version}.tgz`,
				license,
				optional: true,
			},
		]),
	]),
})

describe('the gate configuration loader', () => {
	it('refuses an absent file, naming the file and the gate', async () => {
		const result = await loadLicencesConfig({
			configPath: join(
				mkdtempSync(join(tmpdir(), 'gate-absent-')),
				'nope.json',
			),
		})
		expect(result.kind).toBe('refused')
		if (result.kind !== 'refused') return
		expect(result.message).toContain('nope.json does not exist')
		expect(result.message).toContain('the licences gate is configured there')
		expect(result.message).toContain('--config <path>')
	})

	it('refuses a file that configures some other gate, and says which', async () => {
		const path = temporaryConfig(
			JSON.stringify({ licences: { lockfiles: ['a'], allowlist: ['MIT'] } }),
		)
		const result = await loadLockfileAgeConfig({ configPath: path })
		expect(result.kind).toBe('refused')
		if (result.kind !== 'refused') return
		expect(result.message).toContain('declares no "lockfile-age" section')
		expect(result.message).toContain('it configures licences')
		expect(result.message).toContain('configuring a gate is what opts into it')
	})

	it('refuses a malformed section, naming the setting and what was expected', async () => {
		const path = temporaryConfig(
			JSON.stringify({ 'lockfile-age': { lockfiles: [], windowDays: -1 } }),
		)
		const result = await loadLockfileAgeConfig({ configPath: path })
		expect(result.kind).toBe('refused')
		if (result.kind !== 'refused') return
		expect(result.message).toContain('"lockfile-age" section is malformed')
		expect(result.message).toContain('lockfiles:')
		expect(result.message).toContain('windowDays:')
	})

	it('refuses an unknown setting inside a section it is running', async () => {
		const path = temporaryConfig(
			JSON.stringify({
				'lockfile-age': { lockfiles: ['package-lock.json'], windowDay: 7 },
			}),
		)
		const result = await loadLockfileAgeConfig({ configPath: path })
		expect(result.kind).toBe('refused')
	})

	it('refuses a version pin where an SPDX identifier belongs', async () => {
		const path = temporaryConfig(
			JSON.stringify({
				licences: { lockfiles: ['a'], allowlist: ['left-pad@1.3.0'] },
			}),
		)
		const result = await loadLicencesConfig({ configPath: path })
		expect(result.kind).toBe('refused')
		if (result.kind !== 'refused') return
		expect(result.message).toContain('SPDX short identifier')
	})

	it('refuses a file that is not JSON, and one that is not an object', async () => {
		const notJson = await loadLicencesConfig({
			configPath: temporaryConfig('{ not json'),
		})
		expect(notJson.kind).toBe('refused')
		if (notJson.kind === 'refused') {
			expect(notJson.message).toContain('is not valid JSON')
		}
		const notObject = await loadLicencesConfig({
			configPath: temporaryConfig('[]'),
		})
		expect(notObject.kind).toBe('refused')
		if (notObject.kind === 'refused') {
			expect(notObject.message).toContain('is not a JSON object')
		}
	})

	it('does not block one gate on another gate being malformed', async () => {
		const path = temporaryConfig(
			JSON.stringify({
				'lockfile-age': { lockfiles: 'not an array' },
				licences: { lockfiles: ['package-lock.json'], allowlist: ['MIT'] },
			}),
		)
		const licences = await loadLicencesConfig({ configPath: path })
		expect(licences.kind).toBe('section')
	})

	it('refuses a window of zero days', async () => {
		const path = temporaryConfig(
			JSON.stringify({
				'lockfile-age': { lockfiles: ['package-lock.json'], windowDays: 0 },
			}),
		)
		const result = await loadLockfileAgeConfig({ configPath: path })
		expect(result.kind).toBe('refused')
		if (result.kind !== 'refused') return
		expect(result.message).toContain('windowDays:')
	})

	it('refuses a policies key naming a lockfile the section does not', async () => {
		const path = temporaryConfig(
			JSON.stringify({
				licences: {
					lockfiles: ['package-lock.json'],
					allowlist: ['MIT'],
					policies: {
						'webiste/package-lock.json': {
							label: 'a policy that runs on nothing',
							reason: 'the key is a typo, so it matches no lockfile at all',
							also: ['MPL-2.0'],
						},
					},
				},
			}),
		)
		const result = await loadLicencesConfig({ configPath: path })
		expect(result.kind).toBe('refused')
		if (result.kind !== 'refused') return
		expect(result.message).toContain('policies.webiste/package-lock.json')
		expect(result.message).toContain(
			'not one of the lockfiles this section declares: package-lock.json',
		)
	})

	it('refuses a tolerance naming a lockfile the section does not', async () => {
		const path = temporaryConfig(
			JSON.stringify({
				licences: {
					lockfiles: ['package-lock.json'],
					allowlist: ['MIT'],
					tolerances: [
						{
							reason: 'an exception that applies to nothing at all',
							lockfiles: ['pacakge-lock.json'],
							prefix: '@img/sharp-',
							license: 'LGPL-3.0-or-later',
						},
					],
				},
			}),
		)
		const result = await loadLicencesConfig({ configPath: path })
		expect(result.kind).toBe('refused')
		if (result.kind !== 'refused') return
		expect(result.message).toContain('tolerances.0.lockfiles.0')
		expect(result.message).toContain('pacakge-lock.json')
	})

	it('refuses a tolerance whose licence is a whole expression', async () => {
		const path = temporaryConfig(
			JSON.stringify({
				licences: {
					lockfiles: ['package-lock.json'],
					allowlist: ['MIT'],
					tolerances: [
						{
							reason: 'the family declares two terms at once',
							lockfiles: ['package-lock.json'],
							prefix: '@img/sharp-',
							license: 'Apache-2.0 AND LGPL-3.0-or-later',
						},
					],
				},
			}),
		)
		const result = await loadLicencesConfig({ configPath: path })
		expect(result.kind).toBe('refused')
		if (result.kind !== 'refused') return
		expect(result.message).toContain('tolerances.0.license')
		expect(result.message).toContain('SPDX short identifier')
	})

	it("loads this repository's own configuration", async () => {
		const configPath = resolve('eval-quality.config.json')
		expect((await loadLicencesConfig({ configPath })).kind).toBe('section')
		expect((await loadLockfileAgeConfig({ configPath })).kind).toBe('section')
	})

	it('applies the window default when a section names none', async () => {
		const result = await loadLockfileAgeConfig({
			configPath: configOf('compliant'),
		})
		expect(result.kind).toBe('section')
		if (result.kind !== 'section') return
		expect(result.section.windowDays).toBe(LOCKFILE_WINDOW_DAYS_DEFAULT)
	})

	it('declares the same window default the flag path uses', () => {
		expect(WINDOW_DAYS_DEFAULT).toBe(LOCKFILE_WINDOW_DAYS_DEFAULT)
	})
})

describe('the gates binary', () => {
	it('names the gates when none is given', () => {
		const run = runGates()
		expect(run.status).toBe(EXIT_USAGE)
		expect(run.output).toContain('no gate given; expected one of')
		for (const gate of GATE_NAMES) expect(run.output).toContain(gate)
	})

	it('names the gates on an unknown one', () => {
		const run = runGates('licence')
		expect(run.status).toBe(EXIT_USAGE)
		expect(run.output).toContain('unknown gate "licence"')
	})

	it('refuses an unknown flag, an empty value, and a missing value', () => {
		expect(runGates('licences', '--lockfile', 'a').status).toBe(EXIT_USAGE)
		expect(runGates('licences', '--config=').status).toBe(EXIT_USAGE)
		const missing = runGates('licences', '--config')
		expect(missing.status).toBe(EXIT_USAGE)
		expect(missing.output).toContain('--config requires a value')
	})

	it('prints usage and exits zero on --help', () => {
		const run = runGates('--help')
		expect(run.status).toBe(0)
		expect(run.output).toContain('eval-quality-gates <gate>')
	})

	it('refuses a gate the configuration does not carry, at the usage code', () => {
		const run = runGates(
			'lockfile-age',
			'--config',
			configOf('licences-seeded'),
		)
		expect(run.status).toBe(EXIT_USAGE)
		expect(run.output).toContain('declares no "lockfile-age" section')
	})
})

describe('the licences gate', () => {
	it('passes on the compliant fixture', () => {
		const run = runGates('licences', '--config', configOf('compliant'))
		expect(run.output).toContain('licences package-lock.json: passed')
		expect(run.output).toContain('2 entrie(s)')
		expect(run.status).toBe(0)
	})

	it('fails on a licence expression that carries an allowlisted identifier', () => {
		const run = runGates('licences', '--config', configOf('licences-seeded'))
		expect(run.status).toBe(1)
		expect(run.output).toContain('fixture-runtime@3.1.0')
		expect(run.output).toContain('Apache-2.0 WITH LLVM-exception')
		expect(run.output).toContain(
			'dependency path: consumer-licence-seeded-fixture > @fixture-scope/toolkit > fixture-runtime',
		)
	})

	it('fails an entry resolved to another package on the registry itself', () => {
		const run = runGates(
			'licences',
			'--config',
			configOf('substituted-package'),
		)
		expect(run.status).toBe(1)
		expect(run.output).toContain('fixture-dual@2.0.0')
		expect(run.output).toContain('fixture-substitute-9.9.9.tgz')
		expect(run.output).toContain(
			'https://registry.npmjs.org/fixture-dual/-/fixture-dual-2.0.0.tgz',
		)
	})

	it('refuses a lockfile carrying no packages object, naming its version', () => {
		expect(() =>
			checkLicenses(lockfileOf('lockfile-version-1'), {
				allowlist: ['MIT'],
				source: 'package-lock.json',
			}),
		).toThrow(/package-lock\.json carries no "packages" object/)
	})

	it('does not report a lockfile it read nothing out of as passing', () => {
		const run = runGates('licences', '--config', configOf('lockfile-version-1'))
		expect(run.status).not.toBe(0)
		expect(run.output).toContain('carries no "packages" object')
		expect(run.output).toContain('lockfileVersion 1')
		expect(run.output).not.toContain('0 entrie(s)')
	})

	it('refuses to run with no allowlist rather than choosing one', () => {
		expect(() => checkLicenses(lockfileOf('compliant'), {})).toThrow(
			/no allowlist was supplied/,
		)
	})

	it('tolerates a scoped exception and reports the reason it holds', () => {
		const report = checkLicenses(
			{
				packages: {
					'': { name: 'tolerance-fixture' },
					'node_modules/@img/sharp-linux-x64': {
						version: '1.0.0',
						resolved:
							'https://registry.npmjs.org/@img/sharp-linux-x64/-/sharp-linux-x64-1.0.0.tgz',
						license: 'LGPL-3.0-or-later',
						optional: true,
					},
				},
			},
			{
				allowlist: ['MIT'],
				label: 'the allowlist',
				tolerances: [
					{
						reason: 'never loaded',
						prefix: '@img/sharp-',
						license: 'LGPL-3.0-or-later',
						optional: true,
					},
				],
			},
		)
		expect(report.violations).toEqual([])
		expect(report.tolerated).toEqual(['@img/sharp-linux-x64@1.0.0'])
		expect(report.toleranceReasons).toEqual(['never loaded'])
	})

	it('withdraws that exception when the entry is not optional', () => {
		const report = checkLicenses(
			{
				packages: {
					'': { name: 'tolerance-fixture' },
					'node_modules/@img/sharp-linux-x64': {
						version: '1.0.0',
						resolved:
							'https://registry.npmjs.org/@img/sharp-linux-x64/-/sharp-linux-x64-1.0.0.tgz',
						license: 'LGPL-3.0-or-later',
					},
				},
			},
			{
				allowlist: ['MIT'],
				label: 'the allowlist',
				tolerances: [
					{
						reason: 'never loaded',
						prefix: '@img/sharp-',
						license: 'LGPL-3.0-or-later',
						optional: true,
					},
				],
			},
		)
		expect(report.violations).toHaveLength(1)
	})

	it('withdraws that exception when an AND operand is outside the allowlist', () => {
		const report = checkLicenses(
			sharpLockfile([
				['sharp-linux-x64', '1.0.0', 'LGPL-3.0-or-later AND AGPL-3.0-only'],
			]),
			{
				allowlist: ['MIT', 'Apache-2.0'],
				label: 'the allowlist',
				tolerances: [SHARP_TOLERANCE],
			},
		)
		expect(report.tolerated).toEqual([])
		expect(report.violations).toHaveLength(1)
	})

	it('withdraws that exception from a WITH compound of the tolerated identifier', () => {
		const report = checkLicenses(
			sharpLockfile([
				['sharp-linux-x64', '1.0.0', 'LGPL-3.0-or-later WITH some-exception'],
			]),
			{
				allowlist: ['MIT', 'Apache-2.0'],
				label: 'the allowlist',
				tolerances: [SHARP_TOLERANCE],
			},
		)
		expect(report.tolerated).toEqual([])
		expect(report.violations).toHaveLength(1)
	})

	// The two compound shapes this repository's own website lockfile carries: the
	// win32 and wasm32 binaries bundle libvips and declare it alongside terms the
	// allowlist already holds. They are why the exception adds an identifier to the
	// allowlist; holding the whole expression equal to it would fail all four.
	it('keeps tolerating a compound whose other operands are allowlisted', () => {
		const report = checkLicenses(
			sharpLockfile([
				['sharp-win32-x64', '0.35.4', 'Apache-2.0 AND LGPL-3.0-or-later'],
				['sharp-wasm32', '0.35.4', 'Apache-2.0 AND LGPL-3.0-or-later AND MIT'],
			]),
			{
				allowlist: ['MIT', 'Apache-2.0'],
				label: 'the allowlist',
				tolerances: [SHARP_TOLERANCE],
			},
		)
		expect(report.violations).toEqual([])
		expect(report.tolerated).toEqual([
			'@img/sharp-wasm32@0.35.4',
			'@img/sharp-win32-x64@0.35.4',
		])
	})
})

describe('the lockfile-age gate', () => {
	it('passes on the compliant fixture', async () => {
		const report = await auditLockfileAge({
			lockfile: lockfileOf('compliant'),
			now: new Date(),
			windowDays: LOCKFILE_WINDOW_DAYS_DEFAULT,
			readTimeMap: async (name: string) => compliantTimeMaps[name] ?? {},
		})
		expect(report.entries).toHaveLength(2)
		expect(report.youngEntries).toEqual([])
		expect(report.unfetchableEntries).toEqual([])
		expect(report.offRegistryEntries).toEqual([])
	})

	it('fails on an entry published inside the window', async () => {
		const now = new Date()
		const report = await auditLockfileAge({
			lockfile: lockfileOf('compliant'),
			now,
			windowDays: LOCKFILE_WINDOW_DAYS_DEFAULT,
			readTimeMap: async (name: string) =>
				name === 'fixture-dual'
					? { '2.0.0': now.toISOString() }
					: (compliantTimeMaps[name] ?? {}),
		})
		expect(report.youngEntries).toHaveLength(1)
	})

	it('fails on a wholesome entry that resolves off the npm registry', () => {
		const run = runGates(
			'lockfile-age',
			'--config',
			configOf('lockfile-age-seeded'),
		)
		expect(run.status).toBe(1)
		expect(run.output).toContain('do not resolve to the npm registry')
		expect(run.output).toContain('fixture-mirror@1.4.2')
	})

	it('fails an entry resolved to another package on the registry itself', async () => {
		const report = await auditLockfileAge({
			lockfile: lockfileOf('substituted-package'),
			now: new Date(),
			windowDays: LOCKFILE_WINDOW_DAYS_DEFAULT,
			// Ancient, so the resolved URL is the only thing left that can fail it.
			readTimeMap: async () => ({ '2.0.0': ANCIENT }),
		})
		expect(report.youngEntries).toEqual([])
		expect(report.unfetchableEntries).toEqual([])
		expect(report.offRegistryEntries).toHaveLength(1)
		expect(report.offRegistryEntries[0]?.name).toBe('fixture-dual')
	})

	it('refuses a lockfile carrying no packages object, naming its version', async () => {
		await expect(
			auditLockfileAge({
				lockfile: lockfileOf('lockfile-version-1'),
				now: new Date(),
				windowDays: LOCKFILE_WINDOW_DAYS_DEFAULT,
				source: 'package-lock.json',
			}),
		).rejects.toThrow(/package-lock\.json carries no "packages" object/)
	})

	it('does not report a lockfile it read nothing out of as passing', () => {
		const run = runGates(
			'lockfile-age',
			'--config',
			configOf('lockfile-version-1'),
		)
		expect(run.status).not.toBe(0)
		expect(run.output).toContain('carries no "packages" object')
		expect(run.output).toContain('lockfileVersion 1')
		expect(run.output).not.toContain('0 entrie(s)')
	})

	it('marks both gates lockfile refusals with one code', () => {
		expect(AGE_LOCKFILE_SHAPE_ERROR).toBe(LICENCE_LOCKFILE_SHAPE_ERROR)
	})

	it('refuses a window of zero days on the flag path too', async () => {
		await expect(
			auditLockfileAge({
				lockfile: lockfileOf('compliant'),
				now: new Date(),
				windowDays: 0,
				readTimeMap: async (name: string) => compliantTimeMaps[name] ?? {},
			}),
		).rejects.toThrow(/windowDays must be at least 1/)
	})

	// Anything without a script path (`node -e`, `--input-type=module`, the REPL)
	// leaves process.argv[1] undefined, and pathToFileURL threw ERR_INVALID_ARG_TYPE
	// on it at import time. The module ships in `dist/gates/`, so a consumer hits
	// it, and so does `canary-age` in pr-checks.yml, which reads the window default
	// out of this module with this exact spelling.
	it('imports where there is no script path at all', () => {
		const moduleUrl = pathToFileURL(
			resolve('scripts/audit-lockfile-age.mjs'),
		).href
		const result = spawnSync(
			process.execPath,
			[
				'-e',
				`import(${JSON.stringify(moduleUrl)}).then((gate) => console.log(gate.WINDOW_DAYS_DEFAULT))`,
			],
			{ encoding: 'utf8' },
		)
		expect(`${result.stdout}${result.stderr}`).not.toContain(
			'ERR_INVALID_ARG_TYPE',
		)
		expect(result.stdout.trim()).toBe(String(WINDOW_DAYS_DEFAULT))
		expect(result.status).toBe(0)
	})

	it('names the lockfile a configuration points at and the filesystem has not', () => {
		const path = temporaryConfig(
			JSON.stringify({ 'lockfile-age': { lockfiles: ['absent-lock.json'] } }),
		)
		const run = runGates('lockfile-age', '--config', path)
		expect(run.status).toBe(EXIT_USAGE)
		expect(run.output).toContain('absent-lock.json does not exist')
		expect(run.output).toContain('names it under lockfiles')
	})
})

describe('the built gates binary', () => {
	const BUILT = existsSync(resolve('dist/gates/gates-cli.js'))
	const NEEDS_BUILD =
		'dist/gates/gates-cli.js is absent. Run `npm run build` first: this case runs the built binary.'

	it('emits every module the binary loads', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		for (const emitted of [
			'dist/gates/gates-cli.js',
			'dist/gates/gate-config.js',
			'dist/gates/audit-lockfile-age.mjs',
			'dist/gates/check-licenses.mjs',
		]) {
			expect(existsSync(resolve(emitted)), `${emitted} was not emitted`).toBe(
				true,
			)
		}
	})

	it('runs a gate end to end from the published path', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const result = spawnSync(
			process.execPath,
			[
				resolve('dist/gates/gates-cli.js'),
				'licences',
				'--config',
				configOf('compliant'),
			],
			{ encoding: 'utf8' },
		)
		expect(`${result.stdout}${result.stderr}`).toContain(
			'licences package-lock.json: passed',
		)
		expect(result.status).toBe(0)
	})
})
