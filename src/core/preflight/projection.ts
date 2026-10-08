/**
 * AD-11's named closed projection of a probe observation, and the fixture
 * digest computed over it. The projection is what "the fixture" means for a
 * scoring version: two runs whose projections agree describe the same fixture.
 */
import { digestComposite } from '../canonical/digest.ts'
import {
	descriptorArtifactOf,
	descriptorChannelOf,
} from '../declared-inputs.ts'
import type { AnyOperation } from '../schemas/interface.ts'
import {
	VOLATILE_POINTER_PATTERN,
	VOLATILE_WILDCARD,
} from '../schemas/pointer.ts'
import type {
	CommandProbeObservation,
	ProbeObservation,
	ProbeObservedBody,
} from '../schemas/port-messages.ts'
import type { JsonValue } from '../schemas/primitives.ts'
import { decodeTail } from '../seal/plan-index.ts'

export const PREFLIGHT_ARTIFACT_PATH = 'PreflightVerdict'

/**
 * The closed projection, and nothing outside it. Response headers are outside
 * because `volatilePointers` is a `VolatilePointer` and the response
 * descriptor is body-scoped, so no declaration can mark a header volatile, and
 * unprunable headers would fail the repeated-read immutability branch on any
 * fixture that echoes a request identifier back in one.
 *
 * Two costs to know about: two fixture versions differing only in a response
 * header digest identically, and a witness relation can read a header this
 * projection cannot see. The projection says what the fixture is; a relation
 * addressing a header is the author asserting that header is stable.
 *
 * `status`, `exitCode` and `toolError` are one family, each `null` off its
 * own kind. `exitCode` belongs to a command and to a tool call whose server
 * ended the session before it answered, and is `null` on every answered tool
 * call. All three answer whether the call went through, and the projection's
 * test for membership is whether a declaration can prune the field: none of
 * the three can be. A projection blind to the tool error flag
 * would digest two legs identical when one errored and one did not, which is
 * the state-reset check reporting a reset that never happened.
 */
export type ProjectedObservation = {
	readonly legId: string
	readonly interfaceId: string
	readonly operationId: string
	/** the transport status, or `null` off an interface that speaks HTTP. */
	readonly status: number | null
	/** the process exit code of a command, or of a tool server that ended the session before it answered; `null` otherwise. */
	readonly exitCode: number | null
	/** the tool call's error flag, or `null` off an interface that calls one. */
	readonly toolError: boolean | null
	readonly body: ProbeObservedBody
}

const isJsonObject = (
	value: JsonValue,
): value is { [key: string]: JsonValue } =>
	value !== null && typeof value === 'object' && !Array.isArray(value)

const ARRAY_INDEX = /^(?:0|[1-9][0-9]*)$/

/**
 * Deletes one already-decoded pointer from a cloned body value, in place. A
 * `*` token fans out over every element of an array and every key of an
 * object at its position; a pointer that resolves to nothing is a no-op.
 */
function deleteAt(node: JsonValue, tokens: readonly string[]): void {
	const [token, ...rest] = tokens
	if (token === undefined) return
	if (rest.length === 0) {
		deleteLeaf(node, token)
		return
	}
	if (token === VOLATILE_WILDCARD) {
		if (Array.isArray(node)) {
			for (const child of node) deleteAt(child, rest)
		} else if (isJsonObject(node)) {
			for (const key of Object.keys(node))
				deleteAt(node[key] as JsonValue, rest)
		}
		return
	}
	if (Array.isArray(node)) {
		if (!ARRAY_INDEX.test(token)) return
		const next = node[Number(token)]
		if (next !== undefined) deleteAt(next, rest)
		return
	}
	if (!isJsonObject(node) || !Object.hasOwn(node, token)) return
	deleteAt(node[token] as JsonValue, rest)
}

