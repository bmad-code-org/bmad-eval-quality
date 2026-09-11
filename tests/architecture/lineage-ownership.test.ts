/**
 * The field-ownership scanner, now a published gate whose fields, declaration
 * prefixes, writer list and helper names are all consumer data. Cases 41
 * through 51 are the rules, ported from when those four were literals; the
 * cases added here hold the schema, the dependency refusal, the drift between
 * this repository's configured writer list and the table it is derived from,
 * and the two consumer fixtures.
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
	FieldOwnershipSection,
	loadTokenScanner,
	rulesOf,
	runFieldOwnership,
	scanFieldOwnership,
	TYPESCRIPT_UNAVAILABLE,
} from '../../scripts/lineage-ownership.ts'
import { LINEAGE_WRITER_MODULES } from '../../src/core/lineage/stage-table.ts'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const fixtures = fileURLToPath(
	new URL('../../scripts/fixtures/consumer/', import.meta.url),
)

const sectionAt = async (root: string) => {
	const document = JSON.parse(
		await readFile(`${root}eval-quality.config.json`, 'utf8'),
	) as Record<string, unknown>
	return FieldOwnershipSection.parse(document['field-ownership'])
}

const ours = await sectionAt(repoRoot)
const ourRules = rulesOf(ours)
const scanner = await loadTokenScanner('field-ownership')

const SEAL = 'src/core/seal/seal.ts'
const REDUCE = 'src/core/preflight/reduce.ts'
const EMIT = 'src/core/emit/emit.ts'
// A synthetic, never-declared path standing in for "anywhere else".
const OTHER = 'src/core/emit/not-a-writer.ts'

/** both fields written as object-literal properties, the form the tree uses. */
const BOTH_WRITES =
	'const a = {\n\tparentDigest: null,\n\trevisionCount: 0,\n}\n'

const synthetic = (files: Record<string, string>) =>
	scanFieldOwnership(new Map(Object.entries(files)), ourRules, scanner, {
		wholeTree: false,
	})

const subjects = (files: Record<string, string>) =>
	synthetic(files)
		.map((each) => each.subject)
		.sort()

