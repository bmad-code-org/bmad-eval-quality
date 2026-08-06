---
name: eval-quality
type: epic-brief
altitude: epic
source: ARCHITECTURE-SPINE.md revision 9
scope: the epic-ready compile-and-seal half after Gate C and Gate D closure
status: ready for epics and stories
created: '2026-07-29'
---

# Epic brief — eval-quality compile half

Input to `bmad-create-epics-and-stories`. It covers the epic-ready compile-and-seal half in the
order the sign-off gate established, and states for each epic what done means, what
fixtures it must produce, and what it must not touch. It is not a design document: every decision it
implements is already written in the spine, and where the spine leaves a shape open this brief says
so and names the epic that closes it by construction.

**The twenty-two ungated decisions.** AD-1, AD-2, AD-4, AD-13, AD-14, AD-15, AD-18, AD-19, AD-20,
AD-22, AD-24, AD-25, AD-26, AD-27, AD-28, AD-29, AD-30, AD-34, AD-35, AD-36, AD-37, AD-39.

**Added by Gate D.** AD-3, AD-16, and AD-38's `seal` path now join the stage-one order. The generated
current-fields arm matched the hand-written positive control at three catches in three valid
repetitions, so no evidence-precondition field is added from this spike.

**Not in scope, and why.** AD-6, AD-7, AD-9, AD-11, AD-12, AD-21, AD-23, AD-32, AD-33, and AD-40 are
score-side or depend on the reference reducer, and no epic touches `score` until its seven owed items
close. AD-31's fourteen compile-side predicates remain in scope and publish from the contract fixture
corpus rather than the historical worked example.

## Gate D prerequisite — completed 2026-07-30

The missing local-only mut2 arm was reconstructed from base `5b7c34e`, disclosed as a reconstruction,
and verified against all five recorded black-box observations before trials. The spike pre-registered
three arms and the reducer of at least two catches in three valid repetitions.

All three arms — hand-written v2, generated from AD-3's current fields, and generated with an
evidence-precondition dimension — issued composed-filter actions and detected the defect in 3 of 3
valid repetitions. The predetermined Arm 2 branch applies: Owed item 1 is closed, the generator is
the product, and `seal` joins the order below. The spike remains throwaway evidence, not the reference
implementation.

## Epic 1 — Zod schemas and the published JSON Schema export

Implements AD-13, AD-19, AD-25, AD-26, AD-27, AD-36, AD-39, and the operator arity half of AD-4.

First because it is the only epic that settles field shapes by construction. Every ambiguity the
sign-off gate's hand-authoring found that is not already fixed is an authoring coin flip that
disappears the moment one schema exists, and settling them in prose first would be a review round in
a schema's clothes. The three to settle here, each recorded in `reviews/gate-c/FINDINGS.md`:

- whether an oracle carries polarity once or twice, given AD-3 puts it on the direction and AD-33 on
  the check, and AD-3's alignment predicate compares them;
- whether `set-membership`'s set operand admits a `{ "literal": [...] }` array as well as a
  reference-set operand, which a four-value state enum needs and no reference set should hold;
- whether requirement and risk identifiers live per behaviour, as `missing-requirement-linkage`
  requires, or in a contract-level linkage array as the worked example carries. The code as written
  decides this one; the schema has to agree with it.

Done when: every artifact schema is defined once in Zod and exported byte-exactly to self-contained
JSON Schema Draft 2020-12; the constraint-injection table has one entry per constraint Zod cannot
express, operator arity among them with a `minItems` alongside `items: false` per `prefixItems`
tuple; the differential check comparing Zod acceptance against published-schema acceptance over
generated inputs reports zero disagreements; the keyword-mutation check removes each generated
keyword and at least one fixture fails for each. Continuous integration runs the rejection suite,
the drift check, the differential check and the mutation check.

Must not: hand-maintain the failure-code enumeration beside AD-5's table. It is generated from it.

## Epic 2 — seal and deterministic brief emission

Implements AD-3, AD-16, AD-38, and the brief-facing half of AD-39.

Done when: `seal` deterministically generates evaluator prose from AD-3's current direction fields;
the brief carries behaviours, generated directions, interfaces, scoped resources, budgets, and safety
limits while excluding commentary, interaction plans, and step identifiers; negative-domain members
and every semantically unordered declaration render in canonical order; reordering steps and negative
domains produces a byte-identical brief; the emitted-brief scripting audit has a stable AD-5 code and
rejects prose exceeding its declared probe-step bound.

The temporal read-back fixture must resolve the remaining derived-reference collision. Prefer a
relational dependency phrase that names what must be compared without prescribing sequence. If no
candidate survives the authored adversarial fixtures, record a bounded ordering disclosure and amend
AD-39 explicitly rather than hiding the choice in a template. The Gate D generated-current-fields
prose is an accept fixture; its 3-of-3 detection result is calibration evidence, not production code.

Must not: call a model, execute an evaluator, expose contract step identifiers, or copy the throwaway
Gate D generator into the package.

## Epic 3 — the AD-4 evaluator, three-valued

Implements AD-4 in full, including the closed operator vocabulary, the connectives, the quantifiers,
`covers-by-key` as a bijection, and the three-valued resolution F1 introduced.

Done when: resolution returns `true`, `false` or `insufficient-evidence`; the third arises on exactly
one condition, an operand denoting an empty collection, including a pointer the response descriptor
types as a collection which resolves `absent`; propagation is total over `not`, `all` and `any` with
no absorption, `all` keeping a genuine false decisive and `any` deliberately weaker than logical
disjunction; the value is terminal under both polarities including `expects-violation`; every node's
resolution and, where it fired, the introduction condition, are recorded in the evidence. Evaluation
is total and never short-circuits.

