---
title: 'The emit stage and the evidence artifact it mints'
type: 'feature'
created: '2026-09-03'
status: 'done'
review_loop_iteration: 1
context: []
baseline_commit: 'f42dda00f6e30dc3034873c1bfb1242a33e67726'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `emit`'s stage-table row already declares `lineage: 'mints'` and `owns: 'evidence-artifact'`, but `module: null` — nothing in `src/` builds it. The one place that assembles an `EvidenceArtifact` today is `scripts/worked-example-target.ts:1432-1487`, a seven-field hand-assembly outside the package's own dependency graph. `emit`'s only declared input, `scored-outcomes-and-verdict`, is too narrow for it: `score.ts`'s current product carries only `assessment` and `ladder`, and `emit` also needs the contract, the sealed probe set, the trial-set result, and the run identifier to compute `strength`, `comparabilityKey`, `excludedProbeIds`, and the scoring version — none of which any declared input names.

**Approach:** Widen `ScoredOutcomesAndVerdict` (`score.ts`'s own product, not the stage-table registry) to carry the raw ingredients `emit` needs, mirroring the trial-set-shape precedent Story 8.2's Decision 1 already set. `emit.ts` becomes a pure function over that widened product plus the three caller-attested digests AD-11 names, computing the scoring version, the comparability key, and the strength vector, and minting `parentDigest`/`revisionCount` as the lineage root every evidence artifact is today.

## Boundaries & Constraints

**Always:**
- `emit.ts` throws nothing for a domain input; the one throw in this stage (a `mode` disagreement between the assessment and the artifact `emit` just built from it) is reachable only through a type-system bypass, since `artifact.mode` is stamped from `scored.assessment.mode` in the same function — mirroring `reduceTrialSet`'s own `TypeError`-for-bypass-only-input precedent rather than AD-28's registry, since no AD-28 code names a mode disagreement.
- `stage-table.ts:131-138`'s `emit` row changes only `module` to `'src/core/emit/emit.ts'`. Its `inputs` stays `['scored-outcomes-and-verdict']`. `valueInputs` widens from `[]` to `['corpusDigest', 'fixtureDigest', 'evaluatorConfigurationDigest']`, added to `STAGE_VALUE_INPUTS` (`stage-table.ts:44`, currently `['mode']` only) since these three are exactly what that column exists for: "values a stage reads at its boundary that the inputs column does not name."
- `ScoredOutcomesAndVerdict` (`score.ts:88-91`) widens with eight fields, all values `score.ts` already computes or already receives as a parameter: `runId: string`, `contract: EvalContract`, `policy: ScoringPolicy`, `probe: Probe`, `sealedProbes: SealedProbeSet`, `trialSetResult: TrialSetResult`, `outcomes: readonly Outcome[]` (the full evidence-artifact shape, built alongside the existing `ScoredOutcome[]` array in the same oracle loop, never replacing it), `uncitedFindings: readonly FindingId[]`. No stage-table field changes for `score`.
- `ValidatedObservations` (`ingest.ts:68-88`) widens by one field, `runId: string`, read off `record.runId` the same way `mode` and `evaluatorRecommendation` already are (Story 8.2's own precedent, twice). `score.ts` reads it off the first trial exactly like `mode`/`evaluatorRecommendation` (`score.ts:672-675`).
- `emit`'s three caller-attested digests (`corpusDigest`, `fixtureDigest`, `evaluatorConfigurationDigest`) are explicit, named, caller-supplied parameters — never read off any declared input, since no declared input carries them and AD-11 names all three caller-attested. `callerAttestedInputs` is a fixed four-member constant, `['corpusDigest', 'fixtureDigest', 'evaluatorConfigurationDigest', 'mode']`: the epics.md AC requires `mode` join the other three as "the one field that can only be caller-supplied."
- `contractSchemaVersion` reads `contract.schemaVersion`; `scoringPolicyDigest` is computed here, `digestArtifact(policy, 'ScoringPolicy')`; `scoringVersion` is computed here, `digestArtifact(scoringVersionInputs, 'ScoringVersionInputs')` — AD-11's "computed by the scorer... never caller-supplied", and `emit` is the only stage minting artifact-identity fields.
- `comparabilityKey` is `digestArtifact({scoringPolicyDigest, probeIds: sealedProbes.admitted probe ids, sorted}, 'ComparabilityKey')`, matching `scripts/worked-example-target.ts:1448-1456`'s existing derivation exactly. `excludedProbeIds` is `sealedProbes.rejected`'s probe ids.
- `exitCode` is `scored.ladder.exitCode`; `verdictBasis` is `[...scored.ladder.basis]` (`LadderResolution`, `ladder.ts:197-203`) — both required, both otherwise unmentioned fields, sourced the same way `worked-example-target.ts:1459-1460`'s own precedent does. The new parallel `Outcome[]` array's `probeId` field is `probe.probeId`, constant across every entry since one `score()` call scores exactly one probe.
- `strength.vector` is `buildStrengthVector(sealedProbes.admitted, new Map([[probe.probeId, trialSetResult]]))`. `strength.basis` is the literal `'measured'`: `matchProbeWitness` is the only shipped producer of a `Strength.basis` value in a reachable path (`quotation.ts:225`'s own header states `reconstructDetection` — the only `'reconstructed'` producer — is dead code in v0, callable by nothing), so the field carries no real second value to select between.
- `strength.comparable` is `trials.completed >= trials.declaredMinimum && no outcome resolved 'unreached'`, read off `assessment.outcomeState` directly, matching `scripts/worked-example-target.ts:1417-1418`'s existing rule.
- `remediation.revisionCount` is `contract.revisionCount` (AD-12's remediation count, distinct from the artifact's own root `revisionCount`); `remediation.cap` is `policy.remediationCap`; `remediation.capSource` is the literal `'caller-attested'`; `remediation.lineageChain` is `assessment.remediationState` (already the `LineageChain` shape per Story 8.2's Decision 9) — reused, not recomputed.
- `Outcome.disposition`, on a `null` local disposition (no disposition, or the ambiguity guard from Story 8.2's own oracle loop), is the literal `'not-attempted'` — the third member of `ORACLE_DISPOSITIONS` (`sealed-run-record.ts:123-127`), the honest reading of "nothing was recorded" rather than an invented fourth value.
- `parentDigest: null, revisionCount: 0` unconditionally: this epic mints no revision path, matching `seal.ts:89-100`'s own root-artifact precedent exactly for the one other `lineage: 'mints'` stage with a built module.
- `checkModeAgreement` (`mode-agreement.ts:34-46`) is called for real, `checkModeAgreement({mode: scored.assessment.mode}, {mode: artifact.mode})`, immediately before `emit` returns — closing the `deferred-work.md` entry that named this story as owner. Present-tense trivial by construction today (`artifact.mode` is stamped from `scored.assessment.mode` in the same function), but exported and load-bearing the moment a future caller assembles the widened product from two independently-sourced values instead of through `score()`.
- `src/core/emit/private-artifact-digest.ts` — new, small, pure module, exporting a comparator (not part of `EmitStage`'s own signature or the `emit` stage-table row) that checks a `PrivateArtifactManifest`'s declared per-entry digests against a map of resolved digests and throws `RuntimeFault('digest-mismatch', ...)` on the first disagreement, per `private-artifact-manifest.ts:32-34`'s own "a mismatch is an AD-28 `digest-mismatch` fault." No caller yet: resolving each entry's bytes needs `CorpusPort.resolve`, an async port method (`src/ports/corpus-port.ts:9`), and AD-34 makes awaiting a port `application/`'s job, not core's — Story 8.4 is the buildable owner of the port-awaiting call site. This closes the "nothing computes it" half of the `deferred-work.md` entry this story inherited; the invocation half is reassigned to Story 8.4 in the same diff.
- `strength.ts:168-185`'s duplicate-`probeId` guard is **already shipped** by Story 8.2 (confirmed by direct read: the `if (byProbeId.has(...)) continue` guard at line 181 is present) — epics.md's AC sentence naming it here is now satisfied by the earlier story rather than this one; no code change, only the epics.md-divergence record below.
- `docs/ad21-verdict-decision.generated.md` is unaffected: this story adds no ladder row, so `npm run check:ad21-table` needs no regeneration.
- No new interchange artifact, no `schemaVersion` bump: `EvidenceArtifact` parses at its current `schemaVersion: 3` with no field added, removed, or retyped.
- `scripts/worked-example-target.ts:1432-1487`'s hand-assembly is deleted and replaced with a call to `emit()`, assembled from the same local variables (`assessment`, `ladder`, `sealedProbes`, `reduced`, `record.runId`, `contract`, `POLICY`, `probe`, `outcomes`) the hand-assembly already reads — the script does not yet call `core/ingest` or `core/score/score.ts` (that rewiring is Story 8.5's), only the final artifact-construction step changes.
- `README.md:117,128-132`'s "emit has no code at all", the `score`/`emit` pairing in "carries `module: null` on those two rows and on no others", and the "not built" framing are all corrected in this diff by removing the not-built framing entirely, not by re-pointing it at `emit` alone: after this story every `PIPELINE_STAGES` row carries a real module, so a sentence naming any stage as unbuilt is false the moment this diff lands, not just imprecise.

**Ask First:** none. Every ambiguity this investigation found (where the widened fields live, the `Outcome.disposition` default, `Strength.basis`'s constant value, the private-artifact-digest check's home and owner split) is settled by construction above, per standing instruction to decide rather than escalate.

**Never:**
- No corpus-port call inside `core/emit/`: AD-1 forbids a port await under `core/`, and `emit.ts` itself takes already-resolved digests as parameters, never a `privateRef` or a byte-resolution request.
- No widening `stage-table.ts`'s `emit.inputs` beyond `['scored-outcomes-and-verdict']`: the three caller-attested digests are `valueInputs`, not artifacts, and no other artifact is genuinely `emit`'s own declared input.
- No rewiring `scripts/worked-example-target.ts` to call `core/ingest` or `core/score/score.ts` — that is Story 8.5's fixed-point proof, out of scope here.
- No new AD-5 or AD-28 code: `digest-mismatch` already exists in `RUNTIME_FAULT_CODES` (`faults.ts:15`) with no prior thrower; this story gives it its first one.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Clean production run | `scored.assessment.mode === 'production'`, ladder PASS | artifact parses, `mode: 'production'`, `productionVerdict` set, no `contractVerdict` key | N/A |
| Contract-scoring run with an uncited defect finding | `assessment.uncitedDefectFindings` non-empty | `uncitedFindingGaps` carries it, `systemRecommendationRecorded`/`Note` set from the assessment | N/A |
| A rejected probe alongside the scored one is impossible per-call | `sealedProbes` always holds exactly one probe (score is per-probe) | `excludedProbeIds` is `[]` whenever the scored probe itself qualified, one entry when it did not | N/A |
| An oracle's local `disposition` is `null` | ambiguity guard fired in `score.ts`'s own loop | that outcome's `Outcome.disposition` is `'not-attempted'` | N/A |
| `assessment.outcomeState.outcomes` contains an `unreached` state | one or more oracles unreached | `strength.comparable` is `false`, vector still reported | N/A |
| `trials.completed < trials.declaredMinimum` | below-minimum-trial-count already fired upstream | `strength.comparable` is `false` | N/A |
| `PrivateArtifactManifest` entry digest disagrees with its resolved bytes | `private-artifact-digest.ts`'s comparator given a mismatching map | throws `RuntimeFault('digest-mismatch', ...)` | thrown (non-domain, AD-28 fault) |
| `scored.assessment.mode` disagrees with the artifact `mode` `emit` just built | reachable only through a type-system bypass | thrown `TypeError`, never a ladder row | thrown (non-domain input) |

</frozen-after-approval>

## Code Map

- `src/core/emit/emit.ts` — new. The stage. Signature: `(scored: ScoredOutcomesAndVerdict, corpusDigest: Digest, fixtureDigest: Digest, evaluatorConfigurationDigest: Digest) => EvidenceArtifact`. Builds `scoringVersionInputs`, `scoringVersion`, `comparabilityKey`, the strength block, the remediation block, and the mode-discriminated artifact object; calls `checkModeAgreement` last.
- `src/core/emit/private-artifact-digest.ts` — new. `checkPrivateArtifactManifestDigests(manifest: PrivateArtifactManifest, resolvedDigests: ReadonlyMap<string, Digest>): void`, throwing `RuntimeFault('digest-mismatch', 'PrivateArtifactManifest.entries[...]', ...)` on the first `entries[i]` whose `resolvedDigests.get(entry.privateRef)` disagrees with `entry.digest`. No caller in this story.
- `src/core/score/score.ts:88-91` — widen `ScoredOutcomesAndVerdict` with `runId`, `contract`, `policy`, `probe`, `sealedProbes`, `trialSetResult` (the existing local `reduced`, renamed on the return only), `outcomes` (new parallel `Outcome[]` array built in the existing oracle loop beside `allOutcomes.push(...)`, reading the loop's own local `disposition`/`checkResolution`/`resolution`/`severity`), `uncitedFindings` (`trials.flatMap(trial => uncitedFindingIds(recordPickOf(trial)))`, reusing the module's own `recordPickOf` shim and `outcome.ts`'s exported `uncitedFindingIds`).
- `src/core/ingest/ingest.ts:68-88,389-423` — widen `ValidatedObservations` with `runId: string`, read off `record.runId`, returned alongside `mode`/`evaluatorRecommendation`.
- `src/core/lineage/stage-table.ts:44,131-138` — `STAGE_VALUE_INPUTS` gains three members; `emit.module = 'src/core/emit/emit.ts'`; `emit.valueInputs = ['corpusDigest', 'fixtureDigest', 'evaluatorConfigurationDigest']`.
- `src/core/stage-contracts.ts` — add `EmitStage<Input>`, one generic parameter (not two): `EvidenceArtifact` lives in `core/schemas/evidence-artifact.ts`, a location this file already imports concretely from for eight other schema types (`stage-contracts.ts:13-21`), so importing one more concrete type from the same directory creates no cycle; only the input (`ScoredOutcomesAndVerdict`, defined in `core/score/score.ts`) needs genericity to avoid the import-cycle `IngestStage`/`ScoreStage` both exist to avoid.
- `src/core/score/mode-agreement.ts` — no code change; gains its first caller, from `emit.ts`.
- `scripts/worked-example-target.ts:1432-1487` — delete the hand-assembly; replace with `const artifact = emit(scoredOutcomesAndVerdict, digestPlaceholder(14), digestPlaceholder(15), record.evaluatorConfigurationDigest)` where `scoredOutcomesAndVerdict` is assembled from this function's own existing locals (`assessment`, `ladder`, `contract`, `POLICY`, `probe`, `sealedProbes`, `reduced`, `record.runId`, `outcomes`) in one object literal immediately above the call.
- `README.md:117,128-132` — remove the "not built" / "no code at all" / "one stage with no module" framing entirely, since after this story's own diff every `PIPELINE_STAGES` row carries a module and the sentence would be false rather than merely imprecise.
- `_bmad-output/implementation-artifacts/deferred-work.md` — close the `checkModeAgreement` entry (called here) and the `ScoredOutcomesAndVerdict`-too-narrow entry (widened here); split the private-artifact-manifest entry into "comparator built, story 8.3" (closed) and "port-await and wiring, story 8.4" (reassigned, new entry); reassign the coupled `isolationManifestArtifact`-digest-reference entry (lines 418-429, whose own text pegs its owner to "the same owner the private-artifact digest carries") to story 8.4 alongside that split's port-awaiting half, since the comparator this story ships does not help this entry (it is a different digest comparison, `SealedRunRecord.isolationManifestArtifact.digest` against a recomputed artifact digest, not a `PrivateArtifactManifest` entry); no change to the three no-owner entries (AD-17 rubric half, empty-violation-string, `IsolationManifest.contractId`'s unmatched operand) or the one Story-8.2-routed cross-trial-duplicate entry.
- `tests/emit/emit.test.ts` — new. One case per I/O Matrix row plus a production-mode case and a contract-scoring-mode case, built on `tests/schemas/fixtures/artifact-fixtures.ts` and a hand-built `ScoredOutcomesAndVerdict` fixture.
- `tests/emit/private-artifact-digest.test.ts` — new. The match and mismatch cases for the comparator.
- `tests/lineage/stage-table.test.ts:110-117,183-191` — update the two hardcoded expectations (`LINEAGE_WRITER_MODULES`, the built-stages assertion) now that `emit` ships. The `:99-105` block builds a synthetic `withEmit` override and passes regardless of `emit`'s real module state, so it needs no change.
- `vitest.config.ts` — no new per-directory glob: `src/core/emit/` is small and new but the global 90/90 floor already applies (Story 8.2's Decision 6 precedent: only `ingest/`'s empty-glob-trap risk warranted one, and that risk does not recur here since no glob currently names `emit/` to leave dangling).

## Tasks & Acceptance

**Execution:**
- [x] `src/core/ingest/ingest.ts` — widen `ValidatedObservations` with `runId`, sourced off `record.runId`.
- [x] `src/core/score/score.ts` — widen `ScoredOutcomesAndVerdict` per the Code Map; build the parallel `outcomes: Outcome[]` array; compute `uncitedFindings`.
- [x] `src/core/stage-contracts.ts` — add `EmitStage<Input>`.
- [x] `src/core/emit/emit.ts` — the stage: `scoringVersionInputs`/`scoringVersion`/`comparabilityKey`/strength/remediation construction, the mode-discriminated artifact literal, the `checkModeAgreement` call.
- [x] `src/core/emit/private-artifact-digest.ts` — the pure comparator.
- [x] `src/core/lineage/stage-table.ts` — `STAGE_VALUE_INPUTS` widened; `emit` row's `module`/`valueInputs` set.
- [x] `scripts/worked-example-target.ts` — delete the seven-place hand-assembly; call `emit()`.
- [x] `README.md` — correct the emit/score module-null claims.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` — close two entries, split the third (comparator closed here, port-awaiting half reassigned to 8.4), and reassign the coupled fourth to 8.4, per the Code Map.
- [x] `tests/emit/emit.test.ts` — one case per I/O Matrix row.
- [x] `tests/emit/private-artifact-digest.test.ts` — match/mismatch cases.
- [x] `tests/lineage/stage-table.test.ts` — update the two hardcoded expectations.
- [x] `tests/ingest/ingest.test.ts` — assert `runId` passthrough (Story 8.2's Round 3 found the identical gap for `evaluatorRecommendation`; this widening does not repeat it).
- [x] `tests/score/outcome.test.ts` — widen the closed-vocabulary allowlist so `emit.ts`'s own `'unreached'` read is a sanctioned classification, not a reported violation (Decision 11).
- [x] `tests/architecture/lineage-ownership.test.ts` — move the synthetic `OTHER` fixture path off `src/core/emit/emit.ts`, now a real named lineage writer (Decision 11).
- [ ] `_bmad-output/project-knowledge/learning-path-step-by-step.md` — add this story's step, after peer review findings are addressed and before local review.

**Acceptance Criteria:**
- Given `STAGE_SIGNATURES.emit`, when the stage ships, then its `module` names the new file and `ARTIFACT_PRODUCERS['evidence-artifact']` stays `'emit'`.
- Given a scored production run, when `emit` runs, then the returned artifact parses under `EvidenceArtifact` at `schemaVersion: 3` with no bump.
- Given `emit`'s two lineage fields, when `npm run check:lineage` runs, then it is green and `src/core/emit/emit.ts` is the only new entry in the derived allowlist.
- Given `scoringVersionInputs.mode`, when `callerAttestedInputs` is read, then it names `mode` alongside the three pre-existing caller-attested digests.
- Given `scripts/worked-example-target.ts`'s regenerated output, when `npm run check:worked-example` runs, then it is green (byte-identity is not asserted here; that is Story 8.5's).
- Given the full suite, when `npm run validate` runs, then it exits 0, `src/core/**` meets its 90/90 floor, and `check:boundary`/`check:lineage`/`check:layers` all pass.

## Spec Change Log

**Round 1, 2026-09-03 — peer review of the first draft.** One sibling Claude Code session verified every Code Map/Boundaries/Decisions citation against source; four real findings, folded into this revision.

- **The promised epics.md-divergence record for the already-shipped `strength.ts` guard was missing.** Boundaries referenced "the epics.md-divergence record below" with no such record anywhere in Decisions. Added as Decision 9, mirroring Story 8.2's own Decision 4 pattern for a divergence of the identical shape.
- **The `deferred-work.md` update plan undercounted the no-owner entries and dropped a coupled one.** Three no-owner entries exist, not two (the `IsolationManifest.contractId` entry was omitted), and the `isolationManifestArtifact`-digest-reference entry explicitly pegs its owner to "the same owner the private-artifact digest carries" — the very entry Decision 6 splits in two — so it needed its own explicit reassignment (to story 8.4, alongside the port-awaiting half) rather than silent omission.
- **The planned `README.md` fix would self-contradict the moment this story's own diff landed.** Re-pointing "emit has no code at all" to still name `emit` alone is false the instant `emit` ships a module in the same diff; the fix now removes the not-built framing entirely rather than narrowing its target.
- **`exitCode`, `verdictBasis`, and the new `Outcome[]` array's `probeId` had no stated source.** Trivial derivations (`scored.ladder.exitCode`, `[...scored.ladder.basis]`, `probe.probeId`), but every other field got an explicit sentence and these three did not — added to Boundaries so the wiring is not the one thing nobody double-checks, the same class of gap Story 8.2's Round 1 review rated critical for `evaluatorRecommendation`.

Two items the review raised and did not treat as findings, corrected anyway for citation accuracy: the Code Map's `tests/lineage/stage-table.test.ts:99-105` citation named a block that is actually a synthetic override passing regardless of `emit`'s real state (only `:110-117,183-191` need touching), and `stage-contracts.ts`'s "already imported concretely elsewhere" claim was imprecise (no `EvidenceArtifact` import exists yet, though sibling schema types from the same file do) — both corrected in place.

**Round 1 re-verify, 2026-09-03.** The same session re-checked all six fixes against source and confirmed each substantively correct, then caught three mechanical desyncs the edit pass left behind: the Tasks list's deferred-work.md line still said "two entries... the third" after the Code Map grew a fourth reassigned entry; the Tasks list's stage-table.test.ts line still said "three hardcoded expectations" after the Code Map narrowed to two; and the stage-contracts.ts import count said "six" against an actual count of eight (`stage-contracts.ts:13-21`). All three fixed in place; no further architectural issue found.

**Round 2, 2026-09-03 — automated implementation review (blind-hunter, edge-case-hunter, verification-gap, run in parallel over the diff against `baseline_commit`).** No `intent_gap` or `bad_spec` findings; five `patch` findings applied, one `defer`, the rest rejected as noise or as re-litigating Decision 12 with no new information.

- **`patch`** — `score()`'s own eight widened fields (`runId`, `outcomes`, `uncitedFindings`, `contract`, `policy`, `probe`) were never asserted by any test calling `score()` directly; a regression in the trial-loop's `outcomes.push` (a swapped local, a leaked previous oracle's `checkResolution`) would have passed every existing test. Added cross-checks against `assessment.outcomeState`'s own per-oracle `resolution` in `tests/score/score.test.ts`'s Matrix row 1 case, plus the empty-trial-set `runId` fallback.
- **`patch`** — `emit()`'s `remediation` object and `strength.basis` were schema-parsed but never asserted for content. Added to the existing "mints a fully-shaped" production-mode test in `tests/emit/emit.test.ts`.
- **`patch`** — `emit.ts`'s `remediation.lineageChain` field changed source (from the worked-example script's own `lineage.checks` local to `scored.assessment.remediationState`) with no comment explaining the two are the same `LineageChain` shape, unlike its commented siblings. Added a one-line comment.
- **`patch`** — `stage-contracts.ts`'s `EmitStage` doc comment cited a hardcoded `(lines 13-21 above)` that goes stale on any edit above it. Reworded to a relative reference.
- **`patch`** — `checkPrivateArtifactManifestDigests` had no test for two entries sharing one `privateRef`; added one confirming the existing per-entry check already handles it correctly (not a bug, a coverage gap).
- **`defer`** — `tests/score/fixtures/probe-witness.ts`'s shared `qualifiedProbe` fixture carries a schema-invalid `probeId` ("PX-001"), worked around locally in `tests/emit/emit.test.ts` rather than fixed at the source; pre-existing, surfaced incidentally. Logged in `deferred-work.md`.
- **Rejected** — edge-case-hunter's proposed throw on `scored.ladder.verdict === null` re-raises exactly the tension Decision 12 already settled by construction (the frozen Boundaries commit to one throw only, and the caller's own `if (ladder.verdict === null) fail(...)` guard is the enforcement point); no new information, not reopened. Also rejected: a claim that the `deferred-work.md` reassignment of the `isolationManifestArtifact` entry wasn't reflected in the diff (it was, confirmed by re-reading the hunk); a claim that a "mixed sealed set" needed its own test (the frozen Boundaries state `sealedProbes` always holds exactly one probe per `score()` call, making that scenario impossible); and two cosmetic-only observations (a `STAGE_VALUE_INPUTS` ordering difference from `CALLER_ATTESTED_INPUTS`, and the README's directory-enumeration phrasing) with no functional effect.

## Decisions settled by construction

**Decision 1: widen `ScoredOutcomesAndVerdict`, not `emit`'s stage-table `inputs`.** `deferred-work.md`'s own routing note left both open ("either widens `ScoredOutcomesAndVerdict`... or widens `emit`'s own declared inputs"). Widening the product mirrors Story 8.2's Decision 1 precedent exactly — `STAGE_SIGNATURES` names artifact TYPES, not what a function needs to compute from them — and every one of the eight new fields is already sitting in `score.ts`'s own local scope or parameter list, so nothing new is fetched, only returned. Widening `emit.inputs` instead would mean handing it `eval-contract`, `probe`, and a fabricated `sealed-probe-set` artifact type the registry has never named, for data `score` already has in hand.

**Decision 2: `emit` gets three caller-attested digests as named parameters, not a further `ValidatedObservations`/`ScoredOutcomesAndVerdict` widening.** `corpusDigest` and `fixtureDigest` have no artifact source anywhere in this pipeline — AD-11 fixes them caller-attested — and `evaluatorConfigurationDigest`, though `ingest` already recomputes it internally for the agreement check, is never exposed on `ValidatedObservations` because its own AD-11 status is also caller-attested, not derived. Mirrors `score.ts`'s own `waiver`/`evaluationFault` precedent (its Decision 3): a value with no declared-input source becomes a documented, explicit, caller-supplied parameter, not a hidden default.

**Decision 3: `Outcome[]` is a new parallel array in `score.ts`'s existing oracle loop, not derived from `ScoredOutcome[]` inside `emit`.** The two shapes look related but are not reconstructible from one another: `ScoredOutcome` (`ladder.ts`) carries `resolution` but not `disposition` or the raw `CheckResolution` tree, both of which `Outcome` requires and both of which `score.ts`'s loop already computes locally (`disposition`, `checkResolution`) and discards after building `OutcomeInputs`. `scripts/worked-example-target.ts:1210-1314` already builds this exact pair of parallel arrays (`outcomes`/`scored`) from the same per-oracle locals — Story 8.3 lifts that established two-array pattern into `score.ts` rather than inventing a reconstruction `emit` cannot actually perform.

**Decision 4: `Outcome.disposition` defaults to `'not-attempted'` on a `null` local disposition.** `ORACLE_DISPOSITIONS` is closed at three: `'held'`, `'violated'`, `'not-attempted'`. A `null` disposition inside `score.ts`'s loop means either no disposition was recorded for that oracle or Story 8.2's own ambiguity guard fired (two dispositions naming one oracle); `disposition-missing` already invalidates the run in either case. `'not-attempted'` is not a guess among three equally-plausible options — it is the one member of the closed three that means "nothing was recorded," which is the literal truth of both cases.

**Decision 5: `Strength.basis` is the constant `'measured'`, never computed from a witness.** `quotation.ts:220-229`'s own header states `reconstructDetection` — the schema's only `'reconstructed'` producer — is called by nothing in v0 and can be called by nothing, since every schema version has required an observation identifier and AD-11 rejects a version mismatch outright. `matchProbeWitness` is the only reachable producer of a `Strength.basis` value and it always returns `'measured'` (`witness.ts:249,322`). There is no live second value to select between, so the field is a constant rather than a derivation with an unreachable branch.

**Decision 6: the private-artifact-manifest digest comparator is built here, pure and uncalled; its port-awaiting caller is Story 8.4's.** `private-artifact-manifest.ts:32-34`'s own words ("a mismatch is an AD-28 `digest-mismatch` fault at ingest") name `ingest`, but `private-artifact-manifest` is not one of `ingest`'s three declared inputs (Story 8.1 already routed this out on exactly that ground) and resolving the bytes the comparison needs requires `CorpusPort.resolve`, an async method (`port.ts:26`) — AD-34's "`application/` ... is only where a port is awaited" makes core the wrong layer for the await regardless of which stage's name is nearest in the schema's prose. Splitting the comparator (pure, core, built here) from its invocation (async, port-awaiting, application-layer, Story 8.4) is what AD-34 actually requires; `deferred-work.md`'s reassignment to "story 8.3" is corrected into two entries rather than one story doing both halves.

**Decision 7: `checkModeAgreement` is called for real despite being currently tautological.** `artifact.mode` is stamped from `scored.assessment.mode` inside the same `emit()` call that then compares them, so the check cannot fail through any path this story's own construction reaches. It is still the real call `deferred-work.md` named this story as owner of: `checkModeAgreement` is exported for a caller who may one day assemble the widened product from two independently-sourced values rather than through `score()`, and closing the "still not called anywhere" gap now is what makes that future caller's disagreement catchable at all, rather than deferring the call a second time for a reason (tautology under the one caller that exists today) that will not still be true once a second caller exists.

**Decision 9: epics.md's Story 8.3 acceptance criteria names the `strength.ts` duplicate-`probeId` guard as this story's to close, but Story 8.2 already shipped it.** epics.md's own sentence reads "the duplicate-`probeId` drop at `strength.ts:168-177` is guarded now that outcome arrays are built for real" — written when the epic was broken into stories, before Story 8.2's implementation turned out to close it early (`strength.ts:181`'s `if (byProbeId.has(...)) continue`, confirmed present by direct read). epics.md is not amended for this, on the same standing instruction Story 8.2's own Decision 4 already applied to its `checkModeAgreement` divergence: the technical fact (already closed) is recorded here rather than silently ignored or driving a needless second guard.

**Decision 10: kept as one spec despite exceeding the 900–1600 token guideline.** This story widens one type two stories already established the shape of (`ScoredOutcomesAndVerdict`), builds the stage that consumes the widening, and closes three `deferred-work.md` entries this story is the first one able to close. Splitting the widening from the stage that reads it would ship a wider return type with no caller reading the new fields — dead code by another name. The epic's own story boundary already made the single-goal call; the token ceiling is a proposal, not a gate (Story 8.2's Decision 7, same reasoning).

**Decision 11: `emit.ts` reads AD-6's closed twelve states directly (`outcome.resolution.state === 'unreached'`), which is a new file the shipped closed-vocabulary scanner did not previously allow, and the shipped synthetic-fixture suite's own placeholder path for "any non-writer module" collided with the newly-real `src/core/emit/emit.ts`.** Two implementation-time findings, not spec ambiguities, so both are fixed by construction rather than escalated. First: `tests/score/outcome.test.ts`'s "the boundary the procedure holds" test asserts a closed allowlist of files permitted to name each of the twelve `OUTCOME_STATES` string literals; `emit.ts` reading `'unreached'` to mark `strength.comparable` (Boundaries, above) is the identical classify-never-assign reading `ladder.ts` already has for the same state, so the allowlist gains `src/core/emit/emit.ts` for `'unreached'` alone, not a new assigner. Second: `tests/architecture/lineage-ownership.test.ts`'s synthetic `OTHER` constant stood in for "anywhere else, never an allowlisted lineage writer" and was pinned to `src/core/emit/emit.ts` before this story existed; now that this story adds that exact path to `LINEAGE_WRITER_MODULES`, `OTHER` needed to move to a genuinely synthetic path (`src/core/emit/not-a-writer.ts`), and the one case exercising the real three-member allowlist (`REDUCE`'s "no such file exists" orphan case) needed a file supplied for the new third member (`EMIT`) so only the deliberately-missing one still reports.

**Decision 12: `emit.ts` trusts, rather than re-throws on, a `scored.ladder.verdict` of `null`.** `LadderResolution.verdict` is `Verdict | null`, `null` being AD-21's Invalid rung, and neither the frozen Boundaries nor the I/O Matrix names a row for `emit` receiving one — the closest precedent is `scripts/worked-example-target.ts`'s own `if (ladder.verdict === null) fail(...)` guard, which sits in the calling script immediately before its former hand-assembly and stays there unchanged by this story's diff (Code Map only touches the object-literal lines after it). AD-21 states an Invalid run "never becomes a contract verdict," which reads as the caller's obligation to stop before minting an artifact at all, not a case `emit` itself re-validates: the frozen Boundaries already commits to exactly one throw in this stage (the mode-agreement check), so a second throw here would contradict that text. `emit.ts` therefore reads `scored.ladder.verdict as Verdict`, trusting the precondition the same way `seal()`'s own null-direction guard trusts one call earlier in the pipeline, with the comment at the cast's own site carrying this reasoning for the next reader.

## Design Notes

The organizing constraint is the same AD-24 sentence Story 8.2 built against: "score produces the outcome and verdict values emit serializes." Nothing here invents a second shape for what `score` already produces — `emit` reads `assessment.outcomeState.trials`, `.coverageGaps`, `.uncitedDefectFindings`, `.remediationState`, and (on the contract branch) `.systemRecommendationRecorded`/`.systemRecommendationNote` directly off the existing `assessment`, with no re-derivation. The genuinely new surface is narrow: eight fields on `ScoredOutcomesAndVerdict` that are all values `score.ts` already holds locally or already receives as a parameter, carried one level further because `emit`'s own declared input is deliberately the single narrow product AD-24 names, not a wider bag of artifacts.

`scripts/worked-example-target.ts:1071-1498`'s existing hand-assembly is the field-by-field precedent for every formula in `emit.ts` — `comparabilityKey`, `strength`, `remediation` are lifted verbatim from lines 1448-1484, not redesigned. The one place this story's values diverge from that script's today is `callerAttestedInputs`, which the script still lists as three members; Story 8.3 corrects `emit.ts`'s own list to four and leaves the script's pre-existing three-member list for Story 8.5 to correct when it rewires the call.

## Verification

**Commands:**
- `npm run typecheck` — expected: exit 0.
- `npx vitest run tests/emit tests/ingest tests/score tests/lineage` — expected: every new and updated case green.
- `npm run test:coverage` — expected: exit 0, `src/core/**` at or above 90/90.
- `npm run check:boundary` — expected: exit 0.
- `npm run check:lineage` — expected: exit 0, `src/core/emit/emit.ts` in the derived allowlist.
- `npm run check:layers` — expected: exit 0.
- `npm run check:worked-example` — expected: exit 0 against the regenerated script output.
- `npm run check:docs` — expected: exit 0 against the corrected `README.md`.
- `npm run validate` — expected: exit 0 with no output on stderr.

## Suggested Review Order

**The stage itself**

- Entry point: the widened product in, a mode-discriminated `EvidenceArtifact` out.
  [`emit.ts:41`](../../src/core/emit/emit.ts#L41)

- The one precondition this stage trusts rather than re-throws on (Decision 12).
  [`emit.ts:106`](../../src/core/emit/emit.ts#L106)

**The widened `score()` product feeding it**

- `ScoredOutcomesAndVerdict` grows the eight fields `emit` cannot re-derive on its own.
  [`score.ts:99`](../../src/core/score/score.ts#L99)

- The parallel `Outcome[]` array, built beside the narrower `ScoredOutcome[]` in the same loop.
  [`score.ts:581`](../../src/core/score/score.ts#L581)

- `runId` read off the first trial, same fallback posture as `mode`/`evaluatorRecommendation`.
  [`score.ts:736`](../../src/core/score/score.ts#L736)

- `ValidatedObservations` restates `runId` off the record, one line up the chain.
  [`ingest.ts:70`](../../src/core/ingest/ingest.ts#L70)

**Wiring into the pipeline registry**

- The generic stage-contract type, one type parameter since `EvidenceArtifact` imports concretely.
  [`stage-contracts.ts:118`](../../src/core/stage-contracts.ts#L118)

- `emit`'s row: `module` now names the file, `valueInputs` names the three caller-attested digests.
  [`stage-table.ts:141`](../../src/core/lineage/stage-table.ts#L141)

- `STAGE_VALUE_INPUTS` widens from `['mode']` to include the three digests.
  [`stage-table.ts:49`](../../src/core/lineage/stage-table.ts#L49)

**Replacing the hand-assembly**

- The seven-field hand-assembly becomes one `emit()` call over the widened product.
  [`worked-example-target.ts:1414`](../../scripts/worked-example-target.ts#L1414)

**The uncalled digest comparator**

- Pure and uncalled by design: resolving the bytes it compares against needs an awaited port, Story 8.4's to wire.
  [`private-artifact-digest.ts:24`](../../src/core/emit/private-artifact-digest.ts#L24)

**Peripherals**

- The cross-check regression test: a wrong local in the trial loop would have passed silently before this.
  [`score.test.ts:214`](../../tests/score/score.test.ts#L214)

- The full-shape mint, both modes, schema-parsed.
  [`emit.test.ts:367`](../../tests/emit/emit.test.ts#L367)

- `runId` passthrough, closing the same gap class Story 8.2's own review found for `evaluatorRecommendation`.
  [`ingest.test.ts:208`](../../tests/ingest/ingest.test.ts#L208)

- The synthetic non-writer fixture path moved off `emit.ts`, now a real lineage writer.
  [`lineage-ownership.test.ts:13`](../../tests/architecture/lineage-ownership.test.ts#L13)
