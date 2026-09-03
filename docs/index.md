---
title: "eval-quality"
description: "Mutation testing for evaluations. Plant a known defect, run the same evaluation, and check that it catches it."
template: splash
hero:
  tagline: "Mutation testing for evaluations. Write the eval, hide the bug, see if the eval catches it."
  actions:
    - text: "Getting Started"
      link: /bmad-eval-quality/tutorials/getting-started/
      icon: right-arrow
      variant: primary
    - text: "Behavioral Contracts"
      link: /bmad-eval-quality/explanation/behavioral-evaluation-contracts/
      icon: external
---

## Mutation testing, for evaluations

Mutation testing keeps the tests fixed, plants a known defect in the source, runs the same tests, and asks whether they caught it. A test suite that stays green against a planted defect has a blind spot.

`eval-quality` applies that idea to AI evaluations. Keep the evaluation fixed: the same evaluation contract, probes, oracles, rubrics, and scoring policy. Change the system under test by planting one deliberate defect that should make behavior worse. Run the evaluation twice and compare.

```text
clean system    → evaluation → should pass
mutated system  → evaluation → should degrade
                                    ↓
                       did the evaluation catch it?
```

If the evaluation caught it, the evaluation is sensitive to that failure. If it did not, the evaluation has a blind spot and needs work.

## The core flow, in eight nouns

Each run of an evaluation walks the same sequence:

```text
evaluation contract → probe → observation → preflight → evidence → oracle → rubric → score / verdict
```

**Evaluation contract** says what we want to measure. **Probes** say how to poke the system. **Observations** record what happened. **Preflight** asks whether the environment and the observations are fit for meaningful measurement. **Evidence** is what the run produced. **Oracles** check whether the expected relation holds over it. **Rubrics** grade the judgment-heavy parts. The **score or verdict** combines the result.

Every term is defined in the [glossary](/reference/glossary/), and the twin-run loop that wraps this sequence is drawn on [Behavioral Evaluation Contracts](/explanation/behavioral-evaluation-contracts/).

---

## What eval-quality is

`eval-quality` is a Node package and a command line binary, both published under the name `eval-quality`. It compiles a Behavioral Evaluation Contract into a checked artifact, seals a contract into a deterministic evaluator brief, reduces probe observations into a preflight verdict, and scores a sealed run record into a versioned evidence artifact.

The package executes nothing under evaluation. It never runs an agent, a judge, or a system under test. Compile, seal, the verdict reduction, and the score chain are pure transformations over JSON artifacts. The two entry points that reach outward, `runPreflight` and `runScore`, do so through a port the caller supplies and implements.

---

## The four commands

| Command | Inputs | Output | Job in the loop |
| --- | --- | --- | --- |
| `compile` | a contract | a compiled `EvalContract` | reject structurally invalid contracts and recognized discipline violations |
| `seal` | a contract | a `SealedEvaluatorBrief` carrying the contract digest | hand the evaluator directions without the answers |
| `preflight` | a contract, a probe list, observations, a run id | a `PreflightVerdict` | prove the environment is fit to be measured |
| `score` | a sealed run record, a contract, a probe, a preflight verdict, a scoring policy | an `EvidenceArtifact` | compare completed findings against the hidden defect and mint the verdict |

Every flag each command accepts is listed on the [CLI reference](/reference/cli-commands/).

---

## What ships

- **The four commands**, with seven exit codes and diagnostics on stderr.
- **Twelve JSON Schema documents** under `schemas/`, reachable from a consumer at the `eval-quality/schemas/*` subpath. `schemas/eval-contract.schema.json` is the normative contract shape.
- **A development corpus** under `corpus/dev/`: nineteen named contracts covering each discipline rule in each declaration state, plus one compiled-and-sealed pair. Reachable at the `eval-quality/corpus/*` subpath.
- **Reference adapters** at `eval-quality/adapters` and a published port conformance suite at `eval-quality/conformance`.
- **A production core behind a checked dependency direction.** `zod` is the package's sole production dependency.
- **Scoring.** The `score` command chains ingest, score, and emit, computes contract strength and defect detection, and exits with the ladder's own verdict code. Exit codes 1 and 2, reserved for a scored verdict, and `--strict`'s promotion are both reachable from this release. The [roadmap](/explanation/roadmap/) records what ships today, what is next, and what the next release breaks.

---

## Documentation structure

The documentation follows the Diátaxis framework:

<div class="card-grid">

### [Tutorials](/tutorials/getting-started/)
Install the package and run compile, seal, and preflight on a contract that ships in the corpus.

### [How-To Guides](/how-to/author-behavioral-contracts/)
Author a contract against the real schema, drive the three commands end to end, and implement a [port of your own](/how-to/ports-and-adapters/).

### [Explanation](/explanation/behavioral-evaluation-contracts/)
The twin-run loop, what a Behavioral Evaluation Contract asserts, and why compile rejects what it rejects.

### [Reference](/reference/glossary/)
The glossary, every command, every flag, the exit-code table, and the package export subpaths.

</div>

:::tip[AI Documentation]
Plain-text documentation for AI agents is available at [`/llms-full.txt`](/llms-full.txt) or indexed at [`/llms.txt`](/llms.txt).
:::
