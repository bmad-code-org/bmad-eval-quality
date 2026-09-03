---
title: "Getting Started"
description: "Install eval-quality, then run compile, seal, and preflight against a contract that ships in the corpus."
sidebar:
  order: 1
---

# Getting Started

By the end of this tutorial you will have run all three commands the package ships, on a contract that lives in the repository.

## What you are about to run

The [core flow](/reference/glossary/) runs in this order:

```text
evaluation contract → probe → observation → preflight → evidence → oracle → rubric → score / verdict
```

Three package stages sit inside it. The table maps each step to the terms whose artifacts it handles, which is a different thing from where those terms fall in the runtime order above:

| Step | Stage | Core-flow artifacts it handles |
| --- | --- | --- |
| 1 | get the binary | none |
| 2 | `compile` | evaluation contract |
| 3 | `seal` | evaluation contract, oracle directions |
| 4 | `preflight` | probes, observations, preflight |

The rest of the flow is elsewhere. Running the system and the evaluator and collecting evidence are the caller's job today. Oracle resolution, rubric grading, and scoring form a future package stage, on the [roadmap](/explanation/roadmap/).

The contract is `satisfied-declarations`. Its one behavior reads: *a created thing is readable back in the list of things*, so its checks look at the create response **and** at the list that create was supposed to change. An evaluation that only read the create response would pass while the list stayed empty, which is the shape of blind spot the [twin run](/explanation/behavioral-evaluation-contracts/) exists to find.

Nothing here executes a system under test or an evaluator. You compile a contract, seal it, and reduce hand-authored observations into a passing preflight verdict, which is a simulation of one arm's environment check.

---

## Prerequisites

- Node.js `>=22.20.0`, the version `engines.node` requires.
- `git`, to clone the repository.

---

## Step 1: Get the binary

The package publishes as `eval-quality`, and it installs a binary of the same name:

```bash
npm install eval-quality
```

Every command below runs from a clone, so the binary is `node dist/cli/main.js`:

```bash
git clone https://github.com/bmad-code-org/bmad-eval-quality.git
cd bmad-eval-quality
npm ci
npm run build
```

Confirm the binary answers:

```bash
node dist/cli/main.js --version
```

```text
0.1.0
```

The full usage text, including the exit-code table, comes from `--help`:

```bash
node dist/cli/main.js --help
```

---

## Step 2: Compile a contract

`corpus/dev/compile-seal-example/contract.json` ships with the package and compiles cleanly. `compile` validates it against the `EvalContract` schema, checks it against the discipline rules, and writes the compiled artifact.

```bash
node dist/cli/main.js compile --in corpus/dev/compile-seal-example/contract.json | head -c 240
```

```text
{"behaviors":[{"description":"A created thing is readable back in the list of things.","id":"B-001","observableSuccessCriterion":"A list call after a create returns one element per seeded thing, carrying the name the create call sent.","ora
```

The artifact is one line of RFC 8785 canonical JSON with keys in sorted order. That payload is what the digest is computed over. The serializer appends a line terminator after it, and the digest does not cover that byte.

To land it on disk, give `--out` a directory:

```bash
mkdir -p /tmp/eval-quality-tutorial
node dist/cli/main.js compile --in corpus/dev/compile-seal-example/contract.json --out /tmp/eval-quality-tutorial
ls /tmp/eval-quality-tutorial
```

```text
eval-contract.json
```

An `--out` value ending in `.json` is a file path. Anything else is a directory, and the file inside it is named after the artifact kind.

---

## Step 3: Seal the contract into a brief

`seal` compiles the same input and then reduces it to a `SealedEvaluatorBrief`. The [glossary](/reference/glossary/) lists all twelve fields it carries; the substantive ones are the behaviors, the permitted interfaces narrowed to `logicalId` and `kind`, the scoped resources, the declared principal names, the budgets and limits, the probe step bound, one prose direction per oracle, and `contractDigest`. The oracle checks, the interaction plan, the reference sets, and the rest of the test data have no place in the brief's shape, so they never reach the evaluator. Comparing `contractDigest` across two briefs is what detects a rebound contract.

```bash
node dist/cli/main.js seal --in corpus/dev/compile-seal-example/contract.json | grep -o '"contractDigest":"[^"]*"'
```

```text
"contractDigest":"sha256:3393debb49692e43b7521a8af5887e8c3cea84fa0c44a5d4d39432ae0810fc5a"
```

The repository ships the brief this command produces, at `corpus/dev/compile-seal-example/brief.json`.

---

## Step 4: Run a preflight verdict

`preflight` answers one question: is the environment fit to be measured? It plans the probe requests the contract implies, reduces the observations you hand it, and mints a verdict for a named run. The CLI command issues no requests of its own, so the observations come from whatever system actually called the target. The library's `runPreflight` can drive a caller-supplied `EnvironmentProbePort` instead.

This contract needs no probes for the checks it declares, so the probe list is empty:

```bash
mkdir -p /tmp/eval-quality-tutorial
echo '[]' > /tmp/eval-quality-tutorial/probes.json
```

