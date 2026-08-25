---
epic: 4
story: 3
key: 4-3-the-scripting-bound-graph-predicate-and-its-adversarial-fixtures
baseline_commit: e38169bbe1b1d3c4abb539752aa2db41d6be8266
---

# Story 4.3: The scripting-bound graph predicate and its adversarial fixtures

Status: done

## Story

As the boundary between witness relations and scripts,
I want the published executable graph predicate with authored reject fixtures,
so that the line is drawn by a predicate a second implementer can run rather than a phrase they must interpret.

## Acceptance Criteria

### AC 1: Module location, scope, and what this story does not build

**One new module, `src/core/compile/scripting-bound.ts`, two new exported check functions: the last two of AD-5's twenty-one codes within Epic 4's own stage-one/compile scope. No existing `src/` behavior changes.** (Three codes remain genuinely unimplemented after this story — `rubric-unanchored`, `rubric-evidence-unreachable`, `rubric-scores-reasoning-prose` — named in the "does not build" list below rather than left for a reader to discover by grepping `src/`.)

- `checkNestedTemporalClause` (`nested-temporal-clause`): a temporal clause naming a step that itself carries one. `InteractionStep`'s own schema (`plan.ts`) admits an arbitrarily long `after` chain by design — its own field comment names this as "a named deviation from the epic's acceptance criteria of record, taken so the code keeps a shape to fire on" — and this function is that code.
- `checkScriptingBound` (`plan-exceeds-scripting-bound`): the published executable graph predicate over depth, width, shared anchors, disjoint pairs, and step count (AD-5's registry entry for the boundary AD-39 describes only in prose). `EvalContract`'s own `interactionPlan` field comment names this story by number as the one that owns it, and states the schema deliberately carries no maximum so the sixty-four-pair and eight-chain adversarial shapes stay representable for this predicate to reject.

**What this story reuses rather than rebuilds. Read `plan-index.ts` and `scripting-audit.ts` in full before writing anything.**

- `buildPlanIndex` (`core/seal/plan-index.ts`), with its `duplicateIds: 'unresolved'` option (already built for Story 4.2's identical need): reused directly for step-id resolution in both functions, rather than a private `Map`.
- `StructuralFailure`/`FAILURE_CODES` (`core/failure-codes.ts`): unchanged. Both codes this story throws already exist in the registry tuple (added in Story 1.3, per its own Decision 5, deliberately unenforced in the schema); this story adds callers, no new member.
- `InteractionStep`, `EvalContract` (`core/schemas/`): read, never edited.

**What this story does not build, and why. Each is named rather than silently dropped:**

1. **A `compile()` orchestrating entry point, or any ordering guarantee between this story's two functions and the fifteen structural checks Stories 4.1 and 4.2 already shipped.** Story 4.4's job, per both `epics.md` and Story 4.1/4.2's own identical exclusion for their own checks (Story 4.2 Decision 7). A contract invalid under two codes at once reports whichever code's function a caller reaches first.
2. **`brief-exceeds-scripting-bound`.** Already shipped: Story 2.3's `auditBriefScripting` (`core/seal/scripting-audit.ts`), which runs post-generation over the emitted brief's rendered prose rather than pre-generation over declarations — a free-text channel this story's declaration-side graph predicate cannot see, per that file's own header comment.
3. **AD-39's "Owed to the reference implementation" item 2** — observation-selection ambiguity and the unimplementability of the temporal clause against a real sealed run record. Score-side, and no epic touches `score` until the items in that section close.
4. **A `.max()` cap on `interactionPlan`, or any bound on `after`-chain length, in the Zod schema.** `eval-contract.ts`'s own field comment states plainly why not: the schema needs the sixty-four-pair and eight-chain shapes to parse so this predicate has something to reject. A schema-level cap would make the required reject fixtures unparseable, defeating the point of an authored adversarial fixture.
5. **Editing `check-ad5-registry.ts`, `failure-codes.ts`, or any spine text.** This story adds callers of two already-registered codes; it settles no new spine ambiguity.
6. **The three rubric codes (`rubric-unanchored`, `rubric-evidence-unreachable`, `rubric-scores-reasoning-prose`).** These, not this story's two, are AD-5's only remaining codes with no thrower anywhere in `src/`. Epic 6 Story 6.3's job (`6-3-rubric-compilation-under-checked-rules` in `sprint-status.yaml`), per FR15's own coverage-map row ("Epic 1 (rubric schema), Epic 6 (rubric compile checks)" — never Epic 4) and Story 4.2 AC 1 item 2's identical exclusion. This story's own opening "last two" claim is scoped to AD-5's stage-one/compile-owned codes (AD-38's stage-one list), not to all twenty-one; these three are the qualification (found in review).
7. **Verifying that `after` actually names an *earlier*-declared step.** `InteractionStep.after`'s own field comment (`plan.ts`) calls the target "the identifier of an earlier step," but neither check reads array position: a step may legally name a *later*-declared step as its temporal parent and both checks accept it silently. No AD-5 code is assigned to a forward-declared `after` (confirmed against the registry table), so this story correctly cannot invent one under item 5 above — but the gap is named here rather than left to be rediscovered, mirroring Decision 4's own framing (found in review): a future story naming a code for this condition supersedes this decision.

**Purity (AD-1).** Both exported functions are synchronous, deterministic, and pure: no I/O, no clock, no randomness, one pass over `contract.interactionPlan` each.

### AC 2: `src/core/compile/scripting-bound.ts`

Both codes read the interaction plan as a graph: nodes are steps, and a step's `after` (when non-null) is a directed edge to its declared temporal parent, its **anchor**. `nested-temporal-clause` is a one-hop test over that edge; `plan-exceeds-scripting-bound` is five aggregate metrics over the same edge set plus the plan's own step count.

```ts
/**
 * AD-39's two interaction-plan graph checks, both walking
 * `contract.interactionPlan` once: `nested-temporal-clause` (a temporal
 * clause naming a step that itself carries one, the one-level bound
 * `InteractionStep`'s own schema deliberately leaves unenforced) and
 * `plan-exceeds-scripting-bound` (the published executable graph predicate
 * over depth, width, shared anchors, disjoint pairs, and step count; AD-5's
 * registry entry for this boundary describes it only in prose). Both throw
 * `StructuralFailure` on the first violation, matching every other
 * `core/compile/` module's fail-fast convention.
 */
import { StructuralFailure } from '../failure-codes.ts'
import type { EvalContract } from '../schemas/eval-contract.ts'
import type { InteractionStep } from '../schemas/plan.ts'
import { buildPlanIndex, type PlanIndex } from '../seal/plan-index.ts'

/**
 * A step's declared temporal parent, resolved permissively: `after` is a
 * bare `Identifier`, unvalidated against the plan's own step ids at the
 * schema level. A dangling `after` (naming no declared step, including one
 * made unresolvable by a duplicate id) resolves to `undefined`, the same
 * treatment as a genuinely absent clause (Decision 4). Both checks below
 * apply this same resolution to a *parent's own* `after`, not just a step's:
 * a step whose declared parent itself has a dangling `after` reads as if
 * that parent carried no clause at all, since `parentOf(parent, index)` is
 * what decides "carries a clause," never the parent's raw field.
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
 * fixtures as the accept floor and the two epic-mandated adversarial shapes
 * as the reject ceiling (Decision 1).
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
 * one-hop nesting test (shared with `checkNestedTemporalClause`, Decision 2),
 * each anchor's child count (width, shared anchors), and an undirected
 * adjacency map for the connected-component scan below (disjoint pairs).
 * O(n) in the step count.
 *
 * Every internal map is keyed by each step's array position. `stepId` is
 * schema-legal to duplicate, so keying on it would merge two distinct
 * steps sharing an id into one adjacency entry and corrupt
 * `maxWidth`/`sharedAnchorCount`/`disjointPairCount` (Decision 6).
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
```

**Verified against both whole-contract fixtures before writing this AC**, not just asserted: `populatedContract`'s two-step plan (`create` -> `list`, one edge, one two-node component) sits at `hasNestedChain=false`, `maxWidth=1`, `sharedAnchorCount=0`, `disjointPairCount=1`, `stepCount=2` — every metric comfortably clear. `gateCContract`'s six-step plan (`submit` anchoring both `poll` and `first-page`, three further root steps with no edges at all) sits at `hasNestedChain=false`, `maxWidth=2` (exactly `WIDTH_MAX`, legal), `sharedAnchorCount=1`, `disjointPairCount=0` (the three-node `{submit, poll, first-page}` component is not a pair; the three isolated steps are one-node components, not pairs either), `stepCount=6` — every metric passes, `maxWidth` calibrating the bound exactly. `ad5-admissions.test.ts`'s eight-step single-root chain (`chain-2` through `chain-8` each naming the previous step) fires `hasNestedChain=true` at `chain-3`, the first step whose parent itself carries a clause — the same step `checkNestedTemporalClause` independently rejects, which is Decision 3's overlap, not a bug. Its sixty-four independent `write-N`/`read-N` pairs sit at `hasNestedChain=false` (every pair is exactly one level), `maxWidth=1`, `sharedAnchorCount=0`, `disjointPairCount=64` — sixty past the published bound of four.

### AC 3: Fixtures and tests

One test file, mirroring `tests/compile/waivers.test.ts`'s own conventions: `EvalContract.parse(...)` for whole-fixture positive regressions, `structuredClone(...) as any` plus a mutation for negative fixtures, `structuralFailureOf` imported from `./helpers.ts` (matching `expression-legality.test.ts`/`oracle-alignment.test.ts`'s newer convention rather than a locally redeclared copy).

