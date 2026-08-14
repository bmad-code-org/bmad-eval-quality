/** a contract-carried waiver. */
import { z } from 'zod'
import { Rfc3339Utc, WaiverId } from './primitives.ts'

/**
 * AD-5: a validated waiver requires the named rule, an explicit rationale, a
 * machine-checkable context condition where one exists, the recorded approval,
 * and an RFC 3339 expiry. Every part except the identifier is a required key
 * with a nullable value, so an incomplete waiver stays representable and
 * `waiver-incomplete` keeps a shape to fire on.
 *
 * One clarification the fixture author needs: because AD-5 qualifies the
 * condition with "where one exists", `condition: null` is a *complete* waiver.
 * `null` on any of the other four is incomplete.
 */
export const Waiver = z.strictObject({
	id: WaiverId,
	rule: z
		.string()
		.nullable()
		.describe(
			'The AD-20 discipline rule this waiver names. An opaque string rather than an enum: AD-20 enumerates seven rules in prose and assigns them no identifiers, and minting them here would invent a vocabulary Epic 5 has to match.',
		),
	rationale: z.string().nullable(),
	condition: z
		.string()
		.nullable()
		.describe(
			'A machine-checkable context condition. AD-5 requires one "where one exists", so `null` here is a complete waiver rather than an incomplete one.',
		),
	approval: z.string().nullable(),
	expiresAt: Rfc3339Utc.nullable(),
})
