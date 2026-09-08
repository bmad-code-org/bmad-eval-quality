/**
 * Checks interface kinds, inventory-wide operation signatures, and step input
 * bindings against each operation's request shape.
 */
import {
	boundChannelsOf,
	declaredArtifactsOf,
	descriptorArtifactOf,
	isCommandOperation,
	requestShapeOf,
} from '../declared-inputs.ts'
import { StructuralFailure } from '../failure-codes.ts'
import type { EvalContract } from '../schemas/eval-contract.ts'
import type { AnyOperation } from '../schemas/interface.ts'
import { operationsOf } from '../schemas/interface.ts'
import {
	anyOperationOf,
	buildPlanIndex,
	parseEvidenceTarget,
} from '../seal/plan-index.ts'
import { forEachArtifactPointer } from './reachability.ts'

/**
 * Rejects permitted interface kinds whose probe semantics are undeclared.
 *
 * AD-10 closed all three non-api kinds and named the condition for opening
 * one: the semantics have to be declared. They are declared for `cli`, so it
 * runs; `web` and `mcp` are still undeclared and still fail here, which is
 * what keeps this code fireable and keeps AD-10's sentence true of them.
 */
const SUPPORTED_INTERFACE_KINDS = ['api', 'cli'] as const

export function checkInterfaceKind(contract: EvalContract): void {
	for (const iface of contract.permittedInterfaces) {
		if (
			!(SUPPORTED_INTERFACE_KINDS as readonly string[]).includes(iface.kind)
		) {
			throw new StructuralFailure(
				'unsupported-interface-kind',
				`EvalContract.permittedInterfaces[logicalId=${iface.logicalId}].kind`,
				`"${iface.kind}" is not supported; "api" and "cli" are (AD-10)`,
			)
		}
	}
}

/** Erases parameter names so equivalent path templates share a signature. */
const PARAMETER_SEGMENT_PATTERN = /\{[A-Za-z0-9_-]+\}/g
const erase = (pathTemplate: string): string =>
	pathTemplate.replace(PARAMETER_SEGMENT_PATTERN, '{}')

/**
 * The transport identity AD-40 resolves a defect signature against: the method
 * and the path template with parameter names erased, so `/notes/{id}` and
 * `/notes/{noteId}` share one signature. Takes the two fields rather than an
 * `Operation`, since AD-40's corpus-side signature declares the same pair and
 * must produce the same string from it or the comparison is not a comparison.
 */
export function operationSignature(operation: {
	readonly method: string
	readonly pathTemplate: string
}): string {
	return `${operation.method} ${erase(operation.pathTemplate)}`
}

/**
 * The separator between a command's executable and each subcommand segment,
 * declared once so the contract side and AD-40's corpus side cannot disagree
 * about it. A space, matching the way the identity is written on a terminal.
 */
export const COMMAND_SIGNATURE_SEPARATOR = ' '

/**
 * The command counterpart of `operationSignature`, compared literally.
 *
 * There is no erasure step. A subcommand path carries no parameters: a
 * command's variable inputs are its arguments and options, which live in the
 * request shape. Erasing a subcommand segment would make `tool review` and
 * `tool report` one signature, which is the opposite of what erasure is for.
 */
export function commandSignature(operation: {
	readonly invocation: {
		readonly executable: string
		readonly subcommandPath: readonly string[]
	}
}): string {
	return [
		operation.invocation.executable,
		...operation.invocation.subcommandPath,
	].join(COMMAND_SIGNATURE_SEPARATOR)
}

/** The transport identity of an operation of either kind. */
export const anyOperationSignature = (operation: AnyOperation): string =>
	isCommandOperation(operation)
		? commandSignature(operation)
		: operationSignature(operation)

