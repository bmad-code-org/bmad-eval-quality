/**
 * AD-15's package-boundary scanner (Story 6.5, AC 17 cases 121 through 144,
 * plus 169 through 171). Twelve synthetic maps proving each pattern fires,
 * twelve near-misses proving none of them over-fires, the wrapped-comment
 * join, the one-violation-per-logical-line report shape, and the real tree
 * through the gate itself. Case numbering follows AC 14's table, so case 121
 * is pattern 1 and case 132 is pattern 1's near-miss.
 *
 * **The numbering is append-only.** AC 17 gives this file the range
 * `2 x patterns + 2` and says a twelfth pattern shifts every range after it.
 * The invariant still holds on the count: twelve patterns make twenty-six
 * cases, and the `break` case brings the file to twenty-seven. The numbers
 * themselves stay put. Pattern 12 is cases 169 and 170, the `break` case is
 * 171, and cases 121 through 144 keep the numbers they have, because
 * renumbering three test files and every citation in a 2150-line story buys a
 * reader nothing. Cases 167 and 168 are already taken by
 * `tests/cli/main.test.ts`. New cases sit beside their siblings here, so the
 * read order still follows the pattern order even where the numbers jump.
 *
 * On precedence, AC 14 says the patterns are "ordered as numbered and the
 * first match wins, because `bmad` otherwise shadows `_bmad-output`". The two
 * clauses contradict each other: under the table's numbering `bmad` is
 * pattern 1, so it matches every `_bmad-output` string before pattern 3 is
 * reached and pattern 3 can never fire. `BOUNDARY_PATTERNS` settles it the way
 * the sentence's stated reason requires, by ordering the five specific
 * spellings (`_bmad-output`, `planning-artifact`, `implementation-artifact`,
 * `sprint-status`, `ARCHITECTURE-SPINE.md`) ahead of the bare `bmad` word so
 * every pattern is reachable. Case 123 asserts that order; the cases below
 * expect the implementation's precedence, not the table's numbering.
 *
 * Each firing case was verified by neutralising its own pattern and watching
 * the case go red; each near-miss was verified by widening its pattern and
 * watching the near-miss go red.
 */
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'
import {
	BOUNDARY_PATTERNS,
	scanPackageBoundary,
} from '../../scripts/package-boundary.ts'

const execFileAsync = promisify(execFile)

const FILE = 'src/core/compile/alpha.ts'

const scan = (source: string) => scanPackageBoundary(new Map([[FILE, source]]))

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

	// The case the story's precedence sentence makes unreachable and the
	// implementation makes reachable. Under the table's numbering this line
	// would be reported as `bmad`.
	it('case 123: _bmad-output fires under its own name, ahead of the bmad word', () => {
		expect(scan("const dir = '_bmad-output/prd.md'\n")).toEqual([
			violation(1, '_bmad-output', "const dir = '_bmad-output/prd.md'"),
		])
		const order = BOUNDARY_PATTERNS.map((pattern) => pattern.name)
		expect(order.indexOf('_bmad-output')).toBeLessThan(order.indexOf('bmad'))
	})

	// Either separator: the prose spelling is as much a reference to the
	// planning tree as the path spelling, and the pattern used to require the
	// hyphen, so `the planning artifact` walked straight past it.
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

	// The widening AC 14 argues for: the bare word with no digit behind it, and
	// the plural.
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

	// The three numbered patterns each admit a plural `s`, either separator,
	// and any case. Patterns 6 and 7 already carried `/i`; these three did not,
	// so a lower-cased sentence was a hole in all three.
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

	// Pattern 12, added after a grep of the unpacked tarball found
	// `ARCHITECTURE-SPINE.md` at four sites under `src/` and five more in
	// `dist/`, every one of them pointing at a file the tarball does not carry:
	// `files` publishes `dist`, `schemas`, `corpus`, `README.md`, `LICENSE`.
	// Same class as patterns 3, 4, and 5, and the other eleven all miss it.
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
	// `bmad` is a literal substring with no boundary of its own, so the guard
	// is the leading `b`: widened to `mad` this line is reported.
	it('case 132: bmad does not fire on nomad', () => {
		expect(scan("const mode = 'nomad'\n")).toEqual([])
	})

	// The word boundary and the case: `\bTEA\b` widened to `/tea/i` reports it.
	it('case 133: TEA does not fire on teardown', () => {
		expect(scan("const hook = 'teardown'\n")).toEqual([])
	})

	// A leading-underscore output directory that is not the planning tree.
	it('case 134: _bmad-output does not fire on _build-output', () => {
		expect(scan("const dir = '_build-output/dist'\n")).toEqual([])
	})

	// `plan` is this repository's own vocabulary and has to stay legal; the
	// pattern is the hyphenated compound, so widening it to `plan` reports the
	// plan index.
	it('case 135: planning-artifact does not fire on buildPlanIndex', () => {
		expect(scan('const index = buildPlanIndex(rows)\n')).toEqual([])
	})

	// The other half of the same compound: `artifact` is a domain noun here,
	// and widening the pattern to it reports every seal call.
	it('case 136: implementation-artifact does not fire on sealArtifact', () => {
		expect(scan('const sealed = sealArtifact(brief)\n')).toEqual([])
	})

	it('case 137: story does not fire on history', () => {
		expect(scan("const log = 'history'\n")).toEqual([])
	})

	it('case 138: epic does not fire on epicenter', () => {
		expect(scan("const point = 'epicenter'\n")).toEqual([])
	})

	// `status` is a verdict field name; the pattern is the tracking file's
	// hyphenated name.
	it('case 139: sprint-status does not fire on a status field', () => {
		expect(scan('const state = verdict.status\n')).toEqual([])
	})

	// The word boundary, against the crypto vocabulary a digest repository
	// carries: `HMAC 256` is reported the moment `\b` comes off `\bAC \d`.
	it('case 140: AC n does not fire on HMAC 256', () => {
		expect(scan("const alg = 'HMAC 256'\n")).toEqual([])
	})

	// Pattern 10 is numbered where patterns 6 and 7 are bare words. Giving
	// `Task` the bare-word treatment reports this queue.
	it('case 141: Task n does not fire on a task queue', () => {
		expect(scan("const label = 'task queue'\n")).toEqual([])
	})

	// The exemption: an ADR is a published decision record with an identifier a
	// reader outside this repository can resolve. It survives the widening, so
	// the plural and the lower-cased spelling are exempt behind an ADR too.
	it('case 142: Decision n does not fire on an ADR-nnn citation', () => {
		expect(scan("const cite = 'ADR-004 Decision 2'\n")).toEqual([])
		expect(scan("const cite = 'ADR-009 decision 2'\n")).toEqual([])
	})

	// The pattern is the spine's filename, not the word: `docs/ARCHITECTURE.md`
	// is a published document a consumer can follow. Widening pattern 12 to
	// `/ARCHITECTURE/` reports this line.
	it('case 170: ARCHITECTURE-SPINE.md does not fire on a plain ARCHITECTURE.md', () => {
		expect(scan("const doc = 'docs/ARCHITECTURE.md'\n")).toEqual([])
	})
})

