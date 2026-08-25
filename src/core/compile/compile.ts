/**
 * The pure, synchronous, fixed-order compile stage over an already-parsed
 * `EvalContract`. No I/O, no state; every check throws `StructuralFailure`
 * straight through to the caller.
 *
 * Call order is AD-5's registry order, the only published stable priority: a
 * contract violating several checks reports whichever runs first. The
 * `malformed-operator-expression` trio (`checkBoundElementScope`,
 * `checkOperandLegality`, `checkRegexConstructs`) keeps that suborder so
 * their shared result stays deterministic. `checkUndeclaredMandatoryInput`
 * runs only when `options.strict` is true (AD-4).
 */

import type { EvalContract } from '../schemas/eval-contract.ts'
import type { CompileOptions } from '../stage-contracts.ts'
import {
	checkObservableSuccessCriterion,
	checkRequirementLinkage,
} from './declarations.ts'
import {
	checkOperandLegality,
	checkQuantifierNesting,
	checkQuantifierOverNonCollection,
	checkReferenceSetResolution,
	checkRegexConstructs,
} from './expression-legality.ts'
import {
	checkForbiddenInputFloor,
	checkScopedResourceReferences,
} from './forbidden-inputs.ts'
import {
	checkDuplicateOperationSignature,
	checkInterfaceKind,
	checkUndeclaredMandatoryInput,
} from './interface-inventory.ts'
import { checkOracleAlignment, checkOracleChannel } from './oracle-alignment.ts'
import {
	checkBoundElementScope,
	checkEvidenceReachability,
} from './reachability.ts'
import {
	checkNestedTemporalClause,
	checkScriptingBound,
} from './scripting-bound.ts'
import { checkWaiverCompleteness } from './waivers.ts'

export function compile(
	contract: EvalContract,
	options: CompileOptions,
): EvalContract {
	checkRequirementLinkage(contract)
	checkObservableSuccessCriterion(contract)
	checkEvidenceReachability(contract)
	checkBoundElementScope(contract)
	checkOperandLegality(contract)
	checkRegexConstructs(contract)
	checkQuantifierOverNonCollection(contract)
	checkQuantifierNesting(contract)
	checkReferenceSetResolution(contract)
	checkDuplicateOperationSignature(contract)
	if (options.strict) checkUndeclaredMandatoryInput(contract)
	checkOracleChannel(contract)
	checkOracleAlignment(contract)
	checkInterfaceKind(contract)
	checkNestedTemporalClause(contract)
	checkScriptingBound(contract)
	checkForbiddenInputFloor(contract)
	checkScopedResourceReferences(contract)
	checkWaiverCompleteness(contract)
	return contract
}
