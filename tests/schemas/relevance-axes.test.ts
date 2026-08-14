// AC 9: every relevance axis has all three declaration states. AD-31 grades an
// absent declaration as a gap and an explicit empty one as an answer, so Story
// 5.3 needs absent, explicitly empty, and populated to be distinguishable on
// each of AD-20's seven rules.

import { describe, expect, it } from 'vitest'
import {
	EvalContract,
	SiblingGroups,
} from '../../src/core/schemas/eval-contract.ts'
import { ResponseDescriptor } from '../../src/core/schemas/interface.ts'
import {
	absentContract,
	explicitlyEmptyContract,
	populatedContract,
	RELEVANCE_CONTRACTS,
} from './fixtures/relevance-contracts.ts'

// Reading through the parser rather than off the literal: the assertions then
// speak about what the schema accepted, not about what the fixture was typed as.
const operationsOf = (contract: unknown) =>
	EvalContract.parse(contract).permittedInterfaces.flatMap(
		(declared) => declared.operations,
	)

const firstOperation = (contract: unknown) => {
	const operation = operationsOf(contract)[0]
	if (!operation) throw new Error('fixture declares no operation')
	return operation
}

const operationNamed = (contract: unknown, operationId: string) => {
	const operation = operationsOf(contract).find(
		(candidate) => candidate.operationId === operationId,
	)
	if (!operation) throw new Error(`fixture declares no ${operationId}`)
	return operation
}

describe('the three whole-contract declaration states', () => {
	it.each(RELEVANCE_CONTRACTS)('$name parses', ({ contract }) => {
		const result = EvalContract.safeParse(contract)
		expect(result.error?.issues ?? []).toEqual([])
		expect(result.success).toBe(true)
	})
})

describe('rule 1 — success indicator plus a channel role on another pointer', () => {
	it('admits an absent indicator and an absent role map', () => {
		const descriptor = firstOperation(absentContract).responseDescriptor
		expect(descriptor.successIndicator).toBeNull()
		expect(descriptor.channelRoles).toBeNull()
	})

	it('admits an explicitly empty role map, which is an answer rather than a gap', () => {
		const descriptor = firstOperation(
			explicitlyEmptyContract,
		).responseDescriptor
		expect(descriptor.channelRoles).toEqual({})
	})

	it('admits a declared indicator beside a populated role map', () => {
		const descriptor = operationNamed(
			populatedContract,
			'list-things',
		).responseDescriptor
		expect(descriptor.successIndicator).toBe('/items')
		expect(Object.keys(descriptor.channelRoles ?? {}).length).toBeGreaterThan(1)
	})
})

describe('rule 2 — a descriptor declaring more than one pointer', () => {
	it('admits a one-pointer descriptor, so the rule has an irrelevant case', () => {
		const result = ResponseDescriptor.safeParse({
			requiredKeys: ['only'],
			permittedKeys: ['only'],
			types: { only: 'string' },
			successIndicator: null,
			channelRoles: null,
			collectionLocations: null,
		})
		expect(result.success).toBe(true)
	})

	it('carries no minimum of two on any of the three key collections', () => {
		const result = ResponseDescriptor.safeParse({
			requiredKeys: [],
			permittedKeys: [],
			types: {},
			successIndicator: null,
			channelRoles: null,
			collectionLocations: null,
		})
		expect(result.success).toBe(true)
	})
})

describe('rule 3 — an operation declaring at least one typed key', () => {
	it('admits an operation with zero typed keys across all four channels', () => {
		const shape = firstOperation(absentContract).requestShape
		const typedKeys = [
			shape.path,
			shape.query,
			shape.header,
			shape.body,
		].flatMap((channel) => Object.keys(channel.types))
		// Also AD-10's "declares no inputs in any channel is exempt" case.
		expect(typedKeys).toEqual([])
	})

	it('admits an operation with a typed key', () => {
		const shape = operationNamed(populatedContract, 'create-thing').requestShape
		expect(Object.keys(shape.body.types)).toEqual(['name'])
	})
})

describe('rule 4 — a declared collection location', () => {
	it('distinguishes absent, explicitly empty, and populated', () => {
		expect(
			firstOperation(absentContract).responseDescriptor.collectionLocations,
		).toBeNull()
		expect(
			firstOperation(explicitlyEmptyContract).responseDescriptor
				.collectionLocations,
		).toEqual([])
		expect(
			operationNamed(populatedContract, 'list-things').responseDescriptor
				.collectionLocations,
		).toHaveLength(1)
	})
})

describe('rule 5 — a non-empty sibling group over operations or parameters', () => {
	it('distinguishes absent, explicitly empty, and populated', () => {
		expect(absentContract.siblingGroups).toBeNull()
		expect(explicitlyEmptyContract.siblingGroups).toEqual({
			operations: [],
			parameters: [],
		})
		expect(populatedContract.siblingGroups?.operations).toHaveLength(1)
	})

	it('rejects a group of one, which has no sibling to cross-check against', () => {
		const result = SiblingGroups.safeParse({
			operations: [['only-one']],
			parameters: [],
		})
		expect(result.success).toBe(false)
		expect(result.error?.issues[0]?.code).toBe('too_small')
		expect(result.error?.issues[0]?.path).toEqual(['operations', 0])
	})
})

describe('rule 6 — a collection location naming a reference set', () => {
	it('admits a location with no reference set', () => {
		const result = ResponseDescriptor.safeParse({
			requiredKeys: ['items'],
			permittedKeys: ['items'],
			types: { items: 'array' },
			successIndicator: null,
			channelRoles: null,
			collectionLocations: [
				{
					pointer: '/items',
					expectedCardinality: { mode: 'at-most', max: 5 },
					referenceSet: null,
				},
			],
		})
		expect(result.success).toBe(true)
	})

	it('distinguishes absent, explicitly empty, and populated reference sets', () => {
		expect(absentContract.referenceSets).toBeNull()
		expect(explicitlyEmptyContract.referenceSets).toEqual({})
		expect(Object.keys(populatedContract.referenceSets)).toEqual([
			'expected-things',
		])
	})
})

describe('rule 7 — an operation declaring a state change', () => {
	it('admits both values of the marker', () => {
		expect(firstOperation(absentContract).stateChangeMarker).toBe(false)
		expect(
			operationNamed(populatedContract, 'create-thing').stateChangeMarker,
		).toBe(true)
	})
})