/** The last step of `deleteAt`: removes the element, key or (for the wildcard) every one. */
function deleteLeaf(parent: JsonValue, token: string): void {
	if (Array.isArray(parent)) {
		if (token === VOLATILE_WILDCARD) {
			parent.length = 0
			return
		}
		if (!ARRAY_INDEX.test(token)) return
		const index = Number(token)
		if (index >= parent.length) return
		parent.splice(index, 1)
		return
	}
	if (!isJsonObject(parent)) return
	if (token === VOLATILE_WILDCARD) {
		for (const key of Object.keys(parent)) delete parent[key]
		return
	}
	// A pointer that resolves to nothing is a no-op: a volatile field the fixture
	// did not return this time is exactly what the declaration exists for.
	if (!Object.hasOwn(parent, token)) return
	delete parent[token]
}

/**
 * Removes every declared volatile pointer from a `json` body. `text` and
 * `absent` pass through untouched, so a body that changed its content type
 * stays visible to the digest. The input is cloned before anything is deleted.
 */
export function pruneVolatile(
	body: ProbeObservedBody,
	volatilePointers: readonly string[],
	artifactPath: string,
): ProbeObservedBody {
	for (const pointer of volatilePointers) {
		if (VOLATILE_POINTER_PATTERN.test(pointer)) continue
		throw new TypeError(
			`${artifactPath}: "${pointer}" is not a volatile pointer`,
		)
	}
	if (body.kind !== 'json' || volatilePointers.length === 0) return body
	// RFC 6901's empty pointer addresses the whole document, so a contract
	// declaring it says the entire body is volatile.
	if (volatilePointers.some((pointer) => pointer === ''))
		return { kind: 'absent' }
	const value = structuredClone(body.value)
	for (const pointer of volatilePointers) deleteAt(value, decodeTail(pointer))
	return { kind: 'json', value }
}

/** One observation reduced to the projection, with its volatile pointers gone. */
export function projectObservation(
	observation: ProbeObservation,
	operation: AnyOperation,
	artifactPath: string,
): ProjectedObservation {
	// The channel the operation's descriptor describes is the one AD-10's
	// relation reads, so it is the one the volatile pointers are pruned from.
	// Off an interface that speaks HTTP that is the response body; off a
	// command it is the stream or the file the operation nominates; off a tool
	// call it is the structured result, which is the kind's only body channel.
	const observed =
		observation.kind === 'api'
			? observation.body
			: observation.kind === 'mcp'
				? observation.result
				: describedChannelOf(observation, operation)
	return {
		legId: observation.probeId,
		interfaceId: observation.interfaceId,
		operationId: observation.operationId,
		// Each of the three reads `null` off its own kind, and `exitCode` on an
		// answered tool call. Every reader of these fields already asks about
		// `null`.
		status: observation.kind === 'api' ? observation.status : null,
		exitCode:
			observation.kind === 'cli'
				? observation.exitCode
				: observation.kind === 'mcp'
					? (observation.exitCode ?? null)
					: null,
		toolError: observation.kind === 'mcp' ? observation.isError : null,
		body: pruneVolatile(observed, operation.volatilePointers, artifactPath),
	}
}

/** The observed value of whichever channel this operation's descriptor describes. */
function describedChannelOf(
	observation: CommandProbeObservation,
	operation: AnyOperation,
): ProbeObservedBody {
	const artifactId = descriptorArtifactOf(operation)
	if (artifactId !== null)
		return observation.artifacts[artifactId] ?? { kind: 'absent' }
	return descriptorChannelOf(operation) === 'stderr'
		? observation.stderr
		: observation.stdout
}

/**
 * AD-11's fixture digest. Sorted by leg id first, because NFR9 forbids any
 * stage from reading array position: two runs whose observations arrived in a
 * different order describe the same fixture and must digest the same.
 *
 * The empty case throws here. `digestComposite` rejects an empty field bag, and
 * `{ observations: [] }` has one field, so it would happily digest a pre-flight
 * that verified nothing.
 */
export function fixtureDigest(
	projections: readonly ProjectedObservation[],
	artifactPath: string,
): string {
	if (projections.length === 0) {
		throw new TypeError(
			`${artifactPath}: a fixture digest over no observation would certify a pre-flight that verified nothing`,
		)
	}
	const sorted = [...projections].sort((left, right) =>
		left.legId < right.legId ? -1 : left.legId > right.legId ? 1 : 0,
	)
	return digestComposite({ observations: sorted }, artifactPath)
}
