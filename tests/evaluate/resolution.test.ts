import { describe, expect, it } from 'vitest'
import { resolveCheck } from '../../src/core/evaluate/resolution.ts'
import { CheckResolution } from '../../src/core/schemas/evidence-artifact.ts'
import type { Expression } from '../../src/core/schemas/expression.ts'
import { RuntimeFault } from '../../src/core/schemas/faults.ts'
import type { JsonValue } from '../../src/core/schemas/primitives.ts'
import { faultOf } from '../canonical/helpers.ts'
import { VALID_NODES } from '../schemas/fixtures/expression-nodes.ts'
import { gateCContract } from '../schemas/fixtures/gate-c-contract.ts'
import { populatedContract } from '../schemas/fixtures/relevance-contracts.ts'
import {
	DEFAULT_REGEX_MATCH_STEP_BUDGET,
	makeResolverWithMisbehavingReferenceSet,
	makeStubPointerDenotesCollection,
	makeStubResolver,
	NO_REFERENCE_SET_KEYS,
} from './fixtures/stub-resolver.ts'

const PATH = 'artifacts/resolution.json'
// P22: one shared constant, imported rather than spelled independently here
// and in operators.test.ts.
const DEFAULT_BUDGET = DEFAULT_REGEX_MATCH_STEP_BUDGET

const findCheck = (oracleId: string): Expression => {
	const oracle = gateCContract.oracles.find(
		(candidate) => candidate.id === oracleId,
	)
	if (!oracle)
		throw new Error(`fixture setup: gateCContract has no oracle ${oracleId}`)
	return oracle.check
}

// AC 4: populatedContract's O-001 is this codebase's one real covers-by-key
// check tree (referenceSet: 'expected-things' against
// /interactions/list/response-body/items, both keys 'id'); every dispatch
// fixture below reuses it, varying only the stub resolver's evidence and
// referenceSets maps.
const findPopulatedCheck = (oracleId: string): Expression => {
	const oracle = populatedContract.oracles.find(
		(candidate) => candidate.id === oracleId,
	)
	if (!oracle) {
		throw new Error(
			`fixture setup: populatedContract has no oracle ${oracleId}`,
		)
	}
	return oracle.check
}

// Same-kind literal comparisons, resolvable with no evidence at all (a
// literal resolves to itself): the three leaf shapes the propagation truth
// tables below compose.
const literalEquals = (a: JsonValue, b: JsonValue): Expression => ({
	op: 'equality',
	operands: [{ literal: a }, { literal: b }],
})
const TRUE_NODE = literalEquals(1, 1)
const FALSE_NODE = literalEquals(1, 2)
// Only the first operand denotes an empty collection (P19); the second, `1`,
// is an ordinary non-empty scalar. This pins the asymmetric `.some()`
// semantics: a symmetric `literalEquals([], [])` would not distinguish
// checking every operand from checking only one.
const INSUFFICIENT_NODE = literalEquals([], 1)

const noneCollectionTyped = makeStubPointerDenotesCollection([])
const noEvidenceResolver = makeStubResolver({}, {})

const resolve = (expression: Expression) =>
	resolveCheck(
		expression,
		noEvidenceResolver,
		noneCollectionTyped,
		NO_REFERENCE_SET_KEYS,
		DEFAULT_BUDGET,
		PATH,
	)

// Shared by the array-narrowing-guard and covers-by-key fixtures: checks the
// thrown value is a plain Error and explicitly not a RuntimeFault, so the
// two failure classes stay distinguishable (AC 8).
function plainErrorOf(fn: () => unknown): Error {
	try {
		fn()
	} catch (error) {
		if (error instanceof RuntimeFault) {
			throw new Error(
				`expected a plain Error, got a RuntimeFault: ${error.message}`,
			)
		}
		if (error instanceof Error) return error
		throw error
	}
	throw new Error('expected an Error to be thrown')
}

