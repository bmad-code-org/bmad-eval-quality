---
epic: 3
story: 3
key: 3-3-covers-by-key-as-a-bijection
baseline_commit: 43115702c7bd36dc7ae37f67999c9132cb8d3fa4
---

# Story 3.3: covers-by-key as a bijection

Status: done

## Story

As the completeness rule's only writable form,
I want `covers-by-key` implemented as a bijection with its degenerate cases inherited from the invariant,
so that omission, duplicate padding, and unexpected extras are all detected and an empty reconciliation never certifies.

## Acceptance Criteria

### AC 1: Module location, scope, and what this story does not build

**`src/core/evaluate/operators.ts` gets the eleventh operator; `src/core/evaluate/resolution.ts` gets a real
dispatch branch in place of the throwing stub.** Same placement reasoning as Story 3.1 and Story 3.2: one
capability under the Capability → Architecture Map's VFR-2 row. No new module. This is the last operator in
AD-4's closed vocabulary; after this story every one of the sixteen `op` values `resolveNode` switches on
has a real implementation.

**This story closes exactly one dispatch gap.** `resolveNode`'s `'covers-by-key'` case currently reads:

```ts
case 'covers-by-key':
	// Decision 5: a gap in this dispatch table, never a condition over the
	// evidence, so a plain Error and no RuntimeFault. Story 3.3 replaces
	// this branch.
	throw new Error(
		"'covers-by-key' has no operator implementation yet. Story 3.3 " +
			'builds it; resolveCheck should never be handed this node before ' +
			'then.',
	)
```

Story 3.2's own Decision 5 named this exactly: "Story 3.3 deletes this one branch and adds a real one,
touching no other line of this story's code, and no spine or fault-registry edit is needed on either side
of that transition." Delete the `throw`, add the real branch (AC 4). No other branch of `resolveNode`
changes.

**What this story does not build, and why:**

1. **Real pointer or reference-set resolution.** Unchanged from Story 3.1/3.2: Story 4.1's job. This story
   consumes `ResolveOperand` exactly as Story 3.2 defined it; it adds no new injected capability.
2. **Any compile-time check.** `malformed-operator-expression` for wrong arity or a duplicate key inside a
   contract-declared reference set, `quantifier-nesting-exceeded` for `covers-by-key` inside a quantifier,
   and `unresolved-reference-set` for a dangling `referenceSet` identifier are all Epic 4/5's compiler work,
   already schema-admitted and already fixture-tested (`tests/schemas/ad5-admissions.test.ts`,
   `tests/schemas/fixtures/reject-cases.ts`) as compile-time concerns this runtime module assumes already
   happened, exactly the convention Story 3.1's `setMembership` and Story 3.2's array-narrowing guards
   already apply to the identical assumption.
3. **Mapping `insufficient-evidence`/`true`/`false` onto an outcome state.** Unchanged: `abstained` is
   AD-6's, and this epic's own text says it "stops at resolution and records it." `coversByKey`'s return
   type is `boolean`, and `resolveNode`'s `'covers-by-key'` branch returns a `CheckResolutionValue`, exactly
   like every other leaf.
4. **A bound on tree recursion depth, quantifier fan-out, or total evaluated-node count.** Story 3.2's Decision
   12 already recorded this as an open, unowned gap; nothing here changes it.

**Purity (AD-1), unchanged.** Synchronous, deterministic, pure. `digestArtifact` (already imported in
`operators.ts`) is the one dependency this operator needs, for the same structural-comparison reason Story
3.1's `equality`/`deepEquality`/`setMembership`/`containment` already use it.

### AC 2: `coversByKey`, the operator function

Add to `src/core/evaluate/operators.ts`, in its own `AC 3 — covers-by-key` section following the file's
existing `AC`-numbered section comments:

```ts
/**
 * Reads `key` off `element` if `element` is a plain object carrying it as an
 * own property; `ABSENT` otherwise (not present, or `element` is not an
 * object at all). `Object.hasOwn` guards the lookup so a key like
 * `__proto__` reads as missing rather than as an inherited property (same
 * guard Story 3.2's stub resolver applies for the same reason). AD-4: "An
 * element missing the named key resolves false rather than erroring." This
 * function is why: it never throws, and `coversByKey` below never
 * special-cases its `ABSENT` result. Such an element naturally drops out of
 * the match: never inserted into the actual-side index, never findable from
 * the expected-side loop. That is `false` by construction, a consequence of
 * the algorithm rather than a distinct branch (Decision 5).
 */
function keyValueOf(
	element: JsonValue,
	key: string,
): JsonValue | typeof ABSENT {
	if (!isPlainObject(element) || !Object.hasOwn(element, key)) return ABSENT
	return element[key]
}

/**
 * AD-4's bijection: equal cardinality and a distinct `actual` match per
 * `expected` element on the named keys. `expected` is typed `JsonValue[] |
 * typeof ABSENT`, not the wider `ResolvedValue` `actual` takes: its operand
 * form is a reference set only (`CoversByKey`'s own schema description), so a
 * conforming resolver returns one of exactly these two shapes, and
 * `resolveNode`'s own dispatch guards the third case (Decision 3).
 *
 * `ABSENT` on either side resolves `false`: AD-26's ordinary rule, applied
 * here even though `actual`'s pointer is always collection-typed. AD-4's own
 * covers-by-key text calls a fully missing collection "a detected defect and
 * not an empty examination" and states this resolution directly, overriding
 * what the general empty-collection invariant would otherwise say for a
 * collection-typed `ABSENT` pointer (Decision 1). Only a genuinely empty
 * array still trips that invariant, and `resolveNode` intercepts it before
 * this function ever runs (matching Story 3.2's Decision 6).
 *
 * A non-array `actual` (a type mismatch) resolves `false` too: AD-26's
 * ordinary type-mismatch rule. It is checked here, not at the dispatch
 * layer, because `actual`'s operand form is an ordinary pointer, the same
 * self-contained shape `containment` already uses for its own `container`
 * parameter (Decision 2).
 *
 * Cardinality is never checked separately: an injective, total map from
 * `expected` into `actual` over two finite sets is automatically surjective,
 * so `actualByKey.size === 0` after every `expected` element is consumed is
 * the bijection condition, not an approximation of it (Decision 6). A
 * duplicate `actualKey` value is caught the moment a second element tries to
 * claim an already-populated map entry ("response-side duplicate keys
 * resolve false", AD-4); a duplicate `expectedKey` value is not separately
 * checked (assumed compile-time-prevented, Decision 4) but fails the same
 * way if it ever occurs, since its second lookup finds the entry already
 * deleted.
 */
export function coversByKey(
	expected: JsonValue[] | typeof ABSENT,
	actual: ResolvedValue,
	expectedKey: string,
	actualKey: string,
	artifactPath: string,
): boolean {
	if (expected === ABSENT || actual === ABSENT) return false
	if (!Array.isArray(actual)) return false

	const actualByKey = new Map<string, JsonValue>()
	for (const element of actual) {
		const keyValue = keyValueOf(element, actualKey)
		if (keyValue === ABSENT) continue
		const digest = digestArtifact(keyValue, artifactPath)
		if (actualByKey.has(digest)) return false
		actualByKey.set(digest, element)
	}

	for (const element of expected) {
		const keyValue = keyValueOf(element, expectedKey)
		if (keyValue === ABSENT) return false
		const digest = digestArtifact(keyValue, artifactPath)
		if (!actualByKey.delete(digest)) return false
	}

	return actualByKey.size === 0
}
```

