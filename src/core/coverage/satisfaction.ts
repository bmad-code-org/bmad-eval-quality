/**
 * AD-31's seven satisfaction predicates: decision procedures over AD-19's
 * declarations and the structured direction and `check` pair. No run record,
 * no probe, no outcome state.
 *
 * Each rule quantifies over the sites its relevance predicate fires on:
 * satisfaction holds when every site is witnessed. A site whose declaration is
 * absent has no witness, so under-declaration costs coverage. A rule firing on
 * no site holds vacuously.
 *
 * Nothing here throws, matching `relevance.ts`: a coverage gap is recorded and
 * the artifact still ships (AD-5), so there is no failure code.
 */
import { substitutePointer } from '../compile/oracle-alignment.ts'
import { boundChannelsOf } from '../declared-inputs.ts'
import {
	type EvalContract,
	SIBLING_GROUP_MINIMUM,
} from '../schemas/eval-contract.ts'
import type { Expression, Operand } from '../schemas/expression.ts'
import type { Operation } from '../schemas/interface.ts'
import type { InteractionStep } from '../schemas/plan.ts'
import { INPUT_CHANNELS } from '../schemas/pointer.ts'
import {
	anyOperationOf,
	buildPlanIndex,
	type PlanIndex,
} from '../seal/plan-index.ts'
import {
	encodeToken,
	type ResolvedOperation,
	resolveOperations,
} from './operations.ts'
import {
	DISCIPLINE_RULES,
	type DisciplineRule,
	satisfactionPredicateId,
} from './rules.ts'

export type SatisfactionVerdict = {
	readonly rule: DisciplineRule
	readonly predicate: string
	readonly satisfied: boolean
	/** which site decided it, so a gap is diagnosable. */
	readonly reason: string
}

const verdict = (
	rule: DisciplineRule,
	satisfied: boolean,
	reason: string,
): SatisfactionVerdict => ({
	rule,
	predicate: satisfactionPredicateId(rule),
	satisfied,
	reason,
})

/** The rule fires on no site, so the universal over its sites holds. */
export const NO_RELEVANT_SITE =
	'the rule is relevant for no site, so satisfaction holds vacuously'

/** A contract declaring no operation leaves six of the rules an absent site. */
export const NO_OPERATION_WITNESS =
	'the contract declares no operation, so the site this rule fires on has no declaration to witness'

/** `unresolved` never throws; a duplicate identifier resolves to nothing. */
const planIndexOf = (contract: EvalContract): PlanIndex =>
	buildPlanIndex(contract.interactionPlan, contract.permittedInterfaces, {
		duplicateIds: 'unresolved',
	})

type CollectionLocation = NonNullable<
	Operation['responseDescriptor']['collectionLocations']
>[number]

// ---- the join between the two pointer spellings -------------------------

/** Everything one step produced or was given. */
const stepRoot = (stepId: string): string => `/interactions/${stepId}`

/**
 * A descriptor pointer read at one step, spelled interaction-rooted. The root
 * travels on the resolved operation, so an interface kind whose response
 * arrives on another channel is one change in `operations.ts` and none at the
 * five call sites below.
 */
const bodyPointer = (
	resolved: ResolvedOperation,
	stepId: string,
	descriptorPointer: string,
): string => `${stepRoot(stepId)}${resolved.descriptorRoot}${descriptorPointer}`

/** One declared response key at one step, rooted the way `bodyPointer` is. */
const keyPointer = (
	resolved: ResolvedOperation,
	stepId: string,
	key: string,
): string => `${stepRoot(stepId)}${resolved.descriptorRoot}/${encodeToken(key)}`

/** One declared parameter on one transport channel at one step. */
const parameterPointer = (
	stepId: string,
	channel: string,
	key: string,
): string =>
	`/interactions/${stepId}/call-inputs/${channel}/${encodeToken(key)}`

/** A pointer addresses a root when it names it or descends into it. */
const addresses = (pointer: string, root: string): boolean =>
	pointer === root || pointer.startsWith(`${root}/`)

const someAddresses = (pointers: Iterable<string>, root: string): boolean => {
	for (const pointer of pointers) {
		if (addresses(pointer, root)) return true
	}
	return false
}

