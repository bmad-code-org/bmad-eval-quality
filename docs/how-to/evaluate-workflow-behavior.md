---
title: "Evaluate Workflow Behavior"
description: "Declare a multi-step workflow as an interaction plan, bind a step to a value an earlier step produced, and read what the ordering guarantees."
sidebar:
  order: 4
---

# Evaluate workflow behavior

A workflow is several steps that have to happen in order, where a later step depends on something an earlier step produced.
The smallest honest example is a write followed by an independent read-back.
The read proves the write persisted, and it proves that only when it happened after the write and addressed the record the write created.
`eval-quality` declares that shape as `interactionPlan`, an array of `InteractionStep` defined in `src/core/schemas/plan.ts`.
The ordering machinery around that array is the subject of this page, and it is what separates a workflow contract from a contract over one invocation.

## What you are evaluating

Three facts separate a workflow from a single call, and each has its own declaration.

**Order.**
A step's `after` field carries the identifier of an earlier step, or `null`.
AD-39 bounds a chain to one level: the step an `after` clause names carries no clause of its own, and `checkNestedTemporalClause` in `src/core/compile/scripting-bound.ts` throws `nested-temporal-clause` when one does.

**Dependency between steps.**
A step names a value it cannot know until an earlier step ran through a `{ captured }` input binding, which addresses that step's declared scalar output.
The other three binding forms declare no dependency, so a plan built from them alone is a set of independent selectors.

**The state a step leaves behind.**
Each operation declares `stateChangeMarker`, and pre-flight's control selection reads it to find a mutating operation (`selectControl` in `src/core/preflight/plan.ts`).
`contract.fixtureReset` declares the operation that resets fixture state between legs, and `null` selects AD-10's repeated-read immutability branch.
`testData.setup` and `testData.cleanup` are nullable strings that no stage in this package reads, so the fixture state a workflow needs is prose addressed to whoever runs it.

One boundary holds throughout.
AD-39 makes a step a selector over observations the evaluator produced.
`eval-quality` runs no step and issues no request from an interaction plan.
Your harness runs the workflow and seals what it observed; the plan decides which observation answers for which step.

## Declaring the steps

Every step carries five fields, and all five are required: `InteractionStep` is a `z.strictObject`, so an absent field and an unrecognized field both fail the parse.

```json
[
  {
    "after": null,
    "cardinality": "exactly-one",
    "inputBinding": {
      "body": { "name": { "literal": "a thing the run created" } },
      "header": null,
      "path": null,
      "query": null
    },
    "operationId": "create-thing",
    "stepId": "create"
  },
  {
    "after": "create",
    "cardinality": "exactly-one",
    "inputBinding": {
      "body": null,
      "header": null,
      "path": { "id": { "captured": "/interactions/create/response-body/id" } },
      "query": null
    },
    "operationId": "get-thing",
    "stepId": "read-back"
  }
]
```

That plan compiles clean, exit `0`, against a contract declaring `create-thing` as a `POST` whose response descriptor types `id` as `string`, and `get-thing` as a `GET` whose `path` channel types `id` as `string`.
It is the first two steps of `corpus/dev/contracts/captured-read-back.json`, which the corpus publishes whole.

- `stepId` is what the rest of the contract addresses the step by, and an evidence pointer spells it `/interactions/{stepId}/...`.
- `operationId` names an operation on a permitted interface, and the interface's kind decides which binding shape is legal. `compile` accepts `api`, `cli`, and `mcp`, and rejects a contract declaring `web` with `unsupported-interface-kind`.
- `inputBinding` is `ApiInputBinding` over `path`, `query`, `header`, and `body`, `CommandInputBinding` over `argument`, `option`, `environment`, and `stdin`, or `McpInputBinding` over `arguments`.
- `after` is the temporal clause described above.
- `cardinality` is one of `exactly-one`, `at-most-one`, and `any`, listed as `SELECTOR_CARDINALITIES`.

Each channel binds at least one parameter or spells `null`.
An empty map is rejected with "an input-binding channel names at least one parameter; an unbound channel is null", and the constraint ledger carries that check as `binding-channel-non-empty`.

The plan is bounded, and `checkScriptingBound` throws `plan-exceeds-scripting-bound` on five conditions: a temporal chain that nests, one step anchoring more than 2 others, more than 2 steps each anchoring more than one other, more than 4 mutually disjoint two-step pairs in one plan, and a plan declaring more than 16 steps.
The step-count message says what the bound is defending: "an exhaustive operation inventory rather than a bounded set of witness relations".

