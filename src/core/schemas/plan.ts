/** the interaction plan: steps as selectors over observations. */
import { z } from 'zod'
import { Identifier, JsonValue, KeyName } from './primitives.ts'

/**
 * AD-39: input-binding values are tagged and never share a value space. The
 * untagged spelling made `{ "title": "type-violating" }` mean the matcher to
 * one implementation and the string to another, gave the literal string
 * `type-violating` no spelling at all, and flipped a witness match between
 * `caught` and `missed` on one record. The schema is where the untagged form
 * dies: it is unrepresentable.
 */
export const BindingValue = z.union([
	z.strictObject({ literal: JsonValue }),
	z.strictObject({ matcher: z.enum(['any', 'type-violating']) }),
])

/** the constraint identifier the ledger carries for the check below. */
export const BINDING_CHANNEL_NON_EMPTY = 'binding-channel-non-empty'

// Caller-keyed: the keys are the author's own parameter names. `{}` is rejected
// because a binding channel has one spelling for "this channel binds nothing"
// and it is `null` — unlike a request-shape channel, where an empty triple
// genuinely means "declared, no keys". No AD-5 code fires on an empty binding
// map, so under the admit-rule's second clause the schema is the enforcement
// point. The check is not natively expressible in Zod and is dropped from the
// export, so it is carried in the constraint ledger for injection as
// `minProperties: 1`.
const BindingChannelMap = z
	.record(KeyName, BindingValue)
	.refine((entries) => Object.keys(entries).length > 0, {
		error:
			'an input-binding channel names at least one parameter; an unbound channel is null',
	})

// Named so the constraint ledger has one stable address for the non-empty
// check rather than a path through four sibling channels, and so Story 1.5
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
 * AD-39: a step is a selector over observations the evaluator produced, never
 * an instruction. Its selection predicate is spelled as its two members on the
 * step itself — the input binding and the temporal clause — matching the only
 * hand-authored contract rather than nesting them under a further key.
 */
export const InteractionStep = z.strictObject({
	stepId: Identifier,
	operationId: Identifier,
	inputBinding: InputBinding,
	after: Identifier.nullable().describe(
		"The temporal clause: the identifier of an earlier step, or `null`. That the named step carries no clause of its own is AD-39's one-level bound, which fires `nested-temporal-clause` at compile time and is deliberately not enforced here — a named deviation from the epic's acceptance criteria of record, taken so the code keeps a shape to fire on.",
	),
})
