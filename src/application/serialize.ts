import { canonicalize } from '../core/canonical/canonicalize.ts'

/**
 * RFC 8785 canonical bytes plus a trailing newline, as text. Strip the newline
 * and the remaining bytes are what `digestArtifact` hashes, so a caller can
 * write a file and compute its digest from the same string.
 */
export function serializeArtifact(
	artifact: unknown,
	artifactPath: string,
): string {
	return `${new TextDecoder().decode(canonicalize(artifact, artifactPath))}\n`
}
