/**
 * AD-4's connectives, quantifiers, and three-valued resolution: the tree-walker
 * that turns an `Expression` into one `CheckResolutionValue`. Leaf operators,
 * `covers-by-key` included, live in `operators.ts`. Operand resolution, every
 * pointer form including the bound-element `@/` form, is injected;
 * `evidence-resolution.ts` supplies it, and `ResolveOperand`,
 * `PointerDenotesCollection`, and `ReferenceSetKeys` are the consumer-side
 * contract it satisfies.
 */
import type { CheckResolutionValue } from '../schemas/evidence-artifact.ts'
import type { Expression, Operand, SetOperand } from '../schemas/expression.ts'
import type { JsonValue } from '../schemas/primitives.ts'
import {
	absence,
	containment,
	countTolerance,
	coversByKey,
	deepEquality,
	equality,
	existence,
	keyValueOf,
	ordering,
	regexMatch,
	setMembership,
	shape,
} from './operators.ts'
import { ABSENT, type ResolvedValue } from './resolved-value.ts'

/**
 * Resolves one operand to its evidence value. `boundElement` is the element a
 * quantifier currently has bound, `ABSENT` outside any predicate: not `null`,
 * since `JsonValue` already includes `null` and only a third, distinct value
 * can tell "no active binding" apart from "bound to a JSON `null` element."
 * Interpreting the `@/…` form itself belongs to AD-26's addressing grammar in
 * `evidence-resolution.ts`; this type only fixes its shape.
 */
export type ResolveOperand = (
	operand: Operand,
	boundElement: ResolvedValue,
	artifactPath: string,
) => ResolvedValue

/**
 * Whether a `{ pointer }` operand's declared response descriptor types it as a
 * collection: AD-4 counts such a pointer resolving `absent` as an empty
 * collection for the `insufficient-evidence` invariant. Consulted only when
 * `resolveOperand` returns `ABSENT` for a `{ pointer }` operand; every other
 * operand form is exempt. Takes the bare pointer string, since only that
 * branch of the union ever calls it. A
 * conforming implementation must return `false` for any bound-element (`@/…`)
 * pointer: this predicate is called unconditionally for every `{ pointer }`
 * operand including `@/…` ones, and a `true` answer there would break the
 * soft-delete agreement pair (AD-4's own worked example).
 */
export type PointerDenotesCollection = (pointer: string) => boolean

/**
 * The `keys` each declared reference set names, by identifier.
 * `set-membership`'s set position reads the single declared key off each
 * member (`reference-set.ts`), and the members map the injected
 * `ResolveOperand` closes over has already discarded the keys, so they travel
 * separately. Plain data, because `PreflightPlan` carries this through to
 * its reducer and is compared by value, which a closure fails.
 * `evidence-resolution.ts` builds it from a contract.
 */
export type ReferenceSetKeys = Readonly<Record<string, readonly string[]>>

type ResolutionContext = {
	resolveOperand: ResolveOperand
	pointerDenotesCollection: PointerDenotesCollection
	referenceSetKeys: ReferenceSetKeys
	regexMatchStepBudget: number
	artifactPath: string
}

/**
 * Whether the operator holding an operand reads a property of the collection
 * itself. `total` is a closed list of three: `count-tolerance` reads its
 * cardinality, `existence` and `absence` read its presence, and all three have
 * an answer over a collection observed to be present and empty.
 * `needs-a-member` is every other operator, and it is what an operator a later
 * schema version admits arrives with.
 *
 * The list is enumerated here because it is narrower than "the operators that
 * could answer over an observed `[]`". Five of the `needs-a-member` operators
 * could: `equality` and `deepEquality` compare two empty arrays as equal, and
 * `shape`, `regexMatch`, and `setMembership` answer false on the type alone.
 * They stay intercepted because `anyOperandEmpty` applies one totality across
 * every operand of a leaf at once, so marking `equality` would also stop a
 * `{ literal: [] }` operand from tripping, and an author-supplied empty array
 * is subject to the invariant like any other. AD-4 records the disagreement
 * that leaves standing: `deep-equality(coll, [])` abstains over evidence where
 * `count-tolerance(coll, 0, 0)` resolves.
 *
 * This is the only axis on which AD-4's introduction condition varies, and it
 * separates "we could not observe enough to answer" from "we observed an
 * answer". A collection-typed pointer that resolved `absent` is unobserved
 * under both values and always trips.
 */
