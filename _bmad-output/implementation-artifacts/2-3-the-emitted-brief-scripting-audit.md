---
epic: 2
story: 3
key: 2-3-the-emitted-brief-scripting-audit
baseline_commit: 5eb18e89b9cb3e6916117623d71c951b4bf6586b
---

# Story 2.3: The emitted-brief scripting audit

Status: done

## Story

As the discipline's enforcement point,
I want a post-generation audit over the emitted brief,
so that generated prose cannot smuggle in the enumerated path the declaration-side predicate cannot see.

## Acceptance Criteria

### AC 1 — Module location, pure-function contract, and what this story does not build

A new file, `src/core/seal/scripting-audit.ts`, pure and deterministic per AD-1: no filesystem,
network, clock, subprocess, or randomness. It imports `core/schemas` and `core/seal/` only, plus one
named exception: `core/failure-codes.ts`, for `StructuralFailure` and `FailureCode` per Decision 2 —
that module is neither `core/schemas/` nor `core/seal/`, and living beside the AD-5 registry it belongs
to (rather than being re-declared locally) is the point of Decision 2, so this sentence names the
exception rather than reading as contradicted by it.

This story builds **the audit alone** — a pure function that reads an already-assembled
`SealedEvaluatorBrief` (`src/core/schemas/sealed-evaluator-brief.ts`) and either returns normally or
throws. It does **not** build:

- `seal(contract): SealedEvaluatorBrief`, the orchestrating function that assembles a brief from a
  contract — that is Story 2.2 (brief assembly, exclusions, and canonical ordering), which remains
  `backlog` as of this story's creation. **This story is buildable ahead of Story 2.2 anyway**,
  exactly the way Story 2.1 built `renderDirectionText` without `seal()` existing: the audit's input
  shape is fixed by the already-shipped `SealedEvaluatorBrief` schema (Epic 1, done), so every fixture
  this story needs is a hand-constructed, schema-valid brief slice, not an output of Story 2.2's
  future orchestrator. Story 2.2 wires this story's `auditBriefScripting` in after generation, as
  `seal` acceptance work — this story does not anticipate that wiring or add an `src/index.ts` export
  for it, matching Story 2.1's own rule that the exported surface waits for the function that earns it.
- anything from `core/compile/` — Epic 4 does not exist yet (no `src/core/compile/` directory in the
  tree). Epics are sequenced so no story depends on a later epic's output (epics.md, Requirements
  Inventory), and this story's own reason to exist is that a declaration-side check (Epic 4 Story
  4.3's graph predicate over the interaction plan) **cannot see** what this story audits: free text an
  author wrote directly onto `scope`/`negativeDomain`, which has no structure a plan-graph predicate
  can read. The two checks are independent by design, not sequenced.

**Must not** (epics.md, Epic 2's standing prohibition, applies to every story in the epic): call a
model, execute an evaluator, expose a contract step identifier on any rendered string, or copy the
throwaway Gate D generator into the package. None of these apply directly to this story's own code
(it does not render anything), but the audited *input* — `BriefDirection.text` — was produced under
those same prohibitions by Story 2.1, and this story's fixtures must not defeat them by hand-authoring
a `text` value that contains a step identifier.

### AC 2 — The AD-5 code: mint it, register it, and give it its one thrower

`EvalContract.probeStepBound` and `SealedEvaluatorBrief.probeStepBound`
(`src/core/schemas/eval-contract.ts`, `src/core/schemas/sealed-evaluator-brief.ts`) already carry the
identical comment: **"The AD-5 code that audit fires is Epic 2's to mint alongside its only
thrower."** This story is that mint.

1. **The code.** `brief-exceeds-scripting-bound`, cited by AD-16. AD-16 (`ARCHITECTURE-SPINE.md`,
   lines 304–313) is where the sentence "The brief-side scripting audit runs after generation, carries
   its own AD-5 code and a declared bound on enumerated probe steps" actually lives, and both
   `probeStepBound` field comments independently attribute the bound to "AD-16's declared bound" —
   not AD-38 (staging/adoption-path, checked and ruled out; see Decisions).
2. **The registry table edit.** `ARCHITECTURE-SPINE.md`'s AD-5 section (`### AD-5 ` to `### AD-6 `,
   lines 203–241) carries a twenty-row table ending:
   ```
   | `scoped-reference-resolves-forbidden` | a scoped resource reference resolves to a forbidden input | AD-16 |
   | `waiver-incomplete` | a waiver omits any required part | AD-6, AD-21 |
   ```
   Append one row directly after `waiver-incomplete`, before the table's closing blank line:
   ```
   | `brief-exceeds-scripting-bound` | the emitted brief's generated direction prose exceeds the contract's declared bound on enumerated probe steps | AD-16 |
   ```
   This is a normal registry growth, not a new spine revision: AD-5's own rule says "Adding a class is
   an amendment to this AD and to no other" (line 232), and this project's standing default is to
   settle a decision where the work happens (per Story 2.1 Decision 5's AD-39 edit and this project's
   own convention) rather than open a review round. Run `npm run check:docs` and `npm run lint:spine`
   after the edit; both already run under `validate` and both read this file. Also run
   `npm run build:shareable` after the edit, before moving on: the committed
   `_bmad-output/shareable/eval-quality-architecture-spine.html` is a generated, byte-compared mirror
   of this file (`npm run check:shareable`, under `validate`), and a spine edit with no matching
   rebuild fails that gate at the end instead of at the edit that caused it.
3. **`src/core/failure-codes.ts`.** Append `'brief-exceeds-scripting-bound'` as the 21st (last) entry
   of `FAILURE_CODES`, preserving order — `scripts/check-ad5-registry.ts` asserts **set and order**
   equality between the parsed table and this tuple, reading only the table's first column and only
   the first table in the AD-5 section, so the row above and this entry must be added at the same
   relative position (last). Update both of the file's two "twenty" mentions to "twenty-one": the
   top-of-file docblock (line 1, "AD-5's twenty compile-time failure codes...") and the tuple-locking
   comment (line 17, "twenty members, unique, kebab-case").
4. **`tests/schemas/failure-codes.test.ts`.** Update `toHaveLength(20)` to `21` and the test
   description ("carries exactly the twenty AD-5 codes") to twenty-one; update the comment above it
   the same way.
