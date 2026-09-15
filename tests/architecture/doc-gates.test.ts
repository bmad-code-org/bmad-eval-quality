/**
 * The engines behind the three documentation gates, and the publication cache
 * the lockfile-age gate reads.
 *
 * `published-gates.test.ts` asserts the binary, which is the surface a consumer
 * invokes. What is asserted here is the rules underneath it, each of which
 * decides something a fixture pair cannot show in one run: how a number is
 * rendered, which refusal a malformed source earns, and whether a cached
 * publication time reaches the registry.
 *
 * The cache cases are the weight-bearing ones. A cache is sound here only
 * because a publication time never changes, so what has to hold is that a cached
 * entry is never asked for, an uncached one always is, and a failed fetch for an
 * uncached one still fails closed. Those three are the whole of the design
 * decision, and a counting `readTimeMap` is what shows them without a network.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
	auditLockfileAge,
	fetchTimeMap,
	readPublishCache,
} from '../../scripts/audit-lockfile-age.mjs'
import { runDocClaims } from '../../scripts/check-doc-claims.ts'
import {
	inWords,
	matchCaseOf,
	runDocCounts,
	widenSpaces,
} from '../../scripts/check-doc-counts.ts'
import {
	MAX_PATTERN_LENGTH,
	MAX_PROSE_PATTERN_LENGTH,
	ProsePattern,
} from '../../scripts/consumer-pattern.ts'
import {
	LOCKFILE_WINDOW_DAYS_DEFAULT,
	loadDocClaimsConfig,
	loadDocCountsConfig,
} from '../../scripts/gate-config.ts'
import { buildCache } from '../../scripts/generate-lockfile-age-cache.ts'
import {
	readModuleCount,
	readModuleParser,
	readModuleStrings,
	readModuleText,
	readModuleVerdict,
} from '../../scripts/module-value.ts'

const FIXTURE_ROOT = 'scripts/fixtures/consumer/doc-counts-compliant'
const RULES = {
	module: 'src/rules.ts',
	export: 'RULES',
	take: 'value',
} as const

describe('the word table', () => {
	it('renders the range the pages use', () => {
		expect(inWords(0)).toBe('zero')
		expect(inWords(19)).toBe('nineteen')
		expect(inWords(20)).toBe('twenty')
		expect(inWords(21)).toBe('twenty-one')
		expect(inWords(99)).toBe('ninety-nine')
	})

	/**
	 * Past the table the entry fails rather than the run aborting, so a count
	 * that outgrew the words is reported beside every other failure instead of
	 * ending the report at the first one.
	 */
	it('answers null outside its range', () => {
		expect(inWords(100)).toBeNull()
		expect(inWords(-1)).toBeNull()
		expect(inWords(1.5)).toBeNull()
	})

	it('follows the case the page used', () => {
		expect(matchCaseOf('Three', 'four')).toBe('Four')
		expect(matchCaseOf('three', 'four')).toBe('four')
	})
})

describe('a pattern whose spaces may wrap', () => {
	it('widens a space between words and leaves one inside a class alone', () => {
		const widened = new RegExp(widenSpaces('two words'))
		expect(widened.test('two\nwords')).toBe(true)
		expect(widened.test('two words')).toBe(true)

		// A space inside a bracket expression is a member of a character set, so
		// widening it would change which characters the class admits.
		expect(widenSpaces('a [ x]b')).toContain('[ x]')
	})

	/**
	 * The reason a wrap gap exists at all. `\s+` reads across a blank line, so a
	 * capture group in front of one takes a word out of the paragraph above and
	 * the gate compares a number that sentence never states.
	 */
	it('never reaches across a blank line', () => {
		const widened = new RegExp(widenSpaces('ships ([a-z-]+) rules'))
		expect(widened.test('ships three\nrules')).toBe(true)
		expect(widened.test('ships three\n\nrules')).toBe(false)
	})

	it('leaves an escaped character intact', () => {
		expect(widenSpaces('a\\ b')).toContain('a\\ ')
	})
})

