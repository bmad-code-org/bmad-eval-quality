/**
 * AD-37's in-repository command-probe subject: the real shipped adapter, over
 * the real fixture executable, wrapped only to count calls and to script the
 * three synthetic scenarios the six shared assertions need. The `resolves`
 * scenario is real process execution, not a fake value, for the same reason
 * the `api` arm's subject uses a real loopback server rather than a fake HTTP
 * response: a synthetic mechanism would prove nothing about the one thing
 * this adapter exists to get right.
 */
import { chmodSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
	type CommandMechanism,
	type CommandRunResult,
	createCommandLineAdapter,
	nodeCommandMechanism,
} from '../../src/adapters/command-line-adapter.ts'
import type { ProbeRequest } from '../../src/core/schemas/port-messages.ts'
import type { JsonValue } from '../../src/core/schemas/primitives.ts'
import type { CommandTargetPolicy } from '../../src/core/schemas/probe-policy.ts'
import type {
	BuiltSubject,
	ScenarioKind,
} from '../../src/testing/conformance.ts'
import type { CommandProbeSubject } from '../../src/testing/probe-conformance.ts'

export const FIXTURE_PATH = fileURLToPath(
	new URL('./fixtures/command-probe-fixture.mjs', import.meta.url),
)

/** `git` does not preserve the executable bit reliably across every checkout, so this is called once before the fixture is ever spawned rather than trusted to the working tree. */
export function ensureFixtureExecutable(): void {
	chmodSync(FIXTURE_PATH, 0o755)
}

const INTERFACE_ID = 'devtools'
const EXECUTABLE = 'probe-cli'
export const MAX_ELAPSED_MS = 1500
export const MAX_OUTPUT_BYTES = 4096
const ARTIFACT_ID = 'report'
const ARTIFACT_FILE = 'report.txt'
const ARTIFACT_TEXT = 'artifact-body'
const INJECTION_VALUE = '$(echo pwned); rm -rf / #'
const PERMITTED_ENV_KEY = 'PROBE_MODE'
const UNPERMITTED_ENV_KEY = 'AWS_SECRET_ACCESS_KEY'

function commandRequest(params: {
	readonly probeId: string
	readonly interfaceId?: string
	readonly executable?: string
	readonly subcommandPath?: readonly string[]
	readonly argument?: Record<string, JsonValue>
	readonly option?: Record<string, JsonValue>
	readonly environment?: Record<string, string>
}): ProbeRequest {
	return {
		kind: 'cli',
		probeId: params.probeId,
		interfaceId: params.interfaceId ?? INTERFACE_ID,
		operationId: params.probeId,
		executable: params.executable ?? EXECUTABLE,
		subcommandPath: [...(params.subcommandPath ?? [])],
		channels: {
			argument: params.argument ?? {},
			option: params.option ?? {},
			environment: params.environment ?? {},
			stdin: { kind: 'absent' },
		},
	}
}

/** The subject's own single authorization. One entry covers every case below: the only cases that leave it are `unmappedInterfaceRequest` (a different interfaceId) and `unmappedExecutableRequest` (a different executable), neither of which this entry names, `unauthorizedSubcommandRequest`, which names a subcommand path outside `permittedSubcommandPaths`, and `unauthorizedEnvironmentKeyRequest`, which declares a key outside `permittedEnvironmentKeys`. */
function buildPolicy(scratchDir: string): CommandTargetPolicy {
	return {
		authorizations: [
			{
				interfaceId: INTERFACE_ID,
				executable: EXECUTABLE,
				target: FIXTURE_PATH,
				permittedSubcommandPaths: [[]],
				permittedEnvironmentKeys: [PERMITTED_ENV_KEY],
				cwd: scratchDir,
				artifacts: { [ARTIFACT_ID]: ARTIFACT_FILE },
				maxElapsedMs: MAX_ELAPSED_MS,
				maxOutputBytes: MAX_OUTPUT_BYTES,
			},
		],
	}
}

