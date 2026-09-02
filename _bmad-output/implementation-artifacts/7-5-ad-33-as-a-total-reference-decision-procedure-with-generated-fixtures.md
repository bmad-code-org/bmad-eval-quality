---
title: 'AD-33 as a total reference decision procedure with generated fixtures'
type: 'feature'
created: '2026-09-02'
status: 'done'
baseline_commit: 'c9b396788b6fc0076121181fb6500f27525ac8e4'
review_loop_iteration: 5
context: [
  '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md',
  '{project-root}/_bmad-output/implementation-artifacts/epic-7-context.md',
  '{project-root}/_bmad-output/implementation-artifacts/7-2-a-monotonic-observation-sequence-and-declared-selector-cardinality.md',
  '{project-root}/_bmad-output/implementation-artifacts/7-4-the-ad-40-defect-signature-corpus-qualification-and-the-witness-match.md',
]
---

# Story 7.5: AD-33 as a total reference decision procedure with generated fixtures

Epic 7, story key `7-5-ad-33-as-a-total-reference-decision-procedure-with-generated-fixtures`.
Implements AD-33 (`ARCHITECTURE-SPINE.md:465-471`) as the one component that assigns an AD-6 outcome
state (`ARCHITECTURE-SPINE.md:255-259`), and closes owed item 2's "the selected observation
identifiers recorded on every outcome" clause (`ARCHITECTURE-SPINE.md:684-690`). No schema change and
no `schemaVersion` bump: the one edit to a schema file is a `z.infer` type export beside an existing
const, which changes no exported byte and needs no `generate:schemas` run. No new AD-5 code, because
nothing here runs at compile time.

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `evidence-artifact.ts:127` says an outcome state is "assigned by AD-33", and no AD-33
exists. Four modules under `src/core/score/` open by disclaiming the job — `selection.ts:6-8` says
"no AD-6 outcome state is assigned. Assigning outcome state is AD-33's reference decision
procedure's job", and `src/core/score/bindings.ts:13`, `qualification.ts:6-7`, and `witness.ts:10-12`
say the same. So the twelve members of `OUTCOME_STATES` are a vocabulary nothing produces, four of
them (`bypassed`, `abstained`, `judge-error`, `oracle-error`) have no firing condition written
anywhere, and `bypassed` occurs only in AD-6's own list and classification sentence
(`ARCHITECTURE-SPINE.md:259`) with no rule to produce it. Story 7.4 shipped a six-member witness
result and recorded that "Story 7.5 inherits the mapping" (`7-4:490-491`); the mapping does not
exist. `mapFindings` and its four buckets have no production consumer at all — the only references
are `witness.ts` itself and `tests/score/witness.test.ts` — so every finding it sorts is sorted and
dropped.

**Approach:** One pure total function, `resolveOutcome`, in three declared stages over fifteen
inputs. Stage A evaluates ten invalidating-condition predicates independently and unions them, so a
condition is never masked by another that fired first. Stage B is an ordered first-match-wins ladder
of twenty rules producing a provisional AD-6 state. Stage C is a two-rule waiver adjustment over a
single waivable failure, so a waiver excuses a gap without deleting a detection or relabelling an
abstention. Corroboration is a fourth ordered table of eight rules, decided after the state, and it
is where a disposition and a declined citation reach the outcome without deciding a state. The inputs
carry the upstream records rather than flattened enums — the step selections, the
`ProbeWitnessMatch`, and the cited finding with its bucket — so the resolution returns the finding it
resolved from and the observation identifiers it read, which is what `Outcome.resolvedFrom` and
`Outcome.selectedObservationIds` (`evidence-artifact.ts:123-147`) need. All four rule tables are
data, so the published decision table is emitted from them and compared byte for byte, the mechanism
AD-31's predicate table already uses. The fixture set covers the declared input domains pairwise
rather than hand-written per cell, which is the shape `ARCHITECTURE-SPINE.md:471` requires after
establishing that a thousand-cell hand-written table is unmeetable.

## Boundaries & Constraints

**Always:** the procedure is pure and total — every input value returns a defined resolution, nothing
throws, no clock, no filesystem, no `Math.random`; it is the only component in the package that
assigns an AD-6 outcome state; reachability resolves before disposition
(`ARCHITECTURE-SPINE.md:471`), and above the waiver by Decision 3; every disposition cites supporting
observations, and an unsupported disposition invalidates cross-artifact agreement rather than being
believed (`ARCHITECTURE-SPINE.md:471`), which this procedure enforces as a returned condition and as
a corroboration of `disagrees`, subject to the two cells Decision 24 records; every invalidating
condition that fires is returned, none masked by another (`ARCHITECTURE-SPINE.md:370`); a
`RuntimeFault` raised below propagates undecorated, per Story 7.4's Decision 5, because AD-28's fault
vocabulary and AD-6's state vocabulary are disjoint (`ARCHITECTURE-SPINE.md:545`);
`unwitnessed-claim` never resolves `missed`; a check resolving `insufficient-evidence` never records
`not-evaluable`; a defect finding mapping to no seeded signature is never counted as a catch
(`ARCHITECTURE-SPINE.md:525`); a witnessed detection is never deleted by an unmatched selection or by
a waiver; the closed sets stay closed at twelve states and three corroboration values;
`src/core/score/` imports nothing outside `core/`, uses no `async`, and mints its vocabularies as `as
const` tuples with a derived type, matching `PROBE_WITNESS_RESULTS` (`witness.ts:74-83`) and
`SELECTOR_CARDINALITIES` (`plan.ts:114-120`); everything reachable from the two new scripts runs
under Node type stripping, so no TypeScript enum, namespace, parameter property, or non-type
re-export may appear in that import graph.

`check:boundary` scans `src/`, `schemas/`, `corpus/`, and `package.json`'s `scripts` field values,
`description`, and `keywords`, with twelve patterns (`scripts/package-boundary.ts:56-105`). The three
new files under `scripts/` and the generated document under `docs/` are outside the scan; the two new
files under `src/core/score/` are inside it, including every string the document builder emits. Five
patterns are live hazards for this story's own vocabulary and none may appear in a source comment or
in an emitted string: `ARCHITECTURE-SPINE.md`; `stor(y|ies)` case-insensitively; `Decisions?[- ]<n>`
case-insensitively, whose lookbehind exempts only `ADR-nnn Decision N`; `epics?`; and
`ACs?[- ]<n>`. The other seven are `_bmad-output`, `planning-artifact`, `implementation-artifact`,
`sprint-status`, `bmad`, `TEA`, and `Tasks?[- ]<n>`. The scanner joins consecutive comment lines both
with a space and with no separator and fires on either join (`package-boundary.ts:160-177`), so a
reference split across two lines still matches. Source comments cite AD numbers, ADR identifiers, and
owed-item numbers only, which is what `selection.ts`, `witness.ts`, `qualification.ts`, and
`src/core/coverage/table.ts` already do.

**Ask First:** none — ambiguities are settled by construction and recorded below, per the epic
preamble (`epics.md:529`).

**Never:** no AD-21 rung, ladder, verdict, or exit code (Story 7.7). Two things this story produces
have no home until Story 7.7 lands its own `schemaVersion` bump, and it says so rather than
pretending otherwise: `unsupported-disposition` is a third Invalid-rung condition beyond the two
`epics.md:613` already assigns to Story 7.7, and the resolution's `waiverRule` and
`declinedFindingIds` have no field on the shipped `Outcome`, so AD-21's WAIVED rung is not derivable
from the artifact until they do (Decision 22). No uncited-finding rung and no gap record (Story 7.8);
no trial-set reducer and no rate vector (Story 7.6); no `score` module claimed in `stage-table.ts`,
whose `score` row keeps `module: null` at `stage-table.ts:129` for the whole of this epic; no field
added, removed, retyped, or made nullable on any schema, and no `schemaVersion` bump; no `.default()`
on `Oracle.polarity`, which `oracle.ts:49` already refuses for a stated reason; no waiver expiry
computed from a clock, because `core/` reads no clock and expiry arrives as a declared input; no
re-filtering of a sealed probe set, which Story 7.4's Decision 13 makes an invalidating condition
here rather than a repair; no `RuntimeFault` caught anywhere in this story's code.

## I/O & Edge-Case Matrix

Rows 1-12 are Stage A: its ten conditions, one row for the union property, and one for the exercise
guard. Rows 13-36 are Stage B: its twenty rules in precedence order plus four rows for the guards
that carry more than one case. Rows 37-39 are Stage C. Rows 40-47 are the eight corroboration rules
in precedence order. Rows 48-53 are `uncitedFindingIds`, the worked-chain fixture, the identifier
order, and the three gate behaviours.

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| evaluation fault | `evaluationFault` | condition `evaluation-fault` | N/A |
| malformed judge response | judge conduct `malformed` | condition `judge-malformed` | N/A |
| unqualified probe in a sealed set | a probe is present and its qualification failed | condition `unqualified-probe-in-sealed-set` | N/A |
| dangling probe citation | cited finding's bucket is `dangling` | condition `dangling-probe-citation` | N/A |
| unwitnessed detection claim | witness result `unwitnessed-claim` | condition `unwitnessed-detection-claim` | N/A |
| vacuous signature | witness result `vacuous` | condition `vacuous-signature` | N/A |
| selector ambiguity | `selectorAmbiguity` | condition `selector-ambiguity` | N/A |
| canary exercised and undetected | class `canary`, some selection resolved other than `none`, no defect finding | condition `canary-non-detection` | N/A |
| canary never reached | class `canary`, every selection `none` or none declared | no condition; the corpus is not indicted for a path the evaluator did not take | N/A |
| unsupported disposition | disposition `held` or `violated` with empty `observationIds` | condition `unsupported-disposition` | N/A |
| disposition missing | `required` with a `null` disposition | condition `disposition-missing` | N/A |
| six conditions at once | a signed unqualified canary with a dangling citation, an unwitnessed claim, an evaluation fault, a malformed judge response, and a selector ambiguity | all six returned, sorted; none masked | N/A |
| evaluation fault | as above | state `oracle-error` | N/A |
| malformed judge response | as above | state `judge-error` | N/A |
| unqualified probe | as above | state `infrastructure-error` | N/A |
| dangling probe citation | as above | state `infrastructure-error` | N/A |
| unwitnessed detection claim | as above | state `infrastructure-error`; never `missed` | N/A |
| vacuous signature | as above | state `infrastructure-error` | N/A |
| selector ambiguity | as above | state `infrastructure-error` | N/A |
| unexercised probe | witness result `unexercised` | state `not-applicable` | N/A |
| steps declared and never produced | no witness, `selections` non-empty, every member `none` | state `unreached` | N/A |
| a signature that never fired, never reached | witness result `not-triggered`, `selections` non-empty, every member `none` | state `unreached`; the one witness value carrying no detection to protect | N/A |
| no steps declared at all | `selections` is empty | `unreached` does not fire; the ladder continues | N/A |
| zero-action probe detected | class `zero-action`, `expectedClean: false`, witness `matched` | state `caught`, by its own named rule | N/A |
| clean control, finding cited | `expectedClean: true`, a defect finding cites the oracle | state `false-positive` | N/A |
| clean control, no finding | `expectedClean: true`, no defect finding | state `passed-clean-control` | N/A |
| canary detected | class `canary`, a defect finding cites the oracle, any bucket | state `caught` | N/A |
| canary exercised and undetected | class `canary`, some selection matched, no defect finding | state `infrastructure-error` | N/A |
| canary never exercised, undetected | class `canary`, no selection matched, no defect finding | the canary rules do not fire; the ladder continues to the tail | N/A |
| witness matched | witness result `matched` | state `caught`, above the unreached rule, so an unmatched selection never deletes it | N/A |
| witness manifested-unclaimed | witness result `manifested-unclaimed` | state `missed` | N/A |
| mapped citation, no witness | no witness, cited finding's bucket is `mapped` | state `caught`, above the abstention rule, so a mapped detection is never relabelled | N/A |
| check examined nothing | check root resolves `insufficient-evidence` | state `abstained` | N/A |
| witness not-triggered, reached | witness result `not-triggered`, some selection matched | state `confirmed`, below the abstention rule | N/A |
| unmapped or signature-less citation, no witness | bucket is `unmapped` or `signatureless` | state `confirmed`; the finding is returned in `declinedFindingIds` | N/A |
| nothing above fired | the final rule | state `confirmed` | N/A |
| waiver honours a miss | waiver `applied-condition-met`, provisional state `missed` | state becomes `not-applicable` | N/A |
| waiver applied without its condition | waiver `applied-condition-unmet`, provisional state `missed` | state becomes `bypassed` | N/A |
| waiver over anything else | any waiver over a success, an invalidation, `unreached`, `abstained`, or `false-positive` | state unchanged; the waiver is inert and no field records that it was present | N/A |
| unsupported disposition | disposition `held` or `violated` with empty `observationIds` | corroboration `disagrees`, ahead of every check-derived rule; the disposition is not believed | N/A |
| disposition contradicts the findings | `violated` with no defect finding, `held` with one, or `not-attempted` with one | corroboration `disagrees` | N/A |
| citation the state declined | bucket `unmapped` or `signatureless` | corroboration `disagrees`, whatever the check resolved | N/A |
| check examined nothing | root resolution `insufficient-evidence`, no earlier corroboration rule firing | `disagrees` where a defect finding cited the oracle, `agrees` where none did; never `not-evaluable` | N/A |
| check never ran | root resolution `null`, or the final state is `unreached`, and no earlier rule firing | corroboration `not-evaluable` | N/A |
| check confirms silence | the check satisfies and no defect finding cited the oracle | corroboration `agrees` | N/A |
| check confirms a finding | the check does not satisfy and a defect finding cited the oracle | corroboration `agrees` | N/A |
| check and findings diverge | the check satisfies with a finding cited, or does not satisfy with none | corroboration `disagrees`; moves nothing on its own | N/A |
| finding citing no oracle | `finding.oracleId` is `null` | returned by `uncitedFindingIds`, sorted; assigned no state | N/A |
| the worked-chain regression | one selection `none`, a `held` disposition citing no observations | `unreached`, corroboration `disagrees`, condition `unsupported-disposition` | N/A |
| observation identifiers | a witness and several selections | each selection's `matchedObservationIds` in the array order of `selections`, then the witness's `observationIds`, deduplicated, keeping first appearance | N/A |
| generated table drifts | a committed byte differs from the builder's output | `check:ad33-table` exits 1 naming the byte offset | exit 1 |
| a rule identifier is renamed in source | a rule table changes, the document does not | `check:ad33-table` exits 1 | exit 1 |
| a state, a rule in any of the three rule tables, or a condition loses its last case | its census count falls to zero | the at-least-one assertion fails, which no regeneration repairs | exit 1 |

</frozen-after-approval>

## Code Map

**Read-only evidence, no change needed:**

- `src/core/schemas/evidence-artifact.ts:20-44` -- `OUTCOME_STATES` (the closed twelve, in that
  order), `OutcomeState`, `CORROBORATION_VALUES`, and `Corroboration` at `:44`. Import them; do not
  redeclare either vocabulary.
- `src/core/schemas/evidence-artifact.ts:46-50` -- `CheckResolutionValue`, a recursive tree. The
  procedure reads its root `resolution` only, spelled `CheckResolutionValue['resolution'] | null`, so
  the input domain is four values and no new vocabulary is minted. The tree itself is the caller's to
  carry to `Outcome.checkResolution`; this procedure returns none.
- `src/core/schemas/evidence-artifact.ts:123-147` -- `Outcome`, nine fields. This story fills four:
  `state`, `resolvedFrom`, `corroboration`, and `selectedObservationIds`. `oracleId`, `probeId`,
  `severity`, `disposition`, and `checkResolution` are the caller's (Decision 20). `disposition` at
  `:130-132` is `OracleDispositionValue`, non-nullable, and its describe says it is "carried through
  from the run record's dispositions rather than re-derived". Note the two spellings one word apart:
  the artifact field is the value, while `OutcomeInputs` takes `OracleDisposition`, the record,
  because Stage A and the corroboration rules need its `observationIds`.
- `src/core/schemas/evidence-artifact.ts:136-138` -- `Outcome.corroboration`, the only place an
  outcome records cross-artifact agreement, which is what "an unsupported disposition invalidating
  cross-artifact agreement" refers to.