type EmptyCollectionTotality = 'total' | 'needs-a-member'

/**
 * AD-4's one closed introduction condition, checked per operand. Two inputs
 * decide it: what the operand resolved to, and whether the operator can answer
 * from an empty collection.
 *
 * An operand that resolved to a present, empty array reached an evidence
 * channel that worked and had nothing in it. That stops a `needs-a-member`
 * operator, which would otherwise report a vacuous truth over no elements.
 * A `total` operator has its answer: the cardinality is zero, the value is
 * present. AD-4's own rule keeps a detected defect a detection, and that is
 * what makes the second case a resolution.
 *
 * The `absent` branch does not vary. A collection-typed pointer that did not
 * resolve is the missing page AD-4 folds into this condition to close the
 * soft-delete fail-open, and no operator gets to read a missing collection as
 * an empty one.
 */
function operandDenotesEmptyCollection(
	resolved: ResolvedValue,
	operand: Operand,
	pointerDenotesCollection: PointerDenotesCollection,
	totality: EmptyCollectionTotality,
): boolean {
	if (resolved !== ABSENT) {
		if (totality === 'total') return false
		return Array.isArray(resolved) && resolved.length === 0
	}
	// Only a `{ pointer }` operand can carry a declared collection type.
	// `{ literal }` never resolves ABSENT, and an ABSENT `{ referenceSet }`
	// means `unresolved-reference-set` slipped past compilation, which this
	// module assumes cannot happen.
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

// Checked across every operand before any operator runs, so the interception
// replaces a leaf's own two-valued answer outright.
function anyOperandEmpty(
	pairs: readonly { operand: Operand; resolved: ResolvedValue }[],
	pointerDenotesCollection: PointerDenotesCollection,
	totality: EmptyCollectionTotality,
): boolean {
	return pairs.some(({ operand, resolved }) =>
		operandDenotesEmptyCollection(
			resolved,
			operand,
			pointerDenotesCollection,
			totality,
		),
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
 * exception: `ABSENT` here is unconditionally an empty collection and
 * `pointerDenotesCollection` is never consulted. A `collection` field is a
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
	// the root): never against an element this quantifier's own loop below
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
		// One guard, three cases: ABSENT, a non-array type mismatch, and a
		// genuinely empty array. All three collapse onto the same
		// `empty-collection` value: the evidence artifact cannot tell which of the
		// three fired. Separating them would need a second introduction-condition
		// value, a schema change out of scope here.
		return emptyCollectionResult()
	}
	const children = collection.map((element) =>
		resolveNode(predicate, element, ctx),
	)
	const childResolutions = children.map((child) => child.resolution)
	return {
		resolution:
			op === 'for-all' ? allOf(childResolutions) : anyOf(childResolutions),
		// Null even when the fold below reads insufficient-evidence. This node did
		// not trip the empty-collection condition itself; a child did, and still
		// carries it, reachable through `children`.
		introductionCondition: null,
		children,
	}
}

// Shared by the six single-operand leaves: resolve, intercept on the
// empty-collection condition, otherwise hand the value to the operator. Each
// caller declares its own totality, since that is the one thing the six
// disagree on.
function resolveSingleOperand(
	operand: Operand,
	boundElement: ResolvedValue,
	ctx: ResolutionContext,
	totality: EmptyCollectionTotality,
	evaluate: (resolved: ResolvedValue) => boolean,
): CheckResolutionValue {
	const resolved = ctx.resolveOperand(operand, boundElement, ctx.artifactPath)
	if (
		anyOperandEmpty(
			[{ operand, resolved }],
			ctx.pointerDenotesCollection,
			totality,
		)
	) {
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
			'needs-a-member',
		)
	) {
		return emptyCollectionResult()
	}
	return booleanResult(evaluate(a, b, ctx.artifactPath))
}

