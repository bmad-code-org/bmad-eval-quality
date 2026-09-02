/** the scored output `emit` owns: outcomes, strength, and one verdict. */
import { z } from 'zod'
import { Severity } from './eval-contract.ts'
import { lineageFields } from './lineage.ts'
import {
	Digest,
	FindingId,
	Identifier,
	OracleId,
	ProbeId,
} from './primitives.ts'
import { OracleDispositionValue } from './sealed-run-record.ts'
import { EvaluatorRecommendation, Verdict } from './verdict.ts'

/**
 * AD-6's closed twelve. Exported so a later reader can walk the list
 * directly, and asserted at twelve by a test: AD-6 says the set "stays closed
 * at twelve", so adding a thirteenth member means amending that AD first.
 */
export const OUTCOME_STATES = [
	'caught',
	'confirmed',
	'missed',
	'passed-clean-control',
	'false-positive',
	'abstained',
	'bypassed',
	'unreached',
	'oracle-error',
	'judge-error',
	'infrastructure-error',
	'not-applicable',
] as const

export const OutcomeState = z.enum(OUTCOME_STATES)

/** AD-33's closed three. */
export const CORROBORATION_VALUES = [
	'agrees',
	'disagrees',
	'not-evaluable',
] as const

export const Corroboration = z.enum(CORROBORATION_VALUES)

export type CheckResolutionValue = {
	resolution: 'true' | 'false' | 'insufficient-evidence'
	introductionCondition: 'empty-collection' | null
	children: CheckResolutionValue[]
}

/**
 * AD-4 requires that "each node's resolution and, where it is
 * `insufficient-evidence`, the introduction condition that fired, are recorded
 * in the evidence". A single verdict per oracle would erase that distinction,
 * so the record mirrors the oracle's own `check` tree. Self-referential, so
 * it carries `.meta({ id })`; without it the tree exports as a positional
 * `__schema0` that the published-schema drift check would pin.
 * `core/evaluate/resolution.ts` populates it.
 */
export const CheckResolution: z.ZodType<CheckResolutionValue> = z
	.lazy(() =>
		z.strictObject({
			resolution: z.enum(['true', 'false', 'insufficient-evidence']),
			introductionCondition: z.enum(['empty-collection']).nullable(),
			children: z.array(CheckResolution),
		}),
	)
	.meta({
		id: 'CheckResolution',
		description:
			"One node of an oracle's `check` tree as it resolved. AD-4's resolution is three-valued rather than two, and the introduction vocabulary has exactly one member because AD-4 closes the introduction set at one: an empty collection. `null` where the resolution is not `insufficient-evidence`. A leaf carries an empty `children` array.",
	})

/**
 * AD-11's five named inputs, transcribed so a reader can recompute the
 * digest and see what was compared (AD-8's "by digest and opaque reference,
 * never by content or path"). Named object rather than a concatenated tuple:
 * revision 1 let two conforming scorers compute different versions from
 * identical inputs if they hashed a different ordering. The scorer computes
 * the scoring version over this shape.
 */
export const SCORING_VERSION_INPUT_NAMES = [
	'contractSchemaVersion',
	'corpusDigest',
	'fixtureDigest',
	'evaluatorConfigurationDigest',
	'scoringPolicyDigest',
] as const

export const ScoringVersionInputName = z.enum(SCORING_VERSION_INPUT_NAMES)

export const ScoringVersionInputs = z.strictObject({
	contractSchemaVersion: z.int().min(1),
	corpusDigest: Digest,
	fixtureDigest: Digest,
	evaluatorConfigurationDigest: Digest,
	scoringPolicyDigest: Digest,
})

export const InvalidatedAttempt = z.strictObject({
	attempt: z.int().min(1),
	reason: z
		.string()
		.min(1)
		.describe(
			"AD-6 requires each attempt's reason. Non-empty: a reason that says nothing is not a reason, no AD-5 code names the condition, and the schema is therefore the enforcement point.",
		),
})

/** exported so the trial-set reducer names this shape without importing Zod. */
export type InvalidatedAttempt = z.infer<typeof InvalidatedAttempt>

/**
 * AD-6: "Every artifact records its trial count, its invalidated attempts, and
 * each attempt's reason, including on a PASS." None of the three is nullable,
 * because "including on a PASS" is exactly the case a nullable field would let
 * a producer skip.
 */
export const Trials = z.strictObject({
	declaredMinimum: z.int().min(1),
	completed: z.int().min(0),
	invalidatedAttempts: z.array(InvalidatedAttempt),
})

