/**
 * AD-4's eleven scalar, structural, and relational operators over the
 * resolved-value domain. The connectives, quantifiers, and the
 * `insufficient-evidence` wrapper live in `resolution.ts`; nothing here
 * decides any of them (AD-4). Every function takes `artifactPath: string`
 * last, even when unused, so that resolver dispatches through one calling
 * convention. The five that never throw name it `_artifactPath`; Biome
 * treats that prefix as unused.
 */
import { digestArtifact } from '../canonical/digest.ts'
import { RuntimeFault } from '../schemas/faults.ts'
import type {
	JsonObject,
	JsonValue,
	KeyedShapeDescriptor,
} from '../schemas/primitives.ts'
import { ABSENT, type ResolvedValue } from './resolved-value.ts'

// Shared JSON-type vocabulary: `equality`'s type-mismatch check and `shape`'s
// declared-type check need this exact mapping, kept once.
type JsonKind = 'string' | 'number' | 'boolean' | 'null' | 'array' | 'object'

function jsonKind(value: JsonValue): JsonKind {
	if (value === null) return 'null'
	if (Array.isArray(value)) return 'array'
	if (typeof value === 'object') return 'object'
	return typeof value as 'string' | 'number' | 'boolean'
}

function isPlainObject(value: JsonValue): value is JsonObject {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
}

// Structural (canonical-JSON) equality, shared by `equality`'s compound
// branch, `deepEquality`, and element matching in `containment` and
// `setMembership`. `digestArtifact` throws on a domain-rejected value
// (AD-36); left to propagate here, since an unevaluable operand has no
// comparison result to report.
function structurallyEqual(
	a: JsonValue,
	b: JsonValue,
	artifactPath: string,
): boolean {
	return digestArtifact(a, artifactPath) === digestArtifact(b, artifactPath)
}

// ---------------------------------------------------------------------------
// the identity family
// ---------------------------------------------------------------------------

/** Reads only whether resolution happened; `null` counts as present (AD-26). */
export function existence(
	value: ResolvedValue,
	_artifactPath: string,
): boolean {
	return value !== ABSENT
}

/** AD-26's exact complement of `existence`. */
export function absence(value: ResolvedValue, _artifactPath: string): boolean {
	return value === ABSENT
}

/**
 * Cost-ordered: the `ABSENT` guard runs before any digest call, since
 * `ABSENT` is a JS `symbol` and `digestArtifact` faults on symbols. Only a
 * matching compound type reaches structural comparison, so a scalar operand
 * never inherits the digest path's fault surface.
 */
export function equality(
	a: ResolvedValue,
	b: ResolvedValue,
	artifactPath: string,
): boolean {
	if (a === ABSENT || b === ABSENT) return false
	const kindA = jsonKind(a)
	const kindB = jsonKind(b)
	if (kindA !== kindB) return false
	if (kindA === 'array' || kindA === 'object') {
		return structurallyEqual(a, b, artifactPath)
	}
	return a === b
}

/**
 * Unconditionally structural (AD-27): the whole point of deep comparison.
 * `ABSENT` is guarded first, same reason as `equality`'s. A canonicalization
 * fault propagates undecorated: an unevaluable operand, not a false match.
 */
export function deepEquality(
	a: ResolvedValue,
	b: ResolvedValue,
	artifactPath: string,
): boolean {
	if (a === ABSENT || b === ABSENT) return false
	return structurallyEqual(a, b, artifactPath)
}

// ---------------------------------------------------------------------------
// the membership family
// ---------------------------------------------------------------------------

/**
 * `false` on `ABSENT` is correct only when `value`'s pointer is not itself
 * collection-typed; the resolver in `resolution.ts` disambiguates the two
 * cases before calling in here.
 */
export function setMembership(
	value: ResolvedValue,
	set: JsonValue[],
	artifactPath: string,
): boolean {
	if (value === ABSENT) return false
	return set.some((member) => structurallyEqual(member, value, artifactPath))
}

