---
title: "Glossary"
description: "Every noun the tool uses: the core flow, the interchange artifacts, the scoring vocabulary, and the mutation-loop terms."
sidebar:
  order: 1
---

# Glossary

## The core flow

Every run of an evaluation walks the same eight nouns, in this order:

```text
eval contract → probe → observation → preflight → evidence → oracle → rubric → score / verdict
```

| Term | What it is |
| --- | --- |
| **Eval contract** | What we want to measure. A JSON document declaring the behaviors, the checks, the interfaces a probe may touch, and the bounds a run stays inside. `compile` turns an authored one into a checked `EvalContract`. The long name is Behavioral Evaluation Contract. |
| **Probe** | How to poke the system to produce evidence: a test case, a call, a step. In scoring, a probe is also the artifact that names the defect it seeded, so a finding can be matched against it. |
| **Observation** | What actually happened when the system was poked. For an api interface, the recorded status, headers, and body of one call; for a command, the exit code, the two streams, and the files it wrote. |
| **Preflight** | Whether the environment and the observations are fit for meaningful measurement. It plans the legs a contract implies, reduces the observations handed to it, and mints a `PreflightVerdict`. |
| **Evidence** | The recorded output, trajectory, and artifacts from the evaluation run: what the oracles resolve against. It reaches `score` sealed inside a **sealed run record**. The **evidence artifact** is the output side, the thing `score` mints, and it is a different artifact. |
| **Oracle** | The assertion. It states the relation that has to hold over the evidence. |
| **Rubric** | The grading guide for judgment-heavy quality: an anchored scale and named criteria a judge scores against. The judge runs outside this package, and its scores arrive inside the sealed run record, one integer per criterion. `compile` checks a rubric's structure and no shipped stage grades anything against one. |
| **Score / verdict** | The combined result, and the answer to whether the evaluation caught the planted defect. Four values: `PASS`, `WAIVED`, `CONCERNS`, `FAIL`. A fifth outcome, Invalid, says the run produced no verdict. The `score` command writes it into the evidence artifact and returns it as the exit code. |

## The twelve interchange artifacts

Every artifact that crosses the package boundary has a published JSON Schema under `schemas/` and exactly one producer. Four are minted by a stage, seven come from the caller, and one is embedded inside others.

| Artifact | Produced by | What it is |
| --- | --- | --- |
| **`EvalContract`** | `compile` | The compiled contract. |
| **`SealedEvaluatorBrief`** | `seal` | What an evaluator is allowed to see. Twelve top-level fields: the behaviors, the permitted interfaces narrowed to `logicalId` and `kind`, the scoped resources, the declared principal names, the budgets and limits, the probe step bound, one direction per oracle, `contractDigest`, and the lineage and version fields. The oracle checks, the interaction plan, the reference sets, and the rest of the test data have no place in that shape, so they never reach the evaluator. |
| **`PreflightVerdict`** | `preflight` | The environment-validity result: `passed`, the list of checks with each one's outcome, and `fixtureDigest`. `score` reads `passed` off it, and a failed preflight is an Invalid rung. |
| **`EvidenceArtifact`** | `emit`, inside `score` | The output side of scoring: the outcome per oracle, the verdict with every condition that fired, the strength vector, the coverage gaps, the trial count, the scoring version, and the exit code. |
| **`Probe`** | caller | One probe: its id, its class, `expectedClean`, the implementation digest, a rationale, a required qualification record, and, when `expectedClean` is false, a `defectSignature` describing where the seeded defect shows. |
| **`SealedRunRecord`** | caller | The input side of scoring: what the evaluator's run produced, sealed. The observations in `sequence` order, the findings with the observations each cites, one disposition per oracle, the judge results, the evaluator's own recommendation, `mode`, and the digests it ran under. |
| **`IsolationManifest`** | caller | What the evaluator was allowed and what it did: allowed and observed mounts, network targets, and tool calls, resource ceilings and actual use, and an accounting of every forbidden input as withheld. |
| **`EvaluatorConfiguration`** | caller | What the evaluator was: identity, model snapshot, system-prompt digest, decoding parameters, tool and permission inventories, budgets, and judge configuration. |
| **`ScoringPolicy`** | caller | The thresholds `score` reads: severity floor, confidence threshold, catch threshold, minimum trial count, re-execution cap, remediation cap, and regex match-step budget. |
| **`Rubric`** | caller | A rubric body, also declared inline in a contract's `rubrics` array. |
| **`PrivateArtifactManifest`** | caller | Entries naming private references with their declared digests. `score` checks each against the bytes `--corpus-root` resolves. |
| **`ArtifactReference`** | embedded | A pointer to an artifact by digest, public with a path or private with an opaque reference. It carries no `schemaVersion` and no lineage, since it is never exchanged alone. |

