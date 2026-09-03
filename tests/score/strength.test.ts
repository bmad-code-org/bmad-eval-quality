// AD-7's rate vector: the builder's class aggregation and exclusions, and the
// dominance comparator's four-valued relation, comparability gate, and
// severity-floor override.

import { describe, expect, it } from 'vitest'
import type { Severity } from '../../src/core/schemas/eval-contract.ts'
import {
	ClassStrength,
	type Outcome,
	type Strength,
	StrengthVector,
} from '../../src/core/schemas/evidence-artifact.ts'
import type { Probe } from '../../src/core/schemas/probe.ts'
import type {
	QualificationResult,
	QualifiedProbe,
} from '../../src/core/score/qualification.ts'
import type { TrialSetResult } from '../../src/core/score/reduce-trials.ts'
import {
	buildStrengthVector,
	type ComparableResult,
	compareDominance,
	DOMINANCE_RELATIONS,
} from '../../src/core/score/strength.ts'
import {
	canary,
	digestOf,
	evidenceReference,
	qualifiedProbe,
} from './fixtures/probe-witness.ts'

const QUALIFIED: QualificationResult = {
	qualified: true,
	failures: [],
	declarationChecksRan: true,
}

const admittedOf = (probe: Probe): QualifiedProbe => ({
	probe,
	result: QUALIFIED,
})

const seedingProbe = (
	probeId: string,
	probeClass: Extract<Probe, { expectedClean: false }>['probeClass'],
): Probe => ({
	...qualifiedProbe,
	probeId,
	probeClass,
})

const canaryProbe = (probeId: string): Probe => ({ ...canary, probeId })

const cleanControlProbe = (
	probeId: string,
	probeClass: Extract<Probe, { expectedClean: false }>['probeClass'],
): Probe => ({
	schemaVersion: 2,
	parentDigest: null,
	revisionCount: 0,
	probeId,
	probeClass,
	expectedClean: true,
	behaviorId: 'B-001',
	systemId: 'notes-api',
	implementationDigest: digestOf(20),
	artifactDigest: digestOf(21),
	commitDigest: digestOf(22),
	rationale: 'A known-clean control.',
	qualification: {
		route: 'clean-control',
		baselinePassEvidence: evidenceReference,
		revisionCommitDigest: digestOf(23),
		noKnownDefectStatement:
			'No known defect in this interface at this revision.',
	},
	defects: [],
})

const trialResult = (
	overrides: Partial<TrialSetResult> = {},
): TrialSetResult => ({
	exercised: true,
	caught: true,
	validCount: 3,
	caughtCount: 2,
	invalidatedAttempts: [],
	...overrides,
})

describe('buildStrengthVector', () => {
	it('emits the catch rate over unique qualified probe identifiers, with raw counts', () => {
		const admitted = [
			admittedOf(seedingProbe('P-1', 'defect')),
			admittedOf(seedingProbe('P-2', 'defect')),
		]
		const results = new Map<string, TrialSetResult>([
			['P-1', trialResult({ caught: true })],
			['P-2', trialResult({ caught: false })],
		])
		const vector = buildStrengthVector(admitted, results)
		expect(vector.defect).toEqual({ caught: 1, exercised: 2, rate: 0.5 })
		expect(vector.gameability).toBeNull()
		expect(vector['zero-action']).toBeNull()
	})

	it('excludes canary probes from the vector regardless of trial outcome', () => {
		const admitted = [
			admittedOf(seedingProbe('P-1', 'defect')),
			admittedOf(canaryProbe('P-canary')),
		]
		const results = new Map<string, TrialSetResult>([
			['P-1', trialResult({ caught: true })],
			['P-canary', trialResult({ caught: true })],
		])
		const vector = buildStrengthVector(admitted, results)
		expect(vector.defect).toEqual({ caught: 1, exercised: 1, rate: 1 })
	})

	it('excludes every expectedClean probe regardless of its class', () => {
		const admitted = [
			admittedOf(seedingProbe('P-1', 'gameability')),
			admittedOf(cleanControlProbe('P-clean', 'gameability')),
		]
		const results = new Map<string, TrialSetResult>([
			['P-1', trialResult({ caught: false })],
			['P-clean', trialResult({ caught: true })],
		])
		const vector = buildStrengthVector(admitted, results)
		expect(vector.gameability).toEqual({ caught: 0, exercised: 1, rate: 0 })
	})

	it('is a present ClassStrength of zero and zero, not a null class, when every admitted probe is unexercised', () => {
		const admitted = [admittedOf(seedingProbe('P-1', 'zero-action'))]
		const results = new Map<string, TrialSetResult>([
			['P-1', trialResult({ exercised: false, caught: false })],
		])
		const vector = buildStrengthVector(admitted, results)
		expect(vector['zero-action']).toEqual({
			caught: 0,
			exercised: 0,
			rate: null,
		})
	})

	it('treats a probe with no TrialSetResult entry as unexercised, not as absent', () => {
		const admitted = [admittedOf(seedingProbe('P-1', 'zero-action'))]
		const vector = buildStrengthVector(admitted, new Map())
		expect(vector['zero-action']).toEqual({
			caught: 0,
			exercised: 0,
			rate: null,
		})
	})

	it('keys a class null only when the admitted set has zero probes of that class', () => {
		const admitted = [admittedOf(seedingProbe('P-1', 'defect'))]
		const vector = buildStrengthVector(admitted, new Map())
		expect(vector.gameability).toBeNull()
		expect(vector['zero-action']).toBeNull()
	})
})

