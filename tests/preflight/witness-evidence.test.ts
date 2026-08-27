/**
 * The adapter between a probe leg and AD-4's resolver (Story 6.2): the
 * `Observation` shape it produces, the two mappings that are not the identity,
 * the operation-scoped collection predicate, and the regex budget.
 */
import { describe, expect, it } from 'vitest'
import {
	PREFLIGHT_ARTIFACT_PATH,
	projectObservation,
} from '../../src/core/preflight/projection.ts'
import {
	evidenceOf,
	makeWitnessPointerDenotesCollection,
	PREFLIGHT_REGEX_MATCH_STEP_BUDGET,
	referenceSetMembers,
	resolveWitnessRelation,
} from '../../src/core/preflight/witness-evidence.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import type { Expression } from '../../src/core/schemas/expression.ts'
import { RuntimeFault } from '../../src/core/schemas/faults.ts'
import type { ProbeObservation } from '../../src/core/schemas/port-messages.ts'
import {
	absentBody,
	contractDraft,
	inputsOf,
	jsonBody,
	operationNamed,
	parseContract,
	preflightContract,
} from './fixtures/observations.ts'

const listThings = operationNamed(preflightContract, 'list-things')
const createThing = operationNamed(preflightContract, 'create-thing')

const observation = (
	body: ProbeObservation['body'],
	headers: Record<string, string> = {},
): ProbeObservation => ({
	probeId: 'create-a',
	interfaceId: 'thing-api',
	operationId: 'create-thing',
	status: 201,
	headers,
	body,
})

const evidenceFor = (
	body: ProbeObservation['body'],
	headers: Record<string, string> = {},
	inputs = inputsOf({ body: { kind: 'json', value: { name: 'alpha' } } }),
) => {
	const raw = observation(body, headers)
	return evidenceOf(
		projectObservation(raw, createThing, PREFLIGHT_ARTIFACT_PATH),
		raw,
		inputs,
	)
}

describe('evidenceOf', () => {
	// `create-thing` declares `/id` volatile, so the relation sees the pruned
	// body while the raw headers pass through untouched.
	it('82. puts the pruned body on responseBody and the raw headers on responseHeaders', () => {
		const evidence = evidenceFor(
			jsonBody({ id: 'x-1', ok: true, echo: 'alpha' }),
			{ 'x-request-id': 'r-1' },
		)
		expect(evidence.responseBody).toEqual({ ok: true, echo: 'alpha' })
		expect(evidence.responseHeaders).toEqual({ 'x-request-id': 'r-1' })
		expect(evidence.provenance).toBe('baseline')
		expect(evidence.responseStatus).toBe(201)
		expect(evidence.stdout).toBeNull()
		expect(evidence.stderr).toBeNull()
		expect(evidence.exitCode).toBeNull()
	})

	// `ObservedCallInputs.body` is `JsonObjectValue | null`, which is narrower
	// than `WitnessInputs.body`, so an absent body and a non-object JSON body
	// both map to `null`. Stated rather than hidden.
	it('83. maps an absent body to null on both channels, and a JSON object body through to both', () => {
		const absent = evidenceFor(absentBody(), {}, inputsOf())
		expect(absent.responseBody).toBeNull()
		expect(absent.callInputs.body).toBeNull()

		const present = evidenceFor(jsonBody({ ok: true }))
		expect(present.responseBody).toEqual({ ok: true })
		expect(present.callInputs.body).toEqual({ name: 'alpha' })

		const scalar = evidenceFor(
			jsonBody({ ok: true }),
			{},
			inputsOf({ body: { kind: 'json', value: [1, 2] } }),
		)
		expect(scalar.callInputs.body).toBeNull()

		// A JSON null body is the case `ProbeRequestBody`'s tagged union exists
		// to keep distinct from an absent one, and it is lossy in this direction
		// too: both land on `null`.
		const jsonNull = evidenceFor(
			jsonBody({ ok: true }),
			{},
			inputsOf({ body: { kind: 'json', value: null } }),
		)
		expect(jsonNull.callInputs.body).toBeNull()
	})

	it('84. resolves a relation pointing at a response header against the raw header', () => {
		const evidence = evidenceFor(jsonBody({ ok: true }), { trace: 'abc' })
		const relation: Expression = {
			op: 'equality',
			operands: [
				{ pointer: '/interactions/create-a/response-headers/trace' },
				{ literal: 'abc' },
			],
		}
		expect(
			resolveWitnessRelation(
				relation,
				{ 'create-a': evidence },
				createThing,
				{},
				PREFLIGHT_ARTIFACT_PATH,
			).resolution,
		).toBe('true')
	})
})

