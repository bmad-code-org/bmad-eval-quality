---
title: "Glossary"
description: "The core flow in eight nouns, the supporting artifacts, the mutation-loop terms, and the jargon the reference pages use."
sidebar:
  order: 1
---

# Glossary

---

## The core flow

Eight nouns, in the order they occur in a run.

| Term | What it is |
| --- | --- |
| **Evaluation contract** | What we want to measure. A JSON document declaring the behaviors, the checks, the interfaces a probe may touch, and the bounds a run stays inside. `compile` turns an authored one into a checked `EvalContract`. |
| **Probe** | How to poke the system to produce evidence. Conceptually one diagnostic exercise: a test case, a call, a step. |
| **Observation** | What actually happened when the system was poked. The recorded status, headers, and body for one leg. |
| **Preflight** | Whether the environment and the observations are fit for meaningful measurement. It plans the legs a contract implies, reduces the observations handed to it, and mints a `PreflightVerdict`. |
| **Evidence** | The recorded output, trajectory, and artifacts from the evaluation run. What the oracles resolve against. |
| **Oracle** | The assertion. It states the relation that has to hold over the evidence. |
| **Rubric** | The grading guide. When scoring lands, it grades judgment-heavy quality against defined criteria. |
| **Score / verdict** | The combined result of the evaluation, and the answer to whether the evaluation caught the planted defect. |

Two entries above describe semantics the package does not execute yet. `compile` validates oracle structure and reachability today, and resolving an oracle over evaluator evidence to `true`, `false`, or `insufficient-evidence` belongs to the scoring path. `compile` also validates rubrics structurally, and no shipped stage grades with one. See the [roadmap](/explanation/roadmap/).

---

## The artifacts that carry the flow

The `Probe` schema is broader than the conceptual probe; `PreflightVerdict` is narrower than the conceptual verdict.

| Artifact | What it is |
| --- | --- |
| **`EvalContract`** | The compiled contract. `compile` emits it. |
| **`SealedEvaluatorBrief`** | What an evaluator is allowed to see. `seal` reduces a compiled contract to eleven top-level fields: `schemaVersion`, `parentDigest`, `revisionCount`, `contractDigest`, `behaviors`, `permittedInterfaces` narrowed to `logicalId` and `kind`, `scopedResources`, `budgets`, `safetyLimits`, `probeStepBound`, and `directions`. The oracle checks, the interaction plan, the reference sets, and the test data have no place in that shape, so they never reach the evaluator. |
| **`Probe` (schema)** | A corpus artifact carrying `probeClass`, `expectedClean`, `implementationDigest`, and `rationale`. |
| **Probe request** | The inputs for a single call: an interface, an operation, and the four transport channels. A sensitivity witness carries two legs of `legId` and `inputs`, and preflight combines each with the owning operation to derive the request. |
| **Preflight leg** | One planned unit inside a preflight run, correlated to an observation by `probeId`. A contract's sensitivity witnesses and control observations each contribute legs. |
| **`PreflightVerdict`** | The environment-validity result. It says whether the environment is fit to be measured. It is a different thing from the scored verdict at the end of the core flow, which is the next milestone. |

---

## The mutation loop

| Term | What it is |
| --- | --- |
| **System under test (SUT)** | The AI feature being evaluated: a model, an agent, a skill, a tool-use path, a workflow. |
| **Clean system** | The system with no planted defect. The evaluation should pass against it. |
| **Mutated system** | The same system with one deliberate defect planted. The evaluation should degrade against it. |
| **Planted defect (mutation)** | The one intentional change, whose expected failure mode is known in advance. A weakened prompt, removed context, a dropped validation step, an altered tool result, a swapped model. |
| **Blind spot** | An evaluation that stays green against a planted defect. The finding the twin run exists to produce. |
| **Twin run** | Running the same fixed evaluation against the clean and the mutated system and comparing the two results. |

The loop is drawn in full on [Behavioral Evaluation Contracts](/explanation/behavioral-evaluation-contracts/). Executing either arm is the caller's job.

---

## Jargon the reference pages use

These terms refine the nouns above.

| Term | Plain reading |
| --- | --- |
| **Sensitivity witness** | Two witness legs differing in one input channel, plus the relation that has to tell their responses apart. It proves the operation actually reads that input. The mutation idea applied to one operation at compile time. |
| **Discipline rule** | A compile-time rule beyond the schema. Together they are the lint pass over an eval design, rejecting the declaration defects they have rules for. |
| **Failure code** | The machine-readable name for a rejection, such as `undeclared-mandatory-input` or `unreachable-check-evidence`. Printed with the path inside the artifact so a caller can branch on it. |
| **Canonical serialization** | RFC 8785 JSON: one line with sorted keys. The digest is computed over exactly that payload, and `serializeArtifact` appends a line terminator that the digest does not cover. |
| **Lineage** | `parentDigest` and `revisionCount` on every lineage-bearing artifact, so a chain of revisions can be checked. `ArtifactReference` is the exception among the twelve interchange artifacts, since it points at an artifact rather than being a revision of one. |
| **Interaction plan** | The evidence-addressing steps a contract declares, with the bounded temporal relationships between them. `seal` withholds it, which is what makes a brief safe to hand to an evaluator that chooses its own probes. |

---

## Related pages

- [Behavioral Evaluation Contracts](/explanation/behavioral-evaluation-contracts/)
- [CLI reference](/reference/cli-commands/)
- [Author a Behavioral Evaluation Contract](/how-to/author-behavioral-contracts/)
