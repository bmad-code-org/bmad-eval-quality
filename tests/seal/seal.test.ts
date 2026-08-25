import { describe, expect, it } from 'vitest'
import { canonicalize } from '../../src/core/canonical/canonicalize.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { DIGEST_FORM } from '../../src/core/schemas/primitives.ts'
import { SealedEvaluatorBrief } from '../../src/core/schemas/sealed-evaluator-brief.ts'
import { seal, validateAssembledBrief } from '../../src/core/seal/seal.ts'
import type { SealStage } from '../../src/core/stage-contracts.ts'
import { gateCContract } from '../schemas/fixtures/gate-c-contract.ts'
import { populatedContract } from '../schemas/fixtures/relevance-contracts.ts'

// Re-derived through the schema's own `.parse()` rather than typed directly
// as `EvalContract`, matching `tests/seal/fixtures.ts`'s established pattern:
// TypeScript's inference over a `permittedInterfaces[].operations` array of
// dissimilar shapes is narrower than `EvalContract`'s own fields and fails a
// spurious structural check. `.parse()` sidesteps that and proves the
// contract is schema-valid.
const sealableGateCContract = EvalContract.parse(gateCContract)
const sealablePopulatedContract = EvalContract.parse(populatedContract)

const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes)

// Only the fields the epic's byte-identical guarantee covers: never
// `contractDigest` or the lineage fields, which correctly track the literal
// input, not the reorder-invariant content (see the story's Design Notes).
function contentFieldsOf(brief: SealedEvaluatorBrief) {
	const {
		behaviors,
		directions,
		permittedInterfaces,
		scopedResources,
		budgets,
		safetyLimits,
		probeStepBound,
	} = brief
	return {
		behaviors,
		directions,
		permittedInterfaces,
		scopedResources,
		budgets,
		safetyLimits,
		probeStepBound,
	}
}

describe('seal: full-contract assembly', () => {
	it('assembles one BriefDirection per oracle, a set contractDigest, and drops operations from every permittedInterfaces element', () => {
		const brief = seal(sealableGateCContract)

		expect(brief.directions).toHaveLength(sealableGateCContract.oracles.length)
		expect(brief.directions.map((d) => d.oracleId).sort()).toEqual(
			sealableGateCContract.oracles.map((o) => o.id).sort(),
		)
		for (const direction of brief.directions) {
			expect(direction.text.length).toBeGreaterThan(0)
		}

		expect(brief.contractDigest).toMatch(DIGEST_FORM)

		expect(brief.permittedInterfaces).toHaveLength(1)
		const [firstInterface] = brief.permittedInterfaces
		if (firstInterface === undefined) throw new Error('expected one interface')
		expect(firstInterface).toEqual({ logicalId: 'exports-api', kind: 'api' })
		expect(firstInterface).not.toHaveProperty('operations')
	})

	it('carries behaviours, scoped resources, budgets, and safety limits through; excludes commentary, the interaction plan, step identifiers, and the forbidden-input floor', () => {
		const brief = seal(sealableGateCContract)

		expect(brief.behaviors).toEqual(sealableGateCContract.behaviors)
		expect(brief.budgets).toEqual(sealableGateCContract.budgets)
		expect(brief.safetyLimits).toEqual(
			[...sealableGateCContract.safetyLimits].sort(),
		)

		expect(brief).not.toHaveProperty('commentary')
		expect(brief).not.toHaveProperty('interactionPlan')
		expect(brief).not.toHaveProperty('oracles')
		expect(brief).not.toHaveProperty('forbiddenInputs')
		expect(brief).not.toHaveProperty('stepId')
	})

	it('mints a fresh lineage root: schemaVersion 1, parentDigest null, revisionCount 0', () => {
		const brief = seal(sealableGateCContract)
		expect(brief.schemaVersion).toBe(1)
		expect(brief.parentDigest).toBeNull()
		expect(brief.revisionCount).toBe(0)
	})

	it('assembles cleanly against populatedContract too', () => {
		const brief = seal(sealablePopulatedContract)
		expect(brief.directions).toHaveLength(
			sealablePopulatedContract.oracles.length,
		)
		expect(brief.contractDigest).toMatch(DIGEST_FORM)
		expect(brief.scopedResources).toEqual(
			sealablePopulatedContract.scopedResources,
		)
		// A direct assertion, not only an incidental byte-identity check: the
		// content-fields comparisons elsewhere pass regardless of whether this
		// value is correct, since they only compare two `seal()` outputs against
		// each other. `populatedContract.probeStepBound` is 8, non-null, so this
		// also proves the non-null case, not just null carry-through.
		expect(brief.probeStepBound).toBe(sealablePopulatedContract.probeStepBound)
		expect(brief.probeStepBound).toBe(8)
	})

	it('carries probeStepBound through for the null case too', () => {
		expect(sealableGateCContract.probeStepBound).toBeNull()
		expect(seal(sealableGateCContract).probeStepBound).toBeNull()
	})
})