**`tests/compile/scripting-bound.test.ts` (new).**

1. `checkNestedTemporalClause(EvalContract.parse(populatedContract))` and `(EvalContract.parse(gateCContract))` do not throw.
2. `checkScriptingBound(EvalContract.parse(populatedContract))` and `(EvalContract.parse(gateCContract))` do not throw — the two-fixture proof AC 2's own "verified against both whole-contract fixtures" note above claims; re-run them, not the note's paraphrase.
3. `ad5-admissions.test.ts`'s `nested-temporal-clause` mutation (`first`/`second`/`third`, `third.after: 'second'`) throws under `checkNestedTemporalClause`, `code: 'nested-temporal-clause'`, `artifactPath` ending `interactionPlan[stepId=third].after`.
4. `gateCContract`'s own `submit` -> `{poll, first-page}` shared-anchor shape does not throw under `checkNestedTemporalClause`: proves width alone never trips nesting (already covered by fixture 1, restated here as the dimension-isolation proof it actually is).
5. A step whose `after` names an undeclared step id does not throw under `checkNestedTemporalClause` (Decision 4's permissive dangling reference).
6. `ad5-admissions.test.ts`'s sixty-four-pair mutation does not throw under `checkNestedTemporalClause`: every pair is exactly one level, proving the split between the two codes is real.
7. `ad5-admissions.test.ts`'s eight-step chain mutation throws under `checkNestedTemporalClause` too, `artifactPath` naming `chain-3` (the first nested link): Decision 3's overlap, verified rather than asserted.
8. `ad5-admissions.test.ts`'s eight-step chain mutation throws under `checkScriptingBound`, `code: 'plan-exceeds-scripting-bound'`, message containing `'one-level bound'`.
9. `ad5-admissions.test.ts`'s sixty-four-pair mutation throws under `checkScriptingBound`, message containing `'disjoint'`, not `'width'` or `'one-level'` — proving the dimension that actually fired.
10. A custom fixture — one root step anchoring three children (`WIDTH_MAX + 1`) — throws under `checkScriptingBound`, message containing `'anchors 3 other steps'`, and does **not** throw under `checkNestedTemporalClause`.
11. A custom fixture — one root step anchoring exactly two children (`WIDTH_MAX`) — does **not** throw under `checkScriptingBound`: the boundary-inclusive proof paired with fixture 10.
12. A custom fixture — three separate anchors, each with exactly two children (six leaf steps, `maxWidth` staying at `WIDTH_MAX`) — throws under `checkScriptingBound`, message containing `'3 steps each anchor'`, proving `sharedAnchorCount` fires independently of `maxWidth`.
13. A custom fixture — seventeen fully isolated steps (`STEP_COUNT_MAX + 1`), no `after` relationships at all — throws under `checkScriptingBound`, message containing `'declares 17 steps'`, with every other dimension at its zero value (proven by asserting the message names step count, not width, shared anchors, or disjoint pairs).
14. A step whose `after` names an undeclared step id does not throw under `checkScriptingBound` either: the dangling reference contributes no edge to the graph, matching fixture 5's identical proof for the other function.
15. A two-step cycle (`a.after: 'b'`, `b.after: 'a'`) throws under both `checkNestedTemporalClause` and `checkScriptingBound`, the latter's message containing `'one-level bound'`: Decision 1's no-separate-cycle-detection proof, verified rather than asserted.
16. The `artifactPath` on a thrown `plan-exceeds-scripting-bound` is exactly `'EvalContract.interactionPlan'` (the whole plan, never one step) — contrasted directly against `nested-temporal-clause`'s per-step `artifactPath` in fixture 3.
17. A custom fixture — two separate anchors, each with exactly two children (four leaf steps, `sharedAnchorCount` sitting at exactly `SHARED_ANCHOR_MAX`) — does **not** throw under `checkScriptingBound`: the boundary-inclusive proof for `sharedAnchorCount`, paired with fixture 12's three-anchor reject (TEA review, Decision 7).
18. A custom fixture — four mutually disjoint two-step pairs (`disjointPairCount` sitting at exactly `DISJOINT_PAIR_MAX`) — does **not** throw under `checkScriptingBound`: the boundary-inclusive proof for `disjointPairCount`, paired with fixture 9's sixty-four-pair reject (TEA review, Decision 7).
19. A custom fixture — sixteen fully isolated steps (`stepCount` sitting at exactly `STEP_COUNT_MAX`) — does **not** throw under `checkScriptingBound`: the boundary-inclusive proof for `stepCount`, paired with fixture 13's seventeen-step reject (TEA review, Decision 7).
20. **(Added in review.)** A custom fixture — two distinct steps sharing one `stepId`, each with its own distinct, unambiguous `after` naming a different root — throws under `checkScriptingBound` with `disjointPairCount` counting both as separate pairs, proving the two steps' edges are never merged into one graph node keyed on the shared id (Decision 6's qualification: `buildPlanIndex` reuse closes the `after`-target duplicate-id gap, not `computeGraphMetrics`'s own node identity, which is keyed on array position instead).
21. **(Added in review.)** A custom fixture — four genuine disjoint two-step pairs plus one three-node component (one anchor, two children) — does **not** throw under `checkScriptingBound`: pins `disjointPairCount`'s `size === 2` test against a regression to `size >= 2`, which would wrongly count the three-node component as a fifth pair and push the total past `DISJOINT_PAIR_MAX`.
22. **(Added in round-2 review.)** A step naming its own `stepId` as `after` (a self-loop) throws under both checks, and the connected-component scan does not loop forever on the resulting self-referential adjacency entry.
23. **(Added in round-2 review.)** A step naming a later-declared step as its `after` (a forward reference) passes both checks, since neither reads declaration order: AC 1 item 7's claim, verified rather than asserted.
24. **(Added in round-2 review.)** A plan violating both `WIDTH_MAX` and `STEP_COUNT_MAX` at once reports the width message, pinning the ternary's fixed reporting priority (depth, width, shared anchors, disjoint pairs, step count) against a regression that reorders it.
25. **(Added in round-2 review.)** An empty `interactionPlan` passes both checks.
26. **(Added in round-2 review.)** A step whose declared parent itself has a dangling `after` does not throw under either check: the parent's own unresolved clause reads as no clause at all, matching Decision 4's stated intent rather than the parent's raw `after` field (round-2 finding: the implementation checked the parent's raw field, not whether it resolved, until this round; see Decision 4's addendum and Review Findings below).

### AC 4: The gate

- `npm run check:docs` and `npm test` run and the baseline is recorded **before the first edit**.
- `npm run validate` passes at the end: typecheck, lint, `check:docs`, `check:shareable`, `lint:spine`, `check:vectors`, `check:schemas`, `check:ad5-registry`. This story touches no spine text and adds no new `FailureCode` member (both codes it throws are already in `FAILURE_CODES`), so `lint:spine` and `check:ad5-registry` are expected no-ops. Run them anyway.
- `src/index.ts` is not touched: neither export is part of the published library surface yet, matching every prior Epic 4 story's own identical note.

## Tasks / Subtasks

- [x] Task 1: preflight (AC 4)
  - [x] Run `npm run check:docs` and `npm test`; record the baseline test count before the first edit.
- [x] Task 2: `scripting-bound.ts` (AC 2)
  - [x] `parentOf`, `planIndexOf`, `checkNestedTemporalClause`.
  - [x] `computeGraphMetrics`, `checkScriptingBound`.
- [x] Task 3: fixtures and tests (AC 3)
  - [x] `tests/compile/scripting-bound.test.ts`: fixtures 1-19, plus 20-21 added in code review.
- [x] Task 4: the gate (AC 4)
  - [x] `npm run validate` green.
- [x] Task 5: record
  - [x] `_bmad-output/project-knowledge/learning-path-step-by-step.md`: one new row, following `learning-path-template.md`'s exact shape, after this story is marked done.
  - [x] Dev Agent Record: measured counts, any decision that moved from this story's default.

## Decisions taken during story creation

Each is settled with a stated default and its downstream consequence. Per this project's standing convention (settle ambiguities in the story or the code, record the reasoning, do not escalate to a new architecture revision), proceed unless the user amends one; record the outcome in the Dev Agent Record.

1. **The four numeric bounds (`WIDTH_MAX=2`, `SHARED_ANCHOR_MAX=2`, `DISJOINT_PAIR_MAX=4`, `STEP_COUNT_MAX=16`) are authored against this codebase's own fixtures rather than derived from calibration data, because the data that would derive them more precisely — AD-3's transcribed calibration corpus — does not exist yet (the spine's own "Calibration closure" section: "fixture debt and a scope limit, not an epic gate"). AD-5 itself says the boundary "is calibrated against authored adversarial fixtures, because the arm revision 4 cited never existed" and that "the count that gets through them is the boundary's stated strength."** Each bound is set with the two already-shipped whole-contract fixtures (`populatedContract`, `gateCContract`) as the accept floor and the two epic-named adversarial shapes (the eight-step chain, the sixty-four-pair plan) as the reject ceiling, with headroom stated per constant: `WIDTH_MAX` sits exactly at `gateCContract`'s own maximum fan-out rather than above it, since that is the one dimension a real fixture actually calibrates; the other three have no real-fixture data point above zero, so they are set at a small multiple of what a single legitimate multi-step behaviour plausibly needs (one shared anchor, one witness pair) rather than at an arbitrary round number. Considered and rejected: leaving the four bounds uncalibrated pending the transcribed corpus, i.e. deferring this story. Rejected because AD-38 names stage one (`compile` and `seal`) as needing AD-39 with "nothing else," the corpus is explicitly not a stage-one gate, and a predicate is exactly what AD-5 says replaces "a phrase they must interpret" — an unimplemented predicate is the phrase. **Consequence:** if a future contract's own legitimate multi-behaviour plan needs more than two anchors sharing children or more than four independent witness pairs, that is new calibration evidence a later story raises against these four constants specifically, not a case for widening the predicate's shape. **Addendum (found in round-2 review):** the four multiples over their real-fixture baseline are not uniform (`SHARED_ANCHOR_MAX` is 2x `gateCContract`'s 1, `DISJOINT_PAIR_MAX` is 4x `populatedContract`'s 1, `STEP_COUNT_MAX` is roughly 2.7x `gateCContract`'s 6) because `sharedAnchorCount` (anchors past a per-anchor child threshold) and `disjointPairCount` (whole components at an exact size) are structurally different kinds of quantity, not one formula applied twice; each constant now carries its own inline comment in `scripting-bound.ts` stating the multiple it actually uses, rather than leaving a reader of the source alone to reconstruct the arithmetic from this decision's prose.

2. **`checkScriptingBound`'s depth dimension reuses `checkNestedTemporalClause`'s exact one-hop test (`hasNestedChain`) rather than computing full chain depth via a separate recursive or memoized walk.** At a fixed bound of exactly one level the two conditions are provably equivalent: if no step's parent itself carries a temporal clause, then no step has a grandparent, so no chain can exceed depth one — and a cycle of any length needs every member to have a parent with its own non-null `after`, which the one-hop test catches on the very first member it visits, with no separate cycle-sentinel or memoization needed. Considered and rejected: a memoized recursive depth calculator (`Map<stepId, number>` cache with an in-progress sentinel for cycle detection), mirroring the general shape a variable bound would need. Rejected as solving a problem this fixed bound does not have — Story 4.2's own Decision 1 precedent (`substitutePointer`'s string concatenation over a decode/re-encode round trip) for the identical judgment: the smallest correct mechanism over a symmetrical-looking one. **Consequence:** `computeGraphMetrics` is a single O(n) pass with no recursion; a future story loosening `DEPTH_MAX` past 1 would need to restore a real depth walk, and this decision says so explicitly rather than leaving the simplification to be rediscovered as a latent bug.

3. **`checkNestedTemporalClause` and `checkScriptingBound`'s depth dimension are independent, non-coordinating checks that both fire on the eight-step chain fixture, and this overlap is intentional.** Matches Story 4.2 Decision 7's "no cross-function ordering" convention, applied here across two codes rather than within one function's dimensions. Considered and rejected: having `checkScriptingBound` skip its own depth check and delegate to `checkNestedTemporalClause`, so only one code could ever fire on a nesting violation. Rejected for the same reason Story 4.2 Decision 5 rejected the equivalent coupling between `checkReferenceSetResolution` and `checkOperandLegality`: it would make one standalone check depend on another's internals for a condition entirely within its own declared scope. **Consequence:** a caller invoking only `checkScriptingBound` (skipping `checkNestedTemporalClause` entirely) still correctly rejects a nested chain under its own code; Story 4.4's orchestrator decides whether both run and, if so, in what order.

4. **A dangling `after` reference — naming a step id the plan does not declare, including one made unresolvable by a duplicate id — is silently treated as "no temporal clause" and contributes no edge to the graph, in both functions.** Extends `undeclared-mandatory-input`'s (Story 4.2, AC 5) identical precedent for a step naming an undeclared *operation* id to a step naming an undeclared *step* id in its own `after` field. No AD-5 code names this condition, so it is not invented here. Considered and rejected: throwing a `TypeError` (matching `resolveStep`'s "should-never-happen precondition violation" convention in `plan-index.ts`) for a dangling `after`. Rejected because a dangling `after` is schema-legal input a compiler must handle gracefully, not a same-codebase precondition violation — `evaluatePointerReachability` already resolves an unreachable step to a coded rejection rather than a thrown `TypeError`, and this field has no AD-5 code assigned to a dangling identifier the way that one does. **Consequence:** a step with a dangling `after` passes both of this story's checks regardless of what else the plan contains; a future story naming a code for this condition supersedes this decision rather than needing to rediscover the gap. **Qualification (found in round-2 review): this decision's "in both functions" claim was underimplemented for one shape until this round.** A step whose *own* `after` is dangling was always handled as this decision states. But a step whose declared *parent's* `after` is dangling was not: both functions tested the parent's raw `after !== null` field to decide whether the parent "carries a temporal clause," so a step naming a dangling-`after` parent as its own parent still tripped `nested-temporal-clause`/`plan-exceeds-scripting-bound`, contradicting this decision's stated "no temporal clause" treatment for the dangling step. Fixed by having both checks test `parentOf(parent, index) !== undefined` (does the parent's own `after` resolve) rather than `parent.after !== null` (is the parent's own `after` merely non-null) — still one index lookup, no recursion, so Decision 2's O(1) equivalence proof is unaffected. `tests/compile/scripting-bound.test.ts` fixture 26 pins the corrected behavior.

5. **"Exhaustive operation inventories" is implemented as a flat bound on total step count (`STEP_COUNT_MAX`) rather than an operation-coverage ratio.** Both already-shipped whole-contract fixtures reach full or near-full operation-inventory coverage at very small step counts — `gateCContract` declares exactly three operations and its six steps invoke all three — so a coverage-ratio metric would need a second, independently-calibrated repetition threshold layered on top just to avoid false-positiving on `gateCContract` itself, which is exactly the two-knobs-for-one-signal problem a flat step-count bound avoids. Considered and rejected: `distinct operations invoked / operations declared >= threshold AND stepCount >= minimum`. Rejected as strictly more complex for no discriminating power any fixture in this repository, real or adversarial, can prove: nothing here separates "invoked every declared operation" from "declared many steps," so the simpler metric is not a weaker one. **Consequence:** a plan with very few declared operations, each invoked many times without ever exceeding sixteen total steps, is not flagged by this dimension — a case no fixture in this story or its predecessors presents, and one a future story can name explicitly if it arises.

6. **Both functions reuse `buildPlanIndex(..., { duplicateIds: 'unresolved' })` for step-id resolution rather than a private `Map`.** Matches Story 4.2's own established pattern of reusing Story 4.1 infrastructure (`makePointerDenotesCollection`, `buildPlanIndex` itself) rather than rebuilding it, and gets duplicate-step-id handling for free rather than needing this story to invent its own **on the `after`-target resolution side**: an `after` value naming an ambiguous id resolves to `undefined` via `stepOf`, with no code here needing to detect the ambiguity itself. Considered and rejected: a plain `Map(plan.map(s => [s.stepId, s]))`, since neither function needs `PlanIndex`'s operation-resolution half. Rejected because a plain `Map` silently lets a later duplicate step id overwrite an earlier one rather than making the id unresolvable, which is a worse answer than the one `buildPlanIndex` already ships and tests (`tests/seal/plan-index.test.ts`). **Qualification (found in review): this closes only the `after`-target side.** `computeGraphMetrics`'s own graph-node identity is a separate question `buildPlanIndex` does not touch at all — its internal `children`/`adjacency`/`visited` maps originally keyed nodes on `step.stepId` too, which silently merged two distinct steps sharing one id into a single adjacency entry. That half is not "for free" from this reuse; it needed its own fix, keying every internal map on each step's array position instead (see AC 2's updated code block and `computeGraphMetrics`'s own doc comment). **Consequence:** a plan with duplicate step ids never has an ambiguous id resolve to either candidate in either function; it resolves to `undefined` and falls into Decision 4's permissive dangling-reference path. Separately, two steps sharing one id but each carrying its own distinct, unambiguous `after` are never merged into one graph node, so their edges count independently toward width/shared-anchor/disjoint-pair metrics (`tests/compile/scripting-bound.test.ts` fixture 20).

7. **`checkScriptingBound`'s boundary-inclusive proof (fixture 10/11's "exactly at `WIDTH_MAX` passes, one past throws" pairing) is extended to the other three non-depth bounds (`SHARED_ANCHOR_MAX`, `DISJOINT_PAIR_MAX`, `STEP_COUNT_MAX`) via fixtures 17-19, rather than relying on the two whole-contract accept fixtures to cover the boundary.** Raised in TEA review: `gateCContract` and `populatedContract` sit at `sharedAnchorCount∈{0,1}`, `disjointPairCount∈{0,1}`, `stepCount∈{2,6}` — none reaches its bound, so a comparison mutated from `>` to `>=` on any of those three metrics would ship undetected despite the story's own "a metric sitting exactly at its bound is legal, not a violation" claim being untested for 3 of 4 metrics. Considered and rejected: leaving the gap, since fixtures 12/9/13 already prove the "one past the bound, throws" side. Rejected because that side alone doesn't distinguish `>` from `>=`; only the paired at-bound/over-bound proof does, which is exactly the pattern already applied to `WIDTH_MAX`. **Consequence:** all four non-depth bounds now carry the same two-sided proof; no asymmetry between `WIDTH_MAX` and the other three remains for a future reader to question.

## Dev Notes

### Read these files before writing anything

1. `src/core/compile/waivers.ts` and `declarations.ts`, in full: the smallest existing examples of this story's exact shape — walk a contract field once, throw `StructuralFailure` on the first violation. This story is the same shape at plan-graph scale rather than array or tree scale.
2. `src/core/seal/plan-index.ts`, in full, especially `buildPlanIndex`'s `duplicateIds` option and `tests/seal/plan-index.test.ts`'s own fixture for it: reused directly rather than reimplemented.
3. `src/core/seal/scripting-audit.ts`, in full: the sibling `brief-exceeds-scripting-bound` check. Its own header comment names this story by number as the declaration-side half it cannot see; read it to keep the two checks' framing (pre-generation over declarations vs. post-generation over rendered prose) consistent rather than accidentally duplicated.
4. `src/core/schemas/plan.ts`, in full: `InteractionStep.after`'s own field comment states the one-level bound is deliberately unenforced in Zod and names this story as the one that enforces it.
5. `ARCHITECTURE-SPINE.md` AD-39 (lines 493-501) and AD-5's registry table (lines 203-241) in full: AD-39's own worked counterexample (the eight-step chain, the sixty-four pairs, "verified by execution against revision 4") is the exact adversarial shape this story's fixtures reuse; AD-5's "calibrated against authored adversarial fixtures" paragraph (lines 239) is Decision 1's own citation.
6. `tests/schemas/ad5-admissions.test.ts` lines 188-232, in full: the four already-admitted mutations (one `nested-temporal-clause`, two `plan-exceeds-scripting-bound`) this story's checks must reject. Reuse these exact mutations rather than inventing new ones for the two required shapes.
7. `tests/schemas/plan.test.ts` line 112-123: confirms the three-step chain shape parses at the schema level, with its own comment naming this story as the one that rejects it at compile time.
8. `tests/schemas/fixtures/relevance-contracts.ts` (`populatedContract`) and `gate-c-contract.ts` (`gateCContract`), in full: this story's two accept fixtures. AC 2's own "verified against both whole-contract fixtures" note above was checked by hand against these two files' literal `interactionPlan` content while writing this story; re-verify against the files as actually read, not against this story's paraphrase, before writing the fixtures.
9. `_bmad-output/implementation-artifacts/4-2-the-ad-5-registry-as-code-and-the-structural-compile-checks.md`, in full: house style, the `Object.hasOwn`/precondition-skip/"assumed compile-time-prevented" conventions this story inherits without restating their own reasoning, and the exact shape a Decisions section and a Dev Agent Record take in this codebase.

### Project structure notes

- One new file, `src/core/compile/scripting-bound.ts` (matching the existing five modules' location), one new test file, `tests/compile/scripting-bound.test.ts`. No file this story touches is deleted or renamed.
- No `core/schemas/` edit at all: no new declaration, no new value space, no spine text implicated, no `FailureCode` member added — `EvalContract.interactionPlan`'s own field comment already names this story as needing no schema change.
- `src/index.ts` not touched (AC 4), same rule as every prior Epic 4 story.

### Testing requirements

- `tsconfig.json`'s `noUncheckedIndexedAccess` applies to `children.get(...)`, `adjacency.get(...)`, and `stack.pop()`; guard each with an explicit check, matching this story's own code blocks.
- `biome.json`'s `useImportType`/`useExportType`: `EvalContract`, `InteractionStep`, and `PlanIndex` are imported with `type` wherever used only as a type.
- Import `structuralFailureOf` from `./helpers.ts` rather than redeclaring it locally, matching `expression-legality.test.ts`/`oracle-alignment.test.ts`/`forbidden-inputs.test.ts`'s newer convention over `declarations.test.ts`/`waivers.test.ts`'s older one.
- No configured coverage threshold, matching every prior story's own note: the proxy is AC 3's fixture list plus assertions specific enough to fail if the property they name is removed.

### References

- `_bmad-output/planning-artifacts/epics.md`: Epic 4 intro (321-323), Story 4.3 (349-360).
- `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md`: AD-5 (203-241, the registry table and its "calibrated against authored adversarial fixtures" paragraph), AD-39 (493-501), AD-38 (485-491, stage one's own list naming AD-39 as needed with "nothing else"), Owed item 2 (672-678, the score-side half this story does not touch).
- `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/EPIC-BRIEF.md`: Epic 4 (112-131), naming the required fixtures explicitly.
- `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/reviews/triage-round-three.md`: RC-4 (149-208), the round that named the five dimensions and the two required adversarial shapes, and the resolution this AD-5 paragraph implements.
- `src/core/seal/plan-index.ts`, `src/core/seal/scripting-audit.ts`, `src/core/failure-codes.ts`.
- `src/core/schemas/plan.ts`, `eval-contract.ts`.
- `tests/schemas/ad5-admissions.test.ts`, `tests/schemas/plan.test.ts`, `tests/schemas/fixtures/relevance-contracts.ts`, `tests/schemas/fixtures/gate-c-contract.ts`, `tests/compile/waivers.test.ts`, `tests/compile/helpers.ts`.
- `_bmad-output/implementation-artifacts/4-1-pointer-resolution-and-reachability.md`, `4-2-the-ad-5-registry-as-code-and-the-structural-compile-checks.md`.

## Suggested Review Order

**The depth-equivalence proof first, because it is the one place a subtle bug produces a plausible-looking wrong answer**

- `computeGraphMetrics`'s `hasNestedChain` line: confirm it is set exactly when a step's parent's own `after` is non-null, and that no separate recursive depth walk exists (Decision 2).
- The two-step-cycle fixture: confirm `computeGraphMetrics`'s connected-component scan terminates on its own — its `visited` Set runs unconditionally and is what actually prevents the infinite loop, independent of `hasNestedChain` — and separately confirm `checkScriptingBound` reports the one-level bound rather than a disjoint-pair count only because the one-hop nesting test is checked first in the ternary (found in review: the one-hop test decides which message fires first, not whether the scan itself is loop-safe).

**The three aggregate dimensions next**

- `maxWidth`/`sharedAnchorCount`: confirm `gateCContract`'s own `submit` anchor sits at exactly `WIDTH_MAX` and passes; confirm the width-exceeded and shared-anchors-exceeded fixtures each fire their own dimension in isolation (fixtures 10 and 12 must not both report the same message).
- `disjointPairCount`'s connected-component scan: confirm a component of size exactly two is counted and a component of any other size is not — `gateCContract`'s own three-node `{submit, poll, first-page}` component is the one case that must **not** count.

**`checkNestedTemporalClause`**

- Confirm it is genuinely standalone: it must reject the three-step chain fixture with no dependency on `checkScriptingBound` having run first, and vice versa (Decision 3).

**Fixtures**

- Every "verified against both whole-contract fixtures" claim in AC 2's own note: re-run `populatedContract`/`gateCContract` through the actual implementation and confirm zero throws, rather than trusting this story's own hand-verification.
- Every `ad5-admissions.test.ts` fixture this story's AC 3 claims to reuse: confirm the mutation is copied faithfully (same field path, same mutated value) rather than approximated.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5), via Claude Code.

### Debug Log References

- Preflight baseline (before the first edit): `npm run check:docs` → "55 file(s) OK"; `npm test` →
  43 files, 1689 tests passing.
- Post-implementation: `npm run validate` green end to end — typecheck, lint, `check:docs` (55
  files, unchanged), `check:shareable`, `lint:spine` (0 findings, expected no-op per AC 4),
  `check:vectors`, `check:schemas`, `check:ad5-registry` (21 codes, set- and order-equal, expected
  no-op per AC 4), and `npm test` → 44 files, 1708 tests passing (43→44 files, 1689→1708 tests:
  exactly the one new test file and 19 new fixtures this story adds).
- The new test file passed on its first run against the implementation transcribed from AC 2's own
  code block; no logic deviation was needed.
- Post-review (round 1, see Review Findings below): `npm run validate` re-run green end to end, same
  shape as above, and `npm test` → 44 files, 1710 tests passing (1708→1710: the two fixtures round 1
  added).
- Post-review (round 2, `/bmad-code-review`): `npm run validate` re-run green end to end, same shape as
  above, and `npm test` → 44 files, 1715 tests passing (1710→1715: fixtures 22-26).

### Completion Notes List

- Implemented `src/core/compile/scripting-bound.ts` exactly as AC 2's own code block specifies:
  `parentOf`, `planIndexOf`, `checkNestedTemporalClause`, `computeGraphMetrics`,
  `checkScriptingBound`, the four bound constants unchanged.
- All 7 decisions in "Decisions taken during story creation" were taken as stated; none moved from
  its recorded default.
- Implemented all 19 original AC 3 fixtures plus 2 more added in round-1 code review (fixtures 20-21)
  plus 5 more added in round-2 code review (fixtures 22-26), one `it` block per fixture, split across
  three `describe` blocks in `tests/compile/scripting-bound.test.ts`: `checkNestedTemporalClause`
  (fixtures 1, 3-7), `checkScriptingBound` (fixtures 2, 8-14, 16-21), and one block for the shared-shape
  fixtures 15, 22-26 (the two-step cycle, the self-loop, the forward reference, the priority-order
  proof, the empty plan, and the dangling-parent case, each asserted against both functions per the
  story's own text).
- Fixture 3's mutation was copied verbatim from `ad5-admissions.test.ts` (push a `third` step naming
  `list`, not the story's own AC 3 parenthetical `first`/`second`/`third` paraphrase, which describes
  `plan.test.ts`'s unrelated three-step schema-admission fixture instead): the resulting
  `artifactPath` is `interactionPlan[stepId=third].after` either way, so the story's own assertion
  holds under the fixture actually named as the reuse source.
- `EvalContract.parse(...)` is used for the two whole-fixture positive regressions (fixtures 1, 2,
  4); every mutated or custom-graph fixture follows `ad5-admissions.test.ts`'s own
  `structuredClone(...) as any` convention, matching Story 4.1/4.2's identical precedent.
- No AC, Task, or Decision was left incomplete. Nothing in `src/index.ts` was touched. No existing
  `src/` file's behavior changed: this story only adds one new file under `src/core/compile/` and
  one new test file under `tests/compile/`.
- Story Status set to `done` and `sprint-status.yaml`'s entry for this story set to `review`,
  matching Story 4.1/4.2's own recorded convention (a story file reading `done` while
  `sprint-status.yaml` reads `review` is by design, pending peer review).
- Round-2 review (`/bmad-code-review`, four parallel layers) ran against this diff and found 9 more
  findings; all nine were real and fixed (see Review Findings below). Peer review (Codex) was not run
  as part of either pass; the story is left for that stage next.

### Review Findings

Code review found 6 patch-category findings on this story's diff. All six were real and fixed.

1. **`computeGraphMetrics` keyed its internal `children`/`adjacency`/`visited` maps by raw
   `step.stepId`, which is schema-legal to duplicate.** Two distinct steps sharing one `stepId`, each
   with its own valid, distinct `after` pointing at a different anchor, silently merged into one
   shared adjacency node, corrupting `disjointPairCount`/`sharedAnchorCount`/`maxWidth`. Fixed by
   keying every internal map on each step's array **position** instead: a `Map<InteractionStep,
   number>` built from `plan.entries()` recovers a resolved parent's position from its object
   reference, safe because `index.stepOf` always returns the exact element stored in `plan`. Verified
   the bug was real before fixing it: a hand-reproduction of the old stepId-keyed logic against the
   new regression fixture's plan gave `disjointPairCount=4` (no throw, the wrong answer); the fixed
   implementation gives `6` (throws, the right one). AC 2's code block and Decision 6 updated to match
   (Decision 6's "for free" claim now scoped explicitly to the `after`-target resolution side, not
   this function's own node identity). Added fixture 20.
2. **No fixture pinned `disjointPairCount`'s `size === 2` test against a regression to `size >= 2`.**
   Every existing fixture used only size-1 or size-2 components; `gateCContract`'s one size-3
   component was only ever asserted via `not.toThrow()`, and that mutation would still not throw even
   under the wrong comparison (still under `DISJOINT_PAIR_MAX`). Added fixture 21: four genuine pairs
   plus one three-node component, asserting `not.toThrow()`, which a `size >= 2` regression would
   flip to a throw.
3. **The learning-path doc's Step 14 "Why" section misattributed AD-39's two counterexamples to the
   width dimension.** Neither the eight-step chain nor the sixty-four-pair plan is caught by width:
   the chain fails on nesting/depth (`'one-level bound'`), the 64 pairs on disjoint-pair count
   (`'disjoint'`), exactly as fixtures 8 and 9 assert. Rewrote the paragraph to attribute each
   correctly and named width as guarding a third, separate shape neither example exercises.
4. **AC 1's "the last two of AD-5's twenty-one codes" overstated completeness.** Three rubric codes
   (`rubric-unanchored`, `rubric-evidence-unreachable`, `rubric-scores-reasoning-prose`) still have no
   thrower anywhere in `src/`, deferred to Epic 6 Story 6.3
   (`6-3-rubric-compilation-under-checked-rules`). Reworded AC 1's opening line to scope the claim to
   AD-5's stage-one/compile-owned codes and added a new "does not build" item naming the three rubric
   codes explicitly, rather than leaving the overstatement to be discovered by grepping `src/`.
5. **Forward-declared `after` (a step naming a later-declared step as its temporal parent) was an
   unnamed exclusion.** `plan.ts`'s own field comment calls the target "the identifier of an earlier
   step," but neither check reads declaration order, so a forward reference is accepted silently. No
   AD-5 code covers this (confirmed against the registry), so this story correctly can't invent one —
   but AC 1's "each is named rather than silently dropped" claim needed this one actually named. Added
   a new "does not build" item, mirroring Decision 4's own framing.
6. **The Suggested Review Order misattributed the two-step-cycle fixture's loop safety to the one-hop
   nesting test.** The actual mechanism is `computeGraphMetrics`'s own unconditional `visited` Set in
   the connected-component scan, which runs regardless of `hasNestedChain`; the one-hop test only
   decides which violation message reports first (nesting, since it's checked first in the ternary).
   Reworded the bullet to attribute loop-safety to `visited` and scope the one-hop test's role
   correctly.

**Round 2 (`/bmad-code-review`, four parallel layers — Blind Hunter, Edge Case Hunter, Verification
Gap, Acceptance Auditor). Nine more findings, all real and fixed.**

7. **A step whose declared parent itself had a dangling `after` still tripped `nested-temporal-clause`
   and `plan-exceeds-scripting-bound`, contradicting Decision 4's stated "silently treated as no
   temporal clause" claim.** (Verification Gap.) Both functions tested the parent's raw `after !== null`
   field rather than whether it actually resolved. Fixed by testing `parentOf(parent, index) !==
   undefined` instead, in both `checkNestedTemporalClause` and `computeGraphMetrics`'s `hasNestedChain`
   line: one extra index lookup, still no recursion, Decision 2's equivalence proof unaffected. Decision
   4 carries a qualification recording this. Added fixture 26.
8. **The `parentPosition === undefined` branch in `computeGraphMetrics` was commented `// unreachable`
   but silently `continue`d rather than asserting it.** (Edge Case Hunter.) A future caller violating the
   plan/index pairing this branch depends on would have every dropped edge under-count
   `maxWidth`/`sharedAnchorCount`/`disjointPairCount` with no signal. Changed to throw a `TypeError`,
   matching `resolveStep`'s own "should-never-happen precondition violation" convention
   (`plan-index.ts`) that Decision 4 already cites for this file.
9. **No fixture exercised a self-referential `after` (a step naming its own `stepId`).** (Blind Hunter.)
   The degenerate one-node cycle shape is distinct from fixture 15's two-node cycle and was unverified.
   Added fixture 22.
10. **AC 1 item 7's forward-declared-`after` permissiveness claim ("a step may legally name a
    *later*-declared step as its temporal parent and both checks accept it silently") had no fixture,
    unlike Decision 4's dangling-reference claim.** (Blind Hunter.) Added fixture 23.
11. **No fixture forced two `checkScriptingBound` dimensions to exceed their bound in the same plan, so
    the ternary's fixed reporting priority (depth, width, shared anchors, disjoint pairs, step count)
    was only asserted in the Suggested Review Order's prose, never pinned by a test.** (Blind Hunter.)
    Added fixture 24 (width and step count both violated; message reports width).
12. **The `plan-exceeds-scripting-bound` step-count message used an em dash, the only one in any thrown
    message in `src/core/compile/`.** (Blind Hunter, Acceptance Auditor.) Replaced with a colon.
13. **`computeGraphMetrics` took the whole `EvalContract` but only ever read
    `contract.interactionPlan`.** (Blind Hunter.) Narrowed its first parameter to `readonly
    InteractionStep[]`; `checkScriptingBound` now passes `contract.interactionPlan` directly. Removes an
    unnecessary coupling to the full contract type for a private helper.
14. **Decision 1's four bound multiples over their real-fixture baseline are not uniform, and neither
    the decision's prose nor the constants' inline comments said why.** (Blind Hunter.)
    `sharedAnchorCount` and `disjointPairCount` are structurally different kinds of quantity (a
    per-anchor threshold vs. a whole-component size), which is part of why their headroom differs.
    Added an inline comment to `SHARED_ANCHOR_MAX` and `STEP_COUNT_MAX` (matching the existing
    `WIDTH_MAX`/`DISJOINT_PAIR_MAX` comments) and an addendum to Decision 1.
15. **The second Suggested Review Order's line-anchor links had drifted from the exact lines they
    described** (e.g. `scripting-bound.ts:172` landed on the closing `if`, not the ternary's own start).
    (Acceptance Auditor.) Re-derived against the file as it now reads; see below.

Also noted, evaluated, and not actioned: (a) the working tree carried an unstaged, out-of-scope
comment-trimming pass on `scripting-bound.ts` from an earlier tool run, discovered mid-review
(Acceptance Auditor); kept, since it only removed em dashes and shortened prose with no logic change,
consistent with this project's own no-em-dash/lean-comment conventions, and superseded by this round's
own edits regardless; (b) the `contract`/`index` parameter-pairing invariant `computeGraphMetrics`
depends on (Blind Hunter): finding 8 above converts its one failure mode from a silent under-count into
a loud `TypeError`, which is this private helper's actual exposure; a type-level fix would be
over-engineering for a two-call-site internal function; (c) `checkNestedTemporalClause` and
`checkScriptingBound` each independently rebuild the plan index (Blind Hunter); sharing one is
orchestration-shaped work this story's own AC 1 item 1 already assigns to Story 4.4, not this story; (d)
custom test fixtures bypass `EvalContract.parse` (Blind Hunter); matches this codebase's own established
`ad5-admissions.test.ts` convention this story's Dev Notes already cites, not a defect.

### File List

- `src/core/compile/scripting-bound.ts` (new; `computeGraphMetrics` revised in review round 1 finding 1
  and round 2 findings 7-9, 12-13)
- `tests/compile/scripting-bound.test.ts` (new; fixtures 20-21 added in round 1 findings 1-2, fixtures
  22-26 added in round 2 findings 7, 9-11)
- `_bmad-output/project-knowledge/learning-path-step-by-step.md` (Step 14 added; revised in round 1
  findings 3-4)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (this story's entry: `review`)

## Suggested Review Order

**The graph predicate itself, and the duplicate-id bug round 1 fixed in it**

- Entry point: the two exported checks, and the one-hop nesting test that also doubles as `checkScriptingBound`'s depth dimension. Now tests `parentOf(parent, index) !== undefined` (resolved) rather than `parent.after !== null` (raw): round 2 finding 7.
  [`scripting-bound.ts:47`](../../src/core/compile/scripting-bound.ts#L47)

- Every internal map is keyed by array position, not `stepId`, because `stepId` is schema-legal to duplicate: round 1's bug fix. The "unreachable" `parentPosition` branch now throws instead of silently continuing: round 2 finding 8.
  [`scripting-bound.ts:89`](../../src/core/compile/scripting-bound.ts#L89)

- The five-dimension priority ternary: depth, then width, shared anchors, disjoint pairs, step count, in that fixed order, now pinned by fixture 24 (round 2 finding 11).
  [`scripting-bound.ts:171`](../../src/core/compile/scripting-bound.ts#L171)

**Fixtures proving the graph predicate, including the seven the two review rounds added**

- The 19 originally-planned fixtures across both checks and the shared cycle case.
  [`scripting-bound.test.ts:82`](../../tests/compile/scripting-bound.test.ts#L82)

- Fixture 20: two steps sharing one `stepId`, each with a different valid anchor, count as two separate pairs rather than merging into one graph node (round 1).
  [`scripting-bound.test.ts:252`](../../tests/compile/scripting-bound.test.ts#L252)

- Fixture 21: a three-node component beside four genuine pairs — pins `disjointPairCount`'s `size === 2` test against a `size >= 2` regression (round 1).
  [`scripting-bound.test.ts:280`](../../tests/compile/scripting-bound.test.ts#L280)

- Fixtures 22-26 (round 2): a self-loop, a forward reference, the width-vs-step-count priority proof, an empty plan, and a step whose parent has a dangling `after`.
  [`scripting-bound.test.ts:317`](../../tests/compile/scripting-bound.test.ts#L317)

**Documentation kept honest with the actual behavior**

- Step 14's corrected attribution: the eight-step chain fails on nesting, the sixty-four pairs on disjoint-pair count, neither on width (round 1).
  [`learning-path-step-by-step.md:994`](../project-knowledge/learning-path-step-by-step.md#L994)
