// The gate over hand-written prose claims in the published documentation: the
// class of sentence that is neither a number nor a fenced command, and that
// nothing in `npm run validate` read until this script.
//
// It exists because Epic 11 opened an interface kind and every page that had
// described the kind as refused went stale at once. Four of those sentences
// were found by a person reading, and Story 11.7's Decision 18 recorded that
// nothing mechanical would have caught them. `check:docs` reads frontmatter and
// whitespace and never opens `docs/`; `check:doc-invocations` judges fenced
// commands against their declared exit codes; `check:doc-counts` holds numerals.
// A sentence naming a symbol, transcribing a source list, citing a line, or
// saying a thing is not yet true fell through all three.
//
// Not every prose claim is mechanically decidable, and this script does not
// pretend otherwise. Seven classes, each resolving against an artifact in this
// repository:
//
//   1. Citations. A `path.ts:N` reference resolves to a file, the line is in
//      range, and a symbol the sentence names and the cited file declares sits
//      inside the cited window.
//   2. Symbols. An identifier a page spells in backticks is declared under
//      `src/`. A mention in a comment does not save a name that was renamed.
//   3. Transcribed lists. A list a page spells out equals the set the source
//      exports.
//   4. Time-sensitive claims. A sentence saying a thing is not yet true, or is
//      true "today", is registered with how it is settled: by a predicate this
//      script runs, or by a recorded human reading with the reason no artifact
//      can decide it.
//   5. Named codes. A code a page says is raised exists in a registry.
//   6. Worked JSON. A published example block parses against the schema the
//      prose names.
//   7. Interface kinds. A kind a sentence says is accepted is in
//      `SUPPORTED_INTERFACE_KINDS`, and one it says is refused is in
//      `UNSUPPORTED_INTERFACE_KINDS`.
//   8. Transcriptions. A page reprinting a string the binary emits carries the
//      same bytes.
//
// Six of the eight are classes and two are inventories, and the difference
// decides what this gate promises. Classes 1, 2, 5, 6 and 7 hold every sentence
// on every page, including one written tomorrow. Classes 3, 4 and 8 hold the
// sentences somebody enumerated, and what they guarantee is that a listed
// sentence cannot be rewritten or drift out from under its entry without
// failing. Class 7 exists because the first version of this script had only the
// inventory for the epic's own defect: a new sentence saying `mcp` is refused
// would have passed every other class, since it invents no symbol, cites no
// line, names a code that exists, and carries no dated vocabulary.
//
// Class 4 is the one that needs explaining. The truth of "no live server has
// been scored end to end" is not in this repository, so no check can decide it.
// What a check can decide is that the sentence exists and is registered, which
// turns an invisible claim into an enumerated one: a new unproven claim fails
// this gate until somebody writes down who holds it and why, and a registered
// claim whose sentence was rewritten fails as a dead entry. That is weaker than
// deciding the claim and stronger than the nothing that preceded it.
//
// What stays outside all eight, and therefore outside this gate: editorial
// judgment ("worth knowing before you fund any of it"), design rationale,
// anything about the world beyond the tree, any claim about runtime behaviour
// that only executing the code would settle, and whether a code a page names is
// the one that surface actually raises, which class 5 does not ask. The report
// line prints what review holds so the remainder is visible.
//
// A script rather than a Vitest test, for the reason `check-doc-counts.ts:11-14`
// gives: AD-30 forbids test filesystem I/O outside a temporary directory, and
// this reads committed markdown. It never rewrites a page, on the same rule.
//
// Usage:
//   npm run check:doc-claims

// Run by `node` directly: type stripping erases types only, so no TypeScript
// enum, namespace, parameter property, or non-type re-export may appear here
// or in anything it imports.
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { z } from 'zod'
import * as adapters from '../src/adapters/index.ts'
import { EXIT_CODE_TABLE } from '../src/cli/render.ts'
import {
	SUPPORTED_INTERFACE_KINDS,
	UNSUPPORTED_INTERFACE_KINDS,
} from '../src/core/compile/interface-inventory.ts'
import { FAILURE_CODES } from '../src/core/failure-codes.ts'
import { DefectSignature } from '../src/core/schemas/defect-signature.ts'
import { Expression } from '../src/core/schemas/expression.ts'
import { RUNTIME_FAULT_CODES } from '../src/core/schemas/faults.ts'
import {
	INTERFACE_KINDS,
	McpDescriptorChannel,
	PermittedInterface,
} from '../src/core/schemas/interface.ts'
import { Oracle } from '../src/core/schemas/oracle.ts'
import { InteractionStep } from '../src/core/schemas/plan.ts'
import { ManifestationWitness } from '../src/core/schemas/sensitivity-witness.ts'
import { QUALIFICATION_FAILURES } from '../src/core/score/qualification.ts'

const repoRoot = new URL('../', import.meta.url)
const pathOf = (relative: string): string =>
	new URL(relative, repoRoot).pathname

/** The published pages, the same two roots `check-doc-invocations.mjs:73` reads. */
const PAGE_ROOTS = ['README.md', 'docs']

const walk = async (target: string): Promise<readonly string[]> => {
	const info = await stat(pathOf(target)).catch(() => null)
	if (info === null) return []
	if (info.isFile()) return target.endsWith('.md') ? [target] : []
	const entries = await readdir(pathOf(target))
	const nested = await Promise.all(
		entries.map((entry) => walk(`${target}/${entry}`)),
	)
	return nested.flat()
}

const sourceFiles = async (root: string): Promise<readonly string[]> => {
	const info = await stat(pathOf(root)).catch(() => null)
	if (info === null) return []
	if (info.isFile()) return [root]
	const entries = await readdir(pathOf(root))
	const nested = await Promise.all(
		entries.map((entry) => sourceFiles(join(root, entry))),
	)
	return nested.flat()
}

const failures: string[] = []
const fail = (message: string): void => {
	failures.push(message)
}

const pages = (await Promise.all(PAGE_ROOTS.map(walk))).flat().sort()

/**
 * The pages a person writes. `docs/*.generated.md` come from
 * `scripts/generate-ad*-table.ts` and are held byte-exact by their own checks,
 * so the vocabulary they carry is the source's own and a registry of
 * time-sensitive claims over them would be a registry of generator output.
 * Classes 1 and 2 still read them, because a generator can name a symbol that
 * moved and no byte comparison would notice.
 */
const authoredPages = pages.filter((page) => !page.endsWith('.generated.md'))
const pageText = new Map<string, readonly string[]>()
for (const page of pages) {
	pageText.set(page, (await readFile(pathOf(page), 'utf8')).split('\n'))
}

