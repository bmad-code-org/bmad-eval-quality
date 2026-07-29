---
title: eval-quality
status: building-contract-discipline
created: 2026-07-17
updated: 2026-07-28
---

# PRD: eval-quality

## Current Decision and Execution Authority

The original standalone TypeScript engine assumption was reversed on 2026-07-22 after a corrected competitor review identified `agentevals-dev/agentevals` as a close, mature implementation of the commodity engine layer.

**Decision, 2026-07-27: build the Eval Contract authoring discipline product.** Two experiment rounds measured a real, mechanism-explained effect (0.33 to 1.00 pooled detection from Eval Contract authoring discipline alone, holding model/budget/system/defect fixed). The one gate either round failed traced to a named defect in the measurement harness, not in a contract or in the system under test; ten such defects across both rounds were found and fixed the same way, and none was ever in the product's own logic. That is treated as sufficient evidence to proceed to building, not as a reason to keep validating. No further replication is planned; this decision does not gate on one.

Current decisions:

1. `eval-quality` is the single name for the agents, rules, methodology, governance, and any evaluator pack.
2. Use an existing open-source engine for execution, trace ingestion, standard assertions, repeated runs, reports, and CI integration. eval-quality does not reimplement that engine's run CLI, and it does ship its own command surface over its own capabilities (VFR-8).
3. **The product is Eval Contract authoring discipline**, plus Eval Contract strength scoring (seed a known defect class, measure which oracles catch it). The four semantic hypotheses rank below it and stay deferred, not built now.
4. **Evaluator isolation is a held control and a delivery property, not the value claim.** A sealed evaluator's recall is bounded above by the oracles its contract supplies. Two rounds agree on this from opposite failure directions.
5. Do not implement a runner, provider adapter framework, assertion DSL, pass@k engine, cost engine, reporting framework, or CI engine, and do not reimplement the selected engine's run CLI. **Decision, 2026-07-28: eval-quality ships as its own repository and package, with a library API and a CLI over that library.** The command surface covers eval-quality's own capabilities only: contract compilation, Eval Contract strength scoring, environment pre-flight, and evidence emission. See VFR-8.
6. This PRD reflects the build decision below and is final on product direction. No further validation round is planned.
7. **Ground truth comes from version-control history, not from an adjudicated rating.** Each case is the commit before a bug fix, with the fix's own test set as the oracle. A mined commit becomes ground truth only after the fail-before/pass-after check in VFR-7 qualifies it: block 1 found 2 of 18 mined fix commits test-blind, their own tests passing at the parent commit, so the fix's own test is a candidate oracle rather than an automatic one. Once qualified, no second rater is required to establish that the validated defect boundary is reproduced and detected; broader product correctness stays outside that label. This is a reusable part of the Eval Contract strength-scoring feature, not just a research method. Controlled mutation is the second valid source: a defect seeded deliberately and verified against a real fix boundary covers failure classes that never left a clean commit. Agentic drifts such as context pollution and trajectory thrashing are candidate future probe classes for that mechanism; neither has been authored or scored. Both sources appear in the rounds' adjudicated labels (natural and controlled-mutation) and both feed the scoring feature.
8. **A hermetic environment must satisfy declared invariants before any scored run.** A pre-flight cannot prove an environment defect-free in general, so the requirement is bounded: parity with the real boundary for the interfaces and behaviors the probe exercises, declared routes present and actually matched, request-body sensitivity where it applies, per-run state reset or immutable, known-clean control behavior, and the seeded fault as the only anomalous response within that scope. Block 1's single false gate originated in the measurement layer, and its postmortem found ten harness defects of the same kind; that pattern is the argument for making oracle and environment quality part of the product surface. Treat a pre-flight failure as invalidating the run rather than as a contract signal.
9. **Independent corroboration, recorded 2026-07-28.** Two production teams at [AI Engineer World's Fair 2026](https://www.ai.engineer/worldsfair/2026/llms-full.md) report compatible failure dynamics in their agent systems: Google/YouTube Ads, "Model Whisperers: How Evals and Prompts Shape Agent Behavior", and Uber Eats, "Building Closed-Loop Evals for a Multimodal Agent at Uber Scale". Between them they describe weak or incomplete expectations letting failures pass under high categorical scores, prohibited behavior requiring explicit negative checks, and evaluator reliability depending on the quality of tools, fixtures, rubrics, and judges. Their support extends to those failure dynamics and no further. The requirements below add concrete mechanics on top of that: dual aggregate-plus-per-clause gates, strict undeclared-input detection, a shared input/output operator vocabulary, zero-action negative probes, disciplined judge conduct, rubric-authoring rules, canary defect classes, and trials-not-retries gating. Those are design decisions that stand on their own merits, and neither talk validates any of them. None of this changes the decision; it sharpens the requirements.

10. **The dependency runs one way: TEA depends on eval-quality, never the reverse.** Decided 2026-07-28 alongside the standalone-package decision in item 5. The package knows nothing about BMad, TEA, or any planning-artifact format, TEA is the reference authoring client rather than a runtime requirement, and no capability may be reachable only through it.

Known specification corrections:

- FR-6 evaluates final-answer claims against observed evidence. Calling it "per-step faithfulness" is inaccurate.
- LCS compares total sequences. It does not enforce a partial order. H2 must test an accepted-path set or explicit dependency graph.
- Grounding establishes support from observed evidence. It does not establish external truth when the evidence is stale, false, or adversarial.
- First material error attribution is part of the validation set because the research identified it as a proposed differentiator. Deferring it before validation would leave a core hypothesis untested.

## Current Product Workflow and Validation Requirements

The methodology layer is the primary product hypothesis, and the 2026-07-27 rounds narrowed it to a specific capability: eval-quality should help a contract author recognize AI-agent work and **author contract oracles that direct an evaluator to the evidence which would expose a failure**.

The evaluator cannot operate beyond the quality of its expected-behavior oracle. That is now measured rather than asserted. Holding model, budget, system, and defect fixed, and varying only how the contract was authored, sealed-evaluator detection moved from 0.33 to 1.00 across three naturally occurring defects; on two of them the plainly authored contract detected nothing across three repetitions each. The mechanism is visible in the transcripts: the plainly authored contract never prescribed the probe that would expose the defect, and in one case recorded the defective behaviour as a confirmation that the system handled it well.

The artifact is a **Behavioral Evaluation Contract**: a versioned specification of the behaviors to probe, the evidence to collect, the negative cases to exercise, and the rules that decide pass or fail. **Eval Contract** is the shorthand used throughout this document. It is deliberately not a Pact or API contract, and the distinction is worth stating once because the word collides. A Pact contract is an agreement between a consumer and a provider, defines request and response interactions, detects integration incompatibility, and is verified against a provider. An Eval Contract is an agreement between intended behavior and its evaluator, defines probes, evidence, and verdict rules, detects behavioral and evaluation blind spots, and is scored against known defects and gaming cases.

The contract author compiles the expected behaviour into a sealed Eval Contract before implementation. The execution agent sees that contract and black-box interfaces. It does not see the original spec, source code, repository, builder conversation, or implementation logs. That isolation is retained as a control and as a delivery property. It is not the source of the measured advantage.

### Current functional requirements

**Who authors the contract.** The requirements below name TEA because it is the reference authoring client and the first one that will exist. Read it as "the contract author" throughout. TEA is not a runtime dependency and is not co-installed: the package ships the contract schema, the compiler, the scorer, the pre-flight, and the command surface, and knows nothing about BMad. A human at a terminal, a coding agent, a CI job, a bot, or another framework's skill can author a contract instead, and it is held to the same standard, because VFR-2 enforces the discipline mechanically against the artifact rather than trusting whoever produced it. That mechanical enforcement is what makes the product usable outside BMad at all.

VFR-1 is the exception and is called out as such below.

#### VFR-1: Detect eval-relevant work

**This requirement lives in the TEA client, not in the package.** It is the one capability that is inherently BMad-shaped, since it reads BMad planning artifacts, and the package exposes no equivalent. Callers on other stacks establish eval-relevant work their own way and enter at VFR-2.

TEA identifies AI-agent, LLM, probabilistic, or otherwise nondeterministic behavior in BMad planning artifacts and recommends an eval strategy proportionate to risk.

For v0 this recommendation is advisory and never gate-authoritative. Eval-relevant work is established by the user, the workflow, or planning metadata, and TEA's detection runs alongside that as a non-blocking prompt. The intended asymmetry is recorded with the strategy: missing eval-relevant work costs more than over-flagging conventional work. That asymmetry is a stated design preference and not a measured property, since a recall-first claim needs a labeled corpus, a minimum recall, a false-positive ceiling, and a threshold-selection rule, none of which exist. Detection may become gate-authoritative only after those exist and are met.

#### VFR-2: Compile a sealed Eval Contract

Before implementation begins, the contract author converts the product spec into a versioned Eval Contract containing behavior goals, requirement and risk identifiers, oracles and rubrics, permitted black-box interfaces, test-data and cleanup rules, safety limits, budgets, and evidence requirements. The contract contains no prescribed action sequence.

The compiler enforces the authoring discipline mechanically rather than leaving it to reviewer attention, in three distinct classes, because no single pattern applies to every UI, CLI, scalar response, or single-operation contract:

- **Structural errors fail compilation.** Missing requirement or risk linkage, no observable success criterion, an oracle that references evidence unreachable through the permitted interfaces, a malformed operator expression, or an undeclared mandatory input.
- **Coverage gaps score down without blocking.** No negative probe where one is relevant, no whole-body read for a structured response, spot-checking where per-record behavior matters, or a missing sibling cross-check where a sibling actually exists.
- **Validated N/A is allowed and recorded.** Waiving a pattern requires the named rule, an explicit rationale, a machine-checkable context condition where one exists, and the recorded approval, all inside the contract artifact.

Oracles are written in a small shared operator vocabulary applied uniformly to call inputs and parsed outputs: equality, containment, existence and absence, regex, set membership, ordering, structural deep equality, count tolerances, and shape checks such as schema-plus-required-keys. A strict mode fails on undeclared inputs, catching behavior the interface silently ignores. Zero-action negative probes express what the system must not do at all. Rubrics follow fixed authoring rules: anchored scales, named failure-mode penalties, bounded length, and no questions a sealed evaluator cannot answer from observable evidence. An oracle may abstain with an explicit unsure result rather than being forced into a binary call it cannot support. Abstentions surface as their own signal in the evidence, and under VFR-7 an abstaining required check cannot produce PASS.

#### VFR-3: Isolate the evaluator

The independent evaluator runs in a separate workspace with allowlisted tools and mounts. It receives only the sealed Eval Contract, scoped credentials and test data, and black-box access through the public UI, API, CLI, or MCP interface. Every run records an isolation manifest. Any prohibited-input access invalidates the run.

#### VFR-4: Evaluate adaptively

The independent evaluator chooses its own actions to investigate contract goals and risks. Existing deterministic and pre-canned tests remain baseline evidence. They do not prescribe the evaluator's path.

#### VFR-5: Produce governed evidence

The evaluator emits traceable findings, confidence, observed evidence, and a PASS / CONCERNS / FAIL recommendation. Low-confidence or ambiguous findings route to a human-on-the-loop decision rather than silently blocking or passing the change. Judge-backed checks follow fixed conduct: one judge call scores all named rubric criteria with strict parsing; an unparseable judge response is a distinct judge-error result, never coerced into a low score; rubrics are self-contained, so the judge receives the rubric and the evidence rather than the product spec. Judge inputs are bounded by deliberate evidence truncation, and truncation is deterministic, disclosed in the result, and required to retain evidence that contradicts the leading verdict; a case whose evidence cannot be bounded without discarding disconfirming material is reported as incomplete instead. An evidence set that is incomplete, truncated past its disclosed bound, unavailable, or internally inconsistent can never produce PASS. Four outcomes stay separate and are never pooled: a behavioral trial, an evaluator or judge error, an infrastructure failure, and an environment pre-flight failure. Repeated runs are trials, never retries: a rerun measures the behavior distribution and must never mask a failure. Re-execution after an infrastructure failure restores a valid measurement and does not enter the behavioral trial distribution. Demonstration and example cases are quarantined from release-gate signal.

#### VFR-6: Reuse an existing engine

Execution, trace capture, standard checks, repeated runs, reports, and CI integration come from the selected open-source engine. eval-quality owns the methodology, isolation contract, governance, and any semantic evaluators that pass validation.

#### VFR-7: Score contract strength

A contract is scored before it is trusted: seed a known defect class behind the contract, run an evaluator against it, and report which oracles caught it. Two probe classes seed defects: defect probes, where the behavior is wrong, and gameability probes, where the behavior looks compliant while dodging the oracle's intent. A strong contract rejects both. Eval Contract strength scores are comparative diagnostics, never absolute verdicts, and per-oracle outcomes are the primary output. An aggregate score is a summary of them.

**Outcome states.** Every required oracle check in a scored run resolves to exactly one of `caught`, `missed`, `passed_clean_control`, `false_positive`, `abstained`, `oracle_error`, `infrastructure_error`, or `not_applicable`. The state carries the result, so "the check reported" is never sufficient on its own:

- A defect or gameability probe counts as detected only when its mapped oracle returns `caught`.
- `missed`, `abstained`, `oracle_error`, or any absent required check prevents PASS. A clearing aggregate never overrides a required oracle that failed to catch.
- `infrastructure_error` and a failed environment pre-flight are not behavioral results. They invalidate the run and are re-executed rather than scored.
- `not_applicable` requires a named rule, an explicit rationale, and a machine-checkable context condition where one exists.
- Clean controls must return `passed_clean_control` with zero `false_positive` outcomes.

**Probe provenance.** A probe qualifies as ground truth only with recorded evidence. A historical case must fail before its fix and pass after it, with the fix boundary causally isolated and the oracle stable across both revisions. A controlled mutation must record its source and operator, its target artifact, the expected observable failure, a baseline pass, a mutated fail, and verified rollback or cleanup. Both carry artifact and commit hashes. Block 1 found 2 of 18 mined fix commits whose own tests already passed at the parent commit, so a case earns ground-truth status through this qualification step rather than through being mined.

**Holdout integrity.** The probe corpus is split into a development set, visible to contract authors and used to improve the discipline, and a sealed evaluation set that is hidden and immutable for a given scoring version and produces the reported result. A miss on the sealed set may inform the next version only after the current evaluation closes. Revealing, repairing, and rerunning against the same supposedly held-out set is prohibited, since it converts scoring into tutoring. Contract, probe corpus, environment fixture, evaluator configuration, and scoring policy are versioned together, and a reported score names that version. Remediation is bounded: revisions are capped, and a contract that still misses is rejected rather than averaged through.

**Environment.** Before any scored run, the measurement environment passes the independent bounded pre-flight in decision item 8.

Score formulas, weighting, thresholds, corpus rotation, probe and result schemas, and the aggregation algorithm are implementation detail for the architecture stage rather than product invariants.

#### VFR-8: Reach the product from outside it

eval-quality ships as its own repository and published package rather than as a subfolder of another framework, because nothing in Eval Contract strength scoring is specific to one methodology and folding it in would restrict it to that framework's users.

Every capability an external caller needs is reachable two ways. The **library** exports the Eval Contract schema, the oracle vocabulary, the compiler, the scorer, the pre-flight, and the evidence artifact types. The **CLI** wraps that same library and adds nothing of its own; it is a caller, never a second implementation. A capability reachable one way and not the other is a defect.

The two surfaces exist for different consumers and the distinction is load-bearing:

- The **library and its published schema** are the primary integration surface. The product's measured finding is that contract authoring quality determines what an evaluator detects, so the mechanism that makes contracts get authored well at scale is agents writing them correctly by default. That requires a public, typed, indexable schema and API. A command-line tool cannot supply it, because a tool reaches only the people who already know it exists and install it.
- The **CLI** is what makes the product runnable by callers that cannot import TypeScript: CI jobs, GitHub Actions, PR-review and unit-test bots, TEA and other BMad skills, and any agent permitted to run a shell command.

TEA reaches the product this way like any other caller, by invoking the CLI. It is not co-installed and the package does not import it, per decision item 10. What TEA adds on its side is the BMad-native front-end: reading planning artifacts, VFR-1 detection, and turning a spec into a draft contract. What it cannot add is a relaxation of the discipline, since the compiler judges the artifact whoever wrote it.

Command-surface invariants: non-interactive by default so it is callable headlessly, machine-readable output as the default format, an exit code that reflects the gate verdict, and the same versioned evidence artifact whichever surface produced it. The engine still executes the agent (VFR-6); eval-quality's commands compile contracts, score their strength, run the pre-flight, and emit evidence.

Packaging follows the terms already recorded under Archived Developer-Product Requirements, adopted here as current: TypeScript, Node >= 20, ESM, Apache-2.0, unscoped npm name `eval-quality`, permissively licensed dependencies only. Pre-1.0 versioning applies, and breaking changes to the contract schema, the evidence artifact, or the CLI command, flag, and exit-code contract are called out on every release.

**Publication gate.** The repository does not go public until the work-related intellectual-property question covering this project is resolved in writing. That gate is a precondition on publication, not on building.

### Current user journey

TEA reads a BMad product spec, recognizes eval-relevant behavior, and freezes an Eval Contract. A builder agent implements the change with normal spec and repository access. A separate evaluator agent receives only the Eval Contract and black-box access to the resulting system. The resulting product may itself be agentic or conventional. The evaluator explores adaptively, produces evidence, and feeds a human-on-the-loop or automated release gate.

A second class of caller never goes through TEA. A CI job, a PR-review or unit-test bot, another skill, or an engineer at a terminal invokes the CLI directly to compile a contract, score its strength, or gate on the evidence artifact. Both paths run the same library.

Sections below preserve the original candidate engine requirements for traceability. They are research inputs and do not authorize production implementation where they conflict with this section.

## 0. Document Purpose

This PRD preserves the original engine proposal and records why it was superseded. The product brief lives at `../../briefs/brief-eval-quality-2026-07-17/brief.md`. Implementation of the Eval Contract authoring discipline scope (VFR-1 through VFR-7) is authorized by the decision above; the archived sections below are not.

## 1. Archived Vision

`eval-quality` is a provider-agnostic TypeScript library that drives an AI agent against a task, captures the full transcript, and scores the **Trajectory** as **Evidence** for a ship/don't-ship decision, not as a benchmark percentage. Its output is a Gate Verdict (PASS / CONCERNS / FAIL) backed by an inspectable, machine-readable Evidence Artifact.

The wager: in AI-assisted delivery, planning and validation are the expensive, high-value ends while code generation is cheap. Deterministic software already has evidence producers at the validation end. Agent behavior remains difficult to evaluate. The current hypotheses are claim-to-evidence lineage, semantic checkpoints, process and outcome separation, and first material error attribution. The validation plan must establish whether these add value beyond existing tools.

For v0 the goal is a tight, shippable engine that a TypeScript developer can adopt from the README in under 30 minutes and use to gate real agent behavior, proven by dogfooding on the `couture-cast` project and a BMAD skill's own evals.

## 2. Archived Target User

### 2.1 Jobs To Be Done

- As a **TypeScript engineer shipping an agent**, I need to answer "is this good enough to ship?" with defensible evidence, not a vibe check or a single benchmark number.
- As a **platform / QA / test-architect engineer**, I need a machine-readable agent-behavior evidence artifact I can wire into a CI gate next to my other checks.
- As an **agent/framework author**, I need an eval layer that is not locked to one model provider or a hosted platform.
- As **the maintainer**, I need an engine clean enough (stable grader/report interfaces) that a methodology layer can later wrap it, and IP-clean enough to be unambiguously Apache-2.0.

### 2.2 Non-Users (v1)

- Teams wanting a hosted dashboard / SaaS eval product (no UI or service in v0).
- Non-TypeScript ecosystems needing a native SDK (Python-first tools already serve them).
- Teams wanting a leaderboard/benchmark score as the deliverable (eval-quality produces evidence, not rankings).

### 2.3 Key User Journeys

- **UJ-1. Dana gates an agent change in CI.** Dana opens a PR that changes an agent prompt. An existing engine runs the suite. eval-quality supplies the methodology and validated semantic evaluators. The result identifies unsupported claims with trace evidence and produces a governed gate decision.
- **UJ-2. Sam wires eval-quality into the release gate.** Sam, a test-architect, consumes the machine-readable Evidence Artifact from an eval-quality Run and maps PASS/CONCERNS/FAIL into the team's existing gate alongside unit/contract/E2E evidence, without eval-quality dictating the gate policy.
- **UJ-3. Murat dogfoods on couture-cast.** Murat labels couture-cast traces, compares the two baselines with the prototypes, and determines whether semantic checkpoints accept valid alternate paths while rejecting unsound ones.
- **UJ-4. Frankie swaps the provider.** Frankie, an agent-framework author, has an eval-quality suite running against the Anthropic Adapter and needs it provider-neutral. Frankie supplies a different Driver/Judge Adapter (or the test/fake Adapter) and re-runs the same Tasks, Assertions, and Graders unchanged, with no task or grader code edits, confirming the eval layer is not locked to one model vendor. Exercises FR-2; validated by SM-5.

## 3. Archived Glossary

- **Task**: A single unit of work given to an agent, plus the inputs/context needed to attempt it. The subject of evaluation.
- **Run**: One execution of the harness over a Task (or a suite of Tasks), producing a Transcript and graded results. May include multiple attempts (see pass@k).
- **Adapter**: A pluggable implementation of the driver and/or judge interface for a specific provider. Makes eval-quality provider-agnostic. **Anthropic** ships first.
- **Driver**: The Adapter role that executes the agent against a Task and yields a Transcript.
- **Judge**: The Adapter role that invokes an LLM to render a judgment for graders that require one.
- **Transcript**: The complete, structured capture of a Run: ordered Steps, Tool Calls (name, params), observations/results, and the final answer.
- **Step**: One discrete action in a Transcript (e.g., a Tool Call and its observation, or the final answer emission).
- **Tool Call**: An invocation the agent makes to an external capability, with a name and parameters.
- **Trajectory**: The path the agent took: the ordered sequence of Steps/Tool Calls leading to its answer. The primary object eval-quality scores.
- **Claim**: An assertion of fact in the agent's answer that can be checked against Evidence.
- **Evidence**: Something the agent actually observed during the Run (a Tool Call result, provided context) that a Claim can be traced to.
- **Assertion**: A deterministic check expressed via the `Expect.*` DSL over the Transcript (tool calls, sequence, params, budgets).
- **Grader**: A component that scores some aspect of a Run and emits a result. Deterministic graders run first; Judge-backed graders run second.
- **Faithfulness / Grounding**: A trajectory Grader: the degree to which each Claim in the answer traces to observed Evidence. Ungrounded Claims are the signal.
- **Path Quality**: A trajectory Grader: soundness, efficiency, and non-redundancy of the Trajectory.
- **Process-vs-Outcome**: Judging that distinguishes correctness of the answer from soundness of the Trajectory (e.g., "right answer, wrong reasons").
- **Reference Trajectory**: An author-provided exemplar Trajectory for a Task, used for comparison.
- **Semantic Checkpoint Scoring**: Scoring required path dependencies through an accepted-path set or dependency graph so valid alternate trajectories can pass. The mechanism is an experiment subject under H2.
- **pass@k**: Running a Task k times and aggregating results to reason about a distribution of behavior rather than one draw.
- **Cost Budget**: A per-Run (and/or per-Task) cost ceiling; the engine accounts spend against it and reports it.
- **Evidence Artifact**: The machine-readable result of a Run, designed to feed a gate/CI.
- **Evidence Report**: The human-readable summary of a Run.
- **Gate Verdict**: The ship/don't-ship signal derived from a Run: **PASS / CONCERNS / FAIL**.

## 4. Archived Candidate Features

The features in this section describe the superseded standalone engine proposal. During validation, only FR-6 and FR-7 supply research questions. H3 and H4 from the validation plan complete the four-hypothesis set. The remaining FRs are expected to come from the selected existing engine.

### 4.1 Provider-Agnostic Runner & Adapters

**Description:** The harness drives an agent against a Task and captures a complete, structured Transcript. Driver and Judge sit behind an Adapter interface so eval-quality is provider-agnostic by construction; the **Anthropic** Adapter ships first. Realizes UJ-1, UJ-3, UJ-4.

**Functional Requirements:**

#### FR-1: Drive a Task and capture a Transcript

A caller can run a Task through a configured Driver Adapter and receive a structured Transcript. Realizes UJ-1.

**Consequences (testable):**

- The Transcript contains ordered Steps, each Tool Call with its name and parameters, each observation/result, and the final answer, normalized to a provider-neutral core shape (Open Question 6, §8); one untyped `raw` passthrough field per Step carries provider-native detail that core Assertions/Graders never read.
- The Transcript is serializable to a stable, documented schema (JSON) and round-trips without loss.
- A Run with zero Tool Calls (direct answer) still produces a well-formed Transcript.

#### FR-2: Provider-agnostic Adapter interface

A caller can supply a Driver and/or Judge Adapter conforming to a public interface; swapping Adapters requires no change to Task, Assertion, or Grader code. Realizes UJ-4.

**Consequences (testable):**

- An Anthropic Adapter is provided and covered by tests (against a mock/recorded transport by default).
- A test/fake Adapter can be injected to run the full pipeline with no network calls.
- Adapter selection is explicit configuration; no provider SDK is imported at the library's top level / entry path unless that Adapter is used.
- Before the first Task runs, the Adapter performs a one-time connection/auth pre-flight check and fails fast with a classified error (e.g. certificate/TLS, network, auth, rate-limit, response-parse) rather than surfacing a raw SDK stack trace on the Nth Task of a suite. Directly protects SM-4 (time-to-first-eval); an opaque failure on first use is the most common way that metric gets missed.

**Out of Scope:**

- Additional provider Adapters beyond Anthropic (interface exists; more come later).

### 4.2 `Expect.*` Assertion DSL

**Description:** A typed, readable DSL for deterministic Assertions over a Transcript: tool calls, sequence, parameters, and performance/cost budgets. These are the checks a gate can trust without a model in the loop. Realizes UJ-1.

**Functional Requirements:**

#### FR-3: Assert on tool calls, sequence, and parameters

A caller can assert that specific Tool Calls occurred, in a required relative order, with matching parameters. Realizes UJ-1.

**Consequences (testable):**

- Assertions support presence ("tool X was called"), ordering (relative sequence), and parameter matching (exact and predicate-based).
- Sequence assertions score partial credit via longest-common-subsequence matching rather than requiring an exact contiguous match, so extra or interleaved Tool Calls the agent legitimately made don't fail an otherwise-correct sequence.
- A failed Assertion yields a structured, human-readable diff (expected vs. actual) in the result, not just a boolean.
- Assertions are pure functions of the Transcript (no side effects, deterministic).

#### FR-4: Assert on performance and cost budgets

A caller can assert that a Run stayed within a step-count, latency, and/or Cost Budget. Realizes UJ-1.

**Consequences (testable):**

- Exceeding a declared budget produces a failing Assertion with the measured value and the ceiling.
- Budget Assertions compose with the Cost Budget accounting in FR-8.

### 4.3 Grader Pipeline (Deterministic-First, Judge-Second)

**Description:** A pipeline that runs cheap, reproducible deterministic Graders first and invokes Judge-backed Graders only where genuine judgment is required, keeping cost and flake down. Realizes UJ-1.

**Functional Requirements:**

#### FR-5: Ordered deterministic-first, judge-second execution

A caller can compose a pipeline of Graders that executes deterministic Graders before Judge-backed Graders, with configurable short-circuiting on deterministic failure. Realizes UJ-1.

**Consequences (testable):**

- Given a deterministic failure with short-circuit enabled, no Judge (LLM) call is made.
- If the Driver produced no usable final answer (a Run-level crash, not merely a failed Assertion), Judge-backed Graders are skipped entirely and reported as skipped rather than scored; there is nothing for a Judge to evaluate, and it should not be charged for or scored as a low pass.
- Each Grader emits a structured result (id, score/verdict, rationale, evidence pointers) merged into the Run result.
- The pipeline accepts caller-supplied **commodity Graders**: a holistic LLM-as-judge Grader and an efficiency-metrics Grader ship in-box as opt-in, non-default Graders (tool-call correctness is already covered deterministically by FR-3). These are supported so the Non-Goals promise of "supported, not the pitch" is backed by a real interface, but none is on the default path.
- The pipeline is deterministic given the same Transcript and fixed Judge outputs (injectable for tests).

### 4.4 Candidate Semantic Evaluators

**Description:** These are unproven evaluator hypotheses retained for the validation experiment. They must demonstrate incremental value over both baselines before they enter a replacement PRD.

**Functional Requirements:**

#### FR-6: Claim-to-Evidence Lineage Evaluator

A caller can grade whether each Claim in the agent's answer traces to observed Evidence in the Transcript. Realizes UJ-1.

**Consequences (testable):**

- The grader decomposes the answer into discrete Claims and, per Claim, emits grounded / ungrounded (or a graded score) with a pointer to the supporting Evidence when grounded.
- On a curated fixture where the answer contains a fabricated (ungrounded) Claim, the grader flags that Claim while an output-only equality check passes.
- The grader judges Claims against observed Evidence, not against the agent's stated reasoning narrative.

#### FR-7: Semantic Checkpoint Evaluator

A caller can grade a Trajectory against an author-provided Reference Trajectory by path soundness/quality rather than exact step match. Also provides Path Quality and Process-vs-Outcome judgments. Realizes UJ-3.

**Candidate scoring mechanisms:** represent required checkpoints as either an accepted-path set or an explicit dependency graph. Compare both mechanisms during the pilot. LCS remains an exact-sequence baseline and may not be described as partial-order enforcement. Use a Judge-scored soundness rubric only for residual questions that deterministic checkpoint evaluation cannot resolve. Report structural and judgment findings separately.

**Consequences (testable):**

- On a fixture, a valid alternate path that satisfies all required checkpoints in a valid partial order passes; a path that skips a required checkpoint or takes an unsound detour fails; an exact-match check would fail both.
- The checkpoint-satisfaction layer is a pure, deterministic function of the Transcript + Reference Trajectory (same inputs → same ratio, every time); only the soundness rubric consults the Judge.
- Process-vs-Outcome is reported as two distinct signals (outcome correctness vs. path soundness), so "right answer / wrong reasons" is distinguishable from "wrong answer / sound process."
- Path Quality reports soundness/efficiency/redundancy signals over the Trajectory.

**Notes:**

- `[NOTE FOR PM]` Judge-backed prototype evaluators require frozen prompts, model snapshots, thresholds, and repeated-run stability measurement.

### 4.5 pass@k Aggregation

**Description:** Runs a Task k times and aggregates results so a Gate reasons about a distribution of behavior, not a single draw. Realizes UJ-1.

**Functional Requirements:**

#### FR-8a: Aggregate k attempts

*(FR-8a is intentionally sequenced before FR-8: pass@k was inserted after FR-8 already existed, and the suffix preserves stable FR IDs rather than renumbering. Read order is FR-8a then FR-8.)*

A caller can run a Task k times and receive an aggregated result (e.g., pass rate, per-attempt breakdown). Realizes UJ-1.

**Consequences (testable):**

- With k attempts, the result reports how many passed each Grader and an aggregate suitable for the Gate.
- The case-level pass criterion is pluggable (e.g. `all` attempts pass, `any` attempt passes, or a `minPassRate` threshold) rather than a single hard-coded aggregation rule, so "does this ever flake" and "is this reliable enough" can be asked separately.
- k=1 behaves identically to a single Run (no aggregation overhead changes the verdict).

### 4.6 Cost Budget Accounting

**Description:** Treats evaluation cost as first-class: each Run accounts spend and reports it against a budget, and can stop a Run before it overspends, not just report the overspend afterward. Realizes UJ-1.

**Functional Requirements:**

#### FR-8: Account and report Run cost against a budget

A caller can set a Cost Budget and have the Run report actual spend against it. Realizes UJ-1, UJ-2.

**Consequences (testable):**

- Every Run result includes a cost figure (token/where-available pricing) attributable to Driver and Judge calls.
- When a Cost Budget is set and exceeded, the result flags it (and can fail via FR-4).
- Independent of that reporting, the Cost Budget is enforced as a hard, charge-as-you-go circuit breaker: the next Driver/Judge call that would exceed the ceiling is refused *before* it is made, not detected after the spend already happened. A single runaway tool-loop therefore cannot blow a whole suite's budget, not just one Task's.
- The circuit breaker is shareable across Runs within one process/worker (e.g. a whole suite invocation), so the ceiling can be scoped per-Task or per-suite at the caller's discretion.

### 4.7 Evidence Reporting & Gate Verdict

**Description:** Every Run emits a human-readable Evidence Report and a machine-readable Evidence Artifact, and derives a Gate Verdict (PASS / CONCERNS / FAIL). Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-9: Emit human + machine-readable evidence

A Run produces both an Evidence Report (human summary) and an Evidence Artifact (machine-readable) covering Assertions, Grader results, pass@k aggregate, and cost. Realizes UJ-1, UJ-2.

**Consequences (testable):**

- The Evidence Artifact conforms to a documented, versioned schema and is consumable by a CI step without parsing human text.
- The Evidence Report cites, per finding, the Steps/Claims/Evidence involved (inspectable, not just a score).
- A Judge-backed Grader that returns an unparseable/malformed response is reported as a distinct `judge_error` status, never conflated with a low or zero score; a broken judge and a legitimately bad Trajectory must be visibly different failures.

#### FR-10: Derive a Gate Verdict

A Run derives a PASS / CONCERNS / FAIL Gate Verdict from configurable policy over Grader/Assertion results. Realizes UJ-2.

**Consequences (testable):**

- Verdict mapping is configurable by the consumer (eval-quality supplies a sensible default, does not hard-code gate policy).
- Default policy (Open Question 5, §8): FAIL on any deterministic Assertion failure or pass@k below `minPassRate`; CONCERNS if a Judge-backed Grader flagged an issue with no deterministic failure; PASS otherwise.
- The same results + same policy always yield the same Verdict (deterministic).

### 4.8 CLI

**Description:** This archived proposal described a thin command-line wrapper over the library. The current direction uses the selected engine's CLI and CI contract. eval-quality methodology can orchestrate that existing interface.

**Functional Requirements:**

#### FR-11: Run an eval from the command line

A caller can invoke a CLI command to run a Task or suite and receive the Evidence Artifact plus a process exit code reflecting the Gate Verdict, without writing a test file first. Realizes UJ-1, UJ-2.

**Consequences (testable):**

- The command runs non-interactively by default (no prompts), required for it to be callable headlessly from CI or from an orchestrated TEA workflow run.
- The exit code reflects the Gate Verdict (e.g. 0 on PASS, nonzero on CONCERNS/FAIL, configurable strictness); JSON and JUnit output are supported for CI consumption.
- Output conforms to the same versioned Evidence Artifact schema as FR-9; the CLI is a caller of the library, not an alternate implementation.

#### FR-12: Scaffold a new eval via CLI

A caller can run a scaffold/init command to generate a starter eval spec and Reference Trajectory stub for a Task. Realizes UJ-3.

**Consequences (testable):**

- Generates a minimal, typed eval file plus a Reference Trajectory stub in the documented authoring format (ties to Open Question 3).
- Designed as the shell-out target for eval-quality methodology and scaffolding. The current direction delegates this interface to the selected engine.

**Notes:**

- `[ASSUMPTION]` The CLI ships in v0 (this reverses the earlier "library-first, no CLI" assumption; see §9).

## 5. Non-Goals (Explicit)

- No standalone eval engine during validation.
- No runner, provider adapter framework, assertion DSL, pass@k engine, cost engine, reporting framework, or CI engine, and no reimplementation of the selected engine's run CLI. The eval-quality CLI in VFR-8 covers contract compilation, Eval Contract strength scoring, environment pre-flight, and evidence emission only.
- No engine fork.
- No hosted service, dashboard, or GUI.
- No 1.0 stability promise before the discipline is in real use. The package publishes pre-1.0 under the versioning terms in VFR-8, where a minor release may break and every break is called out.
- No benchmark or leaderboard as the deliverable.
- No judging chain-of-thought prose as a scored signal.
- No claim that grounding establishes external truth.
- No differentiation claim before a capability passes the preregistered gate.
- No generic LLM-judge calibration platform. Judge calibration against human-human agreement baselines is deferred to any future certification-grade claim; the adjudicated labels from both rounds are its seed data.
- No multimodal or image-specific evaluators.
- No closed-loop auto-tuning machinery (diagnoser-driven prompt rewrites, config auto-registration).

## 6. Hypothesis Validation Scope

### 6.1 In Scope

- The 8-trace pilot corpus and 48-trace confirmatory corpus defined in the validation plan.
- The 12-task independent-evaluator experiment defined under H0.
- One agentic system and one conventional UI, API, or CLI system in the H0 task set.
- A sealed Eval Contract and auditable isolation manifest for every H0 task.
- Independent human labels and adjudication.
- Strong baseline configurations for `agentevals-dev/agentevals` and Promptfoo.
- Four disposable custom evaluator prototypes: claim-to-evidence lineage, semantic checkpoints, process and outcome separation, and first material error attribution.
- Repeated-run stability measurement.
- A comparative results summary and recorded product decision.

### 6.2 Exit Decisions

- **CONTRACT-DISCIPLINE SUPPORTED:** the paired contract comparison passes every gate on a corrected instrument. Write a replacement PRD whose headline capability is contract and oracle authoring plus Eval Contract strength scoring.
- **CONTRACT-DISCIPLINE NOT SUPPORTED:** any gate fails. Retain `eval-quality` as agents, rules, methodology, and governance over existing engines, and do not claim a measurement advantage. Recorded for block 1 on 2026-07-27: four of five gates passed and the safety gate failed on a harness defect, so block 1 does not support the hypothesis and does not refute it.
- **DARK-FACTORY REJECTED:** recorded on 2026-07-27 in `experiments/hypothesis-validation/DECISION.md` under the binary all-gates rule. Multiple frozen gates failed, including unique catches (0 of 3) and recall (0.50 against 0.80). The scored round also carried no naturally occurring defects, which narrows external validity without converting a failed gate into a pass. Any future test needs a corpus that can satisfy the gate before the first arm runs.
- **BUILD THIN PACK:** At least two semantic hypotheses pass every required gate. Write a replacement PRD containing only those evaluators and the `eval-quality` methodology layer.
- **NARROW AND REPEAT:** Exactly one hypothesis passes. Run a second confirmatory corpus for that evaluator before creating a production PRD.
- **METHODOLOGY ONLY:** No hypothesis passes, or the safety gate fails. Retain `eval-quality` as agents, rules, methodology, and governance over existing engines.

## 7. Success Metrics

- **SM-D1:** The independent evaluator catches at least 3 real, material defects missed by both self-evaluation and deterministic tests, spanning the agentic and conventional systems under test.
- **SM-D2:** Independent-evaluator precision reaches at least 0.85 and recall reaches at least 0.80.
- **SM-D3:** Clean implementations receive zero false FAIL verdicts and at most one false CONCERNS verdict.
- **SM-D4:** At least one defect is found through an evaluator-chosen action absent from the pre-canned baseline.
- **SM-D5:** Every H0 run has a complete isolation manifest and zero prohibited-input accesses.
- **SM-D6:** At least one H0 finding changes a real ship decision or materially changes remediation.
- **SM-1:** At least 3 real, material failures missed by both baselines are caught by the prototypes.
- **SM-2:** Incremental catches span at least 2 hypotheses and both agent systems.
- **SM-3:** Every evaluator proposed for packaging reaches at least 0.85 precision and 0.80 recall.
- **SM-4:** Valid grounded behavior receives zero false FAIL verdicts and at most one false CONCERNS verdict.
- **SM-5:** Judge-backed verdict stability reaches at least 0.90 across three repeated runs.
- **SM-6:** First material error attribution reaches at least 0.70 exact-step agreement and 0.85 adjacent-step agreement if proposed for packaging.
- **SM-7:** At least one finding changes a real ship decision or materially changes remediation.
- **SM-8:** Every passing evaluator runs through a public extension point without an engine fork.
- **SM-9:** After a technical pass, at least 3 organizations commit traces, engineering time, or a design-partner pilot.

The validation plan defines each metric, corpus quota, labeling rule, and stop condition. Those definitions may not change after confirmatory results are visible.

## 8. Archived Engine Decisions

The decisions below belonged to the original engine proposal. They are preserved for traceability and are inactive until a replacement PRD explicitly adopts them.

1. **Judge calibration.** The Judge is pinned to an exact model version, never "latest," and must never be the same or a weaker tier than the Driver under test (no self-judging). Judge prompts and pass/fail thresholds are versioned fixtures in-repo; a Judge/prompt change only ships if it doesn't regress the calibration fixture set already required for SM-2/SM-3. Thresholds are an empirically-set default, not a v0 config surface.
2. **Claim decomposition.** Hybrid, biased to rule-based: deterministic sentence/clause segmentation produces the claim list (unit-testable: same answer string, same claims, every time); the Judge is invoked only to decide grounded/ungrounded per already-segmented Claim, never to do the segmentation itself. Full judge-based decomposition is non-deterministic and rejected for v0.
3. **Reference Trajectory authoring format.** A plain typed TypeScript object, not a DSL or YAML: an ordered checkpoint list (required Tool Calls with predicate-matchable params, reusing the `Expect.tools.*` matcher vocabulary) plus the expected final-answer shape, not a full recorded transcript. Bar: authoring one must take less effort than the equivalent output-only Assertion.
4. **Evidence Artifact schema versioning.** This archived proposal used a `schemaVersion` integer independent of package SemVer. The experiment will preserve raw engine output and define only the minimal evaluator-result schema required for comparison.
5. **Default Gate Verdict policy.** FAIL on any deterministic Assertion failure or pass@k below the caller's `minPassRate`; CONCERNS if a Judge-backed Grader (Faithfulness, Path-Invariant) flagged an issue with no deterministic failure; PASS otherwise. Deterministic failures are hard; Judge-backed findings are a flag, not a block. Ships as the literal, documented default function (FR-10), with no hidden weighting, and remains consumer-overridable.
6. **Transcript schema.** Normalize to the provider-neutral core every Assertion/Grader reads (ordered Steps, Tool Call name/params, result, final answer, cost), plus one untyped `raw` passthrough field per Step for provider-native detail. Core Assertions/Graders never read `raw`, which preserves neutrality without discarding data a future Adapter might need.

## 9. Archived Assumptions Index

- §1/§2: [ASSUMPTION] Primary users are TS agent teams + platform/test-architect engineers; secondary are framework authors and the maintainer's own projects.
- §2.3: [ASSUMPTION] CI is the dominant execution surface for v0 (vs. interactive/local-only).
- §4.1 FR-2: [ASSUMPTION] Provider SDKs are loaded lazily per-Adapter so the core stays dependency-light and provider-neutral.
- §4.4 FR-6: [ASSUMPTION] Faithfulness is scored against observed Evidence, and reasoning-prose judging is intentionally excluded.
- §4.4 FR-7: [ASSUMPTION] Reference Trajectories are author-provided per Task (not auto-derived) in v0.
- §6: [ASSUMPTION] "Shippable v0" = the FR set above with fixtures, not a broader feature surface.
- §4.8 FR-11/FR-12: [ASSUMPTION] A thin CLI ships in v0 as a wrapper over the library (reverses the prior "library-first, no CLI" assumption, driven first by CI/headless runners needing a shell-invokable, non-interactive entry point rather than a TypeScript import, and secondarily by the future TEA layer having the same need).

---

## Archived Developer-Product Requirements

*This is a library; the following cross-cutting requirements apply.*

### API Contracts / Public Surface

- Public surface: `Expect.*` DSL, Adapter interface, Grader/pipeline API, Run/Task entry point, Evidence Artifact/Report types, Gate Verdict, and the CLI (run + scaffold commands, their flags, and their exit-code contract). These are the stable contract.
- The Evidence Artifact is a versioned schema (see Open Question 4); breaking changes to it, the Adapter interface, or the CLI's command/flag/exit-code contract follow the versioning policy below.
- Types are exported from the package entry (`dist/index.d.ts`); the engine is usable programmatically, and the CLI (FR-11, FR-12) is a thin wrapper over that same programmatic surface, not a second implementation.

### Versioning & Deprecation Policy

- SemVer. Pre-1.0 (0.x): minor may break, documented in CHANGELOG; the Adapter interface, Evidence Artifact schema, and CLI command/flag/exit-code contract are called out on every change.
- Evidence Artifact carries a schema version field so CI consumers can detect incompatibility.

### Performance Budgets

- Deterministic-first: Judge (LLM) calls are a minority of total cost/time on the dogfood suite (SM-6).
- pass@k must not multiply Judge cost unnecessarily; deterministic short-circuit applies per attempt.

### Language / Runtime Targets & Dependency Policy

- TypeScript, Node >= 20, ESM (`"type": "module"`).
- Apache-2.0; unscoped npm name `eval-quality`.
- **Dependencies:** permissively licensed only (MIT / Apache-2.0); no copyleft or proprietary dependencies.
- Core dependency-light; provider SDKs pulled in only by their Adapter, not the core entry path.

### Constraints & Guardrails

- **Cost:** every Run is cost-accounted and budgetable (FR-4, FR-8); deterministic-first minimizes spend.
- **Licensing:** Apache-2.0; all dependencies permissively licensed and reviewable before release.
- **Safety:** Judge prompts and grader logic must not leak Task secrets into logs/artifacts beyond what the Evidence Report needs. `[NOTE FOR PM]` confirm redaction expectations.

---

## Archived Appendix: Downstream Depth

*(Depth that supports architecture and epics, beyond the PRD body.)*

### Rejected alternatives (rationale)

- **Exact-match trajectory assertion as the lead signal**, rejected: brittle, punishes valid alternate paths, breaks on prompt tweaks; teams abandon it. Kept only as an optional deterministic `Expect.*` capability, never the headline. Path-invariant reference scoring (FR-7) is the answer.
- **Judging chain-of-thought / reasoning prose**, rejected as a scored signal: research indicates CoT is frequently unfaithful (stated reasoning ≠ actual computation), so scoring the narrative rewards storytelling over behavior. Judge grounding/outcome/path instead (FR-6, FR-7).
- **Holistic single LLM-judge score as the product**, rejected as the pitch: commodity, low-signal for gates. Supported inside the pipeline, not led with.
- **Benchmark/percentage output**, rejected: the deliverable is evidence + Gate Verdict, not a ranking.

### Prior art (grounds FR-6 / FR-7 and the no-CoT-judging decision)

- **FR-6 research prior:** TRACE (arXiv 2510.02837) accumulates evidence per step. TRACE grounds the agent's thought field. eval-quality H1 evaluates final-answer claims against observed evidence. TRACE remains a design prior rather than production proof.
- **FR-7 research prior:** CORE (arXiv 2509.20998) models a set of valid reference paths and scores normalized edit distance. H2 will compare accepted-path and dependency-graph mechanisms. CORE remains a design prior rather than a solved production method.
- **No CoT-prose judging:** Anthropic 2505.05410, Oxford "CoT Is Not Explainability" (2025), BonaFide 2605.25052 (CoT-faithfulness metrics near-chance).
- **Landscape:** commodity primitives are already mature. `agentevals-dev/agentevals` and Promptfoo are the experiment baselines. Any eval-quality wedge must show incremental evidence against both.

### Mechanism / transport decisions (for architecture)

- **Adapter boundary** splits Driver (executes agent → Transcript) from Judge (LLM judgment for graders). Provider SDKs are lazy-loaded per Adapter so the core entry path imports no provider SDK. Anthropic first.
- **Transcript** is the single source of truth: a serializable, versioned, provider-neutral schema. All Assertions and Graders are pure functions of the Transcript (deterministic, testable with injected/fake Judge outputs).
- **Grader pipeline** ordering: deterministic graders first with configurable short-circuit; Judge-backed graders second. Enables cost control (SM-6) and network-free testing (SM-5). Judge-backed graders are additionally skipped (not scored) when the Transcript shows a Driver-level crash with no usable final answer.
- **Evidence Artifact** carries a schema version; Gate Verdict policy is consumer-configurable with an opinion-light default.
- **Faithfulness pipeline**: answer → Claim decomposition → per-Claim grounding check against observed Evidence with Evidence pointers. Claim-decomposition strategy (rule/judge/hybrid) is Open Question 2.
- **Semantic checkpoint scoring** (FR-7): compare an accepted-path set with an explicit dependency graph during the pilot. LCS is a sequence baseline and does not enforce a partial order. A Judge-scored soundness rubric may address residual questions after deterministic checkpoint evaluation. Report structural and judgment findings separately.
- **Cost circuit breaker (FR-8)**: a stateful, shareable accounting object (spent/remaining/cap) that refuses the next Driver/Judge call *before* it would exceed the cap: charge-as-you-go rather than measure-after. Distinct from and complementary to the soft `Expect.performance.maxCostUsd`-style assertion, which only detects overspend post-hoc. Scope the object per-process/worker so it can cover a whole suite invocation, not just one Task.
- **Connection/auth pre-flight (FR-2)**: one cached check per Adapter per process, classifying failure into a small fixed set (tls/connection/auth/rate_limit/parse) with targeted remediation text per class, which turns an opaque SDK exception into an actionable message on first use. If any TLS relaxation is ever needed for a corporate-proxy or self-hosted-gateway use case, scope it to a per-client transport option passed to that Adapter's SDK client, never a process-global TLS setting; a global relaxation silently weakens unrelated HTTPS traffic (Judge calls, telemetry, etc.), a per-client one doesn't.
- **Partial-credit sequence matching (FR-3)**: longest-common-subsequence over the expected vs. observed Tool Call sequence, so extra or interleaved calls don't fail an otherwise-valid ordering the way an exact/contiguous match would.
- **Judge error as a distinct status (FR-9)**: an unparseable/malformed Judge response is a `judge_error` enum value in the Grader result, never coerced into a numeric low score; it keeps "the judge broke" visibly distinct from "the agent did badly" in the Evidence Artifact.
- **Judge tier discipline (Open Question 1)**: the Judge Adapter must default to a model tier at or above the Driver's, never below; self-judging (or under-judging) is a calibration risk, not just a cost optimization.

### Interface-stability rationale (why it matters for v0)

The current product boundary combines eval-quality methodology and any validated evaluator pack under one name. Existing engine contracts remain external dependencies. Stabilize a public evaluator API only after the experiment identifies a capability worth packaging.

### Testing / fixtures (dogfood + efficacy)

- Faithfulness efficacy (SM-2) and path-invariance efficacy (SM-3) require curated fixtures: transcripts with injected ungrounded Claims, and pairs of (valid-alternate-path, unsound-path) against a reference. These fixtures lock grader behavior against model drift (Open Question 1).
- Dogfood targets: `couture-cast` agent tasks + a BMAD skill's own evals (SM-1).

### Additional ideas considered

Beyond the mechanisms specified above, v0 deliberately favors portable, deterministic, versioned approaches over deployment-coupled configuration and brittle, unmaintainable alternatives: standard engineering hygiene, called out so the design choices are explicit rather than incidental.

### Deferred (post-v0)

- Additional provider Adapters (OpenAI, Google, local/OSS models).
- Cross-signal aggregation across unit/contract/E2E/perf/observability.
- Additional methodology automation beyond the validation experiment.
- Anything beyond CLI run + scaffold (interactive mode, TUI, config wizard, additional subcommands).
