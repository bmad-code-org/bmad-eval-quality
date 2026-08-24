# Epic 2 Context: seal and deterministic brief emission

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic 2 delivers `seal`: the stage that turns a compiled Eval Contract into the sealed evaluator brief the isolated evaluator actually reads. Deterministic, non-scripted prose generated from the oracle's structured direction is the load-bearing artifact behind the product's central measured claim — the calibration spike found that prose oracles a sealed evaluator reads, not the machine-enforceable `check` expression, produced the disciplined arm's detection advantage. This epic is what makes that effect reproducible in production rather than a one-off spike result: it must generate evaluator-facing prose from declared structure only, assemble a brief carrying exactly what the isolation boundary permits, and enforce after the fact that the generated prose never smuggles in a script the declaration side cannot see.

## Stories

- Story 2.1: The direction-prose generator
- Story 2.2: Brief assembly, exclusions, and canonical ordering
- Story 2.3: The emitted-brief scripting audit

## Requirements & Constraints

- Every oracle carries a required structured direction (evidence targets, relation, polarity, scope, negative domain) and a `check` expression; evaluator-facing prose is *generated* from the direction by `seal` and is never authored free-form. Optional author commentary stays with the contract and never reaches the sealed brief.
- `seal` must generate prose deterministically: byte-identical output on repeat, and byte-identical output when contract steps or negative-domain members are reordered. Negative-domain members and every other semantically unordered declaration render in canonical sorted order before emission.
- Generated prose must be non-imperative and non-sequential — it names observations through a derived reference vocabulary (an observation's operation plus its selection predicate, e.g. "the response you obtained when you sent an invalid identifier"), never through a step identifier. The mapping from step to phrase is one-way.
- A still-open design question this epic must resolve: how a generated direction renders a temporal pair (a baseline observation and its later read-back of the same operation) without disclosing evaluator ordering. Preferred resolution is a relational dependency phrase naming what must be compared without prescribing sequence; if no candidate survives authored adversarial fixtures, record a bounded ordering disclosure explicitly rather than let the choice hide inside a template.
- The sealed brief carries only: behaviours, generated directions, interfaces, scoped resources, budgets, and safety limits. It must never carry author commentary, the interaction plan, step identifiers, or any of the seven forbidden inputs (original spec, source code, repository, builder transcript, implementation logs, comparator results, human labels).
- An emitted-brief scripting audit runs *after* generation, as acceptance work for `seal` itself (not a substitute for the declaration-side graph predicate elsewhere in the system), and rejects prose whose enumerated probe-step count exceeds a declared bound, under a stable failure code.
- Secrets and subject data must never enter a package artifact, including the sealed brief.
- The permutation fixture family (byte-identical evidence on repeat; identical outcomes under observation-array permutation) first binds in this epic's test strategy, since this is one of the first stages to consume an observation-shaped input.

## Technical Decisions

- One coded, generated-from registry is the single source of every stable failure code project-wide; the scripting audit's rejection code must be drawn from that shared registry, never invented locally or hand-maintained beside it.
- `seal` lives in `core/seal/`: pure and deterministic, no filesystem/network/clock/randomness, no model call, no evaluator execution. It must not copy the throwaway calibration-spike generator into the package — the generator is production code built fresh against the current direction fields.
- Alignment between a direction's evidence targets/relation/polarity and its `check` expression is a compile-time computation owned elsewhere; this epic only renders prose from an already-validated direction and never derives an outcome state from it.
- The interaction plan and its step identifiers stay behind in the compiler and scorer; nothing in this epic's output makes ordering readable off the brief, except where the temporal-pair decision above deliberately discloses a bound.
- The Gate D generated-current-fields prose (3-of-3 detection on the reconstructed calibration defect) is an accept fixture for the generator, not a specification — it establishes that prose generated from the current direction fields is sufficient, not that any particular wording is required.

## Cross-Story Dependencies

- Story 2.1's generated prose is the input Story 2.2 embeds into the assembled brief in canonical order; the temporal-pair rendering decision made in 2.1 constrains what 2.2 can prove byte-identical under reordering.
- Story 2.3's audit runs over the brief Story 2.2 assembles, after Story 2.1's prose is generated — it is strictly downstream of both.
- Story 2.3's stable failure code depends on the shared failure-code registry, which a separate epic implements as generated-from source; this epic cites that registry rather than defining a parallel one.
- This epic depends on the Eval Contract schema (direction fields, forbidden-input list, interaction-plan grammar) already being defined before `seal` can be implemented against it.
