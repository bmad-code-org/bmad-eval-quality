/** the caller's inbound record of one sealed evaluator trial. */
import { z } from 'zod'
import { ArtifactReference } from './artifact-reference.ts'
import { Severity } from './eval-contract.ts'
import { lineageFields } from './lineage.ts'
import {
	IDENTIFIER_ROOTED_CHANNEL,
	NON_IDENTIFIER_ROOTED_CHANNELS,
} from './pointer.ts'
import {
	BehaviorId,
	Digest,
	FindingId,
	Identifier,
	JsonObjectValue,
	JsonValue,
	OracleId,
	ProbeId,
	RubricCriterionId,
	RubricId,
	UnsignedDecimalString,
} from './primitives.ts'
import { ProbeObservedBody } from './probe-body.ts'
import { EvaluatorRecommendation } from './verdict.ts'

const QUOTE_DESCRIPTION =
	"The evaluator's verbatim quotation, per AD-23. Non-empty: an empty quotation quotes nothing, no AD-5 code names the condition, and under the admit-rule's second clause the schema is therefore the enforcement point. That this text appears in at least one of the finding's cited observations is NOT checked here; it is an AD-32 declared-versus-observed inconsistency that invalidates at ingest, and ADR-009 Decision 2 settles the precedence: \"cited identifiers govern the witness match; quotation audits it.\""

const quote = z.string().min(1).describe(QUOTE_DESCRIPTION)

/**
 * AD-23's verbatim quotation, paired with the channel it came from: a
 * quotation with no channel cannot be audited against its source observation
 * (ADR-009 Decision 2).
 *
 * Two arms rather than one shape with a nullable identifier and a `.refine()`
 * over the pair. The identifier is meaningful on exactly one channel, and the
 * first spelling of this field said so in prose while admitting every other
 * combination: `channel: "response-body"` with a non-null `artifactId` parsed,
 * and `projectChannel` reads the identifier only on the artifact channel, so
 * the quotation was audited against the response body and a record naming a
 * file it never consulted produced no condition at all. That is a narrower
 * spelling of the wrong-file hole `artifactId` was added to close.
 *
 * A refinement would not have closed it either, for the reason
 * `evidence-artifact.ts` records where it narrows a mode to a literal instead:
 * a refinement never exports, so the published document keeps admitting the
 * disagreement, and AD-13's corpus-mutation generator synthesises witnesses
 * from a branch's own JSON Schema with no knowledge of a Zod-only cross-field
 * rule. Narrowing the schema removes the gap at its source.
 *
 * A plain union rather than a discriminated one, on `DefectSignature`'s own
 * reasoning: the discriminator would be `channel`, and one arm carries seven
 * values for it. The two arms are told apart by the channel they name.
 *
 * The `EvidenceChannel` `$ref` is not carried at this site, since neither arm
 * accepts the whole vocabulary. A non-TypeScript consumer reads a literal on
 * one arm and a seven-member enum on the other, which is the rule itself
 * rather than a reference plus a sentence about it.
 */
export const ArtifactQuotedEvidence = z.strictObject({
	quote,
	channel: z.literal(IDENTIFIER_ROOTED_CHANNEL),
	artifactId: Identifier.describe(
		"Which written file the quotation came from. A channel alone does not identify one: an operation may write several, and an audit that searched all of them at once accepted a quotation lifted from a file the finding never cited, which is the opposite of what AD-23's verbatim requirement is for.",
	),
})

export const ChannelQuotedEvidence = z.strictObject({
	quote,
	channel: z.enum(NON_IDENTIFIER_ROOTED_CHANNELS),
	artifactId: z
		.null()
		.describe(
			'Null on every channel but `artifact`, and required rather than optional so a record cannot omit the question. Only a written file needs naming; every other channel is one thing per observation.',
		),
})

export const QuotedEvidence = z.union([
	ArtifactQuotedEvidence,
	ChannelQuotedEvidence,
])

