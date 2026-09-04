---
title: "Run the Four Commands"
description: "Drive compile, seal, and preflight end to end over one contract, read the exit code each one returns, and see what score takes."
sidebar:
  order: 2
---

# Run the Four Commands

`compile`, `seal`, `preflight`, and `score` are the whole binary. This page runs the first three over `corpus/dev/compile-seal-example/contract.json`, checks what each one returns, and then shows what the fourth takes, since its inputs come from an evaluator run that nothing in this repository performs.

Every command below is written as `node dist/cli/main.js`, which is the binary inside a clone after `npm run build`. Installed from the registry, the same binary is on `PATH` as `eval-quality`.

---

## Set up a working directory

```bash
mkdir -p /tmp/eval-quality-run
```

---

## 1. Compile

`compile` parses the contract, checks it against the discipline rules, and emits a compiled `EvalContract`.

```bash
node dist/cli/main.js compile \
  --in corpus/dev/compile-seal-example/contract.json \
  --out /tmp/eval-quality-run/eval-contract.json
echo "exit $?"
```

```text
exit 0
```

Exit `0` means the contract compiled. Exit `4` means a discipline rule rejected it, and the message on stderr names the rule and the path inside the artifact.

---

## 2. Seal

`seal` compiles the same input and reduces it to a `SealedEvaluatorBrief`. Point it at the authored contract:

```bash
node dist/cli/main.js seal \
  --in corpus/dev/compile-seal-example/contract.json \
  --out /tmp/eval-quality-run/sealed-evaluator-brief.json
echo "exit $?"
```

```text
exit 0
```

`seal` recompiles what it is given, so feeding it the compiled artifact from step 1 produces the same brief, byte for byte. Both forms work:

```bash
node dist/cli/main.js compile --in corpus/dev/compile-seal-example/contract.json \
  | node dist/cli/main.js seal \
  > /tmp/eval-quality-run/piped-brief.json
cmp /tmp/eval-quality-run/sealed-evaluator-brief.json /tmp/eval-quality-run/piped-brief.json && echo identical
```

```text
identical
```

`--in` left out reads stdin, which is what makes the pipe work. `preflight` has no such default: its three inputs are each required. `-` names stdin explicitly, and at most one input on a command may be `-`.

---

## 3. Preflight

`preflight` plans the probe legs the contract implies and reduces the observations you hand it into a verdict. It needs four things: the contract, a probe list, the observations, and a run id.

This contract declares checks that need no probes, so the probe list is empty:

```bash
echo '[]' > /tmp/eval-quality-run/probes.json
```

The plan derives six legs. Each observation echoes its leg id back as `probeId`:

```bash
cat > /tmp/eval-quality-run/observations.json <<'JSON'
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

The verdict went to the `--out` path. The leg diagnostics went to stderr, so append `2> preflight.log` to that command to capture them in a file.

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

Exit `0` means the verdict passed. Exit `3` means it did not. Delete one observation and the checks that read its leg report `failed`, with the reason in each check's `note`.

This contract seeds no faults, so it emits none of the two seeded-fault check kinds and you will not see them in the six rows above. `seeded-faults-scoped` asks whether a manifestation witness fires on a clean leg, and a leg with no observation cannot fire one, so a missing clean leg leaves that check `satisfied`.

---

## 4. Score

`score` chains `ingest`, `score`, and `emit` over one sealed run record and mints an `EvidenceArtifact` carrying the verdict. The record is what your evaluator produced against the system under test, sealed: its observations in sequence, its findings, its per-oracle dispositions, and the run mode. Nothing in this repository produces one, so this step shows the invocation and names each input. [Read a Scored Run](/tutorials/read-a-scored-run/) reads a completed record and the artifact scored from it, field by field.

Six inputs are required. `--record` is the sealed run record. `--contract` is the compiled contract from step 1. `--probe` is the probe the record was run against, carrying the defect signature the witness match reads. `--preflight-verdict` is the verdict from step 3, which has to have passed. `--policy` is the scoring policy: the severity floor, the confidence and catch thresholds, and the minimum trial count. `--corpus-digest` is the one scoring-version input no artifact carries, so the caller attests it.

Three more are optional and named because leaving them out changes the verdict. An absent `--isolation-manifest` or `--evaluator-configuration` invalidates the run, which is exit `3`. A `--private-manifest`, when given, has each entry's digest checked against the bytes `--corpus-root` resolves.

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
echo "exit $?"
```

