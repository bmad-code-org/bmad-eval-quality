---
title: "CLI Reference"
description: "Every command, flag, exit code, export subpath, and port the eval-quality package publishes."
sidebar:
  order: 2
---

# CLI Reference

The package publishes one binary, `eval-quality`, declared in `package.json` under `bin`. Inside a clone it is `node dist/cli/main.js` after `npm run build`.

There are four commands. `--help`, `-h`, and `help` all print usage, and `help <command>` prints one command's block. `--version` and `-V` print the package version. The four blocks below are what `eval-quality help <command>` prints, minus the exit-code table it appends.

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

## `score`

Chains `ingest`, `score`, and `emit`: validates a sealed run record against its isolation manifest and evaluator configuration, scores it against the compiled contract, and mints an `EvidenceArtifact` carrying the verdict.

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

`--record`, `--contract`, `--probe`, `--preflight-verdict`, `--policy`, and `--corpus-digest` are required. `--corpus-root` is optional at the argument-parsing level; it becomes required, with a usage error naming it, the moment a private reference actually needs a byte resolved through it.

On the Invalid rung the command exits `3` and writes no artifact: no legal `EvidenceArtifact` carries a null verdict. Diagnostics still go to stderr on that rung. On every other rung the artifact's own `exitCode` field carries the number the command returns.

A probe that fails AD-9's qualification gate resolves an oracle to `infrastructure-error` wherever no higher-precedence condition already resolved that oracle: an evaluation fault and a malformed judge both outrank it. Each of those three states lands the run on the Invalid rung, and a contract declaring no oracles resolves none of them and stays off it. The command writes one line per reason to stderr on every rung, in the `eval-quality: <code>: <artifactPath>: <detail>` shape, so the failure names the field it fired on. `QUALIFICATION_FAILURES` publishes the closed set of codes those lines draw from.

One invocation scores one sealed run record, a trial set of one. That is a limit of the published surface, so whenever the policy's declared minimum exceeds one, the strength vector comes out reported and marked non-comparable.

A flag a command does not accept exits `64` as an unknown flag, so `--strict-inputs` on `preflight` and `--contract` on `compile` are both usage errors.

---

## `--strict` and `--strict-inputs`

The two names are one keystroke apart and control unrelated things.

**`--strict`** is the exit-code gate. It promotes a `CONCERNS` verdict to exit `1`, except a `CONCERNS` whose firing conditions are all evidence conditions, which it never promotes. `score` is the command that produces a verdict of that kind, so it is the one `--strict` actually changes the exit code for. Every command accepts the flag.

**`--strict-inputs`** and **`--no-strict-inputs`** are the compile mode. `--strict-inputs` rejects undeclared inputs, and it is the default when neither flag is given. Only `compile` and `seal` have a compile step, so only those two accept these. Passing both resolves to whichever appears last on the line.

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

## Flag parsing

- `--flag=value` splits on the first `=`, so a value may contain one. Only flags that take a value accept this form: `--strict-inputs=true` exits `64` as an unknown flag.
- An empty value exits `64`, in both the `--in=` and the `--in ""` form.
- In the space form, a next token longer than one character that begins with `-` is read as the next flag, so the command reports a missing value and points at the `=` form. A bare `-` stays legal, since it names stdin.
- A flag repeated with the same value is accepted. Repeated with different values it exits `64`.
- `--` at the end of the line is ignored. A positional argument exits `64`, because no command takes one.
- `--help` or `-h` anywhere a flag is expected prints that command's help and exits `0`. Where a value is expected it is read as that value and exits `64`, so `compile --in --help` is a usage error.

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
  conditions: those report that the measurement fell short of the policy.
  1 and 2 come from the score command's verdict ladder. 3 comes from a failed
  pre-flight, which the preflight command reports, or from any other
  invalidating condition score finds.