The plan derives six legs from the contract: two sensitivity-witness legs per operation, plus two control-observe legs. Write one observation per leg, echoing the leg id back as `probeId`:

```bash
cat > /tmp/eval-quality-tutorial/observations.json <<'JSON'
[
  {"probeId":"create-witness-a","interfaceId":"thing-api","operationId":"create-thing","status":201,"headers":{},"body":{"kind":"json","value":{"ok":true,"id":"t-1"}}},
  {"probeId":"create-witness-b","interfaceId":"thing-api","operationId":"create-thing","status":201,"headers":{},"body":{"kind":"json","value":{"ok":false,"id":"t-2"}}},
  {"probeId":"list-witness-a","interfaceId":"thing-api","operationId":"list-things","status":200,"headers":{},"body":{"kind":"json","value":{"items":[{"id":"t-1"}]}}},
  {"probeId":"list-witness-b","interfaceId":"thing-api","operationId":"list-things","status":200,"headers":{},"body":{"kind":"json","value":{"items":[{"id":"t-1"},{"id":"t-2"}]}}},
  {"probeId":"preflight-control-observe","interfaceId":"thing-api","operationId":"list-things","status":200,"headers":{},"body":{"kind":"json","value":{"items":[{"id":"t-1"},{"id":"t-2"},{"id":"t-3"}]}}},
  {"probeId":"preflight-control-observe-2","interfaceId":"thing-api","operationId":"list-things","status":200,"headers":{},"body":{"kind":"json","value":{"items":[{"id":"t-1"},{"id":"t-2"},{"id":"t-3"}]}}}
]
JSON
```

Now reduce them:

```bash
node dist/cli/main.js preflight \
  --contract corpus/dev/compile-seal-example/contract.json \
  --probes /tmp/eval-quality-tutorial/probes.json \
  --observations /tmp/eval-quality-tutorial/observations.json \
  --run-id run-1
```

Diagnostics go to stderr, one line per planned and observed leg:

```text
eval-quality: preflight: run-1: leg "create-witness-a": planned
eval-quality: preflight: run-1: leg "create-witness-a": observed
eval-quality: preflight: run-1: leg "create-witness-b": planned
eval-quality: preflight: run-1: leg "create-witness-b": observed
eval-quality: preflight: run-1: leg "list-witness-a": planned
eval-quality: preflight: run-1: leg "list-witness-a": observed
eval-quality: preflight: run-1: leg "list-witness-b": planned
eval-quality: preflight: run-1: leg "list-witness-b": observed
eval-quality: preflight: run-1: leg "preflight-control-observe": planned
eval-quality: preflight: run-1: leg "preflight-control-observe": observed
eval-quality: preflight: run-1: leg "preflight-control-observe-2": planned
eval-quality: preflight: run-1: leg "preflight-control-observe-2": observed
eval-quality: preflight: run-1: reduced 6 leg(s): passed
```

The verdict goes to stdout:

```json
{"checks":[{"kind":"interface-present","note":null,"operationId":"create-thing","outcome":"satisfied"},{"kind":"interface-present","note":null,"operationId":"list-things","outcome":"satisfied"},{"kind":"input-sensitivity","note":null,"operationId":"create-thing","outcome":"satisfied"},{"kind":"input-sensitivity","note":null,"operationId":"list-things","outcome":"satisfied"},{"kind":"state-reset","note":null,"operationId":null,"outcome":"satisfied"},{"kind":"clean-control","note":null,"operationId":null,"outcome":"satisfied"}],"fixtureDigest":"sha256:eb0ac07ada60686f7f12812fc86885b812e3b04c0e0067522173449a81e162be","parentDigest":null,"passed":true,"revisionCount":0,"runId":"run-1","schemaVersion":1}
```

`passed` is `true`, so the command exits `0`. A verdict that does not pass exits `3`.

---

## What you have run, and what you have not

You compiled the shipped contract, sealed it into a brief, and reduced six observations into a passing preflight verdict. That is every stage the package ships.

**The second arm is missing.** The finding worth having comes from planting a known defect in a real system under test, running the identical contract against it, and checking that the evaluation's findings degrade. That means executing the system and the evaluator, which the package deliberately leaves to the caller. It is not something this tutorial can do with a JSON file.

You can still watch preflight discriminate. Delete the `preflight-control-observe-2` entry from `observations.json` and rerun the command: `interface-present` for `list-things`, `state-reset`, and `clean-control` all report `failed`, `passed` is `false`, and the command exits `3`. That is a negative preflight demonstration, and it shows the environment gate refusing an incomplete run.

Nothing here scored anything either. Scoring is the comparison step at the bottom of the twin run. It is the next milestone, and the [roadmap](/explanation/roadmap/) says what that covers.

---

## Next steps

- [The twin run, and why compile rejects contracts](/explanation/behavioral-evaluation-contracts/)
- [The glossary, in eight nouns](/reference/glossary/)
- [Run the three commands as a pipeline](/how-to/run-the-three-commands/)
- [Author a contract against the real schema](/how-to/author-behavioral-contracts/)
- [CLI reference](/reference/cli-commands/)
