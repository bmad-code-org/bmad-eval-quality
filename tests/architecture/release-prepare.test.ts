/**
 * `scripts/release-prepare.mjs` cuts the release commit, on `release/vX.Y.Z` from a laptop or on
 * `main` from publish.yml (`--on-main`). Black-box through the CLI, like stamp-changelog: a `.mjs`
 * import from a `.ts` test has no declaration under `strict`, and the process boundary (arguments,
 * exit code, what git and the tree look like afterwards) is what both callers depend on.
 *
 * Each case gets its own git fixture: a bare `origin.git` and a clone on `main` with the four
 * files the script stamps. npm is pointed at an in-process registry that knows `0.1.0` and
 * `0.2.0` of the package, so `patch` from `0.1.0` is publishable and `minor` collides. The run
 * helper is async because that server answers from this process; a blocking spawn would deadlock
 * `npm view` against it.
 */

import { execFileSync, spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const SCRIPT = resolve('scripts/release-prepare.mjs')
const DATE = '2026-09-04'
const PACKAGE = 'eval-quality'
const CURRENT = '0.1.0'
const PUBLISHED = ['0.1.0', '0.2.0']

const CHANGELOG = [
	'# Changelog',
	'',
	'## [Unreleased]',
	'',
	'### Fixed',
	'',
	'- a fix that has not shipped yet',
	'',
	`## [${CURRENT}] - 2026-08-01`,
	'',
	'- an older entry',
	'',
].join('\n')

let registry: Server
let registryUrl: string

/** A packument for `eval-quality` with `PUBLISHED` versions; 404 for everything else. */
beforeAll(async () => {
	registry = createServer((request, response) => {
		response.setHeader('content-type', 'application/json')
		if (request.url === `/${PACKAGE}`) {
			const versions = Object.fromEntries(
				PUBLISHED.map((v) => [v, { name: PACKAGE, version: v }]),
			)
			response.end(
				JSON.stringify({
					name: PACKAGE,
					'dist-tags': { latest: PUBLISHED.at(-1) },
					versions,
				}),
			)
			return
		}
		response.statusCode = 404
		response.end(JSON.stringify({ error: 'Not found' }))
	})
	await new Promise<void>((done) => registry.listen(0, '127.0.0.1', done))
	registryUrl = `http://127.0.0.1:${(registry.address() as AddressInfo).port}/`
})

afterAll(async () => {
	await new Promise<void>((done) => registry.close(() => done()))
})

interface Fixture {
	dir: string
	work: string
	origin: string
	env: NodeJS.ProcessEnv
}

const git = (cwd: string, env: NodeJS.ProcessEnv, ...args: string[]) =>
	execFileSync('git', args, { cwd, env, encoding: 'utf8' }).trim()

/**
 * `npm_config_*` is npm's own config, exported into every child process npm launches; `npm run
 * --silent` sets `npm_config_loglevel=silent` this way, which reaches this fixture through
 * `process.env` when the suite runs under `npm run --silent test:coverage` (the coverage-canary
 * jobs do exactly that) and silences the `npm view` stderr `npmHasVersion` parses for E404. Start
 * from `process.env` with every `npm_config_*` key dropped, so the fixture's npm behavior depends
 * only on what this file sets.
 */
const AMBIENT_ENV = Object.fromEntries(
	Object.entries(process.env).filter(([key]) => !key.startsWith('npm_config_')),
)

/**
 * A bare origin and a clone on `main`, one commit in, both pushed. Git reads no user or system
 * config, so a signing key or hooks path on the machine running the suite cannot leak in.
 */
function fixture(): Fixture {
	const dir = mkdtempSync(join(tmpdir(), 'release-prepare-'))
	const origin = join(dir, 'origin.git')
	const work = join(dir, 'work')
	const gitconfig = join(dir, 'gitconfig')
	writeFileSync(gitconfig, '')
	const env: NodeJS.ProcessEnv = {
		...AMBIENT_ENV,
		GIT_CONFIG_GLOBAL: gitconfig,
		GIT_CONFIG_NOSYSTEM: '1',
		CHANGELOG_DATE: DATE,
		npm_config_registry: registryUrl,
		npm_config_fetch_retries: '0',
		npm_config_cache: join(dir, 'npm-cache'),
		npm_config_loglevel: 'notice',
	}

	git(dir, env, 'init', '--quiet', '--bare', '--initial-branch=main', origin)
	git(dir, env, 'init', '--quiet', '--initial-branch=main', work)
	git(work, env, 'config', 'user.name', 'release-prepare test')
	git(work, env, 'config', 'user.email', 'release-prepare@example.invalid')
	git(work, env, 'remote', 'add', 'origin', origin)

	mkdirSync(join(work, 'src'))
	const manifest = { name: PACKAGE, version: CURRENT }
	writeFileSync(
		join(work, 'package.json'),
		`${JSON.stringify(manifest, null, 2)}\n`,
	)
	writeFileSync(
		join(work, 'package-lock.json'),
		`${JSON.stringify(
			{
				...manifest,
				lockfileVersion: 3,
				requires: true,
				packages: { '': manifest },
			},
			null,
			2,
		)}\n`,
	)
	writeFileSync(
		join(work, 'src/index.ts'),
		`export const VERSION = '${CURRENT}'\n`,
	)
	writeFileSync(join(work, 'CHANGELOG.md'), CHANGELOG)
	git(work, env, 'add', '.')
	git(work, env, 'commit', '--quiet', '-m', 'init')
	git(work, env, 'push', '--quiet', '--set-upstream', 'origin', 'main')
	return { dir, work, origin, env }
}

interface Outcome {
	status: number | null
	stdout: string
	stderr: string
}

/** Runs the script in `cwd` under `env` and waits for it to exit. */
const spawnScript = (cwd: string, env: NodeJS.ProcessEnv, args: string[]) =>
	new Promise<Outcome>((done) => {
		const child = spawn(process.execPath, [SCRIPT, ...args], { cwd, env })
		let stdout = ''
		let stderr = ''
		child.stdout.on('data', (chunk: Buffer) => {
			stdout += chunk.toString()
		})
		child.stderr.on('data', (chunk: Buffer) => {
			stderr += chunk.toString()
		})
		child.on('close', (status) => done({ status, stdout, stderr }))
	})

/** Runs the script in the fixture's clone, under the fixture's env, and waits for it to exit. */
const run = (fx: Fixture, ...args: string[]) =>
	spawnScript(fx.work, fx.env, args)

/** What the fixture looks like after a run: both refs on origin, the clone's tree. */
function inspect(fx: Fixture) {
	const originMain = git(fx.origin, fx.env, 'rev-parse', 'main')
	const releaseBranch = (() => {
		try {
			return git(
				fx.origin,
				fx.env,
				'rev-parse',
				'--verify',
				'--quiet',
				'refs/heads/release/v0.1.1',
			)
		} catch {
			return null
		}
	})()
	const head = git(fx.work, fx.env, 'rev-parse', 'HEAD')
	const branch = git(fx.work, fx.env, 'rev-parse', '--abbrev-ref', 'HEAD')
	const subject = git(fx.work, fx.env, 'log', '-1', '--format=%s')
	const committed = git(
		fx.work,
		fx.env,
		'show',
		'--name-only',
		'--format=',
		'HEAD',
	)
		.split('\n')
		.filter(Boolean)
		.sort()
	const status = git(fx.work, fx.env, 'status', '--porcelain')
	const read = (file: string) => readFileSync(join(fx.work, file), 'utf8')
	return {
		originMain,
		releaseBranch,
		head,
		branch,
		subject,
		committed,
		status,
		version: (JSON.parse(read('package.json')) as { version: string }).version,
		lockVersion: (JSON.parse(read('package-lock.json')) as { version: string })
			.version,
		barrel: read('src/index.ts'),
		changelog: read('CHANGELOG.md'),
	}
}

const STAMPED_FILES = [
	'CHANGELOG.md',
	'package-lock.json',
	'package.json',
	'src/index.ts',
]

describe('release-prepare --on-main', () => {
	it('bumps, stamps, commits on main with [skip ci], and pushes main to origin', async () => {
		const fx = fixture()
		const before = inspect(fx)
		// git writes its own routine progress (branch switch, push summary) to stderr on success;
		// the git-state assertions below are what actually prove the run succeeded.
		const { status, stdout } = await run(fx, 'patch', '--on-main')
		expect(status).toBe(0)
		expect(stdout).toContain('0.1.0 -> 0.1.1 on main')

		const after = inspect(fx)
		expect(after.branch).toBe('main')
		expect(after.subject).toBe('chore: release v0.1.1 [skip ci]')
		expect(after.committed).toEqual(STAMPED_FILES)
		expect(after.status).toBe('')
		expect(after.originMain).toBe(after.head)
		expect(after.originMain).not.toBe(before.originMain)
		expect(after.releaseBranch).toBeNull()
		expect(stdout).toContain(`v0.1.1 is on main at ${after.head}`)
	})

	it('stamps the manifest, the lockfile, the barrel VERSION, and the changelog together', async () => {
		const fx = fixture()
		await run(fx, 'patch', '--on-main')
		const after = inspect(fx)
		expect(after.version).toBe('0.1.1')
		expect(after.lockVersion).toBe('0.1.1')
		expect(after.barrel).toBe("export const VERSION = '0.1.1'\n")
		expect(after.changelog).toMatch(
			/## \[Unreleased\]\n\n## \[0\.1\.1\] - 2026-09-04\n\n### Fixed\n\n- a fix that has not shipped yet/,
		)
	})

	it('cuts a minor or major the same way', async () => {
		const fx = fixture()
		const { status } = await run(fx, 'major', '--on-main')
		expect(status).toBe(0)
		const after = inspect(fx)
		expect(after.version).toBe('1.0.0')
		expect(after.subject).toBe('chore: release v1.0.0 [skip ci]')
		expect(after.originMain).toBe(after.head)
	})

	it('rejects --no-pr alongside --on-main', async () => {
		const fx = fixture()
		const { status, stderr } = await run(fx, 'patch', '--on-main', '--no-pr')
		expect(status).toBe(1)
		expect(stderr).toContain('--no-pr has no meaning with --on-main')
	})

	it('reports the on-main form in its usage', async () => {
		const fx = fixture()
		const { status, stderr } = await run(fx)
		expect(status).toBe(1)
		expect(stderr).toContain('[--no-pr | --on-main]')
	})
})

describe('release-prepare refusals leave origin and the tree untouched', () => {
	const untouched = (fx: Fixture, before: ReturnType<typeof inspect>) => {
		const after = inspect(fx)
		expect(after.originMain).toBe(before.originMain)
		expect(after.head).toBe(before.head)
		expect(after.version).toBe(CURRENT)
		expect(after.barrel).toBe(before.barrel)
		expect(after.changelog).toBe(before.changelog)
		expect(after.releaseBranch).toBeNull()
	}

	it('refuses when the tag already exists on origin', async () => {
		const fx = fixture()
		git(fx.work, fx.env, 'tag', 'v0.1.1')
		git(fx.work, fx.env, 'push', '--quiet', 'origin', 'refs/tags/v0.1.1')
		const before = inspect(fx)
		const { status, stderr } = await run(fx, 'patch', '--on-main')
		expect(status).toBe(1)
		expect(stderr).toContain('tag v0.1.1 already exists on origin')
		untouched(fx, before)
	})

	it('refuses when npm already has the version', async () => {
		const fx = fixture()
		const before = inspect(fx)
		const { status, stderr } = await run(fx, 'minor', '--on-main')
		expect(status).toBe(1)
		expect(stderr).toContain('eval-quality@0.2.0 is already on npm')
		untouched(fx, before)
	})

	it('refuses when the registry is unreachable rather than assuming unpublished', async () => {
		const fx = fixture()
		fx.env.npm_config_registry = 'http://127.0.0.1:1/'
		const before = inspect(fx)
		const { status, stderr } = await run(fx, 'patch', '--on-main')
		expect(status).toBe(1)
		expect(stderr).toContain('npm view eval-quality@0.1.1 failed')
		untouched(fx, before)
	})

	it('refuses a dirty working tree', async () => {
		const fx = fixture()
		writeFileSync(join(fx.work, 'scratch.txt'), 'uncommitted\n')
		const before = inspect(fx)
		const { status, stderr } = await run(fx, 'patch', '--on-main')
		expect(status).toBe(1)
		expect(stderr).toContain('working tree is not clean')
		untouched(fx, before)
	})

	it('refuses off main', async () => {
		const fx = fixture()
		git(fx.work, fx.env, 'checkout', '--quiet', '-b', 'topic')
		const { status, stderr } = await run(fx, 'patch', '--on-main')
		expect(status).toBe(1)
		expect(stderr).toContain('must run from main, currently on topic')
	})

	it('refuses when local main is behind origin/main', async () => {
		const fx = fixture()
		// Advance origin from a second clone, the way a re-run pinned to the pre-bump commit sees it.
		const other = join(fx.dir, 'other')
		git(fx.dir, fx.env, 'clone', '--quiet', fx.origin, other)
		git(other, fx.env, 'config', 'user.name', 'someone else')
		git(other, fx.env, 'config', 'user.email', 'else@example.invalid')
		writeFileSync(join(other, 'later.txt'), 'landed after dispatch\n')
		git(other, fx.env, 'add', '.')
		git(other, fx.env, 'commit', '--quiet', '-m', 'later')
		git(other, fx.env, 'push', '--quiet', 'origin', 'main')
		const { status, stderr } = await run(fx, 'patch', '--on-main')
		expect(status).toBe(1)
		expect(stderr).toMatch(
			/local main \(\w{7}\) differs from origin\/main \(\w{7}\); pull first/,
		)
	})

	it('reports a rejected push without leaving anything on origin', async () => {
		const fx = fixture()
		// A pre-receive hook standing in for the protect-main ruleset.
		const hooks = join(fx.origin, 'hooks')
		mkdirSync(hooks, { recursive: true })
		writeFileSync(
			join(hooks, 'pre-receive'),
			'#!/bin/sh\necho "protected branch" >&2\nexit 1\n',
			{ mode: 0o755 },
		)
		const before = inspect(fx)
		const { status, stderr } = await run(fx, 'patch', '--on-main')
		expect(status).toBe(1)
		expect(stderr).toContain('origin rejected the push of v0.1.1 to main')
		expect(stderr).toContain('requires no status check')
		const after = inspect(fx)
		expect(after.originMain).toBe(before.originMain)
		// The local commit stays, as the message says; a rerun from a clean main is the fix.
		expect(after.subject).toBe('chore: release v0.1.1 [skip ci]')
	})
})

describe('release-prepare on a release branch (the laptop path)', () => {
	it('commits on release/vX.Y.Z without [skip ci], pushes the branch, leaves main alone', async () => {
		const fx = fixture()
		const before = inspect(fx)
		// See the --on-main case above: git's own progress output on stderr is not a failure signal.
		const { status, stdout } = await run(fx, 'patch', '--no-pr')
		expect(status).toBe(0)
		const after = inspect(fx)
		expect(after.branch).toBe('release/v0.1.1')
		expect(after.subject).toBe('chore: release v0.1.1')
		expect(after.committed).toEqual(STAMPED_FILES)
		expect(after.originMain).toBe(before.originMain)
		expect(after.releaseBranch).toBe(after.head)
		expect(stdout).toContain('gh pr create --base main --head release/v0.1.1')
	})

	it('refuses when the release branch already exists on origin', async () => {
		const fx = fixture()
		git(
			fx.work,
			fx.env,
			'push',
			'--quiet',
			'origin',
			'main:refs/heads/release/v0.1.1',
		)
		const { status, stderr } = await run(fx, 'patch', '--no-pr')
		expect(status).toBe(1)
		expect(stderr).toContain('branch release/v0.1.1 already exists on origin')
	})
})

describe("release-prepare tolerates the caller's ambient npm config", () => {
	/**
	 * `npm run --silent` sets `npm_config_loglevel=silent` in every child process it starts,
	 * this script included, which is exactly how the coverage canary and CI both invoke the test
	 * suite. `npmHasVersion` used to decide "not published" by regex-matching E404 out of `npm
	 * view`'s plain stderr, and silent logging blanks that text, so a normal unpublished-version
	 * check looked like a fatal npm failure and every release was refused. `--json` fixed it:
	 * npm always writes that to stdout, unaffected by loglevel. This asserts the fix directly,
	 * independent of the fixture's own env hygiene, by inheriting silent logging on purpose.
	 */
	it('still cuts the release when npm_config_loglevel=silent is inherited', async () => {
		const fx = fixture()
		const { status, stdout } = await spawnScript(
			fx.work,
			{ ...fx.env, npm_config_loglevel: 'silent' },
			['patch', '--on-main'],
		)
		expect(status).toBe(0)
		expect(stdout).toContain('0.1.0 -> 0.1.1 on main')
		expect(inspect(fx).version).toBe('0.1.1')
	})
})
