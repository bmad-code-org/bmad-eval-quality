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

## The core problem: persistence defects hidden by writes

Did a later step use the result of an earlier step, and did the earlier step actually persist the requested change?

In many systems, a write endpoint validates its inputs, builds an object, generates an ID, and responds `ok: true`. To the caller, the write looks completely successful. But if the storage layer silently drops a field or fails to persist the record, only a subsequent, independent read-back of that exact entity will reveal the failure:

```text
Step 1: create-thing (name: "a thing the run created")
        ↓ returns id: "t-7", ok: true
Step 2: get-thing (id: captured from Step 1 -> "t-7")
        ↓ returns id: "t-7", name: "untitled"

Persistence defect caught:
write reported success, but stored name was "untitled".
```

Evaluating a multi-step workflow requires satisfying three distinct obligations:
1. **The right entity:** The later step must query the exact identifier minted by the earlier step. Hard-coding an ID (`t-1`) tests a pre-existing record rather than the created one; an unconstrained matcher (`{ matcher: "any" }`) can match an unrelated read. The `{ captured }` binding syntax binds the created ID directly to the subsequent read.
2. **The right order:** The read must execute strictly after the write. Array order in a JSON file does not prove execution sequence; explicit temporal clauses (`after: "create"`) and recorded sequence timestamps enforce it.
3. **The right resulting state:** The read-back must confirm the expected attributes persisted.

This walkthrough uses committed caller-produced evidence from `examples/tutorials/workflow/` and the published contract `corpus/dev/contracts/captured-read-back.json`.

> **Execution vs evaluation boundary:** `eval-quality` does not start the service, execute HTTP requests, or step through the interaction plan. Your harness or caller runs the workflow and records the observations. `eval-quality` compiles the contract, preflights environment measurability, and scores whether the recorded evidence supports the evaluator's claims.

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

> **Question:** Is the workflow contract syntactically and structurally valid?

```bash
node dist/cli/main.js compile --in corpus/dev/contracts/captured-read-back.json --out /tmp/eval-quality-workflow/eval-contract.json
```

Exit `0`.

### 2. Watch the capture rules reject two plans

> **Question:** What mistakes do compile-time capture rules prevent?

The capture rules are where a workflow author actually gets stuck, so meet them before you meet a green run.
Both files below are committed beside the tutorial's other fixtures, and each is the same contract with one field changed.

**The wrong type.** A captured pointer's tail is one segment, the declared type at that key is scalar, and it has to equal the declared type of the parameter it is bound to. This prevents binding a boolean (`ok`) into a path parameter declared as a string (`id`):

<!-- expect-exit: 4 -->

```bash
node dist/cli/main.js compile --in examples/tutorials/workflow/broken-captured-type.json
```

```text
eval-quality: unreachable-check-evidence: EvalContract.interactionPlan[stepId=read-back].inputBinding.path["id"]: captured pointer "/interactions/create/response-body/ok" resolves to a declared "boolean", which is not the "string" the bound path parameter "id" is declared as
```

**The cycle.** `checkBindingCycle` builds one graph over the capture edges and the `after` edges together, and rejects any cycle containing a capture edge. This prevents asking a step to depend on a value that does not exist earlier in the execution sequence—such as making `create` capture from `read-back` while `read-back.after` is `create`:

<!-- expect-exit: 4 -->

```bash
node dist/cli/main.js compile --in examples/tutorials/workflow/broken-binding-cycle.json
```

```text
eval-quality: binding-cycle: EvalContract.interactionPlan[stepId=create].inputBinding.body["name"]: captured pointer "/interactions/read-back/response-body/error" closes a cycle over the capture and temporal-clause edges; a captured value has no earlier step to resolve from (AD-39)
```

Both exit `4`, and both name the exact binding that broke the rule.

### 3. Preflight the environment

> **Question:** Can this environment isolate test legs, reset state, and observe planted faults?

The preflight command evaluates the environment using committed observations:

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

#### What preflight just established

```text
Interfaces present (get, create, reset):      YES
Input sensitivity (all 3 operations):         YES
State reset (4-leg sequence verified):        SATISFIED (null)
Clean controls:                               SATISFIED (null)
Seeded fault fired on its leg:                SATISFIED
Seeded fault scoped away from clean legs:     SATISFIED
Environment fit to score:                     YES
```

Two checks are specific to this shape and worth pausing on:

* **State reset:** `state-reset` is satisfied because this contract declares a `fixtureReset`. The planner issues four control legs in sequence: observe starting state, make a change (`preflight-control-mutate`), reset the fixture (`reset-the-store`), and observe again (`preflight-control-observe-2`). A workflow that leaves residue behind between legs would measure past residue rather than the current test leg.
  > **Reset boundary:** This check confirms that the declared reset operation returned the observed state to baseline for the checked operation; it is not a global guarantee about every conceivable side effect across the host or database.
* **Fault firing and scoping:** `seeded-fault-fired` and `seeded-faults-scoped` verify the probe's manifestation witness. The first confirms the planted persistence defect was observed to fire on its designated leg. The second confirms the same defect relation did not fire on clean legs of the same operation, proving the defect is scoped to the intentional fault.

### 4. Score the seeded defect

> **Question:** Did the evaluator catch the persistence defect, and what does the contract verdict say?

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

#### How to read this result: three separate conclusions

1. **The seeded persistence defect was caught:** Oracle `O-002` resolved to `caught` with disposition `violated`. The defect strength vector is `{"caught": 1, "exercised": 1, "rate": 1}`.
2. **Other reported checks held:** Oracles `O-001` and `O-003` through `O-007` resolved to `confirmed`, disposition `held`. `coverageGaps` is empty.
3. **Trial count shortfall:** The contract verdict is `CONCERNS` (exit code `0`) solely because the demonstrated command supplies one `--record` (1 completed trial) while the scoring policy declares a minimum of 3 trials (`verdictBasis: ["1 completed trials below the declared minimum of 3"]`).

