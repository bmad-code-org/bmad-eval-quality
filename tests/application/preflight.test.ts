/**
 * `runPreflight` (Story 6.2): the one place a pre-flight probe is awaited. The
 * port is a hand-written fake; no network, no clock, no real adapter (AD-30).
 */
import { describe, expect, it } from 'vitest'
import { runPreflight } from '../../src/application/preflight.ts'
import { StructuralFailure } from '../../src/core/failure-codes.ts'
import { RuntimeFault } from '../../src/core/schemas/faults.ts'
import { PreflightVerdict } from '../../src/core/schemas/preflight-verdict.ts'
import { Probe as ProbeSchema } from '../../src/core/schemas/probe.ts'
import {
	contractDraft,
	parseContract,
	preflightContract,
	probeDraft,
	seededProbe,
} from '../preflight/fixtures/observations.ts'
import { echoPort } from '../preflight/fixtures/probe-port.ts'

const run = (overrides: Partial<Parameters<typeof runPreflight>[0]> = {}) =>
	runPreflight({
		contract: preflightContract,
		probes: [seededProbe],
		runId: 'run-1',
		port: { probe: echoPort() },
		signal: new AbortController().signal,
		...overrides,
	})

const faultOf = async (act: () => Promise<unknown>): Promise<RuntimeFault> => {
	let thrown: unknown
	try {
		await act()
	} catch (error) {
		thrown = error
	}
	expect(thrown).toBeInstanceOf(RuntimeFault)
	return thrown as RuntimeFault
}

/**
 * Literal, written from a green run and frozen. Deriving these from
 * `planPreflight` would make both fixtures below agree with any regression:
 * a plan reduced to zero legs would satisfy `toHaveBeenCalledTimes(0)`, and a
 * reversed order would flip both sides of the comparison together.
 */
const PLANNED_LEG_IDS = [
	'create-a',
	'create-b',
	'read-a',
	'read-b',
	'list-a',
	'list-b',
	'preflight-control-observe',
	'preflight-control-observe-2',
	'fault-leg',
] as const

describe('runPreflight: the port call', () => {
	it('105. calls the probe port exactly once per planned leg', async () => {
		const probe = echoPort()
		await run({ port: { probe } })
		expect(probe).toHaveBeenCalledTimes(9)
		expect(probe).toHaveBeenCalledTimes(PLANNED_LEG_IDS.length)
	})

	// Sequential, never `Promise.all`: the control legs are ordered by
	// construction and a parallel run would reset the fixture underneath
	// another operation's witness.
	it('106. awaits the legs in plan order', async () => {
		const probe = echoPort()
		await run({ port: { probe } })
		expect(probe.mock.calls.map(([request]) => request.probeId)).toEqual([
			...PLANNED_LEG_IDS,
		])
	})

	it('107. rejects with aborted before any call when the signal is already aborted', async () => {
		const probe = echoPort()
		const controller = new AbortController()
		controller.abort(new Error('stopped'))
		const fault = await faultOf(() =>
			run({ port: { probe }, signal: controller.signal }),
		)
		expect(fault.code).toBe('aborted')
		expect(fault.artifactPath).toBe('ProbeRequest')
		expect(probe).not.toHaveBeenCalled()
	})

	it('108. surfaces a port throwing a plain Error as port-failure', async () => {
		const fault = await faultOf(() =>
			run({
				port: {
					probe: async () => {
						throw new Error('socket closed')
					},
				},
			}),
		)
		expect(fault.code).toBe('port-failure')
		expect(fault.artifactPath).toBe('ProbeObservation')
		expect(fault.cause).toBeInstanceOf(Error)
	})

	it('109. surfaces a shape that fails ProbeObservation as port-contract-violation', async () => {
		const fault = await faultOf(() =>
			run({ port: { probe: async () => ({ probeId: 'read-a' }) as never } }),
		)
		expect(fault.code).toBe('port-contract-violation')
		expect(fault.artifactPath).toBe('ProbeObservation')
	})
})

describe('runPreflight: the boundary and the verdict', () => {
	it('110. throws schema-parse-failure on an unparseable contract', async () => {
		const fault = await faultOf(() =>
			run({ contract: { not: 'a contract' } as never }),
		)
		expect(fault.code).toBe('schema-parse-failure')
		expect(fault.artifactPath).toBe('EvalContract')
	})

	// A failed pre-flight is a verdict; a structural failure is not, so it
	// propagates with its code intact rather than becoming a check.
	it('111. lets a StructuralFailure from the plan propagate unchanged', async () => {
		const draft = contractDraft()
		draft.permittedInterfaces[0].kind = 'cli'
		let thrown: unknown
		try {
			await run({ contract: parseContract(draft) })
		} catch (error) {
			thrown = error
		}
		expect(thrown).toBeInstanceOf(StructuralFailure)
		expect((thrown as StructuralFailure).code).toBe(
			'unsupported-interface-kind',
		)
		expect((thrown as StructuralFailure).artifactPath).toBe(
			'EvalContract.permittedInterfaces[logicalId=thing-api].kind',
		)
	})

	it('112. returns a verdict that parses, carrying the run id and a fixture digest', async () => {
		const verdict = await run()
		expect(PreflightVerdict.safeParse(verdict).success).toBe(true)
		expect(verdict.runId).toBe('run-1')
		expect(verdict.fixtureDigest).toMatch(/^sha256:[0-9a-f]{64}$/)
		expect(verdict.passed).toBe(true)
	})

	it('throws schema-parse-failure on an unparseable probe', async () => {
		const draft = probeDraft()
		draft.probeId = 'not-a-probe-id'
		const fault = await faultOf(() => run({ probes: [draft as never] }))
		expect(fault.code).toBe('schema-parse-failure')
		expect(fault.artifactPath).toBe('Probe')
		expect(ProbeSchema.safeParse(draft).success).toBe(false)
	})
})
