/**
 * AD-33's reference decision procedure: the one component that assigns an AD-6
 * outcome state.
 *
 * Pure and total. Every input value returns a defined resolution, nothing
 * throws, and no clock, filesystem, or randomness is read. A `RuntimeFault`
 * raised below propagates undecorated, because AD-28's fault vocabulary and
 * AD-6's state vocabulary are disjoint.
 *
 * Three stages over one input record. Stage A evaluates ten invalidating
 * conditions independently and unions them, so AD-21 receives every condition
 * that fired and a persistent judge fault cannot mask a real regression.
 * Stage B is an ordered first-match ladder of twenty rules producing a
 * provisional state. Stage C adjusts that state for a waiver over a single
 * waivable failure. Corroboration is a fourth ordered table decided after the
 * state, which is how a disposition and a declined citation reach the outcome
 * without deciding one, since AD-3 forbids a check resolution as the source of
 * a state.
 *
 * All four tables are data, so `outcome-table.ts` emits the published decision
 * table from them and a byte-exact drift check compares it against the
 * committed document.
 */
import type {
	CheckResolutionValue,
	CORROBORATION_VALUES,
	OUTCOME_STATES,
} from '../schemas/evidence-artifact.ts'
import type { Polarity } from '../schemas/expression.ts'
import type { Probe } from '../schemas/probe.ts'
import type {
	OracleDisposition,
	SealedRunRecord,
} from '../schemas/sealed-run-record.ts'
import type { StepSelection } from './selection.ts'
import type { FindingMap, ProbeWitnessMatch } from './witness.ts'

type OutcomeStateValue = (typeof OUTCOME_STATES)[number]

type CorroborationValue = (typeof CORROBORATION_VALUES)[number]

/**
 * The four buckets `mapFindings` sorts a defect finding into, each carrying a
 * distinct AD consequence. Keyed on the cited finding's own `probeId`, which
 * is unrelated to whatever probe an outcome row is about.
 */
export const FINDING_BUCKETS = [
	'mapped',
	'unmapped',
	'dangling',
	'signatureless',
] as const satisfies readonly (keyof FindingMap)[]

export type FindingBucketValue = (typeof FINDING_BUCKETS)[number]

/**
 * AD-6 qualifies `not-applicable` by an unexpired waiver satisfying AD-5.
 * Completeness is settled at compile time by `checkWaiverCompleteness`, and
 * `core/score` reads no clock, so both expiry and whether the waiver's opaque
 * context condition was met arrive already decided.
 */
export const WAIVER_STATES = [
	'none',
	'applied-condition-met',
	'applied-condition-unmet',
	'expired',
] as const

export type WaiverStateValue = (typeof WAIVER_STATES)[number]

/**
 * AD-17 names no field for a malformed judge response and `JudgeResult` is
 * keyed by rubric criterion, so conduct arrives per oracle. `absent` is the
 * ordinary value: a contract with no rubric produces no judge call.
 */
export const JUDGE_CONDUCT_STATES = [
	'absent',
	'conforming',
	'malformed',
] as const

export type JudgeConductValue = (typeof JUDGE_CONDUCT_STATES)[number]

/** The defect finding whose `oracleId` is this oracle, with its bucket. */
export type CitedFinding = {
	readonly findingId: string
	readonly bucket: FindingBucketValue
}

/**
 * The fifteen declared inputs. The upstream records travel whole, so the
 * resolution can return the finding it resolved from and the observation
 * identifiers it read, which is what AD-33 records on the outcome.
 *
 * `disposition` is the whole record, because Stage A and the corroboration
 * rules read its `observationIds`.
 *
 * `probeSigned` is the one field no rule reads. It is declared because the
 * published table states the relation AD-40 fixes between a signature and a
 * witness, and a caller assembling a row from a probe already holds it.
 */
export type OutcomeInputs = {
	readonly required: boolean
	readonly disposition: OracleDisposition | null
	readonly citedFinding: CitedFinding | null
	readonly witness: ProbeWitnessMatch | null
	readonly selections: readonly StepSelection[]
	readonly selectorAmbiguity: boolean
	readonly checkResolution: CheckResolutionValue['resolution'] | null
	readonly polarity: Polarity
	readonly probeClass: Probe['probeClass'] | null
	readonly expectedClean: boolean | null
	readonly probeSigned: boolean | null
	readonly probeQualified: boolean | null
	readonly waiver: WaiverStateValue
	readonly judgeConduct: JudgeConductValue
	readonly evaluationFault: boolean
}

