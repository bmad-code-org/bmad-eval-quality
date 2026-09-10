/** the request and response shape of every AD-28 port method. */
import { z } from 'zod'
import { HttpMethod, PathTemplate } from './interface.ts'
import {
	EnvironmentKeyName,
	Identifier,
	JsonValue,
	KeyName,
	Rfc3339Utc,
	ToolName,
} from './primitives.ts'
import {
	ProbeObservedBody,
	ProbeRequestBody,
	ProbeRequestStdin,
} from './probe-body.ts'

export { ProbeObservedBody, ProbeRequestBody } from './probe-body.ts'

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
 * AD-35: the request names a logical interface identifier and never a URL,
 * host, or port. Mapping the identifier to an authorized target is the
 * adapter's, from configuration outside the contract.
 *
 * No credential appears here. AD-18 forbids a credential value in a
 * declaration, and the values that reach this shape come from a declaration;
 * authorization material is the adapter's, supplied by the same mapping that
 * authorizes the target.
 */
const probeCorrelation = {
	probeId: Identifier.describe(
		'An opaque correlation label minted by the pre-flight plan and echoed unchanged on the observation. Two witnesses of one operation, and the three observations a state-reset differential needs, are otherwise distinguishable only by array position, which NFR9 forbids any stage from reading.',
	),
	interfaceId: Identifier,
	operationId: Identifier,
}

/**
 * A request to an interface that speaks HTTP. Tagged on `kind` so an adapter
 * knows what it is being asked to do before it reads anything else, and so the
 * two shapes cannot be confused for one another by a field that happens to be
 * absent.
 */
