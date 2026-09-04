/**
 * AC 17 cases 159 through 166: `corpus/dev/` as published data. The drift
 * check (`npm run check:corpus`) proves the committed bytes match the builder.
 * These cases prove the properties the builder is supposed to have: canonical
 * bytes, a manifest that stays packaging under AD-11, an example emitted by the
 * shipped stages, a README that discloses what is absent, and no content AD-15
 * or AD-18 forbids.
 *
 * The corpus is read from the real tree under AD-30's carve-out for published
 * data. Nothing here writes.
 */
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
	buildDevCorpus,
	CORPUS_LABEL,
	CORPUS_PACKAGE_ROOT,
	EXAMPLE_SEED_ID,
} from '../../scripts/dev-corpus-target.ts'
import { scanPackageBoundary } from '../../scripts/package-boundary.ts'
import { compile } from '../../src/application/compile.ts'
import { seal } from '../../src/application/seal.ts'
import { serializeArtifact } from '../../src/application/serialize.ts'
import { digestBytes } from '../../src/core/canonical/digest.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { CORPUS_CONTRACTS } from '../coverage/fixtures/corpus.ts'

type IndexEntry = {
	readonly path: string
	readonly kind: string
	readonly digest: string
	readonly structuralFailure?: string
}

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))

/**
 * Every committed file under `corpus/`, keyed the way `index.json` names it.
 *
 * All of `corpus/` and not just `corpus/dev/`, because `package.json`'s `files`
 * ships all of `corpus/`: a file planted beside the generated tree is published
 * data too, so case 161 must see it as unnamed and case 166 must screen it.
 *
 * Keyed by `relative` from the repository root, the same derivation
 * `check-dev-corpus.ts` uses, so the check and this test agree on a key by
 * construction. Both once split on the literal `corpus/dev`, which breaks when
 * the repository is itself checked out under a path containing that string.
 */
async function readCorpus(): Promise<Map<string, string>> {
	const files = new Map<string, string>()
	const entries = await readdir(CORPUS_PACKAGE_ROOT, {
		recursive: true,
		withFileTypes: true,
	})
	for (const entry of entries) {
		if (!entry.isFile()) continue
		// `join` because `parentPath` carries a trailing slash at the root of a
		// recursive walk and not below it.
		const absolute = join(entry.parentPath, entry.name)
		files.set(relative(repoRoot, absolute), await readFile(absolute, 'utf8'))
	}
	return files
}

const corpus = await readCorpus()
const indexPath = `${CORPUS_LABEL}/index.json`
const indexText = corpus.get(indexPath) as string
const manifest = JSON.parse(indexText) as { readonly entries: IndexEntry[] }

const digestOf = (text: string): string =>
	digestBytes(new TextEncoder().encode(text))

const AD18_CATEGORIES = [
	'credentials',
	'tokens',
	'real names',
	'email addresses',
	'account identifiers',
	'transaction content',
] as const

/**
 * AD-18's six excluded categories as patterns, each with a string it must fire
 * on. The positive sample is what keeps a pattern from rotting into a grep
 * that can no longer match anything.
 *
 * Two shapes are deliberately narrow. The token pattern requires a non-letter
 * before the word, because `inputTokens` and `outputTokens` are budget
 * integers this repository uses and a bare `/token/i` reports them forever. A
 * personal name has no surface form to match, so the name patterns read the
 * fields that carry one and the honorific that precedes one.
 */
