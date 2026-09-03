---
title: "Behavioral Evaluation Contracts"
description: "The twin-run loop, what a Behavioral Evaluation Contract asserts, and why compile rejects what it rejects."
sidebar:
  order: 1
---

# Behavioral Evaluation Contracts

A Behavioral Evaluation Contract is a JSON document that declares what an agent or service is supposed to do, in terms an automated check can resolve. `eval-quality` compiles those documents, seals them, and checks that an environment is fit to be measured against one.

---

## Where this sits

Traditional testing runs a system through tests and gets pass or fail. AI evaluation runs a feature through an evaluation and gets a score with evidence. `eval-quality` sits one level up and evaluates the evaluation.

```text
  traditional testing    system      →  tests       →  pass / fail
  AI evaluation          AI feature  →  evaluation  →  score / evidence
                                          ↑
                            this layer is what eval-quality evaluates
```

"Evaluation" here means whatever mechanism runs the AI feature and judges its behavior: AgentEvals or another eval framework, your own harness, a skill-specific evaluator, custom evaluation code. `eval-quality` asks how to make that mechanism strong enough to trust as a test of AI behavior.

---

## The problem it addresses

**An evaluation can pass and prove nothing.** It can send one request, see something plausible come back, and report success while the failure it was written to catch sat right next to the thing it looked at. That is a blind spot, and nothing inside a green run reveals it.

Two ordinary evaluation styles make blind spots easy to acquire. String matching and regular expressions break the moment the agent reformats its output, so they get loosened until they stop discriminating. An LLM judge tolerates rewording, and it costs money per run and returns a different answer to the same input, so a green result carries no guarantee the next one repeats it.

