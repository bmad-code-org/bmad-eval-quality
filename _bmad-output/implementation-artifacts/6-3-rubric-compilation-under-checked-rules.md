# Story 6.3: Rubric compilation under checked rules

Status: done

Epic: 6 (ports, pre-flight, and the library and CLI surface)
Story key: `6-3-rubric-compilation-under-checked-rules`
Implements: AD-22 in full, AD-17's prohibition on scoring stated-reasoning prose, AD-5's three rubric
rungs in their published order, and Epic 4's pointer-reachability machinery reused rather than
duplicated. Closes the spike record's finding 7 (a zero-rubric contract compiled and nothing said
whether that was intended) by making it an executed test rather than an unstated implication.

## Story

As the judge path's discipline,
I want rubric authoring rules enforced at compile time,
so that a rubric can never ask a sealed evaluator a question it cannot answer from observable
evidence.

## Acceptance Criteria

### AC 1: Scope, module locations, and what this story does not build

Three AD-5 codes have sat in `FAILURE_CODES` since Story 4.2 with no throw site. `src/core/schemas/
rubric.ts` already parses every shape they fire on and says so in its field descriptions. This story
is the compiler half those descriptions promise: one new module, four exported checks, four new lines
in `compile.ts`'s fixed order, and the pin and doc edits that follow.

**Every ```ts block in this file is labelled either `VERBATIM` (copy it into source as written) or
`SKETCH` (declarations only, showing the exported surface; the dev writes the bodies).**

**New files:**

| Path | Layer | Holds |
| --- | --- | --- |
| `src/core/compile/rubrics.ts` | `core` | `findReasoningProseTerm` and the four checks |
| `tests/compile/rubrics.test.ts` | test | the four checks' accept and reject families |

**Edited files:**

- `src/core/compile/compile.ts`: four new calls after `checkScriptingBound`, plus one sentence in the
  module JSDoc recording the one place they depart from registry order (AC 7).
- `src/core/schemas/rubric.ts`: one added type export and four edited `.describe()` strings (AC 8).
- `schemas/rubric.schema.json`, `schemas/eval-contract.schema.json`: regenerated (AC 8).
- `tests/compile/compile.test.ts`: the wired-function census goes from 19 cases to 26 (AC 9).
- `README.md` and `_bmad-output/shareable/eval-quality-readme.html` (AC 11).
- `_bmad-output/project-knowledge/learning-path-step-by-step.md` (AC 11).

**No test fixture changes.** Every rubric already in the repository compiles clean under these rules.
That is a design constraint on the rules, not a happy accident — see Decision 5.

**This story does not build:**

- Any judging. The package never calls a judge (AD-17); this story only decides whether a rubric is
  admissible before one is ever handed a criterion.
- A penalty magnitude, or any other scoring semantic. `FailureModePenalty` carries a name and a
  description and no weight, and `rubric.ts` records that inventing one is not this story's
  authority. Decision 3 is where a rule was dropped for reaching past that line.
- Scale-level ordinal ranges, monotonicity, contiguity, or a minimum level count (Decision 4,
  Decision 5).
- A declared criterion classification. Decision 1 records why the reasoning-prose check is lexical,
  what that does and does not guarantee, and what a structural version would cost.
- The published `Rubric` artifact's lineage, immutability, or revision counts. That is Story 6.4.
- The barrel. `src/index.ts` exports `runPreflight`, the pre-flight types, and `VERSION`; `compile`
  is not on it, so a compile check is not either.

### AC 2: `src/core/compile/rubrics.ts` — the exported surface  (SKETCH)

```ts
/**
 * AD-22's compile-time rubric checks. `checkRubricIdentifiers` runs first and
 * fires `rubric-unanchored`; the other three follow AD-5's registry order,
 * `rubric-scores-reasoning-prose`, `rubric-unanchored`, then
 * `rubric-evidence-unreachable`. Each throws `StructuralFailure` on the first
 * violation, the convention every `core/compile/` module keeps. An empty
 * `rubrics` array is a no-op in all four, which is what makes a zero-rubric
 * contract compile clean.
 */
import { StructuralFailure } from '../failure-codes.ts'
import type { EvalContract } from '../schemas/eval-contract.ts'
import type { RubricBody } from '../schemas/rubric.ts'
import { buildPlanIndex, type PlanIndex } from '../seal/plan-index.ts'
import { evaluatePointerReachability } from './reachability.ts'

/** Non-throwing core: the first forbidden term in `text`, or `undefined`. */
export function findReasoningProseTerm(text: string): string | undefined

/** `rubric-unanchored`: a rubric or criterion identifier that addresses more than one thing. */
export function checkRubricIdentifiers(contract: EvalContract): void

/** `rubric-scores-reasoning-prose`: authored rubric text that scores stated reasoning. */
export function checkRubricReasoningProse(contract: EvalContract): void

/** `rubric-unanchored`: a rubric that is not a well-formed scoring instrument. */
export function checkRubricAnchoring(contract: EvalContract): void

/** `rubric-evidence-unreachable`: a criterion answerable from nothing the interfaces produce. */
export function checkRubricEvidenceReachability(contract: EvalContract): void
```

The module holds no other exports; path helpers and the two throwing helpers are file-local.
`RubricBody` is a type import, so `rubric.ts` has to export the inferred type. AC 8 does that, and it
moves no generated document, because a type export is erased before the schema builder runs.

The two throwing helpers are `function` declarations rather than `const` arrows, so TypeScript
narrows control flow through their `never` return type and `checkRubricAnchoring` reads
`scaleLevels` and `failureModePenalties` directly after the guards that reject their null cases.
With `const` arrows every such read needs an optional chain that reads as a live possibility to the
next maintainer.

### AC 3: `checkRubricIdentifiers` — addressability, and why it runs first

AD-22 closes with "Rubrics and criteria are addressable identifiers **so a finding can cite one**".
That purpose clause has a real consumer: `JudgeResult` carries `rubricId` and `criterionId` together
(`src/core/schemas/sealed-run-record.ts:209-210`). A duplicated identifier makes that citation
address two things. The schema constrains identifier spelling and nothing else
(`primitives.ts:35-36,44-45`), so uniqueness is the compiler's.

| Fires when | Artifact path | Detail |
| --- | --- | --- |
| two rubrics share an `id` | `EvalContract.rubrics[1].id` | `repeats rubric id "R-001", which a finding could then cite ambiguously (AD-22)` |
| two criteria in one rubric share an `id` | `EvalContract.rubrics[id=R-001].criteria[1].id` | `repeats criterion id "RC-001" inside one rubric (AD-22)` |

The index in the path is the repeat's own index, never the first occurrence's.

Criterion ids are unique **within** a rubric and may repeat across rubrics, because the citation
carries both halves. AC 10's accept case 3 asserts that.

**It runs ahead of the other three, which departs from AD-5's registry order**, and AC 7 records the
departure in `compile.ts`'s JSDoc beside the one already there. The reason is the same one that puts
`checkWitnessLegIdentifiers` ahead of `checkWitnessLegality`: every other rubric check reports a path
of the form `rubrics[id=R-001].…`, and under a duplicated id that path addresses two rubrics. Running
identifiers first makes every path the other three checks emit unambiguous by construction, with no
per-check fallback to numeric indices.

The check itself walks `contract.rubrics` twice for the same reason: rubric ids across the whole
array, then criterion ids per rubric. A single interleaved walk emits a `rubrics[id=…]` criterion
path while a later rubric can still duplicate that id, which is the exact ambiguity this check
exists to stop.

### AC 4: `checkRubricReasoningProse` — the closed vocabulary

The shipped pattern, after the implementation review cut three families from the draft and added
inflection coverage:

```ts
const REASONING_PROSE_PATTERN =
	/\b(?:chains?[-\s]+of[-\s]+thought|trains?[-\s]+of[-\s]+thought|thought[-\s]+process(?:es|ing)?|internal[-\s]+monologues?|self[-\s]+explanations?|reasonings?|rationales?)\b/i
