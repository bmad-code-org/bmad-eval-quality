---
title: PRD → Spine input reconciliation
subject: ARCHITECTURE-SPINE.md (architecture-eval-quality-2026-07-29)
source: prds/prd-eval-quality-2026-07-17/prd.md
date: 2026-07-29
scope: current PRD scope only (VFR-1..VFR-8, Current Decision and Execution Authority, Non-Goals §5)
---

# Input reconciliation: PRD → ARCHITECTURE-SPINE

Method: every concrete, testable obligation in VFR-2..VFR-8, in the numbered current decisions, and in the current Non-Goals section was checked against the AD blocks, the Consistency Conventions, the Stack, the Structural Seed, the Capability → Architecture Map, and the Deferred list. Only gaps, weakenings, and contradictions are recorded. Four decisions were treated as deliberate and excluded from the contradiction hunt: no execution of evaluator/agent/judge/SUT, no agentevals dependency in v0, no aggregate strength number, and Zod as schema source of truth.

Findings are ordered by severity, then by how mechanically the omission bites.

## Critical

### 1. The forbidden-input list is one item where the PRD names five

**PRD (Current Product Workflow, para. 4):**

> "The execution agent sees that contract and black-box interfaces. It does not see the original spec, source code, repository, builder conversation, or implementation logs."

**Spine:** AD-16's Rule says only "The contract's forbidden-input list *always contains the original spec*." Four of the five named prohibited inputs — source code, repository, builder conversation, implementation logs — are unmentioned anywhere in the spine. A contract whose forbidden-input list contains exactly one entry satisfies AD-16 while permitting an evaluator brief that references the repository or the builder conversation. Since AD-16 is the only place the sealed brief's contents are constrained ("the contract, scoped resource references, and permitted interfaces only"), and "scoped resource references" is undefined, nothing stops a repository path from being a scoped resource reference.

This is the isolation property VFR-3 exists to deliver and item 4 of the current decisions calls "a held control and a delivery property".

**Should change:** AD-16's Rule must enumerate the full mandatory floor of the forbidden-input list (original spec, source code, repository, builder conversation, implementation logs) as a compile-time structural requirement, and must say that "scoped resource references" may not resolve to any of them.

### 2. A missing isolation manifest passes; only a present-and-violating one invalidates

**PRD, VFR-3:**

> "Every run records an isolation manifest. Any prohibited-input access invalidates the run."

**Spine:** AD-16's Rule covers only the second sentence: "A non-null violation in the isolation manifest invalidates the run." There is no rule that the manifest must exist, be schema-valid, and be complete before a run can be scored. Absence therefore reads as absence of violation. AD-6 handles exactly this asymmetry for checks — "any *absent* required check prevents PASS" — which shows the spine knows the pattern and did not apply it to the manifest.

The consequence is the inverse of the guarantee: an unsealed run scores normally and is reported as sealed.

**Should change:** AD-16's Rule needs "an absent, unparseable, or incomplete isolation manifest invalidates the run" with the same force as a non-null violation, and `core/ingest` must be named as the enforcement point.

### 3. `judge_error` is not one of AD-6's eight states, and nothing stops it from producing PASS

**PRD, VFR-5:**

> "an unparseable judge response is a distinct judge-error result, never coerced into a low score"

> "Four outcomes stay separate and are never pooled: a behavioral trial, an evaluator or judge error, an infrastructure failure, and an environment pre-flight failure."

**Spine:** AD-6 closes the state set — "every required check resolves to *exactly one of* `caught`, `missed`, `passed_clean_control`, `false_positive`, `abstained`, `oracle_error`, `infrastructure_error`, `not_applicable`" — and lists what prevents PASS: "Any `missed`, `abstained`, `oracle_error`, or absent required check prevents PASS." AD-17 then introduces a ninth value that AD-6 forbids: "an unparseable response is `judge_error`". Two defects follow. A judge-backed required check has no legal outcome state under AD-6, and `judge_error` is absent from the PASS-prevention list, so a run in which the judge broke on every rubric criterion can still clear the gate. Reading `judge_error` as a synonym for `oracle_error` fixes the gate but violates VFR-5's "never pooled".

**Should change:** AD-6's enumeration must include `judge_error` as a distinct state and add it to the PASS-prevention list; AD-17 should reference AD-6's enumeration rather than introducing a state.

## High

### 4. Rubric authoring rules landed nowhere

