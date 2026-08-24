/** the per-run isolation audit, and the forbidden-input accounting AD-16 adds. */
import { z } from 'zod'
import { FORBIDDEN_INPUT_FLOOR, type ForbiddenInput } from './eval-contract.ts'
import { lineageFields } from './lineage.ts'
import {
	Digest,
	Identifier,
	PositiveDecimalString,
	UnsignedDecimalString,
} from './primitives.ts'

/**
 * The harness's record of what it actually enforced, deliberately not
 * `Budgets`: `Budgets` is the contract's three-key declared ceiling that AD-16
 * puts on the brief so the caller knows what it may spend, while this carries
 * the two token counts the contract never declares. One shape for both would
 * conflate a declaration with an observation.
 */
export const ResourceCeilings = z.strictObject({
	maxToolCalls: z.int().min(1),
	maxInputTokens: z.int().min(1),
	maxOutputTokens: z.int().min(1),
	maxWallClockMinutes: z
		.number()
		.gt(0)
		.describe(
			"The prior art's `exclusiveMinimum: 0`, kept. A ceiling of zero minutes is not a ceiling, it is a run that may not happen, and the manifest records what the harness actually enforced.",
		),
	maxCostUsd: PositiveDecimalString.describe(
		"Money, so AD-36 carries it as a string. The prior art's number does not survive; an AD-24 divergence, and the reason Decision 18's universal value domain converts the manifest too and not only the run record. The retyping keeps the prior art's `exclusiveMinimum: 0` rather than dropping it: `UnsignedDecimalString` would admit \"0\", which is the bound the prior art spent a keyword excluding.",
	),
})

/** the prior art's five-member actual-use record, with money as a string. */
export const ActualResourceUse = z.strictObject({
	toolCalls: z.int().min(0),
	inputTokens: z.int().min(0),
	outputTokens: z.int().min(0),
	wallClockSeconds: z.number().min(0),
	costUsd: UnsignedDecimalString,
})

/**
 * AD-16 requires the manifest to "account for each forbidden input by name".
 * `withheld: false` must parse: a prohibited input is an invalidating condition
 * at ingest, never a parse failure.
 */
export const ForbiddenInputAccounting = z.strictObject({
	withheld: z.boolean(),
	note: z.string().nullable(),
})

// Generated from FORBIDDEN_INPUT_FLOOR, the same reason the constraint ledger
// generates its arity entries from TUPLE_ARITY: a hand-written second list is
// drift waiting to happen, and AD-16 makes an incomplete floor a coded
// compile-time failure because the list has one home.
//
// Declared after the shape it references and cast so the seven literal keys
// survive into `z.infer`: `Object.fromEntries` alone widens to an index
// signature, which would stop a typed accept fixture from catching a missing
// member.
const accountingShape = Object.fromEntries(
	FORBIDDEN_INPUT_FLOOR.map((member) => [member, ForbiddenInputAccounting]),
) as Record<ForbiddenInput, typeof ForbiddenInputAccounting>

/**
 * A strict object rather than `z.record(ForbiddenInput, …)`: the record does
 * demand every enum member at parse time, but only as TypeScript behaviour.
 * Its export carries `propertyNames` plus a schema-valued
 * `additionalProperties` but never a `required` array, so the constraint
 * would be invisible to the non-TypeScript consumer AD-13 protects, the same
 * reasoning behind `RequestShape`'s four-key object.
 */
export const ForbiddenInputAccountingMap = z.strictObject(accountingShape)

export const IsolationManifest = z
	.strictObject({
		...lineageFields,
		runId: z.string().min(1),
		contractId: Identifier.describe(
			'The prior art\'s `taskId`, renamed. "Task" is experiment vocabulary with no product meaning, and the manifest keeps an identifier because it is the artifact `core/ingest` matches against a run; the run record and the probe pin what they describe by digest instead.',
		),
		conditionArm: z
			.string()
			.min(1)
			.describe(
				"An opaque caller label with no product semantics, per AD-24. The prior art's three-member enum does not survive, on the same reasoning as the run record's.",
			),
		modelSnapshot: z.string().min(1),
		systemPromptDigest: Digest,
		contractDigest: Digest,
		evaluatorConfigurationDigest: Digest.describe(
			'Added by this story and absent from the prior art. AD-32 requires this digest to agree between the manifest and the run record, which was previously an agreement rule asserted over two fields that did not exist. Required and non-nullable on both, which is what makes the substitution cost two contradictions rather than one omission. The agreement itself is a cross-artifact rule no schema can see.',
		),
		workspaceIdentity: z.string().min(1),
		allowedMounts: z.array(z.string()),
		observedMounts: z
			.array(z.string())
			.describe(
				'Observed mounts, network targets, and tool calls exceeding their allowlist is a violation AD-16 has `core/ingest` record; it is a cross-field rule with no AD-5 code and the schema admits it.',
			),
		networkAllowlist: z.array(z.string()),
		observedNetworkTargets: z.array(z.string()),
		toolAllowlist: z.array(z.string()),
		observedToolCalls: z.array(z.string()),
		resourceCeilings: ResourceCeilings,
		actualResourceUse: ActualResourceUse,
		forbiddenInputAccounting: ForbiddenInputAccountingMap.describe(
			'The field AD-16 adds and the prior art lacks: "the isolation manifest\'s required fields … account for each forbidden input by name". Seven keys, generated from `FORBIDDEN_INPUT_FLOOR` so the floor has one home.',
		),
		violation: z
			.string()
			.nullable()
			.describe(
				"The sixteenth of the prior art's sixteen required members, and the one that is not a description of the run: a non-null violation invalidates it. AD-16 says the schema is \"seeded from the prior art's fifteen\"; the prior art's `required` array has sixteen. Settled by construction: the fifteen are the fields describing the run and this is the invalidation outcome. All sixteen are carried.",
			),
	})
	.meta({
		id: 'IsolationManifest',
		description:
			"The per-run isolation audit. Succeeds the prior-art `isolation-manifest` schema per AD-24, carrying all sixteen of its required members plus `evaluatorConfigurationDigest`, `forbiddenInputAccounting`, and AD-29's lineage; `taskId` becomes `contractId`, `condition` is demoted to an opaque `conditionArm`, and money in both resource shapes becomes a decimal string. An absent, unparseable, incomplete, or violating manifest invalidates the run under AD-16 and never downgrades a verdict; a schema rejection is the correct expression of unparseable and incomplete, so nothing is admitted for their sake, and the violating case is `core/ingest`'s.",
	})

export type IsolationManifest = z.infer<typeof IsolationManifest>
