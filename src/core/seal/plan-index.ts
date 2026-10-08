/**
 * resolves a pointer to its step and operation; nothing about reachability.
 * An operation is named by the pair `(interfaceId, operationId)`: an
 * `operationId` is unique only within the interface that declares it, so every
 * operation map keys by the pair.
 */
import type {
	AnyOperation,
	CommandOperation,
	InterfaceKindName,
	McpOperation,
	Operation,
	PermittedInterface,
} from '../schemas/interface.ts'
import type { InteractionStep } from '../schemas/plan.ts'
import {
	type EvidenceChannelName,
	IDENTIFIER_ROOTED_CHANNEL,
	INPUT_CHANNELS,
	INPUT_ROOTED_CHANNEL,
	type InputChannelName,
	SCALAR_CHANNELS,
	TAIL_BEARING_CHANNELS,
} from '../schemas/pointer.ts'
import { IDENTIFIER_CHARSET_SOURCE } from '../schemas/primitives.ts'

// An RFC 6901 reference token, respelled here because pointer.ts keeps its
// own TOKEN/TAIL fragments private. IDENTIFIER_CHARSET_SOURCE and the channel
// partition below are project vocabulary, so those are imported rather than
// respelled.
// A token of exactly `*` is the volatile-pointer wildcard and is refused here, as
// `pointer.ts` refuses it.
const TOKEN_SOURCE = '(?!\\*(?:/|$))(?:[^/~]|~[01])*'
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
	`^/interactions/(?<stepId>${IDENTIFIER_CHARSET_SOURCE})/(?:(?<tailBearingChannel>${alternation(TAIL_BEARING_CHANNELS)})(?<tailBearingTail>${TAIL_SOURCE})|(?<scalarChannel>${alternation(SCALAR_CHANNELS)})|${INPUT_ROOTED_CHANNEL}/(?<inputChannel>${alternation(INPUT_CHANNELS)})(?<callInputsTail>${TAIL_SOURCE})|${IDENTIFIER_ROOTED_CHANNEL}/(?<artifactId>${IDENTIFIER_CHARSET_SOURCE})(?<artifactTail>${TAIL_SOURCE}))$`,
)

const isEvidenceChannel = (value: string): value is EvidenceChannelName =>
	(TAIL_BEARING_CHANNELS as readonly string[]).includes(value) ||
	(SCALAR_CHANNELS as readonly string[]).includes(value)

const isInputChannel = (value: string): value is InputChannelName =>
	(INPUT_CHANNELS as readonly string[]).includes(value)

/**
 * Exported so `core/evaluate/evidence-resolution.ts` decodes pointer tails
 * with these same two functions, avoiding a second private copy (the drift
 * `IDENTIFIER_CHARSET_SOURCE`'s own precedent warns against).
 */
export const decodeToken = (token: string): string =>
	token.replace(/~1/g, '/').replace(/~0/g, '~')

export const decodeTail = (tailSource: string): readonly string[] =>
	tailSource === '' ? [] : tailSource.slice(1).split('/').map(decodeToken)

/**
 * One evidence target, resolved locally to its step id and channel. The
 * channel decides whether the rendered phrase says "the response you
 * obtained" or "the value you sent".
 */
export type EvidenceTarget = {
	stepId: string
	channel: EvidenceChannelName
	inputChannel: InputChannelName | null // non-null exactly when channel is 'call-inputs'
	artifactId: string | null // non-null exactly when channel is 'artifact'
	tail: readonly string[] // decoded RFC 6901 tokens; empty on a scalar channel
}

