/**
 * AD-37's in-repository mcp-probe subject: the real shipped adapter, over the
 * real stdio fixture server, wrapped only to count calls and to script the
 * three synthetic scenarios the six shared assertions need. The `resolves`
 * scenario opens a real session and speaks real JSON-RPC, for the reason the
 * `cli` arm's subject runs a real process: a synthetic mechanism would prove
 * nothing about the one thing this adapter exists to get right.
 *
 * The fixture is launched through `process.execPath` rather than as an
 * executable in its own right, so nothing here has to repair a file mode `git`
 * did not preserve.
 */
import { fileURLToPath } from 'node:url'
import {
	createMcpAdapter,
	type McpCallToolResult,
	type McpMechanism,
	nodeStdioMcpMechanism,
} from '../../src/adapters/mcp-adapter.ts'
import type { ProbeRequest } from '../../src/core/schemas/port-messages.ts'
import type { JsonValue } from '../../src/core/schemas/primitives.ts'
import type { McpTargetPolicy } from '../../src/core/schemas/probe-policy.ts'
import type {
	BuiltSubject,
	ScenarioKind,
} from '../../src/testing/conformance.ts'
import type { McpProbeSubject } from '../../src/testing/probe-conformance.ts'

export const FIXTURE_PATH = fileURLToPath(
	new URL('./fixtures/mcp-probe-fixture.mjs', import.meta.url),
)

const INTERFACE_ID = 'notes-tool-server'
/** A second server entry, because the elapsed cap has to be tight enough to fire quickly and the authorized cases need a budget a real launch fits inside. */
const SLOW_INTERFACE_ID = 'slow-tool-server'

export const MAX_ELAPSED_MS = 5000
export const TIGHT_ELAPSED_MS = 300
export const MAX_OUTPUT_BYTES = 8192

/** The tools this subject's mapping permits. `env_tool` is deliberately absent: it is what `unauthorizedToolRequest` asks for, and the fixture publishes it, so the denial is the mapping's and not the server's. */
const PERMITTED_TOOLS = ['search_notes', 'failing_tool', 'oversize_tool']

/** Metacharacters that a shell would expand and a re-encoding would mangle. A tool call never reaches a command line, so what this proves is that JSON-RPC framing carried the declared value unchanged. */
const ECHO_VALUE = '$(echo pwned); rm -rf / #'
/** Where `search_notes` publishes the query it received. A scalar beside the collection, because a check over an empty collection resolves to insufficient evidence and could witness nothing. */
const ECHO_RESULT_KEY = 'echo'
const STRUCTURED_RESULT_KEYS = ['ok', 'matches', 'totalCount', 'echo']

function mcpRequest(params: {
	readonly probeId: string
	readonly interfaceId?: string
	readonly toolName?: string
	readonly args?: Record<string, JsonValue>
}): ProbeRequest {
	return {
		kind: 'mcp',
		probeId: params.probeId,
		interfaceId: params.interfaceId ?? INTERFACE_ID,
		operationId: params.probeId,
		toolName: params.toolName ?? 'search_notes',
		channels: { arguments: params.args ?? { query: 'alpha' } },
	}
}

function serverAt(
	interfaceId: string,
	tools: readonly string[],
	maxElapsedMs: number,
) {
	return {
		interfaceId,
		target: process.execPath,
		targetArgs: [FIXTURE_PATH],
		tools: [...tools],
		cwd: process.cwd(),
		serverEnvironment: {},
		maxElapsedMs,
		maxOutputBytes: MAX_OUTPUT_BYTES,
	}
}

/** Two entries. Every denial case leaves the policy entirely: `unmappedInterfaceRequest` names no entry, and `unauthorizedToolRequest` names an entry whose `tools` omits the tool it asks for. */
const policy: McpTargetPolicy = {
	authorizations: [
		serverAt(INTERFACE_ID, PERMITTED_TOOLS, MAX_ELAPSED_MS),
		serverAt(SLOW_INTERFACE_ID, ['hanging_tool'], TIGHT_ELAPSED_MS),
	],
}

export function createMcpProbeSubject(): McpProbeSubject {
	const build = async (
		scenario: ScenarioKind,
	): Promise<BuiltSubject<ProbeRequest>> => {
		let calls = 0
		const mechanism: McpMechanism = {
			callTool: async (callRequest, signal) => {
				calls++
				if (scenario === 'fails') {
					const error: NodeJS.ErrnoException = new Error(
						'spawn ENOENT: no such server',
					)
					error.code = 'ENOENT'
					throw error
				}
				if (scenario === 'in-band-error') {
					// `isError` typed `boolean` and given a string: the mechanism's own
					// contract violated, so the assembled observation fails the
					// response parse rather than resolving.
					return {
						isError: 'not-a-boolean' as unknown as boolean,
					} satisfies McpCallToolResult
				}
				if (scenario === 'hangs') {
					// Deliberately ignores the signal: honouring it is the adapter's
					// obligation under AD-28, and `port-boundary.ts`'s race is what
					// discharges it.
					return new Promise<McpCallToolResult>(() => {})
				}
				return nodeStdioMcpMechanism.callTool(callRequest, signal)
			},
		}
		const port = createMcpAdapter(policy, mechanism)
		return {
			port: (probeRequest, signal) => port.probe(probeRequest, signal),
			underlyingCalls: () => calls,
		}
	}

	return {
		name: 'createMcpAdapter',
		// A killed server process can take a little longer to report than an
		// in-process abort; well clear of TIGHT_ELAPSED_MS so a slow runner
		// cannot turn this into a cap assertion instead.
		abortBudgetMs: 2000,
		sampleRequest: mcpRequest({ probeId: 'sample' }),
		build,
		policy,
		authorizedRequest: mcpRequest({ probeId: 'authorized' }),
		unmappedInterfaceRequest: mcpRequest({
			probeId: 'unmapped-interface',
			interfaceId: 'unmapped-server',
		}),
		unauthorizedToolRequest: mcpRequest({
			probeId: 'unauthorized-tool',
			toolName: 'env_tool',
		}),
		errorResultRequest: mcpRequest({
			probeId: 'error-result',
			toolName: 'failing_tool',
		}),
		argumentEchoRequest: mcpRequest({
			probeId: 'argument-echo',
			args: { query: ECHO_VALUE },
		}),
		argumentEchoValue: ECHO_VALUE,
		argumentEchoResultKey: ECHO_RESULT_KEY,
		structuredResultRequest: mcpRequest({ probeId: 'structured-result' }),
		structuredResultKeys: STRUCTURED_RESULT_KEYS,
		overElapsedRequest: mcpRequest({
			probeId: 'over-elapsed',
			interfaceId: SLOW_INTERFACE_ID,
			toolName: 'hanging_tool',
		}),
		overResultBytesRequest: mcpRequest({
			probeId: 'over-result-bytes',
			toolName: 'oversize_tool',
			args: { bytes: MAX_OUTPUT_BYTES * 4 },
		}),
	}
}
