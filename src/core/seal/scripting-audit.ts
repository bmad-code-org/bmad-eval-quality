/**
 * The post-generation scripting audit (AD-16, `brief-exceeds-scripting-bound`).
 * The declaration-side graph predicate over the interaction plan (Epic 4 Story
 * 4.3) cannot see free text an author wrote directly onto a direction's
 * `scope`/`negativeDomain` — that text has no structure a plan-graph predicate
 * can read. This audit is the other half: it runs over the already-generated
 * brief and counts sequencing/transition vocabulary in each direction's own
 * rendered `text`, which is exactly the one channel Story 2.1's own generator
 * never itself emits (its AC 4), so any match here came through author text
 * passed through verbatim.
 */
import { type FailureCode, StructuralFailure } from '../failure-codes.ts'
import type { SealedEvaluatorBrief } from '../schemas/sealed-evaluator-brief.ts'

const AD5_CODE: FailureCode = 'brief-exceeds-scripting-bound'

// Story 2.1's own AC 4 already forbids this vocabulary in generator-composed
// text ("first", "then", "before", "after", "subsequently", or equivalent
// ordering words); this pattern is that same vocabulary minus bare ordinals
// (Decision 4: `gateCContract`'s own shipped O-004 negative domain, "Every
// element of the returned page, not the first.", uses "first" as a
// data-position adjective in already-accepted author prose, not as a step
// marker), plus a numbered- or lettered-list marker (`1.`, `2)`, `a)`, ...).
// `afterward` and `subsequent` both match their inflected forms
// (`afterwards`, `subsequently`), since a bare-word boundary alone cannot
// match one inside the other and each inflection is a real evasion path
// otherwise.
//
// The list-marker branch is anchored to actual list context rather than any
// mid-sentence digit-punctuation-space: it fires only when the marker starts
// the string, follows a newline, or follows a sentence-ending mark, optionally
// with whitespace of any length in between (a variable-length lookbehind, so
// an indented continuation line and a doubled sentence-terminal space both
// still anchor, and so does a directly-abutting run with none). Its trailing
// boundary is a negative lookahead for another digit, not whitespace: "1.Send
// the request" still opens a list item (the character after the period is a
// letter), while "12.5" does not (the character after is a digit, the
// shape of a decimal fraction), which is a better-justified distinction than
// requiring trailing whitespace, since a marker packed with no space at all
// ("1.Do...2.Do...") is not thereby less of a script. The marker itself is
// either an unbounded digit run or a single letter, so `a)`/`b)` count
// alongside `1.`/`2)`.
const SEQUENCE_MARKER_PATTERN =
	/\b(?:then|before|after|subsequent(?:ly)?|next|finally|afterward(?:s)?)\b|(?<=^\s*|\n\s*|[.!?]\s*)(?:\d+|[a-z])[.)](?!\d)/gi

/**
 * Returns normally when every direction's `text` is within
 * `brief.probeStepBound`; throws `StructuralFailure` otherwise. A thrower,
 * not a predicate returning a boolean or a result object, matching Story
 * 2.1's own house style (`buildPlanIndex`, `resolveStep`, `renderDirectionText`
 * all throw directly on their own detected violation) and the schema
 * comments' "thrower" language literally.
 *
 * `probeStepBound: null` means no bound was declared and the audit passes
 * vacuously, matching the codebase's established null-means-absent-constraint
 * convention. A declared `0` is a legal, strict value: no marker of any kind
 * is permitted.
 *
 * The bound is checked per direction, never summed across the brief: an
 * enumerated path is something a reader reconstructs from one direction's own
 * narrated claim, so a direction with more markers than the bound fails on
 * its own, and an unrelated direction elsewhere in the same brief never makes
 * an already-declared bound tighter.
 *
 * Scoped to `brief.directions[].text` only, not `behaviors`, `scopedResources`,
 * or `safetyLimits` (Decision 5): FR8 and AD-38 tie the bound specifically to
 * prose `seal` "deterministically generates ... from direction fields", the
 * narrowest reading the cited text supports.
 *
 * If more than one direction violates its bound, which one's failure surfaces
 * first depends only on `brief.directions`' own array order; this function
 * does not find every violation in one pass.
 */
export function auditBriefScripting(brief: SealedEvaluatorBrief): void {
	if (brief.probeStepBound === null) return
	for (const direction of brief.directions) {
		const count = direction.text.match(SEQUENCE_MARKER_PATTERN)?.length ?? 0
		if (count > brief.probeStepBound) {
			throw new StructuralFailure(
				AD5_CODE,
				`SealedEvaluatorBrief.directions[oracleId=${direction.oracleId}].text`,
				`${count} enumerated-probe-step marker(s) exceed the declared bound of ${brief.probeStepBound}`,
			)
		}
	}
}
