import { describe, expect, it, vi } from 'vitest'
import { invokePort } from '../../src/application/invoke-port.ts'
import { RuntimeFault } from '../../src/core/schemas/faults.ts'
import type {
	BoundaryParseResult,
	BoundaryParser,
	InvokePortOptions,
	PortMethod,
} from '../../src/ports/port.ts'

// Minimal fakes only (AD-30): no network, no clock, no real adapter.
function acceptingParser<T>(): BoundaryParser<T> {
	return {
		safeParse: (input: unknown): BoundaryParseResult<T> => ({
			success: true,
			data: input as T,
		}),
	}
}

function rejectingParser<T>(marker: string): BoundaryParser<T> {
	return {
		safeParse: (): BoundaryParseResult<T> => ({
			success: false,
			error: { marker },
		}),
	}
}

function baseOptions<Request, Response>(
	overrides: Partial<InvokePortOptions<Request, Response>> &
		Pick<InvokePortOptions<Request, Response>, 'port'>,
): InvokePortOptions<Request, Response> {
	return {
		request: { value: 1 },
		requestParser: acceptingParser<Request>(),
		responseParser: acceptingParser<Response>(),
		signal: new AbortController().signal,
		requestPath: 'RequestArtifact',
		responsePath: 'ResponseArtifact',
		...overrides,
	}
}

describe('invokePort: the happy path', () => {
	it('valid request and response: one call, the same signal, the parsed response returned', async () => {
		const controller = new AbortController()
		const port = vi.fn<PortMethod<{ value: number }, { ok: true }>>(
			async (_req, signal) => {
				expect(signal).toBe(controller.signal)
				return { ok: true }
			},
		)
		const result = await invokePort(
			baseOptions({ port, signal: controller.signal }),
		)
		expect(result).toEqual({ ok: true })
		expect(port).toHaveBeenCalledTimes(1)
		expect(port).toHaveBeenCalledWith({ value: 1 }, controller.signal)
	})
})

describe('invokePort: pre-call validation', () => {
	it('invalid outbound request: zero calls, schema-parse-failure carrying the request parser error and requestPath', async () => {
		const port = vi.fn(async () => ({}))
		let thrown: unknown
		try {
			await invokePort(
				baseOptions({
					port,
					requestParser: rejectingParser('bad-request'),
					requestPath: 'RequestArtifact',
				}),
			)
		} catch (error) {
			thrown = error
		}
		expect(port).not.toHaveBeenCalled()
		expect(thrown).toBeInstanceOf(RuntimeFault)
		const fault = thrown as RuntimeFault
		expect(fault.code).toBe('schema-parse-failure')
		expect(fault.artifactPath).toBe('RequestArtifact')
		expect(fault.cause).toEqual({ marker: 'bad-request' })
	})
})

describe('invokePort: post-call response validation', () => {
	it('invalid resolved response: one call, port-contract-violation carrying the response parser error and responsePath', async () => {
		const port = vi.fn(async () => ({ partial: true }))
		let thrown: unknown
		try {
			await invokePort(
				baseOptions({
					port,
					responseParser: rejectingParser('bad-response'),
					responsePath: 'ResponseArtifact',
				}),
			)
		} catch (error) {
			thrown = error
		}
		expect(port).toHaveBeenCalledTimes(1)
		expect(thrown).toBeInstanceOf(RuntimeFault)
		const fault = thrown as RuntimeFault
		expect(fault.code).toBe('port-contract-violation')
		expect(fault.artifactPath).toBe('ResponseArtifact')
		expect(fault.cause).toEqual({ marker: 'bad-response' })
	})

	it('a schema-valid response is data: invokePort never treats a field named "error" as an in-band failure on its own', async () => {
		const port = vi.fn(async () => ({
			error: 'this is just a field the schema accepts',
		}))
		const result = await invokePort(baseOptions({ port }))
		expect(result).toEqual({ error: 'this is just a field the schema accepts' })
	})
})

describe('invokePort: undeclared port failures translate to port-failure', () => {
	it('a plain thrown Error becomes port-failure with the error as cause, responsePath carried', async () => {
		const originalError = new Error('boom')
		const port = vi.fn(async () => {
			throw originalError
		})
		let thrown: unknown
		try {
			await invokePort(baseOptions({ port, responsePath: 'ResponseArtifact' }))
		} catch (error) {
			thrown = error
		}
		expect(thrown).toBeInstanceOf(RuntimeFault)
		const fault = thrown as RuntimeFault
		expect(fault.code).toBe('port-failure')
		expect(fault.artifactPath).toBe('ResponseArtifact')
		expect(fault.cause).toBe(originalError)
	})

	it('a rejected promise becomes port-failure with the rejection reason as cause', async () => {
		const port = vi.fn(() => Promise.reject(new Error('rejected')))
		let thrown: unknown
		try {
			await invokePort(baseOptions({ port }))
		} catch (error) {
			thrown = error
		}
		expect((thrown as RuntimeFault).code).toBe('port-failure')
		expect((thrown as RuntimeFault).cause).toBeInstanceOf(Error)
	})

	it('a non-Error rejection (a plain thrown string) also becomes port-failure, preserving the original value as cause', async () => {
		const port = vi.fn(() => Promise.reject('not an Error instance'))
		let thrown: unknown
		try {
			await invokePort(baseOptions({ port }))
		} catch (error) {
			thrown = error
		}
		expect((thrown as RuntimeFault).code).toBe('port-failure')
		expect((thrown as RuntimeFault).cause).toBe('not an Error instance')
	})
})

