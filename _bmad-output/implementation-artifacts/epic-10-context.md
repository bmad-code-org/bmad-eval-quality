# Epic 10 Context: a real adapter for the environment-probe port

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

The `cli` mechanism epic 9 added has a declaration side, an addressing side, and a run-record side,
and none of them can be exercised: `probe-conformance.ts`'s own header comment records that
`EnvironmentProbePort` "cannot be authorized at all" for a command target, that no shipped adapter
exists to run one, and that closing the gap is "a declaration first and a suite second" — a design
addition, not made in that story. `TEST-PLAN-NEXT-STEPS.md` records the same gap for the `api`
mechanism as post-v0 work. This epic closes the `cli` half: a `CommandTargetPolicy` authorization
shape, a pure evaluator, a real `EnvironmentProbePort` adapter over a child process, and the
conformance arm that proves both.

## Stories

- Story 10.1: The command-line environment-probe adapter

## Requirements & Constraints

- AD-35's rule ("an adapter denies by default and permits only what that mapping names") has to be
  satisfiable for a command target the same way it already is for an HTTP one, with an authorization
  shape that has something to name: a real executable, permitted subcommand paths, a working
  directory, per-artifact file paths, and elapsed-time and output-byte caps.
- AD-37 binds the conformance suite: a conforming adapter is defined by an executable suite, not by
  prose. Closing the authorization shape with no suite to certify it against would be the same
  defect the pre-existing comment names.
- The repository's mechanically-enforced dependency direction (`check:layers`) permits `adapters/`
  to import `ports/` and `core/schemas` only, never `core/`. The `api` evaluator
  (`src/core/probe/target-policy.ts`) already sits under `core/` and is, in consequence, never
  called by any shipped adapter — it exists only for the in-repository test subject. The `cli`
  evaluator this epic adds is adapter-owned infrastructure instead, living under `src/adapters/`,
  precisely so the adapter that needs it can call it.
- AD-2's "v0 ships no network adapter at all" is about network I/O specifically. A child process is
  not a network call, so shipping a real `cli` adapter does not reopen that rule; it only concerns
  process execution, argv construction, and local file reads.
- `check:boundary` scans `src/`, `schemas/`, and `corpus/` for host-project vocabulary. No comment
  this epic writes may cite an epic, story, acceptance-criterion, task, or decision number.
- `test:coverage` includes `src/core/**` only, at 90% statements and 90% branches; the new adapter
  code lives outside that scope and is proven instead by the conformance suite and its own unit and
  integration tests.
- Ambiguities found mid-story are settled by construction in the story's own decisions section
  rather than escalated into a spine revision or a new ADR, as every prior epic in this repository
  has established.

## Technical Decisions

- **The policy evaluator moves out of `core/` entirely rather than the layer rule being relaxed.**
  Recorded in the story's own decisions section, with the reasoning against the dependency-direction
  rule directly.
- **The conformance arm is a second exported runner, `runCommandLineProbeConformance`, not a
  widening of `runEnvironmentProbePortConformance`.** The two mechanisms need disjoint fixtures — an
  HTTP redirect chain has no command analogue, and a subcommand allowlist has no HTTP one — so a
  single subject type would be asked to fake scenarios that do not apply to it. `CONFORMANCE_OUTCOME_COUNTS`
  gains a `command-probe` entry rather than the `environment-probe` entry changing, so nothing already
  published moves.
