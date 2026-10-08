/**
 * AD-11's named closed projection and the fixture digest over it (Story 6.2).
 * Fixture 81 carries a literal golden digest: an assertion that re-derives its
 * expected value from the function under test proves nothing.
 */
import { describe, expect, it } from 'vitest'
import {
	fixtureDigest,
	PREFLIGHT_ARTIFACT_PATH,
	type ProjectedObservation,
	projectObservation,
	pruneVolatile,
} from '../../src/core/preflight/projection.ts'
import type { ApiProbeObservation } from '../../src/core/schemas/port-messages.ts'
import {
	absentBody,
	jsonBody,
	operationNamed,
	preflightContract,
	textBody,
} from './fixtures/observations.ts'

const prune = (body: Parameters<typeof pruneVolatile>[0], pointers: string[]) =>
	pruneVolatile(body, pointers, PREFLIGHT_ARTIFACT_PATH)

const observation = (
	probeId: string,
	body: ApiProbeObservation['body'],
	patch: Partial<ApiProbeObservation> = {},
): ApiProbeObservation => ({
	probeId,
	interfaceId: 'thing-api',
	operationId: 'read-thing',
	kind: 'api',
	status: 200,
	headers: {},
	body,
	...patch,
})

const projectionOf = (
	probeId: string,
	body: ApiProbeObservation['body'],
	patch: Partial<ApiProbeObservation> = {},
): ProjectedObservation =>
	projectObservation(
		observation(probeId, body, patch),
		operationNamed(preflightContract, 'read-thing'),
		PREFLIGHT_ARTIFACT_PATH,
	)

describe('pruneVolatile', () => {
	it('69. removes a declared object key', () => {
		expect(prune(jsonBody({ id: 'x', value: 'v' }), ['/id'])).toEqual(
			jsonBody({ value: 'v' }),
		)
	})

	it('70. splices a declared array element', () => {
		expect(prune(jsonBody({ items: ['a', 'b', 'c'] }), ['/items/1'])).toEqual(
			jsonBody({ items: ['a', 'c'] }),
		)
	})

	// A volatile field the fixture did not return this time is exactly the case
	// the declaration exists for.
	it('71. treats a pointer that resolves to nothing as a no-op, never an error', () => {
		expect(prune(jsonBody({ value: 'v' }), ['/id', '/items/7'])).toEqual(
			jsonBody({ value: 'v' }),
		)
	})

	it("72. prunes the whole body on the empty pointer, which is RFC 6901's own meaning", () => {
		expect(prune(jsonBody({ value: 'v' }), [''])).toEqual(absentBody())
	})

	it('73. does not mutate its input', () => {
		const body = jsonBody({ id: 'x', value: 'v' })
		const before = JSON.stringify(body)
		prune(body, ['/id'])
		expect(JSON.stringify(body)).toBe(before)
	})
})

describe('pruneVolatile wildcard', () => {
	it('prunes a field out of every element of an array', () => {
		expect(
			prune(
				jsonBody({
					findings: [
						{ title: 'a', line: 3 },
						{ title: 'b', line: 9 },
						{ title: 'c', line: 1 },
					],
				}),
				['/findings/*/title'],
			),
		).toEqual(jsonBody({ findings: [{ line: 3 }, { line: 9 }, { line: 1 }] }))
	})

	it('matches every key of an object at a middle position', () => {
		expect(
			prune(
				jsonBody({
					rows: { a: { id: 1, keep: 'x' }, b: { id: 2, keep: 'y' } },
				}),
				['/rows/*/id'],
			),
		).toEqual(jsonBody({ rows: { a: { keep: 'x' }, b: { keep: 'y' } } }))
	})

	it('empties an array when the wildcard is the last segment, whatever its length', () => {
		expect(prune(jsonBody({ items: ['a', 'b', 'c'] }), ['/items/*'])).toEqual(
			jsonBody({ items: [] }),
		)
		expect(prune(jsonBody({ items: [] }), ['/items/*'])).toEqual(
			jsonBody({ items: [] }),
		)
	})

	it('removes every key of an object when the wildcard is the last segment', () => {
		expect(
			prune(jsonBody({ meta: { a: 1, b: 2 }, id: 'x' }), ['/meta/*']),
		).toEqual(jsonBody({ meta: {}, id: 'x' }))
	})

	it('treats a wildcard that reaches nothing as a no-op', () => {
		const body = jsonBody({ value: 'v', items: 'text' })
		expect(prune(body, ['/missing/*/id', '/items/*/id', '/value/*'])).toEqual(
			body,
		)
	})

	it('has no escape: a key literally named "*" is matched like any other key', () => {
		expect(prune(jsonBody({ '*': 1, other: 2 }), ['/*'])).toEqual(jsonBody({}))
	})

	it('does not mutate its input', () => {
		const body = jsonBody({ findings: [{ title: 'a' }] })
		const before = JSON.stringify(body)
		prune(body, ['/findings/*/title'])
		expect(JSON.stringify(body)).toBe(before)
	})
})

