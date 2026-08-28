---
title: "Getting Started with eval-quality"
description: "A 10-minute quickstart guide to installing eval-quality, compiling behavioral contracts, and running evaluations."
sidebar:
  order: 1
---

# Getting Started with eval-quality

This tutorial walks you through installing `bmad-eval-quality`, setting up your evaluation workspace, and running your first Behavioral Evaluation Contract evaluation.

---

## Prerequisites

- **Node.js**: `>=22.20.0`
- **npm** or **pnpm**

---

## Step 1: Installation

Install `eval-quality` as a dependency in your project or run via `npx`:

```bash
npm install bmad-eval-quality
```

Or test directly with the CLI:

```bash
npx eval-quality --help
```

---

## Step 2: Running an Evaluation

Run a basic evaluation pass over your execution traces or evaluation corpus:

```bash
npx eval-quality eval --corpus ./corpus/sample-traces.json
```

---

## Step 3: Understanding the Output

The evaluation pipeline performs the following steps:

1. **Schema Validation**: Validates traces against Zod contract schemas.
2. **Predicate Evaluation**: Evaluates behavioral invariants and assertions.
3. **Defect Scoring**: Calculates defect detection probability and contract strength metrics.

Example output:

```json
{
  "contractId": "contract-trace-v1",
  "status": "PASS",
  "contractStrength": 0.942,
  "defectsCaught": 12,
  "totalDefects": 12,
  "coveragePredicates": ["AD31_PRED_01", "AD31_PRED_02"]
}
```

---

## Next Steps

- Learn how to [Author Behavioral Contracts](/how-to/author-behavioral-contracts/).
- Explore the [Behavioral Evaluation Contracts Explanation](/explanation/behavioral-evaluation-contracts/).
- View the complete [CLI Reference](/reference/cli-commands/).