// ---- the check tree, walked once per oracle -----------------------------

/**
 * One `check` node with its operand pointers resolved through any enclosing
 * quantifier. A connective node (`not`, `all`, `any`) carries neither an
 * operand pointer nor a collection, since its operands are nested expressions
 * that get nodes of their own; it witnesses nothing on its own.
 */
type CheckNode = {
	readonly expression: Expression
	/** one entry per operand position; `null` where the operand carries no pointer. */
	readonly operandPointers: readonly (string | null)[]
	/** a quantifier's collection pointer; `null` on every other node. */
	readonly collection: string | null
}

const operandPointer = (
	operand: Operand,
	boundElementRoot: string | null,
): string | null =>
	'pointer' in operand
		? substitutePointer(operand.pointer, boundElementRoot)
		: null

function walkCheck(
	expression: Expression,
	boundElementRoot: string | null,
	nodes: CheckNode[],
): void {
	switch (expression.op) {
		case 'not':
			nodes.push({ expression, operandPointers: [], collection: null })
			walkCheck(expression.operands[0], boundElementRoot, nodes)
			return
		case 'all':
		case 'any':
			nodes.push({ expression, operandPointers: [], collection: null })
			for (const child of expression.operands) {
				walkCheck(child, boundElementRoot, nodes)
			}
			return
		case 'for-all':
		case 'for-any': {
			const collection = operandPointer(expression.collection, boundElementRoot)
			nodes.push({ expression, operandPointers: [], collection })
			walkCheck(expression.predicate, collection, nodes)
			return
		}
		default: {
			// Widened before mapping: `.map` over a union of tuple types resolves
			// to a union of call signatures. `set-membership` falls here too: its
			// second operand is a `SetOperand`, which carries no pointer, so
			// `operandPointer` already answers `null` in that position.
			const operands: readonly Operand[] = expression.operands
			nodes.push({
				expression,
				operandPointers: operands.map((operand) =>
					operandPointer(operand, boundElementRoot),
				),
				collection: null,
			})
		}
	}
}

/** One oracle's two channels, flattened to what the predicates compare. */
type OracleView = {
	readonly directionTargets: readonly string[]
	readonly nodes: readonly CheckNode[]
	readonly checkPointers: ReadonlySet<string>
}

const oracleViewsOf = (contract: EvalContract): readonly OracleView[] =>
	contract.oracles.map((oracle) => {
		const nodes: CheckNode[] = []
		if (oracle.check !== null) walkCheck(oracle.check, null, nodes)
		const checkPointers = new Set<string>()
		for (const node of nodes) {
			if (node.collection !== null) checkPointers.add(node.collection)
			for (const pointer of node.operandPointers) {
				if (pointer !== null) checkPointers.add(pointer)
			}
		}
		return {
			directionTargets:
				oracle.direction === null ? [] : oracle.direction.evidenceTargets,
			nodes,
			checkPointers,
		}
	})

/** AD-20's "in both channels": the direction names the pointer and the check reads it. */
const bothChannelsAddress = (oracle: OracleView, root: string): boolean =>
	someAddresses(oracle.directionTargets, root) &&
	someAddresses(oracle.checkPointers, root)

const definedPointers = (node: CheckNode): readonly string[] =>
	node.operandPointers.filter((pointer): pointer is string => pointer !== null)

/**
 * The three derived views the predicates read. `evaluateSatisfaction` builds
 * one and passes it down, so seven predicates do not each rebuild the plan
 * index and re-walk every check tree. A predicate called on its own builds its
 * own, which is what every per-rule fixture does.
 */
export type SatisfactionContext = {
	readonly operations: readonly ResolvedOperation[]
	readonly index: PlanIndex
	readonly oracles: readonly OracleView[]
}

const contextOf = (contract: EvalContract): SatisfactionContext => ({
	operations: resolveOperations(contract),
	index: planIndexOf(contract),
	oracles: oracleViewsOf(contract),
})

/**
 * Rule 1: for every operation its relevance predicate fires on, some oracle's
 * direction and check both address that operation's success indicator and a
 * pointer whose declared role is something other than `success-indicator`,
 * read at one step. An operation whose only other roled pointers are themselves
 * indicators is a site with no witness.
 */
