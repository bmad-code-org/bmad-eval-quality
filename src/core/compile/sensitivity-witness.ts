/**
 * AD-10's three declaration-side witness checks: that every input-bearing
 * operation declares one, that a declared one is shaped so the plan can
 * execute it, and that its leg identifiers are distinct from each other and
 * from every interaction-plan step.
 *
 * No new AD-5 code is minted. The registry is closed at twenty-one and
 * `check:ad5-registry` pins it against the spine, so each defect below takes the
 * code that already names it. Two rows stretch that reading: a leg-id equality
 * and a leg-id/step-id collision are identifier collisions, and
 * `malformed-operator-expression` is the closest available code because the
 * relation is illegal in its position once its operands cannot be told apart.
 */
import { declaresNoRequestKeys } from '../declared-inputs.ts'
import { StructuralFailure } from '../failure-codes.ts'
import type { EvalContract } from '../schemas/eval-contract.ts'
import type { Expression } from '../schemas/expression.ts'
import type { Operation } from '../schemas/interface.ts'
import {
	TRANSPORT_CHANNELS,
	type TransportChannelName,
} from '../schemas/pointer.ts'
import type {
	SensitivityWitness,
	WitnessChannel,
	WitnessInputs,
} from '../schemas/sensitivity-witness.ts'
import { parseEvidenceTarget } from '../seal/plan-index.ts'

export { declaresNoRequestKeys }

/**
 * The keys one set of witness inputs supplies on one channel. A body that is
 * absent, or JSON that is not an object, supplies no keys: the channel is
 * declared as a keyed shape, so such a leg omits every required key rather
 * than being exempt from the comparison.
 */
export function suppliedKeys(
	inputs: WitnessInputs,
	channel: TransportChannelName,
): readonly string[] {
	if (channel !== 'body') return Object.keys(inputs[channel])
	const { body } = inputs
	if (body.kind !== 'json') return []
	const { value } = body
	if (value === null || typeof value !== 'object' || Array.isArray(value))
		return []
	return Object.keys(value)
}

/**
 * Every channel of one set of witness inputs against the operation that will
 * receive them. All four, not only the differential channel: `planPreflight`
 * copies all four onto the `ProbeRequest` and the port sends them, so a value
 * on an unselected channel is as much an outbound value as one on the selected
 * channel.
 *
 * The two directions have different standing, and the difference matters
 * enough to name, because the next reader will diff this against
 * `checkUndeclaredMandatoryInput` and find the two disagreeing.
 *
 * The permitted direction is that function's rule, carried over: it loops the
 * same four channels and rejects a key the operation declares in neither list.
 * That is what makes `WitnessInputs`'s AD-18 promise about `header` more than a
 * comment.
 *
 * The required direction is new here, because the two shapes differ. An
 * `InputBindingChannel` is nullable, and `null` means "this step binds nothing in
 * this channel", so `checkUndeclaredMandatoryInput` skips an unbound channel and
 * asks nothing about required keys. `WitnessInputs` has all four channels as
 * concrete values, so a leg omitting a required key is a request the port cannot
 * issue. The cost is that a required header forces a literal value into the
 * contract artifact, the surface AD-18 governs; a placeholder satisfies this
 * check, and what pre-flight probes is a fixture.
 */
export function checkInputsAgainstShape(
	inputs: WitnessInputs,
	operation: Operation,
	owner: string,
	artifactPath: string,
): void {
	for (const channel of TRANSPORT_CHANNELS) {
		const shape = operation.requestShape[channel]
		const supplied = suppliedKeys(inputs, channel)
		for (const key of shape.requiredKeys) {
			if (supplied.includes(key)) continue
			throw new StructuralFailure(
				'undeclared-mandatory-input',
				artifactPath,
				`${owner} omits "${key}", which operation "${operation.operationId}" declares required in its ${channel} channel (AD-10)`,
			)
		}
		const permitted = new Set([...shape.requiredKeys, ...shape.permittedKeys])
		for (const key of supplied) {
			if (permitted.has(key)) continue
			throw new StructuralFailure(
				'undeclared-mandatory-input',
				artifactPath,
				`${owner} supplies "${key}", which operation "${operation.operationId}" declares in neither requiredKeys nor permittedKeys of its ${channel} channel (AD-10, AD-18)`,
			)
		}
	}
}

