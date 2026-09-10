---
title: "Evaluate Agent Behavior"
description: "Contract an agent you invoke from the command line: what it writes, what it exits with, and how to prove your checks catch a defect you planted."
sidebar:
  order: 2
---

# Evaluate agent behavior

An agent, here, is a program you invoke from the command line.
It reads options and environment variables, does its work, writes one or more files, prints something, and exits.
That system shape maps to the `cli` interface kind, and each operation on it is a `CommandOperation` in `src/core/schemas/interface.ts`.

This page covers the parts specific to that shape.
For what a contract declares in general, how to read a compile rejection, and how to seal a brief, read [the full walkthrough](/how-to/author-behavioral-contracts/) first.

## What you are evaluating

Agent behavior is what the agent did, read off what it left behind.
A contract declares the operation the agent exposes, the checks over its output, and a sensitivity witness proving the agent actually reads the inputs it accepts.

`eval-quality` runs nothing under evaluation on its own.
`compile`, `seal`, the pre-flight reduction, and the score chain are transformations over JSON.
Two components start a process, and a caller wires each up deliberately: `createCommandLineAdapter` in `src/adapters/command-line-adapter.ts`, supplying a `CommandTargetPolicy` that maps a logical executable name to a real file, and `createMcpAdapter` in `src/adapters/mcp-adapter.ts`, supplying an `McpTargetPolicy` that maps a logical interface identifier to a tool server it launches over MCP's stdio transport.

Three things this cannot see.

