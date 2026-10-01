/**
 * The `aggregate` stage: the run-wide strength of the qualified probes of one
 * run, which no single evidence artifact can state. `score` covers one probe
 * per call, so an artifact's strength vector describes that probe alone and an
 * adopter's per-class floor has nothing to be compared against. This stage
 * reads every per-probe artifact of the run and mints one `StrengthAggregate`.
 *
 * Pure and deterministic: no clock, port, or filesystem, and no input order
 * in the bytes. The engine decides here, so a caller copies the aggregate and
 * never recomputes a rate or a floor decision from it (AD-6).
 *
 * The rate arithmetic is `classStrengthOver`, the function that builds each
 * artifact's own vector, so a probe's vector and the class rate it feeds are
 * one computation. What this stage adds is verification and the floor
 * comparison.
 *
 * Verification refuses with `AggregationRefusal` and mints nothing, because an
 * aggregate over mixed or contradictory inputs is a class-wide claim nothing
 * supports:
 *
 * - each artifact must agree with itself. Its reduction is recomputed from the
 *   retained trial votes, its strength vector must be what its own reduction
 *   yields, its scoring version and comparability key must be the digests of
 *   the inputs it states, and its comparability flag must follow from its
 *   trials and outcomes. What the artifact cannot state, this stage cannot
 *   check: an artifact carries no probe class and no engine version, so the
 *   class is read off the vector and the engine version is the aggregating
 *   release's own. A caller that kept each artifact's digest when it scored
 *   the probe binds the set by comparing against `inputs`.
 * - the artifacts must agree with each other: unique probes, one scoring
 *   version, one evidence basis, one minimum trial count, one catch threshold.
 *   Each artifact's own `comparabilityKey` covers its one probe, so those
 *   differ by construction and are not compared across artifacts; the
 *   scoring version carries the scoring policy digest and is.
 */
import { digestArtifact } from '../canonical/digest.ts'
import { AggregationRefusal } from '../failure-codes.ts'
import { freezeArtifact } from '../lineage/freeze.ts'
import type {
	EvidenceArtifact,
	ReducedProbeOutcome,
} from '../schemas/evidence-artifact.ts'
import type { ScoringPolicy } from '../schemas/scoring-policy.ts'
import {
	AGGREGATE_ATTESTED_INPUTS,
	type AggregatedClass,
	type AggregatedInput,
	type FloorDecision,
	STRENGTH_AGGREGATE_SCHEMA_VERSION,
	StrengthAggregate,
	type StrengthFloors,
} from '../schemas/strength-aggregate.ts'
import { reductionConsistencyIssuesOf } from '../score/reduction-consistency.ts'
import {
	classStrengthOver,
	isComparable,
	STRENGTH_VECTOR_CLASSES,
	type StrengthClass,
} from '../score/strength.ts'
import type { AggregateStage } from '../stage-contracts.ts'
import { ENGINE_VERSION } from '../version.ts'

const EVIDENCE_ARTIFACT_PATH = 'EvidenceArtifact'
const SCORING_POLICY_ARTIFACT_PATH = 'ScoringPolicy'
const SCORING_VERSION_INPUTS_ARTIFACT_PATH = 'ScoringVersionInputs'
const COMPARABILITY_KEY_ARTIFACT_PATH = 'ComparabilityKey'

/** One input after it agreed with itself. */
type VerifiedInput = {
	readonly path: string
	readonly artifact: EvidenceArtifact
	readonly probeId: string
	readonly probeClass: StrengthClass | null
	readonly reduced: ReducedProbeOutcome
	readonly comparable: boolean
	readonly digest: string
}

const inconsistent = (path: string, detail: string): never => {
	throw new AggregationRefusal('strength-input-inconsistent', path, detail)
}

const disagree = (path: string, detail: string): never => {
	throw new AggregationRefusal('strength-inputs-disagree', path, detail)
}

/**
 * The comparability rule `emit` applied, read back over what the artifact
 * retains: the trial counts and the oracles that resolved `unreached`.
 */
const comparableOf = (artifact: EvidenceArtifact): boolean =>
	isComparable(
		artifact.trials,
		artifact.outcomes.filter((outcome) => outcome.state === 'unreached').length,
	)

/**
 * `emit`'s key is over the policy digest and the admitted probe identifiers,
 * and each artifact scores one probe, so the admitted set is that probe. A
 * probe the qualification gate rejects resolves the Invalid rung and mints no
 * artifact, so the real engine never writes one with an exclusion.
 */
const expectedComparabilityKey = (artifact: EvidenceArtifact): string =>
	digestArtifact(
		{
			scoringPolicyDigest: artifact.scoringVersionInputs.scoringPolicyDigest,
			probeIds: [artifact.scoredProbeId],
		},
		COMPARABILITY_KEY_ARTIFACT_PATH,
	)

/**
 * The outcome states only a clean control can resolve: `passed-clean-control`
 * and `false-positive` are assigned on `expectedClean` alone (AD-33). An
 * artifact carrying one of them scored a clean control, whatever else it says.
 */
