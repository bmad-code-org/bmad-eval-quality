/** a corpus probe: its class, its control status, and the defects it seeds. */
import { z } from 'zod'
import { ArtifactReference } from './artifact-reference.ts'
import { Severity } from './eval-contract.ts'
import { lineageFields } from './lineage.ts'
import { BehaviorId, DefectId, Digest, ProbeId } from './primitives.ts'
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
			})
			.describe('A probe that is not a known-clean control.'),
	])
	.meta({
		id: 'Probe',
		description:
			"One corpus probe. Succeeds the prior-art `h0-ground-truth` schema per AD-24, carrying its system identifier, implementation digest, `expectedClean` flag, seeded defects, and rationale, and adding AD-9's probe class and AD-9's per-probe artifact and commit digests. Divergences: `implementationSha` becomes `implementationDigest`, `taskId` does not survive because the probe pins what it describes by digest, and `expectedGate` does not survive because AD-40 makes detection a signature match rather than a verdict comparison and AD-7 keeps comparisons inside the dominance vector, so carrying an expected gate would invite a comparison the architecture forbids. Two constructions are deliberately absent: AD-9's per-class QUALIFICATION record, whose five prose routes name no fields and whose acceptance criteria of record do not command it, and AD-40's machine-readable DEFECT SIGNATURE, which Owed item 7 records as having no fixture to land in because this repository contains no probe at all. Both arrive as additive `schemaVersion` bumps under AD-11 once a corpus exists to carry them. The cost is named rather than hidden: AD-9's \"an unqualified probe cannot enter a sealed set\" is enforced by nothing in v0: not this schema, not an AD-5 code, and not an AD-21 rung.",
	})

export type Probe = z.infer<typeof Probe>
