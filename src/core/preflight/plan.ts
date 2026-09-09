/**
 * AD-34's planning half for AD-10's pre-flight: the contract and its probes in,
 * a description of every request the environment-probe port must issue out.
 * Pure and synchronous; nothing here awaits, reads a clock, or observes.
 *
 * The plan carries everything the reducer reads, because `ReduceStage` takes a
 * plan and observations and nothing else. That is why a `PlannedCheck` embeds
 * the operation and the witness themselves: there is nothing to look an
 * identifier up in at reduce time.
 */
import { serialize } from '../canonical/canonicalize.ts'
import {
	checkInputsAgainstShape,
	isApiWitnessInputs,
} from '../compile/sensitivity-witness.ts'
import {
	declaresNoRequiredKeys,
	isCommandOperation,
} from '../declared-inputs.ts'
import { referenceSetKeysOf } from '../evaluate/evidence-resolution.ts'
import type { ReferenceSetKeys } from '../evaluate/resolution.ts'
import { StructuralFailure } from '../failure-codes.ts'
import type { EvalContract } from '../schemas/eval-contract.ts'
import type { AnyOperation, PermittedInterface } from '../schemas/interface.ts'
import { operationsOf } from '../schemas/interface.ts'
import type { ProbeRequest } from '../schemas/port-messages.ts'
import type { JsonValue } from '../schemas/primitives.ts'
import type { Probe } from '../schemas/probe.ts'
import type {
	ApiWitnessInputs,
	ManifestationWitness,
	SensitivityWitness,
	WitnessInputs,
} from '../schemas/sensitivity-witness.ts'
import type { PlanStage } from '../stage-contracts.ts'
import { referenceSetMembers } from './witness-evidence.ts'

export type PreflightPlanInput = {
	readonly contract: EvalContract
	readonly probes: readonly Probe[]
	readonly runId: string
}

export type PlannedLegPurpose =
	| 'sensitivity'
	| 'control-observe'
	| 'control-mutate'
	| 'control-reset'
	| 'seeded-fault'

export type PlannedLeg = {
	readonly legId: string
	readonly purpose: PlannedLegPurpose
	readonly request: ProbeRequest
	readonly operation: AnyOperation
	readonly inputs: WitnessInputs
}

export type PlannedCheck =
	| {
			readonly kind: 'interface-present'
			readonly interfaceId: string
			readonly operationId: string
			readonly legIds: readonly string[]
	  }
	| {
			readonly kind: 'input-sensitivity'
			readonly interfaceId: string
			readonly operationId: string
			readonly witness: SensitivityWitness | null
			readonly operation: AnyOperation
	  }
	| { readonly kind: 'state-reset'; readonly legIds: readonly [string, string] }
	| { readonly kind: 'clean-control'; readonly legIds: readonly string[] }
	| {
			readonly kind: 'seeded-faults-scoped'
			readonly defectId: string
			readonly witness: ManifestationWitness
			readonly operation: AnyOperation
			readonly cleanLegIds: readonly string[]
	  }
	| {
			readonly kind: 'seeded-fault-fired'
			readonly defectId: string
			readonly witness: ManifestationWitness | null
			readonly operation: AnyOperation | null
	  }

export type PreflightPlan = {
	readonly runId: string
	readonly legs: readonly PlannedLeg[]
	readonly checks: readonly PlannedCheck[]
	readonly referenceSets: Readonly<Record<string, JsonValue[]>>
	// Beside the members, because `set-membership`'s set position reads the
	// single declared key off each member and the members map alone has
	// already discarded the keys.
	readonly referenceSetKeys: ReferenceSetKeys
}

