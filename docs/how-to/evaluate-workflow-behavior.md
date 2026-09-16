---
title: "Evaluate Workflow Behavior"
description: "Bind a later step to a value an earlier step produced, prove the read happened after the write, and score a persistence defect the write's own response hides."
sidebar:
  order: 4
---

# Evaluate workflow behavior

A workflow is several steps that have to happen in order, where a later step depends on something an earlier step produced.

The smallest honest example is a write followed by an independent read-back.
The read proves the write persisted, and it proves that only when it happened after the write and addressed the record the write created.

That is the shape this page runs end to end.
For what a contract declares in general and how the four commands chain, read [the full walkthrough](/how-to/author-behavioral-contracts/) first.

## The mini-lab

Work from a clone with the binary built:

```bash
git clone https://github.com/bmad-code-org/bmad-eval-quality.git
cd bmad-eval-quality
npm ci
npm run build
```

```bash
mkdir -p /tmp/eval-quality-workflow
```

The contract is `corpus/dev/contracts/captured-read-back.json`, which the package publishes.
It declares a thing service with three operations, and a plan whose second step is bound to the identifier the first step's response minted.

### 1. Compile it

```bash
node dist/cli/main.js compile --in corpus/dev/contracts/captured-read-back.json --out /tmp/eval-quality-workflow/eval-contract.json
```

Exit `0`.

### 2. Watch the capture rules reject two plans

The capture rules are where a workflow author actually gets stuck, so meet them before you meet a green run.
Both files below are committed beside the tutorial's other fixtures, and each is the same contract with one field changed.

**The wrong type.** A captured pointer's tail is one segment, the declared type at that key is scalar, and it has to equal the declared type of the parameter it is bound to. Capturing the boolean `ok` into a `path` parameter declared `string`:

<!-- expect-exit: 4 -->

```bash
node dist/cli/main.js compile --in examples/tutorials/workflow/broken-captured-type.json
```

```text
eval-quality: unreachable-check-evidence: EvalContract.interactionPlan[stepId=read-back].inputBinding.path["id"]: captured pointer "/interactions/create/response-body/ok" resolves to a declared "boolean", which is not the "string" the bound path parameter "id" is declared as
```

**The cycle.** `checkBindingCycle` builds one graph over the capture edges and the `after` edges together, and rejects any cycle containing a capture edge. Making `create` capture from `read-back` while `read-back.after` is `create`:

<!-- expect-exit: 4 -->

```bash
node dist/cli/main.js compile --in examples/tutorials/workflow/broken-binding-cycle.json
```

```text
eval-quality: binding-cycle: EvalContract.interactionPlan[stepId=create].inputBinding.body["name"]: captured pointer "/interactions/read-back/response-body/error" closes a cycle over the capture and temporal-clause edges; a captured value has no earlier step to resolve from (AD-39)
```

Both exit `4`, and both name the exact binding that broke the rule.

### 3. Preflight the environment

```bash
node dist/cli/main.js preflight \
  --contract corpus/dev/contracts/captured-read-back.json \
  --probes examples/tutorials/workflow/probes.json \
  --observations examples/tutorials/workflow/observations.json \
  --run-id workflow-run-1 \
  --out /tmp/eval-quality-workflow/preflight-verdict.json
```

Exit `0`, over eleven planned legs.
Read the verdict back:

```bash
node -e "const v=require('/tmp/eval-quality-workflow/preflight-verdict.json');console.log('passed:',v.passed);for(const c of v.checks)console.log(c.kind,c.operationId,c.outcome)"
```

```text
passed: true
interface-present get-thing satisfied
interface-present create-thing satisfied
interface-present reset-things satisfied
input-sensitivity get-thing satisfied
input-sensitivity create-thing satisfied
input-sensitivity reset-things satisfied
state-reset null satisfied
clean-control null satisfied
seeded-faults-scoped get-thing satisfied
seeded-fault-fired get-thing satisfied
```

Two of those are specific to this shape and worth pausing on.

`state-reset` is satisfied because this contract declares a `fixtureReset`, and the planner therefore issues four control legs in a fixed order: observe, mutate, reset, observe again. A workflow that leaves state behind between legs measures the leg before it rather than the leg it names.

`seeded-fault-fired` and `seeded-faults-scoped` exist because this chain's probe declares a manifestation witness. The first says the planted fault was observed to fire on its own leg. The second says the same relation did not fire on a clean leg of the same operation, because a defect that shows everywhere is not scoped to what you planted.

### 4. Score the seeded defect

```bash
node dist/cli/main.js score \
  --record examples/tutorials/workflow/sealed-run-record.json \
  --contract /tmp/eval-quality-workflow/eval-contract.json \
  --probe examples/tutorials/workflow/probe.json \
  --preflight-verdict /tmp/eval-quality-workflow/preflight-verdict.json \
  --policy examples/tutorials/workflow/scoring-policy.json \
  --isolation-manifest examples/tutorials/workflow/isolation-manifest.json \
  --evaluator-configuration examples/tutorials/workflow/evaluator-configuration.json \
  --corpus-digest sha256:fee971bb300c3757836c091ff0ec63de59db56a267bacbfdefd9fc406060e5f2 \
  --out /tmp/eval-quality-workflow/evidence-artifact.json
```

Exit `0`.

