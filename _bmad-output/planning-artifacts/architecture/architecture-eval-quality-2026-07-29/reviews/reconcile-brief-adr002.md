---
title: "Input reconciliation — brief + ADR-002 vs ARCHITECTURE-SPINE"
type: architecture-review
target: _bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md
inputs:
  - _bmad-output/planning-artifacts/briefs/brief-eval-quality-2026-07-17/brief.md
  - _bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-22/ADR-002-contract-authoring-discipline.md
date: 2026-07-29
status: draft
---

# Input reconciliation: what did not land, and where the spine contradicts its inputs

Verdict: the spine closes most of what ADR-002 deferred, but leaves two of the five deferred items
open (`formulas`, `result schemas`), states a third (`thresholds`) only as a negative, and never
gives a Rule to the authoring discipline itself — the one thing ADR-002 calls "the measured product."

Counts: 4 critical, 3 high, 5 medium, 2 low.

Findings are ordered by priority, not by document order. Three departures are treated as already
decided and are not reported as contradictions: (a) eval-quality never executes an evaluator, agent,
judge, or system under test; (b) v0 depends on agentevals not at all; (c) no aggregate contract-strength
number is produced. Where those departures leave an input un-reconciled, that is reported as a
coherence finding rather than an error.

---

## 1. CRITICAL — `formulas` was deferred to this pass; dominance is named but never defined

**Source.** ADR-002, Implementation: "Formulas, weighting, thresholds, corpus rotation, and result
schemas are for the formal architecture pass described under Status."

