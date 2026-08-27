// The registry is the data behind AD-24's prior-art rule and behind the
// constraint ledger's generated lineage entries, so it is walked here rather
// than trusted. Every assertion is written so it fails if the property it names
// is removed: a test that would stay green against a weaker schema proves
// nothing, which is the failure round 2 of Story 1.3 found three times.

import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
	INTERCHANGE_ARTIFACT_KEYS,
	INTERCHANGE_ARTIFACTS,
	NO_PRIOR_ART,
} from '../../src/core/schemas/artifact.ts'

/**
 * Transcribed by hand from the Structural Seed's inventory sentence, in its
 * order, as the kebab-case keys the files are named for. Hand-written on
 * purpose: comparing the registry against itself would prove nothing, and the
 * inventory is the closed list this story is accountable to.
 */
const STRUCTURAL_SEED_INVENTORY = [
	'eval-contract',
	'rubric',
	'sealed-evaluator-brief',
	'sealed-run-record',
	'isolation-manifest',
	'evaluator-configuration',
	'probe',
	'artifact-reference',
	'private-artifact-manifest',
	'preflight-verdict',
	'scoring-policy',
	'evidence-artifact',
] as const

/** the six correspondences the Structural Seed records, transcribed. */
const STRUCTURAL_SEED_PRIOR_ART = {
	'eval-contract': 'eval-contract',
	'sealed-run-record': 'h0-run-result',
	probe: 'h0-ground-truth',
	'isolation-manifest': 'isolation-manifest',
	'artifact-reference': 'artifact-ref',
	'private-artifact-manifest': 'private-evidence-manifest',
} as const

const documentOf = (schema: z.ZodType): Record<string, any> =>
	z.toJSONSchema(schema, { io: 'input' }) as Record<string, any>

// Every branch, not the first: a union whose branches disagree about lineage is
// itself a defect this catches.
const branchShapes = (schema: any): any[] =>
	'shape' in schema ? [schema.shape] : schema.options.map((o: any) => o.shape)

const carriesLineageByShape = (schema: any): boolean =>
	branchShapes(schema).every((shape) => shape.parentDigest !== undefined)

describe('the interchange inventory, closed at twelve', () => {
	it('holds exactly the Structural Seed inventory, in its order', () => {
		expect(INTERCHANGE_ARTIFACT_KEYS).toHaveLength(12)
		expect(INTERCHANGE_ARTIFACT_KEYS).toEqual([...STRUCTURAL_SEED_INVENTORY])
	})

	it('records the six prior-art correspondences and no seventh', () => {
		const declared = Object.fromEntries(
			Object.entries(INTERCHANGE_ARTIFACTS)
				.filter(([, entry]) => entry.priorArt !== null)
				.map(([key, entry]) => [key, entry.priorArt]),
		)
		expect(declared).toEqual(STRUCTURAL_SEED_PRIOR_ART)
		expect(Object.keys(declared)).toHaveLength(6)
	})

	// AD-24: "Each published artifact declares in its description either the
	// prior-art schema it succeeds or an explicit absence of prior art." The
	// absence phrase is read off one exported constant rather than six phrases
	// hard-coded here, which would be the second list the registry prevents.
	it.each(Object.entries(INTERCHANGE_ARTIFACTS))(
		'%s declares its prior art, or its absence, in its own root description',
		(key, entry) => {
			const description = documentOf(entry.schema).description
			expect(description, key).toBeTypeOf('string')
			expect(description.length, key).toBeGreaterThan(0)
			// A description that merely restates the title fails the intent of AD-24.
			expect(description, key).not.toBe(key)
			expect(description.length, key).toBeGreaterThan(120)
			expect(description, key).toContain(entry.priorArt ?? NO_PRIOR_ART)
		},
	)

	// The union-rooted artifacts are the reason this is asserted rather than
	// assumed: `.meta({ id, description })` on a discriminated union exports as
	// `{ $schema, oneOf, description }`, so the root description survives without
	// a `properties` object to hang it on.
	it('keeps a root description on the three union-rooted artifacts too', () => {
		const unionRooted = Object.entries(INTERCHANGE_ARTIFACTS).filter(
			([, entry]) => documentOf(entry.schema).oneOf !== undefined,
		)
		expect(unionRooted.map(([key]) => key)).toEqual([
			'probe',
			'artifact-reference',
			'evidence-artifact',
		])
		for (const [key, entry] of unionRooted) {
			const document = documentOf(entry.schema)
			expect(document.properties, key).toBeUndefined()
			expect(document.description.length, key).toBeGreaterThan(0)
		}
	})
})

