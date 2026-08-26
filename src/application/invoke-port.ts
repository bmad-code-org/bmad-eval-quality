/**
 * The sole generic seam that awaits a port (AD-34: `application/` is the
 * only layer that awaits). Validates both sides of a port call, invokes the
 * supplied port method exactly once, preserves any declared `RuntimeFault`
 * unchanged, and translates every other boundary failure into one of AD-28's
 * three port-boundary codes. No retry, back-off, fallback call, logging,
 * caching, mutation, or verdict conversion. Re-execution is a trial/cap
 * decision under AD-6.
 */
import { RuntimeFault } from '../core/schemas/faults.ts'
import type { InvokePortOptions } from '../ports/port.ts'

export async function invokePort<Request, Response>(
	options: InvokePortOptions<Request, Response>,
): Promise<Response> {
	const {
		request,
		requestParser,
		responseParser,
		port,
		signal,
		requestPath,
		responsePath,
	} = options

	// Checked before request validation: an aborted call never spends effort
	// validating a request nobody will send.
	if (signal.aborted) {
		throw new RuntimeFault(
			'aborted',
			requestPath,
			'signal was already aborted before the port call',
			{ cause: signal.reason },
		)
	}

	const parsedRequest = requestParser.safeParse(request)
	if (!parsedRequest.success) {
		throw new RuntimeFault(
			'schema-parse-failure',
			requestPath,
			'outbound request failed boundary validation',
			{ cause: parsedRequest.error },
		)
	}

	let resolved: unknown
	try {
		resolved = await port(parsedRequest.data, signal)
	} catch (error) {
		if (error instanceof RuntimeFault) throw error
		// Undeclared error: if the signal aborted while the call was in
		// flight, that abort is the more meaningful fault; otherwise it is a
		// genuine port failure.
		if (signal.aborted) {
			throw new RuntimeFault(
				'aborted',
				responsePath,
				'signal was aborted before the port settled',
				{ cause: error },
			)
		}
		throw new RuntimeFault(
			'port-failure',
			responsePath,
			'the port implementation threw or rejected',
			{ cause: error },
		)
	}

	// A partial result or an in-band error object fails validation like any
	// other schema mismatch: invokePort never special-cases a shape with an
	// "error" field itself; that is the response schema's job.
	const parsedResponse = responseParser.safeParse(resolved)
	if (!parsedResponse.success) {
		throw new RuntimeFault(
			'port-contract-violation',
			responsePath,
			'the resolved value failed boundary validation',
			{ cause: parsedResponse.error },
		)
	}
	return parsedResponse.data
}
