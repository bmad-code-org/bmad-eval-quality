import { describe, expect, it } from 'vitest'
import {
	decodeBoundElementTail,
	makePointerDenotesCollection,
	makeResolveOperand,
	walkTail,
} from '../../src/core/evaluate/evidence-resolution.ts'
import { ABSENT } from '../../src/core/evaluate/resolved-value.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import type { JsonValue } from '../../src/core/schemas/primitives.ts'
import type { Observation } from '../../src/core/schemas/sealed-run-record.ts'
import { decodeTail } from '../../src/core/seal/plan-index.ts'
import { populatedContract } from '../schemas/fixtures/relevance-contracts.ts'

const PATH = 'artifacts/evidence-resolution.json'

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

// ---------------------------------------------------------------------------
// walkTail / decodeBoundElementTail (fixtures 1-10)
// ---------------------------------------------------------------------------

describe('walkTail', () => {
	it('fixture 1: an empty tail returns the root unchanged, including a JSON null root', () => {
		expect(walkTail(null, [])).toBe(null)
		const root = { a: 1 }
		expect(walkTail(root, [])).toBe(root)
	})

	it('fixture 2: a nested object field two levels deep, and an array element by canonical index', () => {
		expect(walkTail({ a: { b: 'deep' } }, ['a', 'b'])).toBe('deep')
		expect(walkTail([10, 20, 30], ['1'])).toBe(20)
	})

	it('fixture 3: a key containing a literal "/" and "~" via the RFC 6901 ~1/~0 escapes', () => {
		const tail = decodeTail('/a~1b/c~0d')
		expect(tail).toEqual(['a/b', 'c~d'])
		const root = { 'a/b': { 'c~d': 'found' } }
		expect(walkTail(root, tail)).toBe('found')
	})

	it('fixture 4: a double-slash tail walks into a genuine empty-string key rather than short-circuiting', () => {
		const tail = decodeTail('/a//b')
		expect(tail).toEqual(['a', '', 'b'])
		const root = { a: { '': { b: 'deep' } } }
		expect(walkTail(root, tail)).toBe('deep')
	})

	it('fixture 5: a non-canonical array-index token resolves ABSENT', () => {
		const array = [10, 20, 30]
		for (const token of ['01', '+1', '1.0', ' 1']) {
			expect(walkTail(array, [token])).toBe(ABSENT)
		}
	})

	it('fixture 6: the RFC 6901 "-" token against an array resolves ABSENT', () => {
		expect(walkTail([10, 20, 30], ['-'])).toBe(ABSENT)
	})

	it('fixture 7: an out-of-range canonical index resolves ABSENT', () => {
		expect(walkTail([1, 2, 3], ['5'])).toBe(ABSENT)
	})

	it('fixture 8: walking a tail into a scalar resolves ABSENT at the first further segment', () => {
		for (const scalar of ['a string', 1, true, null]) {
			expect(walkTail(scalar, ['x'])).toBe(ABSENT)
		}
	})

	it('fixture 9: a genuine own "__proto__" property resolves to its value; a different object with no such own key resolves ABSENT', () => {
		const withOwnProto = JSON.parse(
			'{"__proto__":"own-value","safe":1}',
		) as JsonValue
		expect(Object.hasOwn(withOwnProto as object, '__proto__')).toBe(true)
		expect(walkTail(withOwnProto, ['__proto__'])).toBe('own-value')

		const withoutOwnProto = JSON.parse('{"safe":1}') as JsonValue
		expect(Object.hasOwn(withoutOwnProto as object, '__proto__')).toBe(false)
		expect(walkTail(withoutOwnProto, ['__proto__'])).toBe(ABSENT)
	})

	it('fixture 9: a genuine own "constructor" property resolves to its value; a different object with no such own key resolves ABSENT', () => {
		const withOwnConstructor = JSON.parse(
			'{"constructor":"own-ctor","safe":1}',
		) as JsonValue
		expect(walkTail(withOwnConstructor, ['constructor'])).toBe('own-ctor')

		const withoutOwnConstructor = JSON.parse('{"safe":1}') as JsonValue
		expect(walkTail(withoutOwnConstructor, ['constructor'])).toBe(ABSENT)
	})
})

describe('decodeBoundElementTail', () => {
	it('fixture 10: bare "@/" decodes to zero tokens; "@/x" and "@/a/b" decode to their tokens', () => {
		expect(decodeBoundElementTail('@/')).toEqual([])
		expect(decodeBoundElementTail('@/x')).toEqual(['x'])
		expect(decodeBoundElementTail('@/a/b')).toEqual(['a', 'b'])
	})
})

// ---------------------------------------------------------------------------
// makeResolveOperand (fixtures 11-20)
// ---------------------------------------------------------------------------

