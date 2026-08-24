/**
 * AD-26's compile-time reachability check (`unreachable-check-evidence`,
 * AD-19/AD-26) and the bound-element scope rule `pointer.ts`'s own
 * `BoundElementPointer` doc names as "a compile-time check (Story 4.1), not
 * a schema check": a `@/` pointer outside a quantifier's predicate is an
 * operand type no operator position legally accepts there, the same framing
 * `malformed-operator-expression`'s own AD-26 citation already applies to a
 * reference-set operand outside its three legal positions
 * (`ARCHITECTURE-SPINE.md:392`). epics.md's own AC for this story already
 * bundles "`@/` binds only inside quantifiers" into the same sentence as
 * `unreachable-check-evidence`, so enforcing it is this story's required
 * scope, not an optional extension (Decision 9).
 *
 * Both public checks walk every oracle's `check` tree once and throw
 * `StructuralFailure` on the first violation, matching
 * `auditBriefScripting`'s own fail-fast convention (`scripting-audit.ts`),
 * the only existing precedent for a structural-failure thrower in this
 * codebase. Each throw reports at most one violation per call (Decision
 * 10); `evaluatePointerReachability` is exported separately as the
 * non-throwing per-pointer core, both for a future collecting orchestrator
 * to call directly and for this story's own parity-matrix tests (AC 6) to
 * run against the identical pointers `makeResolveOperand` walks.
 */
import { ARRAY_INDEX_PATTERN } from '../evaluate/evidence-resolution.ts'
import { StructuralFailure } from '../failure-codes.ts'
import type { EvalContract } from '../schemas/eval-contract.ts'
import type { Expression, Operand } from '../schemas/expression.ts'
import { JsonTypeName } from '../schemas/primitives.ts'
import {
	buildPlanIndex,
	type PlanIndex,
	parseEvidenceTarget,
} from '../seal/plan-index.ts'

// ---- shared tree walk, with an operand path for AD-5's own artifact-path
// requirement ----------------------------------------------------------

type PointerSite = {
	readonly pointer: string
	readonly path: string
	readonly insideQuantifier: boolean
}

type SiteVisitor = (site: PointerSite) => void

function visitOperand(
	operand: Operand,
	path: string,
	insideQuantifier: boolean,
	visit: SiteVisitor,
): void {
	if ('pointer' in operand)
		visit({ pointer: operand.pointer, path, insideQuantifier })
	// `{ literal }` and `{ referenceSet }` address no interaction evidence.
}

// Covers every one of the sixteen `op` values. `set-membership`'s second
// position is a `SetOperand` (`{ referenceSet }` or `{ literal: [...] }`,
// `expression.ts`'s own union), never a `{ pointer }`, so only its first
// operand can carry one. The ten other tuple-shaped ops (equality,
// deep-equality, containment, existence, absence, regex, ordering,
// count-tolerance, shape, covers-by-key) fall through to the default
// branch uniformly, since each declares `operands: Operand[]`.
function visitExpression(
	expression: Expression,
	path: string,
	insideQuantifier: boolean,
	visit: SiteVisitor,
): void {
	switch (expression.op) {
		case 'not':
			visitExpression(
				expression.operands[0],
				`${path}.operands[0]`,
				insideQuantifier,
				visit,
			)
			return
		case 'all':
		case 'any':
			expression.operands.forEach((child, index) => {
				visitExpression(
					child,
					`${path}.operands[${index}]`,
					insideQuantifier,
					visit,
				)
			})
			return
		case 'for-all':
		case 'for-any':
			// `collection` is evaluated in whatever bound-element context is
			// already open, never a fresh one (Decision 11): matches
			// `resolveQuantifier`'s own rule that a nested quantifier's
			// `collection` resolves "against whatever boundElement was already
			// in scope" (`resolution.ts`). Only `predicate` opens a new scope.
			visitOperand(
				expression.collection,
				`${path}.collection`,
				insideQuantifier,
				visit,
			)
			visitExpression(expression.predicate, `${path}.predicate`, true, visit)
			return
		case 'set-membership':
			visitOperand(
				expression.operands[0],
				`${path}.operands[0]`,
				insideQuantifier,
				visit,
			)
			return
		default:
			expression.operands.forEach((operand, index) => {
				visitOperand(
					operand,
					`${path}.operands[${index}]`,
					insideQuantifier,
					visit,
				)
			})
	}
}

