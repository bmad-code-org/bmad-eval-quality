import { RuntimeFault } from '../schemas/faults.ts'
import { assertHashedArtifactValue } from './value-domain.ts'

// RFC 8785 (JCS) canonical serialization, written in-house per AD-27. Numbers
// render per ECMAScript Number::toString (native JSON.stringify on individual
// numbers IS the JCS algorithm — no hand-rolled Ryū), object keys sort by
// UTF-16 code unit, strings use JSON.stringify escaping, arrays keep order,
// no insignificant whitespace. The digest is over these UTF-8 bytes.
export function canonicalize(value: unknown, artifactPath: string): Uint8Array {
	assertHashedArtifactValue(value, artifactPath)
	return new TextEncoder().encode(serialize(value, artifactPath))
}

function serialize(value: unknown, artifactPath: string): string {
	if (value === null) return 'null'
	switch (typeof value) {
		case 'boolean':
			return value ? 'true' : 'false'
		case 'number':
		case 'string':
			// Individual scalars only: whole-value JSON.stringify drops undefined
			// properties, honours toJSON, and does not sort keys.
			return JSON.stringify(value)
		case 'object':
			break
		default:
			// Unreachable after assertHashedArtifactValue; never coerce silently.
			throw new RuntimeFault(
				'non-canonicalizable-value',
				artifactPath,
				`${typeof value} is not canonicalizable`,
			)
	}
	if (Array.isArray(value)) {
		return `[${value.map((element) => serialize(element, artifactPath)).join(',')}]`
	}
	// Plain < on JS strings compares UTF-16 code units, the required order —
	// never localeCompare, never Intl, never .normalize().
	const keys = Object.keys(value).sort()
	const properties = keys.map(
		(key) =>
			`${JSON.stringify(key)}:${serialize((value as Record<string, unknown>)[key], artifactPath)}`,
	)
	return `{${properties.join(',')}}`
}
