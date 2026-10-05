---
title: "CLI Reference"
description: "Every command, flag, exit code, export subpath, and port the eval-quality package publishes."
sidebar:
  order: 2
---

# CLI Reference

`package.json` declares two binaries under `bin`. `eval-quality` is the contract pipeline and is what this page documents; inside a clone it is `node dist/cli/main.js` after `npm run build`. `eval-quality-gates` runs the repository gates the package publishes, each configured by the consumer, and [Run the gates on your repository](/how-to/run-the-gates-on-your-repository/) is its page.

There are five commands. `--help`, `-h`, and `help` all print usage, and `help <command>` prints one command's block. `--version` and `-V` print the package version. The five blocks below are what `eval-quality help <command>` prints, minus the exit-code table it appends.

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

Chains `ingest`, `score`, and `emit`: validates each sealed run record against its isolation manifest and evaluator configuration, scores the trial set against the compiled contract, and mints an `EvidenceArtifact` carrying the verdict.

```text
Usage:
  eval-quality score             --record <path> [--record <path> ...] --contract <path> --probe <path>
                                  --preflight-verdict <path> --policy <path>
                                  --corpus-digest <digest>
                                  [--isolation-manifest <path>] [--evaluator-configuration <path>]
                                  [--private-manifest <path>] [--corpus-root <dir>]
                                  [--designated-oracle <O-id>]
                                  [--out <target>] [--strict]

  --record <path>                   a sealed trial record to ingest; repeat for each trial
  --contract <path>                 the compiled contract to score against
  --probe <path>                    the probe the records were run against
  --preflight-verdict <path>        the pre-flight verdict, also the source of the AD-11 fixture digest
  --policy <path>                   the scoring policy
  --corpus-digest <digest>          AD-11's caller-attested corpus digest; no artifact carries it
  --isolation-manifest <path>       the isolation manifest; absent invalidates the run under AD-16
  --evaluator-configuration <path>  the evaluator configuration; absent invalidates the run
  --private-manifest <path>         each entry's digest is checked against its resolved bytes
  --corpus-root <dir>               the directory a private reference resolves under; required only
                                     when --private-manifest or a private-storage isolation-manifest
                                     reference is present
  --designated-oracle <O-id>        the oracle this probe belongs to, for a behavior that lists several;
                                     it must be listed by the probe's behavior and declared by the
                                     contract, or the command exits 64; absent, a behavior listing
                                     exactly one oracle designates it and any other count designates none
  --out <target>                    a .json file path, or a directory taking evidence-artifact.json
  --strict                          promote CONCERNS to exit 1
```

At least one `--record` is required, along with `--contract`, `--probe`, `--preflight-verdict`, `--policy`, and `--corpus-digest`. Repeat `--record` once per trial. Every record carries its own `trialIndex`; scoring orders the set by that field, requires distinct indices, and requires agreement on `contractDigest`, `evaluatorConfigurationDigest`, `mode`, `evaluatorRecommendation`, and `runId`. `--corpus-root` is optional at the argument-parsing level; it becomes required, with a usage error naming it, the moment a private reference actually needs a byte resolved through it.

`--designated-oracle` pairs the probe with one oracle for the witness match and the trial vote.
Without it, a probe is paired with the oracle its behavior lists only when the behavior lists exactly one, so a behavior with a development oracle and a held-out oracle designates neither and its probes score `caught: false`.
With it, the named oracle replaces that pairing.
The flag is accepted only when the probe's behavior lists the oracle and the contract declares it; otherwise the command exits `64`, naming the flag, the oracle, the behavior and the oracles the behavior lists, before any scoring starts and with no artifact written.
A value that is not an oracle identifier (`O-` followed by at least three digits) and a flag given twice exit `64` too.
Naming the one oracle a single-oracle behavior lists gives the same artifact as omitting the flag.
The designation leaves no field of its own in the artifact: the vote it selects is in `reducedProbeOutcomes[].trialVotes`, and every oracle's own state stays in `outcomes`.

On the Invalid rung the command exits `3` and writes no artifact: no legal `EvidenceArtifact` carries a null verdict.
The reasons that rung would have recorded in `verdictBasis` go to stderr instead, one `eval-quality: invalid: <reason>` line per reason in the Invalid basis, so an exit `3` always names its cause.
On every other rung the artifact's own `exitCode` field carries the number the command returns, except a CONCERNS that `--strict` promotes: the artifact still records `0` and the command exits `1`.