## Binding a step to something an earlier step produced

`BindingValue` has four members and one tag each.

- `{ literal: v }` writes the sent value down.
- `{ matcher: 'any' }` binds whatever was sent, and `{ matcher: 'type-violating' }` binds a value whose JSON type differs from the operation's declared type for that key.
- `{ captured: pointer }` addresses an earlier step's declared scalar output.
- `{ principal: name }` names a principal `testData.principals` declares.

The tags exist because the untagged spelling let `{ "title": "type-violating" }` mean the matcher to one implementation and the literal string to another, which flipped a witness match between `caught` and `missed` on one record.

Step binding is the third form.
In the plan above, `read-back` binds its `path` parameter `id` to `/interactions/create/response-body/id`, which is the `id` key `create-thing`'s response descriptor declares.
The `create` step sends no identifier, so the service mints one, and a `GET` proving persistence is then unwritable with a literal, which would hard-code a resource the evaluator never created, and unwritable with `any`, which matches unrelated reads.
A plan whose write supplied the identifier could name it on both sides and skip the capture, and it would prove less: a write that chooses its own identifier says nothing about what the service filed under it.

Three compile-time checks read every capture, all in `src/core/compile/bindings.ts`.
Each message below is the real output of `node dist/cli/main.js compile` on the plan above with one field changed.

**The channel.**
A captured pointer names the channel the referenced operation's response descriptor describes, which is `response-body` off an interface that speaks HTTP and the nominated output channel off one that runs behind a command.
Pointing it at `/interactions/create/response-status` exits `4`:

```text
eval-quality: captured-channel-undeclared: EvalContract.interactionPlan[stepId=read-back].inputBinding.path["id"]: captured pointer "/interactions/create/response-status" names the response-status channel, which the referenced operation's response descriptor does not declare (AD-26)
```

**The type.**
The pointer's tail is exactly one segment, the declared type at that key is scalar, and it equals the declared type of the bound parameter.
Capturing the boolean `ok` into `read-back`'s own `id`, declared `string`, exits `4`:

```text
eval-quality: unreachable-check-evidence: EvalContract.interactionPlan[stepId=read-back].inputBinding.path["id"]: captured pointer "/interactions/create/response-body/ok" resolves to a declared "boolean", which is not the "string" the bound path parameter "id" is declared as
```

**The cycle.**
`checkBindingCycle` builds one graph over the capture edges and the `after` edges together, and rejects any cycle containing a capture edge.
Making `create` capture from `read-back` while `read-back.after` is `create` exits `4`:

```text
eval-quality: binding-cycle: EvalContract.interactionPlan[stepId=create].inputBinding.body["name"]: captured pointer "/interactions/read-back/response-body/error" closes a cycle over the capture and temporal-clause edges; a captured value has no earlier step to resolve from (AD-39)
```

A captured pointer resolves to a declared scalar with no transform applied, so AD-4's ban on arithmetic, projection, and user-defined functions holds by construction: the grammar has nowhere to write one.

The `{ principal }` form is checked only in strict mode, where `compile` runs `checkUndeclaredMandatoryInput` and a name absent from `testData.principals` throws `undeclared-mandatory-input`.
The CLI defaults to `--strict-inputs`.

## What ordering actually guarantees

**What the plan fixes.**
`selectObservations` matches a step against every observation carrying its `operationId`, ordered by the record's `sequence` ascending, since ADR-006 forbids reading order off array position.
`selectWithBindings` then filters those matches in a fixed order: the temporal clause, the capture ordering, then the binding predicates.
The temporal floor is the `sequence` of the observation the `after` anchor selects.
The capture floor is the highest `sequence` any of the step's captured bindings resolved from.
A candidate survives only when its `sequence` is strictly greater than both, so a record whose `GET` sits at `sequence` 2 and whose `POST` sits at `sequence` 9 fails the persistence claim it would otherwise satisfy.
`bindingOrder` resolves the plan in Kahn tiers over the same union graph `checkBindingCycle` builds, so every step's captured values are already resolved when a later tier reads them.

**What the plan leaves undecided.**
Two steps of one operation whose bindings separate nothing both report `several`, because a filter over zero bindings separates nothing.
`several` under `exactly-one` or `at-most-one` is a named ambiguity returned as data, and both consumers in `score/bindings.ts` treat it as absent.
A dangling `after`, naming a step the plan does not declare, imposes no floor at all.
A declared anchor that matched nothing, or that matched several under a single-valued cardinality, rules every candidate out and is reported as unsatisfiable.
A step whose captured binding resolved nothing selects `none`, which is fail-closed.

