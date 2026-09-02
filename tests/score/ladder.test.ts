import { describe, expect, it } from 'vitest'
import {
	EXIT_CONCERNS_PROMOTED,
	EXIT_FAIL,
	EXIT_INVALID,
	EXIT_OK,
	exitCodeFor,
} from '../../src/cli/exit-codes.ts'
import {
	CONTRACT_LADDER,
	LADDER_EXIT_CODES,
	PRODUCTION_LADDER,
	resolveContractVerdict,
	resolveProductionVerdict,
} from '../../src/core/score/ladder.ts'
import { ladderDecisionTable } from '../../src/core/score/ladder-table.ts'
import {
	baseline,
	contractOf,
	fixtureCases,
	neutralOutcome,
	neutralResolution,
	productionOf,
} from './fixtures/ladder-inputs.ts'

describe('resolveProductionVerdict / resolveContractVerdict', () => {
	it('resolves the clean baseline to an explicit PASS with an empty basis', () => {
		expect(resolveProductionVerdict(productionOf(baseline()))).toEqual({
			verdict: 'PASS',
			exitCode: 0,
			strictPromotable: true,
			basis: [],
		})
		expect(resolveContractVerdict(contractOf(baseline()))).toEqual({
			verdict: 'PASS',
			exitCode: 0,
			strictPromotable: true,
			basis: [],
		})
	})

	// Selector ambiguity: Invalid, verdictBasis names the condition.
	it('resolves selector ambiguity to Invalid and names the condition', () => {
		const body = {
			...baseline(),
			outcomeState: {
				...baseline().outcomeState,
				outcomes: [
					{
						...neutralOutcome(),
						resolution: {
							...neutralResolution(),
							state: 'infrastructure-error' as const,
							invalidatingConditions: ['selector-ambiguity' as const],
						},
					},
				],
			},
		}
		const production = resolveProductionVerdict(productionOf(body))
		const contract = resolveContractVerdict(contractOf(body))
		for (const resolution of [production, contract]) {
			expect(resolution.verdict).toBeNull()
			expect(resolution.exitCode).toBe(3)
			expect(
				resolution.basis.some((entry) => entry.includes('selector ambiguity')),
			).toBe(true)
		}
	})

	// Unwitnessed claim: Invalid, verdictBasis names the condition.
	it('resolves an unwitnessed detection claim to Invalid and names the condition', () => {
		const body = {
			...baseline(),
			outcomeState: {
				...baseline().outcomeState,
				outcomes: [
					{
						...neutralOutcome(),
						resolution: {
							...neutralResolution(),
							state: 'infrastructure-error' as const,
							invalidatingConditions: ['unwitnessed-detection-claim' as const],
						},
					},
				],
			},
		}
		const resolution = resolveProductionVerdict(productionOf(body))
		expect(resolution.verdict).toBeNull()
		expect(
			resolution.basis.some((entry) =>
				entry.includes('unwitnessed detection claim'),
			),
		).toBe(true)
	})

	// Unwitnessed quotation: Invalid, verdictBasis names the condition.
	it('resolves an unwitnessed quotation to Invalid and names the condition', () => {
		const body = {
			...baseline(),
			outcomeState: {
				...baseline().outcomeState,
				unwitnessedQuotations: [
					{
						findingId: 'finding-9',
						quoteIndex: 0,
						channel: 'response-body' as const,
						quote: 'nowhere in the record',
						citedObservationIds: ['obs-1'],
					},
				],
			},
		}
		const resolution = resolveContractVerdict(contractOf(body))
		expect(resolution.verdict).toBeNull()
		expect(
			resolution.basis.some(
				(entry) =>
					entry.includes('finding-9') &&
					entry.includes('unwitnessed quotation'),
			),
		).toBe(true)
	})

	// AD-21's WAIVED and PASS rungs each require "every required check
	// resolved" in their own words. A required oracle whose check never ran at
	// all can still land on a clean-looking outcome.ts state (`confirmed`, via
	// the final `outcome-clear` row, since none of Stage B's twenty rows key on
	// `checkResolution === null`) -- `required-check-unresolved` fires on that
	// alone, regardless of what any other required oracle resolved, so Invalid
	// wins the tier precedence before WAIVED gets a look.
	it('resolves Invalid when a required check never resolved, even beside a required oracle that would otherwise waiver', () => {
		const body = {
			...baseline(),
			outcomeState: {
				...baseline().outcomeState,
				outcomes: [
					{
						...neutralOutcome(),
						oracleId: 'oracle-a',
						checkResolved: false,
						resolution: { ...neutralResolution(), state: 'confirmed' as const },
					},
					{
						...neutralOutcome(),
						oracleId: 'oracle-b',
						resolution: {
							...neutralResolution(),
							rule: 'witness-manifested-unclaimed' as const,
							waiverRule: 'waiver-honoured' as const,
							state: 'not-applicable' as const,
						},
					},
				],
			},
		}
		const production = resolveProductionVerdict(productionOf(body))
		const contract = resolveContractVerdict(contractOf(body))
		for (const resolution of [production, contract]) {
			expect(resolution.verdict).toBeNull()
			expect(
				resolution.basis.some(
					(entry) =>
						entry.includes('oracle-a') && entry.includes('never resolved'),
				),
			).toBe(true)
		}
	})

	// The same gap's PASS-fallthrough variant: no waiver anywhere, so without
	// the broadened guard nothing above the final row would fire and the
	// result would fall through to PASS.
	it('resolves Invalid when a required check never resolved and nothing else in the tuple fires', () => {
		const body = {
			...baseline(),
			outcomeState: {
				...baseline().outcomeState,
				outcomes: [
					{
						...neutralOutcome(),
						checkResolved: false,
						resolution: { ...neutralResolution(), state: 'confirmed' as const },
					},
				],
			},
		}
		expect(resolveProductionVerdict(productionOf(body)).verdict).toBeNull()
		expect(resolveContractVerdict(contractOf(body)).verdict).toBeNull()
	})

	// Evidence-conditions-only CONCERNS: strictPromotable is false.
	it('marks a CONCERNS whose only firing condition is the trial-count floor as not strict-promotable', () => {
		const body = {
			...baseline(),
			outcomeState: {
				...baseline().outcomeState,
				trials: { declaredMinimum: 3, completed: 2, invalidatedAttempts: [] },
			},
		}
		const resolution = resolveProductionVerdict(productionOf(body))
		expect(resolution).toEqual({
			verdict: 'CONCERNS',
			exitCode: 0,
			strictPromotable: false,
			basis: ['2 completed trials below the declared minimum of 3'],
		})
	})

	it('marks a CONCERNS whose only firing condition is an unreached oracle as not strict-promotable', () => {
		const body = {
			...baseline(),
			outcomeState: {
				...baseline().outcomeState,
				outcomes: [
					{
						...neutralOutcome(),
						resolution: {
							...neutralResolution(),
							rule: 'steps-unreached' as const,
							corroborationRule: 'never-ran' as const,
							state: 'unreached' as const,
						},
					},
				],
			},
		}
		const resolution = resolveProductionVerdict(productionOf(body))
		expect(resolution.verdict).toBe('CONCERNS')
		expect(resolution.strictPromotable).toBe(false)
	})

	// A CONCERNS mixing an evidence condition with a non-evidence condition IS
	// strict-promotable: the "only" in AD-21's carve-out is load-bearing.
	it('marks a mixed CONCERNS strict-promotable when a non-evidence condition also fired', () => {
		const body = {
			...baseline(),
			outcomeState: {
				...baseline().outcomeState,
				trials: { declaredMinimum: 3, completed: 2, invalidatedAttempts: [] },
			},
			coverageGaps: [
				{
					rule: 'sibling-cross-check',
					relevancePredicate: 'p',
					satisfactionPredicate: 's',
					satisfied: false,
					severity: 'material' as const,
				},
			],
		}
		const resolution = resolveProductionVerdict(productionOf(body))
		expect(resolution.verdict).toBe('CONCERNS')
		expect(resolution.strictPromotable).toBe(true)
	})

	// Contract-scoring recommendation: the recommendation never selects the rung.
	it('never lets an ingested evaluator recommendation select the contract-scoring rung', () => {
		const clean = contractOf({ ...baseline(), evaluatorRecommendation: 'FAIL' })
		expect(resolveContractVerdict(clean).verdict).toBe('PASS')

		const concerning = contractOf({
			...baseline(),
			evaluatorRecommendation: 'CONCERNS',
		})
		expect(resolveContractVerdict(concerning).verdict).toBe('PASS')
	})

	// The same recommendation DOES select production's rung, by contrast.
	it('lets an ingested evaluator recommendation select the production rung', () => {
		const failing = productionOf({
			...baseline(),
			evaluatorRecommendation: 'FAIL',
		})
		expect(resolveProductionVerdict(failing).verdict).toBe('FAIL')

		const concerning = productionOf({
			...baseline(),
			evaluatorRecommendation: 'CONCERNS',
		})
		expect(resolveProductionVerdict(concerning).verdict).toBe('CONCERNS')
	})

	it('is total, first-match-wins, with PASS an explicit rung rather than a fallback', () => {
		// Every fixture case resolves to a defined `LadderResolution`; none
		// throws, and every basis entry is non-empty (evidence-artifact.ts's own
		// `verdictBasis` shape).
		for (const fixtureCase of fixtureCases()) {
			const resolution =
				fixtureCase.ladder === 'production'
					? resolveProductionVerdict(fixtureCase.assessment)
					: resolveContractVerdict(fixtureCase.assessment)
			expect(['PASS', 'WAIVED', 'CONCERNS', 'FAIL', null]).toContain(
				resolution.verdict,
			)
			for (const entry of resolution.basis)
				expect(entry.length).toBeGreaterThan(0)
		}
	})

	// Precedence: Invalid beats every other rung, even when a FAIL/CONCERNS/
	// WAIVED condition is present in the same tuple.
	it('lets Invalid win over a co-occurring FAIL condition', () => {
		const body = {
			...baseline(),
			preflightPassed: false,
			evaluatorRecommendation: 'FAIL' as const,
		}
		const resolution = resolveProductionVerdict(productionOf(body))
		expect(resolution.verdict).toBeNull()
		expect(resolution.exitCode).toBe(3)
	})

	it('carries a literal mode discriminant on each assessment type', () => {
		const production = productionOf(baseline())
		const contract = contractOf(baseline())
		expect(production.mode).toBe('production')
		expect(contract.mode).toBe('contract-scoring')
	})

	// Boundary values: each row uses a strict `>`/`<` comparison, never
	// `>=`/`<=`, so the exact boundary itself must not fire.
	it('does not fire the re-execution-cap-breach row exactly at the cap', () => {
		const body = {
			...baseline(),
			outcomeState: {
				...baseline().outcomeState,
				trials: {
					declaredMinimum: 3,
					completed: 3,
					invalidatedAttempts: [
						{ attempt: 1, reason: 'port fault' },
						{ attempt: 2, reason: 'timeout' },
					],
				},
				reExecutionCap: 2,
			},
		}
		expect(resolveProductionVerdict(productionOf(body))).toEqual({
			verdict: 'PASS',
			exitCode: 0,
			strictPromotable: true,
			basis: [],
		})
	})

	it('does not fire the below-minimum-trial-count row exactly at the minimum', () => {
		const body = {
			...baseline(),
			outcomeState: {
				...baseline().outcomeState,
				trials: { declaredMinimum: 3, completed: 3, invalidatedAttempts: [] },
			},
		}
		expect(resolveProductionVerdict(productionOf(body))).toEqual({
			verdict: 'PASS',
			exitCode: 0,
			strictPromotable: true,
			basis: [],
		})
	})

	it('does not fire the finding-confidence-below-threshold row exactly at the threshold', () => {
		const body = {
			...baseline(),
			findings: [{ findingId: 'finding-1', confidence: 0.5 }],
			confidenceThreshold: 0.5,
		}
		expect(resolveProductionVerdict(productionOf(body))).toEqual({
			verdict: 'PASS',
			exitCode: 0,
			strictPromotable: true,
			basis: [],
		})
	})

	// `atOrAboveFloor` is inclusive: a severity exactly equal to the floor
	// counts as at-or-above, so a behavioural failure there is FAIL, not
	// CONCERNS.
	it('treats a severity exactly equal to the floor as at-or-above it (FAIL, not CONCERNS)', () => {
		const body = {
			...baseline(),
			severityFloor: 'material' as const,
			outcomeState: {
				...baseline().outcomeState,
				outcomes: [
					{
						...neutralOutcome(),
						severity: 'material' as const,
						resolution: { ...neutralResolution(), state: 'missed' as const },
					},
				],
			},
		}
		const resolution = resolveProductionVerdict(productionOf(body))
		expect(resolution.verdict).toBe('FAIL')
		expect(resolution.exitCode).toBe(2)
	})
})

