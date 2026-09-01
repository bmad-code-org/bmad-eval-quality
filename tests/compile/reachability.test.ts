import { describe, expect, it } from 'vitest'
import {
	checkBoundElementScope,
	checkEvidenceReachability,
	evaluatePointerReachability,
} from '../../src/core/compile/reachability.ts'
import { makeResolveOperand } from '../../src/core/evaluate/evidence-resolution.ts'
import { ABSENT } from '../../src/core/evaluate/resolved-value.ts'
import { StructuralFailure } from '../../src/core/failure-codes.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import type { Observation } from '../../src/core/schemas/sealed-run-record.ts'
import { buildPlanIndex } from '../../src/core/seal/plan-index.ts'
import { gateCContract } from '../schemas/fixtures/gate-c-contract.ts'
import { populatedContract } from '../schemas/fixtures/relevance-contracts.ts'

function observation(overrides: Partial<Observation> = {}): Observation {
	return {
		observationId: 'obs-1',
		sequence: 1,
		operationId: 'op-1',
		provenance: 'baseline',
		callInputs: { path: null, query: null, header: null, body: null },
		responseBody: null,
		responseHeaders: null,
		responseStatus: null,
		stdout: null,
		stderr: null,
		exitCode: null,
		...overrides,
	}
}

const listThingsOf = (contract: any) =>
	contract.permittedInterfaces[0].operations.find(
		(operation: any) => operation.operationId === 'list-things',
	)

const createThingOf = (contract: any) =>
	contract.permittedInterfaces[0].operations.find(
		(operation: any) => operation.operationId === 'create-thing',
	)

function structuralFailureOf(fn: () => void): StructuralFailure {
	try {
		fn()
	} catch (error) {
		if (error instanceof StructuralFailure) return error
		throw error
	}
	throw new Error('expected a StructuralFailure to be thrown')
}

// ---------------------------------------------------------------------------
// Positive whole-fixture regression anchors (fixtures 29-30)
// ---------------------------------------------------------------------------

describe('positive regression: zero false positives against already-shipped check trees', () => {
	it('fixture 29: checkEvidenceReachability passes over populatedContract and gateCContract with no throw', () => {
		expect(() =>
			checkEvidenceReachability(EvalContract.parse(populatedContract)),
		).not.toThrow()
		expect(() =>
			checkEvidenceReachability(EvalContract.parse(gateCContract)),
		).not.toThrow()
	})

	it('fixture 30: checkBoundElementScope passes over populatedContract and gateCContract with no throw', () => {
		expect(() =>
			checkBoundElementScope(EvalContract.parse(populatedContract)),
		).not.toThrow()
		expect(() =>
			checkBoundElementScope(EvalContract.parse(gateCContract)),
		).not.toThrow()
		// gateCContract's O-004, O-005, and O-006 each use a different "@/"
		// shape inside a different quantifier form, so this exercises real
		// usage rather than only synthetic cases.
	})
})

// ---------------------------------------------------------------------------
// checkEvidenceReachability negative fixtures (31-42)
// ---------------------------------------------------------------------------

