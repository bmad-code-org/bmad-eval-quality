import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { INTERCHANGE_ARTIFACTS } from '../../src/core/schemas/artifact.ts'
import {
	CONSTRAINT_LEDGER,
	type ConstraintLedgerEntry,
	constraintLedgerEntry,
} from '../../src/core/schemas/constraint-ledger.ts'
import {
	RELATION_VOCABULARY,
	TUPLE_ARITY,
} from '../../src/core/schemas/expression.ts'
import { BINDING_CHANNEL_NON_EMPTY } from '../../src/core/schemas/plan.ts'

// One document per interchange artifact, because an address that names an
// artifact and resolves against a different one resolves nothing.
const documents = Object.fromEntries(
	Object.entries(INTERCHANGE_ARTIFACTS).map(([key, entry]) => [
		key,
		z.toJSONSchema(entry.schema, { io: 'input' }) as Record<string, any>,
	]),
)

const exported = documents['eval-contract'] as Record<string, any>

/**
 * Resolves a ledger entry the way Story 1.5 must: by its stated `artifact`,
 * `kind`, `branch`, and `field`, never by searching the document. A helper that
 * hunts for the branch would pass even when the entry's address is
 * unresolvable, which is the whole thing this is here to prove.
 */
const resolve = (entry: ConstraintLedgerEntry): any => {
	// No special case and no out-of-band knowledge: the entry names its artifact
	// and says whether it means that document's root or a named definition.
	const document = documents[entry.location.artifact]
	if (!document) return undefined
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
	// The union fallback: the two lineage-bearing union-rooted artifacts export
	// no `properties` object, only `oneOf` (all three union roots are
	// `z.discriminatedUnion`; keying on `anyOf` would resolve nothing for them
	// and fail silently). Presence in EVERY branch is the guard, since the
	// lineage fields are spread into each branch by construction, so the
	// branches carry the same schema object and returning the first copy is
	// safe.
	const branches: any[] | undefined = target.oneOf
	if (!Array.isArray(branches) || branches.length === 0) return undefined
	const copies = branches.map(
		(branch) => branch.properties?.[entry.field as string],
	)
	return copies.every((copy) => copy !== undefined) ? copies[0] : undefined
}

describe('the constraint ledger', () => {
	it('carries a unique identifier per entry', () => {
		const ids = CONSTRAINT_LEDGER.map((entry) => entry.id)
		expect(new Set(ids).size).toBe(ids.length)
	})

	it('gives every entry a disposition, and no entry both kinds', () => {
		for (const entry of CONSTRAINT_LEDGER) {
			if (entry.disposition.kind === 'inject') {
				expect(Object.keys(entry.disposition.keywords).length).toBeGreaterThan(
					0,
				)
			} else {
				expect(entry.disposition.reason.length).toBeGreaterThan(0)
			}
		}
	})

	// Six entry classes: arity, the binding-channel minimum, the AD-36 numeric
	// domain, the operand-type declaration, one lineage biconditional per
	// lineage-bearing artifact plus AD-18's two secrets prohibitions, and the
	// observation-sequence uniqueness gap (owed item 2). A ledger much larger
	// than this is a signal the schema over-refined.
	it('holds one arity entry per tuple-carrying form per expression-bearing document, one lineage entry per carrier, and five besides', () => {
		const arityEntries = CONSTRAINT_LEDGER.filter((entry) =>
			entry.id.startsWith('operator-arity-'),
		)
		// Two documents carry the expression grammar since AD-10's manifestation
		// witness put one on `Defect`, and `publish.ts` filters injection by
		// artifact, so each needs its own twelve.
		const expressionBearing = new Set(
			arityEntries.map((entry) => entry.location.artifact),
		)
		expect([...expressionBearing].sort()).toEqual(['eval-contract', 'probe'])
		expect(arityEntries).toHaveLength(
			Object.keys(TUPLE_ARITY).length * expressionBearing.size,
		)
		const lineageCarriers = Object.values(INTERCHANGE_ARTIFACTS).filter(
			(artifact) => artifact.carriesLineage,
		)
		expect(lineageCarriers).toHaveLength(11)
		expect(CONSTRAINT_LEDGER).toHaveLength(
			arityEntries.length + 4 + lineageCarriers.length + 2,
		)
	})

	// Eleven, not twelve. The twelfth artifact carries no `parentDigest` for the
	// address to resolve against, so filtering the registry is what keeps the
	// ledger honest; a hand-written twelfth entry is a bug.
	it('generates one lineage entry per carrier, and none for the reference shape', () => {
		const lineageIds = CONSTRAINT_LEDGER.filter((entry) =>
			entry.id.startsWith('lineage-'),
		).map((entry) => entry.id)
		expect(lineageIds).toHaveLength(11)
		expect(lineageIds).not.toContain('lineage-artifact-reference')
		for (const [key, artifact] of Object.entries(INTERCHANGE_ARTIFACTS)) {
			expect(lineageIds.includes(`lineage-${key}`), key).toBe(
				artifact.carriesLineage,
			)
		}
	})

	// Every address names its artifact, or Story 1.5 resolves an entry against
	// whichever document it happens to hold.
	it('names an artifact on every address', () => {
		for (const entry of CONSTRAINT_LEDGER) {
			expect(Object.keys(INTERCHANGE_ARTIFACTS), entry.id).toContain(
				entry.location.artifact,
			)
		}
	})

	it.each(Object.entries(TUPLE_ARITY))(
		'injects minItems %s and items:false for the %s tuple',
		(op, arity) => {
			const entry = constraintLedgerEntry(`operator-arity-${op}`)
			expect(entry).toBeDefined()
			expect(entry?.field).toBe('operands')
			expect(entry?.disposition).toEqual({
				kind: 'inject',
				dialect: 'draft-2020-12',
				keywords: { minItems: arity, items: false },
			})
		},
	)

	it('injects minProperties for the non-empty binding channel', () => {
		const entry = constraintLedgerEntry(BINDING_CHANNEL_NON_EMPTY)
		expect(entry?.disposition).toEqual({
			kind: 'inject',
			dialect: 'draft-2020-12',
			keywords: { minProperties: 1 },
		})
	})

	// `items: false` bounds a tuple only beside 2020-12's `prefixItems`. Under
	// draft-7 a tuple exports as `items: [...]`, where the same injection
	// overwrites the tuple and the published schema rejects every operand list.
	it('names the dialect on every injection, because the keywords are not portable', () => {
		for (const entry of CONSTRAINT_LEDGER) {
			if (entry.disposition.kind !== 'inject') continue
			expect(entry.disposition.dialect).toBe('draft-2020-12')
		}
	})

	it.each([
		'json-value-numeric-domain',
		'lineage-eval-contract',
		'lineage-probe',
		'lineage-evidence-artifact',
		'operator-operand-types',
		'secrets-prohibition-private-artifact-manifest',
		'secrets-prohibition-evaluator-configuration',
		'observation-sequence-unique',
	])('marks %s not-expressible with a reason', (id) => {
		const entry = constraintLedgerEntry(id)
		expect(entry?.disposition.kind).toBe('not-expressible')
	})
})