```

`findReasoningProseTerm` returns `REASONING_PROSE_PATTERN.exec(text)?.[0]`. The pattern is not
global, so there is no `lastIndex` to carry between calls. `[-\s]+` rather than `[-\s]` because a
double separator was otherwise a one-character evasion, and `process(?:es|ing)?` and the trailing
`s?` on every noun that takes one because a plural was otherwise a one-letter evasion.

`checkRubricReasoningProse` walks `contract.rubrics` in array order and, per rubric, scans in this
order:

| Order | Site scanned | Artifact path on violation |
| --- | --- | --- |
| 1 | `rubric.criteria[i].text` | `EvalContract.rubrics[id=R-001].criteria[id=RC-001].text` |
| 2 | `rubric.scaleLevels[i].anchor` | `EvalContract.rubrics[id=R-001].scaleLevels[0].anchor` |
| 3 | `rubric.failureModePenalties[i].name` | `EvalContract.rubrics[id=R-001].failureModePenalties[0].name` |
| 4 | `rubric.failureModePenalties[i].description` | `EvalContract.rubrics[id=R-001].failureModePenalties[0].description` |

Criterion text is scanned first because AD-17 and AD-5 both scope this code to a criterion, so where
a rubric carries the defect in more than one place the in-scope site is the one reported. Sites 2, 3,
and 4 are a recorded expansion beyond that scope (Decision 6). `scaleLevels === null` and
`failureModePenalties === null` contribute no sites and are `checkRubricAnchoring`'s problem.

Detail string: `` `scores stated-reasoning prose: matched "${term}" (AD-17, AD-22)` ``.

### AC 5: `checkRubricAnchoring` — the rule table

Walks `contract.rubrics` in array order; within a rubric, applies the rules below in order; throws on
the first hit anywhere. One walk, no pre-pass: every rule here is answerable from a single rubric.

| # | Fires when | Artifact path | Detail |
| --- | --- | --- | --- |
| 1 | `scaleLevels` is `null` or `[]` | `…rubrics[id=R-001].scaleLevels` | `declares no anchored scale levels (AD-22)` |
| 2 | two levels share a `level` ordinal | `…scaleLevels[1].level` | `repeats scale-level ordinal 1, so the ordinal addresses two anchors (AD-22)` |
| 3 | a level's `anchor` is empty or whitespace | `…scaleLevels[0].anchor` | `states no observable condition, so the level is unanchored (AD-22)` |
| 4 | `maxLength` is `null` | `…maxLength` | `declares no bounded length (AD-22)` |
| 5 | `failureModePenalties` is `null` or `[]` | `…failureModePenalties` | `names no failure-mode penalties (AD-22)` |
| 6 | a penalty `name` is whitespace-only | `…failureModePenalties[0].name` | `is blank, so the penalty is unnamed (AD-22)` |
| 7 | a criterion's `text` is empty or whitespace | `…criteria[id=RC-001].text` | `states no question, so the criterion is unanchored (AD-22)` |

Rows 1 through 6 are AD-22's own three shapes, spelled out. Row 7 is row 3's argument at criterion
granularity and is the one row of this table that stretches AD-22's wording; it is recorded as
stretched rather than glossed (Decision 7).

Whitespace is `String.prototype.trim()`. `name` carries `.min(1)` and `anchor` and `text` carry no
minimum, so `'   '` parses in all three and `''` parses in two.

**Three rules were proposed and dropped in review, and the reasons are recorded so they are not
re-proposed:** a two-level minimum (Decision 5), duplicate penalty names (Decision 3), and a
zero-criteria rubric (Decision 8).

### AC 6: `checkRubricEvidenceReachability` — reachability, reused  (SKETCH)

```ts
export function checkRubricEvidenceReachability(contract: EvalContract): void {
	// Built once, lazily, and only when a criterion actually exists —
	// `checkEvidenceReachability`'s convention, for the same reason: a
	// zero-rubric contract should not pay for a plan index.
	// `duplicateIds: 'unresolved'` matches every other compile-side caller.
	// It is load-bearing rather than decorative: `buildPlanIndex` defaults to
	// throwing a `TypeError` on a duplicate step or operation id, and a
	// `TypeError` escaping a compile check is not a structural failure any
	// caller can classify.
}
```

Each `criterion.evidence` goes through `evaluatePointerReachability(pointer, index)` unchanged. On
`{ reachable: false, reason }`:

- code `rubric-evidence-unreachable`
- path `` `EvalContract.rubrics[id=${rubric.id}].criteria[id=${criterion.id}].evidence` ``
- detail `` `"${pointer}" ${result.reason}` `` — the same spelling `checkEvidenceReachability` uses,
  so the two codes' messages read identically apart from code and path.

Two limits, both stated here because a reader will look for them here:

1. `criterion.evidence` is an `InteractionPointer`, not an `EvidencePointer`, so a `@/` bound-element
   pointer cannot parse into this field. `evaluatePointerReachability`'s `@`-rooted early return is
   dead on this path rather than a hole in it (Decision 9).
2. `response-headers`, `response-status`, `exit-code`, `stdout`, and `stderr` declare no shape, so a
   pointer at one of them is reachable as soon as its step resolves. A criterion rooted at
   `stdout` on an `api`-kind contract is therefore answerable from nothing and still compiles. That
   is `evaluatePointerReachability`'s behaviour, shared with `unreachable-check-evidence`, and this
   story does not fork it (Decision 9).

### AC 7: `compile.ts` wiring  (VERBATIM edit)

Four calls after `checkScriptingBound` and before `checkForbiddenInputFloor`:

```ts
	checkScriptingBound(contract)
	checkRubricIdentifiers(contract)
	checkRubricReasoningProse(contract)
	checkRubricAnchoring(contract)
	checkRubricEvidenceReachability(contract)
	checkForbiddenInputFloor(contract)
