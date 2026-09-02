/** AD-40's machine-readable defect signature and its probe-side selector. */
import { z } from 'zod'
import { Expression } from './expression.ts'
import { HttpMethod, InterfaceKind, PathTemplate } from './interface.ts'
import { LiteralBindingValue, MatcherBindingValue } from './plan.ts'
import { EvidenceChannel } from './pointer.ts'
import { KeyName } from './primitives.ts'

/**
 * The reserved step identifier every pointer in a discriminating condition is
 * rooted at. AD-40 requires the predicate to be rooted at the selected
 * observation rather than at a step identifier, and the shipped `Expression`
 * addresses evidence only through an interaction-rooted pointer, so the
 * signature spends one fixed word instead of minting a fourth pointer grammar:
 *
 *     /interactions/observed/response-status
 *     /interactions/observed/response-body/error/code
 *
 * A fixed word, so no contract-local choice reaches the corpus, and the gate
 * checks contract-independence instead of asserting it. Evaluation is the
 * shipped path with no adapter: build the resolver map with exactly this one
 * key, and resolve.
 *
 * `observed` is a legal `Identifier` and nothing reserves it, so a contract may
 * declare a step by that name. The design is safe because the resolver map is
 * built fresh with exactly one key and is never merged with a plan's
 * observations. That is a stated invariant of this module;
 * `compile/sensitivity-witness.ts` guards the same collision one level in.
 */
export const OBSERVED_STEP_ID = 'observed'

/**
 * The probe-side binding value: `{ literal }` and `{ matcher }` only.
 *
 * Deliberately its own union rather than a reuse of `BindingValue`, which also
 * admits `{ captured }` and `{ principal }`. A captured pointer names an
 * earlier step of a contract's plan, and a principal names an entry of a
 * contract's `testData`; both are contract-local vocabulary, and a corpus
 * signature that carried either would resolve nothing against a second
 * contract. The rejection is structural, so a probe carrying one fails to parse
 * rather than qualifying and then matching nothing.
 */
export const ProbeBindingValue = z.union([
	LiteralBindingValue,
	MatcherBindingValue,
])

/** the constraint identifier the ledger carries for the check below. */
export const PROBE_BINDING_CHANNEL_NON_EMPTY = 'probe-binding-channel-non-empty'

// Caller-keyed by the author's own parameter names, and `{}` is rejected for
// the same reason the contract-side channel rejects it: a binding channel has
// exactly one spelling for "binds nothing", which is `null`.
//
// Named, like `InputBindingChannel`, so the constraint ledger has one stable
// address to inject `minProperties` at. Verified rather than assumed: leaving
// it inlined at four addresses left the rejection Zod-only, and the
// published-schema differential caught the disagreement on a synthesised
// witness carrying `{}` in three of the four channels.
export const ProbeBindingChannel = z
	.record(KeyName, ProbeBindingValue)
	.refine((entries) => Object.keys(entries).length > 0, {
		error:
			'a signature selector channel names at least one parameter; an unbound channel is null',
	})
	.nullable()
	.meta({
		id: 'ProbeInputBindingChannel',
		description:
			"A parameter-name-to-binding-value map for one transport channel of a defect signature's selector, or `null` for a channel the selector binds nothing in. An empty map is rejected: `null` is the only spelling for unbound. Admits `{ literal }` and `{ matcher }` only; `{ captured }` and `{ principal }` are contract-local vocabulary and a corpus signature cannot carry either.",
	})

/**
 * The four transport channels, spelled exactly as `InputBinding` and
 * `ObservedCallInputs` spell them. The three shapes agree on channel names, on
 * the four-key strict form, and on flatness, so the selector filters recorded
 * call inputs with no shape to bridge.
 */
export const ProbeInputBinding = z.strictObject({
	path: ProbeBindingChannel,
	query: ProbeBindingChannel,
	header: ProbeBindingChannel,
	body: ProbeBindingChannel,
})

/**
 * AD-39's selector grammar, duplicated on the corpus side, minus the two
 * members a corpus cannot fill. The operation is the signature's own home
 * operation and is not repeated here; the temporal clause is dropped because no
 * corpus signature needs it. A state-corruption defect that only fires on a
 * second call is already expressible as a predicate over any single
 * observation, and AD-40's mapping is per probe rather than per call sequence.
 * What would reopen the question is pair-defect signatures across the monotonic
 * observation sequence, a future need `preflight/witness-evidence.ts` already
 * records.
 */
export const ProbeStepSelector = z.strictObject({
	inputBinding: ProbeInputBinding,
})

/**
 * AD-40's discriminating condition: a selector over observations paired with a
 * predicate over the selected observation's response.
 *
 * The predicate is the shipped `Expression` in AD-4's closed operator
 * vocabulary, never a second relation language. A second vocabulary is a second
 * set of degenerate cases to fix, and AD-4's are already fixed and fixtured.
 * Every pointer in the predicate is rooted at `OBSERVED_STEP_ID`; that rule,
 * the response-channel rule, and AD-4's own legality rules are checked at
 * corpus qualification time rather than here, because each of them is a
 * cross-field or cross-artifact rule the published export cannot carry.
 */
export const DiscriminatingCondition = z.strictObject({
	selector: ProbeStepSelector,
	predicate: Expression.describe(
		"An AD-4 expression over AD-26 response channels, every pointer rooted at the reserved step identifier `observed`. Legality is the corpus qualification gate's: an unchecked predicate admits `existence` over a literal, which is true of every observation and makes the catch rate 1.00 by construction.",
	),
})

/**
 * AD-40's four declarations: the interface kind, the defect's home operation as
 * a method and a path template, the observable channel it manifests in, and the
 * discriminating condition that separates it from correct behaviour.
 *
 * Method and path template rather than an operation identifier, because AD-19
 * declares both per operation and both are contract-independent: an identifier
 * is contract-local and would bind nothing against a second contract.
 * Resolution erases parameter names before comparing, so a signature on
 * `/notes/{id}` binds a contract declaring `/notes/{noteId}`; a post-erasure
 * collision inside one contract has already failed compilation under
 * `duplicate-operation-signature`.
 */
export const DefectSignature = z.strictObject({
	interfaceKind: InterfaceKind.describe(
		'The interface the seeded defect lives behind. All four kinds parse so `unsupported-interface-kind` stays fireable contract-side, and the qualification gate rejects every kind but `api`: `Operation` carries no interface kind and requires a method and a path template with no per-kind variation, so a `cli` or `mcp` signature would declare a meaningless `POST /path`.',
	),
	method: HttpMethod,
	pathTemplate: PathTemplate,
	observableChannel: EvidenceChannel.describe(
		'AD-26\'s channel the seeded defect manifests in. The qualification gate reads it: a condition passes only if its pointers name this channel, or name two channels with at least one response-side member. That rule exists to reject a condition collapsing to "the evidence contains the string I sent", which is satisfied by a finding that merely echoes its own input.',
	),
	condition: DiscriminatingCondition,
})

export type DefectSignature = z.infer<typeof DefectSignature>

export type ProbeInputBinding = z.infer<typeof ProbeInputBinding>
