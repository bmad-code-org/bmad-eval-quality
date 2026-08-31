/**
 * AD-37 claims the published conformance suite is enough documentation for an
 * adapter author who has only `eval-quality/conformance` and the README. This
 * file is written under that restriction: the only package specifier it may
 * name is the published subpath, and case 181 reads the file back to keep that
 * mechanical.
 *
 * The subject is a ClockPort over an injectable mechanism. `underlyingCalls`
 * counts mechanism reads, which is what the retry assertion needs to see.
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import {
	type ClockPort,
	type ClockReadRequest,
	CONFORMANCE_OUTCOME_COUNTS,
	formatConformanceReport,
	type PortSubject,
	type RuntimeFaultCode,
	runClockPortConformance,
	type ScenarioKind,
} from 'eval-quality/conformance'
import { describe, expect, it } from 'vitest'

/**
 * AD-28's fault shape read structurally: a `code` and an `artifactPath`. The
 * suite sees faults from a possibly different copy of the package, so it cannot
 * use `instanceof`, and a bare `Error` does not satisfy it. `RuntimeFaultCode`,
 * published on this same subpath, is what lets `code` below be checked against
 * the declared registry instead of a hand-typed string.
 */
class ClockFault extends Error {
	readonly code: RuntimeFaultCode
	readonly artifactPath = 'clock/read'

	constructor(code: RuntimeFaultCode, detail: string) {
		super(detail)
		this.name = 'ClockFault'
		this.code = code
	}
}

/** What the clock returns when it reports failure in band rather than throwing. */
type InBandError = { readonly error: string }

type ClockMechanism = {
	readonly read: () => Promise<string | InBandError>
	readonly calls: () => number
}

/** One fresh mechanism per scenario, each counting its own reads. */
const mechanismFor = (scenario: ScenarioKind): ClockMechanism => {
	let calls = 0
	return {
		calls: () => calls,
		read: async () => {
			calls += 1
			switch (scenario) {
				case 'resolves':
					return new Date(0).toISOString()
				case 'fails':
					throw new Error('clock hardware unavailable')
				case 'in-band-error':
					return { error: 'clock unavailable' }
				case 'hangs':
					return await new Promise<never>(() => {})
			}
		},
	}
}

const describeThrow = (error: unknown): string =>
	error instanceof Error ? error.message : String(error)

/**
 * The adapter. One mechanism read per call, no retry. An abort wins the race
 * against a hanging read, an in-band error becomes a throw, and a mechanism
 * throw is rewrapped as a fault.
 */
const clockAdapter = (mechanism: ClockMechanism): ClockPort => ({
	read: async (_request, signal) => {
		if (signal.aborted) {
			throw new ClockFault(
				'aborted',
				'the clock read was aborted before it started',
			)
		}
		let onAbort = () => {}
		const aborted = new Promise<never>((_resolve, reject) => {
			onAbort = () =>
				reject(new ClockFault('aborted', 'the clock read was aborted'))
			signal.addEventListener('abort', onAbort, { once: true })
		})
		try {
			const read = await Promise.race([mechanism.read(), aborted])
			if (typeof read !== 'string') {
				throw new ClockFault(
					'port-contract-violation',
					`the clock reported ${read.error} in band`,
				)
			}
			return { now: read }
		} catch (error) {
			if (error instanceof ClockFault) throw error
			throw new ClockFault('port-failure', describeThrow(error))
		} finally {
			signal.removeEventListener('abort', onAbort)
		}
	},
})

const subject: PortSubject<ClockReadRequest> = {
	name: 'outside-clock-adapter',
	sampleRequest: {},
	build: async (scenario) => {
		const mechanism = mechanismFor(scenario)
		const port = clockAdapter(mechanism)
		return { port: port.read, underlyingCalls: mechanism.calls }
	},
}

/** Every import specifier in this file, which case 181 checks against the allowed set. */
const importSpecifiersOf = (source: string): string[] =>
	[...source.matchAll(/\bfrom\s+'([^']+)'/g)].map(
		([, specifier]) => specifier ?? '',
	)

describe('an outside adapter driven through the published conformance suite', () => {
	it('case 180: the clock adapter satisfies every published clock outcome', async () => {
		const report = await runClockPortConformance(subject)
		const rendered = formatConformanceReport(report)

		expect(report.outcomes, rendered).toHaveLength(
			CONFORMANCE_OUTCOME_COUNTS.clock,
		)
		expect(
			report.outcomes
				.filter((outcome) => !outcome.passed)
				.map((outcome) => outcome.id),
			rendered,
		).toEqual([])
		expect(report.passed, rendered).toBe(true)
	})

	it('case 181: this file imports only the published subpath, node builtins, and vitest', async () => {
		const source = await readFile(fileURLToPath(import.meta.url), 'utf8')
		const specifiers = importSpecifiersOf(source)

		expect(specifiers.length).toBeGreaterThan(0)
		expect(
			specifiers.filter(
				(specifier) =>
					specifier !== 'eval-quality/conformance' &&
					specifier !== 'vitest' &&
					!specifier.startsWith('node:'),
			),
		).toEqual([])
	})
})