describe('referenceSetMembers', () => {
	it('85. returns {} for a null declaration and the members for a populated one', () => {
		expect(referenceSetMembers(preflightContract)).toEqual({})
		const draft = contractDraft()
		draft.referenceSets = {
			'expected-things': {
				keys: ['id'],
				members: [{ id: 't-1' }, { id: 't-2' }],
				commentary: null,
			},
		}
		expect(referenceSetMembers(parseContract(draft))).toEqual({
			'expected-things': [{ id: 't-1' }, { id: 't-2' }],
		})
	})
})

describe('makeWitnessPointerDenotesCollection', () => {
	const denotes = makeWitnessPointerDenotesCollection(listThings)

	it('86. answers true for a declared collection location and false for its sibling', () => {
		expect(denotes('/interactions/list-a/response-body/items')).toBe(true)
		expect(denotes('/interactions/list-a/response-body/other')).toBe(false)
	})

	// `collectionLocations` is body-scoped, so a header pointer can never
	// denote a collection however its tail reads.
	it('87. answers false for a response-headers pointer even when the tail matches', () => {
		expect(denotes('/interactions/list-a/response-headers/items')).toBe(false)
	})

	// A conforming predicate must answer false for a bound-element pointer, or
	// the soft-delete agreement pair in AD-4's worked example breaks.
	it('88. answers false for a bound-element pointer', () => {
		expect(denotes('@/items')).toBe(false)
	})
})

describe('resolveWitnessRelation', () => {
	const listEvidence = (items: unknown[]) => {
		const raw: ProbeObservation = {
			probeId: 'list-a',
			interfaceId: 'thing-api',
			operationId: 'list-things',
			status: 200,
			headers: {},
			body: jsonBody({ items } as never),
		}
		return evidenceOf(
			projectObservation(raw, listThings, PREFLIGHT_ARTIFACT_PATH),
			raw,
			inputsOf({ query: { limit: 1 } }),
		)
	}

	it('89. returns insufficient-evidence for a quantifier over an empty declared collection', () => {
		const relation: Expression = {
			op: 'for-all',
			collection: { pointer: '/interactions/list-a/response-body/items' },
			predicate: {
				op: 'equality',
				operands: [{ pointer: '@/broken' }, { literal: true }],
			},
		}
		expect(
			resolveWitnessRelation(
				relation,
				{ 'list-a': listEvidence([]) },
				listThings,
				{},
				PREFLIGHT_ARTIFACT_PATH,
			).resolution,
		).toBe('insufficient-evidence')
	})

	// The budget is a module constant rather than a `ScoringPolicy` read: a
	// scoring policy is a score-side artifact, and AD-38 closes stage one's
	// requirement list against citing one.
	it('90. bounds a regex over a pathological pattern by PREFLIGHT_REGEX_MATCH_STEP_BUDGET', () => {
		expect(PREFLIGHT_REGEX_MATCH_STEP_BUDGET).toBe(1_000_000)
		const relation: Expression = {
			op: 'regex',
			operands: [{ pointer: '/interactions/create-a/response-body/echo' }],
			pattern: '^(?:a+)+b$',
		}
		const evidence = evidenceFor(jsonBody({ ok: true, echo: 'a'.repeat(40) }))
		let thrown: unknown
		try {
			resolveWitnessRelation(
				relation,
				{ 'create-a': evidence },
				createThing,
				{},
				PREFLIGHT_ARTIFACT_PATH,
			)
		} catch (error) {
			thrown = error
		}
		expect(thrown).toBeInstanceOf(RuntimeFault)
		expect((thrown as RuntimeFault).code).toBe('budget-exhausted')
		expect((thrown as RuntimeFault).artifactPath).toBe(PREFLIGHT_ARTIFACT_PATH)
	})
})

// The fixture module parses its contract through the schema, so a witness that
// stopped parsing would fail here rather than silently in every consumer.
describe('the fixture contract itself', () => {
	it('parses against EvalContract', () => {
		expect(EvalContract.safeParse(preflightContract).success).toBe(true)
	})
})
