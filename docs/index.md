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

The package executes nothing. No agent, no judge, and no system under test runs inside it. Your harness runs both arms and hands over what the evaluator produced, sealed into a run record, and the package compiles, seals, preflights, and scores.

## The core flow, in eight nouns

Each run of an evaluation walks the same sequence:

```text
evaluation contract → probe → observation → preflight → evidence → oracle → rubric → score / verdict
```

**Evaluation contract** says what we want to measure. **Probes** say how to poke the system. **Observations** record what happened. **Preflight** asks whether the environment and the observations are fit for meaningful measurement. **Evidence** is what the run produced. **Oracles** check whether the expected relation holds over it. **Rubrics** are the grading guides a judge scores the judgment-heavy parts against, outside the package. The **score / verdict** combines the result.

Two of those words also name package artifacts, so both meanings are stated here. The **evidence** of the core flow is what the evaluator's run produced, and it reaches `score` inside a sealed run record. The **evidence artifact** is what `score` mints at the end: the outcomes, the verdict, and the strength vector. [Read a Scored Run](/tutorials/read-a-scored-run/) walks one of each.

Every term is defined in the [glossary](/reference/glossary/), and the twin-run loop that wraps this sequence is drawn on [Behavioral Evaluation Contracts](/explanation/behavioral-evaluation-contracts/).

---

## What eval-quality is

`eval-quality` is a Node package and a command line binary, both published under the name `eval-quality`. It compiles a Behavioral Evaluation Contract into a checked artifact, seals a contract into a deterministic evaluator brief, reduces probe observations into a preflight verdict, and scores a sealed run record into a versioned evidence artifact.

Compile, seal, the verdict reduction, and the score chain are pure transformations over JSON artifacts. The two entry points that reach outward, `runPreflight` and `runScore`, do so through a port the caller supplies and implements.

---

## The four commands

| Command | Inputs | Output | Job in the loop |
| --- | --- | --- | --- |
| `compile` | a contract | a compiled `EvalContract` | reject structurally invalid contracts and recognized discipline violations |
| `seal` | a contract | a `SealedEvaluatorBrief` carrying the contract digest | hand the evaluator directions without the answers |
| `preflight` | a contract, a probe list, observations, a run id | a `PreflightVerdict` | prove the environment is fit to be measured |
| `score` | a sealed run record, the compiled contract, a probe, a preflight verdict, a scoring policy, a caller-attested corpus digest, and the isolation manifest and evaluator configuration the record was produced under | an `EvidenceArtifact` | validate the record, compare its findings against the seeded defect, and mint the verdict with its exit code |

The sealed run record, the isolation manifest, the evaluator configuration, and the corpus digest are the caller's artifacts, each defined in the [glossary](/reference/glossary/). Every flag each command accepts is listed on the [CLI reference](/reference/cli-commands/). `compile`, `seal`, and `preflight` each wrap one stage of the six-stage pipeline. `score` wraps three: `ingest` validates the record against its manifest and configuration, `score` resolves the oracles and the verdict ladder over the trial set, and `emit` mints the artifact.

A scored run's verdict is one of `PASS`, `WAIVED`, `CONCERNS`, or `FAIL`, or Invalid when the run produced no verdict; AD-21 is the architecture decision that fixes that ladder. Every command returns one of seven exit codes, and `score` is the one whose code is the verdict:

| Exit code | Meaning |
| --- | --- |
| `0` | success, and every verdict other than FAIL or a promoted CONCERNS |
| `1` | CONCERNS promoted by `--strict` |
| `2` | FAIL |
| `3` | invalid: a failed pre-flight, or any other AD-21 invalidating condition |
| `4` | structural failure |
| `5` | runtime fault |
| `64` | usage error |

`--strict` never promotes a CONCERNS whose firing conditions are all evidence conditions, the two that say the measurement was thinner than the policy asked for: fewer trials than the declared minimum, or an oracle left unreached.

---

## What ships

- **The four commands**, with seven exit codes and diagnostics on stderr.
- **Twelve JSON Schema documents** under `schemas/`, reachable from a consumer at the `eval-quality/schemas/*` subpath. `schemas/eval-contract.schema.json` is the normative contract shape.
- **A development corpus** under `corpus/dev/`: nineteen named contracts covering each discipline rule in each declaration state, plus one compiled-and-sealed pair. Reachable at the `eval-quality/corpus/*` subpath.
- **Reference adapters** at `eval-quality/adapters` and a published port conformance suite at `eval-quality/conformance`.
- **A production core behind a checked dependency direction.** `zod` is the package's sole production dependency.
- **Scoring.** The `score` command chains ingest, score, and emit, computes contract strength and defect detection, and exits with the ladder's own verdict code. Exit codes 1 and 2, reserved for a scored verdict, and `--strict`'s promotion are both reachable from this release. The command scores one sealed run record per invocation, a trial set of one. The [roadmap](/explanation/roadmap/) records what ships today, what is next, and what the next release breaks.

---

## Documentation structure

Read top to bottom, this order carries a first-time reader from the problem to the verdict:

1. [Behavioral Evaluation Contracts](/explanation/behavioral-evaluation-contracts/): the twin run, what a contract asserts, and why compile rejects what it rejects.
2. [Getting Started](/tutorials/getting-started/): run `compile`, `seal`, and `preflight` on a shipped contract.
3. [Read a Scored Run](/tutorials/read-a-scored-run/): follow a committed run through `score` to its verdict and exit code.
4. [Run the Four Commands](/how-to/run-the-four-commands/), [Author a Contract](/how-to/author-behavioral-contracts/), and [Ports and Adapters](/how-to/ports-and-adapters/): the same commands as a pipeline over your own artifacts.
5. [CLI reference](/reference/cli-commands/) and [Glossary](/reference/glossary/): every flag, every exit code, every noun.
6. [Roadmap](/explanation/roadmap/): what is deliberately out of scope, what is next, and what the next release breaks.

The pages follow the Diátaxis framework:

<div class="card-grid">

### [Tutorials](/tutorials/getting-started/)
Install the package, run compile, seal, and preflight on a contract that ships in the corpus, then read a scored run down to its verdict.

### [How-To Guides](/how-to/author-behavioral-contracts/)
Author a contract against the real schema, drive the four commands end to end, and implement a [port of your own](/how-to/ports-and-adapters/).

### [Explanation](/explanation/behavioral-evaluation-contracts/)
The twin-run loop, what a Behavioral Evaluation Contract asserts, and why compile rejects what it rejects.

### [Reference](/reference/glossary/)
The glossary, every command, every flag, the exit-code table, and the package export subpaths.

</div>

:::tip[AI Documentation]
Plain-text documentation for AI agents is available at [`/llms-full.txt`](/llms-full.txt) or indexed at [`/llms.txt`](/llms.txt).
:::
