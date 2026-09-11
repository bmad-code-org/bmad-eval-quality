#!/usr/bin/env node
// Audits every registry entry in package-lock.json for supply-chain freshness.
//
// .npmrc's `min-release-age=7` only filters *resolution*: a young package already sitting in a
// committed lockfile installs cleanly under `npm ci` regardless of that setting (a verified fail-open
// in this repo's history, see ARCHITECTURE-SPINE.md#Stack). This script re-checks every locked
// version's real registry publish timestamp and fails closed: on a young entry, on metadata that
// could not be fetched after retries, or on an entry whose `resolved` is not the registry tarball for
// that entry's own name and version (a relabelled lockfile entry pointing `resolved` at a mirror, or
// at another package on the registry itself, would otherwise sail through).
//
// These flags are the pre-install path: `.github/actions/audit-lockfile-age`
// runs this before `npm ci`, so nothing here may import from `node_modules`. A
// consumer runs the same audit through `eval-quality-gates lockfile-age`, which
// reads its lockfiles and its window out of a configuration file.
//
// Usage:
//   node scripts/audit-lockfile-age.mjs [--lockfile <path>] [--window-days <n>] [--now <RFC3339>]
//
// --now lets a canary pin the clock to a fixed offset from a fixture entry's real publish date, so the
// fixture never rots as real time passes. Ordinary runs omit it and audit against the real wall clock.

import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

// The window this script's own flags default to. `gate-config.ts` declares the
// same default for the configured path as `LOCKFILE_WINDOW_DAYS_DEFAULT`, and
// `tests/architecture/published-gates.test.ts` holds the two equal. The number
// is declared twice because this file runs before `npm ci` in CI and so may
// import nothing from `node_modules`, where the schema that carries the other
// one lives.
export const WINDOW_DAYS_DEFAULT = 7
const CONCURRENCY = 8
const MAX_RETRIES = 3
const RETRY_BASE_MS = 300
const FETCH_TIMEOUT_MS = 15_000
const REGISTRY_PREFIX = 'https://registry.npmjs.org/'

/**
 * `error.code` on the refusal a caller repairs by pointing the gate at a real
 * lockfile. `check-licenses.mjs` exports the same string and
 * `tests/architecture/published-gates.test.ts` holds the two equal, for the
 * reason `WINDOW_DAYS_DEFAULT` is declared twice.
 */
export const LOCKFILE_SHAPE_ERROR = 'EVAL_QUALITY_LOCKFILE_SHAPE'

function refuseLockfileShape(message) {
	const error = new Error(message)
	error.code = LOCKFILE_SHAPE_ERROR
	return error
}

// The one URL the public registry serves `name@version` from. A scoped name's
// tarball basename is the segment after the slash, so `@scope/pkg` at 1.0.0 is
// `https://registry.npmjs.org/@scope/pkg/-/pkg-1.0.0.tgz`.
function registryTarballUrl(name, version) {
	const basename = name.startsWith('@')
		? name.slice(name.indexOf('/') + 1)
		: name
	return `${REGISTRY_PREFIX}${name}/-/${basename}-${version}.tgz`
}

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
	return `${REGISTRY_PREFIX}${encoded}`
}

// A non-retryable 4xx (other than 429) means the request itself is wrong - e.g. a 404 for a name that
// does not exist on the registry - and retrying just wastes the retry budget for no benefit. 5xx, 429,
// and network/timeout errors are transient and worth retrying with backoff.
class NonRetryableFetchError extends Error {}

