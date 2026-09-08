---
title: "The Full Walkthrough"
description: "Author an eval contract, run all four commands over it, and read a real scored run down to its verdict and exit code."
sidebar:
  order: 1
---

# The Full Walkthrough

[Start Here](/tutorials/getting-started/) compiled a contract. This page is the rest: what a contract declares, how to read a rejection, how to seal and preflight one, what `score` takes, and what a finished scored run looks like field by field.

It ends with the twin run written out as commands.

## What you need

This walkthrough reads files that live in the repository, so work from a clone:

```bash
git clone https://github.com/bmad-code-org/bmad-eval-quality.git
cd bmad-eval-quality
npm ci
npm run build
```

Every command below is `node dist/cli/main.js`, which is the binary inside a clone. Installed from the registry, the same binary is on `PATH` as `eval-quality`.

Set up a scratch directory:

```bash
mkdir -p /tmp/eval-quality-run
```

---

## 1. Start from a contract that compiles

`corpus/dev/contracts/satisfied-declarations.json` is the worked example. It declares one behavior, seven oracles, one interface with two operations, and a four-step interaction plan.

```bash
node dist/cli/main.js compile --in corpus/dev/contracts/satisfied-declarations.json --out /tmp/eval-quality-run/eval-contract.json
echo "exit $?"
```

```text
exit 0
```

The same bytes ship a second time as `corpus/dev/compile-seal-example/contract.json`, next to the sealed brief they produce. The rest of this page uses that path.

## 2. What a contract declares

`schemas/eval-contract.schema.json` is the normative shape, published under `$id: urn:eval-quality:schema:eval-contract`. It sets `additionalProperties: false` and requires twenty-one top-level fields. An absent field and an unrecognized field both fail the parse, so a contract carries all twenty-one, using `null` or an empty collection where it has nothing to say.

| Group | Fields |
| --- | --- |
| Identity and lineage | `schemaVersion`, `contractId`, `parentDigest`, `revisionCount`, `sourceSpecDigest` |
| What is under evaluation | `behaviors`, `oracles`, `rubrics`, `waivers` |
| The surface a probe may touch | `permittedInterfaces`, `siblingGroups`, `interactionPlan`, `scopedResources`, `forbiddenInputs` |
| Data the checks read | `referenceSets`, `testData` |
| Bounds on a run | `budgets`, `safetyLimits`, `probeStepBound` |
| Evidence and fixture handling | `requiredEvidence`, `fixtureReset` |

For the type of each field and every nested shape, read the schema itself. The descriptions inside it carry the reasoning for each constraint. The other eleven schemas cover the remaining artifacts: what `seal` and `preflight` emit, the five a caller hands `score`, and the one `score` mints. All twelve are published at the `eval-quality/schemas/*` subpath, so a consumer reaches them by specifier without knowing the install layout.

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

**Use the corpus as a rule index.** `corpus/dev/contracts/` holds twenty-one contracts: nineteen covering AD-20's seven discipline rules in each declaration state, and two describing a system under test that runs behind a command. Eighteen compile, and three fail by design.

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
node dist/cli/main.js seal --in corpus/dev/compile-seal-example/contract.json --out /tmp/eval-quality-run/sealed-evaluator-brief.json
echo "exit $?"
```

```text
exit 0
```

The brief carries twelve top-level fields: the behaviors, the permitted interfaces narrowed to `logicalId` and `kind`, the scoped resources, the declared principal names, the budgets and limits, the probe step bound, one prose direction per oracle, `contractDigest`, and the three lineage and version fields. The oracle checks, the interaction plan, the reference sets, and the rest of the test data have no field in that shape, so an evaluator reading a brief cannot read the answers off the contract.

`seal` recompiles whatever it is given, so feeding it the compiled artifact from step 1 produces the same brief, byte for byte:

```bash
node dist/cli/main.js compile --in corpus/dev/compile-seal-example/contract.json \
  | node dist/cli/main.js seal \
  > /tmp/eval-quality-run/piped-brief.json
