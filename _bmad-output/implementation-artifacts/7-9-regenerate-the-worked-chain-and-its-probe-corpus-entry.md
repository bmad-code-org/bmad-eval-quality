---
title: 'Regenerate the worked chain and its probe corpus entry'
type: 'feature'
created: '2026-09-02'
status: 'done'
baseline_commit: '46a5ba724349b7ddc5a143531d41580a48da3336'
review_loop_iteration: 2
context: [
  '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md',
  '{project-root}/_bmad-output/implementation-artifacts/epic-7-context.md',
  '{project-root}/_bmad-output/implementation-artifacts/7-4-the-ad-40-defect-signature-corpus-qualification-and-the-witness-match.md',
  '{project-root}/_bmad-output/implementation-artifacts/7-5-ad-33-as-a-total-reference-decision-procedure-with-generated-fixtures.md',
  '{project-root}/_bmad-output/implementation-artifacts/7-8-a-rung-for-uncited-defect-findings-and-the-record-it-writes.md',
]
---

# Story 7.9: Regenerate the worked chain and its probe corpus entry

Epic 7, story key `7-9-regenerate-the-worked-chain-and-its-probe-corpus-entry`. Closes owed item 7
(`ARCHITECTURE-SPINE.md:728-741`): the worked chain under
`_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/spike-worked-example/`
is hand-authored evidence of what the pre-epic-7 architecture could not express. Its own
`FINDINGS.md` retraction names three defects and owed item 7 adds a fourth (the undefined `P-001`),
of which the two downstream ones "cannot be hand-corrected honestly" — the chain must be regenerated
by actually calling the reference functions Stories 7.1-7.8 built. No schema changes;
this story is pure instance-data regeneration against schemas already shipped.

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The worked chain's derived fields (dispositions, corroboration, outcome states, the
verdict) were hand-typed against a pre-epic-7 architecture and are now demonstrably wrong: one step
matching zero observations was hand-labelled `confirmed`/`agrees`, two steps each matching two
observations were resolved with no declared cardinality, the contract still carries revision 9's
superseded interface-level `responseShape` instead of per-operation `responseDescriptor`s, and the
probe the run cites, `P-001`, is not defined anywhere in the repository.

**Approach:** Add a `generate:worked-example`/`check:worked-example` script pair, following
`generate-dev-corpus.ts`/`check-dev-corpus.ts`'s fixed-point pattern, whose pure builder takes only
the evaluator-authored evidence (the contract, the probe's declared signature and qualification
record, the raw observations, dispositions, and findings) and derives every downstream value — the
brief, every selection, check resolution, witness match, outcome state, corroboration, the strength
vector, and the verdict — by calling Stories 7.1-7.8's actual functions, never by hand-filling a
result.

## Boundaries & Constraints

**Always:**
- New script triad, mirroring `scripts/dev-corpus-target.ts` / `generate-dev-corpus.ts` /
  `check-dev-corpus.ts`: `scripts/worked-example-target.ts` exports a pure `buildWorkedExample():
  Map<string, string>` (relative path → file text, the same return type `buildDevCorpus` declares at
  `dev-corpus-target.ts:145-147`); `scripts/generate-worked-example.ts` writes each entry;
  `scripts/check-worked-example.ts` rebuilds the map and byte-compares, never rewrites.
  `package.json` gains `generate:worked-example` / `check:worked-example`, and
  `check:worked-example` is added to the `validate` chain (`package.json:108`) beside `check:corpus`.
- Two divergences from the dev-corpus pattern, settled by construction, because
  `spike-worked-example/` is a mixed directory and `corpus/dev/` is not. First, the generator does
  **not** clear the directory: `generate-dev-corpus.ts:40` does `rm -rf` over its root, which here
  would delete `FINDINGS.md`, `README.md`, and `system-under-test.md` — the hand-authored evidence
  this story exists to preserve. It writes its own keys and nothing else. Second, the checker runs
  **drift only, no orphan sweep**: `check-dev-corpus.ts:80` reports every on-disk file the builder
  does not emit as an orphan, which would flag those same three prose files on every run. The
  precedent for omitting it is `check-ad21-table.ts:10-12`, which states plainly why a checker owning
  named files in a shared directory does not sweep for orphans. The builder therefore owns exactly
  the five generated JSON files (contract, brief, probe, run record, evidence artifact) and nothing under `spike-worked-example/` that a human wrote.
- `buildWorkedExample` embeds the **authored** inputs as literals and calls **existing** functions
  for everything derived — no new score-side logic, this story wires only:
  - Authored: the whole contract (every declaration `EvalContract` requires — see the re-authoring
    bullet below); the probe's declarative fields, **including its AD-9 `qualification` record and
    its AD-40 `defectSignature`**, both of which are author-supplied corpus declarations rather than
    computed values (`probe.ts:61` puts `qualification` on `probeCommonFields`, and
    `qualifyProbe`/`sealProbeSet` are the *gate* over that declaration, not its producer); the run
    record's raw `observations`, its `oracleDispositions`, and its `findings`. There is no live
    system under test to run against (`system-under-test.md` is prose, not code; `core/ingest` does
    not exist), so these stay evaluator-authored evidence, not a forbidden hand-filled *downstream*
    value.
  - Derived, computed by calling the function, never typed:
    - the contract → `application/seal.ts:18`'s `seal(rawContract)` → `brief.json` (new file);
    - probe admission → `core/score/qualification.ts:779`'s `sealProbeSet(probes, homeOperationOf)`,
      whose `homeOperationOf` is `resolveHomeOperation` (`qualification.ts:104`) against the
      contract's `permittedInterfaces`. The generator **fails the build** if `P-001` lands in
      `rejected` rather than `admitted`, and the artifact's `excludedProbeIds` is that set's ids;
    - per-step observation matching → `core/score/bindings.ts:377`'s
      `selectWithBindings(step, observations, index, resolved)`, preceded by `bindingOrder`
      (`binding-order.ts:62`) and `resolveCapturedBindings` (`bindings.ts:176`). **Not bare
      `selectObservations`** (`selection.ts:64`), which filters on `operationId` alone and therefore
      returns `several` for all four steps that share an operation; the temporal clause and the
      binding filters are what make the plan's steps distinguishable, and they live only in
      `selectWithBindings`;
    - every oracle's AD-4 check resolution → `core/evaluate/resolution.ts:610`'s `resolveCheck`,
      wired through `makeResolveOperand` and `makePointerDenotesCollection`
      (`evidence-resolution.ts:116,154`). This is not optional: `OutcomeInputs.checkResolution`
      (`outcome.ts:110`) is a required input to `resolveOutcome`, it lands verbatim on the
      artifact's `Outcome.checkResolution` (`evidence-artifact.ts:190`), and hand-typing it is
      exactly the hand-filled downstream value owed item 7 forbids;
    - each oracle's cited finding and its bucket → `core/score/witness.ts:389`'s `mapFindings`,
      which is what supplies `OutcomeInputs.citedFinding`;
    - the detection match → `core/score/witness.ts:220`'s
      `matchProbeWitness(probe, interfaces, record)`, whose first parameter is a `SignedProbe`
      (`witness.ts:86`: `expectedClean: false` with a non-null `defectSignature`);
    - every outcome's AD-6 state and corroboration → `core/score/outcome.ts:719`'s `resolveOutcome`;
    - uncited-defect gaps → `core/score/outcome.ts:778`'s `uncitedDefectFindingGaps`, and the bare
      `uncitedFindings` list → `outcome.ts:760`'s `uncitedFindingIds`;
    - the artifact's `strength` block → `core/score/strength.ts:101`'s `buildStrengthVector`, and
      `trials` → `core/score/reduce-trials.ts:92`'s `reduceTrialSet` over the single-trial set;
    - the verdict → `core/score/ladder.ts:658`'s `resolveContractVerdict(assessment)` over a
      `ContractAssessment` (`ladder.ts:133`), and `verdictBasis`/`exitCode` from the same
      `LadderResolution`.
