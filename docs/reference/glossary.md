---
title: "Glossary"
description: "The core flow in eight nouns, the supporting artifacts, the mutation-loop terms, and the jargon the reference pages use."
sidebar:
  order: 1
---

# Glossary

---

## The core flow

Eight nouns, in the order they occur in a run. They sit one level above the six pipeline stages, which is why `ingest` appears in the scoring table below and not here.

| Term | What it is |
| --- | --- |
| **Evaluation contract** | What we want to measure. A JSON document declaring the behaviors, the checks, the interfaces a probe may touch, and the bounds a run stays inside. `compile` turns an authored one into a checked `EvalContract`. |
| **Probe** | How to poke the system to produce evidence. Conceptually one diagnostic exercise: a test case, a call, a step. |
| **Observation** | What actually happened when the system was poked. The recorded status, headers, and body for one leg. |
| **Preflight** | Whether the environment and the observations are fit for meaningful measurement. It plans the legs a contract implies, reduces the observations handed to it, and mints a `PreflightVerdict`. |
| **Evidence** | The recorded output, trajectory, and artifacts from the evaluation run. What the oracles resolve against. |
| **Oracle** | The assertion. It states the relation that has to hold over the evidence. |
| **Rubric** | The grading guide. When scoring lands, it grades judgment-heavy quality against defined criteria. |
| **Score / verdict** | The combined result of the evaluation, and the answer to whether the evaluation caught the planted defect. Four values: `PASS`, `WAIVED`, `CONCERNS`, `FAIL`. A fifth outcome, Invalid, says the run produced no verdict. |

`compile` validates oracle structure and reachability, and the `score` command resolves an oracle over evaluator evidence to `true`, `false`, or `insufficient-evidence`. `compile` also validates rubrics structurally, and `score` reads a declared rubric to classify a judge's own conduct as conforming or malformed; grading a subject against a rubric's criteria stays undone. See the [roadmap](/explanation/roadmap/).

---

## The artifacts that carry the flow

The `Probe` schema is broader than the conceptual probe; `PreflightVerdict` is narrower than the conceptual verdict.

| Artifact | What it is |
| --- | --- |
| **`EvalContract`** | The compiled contract. `compile` emits it. |
| **`SealedEvaluatorBrief`** | What an evaluator is allowed to see. `seal` reduces a compiled contract to twelve top-level fields: `schemaVersion`, `parentDigest`, `revisionCount`, `contractDigest`, `behaviors`, `permittedInterfaces` narrowed to `logicalId` and `kind`, `scopedResources`, `principals`, `budgets`, `safetyLimits`, `probeStepBound`, and `directions`. `principals` carries the declared test-data principal names, which are opaque labels; the oracle checks, the interaction plan, the reference sets, and the rest of the test data have no place in that shape, so they never reach the evaluator. |
| **`Probe` (schema)** | A corpus artifact. Among its fields: `probeId`, `probeClass`, `expectedClean`, `implementationDigest`, `rationale`, a required `qualification` record, and, on the `expectedClean: false` branch, a required `defectSignature`. The last two are newer than the rest and are a breaking addition; see `CHANGELOG.md`. |
| **Probe request** | The inputs for a single call: an interface, an operation, and the four transport channels. A sensitivity witness carries two legs of `legId` and `inputs`, and preflight combines each with the owning operation to derive the request. |
| **Preflight leg** | One planned unit inside a preflight run, correlated to an observation by `probeId`. A contract's sensitivity witnesses and control observations each contribute legs. |
| **`PreflightVerdict`** | The environment-validity result. It says whether the environment is fit to be measured. It is a different thing from the scored verdict at the end of the core flow, which the `score` command mints as an `EvidenceArtifact`. |

---

## Scoring vocabulary

Every term here names something implemented in `src/core/score/` and reachable through the `score` command and its library entry, `runScore`. They appear in CLI output, in the generated reference tables, and on the other pages, so they are defined here.

