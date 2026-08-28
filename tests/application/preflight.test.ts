/**
 * `runPreflight` (Story 6.2): the one place a pre-flight probe is awaited. The
 * port is a hand-written fake; no network, no clock, no real adapter (AD-30).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Diagnostic } from '../../src/application/diagnostics.ts'
import {
	preflightFromObservations,
	runPreflight,
} from '../../src/application/preflight.ts'
import { StructuralFailure } from '../../src/core/failure-codes.ts'
import * as planModule from '../../src/core/preflight/plan.ts'
import { planPreflight } from '../../src/core/preflight/plan.ts'
import * as reduceModule from '../../src/core/preflight/reduce.ts'
import { RuntimeFault } from '../../src/core/schemas/faults.ts'
import { PreflightVerdict } from '../../src/core/schemas/preflight-verdict.ts'
import { Probe as ProbeSchema } from '../../src/core/schemas/probe.ts'
import {
	contractDraft,
	observationsFor,
	parseContract,
	preflightContract,
	probeDraft,
	satisfiedPatches,
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

	it('rejects an empty runId with schema-parse-failure', async () => {
		const fault = await faultOf(() => run({ runId: '' }))
		expect(fault.code).toBe('schema-parse-failure')
		expect(fault.artifactPath).toBe('runId')
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

/**
 * `preflightFromObservations` (Story 6.5): the same verdict for a caller who
 * probed by some other means. Nothing here awaits.
 */

/** the plan the fixture contract and its one seeded probe produce. */
const fixturePlan = () =>
	planPreflight({
		contract: preflightContract,
		probes: [seededProbe],
		runId: 'run-1',
	})

/** one observation per planned leg, bodies that satisfy every check. */
const fullObservations = () => {
	const legs = fixturePlan().legs
	return observationsFor(legs, satisfiedPatches(legs))
}

const fromObservations = (
	overrides: Partial<Parameters<typeof preflightFromObservations>[0]> = {},
) =>
	preflightFromObservations({
		contract: preflightContract,
		probes: [seededProbe],
		runId: 'run-1',
		observations: fullObservations(),
		...overrides,
	})

const syncFaultOf = (act: () => unknown): RuntimeFault => {
	let thrown: unknown
	try {
		act()
	} catch (error) {
		thrown = error
	}
	expect(thrown).toBeInstanceOf(RuntimeFault)
	return thrown as RuntimeFault
}

describe('preflightFromObservations: the boundary parses', () => {
	it('case 105: throws schema-parse-failure naming EvalContract on an unparseable contract', () => {
		const fault = syncFaultOf(() =>
			fromObservations({ contract: { not: 'a contract' } as never }),
		)
		expect(fault.code).toBe('schema-parse-failure')
		expect(fault.artifactPath).toBe('EvalContract')
	})

	it('case 106: throws schema-parse-failure naming Probe on an unparseable probe', () => {
		const draft = probeDraft()
		draft.probeId = 'not-a-probe-id'
		const fault = syncFaultOf(() => fromObservations({ probes: [draft] }))
		expect(fault.code).toBe('schema-parse-failure')
		expect(fault.artifactPath).toBe('Probe')
		expect(ProbeSchema.safeParse(draft).success).toBe(false)
	})

	it('case 107: throws schema-parse-failure naming ProbeObservation on an unparseable observation', () => {
		const fault = syncFaultOf(() =>
			fromObservations({ observations: [{ probeId: 'read-a' } as never] }),
		)
		expect(fault.code).toBe('schema-parse-failure')
		expect(fault.artifactPath).toBe('ProbeObservation')
	})

	// The outbound parse, reached without touching `src/`: `planPreflight`
	// takes `runId` as a plain string and carries it into the verdict, where
	// `PreflightVerdict.runId` is `.min(1)`.
	it('case 108: throws schema-parse-failure naming PreflightVerdict when the reduced verdict fails its schema', () => {
		const fault = syncFaultOf(() => fromObservations({ runId: '' }))
		expect(fault.code).toBe('schema-parse-failure')
		expect(fault.artifactPath).toBe('PreflightVerdict')
	})
})

describe('preflightFromObservations: the verdict and the stream', () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('case 109: returns a frozen verdict', () => {
		const verdict = fromObservations()
		expect(Object.isFrozen(verdict)).toBe(true)
		expect(Object.isFrozen(verdict.checks)).toBe(true)
		expect(PreflightVerdict.safeParse(verdict).success).toBe(true)
	})

	it('case 110: calls planPreflight before reducePreflight, once each', () => {
		const planSpy = vi.spyOn(planModule, 'planPreflight')
		const reduceSpy = vi.spyOn(reduceModule, 'reducePreflight')
		const observations = fullObservations()
		planSpy.mockClear()
		reduceSpy.mockClear()

		// Called directly: `fromObservations` builds its default observations
		// through `planPreflight`, which would show up as a second call.
		preflightFromObservations({
			contract: preflightContract,
			probes: [seededProbe],
			runId: 'run-1',
			observations,
		})

		expect(planSpy).toHaveBeenCalledTimes(1)
		expect(reduceSpy).toHaveBeenCalledTimes(1)
		const planOrder = planSpy.mock.invocationCallOrder[0] as number
		const reduceOrder = reduceSpy.mock.invocationCallOrder[0] as number
		expect(planOrder).toBeLessThan(reduceOrder)
		// The reducer reads the plan the planner produced, so the order is the
		// data dependency and not just a sequence.
		expect(reduceSpy.mock.calls[0]?.[0]).toBe(planSpy.mock.results[0]?.value)
	})

	// The fixture is fully observed on purpose: `invokePort` either returns an
	// observation or throws, so `runPreflight` can never emit the
	// "no observation" line and a partially observed fixture would compare two
	// streams that differ by construction.
	it('case 111: emits the same diagnostic stream as runPreflight over a fully observed fixture', async () => {
		const awaited: Diagnostic[] = []
		const handed: Diagnostic[] = []
		const observations = fullObservations()
		expect(observations).toHaveLength(PLANNED_LEG_IDS.length)

		const awaitedVerdict = await run({ sink: (line) => awaited.push(line) })
		const handedVerdict = fromObservations({
			observations,
			sink: (line) => handed.push(line),
		})

		expect(handed).toEqual(awaited)
		expect(handed.map((line) => line.message)).toContain(
			`reduced ${PLANNED_LEG_IDS.length} leg(s): passed`,
		)
		expect(handedVerdict).toEqual(awaitedVerdict)
	})

	// A partial array is a verdict, not a fault: the per-leg lookup in
	// `reducePreflight` skips a leg with no observation, and the checks that
	// named it fail.
	it('case 112: a partial observation array gives a failed verdict', () => {
		const withoutReadB = fullObservations().filter(
			(observation) => observation.probeId !== 'read-b',
		)
		const verdict = fromObservations({ observations: withoutReadB })

		expect(verdict.passed).toBe(false)
		const failed = verdict.checks.filter((check) => check.outcome === 'failed')
		expect(failed.map((check) => check.kind)).toEqual([
			'interface-present',
			'input-sensitivity',
		])
		for (const check of failed) {
			expect(check.operationId).toBe('read-thing')
			expect(check.note).toContain('read-b')
			expect(check.note).toContain('no observation')
		}
	})
})
