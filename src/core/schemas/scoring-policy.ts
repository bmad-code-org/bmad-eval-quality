/** the published policy artifact the scorer reads its thresholds from. */
import { z } from 'zod'
import { Severity } from './eval-contract.ts'
import { lineageFields } from './lineage.ts'
import { Identifier } from './primitives.ts'

/**
 * A published artifact rather than constants, per the Consistency
 * Conventions, so "the default" has an identity a no-op edit cannot move.
 * No `.default()` anywhere: it would diverge the input- and output-mode
 * exports by dropping the key from `required` only in input mode. `strictMode`
 * and `corpusLocation` are deliberately absent: AD-14 fixes strict mode as a
 * CLI flag and AD-8 puts the corpus behind `CorpusPort`, so either would give
 * one concern two homes.
 */
export const ScoringPolicy = z
	.strictObject({
		...lineageFields,
		policyId: Identifier,
		severityFloor: Severity.describe(
			'AD-21 routes on this: a behavioural failure at or above the floor is FAIL and one below it is CONCERNS, and AD-7 makes it the one severity that constrains the dominance relation.',
		),
		confidenceThreshold: z
			.number()
			.min(0)
			.max(1)
			.describe(
				'The same closed unit interval a finding\'s `confidence` uses. AD-21\'s "a finding whose confidence falls below the policy threshold" compares the two, and two different scales would make that comparison meaningless.',
			),
		catchThreshold: z
			.number()
			.min(0)
			.max(1)
			.describe(
				'AD-7\'s trial-set reducer: a probe counts as caught only when its caught-trial count is strictly greater than this fraction of its valid-trial count, so an exact tie never counts as caught. The published default artifact carries 0.5, the pre-registered "at least two catches in three valid repetitions" read at a valid count of three. No `.default()`, on the same reasoning `confidenceThreshold` gives.',
			),
		minimumTrialCount: z
			.int()
			.min(1)
			.describe(
				'AD-6: repeated runs are trials, never retries. The published default artifact carries 3, "because that is what the instrument behind the measured effect used"; that number is recorded here and is deliberately not a schema default.',
			),
		reExecutionCap: z
			.int()
			.min(0)
			.describe(
				'AD-6: exceeding the cap resolves under AD-21 as a statement that the harness is unfit, never that the contract is weak. The published default artifact carries 2.',
			),
		remediationCap: z
			.int()
			.min(0)
			.describe(
				"AD-12's remediation cap. The published default artifact carries 3. AD-12 states the package validates rather than enforces it, which is why the Evidence Artifact records the cap's source as caller-attested.",
			),
		regexMatchStepBudget: z
			.int()
			.min(1)
			.describe(
				'AD-4: "a match-step budget from the scoring policy whose breach is a fault, not an outcome ' +
					'state." The budget bounds a pure, static, pre-execution complexity estimate over the ' +
					'declared pattern and the candidate string length, never a literal engine-internal step ' +
					'count, and that length is whatever the system under test returned, which the contract ' +
					'author does not control. The structural nested-quantifier rejection stays unconditional ' +
					'and independent of this value, so a generous ceiling here does not weaken that real ' +
					'backstop. The published default artifact carries 1000000.',
			),
	})
	.meta({
		id: 'ScoringPolicy',
		description:
			'The scoring policy, with no prior art. It carries the severity floor, confidence threshold, catch threshold, minimum trial count, re-execution cap, remediation cap, and a regex match-step budget that AD-6, AD-7, AD-12, AD-4, and AD-21 read, and its digest is one of the six named inputs to AD-11\'s scoring version. It is a published artifact rather than a set of constants so that "the default" has an identity a result can name by digest.',
	})

export type ScoringPolicy = z.infer<typeof ScoringPolicy>