5. **The thrower: a new `StructuralFailure` class, in `src/core/failure-codes.ts` beside
   `FAILURE_CODES`/`FailureCode`.** The Consistency Conventions' Errors row draws a three-way line: "A
   fault is a thrown typed error carrying a stable machine code from AD-28's runtime fault registry
   ...; a compile-time failure is neither, and carries a code from AD-5's separate registry." AD-28's
   `RuntimeFault` (`src/core/schemas/faults.ts`) is therefore the wrong class to throw here — reusing
   it would conflate the two disjoint registries the Errors convention keeps apart, and `faults.ts`'s
   own header comment already says the two registries "share at most this base shape, never a code
   table." `StructuralFailure` mirrors `RuntimeFault`'s shape (a `code: FailureCode`, an
   `artifactPath: string`, an `Error` subclass with a matching constructor and `name`) without
   subclassing or importing it — the same "share the shape, not the class" relationship `faults.ts`
   already documents for AD-28 against AD-5.
   ```ts
   export class StructuralFailure extends Error {
     readonly code: FailureCode
     readonly artifactPath: string
     constructor(
       code: FailureCode,
       artifactPath: string,
       detail: string,
       options?: { cause?: unknown },
     ) {
       super(`${code} in ${artifactPath}: ${detail}`, options)
       this.name = 'StructuralFailure'
       this.code = code
       this.artifactPath = artifactPath
     }
   }
   ```
   This class is not scoped to `seal`: AD-5's registry is the *compile-time* failure registry, shared
   by all twenty-one codes, and Epic 4 (Story 4.2, "the AD-5 registry as code and the structural
   compile checks") will need the same class for its other twenty. Living beside `FAILURE_CODES`
   rather than in `core/seal/` is deliberate so Epic 4 finds it already there rather than minting a
   second one — this mirrors Story 2.1 Decision 7's reasoning for adding its four schema type aliases
   beside their own schemas rather than locally. **This is this story's one `src/core/failure-codes.ts`
   edit**, alongside the tuple append in point 3.

### AC 3 — The audit: what "enumerated probe steps" counts, and the bound it is checked against

```ts
// src/core/seal/scripting-audit.ts
export function auditBriefScripting(brief: SealedEvaluatorBrief): void
```

Returns normally when the brief is within bound; throws `StructuralFailure` otherwise. Not a
predicate returning a boolean or a result object — this mirrors Story 2.1's own house style
(`buildPlanIndex`, `resolveStep`, `renderDirectionText` all throw directly on their own detected
violation rather than returning a wrapped result), and matches the schema comments' "thrower"
language literally.

1. **`probeStepBound: number | null` (on the brief, carried through from the contract by Story 2.2's
   future `seal()`).** `null` means no bound was declared, and the audit passes vacuously — this
   matches the codebase's established null-means-absent-constraint convention (e.g.
   `EvalContract.interactionPlan`'s own comment: "No maximum and no bound on `after` chains"). A
   declared `0` is a legal, strict value: no enumerated-probe-step marker of any kind is permitted.
2. **What counts as a marker, scoped to `brief.directions[].text` only** — not `behaviors`,
   `scopedResources`, or `safetyLimits`. FR8 (epics.md) and AD-38 tie "prose exceeding its declared
   probe-step bound" specifically to what `seal` "deterministically generates ... from direction
   fields"; this is the narrowest reading the text supports, and widening it is a flagged decision
   below, not pre-empted here. A marker is a case-insensitive, whole-word match against:
   ```ts
   const SEQUENCE_MARKER_PATTERN =
     /\b(?:then|before|after|subsequently|next|finally|afterward)\b|\b\d{1,2}[.)]\s/gi
   ```
   — the sequencing/transition vocabulary Story 2.1's own AC 4 already names as forbidden in
   generator-composed text ("Do not use 'first', 'then', 'before', 'after', 'subsequently', or
   equivalent ordering words"), plus a numbered-list marker (`1.`, `2)`, ...). **Bare ordinal words
   (`first`, `second`, `third`, ...) are deliberately excluded** — see Decisions for the already-shipped
   fixture that ruled them out.

   Because Story 2.1's own generator never emits this vocabulary in its composed clauses (that is
   what AC 4 there enforces), any match in a direction's full `text` necessarily came through the one
   channel Story 2.1 exempts from that check: author-written `scope`/`negativeDomain`, passed through
   verbatim. That is precisely the smuggling path this story's own story statement names.
3. **The count and the comparison, per direction.** For each `BriefDirection` in `brief.directions`,
   count total regex matches (`match(SEQUENCE_MARKER_PATTERN)?.length ?? 0`) in its `text`. The bound
   applies **per direction**, not summed across the brief: an enumerated path is something a reader
   reconstructs from *one* direction's own narrated claim, and the bound is the ceiling on how many
   such markers any single direction's prose may carry.
4. **On violation:** throw
   ```ts
   throw new StructuralFailure(
     'brief-exceeds-scripting-bound',
     `SealedEvaluatorBrief.directions[oracleId=${direction.oracleId}].text`,
     `${count} enumerated-probe-step marker(s) exceed the declared bound of ${brief.probeStepBound}`,
   )
   ```
   If more than one direction violates its bound, which one's failure surfaces first is only as
   deterministic as `brief.directions`' own array order — this story does not require finding every
   violation in one pass. What *is* a correctness property, and what AC 5's permutation test holds
   directly: which `oracleId` a throw names must not depend on that direction's position in the array
   when only one direction actually violates — see AC 5.

### AC 4 — Fixtures: reuse Story 2.1's generator for accept fixtures, hand-author the reject shapes

The audit's input is a `SealedEvaluatorBrief`, but nothing in the tree assembles one yet (Story 2.2).
Build fixtures the same way Story 2.1 built its own inputs without `seal()` existing: construct
schema-valid pieces by hand, validated by `SealedEvaluatorBrief.parse(...)` or
`z.array(BriefDirection).parse(...)` at fixture-definition time, mirroring `tests/seal/fixtures.ts`'s
own `validateContractSlice` pattern.

1. **Real generated prose for accept fixtures, not hand-typed strings.** Call Story 2.1's shipped
   `buildPlanIndex` + `renderDirectionText` (`src/core/seal/plan-index.ts`,
   `src/core/seal/direction-prose.ts`) over `gateCContract`'s own eight oracles
   (`tests/schemas/fixtures/gate-c-contract.ts`) to produce real `BriefDirection.text` values, then
   assemble a minimal hand-built `SealedEvaluatorBrief` around them (the non-`directions` fields —
   `behaviors`, `permittedInterfaces`, `scopedResources`, `budgets`, `safetyLimits`, lineage,
   `contractDigest` — need only be schema-valid, not meaningful, since the audit reads only
   `directions` and `probeStepBound`).
2. **The regression case: `gateCContract`'s own O-004 negative domain.** Line ~310,
   `scope: 'Every element of the returned page, not the first.'` — real, already-shipped author text
   using "first" as a data-position adjective, not a step marker. `gateCContract` itself declares
   `probeStepBound: null` (line 718), so this never exercises the bound in the contract fixture
   directly; author a **separate** test brief reusing this same rendered direction with a **non-null**
   bound (e.g. `0`) and assert the audit does not throw — proving the marker vocabulary in AC 3
   correctly excludes it. This is the concrete evidence behind Decision 4 below, not a hypothetical.
3. **`populatedContract`'s `probeStepBound: 8`** (`tests/schemas/fixtures/relevance-contracts.ts`,
   line 311) is a second real, already-shipped non-null bound; render its own direction the same way
   and assert the audit passes under its declared bound.
4. **Reject fixtures are hand-authored `BriefDirection` values**, since Story 2.1's generator never
   itself produces scripted text — simulating what a `renderDirectionText` output would look like if
   an author's free text smuggled a script through `scope`/`negativeDomain`, e.g.:
   ```ts
   { oracleId: 'O-999', text: 'The check is asserted to hold. First send the request, then read the response, and finally confirm the record.' }
   ```
   (two markers: `then` and `finally` — `First` is excluded per Decision 4's bare-ordinal exclusion,
   and nothing else in the sentence matches; verify this against `SEQUENCE_MARKER_PATTERN` directly
   rather than trusting the count restated here) against a brief with
   `probeStepBound: 1`, asserting `auditBriefScripting` throws `StructuralFailure` with
   `code: 'brief-exceeds-scripting-bound'` and an `artifactPath` naming `oracleId: 'O-999'`.
5. **A numbered-list reject fixture**, independent of the word-vocabulary branch: a `text` containing
   `'1. Do the first thing. 2. Do the second thing.'` against a low bound, asserting the
   `\d{1,2}[.)]\s` branch fires on its own.
6. **`probeStepBound: null` always passes**, asserted against a `text` deliberately carrying several
   markers — proves the vacuous-pass path independent of the marker-counting path.

### AC 5 — Tests and the gate

- Tests live at `tests/seal/scripting-audit.test.ts`, mirroring `src/core/seal/scripting-audit.ts` the
  way `tests/seal/direction-prose.test.ts` mirrors `direction-prose.ts`.
- Every case in AC 4 gets an assertion: the two accept fixtures (`gateCContract` sweep, real prose,
  `probeStepBound: null`), the O-004 "not the first" regression case at a strict non-null bound, the
  `populatedContract` bound-8 case, the two hand-authored reject fixtures (word-vocabulary and
  numbered-list), and the `null`-bound-always-passes case.