describe('the two ordered rule tables', () => {
	it('carries Invalid identically between the two ladders', () => {
		const invalidIds = (ladder: typeof PRODUCTION_LADDER) =>
			ladder.filter((row) => row.rung === 'invalid').map((row) => row.id)
		expect(invalidIds(PRODUCTION_LADDER)).toEqual(invalidIds(CONTRACT_LADDER))
	})

	it('drops every clause that reads evaluatorRecommendation from the contract-scoring ladder', () => {
		expect(
			CONTRACT_LADDER.some((row) =>
				row.id.startsWith('evaluator-recommendation'),
			),
		).toBe(false)
		expect(
			PRODUCTION_LADDER.filter((row) =>
				row.id.startsWith('evaluator-recommendation'),
			),
		).toHaveLength(2)
	})
})

describe('ladderDecisionTable', () => {
	it('builds a document over the fixture set with no empty census cell', () => {
		const document = ladderDecisionTable(fixtureCases())
		expect(document).toContain('# AD-21 verdict decision')
		expect(document).toContain('## Production ladder')
		expect(document).toContain('## Contract-scoring ladder')
	})

	it('throws when handed no cases', () => {
		expect(() => ladderDecisionTable([])).toThrow(/no resolved cases/)
	})

	it('throws when one ladder has no cases at all', () => {
		const productionOnly = fixtureCases().filter(
			(entry) => entry.ladder === 'production',
		)
		expect(() => ladderDecisionTable(productionOnly)).toThrow(
			/no resolved cases for the contract-scoring ladder/,
		)
	})

	it('throws when a condition reaches no case, distinct from an empty rung', () => {
		// Drop only the unwitnessed-quotation case: the `invalid` rung still has
		// plenty of cases from every other Invalid-tier row, so this exercises
		// the per-condition census rather than the per-rung one.
		const narrowed = fixtureCases().filter((entry) => {
			const resolved =
				entry.ladder === 'production'
					? resolveProductionVerdict(entry.assessment)
					: resolveContractVerdict(entry.assessment)
			return !resolved.basis.some((reason) =>
				reason.includes('unwitnessed quotation'),
			)
		})
		expect(() => ladderDecisionTable(narrowed)).toThrow(
			/no production case reaches the condition unwitnessed-quotation/,
		)
	})
})

