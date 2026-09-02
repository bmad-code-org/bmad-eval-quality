/**
 * The fixture set AD-33's decision procedure is exercised against.
 *
 * AD-33 establishes that a hand-written cell per input tuple is out of reach,
 * so the declared domains are covered pairwise by a deterministic covering
 * array, with named cases added for each rule, each condition, each state and
 * its near miss, and the two worked fixtures. Deterministic by construction:
 * no clock, no `Math.random`, no filesystem, so the generated document is
 * byte-stable.
 *
 * The seven structural constraints are named implications the shipped
 * qualification gate and the declared schemas already hold. Each leaves its
 * offending tuple representable and resolvable: the four `cannot-qualify`
 * constraints route their tuple to the unqualified-probe rule, since the gate
 * that names them sets `probeQualified: false`, while the other three describe
 * what the upstream records can carry and a tuple violating one still
 * resolves. The seven model the input space; they filter nothing out of it.
 */

import type { OracleDisposition } from '../../../src/core/schemas/sealed-run-record.ts'
import type {
	CitedFinding,
	OutcomeInputs,
} from '../../../src/core/score/outcome.ts'
import { FINDING_BUCKETS } from '../../../src/core/score/outcome.ts'
import type { InfeasiblePair } from '../../../src/core/score/outcome-table.ts'
import type { StepSelection } from '../../../src/core/score/selection.ts'
import type { ProbeWitnessMatch } from '../../../src/core/score/witness.ts'
import { PROBE_WITNESS_RESULTS } from '../../../src/core/score/witness.ts'

const ORACLE_ID = 'oracle-under-test'

export const dispositionOf = (
	value: OracleDisposition['disposition'],
	observationIds: readonly string[],
): OracleDisposition => ({
	oracleId: ORACLE_ID,
	disposition: value,
	observationIds: [...observationIds],
	note: null,
})

/**
 * A match the shipped `matchProbeWitness` could have returned. The procedure
 * reads `result` and `observationIds`, and the other seven are kept consistent
 * with them: an `unexercised` match read no candidate at all, and every other
 * result partitions the two candidates it read. `observationIds` overlaps the
 * `several` selection's matches, so the identifier concatenation has a
 * duplicate to drop.
 */
export const witnessOf = (
	result: ProbeWitnessMatch['result'],
): ProbeWitnessMatch => {
	if (result === 'unexercised') {
		return {
			result,
			basis: 'measured',
			homeOperationResolved: true,
			exercised: false,
			observationIds: [],
			partition: { satisfying: [], refuting: [], inconclusive: [] },
			partitionSizes: { satisfying: 0, refuting: 0, inconclusive: 0 },
			witnessObservationIds: [],
			unwitnessedFindingIds: [],
		}
	}
	const candidates = ['obs-2', 'obs-w1']
	const satisfying =
		result === 'matched' || result === 'manifested-unclaimed' ? candidates : []
	const inconclusive = result === 'vacuous' ? candidates : []
	const refuting =
		satisfying.length === 0 && inconclusive.length === 0 ? candidates : []
	return {
		result,
		basis: 'measured',
		homeOperationResolved: true,
		exercised: true,
		observationIds: candidates,
		partition: { satisfying, refuting, inconclusive },
		partitionSizes: {
			satisfying: satisfying.length,
			refuting: refuting.length,
			inconclusive: inconclusive.length,
		},
		witnessObservationIds: result === 'matched' ? ['obs-2'] : [],
		unwitnessedFindingIds:
			result === 'unwitnessed-claim' ? ['finding-unwitnessed'] : [],
	}
}

export const selectionOf = (
	result: StepSelection['result'],
	matchedObservationIds: readonly string[],
): StepSelection => ({ result, matchedObservationIds })

export const NONE = selectionOf('none', [])
export const ONE = selectionOf('one', ['obs-1'])
export const SEVERAL = selectionOf('several', ['obs-2', 'obs-3'])

export const citationOf = (bucket: CitedFinding['bucket']): CitedFinding => ({
	findingId: `finding-${bucket}`,
	bucket,
})

type FieldName = keyof OutcomeInputs

type DomainValue<K extends FieldName> = {
	readonly label: string
	readonly value: OutcomeInputs[K]
}

type InputDomains = {
	readonly [K in FieldName]: readonly DomainValue<K>[]
}

