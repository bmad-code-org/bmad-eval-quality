/**
 * The runtime boundary a target-policy mapping read from disk crosses before a
 * reference adapter receives it. Both adapters that take a mapping,
 * `createCommandLineAdapter` and `createMcpAdapter`, take it typed and never
 * parse it, so this is where an unknown key or a malformed cap is caught.
 */
import { RuntimeFault } from '../core/schemas/faults.ts'
import type { PolicyParseResult } from '../core/schemas/probe-policy.ts'

/** RFC 6901, so a location reads the way a contract addresses evidence. */
function pointerOf(path: readonly PropertyKey[]): string {
	return path
		.map(
			(segment) =>
				`/${String(segment).replaceAll('~', '~0').replaceAll('/', '~1')}`,
		)
		.join('')
}

/**
 * Returns Zod's own deep copy of a valid mapping. A refusal throws
 * `RuntimeFault('schema-parse-failure', artifactPath, ...)` with the `ZodError`
 * as its `cause`, the code, path and cause every other parse boundary in this
 * package throws. The detail is this function's own addition: every issue, as
 * its RFC 6901 pointer and message. Input whose own accessors or proxy traps
 * throw is refused with the same code, carrying the thrown value as its
 * `cause`, and the detail is fixed text, since describing a hostile value can
 * throw again; no other error escapes.
 */
export function parseTargetPolicy<T>(
	artifactPath: string,
	safeParse: (value: unknown) => PolicyParseResult<T>,
	value: unknown,
): T {
	let parsed: PolicyParseResult<T>
	try {
		parsed = safeParse(value)
	} catch (error) {
		throw new RuntimeFault(
			'schema-parse-failure',
			artifactPath,
			'input could not be read: reading one of its properties threw',
			{ cause: error },
		)
	}
	if (parsed.success) return parsed.data
	throw new RuntimeFault(
		'schema-parse-failure',
		artifactPath,
		`input does not conform to the ${artifactPath} schema: ${parsed.error.issues
			.map((issue) => `${pointerOf(issue.path) || '(root)'}: ${issue.message}`)
			.join('; ')}`,
		{ cause: parsed.error },
	)
}