export function successIndicatorSeparationSatisfaction(
	contract: EvalContract,
	context: SatisfactionContext = contextOf(contract),
): SatisfactionVerdict {
	const rule = 'success-indicator-separation'
	const { operations, index, oracles } = context
	if (operations.length === 0) return verdict(rule, false, NO_OPERATION_WITNESS)
	let sites = 0
	for (const resolved of operations) {
		const { operation, descriptor } = resolved
		const { successIndicator, channelRoles } = descriptor
		if (successIndicator === null) {
			return verdict(
				rule,
				false,
				`operation ${operation.operationId} nominates no success indicator, so no oracle can separate one from the body`,
			)
		}
		if (channelRoles === null) {
			return verdict(
				rule,
				false,
				`operation ${operation.operationId} declares no channel roles, so no pointer is declared to separate the indicator from`,
			)
		}
		const roles = Object.entries(channelRoles)
		if (!roles.some(([pointer]) => pointer !== successIndicator)) continue
		sites += 1
		const others = roles
			.filter(
				([pointer, role]) =>
					pointer !== successIndicator && role !== 'success-indicator',
			)
			.map(([pointer]) => pointer)
		const witnessed = index
			.stepsUsing(operation.operationId)
			.some((step) =>
				oracles.some(
					(oracle) =>
						bothChannelsAddress(
							oracle,
							bodyPointer(resolved, step.stepId, successIndicator),
						) &&
						others.some((pointer) =>
							bothChannelsAddress(
								oracle,
								bodyPointer(resolved, step.stepId, pointer),
							),
						),
				),
			)
		if (!witnessed) {
			return verdict(
				rule,
				false,
				`no oracle addresses operation ${operation.operationId}'s success indicator beside another roled pointer at one step, in both channels`,
			)
		}
	}
	return verdict(
		rule,
		true,
		sites === 0
			? NO_RELEVANT_SITE
			: 'every operation the rule fires on has an oracle reading its success indicator beside another roled pointer',
	)
}

/**
 * Rule 2: for every operation declaring more than one distinct required
 * response key, some oracle's direction and check both address every one of
 * those keys at one step invoking that operation. AD-20's denominator is the
 * required-key set of the operation the addressed step invokes.
 */
export function wholeBodySatisfaction(
	contract: EvalContract,
	context: SatisfactionContext = contextOf(contract),
): SatisfactionVerdict {
	const rule = 'whole-body'
	const { operations, index, oracles } = context
	if (operations.length === 0) return verdict(rule, false, NO_OPERATION_WITNESS)
	let sites = 0
	for (const resolved of operations) {
		const { operation, descriptor } = resolved
		const required = [...new Set(descriptor.requiredKeys)]
		if (required.length <= 1) continue
		sites += 1
		const witnessed = index
			.stepsUsing(operation.operationId)
			.some((step) =>
				oracles.some((oracle) =>
					required.every((key) =>
						bothChannelsAddress(oracle, keyPointer(resolved, step.stepId, key)),
					),
				),
			)
		if (!witnessed) {
			return verdict(
				rule,
				false,
				`no oracle covers every required response key of operation ${operation.operationId} at one addressed step, in both channels`,
			)
		}
	}
	return verdict(
		rule,
		true,
		sites === 0
			? NO_RELEVANT_SITE
			: 'every operation declaring more than one required response key has an oracle covering all of them at one step',
	)
}

/** The site condition rule 3 relevance reads: a key on any input channel. */
const declaresRequestKey = (resolved: ResolvedOperation): boolean =>
	resolved.requestChannels.some(
		({ shape }) =>
			shape.requiredKeys.length > 0 ||
			shape.permittedKeys.length > 0 ||
			Object.keys(shape.types).length > 0,
	)

/**
 * AD-39's matcher, on any input channel of one step. The step carries no
 * operation, so the bound channels are read off the binding itself rather than
 * off a channel tuple that would name four channels the binding does not have.
 */
const bindsTypeViolating = (step: InteractionStep): boolean =>
	boundChannelsOf(step.inputBinding).some(({ bound }) => {
		if (bound === null) return false
		return Object.values(bound).some(
			(value) => 'matcher' in value && value.matcher === 'type-violating',
		)
	})

