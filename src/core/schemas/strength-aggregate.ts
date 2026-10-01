/** the run-wide strength of the qualified probes of one run, owned by `aggregate`. */
import { z } from 'zod'
import { ClassStrength, ScoringVersionInputName } from './evidence-artifact.ts'
import { lineageFields } from './lineage.ts'
import { Digest, ProbeId } from './primitives.ts'
import { RunMode } from './sealed-run-record.ts'

/**
 * The version `aggregate` stamps, written once beside the shape it names.
 * `1`: the first release of the artifact.
 */
export const STRENGTH_AGGREGATE_SCHEMA_VERSION = 1

/**
 * The three probe classes AD-7's vector keys. Canary probes and clean controls
 * have no class here for the reason `StrengthVector` has no fourth key: they
 * never enter a denominator.
 */
export const STRENGTH_CLASS_NAMES = [
	'defect',
	'gameability',
	'zero-action',
] as const

/**
 * What the aggregation takes on the presented artifacts and cannot verify
 * (AD-32: an artifact states which of its inputs were attested). The probe
 * class is read off each artifact's own strength vector because an artifact
 * carries no class, and the completeness of the evidence set is whatever the
 * caller presented, since nothing inside the artifacts says which probes the
 * run had.
 */
export const AGGREGATE_ATTESTED_INPUTS = [
	'evidenceSetCompleteness',
	'probeClass',
] as const

export const StrengthClassName = z.enum(STRENGTH_CLASS_NAMES)

export type StrengthClassNameValue = (typeof STRENGTH_CLASS_NAMES)[number]

const FloorValue = z
	.number()
	.min(0)
	.max(1)
	.describe(
		'A catch-rate floor on the closed unit interval, the same unit a class rate is reported in. A class meets it when its rate is at or above this value.',
	)

/**
 * The adopter's declared floors, per class: the input the aggregation compares
 * each class rate against. A class with no key declares no floor. Strict, so a
 * misspelled class name is a parse failure and never a silently undeclared
 * floor. Not an interchange artifact: it is a caller-authored input read the
 * way a scoring policy is, and its values are echoed into the aggregate.
 */
export const StrengthFloors = z.strictObject({
	defect: FloorValue.optional(),
	gameability: FloorValue.optional(),
	'zero-action': FloorValue.optional(),
})

export type StrengthFloors = z.infer<typeof StrengthFloors>

/**
 * Why a decision came out as it did, a closed set so a consumer reads the reason and has no need to re-derive it from the counts. The precedence is the
 * order listed after the first: no declared floor decides nothing, then an
 * empty class, then a non-comparable class, then a class with no exercised
 * probe, then one with some probe unexercised, then the comparison itself. Each decision admits only its own bases, below.
 */
export const FLOOR_BASES = [
	'no-floor-declared',
	'no-eligible-probe',
	'not-comparable',
	'no-exercised-probe',
	'unexercised-probe',
	'rate-below-floor',
	'rate-meets-floor',
] as const

export const FLOOR_DECISIONS = ['meets', 'does-not-meet', 'undeclared'] as const

export const AggregatedClass = ClassStrength.extend({
	eligible: z
		.int()
		.min(1)
		.describe(
			'The distinct qualified probes of this class across the aggregated artifacts: the denominator before exercise. Clean controls and canaries are not counted, whatever class they declare. A class with no eligible probe is `null` in `classes`.',
		),
	comparable: z
		.boolean()
		.describe(
			"True only when every eligible probe's own artifact is comparable: its trial set reached the scoring policy's `minimumTrialCount` and none of its oracles resolved `unreached`. One probe below the minimum makes the whole class non-comparable.",
		),
})

export type AggregatedClass = z.infer<typeof AggregatedClass>

const DECLARED_FLOOR_DESCRIPTION =
	'The floor the adopter declared for this class, copied as given.'

/**
 * A union over the decision, so a decision and its reason can only be paired
 * the ways the stage produces them: `meets` only on `rate-meets-floor`,
 * `undeclared` only on `no-floor-declared` with no floor, and `does-not-meet`
 * on any of the four reasons a declared floor is missed.
 */
export const FloorDecision = z
	.discriminatedUnion('decision', [
		z
			.strictObject({
				floor: FloorValue.describe(DECLARED_FLOOR_DESCRIPTION),
				decision: z.literal('meets'),
				basis: z.literal('rate-meets-floor'),
			})
			.describe(
				'A comparable class in which every eligible probe was exercised and whose rate is at or above the declared floor.',
			),
		z
			.strictObject({
				floor: FloorValue.describe(DECLARED_FLOOR_DESCRIPTION),
				decision: z.literal('does-not-meet'),
				basis: z.enum([
					'no-eligible-probe',
					'not-comparable',
					'no-exercised-probe',
					'unexercised-probe',
					'rate-below-floor',
				]),
			})
			.describe(
				'A declared floor the class misses: no eligible probe, a non-comparable class, no exercised probe, an eligible probe the evaluator never exercised, or a comparable rate below the floor. A floor nothing was measured against is never a pass.',
			),
		z
			.strictObject({
				floor: z
					.null()
					.describe('`null`: the adopter declared no floor for this class.'),
				decision: z.literal('undeclared'),
				basis: z.literal('no-floor-declared'),
			})
			.describe('No floor was declared; neither a pass nor a failure.'),
	])
	.meta({
		id: 'FloorDecision',
		description:
			"The decision against one class's declared floor, with the reason for it. The decision is the engine's own: a caller copies it and never recomputes a verdict from the rate.",
	})

export type FloorDecision = z.infer<typeof FloorDecision>