describe('notOf/allOf/anyOf propagation (AC 4)', () => {
	it('not(true) is false, not(false) is true, not(insufficient-evidence) is terminal under both polarities', () => {
		expect(resolve({ op: 'not', operands: [TRUE_NODE] }).resolution).toBe(
			'false',
		)
		expect(resolve({ op: 'not', operands: [FALSE_NODE] }).resolution).toBe(
			'true',
		)
		expect(
			resolve({ op: 'not', operands: [INSUFFICIENT_NODE] }).resolution,
		).toBe('insufficient-evidence')
	})

	it('all keeps a genuine false decisive even beside an insufficient-evidence sibling', () => {
		expect(
			resolve({ op: 'all', operands: [FALSE_NODE, INSUFFICIENT_NODE] })
				.resolution,
		).toBe('false')
	})

	it('all resolves insufficient-evidence when one operand did and none resolved false', () => {
		expect(
			resolve({
				op: 'all',
				operands: [TRUE_NODE, INSUFFICIENT_NODE, TRUE_NODE],
			}).resolution,
		).toBe('insufficient-evidence')
	})

	it('all resolves true only when every operand did', () => {
		expect(
			resolve({ op: 'all', operands: [TRUE_NODE, TRUE_NODE] }).resolution,
		).toBe('true')
	})

	it('any is deliberately weaker than disjunction: one insufficient-evidence sibling beats a true one', () => {
		expect(
			resolve({ op: 'any', operands: [TRUE_NODE, INSUFFICIENT_NODE] })
				.resolution,
		).toBe('insufficient-evidence')
	})

	it('any resolves false only when every operand did', () => {
		expect(
			resolve({ op: 'any', operands: [FALSE_NODE, FALSE_NODE] }).resolution,
		).toBe('false')
	})

	it('any resolves true when at least one operand did and none resolved insufficient-evidence', () => {
		expect(
			resolve({ op: 'any', operands: [FALSE_NODE, TRUE_NODE] }).resolution,
		).toBe('true')
	})

	// AC 4's last bullet: CONNECTIVE_MINIMUM_ARITY (expression.ts) keeps
	// allOf/anyOf from ever folding an empty array, so allOf([]) (`true`) and
	// anyOf([]) (`false`) are unreachable in practice (P20: expression.test.ts
	// asserts the constant's value directly; re-asserting it here would not
	// catch a regression to allOf/anyOf's own vacuous-array reading).

	it("a node that resolves insufficient-evidence purely by propagation carries introductionCondition: null, not the tripped leaf's own condition (Decision 9)", () => {
		const result = resolve({
			op: 'all',
			operands: [TRUE_NODE, INSUFFICIENT_NODE],
		})
		expect(result.resolution).toBe('insufficient-evidence')
		expect(result.introductionCondition).toBeNull()
		// The leaf that actually tripped the condition still carries it, one
		// level down.
		expect(result.children[1]?.introductionCondition).toBe('empty-collection')
	})

	it('all and any preserve operand order in children', () => {
		const allResult = resolve({
			op: 'all',
			operands: [FALSE_NODE, TRUE_NODE, INSUFFICIENT_NODE],
		})
		expect(allResult.children.map((child) => child.resolution)).toEqual([
			'false',
			'true',
			'insufficient-evidence',
		])
		const anyResult = resolve({
			op: 'any',
			operands: [INSUFFICIENT_NODE, FALSE_NODE, TRUE_NODE],
		})
		expect(anyResult.children.map((child) => child.resolution)).toEqual([
			'insufficient-evidence',
			'false',
			'true',
		])
	})

	it('produces the full nested CheckResolutionValue shape, not a flattened one, and it validates against the real schema (P4, P10)', () => {
		const check: Expression = {
			op: 'not',
			operands: [{ op: 'all', operands: [TRUE_NODE, INSUFFICIENT_NODE] }],
		}
		const result = resolve(check)
		expect(result).toEqual({
			resolution: 'insufficient-evidence',
			introductionCondition: null,
			children: [
				{
					resolution: 'insufficient-evidence',
					introductionCondition: null,
					children: [
						{ resolution: 'true', introductionCondition: null, children: [] },
						{
							resolution: 'insufficient-evidence',
							introductionCondition: 'empty-collection',
							children: [],
						},
					],
				},
			],
		})
		expect(() => CheckResolution.parse(result)).not.toThrow()
	})

	// Grounded in real usage rather than only hand-authored leaves (AC 7
	// point 1): O-002's `all(equality, set-membership)` shape, O-003's
	// `all(absence, absence, existence)` shape, and expression-nodes.ts's
	// canonical `any` shape (no real contract uses `any`).
	describe('grounded in gateCContract and expression-nodes.ts shapes', () => {
		it('O-002 resolves true against a live job (200, a declared state)', () => {
			const evidence = {
				poll: { 'response-status': 200, 'response-body': { state: 'running' } },
			}
			const resolver = makeStubResolver(evidence, {})
			const result = resolveCheck(
				findCheck('O-002'),
				resolver,
				noneCollectionTyped,
				NO_REFERENCE_SET_KEYS,
				DEFAULT_BUDGET,
				PATH,
			)
			expect(result.resolution).toBe('true')
		})

		it('O-002 resolves false when the status is wrong, even with state resolving to an empty collection alongside it', () => {
			const evidence = {
				poll: { 'response-status': 500, 'response-body': { state: [] } },
			}
			const resolver = makeStubResolver(evidence, {})
			const result = resolveCheck(
				findCheck('O-002'),
				resolver,
				noneCollectionTyped,
				NO_REFERENCE_SET_KEYS,
				DEFAULT_BUDGET,
				PATH,
			)
			expect(result.resolution).toBe('false')
		})

		it('O-002 resolves insufficient-evidence when the status is right but the state operand denotes an empty collection', () => {
			const evidence = {
				poll: { 'response-status': 200, 'response-body': { state: [] } },
			}
			const resolver = makeStubResolver(evidence, {})
			const result = resolveCheck(
				findCheck('O-002'),
				resolver,
				noneCollectionTyped,
				NO_REFERENCE_SET_KEYS,
				DEFAULT_BUDGET,
				PATH,
			)
			expect(result.resolution).toBe('insufficient-evidence')
		})

		it('O-003 resolves true against a clean live-job body', () => {
			const evidence = { poll: { 'response-body': { jobId: 'job-1' } } }
			const resolver = makeStubResolver(evidence, {})
			const result = resolveCheck(
				findCheck('O-003'),
				resolver,
				noneCollectionTyped,
				NO_REFERENCE_SET_KEYS,
				DEFAULT_BUDGET,
				PATH,
			)
			expect(result.resolution).toBe('true')
		})

		it("expression-nodes.ts's any shape resolves true against a non-empty collection", () => {
			const evidence = { list: { 'response-body': { items: ['a'] } } }
			const resolver = makeStubResolver(evidence, {})
			const result = resolveCheck(
				VALID_NODES.any,
				resolver,
				noneCollectionTyped,
				NO_REFERENCE_SET_KEYS,
				DEFAULT_BUDGET,
				PATH,
			)
			expect(result.resolution).toBe('true')
		})

		it("expression-nodes.ts's any shape resolves insufficient-evidence when both children read the same collection-typed pointer that did not resolve", () => {
			const resolver = makeStubResolver({ list: { 'response-body': {} } }, {})
			const result = resolveCheck(
				VALID_NODES.any,
				resolver,
				makeStubPointerDenotesCollection([
					'/interactions/list/response-body/items',
				]),
				NO_REFERENCE_SET_KEYS,
				DEFAULT_BUDGET,
				PATH,
			)
			expect(result.resolution).toBe('insufficient-evidence')
		})

		it("expression-nodes.ts's any shape resolves true over an observed empty collection, because existence and absence are total over one", () => {
			const evidence = { list: { 'response-body': { items: [] } } }
			const resolver = makeStubResolver(evidence, {})
			const result = resolveCheck(
				VALID_NODES.any,
				resolver,
				noneCollectionTyped,
				NO_REFERENCE_SET_KEYS,
				DEFAULT_BUDGET,
				PATH,
			)
			// `existence` answers true and `absence` answers false against a
			// present, empty array, so the two stay exact complements and the
			// disjunction has a genuine resolution to fold.
			expect(result.resolution).toBe('true')
			expect(result.children.map((child) => child.resolution)).toEqual([
				'true',
				'false',
			])
		})
	})
})

describe('equality vs deep-equality dispatch is not swappable (P1)', () => {
	it('deep-equality resolves true for two non-empty, structurally-equal objects with different key order', () => {
		const check: Expression = {
			op: 'deep-equality',
			operands: [
				{ pointer: '/interactions/x/response-body/a' },
				{ pointer: '/interactions/x/response-body/b' },
			],
		}
		const resolver = makeStubResolver(
			{
				x: {
					'response-body': { a: { one: 1, two: 2 }, b: { two: 2, one: 1 } },
				},
			},
			{},
		)
		const result = resolveCheck(
			check,
			resolver,
			noneCollectionTyped,
			NO_REFERENCE_SET_KEYS,
			DEFAULT_BUDGET,
			PATH,
		)
		expect(result.resolution).toBe('true')
	})

	it('equality resolves false on a kind mismatch (a number literal vs a string literal)', () => {
		const check: Expression = {
			op: 'equality',
			operands: [{ literal: 1 }, { literal: '1' }],
		}
		expect(resolve(check).resolution).toBe('false')
	})
})

describe('ordering and count-tolerance actually reach the operator over a non-empty collection (P2)', () => {
	it('ordering resolves true ascending and false descending over the same non-empty array', () => {
		const rows: JsonValue[] = [{ rank: 1 }, { rank: 2 }, { rank: 3 }]
		const resolver = makeStubResolver({ x: { 'response-body': { rows } } }, {})
		const ascending: Expression = {
			op: 'ordering',
			operands: [{ pointer: '/interactions/x/response-body/rows' }],
			key: 'rank',
			order: 'ascending',
		}
		const descending: Expression = { ...ascending, order: 'descending' }
		expect(
			resolveCheck(
				ascending,
				resolver,
				noneCollectionTyped,
				NO_REFERENCE_SET_KEYS,
				DEFAULT_BUDGET,
				PATH,
			).resolution,
		).toBe('true')
		expect(
			resolveCheck(
				descending,
				resolver,
				noneCollectionTyped,
				NO_REFERENCE_SET_KEYS,
				DEFAULT_BUDGET,
				PATH,
			).resolution,
		).toBe('false')
	})

	it('count-tolerance resolves true at the exact expected count and false one past it', () => {
		const buildResult = (rows: JsonValue[]) =>
			resolveCheck(
				{
					op: 'count-tolerance',
					operands: [{ pointer: '/interactions/x/response-body/rows' }],
					expected: 3,
					tolerance: 0,
					relative: false,
				},
				makeStubResolver({ x: { 'response-body': { rows } } }, {}),
				noneCollectionTyped,
				NO_REFERENCE_SET_KEYS,
				DEFAULT_BUDGET,
				PATH,
			)
		expect(buildResult([1, 2, 3]).resolution).toBe('true')
		expect(buildResult([1, 2, 3, 4]).resolution).toBe('false')
	})
})

