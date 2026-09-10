/** permitted interfaces and the per-operation declaration inventory. */
import { z } from 'zod'
import { DescriptorPointer } from './pointer.ts'
import {
	Identifier,
	KeyedShapeDescriptor,
	KeyName,
	KeyTypeMap,
	ToolName,
} from './primitives.ts'
import { SensitivityWitness } from './sensitivity-witness.ts'

/** AD-19's closed four-member set, declared per pointer the descriptor names. */
export const ChannelRole = z.enum([
	'success-indicator',
	'diagnostic',
	'payload',
	'collection',
])

/**
 * AD-19's closed mode set. `page-bounded` is what makes AD-20 rule 6's
 * injection form the required satisfaction and its bijection form an error,
 * rather than a coin toss between two forms with opposite outcomes.
 */
export const ExpectedCardinality = z.discriminatedUnion('mode', [
	z.strictObject({ mode: z.literal('exact'), count: z.int().min(0) }),
	z.strictObject({ mode: z.literal('at-most'), max: z.int().min(0) }),
	z.strictObject({ mode: z.literal('page-bounded'), max: z.int().min(0) }),
])

export const CollectionLocation = z.strictObject({
	pointer: DescriptorPointer,
	expectedCardinality: ExpectedCardinality,
	referenceSet: Identifier.nullable().describe(
		'AD-20 rule 6 is relevant when a declared collection location names a reference set, so `null` is the shape that makes the rule irrelevant and must stay representable.',
	),
})

/**
 * AD-19's closed response descriptor, scoped per operation rather than per
 * interface: an interface-wide union is vacuous in the ordinary multi-shape
 * case, since a job resource, a page of rows, and an error share no required
 * key, leaving rule 2 no truthful denominator.
 */
export const ResponseDescriptor = z.strictObject({
	requiredKeys: z
		.array(KeyName)
		.describe(
			'No minimum of two anywhere in this shape: AD-20 rule 2 relevance is "the descriptor declares more than one pointer", so a one-pointer descriptor must parse in order to be the irrelevant case.',
		),
	permittedKeys: z.array(KeyName),
	types: KeyTypeMap.describe(
		'Caller-keyed by plain key name, never by pointer: this is the shape where that trap bites, since `requiredKeys` sits beside a pointer-keyed `channelRoles` and a pointer-valued `successIndicator`, and the descriptor-relative spelling must not be extended here by analogy. A missing key means "not declared"; an explicit `null` value means "declared, type not stated", which is AD-31\'s enumerated indeterminate descriptor state and the shape `quantifier-over-non-collection` reads.',
	),
	successIndicator: DescriptorPointer.nullable().describe(
		'AD-20 rule 1 relevance reads this as its first conjunct, so `null` must stay representable.',
	),
	channelRoles: z
		.record(DescriptorPointer, ChannelRole)
		.nullable()
		.describe(
			'Caller-keyed, and expected to be partial: a missing key means "no role declared for that pointer". AD-31 grades absent and explicitly empty differently, so `null`, `{}`, and a populated map are three distinct answers. Deliberately not refined to require a role for every descriptor key: no AD-5 code names that rule, the AD-31 predicates degrade gracefully on partial roles, and a refinement buys nothing an export can carry.',
		),
	collectionLocations: z
		.array(CollectionLocation)
		.nullable()
		.describe(
			'AD-20 rule 4 relevance reads this, and AD-31 grades an absent declaration and an explicit empty one differently, so `null` and `[]` are distinct answers.',
		),
})

export type ResponseDescriptor = z.infer<typeof ResponseDescriptor>

/**
 * AD-19's four transport channels, spelled as a four-key strict object rather
 * than a record over a channel enum: a record over an enum key demands every
 * member at parse time, and `z.partialRecord` accepts the partial only by
 * reintroducing the omitted-key spelling the Consistency Conventions ban.
 *
 * Each channel is a declared triple rather than nullable: a request channel's
 * "declared, no keys" state already has a spelling (an empty required list,
 * an empty permitted list, an empty type map), unlike an input-binding
 * channel, where that state is indistinguishable from unused.
 */
export const RequestShape = z.strictObject({
	path: KeyedShapeDescriptor,
	query: KeyedShapeDescriptor,
	header: KeyedShapeDescriptor.describe(
		'AD-18: a header channel declaration names a header and its type and never carries a credential value.',
	),
	body: KeyedShapeDescriptor,
})

/** AD-19's closed seven, uppercase; AD-40 compares against them. */
export const HttpMethod = z.enum([
	'GET',
	'HEAD',
	'POST',
	'PUT',
	'PATCH',
	'DELETE',
	'OPTIONS',
])