/**
 * Fifty-seven values across fifteen fields. The first value of every field is
 * the neutral one, so a tuple built from the defaults fires no rule above the
 * ladder's final row.
 */
export const INPUT_DOMAINS: InputDomains = {
	required: [
		{ label: 'false', value: false },
		{ label: 'true', value: true },
	],
	disposition: [
		{ label: 'null', value: null },
		{ label: 'held-supported', value: dispositionOf('held', ['obs-1']) },
		{ label: 'held-unsupported', value: dispositionOf('held', []) },
		{
			label: 'violated-supported',
			value: dispositionOf('violated', ['obs-1']),
		},
		{ label: 'violated-unsupported', value: dispositionOf('violated', []) },
		{
			label: 'not-attempted-supported',
			value: dispositionOf('not-attempted', ['obs-1']),
		},
		{
			label: 'not-attempted-unsupported',
			value: dispositionOf('not-attempted', []),
		},
	],
	citedFinding: [
		{ label: 'null', value: null },
		...FINDING_BUCKETS.map((bucket) => ({
			label: bucket,
			value: citationOf(bucket),
		})),
	],
	witness: [
		{ label: 'null', value: null },
		...PROBE_WITNESS_RESULTS.map((result) => ({
			label: result,
			value: witnessOf(result),
		})),
	],
	selections: [
		{ label: 'empty', value: [] },
		{ label: 'none', value: [NONE] },
		{ label: 'one', value: [ONE] },
		{ label: 'none-and-one', value: [NONE, ONE] },
		{ label: 'several', value: [SEVERAL] },
	],
	selectorAmbiguity: [
		{ label: 'false', value: false },
		{ label: 'true', value: true },
	],
	checkResolution: [
		{ label: 'true', value: 'true' },
		{ label: 'false', value: 'false' },
		{ label: 'insufficient-evidence', value: 'insufficient-evidence' },
		{ label: 'null', value: null },
	],
	polarity: [
		{ label: 'expects-hold', value: 'expects-hold' },
		{ label: 'expects-violation', value: 'expects-violation' },
	],
	probeClass: [
		{ label: 'null', value: null },
		{ label: 'defect', value: 'defect' },
		{ label: 'gameability', value: 'gameability' },
		{ label: 'zero-action', value: 'zero-action' },
		{ label: 'canary', value: 'canary' },
	],
	expectedClean: [
		{ label: 'null', value: null },
		{ label: 'false', value: false },
		{ label: 'true', value: true },
	],
	probeSigned: [
		{ label: 'null', value: null },
		{ label: 'false', value: false },
		{ label: 'true', value: true },
	],
	probeQualified: [
		{ label: 'null', value: null },
		{ label: 'false', value: false },
		{ label: 'true', value: true },
	],
	waiver: [
		{ label: 'none', value: 'none' },
		{ label: 'applied-condition-met', value: 'applied-condition-met' },
		{ label: 'applied-condition-unmet', value: 'applied-condition-unmet' },
		{ label: 'expired', value: 'expired' },
	],
	judgeConduct: [
		{ label: 'absent', value: 'absent' },
		{ label: 'conforming', value: 'conforming' },
		{ label: 'malformed', value: 'malformed' },
	],
	evaluationFault: [
		{ label: 'false', value: false },
		{ label: 'true', value: true },
	],
}

/** Declaration order, which the covering array and the emitted labels follow. */
export const INPUT_FIELDS = [
	'required',
	'disposition',
	'citedFinding',
	'witness',
	'selections',
	'selectorAmbiguity',
	'checkResolution',
	'polarity',
	'probeClass',
	'expectedClean',
	'probeSigned',
	'probeQualified',
	'waiver',
	'judgeConduct',
	'evaluationFault',
] as const satisfies readonly FieldName[]

/** The fields the seven constraints read. Every other field is free. */
export const CONSTRAINED_FIELDS = [
	'probeClass',
	'expectedClean',
	'probeSigned',
	'probeQualified',
	'witness',
	'selectorAmbiguity',
	'selections',
] as const satisfies readonly FieldName[]

const isConstrained = (field: FieldName): boolean =>
	CONSTRAINED_FIELDS.some((constrained) => constrained === field)

export type StructuralConstraintCase = {
	readonly id: string
	readonly implication: string
	readonly holds: (inputs: OutcomeInputs) => boolean
}

