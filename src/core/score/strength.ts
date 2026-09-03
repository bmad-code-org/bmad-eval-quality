/**
 * AD-7's rate vector and its four-valued dominance relation.
 *
 * `buildStrengthVector` is a pure aggregation over a qualified probe set and
 * the trial-set reducer's per-probe results: unweighted, per probe class,
 * unique qualified probe identifiers over unique qualified probe identifiers
 * exercised, with canary probes and clean controls excluded regardless of
 * class or trial outcome. `compareDominance` takes two already-computed
 * results and never re-derives a vector, reads a port, a corpus, or a clock;
 * comparability is checked first, and the severity-floor override can only
 * push the relation toward `incomparable`.
 */
import { SEVERITY_LEVELS, type Severity } from '../schemas/eval-contract.ts'
import type {
	ClassStrength,
	Outcome,
	Strength,
	StrengthVector,
} from '../schemas/evidence-artifact.ts'
import type { QualifiedProbe } from './qualification.ts'
import type { TrialSetResult } from './reduce-trials.ts'

export const DOMINANCE_RELATIONS = [
	'a-dominates-b',
	'b-dominates-a',
	'equivalent',
	'incomparable',
] as const

export type DominanceRelationValue = (typeof DOMINANCE_RELATIONS)[number]

/**
 * The slice the dominance comparator reads: the aggregate `Strength` plus the
 * per-probe `outcomes` array the severity-floor override needs, since that
 * identity is lost once probes are aggregated into `ClassStrength` counts,
 * and the `comparabilityKey` the comparator checks before comparing anything
 * else. Every field already lives on `EvidenceArtifact`; this is the read
 * projection the comparator needs from it, not a new artifact shape.
 */
export type ComparableResult = {
	readonly outcomes: readonly Outcome[]
	readonly strength: Strength
	readonly comparabilityKey: string
}

const STRENGTH_VECTOR_CLASSES = [
	'defect',
	'gameability',
	'zero-action',
] as const satisfies readonly (keyof StrengthVector)[]

/**
 * `admitted`, after excluding `canary` and every `expectedClean: true` probe:
 * AD-7's "canary probes and clean controls never enter the vector" applies
 * regardless of class or trial outcome, and a canary carries `expectedClean:
 * false` on its own schema branch, so both conditions are checked.
 */
const vectorEligible = (
	admitted: readonly QualifiedProbe[],
): readonly QualifiedProbe[] =>
	admitted.filter(
		({ probe }) => probe.probeClass !== 'canary' && !probe.expectedClean,
	)

/**
 * One class's aggregate, or `null` when the eligible set admits no probe of
 * that class. A probe with no `TrialSetResult`, or one that is `exercised:
 * false`, contributes to neither `caught` nor `exercised`, matching the
 * reducer's own "zero valid trials excludes a probe entirely" rule. A class
 * with admitted probes but zero exercised ones is still a present
 * `ClassStrength` of `{ caught: 0, exercised: 0, rate: null }`, never a
 * `null` class: `rate`'s nullability exists specifically for that case, and
 * collapsing the whole class to `null` would make it unobservable.
 */
const classStrengthOf = (
	probesInClass: readonly QualifiedProbe[],
	results: ReadonlyMap<string, TrialSetResult>,
): ClassStrength | null => {
	if (probesInClass.length === 0) return null
	let exercised = 0
	let caught = 0
	for (const { probe } of probesInClass) {
		const result = results.get(probe.probeId)
		if (result === undefined || !result.exercised) continue
		exercised += 1
		if (result.caught) caught += 1
	}
	return {
		exercised,
		caught,
		rate: exercised === 0 ? null : caught / exercised,
	}
}

/**
 * AD-7's rate vector: per probe class, the catch rate over unique qualified
 * probe identifiers, with raw counts alongside. `admitted` carries each
 * probe's identifier once by construction, so grouping by class needs no
 * deduplication of its own.
 */
export function buildStrengthVector(
	admitted: readonly QualifiedProbe[],
	results: ReadonlyMap<string, TrialSetResult>,
): StrengthVector {
	const eligible = vectorEligible(admitted)
	const byClass = Object.fromEntries(
		STRENGTH_VECTOR_CLASSES.map((probeClass) => [
			probeClass,
			classStrengthOf(
				eligible.filter(({ probe }) => probe.probeClass === probeClass),
				results,
			),
		]),
	) as Record<(typeof STRENGTH_VECTOR_CLASSES)[number], ClassStrength | null>
	return {
		defect: byClass.defect,
		gameability: byClass.gameability,
		'zero-action': byClass['zero-action'],
	}
}

