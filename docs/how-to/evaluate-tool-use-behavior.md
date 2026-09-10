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
`CommandOperation.artifacts` names the files an operation writes and `descriptorChannel` says which output channel the operation's one response descriptor describes (`src/core/schemas/interface.ts:240-245`).
A contract shaped that way compiles, seals, and pre-flights today, and [Evaluate agent behavior](/how-to/evaluate-agent-behavior/) is the guide for building one.
The last entry under [Where this stands](#where-this-stands) records the run that proved it and the one restriction that shapes it.

**Is the tool server itself correct?**
The system under test is the MCP server: the tool call is the request, the tool result is the response, and only the `mcp` kind can describe that.
`PermittedInterface` declares four interface kinds and one of them is `mcp` (`src/core/schemas/interface.ts:333`), and `compile` accepts it.
Everything from [What an `mcp` operation declares](#what-an-mcp-operation-declares) down is about this question.

No adapter in this repository and none in TEA has yet run a tool call, so nothing has been scored end to end against an `mcp` interface. This page is the first writing that takes the kind seriously.

## What you are evaluating

Three questions, and both readings answer all three.
The declarations shown for them are the ones reading two uses: one operation per tool, so a tool call is an interaction step and its arguments are that step's input binding.
Reading one answers the same three today with different declarations, given at the end of this section.
The fourth question after them is kind-neutral and belongs to both readings.

**Was the right tool chosen?**
An `InteractionStep` names an `operationId` and a `cardinality` (`src/core/schemas/plan.ts:170`).
The step is a selector over observations the evaluator produced, so a step naming `search-notes` with `cardinality: "exactly-one"` declares that exactly one call to that tool is expected in the run.
`SELECTOR_CARDINALITIES` is the closed three, `exactly-one`, `at-most-one`, and `any` (`plan.ts:153`).

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
`sensitivityWitness` is mandatory per operation that declares any input (`interface.ts:316`), and it is what establishes that the tool reads its arguments at all.
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

## What an `mcp` operation declares

`PermittedInterface` is a union discriminated on `kind` (`interface.ts:365`), and its `mcp` branch carries `McpOperation` (`interface.ts:304`).
So an `mcp` interface has three fields, `logicalId`, `kind`, and `operations`, and each operation is one tool call.

An `McpOperation` declares eight fields.
`operationId`, `toolName`, `stateChangeMarker`, `requestShape` over its one `arguments` channel, `descriptorChannel`, `responseDescriptor`, `volatilePointers`, and `sensitivityWitness`.

`toolName` is the whole transport identity.
Every MCP call shares the one JSON-RPC method `tools/call`, so the published tool name is what tells two calls apart, and it is what AD-40 resolves a defect signature against.
Its charset is letters, digits, underscore, and hyphen (`primitives.ts:28`), which admits both `search_notes` and `searchNotes` and leaves a URL, a host, and a port unrepresentable, which is AD-35 made structural.

`requestShape` has one channel, `arguments`, keyed by the argument names the server publishes for that tool.

`descriptorChannel` is a union tagged on `kind` with one member, `{ "kind": "structured-result" }` (`interface.ts:283`).
That declaration is where the kind's first version draws its boundary: the response descriptor describes a tool's structured result, and a tool that returns only prose sits outside it.
[What ships](/explanation/what-ships/) records the decision and what it defers.

`sensitivityWitness` varies the `arguments` channel.
AD-10 selects a witness channel from the state-change marker off an interface that speaks HTTP, because a read carries its identifier in the URL and a write carries it in the body.
A tool call carries its arguments the same way whichever the marker says, so `arguments` is the one channel AD-10 admits for it (`compile/sensitivity-witness.ts:394`).

Two of the three gates that used to reject an `mcp` contract now admit it, and the third still refuses a probe.

| Where | What happens | Source |
| --- | --- | --- |
| `compile` | Admits `mcp` | `SUPPORTED_INTERFACE_KINDS` in `src/core/compile/interface-inventory.ts` |
| `preflight` plan | Admits it too, reading the same tuple | `src/core/preflight/plan.ts` |
| `score` probe qualification | `signature-interface-kind-unsupported` | `src/core/score/qualification.ts:802` |

The two contract-side gates read one exported tuple, so what compiles and what pre-flights cannot disagree.
`web` is the one kind both still refuse under `unsupported-interface-kind`.

The probe side is the half still closed.
`ApiDefectSignature.interfaceKind` is `z.enum(['api', 'web', 'mcp'])` (`src/core/schemas/defect-signature.ts:175`), so a probe declaring a tool-use defect is schema-valid, and it fails the qualification gate because the signature declares a method and a path template a tool call cannot render.
A signature branch that declares the tool name instead is what closes it.

One shape downstream has no `mcp` problem, and one has half of one.
`Observation` in the sealed run record is not discriminated on kind (`src/core/schemas/sealed-run-record.ts:222`): it carries all eight evidence channels flat, with `null` or `{ "kind": "absent" }` where a channel does not apply, so a tool call's result has somewhere to live.
`ObservedCallInputs` (`sealed-run-record.ts:200`) is an eight-key object over the four transport and four command channels, and it carries no `arguments` key, so what a tool call *sent* has nowhere to live yet.
That ninth key lands with the sealed run record's own breaking version bump; until it does, a pointer at `/interactions/{stepId}/call-inputs/arguments/...` compiles and resolves absent.

The port carries one half of the exchange.
`ProbeRequest` has an `mcp` member now, `McpProbeRequest`, carrying the correlation triple, the tool name, and the arguments channel (`src/core/schemas/port-messages.ts`), so a pre-flight plan over an `mcp` contract mints real requests.
`ProbeObservation` still has an `api` member and a `cli` member and no third, so there is nothing an adapter could return.
A leg answered with an observation of another mechanism is a `port-contract-violation`, which is what stops a tool call from being scored off an HTTP answer.

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
Write it to a file in the directory you are working in, and delete it when you are done: a leftover copy is untracked clutter at the clone root. `npm run check:doc-invocations` replays this page's own heredoc inside a sandbox, so a copy left at the root changes nothing it reports.

```bash
cat > mcp-contract.json <<'EOF'
{
  "schemaVersion": 5,
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
          "toolName": "search_notes",
          "stateChangeMarker": false,
          "requestShape": {
            "arguments": {
              "requiredKeys": ["query"],
              "permittedKeys": ["query", "limit"],
              "types": { "query": "string", "limit": "number" }
            }
          },
          "descriptorChannel": { "kind": "structured-result" },
          "responseDescriptor": {
            "requiredKeys": ["ok", "matches"],
            "permittedKeys": ["ok", "matches", "totalCount"],
            "types": { "ok": "boolean", "matches": "array", "totalCount": "number" },
            "successIndicator": "/ok",
            "channelRoles": { "/ok": "success-indicator", "/matches": "collection", "/totalCount": "payload" },
            "collectionLocations": [
              { "pointer": "/matches", "referenceSet": null, "expectedCardinality": { "mode": "at-most", "max": 20 } }
            ]
          },
          "volatilePointers": [],
          "sensitivityWitness": {
            "witnessId": "search-notes-sensitivity",
            "channel": "arguments",
            "legs": [
              { "legId": "search-witness-a", "inputs": { "arguments": { "query": "alpha" } } },
              { "legId": "search-witness-b", "inputs": { "arguments": { "query": "beta" } } }
            ],
            "relation": {
              "op": "not",
              "operands": [
                { "op": "deep-equality", "operands": [
                  { "pointer": "/interactions/search-witness-a/response-body/matches" },
                  { "pointer": "/interactions/search-witness-b/response-body/matches" }
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

It compiles, and the compiled contract goes to stdout:

```bash
node dist/cli/main.js compile --in mcp-contract.json
```

Exit code 0.
Every check reads the declaration and admits it: the witness is legal on the `arguments` channel, the tool identity renders one signature, and every pointer resolves against the descriptor.
`preflight` plans over it too, minting one tool-call request per witness leg.

Two things in the declaration are worth reading closely.

**The descriptor describes the tool's own result.**
`ResponseDescriptor.types` is a flat map from key name to JSON type, `collectionLocations` addresses a JSON collection, and AD-4's `for-all` and `for-any` quantify over one.
A real MCP tool commonly returns `content: [{ "type": "text", "text": "..." }]`, where the text is markdown a person reads.
The kind's first version describes the structured result a tool with an output schema returns, and `descriptorChannel` carries that boundary as a declaration, so a text-only tool has nothing to spell.
The tempting shape is a descriptor over the MCP envelope, `content` beside `isError`.
It makes every coverage rule report about the envelope: `requiredKeys` becomes `['content']` for every tool that will ever be written, whole-body coverage is satisfied by one oracle addressing the transport framing, and nothing said anything about what the tool returned.

**The error flag lands on `response-status`.**
The MCP envelope's `isError` is observable there as 0 or 1, which keeps it out of `requiredKeys`, where it would satisfy a coverage rule while checking nothing.
`Observation.responseStatus` is an integer with no HTTP reading attached (`sealed-run-record.ts:248`), and an adapter is what performs that projection.
The `ok` field in the declaration above is a different thing: it is the tool's own field inside its own structured result, so an oracle over it checks what the tool said about its work.
A tool whose result carries no such field declares `successIndicator: null`, which is legal and makes AD-20 rule 1 irrelevant.

## Writing oracles over a tool call

Every oracle is an `Expression` over pointers, and the pointer grammar is what decides what you can assert.

**About the arguments.**
`call-inputs` takes a channel segment and then a tail, so `/interactions/search/call-inputs/arguments/query` addresses the `query` argument the agent actually sent on the step whose `stepId` is `search`.
`MCP_CHANNELS` is the one channel a tool call accepts input on (`src/core/schemas/pointer.ts:76`), and the grammar admits all nine channels because a pointer is parsed with no contract in hand.
Assertions worth writing: the argument equals a literal the behavior requires, the argument is a member of a declared reference set, the argument matches an anchored pattern.
`compile` rejects a pointer at a key the operation's `requestShape` declares in neither `requiredKeys` nor `permittedKeys`, under `unreachable-check-evidence`, so an oracle over an argument that does not exist never ships.

**About the response.**
A tool call carries its structured result on `response-body` and its error flag on `response-status`, and fills no other response channel.
A pointer at `response-headers`, `exit-code`, or a stream is `unreachable-check-evidence` at compile (`src/core/compile/reachability.ts:581`), and a pointer at a written file is `unresolved-artifact-reference`, since a tool call declares no `artifacts` list for an identifier to resolve against.
`/interactions/search/response-body/ok` and `/interactions/search/response-body/matches` are the two pointers the example above makes addressable.

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

Neither reaches a tool call today. A planned mcp leg is issued to whatever port is wired, and the answer has no shape to come back in, so the reduce step reports a `port-contract-violation`.

What an adapter behind the port would have to do.
`EnvironmentProbePort` has one method, `probe`, taking a `ProbeRequest` and an `AbortSignal` and returning a `ProbeObservation` (`src/ports/environment-probe-port.ts`).
The four rules stated on that port are the adapter's whole obligation: apply the target policy before any call and again to every redirect target, issue the request against the address the policy validated and never re-resolve a hostname after validation, throw `forbidden-target`, `budget-exhausted`, `aborted`, or `port-failure` for the four fault classes, and treat every response the server returns as an observation at any status.
That last rule is the one a tool-use adapter would break first: an MCP error result is the payload the seeded-fault check reads, and an adapter that throws on it makes the whole pre-flight vacuous.

The mapping from a logical identifier to a running server is the adapter's, from configuration outside the contract (AD-35).
`McpProbeRequest` is on the request union already, so an adapter has a shape to be handed. What it still lacks is an `McpProbeObservation` to return, and a third conformance arm beside `runEnvironmentProbePortConformance` and `runCommandLineProbeConformance`.

## Where this stands

**Compiles, and plans a pre-flight.** The kind, its own operation inventory over a published tool name, a parse that succeeds, and both contract-side gates open. A contract over an MCP tool server compiles under every discipline rule and plans a pre-flight whose legs are tool-call requests. That pre-flight cannot complete: no observation shape exists for a tool call, so every answer reduces to a `port-contract-violation`.

**Blocked.** The probe qualification gate rejects a defect signature naming `mcp`, because the signature declares a method and a path template a tool call cannot render. One coded rejection, no silent failures.

**Missing.** An observation message for the kind, an adapter, a conformance arm, a defect signature that can name a tool, a ninth `arguments` key on the recorded call inputs, and a channel model for a text-shaped tool result.

**Already works, and this is the part worth knowing before you fund any of it.** The response side accommodates the kind today. `Observation` in the sealed run record is not discriminated on kind (`sealed-run-record.ts:222`), so what a tool answered has somewhere to live. `foreignChannels` (`qualification.ts:170`) gives every kind other than `cli` the API response channels, and compile-time reachability narrows a tool call further to `response-body`, `response-status`, and its own `call-inputs`, a confinement the code decides. The request side is the half that is short a key: `ObservedCallInputs` (`sealed-run-record.ts:200`) carries eight channels and none of them is `arguments`.

**Unproven, and this is the uncomfortable part.** The calibration record behind this project's central measurement is itself MCP-shaped. The architecture records that every contract in the phase-2 block that produced the 0.33-to-1.00 result declares an MCP tool interface, and that 22 of 25 real contracts use the kind. Those contracts were transcribed into API shape to be compiled here, and a transcription is not the measured artifact. So `mcp` is the most-used kind in the prior art and the one this package reached last.

**What a first adopter hits.** In order: a planned pre-flight nothing can answer, then a recorded tool call whose arguments have no key to land in, then the response descriptor against a tool that returns prose. The first needs an observation message and an adapter. The second makes an oracle over an argument resolve absent until the sealed run record takes its ninth key. The third is a stated boundary: the descriptor describes a tool's structured result, and a tool that answers with markdown alone is outside the kind's first version.

**The first reading runs today, and here is what that cost.** Until an adapter answers a tool call, the workable move for the first reading is the one TEA already made: put the tool-calling agent behind a command, declare a `cli` interface, and evaluate the run through its arguments, its streams, and the files it writes.

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
