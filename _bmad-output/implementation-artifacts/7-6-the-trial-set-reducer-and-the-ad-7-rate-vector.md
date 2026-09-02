---
title: 'The trial-set reducer and the AD-7 rate vector'
type: 'feature'
created: '2026-09-02'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'ba7a8c166376e521376a3dd8c0b4d857885d7365'
context: [
  '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md',
  '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/HANDOFF-GATE-CD.md',
  '{project-root}/_bmad-output/implementation-artifacts/epic-7-context.md',
  '{project-root}/_bmad-output/implementation-artifacts/7-4-the-ad-40-defect-signature-corpus-qualification-and-the-witness-match.md',
  '{project-root}/_bmad-output/implementation-artifacts/7-5-ad-33-as-a-total-reference-decision-procedure-with-generated-fixtures.md',
]
---

# Story 7.6: The trial-set reducer and the AD-7 rate vector

Epic 7, story key `7-6-the-trial-set-reducer-and-the-ad-7-rate-vector`. Implements AD-7's rate vector
(`ARCHITECTURE-SPINE.md:261-265`) and closes owed item 1, "repeated trials have no reducer"
(`ARCHITECTURE-SPINE.md:673-682`), whose default is pre-registered by `HANDOFF-GATE-CD.md:110-121` at
"at least two catches in three valid repetitions." Schema change: `ScoringPolicy` gains one required
field, `catchThreshold`, a BREAKING `schemaVersion` bump from 1 to 2, mirroring the shape and the
"no `.default()`" convention `confidenceThreshold` already established.

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** AD-7 computes a catch rate "across the declared trial count" without stating how several
trial outcomes for one probe reduce to one probe result. `caught, missed, missed` reads as 1/1, 0/1, or
1/3 under three readings that all fit the words and disagree on identical data; one of them,
pass-if-any, is the retry anti-pattern AD-6 spends a paragraph forbidding. No stage signature consumes
more than one run record today, so the default three-trial minimum is unreachable, every scored run is
permanently below-minimum, and AD-7's dominance relation has nothing to compare.

**Approach:** Two pure reference functions in `src/core/score/`. A trial-set reducer collapses AD-33's
per-trial outcome resolutions to one result per `(probeId, trialIndex)` and then, by strict majority of
valid trials, to one result per probe. A strength-vector builder and a four-valued dominance comparator
implement AD-7's rate vector over the qualified corpus, including the exclusion of canary probes and
clean controls and the severity-floor override on the dominance relation.

## Boundaries & Constraints

**Always:**
- Both functions are pure: no clock, filesystem, or randomness, and nothing thrown for a domain input.
- Majority is strict: a probe counts as caught only when `caughtCount > catchThreshold * validCount`;
  an exact tie never counts as caught.
- A trial whose designated outcome resolved `oracle-error`, `judge-error`, or `infrastructure-error`
  invalidates that trial for that probe: it is excluded from both the vote and the valid-trial count,
  and recorded as an `InvalidatedAttempt` carrying the state name as its reason.
- A trial whose designated outcome resolved `not-applicable` or `unreached` leaves that probe unvoted
  for that trial without invalidating it, matching AD-7's existing "leaves both numerator and
  denominator" treatment of an unexercised probe.
- A probe with zero valid trials across the whole set is excluded from `ClassStrength` entirely: it
  contributes to neither `caught` nor `exercised`.
- Canary-class probes and every `expectedClean: true` probe are excluded from `StrengthVector`
  regardless of class or trial outcome, per AD-7's "canary probes and clean controls never enter the
  vector."
- The dominance comparator takes two already-computed results, each a `{ outcomes, strength,
  comparabilityKey }` slice; it never re-derives a vector and never reads a port, a corpus, or a clock.
- Two results compare `incomparable` whenever their `comparabilityKey`s differ, checked before any
  component-wise comparison runs.
- A contract that did not catch a probe at or above the scoring policy's severity floor that the other
  contract did catch never dominates that other contract, regardless of the rest of the vector.
- Pass-if-any is rejected in code and proven by a fixture: a single `caught` trial among an otherwise
  non-caught majority must not reduce to caught.
- A tie is impossible by construction: the strict `>` comparison has no branch where an equal count
  returns caught, proven by a fixture at `catchThreshold: 0.5` with an even valid-trial count.

