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

That is mutation testing, pointed at evaluations. You plant the defect and run both arms; `eval-quality` is what makes each arm's result worth comparing.

## What the tool does

`eval-quality` is a Node package and a command line binary, both published under the name `eval-quality`. It gives you four commands.

| Command | What it does |
| --- | --- |
| `compile` | Checks an eval contract and rejects one that could never prove anything. |
| `seal` | Turns the contract into a brief for the evaluator, with the answers stripped out. |
| `preflight` | Decides whether the environment is fit to be measured at all. |
| `score` | Reads what the evaluator produced and mints the verdict. |

An **eval contract** is a JSON document that says what a system is supposed to do, written so an automated check can resolve it. Every command here is built around one.

The package executes nothing and mutates nothing. No agent, no judge, and no system under test runs inside it, and it edits none of your artifacts. You break the system yourself, run the evaluation twice, once against the clean system and once against the broken one, and hand over what it produced; `eval-quality` compiles, seals, preflights, and scores.

## Where to go

<div class="card-grid">

### [Start here](/tutorials/getting-started/)
Install the binary and compile a real eval contract, in about five minutes.

### [How it works](/explanation/behavioral-evaluation-contracts/)
The twin run, what an eval contract declares, and why `compile` rejects the contracts it rejects.

### [The full walkthrough](/how-to/author-behavioral-contracts/)
Author a contract, run all four commands over it, and read a scored run down to its verdict.

### [Pick your system shape](/how-to/evaluate-agent-behavior/)
Five guides, one per kind of system people point this at. Start with the one that matches yours.

### [Reference](/reference/cli-commands/)
Every command, every flag, every exit code, and the glossary.

</div>

## What you can point this at

An eval contract describes a system through a declared interface. Three interface kinds compile today, `api`, `cli`, and `mcp`, and a guide below covers each shape people put in front of them.

| Your system | Guide | State |
| --- | --- | --- |
| An agent you invoke from the command line | [Agent behavior](/how-to/evaluate-agent-behavior/) | Proven. Nine probes catch a seeded defect in a real corpus. |
| A skill an agent loads and acts on | [Skill behavior](/how-to/evaluate-skill-behavior/) | Proven. A seeded defect is caught and scored against a shipped skill contract, on a chain regenerated and byte-checked every build, one trial, marked non-comparable. |
| Several steps that have to happen in order | [Workflow behavior](/how-to/evaluate-workflow-behavior/) | Declarable and compiling. Step binding is unit-tested, with no shipped end-to-end run. |
| An AI feature behind an HTTP surface | [AI feature behavior](/how-to/evaluate-ai-feature-behavior/) | Proven end to end against a loopback fixture the suite starts: a real probe observes a seeded defect over HTTP and the chain scores it, one trial, marked non-comparable. No third-party AI feature has been evaluated; pointing this at yours is the adapter and the two arms you write. |
| An MCP server answering tool calls | [Tool-use behavior](/how-to/evaluate-tool-use-behavior/) | Compiles, scores a probe, and runs a pre-flight against a real stdio tool server. No live server has been scored end to end yet. |

Each guide says plainly what is proven and what is not, so a "state" column entry is the guide's own verdict rather than a roadmap promise.

One kind parses and stops at compilation under `unsupported-interface-kind`: `web`, which has had no design pass. [What Ships](/explanation/what-ships/) carries what tool-use support still needs.

:::tip[AI Documentation]
Plain-text documentation for AI agents is available at [`/llms-full.txt`](/llms-full.txt) or indexed at [`/llms.txt`](/llms.txt).
:::
