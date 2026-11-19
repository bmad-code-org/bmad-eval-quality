/** A hand-written fake clock (AD-30): every read answers the same instant. */
import type { ClockPort } from '../../src/ports/clock-port.ts'

export const FIXED_SCORED_AT = '2026-01-01T00:00:00Z'

export const fixedClock = (now: string = FIXED_SCORED_AT): ClockPort => ({
	read: async () => ({ now }),
})