describe('the consumer pattern bounds', () => {
	it('gives prose a longer bound than a construct', () => {
		expect(MAX_PROSE_PATTERN_LENGTH).toBeGreaterThan(MAX_PATTERN_LENGTH)
	})

	it('refuses a backreference and a stateful flag', () => {
		expect(ProsePattern.safeParse({ match: '(a)\\1' }).success).toBe(false)
		expect(ProsePattern.safeParse({ match: 'a', flags: 'g' }).success).toBe(
			false,
		)
		expect(ProsePattern.safeParse({ match: 'a', flags: 'i' }).success).toBe(
			true,
		)
	})

	it('refuses a pattern that does not compile', () => {
		expect(ProsePattern.safeParse({ match: '(' }).success).toBe(false)
	})
})

describe('a value a configuration names in a module', () => {
	it('reads a count, a list, and a predicate', async () => {
		expect(
			await readModuleCount(FIXTURE_ROOT, { ...RULES, take: 'length' }),
		).toBe(3)
		expect(await readModuleStrings(FIXTURE_ROOT, RULES)).toContain('no-empty')
	})

	it('names the module and the export it could not find', async () => {
		await expect(
			readModuleCount(FIXTURE_ROOT, { ...RULES, export: 'ABSENT' }),
		).rejects.toThrow('exports no "ABSENT"')
		await expect(
			readModuleCount('scripts/fixtures/consumer', {
				module: 'nowhere.ts',
				export: 'RULES',
				take: 'value',
			}),
		).rejects.toThrow('could not be imported')
	})

	/**
	 * A list read with `take: "value"` is the mistake a configuration makes
	 * first, so the refusal says which setting repairs it rather than only that
	 * the value was wrong.
	 */
	it('says which take a list needs', async () => {
		await expect(
			readModuleCount(FIXTURE_ROOT, { ...RULES, take: 'value' }),
		).rejects.toThrow('a list takes "length"')
	})

	it('refuses a text source and a schema source of the wrong shape', async () => {
		await expect(readModuleText(FIXTURE_ROOT, RULES)).rejects.toThrow(
			'a string or a function returning one was expected',
		)
		await expect(readModuleParser(FIXTURE_ROOT, RULES)).rejects.toThrow(
			'has no safeParse',
		)
		await expect(readModuleVerdict(FIXTURE_ROOT, RULES)).rejects.toThrow(
			'a boolean or a function returning one was expected',
		)
	})
})

const tarball = (name: string, version: string): string =>
	`https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`

const lockfileOf = (...entries: readonly [string, string][]): unknown => ({
	name: 'cache-case',
	version: '0.0.0',
	lockfileVersion: 3,
	packages: {
		'': { name: 'cache-case', version: '0.0.0' },
		...Object.fromEntries(
			entries.map(([name, version]) => [
				`node_modules/${name}`,
				{ version, resolved: tarball(name, version), license: 'MIT' },
			]),
		),
	},
})

const ANCIENT = '2020-01-01T00:00:00.000Z'
const NOW = new Date('2026-01-01T00:00:00.000Z')