cmp /tmp/eval-quality-run/sealed-evaluator-brief.json /tmp/eval-quality-run/piped-brief.json && echo identical
```

```text
identical
```

`--in` left out reads stdin, which is what makes the pipe work. `-` names stdin explicitly, and at most one input per command may be `-`.

## 5. Preflight the environment

`preflight` answers one question: is the environment fit to be measured? It plans the probe legs the contract implies, reduces the observations you hand it, and mints a verdict for a named run. The command issues no requests of its own, so the observations come from whatever system actually called the target. The library's `runPreflight` can drive a caller-supplied `EnvironmentProbePort` instead.

This contract declares checks that need no probes, so the probe list is empty:

```bash
echo '[]' > /tmp/eval-quality-run/probes.json
```

The plan derives six legs: two sensitivity-witness legs per operation, plus two control-observe legs. Write one observation per leg. Each one echoes its leg id back as `probeId`, and `kind` says which sort of interface it came from, `api` or `cli`:

```bash
cat > /tmp/eval-quality-run/observations.json <<'JSON'
[
  {"kind":"api","probeId":"create-witness-a","interfaceId":"thing-api","operationId":"create-thing","status":201,"headers":{},"body":{"kind":"json","value":{"ok":true,"id":"t-1"}}},
  {"kind":"api","probeId":"create-witness-b","interfaceId":"thing-api","operationId":"create-thing","status":201,"headers":{},"body":{"kind":"json","value":{"ok":false,"id":"t-2"}}},
  {"kind":"api","probeId":"list-witness-a","interfaceId":"thing-api","operationId":"list-things","status":200,"headers":{},"body":{"kind":"json","value":{"items":[{"id":"t-1"}]}}},
  {"kind":"api","probeId":"list-witness-b","interfaceId":"thing-api","operationId":"list-things","status":200,"headers":{},"body":{"kind":"json","value":{"items":[{"id":"t-1"},{"id":"t-2"}]}}},
  {"kind":"api","probeId":"preflight-control-observe","interfaceId":"thing-api","operationId":"list-things","status":200,"headers":{},"body":{"kind":"json","value":{"items":[{"id":"t-1"},{"id":"t-2"},{"id":"t-3"}]}}},
  {"kind":"api","probeId":"preflight-control-observe-2","interfaceId":"thing-api","operationId":"list-things","status":200,"headers":{},"body":{"kind":"json","value":{"items":[{"id":"t-1"},{"id":"t-2"},{"id":"t-3"}]}}}
]
JSON
```

Reduce them into a verdict:

```bash
node dist/cli/main.js preflight \
  --contract corpus/dev/compile-seal-example/contract.json \
  --probes /tmp/eval-quality-run/probes.json \
  --observations /tmp/eval-quality-run/observations.json \
  --run-id run-1 \
  --out /tmp/eval-quality-run/preflight-verdict.json
echo "exit $?"
```

```text
exit 0
```

The verdict went to the `--out` path. One diagnostic line per planned and observed leg went to stderr, so append `2> preflight.log` to capture them.

Read the verdict back:

```bash
node -e "const v=require('/tmp/eval-quality-run/preflight-verdict.json');console.log('passed:',v.passed);for(const c of v.checks)console.log(c.kind,c.operationId,c.outcome)"
```

```text
passed: true
interface-present create-thing satisfied
interface-present list-things satisfied
input-sensitivity create-thing satisfied
input-sensitivity list-things satisfied
state-reset null satisfied
clean-control null satisfied
```

**Watch it discriminate.** Delete the `preflight-control-observe-2` entry from `observations.json` and run the command again. `interface-present` for `list-things`, `state-reset`, and `clean-control` all report `failed`, `passed` becomes `false`, and the command exits `3`. Each check's `note` says why. That is the environment gate refusing an incomplete run.

`score` reads two things off this file: `passed`, to decide whether the run is valid at all, and `fixtureDigest`, as one of the six inputs that fix a scored result's identity.

## 6. What score takes

`score` chains `ingest`, `score`, and `emit` over one sealed run record and mints an evidence artifact carrying the verdict. Nothing in this repository produces a run record, so this step names the inputs and step 7 reads a finished one.

Six inputs are required.

| Flag | What it is |
| --- | --- |
| `--record` | The sealed run record: what your evaluator produced, sealed. Its observations in `sequence` order, its findings, one disposition per oracle, and the run mode. |
| `--contract` | The compiled contract from step 1. |
| `--probe` | The probe the record was run against, carrying the defect signature the witness match reads. |
| `--preflight-verdict` | The verdict from step 5, which has to have passed. |
| `--policy` | The scoring policy: the severity floor, the confidence and catch thresholds, and the minimum trial count. |
| `--corpus-digest` | The one identity input no artifact carries, so the caller attests it. |

Three more are optional, and leaving one out changes the verdict. An absent `--isolation-manifest` or `--evaluator-configuration` invalidates the run, which is exit `3`. A `--private-manifest`, when given, has each entry's digest checked against the bytes `--corpus-root` resolves.

```bash
node dist/cli/main.js score \
  --record sealed-run-record.json \
  --contract /tmp/eval-quality-run/eval-contract.json \
  --probe probe.json \
  --preflight-verdict /tmp/eval-quality-run/preflight-verdict.json \
  --policy scoring-policy.json \
  --isolation-manifest isolation-manifest.json \
  --evaluator-configuration evaluator-configuration.json \
  --corpus-digest <digest> \
  --out /tmp/eval-quality-run