| Term | What it is |
| --- | --- |
| **Contract strength** | How good an evaluation contract is at catching defects, reported as a vector. Per probe class it is the catch rate: unique qualified probes resolving `caught` over unique qualified probes exercised, across the declared trial count. |
| **Defect detection** | Whether a finding actually detected the defect its probe seeded. Decided by matching the probe's declared defect signature against the observations the finding cites. The evaluator's own claim does not settle it. |
| **Dominance** | How two contract-strength vectors compare. Four-valued: one dominates the other, the reverse, equivalent, or incomparable. A contract that missed a behavior at or above the severity floor never dominates one that caught it. |
| **Outcome state** | What one oracle check resolved to, from a closed set of twelve. The full decision procedure is published at the AD-33 outcome decision table at `/ad33-outcome-decisiongenerated/`. |
| **Verdict ladder** | The total, first-match-wins decision from outcome states to a verdict. There are two, one per run mode, published at the AD-21 verdict decision table at `/ad21-verdict-decisiongenerated/`. |
| **Run mode** | Whether the subject is the system or the contract. In `production` the verdict answers whether the system is shippable. In `contract-scoring` the probe is knowingly defective, so a caught defect is the contract succeeding. The two verdicts share no field. |
| **Trial set** | Several runs of one probe. They reduce to one result per probe before any rate is computed, because a pass-if-any reading is the retry anti-pattern the architecture forbids. |
| **Evidence condition** | A firing condition saying the measurement was thinner than the policy asked for. Falling short of the minimum trial count and an oracle resolving `unreached` are the two. `--strict` never promotes a CONCERNS whose conditions are all of this kind. |
| **Scoring version** | The identity of a scored result. Two results are comparable only when their scoring versions agree, and the run mode is one of its inputs. |
| **Coverage gap** | A discipline rule that is relevant to a contract and not satisfied by it. Recorded, and below the severity floor it does not move the verdict. The fourteen predicates that decide relevance and satisfaction are published at the AD-31 coverage predicate table at `/ad31-coverage-predicatesgenerated/`. |
| **Probe class** | What a probe is for: `defect`, `gameability`, `zero-action`, or `canary`. Canary probes and clean controls never enter the strength vector. |
| **Waiver** | A recorded, conditional exemption from a discipline rule, carrying the rule name, a rationale, a machine-checkable condition, and an approval. An expired waiver reinstates its gap. |
| **Ingest** | The stage that turns a caller's sealed run record, isolation manifest, and evaluator configuration into validated observations, recording every cross-artifact inconsistency it finds as data. Runs first inside the `score` command; not published as a standalone entry point. |

---

## Preflight check kinds

The six kinds a `PreflightVerdict` can carry. A run of the worked example emits four of them.

| Kind | What it asks |
| --- | --- |
| `interface-present` | Is the declared interface reachable at all? |
| `input-sensitivity` | Does changing the input change the output, so the system is actually reading it? |
| `state-reset` | Does the declared fixture reset return the system to a known state? |
| `clean-control` | Does the leg that should show nothing wrong in fact show nothing wrong? |
| `seeded-fault-fired` | Did the seeded fault manifest where it was supposed to? |
| `seeded-faults-scoped` | Did a manifestation witness fire on a clean leg, where it should not have? A leg with no observation cannot fire one, so a missing clean leg leaves this `satisfied`. |

---

## Contract fields the authoring guide names

| Term | What it is |
| --- | --- |
| **Forbidden inputs** | The seven things an evaluator may not be given, named one by one, because "the evaluator saw the answer key" is the failure that invalidates everything downstream. |
| **Scoped resources** | The resources a run is confined to, so a probe cannot reach past what the contract declared. |
| **Sibling groups** | Declared sets of related items, which several discipline rules read when deciding whether a contract's coverage is complete. |
| **Probe step bound** | The ceiling on how many steps a probe may take. It travels into the sealed brief, so the evaluator sees the bound it is held to. |
| **Strict-input mode** | The compiler mode, on by default, that fails a contract declaring an input it did not declare. `--strict-inputs` and `--no-strict-inputs` select it; `preflight` accepts neither, having no compile step. |
| **AD-nn** | An architecture decision, numbered. They appear in real CLI output and in the generated table names. Each one fixes a rule the code is checked against; the decisions live in the architecture spine in this repository. |

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
