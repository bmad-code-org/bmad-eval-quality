/** AD-10's typed witnesses and the fixture-reset declaration. */
import { z } from 'zod'
import { Expression } from './expression.ts'
import { Identifier, JsonObjectValue, KeyName } from './primitives.ts'
import { ProbeRequestBody, ProbeRequestStdin } from './probe-body.ts'

/**
 * The four transport channels one probe leg supplies, as values. `RequestShape`
 * declares what an operation accepts; this declares what one leg sends. AD-18
 * applies here too, so a header value carries no credential.
 *
 * `header` and `body` use the port's own spelling: a header value is a string
 * at the boundary, and a body has to tell an absent body from a JSON null. A
 * leg the plan could not map onto a `ProbeRequest` would declare work nothing
 * runs.
 */
export const ApiWitnessInputs = z
	.strictObject({
		path: JsonObjectValue,
		query: JsonObjectValue,
		header: z.record(KeyName, z.string()),
		body: ProbeRequestBody,
	})
	.meta({
		id: 'WitnessInputs',
		description:
			"One probe leg's supplied inputs, keyed by AD-19 transport channel, in the spelling the environment-probe port accepts. The transport branch of the union every leg shape takes: a sensitivity leg, a manifestation witness, and the fixture reset.",
	})

export type ApiWitnessInputs = z.infer<typeof ApiWitnessInputs>

/**
 * The same, for a leg supplied to a command-kind operation. `stdin` is a
 * tagged value rather than a key map for exactly the reason `body` is: one leg
 * supplies a value and has to tell an absent standard input from one carrying
 * JSON null, which a key map cannot express. The request shape's `stdin` stays
 * a key map, because a declaration says which keys an operation accepts.
 * `suppliedKeys` is the code that bridges the two spellings and it
 * special-cases `stdin` alongside `body`.
 *
 * AD-18 applies to `environment` the way it applies to `header`, so an
 * environment value carries no credential.
 */
// Bare, with no `.meta({ id })`, and the reason is a published-schema one
// rather than a size one. A `$ref`'d definition's own errors reach ajv with a
// schema path relative to that definition, so two definitions under one
// `anyOf` report `#/required` and `#/additionalProperties` at the same
// instance path and nothing tells them apart. AD-13's mutation sweep needs one
// keyword deletion to be attributable to one occurrence, and the branch is
// attributable only while it is spelled in place.
export const CommandWitnessInputs = z.strictObject({
	argument: JsonObjectValue,
	option: JsonObjectValue,
	environment: z.record(KeyName, z.string()),
	stdin: ProbeRequestStdin,
})

export type CommandWitnessInputs = z.infer<typeof CommandWitnessInputs>

/**
 * The same, for a leg supplied to a tool call. One key, because a tool call
 * carries an arguments object and nothing else, and a JSON object rather than a
 * tagged value because an argument-less call supplies `{}` and has no absent
 * spelling to tell apart from a JSON null.
 */
// Bare, with no `.meta({ id })`, on the reason the command branch above records:
// two `$ref`'d definitions under one `anyOf` report `#/required` at the same
// instance path and AD-13's mutation sweep cannot attribute the deletion.
export const McpWitnessInputs = z.strictObject({
	arguments: JsonObjectValue,
})

export type McpWitnessInputs = z.infer<typeof McpWitnessInputs>

/**
 * Any spelling. A plain union rather than a discriminated one for the same
 * reason `InputBinding` is: the leg names an operation and the kind of the
 * interface declaring it lives in another subtree, so no discriminator is
 * available to the schema and the agreement is a compile-time check.
 *
 * All three leg shapes take it: `SensitivityWitnessLeg.inputs`,
 * `ManifestationWitness.inputs`, and `FixtureReset.inputs`. The sensitivity leg
 * took it from 0.3.0 and the other two followed in 1.3.0, since the transport
 * spelling left a seeded defect against a command-line system under test
 * unrepresentable. The reach is the port's: all three legs are issued through
 * the environment-probe port, whose `ProbeRequest` carries one member per kind
 * `isSupportedInterfaceKind` admits, and `preflight/plan.ts` gates on that same
 * predicate. The invariant is the count rather than the list: a leg shape
 * narrower than the port it feeds leaves a kind the adapter can run with no way
 * to declare a leg for it, so this union takes one member per port member and
 * opening a kind adds one to each.
 */
export const WitnessInputs = z.union([
	ApiWitnessInputs,
	CommandWitnessInputs,
	McpWitnessInputs,
])

export type WitnessInputs = z.infer<typeof WitnessInputs>

/**
 * Half a witness pair. `legId` roots the relation's pointers, which address this
 * leg's response as `/interactions/{legId}/response-body/...`, so it shares one
 * namespace with interaction-plan step ids.
 */