const srcPaths = (await sourceFiles('src')).filter((file) =>
	file.endsWith('.ts'),
)
const srcBodies = new Map<string, string>()
for (const file of srcPaths) {
	srcBodies.set(file, await readFile(pathOf(file), 'utf8'))
}
const allSource = [...srcBodies.values()].join('\n')

/**
 * A backticked token that reads as a code identifier: camelCase, PascalCase
 * with an inner capital, SCREAMING_SNAKE, or a single PascalCase word. The last
 * of those covers `Rubric`, `Probe`, `Observation` and `Expression`, which are
 * published type names a page names without any citation to hold them. Deliberately narrower than "any
 * backticked word", because a page also backticks kind names (`api`), channel
 * names (`arguments`), failure codes (`binding-cycle`) and file paths, and none
 * of those is a symbol the tree declares.
 */
const IDENTIFIER_SHAPE =
	/^(?:[a-z]+[A-Z]|[A-Z][a-z]+[A-Z]|[A-Z][A-Z0-9_]{3,}$|[A-Z][a-z]{3,}$)/
const BACKTICKED = /`([A-Za-z_][A-Za-z0-9_]*)`/g

const isIdentifier = (token: string): boolean => IDENTIFIER_SHAPE.test(token)

/**
 * A `Set` key over two strings. `JSON.stringify` rather than a separator
 * character, because a separator has to be a byte neither half can contain and
 * every such byte is invisible in this file.
 */
const compositeKey = (...parts: readonly string[]): string =>
	JSON.stringify(parts)

// ---------------------------------------------------------------------------
// Class 1: citations
// ---------------------------------------------------------------------------

const CITATION =
	/`?((?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+\.(?:ts|mjs|json)):(\d+)(?:-(\d+))?`?/g

/**
 * How far a citation may drift before the anchor check calls it stale. Four
 * lines absorbs a reformat or an inserted comment; a moved declaration is
 * further than that.
 */
const CITATION_WINDOW = 4

/**
 * Matches a declaration. A mention in a comment or a string does not count.
 *
 * The anchor check only demands a citation point at symbols the cited file
 * defines: a sentence naming `search_notes`, a value in an example, has no line
 * for the citation to be wrong about.
 */
const declarationPattern = (identifier: string): RegExp =>
	new RegExp(
		`(?:^|\\s)(?:export\\s+)?(?:async\\s+)?(?:const|let|function|type|class|interface)\\s+${identifier}\\b` +
			`|^\\s*(?:readonly\\s+)?${identifier}\\??:`,
		'm',
	)

const declaresIdentifier = (body: string, identifier: string): boolean =>
	declarationPattern(identifier).test(body)

/** Where a declaration sits, 1-based, for a failure that has to say where the code went. */
const declarationLine = (body: string, identifier: string): number | null => {
	const found = declarationPattern(identifier).exec(body)
	if (found === null) return null
	return body.slice(0, found.index).split('\n').length
}

/**
 * The citations whose sentence names no symbol the cited file declares, so the
 * anchor check has nothing to hold them by. Each is a sentence that could name
 * one and does not; the fix is prose, and the entry is here so the remainder
 * is counted. An entry matching
 * no citation fails, so a fixed sentence cannot leave a stale exemption behind.
 */
const UNANCHORED_CITATIONS: readonly {
	readonly file: string
	readonly citation: string
	readonly reason: string
}[] = [
	{
		file: 'docs/how-to/evaluate-tool-use-behavior.md',
		citation: 'src/core/schemas/primitives.ts:28',
		reason:
			'the sentence names `search_notes` and `searchNotes`, which are example values rather than declarations',
	},
	{
		file: 'docs/how-to/evaluate-tool-use-behavior.md',
		citation: 'src/core/compile/sensitivity-witness.ts:394',
		reason:
			'the sentence names the channel `arguments`; the declaration at the cited line is `legalChannels`, which the sentence does not name',
	},
	{
		file: 'docs/how-to/evaluate-tool-use-behavior.md',
		citation: 'src/core/score/qualification.ts:832',
		reason: 'the sentence names no backticked identifier at all',
	},
	{
		file: 'docs/how-to/evaluate-tool-use-behavior.md',
		citation: 'src/core/schemas/sealed-run-record.ts:255',
		reason: 'the sentence names no backticked identifier at all',
	},
	{
		file: 'docs/how-to/evaluate-tool-use-behavior.md',
		citation: 'src/core/compile/reachability.ts:581',
		reason:
			'the sentence names the contract field `artifacts`, which the cited file does not declare',
	},
]

const unanchoredSeen = new Set<string>()
let citationsChecked = 0
let citationsAnchored = 0

/** The sentence around an offset: the enclosing table cell, or the enclosing sentence. */
const sentenceAround = (line: string, offset: number): string => {
	const before = line.slice(0, offset)
	const start = Math.max(before.lastIndexOf('. '), before.lastIndexOf('| ')) + 1
	const rest = line.slice(offset)
	const stop = rest.indexOf('. ')
	const end = stop === -1 ? line.length : offset + stop + 1
	return line.slice(start, end)
}

