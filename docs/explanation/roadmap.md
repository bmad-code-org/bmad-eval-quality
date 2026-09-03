---
title: "Roadmap"
description: "What ships today, what is next, and what the next release breaks."
sidebar:
  order: 2
---

# Roadmap

The pipeline has six stages: `compile`, `seal`, `ingest`, `preflight`, `score`, and `emit`. All six ship today, through the CLI and the library alike.

## Shipping today

`compile`, `seal`, `preflight`, and `score`. All four are documented on the [CLI reference](/reference/cli-commands/); the first three run end to end in [Run the three commands](/how-to/run-the-three-commands/), and `score` chains `ingest`, `score`, and `emit` behind one command and one library call, `runScore`, both exported from `src/application/index.ts`.

Twelve JSON Schema documents ship under `eval-quality/schemas/*`, a nineteen-contract development corpus under `eval-quality/corpus/dev/`, the port conformance suite at `eval-quality/conformance`, and three reference adapters at `eval-quality/adapters`. [Ports, adapters, and the conformance suite](/how-to/ports-and-adapters/) covers the last two.

The ground `score` covers:

- outcome-state assignment over twelve closed states
- both verdict ladders, production and contract-scoring, each total and first-match-wins, published at `/ad21-verdict-decisiongenerated/`
- the AD-40 witness match, which is what decides whether a finding actually detected the defect its probe seeded
- the trial-set reducer and the AD-7 rate vector with its four-valued dominance relation, published at `/ad33-outcome-decisiongenerated/`
- probe qualification, captured-value bindings, and observation selection
- `ingest`, which validates a sealed run record against its isolation manifest and evaluator configuration
- `emit`, which mints the `EvidenceArtifact` its own published schema describes

## Next

Regenerating the worked example so `buildWorkedExampleChain` calls the shipped `ingest`, `score`, and `emit` stages for every value it currently derives by hand in `scripts/worked-example-target.ts`, and drafting the `0.2.0` release notes disclosing this epic's caller-facing surface change. No date is set.

## The next release breaks

The next release is `0.2.0`, and a `0.1.x` range no longer holds. Nine `schemaVersion` bumps land across six of the twelve interchange artifacts, each adding a required field, so a document written against the older version fails to parse. The compile-time failure-code registry moves from 21 entries to 23, which breaks an exhaustive match over it. Scoring versions computed before the release are not comparable with any computed after, because the run mode became one of the inputs that fixes a scoring version's identity.

None of these announces itself as a version mismatch at runtime. Nothing in this release compares a `schemaVersion`, so an older document arrives as a parse failure. Pin exactly.

`CHANGELOG.md` carries the full list, artifact by artifact, with what each bump added and why it is breaking.
