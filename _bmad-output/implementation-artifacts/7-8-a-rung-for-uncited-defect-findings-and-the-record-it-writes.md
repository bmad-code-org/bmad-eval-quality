---
title: 'A rung for uncited defect findings, and the record it writes'
type: 'feature'
created: '2026-09-02'
status: 'done'
baseline_commit: '6aaea0f6cb5c7c20aeccc5696165be3f4401d6cb'
review_loop_iteration: 1
context: [
  '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md',
  '{project-root}/_bmad-output/implementation-artifacts/epic-7-context.md',
  '{project-root}/_bmad-output/implementation-artifacts/7-4-the-ad-40-defect-signature-corpus-qualification-and-the-witness-match.md',
  '{project-root}/_bmad-output/implementation-artifacts/7-5-ad-33-as-a-total-reference-decision-procedure-with-generated-fixtures.md',
  '{project-root}/_bmad-output/implementation-artifacts/7-7-mode-separation-with-two-input-types-and-two-generated-ladders.md',
]
---

# Story 7.8: A rung for uncited defect findings, and the record it writes

Epic 7, story key `7-8-a-rung-for-uncited-defect-findings-and-the-record-it-writes`. Closes owed item 5,
"uncited defect findings route nowhere" (`ARCHITECTURE-SPINE.md:715-721`): AD-23 already retains a finding
citing no oracle rather than discarding it, and nothing downstream consumes it. Schema change: a new
`UncitedFindingGap` record and a required `uncitedFindingGaps` array on `EvidenceArtifact`'s contract-scoring
branch, a BREAKING `schemaVersion` bump from 2 to 3.

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** An ingested defect finding citing no oracle is retained by AD-23 but consumed nowhere -- neither
ladder derives a verdict from it and the contract-scoring evidence artifact has no record for it -- so SM-D4,
"at least one defect found through an evaluator-chosen action absent from the pre-canned baseline," currently
produces exit code zero.

**Approach:** Add a score-side pure function collecting every uncited `defect` finding, thread it as a sixth
top-level input both ladders share so it resolves at least CONCERNS in either mode, and mint a
`UncitedFindingGap` record on the contract-scoring branch of `EvidenceArtifact`, deliberately distinct from
AD-31's `CoverageGap` because AD-31's relevance predicate is "computed from declarations only, never inferred
from the oracles" and this gap has no relevance or satisfaction predicate to carry.

## Boundaries & Constraints

**Always:**
- `src/core/schemas/evidence-artifact.ts` gains `UncitedFindingGap = z.strictObject({ findingId: FindingId,
  observationIds: z.array(Identifier).min(1), quotedEvidence: z.array(QuotedEvidence).min(1), severity:
  Severity })` (import `QuotedEvidence` from `sealed-run-record.ts` alongside the existing
  `OracleDispositionValue`/`RunMode` import) and its `z.infer` type, mirroring `CoverageGap`'s own shape and
  the `defect`-branch fields on `Finding` (`sealed-run-record.ts:80-99`) it is read from. Following AD-11's
  rule that "adding an optional field is a `schemaVersion` bump recorded in the field's own description;
  removing or retyping is breaking" (the exact phrasing `sealed-run-record.ts:303`'s `mode` field already
  quotes for its own bump): both `UncitedFindingGap` and the `uncitedFindingGaps` field below carry a
  `.describe()` stating this is the version-3 bump and why it is breaking (required, not optional, per owed
  item 5) -- no field in this story ships without one.
- `uncitedFindingGaps: z.array(UncitedFindingGap)` is added **only inside the contract-scoring branch**
  (`evidence-artifact.ts:358-368`), never in `evidenceCommonFields`: the AC scopes the record to
  contract-scoring, production mode needs only the ladder signal below. An empty array is legal, the same
  posture `coverageGaps` and `verdictBasis` already take. Because it is required and contract-scoring-only, a
  `uncitedFindingGaps` key present on a *production*-mode object is rejected under that branch's
  `strictObject`'s `unrecognized_keys` rule -- the AC below is reworded to prove exactly this pair rather than
  an "assembly" no module in this story performs.
