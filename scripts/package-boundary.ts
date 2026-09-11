// A published gate: everything a package ships, held against forbidden patterns
// the consumer declares.
//
// Both halves are the consumer's. The scanned set is a list of paths, each with
// a recursion flag and an extension filter, plus the manifest fields a registry
// publishes verbatim. What a consumer leaves out of that list is exempt, and
// omission is the only exemption the gate has. The rules are an ordered array of
// named regular expressions carrying a reason apiece.
//
// `scanPackageBoundary` is pure and synchronous over a file map, so one function
// backs both the real scan and a synthetic test map. It matches text line by
// line rather than tokenizing, because the references this class of rule forbids
// live in comments and in string literals, which a token scan reports by kind
// and not by content. Nothing here loads `typescript`.
//
// Run by `node` directly: Node's type stripping erases types only, so no
// TypeScript enum, namespace, parameter property, or non-type re-export may
// appear in this file or anything it imports.
import type { Dirent } from 'node:fs'
import { lstat, readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { z } from 'zod'

/**
 * The bound on a consumer-supplied regular expression, and what it does not
 * cover.
 *
 * A pattern arrives as text from a file this package did not write, so the work
 * one pattern can do is the consumer's to choose. JavaScript's `RegExp` exposes
 * no step counter and no timeout, and `check-doc-claims.ts:943` records the same
 * limit from the other side: `REGEX_STEP_BUDGET` is a number that exists because
 * a step count is the bound you would want and nothing offers one.
 *
 * So the bound is on the two things that are measurable. The pattern side:
 * `MAX_PATTERN_LENGTH` on the source, `MAX_PATTERNS` on the array, a flag set
 * that excludes `g` and `y`, and a refusal of backreferences, which is the
 * construct that turns a linear scan of one line into an exponential one. The
 * input side: `MAX_SCANNED_LINE` on the text a pattern is matched against, so a
 * minified bundle or an embedded data URI cannot hand a pattern a megabyte.
 *
 * 64 KiB, not the single kilobyte a first draft of this bound used. This
 * package's own `corpus/` is a legitimate long-line source: an unminified
 * behavioral contract is one JSON object per line and the longest committed
 * one is 13,333 characters. A bound sized to the threat this constant exists
 * for, an actual megabyte-scale bundle, and not to this repository's own
 * content, is a gate that fails on the tree it ships with, which is worse
 * than the DoS surface it is meant to close.
 *
 * What is left uncovered: a pattern with nested quantifiers over a line shorter
 * than the bound can still take far longer than the file deserves. That work is
 * bounded, since the input is, and it is the consumer's own pattern over the
 * consumer's own tree. Running each match in a worker with a wall-clock kill
 * would close it and would make the scanner asynchronous and impure, which costs
 * more than the surface is worth.
 */
export const MAX_PATTERNS = 64
export const MAX_PATTERN_LENGTH = 200
export const MAX_SCANNED_LINE = 65_536

/**
 * The name an over-long line is reported under. Reserved, so a consumer pattern
 * cannot take it and a reader of the report can tell a rule that fired from a
 * line the gate declined to match.
 */
export const OVERLONG_LINE = 'line-exceeds-scan-bound'

/** A path or manifest field the configuration named and the tree does not have. */
export const SCAN_PATH_ERROR = 'EVAL_QUALITY_SCAN_PATH'

/** A tree the gate could not read to the end, so the scan proves nothing. */
export const SCAN_UNREADABLE = 'EVAL_QUALITY_SCAN_UNREADABLE'

const codedError = (code: string, message: string): Error =>
	Object.assign(new Error(message), { code })

const detail = (error: unknown): string =>
	error instanceof Error ? error.message : String(error)

const NonEmpty = z.string().min(1)

const isSafeRelative = (value: string): boolean =>
	!value.startsWith('/') &&
	!/^[A-Za-z]:/.test(value) &&
	!value.includes('\\') &&
	value.split('/').every((segment) => segment !== '' && segment !== '..')

const RELATIVE_PATH_MESSAGE =
	'is not a repository-relative path: write it with forward slashes, no leading slash, no drive letter, and no ".." segment, so a configuration can only name files beneath itself'

/** Shared with `lineage-ownership.ts`; see the note on `ScannedPathList`. */
export const RelativePath = NonEmpty.max(400).refine(
	isSafeRelative,
	RELATIVE_PATH_MESSAGE,
)

/** The same shape with a trailing slash allowed, for a directory prefix. */
export const RelativePrefix = NonEmpty.max(400).refine(
	(value) => isSafeRelative(value.endsWith('/') ? value.slice(0, -1) : value),
	RELATIVE_PATH_MESSAGE,
)

const ScannedPath = z.strictObject({
	path: RelativePath.describe(
		'A directory to walk, or a single file to read, relative to this configuration file.',
	),
	recursive: z
		.boolean()
		.default(true)
		.describe(
			'Whether a directory is walked to the bottom. Ignored when the path names a file.',
		),
	extensions: z
		.array(
			z
				.string()
				.regex(
					/^\.[A-Za-z0-9][A-Za-z0-9.]*$/,
					'is not a file extension; write it with its leading dot, as ".ts"',
				),
		)
		.min(1)
		.optional()
		.describe(
			'Which files under this path are read. Leave it out and every file is read whatever its name, which is what a tree of generated data needs.',
		),
	optional: z
		.boolean()
		.default(false)
		.describe(
			'Whether this path may contribute nothing. False, the default, fails when the path is absent or holds no matching file, so a generated tree nobody built cannot read as a clean scan.',
		),
})

export type ScannedPathConfig = z.infer<typeof ScannedPath>

/**
 * The scanned-set declaration, shared with the field-ownership gate. It sits
 * here because this is the gate whose headline is the scanned set; a third gate
 * that needs it is the point at which it earns a module of its own.
 */
export const ScannedPathList = z.array(ScannedPath).min(1)

const ManifestField = NonEmpty.regex(
	/^[A-Za-z_$][A-Za-z0-9_$-]*(?:\.[A-Za-z_$][A-Za-z0-9_$-]*)*$/,
	'is not a manifest field path; write one key, or several joined by dots',
)

const ManifestScan = z
	.strictObject({
		file: RelativePath.default('package.json').describe(
			'The manifest a registry publishes verbatim.',
		),
		fields: z
			.array(ManifestField)
			.min(1)
			.describe(
				'Which fields are scanned. A string is one entry, an array joins into one, and an object becomes one entry per key, so "scripts" covers every script by name. A field named here and absent from the manifest is refused, so a typo cannot read as a field with nothing in it.',
			),
	})
	.describe(
		'The manifest fields scanned as synthetic entries. A JSON value has no line of its own, so every one of them reports at line 1.',
	)

/**
 * `\1` through `\9` and `\k<name>`. It over-refuses an escaped backslash
 * followed by a digit, which is a literal backslash and not a backreference,
 * and that spelling has no place in a boundary pattern anyway.
 */
const BACKREFERENCE = /\\[1-9]|\\k</

const ForbiddenPattern = z
	.strictObject({
		name: NonEmpty.describe(
			'What a violation is reported under. Unique across the array.',
		),
		match: z
			.string()
			.min(1)
			.max(MAX_PATTERN_LENGTH)
			.describe(
				'The regular expression, as source text. It is matched against one logical line at a time.',
			),
		flags: z
			.string()
			.regex(
				/^[imsuv]*$/,
				'admits only i, m, s, u and v. A g or a y carries a match position between calls, so a pattern holding either would match every second line it should have matched',
			)
			.default('')
			.describe('Regular-expression flags. Empty by default.'),
		reason: NonEmpty.describe(
			'Why the package may not carry it. Printed beside every violation, so the report says what to do rather than only what fired.',
		),
	})
	.superRefine((pattern, ctx) => {
		if (pattern.name === OVERLONG_LINE) {
			ctx.addIssue({
				code: 'custom',
				path: ['name'],
				message: `is reserved: the gate reports a line past its own matching bound under "${OVERLONG_LINE}"`,
			})
		}
		if (BACKREFERENCE.test(pattern.match)) {
			ctx.addIssue({
				code: 'custom',
				path: ['match'],
				message:
					'carries a backreference, which is the construct that turns a scan of one line into an exponential one; write the pattern without one',
			})
		}
		try {
			new RegExp(pattern.match, pattern.flags)
		} catch (error) {
			ctx.addIssue({
				code: 'custom',
				path: ['match'],
				message: `is not a regular expression: ${detail(error)}`,
			})
		}
	})

export const PackageBoundarySection = z
	.strictObject({
		paths: ScannedPathList.describe(
			'Everything the scan reads out of the tree. What you leave out is exempt, and leaving it out is the only exemption there is.',
		),
		manifest: ManifestScan.optional(),
		patterns: z
			.array(ForbiddenPattern)
			.min(1)
			.max(MAX_PATTERNS)
			.describe(
				'The forbidden patterns, in precedence order. The first one that matches a logical line is the one the line is reported under, and no line is reported twice, so a specific spelling has to precede any shorter word contained in it: a pattern for a word that is a substring of a path you also forbid will otherwise take every one of those paths and the path pattern will never fire.',
			),
	})
	.superRefine((section, ctx) => {
		const seen = new Set<string>()
		section.patterns.forEach((pattern, index) => {
			if (seen.has(pattern.name)) {
				ctx.addIssue({
					code: 'custom',
					path: ['patterns', index, 'name'],
					message: `repeats "${pattern.name}"; a violation is reported under this name, so two patterns cannot share one`,
				})
			}
			seen.add(pattern.name)
		})
	})
	.describe(
		'Fails on any line of any scanned file that matches a pattern you declared. The scanned set is what a registry would publish out of your tree, so what this holds is the package as an installer receives it.',
	)

export type PackageBoundaryConfig = z.infer<typeof PackageBoundarySection>

export type BoundaryPattern = {
	readonly name: string
	readonly regex: RegExp
	readonly reason: string
}

export const compileBoundaryPatterns = (
	patterns: PackageBoundaryConfig['patterns'],
): BoundaryPattern[] =>
	patterns.map((pattern) => ({
		name: pattern.name,
		regex: new RegExp(pattern.match, pattern.flags),
		reason: pattern.reason,
	}))

export type BoundaryViolation = {
	readonly file: string
	readonly line: number
	readonly pattern: string
	readonly reason: string
	readonly text: string
}

/** The comment markers a wrapped run is joined across. */
const COMMENT_START = /^\s*(\/\/+|\/\*+|\*+\/?|#)/

const isCommentLine = (line: string): boolean => COMMENT_START.test(line)

/** Strips the marker so `* Widget` and `* 1.5` join into `Widget 1.5`. */
const commentText = (line: string): string =>
	line
		.replace(COMMENT_START, '')
		.replace(/\*\/\s*$/, '')
		.trim()

type LogicalLine = {
	readonly line: number
	/** The space-joined run. This is what a violation reports. */
	readonly text: string
	/**
	 * The same run joined with nothing. A comment wrapped at the hyphen of a
	 * hyphenated word space-joins to two fragments no pattern matches; the empty
	 * join restores it. Matching both forms is fail-closed and needs no
	 * hyphenation heuristic, at the cost of matching a pair of fragments that
	 * happen to abut into a forbidden word.
	 */
	readonly tight: string
}

/**
 * One entry per logical line: a run of consecutive comment lines joins with
 * single spaces and is attributed to the first line of the run, because a
 * comment wraps at some column and a reference split across two physical lines
 * is the ordinary shape. Every other line stands on its own, and its two joins
 * are the same string.
 */
export function logicalLines(source: string): LogicalLine[] {
	const physical = source.split('\n')
	const logical: LogicalLine[] = []
	let index = 0
	while (index < physical.length) {
		const current = physical[index] as string
		if (!isCommentLine(current)) {
			logical.push({ line: index + 1, text: current, tight: current })
			index += 1
			continue
		}
		const parts: string[] = []
		const start = index
		while (index < physical.length) {
			const line = physical[index] as string
			if (!isCommentLine(line)) break
			const stripped = commentText(line)
			if (stripped !== '') parts.push(stripped)
			index += 1
		}
		logical.push({
			line: start + 1,
			text: parts.join(' '),
			tight: parts.join(''),
		})
	}
	return logical
}

export function scanPackageBoundary(
	files: ReadonlyMap<string, string>,
	patterns: readonly BoundaryPattern[],
): BoundaryViolation[] {
	const violations: BoundaryViolation[] = []
	for (const [file, source] of files) {
		for (const { line, text, tight } of logicalLines(source)) {
			if (text === '') continue
			if (text.length > MAX_SCANNED_LINE) {
				// Reported rather than skipped: a line the gate declined to match is
				// a line nobody held, and silence there is the pass this bound would
				// otherwise buy.
				violations.push({
					file,
					line,
					pattern: OVERLONG_LINE,
					reason: `a logical line of ${text.length} characters is past the ${MAX_SCANNED_LINE}-character bound a pattern is matched within, so no pattern was run against it`,
					text: `${text.slice(0, 120)}...`,
				})
				continue
			}
			for (const pattern of patterns) {
				if (!pattern.regex.test(text) && !pattern.regex.test(tight)) continue
				// One violation per logical line: the `break` is what makes the
				// declared order decide the reported name. A line carrying two
				// forbidden references is one edit either way.
				violations.push({
					file,
					line,
					pattern: pattern.name,
					reason: pattern.reason,
					text,
				})
				break
			}
		}
	}
	return violations
}

export type ScanCount = {
	readonly path: string
	readonly files: number
}

export type DiscoveredEntries = {
	readonly entries: Map<string, string>
	readonly counts: ScanCount[]
}

const matchesExtension = (declared: ScannedPathConfig, name: string): boolean =>
	declared.extensions === undefined ||
	declared.extensions.some((extension) => name.endsWith(extension))

async function walk(
	root: string,
	posix: string,
	declared: ScannedPathConfig,
	entries: Map<string, string>,
): Promise<number> {
	let dirents: Dirent[]
	try {
		dirents = await readdir(resolve(root, posix), { withFileTypes: true })
	} catch (error) {
		throw codedError(
			SCAN_UNREADABLE,
			`${posix} could not be read: ${detail(error)}`,
		)
	}
	let count = 0
	for (const entry of dirents) {
		const child = `${posix}/${entry.name}`
		if (entry.isSymbolicLink()) {
			throw codedError(
				SCAN_UNREADABLE,
				`${child} is a symbolic link; this scan does not follow links, and skipping one would leave a file unscanned while the run reported a clean tree`,
			)
		}
		if (entry.isDirectory()) {
			if (!declared.recursive) continue
			count += await walk(root, child, declared, entries)
		} else if (entry.isFile() && matchesExtension(declared, entry.name)) {
			entries.set(child, await readFile(resolve(root, child), 'utf8'))
			count += 1
		}
	}
	return count
}

/**
 * Everything the declared paths hold, keyed by the path a report prints. Fails
 * closed on the three ways a walk under-reports: a path that is not there, a
 * path that matched no file, and a link whose target could sit anywhere.
 */
export async function discoverEntries(
	root: string,
	paths: readonly ScannedPathConfig[],
	gate: string,
): Promise<DiscoveredEntries> {
	const entries = new Map<string, string>()
	const counts: ScanCount[] = []
	for (const declared of paths) {
		let info: Awaited<ReturnType<typeof lstat>>
		try {
			info = await lstat(resolve(root, declared.path))
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
				throw codedError(
					SCAN_UNREADABLE,
					`${declared.path} could not be read: ${detail(error)}`,
				)
			}
			if (declared.optional) {
				counts.push({ path: declared.path, files: 0 })
				continue
			}
			throw codedError(
				SCAN_PATH_ERROR,
				`${declared.path} does not exist, and the "${gate}" section names it under paths; mark it optional if it may be absent`,
			)
		}
		if (info.isSymbolicLink()) {
			throw codedError(
				SCAN_UNREADABLE,
				`${declared.path} is a symbolic link, and this scan does not follow links`,
			)
		}
		if (info.isFile()) {
			entries.set(
				declared.path,
				await readFile(resolve(root, declared.path), 'utf8'),
			)
			counts.push({ path: declared.path, files: 1 })
			continue
		}
		const found = await walk(root, declared.path, declared, entries)
		if (found === 0 && !declared.optional) {
			throw codedError(
				SCAN_PATH_ERROR,
				`${declared.path} holds no file the "${gate}" section asked for, so a scan of nothing would report zero violations for the wrong reason; mark it optional if it may be empty`,
			)
		}
		counts.push({ path: declared.path, files: found })
	}
	return { entries, counts }
}

function flattenField(
	key: string,
	value: unknown,
	into: Map<string, string>,
): void {
	if (typeof value === 'string') {
		into.set(key, value)
		return
	}
	if (typeof value === 'number' || typeof value === 'boolean') {
		into.set(key, String(value))
		return
	}
	if (Array.isArray(value)) {
		into.set(key, value.map((each) => String(each)).join(' '))
		return
	}
	if (value !== null && typeof value === 'object') {
		for (const [name, nested] of Object.entries(value)) {
			flattenField(`${key}.${name}`, nested, into)
		}
		return
	}
	throw codedError(
		SCAN_PATH_ERROR,
		`${key} is null, so there is nothing to scan`,
	)
}

export async function manifestEntries(
	root: string,
	manifest: NonNullable<PackageBoundaryConfig['manifest']>,
	gate: string,
): Promise<Map<string, string>> {
	let text: string
	try {
		text = await readFile(resolve(root, manifest.file), 'utf8')
	} catch (error) {
		throw codedError(
			SCAN_PATH_ERROR,
			`${manifest.file} could not be read: ${detail(error)}; the "${gate}" section names it under manifest.file`,
		)
	}
	let parsed: unknown
	try {
		parsed = JSON.parse(text)
	} catch (error) {
		throw codedError(
			SCAN_PATH_ERROR,
			`${manifest.file} is not valid JSON: ${detail(error)}`,
		)
	}
	const entries = new Map<string, string>()
	for (const field of manifest.fields) {
		let value: unknown = parsed
		for (const segment of field.split('.')) {
			value =
				value !== null && typeof value === 'object'
					? (value as Record<string, unknown>)[segment]
					: undefined
		}
		if (value === undefined) {
			throw codedError(
				SCAN_PATH_ERROR,
				`${manifest.file} carries no "${field}", and the "${gate}" section names it under manifest.fields; a field that is not there would otherwise read as a field with nothing in it`,
			)
		}
		flattenField(`${manifest.file}#${field}`, value, entries)
	}
	return entries
}

export type BoundaryReport = {
	readonly violations: readonly BoundaryViolation[]
	readonly counts: readonly ScanCount[]
	readonly scanned: number
}

/**
 * The gate, over a consumer's tree. `root` is the directory its configuration
 * file sits in, which is what makes a configuration self-contained wherever it
 * is kept.
 */
export async function runPackageBoundary(
	root: string,
	section: PackageBoundaryConfig,
	gate = 'package-boundary',
): Promise<BoundaryReport> {
	const { entries, counts } = await discoverEntries(root, section.paths, gate)
	if (section.manifest !== undefined) {
		const fields = await manifestEntries(root, section.manifest, gate)
		for (const [key, value] of fields) entries.set(key, value)
		counts.push({ path: section.manifest.file, files: fields.size })
	}
	const violations = scanPackageBoundary(
		entries,
		compileBoundaryPatterns(section.patterns),
	)
	return { violations, counts, scanned: entries.size }
}
