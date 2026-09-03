---
title: "CLI Reference"
description: "Every command, flag, exit code, and export subpath the eval-quality package publishes."
sidebar:
  order: 2
---

# CLI Reference

The package publishes one binary, `eval-quality`, declared in `package.json` under `bin`. Inside a clone it is `node dist/cli/main.js` after `npm run build`.

The synopsis, the inputs-and-outputs block, and the exit-code table on this page are the binary's own help text verbatim. The four per-command blocks are the command half of it: `eval-quality help <command>` prints the block shown here followed by the exit-code table, printed by `eval-quality --help` and `eval-quality help <command>`.

---

## Synopsis

```text
Usage:
  eval-quality compile          [--in <path>] [--out <target>]
                                [--strict-inputs | --no-strict-inputs] [--strict]
  eval-quality seal             [--in <path>] [--out <target>]
                                [--strict-inputs | --no-strict-inputs] [--strict]
  eval-quality preflight         --contract <path> --probes <path> --observations <path>
                                 --run-id <id> [--out <target>] [--strict]
  eval-quality score             --record <path> --contract <path> --probe <path>
                                  --preflight-verdict <path> --policy <path>
                                  --corpus-digest <digest>
                                  [--isolation-manifest <path>] [--evaluator-configuration <path>]
                                  [--private-manifest <path>] [--corpus-root <dir>]
                                  [--out <target>] [--strict]
  eval-quality --help | -h | help [<command>]
  eval-quality --version | -V
```

There are four commands. `--help`, `-h`, and `help` all print usage, and `help <command>` prints one command's block. `--version` and `-V` print the package version.

---

## `compile`

Validates a contract against the `EvalContract` schema, checks it against the discipline rules, and emits the compiled contract.

```text
Usage:
  eval-quality compile          [--in <path>] [--out <target>]
                                [--strict-inputs | --no-strict-inputs] [--strict]

  --in <path>              the contract to compile; stdin when absent or "-"
  --out <target>           a .json file path, or a directory taking eval-contract.json
  --strict-inputs          reject undeclared inputs (default)
  --no-strict-inputs       allow undeclared inputs
  --strict                 promote CONCERNS to exit 1
```

---

## `seal`

Compiles the input and reduces it to a `SealedEvaluatorBrief`, which carries the digest of the contract it was sealed from.

```text
Usage:
  eval-quality seal             [--in <path>] [--out <target>]
                                [--strict-inputs | --no-strict-inputs] [--strict]

  --in <path>              the contract to compile and seal; stdin when absent or "-"
  --out <target>           a .json file path, or a directory taking sealed-evaluator-brief.json
  --strict-inputs          reject undeclared inputs (default)
  --no-strict-inputs       allow undeclared inputs
  --strict                 promote CONCERNS to exit 1
```

---

## `preflight`

Plans the probe legs the contract implies, reduces the observations it is handed, and mints a `PreflightVerdict` for a named run. It issues no requests of its own.

```text
Usage:
  eval-quality preflight         --contract <path> --probes <path> --observations <path>
                                 --run-id <id> [--out <target>] [--strict]

  --contract <path>        the compiled contract the plan is built from
  --probes <path>          the probe list the plan is built from
  --observations <path>    the observations to reduce over
  --run-id <id>            the run identifier the verdict is minted for
  --out <target>           a .json file path, or a directory taking preflight-verdict.json
  --strict                 promote CONCERNS to exit 1
```

All four of `--contract`, `--probes`, `--observations`, and `--run-id` are required. Omitting any of them exits `64` with a message naming the missing flags.

---

## `score`

Chains `ingest`, `score`, and `emit`: validates a sealed run record against its isolation manifest and evaluator configuration, scores it against the compiled contract, and mints an `EvidenceArtifact` carrying the AD-21 verdict.