// One handler per `Expression['op']`, narrowed to that variant so a handler's
// body reads exactly like the switch case it replaces. Keyed lookup in
// `operatorHandlers` below is what used to be the switch's case labels.
type OperatorHandler<Op extends Expression['op']> = (
	expression: Extract<Expression, { op: Op }>,
	boundElement: ResolvedValue,
	ctx: ResolutionContext,
) => CheckResolutionValue

function resolveNotNode(
	expression: Extract<Expression, { op: 'not' }>,
	boundElement: ResolvedValue,
	ctx: ResolutionContext,
): CheckResolutionValue {
	const [child] = expression.operands
	const resolved = resolveNode(child, boundElement, ctx)
	return {
		resolution: notOf(resolved.resolution),
		// A fold, not a firing. `resolved` still carries the condition if it is
		// the one that tripped it.
		introductionCondition: null,
		children: [resolved],
	}
}

// Shared by `all` and `any`, which differ only in the fold they apply.
function resolveConnective(
	expression: Extract<Expression, { op: 'all' | 'any' }>,
	fold: (children: Resolution[]) => Resolution,
	boundElement: ResolvedValue,
	ctx: ResolutionContext,
): CheckResolutionValue {
	// Total, never short-circuiting, over resolutions: every operand is
	// recursed into before folding, whatever an earlier one resolved. Not
	// total over faults (P5): `.map()` still stops at the first operand whose
	// own resolution throws, so a later operand's fault is never reached.
	const children = expression.operands.map((operand) =>
		resolveNode(operand, boundElement, ctx),
	)
	return {
		resolution: fold(children.map((child) => child.resolution)),
		// A fold. The tripped child, if any, carries the condition itself, in
		// `children`.
		introductionCondition: null,
		children,
	}
}

function resolveAllNode(
	expression: Extract<Expression, { op: 'all' }>,
	boundElement: ResolvedValue,
	ctx: ResolutionContext,
): CheckResolutionValue {
	return resolveConnective(expression, allOf, boundElement, ctx)
}

function resolveAnyNode(
	expression: Extract<Expression, { op: 'any' }>,
	boundElement: ResolvedValue,
	ctx: ResolutionContext,
): CheckResolutionValue {
	return resolveConnective(expression, anyOf, boundElement, ctx)
}

function resolveQuantifierNode(
	expression: Extract<Expression, { op: 'for-all' | 'for-any' }>,
	boundElement: ResolvedValue,
	ctx: ResolutionContext,
): CheckResolutionValue {
	return resolveQuantifier(
		expression.op,
		expression.collection,
		expression.predicate,
		boundElement,
		ctx,
	)
}

function resolveCoversByKeyNode(
	expression: Extract<Expression, { op: 'covers-by-key' }>,
	boundElement: ResolvedValue,
	ctx: ResolutionContext,
): CheckResolutionValue {
	const [expectedOperand, actualOperand] = expression.operands
	const { expectedKey, actualKey } = expression
	const expectedResolved = ctx.resolveOperand(
		expectedOperand,
		boundElement,
		ctx.artifactPath,
	)
	const actualResolved = ctx.resolveOperand(
		actualOperand,
		boundElement,
		ctx.artifactPath,
	)
	// Checked first and unconditionally, before anything else looks at
	// `actual`. A malformed `expected` is a resolver integration bug, never a
	// data outcome, and must never be masked by whatever `actual` resolved to,
	// including a benign empty collection.
	if (expectedResolved !== ABSENT && !Array.isArray(expectedResolved)) {
		throw new Error(
			"covers-by-key's expected-operand guard: a reference-set operand " +
				'must resolve to ABSENT or an array, which the schema guarantees. ' +
				'The injected ResolveOperand returned something else — either a ' +
				'resolver integration bug, or an unresolved reference set that ' +
				'slipped past compilation (unresolved-reference-set); this guard ' +
				'cannot tell the two apart.',
		)
	}
	// Genuine emptiness (AD-4's "two empty collections" case, generalized to a
	// single empty operand) applies only once both operands are confirmed
	// ordinary, present collections. An ABSENT `actual` is AD-26's decisive
	// `false` over a pointer that did not resolve; a non-array `actual` is an
	// operand type `covers-by-key` does not accept, which AD-4 assigns to
	// `malformed-operator-expression` and which resolves `false` here because
	// no compile-time check covers this position. Both outrank emptiness.
	// Delegating to `coversByKey` for those two cases keeps the check
	// single-sourced: it already implements both as its own top guards.
	const bothPresentArrays =
		expectedResolved !== ABSENT &&
		actualResolved !== ABSENT &&
		Array.isArray(actualResolved)
	if (
		bothPresentArrays &&
		(expectedResolved.length === 0 || actualResolved.length === 0)
	) {
		return emptyCollectionResult()
	}
	return booleanResult(
		coversByKey(
			expectedResolved,
			actualResolved,
			expectedKey,
			actualKey,
			ctx.artifactPath,
		),
	)
}

