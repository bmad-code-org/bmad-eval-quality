/** permitted interfaces and the per-operation declaration inventory. */
import { z } from 'zod'
import { DescriptorPointer } from './pointer.ts'
import {
	Identifier,
	KeyedShapeDescriptor,
	KeyName,
	KeyTypeMap,
} from './primitives.ts'

/** AD-19's closed four-member set, declared per pointer the descriptor names. */
export const ChannelRole = z.enum([
	'success-indicator',
	'diagnostic',
	'payload',
	'collection',
])

/**
 * AD-19's closed mode set. `page-bounded` is what makes the injection form of
 * AD-20's rule 6 the required satisfaction and the bijection an error; without
 * the mode the predicate is a coin toss between two forms that report opposite
 * outcomes on one contract.
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
 * AD-19's per-operation closed response descriptor. Per operation rather than
 * per interface: one interface-wide union descriptor is vacuous in the ordinary
 * multi-shape case, since operations returning a job resource, a page of rows,
 * and an error share no required key, which left rule 2 with no truthful
 * denominator.
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

/**
 * AD-19's four transport channels. Spelled as a four-key strict object rather
 * than a record over a channel enum: a record over an enum key demands every
 * member at parse time, and `z.partialRecord` accepts the partial only by
 * reintroducing the omitted-key spelling the Consistency Conventions ban.
 *
 * Each channel is a declared triple rather than nullable, because a request
 * channel's "declared, no keys" state already has a spelling — an empty
 * required list, an empty permitted list, and an empty type map — unlike an
 * input-binding channel, where that state is indistinguishable from unused.
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

// AD-19: parameters are spelled `{name}` in braces and nothing else, because
// AD-40 compares templates as literal segments plus parameter positions and two
// implementations must not disagree over whether `/notes/{id}` and `/notes/:id`
// are one template. A colon is excluded from a literal segment so the `:name`
// spelling is a syntax error rather than a literal segment that happens to
// start with a colon.
export const PATH_TEMPLATE_PATTERN = /^(?:\/(?:[^/{}:]|\{[A-Za-z0-9_-]+\})*)+$/

export const PathTemplate = z
	.string()
	.regex(PATH_TEMPLATE_PATTERN)
	.describe(
		'A path template whose parameters are spelled `{name}` in braces. The `:name` spelling is rejected: AD-40 resolves a defect signature by comparing method and path template, and that comparison is not implementable against an unstated syntax.',
	)

export const Operation = z.strictObject({
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
})

/**
 * AD-19's four interface kinds, exported so they are spelled once. The sealed
 * evaluator brief carries interface identity without the operation inventory
 * (AD-16), so it needs this vocabulary and must not mint a second copy of it.
 * Naming the array changes no exported byte: an enum carrying no
 * `.meta({ id })` inlines at each use site exactly as the literal did.
 */
export const INTERFACE_KINDS = ['api', 'web', 'cli', 'mcp'] as const

export const InterfaceKind = z.enum(INTERFACE_KINDS)

export const PermittedInterface = z.strictObject({
	logicalId: Identifier.describe(
		"AD-35: a logical identifier for the interface, never a URL, host, or port. Mapping it to a target is the caller's, outside the contract.",
	),
	kind: InterfaceKind.describe(
		'All four kinds are admitted so `unsupported-interface-kind` stays fireable. v0 supports `api`; the other three fail compilation under that code rather than failing to parse.',
	),
	operations: z
		.array(Operation)
		.describe(
			'No uniqueness constraint: two operations colliding on method plus path template after parameter-name erasure is `duplicate-operation-signature`, a coded compile-time error, and a schema that deduped them would delete it.',
		),
})