describe('regex resolves to a genuine boolean, and the step budget threads through resolveCheck (P3)', () => {
	it('resolves true/false against an ordinary anchored pattern', () => {
		const check: Expression = {
			op: 'regex',
			operands: [{ pointer: '/interactions/x/response-body/value' }],
			pattern: '^t-[0-9]+$',
		}
		const matching = makeStubResolver(
			{ x: { 'response-body': { value: 't-123' } } },
			{},
		)
		const notMatching = makeStubResolver(
			{ x: { 'response-body': { value: 'x-123' } } },
			{},
		)
		expect(
			resolveCheck(
				check,
				matching,
				noneCollectionTyped,
				NO_REFERENCE_SET_KEYS,
				DEFAULT_BUDGET,
				PATH,
			).resolution,
		).toBe('true')
		expect(
			resolveCheck(
				check,
				notMatching,
				noneCollectionTyped,
				NO_REFERENCE_SET_KEYS,
				DEFAULT_BUDGET,
				PATH,
			).resolution,
		).toBe('false')
	})

	it('threads regexMatchStepBudget from resolveCheck through to a real budget-exhausted fault', () => {
		const check: Expression = {
			op: 'regex',
			// No nested quantifier, so only the linear tier can fire.
			operands: [{ pointer: '/interactions/x/response-body/value' }],
			pattern: '^a+b+c+$',
		}
		const resolver = makeStubResolver(
			{ x: { 'response-body': { value: 'a'.repeat(50) } } },
			{},
		)
		const tinyBudget = 10
		const fault = faultOf(() =>
			resolveCheck(
				check,
				resolver,
				noneCollectionTyped,
				NO_REFERENCE_SET_KEYS,
				tinyBudget,
				PATH,
			),
		)
		expect(fault).toBeInstanceOf(RuntimeFault)
		expect(fault.code).toBe('budget-exhausted')
		expect(fault.artifactPath).toBe(PATH)
	})
})

describe('the soft-delete agreement pair (AC 5, AD-4 worked example)', () => {
	const forAny = findCheck('O-004') // not(for-any(page, existence(@/retractedAt)))
	const forAll: Expression = {
		op: 'for-all',
		collection: { pointer: '/interactions/first-page/response-body/rows' },
		predicate: { op: 'absence', operands: [{ pointer: '@/retractedAt' }] },
	}

	it('agree (both true) on a populated page where no element carries retractedAt', () => {
		const rows: JsonValue[] = [{ id: 'r-1' }, { id: 'r-2' }]
		const resolver = makeStubResolver(
			{ 'first-page': { 'response-body': { rows } } },
			{},
		)
		expect(
			resolveCheck(
				forAny,
				resolver,
				noneCollectionTyped,
				NO_REFERENCE_SET_KEYS,
				DEFAULT_BUDGET,
				PATH,
			).resolution,
		).toBe('true')
		expect(
			resolveCheck(
				forAll,
				resolver,
				noneCollectionTyped,
				NO_REFERENCE_SET_KEYS,
				DEFAULT_BUDGET,
				PATH,
			).resolution,
		).toBe('true')
	})

	it('agree (both false) on a populated page where one element carries retractedAt', () => {
		const rows: JsonValue[] = [
			{ id: 'r-1' },
			{ id: 'r-2', retractedAt: '2026-01-02T00:00:00Z' },
		]
		const resolver = makeStubResolver(
			{ 'first-page': { 'response-body': { rows } } },
			{},
		)
		expect(
			resolveCheck(
				forAny,
				resolver,
				noneCollectionTyped,
				NO_REFERENCE_SET_KEYS,
				DEFAULT_BUDGET,
				PATH,
			).resolution,
		).toBe('false')
		expect(
			resolveCheck(
				forAll,
				resolver,
				noneCollectionTyped,
				NO_REFERENCE_SET_KEYS,
				DEFAULT_BUDGET,
				PATH,
			).resolution,
		).toBe('false')
	})

	it('agree (both false) on a page whose one element carries a present, empty retractedAt', () => {
		// The bound-element position, where AD-4's worked example lives, and the
		// one shape this qualification moved: `@/retractedAt` resolving to a
		// present `[]` used to trip the empty-collection condition under both
		// spellings. `existence` and `absence` are both total over it now, so
		// both spellings move to `false` together. Marking only one of the two
		// operators total would split the pair here, which is the failure this
		// suite exists to catch.
		const rows: JsonValue[] = [{ id: 'r-1', retractedAt: [] }]
		const resolver = makeStubResolver(
			{ 'first-page': { 'response-body': { rows } } },
			{},
		)
		expect(
			resolveCheck(
				forAny,
				resolver,
				noneCollectionTyped,
				NO_REFERENCE_SET_KEYS,
				DEFAULT_BUDGET,
				PATH,
			).resolution,
		).toBe('false')
		expect(
			resolveCheck(
				forAll,
				resolver,
				noneCollectionTyped,
				NO_REFERENCE_SET_KEYS,
				DEFAULT_BUDGET,
				PATH,
			).resolution,
		).toBe('false')
	})

	it('agree (both insufficient-evidence) on an empty page', () => {
		const resolver = makeStubResolver(
			{ 'first-page': { 'response-body': { rows: [] } } },
			{},
		)
		expect(
			resolveCheck(
				forAny,
				resolver,
				noneCollectionTyped,
				NO_REFERENCE_SET_KEYS,
				DEFAULT_BUDGET,
				PATH,
			).resolution,
		).toBe('insufficient-evidence')
		expect(
			resolveCheck(
				forAll,
				resolver,
				noneCollectionTyped,
				NO_REFERENCE_SET_KEYS,
				DEFAULT_BUDGET,
				PATH,
			).resolution,
		).toBe('insufficient-evidence')
	})

	// P6: `pointerDenotesCollection` here is `noneCollectionTyped`, which
	// answers false for every pointer, so this case proves Decision 3's
	// unconditional rule: a quantifier's `collection` is treated as
	// collection-typed on ABSENT regardless of what the predicate says, and
	// the predicate is never even consulted. A predicate that happened to
	// answer true here would only prove it was consulted and got true, not
	// that it was never consulted.
	it('agree (both insufficient-evidence) on an absent, declared-collection-typed page (Decision 3)', () => {
		const resolver = makeStubResolver(
			{ 'first-page': { 'response-body': {} } },
			{},
		)
		expect(
			resolveCheck(
				forAny,
				resolver,
				noneCollectionTyped,
				NO_REFERENCE_SET_KEYS,
				DEFAULT_BUDGET,
				PATH,
			).resolution,
		).toBe('insufficient-evidence')
		expect(
			resolveCheck(
				forAll,
				resolver,
				noneCollectionTyped,
				NO_REFERENCE_SET_KEYS,
				DEFAULT_BUDGET,
				PATH,
			).resolution,
		).toBe('insufficient-evidence')
	})
})

