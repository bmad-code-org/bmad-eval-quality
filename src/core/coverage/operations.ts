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
	descriptorArtifactOf,
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

/**
 * RFC 6901 escaping, `~` before `/`. Lives here rather than beside the
 * pointer-building helpers that use it, because the descriptor root is built
 * here and both spellings have to escape the same way.
 */
export const encodeToken = (token: string): string =>
	token.replace(/~/g, '~0').replace(/\//g, '~1')

/**
 * Where a descriptor-relative pointer hangs off an interaction root for this
 * operation. Two segments on the artifact channel, one everywhere else.
 */
const descriptorRootOf = (operation: AnyOperation): string => {
	const channel = descriptorChannelOf(operation)
	if (channel !== 'artifact') return `/${channel}`
	const artifactId = descriptorArtifactOf(operation)
	// Unreachable: `descriptorChannelOf` answers `artifact` only for the arm
	// that carries an identifier.
	if (artifactId === null) {
		throw new TypeError(
			`operation "${operation.operationId}" describes an artifact and names none`,
		)
	}
	return `/${channel}/${encodeToken(artifactId)}`
}

export type ResolvedOperation = {
	readonly operation: AnyOperation
	/** the declaring interface's kind. An operation states no kind of its own. */
	readonly kind: InterfaceKindName
	/** the declaring interface. Two interfaces may declare one `operationId`, and this is what separates them. */
	readonly logicalId: string
	readonly descriptor: ResponseDescriptor
	/**
	 * The interaction-rooted segment a descriptor pointer hangs off, which is
	 * the channel this operation's own descriptor describes, and on the artifact
	 * channel the file as well. `/artifact` alone is not a root any real
	 * evidence pointer starts with, since an artifact pointer carries its
	 * identifier before its tail, so a root without it matched nothing and made
	 * every pointer-building rule answer against a pointer that cannot exist.
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
			descriptorRoot: descriptorRootOf(operation),
			transportChannels: inputChannelsOf(operation),
			requestChannels: requestChannelsOf(operation),
		})),
	)
}