describe('seal: repeat call is byte-identical, contractDigest included', () => {
	it('produces identical canonical bytes across two calls on the same contract', () => {
		const briefA = seal(sealableGateCContract)
		const briefB = seal(sealableGateCContract)
		expect(decode(canonicalize(briefA, 'brief-a'))).toBe(
			decode(canonicalize(briefB, 'brief-b')),
		)
	})
})

describe('seal: reordered interactionPlan/oracles — content fields byte-identical, contractDigest excluded', () => {
	const reordered = EvalContract.parse({
		...sealableGateCContract,
		interactionPlan: [...sealableGateCContract.interactionPlan].reverse(),
		oracles: [...sealableGateCContract.oracles].reverse(),
	})

	it('produces byte-identical content fields regardless of contract-step and oracle-array order', () => {
		const briefOriginal = seal(sealableGateCContract)
		const briefReordered = seal(reordered)

		expect(
			decode(canonicalize(contentFieldsOf(briefOriginal), 'content-a')),
		).toBe(decode(canonicalize(contentFieldsOf(briefReordered), 'content-b')))
	})

	it('still digests the literal (differently-ordered) contract to a different contractDigest', () => {
		// contractDigest and lineage sit outside the byte-identical guarantee on
		// purpose: canonicalize() preserves array order, so a contract differing
		// only in array order necessarily digests differently. Proving the two
		// differ here confirms the exclusion is doing real work, not vacuously
		// excluding fields that would have matched anyway.
		const briefOriginal = seal(sealableGateCContract)
		const briefReordered = seal(reordered)
		expect(briefOriginal.contractDigest).not.toBe(briefReordered.contractDigest)
	})
})

describe('seal: sort order', () => {
	it('sorts scopedResources by reference and safetyLimits lexicographically', () => {
		const unsorted = EvalContract.parse({
			...sealablePopulatedContract,
			scopedResources: [
				{ reference: 'zzz-resource', kind: 'fixture' },
				{ reference: 'aaa-resource', kind: 'fixture' },
				{ reference: 'mmm-resource', kind: 'fixture' },
			],
			safetyLimits: ['zzz limit', 'aaa limit', 'mmm limit'],
		})

		const brief = seal(unsorted)
		expect(brief.scopedResources.map((r) => r.reference)).toEqual([
			'aaa-resource',
			'mmm-resource',
			'zzz-resource',
		])
		expect(brief.safetyLimits).toEqual(['aaa limit', 'mmm limit', 'zzz limit'])
	})

	it('sorts permittedInterfaces by logicalId', () => {
		const unsorted = EvalContract.parse({
			...sealablePopulatedContract,
			permittedInterfaces: [
				{ logicalId: 'zzz-api', kind: 'api', operations: [] },
				...sealablePopulatedContract.permittedInterfaces,
			],
		})

		const brief = seal(unsorted)
		expect(brief.permittedInterfaces.map((i) => i.logicalId)).toEqual([
			'thing-api',
			'zzz-api',
		])
	})

	it('sorts directions by oracleId, independent of the oracles array order', () => {
		const reversed = EvalContract.parse({
			...sealableGateCContract,
			oracles: [...sealableGateCContract.oracles].reverse(),
		})
		const brief = seal(reversed)
		const ids = brief.directions.map((d) => d.oracleId)
		expect(ids).toEqual([...ids].sort())
		// Cross-checked against the source, not only self-referential: a
		// self-referential `toEqual([...ids].sort())` alone would still pass if
		// `seal()` silently dropped or duplicated an oracle, as long as
		// whatever ids remained happened to already be sorted.
		expect(ids).toEqual(
			[...sealableGateCContract.oracles.map((o) => o.id)].sort(),
		)
	})

	it('leaves behaviors in contract order, unsorted, unlike every other array here', () => {
		// gateCContract's own behaviors already happen to be ascending
		// (B-001..B-006), which cannot distinguish "carried through" from
		// "sorted". Reversed to a genuinely descending order so a `seal()` that
		// sorted `behaviors` by `id` would produce ascending output and fail
		// this assertion.
		const descending = [...sealableGateCContract.behaviors].reverse()
		const contract = EvalContract.parse({
			...sealableGateCContract,
			behaviors: descending,
		})
		const brief = seal(contract)
		expect(brief.behaviors.map((b) => b.id)).toEqual(
			descending.map((b) => b.id),
		)
		expect(brief.behaviors.map((b) => b.id)).not.toEqual(
			[...descending.map((b) => b.id)].sort(),
		)
	})
})

