/** the constraints the published JSON Schema cannot carry unaided. */
import {
	INTERCHANGE_ARTIFACTS,
	type InterchangeArtifactKey,
} from './artifact.ts'
import { TUPLE_ARITY } from './expression.ts'
import { BINDING_CHANNEL_NON_EMPTY } from './plan.ts'
import type { JsonValue } from './primitives.ts'

/**
 * The JSON Schema dialect an injected keyword belongs to. Named rather than
 * assumed, because the same keyword means different things across dialects and
 * one of them fails silently and totally: `items: false` bounds a tuple only
 * beside 2020-12's `prefixItems`, while under draft-7 a tuple exports as
 * `items: [...]`, so injecting `items: false` there overwrites the tuple and
 * every operand list in the published schema rejects everything. Story 1.5
 * chooses the export target and reads this before injecting.
 */
export type JsonSchemaDialect = 'draft-2020-12'

/**
 * What Story 1.5 does with an entry: either inject these JSON Schema keywords
 * at the named location, or record that the constraint is not expressible and
 * why. There is no third disposition, because a constraint with neither is a
 * constraint nobody is accountable for.
 */
export type ConstraintDisposition =
	| {
			readonly kind: 'inject'
			readonly dialect: JsonSchemaDialect
			readonly keywords: Readonly<Record<string, JsonValue>>
	  }
	| { readonly kind: 'not-expressible'; readonly reason: string }

/**
 * Where in the exported document the entry applies. Zod emits no `$id` and
 * puts the root schema inline rather than in `$defs`, so "the artifact itself"
 * and "a shared definition" are two different addresses and the difference has
 * to be structural. Spelling both as a name would leave Story 1.5 needing
 * out-of-band knowledge to resolve one of them, which is the defect this
 * address exists to remove.
 *
 * Every address names its `artifact`. That was omissible while `EvalContract`
 * was the only root. With twelve roots it is not: Story 1.5 resolves an entry
 * by its stated address and never by searching, so the moment two artifacts
 * carried the same rule the resolution would silently pick the wrong document.
 * Story 1.5 reads `location.artifact` to choose one.
 *
 * This module imports `artifact.ts` and therefore sits downstream of all twelve
 * schema modules, so no module under `src/core/schemas/` may import this file.
 * The existing direction is the correct one, with `plan.ts` exporting
 * `BINDING_CHANNEL_NON_EMPTY` to the ledger. A future author reaching the other
 * way for a stable identifier closes the loop and breaks module load for every
 * artifact.
 */
export type ConstraintLocation =
	| { readonly kind: 'root'; readonly artifact: InterchangeArtifactKey }
	| {
			readonly kind: 'definition'
			readonly artifact: InterchangeArtifactKey
			readonly name: string
	  }

export type ConstraintLedgerEntry = {
	/** stable identifier; Story 1.5 cites this, never the prose. */
	readonly id: string
	readonly location: ConstraintLocation
	/**
	 * Where the shape exports as a discriminated union, the `op` const of the
	 * branch this entry addresses. Named by discriminator rather than by index,
	 * so reordering the union cannot silently move an entry onto another branch.
	 */
	readonly branch: string | null
	/** the property within that shape or branch, or null when the shape itself carries it. */
	readonly field: string | null
	readonly statement: string
	readonly disposition: ConstraintDisposition
}

// Verified on the pin: z.tuple([a, b]) exports `prefixItems` alone — no
// minItems, no maxItems, no items — so the published schema accepts the
// one-operand and three-operand `equality` that Zod rejects. Arity is the one
// deliberate exception to the admit-rule and is therefore the one place the
// export has to be repaired rather than relaxed.
const arityEntries: readonly ConstraintLedgerEntry[] = Object.entries(
	TUPLE_ARITY,
).map(([op, arity]) => ({
	id: `operator-arity-${op}`,
	location: {
		kind: 'definition',
		artifact: 'eval-contract',
		name: 'Expression',
	},
	branch: op,
	field: 'operands',
	statement: `\`${op}\` takes exactly ${arity} operand${arity === 1 ? '' : 's'}.`,
	disposition: {
		kind: 'inject',
		dialect: 'draft-2020-12',
		keywords: { minItems: arity, items: false },
	},
}))

/**
 * AD-4 requires each operator to declare its operand types in the published
 * schema. Arity is structural and repaired by the entries above; per-position
 * operand *types* cannot be, because narrowing a position would delete
 * `malformed-operator-expression`'s operand-type limb along with the fixture
 * Story 4.2 owes for it. The declaration therefore lives in the description on
 * each operator's `operands`, which survives the export, and the enforcement is
 * Epic 4's. Recorded here so the split is a decision rather than an omission.
 */
