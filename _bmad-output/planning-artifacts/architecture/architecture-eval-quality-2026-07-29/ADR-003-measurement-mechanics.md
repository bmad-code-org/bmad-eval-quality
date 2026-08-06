---
id: ADR-003
title: Contract strength is a vector and a dominance rule, and the oracle is a structure
status: accepted
date: 2026-07-29
amends: ADR-002
amended-by: ADR-005, ADR-006
---

# ADR-003: Contract strength is a vector and a dominance rule, and the oracle is a structure

## Status

Accepted 2026-07-29. This is the formal architecture pass ADR-002 named under its own Status, and it
closes the five items ADR-002 deferred to it: score formulas, weighting, thresholds, corpus rotation,
and result schemas. It amends rather than supersedes ADR-002; every Decision item in ADR-002 stands
except where ADR-004 corrects item 6.

The enforceable form of these decisions is
`ARCHITECTURE-SPINE.md` in this folder, where each appears as a numbered `AD` with the divergence it
prevents and the rule downstream must follow. This ADR records what was decided and why; the spine is
what implementations are checked against. `AD` references below point there.

## Context

ADR-002 established what to build and deliberately left the measurement mechanics open, on the
grounds that they are architecture rather than product direction. Two things forced them open at the
same time.

The first is that ADR-002's own build order starts with the Eval Contract compiler and the strength
scorer, and neither can be specified without the deferred items. A compiler cannot enforce authoring
discipline "mechanically rather than leaving it to reviewer attention" — ADR-002's phrase — while the
oracle it inspects is a free-text string, which is what the experiments' `eval-contract.schema.json`
carries. A scorer cannot report contract strength without a defined comparison.

The second is that the experiment corpus is stronger prior art than expected. Eight hand-written
JSON Schema files under `experiments/hypothesis-validation/schemas/` validated the H0 population — ten
condition records plus their ground-truth records and isolation manifests, per `STATUS.md` — and they
already fix conventions this pass should ratify rather than reinvent: `sha256:`-prefixed digests,
`additionalProperties: false` throughout, kebab-case enumeration values, at-least-three-digit
identifier patterns, and explicit `null` over omitted keys.

Corrected 2026-07-29 after external review: an earlier draft of this paragraph claimed the eight
schemas "carried 19 scored runs", which is false and was propagated into the PRD. The 19 scored
repetitions are Phase 2 block 1, the arm that produced the 0.33-to-1.00 effect, and
`PHASE2-RESULTS.md` places their corpus, harness, fixtures, contracts, and raw output in the private
evidence root. So the conventions are ratified on the H0 population, which is a real and sufficient
basis, and the measured effect is cited separately with its evidence held privately. The two are not
the same body of work. This was the third unexercised claim this project has caught surviving multiple
rounds, and it sits in the ADR that records the previous two.

## Decision

1. **An oracle is a structured expression plus a prose intent.** Every oracle carries a `check`
   expression tree in a closed operator vocabulary and an `intent` prose field written for the sealed
   evaluator. This supersedes contract version 1's free-text oracle string by adding to it. (AD-3, AD-4.)

   > **Amended 2026-07-29 by [ADR-005](ADR-005-review-round-corrections.md) Decision 1.** This item
   > originally made `check` "the only field the compiler and scorer evaluate" and `intent` "never
   > parsed". That relocated the measured mechanism into a field declared out of scope: the effect came
   > from prose oracles a sealed evaluator read, so `caught` would have meant "the author wrote an
   > assertion that failed". Outcome state now resolves from the evaluator's ingested findings, `check`
   > is a compile-time enforcement surface plus a recorded corroboration signal, both fields are
   > required, and the discipline rules bind the pair.
   >
   > **Further amended by [ADR-006](ADR-006-interaction-plan.md).** Requiring `check` was not viable as
   > specified, because the addressing grammar was single-observation while four of the seven discipline
   > rules are not. `check` operands now address observations through a declared interaction plan, and the
   > operator set gained collection quantifiers. Without both, three of the five oracles in the first
   > hand-written contract had no writable `check` and the contract could not compile.
2. **The five authoring rules are the closed oracle-category enumeration.** Separate the success
   indicator from the response body, read the whole body, probe malformed and negative inputs, verify
   per record rather than by spot-check, and cross-check sibling parameters and sibling tools. These
   are ADR-002 Decision 1's rules, promoted from prose into the coverage taxonomy the compiler checks
   and the axis the scorer counts against. Relevance is computed from the contract's declared
   interface kind and declared response shape, and fails closed: where a declaration is missing, the
   rule applies and its absence is a recorded coverage gap, so under-declaring costs coverage instead
   of earning a clean result. (AD-20, AD-31.)