export const ApiProbeRequest = z.strictObject({
	...probeCorrelation,
	kind: z.literal('api'),
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
 * A request to run a command.
 *
 * AD-35's rule is that a contract names a logical identifier and the caller
 * maps it, and the analogue for a command is exactly the same shape: the
 * `executable` is the logical name the contract declared, and the adapter maps
 * it to something runnable from configuration outside the contract. No
 * filesystem path, no interpreter, no shell string. The adapter builds the
 * argument vector; it is never handed one to execute.
 *
 * `environment` is string-valued for the reason `header` is, and carries no
 * credential for the reason AD-18 gives: authorization material is the
 * adapter's, supplied by the same mapping that authorizes the target.
 */
export const CommandProbeRequest = z.strictObject({
	...probeCorrelation,
	kind: z.literal('cli'),
	executable: Identifier.describe(
		'A logical executable name, never a filesystem path, a URL, a host, or a port (AD-35). The adapter maps it to an authorized target through configuration outside the contract.',
	),
	subcommandPath: z.array(Identifier),
	channels: z.strictObject({
		argument: z.record(KeyName, JsonValue),
		option: z.record(KeyName, JsonValue),
		environment: z
			.record(EnvironmentKeyName, z.string())
			.describe(
				'String-valued because an environment variable is a string to the process; the other channels carry the declared JSON value. Keyed more narrowly than the other channels: this one becomes real variables on a real process, where `A=B` as a key would smuggle a second assignment past anyone reading the mapping.',
			),
		stdin: ProbeRequestStdin,
	}),
})

/**
 * A request to call one tool on an MCP server.
 *
 * AD-35 again: `toolName` is the name the server publishes for the tool, and
 * which server that is comes from the adapter's mapping of `interfaceId`,
 * outside the contract. No transport URL, no command, no process.
 *
 * One channel. A tool call carries an arguments object, which is what
 * `McpRequestShape` declares, so the request carries the same one channel the
 * operation could declare keys in.
 *
 * `arguments` holds declared JSON values and carries no credential, for the
 * reason AD-18 gives: authorization material is the adapter's, supplied by the
 * same mapping that authorizes the target.
 */
export const McpProbeRequest = z.strictObject({
	...probeCorrelation,
	kind: z.literal('mcp'),
	toolName: ToolName.describe(
		"The tool the adapter calls, in the server's own spelling (AD-35). Which server publishes it is the adapter's mapping of `interfaceId`, from configuration outside the contract.",
	),
	channels: z.strictObject({
		arguments: z.record(KeyName, JsonValue),
	}),
})

export const ProbeRequest = z.discriminatedUnion('kind', [
	ApiProbeRequest,
	CommandProbeRequest,
	McpProbeRequest,
])

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
export const ApiProbeObservation = z.strictObject({
	...probeCorrelation,
	kind: z.literal('api'),
	status: z.int().min(100).max(599),
	headers: z
		.record(KeyName, z.string())
		.describe(
			'Repeated headers are joined with ", " per RFC 9110 before they reach this shape. `set-cookie` is the one header that rule is wrong for, and it is dropped rather than mangled: nothing in AD-10 reads it, and a joined `set-cookie` is a value no consumer can split back.',
		),
	body: ProbeObservedBody,
})

/**
 * What the adapter observed of a command run: its two streams, its exit code,
 * and the files it wrote.
 *
 * `exitCode` is signed, unlike an HTTP status, because a process terminated by
 * a signal is conventionally reported as a negative code and this field records
 * what happened rather than what is tidy. A non-zero exit is an observation
 * exactly as a 500 is: only a policy denial, a cap, an abort, or a failure to
 * start the process throws.
 *
 * `artifacts` is keyed by the identifier the operation declared, not by a
 * filesystem path. Which path each identifier names is the adapter's mapping,
 * the same disclosure boundary AD-35 draws around the executable itself.
 */
export const CommandProbeObservation = z.strictObject({
	...probeCorrelation,
	kind: z.literal('cli'),
	exitCode: z.int(),
	stdout: ProbeObservedBody,
	stderr: ProbeObservedBody,
	artifacts: z.record(Identifier, ProbeObservedBody),
})

/**
 * What the adapter observed of one tool call: the envelope's error flag and the
 * structured result.
 *
 * `isError` is the tool's own report that the call did not go through, and it
 * is an observation exactly as a 500 and a non-zero exit are. A JSON-RPC error
 * answering `tools/call` lands here too, with the error object as `result`: the
 * server answered, and a server refusing a tool the contract declares is
 * precisely the defect an oracle should be able to assert on. Only a policy
 * denial, a cap, an abort, or a failure to establish the session throws.
 *
 * `result` is the structured content the tool returned, which is the channel
 * the operation's response descriptor describes.
 */
export const McpProbeObservation = z.strictObject({
	...probeCorrelation,
	kind: z.literal('mcp'),
	isError: z
		.boolean()
		.describe(
			"The MCP envelope's own error flag, true when the tool reported the call failed. Sealed evidence carries it as `responseStatus` 1 for true and 0 for false, since a tool call has no transport status of its own.",
		),
	result: ProbeObservedBody,
})

export const ProbeObservation = z.discriminatedUnion('kind', [
	ApiProbeObservation,
	CommandProbeObservation,
	McpProbeObservation,
])

export type CorpusResolveRequest = z.infer<typeof CorpusResolveRequest>
export type CorpusResolveResponse = z.infer<typeof CorpusResolveResponse>
export type ClockReadRequest = z.infer<typeof ClockReadRequest>
export type ClockReadResponse = z.infer<typeof ClockReadResponse>
export type FileReadRequest = z.infer<typeof FileReadRequest>
export type FileReadResponse = z.infer<typeof FileReadResponse>
export type FileWriteRequest = z.infer<typeof FileWriteRequest>
export type FileWriteResponse = z.infer<typeof FileWriteResponse>
export type ApiProbeRequest = z.infer<typeof ApiProbeRequest>
export type CommandProbeRequest = z.infer<typeof CommandProbeRequest>
export type McpProbeRequest = z.infer<typeof McpProbeRequest>
export type ProbeRequest = z.infer<typeof ProbeRequest>
export type ApiProbeObservation = z.infer<typeof ApiProbeObservation>
export type CommandProbeObservation = z.infer<typeof CommandProbeObservation>
export type McpProbeObservation = z.infer<typeof McpProbeObservation>
export type ProbeObservation = z.infer<typeof ProbeObservation>
