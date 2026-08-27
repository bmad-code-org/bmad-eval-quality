/** the rubric body a contract embeds, and the published Rubric artifact. */

import { z } from 'zod'
import { lineageFields } from './lineage.ts'
import { InteractionPointer } from './pointer.ts'
import { RubricCriterionId, RubricId } from './primitives.ts'

// AD-22 requires anchored scale levels but supplies no shape. Minted here as
// an ordinal plus its anchor condition, nothing more (Decision 9); see the
// field descriptions below for what stays unenforced in v0 and why.
export const ScaleLevel = z.strictObject({
	level: z
		.int()
		.describe(
			'The ordinal this level sits at. Story 6.3 settled both halves of what the schema left open: a repeated ordinal fails under `rubric-unanchored`, since two levels at one ordinal make the ordinal address two anchors, and magnitude, sign, ordering, and contiguity stay free, because a scale running -2 to 2 or 1, 3, 5 is an ordinary authoring choice.',
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
			"AD-22 requires named failure-mode penalties and states no magnitude. None is invented here: a penalty weight would be a scoring semantic no story below `score` has authority to mint, and AD-7 keeps weighted composites out of the reported result. Story 6.3 shipped AD-22's compile checks and declined to mint one, so a penalty carries a name and a description and nothing else.",
		),
})

export const RubricCriterion = z.strictObject({
	id: RubricCriterionId,
	text: z
		.string()
		.describe(
			"A criterion whose wording matches the compiler's closed stated-reasoning vocabulary fails compilation under `rubric-scores-reasoning-prose`, so such a criterion must stay representable here. A blank text parses for the same reason and fails under `rubric-unanchored`.",
		),
	evidence: InteractionPointer.describe(
		'Where the criterion is answerable from. A pointer that resolves nowhere is `rubric-evidence-unreachable`, a compile-time code, and is deliberately not a schema rejection.',
	),
})

/**
 * The embeddable rubric body: Story 1.4's published `Rubric` artifact adds
 * `schemaVersion`, lineage, and a prior-art declaration on top of this.
 */
export const RubricBody = z
	.strictObject({
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
				'An unbounded length is `null`, which is one of the shapes `rubric-unanchored` fires on.',
			),
		criteria: z.array(RubricCriterion),
	})
	.meta({
		id: 'RubricBody',
		description:
			"The embeddable rubric body. Named so the shared body has a stable `$defs` key distinct from the published `Rubric` artifact, which is this body plus `schemaVersion` and AD-29 lineage; without the name the two collide in Story 1.5's drift check under a generated positional name.",
	})

export type RubricBody = z.infer<typeof RubricBody>

/**
 * The published Rubric artifact (Story 1.3): `RubricBody` above, spread flat,
 * plus AD-11's version and AD-29's lineage.
 */
export const Rubric = z
	.strictObject({
		...RubricBody.shape,
		...lineageFields,
	})
	.meta({
		id: 'Rubric',
		description:
			"A published rubric, with no prior art: the experiments' evaluator-result and trace-label schemas belong to the deferred semantic layer and their names are not reused. AD-22's compile checks cover anchored scale levels, named failure-mode penalties, a bounded length, criteria that state a question, addressable rubric and criterion identifiers, and wording that matches the compiler's closed stated-reasoning vocabulary. All of them fire under `rubric-unanchored`, `rubric-evidence-unreachable`, and `rubric-scores-reasoning-prose` at compile time, so every shape those codes fire on parses here.",
	})

export type Rubric = z.infer<typeof Rubric>
