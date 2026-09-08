/**
 * One declared operation joined to the interface that declares it, plus the
 * two facts the coverage predicates need and neither the operation nor the
 * interface states: where a response descriptor's pointers resolve, and which
 * channels a call's inputs may be keyed by.
 *
 * `relevance.ts` and `satisfaction.ts` each flattened `permittedInterfaces`
 * with `flatMap((declared) => declared.operations)` and dropped the interface
 * one line before every loop that ranges over it, so six of AD-20's seven
 * rules could not see the kind that declared the operation they were grading.
 * This is that flattening, written once and keeping the join.
 *
 * Nothing here throws, which is the promise both predicate modules make in
 * their own headers and which `evaluateCoverage`'s callers rely on. Every
 * field is read off an already-parsed contract, so there is no precondition
 * left to assert.
 */
import {
	descriptorChannelOf,
	inputChannelsOf,
	type RequestChannel,
	requestChannelsOf,
} from '../declared-inputs.ts'
import type { EvalContract } from '../schemas/eval-contract.ts'
import type {
	AnyOperation,
	InterfaceKindName,
	ResponseDescriptor,
} from '../schemas/interface.ts'
import { operationsOf } from '../schemas/interface.ts'
import type { InputChannelName } from '../schemas/pointer.ts'

export type ResolvedOperation = {
	readonly operation: AnyOperation
	/** the declaring interface's kind. An operation states no kind of its own. */
	readonly kind: InterfaceKindName
	/** the declaring interface. Two interfaces may declare one `operationId`, and this is what separates them. */
	readonly logicalId: string
	readonly descriptor: ResponseDescriptor
	/**
	 * The interaction-rooted segment a descriptor pointer hangs off, which is
	 * the channel this operation's own descriptor describes.
	 */
	readonly descriptorRoot: string
	/**
	 * The channels a call's inputs may be keyed by. Names only: the two sites
	 * that build candidate pointers need the names and never the shapes.
	 */
	readonly transportChannels: readonly InputChannelName[]
	/**
	 * The same channels already paired with the shapes they declare. Predicates
	 * that read a declared shape take these rather than indexing the request
	 * shape with a name, because under the operation union TypeScript cannot
	 * prove a name drawn from one kind's tuple is a key of the other's shape.
	 */
	readonly requestChannels: readonly RequestChannel[]
}

/**
 * Every declared operation, in declaration order, each carrying the interface
 * that declares it. Six of AD-20's seven rules range over this list; rule 5 is
 * contract-level and reads the sibling groups instead.
 */
export function resolveOperations(
	contract: EvalContract,
): readonly ResolvedOperation[] {
	return contract.permittedInterfaces.flatMap((declared) =>
		operationsOf(declared).map((operation) => ({
			operation,
			kind: declared.kind,
			logicalId: declared.logicalId,
			descriptor: operation.responseDescriptor,
			descriptorRoot: `/${descriptorChannelOf(operation)}`,
			transportChannels: inputChannelsOf(operation),
			requestChannels: requestChannelsOf(operation),
		})),
	)
}
