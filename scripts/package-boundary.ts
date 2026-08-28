// AD-15's one-way dependency, as a scanner. Pure and synchronous over a file
// map, the shape `dependency-direction.ts` and `lineage-ownership.ts` already
// use, so one function backs both the real scan and the synthetic test maps.
//
// A line-and-pattern scan over text, so it neither uses `token-scan.ts` nor
// inherits its limits: the references AD-15 forbids live in comments and in
// string literals, which a token scan reports by kind and not by content.
//
// Run by `node` directly: Node's type stripping erases types only, so no
// TypeScript enum, namespace, parameter property, or non-type re-export may
// appear in this file or anything it imports.

export type BoundaryViolation = {
	readonly file: string
	readonly line: number
	readonly pattern: string
	readonly text: string
}

type BoundaryPattern = {
	readonly name: string
	readonly regex: RegExp
	readonly reason: string
}

/**
 * The twelve forbidden patterns, in precedence order: the first match on a
 * logical line is the one reported. The specific spellings precede the bare
 * `bmad` word, which is a substring of `_bmad-output` and would otherwise
 * report every planning-artifact path under the wrong pattern name.
 *
 * Patterns 9 through 11 rest on an inference AD-15 does not spell out:
 * "an epic or story format" includes that format's own numbering. An
 * acceptance-criterion number, a task number, and a story-local decision
 * number have no identity a reader outside this repository can resolve, which
 * is the property AD numbers have and these do not. An `ADR-nnn Decision N`
 * citation is exempt: an ADR is a published decision record with an
 * identifier.
 *
 * Pattern 12 is the planning-artifact path the other eleven missed. The
 * architecture spine is not published: the tarball's `files` list carries
 * `dist`, `schemas`, `corpus`, `README.md`, and `LICENSE`, so every
 * `ARCHITECTURE-SPINE.md` citation that ships points at a file the consumer
 * does not have. Same class as patterns 3, 4, and 5.
 *
 * An `Owed item \d` pattern was proposed and declined. "Owed to the reference
 * implementation" is a numbered section of the spine, so the phrase is
 * architecture vocabulary of the same class as an AD number, and
 * `corpus/dev/README.md` is required by an acceptance criterion to name Owed
 * items 1 and 7 as the reason two AD-38 dimensions are absent.
 *
 * The numbered patterns admit a plural `s`, either separator (`AC 8`, `ACs 8`,
 * `AC-8`), and any case, because `ac 8` is the same reference in a lower-cased
 * sentence.
 */
export const BOUNDARY_PATTERNS: readonly BoundaryPattern[] = [
	{
		name: '_bmad-output',
		regex: /_bmad-output/,
		reason: 'a planning-artifact path',
	},
	{
		name: 'planning-artifact',
		regex: /planning[- ]artifact/,
		reason: 'a planning-artifact path',
	},
	{
		name: 'implementation-artifact',
		regex: /implementation[- ]artifact/,
		reason: 'a planning-artifact path',
	},
	{
		name: 'sprint-status',
		regex: /sprint[- ]status/,
		reason: "the epic-and-story format's tracking file",
	},
	{
		name: 'ARCHITECTURE-SPINE.md',
		regex: /ARCHITECTURE-SPINE\.md/,
		reason: 'a planning-artifact path the tarball does not carry',
	},
	{ name: 'bmad', regex: /bmad/i, reason: 'no module references BMad' },
	{ name: 'TEA', regex: /\bTEA\b/, reason: 'no module references TEA' },
	{
		name: 'story',
		regex: /\bstor(y|ies)\b/i,
		reason: 'an epic or story format',
	},
	{ name: 'epic', regex: /\bepics?\b/i, reason: 'an epic or story format' },
	{
		name: 'AC n',
		regex: /\bACs?[- ]\d/i,
		reason: 'an acceptance-criterion reference',
	},
	{
		name: 'Task n',
		regex: /\bTasks?[- ]\d/i,
		reason: "the same format's task numbering",
	},
	{
		name: 'Decision n',
		regex: /(?<!ADR-\d{3} )\bDecisions?[- ]\d/i,
		reason: 'a story-local decision number with no stable identity',
	},
]

/** The comment markers a wrapped run is joined across. */
const COMMENT_START = /^\s*(\/\/+|\/\*+|\*+\/?|#)/

const isCommentLine = (line: string): boolean => COMMENT_START.test(line)

/** Strips the marker so `* Story` and `* 1.5` join into `Story 1.5`. */
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
	 * The same run joined with nothing. A comment wrapped at the hyphen of
	 * `planning-artifact` space-joins to `planning- artifact`, which no pattern
	 * matches; the empty join restores it. Matching both forms is fail-closed
	 * and needs no hyphenation heuristic, at the cost of matching a pair of
	 * fragments that happen to abut into a forbidden word.
	 */
	readonly tight: string
}

/**
 * One entry per logical line: a run of consecutive comment lines joins with
 * single spaces and is attributed to the first line of the run, because JSDoc
 * here wraps at about eighty columns and a reference split across two physical
 * lines is the ordinary shape. Every other line stands on its own, and its two
 * joins are the same string.
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
): BoundaryViolation[] {
	const violations: BoundaryViolation[] = []
	for (const [file, source] of files) {
		for (const { line, text, tight } of logicalLines(source)) {
			if (text === '') continue
			for (const pattern of BOUNDARY_PATTERNS) {
				if (!pattern.regex.test(text) && !pattern.regex.test(tight)) continue
				// One violation per logical line: the `break` is what makes the
				// precedence order above decide the reported name. A line carrying
				// two forbidden references is one edit for the dev either way.
				violations.push({ file, line, pattern: pattern.name, text })
				break
			}
		}
	}
	return violations
}
