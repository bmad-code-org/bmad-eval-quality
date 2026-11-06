import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { schemaDocument } from '../../src/core/schemas/json-schema.ts'

describe('published schema representation', () => {
	it('keeps a named root inline and shared definitions named without changing metadata', () => {
		const child = z
			.strictObject({ value: z.string() })
			.meta({ id: 'ExportChild' })
		const root = z
			.strictObject({ child })
			.meta({ id: 'ExportRoot', description: 'Root description' })
		const before = root.meta()
		const document = schemaDocument(root)
		expect(document.$ref).toBeUndefined()
		expect(document.description).toBe('Root description')
		expect(document.properties?.child).toEqual({ $ref: '#/$defs/ExportChild' })
		expect(Object.keys(document.$defs ?? {})).toEqual(['ExportChild'])
		expect(root.meta()).toEqual(before)
		expect(schemaDocument(root)).toEqual(document)
	})

	it('retains nullable primitive branches without accepting a different type', () => {
		const document = schemaDocument(z.string().nullable())
		expect(document.type).toBeUndefined()
		expect(document.anyOf).toEqual([{ type: 'string' }, { type: 'null' }])
	})
})
