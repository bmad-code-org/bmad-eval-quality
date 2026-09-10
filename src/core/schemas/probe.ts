/** a corpus probe: its class, its control status, and the defects it seeds. */
import { z } from 'zod'
import { ArtifactReference } from './artifact-reference.ts'
import { DefectSignature } from './defect-signature.ts'
import { Severity } from './eval-contract.ts'
import { lineageFields } from './lineage.ts'
import { BehaviorId, DefectId, Digest, ProbeId } from './primitives.ts'
import { ProbeQualification } from './probe-qualification.ts'
import { ManifestationWitness } from './sensitivity-witness.ts'

/**
 * AD-9's closed four, one per probe, in scope because AD-7's strength vector
 * is keyed by probe class and needs this vocabulary. AD-7's exclusion rule
 * reads directly off this field and `expectedClean`: canary probes and clean
 * controls never enter the vector.
 */
export const PROBE_CLASSES = [
	'defect',
	'gameability',
	'zero-action',
	'canary',
] as const

export const ProbeClass = z.enum(PROBE_CLASSES)

/** AD-9's seeded defect: the prior art's six fields, plus the nullable `manifestationWitness` a six-field defect round-trips through. */
export const Defect = z.strictObject({
	defectId: DefectId,
	behaviorId: BehaviorId.describe(
		'The behaviour this defect breaks. AD-9 also puts a behaviour on the probe itself and this schema carries both; that the two may disagree is a cross-field rule with no AD-5 code and is left unenforced in v0 rather than silently refined here.',
	),
	summary: z.string().min(1),
	severity: Severity,
	oracleEvidence: z.array(ArtifactReference),
	source: z.enum(['natural', 'controlled-mutation']),
	manifestationWitness: ManifestationWitness.nullable().describe(
		"AD-10: what pre-flight probes to observe this defect fire. `null` parses, so the prior art's six-field defect still round-trips, and pre-flight records a null witness as a **failed** `seeded-fault-fired` check rather than as an exemption. A seeded fault that cannot be observed to fire is the vacuous probe AD-40 resolves to `infrastructure-error`, and pre-flight is the one place where invalidating is the cheap outcome.",
	),
})

// Shared by both branches of the `expectedClean` union. AD-9's per-probe
// `artifactDigest` and `commitDigest` sit at the root here, matching the prior
// art's record-level `implementationSha`: one spelling instead of five.
const probeCommonFields = {
	...lineageFields,
	probeId: ProbeId,
	probeClass: ProbeClass,
	behaviorId: BehaviorId.describe(
		'AD-9 puts the behaviour on the probe. The prior art put one on each seeded defect only, and this schema carries both.',
	),
	systemId: z
		.string()
		.min(1)
		.describe('An opaque caller label for the system under test.'),
	implementationDigest: Digest.describe(
		"The prior art's `implementationSha`, renamed against the shared AD-27 primitive. An AD-24 divergence.",
	),
	artifactDigest: Digest,
	commitDigest: Digest,
	rationale: z.string().min(1),
	qualification: ProbeQualification.describe(
		'AD-9\'s qualification record: which of the five routes earned this probe its ground truth, and the evidence that route demands. Required on every branch and on every class, canaries included, because AD-9 closes with "an unqualified probe cannot enter a sealed set" and spells a route for all five kinds. That the route is compatible with this probe\'s class and `expectedClean` flag is a cross-field rule the export cannot carry; the corpus qualification gate enforces it and returns a reason code. Required, not optional, which with `defectSignature` below makes the probe\'s `schemaVersion` 1 -> 2 BREAKING bump under AD-11, whose rule is that "adding an optional field is a `schemaVersion` bump recorded in the field\'s own description; removing or retyping is breaking". This field is on both branches, so it alone is what stops every version-1 probe from parsing.',
	),
}

/**
 * The probe's current schema version. `EVAL_CONTRACT_SCHEMA_VERSION` is the
 * same thing for the eval contract.
 *
 * It exists for the reason that one does: `lineage.ts` keeps the field a plain
 * integer so a stale artifact fails as AD-28's `schema-version-mismatch` rather
 * than as an anonymous parse error, which puts the comparison on the reader.
 * `compile` is that reader for a contract. A probe has two in this pipeline and
 * both compare against this constant: `planPreflight` before it plans a leg,
 * and `score` before it seals the probe. An unequal stamp leaves by the fault
 * path rather than being read leniently.
 *
 * A third reader exists for a caller outside this package.
 * `validateLineageChain` takes an `acceptedSchemaVersion` and raises the same
 * code over a presented chain, and `Probe` carries lineage, so a caller who
 * presents one gets the comparison there. It words the fault its own way, which
 * is why the two spellings of `schema-version-mismatch` in this tree are not a
 * drift.
 *
 * It is also the single place the number is written. The committed
 * worked-example chains build their probes from it and `check:doc-claims` reads
 * it to hold the published sentence that names it, where the number was a
 * literal in three places that could disagree in silence.
 */
export const PROBE_SCHEMA_VERSION = 5

