/**
 * The run-wide strength aggregation. Every case states what fails if the
 * behavior it names is reverted; the revert each one answers to is exercised
 * by hand once and recorded in the pull request.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { serializeArtifact } from '../../src/application/serialize.ts'
import { aggregateStrength } from '../../src/core/aggregate/aggregate-strength.ts'
import { digestArtifact } from '../../src/core/canonical/digest.ts'
import {
	AggregationRefusal,
	type AggregationRefusalCode,
} from '../../src/core/failure-codes.ts'
import type { EvidenceArtifact } from '../../src/core/schemas/evidence-artifact.ts'
import type { ScoringPolicy } from '../../src/core/schemas/scoring-policy.ts'
import {
	StrengthAggregate,
	type StrengthFloors,
} from '../../src/core/schemas/strength-aggregate.ts'
import { ENGINE_VERSION } from '../../src/core/version.ts'
import {
	caught,
	cleanControl,
	digestOfOrdinal,
	evidenceFor,
	fourOfFiveDefects,
	missed,
	TEST_POLICY,
	unexercised,
} from './fixtures/evidence.ts'

const aggregate = (
	evidence: readonly EvidenceArtifact[],
	floors: StrengthFloors = {},
	policy: ScoringPolicy = TEST_POLICY,
) => aggregateStrength(evidence, floors, policy)

const refusalOf = (run: () => unknown): AggregationRefusal => {
	try {
		run()
	} catch (error) {
		expect(error).toBeInstanceOf(AggregationRefusal)
		return error as AggregationRefusal
	}
	throw new Error('expected an AggregationRefusal and nothing was thrown')
}

const refusedWith = (
	code: AggregationRefusalCode,
	run: () => unknown,
): AggregationRefusal => {
	const refusal = refusalOf(run)
	expect(refusal.code).toBe(code)
	return refusal
}

/** A deep copy the case may damage, typed loose because a tampered artifact is by construction not of the parsed type. */
const tampered = (
	artifact: EvidenceArtifact,
	damage: (copy: any) => void,
): EvidenceArtifact => {
	const copy = structuredClone(artifact) as any
	damage(copy)
	return copy as EvidenceArtifact
}

describe('the class floor decision', () => {
	it('four caught probes among five meet a 0.75 floor', () => {
		const result = aggregate(fourOfFiveDefects(), { defect: 0.75 })
		expect(result.classes.defect).toEqual({
			eligible: 5,
			exercised: 5,
			caught: 4,
			rate: 0.8,
			comparable: true,
		})
		expect(result.floorDecisions.defect).toEqual({
			floor: 0.75,
			decision: 'meets',
			basis: 'rate-meets-floor',
		})
	})

	it('the same evidence does not meet a 0.9 floor', () => {
		const result = aggregate(fourOfFiveDefects(), { defect: 0.9 })
		expect(result.classes.defect?.rate).toBe(0.8)
		expect(result.floorDecisions.defect).toEqual({
			floor: 0.9,
			decision: 'does-not-meet',
			basis: 'rate-below-floor',
		})
	})

	it('a rate exactly at the floor meets it, and a lower one does not', () => {
		const threeOfFour = [
			...fourOfFiveDefects().slice(0, 3),
			evidenceFor({ probeId: 'P-009', kind: 'defect', states: missed() }),
		]
		const atFloor = aggregate(threeOfFour, { defect: 0.75 })
		expect(atFloor.classes.defect?.rate).toBe(0.75)
		expect(atFloor.floorDecisions.defect.decision).toBe('meets')

		const threeOfFive = [
			...threeOfFour,
			evidenceFor({ probeId: 'P-010', kind: 'defect', states: missed() }),
		]
		const belowFloor = aggregate(threeOfFive, { defect: 0.75 })
		expect(belowFloor.classes.defect?.rate).toBe(0.6)
		expect(belowFloor.floorDecisions.defect.decision).toBe('does-not-meet')
	})

	it('a floor of one is met only by every exercised probe caught', () => {
		expect(
			aggregate(fourOfFiveDefects(), { defect: 1 }).floorDecisions.defect
				.decision,
		).toBe('does-not-meet')
		expect(
			aggregate(fourOfFiveDefects().slice(0, 4), { defect: 1 }).floorDecisions
				.defect.decision,
		).toBe('meets')
	})

	it('decides every class on its own floor', () => {
		const result = aggregate(
			[
				...fourOfFiveDefects(),
				evidenceFor({
					probeId: 'P-010',
					kind: 'zero-action',
					states: missed(),
				}),
				evidenceFor({
					probeId: 'P-011',
					kind: 'gameability',
					states: caught(),
				}),
			],
			{ defect: 0.75, 'zero-action': 1 },
		)
		expect(result.floorDecisions.defect.decision).toBe('meets')
		expect(result.floorDecisions['zero-action']).toEqual({
			floor: 1,
			decision: 'does-not-meet',
			basis: 'rate-below-floor',
		})
		expect(result.floorDecisions.gameability).toEqual({
			floor: null,
			decision: 'undeclared',
			basis: 'no-floor-declared',
		})
		expect(result.classes.gameability?.rate).toBe(1)
	})
})