**What the port decides.**
The CLI's `preflight` command issues no requests and calls `preflightFromObservations` over observations you hand it.
The library's `runPreflight` awaits a caller-supplied `EnvironmentProbePort` and issues every leg in `plan.legs` order, one at a time, because a parallel run would reset the fixture underneath another operation's witness.

That leg order matters to a workflow author.
`planPreflight` appends the sensitivity legs first, then the control legs, then one leg per seeded defect.
When the contract declares a `fixtureReset` and the reset interface carries a mutating operation, the control block is four legs in this order: `control-observe`, `control-mutate`, `control-reset`, `control-observe`.
So a mutating call and a fixture reset are interleaved into the sequence, after every sensitivity leg and ahead of every seeded-fault leg.
The `state-reset` check names the first and the fourth of those legs, since the reset is one more leg through the same port.

Pre-flight never executes the interaction plan.
The plan contributes its step identifiers to `declaredLegIds`, which is the set a minted control leg identifier has to avoid, and nothing else.

## Seeding a defect in a multi-step workflow

You seed the fault in the workflow by hand, and the probe is where you declare it.
A defect declares a `manifestationWitness` naming a `legId`, an `interfaceId`, an `operationId`, the inputs to send, and the relation that has to fire.
`planPreflight` adds that leg with purpose `seeded-fault` and emits two checks for it: `seeded-faults-scoped` and `seeded-fault-fired`.

A clean leg is every leg already registered for the same interface and operation, collected before the fault leg joins the group, so the fault leg is never in its own clean set.
When steps change state, those clean legs and the fault leg can be the same probe under two labels, and 1.4.0 fixed what the reducer does about it.

A clean leg is dropped only when it issued the fault leg's request and received the fault leg's answer.
The request half is compared over the digest of the request with the correlation identifier neutralised.
The answer half is compared over the digest of the projected evidence with the observation identifier neutralised.
Both halves are required: dropping on the answer alone would discard AD-10's own worked example of two distinct nonexistent identifiers both returning 404, which are exactly the legs the check exists to read.

The answer half compares the projected evidence for a reason a workflow author feels directly.
The projection carries AD-11's projected body, so a field the operation declares volatile is already pruned and a server-minted identifier stops counting as a difference.
Comparing the raw observation would read two writes to one collection as different by design, which puts a false failure back one stage.

Emptiness is tested on what survived the drop, and a check with nothing left to examine fails and names which case it hit, with the defect id and any dropped leg ids filled in:

```text
D-001: the operation has no leg besides the fault leg, so nothing here establishes that the defect is scoped to it
D-001: every other leg of the operation issued the fault leg's own request and received its answer ("create-witness-a"), so nothing here establishes that the defect is scoped to it
```

## Running it

Pre-flight first, over the contract, the probes, and the observations your harness collected:

```bash
node dist/cli/main.js preflight --contract run/eval-contract.json \
  --probes probes.json --observations observations.json \
  --run-id workflow-1 --out run/preflight-verdict.json
```

A failed pre-flight exits `3`, and scoring a workflow over an unfit environment establishes nothing, so stop there.

Then score the sealed run record against the same contract:

```bash
node dist/cli/main.js score --record record.json \
  --contract run/eval-contract.json --probe probe.json \
  --preflight-verdict run/preflight-verdict.json --policy scoring-policy.json \
  --isolation-manifest isolation-manifest.json \
  --evaluator-configuration evaluator-configuration.json \
  --corpus-digest <digest> --out run/evidence-artifact.json
```

`score` reads `passed` and `fixtureDigest` off the verdict, so the pre-flight it is handed has to be the one for this run.
Every flag above is listed in [the CLI reference](/reference/cli-commands/).

## Where this stands

The temporal half is proven end to end by an artifact this repository commits.
`_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/spike-worked-example/` holds a complete chain whose plan declares `write` on `patch-note` and `read-back` on `get-note` with `after: "write"`.
Its O-001 compares `/interactions/read-back/response-body/note/title` with `/interactions/write/call-inputs/body/title`, resolves `caught` against the seeded defect, and the defect rate comes out 1 over 1 exercised probe.
That is a workflow contract catching a persistence defect that a single-response check cannot see.

