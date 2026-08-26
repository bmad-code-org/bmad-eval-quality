---
epic: 5
story: 2
key: 5-2-the-seven-satisfaction-predicates
baseline_commit: 5613db647cc082b3f79baa1f20c93ce4d26e5fa4
---

# Story 5.2: The seven satisfaction predicates

Status: done

## Story

As the enforcement of the measured taxonomy,
I want each AD-20 rule's satisfaction predicate implemented with its exact denominator and branch
rules,
so that a coverage claim is never satisfiable by reading nothing.

## Acceptance Criteria

### AC 1: Module location, scope, and what this story does not build

One new source file and one edited source file under `src/core/coverage/`:

- `src/core/coverage/satisfaction.ts` (NEW): the seven satisfaction predicates and the aggregate
  that runs all seven in registry order.
- `src/core/coverage/rules.ts` (UPDATE): one added export, `satisfactionPredicateId`. Nothing else
  in that file changes.

One new fixture module and one new test file, plus one edited test file:

- `tests/coverage/fixtures/satisfaction-contracts.ts` (NEW): `satisfiedContract`, the all-relevant
  and all-satisfied contract the four Epic 1 fixtures cannot supply.
- `tests/coverage/satisfaction.test.ts` (NEW): fixtures 59 through 129.
- `tests/coverage/rules.test.ts` (UPDATE): fixtures 130 and 131.

`src/core/coverage/` and `tests/coverage/` exist at the baseline commit and carry Story 5.1's four
files. `scripts/dependency-direction.ts:53` classifies anything under `src/core/` as the `core`
layer and `isAllowedEdge` permits `core` to import `core`, so `satisfaction.ts` may import from
`core/compile/`, `core/seal/`, and `core/schemas/` with no change to the layer graph, the checker,
or `tests/architecture/dependency-direction.test.ts`.

**This story does not build:**

1. Any change to `src/core/coverage/relevance.ts` or to `tests/coverage/relevance.test.ts`. The
   seven relevance predicates and all 58 of Story 5.1's fixtures ship unchanged, byte for byte.
   Decision 11 states why the two files are not merged behind a shared site enumeration and how the
   agreement between them is pinned instead.
2. Any `CoverageGap` record. `CoverageGap` (`src/core/schemas/evidence-artifact.ts:148-159`) is a
   strict object carrying `rule`, `relevancePredicate`, `satisfactionPredicate`, `satisfied`, and
   `severity`. No declaration maps a discipline rule to a severity, and building the record is
   Story 5.3's, whose own `Then` clause names it.
3. The published predicate table, its CI regeneration, or the contract fixture corpus. Those are
   Story 5.3's, and AD-31 forbids publishing them against the historical worked example.
4. Any change to `src/core/compile/compile.ts`, its nineteen-call order, or its `EvalContract`
   return type. Story 4.4 shipped `compile` returning a bare contract and reserved coverage records
   for Epic 5; the record does not exist until Story 5.3, so nothing is wired this story.
5. Any change to `src/index.ts`. Story 6.5 owns the published surface, matching every Epic 3, Epic
   4, and Epic 5 story so far.
6. Any AD-5 code. Coverage gaps never block compilation (`ARCHITECTURE-SPINE.md:251`), so no
   predicate here throws `StructuralFailure` and `FAILURE_CODES` stays at twenty-one members.
7. Any schema change. `EvalContract` already carries every declaration these seven read.

### AC 2: `src/core/coverage/rules.ts`, one added export

Append to the existing file, after `relevancePredicateId`. Nothing above it changes.

```ts
/** `satisfactionPredicate` on a coverage-gap record. Derived, like its relevance twin. */
export const satisfactionPredicateId = (rule: DisciplineRule): string =>
	`${rule}-satisfaction`
```

### AC 3: `src/core/coverage/satisfaction.ts`, header, verdict shape, and the shared joins

Already in Biome's format and import order. Transcribing it should produce no diff under
`biome check --write`.

```ts
/**
 * AD-31's seven satisfaction predicates: decision procedures over AD-19's
 * declarations and the structured direction and `check` pair. No run record,
 * no probe, no outcome state.
 *
 * Each rule quantifies over the sites its relevance predicate fires on (Story
 * 5.1 Decision 5): satisfaction holds when every site is witnessed. A site
 * whose declaration is absent has no witness, so under-declaration costs
 * coverage. A rule firing on no site holds vacuously.
 *
 * Nothing here throws, matching `relevance.ts`: a coverage gap is recorded and
 * the artifact still ships (AD-5), so there is no failure code.
 */
import { substitutePointer } from '../compile/oracle-alignment.ts'
import {
	type EvalContract,
	SIBLING_GROUP_MINIMUM,
} from '../schemas/eval-contract.ts'
import type { Expression, Operand } from '../schemas/expression.ts'
import type { Operation } from '../schemas/interface.ts'
import type { InteractionStep } from '../schemas/plan.ts'
import { TRANSPORT_CHANNELS } from '../schemas/pointer.ts'
import { buildPlanIndex, type PlanIndex } from '../seal/plan-index.ts'
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

/** Decision 3: the rule fires on no site, so the universal over its sites holds. */
export const NO_RELEVANT_SITE =
	'the rule is relevant for no site, so satisfaction holds vacuously'

/** Decision 4: a contract declaring no operation leaves six of the rules an absent site. */
export const NO_OPERATION_WITNESS =
	'the contract declares no operation, so the site this rule fires on has no declaration to witness'

/** Every declared operation, flattened. `relevance.ts` keeps its own copy. */
const operationsOf = (contract: EvalContract): readonly Operation[] =>
	contract.permittedInterfaces.flatMap((declared) => declared.operations)

/** Decision 13: `unresolved` never throws; a duplicate identifier resolves to nothing. */
const planIndexOf = (contract: EvalContract): PlanIndex =>
	buildPlanIndex(contract.interactionPlan, contract.permittedInterfaces, {
		duplicateIds: 'unresolved',
	})

type CollectionLocation = NonNullable<
	Operation['responseDescriptor']['collectionLocations']
>[number]

// ---- the join between the two pointer spellings -------------------------

/** RFC 6901 escaping, `~` before `/`. */
const encodeToken = (token: string): string =>
	token.replace(/~/g, '~0').replace(/\//g, '~1')

/** Everything one step produced or was given. */
const stepRoot = (stepId: string): string => `/interactions/${stepId}`

/** Decision 5: a descriptor pointer read at one step, spelled interaction-rooted. */
const bodyPointer = (stepId: string, descriptorPointer: string): string =>
	`/interactions/${stepId}/response-body${descriptorPointer}`

/** One declared response key at one step. */
const keyPointer = (stepId: string, key: string): string =>
	`/interactions/${stepId}/response-body/${encodeToken(key)}`

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

/** One `check` node with its operand pointers resolved through any enclosing quantifier. */
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
		case 'set-membership':
			// The second operand is a `SetOperand` and carries no pointer.
			nodes.push({
				expression,
				operandPointers: [
					operandPointer(expression.operands[0], boundElementRoot),
					null,
				],
				collection: null,
			})
			return
		default: {
			// Widened before mapping: `.map` over a union of tuple types resolves
			// to a union of call signatures.
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
```

### AC 4: `src/core/coverage/satisfaction.ts`, rules 1 through 4

```ts
/**
 * Rule 1: for every operation its relevance predicate fires on, some oracle's
 * direction and check both address that operation's success indicator and a
 * pointer whose declared role is something other than `success-indicator`,
 * read at one step. Decision 7: an operation whose only other roled pointers
 * are themselves indicators is a site with no witness.
 */
export function successIndicatorSeparationSatisfaction(
	contract: EvalContract,
): SatisfactionVerdict {
	const rule = 'success-indicator-separation'
	const operations = operationsOf(contract)
	if (operations.length === 0) return verdict(rule, false, NO_OPERATION_WITNESS)
	const index = planIndexOf(contract)
	const oracles = oracleViewsOf(contract)
	let sites = 0
	for (const operation of operations) {
		const { successIndicator, channelRoles } = operation.responseDescriptor
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
							bodyPointer(step.stepId, successIndicator),
						) &&
						others.some((pointer) =>
							bothChannelsAddress(oracle, bodyPointer(step.stepId, pointer)),
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
): SatisfactionVerdict {
	const rule = 'whole-body'
	const operations = operationsOf(contract)
	if (operations.length === 0) return verdict(rule, false, NO_OPERATION_WITNESS)
	const index = planIndexOf(contract)
	const oracles = oracleViewsOf(contract)
	let sites = 0
	for (const operation of operations) {
		const required = [...new Set(operation.responseDescriptor.requiredKeys)]
		if (required.length <= 1) continue
		sites += 1
		const witnessed = index
			.stepsUsing(operation.operationId)
			.some((step) =>
				oracles.some((oracle) =>
					required.every((key) =>
						bothChannelsAddress(oracle, keyPointer(step.stepId, key)),
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

/** The site condition rule 3 relevance reads: a key on any of the four channels. */
const declaresRequestKey = (operation: Operation): boolean =>
	TRANSPORT_CHANNELS.some((channel) => {
		const shape = operation.requestShape[channel]
		return (
			shape.requiredKeys.length > 0 ||
			shape.permittedKeys.length > 0 ||
			Object.keys(shape.types).length > 0
		)
	})

/** AD-39's matcher, on any transport channel of one step. */
const bindsTypeViolating = (step: InteractionStep): boolean =>
	TRANSPORT_CHANNELS.some((channel) => {
		const binding = step.inputBinding[channel]
		if (binding === null) return false
		return Object.values(binding).some(
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
): SatisfactionVerdict {
	const rule = 'malformed-input'
	const operations = operationsOf(contract)
	if (operations.length === 0) return verdict(rule, false, NO_OPERATION_WITNESS)
	const index = planIndexOf(contract)
	const oracles = oracleViewsOf(contract)
	let sites = 0
	for (const operation of operations) {
		if (!declaresRequestKey(operation)) continue
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
 * something else. Decision 10 admits both quantifiers, since `not(for-any P)`
 * is the idiomatic spelling of "no element satisfies P".
 */
export function perRecordSatisfaction(
	contract: EvalContract,
): SatisfactionVerdict {
	const rule = 'per-record'
	const operations = operationsOf(contract)
	if (operations.length === 0) return verdict(rule, false, NO_OPERATION_WITNESS)
	const index = planIndexOf(contract)
	const oracles = oracleViewsOf(contract)
	let sites = 0
	for (const operation of operations) {
		const { collectionLocations } = operation.responseDescriptor
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
				const collection = bodyPointer(step.stepId, location.pointer)
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
```

### AC 5: `src/core/coverage/satisfaction.ts`, rules 5 through 7 and the aggregate

```ts
/**
 * Rule 5: every declared sibling group has an oracle whose direction and check
 * both address two of its members. An operation member is addressed through a
 * step that invokes it; a parameter member through a `call-inputs` pointer on
 * any transport channel. Members are deduplicated first (Decision 14), since
 * `SiblingGroups` carries no uniqueness constraint.
 */
export function siblingCrossCheckSatisfaction(
	contract: EvalContract,
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
	const index = planIndexOf(contract)
	const oracles = oracleViewsOf(contract)
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
						TRANSPORT_CHANNELS.some((channel) =>
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
): SatisfactionVerdict {
	const rule = 'omission-and-completeness'
	const operations = operationsOf(contract)
	if (operations.length === 0) return verdict(rule, false, NO_OPERATION_WITNESS)
	const index = planIndexOf(contract)
	const oracles = oracleViewsOf(contract)
	let sites = 0
	for (const operation of operations) {
		const { collectionLocations } = operation.responseDescriptor
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
				const collection = bodyPointer(step.stepId, location.pointer)
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

/** AD-39: a read-back step names the write in its temporal clause and changes no state itself. */
const readBackStepsFor = (
	contract: EvalContract,
	index: PlanIndex,
	writeStepId: string,
): readonly InteractionStep[] =>
	contract.interactionPlan.filter((step) => {
		if (step.stepId === writeStepId || step.after !== writeStepId) return false
		const operation = index.operationOf(step.operationId)
		return operation !== undefined && !operation.stateChangeMarker
	})

/** One node holding a pointer into each side of the read-back relation. */
const relates = (
	node: CheckNode,
	writeStepId: string,
	readStepId: string,
): boolean => {
	const pointers = definedPointers(node)
	return (
		someAddresses(pointers, `${stepRoot(writeStepId)}/call-inputs`) &&
		someAddresses(pointers, `${stepRoot(readStepId)}/response-body`)
	)
}

/**
 * Rule 7: for every operation declaring `stateChangeMarker: true`, some check
 * node relates a pointer under a step invoking it to a pointer under the
 * response body of a later step whose operation changes no state and whose
 * temporal clause names the write. Decision 9 requires one node: two unrelated
 * assertions under one `all` read nothing back.
 */
export function stateChangeReadBackSatisfaction(
	contract: EvalContract,
): SatisfactionVerdict {
	const rule = 'state-change-read-back'
	const operations = operationsOf(contract)
	if (operations.length === 0) return verdict(rule, false, NO_OPERATION_WITNESS)
	const index = planIndexOf(contract)
	const oracles = oracleViewsOf(contract)
	let sites = 0
	for (const operation of operations) {
		if (!operation.stateChangeMarker) continue
		sites += 1
		const witnessed = index
			.stepsUsing(operation.operationId)
			.some((writeStep) =>
				readBackStepsFor(contract, index, writeStep.stepId).some((readStep) =>
					oracles.some((oracle) =>
						oracle.nodes.some((node) =>
							relates(node, writeStep.stepId, readStep.stepId),
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
	return DISCIPLINE_RULES.map((rule) => SATISFACTION_PREDICATES[rule](contract))
}
```