export type OutcomeResolution = {
	readonly rule: OutcomeRuleId
	readonly waiverRule: WaiverRuleId | null
	readonly corroborationRule: CorroborationRuleId
	readonly state: OutcomeStateValue
	readonly corroboration: CorroborationValue
	readonly resolvedFrom: string | null
	readonly selectedObservationIds: readonly string[]
	/** an `unmapped` or `signatureless` citation the state declined to resolve from. */
	readonly declinedFindingIds: readonly string[]
	readonly invalidatingConditions: readonly InvalidatingCondition[]
}

const witnessResultOf = (
	inputs: OutcomeInputs,
): ProbeWitnessMatch['result'] | null =>
	inputs.witness === null ? null : inputs.witness.result

const witnessIs = (
	inputs: OutcomeInputs,
	result: ProbeWitnessMatch['result'],
): boolean => witnessResultOf(inputs) === result

/** whether a defect finding cites this oracle. */
const citesDefect = (inputs: OutcomeInputs): boolean =>
	inputs.citedFinding !== null

const bucketOf = (inputs: OutcomeInputs): FindingBucketValue | null =>
	inputs.citedFinding === null ? null : inputs.citedFinding.bucket

const probeUnqualified = (inputs: OutcomeInputs): boolean =>
	inputs.probeClass !== null && inputs.probeQualified === false

const someSelectionResolved = (inputs: OutcomeInputs): boolean =>
	inputs.selections.some((selection) => selection.result !== 'none')

/** `true` under `expects-hold`, `false` under `expects-violation`. AD-4 makes `insufficient-evidence` terminal, and a `null` resolution never ran, so neither value satisfies and neither fails. */
const checkSatisfied = (inputs: OutcomeInputs): boolean =>
	inputs.checkResolution ===
	(inputs.polarity === 'expects-hold' ? 'true' : 'false')

const checkExaminedNothing = (inputs: OutcomeInputs): boolean =>
	inputs.checkResolution === 'insufficient-evidence'

const dispositionUnsupported = (inputs: OutcomeInputs): boolean => {
	const disposition = inputs.disposition
	return (
		disposition !== null &&
		disposition.observationIds.length === 0 &&
		(disposition.disposition === 'held' ||
			disposition.disposition === 'violated')
	)
}

/**
 * `violated` with no defect finding, `held` with one, or `not-attempted` with
 * one. A `not-attempted` citing observations is well supported: those are the
 * observations showing why the evaluator could not proceed. Its contradiction
 * is a defect finding filed against the same oracle.
 */
const dispositionContradictsEvidence = (inputs: OutcomeInputs): boolean => {
	const disposition = inputs.disposition
	if (disposition === null) return false
	const cited = citesDefect(inputs)
	if (disposition.disposition === 'violated') return !cited
	return cited
}

const citationDeclined = (inputs: OutcomeInputs): boolean => {
	const bucket = bucketOf(inputs)
	return bucket === 'unmapped' || bucket === 'signatureless'
}

/**
 * A canary carries no signature, so it has no witness and step reachability is
 * the only proxy for whether the evaluator took the path. AD-33 names
 * punishing a contract for the evaluator's path choice as an anti-goal, so the
 * condition and its ladder row share this guard.
 */
const canaryUndetected = (inputs: OutcomeInputs): boolean =>
	inputs.probeClass === 'canary' &&
	someSelectionResolved(inputs) &&
	!citesDefect(inputs)

type ConditionRow = {
	readonly id: string
	readonly guard: string
	readonly holds: (inputs: OutcomeInputs) => boolean
}