/**
 * Parses one `InteractionPointer` string (`INTERACTION_POINTER_PATTERN` in
 * `pointer.ts`) into its step id, channel, input channel, and tail, using
 * the schema's own channel partition so this accepts exactly what
 * `InteractionPointer.safeParse` accepts. A should-never-happen precondition
 * violation throws `TypeError`, per `digest.ts`'s precedent.
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
			inputChannel: null,
			artifactId: null,
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
			inputChannel: null,
			artifactId: null,
			tail: decodeTail(groups.tailBearingTail ?? ''),
		}
	}
	if (groups.inputChannel !== undefined) {
		if (!isInputChannel(groups.inputChannel)) {
			// Unreachable: INPUT_CHANNELS is exactly what this group can match.
			throw new TypeError(
				`call-inputs evidence target names no input channel: ${pointer}`,
			)
		}
		return {
			stepId,
			channel: 'call-inputs',
			inputChannel: groups.inputChannel,
			artifactId: null,
			tail: decodeTail(groups.callInputsTail ?? ''),
		}
	}
	if (groups.artifactId !== undefined) {
		return {
			stepId,
			channel: IDENTIFIER_ROOTED_CHANNEL,
			inputChannel: null,
			artifactId: groups.artifactId,
			tail: decodeTail(groups.artifactTail ?? ''),
		}
	}
	// Unreachable: the pattern's three branches are exhaustive once stepId matched.
	throw new TypeError(
		`not an interaction-rooted evidence pointer of a recognized channel: ${pointer}`,
	)
}

/**
 * What a pointer names: step, operation, and every step naming a given
 * operation, which `derived-reference.ts`'s escalation needs. Says nothing
 * about reachability or channel typing; the general addressing-grammar
 * resolver lives in `core/evaluate/evidence-resolution.ts` and reachability
 * in `core/compile/reachability.ts`.
 *
 * `operationOf` stays narrow on purpose. It hands a resolved `Operation` to
 * every downstream consumer, so widening its return type to the operation
 * union would retype seventeen files at once. A command operation and a tool
 * call each resolve to `undefined` from it and to a value from their own
 * accessor, and each caller that has to branch reads the declaring kind first.
 */
export type PlanIndex = {
	stepOf: (stepId: string) => InteractionStep | undefined
	operationOf: (
		interfaceId: string,
		operationId: string,
	) => Operation | undefined
	commandOperationOf: (
		interfaceId: string,
		operationId: string,
	) => CommandOperation | undefined
	mcpOperationOf: (
		interfaceId: string,
		operationId: string,
	) => McpOperation | undefined
	interfaceKindOf: (interfaceId: string) => InterfaceKindName | undefined
	stepsUsing: (
		interfaceId: string,
		operationId: string,
	) => readonly InteractionStep[]
	/** Whether more than one permitted interface declares this `operationId`. */
	isOperationIdShared: (operationId: string) => boolean
	/** Whether one interface declares this operation more than once, which leaves it resolving to nothing. */
	isOperationDuplicated: (interfaceId: string, operationId: string) => boolean
}

/** The two fields of a step that name the operation it selects. */
export type OperationRef = Pick<InteractionStep, 'interfaceId' | 'operationId'>

export type PlanIndexOptions = {
	duplicateIds?: 'throw' | 'unresolved'
}

/**
 * The one spelling of an operation as a map key: the pair joined on U+0000,
 * which no identifier carries. Every module that keys by operation uses this
 * one spelling.
 */
export const operationKey = (
	interfaceId: string,
	operationId: string,
): string => `${interfaceId}\u0000${operationId}`

