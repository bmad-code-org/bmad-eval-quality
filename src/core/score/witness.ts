/**
 * AD-40's witness match: whether a finding cited against a probe actually
 * witnessed the defect that probe seeded.
 *
 * This is the input that makes non-detection reachable. Without it, an oracle
 * that correctly confirmed an untouched behaviour and one that failed to detect
 * the seeded defect present identical inputs, so any table obeying AD-3 must
 * give both the same answer and the catch rate is 1.00 by construction.
 *
 * Pure and total on its ordinary path, and no AD-6 outcome state is assigned
 * here. The result is a fact about evidence; turning it into an outcome state
 * is the decision procedure's.
 *
 * One deliberate non-totality: a `RuntimeFault` from the shipped evaluator
 * propagates undecorated. A fault never becomes a verdict, and AD-28 makes it
 * an invalidating condition under AD-21 rather than a behavioural result, so
 * catching one here would convert AD-21's fault exit into a scored run. The
 * qualification gate rejects every operand class that makes the evaluator's
 * four plain-`Error` sites reachable, which leaves exactly two data-dependent
 * `RuntimeFault`s: an exhausted regex budget and a non-canonicalizable value.
 */
import { makeResolveOperand } from '../evaluate/evidence-resolution.ts'
import { resolveCheck } from '../evaluate/resolution.ts'
import { makeWitnessPointerDenotesCollection } from '../preflight/witness-evidence.ts'
import type {
	DefectSignature,
	ProbeInputBinding,
} from '../schemas/defect-signature.ts'
import { OBSERVED_STEP_ID } from '../schemas/defect-signature.ts'
import type { Operation, PermittedInterface } from '../schemas/interface.ts'
import { TRANSPORT_CHANNELS } from '../schemas/pointer.ts'
import type { JsonValue } from '../schemas/primitives.ts'
import type { Probe } from '../schemas/probe.ts'
import type {
	Observation,
	SealedRunRecord,
} from '../schemas/sealed-run-record.ts'

import { deepEquals, jsonTypeOf } from './bindings.ts'
import { resolveHomeOperation } from './qualification.ts'

type Finding = SealedRunRecord['findings'][number]
type DefectFinding = Extract<Finding, { findingType: 'defect' }>

/**
 * A module constant, following pre-flight's precedent for the same problem:
 * `resolveCheck`'s budget parameter is a bare required number whose declared
 * home is the scoring policy, and a probe is not scored under a policy at match
 * time. Two implementations choosing two budgets would disagree about when the
 * evaluator reports an exhausted budget, which is the disagreement one shared
 * constant removes.
 */
export const PROBE_REGEX_MATCH_STEP_BUDGET = 1_000_000

/**
 * The six results, declared in the evaluation order the match applies, so a
 * reader cannot mistake this constant for a different ordering.
 *
 * - `unexercised`: the evaluator never invoked the home operation.
 * - `unwitnessed-claim`: a defect finding cited this probe and cited home-operation
 *   observations, none of which satisfies the condition. An AD-32
 *   declared-versus-observed inconsistency, and it outranks a competing
 *   `matched` so a broken reporter cannot mask it.
 * - `matched`: a defect finding cited an observation the condition satisfies.
 * - `manifested-unclaimed`: the condition was satisfied and no finding claimed
 *   it. This is what makes non-detection reachable.
 * - `not-triggered`: the system was examined and did not manifest the seeded
 *   defect. AD-6 calls this the common case on any defect probe. Named for what
 *   it is rather than "not manifested", because AD-40 already uses that phrase
 *   for the vacuous case and the two route to opposite verdicts.
 * - `vacuous`: every candidate resolved insufficient-evidence, so the corpus
 *   presented no defect to detect. A fact about the instrument.
 */
export const PROBE_WITNESS_RESULTS = [
	'unexercised',
	'unwitnessed-claim',
	'matched',
	'manifested-unclaimed',
	'not-triggered',
	'vacuous',
] as const

export type ProbeWitnessResultValue = (typeof PROBE_WITNESS_RESULTS)[number]

/** A probe on the seeding branch whose signature is present. */
export type SignedProbe = Extract<Probe, { expectedClean: false }> & {
	readonly defectSignature: DefectSignature
}

export type WitnessPartition = {
	/** the candidates the condition resolved `true` over. */
	readonly satisfying: readonly string[]
	/** the candidates it resolved `false` over: the system examined and behaving. */
	readonly refuting: readonly string[]
	/** the candidates it could not examine. Never detection, and never manifestation. */
	readonly inconclusive: readonly string[]
}