`isPlainObject`, `JsonValue`, `digestArtifact`, and `ABSENT`/`ResolvedValue` are already imported in
`operators.ts` for other operators; this story adds no new import to that file.

**Also update `operators.ts`'s own top-of-file doc comment.** It currently reads "AD-4's ten scalar and
structural operators over the resolved-value domain… `covers-by-key` is Story 3.3's." Both the count and
the future tense go stale the moment this story lands. State eleven operators and drop the forward
reference, the same cleanup AC 3 already calls for on `resolution.ts`'s own header.

### AC 3: `resolveNode`'s real dispatch branch

Replace the throwing `'covers-by-key'` case in `src/core/evaluate/resolution.ts` with:

```ts
case 'covers-by-key': {
	const [expectedOperand, actualOperand] = expression.operands
	const { expectedKey, actualKey } = expression
	const expectedResolved = ctx.resolveOperand(
		expectedOperand,
		boundElement,
		ctx.artifactPath,
	)
	const actualResolved = ctx.resolveOperand(
		actualOperand,
		boundElement,
		ctx.artifactPath,
	)
	// Decision 3: checked first and unconditionally, before anything else
	// looks at `actual`. A malformed `expected` is a resolver integration
	// bug, never a data outcome, and must never be masked by whatever
	// `actual` resolved to, including a benign empty collection.
	if (expectedResolved !== ABSENT && !Array.isArray(expectedResolved)) {
		throw new Error(
			"covers-by-key's expected-operand guard: a reference-set operand " +
				'must resolve to ABSENT or an array, which the schema guarantees. ' +
				'The injected ResolveOperand returned something else — either a ' +
				'resolver integration bug, or an unresolved reference set that ' +
				'slipped past compilation (unresolved-reference-set); this guard ' +
				'cannot tell the two apart.',
		)
	}
	// Decision 7: genuine emptiness (AD-4's "two empty collections" case,
	// generalized to a single empty operand per the uniform reading Story
	// 3.2 already established) applies only once both operands are confirmed
	// ordinary, present collections. ABSENT on either side, or a malformed
	// `actual`, is a decisive `false` (Decision 1, Decision 2) and must
	// outrank emptiness: the same priority `allOf` already gives a decisive
	// `false` child over an `insufficient-evidence` sibling elsewhere in this
	// file. Delegating straight to `coversByKey` for those two cases keeps
	// the check single-sourced. The function already implements both as its
	// own top guards; this code only routes around them, nothing is
	// duplicated.
	const bothPresentArrays =
		expectedResolved !== ABSENT &&
		actualResolved !== ABSENT &&
		Array.isArray(actualResolved)
	if (
		bothPresentArrays &&
		(expectedResolved.length === 0 || actualResolved.length === 0)
	) {
		return emptyCollectionResult()
	}
	return booleanResult(
		coversByKey(
			expectedResolved,
			actualResolved,
			expectedKey,
			actualKey,
			ctx.artifactPath,
		),
	)
}
```

Add `coversByKey` to `resolution.ts`'s existing import from `./operators.ts`. Update the module's own top
doc comment, which currently reads "`covers-by-key` is Story 3.3's" in the future tense: this story makes
it real, so the comment should say so.

**Do not route this branch through `anyOperandEmpty`/`operandDenotesEmptyCollection`.** Those two functions
encode Story 3.2's general, uniform rule (Decision 1 there): any operand resolving to a genuinely empty
array, *or* to `ABSENT` where the operand is a `{ pointer }` the descriptor types as a collection, is the
one introduction condition. `covers-by-key`'s own AD-4 paragraph states a different rule for the `ABSENT`
half, specific to this operator (see Decision 1 below). Reusing the shared helper here would silently
resolve an absent `actual` collection to `insufficient-evidence`, the opposite of what AD-4 states. It would
also apply the emptiness check to both operands as one unconditional `||`, with no regard for whether the
*other* operand is malformed or `ABSENT`. That is the exact masking Decision 7 exists to prevent.

### AC 4: Fixtures

Reuse `populatedContract`'s O-001 `check` node from `tests/schemas/fixtures/relevance-contracts.ts` for
every `resolveCheck`-level (dispatch) fixture below. It is this codebase's one real `covers-by-key` check
tree (`referenceSet: 'expected-things'` against `/interactions/list/response-body/items`, both keys `id`),
already treated as this operator's canonical worked example elsewhere (`tests/seal/direction-prose.test.ts`
calls it "a second worked example"). Vary only the stub resolver's `evidence`/`referenceSets` maps across
fixtures, matching Story 3.2's own precedent for its O-002–O-006 reuse. Hand-author literal
`expected`/`actual` arrays only for `coversByKey`'s own direct-function unit tests in `operators.test.ts`,
matching Story 3.1's convention there.