- `src/core/score/outcome.ts` gains `uncitedDefectFindingGaps(record: Pick<SealedRunRecord, 'findings'>):
  readonly UncitedFindingGap[]`, placed directly after the existing `uncitedFindingIds` (`:752-766`), filtering
  `finding.findingType === 'defect' && finding.oracleId === null`, mapping to `{ findingId, observationIds,
  quotedEvidence, severity }` off the finding's own fields, sorted `(a, b) => byIdentifier(a.findingId,
  b.findingId)` -- `byIdentifier` (`:710`) is itself a bare `(string, string) => number` comparator and cannot
  sort objects directly. Deliberately not a rename or an extension of `uncitedFindingIds`: that function already
  exists, is tested, and covers every finding type for the artifact's own bare `uncitedFindings: FindingId[]`
  field; this one is narrower (`defect` only) and richer (the full record), and its own docstring already
  reserves the name split ("Named apart from the artifact's own `uncitedFindings` field so the two do not
  collide").
- `src/core/score/ladder.ts`'s `AssessmentCommon` gains `uncitedDefectFindings: readonly UncitedFindingGap[]`
  as a top-level field, sibling to `coverageGaps` and `findings` (not nested inside `outcomeState`): AD-21's
  seven categories place this closest to "coverage condition," and owed item 5's own text calls it, in
  contract-scoring, "the strongest available evidence of a coverage gap." `UncitedFindingGap` is imported as a
  type from `evidence-artifact.ts` and reused as the ladder's input shape -- the same reuse `CoverageGap`
  already has, though unlike `CoverageGap` (every field of which the existing row reads) the new row below
  reads only whether the array is non-empty and each entry's `findingId`; `observationIds`, `quotedEvidence`,
  and `severity` are carried for the persisted record `outcome.ts` builds separately and are not themselves
  ladder inputs -- stated here rather than left implicit. `ladder.ts:96`'s module comment, "the seven category
  values, common to both modes," is updated in the same diff to name which category `uncitedDefectFindings`
  belongs to, so the comment and the field list stay in agreement.
- `CONCERNS_ROWS_SHARED` (`ladder.ts:430-504`) gains one row, `uncited-defect-finding`, placed after
  `finding-confidence-below-threshold` and before the two `evidenceCondition: true` rows: `evidenceCondition:
  false`, guard "an ingested defect finding citing no oracle," firing unconditionally whenever
  `inputs.uncitedDefectFindings` is non-empty -- **no severity-floor gate**, unlike
  `coverage-gap-at-or-above-floor` and `behavioural-failure-below-floor`. Neither the epics.md AC nor owed
  item 5's spine text ("production mode resolves at least CONCERNS") names a floor for this condition, and
  `evidenceCondition: false` means a CONCERNS resolving only from this row is still `--strict`-promotable,
  which is correct: a genuine uncited defect is a real signal, not a thinner-measurement note.
- The row lands in both `PRODUCTION_LADDER` and `CONTRACT_LADDER` since it is shared, satisfying "the rung
  appears in both generated ladder tables" with no new script files: `ladder-table.ts`,
  `scripts/generate-ad21-table.ts`, and `scripts/check-ad21-table.ts` all read the rule tables and
  `fixtureCases()` directly.
- `tests/score/fixtures/ladder-inputs.ts`'s `SHARED_OVERRIDES` gains one entry supplying a synthetic
  `UncitedFindingGap`, following the `coverage-gap-at-or-above-floor` override's shape.
- **The reject-fixture harness needs a per-case seed override before a `uncitedFindingGaps` reject fixture is
  possible.** `ARTIFACT_ACCEPT_FIXTURES['evidence-artifact']` is `productionEvidenceArtifact`
  (`artifact-fixtures.ts:925`), and both consumers -- `artifact-reject-fixtures.test.ts:34-37` and
  `published/corpus.ts:76-78` -- clone that one seed for every `evidence-artifact` reject case. A mutation
  targeting a contract-scoring-only field against the production seed is a no-op: the clone still parses, and
  the test that asserts rejection fails. `ArtifactRejectCase` (`artifact-reject-cases.ts:12-29`) gains one new
  optional field, `seed?: unknown` -- "overrides the accept fixture this case clones from, for a constraint
  that exists only on a branch the registry's default accept seed does not take" -- and both consumers change
  from `ARTIFACT_ACCEPT_FIXTURES[artifact]` to `rejectCase.seed ?? ARTIFACT_ACCEPT_FIXTURES[artifact]`. The two
  new `uncitedFindingGaps` reject cases set `seed: contractScoringEvidenceArtifact`. This does not touch the
  existing `evidence-scoring-version-mode-disagrees-with-branch` case (`:1024-1036`), which keeps cloning the
  default production seed unchanged.
- **The worked example's pinned Evidence Artifact issue list moves from nineteen entries to twenty.**
  `spike-worked-example/evidence-artifact.json` is `mode: "contract-scoring"`, `schemaVersion: 1`, and carries
  no `uncitedFindingGaps`; adding a required field to the contract-scoring branch adds one `invalid_type` issue
  for it. `tests/schemas/fixtures/worked-example-artifacts.ts`'s `WORKED_EXAMPLE_EVIDENCE_ISSUES` and
  `worked-example-artifacts.test.ts:29-34`'s `toHaveLength(19)` both move to twenty; the new entry's position
  in the array is read off the actual failing test output after the field lands, not guessed, matching how the
  other eighteen entries were originally derived. This is required maintenance of a pinned failure list, not
  "using the worked chain as a fixture" in the sense the Never clause below forbids -- the Never clause is
  about treating the chain as passing evidence for this story's own behaviour, which nothing here does.
- **`CENSUS_BY_KEYWORD` (`keyword-mutation.test.ts:135-155`) is a third pinned map, alongside
  `CENSUS_BY_DOCUMENT` and `CENSUS_TOTAL`.** `UncitedFindingGap` and its new field shift at minimum `type`,
  `required`, `additionalProperties`, `items`, `minItems`, `minLength`, `pattern`, and `enum`; every affected
  key is re-read off the regenerated schema, not hand-computed.
- The evidence-artifact `schemaVersion` bump (fixture value 2 → 3 in `tests/schemas/fixtures/artifact-fixtures.ts`),
  `npm run generate:schemas`, and AD-13's four checks (the two new reject fixtures above; pinned counters in
  `differential.test.ts` (`:31,:33`, the 140 total), `published-rejection.test.ts` (`:87-89`, the 55/85/140
  breakdown), and `keyword-mutation.test.ts` re-read off the actual regenerated schema and test runs, never
  hand-computed) land in this story, following Story 7.7's template.

**Ask First:** none anticipated. Settle any further ambiguity by construction in this story's own decisions
section rather than escalating it.

**Never:**
- No change to `Finding`, `QuotedEvidence`, or any sealed-run-record schema: AD-23's "citing no oracle" carve-out
  is already representable (`oracleId: OracleId.nullable()`, `sealed-run-record.ts:42-43`) and every field
  `UncitedFindingGap` needs is already present and required on `Finding`'s `defect` branch.
- No file under `src/cli/` or `score`/`emit` module changes. `stage-table.ts` keeps both `module: null`; the new
  function and the ladder field are built and tested but unwired to a caller, the same posture Story 7.7 left
  `auditQuotation` and its own two ladders in.
- No use of the worked-chain corpus (P-001) as *evidence* anywhere in this story's own tests: owed item 7
  forbids treating that chain as a passing fixture until Story 7.9 regenerates it. Every fixture proving this
  story's own behaviour is a synthetic `SealedRunRecord`/`Finding`/`AssessmentCommon` value constructed
  locally, the same posture `tests/score/fixtures/probe-witness.ts`'s `recordOf`/`defectFinding` helpers
  already take for `auditQuotation` (used at `witness.test.ts:750-816`). This does not extend to updating the
  worked example's own pinned *failure* list (above), which is bookkeeping for a corpus this story is not
  claiming as evidence.
- No AD-6 `Outcome.state` change and no new outcome state: the story's own text is explicit the finding is
  "retained under AD-23 rather than discarded or forced into an AD-6 state." `uncitedDefectFindingGaps` reads
  `record.findings` directly and contributes nothing to `OutcomeStateInputs`.
- No modification of `uncitedFindingIds` or the artifact's existing bare `uncitedFindings: FindingId[]` field.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Uncited defect finding | one `defect` finding, `oracleId: null`, valid `observationIds`/`quotedEvidence` | `uncitedDefectFindingGaps` returns one `UncitedFindingGap`; both ladders resolve at least CONCERNS with `uncited-defect-finding` in `verdictBasis` | N/A |
| Oracle-cited defect finding | `defect` finding with `oracleId` set | excluded from `uncitedDefectFindingGaps`; row does not fire for it | N/A |
| Non-defect uncited finding | `observation`/`confirmation` finding, `oracleId: null` | excluded: `UncitedFindingGap` needs `quotedEvidence`, which only the `defect` branch carries | N/A |
| Contract-scoring artifact | one uncited defect finding present | `uncitedFindingGaps` on the artifact carries the finding identifier, its cited observation identifiers, its quoted evidence, and its severity | N/A |
| Missing `uncitedFindingGaps` on parse | contract-scoring object with the field absent | rejected | rejected by the new AD-13 fixture |
| No uncited defect findings | none present | row never fires; every other CONCERNS/FAIL/Invalid condition unaffected | N/A |

</frozen-after-approval>

## Code Map

**Read-only evidence:**
- `src/core/schemas/sealed-run-record.ts:27-35` -- `QuotedEvidence`; `:40-70` -- `findingCommonFields`,
  `oracleId: OracleId.nullable()` with AD-23's carve-out already in its own description; `:78-116` -- `Finding`
  discriminated union, `defect` branch (`:80-99`) tightens `observationIds`/`quotedEvidence` to `.min(1)`.
- `src/core/schemas/evidence-artifact.ts:194-208` -- `CoverageGap`, both predicates `z.string().min(1)`;
  `:299-339` -- `evidenceCommonFields`, `uncitedFindings: z.array(FindingId)` (bare ids, already shared),
  `coverageGaps: z.array(CoverageGap)`; `:346-377` -- `EvidenceArtifact` discriminated union (`.meta` block
  ends `:377`, `z.infer` type alias at `:379`), contract-scoring branch at `:358-368`.
- `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md:364-370`
  -- AD-21's CONCERNS clause, no uncited-finding condition named yet; `:378-382` -- AD-23's full rule, verbatim
  carve-out language; `:449-457` -- AD-31, `:453` "relevance is computed from declarations only, never inferred
  from the oracles"; `:471` -- AD-33's own "two cells fixed here" sentence naming the uncited-finding record;
  `:715-721` -- owed item 5, the shape-of-fix text this story satisfies; `:730-743` -- owed item 7, the
  worked-chain regeneration ban this story's fixtures respect.
- `_bmad-output/planning-artifacts/epics.md:529` -- the epic preamble's own sentence distinguishing
  `UncitedFindingGap` from `CoverageGap`, to lift near-verbatim into Design Notes.
- `src/core/score/quotation.ts:106-169` -- `UnwitnessedQuotation`/`auditQuotation`, the closest existing analog:
  a whole-record, not-per-oracle, unwired-by-design pure function over `record.findings`.
- `src/core/score/outcome.ts:752-766` -- `uncitedFindingIds`, the existing broader (all finding types, ids
  only) sibling this story's function sits beside without modifying.
- `src/core/score/ladder.ts:26-124` -- imports, `AssessmentCommon`/`ProductionAssessment`/`ContractAssessment`;
  `:186-193` -- `LadderConditionRow` shape; `:430-504` -- `CONCERNS_ROWS_SHARED`, five existing rows;
  `:543-561` -- `PRODUCTION_LADDER`/`CONTRACT_LADDER` assembly.
- `src/core/score/ladder-table.ts`, `scripts/ad21-table-target.ts`, `scripts/generate-ad21-table.ts`,
  `scripts/check-ad21-table.ts` -- reused verbatim, no new files.
- `tests/schemas/fixtures/artifact-fixtures.ts:706-845` -- `evidenceCommon` (`:707` `schemaVersion: 2`, `:780`
  `uncitedFindings`, `:781-789` `coverageGaps`), `contractScoringEvidenceArtifact` (`:829-845`) -- where the new
  field's fixture literal lands.
- `tests/schemas/fixtures/artifact-reject-cases.ts` (85 entries), `tests/schemas/fixtures/reject-cases.ts` (55
  entries) -- `differential.test.ts:31,33` pins the 140 total; `published-rejection.test.ts:87-89` pins the
  55/85/140 breakdown; `keyword-mutation.test.ts:120-183` -- `CENSUS_BY_DOCUMENT['evidence-artifact']: 413`,
  `CENSUS_BY_KEYWORD` (`:135-155`, eighteen counters), `CENSUS_TOTAL: 2451`, every counter shifts by an amount
  this story computes from the actual regenerated schema, not by hand.
- `tests/schemas/fixtures/artifact-fixtures.ts:925` -- `ARTIFACT_ACCEPT_FIXTURES['evidence-artifact'] =
  productionEvidenceArtifact`, the single seed both reject-fixture consumers clone by default;
  `tests/schemas/artifact-reject-fixtures.test.ts:34-37`, `tests/schemas/published/corpus.ts:76-78` -- the two
  consumers, both needing the new `seed` override field described above.
- `tests/schemas/fixtures/worked-example-artifacts.ts` (`WORKED_EXAMPLE_EVIDENCE_ISSUES`),
  `tests/schemas/worked-example-artifacts.test.ts:29-34` (`toHaveLength(19)`) --
  `spike-worked-example/evidence-artifact.json` is `mode: contract-scoring`; both move to twenty.
- `tests/score/fixtures/probe-witness.ts:208,232` -- `defectFinding`/`recordOf`, the synthetic-fixture pattern
  to mirror for the new function's tests (owed item 7's worked-chain ban), used at `witness.test.ts:750-816`.
- `tests/score/outcome.test.ts:1328-1345` -- the existing `uncitedFindingIds` test block, where the new
  function's tests are added alongside.
- `tests/score/ladder.test.ts`, `tests/score/fixtures/ladder-inputs.ts:125-401` -- `SHARED_OVERRIDES`, the
  `coverage-gap-at-or-above-floor` override (`:329-343`) is the pattern to copy.

**New:**
- None -- no new files. Every change lands in existing modules and test files listed above.

**Changed:**
- `src/core/schemas/evidence-artifact.ts` -- `UncitedFindingGap` schema and type; `uncitedFindingGaps` on the
  contract-scoring branch; import `QuotedEvidence`.
- `src/core/score/outcome.ts` -- `uncitedDefectFindingGaps`.
- `src/core/score/ladder.ts` -- `AssessmentCommon.uncitedDefectFindings`; `uncited-defect-finding` row in
  `CONCERNS_ROWS_SHARED`.
- `tests/schemas/fixtures/artifact-fixtures.ts`, `tests/schemas/fixtures/artifact-reject-cases.ts` (new `seed`
  field on `ArtifactRejectCase`, two new cases), `tests/schemas/artifact-reject-fixtures.test.ts`,
  `tests/schemas/published/corpus.ts` (both consumers read `rejectCase.seed ?? ARTIFACT_ACCEPT_FIXTURES[...]`),
  `tests/schemas/published/differential.test.ts`, `tests/schemas/published/published-rejection.test.ts`,
  `tests/schemas/published/keyword-mutation.test.ts` -- fixtures and pinned counters.
- `tests/schemas/fixtures/worked-example-artifacts.ts` -- `WORKED_EXAMPLE_EVIDENCE_ISSUES` gains one entry;
  `tests/schemas/worked-example-artifacts.test.ts` -- `toHaveLength(19)` → `20`.
- `tests/score/outcome.test.ts`, `tests/score/ladder.test.ts`, `tests/score/fixtures/ladder-inputs.ts` --
  coverage for the new function and the new rung.
- `schemas/evidence-artifact.schema.json`, `docs/ad21-verdict-decision.generated.md` -- regenerated, not
  hand-edited.

## Tasks & Acceptance

**Execution:**
- [x] `src/core/schemas/evidence-artifact.ts` -- add `UncitedFindingGap` schema/type, import `QuotedEvidence`,
  add `uncitedFindingGaps` to the contract-scoring branch only -- mints the record distinct from `CoverageGap`
- [x] `src/core/score/outcome.ts` -- add `uncitedDefectFindingGaps` beside `uncitedFindingIds` -- the score-side
  computation
- [x] `src/core/score/ladder.ts` -- add `AssessmentCommon.uncitedDefectFindings`; update the `:96` "seven
  category values" comment to name its category; add the shared `uncited-defect-finding` CONCERNS row, no
  floor gate -- the rung in both ladders
- [x] `tests/score/outcome.test.ts` -- prove `uncitedDefectFindingGaps`: defect+no-oracle included,
  oracle-cited and non-defect excluded, sorted, empty input
- [x] `tests/score/fixtures/ladder-inputs.ts`, `tests/score/ladder.test.ts` -- new `SHARED_OVERRIDES` entry;
  assert the row fires in both ladders, `verdictBasis` names it, and it is `--strict`-promotable
  (`evidenceCondition: false`)
- [x] `tests/schemas/fixtures/artifact-fixtures.ts` -- bump `schemaVersion` 2 → 3; add `uncitedFindingGaps` to
  the contract-scoring fixture
- [x] `tests/schemas/fixtures/artifact-reject-cases.ts` -- add optional `seed` field to `ArtifactRejectCase`;
  two new reject cases (`seed: contractScoringEvidenceArtifact`): field absent,
  `observationIds`/`quotedEvidence` empty
- [x] `tests/schemas/artifact-reject-fixtures.test.ts`, `tests/schemas/published/corpus.ts` -- read
  `rejectCase.seed ?? ARTIFACT_ACCEPT_FIXTURES[artifact]` instead of the bare lookup
- [x] `tests/schemas/fixtures/worked-example-artifacts.ts`, `tests/schemas/worked-example-artifacts.test.ts` --
  add the twentieth pinned issue (position read off the actual test failure), `toHaveLength(19)` → `20`
- [x] `tests/schemas/published/differential.test.ts`, `published-rejection.test.ts`, `keyword-mutation.test.ts`
  -- update pinned counters (including `CENSUS_BY_KEYWORD`) off the regenerated schema
- [x] `npm run generate:schemas` -- regenerate `schemas/evidence-artifact.schema.json`
- [x] `npm run generate:ad21-table && npm run check:ad21-table` -- fixed point over the new row

**Acceptance Criteria:**
- Given an ingested `defect` finding citing no oracle, when `uncitedDefectFindingGaps` runs over the record,
  then it returns one `UncitedFindingGap` carrying the finding's identifier, cited observation identifiers,
  quoted evidence, and severity.
- Given an oracle-cited `defect` finding or any non-`defect` finding with `oracleId: null`, when
  `uncitedDefectFindingGaps` runs, then it is excluded.
- Given an `AssessmentCommon` carrying a non-empty `uncitedDefectFindings`, when either ladder resolves, then
  the result is at least CONCERNS and `verdictBasis` names `uncited-defect-finding`.
- Given the same input and `--strict` semantics, when `exitCodeFor` reads `strictPromotable`, then a CONCERNS
  resolving only from this row promotes, since `evidenceCondition: false`.
- Given a contract-scoring `EvidenceArtifact` fixture carrying one `UncitedFindingGap`, when parsed, then it
  parses successfully; given the same key present on a production-mode fixture, when parsed, then it is
  rejected under `strictObject`'s `unrecognized_keys` rule, since no module in this story assembles an
  artifact to prove the "when scored" version of this claim.
- Given the generated table, when built, then `uncited-defect-finding` appears with a non-zero census in both
  ladder tables and `npm run check:ad21-table` passes against the committed file.
- Given the evidence-artifact schema bump, when `npm run validate` runs, then AD-13's four checks pass with
  their counters updated to the actual regenerated values.

## Spec Change Log

- **Finding:** a peer review of this ready-for-dev spec (before any code existed) found two blockers: the
  reject-fixture harness clones a single production-branch seed for every `evidence-artifact` reject case
  (`artifact-fixtures.ts:925`, `artifact-reject-fixtures.test.ts:34-37`, `corpus.ts:76-78`), so a mutation
  targeting the contract-scoring-only `uncitedFindingGaps` field would be a no-op against that seed; and the
  worked example's pinned nineteen-issue Evidence Artifact failure list (`worked-example-artifacts.ts`,
  `worked-example-artifacts.test.ts:29-34`) would go stale at twenty once the new required field lands, with
  neither file named anywhere in the draft. **Amended:** Boundaries gained a `seed` override field on
  `ArtifactRejectCase` plus the two consumer changes it requires, and an explicit instruction to update the
  pinned issue list with a carve-out in the Never clause distinguishing "using the worked chain as evidence"
  (forbidden) from "updating its pinned failure count" (required maintenance). Tasks and the Code Map now name
  every file involved. **Avoids:** a story that cannot ship its own required AD-13 reject fixtures and that
  turns `npm run validate` red via an unrelated, unnamed test.
- **Finding:** the same review found `CENSUS_BY_KEYWORD` (`keyword-mutation.test.ts:135-155`) omitted as a
  third pinned counter map alongside `CENSUS_BY_DOCUMENT` and `CENSUS_TOTAL`; the no-severity-floor Design Note
  argued only that AD-21's CONCERNS clause names no floor, without engaging AD-21's PASS clause ("a coverage
  gap below the severity floor ... does not move the verdict"), the sentence a reviewer would actually raise
  against an unconditional CONCERNS row; the reused `UncitedFindingGap` ladder input carries `severity` with
  nothing reading it; and one acceptance criterion described an evidence artifact being "assembled," which no
  module in this story does. **Amended:** the Code Map now names `CENSUS_BY_KEYWORD`; the Design Note argues
  directly against the PASS-clause sentence (an uncited defect is an evaluator having already caught something
  real, not a possibly-harmless under-declared corner AD-31's gap represents) and states plainly that
  `severity` is required on the persisted record but deliberately unread by the guard; the AC now asserts what
  the schema actually proves (a contract-scoring fixture parses, the same key on a production fixture is
  rejected) instead of an unbuilt assembly step. **Avoids:** a story whose central design call reads as an
  oversight to the next reviewer, and an unmeetable acceptance criterion.
- Five Code Map citations were also corrected against source: the `defect`-branch line range unified to
  `sealed-run-record.ts:80-99`; `EvidenceArtifact`'s union closes at `evidence-artifact.ts:377` (`.meta` end),
  not `:378`; the 55/85/140 reject-count breakdown is pinned at `published-rejection.test.ts:87-89`, not
  `differential.test.ts:26-34` (which pins only the 140 total, at `:31,33`); the `recordOf`/`defectFinding`
  synthetic-fixture helpers are defined in `tests/score/fixtures/probe-witness.ts:208,232`, not inline in
  `witness.test.ts`; and the new function's sort must call `byIdentifier(a.findingId, b.findingId)`, since
  `byIdentifier` itself takes two strings, not two records.

## Design Notes

**Why `UncitedFindingGap` is not `CoverageGap`.** AD-31's coverage predicates are declaration-only: relevance
and satisfaction are each computed from what the contract declares, never from what an oracle observed
(`ARCHITECTURE-SPINE.md:453`). `CoverageGap` therefore requires a `relevancePredicate` and a
`satisfactionPredicate` -- both are the names of the declarations that fired. An uncited defect finding has
neither: it is a runtime observation an evaluator made outside any declared oracle, with no relevance
predicate to name and no satisfaction predicate that failed. Reusing `CoverageGap` for it would either fabricate
predicate names for a condition that has none, or make the two required fields lie about what actually happened
-- which is exactly the distinction `epics.md:529` states the story must record. `UncitedFindingGap` instead
carries what an uncited finding actually has: the finding's own identity, its citations, and its evidence.

**Why no severity-floor gate, and why that does not contradict AD-21's PASS clause.** AD-21's PASS clause says
"a coverage gap below the severity floor is recorded and does not move the verdict, which makes PASS reachable
for a single-operation contract" -- a floor-gated exception for `CoverageGap`, the compile-time record. An
uncited defect finding is not that record: `CoverageGap` marks a *declaration* AD-31 could not confirm was
satisfied, which can legitimately be low-stakes (an under-specified but harmless corner of the contract);
an uncited defect finding is an evaluator having *already caught something real* outside every declared oracle
-- SM-D4, "the differentiating result of the whole experiment." Floor-gating it would mean a low-severity but
genuine uncontemplated defect can still resolve PASS, which is the exact failure owed item 5 names: "an
evaluator that discovers a genuine uncontemplated defect produces ... exit code zero." `coverage-gap-at-or-
above-floor` and `behavioural-failure-below-floor` both compare against `inputs.severityFloor` because AD-21's
own text says so for those two conditions by name ("at or above the floor," "below the floor"); it says no
such thing for this one, and owed item 5's "at least CONCERNS" is a floor on the verdict, not a threshold on
severity. `UncitedFindingGap.severity` is still required on the persisted record -- the AC names it explicitly
-- but it is reader-facing evidence for whoever reads the artifact, not a rung input: the guard fires on
presence alone, deliberately.

**Why `AssessmentCommon.uncitedDefectFindings` and not a field on `outcomeState`.** Story 7.7 folded
`auditQuotation`'s result into `outcomeState` because an unwitnessed quotation is one of AD-21's *Invalid*
conditions, itself one of AD-6's outcome-state family. An uncited defect finding is a *CONCERNS* condition with
no outcome-state analog at all -- the story's own boundaries forbid inventing one -- so it belongs where
`coverageGaps` and `findings` already sit: a top-level `AssessmentCommon` field read directly by the CONCERNS
tier.

## Decisions settled by construction

Per the epic preamble's own rule that ambiguities are settled where the work happens rather than
escalated, recorded here rather than as a new spine revision or a checkpoint.

1. **A third consumer of the default accept seed exists and needed the same `seed` override the
   Spec Change Log's first finding gave the other two.** `tests/schemas/published/published-rejection.test.ts`
   builds its own `PUBLISHED_REJECT_CASES` list by re-mapping `ARTIFACT_REJECT_CASES` into a narrower
   object literal (`:38-55`) rather than importing the cases directly, and its own `it.each` at `:140-148`
   clones `ARTIFACT_ACCEPT_FIXTURES[artifact]` unconditionally, the same bare lookup the two named
   consumers had. Running the actual suite after the schema change surfaced this: both new
   `uncited-finding-gaps-*` cases failed here even though `artifact-reject-fixtures.test.ts` and
   `published/corpus.ts` were already fixed, because this third file never saw `rejectCase.seed` at
   all. Fixed the same way as the other two: the mapped-case type gains an optional `seed`, the map
   carries it through from `ARTIFACT_REJECT_CASES`, and the `it.each` reads `seed ?? ARTIFACT_ACCEPT_FIXTURES[artifact]`.
2. **`tests/schemas/publish.test.ts`'s per-document `$defs` census also moves, though the Code Map
   never named it.** `evidence-artifact`'s count moves 3 → 4: `EvidenceChannel` (already `.meta({id})`-tagged
   in `pointer.ts`, already reachable from `sealed-run-record.schema.json`) becomes reachable from
   `evidence-artifact.schema.json` too for the first time, because `UncitedFindingGap` embeds
   `QuotedEvidence`, and `QuotedEvidence.channel` is `EvidenceChannel`. The schema builder hoists any
   `.meta({id})`-tagged node it can reach into `$defs`, independent of how many times that one document
   references it, so a single new reachability path is enough to add the entry. Read off the actual
   `test:coverage` failure, not guessed, matching how every other pinned counter in this story was
   derived.
3. **The Boundaries text's "two new reject cases" became three.** The Boundaries text names two
   ("field absent, `observationIds`/`quotedEvidence` empty"), and a first pass combined the second into
   one case emptying both arrays with `issueCount: 2`. Peer review round 1 (below) found this violates
   AD-13's own per-constraint rule -- the asserted issue names only `observationIds`, so the
   `quotedEvidence` minimum could vanish from the published document with this case still rejecting via
   the other empty array, and `issueCount` had zero precedent anywhere in the 140-case corpus before this.
   Split into `uncited-finding-gap-observation-ids-empty` and `uncited-finding-gap-quoted-evidence-empty`,
   each a single-constraint mutation, matching every sibling case in the corpus.
4. **The contract-scoring fixture's `uncitedFindingGaps` entry is a new synthetic finding (`F-004`),
   not a re-tagged `F-003`, and `F-004` is added to the shared `uncitedFindings` array too.** `F-003` is
   the corpus's other uncited finding, but its `findingType` is `observation`, which carries no
   `quotedEvidence` at all -- exactly the I/O matrix's "non-defect uncited finding" exclusion. Minting a
   distinct `defect`-shaped identifier keeps the fixture honest about what `uncitedDefectFindingGaps`
   would actually produce. Peer review round 1 found the first pass stopped there and left `F-004` naming
   nothing in `uncitedFindings` (`evidenceCommon`'s own bare-id field, which spans every finding type and
   is a superset of the defect-only gap list by construction, per `uncitedFindingIds`'s implementation):
   one fixture object claiming an uncited defect gap for a finding no other field of the same object
   names. `uncitedFindings: ['F-003', 'F-004']` closes it; no pinned counter reads that array's length.
5. **Peer review round 1** (an independent Claude Code session, Opus 5, given the diff and the spine
   citations, asked to verify every claim against source) confirmed the schema, the score-side function,
   the ladder row, and every pinned counter as correct, and found three real gaps, all fixed in this same
   pass: the AC's own second half ("the same key present on a production-mode fixture ... is rejected") had
   no test, closed by `tests/schemas/artifacts.test.ts`'s new `refuses uncitedFindingGaps on the production
   branch`, mirroring the two existing `productionVerdict`/`contractVerdict` tests thirty lines above it;
   items 3 and 4 above. Nothing was deferred.

## Verification

**Commands, all run and green:**
- `npm run test -- tests/score/outcome.test.ts tests/score/ladder.test.ts` -- green (90 tests), including
  `uncitedDefectFindingGaps` (defect+no-oracle included, oracle-cited/non-defect excluded, sorted, empty
  input) and the `uncited-defect-finding` CONCERNS row in both ladders
  (strict-promotable, `verdictBasis` names the finding)
- `npm run generate:schemas && npm run generate:ad21-table && npm run check:ad21-table` -- fixed point,
  no drift (46 condition rows, 48 cases, up from 44/46 -- one new shared row across both ladders)
- `npm run validate` -- green end to end: build, typecheck, lint, docs, doc-invocations, shareable,
  spine lint, vectors, schemas, AD-5/AD-28 registries, AD-31/AD-33/AD-21 tables, layers, lineage,
  boundary, corpus, website-deps, and `test:coverage` (98 suite files, 3323 tests, 97%/92.56%
  statements/branches, floor 90% -- final count, after peer review round 1's three-case split and the
  added production-branch rejection test)

**Pinned counters moved, each read off the actual regenerated schema and test runs, never
hand-computed:**
- `ARTIFACT_REJECT_CASES` 85 → 88; `PUBLISHED_REJECT_CASES` 140 → 143 (`differential.test.ts`,
  `published-rejection.test.ts`; three new cases, not two, per Decisions settled by construction item 3)
- `WORKED_EXAMPLE_EVIDENCE_ISSUES` 19 → 20, new entry at the end (no `uncitedFindingGaps` on the
  transcribed worked example)
- `CENSUS_BY_DOCUMENT['evidence-artifact']` 413 → 437; `CENSUS_BY_KEYWORD`: `additionalProperties`
  216→218, `enum` 64→66, `items` 130→133, `minItems` 39→41, `minLength` 102→103, `pattern` 161→163,
  `required` 186→188, `type` 1077→1087; `CENSUS_TOTAL` 2451 → 2475 (`keyword-mutation.test.ts`)
- `publish.test.ts`'s per-document `$defs` census, `evidence-artifact` 3 → 4 (Decisions settled by
  construction, item 2 -- not named in the Code Map, found from the actual `test:coverage` failure)

## Suggested Review Order

**The record and where it is read from**

- The schema itself: `UncitedFindingGap`, deliberately not `CoverageGap` -- no relevance or
  satisfaction predicate, because an uncited defect finding has neither.
  [`evidence-artifact.ts:227`](../../src/core/schemas/evidence-artifact.ts#L227)

- `uncitedFindingGaps`, contract-scoring branch only, the version-3 required-field bump.
  [`evidence-artifact.ts:391`](../../src/core/schemas/evidence-artifact.ts#L391)

- `uncitedDefectFindingGaps`: narrower and richer than `uncitedFindingIds`, the two coexisting by
  design.
  [`outcome.ts:778`](../../src/core/score/outcome.ts#L778)

**The rung**

- `AssessmentCommon.uncitedDefectFindings`, sibling to `coverageGaps`, and the updated "seven
  category values" comment naming its category.
  [`ladder.ts:98`](../../src/core/score/ladder.ts#L98)

- The `uncited-defect-finding` CONCERNS row: no severity-floor gate, and why that does not
  contradict AD-21's PASS clause (Design Notes).
  [`ladder.ts:496`](../../src/core/score/ladder.ts#L496)

**The reject-fixture harness's third consumer**

- The `seed` override on `ArtifactRejectCase`, and the third consumer
  (`published-rejection.test.ts`) the frozen spec did not name (Decisions settled by construction,
  item 1).
  [`artifact-reject-cases.ts:36`](../../tests/schemas/fixtures/artifact-reject-cases.ts#L36)

**What peer review round 1 found**

- The AC's own "rejected on the production branch" half, previously untested.
  [`artifacts.test.ts:565`](../../tests/schemas/artifacts.test.ts#L565)

- The two single-constraint reject cases the merged `issueCount: 2` case split into.
  [`artifact-reject-cases.ts:1061`](../../tests/schemas/fixtures/artifact-reject-cases.ts#L1061)

- `F-004` added to `uncitedFindings`, closing the fixture's own internal disagreement with itself.
  [`artifact-fixtures.ts:785`](../../tests/schemas/fixtures/artifact-fixtures.ts#L785)

**Peripherals**

- The new `SHARED_OVERRIDES` fixture entry and the dedicated ladder test proving CONCERNS,
  strict-promotable, in both ladders.
  [`ladder-inputs.ts:348`](../../tests/score/fixtures/ladder-inputs.ts#L348)

- The worked example's twentieth pinned issue, position read off the actual failure rather than
  guessed.
  [`worked-example-artifacts.ts:458`](../../tests/schemas/fixtures/worked-example-artifacts.ts#L458)
