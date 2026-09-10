/**
 * AD-37's in-repository probe adapter and its loopback fixture server: the
 * suite's own subject, and the only place here that uses AD-30's carve-out
 * ("no network I/O beyond a loopback fixture server it started itself").
 *
 * It lives under `tests/`, which `tsconfig-build.json` excludes, so it never
 * reaches `dist/` and AD-2's "v0 ships no network adapter at all" holds
 * literally.
 *
 * The interface-to-target map is a separate argument from the policy. That is
 * what AD-35 describes ("the caller maps those identifiers to authorized
 * targets through configuration outside the contract"), and it is the only
 * shape that can produce a scheme, host, or port denial: an adapter deriving
 * the target from the authorization it validates against can never present a
 * mismatch.
 */
import { createServer, request as httpRequest } from 'node:http'
import type { Socket } from 'node:net'
import { runPortMethod } from '../../src/adapters/port-boundary.ts'
import { evaluateTarget } from '../../src/core/probe/target-policy.ts'
import { RuntimeFault } from '../../src/core/schemas/faults.ts'
import type {
	ApiProbeRequest,
	ProbeRequest,
} from '../../src/core/schemas/port-messages.ts'
import type {
	ProbeTargetAuthorization,
	ProbeTargetPolicy,
} from '../../src/core/schemas/probe-policy.ts'
import type { EnvironmentProbePort } from '../../src/ports/environment-probe-port.ts'
import { probeParsers } from '../../src/ports/environment-probe-port.ts'
import type {
	BuiltSubject,
	ScenarioKind,
} from '../../src/testing/conformance.ts'
import type { ProbeSubject } from '../../src/testing/probe-conformance.ts'

/** The authorization's caps, exported so the fixture server and the tests read one copy. */
export const MAX_REDIRECTS = 1
export const MAX_ELAPSED_MS = 250
export const MAX_RESPONSE_BYTES = 256
export const MAX_REQUEST_BYTES = 1024
/** Well past `MAX_RESPONSE_BYTES` and `MAX_ELAPSED_MS`, so neither cap fires on timing luck. */
const OVERSIZE_BYTES = 2048
/** Two bytes each in UTF-8, one code unit each in UTF-16. Chosen so the body is under `MAX_RESPONSE_BYTES` by code units and over it by bytes. */
const UTF8_FILLER = Math.floor(MAX_RESPONSE_BYTES * 0.75)
const SLOW_ANSWER_MS = MAX_ELAPSED_MS + 350
/** What `/premature-close` declares before sending less than it promised. Below `MAX_RESPONSE_BYTES`, so the byte cap stays out of the way. */
const PREMATURE_CLOSE_DECLARED_BYTES = 64

/** Eight interfaces, one reachable target. Seven are absent from the policy or break one of its fields, which is what makes each denial reachable. */
export const SUBJECT_HOSTS = {
	authorized: 'localhost',
	unmapped: 'unmapped.test',
	loopback: 'loopback.test',
	private: 'private.test',
	linkLocal: 'link-local.test',
	metadata: 'metadata.test',
	method: 'method.test',
	scheme: 'scheme.test',
	/** the host `/redirect` points at. Not a target entry: a redirect changes the host and keeps the interface. */
	deniedRedirect: 'denied-redirect.test',
} as const

/** An address per host, injected so a denied class is exercised with no DNS lookup and no real packet toward 169.254.169.254. */
const SUBJECT_ADDRESSES: Record<string, string> = {
	[SUBJECT_HOSTS.authorized]: '127.0.0.1',
	[SUBJECT_HOSTS.unmapped]: '127.0.0.1',
	[SUBJECT_HOSTS.loopback]: '127.0.0.9',
	[SUBJECT_HOSTS.private]: '10.1.2.3',
	[SUBJECT_HOSTS.linkLocal]: '169.254.1.1',
	[SUBJECT_HOSTS.metadata]: '169.254.169.254',
	[SUBJECT_HOSTS.method]: '198.51.100.10',
	[SUBJECT_HOSTS.scheme]: '198.51.100.10',
	[SUBJECT_HOSTS.deniedRedirect]: '203.0.113.5',
}

