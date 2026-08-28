---
title: "bmad-eval-quality"
description: "Compile disciplined Behavioral Evaluation Contracts and score their ability to catch known defects."
template: splash
hero:
  tagline: "Compile disciplined Behavioral Evaluation Contracts and score their ability to catch known defects."
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

`bmad-eval-quality` is an enterprise evaluation framework designed to compile **Behavioral Evaluation Contracts** and evaluate AI agent or system performance against known defect suites.

It moves beyond simple fuzzy assertion checks by defining formal contract schemas, calculating contract strength, and scoring defect detection probabilities with mathematical rigor.

:::tip[AI-Optimized Documentation]
This documentation site is fully optimized for AI consumption. You can access the complete plain-text documentation in a single file at [`/llms-full.txt`](/llms-full.txt) (~100k tokens) or view the index at [`/llms.txt`](/llms.txt).
:::

---

## Documentation Structure (Diátaxis)

The documentation is organized following the **Diátaxis framework**:

<div class="card-grid">

### 🎓 [Tutorials](/tutorials/getting-started/)
Step-by-step learning guides to help you get started with `eval-quality`, author your first contract, and run defect evaluation suites.

### 🛠️ [How-To Guides](/how-to/author-behavioral-contracts/)
Task-focused recipes for specific goals: contract authoring, defect scoring, custom adapter integration, and coverage validation.

### 💡 [Explanation](/explanation/behavioral-evaluation-contracts/)
Conceptual deep dives into Behavioral Evaluation Contracts, contract strength theory, oracle design mechanics, and architectural invariants.

### 📖 [Reference](/reference/cli-commands/)
Technical specifications, CLI command reference, schema definitions, and Architectural Decision (AD) registries.

</div>

---

## Core Capabilities

- **Behavioral Evaluation Contracts**: Express rigorous preconditions, postconditions, and invariant contracts over AI agent execution traces.
- **Defect Suite Scoring**: Measure contract effectiveness against known defect corpora with empirical detection scoring.
- **Coverage & Lineage Verification**: Validate contract predicate coverage against registry decisions (AD5, AD28, AD31).
- **Zero-Dep Production Core**: Minimal runtime overhead with strict dependency boundaries and Schema-driven verification.