describe('the projection', () => {
	it('74. carries exactly seven keys and no response headers', () => {
		const projected = projectionOf('read-a', jsonBody({ value: 'v' }), {
			headers: { 'x-request-id': 'r-1' },
		})
		expect(Object.keys(projected).sort()).toEqual([
			'body',
			'exitCode',
			'interfaceId',
			'legId',
			'operationId',
			'status',
			'toolError',
		])
		expect(JSON.stringify(projected)).not.toContain('x-request-id')
	})

	// A fixture that changed its content type has changed, and a digest that
	// cannot see that is a scoring version that lies.
	it('75. keeps the body tag, so a text body and a json body carrying the same string project differently', () => {
		expect(projectionOf('read-a', textBody('x'))).not.toEqual(
			projectionOf('read-a', jsonBody('x')),
		)
	})
})

describe('fixtureDigest', () => {
	const first = projectionOf('read-a', jsonBody({ value: 'alpha' }))
	const second = projectionOf('read-b', jsonBody({ value: 'beta' }))
	const digest = (projections: ProjectedObservation[]) =>
		fixtureDigest(projections, PREFLIGHT_ARTIFACT_PATH)

	// NFR9: array position is never read, so two runs whose observations
	// arrived in a different order describe the same fixture.
	it('76. is stable under observation reordering', () => {
		expect(digest([first, second])).toBe(digest([second, first]))
	})

	it('77. changes when a non-volatile body field changes', () => {
		expect(digest([first])).not.toBe(
			digest([projectionOf('read-a', jsonBody({ value: 'changed' }))]),
		)
	})

	// `create-thing` declares `/id` volatile, so a server-minted identifier
	// moves nothing.
	it('78. does not change when a declared volatile field changes', () => {
		const createThing = operationNamed(preflightContract, 'create-thing')
		const withId = (id: string) =>
			projectObservation(
				observation('create-a', jsonBody({ id, ok: true, echo: 'alpha' }), {
					operationId: 'create-thing',
				}),
				createThing,
				PREFLIGHT_ARTIFACT_PATH,
			)
		expect(digest([withId('x-1')])).toBe(digest([withId('x-2')]))
	})

	// Decision 4's cost, as a test rather than as prose: no declaration can
	// mark a header volatile, so headers are outside the projection entirely.
	it('79. does not change when a response header changes', () => {
		const withHeader = (value: string) =>
			projectionOf('read-a', jsonBody({ value: 'alpha' }), {
				headers: { 'x-request-id': value },
			})
		expect(digest([withHeader('r-1')])).toBe(digest([withHeader('r-2')]))
	})

	// `digestComposite` rejects an empty field bag, and `{ observations: [] }`
	// has one field, so it would happily digest a pre-flight that verified
	// nothing.
	it('80. throws its own TypeError on an empty projection list', () => {
		let thrown: unknown
		try {
			digest([])
		} catch (error) {
			thrown = error
		}
		expect(thrown).toBeInstanceOf(TypeError)
		expect((thrown as TypeError).message).toContain(PREFLIGHT_ARTIFACT_PATH)
	})

	// A literal, written from the first green run and then frozen: a digest
	// re-derived from the function under test would assert nothing.
	it('81. is sha256-formed and matches its golden value', () => {
		const value = digest([first, second])
		expect(value).toMatch(/^sha256:[0-9a-f]{64}$/)
		expect(value).toBe(
			'sha256:9051e86e36f3c3123237d8714ade16bc6269ab9ec759f710fa0a39912b6c38e9',
		)
	})
})