```

Unconditional: AD-22 names no strict gate and none of the four reads `options.strict`.

The module JSDoc gains one sentence recording the departure, in the same voice as the
`checkWitnessLegIdentifiers` sentence already there:

> `checkRubricIdentifiers` fires `rubric-unanchored` but runs ahead of
> `checkRubricReasoningProse`, which outranks it: a duplicated rubric or criterion id makes every
> `rubrics[id=…]` path the other three checks emit address two things, so identifiers are settled
> before any of them reports.

### AC 8: `src/core/schemas/rubric.ts` and the two regenerated documents

**One added export**, so `rubrics.ts` can name the body type the way every other `core/compile/`
module names the type it walks:

```ts
export type RubricBody = z.infer<typeof RubricBody>
```

A type export is erased before `publish.ts` runs, so this moves no generated document. Confirm with
`npm run check:schemas` before making the description edits below, so the two effects stay separable.

**Four edited `.describe()` strings.** These are committed prose that `publish.ts` emits verbatim
into `schemas/rubric.schema.json` and `schemas/eval-contract.schema.json`, and today two of them
state that `rubric-unanchored` fires on exactly three shapes. AC 3 and AC 5 row 7 add two more, so
leaving the prose alone would ship a published document that contradicts the compiler. Decision 10 is
why this is an edit rather than a reason to drop the rules.

| Field | Edit |
| --- | --- |
| `ScaleLevel.level` | drop "not checked for duplicates … left to the compiler in v0"; state that Story 6.3 rejects a repeated ordinal and deliberately leaves magnitude, sign, ordering, and contiguity free |
| `RubricBody.maxLength` | "one of the three shapes" becomes "one of the shapes" |
| `RubricCriterion.text` | scope the prohibition to wording that matches the compiler's closed vocabulary, and record that a blank text fails under `rubric-unanchored` |
| `Rubric` `.meta` description | list what the checks now cover: an anchored scale, named penalties, a bounded length, a criterion that states a question, addressable rubric and criterion identifiers, and wording matching the closed vocabulary |

The `RubricCriterion.text` and `Rubric` `.meta` wordings say "matches the compiler's closed
stated-reasoning vocabulary" rather than "scores reasoning prose", because Decision 1's guarantee is
lexical and a published document should not promise the semantic version.

**Edit existing description strings only. Never add a new `.describe()` in this story.** An edit
changes description *text*; a new one adds a `description` *occurrence*, and
`tests/schemas/published/keyword-mutation.test.ts:120-157` pins occurrence counts exactly. Then
`npm run generate:schemas` and `npm run check:schemas`, and confirm by running the published suite
that `CENSUS_BY_DOCUMENT`, `CENSUS_BY_KEYWORD`, and `CENSUS_TOTAL` are all unchanged. If any of them
moves, a description was added rather than edited.

Nothing else under `schemas/` moves, no reject case is added, and
`docs/ad31-coverage-predicates.generated.md` does not move — its generator reads
`tests/coverage/fixtures/corpus.ts`, seeded from `satisfiedContract`, and this story edits no
fixture.

### AC 9: the wired-function census, corrected

`tests/compile/compile.test.ts:46` reads "each of the 19 wired functions, in registry order".
`compile.ts` wires **22** functions today: Story 6.2 added `checkSensitivityWitnessDeclared`,
`checkWitnessLegIdentifiers`, and `checkWitnessLegality` and did not add census cases for them, so
the describe has claimed to enumerate every wired function while covering 19 of 22. This story wires
four more, and fixes the three it walked past rather than deepening the gap.

The describe becomes "each of the 26 wired functions, in call order" — *call* order, because the
census numbers have always been call-order ordinals rather than registry positions (case 11 is
`checkUndeclaredMandatoryInput`, registry position 9) and the new title should not repeat the old
title's second inaccuracy.

Final numbering, one `it` per call in `compile.ts` order:

| # | Function | Status |
| --- | --- | --- |
| 1-10 | `checkRequirementLinkage` … `checkDuplicateOperationSignature` | unchanged |
| 11 | `checkUndeclaredMandatoryInput` | unchanged |
| 12 | `checkSensitivityWitnessDeclared` | **new case** (strict-gated, fires `undeclared-mandatory-input`) |
| 13-17 | `checkOracleChannel`, `checkOracleAlignment`, `checkInterfaceKind`, `checkNestedTemporalClause`, `checkScriptingBound` | renumbered from 12-16 |
| 18 | `checkRubricIdentifiers` | **new case** |
| 19 | `checkRubricReasoningProse` | **new case** |
| 20 | `checkRubricAnchoring` | **new case** |
| 21 | `checkRubricEvidenceReachability` | **new case** |
| 22-24 | `checkForbiddenInputFloor`, `checkScopedResourceReferences`, `checkWaiverCompleteness` | renumbered from 17-19 |
| 25 | `checkWitnessLegIdentifiers` | **new case** |
| 26 | `checkWitnessLegality` | **new case** |

Three live titles and comments in the same file cite positions and move with the numbering: the
"reaches `checkScriptingBound` (position 16)" comment, the "`nested-temporal-clause` (position 15),
before `checkScriptingBound` (position 16)" test title, and the multi-defect describe's "check 1 and
check 19", which becomes "check 1 and check 24".

### AC 10: tests

`tests/compile/rubrics.test.ts`, modelled on `tests/compile/sensitivity-witness.test.ts`: a
file-local `mutated`/`failureOf` pair over `cleanPopulatedContract()`, assertions on `failure.code`
and `failure.artifactPath` rather than on `failure.message`, and one `describe` per check named
`'checkFn: failure-code'`. Every case below is numbered, and the number opens the test name.

**Accept family, 1-8 (no throw through the wired `compile()`):**

1. `cleanPopulatedContract()` unmutated — the positive whole-contract regression every check module's
   test file opens with, and the proof that AC 1's no-fixture-change claim holds.
2. `rubrics = []` — a zero-rubric contract compiles clean, which is this story's own AC and the spike
   record's open finding 7.
3. Two rubrics with distinct ids, each with distinct criterion ids, and `RC-001` reused across the
   two — legal, because a judge-call score cites `rubricId` and `criterionId` together.
4. Scale ordinals `-1`, `0`, `7` — non-contiguous, negative, unordered, all legal (Decision 4).
5. A single-level scale — legal (Decision 5). This case is the guard on that decision: if a later
   pass reinstates a minimum, this test is what says the decision was overturned rather than lost.
6. A rubric with two penalties sharing a name — legal (Decision 3), same role as case 5.
7. A rubric with zero criteria — legal (Decision 8), same role as case 5.
8. Table-driven over the excluded vocabulary: `explain`, `explanation`, `thinking`, `thinking time`,
   `thinking tokens`, `CoT`, `scratchpad`, `deliberation`, `justify`, `justification`, each in a
   criterion text, each compiling clean. Decision 2 argues these exclusions; this case is what makes
   the argument enforceable.

**Reject family, 9-26:**

9. Duplicate rubric id → `rubric-unanchored` at `rubrics[1].id`.
10. Duplicate criterion id within one rubric → `rubric-unanchored` at `rubrics[id=…].criteria[1].id`.
11. Table-driven over the accepted vocabulary — every alternative in `REASONING_PROSE_PATTERN`,
    including both the hyphen and the space spelling of each multi-word term, in a criterion text.
    Driven from the term list so a dropped alternative fails a test rather than passing silently.
12. The same term in a scale anchor.
13. The same term in a penalty name.
14. The same term in a penalty description.
15. Criterion text wins over anchor: a rubric carrying a term in both reports the criterion's path.
16-22. One case per row of AC 5's table (rows 1 through 7), each asserting code and exact path.
23. `rubric-evidence-unreachable` on a pointer naming an undeclared step
    (`/interactions/no-such-step/response-body/items`).
24. `rubric-evidence-unreachable` on a declared step with a response-body field the operation
    declares in neither `requiredKeys` nor `permittedKeys`.
25. A contract with a duplicate interaction-plan step id and a rubric pointer at that step: expect a
    `StructuralFailure` with code `rubric-evidence-unreachable`, and assert no `TypeError` escapes.
    An implementation that omits `{ duplicateIds: 'unresolved' }` passes 23 and 24 and fails here.
26. The same for a duplicate operation id across permitted interfaces.

**Precedence family, 27-36, plus 37 and 38 added in the third review round.** Isolated reject cases pass under any ordering, so precedence gets its
own cases, each built from a contract carrying two defects at once:

27. Identifiers before prose: duplicate rubric id plus a reasoning term → `rubric-unanchored`.
28. Prose before anchoring: a reasoning term plus a null `scaleLevels` → `rubric-scores-reasoning-prose`.
29. Anchoring before reachability: a null `maxLength` plus an unreachable criterion pointer →
    `rubric-unanchored`.
30. `checkScriptingBound` before the rubric checks: a width-bound violation plus a **duplicate rubric
    id** → `plan-exceeds-scripting-bound`. The rubric defect has to be the *first* rubric check's, or
    moving the whole rubric block ahead of `checkScriptingBound` still reports the same code and the
    case pins nothing.
31. The rubric checks before `checkForbiddenInputFloor`: a forbidden-input-floor violation plus an
    **unreachable criterion pointer** → `rubric-evidence-unreachable`. The rubric defect has to be
    the *last* rubric check's, for the mirror-image reason.
32. First rubric in array order wins under `checkRubricAnchoring`: two defective rubrics, the first
    reports.
33. First rubric in array order wins under `checkRubricReasoningProse` too, which case 32 does not
    reach.
34. Table-driven intra-rubric precedence: a rubric violating AC 5's rule *n* together with every rule
    below it reports rule *n*. Covers rules 2, 3, and 4.
35. Rule 4 (unbounded length) outranks rule 5 (missing penalties).
36. Rule 5 outranks rule 7 (blank criterion text).
37. The crossing identifier case, sitting with cases 9 and 10: rubric 0 carries a duplicate criterion
    id and rubric 1 duplicates rubric 0's id, and the rubric-id repeat is what reports. This is the
    only case that pins AC 3's two-pass split; 9, 10, and 27 all pass against an interleaved walk.
38. Rule 6 (blank penalty name) outranks rule 7, which cases 34 through 36 leave unpinned.

`findReasoningProseTerm` is additionally tested directly for the term it returns, which is what makes
cases 8 and 11 table-driven rather than thirty near-copies.

**Edited:** `tests/compile/compile.test.ts` per AC 9.

### AC 11: docs

- `README.md`, after the compiler paragraph at line 119, which names three classes of rule and no
  rubric rule. A two-sentence paragraph follows it: rubrics compile only under an anchored scale, a
  bounded length, named penalties, unique rubric and criterion identifiers, a criterion that states a
  question, and an evidence pointer that resolves against the declared interfaces; and authored
  rubric text that asks a judge to grade the subject's own stated reasoning fails a closed-vocabulary
  check over the wording. Both hedges are deliberate. "Resolves against" rather than "answerable
  from" because AC 6's second limit means a `stdout`-rooted criterion resolves and answers nothing,
  and "a closed-vocabulary check over the wording" because Decision 1's guarantee is lexical. Then
  `npm run build:shareable`, which is the only thing that keeps `check:shareable` green.
- `_bmad-output/project-knowledge/learning-path-step-by-step.md`:
  - **Step 15 stays a historical record of Story 4.4 and keeps its 19s.** Its present-tense
    sentences at line 58 (the table row) and line 1169 become past tense, so nothing there claims 19
    is the current count. Lines 1175, 1183, 1193, and 1234 are already historical narrative about
    what that story did and are left alone.
  - Add row 21 to the table after line 63, and a `## Step 21` section following
    `learning-path-template.md`. Step 21 carries the current count of 26. Keep it to one line per
    rule; the reasoning lives in the code comments the step points at.
  - The template says a step is added only after the story is marked done, so this is the last edit
    of the story, after the gate.

