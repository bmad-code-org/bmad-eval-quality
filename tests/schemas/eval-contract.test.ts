import { describe, expect, it } from 'vitest'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { TUPLE_ARITY } from '../../src/core/schemas/expression.ts'
import { Operation } from '../../src/core/schemas/interface.ts'
import { Defect } from '../../src/core/schemas/probe.ts'
import {
	SensitivityWitness,
	WitnessInputs,
} from '../../src/core/schemas/sensitivity-witness.ts'
import { seededDefect } from './fixtures/artifact-fixtures.ts'
import { gateCContract, RESPELLINGS } from './fixtures/gate-c-contract.ts'
import {
	absentContract,
	populatedContract,
} from './fixtures/relevance-contracts.ts'
import { resolvePointer } from './published/keyword-occurrences.ts'
import {
	publishedDocumentOf,
	publishedValidatorOf,
} from './published/validator.ts'

describe('the Gate C contract as the primary accept fixture', () => {
	it('parses, re-spelled and unaltered in meaning', () => {
		const result = EvalContract.safeParse(gateCContract)
		expect(result.error?.issues ?? []).toEqual([])
		expect(result.success).toBe(true)
	})

	it('records every place the schema and the hand-authored contract disagreed', () => {
		expect(RESPELLINGS.length).toBeGreaterThan(0)
		for (const respelling of RESPELLINGS) {
			expect(respelling.why.length).toBeGreaterThan(0)
			expect(respelling.from).not.toBe(respelling.to)
		}
	})

	it('keeps every oracle whose relation is a connective or a quantifier', () => {
		const parsed = EvalContract.parse(gateCContract)
		const nonOperatorRelations = parsed.oracles.filter((oracle) =>
			['all', 'any', 'not', 'for-all', 'for-any'].includes(
				oracle.direction?.relation ?? '',
			),
		)
		// Typing `relation` to the eleven operators alone would fail these. The
		// story context said six of eight; the contract carries seven of eight:
		// O-001 is the only one whose relation is a bare operator.
		expect(nonOperatorRelations).toHaveLength(7)
		expect(parsed.oracles).toHaveLength(8)
	})

	it('rejects a stray key, because every control object is strict', () => {
		const withStrictMode = { ...gateCContract, strictMode: true }
		const result = EvalContract.safeParse(withStrictMode)
		expect(result.success).toBe(false)
		expect(result.error?.issues[0]?.code).toBe('unrecognized_keys')
	})
})

