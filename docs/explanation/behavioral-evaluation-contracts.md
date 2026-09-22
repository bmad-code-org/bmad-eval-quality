---
title: "How It Works"
description: "Where the system, the evaluation, the contract and this tool each sit, and why compile rejects a contract that parses."
sidebar:
  order: 1
---

# How It Works

## Four things, and the boundaries between them

Most confusion about this tool comes from collapsing four separate things into one.
They stack, and each one is answerable on its own.

```text
system under test
        ↓
evaluation
runs the system
collects evidence
makes judgments
        ↓
Behavioral Evaluation Contract (BEC)
defines what behavior matters
defines what evidence counts
defines how success and failure are resolved
        ↓
eval-quality
checks whether the contract is sane
checks whether the evidence supports it
scores whether the evaluation actually catches defects
```

The **system under test** is the thing you built: an AI feature, an agent, a skill, a workflow, or a tool server.

The **evaluation** is the mechanism that runs or observes it and produces evidence plus judgments.
An eval framework, your own harness, a skill-specific evaluator, custom code you wrote: all of them are evaluations.

The **Behavioral Evaluation Contract** declares what must be proven.
The rest of these pages call it an eval contract, which is the same object under a shorter name, and the CLI reads it as a file.

**`eval-quality`** checks the contract and the evidence, then scores the evaluation.
It runs one level up from your evaluation, and the evaluation is its subject.

## The shape this exists to replace

The evaluation nobody writes down looks like this.

```text
prompt → model → "looks good to me" → PASS
```

Something plausible came back, a person or a judge nodded at it, and the run went green.
Nothing in that chain says which behavior was under test, what would have counted as failure, or where anyone looked.

The shape `eval-quality` moves you toward is longer on purpose.

```text
behavior
→ observable criterion
→ oracle
→ evidence path
→ probe
→ clean control / seeded defect
→ scored result
```

Each arrow is a question the first chain never asks.
Which behavior is this about, how would you see it, what relation has to hold, which recorded bytes does that relation read, what poke produces them, what does the same evaluation say when the system is knowingly broken, and what did all of that score.

## The problem

**An evaluation can pass and prove nothing.**
It sends one request, sees something plausible come back, and reports success while the failure it was written to catch sits right next to the thing it looked at.
That is a blind spot, and nothing inside a green run reveals it.

Two common evaluation styles make blind spots easy to acquire.

String matching and regular expressions break the moment the agent reformats its output, so they get loosened until they stop discriminating.

An LLM judge tolerates rewording, costs money on every run, and returns a different answer to the same input.
A green result carries no guarantee the next one repeats it.

An eval contract takes a third route.
It declares the checkable structure ahead of the run, so every check resolves over declared shapes and stays deterministic and cheap.
That is what makes it affordable to plant a defect and run the whole thing twice.

## The twin run

The way to find a blind spot is to plant one.
You are the one who plants it: `eval-quality` performs no mutation, so you edit the artifact by hand, run the evaluation against both versions of the system, and declare in the probe what you changed.
Hold the evaluation fixed and change the system under test:

```text
        eval contract + probes + oracles + rubrics + scoring policy
                                    │
                  ┌─────────────────┴─────────────────┐
                  ↓                                   ↓
             clean system                       mutated system
         (no planted defect)               (one known planted defect)
                  ↓                                   ↓
           run the evaluation                 run the evaluation
                  ↓                                   ↓
              observations                       observations
                  ↓                                   ↓
     preflight  [eval-quality]         preflight  [eval-quality]
              must pass                           must pass
                  ↓                                   ↓
               evidence                            evidence
                  ↓                                   ↓
 score / verdict  [eval-quality]   score / verdict  [eval-quality]
             should pass                       should degrade
                  └─────────────────┬─────────────────┘
                                    ↓
                       did the evaluation catch it?
```

The rows marked `[eval-quality]` are the ones the package performs.
Planting the defect, executing the two systems, running the evaluator, and collecting what it produced belong to you.

The mutation is one deliberate change that should make behavior worse, and you know in advance which failure it is supposed to create.
Weaken the prompt, remove required context, drop a validation step, alter a tool's results, change the agent configuration.

