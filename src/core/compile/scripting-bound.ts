/**
 * AD-39's two interaction-plan graph checks: `nested-temporal-clause` and
 * `plan-exceeds-scripting-bound`, each walking `contract.interactionPlan`
 * once. Both throw `StructuralFailure` on the first violation, matching
 * every other `core/compile/` module's fail-fast convention.
 */
import { StructuralFailure } from '../failure-codes.ts'
import type { EvalContract } from '../schemas/eval-contract.ts'
import type { InteractionStep } from '../schemas/plan.ts'
import { buildPlanIndex, type PlanIndex } from '../seal/plan-index.ts'

/**
 * A dangling `after` (naming no declared step, including one made
 * unresolvable by a duplicate id) resolves to `undefined`, the same as a
 * genuinely absent clause.
 */
function parentOf(
	step: InteractionStep,
	index: PlanIndex,
): InteractionStep | undefined {
	if (step.after === null) return undefined
	return index.stepOf(step.after)
}

function planIndexOf(contract: EvalContract): PlanIndex {
	return buildPlanIndex(
		contract.interactionPlan,
		contract.permittedInterfaces,
		{ duplicateIds: 'unresolved' },
	)
}

// ---- nested-temporal-clause ------------------------------------------------

/** `nested-temporal-clause`: a step's declared parent itself carries a temporal clause. */
export function checkNestedTemporalClause(contract: EvalContract): void {
	const index = planIndexOf(contract)
	for (const step of contract.interactionPlan) {
		const parent = parentOf(step, index)
		if (parent !== undefined && parentOf(parent, index) !== undefined) {
			throw new StructuralFailure(
				'nested-temporal-clause',
				`EvalContract.interactionPlan[stepId=${step.stepId}].after`,
				`names step "${parent.stepId}", which itself carries a temporal clause; a chain may not nest more than one level (AD-39)`,
			)
		}
	}
}

// ---- plan-exceeds-scripting-bound ------------------------------------------

/**
 * Bounds are exclusive ceilings: a metric sitting exactly at its bound is
 * legal. Each is set against this codebase's own two whole-contract
 * fixtures as the accept floor and AD-39's two counterexample plans as the
 * reject ceiling: the eight-step single-root chain and the sixty-four
 * independent `write-N`/`read-N` pairs, which AD-39 records as passing a
 * depth bound alone. AD-5 mandates one authored reject fixture per shape
 * this predicate rejects, and `tests/compile/scripting-bound.test.ts`
 * carries them.
 */
const WIDTH_MAX = 2 // gateCContract's own submit -> {poll, first-page} sits exactly here.
const SHARED_ANCHOR_MAX = 2 // twice gateCContract's own shared-anchor count of 1 (no real fixture reaches 2).
const DISJOINT_PAIR_MAX = 4 // populatedContract's own create -> list pair is 1.
const STEP_COUNT_MAX = 16 // gateCContract is 6, populatedContract is 2; roughly 2.7x the larger.

type GraphMetrics = {
	readonly hasNestedChain: boolean
	readonly maxWidth: number
	readonly sharedAnchorCount: number
	readonly disjointPairCount: number
	readonly stepCount: number
}

/**
 * One pass over the plan's `after` edges, building three views at once: the
 * one-hop nesting test (shared with `checkNestedTemporalClause`), each
 * anchor's child count (width, shared anchors), and an undirected adjacency
 * map for the connected-component scan below (disjoint pairs). O(n) in the
 * step count.
 *
 * Every internal map is keyed by each step's array position. `stepId` is
 * schema-legal to duplicate, so keying on it would merge two distinct
 * steps sharing an id into one adjacency entry and corrupt
 * `maxWidth`/`sharedAnchorCount`/`disjointPairCount`.
 */