describe('the premises the ledger rests on, verified against the export', () => {
	// Every definition is named. A generated `__schema0` would pin a positional
	// name into Story 1.5's drift check and leave the ledger's arity entries with
	// no stable address, which is the reason JsonValue is hand-rolled rather than
	// built on z.json().
	it('names every shared definition', () => {
		// `RubricBody` joins the set in Story 1.4: AC 13 gives the shared body a
		// `.meta({ id })` so it does not collide with the published `Rubric`
		// artifact under a generated positional name, and it stays reachable from
		// the contract. The AC 2 lineage refactor adds nothing here, which is one
		// reason the spread was chosen over a nested object.
		expect(Object.keys(exported.$defs).sort()).toEqual([
			'Expression',
			'InputBindingChannel',
			'JsonValue',
			'Operand',
			'RubricBody',
			'WitnessInputs',
		])
	})

	it('resolves every ledger entry at the address it states', () => {
		for (const entry of CONSTRAINT_LEDGER) {
			expect(resolve(entry), entry.id).toBeDefined()
		}
	})

	// The point of the ledger is that Story 1.5 can act on it without a second
	// list, so every entry's stated address must resolve in the export.
	it.each(CONSTRAINT_LEDGER.filter((entry) => entry.branch !== null))(
		'$id resolves at the address it states',
		(entry) => {
			const operands = resolve(entry)
			expect(operands).toBeDefined()
			if (entry.disposition.kind !== 'inject')
				throw new Error('not an injection')
			expect(operands.prefixItems).toHaveLength(
				Number(entry.disposition.keywords.minItems),
			)
			// The published schema would otherwise accept the one-operand and
			// three-operand `equality` that Zod rejects, which is why arity is the
			// ledger's largest entry class.
			expect(operands.minItems).toBeUndefined()
			expect(operands.maxItems).toBeUndefined()
			expect(operands.items).toBeUndefined()
		},
	)

	// The other direction: every test above walks TUPLE_ARITY outward, so both
	// would stay green if TUPLE_ARITY itself drifted from the union (a
	// seventeenth tuple-carrying operator would ship unbounded, unnoticed).
	// This walks the export back to the ledger instead.
	it('has a ledger entry for every tuple the export actually contains', () => {
		const branches: any[] = exported.$defs.Expression.oneOf
		expect(branches).toHaveLength(RELATION_VOCABULARY.length)
		const tupleBranches = branches.filter(
			(branch) => branch.properties?.operands?.prefixItems,
		)
		expect(tupleBranches.length).toBeGreaterThan(0)
		for (const branch of tupleBranches) {
			const op = branch.properties.op.const
			const entry = constraintLedgerEntry(`operator-arity-${op}`)
			expect(entry, `no ledger entry for ${op}`).toBeDefined()
			if (entry?.disposition.kind !== 'inject') throw new Error('not injected')
			expect(Number(entry.disposition.keywords.minItems)).toBe(
				branch.properties.operands.prefixItems.length,
			)
		}
	})

	it('resolves the not-expressible entries to a real place as well', () => {
		expect(resolve(constraintLedgerEntry('json-value-numeric-domain')!)).toBe(
			exported.$defs.JsonValue,
		)
		// Retargeted from the retired `lineage-root-biconditional`: with twelve
		// roots the bare `{ kind: 'root' }` address was ambiguous, so the entry is
		// now one of eleven named per artifact.
		expect(resolve(constraintLedgerEntry('lineage-eval-contract')!)).toEqual(
			exported.properties.parentDigest,
		)
		expect(
			resolve(
				constraintLedgerEntry('secrets-prohibition-evaluator-configuration')!,
			),
		).toBe(documents['evaluator-configuration'])
	})

	// The two union-rooted carriers are exactly why `resolve` needs a fallback:
	// a union root exports no `properties` object, so the address would return
	// `undefined` and the "resolves at the address it states" assertion above
	// would go red for reasons that have nothing to do with the constraint.
	it.each(['lineage-probe', 'lineage-evidence-artifact'])(
		'%s resolves through the union fallback, in every branch',
		(id) => {
			const entry = constraintLedgerEntry(id)!
			const document = documents[entry.location.artifact] as Record<string, any>
			expect(document.properties).toBeUndefined()
			expect(document.oneOf.length).toBeGreaterThan(1)
			for (const branch of document.oneOf) {
				expect(branch.properties.parentDigest).toBeDefined()
			}
			expect(resolve(entry)).toEqual(document.oneOf[0].properties.parentDigest)
		},
	)

	// The fallback must require the field in EVERY branch, or it silently
	// certifies an address that resolves in one branch and nowhere else.
	it('refuses a union address whose field is missing from one branch', () => {
		const entry = constraintLedgerEntry('lineage-probe')!
		const document = documents[entry.location.artifact] as Record<string, any>
		const pristine = document.oneOf
		document.oneOf = [
			pristine[0],
			{
				...pristine[1],
				properties: Object.fromEntries(
					Object.entries(pristine[1].properties).filter(
						([name]) => name !== 'parentDigest',
					),
				),
			},
		]
		try {
			expect(resolve(entry)).toBeUndefined()
		} finally {
			document.oneOf = pristine
		}
	})

	it('drops the binding-channel check entirely', () => {
		const channel = exported.$defs.InputBindingChannel
		expect(JSON.stringify(channel)).not.toContain('minProperties')
		// All four channels reference the one definition, so the injection lands
		// once rather than four times.
		const binding =
			exported.properties.interactionPlan.items.properties.inputBinding
		for (const name of ['path', 'query', 'header', 'body']) {
			expect(binding.properties[name].$ref).toBe('#/$defs/InputBindingChannel')
		}
	})

	it('carries the AD-36 numeric-domain statement once, on the shared definition', () => {
		const definition = exported.$defs?.JsonValue
		expect(definition).toBeDefined()
		expect(definition.description).toContain('IEEE 754 double-precision')
		expect(definition.description).toContain('safe-integer range')
		// Once, on the definition, not duplicated at every use site: that is
		// where a z.json()-based container would have put it.
		const occurrences =
			JSON.stringify(exported).split('AD-36 value domain').length
		expect(occurrences).toBe(2)
	})

	it('carries the settled coin flips in field descriptions, which survive export', () => {
		const serialized = JSON.stringify(exported)
		expect(serialized).toContain('Coin flip (a), settled')
		expect(serialized).toContain('Coin flip (b), settled')
		expect(serialized).toContain('Coin flip (c), settled')
	})

	it('names the prior-art schema it succeeds, per AD-24', () => {
		expect(exported.description).toContain('eval-contract')
	})

	it('emits additionalProperties:false on control objects and a schema-valued one on the value container', () => {
		expect(exported.additionalProperties).toBe(false)
		const definition = exported.$defs.JsonValue
		const objectBranch = definition.anyOf.find(
			(branch: any) => branch.type === 'object',
		)
		expect(objectBranch.additionalProperties).toEqual({
			$ref: '#/$defs/JsonValue',
		})
	})
})
