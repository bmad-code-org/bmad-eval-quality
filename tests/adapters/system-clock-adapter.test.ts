// Story 6.1 AC 12 fixtures 83-84: the shipped clock adapter. AD-1 forbids a
// clock read under `core/`, so this is the one clock read in the package and
// it lives in the layer where a clock read is legal.

import { describe, expect, it } from 'vitest'
import {
	type ClockMechanism,
	createSystemClockAdapter,
} from '../../src/adapters/system-clock-adapter.ts'
import type { ClockReadRequest } from '../../src/core/schemas/port-messages.ts'
import { Rfc3339Utc } from '../../src/core/schemas/primitives.ts'
import type { PortSubject } from '../../src/testing/conformance.ts'
import { runClockPortConformance } from '../../src/testing/conformance.ts'

function clockSubject(): PortSubject<ClockReadRequest> {
	return {
		name: 'createSystemClockAdapter',
		sampleRequest: {},
		abortBudgetMs: 200,
		build: async (scenario) => {
			let calls = 0
			const mechanism: ClockMechanism = async () => {
				calls++
				if (scenario === 'resolves') return '2026-08-26T00:00:00.000Z'
				if (scenario === 'fails') throw new Error('no clock available')
				if (scenario === 'in-band-error') return { error: 'no clock' }
				// Ignores the signal on purpose; the adapter's abort race is what
				// is under test.
				return new Promise<unknown>(() => {})
			}
			const port = createSystemClockAdapter(mechanism)
			return {
				port: (request, signal) => port.read(request, signal),
				underlyingCalls: () => calls,
			}
		},
	}
}

describe('the shipped clock adapter (fixtures 83-84)', () => {
	it('fixture 83: passes the published clock conformance suite, six outcomes', async () => {
		const report = await runClockPortConformance(clockSubject())
		expect(report.outcomes).toHaveLength(6)
		expect(report.outcomes.filter((outcome) => !outcome.passed)).toEqual([])
		expect(report.passed).toBe(true)
	})

	it('fixture 84: the default mechanism returns a string Rfc3339Utc accepts', async () => {
		const port = createSystemClockAdapter()
		const response = await port.read({}, new AbortController().signal)
		expect(typeof response.now).toBe('string')
		expect(Rfc3339Utc.safeParse(response.now).success).toBe(true)
		expect(response.now.endsWith('Z')).toBe(true)
	})
})
