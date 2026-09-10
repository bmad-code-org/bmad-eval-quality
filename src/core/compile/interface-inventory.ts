/**
 * Checks interface kinds, inventory-wide operation signatures, and step input
 * bindings against each operation's request shape.
 */
import {
	boundChannelsOf,
	declaredArtifactsOf,
	descriptorArtifactOf,
	isCommandOperation,
	isMcpOperation,
	requestShapeOf,
} from '../declared-inputs.ts'
import { StructuralFailure } from '../failure-codes.ts'
import type { EvalContract } from '../schemas/eval-contract.ts'
import type { AnyOperation, InterfaceKindName } from '../schemas/interface.ts'
import { operationsOf } from '../schemas/interface.ts'
import {
	anyOperationOf,
	buildPlanIndex,
	parseEvidenceTarget,
} from '../seal/plan-index.ts'
import { forEachArtifactPointer, type WitnessScope } from './reachability.ts'

/**
 * The kinds whose probe semantics AD-10 requires before it opens one. `cli` and
 * `mcp` declare theirs, so both run; `web` declares none and fails here, which
 * keeps this code fireable and AD-10's sentence true of it.
 *
 * Each tuple is spelled out and typed against `INTERFACE_KINDS`, on the
 * reasoning `pointer.ts` records for `NON_IDENTIFIER_ROOTED_CHANNELS`: adding a
 * fifth kind is then a decision about which side of this line it falls on, and
 * a test asserts the partition. Exported because two other gates assert the
 * same fact: `preflight/plan.ts`, which a caller can reach by assembling a plan
 * by hand, and `score/qualification.ts`, which reads a probe's declared kind
 * where these two read a contract's.
 */
export const SUPPORTED_INTERFACE_KINDS = [
	'api',
	'cli',
	'mcp',
] as const satisfies readonly InterfaceKindName[]

export const UNSUPPORTED_INTERFACE_KINDS = [
	'web',
] as const satisfies readonly InterfaceKindName[]

/**
 * Whether `compile`, the pre-flight plan, and the probe qualification gate
 * admit a declared kind. All three call this, so what a contract may declare
 * and what a defect signature may declare against cannot disagree.
 */
export const isSupportedInterfaceKind = (kind: InterfaceKindName): boolean =>
	(SUPPORTED_INTERFACE_KINDS as readonly string[]).includes(kind)

/**
 * A quoted kind list with its own verb, for a diagnostic that names what is
 * supported. A function so the one-element form has a test: closing a kind is a
 * move the tuple below is built to allow, and the general form would render one
 * element as a leading " and ".
 */
export const kindsClause = (kinds: readonly string[]): string => {
	const quoted = kinds.map((kind) => `"${kind}"`)
	return quoted.length === 1
		? `${quoted.join('')} is`
		: `${quoted.slice(0, -1).join(', ')} and ${quoted.slice(-1).join('')} are`
}

/**
 * The supported list as both throwers spell it, rendered from the tuple so a
 * message cannot claim a set the check does not enforce.
 */
export const SUPPORTED_KINDS_CLAUSE = kindsClause(SUPPORTED_INTERFACE_KINDS)