const operationPath = (
	interfaceIndex: number,
	operationIndex: number,
): string =>
	`EvalContract.permittedInterfaces[${interfaceIndex}].operations[${operationIndex}]`

type WitnessVisit = (
	witness: SensitivityWitness,
	operation: Operation,
	path: string,
) => void

function forEachWitness(contract: EvalContract, visit: WitnessVisit): void {
	contract.permittedInterfaces.forEach((iface, interfaceIndex) => {
		iface.operations.forEach((operation, operationIndex) => {
			const witness = operation.sensitivityWitness
			if (witness === null) return
			visit(witness, operation, operationPath(interfaceIndex, operationIndex))
		})
	})
}

/**
 * Strict-gated, alongside `checkUndeclaredMandatoryInput`, whose code this
 * shares: `compile.ts` already gates that code behind `options.strict`, and one
 * code with two gating regimes would be worse than one code with two
 * conditions.
 */
export function checkSensitivityWitnessDeclared(contract: EvalContract): void {
	contract.permittedInterfaces.forEach((iface, interfaceIndex) => {
		iface.operations.forEach((operation, operationIndex) => {
			const path = operationPath(interfaceIndex, operationIndex)
			const witness = operation.sensitivityWitness
			if (witness === null) {
				if (declaresNoRequestKeys(operation)) return
				throw new StructuralFailure(
					'undeclared-mandatory-input',
					path,
					`operation "${operation.operationId}" declares request keys but no sensitivity witness; only an operation declaring no keys in any channel is exempt (AD-10)`,
				)
			}
			witness.legs.forEach((leg, legIndex) => {
				checkInputsAgainstShape(
					leg.inputs,
					operation,
					`leg "${leg.legId}"`,
					`${path}.sensitivityWitness.legs[${legIndex}]`,
				)
			})
		})
	})
}

/** every interaction-rooted step id an expression addresses, in walk order. */
function addressedStepIds(expression: Expression): Set<string> {
	const found = new Set<string>()
	const visitOperand = (operand: {
		pointer?: string
		literal?: unknown
		referenceSet?: string
	}): void => {
		const { pointer } = operand
		if (pointer === undefined || pointer.startsWith('@')) return
		found.add(parseEvidenceTarget(pointer).stepId)
	}
	const walk = (node: Expression): void => {
		switch (node.op) {
			case 'not':
			case 'all':
			case 'any':
				node.operands.forEach(walk)
				return
			case 'for-all':
			case 'for-any':
				visitOperand(node.collection)
				walk(node.predicate)
				return
			default:
				for (const operand of node.operands) visitOperand(operand)
		}
	}
	walk(expression)
	return found
}

/** the channel AD-10 selects for an operation, by its state-change marker. */
const legalChannels = (operation: Operation): readonly WitnessChannel[] =>
	operation.stateChangeMarker ? ['body'] : ['path', 'query']

/**
 * The shape rules: the differential channel agrees with the state-change
 * marker, the relation reads both legs and nothing else, and a declared
 * fixture reset names a mutating operation the contract declares. Unconditional,
 * since none of these fires `undeclared-mandatory-input`.
 */