const AD18_PATTERNS: readonly {
	readonly category: (typeof AD18_CATEGORIES)[number]
	readonly regex: RegExp
	readonly fires: string
}[] = [
	{
		category: 'credentials',
		regex:
			/\bpass(?:word|phrase|wd)\b|\bsecrets?\b|\bcredentials?\b|\bapi[_-]?keys?\b|\bprivate[_-]?key\b/i,
		fires: '{"password":"hunter2"}',
	},
	{
		category: 'credentials',
		regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
		fires: '-----BEGIN RSA PRIVATE KEY-----',
	},
	{
		category: 'tokens',
		regex: /(?<![A-Za-z])tokens?\b/i,
		fires: '{"token":"abc"}',
	},
	{
		category: 'tokens',
		regex:
			/(?<![A-Za-z])(?:[Bb]earer\s+[\w.~+/-]{16,}|eyJ[\w-]{8,}\.[\w-]{8,}|sk-[A-Za-z0-9]{16,}|gh[pousr]_[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16})/,
		fires: 'Authorization: Bearer abcdefghijklmnopqrstuv',
	},
	{
		category: 'real names',
		regex:
			/\b(?:first|last|full|given|family|middle|maiden|customer|client|patient|employee|holder|user)[_-]?name\b/i,
		fires: '{"firstName":"Ada"}',
	},
	{
		category: 'real names',
		regex: /\b(?:Mr|Mrs|Ms|Dr|Prof)\.\s+[A-Z][a-z]+/,
		fires: 'signed by Dr. Lovelace',
	},
	{
		category: 'email addresses',
		regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
		fires: '{"contact":"ada@example.com"}',
	},
	{
		category: 'account identifiers',
		regex:
			/\b(?:account|customer|member|policy|routing|iban|swift|bic)[_-]?(?:number|no|id|identifier)s?\b|\bssn\b|\bsocial[_-]?security\b/i,
		fires: '{"accountNumber":"0001"}',
	},
	{
		// Case-sensitive: an IBAN is upper case, and a case-insensitive form
		// matches a run inside a lower-case hex digest.
		category: 'account identifiers',
		regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b|\b\d{3}-\d{2}-\d{4}\b/,
		fires: 'GB29NWBK60161331926819',
	},
	{
		category: 'transaction content',
		regex:
			/\bcredit[_-]?card\b|\bcard[_-]?(?:number|holder)\b|\bcvv\b|\bcvc\b|\b(?:transaction|payment|invoice|purchase)[_-]?(?:amount|total|reference)s?\b/i,
		fires: '{"cardNumber":"4111111111111111"}',
	},
	{
		category: 'transaction content',
		regex: /(?<![0-9A-Za-z])\d{4}(?:[ -]\d{4}){3}(?![0-9A-Za-z])/,
		fires: 'charged 4111 1111 1111 1111',
	},
]

