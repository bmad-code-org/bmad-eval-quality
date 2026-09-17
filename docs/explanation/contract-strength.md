---
title: "Contract Strength"
description: "What a contract-strength number claims, what it leaves open, and the two properties of the measurement that decide how to read it."
sidebar:
  order: 3
---

# Contract Strength

`score` answers two questions at once, and the second is the one people misread.

The verdict says whether this run of this contract came out PASS, CONCERNS, WAIVED, FAIL, or Invalid.

The strength vector says how good the contract is at catching defects.
Per probe class it is a catch rate: unique qualified probes resolving `caught` over unique qualified probes exercised.
A vector with a `defect` rate of 1 says every defect probe that ran was caught.

Catching one defect does not make an evaluation contract trustworthy.
Two properties of the measurement decide how far the number carries, and both are visible in what ships.

## Who could read the probes

`corpus/dev/` is diagnostic: every contract in it is published to be read.

A strength number measured against a probe set the contract's author could read while writing it says the contract catches probes its author already knew about.
That is a claim about the contract and the probe set together.
The same number measured against probes the author never saw is a stronger claim about the contract alone.

The probe schema carries the qualification record and the defect signature either probe set needs, so what separates them is the probes rather than the shape.
A hidden probe set is something you assemble, and nothing in the artifacts marks which kind you used.

## How many trials the number rests on

A rate over one trial is a rate over one trial.

The scoring model reduces a trial set to one result per probe before computing any rate, because a pass-if-any reading across retries is the retry anti-pattern with a score attached.
Repeat `--record` on one CLI invocation to supply the set, or pass the record list to `runScore`.
Each record carries its own `trialIndex`, and the set agrees on `contractDigest`, `evaluatorConfigurationDigest`, `mode`, `evaluatorRecommendation`, and `runId`.
When the completed set meets the scoring policy's minimum, the vector carries `comparable: true`.
Below that minimum, the vector carries `comparable: false` and a note naming the shortfall.

[What Ships](/explanation/what-ships/) states the trial-set contract in full.

## The verdict and the vector disagree on purpose

A contract can catch the defect it was pointed at and still come back FAIL or CONCERNS.

The verdict ladder reads every oracle outcome, not just the one the probe targeted.
An oracle that abstained at or above the severity floor lands FAIL whatever the defect rate says.
A coverage gap, an unreached oracle, or a trial count below the policy minimum lands CONCERNS.

That is the point of scoring a contract at all.
The defect rate tells you the contract caught what you planted; the verdict tells you what else the same run exposed about the contract.
The [full walkthrough](/how-to/author-behavioral-contracts/) ends on a scored run where exactly that happens, and reads both numbers off the artifact.

## Comparing two contracts

`compareDominance` is the four-valued comparison over two scored results: one dominates the other, the reverse, equivalent, or incomparable.
A contract that missed a behavior at or above the severity floor never dominates one that caught it. The comparison reads the artifact's reduced per-probe outcomes, so a mixed trial set contributes its majority result once and trial numbering cannot select the answer.

It gates on `comparabilityKey`, which is a digest of the scoring policy digest and the sorted admitted probe ids, together with each side's `strength.comparable`.
It reads no scoring version and no model field, so two artifacts agreeing on the key will compare even when their contract schema version, corpus digest, fixture digest, evaluator configuration, or mode differ.
Each of those five is a scoring-version input for a reason, so compare `scoringVersion` yourself before you read anything else across two artifacts.

## Related pages

- [How It Works](/explanation/behavioral-evaluation-contracts/): the twin run and the three ways to get a wrong answer
- [The full walkthrough](/how-to/author-behavioral-contracts/): a scored run read down to its verdict and its vector
- [Glossary](/reference/glossary/): contract strength, dominance, trial set, and scoring version
