# Deferred work

Fifteen items are open, listed under "How to use this file" and in the per-review sections
following it. The prose immediately below records how each past item closed. This sentence said
"no items are currently open" while epic 7 filed fifteen of them; it is corrected here so a reader
does not trust the header over the list.

Story 7.10 opened five items and one of them closed the same day, 2026-09-03, wider than it was
filed. The entry said two of epic 7's nine `schemaVersion` bumps carried no bump note in the driving
field's own `.describe()`, which is where AD-11 says the record belongs. A recount against source
found five: the eval contract's 2 -> 3 (`TestData.principals`, `TestData.resources`), the sealed
brief's 1 -> 2 (`principals`), the evidence artifact's 1 -> 2 (`ScoringVersionInputs.mode`), the
probe's 1 -> 2 (`qualification`, `defectSignature`), and the scoring policy's 1 -> 2
(`catchThreshold`). All five now carry the note, and `schemas/eval-contract.schema.json`,
`schemas/sealed-evaluator-brief.schema.json`, `schemas/evidence-artifact.schema.json`,
`schemas/probe.schema.json`, and `schemas/scoring-policy.schema.json` are regenerated from them, so
the same release's CHANGELOG claim that every bump is recorded in the field's own description is
true of all nine. The entry's "no in-repo record" was also too strong for three of the five: the
brief's bump is in a code comment at `src/core/seal/seal.ts:95-98`, and the probe's and the evidence
artifact's are in their artifact-level `.meta` descriptions, which do export. The scoring policy was
the only one with no record anywhere in its module. The edit is additive text on six existing
`.describe()` calls, so no `schemaVersion` moved and no field changed shape; the reasoning lives in
`7-10-the-epics-disclosed-breaks-and-the-non-comparability-statement.md`'s review record. The other
four items Story 7.10 opened stay open below.

All five items Story 4.2's own step-04 review opened were closed the same day, 2026-08-25, once
pushed on rather than left queued:

- **AD-16's two forbidden-input checks had no thrower.** Closed in `src/core/compile/forbidden-
  inputs.ts`. `checkForbiddenInputFloor` checks all seven mandatory floor members, and
  `checkScopedResourceReferences` rejects any populated scoped resource list, matching the schema's
  declared failure shape. `tests/compile/forbidden-inputs.test.ts` covers every floor member plus
  null, empty, and populated scoped resources.
- **Unbounded recursion depth over nested `not`/`all`/`any` expressions.** Closed as out of v0's
  stated scope, not as unaddressed: the spine states plainly, twice, that "the package treats a
  caller as a possibly-buggy integration, not as an adversary," that an adversarial trust model
  "would require independent attestation or a runner boundary the package owns," ruled out for v0 by
  ADR-004, and that "upgrading the trust model is a spine amendment, not a hardening exercise." A
  stack-depth guard against an adversarially deep `check` tree is exactly that hardening; it is not
  this or any other v0 story's work to add quietly. Revisit only alongside an actual trust-model
  change.
- **`buildPlanIndex`/`parseEvidenceTarget` could throw a raw `TypeError` on a schema-legal duplicate
  `operationId`.** Closed: `plan-index.ts`'s `buildPlanIndex` now takes a `duplicateIds: 'throw' |
  'unresolved'` option (default `'throw'`, preserving every existing strict caller); Story 4.2's two
  new checks already selected `'unresolved'`, and `reachability.ts`'s `checkEvidenceReachability` now
  does too, so every `core/compile/` caller is total against this schema-legal shape. Its own
  `evaluatePointerReachability` already handled an unresolved step or operation gracefully as
  `unreachable`, so this was a one-line extension of infrastructure already proven correct, not a new
  design. `tests/seal/plan-index.test.ts` covers the option directly.
- **`checkOracleAlignment`'s relation-containment read as near-vacuous for a connective/quantifier
  relation, with nothing proving otherwise.** Closed by demonstration, not by redesign: the "appears
  anywhere in check" semantics are AD-3's own stated rule ("check may be stronger than the
  direction"), not an oversight, so the fix was closing the missing-fixture gap the entry actually
  named. `tests/compile/oracle-alignment.test.ts` now asserts `direction.relation` set to `for-all`,
  `all`, or `not` against a check naming only `for-any`/`existence` still throws — proving the
  containment check is not vacuous, it correctly rejects a relation that is genuinely absent even
  among several other connective/quantifier ops — alongside a positive case where the relation is
  genuinely present, nested one level down.
- **`checkQuantifierOverNonCollection` silently skipped a nested quantifier's own `@`-prefixed
  collection pointer.** Closed: it now walks with the same bound-element substitution
  `oracle-alignment.ts`'s `collectTargets` already threads for direction/check alignment (that file's
  `substitutePointer` is now exported for this reuse), so a nested quantifier's own collection
  pointer resolves to an absolute one before its declared type is checked, rather than being skipped.
  `tests/compile/expression-legality.test.ts` covers both the general substitution case and the bare
  `@/` special case.

The `in-review`/`review` status-vocabulary drift between story files' own `Status:` line and
`sprint-status.yaml`'s `development_status` field was investigated on 2026-08-24 and found to be by
design, not closed by rule change: the two fields are owned by different mechanisms for different
purposes (the story file's `Status:` is the BMad build skill's own internal routing state, which
includes the transient `in-review`; `sprint-status.yaml`'s `development_status` is a coarser
human-facing tracker that was only ever designed to distinguish in-progress/awaiting-review/done),
the same dual-vocabulary shape already normalized here for the `Status: done` /
`development_status: review` pairing, and nothing in the codebase cross-validates the two fields.

`regexMatchStepBudget` being unvalidated where `resolveCheck`/`regexMatch` consume it was
investigated on 2026-08-24 and found to be by design: `ScoringPolicy.regexMatchStepBudget`
(`core/schemas/scoring-policy.ts`) is already `z.int().min(1)`, a guard that shipped in Story 3.1
before the deferring story (3.2) was even written, forecloses the `NaN`/negative/non-integer failure
modes at the only place a `ScoringPolicy` is ever constructed, and matches this codebase's own
convention of validating numeric policy fields once at the schema boundary with no re-validation at
downstream consumers.

`evaluatePointerReachability`'s root-collection carve-out never checking a literal array index
against the declared collection's own `expectedCardinality` was closed on 2026-08-24: the carve-out
in `src/core/compile/reachability.ts` now resolves the actual `CollectionLocation` and returns
unreachable when the index is at or past its bound (`exact.count`, or `at-most`/`page-bounded`'s
`max`), the same treatment Decision 8 already gives `stdout`/`stderr`. The fix and its reasoning live
in that function's own comment, with `tests/compile/reachability.test.ts`'s new fixture 38b covering
all three `expectedCardinality` modes both in-bounds and out-of-bounds.

Story 2.3 carried three items, all closed on 2026-08-21 in the same pass a second-round peer review
found them trivially fixable rather than genuinely deferrable: `SealedEvaluatorBrief.directions`
gained `behaviors`' own `.min(1)`; `BriefDirection` gained the `export type` alias every other schema
in the file already has; and the story's own Task 2 now names the `npm run build:shareable` step
explicitly. All three fixes and their reasoning live in
`2-3-the-emitted-brief-scripting-audit.md`'s Completion Notes.

Story 2.2 carried two items, both closed on 2026-08-21 by
`spec-harden-seal-exclusion-guarantee.md`. The fixes and their reasoning live
in `spec-2-2-brief-assembly-exclusions-and-canonical-ordering.md`'s Spec
Change Log: the module-boundary guard's file list and `seal()`'s missing
runtime self-validation.

Story 2.1 carried one item, closed on 2026-08-21: `groupResolvedTargets`'s chain-collapse logic
dropped legal disjoint pairings for after-chains of four or more steps. The fix and its reasoning
live in `2-1-the-direction-prose-generator.md`'s Decision log.

The `check-docs.mjs` ROOTS gap (carried from Story 3.2) was closed on 2026-08-24: `_bmad-output/project-knowledge`
was added to `ROOTS` alongside `_bmad-output/planning-artifacts`, raising the checked-file count from 53 to 55
with no new failures.

Epic 1 itself closed with an empty ledger. Four items were carried here and all four were closed on
2026-08-20. Each one's reasoning lives with the work rather than in this file, which is a queue and not
a record:

- Shareable HTML links usable without repository access, and validation that the export is current
  and canonical: `spec-condense-readme.md`, "Follow-up hardening, closed 2026-08-20".
- Digest-path throughput over large observation and score arrays: story 1.2, Completion Notes
  decision 25. Measured, and closed with no code change.
- Amortising the generated mutant corpus: story 1.5, Review Findings. Cached, and the cost claim
  corrected by measurement.

## How to use this file

An entry belongs here only when the work cannot be done in the pass that found it and the decision
to defer is deliberate. Give it a `source_spec`, a one-line `summary`, and the `evidence` a later
reader needs to pick it up cold. When it is done, delete the entry itself; a terse pointer to where
the outcome and reasoning live (the source spec) may stay in the closure prose above, the way every
closure on record here already does it, so a later reader is not left to guess what was once open.
The rule is about the entry, not about erasing that something was once open.

- source_spec: `7-2-a-monotonic-observation-sequence-and-declared-selector-cardinality.md`
  summary: The published-schema census numbers (`CENSUS_BY_DOCUMENT`, `CENSUS_BY_KEYWORD`,
    `CENSUS_TOTAL`, and the reject-case-length counters) are hand-maintained integer literals
    duplicated across five test files, each cross-referencing the others in a comment; a shared
    derived constant would remove the duplication.
  evidence: Story 7.2's blind-hunter review layer confirmed the pattern spans
    `tests/schemas/constraint-ledger.test.ts`, `publish.test.ts`, `differential.test.ts`,
    `keyword-mutation.test.ts`, and `published-rejection.test.ts`. The pattern predates this story
    (7.1's AC 7 already followed it) and this story only extended it by one more schema change, so
    it is not this story's problem to fix, but every future schema change now has five places to
    update in lockstep and the risk compounds with each one.

- source_spec: `7-3-captured-value-matchers-and-test-data-bindings.md`
  summary: A sealed run record carries no field naming which principal the harness acted as, so
    `selectWithBindings` cannot separate two steps that differ only in the principal they bind. The
    observation-side principal label is the missing half of owed item 3's cross-user case.
  evidence: `{ principal }` matching is presence-only by construction (`src/core/score/bindings.ts`,
    `satisfiesBindings`): the contract declares a name, and the value behind it is provisioned by the
    harness at runtime, which is the whole reason the binding exists rather than a literal. So two
    steps binding `authorization` on one operation, one to `owner` and one to `other-user`, both
    return `several` against a record that exercised both — which is exactly the act-as-A-read-as-B
    shape the two critical-severity cross-user oracles need. Closing it means a new field on
    `Observation` recording the principal label the harness used, which is a third breaking
    `schemaVersion` bump this story's Boundaries exclude. The half this story owns is
    expressibility: those oracles can now be written down at all, and their steps compile and seal.

- source_spec: `7-3-captured-value-matchers-and-test-data-bindings.md`
  summary: `seal` throws a bare `TypeError` when two steps in one direction render to the same
    derived reference after full escalation. It should be a compile-time check reporting a coded
    `StructuralFailure` with an artifact path, the way every other authoring fault does.
  evidence: `renderStepReference` (`src/core/seal/derived-reference.ts`) throws a
    precondition-violation `TypeError` on a tie, and nothing at compile time predicts it, so a
    contract passing all twenty-three checks can still fail at seal time with a stack trace instead
    of a code. `tests/seal/fixtures.ts`'s `irreducibleCollisionPair` is the shape that already did
    this before owed item 3. Captured bindings widen it: two predecessors sharing one operation and
    binding nothing make two siblings capturing from them irreducible too, which is a second way to
    reach the same throw. Closing it means a compile check that runs the escalation ladder over
    each direction's own sibling set and reports a coded failure, which is new scope rather than a
    fix to what owed item 3 built.

## Deferred from: code review of 7-6-the-trial-set-reducer-and-the-ad-7-rate-vector (2026-09-02)

- source_spec: `7-6-the-trial-set-reducer-and-the-ad-7-rate-vector.md`
  summary: `reduceTrialSet`'s per-vote grouping (`TRIAL_VOTE_STATE_OF[vote.state]`) has no runtime
    guard against a state value outside the twelve `OUTCOME_STATES`; an unrecognized value falls
    through both the `invalidating` and `unvoted` checks and is silently counted as a valid vote.
  evidence: `src/core/score/reduce-trials.ts:98-105`. Unreachable today: `TrialVote['state']` is
    typed to the closed `OutcomeStateValue` union and `reduce-trials.test.ts`'s "total over the
    closed twelve" test catches `TRIAL_VOTE_STATES` drifting from `OUTCOME_STATES`. The gap is only
    a future 13th state added to `OUTCOME_STATES` without a matching `TRIAL_VOTE_STATES` entry, or a
    caller that bypasses the type system. Worth a defensive `default` branch (throw or assert) when
    the reducer is actually wired to a caller in epic 8.

- source_spec: `7-6-the-trial-set-reducer-and-the-ad-7-rate-vector.md`
  summary: `atOrAboveFloor` compares two `SEVERITY_LEVELS.indexOf` results and returns `true` when
    both `severity` and `floor` are absent from the array (`-1 >= -1`).
  evidence: `src/core/score/strength.ts:165-166`. Unreachable through any typed call site:
    `Severity` (`src/core/schemas/eval-contract.ts:37-42`) is a closed `z.enum` derived directly
    from `SEVERITY_LEVELS`, so a genuinely unknown value can only arrive via a type-system bypass or
    unvalidated external data.

- source_spec: `7-6-the-trial-set-reducer-and-the-ad-7-rate-vector.md`
  summary: `reduceTrialSet` never validates `catchThreshold` is within `[0, 1]`; an out-of-range or
    `NaN` value is silently absorbed into the majority comparison instead of failing loudly.
  evidence: `src/core/score/reduce-trials.ts:92-95,115`. `ScoringPolicy.catchThreshold` is
    schema-validated to `.min(0).max(1)`, and this story's own Boundaries forbid wiring the reducer
    into any caller until epic 8 (`stage-table.ts`'s `score` row stays `module: null`), so no
    production caller can feed it a bad value yet. Revisit when epic 8 wires a caller.

- source_spec: `7-6-the-trial-set-reducer-and-the-ad-7-rate-vector.md`
  summary: `outcomesByProbeId` builds its map with plain `Map.set`, so two `Outcome` entries sharing
    one `probeId` silently keep the last and drop the earlier one from the severity-floor scan.
  evidence: `src/core/score/strength.ts:168-177`. `Outcome` is schema-only today; grep confirms no
    production code constructs one yet (this story's own Decision 1), so the duplicate-`probeId`
    case has no live caller. Worth an explicit guard (or an `Ask First` per this story's Boundaries)
    whenever the epic 8 artifact-emission code starts building `outcomes` arrays for real.

- source_spec: `7-6-the-trial-set-reducer-and-the-ad-7-rate-vector.md`
  summary: `classStrengthOf` double-counts a probe's `exercised`/`caught` contribution if `admitted`
    ever carries the same `probeId` twice within one class.
  evidence: `src/core/score/strength.ts:75-93`. The story's own Code Map treats
    `SealedProbeSet.admitted` as already carrying "AD-7's unique qualified probe identifiers," but no
    schema or code in `src/core/` today enforces probe-id uniqueness across a corpus (no
    probe-corpus schema exists yet) — the uniqueness this function relies on is inherited from
    upstream qualification, not this story's own regression.

- source_spec: `7-6-the-trial-set-reducer-and-the-ad-7-rate-vector.md`
  summary: The severity-floor override in `compareDominance` only runs when the raw component-wise
    comparison already favors a side (`a-dominates-b`/`b-dominates-a`); when it reads `equivalent`,
    two contracts that each individually missed a different floor-or-above probe the other one
    caught (an offsetting pattern across two classes) still resolve to `equivalent`, not
    `incomparable`.
  evidence: `src/core/score/strength.ts:211-230`. Matches the frozen spec exactly: Decision 9
    explicitly scopes the override to "if the raw comparison reads a-dominates-b" and the Design
    Notes text presumes "the side the raw comparison favoured," so this is not a defect against this
    story's own frozen text. Flagging as a live gap in AD-7's equivalence semantics for whoever next
    touches AD-7's rate vector, not a fix owed by this story.

- source_spec: `7-6-the-trial-set-reducer-and-the-ad-7-rate-vector.md`
  summary: `tests/score/fixtures/trial-set-cases.ts` has no fixture mixing an invalidating state
    (e.g. `oracle-error`) with an unvoted state (e.g. `not-applicable`) in the same trial set.
  evidence: Low value: `reduceTrialSet`'s `forEach` classifies each vote independently with no
    shared mutable state between the `invalidating` and `unvoted` branches, so there is no plausible
    interaction bug a mixed fixture would catch that the existing per-state-group fixtures don't
    already cover individually.

## Deferred from: code review of 7-7-mode-separation-with-two-input-types-and-two-generated-ladders (2026-09-02)

- source_spec: `7-7-mode-separation-with-two-input-types-and-two-generated-ladders.md`
  summary: Nothing schema-enforces that `mode` appears in an `EvidenceArtifact`'s
    `callerAttestedInputs`, even though `mode` (unlike the other four `ScoringVersionInputs` fields)
    can only ever be caller-supplied and never re-derived by `score`.
  evidence: `evidence-artifact.ts`'s own field description for `ScoringVersionInputs.mode` says it is
    "read from the sealed run record, never re-derived," which makes omitting `mode` from
    `callerAttestedInputs` always a misdeclaration under AD-32, not a possible-but-unusual one. No
    reject case in `artifact-reject-cases.ts` exercises that omission. This is not new laxity this
    story introduced: none of the other four `ScoringVersionInputs` fields are schema-enforced to
    appear in `callerAttestedInputs` either, so fixing only `mode` would be inconsistent with the
    other four. A focused pass across all five fields (which ones are structurally always
    caller-attested vs. optionally computed by `score`, and enforcing the always-caller-attested ones)
    is the right shape for closing this, not a one-field patch.

- source_spec: `_bmad-output/implementation-artifacts/7-10-the-epics-disclosed-breaks-and-the-non-comparability-statement.md`
  summary: The regenerated spike worked example stamps `schemaVersion: 1` on a contract re-authored whole against the schema at 3, and that stale stamp propagates into the one scoring identity the repository publishes.
  evidence: `scripts/worked-example-target.ts:221` hardcodes `schemaVersion: 1` directly under a comment stating the contract was "Authored whole against the current `EvalContract`, not patched", and the committed `spike-worked-example/eval-contract.json` carries five `cardinality` occurrences plus `testData.principals`/`testData.resources`, so it is a version-3-shaped document wearing a version-1 stamp. `:1389` feeds `contractSchemaVersion: contract.schemaVersion` into `scoringVersionInputs`, so `spike-worked-example/evidence-artifact.json` publishes `"contractSchemaVersion": 1` against an eval contract the same release discloses at 3. `check:worked-example` cannot catch it: it rebuilds through the same builder and compares the committed `1` against the same hardcoded `1`. No per-artifact current-version constant exists anywhere in `src/`, `scripts/`, or `tests/` to compare a stamp against. This is Story 7.9's artifact, already merged, and Story 7.10's frozen Never forbids touching it.

- source_spec: `_bmad-output/implementation-artifacts/7-10-the-epics-disclosed-breaks-and-the-non-comparability-statement.md`
  summary: Every eval contract in the shipped dev corpus carries `schemaVersion: 1` against an eval-contract schema at 3.
  evidence: All 19 files under `corpus/dev/contracts/` and `corpus/dev/compile-seal-example/contract.json` carry `schemaVersion: 1`, while the sibling `compile-seal-example/brief.json` carries `2`. `package.json`'s `files` ships `corpus`, and `CHANGELOG.md`'s `[0.1.0]` section names the dev corpus as caller-facing, so these are published artifacts whose stamps disagree with the schema the same tarball ships. They parse only because nothing compares the number, which is the property Story 7.10's disclosure documents. Correcting the stamps means regenerating the corpus, which is outside a documentation-only story.

- source_spec: `_bmad-output/implementation-artifacts/7-10-the-epics-disclosed-breaks-and-the-non-comparability-statement.md`
  summary: AD-11's enumerated disclosure surface is hand-maintained with no gate, unlike every comparable spine table, so it drifts silently.
  evidence: `npm run validate` runs `check:ad5-registry`, `check:ad28-registry`, `check:ad31-table`, `check:ad33-table`, and `check:ad21-table`, each pinning spine text against code. `scripts/spine-lint/lint_spine.py` contains no rule mentioning AD-11 or disclosure; its rules are uncoded prohibitions and dangling declaration citations. The drift is not hypothetical: Story 7.10 found and corrected it by hand after the probe schema and the scoring policy had been missing from the list for nine spine revisions. A checker deriving the list from `INTERCHANGE_ARTIFACTS`' `carriesLineage: true` entries would close it.

- source_spec: `_bmad-output/implementation-artifacts/7-10-the-epics-disclosed-breaks-and-the-non-comparability-statement.md`
  summary: AD-11's rule has no case for "added a required field", the reading every one of epic 7's nine breaking bumps rests on.
  evidence: The rule at `ARCHITECTURE-SPINE.md:291` offers a two-case taxonomy: "Adding an optional field is a `schemaVersion` bump recorded in the field's own description; removing or retyping is breaking." Story 7.10's disclosure classifies nine required-field additions as breaking by reading them as a retyping of the shape, which is correct but is a derivation the spine never states. The next reader re-derives it from scratch. One clause in that sentence closes it, but Story 7.10's frozen Never permits editing only the enumerated-surface sentence on that line.