```

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

`eval-quality/schemas/*` resolves to `.json` files, so an ESM import of one needs `with { type: 'json' }`. Node 22 and Node 24 both throw `ERR_IMPORT_ATTRIBUTE_MISSING` without it.

### The library barrel

`eval-quality` exports the stage entry points plus the values a caller needs to interpret what they return:

- **Stages**: `compile`, `seal`, `runPreflight`, `preflightFromObservations`, `runScore`
- **Serialization and digests**: `serializeArtifact`, `digestArtifact`, `digestBytes`, `digestComposite`
- **Lineage**: `validateLineageChain`
- **Errors**: `StructuralFailure`, `RuntimeFault`
- **Enumerations**: `FAILURE_CODES`, `RUNTIME_FAULT_CODES`, `VERDICTS`, `EVALUATOR_RECOMMENDATIONS`, `INTERCHANGE_ARTIFACT_KEYS`, `QUALIFICATION_FAILURES`
- **Version**: `VERSION`

Every artifact type ships alongside them as a type-only export, together with the option and result types of each entry point.

`runScore` returns the probe's own qualification result next to the artifact and the ladder. `qualification.failures` carries AD-9's closed reason codes for a probe the gate rejected, typed as `QualificationFailure` and `QualificationFailureCode`, and `qualification.declarationChecksRan` says whether the three checks that read the home operation's declared shapes ran.

`runPreflight` takes an `EnvironmentProbePort` and awaits it. `preflightFromObservations` takes observations you already have and stays synchronous; the CLI's `preflight` command calls that one. `runScore` takes an optional `CorpusPort`, awaited only when a private reference actually needs resolving.

## Ports and adapters

The package performs no effects of its own. A **port** is an interface it declares for an effect it will not perform, and an **adapter** is your implementation of one. This matters only if you are building your own pipeline on the library; the CLI needs none of it.

| Port | What it does | Wired today |
| --- | --- | --- |
| `EnvironmentProbePort` | Probes a live environment | Yes. `runPreflight` awaits it |
| `CorpusPort` | Resolves an opaque private reference to bytes | Yes. `runScore` awaits it when a private reference needs its digest checked |
| `ClockPort` | Reads the current time | No |
| `FileSystemPort` | Reads and writes files | No. The CLI uses `node:fs/promises` |

Each port's type comes from `eval-quality/conformance`. `eval-quality/adapters` ships five reference adapters, `createLocalCorpusAdapter`, `createNodeFileSystemAdapter`, `createSystemClockAdapter`, `createCommandLineAdapter`, and `createMcpAdapter`, each a factory taking the mechanism it wraps. `createCommandLineAdapter` implements `EnvironmentProbePort` for the `cli` mechanism only, over a real child process, authorized by a `CommandTargetPolicy` mapping outside the contract. `createMcpAdapter` implements it for the `mcp` mechanism over MCP's stdio transport only, launching the tool server as a child process and authorized by an `McpTargetPolicy` mapping. A tool server reached over Streamable HTTP speaks the same JSON-RPC across a socket, and this package performs no network I/O, so that transport is a caller's own adapter; there is no reference `EnvironmentProbePort` for `api` for the same reason, because probing a live HTTP environment is the part only you can write.

**The conformance suite** decides whether an implementation conforms. It checks behavior the type checker cannot: whether the implementation returns a typed fault where the boundary demands one, and whether it hangs where it should time out. It takes a `PortSubject`, a small harness around your port carrying a name, one sample request, and a `build` function the suite calls once per scenario. `ScenarioKind` is the four situations it needs your port to be in: `resolves`, `fails`, `in-band-error`, and `hangs`. Putting the port into each of them is your job, because only you know how to make your mechanism fail.

There is one runner per port, and `EnvironmentProbePort` has one arm per mechanism: `runClockPortConformance`, `runCorpusPortConformance`, `runFileSystemPortConformance`, `runEnvironmentProbePortConformance` (the `api` arm), `runCommandLineProbeConformance` (the `cli` arm), and `runMcpProbeConformance` (the `mcp` arm). A report carries the subject name, the port, one outcome per assertion, and a `passed` field over all of them. Every outcome id has the form `<method>/<assertion>`, so a failure names the method and the property it broke.

`CONFORMANCE_OUTCOME_COUNTS` publishes the count per port, and the suite asserts its own totals against it: `corpus` 6, `clock` 6, `file-system` 12, `environment-probe` 19, `command-probe` 16, `mcp-probe` 14. A count that does not match means the suite did not finish, which is itself a failure.

## The corpus

`corpus/dev/` ships twenty-three contracts under `contracts/`, one compiled-and-sealed pair under `compile-seal-example/`, an `index.json` naming every file with its digest, and a `README.md` explaining what the set covers. Twenty contracts compile. Three fail by design: `empty-request-shapes.json` and `no-operation-inventory.json` raise `unreachable-check-evidence`, and `no-state-change-marker.json` raises `undeclared-mandatory-input`.

## Related pages

- [The full walkthrough](/how-to/author-behavioral-contracts/)
- [Glossary](/reference/glossary/)
- [What Ships](/explanation/what-ships/)