describe('checkEvidenceReachability: unreachable-check-evidence', () => {
	it('fixture 31: a pointer naming an undeclared step throws', () => {
		const contract = structuredClone(populatedContract) as any
		contract.oracles[0].check.operands[1] = {
			pointer: '/interactions/no-such-step/response-body/items',
		}
		const failure = structuralFailureOf(() =>
			checkEvidenceReachability(contract),
		)
		expect(failure.code).toBe('unreachable-check-evidence')
	})

	it('fixture 32: an empty interactionPlan throws over the same O-001 check', () => {
		const contract = structuredClone(populatedContract) as any
		contract.interactionPlan = []
		const failure = structuralFailureOf(() =>
			checkEvidenceReachability(contract),
		)
		expect(failure.code).toBe('unreachable-check-evidence')
	})

	it('fixture 33: a step naming an operation no permitted interface declares throws', () => {
		const contract = structuredClone(populatedContract) as any
		contract.interactionPlan[1].operationId = 'no-such-operation'
		const failure = structuralFailureOf(() =>
			checkEvidenceReachability(contract),
		)
		expect(failure.code).toBe('unreachable-check-evidence')
	})

	it('fixture 34: a response-body pointer naming a key in neither requiredKeys nor permittedKeys throws', () => {
		const contract = structuredClone(populatedContract) as any
		contract.oracles[0].check.operands[1] = {
			pointer: '/interactions/list/response-body/notAField',
		}
		const failure = structuralFailureOf(() =>
			checkEvidenceReachability(contract),
		)
		expect(failure.code).toBe('unreachable-check-evidence')
	})

	it('fixture 35: a call-inputs body pointer naming an undeclared key throws', () => {
		const contract = structuredClone(populatedContract) as any
		contract.oracles[0].check.operands[1] = {
			pointer: '/interactions/create/call-inputs/body/notAField',
		}
		const failure = structuralFailureOf(() =>
			checkEvidenceReachability(contract),
		)
		expect(failure.code).toBe('unreachable-check-evidence')
	})

	it('fixture 36: reachability checks requiredKeys ∪ permittedKeys, not permittedKeys alone', () => {
		const contract = structuredClone(populatedContract) as any
		listThingsOf(contract).responseDescriptor.permittedKeys = []
		listThingsOf(contract).responseDescriptor.requiredKeys = ['items']
		expect(() => checkEvidenceReachability(contract)).not.toThrow()
	})

	it('fixture 37: descending past a declared scalar throws; an undeclared or null-typed sibling does not', () => {
		const scalarDescent = structuredClone(populatedContract) as any
		scalarDescent.oracles[0].check = {
			op: 'existence',
			operands: [{ pointer: '/interactions/create/response-body/ok/nested' }],
		}
		const failure = structuralFailureOf(() =>
			checkEvidenceReachability(scalarDescent),
		)
		expect(failure.code).toBe('unreachable-check-evidence')

		const undeclaredType = structuredClone(scalarDescent) as any
		delete createThingOf(undeclaredType).responseDescriptor.types.ok
		expect(() => checkEvidenceReachability(undeclaredType)).not.toThrow()

		const nullType = structuredClone(scalarDescent) as any
		createThingOf(nullType).responseDescriptor.types.ok = null
		expect(() => checkEvidenceReachability(nullType)).not.toThrow()
	})

	it('fixture 38: a root-declared collection admits an array-index tail; the identical pointer fails with no root declared', () => {
		const withRootCollection = structuredClone(populatedContract) as any
		withRootCollection.oracles[0].check = {
			op: 'existence',
			operands: [{ pointer: '/interactions/list/response-body/0' }],
		}
		listThingsOf(withRootCollection).responseDescriptor.collectionLocations = [
			{
				pointer: '',
				expectedCardinality: { mode: 'exact', count: 3 },
				referenceSet: null,
			},
		]
		expect(() => checkEvidenceReachability(withRootCollection)).not.toThrow()

		const withoutRootCollection = structuredClone(withRootCollection) as any
		listThingsOf(withoutRootCollection).responseDescriptor.collectionLocations =
			null
		const failure = structuralFailureOf(() =>
			checkEvidenceReachability(withoutRootCollection),
		)
		expect(failure.code).toBe('unreachable-check-evidence')
	})

	it('fixture 38b: a root-collection index at or past the declared expectedCardinality bound throws, in every mode', () => {
		const cardinalities = [
			{ mode: 'exact', count: 3 },
			{ mode: 'at-most', max: 3 },
			{ mode: 'page-bounded', max: 3 },
		] as const
		for (const expectedCardinality of cardinalities) {
			const contract = structuredClone(populatedContract) as any
			contract.oracles[0].check = {
				op: 'existence',
				operands: [{ pointer: '/interactions/list/response-body/3' }],
			}
			listThingsOf(contract).responseDescriptor.collectionLocations = [
				{ pointer: '', expectedCardinality, referenceSet: null },
			]
			const failure = structuralFailureOf(() =>
				checkEvidenceReachability(contract),
			)
			expect(failure.code, expectedCardinality.mode).toBe(
				'unreachable-check-evidence',
			)

			const inBounds = structuredClone(contract) as any
			inBounds.oracles[0].check.operands[0].pointer =
				'/interactions/list/response-body/2'
			expect(
				() => checkEvidenceReachability(inBounds),
				expectedCardinality.mode,
			).not.toThrow()
		}
	})

	it('fixture 39: stdout/stderr with a non-empty tail throw; the same channels with an empty tail do not', () => {
		for (const channel of ['stdout', 'stderr'] as const) {
			const withTail = structuredClone(populatedContract) as any
			withTail.oracles[0].check = {
				op: 'existence',
				operands: [{ pointer: `/interactions/list/${channel}/nested` }],
			}
			const failure = structuralFailureOf(() =>
				checkEvidenceReachability(withTail),
			)
			expect(failure.code).toBe('unreachable-check-evidence')

			const withoutTail = structuredClone(populatedContract) as any
			withoutTail.oracles[0].check = {
				op: 'existence',
				operands: [{ pointer: `/interactions/list/${channel}` }],
			}
			expect(() => checkEvidenceReachability(withoutTail)).not.toThrow()
		}
	})

	it('fixture 40: response-status, exit-code, response-headers, and an empty-tail response-body all pass once step and operation resolve', () => {
		const pointers = [
			'/interactions/list/response-status',
			'/interactions/list/exit-code',
			'/interactions/list/response-headers',
			'/interactions/list/response-body',
		]
		for (const pointer of pointers) {
			const contract = structuredClone(populatedContract) as any
			contract.oracles[0].check = {
				op: 'existence',
				operands: [{ pointer }],
			}
			expect(() => checkEvidenceReachability(contract), pointer).not.toThrow()
		}
	})

	it('fixture 41: every violation fires on the first oracle and pointer found, not the last', () => {
		const contract = structuredClone(populatedContract) as any
		contract.oracles[0].check.operands[1] = {
			pointer: '/interactions/no-such-step/response-body/items',
		}
		contract.oracles.push({
			id: 'O-002',
			direction: null,
			check: {
				op: 'existence',
				operands: [
					{ pointer: '/interactions/another-no-such-step/response-body/items' },
				],
			},
			polarity: 'expects-hold',
			commentary: null,
		})
		const failure = structuralFailureOf(() =>
			checkEvidenceReachability(contract),
		)
		expect(failure.artifactPath).toContain('oracles[id=O-001]')
	})

	it('fixture 42: artifactPath names the exact operand position, not only the oracle', () => {
		const topLevel = structuredClone(populatedContract) as any
		topLevel.oracles[0].check.operands[1] = {
			pointer: '/interactions/no-such-step/response-body/items',
		}
		const topLevelFailure = structuralFailureOf(() =>
			checkEvidenceReachability(topLevel),
		)
		expect(topLevelFailure.artifactPath).toBe(
			'EvalContract.oracles[id=O-001].check.operands[1]',
		)

		const nested = structuredClone(populatedContract) as any
		nested.oracles[0].check = {
			op: 'for-all',
			collection: { pointer: '/interactions/list/response-body/items' },
			predicate: {
				op: 'existence',
				operands: [
					{ pointer: '/interactions/no-such-step/response-body/items' },
				],
			},
		}
		const nestedFailure = structuralFailureOf(() =>
			checkEvidenceReachability(nested),
		)
		expect(nestedFailure.artifactPath).toBe(
			'EvalContract.oracles[id=O-001].check.predicate.operands[0]',
		)
	})

	// Review finding: `visitExpression`'s `set-membership` case is special-cased
	// to visit only `operands[0]`, unlike every other tuple-shaped op. No other
	// fixture exercises that branch.
	it('review finding: set-membership walks operands[0]: an unreachable pointer there throws', () => {
		const contract = structuredClone(populatedContract) as any
		contract.oracles[0].check = {
			op: 'set-membership',
			operands: [
				{ pointer: '/interactions/no-such-step/response-body/items' },
				{ literal: ['a', 'b'] },
			],
		}
		const failure = structuralFailureOf(() =>
			checkEvidenceReachability(contract),
		)
		expect(failure.code).toBe('unreachable-check-evidence')
	})
})

