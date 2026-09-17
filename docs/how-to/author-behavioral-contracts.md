---
title: "The Full Walkthrough"
description: "Compile, seal, preflight and score one contract end to end, and read the scored run you produced down to its verdict."
sidebar:
  order: 1
---

# The Full Walkthrough

[Start Here](/tutorials/getting-started/) compiled a contract.
This page runs all four commands over one worked example, top to bottom, and ends with you reading a verdict you produced yourself.

Every command below is runnable.
The files they name are either committed in this repository or written by an earlier command on this page, and there is no placeholder anywhere in the path.

## What you need

```bash
git clone https://github.com/bmad-code-org/bmad-eval-quality.git
cd bmad-eval-quality
npm ci
npm run build
```

Every command below is `node dist/cli/main.js`, which is the binary inside a clone.
Installed from the registry, the same binary is on `PATH` as `eval-quality`.

A scratch directory for the artifacts you are about to mint:

```bash
mkdir -p /tmp/eval-quality-run
```

## The worked example

`examples/tutorials/walkthrough/` is a toy Notes API with one behavior under evaluation and one defect planted in it.

The behavior, B-001, is `critical`: **a write that reports success has stored the change.**
Its observable success criterion says how you would see that: an independent read of the same note after a successful write returns the title the write sent.

The planted defect is that the update validates the input, builds the updated note, answers `ok: true` with the new title, and never stores it.
The write's own response is indistinguishable from a correct one.
Only a later, independent read shows the old value.

That directory carries the whole chain: the contract, the pre-flight inputs, the probe declaring the defect, the sealed run record an evaluator produced, and the three caller-side artifacts `score` validates against. Every digest inside it is computed from bytes this repository ships.

## 1. Compile the contract

`compile` reads the authored contract, checks it against the contract schema, checks it against the discipline rules, and writes the compiled artifact.

```bash
node dist/cli/main.js compile --in examples/tutorials/walkthrough/contract.json --out /tmp/eval-quality-run/eval-contract.json
```

Exit `0`, and the artifact is on disk.
It is one line of RFC 8785 canonical JSON with the keys in sorted order, plus a trailing newline. The digest, a fingerprint of the artifact, is computed over that line without the newline, so two machines agree on what the contract is.

An `--out` value ending in `.json` is a file path. Anything else is a directory, and the file inside it is named after the artifact kind.

## 2. What a contract declares

`schemas/eval-contract.schema.json` is the normative shape, published under `$id: urn:eval-quality:schema:eval-contract`.
It sets `additionalProperties: false` and requires twenty-one top-level fields.
An absent field and an unrecognized field both fail the parse, so a contract carries all twenty-one, using `null` or an empty collection where it has nothing to say.

| Group | Fields |
| --- | --- |
| Identity and lineage | `schemaVersion`, `contractId`, `parentDigest`, `revisionCount`, `sourceSpecDigest` |
| What is under evaluation | `behaviors`, `oracles`, `rubrics`, `waivers` |
| The surface a probe may touch | `permittedInterfaces`, `siblingGroups`, `interactionPlan`, `scopedResources`, `forbiddenInputs` |
| Data the checks read | `referenceSets`, `testData` |
| Bounds on a run | `budgets`, `safetyLimits`, `probeStepBound` |
| Evidence and fixture handling | `requiredEvidence`, `fixtureReset` |

For the type of each field and every nested shape, read the schema itself. The descriptions inside it carry the reasoning for each constraint.
The other eleven schemas cover the remaining artifacts: three more minted by a stage, seven a caller writes, and one embedded inside others.
The [glossary](/reference/glossary/) lists all twelve with their producers. All twelve are published at the `eval-quality/schemas/*` subpath, so a consumer reaches them by specifier without knowing the install layout.

The three parts this example turns on are worth naming now, because the rest of the page reads them back.

**The interaction plan** declares three steps: `write` on the update operation, `read-back` on the read operation with `after: "write"`, and `list` on the list operation, also after the write.
The `after` clause is what makes the read independent evidence rather than a read that might have happened first.

**The oracles** are the checks. O-001 compares the title the write sent against the title the read returned, and neither side of it is a literal:

```json
{
  "op": "equality",
  "operands": [
    { "pointer": "/interactions/write/call-inputs/body/title" },
    { "pointer": "/interactions/read-back/response-body/note/title" }
  ]
}
```

**The sensitivity witness** on each operation is two calls differing in one input and a declared relation their responses have to satisfy. It is what establishes that the operation reads the input at all.