**Ask First:**
- If the 7.4/7.5 corpus and fixtures show a probe legitimately targeted by more than one required
  oracle at once (see Decision 1's one-designated-oracle-per-probe assumption), halt and ask before
  inventing a multi-oracle collapse rule; nothing in the spine or in stories 7.4/7.5 names one.

**Never:**
- Never wire either function into an orchestration stage, a CLI command, or `stage-table.ts`'s `score`
  row: that row stays `module: null` until epic 8, and story 7.5 already asserts so in a test.
- Never conform either function to `PlanStage`/`ReduceStage` in `stage-contracts.ts`: that pair is
  AD-34's port-observation shape for a stage like pre-flight. The trial-set reducer takes no port
  observations and consumes an already-produced outcome sequence, so that conformance is the wrong
  abstraction wearing the right name.
- Never modify `Trials`, `Outcome`, `ClassStrength`, `StrengthVector`, or `Strength`
  (`evidence-artifact.ts:117-208`): every field AD-7 asks for already exists there. This story only
  writes the functions that populate them correctly.
- Never give `catchThreshold` a schema default: `scoring-policy.ts`'s own comment states why no field
  on this schema carries one, and this field follows `confidenceThreshold`'s bare shape exactly.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Strict majority, default threshold | probe with 3 valid trials: caught, confirmed, caught | reduced result: exercised, caught | N/A |
| Pass-if-any rejected | 3 valid trials: caught, confirmed, confirmed | reduced result: exercised, not caught | N/A |
| Tie at the default threshold | 2 valid trials: caught, confirmed | reduced result: exercised, not caught (1/2 is not > 0.5) | N/A |
| Invalidated trial excluded | 3 trials: `oracle-error`, caught, confirmed | valid count 2, caught 1: not caught; invalid trial recorded with reason `oracle-error` | N/A |
| Fully unexercised probe | 3 trials, every one `not-applicable` | probe excluded from `ClassStrength`'s numerator and denominator | N/A |
| Canary / clean control | qualified probe with `probeClass: 'canary'` or `expectedClean: true` | excluded from `StrengthVector` regardless of trial outcomes | N/A |
| Comparability mismatch | two results with differing `comparabilityKey` | `incomparable`, no component-wise check runs | N/A |
| Severity-floor override | contract A missed a floor-or-above probe contract B caught; A's other classes read higher | relation is `incomparable`, never `a-dominates-b` | N/A |
| Equivalent vectors | identical `caught`/`exercised` per shared class | `equivalent` | N/A |
| No shared classes | the two results share no non-null probe class | `incomparable` | N/A |

</frozen-after-approval>

## Code Map

**Read-only evidence, no change needed:**

- `src/core/schemas/evidence-artifact.ts:20-33` -- `OUTCOME_STATES`, the closed twelve, all twelve
  accounted for in `reduce-trials.ts`'s grouping since the reducer is typed over the full state space
  and has no visibility into `expectedClean` (Decision 2 strips `TrialVote` down to `state` alone):
  three (`oracle-error`, `judge-error`, `infrastructure-error`) invalidate a trial; two
  (`not-applicable`, `unreached`) leave a trial's probe unvoted; the remaining seven (`caught`,
  `confirmed`, `missed`, `abstained`, `bypassed`, `passed-clean-control`, `false-positive`) are valid
  votes, of which only `caught` counts toward the numerator. `passed-clean-control` and
  `false-positive` can only arise on an `expectedClean: true` probe in practice, and such a probe is
  filtered out downstream by the vector builder, never by the reducer itself, so the reducer stays
  total rather than relying on a caller to route clean-control votes elsewhere.
- `src/core/coverage/coverage.ts:24-29` -- `SEVERITY_LEVELS.indexOf`, the one existing "at or above"
  ordering precedent over `Severity` in this codebase; the dominance comparator's severity-floor
  override reuses this rather than inventing a second comparison.
- `src/core/schemas/evidence-artifact.ts:117-121` -- `Trials`, carrying `declaredMinimum`, `completed`,
  and `invalidatedAttempts` already. Reuse this shape for invalidated-trial bookkeeping.
- `src/core/schemas/evidence-artifact.ts:101-109` -- `InvalidatedAttempt`, `{ attempt, reason }`, the
  record an invalidated trial produces.
- `src/core/schemas/evidence-artifact.ts:123-147` -- `Outcome`, nine fields per (oracle, probe):
  `state`, `severity`, `probeId` (nullable). Not the reducer's input (see Decision 2); this is what the
  dominance comparator reads `severity` and `probeId` off of, via each result's `outcomes` array.
- `src/core/schemas/evidence-artifact.ts:165-187` -- `ClassStrength` and `StrengthVector`, already
  shaped for AD-7: `caught`, `exercised`, a nullable `rate`, and a fixed three-key object (`defect`,
  `gameability`, `zero-action`) that structurally excludes `canary`. No change; this story writes the
  builder that populates it.
- `src/core/schemas/evidence-artifact.ts:189-208` -- `Strength`: `denominator` (a named string),
  `basis`, `vector`, `comparable`, `note`. The builder sets `denominator` to a fixed descriptive string.
- `src/core/schemas/evidence-artifact.ts:243-285` -- `evidenceCommonFields`: `comparabilityKey` and
  `excludedProbeIds` sit beside `trials`, `outcomes`, and `strength` on every artifact. Computing the
  digest itself is an `emit`-side concern (epic 8); the comparator only reads it for equality.
- `src/core/score/outcome.ts:102-118` -- `OutcomeInputs`, the fifteen fields `resolveOutcome` reads.
  Read for context only; the reducer never calls `resolveOutcome` itself.
- `src/core/score/outcome.ts:120-131` -- `OutcomeResolution`, `resolveOutcome`'s return shape: `state`,
  `severity` is not carried here (it lives on `Outcome`, assembled by the caller per story 7.5's
  Decision 20), `resolvedFrom`, `selectedObservationIds`. The reducer's input type is deliberately
  narrower than this: see Decision 2.