const requestOf = (
	legId: string,
	interfaceId: string,
	operation: AnyOperation,
	inputs: WitnessInputs,
): ProbeRequest => {
	// NFR9's correlation by identifier: the port echoes these back, and they
	// are the only thing that tells two legs of one operation apart.
	const correlation = {
		probeId: legId,
		interfaceId,
		operationId: operation.operationId,
	}
	if (isCommandOperation(operation)) {
		if (isApiWitnessInputs(inputs)) {
			throw new StructuralFailure(
				'undeclared-mandatory-input',
				`EvalContract.permittedInterfaces[logicalId=${interfaceId}].operations[operationId=${operation.operationId}]`,
				`leg "${legId}" supplies transport channels to an operation that runs behind a command (AD-10, AD-19)`,
			)
		}
		return {
			...correlation,
			kind: 'cli',
			executable: operation.invocation.executable,
			subcommandPath: operation.invocation.subcommandPath,
			channels: {
				argument: inputs.argument,
				option: inputs.option,
				environment: inputs.environment,
				stdin: inputs.stdin,
			},
		}
	}
	if (!isApiWitnessInputs(inputs)) {
		throw new StructuralFailure(
			'undeclared-mandatory-input',
			`EvalContract.permittedInterfaces[logicalId=${interfaceId}].operations[operationId=${operation.operationId}]`,
			`leg "${legId}" supplies command channels to an operation that speaks HTTP (AD-10, AD-19)`,
		)
	}
	return {
		...correlation,
		kind: 'api',
		method: operation.method,
		pathTemplate: operation.pathTemplate,
		channels: {
			path: inputs.path,
			query: inputs.query,
			header: inputs.header,
			body: inputs.body,
		},
	}
}

/**
 * A leg's request in the RFC 8785 form, with the correlation identifier
 * neutralised because it is the leg id and differs between any two legs.
 *
 * Two legs whose signatures match ask the environment the same question, so the
 * environment answers them the same way. Taken over the whole request, so a
 * field added to `ProbeRequest` later is compared with no edit here. Canonical,
 * because key order is a serialisation detail: two spellings of one request are
 * one request.
 */
const requestSignature = (
	request: ProbeRequest,
	artifactPath: string,
): string => serialize({ ...request, probeId: '' }, artifactPath)

/** where a leg came from, so a duplicate identifier names its own source. */
type LegOrigin = { readonly leg: PlannedLeg; readonly artifactPath: string }

/**
 * The contract declares no identifier for a control leg, so one is minted, and it
 * has to avoid every identifier the contract already spends. The same input
 * always produces the same suffix, which is what fixture 104 asserts.
 */
const mintLegId = (base: string, taken: ReadonlySet<string>): string => {
	if (!taken.has(base)) return base
	for (let ordinal = 2; ; ordinal++) {
		const candidate = `${base}-${ordinal}`
		if (!taken.has(candidate)) return candidate
	}
}

/**
 * Every identifier a minted control leg has to avoid. The probes' manifestation
 * witnesses are in the set even though they are not part of the contract: a
 * minted id colliding with one is a collision the minting caused, and the
 * duplicate scan below would report it against the probe's leg instead.
 */
const declaredLegIds = (
	contract: EvalContract,
	probes: readonly Probe[],
): Set<string> => {
	const taken = new Set<string>(
		contract.interactionPlan.map((step) => step.stepId),
	)
	for (const probe of probes)
		if (!probe.expectedClean)
			for (const defect of probe.defects) {
				const legId = defect.manifestationWitness?.legId
				if (legId !== undefined) taken.add(legId)
			}
	for (const iface of contract.permittedInterfaces)
		for (const operation of operationsOf(iface))
			for (const leg of operation.sensitivityWitness?.legs ?? [])
				taken.add(leg.legId)
	if (contract.fixtureReset !== null) taken.add(contract.fixtureReset.legId)
	return taken
}

type ControlTarget = {
	readonly iface: PermittedInterface
	readonly operation: AnyOperation
	readonly inputs: WitnessInputs
}

type ControlSelection = {
	readonly observed: ControlTarget
	readonly mutating: ControlTarget | null
}

const EMPTY_COMMAND_INPUTS: WitnessInputs = {
	argument: {},
	option: {},
	environment: {},
	stdin: { kind: 'absent' },
}

const EMPTY_INPUTS: ApiWitnessInputs = {
	path: {},
	query: {},
	header: {},
	body: { kind: 'absent' },
}

/**
 * The inputs a control leg sends. A witness supplies them when the operation has
 * one; an operation AD-10 exempts has no required key to fill, so empty inputs
 * are a legal request. Returns `null` only when required keys exist that nothing
 * here can supply.
 *
 * Reading a witness alone left the immutability branch unreachable for the
 * contract that most needs it: a read-only contract whose only safe read is a
 * parameterless GET is exempt, so it carried no witness, so no control leg was
 * planned and the verdict passed with no immutability evidence at all.
 */