/**
 * Why a stale probe stamp is a rejection, in the words the fault carries.
 *
 * One string for both readers. Two copies of a sentence this long disagree in
 * silence exactly as the number did before `PROBE_SCHEMA_VERSION` existed, and
 * it lives here because this is where a version bump is one edit.
 *
 * It splits the shapes by branch, because a clean control carries neither a
 * `defectSignature` nor a manifestation witness: the signature is declared on
 * the seeded branch below and a witness hangs off a `Defect`, which that branch
 * bounds at zero. What every probe carries is the qualification record, whose
 * arrival on both branches is what made the 1 to 2 bump breaking. A clean
 * control is the probe a reader is most likely to meet this message with, so
 * naming a field it does not have would be the wrong half to lead with.
 */
export const PROBE_SCHEMA_VERSION_CONSEQUENCE =
	'since the stamp says which shapes the probe was authored against: the ' +
	'qualification record on every probe, and the witness legs and the defect ' +
	'signature grammar on a seeded one'

/**
 * The prior art's `expectedClean` conditional, re-expressed as a discriminated
 * union per AD-13 (a boolean literal discriminator parses on this pin,
 * verified).
 *
 * `expectedClean: true` marks a clean control: AD-9's reason for the boolean
 * is "ratifying the prior art's record-level field rather than adding a fifth
 * class".
 */
export const Probe = z
	.discriminatedUnion('expectedClean', [
		z
			.strictObject({
				...probeCommonFields,
				expectedClean: z.literal(true),
				defects: z
					.array(Defect)
					.max(0)
					.describe(
						"A known-clean control seeds nothing, which is the prior art's own `if`/`then` expressed structurally.",
					),
			})
			.describe("A known-clean control. Never enters AD-7's dominance vector."),
		z
			.strictObject({
				...probeCommonFields,
				expectedClean: z.literal(false),
				defects: z
					.array(Defect)
					.describe(
						'No minimum. AD-9 states none, and a minimum would make a canary unrepresentable, since a canary indicts the fixture rather than seeding a defect.',
					),
				defectSignature: DefectSignature.nullable().describe(
					"AD-40's machine-readable defect signature, declared on this branch alone: a clean control seeds nothing, so its branch has no signature to carry. Nullable rather than plain, because the one class that legitimately carries none is `canary`, and a union-level refinement expressing that is dropped from the published export, which would leave Zod rejecting a probe ajv accepts. The corpus qualification gate is the enforcement point and the constraint ledger records the gap; the shipped precedent is `compile/interface-inventory.ts`, which put the principal check in the compiler for the same reason. The other half of the probe's `schemaVersion` 1 -> 2 BREAKING bump under AD-11, recorded here as that rule requires: the key is required on this branch, and `null` is the legal value a canary carries.",
				),
			})
			.describe(
				'A probe that is not a known-clean control. The one branch AD-40 gives a defect signature.',
			),
	])
	.meta({
		id: 'Probe',
		description:
			"One corpus probe. Succeeds the prior-art `h0-ground-truth` schema per AD-24, carrying its system identifier, implementation digest, `expectedClean` flag, seeded defects, and rationale, and adding AD-9's probe class and AD-9's per-probe artifact and commit digests. Divergences: `implementationSha` becomes `implementationDigest`, `taskId` does not survive because the probe pins what it describes by digest, and `expectedGate` does not survive because AD-40 makes detection a signature match rather than a verdict comparison and AD-7 keeps comparisons inside the dominance vector, so carrying an expected gate would invite a comparison the architecture forbids. Two constructions landed here together under one BREAKING `schemaVersion` bump: AD-9's per-class QUALIFICATION record, as a five-route tagged union required on every branch, and AD-40's machine-readable DEFECT SIGNATURE on the `expectedClean: false` branch, carrying the interface kind, the home operation by its transport identity, the observable channel, and the discriminating condition. Both are required rather than optional, which is what makes the bump breaking under AD-11: every corpus written against version 1 fails to parse. Version 3 opened the signature to a second interface kind: it is a union on `interfaceKind`, where the `cli` branch declares a logical invocation in place of a method and a path template, and the selector's input binding carries the four command channels beside the four transport ones. Version 4 is a BREAKING bump on the witness side: a manifestation witness's `inputs` gained a third leg shape over a tool call's arguments, so a witness leg against a tool call is expressible; every version-3 probe's own bytes still parse against it. Version 5 opened the signature to a third kind and closed both gaps version 4 left. `DefectSignature` gains a tool-call branch declaring the published tool name, which is the transport identity AD-40 resolves an mcp signature against, and the api-shaped branch narrows to `api` and `web`, so a signature carrying `mcp` beside a method and a path template stops parsing. The selector's input binding gains a ninth `arguments` channel on the same required-and-nullable terms as the other eight, so a version-3 or version-4 probe declaring eight channels stops parsing too. The signature is therefore three branch shapes rather than one, each declaring its own kind's transport identity: a method and a path template, a logical invocation, or a published tool name. What the schema still does not decide is stated rather than hidden. AD-9's \"an unqualified probe cannot enter a sealed set\" is a corpus-construction invariant enforced by the qualification gate in `core/score/qualification.ts`, not by this schema: all eight class-and-`expectedClean` pairings parse, a route incompatible with the pair parses, and a signature-less non-canary parses, each so the gate can return a reason code carrying an artifact path instead of an anonymous parse failure. The constraint ledger carries both gaps.",
	})

export type Probe = z.infer<typeof Probe>