**PRD, VFR-2:**

> "Rubrics follow fixed authoring rules: anchored scales, named failure-mode penalties, bounded length, and no questions a sealed evaluator cannot answer from observable evidence."

Item 9 of the current decisions lists "rubric-authoring rules" among the concrete mechanics the PRD adds on top of the corroborating evidence.

**Spine:** AD-3 governs oracles (`check` plus `intent`) and says nothing about rubrics. AD-5's three enforcement classes never mention rubrics. AD-17 constrains the judge's *conduct* and touches rubrics only as "Rubrics are self-contained, so the judge receives the rubric and the evidence and not the product spec" — which is one of the four rules restated, and the weakest to check. Anchored scales, named failure-mode penalties, and bounded length are not enforced by anything, and the "answerable from observable evidence" rule is a compile-time reachability question that no AD assigns to the compiler. The Identifiers convention assigns forms to behaviours, oracles, probes, and waivers, and omits rubrics and rubric criteria entirely, so a rubric criterion is not even addressable in a finding.

**Should change:** a rubric-authoring AD parallel to AD-3 (rubric schema, four authoring rules, which class each violation falls into under AD-5), plus a rubric and criterion identifier form in the Identifiers convention row.

### 5. AD-5 names no structural error class except an incomplete waiver

**PRD, VFR-2:**

> "**Structural errors fail compilation.** Missing requirement or risk linkage, no observable success criterion, an oracle that references evidence unreachable through the permitted interfaces, a malformed operator expression, or an undeclared mandatory input."

**Spine:** AD-5's Rule states only the *consequence* — "a structural error fails compilation and emits no contract artifact" — and then defines exactly one concrete class, the incomplete waiver. AD-3 adds one more ("An oracle without a `check` is a structural compilation error"). The remaining five named classes are ungoverned, and two of them are the substantive compiler work: **evidence reachability through the permitted interfaces** is a cross-field check between the oracle's `check` tree and the contract's declared interfaces, and **missing requirement or risk linkage** has no identifier convention at all (the Identifiers row covers `B-`, `O-`, `P-`, `W-` and never says how an external requirement or risk id is carried). Independently-built units will each invent their own answer to what fails compilation, which is precisely the divergence a spine exists to stop.

**Should change:** AD-5's Rule must enumerate the five PRD structural classes; AD-4 or a new AD must fix how an oracle's `check` is proven reachable through declared interfaces; the Identifiers convention needs a requirement/risk linkage form.

### 6. Strict mode exists only inside a Prevents clause

**PRD, VFR-2:**

> "A strict mode fails on undeclared inputs, catching behavior the interface silently ignores."

Plus, as a structural compile error: "an undeclared mandatory input". Item 9 lists "strict undeclared-input detection" as a required mechanic.

**Spine:** the only occurrence is AD-4's Prevents — "which would leave strict-mode undeclared-input detection inexpressible in the same terms as an output assertion". By the spine's own structure, Prevents is not binding; the Rule is. No Rule establishes that a strict mode exists, what it is a mode *of* (compile, score, or both), how it is selected, or that it is the default. AD-14 does not give it a CLI expression, and the Configuration convention ("no environment-variable fallback, no implicit config-file discovery") forbids the obvious ways it might otherwise arrive.

**Should change:** AD-4 or AD-5 needs a Rule sentence establishing strict mode, its default, and its selection path; AD-14 needs the corresponding flag-to-argument translation.

### 7. Gameability probes are absent, so "a strong contract rejects both" cannot be expressed

**PRD, VFR-7:**

> "Two probe classes seed defects: defect probes, where the behavior is wrong, and gameability probes, where the behavior looks compliant while dodging the oracle's intent. A strong contract rejects both."

**Spine:** the word gameability appears nowhere. AD-9 governs probe *provenance* (historical versus controlled mutation) and AD-8 governs sealing, but no AD carries the defect/gameability *class* on the probe schema. AD-7 reports "per-oracle outcomes plus outcome-state counts per oracle category" — "oracle category" is undefined and is not the probe class. Consequently the dominance comparison in AD-7 cannot express the PRD's asymmetric bar: a contract that catches every defect probe and no gameability probe can dominate one that does the reverse, which contradicts "rejects both". This is the one place where the deliberate no-aggregate decision (c) increases rather than decreases the need for an explicit rule, because dominance is now the only comparison available.

