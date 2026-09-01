---
title: 'A monotonic observation sequence and declared selector cardinality'
type: 'feature'
created: '2026-09-01'
status: 'done'
baseline_commit: '00f3feade96c7001491d4de2b50a605896857546'
review_loop_iteration: 0
context: [
  '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md',
  '{project-root}/_bmad-output/implementation-artifacts/epic-7-context.md',
  '{project-root}/_bmad-output/implementation-artifacts/7-1-the-run-mode-source-and-the-sealed-run-records-mode-field.md',
]
---

# Story 7.2: A monotonic observation sequence and declared selector cardinality

Epic 7, story key `7-2-a-monotonic-observation-sequence-and-declared-selector-cardinality`. Closes
owed item 2 (`ARCHITECTURE-SPINE.md:682-688`). Two breaking `schemaVersion` bumps under AD-11.

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `ARCHITECTURE-SPINE.md:511` — "two steps each matched two observations, so a
first-match scorer and a last-match scorer bound different evidence." `Observation` has no ordering
field (array position is forbidden as ordering, ADR-006); `InteractionStep` declares no selector
cardinality, so several matches has no recorded rule.

**Approach:** Required `sequence: z.int().positive()` on `Observation`, unique per record. Required
`cardinality: z.enum(['exactly-one', 'at-most-one', 'any'])` on `InteractionStep`. One new pure
reference function, `selectObservations`, matches a step's observations by `operationId`, returns
them in sequence order with a `none | one | several` result, never reads array position. A second
pure function resolves `after` through the same result, taking the lowest-sequence match when the
anchor declared `any` and matched several.

## Boundaries & Constraints