export const STRUCTURAL_CONSTRAINTS = [
	{
		id: 'class-and-control-travel-together',
		implication:
			'`expectedClean`, `probeSigned`, and `probeQualified` are non-`null` exactly where `probeClass` is, since with no probe there is no qualification result',
		holds: (inputs) => {
			const present = inputs.probeClass !== null
			return (
				(inputs.expectedClean !== null) === present &&
				(inputs.probeSigned !== null) === present &&
				(inputs.probeQualified !== null) === present
			)
		},
	},
	{
		id: 'clean-control-carries-no-signature',
		implication:
			'`expectedClean` implies `probeSigned` is `false`, because the clean-control branch carries no signature key at all',
		holds: (inputs) =>
			inputs.expectedClean !== true || inputs.probeSigned === false,
	},
	{
		id: 'witness-requires-a-signature',
		implication:
			'a witness result exists only where `probeSigned` holds and `expectedClean` does not, which is the signed-probe shape AD-40 matches against and which admits a signed canary, and it always exists where that probe also qualified. The one gap is the unqualified signed probe, which can reach a scorer that performed no match, so a signed seeding probe carrying no witness stays representable exactly where its qualification failed',
		holds: (inputs) => {
			const signedSeeding =
				inputs.probeSigned === true && inputs.expectedClean === false
			if (inputs.witness !== null) return signedSeeding
			return !(signedSeeding && inputs.probeQualified === true)
		},
	},
	{
		id: 'signed-canary-cannot-qualify',
		implication:
			'a signed canary fails qualification under `signature-present-on-canary`',
		holds: (inputs) =>
			!(inputs.probeSigned === true && inputs.probeClass === 'canary') ||
			inputs.probeQualified === false,
	},
	{
		id: 'unsigned-non-canary-cannot-qualify',
		implication:
			'an unsigned non-canary on the seeding branch fails qualification under `signature-absent`',
		holds: (inputs) =>
			!(
				inputs.probeSigned === false &&
				inputs.expectedClean === false &&
				inputs.probeClass !== 'canary'
			) || inputs.probeQualified === false,
	},
	{
		id: 'illegal-control-pairing-cannot-qualify',
		implication:
			'a clean control outside class `zero-action` fails qualification, because the admissible-route list is empty for those three pairings',
		holds: (inputs) =>
			!(inputs.expectedClean === true && inputs.probeClass !== 'zero-action') ||
			inputs.probeQualified === false,
	},
	{
		id: 'ambiguity-requires-several',
		implication:
			"`selectorAmbiguity` implies some member of `selections` resolved `several`. The field is an aggregate over the oracle's own declared steps, and the shipped predicate it mirrors reads `several` under a non-`any` cardinality on one step",
		holds: (inputs) =>
			!inputs.selectorAmbiguity ||
			inputs.selections.some((selection) => selection.result === 'several'),
	},
] as const satisfies readonly StructuralConstraintCase[]

export const satisfiesConstraints = (inputs: OutcomeInputs): boolean =>
	STRUCTURAL_CONSTRAINTS.every((constraint) => constraint.holds(inputs))

type Indices = Record<FieldName, number>

const domainValueOf = <K extends FieldName>(
	field: K,
	index: number,
): OutcomeInputs[K] => {
	const entry = INPUT_DOMAINS[field][index]
	if (entry === undefined) {
		throw new Error(`outcome-inputs: ${field} has no domain value at ${index}`)
	}
	return entry.value
}

const labelOf = (field: FieldName, index: number): string => {
	const entry = INPUT_DOMAINS[field][index]
	if (entry === undefined) {
		throw new Error(`outcome-inputs: ${field} has no domain value at ${index}`)
	}
	return `${field}=${entry.label}`
}

const tupleOf = (indices: Readonly<Indices>): OutcomeInputs => ({
	required: domainValueOf('required', indices.required),
	disposition: domainValueOf('disposition', indices.disposition),
	citedFinding: domainValueOf('citedFinding', indices.citedFinding),
	witness: domainValueOf('witness', indices.witness),
	selections: domainValueOf('selections', indices.selections),
	selectorAmbiguity: domainValueOf(
		'selectorAmbiguity',
		indices.selectorAmbiguity,
	),
	checkResolution: domainValueOf('checkResolution', indices.checkResolution),
	polarity: domainValueOf('polarity', indices.polarity),
	probeClass: domainValueOf('probeClass', indices.probeClass),
	expectedClean: domainValueOf('expectedClean', indices.expectedClean),
	probeSigned: domainValueOf('probeSigned', indices.probeSigned),
	probeQualified: domainValueOf('probeQualified', indices.probeQualified),
	waiver: domainValueOf('waiver', indices.waiver),
	judgeConduct: domainValueOf('judgeConduct', indices.judgeConduct),
	evaluationFault: domainValueOf('evaluationFault', indices.evaluationFault),
})