export type ProbeWitnessMatch = {
	readonly result: ProbeWitnessResultValue
	/**
	 * AD-40 forbids pooling a quotation-reconstructed detection with a measured
	 * catch rate, so every result says which it is. The witness match resolves
	 * over cited identifiers and is always `measured`.
	 */
	readonly basis: 'measured'
	readonly homeOperationResolved: boolean
	readonly exercised: boolean
	/** every candidate identifier the match read, ascending by `sequence`. */
	readonly observationIds: readonly string[]
	readonly partition: WitnessPartition
	readonly partitionSizes: {
		readonly satisfying: number
		readonly refuting: number
		readonly inconclusive: number
	}
	/** the satisfying observations a defect finding actually cited. */
	readonly witnessObservationIds: readonly string[]
	/** the defect findings whose home-operation citations witness nothing. */
	readonly unwitnessedFindingIds: readonly string[]
}

/**
 * Whether one observation's recorded call inputs satisfy the signature's
 * selector, following the shipped contract-side binding filter rather than
 * re-deriving it: the key-presence check binds both admitted members, a `null`
 * observed channel against a non-null binding channel fails, and an
 * indeterminate declared type fails closed because it cannot prove a violation.
 *
 * The declared type comes from the signature's own home operation, since a
 * probe has no interaction plan to index.
 */
function selectorAdmits(
	binding: ProbeInputBinding,
	observation: Observation,
	operation: Operation,
): boolean {
	for (const channel of TRANSPORT_CHANNELS) {
		const channelBinding = binding[channel]
		if (channelBinding === null) continue
		const observed = observation.callInputs[channel]
		if (observed === null) return false
		for (const key of Object.keys(channelBinding)) {
			const value = channelBinding[key]
			if (value === undefined) continue
			if (!Object.hasOwn(observed, key)) return false
			const actual = observed[key] as JsonValue
			if ('literal' in value) {
				if (!deepEquals(actual, value.literal)) return false
				continue
			}
			if (value.matcher === 'any') continue
			const declared = operation.requestShape[channel].types[key]
			if (declared === undefined || declared === null) return false
			if (jsonTypeOf(actual) === declared) return false
		}
	}
	return true
}

// Ascending `sequence`, `observationId` as tiebreak: the same comparator
// `selectObservations` uses, so array position is never read as ordering and a
// permuted record returns byte-identical identifiers in the same order.
const bySequence = (a: Observation, b: Observation): number =>
	a.sequence - b.sequence || (a.observationId < b.observationId ? -1 : 1)

/**
 * Resolves the discriminating condition over one observation through the
 * shipped evaluator, with no adapter: a resolver map holding exactly the one
 * reserved key, this operation's own collection predicate, and the module
 * budget.
 *
 * The map is built fresh per observation and is never merged with a plan's
 * observations. That is what keeps the reserved identifier safe even against a
 * contract that declares a step by the same name, and it is an invariant rather
 * than an accident.
 */
function resolveCondition(
	signature: DefectSignature,
	observation: Observation,
	operation: Operation,
	artifactPath: string,
): 'true' | 'false' | 'insufficient-evidence' {
	return resolveCheck(
		signature.condition.predicate,
		makeResolveOperand({ [OBSERVED_STEP_ID]: observation }, {}),
		makeWitnessPointerDenotesCollection(operation),
		PROBE_REGEX_MATCH_STEP_BUDGET,
		artifactPath,
	).resolution
}

const defectFindingsFor = (
	findings: readonly Finding[],
	probeId: string,
): readonly DefectFinding[] =>
	findings.filter(
		(finding): finding is DefectFinding =>
			finding.findingType === 'defect' && finding.probeId === probeId,
	)

/**
 * AD-40's deterministic witness match over one probe and one sealed run record.
 *
 * The candidates are partitioned by AD-4 resolution into satisfying, refuting,
 * and inconclusive, and the result is read off that partition rather than off a
 * precedence list. A partition is exhaustive and totally ordered over the whole
 * input space; a precedence list left mixed refuting/inconclusive with no home
 * and let an empty candidate set satisfy two rows that route to opposite
 * verdicts.
 *
 * The verdict reads cited identifiers alone and never quotation. Quoted evidence
 * that appears in no cited observation is a separate audit, and its invalidation
 * belongs to ingest.
 *
 * No output reads an array's position. Observation identifiers follow the
 * record's `sequence`; finding identifiers are sorted by identifier, because
 * `findings` carries no ordering field of its own.
 */
