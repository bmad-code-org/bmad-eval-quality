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
 * runs only when `options.strict` is true (AD-4), and AD-10's
 * `checkSensitivityWitnessDeclared` joins it there because it fires the same
 * code; the other two witness checks fire different codes and run
 * unconditionally, after the registry order, since AD-5 names no rung for them.
 *
 * `checkCapturedReachability` fires the shipped `unreachable-check-evidence`,
 * so it runs at that code's own third rung, beside `checkEvidenceReachability`.
 * Grouping it with the two codes owed item 3 added, at the inserted position
 * below, would let a lower-ranked code win on a contract carrying both defects.
 *
 * `checkArtifactReferences` fires `unresolved-artifact-reference`, the
 * registry's last code, but runs near the front for the reason its own call
 * site records: it names a fault that reachability can only describe the
 * consequence of, and reachability abstains on the same pointer so the two
 * never race.
 *
 * `checkStepReferenceReducibility` runs last, after every other check has had
 * its say. It is the only check that reports what a LATER stage cannot do
 * rather than what this contract declares wrongly, so a contract with an
 * ordinary declaration fault should hear about that fault rather than about
 * the sealing consequence of it.
 *
 * `checkRubricIdentifiers` fires `rubric-unanchored` but runs ahead of
 * `checkRubricReasoningProse`, which outranks it in the registry. A duplicated
 * rubric or criterion id makes every `rubrics[id=...]` path the other three
 * rubric checks emit address two things, so identifiers are settled before any
 * of them reports.
 */

import type { EvalContract } from '../schemas/eval-contract.ts'
import { EVAL_CONTRACT_SCHEMA_VERSION } from '../schemas/eval-contract.ts'
import type { CompileOptions } from '../stage-contracts.ts'
import {
	checkBindingCycle,
	checkCapturedChannel,
	checkCapturedReachability,
} from './bindings.ts'
import {
	checkObservableSuccessCriterion,
	checkRequirementLinkage,
} from './declarations.ts'
import { checkExcludedContent } from './excluded-content.ts'
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
	checkArtifactReferences,
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
	checkRubricAnchoring,
	checkRubricEvidenceReachability,
	checkRubricIdentifiers,
	checkRubricReasoningProse,
} from './rubrics.ts'
import { checkSchemaVersion } from './schema-version.ts'
import {
	checkNestedTemporalClause,
	checkScriptingBound,
} from './scripting-bound.ts'
import {
	checkSensitivityWitnessDeclared,
	checkWitnessLegality,
	checkWitnessLegIdentifiers,
} from './sensitivity-witness.ts'
import { checkStepReferenceReducibility } from './step-reference.ts'
import { checkWaiverCompleteness } from './waivers.ts'

export function compile(
	contract: EvalContract,
	options: CompileOptions,
): EvalContract {
	// First, and before any check reads a declaration. AD-11 makes an unequal
	// stamp a rejection rather than a degraded read, and every check below is
	// written against this version's field shapes.
	checkSchemaVersion(
		contract.schemaVersion,
		EVAL_CONTRACT_SCHEMA_VERSION,
		'EvalContract.schemaVersion',
	)
	checkRequirementLinkage(contract)
	checkObservableSuccessCriterion(contract)
	// Ahead of reachability, because a pointer naming an artifact nothing
	// declares has no operation shape to be reachable against, and the code
	// that names the fault directly should not lose the race to the code that
	// describes its consequence.
	checkArtifactReferences(contract)
	checkEvidenceReachability(contract)
	checkCapturedReachability(contract)
	checkBoundElementScope(contract)
	checkOperandLegality(contract)
	checkRegexConstructs(contract)
	checkQuantifierOverNonCollection(contract)
	checkQuantifierNesting(contract)
	checkReferenceSetResolution(contract)
	checkDuplicateOperationSignature(contract)
	if (options.strict) {
		checkUndeclaredMandatoryInput(contract)
		checkSensitivityWitnessDeclared(contract)
	}
	checkOracleChannel(contract)
	checkOracleAlignment(contract)
	checkInterfaceKind(contract)
	checkNestedTemporalClause(contract)
	checkScriptingBound(contract)
	checkBindingCycle(contract)
	checkCapturedChannel(contract)
	checkRubricIdentifiers(contract)
	checkRubricReasoningProse(contract)
	checkRubricAnchoring(contract)
	checkRubricEvidenceReachability(contract)
	checkForbiddenInputFloor(contract)
	checkExcludedContent(contract)
	checkScopedResourceReferences(contract)
	checkWaiverCompleteness(contract)
	checkStepReferenceReducibility(contract)
	// Identifiers before legality. A duplicated or plan-colliding leg id makes
	// the legality check's question ("does the relation address both legs?")
	// unanswerable, so legality-first reports an unreachable-evidence failure on
	// a contract whose actual defect is the collision, and every identifier
	// fixture would need a second mutation to reach its own code.
	checkWitnessLegIdentifiers(contract)
	checkWitnessLegality(contract)
	return contract
}