describe('null, unexercised, and non-comparable classes', () => {
	it('a class with no eligible probe is null, and a floor declared on it is not met', () => {
		const result = aggregate(fourOfFiveDefects(), {
			defect: 0.75,
			gameability: 0.5,
		})
		expect(result.classes.gameability).toBeNull()
		expect(result.classes['zero-action']).toBeNull()
		expect(result.floorDecisions.gameability).toEqual({
			floor: 0.5,
			decision: 'does-not-meet',
			basis: 'no-eligible-probe',
		})
	})

	it('an admitted class with no exercised probe reports rate null and does not meet its floor', () => {
		const result = aggregate(
			[
				evidenceFor({
					probeId: 'P-001',
					kind: 'defect',
					states: unexercised(),
				}),
			],
			{ defect: 0.5 },
		)
		expect(result.classes.defect).toEqual({
			eligible: 1,
			exercised: 0,
			caught: 0,
			rate: null,
			comparable: true,
		})
		expect(result.floorDecisions.defect).toEqual({
			floor: 0.5,
			decision: 'does-not-meet',
			basis: 'no-exercised-probe',
		})
	})

	it('an unexercised probe stays in the eligible count and out of the rate, and a floor over the class is not met', () => {
		const result = aggregate(
			[
				evidenceFor({ probeId: 'P-001', kind: 'defect', states: caught() }),
				evidenceFor({
					probeId: 'P-002',
					kind: 'defect',
					states: unexercised(),
				}),
			],
			{ defect: 1 },
		)
		expect(result.classes.defect).toMatchObject({
			eligible: 2,
			exercised: 1,
			caught: 1,
			rate: 1,
		})
		expect(result.floorDecisions.defect).toEqual({
			floor: 1,
			decision: 'does-not-meet',
			basis: 'unexercised-probe',
		})
	})

	it('a rate above the floor over the exercised probes alone is still not met while a probe went unexercised', () => {
		const result = aggregate(
			[
				...fourOfFiveDefects().slice(0, 4),
				evidenceFor({
					probeId: 'P-009',
					kind: 'defect',
					states: unexercised(),
				}),
			],
			{ defect: 0.5 },
		)
		expect(result.classes.defect?.rate).toBe(1)
		expect(result.floorDecisions.defect.basis).toBe('unexercised-probe')
	})

	it('meets the floor again once every eligible probe was exercised', () => {
		const result = aggregate(fourOfFiveDefects().slice(0, 4), { defect: 1 })
		expect(result.floorDecisions.defect.decision).toBe('meets')
	})

	it('a trial set below minimumTrialCount makes its class non-comparable, and a perfect rate is not a pass', () => {
		const result = aggregate(
			[
				evidenceFor({ probeId: 'P-001', kind: 'defect', states: caught() }),
				evidenceFor({ probeId: 'P-002', kind: 'defect', states: caught(2) }),
			],
			{ defect: 0.5 },
		)
		expect(result.minimumTrialCount).toBe(3)
		expect(result.classes.defect).toMatchObject({ rate: 1, comparable: false })
		expect(result.floorDecisions.defect).toEqual({
			floor: 0.5,
			decision: 'does-not-meet',
			basis: 'not-comparable',
		})
	})

	it('an oracle that resolved unreached makes its class non-comparable', () => {
		const result = aggregate(
			[
				evidenceFor({
					probeId: 'P-001',
					kind: 'defect',
					states: ['caught', 'caught', 'caught', 'unreached'],
				}),
			],
			{ defect: 0.5 },
		)
		expect(result.classes.defect?.comparable).toBe(false)
		expect(result.floorDecisions.defect.basis).toBe('not-comparable')
	})

	it('one non-comparable class leaves the other classes comparable', () => {
		const result = aggregate(
			[
				evidenceFor({ probeId: 'P-001', kind: 'defect', states: caught(2) }),
				evidenceFor({
					probeId: 'P-002',
					kind: 'zero-action',
					states: caught(),
				}),
			],
			{ defect: 0.5, 'zero-action': 0.5 },
		)
		expect(result.classes.defect?.comparable).toBe(false)
		expect(result.classes['zero-action']?.comparable).toBe(true)
		expect(result.floorDecisions['zero-action'].decision).toBe('meets')
	})
})

