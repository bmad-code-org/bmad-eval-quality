---
id: ADR-008
title: The compile half is owed to a calibration re-run; no half is epic-ready
status: accepted
date: 2026-07-29
amends: ADR-003, ADR-005, ADR-006, ADR-007
---

# ADR-008: The compile half is owed to a calibration re-run; no half is epic-ready

## Status

Accepted 2026-07-29. Enforced by spine revision 5: a new **Owed to the calibration re-run** section records
three open compile-side defects, AD-38 withdraws stage one's readiness claim and adds `seal` to stage one,
AD-31's publication target moves off the worked example, and AD-40's grammar citation, determinism hedge,
and missing finding-side operand are all corrected. Amends ADR-007's central claim.

## Context

Round 3 put four reviewers against spine revision 4 and produced 24 findings. **All four said do not
build.** That is the fourth consecutive do-not-build, and the first one that blocks `compile` — the half
ADR-007 declared a build substrate eight hours earlier. The triage in `reviews/triage-round-three.md`
reduces the 24 to ten root causes, six of them compile-side and four of those critical. Round 2's
distribution was the mirror image, and acting on that distribution is what ADR-007 did.

ADR-007 rested on one sentence: `compile` "is the half that matches the measured 0.33-to-1.00 effect".
Three reviewers falsified it independently, from three lenses, by three unrelated routes.

- **The corpus does not compile.** Every contract in the block that produced the measured effect declares
  an MCP tool interface. AD-10 places `mcp` outside v0 and revision 4 added the blocking AD-5 class that
  made the rejection real for the first time. Verified against all twenty contracts. Meanwhile AD-3
  requires its generator templates to be "calibrated against the experiments' actual disciplined
  contracts" and AD-31 takes interface kind as a predicate input, so the half that matches the measured
  claim rejects the measured claim on the first field it reads. Compounding it, AD-38's stage one omitted
  `seal` — the stage that emits the generated prose AD-3 calls the load-bearing artifact.
- **The payload does not fit.** Two reviewers extracted the real disciplined oracles and classified them
  against AD-3's five closed fields, from two different corpora, and both found the differentiator has no
  field. In one, the only clean single-variable intervention in the whole record moved a sealed run from
  PASS with zero composed-filter actions to FAIL with the seeded defect detected, and its causal content
  is two evidence-and-population preconditions. In the other, six of twelve disciplined behaviours carry a
  negative-sufficiency clause and zero of six plain ones do. Neither class has a slot, and neither can
  live in author commentary without reopening the free-prose channel AD-3 exists to close.
- **The half does not close.** AD-38 puts AD-31 in stage one; AD-31 is published by being exercised
  against the worked example; the worked example may only be regenerated from the reference reducer; the
  reducer is score-side Owed items 1 through 3, which no epic may touch. A closed cycle, and it backed a
  *blocking* compile error.

Three further facts weighed on the decision. Revision 4's own headline environmental fix failed open: the
npm control it added filters resolution while CI runs `npm ci`, reproduced by installing a 0.59-day-old
package from a lockfile under an active `min-release-age=7`. Two of revision 4's other new calibration
claims turned out to cite evidence that does not exist — AD-5's scripted arm was never run, and AD-40's
blinded human adjudication belongs to a different experiment on a different system. And the effect the
whole architecture cites as settled carries a preregistered block decision of **CONTRACT-DISCIPLINE NOT
SUPPORTED**, which the experiment record discloses honestly and which no architecture document mentioned.

## Decision

**Do to `compile` what ADR-007 did to `score`, and stop claiming either half is ready.**

Seven root causes have concrete named fixes and are closed in revision 5: the AD-31 cycle, the scripting
boundary's missing codes and missing predicates, the reference-set and `covers-by-key` grammar gaps, the
npm and licence failures, the closed-object convention's rejection of arbitrary JSON, AD-10's sensitivity
predicate, and the uncited measurement qualifications.

**One is not a specification gap, and it is recorded open.** Whether AD-3's structured direction, rendered
through a generator, still carries what made the measured contracts win is not answerable in prose. Four
rounds of prose review did not raise it; two reviewers who went to the calibration data raised it
immediately and independently. It is recorded as **Owed to the calibration re-run** item 1, with the shape
of the fix named — an evidence-precondition dimension and an insufficient-evidence condition, carried on
the brief, exempt from the alignment predicate — and with no pretence that naming a shape settles it. The
generator's templates and the brief-side scripting audit are recorded as item 2 because they are
downstream of the field set. **No epic touches `compile` until item 1 closes.**

**The gate is a re-run, not a review.** Express the disciplined oracles in AD-3's structure, implement the
generator, emit prose, and put generated and hand-written prose in front of a sealed evaluator against the
same defect-bearing revisions. This is a replication with one variable changed, against a frozen arm, and
both lens-A reviewers estimated it in half a day. If generated prose scores materially below hand-written
disciplined prose, revision 4 traded the measured effect for a computable predicate and the trade is
visible in a number.

