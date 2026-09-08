/** the two tagged body shapes the probe boundary and AD-10's witnesses share. */
import { z } from 'zod'
import { JsonValue } from './primitives.ts'

// Split out of `port-messages.ts` so `sensitivity-witness.ts` can carry the
// request body without importing that module: `port-messages.ts` reads
// `HttpMethod` from `interface.ts`, and `interface.ts` reads the witness, so
// the direct import closes a cycle that fails at module evaluation. Nothing
// here carries `.meta({ id })`, so both unions still inline at each use site
// and no published byte moves.

/**
 * Both bodies are tagged. An untagged `JsonValue` cannot tell a JSON string
 * response from a `text/html` one, since `JsonValue` accepts a bare string, and
 * `absent` needs its own branch because `null` is a legal JSON body.
 */
export const ProbeRequestBody = z.discriminatedUnion('kind', [
	z.strictObject({ kind: z.literal('json'), value: JsonValue }),
	z.strictObject({ kind: z.literal('absent') }),
])

export const ProbeObservedBody = z.discriminatedUnion('kind', [
	z.strictObject({ kind: z.literal('json'), value: JsonValue }),
	z.strictObject({ kind: z.literal('text'), value: z.string() }),
	z.strictObject({ kind: z.literal('absent') }),
])

/**
 * What one leg writes to a command's standard input. Three arms, like the
 * observed body rather than the request body: standard input is a byte stream,
 * so a command that reads a prompt receives text that was never JSON, and
 * routing it through the `json` arm as a JSON string would make the leg claim
 * a serialisation the command never sees. `absent` is the leg that writes
 * nothing and closes the stream.
 */
export const ProbeRequestStdin = z.discriminatedUnion('kind', [
	z.strictObject({ kind: z.literal('json'), value: JsonValue }),
	z.strictObject({ kind: z.literal('text'), value: z.string() }),
	z.strictObject({ kind: z.literal('absent') }),
])

export type ProbeRequestBody = z.infer<typeof ProbeRequestBody>
export type ProbeObservedBody = z.infer<typeof ProbeObservedBody>
export type ProbeRequestStdin = z.infer<typeof ProbeRequestStdin>
