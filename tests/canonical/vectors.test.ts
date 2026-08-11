import { describe, expect, it } from 'vitest'
import { canonicalize } from '../../src/core/canonical/canonicalize.ts'
import {
	COMPOSITE_PROTOCOL_TAG,
	DIRECTORY_PROTOCOL_TAG,
	digestArtifact,
	digestBytes,
	digestComposite,
	digestDirectory,
} from '../../src/core/canonical/digest.ts'
import { scanJson } from '../../src/core/canonical/scan-json.ts'
import { RuntimeFault } from '../../src/core/schemas/faults.ts'
import byteVectorsJson from '../fixtures/byte-vectors.json'
import compositeVectorsJson from '../fixtures/composite-vectors.json'
import negativeVectorsJson from '../fixtures/negative-vectors.json'
import positiveVectorsJson from '../fixtures/positive-vectors.json'

interface PositiveVector {
	name: string
	rawText: string
	rawTextPermutations: string[]
	expectedCanonicalText: string
	expectedCanonicalHex: string
	expectedDigest: string
}

interface NegativeVector {
	name: string
	rawText: string
	expectedFault: string
}

interface ByteRejectVector {
	name: string
	inputHex: string
	expectedFault: string
}

interface ByteDigestVector {
	name: string
	inputHex: string
	expectedDigest: string
}

interface CompositeVector {
	name: string
	fields: Record<string, unknown>
	expectedCanonicalText: string
	expectedCanonicalHex: string
	expectedDigest: string
}

interface DirectoryVector {
	name: string
	members: Record<string, string>
	expectedCanonicalText: string
	expectedCanonicalHex: string
	expectedDigest: string
}

const positiveVectors = positiveVectorsJson as PositiveVector[]
const negativeVectors = negativeVectorsJson as NegativeVector[]
const byteVectors = byteVectorsJson as {
	reject: ByteRejectVector[]
	digest: ByteDigestVector[]
}
const compositeVectors = compositeVectorsJson as unknown as {
	composite: CompositeVector[]
	directory: DirectoryVector[]
}

const hexToBytes = (hex: string): Uint8Array =>
	Uint8Array.from(hex.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16))

const bytesToHex = (bytes: Uint8Array): string =>
	Buffer.from(bytes).toString('hex')

const faultOf = (fn: () => unknown): RuntimeFault => {
	try {
		fn()
	} catch (error) {
		if (error instanceof RuntimeFault) return error
		throw error
	}
	throw new Error('expected a RuntimeFault to be thrown')
}

describe('fixture presence', () => {
	// An empty fixture array would pass every loop silently — the same
	// fail-open shape as an unwired gate.
	it('loads non-empty vector sets', () => {
		expect(positiveVectors.length).toBeGreaterThan(0)
		expect(negativeVectors.length).toBeGreaterThan(0)
		expect(byteVectors.reject.length).toBeGreaterThan(0)
		expect(byteVectors.digest.length).toBeGreaterThan(0)
		expect(compositeVectors.composite.length).toBeGreaterThan(0)
		expect(compositeVectors.directory.length).toBeGreaterThan(0)
	})
})

describe('positive canonicalization vectors', () => {
	for (const vector of positiveVectors) {
		it(vector.name, () => {
			const value = scanJson(vector.rawText, vector.name)
			const bytes = canonicalize(value, vector.name)
			// Byte-level comparison: comparing JS strings happens before UTF-8
			// encoding and would hide encoding bugs.
			expect(bytesToHex(bytes)).toBe(vector.expectedCanonicalHex)
			expect(new TextDecoder().decode(bytes)).toBe(vector.expectedCanonicalText)
			expect(digestArtifact(value, vector.name)).toBe(vector.expectedDigest)
			for (const permutation of vector.rawTextPermutations) {
				const permuted = scanJson(permutation, vector.name)
				expect(bytesToHex(canonicalize(permuted, vector.name))).toBe(
					vector.expectedCanonicalHex,
				)
				expect(digestArtifact(permuted, vector.name)).toBe(
					vector.expectedDigest,
				)
			}
		})
	}
})

describe('negative canonicalization vectors', () => {
	for (const vector of negativeVectors) {
		it(vector.name, () => {
			const fault = faultOf(() => scanJson(vector.rawText, vector.name))
			expect(fault.code).toBe(vector.expectedFault)
			expect(fault.artifactPath).toBe(vector.name)
		})
	}
})

describe('byte-level vectors', () => {
	for (const vector of byteVectors.reject) {
		it(vector.name, () => {
			const fault = faultOf(() =>
				scanJson(hexToBytes(vector.inputHex), vector.name),
			)
			expect(fault.code).toBe(vector.expectedFault)
			expect(fault.artifactPath).toBe(vector.name)
		})
	}
	for (const vector of byteVectors.digest) {
		it(vector.name, () => {
			expect(digestBytes(hexToBytes(vector.inputHex))).toBe(
				vector.expectedDigest,
			)
		})
	}
})

describe('composite-digest vectors', () => {
	for (const vector of compositeVectors.composite) {
		it(vector.name, () => {
			const tagged = { protocol: COMPOSITE_PROTOCOL_TAG, ...vector.fields }
			const bytes = canonicalize(tagged, vector.name)
			expect(bytesToHex(bytes)).toBe(vector.expectedCanonicalHex)
			expect(new TextDecoder().decode(bytes)).toBe(vector.expectedCanonicalText)
			expect(digestComposite(vector.fields, vector.name)).toBe(
				vector.expectedDigest,
			)
		})
	}
	for (const vector of compositeVectors.directory) {
		it(vector.name, () => {
			const tagged = {
				protocol: DIRECTORY_PROTOCOL_TAG,
				members: vector.members,
			}
			const bytes = canonicalize(tagged, vector.name)
			expect(bytesToHex(bytes)).toBe(vector.expectedCanonicalHex)
			expect(new TextDecoder().decode(bytes)).toBe(vector.expectedCanonicalText)
			expect(digestDirectory(vector.members, vector.name)).toBe(
				vector.expectedDigest,
			)
		})
	}
})

describe('determinism', () => {
	// Story-scale analogue of NFR9's permutation family: identical values,
	// repeated runs and permuted insertion orders, byte-identical output.
	it('canonicalizes and digests identically across repeated runs', () => {
		for (const vector of positiveVectors) {
			const value = scanJson(vector.rawText, vector.name)
			expect(bytesToHex(canonicalize(value, vector.name))).toBe(
				bytesToHex(canonicalize(value, vector.name)),
			)
			expect(digestArtifact(value, vector.name)).toBe(
				digestArtifact(value, vector.name),
			)
		}
	})

	it('is invariant across in-memory insertion orders', () => {
		const forward: Record<string, unknown> = {}
		const backward: Record<string, unknown> = {}
		const entries: Array<[string, unknown]> = [
			['a', 1],
			['b', [true, null, 'x']],
			['c', { nested: 0.95 }],
		]
		for (const [key, value] of entries) forward[key] = value
		for (const [key, value] of entries.reverse()) backward[key] = value
		expect(bytesToHex(canonicalize(forward, 'determinism'))).toBe(
			bytesToHex(canonicalize(backward, 'determinism')),
		)
		expect(digestArtifact(forward, 'determinism')).toBe(
			digestArtifact(backward, 'determinism'),
		)
	})
})