export function matchProbeWitness(
	probe: SignedProbe,
	interfaces: readonly PermittedInterface[],
	record: Pick<SealedRunRecord, 'observations' | 'findings'>,
): ProbeWitnessMatch {
	const signature = probe.defectSignature
	const homeOperation = resolveHomeOperation(signature, interfaces)
	const homeOperationResolved = homeOperation !== null
	const onHomeOperation =
		homeOperation === null
			? []
			: record.observations.filter(
					(observation) =>
						observation.operationId === homeOperation.operationId,
				)
	// AD-40's whole exclusion mechanism, and the only one available: an aborted
	// in-flight call never becomes an observation at all, so there is no
	// completion predicate to write, and a "no response channel is set" test
	// would exclude a legitimately sparse completed call while catching nothing.
	// A harness baseline and a fixture set-up call are excluded only where the
	// caller recorded them as `baseline`, which is caller-attested under AD-32
	// and is stated as trust rather than assumed.
	const exercisedObservations = onHomeOperation.filter(
		(observation) => observation.provenance === 'evaluator-chosen',
	)
	const exercised = exercisedObservations.length > 0

	const empty: ProbeWitnessMatch = {
		result: 'unexercised',
		basis: 'measured',
		homeOperationResolved,
		exercised: false,
		observationIds: [],
		partition: { satisfying: [], refuting: [], inconclusive: [] },
		partitionSizes: { satisfying: 0, refuting: 0, inconclusive: 0 },
		witnessObservationIds: [],
		unwitnessedFindingIds: [],
	}
	if (homeOperation === null || !exercised) return empty

	const artifactPath = `Probe[probeId=${probe.probeId}].defectSignature.condition.predicate`
	const candidates = exercisedObservations
		.filter((observation) =>
			selectorAdmits(
				signature.condition.selector.inputBinding,
				observation,
				homeOperation,
			),
		)
		.sort(bySequence)

	const satisfying: string[] = []
	const refuting: string[] = []
	const inconclusive: string[] = []
	for (const candidate of candidates) {
		const resolution = resolveCondition(
			signature,
			candidate,
			homeOperation,
			artifactPath,
		)
		if (resolution === 'true') satisfying.push(candidate.observationId)
		else if (resolution === 'false') refuting.push(candidate.observationId)
		else inconclusive.push(candidate.observationId)
	}

	const satisfyingSet = new Set(satisfying)
	const homeOperationIds = new Set(
		onHomeOperation.map((observation) => observation.observationId),
	)
	const witnessObservationIds: string[] = []
	const unwitnessedFindingIds: string[] = []
	for (const finding of defectFindingsFor(record.findings, probe.probeId)) {
		const citedHome = finding.observationIds.filter((id) =>
			homeOperationIds.has(id),
		)
		// A citation that never touches the home operation is not a claim about
		// this signature at all: it is an unexpected real defect preserved under
		// AD-23, and collapsing the two would invalidate a run over a genuine
		// discovery.
		if (citedHome.length === 0) continue
		const witnesses = citedHome.filter((id) => satisfyingSet.has(id))
		if (witnesses.length === 0) unwitnessedFindingIds.push(finding.findingId)
		else witnessObservationIds.push(...witnesses)
	}
	// Returned in the partition's own ascending order rather than in citation
	// order, and deduplicated: two findings citing one observation witness one
	// observation.
	const witnessIds = satisfying.filter((id) =>
		witnessObservationIds.includes(id),
	)
	// `record.findings` is a bare array with no ordering field, so its position
	// is the same non-meaning `sequence` was added to remove from
	// `observations`. Sorted by identifier, which every finding carries, so a
	// permuted findings array returns byte-identical output here too.
	unwitnessedFindingIds.sort()

	const observationIds = candidates.map(
		(observation) => observation.observationId,
	)
	const partition: WitnessPartition = { satisfying, refuting, inconclusive }
	const shared = {
		basis: 'measured' as const,
		homeOperationResolved,
		exercised: true,
		observationIds,
		partition,
		partitionSizes: {
			satisfying: satisfying.length,
			refuting: refuting.length,
			inconclusive: inconclusive.length,
		},
		witnessObservationIds: witnessIds,
		unwitnessedFindingIds,
	}
	// First match wins, in `PROBE_WITNESS_RESULTS`'s own order. Rows two and
	// three deliberately overlap where one finding cites a satisfying
	// observation while another claims a witness that is not one; that case
	// resolves in the inconsistency's favour, because an invalidating AD-32
	// disagreement must not be masked by a catch on the same probe.
	if (unwitnessedFindingIds.length > 0) {
		return { ...shared, result: 'unwitnessed-claim' }
	}
	if (satisfying.length > 0) {
		return {
			...shared,
			result: witnessIds.length > 0 ? 'matched' : 'manifested-unclaimed',
		}
	}
	// The empty candidate set lands here explicitly rather than being swept into
	// `vacuous` by a universal quantifier that is vacuously true over it: a probe
	// exercised whose selector matched nothing was never triggered. AD-40 backs
	// the split: an insufficient-evidence resolution counts as neither detection
	// nor manifestation, while a `false` resolution is the system examined and
	// behaving.
	if (candidates.length === 0 || refuting.length > 0) {
		return { ...shared, result: 'not-triggered' }
	}
	return { ...shared, result: 'vacuous' }
}

