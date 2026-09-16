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
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	symlinkSync,
	writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
	auditLockfileAge,
	fetchTimeMap,
	readPublishCache,
} from '../../scripts/audit-lockfile-age.mjs'
import {
	DocClaimsSection,
	hashOfSubject,
	runDocClaims,
} from '../../scripts/check-doc-claims.ts'
import {
	inWords,
	matchCaseOf,
	runDocCounts,
	widenSpaces,
} from '../../scripts/check-doc-counts.ts'
import { runDocInvocations } from '../../scripts/check-doc-invocations.mjs'
import {
	MAX_PATTERN_LENGTH,
	MAX_PROSE_PATTERN_LENGTH,
	ProsePattern,
} from '../../scripts/consumer-pattern.ts'
import {
	LOCKFILE_WINDOW_DAYS_DEFAULT,
	loadDocClaimsConfig,
	loadDocCountsConfig,
	loadDocInvocationsConfig,
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
describe('a citation-shaped path inside a fenced block', () => {
	/**
	 * A page that transcribes a command's diagnostic carries the file and line
	 * of whatever tree that command ran over, which for a tutorial is a fixture
	 * the page created moments earlier. Read as a citation it resolves to
	 * nothing in the source roots and the class fails on a page that is right.
	 * The prose case beside it is what keeps the skip from swallowing a real
	 * citation.
	 */
	const claimsOver = async (...body: readonly string[]) => {
		const scratch = mkdtempSync(join(tmpdir(), 'doc-claims-fence-'))
		mkdirSync(join(scratch, 'src'))
		writeFileSync(join(scratch, 'src/rules.ts'), 'export const RULES = 1\n')
		// One resolvable citation in prose, so the class has something to examine
		// and refuses nothing for being empty.
		writeFileSync(
			join(scratch, 'page.md'),
			['# A page', '', '`RULES` lives at src/rules.ts:1.', '', ...body].join(
				'\n',
			),
		)
		return runDocClaims(scratch, {
			pages: ['page.md'],
			generated: [],
			sources: [{ path: 'src', extensions: ['.ts'] }],
			citations: { extensions: ['.ts'], window: 4, unanchored: [] },
		} as never)
	}

	it('is left alone', async () => {
		const report = await claimsOver(
			'```text',
			'src/model/price.ts:1 no such file here',
			'```',
			'',
		)
		expect(report.failures).toEqual([])
	})

	it('still fails in prose, where it is a claim about the tree', async () => {
		const report = await claimsOver(
			'The rule also lives at src/model/price.ts:1.',
			'',
		)
		expect(report.failures.length).toBeGreaterThan(0)
	})
})

describe('a `read` claim pinned with `asOf`', () => {
	const SENTENCE = 'The cache stands today with no eviction policy.'
	const KEY = 'stands today with no eviction policy'

	const scratchWith = (pageBody: string): string => {
		const scratch = mkdtempSync(join(tmpdir(), 'doc-claims-asof-'))
		writeFileSync(join(scratch, 'page.md'), pageBody)
		return scratch
	}

	const datedSection = (asOf: Record<string, unknown>) => ({
		pages: ['page.md'],
		generated: [],
		dated: {
			triggers: [{ match: '\\bstands today\\b', flags: 'i' }],
			claims: [
				{
					file: 'page.md',
					key: KEY,
					settles: 'read',
					reason: 'test fixture',
					asOf,
				},
			],
		},
	})

	it('passes when the subject still hashes to the pin', async () => {
		const scratch = scratchWith(`# A page\n\n${SENTENCE}\n`)
		const hash = hashOfSubject(readFileSync(join(scratch, 'page.md'), 'utf8'))
		const report = await runDocClaims(scratch, datedSection({ hash }) as never)
		expect(report.failures).toEqual([])
		expect(report.summary).toContain('1 pinned to a content hash')
	})

	it('fails when the page content drifts under the pin', async () => {
		const scratch = scratchWith(`# A page\n\n${SENTENCE}\n`)
		const hash = hashOfSubject(readFileSync(join(scratch, 'page.md'), 'utf8'))
		writeFileSync(
			join(scratch, 'page.md'),
			`# A page\n\n${SENTENCE}\n\nA new paragraph appeared.\n`,
		)
		const report = await runDocClaims(scratch, datedSection({ hash }) as never)
		expect(
			report.failures.some(
				(line) =>
					line.includes('was last confirmed against') &&
					line.includes('different content hash'),
			),
		).toBe(true)
	})

	it('is left alone by a reformat: trimmed lines, collapsed inner spaces, collapsed blank runs', async () => {
		// The sentence's own bytes stay put, because the dated-claim `key` is
		// matched literally against the raw line; only the surrounding whitespace
		// a formatter would touch changes.
		const scratch = scratchWith(
			`# A page\n\nSome  context   first.\n\n${SENTENCE}\n`,
		)
		const hash = hashOfSubject(readFileSync(join(scratch, 'page.md'), 'utf8'))
		writeFileSync(
			join(scratch, 'page.md'),
			`# A page   \n\nSome context first.  \n\n\n\n${SENTENCE}\n\n\n`,
		)
		const report = await runDocClaims(scratch, datedSection({ hash }) as never)
		expect(report.failures).toEqual([])
	})

	it('hashes a fenced code block byte-exact, so indentation drift inside one is caught', async () => {
		const fence = (indent: string) =>
			`# A page\n\n${SENTENCE}\n\n\`\`\`yaml\na:\n${indent}b: 1\n\`\`\`\n`
		const scratch = scratchWith(fence('  '))
		const hash = hashOfSubject(readFileSync(join(scratch, 'page.md'), 'utf8'))
		writeFileSync(join(scratch, 'page.md'), fence('    '))
		const report = await runDocClaims(scratch, datedSection({ hash }) as never)
		expect(
			report.failures.some((line) => line.includes('different content hash')),
		).toBe(true)
	})

	it('pins asOf.subject to a file other than the one carrying the sentence', async () => {
		const scratch = scratchWith(`# A page\n\n${SENTENCE}\n`)
		writeFileSync(join(scratch, 'evidence.json'), '{"open":3}\n')
		const hash = hashOfSubject(
			readFileSync(join(scratch, 'evidence.json'), 'utf8'),
		)
		const section = datedSection({ subject: 'evidence.json', hash })

		const passing = await runDocClaims(scratch, section as never)
		expect(passing.failures).toEqual([])

		writeFileSync(join(scratch, 'evidence.json'), '{"open":4}\n')
		const failing = await runDocClaims(scratch, section as never)
		expect(
			failing.failures.some((line) => line.includes('evidence.json')),
		).toBe(true)
	})

	it('fails clearly when asOf.subject names a path that does not exist', async () => {
		const scratch = scratchWith(`# A page\n\n${SENTENCE}\n`)
		const section = datedSection({
			subject: 'missing.json',
			hash: '0'.repeat(64),
		})
		const report = await runDocClaims(scratch, section as never)
		expect(
			report.failures.some(
				(line) => line.includes('missing.json') && line.includes('ENOENT'),
			),
		).toBe(true)
	})

	it('reports the real error code rather than "does not exist" for a directory subject', async () => {
		const scratch = scratchWith(`# A page\n\n${SENTENCE}\n`)
		mkdirSync(join(scratch, 'a-directory'))
		const section = datedSection({
			subject: 'a-directory',
			hash: '0'.repeat(64),
		})
		const report = await runDocClaims(scratch, section as never)
		expect(
			report.failures.some(
				(line) => line.includes('a-directory') && line.includes('EISDIR'),
			),
		).toBe(true)
	})

	it('refuses a symlinked subject rather than following it outside the tree', async () => {
		const scratch = scratchWith(`# A page\n\n${SENTENCE}\n`)
		const outside = mkdtempSync(join(tmpdir(), 'doc-claims-asof-outside-'))
		writeFileSync(join(outside, 'evidence.json'), '{"open":3}\n')
		symlinkSync(
			join(outside, 'evidence.json'),
			join(scratch, 'evidence-link.json'),
		)
		const section = datedSection({
			subject: 'evidence-link.json',
			hash: hashOfSubject(readFileSync(join(outside, 'evidence.json'), 'utf8')),
		})
		const report = await runDocClaims(scratch, section as never)
		expect(
			report.failures.some(
				(line) =>
					line.includes('evidence-link.json') && line.includes('symbolic link'),
			),
		).toBe(true)
	})

	it('is insensitive to CRLF line endings inside a fenced block', async () => {
		const lf = `# A page\n\n${SENTENCE}\n\n\`\`\`yaml\na:\n  b: 1\n\`\`\`\n`
		const crlf = lf.replace(/\n/g, '\r\n')
		const scratch = scratchWith(lf)
		const hash = hashOfSubject(readFileSync(join(scratch, 'page.md'), 'utf8'))
		writeFileSync(join(scratch, 'page.md'), crlf)
		const report = await runDocClaims(scratch, datedSection({ hash }) as never)
		expect(report.failures).toEqual([])
	})

	it('hashes a tilde-fenced code block byte-exact, same as a backtick fence', async () => {
		const fence = (indent: string) =>
			`# A page\n\n${SENTENCE}\n\n~~~yaml\na:\n${indent}b: 1\n~~~\n`
		const scratch = scratchWith(fence('  '))
		const hash = hashOfSubject(readFileSync(join(scratch, 'page.md'), 'utf8'))
		writeFileSync(join(scratch, 'page.md'), fence('    '))
		const report = await runDocClaims(scratch, datedSection({ hash }) as never)
		expect(
			report.failures.some((line) => line.includes('different content hash')),
		).toBe(true)
	})

	it('keeps a shorter nested fence-like line inside an open fence as protected content', async () => {
		const page = (indent: string) =>
			`# A page\n\n${SENTENCE}\n\n` +
			'````markdown\n' +
			'```yaml\n' +
			`a:\n${indent}b: 1\n` +
			'```\n' +
			'````\n'
		const scratch = scratchWith(page('  '))
		const hash = hashOfSubject(readFileSync(join(scratch, 'page.md'), 'utf8'))
		writeFileSync(join(scratch, 'page.md'), page('      '))
		const report = await runDocClaims(scratch, datedSection({ hash }) as never)
		expect(
			report.failures.some((line) => line.includes('different content hash')),
		).toBe(true)
	})

	it('keeps nested-list indentation significant outside a fence: un-nesting fails', async () => {
		const nested = `# A page\n\n${SENTENCE}\n\n- a\n  - b\n`
		const flattened = `# A page\n\n${SENTENCE}\n\n- a\n- b\n`
		const scratch = scratchWith(nested)
		const hash = hashOfSubject(readFileSync(join(scratch, 'page.md'), 'utf8'))
		writeFileSync(join(scratch, 'page.md'), flattened)
		const report = await runDocClaims(scratch, datedSection({ hash }) as never)
		expect(
			report.failures.some((line) => line.includes('different content hash')),
		).toBe(true)
	})

	it('keeps nested-list indentation significant outside a fence: nesting a flat item fails', async () => {
		const flat = `# A page\n\n${SENTENCE}\n\n- a\n- b\n`
		const nested = `# A page\n\n${SENTENCE}\n\n- a\n  - b\n`
		const scratch = scratchWith(flat)
		const hash = hashOfSubject(readFileSync(join(scratch, 'page.md'), 'utf8'))
		writeFileSync(join(scratch, 'page.md'), nested)
		const report = await runDocClaims(scratch, datedSection({ hash }) as never)
		expect(
			report.failures.some((line) => line.includes('different content hash')),
		).toBe(true)
	})

	it('reads indentation as depth, not width: a prettier-style reindent does not fail', async () => {
		const twoSpace = `# A page\n\n${SENTENCE}\n\n- a\n  - b\n    - c\n`
		const fourSpace = `# A page\n\n${SENTENCE}\n\n- a\n    - b\n        - c\n`
		const scratch = scratchWith(twoSpace)
		const hash = hashOfSubject(readFileSync(join(scratch, 'page.md'), 'utf8'))
		writeFileSync(join(scratch, 'page.md'), fourSpace)
		const report = await runDocClaims(scratch, datedSection({ hash }) as never)
		expect(report.failures).toEqual([])
	})
})

describe('the `asOf` schema refine', () => {
	it('forbids asOf on a claim settled by a predicate', () => {
		const result = DocClaimsSection.safeParse({
			pages: ['docs'],
			dated: {
				triggers: [{ match: 'x' }],
				claims: [
					{
						file: 'docs/page.md',
						key: 'x',
						settles: { module: 'src/x.ts', export: 'X' },
						reason: 'x',
						asOf: { hash: '0'.repeat(64) },
					},
				],
			},
		})
		expect(result.success).toBe(false)
		expect(
			!result.success &&
				JSON.stringify(result.error.issues).includes(
					'is set, and settles is a predicate',
				),
		).toBe(true)
	})

	it('rejects a hash that is not 64 lowercase hex characters', () => {
		const result = DocClaimsSection.safeParse({
			pages: ['docs'],
			dated: {
				triggers: [{ match: 'x' }],
				claims: [
					{
						file: 'docs/page.md',
						key: 'x',
						settles: 'read',
						reason: 'x',
						asOf: { hash: 'not-a-hash' },
					},
				],
			},
		})
		expect(result.success).toBe(false)
	})

	it('refuses two entries sharing the same file and key', () => {
		const result = DocClaimsSection.safeParse({
			pages: ['docs'],
			dated: {
				triggers: [{ match: 'x' }],
				claims: [
					{
						file: 'docs/page.md',
						key: 'x',
						settles: 'read',
						reason: 'first subject',
						asOf: { subject: 'a.ts', hash: '0'.repeat(64) },
					},
					{
						file: 'docs/page.md',
						key: 'x',
						settles: 'read',
						reason: 'second subject',
						asOf: { subject: 'b.ts', hash: '1'.repeat(64) },
					},
				],
			},
		})
		expect(result.success).toBe(false)
		expect(
			!result.success &&
				JSON.stringify(result.error.issues).includes(
					'repeats the file and key of an earlier entry',
				),
		).toBe(true)
	})
})

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
		// Two of these floors came down with the documentation rework, and a
		// floor lowered to meet reality reads from the outside exactly like a
		// floor lowered to hide a regression, so each drop is accounted for here.
		//
		// The list floor came down by two, which is the two entries deleted from
		// `docs/explanation/what-ships.md`: the AD-11 version readers and the
		// barrel's schema versions. Both restated a set that
		// `docs/reference/cli-commands.md` holds under its own entry against the
		// same export, so each expected set still has a holder and the entries
		// were deleted rather than relaxed to fit the new wording.
		//
		// The symbol floor came down because the explanation pages are shorter
		// and because prose that named identifiers became fenced commands, which
		// this class does not scan. No page stopped being examined: the two
		// largest drops are what-ships, whose version-compatibility paragraph
		// moved to the CLI reference and is scanned there, and the walkthrough,
		// whose step 6 and step 7 prose became invocations the doc-invocations
		// gate executes and compares. The floor below that one is what holds the
		// coverage those commands moved to.
		expect(numeral('citations resolve')).toBeGreaterThanOrEqual(21)
		expect(
			numeral('backticked identifiers are declared'),
		).toBeGreaterThanOrEqual(420)
		expect(
			numeral('transcribed lists match their source'),
		).toBeGreaterThanOrEqual(11)
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
		expect(numeral('pinned to a content hash')).toBeGreaterThanOrEqual(1)
	})
})

