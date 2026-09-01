import { describe, expect, it } from 'vitest'
import { ABSENT } from '../../src/core/evaluate/resolved-value.ts'
import type { Operation } from '../../src/core/schemas/interface.ts'
import type { InteractionStep } from '../../src/core/schemas/plan.ts'
import type { TransportChannelName } from '../../src/core/schemas/pointer.ts'
import type { JsonValue } from '../../src/core/schemas/primitives.ts'
import type {
	Observation,
	ObservedCallInputs,
} from '../../src/core/schemas/sealed-run-record.ts'
import {
	bindingSiteKey,
	type CapturedResolution,
	resolveCapturedBindings,
	resolveCapturedValue,
	selectWithBindings,
} from '../../src/core/score/bindings.ts'
import { selectObservations } from '../../src/core/score/selection.ts'
import {
	buildPlanIndex,
	type PlanIndex,
} from '../../src/core/seal/plan-index.ts'
import {
	irreducibleCollisionPair,
	literalCollisionPair,
} from '../seal/fixtures.ts'

/**
 * A schema-shaped observation widened where these cases read: `callInputs` is
 * what a binding filters on and `responseBody` is what a capture resolves from.
 * Every other field stays an inert default.
 */
function observation(
	observationId: string,
	sequence: number,
	operationId: string,
	fields: {
		callInputs?: Partial<ObservedCallInputs>
		responseBody?: JsonValue
	} = {},
): Observation {
	return {
		observationId,
		sequence,
		operationId,
		provenance: 'evaluator-chosen',
		callInputs: {
			path: null,
			query: null,
			header: null,
			body: null,
			...fields.callInputs,
		},
		responseBody: fields.responseBody ?? null,
		responseHeaders: null,
		responseStatus: 200,
		stdout: null,
		stderr: null,
		exitCode: null,
	}
}

/** A step naming an operation, with the selection predicate's two members overridable. */
function step(
	stepId: string,
	operationId: string,
	fields: {
		inputBinding?: Partial<InteractionStep['inputBinding']>
		after?: string | null
		cardinality?: InteractionStep['cardinality']
	} = {},
): InteractionStep {
	return {
		stepId,
		operationId,
		inputBinding: {
			path: null,
			query: null,
			header: null,
			body: null,
			...fields.inputBinding,
		},
		after: fields.after ?? null,
		cardinality: fields.cardinality ?? 'exactly-one',
	}
}

/** A `{ captured }` binding value addressing one scalar off `sourceStepId`'s response body. */
function capturedFrom(sourceStepId: string, key: string) {
	return { captured: `/interactions/${sourceStepId}/response-body/${key}` }
}

type DeclaredTypes = Operation['requestShape']['body']['types']

/**
 * An operation carrying declared request types. `{ matcher: 'type-violating' }`
 * is the only binding form that reads the interface at all, through
 * `requestShape[channel].types[key]`, so everything else here is inert.
 */
function operation(
	operationId: string,
	declared: Partial<Record<TransportChannelName, DeclaredTypes>> = {},
): Operation {
	const channel = (name: TransportChannelName) => {
		const types = declared[name] ?? {}
		return { requiredKeys: [], permittedKeys: Object.keys(types), types }
	}
	return {
		operationId,
		method: 'POST',
		pathTemplate: '/things',
		stateChangeMarker: true,
		requestShape: {
			path: channel('path'),
			query: channel('query'),
			header: channel('header'),
			body: channel('body'),
		},
		responseDescriptor: {
			requiredKeys: [],
			permittedKeys: [],
			types: {},
			successIndicator: null,
			channelRoles: null,
			collectionLocations: null,
		},
		volatilePointers: [],
		sensitivityWitness: null,
	}
}

/** The plan index the two functions resolve steps and operations through. */
function planIndex(
	interactionPlan: readonly InteractionStep[],
	operations: Operation[] = [],
): PlanIndex {
	return buildPlanIndex(
		interactionPlan,
		operations.length === 0
			? []
			: [{ logicalId: 'svc', kind: 'api', operations }],
	)
}

/**
 * `resolveCapturedValue` reads the referenced step's own captured bindings out
 * of this map. Every case in the describe below references a step that captures
 * nothing, so the empty map is the whole of what those cases need; the chained
 * cases live in `resolveCapturedBindings` below, where the driver fills it.
 */
const EMPTY_RESOLUTIONS: ReadonlyMap<string, CapturedResolution> = new Map()