// Spread into each finding branch rather than shared as a base object: a
// spread adds no `$defs` entry, so each branch exports as a complete shape a
// non-TypeScript consumer can read without following a reference (AD-13).
const findingCommonFields = {
	findingId: FindingId,
	oracleId: OracleId.nullable().describe(
		'The oracle this finding answers. Nullable because AD-23 is explicit that "a finding citing no oracle is retained as an uncited finding rather than discarded", and it is often the evaluator-chosen detection the AD exists to preserve. The carve-out is oracle-only and is deliberately not extended to `probeId`.',
	),
	probeId: ProbeId.describe(
		"Required, unlike `oracleId`. AD-23 carves out the no-oracle case and nothing else; a finding arises during some probe's run, so citing the probe is always possible, and AD-7's per-class vector cannot attribute a finding that names no probe.",
	),
	behaviorId: BehaviorId.nullable().describe(
		'The behaviour at issue, where the finding names one. `null` for a finding that answers no declared behaviour, which is the same case `oracleId: null` records.',
	),
	severity: Severity,
	summary: z.string().min(1),
	confidence: z
		.number()
		.min(0)
		.max(1)
		.describe(
			'AD-24 requires per-finding confidence "on a declared scale" and declares no scale, so the closed unit interval is declared here: 0 through 1 inclusive. It exports `minimum` and `maximum` natively, and it is the same scale the scoring policy\'s `confidenceThreshold` uses, or AD-21\'s "a finding whose confidence falls below the policy threshold" would compare two different scales.',
		),
	observationIds: z
		.array(Identifier)
		.describe(
			"The observations this finding relies on. Declared on every branch, not only on `defect`: AD-23's word is *additionally*, which is a floor on `defect` rather than a prohibition on the other two, and the architecture's own worked record carries observation identifiers on a `confirmation` and on an `observation` finding. A defect-only field would turn those into `unrecognized_keys` failures for no AD reason. That a cited identifier matches a declared observation is a cross-artifact rule with no AD-5 code and is left to ingest.",
		),
	evidenceArtifacts: z
		.array(ArtifactReference)
		.describe(
			"References to the evidence this finding rests on. Nothing to do with this package's `EvidenceArtifact`, which is the scored output `emit` owns: two unrelated things one word apart, named here so a reader does not reach for the wrong type.",
		),
}

/**
 * `defect` findings additionally require observation identifiers and quoted
 * evidence (AD-23). A nullable field can't express "required on this branch
 * only", so this is a discriminated union, the house treatment for a
 * conditional (AD-13).
 */
export const Finding = z
	.discriminatedUnion('findingType', [
		z
			.strictObject({
				findingType: z.literal('defect'),
				...findingCommonFields,
				observationIds: z
					.array(Identifier)
					.min(1)
					.describe(
						'Tightened to at least one on this branch, which is AD-23\'s "additionally" expressed structurally: a defect claim citing no witness is what AD-40 calls an invalidating declared-versus-observed inconsistency, and the minimum is the half of that rule a schema can carry.',
					),
				quotedEvidence: z
					.array(QuotedEvidence)
					.min(1)
					.describe(
						'Required and non-empty on this branch alone, per AD-23. Only `defect` findings enter a detection measure, and a detection claim with no quotation is the shape AD-40 records revision 4 having no way to match.',
					),
			})
			.describe(
				'A claimed defect. The only finding type that enters a detection measure under AD-23, and the only one carrying required quoted evidence.',
			),
		z
			.strictObject({
				findingType: z.literal('observation'),
				...findingCommonFields,
			})
			.describe(
				'A non-defect note about the interface or the evidence. Carries no quoted evidence requirement and never enters a detection measure.',
			),
		z
			.strictObject({
				findingType: z.literal('confirmation'),
				...findingCommonFields,
			})
			.describe(
				'A record that a behaviour held. AD-6 resolves it to `confirmed`, the state revision 3 added after `passed-clean-control` was being misused for it.',
			),
	])
	.meta({ id: 'Finding' })

/**
 * AD-23 requires one disposition per required oracle: held, violated, or
 * not-attempted. The three words are AD-23's own vocabulary.
 */
export const ORACLE_DISPOSITIONS = [
	'held',
	'violated',
	'not-attempted',
] as const

export const OracleDispositionValue = z.enum(ORACLE_DISPOSITIONS)

export const OracleDisposition = z.strictObject({
	oracleId: OracleId,
	disposition: OracleDispositionValue,
	observationIds: z
		.array(Identifier)
		.describe(
			'Required and permitted to be empty. AD-33 requires "every disposition citing supporting observations, and an unsupported disposition invalidating cross-artifact agreement rather than being believed", so an unsupported disposition has to stay representable for the scorer to invalidate it. That one disposition exists per required oracle is likewise not refined: AD-23 makes a missing disposition an AD-21 invalidating condition, so the schema admits the shape and ingest fires the rung.',
		),
	note: z.string().nullable(),
})

