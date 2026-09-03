---
title: 'The score stage over a trial set'
type: 'feature'
created: '2026-09-03'
status: 'done'
review_loop_iteration: 1
context: []
baseline_commit: '6e4ca5817cd9d78f7d8f1450f7e0a0fa83b7a798'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `score`'s stage-table row still carries `module: null`. The only place that composes an eval contract, validated observations, a probe, a preflight verdict, and a scoring policy into a scored outcome and verdict is `scripts/worked-example-target.ts`, a build script outside the package's own dependency graph, which hardcodes three of `OutcomeInputs`' fields because nothing in `src/` derives them yet. Story 8.1 also recorded eight run-level conditions against a `null` ladder target because neither shipped ladder has a rung for any of them, and two Epic 7 findings were deferred until `score` had a real caller.

**Approach:** Build `src/core/score/score.ts` as the one orchestration over the thirteen existing reference functions already in `src/core/score/`, lifting `scripts/worked-example-target.ts:1071-1381`'s order rather than designing a second one. Widen `EvidenceIntegrityInputs` and the shared Invalid rows with the eight rungless conditions Story 8.1 owes, add two more rows for the operationId collision it also routed here and for cross-trial disagreement, and close the two Epic 7 findings this story gives a real caller.

## Boundaries & Constraints