describe('resolveCapturedValue', () => {
	it('resolves a scalar off the single matching observation of the referenced step', () => {
		const plan = [step('write', 'create-note')]
		const resolution = resolveCapturedValue(
			'/interactions/write/response-body/id',
			planIndex(plan),
			[
				observation('obs-other', 1, 'get-note'),
				observation('obs-write', 4, 'create-note', {
					responseBody: { id: 'note-7' },
				}),
			],
			EMPTY_RESOLUTIONS,
		)
		expect(resolution).toEqual({
			status: 'resolved',
			value: 'note-7',
			observationId: 'obs-write',
			// `sequence` is what gives "earlier" a runtime meaning: the capture
			// graph is acyclic at compile time and still says nothing about which
			// observation came first.
			sequence: 4,
		})
	})

	it('resolves absent when the referenced step matched no observation', () => {
		const plan = [step('write', 'create-note')]
		const resolution = resolveCapturedValue(
			'/interactions/write/response-body/id',
			planIndex(plan),
			[observation('obs-other', 1, 'get-note')],
			EMPTY_RESOLUTIONS,
		)
		expect(resolution).toEqual({ status: 'absent' })
	})

	// A dangling capture is `unreachable-check-evidence`'s at compile time; here
	// it is data, and the disposition is fail-closed.
	it('resolves absent when the pointer names a step the plan does not declare', () => {
		const resolution = resolveCapturedValue(
			'/interactions/ghost/response-body/id',
			planIndex([step('write', 'create-note')]),
			[
				observation('obs-write', 1, 'create-note', {
					responseBody: { id: 'x' },
				}),
			],
			EMPTY_RESOLUTIONS,
		)
		expect(resolution).toEqual({ status: 'absent' })
	})

	// AD-26 treats a tail that walks off the observed value as an observation, so
	// the walk yields the `ABSENT` symbol and it is carried in `value` under a
	// `resolved` status. `ResolvedValue` is `JsonValue | ABSENT` precisely so
	// `value` can say this. The module's own docstring reads as though this case
	// came back as `{ status: 'absent' }`; the measured status is `resolved`, and
	// the downstream disposition is the same either way, since `deepEquals` is
	// false against `ABSENT` and every candidate is filtered out.
	it('carries ABSENT as the resolved value when the tail walks off the observed body', () => {
		const plan = [step('write', 'create-note')]
		const resolution = resolveCapturedValue(
			'/interactions/write/response-body/missing',
			planIndex(plan),
			[
				observation('obs-write', 2, 'create-note', {
					responseBody: { id: 'note-7' },
				}),
			],
			EMPTY_RESOLUTIONS,
		)
		expect(resolution).toEqual({
			status: 'resolved',
			value: ABSENT,
			observationId: 'obs-write',
			sequence: 2,
		})
	})

	it('reports the named ambiguity when the referenced step matched several under exactly-one', () => {
		const plan = [step('write', 'create-note', { cardinality: 'exactly-one' })]
		const resolution = resolveCapturedValue(
			'/interactions/write/response-body/id',
			planIndex(plan),
			[
				observation('obs-b', 2, 'create-note', {
					responseBody: { id: 'note-b' },
				}),
				observation('obs-a', 1, 'create-note', {
					responseBody: { id: 'note-a' },
				}),
			],
			EMPTY_RESOLUTIONS,
		)
		expect(resolution).toEqual({
			status: 'ambiguous',
			matchedObservationIds: ['obs-a', 'obs-b'],
		})
	})

	// `resolveTemporalAnchor`'s own disposition, reused unchanged: several under a
	// declared `any` binds the lowest `sequence`.
	it('binds the lowest-sequence match when the referenced step declares any', () => {
		const plan = [step('write', 'create-note', { cardinality: 'any' })]
		const resolution = resolveCapturedValue(
			'/interactions/write/response-body/id',
			planIndex(plan),
			[
				observation('obs-late', 9, 'create-note', {
					responseBody: { id: 'note-late' },
				}),
				observation('obs-early', 3, 'create-note', {
					responseBody: { id: 'note-early' },
				}),
			],
			EMPTY_RESOLUTIONS,
		)
		expect(resolution).toEqual({
			status: 'resolved',
			value: 'note-early',
			observationId: 'obs-early',
			sequence: 3,
		})
	})
})