async function fetchWithRetry(url, attempts = MAX_RETRIES) {
	let lastError
	for (let attempt = 1; attempt <= attempts; attempt++) {
		try {
			const res = await fetch(url, {
				signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
			})
			if (res.ok) return await res.json()
			if (res.status !== 429 && res.status < 500) {
				throw new NonRetryableFetchError(`HTTP ${res.status}`)
			}
			throw new Error(`HTTP ${res.status}`)
		} catch (err) {
			lastError = err
			if (err instanceof NonRetryableFetchError) break
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

function collectLockedEntries(lockfile, source) {
	// Every entry is read from `packages`, which npm writes from lockfileVersion 2 onward. Defaulting
	// it to {} turned an npm 6 lockfile, or a path naming something that is not a lockfile at all, into
	// a run that reported success over zero entries: a gate that scanned nothing, in the words of a
	// gate that passed.
	const packages = lockfile?.packages
	if (
		packages === null ||
		typeof packages !== 'object' ||
		Array.isArray(packages)
	) {
		throw refuseLockfileShape(
			`audit-lockfile-age: ${source} carries no "packages" object (lockfileVersion ${JSON.stringify(lockfile?.lockfileVersion ?? null)}); every entry is read from there, so this run would have passed over nothing. npm writes "packages" from lockfileVersion 2 onward.`,
		)
	}
	return Object.entries(packages)
		.filter(([pkgPath, meta]) => pkgPath !== '' && meta.version && !meta.link)
		.map(([pkgPath, meta]) => ({
			path: pkgPath,
			// meta.name (present on aliased entries, e.g. `"node_modules/foo": {"name": "bar", ...}`
			// for an `npm:bar@x` alias) is the package actually installed. Falling back to the
			// path-derived name would audit "foo" - a name that was never fetched - against "bar"'s
			// lockfile version, checking the wrong package entirely.
			name: meta.name ?? packageNameFromPath(pkgPath),
			version: meta.version,
			resolved: meta.resolved,
		}))
}

/**
 * `readTimeMap` is the one effect this function performs, named so a caller can
 * supply the registry's answers itself. It defaults to the real fetch, so a
 * caller that wants the registry gets it by saying nothing, and a case that
 * wants a fixed answer runs offline.
 *
 * `source` is the path this lockfile was read from, named in the refusal a
 * document without a `packages` object earns.
 */
export async function auditLockfileAge({
	lockfile,
	now,
	windowDays,
	source = 'the lockfile',
	readTimeMap = fetchTimeMap,
}) {
	if (!Number.isFinite(windowDays) || windowDays < 1) {
		throw new Error(
			`windowDays must be at least 1, got: ${windowDays}; a window of zero admits a package published this instant and still reports that every entry was published before the cutoff`,
		)
	}

	const cutoff = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000)
	const entries = collectLockedEntries(lockfile, source)

	// An entry whose `resolved` is not the registry tarball for its own name and version did not come
	// from where an age check against npmjs.org assumes. A lockfile edit can point `resolved` at a
	// mirror, or at another package on the registry itself, while the name and version this gate reads
	// still name the harmless one; `npm ci` fetches `resolved` and checks `integrity` against whatever
	// comes back, so the substituted tarball installs. Pinning the host alone left that second shape
	// open. Fail closed on the mismatch: the age of a package the install never fetches establishes nothing.
	const offRegistryEntries = []
	const registryEntries = []
	for (const entry of entries) {
		if (entry.resolved === registryTarballUrl(entry.name, entry.version)) {
			registryEntries.push(entry)
		} else {
			offRegistryEntries.push(entry)
		}
	}

	const uniqueNames = [...new Set(registryEntries.map((e) => e.name))]

	const timeMaps = new Map()
	const fetchFailures = new Set()
	await mapWithConcurrency(uniqueNames, CONCURRENCY, async (name) => {
		try {
			timeMaps.set(name, await readTimeMap(name))
		} catch {
			fetchFailures.add(name)
		}
	})

	const youngEntries = []
	const unfetchableEntries = []

	for (const entry of registryEntries) {
		if (fetchFailures.has(entry.name)) {
			unfetchableEntries.push(entry)
			continue
		}
		const publishedAt = timeMaps.get(entry.name)?.[entry.version]
		if (!publishedAt) {
			unfetchableEntries.push(entry)
			continue
		}
		const publishedDate = new Date(publishedAt)
		if (Number.isNaN(publishedDate.getTime())) {
			// An unparseable timestamp must not silently compare as "not young" (Date comparisons
			// against an Invalid Date are always false) - that would fetch metadata, find it useless,
			// and pass anyway. Treat it the same as metadata that could not be fetched at all.
			unfetchableEntries.push(entry)
			continue
		}
		if (publishedDate > cutoff) {
			youngEntries.push({ ...entry, publishedAt })
		}
	}

	return {
		cutoff,
		entries,
		youngEntries,
		unfetchableEntries,
		offRegistryEntries,
	}
}

async function main() {
	const args = parseArgs(process.argv.slice(2))
	const now = args.now ? new Date(args.now) : new Date()
	if (Number.isNaN(now.getTime())) {
		throw new Error(`--now is not a valid RFC3339 timestamp: ${args.now}`)
	}
	console.log(`Effective clock: ${now.toISOString()}`)

	const lockfile = JSON.parse(await readFile(args.lockfile, 'utf8'))
	const {
		cutoff,
		entries,
		youngEntries,
		unfetchableEntries,
		offRegistryEntries,
	} = await auditLockfileAge({
		lockfile,
		now,
		windowDays: args.windowDays,
		source: args.lockfile,
	})

	if (
		youngEntries.length === 0 &&
		unfetchableEntries.length === 0 &&
		offRegistryEntries.length === 0
	) {
		console.log(
			`Lockfile age audit passed: ${entries.length} entries, all published before ${cutoff.toISOString()}.`,
		)
		return
	}

	if (offRegistryEntries.length > 0) {
		console.error(
			`\nFailed closed: ${offRegistryEntries.length} entrie(s) do not resolve to their own registry tarball:`,
		)
		for (const entry of offRegistryEntries) {
			console.error(
				`  - ${entry.name}@${entry.version} resolved=${JSON.stringify(entry.resolved ?? null)}, expected ${registryTarballUrl(entry.name, entry.version)} (${entry.path})`,
			)
		}
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

// pathToFileURL percent-encodes the same way import.meta.url does (spaces, non-ASCII, etc.); a raw
// `file://${process.argv[1]}` template comparison silently mismatches on such paths, so main() never
// runs and the script exits 0 with no output: a gate switched off while looking idle.
//
// process.argv[1] is undefined where there is no script path at all, which is every `node -e`, every
// `--input-type=module` evaluation, and the REPL. pathToFileURL throws ERR_INVALID_ARG_TYPE on
// undefined, so without this guard the module cannot be imported from any of them, and it ships in
// `dist/gates/` where a consumer does exactly that.
const entryPoint = process.argv[1]
if (
	entryPoint !== undefined &&
	import.meta.url === pathToFileURL(entryPoint).href
) {
	main().catch((err) => {
		// A refusal the caller repairs by pointing the gate at a real lockfile says so in one line; a
		// stack trace for it is noise.
		const detail =
			err.code === LOCKFILE_SHAPE_ERROR
				? err.message
				: (err.stack ?? String(err))
		console.error(detail)
		process.exitCode = 1
	})
}
