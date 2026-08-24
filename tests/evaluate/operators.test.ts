import { describe, expect, it } from 'vitest'
import {
	absence,
	containment,
	countTolerance,
	deepEquality,
	equality,
	existence,
	ordering,
	regexMatch,
	setMembership,
	shape,
} from '../../src/core/evaluate/operators.ts'
import { ABSENT } from '../../src/core/evaluate/resolved-value.ts'
import { faultOf } from '../canonical/helpers.ts'
import { DEFAULT_REGEX_MATCH_STEP_BUDGET } from './fixtures/stub-resolver.ts'

const PATH = 'artifacts/evaluate.json'

describe('existence', () => {
	it('is false against ABSENT and true against every resolved value, including null', () => {
		expect(existence(ABSENT, PATH)).toBe(false)
		expect(existence(null, PATH)).toBe(true)
		expect(existence(42, PATH)).toBe(true)
		expect(existence('t-1', PATH)).toBe(true)
		expect(existence({}, PATH)).toBe(true)
		expect(existence([], PATH)).toBe(true)
	})

	it('reads only === ABSENT, never JS truthiness', () => {
		// A regression toward `!value` would read 0, false, and '' as absent.
		expect(existence(0, PATH)).toBe(true)
		expect(existence(false, PATH)).toBe(true)
		expect(existence('', PATH)).toBe(true)
	})
})

describe('absence', () => {
	it('is the exact complement of existence', () => {
		expect(absence(ABSENT, PATH)).toBe(true)
		expect(absence(null, PATH)).toBe(false)
		expect(absence(42, PATH)).toBe(false)
	})

	it('reads only === ABSENT, never JS truthiness', () => {
		expect(absence(0, PATH)).toBe(false)
		expect(absence(false, PATH)).toBe(false)
		expect(absence('', PATH)).toBe(false)
	})
})

describe('equality', () => {
	// Grounded in gateCContract's O-002 node: equality(response-status, 200).
	it('compares equal scalars with === (gateCContract O-002 shape)', () => {
		expect(equality(200, 200, '/interactions/poll/response-status')).toBe(true)
		expect(equality(500, 200, '/interactions/poll/response-status')).toBe(false)
	})

	// Grounded in gateCContract's O-008 node: two pointers to the same channel
	// on sibling operations, both resolving to the identical status code.
	it('compares two pointer-resolved scalars (gateCContract O-008 shape)', () => {
		const path = '/interactions/unknown-job-read/response-status'
		expect(equality(404, 404, path)).toBe(true)
		expect(equality(404, 200, path)).toBe(false)
	})

	it('is false when either operand is ABSENT, including both-absent', () => {
		expect(equality(ABSENT, 42, PATH)).toBe(false)
		expect(equality(42, ABSENT, PATH)).toBe(false)
		expect(equality(ABSENT, ABSENT, PATH)).toBe(false)
	})

	it('resolves false on a scalar-vs-compound type mismatch, with no digest call', () => {
		expect(equality(42, { a: 1 }, PATH)).toBe(false)
		expect(equality([1, 2], 'x', PATH)).toBe(false)
	})

	it('treats null as its own scalar kind, distinct from every other kind', () => {
		expect(equality(null, null, PATH)).toBe(true)
		expect(equality(null, 42, PATH)).toBe(false)
	})

	it('resolves true for two structurally identical compound values', () => {
		expect(equality({ a: 1, b: 2 }, { b: 2, a: 1 }, PATH)).toBe(true)
		expect(equality([1, 2, 3], [1, 2, 3], PATH)).toBe(true)
	})

	it('resolves false for two same-shaped, structurally different compound values', () => {
		expect(equality({ a: 1, b: 2 }, { a: 1, b: 3 }, PATH)).toBe(false)
		expect(equality([1, 2, 3], [1, 2, 4], PATH)).toBe(false)
	})

	// Decision 2's adopted design, proving Draft 3's and Draft 4's defects both
	// stay closed. MAX_SAFE_INTEGER + 1 (2^53) is exactly representable as a
	// double — no precision is lost forming the literal — but
	// Number.isSafeInteger rejects it, so value-domain.ts's assertDomainNumber
	// still faults on it, exactly as it would on a large server-generated ID.
	it('does not throw on a same-kind scalar pair carrying a domain violation (Draft 3 stays closed)', () => {
		const unsafeInteger = Number.MAX_SAFE_INTEGER + 1
		expect(() => equality(unsafeInteger, 200, PATH)).not.toThrow()
		expect(equality(unsafeInteger, 200, PATH)).toBe(false)
	})

	it('does not throw on a cross-kind pair carrying a domain violation on either side (Draft 4 stays closed)', () => {
		const unsafeInteger = Number.MAX_SAFE_INTEGER + 1
		expect(() => equality(unsafeInteger, { a: 1 }, PATH)).not.toThrow()
		expect(equality(unsafeInteger, { a: 1 }, PATH)).toBe(false)
	})

	it("shares deep-equality's fault surface only on the compound branch", () => {
		const unsafeInteger = Number.MAX_SAFE_INTEGER + 1
		const fault = faultOf(() => equality({ a: unsafeInteger }, { a: 1 }, PATH))
		expect(fault.code).toBe('non-canonicalizable-value')
		expect(fault.artifactPath).toBe(PATH)
	})
})

