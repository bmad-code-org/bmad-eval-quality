/** AD-35's default-deny target authorization, as a declared mapping. */
import { z } from 'zod'
import { HttpMethod } from './interface.ts'
import {
	EnvironmentKeyName,
	Identifier,
	KeyName,
	ToolName,
} from './primitives.ts'

/**
 * One authorized target. AD-35: "An adapter denies by default and permits only
 * what that mapping names." Every field is required and none has a default:
 * an omitted cap is an unbounded cap, which is the failure this declaration
 * exists to prevent.
 */
export const ProbeTargetAuthorization = z.strictObject({
	interfaceId: Identifier.describe(
		'The logical identifier the contract names. This mapping is where it becomes a target, outside the contract.',
	),
	scheme: z.enum(['http', 'https']),
	host: z.string().min(1),
	port: z.int().min(1).max(65535),
	addresses: z
		.array(z.string().min(1))
		.min(1)
		.describe(
			'The exact resolved addresses this authorization permits, compared after parsing rather than as strings. AD-35 requires every resolved address and every redirect to be revalidated, and requires a loopback, private, link-local, or metadata address to be authorized explicitly rather than by class, so the authorization names addresses rather than a range.',
		),
	methods: z.array(HttpMethod).min(1),
	safeMethods: z
		.array(HttpMethod)
		.describe(
			'AD-35: "Differential body-sensitivity probes use only methods the mapping marks safe for that target." Empty is legal and means no method is safe for a differential here; it is not a synonym for "all of them".',
		),
	maxRedirects: z.int().min(0),
	maxElapsedMs: z.int().min(1),
	maxRequestBytes: z.int().min(1),
	maxResponseBytes: z.int().min(1),
})

export const ProbeTargetPolicy = z.strictObject({
	authorizations: z
		.array(ProbeTargetAuthorization)
		.describe(
			'An empty array is legal and authorizes nothing, which is the default-deny base case and must stay representable.',
		),
})

export type ProbeTargetAuthorization = z.infer<typeof ProbeTargetAuthorization>
export type ProbeTargetPolicy = z.infer<typeof ProbeTargetPolicy>

/**
 * One authorized command target, AD-35's mapping for the `cli` mechanism.
 * `probe-conformance.ts`'s own published note had recorded that this shape
 * did not exist: `ProbeTargetPolicy` above is entirely HTTP-shaped, and
 * "a command interface cannot be authorized at all" without one.
 *
 * Keyed by `(interfaceId, executable)` rather than `interfaceId` alone,
 * because `CommandInvocation` is declared per operation (AD-19), not per
 * interface: two operations under one CLI interface may name two different
 * logical executables. Everything else about the pair is shared the way host
 * and port are shared across an HTTP authorization's methods.
 */
export const CommandTargetAuthorization = z.strictObject({
	interfaceId: Identifier.describe(
		'The logical interface identifier the contract names.',
	),
	executable: Identifier.describe(
		'The logical executable name a CommandInvocation declares. Paired with interfaceId since one interface may declare more than one.',
	),
	target: z
		.string()
		.min(1)
		.describe(
			'The real, spawnable command: an absolute path, or a name the adapter resolves through its own PATH. Never taken from the contract, which never carries one (AD-35).',
		),
	permittedSubcommandPaths: z
		.array(z.array(Identifier))
		.min(1)
		.describe(
			'The exact subcommand paths this authorization allows, compared literally the way AD-40 compares them. An empty inner array authorizes invoking target with no subcommand. A path the request declares that matches none of these is denied before target is ever spawned, the same role methods plays on the HTTP side.',
		),
	permittedEnvironmentKeys: z
		.array(EnvironmentKeyName)
		.refine((keys) => !keys.some((key) => key.toUpperCase() === 'PATH'), {
			message:
				'PATH cannot be permitted: target may name a bare command, and a declared PATH would then choose which binary runs',
		})
		.describe(
			'The environment keys a request may carry into the process. `CommandProbeRequest.channels.environment` is declared by the contract author, and this is where the operator bounds it: a key absent from this list is denied before target is ever spawned, the same role permittedSubcommandPaths plays for a subcommand. An empty array is legal and permits no declared key, which is the default-deny base case. PATH is refused outright, because target may be "a name the adapter resolves through its own PATH" and the child environment is what resolves it: permitting PATH would hand executable selection to the contract author, which is the direction AD-35 exists to prevent. That refusal is narrow and covers executable selection alone. A key such as LD_PRELOAD or NODE_OPTIONS injects into the binary the mapping already chose, and this list is what keeps such a key out: naming one here is a deliberate act. The adapter refuses PATH again at its own boundary, since nothing in this package parses this policy and a refinement leaves no trace in the TypeScript type. The adapter\'s own PATH reaches the child from the process the mapping launched, under AD-18.',
		),
	cwd: z
		.string()
		.min(1)
		.describe(
			'The working directory every invocation runs from. Declared rather than inherited from the adapter process, so a relative artifact path below resolves against a target the mapping names rather than wherever the host process happened to start.',
		),
	artifacts: z
		.record(Identifier, z.string().min(1))
		.describe(
			"Where each declared artifact identifier reads from on disk, relative to cwd unless absolute. `CommandProbeObservation.artifacts` is keyed by these identifiers; one this run did not write resolves `absent` rather than missing the key, since the record itself is mandatory. An identifier absent from this map can never appear in an observation, which is the same disclosure boundary AD-35 draws around target itself: an operation may declare an artifact the mapping has no path for, and that operation's pre-flight runs with that artifact permanently absent until the mapping is extended.",
		),
	maxElapsedMs: z
		.int()
		.min(1)
		.describe(
			'Wall-clock budget for one invocation. Exceeding it kills the process and throws budget-exhausted, the same fault an HTTP cap throws.',
		),
	maxOutputBytes: z
		.int()
		.min(1)
		.describe(
			'Applies independently to stdout, to stderr, and to each artifact file read back. The first channel to cross it kills the process (for stdout/stderr, mid-run) or fails the read (for an artifact, after exit) with budget-exhausted.',
		),
})

