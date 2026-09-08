/**
 * What an operation declares it accepts, as predicates over a request shape,
 * plus the resolution that lets a caller read one without knowing its kind.
 *
 * At the `core/` root because `core/schemas/` holds Zod definitions only, and
 * because AD-10's exemption is read by two modules: the compile check that
 * enforces it and the reducer that records it.
 */
import type {
	AnyOperation,
	CommandOperation,
	Operation,
} from './schemas/interface.ts'
import type { BindingChannel, InputBinding } from './schemas/plan.ts'
import {
	COMMAND_CHANNELS,
	type EvidenceChannelName,
	INPUT_CHANNELS,
	type InputChannelName,
	TRANSPORT_CHANNELS,
} from './schemas/pointer.ts'
import type { KeyedShapeDescriptor } from './schemas/primitives.ts'

/**
 * Which output channel the operation's one response descriptor describes.
 *
 * AD-19 gives every operation exactly one descriptor, and the channel that
 * descriptor describes is what makes its keys addressable. For an interface
 * that speaks HTTP that channel is the response body; a command operation
 * declares its own. One rule, three roots: every consumer that used to hard-code
 * `response-body` asks this instead.
 */
export const descriptorChannelOf = (
	operation: AnyOperation,
): EvidenceChannelName => {
	if (!isCommandOperation(operation)) return 'response-body'
	const { descriptorChannel } = operation
	return descriptorChannel.kind === 'stream'
		? descriptorChannel.channel
		: 'artifact'
}

/**
 * Which artifact the descriptor describes, or `null` when it describes a
 * stream. An artifact pointer descends through the descriptor only when it
 * names this one; every other declared artifact is known to exist and declares
 * no structure.
 */
export const descriptorArtifactOf = (
	operation: AnyOperation,
): string | null => {
	if (!isCommandOperation(operation)) return null
	const { descriptorChannel } = operation
	return descriptorChannel.kind === 'artifact'
		? descriptorChannel.artifactId
		: null
}

/**
 * Whether an evidence target addresses the channel this operation's response
 * descriptor describes.
 *
 * The channel name alone is not the answer on the artifact channel: an
 * operation may declare several files while its one descriptor describes one of
 * them, so a pointer at a different file names a channel with no declared
 * structure. Every consumer asks this rather than comparing the channel itself,
 * because comparing only the channel was a defect at three separate sites and a
 * fourth site would have made the same mistake for the same reason.
 */
export const targetsDescribedChannel = (
	operation: AnyOperation,
	target: {
		readonly channel: EvidenceChannelName
		readonly artifactId: string | null
	},
): boolean => {
	if (target.channel !== descriptorChannelOf(operation)) return false
	if (target.channel !== 'artifact') return true
	return target.artifactId === descriptorArtifactOf(operation)
}

/** Every artifact identifier the operation declares it writes. */
export const declaredArtifactsOf = (
	operation: AnyOperation,
): readonly string[] =>
	isCommandOperation(operation) ? operation.artifacts : []

/** One declared input channel with the shape it declares, already paired. */
export type RequestChannel = {
	readonly channel: InputChannelName
	readonly shape: KeyedShapeDescriptor
}

/**
 * Which operation shape this is. Reads `invocation` rather than a kind field,
 * because an operation does not carry its interface's kind; the two shapes are
 * distinguished by a required field only one of them declares.
 */
export const isCommandOperation = (
	operation: AnyOperation,
): operation is CommandOperation => 'invocation' in operation

/** The same question the other way round, for the callers that filter. */
export const isApiOperation = (
	operation: AnyOperation,
): operation is Operation => !isCommandOperation(operation)

/**
 * The operation's input channels paired with the shapes they declare.
 *
 * Callers take the pairs rather than a channel list they then index the
 * request shape with. Indexing is what breaks under the operation union:
 * TypeScript cannot prove that a channel name drawn from one kind's tuple is a
 * key of the other kind's shape, and both ways around that are casts. Pairing
 * dereferences the union once, here.
 */
export function requestChannelsOf(
	operation: AnyOperation,
): readonly RequestChannel[] {
	if (isCommandOperation(operation)) {
		return COMMAND_CHANNELS.map((channel) => ({
			channel,
			shape: operation.requestShape[channel],
		}))
	}
	return TRANSPORT_CHANNELS.map((channel) => ({
		channel,
		shape: operation.requestShape[channel],
	}))
}

/** The shape one named channel declares, or `undefined` off this kind. */
export function requestShapeOf(
	operation: AnyOperation,
	channel: InputChannelName,
): KeyedShapeDescriptor | undefined {
	return requestChannelsOf(operation).find((entry) => entry.channel === channel)
		?.shape
}

/** The channel names an operation of this kind may declare inputs on. */
export const inputChannelsOf = (
	operation: AnyOperation,
): readonly InputChannelName[] =>
	isCommandOperation(operation) ? COMMAND_CHANNELS : TRANSPORT_CHANNELS

/**
 * A step's bound channels paired with what each binds, for the same reason
 * `requestChannelsOf` pairs: `InputBinding` is a union and a channel name
 * drawn from one branch is not a key of the other.
 *
 * Ordered by `INPUT_CHANNELS` rather than by the parsed object's own key
 * order, so which binding a check reports never depends on how the document
 * happened to be written.
 */
export function boundChannelsOf(binding: InputBinding): readonly {
	readonly channel: InputChannelName
	readonly bound: BindingChannel
}[] {
	const present = binding as Partial<Record<InputChannelName, BindingChannel>>
	return INPUT_CHANNELS.filter((channel) => channel in binding).map(
		(channel) => ({ channel, bound: present[channel] ?? null }),
	)
}

/**
 * AD-10's exemption predicate. Any of a channel's three lists naming a key
 * counts: a permitted-only or types-only channel is still a surface a witness
 * can vary.
 */
export function declaresNoRequestKeys(operation: AnyOperation): boolean {
	return requestChannelsOf(operation).every(
		({ shape }) =>
			shape.requiredKeys.length === 0 &&
			shape.permittedKeys.length === 0 &&
			Object.keys(shape.types).length === 0,
	)
}

/** Whether no channel declares a required key. */
export function declaresNoRequiredKeys(operation: AnyOperation): boolean {
	return requestChannelsOf(operation).every(
		({ shape }) => shape.requiredKeys.length === 0,
	)
}

export type { AnyOperation, CommandOperation, Operation }