**The agent's reasoning.**
An observation is one invocation and what came back from it.
There is no transcript channel and no per-turn record.
A tool-call log the agent writes to a file the operation declares is addressable, under [the restriction below](#the-restriction-that-bites-here): oracles and witnesses reach it, and a defect signature does not.

**A sequence of calls.**
`ProbeStepSelector` in `src/core/schemas/defect-signature.ts` drops the temporal clause the contract-side selector carries, because a corpus signature maps one probe to one observation.
A state-corruption defect that only shows on a second invocation has to be expressible as a predicate over one observation.

**Anything the agent did not write down.**
If a behavior leaves no mark in the exit code, in stdout, in stderr, or in a file the operation declares, no oracle can address it and `compile` says so with `unreachable-check-evidence`.

## What the agent has to give you

A command-kind operation produces four response-side channels, listed as `COMMAND_RESPONSE_CHANNELS` in `src/core/schemas/pointer.ts`: `stdout`, `stderr`, `exit-code`, and `artifact`.
An oracle addresses one of them through an interaction-rooted pointer, `/interactions/{stepId}/{channel}`.

**Exit code.**
`exit-code` is a scalar channel, so the pointer takes no tail: `/interactions/summarize/exit-code` and nothing deeper.
`CommandOperation` declares no success value space for it on purpose; an exit-code assertion is an ordinary oracle over that pointer.
A non-zero exit is an observation: only a policy denial, a cap, an abort, or a failure to start the process throws.
The adapter reports a negative `exitCode` when a signal ended the process.

**Standard output and standard error.**
Both are tail-bearing, and both carry declared structure only where the operation's `descriptorChannel` nominates that stream.
The other stream is addressable for bare presence, and a pointer with a non-empty tail into it is unreachable.

**Files the agent wrote.**
`artifacts` is an array of bare identifiers with existence semantics only.
It says which files the operation writes, and nothing about what is inside them.
Structure comes from the operation's one `responseDescriptor`, and it applies to the single artifact `descriptorChannel` nominates.
Another declared artifact is addressable as `/interactions/{stepId}/artifact/{id}` to assert it exists; a pointer into its contents is unreachable, because nothing declares its shape.
A pointer naming an identifier absent from `artifacts` fails compilation under `unresolved-artifact-reference`.

One descriptor per operation is the rule, so an operation whose stream and whose written file both need declared structure is two operations.

The adapter reads each declared artifact back after the process exits and tags it `json`, `text`, or `absent`.
A file past `maxOutputBytes` raises `budget-exhausted`, so a run that resolves carries whole output.
The same cap applies independently to stdout and to stderr.

### The restriction that bites here

A defect signature cannot address a file the command wrote.

`qualifyProbe` in `src/core/score/qualification.ts` walks every pointer in a signature's discriminating condition, and an `artifact` pointer is refused with `condition-artifact-channel-contract-local`.
The reason is portability.
AD-40 dropped `operationId` from the resolution key because an operation name is contract-local, and an artifact identifier is minted the same way: `/interactions/observed/artifact/verdict` names one file in the contract that declared it and nothing at all in the next contract.
A signature carrying one would parse, compile, and resolve against exactly one contract while looking portable.

A manifestation witness has no such problem and may address an artifact freely, because it is bound to one contract and one leg.
So the split is: pre-flight can read the file, the scoring-side signature cannot.
Plan the seeded defect so its signature lives on `exit-code`, or on the stream the descriptor nominates.

One more rule shapes a workable signature.
The predicate has to name the declared `observableChannel` when that channel is response-side, or name at least two channels of which one is response-side.
Otherwise `qualifyProbe` returns `condition-channels-underspecified`, which exists to reject a condition that only checks that the output contains what was sent.

## Declaring the interface

One agent, one operation, in `permittedInterfaces`.
This block parses against `PermittedInterface`:

```json
{
  "logicalId": "release-notes-agent",
  "kind": "cli",
  "operations": [
    {
      "operationId": "summarize-changes",
      "invocation": { "executable": "release-notes-agent", "subcommandPath": ["summarize"] },
      "stateChangeMarker": true,
      "requestShape": {
        "argument": { "requiredKeys": [], "permittedKeys": [], "types": {} },
        "option": {
          "requiredKeys": ["input", "out"],
          "permittedKeys": ["input", "out", "model"],
          "types": { "input": "string", "out": "string", "model": "string" }
        },
        "environment": {
          "requiredKeys": [],
          "permittedKeys": ["HOME"],
          "types": { "HOME": "string" }
        },
        "stdin": { "requiredKeys": [], "permittedKeys": [], "types": {} }
      },
      "artifacts": ["notes"],
      "descriptorChannel": { "kind": "artifact", "artifactId": "notes" },
      "responseDescriptor": {
        "requiredKeys": ["summary", "entries"],
        "permittedKeys": ["summary", "entries", "generatedAt"],
        "types": { "summary": "string", "entries": "array", "generatedAt": "string" },
        "successIndicator": "/summary",
        "channelRoles": { "/summary": "payload", "/entries": "collection" },
        "collectionLocations": [
          { "pointer": "/entries", "expectedCardinality": { "mode": "at-most", "max": 200 }, "referenceSet": null }
        ]
      },
      "volatilePointers": ["/generatedAt"],
      "sensitivityWitness": {
        "witnessId": "notes-follow-the-input",
        "channel": "option",
        "legs": [
          {
            "legId": "leg-input-alpha",
            "inputs": {
              "argument": {}, "environment": {}, "stdin": { "kind": "absent" },
              "option": { "input": "fixtures/alpha.diff", "out": "notes.json" }
            }
          },
          {
            "legId": "leg-input-beta",
            "inputs": {
              "argument": {}, "environment": {}, "stdin": { "kind": "absent" },
              "option": { "input": "fixtures/beta.diff", "out": "notes.json" }
            }
          }
        ],
        "relation": {
          "op": "not",
          "operands": [
            { "op": "deep-equality", "operands": [
              { "pointer": "/interactions/leg-input-alpha/artifact/notes/entries" },
              { "pointer": "/interactions/leg-input-beta/artifact/notes/entries" }
            ] }
          ]
        }
      }
    }
  ]
}
```

What each part is doing.

`executable` is a logical name (AD-35).
Its `Identifier` charset admits no slash, dot, or colon, so `./bin/agent` and `/usr/local/bin/agent` are parse errors.
The mapping to a real file, the working directory, the artifact paths, the environment keys a call may carry, and the two budgets all live in a `CommandTargetPolicy` the caller supplies, outside the contract.

`subcommandPath` is a list of segments, so two implementations never have to agree on a separator no field declares.

`requestShape` has four channels: `argument`, `option`, `environment`, and `stdin`.
An `argument` key is the author's own label for a position, since no predicate reads argument order.
AD-18 governs `environment` the way it governs an HTTP header: a declaration names a variable and its type and never carries a credential value.
When the adapter runs the process, the child environment is closed to `PATH` plus the declared keys the authorization permits.
The contract above declares `HOME`, so a mapping whose `permittedEnvironmentKeys` omits `HOME` refuses the call before the process starts.
The contract author says which keys a call carries; the operator says which of them may reach the process.

The adapter builds argv as options first, spelled `--{key}`, then positionals, both in the record's own key order.
A `true` value is a bare flag, a `false` value is omitted, and an array value is the repeatable spelling, emitting the flag once per element.

`sensitivityWitness` is mandatory for any operation that declares an input key, and an input-bearing operation declaring `null` fails a strict compile under `undeclared-mandatory-input`.
All four command channels are legal differential channels, unlike the api side, because a command carries its inputs the same way whether or not it changes state.
The relation is declared, because inequality on its own decides nothing: two distinct nonexistent inputs can produce identical answers.

`volatilePointers` names the fields that legitimately change between two runs, and the pre-flight comparisons project them out before comparing.

## Seeding a defect and proving the contract catches it

The twin run needs a defect you planted and know the shape of.
You plant it by editing the agent yourself; `eval-quality` mutates nothing and reads only what the probe declares about the edit.
Take this one: given a diff it cannot parse, the agent writes an empty notes file and exits 0, where a correct agent exits non-zero and says why on stderr.

A probe carries that defect, and each defect carries a **manifestation witness**: which operation to run, with what inputs, and the relation that is true exactly when the seeded fault has fired.
It never enters a score.
Its job is to make "every declared seeded fault was observed to fire" decidable at pre-flight, so a probe that seeds a defect nothing can see is caught before it is scored.

```json
{
  "legId": "manifest-empty-on-malformed",
  "interfaceId": "release-notes-agent",
  "operationId": "summarize-changes",
  "inputs": {
    "argument": {}, "environment": {}, "stdin": { "kind": "absent" },
    "option": { "input": "fixtures/malformed.diff", "out": "notes.json" }
  },
  "relation": {
    "op": "count-tolerance",
    "operands": [{ "pointer": "/interactions/manifest-empty-on-malformed/artifact/notes/entries" }],
    "expected": 0, "tolerance": 0, "relative": false
  }
}
```

The pointer reaches inside the written file, which a witness is allowed to do.
`count-tolerance` over a collection observed to be present and empty resolves `true` from eval-quality 1.4.0; before that it could not, and asserting that a collection is empty was unexpressible.

Pre-flight plans one leg and two checks per seeded defect.

**`seeded-fault-fired`** resolves the relation against the fault leg's own observation and fails when it comes back anything but `true`.
A defect declaring a `null` witness fails this check; there is no exemption.

**`seeded-faults-scoped`** resolves the same relation against the operation's other legs and fails if it fires on one, since a defect that shows everywhere is not scoped to what you planted.

That second check changed in 1.4.0, and the change matters when your witness reuses inputs the contract already declares.
A clean leg is now dropped from the comparison when it issued the fault leg's request and received the fault leg's answer.
Both halves are required, and both are compared as canonical digests: the request with its correlation identifier neutralised, the answer as the projected evidence a relation can address, so a volatile field is already out of it.
Before this, a sensitivity witness leg that happened to spell the manifestation witness's inputs was read as independent evidence, the witness fired on it, and the check reported a scoping violation that was not one.

The same release closed the other half.
`seeded-faults-scoped` now **fails** when no clean leg survives the drop, where it used to report satisfied.
A check that examined nothing has established nothing, and the note names which of the two causes applied: an operation with no leg besides the fault leg, or an operation every one of whose other legs ran the fault leg's own probe.

The scoring side is separate.
The probe's `defectSignature` is what the witness match compares a finding against, and for this defect it rides on the exit code:

```json
{
  "interfaceKind": "cli",
  "invocation": { "executable": "release-notes-agent", "subcommandPath": ["summarize"] },
  "observableChannel": "exit-code",
  "condition": {
    "selector": {
      "inputBinding": {
        "path": null, "query": null, "header": null, "body": null,
        "argument": null,
        "option": { "input": { "literal": "fixtures/malformed.diff" } },
        "environment": null, "stdin": null
      }
    },
    "predicate": {
      "op": "equality",
      "operands": [{ "pointer": "/interactions/observed/exit-code" }, { "literal": 0 }]
    }
  }
}
```

Every pointer in a signature is rooted at the reserved step identifier `observed`, which is a fixed word so no contract-local step name reaches the corpus.
The selector's keys are checked against the home operation's declared request shape, and a key the operation declares nowhere is `condition-selector-key-undeclared`, because a typo there matches no observation and turns into a silently passing run.

## Running it

Compile the contract first, then the two commands that carry a run.
Pre-flight answers whether the environment is fit to be measured:

```bash
eval-quality preflight \
  --contract run/eval-contract.json \
  --probes probes.json \
  --observations observations.json \
  --run-id agent-mutated-1 \
  --out run/preflight-verdict.json
```

It issues no requests of its own.
Either your harness produces the observations, or the library's `runPreflight` drives them through an `EnvironmentProbePort`, which is where `createCommandLineAdapter` goes.
Each observation echoes its leg id back as `probeId` and carries `kind: "cli"`, an `exitCode`, `stdout`, `stderr`, and an `artifacts` map.

Then score the sealed run record your evaluator produced:

```bash
eval-quality score \
  --record sealed-run-record.json \
  --contract run/eval-contract.json \
  --probe probe.json \
  --preflight-verdict run/preflight-verdict.json \
  --policy scoring-policy.json \
  --isolation-manifest isolation-manifest.json \
  --evaluator-configuration evaluator-configuration.json \
  --corpus-digest <digest> \
  --out run/evidence-artifact.json
```

A probe rejected by the qualification gate lands the run on the Invalid rung, exit `3`, and the command writes one line per reason to stderr as `eval-quality: <code>: <artifactPath>: <detail>`.
`QUALIFICATION_FAILURES` publishes the closed set of codes those lines draw from, so a rejection is something you can branch on.

## Where this stands

Proven.
The `cli` interface kind compiles, and `corpus/dev/contracts/` ships three contracts describing a system behind a command.
Pre-flight plans and reduces command legs, including sensitivity witnesses, manifestation witnesses, and the fixture reset.
`createCommandLineAdapter` runs a real child process with `shell: false`, an enforced elapsed cap, an output cap per stream and per artifact, and an artifact map read back tagged.
The whole chain has been run end to end against a real agent CLI, and the numbers are below.

Not proven, and worth knowing before you plan a corpus.
A defect signature still cannot address a written file, so a defect whose only observable is file content has no scoring-side signature today.
One `score` invocation is a trial set of one, so a policy whose declared minimum exceeds one produces a strength vector marked non-comparable.
There is no multi-turn or transcript surface, so an agent whose interesting behavior is a conversation is out of shape for this.
The interface vocabulary also names `web`, and a contract declaring it is rejected with `unsupported-interface-kind`.

## In BMAD terms

TEA's `test-review` suite is the worked instance, and it is the best-proven case in this family.

`test/contracts/test-review.contract.json` declares one `cli` interface, `tea-test-review`, with one operation, `review-test-files`.
Its invocation is the logical executable `tea-test-review` with an empty subcommand path.
It declares three required options (`files`, `json`, `agent`), permits five more, permits six environment variables, writes two artifacts (`verdict` and `report`), and nominates `verdict` as its descriptor channel.
The mapping from that logical name to `cli/test-review.js` lives in `test/lib/probe-targets.js`, outside the contract.

Eleven probes run against it: nine `defect` probes, one `zero-action` clean control, and one `gameability` probe.
At eval-quality 1.4.0, all nine defect probes are exercised and caught, a defect rate of `1`, recorded in `test/probes/expected-strength.json`.
Each of the nine plants one registry row in a fixture and carries a manifestation witness that reads the `verdict` artifact, plus an exit-code defect signature.

The gameability probe is the one the artifact restriction stopped.
Its signature quantifies over `/interactions/observed/artifact/verdict/findings`, `qualifyProbe` returns `condition-artifact-channel-contract-local`, and the run lands on the Invalid rung with exit `3`.
TEA records that refusal rather than swapping in an exit-code signature that would qualify and discriminate nothing.

The nine caught probes still come back `CONCERNS` rather than `PASS`, on three unsatisfied coverage rules: `malformed-input`, `state-change-read-back`, and `whole-body`.
Those are findings about the contract, which is the point of scoring a contract at all.

For bringing this to another BMAD module in sequence, read TEA's own adoption guide at `docs/explanation/eval-quality-adoption-guide.md` in the test-architecture repository.
