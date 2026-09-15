// A published gate: every hand-written count in the pages a consumer names is
// computed from the thing it counts, rendered the way the page spells it, and
// compared against the numeral the page carries.
//
// It exists because these sentences were held by story discipline alone, and
// two epics of drift is what that bought. A frontmatter check reads whitespace
// and never reads a page body, and an invocation check judges fenced commands
// rather than prose. So a page could state a count no generator owned and
// nothing would notice.
//
// Both halves are the consumer's. A source says where a number comes from: an
// export of a module, a value in a JSON file, a count of files under a path, or
// a count of matches in a tree. An entry says which sentence carries it, in
// which file, and whether the page spells it as a word or as digits.
//
// A pattern that matches nothing is a failure, and so is one that matches
// twice. A rewritten sentence therefore cannot silence the gate by drifting out
// from under its own pattern. A declared source no entry uses fails for the
// same reason.
//
// The gate never rewrites a page. A check that can repair what it checks is not
// a gate, and the same rule keeps it out of every file it reads.
//
// Run by `node` directly: Node's type stripping erases types only, so no
// TypeScript enum, namespace, parameter property, or non-type re-export may
// appear in this file or anything it imports.
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { z } from 'zod'
import { ConsumerPattern, ProsePattern } from './consumer-pattern.ts'
import {
	ModuleValue,
	readModuleCount,
	Take,
	takeCount,
} from './module-value.ts'
import {
	discoverEntries,
	RelativePath,
	ScannedPathList,
} from './scanned-paths.ts'

/** A source the configuration declared and the tree could not answer. */
export const DOC_COUNT_SOURCE = 'EVAL_QUALITY_DOC_COUNT_SOURCE'

const codedError = (code: string, message: string): Error =>
	Object.assign(new Error(message), { code })

const detail = (error: unknown): string =>
	error instanceof Error ? error.message : String(error)

const NonEmpty = z.string().min(1)

const SourceName = NonEmpty.regex(
	/^[A-Za-z][A-Za-z0-9-]*$/,
	'is not a source name: letters, digits and hyphens, opening with a letter',
)

const ModuleSource = z.strictObject({
	kind: z.literal('module'),
	from: ModuleValue,
})

const JsonSource = z.strictObject({
	kind: z.literal('json'),
	file: RelativePath.describe('The JSON file to read.'),
	path: z
		.array(NonEmpty)
		.optional()
		.describe('Keys to walk from the top of the document.'),
	take: Take.default('value').describe(
		'What to take once the walk arrives: the number itself, its length, or the number of its keys.',
	),
})

const FilesSource = z.strictObject({
	kind: z.literal('files'),
	paths: ScannedPathList.describe('The trees whose files are counted.'),
})

const MatchesSource = z.strictObject({
	kind: z.literal('matches'),
	paths: ScannedPathList.describe('The trees whose text is searched.'),
	pattern: ConsumerPattern.describe(
		'What is counted. Every occurrence across every file, in one number.',
	),
	distinct: z
		.boolean()
		.default(false)
		.describe(
			"Whether to count distinct values of the pattern's first capture group instead of occurrences, which is what a set spelled across many files needs.",
		),
})

const CountSource = z
	.discriminatedUnion('kind', [
		ModuleSource,
		JsonSource,
		FilesSource,
		MatchesSource,
	])
	.describe('Where one number comes from.')

export type CountSourceConfig = z.infer<typeof CountSource>

const CountEntry = z.strictObject({
	file: RelativePath.describe('The page or source file carrying the sentence.'),
	claim: NonEmpty.describe(
		'What the sentence claims, for the failure message. It is what a reader is told to go and fix.',
	),
	pattern: ProsePattern.describe(
		'The sentence, with one capture group per number it carries.',
	),
	wrap: z
		.boolean()
		.default(false)
		.describe(
			'Whether a literal space in the pattern also matches a line wrap. It never matches a blank line, so a sentence cannot capture a word from the paragraph above it. Spaces inside a bracket expression are left alone.',
		),
	counts: z
		.array(SourceName)
		.min(1)
		.describe(
			'The sources behind the capture groups, in the order the sentence carries them.',
		),
	rendering: z
		.enum(['word', 'digits'])
		.default('word')
		.describe(
			'How the page spells the number. Words are rendered from a closed table covering zero to ninety-nine, and the comparison follows the case the page used.',
		),
})

export type CountEntryConfig = z.infer<typeof CountEntry>

/**
 * A gap inside one paragraph: whitespace that may wrap a line and never crosses
 * a blank one.
 *
 * `\s+` is the obvious spelling and it is wrong in front of a capture group: a
 * blank line is whitespace, so the captured word can sit in the paragraph above
 * the sentence being read, and the gate then compares a number that sentence
 * never states.
 */
