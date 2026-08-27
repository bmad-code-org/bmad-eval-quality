// The pure builder of the published JSON Schema export (Story 1.5, AC 1 and
// AC 2): twelve self-contained documents, `$id` synthesised, every `inject`
// ledger entry applied at its stated address, and a loud failure on any
// address that does not resolve. Every assertion is written to fail if the
// property it names is removed.

import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
	INTERCHANGE_ARTIFACT_KEYS,
	INTERCHANGE_ARTIFACTS,
} from '../../src/core/schemas/artifact.ts'
import {
	CONSTRAINT_LEDGER,
	type ConstraintLedgerEntry,
} from '../../src/core/schemas/constraint-ledger.ts'
import {
	injectConstraint,
	publishedDocument,
	publishedDocuments,
	publishedSchemaId,
	serializePublishedDocument,
} from '../../src/core/schemas/publish.ts'
import {
	pointerMatchesSchemaPath,
	rootReadingCouldProduce,
} from './published/keyword-occurrences.ts'

const documents = publishedDocuments()

const INJECT_ENTRIES = CONSTRAINT_LEDGER.filter(
	(entry) => entry.disposition.kind === 'inject',
)

/** the resolution order of record, from `constraint-ledger.test.ts`. */
const resolve = (
	document: Record<string, any>,
	entry: ConstraintLedgerEntry,
): any => {
	const definition =
		entry.location.kind === 'root'
			? document
			: document.$defs?.[entry.location.name]
	if (!definition) return undefined
	const target =
		entry.branch === null
			? definition
			: definition.oneOf?.find(
					(candidate: any) => candidate.properties?.op?.const === entry.branch,
				)
	if (!target || entry.field === null) return target
	if (target.properties) return target.properties[entry.field]
	const branches: any[] | undefined = target.oneOf
	if (!Array.isArray(branches) || branches.length === 0) return undefined
	const copies = branches.map(
		(branch) => branch.properties?.[entry.field as string],
	)
	return copies.every((copy) => copy !== undefined) ? copies[0] : undefined
}

