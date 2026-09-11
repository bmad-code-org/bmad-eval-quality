/**
 * AC 17: the published package surface. What `exports` resolves to, what the
 * barrel carries, and what `npm pack` puts in the tarball.
 *
 * The subpath cases resolve through `createRequire(import.meta.url).resolve`
 * against this package by self-reference, which Node grants because
 * `package.json` has an `exports` map. That needs no pack and no install.
 * `import.meta.resolve` is unusable here: it never stats, so
 * `eval-quality/schemas/THIS-DOES-NOT-EXIST.json` resolves happily and proves
 * nothing about what shipped. `createRequire(...).resolve` honours the same
 * map and throws `MODULE_NOT_FOUND` on a target that is not on disk.
 *
 * The `BUILT` constant drives the skip: every case that reads `dist/` guards on
 * it and skips with a clear message when no build has run, the way
 * `tests/cli/main.test.ts` does. Every CI job that runs the suite builds first,
 * so the skip is a local-convenience path and never a silent hole in the gate.
 * Case 157 passes `--ignore-scripts` because `prepack` is
 * `npm run clean && npm run build` and would delete `dist/` out from under the
 * neighbouring cases.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type {
	ComparableResult,
	DominanceRelationValue,
	QualificationFailure,
	QualificationFailureCode,
	QualificationResult,
	Severity,
} from 'eval-quality'
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

	// Resolving the subpath says nothing about what it exports. Every runner
	// below is named in `CHANGELOG.md` and in `docs/reference/cli-commands.md`
	// as shipping on `eval-quality/conformance`, and nothing in this repository
	// imports them through the barrel: both probe subjects and the mutant suite
	// import `src/testing/probe-conformance.ts` directly. Deleting any one of
	// these names from `src/testing/index.ts` left the typecheck, the linter and
	// the whole test suite green.
	it('case 147b: `./conformance` exports every port runner it publishes', async (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const barrel = (await import(
			join(repoRoot, 'dist/testing/index.js')
		)) as Record<string, unknown>
		for (const name of [
			'runClockPortConformance',
			'runCorpusPortConformance',
			'runFileSystemPortConformance',
			'runEnvironmentProbePortConformance',
			'runCommandLineProbeConformance',
			'runMcpProbeConformance',
			'formatConformanceReport',
		]) {
			expect(typeof barrel[name], `${name} is missing from the barrel`).toBe(
				'function',
			)
		}
		expect(barrel.CONFORMANCE_OUTCOME_COUNTS).toEqual({
			corpus: 6,
			clock: 6,
			'file-system': 12,
			'environment-probe': 19,
			'command-probe': 16,
			'mcp-probe': 14,
		})
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

	it('the barrel carries the probe-qualification reason vocabulary', async (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const barrel = await publishedBarrel()
		// The runtime list, so a consumer routing a rejection can write a total
		// table over it.
		expect(barrel.QUALIFICATION_FAILURES).toContain('signature-absent')
		// The types naming what `RunScoreResult.qualification` carries. Erased
		// before runtime, so the layer barrel's text is where they are read.
		const layerTypes = exportedTypeNames(layerBarrelSource)
		for (const name of [
			'QualificationFailure',
			'QualificationFailureCode',
			'QualificationResult',
		]) {
			expect(layerTypes).toContain(name)
		}
		// The same three off the package root, annotated so `npm run typecheck`
		// resolves them through `dist/index.d.ts`. The text check above passes
		// on a layer barrel the root barrel stopped re-exporting; this one does
		// not.
		const code: QualificationFailureCode = 'signature-absent'
		const failure: QualificationFailure = {
			code,
			artifactPath: 'Probe[probeId=P-001].defectSignature',
			detail: 'a defect probe declaring no signature is unscoreable',
		}
		const carried: QualificationResult = {
			qualified: false,
			failures: [failure],
			declarationChecksRan: true,
		}
		expect(carried.failures[0]?.code).toBe('signature-absent')
	})

	it('the barrel carries the schema versions and the dominance comparison', async (ctx) => {
		if (!BUILT) return ctx.skip(NEEDS_BUILD)
		const barrel = await publishedBarrel()
		expect(barrel.PROBE_SCHEMA_VERSION).toBe(5)
		expect(barrel.EVAL_CONTRACT_SCHEMA_VERSION).toBe(5)

		// Each version keeps its literal declared type through
		// `dist/index.d.ts`, so a consumer comparing against one narrows on it.
		// A widened `number` passes the first assignment and fails the second.
		const probeVersion: typeof import('eval-quality').PROBE_SCHEMA_VERSION = 5
		const contractVersion: typeof import('eval-quality').EVAL_CONTRACT_SCHEMA_VERSION = 5
		const probeLiteral: 5 = probeVersion
		const contractLiteral: 5 = contractVersion
		expect([probeLiteral, contractLiteral]).toEqual([
			barrel.PROBE_SCHEMA_VERSION,
			barrel.EVAL_CONTRACT_SCHEMA_VERSION,
		])

		// Each union ships with the `as const` array it is derived from, the way
		// `QUALIFICATION_FAILURES` already does.
		expect(barrel.DOMINANCE_RELATIONS).toEqual([
			'a-dominates-b',
			'b-dominates-a',
			'equivalent',
			'incomparable',
		])
		expect(barrel.SEVERITY_LEVELS).toEqual(['low', 'material', 'critical'])
		const layerTypes = exportedTypeNames(layerBarrelSource)
		for (const name of [
			'ComparableResult',
			'DominanceRelationValue',
			'Severity',
		]) {
			expect(layerTypes).toContain(name)
		}

		// A cast says nothing about what `dist/index.d.ts` declares, so the
		// signature is held by an exactness test first. Mutual assignability
		// leaves a hole: function assignability ignores a trailing optional
		// parameter in both directions, so a declaration carrying an extra
		// `tieBreak?: unknown` typechecked green against the shape below. The
		// conditional-identity form refuses that, and refuses any parameter or
		// return type that stops matching the three types published beside it.
		type Declared = typeof import('eval-quality').compareDominance
		type Expected = (
			a: ComparableResult,
			b: ComparableResult,
			severityFloor: Severity,
		) => DominanceRelationValue
		type Exact<A, B> =
			(<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
				? true
				: false
		const signatureIsExact: Exact<Declared, Expected> = true
		expect(signatureIsExact).toBe(true)

		// `compareDominance` off the built barrel, called through that signature.
		// The two sides share a comparability key and carry no outcome, so the
		// severity-floor override has nothing to withdraw and the raw component
		// comparison is the answer.
		const compare = barrel.compareDominance as Expected
		const side = (caught: number): ComparableResult => ({
			outcomes: [],
			strength: {
				denominator: 'unique qualified probe identifiers exercised',
				basis: 'measured',
				vector: {
					defect: { caught, exercised: 4, rate: caught / 4 },
					gameability: null,
					'zero-action': null,
				},
				comparable: true,
				note: null,
			},
			comparabilityKey: 'one shared probe set',
		})
		const relation = compare(side(4), side(2), 'material')
		expect(barrel.DOMINANCE_RELATIONS).toContain(relation)
		expect(relation).toBe('a-dominates-b')
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
