---
title: "Read a Scored Run"
description: "Walk the committed worked chain from contract to evidence artifact, and see how the verdict and the exit code fall out of a scored run."
sidebar:
  order: 2
---

# Read a Scored Run

[Getting Started](/tutorials/getting-started/) ran `compile`, `seal`, and `preflight`. This tutorial covers the fourth command, `score`, by reading a run that has already been scored. `score` consumes artifacts only a real evaluator run produces, and no evaluator runs inside this repository, so the way to see a verdict come out is to read one.

The repository commits one complete chain under `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/spike-worked-example/`. Five JSON files there are generated: `npm run generate:worked-example` runs the shipped `compile`, `seal`, `ingest`, `score`, and `emit` functions over authored inputs and writes them, and `npm run check:worked-example` fails the build when the committed bytes drift from a rebuild. Three prose files beside them are hand-written: `README.md`, `system-under-test.md`, and `FINDINGS.md`. The chain's own `README.md` calls it "not a conforming example" and keeps three defects in place on purpose, each one the fixture some scoring rule needs. Read that file before copying anything out of the directory. And read the chain; do not try to re-run it. Its record points at a private-storage isolation manifest with a placeholder digest, so `score` refuses these files, and step 7 says exactly why.

Every command below runs from a clone after `npm run build`. Set the directory once:

```bash
CHAIN=_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/spike-worked-example
```

The eight nouns of the [core flow](/reference/glossary/) map onto the files like this:

| Noun | Where it is in the chain |
| --- | --- |
| evaluation contract | `eval-contract.json`, and `brief.json` is what `seal` made of it |
| probe | `probe.json` |
| observation | the five `observations` inside `sealed-run-record.json` |
| preflight | an authored `PreflightVerdict`, described in step 5 |
| evidence | the `findings` and `oracleDispositions` inside `sealed-run-record.json` |
| oracle | the five `oracles` in the contract, resolved in `evidence-artifact.json` |
| rubric | none: this contract declares no rubric |
| score / verdict | `evidence-artifact.json` |

---

## The system under test and the seeded defect

`system-under-test.md` is the spec of a toy Notes API: `GET /notes/{id}`, `PATCH /notes/{id}`, and `GET /notes`. It is a forbidden input, `original-spec`, so it never reaches the evaluator. It exists so the contract has something real to describe and so the planted defect is known independently.

Four behaviors are worth contracting. B-001, critical: a `PATCH` that reports success has persisted the change. B-002, material: the `ok` flag agrees with the HTTP status. B-003, material: every note in a collection response is complete. B-004, low: a malformed `PATCH` body is rejected.

The seeded defect is D-001, against B-001. `PATCH` validates the input, builds the updated note, returns it with `ok: true` and status 200, and never writes it. The response is indistinguishable from a correct one. Only a later, independent `GET` shows the old value. That is the shape of defect that needs a read-back oracle, and the twin-run question is whether this contract has one.

---

## Step 1: the contract

`eval-contract.json` is a compiled `EvalContract`, `notes-api-v1`. One interface, `notes-api`, with three operations: `get-note`, `patch-note`, and `list-notes`. Five oracles, one per behavior and two for B-002:

```bash
node -e "const c=require('./$CHAIN/eval-contract.json');for(const b of c.behaviors)console.log(b.id,b.severity,b.oracles.join(','),'|',b.description)"
```

```text
B-001 critical O-001 | A PATCH reporting success has persisted the change.
B-002 material O-002,O-003 | The success indicator agrees with the transport status and excludes a diagnostic.
B-003 material O-004 | Every note in a collection response is complete, not only the first.
B-004 low O-005 | A malformed PATCH body is rejected rather than silently accepted.
```

The interaction plan declares the five steps the oracles address: `baseline-read`, `write`, `read-back`, `collection`, and `malformed-write`. `read-back` carries `after: "write"`, and that temporal clause is what lets O-001 compare the title sent to `patch-note` with the title a later `get-note` returned. O-001 is the read-back oracle, and it is the reason the contract can catch D-001 at all.

The file is `compile` output, and `compile` accepts it again unchanged:

```bash
node dist/cli/main.js compile --in $CHAIN/eval-contract.json > /dev/null
echo "exit $?"
```

```text
exit 0
```

---

## Step 2: the brief

`brief.json` is the `SealedEvaluatorBrief` for that contract: the behaviors, the permitted interfaces narrowed to `logicalId` and `kind`, the bounds, one prose direction per oracle, and `contractDigest`. Seal the contract yourself and the digest comes out the same:

```bash
node dist/cli/main.js seal --in $CHAIN/eval-contract.json | grep -o '"contractDigest":"[^"]*"'
```

```text
"contractDigest":"sha256:10aa580f94fb3b1b252c24b7ca7186da737498e9f35cfc6150b97a8afbcc4bc9"
```

`sealed-run-record.json` carries the same value in its own `contractDigest` field, which is how the run says which contract it was run against. Nothing in the score chain recomputes that digest from the contract you pass to `score`; what `ingest` checks is that the record and the isolation manifest agree on it.

The oracle checks, the interaction plan, and the test data have no field in the brief, so the evaluator that received it did not know that a read-back would be compared against the write.

---

## Step 3: the probe

`probe.json` is `P-001`, class `defect`, `expectedClean: false`, against `B-001`. Its `rationale` names the seeded silent-write defect. Two fields matter for scoring.

`defectSignature` is the machine-readable description of where the defect shows: interface kind `api`, method `GET`, path template `/notes/{id}`, observable channel `response-body`, and the condition that `note.title` equals `"Original"` on a call whose path id is `n-1`. The witness match in step 6 reads this, and it is what decides whether a finding detected the defect this probe seeded.

`qualification` is the record that lets a probe into a sealed corpus: the mutation operator (`store-write-deletion`), the source of the mutation, and references to the evidence that the baseline passed and the mutated system failed. The generator runs that gate and fails the build if P-001 is rejected.

---

## Step 4: the sealed run record

`sealed-run-record.json` is what the evaluator's run produced, sealed by the caller. It is the input side of scoring, and it is where the sheet's word "evidence" lives: the observations the evaluator made, the findings it wrote, and the disposition it gave each oracle.

The header names the run and binds it: `runId: spike-run-0001`, `mode: contract-scoring`, `trialIndex: 1`, `contractDigest`, `sealedBriefDigest`, and `evaluatorConfigurationDigest`. `mode` is the caller's declaration and is never derived; it selects which verdict ladder runs in step 6.

Five observations, read in `sequence` order and never by array position:

```bash
node -e "const r=require('./$CHAIN/sealed-run-record.json');for(const o of r.observations)console.log(o.sequence,o.observationId,o.operationId,o.responseStatus,JSON.stringify(o.callInputs.path),JSON.stringify(o.callInputs.body),'->',JSON.stringify(o.responseBody).slice(0,60))"
```

```text
1 obs-001 get-note 200 {"id":"n-1"} null -> {"note":{"body":"b","id":"n-1","tags":["t"],"title":"Origina
2 obs-002 list-notes 200 null null -> {"notes":[],"ok":true}
3 obs-003 patch-note 200 {"id":"n-1"} {"title":"Revised"} -> {"note":{"body":"b","id":"n-1","tags":["t"],"title":"Revised
4 obs-004 get-note 200 {"id":"n-1"} null -> {"note":{"body":"b","id":"n-1","tags":["t"],"title":"Origina
5 obs-005 patch-note 200 {"id":"n-2"} {"colour":"red"} -> {"note":{"body":"b2","colour":"red","id":"n-2","tags":[],"ti
```

`obs-003` is the write: it returned `Revised`. `obs-004` is the read-back: it returned `Original`. That pair is the defect showing.

Three findings. `F-001` is a `defect` finding on `O-001`, confidence 0.95, citing `obs-003` and `obs-004`. `F-002` is a `confirmation` on `O-002`. `F-003` is an `observation` with no oracle: the evaluator noticed that `PATCH` accepts an unknown `colour` field, and no oracle in the contract asks about that. Five dispositions, one per oracle: `O-001` `violated` citing `obs-003` and `obs-004`, the other four `held`. `O-005`'s disposition cites no observation and says a malformed `tags` value was rejected with 400, which no observation shows. That is one of the three defects the chain keeps on purpose.

`judgeResults` is empty, because the contract declares no rubric and so no judge was called. When a contract does declare one, the judge runs in the harness and its scores land here, one integer per criterion.

The evaluator's own recommendation is `FAIL`. In `contract-scoring` mode that value is recorded and never becomes the verdict.

Two fields point outside the file. `isolationManifestArtifact` and `actionsArtifact` are `ArtifactReference` values with `storage: "private"`, an opaque `privateRef`, and a digest. In this chain both digests are placeholders, which matters in step 7.