- `src/core/score/outcome.ts:718` -- `resolveOutcome(inputs: OutcomeInputs): OutcomeResolution`, called
  once per trial per required oracle by the caller. This story's reducer consumes a distillation of its
  output across trials; it is never called from `reduce-trials.ts` or `strength.ts`.
- `src/core/schemas/probe.ts:17-22` -- `PROBE_CLASSES`, the closed four. AD-7 excludes `canary`
  structurally; this story's builder additionally excludes `expectedClean: true` regardless of class.
- `src/core/schemas/probe.ts:44-58` -- `probeCommonFields`: `probeId`, `probeClass`, `behaviorId` on
  every probe, plus the `expectedClean` discriminant on the two branches below it.
- `src/core/score/qualification.ts:741-758` -- `QualifiedProbe` and `SealedProbeSet.admitted`, AD-7's
  "unique qualified probe identifiers." The builder iterates `admitted`, never `rejected`.
- `src/core/schemas/scoring-policy.ts:16-67` -- `ScoringPolicy`. `minimumTrialCount` is already the
  declared trial count AD-7 refers to; `confidenceThreshold`'s bare `z.number().min(0).max(1)` shape
  (`:23-29`) and the file's own "No `.default()` anywhere" convention (`:10-11`) is what `catchThreshold`
  mirrors exactly.
- `src/core/schemas/artifact.ts:85-89` -- `ScoringPolicy`'s entry in `INTERCHANGE_ARTIFACTS`.
  `generate:schemas` and `check:schemas` iterate this registry, so the new field needs no separate
  registration.
- `src/core/stage-contracts.ts:28-43` -- `PlanStage`/`ReduceStage`, AD-34's port-observation pair.
  Explicitly not this story's shape; see Boundaries, Never.
- `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/HANDOFF-GATE-CD.md:110-121`
  -- the pre-registered "at least two catches in three valid repetitions," the one number this story
  does not choose independently for the default.
- `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md:261-265`
  -- AD-7's rule text in full: rates not counts, unique probe identifiers not checks, the four-valued
  relation, and the severity-floor override sentence.
- `tests/score/fixtures/outcome-inputs.ts` -- the determinism constraint (no clock, no `Math.random`,
  no filesystem) new fixtures in this story follow, and the file this story's own fixtures sit beside.

**New:**

- `src/core/score/reduce-trials.ts` -- NEW: `TrialVoteState` (a derived three-way grouping of all
  twelve `OUTCOME_STATES` into invalidating / unvoted / voted), `TrialVote` (`{ state:
  OutcomeStateValue }` only, no `severity`: see Decision 2), `TrialSetResult` (`{ exercised: boolean;
  caught: boolean; validCount: number; caughtCount: number; invalidatedAttempts: readonly
  InvalidatedAttempt[] }`), `reduceTrialSet(votes: readonly TrialVote[], catchThreshold: number):
  TrialSetResult`.
- `src/core/score/strength.ts` -- NEW: `DOMINANCE_RELATIONS`, `DominanceRelationValue`,
  `ComparableResult` (`{ outcomes: readonly Outcome[]; strength: Strength }`),
  `buildStrengthVector(admitted: readonly QualifiedProbe[], results: ReadonlyMap<string,
  TrialSetResult>): StrengthVector`, `compareDominance(a: ComparableResult, b: ComparableResult,
  severityFloor: Severity): DominanceRelationValue`. Imports `SEVERITY_LEVELS` from
  `eval-contract.ts` for the "at or above floor" comparison rather than reinventing one.
- `tests/score/fixtures/trial-set-cases.ts` -- NEW: deterministic per-probe trial-vote fixtures
  (majority, tie, invalidated, fully-unexercised), mirroring `outcome-inputs.ts`'s determinism
  constraint.
- `tests/score/reduce-trials.test.ts` -- NEW.
- `tests/score/strength.test.ts` -- NEW.

**Changed:**

- `src/core/schemas/scoring-policy.ts` -- add `catchThreshold: z.number().min(0).max(1)` beside
  `confidenceThreshold`, with a describe citing AD-7 and the pre-registered 0.5 default value. BREAKING
  `schemaVersion` bump: every existing `ScoringPolicy` document is missing a required field.
- `tests/schemas/fixtures/artifact-fixtures.ts:692-703` -- add `catchThreshold: 0.5` to
  `scoringPolicyFixture`, bump its `schemaVersion` to `2`.
- `schemas/scoring-policy.schema.json` -- regenerate via `npm run generate:schemas`.

**Counters that move:**

- `tests/score/` file and test counts, and the global branch-coverage number, recorded in this story's
  Dev Agent Record. Story 7.5's baseline: 94 suite test files, 3225 tests, 96.89% statements / 92.33%
  branches against the 90% `core/` floor.

## Tasks & Acceptance

**Execution:**

- [x] `src/core/schemas/scoring-policy.ts` -- add `catchThreshold` field -- AD-7's configurable
  threshold, closing the epics.md AC clause "the scoring policy able to declare a different threshold"
- [x] `tests/schemas/fixtures/artifact-fixtures.ts` -- add `catchThreshold: 0.5`, bump `schemaVersion`
  to 2 -- keeps the fixture parsing against the new required field
