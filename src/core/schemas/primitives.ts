/** shared primitive shapes: identifiers, digests, dates, and the value container. */
import { z } from 'zod'

// One shared identifier charset, fixed here rather than per field, because
// pointer spelling 1 embeds it: a step identifier carrying "/" or "~" would
// make `/interactions/{stepId}/…` undecidable as a regex. Both hand-authored
// contracts spell every identifier as a kebab slug and no AD constrains them,
// so the slug is ratified rather than invented.
const IDENTIFIER_SOURCE = '[a-z0-9]+(?:-[a-z0-9]+)*'

export const IDENTIFIER_PATTERN = new RegExp(`^${IDENTIFIER_SOURCE}$`)

/** the charset spelling 1 embeds; exported so pointer.ts never re-spells it. */
export const IDENTIFIER_CHARSET_SOURCE = IDENTIFIER_SOURCE

export const Identifier = z
	.string()
	.regex(IDENTIFIER_PATTERN)
	.describe(
		'A kebab-case slug. Excludes "/" and "~" so an identifier can be embedded in an interaction-rooted pointer without escaping.',
	)

// All eight Consistency-Conventions prefixes are defined here even though this
// artifact uses five: Story 1.4 imports P-, D-, and F- for the Probe, Evidence
// Artifact, and finding shapes rather than re-spelling the quantifier, and a
// second spelling of `{3,}` is exactly the drift the convention names.
const prefixedIdentifier = (prefix: string): RegExp =>
	new RegExp(`^${prefix}-[0-9]{3,}$`)

export const BEHAVIOR_ID_PATTERN = prefixedIdentifier('B')
export const ORACLE_ID_PATTERN = prefixedIdentifier('O')
export const PROBE_ID_PATTERN = prefixedIdentifier('P')
export const WAIVER_ID_PATTERN = prefixedIdentifier('W')
export const DEFECT_ID_PATTERN = prefixedIdentifier('D')
export const FINDING_ID_PATTERN = prefixedIdentifier('F')
export const RUBRIC_ID_PATTERN = prefixedIdentifier('R')
export const RUBRIC_CRITERION_ID_PATTERN = prefixedIdentifier('RC')

export const BehaviorId = z.string().regex(BEHAVIOR_ID_PATTERN)
export const OracleId = z.string().regex(ORACLE_ID_PATTERN)
export const ProbeId = z.string().regex(PROBE_ID_PATTERN)
export const WaiverId = z.string().regex(WAIVER_ID_PATTERN)
export const DefectId = z.string().regex(DEFECT_ID_PATTERN)
export const FindingId = z.string().regex(FINDING_ID_PATTERN)
export const RubricId = z.string().regex(RUBRIC_ID_PATTERN)
export const RubricCriterionId = z.string().regex(RUBRIC_CRITERION_ID_PATTERN)

// AD-27's rendered digest form. Story 1.2 held this privately in
// core/canonical/digest.ts; it moves here so the schema and the digest
// functions share one spelling, and core/ imports core/schemas rather than the
// reverse.
export const DIGEST_FORM = /^sha256:[0-9a-f]{64}$/

export const Digest = z
	.string()
	.regex(DIGEST_FORM)
	.describe('AD-27 digest: "sha256:" plus 64 lowercase hexadecimal characters.')

// AD-36 carries money and out-of-range integers as strings in a declared
// format. The format is declared here rather than left to the field, because an
// undeclared "declared format" is the same unshaped-declaration defect the
// value spaces of AD-19 were added to close.
export const DECIMAL_STRING_PATTERN = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/
export const UNSIGNED_DECIMAL_STRING_PATTERN = /^(0|[1-9][0-9]*)(\.[0-9]+)?$/

export const DecimalString = z
	.string()
	.regex(DECIMAL_STRING_PATTERN)
	.describe(
		'AD-36 decimal-string format: an optionally signed decimal with no exponent and no leading zeros, carried as a string so exact decimal semantics survive canonicalization.',
	)

export const UnsignedDecimalString = z
	.string()
	.regex(UNSIGNED_DECIMAL_STRING_PATTERN)
	.describe(
		'The decimal-string format restricted to non-negative values, for quantities where a negative has no meaning.',
	)

