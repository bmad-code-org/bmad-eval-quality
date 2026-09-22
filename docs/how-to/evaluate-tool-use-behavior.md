---
title: "Evaluate Tool-Use Behavior"
description: "Two questions get called tool-use evaluation: whether an agent's tool use was correct, which the shipped cli kind answers today, and whether the tool server itself is correct, which the mcp kind and its stdio adapter now answer."
sidebar:
  order: 6
---

# Evaluate tool-use behavior

Two distinct systems get called tool-use evaluation, and each has a different system under test:

| Question | System Under Test | Observed Evidence | Evaluated By |
| --- | --- | --- | --- |
| **Did the agent use tools correctly?** | The autonomous agent | The agent's recorded calls, arguments, and written logs | `cli` interface kind ([Evaluate agent behavior](/how-to/evaluate-agent-behavior/)) |
| **Is the tool server itself correct?** | The MCP tool server | Server responses and persistent state changes | `mcp` interface kind (this guide) |

These are related evaluation problems, but they evaluate different systems under test and remain conceptually distinct.

### 1. The agent using tools

The system under test is the autonomous agent that reaches capabilities through tools: a function-calling loop, an invoked plugin, or an MCP client it drives.
The calls the agent makes are observable output.
Core questions include:
* Did it choose the correct tool?
* Did it avoid irrelevant or dangerous tools?
* Did it provide the correct arguments?
* Did it use outputs from previous calls correctly?
* Did it make the necessary calls?
* Did it make unnecessary calls?
* Did it interpret the tool result correctly?
* Did subsequent behavior reflect what the tool actually returned?