## Scoring vocabulary

Every term here names something the `score` command and its library entry, `runScore`, implement. They appear in CLI output and in the generated decision tables.

| Term | What it is |
| --- | --- |
| **Ingest** | The stage between preflight and score. It validates the sealed run record against its isolation manifest and evaluator configuration, checks that every citation names an observation that exists and every forbidden input is accounted for as withheld, and records every inconsistency as a condition. Every condition lands on the Invalid rung. |
| **Finding** | One claim the evaluator wrote into the run record: a `defect`, a `confirmation`, or an `observation`, with a severity, a confidence, and the observations it cites. A finding that cites no oracle is recorded as uncited. |
| **Disposition** | The evaluator's own call on one oracle: `held`, `violated`, or `not-attempted`, with the observations it cites. `score` corroborates it against what the check itself resolved. |
| **Outcome state** | What one oracle check resolved to, from a closed set of twelve: `caught`, `confirmed`, `missed`, `passed-clean-control`, `false-positive`, `abstained`, `bypassed`, `unreached`, `oracle-error`, `judge-error`, `infrastructure-error`, and `not-applicable`. The decision procedure is published at the AD-33 outcome decision table at `/ad33-outcome-decisiongenerated/`. |
| **Defect detection** | Whether a finding actually detected the defect its probe seeded. Decided by matching the probe's declared defect signature against the observations the finding cites. The evaluator's own claim does not settle it. |
| **Trial set** | Several runs of one probe. They reduce to one result per probe before any rate is computed, because a pass-if-any reading is the retry anti-pattern. The `score` stage takes a trial set; the command hands it one record per call. |
| **Contract strength** | How good an eval contract is at catching defects, reported as a vector. Per probe class it is the catch rate: unique qualified probes resolving `caught` over unique qualified probes exercised. |
| **Dominance** | How two contract-strength vectors compare. Four-valued: one dominates the other, the reverse, equivalent, or incomparable. A contract that missed a behavior at or above the severity floor never dominates one that caught it. |
| **Verdict ladder** | The total, first-match-wins decision from outcome states to a verdict, in the order Invalid, FAIL, CONCERNS, WAIVED, PASS. There are two, one per run mode, published at the AD-21 verdict decision table at `/ad21-verdict-decisiongenerated/`. |
| **Run mode** | Whether the subject is the system or the contract. In `production` the verdict answers whether the system is shippable. In `contract-scoring` the probe is knowingly defective, so a caught defect is the contract succeeding, and the evaluator's recommendation is never promoted. Both arms of a twin run are `contract-scoring`. The mode is part of the scoring version, so results from the two modes never compare. |
| **Evidence condition** | A firing condition saying the measurement was thinner than the policy asked for. Falling short of the minimum trial count and an oracle resolving `unreached` are the two. `--strict` never promotes a CONCERNS whose conditions are all of this kind. |
| **Scoring version** | The identity of a scored result: the digest of six inputs, the contract schema version, the corpus digest, the fixture digest, the evaluator configuration digest, the scoring policy digest, and the run mode. Two results are comparable only when their scoring versions agree. |
| **Caller-attested** | A scoring-version input no artifact in the pipeline carries, so the caller supplies it and the artifact records it as such. `--corpus-digest` is the one on the command line. |
| **Coverage gap** | A discipline rule that is relevant to a contract and not satisfied by it. Recorded, and below the severity floor it does not move the verdict. The fourteen predicates that decide relevance and satisfaction are published at the AD-31 coverage predicate table at `/ad31-coverage-predicatesgenerated/`. |
| **Probe class** | What a probe is for: `defect`, `gameability`, `zero-action`, or `canary`. Canary probes and clean controls never enter the strength vector. |
| **Waiver** | A recorded, conditional exemption from a discipline rule, carrying the rule name, a rationale, a machine-checkable condition, and an approval. An expired waiver reinstates its gap. |