- **Permutation test, over a brief that mixes a violator with a passer.** A single-direction brief
  makes "permute `brief.directions`" a no-op — permuting a one-element array proves nothing about
  per-direction isolation, since a bug that always reported whichever direction sits at index 0 would
  pass it too. Build the permutation-test brief from **two or more** directions: the AC 4 point 4
  reject fixture (`oracleId: 'O-999'`) plus at least one passing direction (e.g. one of the
  `gateCContract` accept-sweep directions, or the O-004 regression direction). Assert the throw still
  names `O-999` under at least two distinct orderings (violator first, violator last), consistent with
  this project's standing AD-30 permutation-family convention (Story 2.1 AC 5).
- Assert the exact thrown `code` and that `artifactPath` names the offending `oracleId` — a test
  asserting only `toThrow()` without checking `code`/`artifactPath` is the "passes for the wrong
  reason" defect Story 1.3's review round found and every story since writes against (Story 2.1 AC 5).
- `npm run check:docs` and `npm test` run and the baseline is recorded **before the first edit**.
- `npm run validate` passes at the end (typecheck, lint, `check:docs`, `check:shareable`, `lint:spine`,
  `check:vectors`, `check:schemas`, `check:ad5-registry`, `test`). `check:ad5-registry` is the one
  script this story's spine edit and `failure-codes.ts` edit must keep green — run it directly after
  each of those two edits, before moving on, so a mismatch is caught at the edit that caused it.
- `src/index.ts` is not touched, per AC 1.
- `_bmad-output/project-knowledge/learning-path-step-by-step.md`: add Step 7 after this story's
  `dev-story` workflow marks it done (not before — the template's own rule), following
  `learning-path-template.md`'s shape exactly, one row added to the table at the top.

## Tasks / Subtasks

- [x] Task 1: preflight (AC 5)
  - [x] Run `npm run check:docs` and `npm test`; record the baseline test count before the first edit.
- [x] Task 2: mint the AD-5 code (AC 2)
  - [x] Edit `ARCHITECTURE-SPINE.md`'s AD-5 table: append the `brief-exceeds-scripting-bound` row.
        Run `npm run check:docs` and `npm run lint:spine`, then `npm run build:shareable` to resync
        the committed HTML mirror and confirm `npm run check:shareable` is green.
  - [x] Edit `src/core/failure-codes.ts`: append the code to `FAILURE_CODES`, update the header
        comment's two "twenty" mentions (line 1 and line 17) to "twenty-one", add the
        `StructuralFailure` class.
  - [x] Edit `tests/schemas/failure-codes.test.ts`: 20 → 21, update descriptions.
  - [x] Run `npm run check:ad5-registry`; confirm it passes before moving on.
- [x] Task 3: the audit function (AC 3)
  - [x] `src/core/seal/scripting-audit.ts`: `SEQUENCE_MARKER_PATTERN`, `auditBriefScripting`, the
        per-direction count-vs-bound comparison, the `StructuralFailure` throw.
- [x] Task 4: the fixtures (AC 4)
  - [x] Real-prose accept fixtures via `buildPlanIndex` + `renderDirectionText` over `gateCContract`.
  - [x] The "not the first" regression fixture at a non-null bound (O-005, not O-004 — see Decisions).
  - [x] The `populatedContract` bound-8 fixture.
  - [x] Hand-authored word-vocabulary and numbered-list reject fixtures.
  - [x] `probeStepBound: null` always-passes fixture.
- [x] Task 5: tests (AC 5)
  - [x] Every AC 4 fixture asserted, including exact `code`/`artifactPath` on each throw.
  - [x] Permutation test over `brief.directions` order.
- [x] Task 6: the gate (AC 5)
  - [x] `npm run validate` green.
- [x] Task 7: record
  - [x] `_bmad-output/project-knowledge/learning-path-step-by-step.md`, Step 7: one line in the table
        plus a short section, per the doc's own brevity rule and template.
  - [x] Dev Agent Record: measured counts, any decision that moved from this story's default.

### Story Review Findings

Fresh-context adversarial review of the story file, 2026-08-21, at baseline `5eb18e8`, before any
implementation. Four passes in this repository's usual shape: blind hunter, edge-case hunter,
verification-gap, acceptance auditor, run in a peer Claude Code session. Every quotation and
line-number citation in the story was checked against `epics.md`, `ARCHITECTURE-SPINE.md` (AD-5,
AD-16, AD-38, the Errors convention row), the shipped schemas and `failure-codes.ts`/`faults.ts`,
`scripts/check-ad5-registry.ts`, the two cited fixture files, and
`2-1-the-direction-prose-generator.md`, and all held: the AD-16-not-AD-38 citation, the Errors
convention quote, both `probeStepBound` schema-comment quotes, the AD-5 table's last two rows, the
`gateCContract`/`populatedContract` line numbers and values, `FAILURE_CODES`'s current length of
twenty, and the `renderDirectionText`/`buildPlanIndex` signatures AC 4 assumes. `npm run lint:spine`
and `npm run check:docs` were run against the proposed AD-5 table edit directly (then reverted) and
both pass. Five findings; all five are fixed in the acceptance criteria and decisions above rather
than left as a report. Status stays `ready-for-dev`.

- [x] [Review][Patch] HIGH. **AC 5's permutation test could pass without exercising the property it
      claims to prove.** A single-direction reject fixture makes "permute `brief.directions`" a
      no-op — permuting a one-element array proves nothing about per-direction isolation, and would
      let a bug that always reported index 0 pass the test anyway. Fixed: AC 5's permutation test now
      requires a brief mixing the reject fixture with at least one passing direction, asserting the
      throw still names `O-999` under at least two distinct orderings; AC 3 point 4's hedge is
      corrected to match rather than read as routing around it.
- [x] [Review][Patch] MEDIUM. **AC 4 point 4's guessed marker count was wrong.**
      `SEQUENCE_MARKER_PATTERN` against the example reject text matches `then` and `finally` only —
      two, not three (`First` is correctly excluded as a bare ordinal). The fixture's own logic still
      held either way (2 > 1), but the wrong number risked propagating into a comment or an early
      assertion. Fixed: the parenthetical states the correct count and points at verifying against
      the pattern directly rather than trusting the restated number.
- [x] [Review][Patch] MEDIUM. **The "twenty" → "twenty-one" instruction named only one of two
      occurrences in `src/core/failure-codes.ts`.** The word appears at the top-of-file docblock
      (line 1) and separately inside the tuple-locking comment ("twenty members, unique, kebab-case",
      line 17); nothing in `validate` catches a stale comment-text count. Fixed: AC 2 point 3 and
      Task 2 now name both locations explicitly.
- [x] [Review][Patch] LOW. **A line citation was imprecise.** "Adding a class is an amendment to this
      AD and to no other" was cited as "line 241 area"; the sentence is at line 232, and 241 is where
      the section's own closing `### AD-6` heading begins. Fixed: cited as line 232.
- [x] [Review][Patch] LOW. **Decision 3's "the mechanism ... is the same" phrasing could license
      modeling `StructuralFailure` on Story 2.1's bare `TypeError` rather than on `RuntimeFault`'s
      coded shape, which is the opposite of what Decision 2 specifies.** Fixed: reworded to state
      plainly that only the throw-not-return half of the Story 2.1 precedent carries over, and the
      error's own shape mirrors `RuntimeFault` instead, per Decision 2.

Code review of the finished implementation, run in a peer Claude Code session. Seven "patch" findings,
all trivially fixable; all seven addressed below rather than left as a report. Four other findings
were routed to `deferred-work.md` (pre-existing gaps in Epic-1-owned files, and a task-list
documentation gap), and several more were checked and rejected (already covered by existing tests, or
explicitly out of this story's stated scope) — no action taken on either group.

- [x] [Review][Patch] HIGH. **`SEQUENCE_MARKER_PATTERN` was under-verified: 5 of the 7 word markers
      (`before`, `after`, `subsequently`, `next`, `afterward`) and the `)`-style numbered-list variant
      (e.g. `2)`) were never asserted under a non-null bound.** The only fixture containing every
      marker (`manyMarkersDirection`) was used solely under `probeStepBound: null`, which returns
      before the regex ever runs — narrowing the shipped regex to `/\b(?:then|finally)\b|\b\d{1,2}\.\s/gi`
      (dropping the other 5 words and the `)` variant) still passed all 9 then-existing tests. Fixed:
      added an `it.each` over all 7 words plus `afterwards` and a `)`-variant case, each isolated in its
      own direction and checked against a strict bound of 0 (`tests/seal/scripting-audit.test.ts`,
      "every `SEQUENCE_MARKER_PATTERN` member proven under a non-null bound").
- [x] [Review][Patch] MEDIUM-HIGH. **The numbered-list branch `\b\d{1,2}[.)]\s` had no list-context
      anchor, so ordinary numeric prose false-positively matched as an enumerated-step marker** (e.g.
      "See item 5. It explains...", "Rule 12. All calls...", "$2. 50"), which could wrongly throw
      `StructuralFailure` on legitimate author prose. Fixed: the pattern now requires the digit run to
      follow the start of the string, a newline, or a sentence-ending mark plus whitespace (a
      lookbehind), so a mid-sentence digit like "item 5." or "Rule 12." never opens a list item.
      `tests/seal/scripting-audit.test.ts` adds a fixture proving ordinary numeric prose does not throw.
- [x] [Review][Patch] MEDIUM. **The same branch required exactly 1-2 digits (`\d{1,2}`) and mandatory
      trailing whitespace (`\s`), so a 3+ digit step number or a numbered marker at the very end of a
      direction's `text` (nothing following the final period) evaded detection.** Fixed: the digit
      count is now unbounded (`\d+`) and the trailing boundary is a lookahead for whitespace or
      end-of-string (`(?=\s|$)`) rather than a consumed `\s`; `tests/seal/scripting-audit.test.ts` adds
      a fixture for each case.
- [x] [Review][Patch] MEDIUM. **The marker vocabulary matched `afterward` but not its inflected form
      `afterwards`** (`\bafterward\b` cannot match inside "afterwards") — a real evasion path. Fixed:
      changed to `afterward(?:s)?` in the alternation; the finding-1 `it.each` above includes
      `afterwards` as its own case.
- [x] [Review][Patch] MEDIUM. **`tests/schemas/ad5-admissions.test.ts`'s own header comment claimed
      "The walk of AD-5's twenty codes" and the file had no `admits(...)` entry for the new
      `brief-exceeds-scripting-bound` code.** Fixed: added an admission-boundary test proving the
      contract schema still admits sequencing vocabulary in a direction's `scope`/`negativeDomain` (the
      post-generation brief audit rejects it, not the contract schema), and updated "twenty" to
      "twenty-one" in the header comment.
- [x] [Review][Patch] LOW. **AC 1 stated the new file "imports `core/schemas` and `core/seal/` only,"
      but `scripting-audit.ts` also imports `StructuralFailure`/`FailureCode` from
      `../failure-codes.ts`** (neither directory) — a deliberate, correct consequence of Decision 2,
      but AC 1's own sentence was never reconciled against it. Fixed: AC 1's import sentence now names
      the `core/failure-codes.ts` exception and points at Decision 2.
- [x] [Review][Patch] LOW. **No assertion that `gateCContract.oracles.length === 8`, even though the
      accept-fixture test's own name and AC 4 point 1 hard-code "all eight `gateCContract`
      directions."** A future edit to the shared fixture could silently invalidate the test's premise
      without failing it. Fixed: added `expect(gateCContract.oracles).toHaveLength(8)` alongside the
      existing accept-fixture test.

An independent peer Claude session, given fresh eyes on the diff and no prior context from either of
this story's own internal review layers, ran `/code-review` at high effort and empirically verified
every finding with a direct Node repro before reporting. This is the first review round on this story
that came from outside the project's own review process, and it caught real gaps the internal layers
above did not: the numbered/lettered-list branch's remaining coverage holes (indentation, doubled
spacing, no spacing, a paraphrase, a lettered list), a self-contradiction the AD-5 spine text itself
had carried since the row was added, and two items this project's own last round had filed as
deferred work that turned out to be trivially fixable in the same pass rather than genuinely
deferrable. Seven findings; all fixed below except the one item explicitly rejected as an
already-reasoned decision.