describe('clean controls and canaries', () => {
	it('stay outside every class denominator, caught or not', () => {
		const withControls = aggregate(
			[
				...fourOfFiveDefects(),
				evidenceFor({
					probeId: 'P-006',
					kind: 'control',
					states: cleanControl(),
				}),
				evidenceFor({ probeId: 'P-007', kind: 'canary', states: caught() }),
				evidenceFor({ probeId: 'P-008', kind: 'canary', states: missed() }),
			],
			{ defect: 0.75 },
		)
		const without = aggregate(fourOfFiveDefects(), { defect: 0.75 })
		expect(withControls.classes).toEqual(without.classes)
		expect(withControls.floorDecisions).toEqual(without.floorDecisions)
		expect(withControls.classes.defect?.eligible).toBe(5)
	})

	it('are recorded among the inputs with no class', () => {
		const result = aggregate([
			evidenceFor({
				probeId: 'P-006',
				kind: 'control',
				states: cleanControl(),
			}),
			evidenceFor({ probeId: 'P-007', kind: 'canary', states: caught() }),
		])
		expect(result.inputs.map((input) => input.probeClass)).toEqual([null, null])
		expect(result.classes).toEqual({
			defect: null,
			gameability: null,
			'zero-action': null,
		})
	})

	it('a non-comparable control does not make a comparable class non-comparable', () => {
		const result = aggregate(
			[
				evidenceFor({ probeId: 'P-001', kind: 'defect', states: caught() }),
				evidenceFor({
					probeId: 'P-002',
					kind: 'control',
					states: cleanControl(1),
				}),
			],
			{ defect: 1 },
		)
		expect(result.classes.defect?.comparable).toBe(true)
	})
})

