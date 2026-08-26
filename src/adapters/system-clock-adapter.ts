/** AD-1's clock read, in the layer where a clock read is legal. */

import type { ClockPort } from '../ports/clock-port.ts'
import { clockReadParsers } from '../ports/clock-port.ts'
import { runPortMethod } from './port-boundary.ts'

/**
 * `unknown`, and an `AbortSignal` even though a clock read cannot block. The
 * suite counts underlying calls and drives an `in-band-error` scenario;
 * neither is constructible against a mechanism whose return type already
 * satisfies the response schema.
 */
export type ClockMechanism = (signal: AbortSignal) => Promise<unknown>

const systemClock: ClockMechanism = async () => new Date().toISOString()

export function createSystemClockAdapter(
	mechanism: ClockMechanism = systemClock,
): ClockPort {
	return {
		read: (request, signal) =>
			runPortMethod({
				request,
				requestParser: clockReadParsers.request,
				responseParser: clockReadParsers.response,
				requestPath: 'ClockReadRequest',
				responsePath: 'ClockReadResponse',
				signal,
				mechanism: (_parsed, innerSignal) => mechanism(innerSignal),
				assemble: (raw) => ({ now: raw }),
			}),
	}
}