export function subjectResolveAddress(host: string): string {
	const address = SUBJECT_ADDRESSES[host]
	if (address === undefined) {
		// A denial, never a transport failure: this propagates through
		// `runPortMethod`, and a plain Error there becomes `port-failure`.
		throw forbidden(`no address is mapped for host "${host}"`)
	}
	return address
}

export type SubjectTarget = {
	readonly scheme: string
	readonly host: string
	readonly port: number
}

/** One HTTP hop. `truncated` says `maxResponseBytes` was passed, so a short body is never mistaken for the whole one. */
export type HopResult = {
	readonly status: number
	readonly headers: Record<string, string | string[] | undefined>
	readonly body: string
	readonly truncated: boolean
}

export type Hop = {
	/** the address the policy validated. The hostname travels in `host`. */
	readonly address: string
	readonly port: number
	/** already carries the rendered path parameters and query string. */
	readonly path: string
	readonly method: string
	readonly host: string
	readonly headers: Record<string, string>
	readonly body: string | undefined
	readonly maxResponseBytes: number
	readonly signal: AbortSignal
}

export type ProbeMechanism = (hop: Hop) => Promise<HopResult>

function forbidden(detail: string): RuntimeFault {
	return new RuntimeFault('forbidden-target', 'ProbeRequest', detail)
}

function capped(detail: string): RuntimeFault {
	return new RuntimeFault('budget-exhausted', 'ProbeObservation', detail)
}

/**
 * The real hop. `host` is set explicitly so the request reaches the validated
 * address while the server still sees the name the contract named. The signal
 * is forwarded, so an abort or a cap destroys the socket.
 */
export const nodeHttpMechanism: ProbeMechanism = (hop) =>
	new Promise<HopResult>((resolve, reject) => {
		const clientRequest = httpRequest(
			{
				host: hop.address,
				port: hop.port,
				path: hop.path,
				method: hop.method,
				// `host` last so a declared header can never rewrite the name TLS
				// and the policy were checked against.
				headers: {
					...hop.headers,
					...(hop.body === undefined
						? {}
						: {
								'content-type': 'application/json',
								'content-length': String(Buffer.byteLength(hop.body)),
							}),
					host: hop.host,
				},
				signal: hop.signal,
			},
			(response) => {
				// Bytes, not characters. `setEncoding('utf8')` plus `body.length`
				// counts UTF-16 code units, so a 256-byte cap would admit 768
				// bytes of three-byte characters and the field is named for bytes.
				const chunks: Buffer[] = []
				let received = 0
				let truncated = false
				const settle = () => {
					resolve({
						status: response.statusCode ?? 0,
						headers: response.headers,
						body: Buffer.concat(chunks).toString('utf8'),
						truncated,
					})
				}
				response.on('data', (chunk: Buffer) => {
					if (truncated) return
					chunks.push(chunk)
					received += chunk.byteLength
					if (received > hop.maxResponseBytes) {
						truncated = true
						response.destroy()
					}
				})
				response.on('end', settle)
				// Only the cap path arrives here unsettled: destroying the
				// response for truncation stops `end` from firing. A body the
				// server cuts short settles through `error` below, since
				// `socketCloseListener` destroys the response whenever the
				// message is incomplete and the stream machinery then emits
				// `error` ahead of `close`. That emission is gated on an `error`
				// listener already being registered (`onError` in
				// `_http_incoming.js`, kept for backward compatibility), so
				// dropping the handler below leaves a cut-short body unsettled
				// and the adapter's elapsed cap as its only exit. Measured on
				// Node 22.12.0, 22.20.0, 24.20.0 and 26.5.0. Fixture 97 pins it.
				response.on('close', () => {
					if (truncated) settle()
				})
				response.on('error', reject)
			},
		)
		clientRequest.on('error', reject)
		clientRequest.on('upgrade', (_upgraded, socket: Socket) => {
			// A 101 no probe asked for. The response callback never runs, so
			// every handler above is out of reach, and with no listener here Node
			// leaves the request open: the call would run to the adapter's
			// elapsed cap. Node also detaches an upgraded socket from the agent
			// and from its own close and error listeners before emitting, so this
			// destroy is the only thing left that can close it. Fixture 98 pins
			// both halves.
			socket.destroy()
			reject(new Error('the server switched protocols'))
		})
		if (hop.body !== undefined) clientRequest.write(hop.body)
		clientRequest.end()
	})

