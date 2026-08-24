/**
 * AD-4's connectives, quantifiers, and three-valued resolution: the tree-walker
 * that turns an `Expression` into one `CheckResolutionValue`. Leaf operators are
 * Story 3.1's (`operators.ts`); `covers-by-key` is Story 3.3's. Operand
 * resolution, every pointer form including the bound-element `@/` form, is Story
 * 4.1's. `ResolveOperand` and `PointerDenotesCollection` are the consumer-side
 * contract it satisfies.
 */
import type { CheckResolutionValue } from '../schemas/evidence-artifact.ts'
import type { Expression, Operand } from '../schemas/expression.ts'
import {
	absence,
	containment,
	countTolerance,
	deepEquality,
	equality,
	existence,
	ordering,
	regexMatch,
	setMembership,
	shape,
} from './operators.ts'
import { ABSENT, type ResolvedValue } from './resolved-value.ts'

/**
 * Resolves one operand to its evidence value. `boundElement` is the element a
 * quantifier currently has bound, `ABSENT` outside any predicate — not `null`
 * (Decision 8): `JsonValue` already includes `null`, so only a third, distinct
 * value can tell "no active binding" apart from "bound to a JSON `null`
 * element." It is the only state `resolveCheck` threads through, so a `@/…`
 * operand has something to resolve against. Interpreting that form belongs to
 * AD-26's addressing grammar in Story 4.1; this type only fixes its shape.
 */
export type ResolveOperand = (
	operand: Operand,
	boundElement: ResolvedValue,
	artifactPath: string,
) => ResolvedValue

/**
 * Whether a `{ pointer }` operand's declared response descriptor types it as a
 * collection (AD-4's absent-collection-typed rule, `ARCHITECTURE-SPINE.md:191`).
 * Consulted only when `resolveOperand` returns `ABSENT` for a `{ pointer }`
 * operand; every other operand form is exempt (Decision 3). Takes the bare
 * pointer string, since only that branch of the union ever calls it. A
 * conforming implementation must return `false` for any bound-element (`@/…`)
 * pointer: this predicate is called unconditionally for every `{ pointer }`
 * operand including `@/…` ones, and a `true` answer there would break the
 * soft-delete agreement pair (AD-4's own worked example).
 */
export type PointerDenotesCollection = (pointer: string) => boolean

type ResolutionContext = {
	resolveOperand: ResolveOperand
	pointerDenotesCollection: PointerDenotesCollection
	regexMatchStepBudget: number
	artifactPath: string
}

/**
 * AD-4's one closed introduction condition, checked per operand and applied
 * uniformly (Decision 1): the resolved value and its operand are the only inputs.
 *
 * Two permanent consequences of that uniform reading, same class as Decision
 * 7's `{ literal: [] }` case (Decision 10): a `count-tolerance` node asserting
 * `expected: 0` over a genuinely empty collection can never resolve `true`,
 * because this interception fires first; and `existence` over a pointer
 * resolving to a present-but-empty array resolves `insufficient-evidence`, not
 * `true`, even though `existence` only asks about presence.
 */
function operandDenotesEmptyCollection(
	resolved: ResolvedValue,
	operand: Operand,
	pointerDenotesCollection: PointerDenotesCollection,
): boolean {
	if (Array.isArray(resolved) && resolved.length === 0) return true
	if (resolved !== ABSENT) return false
	// Only a `{ pointer }` operand can carry a declared collection type
	// (Decision 3). `{ literal }` never resolves ABSENT, and an ABSENT
	// `{ referenceSet }` means `unresolved-reference-set` slipped past
	// compilation, which this story assumes cannot happen.
	return 'pointer' in operand && pointerDenotesCollection(operand.pointer)
}

function emptyCollectionResult(): CheckResolutionValue {
	return {
		resolution: 'insufficient-evidence',
		introductionCondition: 'empty-collection',
		children: [],
	}
}

function booleanResult(result: boolean): CheckResolutionValue {
	return {
		resolution: result ? 'true' : 'false',
		introductionCondition: null,
		children: [],
	}
}