describe('resolveCapturedBindings', () => {
	it('fills one entry per captured binding site', () => {
		const plan = [
			step('write', 'create-note'),
			step('read', 'get-note', {
				inputBinding: { path: { id: capturedFrom('write', 'id') } },
			}),
		]
		const resolved = resolveCapturedBindings(plan, planIndex(plan), [
			observation('obs-write', 1, 'create-note', {
				responseBody: { id: 'note-7' },
			}),
		])
		expect(resolved.size).toBe(1)
		expect(resolved.get(bindingSiteKey('read', 'path', 'id'))).toEqual({
			status: 'resolved',
			value: 'note-7',
			observationId: 'obs-write',
			sequence: 1,
		})
	})

	// The map is keyed by binding site, which is why two entries come back here:
	// both sites below name the same pointer in two channels, and a pointer-keyed
	// map would hold one entry that `satisfiesBindings` could not address per
	// channel.
	it('gives one step two entries when it carries two captured bindings in two channels', () => {
		const plan = [
			step('write', 'create-note'),
			step('read', 'get-note', {
				inputBinding: {
					path: { id: capturedFrom('write', 'id') },
					query: { id: capturedFrom('write', 'id') },
				},
			}),
		]
		const resolved = resolveCapturedBindings(plan, planIndex(plan), [
			observation('obs-write', 1, 'create-note', {
				responseBody: { id: 'note-7' },
			}),
		])
		expect(resolved.size).toBe(2)
		expect([...resolved.keys()].sort()).toEqual(
			[
				bindingSiteKey('read', 'path', 'id'),
				bindingSiteKey('read', 'query', 'id'),
			].sort(),
		)
	})

	// A cyclic step is never placed in a tier, so its bindings resolve as
	// unlisted, which filters every candidate away at selection time.
	it('contributes no entry for a step bindingOrder reports cyclic', () => {
		const plan = [
			step('write', 'create-note'),
			step('read', 'get-note', {
				inputBinding: { path: { id: capturedFrom('write', 'id') } },
			}),
			step('ping', 'ping-op', {
				inputBinding: { path: { id: capturedFrom('pong', 'id') } },
			}),
			step('pong', 'pong-op', {
				inputBinding: { path: { id: capturedFrom('ping', 'id') } },
			}),
		]
		const resolved = resolveCapturedBindings(plan, planIndex(plan), [
			observation('obs-write', 1, 'create-note', {
				responseBody: { id: 'note-7' },
			}),
		])
		expect([...resolved.keys()]).toEqual([bindingSiteKey('read', 'path', 'id')])
	})
})