for (const page of pages) {
	const lines = pageText.get(page) as readonly string[]
	// A bare `plan.ts` means the file a fully-qualified citation named earlier on
	// the same page. Two files are called `plan.ts`, so without this the short
	// form is ambiguous and the check would refuse a citation a reader resolves
	// without effort.
	const qualified = new Map<string, string>()
	lines.forEach((line, index) => {
		for (const match of line.matchAll(CITATION)) {
			const cited = match[1] as string
			const first = Number(match[2])
			const last = Number(match[3] ?? match[2])
			const at = `${page}:${index + 1}`
			const basename = cited.split('/').pop() as string

			let resolved: string | undefined
			if (srcBodies.has(cited)) resolved = cited
			else if (qualified.has(basename)) resolved = qualified.get(basename)
			else {
				const candidates = srcPaths.filter((file) => file.endsWith(`/${cited}`))
				if (candidates.length === 1) resolved = candidates[0]
				else {
					fail(
						`${at}: the citation \`${cited}\` resolves to ${candidates.length} files under src/; ` +
							'spell the path from the repository root',
					)
					continue
				}
			}
			const target = resolved as string
			qualified.set(basename, target)
			citationsChecked += 1

			const body = srcBodies.get(target) as string
			const targetLines = body.split('\n')
			if (targetLines.length < last) {
				fail(
					`${at}: the citation \`${cited}:${last}\` is past the end of ${target}, ` +
						`which has ${targetLines.length} lines`,
				)
				continue
			}

			const sentence = sentenceAround(line, match.index ?? 0)
			const named = [...sentence.matchAll(BACKTICKED)]
				.map((found) => found[1] as string)
				.filter((token) => declaresIdentifier(body, token))
			const spanned = `${target}:${match[2]}${match[3] ? `-${match[3]}` : ''}`
			if (named.length === 0) {
				const exemption = UNANCHORED_CITATIONS.find(
					(entry) => entry.file === page && spanned.endsWith(entry.citation),
				)
				if (exemption === undefined) {
					fail(
						`${at}: the citation \`${cited}:${first}\` sits in a sentence naming no symbol ` +
							`${target} declares, so nothing holds the line number; name one, or register it ` +
							'in UNANCHORED_CITATIONS with the reason',
					)
					continue
				}
				unanchoredSeen.add(compositeKey(exemption.file, exemption.citation))
				continue
			}

			const window = targetLines
				.slice(Math.max(0, first - 1 - CITATION_WINDOW), last + CITATION_WINDOW)
				.join('\n')
			const anchored = named.filter((identifier) =>
				new RegExp(`\\b${identifier}\\b`).test(window),
			)
			if (anchored.length === 0) {
				const moved = named
					.map((identifier) => ({
						identifier,
						line: declarationLine(body, identifier),
					}))
					.filter((each) => each.line !== null)
					.map((each) => `\`${each.identifier}\` is at ${target}:${each.line}`)
					.join(', ')
				fail(
					`${at}: the citation \`${cited}:${first}\` names ${named.map((each) => `\`${each}\``).join(', ')} ` +
						`and none of them is within ${CITATION_WINDOW} lines of ${target}:${first}; ${moved}`,
				)
				continue
			}
			citationsAnchored += 1
		}
	})
}

for (const entry of UNANCHORED_CITATIONS) {
	if (unanchoredSeen.has(compositeKey(entry.file, entry.citation))) continue
	fail(
		`${entry.file}: UNANCHORED_CITATIONS names \`${entry.citation}\`, which the page no longer ` +
			'carries unanchored; drop the entry',
	)
}

// ---------------------------------------------------------------------------
// Class 2: symbols
// ---------------------------------------------------------------------------

/**
 * Backticked identifiers that no file under `src/` declares. Each is a real
 * thing the page is right to name: a Node global, an HTTP method, an
 * environment variable, a shipped filename, or a value in a worked example.
 *
 * The test is declaration and not mention, which is the stronger of the two and
 * costs five more entries than the weaker one. A symbol deleted in a rename
 * commonly survives in a comment that mentions it, so a gate reading mentions
 * would keep passing a page that names something the tree no longer has.
 */
const FOREIGN_IDENTIFIERS: readonly {
	readonly token: string
	readonly reason: string
}[] = [
	{
		token: 'ERR_IMPORT_ATTRIBUTE_MISSING',
		reason: "Node's own error code for a JSON import with no import attribute",
	},
	{ token: 'LICENSE', reason: 'a file the published tarball carries' },
	{
		token: 'updatedAt',
		reason:
			'a field of an example response body, which no shipped schema declares',
	},
	{
		token: 'AbortSignal',
		reason: "the platform's own type, declared by node's lib",
	},
	{
		token: 'PATH',
		reason: 'the environment variable the command-line adapter passes through',
	},
	{
		token: 'POST',
		reason: 'an `HttpMethod` value, which the enum spells as a string literal',
	},
	{
		token: 'PATCH',
		reason: 'an `HttpMethod` value, which the enum spells as a string literal',
	},
	{
		token: 'Original',
		reason:
			"a note title in the worked example's observation, quoted as a value",
	},
	{
		token: 'Revised',
		reason: "the title the worked example's write reported, quoted as a value",
	},
	{
		token: 'searchNotes',
		reason:
			'a tool name in a worked example, showing what the identifier charset admits',
	},
]

const foreignSeen = new Set<string>()
const unknownSymbols = new Map<string, string>()
let symbolsChecked = 0

for (const page of pages) {
	const lines = pageText.get(page) as readonly string[]
	lines.forEach((line, index) => {
		for (const match of line.matchAll(BACKTICKED)) {
			const token = match[1] as string
			if (!isIdentifier(token)) continue
			symbolsChecked += 1
			const foreign = FOREIGN_IDENTIFIERS.find((entry) => entry.token === token)
			if (foreign !== undefined) {
				foreignSeen.add(token)
				continue
			}
			if (declaresIdentifier(allSource, token)) continue
			if (!unknownSymbols.has(token)) {
				unknownSymbols.set(token, `${page}:${index + 1}`)
			}
		}
	})
}

for (const [token, at] of unknownSymbols) {
	fail(
		`${at}: the page spells \`${token}\`, which nothing under src/ declares; ` +
			'it was renamed, removed, or mistyped, or it belongs in FOREIGN_IDENTIFIERS with its reason',
	)
}
for (const entry of FOREIGN_IDENTIFIERS) {
	if (foreignSeen.has(entry.token)) continue
	fail(
		`FOREIGN_IDENTIFIERS names \`${entry.token}\`, which no published page spells; drop the entry`,
	)
}

// ---------------------------------------------------------------------------
// Class 3: transcribed lists
// ---------------------------------------------------------------------------

const referenceAdapters = Object.keys(adapters)
	.filter((name) => /^create[A-Za-z]*Adapter$/.test(name))
	.sort()

/**
 * The conformance runners, read off their own definitions rather than off a
 * published constant, because no constant names them: `src/testing/index.ts`
 * re-exports them one by one and `cli-commands.md` spells all six in a
 * sentence. This is the shape Story 11.7's Decision 18 named as derivable.
 */
const conformanceRunners = [
	...allSource.matchAll(
		/export\s+async\s+function\s+(run[A-Za-z]*Conformance)/g,
	),
]
	.map((match) => match[1] as string)
	.sort()

type ListEntry = {
	readonly file: string
	readonly claim: string
	/** One capture group, holding the stretch of prose that spells the list. */
	readonly pattern: RegExp
	/**
	 * Which backticked tokens inside that stretch are members. Without it a
	 * parenthetical the sentence carries for the reader's benefit, such as
	 * "(the `api` arm)", reads as a list member and the compare fails on prose.
	 */
	readonly tokenShape: RegExp
	readonly expected: readonly string[]
}

/** The kind vocabulary, so a kind list is compared over kinds and nothing else. */
const KIND_TOKEN = new RegExp(`^(?:${INTERFACE_KINDS.join('|')})$`)

/**
 * One entry per sentence that spells a set the source owns. The expected side
 * is always computed above; this table adds a pattern and asserts nothing on
 * its own authority. A pattern matching nothing is a dead entry and fails, on
 * `check-doc-counts.ts`'s rule: a rewritten sentence cannot escape its own gate
 * by drifting out from under the pattern.
 */
const LISTS: readonly ListEntry[] = [
	{
		file: 'docs/how-to/evaluate-skill-behavior.md',
		claim: 'the kinds `compile` accepts',
		pattern: /`compile` accepts ([^.]*?), and rejects a contract declaring/,
		tokenShape: KIND_TOKEN,
		expected: [...SUPPORTED_INTERFACE_KINDS],
	},
	{
		file: 'docs/how-to/evaluate-workflow-behavior.md',
		claim: 'the kinds `compile` accepts',
		pattern: /`compile` accepts ([^.]*?), and rejects a contract declaring/,
		tokenShape: KIND_TOKEN,
		expected: [...SUPPORTED_INTERFACE_KINDS],
	},
	{
		file: 'docs/how-to/evaluate-ai-feature-behavior.md',
		claim: 'the kinds `compile` accepts',
		pattern: /`compile` supports three of the four, ([^.]*?), and rejects/,
		tokenShape: KIND_TOKEN,
		expected: [...SUPPORTED_INTERFACE_KINDS],
	},
	{
		file: 'docs/reference/glossary.md',
		claim: 'the kinds `compile` accepts',
		pattern: /`compile` accepts (.*?)\. The vocabulary also names/,
		tokenShape: KIND_TOKEN,
		expected: [...SUPPORTED_INTERFACE_KINDS],
	},
	{
		file: 'docs/how-to/evaluate-ai-feature-behavior.md',
		claim: 'the interface vocabulary',
		pattern: /four interface kinds in `INTERFACE_KINDS`: ([^.]*?)\./,
		tokenShape: KIND_TOKEN,
		expected: [...INTERFACE_KINDS],
	},
	{
		file: 'docs/index.md',
		claim: 'the kinds refused at compile',
		pattern:
			/kind[s]? parse[s]? and stops? at compilation under `unsupported-interface-kind`: ([^,]*),/,
		tokenShape: KIND_TOKEN,
		expected: [...UNSUPPORTED_INTERFACE_KINDS],
	},
	{
		file: 'docs/explanation/what-ships.md',
		claim: 'the kinds refused at compile',
		// Anchored on the backticked kind itself: an unanchored leading capture
		// runs from the top of the file under the `s` flag and swallows the page.
		pattern:
			/(`[a-z]+`) is the one kind `compile` still refuses under `unsupported-interface-kind`/,
		tokenShape: KIND_TOKEN,
		expected: [...UNSUPPORTED_INTERFACE_KINDS],
	},
	{
		file: 'docs/reference/cli-commands.md',
		claim: 'the reference adapter list',
		pattern: /ships [a-z-]+ reference adapters, ([^.]*?), each a factory/,
		tokenShape: /^create[A-Za-z]*Adapter$/,
		expected: referenceAdapters,
	},
	{
		file: 'docs/reference/cli-commands.md',
		claim: 'the conformance runner list',
		pattern: /one arm per mechanism: ([^.]*?)\. A report carries/,
		tokenShape: /^run[A-Za-z]*Conformance$/,
		expected: conformanceRunners,
	},
]

for (const entry of LISTS) {
	const lines = pageText.get(entry.file)
	if (lines === undefined) {
		fail(`${entry.file}: missing, but a list entry names it`)
		continue
	}
	const text = lines.join('\n')
	// The entry's own flags are carried over, so an entry written `/.../i` does
	// not silently lose its `i` and fail as dead for a reason nobody finds.
	const listFlags = [...new Set([...entry.pattern.flags, 'g', 's'])].join('')
	const found = [...text.matchAll(new RegExp(entry.pattern.source, listFlags))]
	if (found.length !== 1) {
		fail(
			`${entry.file}: ${found.length} sentences match the pattern for ${entry.claim}; ` +
				'a list entry names exactly one, so either the sentence or the entry has to move',
		)
		continue
	}
	const match = found[0] as RegExpExecArray
	const line = text.slice(0, match.index ?? 0).split('\n').length
	const spelled = [...(match[1] as string).matchAll(/`([^`]+)`/g)]
		.map((each) => each[1] as string)
		.filter((each) => entry.tokenShape.test(each))
		.sort()
	const owed = [...entry.expected].sort()
	const extra = spelled.filter((each) => !owed.includes(each))
	const absent = owed.filter((each) => !spelled.includes(each))
	if (extra.length === 0 && absent.length === 0) continue
	const parts: string[] = []
	if (absent.length > 0) parts.push(`omits ${absent.join(', ')}`)
	if (extra.length > 0) parts.push(`adds ${extra.join(', ')}`)
	fail(
		`${entry.file}:${line}: ${entry.claim} ${parts.join(' and ')}; the source has ` +
			`${owed.join(', ')}`,
	)
}

// ---------------------------------------------------------------------------
// Class 4: time-sensitive claims
// ---------------------------------------------------------------------------

/**
 * The shapes a claim takes when its truth depends on when it was written. Two
 * families: a sentence saying a thing has not happened, and a sentence saying
 * something is true as of now. Both are exactly the sentences that go stale
 * when the code moves under them and neither is decidable from the words alone,
 * so the pattern's job is to find candidates and the registry's job is to say
 * how each one is settled.
 */
const TIME_SENSITIVE = new RegExp(
	[
		'\\bno [a-z-]+ (?:has|have)\\b',
		'\\bno live\\b',
		'\\bno committed\\b',
		'\\bno contract in `corpus',
		'\\bno [a-z-]+ yet\\b',
		'\\bnot yet\\b',
		'\\byet to be\\b',
		'\\bnobody has\\b',
		'\\bnot proven\\b',
		'\\bunproven\\b',
		'\\bdoes not yet\\b',
		'\\bcannot yet\\b',
		'\\bstill (?:owed|owes|refuses?|needs?|cannot)\\b',
		'\\bstays deferred\\b',
		'\\bhas had no\\b',
		'\\bis owed\\b',
		'\\bDeferred until\\b',
		'\\btoday\\b',
		'\\bcurrently\\b',
		'\\bfor now\\b',
		'\\*\\*(?:Missing|Blocked|Unproven|Owed)\\.?\\*\\*',
	].join('|'),
	'i',
)

/**
 * A heading that says the section is about what has not happened. Every bullet
 * under one is a dated claim whatever words it uses, which is how
 * `what-ships.md`'s "Two things the project still owes itself" gets held: its
 * bullets carry the claim in the heading rather than in themselves, so a
 * sentence-level trigger reads them as ordinary prose.
 */
const OWED_HEADING = /\b(owes?|owed|deferred|unproven|not yet|still)\b/i

type DatedClaim = {
	readonly file: string
	/** A distinctive stretch of the sentence, matched literally. */
	readonly key: string
	/**
	 * How the claim is settled. A predicate is run and a false result fails the
	 * gate. `'read'` records that no artifact in this repository decides it, and
	 * `reason` says why.
	 */
	readonly settles: 'read' | (() => Promise<boolean> | boolean)
	readonly reason: string
}

const DATED_CLAIMS: readonly DatedClaim[] = [
	{
		file: 'docs/index.md',
		key: 'Three interface kinds compile today',
		settles: () => SUPPORTED_INTERFACE_KINDS.length === 3,
		reason: 'counts `SUPPORTED_INTERFACE_KINDS`',
	},
	{
		file: 'docs/index.md',
		key: 'no live server stands behind it',
		settles: 'read',
		reason:
			'a live MCP server is outside this repository, so no artifact in the tree records whether one was scored; the sentence states how far the fixture carries rather than what is owed',
	},
	{
		file: 'docs/explanation/what-ships.md',
		key: 'is the one kind `compile` still refuses',
		settles: () => UNSUPPORTED_INTERFACE_KINDS.length === 1,
		reason: 'counts `UNSUPPORTED_INTERFACE_KINDS`',
	},
	{
		file: 'docs/how-to/evaluate-skill-behavior.md',
		key: 'nobody has scored a seeded-defect probe against a skill contract',
		settles: 'read',
		reason:
			'a scoring run that was never performed leaves no artifact; Story 11.10 ships the one that falsifies it',
	},
	{
		file: 'docs/how-to/evaluate-skill-behavior.md',
		key: 'is `null` in all eight of those suites',
		settles: 'read',
		reason:
			"the suites are TEA's, in another repository, so this tree holds none of them",
	},
	{
		file: 'docs/how-to/evaluate-workflow-behavior.md',
		key: 'No committed chain carries a capture',
		settles: 'read',
		reason:
			'the committed chain is the worked example, whose generator output this gate does not parse; Story 11.11 ships the chain that falsifies it',
	},
	{
		file: 'docs/how-to/evaluate-workflow-behavior.md',
		key: 'the suite currently has open findings',
		settles: 'read',
		reason: "the suite is TEA's, in another repository",
	},
	{
		file: 'docs/how-to/evaluate-tool-use-behavior.md',
		key: 'which the shipped cli kind answers today',
		settles: () => SUPPORTED_INTERFACE_KINDS.includes('cli'),
		reason: 'holds while `cli` is in `SUPPORTED_INTERFACE_KINDS`',
	},
	{
		file: 'docs/how-to/evaluate-tool-use-behavior.md',
		key: 'compiles, seals, and pre-flights today',
		settles: () => SUPPORTED_INTERFACE_KINDS.includes('cli'),
		reason: 'holds while `cli` is in `SUPPORTED_INTERFACE_KINDS`',
	},
	{
		file: 'docs/how-to/evaluate-tool-use-behavior.md',
		key: 'Reading one answers the same three today',
		settles: () => SUPPORTED_INTERFACE_KINDS.includes('mcp'),
		reason: 'holds while `mcp` is in `SUPPORTED_INTERFACE_KINDS`',
	},
	{
		file: 'docs/how-to/evaluate-tool-use-behavior.md',
		key: 'is the one kind all three still refuse',
		settles: () => UNSUPPORTED_INTERFACE_KINDS.length === 1,
		reason: 'counts `UNSUPPORTED_INTERFACE_KINDS`',
	},
	{
		file: 'docs/how-to/evaluate-tool-use-behavior.md',
		key: '**Missing.**',
		settles: () => McpDescriptorChannel.options.length === 1,
		reason:
			'counts the members of `McpDescriptorChannel`, whose one member is `structured-result`; a second member would be the channel model the sentence says is missing',
	},
	{
		file: 'docs/how-to/evaluate-tool-use-behavior.md',
		key: 'Both sides of the exchange accommodate the kind today',
		settles: () => SUPPORTED_INTERFACE_KINDS.includes('mcp'),
		reason: 'holds while `mcp` is in `SUPPORTED_INTERFACE_KINDS`',
	},
	{
		file: 'docs/how-to/evaluate-tool-use-behavior.md',
		key: '**Unproven, and this is the uncomfortable part.**',
		settles: 'read',
		reason:
			'the calibration record is in the architecture history, and whether it was re-measured against the shipped kind is not recorded anywhere in this tree',
	},
	{
		file: 'docs/how-to/evaluate-tool-use-behavior.md',
		key: 'The first reading runs today',
		settles: 'read',
		reason: "TEA's own move is a fact about another repository's contracts",
	},
	{
		file: 'docs/how-to/evaluate-ai-feature-behavior.md',
		key: 'is declared `kind: "api"` today',
		settles: () => UNSUPPORTED_INTERFACE_KINDS.includes('web'),
		reason: 'holds while `web` is refused and `api` is accepted',
	},
	{
		file: 'docs/how-to/evaluate-agent-behavior.md',
		key: 'Not proven, and worth knowing before you plan a corpus',
		settles: 'read',
		reason:
			'introduces the unproven block below it; the claim itself is the block',
	},
	{
		file: 'docs/how-to/evaluate-agent-behavior.md',
		key: 'has no scoring-side signature today',
		settles: () =>
			(QUALIFICATION_FAILURES as readonly string[]).includes(
				'condition-artifact-channel-contract-local',
			),
		reason:
			'reads whether the qualification gate still publishes the code it refuses an `artifact`-channel signature with; the day a signature may address a written file, that code stops being the reason',
	},
	{
		file: 'docs/reference/cli-commands.md',
		key: '| Port | What it does | Wired today |',
		settles: 'read',
		reason:
			'which ports the CLI awaits is a fact about the command implementation, which this gate does not execute',
	},
]

const datedSeen = new Set<string>()
let datedRead = 0
let datedDerived = 0

for (const page of authoredPages) {
	const lines = pageText.get(page) as readonly string[]
	let owedSection = false
	for (const [index, line] of lines.entries()) {
		if (line.startsWith('#')) {
			// A heading names the section rather than making the claim, so it is
			// what turns the section on and never a registration of its own.
			owedSection = OWED_HEADING.test(line)
			continue
		}
		const dated =
			TIME_SENSITIVE.test(line) || (owedSection && line.startsWith('- '))
		if (!dated) continue
		const entry = DATED_CLAIMS.find(
			(each) => each.file === page && line.includes(each.key),
		)
		if (entry === undefined) {
			fail(
				`${page}:${index + 1}: this sentence claims something is true as of now, or not yet ` +
					'true, and no DATED_CLAIMS entry holds it; register it with how it is settled',
			)
			continue
		}
		datedSeen.add(compositeKey(entry.file, entry.key))
	}
}

for (const entry of DATED_CLAIMS) {
	// A key names one sentence. Without this an entry keyed on something short,
	// `**Missing.**` say, registers every later line carrying the same words, so
	// a new and false dated claim rides in on an existing registration. Class 3
	// applies the same rule to a list pattern.
	const lines = pageText.get(entry.file) ?? []
	const carrying = lines.filter((line) => line.includes(entry.key)).length
	if (carrying === 0) {
		fail(
			`${entry.file}: DATED_CLAIMS holds "${entry.key}", which the page no longer carries; ` +
				'the sentence was rewritten, so re-read the claim and move the entry',
		)
		continue
	}
	if (carrying > 1) {
		fail(
			`${entry.file}: ${carrying} sentences carry "${entry.key}"; a DATED_CLAIMS entry names ` +
				'one, so either the new sentence needs its own entry or the key needs to be longer',
		)
		continue
	}
	if (!datedSeen.has(compositeKey(entry.file, entry.key))) {
		fail(
			`${entry.file}: DATED_CLAIMS holds "${entry.key}", and the sentence carrying it no longer ` +
				'reads as a dated claim; re-read it and move the entry',
		)
		continue
	}
	if (entry.settles === 'read') {
		datedRead += 1
		continue
	}
	datedDerived += 1
	if (await entry.settles()) continue
	fail(
		`${entry.file}: "${entry.key}" is no longer true; the check that settles it ` +
			`(${entry.reason}) now answers no`,
	)
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Class 5: named codes
// ---------------------------------------------------------------------------

/**
 * A page saying a contract "is rejected with `unsupported-interface-kind`" is
 * transcribing a registry entry, and the entry either exists or it does not.
 *
 * The trigger is the verb, not the token's shape. A kebab token on its own is
 * as likely to be an example step id (`manifest-ac-2`), a runner in another
 * repository (`tea-trace-runner`), or a phrase a page coined, and none of those
 * is a claim about this tree. So the check fires only where a page says a code
 * is raised, thrown, reported, or refused under, and then that code has to be
 * in one of the two registries or spelled as a string literal under `src/`.
 *
 * What this leaves: a second code named later in the same sentence, past its
 * verb, goes unchecked. Widening the trigger to the whole sentence readmits the
 * example ids, so the boundary sits here and the remainder is review's.
 */
const knownCodes = new Set<string>([...FAILURE_CODES, ...RUNTIME_FAULT_CODES])
const CODE_CLAIM =
	/(?:raises?|throws?|rejected with|refuses? .{0,40}?under|refused .{0,40}?under|fails? with|reports? (?:it )?as|exits? with|answers?|the code|stops? at compilation under|under)\s+`([a-z][a-z0-9]*(?:-[a-z0-9]+)+)`/g

const unknownCodes = new Map<string, string>()
let codesChecked = 0

for (const page of authoredPages) {
	const lines = pageText.get(page) as readonly string[]
	lines.forEach((line, index) => {
		for (const match of line.matchAll(CODE_CLAIM)) {
			const token = match[1] as string
			codesChecked += 1
			if (knownCodes.has(token)) continue
			if (allSource.includes(`'${token}'`)) continue
			if (!unknownCodes.has(token)) {
				unknownCodes.set(token, `${page}:${index + 1}`)
			}
		}
	})
}

for (const [token, at] of unknownCodes) {
	fail(
		`${at}: the page says \`${token}\` is raised, which is in neither failure registry and which ` +
			'nothing under src/ spells as a string literal; it was renamed, removed, or mistyped',
	)
}

// ---------------------------------------------------------------------------
// Class 6: worked JSON
// ---------------------------------------------------------------------------

/**
 * A page that prints a JSON block and says it parses is making the strongest
 * claim on the page, because a reader copies it. The block either parses
 * against the schema the prose names or it does not, so this class decides
 * rather than registers.
 *
 * It is the class the epic's own premise is about. `evaluate-agent-behavior.md`
 * shipped a defect signature that stopped parsing when the probe's input
 * binding gained a ninth channel, and no gate in the tree read it: the doc
 * invocation checker runs fenced commands and never opens a fence a command
 * does not consume.
 *
 * Blocks are found by the sentence that introduces them, not by line number, so
 * the entry survives a paragraph moving. A sentence matching nothing is a dead
 * entry and fails.
 */
type FenceEntry = {
	readonly file: string
	readonly claim: string
	/** The sentence before the fence. The next ```json block after it is parsed. */
	readonly intro: RegExp
	readonly schema: z.ZodType
	/** `each` parses every member of a top-level array against the schema. */
	readonly shape: 'one' | 'each'
}

const FENCES: readonly FenceEntry[] = [
	{
		file: 'docs/how-to/evaluate-ai-feature-behavior.md',
		claim: "the worked example's api interface",
		intro: /It parses as a `PermittedInterface`:/,
		schema: PermittedInterface,
		shape: 'one',
	},
	{
		file: 'docs/how-to/evaluate-ai-feature-behavior.md',
		claim: "oracle O-001's read-back check",
		intro: /it is O-001 in the worked example:/,
		schema: Expression,
		shape: 'one',
	},
	{
		file: 'docs/how-to/evaluate-agent-behavior.md',
		claim: "the agent guide's cli interface",
		intro: /This block parses against `PermittedInterface`:/,
		schema: PermittedInterface,
		shape: 'one',
	},
	{
		file: 'docs/how-to/evaluate-agent-behavior.md',
		claim: 'the manifestation witness',
		intro: /is caught before it is scored\./,
		schema: ManifestationWitness,
		shape: 'one',
	},
	{
		file: 'docs/how-to/evaluate-agent-behavior.md',
		claim: "the command defect signature's condition",
		intro: /for this defect it rides on the exit code:/,
		schema: DefectSignature,
		shape: 'one',
	},
	{
		file: 'docs/how-to/evaluate-tool-use-behavior.md',
		claim: "the tool-call defect signature's condition",
		intro: /its selector filters on the `arguments` channel\./,
		schema: DefectSignature,
		shape: 'one',
	},
	{
		file: 'docs/how-to/evaluate-skill-behavior.md',
		claim: "the skill guide's cli interface",
		intro: /This interface parses against the published `EvalContract` schema/,
		schema: PermittedInterface,
		shape: 'one',
	},
	{
		file: 'docs/how-to/evaluate-skill-behavior.md',
		claim: 'the inclusion half of the selection oracle',
		intro:
			/The inclusion half says the run named everything the rules mandate:/,
		schema: Expression,
		shape: 'one',
	},
	{
		file: 'docs/how-to/evaluate-skill-behavior.md',
		claim: 'the exclusion oracle',
		intro: /The exclusion half is what rejects it:/,
		schema: Oracle,
		shape: 'one',
	},
	{
		file: 'docs/how-to/evaluate-workflow-behavior.md',
		claim: "the workflow guide's interaction plan",
		intro: /an absent field and an unrecognized field both fail the parse\./,
		schema: InteractionStep,
		shape: 'each',
	},
]

/**
 * A union reports one opaque "Invalid input" at the root and hides which branch
 * came closest, so the branch errors are pulled up. Without this the failure
 * message names the block and nothing inside it, which is the difference
 * between a gate a reader can act on and one they have to re-derive.
 */
type Issue = { readonly path: readonly PropertyKey[]; readonly message: string }
const flatten = (issues: readonly Issue[]): readonly Issue[] =>
	issues.flatMap((issue) => {
		const nested = (issue as { errors?: readonly (readonly Issue[])[] }).errors
		// A discriminated union whose tag is wrong reports `errors: []` and puts
		// the whole message on the issue itself ("Invalid discriminator value.
		// Expected 'api' | 'web' | 'mcp' | 'cli'"). Recursing into the empty list
		// discards it and the failure prints an empty parenthesis, which is the
		// shape a doc block declaring a retired `kind` produces.
		if (nested === undefined || nested.length === 0) return [issue]
		const branches = nested
			.map((branch) => flatten(branch))
			.filter((branch) => branch.length > 0)
		if (branches.length === 0) return [issue]
		// Deepest path wins. The branch with the fewest issues is the shallowest
		// one, which reports "expected array to have >=2 items" over the member
		// that is actually malformed.
		const reach = (branch: readonly Issue[]): number =>
			Math.max(...branch.map((each) => each.path.length))
		return [...branches].sort(
			(a, b) => reach(b) - reach(a),
		)[0] as readonly Issue[]
	})

const FENCE_OPEN = '```json'
/** How far below its own sentence a fence may sit. A blank line, and a little slack. */
const FENCE_LOOKAHEAD = 3
const FENCE_CLOSE = '```'

for (const entry of FENCES) {
	const lines = pageText.get(entry.file)
	if (lines === undefined) {
		fail(`${entry.file}: missing, but a fence entry names it`)
		continue
	}
	const introAt = lines.findIndex((line) => entry.intro.test(line))
	if (introAt === -1) {
		fail(
			`${entry.file}: no sentence introduces ${entry.claim}; the entry is dead and either ` +
				'the sentence or the entry has to move',
		)
		continue
	}
	// Bounded: an unbounded search binds the entry to whatever json block comes
	// next, so inserting an unrelated example between an intro and its block
	// silently retargets the check and it passes while reading the wrong thing.
	const open = lines.findIndex(
		(line, index) =>
			index > introAt &&
			index <= introAt + FENCE_LOOKAHEAD &&
			line.trim() === FENCE_OPEN,
	)
	if (open === -1) {
		fail(
			`${entry.file}:${introAt + 1}: ${entry.claim} is introduced with no json fence after it`,
		)
		continue
	}
	const close = lines.findIndex(
		(line, index) => index > open && line.trim() === FENCE_CLOSE,
	)
	if (close === -1) {
		fail(
			`${entry.file}:${open + 1}: the json fence for ${entry.claim} is never closed`,
		)
		continue
	}
	const body = lines.slice(open + 1, close).join('\n')
	let value: unknown
	try {
		value = JSON.parse(body)
	} catch (error) {
		fail(
			`${entry.file}:${open + 2}: ${entry.claim} is not valid JSON (${(error as Error).message})`,
		)
		continue
	}
	const values =
		entry.shape === 'each' && Array.isArray(value) ? value : [value]
	if (entry.shape === 'each' && !Array.isArray(value)) {
		fail(
			`${entry.file}:${open + 2}: ${entry.claim} is declared as an array and is not one`,
		)
		continue
	}
	values.forEach((member, index) => {
		const parsed = entry.schema.safeParse(member)
		if (parsed.success) return
		const where = entry.shape === 'each' ? ` member ${index}` : ''
		const issues = flatten(parsed.error.issues)
			.slice(0, 3)
			.map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
			.join('; ')
		fail(
			`${entry.file}:${open + 2}: ${entry.claim}${where} does not parse against its schema ` +
				`(${issues})`,
		)
	})
}

// ---------------------------------------------------------------------------
// Class 7: which kinds are accepted and which are refused
// ---------------------------------------------------------------------------

/**
 * The epic's own defect, as a class rather than as a list of sentences.
 *
 * Every page describing `mcp` as refused went stale the day `compile` accepted
 * it, and four of those sentences were found by a person reading. Class 3 holds
 * the nine sentences somebody enumerated; this holds the shape, so a sentence
 * written tomorrow on a page no entry covers is checked the same way. It reads
 * `SUPPORTED_INTERFACE_KINDS` and `UNSUPPORTED_INTERFACE_KINDS` and has nothing
 * to register.
 *
 * A kind is classified by the nearest verb before it in its own sentence, and
 * by a refusal verb after it when nothing precedes it, which is what carries "a
 * contract declaring `web` is rejected". Sentence boundaries stop a verb
 * reaching across a full stop, and `used to reject` is skipped because the
 * tense makes it a statement about the past.
 *
 * What it does not decide, and every one of these passes rather than failing:
 * a kind named with no verb near it; a kind governed by a verb the vocabulary
 * below does not carry, which is where two of the three defeats this check
 * survived came from, so the vocabulary carries as much of the guarantee as the
 * logic does; a kind whose verb the sentence negates or puts in the past, which
 * is skipped, so "`compile` does not accept `mcp`" is false about the tree and
 * passes green, and this is the only one of the four where that happens rather
 * than the class having nothing to go on; and whether the code a refusal names
 * is the one that surface actually raises, since class 5 answers only that a
 * named code exists.
 *
 * One shape it decides wrongly, recorded rather than chased: a list used as the
 * subject with its verb after it, "`web` is rejected and `api`, `cli`, and
 * `mcp` compile", puts the governing verb past the intervening kinds and no
 * span rule reaches it, so the first two members read as refused. It fails a
 * true sentence rather than passing a false one, and no page in `docs/` writes
 * a kind list that way.
 */
const KIND_TOKEN_IN_PROSE = new RegExp(
	`\`(${INTERFACE_KINDS.join('|')})\``,
	'g',
)
const KIND_VERB =
	/\b(accepts?|accepted|admits?|admitted|supports?|supported|compiles?|compiled|rejects?|rejected|refuses?|refused|stops at compilation)\b/gi
const REFUSAL_VERB =
	/^(?:rejects?|rejected|refuses?|refused|stops at compilation)$/i

/**
 * A verb the sentence negates or puts in the past decides nothing. "`compile`
 * does not accept `mcp`" is false and would pass a reader of the verb alone,
 * and "a contract declaring `mcp` is no longer rejected" is true and would
 * fail. Skipping both leaves them undecided, which the header already says is
 * where the boundary is.
 */
const NEGATED_OR_PAST =
	/\b(?:not|never|no longer|cannot|used to|nor)\b[^.]{0,24}$/i

/**
 * A bare `-ed` form is past tense; the same form after a present `be` is the
 * passive present a page uses for a live rule. Both sides of the vocabulary
 * carry their participles: without `accepted`, "a contract declaring `web` is
 * accepted" holds no verb at all and passes as undecided, which guards refusal
 * and leaves acceptance open. "Before Epic 11, `compile`
 * rejected `mcp`" is a page narrating its own history, and `was` and `were` are
 * past too, so only the present forms count.
 */
const PAST_PARTICIPLE =
	/^(?:rejected|refused|accepted|admitted|supported|compiled)$/i
/**
 * The `be` may be a word or two away. `still` is this repository's own phrasing,
 * as `what-ships.md:42` uses it, and an adverb between the auxiliary and the
 * participle does not make the sentence past. The tense case this guards
 * against, "`compile` rejected `mcp`", carries no `be` at any distance.
 */
const PRESENT_BE =
	/\b(?:is|are|be|been|being)\s+(?:(?:[a-z]+ly|still|now|also|already|then)\s+){0,2}$/i

/** Only whitespace and auxiliaries, so the kind is the subject of what follows. */
const SUBJECT_GAP =
	/^\s*(?:(?:is|are|be|been|being|still|now|also|then|already)\s+)*$/i

let kindMentions = 0

for (const page of authoredPages) {
	const lines = pageText.get(page) as readonly string[]
	lines.forEach((line, index) => {
		for (const sentence of line.split(/(?<=\.)\s+/)) {
			const verbs = [...sentence.matchAll(KIND_VERB)]
				.map((match) => ({
					at: match.index ?? 0,
					verb: match[1] as string,
					refuses: REFUSAL_VERB.test(match[1] as string),
				}))
				// `compile` in backticks is the command's name. Read as a verb it
				// governs the kind beside it, so "`web` is the one kind `compile`
				// still refuses" reads as acceptance.
				.filter(
					(verb) =>
						!(
							sentence[verb.at - 1] === '`' &&
							sentence[verb.at + verb.verb.length] === '`'
						),
				)
				.filter((verb) => !NEGATED_OR_PAST.test(sentence.slice(0, verb.at)))
				.filter(
					(verb) =>
						!PAST_PARTICIPLE.test(verb.verb) ||
						PRESENT_BE.test(sentence.slice(0, verb.at)),
				)
			for (const found of sentence.matchAll(KIND_TOKEN_IN_PROSE)) {
				const at = found.index ?? 0
				const before = verbs.filter((verb) => verb.at < at).at(-1)
				const after = verbs.find((verb) => verb.at > at)
				// A verb governs the whole enumeration it opens, so a preceding verb
				// with another kind between it and this one wins whatever follows:
				// "`compile` accepts `api`, `cli`, and `mcp`, and rejects `web`".
				// With nothing between, the nearer verb wins, which is what separates
				// "`web` is rejected, and `mcp` compiles" from the enumeration.
				const enumerated =
					before !== undefined &&
					KIND_TOKEN_IN_PROSE.test(sentence.slice(before.at, at))
				KIND_TOKEN_IN_PROSE.lastIndex = 0
				// An enumerated kind is an object of the verb that opened the list,
				// unless the verb after it is its own. What separates the two is the
				// span on the far side: a list member is followed by punctuation
				// ("`, and "), and a subject is followed by an auxiliary (" is ").
				const subjectOfAfter =
					after !== undefined &&
					SUBJECT_GAP.test(sentence.slice(at + found[0].length, after.at))
				const nearer =
					before === undefined
						? after
						: after === undefined || at - before.at <= after.at - at
							? before
							: after
				const governing = enumerated && !subjectOfAfter ? before : nearer
				if (governing === undefined) continue
				kindMentions += 1
				const kind = found[1] as string
				const owed = governing.refuses
					? UNSUPPORTED_INTERFACE_KINDS
					: SUPPORTED_INTERFACE_KINDS
				if ((owed as readonly string[]).includes(kind)) continue
				fail(
					`${page}:${index + 1}: the sentence has "${governing.verb}" governing \`${kind}\`, and ` +
						`${governing.refuses ? 'UNSUPPORTED_INTERFACE_KINDS' : 'SUPPORTED_INTERFACE_KINDS'} ` +
						`is ${owed.join(', ')}`,
				)
			}
		}
	})
}

// ---------------------------------------------------------------------------
// Class 8: transcriptions
// ---------------------------------------------------------------------------

/**
 * A page that reprints a string the binary emits is claiming the two are the
 * same bytes. `render.ts`'s docblock said the `--help` output and the README
 * "cannot drift", and nothing compared them: `tests/cli/render.test.ts` holds
 * the README's markdown rows, and the verbatim copy in
 * `docs/reference/cli-commands.md` was held by nobody. Changing `runtime fault`
 * to `runtime failure` on that page left every gate green.
 *
 * A substring compare rather than a fence walk, because the claim is that the
 * page carries these bytes and the fence around them is presentation.
 */
const TRANSCRIPTIONS: readonly {
	readonly file: string
	readonly claim: string
	readonly text: string
}[] = [
	{
		file: 'docs/reference/cli-commands.md',
		claim: "the CLI's exit-code table",
		text: EXIT_CODE_TABLE,
	},
]

for (const entry of TRANSCRIPTIONS) {
	const lines = pageText.get(entry.file)
	if (lines === undefined) {
		fail(`${entry.file}: missing, but a transcription entry names it`)
		continue
	}
	if (lines.join('\n').includes(entry.text)) continue
	const head = entry.text.split('\n')[0] as string
	const at = lines.indexOf(head)
	fail(
		`${entry.file}${at === -1 ? '' : `:${at + 1}`}: ${entry.claim} no longer matches the string ` +
			'the binary emits; the transcription and its source have to be the same bytes',
	)
}

if (failures.length > 0) {
	for (const failure of failures) console.error(failure)
	console.error(
		`check-doc-claims: ${failures.length} prose claim(s) disagree with the tree`,
	)
	process.exit(1)
}

console.log(
	`check-doc-claims: ${citationsChecked} citations resolve (${citationsAnchored} anchored on a ` +
		`symbol, ${UNANCHORED_CITATIONS.length} held by review), ${symbolsChecked} backticked ` +
		`identifiers are declared under src/, ${LISTS.length} transcribed lists match their source, ` +
		`${codesChecked} named codes exist, ${TRANSCRIPTIONS.length} transcription matches its source ` +
		`byte for byte, ${kindMentions} interface-kind mentions agree with the ` +
		`accepted and refused tuples, ${FENCES.length} worked JSON blocks parse against their ` +
		`schema, ${datedDerived + datedRead} time-sensitive claims ` +
		`registered (${datedDerived} settled by a predicate here, ${datedRead} by review)`,
)
