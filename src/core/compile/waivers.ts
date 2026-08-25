/**
 * Checks each waiver for its rule, rationale, approval, and expiry.
 * A condition is optional.
 */
import { StructuralFailure } from '../failure-codes.ts'
import type { EvalContract } from '../schemas/eval-contract.ts'

const REQUIRED_WAIVER_PARTS = [
	'rule',
	'rationale',
	'approval',
	'expiresAt',
] as const

/** Reports the first missing required field. */
export function checkWaiverCompleteness(contract: EvalContract): void {
	for (const waiver of contract.waivers) {
		for (const part of REQUIRED_WAIVER_PARTS) {
			if (waiver[part] === null) {
				throw new StructuralFailure(
					'waiver-incomplete',
					`EvalContract.waivers[id=${waiver.id}].${part}`,
					`a waiver requires ${part}; AD-5 requires the named rule, an explicit rationale, the recorded approval, and an RFC 3339 expiry`,
				)
			}
		}
	}
}
