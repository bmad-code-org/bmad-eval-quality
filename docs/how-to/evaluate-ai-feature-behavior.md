---
title: "End-to-End AI Feature Behavior"
description: "Write an eval contract for an AI feature behind an HTTP surface, where the answer is different every run, and still get a real regression to fail the run."
sidebar:
  order: 5
---

# Evaluate end-to-end AI feature behavior

This guide covers the case the library was designed around first: a feature your users reach over HTTP, where a request goes in, an answer comes back, and a model produced part of that answer somewhere inside.
A support reply generator, a document summarizer, a search endpoint that ranks with an embedding, and a chat backend that writes to a database before it answers are all this shape.

`src/core/schemas/interface.ts` declares four interface kinds in `INTERFACE_KINDS`: `api`, `web`, `cli`, and `mcp`.
`api` and `web` parse through `apiShapedInterface`, which carries one `Operation` shape for both; `cli` and `mcp` each declare their own.
`compile` supports three of the four, `api`, `cli`, and `mcp`, and rejects `web` under `unsupported-interface-kind` (`SUPPORTED_INTERFACE_KINDS` in `src/core/compile/interface-inventory.ts`).
So an AI feature behind HTTP is declared `kind: "api"` today, and a contract stamped `web` parses against the schema and stops at compilation.

This page spends its length on the one thing that is specific to an AI feature: **the answer is different every run, and you still have to make a claim that fails when the feature breaks.**

## The mini-lab

The chain is the one [the full walkthrough](/how-to/author-behavioral-contracts/) builds, and this page reads two of its results rather than all of them.
Work from a clone with the binary built:

```bash
git clone https://github.com/bmad-code-org/bmad-eval-quality.git
cd bmad-eval-quality
npm ci
npm run build
```

```bash
mkdir -p /tmp/eval-quality-ai-feature
```

```bash
node dist/cli/main.js compile --in examples/tutorials/walkthrough/contract.json --out /tmp/eval-quality-ai-feature/eval-contract.json
```

```bash
node dist/cli/main.js preflight \
  --contract examples/tutorials/walkthrough/contract.json \
  --probes examples/tutorials/walkthrough/probes.json \
  --observations examples/tutorials/walkthrough/observations.json \
  --run-id notes-run-1 \
  --out /tmp/eval-quality-ai-feature/preflight-verdict.json
```

<!-- expect-exit: 2 -->

```bash
node dist/cli/main.js score \
  --record examples/tutorials/walkthrough/sealed-run-record.json \
  --contract /tmp/eval-quality-ai-feature/eval-contract.json \
  --probe examples/tutorials/walkthrough/probe.json \
  --preflight-verdict /tmp/eval-quality-ai-feature/preflight-verdict.json \
  --policy examples/tutorials/walkthrough/scoring-policy.json \
  --isolation-manifest examples/tutorials/walkthrough/isolation-manifest.json \
  --evaluator-configuration examples/tutorials/walkthrough/evaluator-configuration.json \
  --corpus-digest sha256:195dd97c3267c9d7c4d5fb6e1fd62212c8993de903b9261c484ef183d6eaaa3a \
  --out /tmp/eval-quality-ai-feature/evidence-artifact.json
```

Exit `2`. Two rows of the result are what this page is about:

```bash
node -e "const e=require('/tmp/eval-quality-ai-feature/evidence-artifact.json');for(const o of e.outcomes)console.log(o.oracleId,o.state)"
```

```text
O-001 caught
O-002 confirmed
O-003 confirmed
O-004 abstained
```

### O-001: a claim that survives a varying answer

O-001 compares what the write sent against what a later independent read returned:

```json
{
  "op": "equality",
  "operands": [
    { "pointer": "/interactions/write/call-inputs/body/title" },
    { "pointer": "/interactions/read-back/response-body/note/title" }
  ]
}
```

Neither side is a literal.
One pointer reads what the caller sent, the other reads what an independent later call returned, and the assertion holds whatever value the model or the user put in the field.

**That is how you write a check that survives a non-deterministic feature: relate two observations of the same run.**
You do not need deterministic prose. You need stable structure and a relationship between recorded calls.

Three things hold across runs no matter what the model emits, and all three are declarations:

- **The envelope.** A `ResponseDescriptor` declares `requiredKeys`, `permittedKeys`, a per-key JSON type, one nominated `successIndicator`, and a `channelRoles` entry per pointer. Those are structure, and structure survives a resample.
- **The relation between two recorded calls.** What you sent in one step and what a later step reads back are two pointers into the same run record, and an oracle can compare them.
- **The fields you name as varying.** `volatilePointers` is where a timestamp or a server-minted identifier goes, and pre-flight prunes those before it compares anything.

What does not hold is the prose.
There is no semantic operator in this library, and no operator asks a model whether an answer is good.
The closed set is `equality`, `deep-equality`, `containment`, `existence`, `absence`, `regex`, `set-membership`, `ordering`, `count-tolerance`, `shape`, `covers-by-key`, the connectives `all`, `any`, `not`, and the quantifiers `for-all` and `for-any` (AD-4).
`regex` is the ECMA-262 dialect, always fully anchored, with backreferences and lookbehind rejected at compile time under `malformed-operator-expression`.
Judgement about wording belongs in a rubric, declared in the contract's `rubrics` field, and a contract with no rubric produces no judge call at all.

### O-004: the empty collection that certifies nothing

O-004 quantifies over every note the list operation returned, and the list came back `[]`.

```text
quantifier over empty collection
        ↓
insufficient evidence
        ↓
    abstained
```

A two-valued reading would have resolved that `true` and reported the check satisfied.
**An endpoint that returns zero rows to every request would pass every check of this shape**, which is the single most common way an AI feature's evaluation proves nothing.

AD-4 closes it by making resolution three-valued.
Every node resolves to `true`, `false`, or `insufficient-evidence`, and the third has one closed introduction condition: an operand denoting a collection that is empty.
A pointer the declared response descriptor types as a collection, which resolves `absent`, introduces the value too, which is what covers the missing page alongside the empty one.
An absent collection is never read as a present, empty one: `operandDenotesEmptyCollection` in `src/core/evaluate/resolution.ts` answers the `absent` case without consulting the operator exemption below it, so a missing collection stays intercepted under every operator in the set.
The value is terminal and never satisfies: `not(insufficient-evidence)` stays `insufficient-evidence`, `all` and `any` both carry it, and `any` does not let a `true` sibling rescue a branch that examined nothing.

An abstain prevents PASS.
`insufficient-evidence` lands on the outcome state `abstained` under AD-6, and AD-21's ladder carries that to FAIL on its `behavioural-failure-at-or-above-floor` rung once the oracle's severity meets the policy floor.
That is exactly why this run exits `2` while its defect rate reads `1`.

**Version 1.4.0 qualified that rule for three operators, and only three.**
`count-tolerance` reads a collection's cardinality, `existence` and `absence` read its presence, and all three now resolve over a collection observed to be present and empty (`EmptyCollectionTotality` in `src/core/evaluate/resolution.ts`, where those three pass `'total'`).
Every quantifier keeps the interception, so `for-all` and `for-any` still abstain over an empty collection.
A collection-typed pointer that resolved `absent` still abstains under all three, so a missing collection never certifies as an empty one.

The practical consequence is that "this collection should be empty" now has a spelling, and it is a bare `count-tolerance(coll, 0, 0)` standing as the whole assertion.
There is still no spelling for "this collection may legitimately be empty", and AD-4 records that as deliberate.
One disagreement is left standing, and AD-4 writes it down: `deep-equality(coll, [])` and `equality(coll, [])` abstain over the same evidence where `count-tolerance(coll, 0, 0)` resolves `true`, because one totality applies across a whole leaf's operands.

### The lesson

> **You do not need deterministic prose to evaluate a nondeterministic AI feature. Assert stable structure and relationships between observations.**

And the corollary the same run just demonstrated: a check that examined nothing is reported as having examined nothing, rather than as having passed.

---

The rest of this page is the reference behind that lab.

## What you are evaluating

Start from something a user would file a ticket about.

The chain above contracts one behavior against a toy Notes API, and it carries `severity: "critical"`:

> A write that reports success has stored the change.

Its `observableSuccessCriterion` says how you would see that: an independent read of the same note after a successful write returns the title the write sent.
The seeded defect is that the update validates the input, builds the updated record, returns it with `ok: true` and status 200, and never writes it.
That is a user-visible regression, and the update's own response is indistinguishable from a correct one.

## Declaring the interface

Here is a real `api` interface, from the contract the lab compiled.
It parses as a `PermittedInterface`:

```json
{
  "logicalId": "notes-api",
  "kind": "api",
  "operations": [
    {
      "operationId": "patch-note",
      "method": "PATCH",
      "pathTemplate": "/notes/{id}",
      "stateChangeMarker": true,
      "requestShape": {
        "path": { "requiredKeys": ["id"], "permittedKeys": ["id"], "types": { "id": "string" } },
        "query": { "requiredKeys": [], "permittedKeys": [], "types": {} },
        "header": { "requiredKeys": [], "permittedKeys": [], "types": {} },
        "body": { "requiredKeys": [], "permittedKeys": ["title", "body", "tags"], "types": { "title": "string", "body": "string", "tags": "array" } }
      },
      "responseDescriptor": {
        "requiredKeys": ["ok"],
        "permittedKeys": ["ok", "note", "error"],
        "types": { "ok": "boolean", "note": "object", "error": "string" },
        "successIndicator": "/ok",
        "channelRoles": { "/ok": "success-indicator", "/note": "payload", "/error": "diagnostic" },
        "collectionLocations": []
      },
      "volatilePointers": ["/note/updatedAt"],
      "sensitivityWitness": {
        "witnessId": "patch-note-sensitivity",
        "channel": "body",
        "legs": [
          { "legId": "patch-note-witness-a", "inputs": { "path": { "id": "n-1" }, "query": {}, "header": {}, "body": { "kind": "json", "value": { "title": "alpha" } } } },
          { "legId": "patch-note-witness-b", "inputs": { "path": { "id": "n-1" }, "query": {}, "header": {}, "body": { "kind": "json", "value": { "title": "beta" } } } }
        ],
        "relation": {
          "op": "not",
          "operands": [
            { "op": "deep-equality", "operands": [
              { "pointer": "/interactions/patch-note-witness-a/response-body" },
              { "pointer": "/interactions/patch-note-witness-b/response-body" }
            ] }
          ]
        }
      }
    }
  ]
}
```

`logicalId` is a logical name under AD-35, so it is never a URL, a host, or a port; your harness maps it to a target outside the contract.

**`stateChangeMarker` says whether the operation is intended to change state, and three separate rules read it.**
AD-10 selects the sensitivity channel from it: a marker-true operation declares its witness on `body`, a marker-false one on `path` or `query`, and the wrong channel fails compilation under `malformed-operator-expression` (`legalChannels` in `src/core/compile/sensitivity-witness.ts`).
AD-20 rule 7, `state-change-read-back`, becomes relevant the moment any operation declares it true (`src/core/coverage/relevance.ts`).
A declared `fixtureReset` must name a marker-true operation, because an operation that changes no state resets nothing.

**`volatilePointers` names the fields that legitimately differ between two identical calls.**
`src/core/preflight/projection.ts` deletes each one from the observed body before computing the AD-11 fixture digest and before any witness relation resolves, so `updatedAt` stops being a difference that makes an input-blind operation look sensitive.
The reach is narrow, so know it exactly: in this build the field is read by pre-flight alone, and no score-side function prunes an observation before an oracle resolves over it.
An oracle addressing `/interactions/write/response-body/note/updatedAt` reads the raw recorded value.

**`sensitivityWitness` is mandatory per input-bearing operation.**
`null` is legal only for an operation that declares no key in any request channel.
An operation that takes an input and declares no witness fails compilation under `undeclared-mandatory-input`, because nothing would establish that the operation reads the input at all.

## Writing oracles when the output varies

The read-back oracle is the shape this case turns on, and it is O-001 in the worked example:

```json
{
  "op": "equality",
  "operands": [
    { "pointer": "/interactions/write/call-inputs/body/title" },
    { "pointer": "/interactions/read-back/response-body/note/title" }
  ]
}
```

The interaction plan is what makes `read-back` a different step from a read taken before the write.
`read-back` declares `after: "write"` and `cardinality: "exactly-one"`, and the selector floors its candidates at the anchor's sequence.

AD-20 rule 7 is the discipline rule behind this, and its satisfaction predicate is exact: for every operation declaring `stateChangeMarker: true`, one check node must relate a pointer under a step invoking it to a pointer under the response body of a later step whose operation changes no state and whose temporal clause names the write (`stateChangeReadBackSatisfaction` in `src/core/coverage/satisfaction.ts`).
Two unrelated assertions under one `all` do not satisfy it.

For the parts of the answer that vary, assert the structure and leave the content alone.
`shape` takes a closed descriptor of required keys, permitted keys, and per-key JSON type, and it is never an embedded JSON Schema.

