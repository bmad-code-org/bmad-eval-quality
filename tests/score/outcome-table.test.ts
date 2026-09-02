// AD-33's emitted decision table. Drives the pure builder with in-memory input
// and reads no file, the way `tests/coverage/table.test.ts` does; the
// committed document is the drift check's business.
//
// The census assertions run over hand-built resolutions with hand-counted
// expectations, and read the numbers back out of the rendered document by
// parsing it. Nothing here recomputes a census from the same source the
// builder used, so an off-by-one in the builder's arithmetic and a pair of
// swapped census sections each fail here, ahead of the drift check.

import { describe, expect, it } from 'vitest'
import {
	CORROBORATION_VALUES,
	OUTCOME_STATES,
} from '../../src/core/schemas/evidence-artifact.ts'
import {
	CORROBORATION_RULES,
	INVALIDATING_CONDITIONS,
	OUTCOME_RULES,
	type OutcomeResolution,
	resolveOutcome,
	WAIVER_RULES,
} from '../../src/core/score/outcome.ts'
import {
	type OutcomeTableConstraints,
	outcomeDecisionTable,
} from '../../src/core/score/outcome-table.ts'
import {
	fixtureCases,
	infeasiblePairs,
	NEUTRAL_INPUTS,
	STRUCTURAL_CONSTRAINTS,
} from './fixtures/outcome-inputs.ts'

const CONSTRAINTS: OutcomeTableConstraints = {
	constraints: STRUCTURAL_CONSTRAINTS,
	infeasiblePairs: infeasiblePairs(),
}

const RESOLVED = fixtureCases().map(resolveOutcome)

const at = <T>(list: readonly T[], index: number): T => {
	const entry = list[index]
	if (entry === undefined) {
		throw new Error(`outcome-table.test: no entry at index ${index}`)
	}
	return entry
}

const synthetic = (
	overrides: Partial<OutcomeResolution>,
): OutcomeResolution => ({
	rule: 'outcome-clear',
	waiverRule: null,
	corroborationRule: 'never-ran',
	state: 'confirmed',
	corroboration: 'not-evaluable',
	resolvedFrom: null,
	selectedObservationIds: [],
	declinedFindingIds: [],
	invalidatingConditions: [],
	...overrides,
})

/**
 * Twenty-two resolutions: one per ladder row carrying that row's own state,
 * plus one per waiver rule. Corroboration rules cycle over the twenty and the
 * two waiver entries both take `never-ran`; conditions cycle twice through the
 * ten. Every census key is reached and no two censuses share a multiplicity
 * profile, so a swapped section is visible in the numbers as well as the keys.
 */
const CENSUS_CASES: readonly OutcomeResolution[] = [
	...OUTCOME_RULES.map((rule, index) =>
		synthetic({
			rule: rule.id,
			state: rule.state,
			corroborationRule: at(
				CORROBORATION_RULES,
				index % CORROBORATION_RULES.length,
			).id,
			invalidatingConditions: [
				at(INVALIDATING_CONDITIONS, index % INVALIDATING_CONDITIONS.length).id,
			],
		}),
	),
	synthetic({
		rule: 'witness-manifested-unclaimed',
		waiverRule: 'waiver-honoured',
		state: 'not-applicable',
	}),
	synthetic({
		rule: 'witness-manifested-unclaimed',
		waiverRule: 'waiver-bypassed',
		state: 'bypassed',
	}),
]

const linesUnder = (document: string, heading: string): readonly string[] => {
	const lines = document.split('\n')
	const start = lines.indexOf(heading)
	expect(start, heading).toBeGreaterThanOrEqual(0)
	const rest = lines.slice(start + 1)
	const end = rest.findIndex((line) => line.startsWith('#'))
	return end === -1 ? rest : rest.slice(0, end)
}

