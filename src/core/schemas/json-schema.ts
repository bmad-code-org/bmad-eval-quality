/** Keep the published root inline while retaining named shared definitions. */
import { z } from 'zod'

export function schemaDocument(
	schema: z.ZodType,
	options: { io?: 'input' | 'output' } = {},
) {
	const metadata = z.registry<z.GlobalMeta>()
	metadata.get = (candidate) => {
		const value = z.globalRegistry.get(candidate)
		if (!Object.is(candidate, schema) || value === undefined) return value
		const { id: _id, ...rest } = value
		return rest
	}
	const document = z.toJSONSchema(schema, { ...options, metadata })

	// Preserve the existing nullable-union representation for schema consumers.
	function expandTypes(value: unknown): void {
		if (value === null || typeof value !== 'object') return
		if (Array.isArray(value)) {
			value.forEach(expandTypes)
			return
		}
		const node = value as Record<string, unknown>
		Object.values(node).forEach(expandTypes)
		if (Array.isArray(node.type) && node.anyOf === undefined) {
			node.anyOf = node.type.map((type) => ({ type }))
			delete node.type
		}
	}
	expandTypes(document)
	return document
}