AD-4's own text and epics.md's AC both name six fixture categories verbatim ("positive, missing, duplicate,
unexpected, duplicate-key, and empty-set"); all six plus the operand-level cases this story's own Decisions
introduce:

1. **Positive.** `expected` and `actual` agree on `id` (any order) → `true`.
2. **Missing (omission).** `actual` carries a strict subset of `expected`'s ids → `false`.
3. **Duplicate (padding).** `actual` repeats one record enough times to match `expected`'s cardinality while
   omitting a different one, the historical `[n-1, n-1, n-1]` shape AD-4's own text names. Resolves `false`,
   via the duplicate-`actualKey`-value check firing before the loop over `expected` even starts.
4. **Unexpected.** `actual` carries every expected id plus one distinct extra → `false`, via a leftover
   entry in `actualByKey` after every `expected` element is consumed.
5. **Duplicate-key.** Two *different* `actual` records (not an identical repeat, distinguishing this
   fixture from case 3) share one `id` value → `false`, same code path as case 3, pinned as its own fixture
   because AD-4 names it as a distinct worked example.
6. **Empty-set.** Both `expected` and `actual` resolve to `[]` → `insufficient-evidence` with
   `introductionCondition: 'empty-collection'`, via the genuine-empty-array branch, never the `ABSENT`
   carve-out. **This is a dispatch-level result only.** Called directly, `coversByKey([], [], ...)` returns
   `true`: a vacuous bijection over two empty sets is a correct answer for the pure function, which has no
   `insufficient-evidence` to return. `operators.test.ts`'s own direct unit test for this shape asserts
   `true`; only `resolution.test.ts`'s dispatch-level fixture asserts `insufficient-evidence`. State both
   expectations explicitly in each test file so a reader does not read one as contradicting the other.
7. **`ABSENT` `expected`** (a `referenceSet` identifier the stub resolver's map does not contain, reusing
   the existing `?? ABSENT` fallback in `makeStubResolver`; no resolver change needed) → `false`, proving
   Decision 1's carve-out for the `expected` side.
8. **`ABSENT` `actual`**, with `pointerDenotesCollection` answering `true` for that pointer → `false`. This
   is the load-bearing contrast fixture: assert it against the same style of collection-typed-`ABSENT` case
   Story 3.2's own resolution.test.ts already pins for a different operator, which resolves
   `insufficient-evidence` there. Stating both side by side makes the difference between the two operators'
   handling of the identical `ABSENT`-plus-collection-typed shape explicit.
9. **`actual` resolves to a non-array, non-`ABSENT` value** (a type mismatch) → `false`.
10. **An `actual` element missing `actualKey`** → claims a synthetic, un-claimable slot rather than being
    excluded outright (review-found fix, Decision 5/6); pin a case where this causes an otherwise-matching
    `expected` element to read as omitted (`false`), and a case where it surfaces as an unmatched extra
    beyond an otherwise-complete match (also `false`).
11. **An `expected` element missing `expectedKey`** → the loop's own lookup finds `ABSENT` and returns
    `false` directly.
12. **The `expected`-operand array-narrowing guard.** `makeResolverWithMisbehavingReferenceSet` (already
    built by Story 3.2, no change needed) makes the `expected` position resolve to a non-array, non-`ABSENT`
    value → `resolveCheck` throws a plain `Error`, asserted `instanceof Error` and **not**
    `instanceof RuntimeFault`, matching the array-narrowing-guard convention `resolution.test.ts` already
    uses for `setMembership`'s and `containment`'s own guards.
13. **The guard fires even when `actual` is genuinely empty.** `expected` malformed (same misbehaving
    resolver as case 12) *and* `actual` resolves to `[]` → still throws, never `insufficient-evidence`. This
    is the case Decision 7 exists for: pins that the guard check runs before the emptiness check can mask it.
14. **A malformed `actual` outranks a genuinely empty `expected`.** `actual` resolves to a non-array,
    non-`ABSENT` value (case 9's shape) *and* `expected` resolves to `[]` → `false`, never
    `insufficient-evidence`. Proves the emptiness check does not run before `coversByKey`'s own
    malformed-`actual` guard gets a chance to answer.
15. **`ABSENT` `expected` outranks a genuinely empty `actual`.** `expected` resolves `ABSENT` (case 7's
    shape) *and* `actual` resolves to `[]` → `false`, never `insufficient-evidence`.
16. **`ABSENT` `actual` outranks a genuinely empty `expected`.** `actual` resolves `ABSENT` (case 8's shape)
    *and* `expected` resolves to `[]` → `false`, never `insufficient-evidence`.

`operators.test.ts`'s own direct `coversByKey()` unit tests cover shapes 1–11 against hand-authored
`expected`/`actual` arrays (shape 6 per its own direct-call expectation stated above; shapes 12–16 are
dispatch-level-only, since they test `resolveNode`'s routing rather than the pure function), plus one
purity/determinism check (same inputs, same output, `actual`'s element order does not matter for the
boolean result even though it can matter for which specific element ends up unmatched in an omission case).

### AC 5 — Tests and the gate

- `operators.test.ts`: add `coversByKey` to the existing import list; a new `describe('coversByKey', ...)`
  block, mirroring the file's existing per-operator convention (`PATH` constant, `ABSENT` import already
  present).
- `resolution.test.ts`: delete the `"the covers-by-key dispatch gap (Decision 5, AC 7 point 7)"` describe
  block (it tests the throwing stub this story removes) and add the AC 4 fixtures above in its place, using
  `resolveCheck` against `populatedContract`'s O-001 node.
- `npm run check:docs` and `npm test` run and the baseline is recorded **before the first edit**.
- `npm run validate` passes at the end. This story touches no schema and no spine text — `check:shareable`,
  `lint:spine`, `check:vectors`, `check:schemas`, `check:ad5-registry` are expected to be no-ops, matching
  Story 3.1 and Story 3.2's own gates. Run them anyway rather than assuming.
- `src/index.ts` is not touched, same rule Story 3.1 and Story 3.2 followed.

## Tasks / Subtasks

- [x] Task 1: preflight (AC 5)
  - [x] Run `npm run check:docs` and `npm test`; record the baseline test count before the first edit.
- [x] Task 2: `coversByKey` and its key-extraction helper (AC 2)
  - [x] `src/core/evaluate/operators.ts`: `keyValueOf`, `coversByKey`; update the stale module-header comment
        (operator count, drop the "Story 3.3's" forward reference).
- [x] Task 3: the real dispatch branch (AC 3, Decision 7)
  - [x] `src/core/evaluate/resolution.ts`: replace the throwing `'covers-by-key'` case with the guard →
        decisive-`false` → emptiness tiered dispatch; import `coversByKey`; update the stale module-header
        comment.
- [x] Task 4: fixtures and tests (AC 4, AC 5)
  - [x] `tests/evaluate/operators.test.ts`: `coversByKey` unit tests.
  - [x] `tests/evaluate/resolution.test.ts`: replace the dispatch-gap block with the real dispatch fixtures.
- [x] Task 5: the gate (AC 5)
  - [x] `npm run validate` green.
- [x] Task 6: record
  - [x] `_bmad-output/project-knowledge/learning-path-step-by-step.md`: one new row, following
        `learning-path-template.md`'s exact shape, after this story is marked done.
  - [x] Dev Agent Record: measured counts, any decision that moved from this story's default.

### Review Findings

- [x] **Resolved (user decision): keep the refactor, record corrected.** [Review][Decision] Undisclosed `resolveNode` switch-to-dispatch-table refactor exceeds AC 1's stated scope, and the Dev Agent Record misdescribes it — AC 1 (line 44) states "No other branch of `resolveNode` changes," but the diff extracts all 16 `op` cases (not just `covers-by-key`) into named handler functions plus an `operatorHandlers` lookup table, ~340 lines of restructuring across `src/core/evaluate/resolution.ts`. Both the Completion Notes List (line 613: "No deviation from any of the story's seven Decisions") and the File List (line 643: `resolution.ts` "edited: `'covers-by-key'` dispatch branch, `coversByKey` import, header comment") describe only the one-branch change AC 1 promised, not what the diff actually contains. Four independent review layers (blind-hunter, edge-case-hunter's downstream verification-gap pass, and the acceptance-auditor) each surfaced this; all confirm the refactor is behavior-preserving (every extracted handler is a line-for-line match of its old switch case, and `npm run validate`'s reported test counts are consistent with no regression) — this is a scope/disclosure question, not a correctness one on its own (see the separate Patch finding below for the one correctness regression the refactor did introduce). **Needs a human call:** keep the refactor and correct the Dev Agent Record to describe it accurately, or revert `resolution.ts` to the one-branch change AC 1 actually specified and land the refactor as its own follow-up change.
- [x] **Fixed:** `Object.hasOwn(operatorHandlers, expression.op)` guard added before the lookup. [Review][Patch] `operatorHandlers[expression.op]` dispatch lookup is reachable with `Object.prototype` property names, silently defeating the out-of-union guard [src/core/evaluate/resolution.ts:562-607] — `operatorHandlers` is a plain object literal (`{...}`), so it inherits `Object.prototype`. The lookup `operatorHandlers[expression.op]` followed by `if (!handler) throw` (line 602) does not distinguish an own key from an inherited one: for `expression.op === 'constructor'`, the lookup resolves to the (truthy) `Object` constructor, the guard does not fire, and `handler(expression, boundElement, ctx)` becomes `Object(expression, boundElement, ctx)`, which (per `Object()`'s no-`new` semantics) returns `expression` itself unchanged — `resolveNode` silently returns the raw `Expression` node as a bogus `CheckResolutionValue` instead of throwing the guard's own documented error. Other `Object.prototype` names (`toString`, `hasOwnProperty`, `valueOf`, `isPrototypeOf`, `toLocaleString`) similarly bypass the guard, producing either a wrong-typed return or an unrelated `TypeError`. The old `switch` statement this replaced was immune by construction (`case` labels are literal comparisons, not property lookups), so this is a regression introduced by the refactor, at exactly the boundary the guard's own comment (lines 591-598) says exists for "unvalidated input, or a future schema version." Fix is mechanical and unambiguous: check `Object.hasOwn(operatorHandlers, expression.op)` before indexing, or build `operatorHandlers` via `Object.create(null)` (or a `Map`) so nothing is inherited.
- [x] **Fixed:** two dispatch fixtures added (one-empty-vs-non-empty, both directions). [Review][Patch] `covers-by-key`'s asymmetric single-empty-operand branch is untested at dispatch level [tests/evaluate/resolution.test.ts, `the real covers-by-key dispatch branch` describe block; src/core/evaluate/resolution.ts:363-372] — the emptiness gate `bothPresentArrays && (expectedResolved.length === 0 || actualResolved.length === 0)` is an `||`, matching Decision 7's stated intent (a single empty, well-typed operand should already read as `insufficient-evidence`, not just the both-empty case AC 4's fixture 6 pins). But every existing dispatch fixture either has both operands empty (fixture 6) or pairs a higher-tier condition (guard/`ABSENT`/malformed-`actual`) with an empty operand (fixtures 13-16) — none exercises one operand genuinely empty against the other genuinely non-empty and well-formed. Swapping the `||` for `&&` would not fail any current test. Add two fixtures: `expected` non-empty/well-formed with `actual` resolving to `[]`, and the mirror, both asserting `insufficient-evidence`.
- [x] **Fixed:** distinct-keys unit test added. [Review][Patch] No test exercises `expectedKey !== actualKey` [tests/evaluate/operators.test.ts, `describe('coversByKey', ...)` block] — every `coversByKey(...)` call across both `operators.test.ts` and `resolution.test.ts` passes `'id', 'id'`, inherited from reusing `populatedContract`'s O-001 node (which happens to use the same key name on both sides) for every dispatch fixture, and the hand-authored `operators.test.ts` cases copy the same convention. `coversByKey`'s own signature takes two independent key parameters; nothing pins that matching on two differently-named keys (e.g. `id` vs `itemId`) actually works. Add one direct-call unit test with distinct `expectedKey`/`actualKey` values.
- [x] **Fixed:** Completion Notes and File List corrected. [Review][Patch] `resolveCoversByKeyNode`'s Completion Notes claim that `sprint-status.yaml` "was left untouched" is false [line 638; `_bmad-output/implementation-artifacts/sprint-status.yaml`] — the diff changes `3-3-covers-by-key-as-a-bijection: backlog` to `in-progress` in that file. The parenthetical's point (this repo's convention that a story reading `done` need not force `sprint-status.yaml` to `done` too) is correct and doesn't need to change, but the literal claim that the file wasn't touched is contradicted by the diff itself, and the File List (starting line 641) omits `sprint-status.yaml` entirely despite it being a changed file. Correct the sentence to state what actually happened (updated to `in-progress`, not to `done`) and add the file to the File List.
- [x] **Fixed:** split into two `it` blocks. [Review][Patch] Type-mismatch unit test bundles two input shapes into one `it` [tests/evaluate/operators.test.ts:658-665] — `'resolves false when actual is a non-array, non-ABSENT value (type mismatch)'` makes two `expect(...).toBe(false)` calls (a string, then a plain object) inside one test, unlike every other test in the same `describe('coversByKey', ...)` block, which pins one input shape per test. If only one of the two shapes regresses, the failure won't identify which. Split into two `it` blocks.
- [x] **Fixed:** a keyless `actual` row now claims a synthetic per-index slot instead of being skipped, so it counts as an unmatched extra. Verified by reverting the fix locally and confirming the new regression tests go red (`true` instead of `false`) before re-applying it. [Review][Patch] `coversByKey` can certify a non-bijection when every expected row matches and an additional actual row lacks `actualKey`; the unkeyed row is skipped, leaving the map empty and returning `true`, contrary to AC 2 and AD-4's equal-cardinality and missing-key rules [src/core/evaluate/operators.ts:422]
- [x] **Fixed:** the operator's own doc comment, this section's Decision 6, and learning-path Step 11's `Rules` bullet all corrected to state the real reason `actualByKey.size === 0` proves a bijection (the map's starting size already equals `actual`'s cardinality), not the false general claim about injective maps over finite sets. A second, independent re-verify pass caught that Step 11's separate `Watch out` bullet still described the pre-fix skip behavior; corrected that too. [Review][Patch] Correct the bijection proof in the operator comment, Decision 6, and Step 11: an injective total map between arbitrary finite sets is not automatically surjective; the remaining-map check establishes surjectivity only after every actual row participates in the keyed relation [src/core/evaluate/operators.ts:400]
- [x] **Fixed:** 5 tests added (structural key values, type-distinct values, `__proto__` and `constructor` as own key names, and one negative case: `constructor`'s inherited value on `{}` correctly reads as missing). [Review][Patch] Add key-domain regression coverage for non-string and structural key values, type-distinct values, and own versus inherited special-property names; the schema permits any `JsonValue` at the named field and current tests exercise only ordinary string IDs [tests/evaluate/operators.test.ts:600]
- [x] **Fixed:** heading restored below. [Review][Patch] Restore a Decisions heading before the seven numbered decisions so they are not structurally nested under `### Review Findings`, where downstream readers can mistake the implementation contract for review output [_bmad-output/implementation-artifacts/3-3-covers-by-key-as-a-bijection.md:360]

## Decisions taken during story creation

Each is settled with a stated default and its downstream consequence. Per this project's standing
convention (settle ambiguities in the story or the code, record the reasoning, do not escalate to a new
architecture revision), proceed unless the user amends one; record the outcome in the Dev Agent Record.

1. **`ABSENT` on either `covers-by-key` operand is never routed through Story 3.2's general
   empty-collection interception, even though `actual`'s pointer is always declared collection-typed.**
   AD-4's own covers-by-key paragraph states this explicitly and specifically: "An `absent` operand on
   either side resolves **false** under AD-26's rule rather than `insufficient-evidence`, because a
   collection that is missing entirely is a detected defect and not an empty examination." Read against
   Story 3.2's Decision 1 ("every operand of every leaf node… without a further decision"), this is not a
   contradiction but AD-4's own stated exception for the one operator whose text calls it out by name — the
   general paragraph's "without a further decision" describes the *default*, and this operator's own
   paragraph *is* the further decision, made once, in the same architecture document. Considered and
   rejected: reusing `anyOperandEmpty`/`operandDenotesEmptyCollection` unmodified for `covers-by-key`, on the
   reasoning that uniformity is simpler to maintain. Rejected because it would produce `insufficient-evidence`
   for an absent, collection-typed `actual` pointer, the literal opposite of what AD-4's covers-by-key text
   states, and "simpler to maintain" does not outrank the spine's explicit rule for this one case.
   **Consequence:** `resolveNode`'s `'covers-by-key'` branch checks only the genuine-empty-array condition
   directly (AC 3's code), never calling the shared helpers; `coversByKey` itself resolves `ABSENT` to
   `false`. AC 4's fixtures 7 and 8 pin both sides, and fixture 8 is deliberately contrasted against another
   operator's own collection-typed-`ABSENT` fixture (already in `resolution.test.ts`) to make the difference
   visible rather than implied.
2. **A non-array, non-`ABSENT` `actual` (a type mismatch) resolves `false`, checked inside `coversByKey`
   itself, not at the dispatch layer.** No AD, ADR, or fixture states this case by name — `actual`'s operand
   is an ordinary `{ pointer }` position, and no compile-time check (`quantifier-over-non-collection`'s
   sibling for this operator does not exist yet) rules it out before this function runs. Considered and
   rejected: treating it as `insufficient-evidence` (Story 3.2's Decision 4 precedent for a quantifier's
   non-collection `collection` operand). Rejected because that precedent's own reasoning was about
   *emptiness*-shaped ambiguity ("no other rule owns evidence-cost limits… fails exactly as safely as the
   genuinely-empty case already does"), and this case is not emptiness-shaped: it is the same
   type-mismatch-resolves-false situation AD-26 states in general terms ("a type mismatch between operands
   likewise resolves false rather than erroring") and every one of Story 3.1's ten operators already
   implements. Using that general rule here, rather than inventing an operator-specific reading, is the
   uniform choice, not a bespoke one — and it stays consistent with AD-4's covers-by-key paragraph, whose own
   adjacent language treats "the collection is not there" (the `ABSENT` case, one sentence earlier) as "a
   detected defect and not an empty examination," the same character of outcome a type mismatch is.
   **Consequence:** `coversByKey`'s own `!Array.isArray(actual)` guard returns `false` directly, mirroring
   `containment`'s self-contained `Array.isArray(container)` check; AC 4's fixture 9 pins it.
3. **`expected`'s array-narrowing guard lives in `resolveNode`'s dispatch and throws a plain `Error` — not
   inside `coversByKey`, and not a silent `false`.** `expected`'s operand form is restricted to a reference
   set (`CoversByKey`'s own schema description: "`expected` is legally a reference set"), so a conforming
   resolver returns `ABSENT` (Decision 1) or a `JsonValue[]` of members and nothing else; any other shape is
   a resolver integration bug or an unresolved reference set that slipped past compilation, the same two
   causes Story 3.2's own `setMembership`/`containment` guards already name for the identical situation on
   their own reference-set positions. The shape is similar to those two guards but not identical: this one
   must explicitly exempt `ABSENT` (`expectedResolved !== ABSENT &&`) before narrowing, because `ABSENT` is a
   legitimate, tested outcome here (fixture 7) rather than an assumed-impossible one the way it is for
   `setMembership`'s and `containment`'s own reference-set operands. Considered and rejected: skipping the
   guard and letting `coversByKey` iterate a non-array `expected` directly, which would throw an opaque
   `TypeError` from `for...of` instead of a clear, attributed message. Rejected for the same reason Story 3.2
   gave its own two guards: "this guard cannot tell the two apart" is still a better failure than a stack
   trace naming neither. **Consequence:** `coversByKey`'s own `expected` parameter is typed `JsonValue[] |
   typeof ABSENT`, the same typing choice `setMembership` makes for its schema-guaranteed `set` parameter, so
   the guard's job is visible in the type signature and not only in a runtime check nobody has to trust; AC 4's
   fixture 12 pins the guard firing, reusing Story 3.2's own `makeResolverWithMisbehavingReferenceSet`
   unchanged.
4. **Duplicate `actualKey` values are detected explicitly and resolve `false`; duplicate `expectedKey`
   values are not separately checked.** AD-4's own text states both halves: response-side duplicates "resolve
   false at scoring time," while a duplicate inside a contract-declared reference set "fails compilation
   under `malformed-operator-expression`," which epics.md's own AC restates verbatim ("contract-side
   duplicate keys failed compilation upstream"). This story inherits the same "assumed
   compile-time-prevented" convention Story 3.1 and Story 3.2 already apply to `unresolved-reference-set`
   and to operand arity: this runtime module does not re-implement a not-yet-built compiler's checks.
   **Consequence:** `coversByKey`'s `actualByKey` map rejects a second element claiming an
   already-populated digest (AC 4 fixtures 3 and 5); no equivalent check exists for `expected`, but the
   same map-based match fails closed (resolves `false`, never mis-pairs) if that assumption is ever
   violated, since a duplicate `expectedKey` value's second lookup finds the entry already deleted by its
   first — recorded here so a future reader does not mistake the asymmetry for an oversight.
5. **An element missing the named key, on either side, gets no dedicated early return — it resolves `false`
   as a natural consequence of the matching algorithm, not a distinct branch.** AD-4: "An element missing
   the named key resolves false rather than erroring, consistent with AD-26's treatment of `absent`."
   Considered and rejected: an explicit `if (missingKeyAnywhere) return false` scan before the main loops,
   which would make the rule more visually prominent. Rejected because it would duplicate work the
   algorithm already does for free — an `expected` element missing its key fails its own lookup
   immediately, no separate branch needed, and a separate scan would need to re-walk both collections to
   state a fact the existing loop already enforces. **Consequence:** `keyValueOf`'s own doc comment states
   this explicitly (AC 2's code block) so a future reader does not mistake the absence of a dedicated
   branch for an unhandled case; AC 4's fixtures 10 and 11 pin both sides with concrete examples.
   Correction from review: on the `actual` side, this decision originally claimed a missing-key element
   "simply never appears as a claimable digest," implying it drops out of the match index entirely for
   free the same way the `expected` side does. That was wrong: dropping it out entirely made it invisible
   to the cardinality check too, not just unclaimable, letting a keyless extra `actual` row certify a
   false bijection. The `actual` side does need one small piece of dedicated handling that the `expected`
   side does not: a synthetic, un-claimable slot per missing-key element, so it still counts against
   cardinality without ever being matchable. See Decision 6's consequence for the fix.
6. **The bijection is checked by an equal-cardinality-implicit map algorithm, never a separate
   `expected.length === actual.length` comparison.** `actualByKey` is built to start with exactly one
   entry per `actual` element (every element claims a slot, real or synthetic; see the review-found fix
   below), and the `expected` loop deletes exactly one entry per element that finds a match. A nonzero
   leftover after every `expected` element is consumed is exactly AD-4's "carries unexpected rows" case,
   and a failed lookup mid-loop is exactly its omission case; `actualByKey.size === 0` on completion is
   therefore the bijection condition itself, not an approximation reached by an unrelated general claim
   about injective maps between finite sets (that claim is false without the equal-starting-size fact
   above; an earlier draft of this reasoning stated it that way and review caught it). Considered and
   rejected: an explicit upfront length check as a fast-path or a defensive redundancy. Rejected as
   genuinely redundant, not merely stylistically so — every case an explicit length check would catch
   (fewer `actual` elements than `expected`, or more) is already caught by the loop's own lookup-miss or
   leftover-count, and a redundant check that can never fire independently of the loop's own outcome is
   dead code with a maintenance cost, not a safety net. **Consequence:** no length comparison appears
   anywhere in `coversByKey`; this reasoning is recorded here so a future reviewer does not read its
   absence as a missed requirement. Review also found that an `actual` element missing `actualKey` was
   being skipped outright rather than given a slot, which broke the "every element starts with a slot"
   premise this decision depends on and let a keyless extra row escape detection; fixed by giving it a
   synthetic, per-index, un-claimable slot instead of skipping it.
7. **When the dispatch branch's three per-operand special cases — the `expected`-malformed guard, the
   `ABSENT`/malformed-`actual` decisive-`false` shortcut, and genuine-empty-array `insufficient-evidence` —
   would disagree because they land on *different* operands of the same node, the guard wins first, then
   the decisive-`false` shortcut, then emptiness last.** AD-4 states each of the three in isolation (the
   guard is this story's own construction; "two empty collections" and "either side absent" are AD-4's own
   worked examples) but never states what happens when, say, `expected` is malformed while `actual` is
   genuinely empty, or `expected` is `ABSENT` while `actual` is genuinely empty. An unconditional,
   symmetric `||` across both operands — checking emptiness before the guard or before `ABSENT`, the most
   naturally-written order — would let one operand's ordinary, benign emptiness silently swallow the *other*
   operand's own malformed or `ABSENT` state, which for the guard case in particular defeats its entire
   purpose (Decision 3's "this guard cannot tell the two apart" is supposed to be a better failure than a
   silent wrong answer; absorbed into `insufficient-evidence`, it would not even be that — it would be a
   silently-absorbed answer with the defect never surfaced at all). Considered and rejected: leaving the
   order unspecified as an implementation detail, on the reasoning that AD-4 never names these mixed cases
   and so nothing constrains them. Rejected because a real, reachable ordering choice with observably
   different results is never "no rule" — it is an unstated rule waiting to be picked inconsistently by
   whoever writes the code, and this project's standing convention is to settle exactly this kind of gap
   here rather than leave it implicit. The chosen order is not arbitrary: tier 2 (`ABSENT`/malformed-`actual`
   → `false`) outranking tier 3 (emptiness → `insufficient-evidence`) is the same priority `allOf` already
   gives a decisive `false` child over an `insufficient-evidence` sibling elsewhere in this file ("a genuine
   `false` stays decisive… a detected defect is information and discarding it would hide the thing the
   product exists to find") — this story does not invent a new philosophy, it applies the one the codebase
   already committed to for exactly this shape of conflict. Tier 1 (the guard) outranks everything because it
   is not a data outcome at all; it signals the harness itself is untrustworthy, and no data-shaped answer
   from the other operand should suppress that. **Consequence:** AC 3's dispatch code checks the guard first,
   unconditionally; then delegates to `coversByKey` whenever either operand is `ABSENT` or `actual` is
   malformed (skipping the emptiness check entirely in that case); and only checks genuine emptiness once
   both operands are confirmed present, well-typed arrays. AC 4's fixtures 13–16 pin all four cross-operand
   combinations a naive symmetric check would get wrong, including the `ABSENT`-vs-empty interaction (not
   only the malformed-vs-empty one) since the same reasoning covers both.

## Dev Notes

### Read these files before writing anything

1. `src/core/evaluate/resolution.ts`: in full — the module this story edits one case of. `Decision 5`'s own
   comment on the current throwing branch, `operandDenotesEmptyCollection`/`anyOperandEmpty`
   (why this story's branch does not call them), and `setMembership`'s/`containment`'s own array-narrowing
   guards (the pattern AC 3's new guard copies).
2. `src/core/evaluate/operators.ts`: in full — `isPlainObject`, `structurallyEqual`'s use of
   `digestArtifact`, and `containment`'s own self-contained `Array.isArray` check (the pattern `coversByKey`
   copies for its own `actual` parameter).
3. `src/core/schemas/expression.ts`, lines 353–364: `CoversByKey`'s own schema, including its operand-type
   description naming `expected` a reference set and `actual` a collection pointer.
4. `src/core/schemas/reference-set.ts`: `ReferenceSetDeclaration` — why members are objects, not scalars,
   and why `covers-by-key` and `set-membership` share one declared shape.
5. `tests/schemas/fixtures/relevance-contracts.ts`: `populatedContract`'s O-001 oracle and reference set —
   this story's one real `check` tree to reuse for `resolution.test.ts`'s dispatch-level fixtures.
6. `tests/evaluate/fixtures/stub-resolver.ts`: `makeStubResolver` (its `referenceSet` branch already
   returns `ABSENT` for an unknown identifier — no change needed for fixture 7) and
   `makeResolverWithMisbehavingReferenceSet` (reused unchanged for fixture 12).
7. `ARCHITECTURE-SPINE.md`: AD-4 in full (185–201), read slowly — the `covers-by-key` paragraph is this
   story's entire semantic content. AD-26 (384–392), the `absent`/type-mismatch rules this story's Decision
   1 and Decision 2 apply.
8. `epics.md`: Story 3.3's own AC (308–319).
9. `_bmad-output/implementation-artifacts/3-1-scalar-operators-over-the-evidence-domain.md` and
   `3-2-connectives-quantifiers-and-three-valued-resolution.md`: house style, and the precedents this
   story's Decisions cite by number (Story 3.2's Decision 1, Decision 4, Decision 6; Story 3.1's `equality`
   and `containment` type-mismatch reasoning).

### Project structure notes

- No new files. Two `src/` edits (`operators.ts`, `resolution.ts`), two test edits
  (`operators.test.ts`, `resolution.test.ts`).
- No `core/schemas/` edit. No spine edit. No new `RuntimeFaultCode` — `coversByKey` never throws a
  `RuntimeFault`, only the one plain `Error` its dispatch-layer guard raises, matching `setMembership`'s and
  `containment`'s own guards exactly.
- `src/index.ts` not touched (AC 1, AC 5), same rule as Story 3.1 and Story 3.2.

### Testing requirements

- `tsconfig.json`'s `noUncheckedIndexedAccess` applies to `expression.operands` destructuring in the new
  dispatch branch, matching every other branch in this switch.
- `biome.json`'s `useImportType`/`useExportType`: `JsonValue`, `ResolvedValue` are type-only imports where
  used only as types (already the case in `operators.ts`; no change to its import style).
- No configured coverage threshold, matching Story 3.1's and Story 3.2's own testing-requirements note: the
  proxy is AC 4's fixture list plus assertions specific enough to fail if the property they name is removed.

### References

- `_bmad-output/planning-artifacts/epics.md`: Epic 3 intro (274–276), Story 3.3 (308–319).
- `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md`:
  AD-4 (185–201, the `covers-by-key` paragraph), AD-26 (384–392).
- `src/core/schemas/expression.ts` (`CoversByKey`, lines 353–364), `reference-set.ts`.
- `src/core/evaluate/operators.ts`, `resolution.ts`, `resolved-value.ts`.
- `tests/schemas/fixtures/relevance-contracts.ts` (`populatedContract`'s O-001).
- `tests/evaluate/fixtures/stub-resolver.ts`.
- `_bmad-output/implementation-artifacts/3-1-scalar-operators-over-the-evidence-domain.md`,
  `3-2-connectives-quantifiers-and-three-valued-resolution.md`.

## Suggested Review Order

**The operator itself**

- `keyValueOf`, `coversByKey`: read with Decision 2, 4, 5, and 6 — the type-mismatch, duplicate-key,
  missing-key, and no-separate-cardinality-check reasoning respectively.

**The dispatch branch — the one place this story diverges from Story 3.2's own uniform rule**

- `resolveNode`'s `'covers-by-key'` case: check specifically that it does **not** call
  `anyOperandEmpty`/`operandDenotesEmptyCollection`, and that `ABSENT` reaches `coversByKey` unchanged
  (Decision 1). Compare directly against the collection-typed-`ABSENT` fixture already in
  `resolution.test.ts` for a different operator, which resolves `insufficient-evidence` — the contrast is
  the point.
- **The three-tier precedence (Decision 7):** the guard runs first and unconditionally; `ABSENT`/malformed-
  `actual` is checked and delegated next, before emptiness; genuine emptiness is checked last, only once
  both operands are confirmed present arrays. Verify against fixtures 13–16 specifically — each one puts a
  higher-tier condition on one operand and a lower-tier condition (genuine emptiness) on the other, and the
  higher tier must win every time.

**The guard**

- The `expected`-operand array-narrowing guard: check it fires only for a non-array, non-`ABSENT` value,
  never for a genuine `ABSENT` (Decision 3).

**Fixtures**

- The duplicate-vs-duplicate-key pair (AC 4 fixtures 3 and 5): same code path, two distinct worked
  examples, both required by AD-4's own naming.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5), via Claude Code.

### Debug Log References

- Baseline before the first edit: `npm run check:docs` → 53 file(s) OK; `npm test` → 35 test files,
  1493 tests passed. `baseline_commit` (`4311570`) matched `HEAD` exactly, so no drift to reconcile.
- `npx tsc --noEmit -p .` after the first draft of `keyValueOf` failed: `element[key]` under
  `noUncheckedIndexedAccess` types as `JsonValue | undefined` on `JsonObject`'s index signature, which
  the declared `JsonValue | typeof ABSENT` return type rejects. Fixed with an `as JsonValue` cast after
  the `Object.hasOwn` check already proves the key present, the same narrowing-cast pattern `shape`
  already uses in this file for its own per-key type check. Not one of this story's Decisions: a
  mechanical type-level fix with no semantic content, so it is not written up as one.
- `npx tsc --noEmit -p .` clean after that fix, before running any test.
- `npx vitest run tests/evaluate/` before writing new tests: 3 files, 120 tests, 1 expected failure
  (`the covers-by-key dispatch gap`, which asserted a throw that the new real branch no longer
  produces), 119 passed. Confirms the new dispatch branch actually replaced the stub rather than
  leaving it reachable.
- `npx vitest run tests/evaluate/operators.test.ts` after adding `coversByKey`'s 12 direct unit tests
  (11 AC 4 shapes + 1 purity/determinism check; shape 6's own direct-call expectation folded into the
  empty-set test): 77 tests, all passed.
- `npx tsc --noEmit -p .` failed again after the resolution.test.ts fixtures were added: two
  heterogeneous-object-array literals (`[{ notId: 't-1' }, { id: 't-2' }]`) in operators.test.ts inferred
  a union type with optional `undefined`-valued properties, which `JsonValue`'s index signature rejects.
  Fixed with explicit `const expected: JsonValue[] = [...]` / `const actual: JsonValue[] = [...]`
  annotations on the two affected fixtures, and a new type-only `JsonValue` import. Clean after.
- `npx vitest run tests/evaluate/` after both test files were complete: 3 files, 147 tests, all passed
  (65 baseline `operators.test.ts` + 12 new = 77; 52 baseline `resolution.test.ts` − 1 removed
  dispatch-gap test + 16 new AC 4 fixtures = 67; plus 3 unchanged in `resolved-value.test.ts`).
- `npx biome check` on the four touched files: two formatting-only findings (one long single-line
  `expect(...).toBe(false)` in each test file that the formatter wanted wrapped differently), fixed by
  `biome check --write`; no logical change, confirmed by `git diff` showing only whitespace/wrapping.
- `npm run validate`: typecheck, lint (one pre-existing informational note, unrelated to this story: the
  repo's `biome.json` `$schema` pins 2.5.7 against an installed CLI of 2.5.8, present before this
  story's changes, not touched by them, and not a failure), check:docs, check:shareable, lint:spine,
  check:vectors, check:schemas, check:ad5-registry all green (all five no-ops over this story's
  src/test-only diff, as AC 5 predicted); `test` → **35 test files, 1520 tests passed** (1493 baseline
  plus 27: 12 in `operators.test.ts`, net +15 in `resolution.test.ts`, which is 16 new AC 4 dispatch
  fixtures minus the 1 removed dispatch-gap test). Green end to end, no fix-up round needed beyond the
  two mechanical type-narrowing fixes and the one biome formatting pass above.
- `src/index.ts` left untouched, confirmed by `git status --short` after all edits.

### Completion Notes List

- Implemented `keyValueOf` and `coversByKey` in `src/core/evaluate/operators.ts` (AC 2) and the real
  `'covers-by-key'` dispatch branch in `src/core/evaluate/resolution.ts` (AC 3) verbatim per the story's
  own code blocks, with the one type-level cast noted above. Both files' stale module-header comments
  updated (operator count to eleven; the "Story 3.3's"/"Story 3.3 replaces" forward references dropped).
- Beyond AC 1's stated "no other branch of `resolveNode` changes": `resolveNode`'s whole 16-case `switch`
  was restructured into a functional dispatch table (one handler function per `op`, collected in an
  `operatorHandlers` lookup) after the initial implementation, at the user's direction, because the
  switch was growing unwieldy across stories. Reviewed and confirmed behavior-preserving (every handler
  is a line-for-line match of its old switch case); the user chose to keep it in this story rather than
  split it into a separate change. Review caught one real regression the refactor introduced: a plain
  object literal inherits `Object.prototype`, so `op: 'constructor'` resolved to `Object` itself and
  slipped past the `if (!handler)` guard silently. Fixed with an `Object.hasOwn` check before the lookup.
- No deviation from any of the story's seven Decisions. All seven's stated consequences are present in
  the shipped code exactly as described: `ABSENT` bypassing the shared empty-collection helpers
  (Decision 1), the self-contained `!Array.isArray(actual)` guard inside `coversByKey` (Decision 2), the
  dispatch-layer `expected`-operand array-narrowing guard exempting `ABSENT` (Decision 3), no separate
  duplicate-`expectedKey` check (Decision 4), no dedicated missing-key branch (Decision 5), no separate
  cardinality comparison (Decision 6), and the guard-then-decisive-false-then-emptiness tier order
  (Decision 7).
- All 16 of AC 4's fixture shapes are present, split exactly as AC 4 and AC 5 specify: shapes 1–11 as
  `operators.test.ts` direct-call unit tests (plus the purity/determinism check), shapes 12–16 as
  `resolution.test.ts` dispatch-level-only fixtures (they test `resolveNode`'s routing, not the pure
  function), and shape 6 stated explicitly in both files with its two different expected answers
  (`true` direct-call, `insufficient-evidence` dispatch-level) called out side by side so neither reads
  as contradicting the other.
- `resolution.test.ts`'s fixture 8 (`ABSENT` `actual`, collection-typed pointer) is deliberately placed
  and worded to contrast against the pre-existing "ABSENT on a { pointer } operand" describe block
  immediately above it, which pins `existence`'s own `insufficient-evidence` answer for the structurally
  identical shape. The two blocks sit adjacent in the file specifically so a reader sees the divergence
  without having to search for the comparison.
- `_bmad-output/project-knowledge/learning-path-step-by-step.md`: added Step 11 (table row + full
  section, following `learning-path-template.md`'s exact heading shape) and corrected Step 10's now-
  stale "`covers-by-key` has no operator implementation yet" bullet to point forward at Step 11, so the
  doc no longer states something the codebase has since made false.
- Story `Status` set to `done`, matching Story 3.1's convention for a fully implemented, gate-green
  story (Story 3.2 used `in-review` instead; this project's own recorded convention treats a story file
  reading `done` while `sprint-status.yaml` reads something else as by design, not a defect). Correction:
  `sprint-status.yaml` was not left untouched. This story's own edit set it to `in-progress` when work
  started (per this workflow's own step-03 instructions), from `ready-for-dev`, the value already in the
  uncommitted working tree at that point (an earlier, still-uncommitted edit from story creation). Against
  the last commit the field reads `backlog` -> `in-progress`, since that earlier edit was never committed
  either. The convention above is about `done` not being force-propagated there, not about the file being
  unedited.
- Post-review fixes: added two dispatch-level fixtures for the asymmetric single-empty-operand branch
  (one operand genuinely empty, the other well-formed and non-empty; previously only the both-empty and
  higher-tier-vs-empty cases were pinned), one direct-call unit test with `expectedKey !== actualKey`
  (every prior test reused `'id'` on both sides), and split the bundled type-mismatch unit test
  (string and plain-object shapes) into two, matching the file's own one-shape-per-test convention.
- Second review round found one real HIGH-severity correctness bug (`Review Findings`, this section):
  an `actual` element missing `actualKey` was skipped outright instead of claiming a slot, so a keyless
  extra row beyond an otherwise-complete match went undetected and `coversByKey` certified a
  non-bijection as `true`. Reproduced first (reverted the fix locally, confirmed the new regression
  tests failed with `true` instead of `false`, then re-applied it), matching this project's standing
  convention of proving a bug before trusting a fix. Fixed by giving a keyless `actual` element a
  synthetic, per-index, un-claimable map slot instead of skipping it, so it still counts against
  cardinality. Also fixed: the bijection-proof comment's incorrect general claim ("an injective map
  between finite sets is automatically surjective") in `operators.ts`, Decision 6, and learning-path
  Step 11, all corrected to state the real reason (the map's starting size already equals `actual`'s
  cardinality); Decision 5 corrected to stop claiming the `actual` side drops a keyless element "for
  free" the same way the `expected` side does; 4 key-domain tests added (structural key values,
  type-distinct values, `__proto__` and `constructor` as key names); the missing `## Decisions taken
  during story creation` heading restored above (it had gone missing, leaving the numbered decisions
  structurally nested under `### Review Findings`).

### File List

- `src/core/evaluate/operators.ts` (edited: `keyValueOf`, `coversByKey`, header comment; post-review
  fixed the missing-`actualKey` cardinality bug and corrected the bijection-proof comment)
- `src/core/evaluate/resolution.ts` (edited: `'covers-by-key'` dispatch branch, `coversByKey` import,
  header comment; also restructured `resolveNode`'s switch into a functional dispatch table, with an
  `Object.hasOwn` guard added post-review to close the `Object.prototype` bypass it introduced)
- `tests/evaluate/operators.test.ts` (edited: `coversByKey` import, `JsonValue` type import, new
  `describe('coversByKey', ...)` block; post-review split the type-mismatch test in two, added the
  distinct-keys test, the keyless-extra-row regression tests, and the 4 key-domain tests)
- `tests/evaluate/resolution.test.ts` (edited: `populatedContract` import, `findPopulatedCheck` helper,
  dispatch-gap block replaced with the real dispatch fixtures; post-review added the two
  asymmetric-emptiness fixtures, plus, from CodeRabbit's PR review, two out-of-union-op dispatch tests
  (`'not-an-op'`, `'constructor'`) pinning P16's guard and the `Object.hasOwn` fix directly)
- `_bmad-output/project-knowledge/learning-path-step-by-step.md` (edited: Step 11 added, Step 10's stale
  bullet corrected; post-review corrected Step 11's own bijection-proof bullet)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (edited: `3-3-covers-by-key-as-a-bijection`
  set to `in-progress` when work started, per this workflow's own step; not force-updated to `done`)
