---
title: eval-quality Hypothesis Validation Plan
status: closed — superseded by ADR-002
created: 2026-07-22
updated: 2026-07-27
owner: Murat Ozcan
---

# eval-quality Hypothesis Validation Plan

**Closed 2026-07-27.** Both decisions below are recorded without running the preregistered block-2
rerun; see `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-22/ADR-002-contract-authoring-discipline.md`
for the decision and its build order. The document below is
preserved as the execution authority that produced the evidence, not as an open plan. Where it says a
decision is pending or the PRD is blocked, the ADR controls.

## 1. Decision this plan must produce

This plan makes two independent product decisions:

1. Whether an isolated, black-box evaluator agent adds material release evidence for human-on-the-loop and dark-factory software delivery.
2. Whether `eval-quality` should ship semantic evaluators on top of an established agent evaluation engine.

The full runner, provider adapter, assertion DSL, pass@k, cost accounting, reporting, CLI, and CI machinery will come from an existing open-source engine. `eval-quality` will use public extension points. It will not duplicate that machinery.

`eval-quality` is the single product name. It covers the agents, rules, methodology, governance, and any semantic evaluator pack that earns its way through this experiment. The former name "AE" is retired.

`DECISION.md` records a verdict for the independent-evaluator hypothesis:

1. **DARK-FACTORY VALIDATED:** The isolated evaluator passes the H0 gate. eval-quality may advance independent black-box evaluation to design-partner validation.
2. **DARK-FACTORY REJECTED:** H0 fails. TEA may still support conventional eval best practices, but eval-quality cannot claim a dark-factory advantage.

It also records one evaluator-pack decision:

1. **BUILD THIN PACK:** At least two evaluator hypotheses pass every required gate. Package only the evaluators that passed. Keep the existing engine underneath.
2. **NARROW AND REPEAT:** Exactly one evaluator hypothesis passes. Run a second confirmatory corpus for that evaluator. Do not publish production library code yet.
3. **METHODOLOGY ONLY:** No evaluator hypothesis passes, or the overall safety gate fails. Keep `eval-quality` as the agents, rules, methodology, and governance layer over existing tools. Leave prototype code under `experiments/` as research evidence.

The implementation PRD remains blocked until both decisions are recorded.

### Document boundary

This document is the execution authority for the research phase. The Eval Contract, isolation boundary, agent roles, and result schemas below are experimental controls. They are provisional and may be changed or rejected by the evidence.

A product ADR is intentionally deferred. Write product architecture only after H0 and the semantic evaluator decision are recorded and the brief and PRD are revised. No ADR is required to execute this plan.

### Owner override: agent ground truth

On 2026-07-27, the experiment owner removed every requirement to recruit or wait for human
reviewers. The Test Architect is the ground-truth authority for H0 and the semantic experiment.
Ground truth must still be frozen before condition results, anchored to reproducible oracle
evidence, and isolated from evaluator outputs. Later references to Reviewer A, Reviewer B, human
reviewers, reviewer agreement, or human labeling are superseded by this section. No experiment
state may block on a human-reviewer input.

The decision rule remains binary and unchanged. Every H0 gate must pass for
`DARK-FACTORY VALIDATED`; any failed gate produces `DARK-FACTORY REJECTED`.

### Corpus and ground truth, revised 2026-07-27

Ground truth comes from version-control history rather than from an adjudicated rating. Each case is
the commit immediately before a bug fix, and the fix's own test set is the oracle: the test must fail
on assertions at the parent commit and pass once the fix is applied. Defect existence is therefore
mechanical, the adjudicated source is `natural` by construction, and no second rater is required.

Four qualification filters apply, in order. A case must be **usable** (its test fails at the parent
and passes with the fix, and resolves its imports at the parent), **material** (the fix changes
behaviour rather than a comment, type alias, or description string), **observable** (probing the
public interface at parent and at fix yields different responses), and **judgeable** (a contract can
state the expected behaviour without naming the defect, and an evaluator can reach a verdict from the
interface alone). Judgeability is the filter most easily missed: a defect can be plainly observable in
a diff and still be impossible for a sealed evaluator to judge without being handed the answer.

The environment for a scored run must be hermetic and must satisfy **declared invariants for the
interfaces the probe exercises**, since no pre-flight can prove an environment defect-free in
general. Before any arm launches, exercise every tool the contract can reach and confirm the only
anomalous response is the seeded one. Treat every unexplained anomaly as a harness defect until
proven otherwise. Both executed rounds lost evidence to measurement-layer defects, and block 1's
false-FAIL gate originated there. The round-1 gates failed or went unmet for separate reasons:
reduced sample, an underspecified oracle, blocked live access to the second system, and missing
isolation instrumentation.

### Active hypothesis, revised 2026-07-27

H0 as written is closed and its result is disputed in the same breath: the scored round could not
have reached `DARK-FACTORY VALIDATED`, because gate 1 requires defects whose source is `natural` and
that corpus contained none. Read that outcome as **untested**, not as refuted.

The active hypothesis is **contract-authoring discipline**: at equal model, budget, and black-box
access, a contract authored under oracle discipline causes a sealed evaluator to detect materially
more naturally occurring defects than a contract authored plainly from the same description. The only
manipulated variable is the authoring method. Evaluator isolation is held constant across arms rather
than tested, and reported as a delivery property.

The primary metric is **contract detection rate**, the share of qualified natural defects whose
oracles cause the sealed evaluator to take the action that exposes the defect, reported per defect
class and across repetitions. Secondary metrics are diagnosis depth, verdict stability, and false
FAIL rate against fixed-code controls.

Block 1 ran on 2026-07-27 over 19 sealed repetitions across 3 cases. Pooled detection was 0.33 for
plainly authored contracts and 1.00 for discipline-authored contracts, with 3 of 3 verdict stability
and zero isolation violations. Four of five gates passed. The safety gate failed on a harness defect
that produced the block's only false FAIL, so the block does not support the hypothesis under its own
all-gates rule and does not refute it either. The semantic hypotheses H1 through H4 rank below
replication of this result.

## 2. Decisions already made

