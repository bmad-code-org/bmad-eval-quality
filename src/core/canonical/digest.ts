/** the five digest functions. */
import { createHash } from 'node:crypto'
import { DIGEST_FORM } from '../schemas/primitives.ts'
import { canonicalize } from './canonicalize.ts'
import { scanJson } from './scan-json.ts'

// AD-27 digest computation. node:crypto is the one permitted builtin in core/
// (AD-1: digesting is deterministic; there is deliberately no digest port).
// No artifact carries its own digest — digests live only in referring
// artifacts, so there is no self-exclusion rule here.

export const COMPOSITE_PROTOCOL_TAG = 'eval-quality/composite/v1'
export const DIRECTORY_PROTOCOL_TAG = 'eval-quality/directory/v1'

const render = (bytes: Uint8Array): string =>
	`sha256:${createHash('sha256').update(bytes).digest('hex')}`

export function digestArtifact(value: unknown, artifactPath: string): string {
	return render(canonicalize(value, artifactPath))
}

export function digestBytes(bytes: Uint8Array): string {
	return render(bytes)
}

// The entry point for raw hashed-artifact text or bytes: lexical scan first,
// then digest. Bare JSON.parse would silently keep the last duplicate key and
// round unsafe integers, so callers holding raw input use this — never
// digestArtifact(JSON.parse(text)).
export function digestJson(
	input: Uint8Array | string,
	artifactPath: string,
): string {
	return digestArtifact(scanJson(input, artifactPath), artifactPath)
}

// A composite digest is a digest over a domain-separated tagged object with
// named fields — never a concatenation of member strings.
export function digestComposite(
	fields: Record<string, unknown>,
	artifactPath: string,
): string {
	if (Object.keys(fields).length === 0) {
		// Rejected rather than minting a degenerate tag-only digest; relaxing this
		// later cannot break frozen digests, but legalizing empties now would.
		throw new TypeError('composite requires at least one field')
	}
	if (Object.hasOwn(fields, 'protocol')) {
		throw new TypeError('composite fields must not carry a "protocol" member')
	}
	// The spread snapshots each field once into a fresh plain object, so the
	// canonicalizer digests exactly what was read here.
	return digestArtifact(
		{ protocol: COMPOSITE_PROTOCOL_TAG, ...fields },
		artifactPath,
	)
}

// Member paths must arrive in one canonical spelling: relative, forward-slash,
// no empty/dot/dot-dot segments. Two producers naming the same file "a" and
// "./a" would otherwise mint different digests with no fault raised. Unicode
// normalization is deliberately NOT applied (the canonicalizer is never
// normalization-aware); emitting NFC vs NFD spellings is the producer's
// responsibility, and the fixtures README says so.
function assertMemberPath(path: string): void {
	if (path === '') {
		throw new TypeError('directory member path must not be empty')
	}
	if (path.includes('\\')) {
		throw new TypeError(
			`directory member path must use forward slashes: ${JSON.stringify(path)}`,
		)
	}
	if (path.startsWith('/')) {
		throw new TypeError(
			`directory member path must be relative: ${JSON.stringify(path)}`,
		)
	}
	for (const segment of path.split('/')) {
		if (segment === '' || segment === '.' || segment === '..') {
			throw new TypeError(
				`directory member path not in canonical form: ${JSON.stringify(path)}`,
			)
		}
	}
}

// A directory digest is a composite over its members ordered by path. Members
// nest under a fixed "members" field so a path can never collide with the
// protocol tag; canonical key sorting orders them by path automatically —
// which means UTF-16 code-unit order, not the UTF-8 byte order git produces.
export function digestDirectory(
	members: Record<string, string>,
	artifactPath: string,
): string {
	const entries = Object.entries(members)
	if (entries.length === 0) {
		throw new TypeError('directory requires at least one member')
	}
	for (const [path, digest] of entries) {
		assertMemberPath(path)
		if (!DIGEST_FORM.test(digest)) {
			throw new TypeError(
				`directory member ${JSON.stringify(path)} is not a sha256: digest`,
			)
		}
	}
	// Digest the snapshot read above, not the caller's object: a getter or
	// Proxy could otherwise answer the canonicalizer's read with a value the
	// DIGEST_FORM check never saw.
	return digestArtifact(
		{ protocol: DIRECTORY_PROTOCOL_TAG, members: Object.fromEntries(entries) },
		artifactPath,
	)
}
