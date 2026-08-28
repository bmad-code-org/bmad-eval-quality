---
title: "CLI Command Reference"
description: "CLI command line options, flags, and quality scripts."
sidebar:
  order: 1
---

# CLI Command Reference

Command line utilities for `bmad-eval-quality`.

---

## `eval-quality`

```bash
eval-quality [options] <command>
```

### Commands

#### `eval`
Runs an evaluation pass over a trace corpus.

```bash
eval-quality eval --corpus <path-to-corpus>
```

**Options:**
- `--corpus, -c <path>`: Path to trace corpus JSON file.
- `--contract, -k <path>`: Path to contract schema file.
- `--output, -o <format>`: Output format (`json`, `summary`, `table`).

---

## npm Quality Scripts

```bash
npm run typecheck       # TypeScript type checking
npm run lint            # Biome check and linting
npm run test            # Vitest test suite
npm run validate        # Full repository validation pass
npm run docs:validate-links  # Internal link check
npm run docs:build      # Build documentation site and AI context files
```
