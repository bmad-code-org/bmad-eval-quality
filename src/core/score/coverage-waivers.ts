/**
 * AD-5 waivers applied to AD-31 coverage gaps. A waiver names one AD-20
 * discipline rule; `CoverageGap.rule` uses the same opaque spellings
 * (`core/coverage/rules.ts`), so the two join on that string.
 *
 * `core/` reads no clock (AD-1), so the scoring instant arrives as an
 * argument. A waiver applies while its `expiresAt` is strictly after that
 * instant; at or past it the waiver has expired and its gap is reinstated,
 * which is AD-21's own rule.
 *
 * `condition` is recorded and not evaluated. AD-5 asks for a
 * machine-checkable condition "where one exists", and the contract format
 * defines no condition language yet, so the field is free prose this stage
 * cannot test. Treating an unevaluable condition as unmet would make every
 * conditioned waiver inert; treating it as met is the reading the waiver's
 * recorded approval already vouches for.
 */
import type { EvalContract } from '../schemas/eval-contract.ts'
import type { CoverageGap } from '../schemas/evidence-artifact.ts'

type Waiver = EvalContract['waivers'][number]

/** `Rfc3339Utc` values in milliseconds since the epoch; parsing is not a clock read. */
const instantOf = (timestamp: string): number => {
	const millis = Date.parse(timestamp)
	if (Number.isNaN(millis)) {
		throw new TypeError(
			`applyCoverageWaivers(): "${timestamp}" is not an RFC 3339 timestamp`,
		)
	}
	return millis
}

/**
 * Each unsatisfied gap takes the first complete, unexpired waiver, in contract order,
 * whose `rule` names it. A satisfied gap never takes one: there is nothing
 * to excuse. Gaps arrive and leave in the same order.
 */
export function applyCoverageWaivers(
	gaps: readonly CoverageGap[],
	waivers: readonly Waiver[],
	scoredAt: string,
): readonly CoverageGap[] {
	const now = instantOf(scoredAt)
	// Only a complete waiver applies. `compile` refuses an incomplete one as
	// `waiver-incomplete`, but `score` also accepts contracts that never went
	// through `compile`, so the AD-5 parts are re-read here.
	const inForce = waivers.filter(
		(waiver) =>
			waiver.rule !== null &&
			waiver.rationale !== null &&
			waiver.approval !== null &&
			waiver.expiresAt !== null &&
			instantOf(waiver.expiresAt) > now,
	)
	return gaps.map((gap) => {
		if (gap.satisfied) return { ...gap, waiverId: null }
		const waiver = inForce.find((candidate) => candidate.rule === gap.rule)
		return { ...gap, waiverId: waiver?.id ?? null }
	})
}