**Should change:** AD-9 must add the probe-class field, and AD-7's dominance rule must be defined per probe class so that non-detection of a gameability probe cannot be dominated away.

### 8. Confidence, the evaluator's own recommendation, and human-on-the-loop routing have no home; CONCERNS has no derivation

**PRD, VFR-5:**

> "The evaluator emits traceable findings, confidence, observed evidence, and a PASS / CONCERNS / FAIL recommendation. Low-confidence or ambiguous findings route to a human-on-the-loop decision rather than silently blocking or passing the change."

**Spine:** three separate omissions. `confidence` appears nowhere in any AD or convention, so the ingest schema has no field for it. The evaluator's *own* PASS/CONCERNS/FAIL recommendation is never ingested — AD-6 and AD-7 derive the verdict solely from outcome states, and AD-7 says "The gate verdict derives only from the hard rules in AD-6 plus zero `false_positive` on clean controls", which leaves no path by which CONCERNS is ever produced. The only mentions of CONCERNS in the whole spine are the casing rule in the Data and formats convention and AD-16's statement that a prohibited input "never becomes a CONCERNS verdict". And the human-on-the-loop route — the explicit alternative to "silently blocking or passing" — is not modelled at all, so low-confidence and ambiguous findings currently have exactly the two dispositions the PRD forbids.

**Should change:** AD-6 or a new AD must define the CONCERNS derivation, the confidence field on findings, and a distinct terminal disposition for human-on-the-loop routing that is neither PASS nor a silent block.

### 9. "The contract contains no prescribed action sequence" is not enforced

**PRD, VFR-2:**

> "The contract contains no prescribed action sequence."

Reinforced by VFR-4: "Existing deterministic and pre-canned tests remain baseline evidence. They do not prescribe the evaluator's path."

**Spine:** no AD carries this prohibition. AD-4 legitimately includes `ordering` in the closed operator set (the PRD lists it too), but nothing distinguishes an ordering assertion over *observed output* from a prescribed sequence of *actions the evaluator must take* — which is the difference between an oracle and a script, and the difference the adaptive-evaluation claim in VFR-4 rests on. The Capability Map dismisses VFR-4 with "caller-owned; the sealed brief is the whole interface", which is true of execution but says nothing about what the brief is forbidden to contain. Since AD-16 defines the brief's contents positively and the compiler has no rule here, a contract that ships a step list compiles and seals cleanly.

**Should change:** AD-3 or AD-5 must make a prescribed action sequence a structural compilation error, and AD-16 must exclude it from the sealed brief.

### 10. The scoring-version convention contradicts AD-11 and makes VFR-7's versioning unenforceable

**PRD, VFR-7:**

> "Contract, probe corpus, environment fixture, evaluator configuration, and scoring policy are versioned together, and a reported score names that version."

**Spine:** AD-11's Rule makes the scoring version a derived composite — "a composite scoring version names the tuple of contract schema version, corpus digest, fixture digest, evaluator configuration digest, and scoring policy digest … Changing any tuple member produces a new scoring version." The Identifiers convention then states the opposite: "Runs and scoring versions are **caller-supplied opaque strings**." If the caller supplies an opaque string, the package cannot detect that a tuple member changed and cannot enforce the "changing any member produces a new scoring version" rule, which also silently defeats AD-12's immutability rule ("a sealed set is immutable for its scoring version") — a caller can reuse the same string across a mutated corpus. Two independently built units will disagree on whether `score` computes the scoring version or accepts it.

**Should change:** the Identifiers convention row must be corrected so the scoring version is computed from the AD-11 tuple, with only the run id caller-supplied; AD-12 should state that immutability is checked against the computed digest.

### 11. Zero-action negative probes are not expressible as a distinct thing

**PRD, VFR-2:**

> "Zero-action negative probes express what the system must not do at all."

Item 9 lists "zero-action negative probes" as a required mechanic, and cites the corroborating evidence that "prohibited behavior requiring explicit negative checks" is a real failure dynamic.

**Spine:** unmentioned. AD-4's operator set includes `absence`, which is a necessary primitive but not the requirement: a zero-action negative probe is a probe kind whose expected observation is that *nothing happened*, and it interacts with AD-6's outcome states in a non-obvious way (a clean control and a satisfied zero-action probe are both "nothing happened" but must not collapse into the same state). AD-5's coverage class mentions "No negative probe where one is relevant" only via AD-3's Prevents, and never distinguishes the zero-action case.

