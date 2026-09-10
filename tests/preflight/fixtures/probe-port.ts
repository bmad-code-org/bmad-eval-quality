/**
 * The hand-written probe-port fake `runPreflight` tests drive. Extracted from
 * `tests/application/preflight.test.ts` in Story 6.4 so the freeze tests reach
 * the same subject.
 */
import { vi } from 'vitest'
import type {
	ApiProbeObservation,
	ProbeObservation,
	ProbeRequest,
} from '../../../src/core/schemas/port-messages.ts'
import type { PortMethod } from '../../../src/ports/port.ts'
import { jsonBody } from './observations.ts'

/** the body each leg id is registered for. */
export const PROBE_BODIES: Readonly<
	Record<string, ApiProbeObservation['body']>
> = {
	'create-a': jsonBody({ id: 'x-1', ok: true, echo: 'alpha' }),
	'create-b': jsonBody({ id: 'x-2', ok: true, echo: 'beta' }),
	'read-a': jsonBody({ id: 't-1', value: 'alpha' }),
	'read-b': jsonBody({ id: 't-2', value: 'beta' }),
	'list-a': jsonBody({ items: [{ id: 'r-1' }] }),
	'list-b': jsonBody({ items: [{ id: 'r-1' }, { id: 'r-2' }] }),
	'fault-leg': jsonBody({ items: [{ id: 'r-1', broken: true }] }),
}

/** echoes the request, with the body the leg id is registered for. */
export const echoPort = () =>
	vi.fn<PortMethod<ProbeRequest, ProbeObservation>>(
		async (request): Promise<ProbeObservation> => ({
			probeId: request.probeId,
			interfaceId: request.interfaceId,
			operationId: request.operationId,
			kind: 'api',
			status: 200,
			headers: {},
			body:
				PROBE_BODIES[request.probeId] ??
				jsonBody({ id: 't-1', value: 'alpha' }),
		}),
	)

/**
 * A structured result derived from the arguments the leg supplied, under the
 * two keys the mcp fixture contract's witness relations address. A constant
 * body would report every tool insensitive to its own arguments, which is what
 * AD-10's input-sensitivity differential measures; the derivation is pure, so
 * two legs that sent the same thing describe the same fixture state, which is
 * what its state-reset differential measures.
 */
const toolResultFor = (request: ProbeRequest) => {
	const supplied = request.kind === 'mcp' ? request.channels.arguments : {}
	const id = `n-${JSON.stringify(supplied)}`
	return {
		ok: true,
		matches: [{ noteId: id }],
		noteId: id,
		totalCount: 1,
		echo: supplied,
	}
}

/**
 * The same echo for a tool call. `echoPort` above keeps answering `api`, so no
 * existing `runPreflight` fixture moves; this one exists for the legs an mcp
 * contract plans. `isError` drives the whole run's error flag, which is what
 * AD-10's clean-control check reads.
 */
export const mcpEchoPort = (isError = false) =>
	vi.fn<PortMethod<ProbeRequest, ProbeObservation>>(
		async (request): Promise<ProbeObservation> => ({
			probeId: request.probeId,
			interfaceId: request.interfaceId,
			operationId: request.operationId,
			kind: 'mcp',
			isError,
			result: jsonBody(toolResultFor(request)),
		}),
	)