/**
 * Rule 3: for every operation declaring a request key, some step invoking it
 * binds AD-39's `type-violating` matcher and some check addresses that step.
 * The matcher is a declaration, so the pair decides the rule without reading
 * prose or a run.
 */
export function malformedInputSatisfaction(
	contract: EvalContract,
	context: SatisfactionContext = contextOf(contract),
): SatisfactionVerdict {
	const rule = 'malformed-input'
	const { operations, index, oracles } = context
	if (operations.length === 0) return verdict(rule, false, NO_OPERATION_WITNESS)
	let sites = 0
	for (const resolved of operations) {
		const { operation } = resolved
		if (!declaresRequestKey(resolved)) continue
		sites += 1
		const witnessed = index
			.stepsUsing(operation.operationId)
			.some(
				(step) =>
					bindsTypeViolating(step) &&
					oracles.some((oracle) =>
						someAddresses(oracle.checkPointers, stepRoot(step.stepId)),
					),
			)
		if (!witnessed) {
			return verdict(
				rule,
				false,
				`no step invoking operation ${operation.operationId} binds a type-violating matcher under a check that addresses it`,
			)
		}
	}
	return verdict(
		rule,
		true,
		sites === 0
			? NO_RELEVANT_SITE
			: 'every operation declaring a request key has a type-violating step some check addresses',
	)
}

/**
 * Rule 4: every declared collection location is the collection of some
 * quantifier, read at a step invoking its operation. The comparison is
 * equality: a quantifier one level inside a declared collection ranges over
 * something else. Both quantifiers are admitted, since `not(for-any P)` is the
 * idiomatic spelling of "no element satisfies P".
 */
export function perRecordSatisfaction(
	contract: EvalContract,
	context: SatisfactionContext = contextOf(contract),
): SatisfactionVerdict {
	const rule = 'per-record'
	const { operations, index, oracles } = context
	if (operations.length === 0) return verdict(rule, false, NO_OPERATION_WITNESS)
	let sites = 0
	for (const resolved of operations) {
		const { operation, descriptor } = resolved
		const { collectionLocations } = descriptor
		if (collectionLocations === null) {
			return verdict(
				rule,
				false,
				`operation ${operation.operationId} declares no collection-location list, so no quantifier can range over a declared collection`,
			)
		}
		const steps = index.stepsUsing(operation.operationId)
		for (const location of collectionLocations) {
			sites += 1
			const witnessed = steps.some((step) => {
				const collection = bodyPointer(resolved, step.stepId, location.pointer)
				return oracles.some((oracle) =>
					oracle.nodes.some((node) => node.collection === collection),
				)
			})
			if (!witnessed) {
				return verdict(
					rule,
					false,
					`no check quantifies over collection ${location.pointer} of operation ${operation.operationId}`,
				)
			}
		}
	}
	return verdict(
		rule,
		true,
		sites === 0
			? NO_RELEVANT_SITE
			: 'every declared collection location is the collection of some quantifier',
	)
}

/**
 * Rule 5: every declared sibling group has an oracle whose direction and check
 * both address two of its members. An operation member is addressed through a
 * step that invokes it; a parameter member through a `call-inputs` pointer on
 * any transport channel. Members are deduplicated first, since `SiblingGroups`
 * carries no uniqueness constraint.
 */