describe('inputs that are not one run are refused', () => {
	it('refuses two probes that share an identifier', () => {
		const refusal = refusedWith('strength-inputs-disagree', () =>
			aggregate([
				evidenceFor({ probeId: 'P-001', kind: 'defect', states: caught() }),
				evidenceFor({
					probeId: 'P-001',
					kind: 'defect',
					states: missed(),
					runId: 'another-run',
				}),
			]),
		)
		expect(refusal.artifactPath).toBe('EvidenceArtifact[1]')
		expect(refusal.message).toContain('P-001')
	})

	it('refuses artifacts scored under different scoring policies', () => {
		const refusal = refusedWith('strength-inputs-disagree', () =>
			aggregate([
				evidenceFor({ probeId: 'P-001', kind: 'defect', states: caught() }),
				evidenceFor({
					probeId: 'P-002',
					kind: 'defect',
					states: caught(),
					scoringPolicyDigest: digestOfOrdinal(777),
				}),
			]),
		)
		expect(refusal.message).toContain('scoringPolicyDigest')
	})

	it('refuses artifacts that agree with each other and were scored under another policy than the one supplied', () => {
		const otherPolicy = { ...TEST_POLICY, policyId: 'another-policy' }
		const otherDigest = digestArtifact(otherPolicy, 'ScoringPolicy')
		const evidence = [
			evidenceFor({
				probeId: 'P-001',
				kind: 'defect',
				states: caught(),
				scoringPolicyDigest: otherDigest,
			}),
			evidenceFor({
				probeId: 'P-002',
				kind: 'defect',
				states: caught(),
				scoringPolicyDigest: otherDigest,
			}),
		]
		const refusal = refusedWith('strength-inputs-disagree', () =>
			aggregate(evidence),
		)
		expect(refusal.message).toContain(otherDigest)
		expect(aggregate(evidence, {}, otherPolicy).classes.defect?.eligible).toBe(
			2,
		)
	})

	it('refuses artifacts attested against different corpora', () => {
		refusedWith('strength-inputs-disagree', () =>
			aggregate([
				evidenceFor({ probeId: 'P-001', kind: 'defect', states: caught() }),
				evidenceFor({
					probeId: 'P-002',
					kind: 'defect',
					states: caught(),
					corpusDigest: digestOfOrdinal(778),
				}),
			]),
		)
	})

	it('refuses artifacts scored in different modes', () => {
		refusedWith('strength-inputs-disagree', () =>
			aggregate([
				evidenceFor({ probeId: 'P-001', kind: 'defect', states: caught() }),
				evidenceFor({
					probeId: 'P-002',
					kind: 'defect',
					states: caught(),
					mode: 'production',
				}),
			]),
		)
	})

	it('refuses an artifact whose declared minimum is not the policy minimumTrialCount', () => {
		const refusal = refusedWith('strength-inputs-disagree', () =>
			aggregate([
				evidenceFor({ probeId: 'P-001', kind: 'defect', states: caught() }),
				evidenceFor({
					probeId: 'P-002',
					kind: 'defect',
					states: caught(),
					declaredMinimum: 2,
				}),
			]),
		)
		expect(refusal.artifactPath).toBe('EvidenceArtifact[1]')
		expect(refusal.message).toContain("policy's minimumTrialCount 3")
	})

	it('refuses a policy with another minimumTrialCount, whose digest the set was not scored under', () => {
		const refusal = refusedWith('strength-inputs-disagree', () =>
			aggregate(
				fourOfFiveDefects(),
				{},
				{ ...TEST_POLICY, minimumTrialCount: 5 },
			),
		)
		expect(refusal.message).toContain('scoringPolicyDigest')
	})

	it('refuses a reduction made under another catch threshold than the policy declares', () => {
		const refusal = refusedWith('strength-inputs-disagree', () =>
			aggregate([
				evidenceFor({ probeId: 'P-001', kind: 'defect', states: caught() }),
				evidenceFor({
					probeId: 'P-002',
					kind: 'defect',
					states: caught(),
					catchThreshold: 0.6,
				}),
			]),
		)
		expect(refusal.message).toContain("policy's catchThreshold 0.5")
	})

	it('takes minimumTrialCount from the policy it verified against', () => {
		const policy = { ...TEST_POLICY, minimumTrialCount: 2 }
		const evidence = [
			evidenceFor({
				probeId: 'P-001',
				kind: 'defect',
				states: caught(2),
				declaredMinimum: 2,
				scoringPolicyDigest: digestArtifact(policy, 'ScoringPolicy'),
			}),
		]
		const result = aggregate(evidence, { defect: 1 }, policy)
		expect(result.minimumTrialCount).toBe(2)
		expect(result.scoringPolicyDigest).toBe(
			digestArtifact(policy, 'ScoringPolicy'),
		)
		expect(result.classes.defect?.comparable).toBe(true)
	})

	it('refuses artifacts that attested different scoring-version inputs', () => {
		const refusal = refusedWith('strength-inputs-disagree', () =>
			aggregate([
				evidenceFor({ probeId: 'P-001', kind: 'defect', states: caught() }),
				evidenceFor({
					probeId: 'P-002',
					kind: 'defect',
					states: caught(),
					callerAttestedInputs: ['corpusDigest', 'mode'],
				}),
			]),
		)
		expect(refusal.message).toContain('callerAttestedInputs')
	})

	it('refuses a reconstructed basis beside a measured one', () => {
		const refusal = refusedWith('strength-inputs-disagree', () =>
			aggregate([
				evidenceFor({ probeId: 'P-001', kind: 'defect', states: caught() }),
				evidenceFor({
					probeId: 'P-002',
					kind: 'defect',
					states: caught(),
					basis: 'reconstructed',
				}),
			]),
		)
		expect(refusal.message).toContain('basis')
	})

	it('mints nothing when any input is refused', () => {
		const evidence = fourOfFiveDefects()
		evidence.push(
			evidenceFor({
				probeId: 'P-006',
				kind: 'defect',
				states: caught(),
				scoringPolicyDigest: digestOfOrdinal(779),
			}),
		)
		expect(() => aggregate(evidence, { defect: 0.75 })).toThrow(
			AggregationRefusal,
		)
	})
})

