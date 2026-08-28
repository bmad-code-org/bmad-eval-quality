---
title: "Getting Started"
description: "Install eval-quality, then run compile, seal, and preflight against a contract that ships in the corpus."
sidebar:
  order: 1
---

# Getting Started

By the end of this tutorial you will have run all three commands the package ships, on a contract that lives in the repository.

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

Version `0.0.0` has not reached the npm registry yet, so every command below runs from a clone. In a clone the same binary is `node dist/cli/main.js`:

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
0.0.0
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

The artifact is one line of canonical JSON with keys in sorted order. That serialization is what the digest is computed over, so the bytes on stdout are the bytes that get hashed.

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

`seal` compiles the same input and then reduces it to a `SealedEvaluatorBrief`: the behaviors, the permitted interfaces, the budgets and limits, one prose direction per oracle, and the digest of the contract it was sealed from. The oracle checks themselves stay behind that digest.

```bash
node dist/cli/main.js seal --in corpus/dev/compile-seal-example/contract.json | grep -o '"contractDigest":"[^"]*"'
```

```text
"contractDigest":"sha256:1f7c657db755e9550ee78c57bdb81ea9f9de9ca227dbeaf823939a0313cbd781"
```

The repository ships the brief this command produces, at `corpus/dev/compile-seal-example/brief.json`.

---

## Step 4: Run a pre-flight verdict

`preflight` answers one question: is the environment fit to be measured? It plans the probe requests the contract implies, reduces the observations you hand it, and mints a verdict for a named run. The package issues no requests of its own, so the observations come from whatever system actually called the target.

This contract needs no probes for the checks it declares, so the probe list is empty:

```bash
mkdir -p /tmp/eval-quality-tutorial
echo '[]' > /tmp/eval-quality-tutorial/probes.json
```

The plan derives six legs from the contract: two sensitivity witnesses per operation, and two control observations. Write one observation per leg, echoing the leg id back as `probeId`:

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

## What you have not run

Nothing here scored anything. Scoring is the next milestone, and the [roadmap](/explanation/roadmap/) says what that covers.

---

## Next steps

- [Run the three commands as a pipeline](/how-to/run-the-three-commands/)
- [Author a contract against the real schema](/how-to/author-behavioral-contracts/)
- [CLI reference](/reference/cli-commands/)
- [What a Behavioral Evaluation Contract asserts](/explanation/behavioral-evaluation-contracts/)
