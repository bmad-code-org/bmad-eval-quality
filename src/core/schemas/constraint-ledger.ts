/** the constraints the published JSON Schema cannot carry unaided. */
import {
	INTERCHANGE_ARTIFACTS,
	type InterchangeArtifactKey,
} from './artifact.ts'
import { PROBE_BINDING_CHANNEL_NON_EMPTY } from './defect-signature.ts'
import { TUPLE_ARITY } from './expression.ts'
import { BINDING_CHANNEL_NON_EMPTY } from './plan.ts'
import type { JsonValue } from './primitives.ts'
import { OBSERVATION_SEQUENCE_UNIQUE } from './sealed-run-record.ts'

/**
 * The JSON Schema dialect an injected keyword belongs to. Named rather than
 * assumed: `items: false` bounds a tuple only beside 2020-12's `prefixItems`,
 * but under draft-7 a tuple exports as `items: [...]`, so the same injection
 * there overwrites the tuple and every operand list rejects everything.
 * `publish.ts` reads this before injecting.
 */
export type JsonSchemaDialect = 'draft-2020-12'

/** No third disposition: an entry with neither is a constraint nobody is accountable for. */
export type ConstraintDisposition =
	| {
			readonly kind: 'inject'
			readonly dialect: JsonSchemaDialect
			readonly keywords: Readonly<Record<string, JsonValue>>
	  }
	| { readonly kind: 'not-expressible'; readonly reason: string }

/**
 * Where in the exported document the entry applies. Zod inlines the root
 * schema and emits no `$id`, so "the artifact itself" and "a shared
 * definition" are structurally different addresses, not just two names.
 *
 * Every address names its `artifact`: with twelve roots, two artifacts can
 * carry the same rule, so `location.artifact` picks the right one.
 *
 * This module sits downstream of all twelve schema modules; none of them may
 * import it back, which is why `plan.ts` exports `BINDING_CHANNEL_NON_EMPTY`
 * to the ledger rather than the reverse.
 */
export type ConstraintLocation =
	| { readonly kind: 'root'; readonly artifact: InterchangeArtifactKey }
	| {
			readonly kind: 'definition'
			readonly artifact: InterchangeArtifactKey
			readonly name: string
	  }