describe('the twelve published documents (AC 1)', () => {
	it('builds one document per registry key and no thirteenth', () => {
		expect(Object.keys(documents)).toEqual([...INTERCHANGE_ARTIFACT_KEYS])
		expect(INTERCHANGE_ARTIFACT_KEYS).toHaveLength(12)
	})

	it.each(INTERCHANGE_ARTIFACT_KEYS)(
		'%s carries $schema first, the synthesised urn $id second, then the export unchanged',
		(key) => {
			const document = documents[key]
			const keys = Object.keys(document)
			expect(keys[0]).toBe('$schema')
			expect(keys[1]).toBe('$id')
			expect(document.$schema).toBe(
				'https://json-schema.org/draft/2020-12/schema',
			)
			expect(document.$id).toBe(`urn:eval-quality:schema:${key}`)
			expect(publishedSchemaId(key)).toBe(document.$id)
		},
	)

	// The acceptance criteria of record: every `$defs` key is a name a schema
	// chose through `.meta({ id })`, never a generated positional name. A future
	// shared shape shipping as `__schema0` would pin a positional name into the
	// drift check, which is exactly what this lock fails on.
	it('names every $defs key: none numbered, none underscore-prefixed', () => {
		const walked: Record<string, number> = {}
		for (const key of INTERCHANGE_ARTIFACT_KEYS) {
			const names = Object.keys(
				(documents[key].$defs as Record<string, unknown>) ?? {},
			)
			walked[key] = names.length
			for (const name of names) {
				expect(name, `${key} $defs "${name}"`).not.toMatch(/^_/)
				expect(name, `${key} $defs "${name}"`).not.toMatch(/\d/)
			}
		}
		// Pinned per document rather than floored in total: a floor of ten against
		// a real fifteen would let eval-contract's or sealed-run-record's five
		// definitions stop being emitted while the walk still passed, and a walk
		// that silently stops walking is the failure this lock exists to catch.
		expect(walked).toEqual({
			'artifact-reference': 0,
			'eval-contract': 6,
			'evaluator-configuration': 1,
			'evidence-artifact': 3,
			'isolation-manifest': 0,
			'preflight-verdict': 0,
			'private-artifact-manifest': 0,
			probe: 5,
			rubric: 0,
			'scoring-policy': 0,
			'sealed-evaluator-brief': 0,
			'sealed-run-record': 5,
		})
	})

	// Self-containment (AD-13): only local `#/$defs/...` references, no
	// cross-file `$ref`, shared shapes duplicated into each file's own `$defs`.
	it.each(INTERCHANGE_ARTIFACT_KEYS)(
		'%s is self-contained: every $ref is local and resolves in its own $defs',
		(key) => {
			const document = documents[key] as Record<string, any>
			const references: string[] = []
			const walk = (node: unknown): void => {
				if (node === null || typeof node !== 'object') return
				if (Array.isArray(node)) {
					for (const child of node) walk(child)
					return
				}
				for (const [name, child] of Object.entries(node)) {
					if (name === '$ref' && typeof child === 'string')
						references.push(child)
					walk(child)
				}
			}
			walk(document)
			for (const reference of references) {
				expect(reference, key).toMatch(/^#\/\$defs\/[^/]+$/)
				expect(
					document.$defs?.[reference.replace('#/$defs/', '')],
					`${key} ${reference}`,
				).toBeDefined()
			}
		},
	)

	it('emits documents that are pure functions of the schemas: two builds are identical', () => {
		for (const key of INTERCHANGE_ARTIFACT_KEYS) {
			expect(JSON.stringify(publishedDocument(key))).toBe(
				JSON.stringify(documents[key]),
			)
		}
	})

	// The whole delta between the raw output-mode export and the published
	// document is `$id` plus the twenty-five injections and nothing else, which is
	// also the proof that every not-expressible entry injects nothing.
	it.each(INTERCHANGE_ARTIFACT_KEYS)(
		'%s differs from the raw export by $id and its inject entries alone',
		(key) => {
			const raw = z.toJSONSchema(INTERCHANGE_ARTIFACTS[key].schema, {
				io: 'output',
			}) as Record<string, unknown>
			const { $schema, ...rest } = structuredClone(raw)
			const reconstructed: Record<string, unknown> = {
				$schema,
				$id: publishedSchemaId(key),
				...rest,
			}
			for (const entry of INJECT_ENTRIES)
				if (entry.location.artifact === key)
					injectConstraint(reconstructed, entry)
			expect(reconstructed).toEqual(documents[key])
		},
	)
})

// The serialiser proven on its own, not only through the drift check: both
// sides of that byte comparison flow through this one function, so weakening
// the escape range or dropping the trailing newline and regenerating would go
// green there with raw em dashes committed. Pure and filesystem-free (AD-30).
describe('the exact serialisation (AC 3), asserted independently of the drift check', () => {
	it.each(INTERCHANGE_ARTIFACT_KEYS)(
		'%s serialises to pure ASCII with exactly one trailing newline, losslessly',
		(key) => {
			const document = documents[key]
			const serialized = serializePublishedDocument(document)
			// pure ASCII: no code unit above U+007F survives the escaping
			expect(serialized).not.toMatch(/[\u0080-\uffff]/)
			expect(serialized.endsWith('\n')).toBe(true)
			expect(serialized.endsWith('\n\n')).toBe(false)
			expect(JSON.parse(serialized)).toStrictEqual(document)
		},
	)

	// The escape branch provably fires: eval-contract's descriptions quote ADs
	// verbatim, em dashes included, so its serialisation must carry the \u2014
	// escape sequence. An escaper reduced to the identity fails here.
	it('escapes the em dash in eval-contract as \\u2014', () => {
		const serialized = serializePublishedDocument(documents['eval-contract'])
		expect(serialized).toContain('\\u2014')
		expect(serialized).not.toContain('\u2014')
	})
})

describe('the ledger drives the injection, by stated address (AC 2)', () => {
	// This 25/15 split is also pinned in differential.test.ts ("walks all
	// twenty-five inject entries") and arithmetically in
	// constraint-ledger.test.ts; a ledger change updates all three together.
	it('has twenty-five inject entries to act on, and fifteen not-expressible left alone', () => {
		expect(INJECT_ENTRIES).toHaveLength(25)
		expect(CONSTRAINT_LEDGER.length - INJECT_ENTRIES.length).toBe(15)
	})

	it.each(INJECT_ENTRIES)(
		'$id lands every keyword at its stated address',
		(entry) => {
			if (entry.disposition.kind !== 'inject')
				throw new Error('not an injection')
			const site = resolve(
				documents[entry.location.artifact] as Record<string, any>,
				entry,
			)
			expect(site, entry.id).toBeDefined()
			for (const [keyword, value] of Object.entries(
				entry.disposition.keywords,
			)) {
				expect(site[keyword], `${entry.id} ${keyword}`).toEqual(value)
			}
		},
	)

	it.each(INJECT_ENTRIES)(
		'$id is absent from the raw export, so the keyword provably comes from the injection',
		(entry) => {
			if (entry.disposition.kind !== 'inject')
				throw new Error('not an injection')
			const raw = z.toJSONSchema(
				INTERCHANGE_ARTIFACTS[entry.location.artifact].schema,
				{ io: 'output' },
			) as Record<string, any>
			const site = resolve(raw, entry)
			expect(site, entry.id).toBeDefined()
			for (const keyword of Object.keys(entry.disposition.keywords))
				expect(site[keyword], `${entry.id} ${keyword}`).toBeUndefined()
		},
	)

	const brokenAddresses: [string, ConstraintLedgerEntry][] = [
		[
			'a definition nothing declares',
			{
				id: 'broken-definition',
				location: {
					kind: 'definition',
					artifact: 'eval-contract',
					name: 'NoSuchDefinition',
				},
				branch: null,
				field: null,
				statement: 'broken on purpose',
				disposition: {
					kind: 'inject',
					dialect: 'draft-2020-12',
					keywords: { minItems: 1 },
				},
			},
		],
		[
			'a branch no op const matches',
			{
				id: 'broken-branch',
				location: {
					kind: 'definition',
					artifact: 'eval-contract',
					name: 'Expression',
				},
				branch: 'no-such-operator',
				field: 'operands',
				statement: 'broken on purpose',
				disposition: {
					kind: 'inject',
					dialect: 'draft-2020-12',
					keywords: { minItems: 1 },
				},
			},
		],
		[
			'a field the located shape does not carry',
			{
				id: 'broken-field',
				location: {
					kind: 'definition',
					artifact: 'eval-contract',
					name: 'Expression',
				},
				branch: 'equality',
				field: 'noSuchField',
				statement: 'broken on purpose',
				disposition: {
					kind: 'inject',
					dialect: 'draft-2020-12',
					keywords: { minItems: 1 },
				},
			},
		],
		[
			'a dialect that is not the export target',
			{
				id: 'broken-dialect',
				location: {
					kind: 'definition',
					artifact: 'eval-contract',
					name: 'Expression',
				},
				branch: 'equality',
				field: 'operands',
				statement: 'broken on purpose',
				disposition: {
					kind: 'inject',
					// under draft-7 `items: false` overwrites the tuple, so acting on a
					// foreign dialect must throw rather than inject
					dialect: 'draft-7' as never,
					keywords: { items: false },
				},
			},
		],
		[
			'a keyword the site already carries',
			{
				id: 'broken-overwrite',
				location: {
					kind: 'definition',
					artifact: 'eval-contract',
					name: 'Expression',
				},
				branch: 'equality',
				field: 'operands',
				statement: 'broken on purpose',
				disposition: {
					kind: 'inject',
					dialect: 'draft-2020-12',
					keywords: { prefixItems: [] },
				},
			},
		],
	]

	// A silently skipped injection is the exact failure AD-13's arity paragraph
	// exists to prevent, and a warning printed into a green build is not a gate.
	it.each(brokenAddresses)(
		'fails loudly on %s, naming the entry',
		(_label, entry) => {
			const document = publishedDocument('eval-contract')
			expect(() => injectConstraint(document, entry)).toThrowError(
				new RegExp(entry.id),
			)
		},
	)

	it('refuses to act on a not-expressible disposition', () => {
		const entry = CONSTRAINT_LEDGER.find(
			(candidate) => candidate.disposition.kind === 'not-expressible',
		)
		expect(entry).toBeDefined()
		const document = publishedDocument('eval-contract')
		expect(() =>
			injectConstraint(document, entry as ConstraintLedgerEntry),
		).toThrowError(/not "inject"/)
	})

	// The union-root fallback is unreachable by every current ledger entry (no
	// inject entry addresses a field on a union-rooted definition), so its
	// every-copy semantics are driven here with a fabricated document; otherwise
	// the path ships untested until the first entry that needs it.
	describe('the union-root fallback, driven with a fabricated document', () => {
		const fallbackEntry: ConstraintLedgerEntry = {
			id: 'fabricated-union-fallback',
			location: {
				kind: 'definition',
				artifact: 'eval-contract',
				name: 'UnionRooted',
			},
			branch: null,
			field: 'lineage',
			statement: 'fabricated to drive the fallback',
			disposition: {
				kind: 'inject',
				dialect: 'draft-2020-12',
				keywords: { minLength: 1 },
			},
		}

		it('injects into every branch copy when the copies are distinct', () => {
			const document: Record<string, any> = {
				$defs: {
					UnionRooted: {
						oneOf: [
							{ properties: { lineage: { type: 'string' } } },
							{ properties: { lineage: { type: 'string' } } },
						],
					},
				},
			}
			injectConstraint(document, fallbackEntry)
			for (const branch of document.$defs.UnionRooted.oneOf)
				expect(branch.properties.lineage).toEqual({
					type: 'string',
					minLength: 1,
				})
		})

		it('injects once through aliased branch copies without tripping its own overwrite guard', () => {
			const shared = { type: 'string' }
			const document: Record<string, any> = {
				$defs: {
					UnionRooted: {
						oneOf: [
							{ properties: { lineage: shared } },
							{ properties: { lineage: shared } },
						],
					},
				},
			}
			injectConstraint(document, fallbackEntry)
			expect(shared).toEqual({ type: 'string', minLength: 1 })
		})

		it('still fails loudly when one branch lacks the field', () => {
			const document: Record<string, any> = {
				$defs: {
					UnionRooted: {
						oneOf: [
							{ properties: { lineage: { type: 'string' } } },
							{ properties: { other: { type: 'string' } } },
						],
					},
				},
			}
			expect(() => injectConstraint(document, fallbackEntry)).toThrowError(
				/fabricated-union-fallback/,
			)
		})

		// An address that names two branches names neither: injecting into the
		// first and skipping the second is the silent skip this module throws to
		// prevent everywhere else, so a duplicated discriminator is a throw.
		it('refuses a branch address that matches more than one branch', () => {
			const duplicated: ConstraintLedgerEntry = {
				...fallbackEntry,
				id: 'fabricated-duplicate-branch',
				branch: 'equality',
				field: 'operands',
			}
			const branch = () => ({
				properties: {
					op: { const: 'equality' },
					operands: { prefixItems: [{ type: 'string' }] },
				},
			})
			const document: Record<string, any> = {
				$defs: { UnionRooted: { oneOf: [branch(), branch()] } },
			}
			expect(() => injectConstraint(document, duplicated)).toThrowError(
				/fabricated-duplicate-branch.*2 oneOf branches/,
			)
		})
	})
})

/**
 * `pointerMatchesSchemaPath` tells a `$defs` reading of an ajv `schemaPath`
 * apart from a root reading by asking whether the root reading could have
 * produced an error at the reported instance path. AD-10's shapes made that
 * ambiguity ordinary rather than hypothetical: `$defs/WitnessInputs` opens with
 * the same `type`, `required`, and `additionalProperties` the eval-contract
 * root carries, and `$defs/Expression/oneOf/*` shadows the probe root's own
 * union.
 *
 * Exercised directly here rather than only through a twenty-second sweep, so a
 * later edit to the applicator table fails on a named line.
 */
describe('the schema-path reading that disambiguates a $def from the root', () => {
	it.each([
		// [relative schema path, instance path, the root reading is possible]
		['/additionalProperties', '', true],
		['/additionalProperties', '/permittedInterfaces/0/operations/0', false],
		['/required', '', true],
		['/type', '/behaviors', false],
		['/properties/behaviors/type', '/behaviors', true],
		['/properties/behaviors/type', '/oracles', false],
		['/properties/behaviors/items/required', '/behaviors/0', true],
		['/properties/behaviors/items/required', '/behaviors', false],
		// a composition step stays at the same instance node, index or not
		['/oneOf', '', true],
		['/oneOf/0/properties/expectedClean/const', '/expectedClean', true],
		['/oneOf/0/properties/expectedClean/const', '/defects/0/x/op', false],
		['/anyOf/1/type', '', true],
		// propertyNames reports at the object, not at the key
		[
			'/properties/referenceSets/anyOf/0/propertyNames/pattern',
			'/referenceSets',
			true,
		],
		// a schema-valued additionalProperties descends one unnamed token
		['/additionalProperties/type', '/anything', true],
		['/additionalProperties/type', '', false],
		// an unrecognised applicator widens rather than narrows
		['/contains/type', '/whatever/deep/path', true],
	])(
		'reads %s at %s as root-possible: %s',
		(relative, instancePath, expected) => {
			expect(
				rootReadingCouldProduce(relative as string, instancePath as string),
			).toBe(expected)
		},
	)

	// The two readings of one path, told apart only by the instance path. This
	// is the pair that had no reachable mutant before the fix.
	it('accepts the $defs reading of a path the root also names, and only for a deep instance', () => {
		const document = documents['eval-contract'] as Record<string, unknown>
		expect(document.additionalProperties).toBe(false)
		expect(
			pointerMatchesSchemaPath(
				document,
				'/$defs/WitnessInputs/additionalProperties',
				'#/additionalProperties',
				'/permittedInterfaces/0/operations/0/sensitivityWitness/legs/0/inputs',
			),
		).toBe(true)
		expect(
			pointerMatchesSchemaPath(
				document,
				'/$defs/WitnessInputs/additionalProperties',
				'#/additionalProperties',
				'',
			),
		).toBe(false)
		expect(
			pointerMatchesSchemaPath(
				document,
				'/additionalProperties',
				'#/additionalProperties',
				'',
			),
		).toBe(true)
	})
})