const censusUnder = (
	document: string,
	heading: string,
): Record<string, number> => {
	const counted: Record<string, number> = {}
	for (const line of linesUnder(document, heading)) {
		const match = /^\| `([^`]+)` \| (\d+) \|$/.exec(line)
		if (match?.[1] === undefined || match[2] === undefined) continue
		counted[match[1]] = Number(match[2])
	}
	return counted
}

let built: string | undefined
const documentOf = (): string => {
	built ??= outcomeDecisionTable(RESOLVED, CONSTRAINTS)
	return built
}

let census: string | undefined
const censusDocumentOf = (): string => {
	census ??= outcomeDecisionTable(CENSUS_CASES, CONSTRAINTS)
	return census
}

describe('the published censuses', () => {
	it('counts each state, and puts the states under the state heading', () => {
		expect(censusUnder(censusDocumentOf(), '### By state')).toEqual({
			caught: 4,
			confirmed: 2,
			missed: 1,
			'passed-clean-control': 1,
			'false-positive': 1,
			abstained: 1,
			bypassed: 1,
			unreached: 1,
			'oracle-error': 1,
			'judge-error': 1,
			'infrastructure-error': 6,
			'not-applicable': 2,
		})
	})

	it('counts each ladder rule, and puts the ladder rules under the ladder heading', () => {
		const counted = censusUnder(censusDocumentOf(), '### By ladder rule')
		expect(Object.keys(counted)).toEqual(OUTCOME_RULES.map((rule) => rule.id))
		expect(counted).toEqual({
			'evaluation-fault': 1,
			'judge-malformed': 1,
			'probe-unqualified': 1,
			'finding-dangling-probe': 1,
			'witness-unwitnessed-claim': 1,
			'witness-vacuous': 1,
			'selector-ambiguous': 1,
			'witness-unexercised': 1,
			'steps-unreached': 1,
			'zero-action-detected': 1,
			'clean-control-false-positive': 1,
			'clean-control-passed': 1,
			'canary-detected': 1,
			'canary-undetected': 1,
			'witness-matched': 1,
			'witness-manifested-unclaimed': 3,
			'oracle-cited-defect': 1,
			'check-insufficient-evidence': 1,
			'witness-not-triggered': 1,
			'outcome-clear': 1,
		})
	})

	it('counts each waiver rule and each corroboration rule under its own heading', () => {
		expect(
			Object.keys(censusUnder(censusDocumentOf(), '### By waiver rule')),
		).toEqual(WAIVER_RULES.map((rule) => rule.id))
		expect(
			Object.keys(censusUnder(censusDocumentOf(), '### By corroboration rule')),
		).toEqual(CORROBORATION_RULES.map((rule) => rule.id))
		expect(censusUnder(censusDocumentOf(), '### By waiver rule')).toEqual({
			'waiver-honoured': 1,
			'waiver-bypassed': 1,
		})
		expect(
			censusUnder(censusDocumentOf(), '### By corroboration rule'),
		).toEqual({
			'disposition-unsupported': 3,
			'disposition-contradicts-evidence': 3,
			'citation-declined': 3,
			'examined-nothing': 3,
			'never-ran': 4,
			'check-confirms-silence': 2,
			'check-confirms-finding': 2,
			'check-and-findings-diverge': 2,
		})
	})

	it('counts each invalidating condition under its own heading', () => {
		expect(
			censusUnder(censusDocumentOf(), '### By invalidating condition'),
		).toEqual({
			'evaluation-fault': 2,
			'judge-malformed': 2,
			'unqualified-probe-in-sealed-set': 2,
			'dangling-probe-citation': 2,
			'unwitnessed-detection-claim': 2,
			'vacuous-signature': 2,
			'selector-ambiguity': 2,
			'canary-non-detection': 2,
			'unsupported-disposition': 2,
			'disposition-missing': 2,
		})
	})

	it('keeps the five census key sets disjoint from each other where they should be', () => {
		const states = Object.keys(censusUnder(censusDocumentOf(), '### By state'))
		const conditions = Object.keys(
			censusUnder(censusDocumentOf(), '### By invalidating condition'),
		)
		expect(states).toEqual([...OUTCOME_STATES])
		expect(conditions).toEqual(INVALIDATING_CONDITIONS.map((entry) => entry.id))
		expect(states.some((state) => conditions.includes(state))).toBe(false)
	})

	it('states the case count it counted', () => {
		expect(censusDocumentOf()).toContain('Over the 22 resolved fixture cases')
	})
})

describe('the emitted rule tables', () => {
	it('prints every rule and condition identifier with its guard', () => {
		const document = documentOf()
		for (const entry of [
			...INVALIDATING_CONDITIONS,
			...OUTCOME_RULES,
			...WAIVER_RULES,
			...CORROBORATION_RULES,
		]) {
			expect(document, entry.id).toContain(`\`${entry.id}\``)
			expect(document, entry.id).toContain(entry.guard)
		}
	})

	it('numbers the ladder in precedence order and prints its state and citation column', () => {
		const document = documentOf()
		for (const [index, rule] of OUTCOME_RULES.entries()) {
			expect(document).toContain(
				`| ${index + 1} | \`${rule.id}\` | ${rule.guard} | \`${rule.state}\` | ${
					rule.resolvesFromCitation ? 'yes' : 'no'
				} |`,
			)
		}
		// Pinned whole, because this is the one column whose value nothing else
		// in the document restates.
		expect(document).toContain(
			"| 17 | `oracle-cited-defect` | no witness and the cited finding's bucket is `mapped` | `caught` | yes |",
		)
		expect(document).toContain(
			'| 3 | `probe-unqualified` | a probe is present and its qualification failed | `infrastructure-error` | no |',
		)
	})

	it('numbers the corroboration rows and prints each value column', () => {
		const document = documentOf()
		for (const [index, rule] of CORROBORATION_RULES.entries()) {
			expect(document, rule.id).toContain(
				`| ${index + 1} | \`${rule.id}\` | ${rule.guard} | ${rule.value} |`,
			)
		}
		for (const value of CORROBORATION_VALUES) {
			expect(document, value).toContain(`\`${value}\``)
		}
	})

	it('prints each waiver row with the state its rule actually sets', () => {
		const document = documentOf()
		for (const rule of WAIVER_RULES) {
			expect(document, rule.id).toContain(
				`| \`${rule.id}\` | ${rule.guard} | state becomes \`${rule.state}\` |`,
			)
		}
		expect(document).toContain('state becomes `not-applicable`')
		expect(document).toContain('state becomes `bypassed`')
	})

	it('carries every section heading and the constraint tables', () => {
		const document = documentOf()
		for (const heading of [
			'## Invalidating conditions',
			'## The state ladder',
			'## The waiver adjustment',
			'## Corroboration',
			'## Structural constraints',
			'## Infeasible pairs',
			'## Census',
		]) {
			expect(document).toContain(heading)
		}
		for (const constraint of STRUCTURAL_CONSTRAINTS) {
			expect(document).toContain(
				`| \`${constraint.id}\` | ${constraint.implication} |`,
			)
		}
		const [first] = infeasiblePairs()
		expect(first).toBeDefined()
		expect(document).toContain(`| \`${first?.left}\` | \`${first?.right}\` |`)
		expect(document.endsWith('\n')).toBe(true)
	})
})

