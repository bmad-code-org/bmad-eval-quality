---
id: ADR-002
title: Eval Contract and oracle authoring discipline is the product; isolation is a delivery property
status: accepted
date: 2026-07-27
supersedes: ADR-001 (dark-factory / isolation-as-differentiator framing, recorded only in .memlog.md)
---

# ADR-002: Eval Contract and oracle authoring discipline is the product

**Terminology.** The artifact is a **Behavioral Evaluation Contract**, shortened to **Eval Contract**
throughout. It is not a Pact or API contract: it is an agreement between intended behavior and its
evaluator, defining probes, evidence, and verdict rules, and it is scored against known defects rather
than verified against a provider.

## Status

Accepted, 2026-07-27. Decided by the product owner without running the preregistered block-2
statistical rerun; see Consequences for why that is not a gap in this decision. This ADR was
authored during experiment close-out rather than through the formal architecture workflow; a
future formally architected revision may restate it, with this text as its basis.

## Context

`eval-quality` set out to test two things: whether an isolated black-box evaluator (a "dark factory"
design) finds more real defects than a builder's own evaluation, and whether custom semantic
evaluators (claim-to-evidence lineage, semantic checkpoints, process/outcome separation, first
material error attribution) add value beyond existing eval engines. ADR-001 recorded the original
isolation-boundary design on that premise.

Two experiment rounds ran against that plan:

- **Round 1** is recorded `DARK-FACTORY REJECTED` in `DECISION.md`, under the binary all-gates rule
  the product owner restored on 2026-07-27. Multiple frozen gates failed: zero unique independent
  catches against a bar of three, recall 0.50 against 0.80, no cross-system coverage, and incomplete
  isolation manifests. Its reduced corpus carried no naturally occurring defects, which narrows
  external validity and does not convert a failed gate into a pass. Its one substantive result was a
  side effect: changing a single oracle in a sealed contract, holding everything else fixed, flipped
  an evaluator from missing a defect to catching it.
- **Round 2** tested Eval Contract authoring discipline directly: holding model, budget, system, and
  defect fixed, and varying only how the Eval Contract was authored, pooled sealed-evaluator
  detection moved from 0.33 (plainly authored) to 1.00 (discipline-authored) across three naturally
  occurring defects, 19 scored runs, 3/3 verdict stability, zero isolation violations. Four of five
  preregistered gates passed. The fifth (zero false FAIL) failed on the block's only clean control,
  which returned a false FAIL traced to a specific harness defect (a stub response missing a wrapper
  key the real client unwraps), not to the contract misjudging.

A harness postmortem then found and fixed nine further defects of the same kind (wrong response
shapes, missing routes, an endpoint the stub had never actually matched, a request-body-blind stub)
across ten cases built from real commit history, verifying each fix against the real historical
commit boundary it applied to. Two categories are worth keeping apart. *Subject defects* are the
historical or deliberately seeded defects an evaluator is meant to find, and both rounds used real
product defects or verified mutations as those cases. *Measurement defects* are the unintended faults
in the harness that corrupt a run. Every unintended defect discovered during diagnosis was a
measurement defect, and none was in the system under test's own logic. The contract side was not
clean: round 1's B-002 oracle was underspecified for the mut2 defect class, and that observation is
what this decision rests on.

A block-2 rerun (10 cases, 144 sealed arms, a second model on a 4-case subset) was fully preregistered
on this corrected instrument, ready to execute. It was not run: the product owner judged that running
it would only strengthen a certification claim, not change what to build, and directed a decision now
rather than further validation.

## Decision

1. **The product is Eval Contract-and-oracle authoring discipline.** TEA compiles the expected
   behaviour of a change into a sealed Eval Contract whose oracles are written to a discipline:
   separate the success indicator from the response body, read the whole body, probe malformed and
   negative inputs, verify per record rather than by spot-check, and cross-check sibling parameters
   and sibling tools for the same asymmetry. This discipline, not the evaluator's isolation, is what
   the measured effect is attributed to.
2. **Contract strength is a scored property, and the scoring is itself a product feature**, not just
   a research method: seed a known defect class behind a contract and measure which of its oracles
   cause an evaluator to catch it.
3. **Mechanical ground-truth mining is a reusable part of that scoring feature**: the commit before a
   bug fix is the case, the fix's own test is the oracle. No second human rater is required to
   establish that a defect exists.
4. **Evaluator isolation ships as a control and a delivery property** (traceable, no builder-context
   leakage), not as the marketed differentiator. ADR-001's dark-factory framing is superseded on this
   point.
5. **The four semantic-evaluator hypotheses are deferred**, not built now. They rank below
   Eval Contract authoring discipline and stay out of scope until that discipline is in real use.
6. **Existing open-source eval engines remain the execution substrate** (runner, trace ingestion,
   standard assertions, repeated runs, reports, CI integration). `eval-quality` owns methodology,
   contract authoring, Eval Contract strength scoring, and governance; it does not build a competing engine.
