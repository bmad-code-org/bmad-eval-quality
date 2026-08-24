/**
 * AD-4's ten scalar and structural operators over the resolved-value domain.
 * `covers-by-key` (the eleventh operator) is Story 3.3's; the three
 * connectives, the two quantifiers, and the three-valued
 * `insufficient-evidence` wrapper are Story 3.2's. Every function here is
 * two-valued (`boolean`), pure, synchronous, and total over its declared
 * inputs (AD-1) — no operator here decides `insufficient-evidence`, per AD-4's
 * own framing of that value as an invariant over operands the wrapper applies,
 * not a rule an operator computes about itself.
 *
 * Every function's last parameter is `artifactPath: string`, uniformly, even
 * on functions that never throw: a per-function-different arity would cost
 * Story 3.2's resolution layer a dispatch table instead of one calling
 * convention. The five that never throw name it `_artifactPath`, which this
 * repository's Biome config treats as intentionally unused.
 */
import { digestArtifact } from '../canonical/digest.ts'
import { RuntimeFault } from '../schemas/faults.ts'
import type {
	JsonObject,
	JsonValue,
	KeyedShapeDescriptor,
} from '../schemas/primitives.ts'
import { ABSENT, type ResolvedValue } from './resolved-value.ts'

// The six-member JSON-type vocabulary, computed once and reused everywhere a
// runtime value's kind decides a branch: `equality`'s type-mismatch check
// (AC 3) and `shape`'s per-key declared-type check (AC 6) both need exactly
// this mapping, and a second hand-rolled copy would be the same drift the
// Consistency Conventions exist to prevent.
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

// Structural (canonical-JSON) equality, shared by every operator that cannot
// answer with `===`: `equality`'s compound branch, `deepEquality`
// unconditionally, and the element matching `containment` and `setMembership`
// both need against elements that are not guaranteed scalar. `digestArtifact`
// throws `RuntimeFault('non-canonicalizable-value', …)` on a value this
// project's value domain rejects (AD-36); that is let propagate undecorated
// everywhere this helper is called; see AC 3's Decision 2 for why that is the
// correct signal rather than a caught `false`.
function structurallyEqual(
	a: JsonValue,
	b: JsonValue,
	artifactPath: string,
): boolean {
	return digestArtifact(a, artifactPath) === digestArtifact(b, artifactPath)
}

// ---------------------------------------------------------------------------
// AC 3 — identity family
// ---------------------------------------------------------------------------

/** `false` if `value === ABSENT`, else `true`. AD-26: reads only whether
 * resolution happened, never what it produced — `null` is present. */
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
 * A three-way, cost-ordered branch (AC 3 Decision 2, adopted after four
 * rejected drafts): a genuine type mismatch resolves `false` with no digest
 * call; a matching scalar type compares with `===`; only a matching
 * **compound** type (`array` with `array`, `object` with `object`) reaches
 * `digestArtifact`, the one case with no cheaper way to answer. The `ABSENT`
 * guard runs before all three branches — `ABSENT` is a JS `symbol`, and
 * letting it reach `digestArtifact` would fault instead of resolving AD-26's
 * required `false`.
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
 * "Structural over canonical JSON per AD-27, never serialization-based."
 * `false` if either operand is `ABSENT`, checked first for the same reason as
 * `equality`'s guard. Otherwise unconditionally structural — no scalar fast
 * path, since structural comparison is this operator's entire purpose.
 * `digestArtifact`'s `RuntimeFault('non-canonicalizable-value', …)` propagates
 * undecorated: a node whose operand cannot be canonicalized is unevaluable,
 * not "not equal".
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
// AC 4 — membership family
// ---------------------------------------------------------------------------

