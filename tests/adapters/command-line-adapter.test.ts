import { chmodSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
	buildArgv,
	type CommandMechanism,
	createCommandLineAdapter,
} from '../../src/adapters/command-line-adapter.ts'
import type {
	CommandProbeRequest,
	ProbeRequest,
} from '../../src/core/schemas/port-messages.ts'
import type {
	CommandTargetAuthorization,
	CommandTargetPolicy,
} from '../../src/core/schemas/probe-policy.ts'

const FIXTURE_PATH = fileURLToPath(
	new URL('./fixtures/command-probe-fixture.mjs', import.meta.url),
)

beforeAll(() => {
	chmodSync(FIXTURE_PATH, 0o755)
})

function authorization(
	overrides: Partial<CommandTargetAuthorization> = {},
): CommandTargetAuthorization {
	return {
		interfaceId: 'devtools',
		executable: 'probe-cli',
		target: FIXTURE_PATH,
		permittedSubcommandPaths: [[]],
		permittedEnvironmentKeys: [],
		cwd: tmpdir(),
		artifacts: {},
		maxElapsedMs: 2000,
		maxOutputBytes: 4096,
		...overrides,
	}
}

function policyOf(
	...authorizations: CommandTargetAuthorization[]
): CommandTargetPolicy {
	return { authorizations }
}

function request(
	overrides: Partial<CommandProbeRequest> = {},
): CommandProbeRequest {
	return {
		kind: 'cli',
		probeId: 'p1',
		interfaceId: 'devtools',
		operationId: 'op1',
		executable: 'probe-cli',
		subcommandPath: [],
		channels: {
			argument: {},
			option: {},
			environment: {},
			stdin: { kind: 'absent' },
		},
		...overrides,
	}
}

describe('createCommandLineAdapter, policy denial', () => {
	it('never calls the mechanism when the interface is unmapped', async () => {
		let calls = 0
		const mechanism: CommandMechanism = {
			run: async () => {
				calls++
				throw new Error('should not run')
			},
			readArtifact: async () => ({
				present: false,
				text: '',
				truncated: false,
			}),
		}
		const adapter = createCommandLineAdapter(
			policyOf(authorization()),
			mechanism,
		)
		await expect(
			adapter.probe(
				request({ interfaceId: 'unmapped' }),
				new AbortController().signal,
			),
		).rejects.toMatchObject({ code: 'forbidden-target' })
		expect(calls).toBe(0)
	})

	it('never calls the mechanism when the subcommand path is not authorized', async () => {
		let calls = 0
		const mechanism: CommandMechanism = {
			run: async () => {
				calls++
				throw new Error('should not run')
			},
			readArtifact: async () => ({
				present: false,
				text: '',
				truncated: false,
			}),
		}
		const adapter = createCommandLineAdapter(
			policyOf(authorization({ permittedSubcommandPaths: [['status']] })),
			mechanism,
		)
		await expect(
			adapter.probe(
				request({ subcommandPath: ['push'] }),
				new AbortController().signal,
			),
		).rejects.toMatchObject({ code: 'forbidden-target' })
		expect(calls).toBe(0)
	})

	it('denies an api request the same way: no target is ever authorized', async () => {
		let calls = 0
		const mechanism: CommandMechanism = {
			run: async () => {
				calls++
				throw new Error('should not run')
			},
			readArtifact: async () => ({
				present: false,
				text: '',
				truncated: false,
			}),
		}
		const adapter = createCommandLineAdapter(
			policyOf(authorization()),
			mechanism,
		)
		const apiRequest: ProbeRequest = {
			kind: 'api',
			probeId: 'p1',
			interfaceId: 'devtools',
			operationId: 'op1',
			method: 'GET',
			pathTemplate: '/health',
			channels: { path: {}, query: {}, header: {}, body: { kind: 'absent' } },
		}
		await expect(
			adapter.probe(apiRequest, new AbortController().signal),
		).rejects.toMatchObject({ code: 'forbidden-target' })
		expect(calls).toBe(0)
	})

	// The request union carries a third kind now, so the denial message has to
	// name the one that arrived. It read "no api target is ever authorized" for
	// every kind it refused, which describes the wrong mechanism to a reader
	// pointing a command adapter at a tool-server contract.
	it('denies a tool-call request and names its kind', async () => {
		let calls = 0
		const mechanism: CommandMechanism = {
			run: async () => {
				calls++
				throw new Error('should not run')
			},
			readArtifact: async () => ({
				present: false,
				text: '',
				truncated: false,
			}),
		}
		const adapter = createCommandLineAdapter(
			policyOf(authorization()),
			mechanism,
		)
		const mcpRequest: ProbeRequest = {
			kind: 'mcp',
			probeId: 'p1',
			interfaceId: 'notes-tool-server',
			operationId: 'search-notes',
			toolName: 'search_notes',
			channels: { arguments: { query: 'alpha' } },
		}
		await expect(
			adapter.probe(mcpRequest, new AbortController().signal),
		).rejects.toMatchObject({
			code: 'forbidden-target',
			message: expect.stringContaining('no mcp target is ever authorized'),
		})
		expect(calls).toBe(0)
	})
})

