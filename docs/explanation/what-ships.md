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

It executes nothing.
No agent, no judge, and no system under test runs inside it, and it ships no network adapter.
Both arms of the twin run, the evaluator itself, and the sealing of what the evaluator produced into a run record are yours.

Also outside the package, by decision: a new eval engine, a hosted service, a dashboard or GUI, multimodal evaluators, automatic prompt repair, and a generic judge-calibration platform.

## One limitation to know before you plan a run

A CLI `score` invocation accepts one run record.

The underlying scoring model is built for a trial set: several runs of the same probes, reduced to one result per probe before any rate is computed.
The command and `runScore` hand that model one record per call, so a run scored from the published surface completes one trial.
Whenever your scoring policy asks for more than one, the strength vector comes out reported and marked non-comparable.

The number is real and worth reading.
It can be compared against another run's once the policy's trial minimum is met.

## Related pages

- [How far a strength number carries](/explanation/contract-strength/): what a strength measurement claims, and what it does not
- [Evaluate tool-use behavior](/how-to/evaluate-tool-use-behavior/): what the `mcp` kind describes and where its boundary sits
- [CLI reference](/reference/cli-commands/): flags, exit codes, exports, and artifact version compatibility