---

## Step 5: the four inputs the files do not carry

`score` takes eight inputs and a caller-attested corpus digest. Four of them are authored inside `scripts/worked-example-target.ts` and never written to disk. Each one is small, and each one is something a caller has to produce for a real run.

**The scoring policy.** `default-policy`: `severityFloor: material`, `confidenceThreshold: 0.7`, `catchThreshold: 0.5`, `minimumTrialCount: 3`, `reExecutionCap: 2`, `remediationCap: 3`, `regexMatchStepBudget: 1000000`. The severity floor decides FAIL against CONCERNS in step 6. The minimum trial count is what this one-trial run falls short of.

**The preflight verdict.** `passed: true`, `checks: []`, `runId: spike-run-0001`, and a `fixtureDigest`. `score` reads `passed` off it, and a failed preflight is an Invalid rung. It reads `fixtureDigest` off it too, as one of the six scoring-version inputs.

**The isolation manifest.** What the evaluator was allowed and what it did: the allowed and observed mounts, network targets, and tool calls, the resource ceilings and actual use, `violation: null`, and `forbiddenInputAccounting` with all seven forbidden inputs marked `withheld: true`. It also repeats `runId`, `contractDigest`, and `evaluatorConfigurationDigest`.

**The evaluator configuration.** The evaluator's identity, model snapshot, system-prompt digest, decoding parameters, tool and permission inventories, budgets, and `judgeConfiguration: null`, since the contract has no rubric.

`ingest` is the stage that reads two of these beside the record, the isolation manifest and the evaluator configuration; the policy and the preflight verdict go to `score`. It checks that the record and the manifest agree on `runId`, `contractDigest`, and `evaluatorConfigurationDigest`, recomputes the configuration's digest and compares it with the record's declaration, checks that every one of the seven forbidden inputs is accounted for as withheld, checks that every citation in a finding or a disposition names an observation that exists, and records every inconsistency it finds as a condition. An absent manifest or configuration is a condition too, and each of those lands on the Invalid rung. This chain is the happy path: `ingest` records nothing.

---

## Step 6: the evidence artifact

`evidence-artifact.json` is the output side: what `emit` minted from what `score` resolved. It is the "evidence artifact" of the package's vocabulary, and it is a different thing from the evidence the evaluator collected in step 4.

Start with the verdict and its basis:

```bash
node -e "const e=require('./$CHAIN/evidence-artifact.json');console.log(e.mode,e.contractVerdict,'exit',e.exitCode);console.log(e.verdictBasis)"
```

```text
contract-scoring FAIL exit 2
[ 'oracle O-004 resolved abstained at or above the severity floor' ]
```

To see why, read the outcome each oracle resolved to:

```bash
node -e "const e=require('./$CHAIN/evidence-artifact.json');for(const o of e.outcomes)console.log(o.oracleId,o.state,o.disposition,o.corroboration,JSON.stringify(o.selectedObservationIds))"
```

```text
O-001 caught violated agrees ["obs-003","obs-004"]
O-002 confirmed held agrees ["obs-003"]
O-003 confirmed held agrees ["obs-003"]
O-004 abstained held agrees ["obs-002"]
O-005 unreached held disagrees []
```

Each row is one oracle check resolved to one of twelve closed outcome states. The state is decided from the check's own resolution over the selected observations, the evaluator's disposition, and whether the two agree. The full decision procedure is the generated AD-33 outcome table at `/ad33-outcome-decisiongenerated/`.

**O-001 is `caught`.** The check compared the title sent in `obs-003` with the title read back in `obs-004`, found them different, and resolved `false`. The evaluator's disposition says `violated` and cites the same two observations, so corroboration `agrees`. Then the witness match ran: `F-001` cites `obs-004`, and `obs-004` is a `GET /notes/{id}` on `n-1` whose `note.title` is `Original`, which is exactly the probe's defect signature. So the finding detected the defect this probe seeded, and the state is `caught`. The signature match is what decided it.

**O-004 is `abstained`.** The collection oracle quantifies over every note in `obs-002`, and `obs-002` returned `notes: []`. A `for-all` over zero records certifies nothing, so the check resolved `insufficient-evidence` with the `empty-collection` introduction condition, and that lands on `abstained`. The evaluator said `held`, which is why the chain keeps this observation contradicting the contract's own setup of three seeded notes.

