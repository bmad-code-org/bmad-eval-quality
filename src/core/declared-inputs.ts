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
	McpDescriptorChannel,
	McpOperation,
	Operation,
} from './schemas/interface.ts'
import type { BindingChannel, InputBinding } from './schemas/plan.ts'
import {
	COMMAND_CHANNELS,
	type EvidenceChannelName,
	INPUT_CHANNELS,
	type InputChannelName,
	MCP_CHANNELS,
	TRANSPORT_CHANNELS,
} from './schemas/pointer.ts'
import type { KeyedShapeDescriptor } from './schemas/primitives.ts'

// The channel each tagged descriptor-channel member names. Keyed on the tag, so
// admitting the prose half of a tool result later fails the typecheck here.
const MCP_DESCRIPTOR_CHANNELS: Record<
	McpDescriptorChannel['kind'],
	EvidenceChannelName
> = {
	'structured-result': 'response-body',
}

/**
 * Which output channel the operation's one response descriptor describes.
 *
 * AD-19 gives every operation exactly one descriptor, and the channel that
 * descriptor describes is what makes its keys addressable. For an interface
 * that speaks HTTP that channel is the response body, and a tool call's
 * structured result lands on the same one; a command operation declares its
 * own. One rule, several roots: every consumer that used to hard-code
 * `response-body` asks this instead.
 */
export const descriptorChannelOf = (
	operation: AnyOperation,
): EvidenceChannelName => {
	if (isCommandOperation(operation)) {
		const { descriptorChannel } = operation
		return descriptorChannel.kind === 'stream'
			? descriptorChannel.channel
			: 'artifact'
	}
	if (isMcpOperation(operation)) {
		return MCP_DESCRIPTOR_CHANNELS[operation.descriptorChannel.kind]
	}
	return 'response-body'
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
	// Only a command operation nominates a file. A tool call and an HTTP
	// response both describe a channel the transport always produces.
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
 * Which operation shape this is. Each predicate reads a required field only its
 * own shape declares, because an operation does not carry its interface's kind.
 *
 * Three tests rather than one test and its negation. A negation answered `true`
 * for every shape that was not the one it named, so the day a third shape
 * landed the api arm would have claimed it silently and every dispatch below
 * would have handed a tool call the four transport channels. The cost of
 * spelling all three is that a fourth shape breaks the typecheck at each
 * dispatch, which is where the decision belongs.
 */
export const isCommandOperation = (
	operation: AnyOperation,
): operation is CommandOperation => 'invocation' in operation

export const isMcpOperation = (
	operation: AnyOperation,
): operation is McpOperation => 'toolName' in operation

/**
 * Repaired to ask its own question positively. Its two callers filter a mixed
 * inventory down to the shape that declares a method and a path template, and a
 * negation would have handed them every tool call as well.
 */
export const isApiOperation = (
	operation: AnyOperation,
): operation is Operation => 'method' in operation

/**
 * The operation's input channels paired with the shapes they declare.
 *
 * Callers take the pairs rather than a channel list they then index the
 * request shape with. Indexing is what breaks under the operation union:
 * TypeScript cannot prove that a channel name drawn from one kind's tuple is a
 * key of another kind's shape, and both ways around that are casts. Pairing
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
	if (isMcpOperation(operation)) {
		return MCP_CHANNELS.map((channel) => ({
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
): readonly InputChannelName[] => {
	if (isCommandOperation(operation)) return COMMAND_CHANNELS
	if (isMcpOperation(operation)) return MCP_CHANNELS
	return TRANSPORT_CHANNELS
}

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
 * One channel's entry out of a flat channel-keyed record, or `null` where the
 * record carries no key for it.
 *
 * `ObservedCallInputs` and `ProbeInputBinding` are both keyed by input channel
 * and both stop at the eight channels the first two kinds accept, while the
 * pointer grammar and the loops that walk it now run over nine. The ninth key
 * lands with the sealed run record's own breaking bump, and this is what keeps
 * a loop over the vocabulary total until it does.
 *
 * `null` is the right answer for the callers that read a declared binding,
 * because `null` is what both shapes already spell for a channel nothing was
 * sent on and every one of them fails closed on it. It is the wrong answer for
 * a caller resolving evidence, which is why `channelEntryOrAbsent` exists: see
 * the note on it.
 */
export const channelEntryOf = <Value>(
	record: Readonly<Record<string, Value | null>>,
	channel: InputChannelName,
): Value | null =>
	hasChannel(record, channel) ? (record[channel] ?? null) : null

const hasChannel = (record: object, channel: InputChannelName): boolean =>
	Object.hasOwn(record, channel)

/**
 * The same read for evidence resolution, where a missing key has to answer
 * ABSENT.
 *
 * A channel the record has no key for carried nothing, and `null` would read as
 * present under AD-26: `existence` over it would hold on every run and
 * `absence` would fail on every run, with no run able to change either answer.
 * That is the same inversion the artifact channel's own guard in
 * `evidence-resolution.ts` exists to prevent for a file the run did not write.
 *
 * Takes the absent value rather than importing it, because `core/evaluate`
 * owns the resolved-value domain and this module sits under `core/`.
 */
export const channelEntryOrAbsent = <Value, Absent>(
	record: Readonly<Record<string, Value | null>>,
	channel: InputChannelName,
	absent: Absent,
): Value | null | Absent =>
	hasChannel(record, channel) ? (record[channel] ?? null) : absent

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

export type { AnyOperation, CommandOperation, McpOperation, Operation }
