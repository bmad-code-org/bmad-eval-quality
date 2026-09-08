---
title: "eval-quality"
description: "Mutation testing for evaluations. Plant a known defect, run the same evaluation, and check that it catches it."
template: splash
hero:
  tagline: "Write the eval. Hide the bug. See if the eval catches it."
  actions:
    - text: "Start here"
      link: /bmad-eval-quality/tutorials/getting-started/
      icon: right-arrow
      variant: primary
    - text: "How it works"
      link: /bmad-eval-quality/explanation/behavioral-evaluation-contracts/
      icon: external
---

## An evaluation can pass and prove nothing

An AI evaluation sends a request, sees something plausible come back, and reports success. The failure it was written to catch can be sitting right next to the thing it looked at. That is a blind spot, and a green run never shows you one.

The way to find a blind spot is to plant one. Hold the evaluation still, break the system on purpose, and run the same evaluation again.

```text
clean system    → evaluation → should pass
mutated system  → evaluation → should degrade
                                    ↓
                       did the evaluation catch it?
```

An evaluation that caught the planted defect is sensitive to that failure. One that stayed green has a blind spot, and now you know where.

That is mutation testing, pointed at evaluations. `eval-quality` is the tool for running it.

## What the tool does

`eval-quality` is a Node package and a command line binary, both published under the name `eval-quality`. It gives you four commands.

| Command | What it does |
| --- | --- |
| `compile` | Checks an eval contract and rejects one that could never prove anything. |
| `seal` | Turns the contract into a brief for the evaluator, with the answers stripped out. |
| `preflight` | Decides whether the environment is fit to be measured at all. |
| `score` | Reads what the evaluator produced and mints the verdict. |

An **eval contract** is a JSON document that says what a system is supposed to do, written so an automated check can resolve it. Every command here is built around one.

The package executes nothing. No agent, no judge, and no system under test runs inside it. Your harness runs both arms of the loop and hands over what the evaluator produced; `eval-quality` compiles, seals, preflights, and scores.

## Where to go

<div class="card-grid">

### [Start here](/tutorials/getting-started/)
Install the binary and compile a real eval contract, in about five minutes.

### [How it works](/explanation/behavioral-evaluation-contracts/)
The twin run, what an eval contract declares, and why `compile` rejects the contracts it rejects.

### [The full walkthrough](/how-to/author-behavioral-contracts/)
Author a contract, run all four commands over it, and read a scored run down to its verdict.

### [Reference](/reference/cli-commands/)
Every command, every flag, every exit code, and the glossary.

</div>

:::tip[AI Documentation]
Plain-text documentation for AI agents is available at [`/llms-full.txt`](/llms-full.txt) or indexed at [`/llms.txt`](/llms.txt).
:::
