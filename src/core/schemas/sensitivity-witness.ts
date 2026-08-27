/** AD-10's typed witnesses and the fixture-reset declaration. */
import { z } from 'zod'
import { Expression } from './expression.ts'
import { Identifier, JsonObjectValue, KeyName } from './primitives.ts'
import { ProbeRequestBody } from './probe-body.ts'

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
export const WitnessInputs = z
	.strictObject({
		path: JsonObjectValue,
		query: JsonObjectValue,
		header: z.record(KeyName, z.string()),
		body: ProbeRequestBody,
	})
	.meta({
		id: 'WitnessInputs',
		description:
			"One probe leg's supplied inputs, keyed by AD-19 transport channel, in the spelling the environment-probe port accepts. Shared by both witness kinds and by the fixture reset, so the export carries it once.",
	})

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
export const WITNESS_CHANNELS = ['path', 'query', 'body'] as const

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
 */
export const ManifestationWitness = z.strictObject({
	legId: Identifier,
	interfaceId: Identifier,
	operationId: Identifier,
	inputs: WitnessInputs,
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
