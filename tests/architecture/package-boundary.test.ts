/**
 * The package-boundary scanner, now a published gate whose rules and scanned
 * set are both consumer data. Three groups: the twelve patterns this repository
 * declares in its own `eval-quality.config.json` (cases 121 through 144, plus
 * 169 through 171, keeping the numbers they had when the patterns were a code
 * array), the bounds the schema puts on a pattern somebody else wrote, and the
 * two consumer fixtures.
 *
 * The numbering is append-only and the ported cases keep their numbers. The
 * cases added here carry none: their numbers would belong to a table in another
 * story, and renumbering twenty-seven cases and every citation to them buys a
 * reader nothing.
 *
 * On precedence, the array is ordered and the first match on a logical line
 * wins, so the five specific spellings (`_bmad-output`, `planning-artifact`,
 * `implementation-artifact`, `sprint-status`, `ARCHITECTURE-SPINE.md`) sit ahead
 * of the bare `bmad` word, which is a substring of the first of them. Case 123
 * asserts that order against the configuration, so a reordered configuration
 * fails here rather than silently reporting every planning path under the wrong
 * name.
 *
 * Each firing case was verified by neutralising its own pattern and watching the
 * case go red; each near-miss by widening its pattern and watching the near-miss
 * go red.
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
	compileBoundaryPatterns,
	MAX_SCANNED_LINE,
	OVERLONG_LINE,
	PackageBoundarySection,
	runPackageBoundary,
	scanPackageBoundary,
} from '../../scripts/package-boundary.ts'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const fixtures = fileURLToPath(
	new URL('../../scripts/fixtures/consumer/', import.meta.url),
)

const sectionAt = async (root: string) => {
	const document = JSON.parse(
		await readFile(`${root}eval-quality.config.json`, 'utf8'),
	) as Record<string, unknown>
	return PackageBoundarySection.parse(document['package-boundary'])
}

/** This repository's own declaration, read the way any consumer's is read. */
const ours = await sectionAt(repoRoot)
const ourPatterns = compileBoundaryPatterns(ours.patterns)

const FILE = 'src/core/compile/alpha.ts'

/** Without the reason, which every case would otherwise restate from the file. */
const scan = (source: string) =>
	scanPackageBoundary(new Map([[FILE, source]]), ourPatterns).map(
		({ file, line, pattern, text }) => ({ file, line, pattern, text }),
	)

const violation = (line: number, pattern: string, text: string) => ({
	file: FILE,
	line,
	pattern,
	text,
})