describe('deepEquality', () => {
	// Grounded in gateCContract's O-001 node: deep-equality(submittedFilters,
	// filters), comparing an object.
	it('compares structurally equal and unequal objects (gateCContract O-001 shape)', () => {
		const path = '/interactions/poll/response-body/submittedFilters'
		expect(
			deepEquality(
				{ datasetId: 'ds-7', status: 'active' },
				{ datasetId: 'ds-7', status: 'active' },
				path,
			),
		).toBe(true)
		expect(
			deepEquality(
				{ datasetId: 'ds-7', status: 'active' },
				{ datasetId: 'ds-7', status: 'archived' },
				path,
			),
		).toBe(false)
	})

	it('is false when either operand is ABSENT, including both-absent', () => {
		expect(deepEquality(ABSENT, { a: 1 }, PATH)).toBe(false)
		expect(deepEquality({ a: 1 }, ABSENT, PATH)).toBe(false)
		expect(deepEquality(ABSENT, ABSENT, PATH)).toBe(false)
	})

	it('resolves false on a scalar-vs-compound pair, unconditionally structural', () => {
		expect(deepEquality(42, { a: 1 }, PATH)).toBe(false)
	})

	it('treats null as its own scalar kind, distinct from every other kind', () => {
		expect(deepEquality(null, null, PATH)).toBe(true)
		expect(deepEquality(null, 42, PATH)).toBe(false)
	})

	it('resolves true for two structurally identical compound values', () => {
		expect(deepEquality({ a: 1, b: 2 }, { b: 2, a: 1 }, PATH)).toBe(true)
		expect(deepEquality([1, 2, 3], [1, 2, 3], PATH)).toBe(true)
	})

	it('resolves false for two same-shaped, structurally different compound values', () => {
		expect(deepEquality({ a: 1, b: 2 }, { a: 1, b: 3 }, PATH)).toBe(false)
	})

	it("throws non-canonicalizable-value on an unsafe-range integer, undecorated (Draft 3's realistic trigger)", () => {
		const unsafeInteger = Number.MAX_SAFE_INTEGER + 1
		const fault = faultOf(() => deepEquality(unsafeInteger, 200, PATH))
		expect(fault.code).toBe('non-canonicalizable-value')
		expect(fault.artifactPath).toBe(PATH)
	})
})

