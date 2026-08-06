---
id: ADR-001
title: An isolated black-box evaluator is the source of defect-detection advantage
status: superseded
date: 2026-07-22
superseded-by: ADR-002
---

# ADR-001: An isolated black-box evaluator is the source of defect-detection advantage

## Status

Superseded by ADR-002 on 2026-07-27. Recorded here as a document on 2026-07-29 during the formal
architecture pass, reconstructed from `.memlog.md` in this folder and from round 1's `DECISION.md`.
It was originally captured only as memlog entries, which left ADR-002's `supersedes` reference
pointing at nothing retrievable. Nothing depends on this decision; it exists so the supersession
chain resolves and so the discarded alternative is on the record rather than available for
rediscovery.

## Context

`eval-quality` set out to test whether an isolated black-box evaluator — a "dark factory" design —
finds more real defects than a builder's own evaluation. The premise was that context contamination
is what blinds an evaluator: a reviewer who has seen the spec, the source, and the builder's
reasoning inherits the builder's blind spots, so denying that context should surface defects that
self-evaluation misses. Isolation was therefore treated as the differentiator to build and market.

## Decision

1. Separate eval design from eval execution through a sealed Eval Contract, so the evaluator can be
   independent without losing a behaviour oracle.
2. TEA compiles and hashes the Eval Contract before implementation. The contract carries goals,
   risks, oracles, interfaces, data rules, budgets, and evidence requirements, and no prescribed
   steps.
3. The independent evaluator receives only the Eval Contract, scoped test resources, and black-box
   interfaces. The original spec, source, repository, builder transcript, and implementation logs are
   denied.
4. Run the builder, the self-evaluator, and the independent evaluator in separate workspaces with
   auditable mounts and tool permissions. A boundary breach invalidates the experiment run.
5. The evaluator chooses its actions adaptively. Deterministic and pre-canned tests remain separate
   evidence producers and experiment baselines.
6. Existing engines own execution and reporting infrastructure. `eval-quality` owns methodology,
   isolation, governance, and validated semantic extensions.
7. Distinguish the builder agent from the product under test and from the independent evaluator. The
   H0 hypothesis covers one agentic system and one conventional system.

## Consequences

Round 1 was recorded `DARK-FACTORY REJECTED` under the binary all-gates rule: zero unique
independent catches against a bar of three, recall 0.50 against 0.80, no cross-system coverage, and
incomplete isolation manifests. Its reduced corpus carried no naturally occurring defects, so the
design was never testable as framed rather than shown false.

What the round did produce was the observation that overturned this decision. Changing a single
oracle in a sealed contract, holding everything else fixed, flipped an evaluator from missing a
defect to catching it. A second round then varied only contract-authoring discipline while holding
isolation constant in both arms, and pooled sealed detection moved from 0.33 to 1.00. Isolation was
constant across the arms that differed, so it cannot be the source of the advantage.

ADR-002 supersedes this decision: authoring discipline is the product, and isolation ships as a
delivery property and an experimental control rather than the differentiator. Items 1 through 5
survive as mechanism inside that framing; only the attribution of advantage to isolation is
withdrawn. The 2026-07-29 architecture pass carries them forward as AD-2, AD-16, and AD-23 of
`../architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md`, with one correction recorded in
ADR-004: item 6's assignment of execution to an existing engine does not hold, because the engine
selected for that role does not execute anything.
