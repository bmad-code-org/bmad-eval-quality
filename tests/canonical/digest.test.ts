import { describe, expect, it } from 'vitest'
import {
	COMPOSITE_PROTOCOL_TAG,
	DIRECTORY_PROTOCOL_TAG,
	digestArtifact,
	digestBytes,
	digestComposite,
	digestDirectory,
	digestJson,
} from '../../src/core/canonical/digest.ts'
import { faultOf } from './helpers.ts'

const PATH = 'artifacts/digest.json'
const DIGEST_FORM = /^sha256:[0-9a-f]{64}$/

describe('digestArtifact', () => {
	it('renders sha256: followed by exactly 64 lowercase hex characters', () => {
		expect(digestArtifact({ a: 1 }, PATH)).toMatch(DIGEST_FORM)
	})

	it('digests the canonical serialization: {} hashes to the well-known sha256 of "{}"', () => {
		// Independently known: printf '{}' | shasum -a 256
		expect(digestArtifact({}, PATH)).toBe(
			'sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a',
		)
	})

	it('is insertion-order invariant', () => {
		expect(digestArtifact({ a: 1, b: 2 }, PATH)).toBe(
			digestArtifact({ b: 2, a: 1 }, PATH),
		)
	})

	it('is deterministic across repeated calls', () => {
		const value = {
			scores: [0.95, 0.99, 0.8, 0.04, 62.5],
			label: 'r\u00e9p\u00e9tition \ud83d\ude00',
		}
		expect(digestArtifact(value, PATH)).toBe(digestArtifact(value, PATH))
	})
})

describe('digestJson', () => {
	it('digests raw text through the lexical scanner', () => {
		expect(digestJson('{"b":2,"a":1}', PATH)).toBe(
			digestArtifact({ a: 1, b: 2 }, PATH),
		)
		expect(digestJson(new TextEncoder().encode('{"a":1}'), PATH)).toBe(
			digestArtifact({ a: 1 }, PATH),
		)
	})

	it('catches lexical violations bare JSON.parse would silently miss', () => {
		const duplicate = faultOf(() => digestJson('{"A":1,"A":2}', PATH))
		expect(duplicate.code).toBe('non-canonicalizable-value')
		const rounded = faultOf(() => digestJson('9007199254740993', PATH))
		expect(rounded.code).toBe('non-canonicalizable-value')
	})
})

describe('digestBytes', () => {
	it('digests the empty byte string to the well-known sha256 value', () => {
		expect(digestBytes(new Uint8Array())).toBe(
			'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		)
	})

	it('digests raw bytes, not any JSON form', () => {
		// Independently known: printf 'hello world' | shasum -a 256
		expect(digestBytes(new TextEncoder().encode('hello world'))).toBe(
			'sha256:b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
		)
	})
})

describe('digestComposite', () => {
	it('digests the domain-separated tagged object, never a concatenation', () => {
		const fields = {
			contract: 'sha256:'.padEnd(71, 'a'),
			run: 'sha256:'.padEnd(71, 'b'),
		}
		expect(digestComposite(fields, PATH)).toBe(
			digestArtifact({ protocol: COMPOSITE_PROTOCOL_TAG, ...fields }, PATH),
		)
	})

	it('rejects a member field named protocol instead of silently overriding the tag', () => {
		expect(() => digestComposite({ protocol: 'x' }, PATH)).toThrow(TypeError)
	})

	it('rejects an empty fields object instead of minting a degenerate digest', () => {
		expect(() => digestComposite({}, PATH)).toThrow(TypeError)
	})

	it('exposes the frozen protocol tag', () => {
		expect(COMPOSITE_PROTOCOL_TAG).toBe('eval-quality/composite/v1')
		expect(DIRECTORY_PROTOCOL_TAG).toBe('eval-quality/directory/v1')
	})
})

describe('digestDirectory', () => {
	const memberDigest = (fill: string): string => `sha256:${fill.repeat(64)}`

	it('digests a directory as a composite over members keyed by path', () => {
		const members = {
			'a.json': memberDigest('a'),
			'b/c.json': memberDigest('b'),
		}
		expect(digestDirectory(members, PATH)).toBe(
			digestArtifact({ protocol: DIRECTORY_PROTOCOL_TAG, members }, PATH),
		)
	})

	it('orders members by path automatically via canonical key sorting', () => {
		const forward = digestDirectory(
			{ 'a.json': memberDigest('a'), 'z.json': memberDigest('f') },
			PATH,
		)
		const reversed = digestDirectory(
			{ 'z.json': memberDigest('f'), 'a.json': memberDigest('a') },
			PATH,
		)
		expect(forward).toBe(reversed)
	})

	it('rejects an empty members object and an empty member path', () => {
		expect(() => digestDirectory({}, PATH)).toThrow(TypeError)
		expect(() => digestDirectory({ '': memberDigest('a') }, PATH)).toThrow(
			TypeError,
		)
	})

	it('rejects non-canonical member path spellings', () => {
		for (const path of [
			'/a.json',
			'./a.json',
			'../a.json',
			'a//b.json',
			'a\\b.json',
			'a.json/',
		]) {
			expect(
				() => digestDirectory({ [path]: memberDigest('a') }, PATH),
				`path ${JSON.stringify(path)} should be rejected`,
			).toThrow(TypeError)
		}
	})

	it('digests the members snapshot it validated, not a re-readable object', () => {
		// The getter answers the validation read with a well-formed digest and
		// would answer any second read with garbage; the snapshot means there is
		// no second read.
		let reads = 0
		const members = Object.defineProperty(
			{} as Record<string, string>,
			'a.json',
			{
				get: () => (++reads === 1 ? memberDigest('a') : 'garbage'),
				enumerable: true,
				configurable: true,
			},
		)
		expect(digestDirectory(members, PATH)).toBe(
			digestDirectory({ 'a.json': memberDigest('a') }, PATH),
		)
	})

	it('rejects a member value that is not a sha256: digest string', () => {
		expect(() => digestDirectory({ 'a.json': 'not-a-digest' }, PATH)).toThrow(
			TypeError,
		)
		expect(() =>
			digestDirectory({ 'a.json': `sha256:${'A'.repeat(64)}` }, PATH),
		).toThrow(TypeError)
	})
})