describe('createCommandLineAdapter, argv construction', () => {
	it('builds options before positionals, both in record order, booleans as bare flags', () => {
		const argv = buildArgv({
			argument: { first: 'alpha', second: 'beta' },
			option: { verbose: true, quiet: false, level: 3 },
			environment: {},
			stdin: { kind: 'absent' },
		})
		expect(argv).toEqual(['--verbose', '--level', '3', 'alpha', 'beta'])
	})

	it('repeats an option once per element when its value is an array, in the array order', () => {
		const argv = buildArgv({
			argument: {},
			option: { 'env-pass': ['HOME', 'USER'], agent: 'claude' },
			environment: {},
			stdin: { kind: 'absent' },
		})
		expect(argv).toEqual([
			'--env-pass',
			'HOME',
			'--env-pass',
			'USER',
			'--agent',
			'claude',
		])
	})

	it('emits nothing for an empty array, the same as a false flag', () => {
		const argv = buildArgv({
			argument: {},
			option: { 'agent-arg': [], quiet: false, agent: 'codex' },
			environment: {},
			stdin: { kind: 'absent' },
		})
		expect(argv).toEqual(['--agent', 'codex'])
	})

	it('expands an array positional into one token per element', () => {
		const argv = buildArgv({
			argument: { paths: ['a.spec.ts', 'b.spec.ts'], mode: 'strict' },
			option: {},
			environment: {},
			stdin: { kind: 'absent' },
		})
		expect(argv).toEqual(['a.spec.ts', 'b.spec.ts', 'strict'])
	})

	it('keeps an array element that looks like a flag as one literal token', () => {
		const argv = buildArgv({
			argument: {},
			option: { 'agent-arg': ['--dangerously-skip-permissions', '; rm -rf /'] },
			environment: {},
			stdin: { kind: 'absent' },
		})
		expect(argv).toEqual([
			'--agent-arg',
			'--dangerously-skip-permissions',
			'--agent-arg',
			'; rm -rf /',
		])
	})
})

