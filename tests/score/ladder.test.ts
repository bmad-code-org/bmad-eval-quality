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

	// Story 8.2's eight previously-rungless conditions, each newly given a
	// rung, plus the two conditions score.ts computes itself. One case per
	// new row, each asserting Invalid and the row's own basis wording.
	it('resolves a duplicate-record-identifier condition to Invalid and names it', () => {
		const body = {
			...baseline(),
			evidenceIntegrity: {
				...baseline().evidenceIntegrity,
				duplicateRecordIdentifiers: [
					{
						kind: 'duplicate-record-identifier' as const,
						subject: 'observation' as const,
						identifier: 'obs-1',
						occurrences: 2,
					},
				],
			},
		}
		const resolution = resolveProductionVerdict(productionOf(body))
		expect(resolution.verdict).toBeNull()
		expect(
			resolution.basis.some(
				(entry) => entry.includes('obs-1') && entry.includes('duplicate'),
			),
		).toBe(true)
	})

	it('resolves a dangling-citation condition to Invalid and names the finding', () => {
		const body = {
			...baseline(),
			evidenceIntegrity: {
				...baseline().evidenceIntegrity,
				danglingCitations: [
					{
						kind: 'dangling-citation' as const,
						findingId: 'finding-2',
						unresolvedObservationIds: ['obs-missing'],
					},
				],
			},
		}
		const resolution = resolveContractVerdict(contractOf(body))
		expect(resolution.verdict).toBeNull()
		expect(
			resolution.basis.some(
				(entry) => entry.includes('finding-2') && entry.includes('obs-missing'),
			),
		).toBe(true)
	})

	it('resolves a dangling-disposition-citation condition to Invalid and names the oracle', () => {
		const body = {
			...baseline(),
			evidenceIntegrity: {
				...baseline().evidenceIntegrity,
				danglingDispositionCitations: [
					{
						kind: 'dangling-disposition-citation' as const,
						oracleId: 'oracle-9',
						unresolvedObservationIds: ['obs-missing'],
					},
				],
			},
		}
		const resolution = resolveProductionVerdict(productionOf(body))
		expect(resolution.verdict).toBeNull()
		expect(resolution.basis.some((entry) => entry.includes('oracle-9'))).toBe(
			true,
		)
	})

	it('resolves a forbidden-input-not-withheld condition to Invalid, one basis line per input', () => {
		const body = {
			...baseline(),
			evidenceIntegrity: {
				...baseline().evidenceIntegrity,
				forbiddenInputsNotWithheld: [
					{
						kind: 'forbidden-input-not-withheld' as const,
						inputs: ['source-code' as const, 'human-labels' as const],
					},
				],
			},
		}
		const resolution = resolveContractVerdict(contractOf(body))
		expect(resolution.verdict).toBeNull()
		expect(
			resolution.basis.filter((entry) => entry.includes('forbidden input')),
		).toHaveLength(2)
	})

	it('resolves a cross-artifact-disagreement condition to Invalid and names both values', () => {
		const body = {
			...baseline(),
			evidenceIntegrity: {
				...baseline().evidenceIntegrity,
				crossArtifactDisagreements: [
					{
						kind: 'cross-artifact-disagreement' as const,
						field: 'runId' as const,
						recordValue: 'run-a',
						manifestValue: 'run-b',
					},
				],
			},
		}
		const resolution = resolveProductionVerdict(productionOf(body))
		expect(resolution.verdict).toBeNull()
		expect(
			resolution.basis.some(
				(entry) => entry.includes('run-a') && entry.includes('run-b'),
			),
		).toBe(true)
	})

	it('resolves an evaluator-configuration-absent condition to Invalid', () => {
		const body = {
			...baseline(),
			evidenceIntegrity: {
				...baseline().evidenceIntegrity,
				evaluatorConfigurationAbsent: [
					{ kind: 'evaluator-configuration-absent' as const },
				],
			},
		}
		const resolution = resolveContractVerdict(contractOf(body))
		expect(resolution.verdict).toBeNull()
		expect(
			resolution.basis.some((entry) => entry.includes('configuration absent')),
		).toBe(true)
	})

	it('resolves an evaluator-configuration-digest-mismatch condition to Invalid and names both digests', () => {
		const body = {
			...baseline(),
			evidenceIntegrity: {
				...baseline().evidenceIntegrity,
				evaluatorConfigurationDigestMismatches: [
					{
						kind: 'evaluator-configuration-digest-mismatch' as const,
						declaredDigest: 'sha256:declared',
						computedDigest: 'sha256:computed',
					},
				],
			},
		}
		const resolution = resolveProductionVerdict(productionOf(body))
		expect(resolution.verdict).toBeNull()
		expect(
			resolution.basis.some(
				(entry) =>
					entry.includes('sha256:declared') &&
					entry.includes('sha256:computed'),
			),
		).toBe(true)
	})

	it('resolves a judge-result-unscored condition to Invalid and names the criterion', () => {
		const body = {
			...baseline(),
			evidenceIntegrity: {
				...baseline().evidenceIntegrity,
				judgeResultsUnscored: [
					{
						kind: 'judge-result-unscored' as const,
						rubricId: 'R-002',
						criterionId: 'RC-009',
					},
				],
			},
		}
		const resolution = resolveContractVerdict(contractOf(body))
		expect(resolution.verdict).toBeNull()
		expect(
			resolution.basis.some(
				(entry) => entry.includes('R-002') && entry.includes('RC-009'),
			),
		).toBe(true)
	})

	it('resolves an operation-identifier-collision condition to Invalid', () => {
		const body = {
			...baseline(),
			evidenceIntegrity: {
				...baseline().evidenceIntegrity,
				operationIdentifierCollisions: [
					'observation obs-1: operationId "op-1" matches two interfaces',
				],
			},
		}
		const resolution = resolveProductionVerdict(productionOf(body))
		expect(resolution.verdict).toBeNull()
		expect(
			resolution.basis.some((entry) =>
				entry.includes('operation identifier collision'),
			),
		).toBe(true)
	})

	it('resolves a trial-set-field-disagreement condition to Invalid', () => {
		const body = {
			...baseline(),
			evidenceIntegrity: {
				...baseline().evidenceIntegrity,
				trialSetDisagreements: [
					'mode: trial 1 = "production", trial 2 = "contract-scoring"',
				],
			},
		}
		const resolution = resolveContractVerdict(contractOf(body))
		expect(resolution.verdict).toBeNull()
		expect(
			resolution.basis.some((entry) =>
				entry.includes('trial-set field disagreement'),
			),
		).toBe(true)
	})

	// isolationViolation is now an array: two entries render two basis lines,
	// each still carrying the row's own "isolation manifest violation:"
	// prefix.
	it('renders one basis line per isolationViolation entry, in array order', () => {
		const body = {
			...baseline(),
			evidenceIntegrity: {
				...baseline().evidenceIntegrity,
				isolationViolation: ['first violation', 'second violation'],
			},
		}
		const resolution = resolveProductionVerdict(productionOf(body))
		expect(resolution.verdict).toBeNull()
		expect(resolution.basis).toEqual([
			'isolation manifest violation: first violation',
			'isolation manifest violation: second violation',
		])
	})

	// Owed item 5: an uncited defect finding resolves at least CONCERNS in
	// both ladders, verdictBasis names it, and it is strict-promotable (no
	// severity-floor gate, unlike the two rows above it).
	it('resolves an uncited defect finding to CONCERNS, strict-promotable, in both ladders', () => {
		const body = {
			...baseline(),
			uncitedDefectFindings: [
				{
					findingId: 'finding-7',
					observationIds: ['obs-1'],
					quotedEvidence: [
						{ quote: 'boom', channel: 'response-body' as const },
					],
					severity: 'low' as const,
				},
			],
		}
		for (const resolution of [
			resolveProductionVerdict(productionOf(body)),
			resolveContractVerdict(contractOf(body)),
		]) {
			expect(resolution.verdict).toBe('CONCERNS')
			expect(resolution.strictPromotable).toBe(true)
			expect(
				resolution.basis.some(
					(entry) =>
						entry.includes('finding-7') && entry.includes('citing no oracle'),
				),
			).toBe(true)
		}
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

	// For every CONCERNS-tier fixture case, `exitCodeFor`'s promotion, driven
	// directly off `strictPromotable`, must land exactly where
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
					exitCode: resolution.exitCode,
					strictPromotable: resolution.strictPromotable,
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
