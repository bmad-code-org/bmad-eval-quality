// The discipline-rule vocabulary Epic 5 mints. AD-20 names its seven rules in
// prose only, so `Waiver.rule` and `CoverageGap.rule` stay opaque strings and
// these spellings are what joins a gap record to a waiver.

import { describe, expect, it } from 'vitest'
import {
	DISCIPLINE_RULES,
	relevancePredicateId,
	satisfactionPredicateId,
} from '../../src/core/coverage/rules.ts'

// The distinct `oracles[].rule` values the Gate C contract carried, in its own
// order (reviews/gate-c/eval-contract.json:267-446). Literals, so a rename on
// either side fails here before the vocabulary forks from `Waiver.rule`.
// The seven predicate identifiers. `relevancePredicateId` derives them, so an
// assertion that re-derives one holds for any suffix. They fill
// `CoverageGap.relevancePredicate`, an opaque `z.string().min(1)`
// (evidence-artifact.ts:154), and Story 5.3's table.
const RELEVANCE_PREDICATE_IDS = [
	'success-indicator-separation-relevance',
	'whole-body-relevance',
	'malformed-input-relevance',
	'per-record-relevance',
	'sibling-cross-check-relevance',
	'omission-and-completeness-relevance',
	'state-change-read-back-relevance',
] as const

// The satisfaction half, as literals for the same reason.
const SATISFACTION_PREDICATE_IDS = [
	'success-indicator-separation-satisfaction',
	'whole-body-satisfaction',
	'malformed-input-satisfaction',
	'per-record-satisfaction',
	'sibling-cross-check-satisfaction',
	'omission-and-completeness-satisfaction',
	'state-change-read-back-satisfaction',
] as const

const GATE_C_RULES = [
	'state-change-read-back',
	'success-indicator-separation',
	'whole-body',
	'per-record',
	'omission-and-completeness',
	'malformed-input',
	'sibling-cross-check',
] as const

describe('the discipline-rule identifiers', () => {
	it('57. are seven unique kebab-case rules, each with its own predicate identifier', () => {
		expect(DISCIPLINE_RULES).toHaveLength(7)
		expect(new Set(DISCIPLINE_RULES).size).toBe(7)
		for (const rule of DISCIPLINE_RULES) {
			expect(rule).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
		}
		const predicates = DISCIPLINE_RULES.map(relevancePredicateId)
		expect(new Set(predicates).size).toBe(7)
		expect(predicates).toEqual([...RELEVANCE_PREDICATE_IDS])
	})

	it('58. are the seven the Gate C contract carried', () => {
		// Sets, since the tuple is in AD-20's order and the Gate C oracle list is
		// in its own.
		expect(new Set(DISCIPLINE_RULES)).toEqual(new Set(GATE_C_RULES))
	})

	it('130. carry a satisfaction predicate identifier apiece', () => {
		const predicates = DISCIPLINE_RULES.map(satisfactionPredicateId)
		expect(new Set(predicates).size).toBe(7)
		expect(predicates).toEqual([...SATISFACTION_PREDICATE_IDS])
	})

	it('131. never spell a relevance identifier the same as a satisfaction one', () => {
		// A `CoverageGap` carries both for one rule, so an overlap would make the
		// two fields indistinguishable.
		const relevance = new Set(DISCIPLINE_RULES.map(relevancePredicateId))
		const satisfaction = new Set(DISCIPLINE_RULES.map(satisfactionPredicateId))
		for (const predicate of satisfaction) {
			expect(relevance.has(predicate), predicate).toBe(false)
		}
		expect(new Set([...relevance, ...satisfaction]).size).toBe(14)
	})
})
