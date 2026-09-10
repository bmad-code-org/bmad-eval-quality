---
title: "What Ships"
description: "What version 1.0 covers, the trial-set limit, and what is deliberately out of scope."
sidebar:
  order: 2
---

# What Ships

Version 1.0 is out. All four commands ship, and the published surface is stable: a breaking change to a command, an export, or a schema is a major version bump from here.

## The four commands

`compile`, `seal`, `preflight`, and `score`. Every flag each one takes is on the [CLI reference](/reference/cli-commands/), and [the walkthrough](/how-to/author-behavioral-contracts/) runs them end to end.

`score` is the largest of the four. Behind it sit three stages, `ingest`, `score`, and `emit`, reached by one command and one library call, `runScore`. It resolves every oracle to one of twelve outcome states, decides whether a finding really detected the defect its probe seeded, reduces repeated trials to one result per probe, and reports contract strength as a vector two contracts can be compared on.

A contract can describe a system behind an HTTP API, one behind a command line, or one behind an MCP tool server. All three compile, and all three plan a pre-flight. `cli` and `mcp` each have a shipped adapter that runs that pre-flight end to end; `api` has none, because probing a live HTTP environment is the part only a caller can write.

Also published: twelve JSON Schema documents under `eval-quality/schemas/*`, a twenty-four-contract development corpus under `eval-quality/corpus/dev/`, five reference adapters at `eval-quality/adapters`, and a port conformance suite at `eval-quality/conformance`.

## The trial-set limit

The `score` stage is built for a trial set: several runs of the same probes, reduced to one result per probe before any rate is computed. The command and `runScore` hand it one record per call. So a run scored from the published surface completes one trial, and whenever your scoring policy asks for more than one, the strength vector comes out reported and marked non-comparable.

The number is still real and still worth reading. It cannot be compared against another run's until the policy's trial minimum is met.

## What this package does not do

It executes nothing. No agent, no judge, and no system under test runs inside it, and it ships no network adapter. Both arms of the twin run, the evaluator itself, and the sealing of what the evaluator produced into a run record are yours.

Also outside the package, by decision: a new eval engine, a hosted service, a dashboard or GUI, multimodal evaluators, automatic prompt repair, and a generic judge-calibration platform.

Also outside the package: claim-to-evidence lineage, semantic checkpoint scoring, process and outcome separation, and first material error attribution. Each needs a contract layer in real use before its shape is decidable, and that is where the brief left them.

## Tool-use evaluation

`compile` accepts `mcp`, the pre-flight plan mints the calls a probe would make, and `createMcpAdapter` runs them against a tool server it launches over MCP's stdio transport. A server reached over HTTP needs your own adapter, since this package opens no socket. [Evaluate tool-use behavior](/how-to/evaluate-tool-use-behavior/) covers the whole picture, down to the port messages and the conformance arm that certifies an adapter for the kind.

The response descriptor question the kind turned on is settled. The kind's first version describes a tool's structured result, which is what an MCP tool returns when it has a result with structure at all, and typically what it returns when it declares an output schema. A tool that answers with a markdown `content` array is outside that version, since prose gives AD-4's quantifiers no collection to range over. The text channel such a tool needs is undesigned, so a tool that returns prose is outside what the kind describes.

`web` is the one kind `compile` still refuses under `unsupported-interface-kind`, and it has had no design pass at all.

## How far a strength number carries

Two properties of the measurement decide how to read a contract's strength, and both are visible in what ships.

`corpus/dev/` is diagnostic: every contract in it is published to be read. A strength number measured against it says the contract catches probes its author could read while writing it. That is a claim about the contract and the probe set together, and it is a weaker claim than the same number measured against probes the author never saw. The probe schema carries the qualification record and the defect signature either probe set needs, so what separates them is the probes rather than the shape.

The rule that decides whether a finding detected the defect its probe seeded runs on every score. It was derived from the experiment records in `experiments/hypothesis-validation/` and it has been exercised on those. A number it produces is a measurement over records of that kind.

## Version compatibility

`compile` refuses an eval contract whose `schemaVersion` differs from the one this build reads, with the `schema-version-mismatch` fault. A contract whose shape moved between versions fails the schema gate first; one that still parses and carries another stamp stops at compilation with that fault. Either way it never reaches scoring, where a stale stamp would travel into the scoring version and quietly make the result incomparable with everything else.

The other artifacts have no such reader. A sealed run record, a probe, or a rubric written against an older version fails to parse where a required field moved, and is read as written where it did not. Check the stamp on anything you did not produce with this build.

`CHANGELOG.md` in the repository carries every breaking change artifact by artifact.
