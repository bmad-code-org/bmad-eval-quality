---
epic: 3
story: 1
key: 3-1-scalar-operators-over-the-evidence-domain
baseline_commit: a38bf966f6791dba7fb6389efd75865e4f38fb3a
---

# Story 3.1: Scalar operators over the evidence domain

Status: done

## Story

As the enforceable half of every oracle,
I want the operators AD-4 closes the vocabulary at, minus `covers-by-key`, implemented as pure
functions with fully specified semantics,
so that two implementations cannot resolve one expression differently.

## Acceptance Criteria

### AC 1 — Module location, the resolved-value domain, purity, and what this story does not build

**A new module, `src/core/evaluate/`, not `src/core/score/`.** The primary evidence is the Capability →
Architecture Map: it assigns AD-4 to `core/compile`, `core/seal`, `core/schemas` under VFR-2
(`ARCHITECTURE-SPINE.md:606`) and does **not** list AD-4 under VFR-7's `core/score` row (line 611) —
the architecture's own capability table has never treated AD-4's operators as score-side. `core/compile`
is ruled out too, despite appearing in that same VFR-2 row: `core/compile`'s job is "behaviour input ->
Eval Contract" (the Structural Seed, line 581) — producing the contract artifact from author input, a
compile-time concern over declarations, never over resolved runtime evidence. This story's functions run
against resolved evidence values during scoring, a different data flow with nothing in common with
`compile`'s job; AD-4 appears in that VFR-2 row because `compile` enforces AD-4's *schema-side* arity
and operand-type constraints (already shipped in `expression.ts`), not because `compile` runs the
operators. Corroborating, but not by itself load-bearing (see Decision 10 for why): the "Owed to the
reference implementation" section states *"These are open defects in the `score` half, not
decisions… No epic touches `score` until these close"* (lines 648, 652) — read as a blanket
directory-placement rule this would also block Epic 4's own compiler work, since the Seed elsewhere
says "No epic touches either half" where "either half" includes `compile` (line ~592). Read instead as
what it says — a statement of epic *scope*, made when no epic was yet open against either half — it
still corroborates the placement, alongside Epic 3's own explicit stop-before-outcome-states boundary
(*"this epic stops at resolution and records it"*, epics.md line 276; EPIC-BRIEF.md's Epic 3 section:
*"Must not: map `insufficient-evidence` onto an outcome state. `abstained` is AD-6's and AD-6 is
score-side."*). `core/evaluate/` is not named in the Structural Seed's tree, but that tree is explicitly
non-binding on names: **"Provisional shape… a directory name… is not [amendment-controlled]"** (line
571), and `core/canonical/` is direct precedent — it shipped in Epic 1 and is not in the printed tree
either. `core/evaluate` also matches the epic's own self-description ("the AD-4 evaluator", epics.md
line 274; "evaluation semantics are Epic 3", epics.md line 177).

**The resolved-value domain, not `Operand`.** Every operator function in this story takes
already-resolved values, never a `PointerOperand` / `LiteralOperand` / `ReferenceSetOperand` union
member. Resolving a `{ pointer }` against observed evidence and resolving a `{ referenceSet }`
identifier against the contract's declarations are both pointer/contract-resolution mechanics that
belong to a later epic (Story 4.1, "Pointer resolution and reachability", is Epic 4, sequenced after
this one) — epics are sequenced so no story depends on a later epic's output, exactly as Story 2.1
shipped `renderDirectionText` before `seal()` existed. This story defines the **consumer-side**
contract a later epic's resolver must produce values for, the same relationship Story 2.1's generator
had to Story 2.2's future `seal()`.

Add `src/core/evaluate/resolved-value.ts`:
```ts
/** the value domain every AD-4 operator resolves over. */
import type { JsonValue } from '../schemas/primitives.ts'

/**
 * AD-26: "A pointer that does not resolve yields the distinct value `absent`,
 * which is not `null`." A unique symbol, not a string literal or `null`
 * itself, so it can never collide with a legitimately resolved JSON value —
 * `null` is itself a valid `JsonValue` and a distinct outcome from `absent`.
 */
export const ABSENT: unique symbol = Symbol('absent')

export type ResolvedValue = JsonValue | typeof ABSENT
```
This lives in `core/evaluate/`, not `core/schemas/primitives.ts` beside `JsonValue`: `ABSENT` never
appears on the wire — it is never parsed, never serialized, never part of a published schema — so it
does not belong in the module whose job is the wire-format value domain. This mirrors Story 2.3's own
reasoning for keeping `StructuralFailure` beside the registry it serves rather than beside the stage
that first throws it.

**Purity (AD-1).** Every function in this module is synchronous, deterministic, and pure: no
filesystem, network, clock, subprocess, or randomness. `core/` imports `core/schemas` only, per the
Structural Seed's own header comment on `core/` (`ARCHITECTURE-SPINE.md:575`) — this story's one
addition to that rule is `core/canonical`, for `deep-equality`'s structural comparison (AC 3), the same
kind of named, deliberate exception Story 2.3 took for `core/failure-codes.ts`.

**The absent-collection-typed boundary belongs to Story 3.2, not to these functions, and these
functions cannot police it themselves.** AD-4: *"A pointer the declared response descriptor types as a
collection, which resolves `absent`, counts as an empty collection for this invariant"*
(`ARCHITECTURE-SPINE.md:191`) — i.e. such a pointer must resolve the containing node to
`insufficient-evidence`, never to a plain `false`. Telling that case apart from an ordinary
non-collection-typed `absent` requires the operation's declared response descriptor, a piece of
compile-time contract data this story's functions never receive — they take only a `ResolvedValue`.
**Consequence, stated once here and referenced by every operator whose operand may denote a
collection** (`ordering`'s and `countTolerance`'s sole operand, `containment`'s `container`,
`setMembership`'s implicit collection reading of `value`): each such function still has a
well-defined answer for a bare `ABSENT` input (`false`, per AD-26's blanket comparison rule, stated per
operator below), and that answer is correct **only** for the non-collection-typed case. Story 3.2's
resolution wrapper — which does have the declared response descriptor — must intercept a
collection-typed pointer resolving `ABSENT` and route it to `insufficient-evidence` **before** calling
into this module at all; it must never rely on these functions' own `ABSENT` handling to produce that
outcome, because these functions structurally cannot tell the two cases apart.

**This story builds the ten operators its own AC 3–AC 6 name.** It does **not** build:
- Pointer or reference-set resolution (Story 4.1, Epic 4).
- `covers-by-key`, AD-4's eleventh operator (Story 3.3's own title and scope). The opening sentence
  above already states this precisely — see Decision 1 for why the story statement is worded this way
  rather than restating epics.md's own "eleven" verbatim.
- The three connectives (`all`, `any`, `not`), the two quantifiers (`for-all`, `for-any`), and AD-4's
  three-valued resolution wrapper — the empty-collection `insufficient-evidence` introduction condition
  and its propagation rules — all Story 3.2's ("Connectives, quantifiers, and three-valued resolution").
  **This story's own ten functions are two-valued (`boolean`), never three-valued.** AD-4 states the
  third value is *"an invariant over operands rather than a rule about particular operators… the value
  arrives for every operator now in the closed set… without a further decision"*
  (`ARCHITECTURE-SPINE.md:191`) — i.e. the empty-collection check is a property Story 3.2's wrapper
  applies uniformly *before* invoking an operator, never something an individual operator computes
  about itself. This is why epics.md's own AC for this story never mentions `insufficient-evidence`
  while AC for 3.2 is built entirely around it.
- `CheckResolution` tree assembly (`src/core/schemas/evidence-artifact.ts`) — that shape's own comment
  says "Epic 3 populates it," and the population (walking a `check` tree, invoking these operators at
  the leaves, and building the `{ resolution, introductionCondition, children }` node per position) is
  Story 3.2's orchestration, not this story's. **Read `CheckResolution`'s shape** before writing
  anything, so the operators' `boolean` return values are known in advance to be exactly what Story
  3.2 needs to fold into a `'true' | 'false'` leaf.

### AC 2 — The `ScoringPolicy` field and the `RuntimeFault` code AD-4's regex operator needs

AD-4: *"regex is the ECMA-262 dialect, always fully anchored… and **a match-step budget from the
scoring policy whose breach is a fault, not an outcome state**"* (`ARCHITECTURE-SPINE.md:201`). Neither
half of that sentence has a home yet — confirmed by reading both files in full before writing anything:

1. **`src/core/schemas/scoring-policy.ts` has no budget field.** Add one, last among the schema's
   fields, before `.meta()`. (`ScoringPolicy` carries nine required fields once `...lineageFields`'
   three spread members — `schemaVersion`, `parentDigest`, `revisionCount`, `lineage.ts:32-46` — are
   counted alongside the six named fields; the published `schemas/scoring-policy.schema.json`'s
   `required` array is the fastest way to confirm the count directly rather than trusting this
   sentence.)
   ```ts
   regexMatchStepBudget: z
     .int()
     .min(1)
     .describe(
       "AD-4: \"a match-step budget from the scoring policy whose breach is a fault, not an outcome " +
       "state.\" No other source names a magnitude or a counting rule, which this story settles by " +
       "construction rather than escalating (see the regex operator's own Decision below): the budget " +
       "bounds a pure, static, pre-execution complexity estimate, not a literal engine-internal step " +
       "count. The published default artifact carries 10000.",
     ),
   ```
   Update the `.meta({ description: … })` sentence that lists what the policy "carries" to add "and a
   regex match-step budget" — Story 2.3's own review round found exactly this class of gap (a changed
   count with a stale prose restatement) twice; do not repeat it here.
