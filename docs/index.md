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

## Four things, and which one this is

```text
│ system under test │  the AI feature, agent, skill, workflow, or tool server
          ↓
│ evaluation        │  runs it, collects evidence, makes judgments
          ↓
│ eval contract     │  declares what must be proven and what evidence counts
          ↓
│ eval-quality      │  checks the contract, checks the evidence, scores the evaluation
```

The evaluation is what most people mean when they say "our evals". This tool is the layer above it, and the evaluation is its subject. [How it works](/explanation/behavioral-evaluation-contracts/) walks each boundary.

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

### [Contract strength](/explanation/contract-strength/)
What a strength number claims, and why a caught defect does not make a contract trustworthy.

### [The full walkthrough](/how-to/author-behavioral-contracts/)
Author a contract, run all four commands over it, and read a scored run down to its verdict.

### [Pick your system shape](/how-to/evaluate-agent-behavior/)
Five guides, one per kind of system people point this at. Start with the one that matches yours.

### [Run the gates](/how-to/run-the-gates-on-your-repository/)
A second binary holds your own lockfiles to a publication-age window and a licence allowlist you declare.

### [Reference](/reference/cli-commands/)
Every command, every flag, every exit code, and the glossary.

</div>

## What you can point this at

An eval contract describes a system through a declared interface. Three interface kinds compile today, `api`, `cli`, and `mcp`, and a guide below covers each shape people put in front of them.

| Your system | Guide | What you run |
| --- | --- | --- |
| An agent you invoke from the command line | [Agent behavior](/how-to/evaluate-agent-behavior/) | A tiny agent that swallows a malformed input and exits `0`, caught by a contract that reads what it wrote. |
| A skill an agent loads and acts on | [Skill behavior](/how-to/evaluate-skill-behavior/) | A selection skill answering honestly and then degenerately, with the exclusion oracle catching the degenerate reply. |
| Several steps that have to happen in order | [Workflow behavior](/how-to/evaluate-workflow-behavior/) | A write bound to a read-back at the identifier the write minted, catching a service that filed the record and dropped the name. |
| An AI feature behind an HTTP surface | [AI feature behavior](/how-to/evaluate-ai-feature-behavior/) | A relational oracle that survives a varying answer, and an empty collection that abstains rather than passing. |
| An MCP server answering tool calls | [Tool-use behavior](/how-to/evaluate-tool-use-behavior/) | Real tool calls against a stdio tool server the guide spawns, where the write answers identically in both arms and the read-back separates them. The fixture is the one this repository ships, and no live server stands behind it. |

Every command those guides present as runnable runs from a fresh checkout, and CI executes them on every build. Where a fence is grammar rather than a step, the page says so above it. Each guide also says plainly what is proven and what is not.

One kind parses and stops at compilation under `unsupported-interface-kind`: `web`, whose probe semantics are undeclared. [What Ships](/explanation/what-ships/) states the limits of the tool-use kind and how far a strength number carries.

:::tip[AI Documentation]
Plain-text documentation for AI agents is available at [`/llms-full.txt`](/llms-full.txt) or indexed at [`/llms.txt`](/llms.txt).
:::
