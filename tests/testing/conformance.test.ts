// Story 6.1 AC 12 fixtures 41-72: the non-vacuity proof for AD-37's published
// conformance suite. Every mutant below flips exactly one behaviour, and each
// fixture asserts WHICH qualified outcome id went red. A mutant that flips two
// means the two assertions overlap and at least one is not measuring what its
// id says.

import { describe, expect, it } from 'vitest'
import { invokePort } from '../../src/application/invoke-port.ts'
import { RuntimeFault } from '../../src/core/schemas/faults.ts'
import type {
	ApiProbeRequest,
	ClockReadRequest,
	CorpusResolveRequest,
	FileReadRequest,
	FileWriteRequest,
	McpProbeRequest,
	ProbeRequest,
} from '../../src/core/schemas/port-messages.ts'
import type {
	CommandTargetPolicy,
	McpTargetPolicy,
	ProbeTargetPolicy,
} from '../../src/core/schemas/probe-policy.ts'
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
import type {
	CommandProbeSubject,
	McpProbeSubject,
	ProbeSubject,
} from '../../src/testing/probe-conformance.ts'
import {
	runCommandLineProbeConformance,
	runEnvironmentProbePortConformance,
	runMcpProbeConformance,
} from '../../src/testing/probe-conformance.ts'

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

	it('fixture 49: ignoring the abort signal flips only prompt-abort, on the budget', async () => {
		// No wall-clock threshold: a CI scheduling pause would fail it while
		// `prompt-abort` is correct. That the run settles at all is the evidence
		// the budget fired, since the subject's call never settles on its own.
		const report = await runCorpusPortConformance(
			syntheticSubject(corpusShapes, { ignoreAbort: true }, 50),
		)
		expect(failedIds(report)).toEqual(['resolve/prompt-abort'])
		const abort = report.outcomes.find(
			(outcome) => outcome.id === 'resolve/prompt-abort',
		)
		expect(abort?.detail).toContain('50ms after the signal aborted')
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
			'command-probe': 16,
			'mcp-probe': 14,
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
	/**
	 * Answer the authorized request without echoing one of the four fields that
	 * tie an observation to the request it answers. Both port messages are
	 * unions, so `'kind'` is the one that lets an api request come back with a
	 * schema-valid observation of another mechanism.
	 */
	readonly breakEcho?: 'kind' | 'probeId' | 'interfaceId' | 'operationId'
	/** Which kind the `'kind'` case substitutes. The observation union has three members, and `echoMismatch` has to catch all of them. */
	readonly breakEchoKind?: 'cli' | 'mcp'
	/** Answer the faulting request with an observation of another mechanism, which is what the anomalous-status check's own failure detail has to name. */
	readonly answerFaultingWith?: 'cli' | 'mcp'
	/** Declare the faulting request itself as a tool call, and answer it with a correlated tool-call observation. `ProbeSubject.faultingRequest` is typed over the whole request union, so this is a subject the published type admits. */
	readonly faultingRequestIsMcp?: boolean
	/**
	 * Refuse the named denial the right way and at the wrong time: reach the
	 * mechanism first, then throw `forbidden-target`. Every other denial mutant
	 * makes the port RESOLVE, which reds on the code check before the count is
	 * ever consulted, so without this the `underlyingCalls() === 0` clause on
	 * every denial assertion is deletable with the whole suite staying green.
	 * The failure it lets through is an adapter that opens a connection, or
	 * spawns a server with the operator's own credentials, and only then
	 * consults its mapping.
	 */
	readonly denyAfterContact?:
		| 'unmapped'
		| 'denied-loopback'
		| 'denied-private'
		| 'denied-link-local'
		| 'denied-metadata'
		| 'denied-method'
		| 'denied-scheme'
	/** Refuse the redirect at its new target correctly, without making the first hop. The pin of 1 is the only thing proving the authorized first hop happened, and every other redirect mutant resolves, so the pin has no other mutant that can reach it. */
	readonly refuseRedirectBeforeFirstHop?: boolean
	/** Cap the redirect chain with the right code after the wrong number of hops. `cap-redirects`'s own comment says only the count can refuse this case, and that clause is what the count pins. */
	readonly capRedirectsAtWrongCount?: boolean
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
	method: ApiProbeRequest['method'] = 'GET',
): ApiProbeRequest {
	return {
		probeId: `probe-${operationId}`,
		interfaceId,
		operationId,
		kind: 'api',
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

function mcpProbeRequest(
	interfaceId: string,
	operationId: string,
	toolName = 'search_notes',
): McpProbeRequest {
	return {
		probeId: `probe-${operationId}`,
		interfaceId,
		operationId,
		kind: 'mcp',
		toolName,
		channels: { arguments: {} },
	}
}

/** A correlated answer to a tool-call request: every echoed field matches, so `echoMismatch` passes and the assertion's own `check` runs. */
function mcpObservationFor(request: ProbeRequest) {
	return {
		probeId: request.probeId,
		interfaceId: request.interfaceId,
		operationId: request.operationId,
		kind: 'mcp' as const,
		isError: true,
		result: { kind: 'json' as const, value: { ok: false } },
	}
}

function observation(request: ProbeRequest, status: number) {
	return {
		probeId: request.probeId,
		interfaceId: request.interfaceId,
		operationId: request.operationId,
		kind: 'api' as const,
		status,
		headers: { 'content-type': 'application/json' },
		body: { kind: 'json' as const, value: { ok: status < 400 } },
	}
}

/**
 * One echoed field replaced with a schema-valid value that is not the one asked
 * for. Each non-api member of the observation union carries its own fields in
 * place of a status and headers, so the kind case is a whole different message
 * rather than a relabelled one, and it is built per substituted kind.
 *
 * `probeRequest` and `observation` above stay api-shaped. This is the api arm
 * of the suite, and `probe-conformance.ts`'s own rule is that a subject
 * presenting for one mechanism is not asked to fake another's scenarios; the
 * kind that varies here is the kind the port answers with, which is exactly
 * what `echoMismatch` reads.
 */
function breakEcho(
	observed: ReturnType<typeof observation>,
	field: ProbeKnobs['breakEcho'],
	substituted: 'cli' | 'mcp' = 'cli',
): unknown {
	if (field === undefined) return observed
	if (field === 'kind') {
		const correlation = {
			probeId: observed.probeId,
			interfaceId: observed.interfaceId,
			operationId: observed.operationId,
		}
		return substituted === 'mcp'
			? {
					...correlation,
					kind: 'mcp' as const,
					isError: false,
					result: { kind: 'json' as const, value: { ok: true } },
				}
			: {
					...correlation,
					kind: 'cli' as const,
					exitCode: 0,
					stdout: { kind: 'text' as const, value: 'ok' },
					stderr: { kind: 'absent' as const },
					artifacts: {},
				}
	}
	return { ...observed, [field]: `not-the-${field}` }
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
		faultingRequest: knobs.faultingRequestIsMcp
			? mcpProbeRequest('authorized', 'faulting')
			: probeRequest('authorized', 'faulting'),
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
						if (knobs.denyAfterContact === operation) hops++
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
					return breakEcho(
						observation(request, 200),
						knobs.breakEcho,
						knobs.breakEchoKind,
					)
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
					if (knobs.faultingRequestIsMcp) return mcpObservationFor(request)
					return knobs.answerFaultingWith === undefined
						? observation(request, 500)
						: breakEcho(
								observation(request, 500),
								'kind',
								knobs.answerFaultingWith,
							)
				}
				if (operation === 'redirecting') {
					if (!knobs.refuseRedirectBeforeFirstHop) hops++
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
					hops += knobs.capRedirectsAtWrongCount
						? MAX_REDIRECTS + 2
						: MAX_REDIRECTS + 1
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

	// The suite passed nineteen of nineteen against an adapter that answered
	// every request with an observation for a different one, because it checked
	// that the value parsed and never that it correlated. Both port messages
	// became unions when the command kind landed, so the failure that mattered
	// was `kind`: an adapter could answer a command request with a schema-valid
	// HTTP observation and certify clean without ever running a command.
	// The `underlyingCalls() === 0` clause on every denial assertion, proved
	// separately from the code check. Each row refuses correctly and only after
	// touching the mechanism, so the assertion reds on its count alone.
	it.each([
		['unmapped', 'probe/deny-unmapped-interface'],
		['denied-loopback', 'probe/deny-unauthorized-loopback'],
		['denied-private', 'probe/deny-private'],
		['denied-link-local', 'probe/deny-link-local'],
		['denied-metadata', 'probe/deny-metadata'],
		['denied-method', 'probe/deny-unauthorized-method'],
		['denied-scheme', 'probe/deny-unauthorized-scheme'],
	] as const)(
		'refusing %s only after a packet leaves flips only %s',
		async (operation, expected) => {
			expect(await probeFailures({ denyAfterContact: operation })).toEqual([
				expected,
			])
		},
	)

	// The two redirect pins, which no resolving mutant can reach: both of those
	// red on the code check first. `deny-on-redirect` pins one call because the
	// first hop is authorized and happens, and `cap-redirects` pins the whole
	// chain because every hop in it is authorized, so its own comment says the
	// count is the only thing that can refuse the case.
	it('refusing the redirect without making the authorized first hop flips only probe/deny-on-redirect', async () => {
		expect(await probeFailures({ refuseRedirectBeforeFirstHop: true })).toEqual(
			['probe/deny-on-redirect'],
		)
	})

	it('capping the redirect chain after the wrong number of hops flips only probe/cap-redirects', async () => {
		expect(await probeFailures({ capRedirectsAtWrongCount: true })).toEqual([
			'probe/cap-redirects',
		])
	})

	it.each([
		['kind', 'answering a request with an observation of the other mechanism'],
		['probeId', 'answering with another probe identifier'],
		['interfaceId', 'answering about another interface'],
		['operationId', 'answering about another operation'],
	] as const)(
		'fixture 73 (%s): %s flips only probe/allow-authorized-loopback',
		async (field, _description) => {
			expect(await probeFailures({ breakEcho: field })).toEqual([
				'probe/allow-authorized-loopback',
			])
		},
	)

	it.each(['cli', 'mcp'] as const)(
		'says which field failed to come back, for a substituted %s observation',
		async (substituted) => {
			const report = await runEnvironmentProbePortConformance(
				syntheticProbeSubject({
					breakEcho: 'kind',
					breakEchoKind: substituted,
				}),
			)
			const outcome = report.outcomes.find(
				(each) => each.id === 'probe/allow-authorized-loopback',
			)
			expect(outcome?.passed).toBe(false)
			expect(report.passed).toBe(false)
			expect(outcome?.detail).toMatch(
				new RegExp(`observed kind "${substituted}"`),
			)
			expect(outcome?.detail).toMatch(/does not correlate/)
		},
	)

	// Substituting the OBSERVATION's kind while the request stays api never
	// reaches the status comparison: `echoMismatch` compares `kind` among the
	// four echoed fields and short-circuits first.
	it.each(['cli', 'mcp'] as const)(
		'reports a %s answer to an api faulting request as a correlation failure',
		async (substituted) => {
			const report = await runEnvironmentProbePortConformance(
				syntheticProbeSubject({ answerFaultingWith: substituted }),
			)
			const outcome = report.outcomes.find(
				(each) => each.id === 'probe/observe-anomalous-status',
			)
			expect(outcome?.passed).toBe(false)
			expect(outcome?.detail).toBe(
				`observed kind "${substituted}" for a request carrying "api", so the answer does not correlate with the question`,
			)
			expect(report.passed).toBe(false)
		},
	)

	// Substituting the REQUEST's kind does reach it. `faultingRequest` is typed
	// over the whole request union, so a subject may declare a tool call there
	// and answer it correlated; `echoMismatch` passes and the status check's own
	// non-api arm fires. It used to call that answer "a command observation".
	it('names the kind it observed when the faulting request is itself a tool call', async () => {
		const report = await runEnvironmentProbePortConformance(
			syntheticProbeSubject({ faultingRequestIsMcp: true }),
		)
		const outcome = report.outcomes.find(
			(each) => each.id === 'probe/observe-anomalous-status',
		)
		expect(outcome?.passed).toBe(false)
		expect(outcome?.detail).toBe(
			'observed an observation of kind "mcp", expected status 500',
		)
	})
})

// The `cli` and `mcp` arms' non-vacuity proofs, on the shape the `api` arm's
// fixtures 59-73 set. Each subject below is one conforming synthetic adapter
// with one knob per assertion; every knob defaults off, so the base case is the
// subject every mutant is a single change to. The `cli` arm shipped without
// this: `command-probe-subject.test.ts` runs the real adapter and asserts
// fifteen of fifteen, which proves the arm passes and says nothing about
// whether any single assertion can fail.
//
// Every mutant is keyed to one `operationId`, which is what keeps the flips
// disjoint. Two `mcp` assertions read the structured result, so a mutant that
// emptied it for every request would flip both and neither would be measuring
// what its id says.

const INJECTION_VALUE = 'literal-$(echo pwned)'
const ARTIFACT_ID = 'report'
const ARTIFACT_TEXT = 'artifact-body'
const PERMITTED_ENV_KEY = 'PROBE_MODE'
const UNPERMITTED_ENV_KEY = 'AWS_SECRET_ACCESS_KEY'
const ECHO_KEY = 'echo'
const ECHO_VALUE = 'declared-$(echo pwned)'
const MCP_RESULT_KEYS = ['ok', ECHO_KEY]

type CommandKnobs = {
	readonly denyAuthorized?: boolean
	readonly throwOnNonZeroExit?: boolean
	readonly allowUnmappedInterface?: boolean
	readonly allowUnmappedExecutable?: boolean
	readonly allowUnauthorizedSubcommand?: boolean
	readonly allowUnauthorizedEnvironmentKey?: boolean
	readonly mangleArgument?: boolean
	readonly dropArtifact?: boolean
	readonly resolveAfterElapsedCap?: boolean
	readonly forbiddenInsteadOfCapOnOutput?: boolean
	/** Declare the non-zero-exit request itself as a tool call, and answer it correlated. `CommandProbeSubject.nonZeroExitRequest` is typed over the whole request union, so this is a subject the published type admits, and it is what reaches the check's own non-`cli` arm. */
	readonly nonZeroExitRequestIsMcp?: boolean
	/** Refuse the named denial correctly but only after spawning. `ProbeKnobs.denyAfterContact` carries the reasoning. */
	readonly denyAfterSpawn?:
		| 'unmapped-interface'
		| 'unmapped-executable'
		| 'unauthorized-subcommand'
		| 'unauthorized-environment-key'
}

function commandRequest(
	operationId: string,
	overrides: {
		readonly interfaceId?: string
		readonly executable?: string
		readonly subcommandPath?: readonly string[]
		readonly environment?: Record<string, string>
	} = {},
): ProbeRequest {
	return {
		probeId: `probe-${operationId}`,
		interfaceId: overrides.interfaceId ?? 'devtools',
		operationId,
		kind: 'cli',
		executable: overrides.executable ?? 'probe-cli',
		subcommandPath: [...(overrides.subcommandPath ?? [])],
		channels: {
			argument: {},
			option: {},
			environment: overrides.environment ?? {},
			stdin: { kind: 'absent' },
		},
	}
}

function commandObservation(
	request: ProbeRequest,
	overrides: {
		readonly exitCode?: number
		readonly argv?: readonly string[]
		readonly artifacts?: Record<string, { kind: 'text'; value: string }>
	} = {},
) {
	return {
		probeId: request.probeId,
		interfaceId: request.interfaceId,
		operationId: request.operationId,
		kind: 'cli' as const,
		exitCode: overrides.exitCode ?? 0,
		stdout: {
			kind: 'json' as const,
			value: { argv: [...(overrides.argv ?? [])] },
		},
		stderr: { kind: 'absent' as const },
		artifacts: overrides.artifacts ?? {},
	}
}

const commandPolicy: CommandTargetPolicy = {
	authorizations: [
		{
			interfaceId: 'devtools',
			executable: 'probe-cli',
			target: '/usr/bin/true',
			permittedSubcommandPaths: [[]],
			permittedEnvironmentKeys: [PERMITTED_ENV_KEY],
			cwd: '/tmp',
			artifacts: { [ARTIFACT_ID]: 'report.txt' },
			maxElapsedMs: 1500,
			maxOutputBytes: 4096,
		},
	],
}

const commandShapes: SyntheticShapes<ProbeRequest> = {
	name: 'synthetic-command',
	sampleRequest: commandRequest('sample'),
	validResponse: (request) => commandObservation(request),
	// An exit code the schema types as an integer, given a string.
	invalidResponse: () => ({ kind: 'cli', exitCode: 'not-a-number' }),
	inBandValue: () => ({ error: 'unreachable' }),
	artifactPath: 'ProbeObservation',
}

function syntheticCommandSubject(
	knobs: CommandKnobs = {},
): CommandProbeSubject {
	const shared = syntheticSubject<ProbeRequest>(commandShapes, {}, 100)

	/** The deny cases, each keyed by the operationId its request carries. */
	const denials: Record<string, boolean | undefined> = {
		'unmapped-interface': knobs.allowUnmappedInterface,
		'unmapped-executable': knobs.allowUnmappedExecutable,
		'unauthorized-subcommand': knobs.allowUnauthorizedSubcommand,
		'unauthorized-environment-key': knobs.allowUnauthorizedEnvironmentKey,
	}

	return {
		...shared,
		// A real policy, because three denial assertions read it to check this
		// subject is internally consistent: `devtools` is paired with
		// `probe-cli` and permits the empty subcommand path only, so every
		// request below that presents as denied really is denied by it.
		policy: commandPolicy,
		authorizedRequest: commandRequest('authorized'),
		// Each of the three names the one field its own denial turns on, so the
		// policy above really refuses it. They were three copies of the
		// authorized request until the denial assertions started reading the
		// policy, which is exactly the subject a real adapter would certify by
		// accident.
		unmappedInterfaceRequest: commandRequest('unmapped-interface', {
			interfaceId: 'unmapped',
		}),
		unmappedExecutableRequest: commandRequest('unmapped-executable', {
			executable: 'npm',
		}),
		unauthorizedSubcommandRequest: commandRequest('unauthorized-subcommand', {
			subcommandPath: ['danger'],
		}),
		unauthorizedEnvironmentKeyRequest: commandRequest(
			'unauthorized-environment-key',
			{ environment: { [UNPERMITTED_ENV_KEY]: 'smuggled' } },
		),
		nonZeroExitRequest: knobs.nonZeroExitRequestIsMcp
			? mcpProbeRequest('devtools', 'non-zero-exit')
			: commandRequest('non-zero-exit'),
		injectionRequest: commandRequest('injection'),
		injectionArgumentValue: INJECTION_VALUE,
		artifactRequest: commandRequest('artifact'),
		artifactId: ARTIFACT_ID,
		artifactExpectedText: ARTIFACT_TEXT,
		overElapsedRequest: commandRequest('over-elapsed'),
		overOutputRequest: commandRequest('over-output'),
		build: async (scenario) => {
			const built = await shared.build(scenario)
			if (scenario !== 'resolves') return built
			let hops = 0
			const port = async (
				request: ProbeRequest,
				signal: AbortSignal,
			): Promise<unknown> => {
				const operation = request.operationId
				if (operation in denials) {
					if (denials[operation] !== true) {
						if (knobs.denyAfterSpawn === operation) hops++
						throw forbidden(`${operation} is refused before a process spawns`)
					}
					hops++
					return commandObservation(request)
				}
				if (operation === 'authorized') {
					if (knobs.denyAuthorized) {
						throw forbidden('this subject refuses everything')
					}
					hops++
					return commandObservation(request)
				}
				if (operation === 'non-zero-exit') {
					hops++
					if (knobs.throwOnNonZeroExit) {
						throw new RuntimeFault(
							'port-failure',
							'ProbeObservation',
							'the process exited non-zero',
						)
					}
					if (knobs.nonZeroExitRequestIsMcp) return mcpObservationFor(request)
					return commandObservation(request, { exitCode: 5 })
				}
				if (operation === 'injection') {
					hops++
					return commandObservation(request, {
						argv: [
							knobs.mangleArgument
								? `${INJECTION_VALUE} expanded`
								: INJECTION_VALUE,
						],
					})
				}
				if (operation === 'artifact') {
					hops++
					return commandObservation(request, {
						artifacts: knobs.dropArtifact
							? {}
							: { [ARTIFACT_ID]: { kind: 'text', value: ARTIFACT_TEXT } },
					})
				}
				if (operation === 'over-elapsed') {
					hops++
					if (knobs.resolveAfterElapsedCap) return commandObservation(request)
					throw capped('the process ran past maxElapsedMs')
				}
				if (operation === 'over-output') {
					hops++
					throw knobs.forbiddenInsteadOfCapOnOutput
						? forbidden('the output was too large')
						: capped('the process wrote past maxOutputBytes')
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

async function commandFailures(knobs: CommandKnobs) {
	const report = await runCommandLineProbeConformance(
		syntheticCommandSubject(knobs),
	)
	expect(report.outcomes).toHaveLength(
		CONFORMANCE_OUTCOME_COUNTS['command-probe'],
	)
	expect(report.passed).toBe(false)
	return failedIds(report)
}

describe('the command arm: one mutant per assertion flips exactly its own id', () => {
	it('a conforming synthetic command subject passes, sixteen outcomes', async () => {
		const report = await runCommandLineProbeConformance(
			syntheticCommandSubject(),
		)
		expect(report.outcomes).toHaveLength(16)
		expect(failedIds(report)).toEqual([])
		expect(report.passed).toBe(true)
		expect(report.port).toBe('command-probe')
		expect(new Set(report.outcomes.map((each) => each.id)).size).toBe(16)
	})

	it.each([
		[{ denyAuthorized: true }, 'command/allow-authorized-invocation'],
		[{ throwOnNonZeroExit: true }, 'command/observe-nonzero-exit'],
		[{ allowUnmappedInterface: true }, 'command/deny-unmapped-interface'],
		[{ allowUnmappedExecutable: true }, 'command/deny-unmapped-executable'],
		[
			{ allowUnauthorizedSubcommand: true },
			'command/deny-unauthorized-subcommand',
		],
		[
			{ allowUnauthorizedEnvironmentKey: true },
			'command/deny-unauthorized-environment-key',
		],
		[{ mangleArgument: true }, 'command/argument-passed-literally'],
		[{ dropArtifact: true }, 'command/capture-declared-artifact'],
		[{ resolveAfterElapsedCap: true }, 'command/cap-elapsed'],
		[{ forbiddenInsteadOfCapOnOutput: true }, 'command/cap-output-bytes'],
	] as const)('%o flips only %s', async (knobs, expected) => {
		expect(await commandFailures(knobs)).toEqual([expected])
	})

	it.each([
		[
			'an unmapped interface the policy does name',
			{ unmappedInterfaceRequest: commandRequest('unmapped-interface') },
			'command/deny-unmapped-interface',
			'names an authorization for unmappedInterfaceRequest.interfaceId',
		],
		[
			'an unmapped executable the policy does pair',
			{ unmappedExecutableRequest: commandRequest('unmapped-executable') },
			'command/deny-unmapped-executable',
			"pairs unmappedExecutableRequest's interface with its executable",
		],
		[
			'an unmapped executable declared as a tool call',
			{
				unmappedExecutableRequest: mcpProbeRequest(
					'devtools',
					'unmapped-executable',
				),
			},
			'command/deny-unmapped-executable',
			'unmappedExecutableRequest declares a "mcp" request',
		],
		[
			'an unauthorized subcommand declared as a tool call',
			{
				unauthorizedSubcommandRequest: mcpProbeRequest(
					'devtools',
					'unauthorized-subcommand',
				),
			},
			'command/deny-unauthorized-subcommand',
			'unauthorizedSubcommandRequest declares a "mcp" request',
		],
		[
			'an unauthorized subcommand on a pair the policy never names',
			{
				unauthorizedSubcommandRequest: commandRequest(
					'unauthorized-subcommand',
					{ interfaceId: 'unmapped', subcommandPath: ['danger'] },
				),
			},
			'command/deny-unauthorized-subcommand',
			'cannot tell an unmapped pair from an unauthorized subcommand',
		],
		[
			'an unauthorized subcommand path the policy does permit',
			{
				unauthorizedSubcommandRequest: commandRequest(
					'unauthorized-subcommand',
				),
			},
			'command/deny-unauthorized-subcommand',
			'permits subcommand path []',
		],
		[
			'an unauthorized environment key declared as a tool call',
			{
				unauthorizedEnvironmentKeyRequest: mcpProbeRequest(
					'devtools',
					'unauthorized-environment-key',
				),
			},
			'command/deny-unauthorized-environment-key',
			'unauthorizedEnvironmentKeyRequest declares a "mcp" request',
		],
		[
			'an unauthorized environment key on a pair the policy never names',
			{
				unauthorizedEnvironmentKeyRequest: commandRequest(
					'unauthorized-environment-key',
					{
						interfaceId: 'unmapped',
						environment: { [UNPERMITTED_ENV_KEY]: 'smuggled' },
					},
				),
			},
			'command/deny-unauthorized-environment-key',
			'cannot tell an unmapped pair from an unauthorized environment key',
		],
		[
			'an unauthorized environment key request that declares none',
			{
				unauthorizedEnvironmentKeyRequest: commandRequest(
					'unauthorized-environment-key',
				),
			},
			'command/deny-unauthorized-environment-key',
			'declares no environment key',
		],
		[
			'an unauthorized environment key the policy does permit',
			{
				unauthorizedEnvironmentKeyRequest: commandRequest(
					'unauthorized-environment-key',
					{ environment: { [PERMITTED_ENV_KEY]: 'fine' } },
				),
			},
			'command/deny-unauthorized-environment-key',
			'permits every environment key unauthorizedEnvironmentKeyRequest declares',
		],
	] as const)(
		'reports a subject declaring %s',
		async (_what, override, id, expected) => {
			const report = await runCommandLineProbeConformance({
				...syntheticCommandSubject(),
				...override,
			})
			const outcome = report.outcomes.find((each) => each.id === id)
			expect(outcome?.passed).toBe(false)
			expect(outcome?.detail).toContain(expected)
			expect(failedIds(report)).toEqual([id])
		},
	)

	it.each([
		['unmapped-interface', 'command/deny-unmapped-interface'],
		['unmapped-executable', 'command/deny-unmapped-executable'],
		['unauthorized-subcommand', 'command/deny-unauthorized-subcommand'],
		[
			'unauthorized-environment-key',
			'command/deny-unauthorized-environment-key',
		],
	] as const)(
		'refusing %s only after a process spawns flips only %s',
		async (operation, expected) => {
			expect(await commandFailures({ denyAfterSpawn: operation })).toEqual([
				expected,
			])
		},
	)

	// This one asserts the detail string itself. The check's non-`cli` arm names
	// the kind it observed, where the binary ternary it replaced called every
	// one of them "an api observation".
	it('names the kind it observed when a command subject declares a tool call for the non-zero-exit case', async () => {
		const report = await runCommandLineProbeConformance(
			syntheticCommandSubject({ nonZeroExitRequestIsMcp: true }),
		)
		const outcome = report.outcomes.find(
			(each) => each.id === 'command/observe-nonzero-exit',
		)
		expect(outcome?.passed).toBe(false)
		expect(outcome?.detail).toBe(
			'observed an observation of kind "mcp", expected a non-zero exit',
		)
	})
})

type McpKnobs = {
	readonly denyAuthorized?: boolean
	readonly throwOnErrorResult?: boolean
	readonly allowUnmappedInterface?: boolean
	readonly allowUnauthorizedTool?: boolean
	readonly mangleArgument?: boolean
	readonly dropStructuredResult?: boolean
	readonly resolveAfterElapsedCap?: boolean
	readonly forbiddenInsteadOfCapOnResultBytes?: boolean
	/** Declare the error-result request itself as an HTTP call, and answer it correlated. `McpProbeSubject.errorResultRequest` is typed over the whole request union for the reason the other two arms' equivalents are. */
	readonly errorResultRequestIsApi?: boolean
	/** The same for the argument-echo request, whose check has its own kind arm. */
	readonly argumentEchoRequestIsApi?: boolean
	/** The same for the structured-result request. */
	readonly structuredResultRequestIsApi?: boolean
	/** Report the tool's error with an absent result channel, so the flag survives and what the tool said about the failure does not. */
	readonly dropErrorResultBody?: boolean
	/** Answer the structured-result request with a result that carries every declared key but one. The whole-channel mutant lands in the absent arm and never reaches the missing-keys arm. */
	readonly dropOneResultKey?: boolean
	/** Refuse the named denial correctly but only after launching the server. `ProbeKnobs.denyAfterContact` carries the reasoning. */
	readonly denyAfterLaunch?: 'unmapped-interface' | 'unauthorized-tool'
}

function mcpObservation(
	request: ProbeRequest,
	overrides: {
		readonly isError?: boolean
		readonly echo?: string
		readonly absentResult?: boolean
		/** Drop one declared key while keeping the channel, which is the arm the whole-channel mutant cannot reach. */
		readonly omitKey?: string
	} = {},
) {
	const correlation = {
		probeId: request.probeId,
		interfaceId: request.interfaceId,
		operationId: request.operationId,
		kind: 'mcp' as const,
		isError: overrides.isError ?? false,
	}
	if (overrides.absentResult) {
		return { ...correlation, result: { kind: 'absent' as const } }
	}
	const value: Record<string, unknown> = {
		ok: true,
		[ECHO_KEY]: overrides.echo ?? ECHO_VALUE,
	}
	if (overrides.omitKey !== undefined) delete value[overrides.omitKey]
	return {
		...correlation,
		result: { kind: 'json' as const, value },
	}
}

const mcpPolicy: McpTargetPolicy = {
	authorizations: [
		{
			interfaceId: 'notes',
			target: '/usr/bin/true',
			targetArgs: [],
			// `mcpProbeRequest` names `search_notes` on every request, and
			// `unauthorizedToolRequest` is the one that asks for a tool this
			// list omits.
			tools: ['search_notes'],
			cwd: '/tmp',
			serverEnvironment: {},
			maxElapsedMs: 1500,
			maxOutputBytes: 4096,
		},
	],
}

const mcpShapes: SyntheticShapes<ProbeRequest> = {
	name: 'synthetic-mcp',
	sampleRequest: mcpProbeRequest('notes', 'sample'),
	validResponse: (request) => mcpObservation(request),
	// `isError` typed as a boolean, given a string.
	invalidResponse: () => ({ kind: 'mcp', isError: 'not-a-boolean' }),
	inBandValue: () => ({ error: 'unreachable' }),
	artifactPath: 'ProbeObservation',
}

function syntheticMcpSubject(knobs: McpKnobs = {}): McpProbeSubject {
	const shared = syntheticSubject<ProbeRequest>(mcpShapes, {}, 100)

	const denials: Record<string, boolean | undefined> = {
		'unmapped-interface': knobs.allowUnmappedInterface,
		'unauthorized-tool': knobs.allowUnauthorizedTool,
	}

	return {
		...shared,
		// A real policy for the reason the command one is real: the two denial
		// assertions read it. `notes` is authorized for the tool every request
		// here names and `unmapped` names no entry at all, so both denials are
		// this policy's rather than the subject's say-so.
		policy: mcpPolicy,
		authorizedRequest: mcpProbeRequest('notes', 'authorized'),
		unmappedInterfaceRequest: mcpProbeRequest('unmapped', 'unmapped-interface'),
		unauthorizedToolRequest: mcpProbeRequest(
			'notes',
			'unauthorized-tool',
			'env_tool',
		),
		errorResultRequest: knobs.errorResultRequestIsApi
			? probeRequest('notes', 'error-result')
			: mcpProbeRequest('notes', 'error-result'),
		argumentEchoRequest: knobs.argumentEchoRequestIsApi
			? probeRequest('notes', 'argument-echo')
			: mcpProbeRequest('notes', 'argument-echo'),
		argumentEchoValue: ECHO_VALUE,
		argumentEchoResultKey: ECHO_KEY,
		structuredResultRequest: knobs.structuredResultRequestIsApi
			? probeRequest('notes', 'structured-result')
			: mcpProbeRequest('notes', 'structured-result'),
		structuredResultKeys: MCP_RESULT_KEYS,
		overElapsedRequest: mcpProbeRequest('notes', 'over-elapsed'),
		overResultBytesRequest: mcpProbeRequest('notes', 'over-result-bytes'),
		build: async (scenario) => {
			const built = await shared.build(scenario)
			if (scenario !== 'resolves') return built
			let hops = 0
			const port = async (
				request: ProbeRequest,
				signal: AbortSignal,
			): Promise<unknown> => {
				const operation = request.operationId
				if (operation in denials) {
					if (denials[operation] !== true) {
						if (knobs.denyAfterLaunch === operation) hops++
						throw forbidden(`${operation} is refused before a server starts`)
					}
					hops++
					return mcpObservation(request)
				}
				if (operation === 'authorized') {
					if (knobs.denyAuthorized) {
						throw forbidden('this subject refuses everything')
					}
					hops++
					return mcpObservation(request)
				}
				if (operation === 'error-result') {
					hops++
					if (knobs.throwOnErrorResult) {
						throw new RuntimeFault(
							'port-failure',
							'ProbeObservation',
							'the tool reported an error',
						)
					}
					if (knobs.errorResultRequestIsApi) return observation(request, 200)
					return mcpObservation(request, {
						isError: true,
						absentResult: knobs.dropErrorResultBody === true,
					})
				}
				if (operation === 'argument-echo') {
					hops++
					if (knobs.argumentEchoRequestIsApi) return observation(request, 200)
					return mcpObservation(request, {
						echo: knobs.mangleArgument ? `${ECHO_VALUE} expanded` : ECHO_VALUE,
					})
				}
				if (operation === 'structured-result') {
					hops++
					if (knobs.structuredResultRequestIsApi) {
						return observation(request, 200)
					}
					return mcpObservation(request, {
						absentResult: knobs.dropStructuredResult === true,
						omitKey: knobs.dropOneResultKey ? ECHO_KEY : undefined,
					})
				}
				if (operation === 'over-elapsed') {
					hops++
					if (knobs.resolveAfterElapsedCap) return mcpObservation(request)
					throw capped('the session ran past maxElapsedMs')
				}
				if (operation === 'over-result-bytes') {
					hops++
					throw knobs.forbiddenInsteadOfCapOnResultBytes
						? forbidden('the result was too large')
						: capped('the server wrote past maxOutputBytes')
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

async function mcpFailures(knobs: McpKnobs) {
	const report = await runMcpProbeConformance(syntheticMcpSubject(knobs))
	expect(report.outcomes).toHaveLength(CONFORMANCE_OUTCOME_COUNTS['mcp-probe'])
	expect(report.passed).toBe(false)
	return failedIds(report)
}

describe('the mcp arm: one mutant per assertion flips exactly its own id', () => {
	it('a conforming synthetic mcp subject passes, fourteen outcomes', async () => {
		const report = await runMcpProbeConformance(syntheticMcpSubject())
		expect(report.outcomes).toHaveLength(14)
		expect(failedIds(report)).toEqual([])
		expect(report.passed).toBe(true)
		expect(report.port).toBe('mcp-probe')
		expect(new Set(report.outcomes.map((each) => each.id)).size).toBe(14)
	})

	it.each([
		[{ denyAuthorized: true }, 'mcp/allow-authorized-tool-call'],
		[{ throwOnErrorResult: true }, 'mcp/observe-error-result'],
		[{ allowUnmappedInterface: true }, 'mcp/deny-unmapped-interface'],
		[{ allowUnauthorizedTool: true }, 'mcp/deny-unauthorized-tool'],
		[{ mangleArgument: true }, 'mcp/arguments-passed-as-declared'],
		[{ dropStructuredResult: true }, 'mcp/observe-declared-result-channel'],
		[{ dropOneResultKey: true }, 'mcp/observe-declared-result-channel'],
		[{ dropErrorResultBody: true }, 'mcp/observe-error-result'],
		[{ resolveAfterElapsedCap: true }, 'mcp/cap-elapsed'],
		[{ forbiddenInsteadOfCapOnResultBytes: true }, 'mcp/cap-result-bytes'],
	] as const)('%o flips only %s', async (knobs, expected) => {
		expect(await mcpFailures(knobs)).toEqual([expected])
	})

	it.each([
		['unmapped-interface', 'mcp/deny-unmapped-interface'],
		['unauthorized-tool', 'mcp/deny-unauthorized-tool'],
	] as const)(
		'refusing %s only after the server launches flips only %s',
		async (operation, expected) => {
			expect(await mcpFailures({ denyAfterLaunch: operation })).toEqual([
				expected,
			])
		},
	)

	it('reports the count on its own when a denial is correct but late', async () => {
		const report = await runMcpProbeConformance(
			syntheticMcpSubject({ denyAfterLaunch: 'unauthorized-tool' }),
		)
		const outcome = report.outcomes.find(
			(each) => each.id === 'mcp/deny-unauthorized-tool',
		)
		expect(outcome?.passed).toBe(false)
		// The code check passed. Only the count says the server had already been
		// launched, with the operator's own working directory and environment
		// handed to it.
		expect(outcome?.detail).toBe('underlyingCalls() was 1, expected 0')
	})

	// Every complaint the arm's own policy reads can emit. Each row substitutes
	// one request on an otherwise conforming subject, so the port still refuses
	// it and the code check still passes; the only thing that reds is the read
	// saying the subject contradicts its own mapping. Without these the clause
	// that catches a mis-wired subject is itself uncaught, which is the shape
	// of the finding that opened this round.
	it.each([
		[
			'an unmapped interface the policy does name',
			{
				unmappedInterfaceRequest: mcpProbeRequest(
					'notes',
					'unmapped-interface',
				),
			},
			'mcp/deny-unmapped-interface',
			'names an authorization for unmappedInterfaceRequest.interfaceId',
		],
		[
			'an unauthorized tool declared as an HTTP call',
			{ unauthorizedToolRequest: probeRequest('notes', 'unauthorized-tool') },
			'mcp/deny-unauthorized-tool',
			'unauthorizedToolRequest declares a "api" request',
		],
		[
			'an unauthorized tool on an interface the policy never names',
			{
				unauthorizedToolRequest: mcpProbeRequest(
					'unmapped',
					'unauthorized-tool',
					'env_tool',
				),
			},
			'mcp/deny-unauthorized-tool',
			'cannot tell an unmapped interface from an unauthorized tool',
		],
		[
			'an unauthorized tool the allowlist does permit',
			{
				unauthorizedToolRequest: mcpProbeRequest(
					'notes',
					'unauthorized-tool',
					'search_notes',
				),
			},
			'mcp/deny-unauthorized-tool',
			'permits tool "search_notes"',
		],
	] as const)(
		'reports a subject declaring %s',
		async (_what, override, id, expected) => {
			const report = await runMcpProbeConformance({
				...syntheticMcpSubject(),
				...override,
			})
			const outcome = report.outcomes.find((each) => each.id === id)
			expect(outcome?.passed).toBe(false)
			expect(outcome?.detail).toContain(expected)
			expect(failedIds(report)).toEqual([id])
		},
	)

	// Two assertions on the detail string, which is what an adapter author reads.
	it('names the declared literal and what arrived when an argument is mangled', async () => {
		const report = await runMcpProbeConformance(
			syntheticMcpSubject({ mangleArgument: true }),
		)
		const outcome = report.outcomes.find(
			(each) => each.id === 'mcp/arguments-passed-as-declared',
		)
		expect(outcome?.detail).toBe(
			`the tool reported receiving ${JSON.stringify(`${ECHO_VALUE} expanded`)} on "${ECHO_KEY}", expected the declared literal`,
		)
	})

	it('names the channel and the keys it wanted when the structured result is dropped', async () => {
		const report = await runMcpProbeConformance(
			syntheticMcpSubject({ dropStructuredResult: true }),
		)
		const outcome = report.outcomes.find(
			(each) => each.id === 'mcp/observe-declared-result-channel',
		)
		expect(outcome?.detail).toBe(
			`the result channel carried {"kind":"absent"}, expected the structured result carrying ${JSON.stringify(MCP_RESULT_KEYS)}`,
		)
	})

	// The third arm's twin of the two cases the other arms carry. Both requests
	// below are typed over the whole request union, so a subject may declare an
	// HTTP call there and answer it correlated, which is what gets past
	// `echoMismatch` and reaches each check's own non-`mcp` arm. Without a case
	// each, those two arms are branches nothing can turn red.
	it('names the kind it observed when the error-result request is itself an HTTP call', async () => {
		const report = await runMcpProbeConformance(
			syntheticMcpSubject({ errorResultRequestIsApi: true }),
		)
		const outcome = report.outcomes.find(
			(each) => each.id === 'mcp/observe-error-result',
		)
		expect(outcome?.passed).toBe(false)
		expect(outcome?.detail).toBe(
			'observed an observation of kind "api", expected the envelope\'s error flag set',
		)
	})

	it('names the kind it observed when the structured-result request is itself an HTTP call', async () => {
		const report = await runMcpProbeConformance(
			syntheticMcpSubject({ structuredResultRequestIsApi: true }),
		)
		const outcome = report.outcomes.find(
			(each) => each.id === 'mcp/observe-declared-result-channel',
		)
		expect(outcome?.passed).toBe(false)
		expect(outcome?.detail).toBe(
			'observed an observation of kind "api", expected a tool call',
		)
	})

	it('names the missing key when the result channel drops one', async () => {
		const report = await runMcpProbeConformance(
			syntheticMcpSubject({ dropOneResultKey: true }),
		)
		const outcome = report.outcomes.find(
			(each) => each.id === 'mcp/observe-declared-result-channel',
		)
		expect(outcome?.passed).toBe(false)
		expect(outcome?.detail).toBe(
			`the result channel is missing ["${ECHO_KEY}"]`,
		)
	})

	it('names the kind it observed when the argument-echo request is itself an HTTP call', async () => {
		const report = await runMcpProbeConformance(
			syntheticMcpSubject({ argumentEchoRequestIsApi: true }),
		)
		const outcome = report.outcomes.find(
			(each) => each.id === 'mcp/arguments-passed-as-declared',
		)
		expect(outcome?.passed).toBe(false)
		expect(outcome?.detail).toBe(
			'observed an observation of kind "api", expected a tool call',
		)
	})
})
