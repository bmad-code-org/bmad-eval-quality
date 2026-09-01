/**
 * Owed item 3's three compile-time checks over captured input bindings, each
 * called directly rather than through `compile`: `binding-cycle`,
 * `captured-channel-undeclared`, and the captured-pointer residue of
 * `unreachable-check-evidence`. `compile.test.ts` proves only that the registry
 * reaches all three; the behaviour of each is here.
 */
import { describe, expect, it } from 'vitest'
import {
	capturedBindings,
	checkBindingCycle,
	checkCapturedChannel,
	checkCapturedReachability,
} from '../../src/core/compile/bindings.ts'
import { checkUndeclaredMandatoryInput } from '../../src/core/compile/interface-inventory.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import type { InteractionStep } from '../../src/core/schemas/plan.ts'
import { populatedContract } from '../schemas/fixtures/relevance-contracts.ts'
import { structuralFailureOf } from './helpers.ts'

/**
 * `populatedContract`, cloned, mutated, then parsed, so every check under test
 * sees a real parsed contract the way `compile.test.ts` feeds one.
 */
function contractWith(mutate: (contract: any) => void): EvalContract {
	const contract = structuredClone(populatedContract) as any
	mutate(contract)
	return EvalContract.parse(contract)
}

/**
 * `populatedContract` with the `list` step's one query binding replaced by a
 * capture. That site is the natural forward direction (`list.after = 'create'`
 * already), so a capture from `create` there closes no ordering cycle and the
 * check under test is the only one with anything to say.
 */
function capturedIntoListLimit(pointer: string): EvalContract {
	return contractWith((contract) => {
		contract.interactionPlan[1].inputBinding.query.limit = { captured: pointer }
	})
}

/** A step whose only interesting feature is its binding map. */
function stepWithBindings(
	inputBinding: InteractionStep['inputBinding'],
): InteractionStep {
	return {
		stepId: 'probe',
		operationId: 'create-thing',
		inputBinding,
		after: null,
		cardinality: 'exactly-one',
	}
}

const CREATE_NAME_PATH =
	'EvalContract.interactionPlan[stepId=create].inputBinding.body["name"]'
const LIST_LIMIT_PATH =
	'EvalContract.interactionPlan[stepId=list].inputBinding.query["limit"]'

describe('capturedBindings', () => {
	it('returns captures in fixed transport-channel order then by key name, independent of the authored key order', () => {
		// The map is authored body-first with `zeta` before `alpha`, so insertion
		// order and the returned order disagree on both axes at once.
		const step = stepWithBindings({
			body: {
				zeta: { captured: '/interactions/create/response-body/ok' },
				alpha: { captured: '/interactions/create/response-body/id' },
			},
			header: { auth: { captured: '/interactions/create/response-body/id' } },
			query: { limit: { captured: '/interactions/create/response-body/id' } },
			path: { id: { captured: '/interactions/create/response-body/id' } },
		})

		const captures = capturedBindings(step)
		expect(
			captures.map((capture) => `${capture.transportChannel}.${capture.key}`),
		).toEqual([
			'path.id',
			'query.limit',
			'header.auth',
			'body.alpha',
			'body.zeta',
		])
		expect(captures[0]?.target.stepId).toBe('create')
		expect(captures[0]?.target.channel).toBe('response-body')
	})

	it('returns nothing for a step binding only literals, matchers and principals', () => {
		const step = stepWithBindings({
			path: null,
			query: null,
			header: null,
			body: {
				count: { literal: 10 },
				name: { matcher: 'any' },
				other: { matcher: 'type-violating' },
				actor: { principal: 'owner' },
			},
		})

		expect(capturedBindings(step)).toEqual([])
	})
})