**What the spine does.** AD-7 disposes of `weighting` unambiguously ("No weighting, no percentage, no
severity-weighted composite anywhere in the artifact") and replaces the composite with an ordering:
"Contract comparison is by dominance; a pair where neither dominates is reported `incomparable`
rather than resolved."

**The gap.** `dominance` is the only comparison operation in the product, and the spine never says
what it ranks. Undecided: (i) what the compared object is — the per-oracle outcome vector, the
"outcome-state counts per oracle category," or both; (ii) the ordering over AD-6's eight outcome
states, i.e. whether `abstained` is worse than `missed`, whether `not_applicable` is neutral or
excluded, whether `oracle_error` is comparable at all; (iii) whether dominance requires equality on
every category or weak dominance on all plus strict on one; (iv) whether two contracts scored under
different scoring versions (AD-11) may be compared at all. Refusing a weighted number does not
remove the need for a formula — it makes the partial-order definition the formula, and that is the
single most load-bearing undefined term in the spine. Two independently built scorers will produce
different `incomparable` verdicts on the same pair of contracts, which is exactly the divergence
class the spine exists to prevent.

**Change.** AD-7 must define the dominance relation explicitly: the compared vector, the per-state
ordering (or the statement that only `caught` counts and everything else is a non-catch, which is what
AD-6's "A probe counts as detected only on `caught`" hints at), the strict/weak rule, and the
scoring-version precondition for comparability.

---

## 2. CRITICAL — `thresholds` is closed only against PASS; CONCERNS and FAIL have no boundary

**Source.** ADR-002, Implementation: "Formulas, weighting, **thresholds**, corpus rotation, and result
schemas are for the formal architecture pass." Brief, The Solution: "apply a PASS / CONCERNS / FAIL
policy." Brief, Who This Serves: "a defensible PASS / CONCERNS / FAIL."

**What the spine does.** AD-6 fixes only the negative: "Any `missed`, `abstained`, `oracle_error`, or
absent required check prevents PASS." AD-7 adds "The gate verdict derives only from the hard rules in
AD-6 plus zero `false_positive` on clean controls, and the exit code reflects that verdict alone."
AD-17 adds a third negative: "Evidence that is incomplete, truncated past its disclosed bound,
unavailable, or internally inconsistent can never produce PASS."

**The gap.** Three verdicts exist in the product vocabulary, and the word CONCERNS appears exactly
once in the spine — inside the Consistency Conventions casing note ("except the verdicts PASS,
CONCERNS, and FAIL, which stay uppercase"). Nothing anywhere says when a non-PASS run is CONCERNS
rather than FAIL. Consequently: the verdict enum is a three-valued type with rules for one value; the
CLI exit code, which AD-14 says "reflects the gate verdict only," has no defined mapping over three
verdicts; and AD-5's non-blocking coverage gaps — the natural CONCERNS population — have no stated
effect on the verdict at all. The spine also never states the refusal for `thresholds` in the way it
does for weighting; a reader cannot tell whether "no numeric threshold exists, the verdict is
purely rule-derived" is a decision or an omission, because that sentence is not in the document.

**Change.** AD-6 or AD-7 needs an explicit verdict-derivation clause: the closed set of conditions
producing each of PASS, CONCERNS, FAIL, the fixed exit code per verdict, the treatment of AD-5
coverage gaps, and a one-line statement that no numeric threshold is used and none is deferred.

---

## 3. CRITICAL — ADR-002 Decision item 1 has no enforcing Rule; one of its five rules is absent entirely

**Source.** ADR-002, Decision 1 (binding): "a sealed Eval Contract whose oracles are written to a
discipline: separate the success indicator from the response body, read the whole body, probe
malformed and negative inputs, verify per record rather than by spot-check, and cross-check sibling
parameters and sibling tools for the same asymmetry. This discipline, not the evaluator's isolation,
is what the measured effect is attributed to." Same five rules are the brief's first Building-now
bullet: "the oracle-writing rules that separate success indicators from body evidence, require
whole-body reads, malformed/negative-input probes, per-record verification, and
sibling-parameter/sibling-tool cross-checks."

**What the spine does.** The five rules appear only inside AD-3's **Prevents** clause — "leaving the
compiler unable to detect a missing whole-body read, negative probe, per-record verification, or
sibling cross-check" — and that list is four items, not five: *separate the success indicator from
the response body*, the rule the experiments' round-1 B-002 failure turned on, is nowhere in the
spine. AD-3's actual **Rule** requires only that every oracle carry a `check` and an `intent`. AD-5
defines three enforcement *classes* without naming a single discipline rule that could be violated.
AD-7 then reports "outcome-state counts per **oracle category**" and the term `oracle category` is
never defined anywhere in the document.

**Why it matters.** A Prevents clause is rationale, not a binding constraint, so the product's central
claim currently rests on nothing enforceable: two independently built compilers can each satisfy every
AD while checking a different set of discipline rules, or none. This also propagates — AD-5's
"coverage gap" has no enumerated gap taxonomy, and AD-7's per-category counts have no categories.

**Change.** A new AD (or a Rule addition to AD-3) must name the closed set of discipline rules as the
compiler's enforced coverage checks, fix them as the `oracle category` enumeration consumed by AD-5
and AD-7, and include the success-indicator/body separation that is currently missing.

---

## 4. CRITICAL — Gameability probes are a Building-now bullet and a success criterion; AD-9 excludes them

**Source.** Brief, Scope / Building now: "**Gameability probes:** seed compliant-looking degenerate
behavior alongside the defect and require the contract's oracles to reject it, so contract strength
means resisting gaming rather than only catching the defect." Brief, Success Criteria: "the scored
result reports per-oracle diagnostics: which defect classes were exposed, which oracle categories were
missing or ineffective, and **whether gameability probes bypassed the contract**." Brief, The
Solution: "and whether gameability probes bypassed the contract."

**What the spine does.** Nothing. The word does not appear. Worse than silence, AD-9 closes the door:
"a historical probe qualifies only with recorded fail-before and pass-after evidence... A controlled
mutation qualifies only with its source and operator... **An unqualified probe cannot enter a sealed
set.**" A gameability probe is neither a historical fix boundary nor a defect mutation — it is
compliant-looking degenerate behaviour, so it has no qualification path under AD-9's two categories
and is therefore prohibited from sealed sets by construction. AD-6's closed outcome-state enum has no
state for "the contract accepted a degenerate response," and `passed_clean_control` / `false_positive`
are about clean controls, which is the opposite case. AD-10's pre-flight bound "the seeded fault being
the only anomalous response in scope" assumes a single seeded fault, which a defect-plus-gaming-probe
pair violates.

**Change.** AD-9 needs a third probe class with its own qualification rule (a gaming probe qualifies
when a compliant-looking degenerate response is shown to satisfy a naive oracle and to be rejected by
a disciplined one), AD-6 needs the corresponding outcome state and its PASS effect, and AD-10's
"only anomalous response in scope" bound needs to admit the paired probe.

---

## 5. HIGH — `result schemas` was deferred to this pass; the spine fixes the mechanism, not the schemas

**Source.** ADR-002, Implementation: "Formulas, weighting, thresholds, corpus rotation, and **result
schemas** are for the formal architecture pass."

**What the spine does.** AD-13 fixes how schemas are authored and published ("each artifact schema is
defined once in Zod... continuous integration fails when the committed schema differs from a fresh
generation"), AD-11 fixes versioning, and the Consistency Conventions fix casing, digests, dates and
null handling. The Structural Seed reserves `core/schemas/` and `schemas/`.

**The gap.** No normative content for any result artifact. The spine never enumerates the artifact set
as a closed list, never states the required fields of the evidence artifact or the scoring result, and
`companions: []` confirms no schema document accompanies it. Field-level obligations exist only as
scattered by-products: AD-11's "Every reported score names its scoring version," AD-12's recorded
remediation count, AD-8's sealed-set digest reference, AD-7's per-oracle outcomes. That is enough for
a reviewer and not enough for two teams to build interoperable artifacts, which is the spine's stated
job. Since the deferral was explicit and this document is the named destination, leaving the result
schema to implementation reopens what ADR-002 closed.

**Change.** Either add a companion schema-contract document (and list it in `companions:`) fixing the
required field set per artifact, or add an AD that enumerates the artifact set and the minimum
required fields of the evidence artifact and scoring result. The eight ratified draft-2020-12 files in
`experiments/hypothesis-validation/schemas/`, already listed as a source, are the obvious basis.

---

## 6. HIGH — The spine's dataflow makes ADR-002's implementation order impossible

**Source.** ADR-002, Implementation, "Suggested order, cheapest-value-first": step 2 is "**VFR-7, Eval
Contract strength scoring.** Seed a known defect class behind a contract, run it, and report per-oracle
outcomes"; step 3 is "**Bounded environment pre-flight**"; step 5 is "**VFR-3 through VFR-6**: isolated
workspace, adaptive evaluation, governed evidence output, and reuse of an existing engine's runner,
trace, and report machinery." The ADR adds that "that ordering is part of this decision rather than a
separate open question."

**What the spine does.** It makes step 2 depend on both step 3 and step 5. The pipeline diagram feeds
`score` from three inputs — `I[ingest] --> S[score]`, `CORPUS --> S`, and `PRE[Pre-flight verdict] --> S`
— and `ingest` consumes an "Evaluator result + isolation manifest" that only exists downstream of
`seal`, which is VFR-3, step 5. AD-6 makes the pre-flight verdict load-bearing for scoring ("a failed
pre-flight invalidate[s] the run"), and AD-11 requires every score to name a scoring version whose
tuple includes the "fixture digest" that only pre-flight (step 3) produces. So under the spine, no
score can be produced, and no scoring version can be named, until seal, ingest and pre-flight exist.

**Change.** Either the spine states the buildable order it actually implies (compile → seal/ingest →
pre-flight → score → emit → CLI) as a note under the Capability map, or ADR-002's Implementation
section is corrected. Since ADR-002 says the ordering is part of the decision, this cannot be left as
an implicit override; it needs a stated resolution in one document or the other.

---

## 7. HIGH — AD-17 introduces a ninth outcome state that AD-6 declares closed

**Source (internal contradiction).** AD-6: "every required check resolves to **exactly one of**
`caught`, `missed`, `passed_clean_control`, `false_positive`, `abstained`, `oracle_error`,
`infrastructure_error`, `not_applicable`." AD-17: "an unparseable response is `judge_error`, never
coerced into a low score."

**What the spine omits.** `judge_error` is not in AD-6's enumeration, and nothing says whether it
behaves like `oracle_error` (prevents PASS, still scored) or like `infrastructure_error` (invalidates
the run, never scored as behaviour). AD-17's own Prevents says the point is "a broken judge being
scored as bad behaviour," which argues for the invalidating branch — but the Rule does not say so, and
AD-6's list is the normative enum that a schema will be generated from. This also bears on ADR-002's
"trials, never retries" handling: whether a `judge_error` run may be re-executed outside the
behavioural distribution is undetermined.

**Change.** Add `judge_error` to AD-6's enumeration with its explicit PASS and run-validity effect, or
have AD-17 map it onto an existing state.

---

## 8. MEDIUM — The methodology and governance layer is a Building-now bullet with no home and no deferral

**Source.** Brief, Scope / Building now: "The `eval-quality` methodology and governance layer under
the same product name, built on existing open-source engines through their public extension points."
Brief, The Solution, layer 1: "**Methodology and governance:** agents and rules identify risks,
propose appropriate evals, generate configuration, interpret evidence, and apply a PASS / CONCERNS /
FAIL policy." Same layer in the Appendix: "agents and rules that select, generate, calibrate,
interpret, and gate the evals." ADR-002 Decision 6: "`eval-quality` owns methodology, contract
authoring, Eval Contract strength scoring, and **governance**."

**What the spine does.** The frontmatter `scope` covers "Eval Contract compiler, contract strength
scoring, environment pre-flight, evidence emission, and the library plus CLI surface" — the agents-and-
rules layer is absent. The Capability map has no row for it; the Deferred list has no entry for it.
The gate-policy fragment of it survives inside AD-6/AD-7, but the risk-identification, eval-proposal,
config-generation and evidence-interpretation agents are neither bound nor deferred. Silent omission is
the problem here, not the exclusion: a reader of brief plus spine cannot tell whether the layer moved
out of v0, moved to the TEA client under AD-15, or was forgotten.

**Change.** Add either a Capability map row (naming where the agents and rules live relative to the
package boundary in AD-15) or an explicit Deferred entry.

---

## 9. MEDIUM — The engine departure is broader than the planned ADR correction, and leaves a brief hard constraint unmet

**Source.** ADR-002 Decision 6: "**Existing open-source eval engines remain the execution substrate**
(runner, trace ingestion, standard assertions, repeated runs, reports, CI integration)." ADR-002
Implementation step 5: "**VFR-3 through VFR-6**: ... and reuse of an existing engine's runner, trace,
and report machinery through public extension points." Brief, Constraints (hard): "Engine code is
reused through public extension points." Brief, Success Criteria: "Eval Contract strength scoring runs
through an existing engine's public extension points without a fork."

**What the spine does.** Deferred: "**The agentevals adapter and any engine integration.** The engine
scores pre-recorded OpenTelemetry traces and never executes an agent, so it supplies nothing v0
needs." Capability map: "VFR-6 Engine reuse | EnginePort, no adapter in v0."

**Why it still needs a change.** The already-planned ADR correction is scoped to the word "runner" in
item 6, but the spine drops all six listed capabilities in v0, retires Implementation step 5's
engine-reuse clause, and leaves the brief's hard constraint and its named implementation-success
criterion unsatisfiable in v0 — a reader checking the brief against the spine will score that criterion
as unmet rather than retired. Separately, VFR-6 sits in the spine's `binds:` list while the map
satisfies it with a port that has no implementation, which overstates what the spine binds.

**Change.** Widen the planned ADR-002 correction to item 6's full capability list plus Implementation
step 5; have the spine's Deferred entry name the brief constraint and success criterion it retires for
v0; and either move VFR-6 out of `binds:` or mark it seam-only there.

---

## 10. MEDIUM — The no-aggregate departure is coherent but untraced against the inputs that require an aggregate

**Source.** Brief, Scope / Building now: "Eval Contract strength scoring: seed a known defect class
behind a contract, run it, and report which oracles caught it. **Per-oracle outcomes come first and an
aggregate score summarizes them.**" Brief, Independent corroboration: "The PRD adds concrete mechanics
on top of that: **dual aggregate-plus-per-clause gates**..." (echoed verbatim in ADR-002, Supporting
evidence).

**What the spine does.** AD-7 forbids it — "No weighting, no percentage, no severity-weighted composite
anywhere in the artifact" — and Deferred repeats it: "**Any single-number contract strength score,
including severity weighting.** Revisit only with calibration data that makes a weight defensible."

**Assessment.** The refusal is internally coherent and consistent with the brief's own "contract scores
are comparative diagnostics, never absolute verdicts." What is missing is the trace: neither AD-7 nor
the Deferred entry names the brief bullet or the PRD's dual aggregate-plus-per-clause gate that it
overrides, so a PRD-driven implementer building the aggregate half of a dual gate has no signal that it
was removed. This is a traceability defect in an accepted departure, not a wrong decision.

**Change.** One clause in AD-7 or the Deferred entry naming the superseded brief bullet and the PRD
dual-gate mechanic, and stating that the per-clause half stands alone.

---

## 11. MEDIUM — Brief-enumerated mechanics with no AD, or with an AD that only mentions them in Prevents

**Source.** Brief, Independent corroboration (also in ADR-002's Supporting evidence): "dual
aggregate-plus-per-clause gates, **strict undeclared-input detection**, a shared input/output operator
vocabulary, **zero-action negative probes**, disciplined judge conduct, **rubric-authoring rules**,
**canary defect classes**, and trials-not-retries gating."

**What the spine does.** The operator vocabulary lands in AD-4, judge conduct in AD-17, trials-not-
retries in AD-6. The rest do not: *strict undeclared-input detection* appears only inside AD-4's
Prevents ("which would leave strict-mode undeclared-input detection inexpressible in the same terms as
an output assertion") with no Rule requiring a strict mode to exist; *zero-action negative probes* and
*canary defect classes* appear nowhere, and canaries in particular would need a home in AD-9's
qualification rules and AD-12's rotation policy; *rubric-authoring rules* reduce to AD-17's single
"Rubrics are self-contained" clause, which covers what the judge receives but not how a rubric is
authored or validated on compile.

**Change.** AD-4 gains a strict-mode Rule; AD-9 gains canary and zero-action probe classes alongside
the gameability class from finding 4; AD-17 or the compiler AD states which rubric-authoring rules are
compile-enforced.

---

## 12. MEDIUM — ADR-002 supersedes an ADR-001 that does not exist as a document

**Source.** ADR-002 frontmatter: "`supersedes: ADR-001 (dark-factory / isolation-as-differentiator
framing, recorded only in .memlog.md)`". ADR-002 Context: "ADR-001 recorded the original
isolation-boundary design on that premise." ADR-002 Decision 4: "ADR-001's dark-factory framing is
superseded on this point."

**State.** No `ADR-001` file exists in the repository. Its only trace is two bullets in
`architecture-eval-quality-2026-07-22/.memlog.md` — a dot-file, and one that the spine's own convention
treats as rationale storage rather than a published artifact. The dangle has already escaped the
planning folder: `_bmad-output/shareable/eval-quality-adr-002.html` carries both prose references to
ADR-001 with nothing to resolve them.

**Does it matter?** Yes, for two readers. First, an external reader of the eventual ADR set gets a
decision record whose frontmatter asserts a supersession relationship over a document that cannot be
retrieved, which is the one thing an ADR set is supposed to guarantee; the natural reading is that
ADR-001 was deleted. Second, the isolation-as-differentiator framing is the discarded alternative that
explains why AD-16 ships isolation as run-validity rather than as a score input; without it, a future
reader is likely to re-propose it. This is a documentation-integrity finding, not a build risk — no AD
depends on ADR-001's content.

**Cleanest fix.** Write a short `ADR-001-evaluator-isolation-boundary.md` next to ADR-002 with
`status: superseded` and `superseded-by: ADR-002`, its body reconstructed from the two 07-22 memlog
bullets and round 1's `DECISION.md` verdict — one Context paragraph, the original decision, and a
pointer to ADR-002. That preserves the supersession chain and costs a page. The alternatives are worse:
rewording ADR-002's frontmatter to `supersedes: none` falsifies the record, and leaving the pointer at
a dot-file makes the ADR set unreadable outside this working copy. Do it before the shareable HTML is
regenerated. While there, decide whether the ADR set lives permanently in the 07-22 dated folder or
moves to a stable `architecture/adr/` path, since the spine now sits in a different dated folder and
`sources:` points across the boundary.

---

## 13. LOW — The score result is not required to carry the coverage gaps the brief asks it to report

**Source.** Brief, Success Criteria: "the scored result reports per-oracle diagnostics: which defect
classes were exposed, **which oracle categories were missing or ineffective**, and whether gameability
probes bypassed the contract." Same in The Solution: "which oracle categories were missing or
ineffective."

**What the spine does.** AD-7's reported result is "per-oracle outcomes plus outcome-state counts per
oracle category" — that covers *ineffective* (oracles present that did not catch) but not *missing*.
Missing categories are AD-5 coverage gaps, "emit[ted with] the artifact with the gap recorded," i.e.
recorded on the contract artifact at compile time. Nothing requires the scoring result or evidence
artifact to carry them forward, so the brief's per-oracle diagnostic is split across two artifacts with
no stated join.

**Change.** AD-7 states that the reported result carries the contract's recorded coverage gaps
alongside the outcome vector (depends on the category enumeration from finding 3).

---

## 14. LOW — The brief's permissive-dependency constraint has no invariant

**Source.** Brief, Constraints (hard): "Published original code remains Apache-2.0 with **permissively
licensed dependencies**."

**What the spine does.** The Stack table sets "License | Apache-2.0" and the Stack note says "Zod is
the only runtime dependency," which satisfies the constraint today by accident of having one
dependency. No AD or convention binds future dependency licensing, and AD-2's dependency prohibition is
scoped to provider and model SDKs only.

**Change.** One line in the Stack section or the Consistency Conventions dependency row: new
dependencies require a permissive licence, checked in continuous integration alongside the AD-13 schema
drift check.