// AD-19: parameters are spelled `{name}` in braces only, because AD-40
// compares templates as literal segments plus parameter positions, and two
// implementations must not disagree over whether `/notes/{id}` and
// `/notes/:id` are one template. A colon is excluded from a literal segment,
// so `:name` is a syntax error rather than a segment that merely starts with
// one.
export const PATH_TEMPLATE_PATTERN = /^(?:\/(?:[^/{}:]|\{[A-Za-z0-9_-]+\})*)+$/

export const PathTemplate = z
	.string()
	.regex(PATH_TEMPLATE_PATTERN)
	.describe(
		'A path template whose parameters are spelled `{name}` in braces. The `:name` spelling is rejected: AD-40 resolves a defect signature by comparing method and path template, and that comparison is not implementable against an unstated syntax.',
	)

export const Operation = z
	.strictObject({
		operationId: Identifier,
		method: HttpMethod,
		pathTemplate: PathTemplate,
		stateChangeMarker: z
			.boolean()
			.describe(
				'AD-19: whether the operation is intended to change state. AD-20 rule 7 relevance reads it, and AD-10 selects the sensitivity channel by it. Both values are legal and neither is a default.',
			),
		requestShape: RequestShape,
		responseDescriptor: ResponseDescriptor,
		volatilePointers: z.array(DescriptorPointer),
		sensitivityWitness: SensitivityWitness.nullable().describe(
			'AD-10, mandatory per declared operation rather than per interface. `null` is legal only for an operation declaring no keys in any request channel; AD-10 exempts that operation and requires the exemption to be recorded, which pre-flight does as an `exempt` check. An input-bearing operation declaring `null` fails a strict compilation under `undeclared-mandatory-input`, alongside the other declaration-completeness check that code already gates.',
		),
	})
	.meta({
		id: 'Operation',
		description:
			"AD-19's per-operation declaration inventory for an interface that speaks HTTP. Carried by the `api` and `web` branches alike, so the export names it once instead of inlining two copies that could drift apart.",
	})

export type Operation = z.infer<typeof Operation>

/**
 * AD-35 applied to a command: the operation names a logical executable and the
 * caller maps it to something runnable outside the contract. `Identifier`'s
 * charset admits no slash, dot, or colon, so `/usr/local/bin/tool`, `./tool`,
 * and `http://host/tool` are parse errors rather than compile findings. That is
 * what makes AD-35 structural here instead of advisory.
 *
 * The subcommand path is a list of segments rather than one string for the
 * reason `PathTemplate` spells parameters in braces and nothing else: AD-40
 * compares identities as segments, and a single string would force two
 * implementations to agree on a separator no field declares.
 */
export const CommandInvocation = z.strictObject({
	executable: Identifier.describe(
		'A logical executable name, never a filesystem path, a URL, a host, or a port (AD-35). The caller maps it to an authorized target through configuration outside the contract.',
	),
	subcommandPath: z
		.array(Identifier)
		.describe(
			'The subcommand segments after the executable, outermost first. Empty is legal and means the executable is invoked with no subcommand.',
		),
})

export type CommandInvocation = z.infer<typeof CommandInvocation>

/**
 * The command counterpart of `RequestShape`, built as a four-key strict object
 * for the reason the comment above `RequestShape` gives: a record over a
 * channel enum demands every member at parse time, and the partial spelling
 * that would relax it is the one the Consistency Conventions ban.
 */
export const CommandRequestShape = z.strictObject({
	argument: KeyedShapeDescriptor.describe(
		"Positional arguments, keyed by the name the contract gives each position. The key is the author's own label; position is not encoded here, because no AD-31 predicate reads argument order.",
	),
	option: KeyedShapeDescriptor,
	environment: KeyedShapeDescriptor.describe(
		'AD-18: an environment channel declaration names a variable and its type and never carries a credential value. The same rule the header channel carries, for the channel that plays the same role off an HTTP interface.',
	),
	stdin: KeyedShapeDescriptor,
})

export type CommandRequestShape = z.infer<typeof CommandRequestShape>

/**
 * Which output channel the operation's one response descriptor describes.
 *
 * Tagged on `kind` rather than spelled as a bare channel name because `stdout`
 * is itself a legal `Identifier`: an untagged root could not tell the stream
 * from an artifact genuinely named `stdout`, which is exactly the ambiguity the
 * two members below would otherwise share.
 */
