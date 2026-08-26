// Story 6.1 AC 12 fixtures 41-72: the non-vacuity proof for AD-37's published
// conformance suite. Every mutant below flips exactly one behaviour, and each
// fixture asserts WHICH qualified outcome id went red. A mutant that flips two
// means the two assertions overlap and at least one is not measuring what its
// id says.

import { describe, expect, it } from 'vitest'
import { invokePort } from '../../src/application/invoke-port.ts'
import { RuntimeFault } from '../../src/core/schemas/faults.ts'
import type {
	ClockReadRequest,
	CorpusResolveRequest,
	FileReadRequest,
	FileWriteRequest,
	ProbeRequest,
} from '../../src/core/schemas/port-messages.ts'
import type { ProbeTargetPolicy } from '../../src/core/schemas/probe-policy.ts'
import { clockReadParsers } from '../../src/ports/clock-port.ts'
import { corpusResolveParsers } from '../../src/ports/corpus-port.ts'
import {
	fileReadParsers,
	fileWriteParsers,
} from '../../src/ports/file-system-port.ts'
import type { BoundaryParser, PortMethod } from '../../src/ports/port.ts'
import type {
	ConformanceReport,
	PortSubject,
	ScenarioKind,
} from '../../src/testing/conformance.ts'
import {
	CONFORMANCE_OUTCOME_COUNTS,
	formatConformanceReport,
	reportOf,
	runClockPortConformance,
	runCorpusPortConformance,
	runFileSystemPortConformance,
} from '../../src/testing/conformance.ts'
import type { ProbeSubject } from '../../src/testing/probe-conformance.ts'
import { runEnvironmentProbePortConformance } from '../../src/testing/probe-conformance.ts'

// ---------------------------------------------------------------------------
// The synthetic subjects. One knob per mutant, all defaulting to conforming.
// ---------------------------------------------------------------------------

type Knobs = {
	readonly resolveUnderFails?: boolean
	readonly plainErrorUnderFails?: boolean
	readonly emptyArtifactPath?: boolean
	readonly retryOnFailure?: boolean
	readonly doubleCallOnSuccess?: boolean
	readonly ignoreAbort?: boolean
	readonly portFailureOnAbort?: boolean
	readonly returnInBandError?: boolean
	readonly missingResponseField?: boolean
	readonly buildThrowsOn?: ScenarioKind
}

type SyntheticShapes<Request> = {
	readonly name: string
	readonly sampleRequest: Request
	readonly validResponse: (request: Request) => unknown
	readonly invalidResponse: () => unknown
	readonly inBandValue: () => unknown
	readonly artifactPath: string
}

function syntheticSubject<Request>(
	shapes: SyntheticShapes<Request>,
	knobs: Knobs = {},
	abortBudgetMs?: number,
): PortSubject<Request> {
	return {
		name: shapes.name,
		sampleRequest: shapes.sampleRequest,
		abortBudgetMs,
		build: async (scenario) => {
			if (knobs.buildThrowsOn === scenario) {
				throw new Error(`synthetic build failure for '${scenario}'`)
			}
			let calls = 0
			const faultPath = knobs.emptyArtifactPath ? '' : shapes.artifactPath
			const port = async (
				request: Request,
				signal: AbortSignal,
			): Promise<unknown> => {
				calls++
				if (scenario === 'resolves') {
					if (knobs.doubleCallOnSuccess) calls++
					return knobs.missingResponseField
						? shapes.invalidResponse()
						: shapes.validResponse(request)
				}
				if (scenario === 'fails') {
					if (knobs.retryOnFailure) calls++
					if (knobs.resolveUnderFails) return shapes.validResponse(request)
					if (knobs.plainErrorUnderFails) {
						throw new Error('the underlying mechanism failed')
					}
					throw new RuntimeFault(
						'port-failure',
						faultPath,
						'the underlying mechanism failed',
					)
				}
				if (scenario === 'in-band-error') {
					if (knobs.returnInBandError) return shapes.inBandValue()
					throw new RuntimeFault(
						'port-contract-violation',
						faultPath,
						'the mechanism returned an in-band error value',
					)
				}
				return new Promise<unknown>((_resolve, reject) => {
					if (knobs.ignoreAbort) return
					signal.addEventListener(
						'abort',
						() => {
							reject(
								new RuntimeFault(
									knobs.portFailureOnAbort ? 'port-failure' : 'aborted',
									faultPath,
									'the signal aborted while the call was in flight',
								),
							)
						},
						{ once: true },
					)
				})
			}
			return { port, underlyingCalls: () => calls }
		},
	}
}

