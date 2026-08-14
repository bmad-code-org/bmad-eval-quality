import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
	CONSTRAINT_LEDGER,
	type ConstraintLedgerEntry,
	constraintLedgerEntry,
} from '../../src/core/schemas/constraint-ledger.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import {
	RELATION_VOCABULARY,
	TUPLE_ARITY,
} from '../../src/core/schemas/expression.ts'
import { BINDING_CHANNEL_NON_EMPTY } from '../../src/core/schemas/plan.ts'

const exported = z.toJSONSchema(EvalContract, { io: 'input' }) as Record<
	string,
	any
>

/**
 * Resolves a ledger entry the way Story 1.5 must: by its stated `shape`,
 * `branch`, and `field`, never by searching the document. A helper that hunts
 * for the branch would pass even when the entry's address is unresolvable,
 * which is the whole thing this is here to prove.
 */
const resolve = (entry: ConstraintLedgerEntry): any => {
	// No special case and no out-of-band knowledge: the entry says whether it
	// means the document root or a named definition, so this reads it.
	const definition =
		entry.location.kind === 'root'
			? exported
			: exported.$defs?.[entry.location.name]
	if (!definition) return undefined
	const target =
		entry.branch === null
			? definition
			: definition.oneOf?.find(
					(candidate: any) => candidate.properties?.op?.const === entry.branch,
				)
	if (!target || entry.field === null) return target
	return target.properties?.[entry.field]
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

	// Roughly four entry classes: arity, the binding-channel minimum, the AD-36
	// numeric domain, and the lineage biconditional. A ledger much larger than
	// this is a signal the schema over-refined.
	it('holds one arity entry per tuple-carrying form and three besides', () => {
		const arityEntries = CONSTRAINT_LEDGER.filter((entry) =>
			entry.id.startsWith('operator-arity-'),
		)
		expect(arityEntries).toHaveLength(Object.keys(TUPLE_ARITY).length)
		expect(CONSTRAINT_LEDGER).toHaveLength(arityEntries.length + 4)
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
		'lineage-root-biconditional',
		'operator-operand-types',
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
		expect(Object.keys(exported.$defs).sort()).toEqual([
			'Expression',
			'InputBindingChannel',
			'JsonValue',
			'Operand',
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

	// The other direction. Every test above walks TUPLE_ARITY outward, and the
	// count test compares the ledger against TUPLE_ARITY, so both would stay
	// green if TUPLE_ARITY itself drifted from the union — a seventeenth
	// tuple-carrying operator would ship as an unbounded array in the published
	// schema with nothing failing. This walks the export back to the ledger.
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

	it('resolves the two not-expressible entries to a real place as well', () => {
		expect(resolve(constraintLedgerEntry('json-value-numeric-domain')!)).toBe(
			exported.$defs.JsonValue,
		)
		expect(
			resolve(constraintLedgerEntry('lineage-root-biconditional')!),
		).toEqual(exported.properties.parentDigest)
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
		// Once, on the definition — not duplicated at every use site, which is
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