```

The exit code is the verdict. `0` is `PASS`, `WAIVED`, or `CONCERNS`. `2` is `FAIL`. `1` is a `CONCERNS` that `--strict` promoted. `3` is the Invalid rung, and the command writes nothing on it, because no legal evidence artifact carries a null verdict.

One record per invocation is a trial set of one. Whenever your policy's declared minimum exceeds one, the strength vector comes out reported and marked non-comparable.

## 7. Read a scored run

The repository commits one complete chain, generated by running the shipped stages over authored inputs:

```bash
CHAIN=_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/spike-worked-example
```

Read that directory's own `README.md` before copying anything out of it. It keeps three defects in place on purpose, each one the fixture some scoring rule needs.

**The system and the seeded defect.** A toy Notes API with three operations. Four behaviors are contracted; the one that matters is B-001, critical: *a PATCH that reports success has persisted the change*. The seeded defect, D-001, is that `PATCH` validates the input, builds the updated note, returns it with `ok: true` and status 200, and never writes it. The response is indistinguishable from a correct one. Only a later, independent `GET` shows the old value.

**The record shows it.** Five observations, read in `sequence` order:

```bash
node -e "const r=require('./$CHAIN/sealed-run-record.json');for(const o of r.observations)console.log(o.sequence,o.observationId,o.operationId,'sent',JSON.stringify(o.callInputs.body),'title',JSON.stringify(o.responseBody.note?.title ?? null))"
```

```text
1 obs-001 get-note sent null title "Original"
2 obs-002 list-notes sent null title null
3 obs-003 patch-note sent {"title":"Revised"} title "Revised"
4 obs-004 get-note sent null title "Original"
5 obs-005 patch-note sent {"colour":"red"} title "Second"
```

`obs-003` is the write and it reported `Revised`. `obs-004` is the independent read-back, and it returned `Original`. That pair is the defect showing, and O-001 is the read-back oracle that compares them.

**What each oracle resolved to:**

```bash
node -e "const e=require('./$CHAIN/evidence-artifact.json');for(const o of e.outcomes)console.log(o.oracleId,o.state,o.disposition,o.corroboration)"
```

```text
O-001 caught violated agrees
O-002 confirmed held agrees
O-003 confirmed held agrees
O-004 abstained held agrees
O-005 unreached held disagrees
```

Each row is one check resolved to one of twelve closed outcome states, decided from the check's own resolution, the evaluator's disposition, and whether the two agree.

- **O-001 is `caught`.** The check compared the title sent in `obs-003` with the title read back in `obs-004` and resolved `false`. The evaluator's disposition agrees. Then the witness match ran: the finding cites `obs-004`, and `obs-004` matches the probe's declared defect signature exactly. The signature match is what turned a claim into a detection.
- **O-004 is `abstained`.** The collection oracle quantifies over every note in `obs-002`, and `obs-002` returned an empty list. A for-all over zero records certifies nothing.
- **O-005 is `unreached`.** No observation made the malformed-write call. The disposition narrates a rejection that nothing recorded, so corroboration `disagrees`.

**The verdict:**

```bash
node -e "const e=require('./$CHAIN/evidence-artifact.json');console.log(e.mode,e.contractVerdict,'exit',e.exitCode);console.log(e.verdictBasis)"
```

```text
contract-scoring FAIL exit 2
[ 'oracle O-004 resolved abstained at or above the severity floor' ]
```

The mode is `contract-scoring`, so that ladder runs. It is total and first-match-wins over the tiers Invalid, FAIL, CONCERNS, WAIVED, PASS. Nothing in the Invalid tier fired. In the FAIL tier one row did: O-004 resolved `abstained`, its severity is `material`, and the policy's floor is `material`. Rows in the CONCERNS tier held too, including the unreached oracle and the trial count below the minimum, and none of them appears in the basis because FAIL sits above CONCERNS.

**The strength vector, reported and marked non-comparable:**

```bash
node -e "const e=require('./$CHAIN/evidence-artifact.json');console.log(JSON.stringify(e.strength.vector));console.log(e.strength.comparable,'|',e.strength.note)"
```

```text
{"defect":{"caught":1,"exercised":1,"rate":1},"gameability":null,"zero-action":null}
false | 1 admitted probe over 1 completed trial. Below the declared minimum of 3. O-005 resolved unreached. The vector is reported and marked non-comparable.
```

One defect probe was exercised and caught, so the defect rate is 1. The other two probe classes were not exercised. The policy asked for three trials and the run completed one, so `comparable` is `false`: this number may be reported and may not be compared with another.

**You cannot re-run this chain from the command line.** Its record points at a private-storage isolation manifest whose declared digest no bytes produce, and `score` resolves a private reference and checks it. The generator calls the stages as functions and never resolves the reference, which is why the committed artifact exists. A real run's record points at real bytes, and the check passes.

## The twin run, as commands

The loop on [How It Works](/explanation/behavioral-evaluation-contracts/) is these commands run over two arms. The contract, the brief, the policy, and the evaluator configuration are shared. Each arm has its own probe, its own preflight, its own evaluator run, and its own record. Every file named `clean-*` or `mutated-*` is one your harness produces.

Compile and seal once. The brief is what both evaluator runs receive, and its `contractDigest` is how you later prove both arms ran the same contract:

```bash
node dist/cli/main.js compile --in contract.json --out run/eval-contract.json
node dist/cli/main.js seal --in contract.json --out run/sealed-evaluator-brief.json
```

Preflight each arm. An arm that does not pass exits `3` and stops there, because a measurement over an unfit environment says nothing about the contract:

```bash
node dist/cli/main.js preflight --contract run/eval-contract.json \
  --probes clean-probes.json --observations clean-observations.json \
  --run-id clean-1 --out run/clean-preflight-verdict.json