const corpusShapes: SyntheticShapes<CorpusResolveRequest> = {
	name: 'synthetic-corpus',
	sampleRequest: { privateRef: 'ref-1' },
	validResponse: (request) => ({
		privateRef: request.privateRef,
		bytes: new Uint8Array([1, 2, 3]),
	}),
	invalidResponse: () => ({ bytes: new Uint8Array([1]) }),
	inBandValue: () => ({ error: 'nope', partial: true }),
	artifactPath: 'CorpusResolveResponse',
}

const clockShapes: SyntheticShapes<ClockReadRequest> = {
	name: 'synthetic-clock',
	sampleRequest: {},
	validResponse: () => ({ now: '2026-08-26T00:00:00.000Z' }),
	invalidResponse: () => ({}),
	inBandValue: () => ({ error: 'no clock' }),
	artifactPath: 'ClockReadResponse',
}

const fileReadShapes: SyntheticShapes<FileReadRequest> = {
	name: 'synthetic-file-system',
	sampleRequest: { path: '/tmp/read.txt' },
	validResponse: (request) => ({
		path: request.path,
		bytes: new Uint8Array([7]),
	}),
	invalidResponse: () => ({ bytes: new Uint8Array([7]) }),
	inBandValue: () => ({ error: 'ENOENT' }),
	artifactPath: 'FileReadResponse',
}

const fileWriteShapes: SyntheticShapes<FileWriteRequest> = {
	name: 'synthetic-file-system',
	sampleRequest: { path: '/tmp/write.txt', bytes: new Uint8Array([7, 8]) },
	validResponse: (request) => ({
		path: request.path,
		byteLength: request.bytes.length,
	}),
	invalidResponse: () => ({ path: '/tmp/write.txt' }),
	inBandValue: () => ({ error: 'EACCES' }),
	artifactPath: 'FileWriteResponse',
}

/** Every failed qualified id, in report order. The one assertion every mutant fixture makes. */
function failedIds(report: ConformanceReport): string[] {
	return report.outcomes
		.filter((outcome) => !outcome.passed)
		.map((outcome) => outcome.id)
}

/** Runs the corpus suite over one mutant and returns the ids that went red. */
async function corpusFailures(knobs: Knobs, budgetMs?: number) {
	const report = await runCorpusPortConformance(
		syntheticSubject(corpusShapes, knobs, budgetMs),
	)
	expect(report.outcomes).toHaveLength(CONFORMANCE_OUTCOME_COUNTS.corpus)
	expect(report.passed).toBe(false)
	return failedIds(report)
}

