#!/usr/bin/env node
// Cuts a release: bumps the version, stamps `src/index.ts` and CHANGELOG.md, commits, pushes.
//
// Two modes, one commit shape.
//
// Default, from a laptop: the commit lands on `release/vX.Y.Z`, the branch is pushed, and a PR
// against main is opened for a human to review and merge; then publish.yml with `bump=none`
// publishes the version main declares.
//
// `--on-main`, from publish.yml: the commit lands on main and is pushed there, so the run that
// made it can publish it. The push uses the job's own GITHUB_TOKEN; it lands because the
// `protect-main` ruleset requires no status check. `[skip ci]` keeps the push from starting
// push-triggered workflows on a commit the release run already owns.
//
// Every check runs before anything is written, so a refusal leaves the tree exactly as found.
//
// Usage:
//   npm run release:prepare -- patch|minor|major [--no-pr]
//   node scripts/release-prepare.mjs patch|minor|major --on-main
//
// --no-pr pushes the branch and prints the `gh pr create` command instead of running it.

import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE = 'eval-quality'
const BUMPS = new Set(['patch', 'minor', 'major'])
const USAGE =
	'usage: npm run release:prepare -- patch|minor|major [--no-pr | --on-main]'

function git(...args) {
	return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function run(command, args, options = {}) {
	execFileSync(command, args, { stdio: 'inherit', ...options })
}

function fail(message) {
	console.error(`release-prepare: ${message}`)
	process.exit(1)
}

function parseArgs(argv) {
	const args = { bump: null, pr: true, onMain: false }
	for (const arg of argv) {
		if (arg === '--no-pr') args.pr = false
		else if (arg === '--on-main') args.onMain = true
		else if (BUMPS.has(arg) && args.bump === null) args.bump = arg
		else fail(`unknown argument: ${arg}\n${USAGE}`)
	}
	if (!args.bump) fail(USAGE)
	if (args.onMain && !args.pr)
		fail(`--no-pr has no meaning with --on-main\n${USAGE}`)
	return args
}

// The prerelease suffix is dropped: a release cut from `1.2.0-rc.1` with `patch` is `1.2.1`,
// which is what `npm version patch` does too.
function nextVersion(current, bump) {
	const match = /^(\d+)\.(\d+)\.(\d+)(?:-.*)?$/.exec(current)
	if (!match) fail(`package.json version is not semver: ${current}`)
	const [major, minor, patch] = match.slice(1).map(Number)
	if (bump === 'major') return `${major + 1}.0.0`
	if (bump === 'minor') return `${major}.${minor + 1}.0`
	return `${major}.${minor}.${patch + 1}`
}

function remoteRefExists(ref) {
	try {
		execFileSync('git', ['ls-remote', '--exit-code', 'origin', ref], {
			stdio: 'ignore',
		})
		return true
	} catch {
		return false
	}
}

// E404 is the one failure that means "not published". Anything else is the registry or the
// network, and reading it as "not published" is how a duplicate version gets cut.
function npmHasVersion(version) {
	const spec = `${PACKAGE}@${version}`
	const result = spawnSync('npm', ['view', spec, 'version'], {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	})
	if (result.status === 0) return result.stdout.trim() === version
	if (/\bE404\b/.test(result.stderr)) return false
	fail(`npm view ${spec} failed:\n${result.stderr.trim()}`)
}

function preflight({ bump, onMain }) {
	const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
	if (branch !== 'main') fail(`must run from main, currently on ${branch}`)
	if (git('status', '--porcelain') !== '') fail('working tree is not clean')

	git('fetch', '--quiet', 'origin', 'main')
	const head = git('rev-parse', 'HEAD')
	const remote = git('rev-parse', 'origin/main')
	if (head !== remote) {
		fail(
			`local main (${head.slice(0, 7)}) differs from origin/main (${remote.slice(0, 7)}); pull first`,
		)
	}

	const current = JSON.parse(
		readFileSync(resolve('package.json'), 'utf8'),
	).version
	const version = nextVersion(current, bump)
	const tag = `v${version}`
	const releaseBranch = `release/${tag}`

	if (remoteRefExists(`refs/tags/${tag}`))
		fail(`tag ${tag} already exists on origin`)
	if (!onMain && remoteRefExists(`refs/heads/${releaseBranch}`)) {
		fail(
			`branch ${releaseBranch} already exists on origin; merge or delete it first`,
		)
	}
	if (npmHasVersion(version)) fail(`${PACKAGE}@${version} is already on npm`)

	return { current, version, tag, releaseBranch, head }
}

const BARREL = 'src/index.ts'
const STAMP_CHANGELOG = fileURLToPath(
	new URL('./stamp-changelog.mjs', import.meta.url),
)

/**
 * `src/index.ts` publishes the version as a constant, so bumping the manifest
 * alone ships a `VERSION` one release behind. A test asserts the two agree,
 * which catches it after the release branch exists; stamping it here means
 * there is nothing to catch.
 */
function stampBarrelVersion(current, version) {
	const source = readFileSync(BARREL, 'utf8')
	const previous = `export const VERSION = '${current}'`
	if (!source.includes(previous)) {
		fail(`${BARREL} does not declare VERSION as '${current}'; bump it by hand`)
	}
	writeFileSync(
		BARREL,
		source.replace(previous, `export const VERSION = '${version}'`),
	)
}

function pushMain(tag) {
	try {
		run('git', ['push', 'origin', 'main'])
	} catch {
		fail(
			[
				`origin rejected the push of ${tag} to main.`,
				'The protect-main ruleset lets this push through only because it requires no status check.',
				'Check the protect-main ruleset (CONTRIBUTING.md, Releasing) if that changed.',
				'The commit is local only; nothing on origin changed.',
			].join('\n'),
		)
	}
}

function main() {
	const args = parseArgs(process.argv.slice(2))
	const { current, version, tag, releaseBranch } = preflight(args)
	const target = args.onMain ? 'main' : releaseBranch
	console.log(`release-prepare: ${current} -> ${version} on ${target}`)

	run('npm', ['version', version, '--no-git-tag-version'])
	stampBarrelVersion(current, version)
	run(process.execPath, [STAMP_CHANGELOG])

	if (!args.onMain) git('checkout', '-b', releaseBranch)
	git('add', 'package.json', 'package-lock.json', 'CHANGELOG.md', BARREL)
	const subject = args.onMain
		? `chore: release ${tag} [skip ci]`
		: `chore: release ${tag}`
	git('commit', '--quiet', '-m', subject)

	if (args.onMain) {
		pushMain(tag)
		console.log(
			`release-prepare: ${tag} is on main at ${git('rev-parse', 'HEAD')}`,
		)
		return
	}

	run('git', ['push', '--set-upstream', 'origin', releaseBranch])

	const prArgs = [
		'pr',
		'create',
		'--base',
		'main',
		'--head',
		releaseBranch,
		'--title',
		`chore: release ${tag}`,
		'--body',
		`Bumps the version to ${version} and stamps CHANGELOG.md. Merge, then run \`npm run release:publish\`.`,
	]
	if (!args.pr) {
		console.log(
			`release-prepare: branch pushed. Open the PR with:\n  gh ${prArgs.map((a) => (a.includes(' ') ? JSON.stringify(a) : a)).join(' ')}`,
		)
		return
	}
	run('gh', prArgs)
}

main()