```text
Usage:
  eval-quality score             --record <path> --contract <path> --probe <path>
                                  --preflight-verdict <path> --policy <path>
                                  --corpus-digest <digest>
                                  [--isolation-manifest <path>] [--evaluator-configuration <path>]
                                  [--private-manifest <path>] [--corpus-root <dir>]
                                  [--out <target>] [--strict]

  --record <path>                   the sealed run record to ingest
  --contract <path>                 the compiled contract to score against
  --probe <path>                    the probe the record was run against
  --preflight-verdict <path>        the pre-flight verdict, also the source of the AD-11 fixture digest
  --policy <path>                   the scoring policy
  --corpus-digest <digest>          AD-11's caller-attested corpus digest; no artifact carries it
  --isolation-manifest <path>       the isolation manifest; absent invalidates the run under AD-16
  --evaluator-configuration <path>  the evaluator configuration; absent invalidates the run
  --private-manifest <path>         each entry's digest is checked against its resolved bytes
  --corpus-root <dir>               the directory a private reference resolves under; required only
                                     when --private-manifest or a private-storage isolation-manifest
                                     reference is present
  --out <target>                    a .json file path, or a directory taking evidence-artifact.json
  --strict                          promote CONCERNS to exit 1
```

`--record`, `--contract`, `--probe`, `--preflight-verdict`, `--policy`, and `--corpus-digest` are required. `--isolation-manifest`, `--evaluator-configuration`, and `--private-manifest` are each optional: an absent isolation manifest or evaluator configuration invalidates the run under AD-16/AD-24 rather than failing to parse, and a private-artifact manifest is checked only when given. `--corpus-root` is optional at the argument-parsing level; it becomes required, with a usage error naming it, the moment a `--private-manifest` entry or a private-storage isolation-manifest reference actually needs a byte resolved through it.

On the AD-21 Invalid rung the command exits `3` and writes nothing: there is no legal `EvidenceArtifact` with a null verdict to write.

---

## Flags by command

| Flag | `compile` | `seal` | `preflight` | `score` |
| --- | --- | --- | --- | --- |
| `--in <path>` | optional, stdin by default | optional, stdin by default | not accepted | not accepted |
| `--contract <path>` | not accepted | not accepted | required | required |
| `--probes <path>` | not accepted | not accepted | required | not accepted |
| `--observations <path>` | not accepted | not accepted | required | not accepted |
| `--run-id <id>` | not accepted | not accepted | required | not accepted |
| `--record <path>` | not accepted | not accepted | not accepted | required |
| `--probe <path>` | not accepted | not accepted | not accepted | required |
| `--preflight-verdict <path>` | not accepted | not accepted | not accepted | required |
| `--policy <path>` | not accepted | not accepted | not accepted | required |
| `--corpus-digest <digest>` | not accepted | not accepted | not accepted | required |
| `--isolation-manifest <path>` | not accepted | not accepted | not accepted | optional |
| `--evaluator-configuration <path>` | not accepted | not accepted | not accepted | optional |
| `--private-manifest <path>` | not accepted | not accepted | not accepted | optional |
| `--corpus-root <dir>` | not accepted | not accepted | not accepted | optional |
| `--out <target>` | optional | optional | optional | optional |
| `--strict-inputs` / `--no-strict-inputs` | accepted | accepted | not accepted | not accepted |
| `--strict` | accepted | accepted | accepted | accepted |
| `--help`, `-h` | accepted | accepted | accepted | accepted |

A flag a command does not accept exits `64` as an unknown flag, so `--strict-inputs` on `preflight` and `--contract` on `compile` are both usage errors.

---

## `--strict` and `--strict-inputs`

The two names are one keystroke apart and control unrelated things.

**`--strict`** is the exit-code gate. It promotes a `CONCERNS` verdict to exit `1`, except a `CONCERNS` whose firing conditions are all evidence conditions, which it never promotes. `score`'s ladder resolution is what produces a verdict of that kind, so this is the command `--strict` actually changes the exit code for. Every command accepts the flag.