export type OracleDisposition = z.infer<typeof OracleDisposition>

/**
 * A flat map would break pointer addressing: AD-26 keys `call-inputs` by
 * transport channel, so a pointer like
 * `/interactions/write/call-inputs/body/title` needs that segment to resolve
 * against. A strict object keyed by channel rather than a record over the
 * channel enum, for the same reason as `RequestShape` and `InputBinding`: a
 * record demands every enum member at parse time, and a real observation binds
 * only a subset.
 *
 * One key per member of `INPUT_CHANNELS`, in the order the vocabulary spells
 * them. A loop over that vocabulary indexes this shape directly, so the two
 * have to stay the same width.
 */
export const ObservedCallInputs = z.strictObject({
	path: JsonObjectValue.nullable(),
	query: JsonObjectValue.nullable(),
	header: JsonObjectValue.nullable(),
	body: JsonObjectValue.nullable(),
	argument: JsonObjectValue.nullable(),
	option: JsonObjectValue.nullable(),
	environment: JsonObjectValue.nullable(),
	stdin: JsonObjectValue.nullable(),
	arguments: JsonObjectValue.nullable().describe(
		"AD-26's `arguments` channel, the one channel a tool call accepts input on. Its arrival retypes this shape from eight keys to nine, which AD-11 calls breaking and which moves the Sealed Run Record's `schemaVersion` from 4 to 5: a version-4 record declares no `arguments` key and fails to parse against version 5. A name-to-value map on `responseHeaders`' terms, since a pointer descends INTO the channel to address one argument. `null` on an observation that exercised no tool call, which is what every channel here already spells for a channel nothing was sent on.",
	),
})

/** the constraint identifier the ledger carries for the check below. */
export const OBSERVATION_SEQUENCE_UNIQUE = 'observation-sequence-unique'

/**
 * One ingested observation, carrying AD-26's closed channel set so every
 * pointer in the addressing grammar has something to resolve against.
 *
 * `sequence` closes owed item 2: ADR-006 forbids using array position as
 * ordering. A required, per-record-unique `sequence` is the total order a
 * selector reads.
 */
export const Observation = z.strictObject({
	observationId: Identifier,
	sequence: z
		.int()
		.positive()
		.describe(
			'The total order ADR-006 forbids reading off array position (owed item 2). A positive integer, unique across every observation in the same record: uniqueness is what a sorted-by-`sequence` read needs to be strictly increasing, so no separate monotonicity check is required. Neither starting at 1 nor contiguous is required across a record: only positivity and per-record uniqueness are enforced, so a record whose sequences are e.g. [5, 12, 40] is equally valid. Required rather than optional, which makes this a BREAKING `schemaVersion` bump under AD-11: adding an optional field is additive, and this field is not optional. A record with an absent or duplicated `sequence` fails to parse.',
		),
	operationId: Identifier.describe(
		'The operation this observation exercised. `Operation.operationId` is scoped to a `PermittedInterface`, so two interfaces may declare the same one; that collision is a cross-artifact rule with no AD-5 code, since `duplicate-operation-signature` covers method plus path template only, and it is left to ingest.',
	),
	provenance: z
		.enum(['baseline', 'evaluator-chosen'])
		.describe(
			"AD-23: `baseline` for a pre-canned or deterministic test, `evaluator-chosen` for an action the evaluator selected. The distinction is the one the product's central finding rests on: what a sealed evaluator detects beyond the pre-canned baseline. It lives on the observation, never on the finding.",
		),
	principal: Identifier.nullable().describe(
		"The declared principal the harness acted as, or `null` where the run named none. Owed item 3's other half: a `{ principal }` input binding is presence-only by construction, since the contract declares a name and the harness provisions the value, so without this field two steps of one operation binding `owner` and `other-user` both match every observation and both resolve `several`. That is exactly the act-as-A-read-as-B shape the two critical-severity cross-user behaviours need, and it was unscoreable while the record said nothing about which account was used. An opaque label carrying no account identifier or credential, on `testData.principals`' own AD-18 terms.",
	),
	callInputs: ObservedCallInputs,
	responseBody: JsonValue.nullable().describe(
		'AD-26\'s `response-body` channel. The null branch is redundant against the value container, which already admits `null`; it is kept so every observation field reads the same way, and it means "no body observed" and "a body that was JSON null" are indistinguishable here, which is an accepted cost of one uniform spelling.',
	),
	responseHeaders: JsonObjectValue.nullable().describe(
		'A name-to-value map, not the open value container. AD-26 gives `response-headers` a tail, so a pointer resolves INTO this channel; a scalar here would leave `/interactions/x/response-headers/Content-Type` addressing nothing. That is the difference from `responseBody`, where a scalar or an array is a legitimate body and the open container is correct.',
	),
	responseStatus: z
		.int()
		.min(0)
		.nullable()
		.describe(
			'Deliberately not bounded to a protocol range. A negative status is meaningless and excluded, but the upper end is left open: AD-19 declares four interface kinds and not all of them speak HTTP, so bounding this to HTTP would encode a protocol assumption the artifact outlives. `null` where the channel does not apply.',
		),
	stdout: ProbeObservedBody.describe(
		'AD-26\'s `stdout` channel, tagged rather than a bare string. An operation may nominate standard output as the channel its response descriptor describes, in which case a pointer descends into it, and an untagged string could not tell output that was JSON from output that was only ever text. `{ "kind": "absent" }` is the channel a run did not observe.',
	),
	stderr: ProbeObservedBody.describe(
		"AD-26's `stderr` channel, tagged on the same terms as `stdout`.",
	),
	exitCode: z
		.int()
		.nullable()
		.describe(
			'Signed on purpose, unlike `responseStatus`: a process terminated by a signal is conventionally reported as a negative code, and this field records what was observed rather than what is tidy.',
		),
	artifacts: z
		.record(Identifier, ProbeObservedBody)
		.describe(
			"AD-26's `artifact` channel, keyed by the identifier the operation declares it writes, which is the segment an artifact pointer carries before its tail. Caller-keyed and expected to be partial: a run that wrote no files carries `{}`. Tagged on the same terms as `stdout`, since a written report may be JSON, may be prose, and may not have been written at all.",
		),
})

