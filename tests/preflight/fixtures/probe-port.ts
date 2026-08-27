/**
 * The hand-written probe-port fake `runPreflight` tests drive. Extracted from
 * `tests/application/preflight.test.ts` in Story 6.4 so the freeze tests reach
 * the same subject.
 */
import { vi } from 'vitest'
import type {
	ProbeObservation,
	ProbeRequest,
} from '../../../src/core/schemas/port-messages.ts'
import type { PortMethod } from '../../../src/ports/port.ts'
import { jsonBody } from './observations.ts'

/** the body each leg id is registered for. */
export const PROBE_BODIES: Readonly<Record<string, ProbeObservation['body']>> =
	{
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
	vi.fn<PortMethod<ProbeRequest, ProbeObservation>>(async (request) => ({
		probeId: request.probeId,
		interfaceId: request.interfaceId,
		operationId: request.operationId,
		status: 200,
		headers: {},
		body:
			PROBE_BODIES[request.probeId] ?? jsonBody({ id: 't-1', value: 'alpha' }),
	}))
