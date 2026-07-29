---
title: "Product Brief: eval-quality"
status: building
created: 2026-07-17
updated: 2026-07-28
---

# Product Brief: eval-quality

## Current Decision: Build the Eval Contract Authoring Discipline Product

The original brief assumed `eval-quality` should build a standalone TypeScript evaluation engine. That assumption was reversed on 2026-07-22 after a corrected competitor review identified [`agentevals-dev/agentevals`](https://github.com/agentevals-dev/agentevals), which already provides most of the runner, trace, golden-set, CI, reporting, and custom-evaluator machinery described here. Promptfoo covers a second mature baseline.

**Decision, 2026-07-27: proceed to build.** Two experiment rounds and a harness postmortem give a consistent answer to what the product is. This is a product-direction decision, not a certification claim; it does not wait on a further statistically powered re-run, since that rigor serves an external certification story rather than the choice of what to build next.

- `eval-quality` is the single name for the agents, rules, methodology, governance, and any evaluator pack that passes validation.
- Existing open-source engines provide execution, trace ingestion, standard assertions, repeated runs, reports, and CI integration.
- **Terminology.** The artifact is a **Behavioral Evaluation Contract**: a versioned specification of the behaviors to probe, the evidence to collect, the negative cases to exercise, and the rules that decide pass or fail. **Eval Contract** is the shorthand used throughout. It is not a Pact or API contract. A Pact contract is an agreement between a consumer and a provider that defines request and response interactions and is verified against a provider. An Eval Contract is an agreement between intended behavior and its evaluator that defines probes, evidence, and verdict rules, and is scored against known defects and gaming cases.
- **The product is Eval Contract authoring discipline.** TEA compiles the expected behaviour of a change into contract oracles that direct an evaluator to the evidence that would expose a failure. Holding model, budget, system, and defect fixed and varying only how the contract was authored moved sealed-evaluator detection from 0.33 to 1.00 across three naturally occurring defects, 19 scored runs, 3/3 verdict stability. The mechanism is visible in the transcripts, not just the score: a plainly authored contract never prescribes the probe that exposes the defect; a disciplined contract does, by construction (separate the success indicator from the body, read the whole body, probe malformed and negative inputs, verify per record, cross-check sibling parameters and sibling tools).
- **Eval Contract strength is a scorable property, and that scoring is itself a feature.** Seed a known defect class behind a contract and measure whether the contract's oracles cause an evaluator to catch it. This is the mechanism that produced the 0.33-to-1.00 number and generalizes into a per-contract quality gate.
- **Evaluator isolation is a delivery property, not the product.** A sealed evaluator's recall is bounded above by the oracles it was given; two independent rounds agree on this from opposite failure directions. Ship it as a control (traceable, no-context-leak evaluation) rather than market it as the differentiator.
- **Ground truth can be mechanical.** Mining version-control history yields cases and oracles directly: the commit before a bug fix is the case, the fix's own test is the oracle. A mined commit qualifies only once its case is shown to fail before the fix and pass after it, since block 1 found 2 of 18 mined fix commits whose own tests already passed at the parent commit. Once qualified, no second rater is required to establish whether the historical defect boundary is reproduced and detected; broader product correctness remains outside that label. Controlled mutation is the second valid source: a defect seeded deliberately and verified against a real fix boundary covers failure classes that never left a clean historical commit. Agentic drifts such as context pollution and trajectory thrashing are candidate future probe classes for that mechanism, neither authored nor scored so far. Both sources built the rounds' adjudicated labels and both are reusable parts of Eval Contract strength scoring, not just research conveniences.
- The one gate block 1 failed (zero false FAIL on a clean control) traced to a specific, named harness defect in the *measurement* code, not in any contract or in the system under test: a stub response was missing a wrapper key the real client unwraps. That defect, and nine further ones like it found the same way (wrong response shapes, missing routes, a request-body-blind stub), are fixed and individually verified against real historical commits. Two categories are worth keeping apart here. *Subject defects* are the historical or deliberately seeded defects an evaluator is supposed to find, and block 1's three cases were real defects in the system under test. *Measurement defects* are the unintended harness and environment faults that corrupt a run. Every unintended defect found across both rounds was a measurement defect, and none was in the product's own logic. The authoring side was not clean either: round 1's B-002 oracle was underspecified for the mut2 defect class, which is the finding this product is built on. That pattern is itself evidence for making contract *and oracle* quality, including the harness and environment fixture an oracle depends on, the product surface rather than an afterthought. In practice: Eval Contract strength scoring runs an independent environment pre-flight before any scored run, and the score is trusted only once the fixture satisfies the declared invariants for the interfaces that probe exercises.
- **Independent corroboration exists.** Two production teams presenting at [AI Engineer World's Fair 2026](https://www.ai.engineer/worldsfair/2026/llms-full.md) report compatible failure dynamics in their own agent systems, Google/YouTube Ads in "Model Whisperers: How Evals and Prompts Shape Agent Behavior" and Uber Eats in "Building Closed-Loop Evals for a Multimodal Agent at Uber Scale": weak or incomplete expectations leave evaluators blind (a protected constraint violated under a high categorical pass rate; an agent that learned to game its eval loop), prohibited behavior requires explicit negative checks, and evaluator reliability depends on the quality of tools, fixtures, rubrics, and judges. The PRD adds concrete mechanics on top of that: dual aggregate-plus-per-clause gates, strict undeclared-input detection, a shared input/output operator vocabulary, zero-action negative probes, disciplined judge conduct, rubric-authoring rules, canary defect classes, and trials-not-retries gating. Those are design decisions that stand on their own merits. The talks corroborate the failure dynamics and validate none of the mechanics. None of this changes the decision; it sharpens the requirements.
- Four proposed semantic capabilities (claim-to-evidence lineage, semantic checkpoints, process and outcome separation, first material error attribution) rank below contract work and are deferred, not built now. They form the planned second layer, to be evaluated only after contract authoring is in real use.
- Prototype only through public engine extension points.
- **The dependency runs one way: TEA depends on eval-quality, never the reverse.** TEA is the reference authoring client and is named throughout this brief for that reason; read it as "the contract author." The package knows nothing about BMad and is not co-installed with it. A human, a coding agent, a CI job, a bot, or another framework's skill can author a contract and is held to the same standard, because the compiler enforces the discipline against the artifact rather than trusting whoever produced it.
- **Decision, 2026-07-28: eval-quality ships as its own repository and package**, a library with a CLI over it, rather than as a subfolder of another framework. The published contract schema and typed API are the primary surface, since agents authoring contracts correctly by default is what makes the discipline scale. The CLI is what lets CI jobs, review and test bots, other skills, and any shell-capable agent reach the same capabilities.

The remainder of this brief preserves background research rationale from the original hypothesis. Where it conflicts with this section, this section controls.

## Executive Summary

`eval-quality` is an open-source evaluation methodology for AI agents and agent-built software. Its product is Eval Contract authoring discipline plus Eval Contract strength scoring: compile the expected behavior of a change into contract oracles that direct an evaluator to the evidence that would expose a failure, and score how strong those oracles are by seeding known defects behind them. It runs on established evaluation engines and turns runtime behavior into evidence for a ship/don't-ship decision.

The bet behind eval-quality is a claim about where value lives in AI-assisted delivery: **planning and validation are the expensive, high-value ends; code generation in the middle is cheap and getting cheaper.** Teams have mature evidence sources at the validation end for deterministic software: unit, contract, E2E, performance, observability. Agent behavior is the part of validation that stays hardest to pin down, because agents are non-deterministic and a right answer reached by luck is a different failure from a wrong answer reached by good reasoning on bad data. Output-only scoring cannot tell those apart.

Four semantic capabilities (claim-to-evidence lineage, semantic checkpoints, process and outcome separation, first material error attribution) are a deferred second layer, preserved in the appendix as research context. They are evaluated only after the Eval Contract authoring discipline is in real use; they are not the current product.

## The Problem

Agents are shipping into production faster than teams can build confidence in them. When a team asks "is this agent good enough to ship?", the honest answer today is usually a vibe check plus a benchmark score, and neither survives contact with reality.

The immediate problem is contract quality. An evaluator can only investigate failures its contract tells it how to expose. A weak contract encodes the expected appearance of success without encoding the probes, evidence boundaries, negative behaviors, and cross-checks that distinguish real correctness from superficial success, so the evaluator walks past the defect. Both experiment rounds showed this directly: the plainly authored contract never prescribed the probe that exposed the defect, and in one case recorded the defective behavior as graceful handling.

The causal order matters: before adding richer diagnosis, the evaluator must first receive an adequate oracle. A sophisticated evaluator cannot recover evidence requirements the contract never expressed.

Downstream limitations, addressable only after contract quality is solved:

- **Benchmark numbers hide the failure that matters.** "The agent scored 87%" says nothing about *why* the 13% failed, or whether the 87% was reached by sound reasoning or by luck. A gate needs to know the difference.
- **Output-only grading is blind to the trajectory.** An agent can fabricate a confident answer that happens to be right, or reach a wrong conclusion through a sound process on stale data. Grading only the final string treats these identically.
- **Exact-match trajectory checks are brittle.** Asserting the agent called exactly these tools in exactly this order punishes valid alternative paths and breaks on every prompt tweak, so teams abandon it.
- **Judging the reasoning prose is a trap.** Chain-of-thought is frequently *unfaithful*: the stated reasoning does not reflect the computation that produced the answer, so scoring the narrative rewards good storytelling rather than good behavior.
- **Semantic diagnosis remains inconsistent.** Mature tools cover execution, traces, tool checks, and outcome grading. The open question is whether they reliably connect claims to observed evidence, accept alternate sound paths, separate process from outcome, and localize the first material error.

The cost of the status quo: teams either ship agents on faith, or they over-invest in bespoke, unmaintainable eval harnesses. Either way, agent behavior stays outside the evidence-based release process that governs the rest of their software.

## The Solution

eval-quality has two layers under one name:

1. **Methodology and governance:** agents and rules identify risks, propose appropriate evals, generate configuration, interpret evidence, and apply a PASS / CONCERNS / FAIL policy.
2. **Eval Contract authoring discipline and Eval Contract strength scoring:** TEA compiles expected behavior into a sealed Eval Contract whose oracles follow the authoring discipline, and each contract's strength is scored by seeding known defect classes behind it and measuring which oracles catch them. An Eval Contract strength result reports which held-out defect classes the contract's declared oracles enabled the evaluator to expose, which oracle categories were missing or ineffective, and whether gameability probes bypassed the contract. It does not estimate the probability that the agent is correct in production; contract scores are comparative diagnostics, never absolute verdicts.

The established engine supplies agent execution, trace ingestion, standard assertions, repeated runs, cost tracking, reports, and CI integration. eval-quality's own commands cover its own capabilities: compile a contract, score its strength, run the environment pre-flight, emit the evidence artifact.

The primary workflow targets human-on-the-loop and dark-factory delivery. TEA recognizes eval-relevant work and compiles a sealed Eval Contract from the product spec. A separate evaluator agent receives the contract, scoped test resources, and black-box system access. It receives no original spec, source code, repository, or builder context. It chooses its own evaluation actions from runtime observations.

The deferred second layer: four semantic hypotheses (claim-to-evidence lineage, semantic checkpoints, process and outcome separation, first material error attribution) are preserved in the appendix as research context. They stay unbuilt until Eval Contract authoring discipline is in real use, at which point they are evaluated as additions on top of it.

## What Makes This Different

eval-quality's measured advantage lives in how the Eval Contract is authored: holding model, budget, system, and defect fixed, discipline-authored contracts moved sealed-evaluator detection from 0.33 to 1.00, while the evaluator's isolation did not improve defect detection in the two completed rounds when the supplied contract lacked the necessary oracle. The differentiator to productize is contract quality: disciplined oracles, measurable contract strength, risk-driven evaluator selection, traceable findings, and explicit gate governance.

Deferred hypotheses, recorded for second-layer evaluation:

- Test whether claim-to-evidence lineage finds material failures the baselines miss.
- Test whether semantic checkpoints accept valid alternate paths while catching unsound dependencies.
- Test whether process and outcome separation changes diagnosis beyond existing scorers.
- Test whether first material error attribution localizes failures accurately enough to improve remediation.
- Keep exact sequence matching and reasoning-prose scoring outside any future differentiator claim.

**Corrected landscape.** The original research missed `agentevals-dev/agentevals`, a framework-neutral, local-first Python engine with OpenTelemetry trace ingestion, golden sets, CI gates, reports, and language-neutral custom evaluators. Promptfoo also covers mature trajectory assertions and CI execution. These products remove the case for rebuilding the commodity engine. Research such as TRACE and CORE remains useful as a design prior for the semantic hypotheses. It does not prove production value.

**What we reuse.** The selected engine supplies the runner, trace model, baseline assertions, reports, and CI contract. eval-quality prototypes remain custom evaluators and a small normalization shim. Any engine limitation is recorded as experiment evidence. It does not authorize a replacement engine during validation.

## Who This Serves

- **Primary: teams shipping AI agents** who already run evidence-based release gates for deterministic software and want agent behavior held to the same standard.
- **Primary: teams operating human-on-the-loop software factories** who need an evaluator independent from the builder and its context.
- **Primary: platform / QA / test-architect engineers** building the release gate itself, who need a machine-readable evidence artifact they can wire into CI alongside unit/contract/E2E/perf checks.
- **Secondary: agent framework authors and OSS contributors** who need reusable Eval Contract authoring rules and Eval Contract strength diagnostics across frameworks.
- **Secondary (early): the author's own projects** (`couture-cast` and a BMAD skill's own evals) as the initial dogfooding targets.

Success for these users looks like: replacing "I think the agent is fine" with a defensible PASS / CONCERNS / FAIL backed by a trajectory they can inspect.

## Success Criteria

**Neither round cleared its preregistered gates, and both recorded verdicts stand.** Round 1 is `DARK-FACTORY REJECTED` (`experiments/hypothesis-validation/DECISION.md`): multiple frozen gates failed, including unique catches and recall, under an all-gates rule. Round 2 block 1 is `CONTRACT-DISCIPLINE NOT SUPPORTED` (`experiments/hypothesis-validation/PHASE2-RESULTS.md`): four of five gates passed and the safety gate failed on the block's only clean control, a false FAIL later attributed to a named measurement-harness defect. The product owner judged the mechanism-level evidence below sufficient for a product-direction decision. It is not a certification claim, and it does not overturn either verdict.

What the evidence does support, at product-decision grade (small sample, single model, disclosed as such; see the decision note above):

- **Contract detection rate, the primary signal:** contracts authored under the oracle discipline detected materially more naturally occurring defects than plainly authored contracts over the same system, model, and budget: 0.33 vs. 1.00 pooled, three naturally occurring defects, three repetitions each, 3/3 verdict stability.
- **Eval Contract strength is measurable:** a contract can be scored before it is trusted, by seeding a known defect class and measuring whether its oracles cause an evaluator to catch it. This is the mechanism that produced the signal above. It has been exercised as an experimental procedure and is not yet implemented as a product capability; see VFR-7 in the PRD for what building it requires.
- **Independent evaluation:** reported as a delivery property rather than a value claim. Zero context-boundary breaches across every sealed run in both rounds.

Not pursued further, and not planned: a larger, multi-system, multi-model statistical replication. That
rigor would serve an external certification claim, not the choice of what to build, and this decision
does not wait on it.

The implementation itself is successful when, in real use:

- TEA compiles an eval-relevant change into a valid sealed Eval Contract, and every oracle in it maps to a named risk or expected behavior.
- Eval Contract strength scoring runs through an existing engine's public extension points without a fork.
- Environment pre-flight detects known harness corruptions before a scored run, and a pre-flight failure invalidates the run.
- The held-out defect set stays hidden from the contract author, and the scored result reports per-oracle diagnostics: which defect classes were exposed, which oracle categories were missing or ineffective, and whether gameability probes bypassed the contract.
- At least one dogfood target changes or strengthens a contract based on the scoring output.

The recorded verdicts, gate tables, and per-round evidence live in `experiments/hypothesis-validation/`: `DECISION.md` for the round-1 verdict and its deviations, `PHASE2-RESULTS.md` for the block-1 gate table, and `results/summary.md` for the full metric report. The corpus definition, labeling protocol, metrics, and decision rules that governed those runs live in the validation plan, which is closed and preserved as the execution authority. The validation thresholds for the deferred semantic layer live in the appendix.

## Scope

**Building now:**

- The Eval Contract authoring discipline itself: the oracle-writing rules that separate success indicators from body evidence, require whole-body reads, malformed/negative-input probes, per-record verification, and sibling-parameter/sibling-tool cross-checks. This is TEA's actual authored output for eval-relevant work.
- Eval Contract strength scoring: seed a known defect class behind a contract, run it, and report which oracles caught it. Per-oracle outcomes come first and an aggregate score summarizes them. The mechanical ground-truth method (commit-before-fix as the case, the fix's own test as the oracle) is the reusable core of this, qualified by a fail-before/pass-after check on every mined case.
- The `eval-quality` methodology and governance layer under the same product name, built on existing open-source engines through their public extension points.
- Harness and environment pre-flight: any scored run first checks the measurement fixture against declared invariants for the interfaces the probe exercises, since block 1's only false gate originated in the harness.
- A two-partition seeded-defect corpus: a development set the contract author works against, and a sealed evaluation set the author never sees, immutable for a given scoring version and refreshed from real defects over time. A sealed-set miss informs the next version only after the current evaluation closes, so scores stay honest against cases the contract was not tuned on.
- Gameability probes: seed compliant-looking degenerate behavior alongside the defect and require the contract's oracles to reject it, so contract strength means resisting gaming rather than only catching the defect.
- A standalone repository and package: a typed library exporting the contract schema, oracle vocabulary, compiler, scorer, and pre-flight, plus a CLI wrapping that same library so CI jobs, review and test bots, other skills, and shell-capable agents reach it without importing TypeScript. Publication waits on the work-related intellectual-property question being resolved in writing.

**Deferred, not now:**

- The four semantic hypotheses (claim-to-evidence lineage, semantic checkpoints, process/outcome separation, first material error attribution). They rank below contract work and stay unbuilt until Eval Contract authoring discipline is in real use.
- A new runner, provider adapter framework, assertion DSL, pass@k implementation, cost engine, reporting framework, or CI engine, and no reimplementation of the selected engine's run CLI.
- A 1.0 stability promise, hosted service, dashboard, or UI. The package publishes pre-1.0, where a minor release may break and every break is called out.
- The broader-replication and second-model certification pass described above.
- Judge calibration against human-human agreement baselines: the named gap between product-decision grade and any future certification-grade claim. The adjudicated labels from both rounds are its seed data.
- A generic LLM-judge calibration platform, multimodal or image-specific evaluators, and closed-loop auto-tuning machinery (diagnoser-driven prompt rewrites, config auto-registration).

## Vision

`eval-quality` is a reusable methodology, plus an Eval Contract strength scoring capability, that turns "did we write a good enough Eval Contract" into a measured question instead of a matter of taste. Established engines remain underneath it. The four semantic hypotheses are the next layer to evaluate once the Eval Contract authoring discipline is in real use and has its own track record.

---

## Appendix: Downstream Depth

*(Vision and architecture context beyond the 1-2 page brief. Sections below that describe the four semantic hypotheses and the candidate evaluator pack are deferred-layer research context, not current scope; the Current Decision section controls wherever they conflict.)*

### Broader direction: one gate, many evidence producers (context, not v0)

The larger frame: AI-assisted delivery has an expensive-planning end and an expensive-validation end, with cheap code-gen in the middle. The validation-end story is a single ship/don't-ship gate fed by many evidence producers:

- unit tests
- contract tests
- E2E tests
- performance tests
- observability / production signals
- **agent-eval (eval-quality) ← the missing producer**

All producers emit evidence into one PASS / CONCERNS / FAIL gate. eval-quality is scoped to being *one* producer done well. Aggregating them is a direction, not a v0 build.

### Layered architecture

1. **Existing eval engine:** agent execution, trace ingestion, standard assertions, repeated runs, reports, and CI integration.
2. **eval-quality contract layer:** Eval Contract authoring discipline and Eval Contract strength scoring. The deferred semantic evaluator pack joins this layer only if its hypotheses later pass validation.
3. **eval-quality methodology and governance:** agents and rules that select, generate, calibrate, interpret, and gate the evals.

Layers two and three share the `eval-quality` name. Layer one remains an external dependency selected for capability and maintainability.

### Differentiator vs commodity matrix

| Capability                                               | Position                                        | Lead with it?                         |
| -------------------------------------------------------- | ----------------------------------------------- | ------------------------------------- |
| Claim-to-evidence lineage                                | Unproven hypothesis                             | Validate as H1                        |
| Semantic checkpoints over accepted paths or dependencies | Unproven hypothesis                             | Validate as H2                        |
| Path quality (soundness/efficiency of path)              | Largely commodity                               | Baseline input to H2 and H3           |
| Process and outcome separation                           | Commodity in isolation                          | Validate incremental value as H3      |
| First material error attribution                         | Unproven hypothesis with commercial competition | Validate as H4                        |
| Tool-call correctness                                    | Commodity                                       | Support, don't pitch                  |
| Efficiency metrics                                       | Commodity                                       | Support, don't pitch                  |
| Holistic LLM-as-judge                                    | Commodity                                       | Support, don't pitch                  |
| Exact-match trajectory assertion                         | Anti-pattern (brittle)                          | **No: explicitly avoid as the lead** |
| Judging chain-of-thought / reasoning prose               | Anti-pattern (CoT often unfaithful)             | **No: explicitly avoid**             |

### Rejected / anti-pattern rationale

- **Exact-match trajectory:** brittle, punishes valid alternate paths, and breaks on prompt changes. Semantic checkpoints are the candidate alternative and still require proof.
- **Judging reasoning prose:** research shows chain-of-thought is frequently unfaithful (stated reasoning ≠ actual computation), so judging the narrative rewards storytelling over behavior. Judge grounding/outcome/path instead of prose.

### Candidate evaluator pack

- Claim-to-evidence lineage.
- Semantic checkpoints over accepted paths or a dependency graph.
- Process and outcome separation.
- First material error attribution.
- A minimal trace-normalization shim when the selected engine requires one.

### Deferred semantic-layer validation criteria

These thresholds were written for the original four-semantic-hypothesis scope and apply only if that layer is later evaluated; they are not current build gates.

- **Safety:** every packaged evaluator reaches at least 0.85 precision and 0.80 recall, with zero false FAIL verdicts on valid behavior, measured against a hermetic environment that satisfies the declared pre-flight invariants for the interfaces the probe exercises.
- **Stability:** judge-backed verdicts agree across repeated runs at least 90 percent of the time.
- **Decision value:** at least one finding changes a real ship decision or materially changes remediation.
- **Integration:** passing evaluators run through public extension points without an engine fork.
- **Demand:** after a technical pass, at least three organizations commit traces, engineering time, or a design-partner pilot.

### Constraints (hard)

- Product name: `eval-quality` for the methodology and any validated evaluator pack.
- Engine code is reused through public extension points.
- Prototype code may use the language best supported by the selected engine. TypeScript and JavaScript consumers remain supported where the engine protocol permits them.
- Published original code remains Apache-2.0 with permissively licensed dependencies.
- No production scope is approved until the validation decision is recorded.

### Competitive landscape (research-grounded, 2025-2026)

- **Python-first (dominant):** DeepEval (de facto CI eval standard; ships agent primitives: task completion, tool correctness, step efficiency, plan adherence), Ragas (RAG faithfulness, output-level), OpenAI Evals (benchmark-style), Arize Phoenix (OTel tracing + evals). Research/benchmark: Inspect (UK AISI), TruLens, AgentBench/τ-bench/SWE-Bench. Commercial: Galileo, Patronus.
- **SaaS platforms:** LangSmith (LangChain/LangGraph-native), Langfuse (open-core), Braintrust (framework-agnostic, eval-first).
- **TypeScript-native (exists, but coupled):** several TS-native options ship evals (Mastra, Braintrust, LangSmith/AgentEvals, Langfuse), but each is bound to a hosted platform or a specific agent runtime. Mastra evals (`@mastra/core/evals`) is the strongest developer-facing case (gates + scorers, CI-integrated, provider-agnostic router), yet still **coupled to Mastra's agent runtime**. Vercel AI SDK has no real eval harness; LangGraph.js trails Python and is LangSmith-coupled.
- **Missed direct competitor:** `agentevals-dev/agentevals` is a local-first, framework-neutral Python engine with OpenTelemetry traces, golden eval sets, CI gates, reports, and language-neutral custom evaluators. It covers most of the original engine scope.
- **Takeaway:** reuse an existing engine. Test the semantic hypotheses against `agentevals-dev/agentevals` and Promptfoo before claiming a product wedge.

### Research validation (prior art supporting the differentiators)

- **TRACE** (arXiv 2510.02837): reference-free trajectory eval via an accumulating per-step "evidence bank." Design prior for evidence-grounded per-step faithfulness, with two honest caveats: (a) TRACE grounds the agent's *thought* field (its hallucination axis), whereas eval-quality deliberately grounds *answer Claims* against observed Evidence and does **not** judge reasoning prose; (b) TRACE's own evaluation uses injected synthetic faults, exposed thought fields, and an LLM judge, so it is a research prior rather than production validation. eval-quality adapts the evidence-bank *idea*, not TRACE's thought-grounding target.
- **CORE** (arXiv 2509.20998): models tasks as DFAs over tool calls; each prompt induces a *set* of valid reference paths. Strongest prior art for reference-*set* (order-tolerant) trajectory scoring. Precise: CORE scores by *normalized edit-distance partial credit* over the DFA-defined path set (its Kendall's-tau component stays order-sensitive), so it is path-set-aware rather than literally path-invariant; the product term "path-invariant" is marketing shorthand for this.
- **Process Reward Models** (AgentPRM/InversePRM, arXiv 2502.10325): step-level rewards vs reference policies (training-oriented).
- **CoT unfaithfulness**: Anthropic "Reasoning models don't always say what they think" (arXiv 2505.05410; decisive hints mentioned ~25-39% of the time); Oxford "Chain-of-Thought Is Not Explainability" (2025); BonaFide meta-eval (arXiv 2605.25052; existing CoT-faithfulness metrics near-chance). Together these justify NOT judging reasoning prose.

### Dogfooding targets

- `couture-cast` project.
- A BMAD skill's own evals.

### Current repo state (2026-07-28)

The repository holds the decision record (this brief, the PRD, ADR-002), the completed hypothesis-validation experiment corpus, and a TypeScript scaffold with no evaluator behavior. Implementation of the Eval Contract authoring scope has not started; ADR-002 carries the build order.
