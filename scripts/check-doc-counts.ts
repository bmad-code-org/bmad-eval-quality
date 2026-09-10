// The gate over hand-written counts in the published documentation: computes
// each number from the thing it counts, renders it the way the page spells it,
// and compares against the numeral the page carries.
//
// It exists because these sentences were held by story discipline alone and
// two epics of drift is what that bought. `check:docs` reads frontmatter and
// whitespace and never reads a page body; `check:doc-invocations` judges fenced
// commands rather than prose. So a page could state a contract count no
// generator owned and nothing would notice.
//
// A script rather than a Vitest test, for the reason `check-schemas.ts:6-9`
// gives: AD-30 forbids test filesystem I/O outside a temporary directory, and
// this reads committed markdown. It never rewrites a page, on the same rule:
// a check that can repair what it checks is not a gate.
//
// A pattern that matches nothing is a failure, and so is one that matches
// twice. A rewritten sentence therefore cannot silence the check by drifting
// out from under its own pattern.
//
// Usage:
//   npm run check:doc-counts

// Run by `node` directly: type stripping erases types only, so no TypeScript
// enum, namespace, parameter property, or non-type re-export may appear here
// or in anything it imports.
import { readFile } from 'node:fs/promises'
import * as adapters from '../src/adapters/index.ts'
import { CONFORMANCE_OUTCOME_COUNTS } from '../src/testing/conformance.ts'
import {
	CORPUS_CONTRACTS,
	DEV_CORPUS_CONTRACTS,
} from '../tests/coverage/fixtures/corpus.ts'
import { CORPUS_INDEX, CORPUS_LABEL } from './dev-corpus-target.ts'
import { buildWorkedExample } from './worked-example-target.ts'

const repoRoot = new URL('../', import.meta.url)

const ONES = [
	'zero',
	'one',
	'two',
	'three',
	'four',
	'five',
	'six',
	'seven',
	'eight',
	'nine',
	'ten',
	'eleven',
	'twelve',
	'thirteen',
	'fourteen',
	'fifteen',
	'sixteen',
	'seventeen',
	'eighteen',
	'nineteen',
]

const TENS = [
	'',
	'',
	'twenty',
	'thirty',
	'forty',
	'fifty',
	'sixty',
	'seventy',
	'eighty',
	'ninety',
]

/**
 * The closed word table, because the tree holds no numeral-to-word renderer:
 * the corpus README is a template literal with no interpolation, so its words
 * are hand-typed, and `src/core/coverage/table.ts:69` only replaces hyphens in
 * a state name. Zero to ninety-nine is the range the pages use, and a value
 * past it returns `null` so the report carries it beside every other failure
 * rather than aborting the run with a stack trace at the first one.
 */
function inWords(value: number): string | null {
	if (!Number.isInteger(value) || value < 0 || value > 99) return null
	const ones = ONES[value]
	if (ones !== undefined) return ones
	const tail = value % 10
	const tens = TENS[Math.floor(value / 10)] as string
	return tail === 0 ? tens : `${tens}-${ONES[tail]}`
}

/** The pages spell the same count with either case, so the compare is case-free. */
const matchCaseOf = (carried: string, owed: string): string =>
	carried.charAt(0) === carried.charAt(0).toUpperCase()
		? owed.charAt(0).toUpperCase() + owed.slice(1)
		: owed

/**
 * A gap inside one paragraph: whitespace that may wrap a line and never
 * crosses a blank one.
 *
 * `\s+` is the spelling `tests/architecture/dev-corpus.test.ts:270-272` uses
 * over this same file, and it is wrong in front of a capture group: a blank
 * line is whitespace, so the captured word can sit in the paragraph above the
 * sentence being read and the gate compares a number that sentence never
 * states. The corpus README wraps at about a hundred columns, so the gap still
 * has to admit one newline.
 */
const WRAP = '(?:[^\\S\\n]|\\n(?![ \\t]*\\n))+'

/** One gated sentence over the wrapped README, its words joined by `WRAP`. */
const wrapped = (...words: readonly string[]): RegExp =>
	new RegExp(words.join(WRAP), 'm')

type ManifestEntry = {
	readonly path: string
	readonly kind: string
	readonly structuralFailure?: string
}

