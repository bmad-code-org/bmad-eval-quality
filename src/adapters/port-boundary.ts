/**
 * The five steps every adapter method runs. Three adapters share four port
 * methods, and four hand-copied bodies would be four chances for one boundary
 * to drift.
 *
 * Step 3 is where these adapters differ from `src/application/invoke-port.ts`.
 * `invokePort` awaits the port and reads `signal.aborted` only in its `catch`,
 * so a port that never settles makes `invokePort` never settle. AD-28 obliges
 * a caller-supplied port to honour the signal itself, so `invokePort` may
 * assume it; an adapter is what that obligation lands on. Fixture 54 asserts
 * the divergence.
 */
import { RuntimeFault } from '../core/schemas/faults.ts'
import type { BoundaryParser } from '../ports/port.ts'

export type PortMethodOptions<Request, Response> = {
	readonly request: unknown
	readonly requestParser: BoundaryParser<Request>
	readonly responseParser: BoundaryParser<Response>
	/** the message schema's own name, matching `invokePort`. */
	readonly requestPath: string
	readonly responsePath: string
	readonly signal: AbortSignal
	/** After the request parses, before the mechanism runs, so a refusal here costs no I/O. Throws its own `RuntimeFault`. */
	readonly precheck?: (request: Request) => void
	readonly mechanism: (
		request: Request,
		signal: AbortSignal,
	) => Promise<unknown>
	/** After the mechanism returns, for a check needing I/O of its own. Throws its own `RuntimeFault`. */
	readonly postcheck?: (request: Request) => Promise<void>
	/** Builds the response shape from the mechanism's `unknown` result. */
	readonly assemble: (raw: unknown, request: Request) => unknown
}

/** Races one mechanism call against the signal. The listener is `{ once: true }` and removed in a `finally`, so nothing leaks. */
async function raceAbort(
	signal: AbortSignal,
	responsePath: string,
	call: Promise<unknown>,
): Promise<unknown> {
	if (signal.aborted) {
		throw new RuntimeFault(
			'aborted',
			responsePath,
			'the signal aborted before the raced work began',
			{ cause: signal.reason },
		)
	}
	let listener: (() => void) | undefined
	try {
		const aborted = new Promise<never>((_resolve, reject) => {
			listener = () => {
				reject(
					new RuntimeFault(
						'aborted',
						responsePath,
						'the signal aborted while the mechanism was in flight',
						{ cause: signal.reason },
					),
				)
			}
			signal.addEventListener('abort', listener, { once: true })
		})
		return await Promise.race([call, aborted])
	} finally {
		if (listener !== undefined) signal.removeEventListener('abort', listener)
	}
}

export async function runPortMethod<Request, Response>(
	options: PortMethodOptions<Request, Response>,
): Promise<Response> {
	const {
		request,
		requestParser,
		responseParser,
		requestPath,
		responsePath,
		signal,
		precheck,
		mechanism,
		postcheck,
		assemble,
	} = options

	// 1. An aborted call does not validate a request nobody will send.
	if (signal.aborted) {
		throw new RuntimeFault(
			'aborted',
			requestPath,
			'signal was already aborted before the port call',
			{ cause: signal.reason },
		)
	}

	// 2.
	const parsedRequest = requestParser.safeParse(request)
	if (!parsedRequest.success) {
		throw new RuntimeFault(
			'schema-parse-failure',
			requestPath,
			'outbound request failed boundary validation',
			{ cause: parsedRequest.error },
		)
	}

	precheck?.(parsedRequest.data)

	// 3. Exactly one mechanism call, raced against the abort.
	let raw: unknown
	try {
		raw = await raceAbort(
			signal,
			responsePath,
			mechanism(parsedRequest.data, signal),
		)
	} catch (error) {
		if (error instanceof RuntimeFault) throw error
		if (signal.aborted) {
			throw new RuntimeFault(
				'aborted',
				responsePath,
				'signal was aborted before the mechanism settled',
				{ cause: error },
			)
		}
		throw new RuntimeFault(
			'port-failure',
			responsePath,
			'the underlying mechanism threw or rejected',
			{ cause: error },
		)
	}

	// Raced too: `postcheck` does its own I/O (a `realpath` pair, for the corpus
	// adapter), and an abort during that work has to reject rather than wait.
	if (postcheck !== undefined) {
		try {
			await raceAbort(signal, responsePath, postcheck(parsedRequest.data))
		} catch (error) {
			if (error instanceof RuntimeFault) throw error
			throw new RuntimeFault(
				'port-failure',
				responsePath,
				'a post-call check threw or rejected',
				{ cause: error },
			)
		}
	}

	// 4. A partial result or an in-band error object fails here like any other
	// schema mismatch. That is why every mechanism returns `unknown`: give it a
	// precise type and the adapter assembles the response from a value it
	// already holds, so this parse could never reject.
	const parsedResponse = responseParser.safeParse(
		assemble(raw, parsedRequest.data),
	)
	if (!parsedResponse.success) {
		throw new RuntimeFault(
			'port-contract-violation',
			responsePath,
			'the mechanism result failed boundary validation',
			{ cause: parsedResponse.error },
		)
	}
	// 5.
	return parsedResponse.data
}