describe('the package-boundary scanner: the twelve patterns fire', () => {
	it('case 121: the bmad word fires, in any case', () => {
		expect(scan("const tool = 'BMad'\n")).toEqual([
			violation(1, 'bmad', "const tool = 'BMad'"),
		])
	})

	it('case 122: the TEA word fires', () => {
		expect(scan("const owner = 'TEA'\n")).toEqual([
			violation(1, 'TEA', "const owner = 'TEA'"),
		])
	})

	it('case 123: _bmad-output fires under its own name, ahead of the bmad word', () => {
		expect(scan("const dir = '_bmad-output/prd.md'\n")).toEqual([
			violation(1, '_bmad-output', "const dir = '_bmad-output/prd.md'"),
		])
		const order = ours.patterns.map((pattern) => pattern.name)
		expect(order.indexOf('_bmad-output')).toBeLessThan(order.indexOf('bmad'))
	})

	it('case 124: planning-artifact fires, hyphenated and spaced', () => {
		expect(scan("const dir = 'planning-artifacts/prd.md'\n")).toEqual([
			violation(
				1,
				'planning-artifact',
				"const dir = 'planning-artifacts/prd.md'",
			),
		])
		expect(scan('// the planning artifact this reads\n')).toEqual([
			violation(1, 'planning-artifact', 'the planning artifact this reads'),
		])
	})

	it('case 125: implementation-artifact fires, hyphenated and spaced', () => {
		expect(scan("const dir = 'implementation-artifacts/6-5.md'\n")).toEqual([
			violation(
				1,
				'implementation-artifact',
				"const dir = 'implementation-artifacts/6-5.md'",
			),
		])
		expect(scan('// the implementation artifact it came from\n')).toEqual([
			violation(
				1,
				'implementation-artifact',
				'the implementation artifact it came from',
			),
		])
	})

	it('case 126: the story word fires with no digit, singular and plural', () => {
		expect(scan("const a = 'Story'\nconst b = 'stories'\n")).toEqual([
			violation(1, 'story', "const a = 'Story'"),
			violation(2, 'story', "const b = 'stories'"),
		])
	})

	it('case 127: the epic word fires with no digit, singular and plural', () => {
		expect(scan("const a = 'epic'\nconst b = 'Epics'\n")).toEqual([
			violation(1, 'epic', "const a = 'epic'"),
			violation(2, 'epic', "const b = 'Epics'"),
		])
	})

	it('case 128: sprint-status fires, hyphenated and spaced', () => {
		expect(scan("const file = 'sprint-status.yaml'\n")).toEqual([
			violation(1, 'sprint-status', "const file = 'sprint-status.yaml'"),
		])
		expect(scan('// what the sprint status file records\n')).toEqual([
			violation(1, 'sprint-status', 'what the sprint status file records'),
		])
	})

	it('case 129: an AC number fires, plural, hyphenated, and lower-cased', () => {
		expect(scan("const ref = 'AC 14'\n")).toEqual([
			violation(1, 'AC n', "const ref = 'AC 14'"),
		])
		expect(scan('// ac 8\n')).toEqual([violation(1, 'AC n', 'ac 8')])
		expect(scan('// ACs 8\n')).toEqual([violation(1, 'AC n', 'ACs 8')])
		expect(scan('// AC-8\n')).toEqual([violation(1, 'AC n', 'AC-8')])
	})

	it('case 130: a Task number fires, plural, hyphenated, and lower-cased', () => {
		expect(scan("const ref = 'Task 9'\n")).toEqual([
			violation(1, 'Task n', "const ref = 'Task 9'"),
		])
		expect(scan('// task 6\n')).toEqual([violation(1, 'Task n', 'task 6')])
		expect(scan('// Tasks 6\n')).toEqual([violation(1, 'Task n', 'Tasks 6')])
		expect(scan('// Task-6\n')).toEqual([violation(1, 'Task n', 'Task-6')])
	})

	it('case 131: a bare Decision number fires, plural, hyphenated, and lower-cased', () => {
		expect(scan("const ref = 'Decision 11'\n")).toEqual([
			violation(1, 'Decision n', "const ref = 'Decision 11'"),
		])
		expect(scan('// decision 4\n')).toEqual([
			violation(1, 'Decision n', 'decision 4'),
		])
		expect(scan('// Decisions 4\n')).toEqual([
			violation(1, 'Decision n', 'Decisions 4'),
		])
		expect(scan('// Decision-4\n')).toEqual([
			violation(1, 'Decision n', 'Decision-4'),
		])
	})

	it('case 169: an ARCHITECTURE-SPINE.md citation fires', () => {
		expect(scan(' * a rule (ARCHITECTURE-SPINE.md:191).\n')).toEqual([
			violation(
				1,
				'ARCHITECTURE-SPINE.md',
				'a rule (ARCHITECTURE-SPINE.md:191).',
			),
		])
	})
})