## 3. Read a rejection

Two gates run, and they fail differently.

**The schema gate.** A contract that does not match the schema fails before any discipline rule runs. `compile` exits `5`, writes the failure code and the artifact on the first line, then one line per issue, indented, located by a JSON Pointer over the value that failed:

```text
eval-quality: schema-parse-failure: EvalContract: input does not conform to the EvalContract schema
  /behaviors/0/severity: Invalid option: expected one of "low"|"material"|"critical"
  /interactionPlan/0/cardinality: Invalid input: expected string, received undefined
  /oracles/2/direction/evidenceTargets/0: Invalid string: must match pattern ...
```

The list is sorted by location, so a diff between two runs is a real change. It stops at twenty issues and counts the rest. It names the expectation and never prints the value that failed, because this output goes to stderr and a value echoed here would be a value in your logs.

**The discipline gate.** `compile` then checks the contract against the discipline rules, and those rejections exit `4` with their own failure codes. Here is an oracle addressing a request field the operation never declares:

<!-- expect-exit: 4 -->

```bash
node dist/cli/main.js compile --in corpus/dev/contracts/empty-request-shapes.json
```

```text
eval-quality: unreachable-check-evidence: EvalContract.oracles[id=O-005].check.operands[0].operands[0]: "/interactions/create/call-inputs/body/name" addresses call-inputs body field "name", which operation "create-thing" declares in neither requiredKeys nor permittedKeys
```

The pointer resolves to nothing, so the assertion checks evidence that cannot exist.

**Use the corpus as a rule index.** `corpus/dev/contracts/` holds twenty-four contracts: nineteen covering the seven discipline rules, one per declaration state, three describing a system under test that runs behind a command, one describing a tool server whose operations are the tools it publishes, and one describing a service behind HTTP whose plan reads a created record back at the identifier the write returned. Twenty-one compile, and three fail by design.

```bash
node -e "for (const e of require('./corpus/dev/index.json').entries) if (e.structuralFailure) console.log(e.structuralFailure, e.path)"
```

```text
unreachable-check-evidence corpus/dev/contracts/empty-request-shapes.json
unreachable-check-evidence corpus/dev/contracts/no-operation-inventory.json
undeclared-mandatory-input corpus/dev/contracts/no-state-change-marker.json
```

When a rule is unclear, open the contract named after it and the one next to it that satisfies it. `corpus/dev/README.md` explains what the corpus covers and what it leaves out.

## 4. Seal it

`seal` compiles the input and reduces it to a brief the evaluator can be handed:

```bash
node dist/cli/main.js seal --in examples/tutorials/walkthrough/contract.json --out /tmp/eval-quality-run/sealed-evaluator-brief.json
```

Exit `0`.

The brief carries twelve top-level fields: the behaviors, the permitted interfaces narrowed to `logicalId` and `kind`, the scoped resources, the declared principal names, the budgets and limits, the probe step bound, one prose direction per oracle, `contractDigest`, and the three lineage and version fields.
The oracle checks, the interaction plan, the reference sets, and the rest of the test data have no field in that shape, so an evaluator reading a brief cannot read the answers off the contract.

`seal` recompiles whatever it is given, so feeding it the compiled artifact from step 1 produces the same brief, byte for byte:

```bash
node dist/cli/main.js compile --in examples/tutorials/walkthrough/contract.json \
  | node dist/cli/main.js seal \
  > /tmp/eval-quality-run/piped-brief.json
cmp /tmp/eval-quality-run/sealed-evaluator-brief.json /tmp/eval-quality-run/piped-brief.json && echo identical
```

```text
identical
```

`--in` left out reads stdin, which is what makes the pipe work. `-` names stdin explicitly, and at most one input per command may be `-`.

## 5. Preflight the environment

`preflight` answers one question: is the environment fit to be measured?

It plans the probe legs the contract implies, reduces the observations you hand it, and mints a verdict for a named run.
The command issues no requests of its own, so the observations come from whatever system actually called the target. The library's `runPreflight` can drive a caller-supplied `EnvironmentProbePort` instead.

It takes two files beyond the contract, and the difference between them is the whole idea.

**`probes.json`** is the probe list the plan is built from. This chain's probe seeds no fault that pre-flight has to watch fire, so the list is empty, and the file is committed as exactly that:

```bash
cat examples/tutorials/walkthrough/probes.json
```

```text
[]
```

**`observations.json`** is what the environment actually answered, one entry per planned leg. Each one echoes its leg id back as `probeId`, and `kind` says which sort of interface it came from: `api`, `cli`, or `mcp`.

