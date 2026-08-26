/**
 * AD-35's environment-probe port: a logical interface identifier in, one
 * observation out. The request never names a URL, host, or port. Mapping the
 * identifier to an authorized target is the adapter's job, from configuration
 * outside the contract.
 *
 * Four rules an implementation MUST follow. Prose here because `ports/` holds
 * no logic; `src/testing/probe-conformance.ts` is the executable half.
 *
 * 1. Apply the policy before any network call, and again to every redirect
 *    target.
 * 2. Issue the request against the address the policy validated
 *    (`canonicalAddress`), keep the original host in the `Host` header, and
 *    verify TLS against that host. Never re-resolve a hostname after
 *    validation: re-resolving between the check and the connection is the
 *    classic way past an allowlist like this one. Where a host resolves to
 *    several addresses, validate each and connect only to a validated one.
 * 3. A policy denial throws `forbidden-target`; a cap throws
 *    `budget-exhausted`; an abort throws `aborted`; a transport failure throws
 *    `port-failure`.
 * 4. Every response the server returns is an observation, at any status. A 4xx
 *    or 5xx resolves to a schema-valid `ProbeObservation`, since AD-10's
 *    "every declared seeded fault being observed to fire" reads the status as
 *    payload. Throw on a non-2xx and a seeded fault goes invisible, which
 *    makes the whole pre-flight vacuous.
 */
import {
	ProbeObservation,
	ProbeRequest,
} from '../core/schemas/port-messages.ts'
import type { PortMethod } from './port.ts'

export type EnvironmentProbePort = {
	readonly probe: PortMethod<ProbeRequest, ProbeObservation>
}

/** the boundary parsers `application/` and the conformance suite validate with. */
export const probeParsers = {
	request: ProbeRequest,
	response: ProbeObservation,
} as const
