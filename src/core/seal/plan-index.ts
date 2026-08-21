/** resolves a pointer to its step and operation; nothing about reachability. */
import type { Operation, PermittedInterface } from '../schemas/interface.ts'
import type { InteractionStep } from '../schemas/plan.ts'
import {
	type EvidenceChannelName,
	SCALAR_CHANNELS,
	TAIL_BEARING_CHANNELS,
	TRANSPORT_CHANNELS,
	TRANSPORT_ROOTED_CHANNEL,
	type TransportChannelName,
} from '../schemas/pointer.ts'
import { IDENTIFIER_CHARSET_SOURCE } from '../schemas/primitives.ts'

// An RFC 6901 reference token, spelled again here because pointer.ts keeps its
// own TOKEN/TAIL fragments private. This is the generic RFC 6901 grammar, so
// respelling it costs nothing. IDENTIFIER_CHARSET_SOURCE and the channel
// partition below are project vocabulary, so those are imported rather than
// respelled.
const TOKEN_SOURCE = '(?:[^/~]|~[01])*'
const TAIL_SOURCE = `(?:/${TOKEN_SOURCE})*`

const alternation = (members: readonly string[]): string => members.join('|')

// Mirrors `pointer.ts`'s own `INTERACTION_POINTER_PATTERN` structure exactly:
// the same three-branch partition into tail-bearing channels, scalar channels
// that take no tail at all, and `call-inputs` plus a mandatory transport
// channel and its own tail. A flatter grammar that let every channel take a
// tail once accepted `/interactions/poll/response-status/oops` (a schema
// reject: `response-status` is scalar) and silently discarded the bogus
// trailing segment rather than rejecting the pointer, so two implementations
// disagreed about what "the same pointer" even is. Named capture groups
// replace positional indices, removing the fragile dependency on
// `IDENTIFIER_CHARSET_SOURCE` staying free of its own capturing groups.
const EVIDENCE_TARGET_PATTERN = new RegExp(
	`^/interactions/(?<stepId>${IDENTIFIER_CHARSET_SOURCE})/(?:(?<tailBearingChannel>${alternation(TAIL_BEARING_CHANNELS)})(?<tailBearingTail>${TAIL_SOURCE})|(?<scalarChannel>${alternation(SCALAR_CHANNELS)})|${TRANSPORT_ROOTED_CHANNEL}/(?<transportChannel>${alternation(TRANSPORT_CHANNELS)})(?<callInputsTail>${TAIL_SOURCE}))$`,
)

const isEvidenceChannel = (value: string): value is EvidenceChannelName =>
	(TAIL_BEARING_CHANNELS as readonly string[]).includes(value) ||
	(SCALAR_CHANNELS as readonly string[]).includes(value)

const isTransportChannel = (value: string): value is TransportChannelName =>
	(TRANSPORT_CHANNELS as readonly string[]).includes(value)

const decodeToken = (token: string): string =>
	token.replace(/~1/g, '/').replace(/~0/g, '~')

const decodeTail = (tailSource: string): readonly string[] =>
	tailSource === '' ? [] : tailSource.slice(1).split('/').map(decodeToken)

/**
 * One evidence target, resolved locally to its step id and channel. The channel
 * is what decides whether the rendered phrase says "the response you obtained"
 * or "the value you sent" (AC 2), and the tail names the field at issue when
 * the pointer carries one.
 */
export type EvidenceTarget = {
	stepId: string
	channel: EvidenceChannelName
	transportChannel: TransportChannelName | null // non-null exactly when channel is 'call-inputs'
	tail: readonly string[] // decoded RFC 6901 tokens; empty on a scalar channel
}

/**
 * Parses one `InteractionPointer` string (`INTERACTION_POINTER_PATTERN` in
 * `pointer.ts`) into its step id, channel, transport channel, and tail, using
 * the schema's own channel partition so this accepts exactly what
 * `InteractionPointer.safeParse` accepts. A should-never-happen precondition
 * violation throws `TypeError` per `digest.ts`'s precedent (Decision 4):
 * nothing upstream of this story guarantees the pointer is well-formed, since
 * `compile`'s reachability enforcement does not exist yet, and this is not an
 * AD-28 fault because no code in that registry names this condition.
 */