describe('the publication cache', () => {
	it('asks the registry for nothing it already carries', async () => {
		const asked: string[] = []
		const report = await auditLockfileAge({
			lockfile: lockfileOf(['alpha', '1.0.0'], ['beta', '2.0.0']),
			now: NOW,
			windowDays: 7,
			cache: { 'alpha@1.0.0': ANCIENT, 'beta@2.0.0': ANCIENT },
			readTimeMap: async (name: string) => {
				asked.push(name)
				return {}
			},
		})
		expect(asked).toEqual([])
		expect(report.youngEntries).toHaveLength(0)
		expect(report.unfetchableEntries).toHaveLength(0)
	})

	it('fetches the entry it does not carry, and only that one', async () => {
		const asked: string[] = []
		const report = await auditLockfileAge({
			lockfile: lockfileOf(['alpha', '1.0.0'], ['beta', '2.0.0']),
			now: NOW,
			windowDays: 7,
			cache: { 'alpha@1.0.0': ANCIENT },
			readTimeMap: async (name: string) => {
				asked.push(name)
				return { '2.0.0': ANCIENT }
			},
		})
		expect(asked).toEqual(['beta'])
		expect(report.unfetchableEntries).toHaveLength(0)
	})

	/**
	 * Fail-closed is the property the cache may not weaken. An entry nothing has
	 * established the age of has to fail, whether the cache was consulted or not.
	 */
	it('still fails closed when the fetch for an uncached entry fails', async () => {
		const report = await auditLockfileAge({
			lockfile: lockfileOf(['alpha', '1.0.0'], ['beta', '2.0.0']),
			now: NOW,
			windowDays: 7,
			cache: { 'alpha@1.0.0': ANCIENT },
			readTimeMap: async () => {
				throw new Error('the registry is not reachable')
			},
		})
		expect(report.unfetchableEntries).toHaveLength(1)
		expect(report.unfetchableEntries[0]?.name).toBe('beta')
	})

	/**
	 * A cached entry inside the window fails like any other. The cache answers
	 * when a package was published; it never answers whether the gate passes.
	 */
	it('fails a cached entry published inside the window', async () => {
		const report = await auditLockfileAge({
			lockfile: lockfileOf(['alpha', '1.0.0']),
			now: NOW,
			windowDays: 7,
			cache: { 'alpha@1.0.0': '2025-12-31T00:00:00.000Z' },
			readTimeMap: async () => ({}),
		})
		expect(report.youngEntries).toHaveLength(1)
	})

	it('refuses a cache document that is not a map of timestamps', () => {
		expect(() => readPublishCache([], 'cache.json')).toThrow(
			'is not a JSON object',
		)
		expect(() =>
			readPublishCache({ 'alpha@1.0.0': 'yesterday' }, 'cache.json'),
		).toThrow('is not an RFC3339 timestamp')
		// A string `new Date` alone would parse ("12" is the year 2001), which is
		// exactly the loose input a hand edit could slip into a committed cache.
		expect(() =>
			readPublishCache({ 'alpha@1.0.0': '12' }, 'cache.json'),
		).toThrow('is not an RFC3339 timestamp')
		expect(() => readPublishCache({ alpha: ANCIENT }, 'cache.json')).toThrow(
			'is not a "name@version"',
		)
	})
})

/**
 * The registry read the cache now skips.
 *
 * Every case above injects `readTimeMap`, and this repository's committed cache
 * answers every locked entry, so the real fetch runs nowhere: breaking the URL
 * it builds would leave `validate` and all four workflow invocations green and
 * surface on the first pull request that adds a dependency. These two cases are
 * what stand in for the run that used to exercise it.
 */
describe('the registry read behind the cache', () => {
	const withStubbedFetch = async <T>(
		respond: (url: string) => Promise<Response>,
		run: () => Promise<T>,
	): Promise<T> => {
		const real = globalThis.fetch
		globalThis.fetch = ((input: RequestInfo | URL) =>
			respond(String(input))) as typeof fetch
		try {
			return await run()
		} finally {
			globalThis.fetch = real
		}
	}

	const ok = (body: unknown): Response =>
		new Response(JSON.stringify(body), {
			status: 200,
			headers: { 'content-type': 'application/json' },
		})

	it('asks the registry for the package it was given, scoped names included', async () => {
		const asked: string[] = []
		await withStubbedFetch(
			async (url) => {
				asked.push(url)
				return ok({ time: { '1.0.0': ANCIENT } })
			},
			async () => {
				await fetchTimeMap('zod')
				await fetchTimeMap('@img/sharp-linux-x64')
			},
		)
		expect(asked[0]).toBe('https://registry.npmjs.org/zod')
		// The scope keeps its slash and the name after it is encoded, which is what
		// the registry serves a scoped package under.
		expect(asked[1]).toBe('https://registry.npmjs.org/@img/sharp-linux-x64')
	})

	it('retries a 5xx and answers from the response that follows', async () => {
		let attempts = 0
		const times = await withStubbedFetch(
			async () => {
				attempts += 1
				if (attempts === 1) return new Response('', { status: 503 })
				return ok({ time: { '2.0.0': ANCIENT } })
			},
			() => fetchTimeMap('fixture-dual') as Promise<Record<string, string>>,
		)
		expect(attempts).toBe(2)
		expect(times['2.0.0']).toBe(ANCIENT)
	})

	it('answers an empty map for a package carrying no time field', async () => {
		const times = await withStubbedFetch(
			async () => ok({}),
			() => fetchTimeMap('fixture-local') as Promise<Record<string, string>>,
		)
		// Not a throw: an empty map lands every locked version of that name in
		// `unfetchableEntries`, which is the fail-closed answer.
		expect(times).toEqual({})
	})
})