- [x] `npm run generate:schemas` -- regenerate `schemas/scoring-policy.schema.json` -- AD-13's published
  surface must reflect the new field byte for byte
- [x] `src/core/score/reduce-trials.ts` -- implement `reduceTrialSet` -- the trial-set reducer: one
  result per `(probeId, trialIndex)` then, by strict majority of valid trials, one per probe
- [x] `tests/score/fixtures/trial-set-cases.ts` -- deterministic per-probe vote fixtures -- covers
  majority, pass-if-any rejection, tie, invalidated trial, fully-unexercised probe
- [x] `tests/score/reduce-trials.test.ts` -- unit tests over the fixtures above -- proves the I/O matrix
- [x] `src/core/score/strength.ts` -- implement `buildStrengthVector` and `compareDominance` -- AD-7's
  rate vector and its four-valued dominance relation, including the severity-floor override
- [x] `tests/score/strength.test.ts` -- unit tests -- proves exclusion of canary/clean-control probes,
  the comparability gate, the four relation values, the severity-floor override, and asserts
  `ClassStrength`'s and `StrengthVector`'s own key sets carry no weight, percentage, or composite field

**Acceptance Criteria:**

- Given several trials of one probe, when the reducer runs, then it is a pure function over a trial set
  rather than a change to any stage's shipped signature.
- Given three valid trials with two or more caught, when the reducer runs, then the probe reduces to
  caught; given fewer than a strict majority caught, then it reduces to not caught, with the
  pass-if-any reading rejected and proven by a fixture.
- Given an invalidated trial, when the reducer runs, then it leaves both numerator and denominator for
  that trial and is recorded with its reason.
- Given a valid-trial count and the default threshold, when caught count exactly equals half, then the
  reducer returns not caught and a test asserts a tie is unreachable as a caught result.
- Given a qualified probe set and per-probe trial results, when the vector builder runs, then it emits,
  per probe class, the catch rate over unique qualified probe identifiers with raw counts, with canary
  probes and clean controls never entering the vector.
- Given two comparable results, when the dominance comparator runs, then the relation is one of
  `a-dominates-b`, `b-dominates-a`, `equivalent` (on component-wise equality), or `incomparable`.
- Given a contract that missed a behaviour at or above the scoring policy's severity floor that another
  contract caught, when the comparator runs, then the first contract never dominates the second,
  regardless of the rest of the vector.
- Given two results whose `comparabilityKey`s differ, when the comparator runs, then the relation is
  `incomparable` without a component-wise check.
- Given the `StrengthVector`/`ClassStrength` schema, when audited, then no field carries a weight, a
  percentage, or a severity-weighted composite (`caught`, `exercised`, and a derived `rate` only).

## Spec Change Log

<!-- Empty until the first review loopback. -->

## Decisions settled by construction

1. **One designated oracle per probe.** Nothing in stories 7.4 or 7.5 constructs an `Outcome` record
   yet (`Outcome` is schema-only; grep confirms no production code builds one), and `ProbeWitnessMatch`
   (`witness.ts:99-121`) is computed per probe, not per (oracle, probe) pair. The reducer's input is
   therefore one `OutcomeResolution`-shaped value per `(probeId, trialIndex)`, assuming AD-40's
   discriminating condition pairs a defect/gameability/zero-action probe with exactly one designated
   oracle. If a future story's corpus needs more than one oracle per probe, that is an "Ask First" per
   Boundaries, not a case this reducer collapses silently.
2. **The reducer's input type is narrower than `OutcomeResolution`, and carries no `severity`.**
   Rather than take `OutcomeResolution` (which carries rule identifiers and finding references the
   reducer has no use for), `TrialVote` carries only `state`. Severity plays no role in the reducer or
   in `TrialSetResult`: the dominance comparator's severity-floor override (Decision 6) reads
   `Outcome.severity` directly off the artifact's `outcomes` array, a different input entirely, so a
   `severity` field on `TrialVote` would be write-only. This keeps `reduce-trials.ts` decoupled from
   `outcome.ts`'s internals the same way `OutcomeInputs` stayed decoupled from `SealedRunRecord`.
3. **`catchThreshold` is a fraction compared with strict `>`, defaulting to 0.5.** A fraction
   generalizes over a variable valid-trial count without a floor/ceiling special case, and `caught >
   0.5 * valid` reduces exactly to "at least two catches in three" at `valid = 3`, matching
   `HANDOFF-GATE-CD.md:118`'s pre-registered number. Strict `>` makes a tie structurally unreachable as
   a caught result, closing the epics.md AC clause "a tie is impossible under a strict majority and the
   reducer asserts that rather than leaving it open."
4. **Zero valid trials excludes a probe from `ClassStrength` entirely**, not merely from that trial's
   vote, mirroring AD-7's existing rule for a probe whose home operation the evaluator never invoked:
   both fields are left rather than the probe scoring a `0` numerator against a `0` denominator, which
   `rate`'s nullability already exists to represent.
5. **`expectedClean: true` exclusion is enforced by the builder, not the schema.** `StrengthVector`
   already excludes `canary` structurally by omitting a fourth key; `expectedClean` is orthogonal to
   `probeClass` (`probe.ts:71-92`), so a clean control of any non-canary class is filtered by the
   builder reading `probe.expectedClean` before grouping by `probe.probeClass`.