The exit code is the verdict. Exit `0` is `PASS`, `WAIVED`, or `CONCERNS`. Exit `2` is `FAIL`. Exit `1` is a `CONCERNS` that `--strict` promoted, which it never does when every firing condition was an evidence condition. Exit `3` is the Invalid rung, and the command writes nothing on it, because no legal `EvidenceArtifact` carries a null verdict. Exit `5` is a runtime fault, which is what an input that does not parse against its schema produces. Exit `64` is a usage error, and `score` reaches it when a private reference needs a byte resolved and `--corpus-root` was left out. The artifact written to `--out` carries the same number in its own `exitCode` field.

One record per invocation is a trial set of one. The `score` stage takes a trial set, and the command hands it exactly one record, so whenever the policy's declared minimum exceeds one the strength vector comes out reported and marked non-comparable.

---

## What the run produced

```bash
ls /tmp/eval-quality-run
```

```text
eval-contract.json
observations.json
piped-brief.json
preflight-verdict.json
probes.json
sealed-evaluator-brief.json
```

---

## The twin run, as commands

The loop drawn on [Behavioral Evaluation Contracts](/explanation/behavioral-evaluation-contracts/) is these four commands run over two arms. The contract, the brief, the policy, and the evaluator configuration are shared; each arm has its own probe, its own preflight, its own evaluator run, and its own record. Every file named `clean-*` or `mutated-*` below is one your harness produces.

Compile and seal once. The brief is what both evaluator runs receive, and its `contractDigest` is how you later prove both arms ran the same contract:

```bash
node dist/cli/main.js compile --in contract.json --out run/eval-contract.json
node dist/cli/main.js seal --in contract.json --out run/sealed-evaluator-brief.json
```

Preflight each arm. Probe each environment, write the observations, and reduce them; an arm that does not pass is exit `3` and stops here, because a measurement over an unfit environment says nothing about the contract:

```bash
node dist/cli/main.js preflight --contract run/eval-contract.json \
  --probes clean-probes.json --observations clean-observations.json \
  --run-id clean-1 --out run/clean-preflight-verdict.json
node dist/cli/main.js preflight --contract run/eval-contract.json \
  --probes mutated-probes.json --observations mutated-observations.json \
  --run-id mutated-1 --out run/mutated-preflight-verdict.json
```

Run the evaluator on each arm, in your harness, with the brief and nothing else from the contract. Seal what it produced into a run record per arm, with `mode: "contract-scoring"` on both, and write the isolation manifest and evaluator configuration each ran under.

Score each arm with its own probe. The clean arm's probe is a clean control, `expectedClean: true`. The mutated arm's probe declares the defect it seeded, `expectedClean: false`, with the defect signature the witness match reads:

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

Then read the two artifacts. On the clean arm the oracles should resolve `passed-clean-control` and the verdict should be `PASS`, exit `0`. On the mutated arm the oracle the defect targets should resolve `caught`, which in `contract-scoring` mode is the contract succeeding. An oracle that resolves `missed` on the mutated arm is the blind spot the loop exists to find. Compare `scoringVersion` across the two artifacts before comparing anything else in them; two results compare only when it agrees.

The repository commits the mutated arm of one such loop, scored against a seeded defect, and [Read a Scored Run](/tutorials/read-a-scored-run/) reads it. It commits no clean arm.

---

## Two guards worth knowing

**`--out` may not overwrite an input.** The CLI resolves both paths and also asks the filesystem whether they name the same file, so a symlink and a case-insensitive spelling are caught too. Step 1 wrote `eval-contract.json` into the run directory, so pointing both `--in` and `--out` at it shows the guard: run `compile` with `--in /tmp/eval-quality-run/eval-contract.json --out /tmp/eval-quality-run/eval-contract.json`. It exits `64` with:

```text
eval-quality: usage: --out resolves to "/tmp/eval-quality-run/eval-contract.json", which is also --in "/tmp/eval-quality-run/eval-contract.json"
```

**One stdin cannot serve two readers.** Naming `-` on more than one input of the same command exits `64`. Run `preflight` with `--contract - --probes - --observations - --run-id run-1` and it reports:

```text
eval-quality: usage: only one input may read stdin, but --contract, --probes, --observations all name "-"
```

---

## Related pages

- [CLI reference](/reference/cli-commands/), including the difference between `--strict` and `--strict-inputs`
- [Read a Scored Run](/tutorials/read-a-scored-run/), for what `score` does with each input
- [Author a Behavioral Evaluation Contract](/how-to/author-behavioral-contracts/)
- [Getting Started](/tutorials/getting-started/)

Supplying your own effects is covered in [Ports, adapters, and the conformance suite](/how-to/ports-and-adapters/).
