---
title: "Evaluate Skill Behavior"
description: "Hold a skill responsible for a decision an agent carried out, and prove the contract can tell a real answer from a degenerate one."
  order: 3
sidebar:
  order: 3
---

# Evaluate skill behavior

A skill is a unit of instruction an agent loads and acts on.
You never invoke it directly: you invoke an agent, hand it the skill's own rules, and hold the skill responsible for what comes back.
That shape maps to the `cli` interface kind, the same kind [agent behavior](/how-to/evaluate-agent-behavior/) uses, so a command runs the agent and the contract addresses what the command produced.

This page is about the part that differs: an agent-behavior contract asks whether the run did the right thing, and a skill-behavior contract has to answer the narrower question of whether the skill's instructions are what decided it.

## What you are evaluating

The process you observe belongs to the agent, and the skill leaves no separate trace in it.
Attribution is therefore a design problem you solve in the contract before the run, and it has one move: name a decision the skill alone owns, and make the run print that decision.

TEA does this eight times over.
The skill's job in each of its eight fragment-selection contracts is fragment selection, so the contract asks which fragments the run selected.
The agent is free to phrase its reasoning any way it likes; the list it names is the skill's rules applied, and an item in that list the rules exclude is the skill's defect.

Scoring enforces the same narrowness structurally.
`designatedOracleIdOf` in `src/core/score/score.ts` pairs a probe with the oracle discharging the behavior the probe names, and it resolves that oracle **only** for a behavior declaring exactly one oracle, returning `null` otherwise (AD-40).
A behavior spread across two oracles has no designated oracle, so the witness match has nothing to attach a detection to.
One behavior, one oracle, one probe is what makes an outcome traceable back to a rule the skill states.

## What the run has to give you

A command operation declares one `responseDescriptor` and a `descriptorChannel` saying which output channel that descriptor describes (`src/core/schemas/interface.ts`).
The channel is either a stream, `stdout` or `stderr`, or a named artifact the operation writes.
Evidence pointers root at `/interactions/{stepId}/<channel>/...`, and the channels a command can produce are `stdout`, `stderr`, `exit-code`, and `artifact` (`COMMAND_RESPONSE_CHANNELS` in `src/core/schemas/pointer.ts`).

Print the decision as JSON on standard output, for two reasons that are both enforced in code.

An operation carries exactly one descriptor, so an operation whose stream and whose written file both need declared structure is two operations (`CommandOperation` in `src/core/schemas/interface.ts`, following AD-19 fixing the descriptor per operation).

A defect signature cannot address a file the command wrote.
`qualifyProbe` refuses an `artifact` pointer under `condition-artifact-channel-contract-local`, because an artifact identifier is minted per contract and a signature carrying one resolves only against the contract it was authored on.
A skill whose decision is visible only inside a written file can still carry oracles; it cannot carry the gameability probe that makes those oracles worth trusting.

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

The witness here is the skill-level version of the sensitivity idea: two prompts differing in one case, and a declared relation saying the two selections have to differ.
A skill whose selection is identical whichever case it is given is not reading the case.

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

A reply naming every item in the index satisfies that check.
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

The degenerate answer to a selection question is to name everything: it costs the agent nothing, it satisfies a containment oracle, and it is exactly what a weak contract rewards.
A skill contract needs a probe demonstrating that the exclusion half catches it, and `probeClass: "gameability"` is that probe.

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

## Running it

Pre-flight first, over the contract, the probes, and the observations your harness collected:

```bash
eval-quality preflight \
  --contract eval-contract.json \
  --probes probes.json \
  --observations observations.json \
  --run-id skill-1 \
  --out preflight-verdict.json
```

Then score one sealed run record against the probe it was run against:

```bash
eval-quality score \
  --record sealed-run-record.json \
  --contract eval-contract.json \
  --probe gameability-probe.json \
  --preflight-verdict preflight-verdict.json \
  --policy scoring-policy.json \
  --isolation-manifest isolation-manifest.json \
  --evaluator-configuration evaluator-configuration.json \
  --corpus-digest <digest> \
  --out evidence-artifact.json
```

Every flag and every exit code is in the [CLI reference](/reference/cli-commands/).
A rejected probe resolves an oracle to `infrastructure-error` wherever no higher-precedence condition already resolved that oracle, and that state lands the run on the Invalid rung: exit `3`, no artifact written, and the reasons on stderr.

## Where this stands

Proven, in a repository you can read: the `cli` interface kind carries a skill's decision, the two-oracle case discriminates, and the gameability probe qualifies and scores.
TEA's eight fragment-selection suites each report a gameability rate of `1` over one exercised probe.

Not proven: nobody has scored a seeded-defect probe against a skill contract.
`strength.defect` is `null` in all eight of those suites, so the catch rate this shape yields today measures the degenerate reply alone.

Two limits are structural.
One `score` invocation reads one sealed run record, a trial set of one, so a policy declaring a minimum above one produces a strength vector marked non-comparable.
A skill whose only deliverable is a written file cannot carry a qualifying defect signature, for the artifact-channel reason above.

## In BMAD terms

TEA ships eight fragment-selection contracts under `test/contracts/fragment-selection/`, one per workflow skill that carries a knowledge index: `atdd`, `automate`, `ci`, `framework`, `nfr`, `test-design`, `test-review`, and `trace`.

They declare 48 behaviors, 48 oracles, and 24 interaction-plan steps between them, ranging from 4 behaviors over 2 cases (`ci`, `nfr`, `test-review`, `trace`) to 10 over 5 (`automate`, `test-design`).
All eight name one interface, `tea-fragment-selection-runner`, of kind `cli`, with one operation whose descriptor channel is `stdout` and whose one required key is `fragments`.

The corpus under `test/probes/fragment-selection/` is 16 probes: one gameability probe and one clean control per workflow.
The `atdd` probe's rationale states the trade directly: a run naming every fragment in the index satisfies `O-001` because every mandated fragment is in the list, and violates `O-002` because so is every forbidden one.

`test/probes/expected-strength.json` records what they score: all eight report `gameability` exercised `1`, caught `1`, rate `1`, and `defect` `null`.
All eight land on `CONCERNS` at exit `0`, on one basis, `coverage gap malformed-input unsatisfied at or above the severity floor`, which is a finding about the contracts recorded where a reader will meet it.

Every probe in that directory is generated by `tools/generate-probes.js` from the workflow's own eval sources, and `npm run test:probe-sources` fails when a file on disk differs from what its sources generate.
