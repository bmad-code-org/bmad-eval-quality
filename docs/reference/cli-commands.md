---
title: "CLI Reference"
description: "Every command, flag, exit code, and export subpath the eval-quality package publishes."
sidebar:
  order: 2
---

# CLI Reference

The package publishes one binary, `eval-quality`, declared in `package.json` under `bin`. Inside a clone it is `node dist/cli/main.js` after `npm run build`.

Every usage block on this page is the binary's own help text, printed by `eval-quality --help` and `eval-quality help <command>`.

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
  eval-quality --help | -h | help [<command>]
  eval-quality --version | -V
```

There are three commands. `--help`, `-h`, and `help` all print usage, and `help <command>` prints one command's block. `--version` and `-V` print the package version.

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

## Flags by command

| Flag | `compile` | `seal` | `preflight` |
| --- | --- | --- | --- |
| `--in <path>` | optional, stdin by default | optional, stdin by default | not accepted |
| `--contract <path>` | not accepted | not accepted | required |
| `--probes <path>` | not accepted | not accepted | required |
| `--observations <path>` | not accepted | not accepted | required |
| `--run-id <id>` | not accepted | not accepted | required |
| `--out <target>` | optional | optional | optional |
| `--strict-inputs` / `--no-strict-inputs` | accepted | accepted | not accepted |
| `--strict` | accepted | accepted | accepted |
| `--help`, `-h` | accepted | accepted | accepted |

A flag a command does not accept exits `64` as an unknown flag, so `--strict-inputs` on `preflight` and `--contract` on `compile` are both usage errors.

---

## `--strict` and `--strict-inputs`

The two names are one keystroke apart and control unrelated things.

**`--strict`** is the exit-code gate. It promotes a `CONCERNS` verdict to exit `1`. Scoring is what produces a verdict of that kind, and scoring does not ship in this release, so `--strict` changes no exit code the binary produces today. Every command accepts it.

**`--strict-inputs`** and **`--no-strict-inputs`** are the compile mode. `--strict-inputs` rejects undeclared inputs, and it is the default when neither flag is given. `--no-strict-inputs` allows them. Only the two commands with a compile step accept these: `compile` and `seal`. `preflight` has no compile step, so it rejects them as unknown flags.

Passing `--strict-inputs` and `--no-strict-inputs` together resolves to whichever appears last on the line.

---

## Inputs and outputs

```text
Inputs and outputs:
  An input flag left out reads stdin, and "-" names stdin explicitly; at most
  one input may be "-". Without --out the artifact goes to stdout. An --out
  ending in .json is a file path; anything else is a directory taking
  <target>/<kind>.json. Diagnostics and errors go to stderr.
```

The `.json` suffix is the whole classifier for `--out`, matched case-insensitively. The CLI never stats the path to decide. The artifact kinds that name a file inside a directory target are `eval-contract.json`, `sealed-evaluator-brief.json`, and `preflight-verdict.json`.

`--out` may not resolve to a file that is also an input. The check compares resolved paths and then asks the filesystem whether the two names reach the same file, which catches a symlink and a case-insensitive spelling that no string normalization would fold together. A collision exits `64`.

Artifacts are written as one line of RFC 8785 canonical JSON with sorted keys. The digest is computed over exactly that payload; the serializer appends a line terminator after it, which the digest does not cover.

---

## Flag parsing

- `--flag=value` splits on the first `=`, so a value may contain one.
- An empty value exits `64`, in both the `--in=` and the `--in ""` form.
- In the space form, a next token longer than one character that begins with `-` is read as the next flag, so the command reports a missing value and points at the `=` form. A bare `-` stays legal, since it names stdin.
- A flag repeated with the same value is accepted. Repeated with different values it exits `64`.
- `--` at the end of the line is ignored. A positional argument after it exits `64`, because no command takes one.
- `--help` or `-h` anywhere in a command's arguments prints that command's help and exits `0`.

---

## Exit codes

```text
Exit codes (AD-21):
  0   success, and every verdict other than FAIL or a promoted CONCERNS
  1   CONCERNS promoted by --strict
  2   FAIL
  3   invalid: a pre-flight verdict that did not pass
  4   structural failure
  5   runtime fault
  64  usage error

  1 and 2 report a scored verdict. Scoring ships in a later release, so no
  command here reaches either yet, and --strict changes no code this binary
  produces.
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

`eval-quality` exports the three stages plus the values a caller needs to interpret what they return:

- **Stages**: `compile`, `seal`, `runPreflight`, `preflightFromObservations`
- **Serialization and digests**: `serializeArtifact`, `digestArtifact`, `digestBytes`, `digestComposite`
- **Lineage**: `validateLineageChain`
- **Errors**: `StructuralFailure`, `RuntimeFault`
- **Enumerations**: `FAILURE_CODES`, `RUNTIME_FAULT_CODES`, `VERDICTS`, `EVALUATOR_RECOMMENDATIONS`, `INTERCHANGE_ARTIFACT_KEYS`
- **Version**: `VERSION`

The artifact types ship alongside them as type-only exports: `EvalContract`, `SealedEvaluatorBrief`, `PreflightVerdict`, `PreflightCheck`, `Probe`, `Rubric`, `ScoringPolicy`, `SealedRunRecord`, `EvidenceArtifact`, `IsolationManifest`, `EvaluatorConfiguration`, `PrivateArtifactManifest`, `ArtifactReference`, along with `Diagnostic`, `DiagnosticSink`, `FailureCode`, `RuntimeFaultCode`, `Verdict`, `EvaluatorRecommendation`, and the witness types.

`runPreflight` takes an `EnvironmentProbePort` and awaits it. `preflightFromObservations` takes observations you already have and stays synchronous. The CLI's `preflight` command calls the second one.

---

## The corpus

`corpus/dev/` ships twenty-three files, published so an adopter can read real input without cloning:

| Path | What it is |
| --- | --- |
| `corpus/dev/README.md` | what the corpus covers, and what it leaves out |
| `corpus/dev/index.json` | every file, its kind, its digest, and the failure code for the three that fail |
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
