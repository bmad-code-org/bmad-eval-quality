/** JSON to bytes */
import { RuntimeFault } from '../schemas/faults.ts'
import {
	assertDomainNumber,
	assertDomainString,
	MAX_NESTING_DEPTH,
} from './value-domain.ts'

// RFC 8785 (JCS) canonical serialization, written in-house per AD-27. Numbers
// render per ECMAScript Number::toString (native JSON.stringify on individual
// numbers IS the JCS algorithm; no hand-rolled Ryū needed), object keys sort by
// UTF-16 code unit, strings use JSON.stringify escaping, arrays keep order,
// no insignificant whitespace. The digest is over these UTF-8 bytes.
//
// Validation is fused into serialization as ONE traversal: every key, value,
// and structure check runs against a single ownKeys/descriptor snapshot, and
// exactly what was validated is what gets emitted. A second traversal would
// reopen the TOCTOU channel (an accessor or lying Proxy answering the
// emit-time read differently than the validation read), so there is none.
export function canonicalize(value: unknown, artifactPath: string): Uint8Array {
	return new TextEncoder().encode(
		serialize(value, artifactPath, '$', new Set(), 0),
	)
}

const fault = (artifactPath: string, detail: string): never => {
	throw new RuntimeFault('non-canonicalizable-value', artifactPath, detail)
}

function serialize(
	value: unknown,
	artifactPath: string,
	location: string,
	ancestors: Set<object>,
	depth: number,
): string {
	if (value === null) return 'null'
	switch (typeof value) {
		case 'boolean':
			return value ? 'true' : 'false'
		case 'number':
			assertDomainNumber(value, artifactPath, location)
			// Individual scalars only: whole-value JSON.stringify drops undefined
			// properties, honours toJSON, and does not sort keys.
			return JSON.stringify(value)
		case 'string':
			assertDomainString(value, artifactPath, location)
			return JSON.stringify(value)
		case 'object':
			break
		default:
			// undefined, function, bigint, symbol: unrepresentable, never coerced silently.
			fault(
				artifactPath,
				`${typeof value} is not a hashed-artifact value at ${location}`,
			)
	}
	const object = value as object
	if (depth >= MAX_NESTING_DEPTH) {
		fault(
			artifactPath,
			`nesting depth exceeds ${MAX_NESTING_DEPTH} at ${location}`,
		)
	}
	if (ancestors.has(object)) {
		fault(artifactPath, `cyclic reference at ${location}`)
	}
	ancestors.add(object)
	let rendered: string
	if (Array.isArray(object)) {
		if (Object.getPrototypeOf(object) !== Array.prototype) {
			fault(artifactPath, `non-plain array at ${location}`)
		}
		// One property-table read; elements come from descriptor values, never a
		// second [[Get]]. A toJSON carrier surfaces as a non-index key (own);
		// the prototype check rules out an inherited one.
		const descriptors = Object.getOwnPropertyDescriptors(object)
		if (Object.getOwnPropertySymbols(descriptors).length > 0) {
			fault(artifactPath, `symbol-keyed property at ${location}`)
		}
		const elements: unknown[] = []
		for (const [key, descriptor] of Object.entries(descriptors)) {
			if (key === 'length') continue
			if (!('value' in descriptor)) {
				fault(
					artifactPath,
					`accessor property ${JSON.stringify(key)} at ${location}`,
				)
			}
			if (!descriptor.enumerable) {
				fault(
					artifactPath,
					`non-enumerable property ${JSON.stringify(key)} at ${location}`,
				)
			}
			if (key !== String(elements.length)) {
				fault(
					artifactPath,
					`array with holes or non-index properties at ${location}`,
				)
			}
			elements.push(descriptor.value)
		}
		if (elements.length !== object.length) {
			fault(
				artifactPath,
				`array with holes or non-index properties at ${location}`,
			)
		}
		rendered = `[${elements
			.map((element, index) =>
				serialize(
					element,
					artifactPath,
					`${location}[${index}]`,
					ancestors,
					depth + 1,
				),
			)
			.join(',')}]`
	} else {
		const prototype = Object.getPrototypeOf(object)
		if (prototype !== Object.prototype && prototype !== null) {
			fault(artifactPath, `non-plain object at ${location}`)
		}
		const descriptors = Object.getOwnPropertyDescriptors(object)
		if (Object.getOwnPropertySymbols(descriptors).length > 0) {
			fault(artifactPath, `symbol-keyed property at ${location}`)
		}
		const properties: Array<[string, unknown]> = []
		for (const [key, descriptor] of Object.entries(descriptors)) {
			if (!('value' in descriptor)) {
				fault(
					artifactPath,
					`accessor property ${JSON.stringify(key)} at ${location}`,
				)
			}
			if (!descriptor.enumerable) {
				fault(
					artifactPath,
					`non-enumerable property ${JSON.stringify(key)} at ${location}`,
				)
			}
			// Keys are validated on the same snapshot they are emitted from.
			assertDomainString(key, artifactPath, `${location} (object key)`)
			// A callable toJSON is rejected wherever it sits: as an own data
			// property its function value faults in the recursion below.
			properties.push([key, descriptor.value])
		}
		// Plain < on JS strings compares UTF-16 code units, the required order:
		// never localeCompare, never Intl, never .normalize().
		properties.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
		rendered = `{${properties
			.map(
				([key, entry]) =>
					`${JSON.stringify(key)}:${serialize(entry, artifactPath, `${location}.${key}`, ancestors, depth + 1)}`,
			)
			.join(',')}}`
	}
	ancestors.delete(object)
	return rendered
}
