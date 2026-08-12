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
import byteVectorsJson from '../fixtures/byte-vectors.json'
import compositeVectorsJson from '../fixtures/composite-vectors.json'
import negativeVectorsJson from '../fixtures/negative-vectors.json'
import positiveVectorsJson from '../fixtures/positive-vectors.json'
import { bytesToHex, faultOf, hexToBytes } from './helpers.ts'

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

interface CompositeRejectVector {
	name: string
	fields: Record<string, unknown>
	reason: string
}

interface DirectoryRejectVector {
	name: string
	members: Record<string, string>
	reason: string
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
	compositeReject: CompositeRejectVector[]
	directoryReject: DirectoryRejectVector[]
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
		expect(compositeVectors.compositeReject.length).toBeGreaterThan(0)
		expect(compositeVectors.directoryReject.length).toBeGreaterThan(0)
	})

	// Deleting a single required vector would otherwise pass CI silently — the
	// same fail-open shape as an empty fixture array, one level up. These names
	// are the AC5-mandated set.
	it('contains every AC5-required vector by name', () => {
		const positiveNames = new Set(positiveVectors.map((vector) => vector.name))
		for (const name of [
			'decimal-0.95',
			'decimal-0.99',
			'decimal-0.8',
			'decimal-0.04',
			'decimal-62.5',
			'one-point-zero-canonicalizes-to-1',
			'negative-zero-canonicalizes-to-0',
			'safe-integer-max-9007199254740991',
			'key-order-invariance',
			'key-sort-code-unit-not-code-point',
		]) {
			expect(positiveNames, `missing positive vector ${name}`).toContain(name)
		}
		const negativeNames = new Set(negativeVectors.map((vector) => vector.name))
		for (const name of [
			'unsafe-integer-9007199254740993',
			'two-pow-53-exactly-9007199254740992',
			'integer-valued-1e21',
			'overflow-1e999',
			'duplicate-keys-literal',
			'duplicate-keys-escaped',
			'lone-surrogate-string-value',
			'lone-surrogate-object-key',
			'nesting-beyond-1024',
		]) {
			expect(negativeNames, `missing negative vector ${name}`).toContain(name)
		}
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
			// The same document routed through the bytes entry path — the path a
			// real artifact file takes (Uint8Array → fatal decode → scan → digest).
			const fromBytes = scanJson(
				new TextEncoder().encode(vector.rawText),
				vector.name,
			)
			expect(digestArtifact(fromBytes, vector.name)).toBe(vector.expectedDigest)
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
	for (const vector of compositeVectors.compositeReject) {
		it(vector.name, () => {
			expect(() => digestComposite(vector.fields, vector.name)).toThrow(
				TypeError,
			)
		})
	}
	for (const vector of compositeVectors.directoryReject) {
		it(vector.name, () => {
			expect(() => digestDirectory(vector.members, vector.name)).toThrow(
				TypeError,
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
