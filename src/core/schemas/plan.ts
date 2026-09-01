/** the interaction plan: steps as selectors over observations. */
import { z } from 'zod'
import { Identifier, JsonValue, KeyName } from './primitives.ts'

/**
 * AD-39: input-binding values are tagged and never share a value space. The
 * untagged spelling let `{ "title": "type-violating" }` mean the matcher to
 * one implementation and the literal string to another, and flipped a witness
 * match between `caught` and `missed` on one record; that form is
 * unrepresentable here.
 */
export const BindingValue = z.union([
	z.strictObject({ literal: JsonValue }),
	z.strictObject({ matcher: z.enum(['any', 'type-violating']) }),
])

/** the constraint identifier the ledger carries for the check below. */
export const BINDING_CHANNEL_NON_EMPTY = 'binding-channel-non-empty'

// Caller-keyed: the keys are the author's own parameter names. `{}` is
// rejected because a binding channel has exactly one spelling for "binds
// nothing" (`null`), unlike a request-shape channel's empty triple, which
// means "declared, no keys." No AD-5 code fires on an empty binding map, so
// the schema is the enforcement point, under the admit-rule's second clause.
const BindingChannelMap = z
	.record(KeyName, BindingValue)
	.refine((entries) => Object.keys(entries).length > 0, {
		error:
			'an input-binding channel names at least one parameter; an unbound channel is null',
	})

// Named so the constraint ledger has one stable address for the non-empty
// check rather than a path through four sibling channels, and so the export
// injects `minProperties` once on the shared definition.
export const BindingChannel = BindingChannelMap.nullable().meta({
	id: 'InputBindingChannel',
	description:
		'A parameter-name-to-binding-value map, or `null` for a channel this step binds nothing in. An empty map is rejected: `null` is the only spelling for unbound. That rejection is a Zod check and does not survive the export, so the constraint ledger carries it for injection on the object branch.',
})

/**
 * A four-key strict object with each channel nullable, not a record over the
 * channel enum. Verified on the pin: a record over a four-member enum key
 * requires every member at parse time and fails five of the Gate C fixture's
 * six steps, all of which bind a subset of the channels.
 */
export const InputBinding = z.strictObject({
	path: BindingChannel,
	query: BindingChannel,
	header: BindingChannel,
	body: BindingChannel,
})

/**
 * AD-39's declared selector cardinality (owed item 2): what a step means when
 * its selector matches more than one observation was not decided at the
 * architecture layer, so a first-match scorer and a last-match scorer could
 * bind different evidence. The contract now declares the rule per step.
 * `several` under `exactly-one`/`at-most-one` is a named ambiguity condition;
 * a reference function returns it as data. Routing that ambiguity to a
 * verdict rung is later work, not this declaration's. `any` is unrelated to
 * `BindingValue`'s `{ matcher: 'any' }` above: same string, different field,
 * no type-level collision. `ExpectedCardinality` (`interface.ts`) is a
 * second, unrelated reuse of the word for AD-20's response-collection
 * cardinality, and its `at-most` mode is a near-miss for `at-most-one` here;
 * different type, different field, no collision, but easy to misread as the
 * same declaration.
 */
export const SELECTOR_CARDINALITIES = [
	'exactly-one',
	'at-most-one',
	'any',
] as const

export type SelectorCardinalityValue = (typeof SELECTOR_CARDINALITIES)[number]

export const SelectorCardinality = z.enum(SELECTOR_CARDINALITIES)

/**
 * AD-39: a step is a selector over observations the evaluator produced, never
 * an instruction. Its selection predicate is spelled as its two members, the
 * input binding and the temporal clause, directly on the step itself,
 * matching the only hand-authored contract rather than nesting them under a
 * further key.
 */
export const InteractionStep = z.strictObject({
	stepId: Identifier,
	operationId: Identifier,
	inputBinding: InputBinding,
	after: Identifier.nullable().describe(
		"The temporal clause: the identifier of an earlier step, or `null`. That the named step carries no clause of its own is AD-39's one-level bound, which fires `nested-temporal-clause` at compile time and is deliberately not enforced here, so the code keeps a shape to fire on.",
	),
	cardinality: SelectorCardinality.describe(
		"AD-39's declared selector cardinality (owed item 2): `exactly-one` or `at-most-one` when the step expects a single matching observation, `any` when several are legitimate. Several matches under `exactly-one`/`at-most-one` is the named ambiguity condition; a reference selection function returns it as data. Required rather than optional, which makes this a BREAKING `schemaVersion` bump under AD-11: adding an optional field is additive, and this field is not optional.",
	),
})

export type InteractionStep = z.infer<typeof InteractionStep>