describe('makeResolveOperand', () => {
	it('fixture 11: a { literal } operand resolves to itself, for any JSON shape', () => {
		const resolve = makeResolveOperand({}, {})
		expect(resolve({ literal: null }, ABSENT, PATH)).toBe(null)
		expect(resolve({ literal: [] }, ABSENT, PATH)).toEqual([])
		expect(resolve({ literal: { a: { b: 1 } } }, ABSENT, PATH)).toEqual({
			a: { b: 1 },
		})
	})

	it('fixture 12: a { referenceSet } operand resolves the declared array, or ABSENT for an identifier the map omits', () => {
		const resolve = makeResolveOperand(
			{},
			{ 'expected-things': [{ id: 't-1' }] },
		)
		expect(resolve({ referenceSet: 'expected-things' }, ABSENT, PATH)).toEqual([
			{ id: 't-1' },
		])
		expect(resolve({ referenceSet: 'never-declared' }, ABSENT, PATH)).toBe(
			ABSENT,
		)
	})

	it('fixture 13: { referenceSet: "constructor" } resolves ABSENT when the map carries no own "constructor" key, and the declared array when it genuinely does', () => {
		const resolveMissing = makeResolveOperand({}, { 'other-set': [] })
		expect(resolveMissing({ referenceSet: 'constructor' }, ABSENT, PATH)).toBe(
			ABSENT,
		)

		const resolvePresent = makeResolveOperand(
			{},
			{ constructor: [{ id: 'c-1' }] },
		)
		expect(
			resolvePresent({ referenceSet: 'constructor' }, ABSENT, PATH),
		).toEqual([{ id: 'c-1' }])
	})

	it('fixture 14: a pointer naming a step absent from stepObservations resolves ABSENT, including a stepId of "constructor"', () => {
		const resolve = makeResolveOperand({}, {})
		expect(
			resolve(
				{ pointer: '/interactions/no-such-step/response-body' },
				ABSENT,
				PATH,
			),
		).toBe(ABSENT)
		expect(
			resolve(
				{ pointer: '/interactions/constructor/response-body' },
				ABSENT,
				PATH,
			),
		).toBe(ABSENT)
	})

	it('fixture 15: a pointer naming a step the map genuinely does not carry resolves ABSENT, not a thrown error', () => {
		const resolve = makeResolveOperand({ known: observation() }, {})
		expect(
			resolve({ pointer: '/interactions/unknown/response-body' }, ABSENT, PATH),
		).toBe(ABSENT)
	})

	it('fixture 16: an empty tail on each of the seven channels returns the channel root unchanged, including a null root', () => {
		const step = observation({
			responseBody: { a: 1 },
			responseHeaders: { 'x-h': 'v' },
			responseStatus: null,
			stdout: 'out-text',
			stderr: 'err-text',
			exitCode: 0,
			callInputs: {
				path: { id: 'p1' },
				query: { q: 'q1' },
				header: { h: 'h1' },
				body: { b: 'b1' },
			},
		})
		const resolve = makeResolveOperand({ step }, {})
		expect(
			resolve({ pointer: '/interactions/step/response-body' }, ABSENT, PATH),
		).toEqual({ a: 1 })
		expect(
			resolve({ pointer: '/interactions/step/response-headers' }, ABSENT, PATH),
		).toEqual({ 'x-h': 'v' })
		expect(
			resolve({ pointer: '/interactions/step/response-status' }, ABSENT, PATH),
		).toBe(null)
		expect(
			resolve({ pointer: '/interactions/step/stdout' }, ABSENT, PATH),
		).toBe('out-text')
		expect(
			resolve({ pointer: '/interactions/step/stderr' }, ABSENT, PATH),
		).toBe('err-text')
		expect(
			resolve({ pointer: '/interactions/step/exit-code' }, ABSENT, PATH),
		).toBe(0)
		expect(
			resolve({ pointer: '/interactions/step/call-inputs/path' }, ABSENT, PATH),
		).toEqual({ id: 'p1' })
		expect(
			resolve(
				{ pointer: '/interactions/step/call-inputs/query' },
				ABSENT,
				PATH,
			),
		).toEqual({ q: 'q1' })
		expect(
			resolve(
				{ pointer: '/interactions/step/call-inputs/header' },
				ABSENT,
				PATH,
			),
		).toEqual({ h: 'h1' })
		expect(
			resolve({ pointer: '/interactions/step/call-inputs/body' }, ABSENT, PATH),
		).toEqual({ b: 'b1' })
	})

	it('fixture 17: call-inputs selects the right transport channel; a null channel resolves ABSENT on a non-empty tail and null on an empty one', () => {
		const step = observation({
			callInputs: { path: { id: 'p1' }, query: null, header: null, body: null },
		})
		const resolve = makeResolveOperand({ step }, {})
		expect(
			resolve(
				{ pointer: '/interactions/step/call-inputs/path/id' },
				ABSENT,
				PATH,
			),
		).toBe('p1')
		expect(
			resolve(
				{ pointer: '/interactions/step/call-inputs/query' },
				ABSENT,
				PATH,
			),
		).toBe(null)
		expect(
			resolve(
				{ pointer: '/interactions/step/call-inputs/query/limit' },
				ABSENT,
				PATH,
			),
		).toBe(ABSENT)
	})

	it('fixture 18: "@/" walks the bound element itself and into a nested field, reusing the escape and array-index cases', () => {
		const resolve = makeResolveOperand({}, {})
		const boundElement = { 'a/b': [10, 20, { 'c~d': 'deep' }] }
		expect(resolve({ pointer: '@/' }, boundElement, PATH)).toEqual(boundElement)
		expect(resolve({ pointer: '@/a~1b/1' }, boundElement, PATH)).toBe(20)
		expect(resolve({ pointer: '@/a~1b/2/c~0d' }, boundElement, PATH)).toBe(
			'deep',
		)
	})

	it('fixture 19: "@/" with boundElement ABSENT resolves ABSENT', () => {
		const resolve = makeResolveOperand({}, {})
		expect(resolve({ pointer: '@/x' }, ABSENT, PATH)).toBe(ABSENT)
	})

	it('fixture 20: purity — the same operand and context resolve identically across repeated calls', () => {
		const resolve = makeResolveOperand(
			{ step: observation({ responseBody: { a: 1 } }) },
			{},
		)
		const operand = { pointer: '/interactions/step/response-body/a' } as const
		const first = resolve(operand, ABSENT, PATH)
		const second = resolve(operand, ABSENT, PATH)
		expect(first).toBe(1)
		expect(second).toBe(1)
	})
})

