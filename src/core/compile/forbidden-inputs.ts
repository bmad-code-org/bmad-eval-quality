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

/**
 * `scoped-reference-resolves-forbidden`: any scoped reference is forbidden,
 * wherever the contract writes it down. `scopedResources` is read first and
 * `testData.resources` second, each with its own message and artifact path, so
 * a contract carrying both reports the field AD-16 names by that word. The
 * second address uses the caller-keyed form `interface-inventory.ts` already
 * emits, since that list is keyed by name rather than indexed.
 */
export function checkScopedResourceReferences(contract: EvalContract): void {
	const resource = contract.scopedResources?.[0]
	if (resource !== undefined) {
		throw new StructuralFailure(
			'scoped-reference-resolves-forbidden',
			'EvalContract.scopedResources[0].reference',
			`scoped resource reference "${resource.reference}" is forbidden (AD-16)`,
		)
	}
	// Sorted, so which of several declared resources is reported never depends
	// on the authored key order.
	const declared = Object.keys(contract.testData.resources ?? {}).sort()[0]
	if (declared === undefined) return
	throw new StructuralFailure(
		'scoped-reference-resolves-forbidden',
		`EvalContract.testData.resources[${JSON.stringify(declared)}]`,
		`declared test-data resource "${declared}" is a scoped resource reference and is forbidden (AD-16)`,
	)
}
