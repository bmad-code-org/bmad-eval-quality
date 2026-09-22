---
title: "Contract Strength"
description: "What a contract-strength vector measures, how trials are reduced, how dominance is evaluated, and the methodological limits of the measurement."
sidebar:
  order: 2
---

# Contract Strength

`score` answers two distinct questions at once, and the second is the one people misread.

The **verdict** evaluates the operational outcome of an evaluation run. In `production` mode, the subject of the verdict is the **system under test** (combining the evaluator's recommendation with evidence-integrity checks to determine shippability). In `contract-scoring` mode, the subject is the **contract itself**—determining whether the run was sound, complete, and free from evidence faults or critical coverage gaps. A `PASS` verdict does not require zero coverage gaps: under AD-21, coverage gaps below the scoring policy's `severityFloor` are recorded in the artifact and do not move the verdict.

The **strength vector** answers how effectively the Behavioral Evaluation Contract discriminates between correct behavior and defects.

A current `score` invocation scores one `Probe` across one or more trial records. Accordingly, a single `EvidenceArtifact` normally reports strength for that scored probe's class, not an aggregate over an entire probe corpus.

For that scored probe's class, contract strength is reported as a **catch rate**: unique qualified probe identifiers resolving `caught` over unique qualified probe identifiers `exercised`. For the shipped single-probe scoring path, a reported rate of 1.0 means 1/1: the single probe passed to `score` was successfully caught across its valid trials. Unexercised classes are recorded with a `rate` of `null`.

The underlying vector abstraction (`buildStrengthVector`) supports aggregating rates over multiple qualified probes across an entire suite, but the shipped CLI and `runScore` pipeline evaluate and emit artifacts one probe at a time.

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

The `EvidenceArtifact` records the raw counts (`caught`, `exercised`) alongside the derived `rate`. In a single-probe evaluation, the exercised count for the probe's class is 1 (if exercised) or 0 (if unexercised), with `rate` recorded as 1.0, 0.0, or `null`. Classes without exercised probes record `caught: 0`, `exercised: 0`, and `rate: null` rather than zero, making unexercised classes transparent. The artifact also names the exact denominator string—including the number of completed trials—so consumers can independently verify calculations.

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
2. **Catch rate 1.0, verdict `CONCERNS`:** The contract caught the defect, but the run completed fewer trials than the policy's `minimumTrialCount`, an oracle resolved `unreached`, or an unsatisfied coverage gap exists at or above the policy's `severityFloor`. (Unsatisfied coverage gaps below the severity floor are recorded in `coverageGaps` on the artifact, but do not move the verdict.) The vector is reported, but the verdict warns that the measurement was thinner than declared policy.
3. **Catch rate `null`, verdict `PASS`:** In a clean-control run where no defect was seeded, all oracles held, resolving `passed-clean-control`. Because clean controls never enter the strength vector, their class rate is recorded as `null` (not zero), yet the run is a valid `PASS`.

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

1. **Invalidating states (`oracle-error`, `judge-error`, `infrastructure-error`):** Outcome states that invalidate the trial for reduction due to an unresolvable execution, oracle, or infrastructure error. The trial is excluded from the valid count and recorded in `invalidatedAttempts` with its `attempt` number (the trial index) and failure reason.
2. **Unvoted states (`not-applicable`, `unreached`):** States that cast no vote. `not-applicable` indicates the probe's home operation was not exercised in that trial or a documented waiver applied. `unreached` indicates an interaction or check step was unreached (an evidence condition). Neither state contributes to the numerator or denominator (`validCount`).
3. **Voted states (`caught`, `confirmed`, `missed`, `abstained`, `bypassed`, `passed-clean-control`, `false-positive`): Valid observations that form the `validCount`.

The reducer then evaluates the strict catch threshold:

```text
caught = (validCount > 0) && (caughtCount / validCount > catchThreshold)
```

`catchThreshold` is configurable in `ScoringPolicy` within the domain `[0.0, 1.0]`. The inequality is strict (`>`), so an exact tie never counts as caught. Under the default scoring policy (`catchThreshold: 0.5`), this condition functions as a strict majority requirement (for example, at least two out of three valid trials must resolve `caught`). Custom policies can specify higher or lower catch thresholds.

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

1. **`comparabilityKey` match:** Both artifacts must share the exact same `comparabilityKey`. The key is a SHA-256 digest of the scoring policy digest and the sorted list of admitted probe identifiers. In a single-probe evaluation, this key binds the scoring policy to that specific admitted probe ID. If the policies differ or the probe sets do not match, the results cannot be compared and the function returns `incomparable`.
2. **`comparable: true` on both sides:** A strength vector is marked `comparable: true` if and only if:
   * The completed trials met or exceeded the policy's declared minimum (`trials.completed >= trials.declaredMinimum`).
   * No oracle resolved `unreached` (`unreachedOracles.length === 0`).
   If either side fell short of the minimum trial count or left an oracle unreached, its vector carries `comparable: false` and the comparison returns `incomparable`.
3. **Reduction consistency:** The reduced probe outcomes must agree with the detailed trial evidence and trial metadata stored in each artifact (`reductionDetailsAgree`).

### Component-wise comparison and severity-floor override

If comparability checks pass, `compareDominance` evaluates the vectors component-wise across all probe classes where both sides have non-null rates:

* If contract A strictly exceeds contract B in at least one class catch rate and is not lower in any other class, the raw comparison favors A (`a-dominates-b`).
* If all contributing class counts (`caught` and `exercised`) are identical, the relation is `equivalent`.
* If each contract beats the other in different classes, or if rates tie while raw counts differ, the relation is `incomparable`.

Finally, the **severity-floor override** applies (AD-7):

> A contract that missed a behavior at or above the scoring policy's `severityFloor` never dominates one that caught it, regardless of the rest of the vector.

If raw comparison favored contract A, but contract A failed to catch a probe that contract B caught at or above `severityFloor`, dominance is denied and the result drops to `incomparable`. The override constrains dominance only; it does not alter `equivalent`.

### Methodological boundary: `comparabilityKey` vs. `scoringVersion`

`compareDominance` checks `comparabilityKey`, not `scoringVersion`. This design reflects a deliberate separation of concerns:

* **`comparabilityKey` enables cross-run and cross-revision comparisons:** The key binds only the scoring policy digest and the sorted admitted probe identifiers. This intentionally allows comparing two contract revisions or different evaluation setups against the same probe set under the same scoring policy. If `compareDominance` required identical `scoringVersion`, comparing an updated contract against an earlier revision or comparing across differing evaluator configurations would be impossible.
* **`scoringVersion` tracks declared experiment configuration:** Defined in AD-11, `scoringVersion` is a SHA-256 digest over six declared inputs: `contractSchemaVersion`, `corpusDigest`, `fixtureDigest`, `evaluatorConfigurationDigest`, `scoringPolicyDigest`, and `mode`. It captures declared configuration identifiers and caller-attested tokens, not full contract content or live execution state.

Because `compareDominance` intentionally permits cross-version comparisons, callers must be mindful of the interpretive boundary: when comparing artifacts with different `scoringVersion` values, observed strength differences may reflect changes in the evaluator configuration, fixtures, or environment rather than contract acuity alone. Callers seeking to attribute dominance solely to contract improvements should verify that external experimental controls held constant.

## Methodological limits

A strength measurement is only as reliable as the probe corpus and experimental controls behind it.

### Known probes versus held-out probes

The contracts in `corpus/dev/` provide a development corpus for compiler testing and contract authoring reference, not a benchmark of diagnostic probes.

When evaluating behavioral evaluation contracts against probes:

* **Known probes (development suites):** Measuring a contract against probes authored alongside it demonstrates that the contract detects anticipated defects. However, a high catch rate on known probes is an assertion about the author's foresight as much as the contract's quality.
* **Held-out probes (private suites):** Authentic evaluation of contract acuity requires measuring contracts against private, held-out probe sets that contract authors cannot inspect during authoring (AD-8). The `Probe` schema supports qualification records and defect signatures for both kinds, but emitted evidence artifacts do not distinguish them automatically.

### Controlled experiment discipline

All transformations performed by `eval-quality` (compilation, brief sealing, preflight planning, trial reduction, scoring, and emission) are pure and deterministic.

The system under test, the evaluator harness, model weights, prompt templates, decoding parameters, and fixture environments are external. If those change between evaluation arms, the comparison measures environmental noise rather than contract strength.

## Related pages

* [How It Works](/explanation/behavioral-evaluation-contracts/): The twin-run model and core evaluation boundaries
* [The Full Walkthrough](/how-to/author-behavioral-contracts/): Step-by-step authoring, preflighting, and scoring
* [CLI Reference](/reference/cli-commands/): Command flags, package exports, and `compareDominance` API details
* [Glossary](/reference/glossary/): Precise definitions of all scoring and contract terms
