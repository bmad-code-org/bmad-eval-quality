/** the operand union and the recursive check expression tree. */
import { z } from 'zod'
import { EvidencePointer } from './pointer.ts'
import {
	Identifier,
	JsonValue,
	KeyedShapeDescriptor,
	KeyName,
} from './primitives.ts'

// AD-26: each operand form is a single-keyed object, and the reference-set form
// carries nothing else. A two-key and a one-key spelling produce schemas that
// reject each other's contracts, which is why the key count is fixed here
// rather than left to the author.
export const PointerOperand = z.strictObject({ pointer: EvidencePointer })
export const LiteralOperand = z.strictObject({ literal: JsonValue })
export const ReferenceSetOperand = z.strictObject({
	referenceSet: Identifier.describe(
		"A plain identifier. Deliberately not an enum of the contract's declared reference sets and deliberately not refined against them: an identifier the contract does not declare is `unresolved-reference-set`, a coded compile-time error, and a schema that rejected it would convert that code into an anonymous parse fault.",
	),
})

/**
 * Every tuple position takes this full union. Per-position operand legality is
 * the compiler's: AD-26 makes a reference-set operand outside its three legal
 * positions fire `malformed-operator-expression`, which only stays fireable if
 * the other positions admit it.
 */
export const Operand = z
	.union([PointerOperand, LiteralOperand, ReferenceSetOperand])
	.meta({
		id: 'Operand',
		description:
			"One of the three operand forms, each a single-keyed object. Named so the published schema carries it once as a shared definition rather than inlining it at seventeen use sites. Which forms are legal in which position is declared on each operator's own `operands`, never narrowed here.",
	})

export type Operand =
	| { pointer: string }
	| { literal: JsonValue }
	| { referenceSet: string }

// Coin flip (b), settled: the literal-array set operand is admitted, because
// AD-26 states where the *reference-set* operand is legal and states no
// prohibition on a literal, and the Gate C contract's state oracle needs the
// four-value enum ["queued","running","succeeded","failed"], which is not a
// collection location and has no business being a declared reference set.
export const LiteralSetOperand = z.strictObject({
	literal: z
		.array(JsonValue)
		.min(1)
		.describe(
			'Coin flip (b), settled: a literal set operand is admitted alongside the reference-set form, and is constrained to a non-empty array because `set-membership` against an empty set is unfalsifiable authoring rather than an observation about the world. This is the one deliberately narrowed operand position in the grammar; the cost is that `{ "literal": [] }` and a `{ "pointer" }` in this position are schema rejections rather than `malformed-operator-expression`.',
		),
})

export const SetOperand = z.union([ReferenceSetOperand, LiteralSetOperand])

export type SetOperand = { referenceSet: string } | { literal: JsonValue[] }

/** AD-33: one polarity per check, and one on the direction it must align with. */
export const Polarity = z.enum(['expects-hold', 'expects-violation'])

export type Polarity = z.infer<typeof Polarity>

export const SortOrder = z.enum(['ascending', 'descending'])

/** AD-4's eleven operators. */
export const OPERATOR_NAMES = [
	'equality',
	'deep-equality',
	'containment',
	'existence',
	'absence',
	'regex',
	'set-membership',
	'ordering',
	'count-tolerance',
	'shape',
	'covers-by-key',
] as const

/** AD-4's three connectives. */
export const CONNECTIVE_NAMES = ['all', 'any', 'not'] as const

/** AD-4's two collection quantifiers. */
export const QUANTIFIER_NAMES = ['for-all', 'for-any'] as const

/**
 * The sixteen-member vocabulary a direction's relation is drawn from. AD-3
 * fixes it as "AD-4's operator set", which is all sixteen: seven of the Gate C
 * contract's eight oracles declare `all`, `not`, or `for-all` as the relation —
 * only O-001, whose relation is `deep-equality`, is a bare operator — so typing
 * this to the eleven operators alone fails the primary accept fixture on seven
 * of eight.
 */
export const RELATION_VOCABULARY = [
	...OPERATOR_NAMES,
	...CONNECTIVE_NAMES,
	...QUANTIFIER_NAMES,
] as const

export const Relation = z.enum(RELATION_VOCABULARY)

export type Relation = z.infer<typeof Relation>