function resolveEqualityNode(
	expression: Extract<Expression, { op: 'equality' }>,
	boundElement: ResolvedValue,
	ctx: ResolutionContext,
): CheckResolutionValue {
	return resolveEqualityLike(expression.operands, equality, boundElement, ctx)
}

function resolveDeepEqualityNode(
	expression: Extract<Expression, { op: 'deep-equality' }>,
	boundElement: ResolvedValue,
	ctx: ResolutionContext,
): CheckResolutionValue {
	return resolveEqualityLike(
		expression.operands,
		deepEquality,
		boundElement,
		ctx,
	)
}

function resolveContainmentNode(
	expression: Extract<Expression, { op: 'containment' }>,
	boundElement: ResolvedValue,
	ctx: ResolutionContext,
): CheckResolutionValue {
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
			'needs-a-member',
		)
	) {
		return emptyCollectionResult()
	}
	// The array-narrowing guard applies only to a `{ referenceSet }` candidate.
	// A `{ pointer }` or `{ literal }` candidate legally resolves to a scalar
	// (the stdout/stderr substring shape), and `containment` already handles
	// both shapes.
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

function resolveExistenceNode(
	expression: Extract<Expression, { op: 'existence' }>,
	boundElement: ResolvedValue,
	ctx: ResolutionContext,
): CheckResolutionValue {
	const [operand] = expression.operands
	return resolveSingleOperand(operand, boundElement, ctx, 'total', (resolved) =>
		existence(resolved, ctx.artifactPath),
	)
}

function resolveAbsenceNode(
	expression: Extract<Expression, { op: 'absence' }>,
	boundElement: ResolvedValue,
	ctx: ResolutionContext,
): CheckResolutionValue {
	const [operand] = expression.operands
	return resolveSingleOperand(operand, boundElement, ctx, 'total', (resolved) =>
		absence(resolved, ctx.artifactPath),
	)
}

function resolveRegexNode(
	expression: Extract<Expression, { op: 'regex' }>,
	boundElement: ResolvedValue,
	ctx: ResolutionContext,
): CheckResolutionValue {
	const [operand] = expression.operands
	const { pattern } = expression
	return resolveSingleOperand(
		operand,
		boundElement,
		ctx,
		'needs-a-member',
		(resolved) =>
			regexMatch(resolved, pattern, ctx.regexMatchStepBudget, ctx.artifactPath),
	)
}

