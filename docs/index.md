---
title: "bmad-eval-quality"
description: "Compile Behavioral Evaluation Contracts and score their ability to catch known defects."
template: splash
hero:
  tagline: "Compile Behavioral Evaluation Contracts and score their ability to catch known defects."
  actions:
    - text: "Getting Started"
      link: /tutorials/getting-started/
      icon: right-arrow
      variant: primary
    - text: "Behavioral Contracts"
      link: /explanation/behavioral-evaluation-contracts/
      icon: external
---

## What is eval-quality?

`bmad-eval-quality` compiles Behavioral Evaluation Contracts and scores AI agent trace execution against known defect suites.

It defines formal contract schemas, measures contract strength, and computes defect detection probability across trace corpora.

:::tip[AI Documentation]
Plain-text documentation for AI agents is available at [`/llms-full.txt`](/llms-full.txt) (~12k tokens) or indexed at [`/llms.txt`](/llms.txt).
:::

---

## Documentation Structure

The documentation follows the Diátaxis framework:

<div class="card-grid">

### [Tutorials](/tutorials/getting-started/)
Step-by-step guides to set up `eval-quality`, author contracts, and run defect evaluation suites.

### [How-To Guides](/how-to/author-behavioral-contracts/)
Task recipes for contract authoring, defect scoring, adapter integration, and coverage validation.

### [Explanation](/explanation/behavioral-evaluation-contracts/)
Architecture deep dives into Behavioral Evaluation Contracts, contract strength theory, and oracle design.

### [Reference](/reference/cli-commands/)
CLI command reference, schema definitions, and Architectural Decision (AD) registries.

</div>

---

## Core Capabilities

- **Behavioral Contracts**: Express preconditions, postconditions, and trace invariants over agent execution logs.
- **Defect Suite Scoring**: Measure contract effectiveness against defect corpora with empirical detection scoring.
- **Coverage & Lineage Verification**: Validate predicate coverage against architectural decisions (AD5, AD28, AD31).
- **Zero-Dependency Production Core**: Strict dependency boundaries with Schema-driven verification.