describe('a quantifier over a reference-set-backed predicate (O-006 shape)', () => {
	const check = findCheck('O-006') // for-all(page, set-membership(@/id, {referenceSet}))
	// The declared members and keys of gate-c-contract.ts's own reference set,
	// read off the fixture itself. An earlier version of this
	// block substituted flat id strings for the declared `{ id: 'r-001' }`
	// objects and deferred the member shape to "Story 4.1's resolver", and
	// that substitution is why no suite caught the resolver returning members
	// unprojected: against the real declaration every one of these cases
	// resolved false.
	const declaredSet = gateCContract.referenceSets?.['expected-export-rows']
	if (declaredSet === undefined) {
		throw new Error(
			'fixture setup: gateCContract declares no expected-export-rows',
		)
	}
	const referenceSets = {
		'expected-export-rows': declaredSet.members as JsonValue[],
	}
	const referenceSetKeys = { 'expected-export-rows': declaredSet.keys }
	const resolveAgainst = (rows: JsonValue[], expression: Expression = check) =>
		resolveCheck(
			expression,
			makeStubResolver(
				{ 'first-page': { 'response-body': { rows } } },
				referenceSets,
			),
			noneCollectionTyped,
			referenceSetKeys,
			DEFAULT_BUDGET,
			PATH,
		).resolution

	it('resolves true when every id is a member of the declared object members', () => {
		expect(resolveAgainst([{ id: 'r-001' }, { id: 'r-002' }])).toBe('true')
	})

	it('resolves false when one id is not a member', () => {
		expect(resolveAgainst([{ id: 'r-001' }, { id: 'r-999' }])).toBe('false')
	})

	// The polarity whose failure is invisible. "None of these appear" is
	// spelled by negating the predicate, and an always-false set-membership
	// makes that whole quantifier true for every page forever, so this case is
	// the one that would pass while establishing nothing.
	it('resolves false, under the negated spelling, when a member of the set IS present', () => {
		const forbidden: Expression = {
			op: 'for-all',
			collection: { pointer: '/interactions/first-page/response-body/rows' },
			predicate: {
				op: 'not',
				operands: [
					{
						op: 'set-membership',
						operands: [
							{ pointer: '@/id' },
							{ referenceSet: 'expected-export-rows' },
						],
					},
				],
			},
		}
		expect(resolveAgainst([{ id: 'r-001' }], forbidden)).toBe('false')
		expect(resolveAgainst([{ id: 'r-999' }], forbidden)).toBe('true')
	})

	// A row carrying fields the reference set does not declare is the ordinary
	// case, and it is the one whole-member comparison could never answer.
	it('resolves true for rows carrying fields the reference set does not declare', () => {
		expect(
			resolveAgainst([
				{ id: 'r-001', datasetId: 'ds-7' },
				{ id: 'r-002', datasetId: 'ds-8' },
			]),
		).toBe('true')
	})
})

describe("set-membership's set-operand projection guards", () => {
	const check: Expression = {
		op: 'set-membership',
		operands: [
			{ pointer: '/interactions/x/response-body/id' },
			{ referenceSet: 'rows' },
		],
	}
	const resolveWith = (
		members: JsonValue[],
		keys: readonly string[],
		resolver = makeStubResolver(
			{ x: { 'response-body': { id: 'r-1' } } },
			{ rows: members },
		),
	) =>
		resolveCheck(
			check,
			resolver,
			noneCollectionTyped,
			{ rows: keys },
			DEFAULT_BUDGET,
			PATH,
		)

	it('projects a declared single-key set down to that key', () => {
		expect(resolveWith([{ id: 'r-1' }, { id: 'r-2' }], ['id']).resolution).toBe(
			'true',
		)
		expect(resolveWith([{ id: 'r-2' }], ['id']).resolution).toBe('false')
	})

	it('throws a plain Error, never a RuntimeFault, on a multi-key reference set', () => {
		const error = plainErrorOf(() =>
			resolveWith([{ id: 'r-1', tenant: 't' }], ['id', 'tenant']),
		)
		expect(error).not.toBeInstanceOf(RuntimeFault)
		expect(error.message).toContain('declares 2 keys')
	})

	it('throws a plain Error when a declared member carries no own property for the declared key', () => {
		const error = plainErrorOf(() => resolveWith([{ other: 'r-1' }], ['id']))
		expect(error).not.toBeInstanceOf(RuntimeFault)
		expect(error.message).toContain('carries no own property "id"')
	})

	// The array guard owns a non-array set operand, so the projection hands it
	// through untouched, so one guard reports the shape and one only.
	it('leaves a non-array set operand to the array-narrowing guard even with keys declared', () => {
		const error = plainErrorOf(() =>
			resolveWith(
				[],
				['id'],
				makeResolverWithMisbehavingReferenceSet(
					{ x: { 'response-body': { id: 'r-1' } } },
					{},
					'rows',
					42,
				),
			),
		)
		expect(error.message).toContain('must resolve to an array')
	})
})

describe('a quantifier over shape (O-005 shape)', () => {
	const check = findCheck('O-005') // for-all(page, shape(@/, descriptor))
	const conformingRow = {
		id: 'r-1',
		datasetId: 'ds-7',
		capturedAt: '2026-01-01T00:00:00Z',
		payload: {},
	}

	it("resolves true, proving a leaf operator's own two-valued result reaches the quantifier fold correctly", () => {
		const rows: JsonValue[] = [conformingRow, { ...conformingRow, id: 'r-2' }]
		const resolver = makeStubResolver(
			{ 'first-page': { 'response-body': { rows } } },
			{},
		)
		expect(
			resolveCheck(
				check,
				resolver,
				noneCollectionTyped,
				NO_REFERENCE_SET_KEYS,
				DEFAULT_BUDGET,
				PATH,
			).resolution,
		).toBe('true')
	})

	it('resolves false when one element does not conform (missing a required key)', () => {
		const { payload: _payload, ...nonConforming } = conformingRow
		const rows: JsonValue[] = [conformingRow, nonConforming]
		const resolver = makeStubResolver(
			{ 'first-page': { 'response-body': { rows } } },
			{},
		)
		expect(
			resolveCheck(
				check,
				resolver,
				noneCollectionTyped,
				NO_REFERENCE_SET_KEYS,
				DEFAULT_BUDGET,
				PATH,
			).resolution,
		).toBe('false')
	})
})

describe('quantifier fold correctness (P11)', () => {
	it('a mixed fold: one true child, one insufficient-evidence child, one false child', () => {
		// The predicate is `ordering`, and it used to be `existence`.
		// `existence` is total over a present, empty array and answers true
		// there, so it can no longer produce the insufficient-evidence child
		// this fold needs. `ordering` has to read a member, so the empty second
		// element still trips the condition.
		const check: Expression = {
			op: 'for-all',
			collection: { pointer: '/interactions/x/response-body/rows' },
			predicate: {
				op: 'ordering',
				operands: [{ pointer: '@/tags' }],
				key: 'capturedAt',
				order: 'ascending',
			},
		}
		const rows: JsonValue[] = [
			{ tags: [{ capturedAt: 1 }, { capturedAt: 2 }] },
			{ tags: [] },
			{},
		]
		const resolver = makeStubResolver({ x: { 'response-body': { rows } } }, {})
		const result = resolveCheck(
			check,
			resolver,
			noneCollectionTyped,
			NO_REFERENCE_SET_KEYS,
			DEFAULT_BUDGET,
			PATH,
		)
		// allOf checks 'false' first, so the false third child wins the fold.
		expect(result.resolution).toBe('false')
		expect(result.children.map((child) => child.resolution)).toEqual([
			'true',
			'insufficient-evidence',
			'false',
		])
	})

	it("a nested quantifier's own collection operand resolves against the OUTER bound element, not the inner one, before its loop starts", () => {
		const check: Expression = {
			op: 'for-all',
			collection: { pointer: '/interactions/x/response-body/groups' },
			predicate: {
				op: 'for-all',
				collection: { pointer: '@/innerRows' },
				predicate: { op: 'existence', operands: [{ pointer: '@/id' }] },
			},
		}
		const groups: JsonValue[] = [
			{ innerRows: [{ id: 'a' }, { id: 'b' }] },
			{ innerRows: [{ id: 'c' }] },
		]
		const resolver = makeStubResolver(
			{ x: { 'response-body': { groups } } },
			{},
		)
		// If the inner quantifier's collection operand were wrongly resolved
		// against an already-rebound inner element instead of the still-in-scope
		// outer one, `@/innerRows` would find no such key on `{ id: 'a' }`,
		// resolve ABSENT, and trip the empty-collection condition for every
		// outer element, giving insufficient-evidence instead of true.
		const result = resolveCheck(
			check,
			resolver,
			noneCollectionTyped,
			NO_REFERENCE_SET_KEYS,
			DEFAULT_BUDGET,
			PATH,
		)
		expect(result.resolution).toBe('true')
	})
})

