// The fixed-instant clock adapter: the instant `score --scored-at` pins, and
// the one a library caller passes `runScore` to score where an earlier call
// scored.

import { describe, expect, it } from 'vitest'
import {
	createFixedClockAdapter,
	isScoringInstant,
} from '../../src/adapters/fixed-clock-adapter.ts'
import { createFixedClockAdapter as published } from '../../src/adapters/index.ts'
import { RuntimeFault } from '../../src/core/schemas/faults.ts'
import { Rfc3339Utc } from '../../src/core/schemas/primitives.ts'

const ACCEPTED = [
	'2026-11-19T12:00:00Z',
	'2026-11-19T12:00Z',
	'2026-11-19T12:00:00.123Z',
	'2024-02-29T00:00:00Z',
] as const

const REFUSED = [
	'2026-11-19T12:00:00+00:00',
	'2026-11-19T12:00:00',
	'2026-11-19',
	'2026-02-30T00:00:00Z',
	'2026-11-19T23:59:60Z',
	'2026-11-19t12:00:00z',
	'2026-11-19 12:00:00Z',
	' 2026-11-19T12:00:00Z',
	'',
	'yesterday',
] as const

describe('createFixedClockAdapter', () => {
	it('is published on the adapters barrel', () => {
		expect(published).toBe(createFixedClockAdapter)
	})

	it('answers the instant it was built with on every read', async () => {
		const clock = createFixedClockAdapter('2026-11-19T12:00:00Z')
		const signal = new AbortController().signal
		expect(await clock.read({}, signal)).toEqual({
			now: '2026-11-19T12:00:00Z',
		})
		expect(await clock.read({}, signal)).toEqual({
			now: '2026-11-19T12:00:00Z',
		})
	})

	it('answers a minute-precision and a fractional instant verbatim', async () => {
		const signal = new AbortController().signal
		for (const instant of ['2026-11-19T12:00Z', '2026-11-19T12:00:00.123Z']) {
			expect(await createFixedClockAdapter(instant).read({}, signal)).toEqual({
				now: instant,
			})
		}
	})

	it('refuses a malformed instant at construction with a TypeError naming it', () => {
		for (const instant of REFUSED) {
			expect(() => createFixedClockAdapter(instant)).toThrow(
				new TypeError(
					`createFixedClockAdapter(): ${JSON.stringify(instant)} is not an RFC 3339 UTC timestamp, such as 2026-11-19T12:00:00Z`,
				),
			)
		}
	})

	it('refuses a non-string instant from an untyped caller', () => {
		expect(() => createFixedClockAdapter(0 as unknown as string)).toThrow(
			TypeError,
		)
	})

	it('holds the port boundary: an already-aborted signal is refused as a fault', async () => {
		const controller = new AbortController()
		controller.abort()
		const clock = createFixedClockAdapter('2026-11-19T12:00:00Z')
		await expect(clock.read({}, controller.signal)).rejects.toBeInstanceOf(
			RuntimeFault,
		)
	})
})

describe('isScoringInstant', () => {
	it('accepts exactly what Rfc3339Utc accepts', () => {
		for (const value of [...ACCEPTED, ...REFUSED]) {
			expect(isScoringInstant(value)).toBe(Rfc3339Utc.safeParse(value).success)
		}
		for (const value of ACCEPTED) expect(isScoringInstant(value)).toBe(true)
		for (const value of REFUSED) expect(isScoringInstant(value)).toBe(false)
	})
})
