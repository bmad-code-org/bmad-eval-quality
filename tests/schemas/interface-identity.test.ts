/**
 * Interface identity in the published shapes: an `operationId` is unique only within its interface, so the
 * published shapes carry the interface beside it. A record observation, a plan
 * step and a sibling-group member each name the pair.
 */
import { describe, expect, it } from 'vitest'
import {
	EvalContract,
	SiblingGroups,
} from '../../src/core/schemas/eval-contract.ts'
import { SealedRunRecord } from '../../src/core/schemas/sealed-run-record.ts'
import { sharedOperationContract } from '../fixtures/shared-operation-id.ts'
import { sealedRunRecordFixture } from './fixtures/artifact-fixtures.ts'

describe('an observation names the interface that declares its operation', () => {
	it('keeps the interfaceId it parses', () => {
		const result = SealedRunRecord.safeParse(
			JSON.parse(JSON.stringify(sealedRunRecordFixture)),
		)
		expect(result.success).toBe(true)
		expect(result.data?.observations.map((each) => each.interfaceId)).toEqual(
			sealedRunRecordFixture.observations.map((each) => each.interfaceId),
		)
	})

	it('rejects an interfaceId outside the identifier charset', () => {
		const record = structuredClone(sealedRunRecordFixture) as Record<
			string,
			unknown
		>
		const [first] = record.observations as Record<string, unknown>[]
		if (first === undefined) throw new Error('the fixture holds no observation')
		first.interfaceId = 'not an identifier'
		const result = SealedRunRecord.safeParse(record)
		expect(result.success).toBe(false)
		expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain(
			'observations.0.interfaceId',
		)
	})

	it('rejects an observation with no interfaceId, naming the field', () => {
		const record = structuredClone(sealedRunRecordFixture) as Record<
			string,
			unknown
		>
		const [first] = record.observations as Record<string, unknown>[]
		if (first === undefined) throw new Error('the fixture holds no observation')
		delete first.interfaceId
		const result = SealedRunRecord.safeParse(record)
		expect(result.success).toBe(false)
		expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain(
			'observations.0.interfaceId',
		)
	})
})

describe('a plan step names the interface that declares its operation', () => {
	it('keeps the interfaceId of each step it parses', () => {
		const result = EvalContract.safeParse(
			JSON.parse(JSON.stringify(sharedOperationContract)),
		)
		expect(result.success).toBe(true)
		expect(
			result.data?.interactionPlan.map((step) => step.interfaceId),
		).toEqual(['notes-v1', 'notes-v2'])
	})

	it('rejects a step interfaceId outside the identifier charset', () => {
		const contract = structuredClone(sharedOperationContract) as Record<
			string,
			unknown
		>
		const [first] = contract.interactionPlan as Record<string, unknown>[]
		if (first === undefined) throw new Error('the fixture holds no step')
		first.interfaceId = 'not an identifier'
		const result = EvalContract.safeParse(contract)
		expect(result.success).toBe(false)
		expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain(
			'interactionPlan.0.interfaceId',
		)
	})

	it('rejects a step with no interfaceId, naming the field', () => {
		const contract = structuredClone(sharedOperationContract) as Record<
			string,
			unknown
		>
		const [first] = contract.interactionPlan as Record<string, unknown>[]
		if (first === undefined) throw new Error('the fixture holds no step')
		delete first.interfaceId
		const result = EvalContract.safeParse(contract)
		expect(result.success).toBe(false)
		expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain(
			'interactionPlan.0.interfaceId',
		)
	})
})

describe('a sibling-group member names an interface and an operation', () => {
	it('rejects a bare identifier', () => {
		const result = SiblingGroups.safeParse({
			operations: [['read-note', 'list-notes']],
			parameters: [],
		})
		expect(result.success).toBe(false)
	})

	it('rejects a member with no interfaceId', () => {
		const result = SiblingGroups.safeParse({
			operations: [
				[{ operationId: 'read-note' }, { operationId: 'list-notes' }],
			],
			parameters: [],
		})
		expect(result.success).toBe(false)
	})

	it('accepts a group of pairs, including one operation id on two interfaces', () => {
		const result = SiblingGroups.safeParse({
			operations: [
				[
					{ interfaceId: 'notes-v1', operationId: 'read-note' },
					{ interfaceId: 'notes-v2', operationId: 'read-note' },
				],
			],
			parameters: [],
		})
		expect(result.success).toBe(true)
	})
})
