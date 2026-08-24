/** an oracle: a structured direction and an enforceable check. */
import { z } from 'zod'
import { Expression, Polarity, Relation } from './expression.ts'
import { InteractionPointer } from './pointer.ts'
import { OracleId } from './primitives.ts'

/**
 * AD-3's five direction fields: the channel the sealed evaluator reads,
 * generated into prose by `seal`. Structured rather than free prose because
 * alignment against `check` is a computation over two declared structures.
 */
export const Direction = z.strictObject({
	evidenceTargets: z
		.array(InteractionPointer)
		.describe(
			'Interaction-rooted pointers only. AD-3 computes containment after quantifier substitution, so a target is always fully rooted and the bound-element spelling never appears here.',
		),
	relation: Relation.describe(
		"Drawn from AD-4's full sixteen-member vocabulary — eleven operators, three connectives, two quantifiers — not the operators alone.",
	),
	polarity: Polarity.describe(
		'Coin flip (a), settled: polarity is declared twice, here and on the oracle. AD-3 names it as one of the three axes the alignment predicate binds and AD-33 gives every check one, so declaring it once makes the alignment predicate vacuous on a third of its content. Duplication is what makes drift detectable, and the drift is deliberately not refined away: `direction-check-misaligned` needs the disagreement to stay representable.',
	),
	scope: z
		.string()
		.nullable()
		.describe(
			'Evaluator-facing, and exempt from the alignment predicate, which binds evidence targets, relation, and polarity only.',
		),
	negativeDomain: z
		.string()
		.nullable()
		.describe(
			'Evaluator-facing and exempt from alignment. `seal` renders it as an unordered set so the brief is byte-identical under reordering.',
		),
})

export type Direction = z.infer<typeof Direction>

export const Oracle = z.strictObject({
	id: OracleId,
	direction: Direction.nullable().describe(
		'`null` is half of what `oracle-missing-channel` fires on, so it must parse.',
	),
	check: Expression.nullable().describe(
		'`null` is the other half of `oracle-missing-channel`.',
	),
	polarity: Polarity.describe(
		'AD-33: every check declares one polarity, and it lives at oracle level rather than inside the expression tree. Required and explicit rather than defaulted to `expects-hold`: a Zod default diverges input and output mode and the explicit-null convention forbids implicit absence.',
	),
	commentary: z
		.string()
		.nullable()
		.describe(
			"AD-3's author documentation. No predicate reads it and `seal` never emits it, because a channel the evaluator reads and no predicate audits is the free-prose channel AD-3 exists to close.",
		),
})