describe('the lineage flag, verified against the schemas rather than counted', () => {
	// A count assertion catches a flag flipped to `true` on an artifact with no
	// `parentDigest` only because the ledger's address fails downstream, and
	// catches a flag flipped to `false` nowhere at all: no entry is generated,
	// nothing is missing from any list anyone checks, and the constraint silently
	// leaves the ledger.
	it.each(Object.entries(INTERCHANGE_ARTIFACTS))(
		'%s declares carriesLineage exactly as its schema computes it',
		(key, entry) => {
			expect(entry.carriesLineage, key).toBe(
				carriesLineageByShape(entry.schema),
			)
		},
	)

	it('leaves exactly one artifact out, and it is the reference shape', () => {
		const without = Object.entries(INTERCHANGE_ARTIFACTS)
			.filter(([, entry]) => !entry.carriesLineage)
			.map(([key]) => key)
		expect(without).toEqual(['artifact-reference'])
	})

	it('puts all three lineage fields on every branch of every carrier', () => {
		for (const [key, entry] of Object.entries(INTERCHANGE_ARTIFACTS)) {
			if (!entry.carriesLineage) continue
			for (const shape of branchShapes(entry.schema)) {
				for (const field of [
					'schemaVersion',
					'parentDigest',
					'revisionCount',
				]) {
					expect(shape[field], `${key}.${field}`).toBeDefined()
				}
			}
		}
	})

	it("names the exemption in the reference shape's own description", () => {
		const document = documentOf(
			INTERCHANGE_ARTIFACTS['artifact-reference'].schema,
		)
		expect(document.description).toContain('schemaVersion')
		for (const branch of document.oneOf) {
			expect(Object.keys(branch.properties)).not.toContain('schemaVersion')
			expect(Object.keys(branch.properties)).not.toContain('parentDigest')
		}
	})
})

