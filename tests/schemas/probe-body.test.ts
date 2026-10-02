import { describe, expect, it } from 'vitest'
import { ProbeRequestBody } from '../../src/core/schemas/probe-body.ts'
import { probeParsers } from '../../src/testing/index.ts'
import { seededProbe } from './fixtures/artifact-fixtures.ts'
import { populatedContract } from './fixtures/relevance-contracts.ts'
import { publishedValidatorOf } from './published/validator.ts'

const raw = (base64: string) => ({
	kind: 'raw',
	base64,
	contentType: 'application/json',
})

describe('canonical raw HTTP request bodies', () => {
	it.each(['', 'e30=', 'e2JhZCI6', '/w==', 'AAE='])(
		'accepts canonical base64 %j in Zod and published schemas',
		(base64) => {
			const body = raw(base64)
			expect(ProbeRequestBody.safeParse(body).success).toBe(true)
			expect(
				probeParsers.request.safeParse({
					probeId: 'p-001',
					interfaceId: 'notes-api',
					operationId: 'write-note',
					kind: 'api',
					method: 'POST',
					pathTemplate: '/notes',
					channels: { path: {}, query: {}, header: {}, body },
				}).success,
			).toBe(true)
			const contract = structuredClone(populatedContract) as any
			contract.permittedInterfaces[0].operations[0].sensitivityWitness.legs[0].inputs.body =
				body
			expect(publishedValidatorOf('eval-contract')(contract)).toBe(true)
			contract.interactionPlan[0].inputBinding.body = body
			expect(publishedValidatorOf('eval-contract')(contract)).toBe(true)
			const probe = structuredClone(seededProbe) as any
			probe.defects[0].manifestationWitness.inputs.body = body
			expect(publishedValidatorOf('probe')(probe)).toBe(true)
			probe.defectSignature.condition.selector.inputBinding.body = body
			expect(publishedValidatorOf('probe')(probe)).toBe(true)
		},
	)

	it.each([
		'e30',
		'e30==',
		'e3B=',
		'/x==',
		'AAF=',
		'Zg==\n',
		'Zh==',
		'Zg-_',
		' Zg==',
	])(
		'rejects malformed or noncanonical base64 %j in every parser',
		(base64) => {
			const body = raw(base64)
			expect(ProbeRequestBody.safeParse(body).success).toBe(false)
			const contract = structuredClone(populatedContract) as any
			contract.permittedInterfaces[0].operations[0].sensitivityWitness.legs[0].inputs.body =
				body
			expect(publishedValidatorOf('eval-contract')(contract)).toBe(false)
			contract.interactionPlan[0].inputBinding.body = body
			expect(publishedValidatorOf('eval-contract')(contract)).toBe(false)
			const probe = structuredClone(seededProbe) as any
			probe.defects[0].manifestationWitness.inputs.body = body
			expect(publishedValidatorOf('probe')(probe)).toBe(false)
			probe.defectSignature.condition.selector.inputBinding.body = body
			expect(publishedValidatorOf('probe')(probe)).toBe(false)
		},
	)

	it('requires a declared content type and rejects extra keys', () => {
		expect(
			ProbeRequestBody.safeParse({ kind: 'raw', base64: '' }).success,
		).toBe(false)
		expect(
			ProbeRequestBody.safeParse({ ...raw(''), contentType: '' }).success,
		).toBe(false)
		expect(
			ProbeRequestBody.safeParse({ ...raw(''), contentType: 'bad type' })
				.success,
		).toBe(false)
		expect(
			ProbeRequestBody.safeParse({
				...raw(''),
				contentType: 'application/json\r\nX: y',
			}).success,
		).toBe(false)
		expect(
			ProbeRequestBody.safeParse({ ...raw(''), value: null }).success,
		).toBe(false)
		expect(ProbeRequestBody.safeParse({ kind: 'absent' }).success).toBe(true)
		expect(
			ProbeRequestBody.safeParse({ kind: 'json', value: null }).success,
		).toBe(true)
	})
})
