// score.ts's own orchestration: one case per I/O Matrix row, built on
// `tests/score/fixtures/probe-witness.ts`'s operation inventory and probe
// (the one existing fixture module already shaped for an AD-40 witness
// scenario), plus `tests/ingest/ingest.test.ts`'s fixture-mutation idiom for
// triggering each of the new conditions directly on a hand-built
// `ValidatedObservations` trial -- `score.ts`'s own declared input shape,
// so there is no upstream `ingest()` call to route through.

import { describe, expect, it } from 'vitest'
import type { ValidatedObservations } from '../../src/core/ingest/ingest.ts'
import type { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import type { Expression } from '../../src/core/schemas/expression.ts'
import type { PreflightVerdict } from '../../src/core/schemas/preflight-verdict.ts'
import type { Probe } from '../../src/core/schemas/probe.ts'
import type { ScoringPolicy } from '../../src/core/schemas/scoring-policy.ts'
import type { Observation } from '../../src/core/schemas/sealed-run-record.ts'
import { score } from '../../src/core/score/score.ts'
import {
	canary,
	digestOf,
	notesInterface,
	observation,
	qualifiedProbe,
} from './fixtures/probe-witness.ts'

/**
 * The one oracle's check: the `create` step's response status is 200. Its
 * `expects-hold` polarity means "resolved `true`" is satisfaction.
 */
const oracleCheck: Expression = {
	op: 'equality',
	operands: [
		{ pointer: '/interactions/create/response-status' },
		{ literal: 200 },
	],
}

/**
 * A minimal but complete contract wired to `qualifiedProbe`'s own
 * `behaviorId` ("B-001") and defect signature (`POST /notes`, a
 * type-violating `title`, `response-status`), so the probe both qualifies
 * (AD-9) and resolves a single designated oracle (AD-40) against it.
 *
 * `behaviors[0].severity` is `'low'`, deliberately below `policy.severityFloor`
 * ("material") below: `coverageSeverity` stamps every AD-31 coverage gap
 * with the contract's own maximum behaviour severity, and this contract's
 * declarations are too sparse to satisfy several AD-31 rules (no declared
 * success indicator, no sibling groups, and so on). Below the floor, those
 * gaps still populate `coverageGaps` but never reach `coverage-gap-at-or-
 * above-floor`, which is what keeps the "clean trial set" case in the I/O
 * Matrix reaching an actually empty basis rather than one this contract's
 * own thin declarations would otherwise pollute for a reason unrelated to
 * what each case means to test.
 */
const baseContract: EvalContract = {
	schemaVersion: 3,
	parentDigest: null,
	revisionCount: 0,
	contractId: 'score-stage-contract',
	sourceSpecDigest: null,
	behaviors: [
		{
			id: 'B-001',
			description: 'Creating a note with a string title succeeds.',
			severity: 'low',
			observableSuccessCriterion: 'A 200 response to POST /notes.',
			requirementLinks: [],
			riskLinks: [],
			oracles: ['O-001'],
		},
	],
	oracles: [
		{
			id: 'O-001',
			direction: null,
			check: oracleCheck,
			polarity: 'expects-hold',
			commentary: null,
		},
	],
	rubrics: [],
	waivers: [],
	permittedInterfaces: [notesInterface],
	referenceSets: null,
	siblingGroups: null,
	interactionPlan: [
		{
			stepId: 'create',
			operationId: 'create-note',
			inputBinding: {
				path: null,
				query: null,
				header: null,
				body: { title: { matcher: 'any' } },
			},
			after: null,
			cardinality: 'exactly-one',
		},
	],
	scopedResources: null,
	forbiddenInputs: [],
	testData: { setup: null, cleanup: null, principals: null, resources: null },
	budgets: { maxToolCalls: 0, maxWallClockMinutes: 0, maxCostUsd: '0' },
	safetyLimits: [],
	requiredEvidence: [],
	probeStepBound: null,
	fixtureReset: null,
}

/** Matrix row 2/3: a rubric to score, so `judgeConduct` can become `'malformed'` rather than `'absent'`. */
const contractWithRubric: EvalContract = {
	...baseContract,
	rubrics: [
		{
			id: 'R-001',
			scaleLevels: [{ level: 1, anchor: 'meets the bar' }],
			failureModePenalties: [],
			maxLength: 100,
			criteria: [
				{
					id: 'RC-001',
					text: 'Did the create call succeed?',
					evidence: '/interactions/create/response-status',
				},
			],
		},
	],
}

/** Matrix row 5: a second interface declaring the same `operationId`. */
const twoInterfaceContract: EvalContract = {
	...baseContract,
	permittedInterfaces: [
		notesInterface,
		{ ...notesInterface, logicalId: 'notes-api-mirror' },
	],
}

/** A clean `create-note` call: a string title, a 200 response. Not a witness candidate for `qualifiedProbe`'s type-violating selector, so the designated oracle resolves `not-triggered` -> `confirmed`, never `caught`. */
const cleanObservation = (
	observationId: string,
	sequence: number,
): Observation =>
	observation({
		observationId,
		sequence,
		operationId: 'create-note',
		callInputs: {
			path: null,
			query: null,
			header: null,
			body: { title: 'ok' },
		},
		responseBody: { ok: true },
		responseStatus: 200,
	})

const cleanTrial = (
	overrides: Partial<ValidatedObservations> = {},
): ValidatedObservations => ({
	mode: 'production',
	evaluatorRecommendation: 'PASS',
	observations: [cleanObservation('obs-1', 1)],
	findings: [],
	dispositions: [
		{
			oracleId: 'O-001',
			disposition: 'held',
			observationIds: ['obs-1'],
			note: null,
		},
	],
	conditions: [],
	unwitnessedQuotations: [],
	isolationViolation: [],
	...overrides,
})

const policy: ScoringPolicy = {
	schemaVersion: 1,
	parentDigest: null,
	revisionCount: 0,
	policyId: 'policy-1',
	severityFloor: 'material',
	confidenceThreshold: 0.5,
	catchThreshold: 0.5,
	minimumTrialCount: 1,
	reExecutionCap: 2,
	remediationCap: 3,
	regexMatchStepBudget: 1_000_000,
}

const passingPreflight: PreflightVerdict = {
	schemaVersion: 1,
	parentDigest: null,
	revisionCount: 0,
	runId: 'run-1',
	fixtureDigest: digestOf(50),
	passed: true,
	checks: [],
}

const scoreOf = (
	contract: EvalContract,
	trials: readonly ValidatedObservations[],
	probe: Probe = qualifiedProbe,
	preflightVerdict: PreflightVerdict = passingPreflight,
	scoringPolicy: ScoringPolicy = policy,
) =>
	score(contract, trials, probe, preflightVerdict, scoringPolicy, 'none', false)

describe('score: the I/O & Edge-Case Matrix', () => {
	it('Matrix row 1: a clean trial set resolves PASS with an empty basis', () => {
		const result = scoreOf(baseContract, [cleanTrial(), cleanTrial()])
		expect(result.ladder).toEqual({
			verdict: 'PASS',
			exitCode: 0,
			strictPromotable: true,
			basis: [],
		})
		expect(result.assessment.mode).toBe('production')
	})

	// The trial set's own `mode` chooses `ContractAssessment` and
	// `resolveContractVerdict`, never `checkModeAgreement` (Decision 4): a
	// clean contract-scoring trial set still resolves PASS, and the
	// contract-only fields (`systemRecommendationRecorded`,
	// `systemRecommendationNote`) are stamped from the trial set and from
	// score's own declared-nowhere default respectively.
	it('a clean contract-scoring trial set resolves PASS via resolveContractVerdict, mode stamped through', () => {
		const result = scoreOf(baseContract, [
			cleanTrial({
				mode: 'contract-scoring',
				evaluatorRecommendation: 'CONCERNS',
			}),
		])
		expect(result.assessment.mode).toBe('contract-scoring')
		if (result.assessment.mode === 'contract-scoring') {
			expect(result.assessment.systemRecommendationRecorded).toBe('CONCERNS')
			expect(result.assessment.systemRecommendationNote).toBeNull()
		}
		expect(result.ladder).toEqual({
			verdict: 'PASS',
			exitCode: 0,
			strictPromotable: true,
			basis: [],
		})
	})

	// Matrix row 2. Empty rubrics keeps `judgeConduct` at `'absent'` even when
	// a trial carries a `judge-result-unscored` condition: if the precedence
	// were wrong and conduct fell through to `'malformed'`, every oracle
	// would resolve `judge-error` and `invalidating-state` would fire beside
	// the direct condition mapping. It does not.
	it("Matrix row 2: empty rubrics keep every oracle's judgeConduct absent, even with an unscored judge result present", () => {
		const result = scoreOf(baseContract, [
			cleanTrial({
				conditions: [
					{
						kind: 'judge-result-unscored',
						rubricId: 'R-001',
						criterionId: 'RC-001',
					},
				],
			}),
		])
		expect(result.ladder.verdict).toBeNull()
		expect(result.ladder.basis).toEqual([
			'judge result unscored: rubric R-001 criterion RC-001',
		])
		expect(
			result.ladder.basis.some((entry) => entry.includes('judge-error')),
		).toBe(false)
	})

	// Matrix row 3. A rubric-bearing contract with the same condition present
	// makes `judgeConduct` `'malformed'`, so the oracle itself resolves
	// `judge-error` (and `invalidating-state` names it) alongside the direct
	// `judge-result-unscored` row.
	it('Matrix row 3: a judge-result-unscored condition under a real rubric makes every oracle judge-error', () => {
		const result = scoreOf(contractWithRubric, [
			cleanTrial({
				conditions: [
					{
						kind: 'judge-result-unscored',
						rubricId: 'R-001',
						criterionId: 'RC-001',
					},
				],
			}),
		])
		expect(result.ladder.verdict).toBeNull()
		expect(result.ladder.basis).toEqual(
			expect.arrayContaining([
				'oracle O-001 resolved judge-error',
				'judge result unscored: rubric R-001 criterion RC-001',
			]),
		)
		for (const outcome of result.assessment.outcomeState.outcomes) {
			expect(outcome.resolution.state).toBe('judge-error')
		}
	})

	// Matrix row 4: one of the eight previously-rungless conditions, named
	// with a basis line.
	it('Matrix row 4: a previously-rungless condition (duplicate-record-identifier) fires its new Invalid row', () => {
		const result = scoreOf(baseContract, [
			cleanTrial({
				conditions: [
					{
						kind: 'duplicate-record-identifier',
						subject: 'observation',
						identifier: 'obs-1',
						occurrences: 2,
					},
				],
			}),
		])
		expect(result.ladder.verdict).toBeNull()
		expect(result.ladder.basis).toEqual([
			'duplicate observation identifier "obs-1" (2 occurrences)',
		])
	})

	// Matrix row 5: an observation's operationId resolving against two
	// permittedInterfaces entries.
	it('Matrix row 5: an operationId ambiguous across permittedInterfaces fires operation-identifier-collision', () => {
		const result = scoreOf(twoInterfaceContract, [cleanTrial()])
		expect(result.ladder.verdict).toBeNull()
		expect(result.ladder.basis).toHaveLength(1)
		expect(result.ladder.basis[0]).toContain('operation identifier collision')
		expect(result.ladder.basis[0]).toContain('create-note')
	})

	// Matrix row 6: a rejected probe never throws; probeQualified is false
	// and the existing invalidating-state row catches the resulting
	// infrastructure-error, exactly as the I/O Matrix corrects itself to say
	// in the round-1 re-verify.
	it('Matrix row 6: a probe qualification rejects gracefully, probeQualified false, no throw', () => {
		const qualification = qualifiedProbe.qualification as Extract<
			Probe['qualification'],
			{ route: 'controlled-mutation' }
		>
		const rejectedProbe: Probe = {
			...qualifiedProbe,
			qualification: { ...qualification, rollbackVerified: false },
		}
		let result: ReturnType<typeof scoreOf> | undefined
		expect(() => {
			result = scoreOf(baseContract, [cleanTrial()], rejectedProbe)
		}).not.toThrow()
		if (result === undefined) throw new Error('scoreOf produced no result')
		expect(result.ladder.verdict).toBeNull()
		expect(result.ladder.basis).toEqual([
			'oracle O-001 resolved infrastructure-error',
		])
	})

	// Matrix row 7: one basis line per offending isolationViolation entry, in
	// array order.
	it('Matrix row 7: two isolationViolation entries render one basis line apiece, in order', () => {
		const result = scoreOf(baseContract, [
			cleanTrial({
				isolationViolation: [
					'mount outside allowlist: /etc',
					'network target outside allowlist: evil.example',
				],
			}),
		])
		expect(result.ladder.verdict).toBeNull()
		expect(result.ladder.basis).toEqual([
			'isolation manifest violation: mount outside allowlist: /etc',
			'isolation manifest violation: network target outside allowlist: evil.example',
		])
	})

	// Matrix row 9 (via score.ts's own call into reduceTrialSet):
	// catchThreshold outside 0..1 is rejected before folding, thrown, not
	// absorbed. `tests/score/reduce-trials.test.ts` covers this
	// unit-directly; this is the same input reaching it through score.ts's
	// real caller.
	it('Matrix row 9: an out-of-range catchThreshold throws through score.ts, before any vote folds', () => {
		expect(() =>
			scoreOf(
				baseContract,
				[cleanTrial(), cleanTrial()],
				qualifiedProbe,
				passingPreflight,
				{
					...policy,
					catchThreshold: 1.5,
				},
			),
		).toThrow(/catchThreshold/)
	})

	// Matrix row 11: two trials disagreeing on `mode` fire
	// trial-set-field-disagreement, naming the field and both values, and the
	// run is not silently scored under one trial's picked value -- the basis
	// line is what makes the pick non-silent. (Row 8, a `TrialVote.state`
	// outside the closed twelve, and row 10, two `Outcome` entries sharing a
	// `probeId`, are not reachable through `score()` itself -- neither
	// value can originate from a real `resolveOutcome` call or from
	// `strength.ts`'s own dominance comparator, which `score.ts` never
	// calls. Both are covered directly: row 8 in
	// `tests/score/reduce-trials.test.ts`'s "out-of-domain vote state"
	// cases, row 10 in `tests/score/strength.test.ts`'s "reads the first
	// Outcome sharing a probeId" case.)
	it('Matrix row 11: trials disagreeing on mode fire trial-set-field-disagreement naming both values', () => {
		const result = scoreOf(baseContract, [
			cleanTrial({ mode: 'production' }),
			cleanTrial({ mode: 'contract-scoring' }),
		])
		expect(result.ladder.verdict).toBeNull()
		expect(result.ladder.basis).toEqual([
			'trial-set field disagreement: mode: trial 1 = "production", trial 2 = "contract-scoring"',
		])
		// The first trial's own mode still builds the one assessment a
		// discriminated union requires.
		expect(result.assessment.mode).toBe('production')
	})

	it('trials disagreeing on evaluatorRecommendation fire trial-set-field-disagreement naming both values', () => {
		const result = scoreOf(baseContract, [
			cleanTrial({ evaluatorRecommendation: 'PASS' }),
			cleanTrial({ evaluatorRecommendation: 'FAIL' }),
		])
		expect(result.ladder.verdict).toBeNull()
		expect(result.ladder.basis).toEqual([
			'trial-set field disagreement: evaluatorRecommendation: trial 1 = "PASS", trial 2 = "FAIL"',
		])
	})
})

// None of these rows is required by the frozen I/O Matrix, but each is
// behavior the code's own comments document as handled -- a patch-review
// finding asked for test proof of each.
describe('score: regressions and documented fallbacks beyond the frozen I/O Matrix', () => {
	// The scenario `designatedOracleIdOf`'s own doc comment gives as the
	// reason it anchors on `probe.behaviorId` rather than the worked
	// example's `defects[0]?.behaviorId`: a canary carries `defects: []`, so
	// the latter would be `undefined`, while `probe.behaviorId` still
	// resolves. The canary probe carries no signature, so it gets no witness;
	// `canary-undetected` (probeClass `'canary'`, some selection resolved,
	// no defect finding cites the oracle) fires, landing on
	// `infrastructure-error`, an AD-6 invalidating state the existing
	// `invalidating-state` row already catches -- a legitimate resolution,
	// not a crash.
	it('a canary probe (no seeded defect) resolves without throwing, via probe.behaviorId', () => {
		const result = scoreOf(baseContract, [cleanTrial()], canary)
		expect(result.ladder.verdict).toBeNull()
		expect(result.ladder.basis).toEqual([
			'oracle O-001 resolved infrastructure-error',
		])
	})

	// An oracle whose `check` is `null` (AD-19 admits it; only a strict
	// compile rejects it, and score never re-validates a contract it is
	// handed). `checkResolution` stays `null` throughout, so the oracle's
	// check never resolves, which the existing `required-check-unresolved`
	// row reports -- not a crash.
	it('an oracle with a null check resolves without throwing', () => {
		const contractWithNullCheck: EvalContract = {
			...baseContract,
			oracles: [
				{
					id: 'O-001',
					direction: null,
					check: null,
					polarity: 'expects-hold',
					commentary: null,
				},
			],
		}
		const result = scoreOf(contractWithNullCheck, [cleanTrial()])
		expect(result.ladder.verdict).toBeNull()
		expect(result.ladder.basis).toEqual([
			'oracle O-001 is required and its check never resolved',
		])
	})

	// `contract.oracles` declared empty: the per-trial loop's oracle loop
	// never runs, so neither trial contributes a vote, and `Trials.completed`
	// reads `0` even though two trials were presented -- the same
	// below-minimum-trial-count CONCERNS a genuinely empty trial set produces
	// below, and not a crash.
	it('an empty contract.oracles list contributes no vote per trial, no throw', () => {
		const contractWithNoOracles: EvalContract = { ...baseContract, oracles: [] }
		const result = scoreOf(contractWithNoOracles, [cleanTrial(), cleanTrial()])
		expect(result.assessment.outcomeState.outcomes).toEqual([])
		expect(result.assessment.outcomeState.trials.completed).toBe(0)
		expect(result.ladder.verdict).toBe('CONCERNS')
	})

	// Decision 8's fallback: a caller supplying zero trials has no first
	// trial to read `mode`/`evaluatorRecommendation` off, so both fall back
	// to a neutral default rather than throwing, and `below-minimum-trial-
	// count` reports the zero completed trials.
	it('an empty trial set falls back to neutral mode and evaluatorRecommendation defaults, no throw', () => {
		const result = scoreOf(baseContract, [])
		expect(result.assessment.mode).toBe('production')
		expect(result.assessment.evaluatorRecommendation).toBe('PASS')
		expect(result.assessment.outcomeState.trials.completed).toBe(0)
		expect(result.ladder.verdict).toBe('CONCERNS')
	})

	// `designatedOracleIdOf` returns `null`, never throws, when the probe's
	// own behaviour resolves to no oracle or to more than one. With no
	// designated oracle, no oracle gets a witness attached, so the sole
	// oracle here resolves through the witness-free `outcome-clear` path
	// instead -- still a clean PASS, just not through AD-40's designated-
	// oracle machinery.
	it('a behaviour naming zero oracles makes designatedOracleId null, no throw', () => {
		const contractZeroOraclesForBehavior: EvalContract = {
			...baseContract,
			behaviors: baseContract.behaviors.map((behavior) => ({
				...behavior,
				oracles: [],
			})),
		}
		const result = scoreOf(contractZeroOraclesForBehavior, [cleanTrial()])
		expect(result.ladder).toEqual({
			verdict: 'PASS',
			exitCode: 0,
			strictPromotable: true,
			basis: [],
		})
	})

	it('a behaviour naming two-or-more oracles makes designatedOracleId null, no throw', () => {
		const contractTwoOraclesForBehavior: EvalContract = {
			...baseContract,
			behaviors: baseContract.behaviors.map((behavior) => ({
				...behavior,
				oracles: ['O-001', 'O-002'],
			})),
		}
		const result = scoreOf(contractTwoOraclesForBehavior, [cleanTrial()])
		expect(result.ladder).toEqual({
			verdict: 'PASS',
			exitCode: 0,
			strictPromotable: true,
			basis: [],
		})
	})

	// The regression this patch closes: `remediationState` used to come from
	// `validateLineageChain([contract], {...})`, which only self-validated a
	// contract pinned at `revisionCount: 0`. An ordinarily-revised contract
	// -- `revisionCount: 1` with a real `parentDigest` -- used to fire
	// `lineage-chain-inconsistent` unconditionally. `remediationState` is now
	// declared, not derived, so this resolves clean.
	it('does not fire lineage-chain-inconsistent for an ordinarily revised contract (revisionCount > 0)', () => {
		const revisedContract: EvalContract = {
			...baseContract,
			revisionCount: 1,
			parentDigest: digestOf(99),
		}
		const result = scoreOf(revisedContract, [cleanTrial(), cleanTrial()])
		expect(result.ladder).toEqual({
			verdict: 'PASS',
			exitCode: 0,
			strictPromotable: true,
			basis: [],
		})
	})
})

describe('score: STAGE_SIGNATURES conformance', () => {
	it('the five declared inputs stay byte-identical and module names the new file', async () => {
		const { STAGE_SIGNATURES } = await import(
			'../../src/core/lineage/stage-table.ts'
		)
		expect(STAGE_SIGNATURES.score.module).toBe('src/core/score/score.ts')
		expect(STAGE_SIGNATURES.score.inputs).toEqual([
			'eval-contract',
			'validated-observations',
			'probe',
			'preflight-verdict',
			'scoring-policy',
		])
	})
})