### AC 6: `tests/coverage/fixtures/satisfaction-contracts.ts`

The four contracts Story 5.1 asserted against answer `not satisfied` or `vacuously satisfied` on
every rule but one. That column set catches a fail-open regression and nothing else, so this story
adds one contract on which all seven rules are relevant and all seven are satisfied.

It is one fixture. Story 5.3's corpus is one contract per rule per relevance-and-satisfaction
combination, plus the emitted table and its CI regeneration, and this file is not that corpus. It is
the seed 5.3 may lift.

```ts
// A contract every one of AD-31's seven relevance predicates and all seven
// satisfaction predicates fire on. The four Epic 1 fixtures answer "not
// satisfied" or "vacuously satisfied" almost everywhere, so without this one
// the satisfaction columns prove only that nothing fires.
//
// It compiles clean under `compile(contract, { strict: false })` (fixture
// 128), so no verdict here rests on a shape the compiler rejects.
//
// Which oracle witnesses which rule:
//   O-001  rule 6, the bijection form against `expected-things`
//   O-002  rule 1 for `create-thing`, and rule 2
//   O-003  rule 1 for `list-things`
//   O-004  rule 3 for both operations, and rule 5's operation group
//   O-005  rule 5's parameter group
//   O-006  rule 7
//   O-007  rule 4

import type { EvalContract } from '../../../src/core/schemas/eval-contract.ts'

const emptyChannel = {
	requiredKeys: [] as string[],
	permittedKeys: [] as string[],
	types: {} as Record<string, null>,
}

export const satisfiedContract = {
	schemaVersion: 1,
	contractId: 'satisfied-declarations',
	parentDigest: null,
	revisionCount: 0,
	sourceSpecDigest: null,
	behaviors: [
		{
			id: 'B-001',
			description: 'A created thing is readable back in the list of things.',
			severity: 'critical',
			observableSuccessCriterion:
				'A list call after a create returns one element per seeded thing, carrying the name the create call sent.',
			requirementLinks: [{ scheme: 'local', id: 'REQ-1' }],
			riskLinks: [{ scheme: 'local-risk', id: 'RISK-1' }],
			oracles: ['O-001', 'O-002', 'O-003', 'O-004', 'O-005', 'O-006', 'O-007'],
		},
	],
	oracles: [
		{
			id: 'O-001',
			direction: {
				evidenceTargets: ['/interactions/list/response-body/items'],
				relation: 'covers-by-key',
				polarity: 'expects-hold',
				scope: 'One list call over the seeded set.',
				negativeDomain: 'A list omitting a seeded thing, or repeating one.',
			},
			check: {
				op: 'covers-by-key',
				operands: [
					{ referenceSet: 'expected-things' },
					{ pointer: '/interactions/list/response-body/items' },
				],
				expectedKey: 'id',
				actualKey: 'id',
			},
			polarity: 'expects-hold',
			commentary: 'Reconciles the whole list against the declared set.',
		},
		{
			id: 'O-002',
			direction: {
				evidenceTargets: [
					'/interactions/create/response-body/ok',
					'/interactions/create/response-body/id',
					'/interactions/create/response-body/error',
				],
				relation: 'all',
				polarity: 'expects-hold',
				scope: 'The whole create response.',
				negativeDomain:
					'A create reporting success with no identifier, or with a diagnostic beside it.',
			},
			check: {
				op: 'all',
				operands: [
					{
						op: 'existence',
						operands: [{ pointer: '/interactions/create/response-body/ok' }],
					},
					{
						op: 'existence',
						operands: [{ pointer: '/interactions/create/response-body/id' }],
					},
					{
						op: 'absence',
						operands: [{ pointer: '/interactions/create/response-body/error' }],
					},
				],
			},
			polarity: 'expects-hold',
			commentary: null,
		},
		{
			id: 'O-003',
			direction: {
				evidenceTargets: [
					'/interactions/list/response-body/items',
					'/interactions/list/response-body/error',
				],
				relation: 'all',
				polarity: 'expects-hold',
				scope: 'The list response taken as a whole.',
				negativeDomain: 'A list carrying items alongside a diagnostic field.',
			},
			check: {
				op: 'all',
				operands: [
					{
						op: 'existence',
						operands: [{ pointer: '/interactions/list/response-body/items' }],
					},
					{
						op: 'absence',
						operands: [{ pointer: '/interactions/list/response-body/error' }],
					},
				],
			},
			polarity: 'expects-hold',
			commentary: null,
		},
		{
			id: 'O-004',
			direction: {
				evidenceTargets: [
					'/interactions/malformed-create/response-body/error',
					'/interactions/malformed-list/response-body/error',
				],
				relation: 'all',
				polarity: 'expects-hold',
				scope:
					'Both sibling operations, each given an input that violates its declared type.',
				negativeDomain:
					'One sibling rejecting the malformed input while the other accepts it.',
			},
			check: {
				op: 'all',
				operands: [
					{
						op: 'existence',
						operands: [
							{ pointer: '/interactions/malformed-create/response-body/error' },
						],
					},
					{
						op: 'existence',
						operands: [
							{ pointer: '/interactions/malformed-list/response-body/error' },
						],
					},
				],
			},
			polarity: 'expects-hold',
			commentary: null,
		},
		{
			id: 'O-005',
			direction: {
				evidenceTargets: [
					'/interactions/create/call-inputs/body/name',
					'/interactions/list/call-inputs/query/limit',
				],
				relation: 'all',
				polarity: 'expects-hold',
				scope: 'The two sibling parameters, as sent.',
				negativeDomain: 'One parameter carried and the other dropped.',
			},
			check: {
				op: 'all',
				operands: [
					{
						op: 'existence',
						operands: [
							{ pointer: '/interactions/create/call-inputs/body/name' },
						],
					},
					{
						op: 'existence',
						operands: [
							{ pointer: '/interactions/list/call-inputs/query/limit' },
						],
					},
				],
			},
			polarity: 'expects-hold',
			commentary: null,
		},
		{
			id: 'O-006',
			direction: {
				evidenceTargets: [
					'/interactions/list/response-body/items',
					'/interactions/create/call-inputs/body/name',
				],
				relation: 'containment',
				polarity: 'expects-hold',
				scope:
					'The list read after the create, against the name the create sent.',
				negativeDomain:
					'A create reporting success whose thing never appears in a later list.',
			},
			check: {
				op: 'containment',
				operands: [
					{ pointer: '/interactions/list/response-body/items' },
					{ pointer: '/interactions/create/call-inputs/body/name' },
				],
			},
			polarity: 'expects-hold',
			commentary: null,
		},
		{
			id: 'O-007',
			direction: {
				evidenceTargets: ['/interactions/list/response-body/items'],
				relation: 'for-all',
				polarity: 'expects-hold',
				scope: 'Every element of the returned list.',
				negativeDomain:
					'A list whose first element carries an identifier and whose later elements do not.',
			},
			check: {
				op: 'for-all',
				collection: { pointer: '/interactions/list/response-body/items' },
				predicate: { op: 'existence', operands: [{ pointer: '@/id' }] },
			},
			polarity: 'expects-hold',
			commentary: null,
		},
	],
	rubrics: [
		{
			id: 'R-001',
			scaleLevels: [{ level: 1, anchor: 'Every expected thing is present.' }],
			failureModePenalties: [
				{ name: 'omission', description: 'An expected thing is missing.' },
			],
			maxLength: 400,
			criteria: [
				{
					id: 'RC-001',
					text: 'Does the returned list carry every expected identifier?',
					evidence: '/interactions/list/response-body/items',
				},
			],
		},
	],
	waivers: [
		{
			id: 'W-001',
			rule: 'omission-and-completeness',
			rationale: 'The upstream seed is unavailable in the sandbox environment.',
			condition: null,
			approval: 'gate-c-reviewer',
			expiresAt: '2027-01-01T00:00:00Z',
		},
	],
	permittedInterfaces: [
		{
			logicalId: 'thing-api',
			kind: 'api',
			operations: [
				{
					operationId: 'create-thing',
					method: 'POST',
					pathTemplate: '/things',
					stateChangeMarker: true,
					requestShape: {
						path: emptyChannel,
						query: emptyChannel,
						header: emptyChannel,
						body: {
							requiredKeys: ['name'],
							permittedKeys: ['name'],
							types: { name: 'string' },
						},
					},
					responseDescriptor: {
						requiredKeys: ['id', 'ok'],
						permittedKeys: ['id', 'ok', 'error'],
						types: { id: 'string', ok: 'boolean', error: 'string' },
						successIndicator: '/ok',
						channelRoles: {
							'/ok': 'success-indicator',
							'/id': 'payload',
							'/error': 'diagnostic',
						},
						collectionLocations: [],
					},
					volatilePointers: ['/id'],
				},
				{
					operationId: 'list-things',
					method: 'GET',
					pathTemplate: '/things',
					stateChangeMarker: false,
					requestShape: {
						path: emptyChannel,
						query: {
							requiredKeys: [],
							permittedKeys: ['limit'],
							types: { limit: 'number' },
						},
						header: emptyChannel,
						body: emptyChannel,
					},
					responseDescriptor: {
						requiredKeys: ['items'],
						permittedKeys: ['items', 'error'],
						types: { items: 'array', error: 'string' },
						successIndicator: '/items',
						channelRoles: {
							'/items': 'collection',
							'/error': 'diagnostic',
						},
						collectionLocations: [
							{
								pointer: '/items',
								expectedCardinality: { mode: 'exact', count: 3 },
								referenceSet: 'expected-things',
							},
						],
					},
					volatilePointers: [],
				},
			],
		},
	],
	referenceSets: {
		'expected-things': {
			keys: ['id'],
			members: [{ id: 't-1' }, { id: 't-2' }, { id: 't-3' }],
			commentary: null,
		},
	},
	siblingGroups: {
		operations: [['create-thing', 'list-things']],
		parameters: [['limit', 'name']],
	},
	interactionPlan: [
		{
			stepId: 'create',
			operationId: 'create-thing',
			inputBinding: {
				path: null,
				query: null,
				header: null,
				body: { name: { matcher: 'any' } },
			},
			after: null,
		},
		{
			stepId: 'list',
			operationId: 'list-things',
			inputBinding: {
				path: null,
				query: { limit: { literal: 10 } },
				header: null,
				body: null,
			},
			after: 'create',
		},
		{
			stepId: 'malformed-create',
			operationId: 'create-thing',
			inputBinding: {
				path: null,
				query: null,
				header: null,
				body: { name: { matcher: 'type-violating' } },
			},
			after: null,
		},
		{
			stepId: 'malformed-list',
			operationId: 'list-things',
			inputBinding: {
				path: null,
				query: { limit: { matcher: 'type-violating' } },
				header: null,
				body: null,
			},
			after: null,
		},
	],
	scopedResources: null,
	forbiddenInputs: [
		'original-spec',
		'source-code',
		'repository',
		'builder-transcript',
		'implementation-logs',
		'comparator-results',
		'human-labels',
	],
	testData: {
		setup: 'Seed exactly three things with identifiers t-1, t-2, t-3.',
		cleanup: 'Delete every thing created during the run.',
	},
	budgets: {
		maxToolCalls: 20,
		maxWallClockMinutes: 5,
		maxCostUsd: '0.25',
	},
	safetyLimits: [
		'No request to any host other than the mapped thing-api target.',
	],
	requiredEvidence: ['Request and response pair for every call, in order.'],
	probeStepBound: 8,
} satisfies EvalContract
```