export function checkWitnessLegality(contract: EvalContract): void {
	forEachWitness(contract, (witness, operation, path) => {
		const legal = legalChannels(operation)
		if (!legal.includes(witness.channel)) {
			throw new StructuralFailure(
				'malformed-operator-expression',
				`${path}.sensitivityWitness`,
				`channel "${witness.channel}" contradicts stateChangeMarker ${operation.stateChangeMarker} on operation "${operation.operationId}"; AD-10 selects ${legal.map((name) => `"${name}"`).join(' or ')}`,
			)
		}
		// AD-10's predicate is a differential. Two legs supplying the same values on
		// the selected channel establish nothing, and at run time that surfaces as a
		// `failed` check pointing at the fixture, when the defect is in the
		// declaration.
		const [first, second] = witness.legs
		if (
			first !== undefined &&
			second !== undefined &&
			JSON.stringify(first.inputs[witness.channel]) ===
				JSON.stringify(second.inputs[witness.channel])
		) {
			throw new StructuralFailure(
				'malformed-operator-expression',
				`${path}.sensitivityWitness.legs`,
				`both legs of witness "${witness.witnessId}" supply the same ${witness.channel} value, so the pair is not a differential (AD-10)`,
			)
		}
		const legIds = witness.legs.map((leg) => leg.legId)
		const addressed = addressedStepIds(witness.relation)
		// Reported before the coverage rules: an unknown root is the more
		// specific diagnosis, and a relation that reads a third step is
		// unreachable evidence whether or not it also reads both legs.
		for (const stepId of addressed) {
			if (legIds.includes(stepId)) continue
			throw new StructuralFailure(
				'unreachable-check-evidence',
				`${path}.sensitivityWitness.relation`,
				`the relation addresses "${stepId}", which is neither leg of witness "${witness.witnessId}" (AD-10)`,
			)
		}
		const covered = legIds.filter((legId) => addressed.has(legId))
		if (covered.length !== legIds.length) {
			throw new StructuralFailure(
				'malformed-operator-expression',
				`${path}.sensitivityWitness.relation`,
				`the relation addresses ${covered.length} of the two legs of witness "${witness.witnessId}"; a differential that reads one leg establishes no sensitivity (AD-10)`,
			)
		}
	})
	const reset = contract.fixtureReset
	if (reset === null) return
	const iface = contract.permittedInterfaces.find(
		(candidate) => candidate.logicalId === reset.interfaceId,
	)
	const operation = iface?.operations.find(
		(candidate) => candidate.operationId === reset.operationId,
	)
	if (operation === undefined) {
		throw new StructuralFailure(
			'unreachable-check-evidence',
			'EvalContract.fixtureReset',
			`the fixture reset names operation "${reset.operationId}" on interface "${reset.interfaceId}", which the contract does not declare (AD-10)`,
		)
	}
	if (!operation.stateChangeMarker) {
		throw new StructuralFailure(
			'malformed-operator-expression',
			'EvalContract.fixtureReset',
			`the fixture reset names operation "${reset.operationId}", whose stateChangeMarker is false; an operation that changes no state resets nothing (AD-10)`,
		)
	}
	// The reset is one more leg through the same port, so its inputs answer to
	// the same request shape every witness leg does.
	checkInputsAgainstShape(
		reset.inputs,
		operation,
		'the fixture reset',
		'EvalContract.fixtureReset.inputs',
	)
}

/**
 * Leg identifiers share one namespace with interaction-plan step identifiers,
 * because a witness relation is an ordinary AD-4 expression and addresses a leg
 * as `/interactions/{legId}/…`. A collision would make a relation pointer
 * resolve against the wrong observation.
 */
export function checkWitnessLegIdentifiers(contract: EvalContract): void {
	const stepIds = new Set(contract.interactionPlan.map((step) => step.stepId))
	const seen = new Map<string, string>()
	const claim = (legId: string, owner: string, path: string): void => {
		if (stepIds.has(legId)) {
			throw new StructuralFailure(
				'malformed-operator-expression',
				path,
				`leg id "${legId}" collides with an interaction-plan step id; the two share one pointer namespace (AD-10, AD-26)`,
			)
		}
		const previous = seen.get(legId)
		if (previous !== undefined) {
			throw new StructuralFailure(
				'malformed-operator-expression',
				path,
				`leg id "${legId}" is already claimed by ${previous}; leg ids are unique across the contract (AD-10)`,
			)
		}
		seen.set(legId, owner)
	}
	forEachWitness(contract, (witness, _operation, path) => {
		const [first, second] = witness.legs
		if (
			first !== undefined &&
			second !== undefined &&
			first.legId === second.legId
		) {
			throw new StructuralFailure(
				'malformed-operator-expression',
				`${path}.sensitivityWitness.legs`,
				`both legs of witness "${witness.witnessId}" carry the leg id "${first.legId}", so the relation cannot tell them apart (AD-10)`,
			)
		}
		witness.legs.forEach((leg, legIndex) => {
			claim(
				leg.legId,
				`witness "${witness.witnessId}"`,
				`${path}.sensitivityWitness.legs[${legIndex}].legId`,
			)
		})
	})
	// The fixture reset is one more leg through the same port, so its id sits in
	// the same namespace. AD-10 names no defect for the collision; the check is
	// added here because two legs sharing a `probeId` would make the reducer read
	// one leg's observation for the other.
	const reset = contract.fixtureReset
	if (reset !== null)
		claim(reset.legId, 'the fixture reset', 'EvalContract.fixtureReset.legId')
}