The capture half is proven by a committed chain.
`corpus/dev/contracts/captured-read-back.json` is the contract the plan printed above comes from, and `_bmad-output/worked-examples/workflow-capture/` is the chain that carries it through `compile`, `seal`, pre-flight, `ingest`, `score`, and `emit`.
Its seeded defect is a write that files the record and drops the name it was sent, answering from the request it was given, so its own response is indistinguishable from a correct one.
The read that catches it is reached through the identifier the write returned, so the capture is what puts the evaluator in front of the record at all.
`sealed-run-record.json` in that directory carries the read's `call-inputs`, and the identifier there is the one the create response minted.
The defect rate comes out 1 over 1 exercised probe, on one completed trial against the policy's `minimumTrialCount` of 3, so `strength.comparable` reads `false` and the note in `evidence-artifact.json` says why.
Two contracts in `corpus/dev/contracts/` use a `{ captured }` binding, and between them they cover one value on each of its two axes: `captured-read-back.json` binds into the `path` input channel and `notes-tool-server.json` binds into `arguments`, and both capture from `response-body`, which is the source channel the three compile checks above are about.
A capture from `stdout` or from the `artifact` channel is shipped nowhere, so what backs those is the schema, those three compile checks, and the unit tests in `tests/compile/bindings.test.ts`, `tests/score/bindings.test.ts`, and `tests/score/binding-order.test.ts`.

The four-leg control branch is proven by the same chain.
Two contracts in `corpus/dev/contracts/` declare a `fixtureReset`, and `captured-read-back.json` is the one whose verdict is committed as bytes you can open.
Its pre-flight plans `preflight-control-observe`, `preflight-control-mutate` against `create-thing`, the contract's own `reset-the-store` against `reset-things`, and `preflight-control-observe-2`, in that order.
`preflight-verdict.json` in that directory is the return value of `preflightFromObservations` over those legs.
It records no leg list, because `PreflightVerdict` carries checks and a fixture digest and nothing else; what it records is `state-reset` satisfied over the first and fourth control legs and `clean-control` satisfied over all four, and the planner emits neither check unless the four legs were planned.
`notes-tool-server.json` declares the other reset and its pre-flight runs too, in `tests/application/mcp-end-to-end.test.ts`, which asserts the verdict passed; `tests/application/preflight.test.ts` case 113 is what pins that contract's leg count and check list.
`tests/preflight/plan.test.ts` is what covers the shapes neither contract declares.

## In BMAD terms

TEA proves the workflow case with its `trace` suite, and the suite currently has open findings.

`test/contracts/trace.contract.json` declares 26 behaviors, 26 oracles, and one `cli` interface, `tea-trace-runner`, carrying one operation, `trace-fixture-set`.
Its plan declares two steps, `trace-seeded-tenant-data-export` and `trace-clean-api-token-lifecycle`, both `cardinality: exactly-one`, both `after: null`.
`test/probes/trace.probes.json` carries four probes: three seeded coverage gaps with manifestation witnesses `manifest-ac-2`, `manifest-ac-8`, and `manifest-ac-10`, plus one clean control.
TEA's first live pre-flight, on 2026-09-09 against `claude`, spawned 2 legs for this suite and spent 872 seconds of model time.

**Finding one: the seeded faults are not scoped.**
`test/probes/expected-strength.json` records `P-001`, `P-002`, and `P-003` as `preflight: failed: seeded-faults-scoped`, verdict `null`, exit `3`, so the suite's defect strength is 0 exercised and 0 caught with a rate of `null`.
The operation's sensitivity witness declares two legs, `witness-gate-evaluated` and `witness-gate-withheld`, and each plant's witness fires on the second one.
That leg issues a different request and receives a different answer, so 1.4.0's drop rule keeps it in the examined set and the check reports a real scoping problem in the contract.
The finding is open.

**Finding two: the two plan steps cannot be told apart.**
Both bind `option.agent` and `stdin.prompt` with `{ "matcher": "any" }`, and both name the same operation, so nothing in the plan separates them.
The prompt is shared on purpose, because what makes a trace run the seeded set or the clean set is the staged workspace, which no request shape names.
The consequence is measured: the clean control `P-004` passes pre-flight and scores `FAIL` at exit `2`, on the basis "oracle resolved abstained at or above the severity floor", because the seeded set's oracles resolve against a record that carries only the clean set's observation.
`test/contracts/README.md` records the underlying limit as "a plan cannot declare that two steps must receive different inputs".
The finding is open.

The suite also leaves four AD-20 coverage rules unsatisfied, recorded in the same file: `malformed-input`, `state-change-read-back`, `success-indicator-separation`, and `whole-body`.
`docs/explanation/eval-quality-command-adapter.md` in the TEA repository carries the full history of both findings.