export function siblingCrossCheckSatisfaction(
	contract: EvalContract,
	context: SatisfactionContext = contextOf(contract),
): SatisfactionVerdict {
	const rule = 'sibling-cross-check'
	const groups = contract.siblingGroups
	if (groups === null) {
		return verdict(
			rule,
			false,
			'the contract declares no sibling groups, so no group is declared to cross-check',
		)
	}
	const { index, oracles } = context
	let sites = 0
	for (const group of groups.operations) {
		sites += 1
		const members = [...new Set(group)]
		const witnessed = oracles.some(
			(oracle) =>
				members.filter((operationId) =>
					index
						.stepsUsing(operationId)
						.some((step) => bothChannelsAddress(oracle, stepRoot(step.stepId))),
				).length >= SIBLING_GROUP_MINIMUM,
		)
		if (!witnessed) {
			return verdict(
				rule,
				false,
				`no oracle addresses two members of the operation sibling group ${members.join(' and ')} in both channels`,
			)
		}
	}
	for (const group of groups.parameters) {
		sites += 1
		const members = [...new Set(group)]
		const witnessed = oracles.some(
			(oracle) =>
				members.filter((parameter) =>
					contract.interactionPlan.some((step) =>
						// Building candidate pointers, not reading a declared
						// shape: `groups.parameters` carries no operation, so
						// every input channel is tried and whichever one the
						// oracle actually addresses is the match. It looks
						// identical to `declaresRequestKey` above and is not.
						INPUT_CHANNELS.some((channel) =>
							bothChannelsAddress(
								oracle,
								parameterPointer(step.stepId, channel, parameter),
							),
						),
					),
				).length >= SIBLING_GROUP_MINIMUM,
		)
		if (!witnessed) {
			return verdict(
				rule,
				false,
				`no oracle addresses two members of the parameter sibling group ${members.join(' and ')} in both channels`,
			)
		}
	}
	return verdict(
		rule,
		true,
		sites === 0
			? NO_RELEVANT_SITE
			: 'every declared sibling group has an oracle reading two of its members',
	)
}

const isReferenceSetOperand = (operand: Operand, identifier: string): boolean =>
	'referenceSet' in operand && operand.referenceSet === identifier

/**
 * AD-20 rule 6's two forms, selected by `expectedCardinality.mode`. `exact`
 * takes the bijection, `covers-by-key` against the reference set;
 * `page-bounded` and `at-most` take the injection, `for-all` over the page
 * whose predicate is `set-membership` against it. A page of twenty drawn from
 * ninety-seven never equals its reference set, so the bijection resolves false
 * against a correct server (AD-26).
 */
function reconciles(
	node: CheckNode,
	collection: string,
	location: CollectionLocation,
	referenceSet: string,
): boolean {
	const { expression } = node
	if (location.expectedCardinality.mode === 'exact') {
		return (
			expression.op === 'covers-by-key' &&
			isReferenceSetOperand(expression.operands[0], referenceSet) &&
			node.operandPointers[1] === collection
		)
	}
	if (expression.op !== 'for-all' || node.collection !== collection)
		return false
	const { predicate } = expression
	return (
		predicate.op === 'set-membership' &&
		isReferenceSetOperand(predicate.operands[1], referenceSet)
	)
}

/**
 * Rule 6: every collection location naming a reference set is reconciled
 * against it, in the form its declared cardinality mode requires.
 */
export function omissionAndCompletenessSatisfaction(
	contract: EvalContract,
	context: SatisfactionContext = contextOf(contract),
): SatisfactionVerdict {
	const rule = 'omission-and-completeness'
	const { operations, index, oracles } = context
	if (operations.length === 0) return verdict(rule, false, NO_OPERATION_WITNESS)
	let sites = 0
	for (const resolved of operations) {
		const { operation, descriptor } = resolved
		const { collectionLocations } = descriptor
		if (collectionLocations === null) {
			return verdict(
				rule,
				false,
				`operation ${operation.operationId} declares no collection-location list, so no location can be reconciled against a reference set`,
			)
		}
		const steps = index.stepsUsing(operation.operationId)
		for (const location of collectionLocations) {
			const referenceSet = location.referenceSet
			if (referenceSet === null) continue
			sites += 1
			const witnessed = steps.some((step) => {
				const collection = bodyPointer(resolved, step.stepId, location.pointer)
				return oracles.some((oracle) =>
					oracle.nodes.some((node) =>
						reconciles(node, collection, location, referenceSet),
					),
				)
			})
			if (!witnessed) {
				return verdict(
					rule,
					false,
					`no check reconciles collection ${location.pointer} of operation ${operation.operationId} against reference set ${referenceSet} in the form its ${location.expectedCardinality.mode} cardinality requires`,
				)
			}
		}
	}
	return verdict(
		rule,
		true,
		sites === 0
			? NO_RELEVANT_SITE
			: 'every collection location naming a reference set is reconciled against it in the declared form',
	)
}

/**
 * A read-back step with the operation it invokes. The read side is a different
 * operation from the write side, so the pair travels together: the read side's
 * own `descriptorRoot` decides where its response is addressed.
 */
