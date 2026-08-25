/** JSON to bytes */
import { RuntimeFault } from '../schemas/faults.ts'
import {
	assertDomainNumber,
	assertDomainString,
	MAX_NESTING_DEPTH,
} from './value-domain.ts'

// RFC 8785 (JCS) canonical serialization, written in-house per AD-27; native
// JSON.stringify on individual numbers already implements JCS's number
// algorithm, so no hand-rolled Ryū is needed.
//
// Validation is fused into serialization as one traversal over a single
// ownKeys/descriptor snapshot, so exactly what was validated is what gets
// emitted. A second traversal would reopen the TOCTOU channel: an accessor or
// lying Proxy could answer the emit-time read differently than the
// validation read.
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
			// Whole-value JSON.stringify would drop undefined properties, honour
			// toJSON, and skip key sorting, so this runs per scalar instead.
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