## Preflight check kinds

The six kinds a `PreflightVerdict` can carry.

| Kind | What it asks |
| --- | --- |
| `interface-present` | Is the declared interface reachable at all? |
| `input-sensitivity` | Does changing the input change the output, so the system is actually reading it? |
| `state-reset` | Does the declared fixture reset return the system to a known state? |
| `clean-control` | Does the leg that should show nothing wrong in fact show nothing wrong? |
| `seeded-fault-fired` | Did the seeded fault manifest where it was supposed to? |
| `seeded-faults-scoped` | Did a manifestation witness fire on a clean leg, where it should not have? A clean leg is one that asks a different question, so a leg that sent the fault leg's request and got back the fault leg's answer is left out. With no clean leg left to ask, this fails and says why. |

## Contract vocabulary

| Term | What it is |
| --- | --- |
| **Sensitivity witness** | Two witness legs differing in one input channel, plus the relation that has to tell their responses apart. It proves the operation actually reads that input. The mutation idea applied to one operation at compile time. |
| **Discipline rule** | A compile-time rule beyond the schema. Together they are the lint pass over an eval design, rejecting the declaration defects they have rules for. |
| **Failure code** | The machine-readable name for a rejection, such as `undeclared-mandatory-input` or `unreachable-check-evidence`. Printed with the path inside the artifact so a caller can branch on the code. |
| **Interface kind** | What sort of surface an interface is. `compile` accepts `api`, a system behind an HTTP API, and `cli`, a system behind a command. The vocabulary also names `web` and `mcp`, and a contract declaring either is rejected with `unsupported-interface-kind`. |
| **Interaction plan** | The evidence-addressing steps a contract declares, with the bounded temporal relationships between them. `seal` withholds it, which is what makes a brief safe to hand to an evaluator that chooses its own probes. |
| **Forbidden inputs** | The seven things an evaluator may not be given, named one by one, because "the evaluator saw the answer key" is the failure that invalidates everything downstream. The isolation manifest accounts for each one as withheld. |
| **Scoped resources** | The resources a run is confined to, so a probe cannot reach past what the contract declared. |
| **Sibling groups** | Declared sets of related items, which several discipline rules read when deciding whether a contract's coverage is complete. |
| **Probe step bound** | The ceiling on how many steps a probe may take. It travels into the sealed brief, so the evaluator sees the bound it is held to. |
| **Strict-input mode** | The compiler mode, on by default, that fails a contract declaring an input it did not witness. `--strict-inputs` and `--no-strict-inputs` select it. |
| **Canonical serialization** | RFC 8785 JSON: one line with sorted keys. The digest is computed over exactly that payload, and the serializer appends a line terminator that the digest does not cover. |
| **Lineage** | `parentDigest` and `revisionCount` on every lineage-bearing artifact, so a chain of revisions can be checked. |
| **AD-nn** | An architecture decision, numbered. They appear in real CLI output and in the generated table names. Each one fixes a rule the code is checked against. |

## The mutation loop

| Term | What it is |
| --- | --- |
| **System under test (SUT)** | The AI feature being evaluated: a model, an agent, a skill, a tool-use path, a workflow. |
| **Clean system** | The system with no planted defect. The evaluation should pass against it. Its probe is a clean control, `expectedClean: true`. |
| **Mutated system** | The same system with one deliberate defect planted. The evaluation should degrade against it. Its probe declares the defect, `expectedClean: false`, with a defect signature. |
| **Planted defect (mutation)** | The one intentional change, whose expected failure mode is known in advance. A weakened prompt, removed context, a dropped validation step, an altered tool result, a swapped model. |
| **Blind spot** | An evaluation that stays green against a planted defect. The finding the twin run exists to produce. |
| **Twin run** | Running the same fixed evaluation against the clean and the mutated system and comparing the two results. Both arms are scored in `contract-scoring` mode. |
