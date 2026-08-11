import { RuntimeFault } from '../schemas/faults.ts'
import {
	assertDomainNumber,
	assertDomainString,
	assertHashedArtifactValue,
	MAX_NESTING_DEPTH,
} from './value-domain.ts'

// RFC 8785 (JCS) canonical serialization, written in-house per AD-27. Numbers
// render per ECMAScript Number::toString (native JSON.stringify on individual
// numbers IS the JCS algorithm — no hand-rolled Ryū), object keys sort by
// UTF-16 code unit, strings use JSON.stringify escaping, arrays keep order,
// no insignificant whitespace. The digest is over these UTF-8 bytes.
export function canonicalize(value: unknown, artifactPath: string): Uint8Array {
	assertHashedArtifactValue(value, artifactPath)
	return new TextEncoder().encode(serialize(value, artifactPath, 0))
}

function serialize(
	value: unknown,
	artifactPath: string,
	depth: number,
): string {
	if (value === null) return 'null'
	switch (typeof value) {
		case 'boolean':
			return value ? 'true' : 'false'
		case 'number':
			// Re-asserted at emit time: validation traversed the value already, but
			// an accessor or lying Proxy could hand this pass a different value, and
			// JSON.stringify(NaN) would silently emit the literal null.
			assertDomainNumber(value, artifactPath, 'serialization')
			// Individual scalars only: whole-value JSON.stringify drops undefined
			// properties, honours toJSON, and does not sort keys.
			return JSON.stringify(value)
		case 'string':
			assertDomainString(value, artifactPath, 'serialization')
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
	if (depth >= MAX_NESTING_DEPTH) {
		throw new RuntimeFault(
			'non-canonicalizable-value',
			artifactPath,
			`nesting depth exceeds ${MAX_NESTING_DEPTH} during serialization`,
		)
	}
	if (Array.isArray(value)) {
		return `[${value.map((element) => serialize(element, artifactPath, depth + 1)).join(',')}]`
	}
	// Plain < on JS strings compares UTF-16 code units, the required order —
	// never localeCompare, never Intl, never .normalize().
	const keys = Object.keys(value).sort()
	const properties = keys.map(
		(key) =>
			`${JSON.stringify(key)}:${serialize((value as Record<string, unknown>)[key], artifactPath, depth + 1)}`,
	)
	return `{${properties.join(',')}}`
}