export const SensitivityWitnessLeg = z.strictObject({
	legId: Identifier,
	inputs: WitnessInputs,
})

export type SensitivityWitnessLeg = z.infer<typeof SensitivityWitnessLeg>

// AD-10 selects the differential channel by the operation's state-change
// marker: `path` or `query` where the marker is false, `body` where it is true.
// `header` is absent on purpose; no AD names a header differential.
export const API_WITNESS_CHANNELS = ['path', 'query', 'body'] as const

// A command operation's differential channel. All four are admitted rather
// than two: AD-10's marker rule selects `path` or `query` against `body`
// because an HTTP read carries its identifier in the URL and a write carries
// it in the body, and a command carries its inputs the same way whether or not
// it changes state, so the marker decides nothing here. Which channel a given
// command witness may use is the contract author's choice.
export const COMMAND_WITNESS_CHANNELS = [
	'argument',
	'option',
	'environment',
	'stdin',
] as const

// A tool call's one channel. AD-10's marker rule decides nothing here for the
// reason it decides nothing for a command: a tool call carries its inputs the
// same way whether or not it changes state. With one channel there is nothing
// left for the rule to select, so both marker values admit it.
export const MCP_WITNESS_CHANNELS = ['arguments'] as const

export const WITNESS_CHANNELS = [
	...API_WITNESS_CHANNELS,
	...COMMAND_WITNESS_CHANNELS,
	...MCP_WITNESS_CHANNELS,
] as const

export const WitnessChannel = z.enum(WITNESS_CHANNELS)

export type WitnessChannel = z.infer<typeof WitnessChannel>

/**
 * AD-10's typed sensitivity witness: a pair of inputs and the AD-4 relation
 * their responses must satisfy. Per operation, because an interface-scoped
 * check let an identifier-blind read pass on a body-sensitive sibling, and
 * cannot be performed at all on a read-only interface.
 *
 * The relation is declared because inequality decides nothing on its own: two
 * distinct nonexistent identifiers both return the same 404, and an input-blind
 * response carrying a request identifier differs every time.
 *
 * `legs` is a length-pinned array. `z.tuple` exports `prefixItems` with no
 * length keyword, so `.length(2)` is what puts `minItems` and `maxItems` in the
 * published schema.
 */
export const SensitivityWitness = z.strictObject({
	witnessId: Identifier,
	channel: WitnessChannel,
	legs: z.array(SensitivityWitnessLeg).length(2),
	relation: Expression,
})

export type SensitivityWitness = z.infer<typeof SensitivityWitness>

/**
 * AD-10's manifestation witness: which operation to probe, with what inputs, and
 * the AD-4 relation that is true exactly when the seeded fault has fired.
 *
 * A different mechanism from AD-40's DEFECT SIGNATURE, which matches a
 * scoring-side finding against an observation. This one never enters a score; it
 * makes "every declared seeded fault observed to fire" decidable at pre-flight.
 *
 * `inputs` is the same union a sensitivity leg takes. It was `ApiWitnessInputs`
 * alone, which made a seeded defect against a command-line system under test
 * unrepresentable in both directions: command channels failed the `Probe`
 * parse, and transport channels reached `requestOf` and threw
 * `undeclared-mandatory-input` for supplying transport channels to an operation
 * that runs behind a command. A `null` witness parses, so the only way through
 * was to declare the defect unobservable, which pre-flight records as a failed
 * `seeded-fault-fired` check. Every `defect` and `zero-action` probe against a
 * command was therefore unscoreable. 0.3.0 widened the contract side and left
 * this one and `FixtureReset` behind.
 */
export const ManifestationWitness = z.strictObject({
	legId: Identifier,
	interfaceId: Identifier,
	operationId: Identifier,
	inputs: WitnessInputs.describe(
		"The probe's `schemaVersion` 3 -> 4 BREAKING bump under AD-11, whose rule is that removing or retyping is breaking. The union gained a third leg shape, one key over a tool call's arguments, so a witness leg against a tool call is expressible. The matching defect signature is a separate shape and version 5 is where it landed, so a version-4 probe declares a witness leg against a tool call and no signature for the defect that leg exercises. Against version 4 every version-3 probe's own bytes still parse, since the widening adds a branch and narrows none; version 5 narrows two shapes and is where a version-3 or version-4 probe stops parsing.",
	),
	relation: Expression,
})

export type ManifestationWitness = z.infer<typeof ManifestationWitness>

/**
 * The operation that returns the fixture to its clean state. AD-10 verifies the
 * per-run reset differentially, and the reset is an ordinary declared operation,
 * so it goes through the same port as every other leg.
 */
export const FixtureReset = z.strictObject({
	legId: Identifier,
	interfaceId: Identifier,
	operationId: Identifier,
	inputs: WitnessInputs,
})

export type FixtureReset = z.infer<typeof FixtureReset>