/**
 * Builds the index once over the whole plan and interface set. Neither
 * schema enforces `stepId` uniqueness or one declaration per operation within
 * an interface. Strict callers keep the default throw, which refuses to pick a
 * declaration by array order. Standalone structural checks can select
 * `unresolved`, which removes every ambiguous identifier from lookup while
 * preserving all unambiguous entries. Two interfaces declaring the same `operationId` is not
 * ambiguous: each pair resolves to its own operation.
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
		const key = operationKey(step.interfaceId, step.operationId)
		const group = stepsByOperation.get(key)
		if (group === undefined) {
			stepsByOperation.set(key, [step])
		} else {
			group.push(step)
		}
	}
	const operations = new Map<string, Operation>()
	const commandOperations = new Map<string, CommandOperation>()
	const mcpOperations = new Map<string, McpOperation>()
	const kinds = new Map<string, InterfaceKindName>()
	const claimed = new Set<string>()
	const interfacesByOperationId = new Map<string, Set<string>>()
	const duplicateOperations = new Set<string>()
	/**
	 * Records one operation pair and answers whether the caller may store the
	 * operation. A pair one interface declares twice is removed from every map,
	 * so `operationOf` and its two siblings answer `undefined` for it. One
	 * closure serves all three arms: the bookkeeping is the same for every kind
	 * and only the destination map differs.
	 */
	const claim = (interfaceId: string, operationId: string): boolean => {
		const key = operationKey(interfaceId, operationId)
		if (claimed.has(key)) {
			if (duplicateIds === 'throw') {
				throw new TypeError(
					`duplicate operation id within interface ${interfaceId}: ${operationId}`,
				)
			}
			operations.delete(key)
			commandOperations.delete(key)
			mcpOperations.delete(key)
			duplicateOperations.add(key)
			return false
		}
		claimed.add(key)
		const declaring = interfacesByOperationId.get(operationId)
		if (declaring === undefined) {
			interfacesByOperationId.set(operationId, new Set([interfaceId]))
		} else {
			declaring.add(interfaceId)
		}
		return true
	}
	for (const iface of permittedInterfaces) {
		kinds.set(iface.logicalId, iface.kind)
		// Narrowed on the interface's own kind before its operations are read.
		// Each branch of `PermittedInterface` declares its own `operations`
		// element type, so an arm that narrowed first iterates
		// `CommandOperation`, `McpOperation` or `Operation` and stores it with
		// no cast. Widening through `operationsOf` first discards that
		// correlation, and no later kind test recovers it. `web` shares the api
		// map: it carries the api operation shape and every consumer of a
		// resolved operation reads the same declared fields off both.
		switch (iface.kind) {
			case 'cli':
				for (const operation of iface.operations) {
					if (claim(iface.logicalId, operation.operationId))
						commandOperations.set(
							operationKey(iface.logicalId, operation.operationId),
							operation,
						)
				}
				continue
			case 'mcp':
				for (const operation of iface.operations) {
					if (claim(iface.logicalId, operation.operationId))
						mcpOperations.set(
							operationKey(iface.logicalId, operation.operationId),
							operation,
						)
				}
				continue
			case 'api':
			case 'web':
				for (const operation of iface.operations) {
					if (claim(iface.logicalId, operation.operationId))
						operations.set(
							operationKey(iface.logicalId, operation.operationId),
							operation,
						)
				}
				continue
		}
		// Reachable only once a fifth kind joins the union, and then `iface` is
		// no longer `never` and this line fails the typecheck. That is the
		// forcing function the three hand-narrowed casts did not have: a kind
		// with no arm above was sorted into the api map by exhaustion.
		iface satisfies never
	}
	return {
		stepOf: (stepId) => steps.get(stepId),
		operationOf: (interfaceId, operationId) =>
			operations.get(operationKey(interfaceId, operationId)),
		commandOperationOf: (interfaceId, operationId) =>
			commandOperations.get(operationKey(interfaceId, operationId)),
		mcpOperationOf: (interfaceId, operationId) =>
			mcpOperations.get(operationKey(interfaceId, operationId)),
		interfaceKindOf: (interfaceId) => kinds.get(interfaceId),
		stepsUsing: (interfaceId, operationId) =>
			stepsByOperation.get(operationKey(interfaceId, operationId)) ?? [],
		isOperationIdShared: (operationId) =>
			(interfacesByOperationId.get(operationId)?.size ?? 0) > 1,
		isOperationDuplicated: (interfaceId, operationId) =>
			duplicateOperations.has(operationKey(interfaceId, operationId)),
	}
}

/**
 * Resolves a step id through the index or throws. Split from `stepOf` so the
 * index itself stays a plain lookup (`| undefined`, per
 * `noUncheckedIndexedAccess`) while callers get one function instead of
 * repeating the `undefined` check. A precondition violation, not a
 * `RuntimeFault`.
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

/**
 * The declared operation of whichever kind, for the callers that read only
 * fields all three shapes carry. Callers reading a kind-specific field ask
 * `interfaceKindOf` first and then take the matching accessor.
 */
export const anyOperationOf = (
	index: PlanIndex,
	ref: OperationRef,
): AnyOperation | undefined =>
	index.operationOf(ref.interfaceId, ref.operationId) ??
	index.commandOperationOf(ref.interfaceId, ref.operationId) ??
	index.mcpOperationOf(ref.interfaceId, ref.operationId)

/**
 * The clause that says why a step's pair resolves to no operation, shared by
 * every message that reports it: the interface does not declare the operation,
 * or declares it more than once and the index resolves neither declaration.
 */
export const undeclaredOperationClause = (
	index: PlanIndex,
	ref: OperationRef,
): string =>
	`on interface "${ref.interfaceId}", which that interface ${
		index.isOperationDuplicated(ref.interfaceId, ref.operationId)
			? 'declares more than once'
			: 'does not declare'
	}`

/**
 * Resolves a step's operation through the index or throws. See `resolveStep`.
 *
 * Reads all three maps. It read `operationOf` alone, so it threw for a command
 * operation and then for a tool call with the message "the permitted interfaces
 * do not declare it", which is false: they declare it, and a different accessor
 * holds it. Callers narrow with the operation predicates in
 * `core/declared-inputs.ts`.
 */
export function resolveOperation(
	index: PlanIndex,
	ref: OperationRef,
): AnyOperation {
	const operation = anyOperationOf(index, ref)
	if (operation === undefined) {
		throw new TypeError(
			`step names operation "${ref.operationId}" ${undeclaredOperationClause(index, ref)}`,
		)
	}
	return operation
}