export const CommandDescriptorChannel = z.discriminatedUnion('kind', [
	z.strictObject({
		kind: z.literal('stream'),
		channel: z.enum(['stdout', 'stderr']),
	}),
	z.strictObject({
		kind: z.literal('artifact'),
		artifactId: Identifier.describe(
			'One of the identifiers this operation declares in `artifacts`. A name absent from that list fails compilation under `unresolved-artifact-reference` rather than resolving absent, because a dangling declaration is an authoring fault the compiler can see.',
		),
	}),
])

export type CommandDescriptorChannel = z.infer<typeof CommandDescriptorChannel>

/**
 * A command-kind operation. It carries exactly one `ResponseDescriptor`, the
 * same shape an api operation carries, and `descriptorChannel` says which
 * output channel that descriptor describes.
 *
 * One descriptor rather than one per output channel: AD-19 fixes the descriptor
 * per operation so that `requiredKeys` has a truthful value, and AD-20 rule 2
 * reads "the required keys of the response descriptor belonging to the
 * operation that step invokes" as its denominator. Several descriptors leave
 * that phrase with several referents, which is the defect AD-19 already records
 * one level up for an interface-wide union. An operation whose stream and whose
 * written file both need declared structure is two operations.
 *
 * There is no declared success value space for the exit code. AD-19 already
 * declares one nominated success indicator per operation, and an exit-code
 * assertion is an ordinary oracle over `/interactions/{stepId}/exit-code`,
 * which the pointer grammar carries as a scalar channel.
 */
export const CommandOperation = z.strictObject({
	operationId: Identifier,
	invocation: CommandInvocation,
	stateChangeMarker: z
		.boolean()
		.describe(
			'AD-19: whether the operation is intended to change state. AD-20 rule 7 relevance reads it, and AD-10 selects the sensitivity channel by it. Both values are legal and neither is a default.',
		),
	requestShape: CommandRequestShape,
	artifacts: z
		.array(Identifier)
		.describe(
			"The files the operation writes, as bare declared identifiers with existence semantics only. No descriptor and no keys of their own: an artifact pointer's identifier segment resolves against this list, and structure comes from the operation's one response descriptor when `descriptorChannel` nominates that artifact. A pointer naming an identifier absent here fails compilation under `unresolved-artifact-reference`.",
		),
	descriptorChannel: CommandDescriptorChannel,
	responseDescriptor: ResponseDescriptor,
	volatilePointers: z.array(DescriptorPointer),
	sensitivityWitness: SensitivityWitness.nullable().describe(
		"AD-10, mandatory per declared operation rather than per interface, on the api operation's own terms. `null` is legal only for an operation declaring no keys in any request channel, which for a command means no argument, no option, no environment variable, and no standard input. An input-bearing operation declaring `null` fails a strict compilation under `undeclared-mandatory-input`.",
	),
})

export type CommandOperation = z.infer<typeof CommandOperation>

/**
 * The tool-call counterpart of `RequestShape`, a one-key strict object for the
 * reason that comment gives: a record over a channel enum demands every member
 * at parse time, and the partial spelling that would relax it is the one the
 * Consistency Conventions ban.
 *
 * One key rather than four. A tool call carries an arguments object and nothing
 * else, so declaring `path`, `query`, and `header` beside it would put three
 * channels on every contract that no call can ever send and no oracle can ever
 * reach.
 */
export const McpRequestShape = z.strictObject({
	arguments: KeyedShapeDescriptor.describe(
		"The tool's declared arguments, keyed by the names the server publishes for them. AD-18 applies as it does to a header: a declaration names an argument and its type and never carries a credential value.",
	),
})

export type McpRequestShape = z.infer<typeof McpRequestShape>

/**
 * Which output channel the operation's one response descriptor describes.
 *
 * Tagged on `kind` with one member, following `CommandDescriptorChannel`. The
 * second member is already known: a tool that returns prose rather than
 * structured content is outside this version, and admitting it later adds a
 * member, which AD-11 makes additive, where retyping a bare field would be
 * breaking.
 */
export const McpDescriptorChannel = z.discriminatedUnion('kind', [
	z.strictObject({ kind: z.literal('structured-result') }),
])

export type McpDescriptorChannel = z.infer<typeof McpDescriptorChannel>

/**
 * A tool-call operation.
 *
 * `toolName` is the whole transport identity. Every MCP call shares the one
 * transport identity `tools/call` and the tool name is what distinguishes two
 * of them, so a method and a path template would render one signature for every
 * tool a server publishes and collide under `duplicate-operation-signature`.
 * AD-40 needs that identity readable by a probe seeder who has never opened the
 * contract, and a published tool name is exactly that.
 *
 * It carries the same `ResponseDescriptor` an api operation carries, over the
 * structured result its `descriptorChannel` nominates, so all fourteen AD-31
 * predicates read one descriptor one dereference deep with no kind-specific
 * arm.
 */
