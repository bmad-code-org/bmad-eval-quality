/**
 * The toy Notes API the worked contract describes, on loopback, in two builds.
 *
 * The worked example ships an authored run record: five observations a
 * hand-written evaluator claims it saw. Everything downstream of those
 * observations is already a shipped function's return value. The hop upstream
 * of them was never exercised, so this file supplies the missing half: a real
 * server, reached over real HTTP through the port implementation the published
 * conformance suite already certifies.
 *
 * It lives under `tests/`, which `tsconfig-build.json` excludes, so it never
 * reaches `dist/` and AD-2's "v0 ships no network adapter at all" holds
 * literally. It uses AD-30's loopback carve-out on the same terms
 * `probe-subject.ts` does: a fixture server the suite started itself.
 *
 * Three things about the service are fixed by the evidence it has to
 * reproduce, and each is stated where it is implemented: the deterministic
 * `updatedAt` clock, the short collection response, and the silent write.
 */
import {
	createServer,
	type IncomingMessage,
	type ServerResponse,
} from 'node:http'
import type { Socket } from 'node:net'
import type { ProbeTargetPolicy } from '../../src/core/schemas/probe-policy.ts'
import {
	buildSubjectPolicy,
	buildSubjectTargets,
	type SubjectTarget,
} from './probe-subject.ts'

/** The logical identifier the worked contract declares. AD-35 keeps the host and port out of the contract, so they enter through the map below. */
export const NOTES_INTERFACE_ID = 'notes-api'

/**
 * The run's caps, sized to the Notes payloads. `probe-subject.ts` caps
 * responses at 256 bytes for its own fixtures, and a note envelope passes that
 * before the collection response is even considered.
 *
 * `NOTES_MAX_REDIRECTS` is 0 because this service issues no redirect: a cap of
 * one would leave the first redirect a live path nothing here exercises.
 * `NOTES_MAX_ELAPSED_MS` is generous against a loaded CI worker, since a cap
 * that fires on scheduling luck turns every assertion below into a flake.
 */
export const NOTES_MAX_REDIRECTS = 0
export const NOTES_MAX_ELAPSED_MS = 5000
export const NOTES_MAX_REQUEST_BYTES = 4096
export const NOTES_MAX_RESPONSE_BYTES = 4096

/** `clean` persists what a `PATCH` reports; `silent-write` is the build carrying D-001. */
export type NotesBuild = 'clean' | 'silent-write'

export type NotesRecord = {
	id: string
	title: string
	body: string
	tags: unknown
	updatedAt: string
	[key: string]: unknown
}

export type NotesService = {
	readonly port: number
	readonly close: () => Promise<void>
}

/**
 * The seed the contract's `testData.setup` declares. `n-1` and `n-2` carry
 * different titles so the `get-note` sensitivity relation resolves on observed
 * bytes: two reads of one note would come back byte-identical and the relation
 * would report the operation insensitive to its own path parameter.
 */
const SEED: readonly NotesRecord[] = [
	{
		id: 'n-1',
		title: 'Original',
		body: 'b',
		tags: ['t'],
		updatedAt: '2026-07-29T10:00:00Z',
	},
	{
		id: 'n-2',
		title: 'Second',
		body: 'b2',
		tags: [],
		updatedAt: '2026-07-29T10:01:00Z',
	},
	{
		id: 'n-3',
		title: 'Third',
		body: 'b3',
		tags: [],
		updatedAt: '2026-07-29T10:02:00Z',
	},
]

/**
 * `updatedAt` is the only field this service mints, and a `Date.now()` here
 * would make the run record a different value on every run. A write counter
 * gives it the two stamps the authored record's two writes carry: the first
 * write is 10:05 and the second is 10:06. Both are pinned by assertion, since
 * neither AD-30 determinism family would catch a clock here: both re-score one
 * already-captured record and neither re-runs the HTTP.
 */
const WRITE_CLOCK_BASE_MINUTES = 5
const stampFor = (writeCount: number): string => {
	const minutes = WRITE_CLOCK_BASE_MINUTES + writeCount
	return `2026-07-29T10:${String(minutes).padStart(2, '0')}:00Z`
}

