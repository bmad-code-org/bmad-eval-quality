// A published gate: the hand-written prose claims in the pages a consumer
// names, held against the tree those pages describe. This is the class of
// sentence that is neither a number nor a fenced command, and that nothing in a
// normal build reads.
//
// It exists because opening one interface kind in this repository made every
// page describing that kind as refused stale at once, and four of those
// sentences were found by a person reading. A frontmatter check reads
// whitespace and never opens a page body; an invocation check judges fenced
// commands against their declared exit codes; a count check holds numerals. A
// sentence naming a symbol, transcribing a source list, citing a line, or
// saying a thing is not yet true fell through all three.
//
// Not every prose claim is mechanically decidable, and this gate does not
// pretend otherwise. Eight classes, each resolving against an artifact in the
// consumer's own tree, and each driven by its own block in the configuration:
//
//   1. Citations. A `path.ts:N` reference resolves to a file, the line is in
//      range, and a symbol the sentence names and the cited file declares sits
//      inside the cited window.
//   2. Symbols. An identifier a page spells in backticks is declared in the
//      source roots. A mention in a comment does not save a name that was
//      renamed.
//   3. Transcribed lists. A list a page spells out equals the set a module of
//      yours exports.
//   4. Time-sensitive claims. A sentence saying a thing is not yet true, is
//      true "today", or pins a reading to a released version, is registered
//      with how it is settled: by a predicate of yours, or by a recorded human
//      reading with the reason no artifact can decide it.
//   5. Named codes. A code a page says is raised exists in a registry.
//   6. Worked JSON. A published example block parses against the schema the
//      prose names.
//   7. Vocabulary. A token a sentence says is accepted is in your accepted set,
//      and one it says is refused is in your refused set.
//   8. Transcriptions. A page reprinting a string your code emits carries the
//      same bytes.
//
// Six of the eight are classes and two are inventories, and the difference
// decides what the gate promises. Classes 1, 2, 5, 6 and 7 hold every sentence
// on every page, including one written tomorrow. Classes 3, 4 and 8 hold the
// sentences somebody enumerated, and what they guarantee is that a listed
// sentence cannot be rewritten or drift out from under its entry without
// failing.
//
// Class 4 is the one that needs explaining. The truth of "no live server has
// been scored end to end" is not in any tree, so no check can decide it. What a
// check can decide is that the sentence exists and is registered, which turns
// an invisible claim into an enumerated one: a new unproven claim fails until
// somebody writes down who holds it and why, and a registered claim whose
// sentence was rewritten fails as a dead entry. That is weaker than deciding
// the claim and stronger than the nothing that precedes it.
//
// What stays outside all eight: editorial judgment, design rationale, anything
// about the world beyond the tree, any claim about runtime behaviour that only
// executing the code would settle, and whether a code a page names is the one
// that surface actually raises, which class 5 does not ask. The report line
// prints what review holds, so the remainder is visible.
//
// The gate never rewrites a page, on the rule that a check able to repair what
// it checks is not a gate.
//
// Run by `node` directly: Node's type stripping erases types only, so no
// TypeScript enum, namespace, parameter property, or non-type re-export may
// appear in this file or anything it imports.
import { realpathSync } from 'node:fs'
import { lstat, readdir, readFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { z } from 'zod'
import {
	compileGlobalPattern,
	compilePattern,
	ProsePattern,
} from './consumer-pattern.ts'
import {
	ModuleValue,
	type ModuleValueConfig,
	nameOf,
	readModuleParser,
	readModuleStrings,
	readModuleText,
	readModuleVerdict,
} from './module-value.ts'
import {
	discoverEntries,
	RelativePath,
	ScannedPathList,
} from './scanned-paths.ts'

/** A path the configuration named that the gate could not read. */
export const DOC_CLAIM_PATH = 'EVAL_QUALITY_DOC_CLAIM_PATH'

const codedError = (code: string, message: string): Error =>
	Object.assign(new Error(message), { code })

const NonEmpty = z.string().min(1)

const Extension = z
	.string()
	.regex(
		/^\.[A-Za-z0-9][A-Za-z0-9.]*$/,
		'is not a file extension; write it with its leading dot, as ".ts"',
	)

/**
 * The identifier shapes a page backticks and the tree ought to declare:
 * camelCase, PascalCase with an inner capital, SCREAMING_SNAKE, and a single
 * PascalCase word, which is what covers a published type name a page names with
 * no citation to hold it.
 *
 * Deliberately narrower than "any backticked word", because a page also
 * backticks value names, channel names, failure codes and file paths, and none
 * of those is a symbol the tree declares. A consumer whose vocabulary differs
 * replaces it.
 */
const DEFAULT_IDENTIFIER_SHAPE = {
	match:
		'^(?:[a-z]+[A-Z]|[A-Z][a-z]+[A-Z]|[A-Z][A-Z0-9_]{3,}$|[A-Z][a-z]{3,}$)',
	flags: '',
}

const CitationsBlock = z
	.strictObject({
		extensions: z
			.array(Extension)
			.min(1)
			.default(['.ts', '.mjs', '.json'])
			.describe('What a citation may point at.'),
		window: z
			.int()
			.min(0)
			.default(4)
			.describe(
				'How far a citation may drift before it reads as stale. Four lines absorbs a reformat or an inserted comment; a moved declaration is further than that.',
			),
		unanchored: z
			.array(
				z.strictObject({
					file: RelativePath,
					citation: NonEmpty.describe(
						'The cited `path:line`, as the page spells it.',
					),
					reason: NonEmpty.describe(
						'Why the sentence names no symbol the cited file declares. The fix is prose, and the entry is what keeps the remainder counted.',
					),
				}),
			)
			.default([])
			.describe(
				'Citations held by review. An entry matching no citation fails, so a fixed sentence cannot leave a stale exemption behind.',
			),
	})
	.describe(
		'Every `path:line` a page cites resolves, is in range, and sits within the window of a symbol the sentence names.',
	)

const SymbolsBlock = z
	.strictObject({
		shape: ProsePattern.default(DEFAULT_IDENTIFIER_SHAPE).describe(
			'Which backticked tokens read as identifiers the tree should declare.',
		),
		foreign: z
			.array(
				z.strictObject({
					token: NonEmpty,
					reason: NonEmpty.describe(
						'Why the page is right to name something the tree does not declare.',
					),
				}),
			)
			.default([])
			.describe(
				'Identifiers no source root declares and the page is right to name. An entry no page spells fails, so a rename cannot leave one behind.',
			),
	})
	.describe(
		'Every backticked identifier on a page is declared in the source roots.',
	)

const ListEntry = z.strictObject({
	file: RelativePath,
	claim: NonEmpty.describe('What the sentence lists, for the failure message.'),
	pattern: ProsePattern.describe(
		'The sentence, with one capture group holding the stretch of prose that spells the list.',
	),
	tokenShape: z
		.union([ProsePattern, ModuleValue])
		.describe(
			'Which backticked tokens inside that stretch are members: a pattern their spelling matches, or a module export holding the whole vocabulary they come from. Without it a parenthetical the sentence carries for the reader reads as a member and the compare fails on prose.',
		),
	expected: ModuleValue.describe('The set the source owns.'),
})

const CodesBlock = z
	.strictObject({
		pattern: ProsePattern.describe(
			'Where a page says a code is raised, with one capture group holding the code.',
		),
		registries: z
			.array(ModuleValue)
			.min(1)
			.describe('The lists of codes that exist.'),
		literalInSources: z
			.boolean()
			.default(true)
			.describe(
				'Whether a code spelled as a string literal anywhere in the source roots also counts, which is what covers a code no registry names.',
			),
	})
	.describe('Every code a page says is raised exists.')

const FenceEntry = z.strictObject({
	file: RelativePath,
	claim: NonEmpty,
	intro: ProsePattern.describe(
		'The sentence before the fence. The next json block after it is parsed, so the entry survives a paragraph moving.',
	),
	schema: ModuleValue.describe('The schema the block parses against.'),
	shape: z
		.enum(['one', 'each'])
		.default('one')
		.describe(
			'Whether the block is one value, or a top-level array whose every member parses.',
		),
	lookahead: z
		.int()
		.min(1)
		.default(3)
		.describe(
			'How far below its own sentence a fence may sit. Unbounded, an entry binds to whatever json block comes next, so an unrelated example inserted between silently retargets the check.',
		),
})

const VERBS_THAT_ACCEPT = [
	'accepts',
	'accept',
	'accepted',
	'admits',
	'admit',
	'admitted',
	'supports',
	'support',
	'supported',
	'compiles',
	'compile',
	'compiled',
]

const VERBS_THAT_REFUSE = [
	'rejects',
	'reject',
	'rejected',
	'refuses',
	'refuse',
	'refused',
	'stops at compilation',
]

const VocabularyBlock = z
	.strictObject({
		tokens: ModuleValue.describe('The whole vocabulary a sentence may name.'),
		accepted: ModuleValue.describe('The members a sentence may call accepted.'),
		refused: ModuleValue.describe('The members a sentence may call refused.'),
		verbs: z
			.strictObject({
				accepts: z.array(NonEmpty).min(1).default(VERBS_THAT_ACCEPT),
				refuses: z.array(NonEmpty).min(1).default(VERBS_THAT_REFUSE),
				participles: z
					.array(NonEmpty)
					.optional()
					.describe(
						'Which of your verbs are participles, so a bare one reads as past tense and the same form after a present "be" reads as the passive present. Left out, every verb ending in "-ed" is one, which is wrong for a base form spelled that way, "exceed" or "succeed".',
					),
			})
			.default({ accepts: VERBS_THAT_ACCEPT, refuses: VERBS_THAT_REFUSE })
			.describe(
				'The verbs that classify a token. The vocabulary carries as much of the guarantee as the logic does: a verb missing from both lists leaves its sentence undecided.',
			),
	})
	.superRefine((block, ctx) => {
		// A verb in both lists is read as a refusal, because the refusal set is
		// what the classifier tests. Every sentence using it would then be judged
		// backwards, and nothing else in the gate would notice.
		const shared = block.verbs.accepts.filter((verb) =>
			block.verbs.refuses.includes(verb),
		)
		if (shared.length > 0) {
			ctx.addIssue({
				code: 'custom',
				path: ['verbs'],
				message: `carries ${shared.join(', ')} in both lists, and a verb in both is read as a refusal`,
			})
		}
		const all = [...block.verbs.accepts, ...block.verbs.refuses]
		const stray = (block.verbs.participles ?? []).filter(
			(verb) => !all.includes(verb),
		)
		if (stray.length === 0) return
		ctx.addIssue({
			code: 'custom',
			path: ['verbs', 'participles'],
			message: `names ${stray.join(', ')}, which neither verb list carries, so nothing would ever be tested against it`,
		})
	})
	.describe(
		'Every sentence saying a member of your vocabulary is accepted or refused agrees with the two sets.',
	)

const DatedBlock = z
	.strictObject({
		triggers: z
			.array(ProsePattern)
			.min(1)
			.describe(
				'The shapes a claim takes when its truth depends on when it was written. A sentence matching one has to be registered below.',
			),
		headings: ProsePattern.optional().describe(
			'A heading that says its section is about what has not happened, so every bullet under one is dated whatever words it uses.',
		),
		claims: z
			.array(
				z.strictObject({
					file: RelativePath,
					key: NonEmpty.describe(
						'A distinctive stretch of the sentence, matched literally. It names one sentence: a key short enough to match two lets a new and false claim ride in on an existing registration.',
					),
					settles: z
						.union([z.literal('read'), ModuleValue])
						.describe(
							'How the claim is settled. A predicate is run and a false answer fails the gate. "read" records that no artifact decides it.',
						),
					reason: NonEmpty.describe(
						'What the predicate reads, or why nothing in the tree can decide it.',
					),
				}),
			)
			.min(1),
	})
	.describe(
		'Every sentence whose truth depends on when it was written is registered with how it is settled.',
	)

const TranscriptionEntry = z.strictObject({
	file: RelativePath,
	claim: NonEmpty,
	text: ModuleValue.describe(
		'The bytes the page reprints: a string export, or a function returning one.',
	),
})

/**
 * How many capture groups a pattern has. A `lists` entry reads its first group
 * and a `codes` block reads the code out of its own, so a pattern with none
 * reaches an `undefined` at run time and throws a stack instead of a refusal.
 *
 * The alternation with an empty branch makes the pattern match the empty string,
 * so the result carries one slot per group whatever the subject is.
 */
const captureGroups = (pattern: Pattern): number => {
	const probe = new RegExp(`${pattern.match}|`, pattern.flags)
	return (probe.exec('')?.length ?? 1) - 1
}

type RefineContext = {
	addIssue(issue: {
		code: 'custom'
		path: PropertyKey[]
		message: string
	}): void
}

const requireOneGroup = (
	pattern: Pattern,
	ctx: RefineContext,
	path: PropertyKey[],
	reads: string,
): void => {
	if (captureGroups(pattern) > 0) return
	ctx.addIssue({
		code: 'custom',
		path,
		message: `has no capture group, and ${reads} is read out of the first one`,
	})
}

export const DocClaimsSection = z
	.strictObject({
		pages: z
			.array(RelativePath)
			.min(1)
			.describe('The published pages, as files or directories to walk.'),
		generated: z
			.array(NonEmpty)
			.default([])
			.describe(
				'Filename suffixes marking a generated page. A generator writes its own vocabulary, so the enumerated classes skip those pages while the derived classes still read them.',
			),
		sources: ScannedPathList.optional().describe(
			'The code the pages describe. Citations resolve into it, symbols are declared in it, and a literal code is looked up in it. Required by those three classes and by nothing else, so a section adopting only the enumerated ones leaves it out.',
		),
		citations: CitationsBlock.optional(),
		symbols: SymbolsBlock.optional(),
		lists: z.array(ListEntry).min(1).optional(),
		codes: CodesBlock.optional(),
		fences: z.array(FenceEntry).min(1).optional(),
		vocabulary: VocabularyBlock.optional(),
		dated: DatedBlock.optional(),
		transcriptions: z.array(TranscriptionEntry).min(1).optional(),
	})
	.superRefine((section, ctx) => {
		// Three classes read the source roots and five do not, so requiring the
		// declaration outright would make a section adopting only transcriptions
		// name and walk a tree nothing looks at.
		const readsSources = [
			section.citations !== undefined && 'citations',
			section.symbols !== undefined && 'symbols',
			section.codes !== undefined && 'codes',
		].filter((name): name is string => name !== false)
		if (section.sources === undefined && readsSources.length > 0) {
			ctx.addIssue({
				code: 'custom',
				path: ['sources'],
				message: `is absent, and ${readsSources.join(', ')} resolve against it`,
			})
		}
		section.lists?.forEach((entry, index) => {
			requireOneGroup(
				entry.pattern,
				ctx,
				['lists', index, 'pattern', 'match'],
				'the stretch of prose that spells the list',
			)
		})
		if (section.codes !== undefined) {
			requireOneGroup(
				section.codes.pattern,
				ctx,
				['codes', 'pattern', 'match'],
				'the code the page names',
			)
		}
		const classes = [
			section.citations,
			section.symbols,
			section.lists,
			section.codes,
			section.fences,
			section.vocabulary,
			section.dated,
			section.transcriptions,
		]
		if (classes.some((block) => block !== undefined)) return
		ctx.addIssue({
			code: 'custom',
			path: [],
			message:
				'declares no class of claim, so the gate would report a pass over nothing; add at least one of citations, symbols, lists, codes, fences, vocabulary, dated or transcriptions',
		})
	})
	.describe(
		'Holds the prose claims in your documentation against your own tree. Each class is a block you opt into, and a section declaring none is refused rather than passing over nothing.',
	)

export type DocClaimsConfig = z.infer<typeof DocClaimsSection>

type Pattern = { readonly match: string; readonly flags: string }

const escapeForPattern = (text: string): string =>
	text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * A `Set` key over two strings. `JSON.stringify` rather than a separator
 * character, because a separator has to be a byte neither half can contain and
 * every such byte is invisible in this file.
 */
const compositeKey = (...parts: readonly string[]): string =>
	JSON.stringify(parts)

const BACKTICKED = /`([A-Za-z_][A-Za-z0-9_]*)`/g

/**
 * Matches a declaration. A mention in a comment or a string does not count.
 *
 * The anchor check only demands a citation point at symbols the cited file
 * defines: a sentence naming a value in an example has no line for the citation
 * to be wrong about.
 */
const declarationPattern = (identifier: string): RegExp =>
	new RegExp(
		`(?:^|\\s)(?:export\\s+)?(?:async\\s+)?(?:const|let|function|type|class|interface)\\s+${identifier}\\b` +
			`|^\\s*(?:readonly\\s+)?${identifier}\\??:`,
		'm',
	)

const declaresIdentifier = (body: string, identifier: string): boolean =>
	declarationPattern(identifier).test(body)

/** Where a declaration sits, 1-based, for a failure that says where the code went. */
const declarationLine = (body: string, identifier: string): number | null => {
	const found = declarationPattern(identifier).exec(body)
	if (found === null) return null
	return body.slice(0, found.index).split('\n').length
}

/** The sentence around an offset: the enclosing table cell, or the enclosing sentence. */
const sentenceAround = (line: string, offset: number): string => {
	const before = line.slice(0, offset)
	const start = Math.max(before.lastIndexOf('. '), before.lastIndexOf('| ')) + 1
	const rest = line.slice(offset)
	const stop = rest.indexOf('. ')
	const end = stop === -1 ? line.length : offset + stop + 1
	return line.slice(start, end)
}

/**
 * Which backticked tokens in a captured stretch count as list members. A
 * spelling rule covers a set whose members share a shape; a module export covers
 * one whose members do not, and naming the export is what keeps the vocabulary
 * out of the configuration as a second copy of itself.
 */
async function memberTest(
	root: string,
	shape: Pattern | ModuleValueConfig,
): Promise<(token: string) => boolean> {
	if ('match' in shape) {
		const pattern = compilePattern(shape)
		return (token: string): boolean => pattern.test(token)
	}
	const vocabulary = new Set(await readModuleStrings(root, shape))
	return (token: string): boolean => vocabulary.has(token)
}

/**
 * A directory this walk never descends into. A dependency tree and a tool's own
 * directory carry pages nobody here wrote.
 */
const isSkipped = (name: string): boolean =>
	name === 'node_modules' || name.startsWith('.')

/**
 * The markdown under one declared root. `lstat` rather than `stat`, and a link
 * is refused rather than followed: a directory link pointing at an ancestor
 * recurses until the stack goes, and one pointing outside the tree reads pages
 * the configuration never named.
 */
const walkPages = async (
	root: string,
	target: string,
): Promise<readonly string[]> => {
	const info = await lstat(resolve(root, target)).catch(() => null)
	if (info === null) return []
	if (info.isSymbolicLink()) {
		throw codedError(
			DOC_CLAIM_PATH,
			`${target} is a symbolic link, and this walk does not follow links; name the directory itself under pages`,
		)
	}
	if (info.isFile()) return target.endsWith('.md') ? [target] : []
	const entries = await readdir(resolve(root, target))
	const nested = await Promise.all(
		entries
			.filter((entry) => !isSkipped(entry))
			.map((entry) => walkPages(root, `${target}/${entry}`)),
	)
	return nested.flat()
}

export type DocClaimsReport = {
	readonly failures: readonly string[]
	readonly summary: string
}

export async function runDocClaims(
	root: string,
	section: DocClaimsConfig,
): Promise<DocClaimsReport> {
	const failures: string[] = []
	const fail = (message: string): void => {
		failures.push(message)
	}

	// Canonical paths, because `resolve` follows no symlink: a link pointing at
	// the configuration's own directory would otherwise walk straight past this.
	const canonical = (target: string): string => {
		try {
			return realpathSync(target)
		} catch {
			return target
		}
	}
	const configRoot = canonical(resolve(root))
	const found: string[] = []
	for (const page of section.pages) {
		const named = canonical(resolve(root, page))
		const enclosing = named.endsWith(sep) ? named : `${named}${sep}`
		if (
			`${configRoot}${configRoot.endsWith(sep) ? '' : sep}`.startsWith(
				enclosing,
			)
		) {
			throw codedError(
				DOC_CLAIM_PATH,
				`the "doc-claims" section names "${page}" under pages, and that encloses the directory the configuration sits in; name a page or a directory inside it`,
			)
		}
		const reached = await walkPages(root, page)
		// Per root rather than over the whole list: one mistyped entry among
		// several drops its pages silently while the others keep the gate green.
		if (reached.length === 0) {
			throw codedError(
				DOC_CLAIM_PATH,
				`"${page}" holds no markdown, and the "doc-claims" section names it under pages; a root that reaches no page is coverage the gate reports as clean`,
			)
		}
		found.push(...reached)
	}
	const pages = [...found].sort()

	const pageText = new Map<string, readonly string[]>()
	for (const page of pages) {
		pageText.set(
			page,
			(await readFile(resolve(root, page), 'utf8')).split('\n'),
		)
	}

	/**
	 * The pages a person writes. A generated page carries its generator's own
	 * vocabulary, so a registry of time-sensitive claims over one would be a
	 * registry of generator output. The derived classes still read them, because
	 * a generator can name a symbol that moved and no byte comparison notices.
	 */
	const authoredPages = pages.filter(
		(page) => !section.generated.some((suffix) => page.endsWith(suffix)),
	)
	// A suffix broad enough to match every page, `.md` say, turns the dated,
	// codes and vocabulary classes into checks over nothing while the gate reports
	// each of them as clean.
	if (authoredPages.length === 0) {
		throw codedError(
			DOC_CLAIM_PATH,
			`every one of the ${pages.length} page(s) matches a suffix under generated (${section.generated.join(', ')}); the classes that read authored pages would hold nothing`,
		)
	}

	// Walked only when a class reads it. The schema is what guarantees the
	// declaration is there whenever one does.
	const srcBodies =
		section.sources === undefined
			? new Map<string, string>()
			: (await discoverEntries(root, section.sources, 'doc-claims')).entries
	const srcPaths = [...srcBodies.keys()]
	const allSource = [...srcBodies.values()].join('\n')

	const parts: string[] = []

	// -----------------------------------------------------------------------
	// Class 1: citations
	// -----------------------------------------------------------------------

	if (section.citations !== undefined) {
		const block = section.citations
		const citation = new RegExp(
			`\`?((?:[A-Za-z0-9._-]+\\/)*[A-Za-z0-9._-]+\\.(?:${block.extensions
				.map((extension) => escapeForPattern(extension.slice(1)))
				.join('|')})):(\\d+)(?:-(\\d+))?\`?`,
			'g',
		)
		const unanchoredSeen = new Set<string>()
		let checked = 0
		let anchored = 0

		for (const page of pages) {
			const lines = pageText.get(page) as readonly string[]
			// A bare `plan.ts` means the file a fully-qualified citation named
			// earlier on the same page. Two files may share a basename, so without
			// this the short form is ambiguous and the check would refuse a citation
			// a reader resolves without effort.
			const qualified = new Map<string, string>()
			lines.forEach((line, index) => {
				for (const match of line.matchAll(citation)) {
					const cited = match[1] as string
					const first = Number(match[2])
					const last = Number(match[3] ?? match[2])
					const at = `${page}:${index + 1}`
					const basename = cited.split('/').pop() as string

					let resolved: string | undefined
					if (srcBodies.has(cited)) resolved = cited
					else if (qualified.has(basename)) resolved = qualified.get(basename)
					else {
						const candidates = srcPaths.filter((file) =>
							file.endsWith(`/${cited}`),
						)
						if (candidates.length === 1) resolved = candidates[0]
						else {
							fail(
								`${at}: the citation \`${cited}\` resolves to ${candidates.length} files in the source roots; ` +
									'spell the path from the repository root',
							)
							continue
						}
					}
					const target = resolved as string
					qualified.set(basename, target)
					checked += 1

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
						const exemption = block.unanchored.find(
							(entry) =>
								entry.file === page && spanned.endsWith(entry.citation),
						)
						if (exemption === undefined) {
							fail(
								`${at}: the citation \`${cited}:${first}\` sits in a sentence naming no symbol ` +
									`${target} declares, so nothing holds the line number; name one, or register it ` +
									'under citations.unanchored with the reason',
							)
							continue
						}
						unanchoredSeen.add(compositeKey(exemption.file, exemption.citation))
						continue
					}

					const window = targetLines
						.slice(Math.max(0, first - 1 - block.window), last + block.window)
						.join('\n')
					const held = named.filter((identifier) =>
						new RegExp(`\\b${identifier}\\b`).test(window),
					)
					if (held.length === 0) {
						const moved = named
							.map((identifier) => ({
								identifier,
								line: declarationLine(body, identifier),
							}))
							.filter((each) => each.line !== null)
							.map(
								(each) => `\`${each.identifier}\` is at ${target}:${each.line}`,
							)
							.join(', ')
						fail(
							`${at}: the citation \`${cited}:${first}\` names ${named.map((each) => `\`${each}\``).join(', ')} ` +
								`and none of them is within ${block.window} lines of ${target}:${first}; ${moved}`,
						)
						continue
					}
					anchored += 1
				}
			})
		}

		for (const entry of block.unanchored) {
			if (unanchoredSeen.has(compositeKey(entry.file, entry.citation))) continue
			fail(
				`${entry.file}: citations.unanchored names \`${entry.citation}\`, which the page no longer ` +
					'carries unanchored; drop the entry',
			)
		}
		if (checked === 0) {
			throw codedError(
				DOC_CLAIM_PATH,
				'the citations class examined no citation at all; adopt it only on pages that cite source, or the class reports a pass over nothing',
			)
		}
		parts.push(
			`${checked} citations resolve (${anchored} anchored on a symbol, ${block.unanchored.length} held by review)`,
		)
	}

	// -----------------------------------------------------------------------
	// Class 2: symbols
	// -----------------------------------------------------------------------

	if (section.symbols !== undefined) {
		const block = section.symbols
		const shape = compilePattern(block.shape)
		const foreignSeen = new Set<string>()
		const unknown = new Map<string, string>()
		let checked = 0

		for (const page of pages) {
			const lines = pageText.get(page) as readonly string[]
			lines.forEach((line, index) => {
				for (const match of line.matchAll(BACKTICKED)) {
					const token = match[1] as string
					if (!shape.test(token)) continue
					checked += 1
					const foreign = block.foreign.find((entry) => entry.token === token)
					if (foreign !== undefined) {
						foreignSeen.add(token)
						continue
					}
					if (declaresIdentifier(allSource, token)) continue
					if (!unknown.has(token)) unknown.set(token, `${page}:${index + 1}`)
				}
			})
		}

		for (const [token, at] of unknown) {
			fail(
				`${at}: the page spells \`${token}\`, which nothing in the source roots declares; ` +
					'it was renamed, removed, or mistyped, or it belongs under symbols.foreign with its reason',
			)
		}
		for (const entry of block.foreign) {
			if (foreignSeen.has(entry.token)) continue
			fail(
				`symbols.foreign names \`${entry.token}\`, which no page spells; drop the entry`,
			)
		}
		if (checked === 0) {
			throw codedError(
				DOC_CLAIM_PATH,
				`the symbols class examined no backticked identifier at all; its shape is ${block.shape.match}, and a shape matching nothing switches the class off`,
			)
		}
		parts.push(`${checked} backticked identifiers are declared`)
	}

	// -----------------------------------------------------------------------
	// Class 3: transcribed lists
	// -----------------------------------------------------------------------

	if (section.lists !== undefined) {
		for (const entry of section.lists) {
			const lines = pageText.get(entry.file)
			if (lines === undefined) {
				fail(`${entry.file}: missing, but a list entry names it`)
				continue
			}
			const text = lines.join('\n')
			// The entry's own flags are carried over, so an entry written with `i`
			// does not silently lose it and fail as dead for a reason nobody finds.
			const flags = [...new Set([...entry.pattern.flags, 'g', 's'])].join('')
			const found = [...text.matchAll(new RegExp(entry.pattern.match, flags))]
			if (found.length !== 1) {
				fail(
					`${entry.file}: ${found.length} sentences match the pattern for ${entry.claim}; ` +
						'a list entry names exactly one, so either the sentence or the entry has to move',
				)
				continue
			}
			const match = found[0] as RegExpExecArray
			const line = text.slice(0, match.index ?? 0).split('\n').length
			const isMember = await memberTest(root, entry.tokenShape)
			const spelled = [...(match[1] as string).matchAll(/`([^`]+)`/g)]
				.map((each) => each[1] as string)
				.filter(isMember)
				.sort()
			const owed = [...(await readModuleStrings(root, entry.expected))].sort()
			const extra = spelled.filter((each) => !owed.includes(each))
			const absent = owed.filter((each) => !spelled.includes(each))
			if (extra.length === 0 && absent.length === 0) continue
			const said: string[] = []
			if (absent.length > 0) said.push(`omits ${absent.join(', ')}`)
			if (extra.length > 0) said.push(`adds ${extra.join(', ')}`)
			fail(
				`${entry.file}:${line}: ${entry.claim} ${said.join(' and ')}; ${nameOf(entry.expected)} has ` +
					`${owed.join(', ')}`,
			)
		}
		parts.push(`${section.lists.length} transcribed lists match their source`)
	}

	// -----------------------------------------------------------------------
	// Class 4: time-sensitive claims
	// -----------------------------------------------------------------------

	if (section.dated !== undefined) {
		const block = section.dated
		const triggers = block.triggers.map(compilePattern)
		const heading =
			block.headings === undefined ? null : compilePattern(block.headings)
		const seen = new Set<string>()
		let read = 0
		let derived = 0

		for (const page of authoredPages) {
			const lines = pageText.get(page) as readonly string[]
			let owedSection = false
			for (const [index, line] of lines.entries()) {
				if (line.startsWith('#')) {
					// A heading names the section rather than making the claim, so it
					// turns the section on and is never a registration of its own.
					owedSection = heading?.test(line) ?? false
					continue
				}
				const dated =
					triggers.some((trigger) => trigger.test(line)) ||
					(owedSection && line.startsWith('- '))
				if (!dated) continue
				const entry = block.claims.find(
					(each) => each.file === page && line.includes(each.key),
				)
				if (entry === undefined) {
					fail(
						`${page}:${index + 1}: this sentence claims something is true as of now, or not yet ` +
							'true, and no dated.claims entry holds it; register it with how it is settled',
					)
					continue
				}
				seen.add(compositeKey(entry.file, entry.key))
			}
		}

		for (const entry of block.claims) {
			// A key names one sentence. Without this an entry keyed on something
			// short registers every later line carrying the same words, so a new and
			// false dated claim rides in on an existing registration.
			const lines = pageText.get(entry.file) ?? []
			const carrying = lines.filter((line) => line.includes(entry.key)).length
			if (carrying === 0) {
				fail(
					`${entry.file}: dated.claims holds "${entry.key}", which the page no longer carries; ` +
						'the sentence was rewritten, so re-read the claim and move the entry',
				)
				continue
			}
			if (carrying > 1) {
				fail(
					`${entry.file}: ${carrying} sentences carry "${entry.key}"; a dated.claims entry names ` +
						'one, so either the new sentence needs its own entry or the key needs to be longer',
				)
				continue
			}
			if (!seen.has(compositeKey(entry.file, entry.key))) {
				fail(
					`${entry.file}: dated.claims holds "${entry.key}", and the sentence carrying it no longer ` +
						'reads as a dated claim; re-read it and move the entry',
				)
				continue
			}
			if (entry.settles === 'read') {
				read += 1
				continue
			}
			derived += 1
			if (await readModuleVerdict(root, entry.settles)) continue
			fail(
				`${entry.file}: "${entry.key}" is no longer true; the check that settles it ` +
					`(${entry.reason}) now answers no`,
			)
		}
		parts.push(
			`${derived + read} time-sensitive claims registered (${derived} settled by a predicate, ${read} by review)`,
		)
	}

	// -----------------------------------------------------------------------
	// Class 5: named codes
	// -----------------------------------------------------------------------

	if (section.codes !== undefined) {
		const block = section.codes
		const claim = compileGlobalPattern(block.pattern)
		const known = new Set<string>()
		for (const registry of block.registries) {
			for (const code of await readModuleStrings(root, registry)) {
				known.add(code)
			}
		}
		const unknown = new Map<string, string>()
		let checked = 0

		for (const page of authoredPages) {
			const lines = pageText.get(page) as readonly string[]
			lines.forEach((line, index) => {
				for (const match of line.matchAll(claim)) {
					const token = match[1] as string
					checked += 1
					if (known.has(token)) continue
					if (block.literalInSources && allSource.includes(`'${token}'`)) {
						continue
					}
					if (!unknown.has(token)) unknown.set(token, `${page}:${index + 1}`)
				}
			})
		}

		for (const [token, at] of unknown) {
			fail(
				`${at}: the page says \`${token}\` is raised, and no registry this section names carries it` +
					`${block.literalInSources ? ' and nothing in the source roots spells it as a string literal' : ''}; ` +
					'it was renamed, removed, or mistyped',
			)
		}
		// The pattern lives in a configuration file now rather than in source, so a
		// typo in it turns the class off with every gate staying green.
		if (checked === 0) {
			throw codedError(
				DOC_CLAIM_PATH,
				`the codes class examined no code at all; nothing on ${authoredPages.length} page(s) matched ${block.pattern.match}`,
			)
		}
		parts.push(`${checked} named codes exist`)
	}

	// -----------------------------------------------------------------------
	// Class 6: worked JSON
	// -----------------------------------------------------------------------

	if (section.fences !== undefined) {
		for (const entry of section.fences) {
			const lines = pageText.get(entry.file)
			if (lines === undefined) {
				fail(`${entry.file}: missing, but a fence entry names it`)
				continue
			}
			const intro = compilePattern(entry.intro)
			const introAt = lines.findIndex((line) => intro.test(line))
			if (introAt === -1) {
				fail(
					`${entry.file}: no sentence introduces ${entry.claim}; the entry is dead and either ` +
						'the sentence or the entry has to move',
				)
				continue
			}
			const open = lines.findIndex(
				(line, index) =>
					index > introAt &&
					index <= introAt + entry.lookahead &&
					line.trim() === '```json',
			)
			if (open === -1) {
				fail(
					`${entry.file}:${introAt + 1}: ${entry.claim} is introduced with no json fence after it`,
				)
				continue
			}
			const close = lines.findIndex(
				(line, index) => index > open && line.trim() === '```',
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
			if (entry.shape === 'each' && !Array.isArray(value)) {
				fail(
					`${entry.file}:${open + 2}: ${entry.claim} is declared as an array and is not one`,
				)
				continue
			}
			const parser = await readModuleParser(root, entry.schema)
			const values =
				entry.shape === 'each' ? (value as readonly unknown[]) : [value]
			values.forEach((member, index) => {
				const parsed = parser.safeParse(member)
				if (parsed.success) return
				const where = entry.shape === 'each' ? ` member ${index}` : ''
				const reported = flatten(parsed.error?.issues ?? [])
					.slice(0, 3)
					.map(
						(issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`,
					)
					.join('; ')
				// A parser that refuses and reports nothing still has to say so: an
				// empty parenthesis reads as a gate that found no reason.
				const issues =
					reported === ''
						? 'the schema refused it and reported no issue'
						: reported
				fail(
					`${entry.file}:${open + 2}: ${entry.claim}${where} does not parse against ${nameOf(entry.schema)} ` +
						`(${issues})`,
				)
			})
		}
		parts.push(
			`${section.fences.length} worked JSON blocks parse against their schema`,
		)
	}

	// -----------------------------------------------------------------------
	// Class 7: the accepted and refused vocabulary
	// -----------------------------------------------------------------------

	if (section.vocabulary !== undefined) {
		const block = section.vocabulary
		const tokens = await readModuleStrings(root, block.tokens)
		// An empty vocabulary compiles to a pattern matching the empty string, so
		// the class would classify nothing and report a pass.
		if (tokens.length === 0) {
			throw codedError(
				DOC_CLAIM_PATH,
				`${nameOf(block.tokens)} is empty, so the vocabulary class would hold no sentence at all`,
			)
		}
		const accepted = await readModuleStrings(root, block.accepted)
		const refused = await readModuleStrings(root, block.refused)
		const mentions = holdVocabulary(
			authoredPages,
			pageText,
			{ tokens, accepted, refused, verbs: block.verbs },
			{ accepted: nameOf(block.accepted), refused: nameOf(block.refused) },
			fail,
		)
		// The class the module header exists for: a sentence saying a member is
		// refused passes every other class. A vocabulary that matches nothing on any
		// page takes that guarantee away silently.
		if (mentions === 0) {
			throw codedError(
				DOC_CLAIM_PATH,
				`the vocabulary class classified no mention at all; ${nameOf(block.tokens)} is ${tokens.join(', ')}, and no page spells any of them beside a verb the section names`,
			)
		}
		parts.push(`${mentions} vocabulary mentions agree with the two sets`)
	}

	// -----------------------------------------------------------------------
	// Class 8: transcriptions
	// -----------------------------------------------------------------------

	if (section.transcriptions !== undefined) {
		for (const entry of section.transcriptions) {
			const lines = pageText.get(entry.file)
			if (lines === undefined) {
				fail(`${entry.file}: missing, but a transcription entry names it`)
				continue
			}
			const text = await readModuleText(root, entry.text)
			// `includes('')` is true of every page, so an empty source is an entry
			// that passes whatever the page carries.
			if (text === '') {
				throw codedError(
					DOC_CLAIM_PATH,
					`${nameOf(entry.text)} is empty, and a transcription of nothing matches every page`,
				)
			}
			if (lines.join('\n').includes(text)) continue
			const head = text.split('\n')[0] as string
			const at = lines.indexOf(head)
			fail(
				`${entry.file}${at === -1 ? '' : `:${at + 1}`}: ${entry.claim} no longer matches ${nameOf(entry.text)}; ` +
					'a transcription and the thing it reprints have to be the same bytes',
			)
		}
		parts.push(
			`${section.transcriptions.length} transcriptions match their source byte for byte`,
		)
	}

	// The failure count rides on the summary line. Without it a failing run opens
	// with "13 transcribed lists match their source" directly above the failures
	// saying they do not.
	parts.push(`${failures.length} disagreement(s)`)
	return { failures, summary: parts.join(', ') }
}

type Issue = { readonly path: readonly PropertyKey[]; readonly message: string }

/**
 * A union reports one opaque message at the root and hides which branch came
 * closest, so the branch errors are pulled up. Without this the failure names
 * the block and nothing inside it, which is the difference between a gate a
 * reader can act on and one they have to re-derive.
 */
function flatten(issues: readonly Issue[]): readonly Issue[] {
	return issues.flatMap((issue) => {
		const nested = (issue as { errors?: readonly (readonly Issue[])[] }).errors
		// A discriminated union whose tag is wrong reports `errors: []` and puts
		// the whole message on the issue itself. Recursing into the empty list
		// discards it and the failure prints an empty parenthesis.
		if (nested === undefined || nested.length === 0) return [issue]
		const branches = nested
			.map((branch) => flatten(branch))
			.filter((branch) => branch.length > 0)
		if (branches.length === 0) return [issue]
		// Deepest path wins. The branch with the fewest issues is the shallowest
		// one, which reports a container's own complaint over the member that is
		// actually malformed.
		const reach = (branch: readonly Issue[]): number =>
			Math.max(...branch.map((each) => each.path.length))
		return [...branches].sort(
			(a, b) => reach(b) - reach(a),
		)[0] as readonly Issue[]
	})
}

type Vocabulary = {
	readonly tokens: readonly string[]
	readonly accepted: readonly string[]
	readonly refused: readonly string[]
	readonly verbs: {
		readonly accepts: readonly string[]
		readonly refuses: readonly string[]
		readonly participles?: readonly string[]
	}
}

/**
 * The epic's own defect, as a class rather than as a list of sentences.
 *
 * A token is classified by the nearest verb before it in its own sentence, and
 * by a refusal verb after it when nothing precedes it, which is what carries "a
 * contract declaring `web` is rejected". Sentence boundaries stop a verb
 * reaching across a full stop, and a negated or past verb is skipped because
 * the tense makes it a statement about something other than the rule today.
 *
 * What it does not decide, and every one of these passes rather than failing: a
 * token named with no verb near it; a token governed by a verb neither list
 * carries; and a token whose verb the sentence negates or puts in the past, so
 * "`compile` does not accept `mcp`" is false about the tree and passes green.
 *
 * One shape it decides wrongly, recorded rather than chased: a list used as the
 * subject with its verb after it puts the governing verb past the intervening
 * tokens and no span rule reaches it, so the leading members read as refused. It
 * fails a true sentence rather than passing a false one.
 */
function holdVocabulary(
	authoredPages: readonly string[],
	pageText: ReadonlyMap<string, readonly string[]>,
	vocabulary: Vocabulary,
	labels: { readonly accepted: string; readonly refused: string },
	fail: (message: string) => void,
): number {
	const tokenInProse = new RegExp(
		`\`(${vocabulary.tokens.map(escapeForPattern).join('|')})\``,
		'g',
	)
	// Longest first, so a multi-word verb and a longer inflection are tried before
	// the shorter spelling they contain.
	const allVerbs = [...vocabulary.verbs.accepts, ...vocabulary.verbs.refuses]
		.slice()
		.sort((a, b) => b.length - a.length)
	const verbPattern = new RegExp(
		`\\b(${allVerbs.map(escapeForPattern).join('|')})\\b`,
		'gi',
	)
	const refuses = new Set(
		vocabulary.verbs.refuses.map((verb) => verb.toLowerCase()),
	)

	/**
	 * A verb the sentence negates or puts in the past decides nothing, and
	 * skipping both leaves them undecided.
	 */
	const negatedOrPast =
		/\b(?:not|never|no longer|cannot|used to|nor)\b[^.]{0,24}$/i
	/**
	 * Which verbs are participles: past tense on their own, and the passive
	 * present a page uses for a live rule when a present `be` precedes them.
	 *
	 * The configuration may name them, because the spelling rule the default uses
	 * is wrong for a base form ending in `-ed`, "exceed" or "succeed". A consumer
	 * with one of those in its vocabulary lists its real participles instead.
	 */
	const declared = vocabulary.verbs.participles
	const participles =
		declared === undefined
			? null
			: new Set(declared.map((verb) => verb.toLowerCase()))
	const isParticiple = (verb: string): boolean =>
		participles === null
			? /^(?:[a-z]+ed)$/i.test(verb)
			: participles.has(verb.toLowerCase())
	/**
	 * The `be` may be a word or two away, and an adverb between the auxiliary and
	 * the participle does not make the sentence past.
	 */
	const presentBe =
		/\b(?:is|are|be|been|being)\s+(?:(?:[a-z]+ly|still|now|also|already|then)\s+){0,2}$/i
	/** Only whitespace and auxiliaries, so the token is the subject of what follows. */
	const subjectGap =
		/^\s*(?:(?:is|are|be|been|being|still|now|also|then|already)\s+)*$/i

	let mentions = 0
	for (const page of authoredPages) {
		const lines = pageText.get(page) as readonly string[]
		lines.forEach((line, index) => {
			for (const sentence of line.split(/(?<=\.)\s+/)) {
				const verbs = [...sentence.matchAll(verbPattern)]
					.map((match) => ({
						at: match.index ?? 0,
						verb: match[1] as string,
						refuses: refuses.has((match[1] as string).toLowerCase()),
					}))
					// A backticked verb is a command's name. Read as a verb it governs
					// the token beside it, so "`web` is the one kind `compile` still
					// refuses" would read as acceptance.
					.filter(
						(verb) =>
							!(
								sentence[verb.at - 1] === '`' &&
								sentence[verb.at + verb.verb.length] === '`'
							),
					)
					.filter((verb) => !negatedOrPast.test(sentence.slice(0, verb.at)))
					.filter(
						(verb) =>
							!isParticiple(verb.verb) ||
							presentBe.test(sentence.slice(0, verb.at)),
					)
				for (const found of sentence.matchAll(tokenInProse)) {
					const at = found.index ?? 0
					const before = verbs.filter((verb) => verb.at < at).at(-1)
					const after = verbs.find((verb) => verb.at > at)
					// A verb governs the whole enumeration it opens, so a preceding verb
					// with another token between it and this one wins whatever follows.
					// With nothing between, the nearer verb wins.
					const enumerated =
						before !== undefined &&
						tokenInProse.test(sentence.slice(before.at, at))
					tokenInProse.lastIndex = 0
					// An enumerated token is an object of the verb that opened the list,
					// unless the verb after it is its own. What separates the two is the
					// span on the far side: a list member is followed by punctuation and
					// a subject is followed by an auxiliary.
					const subjectOfAfter =
						after !== undefined &&
						subjectGap.test(sentence.slice(at + found[0].length, after.at))
					const nearer =
						before === undefined
							? after
							: after === undefined || at - before.at <= after.at - at
								? before
								: after
					const governing = enumerated && !subjectOfAfter ? before : nearer
					if (governing === undefined) continue
					mentions += 1
					const token = found[1] as string
					const owed = governing.refuses
						? vocabulary.refused
						: vocabulary.accepted
					if (owed.includes(token)) continue
					fail(
						`${page}:${index + 1}: the sentence has "${governing.verb}" governing \`${token}\`, and ` +
							`${governing.refuses ? labels.refused : labels.accepted} ` +
							`is ${owed.join(', ')}`,
					)
				}
			}
		})
	}
	return mentions
}