3. **Weighting is refused, not deferred.** There is no weighted score, no percentage, and no
   severity-weighted composite. Severity is recorded data and never a multiplier. A weight invented
   here would have nothing to calibrate against, and the single number would outlive its caveat and
   become the thing people compare while the per-oracle diagnostics went unread — which contradicts
   the brief's own "comparative diagnostics, never absolute verdicts". This supersedes the brief's
   "an aggregate score summarizes them" and the aggregate half of the PRD's dual
   aggregate-plus-per-clause gate; the per-clause half stands alone. (AD-7.)

   > **Amended 2026-07-29 by [ADR-005](ADR-005-review-round-corrections.md) Decision 4.** Refusing a
   > severity-weighted strength score stands. This item over-reached in also keeping severity out of the
   > gate, which left a missed critical behaviour and a missed cosmetic one producing an identical FAIL.
   > Severity now routes between FAIL and CONCERNS against a policy-named floor, and remains barred from
   > the dominance vector and from every composite.
4. **The formula is a partial order, stated precisely.** Refusing a number does not remove the need
   for a formula; it makes the ordering the formula. Dominance is defined per probe class, treating
   every outcome state other than `caught` as a non-catch. Contract A dominates B when A is at least B
   in every class and strictly greater in at least one. A pair where neither dominates, or where one
   carries a probe class the other lacks, is reported rather than resolved. Canary probes stay out of
   the vector, because their non-detection indicts the corpus rather than the contract. (AD-7, AD-9.)

   > **Amended 2026-07-29 by [ADR-005](ADR-005-review-round-corrections.md) Decision 3.** Three
   > corrections. The vector holds catch *rates* over unique qualified probe identifiers across a
   > declared trial count, not raw counts, because the instrument behind the effect ran three repetitions
   > per arm and raw counts let trial count masquerade as contract quality. The relation gained
   > `equivalent`, since component-wise equality previously reported `incomparable` — which is what a
   > stability check produces every time. And comparability is now its own key rather than the scoring
   > version, so adding a probe narrows a comparison to the intersection instead of voiding every prior
   > result.
5. **Thresholds are replaced by a precedence order over rules.** No numeric threshold governs any
   verdict except one confidence bound named in the scoring policy. Conditions are evaluated in a
   fixed precedence and the first match wins. An invalidated run produces no verdict at all and records
   its reason. CONCERNS is the human-on-the-loop disposition the PRD requires. (AD-21, AD-6.)

   > **Amended 2026-07-29 by [ADR-005](ADR-005-review-round-corrections.md) Decisions 2 and 4.** The
   > precedence order became a total table, because "PASS otherwise" gave a green gate to an ingested
   > evaluator recommendation of FAIL and to evidence marked unavailable. A fourth verdict, WAIVED, makes
   > a mostly-waived run distinguishable from one that caught everything. The exit codes changed: PASS,
   > WAIVED, and CONCERNS all exit zero with `--strict` promoting CONCERNS to one, since exit one is
   > indistinguishable from a crash and a fatal advisory gate attracts `|| true`, which discards FAIL with
   > it. Faults now exit outside the verdict range.
6. **Outcome state carries the result, and the state set is closed** — `caught`, `missed`,
   `passed-clean-control`, `false-positive`, `abstained`, `bypassed`, `oracle-error`, `judge-error`,
   `infrastructure-error`, `not-applicable`. Behavioural failures prevent PASS; the error states are not
   behavioural results at all and invalidate the run; no state does both. A run in which nothing
   resolved is invalid rather than a pass. `not-applicable` is legal only against a compiled waiver
   and is excluded from every count. (AD-6.)

   > **Amended 2026-07-29, twice.** [ADR-005](ADR-005-review-round-corrections.md) Decision 2 added
   > `bypassed` to the behavioural failures, where the original list omitted it while calling it a
   > non-catch. Hand-authoring the first evidence artifact then forced two more, recorded in
   > `spike-worked-example/FINDINGS.md`: `confirmed`, for an oracle that correctly established correct
   > behaviour on a probe whose defect lies elsewhere — the common case on any defect probe, which
   > previously had no legal state and was being written as `passed-clean-control`; and `unreached`, for
   > an oracle whose declared interaction steps the evaluator never produced. The set is twelve.
7. **Corpus rotation is additive and immutability is checked against a computed digest.** A sealed set
   is immutable for its scoring version. A sealed-set miss informs the next version only after the
   current evaluation closes. Retiring a case into the development set creates a new scoring version
   rather than mutating the old one. Remediation is capped by the scoring policy, defaults to three
   revisions, is recorded in the evidence artifact, and exceeding it rejects the contract rather than
   averaging through it. (AD-12.)

   > **Amended 2026-07-29 by [ADR-005](ADR-005-review-round-corrections.md) Decision 6.** The cap is
   > validated, not enforced. A digest detects changed bytes and cannot detect that unchanged probe
   > content was revealed to its author and reused, and a caller who mints a fresh lineage resets the
   > count. The package validates a presented chain and emits compliance evidence; the adopter owns
   > enforcement, and the figure is recorded as caller-attested.
8. **Sealed corpora are resolved, never shipped.** A public repository cannot hold a holdout: an
   in-tree case is readable by every contract author and ends up in training data. The package ships
   the mechanism and a visible development set; sealed sets are caller-owned, resolved through a port,
   and referenced by digest and opaque reference only. This also lets each adopter hold out their own
   real defects. (AD-8.)