describe('containment', () => {
	it('is false when the container is ABSENT, including both-absent', () => {
		expect(containment(ABSENT, 'x', PATH)).toBe(false)
		expect(containment('hello', ABSENT, PATH)).toBe(false)
		expect(containment(ABSENT, ABSENT, PATH)).toBe(false)
	})

	it('does substring containment against a string container', () => {
		expect(containment('hello world', 'wor', PATH)).toBe(true)
		expect(containment('hello world', 'xyz', PATH)).toBe(false)
	})

	it('does single-candidate element containment against an array container', () => {
		expect(containment([1, 2, 3], 2, PATH)).toBe(true)
		expect(containment([1, 2, 3], 5, PATH)).toBe(false)
	})

	it('does resolved-set-subset containment when the candidate is an array', () => {
		expect(containment(['a', 'b', 'c'], ['a', 'b'], PATH)).toBe(true)
		// 'd' has no structurally-equal match in the container.
		expect(containment(['a', 'b', 'c'], ['a', 'd'], PATH)).toBe(false)
	})

	it('does structural, not ===, element matching for both single and set candidates', () => {
		expect(containment([{ a: 1, b: 2 }], { b: 2, a: 1 }, PATH)).toBe(true)
		expect(containment([{ a: 1, b: 2 }], [{ b: 2, a: 1 }], PATH)).toBe(true)
	})

	it('resolves false on every named type-mismatch branch', () => {
		// object container: never legal, existence's job instead.
		expect(containment({ a: 1 }, 'a', PATH)).toBe(false)
		// string container against a non-string candidate.
		expect(containment('hello', 5, PATH)).toBe(false)
		// array candidate (resolved set) against a non-array container.
		expect(containment('hello', ['a', 'b'], PATH)).toBe(false)
		// scalar container.
		expect(containment(42, 42, PATH)).toBe(false)
	})

	it('pins the documented literal-vs-referenceSet collision: an array-shaped candidate is always read as a subset check, never as a single element to find', () => {
		// [1, 2] is literally an element of the container, but because the
		// candidate is an array it is read as a set to reconcile against
		// (Decision 3's flagged, undecidable-from-here ambiguity), not as a
		// single element to search for — so this resolves false even though an
		// element-search reading would resolve true.
		expect(
			containment(
				[
					[1, 2],
					[3, 4],
				],
				[1, 2],
				PATH,
			),
		).toBe(false)
	})
})

describe('setMembership', () => {
	// Grounded in gateCContract's O-002 node: the literal four-value state set.
	const stateSet = ['queued', 'running', 'succeeded', 'failed']
	it('matches a scalar member of a literal set (gateCContract O-002 shape)', () => {
		const path = '/interactions/poll/response-body/state'
		expect(setMembership('running', stateSet, path)).toBe(true)
		expect(setMembership('cancelled', stateSet, path)).toBe(false)
	})

	// Grounded in gateCContract's O-006 node: a page's @/id checked against the
	// resolved reference-set members (a subset of expected-export-rows' ids).
	it('matches against a resolved reference-set form (gateCContract O-006 shape)', () => {
		const path = '/interactions/first-page/response-body/rows'
		const resolvedReferenceSet = ['r-001', 'r-002', 'r-003']
		expect(setMembership('r-002', resolvedReferenceSet, path)).toBe(true)
		expect(setMembership('r-999', resolvedReferenceSet, path)).toBe(false)
	})

	it('does structural, not ===, matching for a non-scalar member', () => {
		const set = [{ a: 1, b: 2 }]
		expect(setMembership({ b: 2, a: 1 }, set, PATH)).toBe(true)
		expect(setMembership({ a: 1, b: 3 }, set, PATH)).toBe(false)
	})

	it('is false when the value is ABSENT', () => {
		expect(setMembership(ABSENT, stateSet, PATH)).toBe(false)
	})
})

