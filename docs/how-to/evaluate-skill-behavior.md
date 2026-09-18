---
title: "Evaluate Skill Behavior"
description: "Hold a skill responsible for a decision it alone owns, and watch the contract reject the degenerate answer that a weaker one would pass."
sidebar:
  order: 3
---

# Evaluate skill behavior

A skill is a unit of instruction an agent loads and acts on.
You never invoke it directly: you invoke an agent, hand it the skill's own rules, and hold the skill responsible for what comes back.

That shape maps to the `cli` interface kind, the same kind [agent behavior](/how-to/evaluate-agent-behavior/) uses, so a command runs the agent and the contract addresses what the command produced.
`compile` accepts `api`, `cli`, and `mcp`, and rejects a contract declaring `web` with `unsupported-interface-kind`.

This page is about the part that differs.
An agent-behavior contract asks whether the run did the right thing.
A skill-behavior contract has to answer the narrower question of whether the skill's instructions are what decided it, and it has to survive the cheapest way of faking that.

## The core problem: lazy shortcuts

Can a skill appear correct by returning everything instead of making the required selection?

When an agent loads a skill to select relevant rules, guidelines, or checklist items for a task, the easiest shortcut is to return every item in the index. An evaluator that checks only inclusion ("did it include the necessary items?") will pass that reply with flying colors. A disciplined evaluation contract must check exclusion ("did it omit forbidden or inapplicable items?") to detect the cheat.

```text
Honest selection (frontend case)
["interaction-rules", "timing-rules", "quality-rules"]
→ Inclusion (mandated items): PASS
→ Exclusion (forbidden items): PASS

Degenerate selection (all items)
["interaction-rules", "timing-rules", "quality-rules", "api-rules", "data-rules", "mobile-rules", "contract-rules"]
→ Inclusion (mandated items): PASS (names all three!)
→ Exclusion (forbidden items): FAIL (names forbidden items!)
```

This walkthrough uses a deterministic selector runner as a stand-in for an agent loaded with skill instructions. The decision being observed is the returned selection. The checklist selector makes this decision concrete, deterministic, and immediate without needing live LLM calls, network access, or model credentials.

You will run the selector runner locally to generate honest and degenerate outputs, compile the contract, run preflight checks against committed observations, and score two separate committed records: an honest clean-control record and a degenerate gameability record.

## The mini-lab

Work from a clone with the binary built:

```bash
git clone https://github.com/bmad-code-org/bmad-eval-quality.git
cd bmad-eval-quality
npm ci
npm run build
```

```bash
mkdir -p /tmp/eval-quality-skill
```

> **The twin-run discipline vs this mini-lab:** A full twin run evaluates both a clean baseline and an adversarial or mutated arm, asking whether the evaluation discriminates between them. This mini-lab scores an honest clean-control record and a degenerate gameability record against the same Behavioral Evaluation Contract (BEC). A gameability probe qualifies an adversarial or shortcut response without modifying source code, so its `defects` array is empty.

```text
Twin-run model

       Clean SUT (Honest)           Adversarial / Gameable Input
              ↓                                   ↓
       Evaluation (Clean)                Evaluation (Degenerate)
              ↓                                   ↓
        Score (Control)                     Score (Gameability)
              └───────────────┬───────────────────┘
                              ↓
              Did the evaluation discriminate?

This mini-lab

       Demonstrate runner & degenerate shortcut
                       ↓
              Compile BEC contract
                       ↓
              Preflight environment
                       ↓
            Score honest arm (clean control)
                       ↓
         Score degenerate arm (gameability probe)
                       ↓
            Evaluate discrimination
```

### 1. Run the skill and read its decision

> **Question:** What does an honest skill decision look like compared to a degenerate shortcut?

`examples/tutorials/skill/skill-runner.mjs` is a deterministic stand-in for an agent that loaded a checklist-selection skill.
It applies the skill's rules to a named case and prints the decision as JSON on standard output.

