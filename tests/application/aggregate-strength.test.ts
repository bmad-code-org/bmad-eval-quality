/**
 * `aggregateStrength` over evidence the real `runScore` chain emitted: four
 * caught probes among five at the two floors the story fixes, the boundary
 * parses, and the replay property. The core cases live in
 * `tests/aggregate/aggregate-strength.test.ts` over builders; these hold the
 * same behavior against what the engine actually writes.
 */
import { describe, expect, it } from 'vitest'
import { aggregateStrength } from '../../src/application/aggregate-strength.ts'
import { serializeArtifact } from '../../src/application/serialize.ts'
import { digestArtifact } from '../../src/core/canonical/digest.ts'
import { AggregationRefusal } from '../../src/core/failure-codes.ts'
import type { EvidenceArtifact } from '../../src/core/schemas/evidence-artifact.ts'
import { RuntimeFault } from '../../src/core/schemas/faults.ts'
import { SCORING_POLICY_SCHEMA_VERSION } from '../../src/core/schemas/scoring-policy.ts'
import { ENGINE_VERSION } from '../../src/core/version.ts'
import { VERSION } from '../../src/index.ts'
import {
	REAL_POLICY,
	scoreCleanControl,
	scoreDefectProbe,
} from '../aggregate/fixtures/real-evidence.ts'

/** P-001 to P-004 caught, P-005 missed: three of three trials each. */
const fourOfFiveFromTheEngine = async (): Promise<EvidenceArtifact[]> => [
	await scoreDefectProbe('P-001', [true, true, true]),
	await scoreDefectProbe('P-002', [true, true, true]),
	await scoreDefectProbe('P-003', [true, true, true]),
	await scoreDefectProbe('P-004', [true, true, true]),
	await scoreDefectProbe('P-005', [false, false, false]),
]

const faultOf = (act: () => unknown): RuntimeFault => {
	try {
		act()
	} catch (error) {
		expect(error).toBeInstanceOf(RuntimeFault)
		return error as RuntimeFault
	}
	throw new Error('expected a RuntimeFault and nothing was thrown')
}

