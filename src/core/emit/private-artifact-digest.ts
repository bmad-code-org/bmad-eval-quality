/**
 * The pure half of `private-artifact-manifest.ts`'s own "a mismatch is an
 * AD-28 `digest-mismatch` fault": given a manifest and each entry's already-
 * resolved digest, throws on the first disagreement. AD-8 requires the
 * digest recomputed from the resolved bytes; resolving those bytes needs
 * `CorpusPort.resolve`, an async port method, and AD-34 makes awaiting a
 * port `application/`'s job, never `core/`'s. This module is the comparator
 * alone and has no caller yet: whoever first awaits `CorpusPort.resolve` to
 * build `resolvedDigests` is this function's caller, and that await belongs
 * in `application/`, not here.
 */
import { RuntimeFault } from '../schemas/faults.ts'
import type { PrivateArtifactManifest } from '../schemas/private-artifact-manifest.ts'

/**
 * Throws `RuntimeFault('digest-mismatch', ...)` on the first
 * `entries[i]` whose declared `digest` disagrees with
 * `resolvedDigests.get(entry.privateRef)`. An entry with no resolved digest
 * at all -- `resolvedDigests` carries no key for its `privateRef` -- is the
 * same disagreement: there is no byte the manifest's declared digest can be
 * checked against, which this comparator treats no differently from a
 * genuine mismatch.
 */
export function checkPrivateArtifactManifestDigests(
	manifest: PrivateArtifactManifest,
	resolvedDigests: ReadonlyMap<string, string>,
): void {
	manifest.entries.forEach((entry, index) => {
		const resolved = resolvedDigests.get(entry.privateRef)
		if (resolved === entry.digest) return
		throw new RuntimeFault(
			'digest-mismatch',
			`PrivateArtifactManifest.entries[${index}]`,
			`entry privateRef "${entry.privateRef}" declares digest "${entry.digest}", but the resolved bytes digest to ${
				resolved === undefined
					? 'nothing (no resolved digest supplied for this privateRef)'
					: `"${resolved}"`
			}`,
		)
	})
}
