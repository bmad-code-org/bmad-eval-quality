/** the Eval Contract: every declaration AD-19 requires, in one shape. */
import { z } from 'zod'
import { PermittedInterface } from './interface.ts'
import { Oracle } from './oracle.ts'
import { InteractionStep } from './plan.ts'
import {
	BehaviorId,
	Digest,
	Identifier,
	KeyName,
	OracleId,
	UnsignedDecimalString,
} from './primitives.ts'
import { ReferenceSetDeclaration } from './reference-set.ts'
import { RubricBody } from './rubric.ts'
import { Waiver } from './waiver.ts'

/**
 * Consistency Conventions: external requirement and risk linkage is an opaque
 * caller-supplied string paired with its scheme, so the entries are objects
 * rather than bare identifiers.
 */
export const ExternalLink = z.strictObject({
	scheme: z.string().min(1),
	id: z.string().min(1),
})

/**
 * Coin flip (c), settled: linkage lives per behaviour. The code decides it —
 * `missing-requirement-linkage` fires when "a behaviour declares no requirement
 * or risk identifier", and a contract-level array cannot make that predicate
 * decidable per behaviour. The Gate C fixture's contract-level `linkage` array
 * does not survive.
 */
export const Behavior = z.strictObject({
	id: BehaviorId,
	description: z.string(),
	severity: z.enum(['low', 'material', 'critical']),
	observableSuccessCriterion: z
		.string()
		.nullable()
		.describe(
			'AD-19: what observable condition means this behaviour was met, which is not the nominated success indicator of any one operation. `null` is the shape `no-observable-success-criterion` fires on, and that code fires on exactly this condition and never on an empty oracle list.',
		),
	requirementLinks: z
		.array(ExternalLink)
		.describe(
			'Coin flip (c), settled: requirement and risk linkage lives per behaviour rather than at contract level, because `missing-requirement-linkage` fires when "a behaviour declares no requirement or risk identifier" and a contract-level array cannot make that predicate decidable per behaviour. Empty is legal, and both link arrays empty is exactly what the code fires on; a schema demanding non-empty makes it fire never.',
		),
	riskLinks: z.array(ExternalLink),
	oracles: z
		.array(OracleId)
		.describe(
			"Identifiers of the oracles this behaviour is discharged by. Deliberately not refined against the contract's declared oracles: no AD-5 code names a behaviour citing an undeclared oracle, so under AC 8's named exception that rule is unenforced in v0 rather than silently pushed into the schema.",
		),
})

/**
 * AD-16's scoped resource references. AD-19's declaration list omits them,
 * AD-16 puts them on the sealed brief, and `scoped-reference-resolves-forbidden`
 * fires on one, so a contract with no place for them makes that code
 * unreachable. Both fields are opaque: no AD supplies a value space for `kind`,
 * and inventing one here is the unshaped-declaration defect in reverse.
 */
export const ScopedResource = z.strictObject({
	reference: z.string().min(1),
	kind: z.string().min(1),
})

/** AD-16's mandatory floor, closed at the prior art's seven members. */
export const FORBIDDEN_INPUT_FLOOR = [
	'original-spec',
	'source-code',
	'repository',
	'builder-transcript',
	'implementation-logs',
	'comparator-results',
	'human-labels',
] as const

export const ForbiddenInput = z.enum(FORBIDDEN_INPUT_FLOOR)

/**
 * A sibling group's minimum membership. AD-19 permits "an explicit empty
 * sibling group", which is read here as the empty group *list*: a group of one
 * has no sibling to cross-check against, so it cannot make AD-20 rule 5
 * relevant, while `[]` is the explicit answer that makes a genuinely
 * sibling-free contract decidably clean.
 */
export const SIBLING_GROUP_MINIMUM = 2

export const SiblingGroups = z.strictObject({
	operations: z.array(z.array(Identifier).min(SIBLING_GROUP_MINIMUM)),
	parameters: z.array(z.array(KeyName).min(SIBLING_GROUP_MINIMUM)),
})

export const TestData = z.strictObject({
	setup: z.string().nullable(),
	cleanup: z.string().nullable(),
})

export const Budgets = z.strictObject({
	maxToolCalls: z.int().min(0),
	maxWallClockMinutes: z.int().min(0),
	maxCostUsd: UnsignedDecimalString.describe(
		'Money, so AD-36 carries it as a string in a declared format rather than as a JSON number. Constrained to the unsigned form: a negative ceiling is not a ceiling.',
	),
})

