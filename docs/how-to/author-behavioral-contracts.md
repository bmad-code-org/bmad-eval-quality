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

The Notes API is intentionally tiny.
The domain is arbitrary.
It exists because persistence gives us an easy-to-understand defect where a response can look successful while the resulting state is wrong:

```text
write title = "Revised"
        ↓
response says "Revised"
        ↓
read same note
        ↓
still "Original"
```

A check that trusts only the write response misses the defect.
Independent read-back catches it.

The behavior, B-001, is `critical`: **a write that reports success has stored the change.**
Its observable success criterion says how you would see that: an independent read of the same note after a successful write returns the title the write sent.

The planted defect is that the update validates the input, builds the updated note, answers `ok: true` with the new title, and leaves storage unchanged.
The write's own response is indistinguishable from a correct one.
Only a later, independent read shows the old value.

That directory carries the whole chain: the contract, the pre-flight inputs, the probe declaring the defect, the sealed run record an evaluator produced, and the caller-side artifacts `score` validates against.
Every digest inside it is computed from bytes this repository ships.

## How this walkthrough fits together

[How It Works](/explanation/behavioral-evaluation-contracts/) describes the conceptual model connecting the System Under Test (SUT), the evaluation harness, and `eval-quality`.
This walkthrough replays one complete scored evaluation arm through the `eval-quality` stages, step by step, using the seven numbered sections below.

### The walkthrough pipeline

The numbered sections of this guide correspond to a single, continuous pipeline:

```text
                          Authored Behavioral Evaluation Contract
                           (examples/tutorials/walkthrough/contract.json)
                                              │
                                              ▼
                                      1. COMPILE THE CONTRACT
                                         [eval-quality CLI]
                                              │
                                              ├── 2. Inspect what the contract declares
                                              │      [Read-only contract explanation]
                                              │
                                              ├── 3. Inspect a compile rejection
                                              │      [compile CLI demonstration]
                                              │
                                              ▼
                                        4. SEAL THE BRIEF
                                         [eval-quality CLI]
                                              │
                                              ▼
                       ┌──────────────────────────────────────────────┐
                       │ Caller / Harness Boundary: Preflight Probing │
                       │ (The SUT is not launched in this tutorial.)  │
                       │ The preflight interactions were executed     │
                       │ beforehand. Their responses are committed as │
                       │ observations.json. probes.json is the        │
                       │ committed probe-list input to planning.      │
                       └──────────────────────────────────────────────┘
                                              │
                                              ▼
                                5. REDUCE PREFLIGHT OBSERVATIONS
                                         [eval-quality CLI]
                                              │
                                              ▼
                       ┌──────────────────────────────────────────────┐
                       │ Caller / Harness Boundary: SUT + Evaluator   │
                       │ (Neither SUT nor LLM runs in this tutorial.) │
                       │ The defective SUT and evaluator were run in  │
                       │ a harness to produce a sealed run record.    │
                       └──────────────────────────────────────────────┘
                                              │
                                              ▼
                                 6. SCORE THE EVALUATION RECORD
                                         [eval-quality CLI]
                                              │
                                              ▼
                                      Evidence Artifact
                           (/tmp/eval-quality-run/evidence-artifact.json)
                                              │
                                              ▼
                                      7. READ THE RUN YOU PRODUCED
                                         [Read-only verdict & strength triage]
```

### Pipeline ownership and the two skipped execution gaps

To follow the walkthrough without confusion, keep in mind who executes what:

* **`eval-quality` owns four deterministic offline processing stages:**
  `compile`, `seal`, `preflight` (evidence reduction), and `score`. None of these CLI commands launch background processes, spin up servers, query AI models, or issue network calls.
* **Your harness owns active environment and evaluator execution:**
  Running the System Under Test (SUT), hosting services, dispatching active probe calls to verify measurability, running the evaluator model against the sealed brief, capturing interaction observations, and minting the sealed run record.

Because this tutorial focuses on learning the `eval-quality` contract and verification tools, it uses **prepared fixture files** in place of dynamic harness execution. There are two explicit execution gaps:

1. **Preflight probing gap (before step 5):**
   In this tutorial, `eval-quality preflight` does not start the Notes API service or send HTTP requests. It executes `preflightFromObservations`: it plans the legs implied by the contract and supplied probe list, then reduces the prepared observations. In production, when using the TypeScript library, `runPreflight` can actively drive a caller-supplied `EnvironmentProbePort` to send planned legs directly to a running service.
2. **Evaluator and SUT execution gap (before step 6):**
   In this tutorial, neither the defective Notes API nor an LLM evaluator runs live. In a live system, your harness executes the defective SUT, presents `sealed-evaluator-brief.json` to the evaluator, captures the resulting tool calls and responses, and seals them into `sealed-run-record.json`. Here, that work was executed in advance, and the resulting record is committed in `examples/tutorials/walkthrough/sealed-run-record.json` for replay.

### How this maps to a full twin run