describe('the empty-collection introduction condition over an observed empty collection (Decision 1, AC 7 point 5)', () => {
	it("trips on ordering's sole operand resolving [], never ordering's own vacuous-true answer for a short array", () => {
		const check: Expression = {
			op: 'ordering',
			operands: [{ pointer: '/interactions/x/response-body/rows' }],
			key: 'capturedAt',
			order: 'ascending',
		}
		const resolver = makeStubResolver(
			{ x: { 'response-body': { rows: [] } } },
			{},
		)
		const result = resolveCheck(
			check,
			resolver,
			noneCollectionTyped,
			NO_REFERENCE_SET_KEYS,
			DEFAULT_BUDGET,
			PATH,
		)
		expect(result).toEqual({
			resolution: 'insufficient-evidence',
			introductionCondition: 'empty-collection',
			children: [],
		})
	})

	it("does not trip on countTolerance's sole operand resolving [], because counting an observed empty collection answers zero", () => {
		const check: Expression = {
			op: 'count-tolerance',
			operands: [{ pointer: '/interactions/x/response-body/rows' }],
			expected: 3,
			tolerance: 0,
			relative: false,
		}
		const resolver = makeStubResolver(
			{ x: { 'response-body': { rows: [] } } },
			{},
		)
		const result = resolveCheck(
			check,
			resolver,
			noneCollectionTyped,
			NO_REFERENCE_SET_KEYS,
			DEFAULT_BUDGET,
			PATH,
		)
		// Zero rows where three were expected is a defect the contract caught.
		// AD-4 keeps a detection a detection rather than converting it into an
		// abstention.
		expect(result).toEqual({
			resolution: 'false',
			introductionCondition: null,
			children: [],
		})
	})

	it("trips on containment's container resolving []", () => {
		const check: Expression = {
			op: 'containment',
			operands: [
				{ pointer: '/interactions/x/response-body/rows' },
				{ literal: 'a' },
			],
		}
		const resolver = makeStubResolver(
			{ x: { 'response-body': { rows: [] } } },
			{},
		)
		const result = resolveCheck(
			check,
			resolver,
			noneCollectionTyped,
			NO_REFERENCE_SET_KEYS,
			DEFAULT_BUDGET,
			PATH,
		)
		expect(result.resolution).toBe('insufficient-evidence')
	})

	it("trips on setMembership's set operand via a reference set resolving to zero members", () => {
		const check: Expression = {
			op: 'set-membership',
			operands: [
				{ pointer: '/interactions/x/response-body/id' },
				{ referenceSet: 'empty-set' },
			],
		}
		const resolver = makeStubResolver(
			{ x: { 'response-body': { id: 'r-1' } } },
			{ 'empty-set': [] },
		)
		const result = resolveCheck(
			check,
			resolver,
			noneCollectionTyped,
			NO_REFERENCE_SET_KEYS,
			DEFAULT_BUDGET,
			PATH,
		)
		expect(result.resolution).toBe('insufficient-evidence')
	})

	it("trips on equality's first operand resolving [], an operator outside Story 3.1's original four", () => {
		const check: Expression = {
			op: 'equality',
			operands: [
				{ pointer: '/interactions/x/response-body/rows' },
				{ literal: 'anything' },
			],
		}
		const resolver = makeStubResolver(
			{ x: { 'response-body': { rows: [] } } },
			{},
		)
		const result = resolveCheck(
			check,
			resolver,
			noneCollectionTyped,
			NO_REFERENCE_SET_KEYS,
			DEFAULT_BUDGET,
			PATH,
		)
		expect(result.resolution).toBe('insufficient-evidence')
	})
})

// AD-4's introduction condition asks whether the evidence channel produced an
// answer, and a present, empty array is an answer for an operator that reads a
// property of the collection itself. These are the three operators that do:
// `count-tolerance` reads its cardinality, `existence` and `absence` read its
// presence.
describe('operators total over an observed empty collection resolve rather than abstain', () => {
	const ROWS = '/interactions/x/response-body/rows'
	const emptyRowsResolver = makeStubResolver(
		{ x: { 'response-body': { rows: [] } } },
		{},
	)
	const resolveOverEmptyRows = (
		check: Expression,
		pointerDenotesCollection = noneCollectionTyped,
	) =>
		resolveCheck(
			check,
			emptyRowsResolver,
			pointerDenotesCollection,
			NO_REFERENCE_SET_KEYS,
			DEFAULT_BUDGET,
			PATH,
		)

	it('"this collection should be empty" resolves true: count-tolerance with expected 0 over an observed empty collection', () => {
		const result = resolveOverEmptyRows({
			op: 'count-tolerance',
			operands: [{ pointer: ROWS }],
			expected: 0,
			tolerance: 0,
			relative: false,
		})
		expect(result).toEqual({
			resolution: 'true',
			introductionCondition: null,
			children: [],
		})
	})

	it('existence over an observed empty collection resolves true, since the value is present', () => {
		const result = resolveOverEmptyRows({
			op: 'existence',
			operands: [{ pointer: ROWS }],
		})
		expect(result).toEqual({
			resolution: 'true',
			introductionCondition: null,
			children: [],
		})
	})

	it("absence over an observed empty collection resolves false, keeping AD-26's exact complement of existence", () => {
		const result = resolveOverEmptyRows({
			op: 'absence',
			operands: [{ pointer: ROWS }],
		})
		expect(result).toEqual({
			resolution: 'false',
			introductionCondition: null,
			children: [],
		})
	})

	it('a collection-typed pointer that did not resolve still abstains under count-tolerance, so a missing collection never certifies as empty', () => {
		const missing = '/interactions/x/response-body/missing'
		const result = resolveCheck(
			{
				op: 'count-tolerance',
				operands: [{ pointer: missing }],
				expected: 0,
				tolerance: 0,
				relative: false,
			},
			emptyRowsResolver,
			makeStubPointerDenotesCollection([missing]),
			NO_REFERENCE_SET_KEYS,
			DEFAULT_BUDGET,
			PATH,
		)
		expect(result).toEqual({
			resolution: 'insufficient-evidence',
			introductionCondition: 'empty-collection',
			children: [],
		})
	})

	it("AD-4's struck disjunction stays closed: any(count-tolerance(coll, 0, 0), for-all(coll, absence)) abstains over an empty collection", () => {
		// The count-tolerance branch now resolves true, and the disjunction is
		// still insufficient-evidence. `anyOf` is weaker than logical
		// disjunction on purpose, so a sibling that examined nothing is never
		// rescued. That fold is what closes this fail-open; the leaf
		// interception never was.
		const result = resolveOverEmptyRows({
			op: 'any',
			operands: [
				{
					op: 'count-tolerance',
					operands: [{ pointer: ROWS }],
					expected: 0,
					tolerance: 0,
					relative: false,
				},
				{
					op: 'for-all',
					collection: { pointer: ROWS },
					predicate: {
						op: 'absence',
						operands: [{ pointer: '@/retractedAt' }],
					},
				},
			],
		})
		expect(result.resolution).toBe('insufficient-evidence')
		expect(result.children.map((child) => child.resolution)).toEqual([
			'true',
			'insufficient-evidence',
		])
	})
})