**Always:** `sequence` unique within a record (schema-enforced) — uniqueness is necessary and
sufficient for a sorted-by-`sequence` read to be strictly increasing, so no separate monotonicity
check is needed; selection sorts by `sequence`, never array order (NFR9 permutation fixtures prove
it); `several` under `exactly-one`/`at-most-one` returned as data, never thrown/defaulted; every
literal `InteractionStep` object across the repo (`grep -rn "stepId:"`) gets a `cardinality`,
including `tests/schemas/plan.test.ts`'s existing base fixture, not only its new reject case; the
`Observation` JSDoc's "additive" claim (`sealed-run-record.ts:162-164`) and the sibling `.meta()`
sentence at `:320` (same gap, doesn't say either word) both corrected to state the bump is breaking.

**Ask First:** none — ambiguities settled by construction below, per epic preamble (`epics.md:529`).

**Never:** no AD-21 Invalid-rung/ladder/`--strict` wiring (Story 7.7's diff, cited as destination
only); no AD-5 registry touch (compile never sees a run record); no `STAGE_VALUE_INPUTS` entry
(`sequence`/`cardinality` are schema-level, not stage-boundary inputs).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| single/no match | 0 or 1 observation shares the step's `operationId` | `{ result: 'none'\|'one', matchedObservationIds }` | N/A |
| ambiguous, single-valued | `exactly-one`/`at-most-one`, 2+ matches | `{ result: 'several' }` — named ambiguity, routed by 7.7 | N/A |
| ambiguous, `any` | `cardinality: 'any'`, 2+ matches | `several`, all ids in sequence order — not an error | N/A |
| permuted array | same observations, shuffled | identical `matchedObservationIds` (NFR9) | N/A |
| anchor resolution | `after` anchor is `any`, matched several | lowest-`sequence` match | N/A |
| absent/duplicate `sequence` | schema violation | record fails to parse | `missingProperty`/`.refine()` issue |

</frozen-after-approval>

## Code Map

- `src/core/schemas/sealed-run-record.ts:166-198,305,320` -- add `sequence`; `.refine()` on
  `observations` for uniqueness; correct both "additive" sentences
- `src/core/schemas/plan.ts:61-68` -- add `cardinality` to `InteractionStep`
- `src/core/score/selection.ts` -- NEW: `selectObservations`, `resolveTemporalAnchor`; no module
  claims this yet (`stage-table.ts`'s `score` row stays `module: null` all epic)
- `tests/score/selection.test.ts` -- NEW: unit tests plus the NFR9 permutation family
- `tests/schemas/fixtures/artifact-fixtures.ts:139-262` -- `schemaVersion` 2→3, `sequence` on all four
- `tests/schemas/fixtures/artifact-reject-cases.ts:135-` -- two reject cases (`sequence`), mirroring
  `record-mode-absent` (:137-150)
- `tests/schemas/fixtures/reject-cases.ts` (`REJECT_CASES`, merged into `PUBLISHED_REJECT_CASES`) --
  two reject cases (`cardinality`-absent, `cardinality`-outside-the-three), mirroring the existing
  `binding-value-untagged`/`matcher-outside-the-two` pattern that already mutates
  `contract.interactionPlan[0]`; this is eval-contract's AD-13 corpus, not `plan.test.ts`
- Every literal `InteractionStep`/`stepId:` object gets a `cardinality` --
  `tests/schemas/fixtures/{gate-c-contract,relevance-contracts}.ts`,
  `tests/coverage/fixtures/{corpus,satisfaction-contracts}.ts`, `tests/seal/fixtures.ts`,
  `tests/schemas/plan.test.ts` (base fixture, not just its new reject case),
  `tests/compile/scripting-bound.test.ts` (`step()` helper and its inline mutations),
  `tests/compile/compile.test.ts` (`step()` helper and inline literals feeding `compileClean()`),
  `tests/schemas/ad5-admissions.test.ts` (`admits()` cases, incl. `nested-temporal-clause` and
  `plan-exceeds-scripting-bound`), `tests/compile/rubrics.test.ts`, `tests/coverage/satisfaction.test.ts`
- Pinned counters move: `ARTIFACT_REJECT_CASES` length, `PUBLISHED_REJECT_CASES` length,
  `CENSUS_BY_DOCUMENT['eval-contract']` (currently 725) and `['sealed-run-record']`, `CENSUS_TOTAL` --
  record exact before/after in the AC, following 7.1 AC 7's pattern

## Tasks & Acceptance

**Execution:**
- [x] `sealed-run-record.ts` -- `sequence`, uniqueness `.refine()`, correct both "additive" sentences
- [x] `plan.ts` -- `cardinality` on `InteractionStep`
- [x] `src/core/score/selection.ts` -- `selectObservations`, `resolveTemporalAnchor`, pure and total
- [x] `npm run generate:schemas` -- confirm exactly two files change
- [x] fixtures -- bump, add `sequence`/`cardinality` everywhere listed in Code Map, two reject cases
      in `artifact-reject-cases.ts` (sequence) and two in `reject-cases.ts` (cardinality); record the
      moved pinned counters
- [x] `tests/score/selection.test.ts` -- I/O matrix above, including NFR9 permutation family
- [x] `npm run validate` green end to end; leave changes uncommitted

**Acceptance Criteria:**
- Given a sealed run record, when `Observation` parses, then `sequence` is required and unique
  across `observations`; missing or duplicated, the record fails to parse.
- Given an eval contract, when `InteractionStep` parses, then `cardinality` is required.
- Given a step and an observation array in any order, when `selectObservations` runs, then it
  returns matched identifiers in ascending-sequence order with a `none | one | several` result, and
  assigns no AD-6 outcome state.
- Given `several` under `exactly-one`/`at-most-one`, when read, then it is the named ambiguity
  condition Story 7.7 routes to AD-21's Invalid rung — reason recorded here, rung wired by 7.7.
- Given a step whose `after` anchor declared `any` and matched several, when the clause resolves,
  then it takes the lowest-sequence match.
- Given the same array permuted, when `selectObservations` runs both orderings, then results are
  byte-identical (NFR9 family).
- Given `npm run generate:schemas` and AD-13's four checks, when run after this story, then all pass
  with new fixtures.

## Spec Change Log

Pinned counters, before -> after:

| Counter | Before | After |
| --- | --- | --- |
| `REJECT_CASES` length (`reject-cases.ts`) | 44 | 46 |
| `ARTIFACT_REJECT_CASES` length (`artifact-reject-cases.ts`) | 70 | 72 |
| `PUBLISHED_REJECT_CASES` length | 114 | 118 |
| `CONSTRAINT_LEDGER` inject entries | 25 | 25 (unchanged) |
| `CONSTRAINT_LEDGER` not-expressible entries | 15 | 16 |
| `CENSUS_BY_DOCUMENT['eval-contract']` | 725 | 727 |
| `CENSUS_BY_DOCUMENT['sealed-run-record']` | 289 | 292 |
| `CENSUS_BY_KEYWORD['enum']` | 57 | 58 |
| `CENSUS_BY_KEYWORD['exclusiveMinimum']` | 1 | 2 |
| `CENSUS_BY_KEYWORD['maximum']` | 100 | 101 |
| `CENSUS_BY_KEYWORD['type']` | 1001 | 1003 |
| `CENSUS_TOTAL` | 2274 | 2279 |
| `WORKED_EXAMPLE_RECORD_ISSUES` length | 61 | 66 |

The eval-contract delta (+2 reject cases, +1 `type`, +1 `enum`) is `cardinality`'s own enum field.
The sealed-run-record delta (+2 reject cases, +1 `type`, +1 `exclusiveMinimum`, +1 `maximum`) is
`sequence`'s own `z.int().positive()` field. The one new `CONSTRAINT_LEDGER` entry
(`observation-sequence-unique`) is `not-expressible`: uniqueness of a nested field across sibling
array items has no draft-2020-12 keyword, so the published-schema half of that constraint is left
undocumented in the export and stated only in `Observation.sequence`'s own description; the `.refine()`
enforces it on the Zod side alone, which the ledger entry's reason records is safe against this
repository's generated corpus (the mutant walk is keyword-driven and the `observations` array carries
no `maxItems` for the generator's clone-to-exceed step to fire against, so no generated mutant ever
manufactures two observations sharing a `sequence`).

`populatedContract`'s `schemaVersion` moved 1 -> 2 (the eval-contract accept fixture; `cardinality`
becoming required is breaking). `sealedRunRecordFixture`'s `schemaVersion` moved 2 -> 3 (`sequence`
becoming required is a second breaking bump on top of 7.1's mode bump).

