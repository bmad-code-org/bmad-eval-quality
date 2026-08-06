---
id: ADR-005
title: The evaluator's findings measure detection, and the spine stops freezing what it cannot yet decide
status: accepted
date: 2026-07-29
amends: ADR-003
---

# ADR-005: The evaluator's findings measure detection, and the spine stops freezing what it cannot yet decide

## Status

Accepted 2026-07-29, after four independent external reviews of the revision 1 spine. Amends ADR-003
in three places and supersedes none of it. The enforceable form is `ARCHITECTURE-SPINE.md` revision 2
in this folder; the full triage of all 79 findings is `reviews/triage-external-round.md`.

## Context

Revision 1 was accepted after six internal review passes had produced roughly 100 findings and forced
two rewrites. It then went to four independent external reviewers — one reading it as a document, one
reading it against the experiment record that produced the data, one reading it as a quality gate, one
reading it against the repository and the registry. They returned 79 findings and four verdicts:
CONCERNS, "I would not build against this document", gate FAIL, and reject before implementation.

Overlap between the four was small, which is the useful part. The gate reviewer found a class of defect
the document reviewers structurally could not see, and the reviewer who went back to the instrument
found the one that mattered most. Six internal passes had missed both, because all six reconciled
documents against documents.

Every load-bearing factual claim was re-verified against the repository, the prior-art schemas, or an
installed Zod 4.4.3 before being accepted. One reviewer claim was rejected on that evidence. One claim
of our own was found false, and it had already propagated into the PRD.

## Decision

1. **The evaluator's findings resolve outcome states; the oracle expression does not.** Revision 1 made
   `check` "the only field the compiler and scorer evaluate" and `intent` "never parsed". The measured
   0.33-to-1.00 effect came from prose oracles a sealed evaluator read, whose free-text findings a human
   mapped to adjudicated defect identifiers; there was no machine-evaluated assertion language in either
   round. Under revision 1, `caught` therefore degraded to "the author wrote an assertion that failed",
   which is not the measured claim — while AD-23 simultaneously said only evaluator findings enter a
   detection measure, so the accepted spine specified two incompatible scorers. Outcome state now
   resolves from ingested findings mapped to oracles by required citation, and `check` is the
   mechanically enforceable compile-time surface plus a recorded corroboration signal. A disagreement
   between the two is recorded, never resolved. A second hole no reviewer named: enforcing discipline
   against `check` alone would certify a contract with a rigorous expression and a lazy intent, which is
   exactly the contract the experiments showed fails, so the discipline rules now bind the pair. (AD-3,
   AD-23, AD-33.)
2. **Every check declares its polarity.** No rule said whether an expression resolving true meant
   expected behaviour held or the defect was detected. Given `equality(/status, 200)` against a defect
   response of 500, one implementer reads false as `caught` and another as `missed`; both comply with the
   prose and the two invert the score. Polarity is now declared per check and the mapping from finding,
   resolution, probe class, control status, and waiver state to outcome state is a published total table
   with a fixture per cell. (AD-33, AD-30.)
3. **Strength is a rate vector, not a count vector.** The instrument ran three repetitions per arm, and
   that is what made 0/3 against 3/3 readable. Revision 1 carried the doctrine "trials, never retries"
   and required no minimum trial count, recorded the count nowhere, and compared raw counts — so a
   mediocre contract scored over three trials dominates a perfect contract scored over one, confidently
   and undetectably. The vector is now catch rate over unique qualified probe identifiers across a
   declared minimum trial count. A rate is not a weighted composite, so ADR-003 Decision 3 is
   untouched; this is the same refusal, correctly denominated. The relation gains `equivalent`, because
   component-wise equality previously reported `incomparable`, which is what a stability check produces
   every time. Comparability separates from scoring-version identity so that adding a probe — the
   behaviour the product exists to encourage — narrows a comparison instead of voiding every prior
   result. (AD-6, AD-7.)
4. **Severity routes the verdict and still never weights the score.** Revision 1 collected severity,
   forbade it as a multiplier, and never read it, so a missed critical behaviour and a missed cosmetic
   one produced an identical FAIL. Two decisions had been merged into one refusal. Refusing a
   severity-weighted *strength score* is correct and stands: there is no calibration data and an invented
   weight would outlive its caveat. Refusing severity in the *gate* is wrong, because a gate that treats
   all failures alike is as unbacked as one that invents weights. Severity is now the prior art's closed
   `low|material|critical`, with a policy-named floor routing between FAIL and CONCERNS, and it stays out
   of the dominance vector entirely — except as a constraint that a contract missing an at-or-above-floor
   behaviour never dominates one that caught it. (AD-21, AD-7.)