A probe that fails AD-9's qualification gate resolves an oracle to `infrastructure-error` wherever no higher-precedence condition already resolved that oracle: an evaluation fault and a malformed judge both outrank it. Each of those three states lands the run on the Invalid rung, and a contract declaring no oracles resolves none of them and stays off it. The command writes one line per reason to stderr on every rung, in the `eval-quality: <code>: <artifactPath>: <detail>` shape, so the failure names the field it fired on. `QUALIFICATION_FAILURES` publishes the closed set of codes those lines draw from.

One invocation scores the complete set named by its `--record` flags. A set meeting the policy's declared minimum with no unreached oracles produces a comparable strength vector. A smaller set or a set with any unreached oracle remains valid input and produces a reported vector marked non-comparable.

A flag a command does not accept exits `64` as an unknown flag, so `--strict-inputs` on `preflight` and `--contract` on `compile` are both usage errors.

## `aggregate-strength`

Reads the per-probe evidence artifacts of one run and mints a `StrengthAggregate`: the run-wide strength of the qualified probes, per class, and the decision against the class floors you declare.

```text
Usage:
  eval-quality aggregate-strength --evidence <path> [--evidence <path> ...] --floors <path>
                                  --policy <path> [--out <target>] [--strict]

  --evidence <path>        a per-probe evidence artifact of one run; repeat for each probe
  --floors <path>          the declared catch-rate floor per class, a JSON object keyed by
                           defect, gameability and zero-action; {} declares none
  --policy <path>          the scoring policy the run was scored under; every evidence artifact
                           is verified against it
  --out <target>           a .json file path, or a directory taking strength-aggregate.json
  --strict                 accepted on every command; this one produces no verdict, so it changes nothing
```

`score` covers one probe per call, so the strength vector in one evidence artifact describes that probe alone and a class floor cannot be compared against it. This command reads every artifact of the run at once. At least one `--evidence`, `--floors`, and `--policy` are required. Pass `{}` as the floors file to declare none. `--policy` is the scoring policy file `score` was given. The command refuses an artifact whose scoring policy digest is not that policy's digest, whose `trials.declaredMinimum` is not the policy's `minimumTrialCount`, or whose reduction used another `catchThreshold`, and the aggregate takes its `minimumTrialCount` from the policy.

The floors file is a JSON object whose keys are classes and whose values are rates from `0` to `1`: `{"defect": 0.75, "zero-action": 1}`. A class with no key declares no floor. A key outside the three classes, or a value outside the unit interval, exits `5`.

The artifact reports, per class:

| Field | Meaning |
| --- | --- |
| `eligible` | the distinct qualified probes of the class. Clean controls and canaries are never counted |
| `exercised`, `caught`, `rate` | the counts and their ratio, computed by the function that builds each artifact's own strength vector |
| `comparable` | every eligible probe's trial set reached the policy's `minimumTrialCount` and none of its oracles resolved `unreached` |

A class with no eligible probe is `null`. A class with eligible probes and none exercised has `rate: null`. `floorDecisions` then states, for every class, the floor you declared and one decision with its reason:

| Decision | `basis` | When |
| --- | --- | --- |
| `meets` | `rate-meets-floor` | the class is comparable, every eligible probe was exercised, and its rate is at or above the floor |
| `does-not-meet` | `rate-below-floor` | the class is comparable and its rate is below the floor |
| `does-not-meet` | `no-eligible-probe` | a floor is declared and the class has no eligible probe |
| `does-not-meet` | `not-comparable` | a floor is declared and some eligible probe was below the minimum trial count or left an oracle unreached |
| `does-not-meet` | `no-exercised-probe` | a floor is declared and no eligible probe was exercised |
| `does-not-meet` | `unexercised-probe` | a floor is declared and some eligible probe, though not all, was never exercised, whatever the rate over the others |
| `undeclared` | `no-floor-declared` | the floors file has no key for the class |

A floor that nothing was measured against is never a pass. Four caught probes among five give a rate of `0.8`, which meets a `0.75` floor and does not meet a `0.9` floor.

The aggregate records the engine version that produced it, read from the package's own generated constant, and, for every artifact it read, the probe, the class it counted toward, the run identifier, and the artifact's digest. A caller that kept each artifact's digest when it scored the probe compares them to the recorded set, so a substituted, dropped, or added artifact is visible. The inputs are sorted by probe, so the order of the `--evidence` flags never reaches the bytes, and a second run over the same files under the same release writes the same bytes.

Under AD-32 the artifact states which scoring-version inputs the caller attested, and artifacts that attested different sets are refused. The aggregate carries the shared list as `callerAttestedInputs`. Its `aggregateAttestedInputs` names what the aggregation takes on trust and cannot verify: `probeClass`, which is read off each strength vector, and evidence set completeness, since nothing in an artifact says which probes the run had. The command does not check run identity either. Choosing which artifacts form the set is the caller's job.

