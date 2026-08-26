/**
 * AD-31 coverage gaps: relevance fired and satisfaction failed. A satisfied
 * rule gets no record, since AD-21 reads `coverageGaps` as the gap list.
 * Nothing throws; a gap never blocks compilation (ARCHITECTURE-SPINE.md:251).
 */
import {
	type EvalContract,
	SEVERITY_LEVELS,
	type Severity,
} from '../schemas/eval-contract.ts'
import type { CoverageGap } from '../schemas/evidence-artifact.ts'
import { evaluateRelevance } from './relevance.ts'
import { evaluateSatisfaction } from './satisfaction.ts'

export type CoverageGapRecord = CoverageGap

/**
 * Highest declared behaviour severity. `behaviors` carries `.min(1)`, so this
 * is total. The maximum, because the predicates are contract-level and
 * oracle-blind: a lower reduction lets one trivial behaviour push every gap
 * under AD-21's severity floor.
 */
export function coverageSeverity(contract: EvalContract): Severity {
	let rank = 0
	for (const behavior of contract.behaviors) {
		rank = Math.max(rank, SEVERITY_LEVELS.indexOf(behavior.severity))
	}
	return SEVERITY_LEVELS[rank]!
}

/** One record per gap, in `DISCIPLINE_RULES` order. Both arrays share it, so the pairing is positional. */
export function evaluateCoverage(
	contract: EvalContract,
): readonly CoverageGapRecord[] {
	const relevance = evaluateRelevance(contract)
	const satisfaction = evaluateSatisfaction(contract)
	const severity = coverageSeverity(contract)
	const gaps: CoverageGapRecord[] = []
	// `!relevant.relevant` is unfalsifiable today: a rule relevant for no site
	// answers satisfied vacuously, which fixture 168 pins over 23 contracts. It
	// stays as the conjunction AD-31 states, so a predicate pair that broke the
	// invariant cannot record a gap for a rule that never fired.
	for (const [index, relevant] of relevance.entries()) {
		const satisfied = satisfaction[index]
		if (satisfied === undefined || !relevant.relevant || satisfied.satisfied) {
			continue
		}
		gaps.push({
			rule: relevant.rule,
			relevancePredicate: relevant.predicate,
			satisfactionPredicate: satisfied.predicate,
			satisfied: false,
			severity,
		})
	}
	return gaps
}