7. **`eval-quality` ships as its own repository and package**, decided 2026-07-28. A typed library is
   the primary surface and a CLI wraps it, so other tools, bots, skills, and CI jobs can reach the
   same capabilities without importing TypeScript. It is not a subfolder of another framework, since
   nothing in Eval Contract strength scoring is specific to one methodology. See VFR-8 in the PRD.
8. **TEA depends on `eval-quality`, never the reverse.** TEA is the reference authoring client that
   calls the CLI, not a co-installed runtime requirement, and the package holds no knowledge of BMad
   or its planning-artifact formats. VFR-1 is the one BMad-shaped requirement and lives on the TEA
   side. Any capability reachable only through TEA is a defect in this boundary.

## Consequences

- This decision is made at product-decision grade, not certification grade: one system, one primary
  model, ten cases (two short of the originally planned twelve; no twelfth candidate was
  mechanically validated and available to substitute). That limitation is disclosed here, not hidden
  in a rerun that was skipped on purpose.
- Every unintended defect found during experiment diagnosis was in the measurement harness rather
  than in product logic; the subject defects remained the known historical and controlled defects
  deliberately used as evaluation cases. Attribution of the failed gates differs by round: round 2's
  clean-control false FAIL originated in the harness, while round 1's gates failed or went unmet for
  separate experimental reasons (reduced sample, an underspecified oracle, blocked live access to the
  second system, missing isolation instrumentation). That pattern is itself part of the case for
  making oracle *and environment* quality a first-class part of the product surface rather than an
  afterthought; see Decision item 2.
- The preregistered block-2 rerun (10 cases, 144 sealed arms) was frozen in the private evidence root
  but is not part of this decision and no further validation is planned. Experimentation is closed;
  what follows is implementation.
- No implementation of this decision exists yet. `src/` is still the pre-decision scaffold with a
  `VERSION` constant and one placeholder test, and none of VFR-1 through VFR-7 exists as code.

## Implementation

Only implementation is left; nothing about what to build is open. Suggested order,
cheapest-value-first:

1. **VFR-2, the Eval Contract compiler.** A schema and authoring flow for TEA to produce a sealed
   contract under the discipline, with the three enforcement classes (structural error, scored
   coverage gap, validated N/A). This is the measured product, so it comes before any evaluator
   runtime.
2. **VFR-7, Eval Contract strength scoring.** Seed a known defect class behind a contract, run it, and
   report per-oracle outcomes before any aggregate score. Probes qualify through the
   fail-before/pass-after check, and the corpus splits into a development set and a sealed set.
3. **Bounded environment pre-flight**, per Decision item 2, since a scored run is only as trustworthy
   as the fixture underneath it.
4. **VFR-1** as an advisory, non-gate-authoritative recommendation.
5. **VFR-3 through VFR-6**: isolated workspace, adaptive evaluation, governed evidence output, and
   reuse of an existing engine's runner, trace, and report machinery through public extension points.
   Isolation is plumbing here rather than the headline.
6. **VFR-8, the CLI over the library.** It wraps what steps 1 through 3 already expose, so it follows
   them. The library surface it wraps does not follow them: step 1's contract schema and typed API are
   designed as the public, indexable surface from the first commit, because retrofitting a published
   schema after the internals harden is the expensive order.

Formulas, weighting, thresholds, corpus rotation, and result schemas are for the formal architecture
pass described under Status. Do not restart the four deferred semantic hypotheses before steps 1
through 3 are in real use; that ordering is part of this decision rather than a separate open
question.

The repository is local today. Decision item 7 makes a standalone public repository the destination,
and publication is gated on the work-related intellectual-property question being resolved in writing.
Until then, merging to `main` is expected and pushing to a remote stays unauthorized by this ADR.

## Supporting evidence noted 2026-07-28

Two production teams presenting at [AI Engineer World's Fair
2026](https://www.ai.engineer/worldsfair/2026/llms-full.md) (Google/YouTube Ads: "Model
Whisperers: How Evals and Prompts Shape Agent Behavior"; Uber Eats: "Building Closed-Loop Evals for
a Multimodal Agent at Uber Scale") report compatible failure dynamics: weak or
incomplete expectations leave evaluators blind (a protected constraint removed under a high
categorical pass rate; an agent that learned to game its eval loop), prohibited behavior requires
explicit negative checks, and evaluator reliability depends on the quality of tools, fixtures,
rubrics, and judges rather than the prompt layer. The PRD adds concrete
mechanics on top of that: dual aggregate-plus-per-clause gates, strict undeclared-input detection, a
shared input/output operator vocabulary, zero-action negative probes, disciplined judge conduct,
rubric-authoring rules, canary defect classes, and trials-not-retries gating. Those are design
decisions that stand on their own merits, and the talks validate none of them. This corroboration
was not available when the decision was made and does not change it; the corresponding requirements
now live in the PRD.