6. **The dominance comparator reads a `{ outcomes, strength, comparabilityKey }` slice, not a bare
   `StrengthVector` pair.** The severity-floor override needs to know, per probe, whether one side
   caught it and the other did not; that identity is lost once probes are aggregated into
   `ClassStrength` counts, so the comparator's input carries the full `outcomes` array (already present
   on every `EvidenceArtifact`, `evidence-artifact.ts:276`) alongside the aggregate `Strength`.
7. **Per-class comparison uses `rate`, not raw `caught`/`exercised`.** Two results being compared may
   have scored different numbers of exercised probes in a class; AD-7's own text says "Rates, not
   counts, because raw counts let trial count masquerade as contract quality," which applies to
   cross-result comparison exactly as much as it applies to within-result reporting.
8. **A probe class present (non-null) on only one side of a comparison is excluded from it entirely**,
   contributing neither a win nor a loss to either side; it is genuinely missing data, not a zero. If no
   class is shared between the two results, the relation is `incomparable`.
9. **The severity-floor override can only push a relation toward `incomparable`, never invert it.** If
   the raw component-wise comparison reads `a-dominates-b` and the override condition fires against A,
   the result becomes `incomparable`, not `b-dominates-a`: B's own aggregate is not thereby proven
   better everywhere, only A is proven not to dominate.
10. **`ScoringPolicy`'s `schemaVersion` bumps from 1 to 2, BREAKING.** The new field is required with
    no default, so every existing `ScoringPolicy` document (in-repo, this is only
    `scoringPolicyFixture`) fails to parse until updated, which is exactly AD-11's definition of a
    breaking change.
11. **A vector's class key is `null` only when the qualified set admits zero probes of that class after
    the canary/clean-control filter; a class with admitted probes but zero exercised ones is a present
    `ClassStrength` of `{caught: 0, exercised: 0, rate: null}`, never a `null` class.**
    `ClassStrength.rate`'s own nullability exists specifically for "`exercised` may be zero"
    (`evidence-artifact.ts:172`); if the whole class collapsed to `null` whenever `exercised === 0`,
    that nullability could never be observed on a non-null `ClassStrength`, which is itself evidence the
    two nullables mean different things. This also fixes what "shared" means for the dominance
    comparator: two `ClassStrength` objects are shared only when both are non-null, and a shared class
    contributes to the comparison only when both sides' `rate` is also non-null; a class shared as an
    object but null-`rate` on either side is skipped exactly like an absent class (Decision 8), since a
    null rate carries no comparative evidence either way.

## Decisions taken during implementation

Each of these was a checkpoint the workflow would have asked about. Settled here and recorded, per
the epic preamble.

1. **`ComparableResult` carries `comparabilityKey` as a third field, not the two the Code Map's
   parenthetical type listed.** The Boundaries section states the comparator's input is "each a
   `{ outcomes, strength, comparabilityKey }` slice" in as many words, the Design Notes read
   `a.comparabilityKey !== b.comparabilityKey` directly, and the I/O matrix's "Comparability mismatch"
   row and its own acceptance criterion both require the check to run before any component-wise
   comparison. The Code Map's two-field listing is the one place this story's frozen text omits the
   field a shipped `EvidenceArtifact` already carries beside `strength`; the three other citations agree
   with each other and are load-bearing for a stated acceptance criterion, so they are what the type
   follows. `comparabilityKey` is typed `string` rather than the branded `Digest`, matching how
   `OutcomeResolution` already carries `resolvedFrom` as a bare `string` rather than `FindingId`.
2. **A class tied on `rate` while its two sides' `caught`/`exercised` counts differ resolves the whole
   comparison toward `incomparable`, the same value a fully non-contributing comparison already
   returns.** AD-7 and the Design Notes name three shapes explicitly -- `equivalent` (every contributing
   class equal on counts), a one-sided win, and both sides winning at least one class each -- and leave
   a fourth combination unnamed: a class that contributes (both sides non-null with a non-null `rate`),
   is not equal on counts, and yet hands neither side a win because the tied `rate` never satisfies the
   strict `>` either direction (for example `1/2` against `2/4`). Reading `incomparable` as the closure
   value keeps the relation total over every input the type admits without inventing a fifth relation
   value or silently promoting a tie to a win; it is also the value the "no class contributes" case
   already carries, so the fallback is the existing default rather than a new branch.