Run it:

```bash
node dist/cli/main.js preflight \
  --contract examples/tutorials/walkthrough/contract.json \
  --probes examples/tutorials/walkthrough/probes.json \
  --observations examples/tutorials/walkthrough/observations.json \
  --run-id notes-run-1 \
  --out /tmp/eval-quality-run/preflight-verdict.json
```

Exit `0`. The verdict went to the `--out` path, and one diagnostic line per leg went to stderr:

```text
eval-quality: preflight: notes-run-1: leg "update-witness-a": planned
eval-quality: preflight: notes-run-1: leg "update-witness-a": observed
```

### Planned and observed

Those two words are the pre-flight model in miniature, and they are worth getting straight the first time you see them.

- **planned**: the contract caused pre-flight to expect that leg.
- **observed**: matching evidence was actually supplied for that planned leg.

```text
contract says what evidence should exist
        ↓
   planned legs

harness or system produces evidence
        ↓
   observed legs

preflight compares the two
        ↓
   passed / failed
```

This contract plans eight legs: two sensitivity-witness legs for each of the three operations, plus the two control legs. The last line of the diagnostic is the reduction:

```text
eval-quality: preflight: notes-run-1: reduced 8 leg(s): passed
```

Read the verdict back:

```bash
node -e "const v=require('/tmp/eval-quality-run/preflight-verdict.json');console.log('passed:',v.passed);for(const c of v.checks)console.log(c.kind,c.operationId,c.outcome)"
```

```text
passed: true
interface-present update-note satisfied
interface-present read-note satisfied
interface-present list-notes satisfied
input-sensitivity update-note satisfied
input-sensitivity read-note satisfied
input-sensitivity list-notes satisfied
state-reset null satisfied
clean-control null satisfied
```

A planned leg with no matching observation is what a failed pre-flight looks like: the affected checks report `failed`, `passed` becomes `false`, each check's `note` says why, and the command exits `3`. That is the environment gate refusing an incomplete run, and it is why `score` reads `passed` before it reads anything else.

## 6. Score it

`score` chains `ingest`, `score`, and `emit` over a trial set and mints an evidence artifact carrying the verdict. This walkthrough supplies one record, so its result records one completed trial. Repeat `--record` with independently sealed records to meet a multi-trial policy minimum.

Six inputs are required, and every one of them is a real file here.

| Flag | What it is |
| --- | --- |
| `--record` | One sealed trial record: what the evaluator produced, sealed. Repeat the flag for each trial. Each record carries its own `trialIndex`. |
| `--contract` | The compiled contract from step 1. |
| `--probe` | The probe the record was run against, carrying the defect signature the witness match reads. |
| `--preflight-verdict` | The verdict from step 5, which has to have passed. |
| `--policy` | The scoring policy: the severity floor, the confidence and catch thresholds, and the minimum trial count. |
| `--corpus-digest` | The one identity input no artifact carries, so the caller attests it. |

Two more matter, and leaving either out changes the verdict.
An absent `--isolation-manifest` or `--evaluator-configuration` invalidates the run, which is exit `3`.

The corpus digest is the value your harness attests for the probe corpus the run was scored against. This chain commits its own at `examples/tutorials/walkthrough/corpus-digest.txt`, and the command below prints that same value.

<!-- expect-exit: 2 -->

```bash
node dist/cli/main.js score \
  --record examples/tutorials/walkthrough/sealed-run-record.json \
  --contract /tmp/eval-quality-run/eval-contract.json \
  --probe examples/tutorials/walkthrough/probe.json \
  --preflight-verdict /tmp/eval-quality-run/preflight-verdict.json \
  --policy examples/tutorials/walkthrough/scoring-policy.json \
  --isolation-manifest examples/tutorials/walkthrough/isolation-manifest.json \
  --evaluator-configuration examples/tutorials/walkthrough/evaluator-configuration.json \
  --corpus-digest sha256:195dd97c3267c9d7c4d5fb6e1fd62212c8993de903b9261c484ef183d6eaaa3a \
  --out /tmp/eval-quality-run/evidence-artifact.json
```

**Exit `2`, and that is the right answer.**
The exit code is the verdict: `0` is PASS, WAIVED, or CONCERNS, `2` is FAIL, `1` is a CONCERNS that `--strict` promoted, and `3` is the Invalid rung, on which the command writes no artifact because no legal evidence artifact carries a null verdict.

Step 7 is why this run came out FAIL, and it is the most useful thing on this page.