- [x] [Review][Patch] HIGH. **`SEQUENCE_MARKER_PATTERN`'s list-marker branch still had real coverage
      gaps, confirmed by direct Node repro (five cases all returned zero matches): an indented list
      item (leading whitespace after a newline), a doubled sentence-terminal space before the marker,
      no space at all between the marker's punctuation and the following word, the paraphrase
      "Subsequent to" (the adjective, not only the adverb "subsequently"), and a lettered list
      (`a)`/`b)`) rather than a numbered one.** Fixed: the list-context lookbehind now allows optional
      leading whitespace of any length between the anchor (start-of-string, a newline, or a
      sentence-ending mark) and the marker, using a variable-length lookbehind (V8 supports this); the
      trailing boundary changed from a whitespace/end-of-string lookahead to a negative lookahead for
      another digit (`(?!\d)`), which correctly rejects a genuine decimal ("12.5", next character a
      digit) while accepting a directly-abutting marker ("1.Do...", next character a letter); the
      marker itself is now an unbounded digit run or a single letter, so `a)`/`b)` count; and
      `subsequent(?:ly)?` was added to the word alternation, mirroring the earlier
      `afterward(?:s)?` fix. A fixture was added for each of the five reformatted cases plus a genuine
      decimal fraction (must still not match), and every fixture from both prior rounds was
      re-verified by direct script to still produce its previously-asserted count before any test was
      written. Decision 4 gained an explicit addendum: a fully paraphrased sequence with no marker word
      at all, or one relying solely on bare ordinals, remains a known, accepted limitation of a
      keyword-heuristic audit, not something this fix chases, consistent with this Decision's own
      already-reasoned exclusion of bare ordinals.
- [x] [Review][Patch] LOW. **`ARCHITECTURE-SPINE.md`'s AD-5 section contradicted its own two
      governing sentences once the new row existed: "Each code below is emitted by `compile`" (untrue
      of `brief-exceeds-scripting-bound`, emitted by the post-generation brief audit), and "Every
      commanding AD now cites its codes literally" (AD-16's body said the audit "carries its own AD-5
      code" without ever naming it, so the literal string appeared exactly once in the whole document,
      inside the table itself).** Fixed in place, not escalated to a new spine revision (AD-5's own
      text already treats registry growth as an ordinary amendment to itself): the "emitted by
      `compile`" sentence now names this one exception explicitly, and AD-16's body now literally cites
      `brief-exceeds-scripting-bound` by name. `npm run check:docs`, `npm run lint:spine`, and
      `npm run build:shareable` all ran after the edit; `npm run check:shareable` confirmed green.
- [x] [Review][Patch] MEDIUM. **Two items this story's own second review round had filed to
      `deferred-work.md` turned out to be trivially fixable in the current pass, per this project's own
      standing rule to fix rather than defer a fixable finding.** Fixed rather than left deferred:
      `SealedEvaluatorBrief.directions` (`src/core/schemas/sealed-evaluator-brief.ts`) gained
      `behaviors`' own `.min(1)` plus a one-line `.describe(...)`, closing the empty-directions
      vacuous-pass gap two independent reviewers had now flagged; `BriefDirection` gained the
      `export type BriefDirection = z.infer<typeof BriefDirection>` alias every other schema in that
      file already has, and `tests/seal/scripting-audit.test.ts` now imports that type instead of
      deriving it locally. Both `deferred-work.md` entries were removed and the fixes recorded in
      Completion Notes below. The published schema changed (`directions` gained `minItems: 1`);
      `schemas/sealed-evaluator-brief.schema.json` was regenerated and
      `tests/schemas/published/keyword-mutation.test.ts`'s pinned census was updated by the same
      re-measurement discipline Step 5's own learning-path entry describes (97 to 98 occurrences for
      this document, 1949 to 1950 overall, one new `minItems` occurrence).
