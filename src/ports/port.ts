/**
 * AD-28's shared port contract shape: the one asynchronous method signature
 * every port implements, plus the smallest structural parser interface
 * `invokePort` needs for two-way boundary validation. No concrete port or
 * adapter lives here: Story 6.1 owns `CorpusPort`, `EnvironmentProbePort`,
 * `ClockPort`, `FileSystemPort`, their adapters, and their conformance suite.
 *
 * Deliberately no Zod import: `BoundaryParser` is structural, so a Zod
 * schema satisfies it without making `ports/` depend on the runtime
 * validation library by name. `ports/` may import `core/schemas` only.
 */

export type BoundaryParseResult<Value> =
	| { readonly success: true; readonly data: Value }
	| { readonly success: false; readonly error: unknown }

export type BoundaryParser<Value> = {
	readonly safeParse: (input: unknown) => BoundaryParseResult<Value>
}

export type PortMethod<Request, Response> = (
	request: Request,
	signal: AbortSignal,
) => Promise<Response>

export type InvokePortOptions<Request, Response> = {
	readonly request: unknown
	readonly requestParser: BoundaryParser<Request>
	readonly responseParser: BoundaryParser<Response>
	readonly port: PortMethod<Request, unknown>
	readonly signal: AbortSignal
	readonly requestPath: string
	readonly responsePath: string
}