### AC 7: The satisfaction verdicts for the five whole-contract fixtures

The derived truth table, stated here so a regression that moves one cell fails an assertion.

| Rule | `absentContract` | `explicitlyEmptyContract` | `populatedContract` | `gateCContract` | `satisfiedContract` |
| --- | --- | --- | --- | --- | --- |
| 1 success-indicator-separation | not satisfied | not satisfied | not satisfied | not satisfied | satisfied |
| 2 whole-body | satisfied | satisfied | not satisfied | not satisfied | satisfied |
| 3 malformed-input | satisfied | satisfied | not satisfied | not satisfied | satisfied |
| 4 per-record | not satisfied | satisfied | not satisfied | not satisfied | satisfied |
| 5 sibling-cross-check | not satisfied | satisfied | not satisfied | not satisfied | satisfied |
| 6 omission-and-completeness | not satisfied | satisfied | not satisfied | not satisfied | satisfied |
| 7 state-change-read-back | satisfied | satisfied | not satisfied | satisfied | satisfied |

Every `satisfied` cell in the first two columns is vacuous: the rule is not relevant there, its site
count is zero, and its reason is `NO_RELEVANT_SITE`. Every `satisfied` cell in the last two columns
is witnessed. Fixture 68 asserts the difference so the two are never confused.

Why each non-obvious cell falls where it does:

- `absentContract` is not satisfied on rule 1 because `read-thing` nominates no success indicator.
  The predicate returns before it reaches `channelRoles`, exactly as its relevance twin does.
- `absentContract` is satisfied on rules 2, 3, and 7 for the same reason its relevance column reads
  not relevant on all three: one distinct required key, four empty request channels, and
  `stateChangeMarker: false`. Zero sites, so the universal holds.
- `absentContract` is not satisfied on rules 4, 5, and 6 because `collectionLocations: null` and
  `siblingGroups: null` are absent declarations. AD-31 makes them relevant, and an absent
  declaration has nothing an oracle could witness.
- `explicitlyEmptyContract` differs from `absentContract` on rules 4, 5, and 6 alone, which is the
  three-state distinction the fixture triple exists to express.
- `populatedContract` is not satisfied on all seven. Its one oracle reconciles `list-things`'s
  collection against `expected-things`, and even rule 6 fails, because `create-thing` declares
  `collectionLocations: null` and is an absent site under Story 5.1's Decision 5 quantifier. This is
  the consequence that decision wrote down in advance.
- `gateCContract` is satisfied on rule 7 through O-001, whose `deep-equality` node relates
  `/interactions/submit/call-inputs/body/filters` to `/interactions/poll/response-body/submittedFilters`,
  with `poll` naming `submit` in its temporal clause and `get-export` declaring
  `stateChangeMarker: false`.
- `gateCContract` is not satisfied on rule 5 even though O-008 witnesses the operation sibling group
  `get-export` and `list-export-rows`: the parameter group `cursor` and `limit` is a second site and
  no oracle addresses either parameter.
- `gateCContract` is not satisfied on rule 1, and the deciding site is `submit-export`, the first
  operation in the flattened inventory. No oracle addresses `/interactions/submit/response-body/state`
  or `/interactions/malformed-submit/response-body/state` in either channel, so the loop returns
  there and the emitted reason names `submit-export`. Had the loop reached `get-export`, that
  operation would have failed too: O-002 pairs `/state` with the transport status, which carries no
  channel role, and O-003 carries three roled pointers with no indicator among them. The rule is
  satisfied by one oracle, never by an ensemble of two.
- `gateCContract` is not satisfied on rules 4 and 6 because `submit-export` and `get-export` both
  declare `collectionLocations: null`. Story 5.1's Decision 5 predicted exactly these two cells.

### AC 8: Fixtures and tests

Fixtures 59 through 129 live in `tests/coverage/satisfaction.test.ts`; 130 and 131 are appended to
`tests/coverage/rules.test.ts`.

Every per-rule fixture clones `satisfiedContract` unless it names another base, and applies the
fewest mutations its stated shape needs. `satisfiedContract` is the only base on which a positive
and its paired negative are one mutation apart.

**A fixture that cannot fail is a defect.** Story 5.1's review found two, and a review of this
story's own first draft found four more (the ones now numbered 89, 97, 100, and 127). Where a
fixture asserts `satisfied: true`, assert the `reason` as well, because `satisfied` alone cannot
tell a witnessed rule from a rule that stopped having any site to witness.

Whole-contract:

59. `evaluateSatisfaction(EvalContract.parse(absentContract))` returns exactly seven verdicts whose
    `rule` values equal `DISCIPLINE_RULES` element by element, in order.
60. `absentContract`: the seven `satisfied` values equal AC 7's column, asserted as one array.
61. `explicitlyEmptyContract`: the same, against its column.
62. `populatedContract`: the same, against its column.
63. `gateCContract`: the same, against its column.
64. `satisfiedContract`: the same, against its column, which is all seven satisfied.
65. Every verdict's `predicate` equals `satisfactionPredicateId(verdict.rule)`, imported from
    `rules.ts` rather than re-spelled, over all five contracts.
66. Every verdict's `reason` is a non-empty string, over all five contracts.
67. **The agreement invariant.** For all five contracts and all seven rules, pairing
    `evaluateRelevance` and `evaluateSatisfaction` index by index: a rule that is not relevant is
    satisfied. This is the drift check Decision 11 substitutes for a shared site module, and it
    fails the moment satisfaction's site enumeration and relevance's short-circuit disagree.
68. Every verdict that is satisfied while its rule is not relevant carries exactly
    `NO_RELEVANT_SITE`, imported from `satisfaction.ts` rather than re-spelled; and every verdict
    that is satisfied while its rule is relevant carries something else. Over all five contracts.

Declaration scope, proved by mutation. Each asserts seven verdicts deep-equal to the unmutated
`satisfiedContract` run:

69. `waivers: []` and `rubrics: []`. Both are real mutations: `satisfiedContract` declares W-001 and
    R-001. A waiver names an AD-20 rule and excuses a recorded gap, a rubric criterion carries an
    evidence pointer, and no predicate reads either.
70. Every `behaviors[].severity` rewritten, walking all three members of `SEVERITY_LEVELS` imported
    from `src/core/schemas/eval-contract.ts`. Severity routes a gap under AD-21 and never decides
    satisfaction.
71. Every `oracles[].commentary`, `direction.scope`, and `direction.negativeDomain` rewritten to
    other prose. AD-3 makes all three evaluator-facing and exempt from the alignment predicate, and
    Decision 15 keeps them out of satisfaction too.
72. Every `oracles[].polarity` and `direction.polarity` flipped to `expects-violation`. Polarity
    disagreement between the two channels is `direction-check-misaligned`'s, and satisfaction reads
    neither polarity nor relation.
73. Every `direction.relation` rewritten to `equality`. Same reason as 72, asserted separately
    because relation and polarity are different fields of AD-31's own sentence.

Purity, totality, and the empty inventory:

74. Two independent `EvalContract.parse` calls on `satisfiedContract` produce deep-equal verdict
    arrays, every `reason` included; and a `structuredClone` of one parsed contract is
    `toStrictEqual` the contract after `evaluateSatisfaction` ran against it, so a predicate writing
    to its input fails here.
75. `Object.keys(SATISFACTION_PREDICATES)` equals `DISCIPLINE_RULES` as a set, so no predicate is
    orphaned and none is missing. This lives in `satisfaction.test.ts` with the map it guards, the
    one deliberate crossing of the mirror rule.
76. `satisfiedContract` with `permittedInterfaces[0].operations` set to `[]`: rules 1, 2, 3, 4, 6,
    and 7 are all not satisfied and each `reason` equals `NO_OPERATION_WITNESS`, imported rather
    than re-spelled; rule 5 reads `siblingGroups` alone and stays satisfied. Without this fixture
    the `operations.length === 0` guard opening six predicates never executes and the exported
    constant is never asserted, since all five whole-contract fixtures declare at least one
    operation. This is the satisfaction twin of Story 5.1's fixture 52, and Story 5.1's Decision 10
    is what makes rule 5 independent of the inventory.

Rule 1, success-indicator-separation:

77. `satisfiedContract` unchanged: rule 1 satisfied, `reason` the witnessed one. The positive
    isolate.
78. `create-thing.successIndicator: null`: not satisfied, `reason` naming `create-thing` and the
    missing indicator.
79. `create-thing.channelRoles: null`: not satisfied, `reason` naming the channel roles.
80. `create-thing.channelRoles` reduced to `{ '/ok': 'success-indicator' }`: satisfied, `reason`
    the witnessed one. `create-thing` stops being a site and `list-things` is still witnessed.
    Paired with 78 and 79, this pins "not a site" against "a site with no witness", which is the
    distinction the whole quantifier turns on.
81. The same, plus `list-things.channelRoles` reduced to `{ '/items': 'collection' }`: satisfied,
    `reason` equal to `NO_RELEVANT_SITE`. Neither operation is a site. Paired with 80, this is rule
    1's zero-site case, and it is what fails if the `sites` counter is dropped.
82. `create-thing.channelRoles` set to `{ '/ok': 'success-indicator', '/id': 'success-indicator' }`:
    not satisfied. Relevance fires because a second pointer carries a role; nothing can witness
    because no roled pointer is anything other than an indicator. Decision 7's permanent-gap shape.
83. O-002's `direction.evidenceTargets` reduced to the indicator alone, its check unchanged: not
    satisfied. Pins the direction half of AD-20's "in both channels".
84. O-002's check replaced by `existence` over `/interactions/create/response-body/ok` alone, its
    direction unchanged with all three targets: not satisfied. The indicator is in both channels and
    neither other roled pointer is in the check. Pins the check half. Paired with 83. Reducing the
    check to `all` over the `ok` and `id` operands instead would leave the rule satisfied, since
    `/id` carries the `payload` role and would witness it.

Rule 2, whole-body:

85. `satisfiedContract` unchanged: rule 2 satisfied, `reason` the witnessed one.
86. `create-thing.requiredKeys` reduced to `['ok']`: satisfied, `reason` equal to
    `NO_RELEVANT_SITE`. One distinct key on both operations means no site. Paired with 85, this pins
    the site boundary at `> 1` against `>= 1`.
87. O-002's direction and check both dropping the `/interactions/create/response-body/id` operand:
    not satisfied, `reason` naming `create-thing`. The denominator is the required-key set.
88. `create-thing.permittedKeys` extended with `note`, `requiredKeys` unchanged: satisfied, `reason`
    the witnessed one. AD-20 says coverage is never computed against permitted keys.
89. `create-thing.requiredKeys: ['ok', 'ok']`: satisfied, `reason` equal to `NO_RELEVANT_SITE`. One
    key repeated is one pointer, so the operation is not a site. This is the fixture that fails if
    the `new Set` is dropped from `required`: two entries would make the operation a site again and
    the reason would become the witnessed one. `['id', 'ok', 'id']` would not fail under that
    regression, because `every` still passes over a duplicated key.
90. O-002 split into two oracles, one whose direction and check carry
    `/interactions/create/response-body/ok` alone and one whose direction and check carry
    `/interactions/create/response-body/id` alone: not satisfied, `reason` naming `create-thing`.
    Decision 6's single-oracle reading, and the only fixture that pins it: under a relaxed reading
    where each key may be covered by a different oracle, this contract satisfies rule 2.
91. Both steps invoking `create-thing` removed from the plan, with `list.after` set to `null` so the
    plan stays coherent: not satisfied, `reason` naming `create-thing`. An operation no step invokes
    has no addressed step to be covered at.