export function parseEvidenceTarget(pointer: string): EvidenceTarget {
	const groups = EVIDENCE_TARGET_PATTERN.exec(pointer)?.groups
	if (groups === undefined || groups.stepId === undefined) {
		throw new TypeError(
			`not an interaction-rooted evidence pointer of a recognized channel: ${pointer}`,
		)
	}
	const stepId = groups.stepId
	if (groups.scalarChannel !== undefined) {
		if (!isEvidenceChannel(groups.scalarChannel)) {
			// Unreachable: SCALAR_CHANNELS is exactly what this group can match.
			throw new TypeError(
				`unrecognized evidence channel in pointer: ${pointer}`,
			)
		}
		return {
			stepId,
			channel: groups.scalarChannel,
			transportChannel: null,
			tail: [],
		}
	}
	if (groups.tailBearingChannel !== undefined) {
		if (!isEvidenceChannel(groups.tailBearingChannel)) {
			// Unreachable: TAIL_BEARING_CHANNELS is exactly what this group can match.
			throw new TypeError(
				`unrecognized evidence channel in pointer: ${pointer}`,
			)
		}
		return {
			stepId,
			channel: groups.tailBearingChannel,
			transportChannel: null,
			tail: decodeTail(groups.tailBearingTail ?? ''),
		}
	}
	if (groups.transportChannel !== undefined) {
		if (!isTransportChannel(groups.transportChannel)) {
			// Unreachable: TRANSPORT_CHANNELS is exactly what this group can match.
			throw new TypeError(
				`call-inputs evidence target names no transport channel: ${pointer}`,
			)
		}
		return {
			stepId,
			channel: 'call-inputs',
			transportChannel: groups.transportChannel,
			tail: decodeTail(groups.callInputsTail ?? ''),
		}
	}
	// Unreachable: the pattern's three branches are exhaustive once stepId matched.
	throw new TypeError(
		`not an interaction-rooted evidence pointer of a recognized channel: ${pointer}`,
	)
}

/**
 * Resolves a step id to its declared step, an operation id to its declared
 * operation, and (Task 4's escalation) every step in the plan naming a given
 * operation. It answers which step and operation a pointer names, and nothing
 * about reachability or channel typing. The general addressing-grammar resolver
 * is Epic 4's (Decision 3).
 */
export type PlanIndex = {
	stepOf: (stepId: string) => InteractionStep | undefined
	operationOf: (operationId: string) => Operation | undefined
	stepsUsing: (operationId: string) => readonly InteractionStep[]
}

/**
 * Builds the index once over the whole plan and interface set. Both schemas
 * admit collisions on purpose: `interactionPlan` carries no uniqueness
 * refinement on `stepId`, and `PermittedInterface.operations` declines one so
 * `duplicate-operation-signature` keeps a shape to fire on. A first-wins or
 * last-wins index would therefore make this story's output depend on array
 * order, which is the determinism defect AC 5's permutation family exists to
 * catch. So a duplicate `stepId`, or a duplicate `operationId` across the given
 * interfaces, throws the same precondition-violation `TypeError` at index-build
 * time (Decision 4).
 */
export function buildPlanIndex(
	interactionPlan: readonly InteractionStep[],
	permittedInterfaces: readonly PermittedInterface[],
): PlanIndex {
	const steps = new Map<string, InteractionStep>()
	const stepsByOperation = new Map<string, InteractionStep[]>()
	for (const step of interactionPlan) {
		if (steps.has(step.stepId)) {
			throw new TypeError(`duplicate interaction step id: ${step.stepId}`)
		}
		steps.set(step.stepId, step)
		const group = stepsByOperation.get(step.operationId)
		if (group === undefined) {
			stepsByOperation.set(step.operationId, [step])
		} else {
			group.push(step)
		}
	}
	const operations = new Map<string, Operation>()
	for (const iface of permittedInterfaces) {
		for (const operation of iface.operations) {
			if (operations.has(operation.operationId)) {
				throw new TypeError(
					`duplicate operation id across permitted interfaces: ${operation.operationId}`,
				)
			}
			operations.set(operation.operationId, operation)
		}
	}
	return {
		stepOf: (stepId) => steps.get(stepId),
		operationOf: (operationId) => operations.get(operationId),
		stepsUsing: (operationId) => stepsByOperation.get(operationId) ?? [],
	}
}

/**
 * Resolves a step id through the index or throws. Split from `stepOf` so the
 * index itself stays a plain lookup (`| undefined`, per `noUncheckedIndexedAccess`)
 * while callers that need "resolved or precondition-violated" get one function
 * to call rather than repeating the `undefined` check. Not a `RuntimeFault`:
 * nothing upstream of this story (`compile`'s reachability enforcement,
 * `unreachable-check-evidence`) guarantees every evidence-target pointer
 * resolves against the given plan yet, and no AD-28 code names this condition
 * (Decision 4).
 */
export function resolveStep(index: PlanIndex, stepId: string): InteractionStep {
	const step = index.stepOf(stepId)
	if (step === undefined) {
		throw new TypeError(
			`evidence target names a step the interaction plan does not declare: ${stepId}`,
		)
	}
	return step
}

/** Resolves an operation id through the index or throws. See `resolveStep`. */
export function resolveOperation(
	index: PlanIndex,
	operationId: string,
): Operation {
	const operation = index.operationOf(operationId)
	if (operation === undefined) {
		throw new TypeError(
			`step names an operation the permitted interfaces do not declare: ${operationId}`,
		)
	}
	return operation
}
