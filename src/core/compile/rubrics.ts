/**
 * AD-22's compile-time rubric checks. `checkRubricIdentifiers` runs first and
 * fires `rubric-unanchored`; the other three follow AD-5's registry order,
 * `rubric-scores-reasoning-prose`, `rubric-unanchored`, then
 * `rubric-evidence-unreachable`. Each throws `StructuralFailure` on the first
 * violation, the convention every `core/compile/` module keeps. An empty
 * `rubrics` array is a no-op in all four, which is what makes a zero-rubric
 * contract compile clean.
 */
import { StructuralFailure } from '../failure-codes.ts'
import type { EvalContract } from '../schemas/eval-contract.ts'
import type { RubricBody } from '../schemas/rubric.ts'
import { buildPlanIndex, type PlanIndex } from '../seal/plan-index.ts'
import { evaluatePointerReachability } from './reachability.ts'

const rubricPath = (rubric: RubricBody): string =>
	`EvalContract.rubrics[id=${rubric.id}]`

// `trim()` leaves U+200B through U+200D and U+FEFF standing, and a zero-width
// space states no observable condition either.
const INVISIBLE = /[\u200b-\u200d\ufeff]/g
const blank = (value: string): boolean =>
	value.replace(INVISIBLE, '').trim().length === 0

// Function declarations, so TypeScript narrows control flow through the
// `never` return type: a guard below reads a nullable field straight after the
// call that rejects its null case.
function unanchored(path: string, detail: string): never {
	throw new StructuralFailure('rubric-unanchored', path, detail)
}

function scoresReasoning(path: string, term: string): never {
	throw new StructuralFailure(
		'rubric-scores-reasoning-prose',
		path,
		`scores stated-reasoning prose: matched "${term}" (AD-17, AD-22)`,
	)
}

// ---- rubric-unanchored: addressable identifiers ---------------------------

/**
 * Runs ahead of the three checks below, reversing AD-5's registry order for
 * this one pair. Every other rubric check reports a path shaped
 * `rubrics[id=...]`, and a duplicated id makes that path address two rubrics,
 * so identifiers are settled first and every later path is unambiguous by
 * construction.
 *
 * Criterion ids are unique within a rubric and may repeat across rubrics: a
 * judge-call score cites `rubricId` and `criterionId` together, so the pair is
 * what has to be unique.
 */
export function checkRubricIdentifiers(contract: EvalContract): void {
	const seenRubricIds = new Set<string>()
	contract.rubrics.forEach((rubric, index) => {
		if (seenRubricIds.has(rubric.id)) {
			unanchored(
				`EvalContract.rubrics[${index}].id`,
				`repeats rubric id "${rubric.id}", which a finding could then cite ambiguously (AD-22)`,
			)
		}
		seenRubricIds.add(rubric.id)
	})
	// Second pass, so no `rubrics[id=...]` path is emitted while a rubric id
	// could still address two rubrics.
	for (const rubric of contract.rubrics) {
		const seenCriterionIds = new Set<string>()
		rubric.criteria.forEach((criterion, index) => {
			if (seenCriterionIds.has(criterion.id)) {
				unanchored(
					`${rubricPath(rubric)}.criteria[${index}].id`,
					`repeats criterion id "${criterion.id}" inside one rubric (AD-22)`,
				)
			}
			seenCriterionIds.add(criterion.id)
		})
	}
}

// ---- rubric-scores-reasoning-prose ---------------------------------------

// AD-17 forbids scoring chain-of-thought or stated-reasoning prose. Nothing in
// the schema declares which channel carries reasoning, so this check reads
// wording, the same trade `auditBriefScripting` made in Story 2.3. The
// alternative was a rung with no throw site.
//
// A term earns a place only when it has no ordinary sense in an API contract.
// A compile-time code has no waiver path, so a term that fires on legal
// authoring gets reworded around. Review dropped `scratchpad` (a file),
// `deliberation` (an endpoint), the `justif-` family (an error body justifies
// a 409), `explanation` (an error message explains what went wrong), bare
// `thinking` (a measurement, as in thinking time), bare `CoT` (an ordinary
// English noun), and `explain why` (a criterion can ask why an observable
// status was returned).
//
// `reasoning` and `rationale` stay despite their field-name senses. AD-17's
// own words are "stated-reasoning prose", and a criterion carries an
// `evidence` pointer so its text never has to name a field. Plurals and
// `-ing` are covered because one letter would otherwise walk past the check.

// ASCII hyphen, U+2010 hyphen, U+2011 non-breaking hyphen, or whitespace, one
// or more. A paste out of a styled document carries the two non-ASCII forms,
// and a single-character class made a doubled separator an evasion.
const SEPARATOR = '[-\\u2010\\u2011\\s]+'

// Built from fragments the way `pointer.ts` builds its pointer grammar, so the
// separator is stated once. The pattern is not global, so no `lastIndex`
// carries between calls. The first match is the whole answer.
const REASONING_PROSE_PATTERN = new RegExp(
	`\\b(?:chains?${SEPARATOR}of${SEPARATOR}thoughts?|trains?${SEPARATOR}of${SEPARATOR}thoughts?|thought${SEPARATOR}process(?:es|ing)?|thinking${SEPARATOR}process(?:es)?|(?:internal|inner)${SEPARATOR}monologues?|self${SEPARATOR}explanations?|reasonings?|rationales?)\\b`,
	'i',
)

/** The first forbidden term in `text`, or `undefined`. */
export function findReasoningProseTerm(text: string): string | undefined {
	return REASONING_PROSE_PATTERN.exec(text)?.[0]
}