const neutralIndices = (): Indices => {
	const indices = {} as Indices
	for (const field of INPUT_FIELDS) indices[field] = 0
	return indices
}

/**
 * Every assignment of the seven constrained fields the constraints admit. The
 * free fields take their neutral value here, which none of the seven reads.
 */
const feasibleShapes = (): readonly Readonly<Indices>[] => {
	let shapes: Indices[] = [neutralIndices()]
	for (const field of CONSTRAINED_FIELDS) {
		const widened: Indices[] = []
		for (const shape of shapes) {
			for (let index = 0; index < INPUT_DOMAINS[field].length; index += 1) {
				const copy = { ...shape }
				copy[field] = index
				widened.push(copy)
			}
		}
		shapes = widened
	}
	return shapes.filter((shape) => satisfiesConstraints(tupleOf(shape)))
}

const SHAPES = feasibleShapes()

type ValuePair = {
	readonly fieldA: FieldName
	readonly indexA: number
	readonly fieldB: FieldName
	readonly indexB: number
}

const allPairs = (): readonly ValuePair[] => {
	const pairs: ValuePair[] = []
	for (let left = 0; left < INPUT_FIELDS.length; left += 1) {
		for (let right = left + 1; right < INPUT_FIELDS.length; right += 1) {
			const fieldA = INPUT_FIELDS[left]!
			const fieldB = INPUT_FIELDS[right]!
			for (let indexA = 0; indexA < INPUT_DOMAINS[fieldA].length; indexA += 1) {
				for (
					let indexB = 0;
					indexB < INPUT_DOMAINS[fieldB].length;
					indexB += 1
				) {
					pairs.push({ fieldA, indexA, fieldB, indexB })
				}
			}
		}
	}
	return pairs
}

const ALL_PAIRS = allPairs()

const pairKey = (pair: ValuePair): string =>
	`${pair.fieldA}:${pair.indexA}|${pair.fieldB}:${pair.indexB}`

const shapeAdmits = (
	shape: Readonly<Indices>,
	field: FieldName,
	index: number,
): boolean => !isConstrained(field) || shape[field] === index

const pairFeasible = (pair: ValuePair): boolean =>
	SHAPES.some(
		(shape) =>
			shapeAdmits(shape, pair.fieldA, pair.indexA) &&
			shapeAdmits(shape, pair.fieldB, pair.indexB),
	)

const FEASIBLE_PAIRS = ALL_PAIRS.filter(pairFeasible)

/**
 * Computes on first call and returns the same value after. Every builder below
 * is pure over module constants, so a caller cannot tell memoization from
 * recomputation; what it buys is that the covering array is built once per
 * process. Under v8 coverage instrumentation the greedy build runs long enough
 * that rebuilding it per call put two cases over vitest's five-second default.
 */
const once = <T>(build: () => T): (() => T) => {
	let value: T | undefined
	let built = false
	return () => {
		if (!built) {
			value = build()
			built = true
		}
		return value as T
	}
}

/**
 * The pairs of domain values no tuple satisfying the constraints contains,
 * derived from the constraints themselves.
 */
export const infeasiblePairs = once((): readonly InfeasiblePair[] =>
	ALL_PAIRS.filter((pair) => !pairFeasible(pair)).map((pair) => ({
		left: labelOf(pair.fieldA, pair.indexA),
		right: labelOf(pair.fieldB, pair.indexB),
	})),
)

const pairsOf = (indices: Readonly<Indices>): readonly string[] =>
	FEASIBLE_PAIRS.filter(
		(pair) =>
			indices[pair.fieldA] === pair.indexA &&
			indices[pair.fieldB] === pair.indexB,
	).map(pairKey)