describe('regexMatch', () => {
	// P22: shared with resolution.test.ts rather than spelled independently
	// here; see DEFAULT_REGEX_MATCH_STEP_BUDGET's own doc comment.
	const DEFAULT_BUDGET = DEFAULT_REGEX_MATCH_STEP_BUDGET

	// Reused from expression-nodes.ts's own regex fixture shape.
	it('matches an ordinary anchored pattern (accept and reject)', () => {
		expect(regexMatch('t-123', '^t-[0-9]+$', DEFAULT_BUDGET, PATH)).toBe(true)
		expect(regexMatch('x-123', '^t-[0-9]+$', DEFAULT_BUDGET, PATH)).toBe(false)
	})

	it('is false when the value is ABSENT or not a string, with no coercion', () => {
		expect(regexMatch(ABSENT, '^t-[0-9]+$', DEFAULT_BUDGET, PATH)).toBe(false)
		expect(regexMatch(42, '^t-[0-9]+$', DEFAULT_BUDGET, PATH)).toBe(false)
	})

	it('throws operator-cannot-accept-operand on a schema-valid but syntactically invalid pattern', () => {
		// AC 5's own example: passes AnchoredPattern's first/last-character check
		// (begins "^", ends "$") but is unbalanced ECMA-262 source.
		const fault = faultOf(() =>
			regexMatch('anything', '^([a$', DEFAULT_BUDGET, PATH),
		)
		expect(fault.code).toBe('operator-cannot-accept-operand')
		expect(fault.artifactPath).toBe(PATH)
		expect(fault.message).toContain('^([a$')
	})

	it('throws budget-exhausted on a nested-quantifier shape, even against a short input and a generous budget', () => {
		const fault = faultOf(() => regexMatch('a', '^(a+)+$', 1_000_000, PATH))
		expect(fault.code).toBe('budget-exhausted')
		expect(fault.artifactPath).toBe(PATH)
	})

	it('does not flag an ordinary non-capturing group as a nested quantifier', () => {
		// Without stripping the group's own "?:" marker before scanning its
		// contents for a quantifier character, this construct would be a false
		// positive: nothing inside the group actually repeats.
		expect(
			regexMatch('GETGETGET', '^(?:GET|POST)+$', DEFAULT_BUDGET, PATH),
		).toBe(true)
	})

	it('throws budget-exhausted when the linear estimate exceeds the declared budget, naming both numbers', () => {
		// Pattern has three top-level quantifiers and no groups, so the
		// structural tier never fires. estimatedSteps = (1 + 3) * length.
		const pattern = '^a+b+c+$'
		const budget = 100
		const fault = faultOf(() =>
			regexMatch('x'.repeat(26), pattern, budget, PATH),
		)
		expect(fault.code).toBe('budget-exhausted')
		expect(fault.artifactPath).toBe(PATH)
		expect(fault.message).toContain('104')
		expect(fault.message).toContain('100')
	})

	it('does not throw just under that same budget, proving the linear gate is a real threshold', () => {
		const pattern = '^a+b+c+$'
		const budget = 100
		// estimatedSteps = (1 + 3) * 25 = 100, not > 100.
		const value = `${'a'.repeat(9)}${'b'.repeat(8)}${'c'.repeat(8)}`
		expect(value).toHaveLength(25)
		expect(regexMatch(value, pattern, budget, PATH)).toBe(true)
	})

	it('strips character-class contents before counting quantifiers, avoiding a false-positive budget breach', () => {
		// Unstripped, "[+*?]" reads as three quantifier characters plus the
		// trailing "{1,3}" (four total, estimate 5 * length = 10000 at length
		// 2000, breaching a budget of 5000). Correctly stripped, only "{1,3}"
		// counts (estimate 2 * length = 4000, under the same budget).
		const value = 'x'.repeat(2000)
		expect(regexMatch(value, '^[+*?]{1,3}$', 5000, PATH)).toBe(false)
		expect(() => regexMatch(value, '^[+*?]{1,3}$', 5000, PATH)).not.toThrow()
	})

	it('neutralizes escapes BEFORE stripping character classes, so an escaped bracket cannot hide a real nested-quantifier group', () => {
		// Regression for a review-round-found unsafe defect: stripping character
		// classes on the raw pattern would see the "[" of the escaped "\[",
		// greedily consume through to the "]" of the escaped "\]" at the end,
		// and swallow the real "(a+)+" nested-quantifier group into what it
		// mistook for one big character class — hiding it from both tiers and
		// letting compiled.test hang on catastrophic backtracking. Escape-
		// neutralizing first means the structural tier sees the real group and
		// throws unconditionally, exactly as it would for the unescaped shape.
		const fault = faultOf(() =>
			regexMatch('a', '^\\[(a+)+\\]$', 1_000_000, PATH),
		)
		expect(fault.code).toBe('budget-exhausted')
		expect(fault.artifactPath).toBe(PATH)
	})

	it('still resolves the documented character-class residual to the smaller, correct estimate now that escapes are neutralized first', () => {
		// "^[a\]b+]$" is a single class matching one of a/]/b/+, with no real
		// quantifier anywhere — the "+" is a class member, not a repetition.
		// Escape-neutralizing before the class strip means the escaped "]" no
		// longer confuses the class boundary, so this now estimates 1 * length
		// (50), not the inflated 2 * length (100) an escape-blind strip would
		// have produced; either way this fixture proves the smaller, correct
		// estimate is what the implementation actually computes.
		const value = 'x'.repeat(50)
		expect(() => regexMatch(value, '^[a\\]b+]$', 60, PATH)).not.toThrow()
		expect(regexMatch(value, '^[a\\]b+]$', 60, PATH)).toBe(false)
	})

	it('does not read an escaped quantifier-look-alike as a real quantifier in the structural tier', () => {
		// "\d\+" inside the group has exactly zero real quantifiers (the "+" is
		// an escaped, literal plus sign); only the outer "+" is real. Without
		// stripping the escaped pair before testing the group's contents, the
		// bare "+" in "\+" reads as a quantifier character and this throws as a
		// false-positive nested-quantifier shape.
		expect(() =>
			regexMatch('1+2+3+', '^(\\d\\+)+$', 1_000_000, PATH),
		).not.toThrow()
		expect(regexMatch('1+2+3+', '^(\\d\\+)+$', 1_000_000, PATH)).toBe(true)
		expect(regexMatch('a+b+c+', '^(\\d\\+)+$', 1_000_000, PATH)).toBe(false)
	})

	it('does not let an escaped quantifier-look-alike inflate the linear-tier step estimate', () => {
		// Three escaped literal plus signs, no real quantifiers at all.
		// Correctly stripped: estimatedSteps = 1 * length = 800, under budget
		// 1000. Naively counted (escapes ignored): estimatedSteps = 4 * 800 =
		// 3200, which would wrongly breach the same budget.
		const value = 'x'.repeat(800)
		expect(() => regexMatch(value, '^\\+\\+\\+$', 1000, PATH)).not.toThrow()
		expect(regexMatch(value, '^\\+\\+\\+$', 1000, PATH)).toBe(false)
	})
})