describe('the package-boundary scanner: the join and the real tree', () => {
	// JSDoc here wraps at about eighty columns, so `Story` and `1.5` land on
	// separate physical lines. The run is matched once and attributed to its
	// first line, which is the `/**` at line 2 and not the `Story` at line 3.
	it('case 143: a wrapped comment run joins and is reported at the first line of the run', () => {
		expect(
			scan('const before = 1\n/**\n * Story\n * 1.5 is the reference\n */\n'),
		).toEqual([violation(2, 'story', 'Story 1.5 is the reference')])
		expect(
			scan('const before = 1\n// Story\n// 1.5 is the reference\n'),
		).toEqual([violation(2, 'story', 'Story 1.5 is the reference')])
		// A run wrapped at a hyphen space-joins to `planning- artifact`, which no
		// pattern matches. Each pattern is therefore tried against the empty join
		// as well, and the space join is still what gets reported.
		expect(scan('// the planning-\n// artifact tree\n')).toEqual([
			violation(1, 'planning-artifact', 'the planning- artifact tree'),
		])
	})

	// AC 14 says one violation is reported per logical line, and the `break` in
	// `scanPackageBoundary` is what delivers it. AC 14 also calls the output
	// "file-line-pattern records", which reads as though a line could produce
	// one record per matching pattern; it cannot, and this case pins the
	// reading so removing the `break` fails here rather than quietly changing
	// the shape of the report.
	it('case 171: a logical line matching two patterns reports only the first in precedence', () => {
		const line = "const dir = '_bmad-output/stories/6-5.md'"
		expect(scan(`${line}\n`)).toEqual([violation(1, '_bmad-output', line)])
	})

	// Runs the gate as a subprocess, because the three sources AC 14 names are
	// assembled inside `check-package-boundary.ts`, whose module-load side
	// effects (running the scan, then `process.exit(1)`) make it unimportable.
	// Spawning it keeps one assembly of `src/`, `corpus/`, and the published
	// `package.json` fields; a second copy here could drift from the gate's.
	it('case 144: the real tree scans clean through the gate', async () => {
		const script = fileURLToPath(
			new URL('../../scripts/check-package-boundary.ts', import.meta.url),
		)
		let stdout: string
		try {
			stdout = (await execFileAsync(process.execPath, [script])).stdout
		} catch (error) {
			const failure = error as { stdout?: string; stderr?: string }
			throw new Error(failure.stderr ?? failure.stdout ?? String(error))
		}
		// The count is asserted against a floor, not against `[1-9]\d*`: a walk
		// that silently scanned four files passed that pattern as readily as one
		// that scanned every file. `src/` alone holds more than ninety `.ts`
		// files, so a collapsed walk fails here.
		const scanned = stdout.match(
			/check:boundary: (\d+) entr\(ies\) scanned under src\/, schemas\/, corpus\/, and package\.json, 0 violations/,
		)
		expect(scanned).not.toBeNull()
		expect(Number((scanned as RegExpMatchArray)[1])).toBeGreaterThanOrEqual(90)
	}, 30_000)
})