/**
 * A class contributes to the comparison only when it is a non-null
 * `ClassStrength` on both sides and both sides' `rate` is also non-null; a
 * class absent on either side, or present with a `null` rate on either side,
 * carries no comparative evidence and is skipped exactly alike. `equivalent`
 * compares `caught` and `exercised` rather than the derived `rate`, avoiding
 * a floating-point equality check.
 *
 * A class whose two sides tie on `rate` while disagreeing on `caught` or
 * `exercised` contributes to the comparison, blocks `equivalent` (the counts
 * are not equal), and hands neither side a win (neither `rate` is strictly
 * greater). That third possibility has no named outcome of its own in AD-7's
 * three stated cases, and `incomparable` is where a tied vector with no
 * winner on either side belongs: the same value the "no class contributes at
 * all" case already returns.
 */
function componentComparison(
	a: StrengthVector,
	b: StrengthVector,
): DominanceRelationValue {
	let aWinsAClass = false
	let bWinsAClass = false
	let everyContributingClassEqual = true
	let contributingClasses = 0
	for (const key of STRENGTH_VECTOR_CLASSES) {
		const left = a[key]
		const right = b[key]
		if (left === null || right === null) continue
		if (left.rate === null || right.rate === null) continue
		contributingClasses += 1
		if (left.caught !== right.caught || left.exercised !== right.exercised) {
			everyContributingClassEqual = false
		}
		if (left.rate > right.rate) aWinsAClass = true
		if (right.rate > left.rate) bWinsAClass = true
	}
	if (contributingClasses === 0) return 'incomparable'
	if (everyContributingClassEqual) return 'equivalent'
	if (aWinsAClass && !bWinsAClass) return 'a-dominates-b'
	if (bWinsAClass && !aWinsAClass) return 'b-dominates-a'
	return 'incomparable'
}

const atOrAboveFloor = (severity: Severity, floor: Severity): boolean =>
	SEVERITY_LEVELS.indexOf(severity) >= SEVERITY_LEVELS.indexOf(floor)

/**
 * Keyed by the first outcome carrying each `probeId`, not the last: two
 * `Outcome` entries sharing one `probeId` is itself a defect somewhere
 * upstream (this map has no way to tell which entry is the real one), and a
 * silent last-write-wins overwrite would drop the earlier entry from the
 * severity-floor scan below with no trace it was ever there.
 */
const outcomesByProbeId = (
	outcomes: readonly Outcome[],
): ReadonlyMap<string, Outcome> => {
	const byProbeId = new Map<string, Outcome>()
	for (const outcome of outcomes) {
		if (outcome.probeId === null) continue
		if (byProbeId.has(outcome.probeId)) continue
		byProbeId.set(outcome.probeId, outcome)
	}
	return byProbeId
}

/**
 * Whether `favored` failed to catch a probe that `other` caught at or above
 * `severityFloor`: the condition that disqualifies `favored` from dominating,
 * per AD-7's "a contract that missed a behaviour at or above the scoring
 * policy's severity floor never dominates one that caught it, regardless of
 * the rest of the vector". An outcome with `probeId: null` is not tied to any
 * probe and is outside the vector entirely, so both sides skip it.
 */
function favoredMissesWhatOtherCaught(
	favored: ComparableResult,
	other: ComparableResult,
	severityFloor: Severity,
): boolean {
	const favoredByProbeId = outcomesByProbeId(favored.outcomes)
	const otherByProbeId = outcomesByProbeId(other.outcomes)
	for (const [probeId, otherOutcome] of otherByProbeId) {
		if (otherOutcome.state !== 'caught') continue
		if (!atOrAboveFloor(otherOutcome.severity, severityFloor)) continue
		const favoredOutcome = favoredByProbeId.get(probeId)
		if (favoredOutcome === undefined || favoredOutcome.state !== 'caught') {
			return true
		}
	}
	return false
}

/**
 * AD-7's four-valued dominance relation. `comparabilityKey` and each side's
 * own `strength.comparable` are checked before any component-wise comparison
 * runs: a key mismatch means the two runs are not measuring a shared probe
 * set, and `comparable: false` means AD-21 already marked that one side's own
 * vector as thinner than the policy's declared minimum, so a `caught`/`rate`
 * on it is not fit to decide a comparison either way. The severity-floor
 * override runs only against the side the raw comparison favoured, and only
 * ever downgrades that result to `incomparable`.
 */
export function compareDominance(
	a: ComparableResult,
	b: ComparableResult,
	severityFloor: Severity,
): DominanceRelationValue {
	if (a.comparabilityKey !== b.comparabilityKey) return 'incomparable'
	if (!a.strength.comparable || !b.strength.comparable) return 'incomparable'
	const raw = componentComparison(a.strength.vector, b.strength.vector)
	if (
		raw === 'a-dominates-b' &&
		favoredMissesWhatOtherCaught(a, b, severityFloor)
	) {
		return 'incomparable'
	}
	if (
		raw === 'b-dominates-a' &&
		favoredMissesWhatOtherCaught(b, a, severityFloor)
	) {
		return 'incomparable'
	}
	return raw
}
