import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { getEventListeners } from 'node:events'
import {
	chmodSync,
	existsSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
	buildArgv,
	type CommandMechanism,
	createCommandLineAdapter,
	nodeCommandMechanism,
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
		// one: the adapter never parses `CommandTargetPolicy`, so the
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

	// A chunk boundary inside a multi-byte character: the target writes the
	// first two bytes of a euro sign, pauses so they arrive as a chunk of their
	// own, then writes the last byte, four times over, so a runner that merges
	// some writes still sees splits. Decoded chunk by chunk, each split
	// character becomes U+FFFD, and the replacements' bytes count against the
	// cap.
	const splitWriter = (stream: 'stdout' | 'stderr') =>
		`{ const out = process.${stream}
		let left = 4
		const next = () => {
			if (left-- === 0) return
			out.write(Buffer.from([0xe2, 0x82]))
			setTimeout(() => { out.write(Buffer.from([0xac])); setTimeout(next, 40) }, 40)
		}
		next() }`

	const runNode = (source: string, maxOutputBytes: number) =>
		nodeCommandMechanism.run(
			{
				target: process.execPath,
				subcommandPath: [],
				argv: ['-e', source],
				env: {},
				stdin: { kind: 'absent' },
				cwd: tmpdir(),
				maxElapsedMs: 10_000,
				maxOutputBytes,
			},
			new AbortController().signal,
		)

	it('reassembles output split inside a multi-byte character, on both streams', async () => {
		await expect(
			runNode(`${splitWriter('stdout')}\n${splitWriter('stderr')}`, 4096),
		).resolves.toEqual({ exitCode: 0, stdout: '€€€€', stderr: '€€€€' })
	})

	it.each(['stdout', 'stderr'] as const)(
		'counts the bytes the process wrote on %s against maxOutputBytes, before decoding',
		async (stream) => {
			const result = await runNode(splitWriter(stream), 12)
			expect(result[stream]).toBe('€€€€')
		},
	)

	// The decoder holds an incomplete sequence back; the end of the stream
	// flushes it as one replacement, the same text the whole-output decode gave.
	it('keeps a trailing incomplete character as one replacement', async () => {
		await expect(
			runNode('process.stdout.write(Buffer.from([0x61, 0xe2, 0x82]))', 4096),
		).resolves.toMatchObject({ stdout: 'a\uFFFD' })
	})

	// Budgets past what one timer holds reach a timer through a typed policy,
	// which no adapter parses; `setTimeout` would turn them into 1 ms.
	it('keeps an elapsed budget past what one timer holds from capping at once', async () => {
		await expect(
			nodeCommandMechanism.run(
				{
					target: '/bin/sleep',
					subcommandPath: [],
					argv: ['0.3'],
					env: {},
					stdin: { kind: 'absent' },
					cwd: tmpdir(),
					maxElapsedMs: 2_147_483_648,
					maxOutputBytes: 4096,
				},
				new AbortController().signal,
			),
		).resolves.toMatchObject({ exitCode: 0 })
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

/**
 * A target that starts the process doing the work, the shape of an agent
 * runner that spawns a model CLI, of `npx`, and of a shell wrapper. The
 * fixture records its grandchild's pid, so each case can ask whether the kill
 * reached past the direct child. A grandchild a case expects alive is killed
 * inside that case; one expected dead is never signalled again, since its pid
 * may already belong to another process.
 */
describe.skipIf(process.platform === 'win32')(
	'createCommandLineAdapter, process group',
	() => {
		let pidDir: string

		beforeAll(() => {
			pidDir = mkdtempSync(join(tmpdir(), 'command-adapter-pgroup-'))
		})
		afterAll(() => {
			rmSync(pidDir, { recursive: true, force: true })
		})

		const pidFileFor = (name: string): string => join(pidDir, `${name}.pid`)

		const grandchildOf = (file: string): number => {
			const pid = Number(readFileSync(file, 'utf8'))
			// Zero or a negative number would signal a whole process group.
			expect(Number.isInteger(pid) && pid > 0).toBe(true)
			return pid
		}

		const alive = (pid: number): boolean => {
			try {
				// Signal 0 checks for existence without delivering anything.
				process.kill(pid, 0)
				return true
			} catch {
				return false
			}
		}

		/** A killed process is reaped asynchronously, so this polls rather than reading once. */
		const isDeadWithin = async (
			pid: number,
			budgetMs: number,
		): Promise<boolean> => {
			const until = Date.now() + budgetMs
			while (Date.now() < until) {
				if (!alive(pid)) return true
				await new Promise((settle) => setTimeout(settle, 25))
			}
			return !alive(pid)
		}

		const pidFileWritten = async (file: string): Promise<void> => {
			const until = Date.now() + 10_000
			while (!existsSync(file)) {
				if (Date.now() > until) throw new Error(`${file} was never written`)
				await new Promise((settle) => setTimeout(settle, 25))
			}
		}

		const probeWith = (
			option: CommandProbeRequest['channels']['option'],
			overrides: Partial<CommandTargetAuthorization>,
			signal: AbortSignal = new AbortController().signal,
		) =>
			createCommandLineAdapter(policyOf(authorization(overrides))).probe(
				request({
					channels: {
						argument: {},
						option,
						environment: {},
						stdin: { kind: 'absent' },
					},
				}),
				signal,
			)

		it('kills the grandchild a target started when maxElapsedMs is exceeded', async () => {
			const pidFile = pidFileFor('elapsed')
			await expect(
				probeWith(
					{ 'spawn-grandchild': pidFile, 'sleep-ms': 10_000 },
					{ maxElapsedMs: 2000 },
				),
			).rejects.toMatchObject({ code: 'budget-exhausted' })
			expect(await isDeadWithin(grandchildOf(pidFile), 2000)).toBe(true)
		})

		it('kills the grandchild a target started when maxOutputBytes is exceeded', async () => {
			const pidFile = pidFileFor('output')
			await expect(
				probeWith(
					{
						'spawn-grandchild': pidFile,
						'big-output': 4096,
						'sleep-ms': 10_000,
					},
					{ maxOutputBytes: 64, maxElapsedMs: 10_000 },
				),
			).rejects.toMatchObject({ code: 'budget-exhausted' })
			expect(await isDeadWithin(grandchildOf(pidFile), 2000)).toBe(true)
		})

		it('kills the grandchild a target started when the caller aborts', async () => {
			const pidFile = pidFileFor('aborted')
			const controller = new AbortController()
			const call = probeWith(
				{ 'spawn-grandchild': pidFile, 'sleep-ms': 10_000 },
				{ maxElapsedMs: 10_000 },
				controller.signal,
			)
			await pidFileWritten(pidFile)
			controller.abort()
			await expect(call).rejects.toMatchObject({ code: 'aborted' })
			expect(await isDeadWithin(grandchildOf(pidFile), 2000)).toBe(true)
		})

		// The target exits on its own, but the grandchild inherited its stdout,
		// so the pipe stays open and `close` never fires. Killing the direct
		// child alone reaches nothing, since it has already exited, and the run
		// never settles; the group kill ends it at the elapsed cap.
		it('ends a run whose exited target left a grandchild holding stdout open', async () => {
			const pidFile = pidFileFor('holding')
			await expect(
				probeWith(
					{ 'spawn-grandchild-holding-stdout': pidFile },
					{ maxElapsedMs: 500 },
				),
			).rejects.toMatchObject({ code: 'budget-exhausted' })
			expect(await isDeadWithin(grandchildOf(pidFile), 2000)).toBe(true)
		})

		// A grandchild in a session of its own is out of reach of the group
		// kill. The run still ends at the cap, since this end of the pipes is
		// closed rather than waited on.
		it('ends a run at the cap when the process holding stdout escaped the group', async () => {
			const pidFile = pidFileFor('escaped')
			const started = Date.now()
			try {
				await expect(
					probeWith(
						{ 'spawn-escaped-grandchild-holding-stdout': pidFile },
						{ maxElapsedMs: 500 },
					),
				).rejects.toMatchObject({ code: 'budget-exhausted' })
				expect(Date.now() - started).toBeLessThan(5000)
			} finally {
				process.kill(grandchildOf(pidFile), 'SIGKILL')
			}
		})

		// Spawn's own `signal` option removes its listener only on 'exit', which
		// a failed spawn never emits, so a signal reused across probes collected
		// one listener per failure.
		it('leaves no listener on a reused signal after a failed spawn', async () => {
			const controller = new AbortController()
			for (let attempt = 0; attempt < 3; attempt++) {
				await expect(
					nodeCommandMechanism.run(
						{
							target: join(pidDir, 'no-such-executable'),
							subcommandPath: [],
							argv: [],
							env: {},
							stdin: { kind: 'absent' },
							cwd: tmpdir(),
							maxElapsedMs: 5000,
							maxOutputBytes: 4096,
						},
						controller.signal,
					),
				).rejects.toMatchObject({ code: 'ENOENT' })
			}
			expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0)
		})

		// The target no longer shares the host's process group, so a host that
		// exits mid-run has to take the run's group down itself.
		it('kills the group of an in-flight run when the host process exits', async () => {
			const pidFile = pidFileFor('host-exit')
			const adapterPath = fileURLToPath(
				new URL('../../src/adapters/command-line-adapter.ts', import.meta.url),
			)
			const host = `
				import { nodeCommandMechanism } from ${JSON.stringify(adapterPath)}
				import { existsSync } from 'node:fs'
				nodeCommandMechanism.run({
					target: ${JSON.stringify(FIXTURE_PATH)},
					subcommandPath: [],
					argv: ['--spawn-grandchild', ${JSON.stringify(pidFile)}, '--sleep-ms', '10000'],
					env: { PATH: process.env.PATH ?? '' },
					stdin: { kind: 'absent' },
					cwd: ${JSON.stringify(tmpdir())},
					maxElapsedMs: 20000,
					maxOutputBytes: 4096,
				}, new AbortController().signal).catch(() => {})
				const poll = setInterval(() => {
					if (existsSync(${JSON.stringify(pidFile)})) process.exit(0)
				}, 25)
			`
			const exitCode = await new Promise<number | null>((settle) => {
				const child = spawn(
					process.execPath,
					['--input-type=module', '-e', host],
					{ stdio: 'ignore' },
				)
				child.once('close', settle)
			})
			expect(exitCode).toBe(0)
			expect(await isDeadWithin(grandchildOf(pidFile), 2000)).toBe(true)
		})

		const runRequest = (argv: string[]) => ({
			target: FIXTURE_PATH,
			subcommandPath: [],
			argv,
			env: { PATH: process.env.PATH ?? '' },
			stdin: { kind: 'absent' as const },
			cwd: tmpdir(),
			maxElapsedMs: 10_000,
			maxOutputBytes: 4096,
		})

		const rejectionOf = async (
			pending: Promise<unknown>,
		): Promise<Error & { code?: unknown }> => {
			const error = await pending.then(
				() => undefined,
				(thrown: unknown) => thrown,
			)
			expect(error).toBeInstanceOf(Error)
			return error as Error & { code?: unknown }
		}

		// `nodeCommandMechanism` is exported, so the rejection spawn's own
		// `signal` option produced is part of its contract.
		it('rejects with the AbortError shape spawn produced, mid-run', async () => {
			const pidFile = pidFileFor('abort-shape')
			const controller = new AbortController()
			const reason = new Error('caller gave up')
			const pending = nodeCommandMechanism.run(
				runRequest(['--spawn-grandchild', pidFile, '--sleep-ms', '10000']),
				controller.signal,
			)
			await pidFileWritten(pidFile)
			controller.abort(reason)
			const error = await rejectionOf(pending)
			expect(error.name).toBe('AbortError')
			expect(error.constructor.name).toBe('AbortError')
			expect(error.code).toBe('ABORT_ERR')
			expect(error.cause).toBe(reason)
			expect(await isDeadWithin(grandchildOf(pidFile), 2000)).toBe(true)
		})

		it('rejects with the AbortError shape spawn produced, pre-aborted', async () => {
			const controller = new AbortController()
			const reason = new Error('aborted before the call')
			controller.abort(reason)
			const error = await rejectionOf(
				nodeCommandMechanism.run(runRequest([]), controller.signal),
			)
			expect(error.name).toBe('AbortError')
			expect(error.constructor.name).toBe('AbortError')
			expect(error.code).toBe('ABORT_ERR')
			expect(error.cause).toBe(reason)
		})

		// The launcher shape again, down the host-exit path: the target has
		// exited, the grandchild it started still holds stdout in its group, and
		// the run is still in flight when the host exits.
		it('kills the group of a run whose target exited when the host process exits', async () => {
			const pidFile = pidFileFor('host-exit-holding')
			const adapterPath = fileURLToPath(
				new URL('../../src/adapters/command-line-adapter.ts', import.meta.url),
			)
			const host = `
				import { nodeCommandMechanism } from ${JSON.stringify(adapterPath)}
				import { existsSync } from 'node:fs'
				nodeCommandMechanism.run({
					target: ${JSON.stringify(FIXTURE_PATH)},
					subcommandPath: [],
					argv: ['--spawn-grandchild-holding-stdout', ${JSON.stringify(pidFile)}],
					env: { PATH: process.env.PATH ?? '' },
					stdin: { kind: 'absent' },
					cwd: ${JSON.stringify(tmpdir())},
					maxElapsedMs: 20000,
					maxOutputBytes: 4096,
				}, new AbortController().signal).catch(() => {})
				const poll = setInterval(() => {
					if (existsSync(${JSON.stringify(pidFile)})) setTimeout(() => process.exit(0), 500)
				}, 25)
			`
			const exitCode = await new Promise<number | null>((settle) => {
				const child = spawn(
					process.execPath,
					['--input-type=module', '-e', host],
					{ stdio: 'ignore' },
				)
				child.once('close', settle)
			})
			expect(exitCode).toBe(0)
			expect(await isDeadWithin(grandchildOf(pidFile), 2000)).toBe(true)
		})

		/** Runs the real mechanism in a host process of its own, so a case can kill that host the way a CI cancellation or `timeout -s KILL` does. */
		const startHost = (argv: string[]) => {
			const adapterPath = fileURLToPath(
				new URL('../../src/adapters/command-line-adapter.ts', import.meta.url),
			)
			const host = `
				import { nodeCommandMechanism } from ${JSON.stringify(adapterPath)}
				await nodeCommandMechanism.run({
					target: ${JSON.stringify(FIXTURE_PATH)},
					subcommandPath: [],
					argv: ${JSON.stringify(argv)},
					env: { PATH: process.env.PATH ?? '' },
					stdin: { kind: 'absent' },
					cwd: ${JSON.stringify(tmpdir())},
					maxElapsedMs: 30000,
					maxOutputBytes: 4096,
				}, new AbortController().signal)
			`
			// Detached, so the host leads a group of its own that a case can
			// kill whole without touching the test runner's.
			const child = spawn(
				process.execPath,
				['--input-type=module', '-e', host],
				{ stdio: 'ignore', detached: true },
			)
			const closed = new Promise<void>((settle) =>
				child.once('close', () => settle()),
			)
			return { child, closed }
		}

		it.each([
			{
				who: 'the host alone',
				slug: 'alone',
				kill: (pid: number) => process.kill(pid, 'SIGKILL'),
			},
			{
				who: "the host's whole process group",
				slug: 'group',
				kill: (pid: number) => process.kill(-pid, 'SIGKILL'),
			},
		])(
			'takes the target and its grandchild down when $who is killed with SIGKILL',
			async ({ slug, kill }) => {
				const targetFile = pidFileFor(`host-kill-target-${slug}`)
				const grandchildFile = pidFileFor(`host-kill-grandchild-${slug}`)
				const { child, closed } = startHost([
					'--write-pid',
					targetFile,
					'--spawn-grandchild',
					grandchildFile,
					'--sleep-ms',
					'20000',
				])
				await pidFileWritten(grandchildFile)
				const target = grandchildOf(targetFile)
				const grandchild = grandchildOf(grandchildFile)
				try {
					kill(child.pid as number)
					await closed
					expect(await isDeadWithin(target, 3000)).toBe(true)
					expect(await isDeadWithin(grandchild, 3000)).toBe(true)
				} finally {
					for (const pid of [target, grandchild]) {
						if (alive(pid)) process.kill(pid, 'SIGKILL')
					}
				}
			},
		)

		// The leader killed on its own leaves the target without its lifeline
		// holder, so the host kills the group and reports the target ended by
		// that kill.
		it('takes the group down and reports SIGKILL when the group leader is killed alone', async () => {
			const targetFile = pidFileFor('leader-kill-target')
			const grandchildFile = pidFileFor('leader-kill-grandchild')
			const pending = nodeCommandMechanism.run(
				{
					target: FIXTURE_PATH,
					subcommandPath: [],
					argv: [
						'--write-pid',
						targetFile,
						'--spawn-grandchild',
						grandchildFile,
						'--sleep-ms',
						'20000',
					],
					env: { PATH: process.env.PATH ?? '' },
					stdin: { kind: 'absent' },
					cwd: tmpdir(),
					maxElapsedMs: 30000,
					maxOutputBytes: 4096,
				},
				new AbortController().signal,
			)
			await pidFileWritten(grandchildFile)
			const target = grandchildOf(targetFile)
			const grandchild = grandchildOf(grandchildFile)
			const leader = Number(
				execFileSync('ps', ['-o', 'ppid=', '-p', String(target)], {
					encoding: 'utf8',
				}).trim(),
			)
			// Without a leader the target's parent is this test process, and the
			// kill below would end the run instead of the case.
			expect(leader).toBeGreaterThan(1)
			expect(leader).not.toBe(process.pid)
			try {
				process.kill(leader, 'SIGKILL')
				await expect(pending).resolves.toMatchObject({ exitCode: -9 })
				expect(await isDeadWithin(target, 2000)).toBe(true)
				expect(await isDeadWithin(grandchild, 2000)).toBe(true)
			} finally {
				for (const pid of [target, grandchild]) {
					if (alive(pid)) process.kill(pid, 'SIGKILL')
				}
			}
		})

		const runDirect = (
			overrides: Partial<Parameters<typeof nodeCommandMechanism.run>[0]>,
		) =>
			nodeCommandMechanism.run(
				{
					target: FIXTURE_PATH,
					subcommandPath: [],
					argv: [],
					env: { PATH: process.env.PATH ?? '' },
					stdin: { kind: 'absent' },
					cwd: tmpdir(),
					maxElapsedMs: 10_000,
					maxOutputBytes: 4096,
					...overrides,
				},
				new AbortController().signal,
			)

		// The target leads its own group, as it did before the watchdog, so a
		// target that signals its group reaches itself and what it started, and
		// nothing between it and the host.
		it('observes a target that signals its own process group as that signal ended it', async () => {
			await expect(
				runDirect({ target: '/bin/sh', argv: ['-c', 'kill -TERM 0; sleep 5'] }),
			).resolves.toMatchObject({ exitCode: -15 })
			await expect(
				runDirect({
					target: '/bin/sh',
					argv: ['-c', 'sleep 5 & kill -TERM -- -$$; sleep 5'],
					maxElapsedMs: 3000,
				}),
			).resolves.toMatchObject({ exitCode: -15 })
		})

		// Spawn refuses these before any process starts, some by throwing and
		// some through 'error', and the rejection is spawn's own, whichever
		// process called spawn.
		it('rejects with the error spawn raised for an argument holding a NUL byte', async () => {
			const error = await runDirect({ argv: ['a\u0000b'] }).then(
				() => undefined,
				(thrown: unknown) => thrown,
			)
			expect(error).toBeInstanceOf(TypeError)
			expect(error).toMatchObject({ code: 'ERR_INVALID_ARG_VALUE' })
		})

		it('rejects with the error spawn raised for a cwd that is a file', async () => {
			await expect(runDirect({ cwd: FIXTURE_PATH })).rejects.toMatchObject({
				code: 'ENOTDIR',
				syscall: 'spawn',
			})
		})

		it('rejects with the whole spawn error however long the arguments are', async () => {
			const missing = join(pidDir, 'no-such-executable')
			const long = 'a'.repeat(200_000)
			const error = await runDirect({ target: missing, argv: [long] }).then(
				() => undefined,
				(thrown: unknown) => thrown,
			)
			expect(error).toBeInstanceOf(Error)
			expect(Object.keys(error as object)).toEqual([
				'errno',
				'code',
				'syscall',
				'path',
				'spawnargs',
			])
			expect(error).toMatchObject({
				code: 'ENOENT',
				path: missing,
				spawnargs: [long],
			})
		})

		// The watchdog's own start, a Node start of its own, is not charged to
		// the target: a budget too small for that start still covers a target
		// that starts and exits at once.
		it('starts the elapsed budget when the target starts', async () => {
			const outcomes: string[] = []
			for (let attempt = 0; attempt < 3; attempt++) {
				outcomes.push(
					await runDirect({
						target: '/bin/echo',
						argv: ['hi'],
						maxElapsedMs: 10,
					}).then(
						() => 'ok',
						(error: { code?: string }) => String(error.code),
					),
				)
			}
			expect(outcomes).toContain('ok')
		})

		// The watchdog runs in '/', and a relative cwd still resolves against
		// the host's own, as spawn resolved it.
		it('resolves a relative cwd against the host process cwd', async () => {
			const result = await runDirect({ target: '/bin/pwd', cwd: '.' })
			expect(realpathSync(result.stdout.trim())).toBe(
				realpathSync(process.cwd()),
			)
		})

		// A target forking as fast as it can: one killpg can miss a child caught
		// mid-fork, so the group is killed until it is gone.
		it('leaves nothing of a forking target when the host is killed with SIGKILL', async () => {
			const targetFile = pidFileFor('forking-target')
			const adapterPath = fileURLToPath(
				new URL('../../src/adapters/command-line-adapter.ts', import.meta.url),
			)
			const script = `echo $$ > ${targetFile}.tmp; mv ${targetFile}.tmp ${targetFile}; i=0; while [ $i -lt 400 ]; do sleep 30 & i=$((i+1)); done; wait`
			const host = `
				import { nodeCommandMechanism } from ${JSON.stringify(adapterPath)}
				await nodeCommandMechanism.run({
					target: '/bin/sh',
					subcommandPath: [],
					argv: ['-c', ${JSON.stringify(script)}],
					env: { PATH: process.env.PATH ?? '' },
					stdin: { kind: 'absent' },
					cwd: ${JSON.stringify(tmpdir())},
					maxElapsedMs: 30000,
					maxOutputBytes: 4096,
				}, new AbortController().signal)
			`
			const child = spawn(
				process.execPath,
				['--input-type=module', '-e', host],
				{ stdio: 'ignore', detached: true },
			)
			const closed = new Promise<void>((settle) =>
				child.once('close', () => settle()),
			)
			await pidFileWritten(targetFile)
			const group = grandchildOf(targetFile)
			const members = (): string =>
				spawnSync('pgrep', ['-g', String(group)], {
					encoding: 'utf8',
				}).stdout.trim()
			try {
				await new Promise((settle) => setTimeout(settle, 30))
				process.kill(child.pid as number, 'SIGKILL')
				await closed
				const until = Date.now() + 3000
				while (members() !== '' && Date.now() < until) {
					await new Promise((settle) => setTimeout(settle, 50))
				}
				expect(members()).toBe('')
			} finally {
				try {
					process.kill(-group, 'SIGKILL')
				} catch {
					// Gone, which is the wanted end state.
				}
			}
		})

		// A normal exit is observed exactly as before: the group is killed only
		// by a cap or an abort, so a process the target deliberately left behind
		// keeps running.
		it('observes a normal exit and leaves what the target started alone', async () => {
			const pidFile = pidFileFor('normal')
			const observation = await probeWith(
				{ 'spawn-grandchild': pidFile, 'exit-code': 2 },
				{ maxElapsedMs: 5000 },
			)
			expect(observation).toMatchObject({ kind: 'cli', exitCode: 2 })
			const grandchild = grandchildOf(pidFile)
			try {
				await new Promise((settle) => setTimeout(settle, 200))
				expect(alive(grandchild)).toBe(true)
			} finally {
				process.kill(grandchild, 'SIGKILL')
			}
		})
	},
)
