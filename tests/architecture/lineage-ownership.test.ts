/**
 * AD-29's ownership scanner (Story 6.4, AC 11 cases 41 through 51). Synthetic
 * source maps for the rules, one real-tree scan at the end, the same shape
 * `dependency-direction.test.ts` uses.
 */
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { discoverSourceFiles } from '../../scripts/discover-source-files.ts'
import { scanLineageWrites } from '../../scripts/lineage-ownership.ts'

const SEAL = 'src/core/seal/seal.ts'
const REDUCE = 'src/core/preflight/reduce.ts'
const EMIT = 'src/core/emit/emit.ts'
// A synthetic, never-allowlisted path standing in for "anywhere else". Not
// `src/core/emit/emit.ts`: that module became a real named writer in Story
// 8.3, so a fixture standing in for "not a writer" cannot use its path.
const OTHER = 'src/core/emit/not-a-writer.ts'

/** both fields written as object-literal properties, the form the tree uses. */
const BOTH_WRITES =
	'const a = {\n\tparentDigest: null,\n\trevisionCount: 0,\n}\n'

const synthetic = (files: Record<string, string>) =>
	scanLineageWrites(new Map(Object.entries(files)), { wholeTree: false })

const subjects = (files: Record<string, string>) =>
	synthetic(files)
		.map((each) => each.subject)
		.sort()

