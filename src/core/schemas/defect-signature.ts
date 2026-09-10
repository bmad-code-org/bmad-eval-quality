/** AD-40's machine-readable defect signature and its probe-side selector. */
import { z } from 'zod'
import { Expression } from './expression.ts'
import { CommandInvocation, HttpMethod, PathTemplate } from './interface.ts'
import { LiteralBindingValue, MatcherBindingValue } from './plan.ts'
import { EvidenceChannel } from './pointer.ts'
import { KeyName, ToolName } from './primitives.ts'

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
// it inlined at one address per channel left the rejection Zod-only, and the
// published-schema differential caught the disagreement on a synthesised
// witness carrying `{}` in several of them.
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
			"A parameter-name-to-binding-value map for one input channel of a defect signature's selector, or `null` for a channel the selector binds nothing in. An empty map is rejected: `null` is the only spelling for unbound. Admits `{ literal }` and `{ matcher }` only; `{ captured }` and `{ principal }` are contract-local vocabulary and a corpus signature cannot carry either.",
	})

/**
 * Every input channel the pointer grammar admits, spelled exactly as
 * `ObservedCallInputs` spells them. The two shapes agree on channel names, on
 * the strict form, on width, and on flatness, so the selector filters recorded
 * call inputs with no shape to bridge.
 *
 * One object over all three kinds rather than a union, on
 * `ObservedCallInputs`'s own reasoning: `null` already means "binds nothing
 * here", so a selector that binds only command channels writes `null` in the
 * transport four and nothing is ambiguous. `InputBinding` on the contract side
 * is a union instead, because a request-shape channel's "declared, no keys"
 * state differs from unused and the two spellings had to stay apart.
 */
export const ProbeInputBinding = z
	.strictObject({
		path: ProbeBindingChannel,
		query: ProbeBindingChannel,
		header: ProbeBindingChannel,
		body: ProbeBindingChannel,
		argument: ProbeBindingChannel,
		option: ProbeBindingChannel,
		environment: ProbeBindingChannel,
		stdin: ProbeBindingChannel,
		arguments: ProbeBindingChannel,
	})
	.describe(
		'The probe\'s `schemaVersion` 4 -> 5 BREAKING bump under AD-11, whose rule is that removing or retyping is breaking. Two retypings land under this one stamp and both are named here. This selector gained a ninth channel, `arguments`, so a signature against a tool call can filter on what the call supplied; the sealed run record\'s `ObservedCallInputs` gained the same key under its own breaking bump, since a selector naming a channel no observation records would filter against nothing. And `DefectSignature` gained an `McpDefectSignature` branch declaring a published tool name, while `ApiDefectSignature.interfaceKind` narrowed to `api` and `web`, so a version-4 probe carrying `interfaceKind: "mcp"` beside a method and a path template stops parsing. Version 4 took the witness leg shape and this stamp takes both changes above, so each retype stays independently releasable.',
	)

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
 * Three of AD-40's four declarations, the three every branch shares: the
 * observable channel the defect manifests in, the discriminating condition that
 * separates it from correct behaviour, and the interface kind each branch
 * spells as its own literal or enum. The fourth is the defect's home operation,
 * which each branch declares in its own kind's transport identity.
 *
 * A declared transport identity rather than an operation identifier, because
 * AD-19 declares one per operation and it is contract-independent: an
 * identifier is contract-local and would bind nothing against a second
 * contract. The api-shaped branch erases parameter names before comparing, so a
 * signature on `/notes/{id}` binds a contract declaring `/notes/{noteId}`; a
 * post-erasure collision inside one contract has already failed compilation
 * under `duplicate-operation-signature`.
 */
const signatureCommon = {
	observableChannel: EvidenceChannel.describe(
		'AD-26\'s channel the seeded defect manifests in. The qualification gate reads it: a condition passes only if its pointers name this channel, or name two channels with at least one response-side member. That rule exists to reject a condition collapsing to "the evidence contains the string I sent", which is satisfied by a finding that merely echoes its own input. It must also be a channel the declared kind produces: an api interface writes nothing to standard output and a command returns no HTTP status.',
	),
	condition: DiscriminatingCondition,
}

/**
 * A signature declaring a method and a path template. `web` shares the shape
 * and is still rejected by the qualification gate, which is what keeps
 * `signature-interface-kind-unsupported` fireable on the one kind whose probe
 * semantics stay undeclared.
 *
 * One branch over both kinds rather than two identical branches. Two would
 * publish two byte-identical subschemas, and AD-13's mutation sweep cannot
 * attribute a keyword deletion to one of several identical branches: deleting
 * `pathTemplate`'s pattern from the second still leaves the first accepting
 * everything the corpus carries, so nothing flips. That argument reaches only
 * branches publishing the same keyword shape, which is why the tool-call branch
 * below is its own.
 */
export const ApiDefectSignature = z.strictObject({
	interfaceKind: z.enum(['api', 'web']),
	method: HttpMethod,
	pathTemplate: PathTemplate,
	...signatureCommon,
})

/**
 * A signature against an interface that runs behind a command. It declares the
 * transport identity a command operation declares, for the reason AD-40 gives
 * for method and path template: the identity has to be contract-independent so
 * a signature authored against a corpus binds a second contract's operation.
 * An operation identifier is contract-local and would bind nothing.
 */
export const CommandDefectSignature = z.strictObject({
	interfaceKind: z.literal('cli'),
	invocation: CommandInvocation,
	...signatureCommon,
})

/**
 * A signature against an MCP tool server. It declares the published tool name,
 * for the reason AD-40 gives for the api-shaped pair: the identity has to be
 * contract-independent so a signature authored against a corpus binds a second
 * contract's operation. Every MCP call shares the one transport method
 * `tools/call`, so the tool name is the whole of what tells two calls apart,
 * and `McpOperation.toolName` is the field it resolves against.
 *
 * Its own branch, on the model `CommandDefectSignature` set. A tool call has no
 * method and no path template, so while `mcp` sat on the api-shaped branch a
 * signature declared a pair it could never mean and rendered an identity no
 * operation matched. This branch publishes `toolName`'s pattern where that one
 * publishes `method`'s enum and `pathTemplate`'s pattern, so a keyword deleted
 * from either is attributable to it and a fixture can flip it.
 */
export const McpDefectSignature = z.strictObject({
	interfaceKind: z.literal('mcp'),
	toolName: ToolName,
	...signatureCommon,
})

/**
 * A plain union rather than a discriminated one: the discriminator would have
 * to be `interfaceKind`, and the api-shaped branch carries two values for it.
 * The three branches are told apart by the identity they declare, exactly as
 * `InputBinding`'s two are told apart by the channels they name.
 */
export const DefectSignature = z.union([
	ApiDefectSignature,
	CommandDefectSignature,
	McpDefectSignature,
])

export type ApiDefectSignature = z.infer<typeof ApiDefectSignature>

export type CommandDefectSignature = z.infer<typeof CommandDefectSignature>

export type McpDefectSignature = z.infer<typeof McpDefectSignature>

export type DefectSignature = z.infer<typeof DefectSignature>

export type ProbeInputBinding = z.infer<typeof ProbeInputBinding>