/**
 * The request's four channels, rendered onto the wire. Without this the
 * channels reach nothing but the byte budget, and a body-sensitivity
 * differential would observe the same empty request as a body-free probe.
 */
function renderRequest(parsed: ApiProbeRequest): {
	readonly path: string
	readonly headers: Record<string, string>
	readonly body: string | undefined
} {
	let path = parsed.pathTemplate
	for (const [name, value] of Object.entries(parsed.channels.path)) {
		path = path.replaceAll(
			`{${name}}`,
			encodeURIComponent(
				typeof value === 'string' ? value : JSON.stringify(value),
			),
		)
	}
	const query = Object.entries(parsed.channels.query)
		.map(
			([name, value]) =>
				`${encodeURIComponent(name)}=${encodeURIComponent(
					typeof value === 'string' ? value : JSON.stringify(value),
				)}`,
		)
		.join('&')
	return {
		path: query.length > 0 ? `${path}?${query}` : path,
		headers: { ...parsed.channels.header },
		body:
			parsed.channels.body.kind === 'json'
				? JSON.stringify(parsed.channels.body.value)
				: undefined,
	}
}

/** RFC 9110 joining. `set-cookie` is dropped: a joined one is a value no consumer can split back. */
function flattenHeaders(
	headers: Record<string, string | string[] | undefined>,
): Record<string, string> {
	const flattened: Record<string, string> = {}
	for (const [name, value] of Object.entries(headers)) {
		if (name.toLowerCase() === 'set-cookie') continue
		if (value === undefined) continue
		flattened[name] = Array.isArray(value) ? value.join(', ') : value
	}
	return flattened
}

function observedBody(hop: HopResult): unknown {
	if (hop.body.length === 0) return { kind: 'absent' }
	const contentType = String(hop.headers['content-type'] ?? '')
	if (contentType.includes('application/json')) {
		try {
			return { kind: 'json', value: JSON.parse(hop.body) }
		} catch {
			return { kind: 'text', value: hop.body }
		}
	}
	return { kind: 'text', value: hop.body }
}

