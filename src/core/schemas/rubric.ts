/** the rubric body a contract embeds. */
import { z } from 'zod'
import { InteractionPointer } from './pointer.ts'
import { RubricCriterionId, RubricId } from './primitives.ts'

// AD-22 says "anchored scale levels" and supplies no shape, so this one is
// minted here rather than inherited, which Decision 9 says to record: an
// ordinal plus the observable condition that anchors it, and nothing more.
// Two consequences are left unenforced in v0 on purpose, because no AD-5 code
// names either and AC 10 prefers the compiler to a refinement: `level` is
// unbounded and unordered, so a negative level and two levels sharing an
// ordinal both parse. `rubric-unanchored` fires on a missing anchor, not on a
// duplicate ordinal, so a later epic adds a code deliberately rather than
// discovering the hole.
export const ScaleLevel = z.strictObject({
	level: z
		.int()
		.describe(
			'The ordinal this level sits at. Deliberately unbounded and not checked for duplicates: no AD-5 code names either, so both are left to the compiler in v0 alongside the other cross-field rules.',
		),
	anchor: z
		.string()
		.describe(
			'The observable condition that anchors this level. AD-22 calls an unanchored scale a compile-time failure under `rubric-unanchored`, so the anchor is a declared field rather than a convention.',
		),
})

export const FailureModePenalty = z.strictObject({
	name: z.string().min(1),
	description: z
		.string()
		.describe(
			"AD-22 requires named failure-mode penalties and states no magnitude. None is invented here: a penalty weight would be a scoring semantic this story has no authority to mint, and AD-7 keeps weighted composites out of the reported result. Story 6.3 owns AD-22's compile checks and is where a magnitude would arrive if one is ever needed.",
		),
})

export const RubricCriterion = z.strictObject({
	id: RubricCriterionId,
	text: z
		.string()
		.describe(
			'A criterion scoring chain-of-thought or stated-reasoning prose fails compilation under `rubric-scores-reasoning-prose`, so such a criterion must stay representable here.',
		),
	evidence: InteractionPointer.describe(
		'Where the criterion is answerable from. A pointer that resolves nowhere is `rubric-evidence-unreachable`, a compile-time code, and is deliberately not a schema rejection.',
	),
})

/**
 * The embeddable body. Story 1.4's published `Rubric` artifact is this body
 * plus `schemaVersion`, lineage, and its prior-art declaration; the rubric is
 * defined once and split rather than twice.
 */
export const RubricBody = z.strictObject({
	id: RubricId,
	scaleLevels: z
		.array(ScaleLevel)
		.nullable()
		.describe(
			'`null` and `[]` are both the unanchored shape `rubric-unanchored` fires on, and both must parse.',
		),
	failureModePenalties: z
		.array(FailureModePenalty)
		.nullable()
		.describe(
			'Missing named penalties is `rubric-unanchored`, not a parse failure.',
		),
	maxLength: z
		.int()
		.min(1)
		.nullable()
		.describe(
			'An unbounded length is `null`, which is one of the three shapes `rubric-unanchored` fires on.',
		),
	criteria: z.array(RubricCriterion),
})