describe('seal: null direction is a precondition violation', () => {
	it('throws TypeError when an oracle reaches seal() with a null direction', () => {
		const [firstOracle, ...restOracles] = sealableGateCContract.oracles
		if (firstOracle === undefined) throw new Error('fixture missing an oracle')
		const nullDirectionContract = EvalContract.parse({
			...sealableGateCContract,
			oracles: [{ ...firstOracle, direction: null }, ...restOracles],
		})
		expect(() => seal(nullDirectionContract)).toThrow(TypeError)
	})
})

describe('seal: duplicate sort key is a precondition violation', () => {
	it('throws TypeError when two oracles share an id', () => {
		const [firstOracle, secondOracle, ...restOracles] =
			sealableGateCContract.oracles
		if (firstOracle === undefined || secondOracle === undefined) {
			throw new Error('fixture missing two oracles')
		}
		const duplicateOracleId = EvalContract.parse({
			...sealableGateCContract,
			oracles: [
				firstOracle,
				{ ...secondOracle, id: firstOracle.id },
				...restOracles,
			],
		})
		expect(() => seal(duplicateOracleId)).toThrow(TypeError)
	})

	it('throws TypeError when two permittedInterfaces elements share a logicalId', () => {
		const duplicateLogicalId = EvalContract.parse({
			...sealableGateCContract,
			permittedInterfaces: [
				...sealableGateCContract.permittedInterfaces,
				// Distinct (empty) operations, so this trips seal()'s own
				// logicalId guard rather than buildPlanIndex's unrelated
				// duplicate-operationId guard.
				{ logicalId: 'exports-api', kind: 'api', operations: [] },
			],
		})
		expect(() => seal(duplicateLogicalId)).toThrow(TypeError)
	})

	it('throws TypeError when two scopedResources elements share a reference', () => {
		const duplicateReference = EvalContract.parse({
			...sealablePopulatedContract,
			scopedResources: [
				{ reference: 'seed-manifest', kind: 'fixture' },
				{ reference: 'seed-manifest', kind: 'other' },
			],
		})
		expect(() => seal(duplicateReference)).toThrow(TypeError)
	})
})

describe('seal: empty scopedResources carry-through', () => {
	it('carries contract.scopedResources === null through as [] (the brief field is non-nullable)', () => {
		expect(sealableGateCContract.scopedResources).toBeNull()
		expect(seal(sealableGateCContract).scopedResources).toEqual([])
	})
})