function forEachCheckPointer(
	contract: EvalContract,
	visit: (site: PointerSite, oracleId: string) => void,
): void {
	contract.oracles.forEach((oracle) => {
		if (oracle.check === null) return
		visitExpression(oracle.check, 'check', false, (site) =>
			visit(site, oracle.id),
		)
	})
}

// ---- malformed-operator-expression: @/ outside any quantifier -----------

export function checkBoundElementScope(contract: EvalContract): void {
	forEachCheckPointer(contract, (site, oracleId) => {
		if (site.pointer.startsWith('@') && !site.insideQuantifier) {
			throw new StructuralFailure(
				'malformed-operator-expression',
				`EvalContract.oracles[id=${oracleId}].${site.path}`,
				`bound-element pointer "${site.pointer}" appears outside any quantifier's predicate; "@/" binds only inside a quantifier (AD-26)`,
			)
		}
	})
}

// ---- unreachable-check-evidence ------------------------------------------

type ReachabilityResult =
	| { readonly reachable: true }
	| { readonly reachable: false; readonly reason: string }

const reachable = (): ReachabilityResult => ({ reachable: true })
const unreachable = (reason: string): ReachabilityResult => ({
	reachable: false,
	reason,
})

// Derived from `JsonTypeName`'s own six-member value space (`primitives.ts`)
// rather than a second freestanding literal list, the same anti-duplication
// convention this story already applies to `decodeToken`/`decodeTail`
// (`IDENTIFIER_CHARSET_SOURCE`'s own precedent): every declared type except
// the two compound ones, `object` and `array`, is a scalar. Widened to
// `ReadonlySet<string>` so `.has(declaredType)` below, where `declaredType`
// is a plain `string`, still typechecks.
const SCALAR_TYPES: ReadonlySet<string> = new Set(
	JsonTypeName.options.filter((name) => name !== 'object' && name !== 'array'),
)

// A declared field's own type blocks any further descent only when it is
// definitely a scalar (Decision 6). `undefined` (not declared) and `null`
// (declared, type not stated) both stay permissive: nothing rules out
// descent, so this compiler is no more discerning than the declarations let
// it be, the same default Decision 5 applies to a channel with no shape at
// all.
function descendsIntoDeclaredScalar(
	types: Readonly<Record<string, string | null | undefined>>,
	tail: readonly string[],
	firstToken: string,
): boolean {
	if (tail.length <= 1) return false
	const declaredType = types[firstToken]
	return (
		declaredType !== undefined &&
		declaredType !== null &&
		SCALAR_TYPES.has(declaredType)
	)
}

/**
 * The non-throwing core `checkEvidenceReachability` wraps and AC 6's
 * parity-matrix tests call directly, over the identical pointer set
 * `makeResolveOperand`'s own walk resolves (Decision 9's own header note).
 */