describe('a tampered artifact is refused', () => {
	const [base] = fourOfFiveDefects() as [EvidenceArtifact]
	const others = fourOfFiveDefects().slice(1)

	const refuseTampered = (
		damage: (copy: any) => void,
		code: AggregationRefusalCode = 'strength-input-inconsistent',
	): AggregationRefusal =>
		refusedWith(code, () => aggregate([tampered(base, damage), ...others]))

	it('refuses a forged comparabilityKey', () => {
		const refusal = refuseTampered((copy) => {
			copy.comparabilityKey = digestOfOrdinal(1234)
		})
		expect(refusal.artifactPath).toBe('EvidenceArtifact[0]')
		expect(refusal.message).toContain('comparabilityKey')
	})

	it('refuses a comparabilityKey that is the digest of another probe', () => {
		const other = others[0] as EvidenceArtifact
		refuseTampered((copy) => {
			copy.comparabilityKey = other.comparabilityKey
		})
	})

	it('refuses a scoringVersion that is not the digest of its inputs', () => {
		const refusal = refuseTampered((copy) => {
			copy.scoringVersion = digestOfOrdinal(1235)
		})
		expect(refusal.message).toContain('scoringVersion')
	})

	it('refuses scoring-version inputs edited without restamping the version', () => {
		refuseTampered((copy) => {
			copy.scoringVersionInputs.corpusDigest = digestOfOrdinal(1236)
		})
	})

	it('refuses a reduction flipped from caught to missed', () => {
		const refusal = refuseTampered((copy) => {
			copy.reducedProbeOutcomes[0].caught = false
		})
		expect(refusal.message).toContain('caught')
	})

	it('refuses trial evidence edited under an intact reduction', () => {
		refuseTampered((copy) => {
			copy.outcomes[0].state = 'missed'
		})
	})

	it('refuses a strength vector that disagrees with its own reduction', () => {
		const refusal = refuseTampered((copy) => {
			copy.strength.vector.defect = { caught: 0, exercised: 1, rate: 0 }
		})
		expect(refusal.message).toContain('strength.vector.defect')
	})

	it('cannot see a probe whose vector was nulled, which is what the recorded artifact digest binds', () => {
		// An artifact carries no probe class beyond its own vector, so nulling the
		// vector reads as a clean control or canary and moves a missed defect probe
		// out of the denominator. The aggregate cannot refuse that from the
		// artifact alone; it records the digest of what it read, and a caller that
		// kept the digest it saw at scoring time finds the substitution.
		const honest = aggregate(fourOfFiveDefects(), { defect: 0.75 })
		const nulled = tampered(
			fourOfFiveDefects()[4] as EvidenceArtifact,
			(copy) => {
				copy.strength.vector.defect = null
			},
		)
		const result = aggregate([...fourOfFiveDefects().slice(0, 4), nulled], {
			defect: 0.75,
		})
		expect(result.classes.defect?.eligible).toBe(4)
		const digestOf = (aggregated: typeof result): string | undefined =>
			aggregated.inputs.find((input) => input.probeId === 'P-005')
				?.artifactDigest
		expect(digestOf(result)).not.toBe(digestOf(honest))
	})

	it('cannot see a probe whose vector was moved to another class, which the recorded digest also exposes', () => {
		const honest = aggregate(fourOfFiveDefects(), { defect: 0.75 })
		const relabeled = tampered(
			fourOfFiveDefects()[4] as EvidenceArtifact,
			(copy) => {
				copy.strength.vector['zero-action'] = copy.strength.vector.defect
				copy.strength.vector.defect = null
			},
		)
		const result = aggregate([...fourOfFiveDefects().slice(0, 4), relabeled], {
			defect: 0.75,
		})
		expect(result.classes.defect?.eligible).toBe(4)
		expect(result.classes['zero-action']?.eligible).toBe(1)
		const digestOf = (aggregated: typeof result): string | undefined =>
			aggregated.inputs.find((input) => input.probeId === 'P-005')
				?.artifactDigest
		expect(digestOf(result)).not.toBe(digestOf(honest))
	})

	it('refuses a vector naming two classes for one probe', () => {
		const refusal = refuseTampered((copy) => {
			copy.strength.vector.gameability = { caught: 1, exercised: 1, rate: 1 }
		})
		expect(refusal.message).toContain('one probe')
	})

	it('refuses a comparable flag the trials contradict', () => {
		const refusal = refusedWith('strength-input-inconsistent', () =>
			aggregate([
				tampered(
					evidenceFor({ probeId: 'P-001', kind: 'defect', states: caught(2) }),
					(copy) => {
						copy.strength.comparable = true
					},
				),
			]),
		)
		expect(refusal.message).toContain('strength.comparable')
	})

	it('refuses a non-comparable flag on a complete trial set', () => {
		refuseTampered((copy) => {
			copy.strength.comparable = false
		})
	})

	it('refuses an artifact that lists a probe as excluded, since a scored probe is admitted', () => {
		const own = refuseTampered((copy) => {
			copy.excludedProbeIds = ['P-001']
		})
		expect(own.message).toContain('excludedProbeIds')
		refuseTampered((copy) => {
			copy.excludedProbeIds = ['P-099']
		})
	})

	it('refuses a class vector on an artifact whose outcomes are a clean control', () => {
		const control = evidenceFor({
			probeId: 'P-006',
			kind: 'control',
			states: cleanControl(),
		})
		const injected = tampered(control, (copy) => {
			copy.strength.vector.defect = { caught: 0, exercised: 1, rate: 0 }
		})
		const refusal = refusedWith('strength-input-inconsistent', () =>
			aggregate([...fourOfFiveDefects(), injected], { defect: 0.75 }),
		)
		expect(refusal.artifactPath).toBe('EvidenceArtifact[5]')
		expect(refusal.message).toContain('clean control')
	})

	it('refuses a false positive that was given a class', () => {
		const control = evidenceFor({
			probeId: 'P-006',
			kind: 'control',
			states: ['false-positive', 'false-positive', 'false-positive'],
		})
		refusedWith('strength-input-inconsistent', () =>
			aggregate([
				tampered(control, (copy) => {
					copy.strength.vector.defect = { caught: 0, exercised: 1, rate: 0 }
				}),
			]),
		)
	})
})