const WRAP = '(?:[^\\S\\n]|\\n(?![ \\t]*\\n))+'

/** What may follow a literal space and change what widening it would mean. */
const QUANTIFIER = new Set(['?', '*', '+', '{'])

/**
 * The pattern with its literal spaces widened into wrap gaps. A bracket
 * expression is copied through untouched, because a space inside one is a
 * member of a character set rather than a gap between words.
 */
export function widenSpaces(source: string): string {
	let out = ''
	let inClass = false
	for (let index = 0; index < source.length; index += 1) {
		const char = source[index] as string
		if (char === '\\') {
			out += char + (source[index + 1] ?? '')
			index += 1
			continue
		}
		if (char === '[' && !inClass) inClass = true
		else if (char === ']' && inClass) inClass = false
		if (char === ' ' && !inClass) {
			while (source[index + 1] === ' ') index += 1
			// `' ?'` would become `WRAP?`, which makes the whole gap optional and
			// turns a sentence pattern into one that matches the words run together.
			// Refused rather than quietly widened, because the entry would read as
			// dead and the reason would be invisible.
			if (QUANTIFIER.has(source[index + 1] ?? '')) {
				throw new Error(
					`a space followed by "${source[index + 1]}" cannot be widened into a wrap gap; write it as \\s* or drop wrap`,
				)
			}
			out += WRAP
			continue
		}
		out += char
	}
	return out
}

const sourceOf = (entry: CountEntryConfig): string =>
	entry.wrap ? widenSpaces(entry.pattern.match) : entry.pattern.match

/**
 * How many capture groups a pattern has, so an entry whose sentence carries
 * fewer numbers than it names sources is refused at load rather than reading
 * `undefined` off a match.
 *
 * The alternation with an empty branch makes the pattern match the empty string,
 * so the result carries one slot per group whatever the subject is.
 */
const captureGroups = (source: string, flags: string): number => {
	const probe = new RegExp(`${source}|`, flags.replace(/[gy]/g, ''))
	return (probe.exec('')?.length ?? 1) - 1
}

export const DocCountsSection = z
	.strictObject({
		sources: z
			.record(SourceName, CountSource)
			.describe(
				'Every number this configuration can hold a page against, by name.',
			),
		entries: z
			.array(CountEntry)
			.min(1)
			.describe('Every sentence held, one entry apiece.'),
	})
	.superRefine((section, ctx) => {
		const declared = Object.keys(section.sources)
		if (declared.length === 0) {
			ctx.addIssue({
				code: 'custom',
				path: ['sources'],
				message:
					'declares no source, so every entry would be held against nothing',
			})
		}
		const used = new Set<string>()
		section.entries.forEach((entry, index) => {
			entry.counts.forEach((name, position) => {
				used.add(name)
				if (declared.includes(name)) return
				ctx.addIssue({
					code: 'custom',
					path: ['entries', index, 'counts', position],
					message: `names "${name}", which this section declares no source for; it declares ${declared.join(', ')}`,
				})
			})
			let groups: number
			try {
				groups = captureGroups(sourceOf(entry), entry.pattern.flags)
			} catch (error) {
				ctx.addIssue({
					code: 'custom',
					path: ['entries', index, 'pattern', 'match'],
					message: `does not compile once its spaces are widened: ${detail(error)}`,
				})
				return
			}
			if (groups === entry.counts.length) return
			ctx.addIssue({
				code: 'custom',
				path: ['entries', index, 'pattern', 'match'],
				message: `has ${groups} capture group(s) and the entry names ${entry.counts.length} count(s); one group holds one number`,
			})
		})
		for (const name of declared) {
			if (!used.has(name)) {
				ctx.addIssue({
					code: 'custom',
					path: ['sources', name],
					message:
						'is declared and no entry uses it; a source nothing reads is a count nobody holds',
				})
			}
			const source = section.sources[name]
			if (source?.kind !== 'matches' || !source.distinct) continue
			// Refused here rather than at the first file read, where the failure is
			// one file's problem rather than the setting's.
			if (captureGroups(source.pattern.match, source.pattern.flags) > 0)
				continue
			ctx.addIssue({
				code: 'custom',
				path: ['sources', name, 'pattern', 'match'],
				message:
					'counts distinct values and has no capture group; the first group is what the distinct values are read from',
			})
		}
	})
	.describe(
		'Holds every hand-written count in your documentation against the thing it counts. A source says where a number comes from and an entry says which sentence carries it; a sentence that drifts out from under its own pattern fails as a dead entry.',
	)

export type DocCountsConfig = z.infer<typeof DocCountsSection>

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
 * The closed word table. Zero to ninety-nine is the range documentation prose
 * uses, and a value past it returns `null` so the report carries it beside every
 * other failure rather than aborting the run at the first one.
 */
