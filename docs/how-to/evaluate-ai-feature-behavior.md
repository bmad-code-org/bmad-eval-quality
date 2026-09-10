---
title: "End-to-End AI Feature Behavior"
description: "Write an eval contract for an AI feature behind an HTTP surface, and get a real user-visible regression to fail the run."
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

For the general authoring flow, read [the walkthrough](/how-to/author-behavioral-contracts/): what a contract declares, how to read a rejection, and how the four commands chain.
This page spends its length on the one thing that is specific to an AI feature, which is that the answer is different every run.

## What you are evaluating

Start from something a user would file a ticket about.

The worked example in this repository contracts four behaviors against a toy Notes API, and B-001 is the one that carries `severity: "critical"`:

> A PATCH reporting success has persisted the change.

Its `observableSuccessCriterion` says how you would see that: *an independent GET issued after a successful PATCH returns the title the PATCH sent*.
The seeded defect D-001 is that the update validates the input, builds the updated record, returns it with `ok: true` and status 200, and never writes it.
That is a user-visible regression, and the update's own response is indistinguishable from a correct one.

A varying answer does not stop you from making that claim, because the claim is not about the wording.
Three things hold across runs no matter what the model emits:

- **The envelope.** A `ResponseDescriptor` declares `requiredKeys`, `permittedKeys`, a per-key JSON type, one nominated `successIndicator`, and a `channelRoles` entry per pointer. Those are structure, and structure survives a resample.
- **The relation between two recorded calls.** What you sent in one step and what a later step reads back are two pointers into the same run record, and an oracle can compare them.
- **The fields you name as varying.** `volatilePointers` is where a timestamp or a server-minted identifier goes, and pre-flight prunes those before it compares anything.

What does not hold is the prose.
There is no semantic operator in this library, and no operator asks a model whether an answer is good.
The closed set is `equality`, `deep-equality`, `containment`, `existence`, `absence`, `regex`, `set-membership`, `ordering`, `count-tolerance`, `shape`, `covers-by-key`, the connectives `all`, `any`, `not`, and the quantifiers `for-all` and `for-any` (AD-4).
`regex` is the ECMA-262 dialect, always fully anchored, with backreferences and lookbehind rejected at compile time under `malformed-operator-expression`.
Judgement about wording belongs in a rubric, declared in the contract's `rubrics` field, and a contract with no rubric produces no judge call at all.

## Declaring the interface

Here is a real `api` interface, taken from the contract the repository regenerates on every `npm run validate` through `npm run check:worked-example`.
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
`null` is legal only for an operation that declares no key in any request channel, and `list-notes` in the same contract is exactly that case.
An operation that takes an input and declares no witness fails compilation under `undeclared-mandatory-input`, because nothing would establish that the operation reads the input at all.

## Writing oracles when the output varies

The read-back oracle is the shape this case turns on, and it is O-001 in the worked example:

```json
{
  "op": "equality",
  "operands": [
    { "pointer": "/interactions/read-back/response-body/note/title" },
    { "pointer": "/interactions/write/call-inputs/body/title" }
  ]
}
```

Neither side is a literal.
One pointer reads what the caller sent, the other reads what an independent later call returned, and the assertion holds whatever value the model or the user put in the field.
That is how you write a check that survives a non-deterministic feature: relate two observations of the same run.

The interaction plan is what makes `read-back` a different step from a read taken before the write.
`read-back` declares `after: "write"` and `cardinality: "exactly-one"`, and the selector floors its candidates at the anchor's sequence.
The baseline read of the same record declares `after: null` and `cardinality: "any"`, since two reads legitimately match it.

AD-20 rule 7 is the discipline rule behind this, and its satisfaction predicate is exact: for every operation declaring `stateChangeMarker: true`, one check node must relate a pointer under a step invoking it to a pointer under the response body of a later step whose operation changes no state and whose temporal clause names the write (`stateChangeReadBackSatisfaction` in `src/core/coverage/satisfaction.ts`).
Two unrelated assertions under one `all` do not satisfy it.

For the parts of the answer that vary, assert the structure and leave the content alone.
`shape` takes a closed descriptor of required keys, permitted keys, and per-key JSON type, and it is never an embedded JSON Schema.
The worked example uses it twice: once over the single record a write returns, and once inside a quantifier over every record a list returns.