2. **`src/core/schemas/faults.ts`'s `RuntimeFaultCode` union carries only two members**
   (`'non-canonicalizable-value'`, `'schema-parse-failure'`) even though `ARCHITECTURE-SPINE.md`'s AD-28
   table (lines 408–419) lists nine codes — the file's own header comment states the rule: *"Only codes
   with a genuine thrower belong here."* `budget-exhausted` is already in that table, defined as *"an
   evaluation budget or safety limit is reached"*, commanded by `AD-1, AD-19`. A regex match-step budget
   is exactly such a budget, so **reuse it rather than minting a new code for the budget itself**: edit
   the AD-28 table row's `Commanded by` column from `AD-1, AD-19` to `AD-1, AD-4, AD-19`
   (`ARCHITECTURE-SPINE.md:414`) — a citation-accuracy edit, not a new fault class, so it needs no new
   revision (AD-28's own text: "Adding a class is an amendment to this AD and to no other," line 420 —
   this edit adds no class). This story does mint one genuinely new code,
   `operator-cannot-accept-operand` — its one throw site is `regexMatch`'s invalid-pattern guard (AC 5);
   `equality`/`deep-equality` do **not** throw it (Decision 2 explains why the earlier draft that did
   was rejected). Add the row `| \`operator-cannot-accept-operand\` | an operator receives an operand
   value or expression parameter it cannot accept | AD-4 |`. **Not AD-26**, despite AD-26 stating
   almost this exact phrase (*"an operand type the schema admitted but the operator cannot accept"*,
   line 392) — a code-review pass on this story's own implementation caught that AD-26 assigns that
   exact phrase to `oracle-error`, a score-side **outcome state** (AD-33's territory, Epic 6), not to
   a runtime fault, and this story's own AC 1 forbids Epic 3 from mapping onto outcome states. Citing
   AD-26 here would imply a grounding it does not give: AD-26 routes this phrase to a different,
   not-yet-built mechanism entirely. The row cites AD-4 alone. Run
   `npm run check:docs`, `npm run lint:spine`, and `npm run build:shareable` after the spine edit, then
   confirm `npm run check:shareable` is green, exactly as Story 2.3's Task 2 did for its own spine table
   edit. There is no `check:ad28-registry` script (only `check:ad5-registry` exists) — nothing automates
   a cross-check between this table and `faults.ts`, so get it right by hand and close the gap this
   creates: convert `RuntimeFaultCode` from a bare union to a data-derived type, mirroring
   `failure-codes.ts`'s own shape exactly (`FAILURE_CODES` as the array of record, `FailureCode` derived
   from it) — AD-28's own text says *"the published enumeration is generated from this table"* (line
   420), which a bare TS union can never satisfy:
   ```ts
   export const RUNTIME_FAULT_CODES = [
     'non-canonicalizable-value',
     'schema-parse-failure',
     'budget-exhausted',
     'operator-cannot-accept-operand',
   ] as const
   export type RuntimeFaultCode = (typeof RUNTIME_FAULT_CODES)[number]
   ```
   **This is not a full mirror of AD-28's table the way `FAILURE_CODES` mirrors AD-5's — say so
   explicitly, to save whichever future story builds the checker from discovering it the hard way.**
   `FAILURE_CODES` holds all twenty-one AD-5 codes in table order, which is exactly what lets
   `scripts/check-ad5-registry.ts` assert *set-and-order* equality against the spine. `RUNTIME_FAULT_CODES`
   holds only the codes with a genuine thrower, by `faults.ts`'s own header rule — after this story, four
   of AD-28's ten table rows. A future `check:ad28-registry` analog can therefore only assert a subset
   relationship (every `RUNTIME_FAULT_CODES` member spells a real AD-28 row correctly), never full
   set-and-order equality — a materially different, weaker check than `check-ad5-registry.ts` performs,
   and building an automated checker at all is real, separate scope this story does not take on; note it
   as a candidate for whichever future story next touches this registry.
3. **Locate every existing `ScoringPolicy`-constructing fixture and add the new required field —
   verify the actual impact before editing, it is narrower than it looks.** `grep -rln "ScoringPolicy"
   tests/` returns exactly one file that constructs one:
   `tests/schemas/fixtures/artifact-fixtures.ts` (`scoringPolicyFixture`, currently around line 475,
   registered around line 691) — edit it there. Everywhere else needs **no edit**, confirmed by
   mechanism, not assumption: `tests/schemas/artifact-reject-fixtures.test.ts`'s scoring-policy reject
   cases `structuredClone` the accept fixture and mutate one field (around lines 31–38), so they inherit
   the new field automatically; `tests/schemas/publish.test.ts` pins a `$defs` count of `0` for
   `scoring-policy` (around line 108), and a scalar field adds none; `tests/schemas/published/mutant-generator.test.ts`
   asserts `mutants.length` is `toBeGreaterThan(20)` (around lines 115–117), a floor rather than a pin;
   `tests/schemas/artifact-registry.test.ts` is a bare key list. The one edit beyond the fixture itself:
   regenerate `schemas/scoring-policy.schema.json` (`npm run generate:schemas`, `npm run check:schemas`),
   and re-measure `tests/schemas/published/keyword-mutation.test.ts`'s pinned `'scoring-policy': 29`
   census directly by re-running the count — do not guess the new number, Story 2.3's own Completion
   Notes record exactly this discipline after its own single-field schema addition.

### AC 3 — Identity-family operators: `equality`, `deep-equality`, `existence`, `absence`

Every operand across these four operators is typed `ResolvedValue`. Every function's last parameter is
`artifactPath: string`,
even where the function itself never throws — a uniform call-site shape across all ten functions, since
Story 3.2's resolution layer invokes them generically and a per-function-different arity would cost it
a dispatch table instead of one calling convention.

- **`existence(value, artifactPath): boolean`** — `false` if `value === ABSENT`, else `true`. This is
  true even when `value` is the JSON literal `null`: AD-26 draws `absent` (no pointer resolution) and a
  resolved `null` (the field exists and its value is `null`) as different outcomes, so `existence`
  reads only whether resolution happened at all, never what it produced.
- **`absence(value, artifactPath): boolean`** — the exact complement: `true` if `value === ABSENT`,
  else `false`.
- **`equality(a, b, artifactPath): boolean`** — a three-way branch: genuine type mismatch resolves
  `false` without ever touching canonicalization; a matching scalar type compares with `===`; only a
  matching **compound** type (`array` with `array`, `object` with `object`) reaches structural
  comparison, since that is the one case with no cheaper way to answer:
  ```ts
  type JsonKind = 'string' | 'number' | 'boolean' | 'null' | 'array' | 'object'

  function jsonKind(value: JsonValue): JsonKind {
    if (value === null) return 'null'
    if (Array.isArray(value)) return 'array'
    if (typeof value === 'object') return 'object'
    return typeof value as 'string' | 'number' | 'boolean'
  }

  export function equality(
    a: ResolvedValue,
    b: ResolvedValue,
    artifactPath: string,
  ): boolean {
    if (a === ABSENT || b === ABSENT) return false
    const kindA = jsonKind(a)
    const kindB = jsonKind(b)
    if (kindA !== kindB) return false
    if (kindA === 'array' || kindA === 'object') {
      return digestArtifact(a, artifactPath) === digestArtifact(b, artifactPath)
    }
    return a === b
  }
  ```
  `false` if either operand is `ABSENT` (AD-26) — checked before anything else, on both branches below,
  in both functions; this guard must never move after a digest call, because `ABSENT` is a JS `symbol`
  and `canonicalize`'s default branch faults on symbols, which would turn
  `equality(ABSENT, ABSENT)` into a thrown `RuntimeFault` instead of AD-26's required `false`. A genuine
  type mismatch (`kindA !== kindB` — a string against a number, an array against an object, a scalar
  against either compound kind) resolves `false` **before** canonicalization ever runs — two
  differently-kinded values are never equal, so this needs no digest to answer, and answering it without
  one is what keeps `equality`'s fault surface minimal (see Draft 3's rejection below: this branch is
  exactly what closes the gap Draft 3 left open). If both operands share the same **scalar** kind
  (`string`/`number`/`boolean`, or both `null`), compare with plain `===` — this branch never calls into
  canonicalization either. Only when both operands share the same **compound** kind (`array` with
  `array`, `object` with `object`) does this fall through to `core/canonical/digest.ts`'s
  `digestArtifact` — do not hand-roll a structural comparator, this project already owns one, and this is
  the one case with no cheaper way to answer: two same-shaped compounds may or may not be structurally
  equal, and only canonicalization can tell.