**Always:**
- `score.ts` throws nothing for a domain input; every `schema-parse-failure` over an artifact already happened at the application boundary before any of score's inputs reached it.
- `stage-table.ts:115-130`'s `score` row is unchanged except `module`. Its five declared inputs stay exactly `eval-contract, validated-observations, probe, preflight-verdict, scoring-policy` — the registry key names an artifact TYPE, not its cardinality. `score.ts`'s own function signature is the first code anywhere to give `validated-observations` a trial-set shape, `readonly ValidatedObservations[]` (one entry per trial's own `ingest` call, all trials from the same probe under the same contract), which is owed item 1's remaining half.
- `ValidatedObservations` (`ingest.ts:67-79`) widens by one field, `evaluatorRecommendation: EvaluatorRecommendation`, mirroring exactly how `mode` is already carried through from the record. `AssessmentCommon.evaluatorRecommendation` (`ladder.ts:107`) is required and two shared rows (`evaluator-recommendation-fail`/`-concerns`) read it directly, and neither score's five declared inputs nor any caller-supplied parameter names another source for it — see Decision 8.
- The eight ladder-null conditions in `LADDER_TARGETS` (`ingest/conditions.ts:264-276`) each gain a rung on the shared `INVALID_ROWS` array (`ladder.ts:224-349`) that both `PRODUCTION_LADDER` and `CONTRACT_LADDER` already spread (`ladder.ts:569-587`) — one array edit reaches both ladders; there is no second array to edit.
- `EvidenceIntegrityInputs.isolationViolation` (`ladder.ts:89`) widens from `string | null` to `readonly string[]`, matching `ValidatedObservations.isolationViolation`'s shape Story 8.1 already ships; its row (`ladder.ts:248-258`) maps the array instead of a single string.
- `LadderTarget` (`ingest/conditions.ts:258-261`) widens to name all ten `EvidenceIntegrityInputs` fields that carry an ingest condition (the two existing plus eight new) and drops `null` from the union entirely, each member still built with `Extract` against its own `keyof` union. `LADDER_TARGETS`' eight `null` entries repoint onto the new fields. `tests/ingest/conditions.test.ts:60-75`'s "leaves exactly eight kinds without a rung" case becomes "leaves none" (empty array). This widening is `ingest/conditions.ts`'s own vocabulary and stays independent of the two score-computed conditions below, which are not `IngestCondition` variants at all.
- `probeQualified` reads `QualifiedProbe.result.qualified` (`qualification.ts:741-744`) off whichever bucket, `admitted` or `rejected`, the single scored probe lands in after `sealProbeSet([probe], homeOperationOf)` (`qualification.ts:779-782`). Both buckets carry that field; an unqualified probe is a legitimate domain outcome that the existing `unqualified-probe-in-sealed-set` condition (`outcome.ts:234`) already reports, never a reason to throw. `judgeConduct` derives once per run — see Decision 2 — and the same value feeds every oracle's `OutcomeInputs`. `preflightPassed` reads `preflightVerdict.passed` (`preflight-verdict.ts:44`).
- `waiver` and `evaluationFault` are explicit, documented parameters `score.ts`'s own exported function accepts from its caller. Neither is declared on any of score's five inputs. `outcome.ts:58-61`'s comment states AD-5 waiver expiry is settled outside a clock-free pure function's declared inputs; no comparable citation exists for `evaluationFault` anywhere in `outcome.ts` or the schemas, so it is recorded here as a genuine, undocumented-elsewhere gap that `score.ts` closes the same way — a caller-supplied parameter — for lack of any declared source, not because a matching sentence already says so.
- `reduceTrialSet` (`reduce-trials.ts:98-106`) gains an explicit branch for `TRIAL_VOTE_STATE_OF[vote.state] === undefined` instead of silently falling through into `votedStates.push`, and `catchThreshold` gets a `0 <= x <= 1` range check — the two Epic 7 findings this story's real caller triggers.
- `strength.ts:168-177`'s `outcomesByProbeId` guards a repeated `probeId` instead of last-write-wins overwrite.
- A ninth new Invalid row, `operation-identifier-collision`, covers the operationId collision `sealed-run-record.ts:179-181` names and `deferred-work.md`'s first Story-8.1-routed entry assigns here: for each observation, whether its `operationId` matches an operation inside more than one of `evalContract.permittedInterfaces`. Unlike the eight rungless conditions, this one is not an `IngestCondition` — ingest never computes it (it has no `eval-contract` input and `Observation` carries no interface qualifier) — so its `EvidenceIntegrityInputs` field is a new, independent one, not an `Extract<IngestCondition, …>`.
- A tenth new Invalid row, `trial-set-field-disagreement`, covers a caller assembling a trial set from records that disagree on `mode` or `evaluatorRecommendation` — see Decision 8.
- `docs/ad21-verdict-decision.generated.md` is regenerated (`npm run generate:ad21-table`) and `npm run check:ad21-table` is green afterward.
- No new interchange artifact, no `schemaVersion` bump, no AD-5 or AD-28 code minted. `score`'s owned product stays a plain TypeScript type with no Zod schema, matching `ValidatedObservations`' precedent (`ownsInterchange: null` is already set on the row).

**Ask First:** none. Every ambiguity this investigation found (the trial-set shape, the two score-computed conditions, the `judgeConduct` derivation, `checkModeAgreement`'s real caller, the private-artifact-digest owner) is settled by construction below, per standing instruction to decide rather than escalate.

**Never:**
- No `checkModeAgreement` call inside `score.ts`. Its second parameter is `Pick<EvidenceArtifact, 'mode'>` (`mode-agreement.ts:34-37`) and score produces no `EvidenceArtifact` — that artifact is Story 8.3's. `score.ts`'s part is to choose the assessment type from the trial set's own `mode` and stamp that same value onto the product's `mode`, so the check is meaningful once Story 8.3 wires it. Add a `deferred-work.md` entry naming Story 8.3 as the owner of the real call — see Decision 4 for the epics.md wording this overrides.
- No widening `DiagnosticSink.stage` (`application/diagnostics.ts:15`) — diagnostics emission is application-layer, Story 8.4's.
- No building the private-artifact-manifest digest recomputation (`deferred-work.md`'s third Story-8.1-routed entry). Score's row declares no `private-artifact-manifest` input and no corpus port, so it has no bytes to recompute against. Reassign that entry's owner to Story 8.3 in this diff, since `ScoringVersionInputs.corpusDigest` (`evidence-artifact.ts:105`) is a field `emit` constructs, not one score touches.
- No rubric-criterion validation beyond reading `judge-result-unscored`'s own `rubricId`/`criterionId` pair. `deferred-work.md`'s second Story-8.1-routed entry (validating every scored `JudgeResult`'s criterion against the cited rubric) stays unowned: `ValidatedObservations` never exposes scored `JudgeResult` entries, only the unscored ones surfaced as a condition, so the full rule is unbuildable from score's declared inputs.
- No `src/core/score/index.ts` barrel — none exists today and none of the thirteen existing modules needs one to be imported by `score.ts`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Clean trial set | N trials, no ingest conditions, preflight passed, `waiver: 'none'`, `evaluationFault: false` | PASS verdict, exit 0, empty basis | N/A |
| Empty rubrics | `evalContract.rubrics === []` | `judgeConduct` is `'absent'` for every oracle | N/A |
| `judge-result-unscored` present | that condition appears on any trial | `judgeConduct` is `'malformed'` for every oracle; `judge-malformed` fires (Invalid) | N/A |
| One of the eight rungless conditions fires (e.g. `duplicate-record-identifier`) | condition present on any trial's `ValidatedObservations` | its new Invalid row fires with a basis line naming the condition | N/A |
| An observation's `operationId` matches operations in two `permittedInterfaces` | ambiguous operationId | the new `operation-identifier-collision` Invalid row fires | N/A |
| Probe rejected by qualification | `sealProbeSet` places it in `.rejected` | `probeQualified: false`; `unqualified-probe-in-sealed-set` fires and resolves to `infrastructure-error`, so the *existing* `invalidating-state` row catches it — no eleventh row needed; no throw | N/A |
| `isolationViolation` carries 2+ entries | non-empty array | the row renders one basis line per entry, in array order | N/A |
| A `TrialVote.state` outside the closed twelve reaches `reduceTrialSet` | malformed state bypassing the type at a boundary | the new explicit branch fires instead of silently counting as voted | thrown (non-domain input) |
| `catchThreshold` outside `0..1` | e.g. `1.5` | rejected before folding | thrown (non-domain input) |
| Two `Outcome` entries share a `probeId` | duplicate `probeId` in `outcomesByProbeId` | guarded rather than silently overwritten (Decision) | N/A |
| Trials disagree on `mode` or `evaluatorRecommendation` | one trial's value differs from another's in the same set | the new `trial-set-field-disagreement` Invalid row fires, naming the field and the two disagreeing values | N/A (recorded, never thrown) |

</frozen-after-approval>

## Code Map

- `src/core/score/score.ts` — new. The stage. Signature: `score(contract: EvalContract, trials: readonly ValidatedObservations[], probe: Probe, preflightVerdict: PreflightVerdict, policy: ScoringPolicy, waiver: WaiverStateValue, evaluationFault: boolean): ScoredOutcomesAndVerdict`. Body lifts `scripts/worked-example-target.ts:1071-1381`'s order: probe sealing (`qualification.ts:779-782 sealProbeSet`, `qualification.ts:104-115 resolveHomeOperation`), plan indexing (`seal/plan-index.ts` `buildPlanIndex`), acyclicity (`binding-order.ts:62 bindingOrder`), captured-binding resolution and selection (`bindings.ts:176 resolveCapturedBindings`, `:377 selectWithBindings`), operand/collection resolvers (`evaluate/evidence-resolution.ts`), the witness match (`witness.ts:220-224 matchProbeWitness`, `:389 mapFindings`), per-oracle check resolution (`evaluate/resolution.ts resolveCheck`), `resolveOutcome` (`outcome.ts:719`) once per oracle per trial, `reduceTrialSet` (`reduce-trials.ts:92-117`) folding across the trial set's votes for the one designated oracle, `buildStrengthVector` (`strength.ts:101-120`), `evaluateCoverage` (`coverage/coverage.ts`), `uncitedDefectFindingGaps`/`uncitedFindingIds` (`outcome.ts:760,778`), `auditQuotation` (`quotation.ts:129-131`, already run per trial inside `ingest`, re-read here from each trial's `ValidatedObservations.unwitnessedQuotations`), and finally `resolveProductionVerdict`/`resolveContractVerdict` (`ladder.ts:645,658`) chosen by the trial set's own `mode`.
- `src/core/score/score.ts` — the ninth Invalid condition: for each trial's observations, resolve `operationId` against `contract.permittedInterfaces[*].operations[*].operationId`; more than one interface matching is the collision.
- `src/core/score/score.ts` — the tenth Invalid condition: assert every trial's `ValidatedObservations.mode` and `evaluatorRecommendation` equals the first trial's; a mismatch is recorded, not thrown.
- `src/core/ingest/ingest.ts:67-79` — widen `ValidatedObservations` with `evaluatorRecommendation: EvaluatorRecommendation`, read off `record.evaluatorRecommendation` (`sealed-run-record.ts:316`) the same way `mode` already is. This is Story 8.1's shipped file; the type carries no Zod schema, so this is a plain, non-breaking TypeScript widening.
- `src/core/stage-contracts.ts:66-70` (precedent) — add `ScoreStage<Product>` next to `IngestStage<Product>`, generic for the same reason (`score.ts` would otherwise import its own return type from a module that imports back). Update the header's "conformance types" count.
- `src/core/lineage/stage-table.ts:129` — set `score.module = 'src/core/score/score.ts'`. No other field on this row changes.
- `src/core/score/ladder.ts:83-90` — widen `EvidenceIntegrityInputs`: `isolationViolation: string | null` → `readonly string[]`; add eight fields, one per rungless condition (`readonly <Variant>[]`, `Extract<IngestCondition, {kind: '...'}>` type-only imported from `../ingest/conditions.ts`, mirroring `unwitnessedQuotations`'s structured-array precedent rather than `isolationViolation`'s pre-rendered-string one); add two more fields, `operationIdentifierCollisions: readonly string[]` and `trialSetDisagreements: readonly string[]`, pre-rendered like `isolationViolation` since score computes and renders these itself rather than getting a structured payload from `ingest`.
- `src/core/score/ladder.ts:248-258` — `isolation-manifest-violation` row: map the array, one basis line per entry (already the pattern Decision 4 in Story 8.1 anticipated).
- `src/core/score/ladder.ts:107` (`AssessmentCommon.evaluatorRecommendation`), `:129-137` (`ProductionAssessment`/`ContractAssessment`) — no type change needed here; score.ts must simply supply this field from the widened `ValidatedObservations` when assembling the assessment, which today has no source anywhere in `src/`.
- `src/core/score/ladder.ts:224-349` (`INVALID_ROWS`) — append ten rows: the eight rungless conditions, `operation-identifier-collision`, and `trial-set-field-disagreement`. Each row's `reasons()` reads its new `EvidenceIntegrityInputs` field.
- `src/core/ingest/conditions.ts:258-276` — widen `LadderTarget`, repoint the eight `LADDER_TARGETS` entries off `null`.
- `tests/ingest/conditions.test.ts:56-75` — the "eight rungless kinds" case becomes "zero rungless kinds" (`toEqual([])`).
- `src/core/score/reduce-trials.ts:98-117` — add the `undefined`-group branch and the `catchThreshold` range check.
- `src/core/score/strength.ts:168-177` — guard the duplicate-`probeId` overwrite in `outcomesByProbeId`.
- `docs/ad21-verdict-decision.generated.md`, `src/core/score/ladder-table.ts` — regenerate; both ladders' Invalid section gains the ten rows (shared array, so one regeneration covers both).
- `_bmad-output/implementation-artifacts/deferred-work.md` — close the operationId-collision entry (built here); reassign the private-artifact-digest entry's owner to Story 8.3; add one new entry naming Story 8.3 as `checkModeAgreement`'s real caller and quoting epics.md's Story 8.2 AC sentence this spec diverges from (Decision 4).
- `tests/score/score.test.ts` — new. One case per I/O Matrix row, built on the fixtures `tests/schemas/fixtures/artifact-fixtures.ts` already ships plus `tests/ingest/ingest.test.ts`'s fixture-mutation idiom for triggering each of the ten new conditions.
- `vitest.config.ts:31-35` — no new glob: `src/core/score/**` is not empty and already inside the global 90/90 floor; unlike Story 8.1's brand-new `ingest/` directory, no empty-glob trap applies here (Decision 6).

## Tasks & Acceptance

**Execution:**
- [x] `src/core/ingest/ingest.ts` — widen `ValidatedObservations` with `evaluatorRecommendation`, sourced the same way `mode` is.
- [x] `src/core/ingest/conditions.ts` — widen `LadderTarget` to ten members, drop `null`; repoint `LADDER_TARGETS`' eight `null` entries.
- [x] `src/core/score/ladder.ts` — widen `EvidenceIntegrityInputs` (isolationViolation to array, add ten new fields: eight `Extract<IngestCondition,…>` plus two pre-rendered `readonly string[]`); update the `isolation-manifest-violation` row; append ten Invalid rows (eight rungless conditions + `operation-identifier-collision` + `trial-set-field-disagreement`) to `INVALID_ROWS`.
- [x] `src/core/stage-contracts.ts` — add `ScoreStage<Trials, Product>` (see Decision 11 for the two-parameter divergence from the Code Map's `ScoreStage<Product>` shorthand).
- [x] `src/core/score/reduce-trials.ts` — add the exhaustiveness branch and the `catchThreshold` range check, each throwing on a non-domain input.
- [x] `src/core/score/strength.ts` — guard the duplicate-`probeId` case in `outcomesByProbeId`.
- [x] `src/core/score/score.ts` — the stage: orchestrate the full chain per the Code Map, deriving `probeQualified` (from whichever `sealProbeSet` bucket the probe lands in, never throwing), `judgeConduct`, and `preflightPassed`; accepting `waiver` and `evaluationFault` as caller-supplied parameters; detecting the operationId collision and cross-trial field disagreement; choosing and stamping `mode` and `evaluatorRecommendation` from the trial set; returning `ScoredOutcomesAndVerdict` (bundles the resolved `ProductionAssessment`/`ContractAssessment` plus the `LadderResolution` — the "outcome and verdict values emit serializes", per AD-24; use `worked-example-target.ts:1250-1473`'s field-by-field assembly as the concrete precedent for what emit will need).
- [x] `src/core/lineage/stage-table.ts` — set the `score` row's `module`.
- [x] `docs/ad21-verdict-decision.generated.md` — regenerate via `npm run generate:ad21-table`.
- [x] `tests/ingest/conditions.test.ts` — update the rungless-kinds assertion to expect none.
- [x] `tests/score/score.test.ts` — one case per I/O Matrix row, plus the ten new ladder rows' fixtures.
- [x] `tests/score/ladder.test.ts` — extend for the widened `EvidenceIntegrityInputs` and the ten new rows.
- [x] `tests/score/reduce-trials.test.ts` — the out-of-domain state and the `catchThreshold` range cases.
- [x] `tests/score/strength.test.ts` — the duplicate-`probeId` case.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` — close the operationId-collision entry; reassign the private-artifact-digest owner to Story 8.3; add the `checkModeAgreement` entry for Story 8.3, quoting the epics.md sentence it resolves.
- [x] `_bmad-output/project-knowledge/learning-path-step-by-step.md` — add this story's step, after peer review findings are addressed and before local review.

**Acceptance Criteria:**
- Given `STAGE_SIGNATURES.score`, when the stage ships, then its `module` names the new file and its five declared inputs are byte-identical to today's.
- Given a trial set with no ingest conditions, a passing preflight verdict, `waiver: 'none'`, and `evaluationFault: false`, when `score` runs, then the resolved verdict is `PASS` with an empty basis.
- Given a trial whose `ValidatedObservations.conditions` carries a `judge-result-unscored` entry, when `score` runs, then every oracle's `OutcomeInputs.judgeConduct` is `'malformed'` and the `judge-malformed` row fires.
- Given any one of the eight previously-rungless conditions on any trial, when `score` runs, then its new Invalid row fires with a basis line naming it, and `check:ad21-table` is green against the regenerated table.
- Given an observation whose `operationId` matches an operation in two different `permittedInterfaces` entries, when `score` runs, then `operation-identifier-collision` fires.
- Given two trials in one set whose `mode` or `evaluatorRecommendation` disagree, when `score` runs, then `trial-set-field-disagreement` fires naming the field and both values, and no assessment is built from a silently-picked value.
- Given a probe `sealProbeSet` rejects, when `score` runs, then `probeQualified` is `false` and nothing throws.
- Given the full suite, when `npm run validate` runs, then it exits 0 with nothing on stderr, `src/core/**` meets its 90/90 floor, `check:boundary` and `check:lineage` pass, and `check:ad21-table` passes against the regenerated table.

## Spec Change Log

**Round 1, 2026-09-03 — peer review of the first draft.** One sibling Claude Code session verified every Code Map anchor against source and returned eight findings; all eight are folded into this revision.

- **`AssessmentCommon.evaluatorRecommendation` had no source (critical).** The draft's `score.ts` signature and Code Map never supplied it, so the stage could not construct valid input to `resolveProductionVerdict`/`resolveContractVerdict` at all — the very step the Code Map named as terminal. `ValidatedObservations` now widens by one field, mirroring `mode`'s own precedent exactly (Decision 8).
- **Cross-trial disagreement had no mechanism.** The draft's I/O Matrix asserted a `mode` mismatch across trials is "recorded," naming no row, no field, and contradicting itself between its Expected Output and Error Handling cells. Widening `ValidatedObservations` exposed the same problem for `evaluatorRecommendation`. Both close under one new row, `trial-set-field-disagreement` (Decision 8).
- **The ninth row's field was mistyped.** The draft's Code Map said all new `EvidenceIntegrityInputs` fields were `Extract<IngestCondition, …>`, but `operation-identifier-collision` is computed by `score.ts` itself, not by `ingest`, so no such `IngestCondition` variant exists. It and the new tenth row now use plain pre-rendered `readonly string[]` fields instead.
- **`probeQualified`'s cited precedent throws on a legitimate domain outcome.** The worked example's `admitted.result.qualified` depends on a `fail()` call that throws when the probe is rejected, which the Always clause forbids copying. `probeQualified` now reads `.result.qualified` off whichever of `sealProbeSet`'s two buckets the probe actually lands in.
- **The `outcome.ts:58-61` citation overreached.** Those lines document AD-5 waiver expiry only; nothing in `outcome.ts` discusses `evaluationFault` or AD-26. The citation is narrowed to the waiver half, and `evaluationFault`'s caller-supplied status is now justified by the absence of any source, not by a borrowed sentence.
- **Decision 2 overstated "already run-scoped."** `outcome.ts:73-75` states the opposite intent — conduct "arrives per oracle" by design — so the decision's real justification (no schema maps a rubric criterion to an oracle) stands alone without that framing, which conflated a different fact.
- **Decision 6 miscounted twelve modules where thirteen exist.** Corrected; the decision's substance is unaffected.
- **`checkModeAgreement`'s reassignment to Story 8.3 diverges from epics.md's own Story 8.2 acceptance-criteria wording**, which reads "the mode-specific assessment type is chosen from the record's own `mode` with `checkModeAgreement` enforced rather than merely exported." The technical argument for the reassignment is sound (score never produces the `EvidenceArtifact` the check's second parameter needs) and epics.md is not amended — per standing instruction, the divergence is recorded here rather than silently overridden or escalated into a planning-doc edit. See Decision 4.

**Round 1 re-verify, 2026-09-03.** The same session re-checked all eight fixes against source: the `evaluatorRecommendation` widening breaks no existing consumer (every `ValidatedObservations` assertion in `tests/ingest/ingest.test.ts` is field-scoped, never a whole-object match), the plain-`readonly string[]` field pattern for the two score-computed conditions matches Story 8.1's own precedent for `isolationViolation` rather than inventing a new one, and a rejected probe needs no eleventh row: `probe-unqualified` already resolves to `infrastructure-error`, which the existing `invalidating-state` row catches (the I/O Matrix row is corrected to say so). One polish item, folded into Decision 8: a trial-set disagreement still forces `score.ts` to construct one concrete `ProductionAssessment`/`ContractAssessment` variant from the first trial's values, since the type is a discriminated union with no third option — non-silence comes from the Invalid row's basis line naming both disagreeing values, not from withholding a value. No other issue found.

**Round 2, implementation, 2026-09-03.** Building `score.ts` surfaced three things the two review rounds did not reach, none inside the frozen block, all settled by construction per standing instruction: `AssessmentCommon.evidenceIntegrity.disclosure`, `.remediationState`, and `.findings` had no cited source anywhere in this spec. `findings` is a plain, undisputed derivation from score's own declared trial inputs — a flat pool of every trial's own findings, mirroring the worked example's own field-by-field assembly the Design Notes already point at. `disclosure` and `remediationState` are not derivations at all (Decisions 9 and, after the patch round below, the corrected reasoning folded into it): both arrive declared with a neutral value, since score's five inputs carry no source for either. `designatedOracleIdOf` is anchored on `probe.behaviorId` rather than the worked example's `defects[0]?.behaviorId`, since the latter is unset on a canary or a clean control and this stage must not throw on either; and `buildPlanIndex` needed `duplicateIds: 'unresolved'` (Decision 10) or the `operation-identifier-collision` row's own triggering scenario crashed before reaching it.

**Round 3, patch review, 2026-09-03.** A three-lens parallel review (blind hunter, edge-case hunter, verification gap) ran against the implemented diff; nine findings were classified `patch` and applied in one pass, none inside the frozen block. The two with the widest blast radius: `remediationState`'s Round 2 reasoning was itself wrong — `validateLineageChain([contract], {...})` is not a derivation at all, since a one-element array only self-validates when `contract.revisionCount === 0`, and any ordinarily-revised contract (`revisionCount > 0`) fired the pre-existing `lineage-chain-inconsistent` FAIL row unconditionally, regardless of whether anything was actually wrong; it is now declared, on `disclosure`'s own posture, per the corrected Decision 9. And two last-write-wins bugs of the exact class `strength.ts`'s `outcomesByProbeId` fix already closed elsewhere in this story: `designatedState` (no schema constrains `Oracle.id` to be unique, so two oracles sharing the designated id silently overwrote each other's vote) and `citedFinding` (two distinct defect findings citing one oracle silently picked whichever `.find()` returned first, rather than treating the ambiguity as `citedFinding: null`). The other five findings were a false collision from double-counting one interface's own repeated `operationId` across two of its operations, a ladder row using a boolean conditional where its nine siblings all `.map()` (one basis line per occurrence, not one regardless of count), a stale two-parameter-vs-one-parameter `ScoreStage` mention in `stage-contracts.ts`'s own header prose (Decision 11), a test double-invoking the function under test, `ingest.ts`'s `evaluatorRecommendation` passthrough shipping with no test asserting it reads from the record at all, and test coverage gaps for behavior `score.ts`'s own comments already document as handled (an empty trial set, an oracle with no check, an empty or ambiguous designated-oracle chain, an empty `contract.oracles`, a canary probe) with no I/O Matrix row requiring it.

**Round 4, external peer review, 2026-09-03.** A separate Claude session reviewed the committed diff and found two more instances of the exact ambiguity class Round 3 already guarded twice (`designatedState`, `citedFinding`): the per-oracle `disposition` lookup (`trial.dispositions.find(...)`) and the resolved-finding `severity` lookup (`trial.findings.find((finding) => finding.findingId === resolution.resolvedFrom)`) both silently picked the first match of a schema-legal, only-advisory-flagged duplicate (`SealedRunRecord.oracleDispositions` and `findingId` both carry no uniqueness constraint). Both now use the same guard-rather-than-pick idiom: two dispositions naming one oracle make `disposition: null` (which the existing `disposition-missing` row then reports, same as a genuinely absent disposition), and two findings sharing `resolvedFrom`'s identifier fall through to `severityOfBehaviourFor`'s existing floor instead of reading either candidate's `.severity`. One of the two findings (the disposition one) turned out not to flip any verdict in practice, since the same `duplicate-record-identifier` condition that makes the ambiguity possible always fires alongside it and already wins the `invalid` tier regardless of which disposition would have been picked -- but `assessment.outcomeState.outcomes` is part of score's own returned product and is read by any future consumer independent of the ladder verdict, so the guard was still worth applying for the same reason `citedFinding`'s was.

## Decisions settled by construction

**Decision 1: the trial-set shape lives in `score.ts`'s own signature, not in the stage-table registry.** `STAGE_SIGNATURES.score.inputs` names artifact TYPES, not cardinality, and Story 8.1 established the precedent of changing only `module` on a row. `score.ts`'s parameter type, `readonly ValidatedObservations[]`, is the first code anywhere to declare what "a trial set" means structurally, closing owed item 1's second half exactly where the epic breakdown places it — in the same story that gives `score` a module — without touching the registry.

**Decision 2: `judgeConduct` is derived once per run, not per oracle-criterion.** No schema field maps a rubric criterion to an oracle: `Oracle` (`oracle.ts:40-57`) carries no rubric reference, and `RubricCriterion`'s `evidence` field is an `InteractionPointer`, not an oracle key. `judgeConduct` is `'absent'` when `evalContract.rubrics` is empty (`outcome.ts:75`'s own "ordinary value" case), `'malformed'` when any `judge-result-unscored` condition appears on any trial, otherwise `'conforming'`, and the same value is broadcast to every oracle's `OutcomeInputs` for that run. No oracle-to-criterion correspondence is invented, because none is declared.

**Decision 3: `waiver` and `evaluationFault` are caller-supplied, `judgeConduct` and `probeQualified` are derived.** The epic asks that each of the four hardcoded fields become "derived from a declared input or a documented caller-supplied argument." `probeQualified` was already derived in the reference script; `judgeConduct` is now derivable per Decision 2. Neither `waiver` (AD-5 expiry, which needs a clock) nor `evaluationFault` (no schema field anywhere declares one) has a source among score's five declared inputs. `score.ts` accepts them as explicit, named parameters rather than hardcoding a literal, which is what makes them "documented" instead of silently assumed.

**Decision 4: `checkModeAgreement` is not called here, which diverges from epics.md's literal Story 8.2 wording.** Its signature (`mode-agreement.ts:34-37`) takes `Pick<SealedRunRecord, 'mode'>` and `Pick<EvidenceArtifact, 'mode'>`; score produces no `EvidenceArtifact`, so the call is impossible to make with a real second argument inside this stage. epics.md's Story 8.2 acceptance criteria say "checkModeAgreement enforced rather than merely exported," a sentence this story cannot literally satisfy without inventing a value to stand in for the artifact side. `score.ts` instead chooses `ProductionAssessment` vs `ContractAssessment` from the trial set's own `mode` and stamps that value onto `ScoredOutcomesAndVerdict.mode`, and `trial-set-field-disagreement` (Decision 8) catches a trial set that cannot even agree on its own mode. The real two-sided call becomes possible, and is recorded as owed, in Story 8.3 once `emit` holds an `EvidenceArtifact` to compare against.

**Decision 5: the private-artifact-digest recomputation moves to Story 8.3.** `deferred-work.md`'s third Story-8.1-routed entry left the owner as "8.2 or 8.3." Score's row declares no `private-artifact-manifest` input and no corpus port, so there are no resolved bytes to recompute against inside `score.ts`. `ScoringVersionInputs.corpusDigest` (`evidence-artifact.ts:105`) is a field `emit` constructs, which makes Story 8.3 the natural, buildable owner; this diff updates the entry rather than leaving two candidate stories.

**Decision 6: no per-directory coverage glob for `src/core/score/**`.** Story 8.1 added `'src/core/ingest/**'` because that directory was newly created and empty, where an unmatched glob summarises to `"Unknown"` and passes vacuously. `src/core/score/` already holds thirteen tested modules contributing real numbers to the global 90/90 floor; adding one more file does not reintroduce that trap, so the existing global threshold is sufficient.

**Decision 7: kept as one spec despite exceeding the 900–1600 token guideline.** This story composes thirteen already-existing reference functions, widens one shared type across two ladders, and closes two Epic 7 findings and three Story 8.1 deferrals — all in service of the epic breakdown's single stated goal, "score to be one orchestration over them." Splitting along any of those seams would separate a stage from the ladder rows its own conditions need, or the ladder rows from the ingest vocabulary they repoint, none of which is independently shippable. The token ceiling is a proposal, not a gate, and the epic's own story boundary already made the single-goal call.

**Decision 8: `evaluatorRecommendation` is carried onto `ValidatedObservations` exactly like `mode`, and both fields are asserted to agree across every trial in a set.** `AssessmentCommon.evaluatorRecommendation` is required, and two shared ladder rows already read it; nothing in the codebase before this story supplies it to anything score-shaped. The fix mirrors Story 8.1's own precedent for `mode` — a field the sealed run record fixes and every later stage restates rather than re-derives — so ingest is the natural, minimal place to surface it too, since ingest already parses the record it lives on. Because a trial set is now `readonly ValidatedObservations[]`, both `mode` and `evaluatorRecommendation` are per-trial values that a single assessment needs as one value: `score.ts` asserts every trial agrees with the first, and a disagreement is `trial-set-field-disagreement`, a new Invalid row rather than a thrown exception (the Always clause forbids throwing on a domain input, and a caller batching mismatched trials is exactly that — a real, reportable mistake, not a crash). `ProductionAssessment`/`ContractAssessment` is a discriminated union, so score.ts must still construct exactly one concrete variant to call either resolver — TypeScript admits no third option. On a disagreement, the first trial's values build that one necessarily-single assessment; what keeps this non-silent is not withholding a value but the Invalid row's own basis line, which names the field and both disagreeing values regardless of which trial's value happened to build the assessment.

**Decision 9: `EvidenceIntegrityInputs.disclosure` and `AssessmentCommon.remediationState` both arrive declared, on the same posture the module already states for `EvidenceIntegrityInputs`' three sibling booleans.** Neither `EvidenceDisclosure` nor a source for it is among score's five declared inputs, its two caller-supplied parameters, or `ValidatedObservations`' own fields (Story 8.1 never carried `SealedRunRecord.evidenceDisclosure` through, and this story's own frozen boundaries widen `ValidatedObservations` by exactly one field, `evaluatorRecommendation`, so a second widening is not this story's to make). `ladder.ts`'s own `EvidenceIntegrityInputs` doc comment already states the reasoning for `overTruncated`, `unavailable`, and `internallyInconsistent`: each "arrives declared rather than derived" because nothing in the tree supplies it. `disclosure` joins them on the identical reasoning rather than a new one: `score.ts` supplies the honest neutral value `{truncationBound: null, reportedIncomplete: false}` and the two rows that read `disclosure.reportedIncomplete` and the truncation bound never fire from it.
`remediationState` was first (Round 2) treated as a derivation via `validateLineageChain([contract], {...})`, which looked buildable since every operand it takes is one of score's own declared inputs. It is not a real derivation: that call validates a *chain* of revisions, and `[contract]` is a one-element array, which only self-validates when `contract.revisionCount === 0`. Any ordinarily-revised contract (`revisionCount > 0`, the exact case AD-29's lineage machinery exists to track) fails the root, parent-resolution, and length checks against an array holding no ancestors to check against, firing the pre-existing `lineage-chain-inconsistent` FAIL row unconditionally, regardless of whether the presented contract is actually inconsistent. Score's five declared inputs carry only the current contract, never an ancestor chain, so there is no real chain here to validate either way; `remediationState` now arrives declared as `{lengthConsistent: true, noRepeatedDigest: true, noGap: true}`, the vacuously-true value for "no chain was presented." Neither field is filed to `deferred-work.md`: the three sibling booleans carry no entry there either, since "arrives declared" is this module's permanent, already-documented posture rather than a gap owed to a future story.

**Decision 10: `buildPlanIndex` is called with `duplicateIds: 'unresolved'`, not its own default `'throw'`.** The worked example's own call takes the default, which is safe there because its one hand-authored contract never collides an `operationId` across two interfaces. `score.ts` scores an arbitrary caller-supplied contract, and two `permittedInterfaces` entries declaring the same `operationId` is exactly the domain input `operation-identifier-collision` (Decisions above, and the ninth new Invalid row) exists to describe -- discovered when a fixture reproducing that exact scenario for the row's own test made `buildPlanIndex` throw a bare `TypeError` before `score.ts` ever reached its own collision detection. `duplicateIds: 'unresolved'` removes every ambiguous identifier from the index's own lookup rather than crashing, which is `plan-index.ts`'s own documented escape hatch for "standalone structural checks," and score's per-observation collision detection reads `contract.permittedInterfaces` directly rather than through the index, so nothing downstream depends on the index having resolved the ambiguous entry.

**Decision 11: `ScoreStage` is generic over two type parameters, `<Trials, Product>`, diverging from the Code Map's own `ScoreStage<Product>` shorthand.** The Code Map's reasoning for making `IngestStage` generic applies twice over for score, not once: a concrete `ScoredOutcomesAndVerdict` (the *return* type) would import `core/score/score.ts`, which is the exact problem the Code Map names, but a concrete `readonly ValidatedObservations[]` (the trial-set *parameter* type) has the identical problem in the other direction -- `ValidatedObservations` is defined in `core/ingest/ingest.ts`, not in `core/schemas/`, so naming it concretely in `stage-contracts.ts` would import `core/ingest/` the same way a concrete product type would import `core/score/`. Generalising over both type parameters keeps `stage-contracts.ts` importing schema types only, exactly as `IngestStage`'s own precedent already does for its single parameter.

## Design Notes

The organizing constraint is AD-24's own sentence: "score produces the outcome and verdict values emit serializes." `ScoredOutcomesAndVerdict` is not a new artifact — it is exactly the pairing of the assessment `resolveProductionVerdict`/`resolveContractVerdict` consume (`ProductionAssessment`/`ContractAssessment`, already typed in `ladder.ts`) with the `LadderResolution` they return. `scripts/worked-example-target.ts:1250-1473`'s hand-assembly is the field-by-field precedent for what a consumer (Story 8.3's `emit`) will read off it; nothing here should invent a second shape.

The ten new Invalid rows are additions to one shared array (`INVALID_ROWS`), which both ladders already spread in full — there is no per-mode split to design, since AD-21's text carries none for these conditions, exactly as the existing eleven rows already assume. Eight are structured payloads `ingest` already computed; two (`operation-identifier-collision`, `trial-set-field-disagreement`) are pre-rendered strings `score.ts` computes itself, following `isolationViolation`'s own precedent for a condition the ladder only needs to display.

## Verification

**Commands:**
- `npm run typecheck` — expected: exit 0.
- `npx vitest run tests/score tests/ingest` — expected: every I/O Matrix row and every new ladder row covered and green.
- `npm run test:coverage` — expected: exit 0, `src/core/**` at or above 90/90.
- `npm run check:boundary` — expected: exit 0.
- `npm run check:lineage` — expected: exit 0.
- `npm run check:layers` — expected: exit 0 (a `score/ladder.ts` ↔ `ingest/conditions.ts` type-only import pair stays same-layer, mirroring the existing reverse direction).
- `npm run generate:ad21-table && npm run check:ad21-table` — expected: regeneration succeeds, then the check is green against the committed file.
- `npm run validate` — expected: exit 0 with no output on stderr.

## Suggested Review Order

**The stage**

- Entry point: the whole orchestration, lifting the worked example's order over a trial set instead of one record.
  [`score.ts:306`](../../src/core/score/score.ts#L306)

- The two new score-computed Invalid conditions, not `IngestCondition` variants since `score` computes them itself.
  [`score.ts:206`](../../src/core/score/score.ts#L206) · [`score.ts:250`](../../src/core/score/score.ts#L250)

- `remediationState` declared as a vacuous pass rather than validated against a chain score was never presented (Round 3 fix).
  [`score.ts:673`](../../src/core/score/score.ts#L673)

- `designatedOracleIdOf`, anchored on `probe.behaviorId` so a canary or clean control never throws.
  [`score.ts:135`](../../src/core/score/score.ts#L135)

**The trial-set shape**

- `ScoreStage` widens to two generics, `Trials` and `Product` — the first code anywhere to give `validated-observations` a trial-set shape.
  [`stage-contracts.ts:91`](../../src/core/stage-contracts.ts#L91)

- `ValidatedObservations` carries `evaluatorRecommendation` through exactly like `mode`.
  [`ingest.ts:77`](../../src/core/ingest/ingest.ts#L77) · [`ingest.ts:394`](../../src/core/ingest/ingest.ts#L394)

**The ladder: ten new Invalid rows**

- `EvidenceIntegrityInputs` widens: `isolationViolation` to an array, plus ten new fields for the eight rungless conditions and the two score-computed ones.
  [`ladder.ts:100`](../../src/core/score/ladder.ts#L100)

- `LadderTarget` drops `null` entirely — every ingest condition now has a rung.
  [`conditions.ts:249`](../../src/core/ingest/conditions.ts#L249)

- `evaluator-configuration-absent`'s basis line, corrected from a collapsing ternary to one line per occurrence.
  [`ladder.ts:475`](../../src/core/score/ladder.ts#L475)

**Two Epic 7 findings closed**

- `reduceTrialSet` gains the exhaustiveness branch and the `catchThreshold` range check.
  [`reduce-trials.ts:102`](../../src/core/score/reduce-trials.ts#L102)

- `strength.ts`'s `outcomesByProbeId` guards a repeated `probeId` instead of last-write-wins.
  [`strength.ts:175`](../../src/core/score/strength.ts#L175)

**Registration and generated output**

- `score`'s stage-table row gets its real module.
  [`stage-table.ts:115`](../../src/core/lineage/stage-table.ts#L115)

- The regenerated AD-21 table, now carrying the ten new rows.
  [`ad21-verdict-decision.generated.md`](../../docs/ad21-verdict-decision.generated.md)

**Tests**

- The full I/O Matrix, one case per row, plus the documented-fallback cases the review loop added.
  [`score.test.ts`](../../tests/score/score.test.ts)

- Widened-type and new-row coverage.
  [`ladder.test.ts`](../../tests/score/ladder.test.ts) · [`reduce-trials.test.ts`](../../tests/score/reduce-trials.test.ts) · [`strength.test.ts`](../../tests/score/strength.test.ts) · [`conditions.test.ts`](../../tests/ingest/conditions.test.ts) · [`ingest.test.ts`](../../tests/ingest/ingest.test.ts)