/**
 * `false` if `value === ABSENT` — correct only when `value`'s own pointer is
 * not itself declared collection-typed; Story 3.2 owns telling the two cases
 * apart (AC 1). Otherwise `true` iff `set` contains an element structurally
 * (canonical-JSON) equal to `value`.
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
 * `candidate: ResolvedValue | JsonValue[]` because `Containment`'s schema
 * operand 1 is the general `Operand` union: a `{ pointer }`/`{ literal }`
 * candidate resolves to a single `ResolvedValue`, a `{ referenceSet }`
 * candidate resolves to the contract's declared members, a `JsonValue[]`.
 * `container`'s own `false`-on-`ABSENT` handling is likewise subject to AC 1's
 * absent-collection-typed boundary note. This construction is this story's
 * least-grounded piece (Decision 3): no AD, ADR, or fixture states
 * `containment`'s comparison algorithm.
 *
 * **A documented, un-fixed collision:** an array-shaped `{ literal }`
 * candidate and a resolved `{ referenceSet }` candidate both resolve to the
 * identical runtime shape, `JsonValue[]` — this function cannot tell "check
 * whether the array itself is present as one element of `container`" from
 * "check whether `container` is a superset of this set", and always takes the
 * latter (subset) reading whenever `candidate` is an array. So
 * `containment([[1, 2], [3, 4]], [1, 2], path)` resolves `false` even though
 * `[1, 2]` is literally an element of the container, because an array-shaped
 * candidate is always read as a set to reconcile against, never as a single
 * element to search for. This is the concrete case Decision 3's
 * "least-grounded piece" flag refers to; it is not fixed here, because fixing
 * it would need operand *provenance* (was this array a `{ literal }` or a
 * resolved `{ referenceSet }`?) that this function structurally cannot see —
 * the same class of limitation AC 3's Decision 2 names for `equality`.
 */
export function containment(
	container: ResolvedValue,
	candidate: ResolvedValue | JsonValue[],
	artifactPath: string,
): boolean {
	if (container === ABSENT) return false
	if (Array.isArray(candidate)) {
		// Came from a resolved reference set: require `container` to also be an
		// array, else a type mismatch; otherwise set-of-expected-members ⊆
		// container by canonical-JSON element equality.
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
	// Object container, or any scalar container: a type mismatch. An object's
	// key presence is already `existence`'s job via a pointer straight at the
	// key; `containment` does not duplicate it.
	return false
}

// ---------------------------------------------------------------------------
// AC 5 — regexMatch
// ---------------------------------------------------------------------------

// Character-class contents stripped first so a literal `+`/`*`/`?` inside
// `[...]` is never mistaken for a quantifier by either tier below.
const CHARACTER_CLASS_CONTENTS = /\[[^\]]*\]/g

// A group's own non-capturing/lookaround marker (`?:`, `?=`, `?!`, `?<name>`,
// `?<=`, `?<!`), stripped from a group's captured contents before that
// content is scanned for a quantifier character. Without this, the bare `?`
// every `(?:…)` opens with would read as a quantifier of its own and flag an
// entirely ordinary construct such as `(?:GET|POST)+` as a nested-quantifier
// shape, when nothing inside it actually repeats.
const GROUP_MARKER_PREFIX = /^\?(?:[:=!]|<[=!]?[^>]*>)/