/**
 * Criterion text is scanned first: AD-17 and AD-5 both scope this code to a
 * criterion, so where a rubric carries the defect in more than one place the
 * in-scope site is the one reported. Anchors and penalties are a deliberate
 * expansion. An anchor reading "level 3: the reasoning is sound" scores
 * reasoning through every criterion at once, and a penalty deducting for an
 * unstated rationale scores it through a deduction. Leave either unscanned and
 * an author walks around the criterion scan in one edit.
 */
export function checkRubricReasoningProse(contract: EvalContract): void {
	for (const rubric of contract.rubrics) {
		const path = rubricPath(rubric)
		for (const criterion of rubric.criteria) {
			const term = findReasoningProseTerm(criterion.text)
			if (term !== undefined)
				scoresReasoning(`${path}.criteria[id=${criterion.id}].text`, term)
		}
		rubric.scaleLevels?.forEach((level, index) => {
			const term = findReasoningProseTerm(level.anchor)
			if (term !== undefined)
				scoresReasoning(`${path}.scaleLevels[${index}].anchor`, term)
		})
		rubric.failureModePenalties?.forEach((penalty, index) => {
			const penaltyPath = `${path}.failureModePenalties[${index}]`
			const nameTerm = findReasoningProseTerm(penalty.name)
			if (nameTerm !== undefined)
				scoresReasoning(`${penaltyPath}.name`, nameTerm)
			const descriptionTerm = findReasoningProseTerm(penalty.description)
			if (descriptionTerm !== undefined)
				scoresReasoning(`${penaltyPath}.description`, descriptionTerm)
		})
	}
}

// ---- rubric-unanchored: the scoring instrument ---------------------------

/**
 * AD-22's three shapes, spelled out: an unanchored scale (rules 1 to 3), an
 * unbounded length (rule 4), and missing named failure-mode penalties (rules 5
 * and 6). Rule 7 applies rule 3's argument to a criterion and is the one rule
 * that stretches AD-22's wording: a criterion stating no question is
 * unanswerable in a way `rubric-evidence-unreachable` cannot see, since its
 * pointer may resolve perfectly.
 *
 * A single-level scale, a repeated penalty name, and a rubric with no criteria
 * are all legal, each with an accept test guarding it. The first two were
 * proposed and rejected in review; AD-19 settles the third by stating that
 * AD-17's rules bind only when a rubric names criteria.
 */
export function checkRubricAnchoring(contract: EvalContract): void {
	for (const rubric of contract.rubrics) {
		const path = rubricPath(rubric)
		const { scaleLevels, failureModePenalties } = rubric

		if (scaleLevels === null || scaleLevels.length === 0)
			unanchored(
				`${path}.scaleLevels`,
				'declares no anchored scale levels (AD-22)',
			)

		const seenOrdinals = new Set<number>()
		scaleLevels.forEach((level, index) => {
			if (seenOrdinals.has(level.level)) {
				unanchored(
					`${path}.scaleLevels[${index}].level`,
					`repeats scale-level ordinal ${level.level}, so the ordinal addresses two anchors (AD-22)`,
				)
			}
			seenOrdinals.add(level.level)
		})
		scaleLevels.forEach((level, index) => {
			if (blank(level.anchor)) {
				unanchored(
					`${path}.scaleLevels[${index}].anchor`,
					'states no observable condition, so the level is unanchored (AD-22)',
				)
			}
		})

		if (rubric.maxLength === null)
			unanchored(`${path}.maxLength`, 'declares no bounded length (AD-22)')

		if (failureModePenalties === null || failureModePenalties.length === 0)
			unanchored(
				`${path}.failureModePenalties`,
				'names no failure-mode penalties (AD-22)',
			)
		failureModePenalties.forEach((penalty, index) => {
			if (blank(penalty.name)) {
				unanchored(
					`${path}.failureModePenalties[${index}].name`,
					'is blank, so the penalty is unnamed (AD-22)',
				)
			}
		})

		for (const criterion of rubric.criteria) {
			if (blank(criterion.text)) {
				unanchored(
					`${path}.criteria[id=${criterion.id}].text`,
					'states no question, so the criterion is unanchored (AD-22)',
				)
			}
		}
	}
}

// ---- rubric-evidence-unreachable -----------------------------------------

/**
 * `evaluatePointerReachability` is reused, so the two evidence codes give the
 * same reason for the same broken pointer. Two limits come with it. A `@/`
 * pointer cannot parse into `criterion.evidence`, an `InteractionPointer`, so
 * that branch is dead here. And a channel that declares no shape resolves as
 * soon as its step does, so a criterion rooted at `stdout` compiles on an
 * `api`-kind contract that can never produce one. That gap belongs to
 * `unreachable-check-evidence` as well, and a second implementation written to
 * close it for rubrics alone would leave the two codes disagreeing about the
 * same pointer.
 *
 * `duplicateIds: 'unresolved'` is load-bearing. `buildPlanIndex` otherwise
 * throws a `TypeError` on a duplicate step or operation id, and a caller has
 * no way to classify a `TypeError` that escapes a compile check.
 */
export function checkRubricEvidenceReachability(contract: EvalContract): void {
	let index: PlanIndex | undefined
	for (const rubric of contract.rubrics) {
		for (const criterion of rubric.criteria) {
			index ??= buildPlanIndex(
				contract.interactionPlan,
				contract.permittedInterfaces,
				{ duplicateIds: 'unresolved' },
			)
			const result = evaluatePointerReachability(criterion.evidence, index)
			if (!result.reachable) {
				throw new StructuralFailure(
					'rubric-evidence-unreachable',
					`${rubricPath(rubric)}.criteria[id=${criterion.id}].evidence`,
					`"${criterion.evidence}" ${result.reason}`,
				)
			}
		}
	}
}