**`--strict-inputs`** and **`--no-strict-inputs`** are the compile mode. `--strict-inputs` rejects undeclared inputs, and it is the default when neither flag is given. `--no-strict-inputs` allows them. Only the two commands with a compile step accept these: `compile` and `seal`. `preflight` and `score` each have no compile step, so both reject these as unknown flags.

Passing `--strict-inputs` and `--no-strict-inputs` together resolves to whichever appears last on the line.

---

## Inputs and outputs

```text
Inputs and outputs:
  --in is the only input that falls back to stdin: compile and seal read it
  when --in is left out. "-" names stdin explicitly on any input, and at most
  one input may be "-" per invocation. compile and seal each take one input;
  preflight takes three, all required; score takes eight, three of them
  optional (--isolation-manifest, --evaluator-configuration, and
  --private-manifest). Without --out the artifact goes to stdout. An --out
  ending in .json is a file path; anything else is a directory taking
  <target>/<kind>.json. Diagnostics and errors go to stderr.
```

The `.json` suffix is the whole classifier for `--out`, matched case-insensitively. The CLI never stats the path to decide. The artifact kinds that name a file inside a directory target are `eval-contract.json`, `sealed-evaluator-brief.json`, `preflight-verdict.json`, and `evidence-artifact.json`.

`--out` may not resolve to a file that is also an input. The check compares resolved paths and then asks the filesystem whether the two names reach the same file, which catches a symlink and a case-insensitive spelling that no string normalization would fold together. A collision exits `64`.

Artifacts are written as one line of RFC 8785 canonical JSON with sorted keys. The digest is computed over exactly that payload; the serializer appends a line terminator after it, which the digest does not cover.

---

## Flag parsing

- `--flag=value` splits on the first `=`, so a value may contain one. Only flags that take a value accept this form: `--strict-inputs=true` exits `64` as an unknown flag.
- An empty value exits `64`, in both the `--in=` and the `--in ""` form.
- In the space form, a next token longer than one character that begins with `-` is read as the next flag, so the command reports a missing value and points at the `=` form. A bare `-` stays legal, since it names stdin.
- A flag repeated with the same value is accepted. Repeated with different values it exits `64`.
- `--` at the end of the line is ignored. A positional argument exits `64` whether or not it follows one, because no command takes a positional; without `--` the message names it as an unknown flag.
- `--help` or `-h` anywhere a flag is expected prints that command's help and exits `0`. In a position where a value is expected it is read as the missing value and exits `64`, so `compile --in --help` is a usage error.

---

## Exit codes

```text
Exit codes (AD-21):
  0   success, and every verdict other than FAIL or a promoted CONCERNS
  1   CONCERNS promoted by --strict
  2   FAIL
  3   invalid: a failed pre-flight, or any other AD-21 invalidating condition
  4   structural failure
  5   runtime fault
  64  usage error

  --strict never promotes a CONCERNS whose firing conditions are all evidence
  conditions: those conditions report that the measurement fell short of the
  policy. 1 and 2 report a verdict the score command's ladder resolved; every
  other invalidating condition behind 3 is reachable there too, alongside the
  failed pre-flight the preflight command itself reports.
```

---

## Diagnostic format

Everything on stderr carries the `eval-quality` prefix.

| Shape | Example |
| --- | --- |
| `eval-quality: usage: <message>` | `eval-quality: usage: unknown flag "--contract" for compile` |
| `eval-quality: <stage>: <runId>: <message>` | `eval-quality: preflight: run-1: reduced 6 leg(s): passed` |
| `eval-quality: <code>: <artifactPath>: <detail>` | `eval-quality: undeclared-mandatory-input: EvalContract.permittedInterfaces[0].operations[0]: …` |

---

## Package exports

`package.json` publishes five subpaths, plus `./package.json` itself:

| Specifier | What it resolves to |
| --- | --- |
| `eval-quality` | the library barrel |
| `eval-quality/adapters` | the reference adapters |
| `eval-quality/conformance` | the port vocabulary and the conformance suite |
| `eval-quality/schemas/*` | the twelve published JSON Schema documents |
| `eval-quality/corpus/*` | the development corpus |
| `eval-quality/package.json` | the manifest |

The published tarball carries `dist`, `schemas`, `corpus`, `README.md`, and `LICENSE`.

### Importing a schema

`eval-quality/schemas/*` resolves to `.json` files, so an ESM import of one needs the type attribute:

```javascript
import spec from 'eval-quality/schemas/eval-contract.schema.json' with { type: 'json' }

console.log(spec.$id)
```

Node 22 and Node 24 both throw `ERR_IMPORT_ATTRIBUTE_MISSING` for the same import without `with { type: 'json' }`.

### The library barrel

`eval-quality` exports the four stages plus the values a caller needs to interpret what they return:

- **Stages**: `compile`, `seal`, `runPreflight`, `preflightFromObservations`, `runScore`
- **Serialization and digests**: `serializeArtifact`, `digestArtifact`, `digestBytes`, `digestComposite`
- **Lineage**: `validateLineageChain`
- **Errors**: `StructuralFailure`, `RuntimeFault`
- **Enumerations**: `FAILURE_CODES`, `RUNTIME_FAULT_CODES`, `VERDICTS`, `EVALUATOR_RECOMMENDATIONS`, `INTERCHANGE_ARTIFACT_KEYS`
- **Version**: `VERSION`

The artifact types ship alongside them as type-only exports: `EvalContract`, `SealedEvaluatorBrief`, `PreflightVerdict`, `PreflightCheck`, `Probe`, `Rubric`, `ScoringPolicy`, `SealedRunRecord`, `EvidenceArtifact`, `IsolationManifest`, `EvaluatorConfiguration`, `PrivateArtifactManifest`, `ArtifactReference`, along with `Diagnostic`, `DiagnosticSink`, `FailureCode`, `RuntimeFaultCode`, `Verdict`, `EvaluatorRecommendation`, `LineageChainReport` and `LineageFinding` (what `validateLineageChain` returns), `RunPreflightOptions` and `PreflightFromObservationsOptions` (what the two pre-flight entries take), `RunScoreOptions` (what `runScore` takes), and the witness types.

`runPreflight` takes an `EnvironmentProbePort` and awaits it. `preflightFromObservations` takes observations you already have and stays synchronous. The CLI's `preflight` command calls the second one. `runScore` takes an optional `CorpusPort`, awaited only when a private reference actually needs resolving; the CLI's `score` command builds one from `--corpus-root` when given.

---

## The corpus

`corpus/dev/` ships twenty-three files, published so an adopter can read real input without cloning:

| Path | What it is |
| --- | --- |
| `corpus/dev/README.md` | what the corpus covers, and what it leaves out |
| `corpus/dev/index.json` | every other file, its kind, its digest, and the failure code for the three that fail |
| `corpus/dev/contracts/` | nineteen contracts, collectively covering each discipline rule in each declaration state |
| `corpus/dev/compile-seal-example/contract.json` | one contract that compiles |
| `corpus/dev/compile-seal-example/brief.json` | the brief `seal` produces from it |

Sixteen of the nineteen contracts compile. Three fail by design: `empty-request-shapes.json` and `no-operation-inventory.json` raise `unreachable-check-evidence`, and `no-state-change-marker.json` raises `undeclared-mandatory-input`.

---

## Repository scripts

These run inside a clone and have nothing to do with the published binary.

```bash
npm run typecheck
npm run lint
npm run test
npm run validate
npm run docs:validate-links
```

---

## Related pages

- [Run the three commands](/how-to/run-the-three-commands/)
- [Author a Behavioral Evaluation Contract](/how-to/author-behavioral-contracts/)
- [Roadmap](/explanation/roadmap/)