describe('ABSENT on a { pointer } operand: collection-typed vs not (AC 3, Decision 3, AC 7 point 6)', () => {
	const missingPointer = '/interactions/x/response-body/missing'
	const check: Expression = {
		op: 'existence',
		operands: [{ pointer: missingPointer }],
	}
	const resolver = makeStubResolver({ x: { 'response-body': {} } }, {})

	it('resolves insufficient-evidence when the pointer is declared collection-typed', () => {
		const collectionTyped = makeStubPointerDenotesCollection([missingPointer])
		const result = resolveCheck(
			check,
			resolver,
			collectionTyped,
			NO_REFERENCE_SET_KEYS,
			DEFAULT_BUDGET,
			PATH,
		)
		expect(result).toEqual({
			resolution: 'insufficient-evidence',
			introductionCondition: 'empty-collection',
			children: [],
		})
	})

	it("resolves existence's own ordinary ABSENT answer (false) for the identical operand when it is not declared collection-typed", () => {
		const result = resolveCheck(
			check,
			resolver,
			noneCollectionTyped,
			NO_REFERENCE_SET_KEYS,
			DEFAULT_BUDGET,
			PATH,
		)
		expect(result).toEqual({
			resolution: 'false',
			introductionCondition: null,
			children: [],
		})
	})
})

describe('the real covers-by-key dispatch branch (AC 3, AC 4, Decision 1, Decision 2, Decision 7)', () => {
	const coversByKeyCheck = findPopulatedCheck('O-001')

	const resolveCoversByKey = (
		resolver: ReturnType<typeof makeStubResolver>,
		pointerDenotesCollection = noneCollectionTyped,
	) =>
		resolveCheck(
			coversByKeyCheck,
			resolver,
			pointerDenotesCollection,
			NO_REFERENCE_SET_KEYS,
			DEFAULT_BUDGET,
			PATH,
		)

	it('resolves true when expected and actual agree on id, in any order (positive)', () => {
		const resolver = makeStubResolver(
			{
				list: {
					'response-body': {
						items: [{ id: 't-3' }, { id: 't-1' }, { id: 't-2' }],
					},
				},
			},
			{ 'expected-things': [{ id: 't-1' }, { id: 't-2' }, { id: 't-3' }] },
		)
		expect(resolveCoversByKey(resolver).resolution).toBe('true')
	})

	it('resolves false when actual carries a strict subset of expected (missing/omission)', () => {
		const resolver = makeStubResolver(
			{
				list: {
					'response-body': { items: [{ id: 't-1' }, { id: 't-2' }] },
				},
			},
			{ 'expected-things': [{ id: 't-1' }, { id: 't-2' }, { id: 't-3' }] },
		)
		expect(resolveCoversByKey(resolver).resolution).toBe('false')
	})

	it('resolves false on the historical [n-1, n-1, n-1] duplicate-padding shape', () => {
		const resolver = makeStubResolver(
			{
				list: {
					'response-body': {
						items: [{ id: 't-1' }, { id: 't-1' }, { id: 't-1' }],
					},
				},
			},
			{ 'expected-things': [{ id: 't-1' }, { id: 't-2' }, { id: 't-3' }] },
		)
		expect(resolveCoversByKey(resolver).resolution).toBe('false')
	})

	it('resolves false when actual carries every expected id plus one distinct extra (unexpected)', () => {
		const resolver = makeStubResolver(
			{
				list: {
					'response-body': {
						items: [{ id: 't-1' }, { id: 't-2' }, { id: 't-3' }, { id: 't-4' }],
					},
				},
			},
			{ 'expected-things': [{ id: 't-1' }, { id: 't-2' }, { id: 't-3' }] },
		)
		expect(resolveCoversByKey(resolver).resolution).toBe('false')
	})

	it('resolves false when two different actual records share one id value (duplicate-key, distinct from padding)', () => {
		const resolver = makeStubResolver(
			{
				list: {
					'response-body': {
						items: [
							{ id: 't-1', label: 'a' },
							{ id: 't-1', label: 'b' },
						],
					},
				},
			},
			{ 'expected-things': [{ id: 't-1' }, { id: 't-2' }] },
		)
		expect(resolveCoversByKey(resolver).resolution).toBe('false')
	})

	it("resolves insufficient-evidence over two genuinely empty collections (empty-set), never coversByKey's own vacuous-true answer", () => {
		// coversByKey([], [], ...) itself returns true (operators.test.ts's own
		// direct unit test): a vacuous bijection is a correct answer for the
		// pure function, which has no insufficient-evidence to return. Here
		// resolveNode's own empty-array interception fires first, so the
		// dispatch-level answer differs; neither contradicts the other.
		const resolver = makeStubResolver(
			{ list: { 'response-body': { items: [] } } },
			{ 'expected-things': [] },
		)
		expect(resolveCoversByKey(resolver)).toEqual({
			resolution: 'insufficient-evidence',
			introductionCondition: 'empty-collection',
			children: [],
		})
	})

	it('resolves false when expected resolves ABSENT, an undeclared referenceSet identifier (Decision 1)', () => {
		const resolver = makeStubResolver(
			{ list: { 'response-body': { items: [{ id: 't-1' }] } } },
			{}, // 'expected-things' undeclared: makeStubResolver's own `?? ABSENT` fallback.
		)
		expect(resolveCoversByKey(resolver).resolution).toBe('false')
	})

	// The load-bearing contrast fixture (AC 4 point 8): the identical
	// collection-typed-ABSENT shape the "ABSENT on a { pointer } operand"
	// block above pins as insufficient-evidence for `existence`. covers-by-key
	// resolves false instead (Decision 1), even though the pointer is
	// declared collection-typed here too, proving the AD-4 override is
	// unconditional rather than a case where pointerDenotesCollection
	// happens to answer false.
	it("resolves false when actual resolves ABSENT, even though its pointer is declared collection-typed (Decision 1, contrast with existence's insufficient-evidence answer above)", () => {
		const resolver = makeStubResolver(
			{ list: { 'response-body': {} } },
			{ 'expected-things': [{ id: 't-1' }] },
		)
		const collectionTyped = makeStubPointerDenotesCollection([
			'/interactions/list/response-body/items',
		])
		expect(resolveCoversByKey(resolver, collectionTyped).resolution).toBe(
			'false',
		)
	})

	it('resolves false when actual resolves to a non-array, non-ABSENT value (type mismatch, Decision 2)', () => {
		const resolver = makeStubResolver(
			{ list: { 'response-body': { items: 'not-an-array' } } },
			{ 'expected-things': [{ id: 't-1' }] },
		)
		expect(resolveCoversByKey(resolver).resolution).toBe('false')
	})

	it('excludes an actual element missing actualKey from the match index, reading an otherwise-matching expected element as omitted', () => {
		const resolver = makeStubResolver(
			{
				list: {
					'response-body': {
						items: [{ notId: 't-1' }, { id: 't-2' }],
					},
				},
			},
			{ 'expected-things': [{ id: 't-1' }, { id: 't-2' }] },
		)
		expect(resolveCoversByKey(resolver).resolution).toBe('false')
	})

	it("resolves false when an expected element is missing expectedKey, via that element's own failed lookup", () => {
		const resolver = makeStubResolver(
			{
				list: {
					'response-body': { items: [{ id: 't-1' }, { id: 't-2' }] },
				},
			},
			{ 'expected-things': [{ notId: 't-1' }, { id: 't-2' }] },
		)
		expect(resolveCoversByKey(resolver).resolution).toBe('false')
	})

	it("throws a plain Error, never a RuntimeFault, when the expected operand's array-narrowing guard trips on a non-array, non-ABSENT resolved value (Decision 3)", () => {
		const misbehavingResolver = makeResolverWithMisbehavingReferenceSet(
			{ list: { 'response-body': { items: [{ id: 't-1' }] } } },
			{},
			'expected-things',
			42,
		)
		const error = plainErrorOf(() =>
			resolveCheck(
				coversByKeyCheck,
				misbehavingResolver,
				noneCollectionTyped,
				NO_REFERENCE_SET_KEYS,
				DEFAULT_BUDGET,
				PATH,
			),
		)
		expect(error).toBeInstanceOf(Error)
		expect(error).not.toBeInstanceOf(RuntimeFault)
		expect(error.message).toContain('covers-by-key')
	})

	it('the guard fires even when actual is genuinely empty (Decision 7): the guard outranks emptiness', () => {
		const misbehavingResolver = makeResolverWithMisbehavingReferenceSet(
			{ list: { 'response-body': { items: [] } } },
			{},
			'expected-things',
			42,
		)
		const error = plainErrorOf(() =>
			resolveCheck(
				coversByKeyCheck,
				misbehavingResolver,
				noneCollectionTyped,
				NO_REFERENCE_SET_KEYS,
				DEFAULT_BUDGET,
				PATH,
			),
		)
		expect(error).toBeInstanceOf(Error)
		expect(error).not.toBeInstanceOf(RuntimeFault)
	})

	it('a malformed actual outranks a genuinely empty expected (Decision 7): resolves false, never insufficient-evidence', () => {
		const resolver = makeStubResolver(
			{ list: { 'response-body': { items: 'not-an-array' } } },
			{ 'expected-things': [] },
		)
		expect(resolveCoversByKey(resolver).resolution).toBe('false')
	})

	it('an ABSENT expected outranks a genuinely empty actual (Decision 7): resolves false, never insufficient-evidence', () => {
		const resolver = makeStubResolver(
			{ list: { 'response-body': { items: [] } } },
			{}, // 'expected-things' undeclared -> ABSENT.
		)
		expect(resolveCoversByKey(resolver).resolution).toBe('false')
	})

	it('an ABSENT actual outranks a genuinely empty expected (Decision 7): resolves false, never insufficient-evidence', () => {
		const resolver = makeStubResolver(
			{ list: { 'response-body': {} } },
			{ 'expected-things': [] },
		)
		expect(resolveCoversByKey(resolver).resolution).toBe('false')
	})

	it('a genuinely empty actual against a non-empty, well-formed expected resolves insufficient-evidence (Decision 7, the asymmetric single-empty-operand case)', () => {
		const resolver = makeStubResolver(
			{ list: { 'response-body': { items: [] } } },
			{ 'expected-things': [{ id: 't-1' }] },
		)
		expect(resolveCoversByKey(resolver)).toEqual({
			resolution: 'insufficient-evidence',
			introductionCondition: 'empty-collection',
			children: [],
		})
	})

	it('a genuinely empty expected against a non-empty, well-formed actual resolves insufficient-evidence (Decision 7, the mirror asymmetric case)', () => {
		const resolver = makeStubResolver(
			{ list: { 'response-body': { items: [{ id: 't-1' }] } } },
			{ 'expected-things': [] },
		)
		expect(resolveCoversByKey(resolver)).toEqual({
			resolution: 'insufficient-evidence',
			introductionCondition: 'empty-collection',
			children: [],
		})
	})
})