/**
 * Reads the single declared key off each member of a `{ referenceSet }` set
 * operand. `reference-set.ts` declares members as objects so one declaration
 * serves both operators, and states that "a `set-membership` operand against
 * the same set reads the single named key". This is where that reading
 * happens, and without it AD-20 rule 6's injection form can never answer
 * `true`: the value operand resolves to a scalar, and `setMembership` compares
 * whole members by digest, so a scalar against an object is always `false`.
 *
 * Scoped to this one operator position on purpose. `covers-by-key` projects
 * both sides itself on `expectedKey` and `actualKey`, and `containment`
 * matches whole members, so both want the members unprojected. The injected
 * `ResolveOperand` is handed one operand at a time and cannot see which
 * operator position it is filling, which is why the projection lives at the
 * resolution site.
 *
 * The option turned down: an explicit `memberKey` field on `set-membership`
 * mirroring `covers-by-key`'s `expectedKey`. It is symmetric with its sibling
 * and it carries a multi-key set, at the price of a grammar change to a
 * published artifact, an eval-contract `schemaVersion` bump, and
 * published-schema drift, for a case no shipped contract has. Revisit it the
 * first time a real contract wants a multi-key set in this position.
 *
 * Both throws are unreachable for a compiled contract:
 * `checkOperandLegality` rejects a multi-key reference set in this position,
 * and a member missing the declared key, under
 * `malformed-operator-expression`. They throw, because a set this function
 * cannot project carries no membership answer to give.
 */
function projectSetOperand(
	resolvedSet: ResolvedValue,
	setOperand: SetOperand,
	ctx: ResolutionContext,
): ResolvedValue {
	if (!('referenceSet' in setOperand)) return resolvedSet
	const { referenceSet } = setOperand
	// `Object.hasOwn`, the same prototype-chain guard `makeResolveOperand`
	// applies to its own maps: `Identifier`'s charset admits `constructor`.
	const keys = Object.hasOwn(ctx.referenceSetKeys, referenceSet)
		? ctx.referenceSetKeys[referenceSet]
		: undefined
	// No declared keys means the contract declares no such reference set,
	// which compilation rejects under `unresolved-reference-set`; a non-array
	// is the array guard below reporting whatever the resolver returned. Both
	// pass through so exactly one guard speaks for each.
	if (keys === undefined || !Array.isArray(resolvedSet)) return resolvedSet
	if (keys.length !== 1) {
		throw new Error(
			`set-membership's set-operand projection: referenceSet "${referenceSet}" declares ${keys.length} keys, and this position reads exactly one. A multi-key set here is malformed-operator-expression, which compilation rejects.`,
		)
	}
	const key = keys[0] as string
	return resolvedSet.map((member) => {
		const keyValue = keyValueOf(member, key)
		if (keyValue === ABSENT) {
			throw new Error(
				`set-membership's set-operand projection: a member of referenceSet "${referenceSet}" carries no own property "${key}", the key it declares. That is malformed-operator-expression, which compilation rejects.`,
			)
		}
		return keyValue
	}) as JsonValue[]
}

function resolveSetMembershipNode(
	expression: Extract<Expression, { op: 'set-membership' }>,
	boundElement: ResolvedValue,
	ctx: ResolutionContext,
): CheckResolutionValue {
	const [valueOperand, setOperand] = expression.operands
	const value = ctx.resolveOperand(valueOperand, boundElement, ctx.artifactPath)
	// Projected before the empty-collection interception and the array guard
	// below, so both read the one value the operator will see. Projection
	// preserves length and array-ness, so neither answer moves.
	const resolvedSet = projectSetOperand(
		ctx.resolveOperand(setOperand, boundElement, ctx.artifactPath),
		setOperand,
		ctx,
	)
	if (
		anyOperandEmpty(
			[
				{ operand: valueOperand, resolved: value },
				{ operand: setOperand, resolved: resolvedSet },
			],
			ctx.pointerDenotesCollection,
			'needs-a-member',
		)
	) {
		return emptyCollectionResult()
	}
	// The set position needs the `JsonValue[]` the schema already guarantees
	// here. Narrow at runtime so a broken resolver fails loudly.
	if (!Array.isArray(resolvedSet)) {
		throw new Error(
			"set-membership's set-operand guard: its SetOperand position must " +
				'resolve to an array, which the schema guarantees. The injected ' +
				'ResolveOperand returned something else — either a resolver ' +
				'integration bug, or an unresolved reference set that slipped past ' +
				'compilation (unresolved-reference-set); this guard cannot tell the ' +
				'two apart.',
		)
	}
	return booleanResult(setMembership(value, resolvedSet, ctx.artifactPath))
}

