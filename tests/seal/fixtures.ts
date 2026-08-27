// Fixtures beyond `gateCContract`, per AC 5's "a full contract is not
// required if the pieces are independently constructible" note. Each is a
// small, schema-shaped `Direction` plus the `interactionPlan`/
// `permittedInterfaces` slice `PlanIndex` needs.
import { z } from 'zod'
import {
	type Operation,
	PermittedInterface,
} from '../../src/core/schemas/interface.ts'
import { Direction } from '../../src/core/schemas/oracle.ts'
import { InteractionStep } from '../../src/core/schemas/plan.ts'
import { gateCContract } from '../schemas/fixtures/gate-c-contract.ts'
import { populatedContract } from '../schemas/fixtures/relevance-contracts.ts'

// `gateCContract`/`populatedContract` type-check via `satisfies EvalContract`
// at their own declaration site, but TypeScript's inferred type for a
// `permittedInterfaces[].operations` array with dissimilar element shapes
// (get-export carries `rowCount`, submit-export does not) is narrower than
// `Operation` and fails a spurious "possibly undefined" check downstream.
// Re-parsing through the schema sidesteps the inference gap and validates in
// one step.
export const gateCInteractionPlan: readonly InteractionStep[] = z
	.array(InteractionStep)
	.parse(gateCContract.interactionPlan)
export const gateCPermittedInterfaces: readonly PermittedInterface[] = z
	.array(PermittedInterface)
	.parse(gateCContract.permittedInterfaces)

export const populatedInteractionPlan: readonly InteractionStep[] = z
	.array(InteractionStep)
	.parse(populatedContract.interactionPlan)
export const populatedPermittedInterfaces: readonly PermittedInterface[] = z
	.array(PermittedInterface)
	.parse(populatedContract.permittedInterfaces)

// A factory rather than a shared object: several fixtures below reuse this
// shape, and one shared mutable object would let a mutation in one place
// bleed into the others through aliasing.
function emptyChannel(): {
	requiredKeys: string[]
	permittedKeys: string[]
	types: Record<string, null>
} {
	return { requiredKeys: [], permittedKeys: [], types: {} }
}