describe('array-narrowing guards fire only where a schema-guaranteed array is missing (AC 7 point 8)', () => {
	it("throws a plain Error when setMembership's SetOperand position resolves to a non-array", () => {
		// P18: only the referenceSet position ('x') resolves badly; the value
		// operand resolves normally, isolating exactly the guarded position.
		const misbehavingResolver = makeResolverWithMisbehavingReferenceSet(
			{ x: { 'response-body': { id: 'r-1' } } },
			{},
			'x',
			42,
		)
		const check: Expression = {
			op: 'set-membership',
			operands: [
				{ pointer: '/interactions/x/response-body/id' },
				{ referenceSet: 'x' },
			],
		}
		const error = plainErrorOf(() =>
			resolveCheck(
				check,
				misbehavingResolver,
				noneCollectionTyped,
				NO_REFERENCE_SET_KEYS,
				DEFAULT_BUDGET,
				PATH,
			),
		)
		expect(error).toBeInstanceOf(Error)
		expect(error).not.toBeInstanceOf(RuntimeFault)
		expect(error.message).toContain('set-membership')
	})

	it("throws a plain Error when containment's { referenceSet } candidate resolves to a non-array", () => {
		const misbehavingResolver = makeResolverWithMisbehavingReferenceSet(
			{ x: { stdout: 'hello world' } },
			{},
			'x',
			42,
		)
		const check: Expression = {
			op: 'containment',
			operands: [{ pointer: '/interactions/x/stdout' }, { referenceSet: 'x' }],
		}
		const error = plainErrorOf(() =>
			resolveCheck(
				check,
				misbehavingResolver,
				noneCollectionTyped,
				NO_REFERENCE_SET_KEYS,
				DEFAULT_BUDGET,
				PATH,
			),
		)
		expect(error).toBeInstanceOf(Error)
		expect(error).not.toBeInstanceOf(RuntimeFault)
		expect(error.message).toContain('containment')
	})

	it('passes an ordinary { pointer }/{ literal } candidate straight through to containment, unguarded and with no throw', () => {
		const resolver = makeStubResolver({ x: { stdout: 'hello world' } }, {})
		const check: Expression = {
			op: 'containment',
			operands: [{ pointer: '/interactions/x/stdout' }, { literal: 'wor' }],
		}
		const result = resolveCheck(
			check,
			resolver,
			noneCollectionTyped,
			NO_REFERENCE_SET_KEYS,
			DEFAULT_BUDGET,
			PATH,
		)
		expect(result).toEqual({
			resolution: 'true',
			introductionCondition: null,
			children: [],
		})
	})
})

