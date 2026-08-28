/** shared primitive shapes: identifiers, digests, dates, and the value container. */
import { z } from 'zod'

// Fixed here rather than per field: pointer spelling 1 depends on this exact
// charset, and a second copy per field is a drift risk. The kebab-slug shape
// matches both hand-authored contracts though no AD requires it, so it is
// ratified rather than invented.
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
// artifact uses five: the Probe, Evidence Artifact, and finding shapes import
// P-, D-, and F- rather than re-spelling the quantifier, and a second spelling
// of `{3,}` is exactly the drift the convention names.
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

// AD-27's rendered digest form. It lives here rather than privately in
// core/canonical/digest.ts so the schema and the digest functions share one
// spelling, and core/ imports core/schemas rather than the reverse.
export const DIGEST_FORM = /^sha256:[0-9a-f]{64}$/

export const Digest = z
	.string()
	.regex(DIGEST_FORM)
	.describe('AD-27 digest: "sha256:" plus 64 lowercase hexadecimal characters.')

// AD-36's declared format lives here rather than on the field: an undeclared
// "declared format" is the same unshaped-declaration defect AD-19's value
// spaces were added to close.
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

// Spelled as an alternation rather than a negative lookahead on purpose: JSON
// Schema's `pattern` is ECMA-262 and would accept a lookahead, but several of
// the non-JavaScript validators AD-13 also publishes this schema for compile
// patterns with no lookahead support at all.
export const POSITIVE_DECIMAL_STRING_PATTERN =
	/^([1-9][0-9]*(\.[0-9]+)?|0\.[0-9]*[1-9][0-9]*)$/

export const PositiveDecimalString = z
	.string()
	.regex(POSITIVE_DECIMAL_STRING_PATTERN)
	.describe(
		"The decimal-string format restricted to values greater than zero, for a ceiling where zero is not a ceiling. This is what carries the prior art's `exclusiveMinimum: 0` across AD-36's move of money from a JSON number to a string; without it that bound would be silently dropped by the retyping.",
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

// A declared key name: used in a request shape, a response descriptor, or a
// reference-set key list. Plain caller-supplied text.
export const KeyName = z.string().min(1)

export type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [key: string]: JsonValue }

// The one shape whose keys belong to the caller, so `additionalProperties` is
// schema-valued rather than false here alone. Hand-rolled with z.lazy rather
// than z.json(): the latter exports a generated `$defs` ref name that the
// published-schema drift check would pin and that separates the description
// from the shared definition, and AD-36 needs the numeric restriction on the
// definition itself.
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

/**
 * AD-4's `shape` descriptor and AD-19's request channel both need "required
 * keys, permitted keys, and per-key JSON type, never an embedded JSON
 * Schema"; spelled once here so two copies of one triple don't drift apart.
 * `.describe()` returns a new schema rather than mutating this one, so each
 * use site can add its own description.
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
