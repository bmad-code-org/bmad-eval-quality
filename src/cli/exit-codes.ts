/**
 * AD-21's exit codes, as a total function over what a command produced.
 *
 * Zero, one, and two are the verdict range. A command that produced no verdict
 * never takes one or two, so a CI runner reading a two knows a verdict said
 * FAIL and not that a compile failed. Zero stays plain success for every
 * outcome, verdict or not.
 */
import type { Verdict } from '../application/index.ts'

export const EXIT_OK = 0
export const EXIT_CONCERNS_PROMOTED = 1
export const EXIT_FAIL = 2
export const EXIT_INVALID = 3
export const EXIT_STRUCTURAL_FAILURE = 4
export const EXIT_FAULT = 5
/** sysexits.h EX_USAGE. Outside the verdict range and outside AD-21's codes. */
export const EXIT_USAGE = 64

export type CommandOutcome =
	| { readonly kind: 'artifact' }
	| { readonly kind: 'preflight'; readonly passed: boolean }
	| {
			readonly kind: 'verdict'
			/** `null` is AD-21's Invalid rung: `LadderResolution.verdict` on that rung, never a `Verdict`. */
			readonly verdict: Verdict | null
			/** `LadderResolution.exitCode`, read directly rather than recomputed from `verdict`. */
			readonly exitCode: number
			/** `LadderResolution.strictPromotable`, carried through unchanged: never inverted into a locally-invented `evidenceConditionsOnly`. */
			readonly strictPromotable: boolean
	  }
	| { readonly kind: 'structural-failure' }
	| { readonly kind: 'fault' }
	| { readonly kind: 'usage-error' }

function verdictExit(
	outcome: Extract<CommandOutcome, { kind: 'verdict' }>,
	strict: boolean,
): number {
	// `--strict` promotes a CONCERNS to one, "except a CONCERNS whose only
	// firing conditions are evidence conditions, which `--strict` never
	// promotes" (AD-21). `LADDER_EXIT_CODES.CONCERNS` is already zero, so this
	// promotion cannot be read out of `outcome.exitCode` itself: it is applied
	// on top of it. Every other rung -- PASS, WAIVED, FAIL, and Invalid's
	// `null` -- returns its own `exitCode` unchanged.
	if (outcome.verdict === 'CONCERNS' && strict && outcome.strictPromotable) {
		return EXIT_CONCERNS_PROMOTED
	}
	return outcome.exitCode
}

export function exitCodeFor(
	outcome: CommandOutcome,
	options: { readonly strict: boolean },
): number {
	switch (outcome.kind) {
		case 'artifact':
			return EXIT_OK
		// A failed pre-flight invalidates the run (AD-10). Invalid is 3; a 2
		// would read as a scored FAIL verdict.
		case 'preflight':
			return outcome.passed ? EXIT_OK : EXIT_INVALID
		case 'verdict':
			return verdictExit(outcome, options.strict)
		case 'structural-failure':
			return EXIT_STRUCTURAL_FAILURE
		case 'fault':
			return EXIT_FAULT
		case 'usage-error':
			return EXIT_USAGE
	}
}
