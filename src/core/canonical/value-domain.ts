/** same checks for values already in memory */
import { RuntimeFault } from '../schemas/faults.ts'

// AD-36: a hashed artifact admits only finite binary64 numbers, integers within
// the safe range, well-formed strings, and plain acyclic JSON structure. Larger
// integers and exact decimals travel as strings with declared formats
// (Stories 1.3-1.4); this layer enforces the numeric domain.

// Structure bound, part of the value domain: nesting deeper than this rejects
// with the typed fault, so pathological input can never escape as a bare
// RangeError from the recursive walkers.
export const MAX_NESTING_DEPTH = 1024

export function assertHashedArtifactValue(
	value: unknown,
	artifactPath: string,
): void {
	visit(value, artifactPath, '$', new Set(), 0)
}

const reject = (artifactPath: string, detail: string): never => {
	throw new RuntimeFault('non-canonicalizable-value', artifactPath, detail)
}

// Scalar checks are exported so the serializer can re-assert them at emit time:
// an accessor or a lying Proxy could hand the second traversal a value the
// first one never saw.
export function assertDomainNumber(
	value: number,
	artifactPath: string,
	location: string,
): void {
	if (!Number.isFinite(value)) {
		reject(artifactPath, `non-finite number at ${location}`)
	}
	if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
		reject(
			artifactPath,
			`integer outside the safe range at ${location}: ${value}`,
		)
	}
}

export function assertDomainString(
	value: string,
	artifactPath: string,
	location: string,
): void {
	if (!value.isWellFormed()) {
		reject(artifactPath, `lone surrogate in string at ${location}`)
	}
}

function visit(
	value: unknown,
	artifactPath: string,
	location: string,
	ancestors: Set<object>,
	depth: number,
): void {
	switch (typeof value) {
		case 'boolean':
			return
		case 'number':
			assertDomainNumber(value, artifactPath, location)
			return
		case 'string':
			assertDomainString(value, artifactPath, location)
			return
		case 'object':
			break
		default:
			// undefined, function, bigint, symbol: unrepresentable, never coerced silently.
			throw new RuntimeFault(
				'non-canonicalizable-value',
				artifactPath,
				`${typeof value} is not a hashed-artifact value at ${location}`,
			)
	}
	if (value === null) return
	if (depth >= MAX_NESTING_DEPTH) {
		reject(
			artifactPath,
			`nesting depth exceeds ${MAX_NESTING_DEPTH} at ${location}`,
		)
	}
	if (ancestors.has(value)) {
		reject(artifactPath, `cyclic reference at ${location}`)
	}
	ancestors.add(value)
	if (Array.isArray(value)) {
		// Arrays get the same plainness discipline as objects: a subclass or a
		// toJSON carrier serializes differently under a stringify-honouring
		// implementation, and non-index properties would be silently dropped.
		if (Object.getPrototypeOf(value) !== Array.prototype) {
			reject(artifactPath, `non-plain array at ${location}`)
		}
		if (typeof (value as { toJSON?: unknown }).toJSON === 'function') {
			reject(artifactPath, `array carrying toJSON at ${location}`)
		}
		assertOwnPropertiesArePlainData(value, artifactPath, location)
		if (Object.keys(value).length !== value.length) {
			reject(
				artifactPath,
				`array with holes or non-index properties at ${location}`,
			)
		}
		for (const [index, element] of value.entries()) {
			visit(
				element,
				artifactPath,
				`${location}[${index}]`,
				ancestors,
				depth + 1,
			)
		}
	} else {
		const prototype = Object.getPrototypeOf(value)
		if (prototype !== Object.prototype && prototype !== null) {
			reject(artifactPath, `non-plain object at ${location}`)
		}
		if (typeof (value as { toJSON?: unknown }).toJSON === 'function') {
			reject(artifactPath, `object carrying toJSON at ${location}`)
		}
		assertOwnPropertiesArePlainData(value, artifactPath, location)
		for (const [key, entry] of Object.entries(value)) {
			if (!key.isWellFormed()) {
				reject(artifactPath, `lone surrogate in object key at ${location}`)
			}
			visit(entry, artifactPath, `${location}.${key}`, ancestors, depth + 1)
		}
	}
	ancestors.delete(value)
}

// Serialization reads plain data properties only. Accessors can return a
// different value on the serializer's second read (TOCTOU), and non-enumerable
// or symbol-keyed properties would be silently omitted — both are the silent
// two-implementations-disagree class, so all of them reject.
function assertOwnPropertiesArePlainData(
	value: object,
	artifactPath: string,
	location: string,
): void {
	if (Object.getOwnPropertySymbols(value).length > 0) {
		reject(artifactPath, `symbol-keyed property at ${location}`)
	}
	for (const key of Object.getOwnPropertyNames(value)) {
		if (key === 'length' && Array.isArray(value)) continue
		const descriptor = Object.getOwnPropertyDescriptor(value, key)
		if (descriptor === undefined) continue
		if (!('value' in descriptor)) {
			reject(
				artifactPath,
				`accessor property ${JSON.stringify(key)} at ${location}`,
			)
		}
		if (!descriptor.enumerable) {
			reject(
				artifactPath,
				`non-enumerable property ${JSON.stringify(key)} at ${location}`,
			)
		}
	}
}
