/** AD-21's four verdicts and AD-24's closed evaluator recommendation. */
import { z } from 'zod'

/**
 * AD-21's four, uppercase. Every other enumeration in this package is lowercase
 * kebab-case; the verdicts and the HTTP method are the two exceptions the
 * Consistency Conventions name.
 */
export const VERDICTS = ['PASS', 'WAIVED', 'CONCERNS', 'FAIL'] as const

export const Verdict = z.enum(VERDICTS).meta({
	id: 'Verdict',
	description:
		"AD-21's four verdicts. Uppercase is one of the two named exceptions to the lowercase kebab-case enum convention. Exit codes are AD-21's and belong to the CLI rather than to this value: PASS, WAIVED, and CONCERNS exit zero and FAIL exits two.",
})

/**
 * AD-24 requires a closed enum for the evaluator's own recommendation. It is
 * the verdict vocabulary minus `WAIVED`, so it reuses the uppercase exception
 * instead of adding a third one. The prior art's `NOT_APPLICABLE` does not
 * survive: it was legal only for the `scripted` condition arm, which has no
 * successor in this architecture.
 */
export const EVALUATOR_RECOMMENDATIONS = ['PASS', 'CONCERNS', 'FAIL'] as const

export const EvaluatorRecommendation = z.enum(EVALUATOR_RECOMMENDATIONS).meta({
	id: 'EvaluatorRecommendation',
	description:
		"The evaluator's own recommendation, ingested and never promoted to a verdict in contract-scoring mode. AD-24 requires a closed enum; the prior art's `NOT_APPLICABLE` is dropped with the `scripted` arm it belonged to. Consequence recorded here because it closes a rung: AD-21's Invalid condition for \"an unrecognised evaluator recommendation value\" is unreachable for a schema-valid artifact, since an unrecognised value fails to parse and becomes an AD-28 `schema-parse-failure` fault, and a fault never becomes a verdict. The Epic 6 ingest story either validates this field leniently and maps an unrecognised value to that rung, or accepts that the rung fires only as a fault.",
})