- [x] [Review][Patch] LOW. **The third `deferred-work.md` item from the prior round (this story's own
      Task 2 omitting the `npm run build:shareable` re-sync step) was also fixable now rather than
      staying deferred.** Fixed: Task 2 and AC 2 point 2 both now name the `build:shareable` step
      explicitly; that `deferred-work.md` entry was removed too. The fourth entry (the
      `in-review`/`review` status-vocabulary drift) stays open: it depends on the BMad skill's own
      routing keywords, out of any one story's scope to change.
- [x] [Review][Patch] LOW. **`tests/seal/scripting-audit.test.ts` redefined `digestOf` locally instead
      of importing it from `tests/schemas/fixtures/artifact-fixtures.ts`, even though the adjacent
      comment named that file as the pattern being mirrored, and the two functions were byte-identical.**
      Fixed: imports and reuses `artifact-fixtures.ts`'s own `digestOf` instead of redefining it.
- [x] [Review][Decision] **Resolved: intended, no change.** The peer also flagged `StructuralFailure`
      (`src/core/failure-codes.ts`) as a byte-for-byte duplicate of `RuntimeFault` (`faults.ts`) with no
      shared base class. This is not a gap: it is Decision 2's own explicit, reasoned choice. The two
      registries are disjoint by design (the Consistency Conventions' Errors row keeps a fault's AD-28
      code and a structural failure's AD-5 code apart, "never merged"), and both classes' own header
      comments already say they "share at most this base shape, never a code table." Raised and
      rejected, not fixed; no code change.

## Decisions taken during story creation

Each is settled with a stated default and its downstream consequence. Proceed unless the user amends
one; record the outcome in the Dev Agent Record.

1. **The AD-5 code is `brief-exceeds-scripting-bound`, cited by AD-16, not AD-38.** Neither
   `epics.md` nor `ARCHITECTURE-SPINE.md` names the code directly — the schema comments on
   `EvalContract.probeStepBound` and `SealedEvaluatorBrief.probeStepBound` both explicitly delegate
   "mint the code" to this story, and no story-creation ambiguity here is settled by re-reading the
   spine harder; it has to be constructed. AD-16 is where the audit's own describing sentence lives
   verbatim ("The brief-side scripting audit runs after generation, carries its own AD-5 code..."),
   and both schema comments independently say "AD-16's declared bound," which is the strongest
   available textual evidence. AD-38 was checked directly (`ARCHITECTURE-SPINE.md` lines 483–490) and
   is about the staged adoption path and the worked-example tarball contents, not this mechanism, even
   though epics.md's FR8 bundles this claim under an "(AD-38, seal)" heading alongside two other,
   genuinely AD-38-owned claims (determinism, reorder byte-identity). **Consequence:** the registry
   row's "Cited by" column reads `AD-16`. Per this project's standing default (settle in the story,
   record the reasoning, do not escalate), this is not referred back to the architect.
2. **The thrown class is a new `StructuralFailure`, not AD-28's `RuntimeFault`, and it lives in
   `src/core/failure-codes.ts` rather than in `core/seal/`.** The Consistency Conventions' Errors row
   states the two registries are disjoint kinds — a fault carries an AD-28 code, a compile-time
   failure carries an AD-5 code, and they are "never merged." `faults.ts`'s own header comment says
   the two "share at most this base shape, never a code table." Placing the new class beside the
   registry it belongs to, not beside the stage that happens to fire it first, means Epic 4 (Story
   4.2, which owns the other twenty AD-5 codes) finds one class already in place rather than needing
   to choose between reusing a seal-scoped one or minting a second. **Consequence:** this story's one
   `src/core/failure-codes.ts` edit beyond the tuple append; `core/seal/scripting-audit.ts` imports it
   rather than declaring its own.
3. **The audit throws rather than returning a result object.** The schema comments' own language
   ("its only thrower") reads most naturally as a throw, and Story 2.1 already established the house
   style of a pure function throwing directly on its own detected violation
   (`buildPlanIndex`/`resolveStep`/`renderDirectionText` all do this for their own precondition
   violations). This is a different *class* of violation — a legitimate, expected unhappy path over
   real author input, not a should-never-happen precondition — so only the throw-not-return half of
   the precedent carries over; the error's own *shape* does not follow the bare `TypeError` those
   functions use. It mirrors `RuntimeFault` instead (Decision 2): a coded domain-error class with
   `code`/`artifactPath` fields, because that is what AD-5's own registry vocabulary demands, not
   because Story 2.1's precondition-violation errors happen to throw too. Introducing a second
   error-signaling convention inside `core/seal/` (throw for programmer errors, return-a-result for
   data errors) is more surface for a future reader to reconcile than it is worth.
   **Consequence:** `seal()` (Story 2.2) will need to
   decide how a thrown `StructuralFailure` becomes "no contract artifact" at its own call site — that
   is Story 2.2's wiring, not this story's, exactly as Story 2.1 left `seal()`'s own wiring to Story
   2.2 for null-narrowing `Oracle.direction`.
4. **The marker vocabulary excludes bare ordinal words (`first`, `second`, ...), on evidence already
   in the tree.** An earlier version of this story's own drafting considered reusing AC 4's full
   ordering-vocabulary list including ordinals. `gateCContract`'s own shipped O-004 negative-domain
   text — `'Every element of the returned page, not the first.'` — uses "first" as a data-position
   adjective inside already-accepted, already-shipped author prose, not as a step marker. Any audit
   that would reject this text is wrong, not strict: `gateCContract` is the hand-authored contract
   AD-26 and AD-3 argue from, and rejecting its own real prose is a defect in the audit, not a finding
   about the fixture. **Consequence:** the marker set (AC 3) keeps `then`, `before`, `after`,
   `subsequently`, `next`, `finally`, `afterward`, and numbered-list markers, and drops bare ordinals.
   If a future fixture demonstrates a genuine gap this leaves open (a scripted sequence using only
   ordinals and no other marker), that is new evidence for widening the set with its own fixture, not
   a reason to add ordinals back speculatively now. **Addendum, second-round peer review:** the same
   reasoning bounds how far the regex-hardening in that review's finding 1 goes. A fully paraphrased
   sequence carrying no marker word at all, or one relying solely on bare ordinals ("First... second...
   third..." with nothing else), still evades this audit after every fix that round made. That is a
   known, accepted limitation of a keyword-heuristic audit over free text, not a defect this fix
   chases: closing it without a concrete fixture motivating the exact wider pattern risks the same
   false-positive class this Decision already found once (rejecting `gateCContract`'s own real "not
   the first" prose). Per this project's standing default, the gap is recorded here rather than
   escalated into a new architecture round; a future story that finds a concrete paraphrase-based
   smuggling path widens the vocabulary then, with its own fixture as evidence.
5. **The audit's per-direction bound is compared against `brief.directions[].text` only, not
   `behaviors`, `scopedResources`, or `safetyLimits`.** FR8's own wording ties the bound to "prose"
   `seal` "generates ... from direction fields," and AD-38's stage-one list names `seal`'s load-bearing
   output as the generated direction. Widening the scan to every free-text field on the brief is
   defensible in principle (an author could smuggle scripted language into `safetyLimits` strings
   too) but is not what any cited source names, and doing it without a concrete fixture motivating it
   risks the same false-positive class Decision 4 found. **Consequence:** left as a flagged, explicit
   judgment call rather than silently narrowed: if the implementer or a later review finds a concrete
   smuggling path through a non-`directions` field, widen the scan and add a fixture proving why, and
   record that as a new decision rather than reopening this one silently.
6. **The bound is checked per direction, never summed across the brief.** A `probeStepBound` of, say,
   `2` bounding "at most two enumerated markers in total across every oracle's direction" would make
   an early-declared bound arbitrarily tighter as an author adds unrelated oracles to the same
   contract, which is not what "declared bound on enumerated probe steps" reads as — the enumeration
   risk is local to one direction's own narrated claim. **Consequence:** AC 3's comparison is
   `count > brief.probeStepBound` evaluated once per direction, not once over a running total.

## Dev Notes

### Read these files before writing anything

1. `src/core/schemas/sealed-evaluator-brief.ts` — `BriefDirection`, `SealedEvaluatorBrief`, and the
   `probeStepBound` field's own comment: "The brief-side scripting audit reads it after generation;
   that audit and its AD-5 code are Epic 2's."
2. `src/core/schemas/eval-contract.ts` — `probeStepBound`'s comment on `EvalContract` itself: "The
   AD-5 code that audit fires is Epic 2's to mint alongside its only thrower." This is the sentence
   this story exists to satisfy.
3. `src/core/failure-codes.ts` — the twenty-code tuple and its own header comment, explaining why it
   sits in `core/` rather than `core/schemas/` and how `scripts/check-ad5-registry.ts` binds it to the
   spine.
4. `scripts/check-ad5-registry.ts` — read in full. It parses only the **first** table between
   `### AD-5 ` and `### AD-6 ` and asserts **set and order** equality against `FAILURE_CODES`. A row
   added out of the same relative order as the tuple entry fails this script with a named mismatch,
   not silently.
5. `tests/schemas/failure-codes.test.ts` — the count/uniqueness/kebab-case tests this story bumps.
6. `src/core/schemas/faults.ts` — `RuntimeFault`, `RuntimeFaultCode`. Read this to see the shape
   `StructuralFailure` mirrors, and its own header comment on why the two registries stay disjoint.
7. `src/core/seal/plan-index.ts`, `derived-reference.ts`, `direction-prose.ts` — Story 2.1's shipped
   generator. `buildPlanIndex` + `renderDirectionText` are reused, unmodified, to produce this story's
   accept-fixture prose.
8. `tests/seal/fixtures.ts` — the `Direction`/plan slices Story 2.1 already built; several are
   directly renderable via `renderDirectionText` for reuse here.
9. `tests/schemas/fixtures/gate-c-contract.ts` — `gateCContract`, specifically O-004's `scope`
   (around line 310, "not the first") and the contract's own `probeStepBound: null` (line 718).
10. `tests/schemas/fixtures/relevance-contracts.ts` — `populatedContract`, `probeStepBound: 8` (line
    311); a second contract in the same file declares `probeStepBound: null` (line 76).
11. `ARCHITECTURE-SPINE.md`, AD-5 in full (lines 203–241, the registry table and its surrounding
    rules) and AD-16 in full (lines 304–313, where the audit is named). Re-read against the code, not
    from memory.
12. `epics.md`, Epic 2's intro and Story 2.3's own acceptance criterion (lines 228–272), and FR8, FR7
    in the Requirements Inventory.
13. `_bmad-output/implementation-artifacts/2-1-the-direction-prose-generator.md` — the Decisions log
    (particularly Decision 9, which names this story explicitly: "the emitted-brief scripting audit of
    Story 2.3 is where the bounded-enumeration half is enforced"), and the Dev Agent Record / learning
    path Step 6 entry for house style and testing rigor expectations.

### Project structure notes

- New file: `src/core/seal/scripting-audit.ts`. New test file: `tests/seal/scripting-audit.test.ts`
  (mirrors the existing `tests/seal/` layout).
- `src/core/failure-codes.ts` gains the 21st `FAILURE_CODES` entry and the new `StructuralFailure`
  class — the one `core/` file outside `core/seal/` this story edits, following the exact precedent
  Story 2.1 set editing `core/schemas/` for its four type aliases (a small, justified, precedent-
  following edit to a shared file, not a scope violation).
- `ARCHITECTURE-SPINE.md`'s AD-5 table gains one row, in place. Not a new spine revision — this
  project's standing default (see the pinned guidance this workflow already carries) is to settle an
  ambiguity in the story or the code and record the decision there, and AD-5's own text already
  anticipates ordinary registry growth ("Adding a class is an amendment to this AD and to no other").
- No new npm script, no new dependency, no CI workflow change. `src/core/seal/` and `tests/seal/` are
  already covered by `tsconfig.json`'s `include` and `biome.json`'s broad `**` include.
- `src/index.ts` is not touched (AC 1, AC 5): `auditBriefScripting` is internal to `seal`'s pipeline
  until Story 2.2's `seal()` calls it.

### Testing requirements

- `tsconfig.json` sets `noUncheckedIndexedAccess`; a regex `.exec()`/`.match()` result or array index
  is `T | undefined`.
- `biome.json` sets `useImportType`/`useExportType` to `error`.
- AD-30's 90 percent `core/` coverage floor has no threshold configured in `vitest.config.ts`; the
  proxy, as in Story 2.1, is a positive test for every branch plus assertions specific enough to fail
  if the property they name is removed.
- Story 2.1's own learning-path entry records that its 63-test suite stayed green under several
  mutations of its wording/ordering rules — a caution worth holding here too: assert the exact `code`
  and `artifactPath`, the exact match count where a fixture's count is asserted, and that a
  bound-satisfying case does **not** throw, not merely that a call "completes."

### References

- `_bmad-output/planning-artifacts/epics.md` — Epic 2 intro, Story 2.3 (lines 228–272), FR7, FR8.
- `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md`
  — AD-5 (203–241), AD-16 (304–313), AD-38 (483–490), Consistency Conventions' Errors row (531),
  "Owed to the reference implementation" (645+, confirmed unrelated to `compile`/`seal`), Gate D
  stage-one epic-ready status (487, 483–490).
- `src/core/schemas/eval-contract.ts`, `sealed-evaluator-brief.ts`, `failure-codes.ts`, `faults.ts`.
- `scripts/check-ad5-registry.ts`.
- `_bmad-output/implementation-artifacts/2-1-the-direction-prose-generator.md`.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5), via Claude Code.

### Debug Log References

- Baseline before the first edit: `npm run check:docs` → 53 file(s) OK; `npm test` → 30 test files,
  1321 tests passed.
- After the spine edit: `npm run check:docs` and `npm run lint:spine` both green.
- After the `failure-codes.ts`/test edits: `npm run check:ad5-registry` → "21 codes, set- and
  order-equal between the AD-5 table and src/core/failure-codes.ts".
- Verified `SEQUENCE_MARKER_PATTERN` directly against every fixture text (AC 4's own instruction, not
  trusted from the story's restated counts): the word-vocabulary reject fixture matches `then` and
  `finally` (2, `First` correctly excluded); the numbered-list reject fixture matches `1. ` and `2. `
  (2); the O-004/O-005 "not the first" text matches nothing (0). All eight `gateCContract` directions'
  real generated prose and `populatedContract`'s own direction render with 0 markers.
- First-pass `npm run validate`: typecheck, lint, check:docs, check:shareable, lint:spine,
  check:vectors, check:schemas, check:ad5-registry all green; `npm test` → 31 test files, 1331 tests
  passed (1321 baseline + 9 new tests in `scripting-audit.test.ts` + 1 new `it.each` iteration in
  `failure-codes.test.ts` from the 21st `FAILURE_CODES` member).
- `check:shareable` failed once after the spine edit alone (the committed
  `eval-quality-architecture-spine.html` was stale against the rebuilt AD-5 table); fixed by running
  `npm run build:shareable` and re-verifying `check:shareable` green. This file is a generated,
  committed artifact rebuilt from the spine, not hand-edited.
- **Code-review pass (post-implementation), seven patch findings, all fixed.** Re-verified the
  redesigned `SEQUENCE_MARKER_PATTERN` directly, by script, against every case the review named before
  writing any assertion: all 7 word markers plus `afterwards` each match in isolation; the `)`-spelled
  numbered-list variant matches; `100. Do the hundredth thing.` (3-digit, string-start) and
  `Confirm the record. 2.` (end-of-string, nothing following) both match; `See item 5. It explains...`,
  `Rule 12. All calls...`, and `The fee is $2. 50 cents...` all match nothing (no list context); all
  eight `gateCContract` directions and `populatedContract`'s own direction still render 0 markers
  (regression-safe).
- Final `npm run validate` (after the seven first-round-review fixes): typecheck, lint, check:docs,
  check:shareable, lint:spine, check:vectors, check:schemas, check:ad5-registry all green; `npm test`
  → 31 test files, **1344 tests passed** (1331 + 12 new tests in `scripting-audit.test.ts`: an 8-word
  `it.each` plus the `)`-variant, the numeric-prose non-match, the 3-digit case, and the end-of-string
  case + 1 new admission-boundary test in `ad5-admissions.test.ts`).
- **Second-round peer review (independent Claude session, `/code-review` at high effort, empirical
  Node repro), seven findings.** Re-verified every case directly by script, before writing any
  assertion or editing the regex: all 5 peer repro strings (indented list, doubled space, no space,
  "Subsequent to" paraphrase, lettered list) returned zero matches under the then-current pattern,
  confirming the finding; the redesigned pattern then matched all 5, plus `subsequent`/`afterwards` in
  isolation and the `a)`/`b)` marker, while a genuine decimal ("12.5") and every ordinary-numeric-prose
  case from the prior round still matched nothing; every fixture from both prior rounds (all eight
  `gateCContract` directions, `populatedContract`'s own, both hand-authored reject fixtures, the O-005
  regression, the 3-digit and end-of-string cases) was re-run and produced its previously-asserted
  count unchanged.
- Regenerating `schemas/sealed-evaluator-brief.schema.json` after `directions` gained `.min(1)` changed
  exactly one file (`git diff --stat schemas/` confirmed); `npm run check:schemas` green after.
  `tests/schemas/published/keyword-mutation.test.ts`'s pinned occurrence census was re-measured
  directly (not guessed): `sealed-evaluator-brief` 97 → 98, `minItems` 22 → 23, total 1949 → 1950,
  exactly one new `minItems` occurrence, consistent with exactly one field gaining exactly one new
  keyword.
- Final `npm run validate` (after all second-round fixes): typecheck, lint, check:docs, check:shareable
  (rebuilt via `npm run build:shareable` after the spine edit and reverified green), lint:spine,
  check:vectors, check:schemas, check:ad5-registry all green; `npm test` → 31 test files, **1351 tests
  passed** (1344 + 7 new tests in `scripting-audit.test.ts`: the 5 peer-repro cases, the genuine-decimal
  non-match, and one new `it.each` iteration for `subsequent` in `MARKER_WORDS`).

### Completion Notes List

- All seven tasks complete; `npm run validate` is green end to end.
- **The story's own AC 4 point 2 citation was corrected during fixture construction, settled here
  rather than escalated (per this project's standing default).** The story names the "not the first"
  regression as "gateCContract's own O-004 negative domain" at line ~310. Line 310 of
  `tests/schemas/fixtures/gate-c-contract.ts` is actually O-005's `scope` field — O-004's own `scope`
  reads "Every element of the returned page." with no "not the first" anywhere in either of its
  fields. The regression fixture and its permutation-test passing direction are therefore built from
  O-005's rendered direction, not O-004's; `tests/seal/scripting-audit.test.ts` documents this inline
  where the fixture is constructed.
- `sealed-evaluator-brief.ts` exports `BriefDirection` as a Zod schema const with no matching
  `export type BriefDirection = z.infer<...>` alias (unlike `SealedEvaluatorBrief` itself, which does
  have one). The test file derives the element type locally as
  `SealedEvaluatorBrief['directions'][number]` rather than importing a type that does not exist; no
  production code needed this type, so `sealed-evaluator-brief.ts` itself was left unchanged.
  `StructuralFailure` was added beside `FAILURE_CODES` in `src/core/failure-codes.ts` exactly as
  Decision 2 specifies, mirroring `RuntimeFault`'s shape without subclassing or importing it.
- No deviation from any of the six Decisions recorded at story creation; all six held as written.
- **Code review of the finished implementation found seven patch-grade gaps, all fixed (see Story
  Review Findings above).** The regex changed shape, not vocabulary or intent:
  `SEQUENCE_MARKER_PATTERN`'s word alternation gained `afterward(?:s)?` (was `afterward`), and its
  numbered-list branch moved from `\b\d{1,2}[.)]\s` (unanchored, 1-2 digits, consumed trailing
  whitespace) to `(?<=^|\n|[.!?]\s)\d+[.)](?=\s|$)` (anchored to genuine list context via a lookbehind,
  unbounded digit count, a non-consuming lookahead boundary). Every previously-passing fixture
  (`gateCContract`'s eight directions, `populatedContract`'s one, both hand-authored reject fixtures,
  the O-005 regression) was re-verified against the new pattern by direct script before any test was
  written or edited, per this project's own "verify against the pattern, don't trust a restated count"
  convention (AC 3). No production behavior narrowed: every text that matched under the old pattern
  still matches under the new one; the new pattern only adds true positives (3+ digit markers,
  end-of-string markers, "afterwards") and removes false positives (mid-sentence numeric prose).
- **Second-round peer review (an independent Claude session with fresh eyes, no prior context from
  either of this project's own internal review layers) found six fixable gaps plus one already-settled
  decision it correctly flagged for visibility, not for a code change.** `SEQUENCE_MARKER_PATTERN`'s
  list-context lookbehind is now variable-length (allows any amount of leading whitespace, not just
  one character), its trailing boundary is a negative digit lookahead rather than a whitespace
  requirement (rejects "12.5", accepts "1.Do..."), its marker is a digit run or a single letter (not
  digits only), and `subsequent(?:ly)?` joined the word alternation. Decision 4 gained an addendum
  recording the residual, deliberately unchased gap: a fully paraphrased or bare-ordinal-only sequence
  still evades a keyword-heuristic audit, and closing that is new evidence's job, not this fix's.
  `ARCHITECTURE-SPINE.md`'s AD-5 section had drifted out of agreement with its own two governing
  sentences the moment the new row existed; both are now reconciled in place, no new spine revision.
  Two `deferred-work.md` entries from the prior round turned out to be trivially fixable rather than
  genuinely deferrable and were fixed instead, per this project's own standing rule: see the next two
  notes. `tests/seal/scripting-audit.test.ts`'s locally-redefined `digestOf` now imports the identical
  function from `tests/schemas/fixtures/artifact-fixtures.ts` instead. `StructuralFailure`'s
  byte-for-byte similarity to `RuntimeFault` was raised again and rejected again, for the same reason
  Decision 2 already gives; no code change, one sentence added to Story Review Findings.
- **`SealedEvaluatorBrief.directions` (`src/core/schemas/sealed-evaluator-brief.ts`) gained `.min(1)`
  plus a one-line `.describe(...)`, closing 2026-08-21.** Mirrors the sibling `behaviors` field's own
  `.min(1)` exactly: a brief with no direction verifies nothing, the same reasoning `behaviors`' own
  description already states for an empty behaviour list. This closes the empty-directions
  vacuous-pass gap two independent reviewers (this story's own second-round pass and the earlier
  code-review pass before it) flagged; the `deferred-work.md` entry recording it as deferred is
  removed. `BriefDirection` also gained `export type BriefDirection = z.infer<typeof BriefDirection>`,
  matching every other schema in the file; `tests/seal/scripting-audit.test.ts` now imports that type
  instead of deriving it locally as `SealedEvaluatorBrief['directions'][number]`. That `deferred-work.md`
  entry is removed too. Neither edit is scoped to `seal`: `sealed-evaluator-brief.ts` is Epic 1's file,
  and both changes are small, justified, precedent-following edits mirroring an already-shipped
  sibling field's own shape, the same standard this story's `failure-codes.ts` edit already met.
- **Task 2 and AC 2 point 2 now name the `npm run build:shareable` re-sync step explicitly**, closing
  the third `deferred-work.md` entry: this story's own first pass hit the gap live (`check:shareable`
  failing at the end of `validate` rather than at the spine edit that caused it) and the task list is
  now corrected so a future spine-editing story does not repeat the friction. The fourth entry (the
  `in-review`/`review` status-vocabulary drift) stays open in `deferred-work.md`: fixing it means
  changing the BMad skill's own routing keywords, out of this story's own scope.

### File List

- `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md`
  — AD-5 table: appended the `brief-exceeds-scripting-bound` row (first pass); reconciled the section's
  two governing sentences ("emitted by `compile`", "every commanding AD cites its codes literally")
  against that row, and AD-16's own body now cites the code by name (second-round peer review).
- `_bmad-output/shareable/eval-quality-architecture-spine.html` — rebuilt via `npm run build:shareable`
  after each of the two spine edits above (generated artifact, not hand-edited).
- `src/core/failure-codes.ts` — appended the 21st `FAILURE_CODES` entry, updated both "twenty" →
  "twenty-one" mentions, added the `StructuralFailure` class.
- `tests/schemas/failure-codes.test.ts` — `toHaveLength(20)` → `21`, description updated.
- `src/core/schemas/sealed-evaluator-brief.ts` — second-round peer review, Epic 1's file. `directions`
  gained `.min(1)` plus a `.describe(...)`; `BriefDirection` gained
  `export type BriefDirection = z.infer<typeof BriefDirection>`.
- `schemas/sealed-evaluator-brief.schema.json` — regenerated via `npm run generate:schemas` after the
  `directions` schema change (`minItems: 1` now present); this is the one committed schema file that
  changed, confirmed by `git diff --stat schemas/`.
- `tests/schemas/published/keyword-mutation.test.ts` — pinned occurrence census re-measured and updated
  (`sealed-evaluator-brief` 97 → 98, `minItems` 22 → 23, total 1949 → 1950) following the schema change
  above.
- `src/core/seal/scripting-audit.ts` — new, then revised across two code-review passes:
  `SEQUENCE_MARKER_PATTERN` (list-context-anchored, variable-length lookbehind, digit-lookahead
  boundary, digit-or-letter marker, unbounded digit count, `afterward(?:s)?`, `subsequent(?:ly)?`) and
  `auditBriefScripting`.
- `tests/seal/scripting-audit.test.ts` — new, then extended across two code-review passes. Accept
  fixtures (gateCContract sweep with an explicit 8-oracle length assertion, the O-005 "not the first"
  regression, `populatedContract` bound-8, `probeStepBound: null` vacuous-pass), reject fixtures
  (word-vocabulary, numbered-list, a strict-zero clean case), the two-direction permutation test, a
  per-marker `it.each` proving every word (including `subsequent` and `afterwards`) and the `)`-variant
  under a non-null bound, boundary-correctness cases (ordinary numeric prose, a genuine decimal, a
  3-digit marker, an end-of-string marker), and the five second-round peer-repro reformattings
  (indented list, doubled space, no space, the "Subsequent to" paraphrase, a lettered list). `digestOf`
  is now imported from `tests/schemas/fixtures/artifact-fixtures.ts` rather than redefined locally, and
  `BriefDirection` is now imported from `sealed-evaluator-brief.ts` rather than derived locally.
- `tests/schemas/ad5-admissions.test.ts` — first code-review pass. Added the missing
  `brief-exceeds-scripting-bound` admission-boundary entry and updated "twenty" → "twenty-one" in the
  header comment.
- `_bmad-output/implementation-artifacts/deferred-work.md` — three entries closed and removed (the
  `directions` `.min(1)` gap, the `BriefDirection` type alias gap, the `build:shareable`-step-in-Task-2
  gap); the fourth (`in-review`/`review` vocabulary drift) stays open, out of this story's scope.
- `_bmad-output/project-knowledge/learning-path-step-by-step.md` — added Step 7 (table row + section).

## Suggested Review Order

**The audit itself**

- The whole story in one function: vacuous pass on `null`, per-direction count vs. bound, the throw.
  [`scripting-audit.ts:74`](../../src/core/seal/scripting-audit.ts#L74)

- The marker vocabulary, after two code-review passes tightened its weak spots.
  [`scripting-audit.ts:43`](../../src/core/seal/scripting-audit.ts#L43)

- Why the list-marker branch is anchored to real list context, the variable-length lookbehind, and the digit-lookahead boundary.
  [`scripting-audit.ts:29`](../../src/core/seal/scripting-audit.ts#L29)

**The AD-5 code and its thrower**

- The 21st compile-time failure code, appended in table order.
  [`failure-codes.ts:19`](../../src/core/failure-codes.ts#L19)

- `StructuralFailure`: mirrors `RuntimeFault`'s shape without subclassing it (Decision 2).
  [`failure-codes.ts:58`](../../src/core/failure-codes.ts#L58)

- The registry table's new row, cited by AD-16, not AD-38 (Decision 1), and AD-16's own body now naming it literally.
  [`ARCHITECTURE-SPINE.md:231`](../planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md#L231)

**Tests: the property this story exists to prove**

- Every marker word (plus `afterwards`, `subsequent`, and the `)` spelling) proven individually under a non-null bound — the first review round's fix that closed the mutation-survivable gap.
  [`scripting-audit.test.ts:292`](../../tests/seal/scripting-audit.test.ts#L292)

- Numbered-list boundary correctness: no false positive on ordinary numeric prose, 3+ digit and end-of-string markers still match.
  [`scripting-audit.test.ts:310`](../../tests/seal/scripting-audit.test.ts#L310)

- Second-round peer review: indentation, doubled spacing, no spacing, the "Subsequent to" paraphrase, and a lettered list all still count; a genuine decimal still does not.
  [`scripting-audit.test.ts:328`](../../tests/seal/scripting-audit.test.ts#L328)

- The permutation test: which direction's failure surfaces first is not an artifact of array order.
  [`scripting-audit.test.ts:362`](../../tests/seal/scripting-audit.test.ts#L362)

- Accept and reject fixtures: real generated prose from `gateCContract`/`populatedContract`, the O-005 "not the first" regression, hand-authored smuggled-sequence rejects.
  [`scripting-audit.test.ts:225`](../../tests/seal/scripting-audit.test.ts#L225)

- The new admission-boundary entry closing the "walk of every AD-5 code" gap the first review round found.
  [`ad5-admissions.test.ts:310`](../../tests/schemas/ad5-admissions.test.ts#L310)

- `SealedEvaluatorBrief.directions` gained `.min(1)`; `BriefDirection` gained its `export type` alias (second-round peer review, items closed rather than left deferred).
  [`sealed-evaluator-brief.ts:19`](../../src/core/schemas/sealed-evaluator-brief.ts#L19)

**Peripherals**

- Count bump only, 20 → 21.
  [`failure-codes.test.ts:14`](../../tests/schemas/failure-codes.test.ts#L14)

- The pinned mutation-census bump (one new `minItems` occurrence) following `directions`' new `.min(1)`.
  [`keyword-mutation.test.ts:110`](../../tests/schemas/published/keyword-mutation.test.ts#L110)

- Step 7, added per the learning-path template's own rule (after the story is done, not before).
  [`learning-path-step-by-step.md`](../project-knowledge/learning-path-step-by-step.md)