describe('what the builder refuses to publish', () => {
	it('refuses an empty case list', () => {
		expect(() => outcomeDecisionTable([], CONSTRAINTS)).toThrow(
			/no resolved cases/,
		)
	})

	it('names the census whose key no case reached, one message per census', () => {
		expect(() =>
			outcomeDecisionTable(
				CENSUS_CASES.filter((entry) => entry.state !== 'bypassed'),
				CONSTRAINTS,
			),
		).toThrow(/no case reaches the AD-6 state bypassed/)
		expect(() =>
			outcomeDecisionTable(
				CENSUS_CASES.filter((entry) => entry.rule !== 'outcome-clear'),
				CONSTRAINTS,
			),
		).toThrow(/no case reaches the ladder rule outcome-clear/)
		expect(() =>
			outcomeDecisionTable(
				CENSUS_CASES.map((entry) =>
					entry.waiverRule === 'waiver-honoured'
						? { ...entry, waiverRule: 'waiver-bypassed' as const }
						: entry,
				),
				CONSTRAINTS,
			),
		).toThrow(/no case reaches the waiver rule waiver-honoured/)
		expect(() =>
			outcomeDecisionTable(
				CENSUS_CASES.map((entry) =>
					entry.corroborationRule === 'citation-declined'
						? { ...entry, corroborationRule: 'never-ran' as const }
						: entry,
				),
				CONSTRAINTS,
			),
		).toThrow(/no case reaches the corroboration rule citation-declined/)
		expect(() =>
			outcomeDecisionTable(
				CENSUS_CASES.map((entry) => ({
					...entry,
					invalidatingConditions: entry.invalidatingConditions.filter(
						(condition) => condition !== 'vacuous-signature',
					),
				})),
				CONSTRAINTS,
			),
		).toThrow(/no case reaches the invalidating condition vacuous-signature/)
	})

	it('refuses an empty constraint list and a repeated constraint identifier', () => {
		expect(() =>
			outcomeDecisionTable(RESOLVED, {
				constraints: [],
				infeasiblePairs: infeasiblePairs(),
			}),
		).toThrow(/no structural constraints/)
		const only = at(STRUCTURAL_CONSTRAINTS, 0)
		expect(() =>
			outcomeDecisionTable(RESOLVED, {
				constraints: [only, only],
				infeasiblePairs: [],
			}),
		).toThrow(/share the identifier/)
	})

	it('escapes a pipe so a prose implication cannot break the table', () => {
		const document = outcomeDecisionTable(RESOLVED, {
			constraints: [{ id: 'piped', implication: 'left | right' }],
			infeasiblePairs: [],
		})
		expect(document).toContain('| `piped` | left \\| right |')
	})

	it('resolves the neutral tuple, so the fixture baseline is a real resolution', () => {
		expect(resolveOutcome(NEUTRAL_INPUTS).state).toBe('confirmed')
	})
})
