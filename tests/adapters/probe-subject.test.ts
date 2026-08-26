// Story 6.1 AC 12 fixtures 85-88: the in-repository probe subject, run
// against AD-37's published suite over a real loopback server. AD-30's
// carve-out ("no network I/O beyond a loopback fixture server it started
// itself") exists for exactly this file.

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { RuntimeFault } from '../../src/core/schemas/faults.ts'
import type { ProbeRequest } from '../../src/core/schemas/port-messages.ts'
import { runEnvironmentProbePortConformance } from '../../src/testing/probe-conformance.ts'
import {
	buildSubjectPolicy,
	buildSubjectTargets,
	createProbeSubject,
	createProbeSubjectAdapter,
	type Hop,
	MAX_REQUEST_BYTES,
	nodeHttpMechanism,
	SUBJECT_HOSTS,
	startFixtureServer,
	subjectResolveAddress,
} from './probe-subject.ts'

describe('the in-repository probe subject (fixtures 85-88)', () => {
	let server: Awaited<ReturnType<typeof startFixtureServer>>

	beforeAll(async () => {
		server = await startFixtureServer()
	})

	afterAll(async () => {
		await server.close()
	})

	it('fixture 85: passes the published probe conformance suite, nineteen outcomes, over a real loopback server', async () => {
		const report = await runEnvironmentProbePortConformance(
			createProbeSubject(server),
		)
		expect(report.outcomes.filter((outcome) => !outcome.passed)).toEqual([])
		expect(report.outcomes).toHaveLength(19)
		expect(report.passed).toBe(true)
	}, 20000)

	it('fixture 86: two startFixtureServer calls get different ports and both answer', async () => {
		const second = await startFixtureServer()
		try {
			expect(second.port).not.toBe(server.port)
			expect(second.address).toBe('127.0.0.1')
			for (const each of [server, second]) {
				const hop = await nodeHttpMechanism({
					address: '127.0.0.1',
					port: each.port,
					path: '/ok',
					method: 'GET',
					host: SUBJECT_HOSTS.authorized,
					maxResponseBytes: 1024,
					signal: new AbortController().signal,
				})
				expect(hop.status).toBe(200)
			}
		} finally {
			await second.close()
		}
	})

	it('fixture 87: the authorized target equals the live server, and exactly one authorization names its address', async () => {
		// Asserted against the running server, never against the constant the
		// subject was built from. Re-deriving the expected value from the thing
		// under test proves nothing.
		const subject = createProbeSubject(server)
		const targets = buildSubjectTargets(server.port)
		const authorized = targets.authorized
		expect(authorized?.port).toBe(server.port)
		expect(authorized?.scheme).toBe('http')
		expect(subjectResolveAddress(authorized?.host ?? '')).toBe(server.address)

		expect(Object.keys(targets)).toHaveLength(8)
		const naming = subject.policy.authorizations.filter((authorization) =>
			authorization.addresses.includes(server.address),
		)
		expect(naming).toHaveLength(1)
		expect(naming[0]?.interfaceId).toBe('authorized')
		expect(naming[0]?.port).toBe(server.port)
		expect(naming[0]?.methods).toEqual(['GET', 'HEAD'])
	})

	it('fixture 93: maxResponseBytes is counted in bytes, not UTF-16 code units', async () => {
		// The body is 3/4 of the cap in code units and 3/2 of it in bytes, so a
		// length check on the decoded string admits it and a byte check refuses
		// it. `maxResponseBytes` names bytes.
		const port = createProbeSubjectAdapter({
			policy: buildSubjectPolicy(server.port),
			targets: buildSubjectTargets(server.port),
			resolveAddress: subjectResolveAddress,
		})
		const subject = createProbeSubject(server)
		const thrown = await port
			.probe(subject.oversizeUtf8Request, new AbortController().signal)
			.then(
				() => undefined,
				(error: unknown) => error,
			)
		expect(thrown).toBeInstanceOf(RuntimeFault)
		expect((thrown as RuntimeFault).code).toBe('budget-exhausted')
	})

	it('fixture 92: a request past maxRequestBytes is capped before any hop', async () => {
		const hops: Hop[] = []
		const port = createProbeSubjectAdapter({
			policy: buildSubjectPolicy(server.port),
			targets: buildSubjectTargets(server.port),
			resolveAddress: subjectResolveAddress,
			mechanism: (hop) => {
				hops.push(hop)
				return nodeHttpMechanism(hop)
			},
		})
		const subject = createProbeSubject(server)
		const oversize: ProbeRequest = {
			...subject.authorizedRequest,
			channels: {
				...subject.authorizedRequest.channels,
				query: { filler: 'x'.repeat(MAX_REQUEST_BYTES + 1) },
			},
		}
		const thrown = await port
			.probe(oversize, new AbortController().signal)
			.then(
				() => undefined,
				(error: unknown) => error,
			)
		expect(thrown).toBeInstanceOf(RuntimeFault)
		expect((thrown as RuntimeFault).code).toBe('budget-exhausted')
		// A safety limit, so it is a cap and never a policy denial (AD-28).
		expect((thrown as RuntimeFault).artifactPath).toBe('ProbeObservation')
		// Refused before a packet leaves.
		expect(hops).toHaveLength(0)
	})

	it('fixture 88: connects to the validated address with the original host, and resolves it no more times than it validates', async () => {
		let resolves = 0
		const hops: Hop[] = []
		const port = createProbeSubjectAdapter({
			policy: buildSubjectPolicy(server.port),
			targets: buildSubjectTargets(server.port),
			resolveAddress: (host) => {
				resolves++
				return subjectResolveAddress(host)
			},
			mechanism: (hop) => {
				hops.push(hop)
				return nodeHttpMechanism(hop)
			},
		})
		const subject = createProbeSubject(server)
		const observed = await port.probe(
			subject.authorizedRequest,
			new AbortController().signal,
		)

		expect(observed.status).toBe(200)
		expect(hops).toHaveLength(1)
		expect(hops[0]?.host).toBe(SUBJECT_HOSTS.authorized)

		// The connection goes to the address the policy VALIDATED, which is the
		// canonical form and not the spelling `resolveAddress` handed back. Those
		// two are the same string for `127.0.0.1`, so this half of AC 5 rule 2 is
		// only falsifiable when they differ: here the resolver returns the mapped
		// spelling, the authorization still names `127.0.0.1`, and the hop has to
		// carry the canonical form. A mechanism stub keeps it socket-free.
		const mappedHops: Hop[] = []
		const mappedPort = createProbeSubjectAdapter({
			policy: buildSubjectPolicy(server.port),
			targets: buildSubjectTargets(server.port),
			resolveAddress: (host) =>
				host === SUBJECT_HOSTS.authorized
					? '::ffff:127.0.0.1'
					: subjectResolveAddress(host),
			mechanism: (hop) => {
				mappedHops.push(hop)
				return Promise.resolve({
					status: 200,
					headers: { 'content-type': 'application/json' },
					body: '{"ok":true}',
					truncated: false,
				})
			},
		})
		const viaMapped = await mappedPort.probe(
			subject.authorizedRequest,
			new AbortController().signal,
		)
		expect(viaMapped.status).toBe(200)
		expect(mappedHops).toHaveLength(1)
		expect(mappedHops[0]?.address).toBe('127.0.0.1')
		expect(mappedHops[0]?.host).toBe(SUBJECT_HOSTS.authorized)
		// One validation, one resolution. A second resolution here would be the
		// re-resolution between check and connect that defeats the control.
		expect(resolves).toBe(1)

		// The redirect case is the sharper half of the same rule: two
		// validations (the first hop and the redirect target), two resolutions,
		// and one hop, because the second target is refused before it is
		// connected to.
		resolves = 0
		hops.length = 0
		const refused = await port
			.probe(subject.redirectingRequest, new AbortController().signal)
			.then(
				() => undefined,
				(error: unknown) => error,
			)
		expect(refused).toBeInstanceOf(RuntimeFault)
		expect((refused as RuntimeFault).code).toBe('forbidden-target')
		expect(hops).toHaveLength(1)
		expect(resolves).toBe(2)
	})
})
