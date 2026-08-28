---
title: "CLI Command Reference"
description: "Reference guide for eval-quality CLI commands, arguments, and options."
sidebar:
  order: 1
---

# CLI Command Reference

`bmad-eval-quality` provides command line utilities for compiling behavioral contracts, evaluating traces, and running validation suites.

---

## `eval-quality`

Primary CLI command for evaluation execution.

```bash
eval-quality [options] <command>
```

### Commands

#### `eval`
Runs evaluation pass across a trace corpus.

```bash
eval-quality eval --corpus <path-to-corpus>
```

**Options:**
- `--corpus, -c <path>`: Path to trace corpus JSON file.
- `--contract, -k <path>`: Path to specific contract schema file.
- `--output, -o <format>`: Output format (`json`, `summary`, `table`).

---

## npm Quality Scripts

```bash
npm run typecheck       # TypeScript type checking
npm run lint            # Biome check & linting
npm run test            # Vitest unit & integration tests
npm run validate        # Full repository validation suite
npm run check:docs      # Validate documentation links & integrity
```