export const McpOperation = z.strictObject({
	operationId: Identifier,
	toolName: ToolName,
	stateChangeMarker: z
		.boolean()
		.describe(
			'AD-19: whether the operation is intended to change state. AD-20 rule 7 relevance reads it, and AD-10 selects the sensitivity channel by it. Both values are legal and neither is a default.',
		),
	requestShape: McpRequestShape,
	descriptorChannel: McpDescriptorChannel,
	responseDescriptor: ResponseDescriptor,
	volatilePointers: z.array(DescriptorPointer),
	sensitivityWitness: SensitivityWitness.nullable().describe(
		"AD-10, mandatory per declared operation rather than per interface, on the api operation's own terms. `null` is legal only for an operation declaring no keys in its arguments channel. An input-bearing operation declaring `null` fails a strict compilation under `undeclared-mandatory-input`.",
	),
})

export type McpOperation = z.infer<typeof McpOperation>

/** Any operation shape, for the consumers that read only kind-neutral fields. */
export type AnyOperation = Operation | CommandOperation | McpOperation

/**
 * AD-19's four interface kinds, exported once so nothing else respells them:
 * the sealed evaluator brief carries interface identity without the operation
 * inventory (AD-16) and needs this vocabulary. Naming the array changes no
 * exported byte, since an enum with no `.meta({ id })` inlines at each use
 * site exactly as the literal did.
 */
export const INTERFACE_KINDS = ['api', 'web', 'cli', 'mcp'] as const

export type InterfaceKindName = (typeof INTERFACE_KINDS)[number]

export const InterfaceKind = z.enum(INTERFACE_KINDS)

const LOGICAL_ID_DESCRIPTION =
	"AD-35: a logical identifier for the interface, never a URL, host, or port. Mapping it to a target is the caller's, outside the contract."

const OPERATIONS_DESCRIPTION =
	'No uniqueness constraint: two operations colliding on their transport identity after parameter-name erasure is `duplicate-operation-signature`, a coded compile-time error, and a schema that deduped them would delete it.'

// `web` is the only kind left sharing the api operation shape, and the factory
// survives its second caller leaving because that is what keeps the two
// branches byte-identical. `web` still fails compilation under
// `unsupported-interface-kind`, which needs the kind to reach the compiler:
// a parse failure carries no AD-5 code, no artifact path, and no name for the
// kind that is unsupported, which is the opposite of AD-10's "fails
// compilation honestly".
const apiShapedInterface = <Kind extends 'api' | 'web'>(kind: Kind) =>
	z.strictObject({
		logicalId: Identifier.describe(LOGICAL_ID_DESCRIPTION),
		kind: z.literal(kind),
		operations: z.array(Operation).describe(OPERATIONS_DESCRIPTION),
	})

/**
 * Discriminated on `kind`, so an operation shape cannot be smuggled onto the
 * wrong interface: a `cli` interface declaring `method`, an `api` interface
 * declaring `invocation`, and an `mcp` interface declaring either are all parse
 * errors.
 */
export const PermittedInterface = z.discriminatedUnion('kind', [
	apiShapedInterface('api'),
	apiShapedInterface('web'),
	z.strictObject({
		logicalId: Identifier.describe(LOGICAL_ID_DESCRIPTION),
		kind: z.literal('mcp'),
		operations: z.array(McpOperation).describe(OPERATIONS_DESCRIPTION),
	}),
	z.strictObject({
		logicalId: Identifier.describe(LOGICAL_ID_DESCRIPTION),
		kind: z.literal('cli'),
		operations: z.array(CommandOperation).describe(OPERATIONS_DESCRIPTION),
	}),
])

export type PermittedInterface = z.infer<typeof PermittedInterface>

/**
 * One interface's operations widened to the element union, for the callers
 * that read only fields all three shapes carry. `iface.operations.map(...)` on
 * an un-narrowed interface does not compile, because the union's branches give
 * it a union of array types whose `map` signatures do not unify, and this is
 * the one place that widening is spelled so no call site invents its own.
 *
 * A caller that narrows on `iface.kind` first wants the opposite and should
 * read `iface.operations` directly: each branch declares its own element type,
 * and this function discards the kind-to-shape correlation that a later kind
 * test cannot recover. `buildPlanIndex` (`core/seal/plan-index.ts`) is the site
 * that sorts by kind, and it narrows first for exactly that reason.
 */
export const operationsOf = (
	iface: PermittedInterface,
): readonly AnyOperation[] => iface.operations
