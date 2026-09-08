---
title: "Roadmap"
description: "What ships today, what is deliberately out of scope, and what is next."
sidebar:
  order: 2
---

# Roadmap

## Shipping today

All four commands: `compile`, `seal`, `preflight`, and `score`. Every flag each one takes is on the [CLI reference](/reference/cli-commands/), and [the walkthrough](/how-to/author-behavioral-contracts/) runs them end to end.

`score` is the largest of the four. Behind it sit three stages, `ingest`, `score`, and `emit`, reached by one command and one library call, `runScore`. It covers outcome-state assignment over twelve closed states, both verdict ladders, the witness match that decides whether a finding really detected the defect its probe seeded, the trial-set reducer, the contract-strength vector with its four-valued dominance relation, probe qualification, and observation selection.

Also published: twelve JSON Schema documents under `eval-quality/schemas/*`, a twenty-one-contract development corpus under `eval-quality/corpus/dev/`, three reference adapters at `eval-quality/adapters`, and a port conformance suite at `eval-quality/conformance`.

**One limit is worth knowing before you rely on the numbers.** The `score` stage is built to consume a trial set: several runs of the same probes, reduced to one result per probe before any rate is computed. The command and `runScore` hand it one sealed run record per call. So a run scored from the published surface completes one trial, and whenever your policy's declared minimum exceeds one, the strength vector comes out reported and marked non-comparable. The stage is ready for several trials; the entry point that hands it several is what is missing.

## Deliberately out of scope

The package executes nothing. It never runs an agent, a judge, or a system under test, and it ships no network adapter. Both arms of the twin run, the evaluator itself, and the sealing of what the evaluator produced into a run record are yours.

Also outside the package, by decision: a new eval engine, a hosted service, a dashboard or GUI, multimodal evaluators, automatic prompt repair, and a generic judge-calibration platform.

Deferred until the contract layer is in real use: claim-to-evidence lineage, semantic checkpoint scoring, process and outcome separation, and first material error attribution.

## Next

No date is set for any of these.

- **A sealed probe corpus.** `corpus/dev/` is visible and diagnostic, and its own gate does not yet require a qualified probe per probe class. The probe schema already carries the qualification record and the defect signature that gate reads. What is missing is the corpus widening to require one.
- **Validation of the witness match against the block-2 replication**, which the architecture records as committed and not yet run.

## Breaking changes

`compile` refuses an eval contract whose `schemaVersion` is not the one this build reads, with the `schema-version-mismatch` fault. A version-3 contract still parses, because most of its shape is still legal; it stops at compilation rather than being scored under a stale stamp that would go into the scoring version and quietly make the result incomparable with everything else.

The other artifacts have no such reader. A sealed run record, a probe, or a rubric written against an older version arrives as a parse failure where a required field moved, and is read as written where it did not. Pin the version you build against exactly, and check the stamp on anything you did not produce with this build.

`CHANGELOG.md` in the repository carries every breaking change artifact by artifact, with what each schema bump added and why it breaks.