const manifest = JSON.parse(await readFile(CORPUS_INDEX, 'utf8')) as {
	entries: readonly ManifestEntry[]
}

// The manifest is byte-gated by `check:corpus`, so these read a value another
// gate already proved against the bytes on disk.
const publishedContracts = manifest.entries.filter(
	(entry) =>
		entry.kind === 'contract' &&
		entry.path.startsWith(`${CORPUS_LABEL}/contracts/`),
)
const failingByDesign = publishedContracts.filter(
	(entry) => entry.structuralFailure !== undefined,
).length
const compiling = publishedContracts.length - failingByDesign

// The corpus total has two sources that must agree: the fixture array the
// generator reads, and the contracts it wrote. Disagreement means the tree was
// not regenerated, which is `check:corpus`'s job to say, so this states it
// plainly rather than picking one.
if (publishedContracts.length !== DEV_CORPUS_CONTRACTS.length) {
	console.error(
		`check-doc-counts: DEV_CORPUS_CONTRACTS holds ${DEV_CORPUS_CONTRACTS.length} ` +
			`contracts and ${CORPUS_LABEL}/contracts/ holds ${publishedContracts.length}; ` +
			'run `npm run generate:dev-corpus`',
	)
	process.exit(1)
}

/**
 * The per-contract facts the sentences below count, read out of the published
 * JSON rather than out of the fixture array. Off the fixtures, an interface or
 * a plan edited without regeneration would keep these green against a corpus
 * that does not carry the edit.
 */
type PublishedFacts = {
	readonly kinds: readonly string[]
	readonly capturesAValue: boolean
	readonly declaresAFixtureReset: boolean
}

const published: readonly PublishedFacts[] = await Promise.all(
	publishedContracts.map(async (entry) => {
		const text = await readFile(new URL(entry.path, repoRoot), 'utf8')
		const contract = JSON.parse(text) as {
			permittedInterfaces: readonly { kind: string }[]
			interactionPlan: readonly {
				inputBinding: Record<string, unknown>
			}[]
			fixtureReset: unknown
		}
		return {
			kinds: contract.permittedInterfaces.map((iface) => iface.kind),
			// A `{ captured }` binding, on any input channel of any step. An
			// unbound channel is `null` and a bound one is a map of key to
			// binding value, so the shape is walked rather than pattern-matched
			// against the JSON text: a contract whose oracle commentary happened
			// to spell the word would otherwise be counted.
			capturesAValue: contract.interactionPlan.some((step) =>
				Object.values(step.inputBinding).some(
					(channel) =>
						channel !== null &&
						typeof channel === 'object' &&
						Object.values(channel as Record<string, unknown>).some(
							(value) =>
								value !== null &&
								typeof value === 'object' &&
								'captured' in value,
						),
				),
			),
			declaresAFixtureReset: contract.fixtureReset !== null,
		}
	}),
)

const declaringKind = (kind: string): number =>
	published.filter((facts) => facts.kinds.includes(kind)).length

const capturing = published.filter((facts) => facts.capturesAValue).length
const resetting = published.filter(
	(facts) => facts.declaresAFixtureReset,
).length

/**
 * How many end-to-end chains this repository commits, read off the registry
 * every chain joins rather than off a list of labels kept here. A chain added
 * to that registry and left out of a label list would leave these three
 * sentences stale with nothing to notice, which is the drift this gate exists
 * to stop.
 */
const committedChains = new Set(
	[...buildWorkedExample().keys()].map((path) =>
		path.slice(0, path.lastIndexOf('/')),
	),
).size

const referenceAdapters = Object.keys(adapters).filter((name) =>
	/^create[A-Za-z]*Adapter$/.test(name),
).length

type Entry = {
	/** Repository-relative. Two entries are source files rather than pages. */
	readonly file: string
	/** What the sentence claims, for the failure message. */
	readonly claim: string
	/** One capture group per expected value. */
	readonly pattern: RegExp
	readonly expected: readonly number[]
	readonly rendering: 'word' | 'digits'
}

/**
 * One entry per gated sentence. Every expected value is computed above from a
 * source another gate already holds, so this table adds a rendering and a
 * pattern and asserts nothing on its own authority.
 */
