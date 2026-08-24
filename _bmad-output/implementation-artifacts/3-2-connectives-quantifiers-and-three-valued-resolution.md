---
epic: 3
story: 2
key: 3-2-connectives-quantifiers-and-three-valued-resolution
baseline_commit: f3ff75e9ed6454c275fdc284acf2ad9ee7900257
---

# Story 3.2: Connectives, quantifiers, and three-valued resolution

Status: ready-for-dev

## Story

As the discipline's fail-closed guarantee,
I want three-valued resolution with total, non-absorbing propagation,
so that logically equivalent spellings of one intent agree on empty evidence and no oracle is
discharged by an absence of evidence.

## Acceptance Criteria

### AC 1 — Module location, scope, and what this story does not build

**`src/core/evaluate/resolution.ts`, alongside Story 3.1's `resolved-value.ts` and `operators.ts`.**
Same directory, same reasoning: AD-4's whole vocabulary — the ten scalar/structural operators, the
three connectives, the two quantifiers, and the three-valued resolution wrapper — is one capability
under the Capability → Architecture Map's VFR-2 row, and Story 3.1's placement argument (the map, not
just the epic-scope sentence, is load-bearing; see its Decision 10) applies unchanged here. `core/`
still imports `core/schemas` only, plus `core/canonical` for the one exception Story 3.1 already took.
This story adds no new exception.

**This story walks an `Expression` tree (`src/core/schemas/expression.ts`) and produces one
`CheckResolutionValue` (`src/core/schemas/evidence-artifact.ts:47-74`).** Read both types in full before
writing anything. `CheckResolutionValue` already exists, shipped by Epic 1, with the comment "Epic 3
populates it" — this story is that population, for every node except `covers-by-key` (Story 3.3's).

**What this story does not build, and why, stated once so every AC below can assume it:**

1. **Real pointer resolution — of any of the three operand forms, including the bound-element (`@/`)
   form inside a quantifier predicate.** Story 3.1's AC 1 already deferred `{ pointer }` and
   `{ referenceSet }` resolution to Story 4.1 ("Pointer resolution and reachability"), reasoning that
   epics are sequenced so no story depends on a later epic's output. That reasoning covers `@/` too:
   Story 4.1's own AC (epics.md line 335) states plainly that its "one implementation of the addressing
   grammar" is what makes "the reachability check and any future evaluator read the same expression
   identically," and its Given/When/Then names `@/` binding as part of that one implementation ("`@/`
   binds only inside quantifiers"). This story is the "future evaluator" that sentence is written for.
   Building `@/` resolution twice — once ad hoc here, once for real in Story 4.1 — is exactly the
   two-vocabulary drift AD-26 exists to prevent, so this story does not build it, even though its own
   quantifier fixtures (AC 7) need *something* to resolve `@/retractedAt` against a bound element to be
   testable at all. See Decision 2 for how that tension is resolved: an injected capability this story
   defines and consumes, plus a small test-only stub in this story's own fixtures, never shipped from
   `src/`.
2. **Reference-set lookup.** Same story, same source (Story 3.1 AC 1), unchanged here.
3. **`covers-by-key`.** Story 3.3's own title and scope. It is a member of the `Expression` union
   already (`expression.ts:79`, `:197-201`), so this story's tree-walker's dispatch structurally has to
   have *some* branch for it, but no operator function exists yet to call. See Decision 5.
4. **Mapping `insufficient-evidence` (or `true`/`false`) onto an outcome state.** Unchanged from Story
   3.1 AC 1: `abstained` is AD-6's, AD-6 is score-side, and Epic 3's own epics.md intro says "this epic
   stops at resolution and records it" (epics.md line 276). This story's public function returns a
   `CheckResolutionValue`. It never returns, computes, or references an `OutcomeState`.
5. **The scoring-policy `regexMatchStepBudget` field or the `RuntimeFaultCode` registry.** Both shipped
   in Story 3.1. This story's leaf dispatch reads `regexMatchStepBudget` as a plain parameter (AC 6); it
   adds no new field and no new fault code, because propagation itself never faults — every one of AD-4's
   propagation rules below is a total function over three closed inputs, and the only fault surface this
   story's code touches is `regexMatch`'s own, already-shipped one, propagated undecorated.

**Purity (AD-1), unchanged from Story 3.1.** Synchronous, deterministic, pure. No filesystem, network,
clock, subprocess, randomness.

### AC 2 — The injected resolution capabilities: `ResolveOperand` and `PointerDenotesCollection`

This is this story's own consumer-side contract, the same relationship Story 3.1's `ResolvedValue` type
has to Story 4.1's future resolver (Decision 2 explains why two capabilities, not one, and why they take
exactly this shape):

```ts
import type { Operand } from '../schemas/expression.ts'
import type { JsonValue } from '../schemas/primitives.ts'
import type { ResolvedValue } from './resolved-value.ts'

/**
 * Resolves one operand to its evidence value. `boundElement` is the element a
 * quantifier currently has bound, or `null` outside any quantifier's
 * predicate — this is the one piece of state `resolveCheck` threads through
 * so an operand carrying the bound-element pointer form (`@/…`) has something
 * to resolve against. Interpreting `@/…` is the implementation's job, not
 * this type's: AD-26's addressing grammar, including this form, is Story
 * 4.1's, and this story only defines the shape a later resolver fills.
 */
export type ResolveOperand = (
  operand: Operand,
  boundElement: JsonValue | null,
  artifactPath: string,
) => ResolvedValue

/**
 * Whether a `{ pointer }` operand's own declared response descriptor types it
 * as a collection (AD-4's absent-collection-typed rule, `ARCHITECTURE-SPINE.md:191`).
 * Consulted only when `resolveOperand` returns `ABSENT` for a `{ pointer }`
 * operand: every other operand form is exempt (Decision 3). Takes the raw
 * pointer string rather than the whole `Operand`, since only the `{ pointer }`
 * branch of the union ever calls it.
 */
export type PointerDenotesCollection = (pointer: string) => boolean
```