// `ladder.ts`'s own header comment says its exit codes and `strictPromotable`
// are "restated... to agree with rather than re-derive" `cli/exit-codes.ts`.
// `core/` cannot import `cli/` (AD-1) to prove that itself, so the agreement
// is proved from `tests/`, which can import both.
describe('LADDER_EXIT_CODES and strictPromotable agree with src/cli/exit-codes.ts', () => {
	it('restates the same five exit codes', () => {
		expect(LADDER_EXIT_CODES.invalid).toBe(EXIT_INVALID)
		expect(LADDER_EXIT_CODES.FAIL).toBe(EXIT_FAIL)
		expect(LADDER_EXIT_CODES.CONCERNS).toBe(EXIT_OK)
		expect(LADDER_EXIT_CODES.WAIVED).toBe(EXIT_OK)
		expect(LADDER_EXIT_CODES.PASS).toBe(EXIT_OK)
	})

	// For every CONCERNS-tier fixture case, `--strict` promotion driven by
	// `evidenceConditionsOnly: !strictPromotable` must land exactly where
	// `strictPromotable` itself says: promoted when true, held at zero when
	// false. Proves the restated rule agrees end to end, not only in prose.
	it('drives exitCodeFor to agree with strictPromotable on every CONCERNS fixture case', () => {
		let concernsCases = 0
		for (const fixtureCase of fixtureCases()) {
			const resolution =
				fixtureCase.ladder === 'production'
					? resolveProductionVerdict(fixtureCase.assessment)
					: resolveContractVerdict(fixtureCase.assessment)
			if (resolution.verdict !== 'CONCERNS') continue
			concernsCases++
			const exitCode = exitCodeFor(
				{
					kind: 'verdict',
					verdict: 'CONCERNS',
					evidenceConditionsOnly: !resolution.strictPromotable,
				},
				{ strict: true },
			)
			expect(exitCode, JSON.stringify(resolution.basis)).toBe(
				resolution.strictPromotable ? EXIT_CONCERNS_PROMOTED : EXIT_OK,
			)
		}
		// A tautology if the fixture set ever stopped producing a CONCERNS case.
		expect(concernsCases).toBeGreaterThan(0)
	})
})
