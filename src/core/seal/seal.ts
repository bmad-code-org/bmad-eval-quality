/**
 * `seal`: walks a compiled `EvalContract`'s oracles to assemble the
 * `SealedEvaluatorBrief` AD-16 describes, making its isolation boundary
 * structural rather than conventional. Pure per AD-1/AD-2: no filesystem,
 * network, clock, randomness, model call, or evaluator execution. Reuses
 * `buildPlanIndex`/`renderDirectionText` for the generated prose and
 * `digestArtifact` for `contractDigest`; never reimplements rendering or
 * hashing locally. Before returning, `validateAssembledBrief` gives AD-16's
 * exclusion guarantee a runtime backstop; see that function for why.
 */
import { digestArtifact } from '../canonical/digest.ts'
import { freezeArtifact } from '../lineage/freeze.ts'
import type { EvalContract } from '../schemas/eval-contract.ts'
import { SealedEvaluatorBrief } from '../schemas/sealed-evaluator-brief.ts'
import { renderDirectionText } from './direction-prose.ts'
import { buildPlanIndex } from './plan-index.ts'

// `seal` digests the contract whole, so one stable label serves every call
// regardless of which contract is being sealed.
const CONTRACT_ARTIFACT_PATH = 'EvalContract'

/**
 * Sorts by a natural identifying string key, throwing `TypeError` on a
 * duplicate key rather than emitting an order-dependent result. The schema
 * enforces no uniqueness on `oracle.id`, `permittedInterface.logicalId`, or
 * `scopedResource.reference`, so a duplicate is a real possibility and
 * sort-stability alone would otherwise silently break byte-identity under
 * contract-step reordering. This is the same precondition-violation
 * convention `plan-index.ts`'s duplicate-`stepId`/`operationId` guard uses.
 */
function sortedByKey<T>(
	items: readonly T[],
	keyOf: (item: T) => string,
	keyLabel: string,
): T[] {
	const seen = new Set<string>()
	for (const item of items) {
		const key = keyOf(item)
		if (seen.has(key)) {
			throw new TypeError(`duplicate ${keyLabel} in sealed brief input: ${key}`)
		}
		seen.add(key)
	}
	return [...items].sort((a, b) => {
		const keyA = keyOf(a)
		const keyB = keyOf(b)
		return keyA < keyB ? -1 : keyA > keyB ? 1 : 0
	})
}