// ---------------------------------------------------------------------------
// checkBoundElementScope fixtures (43-45)
// ---------------------------------------------------------------------------

describe('checkBoundElementScope: malformed-operator-expression', () => {
	it('fixture 43: a "@/" pointer with no enclosing quantifier at all throws', () => {
		const contract = structuredClone(populatedContract) as any
		contract.oracles[0].check = {
			op: 'existence',
			operands: [{ pointer: '@/x' }],
		}
		const failure = structuralFailureOf(() => checkBoundElementScope(contract))
		expect(failure.code).toBe('malformed-operator-expression')
	})

	it('fixture 44: a nested quantifier whose inner collection carries the outer bound element does not throw', () => {
		const contract = structuredClone(populatedContract) as any
		contract.oracles[0].check = {
			op: 'for-all',
			collection: { pointer: '/interactions/list/response-body/items' },
			predicate: {
				op: 'for-any',
				collection: { pointer: '@/children' },
				predicate: { op: 'existence', operands: [{ pointer: '@/id' }] },
			},
		}
		expect(() => checkBoundElementScope(contract)).not.toThrow()
	})

	it('fixture 45: a "@/" pointer as the first operand of a top-level covers-by-key throws too', () => {
		const contract = structuredClone(populatedContract) as any
		contract.oracles[0].check = {
			op: 'covers-by-key',
			operands: [
				{ pointer: '@/x' },
				{ pointer: '/interactions/list/response-body/items' },
			],
			expectedKey: 'id',
			actualKey: 'id',
		}
		const failure = structuralFailureOf(() => checkBoundElementScope(contract))
		expect(failure.code).toBe('malformed-operator-expression')
	})

	// Review finding: complements fixture 44, which shows a nested quantifier's
	// "collection" may inherit the outer bound element. Here, at the root,
	// `insideQuantifier` starts `false` and `visitExpression`'s for-all/for-any
	// branch visits `collection` at that same value, so a top-level
	// quantifier's own "collection" is never itself inside quantifier scope.
	it('review finding: a top-level quantifier (nothing enclosing it) whose own "collection" carries a "@/" pointer throws', () => {
		const contract = structuredClone(populatedContract) as any
		contract.oracles[0].check = {
			op: 'for-all',
			collection: { pointer: '@/x' },
			predicate: {
				op: 'existence',
				operands: [{ pointer: '/interactions/list/response-body/items' }],
			},
		}
		const failure = structuralFailureOf(() => checkBoundElementScope(contract))
		expect(failure.code).toBe('malformed-operator-expression')
	})

	// Same special-cased set-membership branch as above (checkEvidenceReachability).
	it('review finding: set-membership walks operands[0]: a "@/" pointer there outside any quantifier throws', () => {
		const contract = structuredClone(populatedContract) as any
		contract.oracles[0].check = {
			op: 'set-membership',
			operands: [{ pointer: '@/x' }, { literal: ['a', 'b'] }],
		}
		const failure = structuralFailureOf(() => checkBoundElementScope(contract))
		expect(failure.code).toBe('malformed-operator-expression')
	})
})

