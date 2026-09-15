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
 * Two more pairs carry the settings a consumer declares for what the rules
 * above cannot admit. `licences-undeclared-*` share a lockfile with one entry
 * that declares no licence at all, which no allowlist can reach; the seeded
 * configuration carries no row for it and the other reads it as MIT by
 * evidence. `lockfile-age-excluded-*` share an excluded name; the compliant one
 * resolves it to the registry and passes with no fetch, and the seeded one
 * resolves it to a mirror, which an exclusion never exempts.
 *
 * The three scanning gates carry a fixture pair apiece, and each pair is a tree
 * rather than a lockfile: a compliant one the gate passes, and a seeded one
 * carrying the defect its own rules were not written for. The seeds and the
 * rules they trip are held in the gate modules' own test files; what is asserted
 * here is the binary, which is the surface a consumer actually invokes.
 *
 * The direction gate's report-only case is the one the story names. A mode whose
 * whole purpose is showing the size of a fix before committing to it fails
 * silently if it can exit 0 with nothing to read, so the case pins both halves:
 * exit 0, and a count in the output.
 *
 * The age gate's one effect is a registry fetch, so its compliant case supplies
 * the registry's answers through `readTimeMap` rather than reaching the network:
 * a test that needs the network fails when the network does, and says nothing
 * about the gate when it passes. Its seeded cases need no such thing, because an
 * entry that does not resolve to its own registry tarball is refused before any
 * fetch is attempted.
 */
import { spawnSync } from 'node:child_process'
import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
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
	loadDependencyDirectionConfig,
	loadDocClaimsConfig,
	loadDocCountsConfig,
	loadDocInvocationsConfig,
	loadFieldOwnershipConfig,
	loadLicencesConfig,
	loadLockfileAgeConfig,
	loadPackageBoundaryConfig,
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

/**
 * A configuration and the lockfiles it names, written together. One lockfile
 * lands at `package-lock.json`; a map lands each at its own relative path.
 */
const temporaryLockfileFixture = (
	config: unknown,
	lockfiles: unknown | Readonly<Record<string, unknown>>,
	paths?: readonly string[],
): string => {
	const root = mkdtempSync(join(tmpdir(), 'gate-lockfile-case-'))
	const files: Readonly<Record<string, unknown>> =
		paths === undefined
			? { 'package-lock.json': lockfiles }
			: (lockfiles as Readonly<Record<string, unknown>>)
	for (const [relative, lockfile] of Object.entries(files)) {
		mkdirSync(join(root, dirname(relative)), { recursive: true })
		writeFileSync(join(root, relative), JSON.stringify(lockfile), 'utf8')
	}
	const path = join(root, DEFAULT_CONFIG_FILE)
	writeFileSync(path, JSON.stringify(config), 'utf8')
	return path
}

/** An age exclusion row for one name, in the shape the loader hands over. */
const exclusionOf = (name: string, lockfiles = ['package-lock.json']) => ({
	name,
	reason: 'pinned exactly and adopted on release day',
	lockfiles,
})

/** One registry entry with no `license` field, at its canonical URL. */
const undeclaredEntry = (name: string, version: string) => ({
	version,
	resolved: `${REGISTRY}/${name}/-/${name.split('/').pop()}-${version}.tgz`,
})

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

/** The reading the tolerated undeclared fixture carries, as the loader hands it over. */
const UNLICENSED_ROW = {
	reason: 'the tarball omits the field',
	prefix: 'fixture-unlicensed',
	readAs: 'MIT',
	evidence: 'the registry packument for fixture-unlicensed@1.0.0 declares MIT',
}

