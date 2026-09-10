/**
 * AD-35's environment-probe port: a logical interface identifier in, one
 * observation out. The request never names a URL, host, or port. Mapping the
 * identifier to an authorized target is the adapter's job, from configuration
 * outside the contract.
 *
 * Four rules an implementation MUST follow, whichever mechanism it speaks.
 * Prose here because `ports/` holds no logic; `src/testing/probe-conformance.ts`
 * is the executable half.
 *
 * 1. Apply the policy before anything reaches the system under test, and again
 *    to every target the first one leads to. On HTTP that second clause is
 *    every redirect; on a mechanism that starts a process it is every process
 *    the authorization causes to run.
 * 2. Act on exactly what the policy validated, and revalidate nothing away.
 *    Over HTTP: issue the request against the validated address
 *    (`canonicalAddress`), keep the original host in the `Host` header, verify
 *    TLS against that host, and never re-resolve a hostname after validation,
 *    since re-resolving between the check and the connection is the classic
 *    way past an allowlist like this one; where a host resolves to several
 *    addresses, validate each and connect only to a validated one. Over a
 *    mechanism that starts a process: spawn the authorized target with an argv
 *    array and never through a shell, so no declared value can become a
 *    metacharacter, and pass only the environment the mapping declares.
 * 3. A policy denial throws `forbidden-target`; a cap throws
 *    `budget-exhausted`; an abort throws `aborted`; a failure to reach the
 *    system at all throws `port-failure`.
 * 4. Every answer the system returns is an observation, whatever it says. A
 *    4xx or 5xx, a non-zero exit, and a tool result flagged as an error all
 *    resolve to a schema-valid `ProbeObservation`, since AD-10's "every
 *    declared seeded fault being observed to fire" reads the answer as
 *    payload. Throw on one of those and a seeded fault goes invisible, which
 *    makes the whole pre-flight vacuous. What throws under rule 3 is the case
 *    where nothing answered.
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