export function seal(contract: EvalContract): SealedEvaluatorBrief {
	const index = buildPlanIndex(
		contract.interactionPlan,
		contract.permittedInterfaces,
	)

	// A `null` direction reaching here is a precondition violation: a
	// compiled contract's oracles must carry a non-null direction by the
	// time `seal` reads them. Throw, never filter or skip.
	const directions = contract.oracles.map((oracle) => {
		if (oracle.direction === null) {
			throw new TypeError(
				`oracle ${oracle.id} reached seal() with a null direction`,
			)
		}
		return {
			oracleId: oracle.id,
			text: renderDirectionText(oracle.direction, index),
		}
	})

	// A per-element projection, not a carry-through: `PermittedInterface` has
	// an `operations` field `BriefInterface` does not, so shipping it here
	// would hand the evaluator the action inventory AD-39 keeps from it.
	const permittedInterfaces = contract.permittedInterfaces.map((iface) => ({
		logicalId: iface.logicalId,
		kind: iface.kind,
	}))

	// `null` on the contract means "no scoped resources declared"; `seal`
	// always resolves an answer, so it carries through as `[]`, matching the
	// brief field's non-nullable schema.
	const scopedResources = contract.scopedResources ?? []

	// Explicitly typed, not just inferred, so TypeScript's excess-property
	// check still runs against this literal: assigning an object literal to
	// an explicitly-typed binding triggers the same check as returning it
	// from a typed function.
	const brief: SealedEvaluatorBrief = {
		// `seal` owns these two fields per AD-24/AD-29: this call mints a
		// fresh artifact, never a revision of a prior brief. `seal` is pure
		// and stateless with no "prior brief" argument (AD-12), so the only
		// honest artifact is a lineage root: `parentDigest` null,
		// `revisionCount` 0, independent of the contract's own lineage.
		// `schemaVersion` is the brief schema's current version.
		schemaVersion: 1,
		parentDigest: null,
		revisionCount: 0,
		// A plain digest of the literal input: two differently-ordered
		// contracts necessarily digest differently, by construction. This
		// field sits outside the byte-identical-under-reordering guarantee the
		// rest of the brief carries, since it tracks the literal contract that
		// was sealed.
		contractDigest: digestArtifact(contract, CONTRACT_ARTIFACT_PATH),
		// Carried through in contract order, unsorted: its own schema doc
		// calls it "carried through unchanged," unlike the arrays below.
		// Copied rather than aliased, like every field here, since the brief
		// must not keep sharing structure with the input, or a caller
		// mutating `contract.behaviors` after `seal()` returns would
		// silently mutate the "sealed" brief too.
		behaviors: [...contract.behaviors],
		directions: sortedByKey(directions, (d) => d.oracleId, 'oracleId'),
		permittedInterfaces: sortedByKey(
			permittedInterfaces,
			(i) => i.logicalId,
			'permittedInterfaces logicalId',
		),
		scopedResources: sortedByKey(
			scopedResources,
			(r) => r.reference,
			'scopedResources reference',
		),
		// Copied rather than aliased, for the same reason as `behaviors` above.
		budgets: { ...contract.budgets },
		// Sorted lexicographically; sort-key duplicates are impossible here
		// since equal strings are interchangeable, so no duplicate guard.
		safetyLimits: [...contract.safetyLimits].sort(),
		probeStepBound: contract.probeStepBound,
	}

	// The parse returns Zod's own deep clone, so the freeze lands on the
	// brief the caller receives and leaves the contract it was built from alone.
	return freezeArtifact(validateAssembledBrief(brief))
}

/**
 * The runtime backstop behind AD-16's exclusion guarantee. TypeScript's
 * compile-time excess-property check protects only `seal()`'s current
 * return literal; a future non-literal construction path (an `as` cast, a
 * spread, an incremental build) would otherwise have no backstop. Reads only
 * the `safeParse` result shape, so `core/schemas` stays the sole Zod
 * boundary and a rejection becomes a `TypeError` (this file's
 * precondition-violation convention) with no `ZodError` import to test
 * against.
 *
 * Scoped to `seal()`, the one function in `core/` minting a package-boundary
 * artifact today. Exported so a regression test can drive the rejection path
 * directly.
 */
export function validateAssembledBrief(brief: unknown): SealedEvaluatorBrief {
	const result = SealedEvaluatorBrief.safeParse(brief)
	if (result.success) return result.data
	const issueCount = result.error.issues.length
	const firstIssue = result.error.issues[0]
	const firstPath = firstIssue ? dotPath(firstIssue.path) : ''
	throw new TypeError(
		`seal() assembled a brief that failed SealedEvaluatorBrief validation: ${issueCount} issue${issueCount === 1 ? '' : 's'}, first at "${firstPath === '' ? '(root)' : firstPath}"`,
		{ cause: result.error },
	)
}

/**
 * Formats a Zod issue path for the message above, mirroring zod's own
 * `core.toDotPath` branch by branch without importing it: a word-shaped
 * segment joins with `.`; a numeric, symbol, or non-identifier segment is
 * bracketed. The mirror holds even at the edges, so a segment that is
 * word-shaped but starts with a digit stays unbracketed here exactly as zod
 * leaves it.
 */
function dotPath(path: readonly PropertyKey[]): string {
	const segments: string[] = []
	for (const segment of path) {
		if (typeof segment === 'number') segments.push(`[${segment}]`)
		else if (typeof segment === 'symbol' || /[^\w$]/.test(segment)) {
			segments.push(`[${JSON.stringify(String(segment))}]`)
		} else {
			if (segments.length > 0) segments.push('.')
			segments.push(segment)
		}
	}
	return segments.join('')
}