const controlInputs = (operation: AnyOperation): WitnessInputs | null => {
	const declared = operation.sensitivityWitness?.legs[0]?.inputs
	if (declared !== undefined) return declared
	// AD-10 exempts an operation with no required key, so an empty leg is a
	// legal request for it. Which empty leg depends on the kind, because the
	// port sends what the operation's own channels name.
	if (!declaresNoRequiredKeys(operation)) return null
	return isCommandOperation(operation) ? EMPTY_COMMAND_INPUTS : EMPTY_INPUTS
}

const targetOf = (
	iface: PermittedInterface,
	operation: AnyOperation,
): ControlTarget | null => {
	const inputs = controlInputs(operation)
	return inputs === null ? null : { iface, operation, inputs }
}

/**
 * AD-10 rule 3's selection, by declaration order so a fixture catches a later
 * change to the rule. The observed operation is the first safe read anywhere in
 * the contract that can be given inputs; the mutating one is the first
 * marker-true operation on the interface the fixture reset names, resolved
 * independently of where the observed read came from.
 */
const selectControl = (
	contract: EvalContract,
	permittedInterfaces: readonly PermittedInterface[],
): ControlSelection | null => {
	let observed: ControlTarget | null = null
	for (const iface of permittedInterfaces) {
		for (const operation of operationsOf(iface)) {
			if (operation.stateChangeMarker) continue
			observed = targetOf(iface, operation)
			if (observed !== null) break
		}
		if (observed !== null) break
	}
	if (observed === null) return null
	const reset = contract.fixtureReset
	if (reset === null) return { observed, mutating: null }
	const resetInterface = permittedInterfaces.find(
		(candidate) => candidate.logicalId === reset.interfaceId,
	)
	let mutating: ControlTarget | null = null
	for (const operation of resetInterface?.operations ?? []) {
		if (!operation.stateChangeMarker) continue
		if (resetInterface === undefined) break
		mutating = targetOf(resetInterface, operation)
		if (mutating !== null) break
	}
	return { observed, mutating }
}

/**
 * AD-10's plan, derived from the interfaces the contract's probes exercise.
 *
 * Three constructions worth knowing. An `interface-present` check is emitted
 * only for an operation that has at least one leg, because a check over no legs
 * is satisfied vacuously and asserts nothing. The `state-reset` and
 * `clean-control` checks are emitted only when control legs could be planned at
 * all, for the same reason. And the fixture reset's own leg is one more leg
 * through the same port, so its identifier shares the namespace every other leg
 * identifier sits in.
 */
