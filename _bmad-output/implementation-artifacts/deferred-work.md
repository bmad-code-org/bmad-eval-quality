# Deferred work

Eighteen items are open, listed under "How to use this file" and in the per-review sections
following it. The prose immediately below records how each past item closed. Epic 7's reviews
filed fifteen; this file's own closure narrative below accounts for the other four. Story 8.2's
review closed one Story-8.1-routed item (the operationId collision) and opened two of its own, a
net gain of one over the seventeen story 8.1's reviews left open. Story 8.3 closed both of Story
8.2's own routed items (`checkModeAgreement` now called for real, `ScoredOutcomesAndVerdict`
widened) and closed the comparator half of the private-artifact-manifest entry Story 8.1's review
opened, reassigning that entry's port-awaiting half and the coupled `isolationManifestArtifact`
entry to story 8.4 -- a net loss of two, and its own review opened one (the `qualifiedProbe` fixture's
schema-invalid `probeId`), a net loss of one over the story's own start.

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
`7-10-the-epics-disclosed-breaks-and-the-non-comparability-statement.md`'s review record.

The other four items Story 7.10 opened all closed the same week, once epic 7's own stories were
done and a dedicated cleanup pass could touch what a documentation-only story's frozen Never
clause could not.

The two stale-stamp items closed by code, not by argument: `scripts/worked-example-target.ts`'s
`AUTHORED_CONTRACT.schemaVersion` moved from `1` to `3`, matching the shape it was already
re-authored against, and `spike-worked-example/`'s five files were regenerated
(`npm run generate:worked-example`), correcting the `contractSchemaVersion: 1` the published
evidence artifact carried against an eval contract the same release discloses at 3. The dev-corpus
stamp traced to one line: `tests/coverage/fixtures/satisfaction-contracts.ts`'s seed literal, which
every one of the nineteen corpus contracts spreads from, so a single-line fix and a
`npm run generate:dev-corpus` regeneration corrected all nineteen files plus the compiled-and-sealed
example at once. Closing it required first fixing `scripts/dev-corpus-target.ts`'s
`assertLineageRoot`, which had hard-required `schemaVersion === 1` as part of what makes a contract
a lineage root: a stale assumption from when every schema was still at version 1, and a
misattribution to AD-29, whose actual Rule text (`ARCHITECTURE-SPINE.md:439`) governs only
`parentDigest` and `revisionCount`. The guard now checks AD-29's own pair alone; verified still live
against a mutated `revisionCount` and a set `parentDigest`, and correctly silent against a
`schemaVersion` other than 1. A sweep for the same pattern (an `EvalContract` literal already
shaped to the current schema but still stamped 1) found three more unshipped test fixtures
(`tests/schemas/fixtures/relevance-contracts.ts`'s `absentContract`, which
`explicitlyEmptyContract` spreads, `tests/schemas/fixtures/gate-c-contract.ts`, and
`tests/preflight/fixtures/observations.ts`'s preflight contract) and corrected all three in the same
pass, though none of them ships or is asserted against a version anywhere, so their staleness was
cosmetic rather than a caller-facing break. The sweep is complete: the only `schemaVersion: 1`
literals left in the repository are the five artifacts genuinely still at version 1 (the rubric, the
isolation manifest, the evaluator configuration, the private artifact manifest, and the pre-flight
verdict) and `worked-example-artifacts.ts`'s deliberately frozen pre-regeneration transcriptions.

Five literals carried the stale stamp, and the arithmetic is worth stating plainly because the
pattern kept recurring: two generator seeds that reach published bytes
(`scripts/worked-example-target.ts`'s `AUTHORED_CONTRACT` and
`tests/coverage/fixtures/satisfaction-contracts.ts`'s seed, the second of which the whole dev corpus
spreads from) and three unshipped fixtures found by the sweep above. Before any of those, the
committed `spike-worked-example/eval-contract.json` carried it too, since Story 7.9 re-authored that
contract whole against the current schema and re-stamped it `1` in the same pass; it is the output
of the first seed and was corrected with it. Every copy was found by hand, across three separate
passes.

The mechanism that let it happen is now closed. `tests/schemas/eval-contract-version.test.ts` pins
the eval contract's current version in one place and asserts every authored literal, every member of
`CORPUS_CONTRACTS`, every contract `buildDevCorpus` emits, and the worked example's own contract
against it. Verified by reverting the corpus seed to `1`, which reddens twenty-one of its
twenty-eight cases and names the seed and every corpus member, and by reverting the worked example's
constant, which reddens the emitted-chain case alone. This is the check `check:corpus` and
`check:worked-example` cannot be: both rebuild through the same literal they compare the commit
against, so a wrong stamp and its check agree with each other, while the expected value here is
written down once and nowhere else. It is also the shape every other lineage-bearing artifact already
has, since `artifact-fixtures.ts` calls each of its fixtures "the only place a ... version number is
written down, which is what makes each bump visible"; the eval contract was the one artifact with
seven such places and no pin. An earlier draft of this entry argued that closing this needed a
per-artifact current-version registry and that a registry contradicts
`src/core/schemas/eval-contract.ts`'s published statement that no reader in this version declares an
expected version constant. That statement is about ingest-side readers, and a test-side pin is not
one, so the argument did not reach as far as it was asked to. Nothing about the shipped reader
changed.

A fourth published copy of the same value turned up in review, outside `corpus/`, and the branch's
own claim that "the only corpus bytes to move are the twenty stamps and the digests over them" was
therefore one artifact short. `docs/tutorials/getting-started.md` publishes the example brief's
`contractDigest` as the output of a `seal` command and then tells the reader the repository ships
the brief that command produces, so a user following the page saw a digest the package no longer
emits. It had been stale since epic 7 story 2 and went stale a third time here. Neither doc gate
catches it: `check:docs` does not scan `docs/`, and `check-doc-invocations.mjs` runs each documented
command but never compares its output to the fenced block beside it. The value is corrected, and
`tests/architecture/dev-corpus.test.ts`'s case 162, which already recomputes `seal(compile(contract))`
and compares it to the shipped brief, now also asserts the tutorial carries that brief's digest.
Verified by restoring the stale value, which reddens the case.

The two remaining Story 7.10 items closed by argument, not by code, because both are spine-text
completeness gaps rather than defects: nothing reads wrong today, and both would need someone to
write new normative architecture text. This repository has no epic retrospectives, and the practice
it does record points the other way: `epic-7-context.md:45` says an ambiguity found mid-story is
settled by construction in that story rather than escalated into a new spine revision. Neither of
these two is such an ambiguity. Each is a proposal to add a rule the spine does not currently make,
which is the one thing that guidance does not cover and the one thing an incidental finding from an
unrelated story is worst placed to decide. AD-11's enumerated disclosure surface having no automated
drift check is real and Story 7.10 found it by hand, but the fix is a new checker script deriving the
list from `INTERCHANGE_ARTIFACTS`, which is new tooling scope disproportionate to what surfaced it,
not a correction to anything currently wrong. AD-11's rule text having no explicit "added a required
field is breaking" case is also real and the reading Story 7.10 used is correct, cited, and now
published in `CHANGELOG.md`; writing that case into AD-11's Rule paragraph itself, rather than into
its disclosure-surface sentence (which Story 7.10 was already authorized to edit), is a change to
the architecture's own normative text, and stays a recorded observation rather than a spine edit no
single story's incidental finding should make alone.

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

## Deferred from: story review of 8-1-the-ingest-stage-and-the-conditions-it-records (2026-09-03)

Two cross-artifact rules name `core/ingest` in a shipped schema comment and cannot be computed
from the three artifacts `STAGE_SIGNATURES.ingest` declares. They are routed here with owners
during story creation rather than after implementation, because two peer reviews of the draft found
the story silently assuming inputs the stage row does not carry. A third, the operationId collision,
closed the same way it was filed: `score.ts` (story 8.2, which declares `eval-contract`) now carries
the `operation-identifier-collision` Invalid row, resolving each observation's `operationId` against
`contract.permittedInterfaces[*].operations[*].operationId` directly rather than through
`qualification.ts`, which resolves a signature to its home operation and had no comparable use here.

- source_spec: `8-1-the-ingest-stage-and-the-conditions-it-records.md`
  summary: AD-17's rule that a scored criterion is one the cited rubric declares, and that a
    conforming record shows one judge call scoring all named criteria, has no owner in any stage row.
  evidence: `src/core/schemas/sealed-run-record.ts:222-227` defers both to ingest. The record-decidable
    half (`JudgeResult.score === null`, the shape AD-6's `judge-error` fires on) lands in story 8.1.
    The rubric half needs the rubric artifact, and no row in `STAGE_SIGNATURES` declares `rubric` as
    an input at all; `ARTIFACT_PRODUCERS` gives it to `caller` and nothing consumes it. Recorded with
    no owner deliberately: assigning it to a story that cannot satisfy it is how a rule ships
    unenforced. Settling it means either widening a stage row or accepting the gap in writing.

- source_spec: `8-1-the-ingest-stage-and-the-conditions-it-records.md`
  summary: `src/core/schemas/private-artifact-manifest.ts:31-34` says a digest mismatch "is an AD-28
    `digest-mismatch` fault at ingest", and nothing calls the comparator that checks it.
  evidence: The pure half closed already: `checkPrivateArtifactManifestDigests`
    (`src/core/emit/private-artifact-digest.ts`) takes a manifest and an already-resolved
    `(privateRef -> digest)` map and throws on the first disagreement. What remains is the half that
    resolves that map. AD-8's own subject is "the core recomputes every per-artifact digest from the
    resolved bytes"; resolving a `privateRef` needs `CorpusPort.resolve`, an async port method, and
    AD-34 says `application/` "holds no decision logic" and is only where a port is awaited, so the
    comparator stays a pure `core/` function called by whichever `application/` code awaits the
    port. `src/ports/corpus-port.ts` and `src/adapters/local-corpus-adapter.ts` both already exist,
    so this is buildable once a story reaches it. Owner: story 8.4.

## Deferred from: code review of 8-1-the-ingest-stage-and-the-conditions-it-records (2026-09-03)

Three items the four review sessions raised against the implemented stage. Each was checked for
buildability from the three artifacts `STAGE_SIGNATURES.ingest` declares before being routed; the
rest of the review's findings were closed in the same pass.

- source_spec: `8-1-the-ingest-stage-and-the-conditions-it-records.md`
  summary: `IsolationManifest.violation` is `z.string().nullable()` with no `.min(1)`, so an empty
    violation string parses, invalidates the run, and renders a basis entry that names nothing.
  evidence: `src/core/schemas/isolation-manifest.ts:111-116` says "a non-null violation invalidates
    it", so `core/ingest` cannot treat `''` as no violation without contradicting the field it
    implements. `observedMounts`, `observedNetworkTargets`, and `observedToolCalls` are
    `z.array(z.string())` with no element minimum either, so `['']` outside an allowlist renders
    `mount outside allowlist: ` with nothing after the colon. The precedent for the fix is
    `QuotedEvidence.quote` (`src/core/schemas/sealed-run-record.ts:27-34`), which carries `.min(1)`
    with the argument spelled out: "an empty quotation quotes nothing, no AD-5 code names the
    condition, and under the admit-rule's second clause the schema is therefore the enforcement
    point." Tightening a shipped field is breaking under AD-11 and needs a `schemaVersion` bump,
    which epic 8 states it makes nowhere, so no story in this epic can close it. Recorded with no
    owner, on the same reasoning as AD-17's rubric half: naming a story that cannot satisfy it is
    how a rule ships unenforced.

- source_spec: `8-1-the-ingest-stage-and-the-conditions-it-records.md`
  summary: `IsolationManifest.contractId`'s description promises a match `core/ingest` has no second
    operand for.
  evidence: `src/core/schemas/isolation-manifest.ts:80-82` reads "the manifest keeps an identifier
    because it is the artifact `core/ingest` matches against a run; the run record and the probe pin
    what they describe by digest instead." The sealed run record carries no `contractId`, so the
    only artifact that could supply the second operand is the eval contract, which is not among
    ingest's declared inputs. `AGREEMENT_FIELDS` compares `runId`, `contractDigest`, and
    `evaluatorConfigurationDigest`, which is the match the two artifacts can actually support.
    Owner was recorded as story 8.2, on the assumption its stage row would pair `eval-contract`
    with the isolation manifest; it does not. `STAGE_SIGNATURES.score.inputs` is `eval-contract,
    validated-observations, probe, preflight-verdict, scoring-policy` (`src/core/lineage/
    stage-table.ts:115-122`), never `isolation-manifest`, so `score.ts` has no manifest to compare
    the contract against either. No currently-declared stage row pairs the two artifacts. Recorded
    with no owner, on the same reasoning as AD-17's rubric half and the empty-violation-string
    entry above: naming a story that cannot satisfy it is how a rule ships unenforced. Settling it
    means either widening a stage row to carry both artifacts or correcting the manifest's own
    description to name the digest match `AGREEMENT_FIELDS` actually supports.

- source_spec: `8-1-the-ingest-stage-and-the-conditions-it-records.md`
  summary: Nothing checks that the isolation manifest handed to ingest is the artifact
    `SealedRunRecord.isolationManifestArtifact` points at.
  evidence: `ArtifactReference` carries a `digest` on both branches
    (`src/core/schemas/artifact-reference.ts`), so the operand is on the record and the artifact is a
    declared input, which is what made the evaluator configuration's recomputation buildable inside
    story 8.1. This one is not the same case: no schema description names `core/ingest` as its
    enforcement point, and AD-8's subject is "the core recomputes every per-artifact digest from the
    resolved bytes", so the reference's digest is over stored bytes while `digestArtifact` over a
    parsed object is a canonical-form digest. Comparing the two is only sound once the bytes are
    resolved through the corpus port. Owner: story 8.4, alongside the private-artifact-manifest
    entry's own port-awaiting half above; the same story settles both together.

## Deferred from: story review of 8-2-the-score-stage-over-a-trial-set (2026-09-03)

- source_spec: `8-2-the-score-stage-over-a-trial-set.md`
  summary: `score.ts` never checks whether the same observation, finding, or oracle-disposition
    identifier is reused across two *different* trials in one trial set, only within one trial's own
    record.
  evidence: `ingest`'s own `duplicate-record-identifier` condition (`ingest.ts`) is computed per
    single sealed run record, since `ingest` sees one trial at a time. `score.ts` pools `findings`,
    `allOutcomes`, `unwitnessedQuotations`, and `isolationViolation` across every trial in the set
    (`score.ts`'s `trials.flatMap(...)` calls) with no cross-trial identifier check, even though this
    story treats a comparable cross-trial disagreement -- `mode`/`evaluatorRecommendation` -- as
    worth its own new Invalid row (`trial-set-field-disagreement`). Closing this needs the same kind
    of new row, which is new scope beyond this story's frozen Boundaries & Constraints. Owner:
    unassigned -- whichever future story next touches `score.ts`'s trial-set handling.

## Deferred from: story review of 8-3-the-emit-stage-and-the-evidence-artifact-it-mints (2026-09-03)

- source_spec: `8-3-the-emit-stage-and-the-evidence-artifact-it-mints.md`
  summary: `tests/score/fixtures/probe-witness.ts`'s shared `qualifiedProbe` fixture carries a
    `probeId` ("PX-001") that does not match `ProbeId`'s own schema shape (`^P-[0-9]{3,}$`).
  evidence: No suite before this story ever parsed `qualifiedProbe` through a Zod schema that
    touches `probeId`, so the mismatch stayed latent. `tests/emit/emit.test.ts` is the first to parse
    a result through `EvidenceArtifact` (the I/O Matrix's "artifact parses" clause) built from this
    probe, and it works around the mismatch with a locally schema-valid override rather than fixing
    the shared fixture, leaving the landmine for the next suite that parses through a schema touching
    `probeId`. Owner: unassigned -- whichever future story next builds a schema-parsing test on top
    of `qualifiedProbe`.