/**
 * Stage A. Ten predicates evaluated independently of the state ladder, so a
 * condition is never masked by another that fired first. Every one that holds
 * is returned.
 *
 * Nine reach AD-21's Invalid rung through an AD-6 invalidating state or, for
 * `disposition-missing`, by name. `unsupported-disposition` produces no state
 * and is not in that enumeration; the half enforced here is the corroboration,
 * which is AD-33's own requirement that an unsupported disposition invalidates
 * cross-artifact agreement.
 */
export const INVALIDATING_CONDITIONS = [
	{
		id: 'evaluation-fault',
		guard: 'an AD-26 evaluation fault was recorded',
		holds: (inputs) => inputs.evaluationFault,
	},
	{
		id: 'judge-malformed',
		guard: 'judge conduct `malformed`',
		holds: (inputs) => inputs.judgeConduct === 'malformed',
	},
	{
		id: 'unqualified-probe-in-sealed-set',
		guard: 'a probe is present and its qualification failed',
		holds: probeUnqualified,
	},
	{
		id: 'dangling-probe-citation',
		guard: "the cited finding's bucket is `dangling`",
		holds: (inputs) => bucketOf(inputs) === 'dangling',
	},
	{
		id: 'unwitnessed-detection-claim',
		guard: 'witness result `unwitnessed-claim`',
		holds: (inputs) => witnessIs(inputs, 'unwitnessed-claim'),
	},
	{
		id: 'vacuous-signature',
		guard: 'witness result `vacuous`',
		holds: (inputs) => witnessIs(inputs, 'vacuous'),
	},
	{
		id: 'selector-ambiguity',
		guard:
			'a step matched several observations under a single-valued cardinality',
		holds: (inputs) => inputs.selectorAmbiguity,
	},
	{
		id: 'canary-non-detection',
		guard:
			'class `canary`, some selection resolved other than `none`, and no defect finding cites the oracle',
		holds: canaryUndetected,
	},
	{
		id: 'unsupported-disposition',
		guard:
			'the disposition is `held` or `violated` with empty `observationIds`',
		holds: dispositionUnsupported,
	},
	{
		id: 'disposition-missing',
		guard: 'the oracle is required and its disposition is `null`',
		holds: (inputs) => inputs.required && inputs.disposition === null,
	},
] as const satisfies readonly ConditionRow[]

export type InvalidatingCondition =
	(typeof INVALIDATING_CONDITIONS)[number]['id']

/**
 * Row 9. The witness conjunct keeps an unmatched selection from deleting a
 * witnessed detection, and admits `not-triggered`, the one witness value
 * carrying no detection to protect. The length conjunct keeps an oracle that
 * declared no step out, since AD-6 scopes `unreached` to declared steps and
 * `every` is vacuous over an empty array.
 */
const stepsUnreached = (inputs: OutcomeInputs): boolean =>
	(inputs.witness === null || witnessIs(inputs, 'not-triggered')) &&
	inputs.selections.length > 0 &&
	inputs.selections.every((selection) => selection.result === 'none')

/** AD-33's first fixed cell. A `zero-action` probe on the seeding branch seeds a defect whose correct behaviour is refusal, so "satisfied" is the signature manifesting and a finding witnessing it, which is `matched`. */
const zeroActionDetected = (inputs: OutcomeInputs): boolean =>
	inputs.probeClass === 'zero-action' &&
	inputs.expectedClean === false &&
	witnessIs(inputs, 'matched')

const cleanControlFalsePositive = (inputs: OutcomeInputs): boolean =>
	inputs.expectedClean === true && citesDefect(inputs)

/**
 * A clean control whose check examined nothing falls past this row to the
 * abstention row: AD-4 makes `insufficient-evidence` terminal and AD-6 lands
 * it on `abstained`, so a build cannot pass green on an oracle that examined
 * an empty collection. The false-positive row stays above both; a filed
 * finding survives a check that examined nothing.
 */
const cleanControlPassed = (inputs: OutcomeInputs): boolean =>
	inputs.expectedClean === true && !checkExaminedNothing(inputs)

const canaryDetected = (inputs: OutcomeInputs): boolean =>
	inputs.probeClass === 'canary' && citesDefect(inputs)