describe('the Consistency Conventions, extended rather than restarted', () => {
	// Every control object is strict, at every depth. Checking document roots
	// only would pass a lax object nested three levels down, which is where one
	// would actually appear: a root is the one object an author cannot forget to
	// close. The value container is the single schema-valued exception and is
	// excluded by its value schema rather than by its path.
	const controlObjects = (document: any): [string, any][] => {
		const found: [string, any][] = []
		const walk = (node: any, path: string): void => {
			if (node === null || typeof node !== 'object') return
			if (Array.isArray(node)) {
				node.forEach((child, index) => {
					walk(child, `${path}/${index}`)
				})
				return
			}
			// A caller-keyed map exports `propertyNames` and no `properties`; a
			// control object is the other shape.
			if (node.properties !== undefined && node.propertyNames === undefined) {
				found.push([path, node])
			}
			for (const [name, child] of Object.entries(node))
				walk(child, `${path}/${name}`)
		}
		walk(document, '')
		return found
	}

	it.each(Object.entries(INTERCHANGE_ARTIFACTS))(
		'%s emits additionalProperties:false on every control object, at every depth',
		(key, entry) => {
			const objects = controlObjects(documentOf(entry.schema))
			// A guard on the walk itself: a walk that finds nothing would pass this
			// test for every artifact and prove nothing about any of them.
			expect(objects.length, key).toBeGreaterThan(0)
			for (const [path, object] of objects) {
				expect(object.additionalProperties, `${key}${path}`).toBe(false)
			}
		},
	)

	// The per-artifact guard above only proves the walk found the root. This
	// proves it descends: the twelve carry far more nested control objects than
	// roots, and a walk that stopped at the root would report twelve.
	it('descends past the roots it starts from', () => {
		const total = Object.values(INTERCHANGE_ARTIFACTS).reduce(
			(count, entry) => count + controlObjects(documentOf(entry.schema)).length,
			0,
		)
		expect(total).toBeGreaterThan(60)
	})

	// A caller-keyed control map exports `propertyNames` plus a schema-valued
	// `additionalProperties`. Story 1.3 named six such DECLARATIONS on the
	// contract: `KeyTypeMap` (the `types` triple of a request channel, a
	// response descriptor, and a `shape` descriptor), `channelRoles`,
	// `referenceSets`, and `InputBindingChannel`. `decodingParameters`,
	// `responseBody`, and `responseHeaders` are JsonValue-typed rather than
	// caller-keyed, and `forbiddenInputAccounting` is a seven-key strict object.
	//
	// AD-10 added the seventh declaration, `WitnessInputs.header`, string-valued
	// because a header value is a string at the boundary, and carried the
	// `shape` operator's descriptor into a second document with the rest of the
	// expression grammar.
	//
	// The census below counts ADDRESSES, not declarations, which is why
	// eval-contract lists ten for seven declarations: `KeyTypeMap` is reached at
	// six of them, once per request channel plus the response descriptor plus
	// the `shape` descriptor. Pinned in both directions, so a genuinely new
	// caller-keyed map still fails here rather than being absorbed by a widened
	// skip list.
	const CALLER_KEYED_CONTROL_MAPS: Readonly<Record<string, readonly string[]>> =
		{
			'eval-contract': [
				'/properties/permittedInterfaces/items/properties/operations/items/properties/requestShape/properties/path/properties/types',
				'/properties/permittedInterfaces/items/properties/operations/items/properties/requestShape/properties/query/properties/types',
				'/properties/permittedInterfaces/items/properties/operations/items/properties/requestShape/properties/header/properties/types',
				'/properties/permittedInterfaces/items/properties/operations/items/properties/requestShape/properties/body/properties/types',
				'/properties/permittedInterfaces/items/properties/operations/items/properties/responseDescriptor/properties/types',
				'/properties/permittedInterfaces/items/properties/operations/items/properties/responseDescriptor/properties/channelRoles/anyOf/0',
				'/properties/referenceSets/anyOf/0',
				'/$defs/Expression/oneOf/9/properties/descriptor/properties/types',
				'/$defs/WitnessInputs/properties/header',
				'/$defs/InputBindingChannel/anyOf/0',
			],
			probe: [
				'/$defs/WitnessInputs/properties/header',
				'/$defs/Expression/oneOf/9/properties/descriptor/properties/types',
			],
		}

	it('carries a caller-keyed control map only at the addresses named here', () => {
		const found: Record<string, string[]> = {}
		for (const [key, entry] of Object.entries(INTERCHANGE_ARTIFACTS)) {
			const offenders: string[] = []
			const document = documentOf(entry.schema)
			const seen = new Set<string>()
			const walk = (node: any, path: string): void => {
				if (node === null || typeof node !== 'object') return
				if (seen.has(path)) return
				seen.add(path)
				// A record inside the value container is not a caller-keyed control
				// map: Story 1.3 settled this for reference-set members on the same
				// reasoning, since the Conventions place "expression literals,
				// declared reference-set members, and every ingested response body"
				// in the container by name.
				const valuedByJsonValue =
					node.additionalProperties?.$ref === '#/$defs/JsonValue'
				if (node.propertyNames !== undefined && !valuedByJsonValue) {
					offenders.push(path)
				}
				for (const [name, child] of Object.entries(node)) {
					if (name === '$defs' || name === 'properties') {
						for (const [childName, grandchild] of Object.entries(
							child as any,
						)) {
							walk(grandchild, `${path}/${name}/${childName}`)
						}
						continue
					}
					walk(child, `${path}/${name}`)
				}
			}
			walk(document, '')
			if (offenders.length > 0) found[key] = offenders
		}
		expect(found).toEqual(CALLER_KEYED_CONTROL_MAPS)
	})

	// `.default()` diverges the input-mode and output-mode exports by dropping
	// the key from `required` in input mode only, so the two documents are
	// compared rather than the source read.
	it.each(Object.entries(INTERCHANGE_ARTIFACTS))(
		'%s exports identically in input and output mode, so no .default() is present',
		(key, entry) => {
			expect(
				JSON.stringify(z.toJSONSchema(entry.schema, { io: 'output' })),
				key,
			).toBe(JSON.stringify(z.toJSONSchema(entry.schema, { io: 'input' })))
		},
	)

	// Nullability is `.nullable()` on a required key, never `.optional()`. An
	// optional key is one the export omits from `required`. This walks the same
	// control objects as the strictness test above rather than only the ones that
	// already carry `additionalProperties: false`, so a lax object cannot escape
	// both checks by failing the first.
	it.each(Object.entries(INTERCHANGE_ARTIFACTS))(
		'%s requires every declared key, so no key is optional',
		(key, entry) => {
			const objects = controlObjects(documentOf(entry.schema))
			expect(objects.length, key).toBeGreaterThan(0)
			for (const [path, object] of objects) {
				expect(
					[...(object.required ?? [])].sort(),
					`${key}${path}: ${JSON.stringify(Object.keys(object.properties ?? {}))}`,
				).toEqual(Object.keys(object.properties ?? {}).sort())
			}
		},
	)
})
