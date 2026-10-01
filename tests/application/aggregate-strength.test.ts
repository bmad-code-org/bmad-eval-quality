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
import { AggregationRefusal } from '../../src/core/failure-codes.ts'
import type { EvidenceArtifact } from '../../src/core/schemas/evidence-artifact.ts'
import { RuntimeFault } from '../../src/core/schemas/faults.ts'
import {
	REAL_POLICY,
	scoreDefectProbe,
} from '../aggregate/fixtures/real-evidence.ts'

const ENGINE_VERSION = '4.6.0'

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
			engineVersion: ENGINE_VERSION,
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
			engineVersion: ENGINE_VERSION,
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
			engineVersion: ENGINE_VERSION,
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
				engineVersion: ENGINE_VERSION,
			}),
		).toThrow(AggregationRefusal)
	})

	it('is byte for byte the same through a JSON round trip, which is what a replay reads', async () => {
		const evidence = await fourOfFiveFromTheEngine()
		const floors = { defect: 0.75 }
		const direct = serializeArtifact(
			aggregateStrength({ evidence, floors, engineVersion: ENGINE_VERSION }),
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
				engineVersion: ENGINE_VERSION,
			}),
			'StrengthAggregate',
		)
		expect(replayed).toBe(direct)
	})

	it('binds the version it was produced by, so a replay under another release differs', async () => {
		const evidence = await fourOfFiveFromTheEngine()
		const under = (engineVersion: string) =>
			serializeArtifact(
				aggregateStrength({ evidence, floors: {}, engineVersion }),
				'StrengthAggregate',
			)
		expect(under('4.6.0')).not.toBe(under('4.7.0'))
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
				engineVersion: ENGINE_VERSION,
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
				engineVersion: ENGINE_VERSION,
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
				engineVersion: ENGINE_VERSION,
			}),
		)
		expect(fault.artifactPath).toBe('EvidenceArtifact[1].schemaVersion')
	})

	it('leaves a value with no numeric stamp to the parse', () => {
		const fault = faultOf(() =>
			aggregateStrength({
				evidence: [{ schemaVersion: '4' }] as unknown as EvidenceArtifact[],
				floors: {},
				engineVersion: ENGINE_VERSION,
			}),
		)
		expect(fault.code).toBe('schema-parse-failure')
	})
})

describe('the boundary parses every input', () => {
	it('faults on a value that is not an evidence artifact, naming the list', async () => {
		const fault = faultOf(() =>
			aggregateStrength({
				evidence: [{ not: 'an artifact' }] as unknown as EvidenceArtifact[],
				floors: {},
				engineVersion: ENGINE_VERSION,
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
				engineVersion: ENGINE_VERSION,
			}),
		)
		expect(fault.code).toBe('schema-parse-failure')
		expect(fault.artifactPath).toBe('EvidenceArtifact[]')
	})

	it('faults on floors carrying an own __proto__ key, which would leave a floor silently undeclared', async () => {
		const evidence = [await scoreDefectProbe('P-001', [true, true, true])]
		const floors = JSON.parse('{"__proto__":{"defect":1}}')
		const fault = faultOf(() =>
			aggregateStrength({ evidence, floors, engineVersion: ENGINE_VERSION }),
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
				engineVersion: ENGINE_VERSION,
			}),
		)
		expect(fault.code).toBe('schema-parse-failure')
		expect(fault.artifactPath).toBe('StrengthFloors')
	})
})