92. O-002's `ok` operand and direction target deepened to
    `/interactions/create/response-body/ok/inner`: satisfied, `reason` the witnessed one. A pointer
    that descends into a required key addresses it (Decision 5).

Rule 3, malformed-input:

93. `satisfiedContract` unchanged: rule 3 satisfied, `reason` the witnessed one.
94. `malformed-create`'s body binding changed to `{ matcher: 'any' }`: not satisfied, `reason`
    naming `create-thing`. Paired with 93, this pins the matcher value.
95. O-004's two operands both re-pointed at `malformed-list`
    (`/interactions/malformed-list/response-body/error` and
    `/interactions/malformed-list/response-body/items`), the plan unchanged: not satisfied, `reason`
    naming `create-thing`. Pins "some check addresses that step".
96. All four request channels of both operations emptied: satisfied, `reason` equal to
    `NO_RELEVANT_SITE`.
97. `create-thing.requestShape.body` replaced by a channel whose `requiredKeys` and `permittedKeys`
    are empty and whose `types` is `{ name: 'string' }`, **and** all four of `list-things`'s
    channels emptied: rule 3 satisfied with the witnessed `reason`. `create-thing` is then the only
    site, and it is a site only because `declaresRequestKey` reads `types` as well as the two key
    lists, matching Story 5.1's Decision 7. Emptying `list-things` is what makes this fixture able
    to fail: leaving it declared, the rule stays satisfied through `list-things` even when the
    `types` clause is dropped.

Rule 4, per-record:

98. `satisfiedContract` unchanged: rule 4 satisfied, `reason` the witnessed one.
99. `create-thing.collectionLocations: null`: not satisfied, `reason` naming `create-thing`. The
    absent site, paired with 98, whose `[]` is the explicit empty answer.
100. O-007's `collection` deepened to `/interactions/list/response-body/items/page`, the declared
     location still `/items`: not satisfied. A quantifier ranging over something inside the declared
     collection is not ranging over the collection. This fails if the comparison is relaxed from
     equality to `addresses(node.collection, collection)`.
101. `list-things.collectionLocations[0].pointer` deepened to `/items/rows`, O-007 unchanged: not
     satisfied. The mirror of 100, and it fails if the comparison is relaxed the other way, to
     `addresses(collection, node.collection)`. Both directions need a fixture; a disjoint pointer
     catches neither.
102. `list-things.collectionLocations[0].pointer` changed to `/other`, O-007 unchanged: not
     satisfied. The disjoint negative, kept because it is the shape an author actually produces.
103. O-007's `op` changed from `for-all` to `for-any`: satisfied, `reason` the witnessed one.
     Decision 10 admits both.
104. O-007 replaced by `existence` over `/interactions/list/response-body/items`: not satisfied. A
     pointer at a collection is not a quantifier over it. Paired with 103.
105. Both operations set to `collectionLocations: []`: satisfied, `reason` equal to
     `NO_RELEVANT_SITE`.

Rule 5, sibling-cross-check:

106. `satisfiedContract` unchanged: rule 5 satisfied, `reason` the witnessed one.
107. `siblingGroups.parameters: []`, operations unchanged: satisfied, `reason` the witnessed one.
     One site, witnessed by O-004.
108. `siblingGroups.operations: [['create-thing', 'create-thing']]`: not satisfied. Members are
     deduplicated before counting, so one operation named twice is one member (Decision 14). This
     fixture fails if the dedupe is dropped.
109. `direction.evidenceTargets: []` on O-004, O-005, and O-006, every check unchanged: not
     satisfied, `reason` naming the operation group. Those three are the only oracles whose targets
     span a step of each operation, which the fixture's own comment must state: reducing O-004
     alone leaves the group witnessed by O-005 and O-006. Pins the check-side conjunct of
     `bothChannelsAddress` for rule 5.
110. O-005 removed from the oracle list: not satisfied, `reason` naming the parameter group. Pins
     the parameters axis as a site of its own, which fixture 107 would otherwise hide. O-006 carries
     `name` but no oracle carries `limit`, so the group falls one member short.
111. `siblingGroups: null`: not satisfied, with the absent-declaration reason.
112. `siblingGroups: { operations: [], parameters: [] }`: satisfied, `reason` equal to
     `NO_RELEVANT_SITE`. Paired with 111.

Rule 6, omission-and-completeness:

113. `satisfiedContract` unchanged: rule 6 satisfied through O-001's bijection against an `exact`
     cardinality, `reason` the witnessed one.
114. `list-things.collectionLocations[0].expectedCardinality` changed to
     `{ mode: 'page-bounded', max: 20 }`, O-001 unchanged: not satisfied. Paired with 113, this pins
     the mode branch: the bijection stops satisfying the moment the collection is a page.
115. The same `page-bounded` mutation, plus O-001's check replaced by
     `for-all` over `/interactions/list/response-body/items` whose predicate is
     `set-membership` with operands `[{ pointer: '@/id' }, { referenceSet: 'expected-things' }]` and
     whose direction relation is `for-all`: satisfied, `reason` the witnessed one. The injection
     form, with `@/` substitution proved on the way.
116. The same, with `{ mode: 'at-most', max: 20 }`: satisfied, `reason` the witnessed one. Pins the
     third mode onto the same branch as `page-bounded`.
117. The injection form of 115 against the unchanged `exact` cardinality: not satisfied. The mirror
     of 114, so neither form is accepted for both modes.
118. O-001's reference-set operand renamed to `expected-other`, an identifier the contract's
     `referenceSets` does not declare, the location still naming `expected-things`: not satisfied. A
     name that resolves to nothing reconciles nothing.
119. The injection form of 115 with its set operand replaced by
     `{ literal: ['t-1', 't-2', 't-3'] }`: not satisfied. AD-26 admits a literal set operand, and
     rule 6 requires the declared reference set.
120. `list-things.collectionLocations[0].referenceSet: null`: satisfied, `reason` equal to
     `NO_RELEVANT_SITE`. `create-thing`'s `[]` contributes no site either.
121. `create-thing.collectionLocations: null`: not satisfied, `reason` naming `create-thing`. Rule
     6's own absent site, distinct from rule 4's fixture 99 in its reason text.

Rule 7, state-change-read-back:

122. `satisfiedContract` unchanged: rule 7 satisfied, `reason` the witnessed one.
123. `list.after: null`: not satisfied. Without the temporal clause the later step is not a
     read-back. Paired with 122.
124. `list-things.stateChangeMarker: true`: not satisfied, `reason` naming `create-thing`. A
     read-back through a step that changes state proves nothing.
125. O-006's `containment` replaced by
     `all([existence(/interactions/create/call-inputs/body/name), existence(/interactions/list/response-body/items)])`:
     not satisfied. The same two pointers, split across two nodes. Decision 9's one-node reading, and
     the fixture that fails if the relation is read over a whole check tree.
126. `create-thing.stateChangeMarker: false`: satisfied, `reason` equal to `NO_RELEVANT_SITE`.
127. `create-thing` moved into a second `permittedInterfaces` entry of its own, the plan unchanged:
     satisfied, and `reason` equal to the witnessed string rather than `NO_RELEVANT_SITE`. The
     reason assertion is the whole point: without it the fixture passes when `operationsOf` reads
     only the first interface, because `create-thing` then vanishes from the inventory and the rule
     answers satisfied for having no site at all. Pins the flatMap across interfaces, matching
     relevance fixture 51.

Fixture quality:

128. `compile(EvalContract.parse(satisfiedContract), { strict: false })` returns without throwing,
     so every satisfaction verdict in AC 7's last column rests on a contract the compiler accepts.
129. `evaluateRelevance(EvalContract.parse(satisfiedContract))` answers relevant on all seven, so
     the all-satisfied column is a genuine all-relevant-and-satisfied row.

`tests/coverage/rules.test.ts`, appended:

130. `satisfactionPredicateId` maps the seven rules to seven distinct identifiers, asserted against
     a literal array the way fixture 57 asserts the relevance identifiers. A re-derived assertion
     would hold for any suffix, which is what review finding 2 caught on Story 5.1.
131. No relevance identifier equals any satisfaction identifier, so a `CoverageGap`'s
     `relevancePredicate` and `satisfactionPredicate` can never carry the same string for one rule.

### AC 9: The gate

`npm run validate` passes end to end, including `check:layers` reporting 57 files scanned with zero
violations, up from the baseline 56. `npm run build` passes separately, since `validate` does not
build.

No new dependency, no change to `package.json`, no change to `schemas/`, no change to
`FAILURE_CODES` or `RUNTIME_FAULT_CODES`, so `check:schemas`, `check:ad5-registry`, and
`check:ad28-registry` must report the Story 5.1 baseline unchanged: 12 schema files, 21 codes, and
10 codes. `check:docs` stays at 55: its ROOTS are `README.md`, `_bmad-output/planning-artifacts`,
`_bmad-output/project-knowledge`, and two `experiments/` files, so this story file adds nothing to
it and Task 9's learning-path edit adds no file.

`vitest run` reports 52 test files, up from 51 by `tests/coverage/satisfaction.test.ts`, and 2055
tests, up from 1982 by this story's 73 fixtures. That arithmetic holds only under the one-`it`
rule in the Testing requirements below; a different total is a finding, and every delta must be
attributed to a named fixture before it is accepted.

## Tasks / Subtasks

- [x] Task 1: Preflight the baseline (AC 9)
  - [x] Confirm a clean working tree at `5613db6` with no untracked
        `src/core/coverage/satisfaction.ts` or `tests/coverage/` additions left from story creation.
  - [x] Record the baseline: `check:layers` 56 files 0 violations, `check:docs` 55 files,
        `check:schemas` 12, `check:ad5-registry` 21 codes, `check:ad28-registry` 10 codes,
        `vitest run` 51 files / 1982 tests. All six were measured at `5613db6` during story creation
        and re-confirmed during story review; confirm rather than assume.
- [x] Task 2: `src/core/coverage/rules.ts` (AC 2)
  - [x] Append `satisfactionPredicateId`. Change nothing above it.
- [x] Task 3: `src/core/coverage/satisfaction.ts` (AC 3, AC 4, AC 5)
  - [x] Transcribe AC 3, AC 4, and AC 5's code blocks in that order into one file.
  - [x] The AC blocks were run through `biome check` during story review and are in Biome's format
        and import order. If `biome check --write` still changes anything, treat the change as a
        finding and record it.
  - [x] Comments in the AC blocks are already pruned and de-AI'd to this repository's standard.
        Transcribe them as written; if one still reads as machine-written, fix it and record the
        deviation the way Story 5.1's Dev Agent Record records its four.
- [x] Task 4: `tests/coverage/fixtures/satisfaction-contracts.ts` (AC 6)
  - [x] Transcribe the fixture, then assert it parses before writing any predicate assertion
        against it. A `satisfies EvalContract` annotation catches most of it at typecheck time.
- [x] Task 5: `tests/coverage/satisfaction.test.ts` (AC 8 fixtures 59 through 129)
  - [x] One `it` per numbered fixture, the fixture number opening the test name.
- [x] Task 6: `tests/coverage/rules.test.ts` (AC 8 fixtures 130 and 131)
- [x] Task 7: Prove the fixture list is not passing vacuously
  - [x] Introduce each of these regressions against the finished predicates, confirm it fails the
        fixtures named beside it, and revert it. Record the result in the Dev Agent Record. The
        mapping below was measured during story review by running the whole fixture list against
        each regression, so a regression that fails a different set is itself a finding.
    - `bothChannelsAddress` reduced to the direction conjunct alone: 84.
    - `bothChannelsAddress` reduced to the check conjunct alone: 83, 109.
    - Rule 1's `others` filter dropping the `role !== 'success-indicator'` clause: 82.
    - Rule 2's `required` computed from `permittedKeys` as well: 86, 88.
    - Rule 2's `new Set` removed from `required`: 89.
    - Rule 2's witness relaxed so each key may be covered by a different oracle: 90.
    - Rule 3's `declaresRequestKey` dropping the `Object.keys(shape.types).length > 0` clause: 97.
    - Rule 4's `node.collection === collection` relaxed to `addresses(node.collection, collection)`:
      100.
    - The same relaxed to `addresses(collection, node.collection)`: 101.
    - Rule 6's mode branch inverted: 113, 114, 115, 116, 117.
    - Rule 7's `relates` computed over every pointer in the check rather than one node: 125.
    - The sibling-group dedupe removed: 108.
    - `operationsOf` reading only `permittedInterfaces[0]`: 127.
    - The `operations.length === 0` guard removed from any of the six predicates that open with it:
      76.
    - Any rule's `sites` counter removed, so a zero-site rule returns its witnessed reason: 68, and
      the rule's own zero-site fixture — 81 for rule 1, 86 for rule 2, 96 for rule 3, 105 for rule
      4, 112 for rule 5, 120 for rule 6, 126 for rule 7.