One note before you read it. This chain's record points at its isolation manifest with a public reference, which is what lets you score it with no `--corpus-root`. A record pointing at a private reference needs that flag, and `score` then resolves the reference and checks the declared digest against the bytes it found.

## 7. Read the run you just produced

**What the evaluator saw.** Three observations, in `sequence` order:

```bash
node -e "const r=require('./examples/tutorials/walkthrough/sealed-run-record.json');for(const o of r.observations)console.log(o.sequence,o.observationId,o.operationId,'sent',JSON.stringify(o.callInputs.body),'->',JSON.stringify(o.responseBody))"
```

```text
1 obs-001 update-note sent {"title":"Revised"} -> {"note":{"id":"n-1","title":"Revised"},"ok":true}
2 obs-002 read-note sent null -> {"note":{"id":"n-1","title":"Original"},"ok":true}
3 obs-003 list-notes sent null -> {"notes":[]}
```

`obs-001` is the write and it reported `Revised` with `ok: true`.
`obs-002` is the independent read, and it returned `Original`.
That pair is the defect showing, and nothing in the write's own response could have told you.

**What each oracle resolved to:**

```bash
node -e "const e=require('/tmp/eval-quality-run/evidence-artifact.json');for(const o of e.outcomes)console.log(o.oracleId,o.state,o.disposition,o.corroboration)"
```

```text
O-001 caught violated agrees
O-002 confirmed held agrees
O-003 confirmed held agrees
O-004 abstained held agrees
```

Each row is one check resolved to one of twelve closed outcome states, decided from the check's own resolution, the evaluator's disposition, and whether the two agree.

- **O-001 is `caught`.** The check compared the title sent in `obs-001` with the title read back in `obs-002` and resolved `false`. The evaluator's disposition agrees. Then the witness match ran: the finding cites `obs-002`, and `obs-002` matches the probe's declared defect signature exactly. **The signature match is what turned a claim into a detection.** An evaluator that had announced the defect while citing nothing would have got no credit.
- **O-002 and O-003 are `confirmed`.** Both held, and the evaluator agreed. The write did answer `ok` with no error, and the read did return a note.
- **O-004 is `abstained`.** It quantifies over every note the list returned, and the list came back `[]`. A for-all over zero records certifies nothing, so the resolution is `insufficient-evidence` rather than a vacuous `true`. This is the empty-collection rule doing its job, and here it is the defect's second victim: nothing was stored, so nothing was listed.

**The verdict:**

```bash
node -e "const e=require('/tmp/eval-quality-run/evidence-artifact.json');console.log(e.mode,e.contractVerdict,'exit',e.exitCode);console.log(e.verdictBasis)"
```

```text
contract-scoring FAIL exit 2
[ 'oracle O-004 resolved abstained at or above the severity floor' ]
```

The mode is `contract-scoring`, so the contract is the subject rather than the system.
The ladder is total and first-match-wins over the tiers Invalid, FAIL, CONCERNS, WAIVED, PASS.
Nothing in the Invalid tier fired. In the FAIL tier one row did: O-004 resolved `abstained`, its severity is at the policy's floor, and that is the whole basis.
Rows in the CONCERNS tier held too, including the trial count below the minimum, and none of them appears in the basis because FAIL sits above CONCERNS.

**The strength vector:**

```bash
node -e "const e=require('/tmp/eval-quality-run/evidence-artifact.json');console.log(JSON.stringify(e.strength.vector));console.log(e.strength.comparable,'|',e.strength.note)"
```

```text
{"defect":{"caught":1,"exercised":1,"rate":1},"gameability":null,"zero-action":null}
false | 1 admitted probe over 1 completed trial. Below the declared minimum of 3. The vector is reported and marked non-comparable.
```

One defect probe ran, it was caught, so the defect rate is `1`.
The other two probe classes were not exercised.
The policy asked for three trials and the demonstrated `score` command supplies one `--record`, so `comparable` is `false`: this number may be reported and may not be compared with another run's. Repeat `--record` with two more independently sealed trials to meet the minimum.

### The lesson

**`score` verifies from evidence whether the evaluation really caught the defect, while also checking broader contract health. Catching one defect does not make the evaluation contract trustworthy.**

This run is that sentence in one artifact. The contract caught the defect it was pointed at, with a rate of `1`, and the same run came back FAIL because a different check certified nothing.
Reading only the strength vector would have told you the contract was perfect.

[Contract strength](/explanation/contract-strength/) says how far a number like that carries, and why the verdict and the vector are allowed to disagree.