// ---------------------------------------------------------------------------
// Parity matrix (Decision 9, fixtures 46-47)
// ---------------------------------------------------------------------------

type ParityCase = {
	readonly label: string
	readonly contract: EvalContract
	readonly pointer: string
	readonly stepObservations: Readonly<Record<string, Observation>>
}

describe('parity matrix (Decision 9)', () => {
	it('fixture 46: every unreachable pointer resolves ABSENT through makeResolveOperand, never a concrete value, never a throw', () => {
		const undeclaredOperationContract = structuredClone(
			populatedContract,
		) as any
		undeclaredOperationContract.interactionPlan[1].operationId =
			'no-such-operation'

		const cases: ParityCase[] = [
			{
				label: 'undeclared step (fixture 31 shape)',
				contract: structuredClone(populatedContract) as any,
				pointer: '/interactions/no-such-step/response-body/items',
				stepObservations: {},
			},
			{
				label: 'undeclared operation (fixture 33 shape)',
				contract: undeclaredOperationContract,
				pointer: '/interactions/list/response-body/items',
				stepObservations: {},
			},
			{
				label: 'undeclared response-body field (fixture 34 shape)',
				contract: structuredClone(populatedContract) as any,
				pointer: '/interactions/list/response-body/notAField',
				stepObservations: {
					list: observation({ responseBody: { items: [{ id: 't-1' }] } }),
				},
			},
			{
				label: 'undeclared call-inputs field (fixture 35 shape)',
				contract: structuredClone(populatedContract) as any,
				pointer: '/interactions/create/call-inputs/body/notAField',
				stepObservations: {
					create: observation({
						callInputs: {
							path: null,
							query: null,
							header: null,
							body: { name: 'thing-1' },
						},
					}),
				},
			},
			{
				label: 'scalar descent (fixture 37 shape, gateCContract)',
				contract: EvalContract.parse(gateCContract),
				pointer: '/interactions/poll/response-body/state/nested',
				stepObservations: {
					poll: observation({
						responseBody: {
							jobId: 'j1',
							state: 'succeeded',
							submittedFilters: {},
						},
					}),
				},
			},
			{
				label: 'stdout tail (fixture 39 shape)',
				contract: structuredClone(populatedContract) as any,
				pointer: '/interactions/list/stdout/nested',
				stepObservations: { list: observation({ stdout: 'log output' }) },
			},
		]

		for (const testCase of cases) {
			const index = buildPlanIndex(
				testCase.contract.interactionPlan,
				testCase.contract.permittedInterfaces,
			)
			const reachability = evaluatePointerReachability(testCase.pointer, index)
			expect(reachability.reachable, testCase.label).toBe(false)

			const resolve = makeResolveOperand(testCase.stepObservations, {})
			const resolved = resolve(
				{ pointer: testCase.pointer },
				ABSENT,
				'artifacts/parity.json',
			)
			expect(resolved, testCase.label).toBe(ABSENT)
		}
	})

	it('fixture 47: every reachable pointer resolves without throwing, to a concrete value or ABSENT', () => {
		const rootCollectionContract = structuredClone(populatedContract) as any
		listThingsOf(
			rootCollectionContract,
		).responseDescriptor.collectionLocations = [
			{
				pointer: '',
				expectedCardinality: { mode: 'exact', count: 2 },
				referenceSet: null,
			},
		]

		const escapedKeyContract = structuredClone(populatedContract) as any
		listThingsOf(escapedKeyContract).responseDescriptor.permittedKeys.push(
			'it/ems',
		)

		const cases: ParityCase[] = [
			{
				label: 'root-collection index (fixture 38 positive half)',
				contract: rootCollectionContract,
				pointer: '/interactions/list/response-body/0',
				stepObservations: {
					list: observation({ responseBody: [{ id: 'a' }, { id: 'b' }] }),
				},
			},
			{
				label: 'escaped key (fixture 3/28 pointer)',
				contract: escapedKeyContract,
				pointer: '/interactions/list/response-body/it~1ems',
				stepObservations: {
					list: observation({ responseBody: { 'it/ems': 'nested-value' } }),
				},
			},
		]

		for (const testCase of cases) {
			const index = buildPlanIndex(
				testCase.contract.interactionPlan,
				testCase.contract.permittedInterfaces,
			)
			const reachability = evaluatePointerReachability(testCase.pointer, index)
			expect(reachability.reachable, testCase.label).toBe(true)

			const resolve = makeResolveOperand(testCase.stepObservations, {})
			expect(
				() =>
					resolve(
						{ pointer: testCase.pointer },
						ABSENT,
						'artifacts/parity.json',
					),
				testCase.label,
			).not.toThrow()
		}
	})
})