export type ConstraintLedgerEntry = {
	/** stable identifier; callers cite this, never the prose. */
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

// Verified on the pin: z.tuple([a, b]) exports `prefixItems` alone (no
// minItems, maxItems, or items), so the published schema accepts the
// one-operand and three-operand `equality` that Zod rejects. Arity is the one
// deliberate exception to the admit-rule, so it is the one place the export
// must be repaired rather than relaxed.
// AD-10's manifestation witness put an `Expression` on `Defect`, so the same
// twelve tuples export into `probe.schema.json` too. `publish.ts` filters
// injection by `entry.location.artifact`, so an eval-contract-addressed entry
// repairs nothing there: both artifacts need their own twelve.
// The eval-contract ids keep their original `operator-arity-<op>` spelling. An
// entry id is a stable citation (`constraintLedgerEntry` looks one up by it), so
// renaming twelve of them for symmetry would break every existing reference and
// buy nothing.
const ARITY_ARTIFACTS = ['eval-contract', 'probe'] as const

const arityEntries: readonly ConstraintLedgerEntry[] = ARITY_ARTIFACTS.flatMap(
	(artifact) =>
		Object.entries(TUPLE_ARITY).map(([op, arity]) => ({
			id:
				artifact === 'eval-contract'
					? `operator-arity-${op}`
					: `operator-arity-${artifact}-${op}`,
			location: {
				kind: 'definition' as const,
				artifact,
				name: 'Expression',
			},
			branch: op,
			field: 'operands',
			statement: `\`${op}\` takes exactly ${arity} operand${arity === 1 ? '' : 's'}.`,
			disposition: {
				kind: 'inject' as const,
				dialect: 'draft-2020-12' as const,
				keywords: { minItems: arity, items: false },
			},
		})),
)

/**
 * AD-4 requires operand types in the published schema. Arity is structural
 * and repaired above; per-position operand types cannot be, since narrowing
 * a position would delete `malformed-operator-expression`'s operand-type
 * limb. The declaration lives instead in each operator's `operands`
 * description; enforcement is the compiler's. Recorded here so the split is a
 * decision, not an omission.
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
			"Narrowing a tuple position in the schema would convert AD-26's \"a reference-set operand in any position other than the three named above fails under `malformed-operator-expression`\" into an anonymous schema-parse failure, deleting that code's operand-type limb. AD-4 still requires the types to be *expressed* in the published schema, and a ledger entry is not an expression, so each branch's `operands` carries the legality in its description — the same treatment AD-36's numeric domain gets on JsonValue. Consequence for the compiler: the operand-type limb of `malformed-operator-expression` is entirely its own, with no schema-side partial coverage to rely on.",
	},
}

// One entry per lineage-bearing artifact (eleven, not twelve): the registry's
// `carriesLineage` flag is the filter, since `ArtifactReference` carries no
// `parentDigest` to resolve against. Generated from the registry the way
// arity entries are generated from `TUPLE_ARITY`, so a hand-written count
// cannot drift.
//
// Two of the eleven are union-rooted (`Probe` on `expectedClean`,
// `EvidenceArtifact` on `mode`): a union root exports no `properties` object,
// so the lineage fields are spread into every branch to keep the
// biconditional binding both.
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
				'A cross-field rule. Encoding it as a Zod refinement would make it invisible to every non-TypeScript consumer and turn it into a disagreement in the published-schema differential check, so it is stated in the field description instead and left to the reader that validates a presented chain.',
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
				"JSON Schema cannot express finiteness, and re-walking the value container in Zod would buy nothing an export can carry — the lexical scanner in `core/canonical/scan-json.ts` already rejects 1e999 and unsafe integers before any parse. AD-36 requires the restriction to be *expressed* in the published schema and a ledger entry is not an expression, so the domain statement lives in JsonValue's own description, which lands once on the shared definition. Consequence for the published-schema differential check: it must not generate non-finite or unsafe-integer literals inside JsonValue and call the result a disagreement.",
		},
	},
	operandTypeEntry,
	...lineageEntries,
	...secretsProhibitionEntries,
	{
		id: OBSERVATION_SEQUENCE_UNIQUE,
		location: { kind: 'root', artifact: 'sealed-run-record' },
		branch: null,
		field: 'observations',
		statement:
			"Every observation's `sequence` is unique within the record (ADR-006, owed item 2).",
		disposition: {
			kind: 'not-expressible',
			reason:
				"Uniqueness of a nested field across sibling array items has no draft-2020-12 keyword: `uniqueItems` compares whole items structurally and nothing in the dialect can name one property path and require distinctness on it alone. Unlike the lineage biconditional above, this constraint IS enforced by Zod (a `.refine()` on `observations`), because owed item 2 requires it schema-enforced and the AD-13 differential corpus never manufactures two observations sharing a `sequence`: the generated mutant walk is keyword-driven (it perturbs one occurrence at a time) and never clones or duplicates an `observations` array item, since that field carries no `maxItems` for the generator's clone-to-exceed step to fire against. The gap is therefore real but inert against the corpus this repository generates, and is stated in `Observation.sequence`'s own description for a non-Zod consumer to reimplement. This safety argument holds only while `observations` carries no `maxItems`: adding one later starts the clone-to-exceed step firing against this field, and this entry must be re-verified then.",
		},
	},
	{
		id: 'defect-signature-required',
		location: { kind: 'root', artifact: 'probe' },
		branch: null,
		field: null,
		statement:
			'Every probe that is not a known-clean control carries an AD-40 defect signature, except a probe whose class is `canary`, which carries `null`. AD-9\'s "an unqualified probe cannot enter a sealed set" and AD-9\'s route-per-class pairing are the same kind of rule and are enforced beside it.',
		disposition: {
			kind: 'not-expressible',
			reason:
				'A union-level `superRefine` is the only Zod spelling, and a refinement exports byte-identically, so Zod would reject a signature-less non-canary probe that ajv accepts. Unlike the observation-sequence entry above, that disagreement is not inert against the corpus this repository generates: the mutant generator manufactures the witness trivially from the accept fixture by nulling one field, and the published-schema differential check exists to fail on exactly such a disagreement. So the schema admits the shape and `qualifyProbe` (`core/score/qualification.ts`) returns a reason code, following `compile/interface-inventory.ts`, which put the declared-principal check in the compiler for the same reason. This argument holds only while the published export drops refinements: a Zod release that emitted a union-level refinement into the document, or a decision to inject a conditional here, makes the gate-side placement a choice rather than a necessity, and this entry must be re-verified then.',
		},
	},
	{
		id: PROBE_BINDING_CHANNEL_NON_EMPTY,
		location: {
			kind: 'definition',
			artifact: 'probe',
			name: 'ProbeInputBindingChannel',
		},
		branch: null,
		field: null,
		statement:
			"A declared channel of a defect signature's selector names at least one parameter. An unbound channel is `null`, never `{}`. Inject at the definition root, exactly as the contract-side channel does: `minProperties` is ignored on a non-object instance, so it constrains the object branch and leaves the null branch alone.",
		disposition: {
			kind: 'inject',
			dialect: 'draft-2020-12',
			keywords: { minProperties: 1 },
		},
	},
]

export const constraintLedgerEntry = (
	id: string,
): ConstraintLedgerEntry | undefined =>
	CONSTRAINT_LEDGER.find((entry) => entry.id === id)
