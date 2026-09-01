/**
 * The order a plan's steps must be resolved in when one step's selection
 * depends on another's. Kahn tiers over the union of the capture edges and
 * AD-39's `after` edges, the same graph `checkBindingCycle` builds: every step
 * in tier n depends only on steps in tiers below n, so a caller walking the
 * tiers in order always has what it needs resolved by the time it reads it.
 *
 * The `after` edge is in the graph because `selectWithBindings` resolves a
 * temporal anchor through the same binding filter as everything else, so a step
 * can read an anchor whose own capture sites must already be written. Tiering
 * captures alone made the answer depend on declaration order within a tier: two
 * same-tier steps swapped flipped a verdict between `none` and one match.
 *
 * `{ literal }`, `{ matcher }`, and `{ principal }` bindings declare no
 * dependency, so a step carrying only those and no clause is tier zero. So is a
 * step whose captured pointer or `after` clause names an id the plan does not
 * declare: a dangling capture is `unreachable-check-evidence`'s at compile time,
 * AD-39 makes a dangling `after` permissive, and nothing here should invent an
 * ordering for either.
 *
 * Within a tier the order is the order the steps are declared in
 * `interactionPlan`, which is what "sequence order within a tier" can mean at
 * compile time, where no observation `sequence` exists yet. ADR-006 bans
 * reading order off array position in a run record, where the array is an
 * ingest artifact nobody authored; a contract's `interactionPlan` is the
 * author's own declaration, and permuting it yields a different contract with a
 * different digest, so there is no permutation invariance to preserve.
 */
import { capturedBindings } from '../compile/bindings.ts'
import type { InteractionStep } from '../schemas/plan.ts'

export type BindingOrder = {
	/** Ascending tiers; within each, steps in declaration order. Every declared id appears exactly once. */
	readonly tiers: readonly (readonly string[])[]
	/**
	 * Ids Kahn's algorithm left unplaced, in declaration order: the members of an
	 * ordering cycle and every step downstream of one, since a step whose
	 * dependency never gets a tier never gets one either.
	 */
	readonly cyclic: readonly string[]
}

/**
 * Cyclic steps come back as data instead of an exception, matching
 * `selectObservations`'s own policy of reporting ambiguity rather than deciding
 * it. A compiled contract never reaches that list: `binding-cycle` rejects
 * every cycle carrying a capture edge and `nested-temporal-clause` every cycle
 * made of `after` edges alone, so the union graph is acyclic by the time any
 * record is scored.
 */
export function bindingOrder(
	interactionPlan: readonly InteractionStep[],
): BindingOrder {
	// A duplicated id collapses to one node: the plan declares one name, and
	// which of two same-named steps a capture meant is undecidable here.
	const declared: string[] = []
	const dependencies = new Map<string, Set<string>>()
	for (const step of interactionPlan) {
		if (dependencies.has(step.stepId)) continue
		declared.push(step.stepId)
		dependencies.set(step.stepId, new Set())
	}
	for (const step of interactionPlan) {
		const own = dependencies.get(step.stepId)
		if (own === undefined) continue
		for (const capture of capturedBindings(step)) {
			const { stepId } = capture.target
			// A self-reference is a cycle of one, so it stays in the graph and lands
			// in `cyclic` rather than being filtered into tier zero.
			if (dependencies.has(stepId)) own.add(stepId)
		}
		if (step.after !== null && dependencies.has(step.after)) {
			own.add(step.after)
		}
	}

	const tiers: string[][] = []
	const placed = new Set<string>()
	while (placed.size < declared.length) {
		const tier = declared.filter(
			(stepId) =>
				!placed.has(stepId) &&
				[...(dependencies.get(stepId) ?? [])].every((id) => placed.has(id)),
		)
		// Every remaining step depends on another remaining step, which is a cycle.
		if (tier.length === 0) break
		tiers.push(tier)
		for (const stepId of tier) placed.add(stepId)
	}

	return { tiers, cyclic: declared.filter((stepId) => !placed.has(stepId)) }
}