const json = (
	response: ServerResponse,
	status: number,
	payload: unknown,
): void => {
	// No `Date` header. Node stamps one from the system clock on every response,
	// and it would land in the observation's `responseHeaders` and make the
	// record a different value on every run. The flag lives on the response
	// rather than on the server, so it is set per answer.
	response.sendDate = false
	response.writeHead(status, { 'content-type': 'application/json' })
	response.end(JSON.stringify(payload))
}

const readBody = (incoming: IncomingMessage): Promise<string> =>
	new Promise((resolve, reject) => {
		let received = ''
		incoming.on('data', (chunk: Buffer) => {
			received += chunk.toString('utf8')
		})
		incoming.on('end', () => resolve(received))
		incoming.on('error', reject)
	})

/**
 * The one shape `PATCH` refuses. The contract types `tags` as an array, and the
 * behaviour under B-004 is that a body violating a declared type comes back 400
 * with `ok` false. No leg of the authored record sends such a body, which is
 * why the contract's `malformed-write` step matches zero observations and its
 * oracle scores `unreached`; the run exercises this branch in its own
 * assertion, outside the five legs the record carries.
 *
 * An unknown key is a separate case and is accepted: the authored record files
 * an uncited observation about exactly that, so refusing it here would delete
 * the evidence that finding rests on.
 */
const tagsViolateType = (patch: Record<string, unknown>): boolean =>
	'tags' in patch && !Array.isArray(patch.tags)

export function startNotesService(build: NotesBuild): Promise<NotesService> {
	return new Promise((resolveService, rejectService) => {
		const notes = new Map<string, NotesRecord>(
			SEED.map((seed) => [seed.id, { ...seed }]),
		)
		let writes = 0
		const sockets = new Set<Socket>()

		const server = createServer((incoming, response) => {
			void handle(incoming, response)
		})

		async function handle(
			incoming: IncomingMessage,
			response: ServerResponse,
		): Promise<void> {
			const path = (incoming.url ?? '/').split('?')[0] ?? '/'
			const method = incoming.method ?? 'GET'

			if (method === 'GET' && path === '/notes') {
				// Short by construction, and the one fault this build shares with the
				// clean one. The authored record's collection observation comes back
				// empty while the contract seeds three notes; that is what makes AD-4
				// resolve the per-record quantifier `insufficient-evidence` under
				// `empty-collection` instead of certifying completeness over zero
				// records. Returning the seeded three here would move the verdict and
				// the chain would stop being the control this run is measured against.
				//
				// This is the one route where the fixture and the toy system's own
				// spec disagree: `system-under-test.md` says `GET /notes` returns all
				// notes. The committed evidence is what the fixture follows, and the
				// worked example's `README.md` records why that evidence is deliberate.
				json(response, 200, { ok: true, notes: [] })
				return
			}

			const noteId = path.startsWith('/notes/')
				? path.slice('/notes/'.length)
				: null
			if (noteId === null || noteId.length === 0) {
				json(response, 404, { ok: false, error: 'not-found' })
				return
			}
			const stored = notes.get(decodeURIComponent(noteId))
			if (stored === undefined) {
				json(response, 404, { ok: false, error: 'not-found' })
				return
			}

			if (method === 'GET') {
				json(response, 200, { ok: true, note: { ...stored } })
				return
			}

			// A guard rather than reproduced evidence: the run's authorization names
			// `GET` and `PATCH`, so the policy refuses every other method before a
			// socket opens and nothing here can reach this branch.
			if (method !== 'PATCH') {
				json(response, 405, { ok: false, error: 'method-not-allowed' })
				return
			}

			const raw = await readBody(incoming)
			let parsed: unknown
			try {
				parsed = raw.length === 0 ? {} : JSON.parse(raw)
			} catch {
				// The port serialises the body channel, so bytes arriving here are
				// always valid JSON and this branch is a guard. Kept because a
				// handler whose only answer to a bad body is a thrown promise leaves
				// the request hanging until a cap fires.
				json(response, 400, { ok: false, error: 'malformed-body' })
				return
			}
			// Valid JSON is not necessarily an object: the body channel carries any
			// JSON value, so `null`, a scalar and an array all reach here. Refused
			// before `tagsViolateType`, whose `in` test throws a TypeError on the
			// first two, which inside this handler is a rejected promise nothing
			// awaits and a request that never gets an answer.
			if (
				typeof parsed !== 'object' ||
				parsed === null ||
				Array.isArray(parsed)
			) {
				json(response, 400, { ok: false, error: 'malformed-body' })
				return
			}
			const patch = parsed as Record<string, unknown>
			if (tagsViolateType(patch)) {
				json(response, 400, { ok: false, error: 'invalid-tags' })
				return
			}

			const updated: NotesRecord = {
				...stored,
				...patch,
				id: stored.id,
				updatedAt: stampFor(writes),
			}
			writes++
			// D-001. The response is generated from the object the handler declined
			// to persist, so it is indistinguishable from a correct one and only an
			// independent read reveals the old value. The clean build stores it.
			if (build === 'clean') notes.set(stored.id, updated)
			json(response, 200, { ok: true, note: updated })
		}

		// Without this a `listen` failure emits an unhandled error event and the
		// promise never settles, so the caller waits out its own timeout with no
		// cause to report. Removed once the socket is bound: a reject on a settled
		// promise is a no-op, so leaving it attached would swallow a mid-run
		// server error and let the failure surface as whatever assertion happened
		// to notice, with the cause gone. Unlistened, that error stays loud.
		server.once('error', rejectService)
		server.on('connection', (socket) => {
			sockets.add(socket)
			socket.on('close', () => sockets.delete(socket))
		})
		server.listen(0, '127.0.0.1', () => {
			server.removeListener('error', rejectService)
			const port = (server.address() as { port: number }).port
			// A listening server holds the event loop open. Unreferenced, a server
			// a failing test never closed cannot outlive the run that started it.
			server.unref()
			resolveService({
				port,
				close: () =>
					new Promise<void>((resolveClose) => {
						for (const socket of sockets) socket.destroy()
						server.close(() => resolveClose())
					}),
			})
		})
	})
}

