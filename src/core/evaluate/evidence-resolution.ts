/**
 * The real addressing-grammar resolver (Story 4.1): `makeResolveOperand` and
 * `makePointerDenotesCollection`, the `ResolveOperand`/`PointerDenotesCollection`
 * consumer contract `resolution.ts` has carried as an injected dependency since
 * Story 3.2. Parses every pointer form AD-26 declares, including the
 * bound-element `@/` form, and walks it into an already-selected `Observation`.
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
 * no sign, digits only. Excludes the "-" token (RFC 6901's "the nonexistent
 * member after the last array element"): this grammar only ever reads, so
 * "-" can never name a value and resolves ABSENT like any other unmatched
 * token. Exported so `core/compile/reachability.ts`'s root-collection index
 * check (AC 5, Decision 7) tests reachability against the identical grammar
 * this resolver actually walks.
 */
export const ARRAY_INDEX_PATTERN = /^(?:0|[1-9][0-9]*)$/

/**
 * Walks `tail` (already `~0`/`~1`-decoded tokens) into `root`. `Object.hasOwn`
 * guards every object step: a genuine own JSON property named `__proto__` or
 * `constructor` (e.g. parsed straight out of a response body) still resolves
 * to its actual value, while the identical name, absent as an own property,
 * never falls through to whatever `Object.prototype` happens to carry
 * (Story 3.3's `keyValueOf` applies this same guard for the same reason).
 * Any miss, any type mismatch mid-walk, or a tail running past a scalar all
 * collapse to `ABSENT` uniformly: AD-26's own rule, "a pointer that does not
 * resolve yields the distinct value absent," with no special case for which
 * of the three produced it.
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
 * `BoundElementPointer`'s own tail, decoded correctly for the zero-token
 * case (Decision 2). `BOUND_ELEMENT_POINTER_PATTERN` (`pointer.ts`) requires
 * at least one "/", so the shortest legal form is the two characters "@/",
 * addressing the bound element itself with no descent: AD-26's own words,
 * "Bare '@/' addresses the element itself." Feeding `pointer.slice(1)`
 * (`"/"`) straight into `decodeTail` does not produce that:
 * `decodeTail` only special-cases a truly empty string, and `"/"` is not
 * one, so it decodes to `['']`, a single empty-string token, which
 * `walkTail` then treats as "look up the key that is the empty string"
 * rather than "the element itself." This function special-cases exactly
 * that one input.
 */
export function decodeBoundElementTail(pointer: string): readonly string[] {
	const tailSource = pointer.slice(1)
	return tailSource === '/' ? [] : decodeTail(tailSource)
}

/**
 * Selects the channel `target` names off one `Observation`. AD-26 gives
 * `stdout`/`stderr` a tail per the schema's own tail-bearing partition even
 * though `Observation.stdout`/`stderr` are bare strings; `walkTail` already
 * resolves any non-empty tail into a string to `ABSENT` on its first
 * iteration, so no special case is needed here.
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
				// Unreachable: parseEvidenceTarget sets this exactly when the
				// channel is 'call-inputs'.
				throw new TypeError(
					'call-inputs evidence target carries no transport channel',
				)
			}
			return observation.callInputs[transportChannel]
		}
	}
}

/**
 * The real `ResolveOperand`. `stepObservations` is one already-selected
 * `Observation` per interaction step (AC 1 point 6). `referenceSets` mirrors
 * the contract's own declared reference sets by identifier (an unresolved
 * identifier is `unresolved-reference-set`, a compile-time concern this
 * function assumes already happened, matching every leaf operator's own
 * "assumed compile-time-prevented" convention). Both maps are looked up with
 * `Object.hasOwn` before indexing, never with `??`/plain bracket access
 * (Decision 3): `Identifier`'s own charset admits `constructor`
 * (`/^[a-z0-9]+(?:-[a-z0-9]+)*$/` matches it), and a plain-object index on a
 * missing `constructor` key returns `Object.prototype.constructor` rather
 * than `undefined`, so `map[key] ?? ABSENT` would silently return a function
 * where AD-26 requires `ABSENT`.
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
			// ABSENT means "no active binding" (Story 3.2 Decision 8). A
			// correctly-compiled contract never reaches this with boundElement
			// ABSENT (checkBoundElementScope rejects a "@/" pointer outside a
			// quantifier at compile time, AC 5), but resolveOperand stays total
			// over every input rather than throwing on this one.
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
 * Only `response-body` can ever answer `true`: AD-19's
 * `ResponseDescriptor.collectionLocations` is the only declared-collection
 * surface in the schema, scoped to the body alone. Builds its `PlanIndex`
 * lazily, on the first call rather than at construction (Decision 12), so a
 * factory over a contract carrying a schema-admitted duplicate step or
 * operation id does not throw before its first real use. A `@/` pointer, a
 * pointer naming an undeclared step, and a pointer whose step names an
 * undeclared operation all answer `false` rather than throwing: this is a
 * boolean predicate with no failure mode of its own for those three cases,
 * so it uses the graceful `stepOf`/`operationOf` lookups, not the throwing
 * `resolveStep`/`resolveOperation`.
 */
export function makePointerDenotesCollection(
	contract: EvalContract,
): PointerDenotesCollection {
	let index: PlanIndex | undefined
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
