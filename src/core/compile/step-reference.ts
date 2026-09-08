/**
 * `irreducible-step-reference`: two steps one direction references render to
 * the same derived reference even after full escalation.
 *
 * AD-16 keeps step identifiers out of the sealed brief, so a direction names
 * each step it references by a phrase derived from what the contract declares
 * about it. Where two steps of one operation declare nothing that tells them
 * apart, the escalation ladder runs out and the renderer has no way to name one
 * without naming the other.
 *
 * The check runs the seal-side renderer rather than reimplementing its ladder.
 * A second implementation of a three-rung escalation with a budget would be a
 * second thing to keep in step with the first, and the failure this reports is
 * defined as "what that renderer cannot do" rather than as a rule of its own.
 * That is the same reasoning `checkEvidenceReachability` follows in reusing
 * `evaluatePointerReachability`.
 *
 * Without it a contract passes every other check and then fails inside `seal`,
 * which is the one authoring fault in the tree that reached a caller as a
 * stack trace instead of a code and a path.
 */
import { StructuralFailure } from '../failure-codes.ts'
import type { EvalContract } from '../schemas/eval-contract.ts'
import { renderEvidenceReferences } from '../seal/derived-reference.ts'
import { buildPlanIndex } from '../seal/plan-index.ts'

export function checkStepReferenceReducibility(contract: EvalContract): void {
	let index: ReturnType<typeof buildPlanIndex> | undefined
	for (const oracle of contract.oracles) {
		const { direction } = oracle
		if (direction === null || direction.evidenceTargets.length === 0) continue
		index ??= buildPlanIndex(
			contract.interactionPlan,
			contract.permittedInterfaces,
			{ duplicateIds: 'unresolved' },
		)
		try {
			renderEvidenceReferences(direction.evidenceTargets, index)
		} catch (error) {
			if (!(error instanceof StructuralFailure)) {
				// Every other way this renderer fails is a precondition violation
				// on input `compile` has already checked, so it is a fault rather
				// than an authoring fault and propagates unchanged.
				throw error
			}
			// Re-thrown with the contract-side address. `StructuralFailure`
			// carries the code and the path and folds the detail into its
			// message, so the detail is recovered from the message rather than
			// from a field the class does not expose.
			throw new StructuralFailure(
				error.code,
				`EvalContract.oracles[id=${oracle.id}].direction.evidenceTargets`,
				error.message.slice(`${error.code} in ${error.artifactPath}: `.length),
			)
		}
	}
}