**Should change:** AD-9 (probe schema) must carry the zero-action probe kind, and AD-6 must say which outcome state a satisfied zero-action probe yields so it is distinguishable from `passed_clean_control`.

### 12. The standing prohibition on judging reasoning prose is nowhere in the spine

**PRD, Non-Goals §5 (current):**

> "No judging chain-of-thought prose as a scored signal."

**Spine:** absent. AD-17 governs judge conduct in detail — one call, strict parsing, self-contained rubrics, deterministic truncation — and never says what the judge may not be asked to score. Combined with finding 4 (no rubric authoring rules), nothing prevents a rubric criterion from scoring the evaluator's or the agent's stated reasoning, which is the single named prohibition the PRD carried forward from the archived design and justified with three citations. AD-3's `intent` field ("prose written for the sealed evaluator and never parsed") shows the spine is careful about prose that must not be evaluated mechanically; the reverse prohibition is the one that matters here.

**Should change:** AD-17's Rule needs an explicit prohibition on reasoning-prose criteria, enforced at rubric compile time under AD-5.

## Medium

### 13. Coverage-gap classes and their relevance conditions exist only in a Prevents clause

**PRD, VFR-2:**

> "**Coverage gaps score down without blocking.** No negative probe where one is relevant, no whole-body read for a structured response, spot-checking where per-record behavior matters, or a missing sibling cross-check where a sibling actually exists."

Preceded by the reason it is hard: "because no single pattern applies to every UI, CLI, scalar response, or single-operation contract."

**Spine:** AD-5's Rule states the consequence only ("A coverage gap emits the artifact with the gap recorded and never blocks") and names no class. The four classes appear once, inside AD-3's *Prevents*: "leaving the compiler unable to detect a missing whole-body read, negative probe, per-record verification, or sibling cross-check". Rationale placement aside, a Prevents clause is not a rule, and the harder half is missing entirely: each class is conditional ("where one is relevant", "where a sibling actually exists"), so the compiler needs a notion of contract context — interface kind, response shape — that no AD or schema row introduces. Without it, every coverage rule is either always-on and noisy or never-on and useless.

**Should change:** AD-5's Rule must enumerate the four coverage classes and their relevance conditions, and the contract schema must carry the interface-kind and response-shape facts those conditions read.

### 14. The Stack raises the Node floor above the PRD's adopted packaging term

**PRD, VFR-8:**

> "Packaging follows the terms already recorded under Archived Developer-Product Requirements, adopted here as current: TypeScript, **Node >= 20**, ESM, Apache-2.0, unscoped npm name `eval-quality`, permissively licensed dependencies only."

**Spine:** the Stack table sets "Node.js runtime floor | >=22". This is a current-scope packaging term, adopted explicitly rather than archived, so the spine narrows the supported adopter set without recording that it is doing so. It is a small change with a real consequence for the CLI's stated audience of "CI jobs, GitHub Actions, PR-review and unit-test bots", where Node 20 lines still exist.

**Should change:** either the Stack floor drops to >=20, or the PRD's VFR-8 packaging term is amended in the same pass; the divergence should not survive as an undocumented Stack row.

### 15. The dependency-licence policy is not an invariant

**PRD, VFR-8** adopts as current: "permissively licensed dependencies only", detailed in the adopted terms as "permissively licensed only (MIT / Apache-2.0); no copyleft or proprietary dependencies".

**Spine:** the Stack table records "License | Apache-2.0" for the package itself and notes "Zod is the only runtime dependency", which happens to satisfy the policy today. No AD or convention binds future dependency additions. AD-2 forbids provider and model SDKs specifically, for a different reason. Given the PRD's publication gate turns on an intellectual-property question, a licence invariant is cheap and load-bearing.

**Should change:** add a licence clause to AD-2's Rule or a Dependencies row to the Consistency Conventions, with CI enforcement alongside the AD-13 schema drift check.

### 16. The per-release breaking-change call-out is unassigned

**PRD, VFR-8:**

> "Pre-1.0 versioning applies, and breaking changes to the contract schema, the evidence artifact, or the CLI command, flag, and exit-code contract are called out on every release."

**Spine:** AD-11 covers version *identity* (per-artifact integer schema versions, package SemVer, composite scoring version) and binds "published surface", but its Rule says nothing about release-time disclosure. The three surfaces the PRD singles out are precisely the three the spine version-controls, so the obligation is one sentence from being covered and is currently absent. AD-13 already establishes the CI-enforcement pattern that would make it checkable (a committed artifact compared against a fresh generation).