3. **`InvalidatedAttempt`, `Outcome`, `ClassStrength`, `StrengthVector`, and `Strength` each gain an
   `export type X = z.infer<typeof X>` beside their const in `evidence-artifact.ts`.** The reducer and
   the comparator need each shape as a TypeScript type and none of the five carried one; `CoverageGap`
   and `LineageChain` already show the same pairing beside their own consts. This is the identical move
   the prior story made for `OracleDisposition` under an equally strict "no field added, removed,
   retyped" boundary, recorded there as changing no exported byte and not a schema edit; `npm run
   check:schemas` after the change confirms all twelve committed JSON Schema documents, including
   `evidence-artifact.schema.json`, still match the source byte for byte, so the "every field AD-7 asks
   for already exists there" boundary holds unmoved.
4. **The pre-existing sole-AD-6-state-namer test widens its allowed file set from two entries to four.**
   `tests/score/outcome.test.ts` already asserted, as a source scan over the whole package, that only
   `evidence-artifact.ts` and `outcome.ts` ever name a state literal -- a proxy for "only `resolveOutcome`
   assigns a state" written before any second legitimate consumer of the vocabulary existed. The trial-set
   reducer groups all twelve states by literal and the dominance comparator reads `caught` directly for
   the severity-floor override; both are readers, not assigners, in the same sense `outcome.ts` is the
   sole assigner. The test now asserts every file naming a state literal is one of the four allowed
   modules, and that the two original modules still appear for every state, preserving its original
   purpose -- catching a state literal leaking into a CLI, an orchestration stage, or anywhere outside
   this package's small reader set -- while accommodating the two new, in-boundary readers this story
   adds.
5. **`tests/schemas/published/keyword-mutation.test.ts`'s pinned per-document and per-keyword census
   counts move by exactly the three keywords `catchThreshold` adds.** `catchThreshold` mirrors
   `confidenceThreshold`'s bare `type`/`minimum`/`maximum` shape exactly and adds no new value to the
   already-present `required` array's own keyword occurrence, so `scoring-policy` moves from 32 to 35
   occurrences and the `type`, `minimum`, and `maximum` per-keyword counts and the grand total each move
   by exactly one, one, one, and three. Re-running the sweep after the edit confirmed the count with no
   further adjustment needed.

## Design Notes

**The reducer, in two stages.** Stage one groups a trial set's outcome resolutions by `(probeId,
trialIndex)`; under Decision 1 this is a lookup rather than a genuine multi-value collapse, since each
probe has exactly one designated oracle. Stage two folds across `trialIndex` for one probe:

```
validVotes = votes.filter(v => v.state is not oracle-error, judge-error, or infrastructure-error)
invalidatedAttempts = votes not in validVotes, each { attempt: trialIndex, reason: state }
countedVotes = validVotes.filter(v => v.state is not not-applicable or unreached)
if countedVotes.length === 0: probe is unexercised, contributes nothing to ClassStrength
else:
  caughtCount = countedVotes.filter(v => v.state === 'caught').length
  caught = caughtCount > catchThreshold * countedVotes.length
