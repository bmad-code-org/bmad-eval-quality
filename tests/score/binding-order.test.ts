import { describe, expect, it } from 'vitest'
import type { InteractionStep } from '../../src/core/schemas/plan.ts'
import { bindingOrder } from '../../src/core/score/binding-order.ts'

/**
 * A minimal step. Only `stepId` and the input binding vary across these cases:
 * `bindingOrder` reads nothing else, and a fixed `operationId` keeps that
 * visible.
 */
function step(
	stepId: string,
	inputBinding: Partial<InteractionStep['inputBinding']> = {},
): InteractionStep {
	return {
		stepId,
		operationId: 'some-op',
		inputBinding: {
			path: null,
			query: null,
			header: null,
			body: null,
			...inputBinding,
		},
		after: null,
		cardinality: 'exactly-one',
	}
}

/** One capture edge: a body binding taking `key` off `sourceStepId`'s response body. */
function capturing(
	sourceStepId: string,
	key = 'id',
): Partial<InteractionStep['inputBinding']> {
	return {
		body: {
			[key]: { captured: `/interactions/${sourceStepId}/response-body/${key}` },
		},
	}
}

describe('bindingOrder', () => {
	it('puts every step of a capture-free plan in one tier, in declaration order', () => {
		const order = bindingOrder([step('first'), step('second'), step('third')])
		expect(order).toEqual({
			tiers: [['first', 'second', 'third']],
			cyclic: [],
		})
	})

	// Owed item 3's shape: a POST whose server-generated id a later GET binds.
	it('tiers a two-step capture graph with the captured-from step below the capturing step', () => {
		const order = bindingOrder([
			step('write'),
			step('read', capturing('write')),
		])
		expect(order).toEqual({ tiers: [['write'], ['read']], cyclic: [] })
	})

	it('tiers a three-step capture chain into three tiers', () => {
		const order = bindingOrder([
			step('write'),
			step('read', capturing('write')),
			step('recheck', capturing('read')),
		])
		expect(order).toEqual({
			tiers: [['write'], ['read'], ['recheck']],
			cyclic: [],
		})
	})

	// The load-bearing assertion for the within-tier ordering decision. An
	// authored `interactionPlan` is the author's own declaration: permuting it
	// yields a different contract with a different digest, so array position
	// carries meaning here. ADR-006's ban on reading order off array position
	// applies to a run record, where the array is an ingest artifact nobody
	// authored, and no `sequence` exists at compile time to order a tier by.
	it('orders a tier by declaration order where sorted stepId order would disagree', () => {
		const order = bindingOrder([
			step('source'),
			step('zebra', capturing('source')),
			step('alpha', capturing('source')),
		])
		expect(order.tiers).toEqual([['source'], ['zebra', 'alpha']])
		// Lexicographic order would have read ['alpha', 'zebra'] here.
		expect(order.tiers[1]).not.toEqual(['alpha', 'zebra'])
	})

	// The other three `BindingValue` members declare no dependency, so a step
	// carrying only those has nothing to wait for.
	it('leaves literal, matcher, and principal bindings in tier zero', () => {
		const order = bindingOrder([
			step('write-literal', { body: { title: { literal: 'alpha' } } }),
			step('match-any', { query: { q: { matcher: 'any' } } }),
			step('match-violating', {
				body: { title: { matcher: 'type-violating' } },
			}),
			step('as-owner', { header: { authorization: { principal: 'owner' } } }),
		])
		expect(order).toEqual({
			tiers: [['write-literal', 'match-any', 'match-violating', 'as-owner']],
			cyclic: [],
		})
	})

	// A dangling capture is `unreachable-check-evidence`'s at compile time, so
	// this function invents no ordering for it and the step stays tier zero.
	it('leaves a step whose capture names an undeclared step in tier zero', () => {
		const order = bindingOrder([
			step('reader', capturing('ghost')),
			step('other'),
		])
		expect(order).toEqual({ tiers: [['reader', 'other']], cyclic: [] })
	})

	// A self-capture is a cycle of one: `binding-cycle` rejects it at compile
	// time, and here the fact comes back as data, matching `selectObservations`'s
	// own policy of reporting an ambiguity it will not decide.
	it('reports a self-capture as cyclic and places it in no tier', () => {
		const order = bindingOrder([step('loop', capturing('loop')), step('plain')])
		expect(order).toEqual({ tiers: [['plain']], cyclic: ['loop'] })
	})

	it('reports both members of a two-step capture cycle as cyclic and neither in any tier', () => {
		const order = bindingOrder([
			step('solo'),
			step('ping', capturing('pong')),
			step('pong', capturing('ping')),
		])
		expect(order.cyclic).toEqual(['ping', 'pong'])
		expect(order.tiers).toEqual([['solo']])
		expect(order.tiers.flat()).not.toContain('ping')
		expect(order.tiers.flat()).not.toContain('pong')
	})

	// The partition a caller relies on to walk the plan exactly once: a step
	// listed twice would be resolved twice, and a step listed nowhere would be
	// silently skipped.
	it('places every declared id exactly once across tiers and cyclic combined', () => {
		const plan = [
			step('write'),
			step('read', capturing('write')),
			step('dangling', capturing('ghost')),
			step('ping', capturing('pong')),
			step('pong', capturing('ping')),
		]
		const order = bindingOrder(plan)
		const placed = [...order.tiers.flat(), ...order.cyclic]
		expect([...placed].sort()).toEqual(
			plan.map((declared) => declared.stepId).sort(),
		)
		expect(new Set(placed).size).toBe(placed.length)
	})

	// Neither schema enforces `stepId` uniqueness, and which of two same-named
	// steps a capture meant is undecidable here, so the name is one node.
	it('collapses a duplicated stepId to one node appearing once', () => {
		const order = bindingOrder([step('dup'), step('other'), step('dup')])
		expect(order).toEqual({ tiers: [['dup', 'other']], cyclic: [] })
		expect(order.tiers.flat().filter((id) => id === 'dup')).toHaveLength(1)
	})

	// Kahn's residue is every unplaced id, so a step that merely depends on a cycle
	// lands in `cyclic` alongside the cycle's own members. The disposition is
	// fail-closed and a compiled contract never reaches it, but the module supports
	// an uncompiled plan, so the field says what it actually holds.
	it('cyclic holds steps downstream of a cycle as well as the cycle members', () => {
		const order = bindingOrder([
			step('s1', capturing('s2')),
			step('s2', capturing('s1')),
			step('s3', capturing('s1')),
		])

		expect(order.tiers).toEqual([])
		expect(order.cyclic).toEqual(['s1', 's2', 's3'])
	})

	// `selectWithBindings` resolves a temporal anchor through the same binding
	// filter as everything else, so a step reading an anchor needs that anchor's
	// own capture sites already written. Tiering captures alone left `c` in tier
	// zero beside `b`, and whether `d` resolved then depended on whether `a` was
	// declared before it inside tier one.
	it('an after clause is a resolution dependency, so the anchor tiers below the step that names it', () => {
		const plan = [
			step('b'),
			step('a', capturing('b')),
			{ ...step('c'), after: 'a' },
			step('d', capturing('c')),
		]

		expect(bindingOrder(plan).tiers).toEqual([['b'], ['a'], ['c'], ['d']])
		// Permuting the declaration changes which step sits where in the array and
		// leaves every tier assignment alone.
		expect(
			bindingOrder([plan[3], plan[2], plan[1], plan[0]] as typeof plan).tiers,
		).toEqual([['b'], ['a'], ['c'], ['d']])
	})

	it('a cycle of after edges alone lands in cyclic, the same fail-closed disposition a capture cycle gets', () => {
		// `nested-temporal-clause` rejects this at compile time, so only an
		// uncompiled plan reaches it.
		const order = bindingOrder([
			{ ...step('x'), after: 'y' },
			{ ...step('y'), after: 'x' },
		])

		expect(order.tiers).toEqual([])
		expect(order.cyclic).toEqual(['x', 'y'])
	})

	it('an after clause naming a step the plan does not declare imposes no dependency', () => {
		// AD-39's permissive dangling reference.
		expect(bindingOrder([{ ...step('only'), after: 'ghost' }]).tiers).toEqual([
			['only'],
		])
	})
})
