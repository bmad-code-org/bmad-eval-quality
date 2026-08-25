/**
 * Checks AD-19 behavior declarations for requirement or risk linkage and an
 * observable success criterion. Each check reports the first violation.
 */
import { StructuralFailure } from '../failure-codes.ts'
import type { EvalContract } from '../schemas/eval-contract.ts'

/** Rejects a behavior whose requirement and risk link lists are both empty. */
export function checkRequirementLinkage(contract: EvalContract): void {
	for (const behavior of contract.behaviors) {
		if (
			behavior.requirementLinks.length === 0 &&
			behavior.riskLinks.length === 0
		) {
			throw new StructuralFailure(
				'missing-requirement-linkage',
				`EvalContract.behaviors[id=${behavior.id}]`,
				'declares neither a requirementLinks nor a riskLinks entry (AD-19)',
			)
		}
	}
}

/** A null criterion fails. An empty oracle list remains valid. */
export function checkObservableSuccessCriterion(contract: EvalContract): void {
	for (const behavior of contract.behaviors) {
		if (behavior.observableSuccessCriterion === null) {
			throw new StructuralFailure(
				'no-observable-success-criterion',
				`EvalContract.behaviors[id=${behavior.id}].observableSuccessCriterion`,
				'declares no observable success criterion (AD-19)',
			)
		}
	}
}