export const Outcome = z.strictObject({
	oracleId: OracleId,
	probeId: ProbeId.nullable(),
	state: OutcomeState.describe(
		"AD-6's closed twelve, assigned by AD-33. `not-applicable` is excluded from every count and is legal in exactly two cases: against an unexpired waiver, and against a probe AD-40 records as unexercised.",
	),
	severity: Severity,
	disposition: OracleDispositionValue.describe(
		"The evaluator's own statement, carried through from the run record's dispositions rather than re-derived. One vocabulary, spelled once, in the artifact the caller produces.",
	),
	resolvedFrom: FindingId.nullable().describe(
		'The finding this outcome resolved from, or `null` where no finding was cited. A finding citing no oracle is recorded in `uncitedFindings` rather than discarded or forced into a state.',
	),
	corroboration: Corroboration.describe(
		"AD-33's closed three. `not-evaluable` and AD-4's `insufficient-evidence` are DIFFERENT conditions and AD-33 forbids merging them: `not-evaluable` means the expression never ran, while `insufficient-evidence` means it ran to completion and found nothing to examine. That is why both vocabularies appear on one outcome, this field and `checkResolution`, rather than collapsing into one.",
	),
	selectedObservationIds: z
		.array(Identifier)
		.describe(
			'The cited observation identifiers AD-40 names as "what the witness match resolves against and what AD-33 records on the outcome". Recorded now rather than deferred: Owed item 2 is about selection DETERMINISM, meaning a monotonic sequence and a declared selector cardinality, which is a different question from whether the selection is recorded.',
		),
	checkResolution: CheckResolution.nullable().describe(
		"The oracle's `check` tree as it resolved, per AD-4. `null` for an oracle whose check never ran, which is the `not-evaluable` corroboration case; the two fields are read together and neither substitutes for the other.",
	),
})

/** exported so the dominance comparator names this shape without importing Zod. */
export type Outcome = z.infer<typeof Outcome>

export const CoverageGap = z.strictObject({
	rule: z
		.string()
		.min(1)
		.describe(
			'Opaque and deliberately not an enum, for the reason `Waiver.rule` is opaque: AD-20 enumerates its seven discipline rules in prose and assigns them no identifiers, so an enum here would be this schema minting the vocabulary AD-20 declined to.',
		),
	relevancePredicate: z.string().min(1),
	satisfactionPredicate: z.string().min(1),
	satisfied: z.boolean(),
	severity: Severity,
})

/** the record as a type, so `core/coverage/` names it without importing Zod. */
export type CoverageGap = z.infer<typeof CoverageGap>

export const ClassStrength = z.strictObject({
	caught: z.int().min(0),
	exercised: z.int().min(0),
	rate: z
		.number()
		.min(0)
		.max(1)
		.nullable()
		.describe(
			'Nullable because `exercised` may be zero and a rate over an empty denominator is undefined rather than zero. There is no separate `rawCounts` block: AD-7 wants raw counts recorded alongside the rate so a consumer can recompute, and this entry already carries both; a second copy is one more thing to disagree with itself. That `rate` equals `caught` over `exercised` is a cross-field rule with no AD-5 code and is left to the scorer.',
		),
})

/** exported so the rate-vector builder names this shape without importing Zod. */
export type ClassStrength = z.infer<typeof ClassStrength>

/**
 * A fixed three-key object instead of a map keyed by probe class. AD-7 is
 * explicit that "canary probes and clean controls never enter the vector", so
 * the fourth class has no key here at all and its absence is structural.
 */
export const StrengthVector = z.strictObject({
	defect: ClassStrength.nullable(),
	gameability: ClassStrength.nullable(),
	'zero-action': ClassStrength.nullable(),
})

/** exported so the rate-vector builder names this shape without importing Zod. */
export type StrengthVector = z.infer<typeof StrengthVector>

export const Strength = z.strictObject({
	denominator: z
		.string()
		.min(1)
		.describe(
			'AD-7 requires the denominator to be named in the artifact "so two consumers cannot derive two different recalls".',
		),
	basis: z
		.enum(['measured', 'reconstructed'])
		.describe(
			'AD-40 forbids pooling a containment-reconstructed detection with a measured catch rate. Without this field the two are identical on disk and pooling is the default reading.',
		),
	vector: StrengthVector,
	comparable: z
		.boolean()
		.describe(
			"AD-21: a run that resolved `unreached` or completed fewer trials than the policy's declared minimum marks the vector non-comparable rather than silently comparing it.",
		),
	note: z.string().nullable(),
})

/** exported so the dominance comparator names this shape without importing Zod. */
export type Strength = z.infer<typeof Strength>

/**
 * AD-12's three named checks, transcribed from the same sentence the field
 * comes from: the package "validates a caller-presented lineage chain (length
 * consistent with the declared revision, no repeated digest, no gap) and
 * emits evidence of compliance." A single boolean would tell a reader a chain
 * failed without saying which of three ways, on an artifact whose purpose is
 * to be read. AD-21's FAIL rung reads the conjunction.
 */
export const LineageChain = z.strictObject({
	lengthConsistent: z.boolean(),
	noRepeatedDigest: z.boolean(),
	noGap: z.boolean(),
})

/** Exported for `core/lineage/chain.ts`, which computes these three. */
export type LineageChain = z.infer<typeof LineageChain>