- [x] Task 8: Run the gate (AC 9)
  - [x] `npm run validate`, then `npm run build`.
  - [x] Record the new counts and attribute every delta to named fixtures.
- [x] Task 9: Close out
  - [x] Fill the Dev Agent Record: model, debug log, completion notes, file list.
  - [x] Once the implementation is green and the peer review's findings are addressed, add Step 17
        `(epic5-story2)` to `_bmad-output/project-knowledge/learning-path-step-by-step.md` following
        `learning-path-template.md`'s exact shape, plus one row appended to the table, after the
        Step 16 row at line 59.
  - [x] Set `sprint-status.yaml`'s `5-2-the-seven-satisfaction-predicates` to `review` when handing
        off for code review, and to `done` on merge. `epic-5` is already `in-progress`.

## Decisions taken during story creation

Each is settled with a stated default and its downstream consequence. Per this project's standing
convention, settle ambiguities in the story or the code, record the reasoning, and do not escalate
to a new architecture revision. Proceed unless the user amends one; record the outcome in the Dev
Agent Record.

The governing texts are the Gate C table (`.../reviews/gate-c/FINDINGS.md` lines 51-64 for the
first-pass rows and line 131 for the second-pass rule 2 row), AD-20's operation-scoped denominator
paragraph (`ARCHITECTURE-SPINE.md:357-360`), AD-31 (`447-456`), and Story 5.1's Decision 5, which
binds this story by name.

1. **The module is `src/core/coverage/satisfaction.ts`, beside `relevance.ts`.** Story 5.1's
   Decision 1 settled the directory and named this file as the second of three. Considered and
   rejected: one `coverage.ts` holding both halves. Rejected because relevance is 314 lines and
   satisfaction is longer, and a single file would put fourteen predicates and two tree walks behind
   one import. **Consequence:** Story 5.3's table generator is the third file in the same directory.

2. **Satisfaction is universal over the sites a rule is relevant for, and existential over
   oracles.** Story 5.1's Decision 5 states the requirement verbatim: "satisfaction must hold for
   every operation the rule is relevant for", because a contract-level existential lets one
   well-declared operation discharge another's under-declaration. The Gate C rows are existential
   over oracles ("some oracle's direction targets..."), and rule 2's second-pass row is already
   universal ("for every addressed interaction-plan step"). The two compose: for every site, some
   oracle witnesses it. Considered and rejected: reading every Gate C row as a bare contract-level
   existential. Rejected because that is the fail-open direction AD-31 names in its own Prevents.
   **Consequence:** the sites are per-rule and finer than "operation" for two of them. Rules 1, 2,
   3, and 7 site on an operation; rules 4 and 6 site on a declared collection location, plus the
   absent-list operation; rule 5 sites on a declared sibling group. Fixture 67 pins that the site
   sets agree with relevance on emptiness.

3. **A rule with no site is satisfied vacuously, and `NO_RELEVANT_SITE` says so in the reason.** A
   universal over the empty set holds. AD-31 defines a coverage gap as relevant and not satisfied,
   so a vacuous truth on an irrelevant rule produces no gap and changes nothing downstream.
   Considered and rejected: returning `satisfied: false` when the rule is irrelevant, on the grounds
   that nothing was proved. Rejected because Story 5.3's gap record is the conjunction, and a false
   here would make every irrelevant rule read as a near-gap in the published table. **Consequence:**
   `satisfied` alone is never the whole answer; the pair is. Fixture 68 pins that the vacuous
   reason and a witnessed reason are distinguishable, so a reader of the table can tell them apart
   without recomputing relevance, and every `satisfied: true` fixture in AC 8 asserts its reason for
   the same purpose.

4. **An empty operation inventory is an absent site for the six operation-scoped rules.** Story
   5.1's Decision 10 made it relevant with `NO_OPERATION`; this story makes it unsatisfiable with
   `NO_OPERATION_WITNESS`. Considered and rejected: treating an empty inventory as zero sites, so
   the rules answer satisfied vacuously. Rejected because that reproduces AD-31's stated Prevents at
   one remove: a contract declaring almost nothing would score clean on the gap conjunction.
   **Consequence:** the two constants are separately exported so fixtures import them rather than
   re-spell them, and Story 5.3 can tell an empty-inventory gap from a declared-absence gap. Fixture
   76 is the only fixture that reaches this branch, since every whole-contract fixture declares at
   least one operation.

5. **The two pointer spellings join by string concatenation, and "addresses" means names it or
   descends into it.** A declared pointer is descriptor-relative (`/state`) and an evidence target is
   interaction-rooted (`/interactions/poll/response-body/state`). Both use RFC 6901 token escaping,
   so `/interactions/{stepId}/response-body` prefixed onto the descriptor pointer is the exact
   rooted spelling with no re-encoding. Considered and rejected: parsing every target through
   `parseEvidenceTarget`. Rejected because it throws `TypeError` on a pointer the grammar does not
   accept, which Decision 11 of Story 5.1 forbids in this module, and because the concatenation is
   total. **Consequence:** a target one level deeper than a declared pointer counts as addressing
   it, which fixture 92 pins; a bare `/interactions/{stepId}/response-body` therefore addresses the
   whole body, which is RFC 6901's own meaning for the empty descriptor pointer. Rule 4 is the one
   place this relation is deliberately not used: a quantifier's collection must equal the declared
   location, and fixtures 100 and 101 pin both directions of that.

6. **Rule 2's whole-body oracle is identified by the coverage it achieves, and per-key coverage
   never reads a `shape` descriptor.** AD-20 scopes rule 2 to "every interaction-plan step addressed
   by a whole-body oracle", and no declaration says which oracle is a whole-body oracle:
   `oracles[].rule` was deleted precisely so no predicate reads an author's own label
   (`tests/schemas/fixtures/gate-c-contract.ts:34-39`). The predicate therefore asks whether some
   **single** oracle covers every required key at some step invoking the site operation, which makes
   the oracle whole-body by demonstration. Considered and rejected, first: quantifying over every
   oracle and every step it addresses, so any oracle touching a step owes that step's whole body.
   Rejected because a two-line diagnostic oracle would then make rule 2 a gap on every contract with
   more than one oracle. Considered and rejected, second: allowing the required keys to be covered
   by different oracles between them. Rejected because AD-20 says the direction and check of *an*
   oracle cover the body, and an ensemble reading lets a contract satisfy whole-body coverage
   without any one oracle ever reading the whole body. Considered and rejected, third: reading a
   `shape` node's own `descriptor.requiredKeys` as covering those keys. Rejected because the
   direction channel carries no descriptor and AD-20 requires coverage in both channels, so
   accepting a descriptor on the check side alone would let the two channels disagree about what is
   covered, which is the drift `direction-check-misaligned` exists to keep representable.
   **Consequence:** an author who reads the whole body with one `shape` node satisfies AD-4 and not
   this predicate, and must also name the keys as direction targets. That cost is stated rather than
   smoothed over, and fixture 88 records the compensating half: permitted keys are never in the
   denominator. Fixture 90 is the single-oracle pin. This also closes Story 5.1's Decision 6, which
   handed two open cases here: fixture 52's empty inventory is Decision 4 above, and fixture 24's
   `requiredKeys: []` is not a rule 2 site at all, so neither produces a relevant rule 2 with an
   empty denominator. The Gate C `underspecified` row for rule 2 satisfaction is closed by the
   second-pass table and by this predicate.

7. **Rule 1's witness needs a roled pointer whose role is something other than
   `success-indicator`, which is narrower than its own relevance site.** The Gate C row says exactly
   that, and AD-20 rule 1 is about separating the indicator from the body's content. Story 5.1's
   Decision 14 made relevance fire on any other pointer carrying any role, which is deliberately
   wider. Considered and rejected: narrowing relevance to match, or widening satisfaction to match.
   Rejected in the first direction because Story 5.1 is shipped and its fixtures 16 and 17 pin the
   wider reading; rejected in the second because a descriptor marking two pointers as
   indicator-bearing has separated nothing. **Consequence:** an operation whose only other roled
   pointers are themselves indicators is a permanent gap. Fixture 82 pins it, and if a later story
   decides that shape should be irrelevant instead, this decision is what it supersedes.

8. **Rule 5's parameter members are witnessed through `call-inputs`, and its two axes are separate
   sites.** AD-19 declares sibling groups "over parameters and operations"; a parameter is a request
   input, so it is addressed as `/interactions/{stepId}/call-inputs/{channel}/{parameter}` on any of
   the four transport channels. Considered and rejected: also accepting a response-body pointer
   whose first token equals the parameter name. Rejected because a response key and a request
   parameter sharing a name is a coincidence, and reading it would let an unrelated oracle discharge
   the group. **Consequence:** `gateCContract` is a rule 5 gap on its `cursor` and `limit` group
   even though its operation group is witnessed, which fixture 110 pins in the fixture contract and
   AC 7's Gate C column records.

9. **Rule 7's two pointers must be operands of one expression node.** The Gate C row says a check
   "relates" a call-inputs pointer to a response-body pointer, and O-001 spells that as one
   `deep-equality` with the two pointers as its two operands. Considered and rejected: both pointers
   appearing anywhere in one check tree. Rejected because `all([existence(input), existence(output)])`
   asserts two facts and relates them to nothing, which is the "satisfiable by reading nothing"
   shape AD-31 names. **Consequence:** an author must write the read-back as a comparison. Fixture
   125 is the split-node negative, and it is the fixture that fails if the relation is computed over
   a whole tree.

10. **Rule 4 admits either quantifier; rule 6's injection form requires `for-all`.** The Gate C rule
    4 row says "a quantifier", and the only hand-authored rule 4 oracle is
    `not(for-any(page, existence(@/retractedAt)))`, the idiomatic spelling of "no element carries a
    retraction". The Gate C rule 6 row says "a quantifier over the page whose predicate is
    `set-membership`", and the injection property is that every element of the page is a member, so
    `for-any` there certifies on one matching element. Considered and rejected: requiring `for-all`
    for rule 4. Rejected because it fails O-004, the only real rule 4 oracle in the repository.
    **Consequence:** rule 4 is satisfiable by a bare `for-any` spot-check, which fixture 103 pins as
    intended rather than as an oversight, and rule 6 is not, which fixture 115's `for-all` and
    `reconciles`'s explicit `op !== 'for-all'` guard pin.

11. **`relevance.ts` is unchanged, and the agreement between the two site notions is pinned by
    fixture 67 rather than by shared code.** Satisfaction needs a per-site enumeration; relevance
    short-circuits on the first site it finds and returns one contract-level verdict with that
    site's reason. Considered and rejected: extracting a shared `sites.ts` that both import, so
    there is exactly one definition. Rejected because relevance's reason strings are asserted
    verbatim by nine of Story 5.1's fixtures and its short-circuit order is load-bearing in three
    more, so the refactor risks 58 shipped fixtures to remove a duplication that a single invariant
    test detects. **Consequence:** fixture 67 asserts, over every contract in the repository, that a
    rule which is not relevant is satisfied, which is exactly the statement "the site sets agree on
    emptiness". The one place the two spellings differ is rule 3, where relevance reads
    `requiredKeys[0] ?? permittedKeys[0] ?? Object.keys(types)[0]` and satisfaction runs three
    `.length > 0` tests; they are equivalent, and fixture 97 is what pins the `types` limb on the
    satisfaction side. Story 5.3 extends the same assertion over its corpus, at which point the
    invariant is checked against twenty-eight more contracts and the case for extraction can be
    re-made on evidence.