export type ObservedCallInputs = z.infer<typeof ObservedCallInputs>

export type Observation = z.infer<typeof Observation>

/**
 * AD-17: judge results arrive inside the sealed run record and the package
 * never calls a judge.
 */
export const JudgeResult = z.strictObject({
	rubricId: RubricId,
	criterionId: RubricCriterionId,
	score: z
		.int()
		.nullable()
		.describe(
			"An integer, because AD-22 puts the scale on the rubric's own anchored levels and `ScaleLevel.level` is already `z.int()`; no second scale is minted here. `null` is the shape AD-6's `judge-error` fires on, so it must parse. Two AD-17 rules sit over this field and only one of them is decidable from a record. That a criterion is scored at most once IS: `core/ingest` reports a repeated `rubricId`/`criterionId` pair as a `duplicate-record-identifier` condition, since a criterion scored twice is not one judge call's product whatever else the record says. That a scored criterion is one the cited rubric DECLARES is not, and never will be from inside this package: the rubric is not among ingest's declared inputs, no stage row names it, and a schema over one artifact has no second operand. That half is the caller's, on the same terms AD-12 states for the remediation cap, and it is a stated boundary rather than an unimplemented rule.",
		),
	note: z.string().nullable(),
})

/** the prior art's five members, with money as a string per AD-36. */
export const ResourceUse = z.strictObject({
	toolCalls: z.int().min(0),
	inputTokens: z.int().min(0),
	outputTokens: z.int().min(0),
	wallClockSeconds: z
		.number()
		.min(0)
		.describe(
			"Stays a number where money becomes a string: a measured duration is not currency, and the worked example's 62.5 is an exact binary64 inside AD-36's value domain.",
		),
	costUsd: UnsignedDecimalString.describe(
		"Money, so AD-36 carries it as a string in a declared format. The prior art's number does not survive; an AD-24 divergence.",
	),
})

/**
 * AD-21's FAIL rung reads on evidence that is incomplete, over-truncated,
 * unavailable, or internally inconsistent (AD-17), but no artifact declares
 * those fields. Two of the four are caller statements and land here; the other
 * two are derived and declared nowhere.
 */