describe('the development corpus', () => {
	it('case 159: every JSON file is `serializeArtifact` output', () => {
		const wrong: string[] = []
		for (const [path, text] of corpus) {
			// One trailing newline, which is what `serializeArtifact` appends.
			if (!text.endsWith('\n') || text.endsWith('\n\n')) {
				wrong.push(`${path}: trailing newline`)
			}
			if (!path.endsWith('.json')) continue
			if (serializeArtifact(JSON.parse(text), path) !== text) {
				wrong.push(`${path}: not canonical bytes`)
			}
		}
		expect(wrong).toEqual([])
	})

	it('case 160: `index.json` is sorted, timestamp-free, and version-free', () => {
		const paths = manifest.entries.map((entry) => entry.path)
		expect(paths).toEqual([...paths].sort())
		expect(Object.keys(manifest)).toEqual(['entries'])
		// A `schemaVersion` would make the manifest an interchange artifact under
		// AD-11 and pull AD-13's schema obligations behind it; a timestamp would
		// make the generator non-idempotent.
		expect(indexText).not.toMatch(
			/schemaVersion|timestamp|generatedAt|createdAt|\d{4}-\d{2}-\d{2}T/i,
		)
		const unexpected = manifest.entries.flatMap((entry) =>
			Object.keys(entry).filter(
				(key) => !['path', 'kind', 'digest', 'structuralFailure'].includes(key),
			),
		)
		expect(unexpected).toEqual([])
	})

	it('case 161: every manifest digest matches the bytes on disk', () => {
		const mismatched: string[] = []
		for (const entry of manifest.entries) {
			const text = corpus.get(entry.path)
			if (text === undefined) {
				mismatched.push(`${entry.path}: named by the manifest, absent on disk`)
				continue
			}
			if (digestOf(text) !== entry.digest) mismatched.push(entry.path)
		}
		expect(mismatched).toEqual([])
		// The manifest cannot carry its own digest, so it is the one file on disk
		// with no entry. Anything else unnamed is an orphan.
		const named = new Set(manifest.entries.map((entry) => entry.path))
		const unnamed = [...corpus.keys()].filter((path) => !named.has(path))
		expect(unnamed).toEqual([indexPath])
	})

	it('case 162: the example brief is what the shipped stages produce', async () => {
		const contractText = corpus.get(
			`${CORPUS_LABEL}/compile-seal-example/contract.json`,
		) as string
		const briefText = corpus.get(
			`${CORPUS_LABEL}/compile-seal-example/brief.json`,
		) as string
		const contract = EvalContract.parse(JSON.parse(contractText))
		expect(
			serializeArtifact(seal(compile(contract)), 'SealedEvaluatorBrief'),
		).toBe(briefText)

		// The tutorial publishes this brief's `contractDigest` as the output of
		// `seal --in corpus/dev/compile-seal-example/contract.json` and then says
		// the repository ships the brief that command produces, so the page is a
		// third copy of a value only the builder should own. It went stale three
		// times (stories 6.5, 7.2 and 7.3 each moved the contract's bytes and
		// left the page behind) because `check:docs` does not scan `docs/` and
		// `check-doc-invocations.mjs` runs the commands without comparing their
		// output. Asserted here rather than as a case of its own: it is the same
		// claim this case already makes, read at the one other place the value
		// is written down.
		const tutorial = await readFile(
			join(repoRoot, 'docs/tutorials/getting-started.md'),
			'utf8',
		)
		const { contractDigest } = JSON.parse(briefText) as {
			readonly contractDigest: string
		}
		expect(tutorial).toContain(`"contractDigest":"${contractDigest}"`)
	})

	it('case 163: the README names all four absences', () => {
		const readme = corpus.get(`${CORPUS_LABEL}/README.md`) as string
		// The README wraps at about a hundred columns, so every pattern crosses a
		// line break with `\s+`.
		const absences: readonly [string, RegExp][] = [
			[
				'the qualified-probe dimensions are absent',
				/qualified-probe\s+dimensions\s+are\s+absent/,
			],
			[
				'the trial reducer and the score stage are both shipped, so the corpus gate is the remaining gap',
				/qualified-probe\s+dimensions\s+are\s+absent[\s\S]*trial\s+reducer[\s\S]*score\s+stage/,
			],
			[
				"three of the end-to-end example's artifacts are absent here, and are ingest's own inputs, not its output",
				/Three of the four artifacts[\s\S]*inputs the shipped[\s\S]*ingest[\s\S]*stage\s+consumes/,
			],
			[
				'the contracts are visible and diagnostic, and no holdout',
				/visible and diagnostic[\s\S]*holdout/,
			],
		]
		const unstated = absences
			.filter(([, pattern]) => !pattern.test(readme))
			.map(([label]) => label)
		expect(unstated).toEqual([])
	})

	it('case 164: the builder is idempotent and input-order independent', () => {
		// A synthetic target: the example's seed, one contract that compiles, and
		// one that fails compilation by design, so both branches of the builder
		// run.
		const wanted = new Set([
			EXAMPLE_SEED_ID,
			'per-key-split-oracles',
			'no-operation-inventory',
		])
		const target = CORPUS_CONTRACTS.filter((contract) =>
			wanted.has(contract.contractId),
		)
		expect(target).toHaveLength(wanted.size)

		const first = buildDevCorpus(target)
		expect([...buildDevCorpus(target)]).toEqual([...first])
		expect([...buildDevCorpus([...target].reverse())]).toEqual([...first])
	})

	it('case 165: every published contract parses against `EvalContract`', () => {
		const contracts = [...corpus].filter(
			([path]) =>
				path.startsWith(`${CORPUS_LABEL}/contracts/`) ||
				path === `${CORPUS_LABEL}/compile-seal-example/contract.json`,
		)
		// The count comes from the manifest's own vocabulary, so a filter that
		// silently matched nothing fails here.
		expect(contracts).toHaveLength(
			manifest.entries.filter((entry) => entry.kind === 'contract').length,
		)
		// The three that ship as authored input parse here and fail compilation
		// later; the failure code each raises is in `index.json`.
		const rejected = contracts
			.filter(([, text]) => !EvalContract.safeParse(JSON.parse(text)).success)
			.map(([path]) => path)
		expect(rejected).toEqual([])
		expect(
			manifest.entries.filter((entry) => entry.structuralFailure !== undefined),
		).toHaveLength(3)
	})

	it('case 166: the corpus carries no AD-15 reference and no AD-18 content', () => {
		expect(scanPackageBoundary(corpus)).toEqual([])

		expect(new Set(AD18_PATTERNS.map((entry) => entry.category)).size).toBe(
			AD18_CATEGORIES.length,
		)
		const dead = AD18_PATTERNS.filter((entry) => !entry.regex.test(entry.fires))
		expect(dead.map((entry) => entry.regex.source)).toEqual([])
		// The near-hit the repository actually contains.
		const budget = '{"inputTokens":4000,"outputTokens":1000}'
		expect(
			AD18_PATTERNS.filter((entry) => entry.regex.test(budget)),
		).toHaveLength(0)

		const hits: string[] = []
		for (const [path, text] of corpus) {
			for (const { category, regex } of AD18_PATTERNS) {
				const match = regex.exec(text)
				if (match !== null) hits.push(`${path} [${category}] ${match[0]}`)
			}
		}
		expect(hits).toEqual([])
	})
})
