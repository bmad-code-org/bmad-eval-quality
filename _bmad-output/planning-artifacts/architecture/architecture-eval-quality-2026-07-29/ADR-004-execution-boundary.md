---
id: ADR-004
title: eval-quality executes nothing, and no engine supplies the runner
status: accepted
date: 2026-07-29
corrects: ADR-002
---

# ADR-004: eval-quality executes nothing, and no engine supplies the runner

## Status

Accepted 2026-07-29. Corrects ADR-002 Decision 6, ADR-001 Decision 6, and the engine-dependent
requirements in the PRD. The enforceable form is `ARCHITECTURE-SPINE.md` in this folder; `AD`
references below point there.

## Context

Both prior ADRs assign execution to an existing engine and keep only methodology for `eval-quality`.
ADR-002 Decision 6 states that the engine "still executes the agent, ingests traces, provides standard
assertions, runs repeated trials, and produces reports and CI integration", and the PRD repeats the
claim in VFR-6 and VFR-8. That division of labour is the load-bearing assumption behind ADR-002's
"thin layer" framing.

Checked against the named engine on 2026-07-29, it does not hold. `agentevals-dev/agentevals` scores
pre-recorded OpenTelemetry traces. It does not execute agents, and it is not the runner. It is also
Python-only — distributed on PyPI as `agentevals-cli`, with no npm package — while `eval-quality` is a
TypeScript package published to npm. `experiments/hypothesis-validation/execution-inputs.yaml`
confirms the experiments never used it: 19 runs went through Claude Sonnet 5 directly. The dependency
was assumed on both rounds and exercised on neither.

So the runner was assigned to something that supplies no runner, and the two arms that produced the
0.33-to-1.00 effect did not depend on one.

## Decision

1. **The package executes nothing.** It never spawns a process, never calls a model, never drives a
   system under test, and never invokes a judge. Its six stages are compile, seal, ingest, pre-flight,
   score, and emit, and each is a pure function over typed artifacts. Judge results arrive already
   inside an ingested run record, where judge conduct is validated on ingest rather than controlled at
   call time. (AD-1, AD-2, AD-17.)
2. **Bring your own agent.** The package emits a sealed brief; the caller runs whatever it likes
   against it — an agent, a harness, a person — and returns a run record for ingestion. This is the
   division ADR-002 wanted, with the boundary drawn where the measured effect actually sits. Contract
   authoring and defect detection are what the experiments varied, and neither needs a runner.
3. **No engine dependency in v0.** Nothing named in ADR-002 Decision 6 is depended on, because none of
   it is what v0 needs and the one engine named cannot be imported from TypeScript at all. Engine
   integration moves to v0.1 as an adapter behind an existing port, which is a smaller change than
   removing a dependency later.
4. **Impurity enters only through named ports.** Corpus, environment probe, engine, clock, and
   filesystem. The pure core is unaware of all five. Ports are the mechanism that keeps "executes
   nothing" enforceable rather than aspirational: an added dependency has to appear as a port, which is
   a visible architectural change instead of an import. Port behaviour is contracted — asynchronous,
   errors as structural failures, no internal retry, cancellation honoured. (AD-1, AD-28.)
5. **Artifacts are the interface, and OpenTelemetry is an export.** The domain artifacts are bespoke,
   because probe classes, outcome states, and dominance vectors have no faithful OTel representation and
   encoding them as span attributes would lose the closed vocabularies the scorer depends on. A
   conversion adapter exports for interop. Traces are consumed as evidence rather than as the artifact
   model. (AD-25.)
6. **The CLI reads and writes files and streams, and never mutates in place.** Inputs by path or
   stdin, outputs to a run-scoped directory and machine-readable stdout, diagnostics on stderr, exit
   codes carrying the verdict. Files make artifacts reviewable and diffable in a repository; streams keep
   it composable in CI. Never editing an input in place is what keeps a scoring run reproducible from
   its inputs.
7. **The build order follows the dataflow.** ADR-002's order puts the strength scorer second, but
   scoring consumes an ingested run record and the fixture digest that pre-flight produces, so it cannot
   come before either. Corrected order: contract compiler, then sealing and brief emission, then run-record
   ingestion, then pre-flight, then the strength scorer, then evidence emission and CI reporting. Semantic
   assertions and the deferred layers follow unchanged.
8. **The runtime floor is Node 22, developed on Node 24.** Node 20 reached end of life in April 2026,
   so the PRD's `>=20` floor supports an unsupported runtime. Node 24 is Active LTS and `.nvmrc` already
   reads 24. Type definitions are pinned to the 22.x line to match the floor, so type-checking cannot
   accept an API the floor lacks.

## Consequences

- `eval-quality` is smaller than ADR-002 anticipated, with no SDK, no process management, and no
  runner. Its dependency surface is Zod at runtime, plus toolchain. That is a better package and a
  worse story: "we run your evals for you" was easier to explain than "you run them and we tell you
  whether your contract could have caught anything".
- Repeated trials, reports, and CI integration were expected from the engine and are now unowned.
  Repeated trials become the caller's loop over sealed briefs; reporting is the evidence artifact plus
  exit codes. Both are thinner than an engine's, and that gap is a real adoption cost rather than a
  presentation problem.
- The correction removes the only mandatory Python dependency from a TypeScript package, so the
  cross-language integration problem never has to be solved in v0.
- Every claim in this ADR about the engine was verified against its published source and distribution
  rather than its README. That verification is recorded in `reviews/review-version-verification.md`. The
  finding is a reminder rather than an anomaly: two ADRs carried the same unexercised assumption across
  two experiment rounds because nothing in either round needed it to be true.
- Upstream documents still assert the superseded division of labour and are corrected in place, with
  this ADR cited at each correction, so the PRD and ADR-002 do not silently diverge from what gets built.