Fixtures this epic owes: the soft-delete pair that motivated the invariant, both spellings, over a
populated collection, an empty collection and an absent collection —
`for-all(page, absence(@/retractedAt))` and `not(for-any(page, existence(@/retractedAt)))` must agree
on all three, which is the whole point of the invariant and the thing three revisions got wrong.
`covers-by-key` fixtures cover positive, missing, duplicate, unexpected, duplicate-key, and empty-set.

Must not: map `insufficient-evidence` onto an outcome state. `abstained` is AD-6's and AD-6 is
score-side. This epic stops at resolution and records it.

## Epic 4 — the addressing grammar and the compiler's structural checks

Implements AD-26, AD-5's registry as code, AD-28, AD-34, and AD-39's plan predicate.

Done when: every operand is an RFC 6901 pointer rooted at `/interactions/{stepId}/` over the closed
channel vocabulary, with `call-inputs` rooted on one of the four transport channels; the reference-set
operand is the single-keyed `{ "referenceSet": id }` and legal in exactly three positions;
containment for AD-3's alignment is computed after quantifier substitution rather than over surface
text; every AD-5 code is emitted by `compile` carrying the artifact path that produced it; the
scripting boundary is the published executable graph predicate over depth, width, shared anchors,
disjoint pairs and exhaustive operation inventories, failing under `plan-exceeds-scripting-bound`;
stages are pure plan-and-reduce pairs with one orchestration layer awaiting ports.

Fixtures this epic owes: AD-5's authored adversarial reject fixtures, one per shape the graph
predicate rejects, since the arm revision 4 cited never ran. The eight-step single-root chain and the
sixty-four independent `write-N`/`read-N` pairs are both required rejects, because revision 4's
depth-only check passed both.

Must not: widen the pointer root to sometimes mean the contract. That is the ambiguity AD-26 exists
to prevent, and the reference-set operand is typed and distinct for exactly this reason.

## Epic 5 — the discipline-rule predicates and their contract fixture corpus

Implements AD-20's seven rules and all fourteen predicates of AD-31, over AD-19's
declarations.

Done when: fourteen of fourteen predicates run as decision procedures over declarations only, with no
run record, no probe and no outcome state; each is exercised against a hand-authored contract corpus
carrying one contract per rule per relevance-and-satisfaction combination; the table is emitted by
the implemented predicates and regenerated in CI rather than maintained beside them; a coverage-gap
record names the relevance predicate that fired and the satisfaction predicate that failed.

The fourteen, and the fields each reads, are derived in `reviews/gate-c/FINDINGS.md`. Rule 2
satisfaction covers the required keys in the per-operation response descriptor belonging to the
operation each addressed step invokes. Rule 6
satisfaction branches on `expectedCardinality.mode`: `exact` requires `covers-by-key` against the
reference set, `page-bounded` and `at-most` require the injection form. Rule 3 satisfaction reads
AD-39's `type-violating` matcher rather than the direction's negative domain. Rule 7 relevance reads
the per-operation state-change marker.

Must not: publish the table against the worked example. That is the closed cycle round three found —
the worked example is regenerated only from the reference reducer, and the reducer is score-side.

## Epic 6 — ports, pre-flight, and the library and CLI surface

Implements AD-1, AD-2, AD-10's pre-flight half, AD-14, AD-15, AD-18, AD-22, AD-24, AD-29, AD-30,
AD-35, AD-37.

Done when: `core/` is pure and tested only with in-memory fixtures and faked ports, at 90 percent
statement and branch coverage, with no filesystem I/O outside a temporary directory and no network
beyond AD-37's own loopback fixture server; the probe port is a policed default-deny network boundary
with AD-35's logical interface identity and no URL, host or port in a contract; rubrics compile under
AD-22's checked rules with a zero-rubric contract compiling clean; artifacts are created once and
never edited in place, carrying a parent digest and a revision count; the CLI and library surface
export what AD-14 and AD-15 name.

Fixtures this epic owes: AD-10's sensitivity witnesses, positive and input-blind negative, per
operation shape, including a safe read whose only input is a path parameter. Composite-digest and
cross-language canonicalization golden vectors including the exact decimals this repository's own
artifacts carry.

Must not: reserve an engine-reuse seam. AD-2 puts VFR-6 out of v0 with no seam, deliberately.

## Two standing constraints on every epic

**The permutation fixture family is not optional.** Score a fixed run record repeatedly and assert
byte-identical evidence, then score it again with the observation array permuted and assert identical
outcomes. Burn-in and the no-quarantine rule would have passed three times over the ambiguous
observation matching round two found, because an arbitrary tie-break is stable within a process.

**The spine linter runs in CI with all three rules enabled**, as `npm run lint:spine`, already wired
into `validate` and `pr-checks.yml`. Three of four review rounds' most repeated finding classes are
now a script, and the value of that only survives if it runs without being asked. Its authoritative
copy is `scripts/spine-lint/`, in the tracked tree, because the three installed copies under
`.claude/`, `.agent/` and `.agents/skills/` are gitignored as local agent tooling and cannot run in
CI — the rules were mirrored there first, and a rule that exists on one laptop enforces nothing. Keep
all four byte-identical.

## Where this ships first

`couture-cast`. Battle-testing in a personal open-source repository first is the established pattern,
and reproducing the eventual deployment shape is the part that matters — otherwise the exercise
hardens a configuration nobody deploys. Publication is separately blocked on the IP question and that
is not this brief's problem to solve.