export const planPreflight: PlanStage<PreflightPlanInput, PreflightPlan> = (
	input,
) => {
	const { contract, probes, runId } = input
	for (const iface of contract.permittedInterfaces) {
		// Already thrown at compile; asserted again because the plan is
		// reachable from a caller who assembled a contract by hand.
		if (iface.kind !== 'api' && iface.kind !== 'cli') {
			throw new StructuralFailure(
				'unsupported-interface-kind',
				`EvalContract.permittedInterfaces[logicalId=${iface.logicalId}].kind`,
				`"${iface.kind}" is not supported; "api" and "cli" are (AD-10)`,
			)
		}
	}
	const permittedInterfaces = contract.permittedInterfaces

	const origins: LegOrigin[] = []
	const checks: PlannedCheck[] = []
	// Keyed by interface AND operation: `Operation.operationId` is scoped to a
	// `PermittedInterface`, so two interfaces may legally declare the same one
	// (its own schema description says so, and `duplicate-operation-signature`
	// covers method plus path template only). Keyed by operation id alone, one
	// interface's legs become another's clean legs.
	const legIdsByOperation = new Map<string, string[]>()
	const scopeKey = (interfaceId: string, operationId: string): string =>
		`${interfaceId}\u0000${operationId}`
	// Every planned leg's request signature, so the seeded-fault branch below can
	// ask whether a leg already in the group carries the fault leg's own request.
	const signatureByLegId = new Map<string, string>()
	const addLeg = (
		legId: string,
		purpose: PlannedLegPurpose,
		interfaceId: string,
		operation: AnyOperation,
		inputs: WitnessInputs,
		artifactPath: string,
	): PlannedLeg => {
		const leg: PlannedLeg = {
			legId,
			purpose,
			request: requestOf(legId, interfaceId, operation, inputs),
			operation,
			inputs,
		}
		origins.push({ leg, artifactPath })
		signatureByLegId.set(legId, requestSignature(leg.request, artifactPath))
		const key = scopeKey(interfaceId, operation.operationId)
		const group = legIdsByOperation.get(key)
		if (group === undefined) legIdsByOperation.set(key, [legId])
		else group.push(legId)
		return leg
	}

	// 1. the sensitivity legs and their checks
	permittedInterfaces.forEach((iface, interfaceIndex) => {
		operationsOf(iface).forEach((operation, operationIndex) => {
			const witness = operation.sensitivityWitness
			const path = `EvalContract.permittedInterfaces[${interfaceIndex}].operations[${operationIndex}]`
			if (witness !== null)
				witness.legs.forEach((leg, legIndex) => {
					addLeg(
						leg.legId,
						'sensitivity',
						iface.logicalId,
						operation,
						leg.inputs,
						`${path}.sensitivityWitness.legs[${legIndex}].legId`,
					)
				})
			checks.push({
				kind: 'input-sensitivity',
				interfaceId: iface.logicalId,
				operationId: operation.operationId,
				witness,
				operation,
			})
		})
	})

	// 3. the control legs, once per contract
	const control = selectControl(contract, permittedInterfaces)
	const controlLegIds: string[] = []
	if (control !== null) {
		const taken = declaredLegIds(contract, probes)
		const mintControl = (base: string): string => {
			const legId = mintLegId(base, taken)
			taken.add(legId)
			return legId
		}
		const { observed } = control
		const observe = (legId: string): void => {
			addLeg(
				legId,
				'control-observe',
				observed.iface.logicalId,
				observed.operation,
				observed.inputs,
				`the minted control-observe leg against "${observed.operation.operationId}"`,
			)
			controlLegIds.push(legId)
		}
		const first = mintControl('preflight-control-observe')
		observe(first)
		const reset = contract.fixtureReset
		if (control.mutating !== null && reset !== null) {
			const { mutating } = control
			const mutate = mintControl('preflight-control-mutate')
			addLeg(
				mutate,
				'control-mutate',
				mutating.iface.logicalId,
				mutating.operation,
				mutating.inputs,
				`the minted control-mutate leg against "${mutating.operation.operationId}"`,
			)
			controlLegIds.push(mutate)
			const resetOperation = operationsOf(mutating.iface).find(
				(candidate) => candidate.operationId === reset.operationId,
			)
			if (resetOperation === undefined) {
				throw new StructuralFailure(
					'unreachable-check-evidence',
					'EvalContract.fixtureReset',
					`the fixture reset names operation "${reset.operationId}" on interface "${reset.interfaceId}", which the contract does not declare (AD-10)`,
				)
			}
			addLeg(
				reset.legId,
				'control-reset',
				reset.interfaceId,
				resetOperation,
				reset.inputs,
				'EvalContract.fixtureReset.legId',
			)
			controlLegIds.push(reset.legId)
		}
		const last = mintControl('preflight-control-observe')
		observe(last)
		checks.push({ kind: 'state-reset', legIds: [first, last] })
		// AD-10's own worked example is two distinct nonexistent identifiers both
		// returning 404, so a `clean-control` reading sensitivity legs would fail
		// on a contract that followed the architecture verbatim.
		checks.push({ kind: 'clean-control', legIds: [...controlLegIds] })
	}

	// 5. one leg and two checks per seeded defect
	for (const probe of probes) {
		if (probe.expectedClean) continue
		for (const defect of probe.defects) {
			const witness = defect.manifestationWitness
			const path = `Probe[probeId=${probe.probeId}].defects[defectId=${defect.defectId}].manifestationWitness`
			if (witness === null) {
				checks.push({
					kind: 'seeded-fault-fired',
					defectId: defect.defectId,
					witness: null,
					operation: null,
				})
				continue
			}
			const iface = permittedInterfaces.find(
				(candidate) => candidate.logicalId === witness.interfaceId,
			)
			const operation = iface?.operations.find(
				(candidate) => candidate.operationId === witness.operationId,
			)
			if (operation === undefined) {
				throw new StructuralFailure(
					'unreachable-check-evidence',
					path,
					`the manifestation witness names operation "${witness.operationId}" on interface "${witness.interfaceId}", which the contract does not declare (AD-10)`,
				)
			}
			// A manifestation witness lives on the probe, so the compiler never sees
			// its inputs. They reach the port all the same, so they are checked here.
			checkInputsAgainstShape(
				witness.inputs,
				operation,
				`the manifestation witness of ${defect.defectId}`,
				`${path}.inputs`,
			)
			// The group is read before the fault leg joins it, which keeps the fault
			// leg out of its own clean-leg set.
			const group = [
				...(legIdsByOperation.get(
					scopeKey(witness.interfaceId, operation.operationId),
				) ?? []),
			]
			const faultLeg = addLeg(
				witness.legId,
				'seeded-fault',
				witness.interfaceId,
				operation,
				witness.inputs,
				`${path}.legId`,
			)
			// A clean leg has to ask the environment a different question. Another
			// leg of the same operation, most often a sensitivity leg, can carry a
			// request equal to the fault leg's; the environment answers both the same
			// way, so a witness firing there is the fault's own manifestation observed
			// a second time. Such a leg is dropped, since nothing downstream can tell
			// the two observations apart.
			//
			// Bounded to an operation AD-19 marks as changing no state, where one
			// request has one answer for the length of the run, which is the property
			// `state-reset` asserts over the same fixture. A mutating operation can
			// answer the same request differently at two points in the sequence, so
			// there the two legs are two events and the second answer is evidence of
			// its own; both legs stay in the set.
			const faultSignature = operation.stateChangeMarker
				? null
				: requestSignature(faultLeg.request, `${path}.legId`)
			const cleanLegIds = group.filter(
				(legId) =>
					faultSignature === null ||
					signatureByLegId.get(legId) !== faultSignature,
			)
			checks.push({
				kind: 'seeded-faults-scoped',
				defectId: defect.defectId,
				witness,
				operation,
				cleanLegIds,
			})
			checks.push({
				kind: 'seeded-fault-fired',
				defectId: defect.defectId,
				witness,
				operation,
			})
		}
	}

	// Two legs sharing an identifier would share a `probeId`, and the reducer
	// indexes observations by it, so one leg would answer for the other. The
	// contract side is already checked at compile; a manifestation witness is
	// not, since `Probe` is not part of the contract.
	const seen = new Set<string>()
	for (const origin of origins) {
		if (seen.has(origin.leg.legId)) {
			throw new StructuralFailure(
				'malformed-operator-expression',
				origin.artifactPath,
				`leg id "${origin.leg.legId}" is already claimed by another planned leg; two legs sharing a probeId cannot be told apart (AD-10, NFR9)`,
			)
		}
		seen.add(origin.leg.legId)
	}

	// AD-11 makes the fixture digest a required field of the verdict, and a digest
	// over no observation would certify a pre-flight that verified nothing. A
	// contract that offers pre-flight nothing to probe is refused here, where the
	// contract is in hand and the failure can carry a code.
	if (origins.length === 0) {
		throw new StructuralFailure(
			'unreachable-check-evidence',
			'EvalContract.permittedInterfaces',
			'the contract declares no operation pre-flight can probe, so there is no fixture to verify or digest (AD-10, AD-11)',
		)
	}

	// 2. one interface-present check per operation that has a leg, in
	// declaration order, ahead of the rest
	const presence: PlannedCheck[] = [...legIdsByOperation].map(
		([key, legIds]) => {
			const [interfaceId = '', operationId = ''] = key.split('\u0000')
			return {
				kind: 'interface-present',
				interfaceId,
				operationId,
				legIds: [...legIds],
			}
		},
	)

	return {
		runId,
		legs: origins.map((origin) => origin.leg),
		checks: [...presence, ...checks],
		referenceSets: referenceSetMembers(contract),
		referenceSetKeys: referenceSetKeysOf(contract),
	}
}