describe('the shared six: a conforming subject passes every one (fixtures 41-43)', () => {
	it('fixture 41: a conforming synthetic corpus subject passes, six outcomes', async () => {
		const report = await runCorpusPortConformance(
			syntheticSubject(corpusShapes),
		)
		expect(report.outcomes).toHaveLength(6)
		expect(failedIds(report)).toEqual([])
		expect(report.passed).toBe(true)
		expect(report.port).toBe('corpus')
	})

	it('fixture 42: a conforming clock subject passes, six outcomes', async () => {
		const report = await runClockPortConformance(syntheticSubject(clockShapes))
		expect(report.outcomes).toHaveLength(6)
		expect(failedIds(report)).toEqual([])
		expect(report.passed).toBe(true)
	})

	it('fixture 43: a conforming file-system subject passes, twelve outcomes namespaced by method', async () => {
		const report = await runFileSystemPortConformance(
			syntheticSubject(fileReadShapes),
			syntheticSubject(fileWriteShapes),
		)
		expect(report.outcomes).toHaveLength(12)
		expect(failedIds(report)).toEqual([])
		expect(report.passed).toBe(true)
		const ids = report.outcomes.map((outcome) => outcome.id)
		expect(ids.filter((id) => id.startsWith('readFile/'))).toHaveLength(6)
		expect(ids.filter((id) => id.startsWith('writeFile/'))).toHaveLength(6)
		expect(new Set(ids).size).toBe(12)
	})
})

describe('the shared six: one mutant per assertion flips exactly its own id (fixtures 44-53)', () => {
	it('fixture 44: resolving instead of throwing under fails flips only typed-fault', async () => {
		expect(await corpusFailures({ resolveUnderFails: true })).toEqual([
			'resolve/typed-fault',
		])
	})

	it('fixture 45: throwing a plain Error under fails flips only typed-fault', async () => {
		expect(await corpusFailures({ plainErrorUnderFails: true })).toEqual([
			'resolve/typed-fault',
		])
	})

	it('fixture 46: a RuntimeFault with an empty artifactPath flips only typed-fault', async () => {
		expect(await corpusFailures({ emptyArtifactPath: true })).toEqual([
			'resolve/typed-fault',
		])
	})

	it('fixture 47: retrying once on failure flips only single-underlying-call-on-failure', async () => {
		expect(await corpusFailures({ retryOnFailure: true })).toEqual([
			'resolve/single-underlying-call-on-failure',
		])
	})

	it('fixture 48: calling the mechanism twice on success flips only single-underlying-call-on-success', async () => {
		expect(await corpusFailures({ doubleCallOnSuccess: true })).toEqual([
			'resolve/single-underlying-call-on-success',
		])
	})

	it('fixture 49: ignoring the abort signal flips only prompt-abort, within abortBudgetMs', async () => {
		const started = Date.now()
		expect(await corpusFailures({ ignoreAbort: true }, 100)).toEqual([
			'resolve/prompt-abort',
		])
		expect(Date.now() - started).toBeLessThan(2000)
	})

	it('fixture 50: rejecting an abort with port-failure rather than aborted flips only prompt-abort', async () => {
		expect(await corpusFailures({ portFailureOnAbort: true })).toEqual([
			'resolve/prompt-abort',
		])
	})

	it('fixture 51: returning the in-band error object flips only no-in-band-error', async () => {
		expect(await corpusFailures({ returnInBandError: true })).toEqual([
			'resolve/no-in-band-error',
		])
	})

	it('fixture 52: returning a value missing a required field flips only schema-valid-return', async () => {
		expect(await corpusFailures({ missingResponseField: true })).toEqual([
			'resolve/schema-valid-return',
		])
	})

	it('fixture 53: a throwing build fails every outcome needing that scenario, naming the throw, and nothing escapes', async () => {
		const report = await runCorpusPortConformance(
			syntheticSubject(corpusShapes, { buildThrowsOn: 'resolves' }),
		)
		expect(report.outcomes).toHaveLength(6)
		expect(failedIds(report)).toEqual([
			'resolve/single-underlying-call-on-success',
			'resolve/schema-valid-return',
		])
		for (const outcome of report.outcomes.filter((each) => !each.passed)) {
			expect(outcome.detail).toContain("build('resolves') threw")
			expect(outcome.detail).toContain('synthetic build failure')
		}
	})
})

// ---------------------------------------------------------------------------
// Fixture 54: invokePort wrapped as a subject. AC 9 step 3's one deliberate
// divergence, asserted here so nothing has to assume it.
// ---------------------------------------------------------------------------

