---
title: "Evaluate Agent Behavior"
description: "Contract an agent you invoke from the command line, and watch a contract catch a defect that leaves the exit code looking clean."
sidebar:
  order: 2
---

# Evaluate agent behavior

An agent, here, is a program you invoke from the command line.
It reads options and environment variables, does its work, writes one or more files, prints something, and exits.
That system shape maps to the `cli` interface kind, and each operation on it is a `CommandOperation` in `src/core/schemas/interface.ts`.

Agent behavior is what the agent did, read off what it left behind: the exit code, the two streams, and the files it declares.

This page runs one small agent end to end.
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
mkdir -p /tmp/eval-quality-agent
```

> If you read the twin-run diagram in [How It Works](/explanation/behavioral-evaluation-contracts/#the-twin-run), this lab is mainly walking the right-hand arm. We start by showing the healthy behavior so you know the baseline, then plant one known defect, preflight that mutated environment, evaluate it, and score whether the evaluation caught the defect. A complete twin run would also produce and score a separate clean-arm run.

```text
Full twin run

       Clean SUT                  Mutated SUT
          ↓                           ↓
      Evaluation                  Evaluation
          ↓                           ↓
        Score                       Score
          └───────────┬──────────────┘
                      ↓
          Did the evaluation discriminate?


This mini-lab

       healthy behavior shown
               ↓
         mutation planted
               ↓
          Mutated Agent
               ↓
            Preflight
               ↓
           Evaluation
               ↓
             Score
               ↓
          defect caught
```

The exercise shows healthy behavior and includes clean-control evidence during preflight, but it does not produce and score a separate clean-arm Evidence Artifact. It exercises the mutated arm of that larger discipline.

### 1. Run the agent

`examples/tutorials/agent/release-notes-agent.mjs` reads a changelog and writes structured release notes.

> The release-notes domain is arbitrary. This tiny agent exists only to demonstrate the `cli` system shape without requiring a model, credentials, or an external service. The same pattern applies to a real coding agent, review agent, orchestration agent, or other CLI-driven AI system.

The core lesson is how any CLI agent maps to evaluation:

```text
CLI system
→ inputs
→ exit code / stdout / stderr / files
→ observable behavior
→ evaluation
```

It is a few dozen lines, needs no model and no credentials, and is a stand-in for whatever agent you would really put here.

<!-- expect-exit: 0 -->

```bash
node examples/tutorials/agent/release-notes-agent.mjs summarize --input examples/tutorials/agent/alpha.changelog --out /tmp/eval-quality-agent/notes.json
```

It writes the file and prints nothing. Read it back through the agent's other operation:

<!-- expect-exit: 0 -->

```bash
node examples/tutorials/agent/release-notes-agent.mjs show --notes /tmp/eval-quality-agent/notes.json
```

```text
{
  "summary": "3 change(s)",
  "entries": [
    {
      "type": "added",
      "description": "a second changelog fixture"
    },
    {
      "type": "fixed",
      "description": "the summary counted blank lines"
    },
    {
      "type": "changed",
      "description": "entries carry their own type"
    }
  ],
  "source": "alpha.changelog"
}
```

### 2. Watch it refuse a changelog it cannot parse

`examples/tutorials/agent/broken.changelog` has a line with no type in front of it. A correct agent refuses it:

<!-- expect-exit: 1 -->

```bash
node examples/tutorials/agent/release-notes-agent.mjs summarize --input examples/tutorials/agent/broken.changelog --out /tmp/eval-quality-agent/broken-notes.json
```

```text
release-notes-agent: cannot parse line 2 of broken.changelog
```

Exit `1`, and the reason is on stderr.

### 3. Plant the defect

Now the same input against the agent with a defect in it. In a real twin run you make this edit by hand and put it back afterwards; the fixture carries a `--defective` flag so you can see it without editing anything.

<!-- expect-exit: 0 -->

```bash
node examples/tutorials/agent/release-notes-agent.mjs summarize --input examples/tutorials/agent/broken.changelog --out /tmp/eval-quality-agent/defective-notes.json --defective
```

Exit `0`, and nothing on stderr.
Read what it wrote:

<!-- expect-exit: 0 -->

```bash
node examples/tutorials/agent/release-notes-agent.mjs show --notes /tmp/eval-quality-agent/defective-notes.json
```

```text
{
  "summary": "",
  "entries": [],
  "source": "broken.changelog"
}
```

**This is the defect worth contracting against.** The agent swallowed an input it could not parse, wrote an empty notes file, and exited `0`. A check over the exit code alone reports success. A pipeline downstream of it publishes empty release notes.

Before and after the mutation:

```text
Healthy agent