// Decision 6: checked across every operand before any operator runs, so the
// interception replaces a leaf's own two-valued answer outright.
function anyOperandEmpty(
	pairs: readonly { operand: Operand; resolved: ResolvedValue }[],
	pointerDenotesCollection: PointerDenotesCollection,
): boolean {
	return pairs.some(({ operand, resolved }) =>
		operandDenotesEmptyCollection(resolved, operand, pointerDenotesCollection),
	)
}

// Derived from `CheckResolutionValue` so the two cannot drift apart.
type Resolution = CheckResolutionValue['resolution']

/** `not(insufficient-evidence)` is terminal under both polarities (AD-4). */
function notOf(child: Resolution): Resolution {
	if (child === 'insufficient-evidence') return 'insufficient-evidence'
	return child === 'true' ? 'false' : 'true'
}

/**
 * A genuine `false` stays decisive beside an `insufficient-evidence` sibling: a
 * detected defect is information. `CONNECTIVE_MINIMUM_ARITY` (`expression.ts`)
 * keeps the array from ever being empty, so the vacuous `true` never arises.
 */
function allOf(children: Resolution[]): Resolution {
	if (children.some((child) => child === 'false')) return 'false'
	if (children.some((child) => child === 'insufficient-evidence')) {
		return 'insufficient-evidence'
	}
	return 'true'
}

/**
 * Weaker than disjunction on purpose: a sibling resolving `true` never rescues
 * one that examined nothing. Same arity floor as `allOf`.
 */
function anyOf(children: Resolution[]): Resolution {
	if (children.some((child) => child === 'insufficient-evidence')) {
		return 'insufficient-evidence'
	}
	if (children.some((child) => child === 'true')) return 'true'
	return 'false'
}

/**
 * A quantifier's `collection` field resolves through the same
 * `resolveOperand`/`pointerDenotesCollection` pair as any other operand, with one
 * exception (Decision 3): `ABSENT` here is unconditionally an empty collection
 * and `pointerDenotesCollection` is never consulted. A `collection` field is a
 * collection by definition, so there is nothing to disambiguate.
 */
function resolveQuantifier(
	op: 'for-all' | 'for-any',
	collectionOperand: Operand,
	predicate: Expression,
	boundElement: ResolvedValue,
	ctx: ResolutionContext,
): CheckResolutionValue {
	// Resolved once, before the loop, against whatever `boundElement` was
	// already in scope (an outer quantifier's element if nested, `ABSENT` at
	// the root) — never against an element this quantifier's own loop below
	// has not bound yet.
	const collection = ctx.resolveOperand(
		collectionOperand,
		boundElement,
		ctx.artifactPath,
	)
	if (
		collection === ABSENT ||
		!Array.isArray(collection) ||
		collection.length === 0
	) {
		// One guard, three cases: ABSENT (Decision 3), a non-array type mismatch
		// (Decision 4), and a genuinely empty array. All three collapse onto the
		// same `empty-collection` value (Decision 11) — the evidence artifact
		// cannot tell which of the three fired. Separating them would need a
		// second introduction-condition value, a schema change out of scope here.
		return emptyCollectionResult()
	}
	const children = collection.map((element) =>
		resolveNode(predicate, element, ctx),
	)
	const childResolutions = children.map((child) => child.resolution)
	return {
		resolution:
			op === 'for-all' ? allOf(childResolutions) : anyOf(childResolutions),
		// Decision 9: null even when the fold below reads insufficient-evidence.
		// This node did not trip the empty-collection condition itself; a child
		// did, and still carries it, reachable through `children`.
		introductionCondition: null,
		children,
	}
}

// Shared by the six single-operand leaves: resolve, intercept on the
// empty-collection condition, otherwise hand the value to the operator.
function resolveSingleOperand(
	operand: Operand,
	boundElement: ResolvedValue,
	ctx: ResolutionContext,
	evaluate: (resolved: ResolvedValue) => boolean,
): CheckResolutionValue {
	const resolved = ctx.resolveOperand(operand, boundElement, ctx.artifactPath)
	if (anyOperandEmpty([{ operand, resolved }], ctx.pointerDenotesCollection)) {
		return emptyCollectionResult()
	}
	return booleanResult(evaluate(resolved))
}