- Use [agentevals-dev/agentevals](https://github.com/agentevals-dev/agentevals) as the primary engine. It already provides local execution, OpenTelemetry trace ingestion, golden sets, CI gates, reports, and custom evaluators in any language.
- Use [Promptfoo](https://www.promptfoo.dev/) as the independent baseline comparator.
- Pin the exact engine versions, judge model snapshot, prompts, and configuration in the experiment commit before scored execution begins.
- Use the strongest reasonable baseline configuration for each tool. A weak baseline would invalidate the comparison.
- Use the same traces, judge model snapshot, and temperature across both baselines and the prototypes wherever the tools allow it.
- A Python engine is acceptable. TypeScript and JavaScript evaluators remain first-class through the engine's custom evaluator protocol.
- Prototype through public extension points. Do not fork an engine during this experiment.
- Grounding means support from evidence the agent observed. It does not establish that the evidence itself is true. Outcome correctness and evidence correctness must be labeled separately.
- Longest common subsequence does not model a partial order. Semantic checkpoints must use an accepted-path set or an explicit dependency graph.
- TEA creates a sealed Eval Contract from the product spec before implementation. The evaluator agent receives the contract and black-box interfaces. It receives no original spec, source code, repository, builder transcript, or implementation logs.
- The Eval Contract contains behavior goals, risk hypotheses, oracles, constraints, permitted interfaces, test-data rules, budgets, and evidence requirements. It contains no prescribed action sequence.
- The evaluator chooses its own actions at runtime. Pre-canned tests remain baseline evidence rather than the independent evaluator's execution model.
- Treat the Eval Contract and isolation rules as experiment controls. They do not establish production architecture.

## Agent execution contract

An agent receiving this document must start here. It must not begin scored execution from the checklist alone.

### Start location and primary agent

Run the experiment from `~/opensource/eval-quality`. This repository is the orchestration home and owns public-safe preregistration, schemas, prompts, normalized traces, labels, results, and decisions. Private inputs and evidence remain in the owner-controlled private store. Do not start the orchestration session inside a system-under-test repository.

Use this launch sequence:

1. Open a fresh agent session with `~/opensource/eval-quality` as its working directory.
2. Invoke `$bmad-tea` to make the BMad Test Architect the experiment orchestrator.
3. Give the Test Architect the handoff prompt in section 13.
4. Start at Phase A, step 1. If `experiments/hypothesis-validation/STATUS.md` exists, resume only its single next action.
5. Stop for Murat's approval at both preregistration gates.

The first chat instruction can be copied exactly:

```text
$bmad-tea

Execute HYPOTHESIS_VALIDATION_PLAN.md as the experiment orchestrator. Work from the eval-quality repository. Start with Phase A. Use Couture Cast as the conventional system under test. Resolve the owner-approved private system through the opaque ID agentic-system and the owner-controlled private input record. Keep all private values and evidence outside this repository. Do not begin scored work until both input records and the H0 preregistration are complete and Murat approves them.
```

The Test Architect owns the experiment from preflight through decision. It delegates bounded scaffold, adapter, baseline, and prototype implementation tasks to BMad Dev. BMad Dev must not orchestrate the experiment or change its hypotheses, labels, gates, and decision rules. Each independent-evaluator condition uses a fresh generic agent because any agent that has read the product spec or repository has already violated the isolation boundary.

### Where Couture Cast fits

Use `~/opensource/couture-cast` as the first H0 system under test. It fills the conventional application slot. Its current recommendation implementation is deterministic. The planned LLM layer does not make the current codebase an agentic system.

Discovery evidence recorded on 2026-07-22:

- Repository commit observed during planning: `d85ef5faca1b59fd303720c80af706c2818a5305`. The orchestrator must record the actual immutable SHA used by the experiment.
- Black-box surfaces: web application and HTTP API.
- Candidate startup command from `package.json`: `npm run start:all`.
- Candidate deterministic commands from `package.json`: `npm test` and `npm run test:pw-local`.
- Product and task sources include `_bmad-output/project-knowledge/couturecast_brief.md` and the planning and implementation artifacts under `_bmad-output/`.

These commands are discovery candidates. Phase A verifies setup, cleanup, safety, prerequisites, and exact commands before any run. The builder works in a dedicated Couture Cast checkout or worktree. The independent evaluator receives only a running allowlisted web or API interface, scoped test data, and the sealed Eval Contract. It never receives the Couture Cast path or checkout.

Couture Cast alone cannot satisfy H0. The second slot is already owner-approved and uses the public identifier `agentic-system`. Its identity, repository, commands, task sources, and evidence remain in an owner-controlled private record outside this repository. Before H0 approval, the Test Architect verifies that it exposes current agentic or probabilistic behavior, has six suitable implementation tasks, provides a stable black-box interface, and can preserve complete evidence. Propose a replacement only if preflight proves that the approved system cannot satisfy those requirements.

For H1 through H4, "Couture Cast traces" means complete traces produced by coding agents while implementing or evaluating Couture Cast tasks. It does not mean end-user application telemetry. The second semantic corpus source is complete structured execution traces from `agentic-system`. The Test Architect verifies trace completeness, diversity, retention permission, and sanitization before admitting either source.

### Public and private evidence boundary

This repository is public. The experiment may use an owner-approved private system locally while preserving a strict publication boundary.

The public repository may contain:

- Generic system IDs such as `agentic-system`.
- Hypotheses, schemas, rubrics, gates, and public-safe Eval Contracts.
- Opaque private references, SHA-256 digests, aggregate metrics, and sanitized findings.
- Synthetic or explicitly approved trace examples.

The owner-controlled private evidence store contains:

- The private system identity, repository path, immutable revision, commands, and task-source locations.
- Credentials, network details, private specifications, system prompts, and test-data configuration.
- Raw traces, raw results, private labels, implementation patches, and any artifact containing private source or domain data.

Never place a private artifact anywhere under the `eval-quality` working tree, including an untracked or gitignored path. Local execution is permitted from an adjacent owner-controlled workspace. Public manifests link to private evidence with an opaque `privateRef` and a SHA-256 digest. An opaque reference must reveal nothing about the system or organization.

Sensitive exact values are intentionally absent from public files. Scored execution is permitted when the Test Architect verifies the complete private record and records matching opaque references and digests. A missing private value, inaccessible artifact, or digest mismatch blocks execution.

### Recommended role assignment

| Role | Recommended agent | Responsibility | Forbidden actions |
| --- | --- | --- | --- |
| Experiment owner | Murat | Supplies systems and access, approves preregistration, accepts the final decision | Must not change gates after scored results are visible |
| Experiment orchestrator | BMad Test Architect | Owns risk analysis, Eval Contracts, rubric, preregistration, isolation, ground-truth workflow, scoring, and `DECISION.md` | Must not serve as the independent evaluator after reading the original specs |
| Implementation worker | BMad Dev | Creates the experiment scaffold, adapters, normalization shim, and evaluator prototypes from bounded tasks | Must not alter hypotheses, gates, labels, or decision rules |
| Builder condition | BMad Dev or another coding agent | Implements each H0 task with the original spec and repository | Must not receive hidden defects, evaluator output, or adjudicated labels |
| Self-evaluator condition | Fresh agent run with builder context | Evaluates the implementation with the Eval Contract, original spec, repository, and builder context | Must not receive independent-evaluator output or human labels |
| Independent-evaluator condition | Fresh generic agent in an isolated context | Evaluates only the sealed Eval Contract through black-box interfaces | Must not receive the original spec, codebase, repository, builder context, comparator output, or human labels |
| Ground-truth authority | Test Architect | Establishes and seals ground truth before evaluator results exist | Must anchor labels to reproducible oracle evidence and remain blind to later condition results |

Use separate conversations, processes, and workspaces for the builder, self-evaluator, and independent-evaluator conditions. A fresh prompt inside a shared conversation is not isolated.

### Required owner inputs

Before creating scored artifacts, the orchestrator must collect and record:

1. The two public system IDs, plus repository paths and immutable commit SHAs in the appropriate public or private record.
2. Startup, deterministic-test, scripted agent-eval, test-data setup, and cleanup commands for each system. A scripted command may be `NOT_APPLICABLE` when no pre-existing suite exists.
3. Six candidate implementation tasks per system, with stable task IDs and source spec paths.
4. The black-box UI, API, CLI, or MCP interface kinds permitted for each system. Exact private endpoints stay in the private record.
5. Scoped credentials, synthetic test data, safety limits, and network allowlists. Exact private values stay in the private record.
6. Builder, self-evaluator, independent-evaluator, and judge model snapshots.
7. Token, tool-call, wall-clock, and cost ceilings for every agent condition.
8. Confirmation that the Test Architect is the ground-truth authority.
9. The experiment branch and the directories the agents may modify.
10. Exact `agentevals-dev/agentevals` and Promptfoo versions for the semantic experiment.
11. The exact revision, configuration, prompts, and model snapshot for every applicable pre-existing scripted agent-eval baseline.

Record public-safe values in `experiments/hypothesis-validation/execution-inputs.yaml`. Record sensitive values in the owner-controlled private input record outside this repository. Never invent a missing endpoint, command, credential, schema, repository path, or task. If a required value cannot be discovered from the public repositories, the private record, or owner-provided evidence, set the status to `BLOCKED_INPUT` and ask the owner one concrete question.

Minimum shape:

```yaml
experimentId: eq-hypothesis-001
branch: experiment/hypothesis-validation
owner: Murat
reviewerB: null
systems:
  - id: couture-cast
    category: conventional
    repoPath: ~/opensource/couture-cast
    commitSha: null
    startupCommand: null
    deterministicTestCommand: null
    scriptedEvalCommand: null
    dataSetupCommand: null
    cleanupCommand: null
    blackBoxInterfaces: []
  - id: agentic-system
    category: agentic
    privateRef: private-system-01
    privateRecordDigest: null
    commitShaDigest: null
    startupCommandDigest: null
    deterministicTestCommandDigest: null
    scriptedEvalCommandDigest: null
    blackBoxInterfaceKinds: []
tasks:
  - taskId: null
    systemId: null
    sourceSpecPath: null
    selectionRationale: null
tools:
  agentevalsVersion: null
  promptfooVersion: null
models:
  builder: null
  selfEvaluator: null
  independentEvaluator: null
  judge: null
budgets:
  maxToolCalls: null
  maxInputTokens: null
  maxOutputTokens: null
  maxWallClockMinutes: null
  maxCostUsd: null
access:
  credentialKinds: []
  networkAccessKinds: []
  publicAllowedWriteRoots: []
  privateAccessDigest: null
privateEvidence:
  storage: outside-public-repository
  manifestRef: null
  manifestDigest: null
  sanitizationPolicy: null
```

Null required public values block scored execution. For `agentic-system`, the public digests and opaque references must be populated and must match a complete private record. Sensitive exact values stay absent from this YAML.

The owner-controlled private input record uses this minimum shape. Values represented by angle-bracket placeholders are required unless the field explicitly permits `NOT_APPLICABLE`:

```yaml
recordVersion: 1
publicSystemId: agentic-system
privateRef: private-system-01
approval:
  ownerApproved: true
  approvedPurpose: eval-quality-hypothesis-validation
system:
  identity: <private-name>
  repoPath: <absolute-private-path>
  commitSha: <immutable-revision>
  startupCommand: <command>
  deterministicTestCommand: <command>
  dataSetupCommand: <command>
  cleanupCommand: <command>
  exactBlackBoxEndpoints: []
scriptedBaseline:
  status: <APPLICABLE-or-NOT_APPLICABLE>
  workspacePath: <absolute-private-path-or-NOT_APPLICABLE>
  revision: <immutable-revision-or-NOT_APPLICABLE>
  command: <command-or-NOT_APPLICABLE>
  configPaths: []
  promptPaths: []
  modelSnapshot: <snapshot-or-NOT_APPLICABLE>
tasks:
  - taskId: <public-safe-id>
    sourceSpecPath: <absolute-private-path>
    selectionRationale: <private-rationale>
access:
  credentialRefs: []
  networkAllowlist: []
  allowedWriteRoots: []
privateEvidence:
  root: <absolute-path-outside-eval-quality>
  artifactIndexPath: <absolute-private-path>
```

Hash the complete private record after each approved change. Put only that digest and the opaque `privateRef` in the public execution inputs. The private artifact index maps every opaque artifact reference to its actual local path and digest.

### Confidence and preflight gate

Before generating an Eval Contract, test adapter, schema, or evaluator, the orchestrator records this block in `STATUS.md`:

```text
Confidence: <1-10>
Rationale: <public evidence paths, opaque private references and digests, or observed interface kinds>
Unknowns:
- <specific unknown>
```

- Confidence 7 or higher permits execution.
- Confidence 5 or 6 permits scaffolding while every assumption remains visible in `STATUS.md`. Scored execution stays blocked.
- Confidence below 5 requires `BLOCKED_INPUT`. Ask the owner to resolve the most important unknown.

### State and resume protocol

`STATUS.md` is the resume authority. It contains the current state, completed artifacts with hashes, invalid runs, open questions, and exactly one next action.

Allowed states are:

1. `PREFLIGHT`
2. `BLOCKED_INPUT`
3. `SCAFFOLDED`
4. `H0_PREREGISTRATION_REVIEW`
5. `H0_RUNNING`
6. `H0_SCORED`
7. `SEMANTIC_PILOT`
8. `SEMANTIC_PREREGISTRATION_REVIEW`
9. `SEMANTIC_RUNNING`
10. `TECHNICAL_DECISION_RECORDED`
11. `MARKET_CONFIRMATION`
12. `COMPLETE`

On resume, read `STATUS.md`, verify every recorded file and digest, and perform only its next action. Never rerun or overwrite a valid completed condition without recording a new run ID and reason.

### Owner approval gates

The orchestrator must stop for owner approval twice:

1. **H0 approval:** task IDs, Eval Contracts, prompts, models, resource ceilings, isolation controls, ground-truth rubric, and H0 gates are frozen before any H0 scored condition runs.
2. **Semantic approval:** corpus IDs, adjudicated labels, baseline configurations, prototype versions, prompts, models, thresholds, and semantic gates are frozen before confirmatory execution.

Each approval record includes `approvedBy`, `approvedAt`, the Git commit SHA, and a SHA-256 digest file. An agent may prepare these records. Only the experiment owner may approve them.

## 3. Hypotheses

### H0: Independent black-box evaluation

An evaluator agent isolated from the original spec, codebase, and builder context can use a sealed Eval Contract plus black-box access to find material failures missed by builder self-evaluation and all applicable fixed or pre-canned tests. It can do this without unsafe false rejections.

### H1: Claim-to-evidence lineage

A claim-level evaluator can identify material unsupported claims that the two baselines allow to pass. Every finding must identify the claim and the supporting or missing trace evidence.

### H2: Semantic checkpoints

A checkpoint evaluator can accept valid alternate trajectories while rejecting trajectories that skip a required dependency, use invalid evidence, or take a materially unsound action. Checkpoints are represented as an accepted-path set or a dependency graph. Literal sequence matching is only a baseline.

### H3: Process and outcome separation

A two-axis classification can distinguish correct outcome with unsound process, incorrect outcome with sound process, and ordinary correct or incorrect runs. It passes only if it changes the diagnosis or remediation beyond what the baselines already provide.

### H4: First material error attribution

An attribution evaluator can identify the earliest trace event that materially caused a later failure. The output must name the event, causal explanation, downstream effects, and confidence.

### H0 experiment protocol

Use 12 implementation tasks across two systems under test, with 6 tasks per system. One system must expose agentic or probabilistic product behavior. The other must be a conventional UI, API, or CLI application or service. This separation tests the two product hypotheses without confusing the builder agent with an AI-agent product. The set contains 8 defect-bearing implementations and 4 clean implementations. At least 4 defect-bearing cases must come from defects naturally produced during implementation. Controlled mutations may supply the remaining cases.

Use Couture Cast for the conventional system unless preflight proves it cannot meet the protocol. Resolve and verify the owner-approved `agentic-system` from the private input record during Phase A. Its identity remains outside this repository.

The roles are distinct:

- The **builder agent** implements the task.
- The **system under test** is the resulting product behavior. It may be agentic or conventional.
- The **independent evaluator agent** investigates the running system after implementation.

Each Eval Contract must validate against `schemas/eval-contract.schema.json` and contain at least:

```json
{
  "contractVersion": 1,
  "taskId": "h0-couture-cast-01",
  "sourceSpecDigest": "sha256:<digest>",
  "observableBehaviors": [
    {
      "id": "B-001",
      "description": "externally observable expected behavior",
      "oracle": "how the evaluator can decide whether it occurred",
      "severity": "material"
    }
  ],
  "riskHypotheses": [],
  "permittedInterfaces": [],
  "forbiddenInputs": [
    "original-spec",
    "source-code",
    "repository",
    "builder-transcript",
    "implementation-logs",
    "comparator-results",
    "human-labels"
  ],
  "testData": {
    "setup": null,
    "cleanup": null
  },
  "budgets": {
    "maxToolCalls": 0,
    "maxWallClockMinutes": 0,
    "maxCostUsd": 0
  },
  "safetyLimits": [],
  "requiredEvidence": [],
  "gatePolicy": {
    "allowedVerdicts": ["PASS", "CONCERNS", "FAIL"]
  }
}
```

The contract excludes original spec prose, repository paths, architecture and implementation details that are not externally observable requirements, prescribed test steps, hidden defect or mutation details, baseline results, and human labels.

Apply this context boundary:

| Input | Builder | Self-evaluator | Independent evaluator |
| --- | --- | --- | --- |
| Original product spec | Allowed | Allowed | Denied |
| Source code and repository | Allowed | Allowed | Denied |
| Builder conversation and implementation logs | Allowed | Allowed | Denied |
| Sealed Eval Contract | Denied during H0 | Allowed | Allowed |
| Public black-box interfaces | Allowed | Allowed | Allowed |
| Scoped synthetic test data | Allowed | Allowed | Allowed |
| Comparator outputs | Denied | Denied | Denied |
| Human labels and hidden defects | Denied | Denied | Denied |

Each independent run must validate against `schemas/isolation-manifest.schema.json`. The manifest records the run ID, task ID, condition, model snapshot, system-prompt digest, contract digest, workspace identity, allowed mounts, observed mounts, network allowlist, observed network targets, tool allowlist, observed tool calls, resource ceilings, actual resource use, and any violation. A non-empty violation field invalidates the run.

For each task:

1. TEA reads the product spec and creates the Eval Contract before implementation begins.
2. Freeze the contract and record its SHA-256 digest.
3. The builder agent receives the original spec, repository, and normal implementation tools.
4. Run the existing deterministic suite as baseline A.
5. Run each applicable pre-existing scripted agent-eval suite as baseline B. Freeze its revision, scenarios, prompts, models, configuration, and thresholds before hidden defect status or scored output is visible. Repeat a model-backed suite three times. Record `NOT_APPLICABLE` before execution when a system has no such suite.
6. Run a self-evaluator as baseline C in three fresh repetitions. It receives the Eval Contract plus the original spec, repository, builder transcript, and implementation context.
7. Run the independent evaluator in three fresh repetitions. It receives only the Eval Contract, scoped test data, and black-box access through the public UI, API, CLI, or MCP interface.
8. Give every self-evaluator and independent-evaluator repetition the same model snapshot and the same maximum tool-call count, token limits, wall-clock limit, and cost ceiling. Their tool availability differs only where the context boundary requires it. Preserve a scripted suite's native frozen configuration and report any budget difference.
9. Run the evaluators in separate workspaces. Audit every mounted path and tool permission. Any prohibited-input access invalidates the run.
10. The Test Architect establishes and seals the real defect set before evaluator results exist.
11. Preserve every action trace and evidence artifact for comparison. Private artifacts remain in the private evidence store and receive opaque references and digests in the public manifest.

The Eval Contract is a projection of required behavior. The independent evaluator has no access to the original product spec or implementation context. Its actions remain adaptive because the contract describes goals and oracles rather than steps.

### H0 ground truth

The Test Architect labels each implementation before deterministic, scripted, self-evaluator, or independent-evaluator results exist. Preserve the label, its oracle evidence, and the sealed adjudicated record in the appropriate evidence store.

Each H0 label validates against `schemas/h0-ground-truth.schema.json` and contains:

```json
{
  "taskId": "h0-couture-cast-01",
  "systemId": "couture-cast",
  "implementationSha": "<commit-sha>",
  "expectedClean": false,
  "defects": [
    {
      "defectId": "D-001",
      "behaviorId": "B-001",
      "summary": "observable failure",
      "severity": "material",
      "oracleEvidence": [
        {
          "storage": "public",
          "path": "results/raw/oracle-observation.json",
          "privateRef": null,
          "sha256": "sha256:<digest>"
        }
      ],
      "source": "natural"
    }
  ],
  "expectedGate": "FAIL",
  "rationale": "evidence-based explanation"
}
```

Allowed defect sources are `natural` and `controlled-mutation`. A clean implementation has an empty `defects` array and `expectedClean: true`. Do not reveal clean status, defect IDs, or mutation details to any evaluator condition.

Before condition execution, reproduce every material or critical defect through its declared
black-box oracle. A clean label requires all material observable behaviors to pass their declared
oracles. If a label lacks reproducible evidence, repair the oracle or replace the case before
condition execution.

### H0 run result

Every condition emits one record that validates against `schemas/h0-run-result.schema.json`:

```json
{
  "runId": "h0-couture-cast-01-independent-r1",
  "taskId": "h0-couture-cast-01",
  "condition": "independent",
  "verdict": "FAIL",
  "findings": [
    {
      "findingId": "F-001",
      "behaviorId": "B-001",
      "severity": "material",
      "summary": "observed failure",
      "actionIds": ["A-004"],
      "evidenceArtifacts": [
        {
          "storage": "public",
          "path": "results/raw/h0-couture-cast-01-independent-r1.json",
          "privateRef": null,
          "sha256": "sha256:<digest>"
        }
      ]
    }
  ],
  "actionsArtifact": {
    "storage": "public",
    "path": "results/raw/h0-couture-cast-01-independent-actions.jsonl",
    "privateRef": null,
    "sha256": "sha256:<digest>"
  },
  "resourceUse": {
    "toolCalls": 0,
    "inputTokens": 0,
    "outputTokens": 0,
    "wallClockSeconds": 0,
    "costUsd": 0
  },
  "isolationManifestArtifact": {
    "storage": "public",
    "path": "independent-evaluator/isolation-manifests/h0-couture-cast-01-independent-r1.json",
    "privateRef": null,
    "sha256": "sha256:<digest>"
  },
  "invalidReason": null
}
```

The `condition` enum contains `deterministic`, `scripted`, `self`, and `independent`. A scripted record may use verdict `NOT_APPLICABLE` only when that status was frozen during preregistration.

Every artifact link uses the same four-field shape shown above. A private artifact sets `storage` to `private`, `path` to `null`, and supplies an opaque `privateRef` and matching digest.

After all condition outputs are sealed, reviewers map findings to adjudicated defect IDs. A unique independent catch requires a correct mapping to a material or critical defect, no correct material finding from any applicable deterministic or scripted baseline, and detection in fewer than two of three self-evaluator repetitions. Unsupported or duplicate findings count against precision.

## 4. Repository layout to create during execution

Create this structure on the experiment branch:

```text
experiments/hypothesis-validation/
  README.md
  STATUS.md
  execution-inputs.yaml
  private-evidence-manifest.json
  rubric.md
  preregistration/
    h0.yaml
    semantic.yaml
    checksums.sha256
  schemas/
    artifact-ref.schema.json
    eval-contract.schema.json
    isolation-manifest.schema.json
    private-evidence-manifest.schema.json
    h0-ground-truth.schema.json
    h0-run-result.schema.json
    trace-label.schema.json
    evaluator-result.schema.json
  prompts/
    builder/
    self-evaluator/
    independent-evaluator/
    judges/
  independent-evaluator/
    specs/
    eval-contracts/
    implementations/
    deterministic-baseline/
    scripted-baseline/
    self-evaluation/
    black-box-evaluation/
    isolation-manifests/
  corpus/
    manifest.jsonl
    pilot/
    confirmatory/
  labels/
    h0/
      reviewer-a/
      reviewer-b/
      adjudicated/
    reviewer-a/
    reviewer-b/
    adjudicated/
  baselines/
    agentevals/
    promptfoo/
  evaluators/
    claim-evidence/
    semantic-checkpoints/
    process-outcome/
    first-material-error/
  results/
    raw/
    summary.md
  DECISION.md
```

`README.md` contains public-safe installation, validation, and orchestration commands. Sensitive commands stay in the private input record. `STATUS.md` implements the state and resume protocol. `private-evidence-manifest.json` contains only opaque references, SHA-256 digests, artifact types, and public-safe run IDs. `preregistration/h0.yaml` freezes H0 task IDs, contracts, conditions, prompts, models, resource budgets, metrics, and gates before H0 execution. `preregistration/semantic.yaml` freezes corpus IDs, labels, engine versions, baseline configurations, prototypes, prompts, thresholds, and gates before semantic confirmatory execution. `DECISION.md` records both decisions with links to public artifacts or opaque private references and deviations.

## 5. Corpus

### Pilot corpus

Use 8 traces to develop the rubric, normalize tool inputs, configure the baselines, and tune prototypes. Pilot traces never count toward the decision metrics.

### Confirmatory corpus

Use 48 locked traces from at least two agent execution sources. Source one is coding-agent traces captured while agents work on Couture Cast. Source two is complete execution traces from the owner-approved `agentic-system`. Both sources must provide complete structured traces, sufficient real runs, materially different domains or agent stacks, permission to use the data for this experiment, and a reliable sanitization process. Private traces remain in the private evidence store. If either source fails these criteria, the Test Architect proposes a replacement in `preregistration/semantic.yaml` and the experiment owner approves it before labeling.

The corpus must contain 8 cases in each stratum:

1. Correct outcome with grounded claims and a sound path.
2. Correct outcome with at least one material unsupported claim.
3. Incorrect outcome caused by bad or stale observed evidence, with an otherwise sound process.
4. Incorrect outcome caused by an unsound process.
5. Valid alternate path that differs materially from the reference path.
6. Cascading failure with a human-identifiable first material error.

At least 24 of the 48 traces must come from real agent runs. Controlled mutations may fill the remaining cases. Each of the two systems must contribute at least 20 traces. No single task template may contribute more than 4 traces.

### Manifest fields

Each line in `corpus/manifest.jsonl` contains:

```json
{
  "caseId": "eq-001",
  "system": "couture-cast",
  "taskId": "stable-task-id",
  "stratum": "unsupported-claim",
  "source": "real",
  "traceArtifact": {
    "storage": "public",
    "path": "corpus/confirmatory/eq-001.json",
    "privateRef": null,
    "sha256": "sha256:<digest>"
  },
  "containsSensitiveData": false
}
```

For a private trace, set `storage` to `private`, set `path` to `null`, and use an opaque `privateRef` plus its digest. Remove secrets and personal data before any trace enters this repository.

## 6. Agent ground truth

The Test Architect labels every confirmatory trace before baseline or prototype results exist.
Each label must cite reproducible trace evidence. The labeling context must not contain condition
results.

Each label records:

```json
{
  "caseId": "eq-001",
  "outcomeCorrect": true,
  "evidenceCorrect": true,
  "claims": [
    {
      "claim": "normalized claim text",
      "status": "grounded",
      "evidenceStepIds": ["step-4"]
    }
  ],
  "pathSound": true,
  "acceptedCheckpoints": [
    {
      "id": "cp-2",
      "dependsOn": ["cp-1"],
      "satisfiedByStepIds": ["step-4"]
    }
  ],
  "firstMaterialErrorStepId": null,
  "materialFailure": false,
  "expectedGate": "PASS",
  "severity": "none",
  "rationale": "short evidence-based explanation"
}
```

Allowed claim statuses are `grounded`, `unsupported`, `contradicted`, and `not-checkable`. Allowed severity values are `none`, `low`, `material`, and `critical`.

Resolve ambiguous labels by replaying the trace evidence against the frozen rubric. Keep public-safe
labels in `labels/adjudicated/` and private labels in the private evidence store. If the evidence
cannot support a deterministic label, replace the trace before condition execution. Do not tune the
rubric against prototype results.

Commit public-safe labels and their SHA-256 digest before running the scored baselines or prototypes.
Freeze private labels in the private evidence store and commit only their opaque references and
digests.

## 7. Semantic baseline execution

For each tool:

1. Pin the exact version.
2. Record public-safe installation and run commands in the experiment `README.md`. Keep sensitive commands in the private input record.
3. Map the full trace into the richest supported native format.
4. Configure every relevant built-in trajectory, tool, argument, sequence, outcome, and judge-based check.
5. Tune prompts and thresholds only on the 8 pilot traces.
6. Freeze configuration in `preregistration/semantic.yaml`.
7. Run all 48 confirmatory traces.
8. Save raw machine-readable output without manual correction in the appropriate public or private evidence store.

A baseline miss means both tools emit PASS or emit no material finding for a ground-truth-labeled material or critical failure.

## 8. Prototype rules

Build only the four custom evaluators. A small trace-normalization shim is allowed. The shim may translate schemas. It may not execute agents, call providers on behalf of a runner, aggregate pass@k, implement a general assertion DSL, create a general report system, or replace CI gating.

Tune prototypes only on the pilot corpus. Freeze evaluator code, prompts, model snapshot, and thresholds before confirmatory execution. Run every judge-backed evaluator three times against every applicable confirmatory case to measure stability.

Every evaluator result must contain:

```json
{
  "caseId": "eq-001",
  "evaluator": "claim-evidence",
  "verdict": "CONCERNS",
  "finding": "material unsupported claim",
  "stepIds": ["step-4"],
  "evidenceStepIds": [],
  "confidence": 0.91,
  "rationale": "short evidence-based explanation"
}
```

## 9. Metrics and preregistered gates

### H0 independent-evaluator gate

For H0, the scoring unit is an adjudicated material or critical defect ID. Normalize deterministic-test failures and applicable scripted-suite findings into the H0 run-result schema before scoring. Mask the condition name while reviewers map findings to defect IDs.

- **H0 precision:** Correct independent-evaluator material findings mapped to a material or critical defect ID, divided by all material findings emitted by the independent evaluator.
- **H0 recall:** Material or critical defect IDs detected in at least two of three valid independent-evaluator repetitions, divided by all adjudicated material or critical defect IDs.
- **H0 unique catch:** A defect ID detected in at least two of three independent-evaluator repetitions, with no catch from any applicable deterministic or scripted baseline and detection in fewer than two of three self-evaluator repetitions.
- **H0 real defect:** A defect whose adjudicated source is `natural`. Controlled mutations may measure recall and safety. They do not satisfy the three-real-defect gate.
- **Valid run:** A run with a matching preregistration record, matching prompt and contract digests, complete artifacts, and no isolation violation.
- **H0 stability:** Percentage of tasks receiving the same verdict in all three independent-evaluator repetitions.
- **H0 task verdict:** The majority verdict across three valid repetitions. Report every dissenting repetition separately.

All conditions must pass:

1. The independent evaluator catches at least 3 real, material defects missed by the self-evaluator and all applicable deterministic or scripted baselines.
2. Those unique catches span both systems under test.
3. Precision is at least 0.85 and recall is at least 0.80 across the 12 tasks.
4. At the H0 task-verdict level, the 4 clean implementations receive zero false FAIL verdicts and at most 1 false CONCERNS verdict.
5. At least 1 material defect is found through an evaluator-chosen action that no pre-canned baseline executed.
6. Every independent run has a complete isolation manifest and zero prohibited-input accesses.
7. At least 1 finding changes a real ship decision or materially changes remediation.
8. Independent-evaluator verdict stability is at least 0.90 across three repetitions per task.

Record cost, latency, token use, and tool calls for every model-backed scripted suite, the self-evaluator, and the independent evaluator. These are diagnostic metrics for the first experiment. They are not pass/fail thresholds until real operating data exists.

### Capability metrics

- **Precision:** Correct material findings divided by all material findings emitted.
- **Recall:** Correctly detected ground-truth-labeled material failures divided by all applicable material failures.
- **Incremental catches:** Material or critical failures missed by both baselines and correctly found by the prototype.
- **False rejection:** A grounded, sound, valid case receiving CONCERNS or FAIL.
- **Stability:** Percentage of cases receiving the same verdict across all three repeated judge runs.
- **Attribution accuracy:** Exact and adjacent-step agreement with the adjudicated first material error.

### Semantic evaluator-pack gate

All conditions must pass:

1. At least 3 real, material failures missed by both baselines are caught by the prototypes.
2. The incremental catches span at least 2 hypotheses and both trace-source systems.
3. Precision is at least 0.85 for every evaluator proposed for packaging.
4. Recall is at least 0.80 on the applicable cases for every evaluator proposed for packaging.
5. There are zero false FAIL verdicts on grounded, sound, or valid alternate cases.
6. There is at most 1 false CONCERNS verdict across those valid cases.
7. Judge-backed verdict stability is at least 0.90 across three runs.
8. H4 reaches at least 0.70 exact first-error agreement and 0.85 adjacent-step agreement if H4 is proposed for packaging.
9. At least 1 finding changes a real ship decision or materially changes the remediation chosen by the agent owner.
10. Every passing evaluator runs through a public extension point of the selected engine. No engine fork is required.

An evaluator that misses its individual precision, recall, stability, or false-rejection bar is excluded even if the overall experiment passes.

## 10. Market confirmation after a technical pass

A technical pass proves incremental measurement value. It does not prove product demand.

Before production packaging, show the evidence reports to practitioners from at least 5 organizations and complete at least 8 sessions. At least 3 organizations must make a costly commitment: provide traces, allocate engineering time, or run a design-partner pilot. Statements of interest without a commitment do not pass this gate.

Record the sessions and decision in `results/summary.md`. Remove identifying details when required.

## 11. Execution checklist

Complete these phases in order. The role in parentheses owns the step.

### Phase A: Preflight and H0 preregistration

1. **Read state** (Test Architect): Read this document and `STATUS.md` if it exists. Create `STATUS.md` with state `PREFLIGHT` when absent.
2. **Resolve inputs** (Test Architect): Inspect Couture Cast read-only and populate its verified SHA, commands, interfaces, and candidate tasks. Obtain the private input record for the owner-approved `agentic-system`, verify its digest, and populate only public-safe references and digests in `execution-inputs.yaml`. Record the confidence block. Stop at `BLOCKED_INPUT` when required public or private values remain unresolved or confidence is below 5.
3. **Verify systems** (Test Architect): Check out the recorded SHAs. Execute each startup, deterministic-test, applicable scripted-eval, setup, and cleanup command once. Save public-safe output under `results/raw/preflight/`. Save private output in the private evidence store and add its opaque reference and digest to `private-evidence-manifest.json`.
4. **Create scaffold** (BMad Dev): Create the section 4 directory structure and JSON Schemas. Validate every example record in this document against its schema.
5. **Select H0 tasks** (Test Architect): Choose six tasks per system. Record task ID, source spec, system, interface, expected risk, and selection rationale. Do not label tasks as clean or defective for evaluator agents.
6. **Create Eval Contracts** (Test Architect): Compile, validate, freeze, and hash one contract per task before its builder run begins.
7. **Freeze conditions** (Test Architect): Save public-safe builder, self-evaluator, independent-evaluator, and judge prompts under `prompts/`. Freeze each applicable scripted baseline revision, scenarios, prompts, models, configuration, and thresholds. Keep private prompts in the private evidence store. Record public digests, model snapshots, resource ceilings, and `NOT_APPLICABLE` decisions.
8. **Write H0 preregistration** (Test Architect): Create `preregistration/h0.yaml` with task IDs, contract digests, prompt digests, system SHA or private revision digest, model snapshots, deterministic and scripted baseline configurations, budgets, schemas, mapping rules, privacy manifest digest, metrics, gates, and invalidation rules.
9. **Approve H0** (Experiment owner): Review the full H0 package. Add approval metadata, commit it, and record the commit SHA in `preregistration/checksums.sha256`. Scored H0 execution cannot begin before this step.

### Phase B: H0 execution and decision

10. **Build implementations** (Builder agent): Run each task in a separate builder context. Preserve the implementation SHA, builder prompt, transcript, model, resource use, and command output in the appropriate evidence store. Do not expose Eval Contracts or hidden cases to the builder.
11. **Complete the case mix** (Test Architect): Inventory naturally produced defects. Add controlled mutations only when required to reach eight defect-bearing and four clean implementations. Preserve mutation patches outside evaluator workspaces. Private-system patches remain in the private evidence store.
12. **Freeze H0 ground truth** (Test Architect): Label all implementations before condition results exist. Reproduce material defects through their black-box oracles, validate the records, and record their digests. Commit public-safe records. Keep private records outside this repository.
13. **Run deterministic condition** (BMad Dev): Execute the frozen deterministic command against every implementation. Normalize output into H0 run-result records.
14. **Run scripted baseline condition** (BMad Dev): Execute every applicable frozen pre-existing scripted agent-eval suite against each preregistered implementation. Run model-backed suites three times. Normalize findings into H0 run-result records and preserve unmodified native output.
15. **Run self-evaluator condition** (Fresh contextual agent): Create three fresh repetitions per task with the allowed self-evaluator inputs. Save complete action traces and results. Do not reuse builder or comparator conversations.
16. **Run independent condition** (Fresh generic agent): Create three sealed repetitions per task. Verify each isolation manifest before launch, then expose only the Eval Contract, scoped test resources, and black-box interfaces. Save complete action traces and results.
17. **Seal H0 outputs** (Test Architect): Validate every result and manifest, calculate digests, identify invalid runs, and lock raw outputs before mapping findings. Verify every private artifact against `private-evidence-manifest.json`.
18. **Map and score H0** (Test Architect): Mask condition names, map findings to adjudicated defect IDs through the sealed oracle evidence, resolve ambiguous mappings by evidence replay, and calculate every H0 metric and gate.
19. **Record H0 decision** (Test Architect): Add DARK-FACTORY VALIDATED or DARK-FACTORY REJECTED to `DECISION.md`, with a gate-by-gate table, evidence links or opaque references, invalid runs, deviations, and resource diagnostics. Set state `H0_SCORED`.

H0 and H1 through H4 are independent decisions. Continue to Phase C after either H0 outcome unless the experiment owner explicitly stops the remaining research.

### Phase C: Semantic evaluator experiment

20. **Assemble corpus** (Test Architect): Reuse eligible H0 traces and collect the remainder of the 8 pilot and 48 confirmatory traces. Validate every public or private manifest entry and quota.
21. **Calibrate rubric** (Test Architect): Label the pilot, resolve ambiguity through evidence replay, revise `rubric.md`, and freeze the rubric. Pilot cases never enter confirmatory metrics.
22. **Freeze confirmatory labels** (Test Architect): Label and seal all 48 confirmatory traces before baseline or prototype results exist. Validate and hash every label. Commit public-safe labels. Keep private labels in the private evidence store with opaque references and digests.
23. **Configure baselines** (BMad Dev plus Test Architect): Configure `agentevals-dev/agentevals` and Promptfoo using only pilot data. Save exact versions, commands, prompts, thresholds, and configuration.
24. **Build prototypes** (BMad Dev): Build H1 through H4 and the permitted normalization shim through public extension points. Tune only on pilot data. Save code and prompt digests.
25. **Write semantic preregistration** (Test Architect): Create `preregistration/semantic.yaml` with corpus IDs, label digest, private manifest digest, baseline configurations, prototype digests, judge snapshot, prompts, resource budgets, metrics, gates, and run order.
26. **Approve semantic experiment** (Experiment owner): Review, approve, commit, and record the semantic preregistration SHA and digest. Confirmatory execution cannot begin before this step.
27. **Run semantic baselines** (BMad Dev): Run both frozen baselines on all confirmatory traces and save unmodified machine-readable output in the appropriate public or private evidence store.
28. **Run semantic prototypes** (BMad Dev): Run frozen prototypes on the same traces. Run every judge-backed evaluator three times. Save all raw output and resource use in the appropriate evidence store.
29. **Score semantic gates** (Test Architect): Validate outputs and calculate results by hypothesis, stratum, and system. Exclude invalid runs and report why they were invalid.
30. **Record evaluator-pack decision** (Test Architect): Add BUILD THIN PACK, NARROW AND REPEAT, or METHODOLOGY ONLY to `DECISION.md`, with gate tables and public evidence links or opaque private references. Set state `TECHNICAL_DECISION_RECORDED`.

### Phase D: Confirmation and document update

31. **Run market confirmation** (Experiment owner): Complete section 10 only for capabilities that passed technically. Record sessions, commitments, and the demand decision.
32. **Update planning documents** (PM or product owner): Revise the brief and PRD to contain only validated claims and authorized scope. Create product architecture and ADRs after this revision.
33. **Close the experiment** (Test Architect): Verify the completion checklist below, set state `COMPLETE`, and commit `STATUS.md`, `results/summary.md`, and `DECISION.md`.

### Completion checklist

The experiment is complete only when all applicable items exist and validate:

- [ ] `execution-inputs.yaml` contains no unresolved public values, and every required private value has a verified opaque reference and digest.
- [ ] Both preregistration approvals include commit SHAs and digests.
- [ ] All schema validation passes.
- [ ] Every scored run has raw output, prompt and model identity, resource use, and a valid manifest in the appropriate evidence store.
- [ ] Ground-truth labels preserve reproducible oracle evidence and were sealed before condition results.
- [ ] An authorized reviewer can recompute H0 and semantic metrics from the public artifacts plus verified private evidence.
- [ ] Every private artifact has an opaque public reference and matching digest, and no private artifact exists under the public repository working tree.
- [ ] `results/summary.md` reports quotas, exclusions, deviations, and every preregistered metric.
- [ ] `DECISION.md` contains both technical decisions or an explicit owner-approved reason one was stopped.
- [ ] Failed hypotheses remain archived as research evidence.
- [ ] The brief and PRD have been revised after the recorded decisions.

## 12. Stop rules

- Stop at `BLOCKED_INPUT` when a required input is missing or confidence is below 5. Do not fabricate the missing value.
- Stop at `BLOCKED_INPUT` when the owner-controlled private input record is unavailable, incomplete, inaccessible, or inconsistent with its public digest.
- Stop scored execution when either required owner approval is absent.
- Invalidate a condition if its prompt, model, resource ceiling, system SHA, contract digest, or configuration differs from preregistration.
- Invalidate self-evaluator or independent-evaluator runs that reuse a builder or comparator conversation.
- Stop scoring when an artifact fails its JSON Schema or digest check.
- Stop immediately if a private artifact appears anywhere under the public repository working tree. Move it to the private evidence store, verify that it never entered Git history, and update the manifest before continuing.
- Stop and repair the corpus if a trace lacks enough evidence for reproducible ground-truth labeling.
- Stop and repair the rubric if a ground-truth label lacks reproducible evidence under section 6.
- Stop the engine comparison if either baseline received a materially weaker trace or judge configuration.
- Invalidate an H0 run if the independent evaluator can access the original spec, repository, source code, builder transcript, or implementation logs.
- Stop H0 comparison if the self-evaluator and independent evaluator do not receive equal model and resource budgets.
- Stop prototype work if it expands into a runner, provider layer, assertion framework, reporting framework, or CI engine.
- Record extension-point limitations as findings. Do not treat them as permission to build a new engine during this experiment.
- Do not move the gates after confirmatory results are visible. Any changed gate requires a new corpus and a new preregistration.
- Do not update the brief, PRD, or product architecture with a capability claim before its decision is recorded.

## 13. Handoff prompt

Give another agent this repository and the following instruction:

```text
Act as the experiment orchestrator for eval-quality.

Work from ~/opensource/eval-quality. Invoke the BMad Test Architect with $bmad-tea. Read HYPOTHESIS_VALIDATION_PLAN.md in full and treat it as the execution authority. Read experiments/hypothesis-validation/STATUS.md if it exists and resume from its single recorded next action. Otherwise begin at Phase A, step 1.

Use the BMad Test Architect role for orchestration and evidence decisions. Delegate scaffold and prototype implementation to BMad Dev. Launch every H0 independent-evaluator condition as a fresh generic agent with only the sealed Eval Contract, allowlisted test resources, and black-box system access.

Use ~/opensource/couture-cast as the conventional H0 system under test. Inspect it read-only during preflight, verify its current SHA and commands, and select six candidate tasks. Resolve the already approved private system through the opaque ID agentic-system and the owner-controlled private input record. If that record is unavailable, stop at BLOCKED_INPUT and ask Murat for it. Do not reveal the private system's identity or details in this repository. Use complete agentic-system execution traces as the second semantic source.

Do not change hypotheses, sample quotas, metrics, gates, or stop rules. Do not invent missing repository paths, commands, interfaces, credentials, schemas, tasks, or budgets. Keep every private artifact outside the eval-quality working tree. Record only opaque references, digests, sanitized findings, and aggregate results publicly. Record confidence and stop at BLOCKED_INPUT when the plan requires owner input. Stop at both owner approval gates.

Keep STATUS.md current after every completed step. Preserve raw artifacts, prompts, versions, digests, invalid runs, and deviations. Continue until both technical decisions are recorded or an explicit stop condition blocks progress.
```
