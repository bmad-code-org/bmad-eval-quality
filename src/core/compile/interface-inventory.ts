/**
 * Checks interface kinds, inventory-wide operation signatures, and step input
 * bindings against each operation's request shape.
 */
import { StructuralFailure } from '../failure-codes.ts'
import type { EvalContract } from '../schemas/eval-contract.ts'
import type { Operation } from '../schemas/interface.ts'
import { TRANSPORT_CHANNELS } from '../schemas/pointer.ts'
import { buildPlanIndex } from '../seal/plan-index.ts'

/** Rejects permitted interface kinds that this contract version cannot run. */
export function checkInterfaceKind(contract: EvalContract): void {
	for (const iface of contract.permittedInterfaces) {
		if (iface.kind !== 'api') {
			throw new StructuralFailure(
				'unsupported-interface-kind',
				`EvalContract.permittedInterfaces[logicalId=${iface.logicalId}].kind`,
				`"${iface.kind}" is not supported in v0; only "api" is (AD-10)`,
			)
		}
	}
}

/** Erases parameter names so equivalent path templates share a signature. */
const PARAMETER_SEGMENT_PATTERN = /\{[A-Za-z0-9_-]+\}/g
const erase = (pathTemplate: string): string =>
	pathTemplate.replace(PARAMETER_SEGMENT_PATTERN, '{}')

/** Finds duplicate method and path signatures across the full inventory. */
export function checkDuplicateOperationSignature(contract: EvalContract): void {
	const seen = new Map<string, { logicalId: string; operation: Operation }>()
	for (const iface of contract.permittedInterfaces) {
		for (const operation of iface.operations) {
			const signature = `${operation.method} ${erase(operation.pathTemplate)}`
			const collision = seen.get(signature)
			if (collision !== undefined) {
				throw new StructuralFailure(
					'duplicate-operation-signature',
					`EvalContract.permittedInterfaces[logicalId=${iface.logicalId}].operations[operationId=${operation.operationId}]`,
					`collides with permittedInterfaces[logicalId=${collision.logicalId}].operations[operationId=${collision.operation.operationId}] after parameter-name erasure ("${signature}") (AD-19, AD-40)`,
				)
			}
			seen.set(signature, { logicalId: iface.logicalId, operation })
		}
	}
}

/**
 * Checks each binding key against its operation's request shape.
 * Steps with unresolved operation IDs belong to a separate cross-field rule.
 */
export function checkUndeclaredMandatoryInput(contract: EvalContract): void {
	const index = buildPlanIndex(
		contract.interactionPlan,
		contract.permittedInterfaces,
		{ duplicateIds: 'unresolved' },
	)
	for (const step of contract.interactionPlan) {
		const operation = index.operationOf(step.operationId)
		if (operation === undefined) continue
		for (const channel of TRANSPORT_CHANNELS) {
			const binding = step.inputBinding[channel]
			if (binding === null) continue
			const { requiredKeys, permittedKeys } = operation.requestShape[channel]
			for (const key of Object.keys(binding)) {
				if (!requiredKeys.includes(key) && !permittedKeys.includes(key)) {
					throw new StructuralFailure(
						'undeclared-mandatory-input',
						`EvalContract.interactionPlan[stepId=${step.stepId}].inputBinding.${channel}[${JSON.stringify(key)}]`,
						`operation "${operation.operationId}" declares "${key}" in neither requiredKeys nor permittedKeys of its ${channel} channel (AD-4)`,
					)
				}
			}
		}
	}
}