export const EvidenceDisclosure = z.strictObject({
	truncationBound: z
		.int()
		.min(0)
		.nullable()
		.describe(
			'AD-17 requires truncation to be "deterministic, disclosed with its bound". `null` is untruncated. The unit is left to the caller and stated rather than encoded, following the `RubricBody.maxLength` precedent for AD-22\'s equally unitless "bounded length". The over-truncated condition compares this bound against the evidence carried in this same artifact, which is why the disclosure and the evidence travel together.',
		),
	reportedIncomplete: z
		.boolean()
		.describe(
			'AD-17: "a case that cannot be bounded without discarding disconfirming material is reported incomplete". This is the operand AD-21\'s incomplete condition reads. The remaining two conditions read no field here: unavailable is an `ArtifactReference` that does not resolve through the corpus port, and internally inconsistent is AD-32\'s cross-artifact agreement check. AD-17\'s "must retain evidence contradicting the leading verdict" is decidable by none of them and is recorded as unenforced in v0.',
		),
})

/** exported so the ladder names this shape without importing Zod. */
export type EvidenceDisclosure = z.infer<typeof EvidenceDisclosure>

/**
 * AD-21's two modes, closed. In `production` the subject is the system under
 * test; in `contract-scoring` the subject is the contract, the probe is
 * knowingly defective, and a `caught` outcome is the contract succeeding.
 *
 * Declared on the record rather than on the evidence artifact because this is
 * where mode is now fixed: AD-21 requires mode "fixed before ingest", and an
 * evidence artifact is `emit`'s output, four stages past the only place a
 * caller can supply one.
 */
export const RUN_MODES = ['production', 'contract-scoring'] as const

export type RunModeValue = (typeof RUN_MODES)[number]

export const RunMode = z.enum(RUN_MODES)

/**
 * The record version this build accepts. No stage writes a sealed run record,
 * so before this constant the number existed in `src/` only as prose in the
 * description below, and a caller assembling a record transcribed it. One
 * consumer transcribed it as 3 and emitted records no stage could read.
 *
 * `6` on five recorded bumps, the last of which drops `invalidReason`: a
 * version-5 record carrying that key fails `strictObject`, which is the
 * predecessor shape the parse-behaviour case is built on.
 */
export const SEALED_RUN_RECORD_SCHEMA_VERSION = 6

