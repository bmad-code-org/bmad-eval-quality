---
title: "How It Works"
description: "The twin run, what an eval contract declares, and why compile rejects what it rejects."
sidebar:
  order: 1
---

# How It Works

## The layer this sits on

Traditional testing runs a system through tests and gets pass or fail. AI evaluation runs a feature through an evaluation and gets a score with evidence.

```text
  traditional testing    system      →  tests       →  pass / fail
  AI evaluation          AI feature  →  evaluation  →  score / evidence
                                          ↑
                            this layer is what eval-quality evaluates
```

`eval-quality` sits one level up and evaluates the evaluation.

"Evaluation" here means whatever mechanism runs your AI feature and judges its behavior: an eval framework, your own harness, a skill-specific evaluator, custom code you wrote. The question this tool asks is how to make that mechanism strong enough to trust.

## The problem

**An evaluation can pass and prove nothing.** It sends one request, sees something plausible come back, and reports success while the failure it was written to catch sits right next to the thing it looked at. That is a blind spot, and nothing inside a green run reveals it.

Two common evaluation styles make blind spots easy to acquire.

String matching and regular expressions break the moment the agent reformats its output, so they get loosened until they stop discriminating.

An LLM judge tolerates rewording, costs money on every run, and returns a different answer to the same input. A green result carries no guarantee the next one repeats it.

An eval contract takes a third route. It declares the checkable structure ahead of the run, so every check resolves over declared shapes and stays deterministic and cheap. That is what makes it affordable to plant a defect and run the whole thing twice.

## The twin run

The way to find a blind spot is to plant one. Hold the evaluation fixed and change the system under test:

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

The rows marked `[eval-quality]` are the ones the package performs. Executing the two systems, running the evaluator, and collecting what it produced belong to you.

The mutation is one deliberate change that should make behavior worse, and you know in advance which failure it is supposed to create. Weaken the prompt, remove required context, drop a validation step, alter a tool's results, change the agent configuration, switch models.

Preflight has to pass on **both** arms. A mutated run that fails preflight tells you the environment was unfit, which is a different finding from the evaluation catching the defect. Mixing the two makes the comparison meaningless.

`seal` is what keeps the two arms comparable. It reduces the contract to a brief the evaluator can be handed: the behaviors, the interfaces by name and kind, the bounds, one prose direction per oracle, and a digest of the contract it came from. The checks themselves and the test data have no place in a brief, so an evaluator reading one cannot read the answers off the contract. Comparing the digest across the two arms proves both ran the same contract.

The digest says nothing about the probes, the scoring policy, the evaluator configuration, the harness, or the model settings. Holding those fixed across the two arms is your job.

### A worked example

Requirement: invalid input returns an error, and no record is created.

Planted defect: the correct error is returned, and the record is created anyway.

- A **weak** evaluation checks only the response. It sees the error, and it passes. The defect ships.
- A **strong** evaluation checks the response and the resulting state. It finds the record, and it fails.

Run the same evaluation against the fixed implementation and it passes again. A trustworthy evaluation has to prove both directions: planted defect present, evaluation fails; clean implementation, evaluation passes. The question is whether the evaluation reliably tells bad behavior from good, whether that behavior belongs to a model, an agent, a skill, a tool-use path, a workflow, or an end-to-end AI feature.

## What an eval contract declares

- **Behaviors**: what the system is supposed to do, each with a severity and an observable success criterion.
- **Oracles**: the checks themselves, written as relations over JSON pointers into recorded interactions.
- **Permitted interfaces**: every operation a probe may call, its request shape, its response descriptor, and the pointers whose values are volatile. An interface declares a kind, and `compile` accepts two of them today: `api`, a system behind an HTTP API, and `cli`, a system behind a command. The vocabulary also names `web` and `mcp`, and a contract declaring either is rejected with `unsupported-interface-kind`.
- **Sensitivity witnesses**: two calls per operation that differ in one input, and how their responses have to differ. If the responses come back the same, the operation never read that input. This is the mutation idea applied to one operation.
- **Reference sets, budgets, safety limits, and forbidden inputs**: the data a check reads, and the bounds a run has to stay inside.

`schemas/eval-contract.schema.json` is the normative shape, and every field is listed on [the walkthrough](/how-to/author-behavioral-contracts/). The vocabulary is defined in the [glossary](/reference/glossary/).

## Why compile rejects contracts

**Compile is type checking for your eval design.** A contract can be valid JSON, parse cleanly against the schema, and still be incapable of proving anything. Compile catches the recognized cases of that before you spend a run on one, the same way a linter catches known defect patterns.

What it rejects is declaration defects it has a rule for: checks whose evidence path cannot exist, and operations that take an input without declaring the witness that would show the input matters. Whether a live operation actually responds to that witness is preflight's question.

Two examples, both shipped in the corpus:

- **A request key with no sensitivity witness.** The contract lets an operation take an input and never establishes that the operation reads it. A check over that operation passes while the input is ignored entirely, so the pass is worth nothing. The failure code is `undeclared-mandatory-input`.
- **An oracle addressing a request field the operation never declares.** The pointer resolves to nothing, so the assertion checks evidence that cannot exist. It can never fire, which makes it decoration. The failure code is `unreachable-check-evidence`.

Both are the blind-spot problem in miniature: an evaluation that reports success without having looked.

`corpus/dev/contracts/` holds twenty-one contracts. Nineteen cover the seven discipline rules, one per declaration state, so the rule set reads as examples; the other two describe a system under test that runs behind a command.

## What scoring answers

`score` is the comparison step at the bottom of the twin run. It reads the sealed run record your harness produced, resolves each oracle over the observations the record carries, and mints a verdict.

Three things to know before you use it.

**A caught defect is decided by evidence.** A finding counts as detection only when the probe's declared defect signature matches an observation that finding cites. An evaluator that says "I found it" without citing the observation that shows it gets no credit.

**The verdict is one of four values**, `PASS`, `WAIVED`, `CONCERNS`, or `FAIL`, plus Invalid for a run that produced no verdict at all. A ladder decides which, in that order, first match wins, and the command's exit code carries the answer.

**A run has a mode, and the two modes never compare.** In `production` the subject is the system and the verdict says whether it ships. In `contract-scoring` the subject is the contract, the probe is knowingly defective, and a caught defect means the contract succeeded. Both arms of a twin run are `contract-scoring`.

## Design commitments

- **The package runs nothing under evaluation.** Compile, seal, the preflight reduction, and the score chain are pure transformations over JSON, so they are deterministic. Holding the rest of a run steady across the two arms is the caller's job: model sampling, evaluator behavior, fixture state, trial policy, and configuration all have to be controlled, or those are what the comparison measures.
- **Canonical serialization.** Artifacts serialize to RFC 8785 canonical JSON, one line with sorted keys, and the digest covers exactly that payload, so two machines agree on the identity of an artifact.
- **Lineage.** Every lineage-bearing artifact carries `parentDigest` and `revisionCount`, so a chain of revisions can be checked.
- **Failure codes.** A rejection names a machine-readable code and a path inside the artifact, so a caller can branch on the code.

[What Ships](/explanation/roadmap/) covers version 1.0, the trial-set limit, and what is deliberately out of scope.