Both are parameters `resolveCheck` (AC 6) takes, never something this story builds a real
implementation of. This module exports the two types and nothing that implements them: no fixture
resolver ships from `src/`, matching Story 3.1's own restraint (its fixtures "hand-construct
resolved-value inputs," never a resolver). This story's own tests (AC 7, AC 8) supply a small,
explicitly test-only stub next to the tests, never exported from `src/`.

### AC 3 — The empty-collection introduction condition, applied uniformly per operand

AD-4: *"Resolution is three-valued, and the third value is an invariant over operands rather than a
rule about particular operators … the value arrives for every operator now in the closed set … without
a further decision"* (`ARCHITECTURE-SPINE.md:191`). Read literally and applied uniformly (Decision 1):
**every operand of every leaf node** (every one of Story 3.1's ten operators, and every quantifier's own
`collection` field) is checked for this condition before the node's `true`/`false` answer is trusted.

```ts
/** AD-4's one closed introduction condition, checked per operand. */
function operandDenotesEmptyCollection(
  resolved: ResolvedValue,
  operand: Operand,
  pointerDenotesCollection: PointerDenotesCollection,
): boolean {
  if (Array.isArray(resolved) && resolved.length === 0) return true
  if (resolved !== ABSENT) return false
  // ABSENT: only a `{ pointer }` operand can carry a declared collection type
  // (Decision 3) — `{ literal }` never resolves ABSENT, and `{ referenceSet }`
  // resolving ABSENT would be `unresolved-reference-set`, a compile-time
  // failure this story assumes already happened upstream.
  return 'pointer' in operand && pointerDenotesCollection(operand.pointer)
}
```

- **A single tripped operand is sufficient.** AD-4's own text is singular ("an operand denoting a
  collection that is empty"), not "every operand" or "the operator's primary operand." A leaf node with
  two operands, only one of which is empty, still resolves `insufficient-evidence` for the whole node.
  `equality`'s and `containment`'s and `set-membership`'s and `covers-by-key`'s own spine-text worked
  examples (the `covers-by-key`-over-two-empty-collections paragraph, `ARCHITECTURE-SPINE.md:191`) are
  consistent with this reading: two empty operands trip it exactly as one does, and nothing in that text
  requires both.
- **When the condition trips, the node's own two-valued operator function is never called.** Its
  `true`/`false` answer, had it been computed, is discarded in favor of `insufficient-evidence`. This is
  the "wrapper intercepts before this runs on a genuinely empty collection" Story 3.1 documents on
  `countTolerance`'s and `ordering`'s own doc comments and assumes as their caller's job (Decision 6):
  `ordering([])` and `countTolerance([], …)` both return a bare `true`/pass-or-fail from their own loop
  bounds with no special case for zero elements, and it is this story's wrapper, not their code, that
  turns a genuinely empty array into `insufficient-evidence` before either function ever sees it.
- **A quantifier's own `collection` operand is checked the same way, with one exception stated in
  Decision 3: `ABSENT` there is unconditionally treated as collection-typed**, regardless of what
  `pointerDenotesCollection` would say (it is not even called): a quantifier's `collection` field is by
  definition addressing a collection, so there is no ambiguity to resolve the way there is for an
  ordinary operand position.
- **`ABSENT` on a bound-element (`@/…`) leaf operand never trips the `PointerDenotesCollection` branch.**
  `'pointer' in operand` is true for a `{ pointer: "@/…" }` operand exactly as for an interaction-rooted
  one, but `pointerDenotesCollection` is written against `ResponseDescriptor.collectionLocations`
  (`interface.ts:65-70`), which has no declared surface for a field nested inside one bound element
  (Decision 3). Pass the bound-element pointer through unchanged: `pointerDenotesCollection` is free to
  return `false` for any string starting with `@`, and this story's own stub does exactly that; a real
  Story 4.1 implementation may do better once the schema grows a surface for it, without this story's
  code changing.

### AC 4 — Connective propagation: `not`, `all`, `any`

Every propagation rule below is copied verbatim from AD-4's own stated formulas
(`ARCHITECTURE-SPINE.md:191`, the "Propagation is total…" paragraph); this AC does not invent new
semantics, only states them as code:

```ts
type Resolution = 'true' | 'false' | 'insufficient-evidence'

function notOf(child: Resolution): Resolution {
  if (child === 'insufficient-evidence') return 'insufficient-evidence'
  return child === 'true' ? 'false' : 'true'
}

function allOf(children: Resolution[]): Resolution {
  if (children.some((c) => c === 'false')) return 'false'
  if (children.some((c) => c === 'insufficient-evidence')) return 'insufficient-evidence'
  return 'true'
}

function anyOf(children: Resolution[]): Resolution {
  if (children.some((c) => c === 'insufficient-evidence')) return 'insufficient-evidence'
  if (children.some((c) => c === 'true')) return 'true'
  return 'false'
}
```

- **`not(insufficient-evidence)` is `insufficient-evidence`.** Terminal under both polarities, per AD-4's
  own next paragraph: "the value is terminal and never satisfies … including `expects-violation`." This
  story never reads `polarity` at all — polarity lives on the `Oracle`/`direction` shape, not on `check`,
  and AD-4's terminal rule is a statement about what the *caller* (a not-yet-built score-stage
  orchestrator) must do with an `insufficient-evidence` root regardless of polarity, never about this
  wrapper computing something polarity-dependent. `notOf` takes no polarity parameter.
- **`all` keeps a genuine false decisive**: `allOf` checks `'false'` first, unconditionally, even when
  another operand resolved `insufficient-evidence` — "a single genuine failure stays decisive, because a
  detected defect is information and discarding it would hide the thing the product exists to find"
  (spine text, same paragraph).
