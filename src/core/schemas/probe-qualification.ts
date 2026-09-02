/** AD-9's five qualification routes, one per way ground truth is earned. */
import { z } from 'zod'
import { ArtifactReference } from './artifact-reference.ts'
import { Digest } from './primitives.ts'

/**
 * AD-9 spells a route for each of the five ways a probe earns ground truth. The
 * order is AD-9's own: historical fix boundary, controlled mutation,
 * gameability demonstration, canary, clean control.
 */
export const QUALIFICATION_ROUTES = [
	'historical',
	'controlled-mutation',
	'gameability',
	'canary',
	'clean-control',
] as const

export type QualificationRouteValue = (typeof QUALIFICATION_ROUTES)[number]

export const QualificationRoute = z.enum(QUALIFICATION_ROUTES)

/**
 * AD-9's qualification record, as a tagged union on `route`.
 *
 * A union rather than one wide object with nullable fields: the five routes
 * demand disjoint evidence, and a flat shape would make every route's evidence
 * optional on every other route, which is the shape AD-9 was written against:
 * "a mined fix commit being trusted when its own test already passed at the
 * parent commit". Each branch names what its route must record and nothing
 * else.
 *
 * Required on every probe, canaries included. AD-9 spells a route for all five
 * kinds and closes with "an unqualified probe cannot enter a sealed set" with
 * no exception, so exempting the canary would leave the route AD-9 writes for
 * it with nothing to write it in. The exemption AD-9 does grant attaches to the
 * defect signature, which is AD-40's field.
 *
 * Which route a probe may take is fixed by its class and its `expectedClean`
 * flag, and that pairing is enforced by the corpus qualification gate rather
 * than by a schema refinement: all combinations parse here, so an incompatible
 * pairing stays a reason code carrying an artifact path rather than an
 * anonymous parse failure.
 *
 * Inlined rather than given a `.meta({ id })`. Two `$defs` sharing an internal
 * path are indistinguishable from a schema path alone, and every branch here
 * carries an `ArtifactReference`, so a `$defs` entry would share def-relative
 * suffixes with `Expression` and `ArtifactReference` and make the published
 * keyword walk's stated no-collision premise false.
 */
export const ProbeQualification = z.discriminatedUnion('route', [
	z
		.strictObject({
			route: z.literal('historical'),
			failBeforeEvidence: ArtifactReference.describe(
				'The recorded failure at the parent revision. AD-9 exists because 2 of 18 mined fix commits had a test that already passed at the parent, so this is the half that cannot be assumed.',
			),
			passAfterEvidence: ArtifactReference,
			fixCommitDigest: Digest.describe(
				'The causally isolated fix boundary AD-9 requires the two evidence records to straddle.',
			),
			oracleStableAcrossRevisions: z
				.boolean()
				.describe(
					"AD-9 requires the oracle to be stable across both revisions. `false` parses and fails the gate: a route that cannot record its own unmet precondition cannot be audited, and the schema is not where AD-9's admission decision is made.",
				),
		})
		.describe(
			'A historical probe: a defect mined from a real fix boundary, seeded by reverting it.',
		),
	z
		.strictObject({
			route: z.literal('controlled-mutation'),
			mutationSource: z
				.string()
				.min(1)
				.describe(
					"Where the mutation came from, in the corpus author's own terms. An opaque caller string, unrelated to `Defect.source`'s two-member enum, which records whether the defect is natural or introduced.",
				),
			mutationOperator: z.string().min(1),
			targetArtifact: ArtifactReference,
			expectedObservableFailure: z.string().min(1),
			baselinePassEvidence: ArtifactReference,
			mutatedFailEvidence: ArtifactReference,
			rollbackVerified: z
				.boolean()
				.describe(
					"AD-9's verified rollback or cleanup. `false` parses and fails the gate, for the same reason `oracleStableAcrossRevisions` does.",
				),
		})
		.describe(
			'A controlled mutation: a defect introduced by a named operator against a named artifact.',
		),
	z
		.strictObject({
			route: z.literal('gameability'),
			degenerateResponse: z
				.string()
				.min(1)
				.describe(
					'The compliant-looking degenerate response, described rather than embedded: AD-8 forbids sealed-case content from entering any artifact.',
				),
			naiveOracleSatisfiedEvidence: ArtifactReference,
			disciplinedOracleRejectedEvidence: ArtifactReference,
		})
		.describe(
			'A gameability probe: the demonstration that a degenerate response satisfies a naive oracle and is rejected by a disciplined one.',
		),
	z
		.strictObject({
			route: z.literal('canary'),
			indicts: z
				.enum(['corpus', 'fixture'])
				.describe(
					"AD-9's canary qualifies by demonstrating that non-detection indicts one of these two rather than the contract. Which one it indicts is the demonstration's own result and is recorded rather than left to the reader.",
				),
			nonDetectionEvidence: ArtifactReference,
		})
		.describe(
			'A canary: a probe whose non-detection is evidence about the instrument, never about the contract.',
		),
	z
		.strictObject({
			route: z.literal('clean-control'),
			baselinePassEvidence: ArtifactReference,
			revisionCommitDigest: Digest,
			noKnownDefectStatement: z
				.string()
				.min(1)
				.describe(
					'AD-9 qualifies a clean control at "a revision with no known defect in the probed interface". No field can prove an absence, so the statement is recorded as an attestation under AD-32 and read as trust rather than as a computed fact.',
				),
		})
		.describe(
			'A known-clean control: recorded baseline-pass evidence at a revision with no known defect in the probed interface.',
		),
])

export type ProbeQualification = z.infer<typeof ProbeQualification>
