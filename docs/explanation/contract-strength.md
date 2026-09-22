---
title: "Contract Strength"
description: "What a contract-strength vector measures, how trials are reduced, how dominance is evaluated, and the methodological limits of the measurement."
sidebar:
  order: 2
---

# Contract Strength

`score` answers two distinct questions at once, and the second is the one people misread.

The **verdict** answers whether a run of an evaluation contract was sound, complete, and free from evidence faults or coverage gaps.

The **strength vector** answers how effectively the Behavioral Evaluation Contract discriminates between correct behavior and defects.

Per probe class, contract strength is reported as a **catch rate**: unique qualified probe identifiers resolving `caught` over unique qualified probe identifiers `exercised`. A vector reporting a `defect` rate of 1.0 indicates that every defect probe exercised during the evaluation run was detected by matching evidence.

Catching one defect does not make an evaluation contract trustworthy or ready for release. Contract strength is a structured rate vector and a dominance relation—never a single weighted score, percentage, or scalar grade. How far a strength number carries depends on how trials are reduced, what the verdict exposed, and how the evaluation was controlled.

## What a reported strength vector means

Contract strength is defined across three probe classes in `StrengthVector`:

* **`defect`**: Probes that introduce known regressions, state corruption, or functional failures.
* **`gameability`**: Probes that return degenerate, compliant-looking, or lazy responses designed to satisfy naive checks without performing the required work.
* **`zero-action`**: Probes where the system under test takes no action despite mandatory requirements, catching systems that swallow inputs silently.

Canary probes and clean controls never enter the strength vector (AD-7). Canary probes exist to indict the fixture environment rather than the contract, and clean controls verify that unmutated runs remain unpenalized.

### The catch rate formula

For each probe class, the catch rate is calculated as:

```text
rate = unique qualified probes resolving caught / unique qualified probes exercised
```

A probe is **exercised** when the evaluator itself invoked the probe signature's declared home operation during execution (AD-40). Calls made during harness setup or runs that never completed do not count. A probe whose home operation was never invoked leaves both numerator and denominator; its required check resolves to `not-applicable` rather than artificially deflating the score.

The `EvidenceArtifact` records the raw counts (`caught`, `exercised`) alongside the derived `rate`. When zero probes of an admitted class are exercised, `rate` is recorded as `null` rather than zero, making unexercised classes transparent. The artifact also names the exact denominator string—including the number of completed trials—so consumers can independently verify calculations.

## What contract strength does not mean

Contract strength is frequently conflated with conventional test metrics. It is critical to understand what it does not measure:

* **It is not a system-under-test pass rate:** Contract strength does not measure whether your agent or application is reliable. It measures whether your *evaluation contract* has the acuity to detect flaws when they occur.
* **It is not a single-number score or percentage:** Aggregating diverse defect categories into an uncalibrated weighted scalar creates false confidence and hides blind spots. AD-7 explicitly forbids scalar composites.
* **Severity is not a weight in the vector:** Critical and low-severity behaviors receive equal weight within a probe class rate. Severity routes verdicts in AD-21 and acts as a floor override in dominance comparison; it never scales the rate vector.
* **A perfect catch rate on known probes does not prove exhaustiveness:** Achieving a catch rate of 1.0 against a diagnostic suite proves only that the contract detects the specific failure modes its author anticipated.

## The verdict and the vector disagree on purpose

A contract can catch the defect it was pointed at and still receive a verdict of `FAIL` or `CONCERNS`.

The defect rate tells you whether the contract caught what was planted. The verdict ladder (AD-21) reads every oracle outcome, evidence-integrity check, and coverage condition across the entire run.

```text
                 contract catches planted defect?
                            │
              ┌─────────────┴─────────────┐
              ↓                           ↓
             YES                          NO
              │                           │
  check all other oracles,       contract missed defect
  evidence integrity, coverage            │
              │                           ↓
      ┌───────┴───────┐              FAIL / CONCERNS
      ↓               ↓
   no flaws      flaws present
      ↓               ↓
    PASS       FAIL / CONCERNS
```