## Next: run a real clean and mutated experiment

> **Template only. Do not run these commands verbatim. The files below are produced by your evaluation harness, and this repository does not ship them.**

Everything above scored one arm. The twin run on [How It Works](/explanation/behavioral-evaluation-contracts/) is these commands run over two: a clean system and the same system with one defect you planted by hand.

The contract, the brief, the policy, and the evaluator configuration are shared. Each arm has its own probe, its own preflight, its own evaluator run, and its own record. No command here performs the mutation; you make that edit yourself.

Compile and seal once. The brief is what both evaluator runs receive, and its `contractDigest` is how you later prove both arms ran the same contract:

```text
eval-quality compile --in contract.json --out run/eval-contract.json
eval-quality seal --in contract.json --out run/sealed-evaluator-brief.json
```

Preflight each arm. An arm that does not pass exits `3` and stops there, because a measurement over an unfit environment says nothing about the contract:

```text
eval-quality preflight --contract run/eval-contract.json \
  --probes clean-probes.json --observations clean-observations.json \
  --run-id clean-1 --out run/clean-preflight-verdict.json
eval-quality preflight --contract run/eval-contract.json \
  --probes mutated-probes.json --observations mutated-observations.json \
  --run-id mutated-1 --out run/mutated-preflight-verdict.json
```

Run the evaluator on each arm, in your harness, with the brief and nothing else from the contract. Seal what it produced into a run record per arm, with `mode: "contract-scoring"` on both, and write the isolation manifest and evaluator configuration each ran under.

Score each arm with its own probe. The clean arm's probe is a clean control, `expectedClean: true`. The mutated arm's probe declares the defect it seeded, `expectedClean: false`, with the signature the witness match reads:

```text
eval-quality score --record clean-record.json \
  --contract run/eval-contract.json --probe clean-probe.json \
  --preflight-verdict run/clean-preflight-verdict.json --policy scoring-policy.json \
  --isolation-manifest clean-isolation-manifest.json \
  --evaluator-configuration evaluator-configuration.json \
  --corpus-digest sha256:... --out run/clean-evidence-artifact.json
eval-quality score --record mutated-record.json \
  --contract run/eval-contract.json --probe mutated-probe.json \
  --preflight-verdict run/mutated-preflight-verdict.json --policy scoring-policy.json \
  --isolation-manifest mutated-isolation-manifest.json \
  --evaluator-configuration evaluator-configuration.json \
  --corpus-digest sha256:... --out run/mutated-evidence-artifact.json
```

Then read the two artifacts. On the clean arm the oracles should resolve `passed-clean-control` and the verdict should be PASS, exit `0`. On the mutated arm the oracle the defect targets should resolve `caught`, which in `contract-scoring` mode is the contract succeeding. An oracle that resolves `missed` on the mutated arm is the blind spot the loop exists to find.

Compare `scoringVersion` across the two artifacts before comparing anything else in them. That comparison is yours to make, and the library makes no such check. [Contract strength](/explanation/contract-strength/) covers `compareDominance`, which is the comparison it does make.

## Two guards

**`--out` may not overwrite an input.** The CLI resolves both paths and then asks the filesystem whether they name the same file, so a symlink and a case-insensitive spelling are caught too. A collision exits `64`:

```text
eval-quality: usage: --out resolves to "/tmp/eval-quality-run/eval-contract.json", which is also --in "/tmp/eval-quality-run/eval-contract.json"
```

**One stdin cannot serve two readers.** Naming `-` on more than one input of the same command exits `64`:

```text
eval-quality: usage: only one input may read stdin, but --contract, --probes, --observations all name "-"
```

## More worked chains

The repository commits three complete chains beyond this one, under `_bmad-output/worked-examples/` and the architecture spike directory.
Each is generated by running the shipped stages over authored inputs and compared byte for byte on every build.
They record outcomes this tutorial does not reach, including a skill defect and a workflow binding a step to a value captured from an earlier response.
They are evidence to read rather than tutorials to run: their records point at private references whose declared digests no file on disk produces, which is exactly the property the chain on this page was built without.

## Related pages

- [Pick your system shape](/how-to/evaluate-agent-behavior/): five guides, each with its own runnable mini-lab
- [CLI reference](/reference/cli-commands/): every flag, every exit code, and the package exports
- [Glossary](/reference/glossary/): every noun used above
- [How It Works](/explanation/behavioral-evaluation-contracts/): the twin run and why compile rejects contracts
