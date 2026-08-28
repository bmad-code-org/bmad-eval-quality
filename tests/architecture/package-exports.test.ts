/**
 * AC 17 cases 145 through 158: the published package surface. What `exports`
 * resolves to, what the barrel carries, and what `npm pack` puts in the
 * tarball.
 *
 * The subpath cases resolve through `createRequire(import.meta.url).resolve`
 * against this package by self-reference, which Node grants because
 * `package.json` has an `exports` map. That needs no pack and no install.
 * `import.meta.resolve` is unusable here: it never stats, so
 * `eval-quality/schemas/THIS-DOES-NOT-EXIST.json` resolves happily and proves
 * nothing about what shipped. `createRequire(...).resolve` honours the same
 * map and throws `MODULE_NOT_FOUND` on a target that is not on disk.
 *
 * Cases 145 through 147, 152, 153, and 155 through 157 read `dist/`, so
 * `npm run build` is their precondition and each skips with a clear message
 * when it has not run, the way `tests/cli/main.test.ts` does. Every CI job
 * that runs the suite builds first, so the skip is a local-convenience path
 * and never a silent hole in the gate. Case 157 passes `--ignore-scripts`
 * because `prepack` is `npm run clean && npm run build` and would delete
 * `dist/` out from under the neighbouring cases.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { INTERCHANGE_ARTIFACT_KEYS } from '../../src/core/schemas/artifact.ts'

const selfRequire = createRequire(import.meta.url)
const repoRoot = fileURLToPath(new URL('../../', import.meta.url))

type Manifest = {
	readonly version: string
	readonly bin: Record<string, string>
	readonly files: readonly string[]
	readonly exports: Record<string, string | Record<string, string>>
}

const manifest = JSON.parse(
	readFileSync(join(repoRoot, 'package.json'), 'utf8'),
) as Manifest

/** An absolute path, or a throw carrying `MODULE_NOT_FOUND`. */
const resolveSubpath = (specifier: string): string =>
	selfRequire.resolve(specifier)

const barrelSource = readFileSync(join(repoRoot, 'src/index.ts'), 'utf8')
const layerBarrelSource = readFileSync(
	join(repoRoot, 'src/application/index.ts'),
	'utf8',
)

/**
 * The names inside every `export type { ... }` clause. Type exports are erased
 * before runtime, so the only place to read them is the text.
 */
function exportedTypeNames(source: string): Set<string> {
	const names = new Set<string>()
	for (const clause of source.matchAll(/export type\s*\{([^}]*)\}/g)) {
		for (const raw of (clause[1] as string).split(',')) {
			const name = raw.trim()
			if (name !== '') names.add(name)
		}
	}
	return names
}

/** `sealed-run-record` -> `SealedRunRecord`. */
const pascalCase = (key: string): string =>
	key
		.split('-')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join('')

/**
 * A build is a precondition for the cases that read `dist/`. Resolved lazily:
 * `createRequire(...).resolve` stats, so doing it at module load turns an
 * unbuilt tree into a suite that reports zero tests rather than a skip.
 */
const BUILT = existsSync(join(repoRoot, 'dist/index.js'))
const NEEDS_BUILD =
	'dist/index.js is absent. Run `npm run build` first: this case reads the built package.'

let barrelCache: Record<string, unknown> | undefined
const publishedBarrel = async (): Promise<Record<string, unknown>> => {
	barrelCache ??= (await import(
		pathToFileURL(resolveSubpath('eval-quality')).href
	)) as Record<string, unknown>
	return barrelCache
}

/**
 * A Zod schema, by either of its two runtime marks. Both are checked because
 * `_zod` is the internal brand and `safeParse` is the callable surface, and a
 * schema stripped of one still ships the other.
 */
function isZodSchema(value: unknown): boolean {
	if (value === null) return false
	if (typeof value !== 'object' && typeof value !== 'function') return false
	if ('_zod' in (value as object)) return true
	return typeof (value as { safeParse?: unknown }).safeParse === 'function'
}

/**
 * Every export the barrel carried before this story, as a committed snapshot
 * of `git show HEAD:src/index.ts`. Six of these are the sensitivity-witness
 * types Story 6.2 added; none is an interchange artifact, so case 151's
 * completeness rule would not notice them going missing.
 *
 * A merge-base diff would be the other way to get this set, and no job in
 * `pr-checks.yml` sets `fetch-depth`, so on a `pull_request` event there is no
 * `origin/main` to diff against and the case would silently stop running.
 *
 * Adding a name here is how a future story records a deliberate removal.
 */
const EXPORTS_BEFORE_THIS_STORY: readonly string[] = [
	'runPreflight',
	'RunPreflightOptions',
	'PreflightCheck',
	'PreflightVerdict',
	'FixtureReset',
	'ManifestationWitness',
	'SensitivityWitness',
	'SensitivityWitnessLeg',
	'WitnessChannel',
	'WitnessInputs',
	'VERSION',
]

