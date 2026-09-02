---
title: 'Mode separation with two input types and two generated ladders'
type: 'feature'
created: '2026-09-02'
status: 'done'
baseline_commit: '58410ca76ff9d2b9b415c5a4eaef6aba004b1283'
review_loop_iteration: 1
context: [
  '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md',
  '{project-root}/_bmad-output/implementation-artifacts/epic-7-context.md',
  '{project-root}/_bmad-output/implementation-artifacts/7-1-the-run-mode-source-and-the-sealed-run-records-mode-field.md',
  '{project-root}/_bmad-output/implementation-artifacts/7-2-a-monotonic-observation-sequence-and-declared-selector-cardinality.md',
  '{project-root}/_bmad-output/implementation-artifacts/7-4-the-ad-40-defect-signature-corpus-qualification-and-the-witness-match.md',
  '{project-root}/_bmad-output/implementation-artifacts/7-5-ad-33-as-a-total-reference-decision-procedure-with-generated-fixtures.md',
]
---

# Story 7.7: Mode separation with two input types and two generated ladders

Epic 7, story key `7-7-mode-separation-with-two-input-types-and-two-generated-ladders`. Closes owed
item 4, "mode separation is incomplete" (`ARCHITECTURE-SPINE.md:707-716`), and builds AD-21's verdict
ladder for the first time: today only its exit-code tail exists (`src/cli/exit-codes.ts`), and
`EvidenceArtifact` already keeps `productionVerdict`/`contractVerdict` on separate discriminated-union
branches, but nothing derives either verdict from outcome, evidence, and coverage state. Schema change:
`ScoringVersionInputs` gains one required field, `mode`, a BREAKING `evidence-artifact.ts` `schemaVersion`
bump from 1 to 2.

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** AD-21's rungs are stated only as a single production-mode ladder with two clauses that
promote an ingested evaluator recommendation, which contradicts the same rule's contract-scoring
paragraph; no code derives a verdict at all yet, mode is absent from AD-11's identity, and nothing
rejects a `production` run record paired with a `contract-scoring` evidence artifact.

**Approach:** Give production and contract-scoring their own input type and their own pure, total,
first-match-wins ladder function, each over the same seven state categories AD-21 names; add `mode` as
`ScoringVersionInputs`'s sixth field; add the one AD-32 check that rejects mode disagreement between a
sealed run record and an evidence artifact in both directions; wire Story 7.2's selector-ambiguity,
Story 7.4's `unwitnessed-claim`, and Story 7.4's own separately-assigned unwitnessed-quotation audit
(`auditQuotation`) into the Invalid rung — three conditions, not two; generate the rung table the way
AD-33's table is already generated.

## Boundaries & Constraints

**Always:**
- `SCORING_VERSION_INPUT_NAMES` (`evidence-artifact.ts:83-89`) gains `'mode'` as a sixth entry;
  `ScoringVersionInputs` gains `mode: RunMode` (imported from `sealed-run-record.ts`, already imported
  there as `OracleDispositionValue`). The pinned-at-five test
  (`tests/schemas/artifacts.test.ts:451-454`) moves to six; `callerAttestedInputs`'s enum widens for
  free since it is `z.array(ScoringVersionInputName)`. Add `'mode'` to the fixture's
  `callerAttestedInputs` array (`tests/schemas/fixtures/artifact-fixtures.ts:725-729`): a caller-supplied
  mode is caller-attested under AD-32, the same reasoning the other three members already carry.