// AD-4 calls the regex dialect "always fully anchored" and gives a code only
// for backreferences and lookbehind, so anchoring is the schema's half and the
// rejected constructs are Epic 4's. Anchoring is a native pattern and exports;
// a backreference check is not expressible in JSON Schema and is not attempted
// here.
//
// This form checks the first and last character and nothing more, which is not
// the same as proving the pattern is fully anchored. It is wrong in both
// directions and both are recorded, because only one of them is harmless.
//
// Too permissive, verified on the pin: `^a|b$` parses as `(^a)|(b$)` and
// passes, and `^foo\$` ends in an escaped dollar and passes while matching any
// string that starts with `foo$`. Those join backreferences and lookbehind as
// Epic 4's, which is the admit-rule working as intended.
//
// Too strict, also verified: `(?:^a$)` and `(^a$)` are rejected although both
// are fully anchored ECMA-262. That direction is the one that costs something —
// a legal contract becomes an anonymous `schema-parse-failure` rather than a
// coded error, which is the conversion AC 8 exists to prevent. It is accepted
// rather than fixed because the epic's acceptance criteria assign anchoring to
// the schema and require it natively and exportably, and deciding anchoring
// properly needs a regex parser that does not belong in a schema and would not
// export. The workaround is exact and costs an author nothing: write
// `^(?:a|b)$` rather than `(?:^a$|^b$)`.
export const ANCHORING_RESIDUAL =
	'positional check: admits an unanchored alternation, rejects an anchored pattern wrapped in a group'
export const ANCHORED_PATTERN_FORM = /^\^[\s\S]*\$$/

export const AnchoredPattern = z
	.string()
	.regex(ANCHORED_PATTERN_FORM)
	.describe(
		'An ECMA-262 pattern, fully anchored: it begins with "^" and ends with "$". A named field rather than a `{ literal }` operand, so Epic 4\'s backreference and lookbehind check has one place to look instead of a JsonValue that may hold anything. The check is positional and is wrong in both directions. It admits patterns that are not anchored, such as the alternation "^a|b$" or a trailing "$" that is escaped; those are Epic 4\'s, alongside backreferences and lookbehind. It also rejects patterns that are anchored but wrapped in a group, such as "(^a$)" — write "^(?:a|b)$" rather than "(?:^a$|^b$)" and the form accepts it. Deciding anchoring properly requires parsing the pattern, which no JSON Schema keyword can express.',
	)

/**
 * The minimum operand count for `all` and `any`, settled here because AD-4
 * leaves the connective arities unstated. Zero operands makes `all` certify
 * vacuously, which is the fail-open shape AD-4's three-valued resolution exists
 * to prevent; one operand is the identity, and two spellings of one tree defeat
 * the structural containment AD-3's alignment predicate computes.
 */
export const CONNECTIVE_MINIMUM_ARITY = 2

/**
 * Every expression form whose operands are a fixed-length tuple, with its
 * arity. `not` is here because its single operand is a nested expression rather
 * than an operand; `all`, `any`, `for-all`, and `for-any` are not, because
 * their operand counts are variable or their operands are named fields.
 *
 * The constraint ledger is built from this table so the two cannot drift, and a
 * test asserts each entry against what the schema actually rejects.
 */
export const TUPLE_ARITY = {
	equality: 2,
	'deep-equality': 2,
	containment: 2,
	existence: 1,
	absence: 1,
	regex: 1,
	'set-membership': 2,
	ordering: 1,
	'count-tolerance': 1,
	shape: 1,
	'covers-by-key': 2,
	not: 1,
} as const satisfies Record<string, number>

export type Expression =
	| { op: 'equality'; operands: [Operand, Operand] }
	| { op: 'deep-equality'; operands: [Operand, Operand] }
	| { op: 'containment'; operands: [Operand, Operand] }
	| { op: 'existence'; operands: [Operand] }
	| { op: 'absence'; operands: [Operand] }
	| { op: 'regex'; operands: [Operand]; pattern: string }
	| { op: 'set-membership'; operands: [Operand, SetOperand] }
	| {
			op: 'ordering'
			operands: [Operand]
			key: string
			order: z.infer<typeof SortOrder>
	  }
	| {
			op: 'count-tolerance'
			operands: [Operand]
			expected: number
			tolerance: number
			relative: boolean
	  }
	| { op: 'shape'; operands: [Operand]; descriptor: KeyedShapeDescriptor }
	| {
			op: 'covers-by-key'
			operands: [Operand, Operand]
			expectedKey: string
			actualKey: string
	  }
	| { op: 'not'; operands: [Expression] }
	| { op: 'all'; operands: Expression[] }
	| { op: 'any'; operands: Expression[] }
	| { op: 'for-all'; collection: Operand; predicate: Expression }
	| { op: 'for-any'; collection: Operand; predicate: Expression }