// Shared by `equality` and `deep-equality`, which differ only in the operator
// they call.
function resolveEqualityLike(
	operands: readonly [Operand, Operand],
	evaluate: (
		a: ResolvedValue,
		b: ResolvedValue,
		artifactPath: string,
	) => boolean,
	boundElement: ResolvedValue,
	ctx: ResolutionContext,
): CheckResolutionValue {
	const [aOperand, bOperand] = operands
	const a = ctx.resolveOperand(aOperand, boundElement, ctx.artifactPath)
	const b = ctx.resolveOperand(bOperand, boundElement, ctx.artifactPath)
	if (
		anyOperandEmpty(
			[
				{ operand: aOperand, resolved: a },
				{ operand: bOperand, resolved: b },
			],
			ctx.pointerDenotesCollection,
		)
	) {
		return emptyCollectionResult()
	}
	return booleanResult(evaluate(a, b, ctx.artifactPath))
}

/**
 * The recursive worker behind `resolveCheck`. Every `RuntimeFault` a leaf
 * operator throws (only `regexMatch`'s two, currently) propagates undecorated;
 * no branch here catches one.
 */
function resolveNode(
	expression: Expression,
	boundElement: ResolvedValue,
	ctx: ResolutionContext,
): CheckResolutionValue {
	switch (expression.op) {
		case 'not': {
			const [child] = expression.operands
			const resolved = resolveNode(child, boundElement, ctx)
			return {
				resolution: notOf(resolved.resolution),
				// Decision 9: a fold, not a firing — `resolved` still carries the
				// condition if it is the one that tripped it.
				introductionCondition: null,
				children: [resolved],
			}
		}
		case 'all': {
			// Total, never short-circuiting, over resolutions: every operand is
			// recursed into before folding, whatever an earlier one resolved. This
			// does NOT hold over faults (P5): `.map()` still stops at the first
			// operand whose own resolution throws, so a later operand's fault is
			// never reached once an earlier one throws. "Total" is about not
			// skipping a resolved child's evaluation to short-circuit the fold, not
			// about running every operand past a thrown fault.
			const children = expression.operands.map((operand) =>
				resolveNode(operand, boundElement, ctx),
			)
			return {
				resolution: allOf(children.map((child) => child.resolution)),
				// Decision 9: a fold. The tripped child, if any, carries the
				// condition itself, in `children`.
				introductionCondition: null,
				children,
			}
		}
		case 'any': {
			const children = expression.operands.map((operand) =>
				resolveNode(operand, boundElement, ctx),
			)
			return {
				resolution: anyOf(children.map((child) => child.resolution)),
				// Decision 9: a fold, same reasoning as `all` above.
				introductionCondition: null,
				children,
			}
		}
		case 'for-all':
		case 'for-any':
			return resolveQuantifier(
				expression.op,
				expression.collection,
				expression.predicate,
				boundElement,
				ctx,
			)
		case 'covers-by-key':
			// Decision 5: a gap in this dispatch table, never a condition over the
			// evidence, so a plain Error and no RuntimeFault. Story 3.3 replaces
			// this branch.
			throw new Error(
				"'covers-by-key' has no operator implementation yet. Story 3.3 " +
					'builds it; resolveCheck should never be handed this node before ' +
					'then.',
			)
		case 'equality':
			return resolveEqualityLike(
				expression.operands,
				equality,
				boundElement,
				ctx,
			)
		case 'deep-equality':
			return resolveEqualityLike(
				expression.operands,
				deepEquality,
				boundElement,
				ctx,
			)
		case 'containment': {
			const [containerOperand, candidateOperand] = expression.operands
			const container = ctx.resolveOperand(
				containerOperand,
				boundElement,
				ctx.artifactPath,
			)
			const candidate = ctx.resolveOperand(
				candidateOperand,
				boundElement,
				ctx.artifactPath,
			)
			if (
				anyOperandEmpty(
					[
						{ operand: containerOperand, resolved: container },
						{ operand: candidateOperand, resolved: candidate },
					],
					ctx.pointerDenotesCollection,
				)
			) {
				return emptyCollectionResult()
			}
			// The array-narrowing guard applies only to a `{ referenceSet }`
			// candidate. A `{ pointer }` or `{ literal }` candidate legally resolves
			// to a scalar (the stdout/stderr substring shape), and `containment`
			// already handles both shapes.
			if ('referenceSet' in candidateOperand && !Array.isArray(candidate)) {
				throw new Error(
					"containment's referenceSet-candidate guard: a { referenceSet } " +
						'operand must resolve to an array, which the schema guarantees. ' +
						'The injected ResolveOperand returned something else — either a ' +
						'resolver integration bug, or an unresolved reference set that ' +
						'slipped past compilation (unresolved-reference-set); this guard ' +
						'cannot tell the two apart.',
				)
			}
			return booleanResult(containment(container, candidate, ctx.artifactPath))
		}
		case 'existence': {
			const [operand] = expression.operands
			return resolveSingleOperand(operand, boundElement, ctx, (resolved) =>
				existence(resolved, ctx.artifactPath),
			)
		}
		case 'absence': {
			const [operand] = expression.operands
			return resolveSingleOperand(operand, boundElement, ctx, (resolved) =>
				absence(resolved, ctx.artifactPath),
			)
		}
		case 'regex': {
			const [operand] = expression.operands
			const { pattern } = expression
			return resolveSingleOperand(operand, boundElement, ctx, (resolved) =>
				regexMatch(
					resolved,
					pattern,
					ctx.regexMatchStepBudget,
					ctx.artifactPath,
				),
			)
		}
		case 'set-membership': {
			const [valueOperand, setOperand] = expression.operands
			const value = ctx.resolveOperand(
				valueOperand,
				boundElement,
				ctx.artifactPath,
			)
			const resolvedSet = ctx.resolveOperand(
				setOperand,
				boundElement,
				ctx.artifactPath,
			)
			if (
				anyOperandEmpty(
					[
						{ operand: valueOperand, resolved: value },
						{ operand: setOperand, resolved: resolvedSet },
					],
					ctx.pointerDenotesCollection,
				)
			) {
				return emptyCollectionResult()
			}
			// The set position needs the `JsonValue[]` the schema already
			// guarantees here. Narrow at runtime so a broken resolver fails loudly.
			if (!Array.isArray(resolvedSet)) {
				throw new Error(
					"set-membership's set-operand guard: its SetOperand position must " +
						'resolve to an array, which the schema guarantees. The injected ' +
						'ResolveOperand returned something else — either a resolver ' +
						'integration bug, or an unresolved reference set that slipped ' +
						'past compilation (unresolved-reference-set); this guard cannot ' +
						'tell the two apart.',
				)
			}
			return booleanResult(setMembership(value, resolvedSet, ctx.artifactPath))
		}
		case 'ordering': {
			const [operand] = expression.operands
			const { key, order } = expression
			return resolveSingleOperand(operand, boundElement, ctx, (resolved) =>
				ordering(resolved, key, order, ctx.artifactPath),
			)
		}
		case 'count-tolerance': {
			const [operand] = expression.operands
			const { expected, tolerance, relative } = expression
			return resolveSingleOperand(operand, boundElement, ctx, (resolved) =>
				countTolerance(
					resolved,
					expected,
					tolerance,
					relative,
					ctx.artifactPath,
				),
			)
		}
		case 'shape': {
			const [operand] = expression.operands
			const { descriptor } = expression
			return resolveSingleOperand(operand, boundElement, ctx, (resolved) =>
				shape(resolved, descriptor, ctx.artifactPath),
			)
		}
		default: {
			// Runtime exhaustiveness guard (P16): `expression` is typed `never` here
			// because every union member has its own case above. Reachable only from
			// an out-of-union node (unvalidated input, or a future schema version) —
			// fails loudly with the offending `op` rather than returning `undefined`
			// and crashing obscurely at the call site.
			const exhaustiveCheck: never = expression
			throw new Error(
				`resolveNode: unrecognized expression.op ${JSON.stringify((exhaustiveCheck as Expression).op)}`,
			)
		}
	}
}

/**
 * The public entry point. Walks `expression` and produces one
 * `CheckResolutionValue`, exactly what `Outcome.checkResolution` needs,
 * unmodified. `boundElement` starts `ABSENT` at the root (Decision 8).
 */
export function resolveCheck(
	expression: Expression,
	resolveOperand: ResolveOperand,
	pointerDenotesCollection: PointerDenotesCollection,
	regexMatchStepBudget: number,
	artifactPath: string,
): CheckResolutionValue {
	return resolveNode(expression, ABSENT, {
		resolveOperand,
		pointerDenotesCollection,
		regexMatchStepBudget,
		artifactPath,
	})
}