describe('selectWithBindings', () => {
	// Owed item 3's worked case: a POST returning a server-generated identifier,
	// then a GET proving persistence by binding it.
	it('selects the one observation whose call input equals the captured value', () => {
		const plan = [
			step('write', 'create-note'),
			step('read', 'get-note', {
				inputBinding: { path: { id: capturedFrom('write', 'id') } },
			}),
		]
		const index = planIndex(plan)
		const observations = [
			observation('obs-write', 1, 'create-note', {
				responseBody: { id: 'note-7' },
			}),
			observation('obs-hit', 2, 'get-note', {
				callInputs: { path: { id: 'note-7' } },
			}),
			observation('obs-miss', 3, 'get-note', {
				callInputs: { path: { id: 'note-9' } },
			}),
		]
		const resolved = resolveCapturedBindings(plan, index, observations)
		expect(
			selectObservations(plan[1] as InteractionStep, observations),
		).toEqual({
			result: 'several',
			matchedObservationIds: ['obs-hit', 'obs-miss'],
		})
		expect(
			selectWithBindings(
				plan[1] as InteractionStep,
				observations,
				index,
				resolved,
			),
		).toEqual({ result: 'one', matchedObservationIds: ['obs-hit'] })
	})

	it('returns none when the captured pointer resolved absent', () => {
		const plan = [
			step('read', 'get-note', {
				inputBinding: { path: { id: capturedFrom('ghost', 'id') } },
			}),
		]
		const index = planIndex(plan)
		const observations = [
			observation('obs-read', 1, 'get-note', {
				callInputs: { path: { id: 'note-7' } },
			}),
		]
		const resolved = resolveCapturedBindings(plan, index, observations)
		expect(
			selectWithBindings(
				plan[0] as InteractionStep,
				observations,
				index,
				resolved,
			),
		).toEqual({ result: 'none', matchedObservationIds: [] })
	})

	it('returns none when the referenced step itself selected none', () => {
		const plan = [
			step('write', 'create-note'),
			step('read', 'get-note', {
				inputBinding: { path: { id: capturedFrom('write', 'id') } },
			}),
		]
		const index = planIndex(plan)
		// No `create-note` observation, so the capture has nothing to resolve from.
		const observations = [
			observation('obs-read', 1, 'get-note', {
				callInputs: { path: { id: 'note-7' } },
			}),
		]
		const resolved = resolveCapturedBindings(plan, index, observations)
		// The step's own operation matched; the unresolvable capture is what rules it out.
		expect(
			selectObservations(plan[1] as InteractionStep, observations).result,
		).toBe('one')
		expect(
			selectWithBindings(
				plan[1] as InteractionStep,
				observations,
				index,
				resolved,
			),
		).toEqual({ result: 'none', matchedObservationIds: [] })
	})

	// Ordering is enforced at score time and not only at compile time: a record
	// whose read sits at `sequence` 2 and whose write sits at `sequence` 5 would
	// otherwise satisfy the binding and pass an oracle proving persistence.
	it('filters a candidate whose sequence is not strictly above the source of the captured value', () => {
		const plan = [
			step('write', 'create-note'),
			step('read', 'get-note', {
				inputBinding: { path: { id: capturedFrom('write', 'id') } },
			}),
		]
		const index = planIndex(plan)
		const write = observation('obs-write', 5, 'create-note', {
			responseBody: { id: 'note-7' },
		})
		const readBefore = [
			write,
			observation('obs-read', 2, 'get-note', {
				callInputs: { path: { id: 'note-7' } },
			}),
		]
		expect(
			selectWithBindings(
				plan[1] as InteractionStep,
				readBefore,
				index,
				resolveCapturedBindings(plan, index, readBefore),
			),
		).toEqual({ result: 'none', matchedObservationIds: [] })

		const readAfter = [
			write,
			observation('obs-read', 9, 'get-note', {
				callInputs: { path: { id: 'note-7' } },
			}),
		]
		expect(
			selectWithBindings(
				plan[1] as InteractionStep,
				readAfter,
				index,
				resolveCapturedBindings(plan, index, readAfter),
			),
		).toEqual({ result: 'one', matchedObservationIds: ['obs-read'] })
	})

	// The pair `selectObservations` cannot separate on its own: same operation,
	// one key, two different literals.
	it('separates two steps sharing an operation by their differing literal bindings', () => {
		const plan = [
			step('write-alpha', 'create-note', {
				inputBinding: { body: { title: { literal: 'alpha' } } },
			}),
			step('write-beta', 'create-note', {
				inputBinding: { body: { title: { literal: 'beta' } } },
			}),
		]
		const index = planIndex(plan)
		const observations = [
			observation('obs-alpha', 1, 'create-note', {
				callInputs: { body: { title: 'alpha' } },
			}),
			observation('obs-beta', 2, 'create-note', {
				callInputs: { body: { title: 'beta' } },
			}),
		]
		const resolved = resolveCapturedBindings(plan, index, observations)
		for (const declared of plan) {
			expect(selectObservations(declared, observations)).toEqual({
				result: 'several',
				matchedObservationIds: ['obs-alpha', 'obs-beta'],
			})
		}
		expect(
			selectWithBindings(
				plan[0] as InteractionStep,
				observations,
				index,
				resolved,
			),
		).toEqual({ result: 'one', matchedObservationIds: ['obs-alpha'] })
		expect(
			selectWithBindings(
				plan[1] as InteractionStep,
				observations,
				index,
				resolved,
			),
		).toEqual({ result: 'one', matchedObservationIds: ['obs-beta'] })
	})

	// AD-4 separates `equality` from `deep-equality`; a literal is a `JsonValue`
	// and admits objects, so key order is irrelevant.
	it('matches an object literal against the same entries in a different key order', () => {
		const plan = [
			step('write', 'create-note', {
				inputBinding: { body: { payload: { literal: { a: 1, b: [2, 3] } } } },
			}),
		]
		const index = planIndex(plan)
		const observations = [
			observation('obs-write', 1, 'create-note', {
				callInputs: { body: { payload: { b: [2, 3], a: 1 } } },
			}),
		]
		expect(
			selectWithBindings(
				plan[0] as InteractionStep,
				observations,
				index,
				resolveCapturedBindings(plan, index, observations),
			),
		).toEqual({ result: 'one', matchedObservationIds: ['obs-write'] })
	})

	// A filter over zero bindings separates nothing, so `several` is the honest
	// answer: the declared structure does not distinguish these two steps.
	it('leaves two steps sharing an operation and binding nothing both several', () => {
		const plan = [
			step('write-one', 'create-note'),
			step('write-two', 'create-note'),
		]
		const index = planIndex(plan)
		const observations = [
			observation('obs-a', 1, 'create-note'),
			observation('obs-b', 2, 'create-note'),
		]
		const resolved = resolveCapturedBindings(plan, index, observations)
		for (const declared of plan) {
			expect(
				selectWithBindings(declared, observations, index, resolved),
			).toEqual({
				result: 'several',
				matchedObservationIds: ['obs-a', 'obs-b'],
			})
		}
	})

	// A known, recorded limitation: a principal's value is provisioned by the
	// harness at runtime, and no field of a sealed run record says which
	// principal it used, so the two cross-user steps stay indistinguishable here.
	it('leaves two steps binding the same key to different principals both several', () => {
		const plan = [
			step('read-as-owner', 'get-note', {
				inputBinding: { header: { authorization: { principal: 'owner' } } },
			}),
			step('read-as-intruder', 'get-note', {
				inputBinding: { header: { authorization: { principal: 'intruder' } } },
			}),
		]
		const index = planIndex(plan)
		const observations = [
			observation('obs-a', 1, 'get-note', {
				callInputs: { header: { authorization: 'token-a' } },
			}),
			observation('obs-b', 2, 'get-note', {
				callInputs: { header: { authorization: 'token-b' } },
			}),
		]
		const resolved = resolveCapturedBindings(plan, index, observations)
		for (const declared of plan) {
			expect(
				selectWithBindings(declared, observations, index, resolved),
			).toEqual({
				result: 'several',
				matchedObservationIds: ['obs-a', 'obs-b'],
			})
		}
	})

	it('keeps a candidate carrying the key under matcher any and drops one lacking it', () => {
		const plan = [
			step('search', 'list-notes', {
				inputBinding: { query: { q: { matcher: 'any' } } },
			}),
		]
		const index = planIndex(plan)
		const observations = [
			observation('obs-with', 1, 'list-notes', {
				callInputs: { query: { q: 'anything at all' } },
			}),
			observation('obs-without', 2, 'list-notes', {
				callInputs: { query: { page: 2 } },
			}),
		]
		expect(
			selectWithBindings(
				plan[0] as InteractionStep,
				observations,
				index,
				resolveCapturedBindings(plan, index, observations),
			),
		).toEqual({ result: 'one', matchedObservationIds: ['obs-with'] })
	})

	// A `null` channel means the key is not present, which is the same
	// fail-closed disposition AD-26 gives an unresolved pointer.
	it('drops a candidate whose observed channel is null', () => {
		const plan = [
			step('search', 'list-notes', {
				inputBinding: { query: { q: { matcher: 'any' } } },
			}),
		]
		const index = planIndex(plan)
		const observations = [observation('obs-null', 1, 'list-notes')]
		expect(observations[0]?.callInputs.query).toBeNull()
		expect(
			selectWithBindings(
				plan[0] as InteractionStep,
				observations,
				index,
				resolveCapturedBindings(plan, index, observations),
			),
		).toEqual({ result: 'none', matchedObservationIds: [] })
	})

	describe('matcher type-violating', () => {
		const violatingPlan = [
			step('malformed', 'create-note', {
				inputBinding: { body: { title: { matcher: 'type-violating' } } },
			}),
		]

		// AD-31 rule 3's malformed-input behaviour: the observed JSON type differs
		// from the type the operation declares for that key.
		it('keeps a candidate whose observed JSON type differs from the declared type', () => {
			const index = planIndex(violatingPlan, [
				operation('create-note', { body: { title: 'string' } }),
			])
			const observations = [
				observation('obs-number', 1, 'create-note', {
					callInputs: { body: { title: 42 } },
				}),
			]
			expect(
				selectWithBindings(
					violatingPlan[0] as InteractionStep,
					observations,
					index,
					resolveCapturedBindings(violatingPlan, index, observations),
				),
			).toEqual({ result: 'one', matchedObservationIds: ['obs-number'] })
		})

		it('drops a well-typed candidate, whose call never exercised the malformed-input behaviour', () => {
			const index = planIndex(violatingPlan, [
				operation('create-note', { body: { title: 'string' } }),
			])
			const observations = [
				observation('obs-well-typed', 1, 'create-note', {
					callInputs: { body: { title: 'a real title' } },
				}),
			]
			expect(
				selectWithBindings(
					violatingPlan[0] as InteractionStep,
					observations,
					index,
					resolveCapturedBindings(violatingPlan, index, observations),
				),
			).toEqual({ result: 'none', matchedObservationIds: [] })
		})

		// Fails closed on both indeterminate spellings: a missing key means "not
		// declared" and an explicit `null` means "declared, type not stated", and
		// neither can prove a violation.
		it('drops the candidate when the operation declares no type for the key', () => {
			const index = planIndex(violatingPlan, [operation('create-note')])
			const observations = [
				observation('obs-any', 1, 'create-note', {
					callInputs: { body: { title: 42 } },
				}),
			]
			expect(
				selectWithBindings(
					violatingPlan[0] as InteractionStep,
					observations,
					index,
					resolveCapturedBindings(violatingPlan, index, observations),
				),
			).toEqual({ result: 'none', matchedObservationIds: [] })
		})

		it('drops the candidate when the declared type is an explicit null', () => {
			const index = planIndex(violatingPlan, [
				operation('create-note', { body: { title: null } }),
			])
			const observations = [
				observation('obs-any', 1, 'create-note', {
					callInputs: { body: { title: 42 } },
				}),
			]
			expect(
				selectWithBindings(
					violatingPlan[0] as InteractionStep,
					observations,
					index,
					resolveCapturedBindings(violatingPlan, index, observations),
				),
			).toEqual({ result: 'none', matchedObservationIds: [] })
		})

		it('drops the candidate when the index resolves no operation for the step', () => {
			// No permitted interface declares `create-note`, so there is no declared
			// type to compare against.
			const index = planIndex(violatingPlan)
			expect(index.operationOf('create-note')).toBeUndefined()
			const observations = [
				observation('obs-any', 1, 'create-note', {
					callInputs: { body: { title: 42 } },
				}),
			]
			expect(
				selectWithBindings(
					violatingPlan[0] as InteractionStep,
					observations,
					index,
					resolveCapturedBindings(violatingPlan, index, observations),
				),
			).toEqual({ result: 'none', matchedObservationIds: [] })
		})
	})

	describe('the temporal clause', () => {
		// The bound is strict, so the boundary case needs a candidate sitting at
		// the anchor's own `sequence`. The schema layer enforces per-record
		// `sequence` uniqueness and would reject this pair, the same way
		// `selection.test.ts`'s tie cases are hand-built past that rule to pin the
		// comparator.
		it('drops candidates at or below the sequence of the anchor', () => {
			const plan = [
				step('anchor', 'create-note'),
				step('read', 'get-note', { after: 'anchor' }),
			]
			const index = planIndex(plan)
			const observations = [
				observation('obs-early', 2, 'get-note'),
				observation('obs-anchor', 3, 'create-note'),
				observation('obs-at', 3, 'get-note'),
				observation('obs-late', 4, 'get-note'),
			]
			expect(
				selectWithBindings(
					plan[1] as InteractionStep,
					observations,
					index,
					resolveCapturedBindings(plan, index, observations),
				),
			).toEqual({ result: 'one', matchedObservationIds: ['obs-late'] })
		})

		// AD-39 makes a dangling reference permissive: there is no anchor to
		// resolve, so no bound is imposed and every candidate survives.
		it('imposes no bound when the clause names a step the plan does not declare', () => {
			const plan = [
				step('read', 'get-note', { after: 'ghost', cardinality: 'any' }),
			]
			const index = planIndex(plan)
			const observations = [
				observation('obs-a', 1, 'get-note'),
				observation('obs-b', 2, 'get-note'),
			]
			expect(
				selectWithBindings(
					plan[0] as InteractionStep,
					observations,
					index,
					resolveCapturedBindings(plan, index, observations),
				),
			).toEqual({
				result: 'several',
				matchedObservationIds: ['obs-a', 'obs-b'],
			})
		})

		// "No anchor exists" and "the anchor cannot be pinned down" are different
		// facts, and only the second rules every candidate out. Both cases below
		// are the second one.
		it('returns none when a declared anchor matched no observation', () => {
			const plan = [
				step('anchor', 'create-note'),
				step('read', 'get-note', { after: 'anchor' }),
			]
			const index = planIndex(plan)
			const observations = [observation('obs-read', 1, 'get-note')]
			expect(
				selectWithBindings(
					plan[1] as InteractionStep,
					observations,
					index,
					resolveCapturedBindings(plan, index, observations),
				),
			).toEqual({ result: 'none', matchedObservationIds: [] })
		})

		it('returns none when a single-valued anchor matched several', () => {
			const plan = [
				step('anchor', 'create-note', { cardinality: 'exactly-one' }),
				step('read', 'get-note', { after: 'anchor' }),
			]
			const index = planIndex(plan)
			const observations = [
				observation('obs-anchor-a', 1, 'create-note'),
				observation('obs-anchor-b', 2, 'create-note'),
				observation('obs-read', 3, 'get-note'),
			]
			expect(
				selectWithBindings(
					plan[1] as InteractionStep,
					observations,
					index,
					resolveCapturedBindings(plan, index, observations),
				),
			).toEqual({ result: 'none', matchedObservationIds: [] })
		})
	})

	// An unlisted binding site filters every candidate out, so a caller that
	// walked the tiers out of order, or skipped one, gets `none`.
	it('returns none when a captured binding site is missing from the resolved map', () => {
		const plan = [
			step('write', 'create-note'),
			step('read', 'get-note', {
				inputBinding: { path: { id: capturedFrom('write', 'id') } },
			}),
		]
		const index = planIndex(plan)
		const observations = [
			observation('obs-write', 1, 'create-note', {
				responseBody: { id: 'note-7' },
			}),
			observation('obs-read', 2, 'get-note', {
				callInputs: { path: { id: 'note-7' } },
			}),
		]
		const empty = new Map<string, CapturedResolution>()
		expect(
			selectWithBindings(
				plan[1] as InteractionStep,
				observations,
				index,
				empty,
			),
		).toEqual({ result: 'none', matchedObservationIds: [] })
	})

	// NFR9 through the whole path, capture resolution included: the record's
	// `sequence` is the only ordering read, so array position cannot reach the
	// result.
	it('is permutation-invariant over the observations array (NFR9)', () => {
		const plan = [
			step('write', 'create-note'),
			step('read', 'get-note', {
				cardinality: 'any',
				inputBinding: { path: { id: capturedFrom('write', 'id') } },
			}),
		]
		const index = planIndex(plan)
		const base = [
			observation('obs-write', 1, 'create-note', {
				responseBody: { id: 'note-7' },
			}),
			observation('obs-hit-a', 2, 'get-note', {
				callInputs: { path: { id: 'note-7' } },
			}),
			observation('obs-hit-b', 3, 'get-note', {
				callInputs: { path: { id: 'note-7' } },
			}),
			observation('obs-miss', 4, 'get-note', {
				callInputs: { path: { id: 'note-9' } },
			}),
		]
		const permutationsOf = <T>(items: readonly T[]): T[][] => {
			if (items.length <= 1) return [items.slice()]
			const permutations: T[][] = []
			for (let i = 0; i < items.length; i++) {
				const rest = [...items.slice(0, i), ...items.slice(i + 1)]
				for (const tail of permutationsOf(rest)) {
					permutations.push([items[i] as T, ...tail])
				}
			}
			return permutations
		}
		const select = (observations: readonly Observation[]) =>
			selectWithBindings(
				plan[1] as InteractionStep,
				observations,
				index,
				resolveCapturedBindings(plan, index, observations),
			)
		const expected = select(base)
		expect(expected).toEqual({
			result: 'several',
			matchedObservationIds: ['obs-hit-a', 'obs-hit-b'],
		})
		for (const permutation of permutationsOf(base)) {
			expect(select(permutation)).toEqual(expected)
		}
	})
})

