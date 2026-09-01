/**
 * The adapter between a probe leg and AD-4's resolver. A witness relation is an
 * ordinary `Expression`, so `resolveCheck` and `makeResolveOperand` are reused
 * unchanged. This module supplies the `Observation` shape they read and a
 * collection predicate scoped to one operation.
 */

import { makeResolveOperand } from '../evaluate/evidence-resolution.ts'
import {
	type PointerDenotesCollection,
	resolveCheck,
} from '../evaluate/resolution.ts'
import type { EvalContract } from '../schemas/eval-contract.ts'
import type { CheckResolutionValue } from '../schemas/evidence-artifact.ts'
import type { Expression } from '../schemas/expression.ts'
import type { Operation } from '../schemas/interface.ts'
import type { ProbeObservation } from '../schemas/port-messages.ts'
import type { JsonObject, JsonValue } from '../schemas/primitives.ts'
import type {
	Observation,
	ObservedCallInputs,
} from '../schemas/sealed-run-record.ts'
import type { WitnessInputs } from '../schemas/sensitivity-witness.ts'
import { decodeTail, parseEvidenceTarget } from '../seal/plan-index.ts'
import type { ProjectedObservation } from './projection.ts'

/**
 * A module constant. A scoring policy is a score-side artifact and AD-38 closes
 * stage one's requirement list against citing one, so pre-flight cannot read
 * its budget from there. The value mirrors the published default policy's.
 */
export const PREFLIGHT_REGEX_MATCH_STEP_BUDGET = 1_000_000

const asJsonObject = (value: JsonValue): JsonObject | null =>
	value !== null && typeof value === 'object' && !Array.isArray(value)
		? (value as JsonObject)
		: null

/**
 * `ObservedCallInputs` is narrower than `WitnessInputs`, so `body` loses
 * information here: an absent body and a non-object JSON body both map to
 * `null`, and a relation addressing `/interactions/{legId}/call-inputs/body` on
 * such a leg resolves `ABSENT`.
 */
const callInputsOf = (inputs: WitnessInputs): ObservedCallInputs => ({
	path: inputs.path,
	query: inputs.query,
	header: inputs.header,
	body: inputs.body.kind === 'json' ? asJsonObject(inputs.body.value) : null,
})

/**
 * One leg as the `Observation` `makeResolveOperand` takes. The relation reads the
 * **projected** body, which is AD-10's "evaluated over that operation's response
 * descriptor after excluding the volatile pointers", and the raw headers, which
 * the projection does not carry. `provenance` is `baseline`: a pre-flight leg is
 * pre-canned by definition.
 */
export function evidenceOf(
	projected: ProjectedObservation,
	observation: ProbeObservation,
	inputs: WitnessInputs,
): Observation {
	const { body } = projected
	return {
		observationId: projected.legId,
		// A synthetic, single-observation shape built fresh per leg and never
		// collected alongside a sibling: pre-flight resolves one leg's witness
		// relation at a time, so the schema's ordering and uniqueness concerns
		// (owed item 2) have nothing to apply to here. Constant, since no reader
		// of this value cares which leg it was. This stops being safe if
		// pre-flight ever needs to assemble multiple legs' observations
		// together: AD-40 already names such a future need, pair-defect signing
		// across the monotonic sequence of owed item 2, so revisit this
		// constant then.
		sequence: 1,
		operationId: projected.operationId,
		provenance: 'baseline',
		callInputs: callInputsOf(inputs),
		responseBody:
			body.kind === 'json'
				? body.value
				: body.kind === 'text'
					? body.value
					: null,
		responseHeaders: observation.headers,
		responseStatus: observation.status,
		stdout: null,
		stderr: null,
		exitCode: null,
	}
}

/** the contract's declared reference sets in the shape the resolver wants. */
export function referenceSetMembers(
	contract: EvalContract,
): Readonly<Record<string, JsonValue[]>> {
	return Object.fromEntries(
		Object.entries(contract.referenceSets ?? {}).map(([id, set]) => [
			id,
			set.members as JsonValue[],
		]),
	)
}

const tokensEqual = (a: readonly string[], b: readonly string[]): boolean =>
	a.length === b.length && a.every((token, index) => token === b[index])

/**
 * Answers `true` only for a `response-body` pointer whose tail names a declared
 * collection location of **this** operation. `makePointerDenotesCollection` does
 * not work here: it resolves through the interaction plan, where a witness leg
 * never appears, and fabricating step objects for a one-operation lookup is more
 * machinery than the predicate.
 */
export function makeWitnessPointerDenotesCollection(
	operation: Operation,
): PointerDenotesCollection {
	const { collectionLocations } = operation.responseDescriptor
	return (pointer) => {
		if (pointer.startsWith('@')) return false
		const target = parseEvidenceTarget(pointer)
		if (target.channel !== 'response-body') return false
		if (collectionLocations === null) return false
		return collectionLocations.some((location) =>
			tokensEqual(decodeTail(location.pointer), target.tail),
		)
	}
}

/** Resolves one witness relation over the legs it addresses. */
export function resolveWitnessRelation(
	relation: Expression,
	legEvidence: Readonly<Record<string, Observation>>,
	operation: Operation,
	referenceSets: Readonly<Record<string, JsonValue[]>>,
	artifactPath: string,
): CheckResolutionValue {
	return resolveCheck(
		relation,
		makeResolveOperand(legEvidence, referenceSets),
		makeWitnessPointerDenotesCollection(operation),
		PREFLIGHT_REGEX_MATCH_STEP_BUDGET,
		artifactPath,
	)
}