### AC 12: the gate

`npm run validate` passes, and `npm run build` succeeds. Record actual figures rather than
arithmetic:

| Measure | Before | After |
| --- | --- | --- |
| `npm run test` files / tests | 67 / 2462 | 68 / 2563 |
| `npm run check:layers` files / violations | 82 / 0 | 83 / 0 |
| Wired compile checks | 22 | 26 |
| Census cases in `compile.test.ts` | 19 | 26 |
| `schemas/*.schema.json` files whose bytes move | 0 | 2, description text only |
| `keyword-mutation.test.ts` census totals | 2272 | 2272 |
| `check:ad31-table` corpus contracts / cells | 19 / 28 | 19 / 28 |

## Decisions taken during story creation

**Decision 1 — the check is lexical, what that guarantees is stated exactly, and the story does not
claim more.** AD-17 forbids scoring "chain-of-thought or stated-reasoning prose" and nothing in the
contract schema declares which channel carries reasoning: `EVIDENCE_CHANNELS` is `response-body`,
`response-headers`, `response-status`, `call-inputs`, `stdout`, `stderr`, `exit-code`; `ChannelRole`
is `success-indicator | diagnostic | payload | collection`; `JudgeResult` is `rubricId`,
`criterionId`, `score`, `note`. None of them names a reasoning trace. A structural check has nothing
to read, so the options are a lexical check or a rung with no throw site. Story 2.3 already made this
trade for `brief-exceeds-scripting-bound`, whose whole module is a closed vocabulary over rendered
prose.

The guarantee is therefore narrow and is written narrowly in AC 4, AC 8, and AC 11: authored rubric
text matching a closed vocabulary fails compilation. It is not "no rubric can score reasoning
prose". A criterion phrased around the vocabulary passes, and the implementation review produced two
working examples: "Explain why the answer was chosen" and "Grade the stepwise derivation presented
before the final answer" both compile clean while being exactly what AD-17 forbids. Closing that gap needs a declared criterion
classification — a field on `RubricCriterion` naming what the criterion scores — which no AD mints,
which would move both generated documents and every census, and which would still rest on the
author's own declaration. That is recorded here as the known limit rather than opened as an
architecture question.

**Decision 2 — three vocabulary families were dropped in review, and two were kept over the same
objection.** The first draft included `scratchpad`, `deliberation`, and the `justif-` family. Review
produced an ordinary API-contract criterion for each: a scratchpad file that gets cleaned up, a
deliberation endpoint that returns 200, an error payload that justifies a 409. Decision 3 of Story
2.3 set the standard those fail — a term earns a place only when it has no common innocent sense in
this domain — so all three are out. A compile-time code has no waiver path, which makes a false
positive a hard block, and a check that blocks permitted authoring gets routed around by wording.