/**
 * Wraps a mechanism that ignores the abort signal in `invokePort`. That is the
 * shape AD-28 obliges a caller-supplied port to handle itself and an adapter
 * cannot assume, so it is the shape that exposes the divergence: `invokePort`
 * awaits the mechanism and reads `signal.aborted` only in its `catch`, with no
 * `Promise.race` and no abort listener, so a mechanism that never settles
 * makes `invokePort` never settle.
 */
function invokePortSubject<Request>(
	shapes: SyntheticShapes<Request>,
	parsers: {
		readonly request: BoundaryParser<Request>
		readonly response: BoundaryParser<unknown>
	},
): PortSubject<Request> {
	const inner = syntheticSubject(shapes, { ignoreAbort: true }, 100)
	return {
		...inner,
		abortBudgetMs: 100,
		build: async (scenario) => {
			const built = await inner.build(scenario)
			return {
				...built,
				port: (request: Request, signal: AbortSignal) =>
					invokePort({
						request,
						requestParser: parsers.request,
						responseParser: parsers.response,
						port: built.port as PortMethod<Request, unknown>,
						signal,
						requestPath: `${shapes.artifactPath}Request`,
						responsePath: shapes.artifactPath,
					}),
			}
		},
	}
}

describe('fixture 54: invokePort as a subject passes the five non-abort assertions and fails prompt-abort', () => {
	it('fixture 54: steps 1, 2, 4, and 5 agree with invokePort; step 3 is the deliberate divergence', async () => {
		const corpus = await runCorpusPortConformance(
			invokePortSubject(corpusShapes, corpusResolveParsers),
		)
		const clock = await runClockPortConformance(
			invokePortSubject(clockShapes, clockReadParsers),
		)
		const fileSystem = await runFileSystemPortConformance(
			invokePortSubject(fileReadShapes, fileReadParsers),
			invokePortSubject(fileWriteShapes, fileWriteParsers),
		)
		expect(failedIds(corpus)).toEqual(['resolve/prompt-abort'])
		expect(failedIds(clock)).toEqual(['read/prompt-abort'])
		expect(failedIds(fileSystem)).toEqual([
			'readFile/prompt-abort',
			'writeFile/prompt-abort',
		])
		for (const report of [corpus, clock, fileSystem]) {
			expect(report.passed).toBe(false)
			const nonAbort = report.outcomes.filter(
				(each) => !each.id.endsWith('/prompt-abort'),
			)
			expect(nonAbort.every((each) => each.passed)).toBe(true)
			expect(nonAbort.length).toBe(
				report.outcomes.length - 1 - (report.port === 'file-system' ? 1 : 0),
			)
		}
	})
})

describe('the report itself: formatting, the length rule, and the declared counts (fixtures 55-58)', () => {
	it('fixture 55: formatConformanceReport names every failed qualified id and no passing one', async () => {
		const report = await runCorpusPortConformance(
			syntheticSubject(corpusShapes, { returnInBandError: true }),
		)
		const rendered = formatConformanceReport(report)
		for (const outcome of report.outcomes) {
			if (outcome.passed) {
				expect(rendered).not.toContain(`FAIL ${outcome.id}`)
				expect(rendered).toContain(`pass ${outcome.id}`)
			} else {
				expect(rendered).toContain(`FAIL ${outcome.id}`)
				expect(rendered).toContain(outcome.detail)
			}
		}
		expect(rendered.split('\n')).toHaveLength(report.outcomes.length + 1)
		expect(rendered).toContain('synthetic-corpus')
		expect(rendered).toContain('5/6')
	})

	it('fixture 56: report.passed is false when outcomes is empty', () => {
		// Routed through `reportOf` so the length term is what decides. Writing
		// `passed: false` into a literal and asserting it back proves nothing.
		const empty = reportOf('none', 'corpus', [])
		expect(empty.outcomes).toHaveLength(0)
		expect(empty.passed).toBe(false)
		expect(formatConformanceReport(empty)).toContain('0/0')
	})

	it('fixture 57: report.passed is false when every present outcome passes but the list is one short', async () => {
		const full = await runCorpusPortConformance(syntheticSubject(corpusShapes))
		expect(full.passed).toBe(true)
		const kept = full.outcomes.slice(0, CONFORMANCE_OUTCOME_COUNTS.corpus - 1)
		expect(kept).toHaveLength(CONFORMANCE_OUTCOME_COUNTS.corpus - 1)
		expect(kept.every((outcome) => outcome.passed)).toBe(true)
		const short = reportOf(full.subject, 'corpus', kept)
		expect(short.passed).toBe(false)
	})

	it('fixture 58: CONFORMANCE_OUTCOME_COUNTS equals the declared literals', () => {
		expect(CONFORMANCE_OUTCOME_COUNTS).toEqual({
			corpus: 6,
			clock: 6,
			'file-system': 12,
			'environment-probe': 19,
		})
	})
})

