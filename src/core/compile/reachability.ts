/**
 * Two compile-time structural checks over an EvalContract's oracle trees:
 * `malformed-operator-expression` (a `@/` bound-element pointer may appear
 * only inside a quantifier's predicate) and `unreachable-check-evidence`
 * (an interaction-rooted pointer the declared interfaces cannot produce).
 * Both walk every oracle's `check` tree once and throw `StructuralFailure`
 * on the first violation, matching `auditBriefScripting`'s fail-fast
 * convention. `evaluatePointerReachability` is exported separately as the
 * non-throwing per-pointer core, for reuse and for direct testing.
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

// ---- shared tree walk ----------------------------------------------------

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

// `set-membership`'s second operand is a `SetOperand` (`{ referenceSet }` or
// `{ literal: [...] }`). That type excludes `{ pointer }`, so only its first
// operand can carry one. Every other tuple-shaped op falls through to the
// default branch, since each declares `operands: Operand[]`.
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
			// `collection` resolves in whatever scope is already open. Only
			// `predicate` opens a new quantifier scope.
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

// Every JsonTypeName value except the two compound types, `object` and
// `array`, is a scalar. Widened to `ReadonlySet<string>` so
// `.has(declaredType)` below, where `declaredType` is a plain `string`,
// still typechecks.
const SCALAR_TYPES: ReadonlySet<string> = new Set(
	JsonTypeName.options.filter((name) => name !== 'object' && name !== 'array'),
)

// A field blocks further descent only when its declared type is definitely
// scalar. `undefined` (not declared) and `null` (declared, type not stated)
// both stay permissive: nothing rules out descent.
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
 * Non-throwing core that `checkEvidenceReachability` wraps; also called
 * directly by tests.
 */
export function evaluatePointerReachability(
	pointer: string,
	index: PlanIndex,
): ReachabilityResult {
	// A `@/` pointer is relative to a bound element. Nothing declared to
	// check reachability against.
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
		// stdout/stderr are always bare strings. A non-empty tail proves the
		// pointer unreachable.
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
		// is the array) indexes directly, bypassing the key check below:
		// requiredKeys/permittedKeys name object fields.
		// Its expectedCardinality bounds the array size (`exact` is the true
		// count; `at-most`/`page-bounded` is an upper bound), so an index at
		// or past it is unreachable.
		const rootCollection = collectionLocations?.find(
			(location) => location.pointer === '',
		)
		if (rootCollection !== undefined && ARRAY_INDEX_PATTERN.test(firstToken)) {
			const { expectedCardinality } = rootCollection
			const bound =
				expectedCardinality.mode === 'exact'
					? expectedCardinality.count
					: expectedCardinality.max
			if (Number(firstToken) >= bound) {
				return unreachable(
					`addresses response-body index ${firstToken}, out of bounds for the declared root collection's expectedCardinality (${expectedCardinality.mode} ${bound})`,
				)
			}
			return reachable()
		}
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

	// response-headers, response-status, and exit-code declare no shape, so
	// a resolving operation is the entire compile-time check available.
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