export type MappedFinding = {
	readonly findingId: string
	readonly probeId: string
}

export type FindingMap = {
	/** cited to a signed probe, and touching that signature's home operation. */
	readonly mapped: readonly MappedFinding[]
	/**
	 * cited to a signed probe whose home operation the cited observations never
	 * touch. An unexpected real defect under AD-23, never a catch.
	 */
	readonly unmapped: readonly MappedFinding[]
	/** cited to a probe identifier the set does not declare: an AD-32 cross-artifact dangling reference. */
	readonly dangling: readonly MappedFinding[]
	/** cited to a canary or a clean control, which carry no signature to map against. */
	readonly signatureless: readonly MappedFinding[]
}

/**
 * Sorts every defect finding in the record into the four buckets AD-40 and
 * AD-23 between them require, so no finding is silently dropped and none is
 * counted as a catch it did not earn.
 *
 * Defect findings only: they are the only type that enters a detection measure.
 * The uncited case proper, a finding naming no oracle, is a different rule and
 * a different record.
 */
export function mapFindings(
	probes: readonly Probe[],
	interfaces: readonly PermittedInterface[],
	record: Pick<SealedRunRecord, 'observations' | 'findings'>,
): FindingMap {
	const byProbeId = new Map(probes.map((probe) => [probe.probeId, probe]))
	const operationIdOf = new Map<string, string | null>()
	const mapped: MappedFinding[] = []
	const unmapped: MappedFinding[] = []
	const dangling: MappedFinding[] = []
	const signatureless: MappedFinding[] = []
	const observationOperation = new Map(
		record.observations.map((observation) => [
			observation.observationId,
			observation.operationId,
		]),
	)
	for (const finding of record.findings) {
		if (finding.findingType !== 'defect') continue
		const entry: MappedFinding = {
			findingId: finding.findingId,
			probeId: finding.probeId,
		}
		const probe = byProbeId.get(finding.probeId)
		if (probe === undefined) {
			dangling.push(entry)
			continue
		}
		const signature = probe.expectedClean ? null : probe.defectSignature
		if (signature === null) {
			signatureless.push(entry)
			continue
		}
		if (!operationIdOf.has(probe.probeId)) {
			const operation = resolveHomeOperation(signature, interfaces)
			operationIdOf.set(probe.probeId, operation?.operationId ?? null)
		}
		const homeOperationId = operationIdOf.get(probe.probeId) ?? null
		const touchesHome =
			homeOperationId !== null &&
			finding.observationIds.some(
				(id) => observationOperation.get(id) === homeOperationId,
			)
		if (touchesHome) mapped.push(entry)
		else unmapped.push(entry)
	}
	// Sorted for the same reason `unwitnessedFindingIds` is: a bucket's order
	// would otherwise be `record.findings`'s array position, which carries no
	// meaning and is not a total order the record declares.
	const byFindingId = (a: MappedFinding, b: MappedFinding): number =>
		a.findingId < b.findingId ? -1 : a.findingId > b.findingId ? 1 : 0
	return {
		mapped: mapped.sort(byFindingId),
		unmapped: unmapped.sort(byFindingId),
		dangling: dangling.sort(byFindingId),
		signatureless: signatureless.sort(byFindingId),
	}
}