**Should change:** extend AD-11's Rule with the disclosure obligation for those three surfaces, and state whether it is CI-checked in the manner of AD-13.

### 17. Required contract content is partly unaccounted for

**PRD, VFR-2:**

> "the contract author converts the product spec into a versioned Eval Contract containing behavior goals, requirement and risk identifiers, oracles and rubrics, permitted black-box interfaces, **test-data and cleanup rules, safety limits, budgets, and evidence requirements**."

**Spine:** behaviours, oracles, and waivers have identifier forms; AD-3 covers oracles; AD-16 covers permitted interfaces. Test-data and cleanup rules, safety limits, budgets, and evidence requirements appear nowhere in the spine. The no-execution decision (a) explains why eval-quality does not *enforce* a budget or a safety limit, but not why the contract schema need not *carry* them or why the compiler need not validate them — and AD-16 makes the contract the payload of the sealed brief, so these are exactly the fields that must reach the caller who does execute. Safety limits in particular are the contract's only channel for constraining a live evaluator against a real system.

**Should change:** AD-3, or a contract-schema AD, must name the full required field set from VFR-2 and say which class a missing field falls into under AD-5.

### 18. Baseline evidence from existing deterministic tests has no representation

**PRD, VFR-4:**

> "Existing deterministic and pre-canned tests remain baseline evidence. They do not prescribe the evaluator's path."

**Spine:** `core/ingest` takes "evaluator result + isolation manifest -> validated observations" and nothing else. There is no baseline-evidence input and no provenance field distinguishing an observation produced by a pre-canned test from one produced by an evaluator-chosen action. The PRD's own success criteria depend on that distinction, and the product's central finding is about what an evaluator detects *beyond* the baseline, so collapsing the two loses the signal that motivates the product.

**Should change:** the ingest schema needs an observation-provenance field (baseline versus evaluator-chosen), governed by AD-6 or the ingest side of AD-17, and the Capability Map's VFR-4 row should stop being governed by AD-2 alone.

### 19. Scoring-time `not_applicable` has no justification requirement

**PRD, VFR-7:**

> "`not_applicable` requires a named rule, an explicit rationale, and a machine-checkable context condition where one exists."

**Spine:** AD-5 imposes the analogous four-part requirement on compile-time waivers ("the named rule, an explicit rationale, a machine-checkable context condition where one exists, and the recorded approval … a waiver missing any of them is a structural error"). AD-6 lists `not_applicable` among the eight outcome states and attaches no requirement to it. If every scoring-time `not_applicable` must trace to a compiled `W-001` waiver, the spine should say so; as written, the scorer may emit a bare `not_applicable` and drop a required check out of the gate without a recorded reason.

**Should change:** AD-6's Rule should require every `not_applicable` outcome to reference a waiver that satisfied AD-5, or restate the justification triple.

## Low

### 20. Two small droppings from otherwise-landed rules

**PRD, VFR-7 (probe provenance):** "A controlled mutation must record its source and operator, its target artifact, the expected observable failure, a baseline pass, a mutated fail, and verified **rollback or cleanup**." AD-9 renders this as "verified rollback" and drops the cleanup alternative — which is the branch that applies when a mutation cannot be reverted in place, and connects to the unaccounted-for "test-data and cleanup rules" in finding 17.

**PRD, current decisions item 9:** "canary defect classes" is listed among the concrete mechanics the requirements add. The spine has no notion of a canary class — a probe whose non-detection indicts the corpus or the harness rather than the contract. AD-10 covers the environment side of that concern and AD-9 the provenance side, so if canaries are intentionally out of v0 they belong in Deferred rather than absent.

**Should change:** AD-9's Rule restores "or cleanup"; canary defect classes are either given a probe-class value alongside finding 7 or recorded in Deferred.

---

## Not reported, and why

The four deliberate decisions named in the review brief (no execution of evaluator/agent/judge/SUT and the consequent VFR-6 and VFR-8 corrections, no agentevals dependency in v0, no aggregate strength number, Zod as source of truth) were verified as coherently handled rather than reported as contradictions. Archived FR-1..FR-12 content, archived engine decisions, and the archived assumptions index were excluded as superseded. Absent rationale in AD blocks was not treated as a finding.
