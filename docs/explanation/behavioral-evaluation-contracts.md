---
title: "Behavioral Evaluation Contracts"
description: "What a Behavioral Evaluation Contract asserts, why compile rejects what it rejects, and how the three artifacts relate."
sidebar:
  order: 1
---

# Behavioral Evaluation Contracts

A Behavioral Evaluation Contract is a JSON document that declares what an agent or service is supposed to do, in terms an automated check can resolve. `eval-quality` compiles those documents, seals them, and checks that an environment is fit to be measured against one.

---

## The problem it addresses

A deterministic unit test compares an exact value. An agent produces text that varies run to run while meaning the same thing, so an exact comparison fails on a rewording and passes on a plausible lie.

The two common workarounds each give something up. String matching and regular expressions break the moment the agent reformats its output. An LLM judge tolerates rewording, and it costs money per run and returns a different answer to the same input.

A contract takes a third route. It declares, ahead of the run, what interfaces exist, what each operation accepts and returns, which pointers into a response carry meaning, and what relation over those pointers has to hold. Every check is then a resolution over declared structure, so it is deterministic and it is cheap.

---

## What a contract declares

- **Behaviors**: what the system is supposed to do, each with a severity and an observable success criterion.
- **Oracles**: the checks themselves, written as relations over JSON pointers into recorded interactions.
- **Permitted interfaces**: every operation a probe may call, its request shape, its response descriptor, and the pointers whose values are volatile.
- **Sensitivity witnesses**: a pair of calls per operation that differ in one input channel, and the relation that has to distinguish their responses.
- **Reference sets, budgets, safety limits, and forbidden inputs**: the data a check reads and the bounds a run has to stay inside.

The full field list is on the [contract authoring page](/how-to/author-behavioral-contracts/), and `schemas/eval-contract.schema.json` is the normative shape.

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

`compile` produces the checked contract. `seal` turns it into a brief that an evaluator can be handed without seeing the checks, holding the contract digest so the brief cannot be silently rebound to a different contract. `preflight` answers a narrower question: is this environment in a state where a measurement would mean anything?

The package never issues a request. `preflight` plans the legs and reduces the observations something else collected.

---

## Why compile rejects contracts

Compilation is where a contract earns the right to be used. A contract that parses can still be undecidable in practice, and the discipline rules catch that class before a run happens.

Two examples, both shipped in the corpus:

- **An operation that declares request keys and no sensitivity witness.** Nothing would establish that the operation reads its input at all, so a passing check would prove nothing. The failure code is `undeclared-mandatory-input`.
- **An oracle addressing a request field the operation never declares.** The pointer resolves to nothing, so the check can never fire. The failure code is `unreachable-check-evidence`.

`corpus/dev/contracts/` holds nineteen contracts, one per rule in each declaration state, which makes the rule set readable as examples.

---

## Design commitments

- **The package executes nothing.** No agent, no judge, no system under test. Inputs arrive as JSON and outputs leave as JSON, which is what keeps a run reproducible.
- **Canonical serialization.** Artifacts serialize to one line with sorted keys, and the digest is computed over exactly those bytes, so two machines agree on the identity of an artifact.
- **Lineage.** Every artifact carries `parentDigest` and `revisionCount`, and `validateLineageChain` checks a chain of them.
- **Failure codes over prose.** A rejection names a code and a path inside the artifact, so a caller can branch on the code.

---

## What is not implemented

Scoring. Nothing in this release measures contract strength, defect detection, or oracle effectiveness. `compile` checks a contract's rubrics structurally, so a rubric that scores reasoning prose or cites unreachable evidence is rejected, and no stage then uses a rubric to produce a score. `schemas/scoring-policy.schema.json` is published and no code consumes it. Exit codes 1 and 2 are reserved for a scored verdict and no command reaches them.

The [roadmap](/explanation/roadmap/) records where that stands.