node dist/cli/main.js preflight --contract run/eval-contract.json \
  --probes mutated-probes.json --observations mutated-observations.json \
  --run-id mutated-1 --out run/mutated-preflight-verdict.json
```

Run the evaluator on each arm, in your harness, with the brief and nothing else from the contract. Seal what it produced into a run record per arm, with `mode: "contract-scoring"` on both, and write the isolation manifest and evaluator configuration each ran under.

Score each arm with its own probe. The clean arm's probe is a clean control, `expectedClean: true`. The mutated arm's probe declares the defect it seeded, `expectedClean: false`, with the signature the witness match reads:

```bash
node dist/cli/main.js score --record clean-record.json \
  --contract run/eval-contract.json --probe clean-probe.json \
  --preflight-verdict run/clean-preflight-verdict.json --policy scoring-policy.json \
  --isolation-manifest clean-isolation-manifest.json \
  --evaluator-configuration evaluator-configuration.json \
  --corpus-digest <digest> --out run/clean-evidence-artifact.json
node dist/cli/main.js score --record mutated-record.json \
  --contract run/eval-contract.json --probe mutated-probe.json \
  --preflight-verdict run/mutated-preflight-verdict.json --policy scoring-policy.json \
  --isolation-manifest mutated-isolation-manifest.json \
  --evaluator-configuration evaluator-configuration.json \
  --corpus-digest <digest> --out run/mutated-evidence-artifact.json
```

Then read the two artifacts. On the clean arm the oracles should resolve `passed-clean-control` and the verdict should be `PASS`, exit `0`. On the mutated arm the oracle the defect targets should resolve `caught`, which in `contract-scoring` mode is the contract succeeding. An oracle that resolves `missed` on the mutated arm is the blind spot the loop exists to find.

Compare `scoringVersion` across the two artifacts before comparing anything else in them. Two results compare only when it agrees.

## Two guards worth knowing

**`--out` may not overwrite an input.** The CLI resolves both paths and then asks the filesystem whether they name the same file, so a symlink and a case-insensitive spelling are caught too. A collision exits `64`:

```text
eval-quality: usage: --out resolves to "/tmp/eval-quality-run/eval-contract.json", which is also --in "/tmp/eval-quality-run/eval-contract.json"
```

**One stdin cannot serve two readers.** Naming `-` on more than one input of the same command exits `64`:

```text
eval-quality: usage: only one input may read stdin, but --contract, --probes, --observations all name "-"
```

## Related pages

- [CLI reference](/reference/cli-commands/): every flag, every exit code, and the package exports
- [Glossary](/reference/glossary/): every noun used above
- [How It Works](/explanation/behavioral-evaluation-contracts/): the twin run and why compile rejects contracts