export const AggregatedInput = z.strictObject({
	probeId: ProbeId,
	probeClass: StrengthClassName.nullable().describe(
		'The class this probe counts toward, read off the strength vector its own artifact carries, or `null` for a clean control or canary, which stays outside every class denominator.',
	),
	runId: z
		.string()
		.min(1)
		.describe(
			"The run identifier of this probe's own trial set. Each probe is scored as its own trial set, so these differ across inputs and are only recorded.",
		),
	artifactDigest: Digest.describe(
		"The AD-27 digest of the evidence artifact this entry read, over its canonical form. A consumer that kept each artifact's digest when it scored the probe compares them to the set recorded here, so a substituted, dropped, or added artifact changes the aggregate it is compared against.",
	),
})

export type AggregatedInput = z.infer<typeof AggregatedInput>

export const StrengthAggregate = z
	.strictObject({
		...lineageFields,
		engineVersion: z
			.string()
			.min(1)
			.describe(
				"The package version that read the artifacts and produced this aggregate, read from the package's own generated constant and never supplied by a caller. An evidence artifact records no engine version, so this is the one version the aggregate can bind: the release that decided every class decision below. Replaying the same artifacts, policy and floors under the same release reproduces this document byte for byte.",
			),
		mode: RunMode.describe(
			'The run mode every input artifact was scored under. Inputs of two modes are refused, since the mode is one of the six scoring-version inputs.',
		),
		scoringVersion: Digest.describe(
			'The scoring version every input artifact carries. Inputs that differ in it are refused, so the aggregate speaks for one corpus digest, one fixture digest, one evaluator configuration digest, one scoring policy digest and one mode.',
		),
		scoringPolicyDigest: Digest.describe(
			'The AD-27 digest of the scoring policy the caller supplied. Every input artifact states the same digest as its own scoring policy digest, and an input scored under another policy is refused.',
		),
		comparabilityKey: Digest.describe(
			"AD-7's key, computed the way `emit` computes it: over the scoring policy digest and the sorted identifiers of every probe aggregated, controls and canaries included. Two aggregates with equal keys covered the same probes under the same policy. It is not the key an input artifact carries, since each input covers one probe.",
		),
		basis: z
			.enum(['measured', 'reconstructed'])
			.describe(
				'The evidence basis every input carries. AD-40 forbids pooling a containment-reconstructed detection with a measured catch rate, so inputs of both bases are refused.',
			),
		minimumTrialCount: z
			.int()
			.min(1)
			.describe(
				"The supplied scoring policy's `minimumTrialCount`. Every input's `trials.declaredMinimum` and every reduction's `catchThreshold` is verified against the policy, and an input that differs is refused. A class below the minimum is non-comparable.",
			),
		callerAttestedInputs: z
			.array(ScoringVersionInputName)
			.describe(
				'Which of the six scoring-version inputs the caller attested, carried from the input artifacts and sorted. AD-32 requires an artifact to state which inputs were attested rather than computed by this package, and inputs that attested different sets are refused, so the one list holds for every artifact the aggregate read.',
			),
		aggregateAttestedInputs: z
			.array(z.enum(AGGREGATE_ATTESTED_INPUTS))
			.describe(
				"What the aggregation takes on trust and cannot verify, stated per AD-32. `probeClass`: an evidence artifact carries no probe class, so each input's class is read off its own strength vector, which no check authenticates. `evidenceSetCompleteness`: nothing in an artifact says which probes the run had, so the aggregate speaks for the artifacts it was handed. The recorded artifact digests are what a caller compares against what it kept at scoring time.",
			),
		inputs: z
			.array(AggregatedInput)
			.min(1)
			.describe(
				'One entry per aggregated evidence artifact, sorted by `probeId`, so the order the artifacts were presented in never enters the bytes. Probe identifiers are unique.',
			),
		classes: z
			.strictObject({
				defect: AggregatedClass.nullable(),
				gameability: AggregatedClass.nullable(),
				'zero-action': AggregatedClass.nullable(),
			})
			.describe(
				"Per class, the distinct qualified probes (`eligible`), how many the evaluator exercised, how many of those resolved `caught`, and the rate between them, computed by the same function that builds a single artifact's strength vector. `null` when no eligible probe belongs to the class. A present entry whose `rate` is `null` has eligible probes and no exercised one. `eligible` equals the number of `inputs` whose `probeClass` is the class, and `rate` equals `caught` over `exercised`; both are cross-field rules with no published expression and are left to the producer.",
			),
		floorDecisions: z
			.strictObject({
				defect: FloorDecision,
				gameability: FloorDecision,
				'zero-action': FloorDecision,
			})
			.describe(
				"The decision against each class's declared floor. Present for every class, so a class the adopter declared no floor for reads `undeclared`.",
			),
	})
	.meta({
		id: 'StrengthAggregate',
		description:
			'The run-wide strength of the qualified probes of one run, owned by the `aggregate` stage, with no prior art. `score` covers one probe per call, so the strength vector in one evidence artifact describes that probe alone and a class floor cannot be applied to a run from those artifacts. This artifact reads every per-probe evidence artifact of the run, verifies each against itself and against the others, and reports per class the distinct qualified probe denominator, the exercised and caught counts, the rate, comparability, and the decision against the declared floor. It records the engine version and the digest of every artifact it read, so a mismatched or missing aggregate is detectable and replaying the same inputs reproduces it byte for byte. Mixed or inconsistent inputs are refused and no aggregate is minted.',
	})

export type StrengthAggregate = z.infer<typeof StrengthAggregate>