`reasoning` and `rationale` draw the same objection and are kept anyway. AD-17's own words are
"stated-reasoning prose", the repository's own admission fixture
(`tests/schemas/ad5-admissions.test.ts:296`) spells the canonical violation as "Score the quality of
the reasoning the agent stated before answering", and a vocabulary that misses that string is
decorative. The accepted cost is that a criterion naming a `reasoning` or `rationale` response field
in prose fails. The rewrite is real and improves the authoring: a criterion carries an `evidence`
pointer precisely so the text does not have to name the field, so "is the 422 body's reasoning field
populated" becomes a criterion about the observable property with the field named in `evidence`.
`explain why` was added in the story-review pass to catch "Explain why the answer was chosen", and
the implementation review removed it again with a counter-example the same standard rejects: "Does
the response explain why the 409 was returned?" scores an observable error body. The term is
genuinely two-sided, the standard says a two-sided term is out, and the paraphrase gap it was meant
to close is recorded in Decision 1 instead.

Two evasions the implementation review found in the draft pattern are closed rather than recorded:
`thought-processing` and every plural. `[-\s]` became `[-\s]+`, `process(?:es)?` became
`process(?:es|ing)?`, and every noun that takes a plural got `s?`. A one-letter evasion is not a
false-negative worth accepting when the fix is one character.

**Decision 3 — duplicate penalty names are not a compile error.** The first draft failed them on the
argument that the applied deduction becomes undecidable. Review pointed out that nothing is decidable
about a deduction today: `FailureModePenalty` carries a name and a description and no weight, AC 1
disclaims the authority to mint one, and no schema consumes a penalty by key. AD-22 requires
penalties be *named*, and two penalties sharing a name are both named. The rule was reaching past the
line AC 1 draws, so it is gone. Accept case 6 keeps it gone visibly.

**Decision 4 — scale ordinals must be distinct, and nothing more.** `ScaleLevel.level`'s committed
description says the ordinal is "deliberately unbounded and not checked for duplicates … both are
left to the compiler in v0". This story answers both halves and AC 8 rewrites the description to say
so: duplicates fail, because two levels at one ordinal make the ordinal address two anchors;
magnitude, sign, ordering, and contiguity stay free, because a scale running `-2` to `2` or `1, 3, 5`
is an ordinary authoring choice and no AD constrains it. Recording the second half matters as much as
the first — the comment reads as an open question until some story closes it.

**Decision 5 — no minimum level count, and the first draft was wrong to add one.** The draft required
two levels on the argument that a one-level scale admits no gradation. Three things sank it. AD-5's
registry row is "an unanchored scale, unbounded length, or missing named failure-mode penalties", and
a one-level scale carrying a non-empty anchor is anchored, so the rule fired a code whose own text
described something else. `rubric.ts`'s comment enumerates exactly two open questions and a count is
not one of them, so Decision 4's claim to close "both halves" would have been false. And it rejected
21 in-repository contracts rather than the 2 the draft counted: `satisfiedContract` is the parsed
seed for all nineteen AD-31 corpus contracts (`tests/coverage/fixtures/corpus.ts:16-22`), every one
of which is compiled by `tests/coverage/corpus.test.ts`. The vacuity the rule named is also not the
vacuity that exists — `JudgeResult.score` is a bare nullable int with nothing binding it to a
declared level, so the real guard is an ingest-side level-membership rule that no story owns yet, and
a two-level minimum does not approximate it. Dropping the rule also removed every fixture edit from
this story, which is why AC 1 can claim no fixture changes at all.

**Decision 6 — scanning anchors and penalties is an expansion beyond "criterion", and it is
recorded.** AD-17, AD-5's registry row, and AD-22 all attach `rubric-scores-reasoning-prose` to a
criterion. AC 4 also scans scale anchors and penalty text. The reason is that all three are authored
prose that states what the judge rewards or deducts: an anchor reading "level 3: the reasoning is
sound" scores reasoning through every criterion at once, and a penalty reading "deduct where the
response does not state its rationale" scores it through a deduction. Leaving either unscanned makes
the criterion scan a speed bump. The expansion is why criterion text is scanned *first* — where a
rubric carries the defect in more than one place, the site AD-17 actually names is the one reported,
and the expansion only ever adds findings the narrow reading would have missed.

**Decision 7 — one stretched row, and it is named.** AC 5's rows 1 through 6 are AD-22's own three
shapes. Row 7, a blank criterion text, is not: AD-22 requires a criterion be *answerable*, and a
criterion that states no question is unanswerable in a way `rubric-evidence-unreachable` cannot see,
since its pointer may resolve perfectly. It fires `rubric-unanchored` on the reading that a criterion
stating nothing is unanchored the same way a level with no anchor condition is. That is a stretch, it
is recorded as one, and the alternative — a twenty-second AD-5 code — moves `check:ad5-registry`,
which reads AD-5's table out of the spine and asserts set and order equality, which is a spine
revision by another name.

**Decision 8 — a rubric with zero criteria compiles.** The first draft failed it. AD-19's rule
sentence settles it the other way: "Rubrics are optional and a contract with none compiles: the judge
path is a capability, not an obligation, and **AD-17's judge-conduct rules bind only when a rubric
names criteria**." That second clause only does work if a rubric naming no criteria is a legal shape
whose consequence is that AD-17 stops binding. The epic context repeats it. Accept case 7 pins it.

**Decision 9 — reachability is reused verbatim, and its two limits are stated rather than
patched.** The epic context binds this story to "Epic 4's pointer resolution and reachability —
criterion evidence reachability reuses that machinery rather than growing a parallel
implementation". `evaluatePointerReachability` is already exported as the non-throwing per-pointer
core for exactly this. Nothing in `reachability.ts` or `plan-index.ts` is edited, which means this
story inherits both of its limits: a `@`-rooted pointer is short-circuited as reachable (unreachable
from this caller, because `criterion.evidence` is typed `InteractionPointer` and that pattern cannot
match an `@`), and a shapeless channel is reachable as soon as its step resolves, so a criterion
rooted at `stdout` on an `api`-kind contract compiles while being answerable from nothing. The second
is a real gap and it is `unreachable-check-evidence`'s gap too; forking a second reachability
implementation to close it for rubrics alone would leave the two codes disagreeing about the same
pointer, which is worse than the gap. AC 6 states both where a reader will look.

**Decision 10 — the schema edit is three description strings and one type export, and no more.**
Every rule in AC 5 could instead be a Zod refinement, and each would move both documents, move
`keyword-mutation.test.ts`'s three censuses, and need a reject case per surviving keyword. None is
taken. What is taken is the opposite obligation: two committed descriptions currently say
`rubric-unanchored` fires on exactly three shapes, and AC 3 and AC 5 row 7 make that false. Those
strings are emitted verbatim into two published documents, so leaving them alone ships a schema whose
prose contradicts the compiler that reads it — the same drift failure Decision 10's own reasoning
would have used to reject a schema edit. Editing text inside an existing `.describe()` moves bytes
without moving a keyword occurrence, which is why AC 8 forbids adding a new description and requires
the census be re-run rather than assumed.

## Tasks / Subtasks

- [x] **Task 1 — baseline.** `npm run validate`, and record the test counts and the `check:layers`
      file count for AC 12's "before" column. The recorded baseline is 67 files / 2462 tests and
      82 files / 0 violations; confirm it rather than trusting it.
- [x] **Task 2 — the type export.** AC 8's `export type RubricBody`. Run `npm run check:schemas` and
      confirm all twelve documents still match byte for byte, which is the proof that a type export
      is erased before the builder runs. Do this before Task 3 so the two effects stay separable.