/**
 * The committed cache itself, and the pre-install path that reads it.
 *
 * Four workflows now trust `lockfile-age-cache.json`, and its only writer is a
 * generator nothing re-derives. What can be held without regenerating it: every
 * key parses, and every key names a package one of the audited lockfiles really
 * locks. A key for a package no lockfile carries is a typed entry or a stale one,
 * and neither belongs in a file a supply-chain gate reads.
 *
 * Deliberately not held: that every locked entry is in the cache. An absent
 * entry is a live fetch by design, so requiring completeness would make a
 * dependency bump fail here rather than simply cost a request.
 */
describe("this repository's committed publication cache", () => {
	const locked = (lockfile: string): ReadonlySet<string> => {
		const document = JSON.parse(readFileSync(lockfile, 'utf8')) as {
			packages?: Record<string, { version?: string }>
		}
		const names = new Set<string>()
		for (const [path, entry] of Object.entries(document.packages ?? {})) {
			if (path === '' || entry.version === undefined) continue
			const name = path.split('node_modules/').pop() as string
			names.add(`${name}@${entry.version}`)
		}
		return names
	}

	it('parses, and names only packages the audited lockfiles lock', () => {
		const cache = readPublishCache(
			JSON.parse(readFileSync('lockfile-age-cache.json', 'utf8')),
			'lockfile-age-cache.json',
		) as Record<string, string>
		const entries = new Set([
			...locked('package-lock.json'),
			...locked('website/package-lock.json'),
		])
		const unknown = Object.keys(cache).filter((key) => !entries.has(key))
		expect(unknown, 'cache keys no lockfile carries').toEqual([])
		expect(Object.keys(cache).length).toBeGreaterThan(0)
	})

	it('refuses a cache path the pre-install flag names and the tree lacks', () => {
		const run = spawnSync(
			process.execPath,
			[
				'scripts/audit-lockfile-age.mjs',
				'--lockfile',
				'package-lock.json',
				'--cache',
				'no-such-cache.json',
			],
			{ encoding: 'utf8' },
		)
		expect(run.status).toBe(1)
		expect(`${run.stdout}${run.stderr}`).toContain('--cache names it')
	})
})

/**
 * A floor on this repository's own doc-claims class counts, run against the real
 * tree rather than a fixture.
 *
 * The interface-kind verb loss during class 7's generalization shipped
 * unnoticed by every test in the suite; only a manual comparison against the
 * previous script's report line caught it, and nothing kept that comparison
 * from happening only once. A floor here is the standing version of that
 * comparison: a class that loses coverage silently drops below the number
 * pinned, and the test fails instead of only the next manual check noticing.
 *
 * `toBeGreaterThanOrEqual` rather than `toBe`, because a legitimate new
 * citation or a legitimate new symbol on a future page is not a regression;
 * a class examining fewer sentences than it does today is.
 */
