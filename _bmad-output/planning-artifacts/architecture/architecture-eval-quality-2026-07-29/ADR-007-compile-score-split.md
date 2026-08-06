---
id: ADR-007
title: The compile half is a build substrate; the score half is owed to a reference implementation
status: accepted
date: 2026-07-29
amends: ADR-003, ADR-005
---

# ADR-007: The compile half is a build substrate; the score half is owed to a reference implementation

## Status

Accepted 2026-07-29, **amended the same day by [ADR-008](ADR-008-compile-half-owed-to-calibration.md)**.
Enforced by spine revision 4: AD-38 restricts the first epic to `compile`, AD-40 adds the one score-side
input the measurement cannot do without, and the spine's **Owed to the reference implementation** section
records six open defects that no epic may build against.

**Amendment, round 3.** The split stands and every reviewer who commented on it endorsed it. Two of this
ADR's claims do not, and both are corrected in revision 5 rather than left to be read as current:

1. **"`compile` is a build substrate and goes to epics" is withdrawn.** Round 3 falsified the basis for it
   from three directions — the calibration corpus is uncompilable, AD-3's field set cannot carry what made
   the measured contracts win, and AD-31 made stage one depend on an artifact only `score` can regenerate.
   No epic touches `compile` either, until the spine's new **Owed to the calibration re-run** section
   closes. Inline notes below mark each affected passage.
2. **The blinded-adjudication premise is false and is deleted.** See the correction in *Decision*.

## Context

Round 2 of external review put four reviewers against spine revision 3 and produced 50 findings. Three said
do not build. The fourth said build `compile` first and do not build `score` yet. Overlap between reviewers
was low by design; the convergences are what mattered, and the triage in `reviews/triage-round-two.md`
reduces the 50 to ten root causes.

The distribution decided this ADR. Five root causes live in `compile`, and every one of them was a
specification gap with a nameable fix: quantifier semantics over degenerate operands, a completeness rule
that could not be written in its own grammar, a request shape with no transport structure, an intent-versus-
check alignment predicate no component could compute, and a set of environment and registry gaps. All five
are closed in revision 4.

Six live in `score`, and three of those are not specification gaps at all:

- **Detection was unfalsifiable.** Kerem built AD-33's promised table and found `missed` unreachable: six of
  its seven declared inputs are identical between an oracle that correctly confirmed an untouched behaviour
  and one that failed to detect the seeded defect, and the seventh is check resolution, which AD-3 forbids as
  the source of an outcome state. Codex reached the same defect forward — a probe citation proves which run
  produced a finding, not that the finding detected that probe's target. The catch rate was 1.00 by
  construction, which means the product's headline number measured nothing.
- **Repeated trials had no reducer**, and no stage signature consumed more than one run record, so the
  default three-trial minimum was unreachable and every scored run was permanently below-minimum CONCERNS
  with a non-comparable vector.
- **Observation selection was ambiguous**, and AD-39 forbade the only tie-break the run record could
  express, so two conforming scorers could produce opposite answers from one sealed artifact.

Two further facts weighed on the decision. First, the previous three revisions each closed their round's
findings and each was then found to contain new critical defects of the same kind, which is the signature of
specifying a measurement instrument in prose rather than building it. Second, the worked example shipped to
prove revision 3 works was itself found inconsistent in three places, and the checker written to validate it
had reported success — so the evidence the architecture was reasoning from was unreliable in exactly the
area under dispute.

## Decision

**Split the spine by pipeline half, and change what the score half claims to be.**

`compile` is a build substrate and goes to epics. Its five root causes are closed in revision 4. It is the
half that matches the measured 0.33-to-1.00 effect, it needs no corpus, no evaluator, and no probe, and
AD-38 already named it stage one.

> **Amended by ADR-008.** This paragraph is the sentence round 3 falsified. `compile` does *not* match the
> measured effect: every contract behind that effect declares an MCP interface AD-5 now rejects at compile
> time, and the oracle content that caused the effect has no field in AD-3's structure. It also did not
> need "no corpus" — AD-31's publication target was the worked example, which only `score` can regenerate.
> Stage one is now `compile` **and `seal`**, its readiness claim is withdrawn, and its open defects are
> recorded in the spine's **Owed to the calibration re-run**.