describe('invokePort: a declared RuntimeFault is preserved, never wrapped', () => {
	it('the exact same thrown RuntimeFault instance is returned to the caller: same code, artifactPath, message, cause, and identity', async () => {
		const declared = new RuntimeFault(
			'budget-exhausted',
			'SomeArtifact',
			'over budget',
			{
				cause: 'original cause',
			},
		)
		const port = vi.fn(async () => {
			throw declared
		})
		let thrown: unknown
		try {
			await invokePort(baseOptions({ port }))
		} catch (error) {
			thrown = error
		}
		expect(thrown).toBe(declared)
		expect((thrown as RuntimeFault).code).toBe('budget-exhausted')
		expect((thrown as RuntimeFault).artifactPath).toBe('SomeArtifact')
		expect((thrown as RuntimeFault).cause).toBe('original cause')
	})

	it('a declared RuntimeFault rejection (not thrown synchronously) is likewise preserved', async () => {
		const declared = new RuntimeFault(
			'digest-mismatch',
			'SomeArtifact',
			'mismatch',
		)
		const port = vi.fn(() => Promise.reject(declared))
		let thrown: unknown
		try {
			await invokePort(baseOptions({ port }))
		} catch (error) {
			thrown = error
		}
		expect(thrown).toBe(declared)
	})
})

describe('invokePort: abort signal handling', () => {
	it('a pre-aborted signal gives aborted with zero calls, requestPath carried', async () => {
		const controller = new AbortController()
		controller.abort()
		const port = vi.fn(async () => ({}))
		let thrown: unknown
		try {
			await invokePort(
				baseOptions({
					port,
					signal: controller.signal,
					requestPath: 'RequestArtifact',
				}),
			)
		} catch (error) {
			thrown = error
		}
		expect(port).not.toHaveBeenCalled()
		expect(thrown).toBeInstanceOf(RuntimeFault)
		expect((thrown as RuntimeFault).code).toBe('aborted')
		expect((thrown as RuntimeFault).artifactPath).toBe('RequestArtifact')
	})

	it('a pre-aborted signal wins over an invalid request: aborted is reported, not schema-parse-failure', async () => {
		const controller = new AbortController()
		controller.abort()
		const port = vi.fn(async () => ({}))
		let thrown: unknown
		try {
			await invokePort(
				baseOptions({
					port,
					signal: controller.signal,
					requestParser: rejectingParser('would-have-failed'),
				}),
			)
		} catch (error) {
			thrown = error
		}
		expect(port).not.toHaveBeenCalled()
		expect((thrown as RuntimeFault).code).toBe('aborted')
	})

	it('abortion observed before an undeclared rejection gives aborted rather than port-failure, responsePath carried', async () => {
		const controller = new AbortController()
		const port = vi.fn(async () => {
			controller.abort()
			throw new Error('undeclared, but the signal is already aborted by now')
		})
		let thrown: unknown
		try {
			await invokePort(
				baseOptions({
					port,
					signal: controller.signal,
					responsePath: 'ResponseArtifact',
				}),
			)
		} catch (error) {
			thrown = error
		}
		expect(thrown).toBeInstanceOf(RuntimeFault)
		expect((thrown as RuntimeFault).code).toBe('aborted')
		expect((thrown as RuntimeFault).artifactPath).toBe('ResponseArtifact')
	})
})

describe('invokePort: no retry', () => {
	it('an undeclared rejection is never retried: the underlying port is called exactly once even though it fails', async () => {
		const port = vi.fn(async () => {
			throw new Error('fails every time')
		})
		await expect(invokePort(baseOptions({ port }))).rejects.toBeInstanceOf(
			RuntimeFault,
		)
		expect(port).toHaveBeenCalledTimes(1)
	})

	it('an invalid response is never retried with a second underlying call', async () => {
		const port = vi.fn(async () => ({ nope: true }))
		await expect(
			invokePort(baseOptions({ port, responseParser: rejectingParser('bad') })),
		).rejects.toBeInstanceOf(RuntimeFault)
		expect(port).toHaveBeenCalledTimes(1)
	})
})
