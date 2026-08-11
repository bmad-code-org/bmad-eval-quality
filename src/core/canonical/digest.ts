import { createHash } from 'node:crypto'
import { canonicalize } from './canonicalize.ts'

// AD-27 digest computation. node:crypto is the one permitted builtin in core/
// (AD-1: digesting is deterministic; there is deliberately no digest port).
// No artifact carries its own digest — digests live only in referring
// artifacts, so there is no self-exclusion rule here.

export const COMPOSITE_PROTOCOL_TAG = 'eval-quality/composite/v1'
export const DIRECTORY_PROTOCOL_TAG = 'eval-quality/directory/v1'

const DIGEST_FORM = /^sha256:[0-9a-f]{64}$/

const render = (bytes: Uint8Array): string =>
	`sha256:${createHash('sha256').update(bytes).digest('hex')}`

export function digestArtifact(value: unknown, artifactPath: string): string {
	return render(canonicalize(value, artifactPath))
}

export function digestBytes(bytes: Uint8Array): string {
	return render(bytes)
}

// A composite digest is a digest over a domain-separated tagged object with
// named fields — never a concatenation of member strings.
export function digestComposite(
	fields: Record<string, unknown>,
	artifactPath: string,
): string {
	if (Object.hasOwn(fields, 'protocol')) {
		throw new TypeError('composite fields must not carry a "protocol" member')
	}
	return digestArtifact(
		{ protocol: COMPOSITE_PROTOCOL_TAG, ...fields },
		artifactPath,
	)
}

// A directory digest is a composite over its members ordered by path. Members
// nest under a fixed "members" field so a path can never collide with the
// protocol tag; canonical key sorting orders them by path automatically —
// which means UTF-16 code-unit order, not the UTF-8 byte order git produces.
export function digestDirectory(
	members: Record<string, string>,
	artifactPath: string,
): string {
	for (const [path, digest] of Object.entries(members)) {
		if (!DIGEST_FORM.test(digest)) {
			throw new TypeError(
				`directory member ${JSON.stringify(path)} is not a sha256: digest`,
			)
		}
	}
	return digestArtifact(
		{ protocol: DIRECTORY_PROTOCOL_TAG, members },
		artifactPath,
	)
}