## Collections, and the trap AD-4 exists to close

An AI feature that returns a list is where a green run is most likely to prove nothing.

Take the soft-delete oracle, written in the natural English phrasing: *no entry in the response is retracted*.
Spelled in the grammar, that is `not(for-any(/interactions/list/response-body/entries, existence(@/retractedAt)))`.
Run it against a response whose `entries` came back `[]`, or against a response carrying no `entries` key at all, and a two-valued reading returns true and certifies that nothing was retracted.
The endpoint that returns zero rows to every request passes every check of this shape.

AD-4 closes that by making resolution three-valued.
Every node resolves to `true`, `false`, or `insufficient-evidence`, and the third has one closed introduction condition: an operand denoting a collection that is empty.
A pointer the declared response descriptor types as a collection, which resolves `absent`, introduces the value too, which is what covers the missing page alongside the empty one.
An absent collection is never read as a present, empty one: `operandDenotesEmptyCollection` in `src/core/evaluate/resolution.ts` answers the `absent` case without consulting the operator exemption below it, so a missing collection stays intercepted under every operator in the set.
The value is terminal and never satisfies: `not(insufficient-evidence)` stays `insufficient-evidence`, `all` and `any` both carry it, and `any` does not let a `true` sibling rescue a branch that examined nothing.

**Version 1.4.0 qualified that rule for three operators, and only three.**
`count-tolerance` reads a collection's cardinality, `existence` and `absence` read its presence, and all three now resolve over a collection observed to be present and empty (`EmptyCollectionTotality` in `src/core/evaluate/resolution.ts`, where those three pass `'total'`).
Every quantifier keeps the interception, so `for-all` and `for-any` still abstain over an empty collection.
A collection-typed pointer that resolved `absent` still abstains under all three, so a missing collection never certifies as an empty one.

The practical consequence is that "this collection should be empty" now has a spelling, and it is a bare `count-tolerance(coll, 0, 0)` standing as the whole assertion.
There is still no spelling for "this collection may legitimately be empty", and AD-4 records that as deliberate.
One disagreement is left standing, and AD-4 writes it down: `deep-equality(coll, [])` and `equality(coll, [])` abstain over the same evidence where `count-tolerance(coll, 0, 0)` resolves `true`, because one totality applies across a whole leaf's operands.

An abstain prevents PASS.
`insufficient-evidence` lands on the outcome state `abstained` under AD-6, and AD-21's ladder carries that to FAIL on its `behavioural-failure-at-or-above-floor` rung once the oracle's severity meets the policy floor.
The committed worked chain is exactly that: O-004 quantifies over `notes` in a response that came back `[]`, the outcome reads `abstained`, and the contract verdict is `FAIL` with the basis `oracle O-004 resolved abstained at or above the severity floor`.

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
The worked example's P-001 declares `route: "controlled-mutation"`, `mutationOperator: "store-write-deletion"`, the target artifact, an `expectedObservableFailure` of *a later independent GET of the updated note returns the title the update replaced*, baseline-pass and mutated-fail evidence, and `rollbackVerified: true`.
`mutationOperator` is free text in your own words, `store-write-deletion` here, and no code reads it: the field is where you say which edit you made.

Two separate mechanisms then act on it, and they are easy to confuse.

**The defect signature is scoring-side.**
It carries `interfaceKind`, `method`, `pathTemplate`, `observableChannel`, and a condition pairing a selector over observations with a predicate over the selected observation's response (AD-40).
P-001 homes its signature on `GET /notes/{id}` rather than on the update, because no condition over a single update observation separates the seeded defect from correct behavior.
A finding counts as a detection only when it cites an observation that satisfies the signature, which is what turns a claim into a caught defect.

**The manifestation witness is pre-flight-side.**
`ManifestationWitness` in `src/core/schemas/sensitivity-witness.ts` carries a `legId`, an `interfaceId`, an `operationId`, the inputs to send, and the AD-4 relation that is true exactly when the seeded fault has fired.
Pre-flight plans a leg for it and resolves two checks: `seeded-fault-fired` passes only when the relation resolves `true` on the fault leg's own observation, and `seeded-faults-scoped` fails if the same relation fires on a clean leg of the same operation.
A defect declaring `manifestationWitness: null` records a **failed** `seeded-fault-fired` check rather than an exemption, because a fault nobody can observe firing is a vacuous probe.
Version 1.4.0 tightened the scoped check twice: a clean leg that issued the fault leg's own request and received its answer is dropped from the comparison, and the check now fails when no clean leg survives that drop, where before it certified its own scoping from no evidence.