/**
 * A deterministic greedy covering array over the feasible pairs. Each round
 * seeds on the lowest uncovered pair, picks the feasible shape covering the
 * most uncovered constrained pairs, then fills the free fields one at a time
 * by the same rule. Ties keep the earlier candidate, so the output is fixed by
 * the declaration order alone.
 */
export const pairwiseCases = once((): readonly OutcomeInputs[] => {
	const covered = new Set<string>()
	const cases: OutcomeInputs[] = []
	const countNew = (
		indices: Readonly<Indices>,
		decided: readonly FieldName[],
	) =>
		FEASIBLE_PAIRS.filter(
			(pair) =>
				decided.some((field) => field === pair.fieldA) &&
				decided.some((field) => field === pair.fieldB) &&
				indices[pair.fieldA] === pair.indexA &&
				indices[pair.fieldB] === pair.indexB &&
				!covered.has(pairKey(pair)),
		).length
	while (covered.size < FEASIBLE_PAIRS.length) {
		const seed = FEASIBLE_PAIRS.find((pair) => !covered.has(pairKey(pair)))
		if (seed === undefined) break
		const pins = new Map<FieldName, number>([
			[seed.fieldA, seed.indexA],
			[seed.fieldB, seed.indexB],
		])
		let chosen: Readonly<Indices> | null = null
		let best = -1
		for (const shape of SHAPES) {
			let admits = true
			for (const [field, index] of pins) {
				if (!shapeAdmits(shape, field, index)) admits = false
			}
			if (!admits) continue
			const score = countNew(shape, CONSTRAINED_FIELDS)
			if (score > best) {
				best = score
				chosen = shape
			}
		}
		if (chosen === null) break
		const indices: Indices = { ...chosen }
		const decided: FieldName[] = [...CONSTRAINED_FIELDS]
		for (const field of INPUT_FIELDS) {
			if (isConstrained(field)) continue
			const pinned = pins.get(field)
			if (pinned !== undefined) {
				indices[field] = pinned
				decided.push(field)
				continue
			}
			let bestIndex = 0
			let bestScore = -1
			for (let index = 0; index < INPUT_DOMAINS[field].length; index += 1) {
				indices[field] = index
				const score = countNew(indices, [...decided, field])
				if (score > bestScore) {
					bestScore = score
					bestIndex = index
				}
			}
			indices[field] = bestIndex
			decided.push(field)
		}
		for (const key of pairsOf(indices)) covered.add(key)
		cases.push(tupleOf(indices))
	}
	return cases
})

/** The neutral tuple: no condition fires and the ladder falls to its final row. */
export const NEUTRAL_INPUTS: OutcomeInputs = tupleOf(neutralIndices())

type ProbeShape = Pick<
	OutcomeInputs,
	'probeClass' | 'expectedClean' | 'probeSigned' | 'probeQualified'
>

/** A signed probe on the seeding branch: the one shape that carries a witness. */
export const signedProbe = (
	probeClass: OutcomeInputs['probeClass'],
	probeQualified: boolean,
): ProbeShape => ({
	probeClass,
	expectedClean: false,
	probeSigned: true,
	probeQualified,
})

/** A canary carries no signature, so it carries no witness either. */
export const unsignedCanaryProbe = (probeQualified: boolean): ProbeShape => ({
	probeClass: 'canary',
	expectedClean: false,
	probeSigned: false,
	probeQualified,
})

/** `zero-action` is the one class a clean control may qualify under. */
export const cleanControlProbe = (probeQualified: boolean): ProbeShape => ({
	probeClass: 'zero-action',
	expectedClean: true,
	probeSigned: false,
	probeQualified,
})

export type NamedCase = {
	readonly label: string
	readonly inputs: OutcomeInputs
}

const namedCase = (
	label: string,
	overrides: Partial<OutcomeInputs>,
): NamedCase => ({ label, inputs: { ...NEUTRAL_INPUTS, ...overrides } })

/**
 * One case per ladder rule, per waiver rule, per corroboration rule, and per
 * invalidating condition, the near misses the states are paired against, and
 * the two worked fixtures. Written out because a rule the covering array
 * happens to reach today is a rule a domain edit can silently drop tomorrow.
 */
