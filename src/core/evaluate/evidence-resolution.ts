/**
 * `makeResolveOperand` and `makePointerDenotesCollection` satisfy the
 * `ResolveOperand`/`PointerDenotesCollection` contract that `resolution.ts`
 * depends on. They parse every pointer form AD-26 declares, including the
 * bound-element `@/` form, and walk it into an already-selected
 * `Observation`.
 */

import type { EvalContract } from '../schemas/eval-contract.ts'
import type { JsonValue } from '../schemas/primitives.ts'
import type { Observation } from '../schemas/sealed-run-record.ts'
import {
	buildPlanIndex,
	decodeTail,
	type EvidenceTarget,
	type PlanIndex,
	parseEvidenceTarget,
} from '../seal/plan-index.ts'
import type { PointerDenotesCollection, ResolveOperand } from './resolution.ts'
import { ABSENT, type ResolvedValue } from './resolved-value.ts'

/**
 * A canonical RFC 6901 array-index token: no leading zero except "0" itself,
 * no sign, digits only. Excludes "-" (RFC 6901's "nonexistent member after
 * the last element"): this grammar only reads, so "-" resolves ABSENT like
 * any other unmatched token. Exported so `reachability.ts` checks against
 * the same grammar this resolver walks.
 */
export const ARRAY_INDEX_PATTERN = /^(?:0|[1-9][0-9]*)$/

/**
 * Walks `tail` (already `~0`/`~1`-decoded tokens) into `root`. `Object.hasOwn`
 * guards every object step, so an own property named `__proto__` or
 * `constructor` still resolves correctly. Without that guard, the lookup
 * falls through to `Object.prototype`. Any miss, type mismatch, or tail
 * running past a scalar collapses to `ABSENT` uniformly (AD-26).
 */
export function walkTail(
	root: JsonValue,
	tail: readonly string[],
): ResolvedValue {
	let current: JsonValue = root
	for (const token of tail) {
		if (current === null || typeof current !== 'object') return ABSENT
		if (Array.isArray(current)) {
			if (!ARRAY_INDEX_PATTERN.test(token)) return ABSENT
			const index = Number(token)
			if (!Object.hasOwn(current, index)) return ABSENT
			current = current[index] as JsonValue
			continue
		}
		if (!Object.hasOwn(current, token)) return ABSENT
		current = current[token] as JsonValue
	}
	return current
}

/**
 * Decodes `BoundElementPointer`'s tail. "@/" is the shortest legal pointer
 * form and denotes the element itself. `decodeTail` special-cases only a
 * fully empty string, so this function handles the "/" case itself before
 * calling it.
 */
export function decodeBoundElementTail(pointer: string): readonly string[] {
	const tailSource = pointer.slice(1)
	return tailSource === '/' ? [] : decodeTail(tailSource)
}

/**
 * Selects the channel `target` names off one `Observation`. `stdout`/`stderr`
 * can carry a tail even though they're bare strings; `walkTail` already
 * resolves any non-empty tail against a string to `ABSENT`, so no special
 * case is needed here.
 */
function channelRoot(
	observation: Observation,
	target: EvidenceTarget,
): JsonValue {
	switch (target.channel) {
		case 'response-body':
			return observation.responseBody
		case 'response-headers':
			return observation.responseHeaders
		case 'response-status':
			return observation.responseStatus
		case 'stdout':
			return observation.stdout
		case 'stderr':
			return observation.stderr
		case 'exit-code':
			return observation.exitCode
		case 'call-inputs': {
			const { transportChannel } = target
			if (transportChannel === null) {
				// parseEvidenceTarget sets transportChannel exactly when the
				// channel is 'call-inputs', so this throw should never fire.
				throw new TypeError(
					'call-inputs evidence target carries no transport channel',
				)
			}
			return observation.callInputs[transportChannel]
		}
	}
}

/**
 * The `ResolveOperand`. `stepObservations` holds one already-selected
 * `Observation` per interaction step; `referenceSets` mirrors the contract's
 * declared reference sets by identifier. Both maps are looked up with
 * `Object.hasOwn`: `Identifier`'s charset admits `constructor`, the same
 * prototype-chain gotcha `walkTail` guards against.
 */
export function makeResolveOperand(
	stepObservations: Readonly<Record<string, Observation>>,
	referenceSets: Readonly<Record<string, JsonValue[]>>,
): ResolveOperand {
	return (operand, boundElement, _artifactPath) => {
		if ('literal' in operand) return operand.literal
		if ('referenceSet' in operand) {
			if (!Object.hasOwn(referenceSets, operand.referenceSet)) return ABSENT
			return referenceSets[operand.referenceSet] as JsonValue[]
		}
		const { pointer } = operand
		if (pointer.startsWith('@')) {
			// ABSENT means "no active binding." A correctly-compiled contract
			// never hits this branch, but resolveOperand returns ABSENT here
			// so it never has to throw.
			if (boundElement === ABSENT) return ABSENT
			return walkTail(boundElement, decodeBoundElementTail(pointer))
		}
		const target = parseEvidenceTarget(pointer)
		if (!Object.hasOwn(stepObservations, target.stepId)) return ABSENT
		const observation = stepObservations[target.stepId] as Observation
		return walkTail(channelRoot(observation, target), target.tail)
	}
}

function tokensEqual(a: readonly string[], b: readonly string[]): boolean {
	return a.length === b.length && a.every((token, index) => token === b[index])
}

/**
 * Only `response-body` can ever answer `true` (AD-19: `collectionLocations`
 * is the only declared-collection surface, scoped to the body alone). The
 * `PlanIndex` builds lazily on first call unless the caller supplies one,
 * since a schema-admitted duplicate step or operation id would make building
 * it eagerly throw before this function ever runs. Uses `stepOf`/`operationOf`
 * rather than `resolveStep`/`resolveOperation`: those throw on a miss, which
 * would break this function's always-returns-a-boolean contract.
 */
export function makePointerDenotesCollection(
	contract: EvalContract,
	providedIndex?: PlanIndex,
): PointerDenotesCollection {
	let index = providedIndex
	const getIndex = (): PlanIndex => {
		index ??= buildPlanIndex(
			contract.interactionPlan,
			contract.permittedInterfaces,
		)
		return index
	}
	return (pointer) => {
		if (pointer.startsWith('@')) return false
		const target = parseEvidenceTarget(pointer)
		if (target.channel !== 'response-body') return false
		const step = getIndex().stepOf(target.stepId)
		if (step === undefined) return false
		const operation = getIndex().operationOf(step.operationId)
		if (operation === undefined) return false
		const { collectionLocations } = operation.responseDescriptor
		if (collectionLocations === null) return false
		return collectionLocations.some((location) =>
			tokensEqual(decodeTail(location.pointer), target.tail),
		)
	}
}