- Two new input types, `ProductionAssessment` and `ContractAssessment`, each carrying a literal `mode`
  discriminant (`'production'` / `'contract-scoring'`, mirroring `EvidenceArtifact`'s own union) so the
  two types are nominally distinct rather than structurally compatible in one direction only — a bare
  duck-typed pair lets a `ContractAssessment` value satisfy `ProductionAssessment`'s required fields
  under TS's structural typing, which the discriminant closes. Both carry the seven category values
  AD-21 derives from: **outcome state** — a composite the assembler builds, not a plain `Outcome[]`
  read off a persisted artifact, since the three new Invalid conditions below each need per-condition
  detail a bare `OutcomeState` enum value cannot carry: it bundles the per-oracle `OutcomeResolution[]`
  (`outcome.ts:120-131`, whose `invalidatingConditions` already names `selector-ambiguity` and
  `unwitnessed-detection-claim`), the record-level `auditQuotation` result
  (`quotation.ts:126`, `UnwitnessedQuotation[]`), and `Trials` (`evidence-artifact.ts:120-124`) alongside
  the scoring policy's `reExecutionCap` for the re-execution-cap-breach condition (see Design Notes for
  why this is not the `Remediation` cap); **evidence-integrity state** (`EvidenceDisclosure` plus the
  isolation manifest's `violation` and the lineage-chain conjunction — see Design Notes); **evaluator
  recommendation**; **coverage condition** (`coverageGaps: readonly CoverageGap[]`); **waiver state**;
  **remediation state** (the existing `Remediation` shape's `lineageChain` conjunction only — AD-12's
  contract-revision cap, not AD-6's re-execution cap); and **pre-flight state**
  (`PreflightVerdict.passed`). `ContractAssessment` additionally carries
  `systemRecommendationRecorded`/`systemRecommendationNote` matching `EvidenceArtifact`'s
  contract-scoring branch.
- Two pure functions, `resolveProductionVerdict` and `resolveContractVerdict`, each first-match-wins
  over an ordered rule table (module-level array, mirroring `outcome.ts`'s `INVALIDATING_CONDITIONS`
  and `OUTCOME_RULES` shape) with PASS as an explicit final rung, never an `otherwise`/`default` branch.
  Invalid is identical between the two ladders (AD-21's text carries no mode split for it) and includes,
  by name, three conditions this epic's own stories create and none of AD-21's spine prose names by
  string: Story 7.2's selector-ambiguity, Story 7.4's `unwitnessed-claim`, and Story 7.4's separately
  assigned unwitnessed-quotation audit (`ARCHITECTURE-SPINE.md`'s AD-32 declared-versus-observed
  inconsistency, per `7-4-...md:681-698`'s own instruction that "Story 7.7 must ... register a third
  Invalid-rung condition") — closing the enumerated list all three stories left open. AD-21's own
  "unrecognised evaluator recommendation value" clause is omitted from the rule table with a one-line
  comment citing `verdict.ts:22-25`: a schema-valid `EvaluatorRecommendation` cannot carry an
  unrecognised value, so the case is unreachable before either ladder runs.
- Contract-scoring's FAIL/CONCERNS/WAIVED/PASS rungs mirror production's minus every clause that
  promotes `evaluatorRecommendation`: AD-21 states the contract-scoring recommendation "is recorded as
  an input rather than promoted to a rung." The field is still present on `ContractAssessment` for
  symmetry and for `systemRecommendationRecorded`, but no contract-scoring rule guard reads it.
- A new function rejects, in both directions, a sealed run record's `mode` disagreeing with the
  evidence artifact's `mode` discriminant, as an AD-32 cross-artifact disagreement — the same shape as
  the existing `evaluatorConfigurationDigest` agreement note at `isolation-manifest.ts:92-93`: a
  hand-written check at the assembly boundary, not a schema refinement, since no single schema sees
  both artifacts.
- Every resolution records: `verdictBasis` entries (existing free-text field) naming each condition
  that fired, an `exitCode` from the closed set (PASS/WAIVED/CONCERNS 0, FAIL 2, invalid 3), and a
  `strictPromotable: boolean` that is `false` for a CONCERNS whose only firing conditions are the two
  evidence conditions (thin measurement: fewer trials than declared minimum, any oracle `unreached`) —
  matching `cli/exit-codes.ts:32-48`'s existing `evidenceConditionsOnly` semantics, which this story's
  data must agree with rather than re-derive independently.
- Generated table: one pure builder module producing Markdown from both rule tables plus fixtures
  covering every rung at least once (mirroring `outcome-table.ts`'s throw-on-empty-cell census), one
  `generate`/`check` script pair mirroring `scripts/generate-ad33-table.ts` and
  `scripts/check-ad33-table.ts` byte-for-byte in structure, writing
  `docs/ad21-verdict-decision.generated.md`, wired into `package.json`'s `validate` beside
  `check:ad33-table`.
- `evidence-artifact.ts`'s `schemaVersion` bumps 1 → 2 (BREAKING under AD-11: the new field is
  required); `npm run generate:schemas` regenerates `schemas/evidence-artifact.schema.json`; AD-13's
  four checks (rejection fixtures, `check:schemas` drift, differential, keyword-mutation) all pass,
  following Story 7.1's template for a required-field bump.
- AD-11's rule text (`ARCHITECTURE-SPINE.md:291`) names five inputs and predates this story; this
  story's own text states plainly that adding `mode` as a sixth field is owed item 4's "mode ...
  entering identity" landing exactly where the epic preamble said it would, and is the supersession the
  spine asked for rather than an undocumented drift from AD-11's five-field sentence.

**Ask First:** none anticipated. Settle any further ambiguity by construction in this story's own
decisions section rather than escalating it.

**Never:**
- No file under `src/cli/` changes. This story records each rung's own `strictPromotable` boolean; it
  does not wire `--strict` promotion, which `exit-codes.ts` already does against a `Verdict` it is
  handed.
- No `score` or `emit` module. Both stay `module: null` in `src/core/lineage/stage-table.ts`; the two
  ladder functions and the mode-agreement check are built and tested but not wired to a caller, the
  same unwired-until-epic-8 posture Story 7.6's reducer took.
- No uncited-finding rung. Story 7.8 adds that rung to both generated tables; this story's tables do
  not name it.
- No worked-chain regeneration. Story 7.9's job.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Mode agreement | run record `mode: 'production'`, artifact `mode: 'contract-scoring'` | rejected as AD-32 disagreement | rejected the same way in the reverse pairing |
| Selector ambiguity | `ProductionAssessment`/`ContractAssessment` built from an outcome set carrying Story 7.2's ambiguity condition | Invalid, `verdictBasis` names the condition | N/A |
| Unwitnessed claim | outcome set carrying Story 7.4's `unwitnessed-claim` | Invalid, `verdictBasis` names the condition | N/A |
| Unwitnessed quotation | `auditQuotation` returns a non-empty `UnwitnessedQuotation[]` for the record, no other Invalid condition fires | Invalid, `verdictBasis` names the condition | N/A |
| Evidence-conditions-only CONCERNS | fewer trials than declared minimum, no other condition fires | CONCERNS, `strictPromotable: false` | N/A |
| Contract-scoring recommendation | `evaluatorRecommendation: 'FAIL'`, no other rung condition fires | contract ladder still resolves PASS/WAIVED/CONCERNS on its own conditions; recommendation never selects the rung | N/A |
| Total coverage | every rung of both ladders | generated table's fixture set exercises each rung at least once | builder throws on any zero-count rung |

</frozen-after-approval>

## Code Map

**Read-only evidence:**
- `src/core/schemas/evidence-artifact.ts:83-99` -- `SCORING_VERSION_INPUT_NAMES`, `ScoringVersionInputs`; `:307-336` -- `EvidenceArtifact` discriminated union on `mode`, already separating `productionVerdict`/`contractVerdict`, and its own description already names this story's remaining scope verbatim.
- `tests/schemas/artifacts.test.ts:450-462` -- the five-field pin to move to six.
- `tests/schemas/fixtures/artifact-fixtures.ts:707-732` -- `evidenceCommon` fixture: `scoringVersionInputs` (add `mode`), `callerAttestedInputs` (add `'mode'`), `schemaVersion: 1` (bump to 2).
- `src/core/schemas/sealed-run-record.ts:278-282` -- `RUN_MODES`, `RunModeValue`, `RunMode`; `:299-301` -- `mode: RunMode` field, description confirms mode is fixed before ingest and never re-derived; `:253-266` -- `EvidenceDisclosure` (`truncationBound`, `reportedIncomplete`), explicitly the two of AD-21's four evidence-integrity conditions that are caller-declared; the other two (unavailable, internally inconsistent) are cross-artifact.
- `src/core/schemas/isolation-manifest.ts:111-115` -- `violation` field, nullable, non-null invalidates: this is AD-21's "unaccounted isolation manifest under AD-16" condition.
- `src/core/schemas/scoring-policy.ts:43` -- `reExecutionCap` (default 2), which AD-21's "re-execution cap breach under AD-6" reads against `Trials.invalidatedAttempts.length` (`evidence-artifact.ts:120-124`) -- NOT `Remediation.cap`, which is AD-12's contract-revision cap (`evidence-artifact.ts:246-248`'s own JSDoc: "NOT AD-29's lineage `revisionCount`"); the two caps are unrelated mechanisms `ARCHITECTURE-SPINE.md:259` and `:71-72` of `chain.ts` each confirm independently.
- `src/core/lineage/chain.ts:59-65,282` -- `LineageChainReport.passed`/`checks`, confirming `Remediation.lineageChain`'s three booleans are the ones the FAIL rung's "internally inconsistent lineage chain under AD-12" reads; `Remediation.cap` itself is not part of any Invalid condition in this story.
- `src/core/score/quotation.ts:126-` -- `auditQuotation(record): readonly UnwitnessedQuotation[]`, AD-32's declared-versus-observed check over quoted evidence, shipped with no caller by design (`ingest` has `module: null`); `_bmad-output/implementation-artifacts/7-4-...md:681-698` -- the decision assigning this story a third Invalid-rung condition, "an unwitnessed quotation," which neither `epics.md`'s own AC text nor this story's first draft named.
- `src/core/schemas/preflight-verdict.ts:37-51` -- `PreflightVerdict.passed`.
- `src/core/schemas/verdict.ts:1-30` -- `VERDICTS`, `Verdict`, `EVALUATOR_RECOMMENDATIONS`, `EvaluatorRecommendation`.
- `src/core/score/outcome.ts:102-131` -- `OutcomeInputs`/`OutcomeResolution` shape; `:221-275` -- `INVALIDATING_CONDITIONS` (Stage A, ten conditions unioned), including `unwitnessed-detection-claim` (`:242-246`) and `selector-ambiguity` (`:252-257`) -- both already routed to the AD-6 `infrastructure-error` state at Stage B (`:385-432`), but AD-21's own enumerated Invalid-rung list has never named them until this story.
- `src/core/score/outcome-table.ts` (full file) -- the generated-table builder pattern to mirror: Markdown from rule-table arrays, throws on a zero-count census cell.
- `scripts/ad33-table-target.ts`, `scripts/generate-ad33-table.ts`, `scripts/check-ad33-table.ts` -- the exact three-file convention (target constants, writer, byte-exact drift checker) this story's AD-21 equivalents copy.
- `src/cli/exit-codes.ts:1-70` -- `exitCodeFor`/`verdictExit`, the closed exit-code set and the existing `--strict`-never-promotes-evidence-conditions-only rule this story's `strictPromotable` data must agree with. Not modified.
- `package.json:88-91,106` -- `generate:ad33-table`/`check:ad33-table` script names and their place in `validate`, the naming convention this story's `ad21` pair follows.
- `ARCHITECTURE-SPINE.md:364-370` -- AD-21's full rule text, the only source for each rung's exact firing conditions. `:287-292` -- AD-11's five-field sentence, the one owed item 4 supersedes.
- `_bmad-output/implementation-artifacts/7-1-...md`, `7-2-...md`, `7-4-...md` -- each already records "wired by Story 7.7" for its own forward reference (mode field, selector-ambiguity routing, `unwitnessed-claim` routing).

**New:**
- `src/core/score/ladder.ts` -- `ProductionAssessment`, `ContractAssessment`, `LadderResolution` (`{ verdict, exitCode, strictPromotable, basis: readonly string[] }`), the two ordered rule tables, `resolveProductionVerdict`, `resolveContractVerdict`.
- `src/core/score/mode-agreement.ts` -- the AD-32 cross-mode check, both directions.
- `src/core/score/ladder-table.ts` -- the pure Markdown builder over both rule tables.
- `scripts/ad21-table-target.ts`, `scripts/generate-ad21-table.ts`, `scripts/check-ad21-table.ts`.
- `tests/score/fixtures/ladder-inputs.ts` -- deterministic fixtures covering every rung of both ladders.
- `tests/score/ladder.test.ts`, `tests/score/mode-agreement.test.ts`.

**Changed:**
- `src/core/schemas/evidence-artifact.ts` -- `mode` on `SCORING_VERSION_INPUT_NAMES`/`ScoringVersionInputs`; `schemaVersion` 1 → 2.
- `tests/schemas/artifacts.test.ts` -- five → six.
- `tests/schemas/fixtures/artifact-fixtures.ts` -- `mode` in the fixture's `scoringVersionInputs` and `callerAttestedInputs`; `schemaVersion` bump.
- `schemas/evidence-artifact.schema.json` -- regenerate via `npm run generate:schemas`.
- `package.json` -- `generate:ad21-table`/`check:ad21-table` scripts, `check:ad21-table` added to `validate`.

## Tasks & Acceptance

**Execution:**
- [x] `src/core/schemas/evidence-artifact.ts` -- add `mode` to `SCORING_VERSION_INPUT_NAMES`/`ScoringVersionInputs`, bump `schemaVersion` to 2 -- owed item 4's identity clause
- [x] `tests/schemas/fixtures/artifact-fixtures.ts` -- add `mode`, bump `schemaVersion` -- keeps fixtures parsing
- [x] `tests/schemas/artifacts.test.ts` -- five → six field-count assertion -- keeps the pin honest
- [x] `npm run generate:schemas` -- regenerate `schemas/evidence-artifact.schema.json`
- [x] `src/core/score/ladder.ts` -- `ProductionAssessment`/`ContractAssessment`, both rule tables, `resolveProductionVerdict`/`resolveContractVerdict` -- the two ladders, Invalid wired to `auditQuotation`'s result alongside Story 7.2's and 7.4's conditions
- [x] `src/core/score/mode-agreement.ts` -- the AD-32 cross-mode check
- [x] `tests/score/fixtures/ladder-inputs.ts`, `tests/score/ladder.test.ts`, `tests/score/mode-agreement.test.ts` -- prove the I/O matrix and every rung
- [x] `src/core/score/ladder-table.ts`, `scripts/ad21-table-target.ts`, `scripts/generate-ad21-table.ts`, `scripts/check-ad21-table.ts`, `package.json` -- generated table wired into `validate`

**Acceptance Criteria:**
- Given a sealed run record's mode and AD-21's incomplete separation, when the ladders run, then `ProductionAssessment` and `ContractAssessment` are separate types and mode is `ScoringVersionInputs`'s sixth field, added to `callerAttestedInputs`'s domain.
- Given a `production` run record paired with a `contract-scoring` evidence artifact, when the mode-agreement check runs, then it is rejected in both directions as an AD-32 disagreement.
- Given Story 7.2's selector ambiguity, Story 7.4's `unwitnessed-claim`, or a non-empty `auditQuotation` result (Story 7.4's separately assigned third Invalid condition), when either ladder runs, then the result is Invalid and `verdictBasis` names the condition.
- Given `Trials.invalidatedAttempts.length` exceeding the scoring policy's `reExecutionCap`, when either ladder runs, then the result is Invalid, distinct from and never conflated with `Remediation.cap`'s AD-12 contract-revision check.
- Given each ladder, when run over every declared rung, then it is total, first-match-wins, and PASS is an explicit rung rather than a fallback.
- Given the contract-scoring ladder and any `evaluatorRecommendation` value, when it resolves, then no rung selection reads that field.
- Given the generated table, when built, then every rung of both ladders carries its verdict, exit code, and `strictPromotable` value, and `npm run check:ad21-table` passes against the committed file.
- Given the evidence-artifact schema bump, when `npm run validate` runs, then AD-13's four checks and `check:ad21-table` all pass.

## Spec Change Log

- **Finding:** a peer review of this ready-for-dev spec (before any code existed) found the draft
  never wired the third Invalid condition Story 7.4 explicitly assigned to this story
  (`7-4-...md:681-698`, an unwitnessed quotation via `auditQuotation`) — epics.md's own AC text for
  7.7 only lists the two conditions from 7.2 and 7.4's witness half, and the first draft inherited that
  omission verbatim despite 7-4's story file sitting in this story's own `context:` list. **Amended:**
  Intent, both Boundaries bullets on the assessment types and the Invalid rung, the Code Map, the I/O
  matrix, Tasks, and Acceptance Criteria now name and wire the third condition. **Avoids:** shipping
  the ladders with AD-21's own enumerated Invalid list still open, which no later story (7.8 is the
  uncited-finding rung, 7.9 is worked-chain regeneration) would have closed.
- **Finding:** the same review found the draft's "re-execution cap breach under AD-6" derivation used
  `Remediation.revisionCount > Remediation.cap`, which is AD-12's contract-revision cap, not AD-6's
  re-execution cap (`ScoringPolicy.reExecutionCap`, bounding `Trials.invalidatedAttempts`) — two
  differently-scoped caps the draft's own read-only citations distinguished but its derivation
  conflated. **Amended:** Boundaries, Code Map, Design Notes, and Acceptance Criteria now derive the
  re-execution-cap-breach condition from `Trials.invalidatedAttempts.length` against
  `ScoringPolicy.reExecutionCap`, and state plainly that `Remediation.cap` governs a separate,
  already-correct FAIL condition. **Avoids:** a ladder that never actually implements AD-6's
  re-execution-cap-breach condition while silently double-counting AD-12's cap under its name.
- Two Code Map citations were also corrected against source: `sealed-run-record.ts`'s `RUN_MODES`
  triple is at lines 278-282, not 261-266 (that range is `EvidenceDisclosure.reportedIncomplete`'s
  JSDoc); `EvidenceDisclosure`'s fields are at 253-266, not 248-251 (that range is prose above the
  object).

## Design Notes

AD-21's rung text supplies exact conditions for most of the seven ladder inputs directly off existing
shapes with no new derivation: `Remediation.lineageChain`'s three booleans (already computed by
`lineage/chain.ts`) are the internally-inconsistent-lineage FAIL condition, and
`IsolationManifest.violation !== null` is the unaccounted-manifest Invalid condition. Two AD-6 rule
sentences are easy to conflate and are not the same cap: `Remediation.cap` is AD-12's contract-revision
cap, checked already by `lineage/chain.ts`'s `lineage-remediation-cap-exceeded` finding, which is folded
into the FAIL condition above via `LineageChainReport.passed`. AD-21's "re-execution cap breach under
AD-6" is a different mechanism entirely — `ScoringPolicy.reExecutionCap` bounds how many of a probe's
attempts may be invalidated and redone before the harness itself, not the contract, is the thing at
fault (`ARCHITECTURE-SPINE.md:259`: "exceeding the re-execution cap resolves under AD-21 as a statement
that the harness is unfit") — and reads `Trials.invalidatedAttempts.length > reExecutionCap`.

"Outcome state," the seventh category, is a richer composite than a bare `Outcome[]` read because all
three new Invalid conditions need per-condition detail the persisted `Outcome.state` enum alone cannot
carry (the two per-oracle ones collapse to the same `infrastructure-error` value at `outcome.ts`'s
Stage B, and the third is record-level rather than per-oracle at all). The assembler instead folds the pre-persistence `OutcomeResolution[]` (still
carrying `invalidatingConditions` by name), `Trials` plus `reExecutionCap`, and the whole-record
`auditQuotation` result into one bundle: any invalidating condition, cap breach, or unwitnessed
quotation present → Invalid contributes; any behavioural failure at or above the scoring policy's
severity floor → FAIL contributes; below the floor → CONCERNS contributes. This is the same
aggregate-from-an-array shape `strength.ts`'s `buildStrengthVector` already establishes for
`admitted: readonly QualifiedProbe[]`, extended to more than one source array.

## Decisions settled by construction

Per the epic preamble's own rule that ambiguities are settled where the work happens rather than
escalated, recorded here rather than as a new spine revision or a checkpoint.

1. **`LadderResolution.verdict` is `Verdict | null`, and `null` is the Invalid rung.** AD-21 calls
   Invalid a rung but never a verdict -- "a failed pre-flight... never becomes a contract verdict" --
   and its exit code (3) sits outside the verdict range `cli/exit-codes.ts` defines (0-2). `Verdict`'s
   four members (PASS/WAIVED/CONCERNS/FAIL) stay closed; `null` is the same "no verdict produced" shape
   `CommandOutcome`'s non-`verdict` kinds already use.
2. **Resolution is two-level: first-match-wins across five tiers (Invalid, FAIL, CONCERNS, WAIVED,
   PASS), and every row within the winning tier contributes to `basis`.** AD-21 requires both
   properties at once -- "precedence, first match wins" and "the record carries every condition that
   fired" -- which a flat first-match-wins row list (`outcome.ts`'s `OUTCOME_RULES` shape) cannot give:
   the first shows only the row that won, not every condition present. Each tier is therefore a small
   independently-evaluated row set, mirroring `outcome.ts`'s Stage A; PASS's own rung is the negation of
   every tier above being empty, never a written `otherwise`.
3. **`selector-ambiguity` and `unwitnessed-claim` are named as their own Invalid rows even though they
   already coincide with an `infrastructure-error` state and would already be caught by
   `invalidating-state`.** The spine's own Invalid prose never spells either out by name; the I/O
   matrix's "verdictBasis names the condition" is a readability requirement over the state-derived
   generic entry, not a second logically distinct firing condition. Both rows fire alongside
   `invalidating-state` on the same oracle, which is intentional duplication, not a bug.
4. **`unsupported-disposition` is not a fourth Invalid condition.** `7-5-...md`'s own "Never" section
   flags it as "a third Invalid-rung condition beyond the two `epics.md:613` already assigns to Story
   7.7," but this story's own frozen Boundaries text names exactly three new conditions --
   selector-ambiguity, unwitnessed-claim, and the unwitnessed-quotation audit -- and does not name a
   fourth. The shipped `outcome.ts` docstring above `INVALIDATING_CONDITIONS` agrees with the frozen
   text over the stale note: "`unsupported-disposition` produces no state and is not in that
   enumeration; the half enforced here is the corroboration." Followed the frozen spec and the shipped
   code over the earlier story's own superseded aside.
5. **The seven category values are realised as five typed bundles, not seven flat fields, and two
   raw booleans that have no other source.** `outcomeState` folds `OutcomeResolution[]` (paired per
   oracle with the two fields it does not carry -- `severity`, caller-owned on the persisted `Outcome`,
   and `checkResolved`, needed for the "no required check resolved" clause `OutcomeResolution` has no
   field for), `auditQuotation`'s `UnwitnessedQuotation[]`, `Trials`, and `reExecutionCap`.
   `evidenceIntegrity` folds `EvidenceDisclosure` with `isolationViolation` (AD-16, routed to Invalid)
   and three declared booleans (`overTruncated`, `unavailable`, `internallyInconsistent`) that
   `sealed-run-record.ts`'s own field description says have no field anywhere in the tree today --
   arriving declared rather than derived is the same posture `outcome.ts` gives `judgeConduct` and
   `waiver`. `remediationState` is `LineageChain` alone, never `Remediation.cap`. "Waiver state" is not
   a separate field at all: it is read directly off `OutcomeResolution.waiverRule === 'waiver-honoured'`
   within `outcomeState.outcomes`, since Stage C already decided it and a second field could only drift
   from the first.
6. **`strictPromotable` is `false` exactly when every row that fired in a winning CONCERNS tier is
   tagged `evidenceCondition: true`** (the two rows for "fewer trials than declared minimum" and "an
   oracle resolved `unreached`"), matching `cli/exit-codes.ts`'s `evidenceConditionsOnly` semantics by
   construction rather than importing it: `core/` may import only `core/schemas` (AD-1), so the number
   literals and the boolean rule are restated here, not shared.
7. **Two `export type` aliases were added beside existing `export const` schemas** --
   `evidence-artifact.ts`'s `Trials` and `sealed-run-record.ts`'s `EvidenceDisclosure` -- mirroring
   Story 7.5's `OracleDisposition` precedent: `core/score/ladder.ts` needed both shapes in a type
   position, which a bare `export const` cannot supply (`TS2749`), and a `z.infer` alias changes no
   exported byte and needs no `generate:schemas` run.
8. **`ladder-table.ts` has no dedicated test file; its coverage lives inside `ladder.test.ts`.** The
   Code Map names only `tests/score/ladder.test.ts` and `tests/score/mode-agreement.test.ts` as new test
   files, unlike Story 7.5's `outcome-table.test.ts`. Since `ladder-table.ts` sits under `src/core/`
   and is otherwise exercised only by the two scripts (run by plain `node`, invisible to `vitest`'s
   coverage instrumentation), `ladder.test.ts` carries a `describe('ladderDecisionTable', ...)` block
   proving the builder, its two guard throws, and its per-condition census throw.
9. **The nested `scoringVersionInputs.mode` field gets two new AD-13 reject fixtures**,
   `evidence-scoring-version-mode-absent` and, after the code-review round below,
   `evidence-scoring-version-mode-disagrees-with-branch`, mirroring Story 7.1's
   `record-mode-absent`/`record-mode-outside-the-two` pair one level deeper.
10. **Code review found two confirmed, in-scope findings, both fixed.** First: nothing tied
    `scoringVersionInputs.mode` to `EvidenceArtifact`'s own `mode` discriminant on the same object, so
    `productionEvidenceArtifact` parsed while disagreeing with itself. A `.refine()` per branch was
    tried first and reverted: it never exports, and the corpus-mutation generator synthesises a
    same-shape witness for the untaken `oneOf` branch straight from the published schema with no
    knowledge of a Zod-only cross-field rule -- verified empirically, it produced two dozen genuine
    `zod=false published=true` disagreements in `differential.test.ts`. The fix that actually closes
    the gap is narrowing `scoringVersionInputs.mode` per branch to a `z.literal` of that branch's own
    mode (`scoringVersionInputsFor` in `evidence-artifact.ts`) rather than the shared two-value enum:
    this exports natively as `const`, so ajv rejects the disagreement too, and the differential
    corpus's synthesised witnesses can only ever construct the one legal value. Pinned counters moved
    accordingly and were read off the actual regenerated schema and test runs rather than
    hand-computed: `ARTIFACT_REJECT_CASES` 83 -> 85, `PUBLISHED_REJECT_CASES` 138 -> 140,
    `CENSUS_BY_DOCUMENT['evidence-artifact']` 409 -> 413, `CENSUS_BY_KEYWORD['enum']` 66 -> 64,
    `CENSUS_BY_KEYWORD['const']` 64 -> 66 (`CENSUS_TOTAL` unchanged at 2451, a keyword swap not a
    count change). Second: `LADDER_EXIT_CODES` and `strictPromotable` had no test proving they still
    agree with `src/cli/exit-codes.ts`'s `EXIT_*` constants and `evidenceConditionsOnly` rule, which
    the module's own header comment claims but `core/` cannot check of itself (AD-1). `ladder.ts`
    exports `LADDER_EXIT_CODES`, and `ladder.test.ts` gained a coherence test asserting the five exit
    codes match and, for every CONCERNS-tier fixture case, that `exitCodeFor` promotes exactly when
    `strictPromotable` says to.
11. **A second, independent review round found five more confirmed findings, all fixed.**
    - **The Invalid row guarding "every required check resolved" was too narrow, and the gap was
      reachable, not theoretical.** It fired only when every required check was unresolved; but
      `outcome.ts`'s Stage B has no rule keying on `checkResolution === null` (only on the distinct
      `'insufficient-evidence'` value), so a required oracle whose check never ran at all, and which
      matches no other guard, falls through to the final `outcome-clear` row and resolves `confirmed` --
      invisible to every other Invalid/FAIL/CONCERNS row. Two required oracles, one with an unresolved
      check landing on `confirmed` and one with an honoured waiver, resolved WAIVED; the same pair with
      no waiver anywhere resolved PASS by falling through. AD-21's own text names only the two extremes
      -- zero resolved for Invalid, all resolved for WAIVED and PASS -- and leaves the middle case (some
      but not all resolved) with no named rung, which is a genuine spine-text gap rather than a
      right-or-wrong implementation choice. Invalid is the correct home for it: neither FAIL nor
      CONCERNS has a guard that fits "the check simply never ran," and granting WAIVED or PASS without
      full resolution contradicts each rung's own explicit clause. Fixed by broadening the row's guard
      from "every required check unresolved" to "not every required check resolved"
      (`some(o => !o.checkResolved)`) and renaming it `required-check-unresolved`, which closes both
      rungs' copy of the gap from the one row Invalid's higher precedence already protects. Two fixture
      cases prove it: the with-waiver variant and the pure PASS-fallthrough variant.
    - **`.github/workflows/pr-checks.yml` was never updated for `check:ad21-table`.** Added the drift
      check to both the `validate-and-build` and `floor` jobs' step lists (and to the `Validate` step's
      display name), and a `canary-ad21-table` job mirroring `canary-ad31-table`/`canary-ad33-table`:
      asserts the check fails on a mutated byte and on a renamed condition identifier, then that
      `generate:ad21-table` reproduces the committed bytes exactly.
    - **Three stale "five"-input descriptions contradicted this story's own six-input change**
      (`evidence-artifact.ts`'s `scoringVersion` and `callerAttestedInputs` descriptions,
      `scoring-policy.ts`'s digest description) two lines below a JSDoc that already said "Six now, not
      five." Corrected to six and republished via `generate:schemas`.
    - **`sealed-run-record.ts`'s own `SealedRunRecord` description was stale**, still naming mode
      entering AD-11's identity and the two assessment types as open clauses this story closes. Updated
      to match `EvidenceArtifact`'s own corrected "Owed item 4 is closed" phrasing.
    - **Boundary-value test gaps**: `re-execution-cap-breach`, `below-minimum-trial-count`, and
      `finding-confidence-below-threshold` were each tested only strictly past their threshold, never
      exactly at it, and `atOrAboveFloor`'s equality case was untested. Four new tests prove the
      `>`/`<` operators are correctly strict (the boundary itself never fires) and that severity
      equal to the floor counts as at-or-above (FAIL, not CONCERNS).

    One operational note from this round: locally simulating the `canary-ad21-table` job's GNU-`sed`
    steps on macOS, `git checkout -- <path>` against this repository's two brand-new, never-committed
    files (`src/core/score/ladder.ts`, `docs/ad21-verdict-decision.generated.md`) reset both to an
    empty staged snapshot rather than restoring their working-tree content -- some out-of-session
    process in this environment stages files periodically, and `git checkout --` for an uncommitted
    path restores from whatever the index holds, not from HEAD. `ladder.ts` was reconstructed from this
    session's own read/edit history and verified three independent ways before continuing: `tsc`
    typechecks clean, the full `tests/score/` suite (including `outcome.test.ts`'s strict per-state
    boundary scan, which greps every source file for each AD-6 state's exact quoted literal) passes
    unchanged, and `generate:ad21-table` reproduces the exact byte count (7720 bytes) last confirmed
    before the wipe. No further local `git checkout --` against an uncommitted path in this session.

## Verification

**Commands, all run and green:**
- `npm run test -- tests/score/ladder.test.ts tests/score/mode-agreement.test.ts` -- green (29 tests)
- `npm run generate:ad21-table && npm run check:ad21-table` -- fixed point, no drift (44 condition
  rows, 46 cases across both ladders, 7720 bytes)
- `npm run validate` -- green end to end: build, typecheck, lint, docs, shareable, spine lint, vectors,
  schemas, AD-5/AD-28 registries, AD-31/AD-33/AD-21 tables, layers, lineage, boundary, corpus,
  website-deps, and `test:coverage`.

## Suggested Review Order

**The two ladders**

- Entry point: the seven category values every assessment carries, and why `outcomeState` is a
  bundle rather than a bare state enum.
  [`ladder.ts:97`](../../src/core/score/ladder.ts#L97)

- The precedence engine: first-match-wins across five tiers, every row in the winning tier
  contributes to `basis`, PASS is the negation of everything above rather than an `otherwise`.
  [`ladder.ts:573`](../../src/core/score/ladder.ts#L573)

- Invalid's nine rows, including the three this story adds by name: selector-ambiguity,
  unwitnessed-claim, unwitnessed-quotation.
  [`ladder.ts:211`](../../src/core/score/ladder.ts#L211)

- WAIVED reads `waiverRule === 'waiver-honoured'` directly off AD-33's Stage C rather than
  re-deriving it.
  [`ladder.ts:523`](../../src/core/score/ladder.ts#L523)

**Mode entering identity, and the two agreement checks**

- Per-branch `z.literal` narrowing, the fix that actually closes the intra-artifact mode gap the
  first `.superRefine()` attempt could not (refinements don't export to JSON Schema).
  [`evidence-artifact.ts:124`](../../src/core/schemas/evidence-artifact.ts#L124)

- The AD-32 cross-artifact check: a sealed run record's mode against the evidence artifact's own
  discriminant, both directions.
  [`mode-agreement.ts:34`](../../src/core/score/mode-agreement.ts#L34)

**Generated table**

- The pure Markdown builder: per-rung and per-condition census, throws on any zero-count cell.
  [`ladder-table.ts:152`](../../src/core/score/ladder-table.ts#L152)

**Peripherals**

- The fixture set every rung of both ladders resolves against.
  [`ladder-inputs.ts:415`](../../tests/score/fixtures/ladder-inputs.ts#L415)

- The coherence test proving `LADDER_EXIT_CODES`/`strictPromotable` still agree with
  `src/cli/exit-codes.ts`, added during code review.
  [`ladder.test.ts:321`](../../tests/score/ladder.test.ts#L321)

- The reject fixture proving `scoringVersionInputs.mode` can no longer disagree with the artifact's
  own branch, added during code review.
  [`artifact-reject-cases.ts:1025`](../../tests/schemas/fixtures/artifact-reject-cases.ts#L1025)