export const RULE_WITNESS_CASES = [
	namedCase('evaluation-fault', { evaluationFault: true }),
	namedCase('judge-malformed', { judgeConduct: 'malformed' }),
	namedCase('probe-unqualified', {
		...signedProbe('defect', false),
		witness: witnessOf('not-triggered'),
	}),
	namedCase('finding-dangling-probe', { citedFinding: citationOf('dangling') }),
	namedCase('witness-unwitnessed-claim', {
		...signedProbe('defect', true),
		witness: witnessOf('unwitnessed-claim'),
	}),
	namedCase('witness-vacuous', {
		...signedProbe('defect', true),
		witness: witnessOf('vacuous'),
	}),
	namedCase('selector-ambiguous', {
		selectorAmbiguity: true,
		selections: [SEVERAL],
	}),
	namedCase('witness-unexercised', {
		...signedProbe('defect', true),
		witness: witnessOf('unexercised'),
	}),
	namedCase('steps-unreached', { selections: [NONE] }),
	namedCase('zero-action-detected', {
		...signedProbe('zero-action', true),
		witness: witnessOf('matched'),
	}),
	namedCase('clean-control-false-positive', {
		...cleanControlProbe(true),
		citedFinding: citationOf('signatureless'),
	}),
	namedCase('clean-control-passed', cleanControlProbe(true)),
	namedCase('clean-control-examined-nothing', {
		...cleanControlProbe(true),
		checkResolution: 'insufficient-evidence',
	}),
	namedCase('canary-detected', {
		...unsignedCanaryProbe(true),
		citedFinding: citationOf('signatureless'),
	}),
	namedCase('canary-undetected', {
		...unsignedCanaryProbe(true),
		selections: [ONE],
	}),
	namedCase('witness-matched', {
		...signedProbe('defect', true),
		witness: witnessOf('matched'),
	}),
	namedCase('witness-manifested-unclaimed', {
		...signedProbe('defect', true),
		witness: witnessOf('manifested-unclaimed'),
	}),
	namedCase('oracle-cited-defect', { citedFinding: citationOf('mapped') }),
	namedCase('check-insufficient-evidence', {
		checkResolution: 'insufficient-evidence',
	}),
	namedCase('witness-not-triggered', {
		...signedProbe('defect', true),
		witness: witnessOf('not-triggered'),
	}),
	namedCase('outcome-clear', {}),
	namedCase('unsupported-disposition', {
		disposition: dispositionOf('held', []),
	}),
	namedCase('disposition-missing', { required: true }),
	namedCase('waiver-honoured', {
		...signedProbe('defect', true),
		witness: witnessOf('manifested-unclaimed'),
		waiver: 'applied-condition-met',
	}),
	namedCase('waiver-bypassed', {
		...signedProbe('defect', true),
		witness: witnessOf('manifested-unclaimed'),
		waiver: 'applied-condition-unmet',
	}),
	namedCase('disposition-contradicts-evidence', {
		disposition: dispositionOf('violated', ['obs-1']),
	}),
	namedCase('citation-declined', { citedFinding: citationOf('unmapped') }),
	namedCase('examined-nothing-disagrees', {
		checkResolution: 'insufficient-evidence',
		citedFinding: citationOf('mapped'),
	}),
	namedCase('never-ran', { checkResolution: null }),
	namedCase('check-confirms-finding', {
		checkResolution: 'false',
		citedFinding: citationOf('mapped'),
	}),
	namedCase('check-and-findings-diverge', { checkResolution: 'false' }),
	namedCase('near-miss-unreached', { selections: [ONE] }),
	namedCase('near-miss-judge-error', { judgeConduct: 'conforming' }),
	/**
	 * A signed unqualified canary carrying a dangling citation, an unwitnessed
	 * claim, an evaluation fault, a malformed judge response, and a selector
	 * ambiguity. Six conditions hold at once and all six come back, which is
	 * what AD-21 needs so a persistent judge fault cannot mask a real
	 * regression.
	 */
	namedCase('six-conditions', {
		probeClass: 'canary',
		expectedClean: false,
		probeSigned: true,
		probeQualified: false,
		witness: witnessOf('unwitnessed-claim'),
		citedFinding: citationOf('dangling'),
		evaluationFault: true,
		judgeConduct: 'malformed',
		selectorAmbiguity: true,
		selections: [SEVERAL],
	}),
	/**
	 * The worked chain AD-33 names as a defect: an oracle recorded `confirmed`
	 * with corroboration `agrees` whose step matched zero observations and
	 * whose disposition narrates a rejection appearing in no observation. Both
	 * halves are caught here, the state at `unreached` and the corroboration at
	 * `disagrees`.
	 */
	namedCase('worked-chain', {
		selections: [NONE],
		disposition: dispositionOf('held', []),
	}),
] as const satisfies readonly NamedCase[]