export function createProbeSubjectAdapter(options: {
	readonly policy: ProbeTargetPolicy
	readonly targets: Record<string, SubjectTarget>
	readonly resolveAddress: (host: string) => string
	readonly mechanism?: ProbeMechanism
}): EnvironmentProbePort {
	const mechanism = options.mechanism ?? nodeHttpMechanism

	/** Policy first, then the hop. Every redirect target comes back through here. */
	function validate(
		parsed: ApiProbeRequest,
		target: SubjectTarget,
	): {
		readonly address: string
		readonly authorization: ProbeTargetAuthorization
	} {
		const address = options.resolveAddress(target.host)
		const decision = evaluateTarget(options.policy, {
			interfaceId: parsed.interfaceId,
			scheme: target.scheme,
			host: target.host,
			port: target.port,
			address,
			method: parsed.method,
		})
		if (!decision.allowed) {
			throw forbidden(`${decision.reason}: ${decision.detail}`)
		}
		// The connection uses the address the policy validated. Re-resolving the
		// hostname between the check and the connect is the classic way past an
		// allowlist like this one.
		return {
			address: decision.canonicalAddress,
			authorization: decision.authorization,
		}
	}

	async function runProbe(
		parsed: ApiProbeRequest,
		signal: AbortSignal,
		onAuthorization: (authorization: ProbeTargetAuthorization) => void,
	): Promise<unknown> {
		const target = options.targets[parsed.interfaceId]
		if (target === undefined) {
			throw forbidden(
				`no target is mapped for interface "${parsed.interfaceId}"`,
			)
		}
		const rendered = renderRequest(parsed)
		let current = target
		let path = rendered.path
		let validated = validate(parsed, current)
		let redirects = 0

		// AD-35 caps the request as well as the response, and a declared cap that
		// no code path reads is the unbounded cap `probe-policy.ts` exists to
		// prevent. Measured on the wire form of the channels the request
		// carries, before the first hop, so an oversize request costs no I/O.
		const requestBytes = new TextEncoder().encode(
			`${rendered.path}${JSON.stringify(rendered.headers)}${rendered.body ?? ''}`,
		).byteLength

		while (true) {
			// Re-read every iteration. AC 4 step 8 carries the matched
			// authorization on the decision so the adapter reads its caps from
			// the object the decision was made against, and a redirect target may
			// be allowed by a different authorization than the first hop was.
			const { authorization } = validated
			onAuthorization(authorization)
			if (requestBytes > authorization.maxRequestBytes) {
				throw capped(
					`the request passed maxRequestBytes (${authorization.maxRequestBytes})`,
				)
			}
			const hop = await mechanism({
				address: validated.address,
				port: current.port,
				path,
				method: parsed.method,
				host: current.host,
				headers: rendered.headers,
				body: rendered.body,
				maxResponseBytes: authorization.maxResponseBytes,
				signal,
			})
			if (hop.truncated) {
				throw capped(
					`the response passed maxResponseBytes (${authorization.maxResponseBytes})`,
				)
			}
			const location = hop.headers.location
			const isRedirect =
				typeof hop.status === 'number' &&
				hop.status >= 300 &&
				hop.status < 400 &&
				typeof location === 'string'
			if (!isRedirect) {
				return {
					probeId: parsed.probeId,
					interfaceId: parsed.interfaceId,
					operationId: parsed.operationId,
					kind: 'api',
					status: hop.status,
					headers: flattenHeaders(hop.headers),
					body: observedBody(hop),
				}
			}
			redirects++
			if (redirects > authorization.maxRedirects) {
				throw capped(
					`the chain passed maxRedirects (${authorization.maxRedirects})`,
				)
			}
			// A relative `Location` is legal per RFC 9110 and `new URL` throws on
			// one without a base, which `runPortMethod` would report as a
			// transport failure rather than following and revalidating the hop.
			const next = new URL(
				String(location),
				`${current.scheme}://${current.host}:${current.port}`,
			)
			current = {
				scheme: next.protocol.replace(':', ''),
				host: next.hostname,
				// `URL.port` is empty for a default-port URL, and `Number('')` is 0,
				// which would revalidate every such redirect as port 0.
				port: Number(next.port || (next.protocol === 'https:' ? 443 : 80)),
			}
			path = `${next.pathname}${next.search}`
			validated = validate(parsed, current)
		}
	}

	return {
		probe: (request, signal) =>
			runPortMethod({
				request,
				requestParser: probeParsers.request,
				responseParser: probeParsers.response,
				requestPath: 'ProbeRequest',
				responsePath: 'ProbeObservation',
				signal,
				mechanism: async (parsed, innerSignal) => {
					// This adapter speaks HTTP. AD-2 ships no network adapter at
					// all in the package, and this one exists under `tests/` to be
					// the conformance suite's own subject; a command request is a
					// different mechanism entirely and is declined rather than
					// half-served.
					if (parsed.kind !== 'api') {
						throw forbidden(
							'this adapter speaks HTTP; a command request names a mechanism it does not implement',
						)
					}
					// The cap gets its own controller so firing it destroys the
					// in-flight socket. A leaked handle makes vitest hang, which is
					// the worst failure mode here.
					const controller = new AbortController()
					const forward = () => controller.abort(innerSignal.reason)
					innerSignal.addEventListener('abort', forward, { once: true })
					let timer: ReturnType<typeof setTimeout> | undefined
					// The elapsed cap is armed by the authorization that actually
					// allowed the first hop, handed back through this callback.
					// Looking it up by interface id would take the first
					// authorization naming that interface, which under two
					// authorizations for one interface is not the one that allowed,
					// so the cap would come off an entry that refused the target.
					let armCap: (authorization: ProbeTargetAuthorization) => void =
						() => {}
					const elapsed = new Promise<never>((_resolve, reject) => {
						let armed = false
						armCap = (authorization) => {
							if (armed) return
							armed = true
							timer = setTimeout(() => {
								reject(
									capped(
										`the target did not answer within maxElapsedMs (${authorization.maxElapsedMs})`,
									),
								)
							}, authorization.maxElapsedMs)
						}
					})
					try {
						const work = runProbe(parsed, controller.signal, (authorization) =>
							armCap(authorization),
						)
						return await Promise.race([work, elapsed])
					} finally {
						if (timer !== undefined) clearTimeout(timer)
						innerSignal.removeEventListener('abort', forward)
						controller.abort()
					}
				},
				assemble: (raw) => raw,
			}),
	}
}