- [x] **Task 3 — the module.** Write `src/core/compile/rubrics.ts` per AC 2 through AC 6. Run
      `npm run check:layers` and confirm 0 violations: `core/compile` importing
      `core/seal/plan-index.ts` is the same edge four other compile modules already have.
- [x] **Task 4 — the wiring.** AC 7's four calls and the JSDoc sentence. Run `npm run test`. Any
      failure here is a rubric this story now rejects; fix it in this pass rather than deferring, and
      note it against AC 1's no-fixture-change claim.
- [x] **Task 5 — the tests.** `tests/compile/rubrics.test.ts` per AC 10, then AC 9's census
      renumbering, its two comment updates, and the four new cases plus the three Story 6.2 cases.
      Verify each reject case by reverting its rule locally and confirming that exact test goes red.
      Cases 25, 26, and 27 through 32 are the ones most likely to pass vacuously.
- [x] **Task 6 — the descriptions.** AC 8's three edited strings, then `npm run generate:schemas` and
      `npm run check:schemas`. Run `npx vitest run tests/schemas/published` and confirm every census
      figure is unchanged. If one moved, a description was added rather than edited.
- [x] **Task 7 — README.** AC 11's two sentences and `npm run build:shareable`.
- [x] **Task 8 — the gate.** `npm run validate` and `npm run build`. Fill AC 12's table from actual
      command output. Confirm `git status` shows exactly two files under `schemas/` modified.
- [x] **Task 9 — the learning path, last.** Mark the story done, then AC 11's Step 15 tense fix,
      row 21, and Step 21, per the template's rule that a step is added only after the story is done.

## Dev Notes

### Read these files before writing anything

- `src/core/schemas/rubric.ts` in full. It is 94 lines and it already ships. AC 8 changes four things
  in it and Decision 10 is the argument for each.
- `src/core/compile/reachability.ts`, specifically `evaluatePointerReachability` (`:167`) and
  `checkEvidenceReachability` (`:283`). AC 6 reuses the first unchanged and copies the second's
  lazy-index and detail-string conventions.
- `src/core/seal/scripting-audit.ts` in full. It is 54 lines and it is the precedent for AC 4: a
  closed lexical vocabulary over authored prose, with its exclusions argued in a comment rather than
  left to be rediscovered. Note that it uses `/g` with `.match()` because it counts; AC 4 does not
  count, and a `/g` pattern with `.exec()` would carry `lastIndex` between calls.
- `src/core/compile/compile.ts`'s module JSDoc. It documents why the call order is AD-5's registry
  order and every place the file departs from it. AC 7 adds one departure and one sentence.
- `src/core/compile/sensitivity-witness.ts`, the `checkWitnessLegIdentifiers`-before-
  `checkWitnessLegality` argument. AC 3's ordering is the same argument.
- `tests/compile/sensitivity-witness.test.ts:1-50` for the `mutated`/`failureOf` pair and the
  file-local path constants. It is the newest check test and the one to copy.
- `tests/schemas/ad5-admissions.test.ts:271-297`. Six ready-made mutations that build a rubric shape
  and assert it parses. AC 10's reject cases reuse those mutations and change only the assertion.
  Note the range does not cover every AC 5 shape — duplicate identifiers, whitespace anchors, empty
  penalty arrays, whitespace penalty names, and blank criterion text are not in it — so those cases
  build their own mutations.
- `tests/compile/helpers.ts`. Two exports, `structuralFailureOf` and `cleanPopulatedContract`. There
  is no contract-builder factory; the base fixture is `populatedContract`.

### Previous-story intelligence

1. **Story 6.2's Decision 1 is the template for Decision 7.** Stretched rows are recorded as
   stretched. The registry is not grown to make a story's mapping tidy, because
   `check:ad5-registry` reads AD-5's table out of the spine and asserts set and order equality.
2. **Story 6.2 left the census behind.** It wired three checks and added no census cases, and the
   describe kept claiming to enumerate every wired function. AC 9 fixes that alongside this story's
   own four. It is the concrete reason AC 12 tracks wired checks and census cases as two rows.
3. **Story 6.1's same-layer import rule holds.** `isAllowedEdge` returns `true` for a same-layer
   import, so `core/compile` importing `core/seal/plan-index.ts` is permitted; four compile modules
   already do it, and `rubrics.ts` is the fifth.
4. **Editing `README.md` makes `_bmad-output/shareable/` stale** and `check:shareable` fails the
   build. Story 6.2 hit this; run `npm run build:shareable`.

### Project structure notes

- `core/` is pure and synchronous. These four checks read a parsed contract and throw. No I/O, no
  clock, no randomness.
- The detail-string convention across `core/compile/` is lowercase, no trailing period, identifiers
  in double quotes, and a trailing `(AD-nn)` citation.
- Artifact paths use the `[id=…]` form where an id addresses the element and the numeric index form
  where it cannot. AC 3's two rows and AC 5's rows 2, 3, and 6 use the index form because the id is
  the thing in question or because the element has no id.

### Testing requirements

- Vitest, `tests/**/*.test.ts`, no coverage tooling in this repository yet. Story 6.5 owns the
  `core/` floor and its measurement.
- Assert `failure.code` and `failure.artifactPath`. Do not assert on `failure.message`; it is
  composed from all three constructor arguments and is not a stable surface.
- `noExplicitAny` is off under `tests/**` only, which is what makes the `mutated` helper's
  `(contract: any) => void` legal there and nowhere else.
- Every reject case must be verified by reverting its rule and watching that test go red.

### References

- `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md`:
  AD-22 (the rule), AD-17 (the reasoning-prose prohibition), AD-19 (rubrics are optional and AD-17
  binds only when a rubric names criteria), AD-5's table (the three rungs and their order).
- `_bmad-output/planning-artifacts/epics.md`, Story 6.3's acceptance criteria.
- `_bmad-output/implementation-artifacts/epic-6-context.md`, the Story 6.3 dependency sentence.
- `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/spike-worked-example/FINDINGS.md`,
  finding 7, the open question this story's accept case 2 closes.

## Suggested Review Order

1. **AC 4's vocabulary against Decision 2.** Every term in the pattern must have no innocent sense in
   an API-contract rubric, and every excluded term must have one. `reasoning` and `rationale` are
   knowingly kept over that objection; if the rewrite argument in Decision 2 does not hold, they go
   and the check keeps only the multi-word phrases and `explain why`.
2. **AC 5's seven rows against AD-22's rule sentence.** Rows 1 through 6 must map to AD-22's own
   words. Row 7 must not — it is the stretched one, and if a reviewer can map it cleanly, Decision 7
   is overstating.
3. **Decisions 3, 5, and 8 against accept cases 6, 5, and 7.** Each decision dropped a rule the first
   draft carried. Each accept case is what stops the rule reappearing. If a case is missing, the
   decision is prose only.
4. **AC 3's ordering departure against `compile.ts`'s JSDoc.** The file's ordering contract is that
   registry order is the published priority and every departure is written down. Check the sentence
   AC 7 adds actually says why, in the same voice as the one already there.