// ---------------------------------------------------------------------------
// The probe suite (fixtures 59-72). The synthetic subject dispatches on
// `operationId`, so a mutant can deny `authorizedRequest` without disturbing
// the shared six, which run against `sampleRequest`.
// ---------------------------------------------------------------------------

type ProbeKnobs = {
	readonly allowUnmapped?: boolean
	readonly allowLoopback?: boolean
	readonly allowPrivate?: boolean
	readonly allowLinkLocal?: boolean
	readonly allowMetadata?: boolean
	readonly allowUnauthorizedMethod?: boolean
	readonly allowUnauthorizedScheme?: boolean
	readonly followDeniedRedirect?: boolean
	readonly forbiddenInsteadOfCapOnOversize?: boolean
	readonly followOverLongRedirectChain?: boolean
	readonly resolveAfterElapsedCap?: boolean
	readonly throwOnFiveHundred?: boolean
	readonly denyAuthorized?: boolean
}

const MAX_REDIRECTS = 2

const probePolicy: ProbeTargetPolicy = {
	authorizations: [
		{
			interfaceId: 'authorized',
			scheme: 'http',
			host: 'localhost',
			port: 8080,
			addresses: ['127.0.0.1'],
			methods: ['GET'],
			safeMethods: ['GET'],
			maxRedirects: MAX_REDIRECTS,
			maxElapsedMs: 50,
			maxRequestBytes: 1024,
			maxResponseBytes: 1024,
		},
	],
}

function probeRequest(
	interfaceId: string,
	operationId: string,
	method: ProbeRequest['method'] = 'GET',
): ProbeRequest {
	return {
		probeId: `probe-${operationId}`,
		interfaceId,
		operationId,
		method,
		pathTemplate: '/orders',
		channels: {
			path: {},
			query: {},
			header: {},
			body: { kind: 'absent' },
		},
	}
}

function observation(request: ProbeRequest, status: number) {
	return {
		probeId: request.probeId,
		interfaceId: request.interfaceId,
		operationId: request.operationId,
		status,
		headers: { 'content-type': 'application/json' },
		body: { kind: 'json' as const, value: { ok: status < 400 } },
	}
}

function forbidden(detail: string): RuntimeFault {
	return new RuntimeFault('forbidden-target', 'ProbeRequest', detail)
}

function capped(detail: string): RuntimeFault {
	return new RuntimeFault('budget-exhausted', 'ProbeObservation', detail)
}

/**
 * One conforming probe subject with one knob per mutant. Every knob defaults
 * off, so the base subject is the one fixture 59 asserts and every other
 * fixture is that subject with a single behaviour changed.
 */