A contract takes a third route. It declares the checkable structure ahead of the run, so every check resolves over declared shapes and stays deterministic and cheap. That is what makes it affordable to plant a defect and run the whole thing twice. [What a contract declares](#what-a-contract-declares) has the field list.

---

## The twin run

The way to find a blind spot is to plant one. Keep the evaluation fixed and change the system under test:

```text
        evaluation contract + probes + oracles + rubrics + scoring policy
                                    │
                  ┌─────────────────┴─────────────────┐
                  ↓                                   ↓
             clean system                       mutated system
         (no planted defect)               (one known planted defect)
                  ↓                                   ↓
           run the evaluation                 run the evaluation
                  ↓                                   ↓
              observations                       observations
                  ↓                                   ↓
          preflight  [ships]                 preflight  [ships]
              must pass                           must pass
                  ↓                                   ↓
               evidence                            evidence
                  ↓                                   ↓
      score / verdict  [written]         score / verdict  [written]
             should pass                       should degrade
                  └─────────────────┬─────────────────┘
                                    ↓
                       did the evaluation catch it?
                                    ↓
                      evidence of evaluation strength
```

This is the conceptual loop, drawn in core-flow order. Ownership splits three ways. `eval-quality` ships the `preflight` row and the `score / verdict` row today. Executing the two systems, running the evaluator, and collecting evidence belong to the caller.

The loop is drawn in the eight core-flow nouns, which is one level above the pipeline. The pipeline itself has six stages, and `ingest` sits between the caller's run record and the scoring rows: it validates a sealed run record against its isolation manifest and evaluator configuration, and records every cross-artifact inconsistency it finds. `ingest`, `score`, and `emit` all run behind the `score` command and its library entry, `runScore`.

Two of the boxes are easy to conflate: **observations** are probe results about environment fitness, which is what `preflight` reduces, and **evidence** is what the evaluation run itself produced. Oracles resolve over that evidence and rubrics grade it, between the `evidence` and `score / verdict` rows.

The mutation is one deliberate change that should make behavior worse, and you know in advance which failure it is supposed to create. Weaken the prompt, remove required context, drop a validation step, alter a tool's results, change the agent configuration, switch models.

Preflight has to pass on **both** arms. A mutated run that fails preflight tells you the environment was unfit, which is a different finding from the evaluation catching the defect, and mixing the two makes the comparison meaningless.

`seal` is what keeps the two arms comparable. The brief it emits carries twelve top-level fields: `schemaVersion`, `parentDigest`, `revisionCount`, `contractDigest`, `behaviors`, `permittedInterfaces`, `scopedResources`, `principals`, `budgets`, `safetyLimits`, `probeStepBound`, and `directions`, which is one prose direction per oracle. Each permitted interface narrows to its `logicalId` and `kind`. `principals` carries the declared test-data principal names and nothing else, so a direction can say which account it means and the caller knows which to provision; the name is an opaque label with no credential or account identifier behind it. The withholding is done by the brief's shape: the oracle checks, the interaction plan, the reference sets, and the rest of the test data have nowhere to go in it, so an evaluator reading a brief cannot read the answers off the contract.

The `contractDigest` binds the brief to the contract it came from, so comparing it across the two arms detects a rebound contract. It says nothing about the probes, the scoring policy, the evaluator configuration, the harness, or the model settings, which the caller has to hold fixed separately.

### A worked example

Requirement: invalid input returns an error, and no record is created.

Planted defect: the correct error is returned, and the record is created anyway.

- A **weak** evaluation checks only the response. It sees the error, and it passes. The defect ships.
- A **strong** evaluation checks the response and the resulting state. It finds the record, and it fails.

Run the same evaluation against the fixed implementation and it passes again. A trustworthy evaluation has to prove both directions: planted defect present, evaluation fails; clean implementation, evaluation passes. The core question is whether the evaluation reliably distinguishes bad behavior from good, whether that behavior belongs to a model, an agent, a skill, tool use, a workflow, or an end-to-end AI feature.

---

## What a contract declares

- **Behaviors**: what the system is supposed to do, each with a severity and an observable success criterion.
- **Oracles**: the checks themselves, written as relations over JSON pointers into recorded interactions.
- **Permitted interfaces**: every operation a probe may call, its request shape, its response descriptor, and the pointers whose values are volatile.
- **Sensitivity witnesses**: a pair of calls per operation that differ in one input channel, and the relation that has to distinguish their responses.
- **Reference sets, budgets, safety limits, and forbidden inputs**: the data a check reads and the bounds a run has to stay inside.

The full field list is on the [contract authoring page](/how-to/author-behavioral-contracts/), and `schemas/eval-contract.schema.json` is the normative shape. The core-flow terms are defined in the [glossary](/reference/glossary/).

---

## The three artifacts

```text
  authored contract (JSON)
          |
          |  compile: parse against EvalContract, then check the discipline rules
          v
     EvalContract
          |
          +---> seal: reduce to prose directions, bind the contract digest
          |            |
          |            v
          |     SealedEvaluatorBrief
          |
          +---> preflight: plan probe legs from the contract and the probe list,
                           reduce the observations the caller supplies
                           |
                           v
                    PreflightVerdict
```

`compile` produces the checked contract. `seal` turns it into a brief that an evaluator can be handed without seeing the checks. `preflight` answers a narrower question: is this environment in a state where a measurement would mean anything?

The package owns no network adapter. The CLI's `preflight` reduces observations the caller collected, and the library's `runPreflight` drives a caller-supplied `EnvironmentProbePort`, so every request that reaches a real system is issued by the caller's own code.

---

## Why compile rejects contracts

**Compile is type-checking for your eval design.** A contract can be valid JSON, parse cleanly against the schema, and still be incapable of proving anything. Compile catches the recognized cases of that before you spend a run on one, the same way a linter catches known defect patterns rather than every possible bug.

What it rejects is declaration defects it has a rule for: checks whose evidence path cannot exist, and operations that take an input without declaring the witness that would show the input matters. Whether a live operation actually responds to that witness is preflight's question.

Two examples, both shipped in the corpus:

- **A request key with no sensitivity witness.** The contract lets an operation take an input and never establishes that the operation reads it. A check over that operation passes while the input is ignored entirely, so the pass is worth nothing. The failure code is `undeclared-mandatory-input`. This one is gated on the default strict-input mode: `--no-strict-inputs` admits the same contract, and the [CLI reference](/reference/cli-commands/) has the flag.
- **An oracle addressing a request field the operation never declares.** The pointer resolves to nothing, so the assertion checks evidence that cannot exist. It can never fire, which makes it decoration. The failure code is `unreachable-check-evidence`.

Both are the blind-spot problem in miniature: an evaluation that reports success without having looked. Catching them at compile time is cheaper than catching them with a twin run.

`corpus/dev/contracts/` holds nineteen contracts covering each rule in each declaration state, which makes the rule set readable as examples.

---

## Design commitments

- **The package runs nothing under evaluation.** No agent, no judge, no system under test. Compile, seal, and the verdict reduction are pure transformations, and every artifact they read or write is JSON, so those stages are deterministic. `runPreflight` awaits a caller-supplied port, so what it observes is only as steady as the environment behind that port. Holding the rest of the run steady across the two arms is the caller's job: model sampling, evaluator behavior, fixture state, trial policy, and configuration all have to be controlled, or the comparison measures those instead of the planted defect.
- **Canonical serialization.** Artifacts serialize to RFC 8785 canonical JSON, one line with sorted keys, and the digest is computed over exactly that payload, so two machines agree on the identity of an artifact. The serializer appends a line terminator after the payload, and the digest does not cover it.
- **Lineage.** Every lineage-bearing artifact carries `parentDigest` and `revisionCount`, and `validateLineageChain` checks a chain of them.
- **Failure codes over prose.** A rejection names a code and a path inside the artifact, so a caller can branch on the code.

---

## Scoring

Scoring is the comparison step at the bottom of the twin run. The `score` command and its library entry, `runScore`, chain `ingest`, `score`, and `emit` over a sealed run record, an isolation manifest, an evaluator configuration, the compiled contract, a probe, a preflight verdict, and a scoring policy, and mint a versioned `EvidenceArtifact` carrying the AD-21 verdict. `compile` checks a contract's rubrics structurally, so a rubric that scores reasoning prose or cites unreachable evidence is rejected, and `score` reads a declared rubric to decide whether a judge's conduct was conforming or malformed. `schemas/scoring-policy.schema.json` is published, and `score` is the stage that consumes it. Exit codes 1 and 2, reserved for a scored verdict, and `--strict`'s promotion of a CONCERNS, are both reachable through `score`.

The [roadmap](/explanation/roadmap/) records what ships today, what is next, and what the next release breaks.