The command reads `--evidence`, `--floors`, and `--policy` through the lexical scanner AD-36 puts in front of hashed artifacts. A file that repeats an object key, which `JSON.parse` resolves to the last value, exits `5` with `non-canonicalizable-value` naming the key. `score` reads `--policy` the same way, and `scanJson(text, artifactPath)` ships on the barrel for a caller that reads these files itself.

The command exits `0` whatever the floor decisions are. The decision lives in the artifact, and the exit codes `1` and `2` stay with the verdict ladder `score` runs, since a floor is a policy over a measurement and no verdict about the system or the contract. A set whose artifacts disagree or contradict themselves exits `4` with nothing written, and the refusal names the artifact and the reason on stderr:

| Code | Refused because |
| --- | --- |
| `strength-inputs-disagree` | two artifacts score one probe, or they differ in scoring version (which carries the corpus digest, the fixture digest, the evaluator configuration digest, the scoring policy digest, and the mode), evidence basis, or attested inputs, or an artifact differs from the supplied policy in scoring policy digest, minimum trial count, or catch threshold |
| `strength-input-inconsistent` | one artifact contradicts itself: its reduction does not follow from its trial votes, its strength vector from its reduction, its comparability flag from its trials and outcomes, or its scoring version or comparability key from the inputs it states. A class vector on an artifact whose outcomes are a clean control's, and an exclusion list on an artifact that scored its probe, are refused the same way |

Each artifact's own `comparabilityKey` covers its one probe, so the keys of the artifacts in one run differ by design. The command checks that each key is the digest of its own scoring policy digest and probe. The aggregate carries a key of its own over every probe it covered, computed the same way. Each probe is scored as its own trial set, so the run identifiers differ and are recorded, never required equal.

What the command verifies is consistency: each artifact with itself and the artifacts with each other. It cannot tell an artifact `score` emitted from a rewrite that stays consistent, and an artifact states no probe class beyond its own strength vector, so a vector moved to another class or nulled to read as a control changes the aggregate without contradicting the artifact. The recorded digests are what bind the aggregate to the artifacts `score` emitted: a caller that kept each digest when it scored the probe compares them to `inputs`, and the aggregate records the engine version that read them, since an artifact records none.

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
  --private-manifest), and --record may repeat; aggregate-strength takes three,
  all required, and --evidence may repeat. Without --out the artifact goes to
  stdout. An --out ending in .json is a file path; anything else is a
  directory taking <target>/<kind>.json. Diagnostics and errors go to stderr.
