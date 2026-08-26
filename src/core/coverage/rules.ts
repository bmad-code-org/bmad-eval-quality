/** AD-20's seven discipline rules as identifiers, in AD-20's enumeration order. */

// AD-20 names its seven rules in prose and gives them no identifiers, which is
// why `Waiver.rule` and `CoverageGap.rule` are opaque strings. These spellings
// are the Gate C contract's own `oracles[].rule` values
// (reviews/gate-c/eval-contract.json:267-446), so a gap joins a waiver.
export const DISCIPLINE_RULES = [
	'success-indicator-separation',
	'whole-body',
	'malformed-input',
	'per-record',
	'sibling-cross-check',
	'omission-and-completeness',
	'state-change-read-back',
] as const

export type DisciplineRule = (typeof DISCIPLINE_RULES)[number]

/** `relevancePredicate` on a coverage-gap record. Derived, so a new rule arrives with one. */
export const relevancePredicateId = (rule: DisciplineRule): string =>
	`${rule}-relevance`

/** `satisfactionPredicate` on a coverage-gap record. Derived, like its relevance twin. */
export const satisfactionPredicateId = (rule: DisciplineRule): string =>
	`${rule}-satisfaction`