/**
 * The three witness rows above the clean-control pair each carry
 * `expectedClean`, so AD-9's legal states for a clean control hold over the
 * whole input type, beyond the tuples the qualification gate can produce. The
 * unexercised row carries the guard for its own reason: AD-6 legalises
 * `not-applicable` for a probe AD-40 records as unexercised, and a clean
 * control carries no signature, so AD-40 records nothing about it.
 */
const witnessUnexercised = (inputs: OutcomeInputs): boolean =>
	witnessIs(inputs, 'unexercised') && inputs.expectedClean !== true

const witnessMatched = (inputs: OutcomeInputs): boolean =>
	witnessIs(inputs, 'matched') && inputs.expectedClean !== true

const witnessManifestedUnclaimed = (inputs: OutcomeInputs): boolean =>
	witnessIs(inputs, 'manifested-unclaimed') && inputs.expectedClean !== true

/**
 * On a witness-free oracle, `mapped` is the one bucket that resolves `caught`.
 * AD-40 calls an unmapped finding an unexpected real defect and keeps it out
 * of every catch.
 */
const oracleCitedDefect = (inputs: OutcomeInputs): boolean =>
	inputs.witness === null && bucketOf(inputs) === 'mapped'

/** Row 20's guard, written out as the negation of every guard above it. */
const outcomeClear = (inputs: OutcomeInputs): boolean =>
	!inputs.evaluationFault &&
	inputs.judgeConduct !== 'malformed' &&
	!probeUnqualified(inputs) &&
	bucketOf(inputs) !== 'dangling' &&
	!witnessIs(inputs, 'unwitnessed-claim') &&
	!witnessIs(inputs, 'vacuous') &&
	!inputs.selectorAmbiguity &&
	!witnessUnexercised(inputs) &&
	!stepsUnreached(inputs) &&
	!zeroActionDetected(inputs) &&
	!cleanControlFalsePositive(inputs) &&
	!cleanControlPassed(inputs) &&
	!canaryDetected(inputs) &&
	!canaryUndetected(inputs) &&
	!witnessMatched(inputs) &&
	!witnessManifestedUnclaimed(inputs) &&
	!oracleCitedDefect(inputs) &&
	!checkExaminedNothing(inputs) &&
	!witnessIs(inputs, 'not-triggered')

type LadderRow = {
	readonly id: string
	readonly guard: string
	readonly state: OutcomeStateValue
	/** whether the row read the cited finding to reach its state. */
	readonly resolvesFromCitation: boolean
	readonly holds: (inputs: OutcomeInputs) => boolean
}

/**
 * Stage B. First match wins; the identifier of the row that fired is
 * returned.
 *
 * Rows 5, 6, 8, 15, 16, and 19 consume all six witness results, so anything
 * reaching row 20 carries no witness. Rows 9 and 18 each take a subset of an
 * earlier row's domain without widening it, which is why the witness rows are
 * not contiguous. Rows 13 and 14 are deliberately not total over `canary`: an
 * undetected canary that matched no selection falls past both and lands on row
 * 18 or row 20 unless row 9 took it.
 *
 * Rows 10 and 15 overlap on a `zero-action` probe with a `matched` witness.
 * Row 10 is kept so AD-33's first fixed cell has a line of its own in the
 * emitted table.
 */