Each of those edits an artifact you hold, which is what a probe has to declare.
The `controlled-mutation` qualification route names a `targetArtifact` for what changed and carries `rollbackVerified` for putting it back, so a planted defect is something you can point at and restore.
A prompt file is the ordinary case, and a prompt mutation counts as a planted defect whenever its effect shows up in what came back.
A vendor's model weights fill neither field, so switching models is outside what a probe can declare.

Preflight has to pass on **both** arms.
A mutated run that fails preflight tells you the environment was unfit, which is a different finding from the evaluation catching the defect.
Mixing the two makes the comparison meaningless.

`seal` is what keeps the two arms comparable.
It reduces the contract to a brief the evaluator can be handed: the behaviors, the interfaces by name and kind, the bounds, one prose direction per oracle, and a digest of the contract it came from.
The checks themselves and the test data have no place in a brief, so an evaluator reading one cannot read the answers off the contract.
Comparing the digest across the two arms proves both ran the same contract.

The digest says nothing about the probes, the scoring policy, the evaluator configuration, the harness, or the model settings.
Holding those fixed across the two arms is your job.

### A worked example

Requirement: invalid input returns an error, and no record is created.

Planted defect: the correct error is returned, and the record is created anyway.

- A **weak** evaluation checks only the response. It sees the error, and it passes. The defect ships.
- A **strong** evaluation checks the response and the resulting state. It finds the record, and it fails.

Run the same evaluation against the fixed implementation and it passes again.
A trustworthy evaluation has to prove both directions: planted defect present, evaluation fails; clean implementation, evaluation passes.
The question is whether the evaluation reliably tells bad behavior from good, whether that behavior belongs to an agent, a skill, a tool-use path, a workflow, or an end-to-end AI feature.

## What a Behavioral Evaluation Contract declares

A contract declares six things.

- what behavior matters
- how success is observed
- what evidence the evaluator may use
- what interfaces it may touch
- what checks decide outcomes
- what limits the run must respect

One part is worth pausing on, because it is the twin run applied to a single input.

A **sensitivity witness** proves an input actually matters.
Change one input, keep everything else the same, and the output should change in the declared way.
Otherwise an evaluation may appear to check an input while the system ignores it.

`schemas/eval-contract.schema.json` is the normative shape, and [the walkthrough](/how-to/author-behavioral-contracts/) lists every field and runs a real contract through all four commands.

## Why `compile` rejects contracts

`compile` acts like a linter or a type checker for evaluation design.

It rejects contracts that are structurally valid JSON and cannot prove what they claim.

Two examples, both shipped in the corpus.

1. **The contract claims an input matters and never proves the system reads it.** `compile` refuses it under `undeclared-mandatory-input`.
2. **An oracle points at evidence that can never exist.** The pointer resolves to nothing, so the assertion can never fire, and `compile` refuses it under `unreachable-check-evidence`.

Both are the same class of problem:

> **The evaluation can say PASS without actually looking at the behavior it claims to validate.**

That is the core idea.
Whether a live operation really responds to a declared witness is preflight's question, and the [CLI reference](/reference/cli-commands/) carries the rest of the rules.

## Three ways to get a wrong answer

`score` is the comparison step at the bottom of the twin run.
It reads the sealed run records your harness produced, resolves each oracle over the observations each record carries, and mints a verdict.
Three things decide whether that verdict means anything.

### 1. A defect only counts as caught when evidence proves it

The evaluator gets no credit for claiming "I found the defect".
The observation a finding cites has to match the defect signature the probe declared.

```text
claim + matching evidence = caught
claim without matching evidence = no credit
```

### 2. Know what is being scored

There are two modes.

- `production`: is this system safe or good enough to ship?
- `contract-scoring`: is this evaluation contract good enough to catch known defects?

Both arms of a twin run use `contract-scoring`.
A mutated system failing while the evaluation catches the mutation is a success for the evaluation contract, and the two modes never compare.

### 3. Keep the experiment controlled

`eval-quality`'s own transformations are deterministic.
Compile, seal, the preflight reduction, and the score chain are pure functions over JSON.

The model, the evaluator, the fixtures, sampling, configuration, the trial count, and the rest of the execution details are external.
If those change between arms, the comparison becomes noisy, and whatever you left uncontrolled is what the comparison measures.

> **Evidence must prove the catch. Use the correct scoring mode. Keep the experiment controlled.**

[CLI reference](/reference/cli-commands/) documents every command, flag, and package export, and [Contract Strength](/explanation/contract-strength/) explains how scored runs are evaluated.
