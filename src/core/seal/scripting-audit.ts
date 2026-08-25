/**
 * The post-generation scripting audit (AD-16, `brief-exceeds-scripting-bound`).
 * The declaration-side graph predicate over the interaction plan (Story 4.3)
 * can't see free text an author wrote directly onto a direction's
 * `scope`/`negativeDomain`. This audit is the other half: it counts
 * sequencing/transition vocabulary in each direction's rendered `text`, the
 * one channel the generator itself never emits (AC 4), so any match here
 * came through author text verbatim.
 */
import { type FailureCode, StructuralFailure } from '../failure-codes.ts'
import type { SealedEvaluatorBrief } from '../schemas/sealed-evaluator-brief.ts'

const AD5_CODE: FailureCode = 'brief-exceeds-scripting-bound'

// Matches Story 2.1's AC 4 forbidden ordering vocabulary minus bare ordinals
// (Decision 4: bare "first" also appears as a data-position adjective in
// accepted author prose), plus a numbered- or lettered-list marker (`1.`,
// `2)`, `a)`). `afterward`/`subsequent` match their inflected forms too,
// since a bare-word boundary can't catch one word inside another and each
// inflection is a real evasion path.
//
// The list-marker branch anchors to actual list context (string start,
// after a newline, or after a sentence-ending mark) rather than any
// mid-sentence digit-punctuation-space. Its trailing boundary rejects a
// following digit rather than requiring whitespace, so "1.Send the request"
// still opens a list item while "12.5" reads as a decimal fraction. The
// marker is an unbounded digit run or a single letter, so `a)`/`b)` count
// alongside `1.`/`2)`.
const SEQUENCE_MARKER_PATTERN =
	/\b(?:then|before|after|subsequent(?:ly)?|next|finally|afterward(?:s)?)\b|(?<=^\s*|\n\s*|[.!?]\s*)(?:\d+|[a-z])[.)](?!\d)/gi

/**
 * `probeStepBound: null` skips the audit (the codebase's null-means-absent
 * convention); a declared `0` is legal and strict, permitting no marker.
 *
 * Checked per direction, never summed across the brief, so an unrelated
 * direction's own count never tightens an already-declared bound.
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