export type NearMissPair = {
	readonly state: string
	readonly positive: string
	readonly nearMiss: string
	readonly field: FieldName
}

/**
 * AD-30 asks for a fixture per state, positive and negative. A negative
 * fixture for a state read as every input that is not that state is vacuous,
 * so the reading taken is the seeded-defect idiom: a case producing the state
 * and a second differing in exactly one field that produces a different one.
 * That makes the negative fixture a statement about which field carries the
 * state.
 */
export const NEAR_MISS_PAIRS = [
	{
		state: 'caught',
		positive: 'witness-matched',
		nearMiss: 'witness-not-triggered',
		field: 'witness',
	},
	{
		state: 'confirmed',
		positive: 'outcome-clear',
		nearMiss: 'evaluation-fault',
		field: 'evaluationFault',
	},
	{
		state: 'missed',
		positive: 'witness-manifested-unclaimed',
		nearMiss: 'waiver-honoured',
		field: 'waiver',
	},
	{
		state: 'passed-clean-control',
		positive: 'clean-control-passed',
		nearMiss: 'clean-control-false-positive',
		field: 'citedFinding',
	},
	{
		state: 'false-positive',
		positive: 'clean-control-false-positive',
		nearMiss: 'clean-control-passed',
		field: 'citedFinding',
	},
	{
		state: 'abstained',
		positive: 'check-insufficient-evidence',
		nearMiss: 'outcome-clear',
		field: 'checkResolution',
	},
	{
		state: 'bypassed',
		positive: 'waiver-bypassed',
		nearMiss: 'waiver-honoured',
		field: 'waiver',
	},
	{
		state: 'unreached',
		positive: 'steps-unreached',
		nearMiss: 'near-miss-unreached',
		field: 'selections',
	},
	{
		state: 'oracle-error',
		positive: 'evaluation-fault',
		nearMiss: 'outcome-clear',
		field: 'evaluationFault',
	},
	{
		state: 'judge-error',
		positive: 'judge-malformed',
		nearMiss: 'near-miss-judge-error',
		field: 'judgeConduct',
	},
	{
		state: 'infrastructure-error',
		positive: 'probe-unqualified',
		nearMiss: 'witness-not-triggered',
		field: 'probeQualified',
	},
	{
		state: 'not-applicable',
		positive: 'witness-unexercised',
		nearMiss: 'witness-not-triggered',
		field: 'witness',
	},
] as const satisfies readonly NearMissPair[]

/** The whole fixture set: the covering array, then the named cases. */
export const fixtureCases = once((): readonly OutcomeInputs[] => [
	...pairwiseCases(),
	...RULE_WITNESS_CASES.map((entry) => entry.inputs),
])

/** The pairs of domain values the constraints admit. */
export const feasiblePairs = once((): readonly InfeasiblePair[] =>
	FEASIBLE_PAIRS.map((pair) => ({
		left: labelOf(pair.fieldA, pair.indexA),
		right: labelOf(pair.fieldB, pair.indexB),
	})),
)

export const pairKeyOf = (pair: InfeasiblePair): string =>
	`${pair.left} & ${pair.right}`

/**
 * The pair keys a tuple realizes, or `null` where some field carries a value
 * the domains do not declare, which is how a named case combines selections
 * the covering array never builds.
 */
export const realizedPairKeys = (
	inputs: OutcomeInputs,
): readonly string[] | null => {
	const indices = {} as Indices
	for (const field of INPUT_FIELDS) {
		const encoded = JSON.stringify(inputs[field])
		const index = INPUT_DOMAINS[field].findIndex(
			(entry) => JSON.stringify(entry.value) === encoded,
		)
		if (index === -1) return null
		indices[field] = index
	}
	return ALL_PAIRS.filter(
		(pair) =>
			indices[pair.fieldA] === pair.indexA &&
			indices[pair.fieldB] === pair.indexB,
	).map((pair) =>
		pairKeyOf({
			left: labelOf(pair.fieldA, pair.indexA),
			right: labelOf(pair.fieldB, pair.indexB),
		}),
	)
}