- `eval-contract.json` is **re-authored whole against the current `EvalContract`, not field-patched.**
  The committed file predates eight schema revisions and does not parse today; treating it as a
  two-field edit is the single largest way to under-scope this story. Verified against source, the
  authored contract literal must supply at minimum:
  - `PermittedInterface` is `{ logicalId, kind, operations }` strict (`interface.ts:148-160`), so
    **both** the interface-level `responseShape` (`:41-50`) and the interface-level
    `volatilePointers` (`:49`) disappear. The response shape becomes a per-operation
    `responseDescriptor` (`interface.ts:45-69`) — this is what spine revision 9 invalidated
    (`ARCHITECTURE-SPINE.md:655`) — and `collectionLocations` is now an array of
    `CollectionLocation` objects (`interface.ts:31-36`), never an array of pointer strings.
  - `Operation` (`interface.ts:118-140`) requires `pathTemplate` (**not** `path`),
    `stateChangeMarker`, a four-channel `RequestShape` `{ path, query, header, body }`
    (`interface.ts:83-90`) rather than the flat `{ requiredKeys, permittedKeys, types }` triple on
    disk, `responseDescriptor`, per-operation `volatilePointers`, and `sensitivityWitness`.
  - `EvalContract` (`eval-contract.ts:146-217`) no longer has contract-level `linkage` or
    `strictMode`; both are present in the committed file and both are `unrecognized_keys` under
    `strictObject`. Linkage moves to per-behaviour `requirementLinks`/`riskLinks`, and every
    `Behavior` also gains `observableSuccessCriterion`. The contract additionally requires
    `waivers`, `referenceSets`, `scopedResources`, `probeStepBound`, `fixtureReset`,
    `testData.principals`/`testData.resources`, `budgets.maxCostUsd` as an `UnsignedDecimalString`
    (`"1.0"`, not the JSON number `1.0`), and `lineageFields`' `parentDigest`/`revisionCount`.
  - `InteractionStep` (`plan.ts:131-141`): `inputBinding` is the four-channel `InputBinding`
    (`plan.ts:92-97`) whose entries are tagged `BindingValue`s (`plan.ts:55-60`), so
    `{ "id": "n-1" }` becomes `{ path: { id: { literal: "n-1" } }, query: null, header: null, body: null }`
    and the `collection` step's `{}` becomes four `null`s — an empty channel map is rejected
    (`plan.ts:70-75`). `after` is required-nullable on **every** step, and `cardinality` is required.
  - Cardinality, settled by construction: only `baseline-read` genuinely matches two observations.
    `read-back` carries `after: "write"`, and `selectWithBindings` applies a temporal floor at the
    anchor's `sequence` (`bindings.ts:342-355,404-412`), which excludes `obs-001` and leaves exactly
    `obs-004`. So `baseline-read` is `any`; every other step, `read-back` included, stays
    `exactly-one`. Declaring `any` on `read-back` would be both unnecessary and a weakening of the
    read-back oracle the seeded defect turns on.
- `sealed-run-record.json` is likewise **re-authored whole**, not annotated. Beyond `mode:
  "contract-scoring"` and a strictly-increasing `sequence` per observation, `SealedRunRecord`
  (`sealed-run-record.ts:287-353`) requires `evidenceDisclosure` and `lineageFields`, and
  `resourceUse.costUsd` is an `UnsignedDecimalString`. Per member: `OracleDisposition` now carries
  `observationIds` (`sealed-run-record.ts:134`); the `defect` finding F-001 requires non-empty
  `quotedEvidence` (`sealed-run-record.ts:88-95`); and `Observation` (`:171-209`) requires
  `sequence`, the four-channel `ObservedCallInputs` (`:153-158`), `responseHeaders`, `stdout`,
  `stderr`, and `exitCode`. The observations' *evidence* is unchanged — same five calls, same
  statuses, same bodies — but their *shape* is not, and the shape is what makes the binding filters
  in `selectWithBindings` resolve.
- O-005's disposition is authored with `observationIds: []`, which is the honest record of a step
  that witnessed nothing and is precisely the guard `dispositionUnsupported` reads
  (`outcome.ts:165-172`).
