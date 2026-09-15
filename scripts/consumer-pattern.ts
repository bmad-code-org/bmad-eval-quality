// The bound on a regular expression a consumer writes, shared by every gate
// that takes one.
//
// Four gates now accept a pattern out of `eval-quality.config.json`, and the
// bound has to be the same in all four: a length cap on the source, a flag set
// that excludes the two flags carrying a match position between calls, a
// refusal of backreferences, and a compile check so a malformed pattern is a
// configuration error rather than a crash at the first line it reads.
//
// `package-boundary.ts` states why these are the bounds and what they leave
// uncovered. That note stays there, beside `MAX_SCANNED_LINE`, because the
// input bound is the scanner's own and only the pattern half is shared.
//
// Run by `node` directly: Node's type stripping erases types only, so no
// TypeScript enum, namespace, parameter property, or non-type re-export may
// appear in this file or anything it imports.
import { z } from 'zod'

export const MAX_PATTERN_LENGTH = 200

/**
 * The same bound for a pattern that describes a sentence.
 *
 * A boundary pattern names a construct, and 200 characters is more than any of
 * them needs. A documentation pattern quotes prose: it carries the words either
 * side of the number or the list it captures, because those words are what stop
 * it matching a different sentence on the same page. Holding it to the shorter
 * bound would push consumers towards loose patterns, which is the failure mode
 * these gates exist to close.
 *
 * Length is the weaker half of the bound in both cases. What the work actually
 * rests on is the backreference refusal and the size of the subject, and both
 * are unchanged here.
 */
export const MAX_PROSE_PATTERN_LENGTH = 800

/**
 * `\1` through `\9` and `\k<name>`. It over-refuses an escaped backslash
 * followed by a digit, which is a literal backslash and not a backreference,
 * and that spelling has no place in a configured pattern anyway.
 */
const BACKREFERENCE = /\\[1-9]|\\k</

const FLAG_MESSAGE =
	'admits only i, m, s, u and v. A g or a y carries a match position between calls, so a pattern holding either would match every second thing it should have matched'

export const PatternSource = z.string().min(1).max(MAX_PATTERN_LENGTH)

export const ProsePatternSource = z
	.string()
	.min(1)
	.max(MAX_PROSE_PATTERN_LENGTH)

export const PatternFlags = z
	.string()
	.regex(/^[imsuv]*$/, FLAG_MESSAGE)
	.default('')

type Context = {
	addIssue(issue: {
		code: 'custom'
		path: PropertyKey[]
		message: string
	}): void
}

/**
 * The two refusals a length bound and a flag set do not cover. Exported as a
 * function so a gate composing its own object around a pattern reports them
 * against its own key path.
 */
export function refinePattern(
	match: string,
	flags: string,
	ctx: Context,
	path: PropertyKey[],
): void {
	if (BACKREFERENCE.test(match)) {
		ctx.addIssue({
			code: 'custom',
			path,
			message:
				'carries a backreference, which is the construct that turns a linear scan into an exponential one; write the pattern without one',
		})
	}
	try {
		new RegExp(match, flags)
	} catch (error) {
		ctx.addIssue({
			code: 'custom',
			path,
			message: `is not a regular expression: ${error instanceof Error ? error.message : String(error)}`,
		})
	}
}

/**
 * A pattern on its own, for a gate with nothing to say about it beyond where it
 * is matched. A gate that reports under a name or carries a reason composes
 * `PatternSource`, `PatternFlags` and `refinePattern` into its own object
 * instead.
 */
export const ConsumerPattern = z
	.strictObject({
		match: PatternSource.describe('The regular expression, as source text.'),
		flags: PatternFlags.describe('Regular-expression flags. Empty by default.'),
	})
	.superRefine((pattern, ctx) => {
		refinePattern(pattern.match, pattern.flags, ctx, ['match'])
	})

export type ConsumerPatternConfig = z.infer<typeof ConsumerPattern>

/** The same object at the prose bound, for the documentation gates. */
export const ProsePattern = z
	.strictObject({
		match: ProsePatternSource.describe(
			'The regular expression, as source text.',
		),
		flags: PatternFlags.describe('Regular-expression flags. Empty by default.'),
	})
	.superRefine((pattern, ctx) => {
		refinePattern(pattern.match, pattern.flags, ctx, ['match'])
	})

export const compilePattern = (pattern: ConsumerPatternConfig): RegExp =>
	new RegExp(pattern.match, pattern.flags)

/**
 * The same pattern with `g` added, for a gate that counts every occurrence.
 * `g` is outside the configured flag set because a consumer cannot be given a
 * stateful `lastIndex`; a gate that needs it adds it at the point of use, where
 * the regular expression is built fresh for each subject.
 */
export const compileGlobalPattern = (pattern: ConsumerPatternConfig): RegExp =>
	new RegExp(pattern.match, `${pattern.flags}g`)