export const OUTCOME_RULES = [
	{
		id: 'evaluation-fault',
		guard: 'an AD-26 evaluation fault was recorded',
		state: 'oracle-error',
		resolvesFromCitation: false,
		holds: (inputs) => inputs.evaluationFault,
	},
	{
		id: 'judge-malformed',
		guard: 'judge conduct `malformed`',
		state: 'judge-error',
		resolvesFromCitation: false,
		holds: (inputs) => inputs.judgeConduct === 'malformed',
	},
	{
		id: 'probe-unqualified',
		guard: 'a probe is present and its qualification failed',
		state: 'infrastructure-error',
		resolvesFromCitation: false,
		holds: probeUnqualified,
	},
	{
		id: 'finding-dangling-probe',
		guard: "the cited finding's bucket is `dangling`",
		state: 'infrastructure-error',
		resolvesFromCitation: true,
		holds: (inputs) => bucketOf(inputs) === 'dangling',
	},
	{
		id: 'witness-unwitnessed-claim',
		guard: 'witness result `unwitnessed-claim`',
		state: 'infrastructure-error',
		resolvesFromCitation: false,
		holds: (inputs) => witnessIs(inputs, 'unwitnessed-claim'),
	},
	{
		id: 'witness-vacuous',
		guard: 'witness result `vacuous`',
		state: 'infrastructure-error',
		resolvesFromCitation: false,
		holds: (inputs) => witnessIs(inputs, 'vacuous'),
	},
	{
		id: 'selector-ambiguous',
		guard:
			'a step matched several observations under a single-valued cardinality',
		state: 'infrastructure-error',
		resolvesFromCitation: false,
		holds: (inputs) => inputs.selectorAmbiguity,
	},
	{
		id: 'witness-unexercised',
		guard:
			'witness result `unexercised` on a probe outside the `expectedClean` branch',
		state: 'not-applicable',
		resolvesFromCitation: false,
		holds: witnessUnexercised,
	},
	{
		id: 'steps-unreached',
		guard:
			'no witness or witness result `not-triggered`; `selections` non-empty; every member resolved `none`',
		state: 'unreached',
		resolvesFromCitation: false,
		holds: stepsUnreached,
	},
	{
		id: 'zero-action-detected',
		guard:
			'class `zero-action` on the seeding branch with witness result `matched`',
		state: 'caught',
		resolvesFromCitation: false,
		holds: zeroActionDetected,
	},
	{
		id: 'clean-control-false-positive',
		guard: '`expectedClean` and a defect finding cites the oracle',
		state: 'false-positive',
		resolvesFromCitation: true,
		holds: cleanControlFalsePositive,
	},
	{
		id: 'clean-control-passed',
		guard:
			'`expectedClean` and the check root did not resolve `insufficient-evidence`',
		state: 'passed-clean-control',
		resolvesFromCitation: false,
		holds: cleanControlPassed,
	},
	{
		id: 'canary-detected',
		guard: 'class `canary` and a defect finding cites the oracle',
		state: 'caught',
		resolvesFromCitation: true,
		holds: canaryDetected,
	},
	{
		id: 'canary-undetected',
		guard:
			'class `canary`, some selection resolved other than `none`, and no defect finding cites the oracle',
		state: 'infrastructure-error',
		resolvesFromCitation: false,
		holds: canaryUndetected,
	},
	{
		id: 'witness-matched',
		guard:
			'witness result `matched` on a probe outside the `expectedClean` branch',
		state: 'caught',
		resolvesFromCitation: false,
		holds: witnessMatched,
	},
	{
		id: 'witness-manifested-unclaimed',
		guard:
			'witness result `manifested-unclaimed` on a probe outside the `expectedClean` branch',
		state: 'missed',
		resolvesFromCitation: false,
		holds: witnessManifestedUnclaimed,
	},
	{
		id: 'oracle-cited-defect',
		guard: "no witness and the cited finding's bucket is `mapped`",
		state: 'caught',
		resolvesFromCitation: true,
		holds: oracleCitedDefect,
	},
	{
		id: 'check-insufficient-evidence',
		guard: 'the check root resolved `insufficient-evidence`',
		state: 'abstained',
		resolvesFromCitation: false,
		holds: checkExaminedNothing,
	},
	{
		id: 'witness-not-triggered',
		guard: 'witness result `not-triggered`',
		state: 'confirmed',
		resolvesFromCitation: false,
		holds: (inputs) => witnessIs(inputs, 'not-triggered'),
	},
	{
		id: 'outcome-clear',
		guard: 'the stated negation of every guard above',
		state: 'confirmed',
		resolvesFromCitation: false,
		holds: outcomeClear,
	},
] as const satisfies readonly LadderRow[]

export type OutcomeRuleId = (typeof OUTCOME_RULES)[number]['id']

/**
 * A waiver excuses a known gap, and `missed` is the only gap here.
 * `false-positive` is a clean control's own calibration; `abstained` is an
 * unknown. AD-7 counts every exercised probe in its denominator, so a waiver
 * honoured over a `matched` witness would depress the catch rate.
 */
export const WAIVABLE_FAILURES = [
	'missed',
] as const satisfies readonly OutcomeStateValue[]