describe('checkBindingCycle: binding-cycle', () => {
	it('passes with no throw against populatedContract, whose two steps carry no capture at all', () => {
		expect(() =>
			checkBindingCycle(EvalContract.parse(populatedContract)),
		).not.toThrow()
	})

	it('a step capturing from its own response throws, artifactPath naming that binding site', () => {
		const contract = contractWith((c) => {
			c.interactionPlan[0].inputBinding.body.name = {
				captured: '/interactions/create/response-body/id',
			}
		})

		const failure = structuralFailureOf(() => checkBindingCycle(contract))
		expect(failure.code).toBe('binding-cycle')
		expect(failure.artifactPath).toBe(CREATE_NAME_PATH)
	})

	it('a two-step capture cycle throws, artifactPath naming the first capture edge entered', () => {
		// `after` is cleared on both steps, so the cycle is carried by capture
		// edges alone: create -> list and list -> create.
		const contract = contractWith((c) => {
			c.interactionPlan[0].inputBinding.body.name = {
				captured: '/interactions/list/response-body/items',
			}
			c.interactionPlan[1].inputBinding.query.limit = {
				captured: '/interactions/create/response-body/id',
			}
			c.interactionPlan[1].after = null
		})

		const failure = structuralFailureOf(() => checkBindingCycle(contract))
		expect(failure.code).toBe('binding-cycle')
		expect(failure.artifactPath).toBe(CREATE_NAME_PATH)
	})

	it('one capture edge plus one after edge closing it in the other direction throws, though each graph alone is acyclic', () => {
		// `create` captures from `list`, giving a capture graph with the single
		// edge create -> list. `list.after` is the fixture's own 'create', giving
		// an `after` graph with the single edge list -> create. One edge each
		// cannot cycle; their union does, and it is unsatisfiable because both
		// edge kinds assert the same "observed after" ordering.
		const contract = contractWith((c) => {
			c.interactionPlan[0].inputBinding.body.name = {
				captured: '/interactions/list/response-body/items',
			}
		})

		const failure = structuralFailureOf(() => checkBindingCycle(contract))
		expect(failure.code).toBe('binding-cycle')
		expect(failure.artifactPath).toBe(CREATE_NAME_PATH)
		expect(failure.message).toContain('capture and temporal-clause edges')
	})

	it('a cycle made only of after edges does not throw here, even with a capture edge reaching into it: that shape belongs to nested-temporal-clause', () => {
		// `create.after = 'list'` closes an after-only cycle against the fixture's
		// own `list.after = 'create'`. `probe` is declared first so the walk enters
		// the cycle along its capture edge: the capture sits on the path before the
		// cycle begins and is no part of it, which is the discriminating order. A
		// walk that searched the whole path rather than the cycle slice would
		// report this after-only cycle as a binding-cycle.
		const contract = contractWith((c) => {
			c.interactionPlan[0].after = 'list'
			c.interactionPlan.unshift({
				stepId: 'probe',
				operationId: 'create-thing',
				inputBinding: {
					path: null,
					query: null,
					header: null,
					body: {
						name: { captured: '/interactions/create/response-body/id' },
					},
				},
				after: null,
				cardinality: 'exactly-one',
			})
		})

		expect(() => checkBindingCycle(contract)).not.toThrow()
	})

	it('a mixed cycle entered along an after edge throws, so the verdict does not depend on which edge kind is enumerated first', () => {
		// `u` carries both an `after` and a capture edge into `b`; `b` reaches `x`
		// by capture; `x.after` closes back on `u`. A depth-first walk that
		// inspects each back edge decides this on the order the two edges leaving
		// `u` happen to be enumerated in, so it reports the cycle when captures
		// come first and misses it when `after` does. Components decide it from
		// the graph alone: `u`, `b`, and `x` are one component, and the capture
		// edge u -> b has both endpoints in it.
		const bind = (pointer: string) => ({
			path: null,
			query: null,
			header: null,
			body: { name: { captured: pointer } },
		})
		const contract = contractWith((c) => {
			c.interactionPlan = [
				{
					stepId: 'u',
					operationId: 'create-thing',
					inputBinding: bind('/interactions/b/response-body/id'),
					after: 'b',
					cardinality: 'exactly-one',
				},
				{
					stepId: 'b',
					operationId: 'create-thing',
					inputBinding: bind('/interactions/x/response-body/id'),
					after: null,
					cardinality: 'exactly-one',
				},
				{
					stepId: 'x',
					operationId: 'create-thing',
					inputBinding: {
						path: null,
						query: null,
						header: null,
						body: { name: { matcher: 'any' } },
					},
					after: 'u',
					cardinality: 'exactly-one',
				},
			]
		})

		const failure = structuralFailureOf(() => checkBindingCycle(contract))
		expect(failure.code).toBe('binding-cycle')
		expect(failure.artifactPath).toBe(
			'EvalContract.interactionPlan[stepId=u].inputBinding.body["name"]',
		)
	})

	it('an acyclic capture chain of three steps does not throw', () => {
		const contract = contractWith((c) => {
			c.interactionPlan = [
				{
					stepId: 'one',
					operationId: 'create-thing',
					inputBinding: {
						path: null,
						query: null,
						header: null,
						body: { name: { matcher: 'any' } },
					},
					after: null,
					cardinality: 'exactly-one',
				},
				{
					stepId: 'two',
					operationId: 'create-thing',
					inputBinding: {
						path: null,
						query: null,
						header: null,
						body: { name: { captured: '/interactions/one/response-body/id' } },
					},
					after: 'one',
					cardinality: 'exactly-one',
				},
				{
					stepId: 'three',
					operationId: 'create-thing',
					inputBinding: {
						path: null,
						query: null,
						header: null,
						body: { name: { captured: '/interactions/two/response-body/id' } },
					},
					after: 'two',
					cardinality: 'exactly-one',
				},
			]
		})

		expect(() => checkBindingCycle(contract)).not.toThrow()
	})

	it('a captured pointer naming an undeclared step does not throw: a dangling reference is not a cycle', () => {
		const contract = capturedIntoListLimit(
			'/interactions/ghost/response-body/id',
		)

		expect(() => checkBindingCycle(contract)).not.toThrow()
	})
})