/**
 * `check` is a recursive discriminated union on `op`. Operator arity is
 * enforced here as fixed-length tuples, which is the one deliberate exception
 * to the admit-rule and the epic's choice rather than this story's: AD-13
 * verified the constraint injection specifically for arity. The consequence for
 * Story 4.2 is that `malformed-operator-expression`'s arity limb is
 * schema-covered in v0, and its live limbs are the rejected regex constructs
 * and the operand-type violations the schema deliberately does not narrow.
 *
 * Declared before its members so the members may reference it; the lazy body
 * runs after module initialization, by which time they exist.
 *
 * Carries `.meta({ id })` for the same reason `JsonValue` does, and it is not
 * optional. Without it the tree exports as the generated `$defs.__schema0`,
 * which pins a positional name into Story 1.5's drift check and leaves the
 * constraint ledger's twelve arity entries with no stable address to name.
 */
export const Expression: z.ZodType<Expression> = z
	.lazy(() =>
		z.discriminatedUnion('op', [
			Equality,
			DeepEquality,
			Containment,
			Existence,
			Absence,
			RegexMatch,
			SetMembership,
			Ordering,
			CountTolerance,
			Shape,
			CoversByKey,
			Not,
			All,
			Any,
			ForAll,
			ForAny,
		]),
	)
	.meta({
		id: 'Expression',
		description:
			"A `check` expression tree over AD-4's closed vocabulary, discriminated on `op`. Exports as a `oneOf` of sixteen branches, each identified by its `op` const; a constraint ledger entry names a branch by that const rather than by position.",
	})

// AD-4 requires each operator to declare "a fixed arity and operand types in
// the published schema". Arity is structural, as fixed-length tuples; operand
// types cannot be, because narrowing a position would delete
// `malformed-operator-expression`'s operand-type limb. So the types are
// *declared* here, in text that survives the export, and Epic 4 enforces what
// the text says. A ledger entry records that split. This is the same treatment
// AD-36's numeric domain gets on `JsonValue`, and for the same reason: a
// requirement to express something in the published schema is not satisfied by
// a note in an implementation artifact.
const ADMIT_RULE =
	"Every position admits the full operand union on purpose. AD-26 makes a reference-set operand outside its three legal positions — `covers-by-key`'s expected operand, and the set operand of `set-membership` or `containment` — fail compilation under `malformed-operator-expression`, which only stays fireable if the other positions admit it. Epic 4 enforces the legality stated here; the schema does not narrow it."

const operandTypes = (statement: string): string => `${statement} ${ADMIT_RULE}`

const Equality = z.strictObject({
	op: z.literal('equality'),
	operands: z
		.tuple([Operand, Operand])
		.describe(
			operandTypes('Two operands, each legally a pointer or a literal.'),
		),
})

const DeepEquality = z.strictObject({
	op: z.literal('deep-equality'),
	operands: z
		.tuple([Operand, Operand])
		.describe(
			operandTypes('Two operands, each legally a pointer or a literal.'),
		),
})

const Containment = z.strictObject({
	op: z.literal('containment'),
	operands: z
		.tuple([Operand, Operand])
		.describe(
			operandTypes(
				'Two operands: the container is legally a pointer, and the set is legally a pointer, a literal, or a reference set.',
			),
		),
})

const Existence = z.strictObject({
	op: z.literal('existence'),
	operands: z
		.tuple([Operand])
		.describe(operandTypes('One operand, legally a pointer.')),
})

const Absence = z.strictObject({
	op: z.literal('absence'),
	operands: z
		.tuple([Operand])
		.describe(operandTypes('One operand, legally a pointer.')),
})

const RegexMatch = z.strictObject({
	op: z.literal('regex'),
	operands: z
		.tuple([Operand])
		.describe(operandTypes('One operand, legally a pointer.')),
	pattern: AnchoredPattern,
})

const SetMembership = z.strictObject({
	op: z.literal('set-membership'),
	operands: z
		.tuple([Operand, SetOperand])
		.describe(
			operandTypes(
				'Two operands: the value is legally a pointer, and the set is a reference set or a non-empty literal array. The set position is the one place the schema does narrow, and coin flip (b) records what that costs.',
			),
		),
})