<!-- expect-exit: 0 -->

```bash
node examples/tutorials/skill/skill-runner.mjs --skill checklist-selection --case frontend
```

```text
{"selected":["interaction-rules","timing-rules","quality-rules"]}
```

<!-- expect-exit: 0 -->

```bash
node examples/tutorials/skill/skill-runner.mjs --skill checklist-selection --case backend
```

```text
{"selected":["api-rules","data-rules"]}
```

Two different cases, two different selections. That difference is the whole reason this is evaluable: the decision is attributable to the skill's rules rather than to anything the agent phrased.

Now the degenerate answer, which costs an agent nothing:

<!-- expect-exit: 0 -->

```bash
node examples/tutorials/skill/skill-runner.mjs --skill checklist-selection --case frontend --degenerate
```

```text
{"selected":["interaction-rules","timing-rules","quality-rules","api-rules","data-rules","mobile-rules","contract-rules"]}
```

It names every item in the index. Look at it against the honest answer:

```text
Rule Check              Honest Frontend Reply       Degenerate (All Items)
--------------------------------------------------------------------------
Inclusion (O-001)       PASSED (names all 3)        PASSED (names all 3!)
Exclusion (O-002)       PASSED (no forbidden items) FAILED (names forbidden)
```

The degenerate reply contains all three items the rules mandate for a frontend case (`interaction-rules`, `timing-rules`, `quality-rules`). An evaluation that only asks "did the run select everything it should have?" passes this degenerate answer. Catching the cheat requires an exclusion check that verifies forbidden items are omitted.

### 2. Compile the contract

> **Question:** How does the contract encode both inclusion and exclusion?

The contract is `corpus/dev/contracts/checklist-selection.json`, published in the package.

```bash
node dist/cli/main.js compile --in corpus/dev/contracts/checklist-selection.json --out /tmp/eval-quality-skill/eval-contract.json
```

Exit `0`.

It declares two behaviors over the frontend case, each with exactly one oracle:
* **O-001 (inclusion):** the selection named everything the rules mandate.
* **O-002 (exclusion):** the selection named nothing the rules forbid.

### 3. Preflight

> **Question:** Is the environment fit to be measured, and do different inputs produce different outputs?

Both arms are pre-flighted against the same observations, because pre-flight asks about the environment rather than about either reply.

> **Demonstration vs replay input:** The preflight commands below consume committed observations (`examples/tutorials/skill/observations.json`). In step 1, the demo runner accepted `--case frontend` for tutorial convenience. In the contract, the prompt is declared on `stdin.prompt`, matching how an evaluation harness feeds prompts to an agent. The committed `observations.json` file records that caller-side construction.

```bash
node dist/cli/main.js preflight \
  --contract corpus/dev/contracts/checklist-selection.json \
  --probes examples/tutorials/skill/probes.json \
  --observations examples/tutorials/skill/observations.json \
  --run-id skill-honest-1 \
  --out /tmp/eval-quality-skill/honest-preflight-verdict.json
```

```bash
node dist/cli/main.js preflight \
  --contract corpus/dev/contracts/checklist-selection.json \
  --probes examples/tutorials/skill/probes.json \
  --observations examples/tutorials/skill/observations.json \
  --run-id skill-degenerate-1 \
  --out /tmp/eval-quality-skill/degenerate-preflight-verdict.json
```

Both exit `0`, over four legs:

```bash
node -e "const v=require('/tmp/eval-quality-skill/honest-preflight-verdict.json');console.log('passed:',v.passed);for(const c of v.checks)console.log(c.kind,c.operationId,c.outcome)"
```

```text
passed: true
interface-present run-skill satisfied
input-sensitivity run-skill satisfied
state-reset null satisfied
clean-control null satisfied
```

#### What preflight just established

```text
Interface present (run-skill):               YES
Input sensitivity (frontend vs backend):     YES
State reset (stateless CLI):                 SATISFIED (null)
Clean control (baseline holds):              SATISFIED (null)
Environment fit to score:                    YES
```