describe('the package-boundary scanner: the twelve near-misses', () => {
	it('case 132: bmad does not fire on nomad', () => {
		expect(scan("const mode = 'nomad'\n")).toEqual([])
	})

	it('case 133: TEA does not fire on teardown', () => {
		expect(scan("const hook = 'teardown'\n")).toEqual([])
	})

	it('case 134: _bmad-output does not fire on _build-output', () => {
		expect(scan("const dir = '_build-output/dist'\n")).toEqual([])
	})

	it('case 135: planning-artifact does not fire on buildPlanIndex', () => {
		expect(scan('const index = buildPlanIndex(rows)\n')).toEqual([])
	})

	it('case 136: implementation-artifact does not fire on sealArtifact', () => {
		expect(scan('const sealed = sealArtifact(brief)\n')).toEqual([])
	})

	it('case 137: story does not fire on history', () => {
		expect(scan("const log = 'history'\n")).toEqual([])
	})

	it('case 138: epic does not fire on epicenter', () => {
		expect(scan("const point = 'epicenter'\n")).toEqual([])
	})

	it('case 139: sprint-status does not fire on a status field', () => {
		expect(scan('const state = verdict.status\n')).toEqual([])
	})

	it('case 140: AC n does not fire on HMAC 256', () => {
		expect(scan("const alg = 'HMAC 256'\n")).toEqual([])
	})

	it('case 141: Task n does not fire on a task queue', () => {
		expect(scan("const label = 'task queue'\n")).toEqual([])
	})

	it('case 142: Decision n does not fire on an ADR-nnn citation', () => {
		expect(scan("const cite = 'ADR-004 Decision 2'\n")).toEqual([])
		expect(scan("const cite = 'ADR-009 decision 2'\n")).toEqual([])
	})

	it('case 170: ARCHITECTURE-SPINE.md does not fire on a plain ARCHITECTURE.md', () => {
		expect(scan("const doc = 'docs/ARCHITECTURE.md'\n")).toEqual([])
	})
})

describe('the package-boundary scanner: the join and the report shape', () => {
	it('case 143: a wrapped comment run joins and is reported at the first line of the run', () => {
		expect(
			scan('const before = 1\n/**\n * Story\n * 1.5 is the reference\n */\n'),
		).toEqual([violation(2, 'story', 'Story 1.5 is the reference')])
		expect(
			scan('const before = 1\n// Story\n// 1.5 is the reference\n'),
		).toEqual([violation(2, 'story', 'Story 1.5 is the reference')])
		expect(scan('// the planning-\n// artifact tree\n')).toEqual([
			violation(1, 'planning-artifact', 'the planning- artifact tree'),
		])
	})

	it('case 171: a logical line matching two patterns reports only the first in precedence', () => {
		const line = "const dir = '_bmad-output/stories/6-5.md'"
		expect(scan(`${line}\n`)).toEqual([violation(1, '_bmad-output', line)])
	})

	// The input-side bound. Reported rather than skipped, because a line nobody
	// matched is a line nobody held, and the whole value of the bound would go
	// into buying a silent pass.
	it('reports a logical line past the matching bound instead of skipping it', () => {
		const long = `const blob = '${'a'.repeat(MAX_SCANNED_LINE)}'`
		const found = scan(`${long}\n`)
		expect(found).toHaveLength(1)
		expect(found[0]?.pattern).toBe(OVERLONG_LINE)
		expect(found[0]?.text.length).toBeLessThan(200)
	})
})

