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
	ReducedProbeOutcome,
	Strength,
	StrengthVector,
	TrialOutcome,
	Trials,
} from '../schemas/evidence-artifact.ts'
import type { QualifiedProbe } from './qualification.ts'
import type { TrialSetResult } from './reduce-trials.ts'
import { reductionConsistencyIssuesOf } from './reduction-consistency.ts'

export const DOMINANCE_RELATIONS = [
	'a-dominates-b',
	'b-dominates-a',
	'equivalent',
	'incomparable',
] as const

export type DominanceRelationValue = (typeof DOMINANCE_RELATIONS)[number]

/**
 * The slice the dominance comparator reads: the aggregate `Strength` plus the
 * per-probe reductions the severity-floor override needs, since probe
 * identity is lost once results are aggregated into `ClassStrength` counts,
 * and the `comparabilityKey` the comparator checks before comparing anything
 * else. Every field already lives on `EvidenceArtifact`; this is the read
 * projection the comparator needs from it, not a new artifact shape.
 */
export type ComparableResult = {
	/** Independently retained identity for the probe whose reduction is present. */
	readonly scoredProbeId: string | null
	readonly reducedProbeOutcomes: readonly ReducedProbeOutcome[]
	readonly strength: Strength
	readonly comparabilityKey: string
	/** Detailed evidence used to verify the reduced result before comparison. */
	readonly outcomes: readonly TrialOutcome[]
	/** Trial metadata used to verify invalidated attempts before comparison. */
	readonly trials: Trials
}

/**
 * The three classes the vector keys, in the vector's own order. Exported so
 * the run-wide aggregation walks the same list the per-probe vector does
 * instead of keeping a second copy that could gain or lose a class alone.
 */
export const STRENGTH_VECTOR_CLASSES = [
	'defect',
	'gameability',
	'zero-action',
] as const satisfies readonly (keyof StrengthVector)[]

export type StrengthClass = (typeof STRENGTH_VECTOR_CLASSES)[number]

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
 * One class's aggregate, or `null` when no probe of that class is eligible. A
 * probe with no `TrialSetResult`, or one that is `exercised: false`,
 * contributes to neither `caught` nor `exercised`, matching the reducer's own
 * "zero valid trials excludes a probe entirely" rule. A class with eligible
 * probes but zero exercised ones is still a present `ClassStrength` of
 * `{ caught: 0, exercised: 0, rate: null }`, never a `null` class: `rate`'s
 * nullability exists specifically for that case, and collapsing the whole
 * class to `null` would make it unobservable.
 *
 * The one place the rate arithmetic lives: `buildStrengthVector` calls it per
 * class for one probe set, and the run-wide aggregation calls it per class
 * over the probes of many single-probe evidence artifacts, so a per-probe
 * vector and a run-wide class rate can never be computed two ways.
 */
