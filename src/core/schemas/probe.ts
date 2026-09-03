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

/** the prior art's six-field seeded defect, carried unchanged. */
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
			"One corpus probe. Succeeds the prior-art `h0-ground-truth` schema per AD-24, carrying its system identifier, implementation digest, `expectedClean` flag, seeded defects, and rationale, and adding AD-9's probe class and AD-9's per-probe artifact and commit digests. Divergences: `implementationSha` becomes `implementationDigest`, `taskId` does not survive because the probe pins what it describes by digest, and `expectedGate` does not survive because AD-40 makes detection a signature match rather than a verdict comparison and AD-7 keeps comparisons inside the dominance vector, so carrying an expected gate would invite a comparison the architecture forbids. Two constructions landed here together under one BREAKING `schemaVersion` bump: AD-9's per-class QUALIFICATION record, as a five-route tagged union required on every branch, and AD-40's machine-readable DEFECT SIGNATURE on the `expectedClean: false` branch, carrying the interface kind, the home operation as a method and a path template, the observable channel, and the discriminating condition. Both are required rather than optional, which is what makes the bump breaking under AD-11: every corpus written against version 1 fails to parse. What the schema still does not decide is stated rather than hidden. AD-9's \"an unqualified probe cannot enter a sealed set\" is a corpus-construction invariant enforced by the qualification gate in `core/score/qualification.ts`, not by this schema: all eight class-and-`expectedClean` pairings parse, a route incompatible with the pair parses, and a signature-less non-canary parses, each so the gate can return a reason code carrying an artifact path instead of an anonymous parse failure. The constraint ledger carries both gaps.",
	})

export type Probe = z.infer<typeof Probe>