function syntheticProbeSubject(knobs: ProbeKnobs = {}): ProbeSubject {
	const shared = syntheticSubject<ProbeRequest>(
		{
			name: 'synthetic-probe',
			sampleRequest: probeRequest('authorized', 'sample'),
			validResponse: (request) => observation(request, 200),
			invalidResponse: () => ({ status: 200 }),
			inBandValue: () => ({ error: 'unreachable' }),
			artifactPath: 'ProbeObservation',
		},
		{},
		100,
	)

	/** The deny cases, each keyed by the operationId its request carries. */
	const denials: Record<string, boolean | undefined> = {
		unmapped: knobs.allowUnmapped,
		'denied-loopback': knobs.allowLoopback,
		'denied-private': knobs.allowPrivate,
		'denied-link-local': knobs.allowLinkLocal,
		'denied-metadata': knobs.allowMetadata,
		'denied-method': knobs.allowUnauthorizedMethod,
		'denied-scheme': knobs.allowUnauthorizedScheme,
	}

	return {
		...shared,
		policy: probePolicy,
		authorizedRequest: probeRequest('authorized', 'authorized'),
		unmappedRequest: probeRequest('unmapped', 'unmapped'),
		deniedAddressRequests: {
			loopback: probeRequest('denied-loopback', 'denied-loopback'),
			private: probeRequest('denied-private', 'denied-private'),
			linkLocal: probeRequest('denied-link-local', 'denied-link-local'),
			metadata: probeRequest('denied-metadata', 'denied-metadata'),
		},
		unauthorizedMethodRequest: probeRequest(
			'authorized',
			'denied-method',
			'DELETE',
		),
		unauthorizedSchemeRequest: probeRequest('denied-scheme', 'denied-scheme'),
		redirectingRequest: probeRequest('authorized', 'redirecting'),
		overRedirectRequest: probeRequest('authorized', 'over-redirect'),
		oversizeResponseRequest: probeRequest('authorized', 'oversize'),
		slowRequest: probeRequest('authorized', 'slow'),
		faultingRequest: probeRequest('authorized', 'faulting'),
		build: async (scenario) => {
			const built = await shared.build(scenario)
			if (scenario !== 'resolves') return built
			// Only the `resolves` build is reached by AD-35's thirteen; the other
			// three scenarios belong to the shared six and stay untouched.
			let hops = 0
			const port = async (
				request: ProbeRequest,
				signal: AbortSignal,
			): Promise<unknown> => {
				const operation = request.operationId
				if (operation in denials) {
					if (denials[operation] !== true) {
						throw forbidden(`${operation} is refused before a packet leaves`)
					}
					hops++
					return observation(request, 200)
				}
				if (operation === 'authorized') {
					if (knobs.denyAuthorized) {
						throw forbidden('this subject refuses everything')
					}
					hops++
					return observation(request, 200)
				}
				if (operation === 'faulting') {
					hops++
					if (knobs.throwOnFiveHundred) {
						throw new RuntimeFault(
							'port-failure',
							'ProbeObservation',
							'the target answered 500',
						)
					}
					return observation(request, 500)
				}
				if (operation === 'redirecting') {
					hops++
					if (knobs.followDeniedRedirect) {
						hops++
						return observation(request, 200)
					}
					throw forbidden('the redirect target is not authorized')
				}
				if (operation === 'over-redirect') {
					if (knobs.followOverLongRedirectChain) {
						hops += MAX_REDIRECTS + 2
						return observation(request, 200)
					}
					hops += MAX_REDIRECTS + 1
					throw capped(`more than ${MAX_REDIRECTS} redirects were followed`)
				}
				if (operation === 'oversize') {
					hops++
					throw knobs.forbiddenInsteadOfCapOnOversize
						? forbidden('the response was too large')
						: capped('the response exceeded maxResponseBytes')
				}
				if (operation === 'slow') {
					hops++
					if (knobs.resolveAfterElapsedCap) return observation(request, 200)
					throw capped('the target answered past maxElapsedMs')
				}
				return built.port(request, signal)
			}
			return {
				port,
				underlyingCalls: () => hops + built.underlyingCalls(),
				dispose: built.dispose,
			}
		},
	}
}