type ReadBackStep = {
	readonly step: InteractionStep
	readonly resolved: ResolvedOperation
}

/** AD-39: a read-back step names the write in its temporal clause and changes no state itself. */
const readBackStepsFor = (
	contract: EvalContract,
	context: SatisfactionContext,
	writeStepId: string,
): readonly ReadBackStep[] =>
	contract.interactionPlan.flatMap((step) => {
		if (step.stepId === writeStepId || step.after !== writeStepId) return []
		const operation = anyOperationOf(context.index, step.operationId)
		if (operation === undefined || operation.stateChangeMarker) return []
		// The index and the resolver both read `permittedInterfaces`, so the
		// index answers with the very object the resolver carries. Matching on
		// identity leaves the index's duplicate-identifier rule as the one
		// thing deciding which operations resolve.
		return context.operations
			.filter((resolved) => resolved.operation === operation)
			.map((resolved) => ({ step, resolved }))
	})

/** One node holding a pointer into each side of the read-back relation. */
const relates = (
	node: CheckNode,
	writeStepId: string,
	readBack: ReadBackStep,
): boolean => {
	const pointers = definedPointers(node)
	return (
		// `call-inputs` is the same segment for every interface kind, so the
		// write side takes no root from its operation.
		someAddresses(pointers, `${stepRoot(writeStepId)}/call-inputs`) &&
		someAddresses(
			pointers,
			`${stepRoot(readBack.step.stepId)}${readBack.resolved.descriptorRoot}`,
		)
	)
}

/**
 * Rule 7: for every operation declaring `stateChangeMarker: true`, some check
 * node relates a pointer under a step invoking it to a pointer under the
 * response body of a later step whose operation changes no state and whose
 * temporal clause names the write. One node carries the relation: two unrelated
 * assertions under one `all` read nothing back.
 */
export function stateChangeReadBackSatisfaction(
	contract: EvalContract,
	context: SatisfactionContext = contextOf(contract),
): SatisfactionVerdict {
	const rule = 'state-change-read-back'
	const { operations, index, oracles } = context
	if (operations.length === 0) return verdict(rule, false, NO_OPERATION_WITNESS)
	let sites = 0
	for (const { operation } of operations) {
		if (!operation.stateChangeMarker) continue
		sites += 1
		const witnessed = index
			.stepsUsing(operation.operationId)
			.some((writeStep) =>
				readBackStepsFor(contract, context, writeStep.stepId).some((readBack) =>
					oracles.some((oracle) =>
						oracle.nodes.some((node) =>
							relates(node, writeStep.stepId, readBack),
						),
					),
				),
			)
		if (!witnessed) {
			return verdict(
				rule,
				false,
				`no check relates operation ${operation.operationId}'s call inputs to the response body of a later step that changes no state`,
			)
		}
	}
	return verdict(
		rule,
		true,
		sites === 0
			? NO_RELEVANT_SITE
			: 'every state-changing operation is read back through a later non-state-changing step',
	)
}

/**
 * One predicate per rule. The mapped type fails the typecheck when a member of
 * `DISCIPLINE_RULES` has no predicate, matching `RELEVANCE_PREDICATES`.
 */
export const SATISFACTION_PREDICATES: {
	readonly [Rule in DisciplineRule]: (
		contract: EvalContract,
		context?: SatisfactionContext,
	) => SatisfactionVerdict
} = {
	'success-indicator-separation': successIndicatorSeparationSatisfaction,
	'whole-body': wholeBodySatisfaction,
	'malformed-input': malformedInputSatisfaction,
	'per-record': perRecordSatisfaction,
	'sibling-cross-check': siblingCrossCheckSatisfaction,
	'omission-and-completeness': omissionAndCompletenessSatisfaction,
	'state-change-read-back': stateChangeReadBackSatisfaction,
}

/** All seven verdicts, in `DISCIPLINE_RULES` order, over declarations alone. */
export function evaluateSatisfaction(
	contract: EvalContract,
): readonly SatisfactionVerdict[] {
	const context = contextOf(contract)
	return DISCIPLINE_RULES.map((rule) =>
		SATISFACTION_PREDICATES[rule](contract, context),
	)
}