export const CommandTargetPolicy = z.strictObject({
	authorizations: z
		.array(CommandTargetAuthorization)
		.describe(
			'An empty array is legal and authorizes nothing, the same default-deny base case as ProbeTargetPolicy.',
		),
})

export type CommandTargetAuthorization = z.infer<
	typeof CommandTargetAuthorization
>
export type CommandTargetPolicy = z.infer<typeof CommandTargetPolicy>

/**
 * One authorized tool server, AD-35's mapping for the `mcp` mechanism.
 *
 * Keyed by `interfaceId` alone. A `cli` authorization is keyed by
 * `(interfaceId, executable)` because `CommandInvocation` is declared per
 * operation and one interface may name two executables. A tool session has no
 * such split: it is opened against one server and every tool it offers belongs
 * to that server, so the interface identifier is the server identity, which is
 * how the HTTP authorization is keyed too.
 *
 * Two of the eight fields are authorization-scoped, `interfaceId` and `tools`.
 * The other six are what an authorized call runs with, the way `cwd`,
 * `artifacts`, and the two caps sit on a command authorization without adding
 * a denial of their own.
 */
export const McpTargetAuthorization = z.strictObject({
	interfaceId: Identifier.describe(
		'The logical interface identifier the contract names, which for this mechanism is the server identity. This mapping is where it becomes a launchable server, outside the contract.',
	),
	target: z
		.string()
		.min(1)
		.describe(
			'The real, spawnable command that starts the server: an absolute path, or a name the adapter resolves through its own PATH. Never taken from the contract, which never carries one (AD-35).',
		),
	targetArgs: z
		.array(z.string())
		.describe(
			'The argument vector target is launched with, passed as an array so no value is ever concatenated into a shell string. Empty is legal and launches target with no arguments.',
		),
	tools: z
		.array(ToolName)
		.min(1)
		.describe(
			"The tools this authorization permits, in the server's own spelling, compared literally. A toolName the request names that is absent from this list is denied before the server process starts, the same role permittedSubcommandPaths plays on the command side. That draws AD-35's disclosure boundary around the tool as well as the server: a tool the list omits is unreachable through this adapter even when the server publishes it.",
		),
	cwd: z
		.string()
		.min(1)
		.describe(
			'The working directory the server runs from. Declared rather than inherited from the adapter process, so a server resolving a relative fixture path resolves it against a directory the mapping names.',
		),
	serverEnvironment: z
		.record(KeyName, z.string())
		.describe(
			"The environment the server process is launched with, over a base of the host's own PATH so a target naming a bare command still resolves; a declared PATH key wins over that default. A tool call's only channel is its arguments, so a server needing a credential has nowhere else to receive one, and port-messages.ts places that material here: authorization material is the adapter's, supplied by the same mapping that authorizes the target (AD-18).",
		),
	maxElapsedMs: z
		.int()
		.min(1)
		.max(2_147_483_647)
		.describe(
			'Wall-clock budget for the whole port invocation: server launch, the initialize handshake, the tool call, and teardown. A handshake that never completes and a tool call that never answers are the same event to the caller, and both throw budget-exhausted. Bounded above by the largest delay a timer accepts: a larger value is silently clamped to one millisecond, which turns a generous budget into an immediate cap.',
		),
	maxOutputBytes: z
		.int()
		.min(1)
		.describe(
			"Applies independently to the bytes the server writes on stdout, which carry the tool result, and to the bytes it writes on its own stderr, which MCP's stdio transport reserves for logging. The first stream to cross it tears the session down with budget-exhausted.",
		),
})

export const McpTargetPolicy = z.strictObject({
	authorizations: z
		.array(McpTargetAuthorization)
		.refine(
			(authorizations) =>
				new Set(authorizations.map((each) => each.interfaceId)).size ===
				authorizations.length,
			{
				message:
					'two authorizations name one interfaceId, so which server the interface resolves to would depend on which tool was asked for',
			},
		)
		.describe(
			'An empty array is legal and authorizes nothing, the same default-deny base case as ProbeTargetPolicy. One entry per interfaceId: the interface identifier is the server identity for this mechanism, so a second entry naming it could point one logical interface at a second binary. That is the difference from CommandTargetPolicy, whose entries are keyed by (interfaceId, executable) and so cannot disagree about what runs.',
		),
})

export type McpTargetAuthorization = z.infer<typeof McpTargetAuthorization>
export type McpTargetPolicy = z.infer<typeof McpTargetPolicy>