```

The `.json` suffix is the whole classifier for `--out`, matched case-insensitively. The CLI never stats the path to decide. The artifact kinds that name a file inside a directory target are `eval-contract.json`, `sealed-evaluator-brief.json`, `preflight-verdict.json`, `evidence-artifact.json`, and `strength-aggregate.json`.

`--out` may not resolve to a file that is also an input. The check compares resolved paths and then asks the filesystem whether the two names reach the same file, which catches a symlink and a case-insensitive spelling that no string normalization would fold together. A collision exits `64`.

Artifacts are written as one line of RFC 8785 canonical JSON with sorted keys. The digest is computed over exactly that payload; the serializer appends a line terminator after it, which the digest does not cover.

## Flag parsing

- `--flag=value` splits on the first `=`, so a value may contain one. Only flags that take a value accept this form: `--strict-inputs=true` exits `64` as an unknown flag.
- An empty value exits `64`, in both the `--in=` and the `--in ""` form.
- In the space form, a next token longer than one character that begins with `-` is read as the next flag, so the command reports a missing value and points at the `=` form. A bare `-` stays legal, since it names stdin.
- `--record` and `--evidence` collect every occurrence, as a trial record and as a per-probe evidence artifact. Every other value flag accepts an identical repeat and exits `64` when repeated with different values.
- `--` at the end of the line is ignored. A positional argument exits `64`, because no command takes one.
- `--help` or `-h` anywhere a flag is expected prints that command's help and exits `0`. Where a value is expected it is read as that value and exits `64`, so `compile --in --help` is a usage error.

## Exit codes

```text
Exit codes (AD-21's six, plus 64 from sysexits.h):
  0   success, and every verdict other than FAIL or a promoted CONCERNS
  1   CONCERNS promoted by --strict
  2   FAIL
  3   invalid: a failed pre-flight, or any other AD-21 invalidating condition
  4   structural failure, or an aggregation refused for mixed or inconsistent evidence
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
| `eval-quality: invalid: <reason>` | `eval-quality: invalid: isolation manifest violation: isolation manifest absent` |

---

## Package exports

`package.json` publishes five subpaths, plus `./package.json` itself:

| Specifier | What it resolves to |
| --- | --- |
| `eval-quality` | the library barrel |
| `eval-quality/adapters` | the reference adapters |
| `eval-quality/conformance` | the port vocabulary and the conformance suite |
| `eval-quality/schemas/*` | the thirteen published JSON Schema documents |
| `eval-quality/corpus/*` | the development corpus |
| `eval-quality/package.json` | the manifest |

The published tarball carries `dist`, `schemas`, `corpus`, `README.md`, and `LICENSE`.

The tarball carries two `bin` targets: `eval-quality` at `dist/cli/main.js`, and `eval-quality-gates` at `dist/gates/gates-cli.js`. The gates build is a second compilation of the gate sources into `dist/gates/`, so the library's own emitted paths are untouched by it. The gates binary takes a gate name and reads that gate's section of `eval-quality.config.json` in your repository; [Run the gates on your repository](/how-to/run-the-gates-on-your-repository/) is the page for it.

`eval-quality/schemas/*` resolves to `.json` files, so an ESM import of one needs `with { type: 'json' }`. Node 22 and Node 24 both throw `ERR_IMPORT_ATTRIBUTE_MISSING` without it.

### The library barrel

`eval-quality` exports the stage entry points plus the values a caller needs to interpret what they return:

- **Stages**: `compile`, `seal`, `runPreflight`, `preflightFromObservations`, `runScore`, `aggregateStrength`
- **Qualification**: `qualifyProbe`, `resolveHomeOperation`
- **Target policy**: `evaluateTarget`, `classifyAddress`, `parseAddress`, `staysOnHost`, `isSafeMethod`, `ADDRESS_CLASSES`, `DENIAL_REASONS`
- **Serialization and digests**: `serializeArtifact`, `digestArtifact`, `digestBytes`, `digestComposite`, `scanJson`
- **Lineage**: `validateLineageChain`
- **Errors**: `StructuralFailure`, `AggregationRefusal`, `RuntimeFault`
- **Enumerations**: `FAILURE_CODES`, `AGGREGATION_REFUSAL_CODES`, `RUNTIME_FAULT_CODES`, `FORBIDDEN_TARGET_REASONS`, `PORT_FAILURE_REASONS`, `VERDICTS`, `EVALUATOR_RECOMMENDATIONS`, `INTERCHANGE_ARTIFACT_KEYS`, `QUALIFICATION_FAILURES`, `SEVERITY_LEVELS`, `DOMINANCE_RELATIONS`, `OUTCOME_STATES`, `DISCIPLINE_RULES`
- **Schema versions**: `PROBE_SCHEMA_VERSION`, `EVAL_CONTRACT_SCHEMA_VERSION`, `SEALED_EVALUATOR_BRIEF_SCHEMA_VERSION`, `EVIDENCE_ARTIFACT_SCHEMA_VERSION`, `PREFLIGHT_VERDICT_SCHEMA_VERSION`, `SEALED_RUN_RECORD_SCHEMA_VERSION`, `ISOLATION_MANIFEST_SCHEMA_VERSION`, `EVALUATOR_CONFIGURATION_SCHEMA_VERSION`, `SCORING_POLICY_SCHEMA_VERSION`, `PRIVATE_ARTIFACT_MANIFEST_SCHEMA_VERSION`, `STRENGTH_AGGREGATE_SCHEMA_VERSION`
- **Comparison**: `compareDominance`
- **Evaluation**: `resolveCheck`, `makeResolveOperand`, `makePointerDenotesCollection`, `referenceSetKeysOf`, `ABSENT`
- **Version**: `VERSION`

Every artifact type ships alongside them as a type-only export, with the option and result types of the entry points that declare them: `RunPreflightOptions`, `PreflightFromObservationsOptions`, `RunScoreOptions`, `RunScoreResult`, and `AggregateStrengthOptions`. `compile` and `seal` take an inline `{ strict?: boolean }` and export no options type.

Every schema version is declared as the literal integer it holds, so a caller comparing an artifact's `schemaVersion` against one narrows on it. AD-11 puts the equality comparison on whoever reads the artifact, and a stamp this build does not read becomes a `schema-version-mismatch` runtime fault at exit `5`. Importing the number is how a caller states the version this build reads.

Eleven of the thirteen artifacts carry one. Nine have an in-package reader that performs the equality: `compile` over an eval contract, `preflight` and `score` over a probe, `score` over a sealed run record, an isolation manifest, an evaluator configuration, a preflight verdict, a private artifact manifest and a scoring policy, and `aggregate` over an evidence artifact and a scoring policy. Four are stamped by this package: `seal` writes the brief, `emit` writes the evidence artifact, `preflight` writes the verdict, and `aggregate` writes the strength aggregate, each from its own constant. The evidence artifact and the verdict sit in both groups, since `aggregate` reads the version `emit` stamps and `score` reads the version `preflight` stamps. `artifact-reference` carries no lineage fields at all. A rubric does carry a `schemaVersion`, and no constant here states it: this package never parses a standalone rubric, and the eval contract embeds `RubricBody`, the body without lineage.

`aggregateStrength({ evidence, floors, policy })` is the entry point the `aggregate-strength` command calls. `evidence` is the run's per-probe `EvidenceArtifact` values in any order, `floors` is a `StrengthFloors` value, and `policy` is the `ScoringPolicy` the run was scored under. The version it records is the package's own, and no caller supplies one. It is synchronous and returns a `StrengthAggregate`. An input that does not parse throws `RuntimeFault` with code `schema-parse-failure` and `artifactPath` `EvidenceArtifact[]`, `StrengthFloors`, or `ScoringPolicy`, an evidence artifact or a scoring policy stamped with another `schemaVersion` throws `schema-version-mismatch` at `EvidenceArtifact[N].schemaVersion` or `ScoringPolicy.schemaVersion`, read before its shape so a stale artifact is named as one, and a set whose artifacts disagree or contradict themselves throws `AggregationRefusal` with one of `AGGREGATION_REFUSAL_CODES`, carrying the same `code` and `artifactPath` as `StructuralFailure` and sharing its exit code in the CLI.

`compareDominance` is AD-7's four-valued relation over two scored results. It takes two `ComparableResult` values and a `Severity` floor and answers one of `DOMINANCE_RELATIONS`: `a-dominates-b`, `b-dominates-a`, `equivalent`, or `incomparable`. `ComparableResult`, `DominanceRelationValue`, and `Severity` ship as type-only exports beside it. A comparable result includes `scoredProbeId`, `outcomes`, `trials`, and `reducedProbeOutcomes`; `trials.completedAttempts` retains the exact trial identities, while each reduction retains the selected `trialVotes` and `catchThreshold` needed for exact recomputation. The comparison returns `incomparable` when the reduction contradicts its probe identity, trial identities, votes, counts, severity, invalidated attempts, or detailed trial evidence. It re-derives no strength vector and reads no port, corpus, or clock.

`runScore` reads each sealed run record's `schemaVersion` before its shape. A record stamped with another version throws `RuntimeFault` with code `schema-version-mismatch` and `artifactPath` `SealedRunRecord[trialIndex=N].schemaVersion` (`SealedRunRecord[index=N].schemaVersion`, with `N` the position in the list, when the record carries no numeric `trialIndex`), naming the stamp and the version this build reads, so a stale record is named as one. `compile`, `preflight` and `score` read the eval contract's stamp the same way, ahead of its parse, at `EvalContract.schemaVersion`. `score` reads the stamp of the isolation manifest, the evaluator configuration, the preflight verdict, the scoring policy, the private artifact manifest and the probe the same way, at `IsolationManifest.schemaVersion`, `EvaluatorConfiguration.schemaVersion`, `PreflightVerdict.schemaVersion`, `ScoringPolicy.schemaVersion`, `PrivateArtifactManifest.schemaVersion` and `Probe[probeId=<id>].schemaVersion` (`Probe.schemaVersion` when the probe carries no string `probeId`), so one stamped for another version exits `5` as `schema-version-mismatch` before its shape is read, and one with no numeric stamp is left to the parse. A `null` isolation manifest, evaluator configuration or private artifact manifest has no stamp to read. `preflight` reads the stamp of each probe at the same path, ahead of the probes' parse.

`runScore` returns the probe's own qualification result next to the artifact and the ladder. `qualification.failures` carries AD-9's closed reason codes for a probe the gate rejected, typed as `QualificationFailure` and `QualificationFailureCode`, and `qualification.declarationChecksRan` says whether the three checks that read the home operation's declared shapes ran.

`qualifyProbe(probe, homeOperation)` is AD-9's gate over one probe, the check `runScore` runs before it scores anything. `homeOperation` is the operation the probe's signature resolves to, typed `AnyOperation`. `resolveHomeOperation(signature, interfaces)` finds it: it takes the probe's `DefectSignature` and the contract's `PermittedInterface` list and returns a `HomeOperation`, the matching operation with the `interfaceId` of the interface that declares it (`{ interfaceId, operation }`), or `null` when none matches. Pass its `operation` to `qualifyProbe`. The interface is returned because two interfaces may declare one `operationId`, so the operation alone does not say which observations exercised it. For a probe carrying a signature, a `null` home operation skips the three declaration checks and `declarationChecksRan` comes back `false`; a signature-less probe, such as a canary, reports `true`, since those checks read the signature. `OUTCOME_STATES` is AD-6's closed twelve outcome states, and `DISCIPLINE_RULES` is AD-20's seven rule identifiers, typed `DisciplineRule`, the spellings a coverage gap and a waiver carry in `rule`.

`evaluateTarget(policy, target)` is AD-35's default-deny decision over one resolved HTTP target. An `EnvironmentProbePort` you write for `api` delegates to it for every resolved address and every redirect, so address classification lives in one place. `policy` is a `ProbeTargetPolicy` listing `ProbeTargetAuthorization` entries, and `target` is a `ResolvedTarget` naming the interface, scheme, host, port, resolved address, and method. It returns a `PolicyDecision`. An allow carries the matching authorization, the address's `AddressClass`, and its `canonicalAddress`; a deny carries one `DenialReason` out of `DENIAL_REASONS`, a `detail` message, and the `addressClass`. A port that denies throws `RuntimeFault` with code `forbidden-target`, and passing `{ reason: decision.reason }` as the fault's options gives the caller that reason as the fault's `reason`. Authorizations naming the same interface are tried in declaration order and the first that allows wins; when none allows, the first one's denial is reported, and when no authorization names the target's interface, the decision is `interface-not-authorized`. The matched authorization's caps, `maxRedirects`, `maxElapsedMs`, `maxRequestBytes`, and `maxResponseBytes`, are the port's to enforce, and `evaluateTarget` does not check them. `classifyAddress` answers one of `ADDRESS_CLASSES` for an address, `parseAddress` returns the `ParsedAddress` both sides of a comparison are reduced to, `staysOnHost` says whether a connection to an address stays on the local host, and `isSafeMethod` says whether an authorization marks a method safe for a differential probe. `ProbeTargetPolicy` and `ProbeTargetAuthorization` ship as types, and a mapping loaded from disk goes through `parseProbeTargetPolicy(value)` on `eval-quality/adapters` first, which holds the boundary the command and MCP parsers hold: a deep copy, strict objects, the same fault shape, and hostile input refused. Two things differ. An HTTP authorization carries no record, so an own `__proto__` key is refused at the policy and at each authorization only. Several authorizations may name one `interfaceId`, because `evaluateTarget` tries them in declaration order, where the MCP parser refuses a repeat. It returns a deep copy typed `ProbeTargetPolicy`, and a refusal throws `RuntimeFault` with code `schema-parse-failure` and `artifactPath` `ProbeTargetPolicy`. It refuses a `scheme` outside `http` and `https`, a `port` outside 1 to 65535, an empty `addresses` or `methods`, an `addresses` entry `parseAddress` cannot read (a hostname, a port suffix, or a malformed literal), a `methods` or `safeMethods` entry outside the seven uppercase methods, a negative `maxRedirects`, a ceiling below 1, and an unknown key; an empty `authorizations` array and an empty `safeMethods` are valid.

`staysOnHost(address)` answers `true` for IPv4 `127.0.0.0/8`, IPv6 `::1`, the `::ffff:` spelling of a `127.0.0.0/8` address, and the unspecified addresses `0.0.0.0` and `::`, which `classifyAddress` also counts as loopback. It answers `false` for every other address and for one `parseAddress` cannot read, such as a hostname. It is narrower than `classifyAddress(address) === 'loopback'`: `classifyAddress` classes the NAT64 form `64:ff9b::7f00:1` and the IPv4-compatible form `::127.0.0.1` by their embedded IPv4 address, which is the right answer for a denial, and a connection to either goes through a translator and leaves the host. A caller deciding whether a credential sent over plain `http` stays on the machine asks `staysOnHost`.

`runPreflight` takes an `EnvironmentProbePort` and awaits it. `preflightFromObservations` takes observations you already have and stays synchronous; the CLI's `preflight` command calls that one. `runScore` takes an optional `CorpusPort`, awaited only when a private reference actually needs resolving.

`resolveCheck(expression, resolveOperand, pointerDenotesCollection, referenceSetKeys, regexMatchStepBudget, artifactPath)` is the evaluator: it walks a compiled contract's `Expression` and returns one `CheckResolutionValue`, exactly what `score` reads off each check. `runScore` calls it internally; the barrel exports it, and the three functions that build its second through fourth arguments, for a caller assembling its own evaluation path outside `runScore`. `expression` is the compiled contract's own check expression, the first argument and the only one the barrel does not build for you. `makeResolveOperand(stepObservations, referenceSets)` closes over a step's observations and a contract's reference sets to answer what an `Operand` denotes. `makePointerDenotesCollection(contract, providedIndex?)` closes over the contract to answer whether an evidence pointer names a collection channel; pass the `PlanIndex` a caller already built as `providedIndex` to skip rebuilding it. `referenceSetKeysOf(contract)` reads the key list a reference set declares. `ABSENT` is the sentinel `resolveOperand` returns for a pointer or reference set that resolves to nothing; `resolveCheck` never throws on it, but does throw when a supplied `resolveOperand` or `pointerDenotesCollection` returns a shape the compiled contract's schema already rules out, since that is an integration bug in the caller's own function and never a data outcome to fold into the result. `ResolveOperand`, `PointerDenotesCollection`, `ReferenceSetKeys`, `ResolvedValue`, and `PlanIndex` ship as type-only exports beside them; `Expression`, `Operand`, `CheckResolutionValue`, `Observation`, and `JsonValue` ship type-only too, off `core/schemas` directly.

## Ports and adapters

The package performs no effects of its own. A **port** is an interface it declares for an effect it will not perform, and an **adapter** is your implementation of one. This matters only if you are building your own pipeline on the library; the CLI needs none of it.

| Port | What it does | Wired today |
| --- | --- | --- |
| `EnvironmentProbePort` | Probes a live environment | Yes. `runPreflight` awaits it |
| `CorpusPort` | Resolves an opaque private reference to bytes | Yes. `runScore` awaits it when a private reference needs its digest checked |
| `ClockPort` | Reads the current time | No |
| `FileSystemPort` | Reads and writes files | No. The CLI uses `node:fs/promises` |

Each port's type comes from `eval-quality/conformance`. `eval-quality/adapters` ships five reference adapters, `createLocalCorpusAdapter`, `createNodeFileSystemAdapter`, `createSystemClockAdapter`, `createCommandLineAdapter`, and `createMcpAdapter`, each a factory taking the mechanism it wraps. `createCommandLineAdapter` implements `EnvironmentProbePort` for the `cli` mechanism only, over a real child process, authorized by a `CommandTargetPolicy` mapping outside the contract. `createMcpAdapter` implements it for the `mcp` mechanism over MCP's stdio transport only, launching the tool server as a child process and authorized by an `McpTargetPolicy` mapping. Both adapters start the target as the leader of a new session and process group. Exceeding `maxElapsedMs` or `maxOutputBytes`, or an abort, kills that whole group, so a grandchild the target started (`npx`, a shell wrapper, an agent runner's model CLI) goes with it, and `createMcpAdapter` kills its server's group the same way when every session ends. A small Node watchdog, in a session of its own, starts the target and holds one end of a socket pair whose other end only the host holds; when the host ends, however it ends, SIGKILL to the host or to the host's process group included, the kernel closes the host's end and the watchdog kills the target's group. The watchdog costs one Node start per run, and `maxElapsedMs` counts from the target's own start, with 30 seconds more allowed for the watchdog to start it. A command-line target that exits on its own with its streams closed is observed as it exited, with its exit code, stdout, and stderr, and nothing it left running is touched. A tool server whose process ends the session after the `initialize` handshake and before it answers `tools/call` is observed as it ended, as an `McpProbeObservation` with `isError` true, an absent `result`, and its signed `exitCode`; one that ends or errors before or during the handshake, or that writes a line that is no JSON-RPC message at any phase, valid JSON included, throws `port-failure`, and so does a watchdog killed while the server runs. The new session has two costs. The target has no controlling terminal, so one that opens `/dev/tty` for a prompt fails there. A terminal's Ctrl-C no longer reaches it directly: a host that Ctrl-C ends takes the group down through the lifeline, and a host that handles SIGINT and keeps running aborts the signal it passed in to stop a run. Windows has no process groups, so there both adapters spawn the target as the host's direct child, kill it alone, and stop it at the host's end only when the host exits through `process.exit()` or an uncaught exception. A single executable application cannot start a Node watchdog from its own binary, so there the target runs detached with no lifeline, and the host's end stops it only through `process.exit()` or an uncaught exception. A policy denial from either adapter throws `RuntimeFault` with code `forbidden-target` and a `reason` naming the rule that refused the request, typed `ForbiddenTargetReason`, one of `FORBIDDEN_TARGET_REASONS` on the root barrel and on `eval-quality/conformance`, so a caller records why without parsing the message. `createCommandLineAdapter` sets `interface-not-authorized`, `executable-not-authorized`, `subcommand-not-authorized`, or `environment-key-not-authorized`, the last for a declared environment key the authorization does not permit and for a declared `PATH`. `createMcpAdapter` sets `interface-not-authorized` or `tool-not-authorized`. A request of a kind the adapter does not run gets `interface-not-authorized`, the same denial as an interface no authorization names. `createCommandLineAdapter` also sets `portFailureReason` on one `port-failure`: `launch-too-large`, typed `PortFailureReason`, one of `PORT_FAILURE_REASONS` on the same two entry points, for a launch the operating system refused for the size of its arguments and environment (Node's `E2BIG`, whether `spawn` threw it or the child emitted it), with the spawn error kept as the fault's `cause`. A target that cannot start (`ENOENT`, `EACCES`) and every other `port-failure` carry no `portFailureReason`, and every other code carries `undefined` for it. `reason` stays the `forbidden-target` field alone. Every other fault's `reason` is `undefined`. Both adapters take their mapping typed and never parse it, so a mapping read from disk goes through `parseCommandTargetPolicy(value)` or `parseMcpTargetPolicy(value)` first, both on `eval-quality/adapters`, which also exports `parseProbeTargetPolicy` for the HTTP mapping `evaluateTarget` takes. Each returns a deep copy of a valid mapping, typed `CommandTargetPolicy`, `McpTargetPolicy`, or `ProbeTargetPolicy`. Every object in each mapping is strict, so an unknown key is refused, an own `__proto__` key from `JSON.parse` included; the command parser also refuses `PATH` in `permittedEnvironmentKeys`, and the MCP parser refuses two authorizations naming one `interfaceId`. A refusal throws `RuntimeFault` with code `schema-parse-failure`, `artifactPath` `CommandTargetPolicy`, `McpTargetPolicy`, or `ProbeTargetPolicy`, and the `ZodError` carrying every issue as its `cause`: the code and path every other parse boundary here throws, with the `ZodError` cause every schema-validating boundary carries. The three parsers add one thing of their own: the fault's message lists each issue as an RFC 6901 pointer and a message. Input whose own accessors or proxy traps throw is refused under the same code, with the thrown value as the `cause`. A tool server reached over Streamable HTTP speaks the same JSON-RPC across a socket, and this package performs no network I/O, so that transport is a caller's own adapter; there is no reference `EnvironmentProbePort` for `api` for the same reason, because probing a live HTTP environment is the part only you can write.

**The conformance suite** decides whether an implementation conforms. It checks behavior the type checker cannot: whether the implementation returns a typed fault where the boundary demands one, and whether it hangs where it should time out. It takes a `PortSubject`, a small harness around your port carrying a name, one sample request, and a `build` function the suite calls once per scenario. `ScenarioKind` is the four situations it needs your port to be in: `resolves`, `fails`, `in-band-error`, and `hangs`. Putting the port into each of them is your job, because only you know how to make your mechanism fail.

There is one runner per port, and `EnvironmentProbePort` has one arm per mechanism: `runClockPortConformance`, `runCorpusPortConformance`, `runFileSystemPortConformance`, `runEnvironmentProbePortConformance` (the `api` arm), `runCommandLineProbeConformance` (the `cli` arm), and `runMcpProbeConformance` (the `mcp` arm). A report carries the subject name, the port, one outcome per assertion, and a `passed` field over all of them. Every outcome id has the form `<method>/<assertion>`, so a failure names the method and the property it broke.

`CONFORMANCE_OUTCOME_COUNTS` publishes the count per port, and the suite asserts its own totals against it: `corpus` 6, `clock` 6, `file-system` 12, `environment-probe` 19, `command-probe` 16, `mcp-probe` 14. A count that does not match means the suite did not finish, which is itself a failure.

## The corpus

`corpus/dev/` ships twenty-four contracts under `contracts/`, one compiled-and-sealed pair under `compile-seal-example/`, an `index.json` naming every file with its digest, and a `README.md` explaining what the set covers. Twenty-one contracts compile. Three fail by design: `empty-request-shapes.json` and `no-operation-inventory.json` raise `unreachable-check-evidence`, and `no-state-change-marker.json` raises `undeclared-mandatory-input`.

## Related pages

- [The full walkthrough](/how-to/author-behavioral-contracts/)
- [How It Works](/explanation/behavioral-evaluation-contracts/)
- [Contract Strength](/explanation/contract-strength/)
- [Glossary](/reference/glossary/)