// AD-10's typed witnesses (Story 6.2). One `it` per numbered fixture; the
// number opens the name.
describe("AD-10's sensitivity witness, manifestation witness, and fixture reset", () => {
	const witnessOf = (contract: EvalContract) => {
		const witness =
			contract.permittedInterfaces[0]?.operations[0]?.sensitivityWitness
		if (witness === null || witness === undefined)
			throw new Error('the populated contract declares no witness to read')
		return witness
	}

	const declaredWitness = witnessOf(EvalContract.parse(populatedContract))

	const cloneWitness = (): any => structuredClone(declaredWitness)

	const legOf = (legId: string) => ({
		legId,
		inputs: {
			path: {},
			query: {},
			header: {},
			body: { kind: 'absent' as const },
		},
	})

	it('1. accepts a witness carrying two legs and a relation', () => {
		const result = SensitivityWitness.safeParse(declaredWitness)
		expect(result.error?.issues ?? []).toEqual([])
		expect(result.success).toBe(true)
	})

	it('2. rejects a witness carrying one leg', () => {
		const witness = cloneWitness()
		witness.legs = [witness.legs[0]]
		expect(SensitivityWitness.safeParse(witness).success).toBe(false)
	})

	it('3. rejects a witness carrying three legs', () => {
		const witness = cloneWitness()
		witness.legs = [...witness.legs, legOf('third-leg')]
		expect(SensitivityWitness.safeParse(witness).success).toBe(false)
	})

	// Fixtures 2 and 3 pass whether or not the arity reached the export, which
	// is the hole `z.tuple` would have left: a tuple exports as `prefixItems`
	// alone. This one reads the published document.
	it('4. rejects one leg and three legs in the published eval-contract document too', () => {
		const validate = publishedValidatorOf('eval-contract')
		const withLegs = (legs: unknown[]): unknown => {
			const contract = structuredClone(populatedContract) as any
			contract.permittedInterfaces[0].operations[0].sensitivityWitness.legs =
				legs
			return contract
		}
		expect(validate(structuredClone(populatedContract))).toBe(true)
		expect(validate(withLegs([structuredClone(declaredWitness.legs[0])]))).toBe(
			false,
		)
		expect(
			validate(
				withLegs([
					...structuredClone(declaredWitness.legs),
					legOf('third-leg'),
				]),
			),
		).toBe(false)
	})

	it('5. rejects channel "header", which AD-10 names no differential for', () => {
		const witness = cloneWitness()
		witness.channel = 'header'
		expect(SensitivityWitness.safeParse(witness).success).toBe(false)
	})

	it('6. rejects witness inputs carrying a channel key AD-19 does not declare', () => {
		const inputs = structuredClone(declaredWitness.legs[0]?.inputs) as any
		inputs.cookie = {}
		expect(WitnessInputs.safeParse(inputs).success).toBe(false)
	})

	it('7. parses witness inputs on both the json and the absent body branch', () => {
		const base = structuredClone(declaredWitness.legs[0]?.inputs) as any
		expect(
			WitnessInputs.safeParse({
				...base,
				body: { kind: 'json', value: { name: 'alpha' } },
			}).success,
		).toBe(true)
		expect(
			WitnessInputs.safeParse({ ...base, body: { kind: 'absent' } }).success,
		).toBe(true)
	})

	it('8. rejects a non-string header value, because a header value is a string on the wire', () => {
		const inputs = structuredClone(declaredWitness.legs[0]?.inputs) as any
		inputs.header = { 'X-Trace': 7 }
		expect(WitnessInputs.safeParse(inputs).success).toBe(false)
	})

	it('9. parses an operation declaring sensitivityWitness: null', () => {
		const operation = structuredClone(
			absentContract.permittedInterfaces[0]?.operations[0],
		) as any
		expect(operation.sensitivityWitness).toBeNull()
		const result = Operation.safeParse(operation)
		expect(result.error?.issues ?? []).toEqual([])
		expect(result.success).toBe(true)
	})

	it('10. rejects an operation omitting sensitivityWitness, which is required and nullable rather than optional', () => {
		const operation = structuredClone(
			absentContract.permittedInterfaces[0]?.operations[0],
		) as any
		delete operation.sensitivityWitness
		const result = Operation.safeParse(operation)
		expect(result.success).toBe(false)
		expect(result.error?.issues[0]?.path).toEqual(['sensitivityWitness'])
	})

	it('11. parses a defect declaring manifestationWitness: null, so the prior art’s six-field defect still round-trips', () => {
		const defect = structuredClone(seededDefect) as any
		defect.manifestationWitness = null
		const result = Defect.safeParse(defect)
		expect(result.error?.issues ?? []).toEqual([])
		expect(result.success).toBe(true)
	})

	it('12. rejects a defect omitting manifestationWitness', () => {
		const defect = structuredClone(seededDefect) as any
		delete defect.manifestationWitness
		const result = Defect.safeParse(defect)
		expect(result.success).toBe(false)
		expect(result.error?.issues[0]?.path).toEqual(['manifestationWitness'])
	})

	it('13. parses a contract declaring fixtureReset: null, which is AD-10’s repeated-read branch', () => {
		const contract = structuredClone(populatedContract) as any
		expect(contract.fixtureReset).toBeNull()
		expect(EvalContract.safeParse(contract).success).toBe(true)
	})

	it('14. rejects a contract omitting fixtureReset', () => {
		const contract = structuredClone(populatedContract) as any
		delete contract.fixtureReset
		const result = EvalContract.safeParse(contract)
		expect(result.success).toBe(false)
		expect(result.error?.issues[0]?.path).toEqual(['fixtureReset'])
	})

	// The repository's convention is a required key that is `.nullable()`; a
	// `.optional()` or a `.default()` anywhere in the new shapes would drop the
	// key from `required` and show up here.
	it('15. requires every declared key of every new shape, at every depth, in both regenerated documents', () => {
		// The three witness declarations are inlined at their use sites, since
		// none carries `.meta({ id })`; `WitnessInputs` is the one that does.
		const WITNESS_FIELDS = [
			'sensitivityWitness',
			'manifestationWitness',
			'fixtureReset',
		] as const
		const controlObjects = (root: unknown): any[] => {
			const found: any[] = []
			const walk = (node: any): void => {
				if (node === null || typeof node !== 'object') return
				if (Array.isArray(node)) {
					for (const child of node) walk(child)
					return
				}
				if (node.properties !== undefined && node.propertyNames === undefined)
					found.push(node)
				for (const child of Object.values(node)) walk(child)
			}
			walk(root)
			return found
		}
		const witnessRootsOf = (
			document: Record<string, unknown>,
		): { roots: unknown[]; fields: string[] } => {
			const roots: unknown[] = [
				resolvePointer(document, '/$defs/WitnessInputs'),
			]
			const fields: string[] = []
			const walk = (node: any): void => {
				if (node === null || typeof node !== 'object') return
				if (Array.isArray(node)) {
					for (const child of node) walk(child)
					return
				}
				const properties = node.properties as
					| Record<string, unknown>
					| undefined
				if (properties !== undefined)
					for (const field of WITNESS_FIELDS)
						if (Object.hasOwn(properties, field)) {
							fields.push(field)
							roots.push(properties[field])
						}
				for (const child of Object.values(node)) walk(child)
			}
			walk(document)
			return { roots, fields: fields.sort() }
		}
		// `Probe` is a union on `expectedClean`, so its `Defect` shape, and with
		// it the manifestation witness, exports once per branch.
		const expected: Record<string, string[]> = {
			'eval-contract': ['fixtureReset', 'sensitivityWitness'],
			probe: ['manifestationWitness', 'manifestationWitness'],
		}
		for (const key of ['eval-contract', 'probe'] as const) {
			const document = publishedDocumentOf(key)
			const { roots, fields } = witnessRootsOf(document)
			expect(fields, key).toEqual(expected[key])
			const nodes = roots.flatMap((root) => {
				expect(root, key).toBeDefined()
				return controlObjects(root)
			})
			// A walk that found nothing would pass the loop below vacuously.
			expect(nodes.length, key).toBeGreaterThan(3)
			for (const node of nodes) {
				expect([...(node.required ?? [])].sort()).toEqual(
					Object.keys(node.properties).sort(),
				)
			}
		}
	})

	// The story predicted three references in the eval-contract export. Two is
	// the truth: the third belongs to `ManifestationWitness`, which rides on
	// `Defect` and therefore lands in the probe document, twice, once per branch
	// of `Probe`'s `expectedClean` union.
	it('16. exports WitnessInputs as one shared definition per document, referenced from every witness shape', () => {
		const referenceCount = (document: unknown): number => {
			let count = 0
			const walk = (node: any): void => {
				if (node === null || typeof node !== 'object') return
				if (Array.isArray(node)) {
					for (const child of node) walk(child)
					return
				}
				if (node.$ref === '#/$defs/WitnessInputs') count++
				for (const child of Object.values(node)) walk(child)
			}
			walk(document)
			return count
		}
		for (const key of ['eval-contract', 'probe'] as const) {
			const document = publishedDocumentOf(key) as any
			expect(Object.keys(document.$defs), key).toContain('WitnessInputs')
		}
		// the sensitivity witness leg and the fixture reset
		expect(referenceCount(publishedDocumentOf('eval-contract'))).toBe(2)
		// the manifestation witness, once per union branch
		expect(referenceCount(publishedDocumentOf('probe'))).toBe(2)
	})

	// AD-10's manifestation witness dragged the whole expression grammar into
	// the probe document, and `publish.ts` filters injection by artifact, so
	// twelve eval-contract-addressed ledger entries repair nothing here.
	it('17. repairs all twelve operand-tuple arities in the probe export, not only in eval-contract', () => {
		const document = publishedDocumentOf('probe') as any
		expect(Object.keys(document.$defs)).toContain('Expression')
		const repaired = (document.$defs.Expression.oneOf as any[]).filter(
			(branch) => branch.properties?.operands?.prefixItems !== undefined,
		)
		// Twelve as a literal, and each `minItems` against `TUPLE_ARITY`'s own
		// number: reading the arity back off `prefixItems.length` would agree
		// with a tuple that lost an operand, and counting against
		// `Object.keys(TUPLE_ARITY).length` would agree with a tuple dropped from
		// the table. Review order item 6 asks "if the count is eleven".
		expect(repaired).toHaveLength(12)
		expect(Object.keys(TUPLE_ARITY)).toHaveLength(12)
		for (const branch of repaired) {
			const op = branch.properties.op.const as keyof typeof TUPLE_ARITY
			const operands = branch.properties.operands
			expect(operands.minItems, op).toBe(TUPLE_ARITY[op])
			expect(operands.prefixItems, op).toHaveLength(TUPLE_ARITY[op])
			expect(operands.items, op).toBe(false)
		}
	})
})