describe('aggregateStrength over evidence from the real score chain', () => {
	it('meets a 0.75 floor with four caught probes among five', async () => {
		const result = aggregateStrength({
			evidence: await fourOfFiveFromTheEngine(),
			floors: { defect: 0.75 },
			policy: REAL_POLICY,
		})
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

	it('does not meet a 0.9 floor on the same evidence', async () => {
		const result = aggregateStrength({
			evidence: await fourOfFiveFromTheEngine(),
			floors: { defect: 0.9 },
			policy: REAL_POLICY,
		})
		expect(result.classes.defect?.rate).toBe(0.8)
		expect(result.floorDecisions.defect.decision).toBe('does-not-meet')
	})

	it('reads a trial set below the policy minimum as non-comparable', async () => {
		const result = aggregateStrength({
			evidence: [
				await scoreDefectProbe('P-001', [true, true, true]),
				await scoreDefectProbe('P-002', [true, true]),
			],
			floors: { defect: 0.5 },
			policy: REAL_POLICY,
		})
		expect(result.classes.defect).toMatchObject({
			eligible: 2,
			rate: 1,
			comparable: false,
		})
		expect(result.floorDecisions.defect.basis).toBe('not-comparable')
	})

	it('refuses a trial set scored under a different policy', async () => {
		const stricter = {
			...REAL_POLICY,
			policyId: 'stricter',
			minimumTrialCount: 2,
		}
		const evidence = [
			await scoreDefectProbe('P-001', [true, true, true]),
			await scoreDefectProbe('P-002', [true, true, true], {
				policy: stricter,
			}),
		]
		expect(() =>
			aggregateStrength({
				evidence,
				floors: {},
				policy: REAL_POLICY,
			}),
		).toThrow(AggregationRefusal)
	})

	it('keeps a clean control out of every class and reproduces the defects-only result', async () => {
		const defects = await fourOfFiveFromTheEngine()
		const control = await scoreCleanControl('P-006')
		const withControl = aggregateStrength({
			evidence: [...defects, control],
			floors: { defect: 0.75 },
			policy: REAL_POLICY,
		})
		const without = aggregateStrength({
			evidence: defects,
			floors: { defect: 0.75 },
			policy: REAL_POLICY,
		})
		expect(withControl.classes).toEqual(without.classes)
		expect(withControl.floorDecisions).toEqual(without.floorDecisions)
		expect(
			withControl.inputs.find((input) => input.probeId === 'P-006'),
		).toEqual({
			probeId: 'P-006',
			probeClass: null,
			runId: control.runId,
			artifactDigest: digestArtifact(control, 'EvidenceArtifact'),
		})
	})

	it('leaves the classes the run has no probe for null on engine output', async () => {
		const result = aggregateStrength({
			evidence: [
				...(await fourOfFiveFromTheEngine()),
				await scoreCleanControl('P-006'),
			],
			floors: { gameability: 0.5, 'zero-action': 0.5 },
			policy: REAL_POLICY,
		})
		expect(result.classes.gameability).toBeNull()
		expect(result.classes['zero-action']).toBeNull()
		expect(result.floorDecisions.gameability).toEqual({
			floor: 0.5,
			decision: 'does-not-meet',
			basis: 'no-eligible-probe',
		})
		expect(result.floorDecisions['zero-action'].basis).toBe('no-eligible-probe')
	})

	it('is byte for byte the same through a JSON round trip, which is what a replay reads', async () => {
		const evidence = await fourOfFiveFromTheEngine()
		const floors = { defect: 0.75 }
		const direct = serializeArtifact(
			aggregateStrength({ evidence, floors, policy: REAL_POLICY }),
			'StrengthAggregate',
		)
		const replayed = serializeArtifact(
			aggregateStrength({
				evidence: evidence
					.map((artifact) =>
						JSON.parse(serializeArtifact(artifact, 'EvidenceArtifact')),
					)
					.reverse(),
				floors: JSON.parse(JSON.stringify(floors)),
				policy: REAL_POLICY,
			}),
			'StrengthAggregate',
		)
		expect(replayed).toBe(direct)
	})

	it('records the package version the build declares', async () => {
		const result = aggregateStrength({
			evidence: await fourOfFiveFromTheEngine(),
			floors: {},
			policy: REAL_POLICY,
		})
		expect(result.engineVersion).toBe(ENGINE_VERSION)
		expect(result.engineVersion).toBe(VERSION)
	})
})

describe('the evidence schema version is read before the shape', () => {
	const withStamp = async (version: number): Promise<EvidenceArtifact> => {
		const artifact = structuredClone(
			await scoreDefectProbe('P-001', [true, true, true]),
		) as { schemaVersion: number }
		artifact.schemaVersion = version
		return artifact as EvidenceArtifact
	}

	it('names a shape-compatible artifact stamped for another version', async () => {
		const evidence = [await withStamp(5)]
		const fault = faultOf(() =>
			aggregateStrength({
				evidence,
				floors: {},
				policy: REAL_POLICY,
			}),
		)
		expect(fault.code).toBe('schema-version-mismatch')
		expect(fault.artifactPath).toBe('EvidenceArtifact[0].schemaVersion')
		expect(fault.message).toContain('this build reads 4')
	})

	it('names the stamp of an artifact whose shape is the previous version', async () => {
		const older = (await withStamp(3)) as unknown as Record<string, unknown>
		delete older.reducedProbeOutcomes
		const fault = faultOf(() =>
			aggregateStrength({
				evidence: [older as unknown as EvidenceArtifact],
				floors: {},
				policy: REAL_POLICY,
			}),
		)
		expect(fault.code).toBe('schema-version-mismatch')
		expect(fault.artifactPath).toBe('EvidenceArtifact[0].schemaVersion')
	})

	it('names the index of the stale artifact among several', async () => {
		const evidence = [
			await scoreDefectProbe('P-001', [true, true, true]),
			await withStamp(2),
		]
		const fault = faultOf(() =>
			aggregateStrength({
				evidence,
				floors: {},
				policy: REAL_POLICY,
			}),
		)
		expect(fault.artifactPath).toBe('EvidenceArtifact[1].schemaVersion')
	})

	it('leaves a value with no numeric stamp to the parse', () => {
		const fault = faultOf(() =>
			aggregateStrength({
				evidence: [{ schemaVersion: '4' }] as unknown as EvidenceArtifact[],
				floors: {},
				policy: REAL_POLICY,
			}),
		)
		expect(fault.code).toBe('schema-parse-failure')
	})
})

describe('the scoring policy stamp is read before the shape', () => {
	const stale = SCORING_POLICY_SCHEMA_VERSION - 1
	const aggregateUnder = async (policy: unknown): Promise<RuntimeFault> => {
		const evidence = [await scoreDefectProbe('P-001', [true, true, true])]
		return faultOf(() =>
			aggregateStrength({ evidence, floors: {}, policy: policy as never }),
		)
	}
	const expectNamed = (fault: RuntimeFault): void => {
		expect(fault.code).toBe('schema-version-mismatch')
		expect(fault.artifactPath).toBe('ScoringPolicy.schemaVersion')
		expect(fault.message).toContain(
			`carries "schemaVersion" ${stale} where this build reads ${SCORING_POLICY_SCHEMA_VERSION}`,
		)
	}

	it('names a stale policy whose shape parses under the current schema', async () => {
		expectNamed(await aggregateUnder({ ...REAL_POLICY, schemaVersion: stale }))
	})

	it('names the stamp of a previous-shape policy, never a parse failure', async () => {
		const { catchThreshold: _dropped, ...previousShape } = REAL_POLICY
		const parseFault = await aggregateUnder(previousShape)
		expect(parseFault.code).toBe('schema-parse-failure')
		expectNamed(
			await aggregateUnder({ ...previousShape, schemaVersion: stale }),
		)
	})

	it('leaves a policy with no numeric stamp to the parse, which names the field', async () => {
		const { schemaVersion: _stamp, ...unstamped } = REAL_POLICY
		const fault = await aggregateUnder(unstamped)
		expect(fault.code).toBe('schema-parse-failure')
		expect(fault.artifactPath).toBe('ScoringPolicy')
	})
})

describe('the boundary parses every input', () => {
	it('faults on a value that is not an evidence artifact, naming the list', async () => {
		const fault = faultOf(() =>
			aggregateStrength({
				evidence: [{ not: 'an artifact' }] as unknown as EvidenceArtifact[],
				floors: {},
				policy: REAL_POLICY,
			}),
		)
		expect(fault.code).toBe('schema-parse-failure')
		expect(fault.artifactPath).toBe('EvidenceArtifact[]')
	})

	it('faults on an empty list', () => {
		const fault = faultOf(() =>
			aggregateStrength({
				evidence: [],
				floors: {},
				policy: REAL_POLICY,
			}),
		)
		expect(fault.code).toBe('schema-parse-failure')
		expect(fault.artifactPath).toBe('EvidenceArtifact[]')
	})

	it('faults on floors carrying an own __proto__ key, which would leave a floor silently undeclared', async () => {
		const evidence = [await scoreDefectProbe('P-001', [true, true, true])]
		const floors = JSON.parse('{"__proto__":{"defect":1}}')
		const fault = faultOf(() =>
			aggregateStrength({ evidence, floors, policy: REAL_POLICY }),
		)
		expect(fault.code).toBe('schema-parse-failure')
		expect(fault.artifactPath).toBe('StrengthFloors')
	})

	it.each([
		['an unknown class', { canary: 1 }],
		['a floor above one', { defect: 1.5 }],
		['a negative floor', { defect: -0.1 }],
		['a floor that is not a number', { defect: '0.75' }],
	])('faults on floors naming %s', async (_name, floors) => {
		const evidence = [await scoreDefectProbe('P-001', [true, true, true])]
		const fault = faultOf(() =>
			aggregateStrength({
				evidence,
				floors: floors as never,
				policy: REAL_POLICY,
			}),
		)
		expect(fault.code).toBe('schema-parse-failure')
		expect(fault.artifactPath).toBe('StrengthFloors')
	})
})