`input-sensitivity` is the frontend and backend replies produced in step 1, read as evidence: two prompts differing in one case, and a declared relation saying the two selections have to differ. A skill whose selection is identical whichever case it is given is not reading the case.

> **Attribution boundary:** Showing sensitivity between two test cases in this deterministic fixture proves the environment is measurable and sensitive to inputs. It does not independently prove that a real LLM read a particular instruction or establish the skill's causal contribution against every alternative.

### 4. Score the honest reply

> **Question:** Does an honest reply pass clean controls without falsely inflating the defect catch rate?

```bash
node dist/cli/main.js score \
  --record examples/tutorials/skill/honest-run-record.json \
  --contract /tmp/eval-quality-skill/eval-contract.json \
  --probe examples/tutorials/skill/honest-probe.json \
  --preflight-verdict /tmp/eval-quality-skill/honest-preflight-verdict.json \
  --policy examples/tutorials/skill/scoring-policy.json \
  --isolation-manifest examples/tutorials/skill/honest-isolation-manifest.json \
  --evaluator-configuration examples/tutorials/skill/evaluator-configuration.json \
  --corpus-digest sha256:420b60b85130409fdc96a93a646ebc670ff9f4f9fc331b1e751afd4f31b48fc3 \
  --out /tmp/eval-quality-skill/honest-evidence-artifact.json
```

```bash
node -e "const e=require('/tmp/eval-quality-skill/honest-evidence-artifact.json');for(const o of e.outcomes)console.log(o.oracleId,o.state,o.disposition,o.corroboration);console.log(JSON.stringify(e.strength.vector))"
```

```text
O-001 passed-clean-control held agrees
O-002 passed-clean-control held agrees
{"defect":null,"gameability":null,"zero-action":null}
```

#### How to read this result

* **Mode:** `contract-scoring`.
* **Outcomes:** Both oracles held (`O-001 passed-clean-control`, `O-002 passed-clean-control`). The honest selection satisfies both inclusion and exclusion.
* **Strength vector:** All three components are `null`. The probe (`honest-probe.json`) is a clean control. Clean controls verify that an evaluation does not raise false alarms against correct behavior; they do not measure defect or gameability catch rates. A `null` entry signifies that no defect or gameability catch was measured in this arm—not a measured rate of zero.
* **Overall contract verdict:** `CONCERNS` (exit code `0`).
* **Verdict basis:**
  ```text
  coverage gap malformed-input unsatisfied at or above the severity floor
  coverage gap sibling-cross-check unsatisfied at or above the severity floor
  1 completed trials below the declared minimum of 3
  ```
* **Interpretation:** The honest reply was evaluated correctly. The contract-level `CONCERNS` verdict reflects structural properties of the contract itself: two unsatisfied coverage gaps and a trial count below the policy's minimum of 3.

### 5. Score the degenerate reply

> **Question:** Does the contract catch the all-items shortcut, and how does gameability scoring reflect it?

Same contract, same oracles, a different record and a `gameability` probe:

```bash
node dist/cli/main.js score \
  --record examples/tutorials/skill/degenerate-run-record.json \
  --contract /tmp/eval-quality-skill/eval-contract.json \
  --probe examples/tutorials/skill/degenerate-probe.json \
  --preflight-verdict /tmp/eval-quality-skill/degenerate-preflight-verdict.json \
  --policy examples/tutorials/skill/scoring-policy.json \
  --isolation-manifest examples/tutorials/skill/degenerate-isolation-manifest.json \
  --evaluator-configuration examples/tutorials/skill/evaluator-configuration.json \
  --corpus-digest sha256:420b60b85130409fdc96a93a646ebc670ff9f4f9fc331b1e751afd4f31b48fc3 \
  --out /tmp/eval-quality-skill/degenerate-evidence-artifact.json
```

