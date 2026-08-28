#!/usr/bin/env node
// Cuts a release branch from a laptop: bumps the version, stamps CHANGELOG.md, commits on
// `release/vX.Y.Z`, pushes, and opens the PR against main. The PR clears `gate` like any other and
// a human merges it; publish.yml then publishes whatever version main declares.
//
// This used to happen inside publish.yml. Under the `protect-main` ruleset it cannot: a PR opened
// with GITHUB_TOKEN never triggers pr-gate.yml, so `gate` never posts and the PR never merges.
//
// Every check runs before anything is written, so a refusal leaves the tree exactly as found.
//
// Usage:
//   npm run release:prepare -- patch|minor|major [--no-pr]
//
// --no-pr pushes the branch and prints the `gh pr create` command instead of running it.

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const PACKAGE = 'eval-quality'
const BUMPS = new Set(['patch', 'minor', 'major'])

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
	const args = { bump: null, pr: true }
	for (const arg of argv) {
		if (arg === '--no-pr') args.pr = false
		else if (BUMPS.has(arg) && args.bump === null) args.bump = arg
		else fail(`unknown argument: ${arg}`)
	}
	if (!args.bump)
		fail('usage: npm run release:prepare -- patch|minor|major [--no-pr]')
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

function npmHasVersion(version) {
	try {
		const out = execFileSync(
			'npm',
			['view', `${PACKAGE}@${version}`, 'version'],
			{ encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
		).trim()
		return out === version
	} catch {
		// E404: the package or the version does not exist on the registry.
		return false
	}
}

function preflight(bump) {
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
	if (remoteRefExists(`refs/heads/${releaseBranch}`)) {
		fail(
			`branch ${releaseBranch} already exists on origin; merge or delete it first`,
		)
	}
	if (npmHasVersion(version)) fail(`${PACKAGE}@${version} is already on npm`)

	return { current, version, tag, releaseBranch, head }
}

const BARREL = 'src/index.ts'

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

function main() {
	const args = parseArgs(process.argv.slice(2))
	const { current, version, tag, releaseBranch } = preflight(args.bump)
	console.log(`release-prepare: ${current} -> ${version} on ${releaseBranch}`)

	run('npm', ['version', version, '--no-git-tag-version'])
	stampBarrelVersion(current, version)
	run(process.execPath, [resolve('scripts/stamp-changelog.mjs')])

	git('checkout', '-b', releaseBranch)
	git('add', 'package.json', 'package-lock.json', 'CHANGELOG.md', BARREL)
	git('commit', '--quiet', '-m', `chore: release ${tag}`)
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
		`Bumps the version to ${version} and stamps CHANGELOG.md. Merge, then run the Publish Package workflow from main.`,
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