malformed changelog
→ reject input
→ stderr explains why
→ exit 1


Mutated agent

malformed changelog
→ silently accept input
→ write empty release notes
→ exit 0
```

A naive evaluation that checks only for exit `0` would accept the mutated behavior. That is why this defect is useful for the tutorial: catching it requires examining the agent's actual behavioral evidence rather than trusting exit codes alone.

### 4. Compile the contract

```bash
node dist/cli/main.js compile --in examples/tutorials/agent/contract.json --out /tmp/eval-quality-agent/eval-contract.json
```

Exit `0`.

The contract declares two operations, and the split between them is the point.
`summarize-changes` nominates the written file as its descriptor channel, so an oracle and the manifestation witness can read inside it.
`show-notes` nominates `stdout`, and it changes no state, which is what gives the plan an operation to observe with.

### 5. Preflight

```bash
node dist/cli/main.js preflight \
  --contract examples/tutorials/agent/contract.json \
  --probes examples/tutorials/agent/probes.json \
  --observations examples/tutorials/agent/observations.json \
  --run-id agent-run-1 \
  --out /tmp/eval-quality-agent/preflight-verdict.json
```

```bash
node -e "const v=require('/tmp/eval-quality-agent/preflight-verdict.json');console.log('passed:',v.passed);for(const c of v.checks)console.log(c.kind,c.operationId,c.outcome)"
```

```text
passed: true
interface-present summarize-changes satisfied
interface-present show-notes satisfied
input-sensitivity summarize-changes satisfied
input-sensitivity show-notes satisfied
state-reset null satisfied
clean-control null satisfied
seeded-faults-scoped summarize-changes satisfied
seeded-fault-fired summarize-changes satisfied
```

The last two are the pair this shape turns on.

`seeded-fault-fired` resolves the manifestation witness against the fault leg's own observation, and that witness reads inside the written file: it counts the entries and asserts there are none. It passes, which is pre-flight confirming that the defect you planted can actually be seen.

`seeded-faults-scoped` resolves the same relation against the operation's other legs and fails if it fires on one, since a defect that shows everywhere is not scoped to what you planted.

#### What preflight just proved

```text
Can the operations be observed?              YES
Do their inputs actually affect behavior?    YES
Did the planted defect actually fire?        YES
Was the defect scoped to the intended case?  YES
```

Preflight has not decided whether the evaluator caught the defect. It established that the experiment is valid enough to score.

### 6. Score it

```bash
node dist/cli/main.js score \
  --record examples/tutorials/agent/sealed-run-record.json \
  --contract /tmp/eval-quality-agent/eval-contract.json \
  --probe examples/tutorials/agent/probe.json \
  --preflight-verdict /tmp/eval-quality-agent/preflight-verdict.json \
  --policy examples/tutorials/agent/scoring-policy.json \
  --isolation-manifest examples/tutorials/agent/isolation-manifest.json \
  --evaluator-configuration examples/tutorials/agent/evaluator-configuration.json \
  --corpus-digest sha256:30e5785d5779258ef9f2edc81f8f14e1749a2a932110278cff32ff8ca10d613f \
  --out /tmp/eval-quality-agent/evidence-artifact.json
```

```bash
node -e "const e=require('/tmp/eval-quality-agent/evidence-artifact.json');for(const o of e.outcomes)console.log(o.oracleId,o.state,o.disposition,o.corroboration);console.log(e.mode,e.contractVerdict,'exit',e.exitCode);console.log(JSON.stringify(e.strength.vector))"
```

```text
O-001 caught violated agrees
O-002 confirmed held agrees
O-003 confirmed held agrees
O-004 confirmed held agrees
O-005 confirmed held agrees
contract-scoring CONCERNS exit 0
{"defect":{"caught":1,"exercised":1,"rate":1},"gameability":null,"zero-action":null}
```

### 7. The lesson

#### What just happened

```text
We planted a known defect.
        ↓
Preflight proved the defect really appeared.
        ↓
The evaluator examined the mutated agent.
        ↓
Score checked the evaluator's claim
against the recorded evidence.
        ↓