## Running it

Pre-flight first, per arm.
It plans the probe legs your contract implies, reduces the observations your harness collected, and mints a verdict for a named run.

```bash
eval-quality preflight --contract eval-contract.json --probes probes.json \
  --observations observations.json --run-id mutated-1 --out preflight-verdict.json
```

Then score that arm's sealed run record against the same contract and its probe.

```bash
eval-quality score --record mutated-record.json --contract eval-contract.json \
  --probe mutated-probe.json --preflight-verdict preflight-verdict.json \
  --policy scoring-policy.json --isolation-manifest mutated-isolation-manifest.json \
  --evaluator-configuration evaluator-configuration.json --corpus-digest <digest> \
  --out mutated-evidence-artifact.json
```

A failed pre-flight exits `3` and stops the arm, because a measurement over an unfit environment says nothing about the contract.
Every flag and every exit code is on the [CLI reference](/reference/cli-commands/).

## Where this stands

Be clear about what this page proves.

**The shape runs end to end against a loopback fixture.**
The test suite starts the toy Notes API on loopback in two builds, seeds D-001 into one of them, probes both over real HTTP through a port implementation that passes the published conformance suite, and scores the run record the seeded arm's observations produce.
The observations are measured, and the evidence artifact that run emits equals the committed one byte for byte.
Two links stay authored, and the test says so where it makes each one.
No evaluator runs: the five calls are the ones the committed record says were made, and the dispositions, the findings, and each observation's provenance label come from that record.
The score is taken under the committed chain's pre-flight verdict, because the pre-flight the suite performs is a separate measurement that fails one check no fixture can answer: the seeded defect declares no way to observe itself firing.
One record is one trial, so the strength vector comes out reported and marked non-comparable.
`npm run validate` runs it.

**No third-party AI feature has been evaluated with this library.**
The package executes nothing under evaluation: it ships no network adapter, and the port implementation above lives in the test suite.
Pointing this at your own feature means an `EnvironmentProbePort` you write, plus the two arms and the evaluator.

What is proven downstream of the evidence is unchanged, and it is proven twice over now.
The chain's selections, check resolutions, witness match, outcome states, verdict, and strength vector are the return values of the shipped functions, called for real, and `npm run check:worked-example` rebuilds the authored chain on every validate.
The empty-collection rule is exercised in that chain and lands a `FAIL`.
Eighteen of the twenty-three contracts in `corpus/dev/contracts/` declare an `api` interface, so the compile-side rules for this shape are covered by readable examples.

Two things the project owes itself here.
A held-out probe corpus, since measuring a contract against probes its author can read is a weaker claim than measuring it against probes they cannot.
Validation of the witness match against a second experiment round, which is implemented and not yet replicated.

One operational limit: the command and `runScore` take one record per call, so a scored run completes one trial, and whenever your policy asks for more the strength vector comes out reported and marked non-comparable.

## In BMAD terms

BMAD's modules are a different shape.
An agent, a workflow, or a task in a BMAD module is a developer tool driven by a command and a set of files, and none of them sits behind an HTTP surface that a user sends a request to.
The BMAD test-architecture repository declares no `api` interface at all.

So if the thing you want to evaluate is a BMAD module, this is the wrong page.
Read [Evaluate agent behavior](/how-to/evaluate-agent-behavior/) for a command-driven agent, and [Evaluate workflow behavior](/how-to/evaluate-workflow-behavior/) for a multi-step workflow.
Come back here when the thing under evaluation is a product your users reach over HTTP.

## Related pages

- [The Full Walkthrough](/how-to/author-behavioral-contracts/): the general authoring flow and the four commands end to end
- [How It Works](/explanation/behavioral-evaluation-contracts/): the twin run, and why compile rejects what it rejects
- [CLI reference](/reference/cli-commands/): every flag and every exit code