export function inWords(value: number): string | null {
	if (!Number.isInteger(value) || value < 0 || value > 99) return null
	const ones = ONES[value]
	if (ones !== undefined) return ones
	const tail = value % 10
	const tens = TENS[Math.floor(value / 10)] as string
	return tail === 0 ? tens : `${tens}-${ONES[tail]}`
}

/** A page may spell the same count either way, so the compare is case-free. */
export const matchCaseOf = (carried: string, owed: string): string =>
	carried.charAt(0) === carried.charAt(0).toUpperCase()
		? owed.charAt(0).toUpperCase() + owed.slice(1)
		: owed

const walkJson = (
	document: unknown,
	path: readonly string[],
	where: string,
): unknown => {
	let value = document
	for (const key of path) {
		if (value === null || typeof value !== 'object') {
			throw codedError(
				DOC_COUNT_SOURCE,
				`${where}: "${key}" was reached on a value with no properties`,
			)
		}
		const holder = value as Record<string, unknown>
		if (!(key in holder)) {
			throw codedError(
				DOC_COUNT_SOURCE,
				`${where}: "${key}" is absent; the keys there are ${Object.keys(holder).sort().join(', ')}`,
			)
		}
		value = holder[key]
	}
	return value
}

/** The number behind one named source. */
async function resolveSource(
	root: string,
	name: string,
	source: CountSourceConfig,
): Promise<number> {
	if (source.kind === 'module') {
		return readModuleCount(root, source.from)
	}
	if (source.kind === 'json') {
		const where = `the source "${name}": ${source.file}`
		let document: unknown
		try {
			document = JSON.parse(await readFile(resolve(root, source.file), 'utf8'))
		} catch (error) {
			throw codedError(
				DOC_COUNT_SOURCE,
				`${where} could not be read as JSON: ${detail(error)}`,
			)
		}
		return takeCount(
			walkJson(document, source.path ?? [], where),
			source.take,
			where,
		)
	}
	const discovered = await discoverEntries(root, source.paths, 'doc-counts')
	if (source.kind === 'files') return discovered.entries.size
	const pattern = new RegExp(source.pattern.match, `${source.pattern.flags}g`)
	if (!source.distinct) {
		let total = 0
		for (const body of discovered.entries.values()) {
			total += [...body.matchAll(pattern)].length
		}
		return total
	}
	const seen = new Set<string>()
	for (const body of discovered.entries.values()) {
		for (const match of body.matchAll(pattern)) {
			// The capture group is guaranteed by the schema; an alternation branch
			// that did not reach it contributes nothing rather than an empty name.
			const captured = match[1]
			if (captured !== undefined) seen.add(captured)
		}
	}
	return seen.size
}

export type DocCountsReport = {
	readonly failures: readonly string[]
	readonly numerals: number
	readonly digits: number
	readonly files: number
}

const lineOf = (text: string, offset: number): number =>
	text.slice(0, offset).split('\n').length

export async function runDocCounts(
	root: string,
	section: DocCountsConfig,
): Promise<DocCountsReport> {
	const resolved = new Map<string, number>()
	for (const [name, source] of Object.entries(section.sources)) {
		resolved.set(name, await resolveSource(root, name, source))
	}

	const failures: string[] = []
	let numerals = 0
	let digits = 0

	for (const entry of section.entries) {
		if (entry.rendering === 'digits') digits += entry.counts.length
		else numerals += entry.counts.length

		let text: string
		try {
			text = await readFile(resolve(root, entry.file), 'utf8')
		} catch {
			failures.push(`${entry.file}: missing, but a count entry names it`)
			continue
		}

		// The entry's own flags are carried over. Replacing them drops an `m` or
		// an `i` the entry was written with and turns an anchored pattern dead.
		// `g` is never among them, because the schema excludes it.
		const found = [
			...text.matchAll(new RegExp(sourceOf(entry), `${entry.pattern.flags}g`)),
		]
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
		entry.counts.forEach((name, index) => {
			const value = resolved.get(name) as number
			const carried = match[index + 1]
			// An optional group, or one in an alternation branch the match did not
			// take, leaves the slot empty. The entry is then holding a sentence it
			// cannot read a number out of, which is a dead entry wearing a match.
			if (carried === undefined) {
				failures.push(
					`${entry.file}:${line}: ${entry.claim} matched, and capture group ${index + 1} took no text; ` +
						'a group a match can skip holds no number',
				)
				return
			}
			let owed: string
			if (entry.rendering === 'digits') owed = String(value)
			else {
				const word = inWords(value)
				if (word === null) {
					failures.push(
						`${entry.file}:${line}: ${entry.claim} is ${value}, outside the ` +
							"word table's range (0-99); write this one as digits",
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

	return {
		failures,
		numerals,
		digits,
		files: new Set(section.entries.map((entry) => entry.file)).size,
	}
}