describe('ordering', () => {
	// Reused from gateCContract's / expression-nodes.ts's capturedAt shape.
	it('orders both-string values ascending and descending', () => {
		const ascendingRows = [
			{ id: 'r-1', capturedAt: '2026-01-01T00:00:00Z' },
			{ id: 'r-2', capturedAt: '2026-01-02T00:00:00Z' },
			{ id: 'r-3', capturedAt: '2026-01-03T00:00:00Z' },
		]
		expect(ordering(ascendingRows, 'capturedAt', 'ascending', PATH)).toBe(true)
		expect(ordering(ascendingRows, 'capturedAt', 'descending', PATH)).toBe(
			false,
		)
		const descendingRows = [...ascendingRows].reverse()
		expect(ordering(descendingRows, 'capturedAt', 'descending', PATH)).toBe(
			true,
		)
	})

	it('orders a numeric key', () => {
		const rows = [{ rank: 1 }, { rank: 2 }, { rank: 3 }]
		expect(ordering(rows, 'rank', 'ascending', PATH)).toBe(true)
		expect(ordering(rows, 'rank', 'descending', PATH)).toBe(false)
	})

	it('permits ties: non-strict comparison, not strict < / >', () => {
		// Proof this matters: changing the operator's own <=/>= to strict </>
		// makes this fail where the function should resolve true.
		const tiedStrings = [
			{ id: 'r-1', capturedAt: '2026-01-02T00:00:00Z' },
			{ id: 'r-2', capturedAt: '2026-01-02T00:00:00Z' },
			{ id: 'r-3', capturedAt: '2026-01-03T00:00:00Z' },
		]
		expect(ordering(tiedStrings, 'capturedAt', 'ascending', PATH)).toBe(true)
		expect(ordering(tiedStrings, 'capturedAt', 'descending', PATH)).toBe(false)
		const tiedNumbers = [{ rank: 2 }, { rank: 2 }, { rank: 3 }]
		expect(ordering(tiedNumbers, 'rank', 'ascending', PATH)).toBe(true)
		const tiedNumbersDescending = [{ rank: 3 }, { rank: 2 }, { rank: 2 }]
		expect(ordering(tiedNumbersDescending, 'rank', 'descending', PATH)).toBe(
			true,
		)
	})

	it('is vacuously true for a single-element (or shorter) array', () => {
		expect(ordering([{ rank: 1 }], 'rank', 'ascending', PATH)).toBe(true)
		expect(ordering([], 'rank', 'ascending', PATH)).toBe(true)
	})

	it('is false on a two-element array with mismatched key types', () => {
		expect(
			ordering([{ rank: 1 }, { rank: '2' }], 'rank', 'ascending', PATH),
		).toBe(false)
	})

	it('is false when an element is missing the key entirely', () => {
		expect(
			ordering([{ rank: 1 }, { other: 2 }], 'rank', 'ascending', PATH),
		).toBe(false)
	})

	it('is false when the collection is ABSENT or is not an array', () => {
		expect(ordering(ABSENT, 'rank', 'ascending', PATH)).toBe(false)
		expect(ordering('not-an-array', 'rank', 'ascending', PATH)).toBe(false)
	})
})