/**
 * The same floor, for the invocation gate, and it holds the property the
 * documentation rework exists to establish.
 *
 * The gate reports how many documented invocations ran faithfully, which is how
 * many named only inputs this repository really has and were therefore judged
 * on their exit code. A page that replaces a runnable command with command
 * grammar, or names a file only a reader has, drops that number while the gate
 * still exits 0, because an unfaithful run is excused rather than failed. The
 * number was 11 before the rework and the floor is what stops it drifting back.
 */
describe("this repository's own documented invocations, held to a floor", () => {
	it('judges at least as many faithful invocations as it does today', async () => {
		const configPath = resolve('eval-quality.config.json')
		const loaded = await loadDocInvocationsConfig({ configPath })
		expect(loaded.kind).toBe('section')
		if (loaded.kind !== 'section') return
		const report = runDocInvocations(dirname(loaded.path), loaded.section)
		expect(report.failures).toEqual([])
		expect(report.judged).toBeGreaterThanOrEqual(54)
		expect(report.compared).toBeGreaterThanOrEqual(14)
	}, 600_000)
})

/**
 * The same floor, for doc-counts: a class that stops holding a numeral is a
 * regression the fixture pair cannot show, because the fixture pair is small
 * by design.
 *
 * This floor came down by four with the documentation rework, and the four are
 * the entries deleted from `docs/explanation/what-ships.md`: the barrel's
 * schema version count, and the counts of artifacts with a reader, artifacts
 * this package stamps, and artifacts the caller assembles. That page answered
 * what you get on install and had grown a version-compatibility section
 * restating what `docs/reference/cli-commands.md` already carries. Each of the
 * four sources still has an entry holding it on the reference page, so no
 * number lost its only holder, and the entries were deleted rather than
 * relaxed to match new wording.
 */
describe("this repository's own doc-counts entries, held to a floor", () => {
	it('holds at least as many numerals as it does today', async () => {
		const configPath = resolve('eval-quality.config.json')
		const loaded = await loadDocCountsConfig({ configPath })
		expect(loaded.kind).toBe('section')
		if (loaded.kind !== 'section') return
		const report = await runDocCounts(dirname(loaded.path), loaded.section)
		expect(report.failures).toEqual([])
		expect(report.numerals).toBeGreaterThanOrEqual(44)
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