describe('seal: internal self-validation', () => {
	it("round-trips seal()'s own output through SealedEvaluatorBrief.safeParse() successfully and unchanged", () => {
		// A positive-path sanity check only: exercising seal()'s internal
		// SealedEvaluatorBrief.parse() call with already-valid input cannot
		// distinguish that call being present from a bare `return brief`. Its
		// behavior on a hypothetically-invalid assembled brief needs mocking
		// (against this project's no-mock convention) or a corruption seam,
		// neither of which exists; the gap is documented in the spec's own I/O
		// matrix ("Hypothetical internal corruption").
		const brief = seal(sealableGateCContract)
		const result = SealedEvaluatorBrief.safeParse(brief)
		expect(result.success).toBe(true)
		if (!result.success) throw new Error('expected a successful parse')
		// Free given no schema in the brief's chain uses `.transform()` or
		// `.default()`: the parsed value is structurally identical to the
		// input, not merely schema-valid.
		expect(result.data).toEqual(brief)
	})

	// Story 4.4 (AC 1 item 2): `seal()`'s own internal call is now
	// `validateAssembledBrief`, exported for exactly this purpose: a direct
	// invalid-assembled-brief regression the positive-path test above cannot
	// provide, closing the gap that test's own comment names.
	it('validateAssembledBrief rejects an invalid assembled value with a TypeError carrying the ZodError cause', () => {
		const invalid = { ...seal(sealableGateCContract), commentary: 'leaked' }
		expect(() => validateAssembledBrief(invalid)).toThrow(TypeError)
		try {
			validateAssembledBrief(invalid)
			throw new Error('expected validateAssembledBrief to throw')
		} catch (error) {
			expect(error).toBeInstanceOf(TypeError)
			expect((error as TypeError).cause).toBeDefined()
		}
	})

	it('validateAssembledBrief returns the parsed brief unchanged on a valid value', () => {
		const brief = seal(sealableGateCContract)
		expect(validateAssembledBrief(brief)).toEqual(brief)
	})

	// The excess-key rejection above carries an empty Zod issue path, so it
	// only ever exercises the "(root)" fallback. These two reach a nested
	// path, which is what actually formats an array index as a bracket and an
	// object key as a dotted segment; without them a regression that swapped
	// the two would ship unnoticed.
	it('names a nested failing field with the array index bracketed and the object key dotted', () => {
		const invalid = structuredClone(seal(sealableGateCContract)) as {
			directions: { text: string }[]
		}
		const first = invalid.directions[0]
		if (first === undefined) throw new Error('fixture setup failed')
		first.text = ''
		expect(() => validateAssembledBrief(invalid)).toThrow(
			/first at "directions\[0\]\.text"/,
		)
	})

	it('names a failing array element by its bracketed index alone when the element is not an object', () => {
		const invalid = structuredClone(seal(sealableGateCContract)) as {
			safetyLimits: unknown[]
		}
		if (invalid.safetyLimits.length === 0) {
			throw new Error('fixture setup failed')
		}
		invalid.safetyLimits[0] = 42
		expect(() => validateAssembledBrief(invalid)).toThrow(
			/first at "safetyLimits\[0\]"/,
		)
	})
})

// Story 4.4, AC 4: a type-level assignment proving the existing `seal`
// implementation conforms to `stage-contracts.ts`'s `SealStage` shape. The
// assignment itself is the compile-time proof (this would fail `npm run
// typecheck` if `seal`'s signature ever drifted from `SealStage`), and the
// call through the typed alias below is a runtime sanity check that the
// conformance type didn't quietly narrow behavior.
describe('seal: conforms to the SealStage conformance type (AD-34, AC 4)', () => {
	it('assigns to SealStage and produces the same result called through that type', () => {
		const stage: SealStage = seal
		expect(stage(sealableGateCContract)).toEqual(seal(sealableGateCContract))
	})
})

describe('SealedEvaluatorBrief strictObject rejects accidental leaks (reject fixtures)', () => {
	const validBrief = seal(sealableGateCContract)

	it('rejects a brief carrying author commentary', () => {
		const result = SealedEvaluatorBrief.safeParse({
			...validBrief,
			commentary: 'author documentation that never reaches the brief',
		})
		expect(result.success).toBe(false)
	})

	it('rejects a brief carrying the interaction plan', () => {
		const result = SealedEvaluatorBrief.safeParse({
			...validBrief,
			interactionPlan: sealableGateCContract.interactionPlan,
		})
		expect(result.success).toBe(false)
	})

	it('rejects a brief carrying a step identifier', () => {
		const result = SealedEvaluatorBrief.safeParse({
			...validBrief,
			stepId: 'poll',
		})
		expect(result.success).toBe(false)
	})

	it('rejects a brief carrying the forbidden-input floor', () => {
		const result = SealedEvaluatorBrief.safeParse({
			...validBrief,
			forbiddenInputs: sealableGateCContract.forbiddenInputs,
		})
		expect(result.success).toBe(false)
	})
})