export const EvalContract = z
	.strictObject({
		schemaVersion: z
			.int()
			.min(1)
			.describe(
				'AD-11 requires an integer under this exact name. Deliberately not `z.literal(1)`: the literal exports as `{"type":"number","const":1}`, losing `integer` for a non-TypeScript consumer, and it would turn a version-2 artifact into an anonymous schema-parse failure instead of AD-28\'s dedicated `schema-version-mismatch` fault. Version equality belongs to the reader that throws that fault.',
			),
		contractId: Identifier,
		parentDigest: Digest.nullable().describe(
			'AD-29 lineage. `null` if and only if `revisionCount` is 0. That biconditional is stated here rather than refined: a refinement is silently dropped from the published schema, so a non-TypeScript consumer would never see it, and the constraint ledger records it as not expressible.',
		),
		revisionCount: z
			.int()
			.min(0)
			.describe("AD-29: one greater than the parent artifact's."),
		sourceSpecDigest: Digest.nullable().describe(
			'AD-18 permits a digest where the content is forbidden, so the contract may name the specification it was authored against without carrying it.',
		),
		behaviors: z
			.array(Behavior)
			.min(1)
			.describe(
				'US spelling, matching the prior art and both hand-authored contracts. A contract with no behaviour declares nothing to evaluate.',
			),
		oracles: z
			.array(Oracle)
			.describe(
				'No minimum. AD-19 is explicit that `no-observable-success-criterion` "never fires on an empty oracle list", so an empty list must parse.',
			),
		rubrics: z
			.array(RubricBody)
			.describe('Empty is legal: a zero-rubric contract compiles clean.'),
		waivers: z.array(Waiver),
		permittedInterfaces: z
			.array(PermittedInterface)
			.describe(
				'AD-35: logical identifiers only. No entry here is ever a URL, a host, or a port.',
			),
		referenceSets: z
			.record(Identifier, ReferenceSetDeclaration)
			.nullable()
			.describe(
				'Caller-keyed by reference-set identifier. AD-31 grades an absent declaration and an explicit empty one differently, so `null`, `{}`, and a populated map are three distinct answers.',
			),
		siblingGroups: SiblingGroups.nullable().describe(
			'AD-20 rule 5 relevance reads this. `null` is absent, `{ "operations": [], "parameters": [] }` is the explicit empty answer AD-19 calls a declaration, and a populated group makes the rule relevant.',
		),
		interactionPlan: z
			.array(InteractionStep)
			.describe(
				'No maximum and no bound on `after` chains. `plan-exceeds-scripting-bound` needs the sixty-four-pair and eight-chain plans representable, and Story 4.3 owns the graph predicate. An empty plan is the cheapest `unreachable-check-evidence` fixture.',
			),
		scopedResources: z
			.array(ScopedResource)
			.nullable()
			.describe(
				'Absent, empty, and populated are three distinct answers. A reference at all is what `scoped-reference-resolves-forbidden` fires on.',
			),
		forbiddenInputs: z
			.array(ForbiddenInput)
			.describe(
				'A list short of the seven is `forbidden-input-floor-incomplete`, a coded compile-time error, so a short list must parse.',
			),
		testData: TestData,
		budgets: Budgets,
		safetyLimits: z.array(z.string()),
		requiredEvidence: z.array(z.string()),
		probeStepBound: z
			.int()
			.min(0)
			.nullable()
			.describe(
				"AD-16's declared bound on enumerated probe steps, which the brief-side scripting audit reads. No AD gives it a home and the Configuration convention's policy-artifact list omits it, so it lands here beside the other ceilings. The AD-5 code that audit fires is Epic 2's to mint alongside its only thrower.",
			),
	})
	.meta({
		id: 'EvalContract',
		description:
			"The Eval Contract. Succeeds the prior-art `eval-contract` schema per AD-24. It carries every declaration AD-19 requires so that AD-31's fourteen relevance and satisfaction predicates are decidable from declarations alone. Sensitivity witnesses (AD-10) are deliberately absent in this version; adding them is an additive `schemaVersion` bump under AD-11, recorded in the field's own description when it arrives.",
	})

export type EvalContract = z.infer<typeof EvalContract>
