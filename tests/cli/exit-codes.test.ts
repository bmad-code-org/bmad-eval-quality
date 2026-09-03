/**
 * AC 17, cases 31 through 48: AD-21's exit-code ladder of AC 10. The load
 * bearing property across the file is that 1 and 2 are the verdict range, so
 * a CI runner reading a 2 knows a verdict said FAIL.
 */
import { describe, expect, it } from 'vitest'
import type { CommandOutcome } from '../../src/cli/exit-codes.ts'
import {
	EXIT_CONCERNS_PROMOTED,
	EXIT_FAIL,
	EXIT_FAULT,
	EXIT_INVALID,
	EXIT_OK,
	EXIT_STRUCTURAL_FAILURE,
	EXIT_USAGE,
	exitCodeFor,
} from '../../src/cli/exit-codes.ts'

const VERDICT_RANGE = [EXIT_CONCERNS_PROMOTED, EXIT_FAIL]

const LAX = { strict: false } as const
const STRICT = { strict: true } as const

/** Every kind but `verdict`, both `preflight` states included. */
const NON_VERDICT_OUTCOMES: readonly CommandOutcome[] = [
	{ kind: 'artifact' },
	{ kind: 'preflight', passed: true },
	{ kind: 'preflight', passed: false },
	{ kind: 'structural-failure' },
	{ kind: 'fault' },
	{ kind: 'usage-error' },
]

/** `LADDER_EXIT_CODES`, restated: the base exit code each verdict's own rung carries before any `--strict` promotion is applied on top. */
const BASE_EXIT_CODE: Record<'PASS' | 'WAIVED' | 'CONCERNS' | 'FAIL', number> =
	{
		PASS: EXIT_OK,
		WAIVED: EXIT_OK,
		CONCERNS: EXIT_OK,
		FAIL: EXIT_FAIL,
	}

/** `strictPromotable` defaults `true`, `LadderResolution`'s own default for every rung but an evidence-only CONCERNS. */
const verdictOutcome = (
	verdict: 'PASS' | 'WAIVED' | 'CONCERNS' | 'FAIL' | null,
	strictPromotable = true,
): CommandOutcome => ({
	kind: 'verdict',
	verdict,
	exitCode: verdict === null ? EXIT_INVALID : BASE_EXIT_CODE[verdict],
	strictPromotable,
})

describe('cli exit codes: one case per outcome kind (cases 31-36)', () => {
	it('case 31: artifact exits zero, outside the verdict range', () => {
		const code = exitCodeFor({ kind: 'artifact' }, LAX)
		expect(code).toBe(EXIT_OK)
		expect(VERDICT_RANGE).not.toContain(code)
	})

	it('case 32: preflight exits zero when it passed and invalid when it failed, both outside the verdict range', () => {
		const passed = exitCodeFor({ kind: 'preflight', passed: true }, LAX)
		const failed = exitCodeFor({ kind: 'preflight', passed: false }, LAX)
		expect(passed).toBe(EXIT_OK)
		expect(failed).toBe(EXIT_INVALID)
		expect(VERDICT_RANGE).not.toContain(passed)
		expect(VERDICT_RANGE).not.toContain(failed)
	})

	it('case 33: verdict is the one kind that reaches the verdict range', () => {
		expect(exitCodeFor(verdictOutcome('PASS'), LAX)).toBe(EXIT_OK)
		expect(exitCodeFor(verdictOutcome('FAIL'), LAX)).toBe(EXIT_FAIL)
	})

	it('case 34: structural-failure exits four, outside the verdict range', () => {
		const code = exitCodeFor({ kind: 'structural-failure' }, LAX)
		expect(code).toBe(EXIT_STRUCTURAL_FAILURE)
		expect(VERDICT_RANGE).not.toContain(code)
	})

	it('case 35: fault exits five, outside the verdict range', () => {
		const code = exitCodeFor({ kind: 'fault' }, LAX)
		expect(code).toBe(EXIT_FAULT)
		expect(VERDICT_RANGE).not.toContain(code)
	})

	it('case 36: usage-error exits sixty-four, outside the verdict range', () => {
		const code = exitCodeFor({ kind: 'usage-error' }, LAX)
		expect(code).toBe(EXIT_USAGE)
		expect(VERDICT_RANGE).not.toContain(code)
	})
})

