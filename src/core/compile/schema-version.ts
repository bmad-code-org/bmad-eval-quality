/**
 * AD-11's version equality, performed by the one reader that has the contract.
 *
 * AD-11's rule is that "readers accept an equal `schemaVersion` only and throw
 * `schema-version-mismatch` outside that". `lineage.ts` deliberately keeps the
 * field a plain integer rather than a literal, so that a wrong version arrives
 * as AD-28's named fault instead of an anonymous parse failure, which puts the
 * comparison on whoever reads the artifact. For the eval contract nobody did:
 * a contract stamped 3 parsed, compiled, sealed, and put its stale version into
 * the scoring version digest, and AD-11 exists to keep that number comparable.
 *
 * `RuntimeFault` rather than `StructuralFailure`, against the grain of every
 * other check in this directory. The two registries are disjoint by the
 * Consistency Conventions, AD-5 has no version code, and AD-11 names
 * `schema-version-mismatch` literally. Minting an AD-5 twin would give one
 * condition two codes and make a caller's handler depend on which reader
 * happened to notice first.
 */
import { RuntimeFault } from '../schemas/faults.ts'

/** `schema-version-mismatch`: the stamp is not the version this build reads. */
export function checkSchemaVersion(
	stamped: number,
	accepted: number,
	artifactPath: string,
): void {
	if (stamped === accepted) return
	throw new RuntimeFault(
		'schema-version-mismatch',
		artifactPath,
		`carries "schemaVersion" ${stamped} where this build reads ${accepted}; a contract written for another version is not read leniently, since its stale version would travel into the scoring version (AD-11)`,
	)
}