12. **Nothing is wired into `compile`, `src/index.ts`, or a `CoverageGap` record.** `CoverageGap`
    requires a `severity`, and no declaration maps an AD-20 rule to one; Story 5.3's own `Then`
    clause owns the gap record and the emitted table. Considered and rejected: adding an
    `evaluateCoverage` that pairs the two verdict arrays now. Rejected because the pairing is one
    line and the record it feeds needs a severity decision this story would have to invent.
    **Consequence:** the fourteen predicates are reachable only from tests until Story 5.3 wires
    them, which is the position `evaluatePointerReachability` held between Stories 4.1 and 4.4 and
    the position the relevance predicates hold today.

13. **`buildPlanIndex` is reused with `duplicateIds: 'unresolved'`.** Story 5.1's Dev Note 6
    declined it because relevance reads no step and because the default option throws on a
    schema-legal duplicate identifier. Both reasons are gone here: satisfaction reads the plan by
    definition, and `'unresolved'` was added in Story 4.2's own deferred-work closure precisely so a
    non-throwing caller exists. Considered and rejected: a local step-to-operation map. Rejected
    because `stepsUsing` and the duplicate handling are already proven by
    `tests/seal/plan-index.test.ts`. **Consequence:** a contract with two operations sharing an
    identifier resolves that identifier to nothing, so rule 7 cannot witness through it and the rule
    fails closed.

14. **Sibling group members are deduplicated before counting.** `SiblingGroups` enforces a minimum
    of two members per group and no uniqueness, so `['create-thing', 'create-thing']` parses.
    Counting witnessed members without deduplication would let one operation satisfy the minimum
    twice. Considered and rejected: refining the schema to require distinct members. Rejected
    because no AD-5 code names that contradiction, which is Story 4.2's Decision 3 applied here: a
    schema tightened past a code does not make the product safer. **Consequence:** fixture 108 is
    the negative that fails if the dedupe is dropped, and rule 2's `requiredKeys` distinctness is
    the same reading applied to a different list, pinned separately by fixture 89.

15. **Satisfaction reads no polarity, no relation, no commentary, no scope, no negative domain, no
    waiver, no rubric, and no severity.** AD-31's own sentence says "the rule's required evidence
    targets, relation, and polarity must appear in both channels", which describes the general shape
    of a satisfaction predicate; the Gate C second-pass table then supplies each rule's actual
    content, and not one of the fourteen rows names a relation or a polarity. Considered and
    rejected: additionally requiring each rule's relation to appear in the check. Rejected because
    no row states which relation each rule requires, so implementing it would mean inventing seven
    mappings the architecture does not carry, and because `checkOracleAlignment` already fails
    compilation when the direction's declared relation is absent from the check or its polarity
    disagrees with the oracle's, so the residue AD-31's sentence names is enforced as a blocking
    code one stage earlier. **Consequence:** fixtures 69, 71, 72, and 73 prove the exempt channels
    by mutation, the way Story 5.1's fixtures 8 through 12 proved oracle-blindness for relevance,
    and `satisfiedContract` carries a rubric so fixture 69's rubric half is a real mutation.

## Dev Notes

### Read these files before writing anything

1. `.../reviews/gate-c/FINDINGS.md` lines 49-64 and 118-146: the fourteen-predicate table and the
   second pass. Lines 52, 54, 56, 58, 60, 62, and 64 are the seven satisfaction rows this story
   implements; line 131 is the second-pass rule 2 row that replaced the first pass's
   `underspecified` one. Every predicate in AC 4 and AC 5 is one of those rows made total.
2. `ARCHITECTURE-SPINE.md` AD-31 (447-456): satisfaction is a comparison of two declared structures;
   a coverage-gap record names the relevance predicate that fired and the satisfaction predicate
   that failed; under-declaration costs coverage.
3. `ARCHITECTURE-SPINE.md` AD-20 (351-360), especially the operation-scoped denominator paragraph at
   357-360 and the rule 6 sentence naming the bijection and the injection.
4. `ARCHITECTURE-SPINE.md` AD-39 (503-513): the `type-violating` matcher, the tagged binding value,
   and the one-level temporal clause. Rules 3 and 7 read both.
5. `ARCHITECTURE-SPINE.md` AD-26 (394-404): the addressing grammar, the reference-set operand's
   three legal positions, and the paragraph explaining why the injection form exists for a page.
6. `5-1-the-seven-relevance-predicates.md` in full, and especially Decision 5, which states this
   story's quantifier, and Decision 6, whose two open cases Decision 6 above closes.
7. `src/core/coverage/relevance.ts` in full: the site conditions this story's predicates must match
   exactly, function by function. Fixture 67 fails the moment one of them drifts.
8. `src/core/schemas/oracle.ts` in full: `Direction`'s five fields and which two are exempt from
   alignment.
9. `src/core/schemas/expression.ts` lines 138-186 and 291-419: `TUPLE_ARITY`, the sixteen-branch
   `Expression` type, and the operand shape of `set-membership`, `covers-by-key`, `for-all`, and
   `for-any`.
10. `src/core/schemas/plan.ts` in full: `BindingValue`, `InputBinding`'s four nullable channels, and
    `InteractionStep.after`.
11. `src/core/schemas/pointer.ts` lines 12-43 and 73-123: the three pointer spellings, the seven
    evidence channels, and the four transport channels. The join in AC 3 rests on
    `DescriptorPointer` and `InteractionPointer` sharing RFC 6901 token escaping.
12. `src/core/schemas/interface.ts` lines 19-69: `ExpectedCardinality`'s three modes,
    `CollectionLocation`, and `ResponseDescriptor`.
13. `src/core/compile/oracle-alignment.ts` in full: `substitutePointer`, which this story imports,
    and `collectTargets`, the private walk this story's `walkCheck` deliberately does not reuse.
14. `src/core/compile/reachability.ts` lines 21-112: the second private tree walk, and the reason
    `set-membership`'s second operand is skipped there.
15. `src/core/seal/plan-index.ts` lines 128-232: `PlanIndex`, `buildPlanIndex`, and the
    `duplicateIds` option Decision 13 selects.
16. `tests/schemas/fixtures/gate-c-contract.ts` in full: the only contract hand-authored against
    revision 9, its eight oracles, and its six-step plan. AC 7's Gate C column is derived from it
    cell by cell.
17. `tests/coverage/relevance.test.ts` in full: house style for this directory, the
    `mutantOf`/`parsedMutant` helpers, and the `structuredClone` aliasing note that still applies.

### Previous-story intelligence

1. Story 5.1's review took nine findings in round one and seven more in round two, and the pattern
   across both rounds was prose about the code drifting from the code, plus fixtures that could not
   fail. This story's own creation review found four more fixtures of the second kind before a line
   was written. Three fixtures exist against that failure mode specifically: 67 (the invariant that
   fails on drift), 68 (the vacuous-versus-witnessed distinction), and Task 7's regression sweep,
   which is Story 5.1's "seven deliberate regressions" step promoted to a task with the fixture
   numbers measured in advance.
2. Story 5.1 finding 2: an assertion that re-derives its expected value from the function under test
   proves nothing. Fixture 130 carries the seven satisfaction identifiers as literals for that
   reason, and fixture 65 stays as the cross-check that a verdict carries the identifier.
3. Story 5.1 finding 4: a purity assertion over two parses cannot detect input mutation, since a
   predicate writing to its input writes to both alike. Fixture 74 clones and compares with
   `toStrictEqual`, which is finding 15's correction folded in from the start.
4. Story 4.3's Decision 7 is a standing convention: every numeric or arity comparison needs a paired
   at-bound and over-bound fixture. This story's comparisons are rule 2's `required.length <= 1`
   (fixtures 85 and 86) and rule 5's `>= SIBLING_GROUP_MINIMUM` (fixtures 106 and 108).
5. `npm run check:layers` is in `validate` as of Story 4.4. Under `core/`: no `async`, no `await`,
   no `Date`, no `Math.random`, no Node builtin, no external import. `src/core/coverage/` classifies
   as `core` and `core` may import `core`, so the three cross-directory imports in AC 3 are legal.
   Confirm with `check:layers` rather than by reading.
6. `structuredClone` preserves shared references. `tests/coverage/fixtures/satisfaction-contracts.ts`
   builds several transport channels from one `emptyChannel` object, exactly as
   `relevance-contracts.ts:8-19` does, so fixtures 96 and 97 must **replace** a channel object
   outright rather than write through it. `relevance.test.ts` already carries a local
   `emptyChannel()` factory for this; copy that pattern into `satisfaction.test.ts` rather than
   importing across test files.
7. Story 4.1's story file still carries thirteen unchecked Review Findings items, three of them
   verifiably open in `core/compile/reachability.ts` and `core/evaluate/`. This story touches
   neither, and they are noted here so the next reader finds them rather than inheriting them
   silently.
8. `deferred-work.md` carries no open items and this story opens none. If it opens one, the file's
   "no items are currently open" header prose must change with it.
9. Recent commits, for the shape of the tree this lands on: `5613db6` added the seven relevance
   predicates and `src/core/coverage/`; `430d3b7` added the orchestration layer, the two registry
   checks, and the layer gate.

### Project structure notes

New files:

- `src/core/coverage/satisfaction.ts`
- `tests/coverage/fixtures/satisfaction-contracts.ts`
- `tests/coverage/satisfaction.test.ts`

Edited files:

- `src/core/coverage/rules.ts` (one appended export)
- `tests/coverage/rules.test.ts` (fixtures 130 and 131)
- `_bmad-output/project-knowledge/learning-path-step-by-step.md` and
  `_bmad-output/implementation-artifacts/sprint-status.yaml` change in Task 9.

`src/index.ts` is not touched, matching every Epic 3, Epic 4, and Epic 5 story. `package.json`,
`schemas/`, `biome.json`, `vitest.config.ts`, both tsconfigs, and everything under `scripts/` are
unchanged. `src/core/coverage/relevance.ts` and `tests/coverage/relevance.test.ts` are unchanged.

Naming: files are kebab-case, one concern per file. Zod schemas and their inferred types share a
`PascalCase` name; `as const` tuples are `SCREAMING_SNAKE`; functions are `camelCase`. Every file
opens with a doc comment carrying the AD citation and the reason a shape was chosen, kept no longer
than the declaration it documents. Imports carry the explicit `.ts` extension and type-only imports
use `import type`, which Biome enforces as an error.

`tests/coverage/fixtures/` is a new directory. It mirrors `tests/schemas/fixtures/` and
`tests/evaluate/fixtures/`, both of which already exist, so it introduces no new convention.

### Testing requirements

- `tests/coverage/` mirrors `src/core/coverage/`. Fixture 75 is the one deliberate crossing, in the
  file that holds the map it guards, matching Story 5.1's fixture 56.
- **One `it` per numbered fixture, including the ten whole-contract fixtures that loop over five
  contracts internally.** The `it`'s body iterates; the test count does not. Use `it.each` only for
  60 through 64, which are one contract each, and even there the numbering stays one-to-one. AC 9's
  arithmetic (1982 + 73 = 2055) depends on this rule holding.
- The fixture number opens the test name.
- Whole-contract positives go through `EvalContract.parse`. A bare `as EvalContract` cast on the
  shipped fixtures does not typecheck, because they are declared `satisfies EvalContract`.
- Per-rule mutants are `structuredClone(fixture) as any` with the fewest mutations the fixture's
  stated shape needs, then re-parsed through `EvalContract.parse` so every assertion speaks about a
  contract the schema accepts.
- Every fixture asserting `satisfied: true` also asserts its `reason`, either as
  `NO_RELEVANT_SITE` or as the rule's witnessed string. Without that, a fixture passes when the
  rule stops having a site rather than when it is witnessed, which is how four of this story's
  first-draft fixtures were vacuous.
- Do not import `structuralFailureOf` from `tests/compile/helpers.ts`; nothing in `satisfaction.ts`
  throws. Fixture 128 imports `compile` directly and asserts it does not throw, which is a different
  claim about a different module.
- `any` is permitted in `tests/` and forbidden in `src/`. `it.only` and `describe.only` are lint
  errors and therefore fail `validate`.
- No configured coverage threshold, matching every prior story's own note: the proxy is AC 8's
  fixture list plus Task 7's regression sweep. Do not run `--coverage`; no provider is installed.