The planted defect was caught: 1 / 1.
```

Look at the resulting verdict pair:

```text
defect caught        ✅
contract verdict     CONCERNS
```

These two results are compatible:

- The **defect score** answers: *Did this evaluation detect this known defect?*
- The **contract verdict** answers: *Is the evaluation contract strong enough overall?*

This lab caught its planted defect while still exposing coverage gaps and an insufficient trial count. The verdict basis names three unsatisfied coverage rules alongside the trial-set shortfall:

```text
coverage gap malformed-input unsatisfied at or above the severity floor
coverage gap per-record unsatisfied at or above the severity floor
coverage gap sibling-cross-check unsatisfied at or above the severity floor
1 completed trials below the declared minimum of 3
```

Those are findings about the contract, which is what scoring a contract is for. A defect rate of `1` beside a CONCERNS verdict is the ordinary shape of a real result, and [contract strength](/explanation/contract-strength/) says how to read the pair.

#### Manifestation witness vs defect signature

Keep the distinction clear in your mental model:

```text
manifestation witness
→ used by PREFLIGHT
→ proves the planted defect actually happened

defect signature
→ used by SCORE
→ proves the evaluator actually detected that defect
```

For this lab:

```text
manifestation witness
→ empty generated notes artifact

defect signature
→ malformed input + exit code 0
```

**The witness and the signature live on different channels, and that is a rule rather than a style choice.**

The manifestation witness read the written file, because pre-flight is bound to one contract and one leg and an artifact identifier means something there.
The defect signature rides the exit code, because a signature carrying an artifact identifier is refused under `condition-artifact-channel-contract-local`: that identifier is minted per contract and would resolve against exactly one contract while looking portable.

You just watched both halves work on the same defect. The section below explains why the restriction exists.

## Key takeaways

* The release-notes agent is only a deterministic stand-in for a real CLI-driven agent.
* This lab mostly exercises the mutated arm of the clean/mutated twin-run model.
* Preflight proves the planted defect is observable and properly scoped.
* Score proves whether the evaluator actually caught that defect from evidence.
* A caught defect does not imply the whole evaluation contract is strong.
* Here the defect was caught `1/1`, while the contract still returned `CONCERNS` because of coverage gaps and the trial minimum.
* A full twin run would separately evaluate and score the clean system and the mutated system, then compare whether the evaluation discriminated between them.

---

> **You can stop here if you only wanted the hands-on tutorial.**
>
> Everything below is reference material for authors building their own `cli` evaluation contracts: response channels, artifact restrictions, interface declarations, adapters, manifestation witnesses, and defect signatures.

## Three things this cannot see

**The agent's reasoning.**
An observation is one invocation and what came back from it.
There is no transcript channel and no per-turn record.
A tool-call log the agent writes to a file the operation declares is addressable, under [the restriction below](#the-restriction-that-bites-here): oracles and witnesses reach it, and a defect signature does not.

**A sequence of calls.**
`ProbeStepSelector` in `src/core/schemas/defect-signature.ts` drops the temporal clause the contract-side selector carries, because a corpus signature maps one probe to one observation.
A state-corruption defect that only shows on a second invocation has to be expressible as a predicate over one observation.

**Anything the agent did not write down.**
If a behavior leaves no mark in the exit code, in stdout, in stderr, or in a file the operation declares, no oracle can address it and `compile` says so with `unreachable-check-evidence`.

`eval-quality` runs nothing under evaluation on its own.
`compile`, `seal`, the pre-flight reduction, and the score chain are transformations over JSON.
Two components start a process, and a caller wires each up deliberately: `createCommandLineAdapter` in `src/adapters/command-line-adapter.ts`, supplying a `CommandTargetPolicy` that maps a logical executable name to a real file, and `createMcpAdapter` in `src/adapters/mcp-adapter.ts`, supplying an `McpTargetPolicy` that maps a logical interface identifier to a tool server it launches over MCP's stdio transport.

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

One descriptor per operation is the rule, so an operation whose stream and whose written file both need declared structure is two operations. The lab's contract splits exactly that way.

The adapter reads each declared artifact back after the process exits and tags it `json`, `text`, or `absent`.
A file past `maxOutputBytes` raises `budget-exhausted`, so a run that resolves carries whole output.
The same cap applies independently to stdout and to stderr.

### The restriction that bites here

A defect signature cannot address a file the command wrote.

`qualifyProbe` in `src/core/score/qualification.ts` walks every pointer in a signature's discriminating condition, and an `artifact` pointer is refused with `condition-artifact-channel-contract-local`.
The reason is portability.
AD-40 dropped `operationId` from the resolution key because an operation name is contract-local, and an artifact identifier is minted the same way: `/interactions/observed/artifact/verdict` names one file in the contract that declared it and nothing at all in the next contract.
A signature carrying one would parse, compile, and resolve against exactly one contract while looking portable.

A manifestation witness has no such problem and may address an artifact, because it is bound to one contract and one leg.
What it needs is that the operation's descriptor nominates the file it names.
A pre-flight leg carries the nominated channel, `call-inputs`, and the exit code, so a pointer at a file the descriptor passed over is absent on every leg.
A relation that turns on that pointer alone then resolves the same way on the fault leg and on the clean legs: one that resolves `true` over an absent pointer fires everywhere and `seeded-faults-scoped` fails, one that resolves `false` or `insufficient-evidence` fires nowhere and `seeded-fault-fired` fails.
A relation that reads a carried channel beside it passes both checks, with the pointer at the file contributing nothing to either.
So the split is: pre-flight can read the file, the scoring-side signature cannot.
Plan the seeded defect so its signature lives on `exit-code`, or on the stream the descriptor nominates.

One more rule shapes a workable signature.
The predicate has to name the declared `observableChannel` when that channel is response-side, or name at least two channels of which one is response-side.
Otherwise `qualifyProbe` returns `condition-channels-underspecified`, which exists to reject a condition that only checks that the output contains what was sent.

## Declaring the interface

One agent, one operation per thing it does, in `permittedInterfaces`.
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
That is also why the lab's committed record carries bare file names: a harness invokes the agent in a working directory holding the changelogs, and the policy is what says where that is.

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

## The two artifacts behind the seeded defect

A probe carries the defect, and each defect carries a **manifestation witness**: which operation to run, with what inputs, and the relation that is true exactly when the seeded fault has fired.
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

**`seeded-faults-scoped`** resolves the same relation against the operation's other legs and fails if it fires on one.

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
        "environment": null, "stdin": null, "arguments": null
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

A probe rejected by the qualification gate lands the run on the Invalid rung, exit `3`, and the command writes one line per reason to stderr as `eval-quality: <code>: <artifactPath>: <detail>`.
The Invalid basis follows those lines as `eval-quality: invalid: <reason>`, including one `oracle <id> resolved infrastructure-error` reason per oracle the rejection resolved.
`QUALIFICATION_FAILURES` publishes the closed set of codes those lines draw from, so a rejection is something you can branch on.

## Where this stands

Proven, and re-runnable by you.
The `cli` interface kind compiles, and `corpus/dev/contracts/` ships three contracts describing a system behind a command.
Pre-flight plans and reduces command legs, including sensitivity witnesses, manifestation witnesses, and the fixture reset.
`createCommandLineAdapter` runs a real child process with `shell: false`, an enforced elapsed cap, an output cap per stream and per artifact, and an artifact map read back tagged.
A cap, an abort, or the host's own end, SIGKILL included, kills the process group the child leads, so a model CLI that an agent runner started goes with it; on Windows a cap or an abort kills only the direct child, and a host that ends kills it only through `process.exit()` or an uncaught exception.
A host built as a single executable application has no watchdog, so there the host's end stops the target only through `process.exit()` or an uncaught exception.
The chain above is committed and regenerated on every build, and the whole route has also been run end to end against a real agent CLI, with the numbers below.

Not proven, and worth knowing before you plan a corpus.
A defect signature still cannot address a written file, so a defect whose only observable is file content has no scoring-side signature today.
There is no multi-turn or transcript surface, so an agent whose interesting behavior is a conversation is out of shape for this.
The interface vocabulary also names `web`, and a contract declaring it is rejected with `unsupported-interface-kind`.

The runnable chain above supplies one `--record`, so its strength vector reports one completed trial. Repeat the flag to meet the policy minimum and make the vector comparable. Every record carries a distinct `trialIndex`; every record agrees on `contractDigest`, `evaluatorConfigurationDigest`, `mode`, `evaluatorRecommendation`, and `runId`.

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
Those are findings about the contract, which is the point of scoring a contract at all, and the lab above lands the same way for the same reason.

For bringing this to another BMAD module in sequence, read TEA's own adoption guide at `docs/explanation/eval-quality-adoption-guide.md` in the test-architecture repository.