/**
 * `candidate: ResolvedValue | JsonValue[]` because `Containment`'s operand
 * can resolve to either a single value or a `referenceSet`'s member array.
 *
 * An array-shaped `candidate` is always read as a subset check, never as a
 * single element to search for: this function receives resolved values only,
 * so it cannot tell a `{ literal }` array from a resolved `{ referenceSet }`.
 * Known, accepted limitation.
 */
export function containment(
	container: ResolvedValue,
	candidate: ResolvedValue | JsonValue[],
	artifactPath: string,
): boolean {
	if (container === ABSENT) return false
	if (Array.isArray(candidate)) {
		// referenceSet path: requires container to also be an array.
		if (!Array.isArray(container)) return false
		return candidate.every((expectedMember) =>
			container.some((element) =>
				structurallyEqual(element, expectedMember, artifactPath),
			),
		)
	}
	if (candidate === ABSENT) return false
	if (typeof container === 'string') {
		if (typeof candidate !== 'string') return false
		return container.includes(candidate)
	}
	if (Array.isArray(container)) {
		return container.some((element) =>
			structurallyEqual(element, candidate, artifactPath),
		)
	}
	// Object or scalar container: type mismatch. Key presence belongs to
	// `existence` via a direct pointer; `containment` does not duplicate it.
	return false
}

// ---------------------------------------------------------------------------
// regexMatch
// ---------------------------------------------------------------------------

// A backslash-escaped character pair (`\+`, `\d`, `\[`, `\]`, …), neutralized
// to a single inert placeholder before `CHARACTER_CLASS_CONTENTS` runs. See
// the ordering note on `stripped` below.
const ESCAPED_CHARACTER_PAIR = /\\./g

// Character-class contents, stripped after escape-neutralization so a
// literal `+`/`*`/`?`/`[`/`]` inside `[...]` is never read as a quantifier.
const CHARACTER_CLASS_CONTENTS = /\[[^\]]*\]/g

// Strips a group's own `?:`/`?=`/`?!`/`?<name>` marker first, or the bare `?`
// would misread as a quantifier and false-flag `(?:GET|POST)+` as nested.
const GROUP_MARKER_PREFIX = /^\?(?:[:=!]|<[=!]?[^>]*>)/

