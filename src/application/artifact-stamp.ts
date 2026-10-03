/**
 * AD-11's version equality for the artifacts `score` and `aggregate-strength`
 * read besides the sealed run record and the eval contract, read off the raw
 * value before the strict parse. An artifact stamped for another version either
 * fails the parse as an anonymous `schema-parse-failure`, which does not say
 * which version this build reads, or fits this version's shape and is scored
 * under a shape it no longer has. A value with no numeric stamp is left to the
 * parse, which names the field.
 */
import { checkSchemaVersion } from '../core/compile/schema-version.ts'

export type ArtifactStamp = {
	readonly accepted: number
	readonly artifactPath: string
	/** Why an unequal stamp is a rejection for this artifact, as a clause. */
	readonly consequence: string
}

export function checkArtifactVersion(
	input: unknown,
	artifact: ArtifactStamp,
): void {
	const stamped = (input as { schemaVersion?: unknown } | null)?.schemaVersion
	if (typeof stamped !== 'number') return
	checkSchemaVersion({ stamped, ...artifact })
}

/** Shared by `score` and `aggregate-strength`, which both read the policy. */
export const SCORING_POLICY_CONSEQUENCE =
	'a policy written for another version would be applied under thresholds and caps this build does not define'