describe('the published package surface', () => {
	it('case 145: `.` resolves to the built barrel', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		expect(resolveSubpath('eval-quality')).toBe(join(repoRoot, 'dist/index.js'))
	})

	it('case 146: `./adapters` resolves to the built adapter barrel', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		expect(resolveSubpath('eval-quality/adapters')).toBe(
			join(repoRoot, 'dist/adapters/index.js'),
		)
	})

	it('case 147: `./conformance` resolves to the built conformance suite', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		expect(resolveSubpath('eval-quality/conformance')).toBe(
			join(repoRoot, 'dist/testing/index.js'),
		)
	})

	it('case 148: `./schemas/*` resolves a generated JSON Schema by its real filename', () => {
		// `./schemas/*.json` would make this specifier resolve to
		// `eval-contract.schema.json.json`, which is why the target is `./schemas/*`.
		expect(
			resolveSubpath('eval-quality/schemas/eval-contract.schema.json'),
		).toBe(join(repoRoot, 'schemas/eval-contract.schema.json'))
	})

	it('case 149: `./corpus/*` resolves a corpus file', () => {
		expect(resolveSubpath('eval-quality/corpus/dev/index.json')).toBe(
			join(repoRoot, 'corpus/dev/index.json'),
		)
	})

	it('case 150: `./package.json` resolves the manifest', () => {
		expect(resolveSubpath('eval-quality/package.json')).toBe(
			join(repoRoot, 'package.json'),
		)
	})

	it('case 151: the barrel exports a type for every interchange artifact', () => {
		const exported = exportedTypeNames(barrelSource)
		const missing = INTERCHANGE_ARTIFACT_KEYS.map(pascalCase).filter(
			(name) => !exported.has(name),
		)
		expect(missing).toEqual([])
	})

	it('case 152: no live Zod schema is reachable from the barrel', async (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const reachable: string[] = []
		for (const [name, value] of Object.entries(await publishedBarrel())) {
			if (isZodSchema(value)) reachable.push(name)
			// One level in, so a registry of schemas cannot hide behind a plain
			// wrapper object the walk would otherwise stop at.
			if (value === null || typeof value !== 'object') continue
			for (const [key, nested] of Object.entries(value)) {
				if (isZodSchema(nested)) reachable.push(`${name}.${key}`)
			}
		}
		expect(reachable).toEqual([])
	})

	it('case 153: every export present before this story is still exported', async (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const current = new Set([
			...Object.keys(await publishedBarrel()),
			...exportedTypeNames(barrelSource),
			// `export * from './application/index.ts'` carries the layer barrel's
			// type exports through, and `RunPreflightOptions` is one of them.
			...exportedTypeNames(layerBarrelSource),
		])
		const dropped = EXPORTS_BEFORE_THIS_STORY.filter(
			(name) => !current.has(name),
		)
		expect(dropped).toEqual([])
	})

	it('case 154: `files` covers every path `exports` names', () => {
		const targets: string[] = []
		for (const entry of Object.values(manifest.exports)) {
			if (typeof entry === 'string') targets.push(entry)
			else targets.push(...Object.values(entry))
		}
		const uncovered = targets.filter((target) => {
			const root = target.replace(/^\.\//, '').split('/')[0] as string
			// npm packs `package.json` unconditionally, so `files` never lists it.
			return root !== 'package.json' && !manifest.files.includes(root)
		})
		expect(uncovered).toEqual([])
	})

	it('case 155: the `bin` target exists after a build', (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const target = manifest.bin['eval-quality'] as string
		expect(existsSync(join(repoRoot, target))).toBe(true)
	})

	it('case 156: `VERSION` equals the manifest version', async (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		expect((await publishedBarrel()).VERSION).toBe(manifest.version)
	})

	it('case 157: the packed tarball carries exactly the published roots', {
		timeout: 120_000,
	}, (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const output = execFileSync(
			'npm',
			['pack', '--dry-run', '--ignore-scripts', '--json'],
			{ cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
		)
		const [packed] = JSON.parse(output) as [
			{ readonly files: readonly { readonly path: string }[] },
		]
		const roots = new Set(
			packed.files.map((file) => file.path.split('/')[0] as string),
		)
		expect([...roots].sort()).toEqual([
			'LICENSE',
			'README.md',
			'corpus',
			'dist',
			'package.json',
			'schemas',
		])
	})

	it('case 158: the corpus README resolves and a missing schema does not', () => {
		expect(resolveSubpath('eval-quality/corpus/dev/README.md')).toBe(
			join(repoRoot, 'corpus/dev/README.md'),
		)
		let thrown: NodeJS.ErrnoException | undefined
		try {
			resolveSubpath('eval-quality/schemas/NOPE.json')
		} catch (error) {
			thrown = error as NodeJS.ErrnoException
		}
		expect(thrown?.code).toBe('MODULE_NOT_FOUND')
	})
})