```bash
node -e "const e=require('/tmp/eval-quality-skill/degenerate-evidence-artifact.json');for(const o of e.outcomes)console.log(o.oracleId,o.state,o.disposition,o.corroboration);console.log(JSON.stringify(e.strength.vector))"
```

```text
O-001 confirmed held agrees
O-002 caught violated agrees
{"defect":null,"gameability":{"caught":1,"exercised":1,"rate":1},"zero-action":null}
```

#### How to read this result

* **Mode:** `contract-scoring`.
* **Outcomes:**
  * `O-001 confirmed held agrees`: The inclusion oracle confirmed that the required frontend items were present.
  * `O-002 caught violated agrees`: The exclusion oracle caught the cheat because the degenerate response contained items forbidden for the frontend case.
* **Strength vector:** `gameability: {"caught": 1, "exercised": 1, "rate": 1}`. The gameability check was exercised once and caught the degenerate shortcut.
* **Overall contract verdict:** Still `CONCERNS` (exit code `0`), carrying the same contract-level verdict basis (coverage gaps and 1 trial vs minimum of 3).
* **Two separate conclusions:** The evaluation successfully detected the degenerate shortcut (`caught: 1, rate: 1`), while the contract overall still has coverage gaps and trial shortfalls.

### 6. The lesson, in two rows

Put the degenerate arm's two outcomes side by side:

```text
O-001 confirmed   the inclusion oracle HELD over a reply that named everything
O-002 caught      the exclusion oracle is what rejected it
```

**Gameability means an easy or degenerate strategy can satisfy a weak evaluator.**
A contract with O-001 alone would have reported this reply as correct, with a clean verdict and an inclusion oracle holding.
The contract earns its `gameability` rate of `1` because O-002 exists, and the probe is what proves it rather than asserting it.

The discipline that makes this work is narrow and it is enforced in code:

```text
one behavior
one oracle
one attributable decision
```

`designatedOracleIdOf` in `src/core/score/score.ts` pairs a probe with the oracle discharging the behavior the probe names, and it resolves that oracle **only** for a behavior declaring exactly one oracle, returning `null` otherwise (AD-40).
A behavior spread across two oracles has no designated oracle, so the witness match has nothing to attach a detection to.
That is why inclusion and exclusion are two behaviors here rather than two operands under one `all`.
In this implementation's attribution mechanism, this 1:1 pairing ensures detection credit is unambiguously attributed. It is an engineering requirement of eval-quality's attribution and scoring engine rather than a universal rule for all test design.

> **Scope boundary:** Fragment selection measures a specific selection decision. It does not establish the correctness of every final artifact produced by a complete workflow downstream.

## Key takeaways

* The checklist selector is a deterministic stand-in for an agent applying skill instructions.
* A degenerate "return everything" response satisfies weak inclusion checks; catching it requires an exclusion oracle.
* Clean controls verify baseline operation without false alarms; they contribute `null` to the strength vector rather than a zero detection rate.
* Gameability probes qualify shortcut responses without mutating source code (`defects: []`).
* Preflight verifies environment measurability and input sensitivity; it does not prove LLM comprehension.
* The evaluation caught the gameability defect (rate 1.0) while the contract overall earned `CONCERNS` due to coverage gaps and trial count.
* Fragment selection measures a specific selection decision; it does not establish overall workflow correctness.

---

> **You can stop here if you only wanted the hands-on tutorial.**
>
> Everything below is reference material for authors building skill evaluation contracts: response channels, artifact restrictions, interface declarations, and gameability qualification.

## What you are evaluating

The process you observe belongs to the agent, and the skill leaves no separate trace in it.
Attribution is therefore a design problem you solve in the contract before the run, and it has one move: name a decision the skill alone owns, and make the run print that decision.

TEA does this eight times over.
The skill's job in each of its eight fragment-selection contracts is fragment selection, so the contract asks which fragments the run selected.
The agent is free to phrase its reasoning any way it likes; the list it names is the skill's rules applied, and an item in that list the rules exclude is the skill's defect.