function computeGraphMetrics(
	plan: readonly InteractionStep[],
	index: PlanIndex,
): GraphMetrics {
	const positionOf = new Map<InteractionStep, number>()
	for (const [position, step] of plan.entries()) positionOf.set(step, position)

	const children = new Map<number, number[]>()
	const adjacency = new Map<number, Set<number>>()
	for (const [position] of plan.entries()) adjacency.set(position, new Set())

	let hasNestedChain = false
	for (const [position, step] of plan.entries()) {
		const parent = parentOf(step, index)
		if (parent === undefined) continue
		if (parentOf(parent, index) !== undefined) hasNestedChain = true
		const parentPosition = positionOf.get(parent)
		if (parentPosition === undefined) {
			// Should-never-happen precondition violation, matching `resolveStep`'s
			// convention (`plan-index.ts`): `index` is always built from this same
			// `plan` array, so a resolved parent is always one of its elements.
			throw new TypeError(
				`scripting-bound: resolved parent for step "${step.stepId}" is not present in the plan passed to computeGraphMetrics`,
			)
		}
		const siblings = children.get(parentPosition)
		if (siblings === undefined) children.set(parentPosition, [position])
		else siblings.push(position)
		adjacency.get(position)?.add(parentPosition)
		adjacency.get(parentPosition)?.add(position)
	}

	let maxWidth = 0
	let sharedAnchorCount = 0
	for (const siblings of children.values()) {
		if (siblings.length > maxWidth) maxWidth = siblings.length
		if (siblings.length >= 2) sharedAnchorCount += 1
	}

	// Connected components over the undirected `after` graph; a component of
	// exactly two nodes is one disjoint witness pair (the 64-pair fixture's
	// own shape). A plain stack (`.pop()`) is enough for an unordered scan;
	// `.shift()` would cost O(n) per call.
	let disjointPairCount = 0
	const visited = new Set<number>()
	for (const [position] of plan.entries()) {
		if (visited.has(position)) continue
		let size = 0
		const stack = [position]
		visited.add(position)
		while (stack.length > 0) {
			const id = stack.pop()
			if (id === undefined) continue
			size += 1
			for (const neighbor of adjacency.get(id) ?? []) {
				if (!visited.has(neighbor)) {
					visited.add(neighbor)
					stack.push(neighbor)
				}
			}
		}
		if (size === 2) disjointPairCount += 1
	}

	return {
		hasNestedChain,
		maxWidth,
		sharedAnchorCount,
		disjointPairCount,
		stepCount: plan.length,
	}
}

/** `plan-exceeds-scripting-bound`: the graph predicate over the whole plan. */
export function checkScriptingBound(contract: EvalContract): void {
	const index = planIndexOf(contract)
	const metrics = computeGraphMetrics(contract.interactionPlan, index)
	const violation = metrics.hasNestedChain
		? 'its deepest temporal chain exceeds the published one-level bound'
		: metrics.maxWidth > WIDTH_MAX
			? `one step anchors ${metrics.maxWidth} other steps, past the published width bound of ${WIDTH_MAX}`
			: metrics.sharedAnchorCount > SHARED_ANCHOR_MAX
				? `${metrics.sharedAnchorCount} steps each anchor more than one other step, past the published bound of ${SHARED_ANCHOR_MAX} shared anchors`
				: metrics.disjointPairCount > DISJOINT_PAIR_MAX
					? `${metrics.disjointPairCount} mutually disjoint two-step witness pairs appear in one plan, past the published bound of ${DISJOINT_PAIR_MAX}`
					: metrics.stepCount > STEP_COUNT_MAX
						? `the plan declares ${metrics.stepCount} steps, past the published bound of ${STEP_COUNT_MAX}: an exhaustive operation inventory rather than a bounded set of witness relations`
						: undefined
	if (violation !== undefined) {
		throw new StructuralFailure(
			'plan-exceeds-scripting-bound',
			'EvalContract.interactionPlan',
			`${violation} (AD-5, AD-39)`,
		)
	}
}