- **`any` is deliberately weaker than disjunction**: `anyOf` checks `insufficient-evidence` *before*
  `true`, so one operand resolving `true` never rescues a sibling that examined nothing —
  "`No combination of `all` or `any` resolves satisfying when any operand resolved
  insufficient-evidence`" (same paragraph, the sentence set in its own emphasis in the spine).
- **Evaluation is total, never short-circuiting.** `Array.prototype.some` above is written for clarity,
  not for early exit from *evaluation* — the tree-walker (AC 6) evaluates every child of `all`/`any`
  before folding, regardless of what an earlier child resolved, because "every node is evaluated so the
  evidence records why the whole tree resolved as it did." A short-circuiting fold over *already-computed*
  resolutions (as `allOf`/`anyOf` above do) is not the same short-circuit AD-4 forbids: the forbidden one
  is skipping a *child's own resolution* once the parent's answer is already decided, and this story's
  tree-walker must recurse into every operand of `all`/`any` unconditionally before calling `allOf`/`anyOf`.
- **`CONNECTIVE_MINIMUM_ARITY` (`expression.ts:148`) is already enforced by the schema** (`all`/`any`
  require at least two operands): `allOf`/`anyOf` are never called with an empty array, so their
  vacuous-array edge case (`allOf([])` would read `true`, `anyOf([])` would read `false`) never arises in
  practice and needs no guard. Not relied upon silently: a fixture in AC 7 notes this explicitly rather
  than leaving it an unstated assumption.

### AC 5 — Quantifier propagation: `for-all`, `for-any`, and bound-element threading

`for-all`'s and `for-any`'s own `collection` field (`expression.ts:422-444`) is an `Operand`, resolved
through the same `resolveOperand`/`PointerDenotesCollection` pair as every other operand (AC 2, AC 3),
with the one Decision-3 exception already stated: `ABSENT` there is unconditionally empty-collection,
never consulting `pointerDenotesCollection`.

```ts
function resolveQuantifier(
  op: 'for-all' | 'for-any',
  collectionOperand: Operand,
  predicate: Expression,
  boundElement: JsonValue | null,
  ctx: ResolutionContext, // resolveOperand, pointerDenotesCollection, regexMatchStepBudget, artifactPath
): CheckResolutionValue {
  const collection = ctx.resolveOperand(collectionOperand, boundElement, ctx.artifactPath)
  const collectionEmpty =
    collection === ABSENT ||
    !Array.isArray(collection) ||
    collection.length === 0
  if (collectionEmpty) {
    return { resolution: 'insufficient-evidence', introductionCondition: 'empty-collection', children: [] }
  }
  // `collection` is a non-empty array at this point: the guard above already
  // rules out ABSENT, every non-array type mismatch (Decision 4), and the
  // zero-length case in one condition, so no separate check is needed here.
  const children = collection.map((element) =>
    resolveNode(predicate, element, ctx),
  )
  const resolution = op === 'for-all' ? allOf(children.map((c) => c.resolution)) : anyOf(children.map((c) => c.resolution))
  return { resolution, introductionCondition: null, children }
}
```

- **`for-all` folds its per-element children with `allOf`; `for-any` with `anyOf`.** Not stated verbatim
  anywhere in the spine as a formula, but it is the only construction consistent with the soft-delete
  fixture AD-4 itself supplies and epics.md's own AC repeats verbatim (epics.md lines 304-306):
  `for-all(page, absence(@/retractedAt))` and `not(for-any(page, existence(@/retractedAt)))` must agree
  on a populated page, an empty page, and an absent page. On a populated page where no element carries
  `retractedAt`: every element's `absence(@/retractedAt)` is `true`, so `allOf([...true])` is `true`; every
  element's `existence(@/retractedAt)` is `false`, so `anyOf([...false])` is `false`, and `notOf(false)` is
  `true`. Both `true`. On an empty page: both quantifiers trip the empty-collection condition directly,
  both resolve `insufficient-evidence`, and `notOf('insufficient-evidence')` is `insufficient-evidence`.
  Both `insufficient-evidence`. On an absent page (the pointer resolves `ABSENT` and is declared
  collection-typed, which a `for-all`/`for-any` collection always is per Decision 3): identical to the
  empty case. All three fixture requirements hold under this construction; no other pairing of
  fold-functions produces agreement on all three, which is why `for-all`↔`all` and `for-any`↔`any` is
  stated as load-bearing here rather than an arbitrary naming echo.
- **The bound element updates per iteration, and only inside the predicate subtree.** `resolveNode`'s own
  recursive calls for `predicate`'s children receive the just-bound `element` as their `boundElement`
  argument; every other resolution in the tree (including the quantifier's own sibling nodes, and the
  `collection` operand itself, resolved once before the loop) keeps whatever `boundElement` was already
  in scope (`null` at the root, or an outer quantifier's element if this quantifier is nested one level
  inside another's predicate — AD-4 admits that nesting structurally, `expression.ts:418-421`, even
  though `quantifier-nesting-exceeded` beyond one level is a compile-time check this story does not
  enforce).
- **A type-mismatch collection (resolves to a non-`ABSENT`, non-array value) is not this story's to
  invent a rule for.** No AD, ADR, or fixture states what `for-all`/`for-any` do when their `collection`
  operand resolves to, say, a plain object or number — `quantifier-over-non-collection` (AD-5's registry
  row, `ARCHITECTURE-SPINE.md` AD-5 table) is a **compile-time** check against the declared response
  descriptor, meaning a conforming upstream compiler (not yet built) never lets such a tree reach this
  function at all. Settled by construction, per this project's standing convention: treat it exactly like
  every other type mismatch in this codebase's operators — resolve as if the collection were empty
  (`insufficient-evidence`, `empty-collection`), never throw. A fixture in AC 7 pins this. **Consequence:**
  Decision 4 records the reasoning once here rather than leaving it an implicit fallthrough of the
  `collectionEmpty` check's `Array.isArray` test.

### AC 6 — `resolveCheck`: the tree-walking entry point and `CheckResolutionValue` assembly

```ts
export function resolveCheck(
  expression: Expression,
  resolveOperand: ResolveOperand,
  pointerDenotesCollection: PointerDenotesCollection,
  regexMatchStepBudget: number,
  artifactPath: string,
): CheckResolutionValue {
  return resolveNode(expression, null, {
    resolveOperand,
    pointerDenotesCollection,
    regexMatchStepBudget,
    artifactPath,
  })
}
```

`resolveNode(expression, boundElement, ctx)` is the private recursive worker every AC above's code
blocks call. Its dispatch on `expression.op`:

- **`not`**: recurse once, wrap with `notOf` (AC 4). One child.
- **`all` / `any`**: recurse over every operand (an `Expression[]`), fold with `allOf`/`anyOf` (AC 4). One
  child per operand, in order.
- **`for-all` / `for-any`**: `resolveQuantifier` (AC 5).
- **`covers-by-key`**: not dispatched. See Decision 5 — this case throws a plain `Error` (not a
  `RuntimeFault`: this is a completeness gap in this story's own dispatch table, never a runtime
  condition over evidence AD-28's registry exists to code) naming Story 3.3 by name, so a caller handed a
  tree it should never see yet (no epic touches `covers-by-key` construction before Story 3.3 ships) fails
  loudly rather than silently mis-resolving.
- **Every other `op`** (the ten from Story 3.1): resolve every operand in `expression.operands` via
  `ctx.resolveOperand(operand, boundElement, ctx.artifactPath)`. If `operandDenotesEmptyCollection` (AC 3)
  is true for any one of them, return `{ resolution: 'insufficient-evidence', introductionCondition:
  'empty-collection', children: [] }` without calling the operator function at all. Otherwise, dispatch
  to the matching Story 3.1 operator (`equality`, `deepEquality`, `containment`, `existence`, `absence`,
  `regexMatch` — passing `ctx.regexMatchStepBudget` — `setMembership`, `ordering`, `countTolerance`,
  `shape`), passing the already-resolved operand values plus each operator's own extra fields
  (`expression.pattern`, `.key`/`.order`, `.expected`/`.tolerance`/`.relative`, `.descriptor`) straight
  through from the `Expression` node, and `ctx.artifactPath` last, matching Story 3.1's uniform calling
  convention. Wrap the boolean result: `{ resolution: result ? 'true' : 'false', introductionCondition:
  null, children: [] }`.
  - **`setMembership`'s second operand needs a `JsonValue[]` the schema already guarantees at this
    point**: its `SetOperand` position is always either a `{ literal }` array (non-empty by `.min(1)`) or
    a `{ referenceSet }` resolving to the contract's declared members, never `ABSENT` (an unresolved
    identifier is `unresolved-reference-set`, a compile-time failure this story assumes already
    happened — same assumption AC 3 states for the general `ABSENT`-on-`{ referenceSet }` case) and never
    a scalar. `resolveOperand`'s declared return type is the wider `ResolvedValue`; narrow with a runtime
    `Array.isArray` check before calling `setMembership`, and throw a plain `Error` (never a
    `RuntimeFault`, for the same reason as `covers-by-key` above: a resolver returning a non-array for a
    schema-guaranteed-array position is an integration bug in whatever implements `ResolveOperand`, not a
    domain condition) if it is not — this never fires against a conforming resolver and exists only so a
    broken one fails loudly instead of miscomparing silently.
  - **`containment`'s candidate operand is different, and the same guard must not apply to it
    unconditionally.** `containment`'s second operand is the general `Operand` union, not `SetOperand`
    (`expression.ts`'s own `Containment` description: "the set is legally a pointer, a literal, or a
    reference set"), so a `{ pointer }` or `{ literal }` candidate legally resolves to an ordinary
    scalar — Story 3.1's own AC 4 names substring containment against `stdout`/`stderr` free text as
    exactly the natural case this operator exists for, and `containment`'s own code already branches on
    `Array.isArray(candidate)` internally to handle both shapes correctly. The array-narrowing guard
    therefore applies to `containment`'s candidate **only when the operand form is `{ referenceSet }`**,
    gated the same way `operandDenotesEmptyCollection`'s `ABSENT` branch gates on `'pointer' in operand`:
    check `'referenceSet' in candidateOperand` before narrowing and throwing; a `{ pointer }` or
    `{ literal }` candidate resolving to a scalar passes straight through to `containment` unguarded, and
    unguarded is correct there, not an oversight.
- **Every `RuntimeFault` a Story 3.1 operator throws (only `regexMatch`'s two, currently) propagates
  undecorated.** `resolveNode` never catches one. A pattern that cannot compile or breaches its budget is
  an unevaluable node, not a `false`/`insufficient-evidence` answer, the same reasoning Story 3.1 gives
  `deepEquality`'s canonicalization fault (AC 3 there).

`CheckResolutionValue`'s own shape (`{ resolution, introductionCondition, children }`) is produced
directly at every one of the branches above; no separate assembly step exists. `resolveCheck`'s return
value is exactly what a future `Outcome.checkResolution` (`evidence-artifact.ts:151`) needs, unmodified —
this story's own scope stops at producing it (AC 1 point 4); wiring it onto an `Outcome` is a future
`score`-stage orchestrator's job, not built anywhere yet (the "Owed to the reference implementation"
section, `ARCHITECTURE-SPINE.md:647-731`, states plainly that `score` is not epic-ready).

### AC 7 — Fixtures

Reuse `tests/schemas/fixtures/gate-c-contract.ts`'s real `check` trees wherever one exists, matching
Story 3.1's own AC 7 convention, never inventing an unrelated tree where a real one is available:

1. **`not`/`all`/`any` propagation, all eight combinations of `{true, false, insufficient-evidence}` in
   each position that AD-4's formulas distinguish**: at minimum, `all` with one `false` child among an
   `insufficient-evidence` sibling (resolves `false`, proving `false` stays decisive); `all` with one
   `insufficient-evidence` and the rest `true` (resolves `insufficient-evidence`); `any` with one
   `insufficient-evidence` and one `true` sibling (resolves `insufficient-evidence`, proving `any` is
   weaker than disjunction); `any` with all `false` (resolves `false`); `not` over each of the three
   values. Ground the `all` cases in `gateCContract`'s O-002 (`all(equality, set-membership)`) and O-003
   (`all(absence, absence, existence)`) shapes; ground `any` in `expression-nodes.ts`'s canonical shape,
   since no real contract uses `any` (matching Story 3.1's precedent for hand-authoring a form with no
   real usage).
2. **The soft-delete agreement pair, verbatim from AD-4's own worked example and epics.md's own AC**:
   `gateCContract`'s O-004 node (`not(for-any(page, existence(@/retractedAt)))`) and its `for-all` twin
   `for-all(page, absence(@/retractedAt))`, both resolved against: a populated collection where no element
   carries `retractedAt` (both `true`); a populated collection where one element does carry it (both
   `false`: `for-all`'s `absence` check fails on that element, folding to `false` via `allOf`;
   `for-any`'s `existence` check succeeds on that element, folding to `true` via `anyOf`, and
   `notOf('true')` is `false`); an empty collection (both `insufficient-evidence`); an absent collection
   (both `insufficient-evidence`, via Decision 3's unconditional quantifier-collection rule).
3. **A quantifier over a real reference-set-backed predicate**: `gateCContract`'s O-006 node
   (`for-all(page, set-membership(@/id, {referenceSet: 'expected-export-rows'}))`), against a page where
   every id is a member (true) and a page where one id is not (false).
4. **A quantifier over `shape`**: `gateCContract`'s O-005 node, against a conforming page (true) and a page
   with one non-conforming element (false), proving a leaf operator's own two-valued result reaches the
   quantifier fold correctly.
5. **Every one of AC 3's empty-collection cases, once per operand position that can plausibly carry a
   collection-typed pointer in this codebase's own real usage**: `ordering`, `countTolerance`,
   `containment`'s container, `setMembership`'s `set` (via a reference set resolving to zero members,
   proving Decision 1's fully-general reading against the one case Story 3.1's own narrower phrasing named
   explicitly), and one case on an operator Story 3.1's text did *not* single out (e.g. `equality`'s first
   operand resolving to `[]`), proving Decision 1's uniform reading is actually implemented, not merely
   asserted.
6. **The `ABSENT`-but-collection-typed case**, distinct from the plain-`ABSENT` case Story 3.1's own
   operator-level fixtures already cover: a `{ pointer }` operand resolving `ABSENT` where
   `pointerDenotesCollection` returns `true` resolves `insufficient-evidence`, not the operator's own
   plain-`false` `ABSENT` answer; the identical operand where `pointerDenotesCollection` returns `false`
   resolves per the operator's own ordinary `ABSENT` handling (`existence` false, `equality` false, etc.),
   proving the interception is genuinely conditional on the injected predicate and not a blanket override.
7. **The `covers-by-key` dispatch gap**: a tree whose root is a bare `covers-by-key` node throws a plain
   `Error` naming Story 3.3, never a `RuntimeFault` and never a silent wrong answer.
8. **The array-narrowing guards, three cases proving they fire exactly where they should and nowhere
   else**: a deliberately misbehaving stub `ResolveOperand` that returns a non-array for `setMembership`'s
   `SetOperand` position, proving the plain `Error` guard fires (this fixture is not exercising a
   reachable production path, and its own test says so); the same misbehaving stub against `containment`'s
   candidate when the operand form is `{ referenceSet }`, proving `containment`'s own guard fires under the
   identical failure mode; and an ordinary `containment` node whose candidate is a `{ pointer }` or
   `{ literal }` resolving to a plain scalar (the `stdout`/`stderr` substring shape Story 3.1 AC 4 names),
   proving that case passes straight through to `containment` with no guard involved and no `Error` thrown.
9. **The literal-empty-collection case, resolved per Decision 7**: `deepEquality` (or `equality`) with one
   operand a `{ pointer }` resolving to a non-empty array and the other a `{ literal: [] }` operand
   resolves `insufficient-evidence`, never `true` and never `false`, pinning that a `{ literal }` operand
   is not exempt from the empty-collection invariant merely because it is author-supplied rather than
   observed.
10. **A `RuntimeFault` from a nested `regexMatch` node propagates through every one of the six dispatch
    branches undecorated, demonstrated concretely rather than merely asserted**: through `all` and
    `for-all` (already required above), and through `not` and `any`/`for-any` as well — an invalid
    pattern or a budget breach inside any connective's or quantifier's operand throws out of
    `resolveCheck` rather than resolving the parent node to anything, and no branch of the dispatcher
    catches it.
11. **The type-mismatch quantifier-collection case (AC 5's last point)**: a `for-all` whose `collection`
    operand resolves to a plain object (never an array or `ABSENT`) resolves `insufficient-evidence` with
    no children, per Decision 4.

### AC 8 — Tests and the gate

- Tests live at `tests/evaluate/resolution.test.ts`, mirroring `tests/evaluate/operators.test.ts`'s own
  file-per-module convention. The test-only stub `ResolveOperand`/`PointerDenotesCollection`
  implementations (AC 2) live in this same test file, or a small sibling fixture file
  (`tests/evaluate/fixtures/stub-resolver.ts`) if reused across more than one `describe` block — never in
  `src/`.
- Every `RuntimeFault` assertion (AC 7 point 10) checks `instanceof RuntimeFault`, exact `.code`, and
  `.artifactPath`, using `faultOf` from `tests/canonical/helpers.ts`, matching Story 3.1's own convention
  and this project's standing one (Story 2.3 AC 5, Story 1.3).
- Every plain-`Error` assertion (AC 7 points 7 and 8) checks the thrown value is `instanceof Error` and
  **not** `instanceof RuntimeFault` (proving these two failure classes stay distinct — a plain internal
  `Error` accidentally becoming a `RuntimeFault`, or vice versa, would misroute it through whatever future
  code branches on `RuntimeFault` specifically), plus the message names the expected story or guard.
- `npm run check:docs` and `npm test` run and the baseline is recorded **before the first edit**.
- `npm run validate` passes at the end (typecheck, lint, `check:docs`, `check:shareable`, `lint:spine`,
  `check:vectors`, `check:schemas`, `check:ad5-registry`, `test`). This story touches no schema and no
  spine text, so `check:shareable`/`lint:spine`/`check:schemas`/`check:ad5-registry` are expected to be
  no-ops; run them anyway, exactly as Story 3.1's own gate did, rather than assuming.
- `src/index.ts` is not touched: `resolveCheck` is internal until a future `score`-stage orchestrator
  calls it, the same rule Story 3.1 followed and Story 2.3 before it.

## Tasks / Subtasks

- [ ] Task 1: preflight (AC 8)
  - [ ] Run `npm run check:docs` and `npm test`; record the baseline test count before the first edit.
- [ ] Task 2: module scaffold and the injected capabilities (AC 1, AC 2)
  - [ ] `src/core/evaluate/resolution.ts`: `ResolveOperand`, `PointerDenotesCollection` types.
- [ ] Task 3: the empty-collection introduction condition (AC 3)
  - [ ] `operandDenotesEmptyCollection`, applied uniformly to every operand of every leaf and quantifier
        node.
- [ ] Task 4: connective propagation (AC 4)
  - [ ] `notOf`, `allOf`, `anyOf`.
- [ ] Task 5: quantifier propagation and bound-element threading (AC 5)
  - [ ] `resolveQuantifier` for `for-all`/`for-any`.
- [ ] Task 6: `resolveCheck` and the leaf dispatch table (AC 6)
  - [ ] `resolveNode`, dispatching all sixteen `op` values (ten Story 3.1 operators, three connectives,
        two quantifiers, one explicit `covers-by-key` gap); `resolveCheck` as the public entry point.
- [ ] Task 7: fixtures and tests (AC 7, AC 8)
  - [ ] `tests/evaluate/resolution.test.ts` (plus a stub-resolver fixture file if warranted).
- [ ] Task 8: the gate (AC 8)
  - [ ] `npm run validate` green.
- [ ] Task 9: record
  - [ ] `_bmad-output/project-knowledge/learning-path-step-by-step.md`: one new row, following
        `learning-path-template.md`'s exact shape, after `dev-story` marks this story done.
  - [ ] Dev Agent Record: measured counts, any decision that moved from this story's default.

## Decisions taken during story creation

Each is settled with a stated default and its downstream consequence. Per this project's standing
convention (settle ambiguities in the story or the code, record the reasoning, do not escalate to a new
architecture revision), proceed unless the user amends one; record the outcome in the Dev Agent Record.

1. **The empty-collection introduction condition applies to every operand of every operator, not only
   the four Story 3.1's own AC 1 text named ("`ordering`'s and `countTolerance`'s sole operand,
   `containment`'s container, `setMembership`'s implicit collection reading of `value`").** AD-4's own
   text calls the condition "an invariant over operands rather than a rule about particular operators …
   the value arrives for every operator now in the closed set … without a further decision"
   (`ARCHITECTURE-SPINE.md:191`) — a statement of universality, not an enumeration. Read narrowly (only
   those four functions' named operand), `equality(@/tags, {"literal": []})` against a pointer the
   contract happens to declare collection-typed would resolve `false` from `equality`'s own scalar-vs-
   array type-mismatch branch rather than `insufficient-evidence`, silently reintroducing the exact
   `notes: []`-shaped defect AD-4's whole revision history fights, one operator over from where Story
   3.1's narrower list would have caught it. The uniform reading costs nothing extra to implement (one
   check applied at every operand, rather than a per-operator allow-list to keep in sync with the operator
   set) and is strictly safer. **Consequence:** AC 3's `operandDenotesEmptyCollection` takes no operator
   identity as input, only the resolved value and the operand that produced it; AC 7 point 5 pins a case
   on an operator outside Story 3.1's original four, proving the uniform reading is actually implemented.
2. **Real operand resolution, of every form including `@/`, stays entirely out of this story's runtime
   code, exactly as Story 3.1 deferred `{ pointer }`/`{ referenceSet }` resolution. This story defines two
   injected capabilities (`ResolveOperand`, `PointerDenotesCollection`) rather than building even a
   partial resolver.** Considered and rejected: building a minimal real RFC 6901 walker now, scoped only
   to the bound-element (`@/`) form, reasoning that a plain, generic pointer-into-a-JS-value walk needs no
   interaction/interface knowledge and so is not really "Epic 4's job" the way interaction-rooted
   resolution is. Rejected on a closer reading of Story 4.1's own AC (epics.md line 335): it states its
   "one implementation of the addressing grammar" is what makes "the reachability check and any future
   evaluator read the same expression identically," and explicitly lists "`@/` binds only inside
   quantifiers" as part of that one implementation — not carved out as a simpler, separately-ownable
   piece. Building it twice (a simplified version here, the real one in Story 4.1) is the two-vocabulary
   drift AD-26 exists to prevent, even if the two implementations would likely agree on every case Story
   3.2's own fixtures exercise: "likely agree" is not the guarantee AD-26 requires, and Story 4.1's
   eventual implementation may need to reject a malformed bound-element pointer, or resolve it against a
   type Story 3.2's simplified walker never anticipated, in a way this story cannot predict without
   building the whole grammar, which is explicitly not this epic's scope. **Consequence:** this story's own
   fixtures inject a small, explicitly test-only stub resolver, documented as never shipping from `src/`
   and never asserted to match Story 4.1's eventual real behavior beyond the cases these fixtures need.
3. **`PointerDenotesCollection` is consulted only for a `{ pointer }` operand whose resolution is
   `ABSENT`, and only for the pointer as given — never for a bound-element (`@/…`) pointer beyond passing
   it through unchanged, except for a quantifier's own `collection` field, where `ABSENT` is
   unconditionally treated as collection-typed without consulting the predicate at all.** Three separate
   sub-decisions, stated together because they are all instances of the same principle (only intercept
   where a real answer exists to give): a `{ literal }` operand never resolves `ABSENT` (it resolves to
   itself), so it needs no interception; a `{ referenceSet }` operand resolving `ABSENT` would mean
   `unresolved-reference-set` slipped past compilation, a state this story assumes cannot occur (Story
   3.1's own AC 7 assumes the equivalent for `setMembership`'s reference-set operand); and a bound-element
   pointer's `ABSENT` case has no declared-collection-type surface to consult at all in the current schema
   (`ResponseDescriptor.collectionLocations` names top-level response locations, never a path relative to
   one already-bound array element), so treating it as "never collection-typed by default" is not a loss
   of a real answer, only an honest statement that none exists yet. The quantifier-field exception is
   different in kind: there, "is this collection-typed" is not ambiguous at all, since a quantifier's
   `collection` field is definitionally a collection regardless of what any descriptor states, so asking
   the injected predicate would be asking a question whose answer is already known. **Consequence:** AC 3's
   code block encodes all three; AC 7 points 2 and 6 each pin one of them with a fixture.
4. **A quantifier whose `collection` operand resolves to a non-`ABSENT`, non-array value (a type
   mismatch) is treated as `insufficient-evidence` with `empty-collection`, never a thrown fault and
   never `true`/`false`.** No source states this case; `quantifier-over-non-collection` is a compile-time
   check this story's runtime code cannot perform (it would need the declared response descriptor, which
   this story's injected capabilities deliberately do not carry beyond the one boolean AC 2 defines).
   Considered and rejected: throwing a fault, on the reasoning that a collection-typed position holding a
   non-collection value is a genuine defect. Rejected because it repeats exactly the failure Story 3.1's
   Decision 2 spent four drafts closing for `equality`: converting a data-dependent type mismatch into an
   invalidating fault turns a detected defect into an unscoreable run, the opposite of AD-26's own
   "Prevents" clause. Treating it as `insufficient-evidence` costs nothing a real contract would ever pay
   (a conforming compiler will have already rejected this tree under `quantifier-over-non-collection`
   before it reaches this function at all) and fails exactly as safely as the genuinely-empty case already
   does. **Consequence:** AC 5's last bullet and AC 7 point 11 state and pin this explicitly, so a future
   reader does not have to re-derive it from `Array.isArray`'s own fallthrough behavior.
5. **`covers-by-key` gets one explicit, throwing branch in `resolveNode`'s dispatch, rather than being
   omitted from the switch entirely.** `Expression` (`expression.ts:225-250`) already discriminates on all
   sixteen `op` values including `covers-by-key`, shipped in Epic 1; a TypeScript exhaustive `switch` over
   `expression.op` therefore needs a case for it today, regardless of which story implements its behavior.
   Considered and rejected: a `RuntimeFault` with a new code. Rejected because AD-28's registry is for
   genuine runtime conditions over evidence (a budget breach, an unparseable pattern); "this story hasn't
   shipped yet" is a completeness gap in this story's own code, not a fact about the evidence being
   evaluated, and minting a fault code for it would need a spine-table row for a condition that stops
   existing the moment Story 3.3 ships — exactly the kind of code AD-28's own "only codes with a genuine
   thrower belong here" rule (quoted in Story 3.1 AC 2) is written to exclude. **Consequence:** a plain
   `Error`, never `RuntimeFault`; Story 3.3 deletes this one branch and adds a real one, touching no other
   line of this story's code, and no spine or fault-registry edit is needed on either side of that
   transition.
6. **The empty-collection interception fully replaces a leaf's own two-valued answer; it does not run the
   operator and then override its result.** Equivalent outcome either way for every one of Story 3.1's ten
   operators (all ten already resolve `false` on their own collection-typed `ABSENT`/type-mismatch inputs,
   never throwing), but short-circuiting before the call is the construction Story 3.1's own doc comments
   on `ordering` and `countTolerance` name explicitly ("Story 3.2's wrapper handles the zero-element
   case; this function does not" / "intercepts before this runs on a genuinely empty collection"),
   consistent with AD-4's own "an invariant over operands" framing treating the empty-collection condition
   as a property checked *before* the operator is asked anything, not a correction applied *after*.
   **Consequence:** no operator function in `operators.ts` is ever called with an operand this story has
   already determined denotes an empty collection; `resolveNode`'s dispatch branch for the ten operators
   checks `operandDenotesEmptyCollection` across every operand first and returns early, before assembling
   the operator call.
7. **`operandDenotesEmptyCollection`'s empty-array branch (`Array.isArray(resolved) && resolved.length ===
   0`) carries no operand-provenance gate: a `{ literal: [] }` operand trips the empty-collection
   condition exactly as a pointer resolving to `[]` does, even though a literal is author-supplied and
   present in the contract text itself, never something a system under test could fail to return.** This
   means `deepEquality(@/errors, { literal: [] })`, written to assert "errors is exactly empty," can never
   resolve `true` — only `insufficient-evidence` (if `errors` itself is also empty or absent) or `false`
   (if it is not) — which is a real, permanent limitation on what a literal-array operand can assert
   anywhere in the grammar. Considered and rejected: gating this branch on operand provenance too (the
   same `'pointer' in operand` style check the `ABSENT` branch already uses), so only a genuinely observed
   empty collection introduces the condition and an author's own literal is exempt. Rejected on AD-4's own
   explicit text: *"There is no v0 spelling for 'this collection may legitimately be empty', and that is
   deliberate … An author who believes emptiness is correct behaviour is asserting something about the
   world population, not something a check expression should quietly encode"* (`ARCHITECTURE-SPINE.md:191`,
   two paragraphs after the operator table). Exempting `{ literal: [] }` from the invariant would hand an
   author exactly the workaround that paragraph names and rejects by a different route than the one it
   discusses (`count-tolerance` under a connective): a literal empty array spliced into `equality` or
   `deepEquality` becomes a second, undocumented spelling for "this may legitimately be empty," achieving
   by operand choice what the connective-based workaround achieves by connective choice, and the spine
   rejects the destination, not only the one route it happened to name. **Consequence:** the uniform,
   provenance-blind reading from Decision 1 is correct here too, not merely simpler; AC 7 point 9 pins it
   with a fixture so a future reader does not mistake the permanent `deepEquality`-against-`{ literal: []
   }` non-`true` result for an oversight.

## Dev Notes

### Read these files before writing anything

1. `src/core/schemas/expression.ts`: in full, again — this story's tree-walker dispatches on every `op`
   the file declares, including `CONNECTIVE_MINIMUM_ARITY`, `TUPLE_ARITY`, and the `ForAll`/`ForAny`
   schemas' own comment on structurally-admitted nesting (lines 418-421).
2. `src/core/schemas/evidence-artifact.ts`, lines 47-74: `CheckResolutionValue`, `CheckResolution`. This
   story's entire return shape.
3. `src/core/evaluate/operators.ts` and `resolved-value.ts`: every operator this story's leaf dispatch
   calls, and `ABSENT`. Read Story 3.1's own file in full
   (`_bmad-output/implementation-artifacts/3-1-scalar-operators-over-the-evidence-domain.md`) for the
   nine review-round findings and ten decisions that shaped it — several (Decision 2's four-draft
   `equality` history, Decision 8's absent-collection-typed boundary, the `ordering`/`countTolerance`
   doc comments) are load-bearing context this story's own AC 3 and Decision 6 build directly on.
4. `src/core/schemas/interface.ts`, lines 46-71: `ResponseDescriptor`, `CollectionLocation`. The shape
   `PointerDenotesCollection` is a consumer-side stand-in for; not built by this story, but its structure
   is why the capability is a plain boolean function rather than something richer.
5. `src/core/schemas/pointer.ts`: `EvidencePointer`, `InteractionPointer`, `BoundElementPointer`. The two
   pointer spellings a `{ pointer }` operand may carry; `BOUND_ELEMENT_POINTER_PATTERN` is the `@/…`
   syntax Decision 2 and Decision 3 discuss without building a resolver for.
6. `ARCHITECTURE-SPINE.md`: AD-4 in full (185-201) — read this one slowly, it is the entire semantic
   content of this story; AD-26 in full (384-392), especially the `absent`-is-not-`null` and
   type-mismatch-resolves-false rules this story inherits at every leaf; AD-34 (461-467), naming `core/`
   as pure and `application/` as the one layer that awaits ports — the reason this story's
   `ResolveOperand` is an injected function type rather than something `resolveCheck` calls out to
   directly; "Owed to the reference implementation" (647-731), confirming `score` is not epic-ready and
   this story's own output has no consumer yet.
7. `epics.md`: Epic 3's intro (274-276) and Story 3.2's own AC (291-306), including the soft-delete
   fixture requirement this story's AC 7 point 2 exists to satisfy.
8. `tests/schemas/fixtures/gate-c-contract.ts`: O-002 through O-006 in full (lines ~202-360) — every real
   `all`, `not`, `for-any`, `for-all` node this story's AC 7 reuses.
9. `tests/schemas/fixtures/expression-nodes.ts`: the canonical one-node-per-form shapes, `any` in
   particular (no real contract uses it).
10. `tests/canonical/helpers.ts`: `faultOf`, this story's own `RuntimeFault`-propagation tests reuse it
    unchanged.

### Project structure notes

- One new file: `src/core/evaluate/resolution.ts`. One new test file: `tests/evaluate/resolution.test.ts`
  (plus, if warranted, a small sibling fixture file for the test-only stub resolver — never in `src/`).
- No `core/schemas/` edit. No spine edit. No new `RuntimeFaultCode`. This story is pure addition to
  `core/evaluate/`.
- `src/index.ts` not touched (AC 1, AC 8), same rule as Story 3.1.

### Testing requirements

- `tsconfig.json`'s `noUncheckedIndexedAccess` applies to any array access in the quantifier fold and the
  connective children arrays.
- `biome.json`'s `useImportType`/`useExportType`: `ResolveOperand`, `PointerDenotesCollection`, `Operand`,
  `Expression`, `JsonValue`, `CheckResolutionValue` are all type-only imports where used only as types.
- No configured coverage threshold (AD-30's 90 percent floor has no `vitest.config.ts` gate, as in every
  prior story); the proxy is AC 7's own fixture list plus assertions specific enough to fail if the
  property they name is removed, matching Story 3.1's own testing-requirements note verbatim.

### References

- `_bmad-output/planning-artifacts/epics.md`: Epic 3 intro (274-276), Story 3.2 (291-306).
- `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md`:
  AD-4 (185-201), AD-26 (384-392), AD-34 (461-467), Capability → Architecture Map (603-616), Owed to the
  reference implementation (647-731).
- `src/core/schemas/expression.ts`, `evidence-artifact.ts`, `interface.ts`, `pointer.ts`.
- `src/core/evaluate/operators.ts`, `resolved-value.ts`.
- `tests/schemas/fixtures/gate-c-contract.ts`, `expression-nodes.ts`.
- `tests/canonical/helpers.ts`.
- `_bmad-output/implementation-artifacts/3-1-scalar-operators-over-the-evidence-domain.md`: house style,
  the operator functions this story calls, and the absent-collection-typed boundary this story's AC 3
  implements the other side of.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Suggested Review Order

**The consumer-side contract**

- `ResolveOperand`, `PointerDenotesCollection`: the two capabilities this story injects rather than
  builds. Read with Decision 2 and Decision 3.

**The empty-collection condition — the one rule this whole story exists to get right**

- `operandDenotesEmptyCollection`: applied uniformly, per Decision 1, not restricted to the four
  operators Story 3.1's own text named.

**Propagation formulas**

- `notOf`, `allOf`, `anyOf`: copied verbatim from AD-4's stated rules; check `false`-stays-decisive in
  `allOf` and `insufficient-evidence`-beats-`true` in `anyOf` against the spine text directly.

**Quantifiers — the soft-delete agreement pair**

- `resolveQuantifier`: the `for-all`↔`allOf`, `for-any`↔`anyOf` pairing (Decision-backed in AC 5), and
  the bound-element threading through `resolveNode`'s recursive calls.

**The dispatcher**

- `resolveNode`: all sixteen `op` branches, the `covers-by-key` throwing gap (Decision 5), and the
  array-narrowing guards on `setMembership` and `containment` — check specifically that `containment`'s
  guard fires only when its candidate operand is `{ referenceSet }`, never on an ordinary scalar
  `{ pointer }`/`{ literal }` candidate (AC 6).

**Peripherals — fixtures and tests**

- `resolution.test.ts`: the soft-delete three-way agreement (populated/empty/absent), the uniform
  empty-collection case outside Story 3.1's original four operators, and the `RuntimeFault`-propagates-
  through-a-connective case.
