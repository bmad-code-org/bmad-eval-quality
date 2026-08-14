/** a declared reference set: what a collection is reconciled against. */
import { z } from 'zod'
import { JsonObjectValue, KeyName } from './primitives.ts'

/**
 * AD-19 fixes members as objects rather than scalars because `covers-by-key`
 * compares on named keys, and a `set-membership` operand against the same set
 * reads the single named key — so one declared form serves both operators and
 * the injection form of AD-20's rule 6 needs no second field.
 *
 * Members are `JsonValue` objects, which is the Consistency Conventions' own
 * placement of them: the value container is named for "expression literals,
 * declared reference-set members, and every ingested response body". That is
 * why they are not a seventh caller-keyed control map.
 */
export const ReferenceSetDeclaration = z.strictObject({
	keys: z
		.array(KeyName)
		.min(1)
		.describe(
			'The key names members are compared on. A reference set with no keys names nothing to compare, and no AD-5 code fires on it, so the schema is the enforcement point.',
		),
	members: z
		.array(JsonObjectValue)
		.describe(
			'Objects carrying at least the declared keys. That they do is deliberately not refined: no AD-5 code names it, and a refinement would be invisible to a non-TypeScript consumer and become a differential disagreement in Story 1.5.',
		),
	commentary: z
		.string()
		.nullable()
		.describe(
			"Author documentation. Named `commentary` rather than the Gate C fixture's `note` so Epic 2 has one word to exclude from the sealed brief, matching the oracle field of the same name. No predicate reads it.",
		),
})