function resolveOrderingNode(
	expression: Extract<Expression, { op: 'ordering' }>,
	boundElement: ResolvedValue,
	ctx: ResolutionContext,
): CheckResolutionValue {
	const [operand] = expression.operands
	const { key, order } = expression
	return resolveSingleOperand(
		operand,
		boundElement,
		ctx,
		'needs-a-member',
		(resolved) => ordering(resolved, key, order, ctx.artifactPath),
	)
}

function resolveCountToleranceNode(
	expression: Extract<Expression, { op: 'count-tolerance' }>,
	boundElement: ResolvedValue,
	ctx: ResolutionContext,
): CheckResolutionValue {
	const [operand] = expression.operands
	const { expected, tolerance, relative } = expression
	return resolveSingleOperand(operand, boundElement, ctx, 'total', (resolved) =>
		countTolerance(resolved, expected, tolerance, relative, ctx.artifactPath),
	)
}

function resolveShapeNode(
	expression: Extract<Expression, { op: 'shape' }>,
	boundElement: ResolvedValue,
	ctx: ResolutionContext,
): CheckResolutionValue {
	const [operand] = expression.operands
	const { descriptor } = expression
	return resolveSingleOperand(
		operand,
		boundElement,
		ctx,
		'needs-a-member',
		(resolved) => shape(resolved, descriptor, ctx.artifactPath),
	)
}

// One entry per `Expression['op']`; the mapped type below fails to compile if
// an op is missing or misassigned, since each key demands the handler typed
// for exactly that variant. That check covers the closed union at compile
// time; it cannot see an out-of-union op arriving at runtime, which is what
// the guard in `resolveNode` is for.
const operatorHandlers: { [Op in Expression['op']]: OperatorHandler<Op> } = {
	not: resolveNotNode,
	all: resolveAllNode,
	any: resolveAnyNode,
	'for-all': resolveQuantifierNode,
	'for-any': resolveQuantifierNode,
	'covers-by-key': resolveCoversByKeyNode,
	equality: resolveEqualityNode,
	'deep-equality': resolveDeepEqualityNode,
	containment: resolveContainmentNode,
	existence: resolveExistenceNode,
	absence: resolveAbsenceNode,
	regex: resolveRegexNode,
	'set-membership': resolveSetMembershipNode,
	ordering: resolveOrderingNode,
	'count-tolerance': resolveCountToleranceNode,
	shape: resolveShapeNode,
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
	// `operatorHandlers` is keyed by the closed `Expression['op']` union, so
	// TypeScript sees no `undefined` branch. That does not bind the runtime:
	// an out-of-union `op` (unvalidated input, or a future schema version) is
	// what this guard catches. `Object.hasOwn`, not a truthy check: a plain
	// object literal inherits `Object.prototype`, so `op: 'constructor'` would
	// otherwise resolve to `Object` itself and slip past silently.
	if (!Object.hasOwn(operatorHandlers, expression.op)) {
		throw new Error(
			`resolveNode: unrecognized expression.op ${JSON.stringify((expression as { op?: unknown }).op)}`,
		)
	}
	const handler = operatorHandlers[expression.op] as OperatorHandler<
		Expression['op']
	>
	return handler(expression, boundElement, ctx)
}

/**
 * The public entry point. Walks `expression` and produces one
 * `CheckResolutionValue`, exactly what `Outcome.checkResolution` needs,
 * unmodified. `boundElement` starts `ABSENT` at the root, where no quantifier
 * has bound anything yet.
 */
export function resolveCheck(
	expression: Expression,
	resolveOperand: ResolveOperand,
	pointerDenotesCollection: PointerDenotesCollection,
	referenceSetKeys: ReferenceSetKeys,
	regexMatchStepBudget: number,
	artifactPath: string,
): CheckResolutionValue {
	return resolveNode(expression, ABSENT, {
		resolveOperand,
		pointerDenotesCollection,
		referenceSetKeys,
		regexMatchStepBudget,
		artifactPath,
	})
}