/**
 * The fixture server AD-30's carve-out permits. It binds `127.0.0.1:0` and
 * reads the port back; a fixed port collides under parallel vitest workers and
 * the flake looks like a policy failure.
 */
export function startFixtureServer(): Promise<{
	readonly port: number
	readonly address: string
	readonly close: () => Promise<void>
	/** Settles when the socket `/switch-protocols` last answered on closes. Node hands an upgraded socket to the client and stops tracking it, so this side is the only place the client's cleanup shows. */
	readonly upgradedSocketClose: () => Promise<void>
}> {
	return new Promise((resolveServer) => {
		const sockets = new Set<Socket>()
		let upgradedSocketClose: Promise<void> | undefined
		const server = createServer((incoming, response) => {
			const path = (incoming.url ?? '/').split('?')[0] ?? '/'
			const port = (server.address() as { port: number }).port
			const base = `http://localhost:${port}`
			if (path === '/ok') {
				response.writeHead(200, { 'content-type': 'application/json' })
				response.end(JSON.stringify({ ok: true }))
				return
			}
			if (path === '/fault') {
				response.writeHead(500, { 'content-type': 'application/json' })
				response.end(JSON.stringify({ ok: false }))
				return
			}
			if (path === '/redirect') {
				// A host the authorization does not name, so revalidation refuses
				// it and the second hop never happens.
				response.writeHead(302, {
					location: `http://denied-redirect.test:${port}/ok`,
				})
				response.end()
				return
			}
			if (path === '/redirect-relative') {
				// A relative Location, which RFC 9110 permits and `new URL` refuses
				// without a base.
				response.writeHead(302, { location: '/ok' })
				response.end()
				return
			}
			if (path === '/echo') {
				response.writeHead(200, { 'content-type': 'application/json' })
				let received = ''
				incoming.on('data', (chunk: Buffer) => {
					received += chunk.toString('utf8')
				})
				incoming.on('end', () => {
					response.end(
						JSON.stringify({
							url: incoming.url,
							declared: incoming.headers['x-declared'] ?? null,
							host: incoming.headers.host,
							body: received.length > 0 ? received : null,
						}),
					)
				})
				return
			}
			if (path === '/redirect-twice') {
				response.writeHead(302, { location: `${base}/redirect-twice-2` })
				response.end()
				return
			}
			if (path === '/redirect-twice-2') {
				response.writeHead(302, { location: `${base}/ok` })
				response.end()
				return
			}
			if (path === '/oversize') {
				response.writeHead(200, { 'content-type': 'application/json' })
				response.end(JSON.stringify({ filler: 'x'.repeat(OVERSIZE_BYTES) }))
				return
			}
			if (path === '/oversize-utf8') {
				// Under `MAX_RESPONSE_BYTES` counted as UTF-16 code units and over
				// it counted as bytes, which is the only way to tell the two apart.
				response.writeHead(200, { 'content-type': 'application/json' })
				response.end(JSON.stringify({ filler: '\u00e9'.repeat(UTF8_FILLER) }))
				return
			}
			if (path === '/slow') {
				setTimeout(() => {
					// The elapsed cap fires first by construction and destroys the
					// client socket, so by now this response is usually dead.
					if (response.destroyed) return
					response.writeHead(200, { 'content-type': 'application/json' })
					response.end(JSON.stringify({ ok: true }))
				}, SLOW_ANSWER_MS)
				return
			}
			if (path === '/premature-close') {
				// Declares more body than it sends and then half-closes, so the
				// client's parser never completes the message. A FIN once the
				// bytes are out, since a `destroy()` can reach a Linux client as
				// an RST and that is a different failure with the same
				// `ECONNRESET` code. Fixture 97 drives it.
				response.writeHead(200, {
					'content-type': 'application/json',
					'content-length': String(PREMATURE_CLOSE_DECLARED_BYTES),
				})
				response.write('{"partial":', () => response.socket?.end())
				return
			}
			if (path === '/switch-protocols') {
				// A 101 the request never asked for, written to the socket
				// because a `writeHead(101)` is accepted and then never reaches
				// the client. Fixture 98 drives it, and reads the promise below
				// to see the client destroy this socket.
				const upgraded = response.socket
				upgradedSocketClose = new Promise((resolveClosed) => {
					upgraded?.once('close', () => resolveClosed())
				})
				upgraded?.write(
					'HTTP/1.1 101 Switching Protocols\r\nupgrade: websocket\r\nconnection: upgrade\r\n\r\n',
				)
				return
			}
			if (path === '/hang') return // never answers
			response.writeHead(404, { 'content-type': 'application/json' })
			response.end(JSON.stringify({ ok: false }))
		})
		server.on('connection', (socket) => {
			sockets.add(socket)
			socket.on('close', () => sockets.delete(socket))
		})
		server.listen(0, '127.0.0.1', () => {
			const port = (server.address() as { port: number }).port
			resolveServer({
				port,
				address: '127.0.0.1',
				close: () =>
					new Promise<void>((resolveClose) => {
						// `/hang` leaves a socket open by construction, so these are
						// destroyed here, with nothing waiting on a response.
						for (const socket of sockets) socket.destroy()
						server.close(() => resolveClose())
					}),
				upgradedSocketClose: () =>
					upgradedSocketClose ??
					Promise.reject(
						new Error('/switch-protocols has not answered on this server'),
					),
			})
		})
	})
}

