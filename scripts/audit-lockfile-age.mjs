#!/usr/bin/env node
// Audits every registry entry in package-lock.json for supply-chain freshness.
//
// .npmrc's `min-release-age=7` only filters *resolution*: a young package already sitting in a
// committed lockfile installs cleanly under `npm ci` regardless of that setting (a verified fail-open
// in this repo's history, see ARCHITECTURE-SPINE.md#Stack). This script re-checks every locked
// version's real registry publish timestamp and fails closed - on a young entry, or on metadata that
// could not be fetched after retries.
//
// Usage:
//   node scripts/audit-lockfile-age.mjs [--lockfile <path>] [--window-days <n>] [--now <RFC3339>]
//
// --now lets a canary pin the clock to a fixed offset from a fixture entry's real publish date, so the
// fixture never rots as real time passes. Ordinary runs omit it and audit against the real wall clock.

import { readFile } from 'node:fs/promises'

const WINDOW_DAYS_DEFAULT = 7
const CONCURRENCY = 8
const MAX_RETRIES = 3
const RETRY_BASE_MS = 300

function parseArgs(argv) {
	const args = {
		lockfile: 'package-lock.json',
		windowDays: WINDOW_DAYS_DEFAULT,
		now: null,
	}
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]
		if (arg === '--lockfile') args.lockfile = argv[++i]
		else if (arg === '--window-days') args.windowDays = Number(argv[++i])
		else if (arg === '--now') args.now = argv[++i]
		else throw new Error(`Unknown argument: ${arg}`)
	}
	return args
}

// "node_modules/foo" -> "foo"; "node_modules/@scope/foo" -> "@scope/foo";
// "node_modules/a/node_modules/@scope/b" -> "@scope/b" (nested/duplicate installs).
function packageNameFromPath(pkgPath) {
	const segments = pkgPath.split('node_modules/')
	return segments[segments.length - 1].replace(/\/$/, '')
}

function registryUrlForName(name) {
	const encoded = name.startsWith('@')
		? `${name.split('/')[0]}/${encodeURIComponent(name.split('/')[1])}`
		: encodeURIComponent(name)
	return `https://registry.npmjs.org/${encoded}`
}

async function fetchWithRetry(url, attempts = MAX_RETRIES) {
	let lastError
	for (let attempt = 1; attempt <= attempts; attempt++) {
		try {
			const res = await fetch(url)
			if (!res.ok) throw new Error(`HTTP ${res.status}`)
			return await res.json()
		} catch (err) {
			lastError = err
			if (attempt < attempts) {
				await new Promise((resolve) =>
					setTimeout(resolve, RETRY_BASE_MS * attempt),
				)
			}
		}
	}
	throw lastError
}

// One registry request per unique package NAME (not per lockfile entry): the response carries a
// `time` map covering every published version, so every locked version of that package is checked
// from a single fetch.
async function fetchTimeMap(name) {
	const meta = await fetchWithRetry(registryUrlForName(name))
	return meta.time ?? {}
}

async function mapWithConcurrency(items, limit, fn) {
	const results = new Array(items.length)
	let cursor = 0
	async function worker() {
		while (cursor < items.length) {
			const current = cursor++
			results[current] = await fn(items[current], current)
		}
	}
	await Promise.all(
		Array.from({ length: Math.min(limit, items.length) }, worker),
	)
	return results
}

function collectLockedEntries(lockfile) {
	const packages = lockfile.packages ?? {}
	return Object.entries(packages)
		.filter(([pkgPath, meta]) => pkgPath !== '' && meta.version && !meta.link)
		.map(([pkgPath, meta]) => ({
			path: pkgPath,
			name: packageNameFromPath(pkgPath),
			version: meta.version,
		}))
}

export async function auditLockfileAge({ lockfile, now, windowDays }) {
	const cutoff = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000)
	const entries = collectLockedEntries(lockfile)
	const uniqueNames = [...new Set(entries.map((e) => e.name))]

	const timeMaps = new Map()
	const fetchFailures = new Set()
	await mapWithConcurrency(uniqueNames, CONCURRENCY, async (name) => {
		try {
			timeMaps.set(name, await fetchTimeMap(name))
		} catch {
			fetchFailures.add(name)
		}
	})

	const youngEntries = []
	const unfetchableEntries = []

	for (const entry of entries) {
		if (fetchFailures.has(entry.name)) {
			unfetchableEntries.push(entry)
			continue
		}
		const publishedAt = timeMaps.get(entry.name)?.[entry.version]
		if (!publishedAt) {
			unfetchableEntries.push(entry)
			continue
		}
		if (new Date(publishedAt) > cutoff) {
			youngEntries.push({ ...entry, publishedAt })
		}
	}

	return { cutoff, entries, youngEntries, unfetchableEntries }
}

async function main() {
	const args = parseArgs(process.argv.slice(2))
	const now = args.now ? new Date(args.now) : new Date()
	if (Number.isNaN(now.getTime())) {
		throw new Error(`--now is not a valid RFC3339 timestamp: ${args.now}`)
	}
	console.log(`Effective clock: ${now.toISOString()}`)

	const lockfile = JSON.parse(await readFile(args.lockfile, 'utf8'))
	const { cutoff, entries, youngEntries, unfetchableEntries } =
		await auditLockfileAge({
			lockfile,
			now,
			windowDays: args.windowDays,
		})

	if (youngEntries.length === 0 && unfetchableEntries.length === 0) {
		console.log(
			`Lockfile age audit passed: ${entries.length} entries, all published before ${cutoff.toISOString()}.`,
		)
		return
	}

	if (unfetchableEntries.length > 0) {
		console.error(
			`\nFailed closed: could not fetch publish metadata for ${unfetchableEntries.length} entrie(s):`,
		)
		for (const entry of unfetchableEntries) {
			console.error(`  - ${entry.name}@${entry.version} (${entry.path})`)
		}
	}

	if (youngEntries.length > 0) {
		console.error(
			`\nAge violation: ${youngEntries.length} entrie(s) published inside the ${args.windowDays}-day window (cutoff ${cutoff.toISOString()}):`,
		)
		for (const entry of youngEntries) {
			console.error(
				`  - ${entry.name}@${entry.version} published ${entry.publishedAt} (${entry.path})`,
			)
		}
	}

	process.exitCode = 1
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((err) => {
		console.error(err.stack ?? String(err))
		process.exitCode = 1
	})
}