`score` is not a build substrate and revision 4 stops presenting it as one. Its open defects are recorded as
open, with the shape of each fix named and no pretence that naming a shape settles it. No epic touches
`score` until they close, and they close by **implementing AD-21, AD-31, AD-33, and AD-40 as pure reference
functions with generated fixtures, running them against the worked chain plus synthetic records, and
publishing the tables as generated output**. Every reviewer who proposed a next step for `score` proposed
this one independently, without having seen each other's reports.

**Four table promises are withdrawn.** AD-21, AD-31, AD-33, and AD-24 each asserted a normative table that
does not exist. AD-33's was additionally shown unmeetable as worded — over a thousand cells with positive
and negative fixtures each, and four cells undecidable from the spine at any effort. An AD that promises a
table nobody has built is not a decision, and the spine now says so as a general principle rather than
per instance.

**One score-side question is settled now rather than deferred: AD-40.** A probe declares a machine-readable
defect signature, and a probe resolves `caught` only when a mapping identifies its seeded defect among the
findings cited against it. This is committed ahead of the reference implementation because every other
score-side defect is downstream of being able to distinguish detection from non-detection: a trial reducer
over an unfalsifiable outcome reduces nothing, and a dominance relation over a rate that is 1.00 by
construction orders nothing. AD-40 deliberately does **not** commit to the mapping being deterministic. The
instrument behind the measured effect used blinded human adjudication after sealing, and claiming mechanical
equivalence here would repeat the error the AD exists to correct.

> **Corrected by ADR-008. The last two sentences are false.** The instrument behind the measured effect
> used a mechanical containment rule over quoted evidence, with the `detected` field written by the
> orchestrator; a search of the entire block for adjudication, blinding, or inter-rater agreement returns
> nothing. Blinded adjudication belongs to an earlier round on a different system, and even there the one
> comparison this architecture cites records its reviewer as acting under a disclosed no-second-reviewer
> deviation. Two experiments were merged into one sentence, and that sentence was the stated reason half
> the product was not epic-ready. Revision 5 commits AD-40 to a deterministic witness match — which, run
> as a reference procedure over the real trace, reproduced the earlier round's adjudication exactly — and
> records it as unvalidated until a run preserves the evidence a matcher needs.

## Consequences

The first epic is `compile` only, and it is unblocked. VFR-2's compile-stage surface is the gateable portion
of v0.1, which the PRD now says explicitly.

> **Amended by ADR-008.** There is no first epic. VFR-2 is not epic-ready either, and the capability map
> now says so for both halves.

VFR-7 is not epic-ready, and the capability map says so in the table rather than in a footnote. An adopter
reading the spine learns which half is real before committing, which is the same honesty AD-38 already
applied to the corpus dependency and AD-12 to enforcement the package cannot perform.

The worked example stays in the repository, uncorrected, with its retraction recorded in its own FINDINGS.md.
Patching it by hand would produce a chain that looks conforming and was still not derived from any
implemented rule — the exact defect round 2 found. It is regenerated from the reference reducer or not at
all.

The measurable claim for `score` gets weaker before it gets stronger. Until AD-40's mapping is implemented,
this project cannot honestly report a catch rate, and the previous three revisions could have reported one
that was meaningless. Withdrawing an unfalsifiable number is a gain in the product's own terms, since the
product exists to make evaluation quality falsifiable.

## Alternatives considered

**One more full revision covering all ten root causes, then a round 3 review.** Rejected. Three revisions
have followed exactly this shape and each produced a new set of criticals in the score half. Four rounds is
enough evidence that the score half is not converging under prose review, and a fifth would cost the same
and inform less than half a day of implementation.

**Reference implementation first, with no revision 4.** Rejected because the five `compile` root causes are
genuine specification gaps that block the first epic and are cheap to close now, and because two of them —
quantifier semantics and the completeness rule — change the contract schema, which the reference
implementation would otherwise have to guess at.

**Fix the worked chain first.** Rejected as the primary move for the reason above: two of its three defects
are downstream of undecided semantics, so a hand-fix would be a fabrication. The retraction is recorded
instead, which is the part that could be done honestly today.