function readOperation(operationId: string, pathTemplate: string): Operation {
	return {
		operationId,
		method: 'GET',
		pathTemplate,
		stateChangeMarker: false,
		requestShape: {
			path: emptyChannel(),
			query: emptyChannel(),
			header: emptyChannel(),
			body: emptyChannel(),
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

// Validates one hand-authored fixture's constituent pieces against their own
// schemas, called once per fixture below at module load time. A schema
// tightening that would reject a fixture fails loudly here, not silently
// later.
function validateContractSlice(slice: {
	interactionPlan: readonly InteractionStep[]
	permittedInterfaces: readonly PermittedInterface[]
	direction?: Direction
}): void {
	z.array(InteractionStep).parse(slice.interactionPlan)
	z.array(PermittedInterface).parse(slice.permittedInterfaces)
	if (slice.direction !== undefined) {
		Direction.parse(slice.direction)
	}
}

// ---- AC 3: the Gate D Arm 2 reconstruction -----------------------------
// Source: Arm 2's declared direction (reviews/gate-d/PREREGISTRATION.md).
// Content-equivalence only (Decision 1): the spike's "relation" field is
// prose, not one of the sixteen enum values, so this is not a byte-identical
// golden string.
export const gateDReconstruction: {
	interactionPlan: readonly InteractionStep[]
	permittedInterfaces: readonly PermittedInterface[]
	direction: Direction
} = {
	interactionPlan: [
		{
			stepId: 'search',
			operationId: 'search-capsules',
			inputBinding: {
				path: null,
				query: { q: { matcher: 'any' } },
				header: null,
				body: null,
			},
			after: null,
		},
	],
	permittedInterfaces: [
		{
			logicalId: 'capsule-api',
			kind: 'api',
			operations: [readOperation('search-capsules', '/capsules')],
		},
	],
	direction: {
		evidenceTargets: ['/interactions/search/response-body/capsules'],
		relation: 'for-all',
		polarity: 'expects-hold',
		scope: 'one search/filter endpoint response',
		negativeDomain:
			'a returned capsule that does not satisfy the supplied query',
	},
}
validateContractSlice(gateDReconstruction)

// ---- AC 4: the create-then-read-back temporal pair ---------------------
//
// Deliberately named so the operation identity ("create widget" / "read
// widget") shares no substring with either step id ("stash" / "fetch"),
// which is what makes "the rendered text never contains a step id" a
// meaningful, non-vacuous assertion for this fixture.
export const createThenReadBack: {
	interactionPlan: readonly InteractionStep[]
	permittedInterfaces: readonly PermittedInterface[]
	direction: Direction
} = {
	interactionPlan: [
		{
			stepId: 'stash',
			operationId: 'create-widget',
			inputBinding: {
				path: null,
				query: null,
				header: null,
				body: { title: { matcher: 'any' } },
			},
			after: null,
		},
		{
			stepId: 'fetch',
			operationId: 'read-widget',
			inputBinding: {
				path: { widgetId: { matcher: 'any' } },
				query: null,
				header: null,
				body: null,
			},
			after: 'stash',
		},
	],
	permittedInterfaces: [
		{
			logicalId: 'widget-api',
			kind: 'api',
			operations: [
				{
					operationId: 'create-widget',
					method: 'POST',
					pathTemplate: '/widgets',
					stateChangeMarker: true,
					requestShape: {
						path: emptyChannel(),
						query: emptyChannel(),
						header: emptyChannel(),
						body: {
							requiredKeys: ['title'],
							permittedKeys: ['title'],
							types: { title: 'string' },
						},
					},
					responseDescriptor: {
						requiredKeys: ['id'],
						permittedKeys: ['id'],
						types: { id: 'string' },
						successIndicator: '/id',
						channelRoles: null,
						collectionLocations: null,
					},
					volatilePointers: ['/id'],
					sensitivityWitness: null,
				},
				readOperation('read-widget', '/widgets/{widgetId}'),
			],
		},
	],
	direction: {
		evidenceTargets: [
			'/interactions/fetch/response-body/title',
			'/interactions/stash/call-inputs/body/title',
		],
		relation: 'equality',
		polarity: 'expects-hold',
		scope: null,
		negativeDomain:
			'a read-back title that does not match the title the create call sent',
	},
}
validateContractSlice(createThenReadBack)

// ---- AC 4: the same-step pair, which must not take the relational branch --
//
// `gateCContract` O-002 already carries this shape (two targets on one step,
// no temporal relationship). Restated here as a plan/direction pair that
// shares `createThenReadBack`'s interfaces, so a test can assert the two
// AC 4 shapes side by side without depending on `gateCContract`'s own steps.
export const sameStepPair: {
	interactionPlan: readonly InteractionStep[]
	permittedInterfaces: readonly PermittedInterface[]
	direction: Direction
} = {
	interactionPlan: createThenReadBack.interactionPlan,
	permittedInterfaces: createThenReadBack.permittedInterfaces,
	direction: {
		evidenceTargets: [
			'/interactions/fetch/response-status',
			'/interactions/fetch/response-body/title',
		],
		relation: 'all',
		polarity: 'expects-hold',
		scope: null,
		negativeDomain: null,
	},
}
validateContractSlice(sameStepPair)

// ---- a direction with `scope` and `negativeDomain` both `null` ----------
export const bothFreeTextNull: {
	interactionPlan: readonly InteractionStep[]
	permittedInterfaces: readonly PermittedInterface[]
	direction: Direction
} = {
	interactionPlan: [
		{
			stepId: 'read',
			operationId: 'read-widget',
			inputBinding: {
				path: { widgetId: { matcher: 'any' } },
				query: null,
				header: null,
				body: null,
			},
			after: null,
		},
	],
	permittedInterfaces: [
		{
			logicalId: 'widget-api',
			kind: 'api',
			operations: [readOperation('read-widget', '/widgets/{widgetId}')],
		},
	],
	direction: {
		evidenceTargets: ['/interactions/read/response-body/id'],
		relation: 'existence',
		polarity: 'expects-hold',
		scope: null,
		negativeDomain: null,
	},
}
validateContractSlice(bothFreeTextNull)

// ---- a step binding nothing in any of its four channels ------------------
//
// `gateCContract`'s six steps and `populatedContract`'s two each leave at
// least one channel `null`, but none leaves all four `null`; this is the
// common-but-uncovered case AC 2 names explicitly.
export const unboundStep: {
	interactionPlan: readonly InteractionStep[]
	permittedInterfaces: readonly PermittedInterface[]
	direction: Direction
} = {
	interactionPlan: [
		{
			stepId: 'ping',
			operationId: 'ping-service',
			inputBinding: { path: null, query: null, header: null, body: null },
			after: null,
		},
	],
	permittedInterfaces: [
		{
			logicalId: 'ping-api',
			kind: 'api',
			operations: [readOperation('ping-service', '/ping')],
		},
	],
	direction: {
		evidenceTargets: ['/interactions/ping/response-status'],
		relation: 'equality',
		polarity: 'expects-hold',
		scope: 'A liveness probe with no parameters.',
		negativeDomain: 'A non-200 response with no accompanying diagnostic.',
	},
}
validateContractSlice(unboundStep)

// ---- two steps sharing an operation, both `literal`-bound on the same key,
// with different values: `kind` alone renders both "the stated id", forcing
// escalation to the `literal` level (AC 2's escalation step (c)).
export const literalCollisionPair: {
	interactionPlan: readonly InteractionStep[]
	permittedInterfaces: readonly PermittedInterface[]
} = {
	interactionPlan: [
		{
			stepId: 'read-a',
			operationId: 'read-widget',
			inputBinding: {
				path: { widgetId: { literal: 'widget-a' } },
				query: null,
				header: null,
				body: null,
			},
			after: null,
		},
		{
			stepId: 'read-b',
			operationId: 'read-widget',
			inputBinding: {
				path: { widgetId: { literal: 'widget-b' } },
				query: null,
				header: null,
				body: null,
			},
			after: null,
		},
	],
	permittedInterfaces: [
		{
			logicalId: 'widget-api',
			kind: 'api',
			operations: [readOperation('read-widget', '/widgets/{widgetId}')],
		},
	],
}
validateContractSlice(literalCollisionPair)

// ---- two steps sharing an operation with an irreducible, identical binding:
// escalation exhausts every level without achieving distinctness. Proves that
// `renderStepReference` throws a precondition-violation `TypeError` there
// rather than silently shipping a phrase two different steps would share.
export const irreducibleCollisionPair: {
	interactionPlan: readonly InteractionStep[]
	permittedInterfaces: readonly PermittedInterface[]
} = {
	interactionPlan: [
		{
			stepId: 'ping-1',
			operationId: 'ping-service',
			inputBinding: { path: null, query: null, header: null, body: null },
			after: null,
		},
		{
			stepId: 'ping-2',
			operationId: 'ping-service',
			inputBinding: { path: null, query: null, header: null, body: null },
			after: null,
		},
	],
	permittedInterfaces: [
		{
			logicalId: 'ping-api',
			kind: 'api',
			operations: [readOperation('ping-service', '/ping')],
		},
	],
}
validateContractSlice(irreducibleCollisionPair)

// ---- a temporal pair sharing channel, transport channel, and tail (both
// read a "status" field from a response body): the genuine channel-signature
// tie case `channelSignature`/`sentFirstOrder` must still order
// deterministically. The two steps call different operations, so their
// derived references still differ even though the signatures tie exactly.
export const sameFieldTemporalPair: {
	interactionPlan: readonly InteractionStep[]
	permittedInterfaces: readonly PermittedInterface[]
	direction: Direction
} = {
	interactionPlan: [
		{
			stepId: 'observe-a',
			operationId: 'read-first-widget',
			inputBinding: {
				path: { widgetId: { matcher: 'any' } },
				query: null,
				header: null,
				body: null,
			},
			after: null,
		},
		{
			stepId: 'observe-b',
			operationId: 'read-second-widget',
			inputBinding: {
				path: { widgetId: { matcher: 'any' } },
				query: null,
				header: null,
				body: null,
			},
			after: 'observe-a',
		},
	],
	permittedInterfaces: [
		{
			logicalId: 'widget-api',
			kind: 'api',
			operations: [
				readOperation('read-first-widget', '/first-widgets/{widgetId}'),
				readOperation('read-second-widget', '/second-widgets/{widgetId}'),
			],
		},
	],
	direction: {
		evidenceTargets: [
			'/interactions/observe-a/response-body/status',
			'/interactions/observe-b/response-body/status',
		],
		relation: 'deep-equality',
		polarity: 'expects-hold',
		scope: null,
		negativeDomain:
			'a status observed on the later step that disagrees with the earlier one',
	},
}
validateContractSlice(sameFieldTemporalPair)

// ---- three evidence targets, two later steps both naming the same `after`
// predecessor: only one of the two may pair with it (AD-39's one-level bound
// admits both `reader1.after` and `reader2.after` naming `base`, but a step
// can appear in at most one relational-phrase group), and the grouping must
// not depend on which of the three targets is listed first.
export const threeStepSharedAfter: {
	interactionPlan: readonly InteractionStep[]
	permittedInterfaces: readonly PermittedInterface[]
	direction: Direction
} = {
	interactionPlan: [
		{
			stepId: 'base',
			operationId: 'create-base',
			inputBinding: {
				path: null,
				query: null,
				header: null,
				body: { title: { matcher: 'any' } },
			},
			after: null,
		},
		{
			stepId: 'reader1',
			operationId: 'read-one',
			inputBinding: {
				path: { id: { matcher: 'any' } },
				query: null,
				header: null,
				body: null,
			},
			after: 'base',
		},
		{
			stepId: 'reader2',
			operationId: 'read-two',
			inputBinding: {
				path: { id: { matcher: 'any' } },
				query: null,
				header: null,
				body: null,
			},
			after: 'base',
		},
	],
	permittedInterfaces: [
		{
			logicalId: 'shared-after-api',
			kind: 'api',
			operations: [
				{
					operationId: 'create-base',
					method: 'POST',
					pathTemplate: '/bases',
					stateChangeMarker: true,
					requestShape: {
						path: emptyChannel(),
						query: emptyChannel(),
						header: emptyChannel(),
						body: {
							requiredKeys: ['title'],
							permittedKeys: ['title'],
							types: { title: 'string' },
						},
					},
					responseDescriptor: {
						requiredKeys: ['id'],
						permittedKeys: ['id'],
						types: { id: 'string' },
						successIndicator: '/id',
						channelRoles: null,
						collectionLocations: null,
					},
					volatilePointers: ['/id'],
					sensitivityWitness: null,
				},
				readOperation('read-one', '/ones/{id}'),
				readOperation('read-two', '/twos/{id}'),
			],
		},
	],
	direction: {
		evidenceTargets: [
			'/interactions/base/call-inputs/body/title',
			'/interactions/reader1/response-body/title',
			'/interactions/reader2/response-body/title',
		],
		relation: 'all',
		polarity: 'expects-hold',
		scope: null,
		negativeDomain: null,
	},
}
validateContractSlice(threeStepSharedAfter)

// ---- a 3-step linear after chain: step-b names step-a, step-c names step-b.
// Regression fixture for a code-review-found bug where `groupResolvedTargets`
// dropped step-c entirely (step-b consumed as a successor before its own
// predecessor entry was ever read). AD-39 bounds a temporal clause to a step
// carrying none itself, so a compiled contract never declares this shape; the
// fixture only proves the renderer degrades safely, not that the shape is
// legal input.
export const linearAfterChain: {
	interactionPlan: readonly InteractionStep[]
	permittedInterfaces: readonly PermittedInterface[]
	direction: Direction
} = {
	interactionPlan: [
		{
			stepId: 'step-a',
			operationId: 'chain-op-a',
			inputBinding: { path: null, query: null, header: null, body: null },
			after: null,
		},
		{
			stepId: 'step-b',
			operationId: 'chain-op-b',
			inputBinding: { path: null, query: null, header: null, body: null },
			after: 'step-a',
		},
		{
			stepId: 'step-c',
			operationId: 'chain-op-c',
			inputBinding: { path: null, query: null, header: null, body: null },
			after: 'step-b',
		},
	],
	permittedInterfaces: [
		{
			logicalId: 'chain-api',
			kind: 'api',
			operations: [
				readOperation('chain-op-a', '/chain-a'),
				readOperation('chain-op-b', '/chain-b'),
				readOperation('chain-op-c', '/chain-c'),
			],
		},
	],
	direction: {
		evidenceTargets: [
			'/interactions/step-a/response-status',
			'/interactions/step-b/response-status',
			'/interactions/step-c/response-status',
		],
		relation: 'all',
		polarity: 'expects-hold',
		scope: null,
		negativeDomain: null,
	},
}
validateContractSlice(linearAfterChain)

// ---- a 4-step linear after chain: step-2 names step-1, step-3 names step-2,
// step-4 names step-3. Even length, so it forms two disjoint pairs with
// nothing standalone: (step-1, step-2), (step-3, step-4). Recorded in
// `deferred-work.md` against `linearAfterChain` above: once step-2 is spoken
// for, step-3/step-4 is a legal second pairing, not a chain remainder forced
// to standalone.
export const fourStepAfterChain: {
	interactionPlan: readonly InteractionStep[]
	permittedInterfaces: readonly PermittedInterface[]
	direction: Direction
} = {
	interactionPlan: [
		{
			stepId: 'step-1',
			operationId: 'chain-op-1',
			inputBinding: { path: null, query: null, header: null, body: null },
			after: null,
		},
		{
			stepId: 'step-2',
			operationId: 'chain-op-2',
			inputBinding: { path: null, query: null, header: null, body: null },
			after: 'step-1',
		},
		{
			stepId: 'step-3',
			operationId: 'chain-op-3',
			inputBinding: { path: null, query: null, header: null, body: null },
			after: 'step-2',
		},
		{
			stepId: 'step-4',
			operationId: 'chain-op-4',
			inputBinding: { path: null, query: null, header: null, body: null },
			after: 'step-3',
		},
	],
	permittedInterfaces: [
		{
			logicalId: 'four-chain-api',
			kind: 'api',
			operations: [
				readOperation('chain-op-1', '/four-chain-1'),
				readOperation('chain-op-2', '/four-chain-2'),
				readOperation('chain-op-3', '/four-chain-3'),
				readOperation('chain-op-4', '/four-chain-4'),
			],
		},
	],
	direction: {
		evidenceTargets: [
			'/interactions/step-1/response-status',
			'/interactions/step-2/response-status',
			'/interactions/step-3/response-status',
			'/interactions/step-4/response-status',
		],
		relation: 'all',
		polarity: 'expects-hold',
		scope: null,
		negativeDomain: null,
	},
}
validateContractSlice(fourStepAfterChain)

// ---- a 5-step linear after chain, same shape one link longer. Odd length, so
// the walk that produces `fourStepAfterChain`'s two pairs leaves a remainder:
// (step-1, step-2), (step-3, step-4), and step-5 standalone. Proves the
// pairing keeps working past one collapsed pair without assuming the chain
// divides evenly.
export const fiveStepAfterChain: {
	interactionPlan: readonly InteractionStep[]
	permittedInterfaces: readonly PermittedInterface[]
	direction: Direction
} = {
	interactionPlan: [
		...fourStepAfterChain.interactionPlan,
		{
			stepId: 'step-5',
			operationId: 'chain-op-5',
			inputBinding: { path: null, query: null, header: null, body: null },
			after: 'step-4',
		},
	],
	permittedInterfaces: [
		{
			logicalId: 'five-chain-api',
			kind: 'api',
			operations: [
				readOperation('chain-op-1', '/five-chain-1'),
				readOperation('chain-op-2', '/five-chain-2'),
				readOperation('chain-op-3', '/five-chain-3'),
				readOperation('chain-op-4', '/five-chain-4'),
				readOperation('chain-op-5', '/five-chain-5'),
			],
		},
	],
	direction: {
		evidenceTargets: [
			...fourStepAfterChain.direction.evidenceTargets,
			'/interactions/step-5/response-status',
		],
		relation: 'all',
		polarity: 'expects-hold',
		scope: null,
		negativeDomain: null,
	},
}
validateContractSlice(fiveStepAfterChain)

// ---- a reverse-shaped temporal pair: the predecessor is the response-reading
// step, and the successor is the one that sends call-inputs. `sentFirstOrder`
// must still print the "sent" side first here, even though the grouping
// assigns the predecessor (the response-reading step) to its own `a` slot,
// proving the print order is governed by channel rank rather than by which
// side the grouping happened to call `a` or `b`.
export const reverseAfterPair: {
	interactionPlan: readonly InteractionStep[]
	permittedInterfaces: readonly PermittedInterface[]
	direction: Direction
} = {
	interactionPlan: [
		{
			stepId: 'observe',
			operationId: 'read-widget',
			inputBinding: {
				path: { widgetId: { matcher: 'any' } },
				query: null,
				header: null,
				body: null,
			},
			after: null,
		},
		{
			stepId: 'apply',
			operationId: 'update-widget',
			inputBinding: {
				path: { widgetId: { matcher: 'any' } },
				query: null,
				header: null,
				body: { title: { matcher: 'any' } },
			},
			after: 'observe',
		},
	],
	permittedInterfaces: [
		{
			logicalId: 'widget-api',
			kind: 'api',
			operations: [
				readOperation('read-widget', '/widgets/{widgetId}'),
				{
					operationId: 'update-widget',
					method: 'PUT',
					pathTemplate: '/widgets/{widgetId}',
					stateChangeMarker: true,
					requestShape: {
						path: {
							requiredKeys: ['widgetId'],
							permittedKeys: ['widgetId'],
							types: { widgetId: 'string' },
						},
						query: emptyChannel(),
						header: emptyChannel(),
						body: {
							requiredKeys: ['title'],
							permittedKeys: ['title'],
							types: { title: 'string' },
						},
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
				},
			],
		},
	],
	direction: {
		evidenceTargets: [
			'/interactions/observe/response-body/title',
			'/interactions/apply/call-inputs/body/title',
		],
		relation: 'equality',
		polarity: 'expects-hold',
		scope: null,
		negativeDomain: null,
	},
}
validateContractSlice(reverseAfterPair)

// ---- one step binding the same parameter name in two different transport
// channels (path and query). Neither collides with the other once each
// phrase names its own transport channel.
export const sharedKeyAcrossChannels: {
	interactionPlan: readonly InteractionStep[]
	permittedInterfaces: readonly PermittedInterface[]
} = {
	interactionPlan: [
		{
			stepId: 'query-and-path',
			operationId: 'lookup-widget',
			inputBinding: {
				path: { id: { matcher: 'any' } },
				query: { id: { matcher: 'any' } },
				header: null,
				body: null,
			},
			after: null,
		},
	],
	permittedInterfaces: [
		{
			logicalId: 'widget-api',
			kind: 'api',
			operations: [readOperation('lookup-widget', '/widgets/{id}')],
		},
	],
}
validateContractSlice(sharedKeyAcrossChannels)

// ---- one step binding two body parameters declared out of alphabetical
// order. `bindingEntries` must sort them canonically regardless.
export const outOfOrderBindingKeys: {
	interactionPlan: readonly InteractionStep[]
	permittedInterfaces: readonly PermittedInterface[]
} = {
	interactionPlan: [
		{
			stepId: 'submit-both',
			operationId: 'submit-multi',
			inputBinding: {
				path: null,
				query: null,
				header: null,
				body: { zebra: { matcher: 'any' }, apple: { matcher: 'any' } },
			},
			after: null,
		},
	],
	permittedInterfaces: [
		{
			logicalId: 'multi-api',
			kind: 'api',
			operations: [
				{
					operationId: 'submit-multi',
					method: 'POST',
					pathTemplate: '/multi',
					stateChangeMarker: true,
					requestShape: {
						path: emptyChannel(),
						query: emptyChannel(),
						header: emptyChannel(),
						body: {
							requiredKeys: ['apple', 'zebra'],
							permittedKeys: ['apple', 'zebra'],
							types: { apple: 'string', zebra: 'string' },
						},
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
				},
			],
		},
	],
}
validateContractSlice(outOfOrderBindingKeys)
