// Writes the publication cache the lockfile-age gate reads.
//
// The gate never writes it, on the rule that a check able to repair what it
// reads is not a gate. So this is the one writer, run by hand after a change
// that adds dependencies. A run that is never made costs correctness nothing: an
// entry the cache does not carry is fetched live, and a fetch that fails still
// fails the gate.
//
// The file is rewritten rather than merged, so a dependency that left the tree
// takes its entry with it and the cache stays a picture of the lockfiles it was
// generated from.
//
// `buildCache` is exported so a test can drive it against a stubbed
// `readTimeMap`, the same seam `auditLockfileAge` itself takes; the top-level
// script below is the only caller that reaches the real registry.
//
// Usage:
//   npm run generate:lockfile-age-cache
//
// Run by `node` directly: type stripping erases types only, so no TypeScript
// enum, namespace, parameter property, or non-type re-export may appear here or
// in anything it imports.
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { auditLockfileAge, fetchTimeMap } from './audit-lockfile-age.mjs'
import {
	DEFAULT_CONFIG_FILE,
	type LockfileAgeConfig,
	loadLockfileAgeConfig,
} from './gate-config.ts'

type Entry = {
	readonly name: string
	readonly version: string
}

type Report = {
	readonly entries: readonly Entry[]
	readonly offRegistryEntries: readonly Entry[]
}

export type ReadTimeMap = (name: string) => Promise<Record<string, string>>

export type BuiltCache = {
	/** `name@version` to publication timestamp, sorted for a stable diff. */
	readonly cache: Readonly<Record<string, string>>
	/**
	 * An entry the run could not cache and why: an off-registry entry (never
	 * cached, on purpose) or a fetch that answered nothing for that version.
	 */
	readonly dropped: readonly { readonly key: string; readonly reason: string }[]
}

/**
 * Builds the cache document for one lockfile-age section, over the lockfiles
 * it names. `readTimeMap` defaults to the real registry fetch; a test supplies
 * its own to run offline.
 */
export async function buildCache(
	root: string,
	section: LockfileAgeConfig,
	readTimeMap: ReadTimeMap = fetchTimeMap as ReadTimeMap,
): Promise<BuiltCache> {
	const now = new Date()
	const times = new Map<string, Record<string, string>>()
	const cache: Record<string, string> = {}
	const dropped: { key: string; reason: string }[] = []

	for (const relative of section.lockfiles) {
		const lockfile = JSON.parse(await readFile(resolve(root, relative), 'utf8'))
		const report = (await auditLockfileAge({
			lockfile,
			now,
			windowDays: section.windowDays,
			source: relative,
			readTimeMap: async (name: string) => {
				const map = await readTimeMap(name)
				times.set(name, map)
				return map
			},
		})) as unknown as Report

		// An entry that does not resolve to its own registry tarball is refused
		// before any fetch, and caching a time for it would put a passing answer
		// in front of the refusal the gate exists to make.
		const offRegistry = new Set(
			report.offRegistryEntries.map(
				(entry) => `${entry.name}@${entry.version}`,
			),
		)
		for (const entry of report.entries) {
			const key = `${entry.name}@${entry.version}`
			if (offRegistry.has(key)) {
				dropped.push({ key, reason: 'resolves off the npm registry' })
				continue
			}
			const published = times.get(entry.name)?.[entry.version]
			if (published === undefined) {
				dropped.push({
					key,
					reason: 'the registry answered no publication time for this version',
				})
				continue
			}
			cache[key] = published
		}
	}

	const ordered = Object.fromEntries(
		Object.keys(cache)
			.sort()
			.map((key) => [key, cache[key] as string]),
	)
	return { cache: ordered, dropped }
}

const loaded = await loadLockfileAgeConfig()
if (loaded.kind === 'refused') {
	console.error(`generate:lockfile-age-cache: ${loaded.message}`)
	process.exitCode = 64
} else {
	const root = dirname(loaded.path)
	const target = loaded.section.cache
	if (target === undefined) {
		console.error(
			`generate:lockfile-age-cache: ${loaded.path}'s "lockfile-age" section names no cache, so there is nothing to write`,
		)
		process.exitCode = 64
	} else {
		const { cache, dropped } = await buildCache(root, loaded.section)
		const path = resolve(root, target)
		await writeFile(path, `${JSON.stringify(cache, null, '\t')}\n`, 'utf8')
		console.log(
			`generate:lockfile-age-cache: ${Object.keys(cache).length} publication time(s) written to ${target}, from ${loaded.section.lockfiles.join(', ')} named by ${DEFAULT_CONFIG_FILE}`,
		)
		if (dropped.length > 0) {
			console.log(
				`generate:lockfile-age-cache: ${dropped.length} entrie(s) not cached, and left to a live fetch on the next gate run:`,
			)
			for (const { key, reason } of dropped)
				console.log(`  - ${key}: ${reason}`)
		}
	}
}