**O-005 is `unreached`.** The `malformed-write` step binds a type-violating `tags` value on `n-1`, and no observation made that call. The disposition narrates a 400 that nothing recorded and cites no observation, so corroboration `disagrees` and the state is `unreached`.

Now the ladder. `mode` is `contract-scoring`, which is the mode of both arms of a twin run, so the contract-scoring ladder runs. It is total and first-match-wins over tiers in the order Invalid, FAIL, CONCERNS, WAIVED, PASS, and every row in the winning tier contributes to the basis. Nothing in the Invalid tier fired: preflight passed, `ingest` recorded no condition, no oracle hit an error state. In the FAIL tier, `behavioural-failure-at-or-above-floor` fired: O-004 resolved `abstained`, its severity is `material`, and the policy's floor is `material`. So the verdict is `FAIL`, the basis is that one line, and the exit code is 2. Rows in the CONCERNS tier also held, including O-005 `unreached`, the three coverage gaps at or above the floor, and the trial count below the minimum, and none of them appears in the basis because FAIL sits above CONCERNS. Every row of both ladders is on the generated AD-21 verdict table at `/ad21-verdict-decisiongenerated/`.

The strength vector is reported and marked non-comparable:

```bash
node -e "const e=require('./$CHAIN/evidence-artifact.json');console.log(JSON.stringify(e.strength.vector));console.log(e.strength.comparable,'|',e.strength.note);console.log(e.trials)"
```

```text
{"defect":{"caught":1,"exercised":1,"rate":1},"gameability":null,"zero-action":null}
false | 1 admitted probe over 1 completed trial. Below the declared minimum of 3. O-005 resolved unreached. The vector is reported and marked non-comparable.
{ completed: 1, declaredMinimum: 3, invalidatedAttempts: [] }
```

One defect probe was exercised and it was caught, so the defect rate is 1. The other two classes were not exercised, so they are `null`. The policy asked for three trials and the run completed one, and one oracle was unreached, so `comparable` is `false`: this number may be reported and may not be compared with another.

Three more fields are worth reading. `coverageGaps` records three discipline rules the contract is relevant to and does not satisfy: `success-indicator-separation`, `malformed-input`, and `sibling-cross-check`. `uncitedFindings` names `F-003`, the finding that cited no oracle. `scoringVersionInputs` carries the six inputs that fix the identity of this scored result, `mode` among them, and `scoringVersion` is their digest; two results are comparable only when those agree.

---

## Step 7: what the command would have done

Written to disk, the four inputs from step 5 and the files in the chain are exactly the `score` command's inputs:

```bash
node dist/cli/main.js score \
  --record <path> --contract <path> --probe <path> \
  --preflight-verdict <path> --policy <path> \
  --isolation-manifest <path> --evaluator-configuration <path> \
  --corpus-digest <digest> \
  --out <dir>
```

The command chains the same three stages, `ingest`, then `score`, then `emit`, writes `evidence-artifact.json`, and exits with the ladder's own code. For this run that is 2. A `CONCERNS` exits 0, and `--strict` promotes it to 1 unless every firing condition was an evidence condition. On the Invalid rung the command exits 3 and writes nothing, because no legal `EvidenceArtifact` carries a null verdict.

You cannot reproduce `evidence-artifact.json` from the command line with these files, for one reason. The record's `isolationManifestArtifact` is a private reference, and `score` resolves a private reference through the directory `--corpus-root` names and checks that the bytes it finds digest to the value the reference declares. The chain's reference declares a placeholder digest that no bytes produce. The generator calls the stages as functions and never resolves the reference, which is why the committed artifact exists. A real run's record points at real bytes, and the check passes.

One more limit is worth knowing before you score your own runs, and it is a limit of the published surface. The `score` stage is built to take a trial set, several runs of the same probes reduced to one result per probe. The command and `runScore` hand it exactly one record, so a scored run from the published surface today completes one trial. Against a policy declaring a minimum of three, as this run's does, that strength vector is reported and marked non-comparable, the way this one is. The entry point that hands the stage several records is what is missing.

---

## Next steps

- [Run the four commands](/how-to/run-the-four-commands/), including the `score` invocation over your own artifacts
- [The twin run, and where scoring sits in it](/explanation/behavioral-evaluation-contracts/)
- [CLI reference](/reference/cli-commands/), for every `score` flag and the exit-code table
- [Glossary](/reference/glossary/), for the score-side artifacts and vocabulary