export const Remediation = z.strictObject({
	revisionCount: z
		.int()
		.min(0)
		.describe(
			"AD-12's REMEDIATION count, meaning how many times the contract was revised in response to results, and NOT AD-29's lineage `revisionCount` at the root of this artifact. The two are distinguished only by nesting, so both descriptions say so.",
		),
	cap: z.int().min(0),
	capSource: z
		.literal('caller-attested')
		.describe(
			'A literal because AD-12 states the package validates the cap rather than enforcing it. There is no second legal value, and inventing one would claim an enforcement the architecture disclaims.',
		),
	lineageChain: LineageChain,
})

// Common to both modes. AD-21 separates only the verdict fields; everything a
// reader needs to audit the run is on both.
const evidenceCommonFields = {
	...lineageFields,
	runId: z.string().min(1),
	scoringVersion: Digest.describe(
		'AD-11: computed by the scorer over the five named inputs below and never caller-supplied.',
	),
	scoringVersionInputs: ScoringVersionInputs,
	comparabilityKey: Digest.describe(
		"AD-7's declared key: the scoring policy digest plus the corpus digest restricted to the probes both results cover. Deliberately weaker than the scoring version, so adding a probe narrows a comparison rather than voiding every prior result.",
	),
	excludedProbeIds: z
		.array(ProbeId)
		.describe(
			'The probes a narrowed comparison excluded, per AD-7. Empty is the ordinary case.',
		),
	exitCode: z
		.int()
		.describe(
			"AD-21's exit code for the verdict this artifact carries. Recorded rather than derived at read time so the artifact and the process agree.",
		),
	verdictBasis: z
		.array(z.string().min(1))
		.describe(
			'Every condition that fired, in AD-21 terms. Free text by design: the rungs are prose in AD-21 and assigning them identifiers would be minting a vocabulary that AD has not. Each member is non-empty, on the same reasoning that `InvalidatedAttempt.reason` is: a condition that names itself with nothing has not been recorded. An empty array is legal and is what a PASS with no firing condition carries.',
		),
	callerAttestedInputs: z
		.array(ScoringVersionInputName)
		.describe(
			'Which of the five scoring-version inputs were caller-attested rather than computed by this package. An enum over the five key names rather than free strings, because AD-32 requires the artifact to state *which* inputs were attested and an unconstrained string cannot be checked against anything. AD-11 names three of the five as caller-attested; the enum admits any subset so a stricter or looser integration stays representable.',
		),
	trials: Trials,
	outcomes: z.array(Outcome),
	uncitedFindings: z
		.array(FindingId)
		.describe(
			'Findings citing no oracle, retained rather than discarded or forced into a state, per AD-33. Discarding them would hide exactly the evaluator-chosen detection AD-23 exists to preserve.',
		),
	coverageGaps: z.array(CoverageGap),
	strength: Strength,
	remediation: Remediation,
}

/**
 * A discriminated union, because AD-21 requires that no shape hold a
 * production verdict and a contract verdict at once, with neither mode able
 * to read a field as the other's.
 */
export const EvidenceArtifact = z
	.discriminatedUnion('mode', [
		z
			.strictObject({
				...evidenceCommonFields,
				mode: z.literal('production'),
				productionVerdict: Verdict,
			})
			.describe(
				"Production mode: the verdict is about the system under test, and an ingested evaluator recommendation promotes as AD-21's ladder describes.",
			),
		z
			.strictObject({
				...evidenceCommonFields,
				mode: z.literal('contract-scoring'),
				contractVerdict: Verdict,
				systemRecommendationRecorded: EvaluatorRecommendation.describe(
					"The evaluator's recommendation about the SYSTEM, recorded and never promoted. On a knowingly defective probe a system-directed FAIL is an input rather than a signal about the contract.",
				),
				systemRecommendationNote: z.string().nullable(),
			})
			.describe(
				"Contract-scoring mode: the verdict is about the contract, and the evaluator's recommendation about the system is recorded beside it rather than promoted.",
			),
	])
	.meta({
		id: 'EvidenceArtifact',
		description:
			"The scored output, owned by `emit` per AD-24, with no prior art; `score` produces the outcome and verdict values it serializes. The two modes are separate branches because AD-21 requires that the production verdict and the contract verdict never share a field. Mode is no longer first stated here: the Sealed Run Record now carries a required `mode`, where AD-21's \"fixed before ingest\" puts it, so this artifact restates a mode the sealed record already fixed and is never the source. Owed item 4's remaining clauses stay open, namely mode entering AD-11's identity inputs, the two assessment input types with their own ladders, and cross-mode comparison rejected. The cost is named rather than hidden: nothing yet rejects a `production` record paired with a `contract-scoring` artifact or the reverse. That is a cross-artifact agreement under AD-32, and it has no home today because `score` and `emit` both carry `module: null` in the stage table, so no code holds both artifacts at once. It lands with the two assessment input types, which is where a producer first reads mode off the record to choose a ladder.",
	})

export type EvidenceArtifact = z.infer<typeof EvidenceArtifact>