const isWaivable = (state: OutcomeStateValue): boolean =>
	WAIVABLE_FAILURES.some((waivable) => waivable === state)

type WaiverRow = {
	readonly id: string
	readonly guard: string
	readonly state: OutcomeStateValue
	readonly holds: (
		inputs: OutcomeInputs,
		provisional: OutcomeStateValue,
	) => boolean
}

/**
 * Neither rule fires on `none` or `expired`, which is AD-21's expired waiver
 * reinstating its gap. `bypassed` is a gap excused without earning the excuse,
 * which is the group AD-6 puts it in and the only firing condition the AD
 * gives it anywhere.
 */
export const WAIVER_RULES = [
	{
		id: 'waiver-honoured',
		guard: 'waiver `applied-condition-met` over a waivable failure',
		state: 'not-applicable',
		holds: (inputs, provisional) =>
			inputs.waiver === 'applied-condition-met' && isWaivable(provisional),
	},
	{
		id: 'waiver-bypassed',
		guard: 'waiver `applied-condition-unmet` over a waivable failure',
		state: 'bypassed',
		holds: (inputs, provisional) =>
			inputs.waiver === 'applied-condition-unmet' && isWaivable(provisional),
	},
] as const satisfies readonly WaiverRow[]

export type WaiverRuleId = (typeof WAIVER_RULES)[number]['id']

type CorroborationRow = {
	readonly id: string
	readonly guard: string
	/** the Value column the emitted document prints. */
	readonly value: string
	readonly holds: (inputs: OutcomeInputs, state: OutcomeStateValue) => boolean
	readonly corroboration: (inputs: OutcomeInputs) => CorroborationValue
}

/**
 * The corroboration table, decided after the final state. First match wins and
 * no row is an `otherwise`.
 *
 * The order carries three obligations. Rows 1 to 3 sit above both
 * check-derived rows so a disposition and a declined citation are not
 * believed. Row 4 sits above row 5 so a check that resolved
 * `insufficient-evidence` never records `not-evaluable`, which AD-33 forbids
 * and which row 9 of the ladder makes reachable. Rows 6, 7, and 8 partition
 * satisfaction against citation, so the table is total.
 *
 * A `disagrees` is diagnostic and moves nothing on its own, and it carries the
 * whole cost of the tail collapsing to `confirmed`. Row 3 is where an
 * `unmapped` or `signatureless` citation records that the evaluator and the
 * oracle are pointing at different defects.
 *
 * Row 5 widens AD-33's `not-evaluable` from unreached steps to any `null` root
 * resolution, which is the same condition reached by a second route: an oracle
 * whose `check` is `null`, half of what `oracle-missing-channel` fires on.
 */
export const CORROBORATION_RULES = [
	{
		id: 'disposition-unsupported',
		guard:
			'the disposition is `held` or `violated` with empty `observationIds`',
		value: '`disagrees`',
		holds: dispositionUnsupported,
		corroboration: () => 'disagrees',
	},
	{
		id: 'disposition-contradicts-evidence',
		guard:
			'`violated` with no defect finding, `held` with one, or `not-attempted` with one',
		value: '`disagrees`',
		holds: dispositionContradictsEvidence,
		corroboration: () => 'disagrees',
	},
	{
		id: 'citation-declined',
		guard: "the cited finding's bucket is `unmapped` or `signatureless`",
		value: '`disagrees`',
		holds: citationDeclined,
		corroboration: () => 'disagrees',
	},
	{
		id: 'examined-nothing',
		guard: 'the check root resolved `insufficient-evidence`',
		value:
			'`disagrees` where a defect finding cited the oracle, `agrees` where none did',
		holds: checkExaminedNothing,
		corroboration: (inputs) => (citesDefect(inputs) ? 'disagrees' : 'agrees'),
	},
	{
		id: 'never-ran',
		guard:
			'the final state is `unreached`, or the check root resolution is `null`',
		value: '`not-evaluable`',
		holds: (inputs, state) =>
			state === 'unreached' || inputs.checkResolution === null,
		corroboration: () => 'not-evaluable',
	},
	{
		id: 'check-confirms-silence',
		guard: 'the check satisfies and no defect finding cited the oracle',
		value: '`agrees`',
		holds: (inputs) => checkSatisfied(inputs) && !citesDefect(inputs),
		corroboration: () => 'agrees',
	},
	{
		id: 'check-confirms-finding',
		guard: 'the check does not satisfy and a defect finding cited the oracle',
		value: '`agrees`',
		holds: (inputs) => !checkSatisfied(inputs) && citesDefect(inputs),
		corroboration: () => 'agrees',
	},
	{
		id: 'check-and-findings-diverge',
		guard:
			'the check satisfies with a finding cited, or does not satisfy with none',
		value: '`disagrees`',
		holds: (inputs) => checkSatisfied(inputs) === citesDefect(inputs),
		corroboration: () => 'disagrees',
	},
] as const satisfies readonly CorroborationRow[]