Consider three common scenarios:

1. **Catch rate 1.0, verdict `FAIL`:** The contract detected the seeded defect (`caught`). However, another required oracle in the contract examined insufficient evidence and abstained at or above the policy's `severityFloor`, or evidence was incomplete. Catching a defect does not excuse a broken measurement elsewhere in the run.
2. **Catch rate 1.0, verdict `CONCERNS`:** The contract caught the defect, but the run completed fewer trials than the policy's `minimumTrialCount`, an oracle resolved `unreached`, or an unsatisfied coverage gap exists below the severity floor. The vector is reported, but the verdict warns that the measurement was thinner than declared policy.
3. **Catch rate null or 0, verdict `PASS`:** In a clean-control run where no defect was seeded, all oracles held, resolving `passed-clean-control`. Because clean controls never enter the strength vector, the vector records no defect detections, yet the run is a valid `PASS`.

## Plan a trial set and trial reduction

A rate measured over a single run of a non-deterministic agent or LLM feature is an anecdote, not a measurement. Evaluating retries on a pass-if-any basis is the retry anti-pattern with a score attached.

The scoring model requires evaluating probes across a **trial set** and reducing multiple runs of the same probe to a single outcome before computing rates.

### Supplying a trial set

Repeat `--record` on the `score` CLI command once per trial, or supply the complete array of `SealedRunRecord` objects to `runScore`:

```bash
eval-quality score \
  --record trial-0.json \
  --record trial-1.json \
  --record trial-2.json \
  --contract contract.json \
  --probe probe.json \
  --preflight-verdict preflight-verdict.json \
  --policy policy.json \
  --corpus-digest "$CORPUS_DIGEST"
```

Each sealed record carries its own integer `trialIndex`. Scoring sorts records by `trialIndex` and verifies that all records agree on:

* `contractDigest`
* `evaluatorConfigurationDigest`
* `mode`
* `evaluatorRecommendation`
* `runId`

### How `reduceTrialSet` folds outcomes

For each probe, the trial set reducer (`reduceTrialSet`) gathers the outcome state from each trial and partitions AD-6's twelve outcome states into three groups:

1. **Invalidating states (`oracle-error`, `judge-error`, `infrastructure-error`):** The trial suffered a harness or execution failure. It is excluded from the valid count and recorded in `invalidatedAttempts` with its `trialIndex` and failure reason.
2. **Unvoted states (`not-applicable`, `unreached`):** The probe was not exercised in that trial. It contributes to neither the numerator nor the denominator.
3. **Voted states (`caught`, `confirmed`, `missed`, `abstained`, `bypassed`, `passed-clean-control`, `false-positive`): Valid observations that form the `validCount`.

The reducer then applies a strict majority threshold:

$$\text{caught} = (\text{validCount} > 0) \land \left(\frac{\text{caughtCount}}{\text{validCount}} > \text{catchThreshold}\right)$$

The inequality is strict (`>`), so an exact tie never counts as caught. Under the published default scoring policy (`catchThreshold: 0.5`), a probe must resolve `caught` in at least two out of three valid trials to be credited as caught.

The resulting `EvidenceArtifact` retains both levels of detail:
* Detailed per-trial oracle outcomes are stored in `outcomes` with their respective `trialIndex`.
* Reduced per-probe outcomes are stored in `reducedProbeOutcomes`, recording `validCount`, `caughtCount`, `catchThreshold`, `trialVotes`, and `invalidatedAttempts`.

## Comparing two contracts

`compareDominance` is AD-7's four-valued relation for comparing two scored evaluation results:

* `a-dominates-b`
* `b-dominates-a`
* `equivalent`
* `incomparable`

### Comparability requirements

