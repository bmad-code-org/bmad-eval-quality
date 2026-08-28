#!/usr/bin/env node
// Moves everything under `## [Unreleased]` into a dated version section.
//
// `scripts/release-prepare.mjs` runs this right after `npm version`, so the release commit carries
// its own notes and the publish workflow's GitHub Release step finds an exact version heading
// instead of the accumulating [Unreleased] block. Contributors keep writing under [Unreleased].
//
// Refuses when the heading is missing, and does nothing when the version already has a section or
// [Unreleased] is empty, so a re-run after a partial release is safe.
//
// Usage:
//   node scripts/stamp-changelog.mjs [--dry-run] [--file CHANGELOG.md] [--version 1.2.0]
// Env:
//   CHANGELOG_DATE=YYYY-MM-DD   override the stamped date (tests)

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const UNRELEASED_HEADING = /^##[ \t]*\[Unreleased\][ \t]*$/m
const ANY_HEADING = /^##[ \t]/m

export function parseArgs(argv) {
	const args = { dryRun: false, file: 'CHANGELOG.md', version: null }
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]
		if (arg === '--dry-run') args.dryRun = true
		else if (arg === '--file') args.file = argv[++i]
		else if (arg === '--version') args.version = argv[++i]
		else throw new Error(`Unknown argument: ${arg}`)
	}
	return args
}

function resolveVersion(explicit) {
	if (explicit) return explicit
	const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8'))
	return pkg.version
}

export function resolveDate(override = process.env.CHANGELOG_DATE) {
	if (override) {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(override)) {
			throw new Error(`CHANGELOG_DATE must be YYYY-MM-DD, got: ${override}`)
		}
		return override
	}
	return new Date().toISOString().slice(0, 10)
}

export function stamp(source, version, date) {
	const match = source.match(UNRELEASED_HEADING)
	if (!match) {
		throw new Error(
			'CHANGELOG.md has no "## [Unreleased]" heading. Refusing to guess where notes go.',
		)
	}

	const escapedVersion = version.replaceAll('.', String.raw`\.`)
	const versionHeading = new RegExp(
		String.raw`^##[ \t]*\[${escapedVersion}\]`,
		'm',
	)
	if (versionHeading.test(source)) {
		return {
			changed: false,
			reason: `CHANGELOG.md already has a section for ${version}.`,
		}
	}

	const bodyStart = match.index + match[0].length
	const rest = source.slice(bodyStart)
	const nextHeadingAt = rest.search(ANY_HEADING)
	const body = (
		nextHeadingAt === -1 ? rest : rest.slice(0, nextHeadingAt)
	).trim()
	const tail = nextHeadingAt === -1 ? '' : rest.slice(nextHeadingAt)

	if (!body) {
		return {
			changed: false,
			reason: 'No entries under [Unreleased]; nothing to stamp.',
		}
	}

	const stamped = `## [Unreleased]\n\n## [${version}] - ${date}\n\n${body}\n\n`
	return {
		changed: true,
		reason: `Stamped [Unreleased] into [${version}] - ${date}.`,
		output: source.slice(0, match.index) + stamped + tail,
	}
}

function main() {
	const args = parseArgs(process.argv.slice(2))
	const version = resolveVersion(args.version)
	const date = resolveDate()
	const source = readFileSync(args.file, 'utf8')
	const result = stamp(source, version, date)

	if (!result.changed) {
		console.log(result.reason)
		return
	}
	if (args.dryRun) {
		console.log(`[dry-run] ${result.reason}`)
		return
	}
	writeFileSync(args.file, result.output)
	console.log(result.reason)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		main()
	} catch (error) {
		console.error(error.message)
		process.exit(1)
	}
}
