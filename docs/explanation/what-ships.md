---
title: "What Ships"
description: "What you actually get when you install the package: four commands, three interface kinds, and the artifacts around them."
sidebar:
  order: 2
---

# What Ships

The question this page answers is what you get when you install this thing.

## Four commands

| Command | What it does |
| --- | --- |
| `compile` | Validates an evaluation contract and rejects one that could never prove anything. |
| `seal` | Creates an evaluator-safe brief from that contract. |
| `preflight` | Verifies the environment can produce meaningful evidence. |
| `score` | Validates the evidence and produces a verdict plus a contract-strength result. |

Every flag each one takes is on the [CLI reference](/reference/cli-commands/), and [the walkthrough](/how-to/author-behavioral-contracts/) runs all four end to end over files this repository commits.

## Three interface kinds

A contract describes its system under test through a declared interface, and the kinds are `api`, `cli`, and `mcp`.

All three compile, and all three plan a pre-flight.
`cli` and `mcp` each have a shipped adapter that runs that pre-flight against a real process.
`api` has none, because probing a live HTTP environment is the part only a caller can write.

`web` is the one kind `compile` still refuses under `unsupported-interface-kind`, and its probe semantics are undeclared.

## What else is in the package

- twelve JSON Schema documents under `eval-quality/schemas/*`
- five reference adapters at `eval-quality/adapters`
- a twenty-four-contract development corpus under `eval-quality/corpus/dev/`
- a port conformance suite at `eval-quality/conformance`
- a second binary, `eval-quality-gates`, carrying the repository gates on [their own page](/how-to/run-the-gates-on-your-repository/)

## What the package does not do

It starts nothing on its own.
No agent, no judge, and no system under test runs inside it, and it ships no network adapter.
Both arms of the twin run, the evaluator itself, and the sealing of what the evaluator produced into a run record are yours.

Two shipped adapters do launch a process, and only where you wire one up and tell it what it may reach: `createCommandLineAdapter` runs a command, and `createMcpAdapter` runs a tool server over MCP's stdio transport. Each takes a target policy you write, mapping a logical name in the contract to something real, so what runs is what you authorized.

Also outside the package, by decision: a new eval engine, a hosted service, a dashboard or GUI, multimodal evaluators, automatic prompt repair, and a generic judge-calibration platform.

## Plan a trial set

The scoring model reduces several runs of the same probe to one result before any rate is computed.

Repeat `--record` once per trial on the `score` command, or pass the complete list to `runScore`.
Each sealed record carries its own `trialIndex`.
All records in the set must agree on `contractDigest`, `evaluatorConfigurationDigest`, `mode`, `evaluatorRecommendation`, and `runId`.

The evidence artifact keeps each detailed oracle outcome with its `trialIndex` and publishes the reduced per-probe outcome separately. `trials.completedAttempts` retains the exact trial identities, and `scoredProbeId` binds an empty reduction for a legitimate no-oracle probe. Detailed and reduced outcomes carry the scored probe behavior's declared severity. Each reduction retains the selected `trialVotes` and the policy's `catchThreshold`, so its counts, invalidations, severity, and caught decision can be verified exactly. Contract strength and dominance use the reduced result after checking it against the detailed trial evidence.

The strength vector becomes comparable when the completed set meets the policy's declared minimum.

## Related pages

- [How far a strength number carries](/explanation/contract-strength/): what a strength measurement claims, and what it does not
- [Evaluate tool-use behavior](/how-to/evaluate-tool-use-behavior/): what the `mcp` kind describes and where its boundary sits
- [CLI reference](/reference/cli-commands/): flags, exit codes, exports, and artifact version compatibility
