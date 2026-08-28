import { describe, expect, it } from 'vitest'
import { serializeArtifact } from '../../src/application/serialize.ts'
import { canonicalize } from '../../src/core/canonical/canonicalize.ts'
import { digestArtifact, digestBytes } from '../../src/core/canonical/digest.ts'
import { faultOf } from '../canonical/helpers.ts'
import { populatedContract } from '../schemas/fixtures/relevance-contracts.ts'

const PATH = 'EvalContract'

describe('serializeArtifact', () => {
	it('case 117: emits the canonical bytes plus exactly one trailing newline', () => {
		const text = serializeArtifact(populatedContract, PATH)
		expect(text.endsWith('\n')).toBe(true)
		expect(text.endsWith('\n\n')).toBe(false)
		expect(text.slice(0, -1)).toBe(
			new TextDecoder().decode(canonicalize(populatedContract, PATH)),
		)
	})

	it('case 118: digestArtifact equals digestBytes of the encoded text minus its trailing newline', () => {
		// AC 3's agreement, stated exactly. digestArtifact carries a `sha256:`
		// prefix, so a bare sha256sum of the same text does not match it.
		const text = serializeArtifact(populatedContract, PATH)
		expect(text.endsWith('\n')).toBe(true)
		expect(digestBytes(new TextEncoder().encode(text.slice(0, -1)))).toBe(
			digestArtifact(populatedContract, PATH),
		)
	})

	it('case 119: orders keys canonically, so insertion order never reaches the output', () => {
		expect(serializeArtifact({ b: 2, a: 1 }, PATH)).toBe('{"a":1,"b":2}\n')
		expect(serializeArtifact({ b: 2, a: 1 }, PATH)).toBe(
			serializeArtifact({ a: 1, b: 2 }, PATH),
		)
	})

	it('case 120: throws non-canonicalizable-value on a value the canonicalizer rejects', () => {
		const fault = faultOf(() => serializeArtifact({ score: Number.NaN }, PATH))
		expect(fault.code).toBe('non-canonicalizable-value')
		expect(fault.artifactPath).toBe(PATH)
	})
})
