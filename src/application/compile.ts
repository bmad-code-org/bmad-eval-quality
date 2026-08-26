/**
 * The synchronous application boundary for the compile stage: parses unknown
 * input against `EvalContract`, applies AD-4's default-on strict mode, and
 * delegates every structural decision to `core/compile/compile.ts`. Check
 * selection, ordering, and structural decisions stay in core; this layer
 * only validates and delegates.
 *
 * AD-34: compile needs no external observation, so this stays a plain
 * synchronous function with no plan, reducer, promise, port, or `await`.
 */
import { compile as compileContract } from '../core/compile/compile.ts'
import { EvalContract } from '../core/schemas/eval-contract.ts'
import { RuntimeFault } from '../core/schemas/faults.ts'

export function compile(
	input: unknown,
	options?: { readonly strict?: boolean },
): EvalContract {
	const parsed = EvalContract.safeParse(input)
	if (!parsed.success) {
		throw new RuntimeFault(
			'schema-parse-failure',
			'EvalContract',
			'input does not conform to the EvalContract schema',
			{ cause: parsed.error },
		)
	}
	// `parsed.data` is Zod's own deep clone of `input` on success, so the
	// returned contract shares no mutable state with the caller's object.
	// Every failure below propagates unchanged: nothing here catches.
	return compileContract(parsed.data, { strict: options?.strict ?? true })
}