describe('the ClassStrength and StrengthVector schemas carry no weight, percentage, or composite', () => {
	it('ClassStrength is exactly caught, exercised, and rate', () => {
		expect(Object.keys(ClassStrength.shape).sort()).toEqual([
			'caught',
			'exercised',
			'rate',
		])
	})

	it('StrengthVector is exactly the three non-canary classes', () => {
		expect(Object.keys(StrengthVector.shape).sort()).toEqual([
			'defect',
			'gameability',
			'zero-action',
		])
	})
})

const strengthOf = (vector: StrengthVector, comparable = true): Strength => ({
	denominator: 'unique qualified probe identifiers exercised',
	basis: 'measured',
	vector,
	comparable,
	note: null,
})

const outcomeOf = (
	probeId: string | null,
	state: Outcome['state'],
	severity: Severity = 'material',
): Outcome => ({
	oracleId: 'oracle-1',
	probeId,
	state,
	severity,
	disposition: 'not-attempted',
	resolvedFrom: null,
	corroboration: 'not-evaluable',
	selectedObservationIds: [],
	checkResolution: null,
})

const KEY = digestOf(1)
const OTHER_KEY = digestOf(2)

const comparableOf = (
	vector: StrengthVector,
	outcomes: readonly Outcome[] = [],
	comparabilityKey = KEY,
	comparable = true,
): ComparableResult => ({
	outcomes,
	strength: strengthOf(vector, comparable),
	comparabilityKey,
})

const NULL_VECTOR: StrengthVector = {
	defect: null,
	gameability: null,
	'zero-action': null,
}