// ---------------------------------------------------------------------------
// makePointerDenotesCollection (fixtures 21-28)
// ---------------------------------------------------------------------------

describe('makePointerDenotesCollection', () => {
	const denotesCollection = makePointerDenotesCollection(
		EvalContract.parse(populatedContract),
	)

	it('fixture 21: the one declared collection location in the fixtures resolves true', () => {
		expect(denotesCollection('/interactions/list/response-body/items')).toBe(
			true,
		)
	})

	it('fixture 22: a scalar field on a different operation resolves false', () => {
		expect(denotesCollection('/interactions/create/response-body/ok')).toBe(
			false,
		)
	})

	it('fixture 23: a channel with no declared-collection surface at all resolves false', () => {
		expect(
			denotesCollection('/interactions/list/response-headers/x-total-count'),
		).toBe(false)
		expect(
			denotesCollection('/interactions/create/call-inputs/body/name'),
		).toBe(false)
	})

	it('fixture 24: any "@/…" pointer resolves false unconditionally', () => {
		expect(denotesCollection('@/x')).toBe(false)
		expect(denotesCollection('@/')).toBe(false)
	})

	it('fixture 25: an undeclared step, and a step whose operation is undeclared, resolve false rather than throwing', () => {
		expect(
			denotesCollection('/interactions/no-such-step/response-body/items'),
		).toBe(false)

		const contract = structuredClone(populatedContract) as any
		contract.interactionPlan[1].operationId = 'no-such-operation'
		const denotesWithDanglingOperation = makePointerDenotesCollection(
			contract as EvalContract,
		)
		expect(
			denotesWithDanglingOperation('/interactions/list/response-body/items'),
		).toBe(false)
	})

	it('fixture 26: collectionLocations null and collectionLocations [] both resolve false', () => {
		const nullContract = structuredClone(populatedContract) as any
		listThingsOf(nullContract).responseDescriptor.collectionLocations = null
		expect(
			makePointerDenotesCollection(nullContract as EvalContract)(
				'/interactions/list/response-body/items',
			),
		).toBe(false)

		const emptyContract = structuredClone(populatedContract) as any
		listThingsOf(emptyContract).responseDescriptor.collectionLocations = []
		expect(
			makePointerDenotesCollection(emptyContract as EvalContract)(
				'/interactions/list/response-body/items',
			),
		).toBe(false)
	})

	it('fixture 27: a pointer matching the second of two declared collection locations still resolves true', () => {
		const contract = structuredClone(populatedContract) as any
		const original =
			listThingsOf(contract).responseDescriptor.collectionLocations[0]
		listThingsOf(contract).responseDescriptor.collectionLocations = [
			{
				pointer: '/other',
				expectedCardinality: { mode: 'exact', count: 0 },
				referenceSet: null,
			},
			original,
		]
		expect(
			makePointerDenotesCollection(contract as EvalContract)(
				'/interactions/list/response-body/items',
			),
		).toBe(true)
	})

	it('fixture 28: a declared collection location pointer with an escaped ~1/~0 segment resolves true against the matching decoded target', () => {
		const contract = structuredClone(populatedContract) as any
		listThingsOf(contract).responseDescriptor.collectionLocations = [
			{
				pointer: '/it~1ems',
				expectedCardinality: { mode: 'exact', count: 3 },
				referenceSet: 'expected-things',
			},
		]
		expect(
			makePointerDenotesCollection(contract as EvalContract)(
				'/interactions/list/response-body/it~1ems',
			),
		).toBe(true)
	})
})