## What the run has to give you

A command operation declares one `responseDescriptor` and a `descriptorChannel` saying which output channel that descriptor describes (`src/core/schemas/interface.ts`).
The channel is either a stream, `stdout` or `stderr`, or a named artifact the operation writes.
Evidence pointers root at `/interactions/{stepId}/<channel>/...`, and the channels a command can produce are `stdout`, `stderr`, `exit-code`, and `artifact` (`COMMAND_RESPONSE_CHANNELS` in `src/core/schemas/pointer.ts`).

Print the decision as JSON on standard output, as the lab's runner does, for two reasons that are both enforced in code.

An operation carries exactly one descriptor, so an operation whose stream and whose written file both need declared structure is two operations (`CommandOperation` in `src/core/schemas/interface.ts`, following AD-19 fixing the descriptor per operation).

A defect signature cannot address a file the command wrote.
`qualifyProbe` refuses an `artifact` pointer under `condition-artifact-channel-contract-local`, because an artifact identifier is minted per contract and a signature carrying one resolves only against the contract it was authored on.
The refusal reads the channel of a condition's pointer and never reads the probe's class, so it lands the same way on every probe class.
A skill whose decision is visible only inside a written file can still carry oracles; it cannot carry any probe whose signature has to address that file, which is what makes those oracles worth trusting.

## Declaring the interface

The agent-behavior guide covers the general `cli` declaration, including the sensitivity witness every input-bearing operation owes.
Two fields carry the weight for a skill.

`invocation.executable` is a logical name (AD-35), and `Identifier` admits no slash, dot, or colon, so `./run-skill` and `/usr/local/bin/run-skill` are parse errors; mapping the name to something runnable lives in your harness.

The decision is usually a list, so declare it as one: a `collection` channel role and a `collectionLocations` entry with a cardinality bound.
The bound is what lets pre-flight and the coverage rules reason about a reply that names everything.

This interface parses against the published `EvalContract` schema and compiles at exit `0`:

```json
{
  "logicalId": "skill-runner",
  "kind": "cli",
  "operations": [
    {
      "operationId": "run-skill",
      "invocation": { "executable": "skill-runner", "subcommandPath": [] },
      "stateChangeMarker": false,
      "requestShape": {
        "argument": { "requiredKeys": [], "permittedKeys": [], "types": {} },
        "option": {
          "requiredKeys": ["skill"],
          "permittedKeys": ["skill", "agent"],
          "types": { "skill": "string", "agent": "string" }
        },
        "environment": { "requiredKeys": [], "permittedKeys": [], "types": {} },
        "stdin": {
          "requiredKeys": ["prompt"],
          "permittedKeys": ["prompt"],
          "types": { "prompt": "string" }
        }
      },
      "artifacts": [],
      "descriptorChannel": { "kind": "stream", "channel": "stdout" },
      "responseDescriptor": {
        "requiredKeys": ["selected"],
        "permittedKeys": ["selected"],
        "types": { "selected": "array" },
        "successIndicator": "/selected",
        "channelRoles": { "/selected": "collection" },
        "collectionLocations": [
          { "pointer": "/selected", "referenceSet": null, "expectedCardinality": { "mode": "at-most", "max": 40 } }
        ]
      },
      "volatilePointers": [],
      "sensitivityWitness": {
        "witnessId": "selection-follows-the-prompt",
        "channel": "stdin",
        "legs": [
          { "legId": "witness-frontend", "inputs": { "argument": {}, "option": { "skill": "checklist-selection" }, "environment": {}, "stdin": { "kind": "text", "value": "<the rules, then a frontend case>" } } },
          { "legId": "witness-backend", "inputs": { "argument": {}, "option": { "skill": "checklist-selection" }, "environment": {}, "stdin": { "kind": "text", "value": "<the same rules, then a backend case>" } } }
        ],
        "relation": {
          "op": "not",
          "operands": [
            { "op": "deep-equality", "operands": [
              { "pointer": "/interactions/witness-frontend/stdout/selected" },
              { "pointer": "/interactions/witness-backend/stdout/selected" }
            ] }
          ]
        }
      }
    }
  ]
}
```

