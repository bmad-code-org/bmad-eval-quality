/**
 * A `ClockPort` that answers one caller-chosen instant on every read. It lets
 * a caller score at a recorded instant: a CI replay of an accepted baseline
 * scores where the baseline was scored, and an in-process re-score sees the
 * instant the CLI saw, so a waiver expiring between two clock reads cannot
 * make them disagree.
 *
 * The instant is checked once, at construction, against the parser the clock
 * response is read with, so a malformed value fails where it was written and
 * never as a `port-failure` at the read.
 */
import { type ClockPort, clockReadParsers } from '../ports/clock-port.ts'
import { createSystemClockAdapter } from './system-clock-adapter.ts'

/** Whether `value` is a scoring instant `ClockReadResponse.now` accepts: an `Rfc3339Utc` timestamp. */
export function isScoringInstant(value: unknown): boolean {
	return clockReadParsers.response.safeParse({ now: value }).success
}

export function createFixedClockAdapter(instant: string): ClockPort {
	if (!isScoringInstant(instant)) {
		throw new TypeError(
			`createFixedClockAdapter(): ${JSON.stringify(instant)} is not an RFC 3339 UTC timestamp, such as 2026-11-19T12:00:00Z`,
		)
	}
	// The system adapter over a constant mechanism: the request and response
	// parse, the abort race and the fault shape stay the ones the conformance
	// suite already holds the system clock to.
	return createSystemClockAdapter(async () => instant)
}