// Arity settled here (Decision 7): a collection pointer plus a named key and a
// named order. The pairwise reading — pointer a precedes pointer b — was
// considered and rejected, because Epic 3 inherits the semantics and the
// pairwise form cannot express "this page is sorted by capturedAt", which is
// the only thing AD-4 says `ordering` is for.
const Ordering = z.strictObject({
	op: z.literal('ordering'),
	operands: z
		.tuple([Operand])
		.describe(operandTypes('One operand, legally a pointer to a collection.')),
	key: KeyName,
	order: SortOrder,
})

const CountTolerance = z.strictObject({
	op: z.literal('count-tolerance'),
	operands: z
		.tuple([Operand])
		.describe(operandTypes('One operand, legally a pointer to a collection.')),
	expected: z
		.int()
		.min(0)
		.describe(
			'The expected element count. Non-negative: a negative count is not a count, and no AD-5 code fires on one, so the schema is the enforcement point.',
		),
	tolerance: z
		.int()
		.min(0)
		.describe(
			'The permitted deviation from `expected`, non-negative for the same reason. When `relative` is declared the tolerance is read as whole percentage points, which is stated because AD-4 supplies no value space for the magnitude and Epic 3 inherits the semantics. An integer therefore cannot express a fractional relative tolerance such as 2.5 percent; widening the value space later is an additive `schemaVersion` bump under AD-11, and was not taken here because it would export as a bare `type: "number"` and cost a constraint ledger entry for a case no declaration needs yet.',
		),
	relative: z
		.boolean()
		.describe(
			'AD-4: the tolerance is absolute unless this flag is declared. Required and explicit rather than defaulted, because a Zod default diverges input and output mode and drops the key from the exported `required` list.',
		),
})

const Shape = z.strictObject({
	op: z.literal('shape'),
	operands: z
		.tuple([Operand])
		.describe(operandTypes('One operand, legally a pointer.')),
	descriptor: KeyedShapeDescriptor.describe(
		'AD-4: a closed descriptor, never an embedded JSON Schema. Typing it as a named field is what makes that structural, and it is a deliberate divergence from the Gate C fixture\'s `{ "literal": { … } }` spelling, where any JSON could sit.',
	),
})

const CoversByKey = z.strictObject({
	op: z.literal('covers-by-key'),
	operands: z
		.tuple([Operand, Operand])
		.describe(
			operandTypes(
				'Two operands: `expected` is legally a reference set, and `actual` is legally a pointer to a collection.',
			),
		),
	expectedKey: KeyName,
	actualKey: KeyName,
})

const Not = z.strictObject({
	op: z.literal('not'),
	operands: z
		.tuple([Expression])
		.describe(
			'One nested expression rather than an operand. A connective composes the tree; it never addresses evidence itself.',
		),
})

const All = z.strictObject({
	op: z.literal('all'),
	operands: z
		.array(Expression)
		.min(CONNECTIVE_MINIMUM_ARITY)
		.describe(
			'Two or more nested expressions rather than operands. The minimum is settled here because AD-4 leaves connective arity unstated: zero operands would certify vacuously and one is the identity.',
		),
})

const Any = z.strictObject({
	op: z.literal('any'),
	operands: z
		.array(Expression)
		.min(CONNECTIVE_MINIMUM_ARITY)
		.describe(
			'Two or more nested expressions rather than operands, for the same reason `all` carries the same minimum.',
		),
})

// A quantifier inside a quantifier, and `covers-by-key` inside one, are both
// structurally admitted on purpose. A quantifier-free predicate type would be
// elegant and would delete `quantifier-nesting-exceeded` from Epic 4 along with
// its fixture.
const ForAll = z
	.strictObject({
		op: z.literal('for-all'),
		collection: Operand,
		predicate: Expression,
	})
	.describe(
		operandTypes(
			'`collection` is legally a pointer to a collection, and `predicate` is the expression each bound element is tested against, addressed by the `@/` pointer spelling. A quantifier inside the predicate is structurally admitted so `quantifier-nesting-exceeded` keeps a shape to fire on.',
		),
	)

const ForAny = z
	.strictObject({
		op: z.literal('for-any'),
		collection: Operand,
		predicate: Expression,
	})
	.describe(
		operandTypes(
			'`collection` is legally a pointer to a collection, and `predicate` is the expression each bound element is tested against, addressed by the `@/` pointer spelling.',
		),
	)