const CONTENT_QUANTIFIER_CHARACTER = /[*+?{]/
const TRAILING_QUANTIFIER = /^(?:[*+?]|\{\d+(?:,\d*)?\})/

// A backslash-escaped character pair, e.g. `\+` or `\d`. Stripped before
// testing a string for a quantifier *character*, because an escaped `+`/`*`/
// `?`/`{` is a literal character, not a metacharacter, and
// `CONTENT_QUANTIFIER_CHARACTER`/`QUANTIFIER_MARKER` cannot otherwise tell the
// two apart. This mirrors the escape-awareness the paren-matching scan below
// already has for finding real group delimiters; here it is content, not
// delimiters, that need the same treatment.
const ESCAPED_CHARACTER_PAIR = /\\./g

/**
 * A simple parenthesis-matching pass, not a full parse (modeled on
 * `ANCHORED_PATTERN_FORM`'s own precedent): for every `(...)`/`(?:...)` group
 * in the character-class-stripped source, true iff the group's own contents
 * contain a quantifier character AND the group itself is immediately followed
 * by one — the shape that makes the group's own repetition compound with its
 * interior repetition (`(a+)+`, `(a*)*`, …).
 */
function hasNestedQuantifier(strippedPattern: string): boolean {
	const groupStarts: number[] = []
	for (let index = 0; index < strippedPattern.length; index++) {
		const character = strippedPattern[index]
		if (character === '\\') {
			index++ // an escaped character is never a group delimiter
			continue
		}
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
				.replace(ESCAPED_CHARACTER_PAIR, '')
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
 * `false` if `value === ABSENT` or `value` is not a string (type mismatch, no
 * coercion). Pattern validity is checked here (`AnchoredPattern` only checks
 * the first and last character), matching is native `RegExp` in full, and the
 * match-step budget is a two-tier static gate: structural, unconditional
 * rejection of a nested-quantifier shape, then a linear character-class-aware
 * estimate. Neither tier depends on `value.length` for the first tier; see
 * AC 5 and Decision 4 for why a dynamic engine-step count is never attempted.
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

	const stripped = pattern.replace(CHARACTER_CLASS_CONTENTS, '[]')

	if (hasNestedQuantifier(stripped)) {
		throw new RuntimeFault(
			'budget-exhausted',
			artifactPath,
			`pattern rejected outright for a nested-quantifier shape that risks catastrophic backtracking: ${pattern}`,
		)
	}

	// Escaped-character pairs are stripped before counting, for the same reason
	// as the structural tier above: an escaped quantifier-look-alike is a
	// literal character and must not inflate the estimate.
	const quantifierCountSource = stripped.replace(ESCAPED_CHARACTER_PAIR, '')
	const estimatedSteps =
		(1 + (quantifierCountSource.match(QUANTIFIER_MARKER)?.length ?? 0)) *
		value.length
	if (estimatedSteps > matchStepBudget) {
		throw new RuntimeFault(
			'budget-exhausted',
			artifactPath,
			`estimated ${estimatedSteps} regex match steps exceed the declared budget of ${matchStepBudget}`,
		)
	}

	// The original, unstripped pattern — the character-class stripping is an
	// estimation-only transform, never used for matching.
	return compiled.test(value)
}

// ---------------------------------------------------------------------------
// AC 6 — structural family
// ---------------------------------------------------------------------------

/**
 * `false` if `collection === ABSENT` or is not an array. A one-element (or
 * shorter) array is vacuously `true`. For each adjacent pair, both must be
 * plain objects carrying `key` as an own key and both values must be the same
 * JSON scalar type (`number` or `string`); any element failing this is a type
 * mismatch and the whole node is `false`. Comparison is non-strict (ties
 * permitted) and, for strings, plain `<=`/`>=` — UTF-16 code-unit order, never
 * locale-aware, matching AD-27's canonical key-sorting basis.
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
 * `false` if `collection === ABSENT` or is not an array. This function never
 * special-cases an *empty* array as anything but a legitimate zero count —
 * Story 3.2's wrapper intercepts before this function is ever called on a
 * genuinely empty collection (AC 1). The allowed deviation is compared
 * unrounded: `actual` is always an integer, so `<=` against a possibly-
 * fractional exact deviation needs no rounding to be correct (Decision 5).
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
 * `false` if `value === ABSENT` or is not a plain object. Then: every
 * `requiredKeys` member is an own key of `value`; every own key of `value` is
 * a member of `permittedKeys` (the closed set alone, never unioned with
 * `requiredKeys` — Decision 6, so a self-contradictory descriptor is
 * unsatisfiable rather than repaired); and for every key present in both
 * `value` and a non-`null` `descriptor.types` entry, `value[key]`'s runtime
 * JSON type equals the declared one.
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
		// `null` in the type map means "declared, type not stated" — skipped.
		if (declaredType === null) continue
		if (!Object.hasOwn(value, key)) continue
		const actual = value[key] as JsonValue
		if (jsonKind(actual) !== declaredType) return false
	}
	return true
}
