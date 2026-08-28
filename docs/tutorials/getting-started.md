---
title: "Getting Started with eval-quality"
description: "Quickstart guide to installing eval-quality, compiling behavioral contracts, and running evaluations."
sidebar:
  order: 1
---

# Getting Started with eval-quality

Quickstart guide for installing `bmad-eval-quality` and running your first evaluation pass.

---

## Prerequisites

- Node.js `>=22.20.0`
- npm or pnpm

---

## Step 1: Installation

Install `eval-quality` in your project:

```bash
npm install bmad-eval-quality
```

Or run the CLI directly:

```bash
npx eval-quality --help
```

---

## Step 2: Running an Evaluation

Run an evaluation pass over a trace corpus:

```bash
npx eval-quality eval --corpus ./corpus/sample-traces.json
```

---

## Step 3: Output Format

The pipeline runs three steps:

1. **Schema Validation**: Validates trace structure against Zod contract schemas.
2. **Predicate Evaluation**: Evaluates behavioral invariants and assertions.
3. **Defect Scoring**: Calculates defect detection probability and contract strength.

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

- [Author Behavioral Contracts](/how-to/author-behavioral-contracts/)
- [Behavioral Contracts Explanation](/explanation/behavioral-evaluation-contracts/)
- [CLI Reference](/reference/cli-commands/)