## Design Notes

**Why causal predecessors aren't required for a one-level clause, and what reopens them.** One
sealed run record holds exactly one trial (`sealed-run-record.ts:291-296`) — one linear execution,
no concurrent branches — so a total, strictly-increasing `sequence` already answers every "after"
question AD-39's one-level bound can pose. Reopens only if a future record shape lets one record
carry concurrent/branching execution, where two observations could be causally unordered yet still
need distinct `sequence` values. Nothing in this epic proposes that.

**Why `several` routes to Invalid.** An ambiguous match under a single-valued cardinality means the
selector can't bind one meaning — Invalid is the only AD-21 rung that doesn't claim to have measured
anything. `any`-cardinality `several` is not an error: the step declared it expects multiple matches.

**Naming.** `cardinality`'s `'any'` and `BindingValue`'s `{ matcher: 'any' }` (`plan.ts:14`) are
unrelated concepts sharing a string literal on different fields — no type-level collision.
`ExpectedCardinality` (`interface.ts:25-28`, AD-20's response-collection cardinality:
`exact`/`at-most`/`page-bounded`) is a second, more confusable reuse of the word "cardinality" for an
unrelated concept, and its `at-most` is a near-miss for this story's `at-most-one` — different type,
different field, no collision, but worth a code comment cross-reference so a reader isn't misled.

## Verification

**Commands:**
- `npm run validate` -- expected: green end to end
- `npm run generate:schemas` -- expected: exactly two files change (`sealed-run-record.schema.json`,
  `eval-contract.schema.json`)

## Suggested Review Order

**Schema: the two new required fields**

