/**
 * AD-31's seven relevance predicates: decision procedures over AD-19's
 * declarations. They read no run record, no probe, no outcome, no oracle.
 *
 * Nothing here throws. A coverage gap is recorded and the artifact still ships
 * (AD-5), so there is no failure code. Failing closed means answering
 * `relevant` on an absent declaration.
 */
import type { EvalContract } from '../schemas/eval-contract.ts'
import type { Operation } from '../schemas/interface.ts'
import { TRANSPORT_CHANNELS } from '../schemas/pointer.ts'
import {
	DISCIPLINE_RULES,
	type DisciplineRule,
	relevancePredicateId,
} from './rules.ts'

export type RelevanceVerdict = {
	readonly rule: DisciplineRule
	readonly predicate: string
	readonly relevant: boolean
	/** which declaration decided it, so a gap is diagnosable. */
	readonly reason: string
}

const verdict = (
	rule: DisciplineRule,
	relevant: boolean,
	reason: string,
): RelevanceVerdict => ({
	rule,
	predicate: relevancePredicateId(rule),
	relevant,
	reason,
})

/** `1 collection location`, `2 collection locations`. A reason is read by people. */
const plural = (count: number, noun: string): string =>
	`${count} ${noun}${count === 1 ? '' : 's'}`

/** Every declared operation, flattened. Six of the seven rules range over this list. */
const operationsOf = (contract: EvalContract): readonly Operation[] =>
	contract.permittedInterfaces.flatMap((declared) => declared.operations)

/** Decision 10: a contract declaring no operation leaves six of the rules nothing to read. */
export const NO_OPERATION =
	'the contract declares no operation, so the declaration this rule reads is absent'

/**
 * Rule 1: `successIndicator` declared, and some other pointer carrying a
 * channel role. An operation nominating no indicator is relevant, since a
 * nullable pointer has two spellings and `null` is the absent one.
 * `channelRoles: {}` answers the second conjunct.
 */
export function successIndicatorSeparationRelevance(
	contract: EvalContract,
): RelevanceVerdict {
	const rule = 'success-indicator-separation'
	const operations = operationsOf(contract)
	if (operations.length === 0) return verdict(rule, true, NO_OPERATION)
	for (const operation of operations) {
		const { successIndicator, channelRoles } = operation.responseDescriptor
		// `=== null`: `DescriptorPointer` admits the empty string, which
		// nominates the whole response body.
		if (successIndicator === null) {
			return verdict(
				rule,
				true,
				`operation ${operation.operationId} nominates no success indicator`,
			)
		}
		if (channelRoles === null) {
			return verdict(
				rule,
				true,
				`operation ${operation.operationId} declares no channel roles`,
			)
		}
		const other = Object.keys(channelRoles).find(
			(pointer) => pointer !== successIndicator,
		)
		if (other !== undefined) {
			return verdict(
				rule,
				true,
				`operation ${operation.operationId} gives pointer ${other} a channel role beside its success indicator`,
			)
		}
	}
	return verdict(
		rule,
		false,
		'every operation nominates a success indicator and gives no other pointer a channel role',
	)
}

/**
 * Rule 2: the descriptor declares more than one pointer, counted over distinct
 * `requiredKeys`. That is the set rule 2's satisfaction denominator reads, and
 * AD-20 keeps permitted keys out of coverage. Distinct, because `requiredKeys`
 * carries no uniqueness constraint and one key repeated is one pointer.
 */
export function wholeBodyRelevance(contract: EvalContract): RelevanceVerdict {
	const rule = 'whole-body'
	const operations = operationsOf(contract)
	if (operations.length === 0) return verdict(rule, true, NO_OPERATION)
	for (const operation of operations) {
		const distinct = new Set(operation.responseDescriptor.requiredKeys)
		if (distinct.size > 1) {
			return verdict(
				rule,
				true,
				`operation ${operation.operationId} declares ${plural(distinct.size, 'distinct required response key')}`,
			)
		}
	}
	return verdict(
		rule,
		false,
		'no operation declares more than one distinct required response key',
	)
}

/**
 * Rule 3: some operation declares a request key on any of AD-19's four
 * transport channels. The site is the whole channel triple. A key with no
 * `types` entry has an absent type, a key typed `null` has AD-31's
 * indeterminate one, and both are relevant, so declaring an input and leaving
 * it untyped buys no irrelevance.
 */
export function malformedInputRelevance(
	contract: EvalContract,
): RelevanceVerdict {
	const rule = 'malformed-input'
	const operations = operationsOf(contract)
	if (operations.length === 0) return verdict(rule, true, NO_OPERATION)
	for (const operation of operations) {
		for (const channel of TRANSPORT_CHANNELS) {
			const shape = operation.requestShape[channel]
			// `Object.keys` enumerates own keys only. `KeyName` admits
			// `constructor`, which a keyed lookup would find on the prototype.
			const key =
				shape.requiredKeys[0] ??
				shape.permittedKeys[0] ??
				Object.keys(shape.types)[0]
			if (key !== undefined) {
				return verdict(
					rule,
					true,
					`operation ${operation.operationId} declares ${channel} key ${key}`,
				)
			}
		}
	}
	return verdict(
		rule,
		false,
		'no operation declares a request key on any transport channel',
	)
}