5. **AC 6 against `checkEvidenceReachability`.** The two must produce the same reason text for the
   same broken pointer and differ only in code and path. If they diverge, one is re-deriving
   reachability. Then check AC 6's second limit: a `stdout`-rooted criterion really does compile, and
   the story says so rather than hiding it.
6. **AC 8 against the census.** The claim is that editing description text moves two documents and no
   census figure. That is a claim about the keyword walk, and the only proof is running
   `tests/schemas/published`.
7. **AC 9's numbering against `compile.ts` call order**, line by line, plus the two position comments
   at `compile.test.ts:228-229` and `:353`. This is the third numbering the story has carried and the
   first two were both wrong.
8. **AC 10 cases 25 and 26.** They are the only proof that `{ duplicateIds: 'unresolved' }` was
   passed. Delete the options object locally; both must go red with a `TypeError`.
9. **AC 10 cases 27 through 32 against AC 7's call order.** Isolated reject cases pass under any
   ordering. These six are the only thing that pins the order the story specifies.
10. **AC 12's table against actual command output**, not against arithmetic.

## Story Review Record

Three independent pre-implementation review passes against the draft, run in parallel: one Codex
session (the standing cross-model peer for this repository) and two adversarial Claude subagents, one
on executability and one on design fidelity. Two of the three executed rather than reasoned from
prose — they transcribed the story's ```ts blocks into a scratch copy of the repository, compiled
them with the repository's own toolchain, ran the regex against every rubric string in `tests/`, ran
every proposed reject shape through `EvalContract.parse` to look for dead rungs, and ran the full
gate against the implemented draft. The three converged independently on the census defect and on the
identifier-ordering defect, which is why both are treated as settled rather than as opinions.

Every finding is closed in the text above. Nothing was deferred.

**The seven that changed the design rather than the prose:**

1. **A rubric with zero criteria was failed, and AD-19 says it compiles** (HIGH). AD-19's rule
   sentence ends "AD-17's judge-conduct rules bind only when a rubric names criteria", which only
   does work if a criterion-less rubric is legal. The row is gone; accept case 7 pins it. Decision 8.
2. **The two-level scale minimum was minted, contradicted AD-5's own registry text, and would have
   rejected 21 in-repository contracts** (HIGH). `satisfiedContract` is the parsed seed for all
   nineteen AD-31 corpus contracts, not one fixture among two. The rule is gone, which removed every
   fixture edit from the story. Decision 5, accept case 5.
3. **The census was already wrong before this story touched it** (HIGH, all three reviewers).
   `compile.ts` wires 22 functions and `compile.test.ts` enumerates 19 under a title claiming to
   cover every wired function; Story 6.2 added three checks and no cases. The story's own
   renumbering was internally impossible on top of that. AC 9 rebuilds the census at 26 and adds the
   three missing Story 6.2 cases. AC 12 now tracks wired checks and census cases separately.
4. **Identifier uniqueness ran after the checks whose paths depend on it** (HIGH). Every rubric check
   reports `rubrics[id=…]`, and under a duplicated id that path addresses two rubrics, so the prose
   check reported an ambiguous path. Uniqueness became its own check running ahead of the other
   three, with the departure from registry order written into `compile.ts`'s JSDoc. AC 3, AC 7,
   Decision 7's neighbour.
5. **Three vocabulary families fired on legitimate authoring** (MEDIUM, two reviewers, with worked
   counter-examples). `scratchpad`, `deliberation`, and `justif-` are out. `explain why` is in,
   because it was the one natural phrasing of the violation no noun in the list caught. `reasoning`
   and `rationale` are knowingly kept and the cost is argued rather than waved away. Decision 2,
   accept case 8.
6. **Duplicate penalty names invented a scoring semantic the story disclaimed two pages earlier**
   (MEDIUM, two reviewers). Nothing about a deduction is decidable today; the rule is gone.
   Decision 3, accept case 6.
7. **Penalty text was an uncovered route to the thing the code exists to stop** (MEDIUM). A penalty
   reading "deduct where the response does not state its rationale" scores reasoning through a
   deduction while every scanned field stayed clean. Penalties are now scanned, and the whole
   expansion beyond "criterion" is recorded rather than left implicit. AC 4, Decision 6.