describe('a { literal: [] } operand trips the empty-collection condition exactly as an observed [] does, under every operator that keeps the interception (Decision 7, AC 7 point 9)', () => {
	it('deepEquality against { literal: [] } never resolves true, even against a non-empty observed array', () => {
		const check: Expression = {
			op: 'deep-equality',
			operands: [
				{ pointer: '/interactions/x/response-body/errors' },
				{ literal: [] },
			],
		}
		const resolver = makeStubResolver(
			{ x: { 'response-body': { errors: ['e1'] } } },
			{},
		)
		const result = resolveCheck(
			check,
			resolver,
			noneCollectionTyped,
			NO_REFERENCE_SET_KEYS,
			DEFAULT_BUDGET,
			PATH,
		)
		expect(result).toEqual({
			resolution: 'insufficient-evidence',
			introductionCondition: 'empty-collection',
			children: [],
		})
	})
})

describe('a RuntimeFault from a nested regexMatch propagates undecorated through every dispatch branch (AC 7 point 10)', () => {
	// Structural-tier trigger: unconditional, regardless of the observed
	// string's length or the declared budget. Named for what actually trips it
	// (P8): syntactically valid, but a nested-quantifier shape the structural
	// gate rejects outright, not a compile failure.
	const nestedQuantifierRegexOverPointer: Expression = {
		op: 'regex',
		operands: [{ pointer: '/interactions/x/response-body/value' }],
		pattern: '^(a+)+$',
	}
	const resolver = makeStubResolver(
		{ x: { 'response-body': { value: 'a' } } },
		{},
	)

	// P7: every propagation case asserts all three, matching AC 8's stated
	// convention, not just `.code`.
	const assertBudgetExhausted = (fn: () => unknown) => {
		const fault = faultOf(fn)
		expect(fault).toBeInstanceOf(RuntimeFault)
		expect(fault.code).toBe('budget-exhausted')
		expect(fault.artifactPath).toBe(PATH)
	}

	it('propagates through a bare leaf node', () => {
		assertBudgetExhausted(() =>
			resolveCheck(
				nestedQuantifierRegexOverPointer,
				resolver,
				noneCollectionTyped,
				NO_REFERENCE_SET_KEYS,
				DEFAULT_BUDGET,
				PATH,
			),
		)
	})

	it('propagates through not', () => {
		const check: Expression = {
			op: 'not',
			operands: [nestedQuantifierRegexOverPointer],
		}
		assertBudgetExhausted(() =>
			resolveCheck(
				check,
				resolver,
				noneCollectionTyped,
				NO_REFERENCE_SET_KEYS,
				DEFAULT_BUDGET,
				PATH,
			),
		)
	})

	it('propagates through all, even when a decisive false sibling precedes the throwing node (no short-circuit skips it)', () => {
		// P5: the throwing node sits AFTER the decisive FALSE_NODE, proving
		// all's own already-decided answer never prevents a later operand's own
		// evaluation from running (and faulting).
		const check: Expression = {
			op: 'all',
			operands: [FALSE_NODE, nestedQuantifierRegexOverPointer],
		}
		assertBudgetExhausted(() =>
			resolveCheck(
				check,
				resolver,
				noneCollectionTyped,
				NO_REFERENCE_SET_KEYS,
				DEFAULT_BUDGET,
				PATH,
			),
		)
	})

	it('propagates through any, even when a decisive true sibling precedes the throwing node (no short-circuit skips it)', () => {
		const check: Expression = {
			op: 'any',
			operands: [TRUE_NODE, nestedQuantifierRegexOverPointer],
		}
		assertBudgetExhausted(() =>
			resolveCheck(
				check,
				resolver,
				noneCollectionTyped,
				NO_REFERENCE_SET_KEYS,
				DEFAULT_BUDGET,
				PATH,
			),
		)
	})

	const nestedQuantifierRegexOverBoundElement: Expression = {
		op: 'regex',
		operands: [{ pointer: '@/value' }],
		pattern: '^(a+)+$',
	}
	const quantifierResolver = makeStubResolver(
		{ x: { 'response-body': { rows: [{ value: 'a' }] } } },
		{},
	)
	const rowsCollectionTyped = makeStubPointerDenotesCollection([
		'/interactions/x/response-body/rows',
	])

	it('propagates through for-all', () => {
		const check: Expression = {
			op: 'for-all',
			collection: { pointer: '/interactions/x/response-body/rows' },
			predicate: nestedQuantifierRegexOverBoundElement,
		}
		assertBudgetExhausted(() =>
			resolveCheck(
				check,
				quantifierResolver,
				rowsCollectionTyped,
				NO_REFERENCE_SET_KEYS,
				DEFAULT_BUDGET,
				PATH,
			),
		)
	})

	it('propagates through for-any', () => {
		const check: Expression = {
			op: 'for-any',
			collection: { pointer: '/interactions/x/response-body/rows' },
			predicate: nestedQuantifierRegexOverBoundElement,
		}
		assertBudgetExhausted(() =>
			resolveCheck(
				check,
				quantifierResolver,
				rowsCollectionTyped,
				NO_REFERENCE_SET_KEYS,
				DEFAULT_BUDGET,
				PATH,
			),
		)
	})

	it('the other regex fault code (operator-cannot-accept-operand) also propagates undecorated, for a pattern that fails to compile', () => {
		const check: Expression = {
			op: 'regex',
			operands: [{ pointer: '/interactions/x/response-body/value' }],
			// Passes AnchoredPattern's own first/last-character check, but is
			// unbalanced ECMA-262 source: a genuine compile failure, distinct
			// from the structural nested-quantifier trigger above (P8).
			pattern: '^([a$',
		}
		const fault = faultOf(() =>
			resolveCheck(
				check,
				resolver,
				noneCollectionTyped,
				NO_REFERENCE_SET_KEYS,
				DEFAULT_BUDGET,
				PATH,
			),
		)
		expect(fault).toBeInstanceOf(RuntimeFault)
		expect(fault.code).toBe('operator-cannot-accept-operand')
		expect(fault.artifactPath).toBe(PATH)
	})
})

describe("resolveNode's out-of-union op guard (P16)", () => {
	it('throws a plain Error, never a RuntimeFault, naming the offending op, for an op outside the closed union', () => {
		const check = { op: 'not-an-op', operands: [] } as unknown as Expression
		const error = plainErrorOf(() => resolve(check))
		expect(error.message).toContain('unrecognized expression.op')
		expect(error.message).toContain('not-an-op')
	})

	it("throws for op: 'constructor', an Object.prototype property name, not Object.prototype.constructor itself", () => {
		// operatorHandlers is a plain object, so a naive `operatorHandlers[op]`
		// lookup would find the inherited Object constructor for this exact op
		// value instead of undefined.
		const check = { op: 'constructor', operands: [] } as unknown as Expression
		const error = plainErrorOf(() => resolve(check))
		expect(error.message).toContain('unrecognized expression.op')
		expect(error.message).toContain('constructor')
	})
})

describe('a type-mismatch quantifier collection resolves insufficient-evidence, never a thrown fault (Decision 4, AC 7 point 11)', () => {
	it('for-all whose collection operand resolves to a plain object', () => {
		const check: Expression = {
			op: 'for-all',
			collection: { pointer: '/interactions/x/response-body/rows' },
			predicate: { op: 'existence', operands: [{ pointer: '@/id' }] },
		}
		const resolver = makeStubResolver(
			{ x: { 'response-body': { rows: { foo: 'bar' } } } },
			{},
		)
		const result = resolveCheck(
			check,
			resolver,
			noneCollectionTyped,
			NO_REFERENCE_SET_KEYS,
			DEFAULT_BUDGET,
			PATH,
		)
		expect(result).toEqual({
			resolution: 'insufficient-evidence',
			introductionCondition: 'empty-collection',
			children: [],
		})
	})
})
