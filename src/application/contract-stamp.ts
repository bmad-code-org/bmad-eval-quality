/**
 * AD-11's version equality for the eval contract, read off the raw value before
 * the strict parse. A contract stamped for another version rarely parses under
 * this one's shape, and `schema-parse-failure` would not say which version this
 * build reads; one stamped for another version in this version's shape would
 * pass the parse and carry its stale version into the scoring version. A value
 * with no numeric stamp is left to the parse, which names the field.
 *
 * Every stage that parses an eval contract at its boundary calls this first, so
 * the fault reads the same wherever a stale contract enters.
 */
import { checkSchemaVersion } from '../core/compile/schema-version.ts'
import { EVAL_CONTRACT_SCHEMA_VERSION } from '../core/schemas/eval-contract.ts'

export function checkContractVersion(input: unknown): void {
	const stamped = (input as { schemaVersion?: unknown } | null)?.schemaVersion
	if (typeof stamped !== 'number') return
	checkSchemaVersion({
		stamped,
		accepted: EVAL_CONTRACT_SCHEMA_VERSION,
		artifactPath: 'EvalContract.schemaVersion',
		consequence:
			'since its stale version would travel into the scoring version',
	})
}
