import { describe, expect, it } from 'vitest'
import {
	BindingValue,
	InputBinding,
	InteractionStep,
} from '../../src/core/schemas/plan.ts'

const unbound = { path: null, query: null, header: null, body: null }

describe('the tagged input binding', () => {
	// AD-39 records the untagged spelling flipping a witness match between
	// `caught` and `missed` on one record. The schema is where it dies.
	it('rejects an untagged value', () => {
		expect(BindingValue.safeParse('type-violating').success).toBe(false)
	})

	it('accepts the matcher and the literal, and keeps them distinguishable', () => {
		const matcher = BindingValue.parse({ matcher: 'type-violating' })
		const literal = BindingValue.parse({ literal: 'type-violating' })
		expect(matcher).toEqual({ matcher: 'type-violating' })
		expect(literal).toEqual({ literal: 'type-violating' })
		expect(matcher).not.toEqual(literal)
	})

	it('rejects an untagged binding inside a channel', () => {
		const result = InputBinding.safeParse({
			...unbound,
			body: { title: 'type-violating' },
		})
		expect(result.success).toBe(false)
		expect(result.error?.issues[0]?.path).toEqual(['body', 'title'])
	})

	it('accepts both tagged spellings inside a channel', () => {
		expect(
			InputBinding.safeParse({
				...unbound,
				body: { title: { matcher: 'type-violating' } },
			}).success,
		).toBe(true)
		expect(
			InputBinding.safeParse({
				...unbound,
				body: { title: { literal: 'type-violating' } },
			}).success,
		).toBe(true)
	})

	it('closes the matcher vocabulary at the two AD-39 names', () => {
		expect(BindingValue.safeParse({ matcher: 'anything' }).success).toBe(false)
	})
})

describe('the four-key binding container', () => {
	it('requires all four channels to be present', () => {
		const result = InputBinding.safeParse({
			path: null,
			query: null,
			body: null,
		})
		expect(result.success).toBe(false)
		expect(result.error?.issues[0]?.path).toEqual(['header'])
		expect(result.error?.issues[0]?.code).toBe('invalid_type')
	})

	it('rejects a fifth channel', () => {
		const result = InputBinding.safeParse({ ...unbound, cookie: null })
		expect(result.success).toBe(false)
		expect(result.error?.issues[0]?.code).toBe('unrecognized_keys')
	})

	it('spells an unbound channel as null and rejects the empty map', () => {
		expect(InputBinding.safeParse(unbound).success).toBe(true)
		const result = InputBinding.safeParse({ ...unbound, query: {} })
		expect(result.success).toBe(false)
		expect(result.error?.issues[0]?.code).toBe('custom')
		expect(result.error?.issues[0]?.path).toEqual(['query'])
	})
})

describe('an interaction step', () => {
	const step = {
		stepId: 'read-back',
		operationId: 'get-note',
		inputBinding: { ...unbound, path: { id: { literal: 'n-1' } } },
		after: 'write',
	}

	it('parses with a temporal clause', () => {
		expect(InteractionStep.safeParse(step).success).toBe(true)
	})

	it('parses with an explicit null temporal clause', () => {
		expect(InteractionStep.safeParse({ ...step, after: null }).success).toBe(
			true,
		)
	})

	it('rejects an omitted temporal clause, because absence is explicit', () => {
		const { after: _after, ...withoutClause } = step
		const result = InteractionStep.safeParse(withoutClause)
		expect(result.success).toBe(false)
		expect(result.error?.issues[0]?.path).toEqual(['after'])
	})

	it('rejects a step identifier outside the shared charset', () => {
		const result = InteractionStep.safeParse({ ...step, stepId: 'read/back' })
		expect(result.success).toBe(false)
		expect(result.error?.issues[0]?.path).toEqual(['stepId'])
	})

	// `nested-temporal-clause` is Epic 4's code, so the shape it fires on has to
	// parse. A named deviation from the epic's acceptance criteria of record.
	it('admits a chain of temporal clauses, which is Epic 4 to reject', () => {
		const chain = [
			{ ...step, stepId: 'first', after: null },
			{ ...step, stepId: 'second', after: 'first' },
			{ ...step, stepId: 'third', after: 'second' },
		]
		for (const link of chain) {
			expect(InteractionStep.safeParse(link).success).toBe(true)
		}
	})
})