The contract declares the case on `stdin`, where a real harness puts the rules and the case together in one prompt.
The lab's runner takes `--case` as an option instead, because a documented command that pipes its input cannot be executed by this repository's own invocation gate. The recorded `callInputs.stdin.prompt` in both run records carries the prompt the contract's plan binds.

## Writing an oracle about a skill

A skill-level claim names the decision and the input that should have produced it.
Every case needs two of them, because either one alone is trivially satisfiable.

The inclusion half says the run named everything the rules mandate:

```json
{
  "op": "containment",
  "operands": [
    { "pointer": "/interactions/frontend-case/stdout/selected" },
    { "literal": ["selector-resilience.md", "timing-debugging.md", "test-quality.md"] }
  ]
}
```

A reply naming every item in the index satisfies that check, which is exactly what the lab's degenerate run demonstrated.
The exclusion half is what rejects it:

```json
{
  "id": "O-002",
  "polarity": "expects-hold",
  "commentary": "The items the rules exclude for a frontend case. Containment alone is satisfied by a reply naming everything, so this is the half that discriminates.",
  "direction": {
    "polarity": "expects-hold",
    "relation": "not",
    "scope": "Every item returned for frontend-case, searched for any the rules exclude.",
    "negativeDomain": "A selection carrying mobile-flows.md or contract-testing.md.",
    "evidenceTargets": ["/interactions/frontend-case/stdout/selected"]
  },
  "check": {
    "op": "not",
    "operands": [
      {
        "op": "for-any",
        "collection": { "pointer": "/interactions/frontend-case/stdout/selected" },
        "predicate": {
          "op": "set-membership",
          "operands": [
            { "pointer": "@/" },
            { "literal": ["mobile-flows.md", "contract-testing.md"] }
          ]
        }
      }
    ]
  }
}
```

Each half gets its own behavior, so each has exactly one oracle and each can be the designated oracle of a probe.
TEA's eight contracts declare 48 behaviors and 48 oracles over 24 cases: the same case read twice, all the way down.

## Gameability probes

`probeClass: "gameability"` is the probe the lab scored in step 5, and its shape is worth knowing.

AD-9's gameability route qualifies a response, so the probe seeds no defect: `defects` is empty, and `admissibleRoutes` in `src/core/score/qualification.ts` admits the `gameability` route for that class and no other.
The route's record carries three fields (`src/core/schemas/probe-qualification.ts`): `degenerateResponse`, which describes the reply in prose because AD-8 keeps sealed-case content out of every artifact, and `naiveOracleSatisfiedEvidence` and `disciplinedOracleRejectedEvidence`, the two artifact references showing it passed one oracle and failed the other.

The probe's `defectSignature` turns the demonstration into a scored detection.
It declares the interface kind, the invocation, the observable channel, a selector over the inputs, and the condition that discriminates, which for a selection skill is the exclusion predicate rooted at the reserved step identifier `observed`.

`qualifyProbe` in `src/core/score/qualification.ts` is AD-9's gate over that signature, and it refuses more here than anywhere else, because a gameability probe is all signature and no seeded defect.
`QUALIFICATION_FAILURES`, exported from the package barrel, is the closed set of twenty reasons it can return.
Three that bite a skill contract, quoted from the gate:

```text
condition-selector-key-undeclared | operation "run-skill" declares "skil" in neither requiredKeys nor permittedKeys of its option channel, so this selector matches no observation and the probe can never be triggered (AD-4, AD-40)
condition-channels-underspecified | names "call-inputs", which is neither the declared observableChannel "stdout" nor two channels with a response-side member (AD-40)
qualification-route-incompatible | probeClass "defect" seeds a defect and this probe's defects array is empty, so no AD-9 route has a seeded defect to qualify (AD-9)
```