const ENTRIES: readonly Entry[] = [
	{
		file: 'README.md',
		claim: 'the corpus contract total',
		pattern:
			/you can read ([a-z-]+) real contracts and one compiled-and-sealed pair/,
		expected: [DEV_CORPUS_CONTRACTS.length],
		rendering: 'word',
	},
	{
		file: 'docs/explanation/what-ships.md',
		claim: 'the corpus contract total',
		pattern: /a ([a-z-]+)-contract development corpus/,
		expected: [DEV_CORPUS_CONTRACTS.length],
		rendering: 'word',
	},
	{
		file: 'docs/explanation/what-ships.md',
		claim: 'the reference adapter count',
		pattern: /([a-z-]+) reference adapters at `eval-quality\/adapters`/,
		expected: [referenceAdapters],
		rendering: 'word',
	},
	{
		file: 'docs/reference/cli-commands.md',
		claim: 'the reference adapter count',
		pattern: /ships ([a-z-]+) reference adapters/,
		expected: [referenceAdapters],
		rendering: 'word',
	},
	{
		file: 'docs/reference/cli-commands.md',
		claim: 'the corpus contract total',
		pattern: /`corpus\/dev\/` ships ([a-z-]+) contracts under `contracts\/`/,
		expected: [DEV_CORPUS_CONTRACTS.length],
		rendering: 'word',
	},
	{
		file: 'docs/reference/cli-commands.md',
		claim: 'the compiling contract count',
		// Anchored: unanchored, a rewrite to "All nineteen of the contracts
		// compile." still matches and captures "the", so the failure names the
		// wrong token.
		pattern: /(?:^|(?<=[.]\s))([A-Za-z-]+) contracts compile\./,
		expected: [compiling],
		rendering: 'word',
	},
	{
		file: 'docs/reference/cli-commands.md',
		claim: 'the failing-by-design contract count',
		pattern: /(?<=[.]\s)([A-Za-z-]+) fail by design:/,
		expected: [failingByDesign],
		rendering: 'word',
	},
	{
		file: 'docs/reference/cli-commands.md',
		claim: 'the per-port conformance outcome counts',
		pattern:
			/`corpus` (\d+), `clock` (\d+), `file-system` (\d+), `environment-probe` (\d+), `command-probe` (\d+), `mcp-probe` (\d+)/,
		expected: [
			CONFORMANCE_OUTCOME_COUNTS.corpus,
			CONFORMANCE_OUTCOME_COUNTS.clock,
			CONFORMANCE_OUTCOME_COUNTS['file-system'],
			CONFORMANCE_OUTCOME_COUNTS['environment-probe'],
			CONFORMANCE_OUTCOME_COUNTS['command-probe'],
			CONFORMANCE_OUTCOME_COUNTS['mcp-probe'],
		],
		rendering: 'digits',
	},
	{
		file: 'docs/how-to/author-behavioral-contracts.md',
		claim: 'the corpus contract total',
		pattern: /`corpus\/dev\/contracts\/` holds ([a-z-]+) contracts:/,
		expected: [DEV_CORPUS_CONTRACTS.length],
		rendering: 'word',
	},
	{
		file: 'docs/how-to/author-behavioral-contracts.md',
		claim: 'the compiling contract count',
		pattern:
			/(?:^|(?<=[.]\s))([A-Za-z-]+) compile, and [a-z-]+ fail by design\./,
		expected: [compiling],
		rendering: 'word',
	},
	{
		file: 'docs/how-to/author-behavioral-contracts.md',
		claim: 'the failing-by-design contract count',
		pattern: /compile, and ([a-z-]+) fail by design\./,
		expected: [failingByDesign],
		rendering: 'word',
	},
	{
		file: 'docs/how-to/evaluate-ai-feature-behavior.md',
		claim: 'the `api`-declaring contract count',
		pattern:
			/([A-Za-z-]+) of the [a-z-]+ contracts in `corpus\/dev\/contracts\/` declare an `api` interface/,
		expected: [declaringKind('api')],
		rendering: 'word',
	},
	{
		file: 'docs/how-to/evaluate-ai-feature-behavior.md',
		claim: 'the corpus contract total',
		pattern:
			/of the ([a-z-]+) contracts in `corpus\/dev\/contracts\/` declare an `api` interface/,
		expected: [DEV_CORPUS_CONTRACTS.length],
		rendering: 'word',
	},
	{
		file: 'docs/tutorials/getting-started.md',
		claim: 'the corpus contract total',
		pattern: /The package ships ([a-z-]+) of them/,
		expected: [DEV_CORPUS_CONTRACTS.length],
		rendering: 'word',
	},
	{
		// Entered ahead of the move it has to catch. This reads `two` today and
		// the next shipped command contract takes it to three, so the gate rather
		// than the author is what notices.
		file: 'docs/how-to/evaluate-agent-behavior.md',
		claim: 'the `cli`-declaring contract count',
		pattern: /ships ([a-z-]+) contracts describing a system behind a command/,
		expected: [declaringKind('cli')],
		rendering: 'word',
	},
	{
		file: 'README.md',
		claim: 'the committed end-to-end chain count',
		pattern: /\| the ([a-z-]+) committed worked chains \|/,
		expected: [committedChains],
		rendering: 'word',
	},
	{
		file: 'docs/how-to/author-behavioral-contracts.md',
		claim: 'the committed end-to-end chain count',
		pattern: /The repository commits ([a-z-]+) complete chains/,
		expected: [committedChains],
		rendering: 'word',
	},
	// The corpus README is generated from a template literal in
	// `scripts/dev-corpus-target.ts`, and `check:corpus` proves the bytes match
	// that template without ever reading what the words say. So the same drift
	// the six published pages carried for two epics is available here, and these
	// entries read the generated output: a stale template word reaches disk and
	// fails at the file an adopter actually opens.
	{
		file: 'corpus/dev/README.md',
		claim: 'the corpus contract total in the opening line',
		pattern: wrapped(
			'^([A-Za-z-]+)',
			'contracts',
			'and',
			'one',
			'compiled-and-sealed',
			'pair',
		),
		expected: [publishedContracts.length],
		rendering: 'word',
	},
	{
		file: 'corpus/dev/README.md',
		claim: 'the corpus contract total in "What is here"',
		pattern: wrapped(
			'`contracts/<contractId>\\.json`:',
			'([a-z-]+)',
			'contracts\\.',
		),
		expected: [publishedContracts.length],
		rendering: 'word',
	},
	{
		file: 'corpus/dev/README.md',
		claim: 'the discipline-rule cell contract count',
		pattern: wrapped('([A-Za-z-]+)', 'are', 'one', 'per', 'discipline', 'rule'),
		expected: [CORPUS_CONTRACTS.length],
		rendering: 'word',
	},
	{
		file: 'corpus/dev/README.md',
		claim: 'the `cli`-declaring contract count',
		pattern: wrapped(
			'([a-z-]+)',
			'describe',
			'a',
			'system',
			'under',
			'test',
			'that',
			'runs',
			'behind',
			'a',
			'command',
		),
		expected: [declaringKind('cli')],
		rendering: 'word',
	},
	{
		file: 'corpus/dev/README.md',
		claim: 'the `mcp`-declaring contract count',
		pattern: wrapped('([a-z-]+)', 'describes', 'a', 'tool', 'server'),
		expected: [declaringKind('mcp')],
		rendering: 'word',
	},
	{
		file: 'corpus/dev/README.md',
		claim: 'the contract count carrying a captured binding',
		pattern: wrapped(
			'([A-Za-z-]+)',
			'of',
			'the',
			'contracts',
			'bind',
			'a',
			'step',
			'to',
			'a',
			'value',
		),
		expected: [capturing],
		rendering: 'word',
	},
	{
		file: 'corpus/dev/README.md',
		claim: 'the contract count declaring a fixture reset',
		pattern: wrapped('the', 'same', '([a-z-]+)', 'declare', 'a', 'fixture'),
		expected: [resetting],
		rendering: 'word',
	},
	{
		file: 'corpus/dev/README.md',
		claim: 'the committed end-to-end chain count in "What is here"',
		pattern: wrapped(
			'one',
			'of',
			'the',
			'([a-z-]+)',
			'committed',
			'end-to-end',
			'chains',
		),
		expected: [committedChains],
		rendering: 'word',
	},
	{
		file: 'corpus/dev/README.md',
		claim: 'the committed end-to-end chain count in "What is absent"',
		pattern: wrapped('([A-Za-z-]+)', 'chains', 'are', 'committed'),
		expected: [committedChains],
		rendering: 'word',
	},
	{
		file: 'corpus/dev/README.md',
		claim: 'the compiling contract count',
		pattern: wrapped(
			'The',
			'other',
			'([a-z-]+)',
			'are',
			'published',
			'only',
			'after',
		),
		expected: [compiling],
		rendering: 'word',
	},
	{
		file: 'corpus/dev/README.md',
		claim: 'the failing-by-design contract count',
		// Anchored on the end of the sentence before it rather than on a line
		// start, so reflowing the paragraph cannot turn the entry dead.
		pattern: wrapped(
			'(?<=[.;])',
			'([A-Za-z-]+)',
			'fail',
			'compilation',
			'by',
			'design',
		),
		expected: [failingByDesign],
		rendering: 'word',
	},
	// `EXAMPLE_SEED_ID`'s docblock is the one corpus numeral outside the README
	// template, so it reaches no generated byte and no other gate.
	{
		file: 'scripts/dev-corpus-target.ts',
		claim: "the failing-by-design count in `EXAMPLE_SEED_ID`'s docblock",
		pattern: wrapped('because ([a-z-]+) of the [a-z-]+ do not', 'compile'),
		expected: [failingByDesign],
		rendering: 'word',
	},
	{
		file: 'scripts/dev-corpus-target.ts',
		claim: "the corpus contract total in `EXAMPLE_SEED_ID`'s docblock",
		pattern: wrapped('because [a-z-]+ of the ([a-z-]+) do not', 'compile'),
		expected: [publishedContracts.length],
		rendering: 'word',
	},
]

