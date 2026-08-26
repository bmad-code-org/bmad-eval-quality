/** the request and response shape of every AD-28 port method. */
import { z } from 'zod'
import { HttpMethod, PathTemplate } from './interface.ts'
import { Identifier, JsonValue, KeyName, Rfc3339Utc } from './primitives.ts'

// AD-8: the corpus port resolves an opaque reference to bytes from a
// caller-owned location. It does not check the digest: AD-8 puts digest
// recomputation in the core ("the core recomputes every per-artifact digest
// from the resolved bytes"), and an adapter that checked it would be trusting
// the manifest label AD-8 says is never trusted.
export const CorpusResolveRequest = z.strictObject({
	privateRef: z.string().min(1),
})

export const CorpusResolveResponse = z.strictObject({
	privateRef: z
		.string()
		.min(1)
		.describe(
			'Echoed back so a response cannot be silently bound to a different request. Nothing else in the response identifies what was resolved, and bytes carry no self-identity.',
		),
	bytes: z.instanceof(Uint8Array),
})

// AD-1 forbids a clock read under `core/`, so a timestamp arrives through a
// port. The request is an empty strict object: every `PortMethod` takes a
// request and `invokePort` parses it, so a port with nothing to ask still
// needs a shape that parses.
export const ClockReadRequest = z.strictObject({})

export const ClockReadResponse = z.strictObject({
	now: Rfc3339Utc,
})

export const FileReadRequest = z.strictObject({
	path: z.string().min(1),
})

export const FileReadResponse = z.strictObject({
	path: z.string().min(1),
	bytes: z.instanceof(Uint8Array),
})

export const FileWriteRequest = z.strictObject({
	path: z.string().min(1),
	bytes: z.instanceof(Uint8Array),
})

export const FileWriteResponse = z.strictObject({
	path: z.string().min(1),
	byteLength: z.int().min(0),
})

/**
 * A request body and an observed body are both tagged. AD-28 exists to stop
 * two adapter authors resolving one boundary differently, and an untagged
 * `JsonValue` cannot tell a JSON string response from a `text/html` one,
 * because `JsonValue` accepts a bare string. `absent` is its own branch,
 * since `null` is itself a legal JSON body.
 */
export const ProbeRequestBody = z.discriminatedUnion('kind', [
	z.strictObject({ kind: z.literal('json'), value: JsonValue }),
	z.strictObject({ kind: z.literal('absent') }),
])

export const ProbeObservedBody = z.discriminatedUnion('kind', [
	z.strictObject({ kind: z.literal('json'), value: JsonValue }),
	z.strictObject({ kind: z.literal('text'), value: z.string() }),
	z.strictObject({ kind: z.literal('absent') }),
])

/**
 * AD-35: the request names a logical interface identifier and never a URL,
 * host, or port. Mapping the identifier to an authorized target is the
 * adapter's, from configuration outside the contract.
 *
 * No credential appears here. AD-18 forbids a credential value in a
 * declaration, and the values that reach this shape come from a declaration;
 * authorization material is the adapter's, supplied by the same mapping that
 * authorizes the target.
 */
export const ProbeRequest = z.strictObject({
	probeId: Identifier.describe(
		'An opaque correlation label minted by the pre-flight plan and echoed unchanged on the observation. Two witnesses of one operation, and the three observations a state-reset differential needs, are otherwise distinguishable only by array position, which NFR9 forbids any stage from reading.',
	),
	interfaceId: Identifier,
	operationId: Identifier,
	method: HttpMethod,
	pathTemplate: PathTemplate,
	channels: z.strictObject({
		path: z.record(KeyName, JsonValue),
		query: z.record(KeyName, JsonValue),
		header: z
			.record(KeyName, z.string())
			.describe(
				'String-valued because a header value is a string on the wire; the other channels carry the declared JSON value.',
			),
		body: ProbeRequestBody,
	}),
})

/**
 * What the adapter observed. Deliberately response content only: no elapsed
 * time, no redirect count, no retry count. AD-35's caps are safety limits, so
 * exceeding one throws a `budget-exhausted` fault and never lands as a field
 * on a successful observation. AD-10's verdict stays a function of what the
 * system returned, with no input from how long the network took.
 *
 * Every response the system returns is an observation, at any status. Only a
 * policy denial, a cap, an abort, or a transport failure throws; a 500 is the
 * payload AD-10's seeded-fault check reads, never an error.
 */
export const ProbeObservation = z.strictObject({
	probeId: Identifier,
	interfaceId: Identifier,
	operationId: Identifier,
	status: z.int().min(100).max(599),
	headers: z
		.record(KeyName, z.string())
		.describe(
			'Repeated headers are joined with ", " per RFC 9110 before they reach this shape. `set-cookie` is the one header that rule is wrong for, and it is dropped rather than mangled: nothing in AD-10 reads it, and a joined `set-cookie` is a value no consumer can split back.',
		),
	body: ProbeObservedBody,
})

export type CorpusResolveRequest = z.infer<typeof CorpusResolveRequest>
export type CorpusResolveResponse = z.infer<typeof CorpusResolveResponse>
export type ClockReadRequest = z.infer<typeof ClockReadRequest>
export type ClockReadResponse = z.infer<typeof ClockReadResponse>
export type FileReadRequest = z.infer<typeof FileReadRequest>
export type FileReadResponse = z.infer<typeof FileReadResponse>
export type FileWriteRequest = z.infer<typeof FileWriteRequest>
export type FileWriteResponse = z.infer<typeof FileWriteResponse>
export type ProbeRequestBody = z.infer<typeof ProbeRequestBody>
export type ProbeObservedBody = z.infer<typeof ProbeObservedBody>
export type ProbeRequest = z.infer<typeof ProbeRequest>
export type ProbeObservation = z.infer<typeof ProbeObservation>