export function evaluatePointerReachability(
	pointer: string,
	index: PlanIndex,
): ReachabilityResult {
	// Relative to a bound element, not rooted at an interaction: nothing
	// declared to check reachability against (`makePointerDenotesCollection`,
	// `evidence-resolution.ts`, is the closest analogue and is runtime-side).
	if (pointer.startsWith('@')) return reachable()

	const target = parseEvidenceTarget(pointer)
	const step = index.stepOf(target.stepId)
	if (step === undefined) {
		return unreachable('names a step the interaction plan does not declare')
	}
	const operation = index.operationOf(step.operationId)
	if (operation === undefined) {
		return unreachable(
			`names step "${target.stepId}", which names operation "${step.operationId}", not declared by any permitted interface`,
		)
	}

	if (target.channel === 'stdout' || target.channel === 'stderr') {
		// Observation.stdout/stderr are always bare strings (Decision 8):
		// no declared or possible shape ever admits a tail into either, so a
		// non-empty tail here is not merely unchecked, it is provably always
		// ABSENT under any conforming resolver.
		if (target.tail.length > 0) {
			return unreachable(
				`addresses a field inside ${target.channel}, which never carries structure to descend into`,
			)
		}
		return reachable()
	}

	if (target.channel === 'response-body') {
		if (target.tail.length === 0) return reachable()
		const firstToken = target.tail[0]
		if (firstToken === undefined) {
			// Unreachable: the length check above guarantees an element.
			throw new TypeError(
				'evidence-target tail is non-empty but has no first token',
			)
		}
		const { requiredKeys, permittedKeys, types, collectionLocations } =
			operation.responseDescriptor
		// A root-declared collection (`pointer: ''`, the response body itself
		// is the array) indexes directly, bypassing the object-key check below
		// (Decision 7): `requiredKeys`/`permittedKeys` name object fields and
		// have nothing to say about an array index.
		const rootIsCollection = collectionLocations?.some(
			(location) => location.pointer === '',
		)
		if (rootIsCollection === true && ARRAY_INDEX_PATTERN.test(firstToken))
			return reachable()
		if (
			!requiredKeys.includes(firstToken) &&
			!permittedKeys.includes(firstToken)
		) {
			return unreachable(
				`addresses response-body field "${firstToken}", which operation "${operation.operationId}" declares in neither requiredKeys nor permittedKeys`,
			)
		}
		if (descendsIntoDeclaredScalar(types, target.tail, firstToken)) {
			return unreachable(
				`descends into response-body field "${firstToken}", which operation "${operation.operationId}" declares a scalar with no further structure`,
			)
		}
		return reachable()
	}

	if (target.channel === 'call-inputs') {
		if (target.tail.length === 0) return reachable()
		const { transportChannel } = target
		if (transportChannel === null) {
			// Unreachable: parseEvidenceTarget's own guarantee.
			throw new TypeError(
				'call-inputs evidence target carries no transport channel',
			)
		}
		const firstToken = target.tail[0]
		if (firstToken === undefined) {
			throw new TypeError(
				'evidence-target tail is non-empty but has no first token',
			)
		}
		const { requiredKeys, permittedKeys, types } =
			operation.requestShape[transportChannel]
		if (
			!requiredKeys.includes(firstToken) &&
			!permittedKeys.includes(firstToken)
		) {
			return unreachable(
				`addresses call-inputs ${transportChannel} field "${firstToken}", which operation "${operation.operationId}" declares in neither requiredKeys nor permittedKeys`,
			)
		}
		if (descendsIntoDeclaredScalar(types, target.tail, firstToken)) {
			return unreachable(
				`descends into call-inputs ${transportChannel} field "${firstToken}", which operation "${operation.operationId}" declares a scalar with no further structure`,
			)
		}
		return reachable()
	}

	// response-headers, response-status, exit-code: AD-19 declares no shape
	// for any of them (Decision 8), so an operation that resolves is the
	// entire compile-time check available.
	return reachable()
}

/** `unreachable-check-evidence`: an interaction-rooted pointer the declared interfaces cannot produce. */
export function checkEvidenceReachability(contract: EvalContract): void {
	let index: PlanIndex | undefined
	forEachCheckPointer(contract, (site, oracleId) => {
		index ??= buildPlanIndex(
			contract.interactionPlan,
			contract.permittedInterfaces,
		)
		const result = evaluatePointerReachability(site.pointer, index)
		if (!result.reachable) {
			throw new StructuralFailure(
				'unreachable-check-evidence',
				`EvalContract.oracles[id=${oracleId}].${site.path}`,
				`"${site.pointer}" ${result.reason}`,
			)
		}
	})
}