- Entry point -- `sequence`, required, positive, unique per record; the field owed item 2 exists for.
  [`sealed-run-record.ts:171`](../../src/core/schemas/sealed-run-record.ts#L171)

- Uniqueness enforced at parse time, not left to a downstream reader.
  [`sealed-run-record.ts:316`](../../src/core/schemas/sealed-run-record.ts#L316)

- `cardinality` on `InteractionStep`: the closed three-value enum a selector reads.
  [`plan.ts:69`](../../src/core/schemas/plan.ts#L69)

**Selection logic: the new pure reference module**

- `selectObservations` matches by `operationId`, sorts by `sequence`, never array order.
  [`selection.ts:54`](../../src/core/score/selection.ts#L54)

- `resolveTemporalAnchor` resolves an `after` anchor through that same result, lowest-sequence on `any`.
  [`selection.ts:84`](../../src/core/score/selection.ts#L84)

- The I/O matrix and NFR9 permutation family as executable proof, not illustration.
  [`selection.test.ts:98`](../../tests/score/selection.test.ts#L98)

**Where `sequence` had to reach beyond the Code Map**

- The one synthetic-observation site `npm run typecheck` caught outside the `stepId:` grep.
  [`witness-evidence.ts:76`](../../src/core/preflight/witness-evidence.ts#L76)

**Ledger: documenting what the published schema can't say**

- Why the uniqueness `.refine()` is Zod-only, and why that gap is inert against this repo's corpus.
  [`constraint-ledger.ts:224`](../../src/core/schemas/constraint-ledger.ts#L224)

**Peripherals**

- Two new AD-13 reject cases for absent/non-positive `sequence`.
  [`artifact-reject-cases.ts`](../../tests/schemas/fixtures/artifact-reject-cases.ts)

- Two new AD-13 reject cases for absent/out-of-enum `cardinality`.
  [`reject-cases.ts`](../../tests/schemas/fixtures/reject-cases.ts)

- Duplicate-`sequence` rejection, Zod-only per the ledger entry above.
  [`artifacts.test.ts`](../../tests/schemas/artifacts.test.ts)

- Every literal `InteractionStep` fixture across the repo picks up `cardinality`; the pinned census
  and reject-case counters move with it (`Spec Change Log` above has the exact before/after).

## Decisions taken during implementation

**1. `sequence` sits between `observationId` and `operationId`.** Not mandated by the spec; chosen
because it groups the observation's two identity-shaped fields (which one, and where it sits in the
order) ahead of what it did (`operationId`, `provenance`, and the four evidence channels).

**2. The two AD-13-corpus `sequence` reject cases are absent + not-positive, not absent + duplicate.**
`record-mode-absent`/`record-mode-outside-the-two` mirror an enum's two failure shapes (missing,
outside the closed set); `sequence` is a plain positive integer, so its two natural failure shapes are
missing and out-of-domain (zero), following the existing `record-trial-index-zero` precedent
(`too_small`/`exclusiveMinimum` since `.positive()` exports `exclusiveMinimum: 0`, not `.min(1)`'s
`minimum: 1`). Duplicate-sequence rejection is real and tested (`artifacts.test.ts`), but it is
Zod-only per Decision 4 below and therefore cannot be one of the two AD-13 cases: those are asserted
against the published (ajv) validator too, and ajv has no keyword to reject a duplicate nested field
across array items.

**3. `selectObservations`/`resolveTemporalAnchor` take the step directly, not a plan index.**
`selectObservations(step, observations)` reads only `step.operationId`; `resolveTemporalAnchor(anchorStep,
observations)` takes the already-resolved anchor `InteractionStep` rather than the dependent step plus a
plan lookup. A step with no temporal clause (`after: null`) or one naming an undeclared step (AD-39's
permissive dangling reference) never reaches this function — that lookup is the caller's, via whichever
plan index it already holds (e.g. `core/seal/plan-index.ts`'s `PlanIndex`, not imported here since no
caller exists yet). Keeps the new module a dependency-free leaf, matching "no module claims this yet."

**4. The `observation-sequence-unique` constraint-ledger entry is `not-expressible`, and the `.refine()`
stays Zod-only rather than being dropped to match the lineage entries' precedent.** The lineage entries
(`parentDigest`/`revisionCount`) are *not* enforced by Zod either, specifically to avoid a Zod/published
disagreement surfacing in the generated differential corpus. This story's own text calls sequence
uniqueness "schema-enforced," and the risk the lineage precedent guards against does not apply here: the
generated mutant walk (`tests/schemas/published/mutant-generator.ts`) is keyword-driven and the
`observations` field carries no `maxItems`, so its clone-to-exceed step (the one place the generator
duplicates an array item) never fires against it. No generated corpus member can ever present two
observations sharing a `sequence`, so the asymmetry (Zod rejects, ajv would not) is real but inert
against every fixture this repository generates. Verified, not merely argued: `npm run validate`'s full
differential and keyword-mutation sweep is green with the entry in place.

**5. Only the two `ARTIFACT_ACCEPT_FIXTURES`-referenced fixtures bump `schemaVersion`.**
`sealedRunRecordFixture` (2 -> 3) and `populatedContract` (1 -> 2, eval-contract's own accept fixture)
move; `gateCContract` and `absentContract`/`explicitlyEmptyContract` (both EvalContract-shaped but not
the pinned accept fixture) do not, following 7.1 Decision 5's reasoning that the accept fixture's version
is the only place a version number is written down.

**6. `src/core/preflight/witness-evidence.ts`'s `evidenceOf` needed a `sequence` too, and it is not in
the Code Map.** Discovered by `npm run typecheck`, not by the grep the Code Map names (it builds an
`Observation` literal with no `stepId:` key to grep for). It constructs one synthetic, single-observation
shape per pre-flight leg, never collected into an array with a sibling, so uniqueness and ordering have
nothing to apply to; `sequence: 1` is a constant with a comment recording why. Two test-side factories
(`tests/compile/reachability.test.ts`, `tests/evaluate/evidence-resolution.test.ts`) needed the same
one-line fix for the same reason.

**7. Naming: `SELECTOR_CARDINALITIES` / `SelectorCardinalityValue` / `SelectorCardinality`.** Mirrors
`RUN_MODES`/`RunModeValue`/`RunMode` (7.1's own pattern), and the `Selector` prefix is deliberate:
`interface.ts` already exports `ExpectedCardinality` for an unrelated AD-20 concept whose `at-most` mode
is a near-miss for this field's `at-most-one`. Both the schema description and the Design Notes above
cross-reference the other to keep a reader from conflating them.

## Dev Agent Record

`npm run validate` green end to end: build, typecheck, lint, check:docs, check:doc-invocations,
check:shareable, lint:spine, check:vectors, check:schemas, check:ad5-registry, check:ad28-registry,
check:ad31-table, check:layers, check:lineage, check:boundary, check:corpus, check:website-deps,
test:coverage. 87 test files, 2866 tests, 0 failures. Coverage 96.87 percent statements, 92.3 percent
branches, against the ninety-percent `core/` floor. `npm run generate:schemas` changed exactly two files
(`schemas/sealed-run-record.schema.json`, `schemas/eval-contract.schema.json`); `npm run
generate:dev-corpus` regenerated 23 files under `corpus/dev/` from the updated fixtures (no hand edits).

### File List

Source:

- `src/core/schemas/sealed-run-record.ts` -- `sequence`, `OBSERVATION_SEQUENCE_UNIQUE`, the uniqueness
  `.refine()`, both corrected descriptions
- `src/core/schemas/plan.ts` -- `SELECTOR_CARDINALITIES`, `SelectorCardinalityValue`,
  `SelectorCardinality`, the required `cardinality` field
- `src/core/schemas/constraint-ledger.ts` -- the `observation-sequence-unique` not-expressible entry
- `src/core/score/selection.ts` -- NEW: `selectObservations`, `resolveTemporalAnchor`
- `src/core/preflight/witness-evidence.ts` -- `sequence: 1` on the synthetic pre-flight observation

Generated, never hand-edited:

- `schemas/sealed-run-record.schema.json`, `schemas/eval-contract.schema.json`
- `corpus/dev/**` (23 files, regenerated from fixtures)

Tests and fixtures:

- `tests/score/selection.test.ts` -- NEW
- `tests/schemas/fixtures/artifact-fixtures.ts`, `artifact-reject-cases.ts`, `reject-cases.ts`,
  `relevance-contracts.ts`, `gate-c-contract.ts`, `worked-example-artifacts.ts`
- `tests/coverage/fixtures/corpus.ts`, `satisfaction-contracts.ts`
- `tests/seal/fixtures.ts`
- `tests/schemas/plan.test.ts`, `ad5-admissions.test.ts`, `artifacts.test.ts`,
  `constraint-ledger.test.ts`, `worked-example-artifacts.test.ts`
- `tests/compile/scripting-bound.test.ts`, `compile.test.ts`, `rubrics.test.ts`
- `tests/coverage/satisfaction.test.ts`
- `tests/compile/reachability.test.ts`, `tests/evaluate/evidence-resolution.test.ts`
- `tests/schemas/published/keyword-mutation.test.ts`, `differential.test.ts`,
  `published-rejection.test.ts`
- `tests/schemas/publish.test.ts`
