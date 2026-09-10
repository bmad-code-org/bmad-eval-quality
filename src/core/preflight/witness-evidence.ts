/**
 * The adapter between a probe leg and AD-4's resolver. A witness relation is an
 * ordinary `Expression`, so `resolveCheck` and `makeResolveOperand` are reused
 * unchanged. This module supplies the `Observation` shape they read and a
 * collection predicate scoped to one operation.
 */

import { isMcpWitnessInputs } from '../compile/sensitivity-witness.ts'
import {
	descriptorArtifactOf,
	descriptorChannelOf,
} from '../declared-inputs.ts'
import { makeResolveOperand } from '../evaluate/evidence-resolution.ts'
import {
	type PointerDenotesCollection,
	type ReferenceSetKeys,
	resolveCheck,
} from '../evaluate/resolution.ts'
import type { EvalContract } from '../schemas/eval-contract.ts'
import type { CheckResolutionValue } from '../schemas/evidence-artifact.ts'
import type { Expression } from '../schemas/expression.ts'
import type { AnyOperation } from '../schemas/interface.ts'
import type {
	ProbeObservation,
	ProbeObservedBody,
} from '../schemas/port-messages.ts'
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
 * `ObservedCallInputs` is narrower than `ApiWitnessInputs`, so `body` loses
 * information here: an absent body and a non-object JSON body both map to
 * `null`, and a relation addressing `/interactions/{legId}/call-inputs/body` on
 * such a leg resolves `ABSENT`.
 */
const ABSENT_CHANNEL = { kind: 'absent' } as const

const bodyValue = (body: ProbeObservedBody): JsonValue =>
	body.kind === 'absent' ? null : body.value

/**
 * The leg's supplied inputs as the record spells them: every channel the leg
 * did not use is `null` rather than absent, which is the observation's own
 * convention for an unused channel.
 */
const callInputsOf = (inputs: WitnessInputs): ObservedCallInputs => {
	const empty = {
		path: null,
		query: null,
		header: null,
		body: null,
		argument: null,
		option: null,
		environment: null,
		stdin: null,
		arguments: null,
	}
	if ('body' in inputs) {
		return {
			...empty,
			path: inputs.path,
			query: inputs.query,
			header: inputs.header,
			body:
				inputs.body.kind === 'json' ? asJsonObject(inputs.body.value) : null,
		}
	}
	// A tool call supplies one channel, so `arguments` carries the whole of what
	// the leg sent and the other eight read `null`. That is the channel
	// `checkExpressionLegChannel` admits `call-inputs` against for an mcp
	// operation, so a relation over `/interactions/{legId}/call-inputs/arguments`
	// resolves what the leg supplied.
	if (isMcpWitnessInputs(inputs))
		return { ...empty, arguments: inputs.arguments }
	return {
		...empty,
		argument: inputs.argument,
		option: inputs.option,
		environment: inputs.environment,
		stdin:
			inputs.stdin.kind === 'json' ? asJsonObject(inputs.stdin.value) : null,
	}
}

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
	operation: AnyOperation,
): Observation {
	const { body } = projected
	const descriptorChannel = descriptorChannelOf(operation)
	const describedArtifact = descriptorArtifactOf(operation)
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
		// A pre-flight leg is issued by this package rather than by a harness
		// acting as a declared account, so it names no principal.
		principal: null,
		callInputs: callInputsOf(inputs),
		// The projected body is whichever channel the operation's descriptor
		// describes, so it lands on the channel a relation addresses. Both are
		// filled from the same projection rather than one being derived from
		// the other, and every channel the leg did not observe is written down
		// as unobserved rather than left to a default. A tool call's structured
		// result is a response body and lands where an api body does; the
		// command streams are the one projected body that goes elsewhere.
		responseBody: observation.kind === 'cli' ? null : bodyValue(body),
		responseHeaders: observation.kind === 'api' ? observation.headers : null,
		// A tool call has no transport status, so the channel AD-26 fixed as a
		// number carries the envelope's error flag instead: 1 when the tool
		// reported an error and 0 when it did not. The projection is spelled
		// here because a 0 in a field typed `number | null` is otherwise
		// indistinguishable from a transport status of zero, and an oracle
		// asserting that a tool reported no error reads this value.
		responseStatus:
			observation.kind === 'api'
				? observation.status
				: observation.kind === 'mcp'
					? observation.isError
						? 1
						: 0
					: null,
		stdout:
			observation.kind !== 'cli' || descriptorChannel !== 'stdout'
				? ABSENT_CHANNEL
				: body,
		stderr:
			observation.kind !== 'cli' || descriptorChannel !== 'stderr'
				? ABSENT_CHANNEL
				: body,
		exitCode: observation.kind === 'cli' ? observation.exitCode : null,
		artifacts:
			observation.kind !== 'cli' || describedArtifact === null
				? {}
				: { [describedArtifact]: body },
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
	operation: AnyOperation,
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
	operation: AnyOperation,
	referenceSets: Readonly<Record<string, JsonValue[]>>,
	referenceSetKeys: ReferenceSetKeys,
	artifactPath: string,
): CheckResolutionValue {
	return resolveCheck(
		relation,
		makeResolveOperand(legEvidence, referenceSets),
		makeWitnessPointerDenotesCollection(operation),
		referenceSetKeys,
		PREFLIGHT_REGEX_MATCH_STEP_BUDGET,
		artifactPath,
	)
}