/**
 * Rule 4: the descriptor declares at least one collection location. `null` is
 * the absent state and is relevant; `[]` is the explicit empty answer.
 */
export function perRecordRelevance(contract: EvalContract): RelevanceVerdict {
	const rule = 'per-record'
	const operations = operationsOf(contract)
	if (operations.length === 0) return verdict(rule, true, NO_OPERATION)
	for (const operation of operations) {
		const { collectionLocations } = operation.responseDescriptor
		if (collectionLocations === null) {
			return verdict(
				rule,
				true,
				`operation ${operation.operationId} declares no collection-location list, so no collection is declared to range over`,
			)
		}
		if (collectionLocations.length > 0) {
			return verdict(
				rule,
				true,
				`operation ${operation.operationId} declares ${plural(collectionLocations.length, 'collection location')}`,
			)
		}
	}
	return verdict(
		rule,
		false,
		'every operation declares an explicitly empty collection-location list',
	)
}

/**
 * Rule 5: a sibling group over operations or parameters is non-empty. The one
 * contract-level rule of the seven. A group of one cannot exist, since
 * `SIBLING_GROUP_MINIMUM` is two.
 */
export function siblingCrossCheckRelevance(
	contract: EvalContract,
): RelevanceVerdict {
	const rule = 'sibling-cross-check'
	const groups = contract.siblingGroups
	if (groups === null) {
		return verdict(rule, true, 'the contract declares no sibling groups')
	}
	if (groups.operations.length > 0) {
		return verdict(
			rule,
			true,
			`the contract declares ${plural(groups.operations.length, 'operation sibling group')}`,
		)
	}
	if (groups.parameters.length > 0) {
		return verdict(
			rule,
			true,
			`the contract declares ${plural(groups.parameters.length, 'parameter sibling group')}`,
		)
	}
	return verdict(
		rule,
		false,
		'the contract declares explicitly empty operation and parameter sibling groups',
	)
}

/**
 * Rule 6: a declared collection location names a reference set. The site is
 * `collectionLocations` alone (Decision 8), so an explicitly empty list stays
 * an answer. A location naming an identifier the contract does not declare
 * still names one.
 */
export function omissionAndCompletenessRelevance(
	contract: EvalContract,
): RelevanceVerdict {
	const rule = 'omission-and-completeness'
	const operations = operationsOf(contract)
	if (operations.length === 0) return verdict(rule, true, NO_OPERATION)
	for (const operation of operations) {
		const { collectionLocations } = operation.responseDescriptor
		if (collectionLocations === null) {
			return verdict(
				rule,
				true,
				`operation ${operation.operationId} declares no collection-location list, so no location can name a reference set`,
			)
		}
		for (const location of collectionLocations) {
			if (location.referenceSet !== null) {
				return verdict(
					rule,
					true,
					`operation ${operation.operationId} names reference set ${location.referenceSet} for collection ${location.pointer}`,
				)
			}
		}
	}
	return verdict(
		rule,
		false,
		'no declared collection location names a reference set',
	)
}

/**
 * Rule 7: some operation declares `stateChangeMarker: true`. The one rule with
 * no absent state to grade, since the marker is a required boolean and both
 * values are legal.
 */
export function stateChangeReadBackRelevance(
	contract: EvalContract,
): RelevanceVerdict {
	const rule = 'state-change-read-back'
	const operations = operationsOf(contract)
	if (operations.length === 0) return verdict(rule, true, NO_OPERATION)
	for (const operation of operations) {
		if (operation.stateChangeMarker) {
			return verdict(
				rule,
				true,
				`operation ${operation.operationId} declares stateChangeMarker: true`,
			)
		}
	}
	return verdict(rule, false, 'no operation declares stateChangeMarker: true')
}

/**
 * One predicate per rule. The mapped type fails the typecheck when a member of
 * `DISCIPLINE_RULES` has no predicate. Same idiom as `operatorHandlers` in
 * `core/evaluate/resolution.ts`, minus its `Object.hasOwn` guard: these keys
 * come from a compile-time tuple, so a runtime guard is unreachable.
 */
export const RELEVANCE_PREDICATES: {
	readonly [Rule in DisciplineRule]: (
		contract: EvalContract,
	) => RelevanceVerdict
} = {
	'success-indicator-separation': successIndicatorSeparationRelevance,
	'whole-body': wholeBodyRelevance,
	'malformed-input': malformedInputRelevance,
	'per-record': perRecordRelevance,
	'sibling-cross-check': siblingCrossCheckRelevance,
	'omission-and-completeness': omissionAndCompletenessRelevance,
	'state-change-read-back': stateChangeReadBackRelevance,
}

/** All seven verdicts, in `DISCIPLINE_RULES` order, over declarations alone. */
export function evaluateRelevance(
	contract: EvalContract,
): readonly RelevanceVerdict[] {
	return DISCIPLINE_RULES.map((rule) => RELEVANCE_PREDICATES[rule](contract))
}