- `src/core/schemas/evidence-artifact.ts:139-143` -- `Outcome.selectedObservationIds`, described as
  the identifiers AD-40 names as "what the witness match resolves against and what AD-33 records on
  the outcome". "Resolves against" is the candidate set, so the witness half of Decision 19 reads
  `ProbeWitnessMatch.observationIds` rather than `witnessObservationIds`.
- `src/core/schemas/evidence-artifact.ts:277-281` -- the `uncitedFindings` artifact field AD-33's
  second fixed cell fills. The new function is named `uncitedFindingIds` so the two do not collide.
- `src/core/schemas/sealed-run-record.ts:27-117` -- `QuotedEvidence` and `Finding`, discriminated on
  `findingType`, with a nullable `oracleId` and a required `probeId` on all three branches (`:45`).
  `Finding.severity` at `:51` is one of the two severity sources Decision 20 names.
- `src/core/schemas/sealed-run-record.ts:134-137` -- `OracleDisposition.observationIds`, required and
  permitted to be empty, with the describe recording that an unsupported disposition stays
  representable "for the scorer to invalidate it". This procedure is that scorer.
- `src/core/schemas/oracle.ts:21-23,45-50` -- two polarity fields ship, and `oracle.ts:22` records
  that the duplication is deliberate so `direction-check-misaligned` stays detectable. The procedure
  reads `Oracle.polarity` (`:48-50`), never `Direction.polarity`. `Oracle.check` is nullable at
  `:45-47`, which is the second route to a `null` check resolution.
- `src/core/schemas/expression.ts:58-61` -- `Polarity`, both the Zod enum and the inferred type,
  already exported under one name.
- `src/core/schemas/plan.ts:114-120,138` -- `SELECTOR_CARDINALITIES`, `SelectorCardinalityValue`, and
  `cardinality` on the step. Read for context only; the procedure takes a precomputed
  `selectorAmbiguity` boolean instead (Decision 12).
- `src/core/schemas/probe.ts:17-24,75-112` -- `PROBE_CLASSES`, `ProbeClass`, the `expectedClean`
  discriminant, the clean-control branch at `:77-88` which carries no `defectSignature` key at all,
  and the nullable `defectSignature` at `:98-100`. `probe.ts:109` records that a signature-less
  non-canary parses on purpose so the gate can return a reason code.
- `src/core/schemas/eval-contract.ts:65-69` -- `Behavior.oracles`, the only declared relation between
  a behaviour and an oracle, which is where requiredness comes from. `Behavior.severity` at `:52` is
  the second severity source.
- `src/core/schemas/waiver.ts:12-29` -- `Waiver`, whose `condition` is an opaque nullable string and
  whose `expiresAt` is a nullable RFC 3339 stamp. Nothing in `src/` evaluates either today.
- `src/core/compile/waivers.ts:8-16` -- `REQUIRED_WAIVER_PARTS` and `checkWaiverCompleteness`, called
  from `compile/compile.ts:109`, which is what AD-6's "an unexpired waiver satisfying AD-5" already
  means by the time a run is scored (Decision 23).
- `src/core/score/witness.ts:74-83` -- `PROBE_WITNESS_RESULTS`, six members whose declaration order
  is the evaluation order, and `ProbeWitnessResultValue`.
- `src/core/score/witness.ts:86-88` -- `SignedProbe`, which names no `probeClass`, so a signed canary
  is a `SignedProbe` and does carry a witness result (Decision 5).
- `src/core/score/witness.ts:99-121` -- `ProbeWitnessMatch`, **nine** fields: `result`, `basis`,
  `homeOperationResolved` (`:107`), `exercised`, `observationIds`, `partition`, `partitionSizes`,
  `witnessObservationIds`, and `unwitnessedFindingIds`. A fixture literal must supply all nine.
- `src/core/score/witness.ts:164-165` -- the observation comparator, `a.sequence - b.sequence` with an
  identifier tiebreak, byte-identical in ordering to `selection.ts:70-72`. Decision 19 rests on both
  sources sorting under that same total order.