This behavior is evaluated through an agent or CLI-shaped contract when tool calls are part of the agent's observable output.
The calls it made are output it produced, and if it writes them down, the shipped `cli` kind declares that file.
`CommandOperation.artifacts` names the files an operation writes and `descriptorChannel` says which output channel the operation's response descriptor describes (`src/core/schemas/interface.ts:240-245`).
A contract shaped that way compiles, seals, and pre-flights today.
[Evaluate agent behavior](/how-to/evaluate-agent-behavior/) is the guide for building one.
The last entry under [Where this stands](#where-this-stands) records the run that proved it and the restriction that shapes it.

### 2. The tool implementation itself

The system under test is the tool server, such as an MCP server.
The tool call is the request, the tool result is the response, and the `mcp` interface kind describes that exchange.
Core questions include:
* Does the tool read its arguments?
* Does it produce the expected structured result?
* Does a state-changing tool actually produce the promised state change?
* Does it report errors correctly?
* Can the effect of a write be independently verified?
* Do multiple related tool calls preserve the intended relationship?

`PermittedInterface` declares four interface kinds and one of them is `mcp` (`src/core/schemas/interface.ts:365`), and `compile` accepts it.
Everything from [What an `mcp` operation declares](#what-an-mcp-operation-declares) down addresses this question.

This repository ships an adapter that runs a tool call.
`createMcpAdapter` speaks MCP's stdio transport, and the mini-lab below drives a real tool server through it, from `compile` to a scored defect.
Nothing in TEA has been scored against an `mcp` interface yet.

> **Scope boundary:** This mini-lab evaluates the second target: the MCP tool server. It verifies whether the server correctly processes tool calls and persists state. It does not evaluate whether an autonomous agent made the right reasoning choices or selected the right tools.

## The mini-lab

This runs a real tool server. Work from a clone with the binary built:

```bash
git clone https://github.com/bmad-code-org/bmad-eval-quality.git
cd bmad-eval-quality
npm ci
npm run build
```

```bash
mkdir -p /tmp/eval-quality-tool-use
```

Three files under `examples/tutorials/tool-use/` make this possible:
* `tool-server.mjs`: A small MCP server speaking the stdio transport, publishing two tools: `search_notes` and `create_note`.
* `notes-store.mjs`: The underlying state logic and file-backed persistence.
* `run-tool-calls.mjs`: The caller-side test harness helper. It configures `createMcpAdapter` with an `McpTargetPolicy` mapping the contract's logical interface to that server, executes the planned tool calls, and records the responses.

> **Execution ownership:** The scoring CLI (`eval-quality`) executes no servers and makes no tool calls directly. The caller-side helper (`run-tool-calls.mjs`) drives the live tool calls and records observations.

### 1. Compile the contract

> **Question:** Does the contract define valid `mcp` operations and tool schemas?

```bash
node dist/cli/main.js compile --in examples/tutorials/tool-use/contract.json --out /tmp/eval-quality-tool-use/eval-contract.json
```

Exit `0`.

### 2. Issue the pre-flight legs against a real server

> **Question:** Does the MCP server handshake, respond to calls, and demonstrate input sensitivity?

<!-- expect-exit: 0 -->

```bash
node examples/tutorials/tool-use/run-tool-calls.mjs --contract /tmp/eval-quality-tool-use/eval-contract.json --run-id tool-run-1 --mode legs --out /tmp/eval-quality-tool-use/observations.json
```

The helper spawns the server, performs the MCP handshake, makes each planned call, and prints the arguments it sent beside the structured result it received:

```text
leg leg-first-query  search_notes({"query":"alpha"})
  -> {"ok":true,"matches":[{"noteId":"n-1"}],"totalCount":1}
leg leg-second-query  search_notes({"query":"beta"})
  -> {"ok":true,"matches":[{"noteId":"n-2"}],"totalCount":1}
leg leg-first-title  create_note({"title":"the first note"})
  -> {"ok":true,"noteId":"note-the-first-note"}
leg leg-second-title  create_note({"title":"the second note"})
  -> {"ok":true,"noteId":"note-the-second-note"}
```

The first two legs are `search_notes`'s sensitivity witness: two calls differing in one argument, answering differently, which is what establishes that the tool reads what you send it. The next two are the same for `create_note`. Four more control legs follow, and the helper prints the reduced verdict at the end.

These are real tool calls. One architectural detail is critical when building your own adapter: the shipped stdio adapter opens **one session per tool call**. The server process is launched, performs the handshake, handles one call, and tears down. A server storing state in memory would lose every write before the subsequent read-back query. The fixture avoids this by persisting notes to a file path declared in the policy.

### 3. Watch the two arms diverge

> **Question:** Did the tool store the requested value, or merely report a successful status code?

Execute the clean server first:

<!-- expect-exit: 0 -->

```bash
node examples/tutorials/tool-use/run-tool-calls.mjs --contract /tmp/eval-quality-tool-use/eval-contract.json --mode steps --out /tmp/eval-quality-tool-use/clean-steps.json
```

Then execute the arm with the persistence defect seeded:

<!-- expect-exit: 0 -->

```bash
node examples/tutorials/tool-use/run-tool-calls.mjs --contract /tmp/eval-quality-tool-use/eval-contract.json --mode steps --seed-defect --out /tmp/eval-quality-tool-use/seeded-steps.json
```

Two lines out of those two runs carry the whole lesson:

```text
step create     create_note({"title":"a new note"})
  clean  -> {"ok":true,"noteId":"note-a-new-note"}
  seeded -> {"ok":true,"noteId":"note-a-new-note"}

step read-back  search_notes({"query":"note-a-new-note"})
  clean  -> {"matches":[{"noteId":"note-a-new-note"}],"totalCount":1,"topMatch":{"title":"a new note"}}
  seeded -> {"matches":[{"noteId":"note-a-new-note"}],"totalCount":1,"topMatch":{"title":"(untitled)"}}
```

**The creation call answers identically in both arms.**
Both arms return `ok: true` and the expected identifier:

```text
create_note(...)
→ ok: true
→ expected identifier
```

A check examining only the response of `create_note` passes both clean and defective servers.
The defect becomes visible only through a later independent read:

```text
create_note(title = "a new note")
        ↓
returns success
        ↓
search_notes(created identifier)
        ↓
clean:  title = "a new note"
broken: title = "(untitled)"
```

A tool reporting success is weaker evidence than observing the state it was supposed to change.
This is the tool-use version of the read-back discipline used throughout `eval-quality`:

```text
command reports success
≠
required effect actually happened
```

State-changing tool behavior must be verified through independent observable state whenever such evidence exists.

### 4. Preflight and score

> **Question:** Did the evaluator catch the persistence defect, and how is the contract verdict interpreted?

> **Evidence provenance:** The live demonstration above wrote newly generated observations to `/tmp/eval-quality-tool-use/`. The commands below evaluate preflight against the committed observation fixture (`examples/tutorials/tool-use/observations.json`) and score against the committed sealed run record (`examples/tutorials/tool-use/sealed-run-record.json`). The repository test `tests/application/tool-use-tutorial.test.ts` verifies that live runs produce observations identical to the committed fixture.

```bash
node dist/cli/main.js preflight \
  --contract /tmp/eval-quality-tool-use/eval-contract.json \
  --probes examples/tutorials/tool-use/probes.json \
  --observations examples/tutorials/tool-use/observations.json \
  --run-id tool-run-1 \
  --out /tmp/eval-quality-tool-use/preflight-verdict.json
```

```bash
node -e "const v=require('/tmp/eval-quality-tool-use/preflight-verdict.json');console.log('passed:',v.passed);for(const c of v.checks)console.log(c.kind,c.operationId,c.outcome)"
```

```text
passed: true
interface-present search-notes satisfied
interface-present create-note satisfied
input-sensitivity search-notes satisfied
input-sensitivity create-note satisfied
state-reset null satisfied
clean-control null satisfied
```

```bash
node dist/cli/main.js score \
  --record examples/tutorials/tool-use/sealed-run-record.json \
  --contract /tmp/eval-quality-tool-use/eval-contract.json \
  --probe examples/tutorials/tool-use/probe.json \
  --preflight-verdict /tmp/eval-quality-tool-use/preflight-verdict.json \
  --policy examples/tutorials/tool-use/scoring-policy.json \
  --isolation-manifest examples/tutorials/tool-use/isolation-manifest.json \
  --evaluator-configuration examples/tutorials/tool-use/evaluator-configuration.json \
  --corpus-digest sha256:74259e881b443bf6d063bc7d626cf9d666127475410ec69d7410d7c3801fe2f2 \
  --out /tmp/eval-quality-tool-use/evidence-artifact.json
```

```bash
node -e "const e=require('/tmp/eval-quality-tool-use/evidence-artifact.json');for(const o of e.outcomes)console.log(o.oracleId,o.state,o.disposition,o.corroboration);console.log(e.mode,e.contractVerdict,'exit',e.exitCode);console.log(JSON.stringify(e.strength.vector))"
```

```text
O-001 caught violated agrees
O-002 confirmed held agrees
O-003 confirmed held agrees
O-004 confirmed held agrees
contract-scoring CONCERNS exit 0
{"defect":{"caught":1,"exercised":1,"rate":1},"gameability":null,"zero-action":null}
```

#### How to read this result

* **Oracle outcomes:** `O-001 caught violated agrees`. The read-back oracle detected the seeded persistence defect. Oracles `O-002`, `O-003`, and `O-004` held.
* **Defect strength:** `defect: {"caught": 1, "exercised": 1, "rate": 1}`. The seeded defect was exercised and caught.
* **Contract verdict:** `CONCERNS` (exit code `0`).
* **Verdict basis:** The artifact reports:
  ```text
  coverage gap malformed-input unsatisfied at or above the severity floor
  coverage gap per-record unsatisfied at or above the severity floor
  coverage gap sibling-cross-check unsatisfied at or above the severity floor
  1 completed trials below the declared minimum of 3
  ```
* **Comparability:** Marked `comparable: false`. The command scored 1 trial (`--record`), falling below the policy's required 3 trials.

## Key takeaways

* **Distinguish the two evaluation targets:** Tool-use evaluation spans two distinct systems under test.
  Evaluating an autonomous agent asks whether it selected the appropriate tool, avoided dangerous tools, passed correct arguments, and interpreted returned values.
  Evaluating a tool server asks whether the tool implementation reads inputs, returns structured results, executes persistent state changes, and reports errors.
* **Verify state changes through independent read-back:** A tool reporting success (`ok: true`, HTTP 200, or a generated identifier) is weaker evidence than observing the state it was supposed to change.
  Verifying state-changing tool behavior requires an independent read-back query or external inspection of the affected state: `command reports success ≠ required effect actually happened`.
* **Preserve relationships across tool calls:** When one tool returns an identifier or value that a later tool must use, capture that output and bind it into the later call.
  Evaluate the relationship between calls, not just each call in isolation.
* **Evaluate tool choice and trajectory directly:** For agent evaluations, verify that the agent selected the appropriate tool for the task.
  A plausible final answer does not prove correct tool selection.
  The observable sequence of tool calls can be primary behavioral evidence, and unnecessary or missing calls indicate incorrect behavior.
* **Check argument correctness:** Verify the actual arguments passed to each tool call.
  A correct tool called with the wrong identifier, scope, filter, tenant, filename, or payload is incorrect behavior.
* **Require input sensitivity:** Evaluations must verify that changing meaningful tool arguments produces corresponding changes in behavior.
  An evaluation must prove that the tool reads and responds to its arguments; a tool or agent that appears to work while ignoring arguments fails evaluation.

### 5. Tutorial implementation details

These implementation decisions belong to this specific tutorial and its verification harness:

* **Execution ownership:** The scoring CLI (`eval-quality`) executes no servers and makes no tool calls directly.
  The caller-side harness helper (`run-tool-calls.mjs`) drives the live tool calls and records observations.
* **Adapter session lifecycle:** The shipped MCP adapter opens one session per tool call over stdio.
  The server process launches, handshakes, handles one call, and tears down.
  For multi-call stateful evaluations using this adapter lifecycle, state must persist outside the server process.
* **Fixture replay and verification:** Preflight and scoring commands in this tutorial evaluate against committed fixtures (`observations.json` and `sealed-run-record.json`).
  The repository test `tests/application/tool-use-tutorial.test.ts` verifies that live runs produce observations identical to the committed fixture.
* **Trial thresholds and contract verdict:** The scoring run caught the seeded defect (`rate: 1`).
  The contract received `CONCERNS` because single-trial execution falls below the policy's required 3 trials, and three declared coverage gaps remained open.
* **Measured observations:** The committed `observations.json` is byte-identical to what the helper writes when step 2 runs against the spawned server.
  The chain builder replays the calls against `notes-store.mjs`, the module the server imports, so there is one definition of what the tools answer.

---

> **You can stop here if you only wanted the hands-on tutorial.**
>
> Everything below is reference material for authors building MCP tool evaluation contracts: operation schemas, structured results, error channels, and probe qualification.

## What you are evaluating

Three questions, and both readings answer all three.
The declarations shown for them are the ones reading two uses: one operation per tool, so a tool call is an interaction step and its arguments are that step's input binding.
Reading one answers the same three today with different declarations, given at the end of this section.
The fourth question after them is kind-neutral and belongs to both readings.

**Was the right tool chosen?**
For agent evaluations, verify that the agent selected the appropriate tool for the task.
A plausible final answer does not prove correct tool selection.
The observable tool trajectory can itself be part of the behavior being evaluated.
An `InteractionStep` names an `operationId` and a `cardinality` (`src/core/schemas/plan.ts:170`).
The step is a selector over observations the evaluator produced, so a step naming `search-notes` with `cardinality: "exactly-one"` declares that exactly one call to that tool is expected in the run.
`SELECTOR_CARDINALITIES` is the closed three, `exactly-one`, `at-most-one`, and `any` (`plan.ts:153`).

**Were the arguments right?**
Verify the actual arguments sent to the tool.
A correct tool called with the wrong identifier, scope, filter, tenant, filename, or payload is still incorrect behavior.
A step's `inputBinding` binds each channel to a `BindingValue` (`plan.ts:55`), and the four tagged forms are `{ literal }`, `{ matcher }`, `{ captured }`, and `{ principal }`.
`{ literal }` writes the argument down.
`{ matcher: "any" }` binds whatever was sent and `{ matcher: "type-violating" }` binds an argument whose JSON type differs from the operation's declared type for that key, which is how you address a tool called with a malformed argument.
`{ captured }` binds an earlier step's declared scalar output, which is what a tool called with an identifier a previous tool returned needs.
An oracle then addresses the argument directly through the `call-inputs` channel.

**Was the result used correctly?**
The operation's `responseDescriptor` declares what the tool returns, and an oracle asserts a relation over it.
The stronger form is a read-back: one step calls the tool, a later independent step observes the state, and the oracle compares the two.
A tool reporting success is weaker evidence than observing the state it was supposed to change.
That is the shape [How It Works](/explanation/behavioral-evaluation-contracts/) calls a strong evaluation, and it is what separates a tool that reported success from a tool that did the work.

A fourth question sits underneath all three.
The evaluation should establish that changing meaningful tool arguments changes relevant behavior.
A tool that appears to work while ignoring its arguments fails evaluation.
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

All three gates that used to reject an `mcp` contract now admit it.

| Where | What happens | Source |
| --- | --- | --- |
| `compile` | Admits `mcp` | `SUPPORTED_INTERFACE_KINDS` in `src/core/compile/interface-inventory.ts` |
| `preflight` plan | Admits it too, reading the same tuple | `src/core/preflight/plan.ts` |
| `score` probe qualification | Admits it, reading the same tuple again | `src/core/score/qualification.ts:832` |

All three read one exported tuple, so what compiles, what pre-flights, and what a signature may declare against cannot disagree.
`web` is the one kind all three still refuse, under `unsupported-interface-kind` contract-side and `signature-interface-kind-unsupported` probe-side.

The probe side is open too.
`McpDefectSignature` (`src/core/schemas/defect-signature.ts:207`) declares the published tool name, which is the identity AD-40 resolves against, and `ApiDefectSignature.interfaceKind` is `z.enum(['api', 'web'])` (`:172`), so a signature naming `mcp` beside a method and a path template no longer parses.
The qualification gate admits the kind, reading the same tuple the compile and pre-flight gates read.

Both shapes downstream carry the kind.
`Observation` in the sealed run record is not discriminated on kind (`src/core/schemas/sealed-run-record.ts:229`): it carries all eight evidence channels flat, with `null` or `{ "kind": "absent" }` where a channel does not apply, so a tool call's result has somewhere to live.
`ObservedCallInputs` (`sealed-run-record.ts:204`) declares one key per input channel, `arguments` included, so what a tool call *sent* has somewhere to live and a pointer at `/interactions/{stepId}/call-inputs/arguments/...` resolves the recorded value.
That key arrived with the record's own breaking version bump, from 4 to 5.

The port carries both halves of the exchange.
`ProbeRequest` has an `mcp` member, `McpProbeRequest`, carrying the correlation triple, the tool name, and the arguments channel (`src/core/schemas/port-messages.ts`), so a pre-flight plan over an `mcp` contract mints real requests.
`ProbeObservation` has its own third member, `McpProbeObservation`, carrying the envelope's `isError` flag and the structured result the tool returned, so an adapter has a shape to answer with.
An adapter that answered a tool-call leg with an observation of another mechanism gets a `port-contract-violation` from the reducer, which is what stops a tool call from being scored off an HTTP answer.

## Declaring the interface (compile-only reference example)

> **Reference vs. scoring contract:** The mini-lab above used `examples/tutorials/tool-use/contract.json`, which is fully populated with oracles, safety limits, and an interaction plan for execution and scoring. Below is a separate compile-only reference example designed specifically to illustrate the full schema of an `mcp` interface declaration at compile time. It declares neither oracles nor an interaction plan, because `compile` is the only stage it reaches.

Here is a tool server declared as far as the schema allows, inside the smallest contract that can carry it.
The fields above `permittedInterfaces` are the scaffolding every contract declares, at their emptiest legal values, and the interface under them is what this section illustrates.
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
            "requiredKeys": ["ok", "matches", "totalCount"],
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
`Observation.responseStatus` is an integer with no HTTP reading attached (`sealed-run-record.ts:255`), and an adapter is what performs that projection.
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
`/interactions/search/response-body/ok`, `/interactions/search/response-body/matches`, and `/interactions/search/response-body/totalCount` are the three pointers the example above makes addressable.

**Declaring the defect you seeded.**
A probe's `defectSignature` names the published tool name, and its selector filters on the `arguments` channel.

```json
{
  "interfaceKind": "mcp",
  "toolName": "search_notes",
  "observableChannel": "response-body",
  "condition": {
    "selector": {
      "inputBinding": {
        "path": null, "query": null, "header": null, "body": null,
        "argument": null, "option": null, "environment": null, "stdin": null,
        "arguments": { "query": { "matcher": "any" } }
      }
    },
    "predicate": {
      "op": "all",
      "operands": [
        { "op": "equality", "operands": [{ "pointer": "/interactions/observed/response-status" }, { "literal": 0 }] },
        { "op": "equality", "operands": [{ "pointer": "/interactions/observed/response-body/totalCount" }, { "literal": 0 }] }
      ]
    }
  }
}
```

All nine input channels are declared and the eight the kind does not accept are `null`, exactly as a recorded observation spells them.
Prefer a scalar the tool publishes beside a list over the list itself. AD-4's quantifiers abstain on an empty collection, so `for-all` and `for-any` over an empty list resolve `insufficient-evidence` and witness nothing. Three operators read a property of the collection itself and do resolve over one observed present and empty: `count-tolerance` reads its cardinality, `existence` and `absence` read its presence. So `count-tolerance(list, 0, 0)` is the spelling that makes "the list came back empty" a witness, and a quantifier over the same list is not.
Declare that scalar in the descriptor's `requiredKeys`. A server free to omit the field the signature turns on reports the defect as `not-triggered`, and nothing says the evidence was missing.

**About the tool having been called at all.**
`existence` and `absence` over a step's evidence carry that, and the step's own `cardinality` carries how many matches are legitimate.

**The check that matters most.**
A tool call that reports success and changed nothing is the tool-use version of the worked example on [How It Works](/explanation/behavioral-evaluation-contracts/).
Write it as two steps and one `deep-equality` under a `not`: bind the write step's argument, bind a later read step with `after` naming the write, and compare what was sent against what came back on the read.
An oracle over the write step's own response passes on a tool that silently discarded the call.

**Contract-design note: the one-oracle rule.**
When scoring defect detection, `designatedOracleIdOf` resolves an oracle only for a behavior declaring exactly one oracle.
A behavior declaring multiple oracles has no designated oracle, so a defect probe naming it has nothing to attach a detection to.
The tutorial contract authored four behaviors declaring one oracle each for this reason.
`corpus/dev/contracts/notes-tool-server.json` compiles and pre-flights against the same server, but declares four and three oracles for its two behaviors, so defect probes naming either behavior cannot score a caught defect.
The same discipline applies to contracts scored under the [skill guide](/how-to/evaluate-skill-behavior/).

## Running it against your own server

The mini-lab above is the runnable version of this section, against the fixture server this repository ships. Pointing the same commands at a server of your own changes two things and nothing else.

The contract's `logicalId` maps to your server through an `McpTargetPolicy` you write, the way `run-tool-calls.mjs` maps the fixture's.
The observations then come from your run.

A planned mcp leg is issued to whatever port is wired, and `createMcpAdapter` is the one this package ships for it (`src/adapters/mcp-adapter.ts`). Wire another kind's adapter and how it fails is that adapter's: the shipped command-line adapter throws `forbidden-target` on any request that is not `cli`, before it builds anything, and an adapter that answered with an api or cli observation instead reaches the reducer, which reports `port-contract-violation`.

What the shipped adapter does.
`EnvironmentProbePort` has one method, `probe`, taking a `ProbeRequest` and an `AbortSignal` and returning a `ProbeObservation` (`src/ports/environment-probe-port.ts`).
An `McpTargetPolicy` maps the contract's logical interface identifier to a server the adapter launches, and lists the tools that server may be asked for; a request naming either an interface or a tool the mapping omits is refused with `forbidden-target` before a process starts. One session per invocation covers launch, `initialize`, `tools/call`, and teardown, bounded by `maxElapsedMs`, and `maxOutputBytes` caps the server's stdout and its stderr on their own.
A tool result carrying `isError: true` resolves, and so does a JSON-RPC error answering `tools/call`, with the error object as the result. That is the rule a tool-use adapter would break first: an MCP error result is the payload the seeded-fault check reads, and an adapter that throws on it makes the whole pre-flight vacuous.

The transport is stdio and nothing else. A server reached over Streamable HTTP speaks the same JSON-RPC across a socket, and this package performs no network I/O at all, so that server needs your own `EnvironmentProbePort` behind the same mapping rule (AD-35). `eval-quality/conformance` is what proves one: the six shared assertions run against any subject, and `runMcpProbeConformance` adds eight more, over an authorized tool call reaching its server, the two denials AD-35 asks a tool-server mapping for, a tool-reported error read as an observation, a declared argument that has to arrive byte for byte, the structured result the descriptor describes, and both caps.

## Where this stands

**Runs end to end, and you can re-run it.** The mini-lab compiles an `mcp` contract under every discipline rule, plans a pre-flight whose legs are tool-call requests, completes that pre-flight against `createMcpAdapter` over a real stdio tool server, and scores a seeded tool-use defect to `caught`. The observations it scores are the bytes a live run produces, compared on every build. Wire an adapter of another mechanism and the shipped command-line adapter denies the request with `forbidden-target`, while an adapter answering with another mechanism's observation gets `port-contract-violation`.

**Scores a probe.** A defect signature declares the tool name, the qualification gate admits the kind, and a recorded tool call's arguments are addressable, so a seeded tool-use defect is qualified and matched against a sealed run record.

**Missing.** A channel model for a text-shaped tool result.

**Already works, and this is the part worth knowing before you fund any of it.** Both sides of the exchange accommodate the kind today. `Observation` in the sealed run record is not discriminated on kind (`sealed-run-record.ts:229`), so what a tool answered has somewhere to live. `foreignChannels` (`qualification.ts:187`) confines a tool-use signature to `response-body`, `response-status`, and its own `call-inputs`, which is the same answer compile-time reachability gives, a confinement the code decides. All three carry a value once the adapter runs: the structured result lands on `response-body`, the error flag on `response-status`, and the tool call's arguments on `call-inputs`. `response-headers` is not among them; `foreignChannels` hands it to a tool-use signature as foreign, so a signature naming it is refused. `ObservedCallInputs` (`sealed-run-record.ts:204`) carries a key per input channel, `arguments` among them.

**Unproven, and this is the uncomfortable part.** The calibration record behind this project's central measurement is itself MCP-shaped. The architecture records that every contract in the phase-2 block that produced the 0.33-to-1.00 result declares an MCP tool interface, and that 22 of 25 real contracts use the kind. Those contracts were transcribed into API shape to be compiled here, and a transcription is not the measured artifact. So `mcp` is the most-used kind in the prior art and the one this package reached last.

**What a first adopter hits.** In order: a tool server reached over HTTP, then the response descriptor against a tool that returns prose. The first needs your own `EnvironmentProbePort`, because the shipped adapter speaks stdio and this package opens no socket. The second is a stated boundary: the descriptor describes a tool's structured result, and a tool that answers with markdown alone is outside the kind's first version.

**The first reading runs today, and here is what that cost.** For the first reading, TEA's own move stays workable and stays cheaper than writing an adapter: put the tool-calling agent behind a command, declare a `cli` interface, and evaluate the run through its arguments, its streams, and the files it writes.

That route was run end to end against the built CLI at 3.0.0.
A contract whose one operation declares the tool-call log in `artifacts` and nominates it with `descriptorChannel` compiles and seals at exit `0`, an oracle quantifies over the calls inside the log, and pre-flight resolves at exit `0` with all six checks satisfied, including a sensitivity witness and a manifestation witness whose legs both address the file.
Carrying those files forward from 1.4.2 costs two stamps and one key: the contract is `schemaVersion` 5, the probe is 5, and the defect signature's input binding declares `"arguments": null`.

One restriction shapes it, and it lands on the scoring side only.
A defect signature naming the log by identifier is refused with `condition-artifact-channel-contract-local`, in both the tailed spelling `/interactions/observed/artifact/tool-calls/calls` and the bare `/interactions/observed/artifact/tool-calls`, and `sealProbeSet` then admits nothing.
Print the log as JSON on the stream the descriptor nominates and the same seeded defect qualifies with an empty failure list.
The file stays declared in `artifacts` even then, and an existence oracle with no tail still reaches it. Every other pointer at the file has to move with the descriptor. Once `stdout` is nominated, a tailed oracle pointer into the log is `unreachable-check-evidence`, so the structural oracle addresses the stream. A sensitivity witness leg pointed at the file is refused under that code too, tailed or bare, because pre-flight builds each leg from the nominated channel, `call-inputs`, and the exit code; the witness moves to the stream beside the signature. Such a leg compiled under 1.4.2 with both of its sides resolving absent, which is the false pass the rule closes.
[Evaluate agent behavior](/how-to/evaluate-agent-behavior/) states the restriction in full.

## In BMAD terms

No BMAD module evaluates tool use.

The nearest thing that exists is TEA, and it is one interface kind over.
Every contract in `test/contracts/` of the `bmad-method-test-architecture-enterprise` repository declares `kind: "cli"`: `test-review.contract.json`, `trace.contract.json`, and the eight under `test/contracts/fragment-selection/`.
Each one wraps an agent workflow run behind a command and evaluates what came back on the command's own channels.

The agent chooses, the harness records what it chose, and an oracle over the recording decides whether the choice was right.
That is the first reading, working, in a shipped module.
The second reading, whose system under test is the tool server itself, is what the `mcp` kind and `createMcpAdapter` now answer, and no TEA contract has been moved onto it yet.
