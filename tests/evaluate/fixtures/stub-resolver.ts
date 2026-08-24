// Test-only stand-ins for Story 4.1's addressing-grammar resolver (Decision 2).
// An ad hoc pointer walker, good enough to make resolution.test.ts's fixtures
// resolvable. Never shipped from `src/`, and never asserted to match Story
// 4.1's eventual behavior beyond what these fixtures need.

import type {
	PointerDenotesCollection,
	ResolveOperand,
} from '../../../src/core/evaluate/resolution.ts'
import {
	ABSENT,
	type ResolvedValue,
} from '../../../src/core/evaluate/resolved-value.ts'
import type { JsonValue } from '../../../src/core/schemas/primitives.ts'

// Matches the published default artifact's `regexMatchStepBudget` (Story 3.1
// AC 2), raised from 10000 to 1_000_000 after a review round: the estimate
// scales with the observed string's length, which the contract author does
// not control. Shared here rather than spelled independently in
// operators.test.ts and resolution.test.ts.
export const DEFAULT_REGEX_MATCH_STEP_BUDGET = 1_000_000

// A plain RFC-6901-ish walk: split on "/", index in, ABSENT on a missing or
// out-of-range segment. `Object.hasOwn` guards every index so a segment like
// "__proto__" reads as absent rather than as an inherited property. No
// "~0"/"~1" unescaping, since these fixtures' pointers never carry a literal
// "/" or "~" in a key.
function walkPointer(root: JsonValue, tail: string): ResolvedValue {
	const segments = tail.split('/').filter((segment) => segment.length > 0)
	let current: JsonValue = root
	for (const segment of segments) {
		if (current === null || typeof current !== 'object') return ABSENT
		if (Array.isArray(current)) {
			const index = Number(segment)
			if (!Object.hasOwn(current, index)) return ABSENT
			current = current[index] as JsonValue
			continue
		}
		if (!Object.hasOwn(current, segment)) return ABSENT
		current = current[segment] as JsonValue
	}
	return current
}

const INTERACTION_POINTER = /^\/interactions\/([^/]+)\/(.*)$/

/**
 * `evidence` is keyed by stepId, each value the interaction's own channels
 * (e.g. `{ 'response-body': {...}, 'response-status': 200 }`).
 * `referenceSets` is keyed by the declared identifier. A pointer that does not
 * even match the interaction-pointer shape throws rather than resolving
 * `ABSENT`: a typo'd fixture pointer should fail loudly, not degrade into
 * "absent evidence." A well-formed pointer whose stepId or tail genuinely has
 * no matching evidence still resolves `ABSENT`, the ordinary case.
 */
export function makeStubResolver(
	evidence: Readonly<Record<string, JsonValue>>,
	referenceSets: Readonly<Record<string, JsonValue[]>>,
): ResolveOperand {
	return (operand, boundElement) => {
		if ('literal' in operand) return operand.literal
		if ('referenceSet' in operand) {
			return referenceSets[operand.referenceSet] ?? ABSENT
		}
		const { pointer } = operand
		if (pointer.startsWith('@')) {
			// ABSENT means "no active binding" (Decision 8); boundElement may
			// legitimately be `null` itself, a bound element that is JSON null.
			if (boundElement === ABSENT) return ABSENT
			return walkPointer(boundElement, pointer.slice(1))
		}
		const match = INTERACTION_POINTER.exec(pointer)
		if (!match) {
			throw new Error(`stub-resolver: unrecognized pointer ${pointer}`)
		}
		const [, stepId, tail] = match
		const step = stepId === undefined ? undefined : evidence[stepId]
		if (step === undefined || tail === undefined) return ABSENT
		return walkPointer(step, tail)
	}
}

/**
 * Implements `PointerDenotesCollection`'s own contract: `false` for any `@/…`
 * pointer regardless of `collectionPointers` (AC 3's rule — a bound-element
 * pointer has no declared-collection-type surface in the current schema).
 */
export function makeStubPointerDenotesCollection(
	collectionPointers: readonly string[],
): PointerDenotesCollection {
	return (pointer) => {
		if (pointer.startsWith('@')) return false
		return collectionPointers.includes(pointer)
	}
}

/**
 * Like `makeStubResolver`, except a `{ referenceSet }` operand naming
 * `misbehavingReferenceSetId` resolves to `misbehavingValue` regardless of
 * type — isolating exactly one guarded position, rather than overriding every
 * operand the way a blanket constant resolver would.
 */
export function makeResolverWithMisbehavingReferenceSet(
	evidence: Readonly<Record<string, JsonValue>>,
	referenceSets: Readonly<Record<string, JsonValue[]>>,
	misbehavingReferenceSetId: string,
	misbehavingValue: ResolvedValue,
): ResolveOperand {
	const baseResolver = makeStubResolver(evidence, referenceSets)
	return (operand, boundElement, artifactPath) => {
		if (
			'referenceSet' in operand &&
			operand.referenceSet === misbehavingReferenceSetId
		) {
			return misbehavingValue
		}
		return baseResolver(operand, boundElement, artifactPath)
	}
}