export type CorroborationRuleId = (typeof CORROBORATION_RULES)[number]['id']

/**
 * The identifiers the outcome records: each selection's matches in the array
 * order of `selections`, then the witness's candidates, deduplicated and
 * keeping first appearance.
 *
 * A step selects on its own operation and the witness on the signature's home
 * operation, so neither list contains the other. Each is already ascending
 * under the same total comparator, which makes the concatenation deterministic
 * and stable under a permutation of the record's observations, as owed item 2
 * requires. One ascending order over both would need the observations
 * themselves among the inputs.
 */
const selectedObservationIdsOf = (inputs: OutcomeInputs): readonly string[] => {
	const selected: string[] = []
	const seen = new Set<string>()
	const take = (ids: readonly string[]): void => {
		for (const id of ids) {
			if (seen.has(id)) continue
			seen.add(id)
			selected.push(id)
		}
	}
	for (const selection of inputs.selections)
		take(selection.matchedObservationIds)
	if (inputs.witness !== null) take(inputs.witness.observationIds)
	return selected
}

const byIdentifier = (left: string, right: string): number =>
	left < right ? -1 : left > right ? 1 : 0

/**
 * AD-33's total reference decision procedure. One AD-6 state, one
 * corroboration value, the rules that produced them, and the evidence the
 * resolution read.
 */
export function resolveOutcome(inputs: OutcomeInputs): OutcomeResolution {
	const invalidatingConditions = INVALIDATING_CONDITIONS.filter((condition) =>
		condition.holds(inputs),
	)
		.map((condition) => condition.id)
		.sort(byIdentifier)
	// Total: row 20's guard is the negation of every guard above it.
	const rule = OUTCOME_RULES.find((candidate) => candidate.holds(inputs))!
	const waiverRule =
		WAIVER_RULES.find((candidate) => candidate.holds(inputs, rule.state)) ??
		null
	const state = waiverRule === null ? rule.state : waiverRule.state
	// Total: rows 6, 7, and 8 partition satisfaction against citation.
	const corroborationRule = CORROBORATION_RULES.find((candidate) =>
		candidate.holds(inputs, state),
	)!
	const cited = inputs.citedFinding
	const resolvedFrom =
		cited !== null && rule.resolvesFromCitation ? cited.findingId : null
	const declined =
		cited !== null && !rule.resolvesFromCitation && citationDeclined(inputs)
	return {
		rule: rule.id,
		waiverRule: waiverRule === null ? null : waiverRule.id,
		corroborationRule: corroborationRule.id,
		state,
		corroboration: corroborationRule.corroboration(inputs),
		resolvedFrom,
		selectedObservationIds: selectedObservationIdsOf(inputs),
		declinedFindingIds: declined ? [cited.findingId] : [],
		invalidatingConditions,
	}
}

/**
 * The findings citing no oracle. AD-33 keeps them: discarding one would hide
 * the evaluator-chosen detection AD-23 exists to preserve. Named apart from
 * the artifact's own `uncitedFindings` field so the two do not collide, and
 * covering every finding type, since AD-23's carve-out is about the oracle
 * citation.
 */
export function uncitedFindingIds(
	record: Pick<SealedRunRecord, 'findings'>,
): readonly string[] {
	return record.findings
		.filter((finding) => finding.oracleId === null)
		.map((finding) => finding.findingId)
		.sort(byIdentifier)
}