```

**The vector builder.** For each of the three classes: if `admitted` (`SealedProbeSet.admitted`, after
excluding `canary` and `expectedClean === true`) contains no probe of that class, the vector's key is
`null` (Decision 11). Otherwise, for every probe of that class look up its `TrialSetResult` and treat a
missing one (unexercised, Decision 4) as `exercised: 0, caught: 0`; sum `exercised` (count of probes
with `countedVotes.length > 0`) and `caught` (count with `caught: true`) across the whole class, and set
`rate = exercised === 0 ? null : caught / exercised`.

**The dominance comparator.** A class contributes to the comparison only when it is a non-null
`ClassStrength` on both sides and both sides' `rate` is also non-null (Decision 11); every other class
is skipped, whether absent on one side (Decision 8) or present with a null rate on either. `equivalent`
if every contributing class has equal `caught` and `exercised` on both sides (comparing the pair rather
than the derived `rate` avoids a floating-point equality check). Otherwise, a side "wins" a class when
its `rate` is strictly greater; `a-dominates-b` when A wins at least one contributing class and loses
none, symmetric for B, and `incomparable` when both win at least one class each or no class contributes
at all. Before any of this: if `a.comparabilityKey !== b.comparabilityKey`, return `incomparable`
immediately. After: apply the severity-floor override (Decision 9) by scanning both `outcomes` arrays,
skipping any entry with `probeId: null` (an outcome not tied to any probe, outside AD-7's vector
entirely), for a `probeId` where one side's outcome has `state === 'caught'`, the other's does not, and
the caught side's `Outcome.severity` is at or above `severityFloor` (`SEVERITY_LEVELS.indexOf`
comparison, per `coverage.ts:24-29`'s precedent); if such a probe exists against the side the raw
comparison favored, downgrade that result to `incomparable`.

## Verification

**Commands:**

- `npm run generate:schemas` -- expected: writes `schemas/scoring-policy.schema.json` reflecting
  `catchThreshold`
- `npm run check:schemas` -- expected: exits 0, committed schema matches generated output byte for byte
- `npm run test -- tests/score` -- expected: green, including the pass-if-any-rejection and
  tie-impossibility fixtures
- `npm run test:coverage` -- expected: `src/core/**` at or above 90% statements and branches
- `npm run check:boundary` -- expected: green
- `npm run validate` -- expected: green end to end

## Suggested Review Order

1. `src/core/schemas/scoring-policy.ts` -- the one schema change, small and self-contained
2. `src/core/score/reduce-trials.ts` + `tests/score/reduce-trials.test.ts` -- the reducer and its
   pass-if-any / tie-impossibility proofs
3. `src/core/score/strength.ts` + `tests/score/strength.test.ts` -- the vector builder and the
   dominance comparator, especially the severity-floor override
4. Decisions settled by construction 1, 6, 8, 9 -- the four judgment calls with no direct spine citation

## Implementation Review Record

**Round 1** -- a code-review pass against the finished working tree. 4 findings, all real and
trivially fixable, all addressed in the same pass; `npm run validate` green before and after (3271
tests after, coverage unmoved at 96.92 / 92.41 percent).

1. **`reduceTrialSet`'s majority check multiplied instead of divided, which is unsound under
   IEEE-754.** `caughtCount > catchThreshold * validCount` rounds `catchThreshold * validCount` away
   from the exact value for some non-power-of-two thresholds -- `0.29 * 100` evaluates to
   `28.999999999999996` -- so a mathematically exact tie (`29 / 100 = 0.29`) compared as `29 >
   28.999999999999996` reduced to caught, violating the frozen "an exact tie never counts as caught"
   boundary. The existing tie fixtures all used `catchThreshold: 0.5`, where `0.5 * n` is always exact
   in IEEE-754, so nothing in the suite could have caught it. Fixed by comparing
   `caughtCount / validCount > catchThreshold` instead, which has no such rounding direction; three
   fixtures added, including the `0.29` / `100` / `29` case and a small spread of other thresholds
   independently verified to trigger the multiply form's rounding in the caught-favouring direction.
2. **`compareDominance`'s third component-wise outcome -- a contributing class tied on `rate` while
   its counts differ -- had no test.** The doc comment names it as a deliberate closure to
   `incomparable`, but every `equivalent` fixture used identical counts and every `incomparable`
   fixture reached it by a different path (a differing `comparabilityKey`, no shared class, or both
   sides winning a class), so the branch was reachable and undertested rather than untested by
   coverage but unproven by name. One case added: `1/2` against `2/4`, same `rate`, different counts,
   asserted `incomparable`.
3. **`catchThreshold` had no reject-case coverage**, despite sharing `confidenceThreshold`'s exact
   `.min(0).max(1)` shape and the story's own text saying so. The parallel pair is added to
   `artifact-reject-cases.ts` (`too_big`/`maximum` above one, `too_small`/`minimum` below zero), which
   moved three counts pinned elsewhere against the total reject-case corpus size: `ARTIFACT_REJECT_CASES`
   from 81 to 83 and the published total from 136 to 138, in both `published-rejection.test.ts` and
   `differential.test.ts`.
4. **The sole-AD-6-state-namer boundary test's four-file allowlist was flatter than the actual
   invariant.** `reduce-trials.ts` legitimately names all twelve states by design; `strength.ts` only
   ever names `'caught'`. A blanket allowlist would silently pass a stray state literal accidentally
   added to `strength.ts` -- exactly the class of regression the original two-file exact-match test
   existed to catch. Tightened to a per-state exact expected set: the two original modules and
   `reduce-trials.ts` for every state, plus `strength.ts` for `'caught'` alone.

## Dev Agent Record

`npm run validate` green end to end, exit 0: build, typecheck, lint, check:docs, check:doc-invocations,
check:shareable, lint:spine, check:vectors, check:schemas, check:ad5-registry, check:ad28-registry,
check:ad31-table, check:ad33-table, check:layers, check:lineage, check:boundary, check:corpus,
check:website-deps, test:coverage. 96 suite test files, 3271 tests, 0 failures. Coverage 96.92 percent
statements, 92.41 percent branches, against the ninety-percent `core/` floor. `npm run generate:schemas`
was run once, for `catchThreshold`; `npm run check:schemas` confirms all twelve committed JSON Schema
documents match the source byte for byte, including the eleven this story's code did not otherwise
touch. `npm run check:boundary` reports zero violations across the 109 `src/` files scanned, confirming
none of this story's own AD-number-only comments tripped the five hazard patterns live for this story's
vocabulary. `npm run test -- tests/score` green on its own: 9 files, 272 tests.

Four pre-existing tests needed updating for reasons this story's own changes caused, not regressions:
`tests/score/outcome.test.ts`'s sole-AD-6-state-namer source scan (tightened per Implementation Review
Record finding 4), `tests/schemas/published/keyword-mutation.test.ts`'s pinned `scoring-policy` census
(moved by the three keywords `catchThreshold` adds), and `published-rejection.test.ts` /
`differential.test.ts`'s pinned reject-case corpus totals (moved by the two new `catchThreshold` reject
cases, finding 3). All four are recorded under Decisions taken during implementation or the
Implementation Review Record.

### Moved counters, before -> after

Story 7.5's recorded baseline: 94 suite test files, 3225 tests, 96.89 / 92.33 percent statements /
branches.

| Site | Before | After |
| --- | --- | --- |
| `tests/score/` test files | 7 | 9 |
| `tests/score/` tests | 232 | 272 |
| Suite test files | 94 | 96 |
| Suite tests | 3225 | 3271 |
| Coverage, statements | 96.89 percent | 96.92 percent |
| Coverage, branches | 92.33 percent | 92.41 percent |
| `ScoringPolicy.schemaVersion` | 1 | 2, BREAKING |
| `scoring-policy.schema.json` keyword occurrences | 32 | 35 |
| `ARTIFACT_REJECT_CASES` / published reject total | 81 / 136 | 83 / 138 |
| `validate` chain length | 19 checks | 19, unmoved |
| Published JSON Schema documents | 12 | 12, unmoved |
| `stage-table.ts:129` `score` row | `module: null` | unmoved, asserted by a test |

Two layers of counting: against the pre-implementation baseline, `tests/score/` accounts for all 40 of
the suite's added tests bar six (272 - 232 = 40); the other six are the two new `catchThreshold` reject
cases, each parameterised over three `it.each` sites (`artifact-reject-fixtures.test.ts` once,
`published-rejection.test.ts` twice), for 2 x 3 = 6. 40 + 6 = 46 = 3271 - 3225. Within that, the
Implementation Review Record's own round added 9 tests to the pre-review total of 3262: three in
`tests/score/` (two reduce-trials tie cases, one strength tied-rate fixture) and six from the two new
reject cases.

### File List

Source:

- `src/core/score/reduce-trials.ts` -- NEW: `TrialVote`, `TrialVoteState`, `TRIAL_VOTE_STATES`,
  `TrialSetResult`, `reduceTrialSet`; the majority check reads `caughtCount / validCount >
  catchThreshold` per Implementation Review Record finding 1
- `src/core/score/strength.ts` -- NEW: `DOMINANCE_RELATIONS`, `DominanceRelationValue`,
  `ComparableResult`, `buildStrengthVector`, `compareDominance`
- `src/core/schemas/scoring-policy.ts` -- `catchThreshold` field, no default; the `.meta` description
  extended to name it and AD-7
- `src/core/schemas/evidence-artifact.ts` -- `export type` beside `InvalidatedAttempt`, `Outcome`,
  `ClassStrength`, `StrengthVector`, and `Strength`, each changing no exported byte

Schemas:

- `schemas/scoring-policy.schema.json` -- regenerated via `npm run generate:schemas`

Tests and fixtures:

- `tests/score/fixtures/trial-set-cases.ts` -- NEW: deterministic per-probe `TrialVote` fixtures
- `tests/score/reduce-trials.test.ts` -- NEW
- `tests/score/strength.test.ts` -- NEW
- `tests/schemas/fixtures/artifact-fixtures.ts` -- `scoringPolicyFixture` gains `catchThreshold: 0.5`
  and its `schemaVersion` moves to 2
- `tests/score/outcome.test.ts` -- the sole-AD-6-state-namer test tightened to a per-state exact
  expected set, per Implementation Review Record finding 4
- `tests/schemas/published/keyword-mutation.test.ts` -- the `scoring-policy` census and the three moved
  per-keyword counts, per Decisions taken during implementation, item 5
- `tests/schemas/fixtures/artifact-reject-cases.ts` -- `policy-catch-threshold-above-one` and
  `policy-catch-threshold-below-zero`, mirroring the `confidenceThreshold` pair, per Implementation
  Review Record finding 3
- `tests/schemas/published/published-rejection.test.ts` and
  `tests/schemas/published/differential.test.ts` -- the pinned reject-case corpus totals (81/136 ->
  83/138), moved by the two new reject cases

## Suggested Review Order

**The schema change**

- The one required field this story adds; every other file moves because of this.
  [`scoring-policy.ts:30`](../../src/core/schemas/scoring-policy.ts#L30)

**The trial-set reducer**

- Entry point: folds one probe's votes to a result by strict majority.
  [`reduce-trials.ts:92`](../../src/core/score/reduce-trials.ts#L92)

- The majority check, division not multiplication, so a mathematically exact tie can't round to caught.
  [`reduce-trials.ts:115`](../../src/core/score/reduce-trials.ts#L115)

- Proves the fix: an exact tie at a non-0.5 threshold that the multiply form would have missed.
  [`reduce-trials.test.ts:103`](../../tests/score/reduce-trials.test.ts#L103)

**The rate vector and dominance comparator**

- Entry point: per-class catch rate over the qualified, canary/clean-control-excluded corpus.
  [`strength.ts:101`](../../src/core/score/strength.ts#L101)

- The four-valued relation: comparability gate, then component-wise win/loss/tie.
  [`strength.ts:211`](../../src/core/score/strength.ts#L211)

- The severity-floor override, applied only against the side the raw comparison favoured.
  [`strength.ts:217`](../../src/core/score/strength.ts#L217)

- The tied-rate/differing-counts branch, closed to `incomparable`, added by the review round.
  [`strength.test.ts:275`](../../tests/score/strength.test.ts#L275)

**Type exports, no schema change**

- Five `z.infer` exports beside their consts, the same move story 7.5 made for `OracleDisposition`.
  [`evidence-artifact.ts:185`](../../src/core/schemas/evidence-artifact.ts#L185)

**Peripherals**

- The reject-case pair `catchThreshold` was missing, mirroring `confidenceThreshold`'s.
  [`artifact-reject-cases.ts:828`](../../tests/schemas/fixtures/artifact-reject-cases.ts#L828)

- The sole-AD-6-state-namer boundary test, tightened to a per-state exact file set.
  [`outcome.test.ts:1442`](../../tests/score/outcome.test.ts#L1442)
