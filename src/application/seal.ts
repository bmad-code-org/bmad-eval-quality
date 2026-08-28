/**
 * The synchronous application boundary for the seal stage. Compiles, then
 * seals: `compile` and `seal` are one stage for a caller, and sealing an
 * uncompiled contract emits a brief from declarations no discipline check has
 * seen.
 *
 * Sequencing two pure core stages is not decision logic; `preflight.ts`
 * already sequences plan and reduce. `StructuralFailure` and `RuntimeFault`
 * propagate. `core/seal` throws `TypeError` on preconditions compilation does
 * not cover, and this boundary converts those so an untyped throw never
 * reaches a caller.
 */
import { RuntimeFault } from '../core/schemas/faults.ts'
import type { SealedEvaluatorBrief } from '../core/schemas/sealed-evaluator-brief.ts'
import { seal as sealContract } from '../core/seal/seal.ts'
import { compile } from './compile.ts'

export function seal(
	input: unknown,
	options?: { readonly strict?: boolean },
): SealedEvaluatorBrief {
	const contract = compile(input, options)
	try {
		// `core/seal` validates the assembled brief and freezes it on the way
		// out, so AD-28's outbound check is already done and is not repeated.
		return sealContract(contract)
	} catch (error) {
		if (!(error instanceof TypeError)) throw error
		throw new RuntimeFault(
			'schema-parse-failure',
			'EvalContract',
			`the contract compiles but cannot be sealed: ${error.message}`,
			{ cause: error },
		)
	}
}
