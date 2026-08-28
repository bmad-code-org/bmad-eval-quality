---
title: "eval-quality"
description: "Compile Behavioral Evaluation Contracts, seal evaluator briefs, and reduce probe observations into a pre-flight verdict."
template: splash
hero:
  tagline: "Compile Behavioral Evaluation Contracts, seal evaluator briefs, and reduce probe observations into a pre-flight verdict."
  actions:
    - text: "Getting Started"
      link: /bmad-eval-quality/tutorials/getting-started/
      icon: right-arrow
      variant: primary
    - text: "Behavioral Contracts"
      link: /bmad-eval-quality/explanation/behavioral-evaluation-contracts/
      icon: external
---

## What eval-quality is

`eval-quality` is a Node package and a command line binary, both published under the name `eval-quality`. It compiles a Behavioral Evaluation Contract into a checked artifact, seals a contract into a deterministic evaluator brief, and reduces probe observations into a pre-flight verdict.

The package executes nothing. It never runs an agent, a judge, or a system under test: every input arrives as JSON and every output leaves as JSON.

:::tip[AI Documentation]
Plain-text documentation for AI agents is available at [`/llms-full.txt`](/llms-full.txt) or indexed at [`/llms.txt`](/llms.txt).
:::

---

## The three commands

| Command | Inputs | Output |
| --- | --- | --- |
| `compile` | a contract | a compiled `EvalContract` |
| `seal` | a contract | a `SealedEvaluatorBrief` carrying the contract digest |
| `preflight` | a contract, a probe list, observations, a run id | a `PreflightVerdict` |

Every flag each command accepts is listed on the [CLI reference](/reference/cli-commands/).

---

## What ships

- **The three commands**, with seven exit codes and diagnostics on stderr.
- **Twelve JSON Schema documents** under `schemas/`, reachable from a consumer at the `eval-quality/schemas/*` subpath. `schemas/eval-contract.schema.json` is the normative contract shape.
- **A development corpus** under `corpus/dev/`: nineteen named contracts, one per discipline rule in each declaration state, plus one compiled-and-sealed pair. Reachable at the `eval-quality/corpus/*` subpath.
- **Reference adapters** at `eval-quality/adapters` and a published port conformance suite at `eval-quality/conformance`.
- **A zero-dependency production core** behind a checked dependency direction. The only runtime dependency is `zod`.

---

## What does not ship

**Scoring.** No command computes contract strength, defect detection, or any other score. Exit codes 1 and 2 are reserved for a scored verdict, so nothing in this release reaches them, and `--strict` changes no exit code the binary produces today. The [roadmap](/explanation/roadmap/) records what is next.

---

## Documentation structure

The documentation follows the Diátaxis framework:

<div class="card-grid">

### [Tutorials](/tutorials/getting-started/)
Install the package and run compile, seal, and preflight on a contract that ships in the corpus.

### [How-To Guides](/how-to/author-behavioral-contracts/)
Author a contract against the real schema, and drive the three commands end to end.

### [Explanation](/explanation/behavioral-evaluation-contracts/)
What a Behavioral Evaluation Contract asserts, and why compile rejects what it rejects.

### [Reference](/reference/cli-commands/)
Every command, every flag, the exit-code table, and the package export subpaths.

</div>