- `probe.json` (new): `Probe` instance for `P-001` (`src/core/schemas/probe.ts:75`),
  `expectedClean: false`, `defects: [D-001]` (`system-under-test.md`'s seeded defect),
  `defectSignature` naming `patch-note` as home operation and a discriminating condition matching the
  400 rejection `malformed-write` claims, and an authored `qualification` record — a
  `ProbeQualification` branch (`probe-qualification.ts:51`) whose route suits a `defect`-class probe
  with `expectedClean: false`. `qualifyProbe(probe, homeOperation)` returns a `QualificationResult`
  (`qualification.ts:80,691-693`) — a gate verdict with failure codes, never a qualification record —
  so the record is authored and the gate is what admits it.
- `brief.json` (new): `seal(rawContract)`'s output, matching `corpus/dev/compile-seal-example/
  brief.json`'s naming precedent.
- `evidence-artifact.json`: `EvidenceArtifact` is a discriminated union on `mode`
  (`evidence-artifact.ts:373-404`), so the contract-scoring branch is written whole: `mode`,
  `contractVerdict`, `uncitedFindingGaps`, `systemRecommendationRecorded`,
  `systemRecommendationNote`, plus the common fields `scoringVersionInputs` (mode as the sixth field
  per Story 7.7) and `excludedProbeIds`. `uncitedFindingGaps` is whatever
  `uncitedDefectFindingGaps` returns, not assumed empty. Three further shapes moved and must be
  re-authored rather than carried over: every `Outcome` now requires `checkResolution`
  (`:190`), `Strength` now requires `basis` (`:274`) and its `vector` is the four-key strict
  `StrengthVector` (`:258-264`) rather than a free record, and `Remediation` now requires
  `lineageChain` (`:321`). Every disposition, corroboration, state, and the verdict are
  `resolveOutcome`'s and `resolveContractVerdict`'s actual return values.
- A new test (`tests/score/worked-example.test.ts`) imports the regenerated files and asserts
  `matchProbeWitness` resolves the AC's "reversed-order flip" against them too — additive to, joining
  rather than replacing, `witness.test.ts`'s existing synthetic `probe-witness.ts` fixture.
- `spike-worked-example/FINDINGS.md`'s retraction block (`:19-45`) and `README.md`'s mirror (`:7-23`)
  are updated to state plainly which defects this closes. The count is three-plus-one, not four:
  **FINDINGS.md's retraction names three** (1: the zero-observation `confirmed`/`agrees` step; 2: the
  two-observation ambiguity; 3: the vacuous `for-all`), and the undefined `P-001` is a **fourth
  defect the spine's owed item 7 added at round 3 and that was never written into FINDINGS.md**. So
  this story closes all four and adds the fourth to the retraction in the same edit. Defect 3 is the
  one whose *fix* predates this epic — AD-4 resolves an empty-collection `for-all` to false — but its
  status still changes here, because the regenerated artifact is the first place that fix is
  visible: O-004 no longer reads `confirmed`/`agrees`. State that as "fixed at the grammar level in
  spine revision 4, observable in the chain for the first time here", never as "unchanged". Finding
  10's withdrawal (`:183-186`) closes with defect 2.

**Ask First:** none anticipated. Settle any further ambiguity by construction in this story's own
decisions section rather than escalating it.

**Never:**
- No change to `tests/schemas/fixtures/worked-example-artifacts.ts`,
  `worked-example-checks.ts`, or `tests/schemas/worked-example-artifacts.test.ts`'s pinned 66/20
  parse-issue counts. Those are hand-transcribed, frozen-by-design historical fixtures
  (`worked-example-artifacts.ts:1-9`'s own comment: "what they fail, and why, IS the record") that
  read from in-memory TS literals, never from `spike-worked-example/` on disk (required by AD-30).
  Regenerating the JSON files on disk does not touch them, and this story changes neither literal
  nor count — they keep asserting exactly what the pre-regeneration artifact failed, forever.
  **One carve-out, the same shape Story 7.8's Never clause used:** that file's header comment
  (`worked-example-artifacts.ts:1-16`) calls itself a verbatim transcription of
  `spike-worked-example/` and cites that directory as its source. Regeneration makes that sentence
  false. Re-point the comment at the pre-regeneration artifact and say why the transcription is kept
  after the source moved. Editing a comment changes no literal, no issue path, and no count, so the
  66/20 pins stay green; leaving a knowingly false provenance line in place to satisfy a
  "do not touch" rule would be the same class of error this folder documents.
- No schema change, no `schemaVersion` bump anywhere: `epics.md`'s AC for this story names no bump,
  unlike every other Epic 7 story.
- No `core/ingest`, no `application/score.ts`, no CLI wiring: `stage-table.ts` keeps `module: null`
  for `score`/`emit` (epic 8's work). The generator script calls `core/score/*` functions directly.
- No live system-under-test and no change to `system-under-test.md`'s seeded `D-001`: the observations
  the script starts from stay evaluator-authored evidence, exactly the posture Story 7.8's Never
  clause already took for its own synthetic fixtures.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| `malformed-write` regenerated | `selectWithBindings` matches zero observations; O-005's disposition is `held` with `observationIds: []`, narrating a rejection no observation shows | `CORROBORATION_RULES[0]` (`disposition-unsupported`, `outcome.ts:617-623`, guard `dispositionUnsupported` at `:165-172`) sets **corroboration** `disagrees`, replacing the hand-typed `agrees`. The **state** is separately whatever `OUTCOME_RULES` yields; `unsupported-disposition` produces no state and is deliberately absent from `INVALIDATING_CONDITIONS` (`outcome.ts:216-221`) | N/A |
| `baseline-read` regenerated | matches `obs-001` and `obs-004`, cardinality `any` | `selectWithBindings` returns `several`; `any` is not a single-valued cardinality, so no ambiguity condition fires and the disposition is computed | N/A |
| `read-back` regenerated | `after: "write"` floors selection at `obs-003`'s `sequence` | exactly `obs-004` survives, so `exactly-one` holds and the read-back oracle binds the observation that shows the stale title | ambiguity condition if the temporal clause were dropped |
| Every step under bare `selectObservations` | operation-only filter (`selection.ts:64-84`) | `several` for all four steps sharing `get-note`/`patch-note` — which is why the builder calls `selectWithBindings`, never `selectObservations` alone | N/A |
| Contract re-authored | committed file predates eight schema revisions; `linkage` and `strictMode` are `unrecognized_keys`, `path`/`requestShape`/`inputBinding` all retyped | parses as `EvalContract`, per-operation `responseDescriptor`s, `seal()` succeeds | TypeScript rejects the literal at build time; `seal()` raises a `StructuralFailure` if a declaration is incoherent |
| `P-001` | previously undefined | `probe.json` exists with an authored `qualification` and `defectSignature`; `sealProbeSet` puts it in `admitted`; `defectSignature` resolves `patch-note` as home operation | generator exits non-zero if it lands in `rejected`, quoting the `QualificationFailure` codes |
| Oracle check resolution | five oracles, the regenerated record's observations | `resolveCheck` produces each `CheckResolutionValue`, including O-004's `for-all` over `notes: []` resolving `false` under AD-4 | N/A |
| `check:worked-example` | committed files vs. rebuilt map | fixed point, byte-identical over the five generated JSON files | non-zero exit, first-diff report, on drift |
| `spike-worked-example/`'s prose files | `FINDINGS.md`, `README.md`, `system-under-test.md` on disk, none emitted by the builder | untouched by the generator and unreported by the checker: no directory clear, no orphan sweep | N/A |
| Reversed-order flip against real data | regenerated chain fed to `matchProbeWitness` | resolves the same way the synthetic fixture already proves | N/A |

</frozen-after-approval>

## Code Map

**Read-only evidence:**
- `ARCHITECTURE-SPINE.md:728-741` — owed item 7, verbatim; `:655` — revision 9's response-descriptor
  supersession.
- `spike-worked-example/eval-contract.json:41-50` — old interface-level `responseShape`; `:57,59,61`
  — `baseline-read`/`read-back`/`malformed-write` steps, no `cardinality` field yet.
- `spike-worked-example/sealed-run-record.json:15,61,64` — O-005 (`held`), `obs-001`, `obs-004`.
- `spike-worked-example/evidence-artifact.json:23` — O-005 hand-typed `confirmed`/`agrees`.
- `spike-worked-example/FINDINGS.md:19-45,183-186` — the retraction block and finding 10's withdrawal.
- `spike-worked-example/README.md:7-23` — the retraction mirror.
- `spike-worked-example/system-under-test.md` — toy Notes API, seeded defect `D-001`.
- `scripts/dev-corpus-target.ts:145-228` — `buildDevCorpus` and its `Map<string, string>` return;
  `:1-9` — the type-stripping constraint every `node`-run script and its whole import graph inherits;
  `scripts/generate-dev-corpus.ts:26-47` (note the `rm -rf` at `:40` this story must not copy),
  `scripts/check-dev-corpus.ts:74-106` (note the orphan sweep at `:80` this story must not copy).
- `scripts/check-ad21-table.ts:10-12` — the precedent for a checker that owns named files in a shared
  directory and states why it runs no orphan sweep.
- `package.json:97-98,108` — `generate:dev-corpus`/`check:corpus` naming and the `validate` chain.
- `src/core/schemas/interface.ts:31-36,45-69,83-90,118-140,148-160` — `CollectionLocation`,
  `ResponseDescriptor`, `RequestShape`, `Operation` (`pathTemplate`, `stateChangeMarker`,
  `sensitivityWitness`), `PermittedInterface` (no `responseShape`, no interface-level
  `volatilePointers`).
- `src/core/schemas/eval-contract.ts:49-70,109-144,146-217` — `Behavior`
  (`observableSuccessCriterion`, `requirementLinks`/`riskLinks`), `SiblingGroups`/`TestData`/
  `Budgets`, and `EvalContract` itself: no `linkage`, no `strictMode`, plus `waivers`,
  `referenceSets`, `scopedResources`, `probeStepBound`, `fixtureReset`.
- `src/core/schemas/plan.ts:49-60,70-97,114-141` — `BindingValue`, `BindingChannel`/`InputBinding`,
  `SelectorCardinality`, `InteractionStep`.
- `src/core/score/selection.ts:64-84,96-127` — `selectObservations` (operation-only; the base the
  binding-aware selector filters), `resolveTemporalAnchor`.
- `src/core/score/bindings.ts:176,342-355,377-383,404-424` — `resolveCapturedBindings`,
  `temporalFloor`, `selectWithBindings`, `selectFiltered`'s binding filter and cardinality verdict;
  `src/core/score/binding-order.ts:62` — `bindingOrder`.
- `src/core/evaluate/resolution.ts:610` — `resolveCheck`;
  `src/core/evaluate/evidence-resolution.ts:116,154` — `makeResolveOperand`,
  `makePointerDenotesCollection`.
- `src/core/schemas/sealed-run-record.ts:131-140,153-158,171-209,287-353` — `OracleDisposition`
  (`observationIds`), `ObservedCallInputs`, `Observation` (`sequence`, `responseHeaders`, `stdout`,
  `stderr`, `exitCode`), `SealedRunRecord` (`mode`, `evidenceDisclosure`, the `sequence` uniqueness
  refine); `:78-99` — `Finding`'s `defect` branch and its required `quotedEvidence`.
- `src/core/score/qualification.ts:49-83,104,691-739,779` — `QUALIFICATION_FAILURES`,
  `QualificationResult`, `resolveHomeOperation`, `qualifyProbe` (a gate over an authored record),
  `sealProbeSet` (returns `SealedProbeSet { admitted, rejected }`).
- `src/core/schemas/probe.ts:44-63,75-112` — `probeCommonFields` (authored `qualification`), `Probe`;
  `src/core/schemas/probe-qualification.ts:51` — `ProbeQualification`'s five-route union;
  `src/core/schemas/defect-signature.ts:30-145` — `DefectSignature`.
- `src/core/score/witness.ts:86,220,389` — `SignedProbe`, `matchProbeWitness`, `mapFindings`;
  `src/core/score/quotation.ts:126-169` — `auditQuotation`, which audits F-001's new
  `quotedEvidence` against the observations it cites.
- `src/core/score/outcome.ts:103-131,165-172,216-221,616-623,719-749,760-772,778` —
  `OutcomeInputs`/`OutcomeResolution`, `dispositionUnsupported`, `INVALIDATING_CONDITIONS`'s comment
  on why `unsupported-disposition` produces no state, `CORROBORATION_RULES[0]`, `resolveOutcome`,
  `uncitedFindingIds`, `uncitedDefectFindingGaps`.
- `src/core/score/strength.ts:101` — `buildStrengthVector`;
  `src/core/score/reduce-trials.ts:92` — `reduceTrialSet`.
- `src/core/schemas/evidence-artifact.ts:103-109,169-196,227-235,258-289,308-322,373-404` —
  `ScoringVersionInputs`, `Outcome` (`checkResolution`), `UncitedFindingGap`,
  `StrengthVector`/`Strength` (`basis`), `Remediation` (`lineageChain`), and `EvidenceArtifact`'s
  discriminated union on `mode`.
- `src/core/score/ladder.ts:129-155,569,582,645,658` — `ProductionAssessment`/`ContractAssessment`,
  `LadderResolution`, `PRODUCTION_LADDER`/`CONTRACT_LADDER`,
  `resolveProductionVerdict`/`resolveContractVerdict`.
- `src/application/seal.ts:18` (`seal`), `src/application/index.ts:38,39` (`seal`,
  `serializeArtifact`). Layering note: `check:layers` walks `src/` only
  (`check-dependency-direction.ts:1-3,46`), so `scripts/` is outside its scan; the reason the
  generator may import `src/core/score/*` directly is the precedent in `dev-corpus-target.ts:10-15`,
  which already imports both `src/application/` and `src/core/`, not a rule the checker enforces.
- `corpus/dev/compile-seal-example/brief.json` — the `brief.json` naming precedent.
- `tests/schemas/fixtures/worked-example-artifacts.ts:1-16` (the provenance header this story
  re-points), `worked-example-checks.ts:1-8`,
  `tests/schemas/worked-example-artifacts.test.ts:22-33` — the frozen historical fixtures whose
  literals and 66/20 pins this story must not touch.
- `tests/score/witness.test.ts:66-95`, `tests/score/fixtures/probe-witness.ts:1-30` — the existing
  synthetic reversed-order-flip fixture this story's new test joins.

**New:**
- `spike-worked-example/probe.json` — `Probe` instance for `P-001`.
- `spike-worked-example/brief.json` — `seal()`'s output.
- `scripts/worked-example-target.ts` — pure builder, authored inputs + derived outputs.
- `scripts/generate-worked-example.ts`, `scripts/check-worked-example.ts` — write/check.
- `tests/score/worked-example.test.ts` — the real-data reversed-order-flip test.

**Changed:**
- `spike-worked-example/eval-contract.json` — re-authored whole against the current `EvalContract`:
  `pathTemplate`, `stateChangeMarker`, four-channel `requestShape`, per-operation
  `responseDescriptor` and `volatilePointers`, `sensitivityWitness`, per-behaviour
  `observableSuccessCriterion`/`requirementLinks`/`riskLinks`, `waivers`, `referenceSets`,
  `scopedResources`, `probeStepBound`, `fixtureReset`, decimal-string `maxCostUsd`, four-channel
  `inputBinding` with `cardinality` and `after` on every step, and no `linkage` or `strictMode`.
- `spike-worked-example/sealed-run-record.json` — re-authored whole: `mode`, `evidenceDisclosure`,
  lineage fields, decimal-string `costUsd`, per-observation `sequence`, four-channel `callInputs`,
  `responseHeaders`/`stdout`/`stderr`/`exitCode`, `observationIds` on every disposition,
  `quotedEvidence` on F-001.
- `spike-worked-example/evidence-artifact.json` — the contract-scoring branch of the union:
  `scoringVersionInputs`, `excludedProbeIds`, `uncitedFindingGaps`, per-outcome `checkResolution`,
  `strength.basis` over the strict `StrengthVector`, `remediation.lineageChain`, and every
  disposition/corroboration/state plus `contractVerdict` — all computed.
- `spike-worked-example/FINDINGS.md`, `spike-worked-example/README.md` — retraction status updated,
  with the fourth (undefined `P-001`) defect added.
- `tests/schemas/fixtures/worked-example-artifacts.ts` — provenance header only; no literal, no
  count.
- `package.json` — two new scripts, `validate` chain gains `check:worked-example`.

## Tasks & Acceptance

**Execution:**
- [x] `scripts/worked-example-target.ts` — re-author the `EvalContract` literal whole against the
  current schema (per-operation `responseDescriptor`s and `pathTemplate`, four-channel
  `requestShape` and `inputBinding`, `stateChangeMarker`, `sensitivityWitness`, per-behaviour
  `requirementLinks`/`riskLinks` and `observableSuccessCriterion`, `waivers`, `referenceSets`,
  `scopedResources`, `probeStepBound`, `fixtureReset`, decimal-string `maxCostUsd`, `cardinality`
  and nullable `after` on every step, no `linkage`, no `strictMode`). TypeScript is the gate here:
  the literal is typed `EvalContract`, so an omitted field is a compile error rather than a runtime
  surprise
- [x] `scripts/worked-example-target.ts` — re-author the `SealedRunRecord` literal (`mode`,
  `evidenceDisclosure`, lineage fields, decimal-string `costUsd`, per-observation `sequence` and
  four-channel `callInputs` plus `responseHeaders`/`stdout`/`stderr`/`exitCode`, `observationIds` on
  every disposition with `[]` on O-005, `quotedEvidence` on F-001)
- [x] `scripts/worked-example-target.ts` — author the `Probe` literal for `P-001`: class,
  `expectedClean: false`, `defects: [D-001]`, `defectSignature`, and the AD-9 `qualification` record
- [x] `scripts/worked-example-target.ts` — wire the derivation calls in Boundaries' Derived list, in
  order: `seal` → `sealProbeSet` (fail the build on a rejection) → `bindingOrder` /
  `resolveCapturedBindings` / `selectWithBindings` → `resolveCheck` → `mapFindings` →
  `matchProbeWitness` → `resolveOutcome` per oracle → `uncitedDefectFindingGaps` /
  `uncitedFindingIds` → `reduceTrialSet` / `buildStrengthVector` → `resolveContractVerdict`; assemble
  the contract-scoring `EvidenceArtifact` branch from their return values only; export
  `buildWorkedExample(): Map<string, string>`
- [x] `scripts/generate-worked-example.ts`, `scripts/check-worked-example.ts` — write/check pair
  following `generate-dev-corpus.ts`/`check-dev-corpus.ts` **minus** the directory clear
  (`generate-dev-corpus.ts:40`) and **minus** the orphan sweep (`check-dev-corpus.ts:80`), each
  omission carrying a comment naming the three prose files it protects
- [x] `package.json` — add `generate:worked-example`/`check:worked-example`, wire the checker into
  `validate`
- [x] Run `npm run generate:worked-example`, inspect the five files it writes, confirm
  `FINDINGS.md`/`README.md`/`system-under-test.md` are still on disk and unmodified, then
  `npm run check:worked-example` for the fixed point
- [x] `tests/score/worked-example.test.ts` — real-data reversed-order-flip test, joining
  `witness.test.ts`'s synthetic one
- [x] `tests/schemas/fixtures/worked-example-artifacts.ts` — re-point the `:1-16` provenance header
  at the pre-regeneration artifact; change no literal and no count
- [x] `spike-worked-example/FINDINGS.md`, `README.md` — record that all four defects close, add the
  undefined-`P-001` defect the retraction never named, and state defect 3 as fixed at the grammar
  level in spine revision 4 and observable in the chain for the first time here

**Acceptance Criteria:**
- Given `probe.json`'s authored `qualification` record and `defectSignature`, when `sealProbeSet`
  runs over the probe set with `resolveHomeOperation` against the regenerated contract, then `P-001`
  is in `admitted` and not in `rejected`, and the generator exits non-zero if that ever inverts.
- Given the regenerated run record, when parsed as `SealedRunRecord`, then it succeeds: it carries
  `mode: "contract-scoring"`, a unique positive `sequence` on every observation, four-channel
  `callInputs`, `observationIds` on every oracle disposition, and `quotedEvidence` on F-001.
- Given the regenerated contract, when parsed as `EvalContract`, then it succeeds, and when `seal()`
  runs over it, then `brief.json` is its actual output; the contract, brief, probe, run record, and
  evidence artifact are all generator output.
- Given O-005's `held` disposition with empty `observationIds`, when the chain regenerates, then
  `resolveOutcome` returns `corroborationRule: 'disposition-unsupported'` and
  `corroboration: 'disagrees'`, replacing the old hand-typed `agrees`, and its `state` is whatever
  `OUTCOME_RULES` yields rather than the hand-typed `confirmed`.
- Given `baseline-read`'s two-observation match, when the chain regenerates, then `selectWithBindings`
  returns `several` under the declared `any` cardinality and no ambiguity condition fires.
- Given `read-back`'s `after: "write"` clause, when the chain regenerates, then `selectWithBindings`
  returns exactly `obs-004` under `exactly-one`, so the temporal floor and not a widened cardinality
  is what disambiguates it.
- Given every oracle's `check`, when the chain regenerates, then each `Outcome.checkResolution` is
  `resolveCheck`'s return value, and O-004's `for-all` over an empty collection resolves `false`
  under AD-4 rather than the vacuous `true` the retraction recorded.
- Given the regenerated `eval-contract.json`, when inspected, then it carries per-operation
  `responseDescriptor`s and `pathTemplate`s, four-channel `requestShape` and `inputBinding`, a
  `cardinality` and an explicit `after` on every step, and neither an interface-level `responseShape`
  nor `linkage` nor `strictMode`.
- Given the regenerated evidence artifact, when parsed as `EvidenceArtifact`, then it succeeds on the
  contract-scoring branch with `scoringVersionInputs` carrying `mode` as its sixth field,
  `excludedProbeIds`, `uncitedFindingGaps` from `uncitedDefectFindingGaps`, a `strength` block from
  `buildStrengthVector`, and a `contractVerdict` plus `exitCode` from `resolveContractVerdict`.
- Given `matchProbeWitness` run against the regenerated chain, when the reversed-order flip case is
  checked, then it resolves the same way the existing synthetic fixture already proves, and both
  tests are green.
- Given `npm run check:worked-example`, when run against the committed files, then it reports a fixed
  point with no drift, and `FINDINGS.md`, `README.md`, and `system-under-test.md` are neither
  rewritten by the generator nor reported by the checker.
- Given `FINDINGS.md`, when read after this story, then it names four defects rather than three: the
  three its retraction already carried plus the undefined `P-001` the spine's owed item 7 added, with
  all four recorded as closed and defect 3 recorded as fixed at the grammar level in spine revision 4
  and observable in the chain for the first time here.
- Given `npm run validate`, when run, then it stays green with the new check included, and
  `tests/schemas/worked-example-artifacts.test.ts`'s pinned 66/20 counts are unchanged.

## Spec Change Log

- **Finding:** a peer review of this ready-for-dev spec (before any code existed) found that the two
  artifacts it described as field-patched are wholesale re-authorings. `PermittedInterface` is
  `{ logicalId, kind, operations }` strict (`interface.ts:148-160`), so the interface-level
  `volatilePointers` disappears alongside `responseShape`; `Operation` requires `pathTemplate` rather
  than `path`, plus `stateChangeMarker`, a four-channel `RequestShape`, per-operation
  `volatilePointers`, and `sensitivityWitness`; `EvalContract` has no `linkage` and no `strictMode`,
  both of which the committed file carries as `unrecognized_keys`, and it requires
  `observableSuccessCriterion` per behaviour plus `waivers`, `referenceSets`, `scopedResources`,
  `probeStepBound`, `fixtureReset`, and a decimal-string `maxCostUsd`; `InteractionStep.inputBinding`
  is a four-channel object of tagged `BindingValue`s, so `{ "id": "n-1" }` and `{}` are both
  unrepresentable and `after` is required on every step. On the record side, `SealedRunRecord`
  requires `evidenceDisclosure` and lineage fields, `OracleDisposition` requires `observationIds`,
  the `defect` finding F-001 requires non-empty `quotedEvidence`, and `Observation` requires
  `sequence`, a four-channel `callInputs`, `responseHeaders`, `stdout`, `stderr`, and `exitCode` —
  so "observation content is unchanged" was true of the evidence and false of the shape. The
  evidence artifact moved too: it is a discriminated union on `mode`, `Outcome` requires
  `checkResolution`, `Strength` requires `basis` over a four-key `StrengthVector`, and `Remediation`
  requires `lineageChain`. **Amended:** Boundaries now carry a per-schema re-authoring bullet for the
  contract, the record, and the artifact, with file:line citations; the Code Map names every schema
  module involved; Tasks split the re-authoring into three separate items ahead of the wiring item;
  the AC now asserts that each artifact *parses* rather than that two fields changed. **Avoids:** a
  developer editing two fields, watching `tsc` reject the literal in a dozen places, and rediscovering
  the actual scope of the story from compiler output.
- **Finding:** the same review found the spec's central selector claim wrong in both directions.
  `selectObservations` (`selection.ts:64-84`) filters on `operationId` alone, so it returns `several`
  for `baseline-read`, `read-back`, `write`, **and** `malformed-write` — meaning the spec's
  "`malformed-write` matches zero observations" is false against the function the spec named, and its
  "`baseline-read` and `read-back` both genuinely match two" is false against the function it should
  have named. The binding-aware selector is `selectWithBindings` (`bindings.ts:377`), reached through
  `bindingOrder` and `resolveCapturedBindings`, and it is what applies the temporal floor and the
  binding filters. Under it, `malformed-write` matches nothing, `baseline-read` matches two, and
  `read-back`'s `after: "write"` clause floors it to exactly `obs-004`. **Amended:** the derived list
  now names `selectWithBindings` and its two prerequisites and says explicitly that bare
  `selectObservations` is not the call; `read-back` is returned to `exactly-one` with `baseline-read`
  alone declared `any`; the I/O matrix gains a row for each of the three steps plus a row recording
  what the operation-only selector would return; the Design Note argues the `read-back` case from the
  read-back oracle the seeded defect turns on. **Avoids:** a regenerated chain that either fabricates
  a zero-match the code does not produce or widens the cardinality of the one step whose oracle
  depends on binding a single read.
- **Finding:** the same review found `Probe.qualification` described as `qualifyProbe`'s output. It
  is an authored `ProbeQualification` on `probeCommonFields` (`probe.ts:61`); `qualifyProbe` returns
  a `QualificationResult` gate verdict (`qualification.ts:80,691-693`). The review also found
  `checkResolution` missing from the derived list although it is a required `OutcomeInputs` field
  that lands verbatim on the artifact and is read by two corroboration rules — and although
  `resolveCheck` (`src/core/evaluate/resolution.ts:610`) exists to produce it — along with four other
  omitted reference calls: `mapFindings` (`witness.ts:389`) for the cited finding, `buildStrengthVector`
  (`strength.ts:101`) for the `strength` block, `reduceTrialSet` (`reduce-trials.ts:92`) for `trials`,
  and `uncitedFindingIds` (`outcome.ts:760`) for the bare `uncitedFindings` list. Separately, the
  `malformed-write` row attributed the outcome *state* to the unsupported-disposition rule;
  `CORROBORATION_RULES[0]` sets corroboration only, and `INVALIDATING_CONDITIONS`'s own comment
  (`outcome.ts:216-221`) says `unsupported-disposition` "produces no state and is not in that
  enumeration". **Amended:** the derived list is rewritten as an ordered call chain naming all of
  them; the probe bullet, the Design Notes, and the first AC now record qualification as authored and
  `sealProbeSet` as a build-failing gate; the I/O row and its AC now separate corroboration from
  state. **Avoids:** a story that closes owed item 7 while hand-typing the check resolutions that
  decide every corroboration in the chain, and an AC asserting a state transition the code does not
  make.
- **Finding:** the same review found the generate/check pattern unsafe as described.
  `generate-dev-corpus.ts:40` clears its root with `rm -rf` before writing and
  `check-dev-corpus.ts:80` reports every unbuilt on-disk file as an orphan; mirroring both over
  `spike-worked-example/` would delete `FINDINGS.md`, `README.md`, and `system-under-test.md` and
  then flag them, while the spec simultaneously instructed the developer to hand-update two of them.
  **Amended:** Boundaries gained a bullet stating both divergences with the reason (a mixed
  directory, unlike `corpus/dev/`) and citing `check-ad21-table.ts:10-12` as the precedent for a
  checker that owns named files and runs no orphan sweep; Tasks require a comment on each omission;
  the I/O matrix and the AC now assert the three prose files survive a generate-then-check cycle.
  **Avoids:** a regeneration command whose first run destroys the evidence the story exists to
  preserve.
- **Finding:** the same review found the FINDINGS.md defect count both wrong and internally
  inconsistent. The retraction block names **three** defects; the undefined `P-001` is a fourth that
  the spine's owed item 7 added at round 3 and that was never written into FINDINGS.md. Boundaries
  said "four regeneration defects ... (3: the vacuous `for-all`)" while the matching AC said
  "four ... and the fifth (the vacuous `for-all`)". The review also found the Tasks line instructing
  the developer to record defect 3 as not changing status here, which would put a false statement in
  FINDINGS.md: AD-4's grammar-level fix makes O-004's `for-all` resolve `false`, so the regenerated
  artifact is the first place the fix is visible and O-004 stops reading `confirmed`/`agrees`.
  **Amended:** the FINDINGS.md bullet, the Tasks line, and the AC now agree on three-plus-one, say
  the fourth defect is being added to the retraction in the same edit, and state defect 3 as fixed in
  spine revision 4 and observable here for the first time; a new AC asserts O-004's resolution
  directly. **Avoids:** a retraction update that miscounts its own defects and denies a change the
  regenerated file makes on the same commit.
- Six citations were also corrected against source: `buildDevCorpus` returns `Map<string, string>`,
  not `ReadonlyMap`; `seal` and `serializeArtifact` are exported from `src/application/index.ts:38,39`,
  not `:31,35`; `ResponseDescriptor` and `Operation` are at `interface.ts:45-69` and `:118-140`, not
  `:39-70` and `:118-133`; `check:layers` walks `src/` only
  (`check-dependency-direction.ts:1-3,46`), so the generator's freedom to import `src/core/score/*`
  rests on the `dev-corpus-target.ts:10-15` precedent rather than on a rule the checker enforces; and
  `tests/schemas/fixtures/worked-example-artifacts.ts`'s header runs to `:16`, not `:9`. That header
  gained a carve-out of its own: it calls itself a verbatim transcription of `spike-worked-example/`,
  which regeneration makes false, so it is re-pointed at the pre-regeneration artifact while every
  literal and both pinned counts stay frozen.

## Design Notes

**Why `sealed-run-record.json`'s observations stay authored rather than becoming "derived."** Every
other regenerated value in this story is the output of a reference function this epic built:
qualification, witness matching, outcome resolution, the verdict. The raw observations have no
reference function to derive them from — there is no live Notes API in this repository, only
`system-under-test.md`'s prose spec, and `core/ingest` does not exist yet (epic 8). Owed item 7's ban
on "hand-filled downstream values" is about the score-side derivations that were previously typed by
hand pretending to be a reducer's output; it was never a demand to fabricate a live system to run
against. The observations are the evidence an evaluator is stipulated to have collected; regenerating
the chain means deriving everything *from* that evidence correctly, not inventing the evidence itself.

**Why `any` cardinality for `baseline-read` alone, decided by construction.** The epic preamble names
this exact ambiguity as one of the examples it expects settled in-story rather than escalated
(`epic-7-context.md`'s Technical Decisions). Both `baseline-read` and `read-back` are idempotent GETs
of the same note, so read against `selectObservations` alone the pair looks symmetric. It is not.
`read-back` declares `after: "write"`, and `selectWithBindings` floors its candidates at the anchor
observation's `sequence` (`bindings.ts:342-355,404-412`), which drops `obs-001` and leaves exactly
`obs-004`. So `read-back` keeps `exactly-one`, and widening it to `any` would be a real loss: the
seeded defect turns on O-001 comparing the title returned by `read-back` against the title sent to
`write`, and a step declared to admit several matches states that the evaluator's own read-back
oracle does not need to bind one particular read. `baseline-read` has no clause and genuinely matches
both, which is what `any` is for — several legitimate matches, no forced single answer.

**Why the probe's qualification record is authored rather than computed.** The draft of this story
said `qualification` was `qualifyProbe`'s output. It is not. `probe.ts:61` puts `qualification` on
`probeCommonFields` as a required `ProbeQualification` — the author's AD-9 declaration of which of
five routes earned this probe its ground truth, with the evidence that route demands — and
`qualifyProbe(probe, homeOperation)` returns a `QualificationResult` of `{ qualified, failures, ... }`
(`qualification.ts:80,691-693`), a gate verdict over that declaration. That distinction matters for
owed item 7's rule rather than being a naming detail: the record is an *upstream* corpus declaration,
in the same class as the contract and the raw observations, so authoring it is legitimate, while
computing it would mean the corpus qualified itself. What this story owes owed item 7 is that the
gate actually runs and that admission is asserted, which is why `sealProbeSet` is a build-failing
call rather than a decorative one.

**Why `resolveCheck` is on the derived list.** `OutcomeInputs.checkResolution` (`outcome.ts:110`) is
required, it lands verbatim on `Outcome.checkResolution` (`evidence-artifact.ts:190`), and it is the
input two corroboration rules read (`examined-nothing`, `check-confirms-silence`). A hand-typed
resolution would therefore decide the corroboration of every outcome in the chain by hand while the
artifact claimed the reducer produced it. That is the precise shape of the hand-filled downstream
value owed item 7 forbids, and the reference function that removes it already exists at
`src/core/evaluate/resolution.ts:610`.

## Decisions settled by construction

Per the epic preamble's own rule that ambiguities are settled where the work happens rather than
escalated. Three of these contradict a frozen sentence in this story's own Boundaries or I/O matrix;
each is recorded with the reproduction that forced it rather than smoothed away.

1. **The defect signature is homed on `GET /notes/{id}`, not on `patch-note`.** Boundaries and the
   I/O matrix both name `patch-note` as the home operation. That construction cannot work, and the
   reason is `system-under-test.md`'s own sentence about D-001: "The response is indistinguishable
   from a correct one. Only a subsequent independent `GET` reveals the old value." AD-40's
   discriminating condition is a predicate over **one** selected observation of the home operation,
   so a condition homed on `patch-note` can separate the seeded defect from correct behaviour only
   if some single `PATCH` response differs, and by construction none does. Reproduced against the
   spec's literal wording — home operation `patch-note`, condition matching the 400 rejection
   `malformed-write` claims — the run does not merely score wrongly, it stops scoring: no `PATCH`
   observation resolves the condition `true`, F-001 cites `obs-003` which *is* a home-operation
   observation, so the match returns `unwitnessed-claim`, which is an AD-32 invalidating condition
   and an `infrastructure-error` state, which lands the chain on AD-21's Invalid rung with exit 3
   and no contract verdict at all. The regenerated chain would then demonstrate nothing.
   Homed on the read, the signature is a genuine discriminator: its selector binds `path.id` to
   `n-1`, its predicate asserts the returned title is still `Original`, the only evaluator-chosen
   read of `n-1` is `obs-004`, and `obs-004` is exactly the observation F-001 cites. The witness
   resolves `matched`, O-001 resolves `caught`, and the three-row citation triad reproduces on real
   data (`tests/score/worked-example.test.ts`).
2. **O-004's empty-collection `for-all` resolves `insufficient-evidence`, not `false`.** Boundaries,
   the I/O matrix and one acceptance criterion all say the regenerated chain records `false` there,
   quoting spine revision 4's wording. The shipped grammar disagrees, and the current spine agrees
   with the code: AD-4's resolution is three-valued and `ARCHITECTURE-SPINE.md:201` closes the
   introduction set at "an operand denoting a collection that is empty", so
   `resolution.ts`'s quantifier returns `insufficient-evidence` carrying
   `introductionCondition: 'empty-collection'`. The artifact records what `resolveCheck` actually
   returns. The substance of the acceptance criterion holds either way and is what the test asserts:
   the vacuous `true` is gone, O-004 no longer reads `confirmed`/`agrees`, and AD-6 lands the
   resolution on `abstained`.
3. **The regenerated contract verdict is FAIL, where the hand-typed artifact claimed CONCERNS.**
   Nothing in the story predicts a verdict, and this one is computed rather than chosen: `abstained`
   is one of AD-6's four behavioural failures, O-004 discharges a `material` behaviour, and the
   scoring policy's severity floor is `material`, so `behavioural-failure-at-or-above-floor` fires
   in the FAIL tier and the CONCERNS tier is never reached. That is the clearest single piece of
   evidence that regeneration was worth doing, so it is recorded in `FINDINGS.md` and `README.md`
   rather than tuned away by lowering the floor.
4. **A sixth authored input, the scoring policy, lives in the target module and is not emitted.**
   The severity floor, the confidence and catch thresholds, the minimum trial count, the
   re-execution and remediation caps, and the regex match-step budget are all policy values the
   ladder, the reducer and `resolveCheck` read. `ScoringPolicy` is a published artifact rather than
   a set of constants, so the module parses one policy literal and reads all seven from it instead
   of scattering seven magic numbers. It stays out of the emitted set: the story names five files.
5. **Five digests are computed rather than carried as placeholders.** `contractDigest` and
   `sealedBriefDigest` on the run record are `digestArtifact` over the contract and the brief this
   same build produced, so the chain pins what it actually ran against instead of asserting an
   agreement AD-32 would have to take on trust; `scoringPolicyDigest`, `scoringVersion` and
   `comparabilityKey` are computed the same way. The three genuinely caller-attested digests —
   `corpusDigest`, `fixtureDigest`, `evaluatorConfigurationDigest` — stay authored and are named in
   `callerAttestedInputs`, which is what that field is for.
6. **Instance `schemaVersion`s move to the current version of each schema.** No schema module
   changed and no schema was bumped, which is what the Never clause forbids. But the committed
   record and artifact carried `schemaVersion: 1` against schemas now at 3, which is precisely why
   they no longer parsed. A regenerated artifact that still claimed version 1 would fail to parse
   on the next reader that compares versions. Record 1 → 3, artifact 1 → 3, probe new at 2, contract
   stays at 1, brief stamped 2 by `seal` itself.
7. **`buildWorkedExampleChain` is exported beside `buildWorkedExample`, and the new test drives
   values rather than disk bytes.** The story's new test has to reach the regenerated chain. Reading
   the five files back off disk would put filesystem I/O in a `tests/score/` case for no gain, so
   the builder was split: a pure function returning the four artifacts plus the witness match and
   the per-step selections, and a thin renderer over it. The generator and the drift check both go
   through the renderer, so what the test asserts and what the bytes carry cannot diverge.
8. **Two prose statements outside the retraction block were false after regeneration and were
   corrected in the same edit.** `FINDINGS.md`'s finding 9 closed by stating "the corrected artifact
   reads CONCERNS on the contract", and finding 10's withdrawal left retraction defect 2 open by
   name. Both now say what the regenerated chain shows. Leaving a knowingly false sentence beside a
   corrected one is the same class of error this folder documents.
9. **`check:worked-example` is wired into `.github/workflows/pr-checks.yml` as well as into
   `validate`.** The Code Map does not name the workflow, but the workflow's own comment does:
   "Adding a `node scripts/*.ts` command to `validate` means adding it here too", because the floor
   job is what proves a type-stripped script runs on the declared engines floor. Two named steps
   (one per job) plus the `Validate` step's own name. `README.md` is deliberately untouched: its
   validate summary already omits `check:ad21-table`, the worked example is a planning artifact
   rather than part of the published package surface, and editing the README would force a
   `build:shareable` regeneration for a line the file does not otherwise keep current.

## Implementation Review Record

**Round 1 — three review layers over the finished diff.** Fourteen findings, all triaged `patch`: the
implementation stood and every one is a fix on top of it. All fourteen addressed in the same pass,
nothing deferred.

1. **P1 — the new drift gate shipped without a canary, and all eight of its siblings have one.**
   `canary-worked-example` added to `pr-checks.yml`, modelled on `canary-dev-corpus`: a committed
   tracked-files precondition, a mutated byte that must fail naming `evidence-artifact.json: drift at
   byte offset`, a changed authored seed inside `worked-example-target.ts` that must produce drift,
   and a generate-then-empty-`git status --porcelain` fixed point over the whole spike directory. The
   last one doubles as the proof that the generator leaves the three prose files alone, since it
   walks the directory rather than the five keys. Both failure assertions were reproduced locally
   before the job was written.
2. **P2 — `WORKED_EXAMPLE_FILES` was exported, documented as authoritative, and read by nothing.**
   `buildWorkedExample` now asserts its own key set equals `WORKED_EXAMPLE_FILES.map(keyOf)` and
   fails on any difference in either direction. Verified by dropping the `probe.json` emit: the
   builder fails and names the file. No orphan sweep, which the story forbids and which this closes
   the gap without.
3. **P3 — the headline result was unasserted.** `tests/score/worked-example.test.ts` gains
   `contractVerdict === 'FAIL'`, `exitCode === 2`, the exact `verdictBasis`, the three unsatisfied
   `critical` coverage gaps, and the suppressed CONCERNS evidence on `trials`/`strength.comparable`.
   Verified by flipping `POLICY.severityFloor` to `critical`: the suite goes red on the verdict
   assertion, where before the change all tests stayed green.
4. **P4 — `worked-example-checks.ts` needed the same provenance carve-out its sibling got.** Header
   re-pointed at the pre-regeneration contract at commit `46a5ba7`, naming the three expressions that
   moved and why the transcription is kept. Comment only: no literal, no issue path, no count, no
   renamed export.
5. **P5 — the published bytes do not hash to the digests inside them.** `renderJson`'s docblock now
   says so outright, names `dev-corpus-target.ts` as the precedent that avoids it by writing
   canonical bytes straight to disk, and carries the round-trip constraint the earlier wording
   overstated: the re-indent preserves RFC 8785 order only while no emitted object carries an
   array-index-like key, since V8 hoists integer-like own properties.
6. **P6 — `makeResolveOperand` hardcoded an empty reference-set map.** It now projects the contract's
   own `referenceSets` declarations to their members, so a reference-set operand added later resolves
   instead of silently returning `ABSENT`. The reviewer's literal suggestion (`contract.referenceSets
   ?? {}`) does not typecheck: `ReferenceSetDeclaration` is `{ keys, members, commentary }` and the
   resolver takes `Record<string, JsonValue[]>`, so the projection is the fix.
7. **P7 — `trials.completed` was typed beside the array it should be read from.** Derived from the
   votes array, and both `strength.note` and `strength.denominator` pluralize through one shared
   `trialCount` string.
8. **P8 — the three new coverage gaps and the shrunken `verdictBasis` were unexplained.** Finding 9
   now names all three gaps with why each holds, records the severity move from `material` to
   `critical` as a consequence of AD-31's predicates being contract-level, and states that
   `verdictBasis` shrank because AD-21's ladder is first-match-wins across tiers, with the three
   suppressed CONCERNS conditions still readable in `coverageGaps`, `trials`, and `outcomes`.
9. **P9 — the root `README.md` listed every other generate/check pair and omitted this one.** Added,
   and `npm run build:shareable` re-run so `check:shareable` stays byte-exact.
10. **P10 — the spike `README.md` had dropped its "not a conforming example" warning.** Restored, and
    it now names what must not be copied: O-005's disposition narrating evidence it does not cite,
    `obs-002` returning `notes: []` against a `testData.setup` seeding three and an
    `expectedCardinality` of exactly three, and the three unsatisfied AD-20 rules. The cardinality
    case is stated as deliberate with its reason: `expectedCardinality` is read only by
    `compile/reachability.ts` and `coverage/satisfaction.ts`, so no score-side function compares an
    observation against it (verified by grep over `src/`).
11. **P11 — "everything downstream of that evidence is a return value" overclaimed.** Nine
    hand-declared inputs are now named in both documents: `waiver`, `judgeConduct`, `evaluationFault`
    and `required` on `OutcomeInputs`, and `preflightPassed`, `overTruncated`, `unavailable`,
    `internallyInconsistent` and `isolationViolation` on the ladder, with the note that several feed
    AD-21's Invalid tier. This is the one claim the folder exists to make, so it is stated exactly.
12. **P12 — the emitting functions were attributed wholesale to "the score half".** Both documents
    now split them: `compile`, `seal`, `digestArtifact`, `evaluateCoverage` and `validateLineageChain`
    are the compile half and the core modules beside it; the thirteen score-side functions are named
    separately.
13. **P13 — three surprising readings of the artifact were unexplained.** `FINDINGS.md` gains a
    paragraph each for the universal `resolvedFrom: null` (only four ladder rows carry
    `resolvesFromCitation`, and `witness-matched` is not one), O-005's `"false"` check resolution over
    zero observations (AD-26 resolves an absent pointer to a decisive `false` inside `equality`), and
    the placeholder `corpusDigest`/`fixtureDigest` feeding `comparabilityKey`. The same edit stops
    implying the artifact shows the rule or the invalidating condition: `Outcome` carries a field for
    neither, so the prose quotes the resolution and says the artifact does not show it.
14. **P14 — the new prose carried the negation-then-correction pattern and em-dash clause
    connectors.** All four named instances rewritten, including `strengthNote`, which changes the
    published bytes and was regenerated. A sweep over every added line closed three more. One
    "rather than" survives by the rule's own carve-out: the defect signature's home operation is a
    decision record naming the option turned down and the reason, quoted from `system-under-test.md`.

**Round 2 — an adversarial peer review of the finished commit, in three parallel layers.** The three
recorded divergences were each re-derived from source and all three hold: the `unwitnessed-claim`
route the spec's `patch-note` homing would take is confirmed at `outcome.ts:245,416-420` and
`ladder.ts:157,610-616` (invalid, exit 3, no verdict); AD-4's three-valued resolution and its single
`empty-collection` introduction condition are confirmed at `resolution.ts:86-92,170-181` and
`ARCHITECTURE-SPINE.md:201`; and the FAIL tier is confirmed at
`ladder.ts:357-371`. Ten of the fourteen round-1 findings verified clean against the code; four
carried a defect of their own. Nine findings in total, all fixed in this pass.

15. **The re-indent's key-order condition was argued and never checked.** `renderJson`'s docblock
    reasoned that `JSON.parse` then `JSON.stringify` preserves RFC 8785 order while no emitted object
    carries an array-index-like key, and nothing enforced it. Several maps in the chain are
    caller-keyed and unconstrained (`KeyTypeMap`, `responseHeaders`, the four `callInputs` channels,
    `channelRoles`, `referenceSets`), and a breach is invisible by construction: the generator would
    write reordered bytes and the drift check would compare them against an identically reordered
    rebuild and exit 0. `renderJson` now round-trips its own output back to canonical bytes and fails
    on a mismatch. Verified by running the check with the trailing newline left off the comparison,
    which fails naming `EvalContract`.
16. **The new CI canary's fixed-point step could pass without the generator writing anything.** It
    ran `generate:worked-example` on an already-clean tree and asserted an empty
    `git status --porcelain`, both of which hold for a generator that does nothing. Substituting `:`
    for the generate command reproduced a green step. It now deletes `probe.json` first, so only a
    generator that rewrites it byte for byte leaves the directory clean. The identical gap in the
    sibling `canary-dev-corpus` is fixed the same way, on `compile-seal-example/brief.json`: it is one
    line, and leaving a known-vacuous assertion in a gate this one was modelled on would ship the
    defect twice.
17. **`FINDINGS.md` claimed `comparabilityKey` is computed over a placeholder digest.** It is not.
    `comparabilityKey` digests the scoring policy digest and the admitted probe identifiers, both
    real; `scoringVersion` is the digest that carries `corpusDigest` and `fixtureDigest`. The
    paragraph now says which digest carries the placeholders, and the code comment beside
    `comparabilityKey` now states that the probe-id list stands where AD-7 names a corpus digest, and
    why, instead of quoting the schema's definition over code that does something narrower.
18. **The "nine hand-declared inputs" claim was two short.** `probeSigned` and `checkResolved` were
    hardcoded `true` beside the nine, and both are things an artifact carries: `probeSigned` is
    `defectSignature !== null` on the probe, and `ladder.ts:42` defines `checkResolved` as the
    caller's own `checkResolution !== null`. Both are read off their sources now, so the claim is
    nine and stays nine.
19. **`FINDINGS.md`'s function list said "four" and named five, and the score-side list was
    incomplete.** Corrected to five, and the score-side list gains `resolveHomeOperation`,
    `makeResolveOperand`, `makePointerDenotesCollection`, and `auditQuotation` — four calls the
    builder makes that a paragraph opening "because 'the reference functions' is too loose to check"
    cannot omit. `buildPlanIndex` and `serializeArtifact` are named beside them as plumbing.
20. **`worked-example-checks.ts`'s new provenance header said all five check expressions moved.**
    Three moved: O-001's second operand and the two `shape` checks. O-002 and O-005 are byte-identical
    between `46a5ba7` and the regenerated contract, which the same comment's own "two conforming and
    three stale" already implied.
21. **Two silent fallbacks where the module otherwise fails loudly.** A `resolvedFrom` naming a
    finding the record does not carry substituted the behaviour severity, which can move the AD-21
    floor comparison with no signal; it now fails. A `selectionOf` miss fabricated a `none` selection
    and fed it to `resolveOutcome`; it now fails, in all three places the lookup happens.
22. **Cast and duplication cleanup, no byte change.** `fail` becomes a function declaration so
    TypeScript narrows through it, which removes both `check as Expression` casts and the
    `oracles[0] as string`; `declaration.members as JsonValue[]` and three casts inside `emptyChannel`
    go with an explicit `KeyedShapeDescriptor` return type; the four finding-bucket loops collapse to
    one over a `keyof FindingMap` list; `addressedSteps` checks the pointer root rather than reading
    segment two of any pointer; `bindingOrder`'s result is destructured to the one field read. The
    `probe as SignedProbe` cast stays, with a comment: narrowing `probe.defectSignature` refines the
    property for reads and leaves the object's declared type alone, so the value is not assignable
    without it. Reproduced in isolation before the comment was written.
23. **Two test assertions compared the builder's output against itself.** The permutation rows
    asserted `result.observationIds`/`partition`/`witnessObservationIds` against `chain.witness.*`, so
    a regression moving the builder's own match moved both sides together. Anchored to literals.
    `buildWorkedExample`, `renderJson`, and the `WORKED_EXAMPLE_FILES` cross-check also reached no
    vitest case, resting on the CI script alone; a new `the emitted file set` block covers all three
    and is the only place `brief.json`, and so the `seal` leg, is asserted.

**Reviewed and deliberately not changed.** The step-to-observation reduction at the top of the
derivation restates `resolveTemporalAnchor`'s rule (`selection.ts:96-127`) rather than calling it,
because that function re-runs the operation-only `selectObservations` instead of taking a
`StepSelection`. Lifting the reduction out of it would be new score-side surface, which this story's
Boundaries forbid; the duplication is recorded in a comment at the call site instead, and extracting
it is a candidate for whichever story next touches `selection.ts`. The drift-window reporter in
`check-worked-example.ts` is the sixth verbatim copy across the `check:*` scripts; collapsing all six
into a shared `scripts/drift-report.ts` is a repo-wide change, not this story's. And the round-1 note
that one negation-then-correction survives by the rule's decision-record carve-out was re-swept: the
surviving instances in the scripts and tests are decision records naming a rejected option and its
reason, which the rule allows. One was not, `README.md`'s "evidence rather than an oversight", and it
is rewritten.

## Verification

**Commands, all run and green:**
- `npm run typecheck` — green, which is the gate that proves the three re-authored literals
  satisfy the current `EvalContract`, `SealedRunRecord`, and `Probe` types
- `npm run generate:worked-example && npm run check:worked-example` — fixed point over the five
  generated files, no drift
- `git status --short _bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/spike-worked-example/`
  after a generate — `FINDINGS.md`, `README.md`, and `system-under-test.md` neither rewritten by the
  generator nor reported by the checker; the first two carry only the retraction edits this story
  makes by hand and `system-under-test.md` is unchanged
- `npx vitest run tests/score/worked-example.test.ts tests/score/witness.test.ts` — green (55 tests),
  including the real-data citation triad, all three permutation families, and the headline verdict
- `npm run validate` — re-run green after round 2: 99 suite files, 3339 tests (two added by finding
  23), 97.05%/92.64% statements/branches, and the five committed files still byte-identical to the
  builder, so nothing round 2 changed moved a published byte
- `npm run validate` — green end to end: build, typecheck, lint, docs, doc-invocations, shareable,
  spine lint, vectors, schemas, AD-5/AD-28 registries, AD-31/AD-33/AD-21 tables, layers, lineage,
  boundary, corpus, **worked-example**, website-deps, and `test:coverage` (99 suite files, 3337
  tests, 97.05%/92.64% statements/branches against the 90% floor; 98 files and 3323 tests before
  this story). `worked-example-artifacts.test.ts`'s pinned 66 and 20 counts are unchanged, and so
  are `worked-example.test.ts`'s two-of-five conforming checks.
- `npm run build:shareable && npm run check:shareable` — re-run after the `README.md` edit, byte-exact
  over 21 pages

**What the regenerated chain now reads, in full:**

| Oracle | State | Corroboration | Check root | Was |
| --- | --- | --- | --- | --- |
| O-001 | `caught` | `agrees` | `false` | `caught`/`agrees` |
| O-002 | `confirmed` | `agrees` | `true` | `confirmed`/`agrees` |
| O-003 | `confirmed` | `agrees` | `true` | `confirmed`/`agrees` |
| O-004 | `abstained` | `agrees` | `insufficient-evidence` (`empty-collection`) | `confirmed`/`agrees` |
| O-005 | `unreached` | `disagrees` | `false` | `confirmed`/`agrees` |

`contractVerdict` FAIL, exit 2, `verdictBasis` naming O-004's `abstained` at the severity floor.
`selectWithBindings` returns `several` for `baseline-read` under its declared `any`, `one` for
`read-back` (`obs-004`, floored at the write's sequence), and `none` for `malformed-write`.
`sealProbeSet` admits P-001 with no exclusions; `matchProbeWitness` resolves `matched` on `obs-004`;
`uncitedFindingIds` returns `F-003` and `uncitedDefectFindingGaps` returns nothing, since F-003 is an
`observation` finding. `buildStrengthVector` reports `defect: { caught: 1, exercised: 1, rate: 1 }`
with `comparable: false`, on one trial against a declared minimum of three and one oracle `unreached`.

## Suggested Review Order

**The builder: authored evidence in, derived chain out**

- Entry point. The whole story in one function: authored inputs at the top, every downstream value a reference call.
  [`worked-example-target.ts:1050`](../../scripts/worked-example-target.ts#L1050)

- The probe passes AD-9's gate before anything scores it; a rejection fails the build.
  [`worked-example-target.ts:1069`](../../scripts/worked-example-target.ts#L1069)

- The binding-aware selector, not bare `selectObservations`: the temporal floor is what separates the two reads.
  [`worked-example-target.ts:1103`](../../scripts/worked-example-target.ts#L1103)

- AD-40's witness match and AD-23's finding buckets, over the real record.
  [`worked-example-target.ts:1138`](../../scripts/worked-example-target.ts#L1138)

- The AD-7 reducer and the rate vector; `completed` derives from the votes array so a second trial cannot understate it.
  [`worked-example-target.ts:1282`](../../scripts/worked-example-target.ts#L1282)

- The verdict. `FAIL`, exit 2, computed from the assessment rather than chosen.
  [`worked-example-target.ts:1339`](../../scripts/worked-example-target.ts#L1339)

- The scoring policy as one declared artifact, so the severity floor is read from one place.
  [`worked-example-target.ts:154`](../../scripts/worked-example-target.ts#L154)

- Canonical bytes re-indented for reading; the docblock states what that costs a digest check.
  [`worked-example-target.ts:138`](../../scripts/worked-example-target.ts#L138)

**The fixed point, and what bounds it**

- The builder's key set is checked against the declared file list, so a dropped emit fails loudly.
  [`worked-example-target.ts:1466`](../../scripts/worked-example-target.ts#L1466)

- Drift only, no orphan sweep; the header says which three prose files that protects.
  [`check-worked-example.ts:45`](../../scripts/check-worked-example.ts#L45)

- No directory clear, for the same reason: an `rm -rf` here would delete the evidence.
  [`generate-worked-example.ts:40`](../../scripts/generate-worked-example.ts#L40)

- The gate joins `validate` beside `check:corpus`.
  [`package.json:110`](../../package.json#L110)

- The ninth drift gate gets the canary every sibling gate has: mutated byte, changed seed, fixed point.
  [`pr-checks.yml:1054`](../../.github/workflows/pr-checks.yml#L1054)

**The regenerated chain itself**

- The headline the prose is built on.
  [`evidence-artifact.json:8`](../planning-artifacts/architecture/architecture-eval-quality-2026-07-29/spike-worked-example/evidence-artifact.json#L8)

- Three AD-20 rules unsatisfied at critical, where the hand-typed artifact carried one at material.
  [`evidence-artifact.json:9`](../planning-artifacts/architecture/architecture-eval-quality-2026-07-29/spike-worked-example/evidence-artifact.json#L9)

- O-005's honest empty witness list: the guard `dispositionUnsupported` reads.
  [`sealed-run-record.json:285`](../planning-artifacts/architecture/architecture-eval-quality-2026-07-29/spike-worked-example/sealed-run-record.json#L285)

- `any` on the baseline read alone; every other step stays `exactly-one`.
  [`eval-contract.json:93`](../planning-artifacts/architecture/architecture-eval-quality-2026-07-29/spike-worked-example/eval-contract.json#L93)

- P-001 finally exists, with an authored signature and qualification record.
  [`probe.json:5`](../planning-artifacts/architecture/architecture-eval-quality-2026-07-29/spike-worked-example/probe.json#L5)

**The record the folder keeps**

- The warning restored: what is still deliberately defective here and must not be copied.
  [`README.md:46`](../planning-artifacts/architecture/architecture-eval-quality-2026-07-29/spike-worked-example/README.md#L46)

- All four defects and where each stands, including the undefined `P-001` the retraction never named.
  [`README.md:29`](../planning-artifacts/architecture/architecture-eval-quality-2026-07-29/spike-worked-example/README.md#L29)

- Finding 9's rewrite: the three gaps, the severity move, and why `verdictBasis` shows one line.
  [`FINDINGS.md:238`](../planning-artifacts/architecture/architecture-eval-quality-2026-07-29/spike-worked-example/FINDINGS.md#L238)

**Tests and provenance**

- The headline result, asserted rather than left to the byte snapshot.
  [`worked-example.test.ts:191`](../../tests/score/worked-example.test.ts#L191)

- The reversed-order flip, now on real data beside the synthetic fixture.
  [`worked-example.test.ts:80`](../../tests/score/worked-example.test.ts#L80)

- What the regeneration closes, oracle by oracle.
  [`worked-example.test.ts:128`](../../tests/score/worked-example.test.ts#L128)

- Provenance re-pointed at the pre-regeneration contract; every literal and both pins frozen.
  [`worked-example-checks.ts:6`](../../tests/schemas/fixtures/worked-example-checks.ts#L6)

- The same carve-out on the sibling fixture.
  [`worked-example-artifacts.ts:1`](../../tests/schemas/fixtures/worked-example-artifacts.ts#L1)

- The command register gains the new pair.
  [`README.md:309`](../../README.md#L309)