// Consistency Conventions: dates are RFC 3339 in UTC. z.iso.datetime() with no
// options accepts a trailing "Z" and rejects a numeric offset, which is exactly
// the convention; { offset: true } would accept both.
export const Rfc3339Utc = z.iso
	.datetime()
	.describe('RFC 3339 timestamp in UTC. A numeric offset is not accepted.')

/** the six JSON type names a declaration may name a key's type as. */
export const JsonTypeName = z.enum([
	'string',
	'number',
	'boolean',
	'object',
	'array',
	'null',
])

// A declared key name in a request shape, a response descriptor, or a
// reference-set key list. Plain caller-supplied text; only emptiness is
// excluded, since an empty key name names nothing.
export const KeyName = z.string().min(1)

export type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [key: string]: JsonValue }

// The single named value container of the Consistency Conventions: the one
// shape whose keys belong to the caller rather than to this project, and
// therefore the one place `additionalProperties` is schema-valued rather than
// false.
//
// Hand-rolled with z.lazy rather than z.json() deliberately. z.json() exports
// as `$defs.JsonValue = { "$ref": "#/$defs/__schema0" }` plus a generated
// `__schema0`, which pins a generated name into Story 1.5's drift check, and
// its description lands at each use site as a sibling of `$ref` instead of on
// the shared definition. AD-36 requires the numeric restriction to be
// *expressed* in the published schema, so it has to land on the definition.
export const JsonValue: z.ZodType<JsonValue> = z
	.lazy(() =>
		z.union([
			z.string(),
			z.number(),
			z.boolean(),
			z.null(),
			z.array(JsonValue),
			z.record(z.string(), JsonValue),
		]),
	)
	.meta({
		id: 'JsonValue',
		description:
			'AD-36 value domain. Every number is a finite IEEE 754 double-precision value, and every integer lies in the safe-integer range; a larger integer, and any value needing exact decimal semantics such as money, is carried as a string in its own declared format. JSON Schema cannot express finiteness, so this restriction is stated rather than encoded: producers are told the rule here instead of discovering it through a digest mismatch, and the canonical scanner rejects a violating value before any parse.',
	})

// AD-4 spells `shape`'s descriptor as "required keys, permitted keys, and
// per-key JSON type, never an embedded JSON Schema", and AD-19 spells a request
// channel with the same three parts. One definition serves both: two spellings
// of one triple is the drift the Conventions exist to prevent, and the null
// type value reads the same way in each — the key is declared and its type is
// not. The `types` map is caller-keyed; its keys are plain key names, never
// pointers.
/**
 * The per-key JSON type map, spelled once. A request channel, a response
 * descriptor, and `shape`'s descriptor all carry one, and a second spelling of
 * it is the drift the Conventions exist to prevent. Each use site adds its own
 * description; `.describe()` returns a new schema and never mutates this one.
 */
export const KeyTypeMap = z
	.record(KeyName, JsonTypeName.nullable())
	.describe(
		'Caller-keyed by plain key name, never by pointer: the descriptor-relative pointer spelling does not apply to these keys and must not be extended to them by analogy. A missing key means "not declared"; an explicit `null` value means "declared, type not stated".',
	)

export const KeyedShapeDescriptor = z.strictObject({
	requiredKeys: z.array(KeyName),
	permittedKeys: z
		.array(KeyName)
		.describe(
			'The closed set of keys the shape admits. Deliberately not refined to be a superset of `requiredKeys`: no AD-5 code names that contradiction, so it joins the cross-field rules left to the compiler in v0. There is no spelling for "these keys are required and extras are unconstrained" — AD-4 calls the descriptor closed, so an open mode would be a different grammar.',
		),
	types: KeyTypeMap,
})

export type KeyedShapeDescriptor = z.infer<typeof KeyedShapeDescriptor>

export type JsonObject = { [key: string]: JsonValue }

/** a caller-keyed object inside the value container; not a control object. */
export const JsonObjectValue: z.ZodType<JsonObject> = z.record(
	z.string(),
	JsonValue,
)
