import { describe, expect, it } from 'vitest'
import { compile } from '../../src/application/compile.ts'
import { checkInputsAgainstShape } from '../../src/core/compile/sensitivity-witness.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { Probe } from '../../src/core/schemas/probe.ts'
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
	it('rejects duplicate Content-Type before a raw request reaches the port', () => {
		const request = {
			probeId: 'p-001',
			interfaceId: 'notes-api',
			operationId: 'write-note',
			kind: 'api',
			method: 'POST',
			pathTemplate: '/notes',
			channels: {
				path: {},
				query: {},
				header: { 'CONTENT-TYPE': 'text/plain' },
				body: raw('e2JhZCI6'),
			},
		}
		expect(probeParsers.request.safeParse(request).success).toBe(false)
		const witnessContract = structuredClone(populatedContract) as any
		witnessContract.permittedInterfaces[0].operations[0].sensitivityWitness.legs[0].inputs.body =
			raw('e2JhZCI6')
		witnessContract.permittedInterfaces[0].operations[0].sensitivityWitness.legs[0].inputs.header =
			{ 'content-TYPE': 'text/plain' }
		expect(publishedValidatorOf('eval-contract')(witnessContract)).toBe(true)
		expect(EvalContract.safeParse(witnessContract).success).toBe(true)
		expect(() => compile(witnessContract)).toThrow(
			/raw body declares its own content type/,
		)
		const planContract = structuredClone(populatedContract) as any
		planContract.interactionPlan[0].inputBinding.body = raw('e2JhZCI6')
		planContract.interactionPlan[0].inputBinding.header = {
			'Content-Type': { literal: 'text/plain' },
		}
		expect(EvalContract.safeParse(planContract).success).toBe(true)
		expect(publishedValidatorOf('eval-contract')(planContract)).toBe(true)
		expect(() => compile(planContract)).toThrow(
			/raw body declares its own content type/,
		)
		const probe = structuredClone(seededProbe) as any
		probe.defects[0].manifestationWitness.inputs.body = raw('e2JhZCI6')
		probe.defects[0].manifestationWitness.inputs.header = {
			'CONTENT-TYPE': 'text/plain',
		}
		expect(Probe.safeParse(probe).success).toBe(true)
		expect(publishedValidatorOf('probe')(probe)).toBe(true)
		const operation =
			EvalContract.parse(populatedContract).permittedInterfaces[0]!
				.operations[0]!
		expect(() =>
			checkInputsAgainstShape(
				probe.defects[0].manifestationWitness.inputs,
				operation,
				'the manifestation',
				'Probe.manifestationWitness.inputs',
			),
		).toThrow(/raw body declares its own content type/)
	})
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
			const planContract = structuredClone(populatedContract) as any
			planContract.interactionPlan[0].inputBinding.body = body
			expect(publishedValidatorOf('eval-contract')(planContract)).toBe(false)
			const probe = structuredClone(seededProbe) as any
			probe.defects[0].manifestationWitness.inputs.body = body
			expect(publishedValidatorOf('probe')(probe)).toBe(false)
			const selectorProbe = structuredClone(seededProbe) as any
			selectorProbe.defectSignature.condition.selector.inputBinding.body = body
			expect(publishedValidatorOf('probe')(selectorProbe)).toBe(false)
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
			ProbeRequestBody.safeParse({
				...raw(''),
				contentType: 'application/json; x=\u0000',
			}).success,
		).toBe(false)
		expect(
			ProbeRequestBody.safeParse({
				...raw(''),
				contentType: 'application/json; charset=',
			}).success,
		).toBe(false)
		expect(
			ProbeRequestBody.safeParse({
				...raw(''),
				contentType: 'application/json; charset="utf-8"',
			}).success,
		).toBe(true)
		expect(
			ProbeRequestBody.safeParse({ ...raw(''), value: null }).success,
		).toBe(false)
		expect(ProbeRequestBody.safeParse({ kind: 'absent' }).success).toBe(true)
		expect(
			ProbeRequestBody.safeParse({ kind: 'json', value: null }).success,
		).toBe(true)
	})
})