const CLEAN_CONTROL_ONLY_STATES: ReadonlySet<string> = new Set([
	'passed-clean-control',
	'false-positive',
])

function verifyInput(artifact: EvidenceArtifact, index: number): VerifiedInput {
	const path = `${EVIDENCE_ARTIFACT_PATH}[${index}]`
	const [first] = reductionConsistencyIssuesOf(artifact)
	if (first !== undefined) {
		inconsistent(path, `${first.path.join('.')}: ${first.message}`)
	}
	const reduced = artifact.reducedProbeOutcomes[0]
	if (reduced === undefined) {
		// The consistency check above refuses an artifact whose reductions are not
		// exactly its scored probe; this narrows the type for what follows.
		return inconsistent(path, 'reducedProbeOutcomes: no reduction')
	}
	const probeId = artifact.scoredProbeId

	if (
		artifact.scoringVersion !==
		digestArtifact(
			artifact.scoringVersionInputs,
			SCORING_VERSION_INPUTS_ARTIFACT_PATH,
		)
	) {
		inconsistent(
			path,
			`scoringVersion is not the digest of its scoringVersionInputs (${probeId})`,
		)
	}
	if (artifact.excludedProbeIds.length > 0) {
		inconsistent(
			path,
			`excludedProbeIds names ${artifact.excludedProbeIds.join(', ')}, but a scored probe is admitted (${probeId})`,
		)
	}
	if (artifact.comparabilityKey !== expectedComparabilityKey(artifact)) {
		inconsistent(
			path,
			`comparabilityKey is not the digest of its scoring policy digest and its scored probe (${probeId})`,
		)
	}
	if (artifact.strength.comparable !== comparableOf(artifact)) {
		inconsistent(
			path,
			`strength.comparable disagrees with its trials and outcomes (${probeId})`,
		)
	}

	const classes = STRENGTH_VECTOR_CLASSES.filter(
		(name) => artifact.strength.vector[name] !== null,
	)
	if (classes.length > 1) {
		inconsistent(
			path,
			`strength.vector names ${classes.join(' and ')}, but one artifact scores one probe (${probeId})`,
		)
	}
	const probeClass = classes[0] ?? null
	if (
		probeClass !== null &&
		artifact.outcomes.some((outcome) =>
			CLEAN_CONTROL_ONLY_STATES.has(outcome.state),
		)
	) {
		inconsistent(
			path,
			`strength.vector.${probeClass} counts a probe whose outcomes are a clean control's, which stays outside every class (${probeId})`,
		)
	}
	if (probeClass !== null) {
		const expected = classStrengthOver([probeId], new Map([[probeId, reduced]]))
		const actual = artifact.strength.vector[probeClass]
		if (
			expected === null ||
			actual === null ||
			actual.caught !== expected.caught ||
			actual.exercised !== expected.exercised ||
			actual.rate !== expected.rate
		) {
			inconsistent(
				path,
				`strength.vector.${probeClass} is not what the probe's own reduction yields (${probeId})`,
			)
		}
	}

	return {
		path,
		artifact,
		probeId,
		probeClass,
		reduced,
		comparable: artifact.strength.comparable,
		digest: digestArtifact(artifact, EVIDENCE_ARTIFACT_PATH),
	}
}

/** Every input must carry the same value, compared against the first. */
function requireOne(
	inputs: readonly VerifiedInput[],
	describe: string,
	read: (input: VerifiedInput) => string | number,
): string | number {
	const [head] = inputs
	if (head === undefined) throw new TypeError('aggregate: no inputs')
	const expected = read(head)
	for (const input of inputs) {
		const value = read(input)
		if (value !== expected) {
			disagree(
				input.path,
				`${describe} ${value} (${input.probeId}) differs from ${expected} (${head.probeId}): the artifacts are not one run`,
			)
		}
	}
	return expected
}

function decide(
	floor: number | undefined,
	aggregated: AggregatedClass | null,
): FloorDecision {
	if (floor === undefined) {
		return { floor: null, decision: 'undeclared', basis: 'no-floor-declared' }
	}
	if (aggregated === null) {
		return { floor, decision: 'does-not-meet', basis: 'no-eligible-probe' }
	}
	if (!aggregated.comparable) {
		return { floor, decision: 'does-not-meet', basis: 'not-comparable' }
	}
	if (aggregated.rate === null) {
		return { floor, decision: 'does-not-meet', basis: 'no-exercised-probe' }
	}
	// Every eligible probe has to have been exercised. A rate over the exercised
	// probes alone would let a probe the evaluator never reached drop out of the
	// claim the floor makes about the class.
	if (aggregated.exercised < aggregated.eligible) {
		return { floor, decision: 'does-not-meet', basis: 'unexercised-probe' }
	}
	return aggregated.rate >= floor
		? { floor, decision: 'meets', basis: 'rate-meets-floor' }
		: { floor, decision: 'does-not-meet', basis: 'rate-below-floor' }
}