/** Every denied entry names this instead of `127.0.0.1`, which is what fixture 87 pins. */
const UNREACHED_ADDRESS = '198.51.100.10'

function deniedAuthorization(
	interfaceId: string,
	host: string,
	port: number,
): ProbeTargetAuthorization {
	return {
		interfaceId,
		scheme: 'http',
		host,
		port,
		addresses: [UNREACHED_ADDRESS],
		methods: ['GET'],
		safeMethods: ['GET'],
		maxRedirects: MAX_REDIRECTS,
		maxElapsedMs: MAX_ELAPSED_MS,
		maxRequestBytes: MAX_REQUEST_BYTES,
		maxResponseBytes: MAX_RESPONSE_BYTES,
	}
}

/**
 * One reachable authorization plus six that deny on a named field, so steps 2,
 * 3, 6, and 7 each own one assertion. Leave them out and every denial
 * collapses into `interface-not-authorized`.
 */
export function buildSubjectPolicy(port: number): ProbeTargetPolicy {
	return {
		authorizations: [
			{
				interfaceId: 'authorized',
				scheme: 'http',
				host: SUBJECT_HOSTS.authorized,
				port,
				addresses: ['127.0.0.1'],
				methods: ['GET', 'HEAD'],
				safeMethods: ['GET', 'HEAD'],
				maxRedirects: MAX_REDIRECTS,
				maxElapsedMs: MAX_ELAPSED_MS,
				maxRequestBytes: MAX_REQUEST_BYTES,
				maxResponseBytes: MAX_RESPONSE_BYTES,
			},
			deniedAuthorization('denied-loopback', SUBJECT_HOSTS.loopback, port),
			deniedAuthorization('denied-private', SUBJECT_HOSTS.private, port),
			deniedAuthorization('denied-link-local', SUBJECT_HOSTS.linkLocal, port),
			deniedAuthorization('denied-metadata', SUBJECT_HOSTS.metadata, port),
			// `SUBJECT_ADDRESSES['method.test']` is UNREACHED_ADDRESS, which this
			// entry names, so the target clears the address check and the method
			// check is what refuses it.
			deniedAuthorization('denied-method', SUBJECT_HOSTS.method, port),
			// Scheme is checked before the address, so this one never gets that far.
			deniedAuthorization('denied-scheme', SUBJECT_HOSTS.scheme, port),
		],
	}
}

export function buildSubjectTargets(
	port: number,
): Record<string, SubjectTarget> {
	const http = (host: string): SubjectTarget => ({ scheme: 'http', host, port })
	return {
		authorized: http(SUBJECT_HOSTS.authorized),
		unmapped: http(SUBJECT_HOSTS.unmapped),
		'denied-loopback': http(SUBJECT_HOSTS.loopback),
		'denied-private': http(SUBJECT_HOSTS.private),
		'denied-link-local': http(SUBJECT_HOSTS.linkLocal),
		'denied-metadata': http(SUBJECT_HOSTS.metadata),
		'denied-method': http(SUBJECT_HOSTS.method),
		'denied-scheme': { scheme: 'https', host: SUBJECT_HOSTS.scheme, port },
	}
}

