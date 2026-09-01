/**
 * Owed item 3's compile-time checks over captured input bindings:
 * `binding-cycle` over the ordering graph, `captured-channel-undeclared` on a
 * pointer naming any channel but `response-body`, and the typed residue that
 * fires the shipped `unreachable-check-evidence`.
 *
 * The three run at two registry positions. `checkCapturedReachability` fires
 * `unreachable-check-evidence`, whose rung is third, so it runs beside
 * `checkEvidenceReachability`; the two new codes run at their own inserted
 * position. Running captured reachability late would let a lower-ranked code
 * win on a contract carrying both defects, which `compile.ts`'s own documented
 * priority forbids.
 *
 * `evaluatePointerReachability` decides the step, operation, body-key, and
 * scalar-descent half. The scalar determination, the one-segment tail rule, and
 * type equality are this module's own.
 */
import { ARRAY_INDEX_PATTERN } from '../evaluate/evidence-resolution.ts'
import { StructuralFailure } from '../failure-codes.ts'
import type { EvalContract } from '../schemas/eval-contract.ts'
import type { InteractionStep } from '../schemas/plan.ts'
import {
	TRANSPORT_CHANNELS,
	type TransportChannelName,
} from '../schemas/pointer.ts'
import { JsonTypeName } from '../schemas/primitives.ts'
import {
	buildPlanIndex,
	type EvidenceTarget,
	type PlanIndex,
	parseEvidenceTarget,
	resolveOperation,
	resolveStep,
} from '../seal/plan-index.ts'
import { evaluatePointerReachability } from './reachability.ts'

/**
 * The one channel a captured pointer may name. `ResponseDescriptor` declares
 * `requiredKeys`, `permittedKeys`, `types`, `successIndicator`, `channelRoles`,
 * and `collectionLocations`, every one of them about the body, so the body is
 * the one channel it declares and the criterion's "a channel the referenced
 * operation's response descriptor does not declare" is literally true of the
 * other six. Admitting `response-headers` and `response-status` was tried and
 * dropped: their types would have to be invented by fiat, and
 * `Observation.responseHeaders` admits objects, arrays, numbers, and `null`, so
 * a header capture compiled as a `string` could resolve to an object at score
 * time.
 */
const CAPTURABLE_CHANNEL = 'response-body'

/** One `{ captured }` binding, resolved to the pointer target it addresses. */
export type CapturedBinding = {
	readonly transportChannel: TransportChannelName
	readonly key: string
	readonly pointer: string
	readonly target: EvidenceTarget
}

/**
 * Every captured binding one step declares, in fixed transport-channel order
 * then by key name, so which binding a check reports never depends on a
 * caller-keyed map's insertion order. Exported because `score/binding-order.ts`
 * and `score/bindings.ts` need the same reading of which bindings are captures.
 */
export function capturedBindings(
	step: InteractionStep,
): readonly CapturedBinding[] {
	const captures: CapturedBinding[] = []
	for (const transportChannel of TRANSPORT_CHANNELS) {
		const map = step.inputBinding[transportChannel]
		if (map === null) continue
		for (const key of Object.keys(map).sort()) {
			const value = map[key]
			if (value === undefined || !('captured' in value)) continue
			captures.push({
				transportChannel,
				key,
				pointer: value.captured,
				target: parseEvidenceTarget(value.captured),
			})
		}
	}
	return captures
}

// The one shipped precedent for addressing a caller-keyed binding entry
// (`interface-inventory.ts`'s undeclared-key throw), reused so the two new
// codes and the widened `undeclared-mandatory-input` agree on one spelling.
function bindingPath(step: InteractionStep, capture: CapturedBinding): string {
	return `EvalContract.interactionPlan[stepId=${step.stepId}].inputBinding.${capture.transportChannel}[${JSON.stringify(capture.key)}]`
}

// ---- binding-cycle -------------------------------------------------------