describe('cli exit codes: four verdicts crossed with strict (cases 37-44)', () => {
	it('case 37: PASS without --strict exits zero', () => {
		expect(exitCodeFor(verdictOutcome('PASS'), LAX)).toBe(EXIT_OK)
	})

	it('case 38: PASS with --strict exits zero', () => {
		expect(exitCodeFor(verdictOutcome('PASS'), STRICT)).toBe(EXIT_OK)
	})

	it('case 39: WAIVED without --strict exits zero', () => {
		expect(exitCodeFor(verdictOutcome('WAIVED'), LAX)).toBe(EXIT_OK)
	})

	it('case 40: WAIVED with --strict exits zero, because --strict promotes CONCERNS alone', () => {
		expect(exitCodeFor(verdictOutcome('WAIVED'), STRICT)).toBe(EXIT_OK)
	})

	it('case 41: CONCERNS without --strict exits zero', () => {
		expect(exitCodeFor(verdictOutcome('CONCERNS'), LAX)).toBe(EXIT_OK)
	})

	it('case 42: CONCERNS with --strict is promoted to one', () => {
		expect(exitCodeFor(verdictOutcome('CONCERNS'), STRICT)).toBe(
			EXIT_CONCERNS_PROMOTED,
		)
	})

	it('case 43: FAIL without --strict exits two', () => {
		expect(exitCodeFor(verdictOutcome('FAIL'), LAX)).toBe(EXIT_FAIL)
	})

	it('case 44: FAIL with --strict still exits two', () => {
		expect(exitCodeFor(verdictOutcome('FAIL'), STRICT)).toBe(EXIT_FAIL)
	})
})

describe('cli exit codes: the evidence-condition carve-out (cases 45-46)', () => {
	it('case 45: a CONCERNS whose firing conditions are all evidence conditions is never promoted', () => {
		expect(exitCodeFor(verdictOutcome('CONCERNS', false), STRICT)).toBe(EXIT_OK)
		expect(exitCodeFor(verdictOutcome('CONCERNS', false), LAX)).toBe(EXIT_OK)
	})

	it('case 46: the same CONCERNS with a non-evidence condition firing is promoted under --strict', () => {
		expect(exitCodeFor(verdictOutcome('CONCERNS', true), STRICT)).toBe(
			EXIT_CONCERNS_PROMOTED,
		)
	})
})

describe('cli exit codes: the Invalid rung (Story 8.4)', () => {
	it('the Invalid rung exits three regardless of --strict, and reaches the verdict range on neither side', () => {
		expect(exitCodeFor(verdictOutcome(null), LAX)).toBe(EXIT_INVALID)
		expect(exitCodeFor(verdictOutcome(null), STRICT)).toBe(EXIT_INVALID)
		expect(VERDICT_RANGE).not.toContain(EXIT_INVALID)
	})
})

describe('cli exit codes: totality (cases 47-48)', () => {
	it('case 47: a kind outside the union falls off the ladder as undefined', () => {
		const outside = { kind: 'reticulate' } as unknown as CommandOutcome
		expect(exitCodeFor(outside, LAX) as number | undefined).toBeUndefined()
		expect(exitCodeFor(outside, STRICT) as number | undefined).toBeUndefined()
	})

	it('case 48: no outcome kind other than verdict ever returns 1 or 2', () => {
		for (const outcome of NON_VERDICT_OUTCOMES) {
			for (const options of [LAX, STRICT]) {
				const code = exitCodeFor(outcome, options)
				expect(
					VERDICT_RANGE,
					`${outcome.kind} with strict ${options.strict} returned ${code}`,
				).not.toContain(code)
			}
		}
	})
})