export const aggregateStrength: AggregateStage = (
	evidence,
	floors: StrengthFloors,
	policy: ScoringPolicy,
) => {
	if (evidence.length === 0) {
		throw new TypeError('aggregateStrength(): no evidence artifact to read')
	}
	const inputs = evidence.map((artifact, index) => verifyInput(artifact, index))

	// The caller's scoring policy is the one the run was scored under. Each
	// artifact states the digest of the policy it was scored under and echoes the
	// two thresholds the aggregation reads, and all three have to be the
	// policy's own.
	const policyDigest = digestArtifact(policy, SCORING_POLICY_ARTIFACT_PATH)
	for (const input of inputs) {
		const { artifact, reduced } = input
		if (artifact.scoringVersionInputs.scoringPolicyDigest !== policyDigest) {
			disagree(
				input.path,
				`scoringPolicyDigest ${artifact.scoringVersionInputs.scoringPolicyDigest} (${input.probeId}) is not the digest ${policyDigest} of the scoring policy supplied`,
			)
		}
		if (artifact.trials.declaredMinimum !== policy.minimumTrialCount) {
			disagree(
				input.path,
				`trials.declaredMinimum ${artifact.trials.declaredMinimum} (${input.probeId}) is not the supplied policy's minimumTrialCount ${policy.minimumTrialCount}`,
			)
		}
		if (reduced.catchThreshold !== policy.catchThreshold) {
			disagree(
				input.path,
				`catchThreshold ${reduced.catchThreshold} (${input.probeId}) is not the supplied policy's catchThreshold ${policy.catchThreshold}`,
			)
		}
	}

	const seen = new Map<string, VerifiedInput>()
	for (const input of inputs) {
		const earlier = seen.get(input.probeId)
		if (earlier !== undefined) {
			disagree(
				input.path,
				`probe ${input.probeId} is also scored by ${earlier.path}: a probe counts once`,
			)
		}
		seen.set(input.probeId, input)
	}

	const scoringVersion = requireOne(
		inputs,
		'scoringVersion',
		({ artifact }) => artifact.scoringVersion,
	) as string
	const basis = requireOne(
		inputs,
		'strength.basis',
		({ artifact }) => artifact.strength.basis,
	) as 'measured' | 'reconstructed'
	// AD-32: the artifact states which of the six scoring-version inputs the
	// caller attested. Two sets that attested different inputs did not run under
	// one trust boundary.
	requireOne(inputs, 'callerAttestedInputs', ({ artifact }) =>
		JSON.stringify([...artifact.callerAttestedInputs].sort()),
	)

	const head = inputs[0] as VerifiedInput
	const callerAttestedInputs = [...head.artifact.callerAttestedInputs].sort()
	const results = new Map(inputs.map((input) => [input.probeId, input.reduced]))

	const classes = Object.fromEntries(
		STRENGTH_VECTOR_CLASSES.map((name) => {
			const members = inputs.filter((input) => input.probeClass === name)
			const strength = classStrengthOver(
				members.map((member) => member.probeId),
				results,
			)
			const aggregated: AggregatedClass | null =
				strength === null
					? null
					: {
							...strength,
							eligible: members.length,
							comparable: members.every((member) => member.comparable),
						}
			return [name, aggregated]
		}),
	) as Record<StrengthClass, AggregatedClass | null>

	const floorDecisions = Object.fromEntries(
		STRENGTH_VECTOR_CLASSES.map((name) => [
			name,
			decide(floors[name], classes[name]),
		]),
	) as Record<StrengthClass, FloorDecision>

	const sorted = [...inputs].sort((left, right) =>
		left.probeId < right.probeId ? -1 : left.probeId > right.probeId ? 1 : 0,
	)
	const aggregatedInputs: AggregatedInput[] = sorted.map((input) => ({
		probeId: input.probeId,
		probeClass: input.probeClass,
		runId: input.artifact.runId,
		artifactDigest: input.digest,
	}))

	const aggregate: StrengthAggregate = {
		schemaVersion: STRENGTH_AGGREGATE_SCHEMA_VERSION,
		parentDigest: null,
		revisionCount: 0,
		engineVersion: ENGINE_VERSION,
		mode: head.artifact.scoringVersionInputs.mode,
		scoringVersion,
		scoringPolicyDigest: policyDigest,
		comparabilityKey: digestArtifact(
			{
				scoringPolicyDigest: policyDigest,
				probeIds: sorted.map((input) => input.probeId),
			},
			COMPARABILITY_KEY_ARTIFACT_PATH,
		),
		basis,
		minimumTrialCount: policy.minimumTrialCount,
		callerAttestedInputs,
		aggregateAttestedInputs: [...AGGREGATE_ATTESTED_INPUTS],
		inputs: aggregatedInputs,
		classes,
		floorDecisions,
	}
	const checked = StrengthAggregate.safeParse(aggregate)
	if (!checked.success) {
		const issue = checked.error.issues[0]
		throw new TypeError(
			`aggregateStrength(): assembled an aggregate that failed StrengthAggregate validation, first at "${issue?.path.join('.') ?? ''}"`,
			{ cause: checked.error },
		)
	}
	return freezeArtifact(checked.data)
}