describe('the field-ownership scanner', () => {
	// 41
	it('permits a write in a declared path and in a declared writer', () => {
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
	it('reports a declared writer that writes one field, or neither', () => {
		const one = synthetic({ [SEAL]: 'const a = { parentDigest: null }\n' })
		expect(one).toHaveLength(1)
		expect(one[0]?.subject).toBe('revisionCount')

		const none = synthetic({ [SEAL]: 'export const seal = () => 1\n' })
		expect(none).toHaveLength(2)

		// Four shapes that name both fields and mint neither, so none of them
		// stands in for the write the configuration says this module owes.
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
		// The same four under names no denylist of type keywords would catch, and
		// under this repository's own parameter wrapping.
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
	it('reports a writer entry with no file, on a whole-tree scan only', () => {
		// `EMIT` supplies a file so only `REDUCE` is genuinely missing from the
		// three-member writer list.
		const files = new Map([
			[SEAL, BOTH_WRITES],
			[EMIT, BOTH_WRITES],
		])
		const options = { wholeTree: false }
		expect(scanFieldOwnership(files, ourRules, scanner, options)).toEqual([])
		const whole = scanFieldOwnership(files, ourRules, scanner, {
			wholeTree: true,
		})
		expect(whole).toHaveLength(1)
		expect(whole[0]?.file).toBe(REDUCE)
		expect(whole[0]?.rule).toContain('no such file was scanned')
	})

	// 45. Without this rule the one supported way to set the fields is the one
	// way the scanner cannot see.
	it('reports a declared helper whether it is called, imported, or aliased', () => {
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
	it('reports an owned field named as a string', () => {
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
		expect(
			synthetic({ [OTHER]: 'const a: { parentDigest: string } = x\n' }).map(
				(each) => each.rule.includes('type position'),
			),
		).toEqual([true])
		expect(
			subjects({
				[OTHER]: 'const f = ({ parentDigest }: L) => parentDigest\n',
			}),
		).toEqual(['parentDigest'])
	})

	// 50
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
	it('finds nothing in the real tree, through the published entry point', async () => {
		const report = await runFieldOwnership(repoRoot, ours)
		expect(report.violations).toEqual([])
		expect(report.scanned).toBeGreaterThanOrEqual(90)
	}, 30_000)
})

describe('the writer list this repository declares', () => {
	// JSON is data and the derivation is a computation over a TypeScript table,
	// so a consumer-facing configuration cannot call it. The list is transcribed
	// and this is the gate the drift fails at: a stage that starts minting, or
	// one that stops, moves `LINEAGE_WRITER_MODULES` and fails here until the
	// configuration moves with it.
	it('matches the stage table it is transcribed from', () => {
		expect([...ours.writers].sort()).toEqual([...LINEAGE_WRITER_MODULES].sort())
	})
})

describe('the dependency this gate needs', () => {
	const notFound = () =>
		Promise.reject(
			Object.assign(new Error("Cannot find package 'typescript'"), {
				code: 'ERR_MODULE_NOT_FOUND',
			}),
		)

	it('refuses by name, naming the dependency and the gate', async () => {
		const failure = await loadTokenScanner('field-ownership', notFound).then(
			() => null,
			(error: unknown) => error as Error & { code?: string },
		)
		expect(failure?.code).toBe(TYPESCRIPT_UNAVAILABLE)
		expect(failure?.message).toContain('typescript')
		expect(failure?.message).toContain('field-ownership')
	})

	// A bug inside the tokenizer is not a missing dependency, and swallowing one
	// as the other would report an install problem for a crash.
	it('rethrows anything that is not a resolution failure', async () => {
		const boom = new Error('the tokenizer threw')
		await expect(
			loadTokenScanner('field-ownership', () => Promise.reject(boom)),
		).rejects.toBe(boom)
	})
})

describe('the consumer fixtures', () => {
	it('passes the compliant tree', async () => {
		const dir = `${fixtures}lineage-compliant/`
		const report = await runFieldOwnership(dir, await sectionAt(dir))
		expect(report.violations).toEqual([])
		expect(report.scanned).toBe(4)
	})

	it('fails the seeded tree on the helper its configuration names', async () => {
		const dir = `${fixtures}lineage-seeded/`
		const report = await runFieldOwnership(dir, await sectionAt(dir))
		expect(report.violations.map((each) => each.subject)).toEqual([
			'bumpOwner',
			'bumpOwner',
		])
		expect(report.violations.map((each) => each.file)).toEqual([
			'src/pipeline/publish.ts',
			'src/pipeline/publish.ts',
		])
	})

	// The recall test, and the reason the seed was worded the way it was. The
	// seeded defect is a write that is not an assignment: `publish.ts` names no
	// owned field, spells none as a string and assigns nothing, and both fields
	// move through a helper one directory away in a declared path. Every one of
	// the scanner's triggers is a name somebody wrote down, so a second helper is
	// a write with no word in the vocabulary until the configuration gains the
	// word. Drop `bumpOwner` from the helper list and the tree reports clean with
	// the defect still in it.
	it('scans the seeded tree clean once the helper is out of the vocabulary', async () => {
		const dir = `${fixtures}lineage-seeded/`
		const seeded = await sectionAt(dir)
		const report = await runFieldOwnership(dir, {
			...seeded,
			helpers: seeded.helpers.filter((each) => each !== 'bumpOwner'),
		})
		expect(report.violations).toEqual([])
	})
})

describe('the shape of a field-ownership section', () => {
	const base = {
		paths: [{ path: 'src', extensions: ['.ts'] }],
		fields: ['ownerId'],
		writers: ['src/mint.ts'],
	}

	it('defaults the two optional lists to empty', () => {
		const parsed = FieldOwnershipSection.parse(base)
		expect(parsed.declarations).toEqual([])
		expect(parsed.helpers).toEqual([])
	})

	it('refuses a name that is both a field and a helper', () => {
		const result = FieldOwnershipSection.safeParse({
			...base,
			helpers: ['ownerId'],
		})
		expect(result.success).toBe(false)
	})

	it('refuses a field name the tokenizer could not match as one token', () => {
		expect(
			FieldOwnershipSection.safeParse({ ...base, fields: ['a.b'] }).success,
		).toBe(false)
		expect(
			FieldOwnershipSection.safeParse({ ...base, fields: ['"ownerId"'] })
				.success,
		).toBe(false)
	})

	it('refuses an empty writer list', () => {
		expect(
			FieldOwnershipSection.safeParse({ ...base, writers: [] }).success,
		).toBe(false)
	})
})