const REGISTRY = 'https://registry.npmjs.org'

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

	it('refuses an undeclared row naming a lockfile the section does not', async () => {
		const path = temporaryConfig(
			JSON.stringify({
				licences: {
					lockfiles: ['package-lock.json'],
					allowlist: ['MIT'],
					undeclared: [{ ...UNLICENSED_ROW, lockfiles: ['nope.json'] }],
				},
			}),
		)
		const result = await loadLicencesConfig({ configPath: path })
		expect(result.kind).toBe('refused')
		if (result.kind !== 'refused') return
		expect(result.message).toContain('undeclared.0.lockfiles.0')
		expect(result.message).toContain(
			'names "nope.json", which is not one of the lockfiles this section declares: package-lock.json',
		)
	})

	it('refuses a version pin and an expression where the read-as identifier belongs', async () => {
		for (const readAs of ['left-pad@1.3.0', '(MIT OR ISC)']) {
			const path = temporaryConfig(
				JSON.stringify({
					licences: {
						lockfiles: ['package-lock.json'],
						allowlist: ['MIT'],
						undeclared: [
							{ ...UNLICENSED_ROW, lockfiles: ['package-lock.json'], readAs },
						],
					},
				}),
			)
			const result = await loadLicencesConfig({ configPath: path })
			expect(result.kind, readAs).toBe('refused')
			if (result.kind !== 'refused') return
			expect(result.message).toContain('undeclared.0.readAs')
			expect(result.message).toContain('SPDX short identifier')
		}
	})

	// A marker and an optional flag mean nothing for an entry that declares no
	// licence, so the row is strict and neither may be written on it.
	it('refuses a marker or an optional flag on an undeclared row', async () => {
		for (const extra of [
			{ optional: true },
			{ marker: { file: 'a', contains: 'b' } },
		]) {
			const path = temporaryConfig(
				JSON.stringify({
					licences: {
						lockfiles: ['package-lock.json'],
						allowlist: ['MIT'],
						undeclared: [
							{ ...UNLICENSED_ROW, lockfiles: ['package-lock.json'], ...extra },
						],
					},
				}),
			)
			const result = await loadLicencesConfig({ configPath: path })
			expect(result.kind, JSON.stringify(extra)).toBe('refused')
		}
	})

	it('refuses a version literal and a bare scope where the age exclusion takes a name', () => {
		for (const name of ['fixture-pinned@4.2.0', '@fixture-scope']) {
			const path = temporaryConfig(
				JSON.stringify({
					'lockfile-age': {
						lockfiles: ['package-lock.json'],
						exclude: [exclusionOf(name)],
					},
				}),
			)
			const run = runGates('lockfile-age', '--config', path)
			expect(run.status, name).toBe(EXIT_USAGE)
			expect(run.output).toContain('exclude.0.name: is not a package name')
		}
	})

	it('refuses an exclusion naming a lockfile the section does not', async () => {
		const path = temporaryConfig(
			JSON.stringify({
				'lockfile-age': {
					lockfiles: ['package-lock.json'],
					exclude: [exclusionOf('fixture-pinned', ['nope.json'])],
				},
			}),
		)
		const result = await loadLockfileAgeConfig({ configPath: path })
		expect(result.kind).toBe('refused')
		if (result.kind !== 'refused') return
		expect(result.message).toContain('exclude.0.lockfiles.0')
		expect(result.message).toContain(
			'names "nope.json", which is not one of the lockfiles this section declares: package-lock.json',
		)
	})

	it('refuses an exclusion with no reason', async () => {
		const path = temporaryConfig(
			JSON.stringify({
				'lockfile-age': {
					lockfiles: ['package-lock.json'],
					exclude: [
						{ name: 'fixture-pinned', lockfiles: ['package-lock.json'] },
					],
				},
			}),
		)
		const result = await loadLockfileAgeConfig({ configPath: path })
		expect(result.kind).toBe('refused')
		if (result.kind !== 'refused') return
		expect(result.message).toContain('exclude.0.reason')
	})

	it("loads this repository's own configuration, through every gate's loader", async () => {
		const configPath = resolve('eval-quality.config.json')
		expect((await loadLicencesConfig({ configPath })).kind).toBe('section')
		expect((await loadLockfileAgeConfig({ configPath })).kind).toBe('section')
		expect((await loadDependencyDirectionConfig({ configPath })).kind).toBe(
			'section',
		)
		expect((await loadPackageBoundaryConfig({ configPath })).kind).toBe(
			'section',
		)
		expect((await loadFieldOwnershipConfig({ configPath })).kind).toBe(
			'section',
		)
		expect((await loadDocInvocationsConfig({ configPath })).kind).toBe(
			'section',
		)
		expect((await loadDocCountsConfig({ configPath })).kind).toBe('section')
		expect((await loadDocClaimsConfig({ configPath })).kind).toBe('section')
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

	it('fails an entry that declares no licence, and says so', () => {
		const run = runGates(
			'licences',
			'--config',
			configOf('licences-undeclared-seeded'),
		)
		expect(run.status).toBe(1)
		expect(run.output).toContain(
			'fixture-unlicensed@1.0.0: license=null (declares no licence)',
		)
		expect(run.output).toContain(
			'dependency path: consumer-undeclared-fixture > @fixture-scope/toolkit > fixture-unlicensed',
		)
	})

	it('reads an undeclared entry by evidence, apart from the tolerated', () => {
		const run = runGates(
			'licences',
			'--config',
			configOf('licences-undeclared-by-evidence'),
		)
		expect(run.status).toBe(0)
		expect(run.output).toContain(
			'licences package-lock.json: passed against the allowlist, 3 entrie(s)',
		)
		expect(run.output).toContain(
			'read by evidence: fixture-unlicensed@1.0.0 as MIT',
		)
		expect(run.output).toContain(
			'evidence: the registry packument for fixture-unlicensed@1.0.0 declares MIT',
		)
		expect(run.output).toContain('because: the tarball omits the field')
		expect(run.output).not.toContain('tolerated:')
	})

	it('fails a reading outside the allowlist, saying it was read by evidence', () => {
		const report = checkLicenses(lockfileOf('licences-undeclared-seeded'), {
			allowlist: ['MIT', 'Apache-2.0'],
			label: 'the allowlist',
			undeclared: [{ ...UNLICENSED_ROW, readAs: 'GPL-3.0-only' }],
		})
		expect(report.readByEvidence).toEqual([])
		expect(report.violations).toHaveLength(1)
		expect(report.violations[0]?.reason).toBe(
			'read by evidence as GPL-3.0-only, which is outside the allowlist',
		)
	})

	it('holds a declared entry under the prefix to its declaration', () => {
		const report = checkLicenses(
			{
				packages: {
					'': { name: 'undeclared-fixture' },
					'node_modules/fixture-unlicensed': {
						version: '1.0.0',
						resolved: `${REGISTRY}/fixture-unlicensed/-/fixture-unlicensed-1.0.0.tgz`,
						license: 'GPL-3.0-only',
					},
				},
			},
			{
				allowlist: ['MIT'],
				label: 'the allowlist',
				undeclared: [UNLICENSED_ROW],
			},
		)
		expect(report.readByEvidence).toEqual([])
		expect(report.violations).toHaveLength(1)
		expect(report.violations[0]?.license).toBe('GPL-3.0-only')
		expect(report.violations[0]?.reason).toBeUndefined()
	})

	it('consults no tolerance for an entry that declares nothing', () => {
		const report = checkLicenses(lockfileOf('licences-undeclared-seeded'), {
			allowlist: ['MIT', 'Apache-2.0'],
			label: 'the allowlist',
			tolerances: [
				{
					reason: 'a tolerance for the same family',
					prefix: 'fixture-unlicensed',
					license: 'MIT',
					optional: false,
				},
			],
		})
		expect(report.tolerated).toEqual([])
		expect(report.violations).toHaveLength(1)
		expect(report.violations[0]?.reason).toBe('declares no licence')
	})

	// `licenseStringOf` returns null for an absent field and for a shape it does
	// not read. Only the first declares nothing; a row written for it must not
	// admit the second.
	it('leaves a licence in an unread shape to fail as declared', () => {
		for (const license of [['MIT'], [{ type: 'GPL-3.0-only' }], { url: 'x' }]) {
			const report = checkLicenses(
				{
					packages: {
						'': { name: 'undeclared-fixture' },
						'node_modules/fixture-unlicensed': {
							...undeclaredEntry('fixture-unlicensed', '1.0.0'),
							license,
						},
					},
				},
				{
					allowlist: ['MIT'],
					label: 'the allowlist',
					undeclared: [UNLICENSED_ROW],
				},
			)
			expect(report.readByEvidence, JSON.stringify(license)).toEqual([])
			expect(report.violations).toHaveLength(1)
			expect(report.violations[0]?.license).toEqual(license)
			expect(report.violations[0]?.reason).toBeUndefined()
			expect(report.unusedUndeclared).toEqual(['fixture-unlicensed'])
		}
	})

	it('reads an empty or blank licence field as undeclared', () => {
		const lockfileWith = (license: string): unknown => ({
			packages: {
				'': { name: 'undeclared-fixture' },
				'node_modules/fixture-unlicensed': {
					...undeclaredEntry('fixture-unlicensed', '1.0.0'),
					license,
				},
			},
		})
		const admitted = checkLicenses(lockfileWith(''), {
			allowlist: ['MIT'],
			label: 'the allowlist',
			undeclared: [UNLICENSED_ROW],
		})
		expect(admitted.violations).toEqual([])
		expect(admitted.readByEvidence.map((r) => r.entry)).toEqual([
			'fixture-unlicensed@1.0.0',
		])
		const refused = checkLicenses(lockfileWith('   '), {
			allowlist: ['MIT'],
			label: 'the allowlist',
		})
		expect(refused.violations).toHaveLength(1)
		expect(refused.violations[0]?.reason).toBe(
			'declares no licence, the field is blank',
		)
	})

	// The prefix rule is a tolerance's: a plain string prefix with no boundary.
	// Pinned so the docs sentence that says so stays true.
	it('reaches every undeclared name under the prefix, with no boundary', () => {
		const report = checkLicenses(
			{
				packages: {
					'': { name: 'undeclared-fixture' },
					'node_modules/fixture-unlicensed': undeclaredEntry(
						'fixture-unlicensed',
						'1.0.0',
					),
					'node_modules/fixture-unlicensed-extra': undeclaredEntry(
						'fixture-unlicensed-extra',
						'2.0.0',
					),
				},
			},
			{
				allowlist: ['MIT'],
				label: 'the allowlist',
				undeclared: [UNLICENSED_ROW],
			},
		)
		expect(report.violations).toEqual([])
		expect(report.readByEvidence.map((r) => r.entry)).toEqual([
			'fixture-unlicensed-extra@2.0.0',
			'fixture-unlicensed@1.0.0',
		])
		expect(report.unusedUndeclared).toEqual([])
	})

	it('takes the first matching row the allowlist admits, as a tolerance does', () => {
		const report = checkLicenses(lockfileOf('licences-undeclared-seeded'), {
			allowlist: ['MIT'],
			label: 'the allowlist',
			undeclared: [
				{ ...UNLICENSED_ROW, readAs: 'GPL-3.0-only' },
				{ ...UNLICENSED_ROW, prefix: 'fixture-unlicensed', readAs: 'MIT' },
			],
		})
		expect(report.violations).toEqual([])
		expect(report.readByEvidence[0]?.readAs).toBe('MIT')
	})

	it('prints the reading and the tolerated on a failing run too', () => {
		const path = temporaryLockfileFixture(
			{
				licences: {
					lockfiles: ['package-lock.json'],
					allowlist: ['MIT'],
					tolerances: [
						{
							reason: 'never loaded',
							lockfiles: ['package-lock.json'],
							prefix: '@img/sharp-',
							license: 'LGPL-3.0-or-later',
						},
					],
					undeclared: [{ ...UNLICENSED_ROW, lockfiles: ['package-lock.json'] }],
				},
			},
			{
				packages: {
					'': { name: 'undeclared-fixture' },
					'node_modules/fixture-unlicensed': undeclaredEntry(
						'fixture-unlicensed',
						'1.0.0',
					),
					'node_modules/fixture-nameless': undeclaredEntry(
						'fixture-nameless',
						'0.3.0',
					),
					'node_modules/@img/sharp-linux-x64': {
						...undeclaredEntry('@img/sharp-linux-x64', '1.0.0'),
						license: 'LGPL-3.0-or-later',
						optional: true,
					},
				},
			},
		)
		const run = runGates('licences', '--config', path)
		expect(run.status).toBe(1)
		expect(run.output).toContain(
			'read by evidence: fixture-unlicensed@1.0.0 as MIT',
		)
		expect(run.output).toContain('tolerated: @img/sharp-linux-x64@1.0.0')
		expect(run.output).toContain(
			'fixture-nameless@0.3.0: license=null (declares no licence)',
		)
	})

	it('holds a row to the lockfiles it names and no others', () => {
		const lockfile = lockfileOf('licences-undeclared-seeded')
		const path = temporaryLockfileFixture(
			{
				licences: {
					lockfiles: ['a/package-lock.json', 'b/package-lock.json'],
					allowlist: ['MIT', 'Apache-2.0'],
					undeclared: [
						{ ...UNLICENSED_ROW, lockfiles: ['a/package-lock.json'] },
					],
				},
			},
			{ 'a/package-lock.json': lockfile, 'b/package-lock.json': lockfile },
			['a/package-lock.json', 'b/package-lock.json'],
		)
		const run = runGates('licences', '--config', path)
		expect(run.status).toBe(1)
		expect(run.output).toContain('licences a/package-lock.json: passed')
		expect(run.output).toContain(
			'licences b/package-lock.json: 1 entrie(s) outside the allowlist',
		)
		expect(run.output).toContain('(declares no licence)')
	})

	it('refuses a row that reaches no undeclared entry, at the usage code', () => {
		const path = temporaryLockfileFixture(
			{
				licences: {
					lockfiles: ['package-lock.json'],
					allowlist: ['MIT', 'Apache-2.0', 'ISC', 'BSD-3-Clause'],
					undeclared: [{ ...UNLICENSED_ROW, lockfiles: ['package-lock.json'] }],
				},
			},
			lockfileOf('compliant'),
		)
		const run = runGates('licences', '--config', path)
		expect(run.status).toBe(EXIT_USAGE)
		expect(run.output).toContain('licences package-lock.json: passed')
		expect(run.output).toContain(
			'reads "fixture-unlicensed" in package-lock.json by evidence, and no entry there under that prefix declares no licence',
		)
	})

	it('exits 1, and prints the stale row, when a violation and a stale row share a run', () => {
		const run = runGates(
			'licences',
			'--config',
			temporaryLockfileFixture(
				{
					licences: {
						lockfiles: ['package-lock.json'],
						allowlist: ['MIT', 'Apache-2.0', 'ISC', 'BSD-3-Clause'],
						undeclared: [
							{ ...UNLICENSED_ROW, lockfiles: ['package-lock.json'] },
						],
					},
				},
				lockfileOf('licences-seeded'),
			),
		)
		expect(run.status).toBe(1)
		expect(run.output).toContain('Apache-2.0 WITH LLVM-exception')
		expect(run.output).toContain(
			'reads "fixture-unlicensed" in package-lock.json by evidence',
		)
	})

	// A row reaches the entry it documents before the resolved-URL check runs, so
	// a tampered entry reports the tampering and never a row reaching nothing.
	it('credits a row for a documented entry that fails the resolved-URL check', () => {
		const run = runGates(
			'licences',
			'--config',
			temporaryLockfileFixture(
				{
					licences: {
						lockfiles: ['package-lock.json'],
						allowlist: ['MIT'],
						undeclared: [
							{ ...UNLICENSED_ROW, lockfiles: ['package-lock.json'] },
						],
					},
				},
				{
					packages: {
						'': { name: 'undeclared-fixture' },
						'node_modules/fixture-unlicensed': {
							version: '1.0.0',
							resolved:
								'https://npm.internal.example.com/fixture-unlicensed/-/fixture-unlicensed-1.0.0.tgz',
						},
					},
				},
			),
		)
		expect(run.status).toBe(1)
		expect(run.output).toContain(
			"is not fixture-unlicensed@1.0.0's registry tarball",
		)
		expect(run.output).not.toContain('by evidence, and no entry there')
	})

	it('refuses two rows reading one prefix in one lockfile', async () => {
		const path = temporaryConfig(
			JSON.stringify({
				licences: {
					lockfiles: ['package-lock.json'],
					allowlist: ['MIT'],
					undeclared: [
						{ ...UNLICENSED_ROW, lockfiles: ['package-lock.json'] },
						{
							...UNLICENSED_ROW,
							lockfiles: ['package-lock.json'],
							readAs: 'ISC',
						},
					],
				},
			}),
		)
		const result = await loadLicencesConfig({ configPath: path })
		expect(result.kind).toBe('refused')
		if (result.kind !== 'refused') return
		expect(result.message).toContain(
			'undeclared.1: reads "fixture-unlicensed" in package-lock.json, which an earlier row already reads',
		)
	})

	it('names every reading it tried when overlapping rows are all refused', () => {
		const report = checkLicenses(lockfileOf('licences-undeclared-seeded'), {
			allowlist: ['MIT'],
			label: 'the allowlist',
			undeclared: [
				{ ...UNLICENSED_ROW, prefix: 'fixture-unl', readAs: 'GPL-3.0-only' },
				{ ...UNLICENSED_ROW, readAs: 'AGPL-3.0-only' },
			],
		})
		expect(report.violations[0]?.reason).toBe(
			'read by evidence as GPL-3.0-only or AGPL-3.0-only, which is outside the allowlist',
		)
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

	/**
	 * The off-registry split has to run before the cache lookup, and this pins
	 * the order rather than trusting it to hold by accident. A cache entry for
	 * the substituted name@version supplies an ancient, wholesome-looking
	 * timestamp; if the cache were consulted first, that timestamp would launder
	 * the entry straight past the check it exists to fail.
	 */
	it('does not let a cached timestamp launder an off-registry entry', async () => {
		const report = await auditLockfileAge({
			lockfile: lockfileOf('substituted-package'),
			now: new Date(),
			windowDays: LOCKFILE_WINDOW_DAYS_DEFAULT,
			cache: { 'fixture-dual@2.0.0': ANCIENT },
			readTimeMap: () => {
				throw new Error(
					'the cache should have answered this; no fetch belongs here',
				)
			},
		})
		expect(report.offRegistryEntries).toHaveLength(1)
		expect(report.offRegistryEntries[0]?.name).toBe('fixture-dual')
		expect(report.youngEntries).toEqual([])
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

	it('names a cache the section points at and the filesystem has not', () => {
		const root = mkdtempSync(join(tmpdir(), 'gate-cache-absent-'))
		cpSync(join(FIXTURES, 'compliant'), root, { recursive: true })
		const path = join(root, DEFAULT_CONFIG_FILE)
		const document = JSON.parse(readFileSync(path, 'utf8')) as {
			'lockfile-age': Record<string, unknown>
		}
		document['lockfile-age'].cache = 'absent-cache.json'
		writeFileSync(path, JSON.stringify(document, null, '\t'), 'utf8')

		const run = runGates('lockfile-age', '--config', path)
		expect(run.status).toBe(EXIT_USAGE)
		expect(run.output).toContain('absent-cache.json')
		expect(run.output).toContain('does not exist')
		expect(run.output).toContain('names it under cache')
	})

	it('exempts an excluded name from the window and from the fetch', async () => {
		const now = new Date()
		const fetched: string[] = []
		const report = await auditLockfileAge({
			lockfile: lockfileOf('lockfile-age-excluded'),
			now,
			windowDays: LOCKFILE_WINDOW_DAYS_DEFAULT,
			exclude: ['fixture-pinned'],
			readTimeMap: async (name: string) => {
				fetched.push(name)
				return { '4.2.0': now.toISOString() }
			},
		})
		expect(fetched).toEqual([])
		expect(report.entries).toHaveLength(1)
		expect(report.youngEntries).toEqual([])
		expect(report.excludedEntries.map((entry) => entry.name)).toEqual([
			'fixture-pinned',
		])
	})

	it('prints the exclusion and the scanned count through the binary', () => {
		const run = runGates(
			'lockfile-age',
			'--config',
			configOf('lockfile-age-excluded'),
		)
		expect(run.status).toBe(0)
		expect(run.output).toContain(
			'lockfile-age package-lock.json: passed, 1 entrie(s), 0 published before',
		)
		expect(run.output).toContain('and 1 excluded by name.')
		expect(run.output).toContain(
			'excluded: fixture-pinned@4.2.0 (node_modules/fixture-pinned)',
		)
		expect(run.output).toContain(
			'because: pinned exactly and adopted on release day',
		)
	})

	it('excludes a scoped name end to end, and refuses one no entry carries', () => {
		const lockfile = {
			packages: {
				'': { name: 'exclusion-fixture' },
				'node_modules/@fixture-scope/pinned': undeclaredEntry(
					'@fixture-scope/pinned',
					'4.2.0',
				),
			},
		}
		const passing = runGates(
			'lockfile-age',
			'--config',
			temporaryLockfileFixture(
				{
					'lockfile-age': {
						lockfiles: ['package-lock.json'],
						exclude: [exclusionOf('@fixture-scope/pinned')],
					},
				},
				lockfile,
			),
		)
		expect(passing.status).toBe(0)
		expect(passing.output).toContain(
			'excluded: @fixture-scope/pinned@4.2.0 (node_modules/@fixture-scope/pinned)',
		)

		const stale = runGates(
			'lockfile-age',
			'--config',
			temporaryLockfileFixture(
				{
					'lockfile-age': {
						lockfiles: ['package-lock.json'],
						exclude: [
							exclusionOf('@fixture-scope/pinned'),
							exclusionOf('fixture-pined'),
						],
					},
				},
				lockfile,
			),
		)
		expect(stale.status).toBe(EXIT_USAGE)
		expect(stale.output).toContain('excluded: @fixture-scope/pinned@4.2.0')
		expect(stale.output).toContain(
			'excludes "fixture-pined" in package-lock.json, and no entry there carries that name',
		)
	})

	it('still fails an unexcluded young entry beside an excluded one', async () => {
		const now = new Date()
		const report = await auditLockfileAge({
			lockfile: {
				packages: {
					'': { name: 'exclusion-fixture' },
					'node_modules/fixture-pinned': {
						version: '4.2.0',
						resolved: `${REGISTRY}/fixture-pinned/-/fixture-pinned-4.2.0.tgz`,
					},
					'node_modules/fixture-fresh': {
						version: '0.1.0',
						resolved: `${REGISTRY}/fixture-fresh/-/fixture-fresh-0.1.0.tgz`,
					},
				},
			},
			now,
			windowDays: LOCKFILE_WINDOW_DAYS_DEFAULT,
			exclude: ['fixture-pinned'],
			readTimeMap: async () => ({
				'0.1.0': now.toISOString(),
				'4.2.0': now.toISOString(),
			}),
		})
		expect(report.entries).toHaveLength(2)
		expect(report.youngEntries.map((entry) => entry.name)).toEqual([
			'fixture-fresh',
		])
		expect(report.excludedEntries.map((entry) => entry.name)).toEqual([
			'fixture-pinned',
		])
	})

	it('prints the exclusion on a failing run too', () => {
		const path = temporaryLockfileFixture(
			{
				'lockfile-age': {
					lockfiles: ['package-lock.json'],
					exclude: [exclusionOf('fixture-pinned')],
				},
			},
			{
				packages: {
					'': { name: 'exclusion-fixture' },
					'node_modules/fixture-pinned': {
						version: '4.2.0',
						resolved: `${REGISTRY}/fixture-pinned/-/fixture-pinned-4.2.0.tgz`,
					},
					'node_modules/fixture-mirror': {
						version: '1.4.2',
						resolved:
							'https://npm.internal.example.com/fixture-mirror/-/fixture-mirror-1.4.2.tgz',
					},
				},
			},
		)
		const run = runGates('lockfile-age', '--config', path)
		expect(run.status).toBe(1)
		expect(run.output).toContain(
			'lockfile-age package-lock.json: 2 entrie(s), 1 excluded by name.',
		)
		expect(run.output).toContain(
			'excluded: fixture-pinned@4.2.0 (node_modules/fixture-pinned)',
		)
		expect(run.output).toContain('fixture-mirror@1.4.2')
		expect(run.output).toContain('do not resolve to the npm registry')
	})

	// The exclusion never reached the resolved-URL check, so the entry is printed
	// as excluded and fails anyway: both halves of what the run did.
	it('fails closed on an excluded name resolved off the registry, and still prints it', () => {
		const run = runGates(
			'lockfile-age',
			'--config',
			configOf('lockfile-age-excluded-seeded'),
		)
		expect(run.status).toBe(1)
		expect(run.output).toContain('do not resolve to the npm registry')
		expect(run.output).toContain(
			'excluded: fixture-pinned@4.2.0 (node_modules/fixture-pinned)',
		)
		expect(run.output).toContain('fixture-pinned@4.2.0 resolved=')
	})

	// The peer pass's shared blind spot: every stale-row case above pairs the
	// row with a clean lockfile. A run that found a violation exits 1 and prints
	// the stale row as a diagnostic; the usage code is for the run that would
	// otherwise have passed.
	it('exits 1, and prints the stale row, when a violation and a stale row share a run', () => {
		const run = runGates(
			'lockfile-age',
			'--config',
			temporaryLockfileFixture(
				{
					'lockfile-age': {
						lockfiles: ['package-lock.json'],
						exclude: [exclusionOf('fixture-pined')],
					},
				},
				lockfileOf('lockfile-age-seeded'),
			),
		)
		expect(run.status).toBe(1)
		expect(run.output).toContain('do not resolve to the npm registry')
		expect(run.output).toContain(
			'excludes "fixture-pined" in package-lock.json',
		)
	})

	it('holds a row to each lockfile it names, and refuses the scope it reaches nothing in', () => {
		const pinned = {
			packages: {
				'': { name: 'exclusion-fixture' },
				'node_modules/fixture-pinned': undeclaredEntry(
					'fixture-pinned',
					'4.2.0',
				),
			},
		}
		const run = runGates(
			'lockfile-age',
			'--config',
			temporaryLockfileFixture(
				{
					'lockfile-age': {
						lockfiles: ['a/package-lock.json', 'b/package-lock.json'],
						exclude: [
							exclusionOf('fixture-pinned', [
								'a/package-lock.json',
								'b/package-lock.json',
							]),
						],
					},
				},
				{
					'a/package-lock.json': pinned,
					'b/package-lock.json': {
						packages: { '': { name: 'empty-fixture' } },
					},
				},
				['a/package-lock.json', 'b/package-lock.json'],
			),
		)
		expect(run.status).toBe(EXIT_USAGE)
		expect(run.output).toContain('excluded: fixture-pinned@4.2.0')
		expect(run.output).toContain(
			'excludes "fixture-pinned" in b/package-lock.json',
		)
		expect(run.output).not.toContain('in a/package-lock.json')
	})

	it('refuses two rows excluding one name in one lockfile', async () => {
		const path = temporaryConfig(
			JSON.stringify({
				'lockfile-age': {
					lockfiles: ['package-lock.json'],
					exclude: [
						exclusionOf('fixture-pinned'),
						exclusionOf('fixture-pinned'),
					],
				},
			}),
		)
		const result = await loadLockfileAgeConfig({ configPath: path })
		expect(result.kind).toBe('refused')
		if (result.kind !== 'refused') return
		expect(result.message).toContain(
			'exclude.1: excludes "fixture-pinned" in package-lock.json, which an earlier row already excludes',
		)
	})

	// Name-based, as npm's own setting is: every entry under the name is exempt,
	// a nested duplicate at another version included, and each one is printed.
	it('exempts every entry under an excluded name, nested duplicates included', async () => {
		const report = await auditLockfileAge({
			lockfile: {
				packages: {
					'': { name: 'exclusion-fixture' },
					'node_modules/fixture-pinned': undeclaredEntry(
						'fixture-pinned',
						'4.2.0',
					),
					'node_modules/holder/node_modules/fixture-pinned': undeclaredEntry(
						'fixture-pinned',
						'1.0.0',
					),
				},
			},
			now: new Date(),
			windowDays: LOCKFILE_WINDOW_DAYS_DEFAULT,
			exclude: ['fixture-pinned'],
			readTimeMap: async () => {
				throw new Error('no fetch expected')
			},
		})
		expect(report.excludedEntries.map((e) => e.version).sort()).toEqual([
			'1.0.0',
			'4.2.0',
		])
		expect(report.unfetchableEntries).toEqual([])
	})
})

describe('the dependency-direction gate', () => {
	it('passes on the compliant fixture', () => {
		const run = runGates(
			'dependency-direction',
			'--config',
			configOf('direction-compliant'),
		)
		expect(run.status).toBe(0)
		expect(run.output).toContain('dependency-direction: passed')
		expect(run.output).toContain('0 violations')
	})

	it('fails on the seeded fixture, naming the edge and the rule', () => {
		const run = runGates(
			'dependency-direction',
			'--config',
			configOf('direction-seeded'),
		)
		expect(run.status).toBe(1)
		expect(run.output).toContain('1 violation(s) across 4 scanned file(s)')
		expect(run.output).toContain('lib/model/normalise.ts')
		expect(run.output).toContain('model/ may not depend on service/')
	})

	/**
	 * The criterion the story calls out. Report-only exists so a repository can
	 * learn the size of the fix before committing to it, and a report-only run
	 * that exits 0 with no number in its output would hand a consumer a green
	 * build and nothing to read, which is the vacuous pass in the one mode whose
	 * whole purpose is the count.
	 *
	 * The fixture is copied out and its one flag flipped, rather than a second
	 * configuration being committed beside it: every path a section names is
	 * relative to the configuration file, so a configuration in a temporary
	 * directory has to bring the tree with it. AD-30 keeps the writes there.
	 */
	it('prints a non-zero count and still exits zero under report-only', () => {
		const root = mkdtempSync(join(tmpdir(), 'gate-report-only-'))
		cpSync(join(FIXTURES, 'direction-seeded'), root, { recursive: true })
		const path = join(root, DEFAULT_CONFIG_FILE)
		const document = JSON.parse(readFileSync(path, 'utf8')) as {
			'dependency-direction': Record<string, unknown>
		}
		document['dependency-direction'].reportOnly = true
		writeFileSync(path, JSON.stringify(document, null, '\t'), 'utf8')

		const run = runGates('dependency-direction', '--config', path)
		expect(run.status).toBe(0)
		expect(run.output).toContain('report-only')
		expect(run.output).toContain('1 violation(s) across 4 scanned file(s)')
		expect(run.output).toContain('this run did not fail')
		// The violation itself, not only the count: a report nobody can act on is
		// the same dead end as a report with no number in it.
		expect(run.output).toContain('lib/model/normalise.ts')
	})
})

describe('the package-boundary gate', () => {
	it('passes on the compliant fixture', () => {
		const run = runGates(
			'package-boundary',
			'--config',
			configOf('boundary-compliant'),
		)
		expect(run.status).toBe(0)
		expect(run.output).toContain('package-boundary: 6 entr(ies) scanned')
		expect(run.output).toContain('0 violations')
	})

	it('fails on the seeded fixture, over source and over the manifest', () => {
		const run = runGates(
			'package-boundary',
			'--config',
			configOf('boundary-seeded'),
		)
		expect(run.status).toBe(1)
		expect(run.output).toContain('4 violation(s) across 6 scanned entr(ies)')
		expect(run.output).toContain('src/reduce.ts:1 [build-machine-path]')
		expect(run.output).toContain('src/index.ts:1 [unpublished-path]')
		// A manifest field has no line of its own, so it reports at line 1 under
		// the synthetic key. This is the half a source-only scan never reaches.
		expect(run.output).toContain(
			'manifest.json#description:1 [internal-tracker]',
		)
		expect(run.output).toContain(
			'manifest.json#scripts.regenerate:1 [unpublished-path]',
		)
	})
})

describe('the field-ownership gate', () => {
	it('passes on the compliant fixture', () => {
		const run = runGates(
			'field-ownership',
			'--config',
			configOf('lineage-compliant'),
		)
		expect(run.status).toBe(0)
		expect(run.output).toContain('field-ownership: 4 file(s) scanned')
		expect(run.output).toContain('0 violations')
	})

	it('fails on the seeded fixture, naming the helper and not the field', () => {
		const run = runGates(
			'field-ownership',
			'--config',
			configOf('lineage-seeded'),
		)
		expect(run.status).toBe(1)
		expect(run.output).toContain('2 violation(s) across 6 scanned file(s)')
		expect(run.output).toContain('src/pipeline/publish.ts:1 bumpOwner')
		expect(run.output).toContain('the same write one line further out')
	})
})

describe('the doc-invocations gate', () => {
	it('passes on the compliant fixture', () => {
		const run = runGates(
			'doc-invocations',
			'--config',
			configOf('doc-invocations-compliant'),
		)
		expect(run.status).toBe(0)
		expect(run.output).toContain('2 invocation(s) scanned across 1 page(s)')
		expect(run.output).toContain('0 failure(s)')
	})

	/**
	 * The seed is worded from outside the gate's trigger vocabulary. The gate
	 * exists to catch a documented flag that stopped existing, which shows up as
	 * a usage exit; this page's command and flags all exist and the run exits
	 * exactly the code the page declares. What drifted is one word of the
	 * transcribed diagnostic beside it, which the exit code cannot see.
	 */
	it('fails on a transcript that drifted while the exit code agreed', () => {
		const run = runGates(
			'doc-invocations',
			'--config',
			configOf('doc-invocations-seeded'),
		)
		expect(run.status).toBe(1)
		expect(run.output).toContain('1 failure(s)')
		expect(run.output).toContain('tool: run `tool verify` first')
		expect(run.output).toContain('as line 2 of the output')
	})

	it('refuses a built entry that is absent rather than passing over nothing', () => {
		const root = mkdtempSync(join(tmpdir(), 'gate-doc-entry-'))
		cpSync(join(FIXTURES, 'doc-invocations-compliant'), root, {
			recursive: true,
		})
		rmSync(join(root, 'bin/tool.mjs'))

		const run = runGates(
			'doc-invocations',
			'--config',
			join(root, DEFAULT_CONFIG_FILE),
		)
		expect(run.status).toBe(EXIT_USAGE)
		expect(run.output).toContain('bin/tool.mjs')
		expect(run.output).toContain('build it before the gate runs')
	})

	it('refuses a pages root that is the configuration directory itself', () => {
		const root = mkdtempSync(join(tmpdir(), 'gate-doc-root-'))
		cpSync(join(FIXTURES, 'doc-invocations-compliant'), root, {
			recursive: true,
		})
		const path = join(root, DEFAULT_CONFIG_FILE)
		const document = JSON.parse(readFileSync(path, 'utf8')) as {
			'doc-invocations': Record<string, unknown>
		}
		document['doc-invocations'].pages = ['.']
		writeFileSync(path, JSON.stringify(document, null, '\t'), 'utf8')

		const run = runGates('doc-invocations', '--config', path)
		expect(run.status).toBe(EXIT_USAGE)
		expect(run.output).toContain('the directory the configuration sits in')
	})
})

describe('the doc-counts gate', () => {
	it('passes on the compliant fixture', () => {
		const run = runGates(
			'doc-counts',
			'--config',
			configOf('doc-counts-compliant'),
		)
		expect(run.status).toBe(0)
		expect(run.output).toContain('0 disagreement(s)')
	})

	/**
	 * The seed is worded from outside the gate's trigger vocabulary. The gate
	 * exists to catch a numeral that disagrees with what it counts, and this
	 * page's numeral is right. What went wrong is that the sentence was
	 * duplicated, so the entry names two sentences and no longer holds either
	 * one: the next edit to the second copy would go unheld.
	 */
	it('fails on a sentence its entry now matches twice', () => {
		const run = runGates(
			'doc-counts',
			'--config',
			configOf('doc-counts-seeded'),
		)
		expect(run.status).toBe(1)
		expect(run.output).toContain('2 sentences match the pattern')
		expect(run.output).toContain('(lines 3, 8)')
	})

	it('refuses a source no entry reads', () => {
		const run = runGates(
			'doc-counts',
			'--config',
			temporaryConfig(
				JSON.stringify({
					'doc-counts': {
						sources: {
							used: {
								kind: 'files',
								paths: [{ path: 'nowhere', optional: true }],
							},
							spare: {
								kind: 'files',
								paths: [{ path: 'nowhere', optional: true }],
							},
						},
						entries: [
							{
								file: 'page.md',
								claim: 'a count',
								pattern: { match: 'ships ([a-z-]+) rules' },
								counts: ['used'],
							},
						],
					},
				}),
			),
		)
		expect(run.status).toBe(EXIT_USAGE)
		expect(run.output).toContain('a source nothing reads')
	})

	it('refuses an entry whose pattern carries the wrong number of groups', () => {
		const run = runGates(
			'doc-counts',
			'--config',
			temporaryConfig(
				JSON.stringify({
					'doc-counts': {
						sources: {
							rules: {
								kind: 'files',
								paths: [{ path: 'nowhere', optional: true }],
							},
						},
						entries: [
							{
								file: 'page.md',
								claim: 'a count',
								pattern: { match: 'ships some rules' },
								counts: ['rules'],
							},
						],
					},
				}),
			),
		)
		expect(run.status).toBe(EXIT_USAGE)
		expect(run.output).toContain('has 0 capture group(s)')
	})

	/**
	 * `DOC_COUNT_SOURCE`, the one coded exit `check-doc-counts.ts` raises at run
	 * time rather than at load: a `json` source whose path walks off the
	 * document it named. The Zod refinements catch every load-time shape; this
	 * is the one refusal that can only happen once the file is actually read.
	 */
	it('refuses a json source whose path is absent from the document', () => {
		const root = mkdtempSync(join(tmpdir(), 'gate-doc-count-json-'))
		writeFileSync(join(root, 'manifest.json'), JSON.stringify({ bin: {} }))
		writeFileSync(join(root, 'page.md'), 'ships zero binaries')
		writeFileSync(
			join(root, DEFAULT_CONFIG_FILE),
			JSON.stringify({
				'doc-counts': {
					sources: {
						count: {
							kind: 'json',
							file: 'manifest.json',
							path: ['bin', 'missing'],
							take: 'keys',
						},
					},
					entries: [
						{
							file: 'page.md',
							claim: 'a count',
							pattern: { match: 'ships ([a-z]+) binaries' },
							counts: ['count'],
						},
					],
				},
			}),
			'utf8',
		)

		const run = runGates(
			'doc-counts',
			'--config',
			join(root, DEFAULT_CONFIG_FILE),
		)
		expect(run.status).toBe(EXIT_USAGE)
		expect(run.output).toContain('"missing" is absent')
	})
})

describe('the doc-claims gate', () => {
	it('passes on the compliant fixture', () => {
		const run = runGates(
			'doc-claims',
			'--config',
			configOf('doc-claims-compliant'),
		)
		expect(run.status).toBe(0)
		expect(run.output).toContain('1 backticked identifiers are declared')
	})

	/**
	 * The seed is worded from outside the gate's trigger vocabulary. A renamed
	 * symbol commonly survives in a comment, and the page names exactly such a
	 * name: a check reading mentions finds it and passes. This gate reads
	 * declarations, which is the stronger of the two and the reason the seed
	 * fails.
	 */
	it('fails on a name the source mentions and no longer declares', () => {
		const run = runGates(
			'doc-claims',
			'--config',
			configOf('doc-claims-seeded'),
		)
		expect(run.status).toBe(1)
		expect(run.output).toContain('`readReport`')
		expect(run.output).toContain('nothing in the source roots declares')
	})

	it('refuses a section that declares no class of claim', () => {
		const run = runGates(
			'doc-claims',
			'--config',
			temporaryConfig(
				JSON.stringify({
					'doc-claims': {
						pages: ['docs'],
						sources: [{ path: 'src', extensions: ['.ts'] }],
					},
				}),
			),
		)
		expect(run.status).toBe(EXIT_USAGE)
		expect(run.output).toContain('declares no class of claim')
	})

	/**
	 * The page walk, held to the same rule the invocation gate's is. Both gates
	 * promise the same thing about which pages a root reaches, and the two walks
	 * were written in one change.
	 */
	it('refuses a pages root that encloses the configuration, symlinked or not', () => {
		const root = mkdtempSync(join(tmpdir(), 'gate-claims-root-'))
		cpSync(join(FIXTURES, 'doc-claims-compliant'), root, { recursive: true })
		symlinkSync(root, join(root, 'self'))
		const path = join(root, DEFAULT_CONFIG_FILE)
		const document = JSON.parse(readFileSync(path, 'utf8')) as {
			'doc-claims': Record<string, unknown>
		}
		document['doc-claims'].pages = ['self']
		writeFileSync(path, JSON.stringify(document, null, '\t'), 'utf8')

		const run = runGates('doc-claims', '--config', path)
		expect(run.status).toBe(EXIT_USAGE)
		expect(run.output).toContain('encloses the directory the configuration')
	})

	it('reads no page out of an installed tree under a page root', () => {
		const root = mkdtempSync(join(tmpdir(), 'gate-claims-skip-'))
		cpSync(join(FIXTURES, 'doc-claims-compliant'), root, { recursive: true })
		mkdirSync(join(root, 'docs/node_modules/dep'), { recursive: true })
		writeFileSync(
			join(root, 'docs/node_modules/dep/README.md'),
			'# Dep\n\nCall `someDependencyThing` on it.\n',
			'utf8',
		)

		// A dependency's own prose names symbols this tree never declares, so a
		// walk that read it would fail the gate on somebody else's page.
		const run = runGates(
			'doc-claims',
			'--config',
			join(root, DEFAULT_CONFIG_FILE),
		)
		expect(run.status).toBe(0)
		expect(run.output).not.toContain('someDependencyThing')
	})

	it('refuses one page root that reaches nothing among several that do', () => {
		const root = mkdtempSync(join(tmpdir(), 'gate-claims-empty-'))
		cpSync(join(FIXTURES, 'doc-claims-compliant'), root, { recursive: true })
		mkdirSync(join(root, 'guides'))
		const path = join(root, DEFAULT_CONFIG_FILE)
		const document = JSON.parse(readFileSync(path, 'utf8')) as {
			'doc-claims': Record<string, unknown>
		}
		document['doc-claims'].pages = ['docs', 'guides']
		writeFileSync(path, JSON.stringify(document, null, '\t'), 'utf8')

		const run = runGates('doc-claims', '--config', path)
		expect(run.status).toBe(EXIT_USAGE)
		expect(run.output).toContain('"guides" holds no markdown')
	})

	/**
	 * The class the gate's own header exists for. Its pattern and its token sets
	 * now live in a configuration file, so a typo switches the class off, and the
	 * summary would report a clean pass over zero classified sentences.
	 */
	it('refuses a vocabulary that classified nothing', () => {
		const root = mkdtempSync(join(tmpdir(), 'gate-claims-vocab-'))
		cpSync(join(FIXTURES, 'doc-claims-compliant'), root, { recursive: true })
		writeFileSync(
			join(root, 'docs/guide.md'),
			'# Guide\n\nCall `parseReport` on the text you read.\n',
			'utf8',
		)

		const run = runGates(
			'doc-claims',
			'--config',
			join(root, DEFAULT_CONFIG_FILE),
		)
		expect(run.status).toBe(EXIT_USAGE)
		expect(run.output).toContain('classified no mention at all')
	})

	it('holds a vocabulary sentence against the two sets', () => {
		const root = mkdtempSync(join(tmpdir(), 'gate-claims-governed-'))
		cpSync(join(FIXTURES, 'doc-claims-compliant'), root, { recursive: true })
		writeFileSync(
			join(root, 'docs/guide.md'),
			'# Guide\n\nCall `parseReport` on the text you read.\n\n' +
				'The reader accepts `json` and `toml`, and rejects `yaml`.\n',
			'utf8',
		)

		const run = runGates(
			'doc-claims',
			'--config',
			join(root, DEFAULT_CONFIG_FILE),
		)
		expect(run.status).toBe(1)
		expect(run.output).toContain('"accepts" governing `toml`')
		expect(run.output).toContain('"rejects" governing `yaml`')
	})

	it('refuses a source naming an export the module does not have', () => {
		const root = mkdtempSync(join(tmpdir(), 'gate-doc-export-'))
		cpSync(join(FIXTURES, 'doc-claims-compliant'), root, { recursive: true })
		const path = join(root, DEFAULT_CONFIG_FILE)
		const document = JSON.parse(readFileSync(path, 'utf8')) as {
			'doc-claims': Record<string, unknown>
		}
		document['doc-claims'].transcriptions = [
			{
				file: 'docs/guide.md',
				claim: 'a transcription',
				text: { module: 'src/lib.ts', export: 'RENDERED' },
			},
		]
		writeFileSync(path, JSON.stringify(document, null, '\t'), 'utf8')

		const run = runGates('doc-claims', '--config', path)
		expect(run.status).toBe(EXIT_USAGE)
		expect(run.output).toContain('src/lib.ts exports no "RENDERED"')
		expect(run.output).toContain('it exports ACCEPTED_KINDS')
		expect(run.output).toContain('parseReport')
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
			'dist/gates/check-dependency-direction.js',
			// Reached only through a dynamic import, after `typescript` has been
			// probed, so nothing in the binary's static load graph names it.
			'dist/gates/dependency-direction.js',
			'dist/gates/discover-source-files.js',
			'dist/gates/token-scan.js',
			'dist/gates/package-boundary.js',
			'dist/gates/lineage-ownership.js',
			'dist/gates/consumer-pattern.js',
			'dist/gates/module-value.js',
			'dist/gates/check-doc-invocations.mjs',
			'dist/gates/check-doc-counts.js',
			'dist/gates/check-doc-claims.js',
		]) {
			expect(existsSync(resolve(emitted)), `${emitted} was not emitted`).toBe(
				true,
			)
		}
	})

	/**
	 * A documentation gate from the published path reaches further than the
	 * licence one: it imports modules the configuration names, which is the
	 * mechanism a consumer's own derived counts arrive through. A compiled binary
	 * that could not import a `.ts` module out of the consumer's tree would fail
	 * only there, and this repository would never see it.
	 */
	it('imports a configured module from the published path', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const result = spawnSync(
			process.execPath,
			[resolve('dist/gates/gates-cli.js'), 'doc-counts'],
			{ encoding: 'utf8' },
		)
		expect(`${result.stdout}${result.stderr}`).toContain(
			'held against their source',
		)
		expect(result.status).toBe(0)
	})

	/**
	 * `check:doc-invocations`, `check:doc-counts` and `check:doc-claims` all run
	 * `scripts/gates-cli.ts` locally, the same as every gate but `lockfile-age`;
	 * the built binary is what a consumer runs. The case above covers
	 * `doc-counts`; these two cover the other pair, so a compile-only defect in
	 * either can't ship holding only the source path green.
	 */
	// This one gate spawns a child process per documented invocation, 32 of them
	// against this repository's own pages, so the default per-test timeout is
	// too tight on a loaded runner: vitest's own budget, not this gate's.
	it('runs the doc-invocations gate from the published path', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const result = spawnSync(
			process.execPath,
			[resolve('dist/gates/gates-cli.js'), 'doc-invocations'],
			{ encoding: 'utf8' },
		)
		expect(`${result.stdout}${result.stderr}`).toContain(
			'invocation(s) scanned',
		)
		expect(result.status).toBe(0)
	}, 60_000)

	it('runs the doc-claims gate from the published path', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const result = spawnSync(
			process.execPath,
			[resolve('dist/gates/gates-cli.js'), 'doc-claims'],
			{ encoding: 'utf8' },
		)
		expect(`${result.stdout}${result.stderr}`).toContain('citations resolve')
		expect(result.status).toBe(0)
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