const lineOf = (text: string, offset: number): number =>
	text.slice(0, offset).split('\n').length

const failures: string[] = []
let numerals = 0
let conformanceDigits = 0

for (const entry of ENTRIES) {
	if (entry.rendering === 'digits') conformanceDigits += entry.expected.length
	else numerals += entry.expected.length
	let text: string
	try {
		text = await readFile(new URL(entry.file, repoRoot), 'utf8')
	} catch {
		failures.push(`${entry.file}: missing, but a count entry names it`)
		continue
	}

	// The entry's own flags are carried over: `new RegExp(pattern, 'g')`
	// replaces them, which silently dropped `m` and made an anchored pattern
	// dead.
	const flags = entry.pattern.flags.includes('g')
		? entry.pattern.flags
		: `${entry.pattern.flags}g`
	const found = [...text.matchAll(new RegExp(entry.pattern.source, flags))]
	if (found.length === 0) {
		failures.push(
			`${entry.file}: no sentence matches the pattern for ${entry.claim}; ` +
				'the entry is dead and either the sentence or the entry has to move',
		)
		continue
	}
	if (found.length > 1) {
		const lines = found
			.map((match) => lineOf(text, match.index ?? 0))
			.join(', ')
		failures.push(
			`${entry.file}: ${found.length} sentences match the pattern for ` +
				`${entry.claim} (lines ${lines}); a count entry names one sentence`,
		)
		continue
	}

	const match = found[0] as RegExpExecArray
	const line = lineOf(text, match.index ?? 0)
	entry.expected.forEach((value, index) => {
		const carried = match[index + 1] as string
		let owed: string
		if (entry.rendering === 'digits') owed = String(value)
		else {
			const word = inWords(value)
			if (word === null) {
				failures.push(
					`${entry.file}:${line}: ${entry.claim} is ${value}, outside the ` +
						"word table's range (0-99); extend the table",
				)
				return
			}
			owed = matchCaseOf(carried, word)
		}
		if (carried === owed) return
		failures.push(
			`${entry.file}:${line}: ${entry.claim} reads "${carried}" and is ${owed} (${value})`,
		)
	})
}

if (failures.length > 0) {
	for (const failure of failures) console.error(failure)
	console.error(
		`check-doc-counts: ${failures.length} count(s) disagree with their source`,
	)
	process.exit(1)
}

const files = new Set(ENTRIES.map((entry) => entry.file)).size
console.log(
	`check-doc-counts: ${numerals} numerals across ${files} files agree with ` +
		`their source, plus ${conformanceDigits} per-port conformance counts`,
)