// The acceptance criterion names two shipped fixtures by name, so it is
// discharged against those rather than against a local rebuild: whatever
// `tests/seal/fixtures.ts` declares is what the criterion is about.
describe('selectWithBindings over the two shipped collision pairs', () => {
	const readWidget = (observationId: string, sequence: number, id: string) =>
		observation(observationId, sequence, 'read-widget', {
			callInputs: { path: { widgetId: id } },
		})

	it('literalCollisionPair: the two steps select different observations, which selectObservations alone cannot do', () => {
		const index = buildPlanIndex(
			literalCollisionPair.interactionPlan,
			literalCollisionPair.permittedInterfaces,
		)
		const observations = [
			readWidget('obs-a', 1, 'widget-a'),
			readWidget('obs-b', 2, 'widget-b'),
		]
		const [readA, readB] = literalCollisionPair.interactionPlan
		if (readA === undefined || readB === undefined) {
			throw new Error('fixture malformed')
		}
		// The before half of the pair: matching on operationId alone leaves both
		// steps holding the same two observations.
		expect(selectObservations(readA, observations).result).toBe('several')
		expect(selectObservations(readB, observations).result).toBe('several')

		const resolved = resolveCapturedBindings(
			literalCollisionPair.interactionPlan,
			index,
			observations,
		)
		expect(selectWithBindings(readA, observations, index, resolved)).toEqual({
			result: 'one',
			matchedObservationIds: ['obs-a'],
		})
		expect(selectWithBindings(readB, observations, index, resolved)).toEqual({
			result: 'one',
			matchedObservationIds: ['obs-b'],
		})
	})

	it('irreducibleCollisionPair: both steps still return several, since a filter over zero bindings separates nothing', () => {
		const index = buildPlanIndex(
			irreducibleCollisionPair.interactionPlan,
			irreducibleCollisionPair.permittedInterfaces,
		)
		const observations = [
			observation('obs-1', 1, 'ping-service'),
			observation('obs-2', 2, 'ping-service'),
		]
		const resolved = resolveCapturedBindings(
			irreducibleCollisionPair.interactionPlan,
			index,
			observations,
		)
		for (const pingStep of irreducibleCollisionPair.interactionPlan) {
			expect(
				selectWithBindings(pingStep, observations, index, resolved),
			).toEqual({
				result: 'several',
				matchedObservationIds: ['obs-1', 'obs-2'],
			})
		}
	})
})