const operandTypeEntry: ConstraintLedgerEntry = {
	id: 'operator-operand-types',
	location: {
		kind: 'definition',
		artifact: 'eval-contract',
		name: 'Expression',
	},
	branch: null,
	field: null,
	statement:
		'Each operator admits only certain operand forms in each position (AD-4). The legality is declared per branch in text and enforced by the compiler.',
	disposition: {
		kind: 'not-expressible',
		reason:
			"Narrowing a tuple position in the schema would convert AD-26's \"a reference-set operand in any position other than the three named above fails under `malformed-operator-expression`\" into an anonymous schema-parse failure, deleting that code's operand-type limb. AD-4 still requires the types to be *expressed* in the published schema, and a ledger entry is not an expression, so each branch's `operands` carries the legality in its description — the same treatment AD-36's numeric domain gets on JsonValue. Consequence for Epic 4: the operand-type limb of `malformed-operator-expression` is entirely its own, with no schema-side partial coverage to rely on.",
	},
}

// One entry per lineage-bearing artifact, so eleven and not twelve. The
// registry's `carriesLineage` flag is the filter, and `ArtifactReference`
// carries no `parentDigest` for the address to resolve against. Generated from
// the registry the way the arity entries are generated from `TUPLE_ARITY`,
// because a hand-written twelfth entry is a bug and a hand-written eleven is
// drift.
//
// Two of the eleven are union-rooted: `Probe` on `expectedClean` and
// `EvidenceArtifact` on `mode`. A union root exports
// `{ $schema, oneOf, description }` with no `properties` object. The resolver
// that walks these addresses therefore needs a union fallback that requires the
// field in every branch, which is what the entry means: the lineage fields are
// spread into each branch, so the biconditional binds both.
const lineageEntries: readonly ConstraintLedgerEntry[] = Object.entries(
	INTERCHANGE_ARTIFACTS,
)
	.filter(([, entry]) => entry.carriesLineage)
	.map(([key]) => ({
		id: `lineage-${key}`,
		location: { kind: 'root', artifact: key as InterchangeArtifactKey },
		branch: null,
		field: 'parentDigest',
		statement:
			'`parentDigest` is null if and only if `revisionCount` is 0 (AD-29).',
		disposition: {
			kind: 'not-expressible',
			reason:
				'A cross-field rule. Encoding it as a Zod refinement would make it invisible to every non-TypeScript consumer and turn it into a Story 1.5 differential disagreement, so it is stated in the field description instead and left to the reader that validates a presented chain.',
		},
	}))

// AD-18's prohibition, on the two artifacts it binds hardest. Neither is
// expressible: both carry opaque caller strings, and no pattern separates an
// opaque handle from a credential pasted into one.
const secretsProhibitionEntries: readonly ConstraintLedgerEntry[] = (
	[
		[
			'private-artifact-manifest',
			'A private-artifact manifest never contains a private path, credential, or domain value (AD-18).',
		],
		[
			'evaluator-configuration',
			'An evaluator configuration carries no credential, token, real name, email address, account identifier, or transaction content in its identity, its tool inventory, its permission inventory, or its decoding parameters (AD-18).',
		],
	] as const
).map(([artifact, statement]) => ({
	id: `secrets-prohibition-${artifact}`,
	location: { kind: 'root', artifact },
	branch: null,
	field: null,
	statement,
	disposition: {
		kind: 'not-expressible',
		reason:
			'The fields this binds are opaque caller strings by AD-8 and AD-24, and no schema over an opaque string distinguishes a resolvable handle from a secret pasted into one. Expressing it would require a pattern that also rejects legitimate opaque references. It is stated in each artifact description and enforced by review and by the AD-18 publication guard, which is a mechanism rather than a schema.',
	},
}))

export const CONSTRAINT_LEDGER: readonly ConstraintLedgerEntry[] = [
	...arityEntries,
	{
		id: BINDING_CHANNEL_NON_EMPTY,
		location: {
			kind: 'definition',
			artifact: 'eval-contract',
			name: 'InputBindingChannel',
		},
		branch: null,
		field: null,
		statement:
			'A declared input-binding channel names at least one parameter. An unbound channel is `null`, never `{}`. Inject at the definition root: `minProperties` is ignored on a non-object instance, so it constrains the object branch and leaves the null branch alone.',
		disposition: {
			kind: 'inject',
			dialect: 'draft-2020-12',
			keywords: { minProperties: 1 },
		},
	},
	{
		id: 'json-value-numeric-domain',
		location: {
			kind: 'definition',
			artifact: 'eval-contract',
			name: 'JsonValue',
		},
		branch: null,
		field: null,
		statement:
			'Every number is a finite binary64 value and every integer lies in the safe-integer range (AD-36).',
		disposition: {
			kind: 'not-expressible',
			reason:
				"JSON Schema cannot express finiteness, and re-walking the value container in Zod would buy nothing an export can carry — Story 1.2's lexical scanner already rejects 1e999 and unsafe integers before any parse. AD-36 requires the restriction to be *expressed* in the published schema and a ledger entry is not an expression, so the domain statement lives in JsonValue's own description, which lands once on the shared definition. Consequence for Story 1.5: its differential check must not generate non-finite or unsafe-integer literals inside JsonValue and call the result a disagreement.",
		},
	},
	operandTypeEntry,
	...lineageEntries,
	...secretsProhibitionEntries,
]

export const constraintLedgerEntry = (
	id: string,
): ConstraintLedgerEntry | undefined =>
	CONSTRAINT_LEDGER.find((entry) => entry.id === id)
