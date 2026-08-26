import { StructuralFailure } from '../../src/core/failure-codes.ts'
import { populatedContract } from '../schemas/fixtures/relevance-contracts.ts'

export function structuralFailureOf(fn: () => void): StructuralFailure {
	try {
		fn()
	} catch (error) {
		if (error instanceof StructuralFailure) return error
		throw error
	}
	throw new Error('expected a StructuralFailure to be thrown')
}

/**
 * `populatedContract` with `scopedResources` nulled: its baseline value
 * unconditionally trips `checkScopedResourceReferences` (a Story 4.2 stub
 * that rejects any populated scoped-resource list outright), so every
 * whole-pipeline test needs the field cleared first. Nulled here instead of
 * in the shared fixture, so `reject-cases.ts`'s
 * `scoped-resource-reference-empty` case and other consumers of
 * `populatedContract` stay unaffected.
 */
export function cleanPopulatedContract(): unknown {
	const contract = structuredClone(populatedContract) as any
	contract.scopedResources = null
	return contract
}
