/** the pure verdict AD-10 computes over probed environment observations. */
import { z } from 'zod'
import { lineageFields } from './lineage.ts'
import { Digest, Identifier } from './primitives.ts'

/**
 * Transcribed from AD-10's own prose, which bounds the verdict to a closed,
 * named list of checks; a member it does not name would be this story minting
 * pre-flight semantics it has no authority over.
 */
export const PREFLIGHT_CHECK_KINDS = [
	'interface-present',
	'input-sensitivity',
	'state-reset',
	'clean-control',
	'seeded-faults-scoped',
	'seeded-fault-fired',
] as const

export const PreflightCheckKind = z.enum(PREFLIGHT_CHECK_KINDS)

export const PreflightCheck = z.strictObject({
	kind: PreflightCheckKind,
	operationId: Identifier.nullable().describe(
		'Nullable because AD-10 scopes input sensitivity and state reset per operation and interface presence per interface, so a check that is not per-operation has nothing to name here.',
	),
	outcome: z
		.enum(['satisfied', 'failed', 'exempt'])
		.describe(
			'`exempt` exists because AD-10 says "an operation declaring no inputs in any channel is exempt and records the exemption", and an exemption with no spelling is an exemption nobody records. That a failed pre-flight invalidates the run, and that a sensitivity witness resolving `insufficient-evidence` fails rather than passes, are AD-10 semantics for `core/preflight` in Epic 6; the schema carries the outcome and refines nothing.',
		),
	note: z.string().nullable(),
})

export type PreflightCheck = z.infer<typeof PreflightCheck>

export const PreflightVerdict = z
	.strictObject({
		...lineageFields,
		runId: z.string().min(1).describe('An opaque caller label.'),
		fixtureDigest: Digest.describe(
			"Required, not nullable. AD-10 makes the fixture digest a required field of the verdict, and AD-11 names it as one of the scoring version's five inputs, so an absent one leaves the scoring version uncomputable.",
		),
		passed: z.boolean(),
		checks: z.array(PreflightCheck),
	})
	.meta({
		id: 'PreflightVerdict',
		description:
			"The pre-flight verdict: a pure function of the observations the environment-probe port returned, with no prior art. AD-10 bounds it to a closed list of check kinds, all six transcribed from that AD's own prose, and requires the fixture digest as a required field. Probing a fixture is not executing the system under test, and a failed pre-flight invalidates the run rather than becoming a contract verdict.",
	})

export type PreflightVerdict = z.infer<typeof PreflightVerdict>
