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

// An RFC 6901 reference token, respelled here because pointer.ts keeps its
// own TOKEN/TAIL fragments private. IDENTIFIER_CHARSET_SOURCE and the channel
// partition below are project vocabulary, so those are imported rather than
// respelled.
const TOKEN_SOURCE = '(?:[^/~]|~[01])*'
const TAIL_SOURCE = `(?:/${TOKEN_SOURCE})*`

const alternation = (members: readonly string[]): string => members.join('|')

// Mirrors `pointer.ts`'s own `INTERACTION_POINTER_PATTERN` three-branch
// partition rather than a flatter grammar: a flatter version once silently
// accepted `/interactions/poll/response-status/oops` (a schema reject) by
// discarding the bogus trailing segment instead of rejecting the pointer.
// Named capture groups replace positional indices, avoiding a fragile
// dependency on `IDENTIFIER_CHARSET_SOURCE` staying free of its own capturing
// groups.
const EVIDENCE_TARGET_PATTERN = new RegExp(
	`^/interactions/(?<stepId>${IDENTIFIER_CHARSET_SOURCE})/(?:(?<tailBearingChannel>${alternation(TAIL_BEARING_CHANNELS)})(?<tailBearingTail>${TAIL_SOURCE})|(?<scalarChannel>${alternation(SCALAR_CHANNELS)})|${TRANSPORT_ROOTED_CHANNEL}/(?<transportChannel>${alternation(TRANSPORT_CHANNELS)})(?<callInputsTail>${TAIL_SOURCE}))$`,
)

const isEvidenceChannel = (value: string): value is EvidenceChannelName =>
	(TAIL_BEARING_CHANNELS as readonly string[]).includes(value) ||
	(SCALAR_CHANNELS as readonly string[]).includes(value)

const isTransportChannel = (value: string): value is TransportChannelName =>
	(TRANSPORT_CHANNELS as readonly string[]).includes(value)

/**
 * Exported for Story 4.1's reuse: `core/evaluate/evidence-resolution.ts`
 * decodes pointer tails with these same two functions, avoiding a second
 * private copy (the drift `IDENTIFIER_CHARSET_SOURCE`'s own precedent warns
 * against).
 */
export const decodeToken = (token: string): string =>
	token.replace(/~1/g, '/').replace(/~0/g, '~')

export const decodeTail = (tailSource: string): readonly string[] =>
	tailSource === '' ? [] : tailSource.slice(1).split('/').map(decodeToken)

/**
 * One evidence target, resolved locally to its step id and channel. The
 * channel decides whether the rendered phrase says "the response you
 * obtained" or "the value you sent" (AC 2).
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
 * violation throws `TypeError`, per `digest.ts`'s precedent (Decision 4).
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
 * What a pointer names: step, operation, and (Task 4's escalation) every step
 * naming a given operation. Says nothing about reachability or channel
 * typing; the general addressing-grammar resolver is Epic 4's (Decision 3).
 */
export type PlanIndex = {
	stepOf: (stepId: string) => InteractionStep | undefined
	operationOf: (operationId: string) => Operation | undefined
	stepsUsing: (operationId: string) => readonly InteractionStep[]
}

export type PlanIndexOptions = {
	duplicateIds?: 'throw' | 'unresolved'
}

/**
 * Builds the index once over the whole plan and interface set. Neither
 * schema enforces `stepId`/`operationId` uniqueness. Strict callers keep the
 * default throw instead of resolving by array order. Standalone structural
 * checks can select `unresolved`, which removes every ambiguous identifier
 * from lookup while preserving all unambiguous entries.
 */
export function buildPlanIndex(
	interactionPlan: readonly InteractionStep[],
	permittedInterfaces: readonly PermittedInterface[],
	options: PlanIndexOptions = {},
): PlanIndex {
	const duplicateIds = options.duplicateIds ?? 'throw'
	const steps = new Map<string, InteractionStep>()
	const duplicateStepIds = new Set<string>()
	const stepsByOperation = new Map<string, InteractionStep[]>()
	for (const step of interactionPlan) {
		if (steps.has(step.stepId) || duplicateStepIds.has(step.stepId)) {
			if (duplicateIds === 'throw') {
				throw new TypeError(`duplicate interaction step id: ${step.stepId}`)
			}
			steps.delete(step.stepId)
			duplicateStepIds.add(step.stepId)
		} else {
			steps.set(step.stepId, step)
		}
		const group = stepsByOperation.get(step.operationId)
		if (group === undefined) {
			stepsByOperation.set(step.operationId, [step])
		} else {
			group.push(step)
		}
	}
	const operations = new Map<string, Operation>()
	const duplicateOperationIds = new Set<string>()
	for (const iface of permittedInterfaces) {
		for (const operation of iface.operations) {
			if (
				operations.has(operation.operationId) ||
				duplicateOperationIds.has(operation.operationId)
			) {
				if (duplicateIds === 'throw') {
					throw new TypeError(
						`duplicate operation id across permitted interfaces: ${operation.operationId}`,
					)
				}
				operations.delete(operation.operationId)
				duplicateOperationIds.add(operation.operationId)
			} else {
				operations.set(operation.operationId, operation)
			}
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
 * index itself stays a plain lookup (`| undefined`, per
 * `noUncheckedIndexedAccess`) while callers get one function instead of
 * repeating the `undefined` check. A precondition violation, not a
 * `RuntimeFault` (Decision 4).
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
