// emit.ts's own orchestration: one case per I/O Matrix row (row 7, the
// private-artifact digest comparator, is covered by the sibling
// `private-artifact-digest.test.ts` -- it names a different module), plus a
// production-mode and a contract-scoring-mode shape check. Built on
// `tests/schemas/fixtures/artifact-fixtures.ts`'s `digestOf` and
// `tests/score/fixtures/probe-witness.ts`'s `qualifiedProbe`, plus a
// hand-built `ScoredOutcomesAndVerdict` fixture: `emit.ts`'s own declared
// input, so there is no upstream `score()` call to route through.

import { describe, expect, it } from 'vitest'
import { digestArtifact } from '../../src/core/canonical/digest.ts'
import { emit } from '../../src/core/emit/emit.ts'
import type { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import {
	type CoverageGap,
	EvidenceArtifact,
	type Outcome,
	type UncitedFindingGap,
} from '../../src/core/schemas/evidence-artifact.ts'
import type { ScoringPolicy } from '../../src/core/schemas/scoring-policy.ts'
import type {
	ContractAssessment,
	EvidenceIntegrityInputs,
	LadderResolution,
	OutcomeStateInputs,
	ProductionAssessment,
	ScoredOutcome,
} from '../../src/core/score/ladder.ts'
import type {
	QualifiedProbe,
	SealedProbeSet,
} from '../../src/core/score/qualification.ts'
import type { TrialSetResult } from '../../src/core/score/reduce-trials.ts'
import type { ScoredOutcomesAndVerdict } from '../../src/core/score/score.ts'
import type { SignedProbe } from '../../src/core/score/witness.ts'
import { digestOf } from '../schemas/fixtures/artifact-fixtures.ts'
import { qualifiedProbe } from '../score/fixtures/probe-witness.ts'

// `qualifiedProbe`'s own `probeId` ("PX-001") is not schema-valid `ProbeId`
// shape (`^P-[0-9]{3,}$`); no existing suite parses it through Zod, so the
// mismatch is latent there. This module does parse through `EvidenceArtifact`
// (the I/O Matrix's own "artifact parses" clause), so a locally
// schema-valid override stands in rather than widening that shared fixture.
const probe: SignedProbe = { ...qualifiedProbe, probeId: 'P-001' }

const minimalContract: EvalContract = {
	schemaVersion: 3,
	parentDigest: null,
	revisionCount: 0,
	contractId: 'emit-stage-contract',
	sourceSpecDigest: null,
	behaviors: [
		{
			id: 'B-001',
			description: 'A behaviour.',
			severity: 'material',
			observableSuccessCriterion: null,
			requirementLinks: [],
			riskLinks: [],
			oracles: [],
		},
	],
	oracles: [],
	rubrics: [],
	waivers: [],
	permittedInterfaces: [],
	referenceSets: null,
	siblingGroups: null,
	interactionPlan: [],
	scopedResources: null,
	forbiddenInputs: [],
	testData: { setup: null, cleanup: null, principals: null, resources: null },
	budgets: { maxToolCalls: 0, maxWallClockMinutes: 0, maxCostUsd: '0' },
	safetyLimits: [],
	requiredEvidence: [],
	probeStepBound: null,
	fixtureReset: null,
}

const policy: ScoringPolicy = {
	schemaVersion: 2,
	parentDigest: null,
	revisionCount: 0,
	policyId: 'emit-stage-policy',
	severityFloor: 'material',
	confidenceThreshold: 0.5,
	catchThreshold: 0.5,
	minimumTrialCount: 3,
	reExecutionCap: 2,
	remediationCap: 3,
	regexMatchStepBudget: 1_000_000,
}

const qualifiedProbeEntry: QualifiedProbe = {
	probe,
	result: { qualified: true, failures: [], declarationChecksRan: true },
}

const rejectedProbeEntry: QualifiedProbe = {
	probe,
	result: {
		qualified: false,
		failures: [
			{
				code: 'signature-absent',
				artifactPath: `Probe[probeId=${probe.probeId}].defectSignature`,
				detail: 'no signature declared',
			},
		],
		declarationChecksRan: true,
	},
}

const sealedProbesQualified: SealedProbeSet = {
	admitted: [qualifiedProbeEntry],
	rejected: [],
}

const sealedProbesRejected: SealedProbeSet = {
	admitted: [],
	rejected: [rejectedProbeEntry],
}

const cleanTrialSetResult: TrialSetResult = {
	exercised: true,
	caught: true,
	validCount: 3,
	caughtCount: 2,
	invalidatedAttempts: [],
}

const baseOutcome: Outcome = {
	oracleId: 'O-001',
	probeId: probe.probeId,
	state: 'caught',
	severity: 'critical',
	disposition: 'violated',
	resolvedFrom: 'F-001',
	corroboration: 'agrees',
	selectedObservationIds: ['obs-1'],
	checkResolution: null,
}

const scoredOutcome: ScoredOutcome = {
	oracleId: 'O-001',
	required: true,
	severity: 'critical',
	checkResolved: true,
	resolution: {
		rule: 'oracle-cited-defect',
		waiverRule: null,
		corroborationRule: 'check-confirms-finding',
		state: 'caught',
		corroboration: 'agrees',
		resolvedFrom: 'F-001',
		selectedObservationIds: ['obs-1'],
		declinedFindingIds: [],
		invalidatingConditions: [],
	},
}

const cleanEvidenceIntegrity: EvidenceIntegrityInputs = {
	disclosure: { truncationBound: null, reportedIncomplete: false },
	overTruncated: false,
	unavailable: false,
	internallyInconsistent: false,
	isolationViolation: [],
	duplicateRecordIdentifiers: [],
	danglingCitations: [],
	danglingDispositionCitations: [],
	forbiddenInputsNotWithheld: [],
	crossArtifactDisagreements: [],
	evaluatorConfigurationAbsent: [],
	evaluatorConfigurationDigestMismatches: [],
	judgeResultsUnscored: [],
	operationIdentifierCollisions: [],
	trialSetDisagreements: [],
}

const cleanOutcomeState = (
	overrides: Partial<OutcomeStateInputs> = {},
): OutcomeStateInputs => ({
	outcomes: [scoredOutcome],
	unwitnessedQuotations: [],
	trials: { declaredMinimum: 3, completed: 3, invalidatedAttempts: [] },
	reExecutionCap: 2,
	...overrides,
})

const productionAssessment = (
	overrides: Partial<ProductionAssessment> = {},
): ProductionAssessment => ({
	mode: 'production',
	outcomeState: cleanOutcomeState(),
	evidenceIntegrity: cleanEvidenceIntegrity,
	evaluatorRecommendation: 'PASS',
	coverageGaps: [],
	uncitedDefectFindings: [],
	findings: [],
	confidenceThreshold: 0.5,
	remediationState: {
		lengthConsistent: true,
		noRepeatedDigest: true,
		noGap: true,
	},
	preflightPassed: true,
	severityFloor: 'material',
	...overrides,
})

const contractAssessment = (
	overrides: Partial<ContractAssessment> = {},
): ContractAssessment => ({
	mode: 'contract-scoring',
	outcomeState: cleanOutcomeState(),
	evidenceIntegrity: cleanEvidenceIntegrity,
	evaluatorRecommendation: 'PASS',
	coverageGaps: [],
	uncitedDefectFindings: [],
	findings: [],
	confidenceThreshold: 0.5,
	remediationState: {
		lengthConsistent: true,
		noRepeatedDigest: true,
		noGap: true,
	},
	preflightPassed: true,
	severityFloor: 'material',
	systemRecommendationRecorded: 'PASS',
	systemRecommendationNote: null,
	...overrides,
})

const passLadder: LadderResolution = {
	verdict: 'PASS',
	exitCode: 0,
	strictPromotable: true,
	basis: [],
}

const scoredOf = (
	overrides: Partial<ScoredOutcomesAndVerdict> = {},
): ScoredOutcomesAndVerdict => ({
	assessment: contractAssessment(),
	ladder: passLadder,
	runId: 'run-1',
	contract: minimalContract,
	policy,
	probe,
	sealedProbes: sealedProbesQualified,
	trialSetResult: cleanTrialSetResult,
	outcomes: [baseOutcome],
	uncitedFindings: [],
	...overrides,
})

const emitOf = (overrides: Partial<ScoredOutcomesAndVerdict> = {}) =>
	emit(scoredOf(overrides), digestOf(200), digestOf(201), digestOf(202))

describe('emit: the I/O & Edge-Case Matrix', () => {
	it('Matrix row 1: a clean production run parses, mode production, productionVerdict set, no contractVerdict key', () => {
		const result = emitOf({ assessment: productionAssessment() })
		const parsed = EvidenceArtifact.parse(result)
		expect(parsed.mode).toBe('production')
		expect(result).not.toHaveProperty('contractVerdict')
		if (parsed.mode === 'production') {
			expect(parsed.productionVerdict).toBe('PASS')
		}
	})

	it('Matrix row 2: an uncited defect finding carries into uncitedFindingGaps, systemRecommendationRecorded/Note set from the assessment', () => {
		const uncitedGap: UncitedFindingGap = {
			findingId: 'F-999',
			observationIds: ['obs-1'],
			quotedEvidence: [{ quote: 'evidence', channel: 'response-status' }],
			severity: 'material',
		}
		const result = emitOf({
			assessment: contractAssessment({
				uncitedDefectFindings: [uncitedGap],
				systemRecommendationRecorded: 'CONCERNS',
				systemRecommendationNote: 'a note',
			}),
		})
		expect(result.mode).toBe('contract-scoring')
		if (result.mode === 'contract-scoring') {
			expect(result.uncitedFindingGaps).toEqual([uncitedGap])
			expect(result.systemRecommendationRecorded).toBe('CONCERNS')
			expect(result.systemRecommendationNote).toBe('a note')
		}
	})

	it('Matrix row 3: excludedProbeIds is empty when the scored probe itself qualified', () => {
		const result = emitOf({ sealedProbes: sealedProbesQualified })
		expect(result.excludedProbeIds).toEqual([])
	})

	it('Matrix row 3: excludedProbeIds carries one entry when the scored probe did not qualify', () => {
		const result = emitOf({ sealedProbes: sealedProbesRejected })
		expect(result.excludedProbeIds).toEqual([probe.probeId])
	})

	it('Matrix row 3: comparabilityKey and strength.vector are still computed over zero admitted probes', () => {
		const result = emitOf({ sealedProbes: sealedProbesRejected })
		expect(result.comparabilityKey).toBe(
			digestArtifact(
				{
					scoringPolicyDigest: digestArtifact(policy, 'ScoringPolicy'),
					probeIds: [],
				},
				'ComparabilityKey',
			),
		)
		expect(result.strength.vector).toEqual({
			defect: null,
			gameability: null,
			'zero-action': null,
		})
	})

	it('carries non-empty uncitedFindings and coverageGaps through unchanged', () => {
		const coverageGap: CoverageGap = {
			rule: 'a-coverage-rule',
			relevancePredicate: 'applies',
			satisfactionPredicate: 'satisfied',
			satisfied: false,
			severity: 'material',
		}
		const result = emitOf({
			uncitedFindings: ['F-777'],
			assessment: contractAssessment({ coverageGaps: [coverageGap] }),
		})
		expect(result.uncitedFindings).toEqual(['F-777'])
		expect(result.coverageGaps).toEqual([coverageGap])
	})

	it("Matrix row 4: an outcome carrying disposition 'not-attempted' (score.ts's ambiguity-guard default) passes through unchanged", () => {
		const notAttemptedOutcome: Outcome = {
			...baseOutcome,
			disposition: 'not-attempted',
		}
		const result = emitOf({ outcomes: [notAttemptedOutcome] })
		expect(result.outcomes).toEqual([notAttemptedOutcome])
	})

	it('Matrix row 5: an unreached outcome marks strength.comparable false, the vector still reported', () => {
		const unreached: ScoredOutcome = {
			...scoredOutcome,
			resolution: {
				...scoredOutcome.resolution,
				rule: 'steps-unreached',
				state: 'unreached',
			},
		}
		const result = emitOf({
			assessment: contractAssessment({
				outcomeState: cleanOutcomeState({ outcomes: [unreached] }),
			}),
		})
		expect(result.strength.comparable).toBe(false)
		expect(result.strength.vector.defect).not.toBeNull()
	})

	it('Matrix row 6: completed trials below the declared minimum marks strength.comparable false', () => {
		const result = emitOf({
			assessment: contractAssessment({
				outcomeState: cleanOutcomeState({
					trials: { declaredMinimum: 3, completed: 1, invalidatedAttempts: [] },
				}),
			}),
		})
		expect(result.strength.comparable).toBe(false)
	})

	// Row 7 (a PrivateArtifactManifest entry digest disagreeing with its
	// resolved bytes) names `private-artifact-digest.ts`, a different module
	// with no caller in this story; its match/mismatch cases live in
	// `tests/emit/private-artifact-digest.test.ts`.

	it('Matrix row 8: assessment.mode read inconsistently between the branch decision and the mode-agreement check throws TypeError (a type-system bypass only)', () => {
		const real = productionAssessment()
		let reads = 0
		// The first read decides which branch `emit` builds and stamps
		// `artifact.mode`; the second is the one inside its own mode-agreement
		// check. No legitimately-typed caller can make the two disagree, since
		// `artifact.mode` is a literal stamped from the first read alone -- this
		// Proxy is the only way to reach the throw.
		const lyingAssessment = new Proxy(real, {
			get: (target, key, receiver) => {
				if (key === 'mode') {
					reads += 1
					return reads === 1 ? 'production' : 'contract-scoring'
				}
				return Reflect.get(target, key, receiver)
			},
		})
		expect(() => emitOf({ assessment: lyingAssessment })).toThrow(TypeError)
	})
})

describe('emit: production-mode and contract-scoring-mode shape', () => {
	it('mints a fully-shaped, schema-valid production EvidenceArtifact', () => {
		const scored = scoredOf({ assessment: productionAssessment() })
		const result = emit(scored, digestOf(200), digestOf(201), digestOf(202))
		const parsed = EvidenceArtifact.parse(result)
		expect(parsed.schemaVersion).toBe(3)
		expect(parsed.parentDigest).toBeNull()
		expect(parsed.revisionCount).toBe(0)
		expect(parsed.runId).toBe(scored.runId)
		expect(parsed.mode).toBe('production')
		expect(parsed.callerAttestedInputs).toEqual([
			'corpusDigest',
			'fixtureDigest',
			'evaluatorConfigurationDigest',
			'mode',
		])
		expect(parsed.scoringVersionInputs).toEqual({
			contractSchemaVersion: minimalContract.schemaVersion,
			corpusDigest: digestOf(200),
			fixtureDigest: digestOf(201),
			evaluatorConfigurationDigest: digestOf(202),
			scoringPolicyDigest: digestArtifact(policy, 'ScoringPolicy'),
			mode: 'production',
		})
		if (parsed.mode === 'production') {
			expect(parsed.productionVerdict).toBe('PASS')
		}
		// AD-29: `emit` freezes what it owns, matching `seal()`/`preflight`'s
		// own precedent for the other two minting stages.
		expect(Object.isFrozen(result)).toBe(true)
		expect(Object.isFrozen(result.strength)).toBe(true)
		expect(Object.isFrozen(result.outcomes)).toBe(true)
		// `commonFields`, shared by both mode branches, so checked once here
		// rather than duplicated in the contract-scoring case below.
		expect(parsed.strength.basis).toBe('measured')
		expect(parsed.remediation).toEqual({
			revisionCount: minimalContract.revisionCount,
			cap: policy.remediationCap,
			capSource: 'caller-attested',
			lineageChain: scored.assessment.remediationState,
		})
	})

	it('mints a fully-shaped, schema-valid contract-scoring EvidenceArtifact', () => {
		const scored = scoredOf({ assessment: contractAssessment() })
		const result = emit(scored, digestOf(200), digestOf(201), digestOf(202))
		const parsed = EvidenceArtifact.parse(result)
		expect(parsed.mode).toBe('contract-scoring')
		expect(parsed.comparabilityKey).toBe(
			digestArtifact(
				{
					scoringPolicyDigest: digestArtifact(policy, 'ScoringPolicy'),
					probeIds: [probe.probeId],
				},
				'ComparabilityKey',
			),
		)
		if (parsed.mode === 'contract-scoring') {
			expect(parsed.contractVerdict).toBe('PASS')
			expect(parsed.uncitedFindingGaps).toEqual([])
			expect(parsed.systemRecommendationRecorded).toBe('PASS')
			expect(parsed.systemRecommendationNote).toBeNull()
		}
	})
})

describe('emit: STAGE_SIGNATURES conformance', () => {
	it('the one declared input stays byte-identical, module names the new file, and evidence-artifact stays owned by emit', async () => {
		const { ARTIFACT_PRODUCERS, STAGE_SIGNATURES } = await import(
			'../../src/core/lineage/stage-table.ts'
		)
		expect(STAGE_SIGNATURES.emit.module).toBe('src/core/emit/emit.ts')
		expect(STAGE_SIGNATURES.emit.inputs).toEqual([
			'scored-outcomes-and-verdict',
		])
		expect(STAGE_SIGNATURES.emit.valueInputs).toEqual([
			'corpusDigest',
			'fixtureDigest',
			'evaluatorConfigurationDigest',
		])
		expect(ARTIFACT_PRODUCERS['evidence-artifact']).toBe('emit')
	})
})