- **`deepEquality(a, b, artifactPath): boolean`** — *"structural over canonical JSON per AD-27, never
  serialization-based"* (`ARCHITECTURE-SPINE.md:201`). `false` if either operand is `ABSENT`, checked
  first, same reasoning as `equality`'s guard above. Otherwise, unconditionally:
  `digestArtifact(a, artifactPath) === digestArtifact(b, artifactPath)` — no scalar fast path here;
  structural comparison, always, is the entire point of this operator's name. Comparing `canonicalize(a,
  artifactPath)` bytes directly is equally correct and avoids two SHA-256 passes the digest form runs
  for nothing; either is fine at these sizes, and if `equality`'s and `deepEquality`'s shared compound
  branch (AC 3's `equality` code block) is pulled into one private helper, bytes over hashes is the
  marginally better choice there.

  **`equality`'s scalar branch is not an optimization, it is what keeps this operator's fault surface
  where it already was.** This design point moved three times during story creation, and all three are
  recorded because a future reader would plausibly re-derive the first two before finding the third
  (Decision 2).
  - **Draft 1:** resolve `false` on any compound operand ("scalar-only equality"). Wrong: a compound
    operand is schema-legal for `equality` (`expression.ts:271` vs `280`, identical operand
    descriptions), and unconditional `false` lets `not(equality(...))` certify "these differ" for a
    comparison the function had no real opinion on — a fail-open.
  - **Draft 2:** scalar-compare with `===`, throw on two same-shaped compound operands. Closes the
    fail-open, but the throw is runtime-data-dependent on `{ pointer }` operands (real evidence,
    `gateCContract` O-008's third node is exactly this shape): a misbehaving SUT returning a compound
    value where a conforming one returns a scalar converts a *detected defect* into an invalidating
    fault — the exact failure AD-26's "Prevents" clause names, *"a whole defect class becoming
    permanently unscoreable"* (`ARCHITECTURE-SPINE.md:384`), entered through operand shape.
  - **Draft 3:** delegate unconditionally to `digestArtifact` for every operand, scalar or compound,
    same as `deepEquality`. This closes Draft 2's shape-triggered fault, but opens the *same class of
    defect a third way*, verified directly against `value-domain.ts` before this draft was rejected: an
    unsafe-range integer (`assertDomainNumber`, lines 36-41 — `JSON.parse('9007199254740993')` yields
    `9007199254740992`, which `Number.isSafeInteger` rejects, and large server-generated IDs are
    ordinary API output, not a pathological case), a lone UTF-16 surrogate in free text
    (`assertDomainString`, lines 49-51), or nesting past `MAX_NESTING_DEPTH` all now make
    `equality(a, 200)` throw where plain `===` used to resolve `false` — a misbehaving SUT's malformed
    scalar output invalidates the run instead of being caught as a defect. Same failure, different
    entry point: operand shape in Draft 2, the value domain in Draft 3.
  - **Draft 4: branch two ways — same-scalar-type takes `===`, everything else (cross-type mismatch or
    same-compound-type) falls through to `digestArtifact`.** Closes Draft 3's plain-scalar leak, but a
    second peer review pass on this exact fix found one case left open: a genuine cross-type pair where
    one side is a domain-violating scalar still falls through and throws —
    `equality(9007199254740992, { a: 1 })` is not the same kind, yet still reaches `digestArtifact` under
    this branching and faults on the unsafe integer, even though a number and an object can never be
    equal and answering that needed no canonicalization at all. Same failure, narrower now (only a
    cross-type pair carrying a domain violation on either side), but still the identical class Drafts 2
    and 3 each opened.
  - **Adopted (above): a three-way branch, cost-ordered.** Type mismatch resolves `false` first, with no
    digest call — two differently-kinded values are never equal, so this needs no canonicalization to
    answer, closing Draft 4's leak completely. Same scalar kind takes `===`. Only a same **compound**
    kind (`array` with `array`, `object` with `object`) reaches `digestArtifact` — the one case with
    genuinely no cheaper answer, and the only case where a fault is now possible at all. **The remaining
    cost, now as small as it gets:** `equality` and `deep-equality` differ only when both operands are
    the *same compound kind* — `equality` still shares `deep-equality`'s fault surface there, since
    there is no structural answer available without canonicalizing, and that is the honest signal in
    exactly the one case where it's unavoidable. Every other input — every type mismatch, every scalar
    pair, however domain-violating — resolves without ever touching canonicalization, restoring
    `equality`'s original, pre-this-story fault surface everywhere it can be restored.

  **`deepEquality`'s fault surface, unconditional and unchanged from this story's earlier drafts:**
  `digestArtifact` throws `RuntimeFault('non-canonicalizable-value', …)` on any of the three conditions
  above. Let it propagate undecorated; do not catch it and return `false`. A node whose operand
  genuinely cannot be canonicalized is not "not equal", it is unevaluable, and `RuntimeFault` is the
  correct signal per the Errors convention (a fault, never a finding). `equality` shares this same fault
  surface, but **only** when it falls through to the compound branch — never on a scalar comparison.

### AC 4 — Membership-family operators: `containment`, `setMembership`

Both use structural (canonical-JSON) element matching, not `===`, for the same reason `deep-equality`
does: a set or a container's elements are not guaranteed scalar.

- **`setMembership(value, set, artifactPath): boolean`** where `set: JsonValue[]`. `false` if
  `value === ABSENT` — per AC 1's absent-collection-typed boundary note, this is correct only when
  `value`'s own pointer is not itself declared collection-typed; Story 3.2 owns telling the two cases
  apart. Otherwise `true` iff `set` contains an element structurally (canonical-JSON) equal to `value`.
- **`containment(container, candidate, artifactPath): boolean`** where
  `candidate: ResolvedValue | JsonValue[]` — `container`'s own `false`-on-`ABSENT` handling below is
  likewise subject to AC 1's boundary note. The schema's `Containment` operand 1 is the general
  `Operand` union (`src/core/schemas/expression.ts`'s `Containment` definition uses `z.tuple([Operand,
  Operand])`, not `SetOperand`), so its resolved shape genuinely varies: a `{ pointer }` or
  `{ literal }` form resolves to a single `ResolvedValue`; a `{ referenceSet }` form resolves to the
  contract's declared members, a `JsonValue[]`. This story's function must accept both shapes because
  the schema already admits both:
  1. `false` if `container === ABSENT`.
  2. If `candidate` is an array (came from a resolved reference set): require `container` to also be an
     array, else `false` (type mismatch). Otherwise `true` iff every element of `candidate` has a
     structurally-equal match somewhere in `container` — set-of-expected-members ⊆ container, by
     canonical-JSON element equality.
  3. Else (`candidate` is a single `ResolvedValue`): `false` if `candidate === ABSENT`. Then branch on
     `container`'s resolved type:
     - **string container:** require `candidate` is also a string, else `false`; result =
       `container.includes(candidate)` (substring containment — the natural read for `stdout`/`stderr`
       free-text evidence).
     - **array container:** `true` iff `container` has an element structurally equal to `candidate`.
     - **object container, or any scalar container:** `false` (type mismatch). An object's key
       presence is already `existence`'s job via a pointer straight at the key; `containment` does not
       duplicate it.

  **This construction is this story's most judgment-heavy piece** — see Decision 3. No AD, ADR, or
  fixture anywhere in the repository states `containment`'s comparison algorithm; `gate-c-contract.ts`
  and `relevance-contracts.ts` (the two real hand-authored contracts) use zero `containment` nodes
  between them, so there is no real usage to check this construction against, only the operand-typing
  rule in `expression.ts` itself, which this construction is built to satisfy exactly (nothing here
  contradicts what the schema already admits).

### AC 5 — `regexMatch`: matching, and the match-step budget

```ts
regexMatch(value: ResolvedValue, pattern: string, matchStepBudget: number, artifactPath: string): boolean
```
- `false` if `value === ABSENT` or `value` is not a string (type mismatch, no coercion).
- **Pattern validity is checked here, not assumed.** `AnchoredPattern` (`expression.ts:132-139`) checks
  only the pattern's first and last character — its own comment says so explicitly (lines 112-119,
  `ANCHORING_RESIDUAL`) — so a schema-valid pattern can still be an invalid ECMA-262 source
  (`^([a$` passes the schema and throws a `SyntaxError` from `new RegExp(...)`). Epic 4's
  `malformed-operator-expression` will eventually catch this at compile time, but it is not built, and
  until it is this is a live path from a schema-valid contract straight into an untyped throw out of
  `core/`. Construct the pattern defensively:
  ```ts
  let compiled: RegExp
  try {
    compiled = new RegExp(pattern)
  } catch (cause) {
    throw new RuntimeFault(
      'operator-cannot-accept-operand',
      artifactPath,
      `pattern is not a syntactically valid ECMA-262 source: ${pattern}`,
      { cause },
    )
  }
  ```
  Rejecting backreferences and lookbehind specifically is still Epic 4's `malformed-operator-expression`
  and not this function's job — this function only guards against a source that fails to *construct* at
  all, not against a constructible-but-forbidden dialect feature.
- **Matching itself is native `RegExp`, in full** — do not hand-write a matcher for this part. Native
  `RegExp` has complete, correct ECMA-262 fidelity (Unicode property escapes, named groups, lookahead,
  everything AD-4's dialect admits) that a hand-rolled subset engine would not, and reinventing it here
  would cost correctness to buy nothing.
- **The match-step budget is a pure, deterministic, pre-execution static gate in two tiers — not a
  literal dynamic engine-step count.** See Decision 4 for why a dynamic count is not attempted at all:
  AD-1 requires this function to stay synchronous and pure, ruling out a wall-clock timeout or a worker
  thread, and native `RegExp` exposes no hook into its own internal step counter. A single flat formula
  (quantifier count × input length) is not enough on its own: it is *linear* in both factors and cannot
  represent the actual danger, which is **nested** quantifiers (`(a+)+`, `(a*)*`, …) — the classic
  catastrophic-backtracking shape, whose real cost is not linear in either factor and would silently
  slip under any linear budget while native `RegExp.test` still hangs on it. So the gate is two tiers:
  1. **Structural, unconditional rejection of nested quantifiers.** Strip character-class contents
     first (`pattern.replace(/\[[^\]]*\]/g, '[]')`) so a literal `+`/`*`/`?` inside `[...]` is never
     mistaken for a quantifier. Then scan the remaining source with a simple parenthesis-matching pass
     (not a full parse): for every `(...)`/`(?:...)` group, check whether the group's own contents
     contain a quantifier character **and** the group itself is immediately followed by one (`)+`, `)*`,
     `)?`, or `){m,n}`) — the shape that makes the group's own repetition compound with its interior
     repetition. If found, throw `RuntimeFault('budget-exhausted', artifactPath, …)` **regardless of
     `value.length` or the declared `matchStepBudget`** — this shape is rejected outright, the same
     fail-closed treatment this codebase gives every other pathological case it can detect structurally
     rather than trying to bound numerically.
  2. **Otherwise, the linear estimate**, computed over the character-class-stripped source:
     ```ts
     const QUANTIFIER_MARKER = /[*+?]|\{\d+(?:,\d*)?\}/g
     const stripped = pattern.replace(/\[[^\]]*\]/g, '[]')
     const estimatedSteps = (1 + (stripped.match(QUANTIFIER_MARKER)?.length ?? 0)) * value.length
     if (estimatedSteps > matchStepBudget) {
       throw new RuntimeFault(
         'budget-exhausted',
         artifactPath,
         `estimated ${estimatedSteps} regex match steps exceed the declared budget of ${matchStepBudget}`,
       )
     }
     ```
  Then `return compiled.test(value)` (the original, unstripped `pattern` — the character-class stripping
  is an estimation-only transform, never used for matching).

  This construction is modeled on `expression.ts`'s own `ANCHORED_PATTERN_FORM` precedent: a cheap,
  documented, deliberately imperfect check rather than a full parser, with its accepted residuals named
  rather than hidden. **Only the first of the three residuals below is safe-direction; the "conservative"
  framing does not extend to the other two, and a post-implementation review round corrected an earlier
  draft of this text that implied otherwise.**

  1. A technically-safe-but-suspicious nested-quantifier pattern (e.g. `(a+)+` against a short,
     always-terminating input) is rejected unconditionally even though it would not actually hang —
     conservative, and the one residual that is genuinely the safe direction to be wrong in: it only ever
     rejects something safe, never admits something dangerous.
  2. The character-class strip is itself approximate (a class containing an escaped `]`, e.g. `[\]+]`,
     could confuse a naive strip regex run directly against the raw pattern) — accepted for the same
     reason `ANCHORED_PATTERN_FORM`'s own positional check is accepted, a cheap, stated, fixture-proven
     imperfection rather than a full parse. **This one is not safe-direction on its own**: a review round
     found that stripping character classes before neutralizing backslash escapes let an escaped bracket
     swallow a real, dangerous group into what the strip mistook for a character class (`^\[(a+)+\]$`
     hid `(a+)+` entirely, reaching neither gate tier and hanging on `compiled.test`). The implementation
     fixes this by neutralizing every backslash-escaped pair to an inert placeholder **before** the
     character-class strip runs, closing the unsafe direction; the residual that remains after that
     reordering is milder and stays on the safe side, illustrated by `^[a\]b+]$` at a candidate length of
     50: the escaped `]` no longer confuses the strip at all once escapes are neutralized first, so this
     specific case now computes the exact correct estimate (50) rather than an inflated conservative one.
  3. **A third residual, documentation-only, added by the same review round: a quantified overlapping
     alternation inside a group, such as `^(?:a|a)+$`, is invisible to both tiers.** The group's content
     contains no quantifier *character* (only a bare alternation), so the structural tier does not fire;
     the linear tier counts no quantifier markers either, so its estimate stays tiny regardless of input
     length; native `RegExp.test` then hangs on it exactly as `(a+)+` would. This is deliberately not
     caught structurally: the obvious heuristic — flag any quantified group containing a top-level `|` —
     would reject the already-required `^(?:GET|POST)+$` fixture (an ordinary, safe, non-overlapping
     alternation), and correctly telling overlapping from non-overlapping alternation needs a real
     parser, which this gate deliberately is not. Accepted as a stated, known gap rather than chased with
     a heuristic that would trade a false negative here for false positives on ordinary patterns
     elsewhere.

### AC 6 — Structural-family operators: `ordering`, `countTolerance`, `shape`

- **`ordering(collection, key, order, artifactPath): boolean`** where `order: 'ascending' | 'descending'`.
  `false` if `collection === ABSENT` (subject to AC 1's absent-collection-typed boundary note) or is not
  an array. A one-element (or shorter) array is vacuously `true` — nothing to compare (Story 3.2's
  empty-collection wrapper, not this function, handles the zero-element case). For each adjacent pair
  `(el[i], el[i+1])`: both must be plain objects carrying `key` as an own key (per `expression.ts`'s
  `Ordering` schema, `key: KeyName` is a plain object key, never a pointer — this operator never walks a
  nested path), and both `el[i][key]` and `el[i+1][key]` must be the same JSON scalar type, either both
  `number` or both `string`; any element failing this is a type mismatch and the whole node is `false`.
  Compare non-strictly (ties permitted): ascending requires `el[i][key] <= el[i+1][key]` for every pair,
  descending the reverse. **String comparison is plain `<=`/`>=` (UTF-16 code-unit order), never
  locale-aware** — chosen for determinism, not because observed evidence is guaranteed to carry any
  particular timestamp format: this project's own convention already uses the same UTF-16 code-unit
  basis for canonical key sorting (AD-27, `ARCHITECTURE-SPINE.md:398`, "object keys sort by UTF-16 code
  unit rather than code point"), so this operator reuses the same primitive comparison this codebase
  already picked, for consistency, rather than inventing a second one. It happens to sort matching-
  precision RFC 3339 UTC timestamps chronologically, but nothing here enforces RFC 3339 on observed
  evidence — the Consistency Conventions' "Dates are RFC 3339 in UTC" (line 531) governs artifact shapes
  this project defines, not an arbitrary system under test's response bodies, and RFC 3339 itself admits
  a numeric offset alongside `Z` (`primitives.ts:100-101` had to add "a numeric offset is not accepted"
  precisely because the bare format does not settle this) — an author declaring `ordering` over
  non-UTC or mixed-precision timestamp strings inherits that risk, and it is a contract-authoring
  concern this operator does not solve. No AD, ADR, or fixture states a comparison rule for `ordering`
  anywhere else; `expression.ts`'s own comment on its arity says only "Epic 3 inherits the semantics"
  (line 330) — this AC is where that inheritance is spent.
- **`countTolerance(collection, expected, tolerance, relative, artifactPath): boolean`** — `false` if
  `collection === ABSENT` (subject to AC 1's absent-collection-typed boundary note) or is not an array
  (this function never special-cases an *empty* array as
  anything but a legitimate zero count; the architecture's own prohibition on treating emptiness as
  "insufficient-evidence, therefore skip the check" is enforced by Story 3.2's wrapper intercepting
  before this function is ever called on a genuinely empty collection — see AC 1). Let
  `actual = collection.length`. The allowed deviation is `relative ? (expected * tolerance) / 100 :
  tolerance`, compared without rounding: `true` iff `Math.abs(actual - expected) <= allowedDeviation`.
  No floor or ceiling is applied to a fractional relative deviation — see Decision 5 for why rounding
  either direction would be an unstated, arbitrary tightening or loosening of the declared tolerance.
- **`shape(value, descriptor, artifactPath): boolean`** where `descriptor: KeyedShapeDescriptor`
  (`{ requiredKeys, permittedKeys, types }`, `src/core/schemas/primitives.ts`). `false` if
  `value === ABSENT` or is not a plain object (not an array, not `null`). Then, all of:
  1. Every member of `requiredKeys` is an own key of `value`.
  2. Every own key of `value` is a member of `permittedKeys` — **`permittedKeys` alone is the closed
     set, never unioned with `requiredKeys`.** `primitives.ts`'s own comment on `permittedKeys` states
     this is "deliberately not refined to be a superset of `requiredKeys`… left to the compiler in v0"
     — i.e. a descriptor where a required key is not itself permitted is schema-legal but
     self-contradictory, and this function does not repair that contradiction; it applies both rules
     independently, which makes such a descriptor unsatisfiable by construction (any object with the
     required key present necessarily fails the closed-set check). See Decision 6.
  3. For every key present in both `value` and `descriptor.types` where `descriptor.types[key]` is a
     `JsonTypeName` (not `null` — `null` in the type map means "declared, type not stated," per
     `KeyTypeMap`'s own comment, and is skipped): `value[key]`'s runtime JSON type equals the declared
     one. Map runtime shape to the six-member vocabulary as: `Array.isArray` → `'array'`; `=== null` →
     `'null'`; else `typeof` → `'string' | 'number' | 'boolean'`, or a non-array, non-null object →
     `'object'`.

### AC 7 — Fixtures

For every one of the ten operators: at least one passing case, one failing (non-throwing) case, and one
`absent`-operand case proving the AD-26 rule (`existence` false / `absence` true / every other operator
false) — including the both-operands-absent case for `equality`/`deep-equality`/`containment` (AD-26's
rule is unconditional: `absent` is never equal to itself). Beyond that baseline:

1. **`equality`/`deep-equality`:** reuse `gateCContract`'s real usage where it exists — O-001's
   `deep-equality` node (`tests/schemas/fixtures/gate-c-contract.ts`, comparing
   `submittedFilters`/`filters`, an object), O-002's and O-008's `equality` nodes (status-code and
   pointer-to-pointer scalar comparisons) — as the shape to hand-construct resolved-value inputs
   against, matching Story 2.3's precedent of grounding accept fixtures in this same contract's real
   oracles rather than inventing unrelated ones. Beyond that, cases specific to Decision 2's final
   design (these two functions are no longer identical, so both need coverage, not one shared set):
   - **Both:** a scalar-vs-compound pair (e.g. a number against an object) resolves `false`; two
     structurally **identical** compound values (same-shaped objects or arrays with equal content)
     resolve `true`; two same-shaped but structurally **different** compound values resolve `false`.
   - **`deep-equality` only:** an unsafe-range integer (e.g. a response body carrying
     `9007199254740993` as parsed by `JSON.parse`) throws `RuntimeFault('non-canonicalizable-value', …)`
     rather than returning `false` — the realistic trigger from Draft 3's rejection.
   - **`equality` only, proving Draft 3's and Draft 4's defects both stay closed:** the *same*
     unsafe-range-integer value, compared as a scalar against an ordinary number (e.g.
     `equality(9007199254740992, 200)`), resolves `false` and does **not** throw (Draft 3's case —
     same-kind scalars never reach canonicalization); and the same unsafe-range-integer value compared
     against a compound value of a *different* kind (e.g. `equality(9007199254740992, { a: 1 })`) also
     resolves `false` and does **not** throw (Draft 4's case — a genuine type mismatch resolves before
     canonicalization runs, even when one side carries a domain violation).
2. **`containment`:** since neither real contract uses it, hand-author all cases: string/substring
   (true and false), array/single-candidate (true and false), array/resolved-set-subset (true, and
   false when one set member is missing), and every named type-mismatch branch (object container,
   string container against a non-string candidate, array candidate against a non-array container).
3. **`setMembership`:** reuse `gateCContract`'s two real nodes — O-002's literal-array set
   (`['queued','running','succeeded','failed']`) and O-006's resolved reference-set form — plus a
   structural (non-scalar) set-member case proving canonical-JSON matching, not `===`.
4. **`regexMatch`:** an ordinary anchored pattern against ordinary input (accept and reject); a
   syntactically invalid pattern (e.g. an unbalanced group) throwing `RuntimeFault` with code
   `'operator-cannot-accept-operand'` rather than a raw `SyntaxError`; a nested-quantifier pattern (e.g.
   `^(a+)+$`) throwing `RuntimeFault('budget-exhausted', …)` **even against a short input and a generous
   budget**, proving the structural tier fires unconditionally; the linear-tier budget-breach case (a
   non-nested pattern with several quantifiers against a long input, asserting the message names the
   estimate and the budget) and a case just under that budget that does not throw, proving the linear
   gate is a real threshold; and a benign pattern whose quantifier-looking characters sit inside a
   character class (e.g. `^[+*?]{1,3}$` against a long input) passing under the default budget, proving
   the character-class strip prevents the false positive that motivated it.
5. **`ordering`:** reuse `gateCContract`'s or `expression-nodes.ts`'s `capturedAt` shape for the
   ascending/descending, both-string cases; a numeric-key case; a single-element array (vacuously
   true); a two-element array with mismatched key types (false); an array whose elements are missing
   `key` entirely (false).
6. **`countTolerance`:** the `expression-nodes.ts` fixture shape (`expected: 3, tolerance: 0,
   relative: false`) as a starting point; an absolute-tolerance boundary case (exactly at the boundary
   passes, one past it fails); a relative-tolerance case where the unrounded deviation matters (e.g.
   `expected: 7, tolerance: 10, relative: true` — allowed deviation `0.7`, so `actual: 6` or `8` must
   fail and `actual: 7` must pass, proving no rounding widened the boundary); and `expected: 0` under a
   non-zero `relative` tolerance (allowed deviation is `0` regardless of the declared percentage, since
   any percentage of zero is zero — only `actual: 0` passes).
7. **`shape`:** reuse `gateCContract` O-005's descriptor
   (`requiredKeys: ['id','datasetId','capturedAt','payload']`,
   `permittedKeys: [...,'retractedAt']`, `types: {}`) as an accept/reject base; a self-contradictory
   descriptor (a required key absent from `permittedKeys`) proving it is unsatisfiable rather than
   erroring; a declared-type mismatch case (`types: { id: 'string' }` against a numeric `id`); and a
   `types: { id: null }` case proving a `null` type entry skips the type check (presence alone
   suffices).

### AC 8 — Tests and the gate

- Tests live at `tests/evaluate/operators.test.ts` and `tests/evaluate/resolved-value.test.ts` (the
  latter can be small — just proves `ABSENT` is a stable, distinct sentinel), mirroring
  `tests/seal/`'s relationship to `src/core/seal/`.
- Every `RuntimeFault` assertion checks `instanceof RuntimeFault`, exact `.code`, and `.artifactPath` —
  never a bare `toThrow()` — matching `tests/canonical/faults.test.ts`'s own assertion shape and the
  "passes for the wrong reason" defect this project's standing convention writes against (Story 2.3 AC
  5, itself citing Story 1.3).
- `npm run check:docs` and `npm test` run and the baseline is recorded **before the first edit**.
- `npm run validate` passes at the end (typecheck, lint, `check:docs`, `check:shareable`, `lint:spine`,
  `check:vectors`, `check:schemas`, `check:ad5-registry`, `test`).
- `src/index.ts` is not touched: `core/evaluate/`'s functions are internal until Story 3.2's resolution
  layer (and, later, a `score`-stage orchestrator once its own Owed items close) calls them, the same
  rule Story 2.3 followed for `auditBriefScripting`.

## Tasks / Subtasks

- [x] Task 1: preflight (AC 8)
  - [x] Run `npm run check:docs` and `npm test`; record the baseline test count before the first edit.
- [x] Task 2: the `ScoringPolicy` field and the `RuntimeFault` registry (AC 2)
  - [x] Add `regexMatchStepBudget` to `src/core/schemas/scoring-policy.ts`; update the `.meta()`
        description sentence.
  - [x] Convert `RuntimeFaultCode` in `src/core/schemas/faults.ts` to a data-derived type
        (`RUNTIME_FAULT_CODES` tuple), adding `'budget-exhausted'` and the new
        `'operator-cannot-accept-operand'` as its third and fourth members.
  - [x] Edit `ARCHITECTURE-SPINE.md`'s AD-28 table: `budget-exhausted`'s `Commanded by` gains `AD-4`;
        add the new `operator-cannot-accept-operand` row (`AD-4` alone — a post-implementation review
        found the row's original `AD-26` citation misgrounded, since AD-26 assigns that phrase to
        `oracle-error`, a score-side outcome state; corrected). Run `npm run check:docs`,
        `npm run lint:spine`, `npm run build:shareable`, confirm `npm run check:shareable` green.
  - [x] Regenerate `schemas/scoring-policy.schema.json` (`npm run generate:schemas`,
        `npm run check:schemas`).
  - [x] Add `regexMatchStepBudget` to `scoringPolicyFixture`
        (`tests/schemas/fixtures/artifact-fixtures.ts`) — the only fixture that needs the edit (AC 2
        point 3); re-measure `tests/schemas/published/keyword-mutation.test.ts`'s pinned census
        directly.
- [x] Task 3: the resolved-value domain (AC 1)
  - [x] `src/core/evaluate/resolved-value.ts`: `ABSENT`, `ResolvedValue`.
- [x] Task 4: the ten operators (AC 3–AC 6)
  - [x] `src/core/evaluate/operators.ts`: `existence`, `absence`, `equality`, `deepEquality`,
        `containment`, `setMembership`, `regexMatch`, `ordering`, `countTolerance`, `shape`.
- [x] Task 5: fixtures and tests (AC 7, AC 8)
  - [x] `tests/evaluate/resolved-value.test.ts`, `tests/evaluate/operators.test.ts`.
- [x] Task 6: the gate (AC 8)
  - [x] `npm run validate` green.
- [x] Task 7: record
  - [x] `_bmad-output/project-knowledge/learning-path-step-by-step.md`, Step 8, after `dev-story` marks
        this story done — following `learning-path-template.md`'s exact shape, one row added to the
        table at the top.
  - [x] Dev Agent Record: measured counts, any decision that moved from this story's default.

### Story Review Findings

Code review of the finished implementation, run in a peer session against the diff. Nine findings, all
verified real and fixed directly (no new architecture decisions needed, per this project's standing
default). All nine addressed below.

- [x] [Review][Patch] MEDIUM. **`ordering`'s non-strict (tie-permitting) comparison, stated in AC 6 and
      in the function's own doc comment, had no fixture proving it.** Verified: temporarily changing
      both comparisons from `<=`/`>=` to `<`/`>` still passed all 56 then-existing tests. Fixed: added a
      tied-adjacent-elements fixture (both string and numeric keys, both orders) to
      `tests/evaluate/operators.test.ts`; re-verified by direct mutation that the new fixture fails
      against the `<`/`>` mutant and passes against the correct implementation.
- [x] [Review][Patch] HIGH. **`regexMatch`'s structural and linear tiers were escape-blind: a
      backslash-escaped quantifier-look-alike (`\+`, `\*`, `\?`, `\{`) was indistinguishable from a real
      metacharacter to `CONTENT_QUANTIFIER_CHARACTER`/`QUANTIFIER_MARKER`.** Verified: `regexMatch('a',
      '^(\d\+)+$', 1_000_000, path)` — one real quantifier (the outer `+`), no real nested-quantifier
      shape — wrongly threw `budget-exhausted` from the structural tier, because the group's content
      string `\d\+` contains a bare `+` the check could not tell was escaped. Fixed: both the group-
      content test in `hasNestedQuantifier` and the linear-tier count in `regexMatch` now strip
      backslash-escaped character pairs (`ESCAPED_CHARACTER_PAIR = /\\./g`) before testing, mirroring the
      escape-awareness the paren-matching scan already had for finding real group delimiters. Two
      fixtures added: one proving `^(\d\+)+$` does not throw as a nested-quantifier false positive
      (structural tier), one proving three escaped literal plus signs do not inflate the linear-tier
      estimate (correctly stripped: 1× multiplier under budget 1000 at length 800; naively counted: 4×
      multiplier, 3200, would have wrongly breached the same budget). Both fixtures independently
      verified by direct mutation to fail against the pre-fix code and pass against the fix.
- [x] [Review][Patch] MEDIUM. **`containment`'s literal-vs-referenceSet collision was real,
      undocumented, and untested.** An array-shaped `{ literal }` candidate and a resolved
      `{ referenceSet }` candidate both resolve to the identical runtime shape, `JsonValue[]`;
      `containment` always reads an array-shaped candidate as a subset check, never as "is this array
      itself one element of the container" — so `containment([[1, 2], [3, 4]], [1, 2], path)` resolves
      `false` even though `[1, 2]` is literally an element of the container. Not redesigned (would ripple
      into Story 3.2's future caller, and this function structurally cannot see operand provenance, the
      same limitation Decision 2 names for `equality`). Fixed: the function's own doc comment now names
      this exact collision; a fixture in `tests/evaluate/operators.test.ts` pins the current, documented
      behavior; Decision 3 below gained one sentence naming this as the concrete case its "least-grounded
      piece" flag refers to.
- [x] [Review][Patch] LOW. **No fixture passed `null` to `equality` or `deepEquality`,** even though
      `jsonKind` treats `'null'` as its own distinct kind. Fixed: added `equality(null, null, …) → true`
      and `equality(null, 42, …) → false` (and the same pair for `deepEquality`).
- [x] [Review][Patch] MEDIUM. **`shape`'s "typed key legally absent from `value`" branch
      (`if (!Object.hasOwn(value, key)) continue`) was never exercised** — every `types`-bearing fixture
      had the key present. A mutation turning that skip into a failure would have passed the whole suite
      undetected. Fixed: added a descriptor with an optional typed key, asserting `shape` still resolves
      `true` when that key is omitted from `value`.
- [x] [Review][Patch] LOW. **`shape`'s declared-type-mismatch coverage was `'string'` only** — none of
      `jsonKind`'s other branches (`'array'`, `'object'`, `'boolean'`, `'null'`) were exercised directly
      against `shape`. Fixed: added a compound-kind (`'array'`) and a `'boolean'` mismatch case.
- [x] [Review][Patch] LOW. **No fixture proved `existence`/`absence` read `=== ABSENT` rather than JS
      truthiness** — no case passed `0`, `false`, or `''`, so a regression toward a truthy/falsy check (a
      classic mistake for a presence check) would have slipped past undetected. Fixed: added
      `existence`/`absence` cases for all three falsy-but-present values.
- [x] [Review][Patch] LOW. **`regexMatchStepBudget`'s published `.describe()` text ended with an
      internal cross-reference — "(see the regex operator's own Decision below)" — that means nothing to
      an external consumer reading the published, standalone `schemas/scoring-policy.schema.json`.**
      Fixed: reworded to state the operative fact inline with no internal pointer.
      `schemas/scoring-policy.schema.json` regenerated; `npm run check:schemas` green; the
      `keyword-mutation.test.ts` census re-measured directly and confirmed unchanged (same keywords,
      different string value, as predicted).
- [x] [Review][Patch] MEDIUM. **The AD-28 table's `operator-cannot-accept-operand` row cited `AD-4,
      AD-26`, but AD-26's own text assigns that exact phrase — "an operand type the schema admitted but
      the operator cannot accept" — to `oracle-error`, a score-side outcome state (AD-33's territory,
      Epic 6), not to a runtime fault; this story's own AC 1 forbids Epic 3 from mapping onto outcome
      states.** Fixed: the row now cites `AD-4` alone; AC 2 point 2's prose and Task 2's own subtask text
      updated to match and to record the correction. `npm run check:docs`, `npm run lint:spine`,
      `npm run build:shareable` re-run; `npm run check:shareable` confirmed green.

A second, independent fresh-session review of the committed diff, run against the running code with
direct timing reproduction rather than reasoning alone. Four findings, all fixed below.

- [x] [Review][Patch] **BLOCKING.** **`CHARACTER_CLASS_CONTENTS` ran on the raw pattern, before escape
      handling — the unsafe direction of the same root cause the second review round's escape-blindness
      finding was in the safe direction on.** For `^\[(a+)+\]$`, the class-strip regex saw the `[` of the
      escaped `\[`, greedily consumed through to the `]` of the escaped `\]` at the end, and swallowed
      the real `(a+)+` nested-quantifier group into what it mistook for one character class — hiding it
      from both gate tiers entirely and letting `compiled.test` hang on catastrophic backtracking.
      Reproduced directly, under a hard subprocess timeout rather than trusted from the report: the
      pre-fix ordering, given the adversarial input `` `[${'a'.repeat(28)}X` `` against
      `^\[(a+)+\]$`, took **~3.9s** and returned `false` (would grow further with input length, no
      abort possible — this function is synchronous). Fixed exactly as prototyped: escape-neutralize
      first (`ESCAPED_CHARACTER_PAIR` replaced with an inert `'_'` placeholder), character-class-strip
      second, one combined `stripped` computation feeding both tiers. Verified the fix, same
      subprocess-timeout method, same adversarial input: **1ms**, `budget-exhausted` thrown. With no
      backslash able to survive into `hasNestedQuantifier` or the linear count after this reordering,
      the now-dead escape-handling was removed from three places: the `if (character === '\\')` branch
      in `hasNestedQuantifier`'s paren scan, the `.replace(ESCAPED_CHARACTER_PAIR, '')` on `contents`
      inside it, and the separate `quantifierCountSource` line in `regexMatch` — one escape pass instead
      of three. Two fixtures added to `tests/evaluate/operators.test.ts`: `^\[(a+)+\]$` now throws
      `budget-exhausted` (the previously-hidden shape is caught); `^[a\]b+]$` at length 50 under budget
      60 does not throw, and — verified directly rather than assumed — now resolves the exact correct
      estimate (50, since the pattern is a single zero-quantifier character class once the escaped `]`
      no longer confuses the boundary) rather than the previously-documented inflated conservative one
      (100). Every fixture from the prior two rounds re-run and confirmed unchanged (68 tests, none
      moved), matching the finding's own "prototyped and verified" claim.
- [x] [Review][Patch] MEDIUM. **Documentation gap, not a code bug, correctly flagged as such: a
      quantified overlapping alternation with no quantifier character inside the group, e.g.
      `^(?:a|a)+$`, is invisible to both gate tiers** (no quantifier character for the structural tier
      to find, no quantifier marker for the linear tier to count) and hangs `RegExp.test` exactly as
      `(a+)+` would. Not chased structurally, per the finding's own instruction: the obvious heuristic —
      flag any quantified group containing a top-level `|` — would reject the already-required
      `^(?:GET|POST)+$` fixture, and correctly distinguishing overlapping from non-overlapping
      alternation needs a real parser, disproportionate to this gate. Fixed as documentation only: AC 5
      now names three residuals instead of two, explicitly scoping the "safe direction" claim to only
      the first of them (the earlier "both accepted... the safe direction to be wrong in" framing was
      corrected, since finding 1 above and this residual are not safe-direction), and Decision 4's own
      cross-reference updated to match. No fixture added for the hang itself, per the finding's own
      instruction — it costs over a second and the prose already documents the gap precisely.
- [x] [Review][Decision] **The linear-tier estimate scales with the observed string's length, which the
      contract author does not control, so the published default of 10000 let an ordinary long SUT
      response (over 10000 characters, any pattern) or a single-quantifier pattern against a response
      over 5000 characters turn a would-be `false` into an invalidating fault.** Settled by construction
      per this project's standing convention: the published default raised from `10000` to `1000000`.
      Recorded reasoning: the "step" figure is a synthetic linear proxy over pattern complexity ×
      observed length, never measured engine time, and native `RegExp` executes a non-nested-quantifier
      pattern (one that already passed the structural tier) near-instantly regardless of length — so
      raising this ceiling does not reduce real safety. The structural tier's nested-quantifier rejection
      is unconditional and independent of this value; it remains the real backstop regardless of the
      budget's magnitude. The new default comfortably covers ordinary evidence sizes (a single-quantifier
      pattern against a ~488KB string, or five quantifiers against a ~163KB string) while still bounding
      genuinely extreme cases. Applied: `scoring-policy.ts`'s `.describe()` text (value and rationale),
      `artifact-fixtures.ts:485`, and `tests/evaluate/operators.test.ts`'s local `DEFAULT_BUDGET` all
      updated to `1000000` / `1_000_000`; `schemas/scoring-policy.schema.json` regenerated and
      `npm run check:schemas` confirmed green; the `keyword-mutation.test.ts` census re-measured
      directly and confirmed unchanged (`scoring-policy: 32`, total `1953`, as predicted — same
      keywords, only the describe string's byte content changed).
- [x] [Review][Decision] **`RUNTIME_FAULT_CODES` has no runtime consumer beyond its own type derivation,
      as of this story** — a real, low-severity observation, already a named, deliberate tradeoff under
      Decision 9. Not reverted to a plain union: the array form mirrors `FAILURE_CODES`'s established
      shape ahead of a not-yet-built `check:ad28-registry` analog, the same order-of-operations already
      shipped for the compile-time registry (`FAILURE_CODES` predates `check-ad5-registry.ts`, per Story
      1.5). Decision 9 gained one sentence naming this explicitly, so the tradeoff is recorded rather
      than left implicit.

## Decisions taken during story creation

Each is settled with a stated default and its downstream consequence. Per this project's standing
convention (settle ambiguities in the story or the code, record the reasoning, do not escalate to a new
architecture revision), proceed unless the user amends one; record the outcome in the Dev Agent Record.

1. **This story builds ten operators, not the "eleven" its own opening sentence could be misread as
   promising.** `OPERATOR_NAMES` (`expression.ts:68`) and epics.md's own Story 3.1 opening line both
   say "eleven", but Story 3.1's own AC (epics.md lines 286–289) names exactly ten, and Story 3.3's
   title is "covers-by-key as a bijection" — its own dedicated story. Treated as epics.md counting AD-4's
   whole operator vocabulary in the story's framing prose while the AC (the actually binding part)
   scopes the story precisely; not referred back for a wording fix, per this project's standing default.
   **Consequence:** this story's own opening sentence above is worded to say so directly, and
   `covers-by-key` is out of scope end to end.
2. **`equality` is a three-way, cost-ordered branch: type mismatch, then same-scalar `===`, then
   same-compound structural comparison; `deep-equality` stays unconditionally structural.** Four drafts
   were tried and rejected in sequence during story creation — three independent peer review passes each
   caught what the previous draft's fix had reopened — and all four are recorded, because a future reader
   would plausibly re-derive the first three before finding the fourth.
   - **Draft 1: resolve `false` on any compound operand ("scalar-only equality").** Wrong:
     `expression.ts`'s `Equality` and `DeepEquality` operand descriptions are byte-identical ("each
     legally a pointer or a literal", `expression.ts:271` vs `280`) — a compound operand is not a
     schema-level type mismatch — and unconditional `false` lets `not(equality(sameShapedCompound1,
     sameShapedCompound2))` resolve `true` and certify "these differ" for a comparison `equality` was
     never asked to perform. A fail-open, the exact shape AD-4's whole revision history fights.
   - **Draft 2: `===` for scalars, throw `RuntimeFault('operator-cannot-accept-operand', …)` on two
     same-shaped compounds.** Closes Draft 1's fail-open, but the throw is **runtime-data-dependent** on
     `{ pointer }` operands (real evidence — `gateCContract` O-008's third node is exactly this shape):
     whether it fires is decided by what the system under test actually returns, not by anything the
     contract declares. A misbehaving SUT returning a compound value where a scalar was expected throws
     and invalidates the run instead of resolving the comparison — the exact failure AD-26's own
     "Prevents" clause names, *"a whole defect class becoming permanently unscoreable"*
     (`ARCHITECTURE-SPINE.md:384`). Splitting the throw by operand *provenance* (an authored `{ literal }`
     throws, a resolved `{ pointer }` doesn't) would fix this, but these functions structurally cannot
     see provenance — they receive only resolved values.
   - **Draft 3: delegate unconditionally to `digestArtifact`, both operators, every operand.** Closes
     Draft 2's shape-triggered fault, but reopens the same class of defect a third way, verified directly
     against `value-domain.ts`: an unsafe-range integer, a lone UTF-16 surrogate, or excess nesting all
     make `digestArtifact` throw `non-canonicalizable-value` — and routing plain scalars through it gives
     `equality` `deep-equality`'s entire fault surface, which `===` never had. A SUT returning an ordinary
     large integer ID (`JSON.parse('9007199254740993')` → `9007199254740992`, rejected by
     `Number.isSafeInteger`) now makes `equality(thatId, 200)` throw where it previously resolved
     `false` — the same "detected defect becomes broken measurement" failure as Draft 2, entered through
     the value domain instead of operand shape.
   - **Draft 4: branch two ways — same-scalar-kind takes `===`, everything else (cross-type mismatch or
     same-compound-kind) falls through to `digestArtifact`.** Closes Draft 3's plain-scalar leak, but a
     third review pass on this exact fix found one case still open: a genuine cross-type pair where one
     side is a domain-violating scalar still falls through and throws —
     `equality(9007199254740992, { a: 1 })` is not the same kind, yet still reaches `digestArtifact` and
     faults on the unsafe integer, even though a number and an object can never be equal and answering
     that needed no canonicalization at all. Narrower than Draft 3's leak, but the identical class.
   - **Adopted: a three-way branch, cost-ordered.** Type mismatch resolves `false` first, with no digest
     call — two differently-kinded values are never equal, so this needs no canonicalization to answer,
     closing Draft 4's leak completely. Same scalar kind takes `===`. Only a same **compound** kind
     (`array` with `array`, `object` with `object`) reaches `digestArtifact` — the one case with
     genuinely no cheaper answer, and the only case where a fault is possible at all now. `deep-equality`
     keeps the unconditional digest path with its documented three-trigger fault surface unchanged:
     structural comparison, always, is that operator's entire purpose. **Consequence:** AC 3 implements
     this branch precisely; the ABSENT guard must run
     before all three branches in `equality` and before `deep-equality`'s own single branch (a symbol
     reaching `canonicalize` faults, which would break
     AD-26's `equality(ABSENT, ABSENT) === false` requirement) — flagged explicitly because it is the
     kind of ordering mistake easy to introduce while refactoring this exact function.
3. **`containment`'s dual-mode construction is a flagged, explicit judgment call, not a certainty** —
   this is this story's least-grounded piece, though not evidence-free: `expression.ts`'s own
   `Containment` operand description ("the set is legally a pointer, a literal, or a reference set",
   line 290) and AD-26's line 392 both name `containment`'s second operand "the set", and
   `direction-prose.ts:81` glosses the operator as "asserted to contain the declared member" — singular,
   which does not contradict the dual-mode reading so much as leave it unaddressed: the gloss is a
   generic human-readable template written before evaluation-time resolution, blind to whether the
   declared operand will turn out to resolve to one value or a whole set. No source states an actual
   comparison algorithm. If a future review or a real contract usage demonstrates this reading is wrong,
   that is new evidence for revising this one function, not grounds to treat the rest of the story as
   suspect. **Consequence:** flagged explicitly for the peer review round this story's creation workflow
   already routes to. **The concrete collision this flag refers to, named explicitly after a
   post-implementation code-review pass asked for it:** an array-shaped `{ literal }` candidate and a
   resolved `{ referenceSet }` candidate both resolve to the identical runtime shape, `JsonValue[]`, and
   `containment` cannot tell "is this array itself present as one element of the container" from "is the
   container a superset of this set" — it always takes the latter (subset) reading whenever `candidate`
   is an array. `containment([[1, 2], [3, 4]], [1, 2], path)` therefore resolves `false` even though
   `[1, 2]` is literally an element of the container. Not fixed, for the same structural reason Decision
   2 gives for `equality`: this function receives only resolved values, never operand provenance, so it
   cannot see which schema form (`{ literal }` vs `{ referenceSet }`) produced the array it was handed.
   Documented on `containment`'s own doc comment and pinned by a fixture in
   `tests/evaluate/operators.test.ts` (AC 7 point 2's own coverage), so a future reader hits a
   documented, tested boundary rather than a silent surprise.
4. **The regex match-step budget is a two-tier static gate — structural rejection of nested quantifiers,
   then a linear character-class-aware estimate — never a dynamic engine-step count.** AD-1 requires this
   function to stay synchronous and pure, which rules out a wall-clock timeout or a worker thread; native
   `RegExp` gives no hook into its own step counter; a full hand-rolled backtracking engine with ECMA-262
   fidelity is disproportionate engineering for one operator among ten and would trade away matching
   correctness to buy step-exactness nothing downstream needs (matching itself stays native `RegExp`,
   full fidelity, AC 5). A single flat linear formula was this story's own first draft and was wrong on
   its own terms: it is oblivious to nesting, the one shape that actually defeats a linear bound (`(a+)+`
   scores the same per-quantifier cost as two independent, harmless quantifiers), so a genuinely
   pathological pattern could pass the gate and still hang `RegExp.test` — exactly the failure the gate
   exists to prevent. The fix is a structural pre-check that rejects the dangerous shape outright,
   unconditionally, before any numeric estimate runs at all; only patterns that pass the structural check
   reach the linear estimate, which is a defensible bound for the shapes that remain. Modeled directly on
   `ANCHORED_PATTERN_FORM`'s own precedent in this codebase: a cheap, documented, deliberately imperfect
   check with its accepted residuals named rather than hidden (AC 5 names three, only one of them
   genuinely safe-direction — corrected there after a review round found the original two-residual,
   both-safe framing was wrong). **Consequence:** the formula, the
   nested-quantifier scan, and the default budget value (10000) are this story's own construction,
   recorded here rather than sourced from any spine text, because none exists.
5. **`countTolerance`'s relative deviation is compared unrounded.** Rounding either direction (floor or
   ceil) would silently move the declared boundary in a direction no source states, and the comparison
   is exact and floor/ceil-free without cost: `actual` is always an integer, so comparing it against a
   possibly-fractional exact deviation via `<=` needs no rounding to be correct. **Consequence:** AC 6's
   formula is stated with no rounding step, and AC 7 point 6 requires fixtures at the exact fractional
   boundary and at `expected: 0` proving no rounding crept in either direction.
6. **`shape`'s closed set is `permittedKeys` alone, never unioned with `requiredKeys`.**
   `primitives.ts`'s own comment on `KeyedShapeDescriptor.permittedKeys` states the schema deliberately
   does not enforce `requiredKeys ⊆ permittedKeys`, "left to the compiler in v0." This function does not
   repair that gap either; it applies both rules independently, so a self-contradictory descriptor
   becomes unsatisfiable (always `false`) rather than silently widened to accept it. **Consequence:** a
   fixture (AC 7 point 7) proves the unsatisfiable case resolves `false` rather than throwing or
   silently passing, leaving the actual contradiction-detection to a future Epic 4 compile-time check
   that this story does not anticipate.
7. **Every operator function's last parameter is `artifactPath: string`, uniformly, even on functions
   that never throw — and the unused ones are underscore-prefixed.** A per-function-different arity would
   cost Story 3.2's resolution layer a dispatch table instead of one calling convention across all ten.
   Executed against this repo's own Biome config: `biome check .` reports
   `lint/correctness/noUnusedFunctionParameters` on a plainly-named unused trailing parameter (a warning,
   so `npm run lint` and `npm run validate` still exit `0`, but it would sit as five permanent warnings
   otherwise). **Consequence:** `existence`, `absence`, `ordering`, `countTolerance`, and `shape` name
   their unused parameter `_artifactPath`, which Biome's own convention treats as intentional; this is
   still the parameter Decision 7 requires, only renamed, not dropped.
8. **Absent-collection-typed pointers are Story 3.2's boundary to police, never this story's operators'
   job.** AC 1's own note states this in full: these functions cannot see a pointer's declared response
   type, only its resolved value, so they cannot distinguish "genuinely absent, correctly `false`" from
   "absent but declared collection-typed, which AD-4 requires to reach `insufficient-evidence` instead."
   **Consequence:** every operator taking a possibly-collection operand documents its own `ABSENT`
   handling as correct *only* for the non-collection-typed case (AC 4, AC 6), and Story 3.2's resolution
   wrapper — not these functions — owns intercepting the other case before ever calling in here.
9. **`RuntimeFaultCode` becomes data-derived (`RUNTIME_FAULT_CODES`), mirroring `FAILURE_CODES`'s own
   shape, rather than staying a bare TS union.** AD-28's own text says "the published enumeration is
   generated from this table" (`ARCHITECTURE-SPINE.md:420`), which a bare union can never satisfy, and
   this story is already editing both the union and the spine table for two reasons (`budget-exhausted`'s
   citation, the new `operator-cannot-accept-operand` code) — the cheap, local fix is taken now rather
   than left as a second stale-abstraction gap. **Consequence:** no automated AD-28-vs-`faults.ts`
   cross-check is added (there is no `check:ad28-registry` script, unlike AD-5's
   `scripts/check-ad5-registry.ts`); building one is real, separate scope — a new CI script, not an
   operator implementation — and is named here as a candidate for whichever future story next touches
   this registry, not taken on by this one. **A second review round noted, correctly, that as of this
   story `RUNTIME_FAULT_CODES` has no runtime consumer anywhere in `src`, `tests`, or `scripts` beyond
   the `RuntimeFaultCode` type derivation on the line directly below it — a plain union would express
   that with less code, and the array form's own justification (mirroring a not-yet-built registry
   check) has nothing to check against yet.** Accepted as-is rather than reverted: the same order-of-
   operations already shipped for `FAILURE_CODES` (data-derived ahead of `check-ad5-registry.ts`
   existing, per Story 1.5), so this is the established shape for a code registry in this codebase, not
   a premature abstraction invented here. The tradeoff is named explicitly rather than left implicit.
10. **Module placement (`core/evaluate/`, not `core/score/` or `core/compile/`) rests primarily on the
    Capability → Architecture Map, not on the "No epic touches `score`" sentence alone.** That sentence,
    read as a blanket directory-placement rule, proves too much: it would also forbid Epic 4's own
    compiler work, since the Owed section's "either half" (line ~592) includes `compile`. The map itself
    is the stronger evidence — AD-4 sits under VFR-2's `core/compile, core/seal, core/schemas` (line 606)
    and is absent from VFR-7's `core/score` row (line 611), and `core/compile`'s own job (producing the
    contract artifact from declarations, never touching resolved runtime evidence) rules it out as a home
    for functions that only run against resolved evidence. **Consequence:** AC 1's own reasoning is
    ordered by strength — the map first, the epic's own "stops at resolution" boundary second, the "No
    epic touches `score`" sentence named explicitly as corroborating rather than load-bearing.

## Dev Notes

### Read these files before writing anything

1. `src/core/schemas/expression.ts` — in full. The whole operator vocabulary, `TUPLE_ARITY`,
   `Operand`/`SetOperand`, and every operator's own `.describe()` operand-type prose, which this story's
   functions must accept exactly (e.g. `containment`'s two admitted shapes, `ordering`'s `key`/`order`
   fields, `count-tolerance`'s `relative` flag). Also `src/core/seal/direction-prose.ts`'s per-operator
   English glosses (lines ~63–124) — the only place in the repository distinguishing `equality`,
   `deep-equality`, and `containment` by name (Decisions 2 and 3 both cite it).
2. `src/core/schemas/evidence-artifact.ts` — `CheckResolutionValue`, `CheckResolution`. Not built by
   this story, but its shape is why every operator returns a plain `boolean`: Story 3.2 folds that
   boolean into a `'true' | 'false'` leaf, and this story's functions are never asked to know about
   `'insufficient-evidence'` at all.
3. `src/core/schemas/primitives.ts` — `JsonValue`, `KeyedShapeDescriptor`, `KeyTypeMap`, `KeyName`. The
   `permittedKeys` comment (lines 173–181) is Decision 6's entire evidentiary basis.
4. `src/core/schemas/faults.ts` — `RuntimeFault`, the current two-member `RuntimeFaultCode`, and the
   header comment's "only codes with a genuine thrower belong here" rule.
5. `src/core/schemas/scoring-policy.ts` — every existing field's `.describe()`, for the prose style this
   story's new field must match, and the file's own top comment on why this is a published artifact
   rather than constants.
6. `src/core/canonical/canonicalize.ts`, `digest.ts` — read `digestArtifact`'s and `canonicalize`'s
   signatures and their thrown-fault conditions in full before calling either from `deepEquality`.
7. `ARCHITECTURE-SPINE.md`: AD-4 in full (lines 185–201, especially the paragraph naming `covers-by-key`,
   `deep-equality`, `count-tolerance`, `regex`, and `shape` by name at its tail); AD-26 in full (384–392,
   `absent`'s definition and the "every comparison resolves false" rule); AD-28 in full (400–421, the
   runtime fault registry and its table); the Consistency Conventions table (524–536, especially the
   Errors and Configuration rows); the Structural Seed (569–600, especially the `core/` header comment
   at 575 and the `core/compile`/`core/score` rows at 581); the Capability → Architecture Map (602–616,
   especially the VFR-2 row at 606 and the VFR-7 row at 611); "Owed to the reference implementation"
   (646–731, especially lines 648, 652, and the "No epic touches either half" framing this story's
   Decision 10 checks against rather than takes at face value).
8. `epics.md`: Epic 3's intro (lines 274–276) and Story 3.1's own AC (278–289); FR3 in the Requirements
   Inventory (line 72).
9. `EPIC-BRIEF.md`'s Epic 3 section (lines 90–110) — the "Must not" line this story's own AC 1 quotes.
10. `tests/schemas/fixtures/gate-c-contract.ts` — every real `equality`, `deep-equality`,
    `set-membership`, and `shape` node this story's AC 7 reuses (O-001, O-002, O-005, O-006, O-008).
11. `tests/schemas/fixtures/expression-nodes.ts` — the canonical one-node-per-form shapes for
    `containment`, `ordering`, `count-tolerance`, `shape`.
12. `_bmad-output/implementation-artifacts/2-3-the-emitted-brief-scripting-audit.md` — house style for a
    story of this shape: the Decisions log format, the AD-5-mint pattern this story's AC 2 mirrors for
    AD-28, and the fixture-grounded-in-real-contracts convention AC 7 follows.
13. `tests/canonical/faults.test.ts` — the exact `RuntimeFault` assertion shape (`instanceof`, `.code`,
    `.artifactPath`, `.message`) AC 8's tests must match.

### Project structure notes

- New files: `src/core/evaluate/resolved-value.ts`, `src/core/evaluate/operators.ts`. New test files:
  `tests/evaluate/resolved-value.test.ts`, `tests/evaluate/operators.test.ts` — a new sibling directory
  to `tests/canonical/`, `tests/seal/`, `tests/schemas/`, mirroring `src/core/evaluate/`.
- `src/core/schemas/scoring-policy.ts` gains one field; `src/core/schemas/faults.ts`'s
  `RuntimeFaultCode` becomes data-derived and gains two members (`budget-exhausted`,
  `operator-cannot-accept-operand`, Decision 9) — the only two `core/schemas/` edits this story makes,
  both additive.
- `ARCHITECTURE-SPINE.md`'s AD-28 table gains one citation on an existing row (`budget-exhausted`) and
  one entirely new row (`operator-cannot-accept-operand`). Not a new spine revision (this project's
  standing default, pinned at workflow level): the citation edit changes nothing structural, and the new
  row is ordinary registry growth exactly as AD-28's own text anticipates ("Adding a class is an
  amendment to this AD and to no other," `ARCHITECTURE-SPINE.md:420`) — the same mechanism Story 2.3
  used for its own AD-5 row, cited in AC 2 point 2 and Decision 9.
- No new npm script, no new runtime dependency. The Structural Seed's "Runtime dependencies: Zod alone
  today" (`ARCHITECTURE-SPINE.md:594`) stays true: `regexMatch`'s budget gate and every other operator
  use only built-in JS and this repository's own `core/canonical` code.
- `src/index.ts` is not touched (AC 1, AC 8).

### Testing requirements

- `tsconfig.json` sets `noUncheckedIndexedAccess`; any array index or `.match()` result is
  `T | undefined` — relevant to `ordering`'s adjacent-pair walk and `regexMatch`'s quantifier-count
  formula.
- `biome.json` sets `useImportType`/`useExportType` to `error`; `ResolvedValue` and
  `KeyedShapeDescriptor` are type-only imports where used only as types.
- AD-30's 90 percent `core/` coverage floor has no configured threshold in `vitest.config.ts`; the
  proxy, as in every prior story, is a positive test for every branch named in AC 7 plus assertions
  specific enough to fail if the property they name is removed (exact `RuntimeFault.code`, exact
  boundary values on `countTolerance`, not merely "does not throw").

### References

- `_bmad-output/planning-artifacts/epics.md` — Epic 3 intro (274–276), Story 3.1 (278–289), FR3 (72).
- `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md`
  — AD-1 (153–158), AD-4 (185–201), AD-26 (384–392), AD-28 (400–421), Consistency Conventions (524–536),
  Structural Seed (569–600), Capability → Architecture Map (602–616), Owed to the reference
  implementation (646–731).
- `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/EPIC-BRIEF.md` —
  Epic 3 section (90–110).
- `src/core/schemas/expression.ts`, `evidence-artifact.ts`, `primitives.ts`, `faults.ts`,
  `scoring-policy.ts`.
- `src/core/canonical/canonicalize.ts`, `digest.ts`, `value-domain.ts`.
- `src/core/seal/direction-prose.ts`.
- `tests/schemas/fixtures/gate-c-contract.ts`, `expression-nodes.ts`.
- `_bmad-output/implementation-artifacts/2-3-the-emitted-brief-scripting-audit.md`.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5), via Claude Code.

### Debug Log References

- Baseline before the first edit: `npm run check:docs` → 53 file(s) OK; `npm test` → 31 test files,
  1351 tests passed.
- After the `scoring-policy.ts` field add and the `faults.ts` → `RUNTIME_FAULT_CODES` conversion, the
  `ARCHITECTURE-SPINE.md` AD-28 edit: `npm run check:docs` and `npm run lint:spine` both green
  (`{"ok": true, "total_findings": 0}`).
- `npm run build:shareable` (21 files written) then `npm run check:shareable`: 21 committed pages
  match byte for byte.
- `npm run generate:schemas`: only `schemas/scoring-policy.schema.json` changed
  (`git diff --stat schemas/` confirmed one file), gaining `regexMatchStepBudget` and its `required`
  entry. `npm run check:schemas` green after.
- `tests/schemas/published/keyword-mutation.test.ts`'s pinned census was re-measured directly (not
  guessed), per AC 2 point 3's own instruction: ran `mutableKeywordOccurrences` against every
  published document from a throwaway script. `scoring-policy` 29 → 32 (three new occurrences: `type`,
  `minimum`, `maximum`, one each from the new field's three keywords); `CENSUS_BY_KEYWORD.type` 873 →
  874, `.minimum` 99 → 100, `.maximum` 97 → 98; `CENSUS_TOTAL` 1950 → 1953. Every other document and
  keyword count unchanged, confirmed by full census diff.
- `npm run typecheck`: clean, no errors, after `resolved-value.ts` and `operators.ts` were written.
- `npx biome check` on the new `src/core/evaluate/` and `tests/evaluate/` files: one formatting-only
  finding, fixed by `biome check --write`; a second pass found `lint/correctness/noPrecisionLoss` on
  three `9007199254740993` number literals in `operators.test.ts` (the literal itself loses precision
  at parse time even though the resulting double is the intended unsafe-range test value) — replaced
  with `Number.MAX_SAFE_INTEGER + 1`, which is exactly representable (2^53, no precision lost forming
  the literal) and still fails `Number.isSafeInteger`, so the fault path under test is unchanged.
  `npx biome check tests/evaluate/ src/core/evaluate/` clean after.
- `npx vitest run tests/evaluate/`: 2 test files, 56 tests, all passed on first run after the
  precision-loss fix.
- `npm run lint` (full repo, 101 files): clean.
- `npm test` (full repo): 33 test files, 1407 tests passed (1351 baseline + 56 new in
  `tests/evaluate/`).
- `npm run validate`: typecheck, lint, check:docs, check:shareable, lint:spine, check:vectors,
  check:schemas, check:ad5-registry all green; `test` → 33 test files, 1407 tests passed. Green end to
  end, first pass, no fix-up round needed after the precision-loss lint fix above.
- **Code-review round (post-implementation), nine patch findings, all fixed** — see Story Review
  Findings above. Two of the nine (the `regexMatch` escape-blindness fix and the `ordering` tie
  fixture) were verified by direct mutation before and after the fix, not merely by reasoning: for
  each, the source was temporarily mutated to remove the fix (escape-stripping deleted; `<=`/`>=`
  changed to `<`/`>`), the relevant new test(s) were run and confirmed to fail against the mutant with
  exactly the predicted symptom (`budget-exhausted` thrown on `^(\d\+)+$`; the naive linear estimate
  landing at exactly 3200 against a budget of 1000, matching the hand-computed prediction; the tied-
  elements case resolving `false` where the correct implementation resolves `true`), then the source
  was restored from a full-file backup and diffed byte-identical against the pre-mutation state before
  re-running the suite.
- `npm run generate:schemas` after the `regexMatchStepBudget` describe-text reword: only
  `schemas/scoring-policy.schema.json` changed; `npm run check:schemas` green. The keyword-mutation
  census was re-measured directly again (not assumed unchanged): identical to the prior measurement
  (`scoring-policy: 32`, `CENSUS_TOTAL: 1953`) — same keywords, only the description string's byte
  content changed, so `tests/schemas/published/keyword-mutation.test.ts` needed no edit this round.
- `npm run check:docs`, `npm run lint:spine`, `npm run build:shareable`, `npm run check:shareable`:
  all green after dropping `AD-26` from the AD-28 table's `operator-cannot-accept-operand` row.
- Final `npm run validate` after all nine fixes: typecheck, lint, check:docs, check:shareable,
  lint:spine, check:vectors, check:schemas, check:ad5-registry all green; `test` → 33 test files,
  **1417 tests passed** (1407 + 10 new: 2 existence/absence truthiness cases, 2 null-operand cases for
  equality/deepEquality, 1 containment collision fixture, 2 regexMatch escape-handling fixtures, 1
  ordering tie fixture, 1 shape compound/boolean type-mismatch fixture, 1 shape optional-typed-key-
  absent fixture).
- **Third review round (BLOCKING finding), reproduced under a hard subprocess timeout before and after
  the fix, not trusted from the report.** Pre-fix ordering, adversarial input
  `` `[${'a'.repeat(28)}X` `` against `^\[(a+)+\]$`: **~3.9s**, returned `false` (no throw — the real
  nested-quantifier group was hidden inside what the class-strip regex mistook for a character class).
  Same input, same pattern, fix applied (escape-neutralize before character-class-strip): **1ms**,
  threw `budget-exhausted`. Every one of the 68 then-existing `tests/evaluate/` fixtures re-run after
  the reorder and confirmed unchanged (none moved), matching the finding's own "prototyped and
  verified" claim.
- `npm run generate:schemas` after raising `regexMatchStepBudget`'s default to `1000000`: only
  `schemas/scoring-policy.schema.json` changed (one field's describe-text value); `npm run check:schemas`
  green. Keyword-mutation census re-measured directly a third time: identical to both prior
  measurements (`scoring-policy: 32`, total `1953`) — confirms the census is driven by keyword shape,
  not by a described numeric value.
- Final `npm run validate` after all four third-round fixes: typecheck, lint, check:docs,
  check:shareable, lint:spine, check:vectors, check:schemas, check:ad5-registry all green; `test` →
  33 test files, **1419 tests passed** (1417 + 2 new: the escaped-bracket nested-quantifier fixture and
  the residual-still-correct-after-reordering fixture, both in `regexMatch`'s describe block).

### Completion Notes List

- All seven tasks complete; `npm run validate` is green end to end.
- No deviation from any of the ten Decisions recorded at story creation; all ten held as written,
  including Decision 3's flagged `containment` construction and Decision 2's four-draft-rejected
  `equality`/`deepEquality` split, both implemented exactly as specified and covered by the fixtures
  AC 7 names for them.
- `regexMatch`'s structural nested-quantifier scan (AC 5) needed one construction beyond what the
  story's own pseudocode states verbatim: a group's contents are checked for a quantifier character
  only *after* stripping the group's own non-capturing/lookaround marker (`?:`, `?=`, `?!`, `?<name>`,
  `?<=`, `?<!`) from the front of the captured contents. Without that strip, the bare `?` every
  `(?:…)` opens with reads as a quantifier character of its own, which would flag an entirely ordinary
  construct like `^(?:GET|POST)+$` (no interior repetition at all) as a nested-quantifier shape — a
  false positive on a common, harmless pattern shape this codebase's own `expression.ts` text
  recommends authors write (`^(?:a|b)$`). This is a refinement within the story's own "cheap,
  documented, deliberately imperfect check" framing (modeled on `ANCHORED_PATTERN_FORM`'s precedent),
  not a deviation from its intent; `tests/evaluate/operators.test.ts` adds a fixture proving
  `^(?:GET|POST)+$` does not throw, alongside every fixture AC 7 point 4 names explicitly.
- `equality`'s and `deepEquality`'s shared "structurally equal" comparison was factored into one
  private `structurallyEqual` helper (digest-based, per AC 3's own code block), reused by `equality`'s
  compound branch, `deepEquality`, and both `containment` and `setMembership`'s element matching —
  avoiding four independent copies of the same `digestArtifact(...) === digestArtifact(...)` pattern.
- `shape`'s per-key declared-type check and `equality`'s type-mismatch check both need the same
  six-member JSON-kind mapping (AC 3's `jsonKind`/AC 6 point 3's runtime-type mapping are the identical
  function, stated twice in the story text); implemented once as a shared private `jsonKind` helper
  rather than as two copies.
- The AD-28 table now carries ten rows (nine existing plus `operator-cannot-accept-operand`);
  `RUNTIME_FAULT_CODES` carries four of them (the ones with a genuine thrower), matching Decision 9's
  own stated count.
- **The two-tier gate's escape-handling order (neutralize backslash escapes, then strip character
  classes) is load-bearing, not stylistic.** The reverse order — character-class-stripping the raw
  pattern before any escape-awareness exists — is an actual ReDoS bypass, not a cosmetic imprecision:
  an escaped bracket can hide a real nested-quantifier group from both gate tiers entirely. This
  surfaced only in a second, independent review round after the first round's escape-stripping fix
  (round two) accidentally preserved the unsafe ordering while fixing a different, narrower
  escape-blindness bug. `hasNestedQuantifier` no longer needs its own escape-awareness at all: with
  escape-neutralization run once, up front, in `regexMatch`, no backslash ever reaches the paren scan.

### File List

- `src/core/evaluate/resolved-value.ts` (new)
- `src/core/evaluate/operators.ts` (new)
- `tests/evaluate/resolved-value.test.ts` (new)
- `tests/evaluate/operators.test.ts` (new)
- `src/core/schemas/scoring-policy.ts` (edited: `regexMatchStepBudget` field, `.meta()` description)
- `src/core/schemas/faults.ts` (edited: `RuntimeFaultCode` → data-derived `RUNTIME_FAULT_CODES`,
  `'budget-exhausted'` and `'operator-cannot-accept-operand'` added)
- `schemas/scoring-policy.schema.json` (regenerated)
- `tests/schemas/fixtures/artifact-fixtures.ts` (edited: `scoringPolicyFixture` gains
  `regexMatchStepBudget: 10000`)
- `tests/schemas/published/keyword-mutation.test.ts` (edited: re-measured census constants)
- `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md`
  (edited: AD-28 table, `budget-exhausted`'s `Commanded by` and the new
  `operator-cannot-accept-operand` row)
- `_bmad-output/shareable/eval-quality-architecture-spine.html` (regenerated, byte-mirror of the spine
  edit)
- `_bmad-output/project-knowledge/learning-path-step-by-step.md` (edited: Step 8, one new table row)

## Suggested Review Order

**The resolved-value domain**

- The one new type every operator resolves over: `ABSENT` as a symbol, never a string or `null`.
  [`resolved-value.ts:10`](../../src/core/evaluate/resolved-value.ts#L10)

**Identity family — the operator with four rejected drafts behind it**

- Cost-ordered three-way branch: type mismatch, then `===`, then structural — read this with Decision 2.
  [`operators.ts:88`](../../src/core/evaluate/operators.ts#L88)
- Unconditionally structural, no scalar fast path — the operator `equality` deliberately isn't.
  [`operators.ts:112`](../../src/core/evaluate/operators.ts#L112)
- Shared structural-comparison helper both operators fall through to.
  [`operators.ts:52`](../../src/core/evaluate/operators.ts#L52)

**Membership family — the story's least-grounded construction**

- Dual-mode candidate (`ResolvedValue | JsonValue[]`) and its documented literal-vs-referenceSet collision.
  [`operators.ts:165`](../../src/core/evaluate/operators.ts#L165)
- Simpler sibling: one collection, one candidate, always structural matching.
  [`operators.ts:131`](../../src/core/evaluate/operators.ts#L131)

**`regexMatch` — the two-tier budget gate, post-review escape-fix**

- Entry point: pattern compilation, then the two-tier gate, then native matching.
  [`operators.ts:276`](../../src/core/evaluate/operators.ts#L276)
- The structural nested-quantifier scan — now escape-aware after the review round.
  [`operators.ts:234`](../../src/core/evaluate/operators.ts#L234)

**Structural family**

- Non-strict (tie-permitting) adjacent-pair comparison, now covered by a tie fixture.
  [`operators.ts:339`](../../src/core/evaluate/operators.ts#L339)
- Unrounded relative-deviation arithmetic (Decision 5).
  [`operators.ts:384`](../../src/core/evaluate/operators.ts#L384)
- Closed-set (`permittedKeys` alone) and the type-skip-when-absent branch.
  [`operators.ts:406`](../../src/core/evaluate/operators.ts#L406)

**The `ScoringPolicy` field and the `RuntimeFault` registry**

- The new budget field, reworded self-contained after the review round.
  [`scoring-policy.ts:58`](../../src/core/schemas/scoring-policy.ts#L58)
- `RuntimeFaultCode` converted to a data-derived tuple, gaining the new operand-rejection code.
  [`faults.ts:18`](../../src/core/schemas/faults.ts#L18)
- The AD-28 table row this story adds, citation corrected post-review to drop the misgrounded AD-26.
  [`ARCHITECTURE-SPINE.md:419`](../planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md#L419)

**Peripherals — fixtures, tests, generated artifacts**

- All ten operators' fixtures, including the nine review-round additions (ties, nulls, escapes, falsy values).
  [`operators.test.ts:1`](../../tests/evaluate/operators.test.ts#L1)
- `ABSENT`'s own small sentinel test.
  [`resolved-value.test.ts:1`](../../tests/evaluate/resolved-value.test.ts#L1)
- The one fixture construction site touched by the new required field.
  [`artifact-fixtures.ts:485`](../../tests/schemas/fixtures/artifact-fixtures.ts#L485)
- The re-measured (not guessed) published-keyword census.
  [`keyword-mutation.test.ts:120`](../../tests/schemas/published/keyword-mutation.test.ts#L120)
- Regenerated, byte-exact: `schemas/scoring-policy.schema.json`, `eval-quality-architecture-spine.html`.
