/** AD-16 checks for forbidden inputs and scoped resource references. */
import { StructuralFailure } from '../failure-codes.ts'
import type { EvalContract } from '../schemas/eval-contract.ts'
import { FORBIDDEN_INPUT_FLOOR } from '../schemas/eval-contract.ts'

/** `forbidden-input-floor-incomplete`: `forbiddenInputs` omits a floor member. */
export function checkForbiddenInputFloor(contract: EvalContract): void {
	const declared = new Set(contract.forbiddenInputs)
	for (const member of FORBIDDEN_INPUT_FLOOR) {
		if (!declared.has(member)) {
			throw new StructuralFailure(
				'forbidden-input-floor-incomplete',
				'EvalContract.forbiddenInputs',
				`omits mandatory floor member "${member}" (AD-16)`,
			)
		}
	}
}

/** `scoped-reference-resolves-forbidden`: any scoped reference is forbidden. */
export function checkScopedResourceReferences(contract: EvalContract): void {
	const resource = contract.scopedResources?.[0]
	if (resource === undefined) return
	throw new StructuralFailure(
		'scoped-reference-resolves-forbidden',
		'EvalContract.scopedResources[0].reference',
		`scoped resource reference "${resource.reference}" is forbidden (AD-16)`,
	)
}