describe('countTolerance', () => {
	// Reused from expression-nodes.ts's own count-tolerance fixture shape.
	it('checks a zero-tolerance exact count', () => {
		const collection = [1, 2, 3]
		expect(countTolerance(collection, 3, 0, false, PATH)).toBe(true)
		expect(countTolerance([1, 2, 3, 4], 3, 0, false, PATH)).toBe(false)
	})

	it('checks an absolute-tolerance boundary exactly, and one past it', () => {
		const twelve = Array.from({ length: 12 }, (_, index) => index)
		const thirteen = Array.from({ length: 13 }, (_, index) => index)
		expect(countTolerance(twelve, 10, 2, false, PATH)).toBe(true)
		expect(countTolerance(thirteen, 10, 2, false, PATH)).toBe(false)
	})

	it('compares a relative deviation unrounded, so no rounding widens the boundary', () => {
		// expected 7, tolerance 10% -> allowed deviation 0.7 (unrounded).
		const six = Array.from({ length: 6 }, (_, index) => index)
		const seven = Array.from({ length: 7 }, (_, index) => index)
		const eight = Array.from({ length: 8 }, (_, index) => index)
		expect(countTolerance(six, 7, 10, true, PATH)).toBe(false)
		expect(countTolerance(seven, 7, 10, true, PATH)).toBe(true)
		expect(countTolerance(eight, 7, 10, true, PATH)).toBe(false)
	})

	it('allows zero deviation when expected is zero, regardless of a non-zero relative tolerance', () => {
		expect(countTolerance([], 0, 50, true, PATH)).toBe(true)
		expect(countTolerance([1], 0, 50, true, PATH)).toBe(false)
	})

	it('is false when the collection is ABSENT or is not an array', () => {
		expect(countTolerance(ABSENT, 3, 0, false, PATH)).toBe(false)
		expect(countTolerance('not-an-array', 3, 0, false, PATH)).toBe(false)
	})
})