const CONTENT_QUANTIFIER_CHARACTER = /[*+?{]/
const TRAILING_QUANTIFIER = /^(?:[*+?]|\{\d+(?:,\d*)?\})/

/**
 * Cheap structural paren-matching pass, modeled on `ANCHORED_PATTERN_FORM`'s
 * precedent. True iff a `(...)`/`(?:...)` group's contents hold a quantifier
 * character and the group itself is immediately followed by one: `(a+)+`,
 * `(a*)*`, and similar catastrophic-backtracking shapes.
 */
function hasNestedQuantifier(strippedPattern: string): boolean {
	const groupStarts: number[] = []
	for (let index = 0; index < strippedPattern.length; index++) {
		const character = strippedPattern[index]
		if (character === '(') {
			groupStarts.push(index)
			continue
		}
		if (character === ')') {
			const start = groupStarts.pop()
			if (start === undefined) continue
			const contents = strippedPattern
				.slice(start + 1, index)
				.replace(GROUP_MARKER_PREFIX, '')
			const following = strippedPattern.slice(index + 1)
			if (
				CONTENT_QUANTIFIER_CHARACTER.test(contents) &&
				TRAILING_QUANTIFIER.test(following)
			) {
				return true
			}
		}
	}
	return false
}

const QUANTIFIER_MARKER = /[*+?]|\{\d+(?:,\d*)?\}/g

/**
 * `false` if `value === ABSENT` or not a string. Pattern validity is checked
 * here; the match-step budget is a two-tier static gate, structural
 * nested-quantifier rejection then a linear estimate. The gate stays static
 * because AD-1 keeps this function synchronous and pure, and native `RegExp`
 * exposes no step counter to read.
 */
export function regexMatch(
	value: ResolvedValue,
	pattern: string,
	matchStepBudget: number,
	artifactPath: string,
): boolean {
	if (value === ABSENT || typeof value !== 'string') return false

	let compiled: RegExp
	try {
		compiled = new RegExp(pattern)
	} catch (cause) {
		throw new RuntimeFault(
			'operator-cannot-accept-operand',
			artifactPath,
			`pattern is not a syntactically valid ECMA-262 source: ${pattern}`,
			{ cause },
		)
	}

	// Escape-neutralize before stripping character classes: neutralizing first
	// keeps an escaped bracket from hiding a real nested-quantifier group from
	// both tiers below and letting the regex hang.
	const stripped = pattern
		.replace(ESCAPED_CHARACTER_PAIR, '_')
		.replace(CHARACTER_CLASS_CONTENTS, '[]')

	if (hasNestedQuantifier(stripped)) {
		throw new RuntimeFault(
			'budget-exhausted',
			artifactPath,
			`pattern rejected outright for a nested-quantifier shape that risks catastrophic backtracking: ${pattern}`,
		)
	}

	const estimatedSteps =
		(1 + (stripped.match(QUANTIFIER_MARKER)?.length ?? 0)) * value.length
	if (estimatedSteps > matchStepBudget) {
		throw new RuntimeFault(
			'budget-exhausted',
			artifactPath,
			`estimated ${estimatedSteps} regex match steps exceed the declared budget of ${matchStepBudget}`,
		)
	}

	// The unstripped pattern; stripping only feeds the step estimate above.
	return compiled.test(value)
}

// ---------------------------------------------------------------------------
// the structural family
// ---------------------------------------------------------------------------

/**
 * Comparison is non-strict: ties are allowed. String comparison is plain
 * `<=`/`>=` (UTF-16 code-unit order), matching AD-27's key-sorting basis.
 */
export function ordering(
	collection: ResolvedValue,
	key: string,
	order: 'ascending' | 'descending',
	_artifactPath: string,
): boolean {
	if (collection === ABSENT || !Array.isArray(collection)) return false
	for (let index = 0; index < collection.length - 1; index++) {
		const left = collection[index]
		const right = collection[index + 1]
		if (left === undefined || right === undefined) return false
		if (!isPlainObject(left) || !isPlainObject(right)) return false
		if (!Object.hasOwn(left, key) || !Object.hasOwn(right, key)) return false
		const leftValue = left[key]
		const rightValue = right[key]
		let inOrder: boolean
		if (typeof leftValue === 'number' && typeof rightValue === 'number') {
			inOrder =
				order === 'ascending'
					? leftValue <= rightValue
					: leftValue >= rightValue
		} else if (
			typeof leftValue === 'string' &&
			typeof rightValue === 'string'
		) {
			inOrder =
				order === 'ascending'
					? leftValue <= rightValue
					: leftValue >= rightValue
		} else {
			return false
		}
		if (!inOrder) return false
	}
	return true
}

/**
 * An empty array is a legitimate zero count, never special-cased; the
 * resolver in `resolution.ts` intercepts before this runs on a genuinely
 * empty collection. The allowed deviation is compared unrounded: `actual` is
 * an integer, so `<=` against a fractional deviation is already exact, and
 * rounding either direction would move the declared boundary.
 */
export function countTolerance(
	collection: ResolvedValue,
	expected: number,
	tolerance: number,
	relative: boolean,
	_artifactPath: string,
): boolean {
	if (collection === ABSENT || !Array.isArray(collection)) return false
	const actual = collection.length
	const allowedDeviation = relative ? (expected * tolerance) / 100 : tolerance
	return Math.abs(actual - expected) <= allowedDeviation
}

/**
 * The closed set is `permittedKeys` alone, never unioned with `requiredKeys`:
 * a self-contradictory descriptor is unsatisfiable rather than repaired.
 * `requiredKeys ⊆ permittedKeys` is unrefined in
 * `core/schemas/primitives.ts` and closed by no compile-time check, so a key
 * that is required and not permitted reaches here and fails every value.
 */
export function shape(
	value: ResolvedValue,
	descriptor: KeyedShapeDescriptor,
	_artifactPath: string,
): boolean {
	if (value === ABSENT || !isPlainObject(value)) return false
	for (const requiredKey of descriptor.requiredKeys) {
		if (!Object.hasOwn(value, requiredKey)) return false
	}
	for (const ownKey of Object.keys(value)) {
		if (!descriptor.permittedKeys.includes(ownKey)) return false
	}
	for (const [key, declaredType] of Object.entries(descriptor.types)) {
		// `null` in the type map means declared but type not stated: skip it.
		if (declaredType === null) continue
		if (!Object.hasOwn(value, key)) continue
		const actual = value[key] as JsonValue
		if (jsonKind(actual) !== declaredType) return false
	}
	return true
}

// ---------------------------------------------------------------------------
// covers-by-key
// ---------------------------------------------------------------------------

/**
 * Own-property lookup only, so a key like `__proto__` reads as missing
 * rather than inherited. Returns `ABSENT`, never throws (AD-4: a missing key
 * resolves `false`, not an error).
 */
function keyValueOf(
	element: JsonValue,
	key: string,
): JsonValue | typeof ABSENT {
	if (!isPlainObject(element) || !Object.hasOwn(element, key)) return ABSENT
	// `Object.hasOwn` above already proves the key is present; `noUncheckedIndexedAccess`
	// cannot see that, so the cast is narrowing, not widening (same pattern
	// `shape`'s own per-key type check already uses in this file).
	return element[key] as JsonValue
}

/**
 * AD-4's bijection: equal cardinality and a distinct `actual` match per
 * `expected` element on the named keys. `ABSENT` on either side resolves
 * `false`, including a fully-missing `actual` collection: AD-4 calls that "a
 * detected defect, not an empty examination," overriding the general
 * empty-collection invariant for this operator alone. A non-array `actual` is
 * an operand type this operator does not accept, which AD-4 assigns to
 * `malformed-operator-expression`; `core/compile/expression-legality.ts`
 * checks the operand *form* under that code and leaves this position's
 * declared type unchecked, so a non-array reaching here resolves `false`.
 *
 * Cardinality is never checked separately: `actualByKey` starts with one
 * entry per `actual` element (a synthetic slot for a keyless one, so nothing
 * goes uncounted), and the `expected` loop deletes one entry per match. A
 * final `actualByKey.size === 0` is the bijection condition itself, since the
 * map's starting size already equals `actual`'s cardinality. A duplicate
 * `actualKey` fails immediately, at construction, because the second element
 * finds its slot already occupied; a duplicate `expectedKey` is assumed
 * prevented at compile time under `malformed-operator-expression`, but if it
 * occurs it fails later, at lookup, because the second occurrence finds its
 * slot already deleted by the first.
 */
export function coversByKey(
	expected: JsonValue[] | typeof ABSENT,
	actual: ResolvedValue,
	expectedKey: string,
	actualKey: string,
	artifactPath: string,
): boolean {
	if (expected === ABSENT || actual === ABSENT) return false
	if (!Array.isArray(actual)) return false

	const actualByKey = new Map<string, JsonValue>()
	for (const [index, element] of actual.entries()) {
		const keyValue = keyValueOf(element, actualKey)
		// A row missing actualKey can never be claimed by any expected digest
		// (digestArtifact always returns a `sha256:`-prefixed string), but it
		// still has to occupy its own slot: skipping it here would let it
		// vanish from the cardinality check instead of surfacing as an
		// unmatched extra.
		const digest =
			keyValue === ABSENT
				? `missing-actualKey:${index}`
				: digestArtifact(keyValue, artifactPath)
		if (actualByKey.has(digest)) return false
		actualByKey.set(digest, element)
	}

	for (const element of expected) {
		const keyValue = keyValueOf(element, expectedKey)
		if (keyValue === ABSENT) return false
		const digest = digestArtifact(keyValue, artifactPath)
		if (!actualByKey.delete(digest)) return false
	}

	return actualByKey.size === 0
}