The first is a typo in the selector, which would have filtered out every candidate and reported the probe untriggered; the second is the "evidence contains the string I sent" condition, which decides nothing about the reply; the third is a class that owes a seeded defect with none declared.

The gate executes inside `score`, and `runScore` returns its `QualificationResult` beside the artifact and the ladder (`RunScoreResult` in `src/application/score.ts`), while the CLI writes one line per reason to stderr in the `eval-quality: <code>: <artifactPath>: <detail>` shape.
`declarationChecksRan` on that result reports whether the three declaration-dependent checks ran, since they read the home operation's declared shapes and are skipped when the caller qualifies against no inventory.

A rejected probe resolves an oracle to `infrastructure-error` wherever no higher-precedence condition already resolved that oracle, and that state lands the run on the Invalid rung: exit `3`, no artifact written, and the reasons on stderr.

## Where this stands

The lab above is the proof, and you can re-run it: the `cli` interface kind carries a skill's decision, the two-oracle case discriminates, and the gameability probe qualifies and scores against a published contract.
Both arms come back CONCERNS at exit `0`, on two coverage gaps and the trial-set shortfall, and the coverage gaps are findings about the contract rather than about the replies.

A seeded defect against the same contract is a second committed chain, at `_bmad-output/worked-examples/skill-defect/`, regenerated by `npm run generate:worked-example` and compared byte for byte on every validate.
Its probe seeds a run that exits `0` and names an item the rules exclude for the case, and `strength.vector.defect` reads `{"caught": 1, "exercised": 1, "rate": 1}`.
Its contract is the same object `corpus/dev/contracts/checklist-selection.json` publishes, so an adopter can hash the published bytes and get the `contractDigest` the chain's `sealed-run-record.json` carries. Strip the file's trailing newline first: `serializeArtifact` writes one and the digest is over the canonical bytes without it.

The lab reports one structural limit: a skill whose only deliverable is a written file cannot carry a qualifying defect signature, for the artifact-channel reason above. Plan the signature on `exit-code` or on the stream the descriptor nominates, which is what this contract does.

Each runnable score command above supplies one record, so each strength vector reports one completed trial. Repeat `--record` to meet the policy minimum. Every record carries a distinct `trialIndex`; every record agrees on `contractDigest`, `evaluatorConfigurationDigest`, `mode`, `evaluatorRecommendation`, and `runId`.

## In BMAD terms

TEA ships eight fragment-selection contracts under `test/contracts/fragment-selection/`, one per workflow skill that carries a knowledge index: `atdd`, `automate`, `ci`, `framework`, `nfr`, `test-design`, `test-review`, and `trace`.

They declare 48 behaviors, 48 oracles, and 24 interaction-plan steps between them, ranging from 4 behaviors over 2 cases (`ci`, `nfr`, `test-review`, `trace`) to 10 over 5 (`automate`, `test-design`).
All eight name one interface, `tea-fragment-selection-runner`, of kind `cli`, with one operation whose descriptor channel is `stdout` and whose one required key is `fragments`.

The corpus under `test/probes/fragment-selection/` is 16 probes: one gameability probe and one clean control per workflow.
The `atdd` probe's rationale states the trade directly: a run naming every fragment in the index satisfies `O-001` because every mandated fragment is in the list, and violates `O-002` because so is every forbidden one.

`test/probes/expected-strength.json` records what they score: all eight report `gameability` exercised `1`, caught `1`, rate `1`, and `defect` `null`.
All eight land on `CONCERNS` at exit `0`, on one basis, `coverage gap malformed-input unsatisfied at or above the severity floor`, which is a finding about the contracts recorded where a reader will meet it.

Every probe in that directory is generated by `tools/generate-probes.js` from the workflow's own eval sources, and `npm run test:probe-sources` fails when a file on disk differs from what its sources generate.