**Also closed, without changing the design:** `rubric.ts` exports no inferred `RubricBody` type, so
the draft's import block was a lint failure — AC 8 adds the export and proves it moves no document;
the committed `maxLength` and `Rubric` descriptions say `rubric-unanchored` fires on exactly three
shapes, which the story made false, so AC 8 edits them and re-runs the census rather than shipping a
contradiction; the `walks once` JSDoc claim conflicted with the draft's contract-wide pre-pass, which
the new check split resolves; precedence, insertion-point, and `duplicateIds` regressions had no
tests and now have eight; the reasoning-prose scan's scale-anchor expansion was unrecorded; Step 15
of the learning path is a historical record and is not rewritten to 26; the learning-path edit moves
after the gate per its own template; row 2's artifact path names `.level` rather than the level
object; and four repository counts in Dev Notes were wrong (54 lines, four importing modules, four
current `duplicateIds` callers, and the admissions range's actual coverage).

## Implementation Review Record

Three independent post-implementation review passes against the working-tree diff, run in parallel:
one Codex session and two adversarial Claude subagents, one on correctness and one on spec fidelity.
Two of the three executed against a scratch copy of the repository: 26 source mutations run one at a
time to prove no test was vacuous, `buildPlanIndex` instrumented to count index builds, the regex
probed against ~40 crafted strings and a 1 MB input for backtracking, and the full gate re-run.

Every finding is closed. Nothing was deferred.

**The six that changed the code:**

1. **`explain why` fired on permitted authoring** (HIGH). "Does the response explain why the 409 was
   returned?" scores an observable error body. The family is out, and Decision 2 records both the
   addition and the removal so the next pass does not re-add it.
2. **`thought-processing` and every plural walked past the check** (HIGH and MEDIUM, two reviewers).
   `[-\s]` became `[-\s]+`, `process(?:es)?` became `process(?:es|ing)?`, and every noun that takes
   one got `s?`. `FORBIDDEN_TERMS` now drives 23 spellings rather than 17.
3. **`checkRubricIdentifiers` emitted the ambiguous path it exists to prevent** (MEDIUM, two
   reviewers). Its criterion loop was nested inside the rubric walk, so a rubric-0 criterion
   duplicate reported `rubrics[id=R-001].criteria[1].id` on a contract where two rubrics were both
   `R-001`. It is two passes now.
4. **Precedence cases 30 and 31 pinned nothing** (MEDIUM). Both paired a neighbouring check with a
   *middle* rubric defect, so reordering the whole rubric block left the reported code unchanged. 30
   now uses the first rubric check's defect and 31 the last one's; both were re-verified by moving
   the calls and watching exactly one test go red.
5. **Three orderings had no test at all** (LOW, correctness reviewer, found by mutation). The prose
   check's array order and two intra-rubric rule orders survived deliberate reordering with a green
   suite. Cases 33 through 36 close that, and each was verified the same way.
6. **AC 7's JSDoc sentence was never written** (HIGH and LOW, two reviewers). The ordering reasoning
   lived only in `rubrics.ts`, while the ordering is `compile.ts`'s decision and that file's stated
   contract is that every departure from registry order is written down there.

**Also closed, without changing behaviour:** the throwing helpers became `function` declarations so
control-flow narrowing removes three optional chains that read as live possibilities; the
`RubricCriterion.text` and `Rubric` `.meta` descriptions were narrowed from "scoring reasoning
prose" to "matches the compiler's closed stated-reasoning vocabulary", because a published document
should not promise the semantic guarantee Decision 1 disclaims; the README's "answerable from
evidence the declared interfaces produce" became "evidence pointer resolving against the declared
interfaces", since AC 6's second limit means a `stdout`-rooted criterion resolves and answers
nothing; the README's closing clause lost a negation-then-correction; case 23's `failure.message`
assertion became case 24's message *comparison* against `unreachable-check-evidence`, which is what
AC 6 actually claims and is the file's one documented exception to the no-message rule; accept case
4's ordinals became genuinely unordered; and the story's own AC 8, AC 9, AC 10, AC 11, and AC 12
were corrected where the code turned out to be right and the spec stale.

**Verified clean by execution, and worth recording because each was a specific suspicion:** no
fall-through after a throwing helper on any input; the plan index is built at most once and never on
a zero-criteria contract; every one of the 26 census cases is one-to-one with a `compile.ts` call,
proved by deleting each call in turn; the two regenerated documents differ in description text only,
with `description` occurrence counts unchanged at 14 and 121; and the regex is linear, at 1.15 ms
over a 1 MB input.

## Peer Review Record

A third pass, run in a peer Claude Code session against the finished diff, briefed to skip
everything the first two rounds had closed. It rebuilt the working tree in a scratch copy and
verified by mutation. Thirteen findings, all closed.

**The four that changed behaviour:**

1. **The two-pass identifier split had no regression test** (HIGH). The peer reverted the
   implementation review's own fix to the interleaved walk and the whole suite stayed green at 2544
   tests. Cases 9, 10, and 27 each miss the crossing case by one detail. Case 37 is that case, and
   it goes red against the interleaved walk.
2. **`thought` never took the plural, and `inner monologue` was absent** (MEDIUM). "Score the chain
   of thoughts the agent produced" compiled clean, which is the same one-letter evasion class the
   second round closed for the other nouns. `thinking process` joined them under Decision 2's own
   standard: bare `thinking` is a measurement, the two-word phrase is not.
3. **`[-\s]+` and the zero-width blank check were both unpinned** (MEDIUM and LOW). Reverting the
   `+` and reverting `blank()` to a bare `trim()` each left the suite green. `FORBIDDEN_TERMS` now
   carries the doubled-separator and non-ASCII-hyphen spellings, and case 18 carries a
   zero-width-only anchor.
4. **Rule 6 never appeared as the winner of a precedence case** (MEDIUM). Case 34's own comment
   claimed the cumulative walk pinned every rule, and its rows stop at rule 4. Case 38 pins rule 6
   over rule 7.

**Also closed:** the separator class gained U+2010 and U+2011, since a paste out of a styled
document carried a hyphen the check walked past; `FailureModePenalty.description` still named Story
6.3 as the future home of a penalty magnitude the story had decided against, so it was edited with
the other four and the description census held at 14 and 121; the `FORBIDDEN_TERMS` comment claimed
an exhaustiveness it did not have; a 116-column comment line survived the de-AI pass; Step 21's
vocabulary list was missing `train of thought`; and `sprint-status.yaml` read `done` for this story
while it was still under review.

**Verified clean by the peer, by execution:** the 26-case census is one-to-one in the strong
direction, with each of the 26 calls deleted in turn and exactly its own numbered case going red;
no `TypeError` escapes `checkRubricEvidenceReachability` under a 484-pointer fuzz; the ordering
departure is documented in both places a reader looks; the two regenerated documents are
structurally identical to HEAD once description values are stripped; and the new comments carry no
negation-then-correction, no em dash, and no restatement of the code.

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context) for planning and implementation; Codex CLI 0.149.1 and two Claude
subagents for each of the two review rounds.

### Debug Log References

- Baseline: `npm run validate` at 67 files / 2462 tests, `check:layers` 82 files / 0 violations.
- Every rule in `rubrics.ts` was mutation-verified: each of the nine rules deleted or neutered in
  turn, each turning at least one named test red, and the source restored between runs.
- Ordering was verified the same way, by moving calls in `compile.ts`: identifiers after prose (case
  27 red), rubric block before `checkScriptingBound` (case 30 red), evidence after
  `checkForbiddenInputFloor` (case 31 red), the prose walk reversed (case 33 red), `maxLength` ahead
  of the scale rules (case 34 red), the criterion-text rule ahead of the penalties rule (case 36
  red).
- Each of the 26 census cases was verified by deleting its function's call from `compile.ts`;
  exactly one numbered case went red each time.
- `npm run check:schemas` was run after the type export and before the description edits, to keep
  the two effects separable. It reported all twelve documents byte-identical, which is the proof
  that a type export is erased before the builder runs.
- Third-round fixes were mutation-verified the same way: the interleaved identifier walk (case 37
  red), the separator `+` removed (case 11's two doubled-separator rows red), `blank()` back to a
  bare `trim()` (case 18's zero-width row red), and rule 6 moved below rule 7 (case 38 red).
- Final gate: `npm run validate` green at 68 files / 2563 tests, `check:layers` 83 files / 0
  violations, `check:ad31-table` unmoved at 19 corpus contracts and 28 cells, `check:shareable` 21
  pages byte-identical. `npm run build` succeeds.

### Completion Notes List

- The story shipped with no test fixture changes, which was a design constraint rather than luck:
  the two rules that would have required them (a two-level scale minimum and a non-empty criteria
  list) were both dropped in review, the first because it contradicted AD-5's own registry text and
  would have rejected 21 in-repository contracts, the second because AD-19 states plainly that a
  rubric naming no criteria is legal.
- `compile.ts` wires 26 checks now and the census enumerates all 26. It enumerated 19 of 22 before
  this story, because Story 6.2 added three checks without census cases while the describe title
  claimed to cover every wired function. Fixing that was walked-past work this story picked up.
- Two published documents move, by description text only. The `description` occurrence counts are
  unchanged at 14 and 121, so no keyword census moved and no reject case was needed. The rule that
  made that safe is in AC 8: edit an existing `.describe()`, never add one.
- The reasoning-prose check is lexical and the story says so in four places rather than one. Two
  paraphrases that defeat it are written into Decision 1 as worked examples, so the next reader
  finds the limit before finding it the hard way.

### File List

**New:**

- `src/core/compile/rubrics.ts`
- `tests/compile/rubrics.test.ts`

**Edited, source:**

- `src/core/compile/compile.ts` (four calls, one JSDoc paragraph)
- `src/core/schemas/rubric.ts` (one type export, four description strings)

**Edited, tests:**

- `tests/compile/compile.test.ts` (census rebuilt at 26 cases, three position citations updated)

**Generated and documentation:**

- `schemas/rubric.schema.json`, `schemas/eval-contract.schema.json` (regenerated)
- `README.md`, `_bmad-output/shareable/eval-quality-readme.html`
- `_bmad-output/project-knowledge/learning-path-step-by-step.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
