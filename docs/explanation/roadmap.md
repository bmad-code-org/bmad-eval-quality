---
title: "Roadmap"
description: "What ships today, what is written but unreachable, and what the next release breaks."
sidebar:
  order: 2
---

# Roadmap

The pipeline has six stages: `compile`, `seal`, `ingest`, `preflight`, `score`, and `emit`. They are in two different states, and the difference matters if you are deciding whether to adopt the package.

## Shipping today

`compile`, `seal`, and `preflight`, through the CLI and the library alike. Each one is documented on the [CLI reference](/reference/cli-commands/) and run end to end in [Run the three commands](/how-to/run-the-three-commands/).

Twelve JSON Schema documents ship under `eval-quality/schemas/*`, a nineteen-contract development corpus under `eval-quality/corpus/dev/`, the port conformance suite at `eval-quality/conformance`, and three reference adapters at `eval-quality/adapters`. [Ports, adapters, and the conformance suite](/how-to/ports-and-adapters/) covers the last two.

## Written, and reachable from nothing

`ingest`, `score`, `emit`, and the whole scoring core are implemented, tested, and compiled into the published tarball. No export path reaches them. `src/index.ts` and `src/application/index.ts` name none of the three, and the CLI has three commands.

The functions came first because the spine fixed that as the way seven recorded defects in the score half would close: write the decision procedures as pure functions, and let their tables be output. Every one of the six pipeline stages now names a module in the stage table. They stay unreachable because nothing yet wires `ingest`, `score`, and `emit` to a command or a library entry point; wiring that up is the next epic's work. Two of those tables are published here: the AD-21 verdict decision table at `/ad21-verdict-decisiongenerated/` and the AD-33 outcome decision table at `/ad33-outcome-decisiongenerated/`. Both describe code that runs today and that you cannot call.

The covered ground:

- outcome-state assignment over twelve closed states
- both verdict ladders, production and contract-scoring, each total and first-match-wins
- the AD-40 witness match, which is what decides whether a finding actually detected the defect its probe seeded
- the trial-set reducer and the AD-7 rate vector with its four-valued dominance relation
- probe qualification, captured-value bindings, and observation selection
- `ingest`, which validates a sealed run record against its isolation manifest and evaluator configuration
- `emit`, which mints the `EvidenceArtifact` its own published schema describes

## Next

Putting a `score` command and one library call on top of the six stages, so `ingest`, `score`, and `emit` stop being unreachable from everything. The work is broken into five steps: `ingest`'s surface, the `score` stage over a trial set, `emit`, the command and the library entry, and regenerating the worked example through the shipped stages, which `npm run generate:worked-example` builds today from a composition written by hand.

Exit codes 1 and 2 stay unreachable until that lands. No date is set.

## The next release breaks

The next release is `0.2.0`, and a `0.1.x` range no longer holds. Nine `schemaVersion` bumps land across six of the twelve interchange artifacts, each adding a required field, so a document written against the older version fails to parse. The compile-time failure-code registry moves from 21 entries to 23, which breaks an exhaustive match over it. Scoring versions computed before the release are not comparable with any computed after, because the run mode became one of the inputs that fixes a scoring version's identity.

None of these announces itself as a version mismatch at runtime. Nothing in this release compares a `schemaVersion`, so an older document arrives as a parse failure. Pin exactly.

`CHANGELOG.md` carries the full list, artifact by artifact, with what each bump added and why it is breaking.