export function checkInterfaceKind(contract: EvalContract): void {
	for (const iface of contract.permittedInterfaces) {
		if (!isSupportedInterfaceKind(iface.kind)) {
			throw new StructuralFailure(
				'unsupported-interface-kind',
				`EvalContract.permittedInterfaces[logicalId=${iface.logicalId}].kind`,
				`"${iface.kind}" is not supported; ${SUPPORTED_KINDS_CLAUSE} (AD-10)`,
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

/**
 * The transport identity of a tool call: the published tool name, alone and
 * compared literally.
 *
 * There is nothing to erase and nothing to join. Every MCP call shares the one
 * transport identity `tools/call`, so the tool name is the whole of what tells
 * two calls apart, and a method and a path template would render one signature
 * for every tool a server publishes. Takes the field rather than an
 * `McpOperation`, on `operationSignature`'s own terms: AD-40's corpus-side
 * signature declares the same name and must produce the same string from it.
 */
export function mcpSignature(operation: { readonly toolName: string }): string {
	return operation.toolName
}

/** The transport identity of an operation of any kind. */
export const anyOperationSignature = (operation: AnyOperation): string => {
	if (isCommandOperation(operation)) return commandSignature(operation)
	if (isMcpOperation(operation)) return mcpSignature(operation)
	return operationSignature(operation)
}

export type SignatureFamily = 'api' | 'cli' | 'mcp'

/**
 * The shape family an interface kind's transport identity is rendered in.
 * Three renderings, and `api` and `web` share one because they share an
 * operation shape.
 *
 * Typed against the kind vocabulary rather than `string`, so a fifth
 * `INTERFACE_KINDS` member fails the typecheck here instead of landing in the
 * `api` family and rendering a method and a path template it does not have.
 */
export const signatureFamilyOf = (kind: InterfaceKindName): SignatureFamily => {
	switch (kind) {
		case 'cli':
			return 'cli'
		case 'mcp':
			return 'mcp'
		case 'api':
		case 'web':
			return 'api'
	}
}

/**
 * Finds duplicate transport identities across the full inventory.
 *
 * Keyed on the declaring kind's shape family beside the rendered string,
 * because the three renderings draw from different namespaces: a tool named
 * `notes` and an executable named `notes` both render `notes` while naming
 * different things on different machines, and refusing that pair would be a
 * collision the author cannot fix. `api` and `web` share one family, so two
 * operations sharing a method and a path template across those two kinds still
 * collide. `resolveHomeOperation` compares within a family for the same reason,
 * so the two agree about what a collision is.
 */
export function checkDuplicateOperationSignature(contract: EvalContract): void {
	const seen = new Map<string, { logicalId: string; operation: AnyOperation }>()
	for (const iface of contract.permittedInterfaces) {
		for (const operation of operationsOf(iface)) {
			const signature = anyOperationSignature(operation)
			const family = signatureFamilyOf(iface.kind)
			const key = `${family} ${signature}`
			const collision = seen.get(key)
			if (collision !== undefined) {
				// The message names the family, because the identity alone no
				// longer says which namespace it was compared in, and the
				// erasure clause is scoped to the family it applies to: a tool
				// name and an executable path carry no parameters to erase.
				const how =
					family === 'api'
						? 'after parameter-name erasure'
						: 'on the identity it renders'
				throw new StructuralFailure(
					'duplicate-operation-signature',
					`EvalContract.permittedInterfaces[logicalId=${iface.logicalId}].operations[operationId=${operation.operationId}]`,
					`collides with permittedInterfaces[logicalId=${collision.logicalId}].operations[operationId=${collision.operation.operationId}] ${how} ("${signature}") among ${family}-shaped operations (AD-19, AD-40)`,
				)
			}
			seen.set(key, { logicalId: iface.logicalId, operation })
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
 *
 * Resolving the pointer's step segment against the interaction plan is the
 * route for an oracle check, an oracle direction's evidence target and a rubric
 * criterion. A sensitivity-witness relation takes the other route, because a leg
 * identifier shares the step namespace without being a step and the plan lookup
 * cannot answer for one. The witness scope is what decides it, and preferring it
 * over the plan matters for ordering: this check runs at `compile.ts` ahead of
 * `checkWitnessLegIdentifiers`, so a leg id colliding with a step id is still
 * present here and the plan route would answer it against the wrong operation.
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
	const operationFor = (
		witnessScope: WitnessScope | null,
		stepId: string,
	): AnyOperation | undefined => {
		// A relation pointer rooted at anything but its own leg is
		// `checkWitnessLegality`'s, which names the witness and the stray root.
		if (witnessScope !== null)
			return witnessScope.legIds.includes(stepId)
				? witnessScope.operation
				: undefined
		const step = index.stepOf(stepId)
		if (step === undefined) return undefined
		return anyOperationOf(index, step.operationId)
	}
	forEachArtifactPointer(contract, (pointer, path, witnessScope) => {
		const target = parseEvidenceTarget(pointer)
		if (target.artifactId === null) return
		const operation = operationFor(witnessScope, target.stepId)
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
			// A step binding a channel of another kind has no declared shape
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
