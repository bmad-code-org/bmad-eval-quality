/**
 * `seal`: walks a compiled `EvalContract`'s oracles to assemble the
 * `SealedEvaluatorBrief` AD-16 describes, making its isolation boundary
 * structural rather than conventional. Pure and deterministic (AD-1: the core
 * is pure, no filesystem/network/clock/randomness. AD-2: eval-quality never
 * executes an evaluator, agent, judge, or the system under test): no
 * filesystem, network, clock, randomness, model call, or evaluator
 * execution. Reuses Story 2.1's `buildPlanIndex`/`renderDirectionText` for the
 * generated prose and `digestArtifact` for `contractDigest`; never
 * re-implements rendering or hashing locally. Before returning, also
 * runtime-validates the fully-assembled brief via `SealedEvaluatorBrief.parse()`,
 * so AD-16's exclusion guarantee has a runtime backstop, not only TypeScript's
 * compile-time excess-property check on the return literal.
 */
import { ZodError, core as zodCore } from 'zod'
import { digestArtifact } from '../canonical/digest.ts'
import type { EvalContract } from '../schemas/eval-contract.ts'
import { SealedEvaluatorBrief } from '../schemas/sealed-evaluator-brief.ts'
import { renderDirectionText } from './direction-prose.ts'
import { buildPlanIndex } from './plan-index.ts'

// Every artifact this story digests wholesale, so one stable label serves
// every call regardless of which contract is being sealed.
const CONTRACT_ARTIFACT_PATH = 'EvalContract'

/**
 * Sorts by a natural identifying string key, throwing `TypeError` on a
 * duplicate key rather than emitting an order-dependent result. The schema
 * enforces no uniqueness on `oracle.id`, `permittedInterface.logicalId`, or
 * `scopedResource.reference`, so a duplicate is a real possibility and
 * sort-stability alone would otherwise silently break byte-identity under
 * contract-step reordering. Same precondition-violation convention
 * `plan-index.ts`'s duplicate-`stepId`/`operationId` guard already uses.
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

	// One `renderDirectionText` call per oracle. A `null` direction reaching
	// here is a precondition violation (a compiled contract's oracles must
	// carry a non-null direction by the time `seal` reads them) — throw, never
	// filter or skip.
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

	// Explicitly typed (not just inferred) so TypeScript's excess-property
	// check still runs against this literal, exactly as it did on the prior
	// bare `return {...}`: assigning an object literal to an explicitly-typed
	// binding triggers the same check as returning it from a typed function.
	const brief: SealedEvaluatorBrief = {
		// `seal` owns these two fields for `SealedEvaluatorBrief` per AD-24/
		// AD-29: this call mints a fresh artifact, never a revision of a prior
		// brief. `seal` is pure and stateless (AD-12: no lineage tracking
		// across invocations) and takes no "prior brief" argument, so the only
		// artifact it can honestly produce is a lineage root — `parentDigest`
		// null, `revisionCount` 0 — independent of the contract's own lineage,
		// which is a different artifact's history. `schemaVersion` is the
		// brief schema's current version.
		schemaVersion: 1,
		parentDigest: null,
		revisionCount: 0,
		// A plain digest of the literal input: two differently-ordered
		// contracts necessarily digest differently, by construction. That is
		// correct, not a bug — see the story's Design Notes for why this field
		// sits outside the byte-identical-under-reordering guarantee the rest
		// of the brief carries.
		contractDigest: digestArtifact(contract, CONTRACT_ARTIFACT_PATH),
		// Carried through in contract order, unsorted — its own schema doc
		// calls it "carried through unchanged", unlike the other arrays below.
		// Copied rather than aliased, like every other field here: the brief
		// must not keep sharing structure with the input, or a caller mutating
		// `contract.behaviors` after `seal()` returns would silently mutate the
		// "sealed" brief too.
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

	// AD-16's isolation boundary rests on this brief carrying only its
	// declared fields. Until now the only enforcement was the compile-time
	// excess-property check above, which only ever protects this one literal;
	// a future non-literal construction path (an `as` cast, a spread, a
	// refactor to build the object incrementally) would have no backstop.
	// `seal()` is the sole package-boundary-artifact-minting function in
	// `core/` today (Epic 6's publish surface, the next layer that could
	// re-check the brief, is still backlog; see this story's Design Notes),
	// so this self-validation is scoped to `seal()` only, not extended to
	// every `core/` function. A `ZodError` here never escapes as itself: it
	// is rethrown as `TypeError`, matching this file's own precondition-
	// violation convention, and never mints a new AD-28 fault code.
	try {
		return SealedEvaluatorBrief.parse(brief)
	} catch (error) {
		if (error instanceof ZodError) {
			const issueCount = error.issues.length
			const firstIssue = error.issues[0]
			const firstPath = firstIssue ? zodCore.toDotPath(firstIssue.path) : ''
			throw new TypeError(
				`seal() assembled a brief that failed SealedEvaluatorBrief validation: ${issueCount} issue${issueCount === 1 ? '' : 's'}, first at "${firstPath === '' ? '(root)' : firstPath}"`,
				{ cause: error },
			)
		}
		// Defensive fallback, unreachable today: no schema in
		// `SealedEvaluatorBrief`'s chain uses a custom refine, transform, or
		// async validation, so `.parse()` above can only ever throw `ZodError`.
		throw error
	}
}