// Both resolvers select the referenced step through the same binding filter
// this module implements. Selecting it with `selectObservations` alone matches
// on `operationId`, so a step that only its own bindings separate comes back as
// the named ambiguity and every capture from it resolves nothing. These three
// shapes are what that costs, and they are what makes the tier walk
// load-bearing: a referenced step's own captures must already be in the map.
describe('the referenced step is selected under its own bindings', () => {
	const create = (
		observationId: string,
		sequence: number,
		kind: string,
		id: string,
	) =>
		observation(observationId, sequence, 'create-note', {
			callInputs: { body: { kind } },
			responseBody: { id },
		})

	it('a capture from one half of a literal-bound collision pair resolves that half, and the referencing step selects', () => {
		const plan = [
			step('make-a', 'create-note', {
				inputBinding: { body: { kind: { literal: 'alpha' } } },
			}),
			step('make-b', 'create-note', {
				inputBinding: { body: { kind: { literal: 'beta' } } },
			}),
			step('read', 'read-note', {
				inputBinding: { path: { id: capturedFrom('make-a', 'id') } },
			}),
		]
		const index = planIndex(plan)
		const observations = [
			create('o1', 1, 'alpha', 'ID-A'),
			create('o2', 2, 'beta', 'ID-B'),
			observation('o3', 3, 'read-note', {
				callInputs: { path: { id: 'ID-A' } },
			}),
		]
		const resolved = resolveCapturedBindings(plan, index, observations)

		expect(
			resolveCapturedValue(
				'/interactions/make-a/response-body/id',
				index,
				observations,
				resolved,
			),
		).toEqual({
			status: 'resolved',
			value: 'ID-A',
			observationId: 'o1',
			sequence: 1,
		})
		expect(
			selectWithBindings(
				plan[2] as InteractionStep,
				observations,
				index,
				resolved,
			),
		).toEqual({ result: 'one', matchedObservationIds: ['o3'] })
	})

	it('a two-link capture chain resolves at both links', () => {
		const plan = [
			step('s1', 'op-a'),
			step('s2', 'op-b', {
				inputBinding: { path: { id: capturedFrom('s1', 'id') } },
			}),
			step('s3', 'op-c', {
				inputBinding: { path: { id: capturedFrom('s2', 'id') } },
			}),
		]
		const index = planIndex(plan)
		const observations = [
			observation('a1', 1, 'op-a', { responseBody: { id: 'X' } }),
			observation('b1', 2, 'op-b', {
				callInputs: { path: { id: 'X' } },
				responseBody: { id: 'Y' },
			}),
			observation('b2', 3, 'op-b', {
				callInputs: { path: { id: 'Z' } },
				responseBody: { id: 'W' },
			}),
			observation('c1', 4, 'op-c', { callInputs: { path: { id: 'Y' } } }),
		]
		const resolved = resolveCapturedBindings(plan, index, observations)

		expect(
			selectWithBindings(
				plan[1] as InteractionStep,
				observations,
				index,
				resolved,
			),
		).toEqual({ result: 'one', matchedObservationIds: ['b1'] })
		expect(
			selectWithBindings(
				plan[2] as InteractionStep,
				observations,
				index,
				resolved,
			),
		).toEqual({ result: 'one', matchedObservationIds: ['c1'] })
	})

	it('an after clause naming one half of a collision pair imposes that half sequence as the floor', () => {
		const plan = [
			step('make-a', 'create-note', {
				inputBinding: { body: { kind: { literal: 'alpha' } } },
			}),
			step('make-b', 'create-note', {
				inputBinding: { body: { kind: { literal: 'beta' } } },
			}),
			step('read', 'read-note', { after: 'make-a' }),
		]
		const index = planIndex(plan)
		const observations = [
			create('o1', 1, 'alpha', 'ID-A'),
			create('o2', 2, 'beta', 'ID-B'),
			observation('o3', 3, 'read-note'),
		]

		expect(
			selectWithBindings(
				plan[2] as InteractionStep,
				observations,
				index,
				resolveCapturedBindings(plan, index, observations),
			),
		).toEqual({ result: 'one', matchedObservationIds: ['o3'] })
	})

	it('an after clause cycle terminates and fails closed, since only an uncompiled plan can carry one', () => {
		// `checkNestedTemporalClause` rejects every `after` cycle at compile time,
		// so this is reachable only by driving the module directly. The guard is
		// what keeps the mutual recursion between the two resolvers total.
		const plan = [
			step('x', 'op-a', { after: 'y' }),
			step('y', 'op-a', { after: 'x' }),
		]
		const index = planIndex(plan)
		const observations = [observation('d1', 1, 'op-a')]

		expect(
			selectWithBindings(
				plan[0] as InteractionStep,
				observations,
				index,
				new Map(),
			),
		).toEqual({ result: 'none', matchedObservationIds: [] })
	})
})