9. **The result schemas are a closed artifact set, and each names its predecessor.** Eval Contract,
   Rubric, Sealed Evaluator Brief, Sealed Run Record, Isolation Manifest, Probe, Artifact Reference,
   Private Artifact Manifest, Pre-flight Verdict, Scoring Policy, and Evidence Artifact. The Sealed Run
   Record succeeds the experiments' run-result schema and keeps its condition arm, findings, action-log
   reference, resource use, and invalidation reason. The experiments' evaluator-result schema belongs to
   the deferred semantic layer and its name is not reused for something else. (AD-24.)

   > **Amended 2026-07-29 by [ADR-005](ADR-005-review-round-corrections.md) Decision 7.** The set is no
   > longer closed by count, and an Evaluator Configuration artifact joined it — without one, the
   > evaluator configuration digest in the scoring version had no artifact to be computed from, so the
   > identity was caller-asserted by proxy. What the spine fixes instead is the stage-signature table,
   > with exactly one owning stage per artifact; the inventory itself is provisional.
10. **Version identity is computed, not asserted.** Three identities: an integer `schemaVersion` per
    artifact, package SemVer for code, and a scoring version computed as a digest over the tuple of
    contract schema version, corpus digest, fixture digest, evaluator configuration digest, and scoring
    policy digest. The scoring version is never caller-supplied; only the run identifier is. A
    caller-supplied version string would let the same label span a mutated corpus and would silently
    defeat sealed-set immutability. All digests use one canonical computation, since two implementations
    that hash differently make every score incomparable. (AD-11, AD-27.)

    > **Amended 2026-07-29 by [ADR-005](ADR-005-review-round-corrections.md) Decisions 5 and 8.** "Never
    > caller-supplied; only the run identifier is" was false for three of the five inputs: the corpus,
    > fixture, and evaluator configuration digests all derive from caller-supplied material, so the
    > identity is computed over attested inputs and every artifact now says which. The composition also
    > changed from a concatenated mixed-type tuple to a domain-separated canonical object, because the
    > integer contract schema version had no defined string form and two conforming scorers could compute
    > different versions from identical inputs.
11. **Zod is the schema source of truth, with the published JSON Schema proven rather than assumed.**
    Verified on 2026-07-29: Zod 4.4.3 exports a refined schema silently, dropping the constraint, with
    no warning and a zero exit status. A drift check that compares generated output against committed
    output cannot detect that loss. So every constraint that must bind a non-TypeScript consumer is
    carried into the published file and covered by a negative fixture test asserting the *published*
    schema rejects a violating input. That test, not the generator's settings, is the guard. (AD-13.)

    > **Amended 2026-07-29 by [ADR-005](ADR-005-review-round-corrections.md) Decision 8.** A negative
    > fixture alone does not prove the intended constraint caused the rejection: a reject-all schema
    > passes every negative fixture, and a fixture violating three constraints stays rejected after one
    > silently vanishes. Each negative case is now a single mutation of a valid positive fixture,
    > asserting the expected validator keyword and instance path.
12. **Prior-art conventions are ratified, including kebab-case enumerations.** The eight experiment
    schemas carry exactly one non-kebab-case enumeration value, `NOT_APPLICABLE` in the verdict enum at
    `h0-run-result.schema.json:24`; every other enumeration across the eight files is kebab-case. (An
    earlier draft claimed zero, corrected 2026-07-29 after external review; the conclusion is unchanged
    but the absolute was wrong, and the verdict enum's uppercase register is preserved deliberately.)
    The outcome states are therefore spelled in kebab-case, which renames the PRD's
    `passed_clean_control` and its siblings. Prior art authored and schema-validated across the H0
    population is the stronger precedent, and one published vocabulary with two casing rules would
    drift. The PRD is corrected to match rather than the schemas bent to it.

## Consequences

- ADR-002's suggested build order is not buildable as written and is corrected in ADR-004. Scoring
  consumes an ingested run record and a pre-flight verdict, and the scoring version needs the fixture
  digest that pre-flight produces, so scoring cannot precede either.
- Contract strength can be compared but not ranked. Two contracts frequently come back
  `incomparable`, and that is the intended answer rather than a gap to close later. Anyone wanting a
  leaderboard number will find the artifact deliberately unhelpful.
- The oracle decision moves real cost onto the authoring client. A structured `check` tree is harder
  to write than a sentence, and TEA absorbs that cost. The compensation is that the discipline becomes
  checkable by machine against the artifact rather than trusted in whoever wrote it, which is what
  makes the product usable outside BMad at all.
- Choosing Zod for developer ergonomics costs a proven-export obligation the prior art did not have.
  The eight hand-written schemas expressed conditional and containment constraints natively; those
  constraints now survive only because a fixture suite asserts they do.
- Twelve decisions here were reviewed by five independent lenses before acceptance, which produced
  roughly one hundred findings and reversed several earlier drafts of this pass. The reviews are
  preserved under `reviews/` in this folder. What they did not resolve is anything requiring live use:
  whether the five discipline rules are the right five, and whether the relevance conditions fire
  usefully on real contracts, are answerable only by authoring contracts against real systems.