One thing a declared collection does not buy you.
`collectionLocations[].expectedCardinality` is read by `src/core/compile/reachability.ts`, which bounds an index into a root collection, and by `src/core/coverage/satisfaction.ts`, which grades AD-20 rule 6.
No score-side function reads it, so a response short of its declared cardinality surfaces only through whatever oracle touches the collection.

## Seeding a defect

The twin run needs a defect you planted on purpose, and for an AI feature the useful ones are the changes that leave the answer looking right.
You make the edit yourself; the package performs no mutation.
Drop the persistence call and keep the response.
Remove a retrieval step and keep the citation format.
Strip a required piece of context from the prompt and keep the schema of the reply.

The probe records what you did in its `qualification` block.
The chain's probe declares `route: "controlled-mutation"`, a `mutationOperator` naming the edit, the target artifact, an `expectedObservableFailure`, baseline-pass and mutated-fail evidence, and `rollbackVerified: true`.
`mutationOperator` is free text in your own words and no code reads it: the field is where you say which edit you made.

Two separate mechanisms then act on it, and they are easy to confuse.

**The defect signature is scoring-side.**
It carries `interfaceKind`, `method`, `pathTemplate`, `observableChannel`, and a condition pairing a selector over observations with a predicate over the selected observation's response (AD-40).
The chain homes its signature on the read rather than on the update, because no condition over a single update observation separates the seeded defect from correct behavior.
A finding counts as a detection only when it cites an observation that satisfies the signature, which is what turns a claim into a caught defect.

**The manifestation witness is pre-flight-side.**
`ManifestationWitness` in `src/core/schemas/sensitivity-witness.ts` carries a `legId`, an `interfaceId`, an `operationId`, the inputs to send, and the AD-4 relation that is true exactly when the seeded fault has fired.
Pre-flight plans a leg for it and resolves two checks: `seeded-fault-fired` passes only when the relation resolves `true` on the fault leg's own observation, and `seeded-faults-scoped` fails if the same relation fires on a clean leg of the same operation.
A defect declaring `manifestationWitness: null` records a **failed** `seeded-fault-fired` check rather than an exemption, because a fault nobody can observe firing is a vacuous probe.
Version 1.4.0 tightened the scoped check twice: a clean leg that issued the fault leg's own request and received its answer is dropped from the comparison, and the check now fails when no clean leg survives that drop, where before it certified its own scoping from no evidence.

## Where this stands

Be clear about what this page proves.

**The shape runs end to end against a loopback fixture.**
The test suite starts the toy Notes API on loopback in two builds, seeds the persistence defect into one of them, probes both over real HTTP through a port implementation that passes the published conformance suite, and scores the run record the seeded arm's observations produce.
The observations are measured, and the evidence artifact that run emits equals the committed one byte for byte.
One record is one trial, so the strength vector comes out reported and marked non-comparable.
`npm run validate` runs it.

**No third-party AI feature has been evaluated with this library.**
The package executes nothing under evaluation: it ships no network adapter, and the port implementation above lives in the test suite.
Pointing this at your own feature means an `EnvironmentProbePort` you write, plus the two arms and the evaluator.

Nineteen of the twenty-four contracts in `corpus/dev/contracts/` declare an `api` interface, so the compile-side rules for this shape are covered by readable examples.

Two limits on what a strength number here means are covered in full on [contract strength](/explanation/contract-strength/): a number measured against a readable corpus is a weaker claim than one measured against probes the author never saw, and a rate over one trial is a rate over one trial.

## In BMAD terms

BMAD's modules are a different shape.
An agent, a workflow, or a task in a BMAD module is a developer tool driven by a command and a set of files, and none of them sits behind an HTTP surface that a user sends a request to.
The BMAD test-architecture repository declares no `api` interface at all.

So if the thing you want to evaluate is a BMAD module, this is the wrong page.
Read [Evaluate agent behavior](/how-to/evaluate-agent-behavior/) for a command-driven agent, and [Evaluate workflow behavior](/how-to/evaluate-workflow-behavior/) for a multi-step workflow.
Come back here when the thing under evaluation is a product your users reach over HTTP.

## Related pages

- [The Full Walkthrough](/how-to/author-behavioral-contracts/): the same chain, all four commands, read down to its verdict
- [How It Works](/explanation/behavioral-evaluation-contracts/): the twin run, and why compile rejects what it rejects
- [CLI reference](/reference/cli-commands/): every flag and every exit code