describe('shape', () => {
	// Reused from gateCContract's O-005 descriptor.
	const descriptor = {
		requiredKeys: ['id', 'datasetId', 'capturedAt', 'payload'],
		permittedKeys: ['id', 'datasetId', 'capturedAt', 'payload', 'retractedAt'],
		types: {},
	}

	it('accepts a value carrying exactly the required keys, and one carrying the one extra permitted key', () => {
		const base = {
			id: 'r-1',
			datasetId: 'ds-7',
			capturedAt: '2026-01-01T00:00:00Z',
			payload: {},
		}
		expect(shape(base, descriptor, PATH)).toBe(true)
		expect(
			shape({ ...base, retractedAt: '2026-01-02T00:00:00Z' }, descriptor, PATH),
		).toBe(true)
	})

	it('rejects a value missing a required key', () => {
		const { payload: _payload, ...missingPayload } = {
			id: 'r-1',
			datasetId: 'ds-7',
			capturedAt: '2026-01-01T00:00:00Z',
			payload: {},
		}
		expect(shape(missingPayload, descriptor, PATH)).toBe(false)
	})

	it('rejects a value carrying a key outside the closed permittedKeys set', () => {
		const withExtra = {
			id: 'r-1',
			datasetId: 'ds-7',
			capturedAt: '2026-01-01T00:00:00Z',
			payload: {},
			unexpectedField: true,
		}
		expect(shape(withExtra, descriptor, PATH)).toBe(false)
	})

	it('resolves false rather than throwing on a self-contradictory descriptor (a required key absent from permittedKeys)', () => {
		const contradictory = {
			requiredKeys: ['id', 'secret'],
			permittedKeys: ['id'],
			types: {},
		}
		// Satisfies requiredKeys (both present), but 'secret' is not in the
		// closed permittedKeys set — unsatisfiable by construction.
		expect(() =>
			shape({ id: 'x', secret: 'y' }, contradictory, PATH),
		).not.toThrow()
		expect(shape({ id: 'x', secret: 'y' }, contradictory, PATH)).toBe(false)
	})

	it('rejects a declared-type mismatch', () => {
		const typed = {
			requiredKeys: ['id'],
			permittedKeys: ['id'],
			types: { id: 'string' as const },
		}
		expect(shape({ id: 42 }, typed, PATH)).toBe(false)
		expect(shape({ id: 'r-1' }, typed, PATH)).toBe(true)
	})

	it('rejects a declared-type mismatch for a compound kind and for boolean', () => {
		const withCompoundAndBoolean = {
			requiredKeys: [],
			permittedKeys: ['tags', 'active'],
			types: { tags: 'array' as const, active: 'boolean' as const },
		}
		// tags declared array, value carries a string instead.
		expect(shape({ tags: 'not-an-array' }, withCompoundAndBoolean, PATH)).toBe(
			false,
		)
		expect(shape({ tags: ['a', 'b'] }, withCompoundAndBoolean, PATH)).toBe(true)
		// active declared boolean, value carries a string instead.
		expect(shape({ active: 'yes' }, withCompoundAndBoolean, PATH)).toBe(false)
		expect(shape({ active: true }, withCompoundAndBoolean, PATH)).toBe(true)
	})

	it('skips the type check entirely when a typed key is legally absent from value', () => {
		const optionallyTyped = {
			requiredKeys: [],
			permittedKeys: ['id'],
			types: { id: 'string' as const },
		}
		// 'id' is not required, and is omitted here — the per-key type check
		// must never fire against a key value does not carry at all.
		expect(shape({}, optionallyTyped, PATH)).toBe(true)
	})

	it('skips the type check when the type map entry is null (declared, type not stated)', () => {
		const untyped = {
			requiredKeys: ['id'],
			permittedKeys: ['id'],
			types: { id: null },
		}
		expect(shape({ id: 42 }, untyped, PATH)).toBe(true)
		expect(shape({ id: 'r-1' }, untyped, PATH)).toBe(true)
	})

	it('is false when the value is ABSENT or is not a plain object', () => {
		expect(shape(ABSENT, descriptor, PATH)).toBe(false)
		expect(shape([1, 2, 3], descriptor, PATH)).toBe(false)
		expect(shape('not-an-object', descriptor, PATH)).toBe(false)
		expect(shape(null, descriptor, PATH)).toBe(false)
	})
})