export function createCommandProbeSubject(
	scratchDir: string,
): CommandProbeSubject {
	const policy = buildPolicy(scratchDir)

	const build = async (
		scenario: ScenarioKind,
	): Promise<BuiltSubject<ProbeRequest>> => {
		let calls = 0
		const mechanism: CommandMechanism = {
			run: async (runRequest, signal) => {
				calls++
				if (scenario === 'fails') {
					const error: NodeJS.ErrnoException = new Error(
						'spawn EACCES: permission denied',
					)
					error.code = 'EACCES'
					throw error
				}
				if (scenario === 'in-band-error') {
					// `exitCode` typed `number` and given a string: the mechanism's own
					// contract violated, exactly as the file-system subject's `{ error:
					// 'nope' }` violates its response shape.
					return {
						exitCode: 'not-a-number' as unknown as number,
						stdout: '',
						stderr: '',
					} satisfies CommandRunResult
				}
				if (scenario === 'hangs') {
					// The mechanism deliberately ignores the signal: honouring it is the
					// adapter's obligation under AD-28, and `port-boundary.ts`'s race is
					// what discharges it.
					return new Promise<CommandRunResult>(() => {})
				}
				return nodeCommandMechanism.run(runRequest, signal)
			},
			readArtifact: (path, maxBytes) => {
				if (scenario !== 'resolves') {
					return Promise.resolve({ present: false, text: '', truncated: false })
				}
				return nodeCommandMechanism.readArtifact(path, maxBytes)
			},
		}
		const port = createCommandLineAdapter(policy, mechanism)
		return {
			port: (probeRequest, signal) => port.probe(probeRequest, signal),
			underlyingCalls: () => calls,
		}
	}

	return {
		name: 'createCommandLineAdapter',
		// A killed real process can take a little longer to report than an
		// in-process abort; well clear of MAX_ELAPSED_MS so a slow CI runner
		// cannot turn this into a cap assertion instead.
		abortBudgetMs: 2000,
		sampleRequest: commandRequest({ probeId: 'sample' }),
		build,
		policy,
		// Carries the one permitted environment key, so an adapter that denied
		// every declared key would fail this assertion rather than passing the
		// denial one below on a technicality.
		authorizedRequest: commandRequest({
			probeId: 'authorized',
			environment: { [PERMITTED_ENV_KEY]: 'conformance' },
		}),
		unmappedInterfaceRequest: commandRequest({
			probeId: 'unmapped-interface',
			interfaceId: 'unmapped',
		}),
		unmappedExecutableRequest: commandRequest({
			probeId: 'unmapped-executable',
			executable: 'npm',
		}),
		unauthorizedSubcommandRequest: commandRequest({
			probeId: 'unauthorized-subcommand',
			subcommandPath: ['danger'],
		}),
		unauthorizedEnvironmentKeyRequest: commandRequest({
			probeId: 'unauthorized-environment-key',
			environment: {
				[PERMITTED_ENV_KEY]: 'conformance',
				[UNPERMITTED_ENV_KEY]: 'smuggled',
			},
		}),
		nonZeroExitRequest: commandRequest({
			probeId: 'nonzero-exit',
			option: { 'exit-code': 5 },
		}),
		injectionRequest: commandRequest({
			probeId: 'injection',
			argument: { payload: INJECTION_VALUE },
		}),
		injectionArgumentValue: INJECTION_VALUE,
		artifactRequest: commandRequest({
			probeId: 'artifact',
			option: {
				'write-artifact': [join(scratchDir, ARTIFACT_FILE), ARTIFACT_TEXT],
			},
		}),
		artifactId: ARTIFACT_ID,
		artifactExpectedText: ARTIFACT_TEXT,
		overElapsedRequest: commandRequest({
			probeId: 'over-elapsed',
			option: { 'sleep-ms': MAX_ELAPSED_MS + 2000 },
		}),
		overOutputRequest: commandRequest({
			probeId: 'over-output',
			option: { 'big-output': MAX_OUTPUT_BYTES * 4 },
		}),
	}
}