export function classStrengthOver(
	probeIds: readonly string[],
	results: ReadonlyMap<string, TrialSetResult>,
): ClassStrength | null {
	if (probeIds.length === 0) return null
	let exercised = 0
	let caught = 0
	// Counted once per identifier, not once per entry. AD-7's rate is over
	// unique qualified probe identifiers, and nothing in `src/` enforces that
	// `admitted` carries each identifier once: no probe-corpus schema exists,
	// so the uniqueness is inherited from upstream qualification rather than
	// checked. A repeated identifier would otherwise count its trial-set
	// result twice on both sides of the same ratio, which leaves the rate
	// right and the raw counts wrong.
	const counted = new Set<string>()
	for (const probeId of probeIds) {
		if (counted.has(probeId)) continue
		counted.add(probeId)
		const result = results.get(probeId)
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
 * AD-21's comparability rule, written once: a trial set at or above the
 * policy's declared minimum with no oracle that resolved `unreached`. `emit`
 * applies it when it builds a strength block, and the run-wide aggregation
 * applies it again to verify the block it reads, so a stamped flag and the
 * flag the rule yields cannot be two rules.
 */
export function isComparable(
	trials: Pick<Trials, 'completed' | 'declaredMinimum'>,
	unreachedOracleCount: number,
): boolean {
	return (
		trials.completed >= trials.declaredMinimum && unreachedOracleCount === 0
	)
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
			classStrengthOver(
				eligible
					.filter(({ probe }) => probe.probeClass === probeClass)
					.map(({ probe }) => probe.probeId),
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

/**
 * Both operands are looked up before they are compared, because `indexOf`
 * answers `-1` for a value the ladder does not name and `-1 >= -1` reads as
 * "at or above the floor" for two values that are on no ladder at all. A
 * severity outside the closed set is not at or above anything, and a floor
 * outside it bounds nothing, so either one absent is `false` rather than a
 * comparison of two absences.
 */
const atOrAboveFloor = (severity: Severity, floor: Severity): boolean => {
	const rank = SEVERITY_LEVELS.indexOf(severity)
	const bound = SEVERITY_LEVELS.indexOf(floor)
	if (rank < 0 || bound < 0) return false
	return rank >= bound
}

/**
 * A reduced result must be unique by probe identifier. Duplicate aggregate
 * entries are ambiguous, so the comparator returns `incomparable`.
 */
const reducedOutcomesByProbeId = (
	outcomes: readonly ReducedProbeOutcome[],
): ReadonlyMap<string, ReducedProbeOutcome> | null => {
	const byProbeId = new Map<string, ReducedProbeOutcome>()
	for (const outcome of outcomes) {
		if (byProbeId.has(outcome.probeId)) return null
		byProbeId.set(outcome.probeId, outcome)
	}
	return byProbeId
}

const reductionDetailsAgree = (result: ComparableResult): boolean => {
	return (
		reductionConsistencyIssuesOf({
			outcomes: result.outcomes,
			reducedProbeOutcomes: result.reducedProbeOutcomes,
			trials: result.trials,
			scoredProbeId: result.scoredProbeId,
		}).length === 0
	)
}

/**
 * Whether `favored` failed to catch a probe that `other` caught at or above
 * `severityFloor`: the condition that disqualifies `favored` from dominating,
 * per AD-7's "a contract that missed a behaviour at or above the scoring
 * policy's severity floor never dominates one that caught it, regardless of
 * the rest of the vector". A missing aggregate on the favored side counts as
 * a miss once the other side records a catch for that probe.
 */
function favoredMissesWhatOtherCaught(
	favoredByProbeId: ReadonlyMap<string, ReducedProbeOutcome>,
	otherByProbeId: ReadonlyMap<string, ReducedProbeOutcome>,
	severityFloor: Severity,
): boolean {
	for (const [probeId, otherOutcome] of otherByProbeId) {
		if (!otherOutcome.caught) continue
		if (!atOrAboveFloor(otherOutcome.severity, severityFloor)) continue
		const favoredOutcome = favoredByProbeId.get(probeId)
		if (favoredOutcome === undefined || !favoredOutcome.caught) {
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
 *
 * That scope is AD-7's own and not an omission: its words are that a contract
 * missing a behaviour at or above the floor "never dominates" one that caught
 * it, which constrains dominance and says nothing about equivalence. Two
 * vectors that are component-wise equal are `equivalent` whatever their
 * severities, because neither is dominating anything for the override to
 * withdraw. Widening it to `equivalent` would be a new rule rather than this
 * one applied more thoroughly, and it is written down here so the asymmetry
 * reads as a decision rather than a gap.
 */
export function compareDominance(
	a: ComparableResult,
	b: ComparableResult,
	severityFloor: Severity,
): DominanceRelationValue {
	if (a.comparabilityKey !== b.comparabilityKey) return 'incomparable'
	if (!a.strength.comparable || !b.strength.comparable) return 'incomparable'
	if (!reductionDetailsAgree(a) || !reductionDetailsAgree(b)) {
		return 'incomparable'
	}
	const aByProbeId = reducedOutcomesByProbeId(a.reducedProbeOutcomes)
	const bByProbeId = reducedOutcomesByProbeId(b.reducedProbeOutcomes)
	if (aByProbeId === null || bByProbeId === null) return 'incomparable'
	const raw = componentComparison(a.strength.vector, b.strength.vector)
	if (
		raw === 'a-dominates-b' &&
		favoredMissesWhatOtherCaught(aByProbeId, bByProbeId, severityFloor)
	) {
		return 'incomparable'
	}
	if (
		raw === 'b-dominates-a' &&
		favoredMissesWhatOtherCaught(bByProbeId, aByProbeId, severityFloor)
	) {
		return 'incomparable'
	}
	return raw
}
