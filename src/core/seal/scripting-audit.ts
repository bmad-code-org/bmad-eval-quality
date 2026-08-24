/**
 * The post-generation scripting audit (AD-16, `brief-exceeds-scripting-bound`).
 * The declaration-side graph predicate over the interaction plan (Epic 4 Story
 * 4.3) cannot see free text an author wrote directly onto a direction's
 * `scope`/`negativeDomain`: that text has no structure a plan-graph predicate
 * can read. This audit is the other half: it runs over the already-generated
 * brief and counts sequencing/transition vocabulary in each direction's own
 * rendered `text`, the one channel Story 2.1's own generator never itself
 * emits (its AC 4), so any match here came through author text passed through
 * verbatim.
 */
import { type FailureCode, StructuralFailure } from '../failure-codes.ts'
import type { SealedEvaluatorBrief } from '../schemas/sealed-evaluator-brief.ts'

const AD5_CODE: FailureCode = 'brief-exceeds-scripting-bound'

// Matches Story 2.1's AC 4 forbidden ordering vocabulary minus bare ordinals
// (Decision 4: bare "first" also appears as a data-position adjective in
// already-accepted author prose, not only as a step marker), plus a
// numbered- or lettered-list marker (`1.`, `2)`, `a)`, ...). `afterward` and
// `subsequent` match their inflected forms too, since a bare-word boundary
// can't otherwise catch one word inside another and each inflection is a
// real evasion path.
//
// The list-marker branch anchors to actual list context, not any mid-sentence
// digit-punctuation-space: it fires only at the string start, after a
// newline, or after a sentence-ending mark, with any amount of whitespace in
// between. Its trailing boundary rejects a following digit rather than
// requiring following whitespace, so "1.Send the request" still opens a list
// item while "12.5" reads as a decimal fraction, and a tightly-packed
// "1.Do...2.Do..." still counts as a script. The marker is an unbounded digit
// run or a single letter, so `a)`/`b)` count alongside `1.`/`2)`.
const SEQUENCE_MARKER_PATTERN =
	/\b(?:then|before|after|subsequent(?:ly)?|next|finally|afterward(?:s)?)\b|(?<=^\s*|\n\s*|[.!?]\s*)(?:\d+|[a-z])[.)](?!\d)/gi

/**
 * Throws `StructuralFailure` rather than returning a boolean, matching this
 * story's other validators and the schema's own "thrower" language.
 *
 * `probeStepBound: null` means no bound was declared, so the audit passes
 * vacuously (the codebase's null-means-absent convention). A declared `0` is
 * legal and strict: no marker of any kind is permitted.
 *
 * Checked per direction, never summed across the brief: a reader
 * reconstructs an enumerated path from one direction's own narrated claim,
 * so an unrelated direction elsewhere never tightens an already-declared
 * bound.
 *
 * Scoped to `brief.directions[].text` only, not `behaviors`,
 * `scopedResources`, or `safetyLimits` (Decision 5).
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
