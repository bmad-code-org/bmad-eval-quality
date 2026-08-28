/**
 * The post-generation scripting audit (AD-16, `brief-exceeds-scripting-bound`).
 * The declaration-side graph predicate over the interaction plan
 * (`core/compile/scripting-bound.ts`) can't see free text an author wrote
 * directly onto a direction's `scope`/`negativeDomain`. This audit is the
 * other half: it counts sequencing/transition vocabulary in each direction's
 * rendered `text`. The templates in `direction-prose.ts` compose no ordering
 * word of their own, so a match arrives from the author's `scope` or
 * `negativeDomain`, or from an `operationId` that `derived-reference.ts`
 * humanizes into one (`next-page` renders "the next page endpoint").
 */
import { type FailureCode, StructuralFailure } from '../failure-codes.ts'
import type { SealedEvaluatorBrief } from '../schemas/sealed-evaluator-brief.ts'

const AD5_CODE: FailureCode = 'brief-exceeds-scripting-bound'

// Matches the ordering vocabulary forbidden in generator-composed text,
// minus bare ordinals (bare "first" also appears as a data-position
// adjective in accepted author prose), plus a numbered- or lettered-list
// marker (`1.`, `2)`, `a)`). `afterward`/`subsequent` match their inflected
// forms too, since a bare-word boundary can't catch one word inside another
// and each inflection is a real evasion path.
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
 * Scoped to `brief.directions[].text` only, leaving `behaviors`,
 * `scopedResources`, and `safetyLimits` unscanned: AD-16 runs this audit
 * after generation over what `seal` generated, and AD-38 names AD-3's
 * generated direction as that output. The other three are carried through
 * from the contract.
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