/**
 * `binding-cycle`: a cycle over the union of the capture edges and AD-39's
 * `after` edges that contains at least one capture edge.
 *
 * Both edge kinds assert that this step's observation comes after that one, so
 * a capture B to A together with `A.after = B` is an unsatisfiable ordering
 * while each graph alone stays acyclic. A cycle made only of `after` edges is
 * left to `checkNestedTemporalClause`, which already catches every one of them,
 * so requiring a capture edge in the cycle keeps the two codes disjoint.
 *
 * Decided by strongly connected components rather than by a depth-first walk
 * that inspects each back edge. A cycle lies entirely inside one component, and
 * a capture edge whose endpoints share a component is closed by a path back
 * through that component, so "some cycle contains a capture edge" is exactly
 * "some capture edge has both endpoints in one component". A self-capture is
 * the singleton case and needs no rule of its own. The depth-first form was
 * written first and rejected: settling a node after rejecting a pure-`after`
 * back edge can hide a mixed cycle a later root would reach, and whether it
 * does depends on the order edges happen to be enumerated in, which is an
 * invariant nothing states.
 *
 * Nodes are the plan's declared step ids; an edge whose target no step declares
 * is dropped, since a dangling reference is not a cycle and AD-39 makes a
 * dangling `after` permissive besides. The binding reported is the first, in
 * the plan's own declaration order, whose endpoints share a component.
 */
export function checkBindingCycle(contract: EvalContract): void {
	const declaredStepIds = new Set(
		contract.interactionPlan.map((step) => step.stepId),
	)
	const edgesFrom = new Map<string, string[]>()
	const addEdge = (from: string, to: string): void => {
		const list = edgesFrom.get(from)
		if (list === undefined) edgesFrom.set(from, [to])
		else list.push(to)
	}
	for (const step of contract.interactionPlan) {
		for (const capture of capturedBindings(step)) {
			if (declaredStepIds.has(capture.target.stepId)) {
				addEdge(step.stepId, capture.target.stepId)
			}
		}
		if (step.after !== null && declaredStepIds.has(step.after)) {
			addEdge(step.stepId, step.after)
		}
	}

	const component = stronglyConnectedComponents(declaredStepIds, edgesFrom)
	for (const step of contract.interactionPlan) {
		for (const capture of capturedBindings(step)) {
			const target = capture.target.stepId
			if (!declaredStepIds.has(target)) continue
			if (component.get(step.stepId) !== component.get(target)) continue
			throw new StructuralFailure(
				'binding-cycle',
				bindingPath(step, capture),
				`captured pointer "${capture.pointer}" closes a cycle over the capture and temporal-clause edges; a captured value has no earlier step to resolve from (AD-39)`,
			)
		}
	}
}

/** Tarjan's algorithm, returning each node's component identifier. */
function stronglyConnectedComponents(
	nodes: ReadonlySet<string>,
	edgesFrom: ReadonlyMap<string, readonly string[]>,
): ReadonlyMap<string, number> {
	const order = new Map<string, number>()
	const lowLink = new Map<string, number>()
	const onStack = new Set<string>()
	const stack: string[] = []
	const component = new Map<string, number>()
	let nextOrder = 0
	let nextComponent = 0
	const connect = (node: string): void => {
		order.set(node, nextOrder)
		lowLink.set(node, nextOrder)
		nextOrder += 1
		stack.push(node)
		onStack.add(node)
		for (const next of edgesFrom.get(node) ?? []) {
			if (!order.has(next)) {
				connect(next)
				lowLink.set(
					node,
					Math.min(lowLink.get(node) ?? 0, lowLink.get(next) ?? 0),
				)
			} else if (onStack.has(next)) {
				lowLink.set(
					node,
					Math.min(lowLink.get(node) ?? 0, order.get(next) ?? 0),
				)
			}
		}
		if (lowLink.get(node) !== order.get(node)) return
		const id = nextComponent
		nextComponent += 1
		for (;;) {
			const member = stack.pop()
			if (member === undefined) break
			onStack.delete(member)
			component.set(member, id)
			if (member === node) break
		}
	}
	for (const node of nodes) {
		if (!order.has(node)) connect(node)
	}
	return component
}