/**
 * One authorization naming the fixture exactly: scheme, host, the port the
 * socket reported, one address, and the two methods the contract's operations
 * use. AD-35 denies a loopback address "unless the mapping explicitly
 * authorizes that exact target", and this is that branch. The port is minted
 * per run from a socket this process owns, so the entry cannot name a port
 * another process holds.
 *
 * The six denial entries the conformance subject carries stay in the same
 * object, so the same policy that allows the fixture is the one that refuses
 * everything else.
 */
export function buildNotesPolicy(port: number): ProbeTargetPolicy {
	const [, ...denials] = buildSubjectPolicy(port).authorizations
	return {
		authorizations: [
			{
				interfaceId: NOTES_INTERFACE_ID,
				scheme: 'http',
				host: 'localhost',
				port,
				addresses: ['127.0.0.1'],
				methods: ['GET', 'PATCH'],
				// `PATCH` writes, so it is authorized and not safe. Only `GET` may
				// carry a differential body-sensitivity probe.
				safeMethods: ['GET'],
				maxRedirects: NOTES_MAX_REDIRECTS,
				maxElapsedMs: NOTES_MAX_ELAPSED_MS,
				maxRequestBytes: NOTES_MAX_REQUEST_BYTES,
				maxResponseBytes: NOTES_MAX_RESPONSE_BYTES,
			},
			...denials,
		],
	}
}

/**
 * The interface-to-target map, separate from the policy for the reason
 * `probe-subject.ts` states: an adapter deriving the target from the
 * authorization it validates against can never present a mismatch, so no
 * scheme, host, or port denial would be reachable.
 */
export function buildNotesTargets(port: number): Record<string, SubjectTarget> {
	const { authorized: _authorized, ...denialTargets } =
		buildSubjectTargets(port)
	return {
		[NOTES_INTERFACE_ID]: { scheme: 'http', host: 'localhost', port },
		...denialTargets,
	}
}
