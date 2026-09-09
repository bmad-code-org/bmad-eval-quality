/**
 * Two compile-time checks over an EvalContract's oracle trees:
 * `malformed-operator-expression` (a `@/` bound-element pointer outside any
 * quantifier's predicate) and `unreachable-check-evidence` (a pointer the
 * declared interfaces cannot produce). Both throw `StructuralFailure` on the
 * first violation, matching `auditBriefScripting`'s fail-fast convention.
 * `evaluatePointerReachability` is exported separately as the non-throwing
 * per-pointer core, for reuse and direct testing.
 */
import {
	declaredArtifactsOf,
	descriptorArtifactOf,
	descriptorChannelOf,
	isCommandOperation,
	requestShapeOf,
} from '../declared-inputs.ts'
import { ARRAY_INDEX_PATTERN } from '../evaluate/evidence-resolution.ts'
import { StructuralFailure } from '../failure-codes.ts'
import type { EvalContract } from '../schemas/eval-contract.ts'
import type { Expression, Operand } from '../schemas/expression.ts'
import type { AnyOperation, ResponseDescriptor } from '../schemas/interface.ts'
import { operationsOf } from '../schemas/interface.ts'
import { JsonTypeName } from '../schemas/primitives.ts'
import {
	anyOperationOf,
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

/**
 * Every interaction-rooted pointer the contract writes down, wherever it sits:
 * an oracle's check and its direction's evidence targets, a rubric criterion's
 * evidence, and each operation's sensitivity-witness relation.
 *
 * Broader than `forEachCheckPointer`, which walks oracle checks alone, because
 * an artifact identifier is an authoring fault at every site that names one and
 * a check that walked only the checks would report half of them.
 *
 * The third argument is the operation the site belongs to, and it is supplied
 * only at a sensitivity-witness relation. A witness leg carries no operation of
 * its own: it probes the operation declaring the witness, and its `legId` roots
 * the relation's pointers in the same namespace as interaction-plan step ids
 * without being a step. So a caller resolving the pointer's own step segment
 * against the plan finds nothing at a witness site and has to be handed the
 * operation instead. Everywhere else the pointer's step segment is the only
 * thing that names an operation, and the argument is `null`.
 */
export function forEachArtifactPointer(
	contract: EvalContract,
	visit: (
		pointer: string,
		artifactPath: string,
		declaringOperation: AnyOperation | null,
	) => void,
): void {
	const seen = (
		pointer: string,
		artifactPath: string,
		declaringOperation: AnyOperation | null = null,
	): void => {
		if (pointer.startsWith('@')) return
		visit(pointer, artifactPath, declaringOperation)
	}
	contract.oracles.forEach((oracle) => {
		if (oracle.check !== null)
			visitExpression(oracle.check, 'check', false, (site) =>
				seen(
					site.pointer,
					`EvalContract.oracles[id=${oracle.id}].${site.path}`,
				),
			)
		oracle.direction?.evidenceTargets.forEach((target, index) => {
			seen(
				target,
				`EvalContract.oracles[id=${oracle.id}].direction.evidenceTargets[${index}]`,
			)
		})
	})
	contract.rubrics.forEach((rubric) => {
		rubric.criteria.forEach((criterion) => {
			seen(
				criterion.evidence,
				`EvalContract.rubrics[id=${rubric.id}].criteria[id=${criterion.id}].evidence`,
			)
		})
	})
	contract.permittedInterfaces.forEach((iface, interfaceIndex) => {
		operationsOf(iface).forEach((operation, operationIndex) => {
			const witness = operation.sensitivityWitness
			if (witness === null) return
			visitExpression(witness.relation, 'relation', false, (site) =>
				seen(
					site.pointer,
					`EvalContract.permittedInterfaces[${interfaceIndex}].operations[${operationIndex}].sensitivityWitness.${site.path}`,
					operation,
				),
			)
		})
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

/** `checkBoundElementScope` over one bare `Expression`. */
export function checkExpressionBoundElementScope(
	expression: Expression,
	artifactPath: string,
): void {
	visitExpression(expression, '', false, (site) => {
		if (site.pointer.startsWith('@') && !site.insideQuantifier) {
			throw new StructuralFailure(
				'malformed-operator-expression',
				`${artifactPath}${site.path}`,
				`bound-element pointer "${site.pointer}" appears outside any quantifier's predicate; "@/" binds only inside a quantifier (AD-26)`,
			)
		}
	})
}

/**
 * Visits every `{ pointer }` operand of one bare `Expression`, which a
 * probe-side legality pass needs for the rules a contract has no equivalent of:
 * that every pointer roots at the reserved step identifier, and which evidence
 * channels the condition actually names.
 */
export function forEachExpressionPointer(
	expression: Expression,
	visit: (pointer: string, path: string) => void,
): void {
	visitExpression(expression, '', false, (site) => {
		visit(site.pointer, site.path)
	})
}

/** `checkEvidenceReachability` over one bare `Expression` and one operation. */
export function checkExpressionEvidenceReachability(
	expression: Expression,
	artifactPath: string,
	operation: AnyOperation,
): void {
	visitExpression(expression, '', false, (site) => {
		const result = evaluateReachabilityAgainstOperation(site.pointer, operation)
		if (!result.reachable) {
			throw new StructuralFailure(
				'unreachable-check-evidence',
				`${artifactPath}${site.path}`,
				`"${site.pointer}" ${result.reason}`,
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

// Every JsonTypeName value except `object` and `array` is scalar. Widened
// to `ReadonlySet<string>` so `.has(declaredType)` below still typechecks.
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
 * directly by tests. The two lines below are the whole of what ties this to a
 * declared interaction plan; everything past them reads the operation alone,
 * which is what `evaluateReachabilityAgainstOperation` exposes for a probe-side
 * condition, whose one step identifier is reserved and resolves to the
 * signature's home operation with no plan in sight.
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
	const operation = anyOperationOf(index, step.operationId)
	if (operation === undefined) {
		return unreachable(
			`names step "${target.stepId}", which names operation "${step.operationId}", not declared by any permitted interface`,
		)
	}
	return evaluateReachabilityAgainstOperation(pointer, operation)
}

/**
 * Descent through the operation's response descriptor, from whichever channel
 * that descriptor describes. `channel` is carried only so the reason names the
 * pointer's own root back to the author.
 */
function descendThroughDescriptor(
	descriptor: ResponseDescriptor,
	target: { readonly tail: readonly string[] },
	operationId: string,
	channel: string,
): ReachabilityResult {
	if (target.tail.length === 0) return reachable()
	const firstToken = target.tail[0]
	if (firstToken === undefined) {
		// Unreachable: the length check above guarantees an element.
		throw new TypeError(
			'evidence-target tail is non-empty but has no first token',
		)
	}
	const { requiredKeys, permittedKeys, types, collectionLocations } = descriptor
	// A root-declared collection (`pointer: ''`) indexes directly, bypassing
	// the key check below. `expectedCardinality` bounds the array size
	// (`exact` is the true count; `at-most`/`page-bounded` is an upper
	// bound), so an index at or past it is unreachable.
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
				`addresses ${channel} index ${firstToken}, out of bounds for the declared root collection's expectedCardinality (${expectedCardinality.mode} ${bound})`,
			)
		}
		return reachable()
	}
	if (
		!requiredKeys.includes(firstToken) &&
		!permittedKeys.includes(firstToken)
	) {
		return unreachable(
			`addresses ${channel} field "${firstToken}", which operation "${operationId}" declares in neither requiredKeys nor permittedKeys`,
		)
	}
	if (descendsIntoDeclaredScalar(types, target.tail, firstToken)) {
		return unreachable(
			`descends into ${channel} field "${firstToken}", which operation "${operationId}" declares a scalar with no further structure`,
		)
	}
	return reachable()
}

/**
 * The same rules, against an operation the caller already resolved. Without
 * this check a probe-side condition addressing an undeclared channel or key
 * resolves absent, every comparison over it resolves `false`, and the probe
 * reports its defect as never triggered — a silently passing run on a signature
 * that was never writable.
 */
function evaluateReachabilityAgainstOperation(
	pointer: string,
	operation: AnyOperation,
): ReachabilityResult {
	if (pointer.startsWith('@')) return reachable()
	const target = parseEvidenceTarget(pointer)
	const descriptorChannel = descriptorChannelOf(operation)
	const command = isCommandOperation(operation)

	if (target.channel === 'artifact') {
		const { artifactId } = target
		if (artifactId === null) {
			// Unreachable: parseEvidenceTarget's own guarantee.
			throw new TypeError('artifact evidence target names no artifact')
		}
		// An identifier the operation does not declare produces no evidence, so
		// it is unreachable and this says so. `checkArtifactReferences` runs
		// earlier in `compile` and reports the more specific
		// `unresolved-artifact-reference` for a contract, so the two never race
		// there; this answer is the only one on the probe side, where that check
		// does not run because it walks a contract rather than a signature.
		if (!declaredArtifactsOf(operation).includes(artifactId)) {
			return unreachable(
				`names the "${artifactId}" artifact, which operation "${operation.operationId}" does not declare it writes`,
			)
		}
		if (artifactId !== descriptorArtifactOf(operation)) {
			// Declared to exist, and nothing declares its structure: the
			// operation's one descriptor describes a different channel.
			if (target.tail.length > 0) {
				return unreachable(
					`addresses a field inside the "${artifactId}" artifact, which operation "${operation.operationId}" declares it writes but declares no structure for`,
				)
			}
			return reachable()
		}
		return descendThroughDescriptor(
			operation.responseDescriptor,
			target,
			operation.operationId,
			`the "${artifactId}" artifact`,
		)
	}

	// The declared output channel descends through the descriptor whatever it
	// is called. This is the one rule; the channels below are the cases where
	// no descriptor applies.
	if (target.channel === descriptorChannel) {
		return descendThroughDescriptor(
			operation.responseDescriptor,
			target,
			operation.operationId,
			target.channel,
		)
	}

	if (target.channel === 'stdout' || target.channel === 'stderr') {
		// The stream this operation's descriptor does not describe carries no
		// declared structure, so a non-empty tail proves the pointer
		// unreachable.
		if (target.tail.length > 0) {
			return unreachable(
				`addresses a field inside ${target.channel}, which operation "${operation.operationId}" declares no structure for`,
			)
		}
		return reachable()
	}

	if (
		command &&
		(target.channel === 'response-body' ||
			target.channel === 'response-headers' ||
			target.channel === 'response-status')
	) {
		return unreachable(
			`addresses ${target.channel} on operation "${operation.operationId}", which runs behind a command and produces no HTTP response`,
		)
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
		const shape = requestShapeOf(operation, transportChannel)
		if (shape === undefined) {
			return unreachable(
				`addresses call-inputs ${transportChannel}, a channel operation "${operation.operationId}" does not accept input on`,
			)
		}
		const { requiredKeys, permittedKeys, types } = shape
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
			{ duplicateIds: 'unresolved' },
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