describe("this repository's own doc-claims classes, held to a floor", () => {
	it('classifies at least as many sentences per class as it does today', async () => {
		const configPath = resolve('eval-quality.config.json')
		const loaded = await loadDocClaimsConfig({ configPath })
		expect(loaded.kind).toBe('section')
		if (loaded.kind !== 'section') return
		const report = await runDocClaims(dirname(loaded.path), loaded.section)
		expect(report.failures).toEqual([])

		const numeral = (label: string): number => {
			const match = new RegExp(`(\\d+) ${label}`).exec(report.summary)
			expect(match, `"${label}" in: ${report.summary}`).not.toBeNull()
			return Number(match?.[1])
		}
		expect(numeral('citations resolve')).toBeGreaterThanOrEqual(21)
		expect(
			numeral('backticked identifiers are declared'),
		).toBeGreaterThanOrEqual(446)
		expect(
			numeral('transcribed lists match their source'),
		).toBeGreaterThanOrEqual(13)
		expect(numeral('named codes exist')).toBeGreaterThanOrEqual(21)
		expect(
			numeral('worked JSON blocks parse against their schema'),
		).toBeGreaterThanOrEqual(11)
		expect(
			numeral('vocabulary mentions agree with the two sets'),
		).toBeGreaterThanOrEqual(30)
		expect(
			numeral('transcriptions match their source byte for byte'),
		).toBeGreaterThanOrEqual(5)
	})
})

/** The same floor, for doc-counts: a class that stops holding a numeral is a
 * regression the fixture pair cannot show, because the fixture pair is small
 * by design. */
describe("this repository's own doc-counts entries, held to a floor", () => {
	it('holds at least as many numerals as it does today', async () => {
		const configPath = resolve('eval-quality.config.json')
		const loaded = await loadDocCountsConfig({ configPath })
		expect(loaded.kind).toBe('section')
		if (loaded.kind !== 'section') return
		const report = await runDocCounts(dirname(loaded.path), loaded.section)
		expect(report.failures).toEqual([])
		expect(report.numerals).toBeGreaterThanOrEqual(48)
		expect(report.digits).toBeGreaterThanOrEqual(8)
		expect(report.files).toBeGreaterThanOrEqual(12)
	})
})

describe('the publication-cache generator', () => {
	const ANCIENT_2 = '2021-06-01T00:00:00.000Z'

	it('writes only the entries the registry answered, dropping the rest by name', async () => {
		const root = mkdtempSync(join(tmpdir(), 'generate-cache-'))
		writeFileSync(
			join(root, 'package-lock.json'),
			JSON.stringify(
				lockfileOf(['alpha', '1.0.0'], ['beta', '2.0.0'], ['gamma', '3.0.0']),
			),
			'utf8',
		)
		const times: Record<string, Record<string, string>> = {
			alpha: { '1.0.0': ANCIENT },
			// beta answers, but not for this version: dropped as unfetchable.
			beta: { '9.9.9': ANCIENT_2 },
			// gamma: the fetch itself fails.
		}
		const { cache, dropped } = await buildCache(
			root,
			{
				lockfiles: ['package-lock.json'],
				windowDays: LOCKFILE_WINDOW_DAYS_DEFAULT,
			},
			async (name) => {
				if (name === 'gamma') throw new Error('registry unreachable')
				return times[name] ?? {}
			},
		)
		expect(cache).toEqual({ 'alpha@1.0.0': ANCIENT })
		expect(dropped.map((each) => each.key).sort()).toEqual([
			'beta@2.0.0',
			'gamma@3.0.0',
		])
	})

	/**
	 * The generator's own fail-closed rule, the same as the gate's: an
	 * off-registry entry is never cached, whatever the registry answers for its
	 * name at some other version. Caching it would put a passing answer in
	 * front of the refusal the gate exists to make.
	 */
	it('never caches an entry that resolves off the npm registry', async () => {
		const root = mkdtempSync(join(tmpdir(), 'generate-cache-off-registry-'))
		writeFileSync(
			join(root, 'package-lock.json'),
			JSON.stringify(lockfileOf(['alpha', '1.0.0']), (key, value) =>
				key === 'resolved' && typeof value === 'string'
					? 'https://example.com/not-npm.tgz'
					: value,
			),
			'utf8',
		)
		const { cache, dropped } = await buildCache(
			root,
			{
				lockfiles: ['package-lock.json'],
				windowDays: LOCKFILE_WINDOW_DAYS_DEFAULT,
			},
			async () => ({ '1.0.0': ANCIENT }),
		)
		expect(cache).toEqual({})
		expect(dropped).toEqual([
			{ key: 'alpha@1.0.0', reason: 'resolves off the npm registry' },
		])
	})
})
