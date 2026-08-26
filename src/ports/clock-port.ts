/** AD-1 forbids a clock read under `core/`, so a timestamp arrives through this port. */
import {
	ClockReadRequest,
	ClockReadResponse,
} from '../core/schemas/port-messages.ts'
import type { PortMethod } from './port.ts'

export type ClockPort = {
	readonly read: PortMethod<ClockReadRequest, ClockReadResponse>
}

/** the boundary parsers `application/` and the conformance suite validate with. */
export const clockReadParsers = {
	request: ClockReadRequest,
	response: ClockReadResponse,
} as const
