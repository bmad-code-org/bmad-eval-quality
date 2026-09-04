---
title: "Roadmap"
description: "What ships today, what is next, and what the next release breaks."
sidebar:
  order: 2
---

# Roadmap

The pipeline has six stages: `compile`, `seal`, `ingest`, `preflight`, `score`, and `emit`. All six ship today, through the CLI and the library alike. That list is the declared stage order. On the clock, `ingest` follows the evaluator run, so it sits after `preflight` and just before `score`, which is where the other pages place it.

## Shipping today

`compile`, `seal`, `preflight`, and `score`. All four are documented on the [CLI reference](/reference/cli-commands/) and run as a pipeline in [Run the four commands](/how-to/run-the-four-commands/). `score` chains `ingest`, `score`, and `emit` behind one command and one library call, `runScore`, both exported from `src/application/index.ts`, and [Read a Scored Run](/tutorials/read-a-scored-run/) follows a committed run through them.

Twelve JSON Schema documents ship under `eval-quality/schemas/*`, a nineteen-contract development corpus under `eval-quality/corpus/dev/`, the port conformance suite at `eval-quality/conformance`, and three reference adapters at `eval-quality/adapters`. [Ports, adapters, and the conformance suite](/how-to/ports-and-adapters/) covers the last two.

The ground `score` covers:

- outcome-state assignment over twelve closed states
- both verdict ladders, production and contract-scoring, each total and first-match-wins, published at `/ad21-verdict-decisiongenerated/`
- the AD-40 witness match, which is what decides whether a finding actually detected the defect its probe seeded
- the trial-set reducer and the AD-7 rate vector with its four-valued dominance relation, published at `/ad33-outcome-decisiongenerated/`
- probe qualification, captured-value bindings, and observation selection
- `ingest`, which validates a sealed run record against its isolation manifest and evaluator configuration
- `emit`, which mints the `EvidenceArtifact` its own published schema describes

One limit sits inside that ground, and it is a limit of the published surface. The `score` stage is built to consume a trial set: several runs of the same probes, reduced to one result per probe before any rate is computed. The command and `runScore` hand it one sealed run record per call. So every run scored from the published surface today completes one trial, and whenever the policy's declared minimum exceeds one its strength vector is reported and marked non-comparable. The stage is ready for several trials; the entry point that hands it several is what is missing.

## Deliberately out of scope

The package executes nothing. It never runs an agent, a judge, or a system under test, and it ships no network adapter, so both arms of the twin run, the evaluator, and the sealing of what the evaluator produced into a run record are the caller's. Also outside the package, by decision: a new eval engine, a hosted service, a dashboard or GUI, multimodal evaluators, automatic prompt repair, and a generic judge-calibration platform.

Deferred until the contract layer is in real use: claim-to-evidence lineage, semantic checkpoint scoring, process and outcome separation, and first material error attribution.

## Next

No date is set for any of these.

- **A sealed probe corpus.** `corpus/dev/` is visible and diagnostic, and its own gate does not yet require a qualified probe per class. The probe schema already carries the qualification record and the defect signature that gate reads, and the worked chain's `P-001` passes it. What is missing is the corpus widening to require one.
- **Validation of the witness match against the block-2 replication**, which the architecture spine records as committed and not yet run.
- **The `0.2.0` release itself**, cut with `npm run release:prepare` from the `[Unreleased]` section of `CHANGELOG.md`.

## The next release breaks

The next release is `0.2.0`, and a `0.1.x` range no longer holds. Nine `schemaVersion` bumps land across six of the twelve interchange artifacts, each adding a required field, so a document written against the older version fails to parse. The compile-time failure-code registry moves from 21 entries to 23, which breaks an exhaustive match over it. Scoring versions computed before the release are not comparable with any computed after, because the run mode became one of the inputs that fixes a scoring version's identity.

None of these announces itself as a version mismatch at runtime. Nothing in this release compares a `schemaVersion`, so an older document arrives as a parse failure. Pin exactly.

`CHANGELOG.md` carries the full list, artifact by artifact, with what each bump added and why it is breaking.