**v0 stays `api`-only, and AD-3 now says what it is actually calibrated against.** The measured contracts
are transcribed into API-shaped fixtures and the templates are calibrated against that translation, stated
plainly. A transcription is not the measured artifact, so nothing establishes that the effect survives the
interface change; that cost is recorded as Owed item 3 rather than implied. Bringing `mcp` into v0 needs a
channel model for text-shaped responses — the real responses are unstructured markdown with no collection
a quantifier can range over — and stays in Deferred with the design question named.

**AD-40 keeps its shape and loses its hedge.** Two reviewers built the mapping and ran it; both confirmed
the fix direction, and one reproduced the earlier round's human adjudication exactly on the real trace,
naming the same decisive action and the same leaked record. So the mapping commits to a deterministic
witness match, its false premise is deleted, the residual trust moves to AD-32's caller-attested class
alongside AD-12's remediation cap, and the match is recorded as **committed but unvalidated** until a run
exists whose records preserve the evidence. The signature is rerooted in transport identity because its
cited grammar was unsatisfiable three ways. Findings gain both operands the mapping needs: cited
observation identifiers for the match, verbatim quoted evidence for auditability and for re-deriving
detection against historical records.

**A third structural principle joins the spine's other two.** An AD may not cite calibration against
evidence that does not exist. Three did, and all three are corrected.

## Consequences

There is no first epic. Revision 4's was `compile`, and the sequencing now runs through two experiments
instead: the AD-3 calibration re-run, which gates `compile`, and the AD-21/AD-31/AD-33/AD-40 reference
implementation, which gates `score`. Neither needs an epic and the first does not block the second.

The cheapest decisive experiment turned out to be already available, which no reviewer noticed. The real
corpus splits by interface kind: all of phase 2 is `mcp`, but the three `cc-h0-*` contracts — including
the v1/v2 pair that is the whole evidential basis of Owed item 1 — declare `api`. The calibration re-run
can be performed today, on a contract v0 can compile, without deciding the MCP question first.

`AD-31`'s fixture corpus is the one piece of the compile half that can be built immediately and is worth
building first, because if a satisfaction predicate turns out to need an outcome state, the split is drawn
in the wrong place again and the answer is worse than this ADR says.

The product's claim gets weaker for the second revision running. Revision 4 withdrew an unfalsifiable
catch rate; revision 5 withdraws "this half matches the measured effect". Both withdrawals are gains in
the product's own terms, and the pattern is worth naming: every round that went to the primary sources
found an architecture citing evidence it had not checked. The three corrected citations in this revision
were all introduced by revisions that had passed their own review.

## Alternatives considered

**Close all ten root causes in prose as revision 5 and run a round 4.** Rejected, and ADR-007 already
wrote the rejection: "Three revisions have followed exactly this shape and each produced a new set of
criticals in the score half." That reasoning was accepted for `score` on the strength of three data
points. Round 3 supplies the fourth, in `compile`, and consistency requires applying the same rule to the
same evidence. A fifth prose revision would cost the same as the re-run and inform less.

**Stop writing architecture entirely and let both experiments write revision 5.** Rejected for the reason
ADR-007 rejected its mirror image: seven of the ten root causes are genuine specification gaps with named
fixes, several of them — the npm control, the licence gate, the missing AD-5 codes — are things a builder
would otherwise get wrong on day one, and two change the contract schema, which the re-run would have to
guess at. Closing them now costs little and makes the re-run's inputs well defined.

**Bring `mcp` into v0 so the calibration corpus compiles.** Rejected for v0, though it is the most honest
answer to the interface problem and one reviewer argued for it directly. It is not an enum entry: text-
shaped responses need a channel model, and AD-4's quantifiers need an answer for text before per-record
verification means anything on that interface. That is grammar work of the same size as the rest of this
revision, and it would be undertaken to make a calibration corpus compile while the calibration itself is
already performable on the `api` contracts. Deferred with the design question stated rather than dropped.

**Keep AD-40's determinism hedge.** Rejected as stated and preserved in substance. The hedge's reason was
false, and declining determinism does not protect the number from the one trust the architecture cannot
discharge — it only leaves two implementers free to build two different mappings, which is round 2's worst
finding one level down. What survives is the honest half: the match is unvalidated because no run
preserved the evidence, and the block-2 replication is named as the dependency.

## Closure — 2026-07-30

ADR-008 remains the historical reason the compile half stopped. Its named exit condition has now been
executed rather than reviewed again.

The missing local-only mut2 arm was reconstructed from base `5b7c34e`, reproduced its recorded
black-box behavior, and ran under a pre-registered three-arm design with three valid repetitions per arm
and a reducer of at least two catches. The hand-written v2 positive control, prose generated from
AD-3's current fields, and generation augmented with an evidence precondition each issued composed
queries and detected the seeded defect in 3 of 3 repetitions.

The predetermined generated-current-fields branch applies. Owed item 1 closes without adding an
evidence-precondition dimension; the generator is part of the product; `seal` joins the stage-one epic
order. The generated-template and brief-audit work becomes explicit `seal` acceptance work rather than
a pre-epic gate. The API transcription corpus remains a disclosed scope limit, not a blocker.

Spine revision 9 therefore restores `compile` and `seal` to epic-ready status. `score` remains withheld
on the reference implementation items ADR-007 identified. This closure changes no claim about general
replication of the historical 0.33-to-1.00 effect.
