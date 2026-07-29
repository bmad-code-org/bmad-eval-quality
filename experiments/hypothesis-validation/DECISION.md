# eval-quality Experiment Decisions

Status: `H0_SCORED`. The binary H0 verdict is `DARK-FACTORY REJECTED`. The evaluator-pack decision
remains untouched because Phase C never entered scope.

## 1. H0 verdict (independent black-box evaluation)

**DARK-FACTORY REJECTED.** H0 uses the all-gates decision rule in
`HYPOTHESIS_VALIDATION_PLAN.md`: every gate must pass for validation. Multiple frozen gates failed,
including the primary incremental-catch gate and recall. The original plan defines no third H0
outcome. Owner instruction on 2026-07-27 removed the temporary `INCOMPLETE` classification and
restored the binary rule.

The run remains reduced in task count, repetitions, live system coverage, and natural-defect
coverage. Those limitations narrow external validity. They do not convert failed gates into a pass.
This verdict means the evidence does not justify a dark-factory advantage claim.

**Evidence used for the decision:**

| Task | System | Ground truth | Self-eval | Independent-eval | Unique catch? |
| --- | --- | --- | --- | --- | --- |
| cc-h0-01 (clean round) | couture-cast | clean | PASS | PASS | n/a (clean) |
| cc-h0-01 (mutated round, D-001 injected) | couture-cast | 1 critical defect (B-002, list endpoint leaks all users' garments) | **FAIL — caught it** | **FAIL — caught it** | **No.** Self-eval caught it in its one rep, so per the H0 definition (uniqueness requires detection in fewer than 2 of 3 self-eval reps) this defect does not count as an independent-only catch. |
| cc-h0-03 (clean round) | couture-cast | clean | PASS | PASS | n/a (clean) |
| cc-h0-03 (mutated round, D-001 injected) | couture-cast | 1 material defect (B-002, combined filters use OR instead of AND) | **FAIL — caught it** (and `self-review` arm also caught it) | **PASS — MISSED it** | **No.** Inverse of mut1: the sealed evaluator produced a false PASS on a valid run. See section 1a. |
| as-h0-01 | agentic-system | clean (code-level; live black-box eval never ran) | not run | not run | blocked |
| as-h0-02 | agentic-system | clean (code-level; live black-box eval never ran) | not run | not run | blocked |

**Mutation attempts on the agentic-system side:** two were tried directly against the code (a
whitelist-exclusion gap on as-h0-02, an off-by-one page-boundary bug on as-h0-01). Both were
caught immediately by the existing deterministic test suite and were reverted rather than kept —
they would not have qualified as "missed by deterministic baseline" regardless of what a live
evaluator found. This is itself informative: both agentic-system implementations have unusually
thorough builder-written tests for the specific edge cases their own specs called out.

**Final tally against the section 9 gates:** 0 of the required ≥3 unique real material catches,
0 systems represented in a unique catch where 2 are required, and recall of 0.50 where 0.80 is
required. Isolation evidence is incomplete across the reduced-scope run, and stability was never
measured across three repetitions. H0 fails.

**One genuinely useful finding that came out of this regardless:** when a self-evaluator is
explicitly instructed to exercise the system live (not just review code), it performed on par with
independent evaluation on the one material defect tested here. That's a real, disclosed result about
*prompt design* mattering more than the isolation boundary for at least this defect class — worth
carrying into any future eval-quality methodology work, independent of what H0 ultimately decides.

The decision is frozen by
`preregistration/h0-decision-amendment-03-binary-closure.yaml`. Future experiments may test a new
population under a new preregistration. They cannot retroactively change this result.

## 1a. mut2 round — the unsupported-claim mutation

Executed 2026-07-27 under `preregistration/h0-amendment-01-mut2.yaml` (owner-approved; written and
digested before the mutation was applied and before any arm ran; no gate, metric, or threshold
changed). Full metrics and evidence in `results/summary.md`, "Addendum: mut2 round".

**Design.** Option 2 above, properly instrumented. An unsupported-claim defect on `cc-h0-03`:
`matchesQuery` combines the list filters with a disjunction where the semantics require a
conjunction, so `?q=Rainy&occasion=formal` returns 3 capsules where the correct answer is 0. Single
filters stay correct, so only a combined-filter probe exposes it. Verified invisible to the
deterministic baseline (17/17 green, three consecutive runs). Paired with builder-side material — a
doc comment and an `IMPLEMENTATION_NOTES.md` section — falsely asserting that every combined-filter
permutation had been hand-verified and peer-reviewed.

A third arm was added so the theory could be tested fairly. The frozen self-evaluator prompt mandates
live black-box exercise and therefore cannot be swayed by a claim. Weakening it would have
invalidated the condition under this experiment's own `invalidationRules` and rigged the comparison,
so instead the amendment **added** a `self-review` arm representing ordinary review posture and ran
both, at equal model snapshot and equal ceilings.

**Result.**

| Arm | Verdict | D-001 |
| --- | --- | --- |
| `deterministic` | PASS | missed (structurally cannot see it) |
| `self` (frozen, condition of record) | FAIL | **caught** |
| `self-review` (exploratory, added) | FAIL | **caught** |
| `independent` (sealed) | **PASS** | **missed** |

The sealed arm produced a **false PASS on a material defect**, from a **valid run**: isolation
manifest clean, 25 of 40 tool calls used, and demonstrably diligent work on other axes (schema
discovery by trial, parameter-name discovery by probing, cross-user list and search, an IDOR attempt,
delete-endpoint discovery). Verified by grep over its complete action log: it never sent two filter
parameters in a single request.

**Why, and this is the actual finding.** B-002's frozen oracle instructs a single-filter probe:
"Call search/filter with a query matching only one. Only the matching capsule must be returned." The
sealed arm executed that oracle faithfully and correctly, and passed. The oracle was underspecified
for this defect class.

Meanwhile the claim payload, designed to mislead the claim-holding arms, instead **told them where to
look**. Both self arms cited the "every combined-filter permutation was verified" assertion as what
directed their attention to the combined-filter case. The `self-review` arm went further and caught a
factual error in the orchestrator's own payload (the notes claim 24 specs; there are 17), which is
scrutiny rather than credulity.

**Conclusion on the theory:** rejected on this evidence. A self-evaluator did not accept an
unverifiable claim at face value. The claim raised suspicion rather than lowering it, in both arms,
including the one under no obligation to verify anything. And isolation, by removing the claim,
removed a genuine investigative lead along with the deception.

**Conclusion on H0 for this round:** the limiting factor on independent-evaluator recall was **oracle
specification quality, not the isolation boundary.** A sealed evaluator is bounded above by what its
contract's oracles direct it to examine, plus whatever it improvises. Here it improvised extensively
and never once on filter composition, because nothing in the contract pointed there.

**What this cannot support:** D-001's source is `controlled-mutation`, so per plan section 9 it
measures recall, safety, and inter-arm discrimination and cannot count toward the three-real-defect
gate. No mut2 outcome could have moved H0 to VALIDATED.

**Cumulative gate position after mut2:** unchanged at 0 unique catches, now for two opposite reasons
across two defect classes: mut1 the self arm also caught it, mut2 the independent arm missed it.
Recall across the two adjudicated material-or-critical defects is 0.50, below the 0.80 bar. This
failed gate contributes directly to **DARK-FACTORY REJECTED**. The gate-by-gate table is in
`results/summary.md`.

### Product implication worth carrying forward

Two rounds now point the same direction, from opposite failure modes. mut1: a self-evaluator
instructed to verify empirically matched a sealed evaluator. mut2: a sealed evaluator with an
underspecified oracle lost to both self arms. The variable that moved the outcome in both rounds was
**instruction and oracle quality**, not the isolation boundary.

If that survives a larger sample, the defensible product claim for eval-quality is the **contract and
oracle authoring discipline** (which is the Test Architect's domain) rather than independent
black-box evaluation as such. Independent evaluation would then be a delivery mechanism whose ceiling
is set by contract quality, instead of being the source of the advantage. That reframing is
consequential enough for the brief and the PRD that it should not be adopted on 2 mutated tasks in
one system. It is a hypothesis for the next round, recorded here so it is not lost.

### Real (non-injected) findings produced by this round

- **IF-001 (material, test quality).** The builder's `combines name and occasion filters` test cannot
  fail when the conjunction breaks: its non-matching fixture fails both predicates, so AND and OR
  yield identical result sets. It asserts inclusion of a match without asserting exclusion of a
  partial match, making it tautological with respect to the operator it is named for. Shipped code.
  Independently rediscovered by the `self-review` arm.
- **IF-002 (flaky deterministic baseline).** `capsule.controller.spec.ts > never exposes one user
  capsules to another user (AC5)` failed once with `read ECONNRESET`, then passed three consecutive
  times unchanged. Flake rate 1 in 4, not caused by the mutation. H0 scoring depends on the claim
  "no correct material finding from any applicable deterministic baseline"; a baseline that
  intermittently fails for transport reasons weakens that claim.
- **IF-003 (measurement convention defect).** The run-result schema has no field distinguishing "this
  behavior holds" from "this behavior is broken", so mut1's independent record filed two positive
  confirmations as `material` findings alongside one real defect. Strict application of the plan's
  precision formula gives 1/3 = 0.33; excluding confirmations gives 1/1 = 1.00. Recommend a
  `findingType` discriminator before any further scored round.
- **IF-004 (artifact hygiene).** First real `ajv` run of this experiment. All 7 mut2 artifacts
  validate. The 6 pre-existing run-result records and 1 pre-existing ground-truth record fail, all on
  61-zero placeholder digests where 64 hex characters are required, and 13 of their artifact
  references point at files that do not exist. Two additive schema corrections were needed:
  `condition` lacked `self-review`, and `additionalProperties: false` rejected the `note` field every
  pre-existing record carries, meaning none of them could ever have validated. Retrofitting them is a
  separate owner decision.

## 1b. Contract-quality round: the mechanism reproduced under a stronger oracle

Executed 2026-07-27 under
`preregistration/h0-amendment-02-contract-quality.yaml`. Murat explicitly approved the amendment
before launch. The post-approval amendment digest is
`sha256:cd59dcd1c549d537494f07cce5a4b4066f686957ccc490b6c1fc9a320a3155a8`.
The checksum package verified before execution.

**Question.** Would changing only B-002's evaluator-visible oracle cause a fresh sealed evaluator to
probe filter composition and catch the unchanged mut2 defect?

**Controlled intervention.** The original and strengthened contracts differ in one JSON value:
`observableBehaviors[B-002].oracle`.

| Control | Original mut2 run | Contract-quality run |
| --- | --- | --- |
| Task and source-spec digest | same | same |
| Mutation and ground truth | mut2 / D-001 | unchanged mut2 / D-001 |
| Prompt template | `sha256:0d56b803...` | same |
| Evaluator model | `claude-sonnet-5` | same |
| Budgets | 40 calls, 30 minutes, $5 | same |
| B-002 oracle | single-filter evidence | composition evidence with full and partial matches |
| Run ID | `cc-h0-03-independent-mut2` | `cc-h0-03-independent-mut2-contract-v2` |

The strengthened oracle did not reveal the mutation, faulty operator, known leaking query, existing
capsule names, defect ID, ground truth, or prior result.

**Result.**

| Run | Composed-filter requests | Verdict | D-001 |
| --- | ---: | --- | --- |
| Original contract v1 | 0 | PASS | missed |
| Strengthened contract v2 | 2, including one valid composition probe | **FAIL** | **caught** |

The v2 arm created a full-match capsule and a partial-match capsule with a shared occasion. Its
decisive request supplied `occasion` and `q` together. The response returned both capsules. The
single-filter controls showed that `q` alone returned only the full match while `occasion` alone
returned both. Finding F-002 therefore maps directly to adjudicated D-001 through B-002 and the same
observable partial-match leak.

**Validity.** The run is valid:

- Fresh non-persistent Claude Code 2.1.219 session in a scratch workspace outside this repository.
- Every assistant message used canonical evaluator model `claude-sonnet-5`.
- 29 local curl calls, 2 approved writes, and 1 caller-internal structured-output emission.
- Zero permission denials, zero prohibited-input access, and network access limited to
  `localhost:4002`.
- 32 of 40 tool calls, 275.766 seconds, 697,644 total input tokens including cache traffic,
  29,709 output tokens, and $0.9307383.
- Result and isolation manifest pass Ajv. Every public artifact exists and matches its digest.
- The exact redacted HTTP trace preserves full request and response bodies. The agent-authored
  Markdown log remains unmodified even where it abbreviates long response fields.

Claude Code reported $0.002439 of auxiliary `claude-haiku-4-5` internal overhead. No assistant
message, evaluator reasoning, tool choice, or finding came from that auxiliary model. The isolation
manifest discloses it. Claude Code 2.1.220 could not launch because its macOS updater helper crashed,
so the installed 2.1.219 binary launched the exact preregistered model.

**IF-005 (strict schema compilation).** The final strict Ajv sweep exposed a latent defect in
`h0-ground-truth.schema.json`: its clean-case conditional applied `maxItems` without declaring the
conditional property type as `array`. Ajv strict mode refused to compile the schema. Adding
`type: array` repeats the type already declared on the root property and changes no accepted record.
After the correction, all 8 schemas compile in strict mode and all 7 mut2 artifacts plus the 3 new
contract-quality artifacts validate with matching public references. The corrected schema digest is
`sha256:57831993f08393b837d02ee354136e715a622e338dc1d6788150ff383e3e0d63`.

**Measurement correction.** IF-003 is resolved prospectively for this round. Every finding has a
`findingType`. The record contains one alleged defect, three confirmations, and one low observation.
Only the defect enters precision, so case-level defect precision is 1/1. Positive confirmations no
longer corrupt the denominator.

**Conclusion.** Amendment 02's causal-support rule is satisfied for this case. The stronger oracle
caused the sealed evaluator to select the missing composition action and catch D-001. This upgrades
the prior mechanism explanation from trace-based inference to one directly demonstrated case.

The claim boundary remains strict. This is one repetition, one controlled mutation, one task, and
one system. Stochastic replication is absent. The result cannot become an original frozen-condition
unique catch, count toward the three-real-defect gate, satisfy cross-system coverage, or move H0 to
VALIDATED. The frozen H0 tally remains zero unique catches with recall 0.50. The binary verdict is
**DARK-FACTORY REJECTED**.

The working product hypothesis now has stronger evidence: contract and oracle authoring set the
recall ceiling in this case. Generalizing that claim requires repeated defects, tasks, and both
systems.

**Cleanup limitation.** The evaluator created two clearly named capsules and attempted cleanup
through three API routes. Each returned 404 because the permitted API exposes no DELETE route. Both
capsules remain under `guardian-1` with favorite state reset to false. Their IDs and exact attempts
are preserved in the trace.

Primary evidence:

- `results/raw/cc-h0-03-independent-mut2-contract-v2.json`
- `results/raw/cc-h0-03-independent-mut2-contract-v2-http-trace.jsonl`
- `independent-evaluator/isolation-manifests/cc-h0-03-independent-mut2-contract-v2.json`
- `results/raw/cc-h0-03-contract-quality-comparison.json`

## 2. Evaluator-pack decision

**Not yet recorded.** Will be one of `BUILD THIN PACK`, `NARROW AND REPEAT`, or `METHODOLOGY ONLY`,
with gate tables and public evidence links or opaque private references.

## Failed hypotheses

H0, independent black-box evaluation as a source of dark-factory advantage, is rejected. The
evidence supports contract and oracle authoring as the stronger working mechanism. Any hypothesis
from H1 through H4 that later fails its individual gate will remain archived here as research
evidence.

## Recorded deviations from HYPOTHESIS_VALIDATION_PLAN.md

Deviations are recorded here with their timing. Execution-control deviations were frozen before
their scored results. The binary decision correction below occurred after results and is disclosed
as such; it changes no gate or evidence.

### 2026-07-27: Binary decision correction

Plan section 1 originally defines exactly two H0 outcomes. The reduced-scope execution introduced
`INCOMPLETE` as a temporary third outcome because the full sample was absent. After results were
visible, Murat required the original binary policy: every gate passes for
`DARK-FACTORY VALIDATED`; any failed gate produces `DARK-FACTORY REJECTED`.

This correction is post-execution and is disclosed in
`preregistration/h0-decision-amendment-03-binary-closure.yaml`. It changes no raw evidence,
finding mapping, metric, threshold, or gate. It cannot improve H0's outcome because multiple frozen
gates already failed. It converts the failed evidence bar into the final product decision required
by section 1.

### 2026-07-27: Agent-only ground truth

**What the plan specifies:** section 6 requires two independent human reviewers (Reviewer A =
Murat, Reviewer B = someone else who understands agent traces and did not author the prototype
evaluators) to label every trace blind to condition results, then adjudicate disagreements. It
also requires reviewer agreement to clear explicit thresholds (0.80 outcome/path/material-failure/
gate agreement, 0.70 exact / 0.85 adjacent first-error-step agreement) before confirmatory scoring
proceeds.

**What Murat decided (owner instruction, this session):** no human reviewer is required. The
orchestrating Test Architect establishes ground truth end-to-end and reports conclusions. No future
experiment state may block on Reviewer B.

**Consequence, stated plainly:** the referee and the players share the same head. The H0
precision/recall numbers will measure whether the orchestrating agent — running the whole
apparatus — considers a finding a real defect, not whether an independent human does. The section
6 inter-rater agreement gates are inapplicable under this design (no second rater to agree with)
and are marked N/A rather than fabricated. Mitigation: ground truth is anchored to objective,
reproducible black-box facts (does the implementation satisfy the task's stated observable
acceptance criteria) wherever possible; any genuinely subjective call is flagged explicitly for
Murat's review at this decision stage rather than silently assumed.

**Scope of the claim this experiment can support, given the deviation:** a technical pass under
this design supports "a solo operator, using this method, found the independent-black-box approach
to catch things the self-evaluator and fixed baselines missed" — it does not support "an
independent human rater confirmed this." Any external claim (Brian, LinkedIn, a future PRD) must
carry that caveat.

### 2026-07-27: Added `self-review` arm and the `condition` enum extension

**What the plan specifies:** section 3 fixes the `condition` enum to `deterministic`, `scripted`,
`self`, `independent`, and section 2 requires every approval record to carry a Git commit SHA.

**What was done:** `preregistration/h0-amendment-01-mut2.yaml` adds a fourth condition,
`self-review`, and extends the `condition` enum in `schemas/h0-run-result.schema.json` and
`schemas/isolation-manifest.schema.json` to accept it. Both extensions are additive and invalidate no
prior record. The amendment was written and digested before the mutation was applied and before any
arm ran. Owner approval was given in session; no commit SHA exists, per Murat's standing local-only
instruction, the same disclosed deviation already recorded for `h0.yaml` itself.

**Why an added arm rather than a modified one:** the theory mut2 tested required an evaluator whose
posture a claim could actually influence. The frozen `self` prompt mandates live black-box exercise
and so is immune by construction. Modifying it would have invalidated the condition under this
experiment's own `invalidationRules` and would have manufactured the separation the run was supposed
to measure. Adding an arm preserves the frozen comparison intact and keeps the preregistered gate
arithmetic exactly as written: the condition of record for unique-catch scoring remains `self`.

**Consequence, stated plainly:** `self-review` results are exploratory and reported separately. A
defect caught by `independent` and missed by `self-review` while `self` also caught it would not be a
unique independent catch. In the event, the question was moot: both self arms caught the defect and
the independent arm missed it.

### 2026-07-27: Two additive schema corrections

`schemas/h0-run-result.schema.json` carried `additionalProperties: false` while every existing result
record included a `note` field, so no record in this experiment could ever have validated. The field
is now declared. This was found by the first real `ajv` run, which the plan required at Phase A step 4
and which STATUS.md recorded as never performed. Disclosed rather than silently corrected because it
means the plan's "all schema validation passes" completion item was previously unmet and unverified.