```bash
node -e "const e=require('/tmp/eval-quality-workflow/evidence-artifact.json');for(const o of e.outcomes)console.log(o.oracleId,o.state,o.disposition,o.corroboration);console.log(e.mode,e.contractVerdict,'exit',e.exitCode);console.log(JSON.stringify(e.verdictBasis));console.log(JSON.stringify(e.strength.vector))"
```

```text
O-001 confirmed held agrees
O-002 caught violated agrees
O-003 confirmed held agrees
O-004 confirmed held agrees
O-005 confirmed held agrees
O-006 confirmed held agrees
O-007 confirmed held agrees
contract-scoring CONCERNS exit 0
[ '1 completed trials below the declared minimum of 3' ]
{"defect":{"caught":1,"exercised":1,"rate":1},"gameability":null,"zero-action":null}
```

### 5. What the capture bought you

Read the record the score just ran over:

```bash
node -e "const r=require('./examples/tutorials/workflow/sealed-run-record.json');for(const o of r.observations)console.log(o.sequence,o.operationId,'in',JSON.stringify(o.callInputs.path||o.callInputs.body),'->',JSON.stringify(o.responseBody))"
```

Three rows carry the lesson:

```text
3 create-thing in {"name":"a thing the run created"} -> {"id":"t-7","name":"a thing the run created","ok":true}
4 get-thing in {"id":"t-7"} -> {"ok":true,"thing":{"id":"t-7","name":"untitled"}}
```

The write answered `ok: true` and echoed back the name it was sent. Its own response is indistinguishable from a correct one.
The read at `t-7` returned `untitled`, so the service filed the record and dropped the name.
O-002 is the oracle that compares those two, and it came out `caught`.

**The identifier is the point.** Nothing in the contract could have named `t-7`, because the service minted it. A literal would have hard-coded a resource the evaluator never created, and `{ matcher: "any" }` would have matched unrelated reads. The `{ captured }` binding is what put the evaluator in front of the record the write actually created.

**The verdict is CONCERNS on one basis, and that basis is the scoring limitation itself.** `coverageGaps` is empty and every other oracle held, so the only thing standing between this run and a clean result is that one `score` invocation completes one trial while the policy asks for three. You met that limit as a number you produced rather than as a warning on a page. [What Ships](/explanation/what-ships/) states it in full.

---

The rest of this page is the reference behind that lab.

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

Those are the first two steps of the contract the lab compiled.

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

Three compile-time checks read every capture, all in `src/core/compile/bindings.ts`, and the lab exercised two of them.
The third is the channel:

A captured pointer names the channel the referenced operation's response descriptor describes, which is `response-body` off an interface that speaks HTTP and the nominated output channel off one that runs behind a command.
Pointing it at `/interactions/create/response-status` exits `4` under `captured-channel-undeclared`, because the response descriptor declares no such channel.

A captured pointer resolves to a declared scalar with no transform applied, so AD-4's ban on arithmetic, projection, and user-defined functions holds by construction: the grammar has nowhere to write one.

The `{ principal }` form is checked only in strict mode, where `compile` runs `checkUndeclaredMandatoryInput` and a name absent from `testData.principals` throws `undeclared-mandatory-input`.
The CLI defaults to `--strict-inputs`.

## What ordering actually guarantees

**What the plan fixes.**
`selectObservations` matches a step against every observation carrying its `operationId`, ordered by the record's `sequence` ascending, since ADR-006 forbids reading order off array position.
`selectWithBindings` then filters those matches in a fixed order: the temporal clause, the capture ordering, then the binding predicates.
The temporal floor is the `sequence` of the observation the `after` anchor selects.
The capture floor is the highest `sequence` any of the step's captured bindings resolved from.
A candidate survives only when its `sequence` is strictly greater than both, so a record whose read sits at `sequence` 2 and whose write sits at `sequence` 9 fails the persistence claim it would otherwise satisfy.
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
`planPreflight` adds that leg with purpose `seeded-fault` and emits the two checks the lab saw satisfied.

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

## Where this stands

The capture half and the temporal half are both proven by the chain this page runs, and you can re-run it yourself, which is the strongest claim on any page here.

The contract is published bytes: `corpus/dev/contracts/captured-read-back.json`, so its digest is reproducible. Strip the file's trailing newline before hashing it, because `serializeArtifact` writes one and the digest is over the canonical bytes without it.

Two contracts in `corpus/dev/contracts/` use a `{ captured }` binding, and between them they cover one value on each of its two axes: `captured-read-back.json` binds into the `path` input channel and `notes-tool-server.json` binds into `arguments`, and both capture from `response-body`, which is the source channel the three compile checks above are about.
A capture from `stdout` or from the `artifact` channel is shipped nowhere, so what backs those is the schema, those three compile checks, and the unit tests in `tests/compile/bindings.test.ts`, `tests/score/bindings.test.ts`, and `tests/score/binding-order.test.ts`.

Two contracts in `corpus/dev/contracts/` declare a `fixtureReset`, and `captured-read-back.json` is the one the lab pre-flighted.
Its four control legs are `preflight-control-observe`, `preflight-control-mutate` against `create-thing`, the contract's own `reset-the-store` against `reset-things`, and `preflight-control-observe-2`, in that order.
`notes-tool-server.json` declares the other reset and its pre-flight runs too, in `tests/application/mcp-end-to-end.test.ts`, which asserts the verdict passed.

One `score` invocation is a trial set of one, so the strength vector this lab produced is marked non-comparable. That limit is the command's; the library's `score` takes a trial set of any size.

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
