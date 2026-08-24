/** the evaluator's own configuration, digested into the scoring version. */
import { z } from 'zod'
import { Budgets } from './eval-contract.ts'
import { lineageFields } from './lineage.ts'
import { Digest, JsonObjectValue } from './primitives.ts'

/**
 * AD-17's judge configuration. `modelSnapshot` is required and non-nullable
 * here because the no-judge state is spelled once, as `null` on
 * `judgeConfiguration` itself; letting this field be `null` too would create a
 * second, indistinguishable way to say "no judge". `systemPromptDigest` stays
 * nullable: a judge invoked with no system prompt of its own is still
 * configured.
 */
export const JudgeConfiguration = z.strictObject({
	modelSnapshot: z.string().min(1),
	systemPromptDigest: Digest.nullable().describe(
		'`null` for a judge configured with no system prompt of its own. This is the only nullable member: the absent-judge state belongs to the field above, not to this shape.',
	),
})

export const EvaluatorConfiguration = z
	.strictObject({
		...lineageFields,
		sealedBriefDigest: Digest,
		evaluatorIdentity: z
			.string()
			.min(1)
			.describe(
				'Opaque, and named so by AD-24. AD-18 excludes credentials, tokens, real names, email addresses, account identifiers, and transaction content from every artifact; no schema over an opaque string enforces that, so the prohibition is stated and recorded in the constraint ledger as not expressible.',
			),
		modelSnapshot: z.string().min(1),
		systemPromptDigest: Digest,
		decodingParameters: JsonObjectValue.describe(
			"AD-24's \"decoding and sampling parameters\", carried in the value container under the caller's own keys rather than as a minted enum of temperature and top-p. AD-2 forbids provider or model SDK knowledge in this package, so a closed parameter vocabulary would be knowledge the package is not allowed to have. `JsonObjectValue` sits inside AD-36's value domain, which matters because this artifact's digest enters the scoring version. One field, not two: \"decoding and sampling parameters\" is one concern under two words, and splitting it would draw a boundary no AD draws. Caller-keyed, but inside the value container rather than a control map, so it does not join the Conventions' caller-keyed list.",
		),
		toolInventory: z
			.array(z.string())
			.describe(
				'AD-18 binds this field and `permissionInventory` hardest: a tool and permission inventory is exactly where a caller would paste an API key. The prohibition is not expressible over opaque strings and is recorded in the ledger.',
			),
		permissionInventory: z.array(z.string()),
		budgets: Budgets,
		seed: z
			.int()
			.nullable()
			.describe(
				'AD-24\'s "seed where supported". "Where supported" is spelled `null`; an omitted key is not the convention.',
			),
		judgeConfiguration: JudgeConfiguration.nullable().describe(
			'`null` where no judge is configured, which is the ordinary case for a contract declaring no rubric.',
		),
	})
	.meta({
		id: 'EvaluatorConfiguration',
		description:
			'The evaluator\'s configuration, a first-class published artifact with no prior art. AD-24 fixes its field list: the sealed-brief digest, opaque evaluator identity, model snapshot, system-prompt digest, decoding and sampling parameters, tool and permission inventory, budgets, seed where supported, and judge configuration, "with the trial index deliberately excluded so trials pool into one scoring version". That exclusion is a requirement rather than an omission: because this object is strict, a `trialIndex` key fails with `unrecognized_keys` at the root, and a test asserts exactly that. The trial index lives on the Sealed Run Record instead. Ingest computes this artifact\'s digest and invalidates the run when it is absent or incomplete.',
	})

export type EvaluatorConfiguration = z.infer<typeof EvaluatorConfiguration>