// ---- captured-channel-undeclared -----------------------------------------

/**
 * `captured-channel-undeclared`: a captured pointer naming any AD-26 channel
 * but `response-body`. `call-inputs` addresses a step's own request,
 * `stdout`, `stderr`, and `exit-code` are process channels no operation
 * surviving `unsupported-interface-kind` produces, and `response-headers` and
 * `response-status` have no declared structure to give a captured value a
 * type.
 */
export function checkCapturedChannel(contract: EvalContract): void {
	for (const step of contract.interactionPlan) {
		for (const capture of capturedBindings(step)) {
			if (capture.target.channel === CAPTURABLE_CHANNEL) continue
			throw new StructuralFailure(
				'captured-channel-undeclared',
				bindingPath(step, capture),
				`captured pointer "${capture.pointer}" names the ${capture.target.channel} channel, which the referenced operation's response descriptor does not declare (AD-26)`,
			)
		}
	}
}

// ---- the typed residue: unreachable-check-evidence -----------------------

const SCALAR_TYPES: ReadonlySet<string> = new Set(
	JsonTypeName.options.filter((name) => name !== 'object' && name !== 'array'),
)

type TypeDecision =
	| { readonly type: string }
	| { readonly type?: undefined; readonly reason: string }

/**
 * The type a captured pointer resolves to, or why nothing scalar is declared
 * there. The tail must be exactly one segment: `ResponseDescriptor.types` is
 * keyed by plain key name, so a nested segment has no declared type to compare
 * against, and an array element has none either even where
 * `evaluatePointerReachability` admits the index against a root collection.
 */
function capturedType(target: EvidenceTarget, index: PlanIndex): TypeDecision {
	const segments = target.tail.length
	if (segments !== 1) {
		return {
			reason: `addresses ${segments === 0 ? 'the whole response body' : `a response-body path ${segments} segments deep`}, which declares no scalar to capture`,
		}
	}
	const key = target.tail[0]
	if (key === undefined) {
		// Unreachable: the length check above guarantees one segment.
		throw new TypeError('captured pointer tail is one segment but is empty')
	}
	if (ARRAY_INDEX_PATTERN.test(key)) {
		return {
			reason: `addresses response-body element ${key}, which no declaration gives a type`,
		}
	}
	const step = resolveStep(index, target.stepId)
	const operation = resolveOperation(index, step.operationId)
	const declared = operation.responseDescriptor.types[key]
	if (declared === undefined || declared === null) {
		return {
			reason: `addresses response-body field "${key}", whose type operation "${operation.operationId}" ${declared === undefined ? 'does not declare' : 'declares indeterminate'}`,
		}
	}
	if (!SCALAR_TYPES.has(declared)) {
		return {
			reason: `addresses response-body field "${key}", which operation "${operation.operationId}" declares "${declared}" rather than a scalar`,
		}
	}
	return { type: declared }
}

/**
 * The type the bound parameter itself is declared as. An indeterminate
 * declaration on either side is not equal to anything and fails closed, which
 * is AD-31's disposition for an indeterminate descriptor. A step whose own
 * operation does not resolve is skipped, matching
 * `checkUndeclaredMandatoryInput`: that defect belongs to a separate
 * cross-field rule.
 */