const manifestVersion = (
	JSON.parse(
		readFileSync(
			fileURLToPath(new URL('../../package.json', import.meta.url)),
			'utf8',
		),
	) as { readonly version: string }
).version

describe('lineage', () => {
	it('records the engine version and the digest of every artifact it read', () => {
		const evidence = fourOfFiveDefects()
		const result = aggregate(evidence, { defect: 0.75 })
		expect(result.engineVersion).toBe(ENGINE_VERSION)
		expect(result.engineVersion).toBe(manifestVersion)
		expect(result.inputs).toEqual(
			evidence.map((artifact) => ({
				probeId: artifact.scoredProbeId,
				probeClass: 'defect',
				runId: artifact.runId,
				artifactDigest: digestArtifact(artifact, 'EvidenceArtifact'),
			})),
		)
	})

	it('changes the recorded digest when an artifact changes', () => {
		const evidence = fourOfFiveDefects()
		const before = aggregate(evidence, { defect: 0.75 })
		const replaced = [
			...evidence.slice(0, 4),
			evidenceFor({
				probeId: 'P-005',
				kind: 'defect',
				states: caught(),
				runId: 'rerun-p-005',
			}),
		]
		const after = aggregate(replaced, { defect: 0.75 })
		expect(after.inputs[4]?.artifactDigest).not.toBe(
			before.inputs[4]?.artifactDigest,
		)
		expect(after.inputs.slice(0, 4)).toEqual(before.inputs.slice(0, 4))
	})

	it('carries the attested inputs the artifacts share, and names what the aggregation itself takes on trust', () => {
		const result = aggregate(fourOfFiveDefects())
		expect(result.callerAttestedInputs).toEqual([
			'corpusDigest',
			'evaluatorConfigurationDigest',
			'fixtureDigest',
			'mode',
		])
		expect(result.aggregateAttestedInputs).toEqual([
			'evidenceSetCompleteness',
			'probeClass',
		])
	})

	it('binds the scoring version, the mode, and a comparability key over the probes it covered', () => {
		const evidence = fourOfFiveDefects()
		const result = aggregate(evidence)
		const first = evidence[0] as EvidenceArtifact
		expect(result.scoringVersion).toBe(first.scoringVersion)
		expect(result.mode).toBe('contract-scoring')
		expect(result.comparabilityKey).toBe(
			digestArtifact(
				{
					scoringPolicyDigest: first.scoringVersionInputs.scoringPolicyDigest,
					probeIds: ['P-001', 'P-002', 'P-003', 'P-004', 'P-005'],
				},
				'ComparabilityKey',
			),
		)
		const fewer = aggregate(evidence.slice(0, 4))
		expect(fewer.comparabilityKey).not.toBe(result.comparabilityKey)
	})

	it('is the same bytes on a second run and under any input order', () => {
		const evidence = fourOfFiveDefects()
		const floors = { defect: 0.75 }
		const first = serializeArtifact(
			aggregate(evidence, floors),
			'StrengthAggregate',
		)
		const second = serializeArtifact(
			aggregate(evidence, floors),
			'StrengthAggregate',
		)
		const reversed = serializeArtifact(
			aggregate([...evidence].reverse(), floors),
			'StrengthAggregate',
		)
		expect(second).toBe(first)
		expect(reversed).toBe(first)
	})

	it('mints a valid, frozen, lineage-root artifact', () => {
		const result = aggregate(fourOfFiveDefects(), { defect: 0.75 })
		expect(StrengthAggregate.safeParse(result).success).toBe(true)
		expect(result.schemaVersion).toBe(1)
		expect(result.parentDigest).toBeNull()
		expect(result.revisionCount).toBe(0)
		expect(Object.isFrozen(result)).toBe(true)
		expect(Object.isFrozen(result.inputs)).toBe(true)
	})
})

describe('preconditions', () => {
	it('throws a TypeError for no evidence at all', () => {
		expect(() => aggregate([])).toThrow(TypeError)
	})
})