function subjectRequest(
	interfaceId: string,
	operationId: string,
	pathTemplate: string,
	method: ApiProbeRequest['method'] = 'GET',
): ApiProbeRequest {
	return {
		probeId: `probe-${operationId}`,
		interfaceId,
		operationId,
		kind: 'api',
		method,
		pathTemplate,
		channels: { path: {}, query: {}, header: {}, body: { kind: 'absent' } },
	}
}

/** A hop shape the observation schema rejects, for the `in-band-error` scenario. */
const IN_BAND_HOP = {
	status: 'not-a-status',
	headers: {},
	body: '',
	truncated: false,
} as unknown as HopResult

/**
 * The AD-37 subject over a live loopback server. Each scenario gets a fresh
 * adapter and a fresh counter, and the counter counts HTTP hops, so the retry
 * assertion counts the thing AD-37 names.
 */
export function createProbeSubject(server: {
	readonly port: number
}): ProbeSubject & {
	readonly oversizeUtf8Request: ApiProbeRequest
	readonly relativeRedirectRequest: ApiProbeRequest
	readonly echoRequest: ApiProbeRequest
} {
	const policy = buildSubjectPolicy(server.port)
	const targets = buildSubjectTargets(server.port)
	const request = (
		operationId: string,
		path: string,
		method: ApiProbeRequest['method'] = 'GET',
	) => subjectRequest('authorized', operationId, path, method)

	const build = async (
		scenario: ScenarioKind,
	): Promise<BuiltSubject<ProbeRequest>> => {
		let hops = 0
		const counted: ProbeMechanism = (hop) => {
			hops++
			if (scenario === 'fails') throw new Error('socket hang up')
			if (scenario === 'in-band-error') return Promise.resolve(IN_BAND_HOP)
			// A real socket to the real server. The abort scenario forces the path
			// to `/hang`, so the abort is exercised over a live connection.
			return nodeHttpMechanism(
				scenario === 'hangs' ? { ...hop, path: '/hang' } : hop,
			)
		}
		const port = createProbeSubjectAdapter({
			policy,
			targets,
			resolveAddress: subjectResolveAddress,
			mechanism: counted,
		})
		return {
			port: (probeRequest, signal) => port.probe(probeRequest, signal),
			underlyingCalls: () => hops,
		}
	}

	return {
		name: 'createProbeSubjectAdapter',
		// Well clear of `MAX_ELAPSED_MS`, so a slow machine cannot turn the abort
		// assertion into a cap assertion.
		abortBudgetMs: 1000,
		sampleRequest: request('sample', '/ok'),
		build,
		policy,
		authorizedRequest: request('authorized', '/ok'),
		unmappedRequest: subjectRequest('unmapped', 'unmapped', '/ok'),
		deniedAddressRequests: {
			loopback: subjectRequest('denied-loopback', 'denied-loopback', '/ok'),
			private: subjectRequest('denied-private', 'denied-private', '/ok'),
			linkLocal: subjectRequest(
				'denied-link-local',
				'denied-link-local',
				'/ok',
			),
			metadata: subjectRequest('denied-metadata', 'denied-metadata', '/ok'),
		},
		unauthorizedMethodRequest: subjectRequest(
			'denied-method',
			'denied-method',
			'/ok',
			'DELETE',
		),
		unauthorizedSchemeRequest: subjectRequest(
			'denied-scheme',
			'denied-scheme',
			'/ok',
		),
		redirectingRequest: request('redirecting', '/redirect'),
		overRedirectRequest: request('over-redirect', '/redirect-twice'),
		oversizeResponseRequest: request('oversize', '/oversize'),
		slowRequest: request('slow', '/slow'),
		oversizeUtf8Request: request('oversize-utf8', '/oversize-utf8'),
		relativeRedirectRequest: request('redirect-relative', '/redirect-relative'),
		echoRequest: {
			...request('echo', '/echo', 'GET'),
			channels: {
				path: {},
				query: { season: 2 },
				header: { 'x-declared': 'yes' },
				body: { kind: 'json', value: { probe: true } },
			},
		},
		faultingRequest: request('faulting', '/fault'),
	}
}