- `src/core/score/witness.ts:361-378` -- `MappedFinding` and `FindingMap`'s four buckets: `mapped`,
  `unmapped` ("An unexpected real defect under AD-23, never a catch"), `dangling` ("an AD-32
  cross-artifact dangling reference"), and `signatureless` ("cited to a canary or a clean control").
  The bucket is keyed on the cited finding's own `probeId` (`witness.ts:412-420`), which is a
  different probe from the outcome row's; Decision 13 turns on that.
- `src/core/score/selection.ts:24-33` -- `SelectionCount` and `StepSelection`, whose
  `matchedObservationIds` is in ascending-`sequence` order, empty for `none`, one member for `one`,
  and "two or more for `several`".
- `src/core/score/qualification.ts:80-94` -- `QualificationResult` with `qualified`, `failures`, and
  `declarationChecksRan`.
- `src/core/score/qualification.ts:143-177` -- `admissibleRoutes`, module-private, whose empty return
  is "the illegal cell: a pairing no route can satisfy, which the schema admits so this gate can name
  it". Decision 17 cites it and imports nothing.
- `src/core/score/qualification.ts:691-758` -- `qualifyProbe` with the two signature gates
  `signature-present-on-canary` (`:700-708`) and `signature-absent` (`:709-715`), plus
  `QualifiedProbe` and `SealedProbeSet`.
- `src/core/score/bindings.ts:158` -- the shipped ambiguity predicate,
  `selection.result === 'several' && step.cardinality !== 'any'`. Note the path: `src/core/compile/`
  carries a different `bindings.ts` whose `:158` is unrelated.
- `src/core/score/quotation.ts:126-128` -- `auditQuotation`, which runs over every defect finding
  regardless of bucket. Decision 14's narrowing of `unsupported-disposition` leans on it.
- `src/core/coverage/rules.ts:3-6` -- why `CoverageGap.rule` is an opaque string, which is the same
  reasoning Decision 2 applies to `Waiver.condition`.
- `src/core/evaluate/operators.ts:229` -- the only `operator-cannot-accept-operand` throw, and
  `tests/evaluate/resolution.test.ts:1292` pins that it propagates undecorated. Decision 6 names what
  that costs.
- `src/core/lineage/stage-table.ts:115-130` -- the `score` row, with `module: null` at `:129`. Assert
  it in a test so this story cannot quietly claim the stage.

**New:**

- `src/core/score/outcome.ts` -- NEW: `INVALIDATING_CONDITIONS`, `InvalidatingCondition`,
  `OUTCOME_RULES`, `OutcomeRuleId`, `WAIVER_RULES`, `WaiverRuleId`, `WAIVABLE_FAILURES`,
  `CORROBORATION_RULES`, `CorroborationRuleId`, `FINDING_BUCKETS`, `FindingBucketValue`,
  `WAIVER_STATES`, `WaiverStateValue`, `JUDGE_CONDUCT_STATES`, `JudgeConductValue`, `CitedFinding`,
  `OutcomeInputs`, `OutcomeResolution`, `resolveOutcome`, `uncitedFindingIds`.
- `src/core/score/outcome-table.ts` -- NEW: `outcomeDecisionTable(cases, constraints): string`, the
  pure builder, parameterised the way `coveragePredicateTable(contracts, cells)` is
  (`src/core/coverage/table.ts:119-122`) so its input can live under `tests/`.
- `scripts/ad33-table-target.ts` -- NEW: `AD33_TABLE_NAME`, `AD33_TABLE_DIRECTORY`,
  `AD33_TABLE_TARGET`, `AD33_TABLE_PATH`, `AD33_TABLE_FRONTMATTER`. Mirrors
  `scripts/ad31-table-target.ts:1-23`, including the Starlight `title` and `description`, which
  `website/src/content.config.ts` requires and without which the `docs` workflow fails.
- `scripts/generate-ad33-table.ts` -- NEW: thin I/O wrapper mirroring `scripts/generate-ad31-table.ts`
  including its guarded try/catch and its byte-count success line.
- `scripts/check-ad33-table.ts` -- NEW: byte-exact drift check mirroring
  `scripts/check-ad31-table.ts:33-82`. It must print the same
  `ad33-outcome-decision.generated.md: drift at byte offset <n>` shape that `check-ad31-table.ts:72`
  emits and `pr-checks.yml:577,596` greps for, carry the missing-file message, and import `readFile`
  only so it cannot rewrite.
- `docs/ad33-outcome-decision.generated.md` -- NEW, committed, generated, never hand-edited.
- `tests/score/fixtures/outcome-inputs.ts` -- NEW: `INPUT_DOMAINS`, `STRUCTURAL_CONSTRAINTS`,
  `infeasiblePairs`, `pairwiseCases`, `RULE_WITNESS_CASES`. Deterministic by construction: no clock,
  no `Math.random`, no filesystem, the constraint `tests/schemas/published/mutant-generator.ts:11-13`
  states.
- `tests/score/outcome.test.ts` -- NEW.
- `tests/score/outcome-table.test.ts` -- NEW, driving the pure builder in memory and reading no file,
  the way `tests/coverage/table.test.ts:1-4` does.

**Changed:**

- `src/core/schemas/sealed-run-record.ts:131` -- add
  `export type OracleDisposition = z.infer<typeof OracleDisposition>` beside the const, matching how
  `Observation` (`:169`, `:211`) and `SealedRunRecord` (`:282`, `:350`) already pair a type with their
  schema. Only `export const OracleDisposition` exists today, so `OracleDisposition` in a type
  position is `TS2749`, confirmed by compilation. A `z.infer` alias changes no exported byte and is
  not a schema edit.
- `package.json:88-89,104` -- add `generate:ad33-table` and `check:ad33-table` beside the AD-31 pair,
  and splice `check:ad33-table` into `validate` directly after `check:ad31-table`. The `scripts`
  field values are scanned by `check:boundary`, so neither new script body may carry one of the five
  hazard patterns.
- `.github/workflows/pr-checks.yml` -- a named `check:ad33-table` step in `validate-and-build` beside
  `:49-50`, one in `floor` beside `:135-136` (mandatory: `:128` requires it for any new
  `node scripts/*.ts` in `validate`), the `Validate` step's `name:` string at `:97`, and a new
  `canary-ad33-table` job modelled on `canary-ad31-table` (`:541-609`, seven steps: four setup and
  the three assertions) with its own bespoke `sed` target for the renamed-rule step.
- `README.md:294,303-304,347-352` -- the validate summary line, the two command lines inside the
  fenced block at `:292-309`, and the paragraph, which is the three-site edit story 5.3 made for the
  AD-31 table.
- `_bmad-output/shareable/eval-quality-readme.html` -- regenerate with `npm run build:shareable`,
  because `check:shareable` compares it byte for byte and a README edit alone fails it.

**Counters that move:**

- `tests/score/` file and test counts, and the global branch-coverage number, recorded in this
  story's Dev Agent Record. Story 7.4 recorded 96.74% statements and 92.05% branches at this baseline
  (`7-4:969-970`) against a 90% floor, which is roughly 47 branches of headroom; no coverage artifact
  is committed (`vitest.config.ts:23` writes to the temp directory), so that recorded figure is the
  reference. Four rule tables of ten, twenty, two, and eight rules are branch-dense, and reaching a
  rule is not the same as covering both arms of its guard.

## Tasks & Acceptance

**Execution:**

- [x] `src/core/schemas/sealed-run-record.ts` -- export the `OracleDisposition` type beside the const
- [x] `src/core/score/outcome.ts` -- the input type, the condition predicates, the state ladder, the
      waiver adjustment, the corroboration rules, `resolveOutcome`, and `uncitedFindingIds` -- one
      file so the four tables read top to bottom and cannot be split across modules that disagree
- [x] `src/core/score/outcome-table.ts` -- the pure builder over resolved cases and the structural
      constraints: the four emitted rule tables, the derived infeasible pairs, and the per-state,
      per-state, per-ladder-rule, per-waiver-rule, per-corroboration-rule, and per-condition
      censuses
- [x] `tests/score/fixtures/outcome-inputs.ts` -- the declared domains, the seven named structural
      constraints, the infeasible pairs derived from them, the pairwise covering array, one witness
      case per rule and per condition, and the two named fixtures
- [x] `tests/score/outcome.test.ts` -- totality, the twelve states positive and negative, pairwise
      coverage, every constraint and every derived infeasible pair asserted unreachable, every rule
      and condition reached with both guard arms, the exact pinned counts and the at-least-one floor,
      `stage-table.ts:129` still `module: null`
- [x] `tests/score/outcome-table.test.ts` -- the builder over in-memory input, no filesystem
- [x] `scripts/ad33-table-target.ts`, `scripts/generate-ad33-table.ts`,
      `scripts/check-ad33-table.ts` -- the writer, the check, and the one path constant they share
- [x] `npm run generate:ad33-table` -- commit `docs/ad33-outcome-decision.generated.md`
- [x] `package.json` -- the two scripts plus the `validate` splice
- [x] `.github/workflows/pr-checks.yml` -- two named steps, the `Validate` step name, and the
      `canary-ad33-table` job
- [x] `README.md` at its three sites, then `npm run build:shareable`
- [x] `npm run validate` green end to end; leave changes uncommitted

**Acceptance Criteria:**

1. Given any value of `OutcomeInputs`, when `resolveOutcome` runs, then it returns exactly one AD-6
   state, exactly one corroboration value, the ladder rule identifier that fired, the corroboration
   rule identifier that fired, the waiver rule identifier or `null`, a nullable `resolvedFrom`
   finding identifier, the observation identifiers it read, the finding identifiers it declined to
   resolve from, and a sorted list of invalidating conditions; it throws nothing, reads no clock and
   no filesystem, and is the only function in the package that assigns an AD-6 state.
2. Given several invalidating conditions holding at once, when the procedure runs, then every one is
   returned and none is masked, because the condition predicates are evaluated independently of the
   state ladder; a named fixture presents a signed unqualified canary with a dangling citation, an
   unwitnessed claim, an evaluation fault, a malformed judge response, and a selector ambiguity, and
   asserts all six conditions come back. That is AD-21's "the record carries every condition that
   fired" and the reason it gives, that a persistent judge fault cannot mask a real regression.
3. Given the state ladder, when it is read in order, then it is first-match-wins, every rule carries
   a stable kebab-case identifier and an explicit guard rather than an `otherwise`, the final rule's
   guard is the stated negation of every guard above it, and each of the twelve states is the outcome
   of at least one rule or of the waiver adjustment.
4. Given each of the six `PROBE_WITNESS_RESULTS` on a probe outside the `expectedClean` branch,
   which is the only branch a witness exists on, no earlier ladder rule firing, and no waiver
   adjustment applying, then `matched` resolves `caught`, `manifested-unclaimed` resolves `missed`,
   `not-triggered` resolves `confirmed`, `unexercised` resolves `not-applicable`, `vacuous` resolves
   `infrastructure-error`, and `unwitnessed-claim` resolves `infrastructure-error` and never
   `missed`, with a fixture asserting no input carrying `unwitnessed-claim` produces `missed`.
5. Given a cited finding on an oracle carrying **no witness**, when its bucket is `mapped` it
   resolves `caught` where no earlier rule fires; when it is `unmapped` or `signatureless` it never
   resolves `caught`, is returned in `declinedFindingIds` where the state did not resolve from it,
   and forces a corroboration of `disagrees`; when it is `dangling` the `dangling-probe-citation`
   condition fires. On an oracle carrying a witness outside the `expectedClean` branch the witness
   rules decide and the three remaining buckets do not enter; `dangling` is the exception, because its row sits above every witness row
   and an AD-32 cross-artifact dangling reference outranks a match. The clean control and the canary
   are the two carve-outs and read citation presence without its bucket, per Decision 13.
6. Given AD-26's evaluation-fault input, then the state is `oracle-error`; given AD-17's malformed
   judge conduct, `judge-error`. Both are declared inputs rather than caught exceptions, and a
   `RuntimeFault` thrown below still propagates undecorated.
7. Given a provisional state of `missed`, when the waiver is `applied-condition-met` the state
   becomes `not-applicable`, and when it is `applied-condition-unmet` it becomes `bypassed`; given
   any other provisional state, or a waiver of `none` or `expired`, the state is unchanged. Fixtures
   assert that no input with witness result `matched` ever resolves `not-applicable`, that no
   `abstained` is ever relabelled, and that no `expectedClean: true` input reaches Stage C at all.
8. Given no witness or a witness result of `not-triggered`, a non-empty `selections`, and every
   member resolving `none`, then the state is `unreached`, resolved above the waiver adjustment so a
   waiver never converts an evidence condition into a behavioural failure, and its corroboration is
   `not-evaluable` unless an earlier corroboration rule fires; given an empty `selections`,
   `unreached` does not fire, because AD-6 scopes it to an oracle's *declared* steps and an oracle
   that declared none had nothing to produce; given any other witness result, `unreached` does not
   fire either, so an unmatched selection never deletes a witnessed detection.
9. Given `expectedClean: true`, no rule above the clean-control pair firing, and a check root that
   did not resolve `insufficient-evidence`, then the state is exactly `passed-clean-control` or
   `false-positive`, which is AD-9's "its legal states are exactly" clause read over behavioural
   outcomes per Decision 25. Where the check root did resolve `insufficient-evidence` and no finding
   was cited, and no rule below the pair firing first, the state is `abstained`, which AD-4 and AD-6
   place there unconditionally and which implementation decision 12 records; over the whole input
   type a clean control's reachable states are the eight implementation decision 24 enumerates, and
   `caught`, `missed`, `bypassed` and `confirmed` are none of them; and a `zero-action` probe with
   `expectedClean: false` whose witness result is `matched` resolves `caught` under its own named
   rule, with a fixture asserting no such input ever produces `passed-clean-control`.
10. Given a check whose root resolution is `insufficient-evidence` and no earlier ladder rule firing,
    then the state is `abstained`; that rule sits above the `not-triggered` rule so an oracle whose
    check examined nothing never resolves `confirmed`, and below the two witness rules and the
    mapped-citation rule so a detection is never relabelled as an abstention. Its corroboration is
    `disagrees` where a defect finding cited the oracle and `agrees` where none did, and never
    `not-evaluable`, with a fixture asserting the absence of `not-evaluable` across every
    `insufficient-evidence` input; the two cells where an earlier corroboration rule overrides the
    `agrees` arm is recorded in Decision 24.
11. Given a disposition of `held` or `violated` whose `observationIds` is empty, then
    `unsupported-disposition` fires regardless of what the selections matched and regardless of the
    resolved state, **and** the corroboration is `disagrees`, ahead of every check-derived rule, so
    the disposition invalidates cross-artifact agreement rather than being believed; given a
    `violated` disposition with no defect finding, a `held` disposition with one, or a
    `not-attempted` disposition with one, the corroboration is `disagrees`; given `required: true`
    with a `null` disposition, `disposition-missing` fires.
12. Given a run record, when `uncitedFindingIds(record)` runs over a
    `Pick<SealedRunRecord, 'findings'>`, then it returns the identifiers of every finding whose
    `oracleId` is `null`, sorted by `findingId`, assigning them no state and discarding none.
13. Given the revision-3 worked-chain defect `ARCHITECTURE-SPINE.md:471` names — an oracle recorded
    `confirmed` with corroboration `agrees` whose step matches zero observations and whose
    disposition narrates a rejection appearing in no observation — when it is presented as a named
    fixture with one selection resolving `none` and a `held` disposition carrying no observation
    identifiers, then the procedure resolves `unreached` with corroboration `disagrees` and returns
    `unsupported-disposition`. Both halves of the defect are caught: the state is no longer
    `confirmed` and the corroboration is no longer `agrees`.
14. Given `npm run generate:ad33-table`, then it writes `docs/ad33-outcome-decision.generated.md`
    carrying the condition list, the state ladder, the waiver rules, and the corroboration rules each
    with its identifier and outcome; the named structural constraints and the infeasible pairs
    derived from them; and per-state, per-ladder-rule, per-waiver-rule, per-corroboration-rule, and
    per-condition censuses with
    every count at least one. `npm run check:ad33-table` compares the committed bytes, exits 1 naming
    the first differing byte offset on drift, exits 1 with a run-the-generator message when the file
    is missing, and never rewrites what it checks.
15. Given the fixture set, when the test suite runs, then it is the union of a pairwise covering
    array over `INPUT_DOMAINS`, one witness case per ladder rule, per waiver rule, per corroboration
    rule, and per invalidating condition, and the two named fixtures; every feasible pairwise
    combination is covered, every named structural constraint and every derived infeasible pair is
    asserted unreachable, every rule and condition fires at least once, each of the twelve states has
    at least one case producing it and at least one near-miss case differing in a single field that
    produces a different state, every per-state, per-ladder-rule, per-waiver-rule,
    per-corroboration-rule, and per-condition count is asserted at least one so a genuine drop fails
    without a regeneration, and the same counts are additionally asserted as exact literals so a drop
    above zero is visible in the diff. `RULE_WITNESS_CASES` covers two shapes explicitly rather than
    relying on the covering array: `zero-action` with `expectedClean: true` and `probeQualified: true`,
    the only pairing under which `passed-clean-control` and `false-positive` are reachable at all;
    and the six-conjunct tuple that reaches `bypassed`.
16. Given `npm run validate`, then every check passes including `check:ad33-table` in its spliced
    position and `check:boundary` over both new `src/` files, `src/core/**` stays at or above the 90%
    statement and branch floor, and `stage-table.ts:129` still carries `module: null`.

## Spec Change Log

**Round 1 — peer story review of draft 0, plus a subagent conformance pass over the epic AC.** 10
HIGH, 14 MEDIUM, 12 LOW from the peer; 2 HIGH, 4 MEDIUM, 4 LOW from the subagent, two overlapping.
The input type discarded every identifier the story exists to produce; the ladder was not total for a
defect finding with a `null` check resolution; the tail counted an unmapped finding as a catch;
`mapFindings`'s `dangling` bucket reached no rung; the waiver sat above reachability; the table
builder took no parameters while its input lived under `tests/`; the enumeration was read as
exhaustive; four field types did not compile; `cardinality` was a dead axis.

**Round 2 — the same peer re-verifying draft 1.** 26 of 37 closed; 6 HIGH, 13 MEDIUM, 3 LOW. The
first-match ladder could return only one invalidating condition while 51 of its 55 row pairs
co-occur, so the procedure became three stages with independent condition predicates. An oracle that
examined nothing resolved `confirmed`. A finding filed against a clean control resolved `caught`. The
check alone split `missed` from `confirmed`. The waiver deleted detections. The feasibility filter
was self-contradictory. `selectedObservationIds` was unimplementable. `OracleDisposition` did not
compile.

**Round 3 — the same peer re-verifying draft 2.** 14 of 21 closed; 10 HIGH, 11 MEDIUM, 12 LOW. The
restructure had dropped the corroboration half of AD-33's unsupported-disposition invariant; that
condition reached no AD-21 rung; three ladder rows outranked rules that should beat them, two of them
deleting a detection; the unreached guard fired on an empty selections array; Stage C broke AD-9's
"exactly" and relabelled an abstention; `waiverRule` and `declinedFindingIds` had no home; and two
corroboration rules were owed. The ladder was reordered, Stage C narrowed to one waivable state, and
the corroboration table grew to eight rules.

**Round 4 — the same peer re-verifying draft 3.** 24 of 35 closed; 5 HIGH, 9 MEDIUM, 6 LOW, all of
them the acceptance criteria and the prose failing to keep up with the ladder edits those same
criteria had demanded. The changes:

- **Three corroboration rules moved above the check-derived rules, and the two cells that cost are
  recorded.** With `examined-nothing` first, an unsupported disposition on a check that resolved
  `insufficient-evidence` with no finding recorded `agrees` — the disposition believed, which is the
  spine's own word for the thing the invariant forbids. `disposition-unsupported`,
  `disposition-contradicts-evidence`, and `citation-declined` now sit above both check-derived rules,
  `examined-nothing` stays above `never-ran` so `insufficient-evidence` still never records
  `not-evaluable`, and Decision 24 records the single cell where the spine's invariant overrides the
  epic AC's `agrees` arm.
- **Four acceptance criteria contradicted each other or the ladder on generated inputs.** The
  worked-chain fixture asserted `not-evaluable` where the reordering now gives `disagrees`, which
  catches both halves of the defect rather than one; the unreached criterion asserted
  `not-evaluable` unquantified; the declined-citation criterion asserted `disagrees` "whatever the
  check resolved", which is now literally true; and the mapped-citation criterion named a rule its
  own new `witness === null` guard makes unreachable on a signed probe. All four are re-synced.
- **The canary's ladder rule never received the exercise guard its condition got**, so an unexercised
  canary resolved `infrastructure-error` with an empty condition list — indicting the corpus while
  removing the explanation. The rule now carries the condition's guard verbatim, the condition is
  renamed `canary-non-detection` so one identifier does not name two predicates with different
  guards, and the totality argument is restated.
- **The `not-attempted` corroboration arm pointed the wrong way.** It penalised a `not-attempted`
  disposition that cited the observations showing why the evaluator could not proceed, which is what
  `ARCHITECTURE-SPINE.md:471`'s "every disposition citing supporting observations" asks for, while
  leaving the real contradiction uncovered: a `not-attempted` on an oracle a defect finding cites.
  The arm is replaced.
- **The unreached rule's witness guard suppressed a legitimate `unreached`.** Only `matched` and
  `manifested-unclaimed` carry a detection to protect; `not-triggered` carries none, so the guard is
  widened to admit it and an oracle whose steps were never produced records `unreached` rather than
  `confirmed`.
- **Smaller corrections in the same pass:** the at-least-one floor now covers all three rule tables
  rather than the ladder alone, which was the gap Decision 15 exists to close; `Outcome.checkResolution`
  moves to the caller-owned list, since the procedure reads a root value and returns no tree, so this
  story fills four of nine fields rather than five; Decision 19 names `ProbeWitnessMatch.observationIds`
  literally and reconciles it with the destination field's own describe; Decision 25 records that
  AD-9's "exactly" is read over behavioural outcomes, so an unreached clean control is outside its
  scope and the ladder's unreached rule needs no clean-control guard; Stage C's clean-control
  conjunct is dropped as structurally dead and its exclusion re-derived; Decision 22 counts four
  fields rather than two; Decision 3 records the two inert-waiver cases; the `bypassed` tuple joins
  the explicit-coverage sentence; the matrix legend is recounted against 53 rows; and six citations
  are corrected, including the observation comparator, the pair count, and three spine and epic
  anchors.

**Round 5 — confirmation pass.** Two prose defects, no behaviour. The spine-over-epic divergence is
two cells rather than one: a `violated` disposition citing observations, with no defect finding and a
check resolving `insufficient-evidence`, also records `disagrees` where the epic AC's `agrees` arm
would apply, for the same reason. Decision 24 now names both and states why no third exists. And the
emitted document's census list omitted the waiver rules, so the document would have published four
censuses while the test floored five; both the criterion and the task now carry the five-way
spelling the fixture criterion already used.

**KEEP** — confirmed across five rounds and required to survive any re-derivation: the three-stage
split plus the corroboration table, which the reviewer endorsed and declined to revisit; Stage A's
independence as the answer to condition masking; the six-simultaneous-conditions tuple, verified
reachable and verified to yield exactly six; all seven structural constraints, each verified
individually true against shipped code and mutually consistent, admitting no tuple shipped code
cannot produce and excluding none it can; Stage B's totality argument, walked twice; the eight
corroboration rules being total with no `otherwise`; Decision 11's collapse to `confirmed` as the
answer `ARCHITECTURE-SPINE.md:518` permits, with `missed` reachable only from
`manifested-unclaimed`; Decision 19's concatenation, verified deterministic and permutation-stable;
Decision 23's reading of "an unexpired waiver satisfying AD-5", verified end to end through
`compile/compile.ts:109`; `probeQualified: boolean | null` handled correctly by both readers; all
twelve states reachable including `bypassed`; and the CI plan, whose line citations were verified
exact four times.

## Decisions settled by construction

Per the epic preamble (`epics.md:529`), each of these is decided here rather than escalated.

1. **`bypassed` is a waiver applied without its condition being met.** The spine names `bypassed`
   only in AD-6's list and in its behavioural-failure classification, both on
   `ARCHITECTURE-SPINE.md:259`, and gives it no firing condition anywhere; AD-30
   (`ARCHITECTURE-SPINE.md:445`) nonetheless demands a fixture producing it. The reading has a home in
   the shipped schema: `Waiver.condition` is an opaque nullable string whose describe says a `null`
   condition is a complete waiver (`waiver.ts:25`). So a waiver with a condition, applied to an
   oracle whose context does not satisfy it, is a gap excused without earning the excuse, which is
   the group AD-6 puts `bypassed` in.
2. **Whether the condition was met, and whether the waiver has expired, are declared inputs.**
   `Waiver.condition` has no grammar, and `coverage/rules.ts:3-6` records why `CoverageGap.rule` is
   opaque; inventing a grammar here would mint the vocabulary AD-20 declined to. So `waiver` is
   four-valued — `none`, `applied-condition-met`, `applied-condition-unmet`, `expired` — and expiry
   arrives decided, because `core/` reads no clock.
3. **The waivable group is `missed` alone, and it is deliberately not AD-6's behavioural-failure
   group.** A waiver excuses a known gap. Of AD-6's four behavioural failures, `bypassed` is what
   this stage produces; `false-positive` is excluded because a clean control is the instrument's own
   calibration and waiving it waives the calibration, and structurally because `false-positive` comes
   only from the clean-control rule while `missed` comes only from a rule requiring a witness, which
   `witness-requires-a-signature` makes disjoint from `expectedClean: true`; `abstained` is excluded
   because `ARCHITECTURE-SPINE.md:207` puts it at `abstained` "rather than to `not-applicable`, which
   is excluded from every count and would be this defect wearing a new label", and an abstention is
   an unknown rather than a gap, so there is nothing to excuse. Reachability stays above the waiver
   for the reason `ARCHITECTURE-SPINE.md:471` gives, and the waiver stays below the probe rules
   because a honoured waiver over a `matched` witness would delete a detection: AD-7's denominator
   counts probes the evaluator exercised (`ARCHITECTURE-SPINE.md:265`), so the probe would stay in
   the denominator with its catch removed from the numerator and a waiver would depress the catch
   rate. Three consequences are recorded rather than left to be discovered. An unreached oracle
   carrying a honoured waiver resolves `unreached` rather than `not-applicable`, so it reaches
   AD-21's CONCERNS rung rather than WAIVED; both exit zero, so no exit code moves. And a waiver
   written against an `abstained` or a `false-positive` gap is inert: it changes nothing, and no
   field records that a waiver was present and unused, until Story 7.7 lands `waiverRule` per
   Decision 22.
4. **Invalidating conditions are computed independently of the state, and the unsupported disposition
   carries two obligations rather than one.** AD-21 requires that "the record carries every condition
   that fired and every behavioural failure already resolved, so a persistent judge fault cannot mask
   a real regression indefinitely" (`ARCHITECTURE-SPINE.md:370`), and the Stage B guards overlap
   almost completely because they read distinct input fields, so a first-match ladder would mask most
   of them. Stage A evaluates ten predicates and unions their results; Stage B computes only the
   state. AD-33 separately requires "an unsupported disposition invalidating cross-artifact
   agreement rather than being believed" (`ARCHITECTURE-SPINE.md:471`), and cross-artifact agreement
   is the corroboration field (`evidence-artifact.ts:136-138`), so that one condition also forces a
   corroboration of `disagrees` from the first rule of the corroboration table. The two are different
   obligations discharged in different places, and `sealed-run-record.ts:137` says the schema keeps
   an unsupported disposition representable "for the scorer to invalidate it", which is this
   procedure.
5. **An undetected canary resolves `infrastructure-error` and fires its own condition, and both are
   guarded on the oracle having been reached.** AD-9 says a canary "qualifies by demonstrating that
   non-detection indicts the corpus or fixture rather than the contract"
   (`ARCHITECTURE-SPINE.md:277`), so a canary nobody caught is, by its own qualification argument, a
   statement that the corpus or fixture is broken. Scoring it `missed` would say the contract is
   weak, the one reading AD-9 rules out. Both the condition and the ladder rule require at least one
   selection to have matched, because `ARCHITECTURE-SPINE.md:525` names "punishing the contract for
   the evaluator's path choice" as an anti-goal and a canary has no unexercised route: it carries no
   signature, so `witness` is `null` and the unexercised rule cannot rescue it, leaving step
   reachability as the only proxy. Guarding the condition alone would have indicted the corpus
   through the state while removing the explanation, since `infrastructure-error` is one of the three
   states AD-6 says invalidate the run and AD-21 reads the state. A canary that was never reached
   with declared steps resolves `unreached`; one that declares no step at all falls to the final
   rule. A caught canary resolves `caught`; AD-7 keeps canaries out of the dominance vector by class
   (`ARCHITECTURE-SPINE.md:265`), so no value here moves a rate. What keeps a canary off the witness
   rules is `signature-present-on-canary` (`qualification.ts:700-708`) forcing
   `probeQualified: false`, which fires the unqualified-probe rule ahead of them — `SignedProbe`
   (`witness.ts:86-88`) names no class, so a signed canary does carry a witness result.
6. **AD-26's evaluation fault is a caller-supplied input, and its rule is fixture-only until ingest
   exists.** `ARCHITECTURE-SPINE.md:404` puts `oracle-error` at runtime — "reserved for genuine
   authoring faults the compiler could not detect: an operand type the schema admitted but the
   operator cannot accept, or an impossible operator application" — so the mapping is right. The only
   realisation in shipped code is the `RuntimeFault` thrown at `operators.ts:229`, and
   `tests/evaluate/resolution.test.ts:1292` pins that it propagates undecorated;
   `ARCHITECTURE-SPINE.md:545` forbids merging the fault and state vocabularies, and Story 7.4's
   Decision 5 forbids catching it. So the flag is set by whoever recorded the fault at the ingest
   boundary, `stage-table.ts` gives `ingest` `module: null` for the whole of this epic, and until
   epic 8 gives it one the rule fires only from fixtures. The input exists so `oracle-error` is
   derivable at all, which is what the epic AC asks for, and the producer lands with the module that
   can produce it.
7. **`required` is an input beside `disposition`, and the procedure never returns a disposition.**
   `Outcome.disposition` is non-nullable (`evidence-artifact.ts:130-132`) and its describe says it is
   carried through from the run record rather than re-derived, so the caller already holds it.
   Encoding "not required" and "required but missing" onto one `null` would make
   `disposition-missing` fire for every unreferenced oracle or never. A required oracle with no
   disposition therefore has no writable `Outcome` at all, which is exactly AD-23's "A missing
   disposition invalidates under AD-21 rather than defaulting to any state"
   (`ARCHITECTURE-SPINE.md:382`): the condition comes back and the artifact assembly in epic 8
   refuses the row rather than inventing a value. Requiredness itself comes from `Behavior.oracles`
   (`eval-contract.ts:65-69`), the only declared relation between a behaviour and an oracle, since no
   schema carries a `required` flag; computing it is the caller's and the rung that reads it is Story
   7.7's.
8. **Judge conduct is a per-oracle input with three values.** AD-17 says a malformed judge response
   "is recorded as `judge-error`" (`ARCHITECTURE-SPINE.md:331`) and names no field, and `JudgeResult`
   (`sealed-run-record.ts:217-219`) is keyed by rubric criterion with no `oracleId`. Rather than mint
   a schema field, the input is `judgeConduct` with `absent`, `conforming`, and `malformed`, where
   `absent` means no judge result bears on this oracle. `sealed-run-record.ts:336` says a contract
   with no rubric produces no judge call, so `absent` is the ordinary value and the mapping stays
   total. A per-oracle `judge-error` is the mechanism by which AD-17's run-level invalidation happens.
9. **Polarity is read from `Oracle.polarity`, and the epic's "`expects-hold` as the default" is
   discharged semantically rather than by a schema default.** `oracle.ts:48-50` ships `polarity`
   required and explicitly refuses a Zod default, because "a Zod default diverges input and output
   mode and the explicit-null convention forbids implicit absence". The spine's own sentence explains
   what "default" means there: "`expects-hold` is the default and means the expression describes
   correct behaviour, so a false resolution is evidence of a defect" (`ARCHITECTURE-SPINE.md:469`).
   That is a statement about satisfaction, encoded in the satisfaction rule below. Adding
   `.default('expects-hold')` is forbidden. The field read is `Oracle.polarity`, never
   `Direction.polarity`, because `oracle.ts:22` keeps the two deliberately separate so
   `direction-check-misaligned` stays detectable.
10. **AD-3's prohibition and AD-4's placement of `abstained` never collided, and the ladder is
    ordered to honour both.** `ARCHITECTURE-SPINE.md:518` states the prohibition's scope: "the only
    remaining input is check resolution, which AD-3 forbids as the source of an outcome state" — that
    is, `true` and `false` may not decide caught-versus-missed. `insufficient-evidence` is not a
    verdict about the system; it is a statement that nothing was examined, and AD-4 and AD-6 both
    place it at `abstained` unconditionally. So the abstention rule sits above the `not-triggered`
    rule: an oracle whose check examined nothing never resolves `confirmed`, which
    `ARCHITECTURE-SPINE.md:259` names as the outcome AD-4's third value exists to prevent. It sits
    below every findings-sourced rule — the two witness rules and the mapped-citation rule — by the
    same criterion, since a detection is not weakened by a check that examined an empty collection.
    The root resolution still reaches the artifact through the caller's `Outcome.checkResolution` and
    decides the corroboration.
11. **For an oracle carrying no witness, only a `mapped` citation resolves `caught`, and every other
    tail case resolves `confirmed`.** AD-33's rule is that a state is "resolved from the ingested
    evaluator findings of AD-23, mapped to oracles by their required citations"
    (`ARCHITECTURE-SPINE.md:469`), and `Finding.oracleId` is that mapping.
    `ARCHITECTURE-SPINE.md:525` closes the other buckets: "a probe resolves `caught` only when a
    mapping identifies its seeded defect among the findings cited against it", and an unmapped
    finding is "an unexpected real defect … never counted as a catch". Splitting the remaining tail
    into `missed` and `confirmed` on the check resolution is what `ARCHITECTURE-SPINE.md:518` forbids:
    "A table obeying AD-3 must therefore give both rows the same answer: choose `confirmed` and every
    non-detection scores as success, choose `missed` and every correct confirmation scores as a
    behavioural failure." This story chooses `confirmed`, which is the answer that does not
    manufacture a FAIL from a check resolution. Three tuples pay for it, and all three are named
    rather than hidden. A witness-free oracle whose check failed with no finding filed scores as a
    success, with corroboration `disagrees`. A `null` check resolution with no finding scores as a
    success with corroboration `not-evaluable`, which is the honest reading of measuring nothing. And
    an `unmapped` or `signatureless` citation whose check agrees the behaviour is broken scores as a
    success, which is the worst of the three, so the corroboration table reads the bucket ahead of
    every check-derived rule and forces `disagrees` there — the evaluator and the oracle are pointing
    at different defects, and that is what `ARCHITECTURE-SPINE.md:471` says `disagrees` is for.
    `missed` therefore remains reachable only from `manifested-unclaimed`, which is precisely
    `ARCHITECTURE-SPINE.md:525`'s "a seeded signature that no finding maps to".
12. **Selector ambiguity arrives precomputed as a boolean.** `src/core/score/bindings.ts:158` already
    spells the predicate as `selection.result === 'several' && step.cardinality !== 'any'`,
    cardinality is per-step (`plan.ts:138`), and neither `Oracle` nor `Outcome` carries a `stepId`,
    so no declared path runs from an outcome to a cardinality. Taking `cardinality` as a free axis
    would duplicate a shipped decision and add four behaviourally identical cells per
    `(selection, cardinality)` pair. The input is `selectorAmbiguity: boolean`, true when any step the
    oracle's check reads returned `several` under a non-`any` cardinality, and it is an aggregate over
    the same step list `selections` holds, which is why the seventh structural constraint ties it to
    a `several` member.
13. **The finding citation is bucket-typed, the bucket describes the cited finding's own probe, and
    two rules read presence without it.** `witness.ts:366-378` assigns each bucket a distinct AD
    consequence and `witness.ts:412-420` keys it on `finding.probeId`, which is required on every
    finding (`sealed-run-record.ts:45`) and is unrelated to whatever probe this outcome row is about,
    since no schema relates an oracle to a probe. So `FINDING_BUCKETS` is `mapped`, `unmapped`,
    `dangling`, `signatureless`, and `CitedFinding` pairs a `findingId` with one of them, taken from
    the defect finding whose `oracleId` is this oracle. `dangling` fires its condition; `mapped` is
    the only bucket that may resolve `caught` on a **witness-free** oracle, since on an oracle
    carrying a witness the witness rules sit above the citation rule and the bucket does not enter;
    `unmapped` and `signatureless` are returned in `declinedFindingIds` and force `disagrees`. The
    clean control reads presence without the bucket because AD-9 fixes its legal behavioural outcomes
    at exactly two, so the bucket cannot change the answer. *(Amended during implementation: AD-9's
    "exactly two" is read as implementation decisions 12 and 24 record, so a clean control may also
    resolve `abstained`. The argument here is unaffected: the bucket still cannot change the answer.)* The canary reads presence because a canary
    carries no signature at all, so its detection claim is unverifiable by signature match by
    construction, and AD-9 puts that verification in qualification rather than in scoring — which is
    why AD-7 excludes canaries from the dominance vector and no rate moves either way.
14. **`unsupported-disposition` checks the citation rather than the prose, and excludes
    `not-attempted`.** The defect `ARCHITECTURE-SPINE.md:471` describes is a disposition that
    "narrates a rejection appearing in no observation", which is a containment question about the
    disposition's `note` (`sealed-run-record.ts:139`). Checking the citation is the narrowing, taken
    deliberately: quotation containment is Story 7.4's `auditQuotation` (`quotation.ts:126-128`),
    which already runs over every defect finding regardless of bucket, and pointing a second
    containment procedure at a free-prose `note` would grade prose. The cost is that a disposition
    citing observations that do not contain what its note narrates passes here. `not-attempted` is
    excluded because it makes no claim about the behaviour: `ARCHITECTURE-SPINE.md:382` treats it as
    one of three readings of silence, and an evaluator that never got there has nothing to support.
    A `not-attempted` that does cite observations is well-supported in exactly the sense
    `ARCHITECTURE-SPINE.md:471` asks for — those are the observations showing why it could not
    proceed — so it is not penalised. The real contradiction for `not-attempted` is a defect finding
    citing the same oracle: the evaluator says it never got there while filing a defect against it,
    and that is what the disposition corroboration rule catches.
15. **The census is pinned in two places for two different reasons, and the at-least-one floor is the
    gate that fails on a drop.** The generated document publishes the achieved counts and
    `check:ad33-table` compares it byte for byte, so a hand edit fails. That alone does not catch a
    coverage drop, because both pins derive from one source — the fixture set and the rule tables —
    so regenerating the document moves the published baseline with it. The gate that catches a
    genuine drop is the assertion that every state, every rule in each of the three rule tables, and
    every condition has a count of at least one, which no regeneration can satisfy once a case is
    gone. The exact literals sit beside it so a drop above zero is visible in a diff rather than
    silent, which is the reason `keyword-mutation.test.ts:114-119` gives for pinning exactly rather
    than by a floor: "a floor can't catch a narrowed walk".
16. **The table is four rule tables plus a census, never a cell per input tuple.**
    `ARCHITECTURE-SPINE.md:471` establishes that "over a thousand cells with a positive and negative
    fixture each is arithmetically out of reach" and asks for "a total *function* … whose enumerated
    output is published". The enumerated output is the condition list, the state ladder, the waiver
    rules, and the corroboration rules — each with its identifier, guard summary, and outcome — plus
    per-state, per-ladder-rule, per-waiver-rule, per-corroboration-rule, and per-condition counts
    over the fixture set, plus the
    named structural constraints and the infeasible pairs derived from them. This is a deliberate
    divergence from AD-31's table, which does emit a cell per input; the mechanism is identical and
    the shape is not.
17. **The input space is constrained by named implications, not by a filter that deletes cases the
    gate exists to name, and the infeasible pair set is derived from them.**
    `STRUCTURAL_CONSTRAINTS` holds seven, each with an identifier, each asserted unreachable by a
    test rather than merely unused:
    - `class-and-control-travel-together`: `expectedClean`, `probeSigned`, and `probeQualified` are
      non-`null` exactly where `probeClass` is, since with no probe there is no `QualificationResult`.
    - `clean-control-carries-no-signature`: `expectedClean === true` implies
      `probeSigned === false`, because `probe.ts:77-88` gives the clean-control branch no
      `defectSignature` key at all.
    - `witness-requires-a-signature`: a witness result exists only where
      `probeSigned === true && expectedClean === false`, which is `SignedProbe` (`witness.ts:86-88`)
      and which admits a signed canary, and always where that probe also qualified.
      *(Amended during implementation: shipped as an implication rather than the biconditional
      written here, twice over, in implementation decisions 13 and 22.)*
    - `signed-canary-cannot-qualify`: `probeSigned === true && probeClass === 'canary'` implies
      `probeQualified === false`, which is `signature-present-on-canary`.
    - `unsigned-non-canary-cannot-qualify`: `probeSigned === false && expectedClean === false &&
      probeClass !== 'canary'` implies `probeQualified === false`, which is `signature-absent`.
    - `illegal-control-pairing-cannot-qualify`: `expectedClean === true && probeClass !== 'zero-action'`
      implies `probeQualified === false`, because `admissibleRoutes` returns the empty list for those
      three pairings (`qualification.ts:152-155`).
    - `ambiguity-requires-several`: `selectorAmbiguity === true` implies some member of `selections`
      resolved `several`. *(Amended during implementation: this bullet said "`bindings.ts:158`'s own
      predicate read backwards", which it is not. That predicate reads one step reached from a
      captured pointer; this field aggregates the oracle's own declared steps, per Decision 12.)*
    Every one leaves the offending tuple representable. The four `cannot-qualify` constraints route
    theirs to the unqualified-probe rule, which is what `qualification.ts:143-151` and `probe.ts:109`
    both say the schema admits them for; the other three describe what the upstream records can
    carry, and a tuple violating one of those still resolves, which implementation decision 23
    depends on. *(Amended during implementation: the original sentence said all seven route to the
    unqualified-probe rule, which is false for those three.)*
    Several are three-way implications, which is why the collection is named constraints rather than
    pairs; the epic AC's enumerated infeasible pairs are computed from them by projecting every pair
    of domain values no satisfying tuple contains, published in the generated table, and asserted
    unreachable individually. `admissibleRoutes` is module-private, so the fixture generator states
    the three pairings and imports nothing.
18. **Owed item 2 does not fully close here, and the story says so.** Its four clauses are a recorded
    monotonic sequence (Story 7.2), declared selector cardinality (Story 7.2), the selected
    observation identifiers recorded on every outcome (this story), and "causal predecessors, where
    needed", which no story in epic 7 owns. That clause stays open; `7-2:159-164` records why a
    one-level temporal clause does not require them and what would reopen them, and nothing here
    changes that.
19. **`selectedObservationIds` is a deterministic concatenation of two named fields, not a global
    sequence order.** The two sources cover different observation subsets —
    `StepSelection.matchedObservationIds` selects on `step.operationId` (`selection.ts:69`) while the
    witness selects on the signature's home operation (`witness.ts:231-234`) — so neither contains
    the other and their sequences interleave. Merging them into one ascending-`sequence` order would
    need the observations or a sequence map among the inputs, which would put an unbounded array into
    an enumerable input space for no gain. The witness half is `ProbeWitnessMatch.observationIds`,
    "every candidate identifier the match read", rather than `witnessObservationIds`, because
    `evidence-artifact.ts:139-143` describes the destination as what the witness match "resolves
    against", which is the candidate set. Each source is already ascending under the same total
    comparator (`selection.ts:70-72`, `witness.ts:164-165`), so the field is each selection's
    `matchedObservationIds` in the array order of `selections` followed by the witness's
    `observationIds`, deduplicated, keeping first appearance. The array order of `selections` is the
    contract's declared step order and is the caller's to supply; nothing on `StepSelection` carries a
    step identifier. That is deterministic and stable under permutation of the observation array,
    which is what owed item 2 and NFR9 require, and the destination field imposes no ordering of its
    own.
20. **Five of `Outcome`'s nine fields are the caller's.** `oracleId` and `probeId` are the row's
    identity. `severity` (`evidence-artifact.ts:129`) is required with no default, and the procedure
    returns none because it has no principled source when `resolvedFrom` is `null`;
    `Finding.severity` (`sealed-run-record.ts:51`) supplies it where a finding resolved the state and
    `Behavior.severity` (`eval-contract.ts:52`) otherwise, since a behaviour is what an oracle
    discharges. `disposition` is carried through verbatim by its own describe. `checkResolution` is
    the whole recursive `CheckResolutionValue` tree while this procedure reads only its root value,
    so returning a tree it did not build would be a second copy to disagree with itself. The artifact
    assembly in epic 8 owns all five joins.
21. **A near-miss is a single-field mutation.** AD-30 requires a fixture per state "positive and
    negative" (`ARCHITECTURE-SPINE.md:445`) and the spine gives "negative" no definition for a state,
    where the natural reading of a negative fixture for `caught` — every input that is not `caught` —
    is vacuous. The reading taken is the seeded-defect idiom the repository already uses in its
    canary jobs: for each state, a case producing it and a second case differing in exactly one field
    that produces a different state. That makes the negative fixture a statement about which field
    carries the state, which is what a reader of the table needs.
22. **Four of the resolution's fields have no home on the shipped artifact, and the story says which
    rung two of them cost.** `OutcomeResolution` returns `rule`, `waiverRule`, `corroborationRule`,
    and `declinedFindingIds`; `Outcome` (`evidence-artifact.ts:123-147`) has a field for none of
    them, and this story adds no field. Two are diagnostic — `rule` and `corroborationRule` name
    which rule fired and carry no rung consequence — and a reader of the artifact must not conclude
    they are recoverable from it. Two matter more. `waiverRule` matters because `not-applicable` has
    two producers, the unexercised-probe rule, which `ARCHITECTURE-SPINE.md:259` says needs no waiver,
    and the waiver adjustment, while `ARCHITECTURE-SPINE.md:370`'s WAIVED rung needs `not-applicable`
    "against an unexpired waiver"; the procedure distinguishes them and the artifact does not, so the
    WAIVED rung is not derivable from the artifact alone until Story 7.7 lands the field on its own
    `schemaVersion` bump, which `epics.md:613` already assigns it, and AD-21 takes waiver state as a
    derivation input in the meantime so 7.7 can rejoin. `declinedFindingIds` matters because a
    declined finding is neither uncited — it names this oracle — nor Story 7.8's `UncitedFindingGap`,
    which `epics.md:625` scopes to a finding citing no oracle, so without a field it is the
    discarding `ARCHITECTURE-SPINE.md:471` says "would hide exactly the evaluator-chosen detection
    AD-23 exists to preserve". Both ride Story 7.7's bump.
23. **"An unexpired waiver satisfying AD-5" means one that compiled.** AD-6 qualifies
    `not-applicable` that way (`ARCHITECTURE-SPINE.md:259`) and AD-5's only waiver row is
    `waiver-incomplete` (`ARCHITECTURE-SPINE.md:242`), enforced at compile time by
    `checkWaiverCompleteness` (`compile/waivers.ts:8-16`) over the four required parts and called
    from `compile/compile.ts:109`. `core/score` never runs at compile time, so a waiver reaching this
    procedure has already satisfied AD-5 by construction, and unexpiry is the only live qualifier
    here. That is why the `waiver` input carries expiry and carries no completeness flag.
24. **On two cells the spine's invariant overrides the epic's acceptance criterion, and the spine
    wins.** `ARCHITECTURE-SPINE.md:471` says an unsupported disposition invalidates cross-artifact
    agreement "rather than being believed", and it also says a check resolving `insufficient-evidence`
    records "`disagrees` where the evaluator filed a finding and `agrees` where it did not". On one
    input both apply and they disagree: an unsupported disposition, a check that resolved
    `insufficient-evidence`, and no defect finding. Recording `agrees` there believes the disposition,
    which is the thing the first sentence forbids by name, so `disposition-unsupported` sits above
    `examined-nothing` and that cell records `disagrees`. A second cell diverges for the same reason
    and is named rather than left to be found: a `violated` disposition that cites observations, with
    no defect finding filed and a check that resolved `insufficient-evidence`, records `disagrees`
    from `disposition-contradicts-evidence` where the epic AC's `agrees` arm would apply. An
    evaluator stating a behaviour was violated while filing nothing is a declared-versus-observed
    disagreement under AD-32, and reporting agreement there would be the same believing.
    Those are the only two. Rule 2's other two arms and `citation-declined` each require a cited
    defect finding, so `examined-nothing` would have recorded `disagrees` on those inputs anyway, and
    `not-evaluable` is still never recorded for an `insufficient-evidence` input because
    `examined-nothing` stays above `never-ran`. The cost is two cells where this procedure diverges
    from the epic's own restatement of AD-33, recorded here so a later reader diffing the two finds
    the divergence explained rather than assumed.
25. **AD-9's "exactly" is read over behavioural outcomes.** AD-9 says a clean control's "legal states
    are exactly `passed-clean-control` and `false-positive`" (`ARCHITECTURE-SPINE.md:277`), and a
    clean control can nonetheless resolve `unreached` or one of the three invalidating states, since
    AD-6 says those three "are not behavioural results at all" and that `unreached` is neither
    (`ARCHITECTURE-SPINE.md:259`). So "exactly" constrains which behavioural verdict a clean control
    may carry, and the unreached rule needs no clean-control guard. Adding one would be worse than
    the ambiguity: an unreached clean control would fall to the clean-control pair and resolve
    `passed-clean-control`, a pass claimed for a behaviour nobody exercised.
    *(Amended during implementation: the shipped reachable set is larger than the states enumerated
    here, and implementation decision 24 states it in full. `abstained` joined it, which matters
    because AD-6 groups `abstained` with the behavioural failures; the architecture's own round-2
    review record proposed exactly that reading, restricting AD-9's two-state closure to reached
    behavioural outcomes and admitting clean-control abstention.)*

## Decisions taken during implementation

Each of these was a checkpoint the workflow would have asked about. Settled here and recorded, per
the epic preamble.

1. **The invalidating conditions are sorted lexicographically by identifier.** The spec says the list
   comes back "sorted" and names no order. Declaration order would make the sort a restatement of the
   table and would move every recorded list whenever a condition is inserted; lexicographic order is
   stable under a table edit, which is what a reader diffing two artifacts needs. `byIdentifier` in
   `outcome.ts` is the one comparator, shared with `uncitedFindingIds`.
2. **`resolvedFrom` and `declinedFindingIds` are driven by a declared `resolvesFromCitation` flag on
   each ladder row.** Four rows carry it: `finding-dangling-probe`, `clean-control-false-positive`,
   `canary-detected`, and `oracle-cited-defect`. The alternative was a second list of rule identifiers
   beside the table, which can disagree with the table it describes. As a flag, the property is
   emitted-table-adjacent data like the guard and the state, and `declinedFindingIds` becomes exactly
   "an `unmapped` or `signatureless` citation the state did not resolve from" with no rule names
   spelled twice.
3. **A dangling citation counts as resolving from the finding.** `finding-dangling-probe` reaches
   `infrastructure-error` *because of* that finding, so the outcome records which finding it was.
   The consequence is that a dangling citation never appears in `declinedFindingIds`, which is
   correct: the declined set is scoped to `unmapped` and `signatureless`, and a dangling citation
   already has a condition of its own.
4. **`OutcomeStateValue` and `CorroborationValue` are module-private aliases derived from the
   imported tuples.** The vocabularies are imported from `evidence-artifact.ts` and neither is
   redeclared; the aliases exist so `OutcomeResolution` can spell its two closed fields without
   repeating `(typeof OUTCOME_STATES)[number]` at nine sites. `tsc` emits both into the declaration
   file, so no exported type references a name a consumer cannot see.
5. **The infeasible pairs are derived by exhausting a seven-field constrained group.** The seven
   named constraints read only `probeClass`, `expectedClean`, `probeSigned`, `probeQualified`,
   `witness`, `selectorAmbiguity`, and `selections`; the other eight fields are free. Enumerating that
   group's 9,450 assignments and filtering by the constraints yields 342 feasible shapes, and a pair
   is infeasible exactly where no shape admits both of its pinned values. That is exact rather than
   sampled, and it avoids enumerating the 127,008,000-tuple cross product. 71 of the 1,496 pairs come
   back infeasible, and every one is asserted unreachable across the whole fixture set. Those figures
   are the shipped ones, after implementation decisions 13 and 22 moved the witness constraint
   twice; the constraint set admits 4,596,480 of the 127,008,000 tuples.
6. **The covering array is a deterministic greedy build with the constrained fields chosen as a
   block.** Assigning the seven coupled fields one at a time can paint into a corner no feasible shape
   completes, so each round picks a whole feasible shape first, then fills the free fields one at a
   time, taking the value that covers the most uncovered pairs and keeping the earlier candidate on a
   tie. 80 cases cover all 1,425 feasible pairs. No clock, no `Math.random`, no filesystem, and no
   iteration over an unordered collection, so the generated document is byte-stable.
7. **The fixture module exports more than the five names the Code Map planned.** `INPUT_DOMAINS`,
   `STRUCTURAL_CONSTRAINTS`, `infeasiblePairs`, `pairwiseCases`, and `RULE_WITNESS_CASES` are all
   there. Beside them: `fixtureCases` (the union the generator, the drift check, and the test all
   consume, so the three cannot disagree about what the fixture set is), `NEAR_MISS_PAIRS`,
   `INPUT_FIELDS`, `satisfiesConstraints`, `feasiblePairs`, `realizedPairKeys`, `pairKeyOf`, and the
   value constructors the targeted tests build one-off inputs from. Each exists because a test or a
   script needed it and duplicating it would have been the drift the byte-exact check exists to catch.
8. **The sole-assigner criterion is enforced as a source scan.** A test walks `src/` through
   `scripts/discover-source-files.ts`, the same walk `check:layers` uses, and asserts that for each of
   the twelve AD-6 states the files carrying that string literal are exactly
   `src/core/schemas/evidence-artifact.ts` and `src/core/score/outcome.ts`. That is checkable, fails
   on a second assigner appearing anywhere in the package, and needs no new gate script.
9. **`stage-table.ts` exports `STAGE_SIGNATURES`, so the assertion reads
   `STAGE_SIGNATURES.score.module`.** The Code Map cited the line rather than the symbol.
10. **The renamed-rule canary seds the `outcome-clear` identifier.** `id: 'outcome-clear'` occurs
    exactly once in `src/core/score/outcome.ts`, and renaming it moves the emitted ladder table's
    twentieth row. Verified locally: the drift check reports
    `drift at byte offset 3770`, naming the changed row on both sides.
11. **The generated document publishes prose guards, so every emitted string was written against the
    package-boundary scanner.** The four rule tables carry a `guard` string each and the constraint
    list carries an `implication` string each; those strings reach `docs/` through the builder and
    `check:boundary` scans the builder's source. All of them cite AD numbers and shipped identifiers
    only.

12. **A clean control whose check examined nothing records `abstained`, and row 12 carries the
    conjunct that sends it there.** The approved ladder put row 12's bare `expectedClean` guard above
    the abstention row, which made `abstained` unreachable for a clean control and published
    `passed-clean-control` on an oracle that examined an empty collection. That is the outcome AD-4's
    three-valued resolution exists to prevent, named in AD-6's own sentence about `--strict` and a
    green build, and Decision 10 above already reads AD-4 and AD-6 as placing `insufficient-evidence`
    at `abstained` unconditionally. AD-9's "exactly two legal states" and AD-4's placement collide
    here, and AD-4 wins: admitting `abstained` still keeps a clean control off `caught` and `missed`,
    which is what AD-9's clause is for, while excluding it reinstates the failure AD-4 names. Row 11
    stays above, because Decision 10's own criterion protects a findings-sourced row and a filed
    false positive is one. A `null` root resolution keeps the pass with a corroboration of
    `not-evaluable`, which is Decision 11's recorded reading of measuring nothing. The Design Notes
    table, the ladder totality paragraph, and acceptance criteria 5 and 9 are re-synced to the
    shipped rows.
13. **`witness-requires-a-signature` is a forward implication, not a biconditional.** The reverse
    half excluded a tuple shipped components can produce: a signed seeding probe whose qualification
    failed reaches a scorer that performed no match, so `probeSigned: true, expectedClean: false,
    witness: null` is representable. Decision 17's own criterion is that the constraint set admits no
    tuple shipped code cannot produce and excludes none it can, so the constraint now reads "a
    witness exists only on a signed seeding probe" and the pair `witness=null & probeSigned=true`
    leaves the published infeasible list. The covering array shrinks from 82 cases to 80 and the
    infeasible list from 72 pairs to 71.
14. **The published guard prose is pinned by a test, and a fourth canary step proves the census moves
    with the guards.** Nothing ties a `guard` string to the predicate beside it, so a guard could
    publish the opposite of its rule under a byte-exact gate. All forty guard strings across the four
    tables are now pinned as literals in `outcome.test.ts`, the ladder table publishes
    `resolvesFromCitation` as its own column so that field is under the drift check too, and
    `canary-ad33-table` gains a step that mutates a ladder guard and asserts the check fails. That
    step fails through the at-least-one census floor rather than through a byte comparison, so its
    grep admits `drift at byte offset|the builder failed`.
15. **The emitted census assertions are hand-counted over synthetic resolutions.** The census pins in
    `outcome.test.ts` recompute the counts from the same fixture set the builder reads, so neither
    caught an off-by-one inside the builder's own arithmetic or a pair of swapped census sections.
    `outcome-table.test.ts` now drives the builder with twenty-two hand-built `OutcomeResolution`
    values whose multiplicities are written out as literals, parses the rendered document, and
    compares the parsed numbers and key sets against those literals. The five at-least-one diagnoses
    are each asserted by omitting one key of one kind.
16. **`witnessOf` returns a match the shipped `matchProbeWitness` could have returned.** The fixture
    gave every witness value the same two candidate identifiers against an empty partition, which
    made the `unexercised` value a shape production cannot reach and let an unexercised witness
    contribute observation identifiers. It now returns no candidate for `unexercised` and partitions
    its two candidates by result for the other five.
17. **`probeSigned` stays in `OutcomeInputs` although no rule reads it.** It is the one field of the
    fifteen the procedure never consults. It is kept because the relation AD-40 fixes between a
    signature and a witness is a fact about this input space that the published constraint and
    infeasible-pair tables state, and a caller assembling a row from a probe already holds it. The
    claim is enforced rather than asserted: a test varies `probeSigned` across all three values over
    every fixture case and requires the resolution to be unchanged.
18. **Three ladder conjuncts are unreachable from the fixture set by construction, and are tested
    directly.** `probe-unqualified`'s `probeClass !== null`, `zero-action-detected`'s
    `expectedClean === false`, and `oracle-cited-defect`'s `witness === null` each discriminate a
    tuple a structural constraint or a row above them excludes. They are the defensive halves that
    fire on a shape the schemas admit and the qualification gate rejects, so each has its own test
    outside the covering array.
19. **An `unreached` state can record `agrees`, and that is accepted rather than carved out.** With
    `examined-nothing` above `never-ran`, an oracle whose declared steps produced nothing and whose
    check resolved `insufficient-evidence` with no finding filed records `agrees`. Narrowing rule 4
    on the state would add a third divergence from the arm Decision 24 confirmed at two across two
    review rounds. The corroboration is diagnostic and moves nothing on its own, and `unreached`
    already marks the strength vector non-comparable under AD-21, so the cell is recorded here and
    left alone.
20. **The final ladder row's negation is enforced, not documented.** Widening row 20's guard changes
    no output under first match, so no ordinary test can catch a guard that drifts from the negation
    it claims to be. The 378,000-tuple sweep now additionally asserts that row 20's guard agrees with
    the derived negation of every row above it on every tuple.
21. **Row 4 keeps `resolvesFromCitation: true`.** The reviewer argued that a dangling citation is not
    a detection and that the sibling `probe-unqualified` row carries `false`. The field it fills is
    described as "the finding this outcome resolved from, or `null` where no finding was cited", and
    a dangling citation is a finding that was cited, so `null` there would state something false
    about the artifact. The row's identifier and its condition already say the citation is dangling.
    A test pins the value either way.

22. **The witness constraint narrowed again: a witness always exists on a qualified signed seeding
    probe.** Decision 13 relaxed the biconditional to a forward implication, and it over-shot the one
    shape it argued for. The shape that justifies the relaxation is an *unqualified* signed probe,
    whose match a scorer may skip; the relaxed predicate also admitted the qualified case, which
    nothing produces, and that region let a signed qualified probe record `caught` from a `mapped`
    citation with AD-40's signature match bypassed and no condition fired. AD-33 names that failure
    by name: without the witness match, `missed` is unreachable and the catch rate is 1.00 by
    construction. The constraint now reads "a witness exists only on a signed seeding probe, and
    always on a qualified one", which keeps every tuple decision 13 argues for and excludes 241,920
    the shipped components cannot produce. The fixture set carried two cases in the excluded region
    and now carries none.
23. **Rows 15 and 16 carry the clean-control guard row 12 used to supply by being total.** Once row
    12 gained its abstention conjunct it stopped covering every `expectedClean: true` input, so on a
    tuple that violates the witness constraint a clean control could reach `caught`, `missed`, and
    through the waiver `bypassed` and `not-applicable`. Those are outside the constraint set, and the
    constraints are a model of the input space and not a filter over it: acceptance criterion 1
    quantifies over any value of `OutcomeInputs`, and criterion 7 says no `expectedClean: true` input
    reaches Stage C at all. Both are now true over the whole input type, because the two
    detection-bearing witness rows carry `expectedClean` themselves. The negation on the final row
    moved with them, since it calls the same two named predicates.
24. **A clean control's reachable states are eight over the input type and seven under the
    constraints.** Over the whole type: `passed-clean-control`, `false-positive`, `abstained`,
    `unreached`, `not-applicable`, `oracle-error`, `judge-error`, `infrastructure-error`. Under the
    constraints a clean control carries no witness, so the unexercised row is out of reach and
    `not-applicable` leaves the set. `caught`, `missed`, `bypassed`, and `confirmed` are unreachable
    either way. A 504,000-tuple sweep asserts the two sets and that no waiver rule fires. This
    supersedes Decision 25's enumeration, which listed `unreached` and the three invalidating states
    and was written before `abstained` joined them.
25. **The guard prose is checked against the predicate source, not only pinned.** A pin catches a
    guard edited alone and passes when the guard and its pin are edited together, which is the
    natural response to a red pin. A second test reads each predicate's source, expands it through
    the module-level helpers it names, and requires that every backticked token in the guard appears
    in that source and every string literal the predicate compares against is named in the guard.
    Five rows are listed as exempt with a reason each: the final ladder row, whose guard is a
    negation; the disposition-contradicts rule, whose prose enumerates arms the predicate reaches by
    negation; and the three check-derived corroboration rules, which delegate to the satisfaction
    predicate. The check fires on a guard that states the opposite of its rule whether or not the pin
    was edited alongside.
26. **Every emitted projection is now asserted against what it projects.** The ladder's citation
    column, the corroboration table's ordinal and value column, and the waiver table's effect cell
    each had no assertion, so each could publish something the code contradicts under a byte-exact
    gate. Seven of the eight corroboration values are checked mechanically against what the rule's
    own function returns; the eighth is conditional, so its string is pinned and both arms are
    asserted reachable. The seven structural-constraint implications are pinned beside their
    predicates.
27. **`resolvesFromCitation` is true exactly for the rows whose guard requires a citation to be
    present**, which is `finding-dangling-probe`, `clean-control-false-positive`, `canary-detected`,
    and `oracle-cited-defect`; the list is pinned, and each of the four is asserted to fail on a
    `null` citation. `canary-undetected` reads the citation and resolves from its absence, so it
    carries `false`. That rule is what settles the reviewer's second objection to row 4, raised in
    both rounds: `Outcome.resolvedFrom` names the finding the row that fired resolved from, its
    `null` arm covers both "no finding was cited" and "the row that fired resolved from none", and
    `declinedFindingIds` covers the two buckets a state refused to resolve from. Under that reading
    the four buckets are consistent -- `unmapped` and `signatureless` record `null` because the final
    row resolves from no citation, and `dangling` records its finding because its own row does. The
    reviewer withdrew the objection on round 3, having checked mechanically that no row outside the
    four requires a citation, and corrected one word of the gloss: the final row does *read* the
    citation, through the negations its guard carries, and finds it is not one it resolves from. The reviewer
    prefers `false` on row 4 on the ground that a finding naming a probe that does not exist resolved
    nothing; the counter is that the row exists to say that finding is why the outcome is an
    infrastructure error, and no other field would carry the identifier.

28. **The ladder's totality argument is restated for the `expectedClean` branch.** With the three
    witness rows above the clean-control pair each carrying `expectedClean`, the original argument
    that six rows consume all six witness results no longer holds inside that branch. The conclusion
    survives by a second route: inside it, rows 11, 12, and 18 are jointly total, so a witness never
    reaches the final row from there either. A 378,000-tuple sweep asserts no tuple is unmatched, and
    the final row's negation calls the same named predicates the rows use, so the two cannot drift.

## Design Notes

**Stage A — the conditions.** Ten independent predicates, each with an identifier the emitted
document prints. All that hold are returned, sorted.

| Condition | Holds when |
| --- | --- |
| `evaluation-fault` | `evaluationFault` |
| `judge-malformed` | `judgeConduct === 'malformed'` |
| `unqualified-probe-in-sealed-set` | `probeClass !== null && probeQualified === false` |
| `dangling-probe-citation` | the cited finding's bucket is `dangling` |
| `unwitnessed-detection-claim` | the witness result is `unwitnessed-claim` |
| `vacuous-signature` | the witness result is `vacuous` |
| `selector-ambiguity` | `selectorAmbiguity` |
| `canary-non-detection` | `probeClass === 'canary'`, some selection resolved other than `none`, and no defect finding cites the oracle |
| `unsupported-disposition` | the disposition is `held` or `violated` with empty `observationIds` |
| `disposition-missing` | `required` and the disposition is `null` |

Nine of the ten reach AD-21's Invalid rung through "any AD-6 invalidating state", or by name for
`disposition-missing` (`ARCHITECTURE-SPINE.md:370`). `unsupported-disposition` produces no state and
is not in that enumeration, so Story 7.7 must add it as a third condition; this story enforces the
half it can, which is the corroboration.

**Stage B — the state ladder, in order.** First match wins; each row's identifier is printed. Rows 10
and 15 deliberately overlap on a `zero-action` probe with `expectedClean: false` and witness
`matched`; row 10 is kept so AD-33's first fixed cell has its own line in the emitted table. Story
7.4 set the precedent for a deliberately overlapping ordered table (`7-4:591-599`).

| # | Rule | Guard | State |
| --- | --- | --- | --- |
| 1 | `evaluation-fault` | `evaluationFault` | `oracle-error` |
| 2 | `judge-malformed` | judge conduct `malformed` | `judge-error` |
| 3 | `probe-unqualified` | a probe is present and its qualification failed | `infrastructure-error` |
| 4 | `finding-dangling-probe` | cited finding's bucket is `dangling` | `infrastructure-error` |
| 5 | `witness-unwitnessed-claim` | witness result `unwitnessed-claim` | `infrastructure-error` |
| 6 | `witness-vacuous` | witness result `vacuous` | `infrastructure-error` |
| 7 | `selector-ambiguous` | `selectorAmbiguity` | `infrastructure-error` |
| 8 | `witness-unexercised` | witness result `unexercised` | `not-applicable` |
| 9 | `steps-unreached` | no witness or witness result `not-triggered`; `selections` non-empty; every member resolved `none` | `unreached` |
| 10 | `zero-action-detected` | class `zero-action`, `expectedClean: false`, witness `matched` | `caught` |
| 11 | `clean-control-false-positive` | `expectedClean: true`, a defect finding cites the oracle | `false-positive` |
| 12 | `clean-control-passed` | `expectedClean: true`, and the check root did not resolve `insufficient-evidence` | `passed-clean-control` |
| 13 | `canary-detected` | class `canary`, a defect finding cites the oracle | `caught` |
| 14 | `canary-undetected` | class `canary`, some selection resolved other than `none`, no defect finding | `infrastructure-error` |
| 15 | `witness-matched` | witness result `matched`, on a probe outside the `expectedClean` branch | `caught` |
| 16 | `witness-manifested-unclaimed` | witness result `manifested-unclaimed`, on a probe outside the `expectedClean` branch | `missed` |
| 17 | `oracle-cited-defect` | no witness, cited finding's bucket is `mapped` | `caught` |
| 18 | `check-insufficient-evidence` | check root resolves `insufficient-evidence` | `abstained` |
| 19 | `witness-not-triggered` | witness result `not-triggered` | `confirmed` |
| 20 | `outcome-clear` | the stated negation of every guard above | `confirmed` |

Totality. Rows 5, 6, 8, 15, 16, and 19 consume all six `PROBE_WITNESS_RESULTS` outside the
`expectedClean` branch, so anything reaching row 20 from there has a `null` witness; inside that
branch rows 11, 12, and 18 are jointly total, so a witness never reaches row 20 either way
(implementation decisions 23 and 28); row 9 takes a subset of the `null` and `not-triggered` cases without
widening either, and row 18 takes a subset of row 19's domain the same way, which is why rows 15 to
19 are not contiguous in the witness argument. Rows 11 and 12 are total over `expectedClean: true`
except where the check resolved `insufficient-evidence` and no finding was cited, which row 12's
second conjunct hands to row 18 (implementation decision 12).
Rows 13 and 14 are **not** total over `canary`: an undetected canary that matched no selection falls
past both, and with no signature it carries no witness, so it lands on row 18 or row 20 unless row 9
took it first. Row 17 takes the `mapped` bucket on a witness-free input and row 20 takes what is
left, which is a citation that is absent, `unmapped`, or `signatureless`, with a root resolution of
`true`, `false`, or `null` since `insufficient-evidence` left at row 18. Row 20's guard is written in
the source as that negation rather than as an `otherwise`, and a test asserts no input reaching it
satisfies any earlier guard.

Row 9's three conjuncts each answer a different defect. The witness conjunct keeps an unmatched
selection from deleting a detection: nothing ties `selections` to the witness, since the two select
on different operations, so an oracle whose own check steps went unmatched could otherwise turn a
`matched` into `unreached`. It admits `not-triggered` because that is the one witness value carrying
no detection to protect, and suppressing it would lose a legitimate `unreached` on exactly the input
AD-6 defines the state for. `ARCHITECTURE-SPINE.md:471` orders reachability before the *disposition*,
and `:469` lists the signature match and step reachability as peer inputs, while `:265` defines a
separate probe-side reachability that row 8 already consumes; row 9 is about the oracle's declared
check steps and row 8 is about the probe's home operation. `selections.length > 0` keeps an oracle
that declared no interaction step from resolving `unreached`, since AD-6 scopes the state to an
oracle's *declared* steps (`ARCHITECTURE-SPINE.md:259`) and an empty array satisfies `every`
vacuously; such an oracle falls through the ladder and lands on row 20 unless something else fires.
Both matter because an `unreached` oracle marks the strength vector non-comparable
(`ARCHITECTURE-SPINE.md:370`).

**Stage C — the waiver adjustment.** `WAIVABLE_FAILURES` is `missed` alone, for the reasons in
Decision 3. No clean-control conjunct is needed here, because row 16 carries one: `missed` comes only
from that row, and its `expectedClean` guard closes Stage C for a clean control over the whole input
type rather than only over the tuples the constraints admit (implementation decision 23).

| Rule | Holds when | Effect |
| --- | --- | --- |
| `waiver-honoured` | waiver `applied-condition-met`, provisional state `missed` | state becomes `not-applicable` |
| `waiver-bypassed` | waiver `applied-condition-unmet`, provisional state `missed` | state becomes `bypassed` |

Neither fires on `none` or `expired`, which is AD-21's "an expired waiver reinstates its gap".
`bypassed` is reachable through exactly one conjunction of six input values, which is why
`RULE_WITNESS_CASES` carries it explicitly rather than leaving it to the covering array.

**Satisfaction under polarity.** A check satisfies when its root resolution is `true` under
`expects-hold`, or `false` under `expects-violation`. `insufficient-evidence` satisfies under neither,
which is AD-4's "the value is terminal and never satisfies" (`ARCHITECTURE-SPINE.md:207`). A `null`
resolution never ran and is treated as satisfying nothing and failing nothing; it reaches the
corroboration table as `not-evaluable` and never decides a state.

**"Satisfied" in AD-33's first fixed cell means the witness matched.**
`ARCHITECTURE-SPINE.md:471` reads "a satisfied `zero-action` probe resolves `caught`, never
`passed-clean-control`, which belongs to a known-clean control". A `zero-action` probe with
`expectedClean: false` seeds a defect whose correct behaviour is refusal, so the probe is satisfied
when its signature manifested and a finding witnessed it, which is `matched`. Reading "satisfied" as
"its check satisfied" would put the rule in the check tail, where `passed-clean-control` is not
reachable at all and the fixed cell would say nothing. The never-half is guarded structurally too:
`passed-clean-control` requires `expectedClean: true`, which `witness-requires-a-signature` makes
disjoint from any witness result.

**Corroboration, decided after the final state.** Eight rules, first match, each with an identifier
the emitted document prints and none an `otherwise`:

| # | Rule | Holds when | Value |
| --- | --- | --- | --- |
| 1 | `disposition-unsupported` | the disposition is `held` or `violated` with empty `observationIds` | `disagrees` |
| 2 | `disposition-contradicts-evidence` | `violated` with no defect finding, `held` with one, or `not-attempted` with one | `disagrees` |
| 3 | `citation-declined` | the cited finding's bucket is `unmapped` or `signatureless` | `disagrees` |
| 4 | `examined-nothing` | root resolution `insufficient-evidence` | `disagrees` where a defect finding cited the oracle, `agrees` where none did |
| 5 | `never-ran` | the final state is `unreached`, or the root resolution is `null` | `not-evaluable` |
| 6 | `check-confirms-silence` | the check satisfies and no defect finding cited the oracle | `agrees` |
| 7 | `check-confirms-finding` | the check does not satisfy and a defect finding cited the oracle | `agrees` |
| 8 | `check-and-findings-diverge` | the check satisfies with a finding cited, or does not satisfy with none | `disagrees` |

The order carries three obligations at once. Rules 1 to 3 sit above both check-derived rules so a
disposition and a declined citation are never believed, which is AD-33's own word; rule 4 sits above
rule 5 so an `insufficient-evidence` input never records `not-evaluable`, which AD-33 forbids
outright and which is reachable because row 9 can resolve `unreached` on such an input; and rules 6,
7, and 8 partition the remainder on satisfaction and citation, so the list is total with no
`otherwise`. Rules 1 and 2 are how `ARCHITECTURE-SPINE.md:469`'s first named mapping input reaches
the outcome without deciding a state, which `:518` forbids. The two cells where rules 1 and 2
override rule 4's `agrees` arm are Decision 24. A `disagrees` is diagnostic and moves nothing on its own, per
`:471`; Story 7.7 decides whether any rung reads it, and it carries the whole cost of Decision 11's
collapsed tail. The spine scopes `not-evaluable` to an oracle whose check "could not be evaluated on
this run because its steps were unreached"; rule 5 widens it to any root resolution of `null`, which
is the same condition — the expression never ran — reached by a second route, an oracle whose `check`
is `null` (`oracle.ts:45-47`, half of what `oracle-missing-channel` fires on).

**The input type.** Fifteen fields:

```ts
export type OutcomeInputs = {
	readonly required: boolean
	readonly disposition: OracleDisposition | null
	readonly citedFinding: CitedFinding | null
	readonly witness: ProbeWitnessMatch | null
	readonly selections: readonly StepSelection[]
	readonly selectorAmbiguity: boolean
	readonly checkResolution: CheckResolutionValue['resolution'] | null
	readonly polarity: Polarity
	readonly probeClass: Probe['probeClass'] | null
	readonly expectedClean: boolean | null
	readonly probeSigned: boolean | null
	readonly probeQualified: boolean | null
	readonly waiver: WaiverStateValue
	readonly judgeConduct: JudgeConductValue
	readonly evaluationFault: boolean
}
```

`OracleDisposition` is the `z.infer` type this story adds beside the existing const, and is the
record rather than `OracleDispositionValue`, because Stage A and the corroboration rules read its
`observationIds`. `CitedFinding` is
`{ readonly findingId: string; readonly bucket: FindingBucketValue }`, taken from the defect finding
whose `oracleId` is this oracle. `OutcomeResolution` returns
`{ rule, waiverRule, corroborationRule, state, corroboration, resolvedFrom, selectedObservationIds,
declinedFindingIds, invalidatingConditions }`, where `resolvedFrom` is the cited finding's identifier
where the state resolved from it and `null` otherwise, `declinedFindingIds` holds an `unmapped` or
`signatureless` citation the state did not resolve from, `selectedObservationIds` follows Decision
19, and `invalidatingConditions` is sorted.

**Enumerable domains for the fixture generator.** `required` 2; `disposition` 7, being the three
`ORACLE_DISPOSITIONS` values each with an empty and a non-empty `observationIds`, plus `null`;
`citedFinding` 5, being `null` plus one per `FINDING_BUCKETS` member; `selections` 5, being an empty
array, one `none`, one `one`, a `none`-and-`one` pair, and one `several` carrying two identifiers;
`selectorAmbiguity` 2; `checkResolution` 4; `polarity` 2; `probeClass` 5; `expectedClean` 3;
`probeSigned` 3; `probeQualified` 3; `waiver` 4; `judgeConduct` 3; `evaluationFault` 2; `witness` 7,
one per `PROBE_WITNESS_RESULTS` member plus `null`. That is 57 domain values across fifteen fields, a
cross product of 127,008,000 and a pairwise space of 1,496 pairs, which a covering array reaches in
tens of rows. `STRUCTURAL_CONSTRAINTS` holds the seven named implications of Decision 17, and
`infeasiblePairs` is derived from them rather than hand-listed.

## Verification

**Commands:**

- `npm run generate:ad33-table` -- expected: writes `docs/ad33-outcome-decision.generated.md` and
  prints its byte count
- `npm run check:ad33-table` -- expected: exits 0 naming the rule, condition, and case counts
- `npm run test -- tests/score` -- expected: green, every rule and condition reached
- `npm run test:coverage` -- expected: `src/core/**` at or above 90% statements and branches
- `npm run check:boundary` -- expected: green, with no source comment or emitted string carrying one
  of the five hazard patterns
- `npm run validate` -- expected: green end to end, with `check:ad33-table` in its spliced position.
  `validate` begins with `npm run build`, so a separate build run is not needed to prove compilation.

## Suggested Review Order

1. `src/core/score/outcome.ts` -- read the four tables top to bottom. Stage A's independence is what
   makes the condition list complete. In Stage B, five positions carry the weight: the mapped-citation
   rule above the abstention rule, the abstention rule above the `not-triggered` rule, the two
   detection-bearing witness rules above the unreached rule, the unreached rule's three conjuncts,
   and the canary rule's exercise guard. In Stage C, the waivable group is one state. In the
   corroboration table, rules 1 to 3 above rules 4 and 5 are what keep a disposition and a declined
   citation from being believed, and rule 4 above rule 5 is what keeps `insufficient-evidence` from
   recording `not-evaluable`.
2. `tests/score/fixtures/outcome-inputs.ts` -- check the domains match the input type field for
   field, that each of the seven structural constraints leaves its tuple representable rather than
   deleting it, and that `RULE_WITNESS_CASES` covers both the qualified `zero-action` clean control
   and the `bypassed` tuple.
3. `src/core/score/outcome-table.ts` and `docs/ad33-outcome-decision.generated.md` -- confirm the
   document is emitted from the rule tables rather than restating them, and that no emitted string
   trips `check:boundary`.
4. `tests/score/outcome.test.ts` -- the twelve states positive and negative, the
   six-simultaneous-conditions fixture, the at-least-one floor across all three rule tables, and the
   worked-chain regression case.
5. `.github/workflows/pr-checks.yml` -- the canary's four assertion steps, especially the
   renamed-rule step and the guard-mutation step, which are what prove the table is emitted by the
   procedure rather than kept beside it.

## Story Review Record

**Round 1 — sibling Claude Code session `epic7-story5-story-review`, adversarial pre-implementation
review of draft 0 with a fleet of five parallel subagents; alongside it an in-process subagent
checking draft 0 clause by clause against the epic AC at `epics.md:579-590`.** Peer: 10 HIGH, 14
MEDIUM, 12 LOW. Subagent: 2 HIGH, 4 MEDIUM, 4 LOW, two overlapping. **Verdict: not ready.**

**Round 2 — the same peer re-verifying draft 1 with three parallel subagents, including a compilation
check and an execution check of Node type stripping over the whole transitive import graph.** 26 of
37 closed; 6 HIGH, 13 MEDIUM, 3 LOW. **Verdict: not ready.** The peer corrected one of its own
round-1 findings, having verified that `ARCHITECTURE-SPINE.md:404` does put `oracle-error` at
runtime.

**Round 3 — the same peer re-verifying draft 2.** 14 of 21 closed; 10 HIGH, 11 MEDIUM, 12 LOW.
**Verdict: not ready**, with the three-stage split endorsed and the structural constraints then
drafted verified individually true against shipped code.

**Round 4 — the same peer re-verifying draft 3 with two parallel subagents.** 24 of 35 closed; 5
HIGH, 9 MEDIUM, 6 LOW. **Verdict: not ready, one editing pass away**, with the reviewer stating
plainly that the remaining findings were the acceptance criteria and the prose failing to keep up
with ladder edits those same criteria had demanded, rather than design defects. The reviewer also
noted that a reorder made in round 3 had fixed a defect neither side had named: on an `unreached`
state with an `insufficient-evidence` root resolution, the earlier order recorded `not-evaluable`,
which `epics.md:589` forbids outright.

**Round 5 — the same peer confirming draft 4.** Every round-4 finding closed except one census
spelling; two prose defects found and fixed in the same pass. The peer re-verified all twenty-one
corrected citations as exact, confirmed the corroboration table total and `not-evaluable` still
reachable, re-walked all six witness values against the reordered ladder and the new canary guard to
confirm Stage B totality and all twelve states reachable, and confirmed `npx tsc --noEmit` clean.
**Verdict: ready for development.**

All findings from all five rounds are addressed in the Spec Change Log above and in Decisions 3, 4,
5, 10, 11, 13, 14, 15, 17, 19, 20, 22, 23, 24, and 25; none was deferred to a later story or to
`deferred-work.md`.

## Implementation Review Record

**Round 1** -- an independent peer Claude Code session (`epic7-story5-bmad-code-review`) against the
finished working tree, briefed adversarially, given the spec, the spine and the preceding story, and
told to verify against shipped source rather than against this file's prose. It reported in two
parts: a spec-conformance, fixture, CI and boundary sweep run with a four-subagent fleet plus its own
exhaustive walk of the then-feasible tuple space through `resolveOutcome`, and a test-and-coverage pass
driving a 45-mutant harness against scratch copies of the repository. 26 findings: 4 HIGH, 11 MEDIUM,
11 LOW, each with a reproduction. All 26 addressed in the same pass, nothing deferred to a later
story and nothing written to `deferred-work.md`. `npm run validate` green before and after (3200
tests before, 3219 after).

1. **HIGH -- a clean control whose check examined nothing published a pass.** Row 12's bare
   `expectedClean` guard sat above the abstention row, so `abstained` was unreachable for a clean
   control and 896 feasible tuples recorded `passed-clean-control` on an oracle that examined an
   empty collection. That is the outcome AD-4's three-valued resolution exists to prevent, named in
   AD-6's own sentence about `--strict` and a green build, and Decision 10 already read AD-4 and AD-6
   as placing `insufficient-evidence` at `abstained` unconditionally. The reviewer also found the
   asymmetry with Decision 25, which had ruled the other way on the neighbouring `unreached` input
   and recorded the reason. Fixed by giving row 12 a second conjunct; the AD-9-versus-AD-4 collision
   is settled for AD-4 and argued in implementation decision 12, with the Design Notes table, the
   ladder totality paragraph, and acceptance criteria 5 and 9 re-synced.
2. **HIGH -- the published guard prose was unverified and the canary's own claim about it was
   false.** The reviewer changed row 12's guard string to the opposite of its predicate, regenerated,
   and got a green `check:ad33-table`, 210 green tests and three green canary steps, with the false
   row published under a byte-exact gate. It also showed `resolvesFromCitation` never reached the
   document at all. Fixed three ways: the ladder table gains a `Resolves from the citation` column,
   all forty guard strings across the four tables are pinned as literals in `outcome.test.ts`, and
   `canary-ad33-table` gains a fourth step that mutates a ladder guard, with its grep widened to
   `drift at byte offset|the builder failed` because that mutation fails through the census floor.
3. **HIGH -- nothing verified the builder's own arithmetic.** Mutating the builder to publish every
   count plus one passed the whole suite; only `check:ad33-table` caught it, and the table's own test
   file contributed nothing.
4. **HIGH -- `outcome-table.test.ts` was a self-derived snapshot.** Every expectation was rebuilt
   from the same tables the builder reads, so the document published the ladder census under the
   state heading and the state census under the ladder heading with every test green. Findings 2, 3
   and 4 share one fix: the table test now drives the builder with twenty-two hand-built
   `OutcomeResolution` values whose multiplicities are hand-counted literals, renders, parses the
   document back with a regex, and compares parsed numbers and key sets against those literals. The
   five at-least-one diagnoses are each asserted by omitting one key of one kind.
5. **MEDIUM -- an undetected canary that declared no interaction step recorded `confirmed` with
   `agrees` and no condition,** in 432 feasible tuples, and no decision argued that landing against
   AD-9. The landing is right and is now argued: AD-7 keeps canaries out of the dominance vector by
   class so no rate moves, and AD-6 scopes `unreached` to declared steps. The test that pinned it
   covered two dissimilar cases under one title and is split in two.
6. **MEDIUM -- the published constraints blurb was false for three of the seven constraints.** Only
   the four `cannot-qualify` constraints route their offending tuple to the unqualified-probe rule;
   the other three describe what the upstream records carry, and two of their violating tuples land
   on success states. The emitted sentence and the fixture header now say so.
7. **MEDIUM -- `witnessOf` built a match no shipped code can return.** Every witness value carried
   two observation identifiers against an empty partition, so the `unexercised` value contradicted
   `matchProbeWitness`, which returns none, and an unexercised witness contributed identifiers to
   `selectedObservationIds` in 12 of the cases then in the set. The factory now returns no candidate for
   `unexercised` and partitions its two candidates by result for the other five.
8. **MEDIUM -- `probeSigned` is read by no rule.** Kept, with the reason in the `OutcomeInputs` JSDoc
   and in implementation decision 17, and enforced by a test that varies it across all three values
   over every fixture case and requires the resolution unchanged.
9. **MEDIUM -- `unreached` records something other than `not-evaluable` in 18,048 feasible tuples,
   768 of them `agrees`.** Recorded rather than changed, in implementation decision 19: narrowing
   rule 4 on the state would be a third divergence from an arm Decision 24 confirmed at two across
   two review rounds, the corroboration is diagnostic, and `unreached` already marks the vector
   non-comparable.
10. **MEDIUM -- `witness-requires-a-signature` was a biconditional whose reverse half excluded a
    tuple shipped components can produce**: a signed seeding probe whose qualification failed reaches
    a scorer that performed no match. Relaxed to the forward implication, which is Decision 17's own
    criterion. The covering array went from 82 cases to 80 and the infeasible list from 72 pairs to
    71. In the same finding, `ambiguity-requires-several` was described as the shipped ambiguity
    predicate read backwards, which it is not: the shipped predicate reads one step reached from a
    captured pointer, while this field aggregates the oracle's own declared steps per Decision 12.
    The implication is reworded.
11. **MEDIUM -- `TEST-PLAN-NEXT-STEPS.md:55` enumerates the `validate` chain by name** and had not
    been updated. It now names `check:ad33-table`.
12. **MEDIUM -- the story's own bookkeeping was unfilled** while the code was complete and green.
    Filled here.
13. **MEDIUM -- three guard conjuncts survived deletion**: `probe-unqualified`'s
    `probeClass !== null`, `zero-action-detected`'s `expectedClean === false`, and
    `oracle-cited-defect`'s `witness === null`. Each is excluded from the covering array by a
    structural constraint or by a row above it, and each is the defensive half that fires on a shape
    the schemas admit and the gate rejects. Three named tests now exercise them directly.
14. **MEDIUM -- two totality tests asserted the implementation against itself,** recomputing `find`
    over the same array with the same predicates. Replaced by one test that looks the fired row up by
    its identifier and asserts no row above it holds.
15. **LOW -- a dangling citation masks `canary-non-detection`.** Correct as it stands, and now
    pinned with the reasoning: the evaluator did file against this oracle, so `citesDefect` holding
    is right; it is the probe the finding names that the sealed set does not declare, which has its
    own condition and reaches the same rung.
16. **LOW -- row 4's `resolvesFromCitation: true` was untested, and the reviewer argued it is
    wrong.** Kept, and pinned. `Outcome.resolvedFrom` is described as `null` where no finding was
    cited, and a dangling citation is a finding that was cited, so `null` there would state something
    false about the artifact. Recorded as implementation decision 21 with the reviewer's counter.
17. **LOW -- row 10 is subsumed by row 15 in the feasible space,** which the Design Notes record as
    deliberate. A test now asserts the subsumption holds with the same state and the same citation
    flag, so the informational note is enforced.
18. **LOW -- four `X rather than Y` shapes, two of them in published prose.** All four rewritten; the
    generated document is now clean of `rather than`, `instead of`, `not only`, and `no longer`.
19. **LOW -- eight comments in `outcome.ts` ran longer than what they document.** Seven trimmed; the
    table-level blocks were already shorter than their tables.
20. **LOW -- `realizedPairKeys` returns `null` on a lookup miss, and the test read that as
    "nothing to check".** The test now asserts non-null for every case.
21. **LOW -- nothing checked that `CONSTRAINED_FIELDS` is a superset of the fields the constraints
    read,** so a constraint over a free field would be ignored by both the feasibility derivation and
    the greedy fill. A test now varies every free field over its whole domain across all 115 cases
    and requires `satisfiesConstraints` unchanged.
22. **LOW -- `check-ad33-table.ts` dropped the orphan-check rationale its AD-31 twin carries.**
    Restored, with the two-generated-tables case stated.
23. **LOW -- neither generated table is reachable from the documentation sidebar,** since the
    Starlight sidebar autogenerates from four groups and both files sit at the `docs/` root.
    Consistent with the AD-31 precedent and outside this story; recorded rather than changed.
24. **LOW -- a comment claimed the identifier comparator "has to be total on the tie",** which the
    reviewer disproved by mutating it and passing. The claim is removed; the assertion that both
    entries come back stays.
25. **LOW -- the at-least-one floor's diagnosis text was asserted for one census only.** All five are
    now asserted, each by omitting one key of one kind.
26. **The final row's negation was documentation, unenforceable by any ordinary test,** because
    widening it changes no output under first match. The 378,000-tuple sweep now additionally asserts
    that row 20's guard agrees with the derived negation of every row above it on every tuple.

The reviewer also verified fourteen claims correct and reproduced them: ladder and corroboration
totality conjunct by conjunct, Decision 24's two divergences and no third, `insufficient-evidence`
recording `not-evaluable` zero times across the whole feasible tuple space, the six-condition fixture
returning exactly six, row 9's three conjuncts deleting no detection, the census pins being
regeneration-proof, Decision 19's concatenation and its shared comparator, the covering array's
determinism across five processes including a foreign locale and timezone, the constraint set's probe
projection against `admissibleRoutes`, `check:boundary` re-implemented from scratch over both join
rules, the CI wiring including the floor-job requirement, the generate-then-check fixed point, the
whole must-not list, and row-by-row spec conformance across all forty rows.

**Round 2 -- the same peer re-verifying the fixed tree, briefed narrowly per finding.** 21 of 26
closed outright, 3 partly closed, 2 recorded-not-changed as intended. 17 new findings: 3 HIGH, 7
MEDIUM, 7 LOW, all of them consequences of round 1's own fixes. All 17 addressed in the same pass.
`npm run validate` green before and after (3219 tests before, 3225 after).

The peer verified the H1 behaviour change the way the brief asked, by reverting only
`cleanControlPassed` in an isolated copy and sweeping every constraint-satisfying tuple through both
versions: **exactly 896 tuples differ, and only in `state` and `rule`.** Every other returned field
is byte-identical on every tuple, and the predicate
`differs === (expectedClean && insufficient-evidence && oldRule === 'clean-control-passed')` gives
zero mismatches, so the diff is exactly the intended set. Row 11 fires the same 48 times before and
after, no `zero-action` seeding probe moved, and the unreached clean control still resolves
`unreached` under both root resolutions. It also retracted its round-1 "documentation, unenforceable"
verdict on the final ladder row after confirming the new 378,000-tuple biconditional enforces it.

1. **HIGH -- the round-1 relaxation of `witness-requires-a-signature` over-shot its own
   justification.** The shape it argued for is an *unqualified* signed probe, whose match a scorer
   may skip; the relaxed predicate also admitted the qualified case, and in that region a signed
   qualified probe recorded `caught` from a `mapped` citation with AD-40's signature match bypassed
   and no condition fired, which is the failure AD-33 names by name. The fixture set had two cases in
   the region. Narrowed to "a witness exists only on a signed seeding probe, and always on a
   qualified one", which excludes 241,920 tuples and keeps every tuple the round-1 fix argues for;
   the fixture set now carries none.
2. **HIGH -- the corroboration `value` column had no assertion at all,** the same defect class as
   round 1's guard finding, one table over. Seven of the eight are now checked against what the
   rule's own function returns; the conditional eighth is pinned with both arms asserted reachable.
3. **HIGH -- the waiver `Effect` column was unverified projection.** Replacing the template with a
   constant published `waiver-honoured` as setting `bypassed` with every test green. The rendered
   cell is now asserted equal to the state the rule sets.
4. **MEDIUM -- the round-1 guard pin was prose against prose,** and passed when the guard and its pin
   were edited together. A second test now reads each predicate's source, expands it through the
   module-level helpers it names, and requires the two to agree on the vocabulary in both directions,
   with the reviewer's own five exempt rows listed with a reason each. Verified to kill the round-1
   mutant whether or not the pin moves with it.
5. **MEDIUM -- the H1 fix opened the clean control to `caught`, `missed`, `bypassed` and a waiver
   `not-applicable`** on tuples outside the constraint set, which is the exact set implementation
   decision 12 claims it keeps out, and which acceptance criteria 1 and 7 quantify over the whole
   input type. Rows 15 and 16 now carry `expectedClean` themselves, as named predicates the final
   row's negation calls.
6. **MEDIUM -- the AD-9 test had gone vacuous,** contributing two assertions both already made
   above it, which is why finding 5 got through. Replaced by a 504,000-tuple sweep asserting the
   reachable state set over the input type and under the constraints, and that no waiver rule fires.
7. **MEDIUM -- Decision 25 was not re-synced and contradicted the shipped ladder.** Implementation
   decision 24 states the eight-state and seven-state sets in full and supersedes it, and Decision 25
   carries an amendment note. The architecture's own round-2 review record had already proposed this
   reading.
8. **MEDIUM -- 12 of 20 rows' `resolvesFromCitation` was behaviour-unprotected,** and flipping it on
   `evaluation-fault` moved `resolvedFrom` on 11 fixture cases with the suite green. The four flagged
   rows are pinned as a list and each is asserted to fail on a `null` citation.
9. **MEDIUM -- the corroboration ordinal was unpinned.** The row is now asserted with its number.
10. **MEDIUM -- neither sed canary step guarded against a no-op seed,** so a future rename would have
    blamed the check. Both now fail with "the sed target has moved".
11. **LOW -- two feasibility figures were stale by a round** (318 shapes, 4,268,160 tuples). The
    shipped numbers are 342 shapes and 4,596,480 tuples.
12. **LOW -- Decision 17 still carried the sentence round 1 retracted.** Amended.
13. **LOW -- acceptance criterion 9's second clause and the totality paragraph were unquantified.**
    Both scoped, with the criterion pointing at the eight-state enumeration.
14. **LOW -- census key order was unchecked for two of the five.** Asserted for all five.
15. **LOW -- `expect()` ran at module load in the table test.** `at()` throws and the census
    document builds lazily.
16. **LOW -- the fourth canary step's grep omitted the filename prefix.** Restored on both arms.
17. **LOW -- two `X and not Y` shapes remained in non-published comments.** Rewritten.

The reviewer's second objection to row 4's `resolvesFromCitation` came back sharper, pointing out
that `unmapped` and `signatureless` already record `null` while a finding was cited, so the field's
description was being read two ways. That inconsistency is the finding, and it is settled by a rule
rather than a preference in implementation decision 27: the flag is true exactly for the rows whose
guard requires a citation to be present, `resolvedFrom` names the finding the row that fired read,
and under that rule all four buckets are consistent. The reviewer still prefers `false` on row 4 and
its argument is recorded there.

**Round 3 -- the same peer re-verifying the round-2 fixes.** Verdict: ship it. No finding changes
behaviour or a published byte. Every round-2 mutant is dead on a purpose-built assertion, including
all twelve previously-surviving `resolvesFromCitation` flips, and the reviewer's own feasible-shape
count reconciled with this story's at 342 shapes and 4,596,480 tuples once computed against the
shipped constraint rather than the round-1 one.

Both behavioural changes were verified confined. The narrowed witness constraint leaves zero tuples
in the excluded region and zero fixture cases in it, keeps the signed canary's witness on both forms,
and makes nothing unreachable: every state, rule, waiver rule, corroboration rule and condition still
has a non-zero count over the feasible space. The row-15 and row-16 guards are provably a no-op on
the feasible space, because none of the 403,200 feasible tuples with `expectedClean: true` carries a
witness at all, and outside it they close Stage C for a clean control over the whole input type. The
504,000-tuple sweep runs in 217ms and the 378,000-tuple sweep in 48ms, so neither costs anything
noticeable.

Nine items were raised and all nine are addressed here.

1. **The token check is a vocabulary check, not a semantics check,** and the reviewer got eight
   wrong guards past it by editing the guard and its pin together, one of them into the published
   document with the whole gate green. Its three structural reasons are an empty signature on six
   rows, a raw substring test for the guard's own tokens, and an exemption asserted as an equality,
   which turned tightening an exempt guard into a red build. Two are fixed: the token test now
   matches a whole token or a quoted literal, and the exemption is a subset rather than an equality.
   The remaining limit is stated in implementation decision 25 in the reviewer's own words: it
   catches renames, not lies.
2. **Row 8 now carries the same `expectedClean` guard as rows 15 and 16.** `not-applicable` on a
   clean control was spine-unlicensed: AD-6 legalises it for a probe AD-40 records as unexercised,
   and a clean control carries no signature for AD-40 to record anything about. The clean-control
   state set is now seven both over the input type and under the constraints, and implementation
   decision 24 is rewritten to say so; the earlier draft's claim that AD-6 licenses the eighth is
   corrected rather than left standing.
3. **Acceptance criteria 4 and 5 were falsified over the input type by the row-15 and row-16
   guards,** which is the mirror image of the defect those guards fixed. Both are quantified to the
   branch a witness exists on.
4. **The ladder totality paragraph's stated reason no longer held inside the `expectedClean`
   branch.** Restated as implementation decision 28.
5. **Decision 17's two bullets still carried the biconditional and the retracted "read backwards"
   phrase.** Both amended.
6. **Three further sites still leaned on AD-9's two-state reading or on a constraint as a
   guarantee:** Decision 13, Decision 3, and acceptance criterion 9's own justification. All three
   carry amendment notes.
7. **Two canary byte offsets in the Dev Agent Record were arithmetically impossible** after the
   citation column widened every ladder row. Re-measured: 13,267 for the appended byte and 4,109 for
   the rename.
8. **The `git diff --quiet` seed guard compares against the index rather than HEAD,** so an
   unrelated unstaged edit would mask a sed target that had moved. Both guards use
   `git status --porcelain`, the idiom the fixed-point step in the same job already uses.
9. **Record consistency:** the job counter, the KEEP block's constraint claim, the constraint count
   in the round-3 story-review entry, the assertion-step count in the review order, and a case count
   that predated the fixture change. The two I/O matrix rows the reviewer flagged sit inside the
   frozen block and are left as they are, noted here.

The reviewer withdrew its L2 objection on this round after checking mechanically that no row outside
the four requires a citation, and corrected one word of the gloss, which is carried in implementation
decision 27.

## Peer Review Record

Three post-implementation rounds against the finished working tree, all with one sibling Claude Code
session (`epic7-story5-bmad-code-review`, spawned into its own workspace for this story and kept
alive across the rounds so each carried the previous one's context). No Codex. Its own subagent
fleets ran inside each round: four in round 1 alongside a 45-mutant harness against scratch copies,
and exhaustive sweeps of the constraint-satisfying tuple space in every round.

| Round | Brief | Result |
| --- | --- | --- |
| 1 | Full adversarial review against the diff, the spec and the spine, with ten named dig targets | 4 HIGH, 11 MEDIUM, 11 LOW, and 14 claims verified correct |
| 2 | Narrowed re-verify, fix by fix, then hunt what the fixes broke | 21 of 26 closed, 3 partly, 2 recorded; 17 new, all from round 1's own fixes |
| 3 | Narrowed re-verify of the round-2 fixes, with the two behavioural changes named as the first targets | Ship it; nine record and coverage items, none changing behaviour or a published byte |

Every finding was addressed in the pass it was raised. Nothing went to a later story, and nothing went
to `deferred-work.md`. Two items are recorded rather than fixed, both with the reasoning in place:
the `unreached | agrees` corroboration cell, which would need a third divergence from an arm two spec
rounds confirmed at two, and the token check's limit, which the reviewer explicitly declined to ask
for a semantics checker over.

What the rounds were worth beyond the count. Round 2 existed to catch regressions from round 1's
fixes and caught seventeen, three of them HIGH and two of those introduced by the fixes themselves --
a constraint relaxation that over-shot its own justification into a region where a signed qualified
probe scores a catch with AD-40's match bypassed, and a guard change that removed coverage a
neighbouring row had been supplying by accident. Round 3 then found that the second of those fixes
had falsified two acceptance criteria in the mirror image of the defect it closed. That is three
levels of the same defect class, which is the pattern the five pre-implementation spec rounds had
already shown twice on this story.

## Dev Agent Record

`npm run validate` green end to end, exit 0: build, typecheck, lint, check:docs,
check:doc-invocations, check:shareable, lint:spine, check:vectors, check:schemas, check:ad5-registry,
check:ad28-registry, check:ad31-table, check:ad33-table, check:layers, check:lineage, check:boundary,
check:corpus, check:website-deps, test:coverage. 94 test files, 3225 tests, 0 failures. Coverage 96.89
percent statements, 92.33 percent branches, against the ninety-percent `core/` floor; `outcome.ts`
and `outcome-table.ts` are each 100 percent on statements, branches, functions and lines (98 of 98
and 10 of 10 branches). Those are the post-review numbers; the pre-review run was 3200 tests at 96.89
/ 92.26, and the twenty-five tests added since are the three code-review rounds', listed in the
Implementation Review Record. `npm run generate:ad33-table` writes 13,267 bytes and `check:ad33-table` reports the
committed file matches byte for byte at 30 rules, 10 conditions, 115 cases; `git status --porcelain
-- docs/` is empty after a regeneration, so generate-then-check is a fixed point. No
`generate:schemas` run was needed and none was made: the one schema-file edit is a `z.infer` type
export, and `check:schemas` confirms all twelve committed JSON Schema documents still match the
source byte for byte.

Both canary mutations were reproduced locally before the workflow was written. A single appended byte
gives `docs/ad33-outcome-decision.generated.md: drift at byte offset 13267`; renaming the
`outcome-clear` rule identifier gives `drift at byte offset 4109` with the changed row quoted on both
sides; and mutating the `zero-action` guard gives
`the builder failed: outcomeDecisionTable: no case reaches the ladder rule zero-action-detected`,
which is why that step's grep admits both messages.

### Moved counters, before -> after

Ten sites moved. Three the Code Map or the review named were checked and did not move, recorded here
so a later reader does not go looking for a change that never happened.

| Site | Before | After |
| --- | --- | --- |
| `tests/score/` test files | 5 | 7 |
| `tests/score/` tests | 154 | 232 |
| Suite test files | 92 | 94 |
| Suite tests | 3147 | 3225 |
| Coverage, statements | 96.74 percent | 96.89 percent |
| Coverage, branches | 92.05 percent | 92.33 percent |
| `validate` chain length | 18 checks | 19 |
| `pr-checks.yml` jobs | 14 | 15 |
| Generated tables under `docs/` | 1 | 2 |
| Published JSON Schema documents | 12 | 12, unmoved |
| `stage-table.ts:129` `score` row | `module: null` | unmoved, asserted by a test |
| `schemaVersion` on every schema | unchanged | unmoved, no bump |

The counters the Code Map predicted would move are the `tests/score/` counts and the global
branch-coverage number, and all three did. The baseline figures for the two coverage rows are story
7.4's recorded numbers, since no coverage artifact is committed. The baseline suite total is measured
rather than quoted: the tree at the baseline commit runs 3147 tests, one more than the 3146 story
7.4's file records, and the two new test files account for all 78 of the tests added here.

### File List

Source:

- `src/core/score/outcome.ts` -- NEW: `FINDING_BUCKETS`, `FindingBucketValue`, `WAIVER_STATES`,
  `WaiverStateValue`, `JUDGE_CONDUCT_STATES`, `JudgeConductValue`, `CitedFinding`, `OutcomeInputs`,
  `OutcomeResolution`, `INVALIDATING_CONDITIONS`, `InvalidatingCondition`, `OUTCOME_RULES`,
  `OutcomeRuleId`, `WAIVABLE_FAILURES`, `WAIVER_RULES`, `WaiverRuleId`, `CORROBORATION_RULES`,
  `CorroborationRuleId`, `resolveOutcome`, `uncitedFindingIds`
- `src/core/score/outcome-table.ts` -- NEW: `StructuralConstraint`, `InfeasiblePair`,
  `OutcomeTableConstraints`, `outcomeDecisionTable`
- `src/core/schemas/sealed-run-record.ts` -- `export type OracleDisposition` beside the existing
  const, which changes no exported byte

Generated, never hand-edited:

- `docs/ad33-outcome-decision.generated.md`
- `_bmad-output/shareable/eval-quality-readme.html`

Scripts and prose:

- `scripts/ad33-table-target.ts` -- NEW: `AD33_TABLE_NAME`, `AD33_TABLE_DIRECTORY`,
  `AD33_TABLE_TARGET`, `AD33_TABLE_PATH`, `AD33_TABLE_FRONTMATTER`
- `scripts/generate-ad33-table.ts` -- NEW: the writer
- `scripts/check-ad33-table.ts` -- NEW: the byte-exact drift check
- `package.json` -- `generate:ad33-table` and `check:ad33-table`, and the `validate` splice directly
  after `check:ad31-table`
- `.github/workflows/pr-checks.yml` -- a named step in `validate-and-build`, one in `floor`, the
  `Validate` step name, and the eight-step `canary-ad33-table` job, whose two `sed` steps guard
  against a seed that changed nothing
- `README.md` -- the validate summary line, the two command lines in the fenced block, and the
  paragraph
- `TEST-PLAN-NEXT-STEPS.md` -- the `validate` chain line

Tests and fixtures:

- `tests/score/fixtures/outcome-inputs.ts` -- NEW: `INPUT_DOMAINS`, `INPUT_FIELDS`,
  `CONSTRAINED_FIELDS`, `STRUCTURAL_CONSTRAINTS`, `satisfiesConstraints`, `infeasiblePairs`,
  `feasiblePairs`, `pairKeyOf`, `realizedPairKeys`, `pairwiseCases`, `RULE_WITNESS_CASES`,
  `NEAR_MISS_PAIRS`, `fixtureCases`, and the value constructors the targeted tests build from
- `tests/score/outcome.test.ts` -- NEW
- `tests/score/outcome-table.test.ts` -- NEW