describe('the bounds on a pattern somebody else wrote', () => {
	const withPatterns = (patterns: unknown) =>
		PackageBoundarySection.safeParse({
			paths: [{ path: 'src' }],
			patterns,
		})

	const message = (result: ReturnType<typeof withPatterns>): string =>
		result.success ? '' : result.error.issues.map((i) => i.message).join(' ')

	it('refuses a global or sticky flag', () => {
		for (const flags of ['g', 'y', 'gi']) {
			const result = withPatterns([
				{ name: 'x', match: 'abc', flags, reason: 'why' },
			])
			expect(result.success).toBe(false)
			expect(message(result)).toContain('admits only')
		}
	})

	it('refuses a backreference', () => {
		const result = withPatterns([
			{ name: 'x', match: '(a+)\\1', reason: 'why' },
		])
		expect(result.success).toBe(false)
		expect(message(result)).toContain('backreference')
	})

	it('refuses a pattern that does not compile, and one past the length bound', () => {
		expect(
			withPatterns([{ name: 'x', match: '(', reason: 'why' }]).success,
		).toBe(false)
		expect(
			withPatterns([{ name: 'x', match: 'a'.repeat(400), reason: 'why' }])
				.success,
		).toBe(false)
	})

	it('refuses a repeated name and the reserved one', () => {
		const repeated = withPatterns([
			{ name: 'x', match: 'a', reason: 'why' },
			{ name: 'x', match: 'b', reason: 'why' },
		])
		expect(repeated.success).toBe(false)
		expect(message(repeated)).toContain('repeats')
		const reserved = withPatterns([
			{ name: OVERLONG_LINE, match: 'a', reason: 'why' },
		])
		expect(reserved.success).toBe(false)
		expect(message(reserved)).toContain('reserved')
	})

	it('refuses a path that escapes the configuration file', () => {
		for (const path of ['../elsewhere', '/etc', 'a/../../b']) {
			const result = PackageBoundarySection.safeParse({
				paths: [{ path }],
				patterns: [{ name: 'x', match: 'a', reason: 'why' }],
			})
			expect(result.success).toBe(false)
		}
	})

	it('refuses a key the format does not have', () => {
		const result = PackageBoundarySection.safeParse({
			paths: [{ path: 'src' }],
			patterns: [{ name: 'x', match: 'a', reason: 'why' }],
			exemptions: ['README.md'],
		})
		expect(result.success).toBe(false)
	})
})

describe('the consumer fixtures', () => {
	it('passes the compliant tree', async () => {
		const dir = `${fixtures}boundary-compliant/`
		const report = await runPackageBoundary(dir, await sectionAt(dir))
		expect(report.violations).toEqual([])
		// Two sources: the declared path and the manifest fields. A single total
		// reads the same whether the manifest contributed four entries or none.
		expect(report.counts.map((count) => count.files)).toEqual([2, 4])
	})

	it('fails the seeded tree on all three of its own patterns', async () => {
		const dir = `${fixtures}boundary-seeded/`
		const report = await runPackageBoundary(dir, await sectionAt(dir))
		expect([...report.violations].map((each) => each.pattern).sort()).toEqual([
			'build-machine-path',
			'internal-tracker',
			'unpublished-path',
			'unpublished-path',
		])
	})

	// The recall test, and the reason the seed was worded the way it was. The
	// seeded tree carries three real defects of this gate's class: a comment
	// pointing at a directory the published file list does not carry, an absolute
	// path from the build machine, and an issue identifier nobody outside the
	// team can resolve. This repository's twelve patterns name a process
	// vocabulary and have no word for any of them, so under those twelve the
	// seeded tree is clean. The gate only reaches the defect once the rules are
	// the consumer's to write, which is what publishing it is for.
	it("scans the seeded tree clean under this repository's own twelve patterns", async () => {
		const dir = `${fixtures}boundary-seeded/`
		const seeded = await sectionAt(dir)
		const report = await runPackageBoundary(dir, {
			...seeded,
			patterns: ours.patterns,
		})
		expect(report.violations).toEqual([])
	})
})

describe('the real tree', () => {
	// Through the published entry point rather than a subprocess, so the gate a
	// consumer calls is the one this repository holds itself with.
	it('case 144: scans clean, over every source this repository declares', async () => {
		const report = await runPackageBoundary(repoRoot, ours)
		expect(report.violations).toEqual([])
		// A floor rather than "more than zero": a walk that silently scanned four
		// files passes the weaker assertion as readily as one that scanned
		// everything. `src/` alone holds more than ninety `.ts` files.
		expect(report.scanned).toBeGreaterThanOrEqual(90)
	}, 30_000)
})