The full [twin-run model](/explanation/behavioral-evaluation-contracts/#the-twin-run) stress-tests an evaluation by comparing two conditions: a clean system and a mutated system with a seeded defect.

This walkthrough executes **one scored arm** in depth (the defective SUT arm) so you can understand the artifacts and decision rules firsthand. Once you master this sequence, repeating it across both arms is straightforward: you compile and seal the contract once, run preflight reduction on each arm, and score each arm against its own probe ([Next: run a real clean and mutated experiment](#next-run-a-real-clean-and-mutated-experiment)).

### Artifact map

This walkthrough generates four primary pipeline artifacts on disk while consuming committed inputs and replaying prepared harness evidence:

| Artifact | Role in this exercise | Job |
| --- | --- | --- |
| `contract.json` | Committed authored input | Defines behavior, interfaces, evidence relationships, and checks. |
| `eval-contract.json` | **Generated by step 1 (`compile`)** | Validated, canonical contract consumed by later stages. |
| `sealed-evaluator-brief.json` | **Generated by step 4 (`seal`)** | Evaluator-facing directions and permitted context (withholds answer key). |
| `probes.json` + `observations.json` | Committed prepared fixtures | Replayed inputs representing preflight probing interactions. |
| `preflight-verdict.json` | **Generated by step 5 (`preflight`)** | Records which environment measurability checks were satisfied. |
| `probe.json` + `sealed-run-record.json` | Committed prepared fixtures | Seeded defect description plus evaluator observations and findings. |
| Policy, configuration, isolation manifest, corpus digest | Committed inputs and attested digest | Thresholds, run controls, and cryptographic integrity tokens. |
| `evidence-artifact.json` | **Generated by step 6 (`score`)** | Scored outcomes, verdict, reasons, trials, and strength vector. |

The separately generated `piped-brief.json` in step 4 is an equivalence check verifying that streaming through standard I/O matches file-based execution byte for byte.

## 1. Compile the contract

> **Question:** Is my evaluation specification structurally valid and capable of proving what it claims?

`compile` reads the authored contract, checks it against the contract schema, checks it against the discipline rules, and writes the compiled artifact.

```bash
node dist/cli/main.js compile --in examples/tutorials/walkthrough/contract.json --out /tmp/eval-quality-run/eval-contract.json
```

Exit `0`, and the artifact is on disk.

> An `--out` value ending in `.json` is a file path.
> Anything else is a directory, and the file inside it is named after the artifact kind.
> Under the hood, the artifact is written as canonical JSON (RFC 8785) with sorted keys plus a trailing newline.
> The artifact's digest is computed over that line without the newline, so two machines agree on what the contract is.

Compilation verifies structural schema conformance and implemented discipline checks.
Successful compilation confirms that the specification conforms to the rules.
It does not establish complete test coverage or prove runtime detection strength.
This walkthrough subsequently uncovers an evidence gap during scoring.

## 2. What a contract declares

> **Question:** What behavior, evidence, interfaces, and checks did I just authorize?

### Read these fields first

Four areas explain what this contract authorizes:

| Area | Question it answers |
| --- | --- |
| `behaviors` | What promise are we evaluating, how serious is it, and which checks address it? |
| `permittedInterfaces` | What operations and observable request and response fields can the checks refer to? |
| `interactionPlan` | Which recorded calls count as the write, its later read-back, and the filtered list? |
| `oracles` | What exact relation decides whether each assertion is supported? |

In `examples/tutorials/walkthrough/contract.json`, these four areas connect through shared identifiers:

**The behavior** `B-001` declares `severity: "critical"` and describes the core contract:

```json
{
  "id": "B-001",
  "severity": "critical",
  "description": "A write that reports success has stored the change.",
  "observableSuccessCriterion": "An independent read of the same note after a successful write returns the title the write sent.",
  "oracles": [
    "O-001",
    "O-002",
    "O-003",
    "O-004"
  ]
}
```

**The permitted interface** `notes-api` of kind `api` declares three operations:
- `update-note`: a `PATCH` request to `/notes/{noteId}` with a body containing `title`.
  It declares a state-change marker, a response descriptor, and a sensitivity witness.
  This example updates the existing note `n-1`.
  It does not demonstrate dynamically capturing a newly minted identifier.
  (See [the workflow evaluation guide](/how-to/evaluate-workflow-behavior/) for captured bindings.)
- `read-note`: a `GET` request to `/notes/{noteId}` returning the stored note object.
- `list-notes`: a `GET` request to `/notes` requiring a `title` query parameter and returning an array of notes.

**The interaction plan** declares three steps:
- `write` maps to `update-note`.
- `read-back` maps to `read-note` with `after: "write"`.
- `list` maps to `list-notes` with `after: "write"`.

The `after` clause constrains evidence selection to recorded calls that occurred after the matching write.
It orders evidence during selection.
It does not execute the workflow or verify the integrity of the underlying system.
The separate read operation provides the independent read-back evidence.

**The oracles** define the specific relations that must hold:
- **O-001** compares the title sent in the `write` body against the title returned in the `read-back` response:

```json
{
  "op": "equality",
  "operands": [
    { "pointer": "/interactions/write/call-inputs/body/title" },
    { "pointer": "/interactions/read-back/response-body/note/title" }
  ]
}
```

Neither operand is a literal constant.
Both pointers address values in recorded interaction evidence.
- **O-002** checks that `ok` exists and `error` is absent in the write response.
  Its expression contains neither an HTTP-status check nor an equality comparison on `ok === true`.
- **O-003** asserts that the `read-back` response contains a `note` object.
- **O-004** checks that every note in the filtered list has an identifier.
  When the list is empty, there are no note elements to examine, so the check resolves to `insufficient-evidence`.

Each oracle carries a prose `direction` that explains its purpose to the evaluator.

### What the remaining contract fields do

`schemas/eval-contract.schema.json` is the normative shape, published under `$id: urn:eval-quality:schema:eval-contract`.
It sets `additionalProperties: false` and requires twenty-one top-level fields.
An absent field and an unrecognized field both fail schema validation.
A contract carries all twenty-one, supplying `null` or an empty collection where a capability is unused.

| Group | Fields | Purpose |
| --- | --- | --- |
| Identity and lineage | `schemaVersion`, `contractId`, `parentDigest`, `revisionCount`, `sourceSpecDigest` | Contract identity, schema compatibility, and version history. |
| Evidence and coverage context | `referenceSets`, `siblingGroups`, `requiredEvidence` | Static reference values, related operation clusters, and required evidence types. |
| Permitted context and setup | `scopedResources`, `forbiddenInputs`, `testData`, `fixtureReset` | Boundaries on accessible resources, disallowed inputs, static test data, and state reset specifications. |
| Declared limits | `budgets`, `safetyLimits`, `probeStepBound` | Declared operational ceilings and step limits. |
| Additional assessment mechanisms | `rubrics`, `waivers` | Qualitative judge rubrics and documented failure exemptions. |

In this contract, `rubrics: []` declares that no LLM judge evaluates qualitative rubrics.
`fixtureReset: null` indicates that the contract defines no explicit reset operation.
Declared limits, safety limits, and setup instructions inform the caller.
The evaluator library does not launch sandboxes or execute external cleanup commands on its own.
The [glossary](/reference/glossary/) lists all twelve system schemas with their producers.

## 3. Read a rejection

> **Question:** Can eval-quality catch a broken evaluation design before I run an expensive evaluation?

Two gates run, and they fail differently.

**The schema gate.** A contract that does not match the schema fails before any discipline rule runs.
`compile` exits `5`, writes the failure code and the artifact on the first line, then prints one line per issue, indented, located by a JSON Pointer over the value that failed:

```text
eval-quality: schema-parse-failure: EvalContract: input does not conform to the EvalContract schema
  /behaviors/0/severity: Invalid option: expected one of "low"|"material"|"critical"
  /interactionPlan/0/cardinality: Invalid input: expected string, received undefined
  /oracles/2/direction/evidenceTargets/0: Invalid string: must match pattern ...
```

The list is sorted by location, so a diff between two runs reflects an actual change.
It stops at twenty issues and counts the rest.
It names the expectation and avoids printing the value that failed, protecting sensitive values from appearing in logs.

**The discipline gate.** `compile` then checks the contract against the discipline rules, and those rejections exit `4` with their own failure codes.
Here is an oracle addressing a request field the operation never declares:

<!-- expect-exit: 4 -->

```bash
node dist/cli/main.js compile --in corpus/dev/contracts/empty-request-shapes.json
```

```text
eval-quality: unreachable-check-evidence: EvalContract.oracles[id=O-005].check.operands[0].operands[0]: "/interactions/create/call-inputs/body/name" addresses call-inputs body field "name", which operation "create-thing" declares in neither requiredKeys nor permittedKeys
```

The pointer resolves to nothing, so the assertion checks evidence that cannot exist.

**Use the corpus as a rule index.** `corpus/dev/contracts/` holds twenty-four contracts: nineteen covering the seven discipline rules, one per declaration state, three describing a system under test that runs behind a command, one describing a tool server whose operations are the tools it publishes, and one describing a service behind HTTP whose plan reads a created record back at the identifier the write returned.
Twenty-one compile, and three fail by design.

```bash
node -e "for (const e of require('./corpus/dev/index.json').entries) if (e.structuralFailure) console.log(e.structuralFailure, e.path)"
```

```text
unreachable-check-evidence corpus/dev/contracts/empty-request-shapes.json
unreachable-check-evidence corpus/dev/contracts/no-operation-inventory.json
undeclared-mandatory-input corpus/dev/contracts/no-state-change-marker.json
```

When a rule is unclear, open the contract named after it and the one next to it that satisfies it.
`corpus/dev/README.md` explains what the corpus covers and what it leaves out.

## 4. Seal it

> **Question:** What can I safely give the evaluator without giving it the answer key?

`seal` compiles the input and reduces it to a brief the evaluator can be handed:

```bash
node dist/cli/main.js seal --in examples/tutorials/walkthrough/contract.json --out /tmp/eval-quality-run/sealed-evaluator-brief.json
```

Exit `0`.

### Read the sealed brief

Read these fields first:
- `behaviors`: The promises carried forward to the evaluator, specifying severity, descriptions, and criteria.
- `directions`: One generated prose direction per oracle check.
  The evaluator learns what to evaluate without receiving raw AST expressions, JSON pointers, or test data.
- `permittedInterfaces`: Interfaces narrowed to `logicalId` and `kind`.
  Detailed operation schemas and endpoints are omitted.
- `contractDigest`: The cryptographic digest connecting this brief to the authored contract.

What the remaining fields do:
- `scopedResources` and `principals` provide authorized contextual references and identity labels.
- `budgets`, `safetyLimits`, and `probeStepBound` carry operational limits forward to the evaluator.
- `schemaVersion`, `parentDigest`, and `revisionCount` maintain schema compatibility and revision history.

What is excluded:
Executable oracle checks, interaction plan details, reference sets, and test data are omitted from the brief.
This structural boundary prevents the evaluator from reading the answer key directly off the contract.
`seal` produces `sealed-evaluator-brief.json`.
The caller produces `sealed-run-record.json` after running the evaluation.

Inspect a focused reading projection of the generated brief:

```bash
node -e "const b=require('/tmp/eval-quality-run/sealed-evaluator-brief.json');console.log(JSON.stringify({behavior:{id:b.behaviors[0].id,description:b.behaviors[0].description,severity:b.behaviors[0].severity},direction:b.directions.find(d=>d.oracleId==='O-001'),permittedInterfaces:b.permittedInterfaces,contractDigest:b.contractDigest.slice(0,15)+'...'},null,2))"
```

```json
{
  "behavior": {
    "id": "B-001",
    "description": "A write that reports success has stored the change.",
    "severity": "critical"
  },
  "direction": {
    "oracleId": "O-001",
    "text": "The body title value you sent to the update note endpoint (with the supplied path noteId and the supplied body title), compared with its note.title field from the read note endpoint (with the supplied path noteId) is asserted to be equal. The declared polarity expects this relation to hold. One write followed by an independent read of the same note. A write reporting success while a later read returns the old title is treated as a defect."
  },
  "permittedInterfaces": [
    {
      "kind": "api",
      "logicalId": "notes-api"
    }
  ],
  "contractDigest": "sha256:75beb582..."
}
```

To view the complete unprojected brief:

```bash
node -e "console.log(JSON.stringify(require('/tmp/eval-quality-run/sealed-evaluator-brief.json'),null,2))"
```

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

> `--in` left out reads stdin, which is what makes the pipe work.
> `-` names stdin explicitly, and at most one input per command may be `-`.

## 5. Reduce the preflight observations

> **Question:** Can this environment actually produce the evidence the contract depends on?

Conceptually, preflight determines whether the environment is measurable before running an expensive evaluation.

In this walkthrough, the target Notes API service is not launched, and the CLI command issues zero network requests. The external probe interactions were recorded beforehand into a prepared fixture. The CLI `preflight` command executes `preflightFromObservations`: it plans the probe legs the contract implies, compares them against the supplied observations, and mints a `PreflightVerdict` for a named run.

When running programmatically via the library API, `runPreflight` can actively drive a caller-supplied `EnvironmentProbePort` (such as an HTTP or CLI adapter) to probe an active service directly.

### Preflight inputs

This reduction takes two prepared files beyond the contract:

- **`probes.json`** is the probe list the plan builds from.
  This chain seeds no faults that preflight must watch fire, so the list is empty (`[]`).
- **`observations.json`** contains what the environment answered during prior probing, one entry per planned leg.

In contrast, the later scoring step consumes `probe.json`, which declares the seeded defect `P-001`.
Because `probes.json` is empty in this preflight invocation, preflight evaluates sensitivity and control legs from the contract without evaluating `seeded-fault-fired` or `seeded-faults-scoped` checks for the defect.

A representative preflight observation from `examples/tutorials/walkthrough/observations.json`:

```bash
node -e "const obs=require('./examples/tutorials/walkthrough/observations.json');console.log(JSON.stringify(obs[0],null,2))"
```

```json
{
  "body": {
    "kind": "json",
    "value": {
      "note": {
        "id": "n-1",
        "title": "Alpha"
      },
      "ok": true
    }
  },
  "headers": {},
  "interfaceId": "notes-api",
  "kind": "api",
  "operationId": "update-note",
  "probeId": "update-witness-a",
  "status": 200
}
```

Here `probeId` is `update-witness-a`, identifying a planned preflight leg.
It correlates the observation with a planned check.
It is an identifier for preflight leg correlation, distinct from the scored probe `P-001`.

Run preflight:

```bash
node dist/cli/main.js preflight \
  --contract examples/tutorials/walkthrough/contract.json \
  --probes examples/tutorials/walkthrough/probes.json \
  --observations examples/tutorials/walkthrough/observations.json \
  --run-id notes-run-1 \
  --out /tmp/eval-quality-run/preflight-verdict.json
```

Exit `0`.
The verdict is written to `--out`, and one diagnostic line per leg goes to stderr:

```text
eval-quality: preflight: notes-run-1: leg "update-witness-a": planned
eval-quality: preflight: notes-run-1: leg "update-witness-a": observed
```

### Planned and observed

Those two words represent the preflight model in miniature:

- **planned**: the contract caused preflight to expect that leg.
- **observed**: matching evidence was supplied for that planned leg.

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

This contract plans eight legs:
- Six sensitivity-witness legs: two for each of the three operations (`update-witness-a`, `update-witness-b`, `read-witness-a`, `read-witness-b`, `list-witness-a`, `list-witness-b`).
- Two control legs: `preflight-control-observe` and `preflight-control-observe-2`.

The last line of the diagnostic is the reduction:

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

The printed columns are check kind (`c.kind`), operation identifier (`c.operationId`), and outcome (`c.outcome`).

In the row `state-reset null satisfied`, `state-reset` is the check kind and `satisfied` is the outcome.
The `null` belongs to `operationId`, because the control check is not assigned a single operation identifier in this result.
This contract sets `fixtureReset: null`.
When no reset operation is declared, preflight selects a read operation and issues repeated observations (`preflight-control-observe` and `preflight-control-observe-2`).
It checks that repeated reads without intervening writes yield consistent responses.
In this fixture, `state-reset` confirms repeated-read consistency.
A full observe-mutate-reset-observe sequence applies when a contract declares an explicit `fixtureReset`.

### What preflight verdict records

Read these fields first:
- `passed`: `true` indicates that all planned preflight checks were satisfied.
- `checks`: An array detailing each measurability condition, its target operation, its outcome (`satisfied`, `failed`, or `exempt`), and explanatory notes.

What the remaining fields do:
- `runId`: Links the verdict to the current evaluation run.
- `fixtureDigest`: Derived identity of the observed fixture responses under preflight evaluation, distinct from a full database snapshot.
- `parentDigest`, `revisionCount`, and `schemaVersion`: Track artifact lineage and schema compatibility.

```text
Required interfaces exist                 YES
Declared inputs affect behavior           YES
Repeated-read control holds               YES
Clean control works                       YES
Environment fit to score                  YES
```

Preflight does not decide whether the evaluation is good.
It establishes that the environment is fit enough for the resulting evidence to mean something.

## 6. Score the evaluation record

> **Question:** Does the recorded evidence support what the evaluator claimed?

`score` chains `ingest`, `score`, and `emit` over a trial set and mints an evidence artifact carrying the verdict.
In this walkthrough, `score` evaluates the prepared evidence from `sealed-run-record.json` rather than executing the evaluator or defective SUT live.
This walkthrough supplies one record, so its result records one completed trial.
Repeat `--record` with independently sealed records to meet a multi-trial policy minimum.
Every record carries a distinct `trialIndex`; every record agrees on `contractDigest`, `evaluatorConfigurationDigest`, `mode`, `evaluatorRecommendation`, and `runId`.

```text
sealed run record
+ compiled contract
+ probe
+ passed preflight
+ scoring policy
+ isolation/config identity
        ↓
      SCORE
        ↓
 Evidence Artifact
```

The run record contains what the evaluator observed and concluded.
The other inputs define the contract, probe, policy, and controlled environment for that evidence.

### Pre-scoring inputs

Before scoring, inspect the inputs that originate outside the four-stage CLI pipeline:

**The scoring probe (`probe.json`):**
- Declares `probeId: "P-001"`, `probeClass: "defect"`, `behaviorId: "B-001"`, and `expectedClean: false`.
- Specifies `defectSignature`: a `GET` request to `/notes/{noteId}` with `noteId: "n-1"` returning `note.title: "Original"`.
  A defect finding must cite an observation matching this signature to earn detection credit.
- Declares `defects[0]` with `defectId: "D-001"` and `manifestationWitness: null`.
- Records `qualification`, where `rollbackVerified: true` records the caller's assertion that rollback or cleanup was verified.
  The package checks this declaration when qualifying the probe.
  The probe describes the defect and qualification evidence; it does not execute mutations or rollbacks.
- Lineage, digest, and version fields record schema compatibility and identity.

**The sealed run record (`sealed-run-record.json`):**
- Records `mode: "contract-scoring"`, `conditionArm: "mutated"`, `runId`, and `trialIndex: 1`.
- `observations`: Contains the recorded sequence of interactions.
- `findings`: Finding `F-001` reports that the note kept its old title, citing probe `P-001`, oracle `O-001`, and observation `obs-002`.
- `oracleDispositions`: Evaluator judgments for each oracle (`violated` for O-001; `held` for O-002, O-003, and O-004).
- `evaluatorRecommendation`: Records `FAIL` for the system under test.
- This file is a prepared record from an earlier evaluation run.
  Scoring replays this evidence and does not launch a fresh evaluator.

```text
P-001 describes the persistence defect
F-001 cites P-001, O-001, and obs-002
obs-002 reads n-1 and contains title Original
O-001 relates that read to the earlier write of Revised
score resolves and records the result
```

**The scoring policy (`scoring-policy.json`):**
- `catchThreshold: 0.5` sets the trial-set reduction threshold for each probe.
  For one probe across its valid trials, the caught-trial fraction must be strictly greater than 0.5 for that probe to count as caught.
  Two catches in three valid trials qualify, whereas one in two does not.
- `severityFloor: "material"` routes behavioral failures to verdict tiers.
  Behavioral failures at or above this severity reach the FAIL tier, while failures below it can still produce CONCERNS.
- `confidenceThreshold: 0.7` sets the minimum finding confidence required before contributing to concerns.
  A finding with confidence below this threshold contributes a CONCERNS reason rather than entering the catch calculation.
- `minimumTrialCount: 3` sets the required number of independent trials.
- `reExecutionCap`, `remediationCap`, and `regexMatchStepBudget` specify execution limits.
  These fields declare policy limits and do not launch retries or external evaluators.

**Isolation manifest and evaluator configuration:**
- `evaluator-configuration.json` records evaluator identity, model snapshot, prompt digest, decoding parameters, and permitted tools.
- `isolation-manifest.json` records filesystem mounts, network allowlists, tool call accounting, and boundary violations.
- Both inputs are required.
  Omitting either invalidates the run with exit `3`.

**Corpus identity:**
- `--corpus-digest` is an attested digest string (`sha256:195dd97c3267c9d7c4d5fb6e1fd62212c8993de903b9261c484ef183d6eaaa3a`), committed in `examples/tutorials/walkthrough/corpus-digest.txt`.
- It establishes corpus identity and comparability context.
  It is an attested string value rather than a file input.

### Run score

| Flag | Format | What it is |
| --- | --- | --- |
| `--record` | File path | One sealed trial record. Repeat the flag for additional trials. |
| `--contract` | File path | The compiled contract from step 1. |
| `--probe` | File path | The probe describing the defect and its expected manifestation signature. |
| `--preflight-verdict` | File path | The preflight verdict from step 5, which must report `passed: true`. |
| `--policy` | File path | The scoring policy defining thresholds, severity floors, and trial counts. |
| `--isolation-manifest` | File path | The isolation manifest recording boundary conditions and observed access. |
| `--evaluator-configuration` | File path | The evaluator configuration recording model identity, parameters, and prompt identity. |
| `--corpus-digest` | Digest value | Attested digest string for the probe corpus. |
| `--out` | File path | Destination path for the generated evidence artifact. |

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

Step 7 explains why this run came out FAIL.

> **Isolation reference:** This chain's record points at its isolation manifest with a public reference, which is what lets you score it with no `--corpus-root`.
> A record pointing at a private reference needs that flag, and `score` then resolves the reference and checks the declared digest against the bytes it found.

## 7. Read the run you just produced

> **Question:** What did the evaluation actually prove, and where is it still weak?

### Read the result in this order

```text
1. What did the evaluator observe?
2. Which oracles were caught / confirmed / abstained?
3. What is the overall verdict?
4. Why did it receive that verdict?
5. What does the strength vector say?
6. Is that strength comparable yet?
```

**1. What the evaluator saw.**
Three observations, in `sequence` order:

```bash
node -e 'const r=require("./examples/tutorials/walkthrough/sealed-run-record.json");for(const o of r.observations){const inp=[o.callInputs.path&&`path:${JSON.stringify(o.callInputs.path)}`,o.callInputs.query&&`query:${JSON.stringify(o.callInputs.query)}`,o.callInputs.body&&`body:${JSON.stringify(o.callInputs.body)}`].filter(Boolean).join(" ")||"none";console.log(o.sequence,o.observationId,o.operationId,inp,"->",JSON.stringify(o.responseBody))}'
```

```text
1 obs-001 update-note path:{"noteId":"n-1"} body:{"title":"Revised"} -> {"note":{"id":"n-1","title":"Revised"},"ok":true}
2 obs-002 read-note path:{"noteId":"n-1"} -> {"note":{"id":"n-1","title":"Original"},"ok":true}
3 obs-003 list-notes query:{"title":"Revised"} -> {"notes":[]}
```

- `obs-001` updates note `n-1` with title `Revised`.
  The write response reports `ok: true` and mirrors `Revised`.
- `obs-002` reads note `n-1` independently.
  The response returns `Original`, showing that the update was never persisted.
- `obs-003` lists notes with query parameter `query: { "title": "Revised" }`.
  The returned array is empty (`notes: []`).
  The list is empty because no stored note matches the requested filter `title=Revised` after the write failed to persist.
  Note `n-1` still exists with title `Original`, as read in `obs-002`.

**2. What each oracle resolved to:**

```bash
node -e "const e=require('/tmp/eval-quality-run/evidence-artifact.json');for(const o of e.outcomes)console.log(o.oracleId,o.state,o.disposition,o.corroboration,o.checkResolution.resolution)"
```

```text
O-001 caught violated agrees false
O-002 confirmed held agrees true
O-003 confirmed held agrees true
O-004 abstained held agrees insufficient-evidence
```

Decode the outcome columns:
- `oracleId`: Check identifier.
- `state`: The outcome state assigned by the scoring ladder (`caught`, `confirmed`, `abstained`).
- `disposition`: The evaluator's judgment reported in the run record (`violated`, `held`).
- `corroboration`: Diagnostic agreement classification between the finding and the check resolution (`agrees`, `disagrees`).
- `checkResolution.resolution`: The result of evaluating the oracle check expression (`true`, `false`, `insufficient-evidence`).

How each oracle resolved:
- **O-001 is `caught`.**
  The check compared the title sent in `obs-001` with the title read back in `obs-002` and resolved `false`.
  The evaluator's disposition was `violated`.
  Finding `F-001` cited `obs-002`, which matched the probe's declared defect signature.
  The signature match turned the finding into a verified detection.
- **O-002 and O-003 are `confirmed`.**
  Both checks evaluated to `true`, and the evaluator disposition was `held`.
  The write response contained `ok` without an error, and the read response returned a note.
- **O-004 is `abstained`.**
  O-004 checks that every note in the filtered list has an identifier.
  Because the filtered list returned an empty collection (`[]`), there were no note elements to examine.
  The check resolved to `insufficient-evidence`.
  On the scoring ladder, insufficient evidence assigns the state `abstained`.
  The evaluator reported disposition `held` with no defect finding citing O-004.
  Under the `examined-nothing` corroboration rule, when a check resolves to `insufficient-evidence` and no defect finding cites the oracle, corroboration reports `agrees`.
  The agreement diagnostic indicates that no finding contradicted the check, but insufficient evidence still forces `abstained`.

**3. The verdict:**

```bash
node -e "const e=require('/tmp/eval-quality-run/evidence-artifact.json');console.log(e.mode,e.contractVerdict,'exit',e.exitCode);console.log(e.verdictBasis)"
```

```text
contract-scoring FAIL exit 2
[ 'oracle O-004 resolved abstained at or above the severity floor' ]
```

- In `mode: "contract-scoring"`, eval-quality evaluates the quality of the contract and evaluation setup rather than the production system.
- `systemRecommendationRecorded: "FAIL"` captures that the evaluator recommended failure for the defective system under test.
- The contract verdict ladder evaluates tiers in order: Invalid, FAIL, CONCERNS, WAIVED, PASS.
- `verdictBasis` records all firing conditions within the highest-priority tier that determines the verdict.
- In this example, one condition in the FAIL tier fired: O-004 resolved to `abstained` at a severity of `critical`, which is at or above the policy floor of `material`.
  This condition triggers contract FAIL.
- Conditions in the CONCERNS tier also held, including a completed trial count below the policy minimum, but lower-priority tiers do not enter `verdictBasis` when a higher tier fires.

**4. The strength vector:**

```bash
node -e "const e=require('/tmp/eval-quality-run/evidence-artifact.json');console.log(JSON.stringify(e.strength.vector));console.log(e.strength.comparable,'|',e.strength.note)"
```

```text
{"defect":{"caught":1,"exercised":1,"rate":1},"gameability":null,"zero-action":null}
false | 1 admitted probe over 1 completed trial. Below the declared minimum of 3. The vector is reported and marked non-comparable.
```

- One defect probe ran, and it was caught.
  The defect detection rate is `1` for that single exercised probe.
- This rate measures detection on the exercised probe set; it does not demonstrate complete contract coverage.
- The other two probe classes (`gameability`, `zero-action`) were not exercised.
- `strength.comparable` is `false` because the run completed one trial against a declared policy minimum of three.
- Supplying additional independently sealed trial records via `--record` satisfies the minimum trial count.
  Every record carries a distinct `trialIndex`; every record agrees on `contractDigest`, `evaluatorConfigurationDigest`, `mode`, `evaluatorRecommendation`, and `runId`.

**5. What the remaining fields do:**

| Group | Fields | Purpose |
| --- | --- | --- |
| Identity and comparison | `runId`, `scoredProbeId`, `scoringVersion`, `scoringVersionInputs`, `comparabilityKey`, `excludedProbeIds`, `callerAttestedInputs` | Run identity, scoring versioning, comparability conditions, and caller-attested inputs. |
| Detailed evidence and aggregation | `reducedProbeOutcomes`, `outcomes[].selectedObservationIds`, `trials` | Aggregated probe outcomes across trials, observation identifiers retained for an individual outcome, and completed or invalidated trial attempts. |
| Assessment and remediation | `coverageGaps`, `uncitedFindings`, `uncitedFindingGaps`, `remediation`, `systemRecommendationRecorded`, `systemRecommendationNote` | Coverage-discipline rules the contract does not satisfy, findings citing no oracle (which may still carry observation evidence), recorded revision count, cap, and lineage-validation results, and recorded evaluator recommendation. |
| Compatibility and lineage | `schemaVersion`, `revisionCount`, `parentDigest` | Schema compatibility and artifact lineage. |

### The lesson

```text
Planted persistence defect:     CAUGHT
Defect probes:                  1 / 1
Overall contract verdict:       FAIL
Reason for FAIL:                O-004 had insufficient evidence
Completed trials:               1
Required trials:                3
Strength comparable:            NO
```

The evaluation caught the known defect, while the evaluation contract still had a material evidence gap.
Those are separate conclusions.

`score` verifies from evidence whether the evaluation caught the defect, while also checking broader contract health.
Catching one defect does not make the evaluation contract trustworthy.

This run demonstrates that distinction.
The contract caught the defect it was pointed at, with a rate of `1`.
The same run came back FAIL because a separate check certified nothing.
Reading only the strength vector would provide an incomplete picture of contract health.

[Contract strength](/explanation/contract-strength/) explains how contract strength is defined and why verdict and vector can diverge.

## Key takeaways

* Declare observable promises and checks that discriminate meaningful failure.
* Provide the evaluator with clear directions while withholding answer-bearing test fixtures and interaction plans.
* Verify environment measurability for the specific checks and operations the evaluation performs.
* Require cited evidence matching a declared defect signature before awarding detection credit.
* Read the contract verdict, its reasons, and measured strength together.
* Catching a defect does not prove that an evaluation contract is trustworthy.
* Test discrimination with clean controls and known defects across sufficient independent trials.
* Verdict and strength evaluate distinct dimensions of an evaluation.

```text
1. COMPILE (validate contract specification)
    ├── 2. Inspect declared behavior, interfaces, and oracles
    └── 3. Inspect a compile rejection (CLI demonstration)
4. SEAL (mint evaluator-safe brief)
    └── [Harness records preflight interactions]
5. REDUCE PREFLIGHT (verify environment measurability)
    └── [Harness executes SUT + evaluator, seals run record]
6. SCORE (evaluate empirical evidence against probe)
7. READ RESULT (triage verdict reasons and strength vector)
```

---

> **You have completed the hands-on walkthrough.**
>
> Everything below moves from the single-arm exercise into integration: how a real harness repeats the process for clean and mutated systems.

## Next: run a real clean and mutated experiment

> **Template only. Do not run these commands verbatim.**
> The files below are produced by your evaluation harness, and this repository does not ship them.

This is the two-arm version of the pipeline you just completed once.
Everything above scored one arm.
The twin run on [How It Works](/explanation/behavioral-evaluation-contracts/#the-twin-run) runs these commands over two arms: a clean system and the same system with one defect planted by hand.

The contract, the brief, the policy, and the evaluator configuration are shared.
Each arm has its own probe, its own preflight, its own evaluator run, and its own record.
No command here performs the mutation; you make that edit yourself.

Compile and seal once.
The brief is what both evaluator runs receive, and its `contractDigest` proves both arms ran the same contract:

```text
eval-quality compile --in contract.json --out run/eval-contract.json
eval-quality seal --in contract.json --out run/sealed-evaluator-brief.json
```

Preflight each arm.
Before invoking the CLI, have the harness execute the planned preflight interactions for each arm and record their responses as `clean-observations.json` and `mutated-observations.json`. The commands below reduce those prepared observations into preflight verdicts.
An arm that does not pass exits `3` and stops there, because a measurement over an unfit environment says nothing about the contract:

```text
eval-quality preflight --contract run/eval-contract.json \
  --probes clean-probes.json --observations clean-observations.json \
  --run-id clean-1 --out run/clean-preflight-verdict.json
eval-quality preflight --contract run/eval-contract.json \
  --probes mutated-probes.json --observations mutated-observations.json \
  --run-id mutated-1 --out run/mutated-preflight-verdict.json
```

Run the evaluator on each arm, in your harness, with the brief and nothing else from the contract.
Seal what it produced into a run record per arm, with `mode: "contract-scoring"` on both, and write the isolation manifest and evaluator configuration each ran under.

Score each arm with its own probe.
The clean arm's probe is a clean control, `expectedClean: true`.
The mutated arm's probe declares the defect it seeded, `expectedClean: false`, with the signature the witness match reads:

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

Then read the two artifacts.
On the clean arm, the oracles are expected to resolve `passed-clean-control`.
A clean target does not guarantee an overall PASS verdict, as other contract constraints or trial counts can still trigger CONCERNS or FAIL.
On the mutated arm, the oracle the defect targets should resolve `caught`, which in `contract-scoring` mode indicates the contract succeeded.
An oracle that resolves `missed` on the mutated arm indicates an unaddressed blind spot.

Compare `scoringVersion` across the two artifacts before comparing anything else in them.
That comparison is yours to make, and the library makes no such check.
[Contract strength](/explanation/contract-strength/) covers `compareDominance`, which is the comparison it does make.

## Two guards

**`--out` may not overwrite an input.** The CLI resolves both paths and checks whether they name the same file, catching symlinks and case-insensitive spellings.
A collision exits `64`:

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
They are evidence to read rather than tutorials to run: their records point at private references whose declared digests no file on disk produces, which is the property this walkthrough chain was built without.

## Related pages

- [Pick your system shape](/how-to/evaluate-agent-behavior/): five guides, each with its own runnable mini-lab
- [CLI reference](/reference/cli-commands/): every flag, every exit code, and the package exports
- [Glossary](/reference/glossary/): every noun used above
- [How It Works](/explanation/behavioral-evaluation-contracts/): the twin run and why compile rejects contracts