describe('the lineage-ownership scanner', () => {
	// 41
	it('permits a write in core/schemas, in core/lineage, and in a named writer', () => {
		expect(
			synthetic({
				'src/core/schemas/lineage.ts': BOTH_WRITES,
				'src/core/lineage/chain.ts': BOTH_WRITES,
				[SEAL]: BOTH_WRITES,
			}),
		).toEqual([])
	})

	// 42
	it('reports a write anywhere else, naming the field and the line', () => {
		const violations = synthetic({ [OTHER]: `const x = 1\n${BOTH_WRITES}` })
		expect(violations).toHaveLength(2)
		expect(violations.map((each) => each.subject).sort()).toEqual([
			'parentDigest',
			'revisionCount',
		])
		expect(violations[0]?.file).toBe(OTHER)
		expect(violations[0]?.line).toBe(3)
	})

	// 43
	it('reports a named writer that writes one field, or neither', () => {
		const one = synthetic({ [SEAL]: 'const a = { parentDigest: null }\n' })
		expect(one).toHaveLength(1)
		expect(one[0]?.subject).toBe('revisionCount')

		const none = synthetic({ [SEAL]: 'export const seal = () => 1\n' })
		expect(none).toHaveLength(2)

		// Four shapes that name both fields and mint neither, so none of them
		// stands in for the write the table says this module owes.
		const owed = (source: string) =>
			synthetic({ [SEAL]: source })
				.filter((each) => each.rule.includes('writes none'))
				.map((each) => each.subject)
				.sort()
		const both = ['parentDigest', 'revisionCount']
		expect(
			owed(
				'function lineageOf(x: { parentDigest: string | null; revisionCount: number }) {\n\treturn x\n}\n',
			),
		).toEqual(both)
		expect(
			owed('export function seal({ parentDigest, revisionCount }) {}\n'),
		).toEqual(both)
		expect(
			owed(
				'function f(rows: Array<{ parentDigest: string, revisionCount: number }>) {}\n',
			),
		).toEqual(both)
		expect(
			owed(
				'function g<T extends { parentDigest: string, revisionCount: number }>(x: T) {}\n',
			),
		).toEqual(both)
		// The same four under names no denylist of type keywords would catch,
		// and under this repository's own parameter wrapping.
		expect(
			owed(
				'function f(x: Array<{ parentDigest: null, revisionCount: 0 }>) {}\n',
			),
		).toEqual(both)
		expect(
			owed(
				'function f(x: Array<{ parentDigest: Digest, revisionCount: Natural }>) {}\n',
			),
		).toEqual(both)
		expect(
			owed(
				'export function seal(\n\tbrief: { parentDigest: Digest | null; revisionCount: Natural },\n) {}\n',
			),
		).toEqual(both)
	})

	// 44
	it('reports an allowlist entry with no file, on a whole-tree scan only', () => {
		// `EMIT` supplies a file so only `REDUCE` is genuinely missing from the
		// three-member allowlist.
		const files = new Map([
			[SEAL, BOTH_WRITES],
			[EMIT, BOTH_WRITES],
		])
		expect(scanLineageWrites(files, { wholeTree: false })).toEqual([])
		const whole = scanLineageWrites(files, { wholeTree: true })
		expect(whole).toHaveLength(1)
		expect(whole[0]?.file).toBe(REDUCE)
		expect(whole[0]?.rule).toContain('no such file exists')
	})

	// 45. Without this rule the one supported way to set the fields is the one
	// way the scanner cannot see.
	it('reports reviseArtifact whether it is called, imported, or aliased', () => {
		expect(
			subjects({ [OTHER]: 'const n = reviseArtifact(p, b, x)\n' }),
		).toEqual(['reviseArtifact'])
		expect(
			subjects({
				[OTHER]:
					"import { reviseArtifact as mint } from '../lineage/chain.ts'\n",
			}),
		).toEqual(['reviseArtifact'])
	})

	// 46
	it('reports every assignment form and the shorthand', () => {
		expect(subjects({ [OTHER]: 'record.parentDigest = digest\n' })).toEqual([
			'parentDigest',
		])
		expect(subjects({ [OTHER]: 'record.parentDigest ??= digest\n' })).toEqual([
			'parentDigest',
		])
		expect(subjects({ [OTHER]: 'record.revisionCount += 1\n' })).toEqual([
			'revisionCount',
		])
		expect(subjects({ [OTHER]: 'const o = { revisionCount }\n' })).toEqual([
			'revisionCount',
		])
	})

	// 47. A computed key, a bracket assignment, `Object.defineProperty`, and
	// `Reflect.set` all reach the field through a string and are one shape here.
	// A backtick-quoted key is the same route.
	it('reports a lineage field named as a string', () => {
		expect(
			subjects({ [OTHER]: 'const o = { ["parentDigest"]: d }\n' }),
		).toEqual(['parentDigest'])
		expect(subjects({ [OTHER]: 'o["revisionCount"] = 1\n' })).toEqual([
			'revisionCount',
		])
		expect(
			subjects({
				[OTHER]: 'Object.defineProperty(o, "parentDigest", { value: d })\n',
			}),
		).toEqual(['parentDigest'])
		expect(subjects({ [OTHER]: 'o[`parentDigest`] = d\n' })).toEqual([
			'parentDigest',
		])
		expect(
			subjects({ [OTHER]: 'Reflect.set(o, "revisionCount", 1)\n' }),
		).toEqual(['revisionCount'])
	})

	// 48. The scanner passes over a read and reports a type alias.
	it('separates a read from a declaration', () => {
		expect(
			subjects({
				[OTHER]:
					'const n = parent.revisionCount + 1\nconst o = { a: parent.parentDigest }\nconst { parentDigest, revisionCount } = artifact\nfunction f(parentDigest: string) {}\n',
			}),
		).toEqual([])
		// A name bound by a destructuring and used later, which is how `emit`
		// will read the two fields to serialize them.
		expect(
			subjects({
				[OTHER]:
					'function s(a) {\n\tconst { parentDigest, revisionCount } = a\n\tif (parentDigest === null) return revisionCount\n\treturn revisionCount\n}\n',
			}),
		).toEqual([])
		expect(
			subjects({ [OTHER]: "import { revisionCount } from './x.ts'\n" }),
		).toEqual([])
		expect(
			subjects({ [OTHER]: 'type Row = { revisionCount: number }\n' }),
		).toEqual(['revisionCount'])
		// The formats this repository's own formatter writes: members separated
		// by a line break, often behind `readonly`.
		expect(
			subjects({
				[OTHER]:
					'type Row = {\n\treadonly parentDigest: string | null\n\treadonly revisionCount: number\n}\n',
			}),
		).toEqual(['parentDigest', 'revisionCount'])
		expect(
			subjects({
				[OTHER]:
					'interface Row {\n\tparentDigest: string | null\n\trevisionCount: number\n}\n',
			}),
		).toEqual(['parentDigest', 'revisionCount'])
		// A variable's own annotation is a type position, and the name before
		// its colon is a binding rather than a member.
		expect(
			synthetic({ [OTHER]: 'const a: { parentDigest: string } = x\n' }).map(
				(each) => each.rule.includes('type position'),
			),
		).toEqual([true])
		// A destructured parameter carries no marker separating it from an
		// object literal argument, so it stays reported.
		expect(
			subjects({
				[OTHER]: 'const f = ({ parentDigest }: L) => parentDigest\n',
			}),
		).toEqual(['parentDigest'])
	})

	// 50. A `{` after a colon is a type annotation, unless the name before that
	// colon is itself a member. Without the second half a writer module nesting
	// its two fields under a sub-object would fail its own gate.
	it('reads a nested value literal as a value', () => {
		const nested =
			'const brief = {\n\tlineage: { parentDigest: null, revisionCount: 0 },\n}\n'
		expect(subjects({ [OTHER]: nested })).toEqual([
			'parentDigest',
			'revisionCount',
		])
		expect(
			synthetic({
				[SEAL]: nested,
				[REDUCE]: 'const b = { parentDigest: null, revisionCount: 0 }\n',
			}),
		).toEqual([])
		// A ternary's middle arm also sits before a colon, and its right arm is
		// a value.
		for (const ternary of [
			'const brief = flag ? base : { parentDigest: null, revisionCount: 0 }\n',
			'const brief = flag\n\t? base\n\t: { parentDigest: null, revisionCount: 0 }\n',
		]) {
			expect(subjects({ [OTHER]: ternary })).toEqual([
				'parentDigest',
				'revisionCount',
			])
			expect(
				synthetic({ [OTHER]: ternary }).every((each) =>
					each.rule.includes('literal position'),
				),
			).toBe(true)
		}
	})

	// 51. The bounded backward walk gives up and reports, which is the stated
	// fail-closed fallback and the only branch a long parameter list reaches.
	it('reports a field it cannot place within the lookback window', () => {
		const filler = Array.from({ length: 400 }, (_, i) => `a${i}: number`).join(
			', ',
		)
		expect(
			subjects({
				[OTHER]: `function wide(${filler}, parentDigest: string) {}\n`,
			}),
		).toEqual(['parentDigest'])
	})

	// 49
	it('finds nothing in the real tree', async () => {
		const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
		const files = await discoverSourceFiles(repoRoot)
		expect(scanLineageWrites(files, { wholeTree: true })).toEqual([])
	})
})
