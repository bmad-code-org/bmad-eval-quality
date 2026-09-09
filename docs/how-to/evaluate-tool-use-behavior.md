---
title: "Evaluate Tool-Use Behavior"
description: "Two questions get called tool-use evaluation: whether an agent's tool use was correct, which the shipped cli kind answers today, and whether the tool server itself is correct, which the mcp kind still owes."
sidebar:
  order: 6
---

# Evaluate tool-use behavior

Two questions get called tool-use evaluation, and each has a different system under test.

**Was the agent's tool use correct?**
The system under test is the agent that reaches its capabilities through tools: a function-calling loop, a plugin it invokes with arguments it chose itself, an MCP client it drives.
The calls it made are output it produced, and if it writes them down, the shipped `cli` kind already declares that file.
`CommandOperation.artifacts` names the files an operation writes and `descriptorChannel` says which output channel the operation's one response descriptor describes (`src/core/schemas/interface.ts:239-244`).
A contract shaped that way compiles, seals, and pre-flights today, and [Evaluate agent behavior](/how-to/evaluate-agent-behavior/) is the guide for building one.
The last entry under [Where this stands](#where-this-stands) records the run that proved it and the one restriction that shapes it.

**Is the tool server itself correct?**
The system under test is the MCP server: the tool call is the request, the tool result is the response, and only the `mcp` kind can describe that.
`PermittedInterface` declares four interface kinds and one of them is `mcp` (`src/core/schemas/interface.ts:264`), and `compile` refuses it.
Everything from [What the `mcp` kind gives you today](#what-the-mcp-kind-gives-you-today) down is about this question.

Nothing in this repository and nothing in TEA evaluates an `mcp` interface today, and this page is the first writing that takes the kind seriously.

## What you are evaluating

Three questions, and both readings answer all three.
The declarations shown for them are the ones reading two would use once the kind opens: one operation per tool, so a tool call is an interaction step and its arguments are that step's input binding.
Reading one answers the same three today with different declarations, given at the end of this section.
The fourth question after them is kind-neutral and belongs to both readings.

**Was the right tool chosen?**
An `InteractionStep` names an `operationId` and a `cardinality` (`src/core/schemas/plan.ts:158`).
The step is a selector over observations the evaluator produced, so a step naming `search-notes` with `cardinality: "exactly-one"` declares that exactly one call to that tool is expected in the run.
`SELECTOR_CARDINALITIES` is the closed three, `exactly-one`, `at-most-one`, and `any` (`plan.ts:141`).

**Were the arguments right?**
A step's `inputBinding` binds each channel to a `BindingValue` (`plan.ts:55`), and the four tagged forms are `{ literal }`, `{ matcher }`, `{ captured }`, and `{ principal }`.
`{ literal }` writes the argument down.
`{ matcher: "any" }` binds whatever was sent and `{ matcher: "type-violating" }` binds an argument whose JSON type differs from the operation's declared type for that key, which is how you address a tool called with a malformed argument.
`{ captured }` binds an earlier step's declared scalar output, which is what a tool called with an identifier a previous tool returned needs.
An oracle then addresses the argument directly through the `call-inputs` channel.

**Was the result used correctly?**
The operation's `responseDescriptor` declares what the tool returns, and an oracle asserts a relation over it.
The stronger form is a read-back: one step calls the tool, a later independent step observes the state, and the oracle compares the two.
That is the shape [How It Works](/explanation/behavioral-evaluation-contracts/) calls a strong evaluation, and it is what separates a tool that reported success from a tool that did the work.

A fourth question sits underneath all three.
`sensitivityWitness` is mandatory per operation that declares any input (`interface.ts:120`), and it is what establishes that the tool reads its arguments at all.
Two calls differing in one argument, and the relation their responses have to satisfy.
Without it a check over the tool passes while the tool ignores everything you send.

**The same three questions, under reading one.**
The agent is one operation and the run is one step, so the calls it made are rows in the log it wrote and the plan holds a single `exactly-one` step invoking the agent.
One condition governs all three answers below: `artifacts` declares the log with existence semantics and declares nothing about its fields, so the operation's `descriptorChannel` has to nominate that artifact before any pointer reads inside it.
Without the nomination, `/interactions/{stepId}/artifact/{id}` asserts the file exists and a tailed pointer into it is `unreachable-check-evidence` at compile.
"Was the right tool chosen" becomes a `for-all` over the declared collection inside that log, whose predicate reads each row's tool name, and the cap on how many calls a run may make is the `expectedCardinality` on the operation's `collectionLocations` entry, such as `{ "mode": "at-most", "max": 8 }`.
"Were the arguments right" is the same shape one level down, a predicate over the fields of each row, since each row carries what the agent sent. The worked run declared only the call list, so this is the shape reading one implies; the run transcribed no such predicate.
"Was the result used correctly" is answered from the log and from the channel the descriptor nominates. The read-back form above needs a second declared operation that reads the state back, and one agent behind one command is a single-step plan; [Evaluate agent behavior](/how-to/evaluate-agent-behavior/) covers declaring that second operation.
The `call-inputs` channel still carries what was sent, which under reading one is the task the agent was given.
The fourth question is unchanged by the split: `sensitivityWitness` is kind-neutral, mandatory for any input-bearing operation, and it is what pre-flight's `input-sensitivity` check reports on in both readings.

## What the `mcp` kind gives you today

Exactly one thing: a legal value for `kind`, carrying the operation shape built for HTTP.

`PermittedInterface` is a union discriminated on `kind` (`interface.ts:293`), and its `mcp` branch is produced by `apiShapedInterface('mcp')` (`interface.ts:281`).
So an `mcp` interface has three fields, `logicalId`, `kind`, and `operations`, and each operation is an `Operation`.
`Operation`'s own schema description names what it was built for: "AD-19's per-operation declaration inventory for an interface that speaks HTTP" (`interface.ts:140`).

An `Operation` declares eight fields.
`operationId`, `method` from the closed seven HTTP verbs, `pathTemplate` matching `PATH_TEMPLATE_PATTERN`, `stateChangeMarker`, `requestShape` over the four transport channels `path`, `query`, `header`, and `body`, `responseDescriptor`, `volatilePointers`, and `sensitivityWitness`.

The comment above `apiShapedInterface` says why the branch exists at all.
A two-member union would make an `mcp` contract a parse failure, and a parse failure carries no failure code, no artifact path, and no name for the kind that is unsupported.
The branch exists so the rejection is a coded one.

Three gates reject an `mcp` contract, and they are the whole story.

| Where | What fires | Source |
| --- | --- | --- |
| `compile` | `unsupported-interface-kind` | `src/core/compile/interface-inventory.ts:39`, over `SUPPORTED_INTERFACE_KINDS = ['api', 'cli']` |
| `preflight` plan | `unsupported-interface-kind` again, for a contract assembled by hand | `src/core/preflight/plan.ts:307` |
| `score` probe qualification | `signature-interface-kind-unsupported` | `src/core/score/qualification.ts:759` |

The probe side parses too.
`ApiDefectSignature.interfaceKind` is `z.enum(['api', 'web', 'mcp'])` (`src/core/schemas/defect-signature.ts:164`), so a probe declaring a tool-use defect is schema-valid and fails the qualification gate.

Two shapes downstream have no `mcp` problem at all, which is worth knowing before you build anything.
`Observation` in the sealed run record is not discriminated on kind (`src/core/schemas/sealed-run-record.ts:222`): it carries all eight evidence channels flat, with `null` or `{ "kind": "absent" }` where a channel does not apply.
`ObservedCallInputs` is one eight-key object holding both kinds' input channels (`sealed-run-record.ts:200`).
A recorded tool call has somewhere to live.

The port is the shape that has nothing.
`ProbeRequest` and `ProbeObservation` are discriminated unions with an `api` member and a `cli` member (`src/core/schemas/port-messages.ts:135` and `:186`).
There is no `mcp` member, so there is no message an adapter could be handed and none it could return.

## What you need

The commands below are `node dist/cli/main.js`, the binary inside a clone, so work from one:

```bash
git clone https://github.com/bmad-code-org/bmad-eval-quality.git
cd bmad-eval-quality
npm ci
npm run build
```

Installed from the registry, the same binary is on `PATH` as `eval-quality`.

## Declaring the interface

Here is a tool server declared as far as the schema allows, inside the smallest contract that can carry it.
The fields above `permittedInterfaces` are the scaffolding every contract declares, at their emptiest legal values, and the interface under them is what this page is about.
An evaluation you would run declares oracles and an interaction plan; this one declares neither, because `compile` is the only stage it reaches.
Write it to a file in the directory you are working in, and delete it when you are done: `npm run check:doc-invocations` replays this page's own heredoc, and a leftover copy at the clone root is read ahead of it.

```bash
cat > mcp-contract.json <<'EOF'
{
  "schemaVersion": 4,
  "contractId": "notes-tool-server-evaluation",
  "parentDigest": null,
  "revisionCount": 0,
  "sourceSpecDigest": null,
  "behaviors": [{ "id": "B-001", "description": "A search over the notes returns the notes that match.", "severity": "material", "observableSuccessCriterion": "A search call returns content naming the query it was given.", "requirementLinks": [{ "scheme": "local", "id": "REQ-1" }], "riskLinks": [], "oracles": [] }],
  "oracles": [],
  "rubrics": [],
  "waivers": [],
  "referenceSets": null,
  "siblingGroups": null,
  "interactionPlan": [],
  "scopedResources": null,
  "forbiddenInputs": ["original-spec", "source-code", "repository", "builder-transcript", "implementation-logs", "comparator-results", "human-labels"],
  "testData": { "setup": null, "cleanup": null, "principals": null, "resources": null },
  "budgets": { "maxToolCalls": 20, "maxWallClockMinutes": 5, "maxCostUsd": "0.25" },
  "safetyLimits": [],
  "requiredEvidence": [],
  "probeStepBound": null,
  "fixtureReset": null,
  "permittedInterfaces": [
    {
      "logicalId": "notes-tool-server",
      "kind": "mcp",
      "operations": [
        {
          "operationId": "search-notes",
          "method": "POST",
          "pathTemplate": "/tools/call/search_notes",
          "stateChangeMarker": false,
          "requestShape": {
            "path": { "requiredKeys": [], "permittedKeys": [], "types": {} },
            "query": { "requiredKeys": [], "permittedKeys": [], "types": {} },
            "header": { "requiredKeys": [], "permittedKeys": [], "types": {} },
            "body": {
              "requiredKeys": ["query"],
              "permittedKeys": ["query", "limit"],
              "types": { "query": "string", "limit": "number" }
            }
          },
          "responseDescriptor": {
            "requiredKeys": ["content", "isError"],
            "permittedKeys": ["content", "isError"],
            "types": { "content": "array", "isError": "boolean" },
            "successIndicator": "/isError",
            "channelRoles": { "/content": "payload", "/isError": "success-indicator" },
            "collectionLocations": []
          },
          "volatilePointers": [],
          "sensitivityWitness": {
            "witnessId": "search-notes-sensitivity",
            "channel": "body",
            "legs": [
              { "legId": "search-witness-a", "inputs": { "path": {}, "query": {}, "header": {}, "body": { "kind": "json", "value": { "query": "alpha" } } } },
              { "legId": "search-witness-b", "inputs": { "path": {}, "query": {}, "header": {}, "body": { "kind": "json", "value": { "query": "beta" } } } }
            ],
            "relation": {
              "op": "not",
              "operands": [
                { "op": "deep-equality", "operands": [
                  { "pointer": "/interactions/search-witness-a/response-body/content" },
                  { "pointer": "/interactions/search-witness-b/response-body/content" }
                ] }
              ]
            }
          }
        }
      ]
    }
  ]
}
EOF
```

It parses, and the kind is the first thing `compile` faults:

<!-- expect-exit: 4 -->

```bash
node dist/cli/main.js compile --in mcp-contract.json
```

```text
eval-quality: unsupported-interface-kind: EvalContract.permittedInterfaces[logicalId=notes-tool-server].kind: "mcp" is not supported; "api" and "cli" are (AD-10)
```

Exit code 4, the structural-failure code, and the message names the AD-5 code and the field that carries the fault.

One fault sits behind that one, and it is worth knowing before you copy the declaration.
A search changes no state, so `stateChangeMarker` is false, and AD-10 gives a non-mutating operation `path` or `query` for its sensitivity witness.
A tool call carries its arguments in `body`, which is where the witness above varies them, so the witness is illegal on its own terms.
Flip the kind to `api` and `compile` says so, at the same exit 4 under `malformed-operator-expression`.
Opening the kind is not on its own enough to make this contract compile.

Four places in that declaration are a bend, and each one is a real cost.

**`method` carries no tool-call meaning.**
The field is required and its value space is the seven HTTP verbs.
`POST` is the closest reading of a tool invocation, and a read-only tool argues equally for `GET`.
Nothing decides it, and AD-40 resolves a defect signature by comparing method and path template, so two authors disagreeing here author signatures that never bind each other's contracts.

**`pathTemplate` has to carry the tool name.**
The natural transport identity of every MCP tool call is the same JSON-RPC method, `tools/call`, with the tool name in the payload.
Declaring two tools that way collides, which this fence shows without running it:

```text
eval-quality: duplicate-operation-signature: EvalContract.permittedInterfaces[logicalId=notes-tool-server].operations[operationId=create-note]: collides with permittedInterfaces[logicalId=notes-tool-server].operations[operationId=search-notes] after parameter-name erasure ("POST /tools/call") (AD-19, AD-40)
```

So the tool name moves into the path, as `/tools/call/search_notes` above.
That is a spelling this repository invented for the example, and a second author would be free to invent `/search_notes` instead.
The kind ships no convention.

**Three of the four request channels are dead.**
A tool call has arguments and nothing else.
`path`, `query`, and `header` are declared as empty triples on every operation, and `body` carries the whole argument object.
The declaration is honest and three quarters of it is ceremony.

**The response descriptor wants JSON that MCP does not promise.**
`ResponseDescriptor.types` is a flat map from key name to JSON type (`interface.ts`), `collectionLocations` addresses a JSON collection, and AD-4's `for-all` and `for-any` quantify over one.
A real MCP tool commonly returns `content: [{ "type": "text", "text": "..." }]`, where the text is markdown a person reads.
The architecture records this as the open design question behind deferring the kind: "real responses are unstructured markdown with no JSON collection for AD-4's quantifiers."
A tool returning a JSON object fits the descriptor cleanly.
A tool returning prose does not, and no field in the shape closes that gap.

## Writing oracles over a tool call

Every oracle is an `Expression` over pointers, and the pointer grammar is what decides what you can assert.

**About the arguments.**
`call-inputs` takes a channel segment and then a tail, so `/interactions/search/call-inputs/body/query` addresses the `query` argument the agent actually sent on the step whose `stepId` is `search`.
`TRANSPORT_CHANNELS` is the four the api-shaped kinds accept (`src/core/schemas/pointer.ts:36`).
Assertions worth writing: the argument equals a literal the behavior requires, the argument is a member of a declared reference set, the argument matches an anchored pattern.
`compile` rejects a pointer at a key the operation's `requestShape` declares in neither `requiredKeys` nor `permittedKeys`, under `unreachable-check-evidence`, so an oracle over an argument that does not exist never ships.

**About the response.**
`response-body`, `response-headers`, and `response-status` are the three response-side channels an api-shaped kind produces.
`qualification.ts:148` confirms it from the other direction: for any kind other than `cli`, the command channels are the foreign ones, so `stdout`, `stderr`, `exit-code`, and `artifact` are unavailable to a tool-use signature.
`/interactions/search/response-body/isError` and `/interactions/search/response-body/content` are the two pointers the example above makes addressable.

**About the tool having been called at all.**
`existence` and `absence` over a step's evidence carry that, and the step's own `cardinality` carries how many matches are legitimate.

**The check that matters most.**
A tool call that reports success and changed nothing is the tool-use version of the worked example on [How It Works](/explanation/behavioral-evaluation-contracts/).
Write it as two steps and one `deep-equality` under a `not`: bind the write step's argument, bind a later read step with `after` naming the write, and compare what was sent against what came back on the read.
An oracle over the write step's own response passes on a tool that silently discarded the call.

## Running it

The commands are the two on the [CLI reference](/reference/cli-commands/), and they are the same for every interface kind.
Both fences below are command grammar: they name files this page never writes, so copying them verbatim reports a missing file.

```bash
node dist/cli/main.js preflight --contract eval-contract.json \
  --probes probes.json --observations observations.json \
  --run-id tool-run-1 --out preflight-verdict.json
```

```bash
node dist/cli/main.js score --record sealed-run-record.json \
  --contract eval-contract.json --probe probe.json \
  --preflight-verdict preflight-verdict.json --policy scoring-policy.json \
  --isolation-manifest isolation-manifest.json \
  --evaluator-configuration evaluator-configuration.json \
  --corpus-digest <digest> --out evidence-artifact.json
```

Neither reaches a tool call today, because `compile` and the pre-flight plan both stop an `mcp` contract first.

What a port would have to do, when the kind opens.
`EnvironmentProbePort` has one method, `probe`, taking a `ProbeRequest` and an `AbortSignal` and returning a `ProbeObservation` (`src/ports/environment-probe-port.ts`).
The four rules stated on that port are the adapter's whole obligation: apply the target policy before any call and again to every redirect target, issue the request against the address the policy validated and never re-resolve a hostname after validation, throw `forbidden-target`, `budget-exhausted`, `aborted`, or `port-failure` for the four fault classes, and treat every response the server returns as an observation at any status.
That last rule is the one a tool-use adapter would break first: an MCP error result is the payload the seeded-fault check reads, and an adapter that throws on it makes the whole pre-flight vacuous.

The mapping from a logical identifier to a running server is the adapter's, from configuration outside the contract (AD-35).
An `mcp` adapter would need an `McpProbeRequest` and an `McpProbeObservation` on the two unions in `port-messages.ts` before any of this is writable, and a third conformance arm beside `runEnvironmentProbePortConformance` and `runCommandLineProbeConformance`.

## Where this stands

**Declared.** The kind, the api-shaped operation inventory it carries, and a parse that succeeds. A contract, a probe, and a sealed brief can all name `mcp` and be schema-valid.

**Blocked.** `compile` rejects it, the pre-flight plan rejects it, and the probe qualification gate rejects it. Three coded rejections, no silent failures.

**Missing.** A port message for the kind, an adapter, a conformance arm, a channel model for a text-shaped tool result, and a convention for the transport identity of a tool call.

**Already works, and this is the part worth knowing before you fund any of it.** The recorded-observation side accommodates the kind today. `Observation` in the sealed run record is not discriminated on kind (`sealed-run-record.ts:222`) and `ObservedCallInputs` is one eight-key object over both kinds' channels (`:200`), so a recorded tool call already has somewhere to live. `foreignChannels` (`qualification.ts:148`) gives every kind other than `cli` the API response channels, so a tool-use signature is confined to `response-body`, `response-headers`, and `response-status`, a confinement the code decides.

**Unproven, and this is the uncomfortable part.** The calibration record behind this project's central measurement is itself MCP-shaped. The architecture records that every contract in the phase-2 block that produced the 0.33-to-1.00 result declares an MCP tool interface, and that 22 of 25 real contracts use the kind. Those contracts were transcribed into API shape to be compiled here, and a transcription is not the measured artifact. So `mcp` is simultaneously the most-used kind in the prior art and the only one with no path through this package.

**What a first adopter hits.** In order: the compile rejection, then the tool-name-in-the-path question, then the response descriptor against a tool that returns prose. The first is a wall. The second is a convention someone has to fix and write down. The third is the design question the architecture named and left open.

**The first reading runs today, and here is what that cost.** Until the kind opens, the workable move for the first reading is the one TEA already made: put the tool-calling agent behind a command, declare a `cli` interface, and evaluate the run through its arguments, its streams, and the files it writes.

That route was run end to end against the built CLI at 1.4.2.
A contract whose one operation declares the tool-call log in `artifacts` and nominates it with `descriptorChannel` compiles and seals at exit `0`, an oracle quantifies over the calls inside the log, and pre-flight resolves at exit `0` with all six checks satisfied, including a sensitivity witness and a manifestation witness whose legs both address the file.

One restriction shapes it, and it lands on the scoring side only.
A defect signature naming the log by identifier is refused with `condition-artifact-channel-contract-local`, in both the tailed spelling `/interactions/observed/artifact/tool-calls/calls` and the bare `/interactions/observed/artifact/tool-calls`, and `sealProbeSet` then admits nothing.
Print the log as JSON on the stream the descriptor nominates and the same seeded defect qualifies with an empty failure list.
The file stays declared in `artifacts` even then, so an existence oracle and the sensitivity witness legs still reach it. What moves with the descriptor is any pointer that reads *inside* the file: once `stdout` is nominated, a tailed oracle pointer into the log is `unreachable-check-evidence`, so the structural oracle addresses the stream and the existence oracle addresses the file with no tail.
[Evaluate agent behavior](/how-to/evaluate-agent-behavior/) states the restriction in full.

## In BMAD terms

No BMAD module evaluates tool use.

The nearest thing that exists is TEA, and it is one interface kind over.
Every contract in `test/contracts/` of the `bmad-method-test-architecture-enterprise` repository declares `kind: "cli"`: `test-review.contract.json`, `trace.contract.json`, and the eight under `test/contracts/fragment-selection/`.
Each one wraps an agent workflow run behind a command and evaluates what came back on the command's own channels.

The agent chooses, the harness records what it chose, and an oracle over the recording decides whether the choice was right.
That is the first reading, working, in a shipped module.
What is still owed is the second: an interface kind whose system under test is the tool server.
