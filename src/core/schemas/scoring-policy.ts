/** the published policy artifact the scorer reads its thresholds from. */
import { z } from 'zod'
import { Severity } from './eval-contract.ts'
import { lineageFields } from './lineage.ts'
import { Identifier } from './primitives.ts'

/**
 * No prior art. A published artifact instead of constants in a function,
 * because the Consistency Conventions are explicit: "the default policy ships
 * as a published artifact referenced by digest rather than as constants in a
 * function, so 'the default' has an identity and a no-op edit cannot move a
 * scoring version."
 *
 * This shape carries no `.default()` and no default value anywhere. The
 * defaults AD-6 and AD-12 name are recorded in the field descriptions as what
 * the published default artifact carries. Putting them in the schema would give
 * "the default" a second home with no digest, and `.default()` also diverges
 * the input-mode and output-mode exports by dropping the key from `required` in
 * input mode only.
 *
 * `strictMode` and `corpusLocation` are not fields here. The Conventions list
 * them alongside the policy as "explicit arguments **or** an explicit policy
 * artifact"; AD-14 fixes strict mode as a CLI flag and AD-8 puts the corpus
 * behind `CorpusPort`, so adding either here would give one concern two homes.
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
			'The scoring policy, with no prior art. It carries the severity floor, confidence threshold, minimum trial count, re-execution cap, remediation cap, and a regex match-step budget that AD-6, AD-12, AD-4, and AD-21 read, and its digest is one of the five named inputs to AD-11\'s scoring version. It is a published artifact rather than a set of constants so that "the default" has an identity a result can name by digest.',
	})

export type ScoringPolicy = z.infer<typeof ScoringPolicy>