describe('createCommandLineAdapter, real spawn', () => {
	let scratchDir: string

	beforeAll(() => {
		scratchDir = mkdtempSync(join(tmpdir(), 'command-adapter-'))
	})
	afterAll(() => {
		rmSync(scratchDir, { recursive: true, force: true })
	})

	it('runs an authorized invocation and observes its stdout, echoing every correlation field', async () => {
		const adapter = createCommandLineAdapter(policyOf(authorization()))
		const observation = await adapter.probe(
			request({ probeId: 'corr-1' }),
			new AbortController().signal,
		)
		expect(observation).toMatchObject({
			kind: 'cli',
			probeId: 'corr-1',
			interfaceId: 'devtools',
			operationId: 'op1',
			exitCode: 0,
		})
		if (observation.kind !== 'cli')
			throw new Error('expected a cli observation')
		expect(observation.stdout.kind).toBe('json')
	})

	it('observes a non-zero exit rather than throwing', async () => {
		const adapter = createCommandLineAdapter(policyOf(authorization()))
		const observation = await adapter.probe(
			request({
				channels: {
					argument: {},
					option: { 'exit-code': 3 },
					environment: {},
					stdin: { kind: 'absent' },
				},
			}),
			new AbortController().signal,
		)
		if (observation.kind !== 'cli')
			throw new Error('expected a cli observation')
		expect(observation.exitCode).toBe(3)
	})

	it('passes a shell-metacharacter argument through as one literal token, never interpreted', async () => {
		const dangerous = '$(echo pwned); rm -rf / #'
		const adapter = createCommandLineAdapter(policyOf(authorization()))
		const observation = await adapter.probe(
			request({
				channels: {
					argument: { payload: dangerous },
					option: {},
					environment: {},
					stdin: { kind: 'absent' },
				},
			}),
			new AbortController().signal,
		)
		if (observation.kind !== 'cli')
			throw new Error('expected a cli observation')
		expect(observation.stdout.kind).toBe('json')
		const payload =
			observation.stdout.kind === 'json' ? observation.stdout.value : undefined
		expect((payload as { argv: string[] }).argv).toEqual([dangerous])
	})

	it('writes the declared stdin to the process and closes the stream', async () => {
		const adapter = createCommandLineAdapter(policyOf(authorization()))
		const observation = await adapter.probe(
			request({
				channels: {
					argument: {},
					option: {},
					environment: {},
					stdin: { kind: 'text', value: 'piped-in' },
				},
			}),
			new AbortController().signal,
		)
		if (observation.kind !== 'cli')
			throw new Error('expected a cli observation')
		const payload =
			observation.stdout.kind === 'json' ? observation.stdout.value : undefined
		expect((payload as { stdin: string }).stdin).toBe('piped-in')
	})

	it('passes permitted environment keys through to the process', async () => {
		// Two keys here and two in the denial below, so an adapter refusing on
		// key count alone fails one of the pair.
		const adapter = createCommandLineAdapter(
			policyOf(
				authorization({
					permittedEnvironmentKeys: ['PROBE_TEST_VAR', 'PROBE_RUN_ID'],
				}),
			),
		)
		const observation = await adapter.probe(
			request({
				channels: {
					argument: {},
					option: {},
					environment: {
						PROBE_TEST_VAR: 'from-contract',
						PROBE_RUN_ID: 'run-1',
					},
					stdin: { kind: 'absent' },
				},
			}),
			new AbortController().signal,
		)
		if (observation.kind !== 'cli')
			throw new Error('expected a cli observation')
		const payload =
			observation.stdout.kind === 'json' ? observation.stdout.value : undefined
		expect(
			(payload as { env: Record<string, string> }).env.PROBE_TEST_VAR,
		).toBe('from-contract')
	})

	it('never calls the mechanism when an environment key is not permitted', async () => {
		// The one command channel that used to reach the process unbounded. The
		// contract author declares the key; this authorization is where the
		// operator says which keys may travel, and a key it omits is refused
		// before anything spawns.
		let calls = 0
		const mechanism: CommandMechanism = {
			run: async () => {
				calls++
				throw new Error('should not run')
			},
			readArtifact: async () => ({
				present: false,
				text: '',
				truncated: false,
			}),
		}
		const adapter = createCommandLineAdapter(
			policyOf(
				authorization({
					permittedEnvironmentKeys: ['PROBE_MODE', 'PROBE_RUN_ID'],
				}),
			),
			mechanism,
		)
		// Two smuggled spellings, each a near-twin of a permitted key by a
		// different route. `PROBE_RUN_ID_2` extends one, so a lookup comparing
		// by prefix or by substring over-permits it; `probe_mode` differs only
		// by case, so a case-insensitive lookup does, and those are two
		// different variables to a process. A key like `AWS_SECRET_ACCESS_KEY`
		// would let a blocklist on credential-shaped names pass this test while
		// reading no allowlist at all.
		//
		// The limit of a two-request fixture: any two distinct strings differ
		// somehow, so a contrived predicate can always separate them. These
		// cover the over-permissive lookups somebody would actually write.
		for (const smuggled of ['PROBE_RUN_ID_2', 'probe_mode']) {
			await expect(
				adapter.probe(
					request({
						channels: {
							argument: {},
							option: {},
							environment: { PROBE_MODE: 'fine', [smuggled]: 'smuggled' },
							stdin: { kind: 'absent' },
						},
					}),
					new AbortController().signal,
				),
			).rejects.toMatchObject({ code: 'forbidden-target' })
		}
		expect(calls).toBe(0)
	})

	it('refuses a declared PATH even when the mapping permits it', async () => {
		// The mapping here is a plain object, which is how every caller supplies
		// one: nothing in this package parses `CommandTargetPolicy`, so the
		// schema's refusal of PATH never runs on this path and the adapter has
		// to refuse it itself. `target` may be a bare command name, and the
		// child environment is what resolves it, so a permitted PATH would pick
		// the binary.
		let calls = 0
		const mechanism: CommandMechanism = {
			run: async () => {
				calls++
				throw new Error('should not run')
			},
			readArtifact: async () => ({
				present: false,
				text: '',
				truncated: false,
			}),
		}
		const adapter = createCommandLineAdapter(
			policyOf(authorization({ permittedEnvironmentKeys: ['PATH', 'Path'] })),
			mechanism,
		)
		for (const key of ['PATH', 'Path']) {
			await expect(
				adapter.probe(
					request({
						channels: {
							argument: {},
							option: {},
							environment: { [key]: '/tmp/evil' },
							stdin: { kind: 'absent' },
						},
					}),
					new AbortController().signal,
				),
			).rejects.toMatchObject({ code: 'forbidden-target' })
		}
		expect(calls).toBe(0)
	})

	it('refuses an environment key carrying a second assignment, at the boundary', async () => {
		// `A=B` as a key reaches a child as a variable `A` whose value carries
		// `B=` in front of the declared one. The allowlist cannot catch that on
		// its own, since an operator can permit the malformed key by the same
		// spelling; the key charset is what closes it, one layer earlier.
		let calls = 0
		const mechanism: CommandMechanism = {
			run: async () => {
				calls++
				throw new Error('should not run')
			},
			readArtifact: async () => ({
				present: false,
				text: '',
				truncated: false,
			}),
		}
		const adapter = createCommandLineAdapter(
			policyOf(authorization({ permittedEnvironmentKeys: ['PROBE_MODE'] })),
			mechanism,
		)
		await expect(
			adapter.probe(
				request({
					channels: {
						argument: {},
						option: {},
						environment: { 'PROBE_MODE=INJECTED': 'x' },
						stdin: { kind: 'absent' },
					},
				}),
				new AbortController().signal,
			),
		).rejects.toMatchObject({ code: 'schema-parse-failure' })
		expect(calls).toBe(0)
	})

	it('captures a declared artifact the process wrote, and reports absent for one it did not', async () => {
		const artifactPath = join(scratchDir, 'written.txt')
		const adapter = createCommandLineAdapter(
			policyOf(
				authorization({
					artifacts: {
						written: artifactPath,
						'never-written': join(scratchDir, 'ghost.txt'),
					},
				}),
			),
		)
		const observation = await adapter.probe(
			request({
				channels: {
					argument: {},
					option: { 'write-artifact': [artifactPath, 'artifact-body'] },
					environment: {},
					stdin: { kind: 'absent' },
				},
			}),
			new AbortController().signal,
		)
		if (observation.kind !== 'cli')
			throw new Error('expected a cli observation')
		expect(observation.artifacts.written).toEqual({
			kind: 'text',
			value: 'artifact-body',
		})
		expect(observation.artifacts['never-written']).toEqual({ kind: 'absent' })
		expect(readFileSync(artifactPath, 'utf8')).toBe('artifact-body')
	})

	it('caps an oversize artifact and throws budget-exhausted, without reading past the cap', async () => {
		const artifactPath = join(scratchDir, 'oversize.txt')
		const adapter = createCommandLineAdapter(
			policyOf(
				authorization({
					artifacts: { report: artifactPath },
					maxOutputBytes: 64,
				}),
			),
		)
		await expect(
			adapter.probe(
				request({
					channels: {
						argument: {},
						option: {
							'write-artifact': [artifactPath, 'x'.repeat(4096)],
						},
						environment: {},
						stdin: { kind: 'absent' },
					},
				}),
				new AbortController().signal,
			),
		).rejects.toMatchObject({ code: 'budget-exhausted' })
	})

	it('caps wall-clock time and throws budget-exhausted, killing the process', async () => {
		const adapter = createCommandLineAdapter(
			policyOf(authorization({ maxElapsedMs: 100 })),
		)
		await expect(
			adapter.probe(
				request({
					channels: {
						argument: {},
						option: { 'sleep-ms': 5000 },
						environment: {},
						stdin: { kind: 'absent' },
					},
				}),
				new AbortController().signal,
			),
		).rejects.toMatchObject({ code: 'budget-exhausted' })
	})

	it('caps output bytes and throws budget-exhausted, killing the process', async () => {
		const adapter = createCommandLineAdapter(
			policyOf(authorization({ maxOutputBytes: 64 })),
		)
		await expect(
			adapter.probe(
				request({
					channels: {
						argument: {},
						option: { 'big-output': 4096 },
						environment: {},
						stdin: { kind: 'absent' },
					},
				}),
				new AbortController().signal,
			),
		).rejects.toMatchObject({ code: 'budget-exhausted' })
	})

	it('rejects with the aborted fault when the signal aborts mid-run', async () => {
		const adapter = createCommandLineAdapter(
			policyOf(authorization({ maxElapsedMs: 5000 })),
		)
		const controller = new AbortController()
		const call = adapter.probe(
			request({
				channels: {
					argument: {},
					option: { 'sleep-ms': 2000 },
					environment: {},
					stdin: { kind: 'absent' },
				},
			}),
			controller.signal,
		)
		queueMicrotask(() => controller.abort())
		await expect(call).rejects.toMatchObject({ code: 'aborted' })
	})
})