export const SealedRunRecord = z
	.strictObject({
		// A record carries lineage fields and nothing here ever puts one in a
		// chain. `validateLineageChain` has no caller in this package at all: it
		// is exported for consumers, and `score.ts` carries the reasoning for
		// why score deliberately does not call it. That is what lets a field be
		// added or removed here without moving any caller's scoring version,
		// since a chain digests each member whole. A consumer who chains records
		// makes that false for themselves, and the version-6 changelog's
		// comparability claim stops holding for them.
		...lineageFields,
		runId: z
			.string()
			.min(1)
			.describe(
				'An opaque caller label. Carried over from the prior art unchanged.',
			),
		conditionArm: z
			.string()
			.min(1)
			.describe(
				"An opaque caller label with no product semantics, per AD-24. The prior art's five-member enum does not survive, and its own extension history is the reason: an enum a local amendment had to widen once for `self-review` will be widened again.",
			),
		mode: RunMode.describe(
			'AD-21\'s run mode, supplied by the caller on the record and never derived, recomputed, or defaulted afterwards. AD-21 requires mode to be "fixed before ingest", and owed item 4 records what its absence costs: the same sealed run could be relabelled after ingest and scored under the same scoring version. Required rather than optional, which makes this a BREAKING `schemaVersion` bump under AD-11, whose rule is that "adding an optional field is a `schemaVersion` bump recorded in the field\'s own description; removing or retyping is breaking". A version-1 record carries no mode, and no default may repair one into a version-2 record, because a defaulted mode is the relabelling this field exists to stop. A record presenting no mode fails to parse, which AD-28 makes a `schema-parse-failure` fault rather than an AD-21 verdict or an AD-5 code, the same routing `evaluatorRecommendation` already records for an unrecognised value. This field is where mode is read from; the evidence artifact restates it and is never the source.',
		),
		trialIndex: z
			.int()
			.min(1)
			.describe(
				"Which trial this record is. AD-24 excludes the trial index from the Evaluator Configuration \"so trials pool into one scoring version\", which requires it somewhere else, and a Sealed Run Record is the only artifact carrying exactly one trial. One-based, matching the only instance that exists. AD-6's aggregate of trial count, invalidated attempts, and each attempt's reason is the Evidence Artifact's, computed by `score` over the trial set a caller assembles. The reducer keys an attempt by its position in that set, so this field is the caller's own bookkeeping and a label for a reader of one record.",
			),
		contractDigest: Digest,
		sealedBriefDigest: Digest,
		evaluatorConfigurationDigest: Digest.describe(
			'A bare digest rather than an `ArtifactReference`, and required on both this record and the isolation manifest. AD-32 requires the two to *agree*, and an `ArtifactReference` on one side against a bare digest on the other makes the comparison lopsided; AD-2 already has ingest receiving the Evaluator Configuration as its own input, so nothing needs resolving through a reference. The agreement itself is a cross-artifact rule no schema can see.',
		),
		evaluatorRecommendation: EvaluatorRecommendation,
		oracleDispositions: z.array(OracleDisposition),
		findings: z.array(Finding),
		observations: z
			.array(Observation)
			.refine(
				(observations) => {
					const seen = new Set<number>()
					for (const observation of observations) {
						if (seen.has(observation.sequence)) return false
						seen.add(observation.sequence)
					}
					return true
				},
				{
					error:
						"every observation's `sequence` is unique within the record (ADR-006, owed item 2); a duplicate leaves the total order the fix exists to supply ambiguous",
				},
			)
			.describe(
				'Per-observation `sequence` uniqueness is enforced here. The published JSON Schema dialect has no keyword for uniqueness of a nested field across array items, so this constraint is Zod-only: a non-Zod consumer must reimplement it, exactly as with any other cross-item invariant this dialect cannot state.',
			),
		judgeResults: z
			.array(JudgeResult)
			.describe(
				'Empty is legal: a contract with no rubric produces no judge call.',
			),
		actionsArtifact: ArtifactReference,
		isolationManifestArtifact: ArtifactReference,
		resourceUse: ResourceUse,
		evidenceDisclosure: EvidenceDisclosure,
	})
	.meta({
		id: 'SealedRunRecord',
		description:
			"One sealed evaluator trial, as the caller presents it. Succeeds the prior-art `h0-run-result` schema per AD-24, keeping its run identifier, condition arm, findings, action-log reference, resource use, evaluator recommendation as a closed enum, and per-finding confidence on a declared scale. Divergences: `condition` is demoted to the opaque `conditionArm`, `verdict` becomes `evaluatorRecommendation` without `NOT_APPLICABLE`, money is a decimal string, and `taskId`, `note`, per-finding `actionIds`, and the prior art's `invalidReason` do not survive: the contract is pinned by `contractDigest`, an unstructured orchestrator annotation is the free-prose channel the Conventions close everywhere else, and two citation vocabularies on one finding is the ambiguity ADR-009 removed. The run MODE landed here as a required field under a BREAKING `schemaVersion` bump, which is where AD-21's \"fixed before ingest\" puts it; owed item 4 is now closed: mode enters AD-11's identity inputs as `ScoringVersionInputs`'s sixth field, and `core/score/ladder.ts` carries `ProductionAssessment`/`ContractAssessment` as the two assessment input types with their own total ladders. Observation ORDERING landed here too, under its own BREAKING `schemaVersion` bump: `sequence` is required and unique per record, closing owed item 2's ADR-006 gap, since array position was never a legal ordering. Version 4 opened the record to a system under test that runs behind a command: `callInputs` carries the four command channels beside the four transport ones, `stdout` and `stderr` are tagged rather than bare strings so a nominated output channel can be descended into, and `artifacts` records the files the run wrote, keyed by the identifier the operation declares. Version 5 opened it to a tool call: `callInputs` carries a ninth `arguments` channel beside those eight, so what a tool call supplied has somewhere to live and a defect signature's selector filtering on that channel has something to read. A version-4 record declares eight call-input channels and fails to parse against version 5. Version 6 drops `invalidReason`, the prior art's run-level invalidation reason: nothing in this package ever read it, so a caller attesting that a run was invalid was ignored by every stage while the field looked like a supported channel. The attestation that works is `IsolationManifest.violation`, which `core/ingest` raises as an `isolation-manifest-violation` condition and which reaches the verdict basis, and AD-6's invalidating outcome states carry a failure the run itself produced. A version-5 record carrying `invalidReason` fails to parse against version 6.",
	})

export type SealedRunRecord = z.infer<typeof SealedRunRecord>