Before any rates are compared, `compareDominance` evaluates three strict gates:

1. **`comparabilityKey` match:** Both artifacts must share the exact same `comparabilityKey`. The key is a SHA-256 digest of the scoring policy digest and the sorted list of admitted probe identifiers. If the policies differ or the probe sets do not match, the results cannot be compared and the function returns `incomparable`.
2. **`comparable: true` on both sides:** A strength vector is marked `comparable: true` if and only if:
   * The completed trials met or exceeded the policy's declared minimum (`trials.completed >= trials.declaredMinimum`).
   * No oracle resolved `unreached` (`unreachedOracles.length === 0`).
   If either side fell short of the minimum trial count or left an oracle unreached, its vector carries `comparable: false` and the comparison returns `incomparable`.
3. **Reduction consistency:** The reduced probe outcomes must agree with the detailed trial evidence and trial metadata stored in each artifact.

### Component-wise comparison and severity-floor override

If comparability checks pass, `compareDominance` evaluates the vectors component-wise across all probe classes where both sides have non-null rates:

* If contract A strictly exceeds contract B in at least one class catch rate and is not lower in any other class, the raw comparison favors A (`a-dominates-b`).
* If all contributing class counts (`caught` and `exercised`) are identical, the relation is `equivalent`.
* If each contract beats the other in different classes, or if rates tie while raw counts differ, the relation is `incomparable`.

Finally, the **severity-floor override** applies (AD-7):

> A contract that missed a behavior at or above the scoring policy's `severityFloor` never dominates one that caught it, regardless of the rest of the vector.

If raw comparison favored contract A, but contract A failed to catch a probe that contract B caught at or above `severityFloor`, dominance is denied and the result drops to `incomparable`. The override constrains dominance only; it does not alter `equivalent`.

### Methodological boundary: `comparabilityKey` vs. `scoringVersion`

`compareDominance` checks `comparabilityKey`, not `scoringVersion`.

* `comparabilityKey` digests only the scoring policy digest and the admitted probe identifiers. It allows comparing two evaluations of the same probe set under the same policy even if they were executed in different runs or revisions.
* `scoringVersion` (AD-11) is the complete cryptographic identity of the experiment: the contract schema version, corpus digest, fixture digest, evaluator configuration digest, scoring policy digest, and run mode.

Because `compareDominance` does not inspect model snapshots, fixture versions, or run modes, callers must independently verify that `scoringVersion` aligns between artifacts to ensure that external experimental controls held constant.

## Methodological limits

A strength measurement is only as reliable as the probe corpus and experimental controls behind it.

### Known probes versus held-out probes

The contracts in `corpus/dev/` are diagnostic and visible: contract authors can inspect them while developing contracts.

* **Known probes (development corpus):** Measuring a contract against probes its author could read demonstrates that the contract catches known defect patterns. That is an assertion about the author's attention as much as the contract's quality.
* **Held-out probes (sealed corpus):** Authentic evaluation requires measuring contracts against private, held-out probe sets that contract authors cannot inspect (AD-8). The `Probe` schema supports qualification records and defect signatures for both kinds, but the artifacts do not distinguish them automatically.

### Controlled experiment discipline

All transformations performed by `eval-quality` (compilation, brief sealing, preflight planning, trial reduction, scoring, and emission) are pure and deterministic.

The system under test, the evaluator harness, model weights, prompt templates, decoding parameters, and fixture environments are external. If those change between evaluation arms, the comparison measures environmental noise rather than contract strength.

## Related pages

* [How It Works](/explanation/behavioral-evaluation-contracts/): The twin-run model and core evaluation boundaries
* [The Full Walkthrough](/how-to/author-behavioral-contracts/): Step-by-step authoring, preflighting, and scoring
* [CLI Reference](/reference/cli-commands/): Command flags, package exports, and `compareDominance` API details
* [Glossary](/reference/glossary/): Precise definitions of all scoring and contract terms