/** Finds duplicate method and path signatures across the full inventory. */
export function checkDuplicateOperationSignature(contract: EvalContract): void {
	const seen = new Map<string, { logicalId: string; operation: AnyOperation }>()
	for (const iface of contract.permittedInterfaces) {
		for (const operation of operationsOf(iface)) {
			const signature = anyOperationSignature(operation)
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
 * `unresolved-artifact-reference`: an artifact identifier nothing declares.
 *
 * Two sites name one: an evidence pointer's identifier segment, and a command
 * operation's own `descriptorChannel` when it nominates an artifact. Both are
 * authoring faults the compiler can see, and both take a code rather than
 * resolving `absent`, on AD-26's own precedent for a dangling reference-set
 * identifier: `absent` is defined over pointers that do not resolve against
 * observed evidence, and a dangling declaration is neither.
 */
export function checkArtifactReferences(contract: EvalContract): void {
	for (const iface of contract.permittedInterfaces) {
		for (const operation of operationsOf(iface)) {
			const declared = declaredArtifactsOf(operation)
			const nominated = descriptorArtifactOf(operation)
			if (nominated !== null && !declared.includes(nominated)) {
				throw new StructuralFailure(
					'unresolved-artifact-reference',
					`EvalContract.permittedInterfaces[logicalId=${iface.logicalId}].operations[operationId=${operation.operationId}].descriptorChannel.artifactId`,
					`nominates "${nominated}", which this operation does not declare it writes (AD-19, AD-26)`,
				)
			}
		}
	}
	const index = buildPlanIndex(
		contract.interactionPlan,
		contract.permittedInterfaces,
		{ duplicateIds: 'unresolved' },
	)
	forEachArtifactPointer(contract, (pointer, path) => {
		const target = parseEvidenceTarget(pointer)
		if (target.artifactId === null) return
		const step = index.stepOf(target.stepId)
		if (step === undefined) return
		const operation = anyOperationOf(index, step.operationId)
		// An unresolvable step or operation is `unreachable-check-evidence`'s,
		// at a higher rung; this check has nothing to compare against.
		if (operation === undefined) return
		if (declaredArtifactsOf(operation).includes(target.artifactId)) return
		throw new StructuralFailure(
			'unresolved-artifact-reference',
			path,
			`"${pointer}" names the "${target.artifactId}" artifact, which operation "${operation.operationId}" does not declare it writes (AD-26)`,
		)
	})
}

/**
 * Checks each binding key against its operation's request shape, and each
 * `{ principal }` value against the contract's declared principals.
 * Steps with unresolved operation IDs belong to a separate cross-field rule.
 *
 * The two conditions share one code and are not the same predicate: the key
 * case is an input the contract did not declare, the principal case has a
 * declared key whose referenced name the contract did not declare. AD-5's row
 * is widened to say so. Placing the principal case here rather than in a root
 * Zod refinement is deliberate: a constraint reaching from
 * `interactionPlan[].inputBinding` into `testData.principals` cannot survive
 * the export, and the published-schema differential sweep synthesises a
 * `{ principal }` union-branch witness naming no declared principal, which a
 * refinement would reject and ajv would accept.
 */
export function checkUndeclaredMandatoryInput(contract: EvalContract): void {
	const index = buildPlanIndex(
		contract.interactionPlan,
		contract.permittedInterfaces,
		{ duplicateIds: 'unresolved' },
	)
	const principals = new Set(Object.keys(contract.testData.principals ?? {}))
	for (const step of contract.interactionPlan) {
		const operation = anyOperationOf(index, step.operationId)
		if (operation === undefined) continue
		for (const { channel, bound: binding } of boundChannelsOf(
			step.inputBinding,
		)) {
			if (binding === null) continue
			const shape = requestShapeOf(operation, channel)
			// A step binding a channel of the other kind has no declared shape
			// to answer to. Reporting it as an undeclared input is true as far
			// as it goes: the operation declares no such channel, and so
			// declares no such key on it.
			const requiredKeys: readonly string[] = shape?.requiredKeys ?? []
			const permittedKeys: readonly string[] = shape?.permittedKeys ?? []
			for (const key of Object.keys(binding)) {
				const path = `EvalContract.interactionPlan[stepId=${step.stepId}].inputBinding.${channel}[${JSON.stringify(key)}]`
				if (!requiredKeys.includes(key) && !permittedKeys.includes(key)) {
					throw new StructuralFailure(
						'undeclared-mandatory-input',
						path,
						`operation "${operation.operationId}" declares "${key}" in neither requiredKeys nor permittedKeys of its ${channel} channel (AD-4)`,
					)
				}
				const value = binding[key]
				if (
					value !== undefined &&
					'principal' in value &&
					!principals.has(value.principal)
				) {
					throw new StructuralFailure(
						'undeclared-mandatory-input',
						path,
						`binds the principal "${value.principal}", which testData.principals does not declare (AD-4, AD-19)`,
					)
				}
			}
		}
	}
}
