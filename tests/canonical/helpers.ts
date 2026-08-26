import { RuntimeFault } from '../../src/core/schemas/faults.ts'

// Shared across the canonical suites so assertion behavior cannot drift
// between copies.
export const faultOf = (fn: () => unknown): RuntimeFault => {
	try {
		fn()
	} catch (error) {
		if (error instanceof RuntimeFault) return error
		throw error
	}
	throw new Error('expected a RuntimeFault to be thrown')
}

// Fixture hex is a frozen contract: reject anything malformed rather than
// coerce it.
export const hexToBytes = (hex: string): Uint8Array => {
	if (!/^(?:[0-9a-f]{2})*$/.test(hex)) {
		throw new Error(
			`invalid lowercase-hex fixture input: ${JSON.stringify(hex)}`,
		)
	}
	return Uint8Array.from(hex.match(/../g) ?? [], (pair) =>
		Number.parseInt(pair, 16),
	)
}

export const bytesToHex = (bytes: Uint8Array): string =>
	Buffer.from(bytes).toString('hex')