async function probeFailures(knobs: ProbeKnobs) {
	const report = await runEnvironmentProbePortConformance(
		syntheticProbeSubject(knobs),
	)
	expect(report.outcomes).toHaveLength(
		CONFORMANCE_OUTCOME_COUNTS['environment-probe'],
	)
	expect(report.passed).toBe(false)
	return failedIds(report)
}

describe('the probe suite: AD-35 default-deny and the four caps (fixtures 59-72)', () => {
	it('fixture 59: a conforming synthetic probe subject passes, nineteen outcomes', async () => {
		const report = await runEnvironmentProbePortConformance(
			syntheticProbeSubject(),
		)
		expect(report.outcomes).toHaveLength(19)
		expect(failedIds(report)).toEqual([])
		expect(report.passed).toBe(true)
		expect(report.port).toBe('environment-probe')
		expect(new Set(report.outcomes.map((each) => each.id)).size).toBe(19)
	})

	it('fixture 60: allowing an unmapped interface flips only probe/deny-unmapped-interface', async () => {
		expect(await probeFailures({ allowUnmapped: true })).toEqual([
			'probe/deny-unmapped-interface',
		])
	})

	it('fixture 61: allowing an unauthorized loopback flips only probe/deny-unauthorized-loopback', async () => {
		expect(await probeFailures({ allowLoopback: true })).toEqual([
			'probe/deny-unauthorized-loopback',
		])
	})

	it('fixture 62: allowing a private address flips only probe/deny-private', async () => {
		expect(await probeFailures({ allowPrivate: true })).toEqual([
			'probe/deny-private',
		])
	})

	it('fixture 63: allowing a link-local address flips only probe/deny-link-local', async () => {
		expect(await probeFailures({ allowLinkLocal: true })).toEqual([
			'probe/deny-link-local',
		])
	})

	it('fixture 64: allowing a metadata address flips only probe/deny-metadata', async () => {
		expect(await probeFailures({ allowMetadata: true })).toEqual([
			'probe/deny-metadata',
		])
	})

	it('fixture 65: allowing an unauthorized method flips only probe/deny-unauthorized-method', async () => {
		expect(await probeFailures({ allowUnauthorizedMethod: true })).toEqual([
			'probe/deny-unauthorized-method',
		])
	})

	it('fixture 66: allowing an unauthorized scheme flips only probe/deny-unauthorized-scheme', async () => {
		expect(await probeFailures({ allowUnauthorizedScheme: true })).toEqual([
			'probe/deny-unauthorized-scheme',
		])
	})

	it('fixture 67: following a redirect to a denied target flips only probe/deny-on-redirect', async () => {
		expect(await probeFailures({ followDeniedRedirect: true })).toEqual([
			'probe/deny-on-redirect',
		])
	})

	it('fixture 68: throwing forbidden-target on the oversize response flips only probe/cap-response-bytes', async () => {
		expect(
			await probeFailures({ forbiddenInsteadOfCapOnOversize: true }),
		).toEqual(['probe/cap-response-bytes'])
	})

	it('fixture 69: following more redirects than maxRedirects flips only probe/cap-redirects', async () => {
		expect(await probeFailures({ followOverLongRedirectChain: true })).toEqual([
			'probe/cap-redirects',
		])
	})

	it('fixture 70: answering past maxElapsedMs and resolving flips only probe/cap-elapsed', async () => {
		expect(await probeFailures({ resolveAfterElapsedCap: true })).toEqual([
			'probe/cap-elapsed',
		])
	})

	it('fixture 71: throwing on a 500 flips only probe/observe-anomalous-status', async () => {
		expect(await probeFailures({ throwOnFiveHundred: true })).toEqual([
			'probe/observe-anomalous-status',
		])
	})

	it('fixture 72: denying the authorized request too flips only probe/allow-authorized-loopback', async () => {
		expect(await probeFailures({ denyAuthorized: true })).toEqual([
			'probe/allow-authorized-loopback',
		])
	})
})