- A `reason` assertion on a `not satisfied` fixture should pin the substring that identifies the
  site (an operation identifier, a collection pointer, a group's members) rather than the whole
  sentence. `NO_RELEVANT_SITE` and `NO_OPERATION_WITNESS` are imported constants and asserted whole.

### References

- Epic and story text: `_bmad-output/planning-artifacts/epics.md` lines 374-376 (Epic 5 preamble)
  and 390-400 (Story 5.2 through its `Then` clause), line 27 (FR6's full statement), line 74 (FR6
  maps to Epic 5), line 14 (the spine-governs clause).
- `ARCHITECTURE-SPINE.md` AD-31 (447-456), AD-20 (351-360), AD-19 (337-349), AD-39 (503-513),
  AD-26 (394-404), AD-4 (195-212), AD-3 (175-194), AD-5 (213-251).
- Gate C: `.../reviews/gate-c/FINDINGS.md` lines 46-64 (first-pass table, its fourteen rows at
  51-64) and 126-141 (second pass, with the rule 2 row at 131).
- Schemas: `src/core/schemas/oracle.ts:1-57`, `src/core/schemas/expression.ts:11-56,138-186`,
  `src/core/schemas/plan.ts:1-70`, `src/core/schemas/pointer.ts:12-123`,
  `src/core/schemas/interface.ts:11-131`, `src/core/schemas/eval-contract.ts:96-198`,
  `src/core/schemas/reference-set.ts:16-34`, `src/core/schemas/evidence-artifact.ts:148-159`.
- Shape precedents: `src/core/coverage/relevance.ts` in full,
  `src/core/compile/oracle-alignment.ts:23-123`, `src/core/compile/reachability.ts:21-112`,
  `src/core/seal/plan-index.ts:128-232`.
- Fixtures: `tests/schemas/fixtures/relevance-contracts.ts`,
  `tests/schemas/fixtures/gate-c-contract.ts`, `tests/coverage/relevance.test.ts`.
- House style: `5-1-the-seven-relevance-predicates.md`,
  `4-1-pointer-resolution-and-reachability.md`.
- Learning path: `_bmad-output/project-knowledge/learning-path-template.md` (shape),
  `_bmad-output/project-knowledge/learning-path-step-by-step.md` line 59 (the table row to append
  after) and line 1127 (Step 16's heading, the format Step 17 follows).

## Suggested Review Order

1. AC 7's truth table against AC 4 and AC 5's predicates and the five fixtures, cell by cell. If one
   cell is wrong, the fixture list is wrong with it and every downstream assertion inherits the
   error. The `gateCContract` column is the one derived by hand from a contract this story does not
   author, so it is the most likely to be wrong.
2. Decision 2 against Story 5.1's Decision 5, then Decisions 3 and 4, which are that quantifier
   applied to the empty cases.
3. Each predicate's site condition against `relevance.ts`'s corresponding loop, function by
   function. They must agree on emptiness or fixture 67 fails; check that they actually do rather
   than that the fixture would catch it. Rule 3 is the one place the two are spelled differently.
4. Decision 6 against AD-20's denominator paragraph and against the deleted `oracles[].rule` label,
   which is why the whole-body oracle has to be identified by demonstration, then fixture 90, which
   is the only fixture that pins the single-oracle half of it.
5. Decision 9 and fixture 125, which is the single fixture separating "relates" from "mentions".
6. Every fixture asserting `satisfied: true`: does it also assert a `reason`, and would it fail if
   the rule stopped having a site? That is the vacuity check, and it is what four of this story's
   first-draft fixtures failed.
7. The paired fixtures, each of which exists because one half alone passes under a regression the
   other half catches: 80/81, 83/84, 85/86, 89 alone, 93/94, 98/99, 100/101/102, 103/104, 106/108,
   113/114, 114/115, 115/117, 122/123, 126/127.
8. The `satisfiedContract` fixture against the compiler's nineteen checks, then against fixture 128,
   which asserts what that review would have found.
9. `check:layers` reporting 57 files, and the unchanged 12 / 21 / 10 from `check:schemas`,
   `check:ad5-registry`, and `check:ad28-registry`.

## Story Review Record

One peer review pass against the story before implementation, in a separate Claude Code session. It
transcribed AC 3, AC 4, AC 5, and AC 6 into a scratch module, wired it to the shipped
`relevance.ts`, `compile.ts`, `plan-index.ts`, and fixtures, and **executed** every cell of AC 7 and
every fixture rather than reasoning from the prose. It also typechecked the blocks under the repo's
own `tsconfig.json` with tsgo 7.0.2 and ran `biome check` against a copy of `biome.json`.

Confirmed with no change needed: all 35 truth-table cells; the typecheck, including
`noUncheckedIndexedAccess`, the `walkCheck` default-branch narrowing, `Object.entries` on the
zod-inferred `channelRoles`, the `SetOperand`-to-`Operand` assignability, and the derived
`CollectionLocation` type; the site-condition agreement with `relevance.ts` on all seven rules; that
`satisfiedContract` compiles clean under both `{ strict: false }` and `{ strict: true }`; that no
Decision contradicts AD-19, AD-20, AD-26, AD-31, AD-39, the Gate C table, or Story 5.1; and all six
baseline numbers.

Thirteen findings, all addressed in this file:

1. **High.** Fixture 97 (old numbering) claimed to pin rule 4's collection equality and did not: its
   `/other` mutation is disjoint, so both relaxed readings still answer not satisfied. Rule 4 now
   carries fixtures 100 and 101, the quantifier-deeper and location-deeper cases, which catch
   `addresses` in each direction, with the disjoint case kept as 102.
2. **High.** Fixture 87 (old) asserted rule 2's `requiredKeys: ['id','ok','id']` is satisfied, which
   holds with or without the `new Set`. It is now fixture 89, `['ok','ok']` expecting
   `NO_RELEVANT_SITE`, which fails the moment the dedupe is dropped.
3. **High.** Fixture 94 (old) could not fail: dropping the `types` clause from `declaresRequestKey`
   leaves `list-things` as a site and the verdict unchanged. Fixture 97 now empties `list-things`'s
   channels in the same mutant and asserts the witnessed reason.
4. **Medium.** Fixture 122 (old) passed under an `operationsOf` that reads only the first interface,
   since the operation then vanished and the rule answered satisfied vacuously. Fixture 127 now
   asserts the witnessed reason.
5. **Medium.** Task 7 filed fixture 104 (old) under the wrong regression. Measured: direction-only
   fails 84, check-only fails 83 and 109. The extra catches (`permittedKeys` also failing 86, the
   inverted rule 6 branch also failing 113, 115, and 116) are now recorded so they are not read as
   surprises.
6. **Medium.** Nothing pinned Decision 6's single-oracle reading; relaxing rule 2 to per-key
   coverage by any oracle produced zero fixture mismatches. Fixture 90 is new.
7. **Medium.** No fixture reached the `operations.length === 0` guard, so six predicates' opening
   branch and the exported `NO_OPERATION_WITNESS` were never executed. Fixture 76 is new.
8. **Medium.** AC 7's `gateCContract` rule 1 bullet named the wrong deciding site. The cell is
   right; the loop returns on `submit-export`, and the bullet now says so.
9. **Medium.** Four Biome reflows in the AC blocks (`parameterPointer`'s arrow, `reconciles`'s early
   return, O-005's operands array, O-006's `scope`). All four are applied, so a dev transcribing
   them records no false deviation.
10. **Medium.** The Gate C line citations were wrong and had drifted from Story 5.1's. Corrected
    throughout: the fourteen rows are at 51-64, the seven satisfaction rows at 52/54/56/58/60/62/64,
    and the second-pass rule 2 row at 131.
11. **Low.** AC 6's header comment cited the wrong fixture number for the compile assertion, and
    that comment ships verbatim into source. Now 128.
12. **Low.** Fixture 69's `rubrics: []` half was a no-op, since `satisfiedContract` declared none.
    The fixture contract now carries R-001, so both halves are real mutations.
13. **Low.** AC 9's test arithmetic depended on an unstated one-`it`-per-fixture rule while the
    Testing requirements suggested `it.each` over five contracts. The rule is now stated
    explicitly and the count updated to 73 fixtures and 2055 tests.

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context), `claude-opus-5[1m]`, running `/bmad-build` in a Claude Code session on
branch `feat/epic5-story2`. Implemented directly from the story rather than dispatched to a
context-free subagent: AC 3, AC 4, AC 5, and AC 6 are byte-for-byte transcriptions and Task 7 is a
measured fifteen-regression sweep, both of which a re-reading subagent can only degrade. Recorded
here as the one deviation from step-03's preferred handoff.

### Debug Log References

Baseline at `5613db6`, all six numbers confirmed rather than assumed: `check:layers` 56 files 0
violations, `check:docs` 55, `check:schemas` 12, `check:ad5-registry` 21, `check:ad28-registry` 10,
`vitest run` 51 files / 1982 tests.

Transcription was mechanical: the AC 3, AC 4, and AC 5 blocks were extracted from this file by line
range and concatenated into `src/core/coverage/satisfaction.ts` in that order, and AC 6's block into
`tests/coverage/fixtures/satisfaction-contracts.ts`. `biome check --write` over all three touched
source files reported `No fixes applied` and `diff` against the pre-Biome copies is empty, so the
review's nine reflows had already landed and no deviation is recorded under Task 3.

The five whole-contract columns were measured before a single fixture was written, by running
`evaluateRelevance` and `evaluateSatisfaction` over all five contracts and dumping rule, relevance,
satisfaction, and reason. All 35 cells matched AC 7 with no correction, including `gateCContract`'s
rule 1 deciding on `submit-export` and its rule 5 deciding on the `cursor` and `limit` parameter
group, which are the two cells the review flagged as most likely to be wrong.

### Completion Notes List

1. **Task 7, the fifteen-regression sweep, ran mechanically and every prediction held.** Each
   regression was applied to `satisfaction.ts` by exact string substitution against a golden copy,
   `vitest run tests/coverage` was run under the JSON reporter, the failing fixture numbers were
   parsed out of the test titles, and the golden copy was restored before the next one. No predicted
   fixture survived any regression. Measured:

   | Regression | Story predicts | Measured |
   | --- | --- | --- |
   | `bothChannelsAddress` direction conjunct only | 84 | 84 |
   | `bothChannelsAddress` check conjunct only | 83, 109 | 83, 109 |
   | rule 1 `others` drops the `role !== 'success-indicator'` clause | 82 | 82 |
   | rule 2 `required` computed from `permittedKeys` as well | 86, 88 | 86, 88, **89** |
   | rule 2 `new Set` removed from `required` | 89 | 89 |
   | rule 2 witness relaxed to per-key coverage by any oracle | 90 | 90 |
   | rule 3 `declaresRequestKey` drops the `types` clause | 97 | 97 |
   | rule 4 relaxed to `addresses(node.collection, collection)` | 100 | 100 |
   | rule 4 relaxed to `addresses(collection, node.collection)` | 101 | 101 |
   | rule 6 mode branch inverted | 113, 114, 115, 116, 117 | **64**, 113, 114, 115, 116, 117 |
   | rule 7 `relates` over every pointer in the check | 125 | 125 |
   | sibling-group dedupe removed | 108 | 108 |
   | `operationsOf` reads only `permittedInterfaces[0]` | 127 | 127 |
   | `operations.length === 0` guard removed from all six | 76 | 76 |
   | every `sites` counter removed | 68, 81, 86, 96, 105, 112, 120, 126 | 68, 81, 86, **89**, 96, 105, 112, 120, 126 |

2. **Three regressions failed a strict superset of what the story predicted, and none failed a
   different set.** All three extras are consequences the story's own text already implies, so they
   are recorded rather than treated as defects in the predicates:
   - The `permittedKeys` regression also fails 89. `create-thing`'s permitted keys are `id`, `ok`,
     and `error`, so folding them in turns `['ok', 'ok']` into a three-member denominator and the
     operation becomes a site again. Fixture 89 asserts `NO_RELEVANT_SITE`, so it fails.
   - The inverted rule 6 branch also fails 64, the whole-contract column for `satisfiedContract`.
     `satisfiedContract`'s rule 6 stops being satisfied under that regression, so its all-satisfied
     column moves. The review recorded 113, 115, and 116 as extras here and missed 64.
   - Removing every `sites` counter also fails 89, which is rule 2's second zero-site fixture. The
     story lists 86 as rule 2's zero-site fixture; 89 is the same shape reached through the
     duplicate-key path.

3. **No deviation from the AC code blocks at implementation time.** `satisfaction.ts` was AC 3 + AC
   4 + AC 5 concatenated with one blank line between blocks and nothing else; `satisfaction-contracts.ts`
   is AC 6's block verbatim. `rules.ts` gained exactly the three lines AC 2 specifies, appended after
   `relevancePredicateId`. `biome check --write` changed none of them and `tsc --noEmit` accepted
   them on the first run, including `noUncheckedIndexedAccess` and the `walkCheck` default-branch
   narrowing the review typechecked in advance. The code review then produced two deviations from
   AC 3, both recorded under findings L1 and L2 in the Review Findings below: `walkCheck`'s
   redundant `set-membership` case is deleted, and `CheckNode`'s doc comment now says a connective
   node witnesses nothing.

4. **`relevance.ts` and `relevance.test.ts` are byte-for-byte unchanged**, and all 58 of Story 5.1's
   fixtures still pass. Fixture 67's agreement invariant holds on all 35 cells, so the two site
   notions agree on emptiness with no shared module (Decision 11).

5. **The test file follows the one-`it`-per-fixture rule.** 71 `it`s in `satisfaction.test.ts` for
   fixtures 59 through 129 and 2 appended to `rules.test.ts` for 130 and 131, which is the 73 AC 9's
   arithmetic depends on. Fixtures 60 through 64 are five separate `it`s rather than one `it.each`,
   so the numbering stays one-to-one in the reporter output as well as in the source.

6. **Two structural notes on the mutants.** `emptyChannel()` and `emptyRequestShape()` are local
   factories, so fixtures 96 and 97 replace whole channel objects instead of writing through the
   aliases `structuredClone` preserves from `satisfaction-contracts.ts`'s shared `emptyChannel`. And
   fixtures 90 and 110 add and remove an oracle without touching `behaviors[0].oracles`: nothing in
   `EvalContract` cross-references the two at parse time, and the story asks for the fewest mutations
   each fixture's stated shape needs.

7. **Gate at implementation time.** `npm run validate` end to end: `check:layers` 57 files / 0
   violations (56 at baseline, +1 for `satisfaction.ts`), `check:docs` 55 unchanged, `check:schemas`
   12 unchanged, `check:ad5-registry` 21 unchanged, `check:ad28-registry` 10 unchanged, `vitest run`
   52 files / 2055 tests (51 / 1982 at baseline). `npm run build` passes separately. Every delta is
   attributed: +1 test file is `tests/coverage/satisfaction.test.ts`, +73 tests are fixtures 59
   through 131, +1 source file is `src/core/coverage/satisfaction.ts`. The review then added
   nineteen more fixtures; the final numbers are at the end of the Review Findings.

8. **Nothing else moved.** No dependency, no `package.json` change, no `schemas/` change, no
   `FAILURE_CODES` or `RUNTIME_FAULT_CODES` change, no `src/index.ts` change, no `compile` change,
   and no `CoverageGap` record. `deferred-work.md` stays empty; this story opens no item.

### Review Findings

One peer code-review pass over the working-tree diff against `5613db6`, in a separate Claude Code
session running `/bmad-code-review`. It read nothing and edited nothing in this tree: it built a
throwaway copy of `src/`, `tests/`, `scripts/`, and the configs under its own scratchpad, symlinked
`node_modules`, and ran more than sixty exact-string mutations against the copy's `satisfaction.ts`,
each followed by `vitest run tests/coverage` under the JSON reporter with the failing fixture
numbers parsed out. Every finding it filed is a measured survivor. It re-derived the transcription
mechanically and confirmed no deviation from AC 2, AC 3, AC 4, AC 5, or AC 6, and it reproduced all
fifteen Task 7 rows.

It found no incorrect verdict. Every finding is a test that cannot fail, or dead weight. It stated
three categories clean: `structuredClone` aliasing across all 71 mutants, mutant-versus-AC-8 drift
across all 73 fixtures, and predicate correctness against AD-20, AD-31, and the Gate C table.

**All eighteen findings are closed in this pass. Nothing is deferred to Story 5.3 or to
`deferred-work.md`.** Nineteen fixtures, numbered 132 through 150, were added in one
`describe('holes the implementation code review found')` block at the end of
`tests/coverage/satisfaction.test.ts`, so the numbering stays monotonic in the file and the
provenance stays legible. Each was then proved able to fail: the relaxation it pins was applied to
`satisfaction.ts`, `vitest run tests/coverage` was run, and the failing set was checked against the
fixture it was written for. Eighteen of the nineteen relaxations fail exactly the intended fixture
and nothing else; the nineteenth is noted below.

| # | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| M1 | Medium | Rule 1's single-oracle reading was asserted by no fixture. Hoisting `oracles.some` so the indicator conjunct and the `others` conjunct may be met by two different oracles passed all 131 tests, while AC 7 states the opposite in words. | Fixture 132, the rule 1 twin of fixture 90. Reduces O-002 to the indicator alone and adds an O-008 carrying `/id` alone. Verified: the hoisted witness fails 132 and nothing else. |
| M2 | Medium | `reconciles` pinned neither branch's collection identity. Deleting `node.operandPointers[1] === collection` from the `exact` branch, and separately deleting `node.collection !== collection` from the injection branch, each passed all 131 tests. | Fixtures 143 and 144, which repoint the bijection's collection operand and the injection's quantifier collection to `/interactions/list/response-body/other`. Verified: each relaxation fails exactly its own fixture. |
| M3 | Medium | `substitutePointer` was asserted by no fixture, and AC 8's entry for fixture 115 claimed otherwise. Rule 6's injection branch reads `predicate.operands[1]` off the raw expression, so `@/id` never had to resolve. | Fixture 138, a nested quantifier: a second collection location `/items/rows` on `list-things` and an O-007 whose inner collection is `@/rows`. Verified: dropping `substitutePointer` fails 138, and so does threading `null` instead of the collection into the quantifier body. |
| M4 | Medium | The step-to-operation join was asserted by no fixture on rules 1, 2, 4, 6, or 7. Replacing `index.stepsUsing(...)` with `contract.interactionPlan` in any one of them passed all 131 tests. Only rule 3 was pinned. | Fixture 145, the reviewer's own cheapest pin: `create-thing` stays declared and marked, no step invokes it, and a complete read-back runs between two other steps. Verified: the relaxed rule 7 fails 145. |
| M5 | Medium | `addresses`'s `/` boundary was asserted by no fixture. `pointer.startsWith(root)` with no separator passed all 131 tests, because no identifier or key in the corpus is a strict prefix of another. | Fixture 135, which repoints O-002's `ok` operand and direction target at the sibling key `okay`. Chosen over adding a `list-page` step to `satisfiedContract`, since a new step changes `stepsUsing` for every rule and would perturb fixtures the story fixed by measurement. Verified: the boundary-free `addresses` fails 135. |
| L1 | Low | `walkCheck`'s `set-membership` case was exactly redundant with its `default` branch: `SetOperand` carries no `pointer`, so `operandPointer` already answers `null` in that position. Eleven lines of `src/` plus a comment that read as load-bearing. | **The one deviation from an AC code block.** The case is deleted and its observation folded into the `default` branch's comment. `tsc --noEmit` is clean and every test passes, so the node the default branch builds is identical. AC 3's block is now one case shorter than the story text. |
| L2 | Low | The nodes pushed for `not`, `all`, and `any` are inert, while `CheckNode`'s doc comment implied every node is a candidate witness. Not a bug. | `CheckNode`'s doc comment now says a connective node carries neither an operand pointer nor a collection and witnesses nothing on its own. Second deviation from AC 3, comment only. |
| L3 | Low | Rule 5's parameter-axis dedupe was asserted by no fixture. Fixture 108 pins the operations axis alone. | Fixture 142, `parameters: [['limit', 'limit']]`. Verified: removing the dedupe from the parameters loop alone fails 142. |
| L4 | Low | Rule 5's "in both channels" was thinly pinned: fixture 109 caught only the check-half-alone direction on the operations axis, and neither half on the parameters axis. | Fixtures 139, 140, and 141. Verified: a rule-5-local direction-only regression fails 139 and 141; a rule-5-local check-only regression fails 109 and 140. |
| L5 | Low | Rule 1's `pointer !== successIndicator` clause was unpinned. A descriptor nominating `/ok` while also roling `/ok` as `payload` would let one pointer meet both conjuncts. | Fixture 133, exactly that descriptor. Verified: dropping the clause fails 133. |
| L6 | Low | "At one step" was unpinned on rules 1 and 2. | Fixtures 134 and 136, one oracle carrying both pointers at two different steps of the same operation. Verified: each per-rule step relaxation fails exactly its own fixture. |
| L7 | Low | `direction: null` and `check: null` occurred in no fixture contract, so neither fallback branch was ever exercised. Both spellings are schema-legal. | Fixtures 147 and 148. Verified: a wildcard target list for a null direction fails 147, and a wildcard node for a null check fails 148. |
| L8 | Low | `encodeToken` was exercised by no escapable character; the identity function passed all 131 tests. | Fixture 137, a required response key `a/b` addressed as `a~1b`. Verified: the identity `encodeToken` fails 137. |
| L9 | Low | Decision 13's `duplicateIds: 'unresolved'` was asserted by no fixture. Switching it to `'throw'` passed all 131 tests, and that variant would break the module header's "Nothing here throws" on a schema-legal contract. | Fixture 149, a contract declaring `list-things` on two interfaces. It asserts both halves: nothing throws, and rule 7 fails closed because the read-back step's operation no longer resolves. Verified: `'throw'` fails 149. |
| L10 | Low | Two relaxations around rule 7's node reading survived: widening `definedPointers` to include the node's quantifier collection, and widening the read side from the response body to the bare step root. | The second is fixture 146, which relates the write step's call inputs to the read step's own call inputs. Verified: the widened read side fails 146. The first is **unobservable rather than unpinned**: `walkCheck` pushes `operandPointers: []` on every quantifier node and a non-null `collection` on no other node, so no node can ever hold a collection and an operand together, and no contract can distinguish the two spellings. Recorded here rather than closed with a fixture that cannot exist. |
| L11 | Low | AC 7's per-cell reason claims for `gateCContract` were asserted by nothing. Fixtures 62 and 63 assert booleans and 66 asserts non-emptiness. | Fixture 150, which asserts gateC's rule 1 and rule 5 reasons verbatim, the two cells AC 7 spends a paragraph on and pre-implementation finding 8 corrected. The reviewer's own suggested regression (reversing the interface order) turned out to be a no-op, since `gateCContract` declares one interface; reversing the flattened operation inventory instead fails 124 and 150, so 150 does pin the claim. |
| L12 | Low | The File List named the learning-path document as edited before it was, and Task 9's sprint-status subtask was unchecked while `sprint-status.yaml` already read `review`. | Both closed by finishing Task 9 in this pass: Step 17 is written and the subtasks are ticked. |

Re-run after the fixes, and the numbers AC 9 states are updated by the nineteen added fixtures:

- `npm run validate` end to end and `npm run build` both pass.
- `check:layers` 57 files / 0 violations, `check:docs` 55, `check:schemas` 12, `check:ad5-registry`
  21, `check:ad28-registry` 10, all unchanged from AC 9.
- `vitest run` 52 test files, unchanged, and **2074 tests** rather than AC 9's 2055. The whole delta
  is the nineteen review fixtures 132 through 150; the story's own 73 are untouched.
- Both regression sweeps were re-run against the edited `satisfaction.ts`. All fifteen Task 7 rows
  still fail their named fixtures, now with extra catches from the new fixtures: row A also fails
  139 and 141, row B also fails 140 and 147, and row L also fails 142.

### File List

New:

- `src/core/coverage/satisfaction.ts`
- `tests/coverage/fixtures/satisfaction-contracts.ts`
- `tests/coverage/satisfaction.test.ts`

Edited:

- `src/core/coverage/rules.ts` (appended `satisfactionPredicateId`)
- `tests/coverage/rules.test.ts` (fixtures 130 and 131)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/project-knowledge/learning-path-step-by-step.md`