### 5. What the capture bought you

Read the record the score just ran over:

```bash
node -e "const r=require('./examples/tutorials/workflow/sealed-run-record.json');for(const o of r.observations)console.log(o.sequence,o.operationId,'in',JSON.stringify(o.callInputs.path||o.callInputs.body),'->',JSON.stringify(o.responseBody))"
```

Two rows carry the lesson:

```text
3 create-thing in {"name":"a thing the run created"} -> {"id":"t-7","name":"a thing the run created","ok":true}
4 get-thing in {"id":"t-7"} -> {"ok":true,"thing":{"id":"t-7","name":"untitled"}}
```

The write answered `ok: true` and echoed back the name it was sent. Its own response is indistinguishable from a correct one.
The read at `t-7` returned `untitled`, so the service filed the record and dropped the name.
O-002 is the oracle that compares those two, and it came out `caught`.

**The identifier is the point.** Nothing in the contract could have hard-coded `t-7`, because the service minted it dynamically at runtime. A literal would have hard-coded a resource the evaluator never created, and `{ matcher: "any" }` would have matched unrelated reads. The `{ captured }` binding is what put the evaluator in front of the record the write actually created.

**Temporal ordering vs captured binding:** Temporal ordering (`after: "create"`, `sequence` numbers) proves that the read occurred after the write. But temporal order alone cannot guarantee that the read inspected the right entity. Capture connects the minted output of step 1 to the input parameter of step 2.

**The verdict is CONCERNS on one basis, and that basis is this demonstrated invocation's trial count.** `coverageGaps` is empty and every other oracle held. The command above supplies one `--record`, so it completes one trial while the policy asks for three. The artifact reports that shortfall directly. [What Ships](/explanation/what-ships/) explains how repeated `--record` flags supply a complete trial set.

## Key takeaways

* Multi-step workflows require three obligations: the right entity, the right order, and the right resulting state.
* Independent read-back catches persistence defects that look successful at the write endpoint.
* Dynamic entity references require `{ captured }` bindings; temporal sequence alone cannot guarantee entity identity.
* Array order in JSON does not establish execution order; score-time ordering uses temporal clauses and recorded `sequence` values, while the dependency graph constrains plan and binding resolution.
* Compile rules catch type mismatches and circular capture dependencies before any evaluation runs.
* State-reset preflight checks confirm that fixture state returns to baseline between test legs.
* The evaluation caught the seeded defect (`rate: 1`), while the contract overall received `CONCERNS` due to the single-trial shortfall.

---

> **You can stop here if you only wanted the hands-on tutorial.**
>
> Everything below is reference material for authors building workflow evaluation contracts: step declarations, capture semantics, ordering guarantees, preflight resets, and fault scoping.

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

The score command in this lab supplies one record, so its strength vector reports one completed trial. Repeat `--record` to meet the policy minimum and make the vector comparable. Every record carries a distinct `trialIndex`; every record agrees on `contractDigest`, `evaluatorConfigurationDigest`, `mode`, `evaluatorRecommendation`, and `runId`.

## In BMAD terms

TEA proves the workflow case with its `trace` suite, whose evaluation findings have been addressed and closed.

`test/contracts/trace.contract.json` declares 26 behaviors, 26 oracles, and one `cli` interface, `tea-trace-runner`, carrying one operation, `trace-fixture-set`.
Its plan declares two steps, `trace-seeded-tenant-data-export` and `trace-clean-api-token-lifecycle`, both `cardinality: exactly-one`, both `after: null`.
`test/probes/trace.probes.json` carries four probes: three seeded coverage gaps with manifestation witnesses `manifest-ac-2`, `manifest-ac-8`, and `manifest-ac-10`, plus one clean control.
TEA's first live pre-flight, on 2026-09-09 against `claude`, spawned 2 legs for this suite and spent 872 seconds of model time.

**Finding one: the seeded faults are not scoped (closed).**
`test/probes/expected-strength.json` originally recorded `P-001`, `P-002`, and `P-003` as `preflight: failed: seeded-faults-scoped` because both sensitivity witness legs staged the seeded set, where the defect relation fired on a leg assumed clean.
PR #161 resolved this by assigning each fixture set its own project root (`tenant-data-export` and `api-token-lifecycle`) and redirecting both sensitivity witness legs to stage the clean set, where P0 coverage is 100%.
All three defect probes now pass pre-flight (`preflight: passed`).
At score time, their defect signatures inspect output artifacts rather than exit codes, so AD-9's qualification gate refuses them as `condition-artifact-channel-contract-local` (since `tea-trace-runner` exits 0 on all completed runs).

**Finding two: the two plan steps cannot be told apart (closed).**
Both steps previously bound `option.agent` and `stdin.prompt` with `{ "matcher": "any" }`, so both selected the clean control's single observation, causing seeded oracles to evaluate against empty collections and five oracles to abstain (`FAIL` at exit 2).
PR #162 resolved this by binding each plan step's `stdin.prompt` to that fixture set's exact prompt literal, disambiguating the steps via `deepEquals`.
The clean control's record now provides observations for both sets, so all 26 oracles resolve `passed-clean-control`, moving `P-004` from `FAIL` at exit 2 to `CONCERNS` at exit 0.

The suite leaves four AD-20 coverage rules unsatisfied, recorded in `expected-strength.json`: `malformed-input`, `state-change-read-back`, `success-indicator-separation`, and `whole-body`.
`docs/explanation/eval-quality-command-adapter.md` in the TEA repository carries the full history of both resolutions.