describe('compareDominance', () => {
	it('is one of the four declared relation values', () => {
		const a = comparableOf({
			...NULL_VECTOR,
			defect: { caught: 2, exercised: 4, rate: 0.5 },
		})
		const b = comparableOf({
			...NULL_VECTOR,
			defect: { caught: 1, exercised: 4, rate: 0.25 },
		})
		expect(DOMINANCE_RELATIONS).toContain(compareDominance(a, b, 'low'))
	})

	it('DOMINANCE_RELATIONS is exactly the four documented values, no more, no fewer', () => {
		expect([...DOMINANCE_RELATIONS].sort()).toEqual(
			['a-dominates-b', 'b-dominates-a', 'equivalent', 'incomparable'].sort(),
		)
	})

	it('is incomparable when the comparabilityKeys differ, before any component-wise check', () => {
		const a = comparableOf(
			{ ...NULL_VECTOR, defect: { caught: 4, exercised: 4, rate: 1 } },
			[],
			KEY,
		)
		const b = comparableOf(
			{ ...NULL_VECTOR, defect: { caught: 0, exercised: 4, rate: 0 } },
			[],
			OTHER_KEY,
		)
		expect(compareDominance(a, b, 'low')).toBe('incomparable')
	})

	it('is incomparable when the keys match but one side is not comparable', () => {
		const a = comparableOf(
			{ ...NULL_VECTOR, defect: { caught: 4, exercised: 4, rate: 1 } },
			[],
			KEY,
			false,
		)
		const b = comparableOf(
			{ ...NULL_VECTOR, defect: { caught: 0, exercised: 4, rate: 0 } },
			[],
			KEY,
			true,
		)
		expect(compareDominance(a, b, 'low')).toBe('incomparable')
		expect(compareDominance(b, a, 'low')).toBe('incomparable')
	})

	it('is incomparable when the two results share no non-null probe class', () => {
		const a = comparableOf({
			...NULL_VECTOR,
			defect: { caught: 1, exercised: 1, rate: 1 },
		})
		const b = comparableOf({
			...NULL_VECTOR,
			gameability: { caught: 1, exercised: 1, rate: 1 },
		})
		expect(compareDominance(a, b, 'low')).toBe('incomparable')
	})

	it('is equivalent when every shared class has equal caught and exercised', () => {
		const vector: StrengthVector = {
			defect: { caught: 2, exercised: 4, rate: 0.5 },
			gameability: null,
			'zero-action': { caught: 0, exercised: 0, rate: null },
		}
		const a = comparableOf(vector)
		const b = comparableOf(vector)
		expect(compareDominance(a, b, 'low')).toBe('equivalent')
	})

	it('is incomparable when the only contributing class ties on rate but disagrees on caught and exercised', () => {
		// 1/2 and 2/4 are the same rate, so neither side's rate is strictly
		// greater and the class hands nobody a win; the counts differ, so it is
		// not `equivalent` either. That third shape has no named outcome of its
		// own in AD-7's three stated cases, and resolves to `incomparable`, the
		// same value a comparison with no contributing class at all returns.
		const a = comparableOf({
			...NULL_VECTOR,
			defect: { caught: 1, exercised: 2, rate: 0.5 },
		})
		const b = comparableOf({
			...NULL_VECTOR,
			defect: { caught: 2, exercised: 4, rate: 0.5 },
		})
		expect(compareDominance(a, b, 'low')).toBe('incomparable')
	})

	it('a-dominates-b when A wins at least one class and loses none', () => {
		const a = comparableOf({
			...NULL_VECTOR,
			defect: { caught: 3, exercised: 4, rate: 0.75 },
			gameability: { caught: 1, exercised: 2, rate: 0.5 },
		})
		const b = comparableOf({
			...NULL_VECTOR,
			defect: { caught: 1, exercised: 4, rate: 0.25 },
			gameability: { caught: 1, exercised: 2, rate: 0.5 },
		})
		expect(compareDominance(a, b, 'low')).toBe('a-dominates-b')
		expect(compareDominance(b, a, 'low')).toBe('b-dominates-a')
	})

	it('is incomparable when each side wins at least one class', () => {
		const a = comparableOf({
			...NULL_VECTOR,
			defect: { caught: 3, exercised: 4, rate: 0.75 },
			gameability: { caught: 0, exercised: 4, rate: 0 },
		})
		const b = comparableOf({
			...NULL_VECTOR,
			defect: { caught: 1, exercised: 4, rate: 0.25 },
			gameability: { caught: 4, exercised: 4, rate: 1 },
		})
		expect(compareDominance(a, b, 'low')).toBe('incomparable')
	})

	it('skips a class present on only one side, contributing neither a win nor a loss', () => {
		const a = comparableOf({
			defect: { caught: 3, exercised: 4, rate: 0.75 },
			gameability: { caught: 1, exercised: 4, rate: 0.25 },
			'zero-action': null,
		})
		const b = comparableOf({
			defect: { caught: 1, exercised: 4, rate: 0.25 },
			gameability: null,
			'zero-action': { caught: 4, exercised: 4, rate: 1 },
		})
		// only `defect` is shared and non-null on both sides; A wins it and
		// nothing else contributes, so A dominates despite `zero-action` reading
		// entirely in B's favour on paper.
		expect(compareDominance(a, b, 'low')).toBe('a-dominates-b')
	})

	it('skips a class shared as an object but null-rate on either side, exactly like an absent class', () => {
		const a = comparableOf({
			defect: { caught: 3, exercised: 4, rate: 0.75 },
			gameability: { caught: 0, exercised: 0, rate: null },
			'zero-action': null,
		})
		const b = comparableOf({
			defect: { caught: 1, exercised: 4, rate: 0.25 },
			gameability: { caught: 0, exercised: 0, rate: null },
			'zero-action': null,
		})
		expect(compareDominance(a, b, 'low')).toBe('a-dominates-b')
	})

	it('never dominates when the favoured side missed a floor-or-above probe the other caught', () => {
		const vector = {
			...NULL_VECTOR,
			defect: { caught: 3, exercised: 4, rate: 0.75 },
		}
		const other = {
			...NULL_VECTOR,
			defect: { caught: 1, exercised: 4, rate: 0.25 },
		}
		const a = comparableOf(vector, [
			outcomeOf('P-shared', 'missed', 'critical'),
		])
		const b = comparableOf(other, [outcomeOf('P-shared', 'caught', 'critical')])
		expect(compareDominance(a, b, 'material')).toBe('incomparable')
	})

	it('still dominates when the missed probe reads below the severity floor', () => {
		const vector = {
			...NULL_VECTOR,
			defect: { caught: 3, exercised: 4, rate: 0.75 },
		}
		const other = {
			...NULL_VECTOR,
			defect: { caught: 1, exercised: 4, rate: 0.25 },
		}
		const a = comparableOf(vector, [outcomeOf('P-shared', 'missed', 'low')])
		const b = comparableOf(other, [outcomeOf('P-shared', 'caught', 'low')])
		expect(compareDominance(a, b, 'material')).toBe('a-dominates-b')
	})

	it('never inverts: the override downgrades the favoured side rather than promoting the other', () => {
		const vector = {
			...NULL_VECTOR,
			defect: { caught: 3, exercised: 4, rate: 0.75 },
		}
		const other = {
			...NULL_VECTOR,
			defect: { caught: 1, exercised: 4, rate: 0.25 },
		}
		const a = comparableOf(vector, [
			outcomeOf('P-shared', 'missed', 'critical'),
		])
		const b = comparableOf(other, [outcomeOf('P-shared', 'caught', 'critical')])
		const relation = compareDominance(a, b, 'material')
		expect(relation).not.toBe('a-dominates-b')
		expect(relation).not.toBe('b-dominates-a')
		expect(relation).toBe('incomparable')
	})

	it('skips an outcome with a null probeId when applying the severity-floor override', () => {
		const vector = {
			...NULL_VECTOR,
			defect: { caught: 3, exercised: 4, rate: 0.75 },
		}
		const other = {
			...NULL_VECTOR,
			defect: { caught: 1, exercised: 4, rate: 0.25 },
		}
		const a = comparableOf(vector, [outcomeOf(null, 'missed', 'critical')])
		const b = comparableOf(other, [outcomeOf(null, 'caught', 'critical')])
		expect(compareDominance(a, b, 'material')).toBe('a-dominates-b')
	})

	// `outcomesByProbeId` keeps the first entry sharing a `probeId`, never the
	// last. Here `other`'s own list carries two `P-shared` entries -- `caught`
	// first, `missed` second -- so a last-write-wins map would read `missed`
	// for the override check, skip it (the guard only fires on `caught`), and
	// leave `a-dominates-b` standing uncorrected. First-write-wins reads
	// `caught`, finds `favored` missed the same probe, and downgrades to
	// `incomparable`.
	it('reads the first Outcome sharing a probeId, not the last, when applying the severity-floor override', () => {
		const vector = {
			...NULL_VECTOR,
			defect: { caught: 3, exercised: 4, rate: 0.75 },
		}
		const other = {
			...NULL_VECTOR,
			defect: { caught: 1, exercised: 4, rate: 0.25 },
		}
		const a = comparableOf(vector, [
			outcomeOf('P-shared', 'missed', 'critical'),
		])
		const b = comparableOf(other, [
			outcomeOf('P-shared', 'caught', 'critical'),
			outcomeOf('P-shared', 'missed', 'critical'),
		])
		expect(compareDominance(a, b, 'material')).toBe('incomparable')
	})
})
