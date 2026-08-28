---
title: "Run the Three Commands"
description: "Drive compile, seal, and preflight end to end over one contract, and read the exit code each one returns."
sidebar:
  order: 2
---

# Run the Three Commands

`compile`, `seal`, and `preflight` are the whole binary. This page runs all three over `corpus/dev/compile-seal-example/contract.json` and checks what each one returns.

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

An input flag left out reads stdin, which is what makes the pipe work. `-` names stdin explicitly, and at most one input on a command may be `-`.

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

Exit `0` means the verdict passed. Exit `3` means it did not. Drop an observation and the leg it belonged to reports `failed`, with the reason in the check's `note`.

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

## Two guards worth knowing

**`--out` may not overwrite an input.** The CLI resolves both paths and also asks the filesystem whether they name the same file, so a symlink and a case-insensitive spelling are caught too. It exits `64` with:

```text
eval-quality: usage: --out resolves to "/tmp/eval-quality-run/contract.json", which is also --in "/tmp/eval-quality-run/contract.json"
```

**One stdin cannot serve two readers.** Naming `-` on more than one input of the same command exits `64`:

```text
eval-quality: usage: only one input may read stdin, but --contract, --probes, --observations all name "-"
```

---

## Related pages

- [CLI reference](/reference/cli-commands/), including the difference between `--strict` and `--strict-inputs`
- [Author a Behavioral Evaluation Contract](/how-to/author-behavioral-contracts/)
- [Getting Started](/tutorials/getting-started/)
