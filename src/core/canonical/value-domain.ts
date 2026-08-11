import { RuntimeFault } from '../schemas/faults.ts'

// AD-36: a hashed artifact admits only finite binary64 numbers, integers within
// the safe range, well-formed strings, and plain acyclic JSON structure. Larger
// integers and exact decimals travel as strings with declared formats
// (Stories 1.3-1.4); this layer enforces the numeric domain.
export function assertHashedArtifactValue(
	value: unknown,
	artifactPath: string,
): void {
	visit(value, artifactPath, '$', new Set())
}

const reject = (artifactPath: string, detail: string): never => {
	throw new RuntimeFault('non-canonicalizable-value', artifactPath, detail)
}

function visit(
	value: unknown,
	artifactPath: string,
	location: string,
	ancestors: Set<object>,
): void {
	switch (typeof value) {
		case 'boolean':
			return
		case 'number':
			if (!Number.isFinite(value)) {
				reject(artifactPath, `non-finite number at ${location}`)
			}
			if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
				reject(
					artifactPath,
					`integer outside the safe range at ${location}: ${value}`,
				)
			}
			return
		case 'string':
			if (!value.isWellFormed()) {
				reject(artifactPath, `lone surrogate in string at ${location}`)
			}
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
	if (ancestors.has(value)) {
		reject(artifactPath, `cyclic reference at ${location}`)
	}
	ancestors.add(value)
	if (Array.isArray(value)) {
		for (const [index, element] of value.entries()) {
			visit(element, artifactPath, `${location}[${index}]`, ancestors)
		}
	} else {
		const prototype = Object.getPrototypeOf(value)
		if (prototype !== Object.prototype && prototype !== null) {
			reject(artifactPath, `non-plain object at ${location}`)
		}
		if (typeof (value as { toJSON?: unknown }).toJSON === 'function') {
			reject(artifactPath, `object carrying toJSON at ${location}`)
		}
		for (const [key, entry] of Object.entries(value)) {
			if (!key.isWellFormed()) {
				reject(artifactPath, `lone surrogate in object key at ${location}`)
			}
			visit(entry, artifactPath, `${location}.${key}`, ancestors)
		}
	}
	ancestors.delete(value)
}