describe('checkCapturedChannel: captured-channel-undeclared', () => {
	it.each([
		['/interactions/create/response-headers/etag', 'response-headers'],
		['/interactions/create/response-status', 'response-status'],
		['/interactions/create/call-inputs/body/name', 'call-inputs'],
		['/interactions/create/stdout', 'stdout'],
		['/interactions/create/stderr', 'stderr'],
		['/interactions/create/exit-code', 'exit-code'],
	])(
		'a capture on %s throws, message naming the %s channel',
		(pointer, channel) => {
			const failure = structuralFailureOf(() =>
				checkCapturedChannel(capturedIntoListLimit(pointer)),
			)
			expect(failure.code).toBe('captured-channel-undeclared')
			expect(failure.artifactPath).toBe(LIST_LIMIT_PATH)
			expect(failure.message).toContain(`names the ${channel} channel`)
		},
	)

	it('a response-body capture does not throw: it is the one channel the response descriptor declares', () => {
		const contract = capturedIntoListLimit(
			'/interactions/create/response-body/id',
		)

		expect(() => checkCapturedChannel(contract)).not.toThrow()
	})
})

describe('checkCapturedReachability: unreachable-check-evidence', () => {
	it('a captured pointer naming an undeclared step throws', () => {
		const failure = structuralFailureOf(() =>
			checkCapturedReachability(
				capturedIntoListLimit('/interactions/ghost/response-body/id'),
			),
		)
		expect(failure.code).toBe('unreachable-check-evidence')
		expect(failure.artifactPath).toBe(LIST_LIMIT_PATH)
		expect(failure.message).toContain(
			'names a step the interaction plan does not declare',
		)
	})

	it('a captured pointer naming a body key declared in neither requiredKeys nor permittedKeys throws', () => {
		const failure = structuralFailureOf(() =>
			checkCapturedReachability(
				capturedIntoListLimit('/interactions/create/response-body/notAField'),
			),
		)
		expect(failure.code).toBe('unreachable-check-evidence')
		expect(failure.artifactPath).toBe(LIST_LIMIT_PATH)
		expect(failure.message).toContain(
			'declares in neither requiredKeys nor permittedKeys',
		)
	})

	it('an empty tail throws: the whole response body declares no scalar to capture', () => {
		const failure = structuralFailureOf(() =>
			checkCapturedReachability(
				capturedIntoListLimit('/interactions/create/response-body'),
			),
		)
		expect(failure.code).toBe('unreachable-check-evidence')
		expect(failure.artifactPath).toBe(LIST_LIMIT_PATH)
		expect(failure.message).toContain('addresses the whole response body')
	})

	it('a two-segment tail throws', () => {
		// `items` is declared `array`, so the reachability pass admits the descent
		// (it blocks descent only past a declared scalar) and the one-segment rule
		// here is what rejects the pointer.
		const contract = contractWith((c) => {
			c.interactionPlan[0].inputBinding.body.name = {
				captured: '/interactions/list/response-body/items/0',
			}
		})

		const failure = structuralFailureOf(() =>
			checkCapturedReachability(contract),
		)
		expect(failure.code).toBe('unreachable-check-evidence')
		expect(failure.artifactPath).toBe(CREATE_NAME_PATH)
		expect(failure.message).toContain('2 segments deep')
	})

	it('an array-index tail throws even where the declared root collection admits the index', () => {
		// `list-things` declares its collection at `/items`, and
		// `evaluatePointerReachability` indexes directly only against a collection
		// declared at the root, so the root entry is added here (fixture 38's own
		// shape in reachability.test.ts). Reachability then admits `/0`, which
		// leaves this module's array-index rule as the one thing rejecting it.
		const contract = contractWith((c) => {
			c.permittedInterfaces[0].operations[1].responseDescriptor.collectionLocations =
				[
					{
						pointer: '',
						expectedCardinality: { mode: 'exact', count: 3 },
						referenceSet: null,
					},
				]
			c.interactionPlan[0].inputBinding.body.name = {
				captured: '/interactions/list/response-body/0',
			}
		})

		const failure = structuralFailureOf(() =>
			checkCapturedReachability(contract),
		)
		expect(failure.code).toBe('unreachable-check-evidence')
		expect(failure.artifactPath).toBe(CREATE_NAME_PATH)
		expect(failure.message).toContain('addresses response-body element 0')
	})

	it('a declared type of array throws: a capture binds a scalar', () => {
		const contract = contractWith((c) => {
			c.interactionPlan[0].inputBinding.body.name = {
				captured: '/interactions/list/response-body/items',
			}
		})

		const failure = structuralFailureOf(() =>
			checkCapturedReachability(contract),
		)
		expect(failure.code).toBe('unreachable-check-evidence')
		expect(failure.artifactPath).toBe(CREATE_NAME_PATH)
		expect(failure.message).toContain('declares "array" rather than a scalar')
	})

	it('an indeterminate declared type on the captured side throws', () => {
		const contract = contractWith((c) => {
			c.permittedInterfaces[0].operations[0].responseDescriptor.types.id = null
			c.interactionPlan[1].inputBinding.query.limit = {
				captured: '/interactions/create/response-body/id',
			}
		})

		const failure = structuralFailureOf(() =>
			checkCapturedReachability(contract),
		)
		expect(failure.code).toBe('unreachable-check-evidence')
		expect(failure.artifactPath).toBe(LIST_LIMIT_PATH)
		expect(failure.message).toContain('declares indeterminate')
	})

	it('a body key absent from the types map entirely throws', () => {
		// `id` stays in requiredKeys, so reachability still admits the pointer and
		// the missing type declaration is the whole defect.
		const contract = contractWith((c) => {
			delete c.permittedInterfaces[0].operations[0].responseDescriptor.types.id
			c.interactionPlan[1].inputBinding.query.limit = {
				captured: '/interactions/create/response-body/id',
			}
		})

		const failure = structuralFailureOf(() =>
			checkCapturedReachability(contract),
		)
		expect(failure.code).toBe('unreachable-check-evidence')
		expect(failure.artifactPath).toBe(LIST_LIMIT_PATH)
		expect(failure.message).toContain('does not declare')
	})

	it('a captured string bound to a number parameter throws, message naming both declared types', () => {
		const failure = structuralFailureOf(() =>
			checkCapturedReachability(
				capturedIntoListLimit('/interactions/create/response-body/id'),
			),
		)
		expect(failure.code).toBe('unreachable-check-evidence')
		expect(failure.artifactPath).toBe(LIST_LIMIT_PATH)
		expect(failure.message).toContain('resolves to a declared "string"')
		expect(failure.message).toContain('the "number" the bound query parameter')
	})

	it('an indeterminate declared type on the bound parameter side throws', () => {
		const contract = contractWith((c) => {
			c.permittedInterfaces[0].operations[1].requestShape.query.types.limit =
				null
			c.interactionPlan[1].inputBinding.query.limit = {
				captured: '/interactions/create/response-body/id',
			}
		})

		const failure = structuralFailureOf(() =>
			checkCapturedReachability(contract),
		)
		expect(failure.code).toBe('unreachable-check-evidence')
		expect(failure.artifactPath).toBe(LIST_LIMIT_PATH)
		expect(failure.message).toContain('no type equality is decidable')
	})

	it('a declared string captured into a declared string parameter does not throw', () => {
		const contract = contractWith((c) => {
			c.interactionPlan.push({
				stepId: 'create-again',
				operationId: 'create-thing',
				inputBinding: {
					path: null,
					query: null,
					header: null,
					body: {
						name: { captured: '/interactions/create/response-body/id' },
					},
				},
				after: 'create',
				cardinality: 'exactly-one',
			})
		})

		expect(() => checkCapturedReachability(contract)).not.toThrow()
	})

	it('an unresolvable pointer on a non-body channel still reports unreachable-check-evidence, the higher-ranked code', () => {
		// The step and the operation are resolved before the channel test, so a
		// pointer that is unresolvable AND off-body reports registry index 2
		// rather than index 15. Deferring it would also make
		// `checkCapturedChannel` assert something about a response descriptor
		// that no declared operation supplies.
		const failure = structuralFailureOf(() =>
			checkCapturedReachability(
				capturedIntoListLimit('/interactions/ghost/stdout/x'),
			),
		)
		expect(failure.code).toBe('unreachable-check-evidence')
		expect(failure.artifactPath).toBe(LIST_LIMIT_PATH)
		expect(failure.message).toContain(
			'names a step the interaction plan does not declare',
		)
	})

	it('a capture bound to a wholly undeclared key is left to undeclared-mandatory-input, which is strict-only', () => {
		// A key in neither `requiredKeys` nor `permittedKeys` is an input the
		// contract did not declare, and AD-4 makes that code strict-only. Claiming
		// it here would reject a non-strict contract under a code naming a
		// different defect, and would treat this key more harshly than the same
		// key bound to a literal.
		const contract = contractWith((c) => {
			c.interactionPlan[1].inputBinding.query.ghostkey = {
				captured: '/interactions/create/response-body/id',
			}
		})

		expect(() => checkCapturedReachability(contract)).not.toThrow()
		const failure = structuralFailureOf(() =>
			checkUndeclaredMandatoryInput(contract),
		)
		expect(failure.code).toBe('undeclared-mandatory-input')
		expect(failure.artifactPath).toBe(
			'EvalContract.interactionPlan[stepId=list].inputBinding.query["ghostkey"]',
		)
	})

	it('a non-body channel capture is skipped here, so checkCapturedChannel keeps every one of them', () => {
		// This is the registry-order split: `checkCapturedReachability` runs at the
		// third rung and `checkCapturedChannel` at its own inserted position, so a
		// non-body capture reaching a reachability throw would shadow the code that
		// names the real defect.
		const contract = capturedIntoListLimit(
			'/interactions/create/response-status',
		)

		expect(() => checkCapturedReachability(contract)).not.toThrow()
		const failure = structuralFailureOf(() => checkCapturedChannel(contract))
		expect(failure.code).toBe('captured-channel-undeclared')
		expect(failure.artifactPath).toBe(LIST_LIMIT_PATH)
	})
})