function boundParameterType(
	step: InteractionStep,
	capture: CapturedBinding,
	index: PlanIndex,
): TypeDecision | null {
	const operation = index.operationOf(step.operationId)
	if (operation === undefined) return null
	const shape = operation.requestShape[capture.transportChannel]
	// A key the operation declares in neither list is an input the contract did
	// not declare, which is `undeclared-mandatory-input`'s and strict-only under
	// AD-4. This check runs unconditionally, so claiming it here would reject a
	// non-strict contract under a code that names a different defect, and would
	// treat a captured binding more harshly than the same key bound to a literal.
	if (
		!shape.requiredKeys.includes(capture.key) &&
		!shape.permittedKeys.includes(capture.key)
	) {
		return null
	}
	const declared = shape.types[capture.key]
	if (declared === undefined || declared === null) {
		return {
			reason: `binds ${capture.transportChannel} parameter "${capture.key}", whose type operation "${operation.operationId}" ${declared === undefined ? 'does not declare' : 'declares indeterminate'}, so no type equality is decidable`,
		}
	}
	return { type: declared }
}

/**
 * `unreachable-check-evidence` over the captured-pointer residue: an
 * unresolvable step or operation, an undeclared body key, a tail that is not
 * exactly one segment, an array index, an absent, indeterminate, or non-scalar
 * declared type, and a declared type that does not equal the bound
 * parameter's.
 *
 * A capture naming another channel is reported here only for the two conditions
 * that are decidable without a response descriptor: an unresolvable step and an
 * unresolvable operation. Everything else about such a pointer is
 * `checkCapturedChannel`'s. That split is what lets this check run at the
 * registry's third rung without shadowing the fifteenth, and it keeps the
 * higher-ranked code first on a pointer that is unresolvable and off-body at
 * once.
 */
export function checkCapturedReachability(contract: EvalContract): void {
	let index: PlanIndex | undefined
	for (const step of contract.interactionPlan) {
		for (const capture of capturedBindings(step)) {
			const path = bindingPath(step, capture)
			index ??= buildPlanIndex(
				contract.interactionPlan,
				contract.permittedInterfaces,
				{ duplicateIds: 'unresolved' },
			)
			// Resolved before the channel test, so a pointer that is both
			// unresolvable and on a non-body channel reports the higher-ranked
			// code. Deferring this to `checkCapturedChannel` would fire index 15
			// where AD-5's order gives index 2, and would assert something about
			// a response descriptor that no declared operation supplies. The
			// wording matches `evaluatePointerReachability`'s own two reasons, so
			// one defect reads the same however it is reached.
			const referenced = index.stepOf(capture.target.stepId)
			if (referenced === undefined) {
				throw new StructuralFailure(
					'unreachable-check-evidence',
					path,
					`captured pointer "${capture.pointer}" names a step the interaction plan does not declare`,
				)
			}
			if (index.operationOf(referenced.operationId) === undefined) {
				throw new StructuralFailure(
					'unreachable-check-evidence',
					path,
					`captured pointer "${capture.pointer}" names step "${capture.target.stepId}", which names operation "${referenced.operationId}", not declared by any permitted interface`,
				)
			}
			if (capture.target.channel !== CAPTURABLE_CHANNEL) continue
			const reachability = evaluatePointerReachability(capture.pointer, index)
			if (!reachability.reachable) {
				throw new StructuralFailure(
					'unreachable-check-evidence',
					path,
					`captured pointer "${capture.pointer}" ${reachability.reason}`,
				)
			}
			const captured = capturedType(capture.target, index)
			if (captured.type === undefined) {
				throw new StructuralFailure(
					'unreachable-check-evidence',
					path,
					`captured pointer "${capture.pointer}" ${captured.reason}`,
				)
			}
			const bound = boundParameterType(step, capture, index)
			if (bound === null) continue
			if (bound.type === undefined) {
				throw new StructuralFailure(
					'unreachable-check-evidence',
					path,
					`captured pointer "${capture.pointer}" resolves to a declared "${captured.type}", but the step ${bound.reason}`,
				)
			}
			if (bound.type !== captured.type) {
				throw new StructuralFailure(
					'unreachable-check-evidence',
					path,
					`captured pointer "${capture.pointer}" resolves to a declared "${captured.type}", which is not the "${bound.type}" the bound ${capture.transportChannel} parameter "${capture.key}" is declared as`,
				)
			}
		}
	}
}