5. **The trust model is stated rather than implied.** Three separate critical findings resolved
   differently depending on whether a caller is a trusted recorder, a possibly-buggy integration, or an
   adversary, and revision 1 never said. v0 fixes it at possibly-buggy integration: verify everything
   internally verifiable — schema validity, cross-artifact agreement, recomputed digests, lineage
   consistency, declared-versus-observed consistency — and build no attestation against a determined
   liar. Revision 1's claim that the scoring version "is never caller-supplied, and only the run
   identifier is" was false for three of its five inputs, so artifacts now state which inputs are
   caller-attested. (AD-32, AD-11.)
6. **Sealed-set immutability is validated, not enforced.** A digest detects changed bytes and cannot
   detect that unchanged probe content was revealed to its author and reused, and a caller who mints a
   fresh lineage resets the revision count. Revision 1 stated "exceeding the cap rejects the contract" as
   though it were a mechanism. The package now validates a presented lineage chain and emits compliance
   evidence while the adopter owns enforcement, and says so, because an adopter relying on the stronger
   reading is relying on nothing. The alternative — an append-only attempt ledger behind a stateful port
   — was rejected for v0 as buying real enforcement at the cost of statelessness. (AD-12, AD-29, AD-32.)
7. **An AD governs a contract, not a cardinality.** Revision 1 froze the exact artifact count, the exact
   runtime-dependency count, the directory tree, and a reserved engine seam under amendment control,
   while leaving the trust model, oracle polarity, stage signatures, coverage predicates, and lineage
   authority open. Its own fixes then had to amend its own closure clauses, which is the clearest
   possible evidence that the freezes were in the wrong places. Cardinalities move to the Structural Seed;
   an AD is earned only where two independently built units could resolve a contract incompatibly. The
   spine grew from 31 decisions to 38 while becoming less restrictive, because the additions are contracts
   and the removals were counts. (AD-24, AD-25, Structural Seed.)
8. **Proof is per constraint, and the value domain is restricted.** Requiring a published schema to
   reject a violating fixture does not prove the intended constraint caused the rejection: a reject-all
   schema passes every negative fixture, and a fixture violating three constraints stays rejected after
   one silently vanishes. Negative cases are now single mutations of a valid positive fixture asserting
   the expected validator keyword and instance path. Separately, RFC 8785 requires numbers expressible as
   IEEE 754 doubles while the published schemas admitted arbitrary precision, so a non-JavaScript
   producer could emit an artifact its schema accepts and a JavaScript scorer silently rounds before
   hashing. JCS compatibility is now a schema invariant. (AD-13, AD-27, AD-36.)

Four further corrections are recorded in the spine without needing an ADR entry, because nothing was
decided so much as fixed: absent evidence became an observation rather than an `oracle-error` that
invalidated the run and prescribed deterministic re-execution forever; the forbidden-input floor went
from five members to the prior art's seven, having omitted comparator results and human labels — an
evaluator that saw the adjudicated labels is informed by definition; the probe port acquired a
default-deny network policy, since a contract arriving through a pull request could otherwise name a
cloud metadata endpoint and be probed with the CI runner's authority; and the licence allowlist widened
to the permissive SPDX families it always meant, having rejected the repository's own toolchain.

## Consequences

- The compile half of the product is now the specified half, which reverses revision 1's balance. That
  matches both the measured claim and the adoption path: `compile` works against no corpus, and it is
  where the first epic goes.
- `score` is honestly documented as unreachable without adopter investment, and the tarball carries a
  worked end-to-end example plus a qualified development corpus so the caller's boundary is concrete
  rather than reverse-engineered. The corpus mining ADR-002 promised is named as deferred rather than
  assumed.
- Three published surfaces grew: a port conformance suite, because a boundary implemented by strangers
  against prose is not a boundary; a normative predicate table for coverage relevance and satisfaction,
  because two of the five rules were undecidable from any declaration revision 1 required; and an
  orchestration layer, because pure stages and async ports otherwise yield two incompatible library
  signatures for the same primary integration surface.
- The runtime floor moved from `>=22` to `>=22.20.0`. Pinning `@types/node` to the major line was
  supposed to stop typechecking against APIs the floor lacks and does not, because the 22 line describes
  APIs added throughout it.
- Ten review passes have now run against this architecture and the last four still found six critical
  defects each. The pattern across all ten is that document-versus-document review has diminishing
  returns: the findings that mattered came from going back to the instrument, from applying a different
  professional lens, and from executing the dependency. All four reviewers independently reached the same
  limit — nobody has authored a contract in this schema or produced a conforming run record, so the
  caller's boundary is unvalidated by anything but inspection. One afternoon hand-authoring a brief and a
  matching run record against a toy system would have caught three of the five most serious findings
  before any review did. That belongs before or inside the first epic, and it is the last cheap thing
  available; the next honest signal after it costs real implementation.
