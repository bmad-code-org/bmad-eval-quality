# Round 3 triage — four reviewers against spine revision 4

Kimi K3 (lens A, the measurement) 5 findings, 2 critical. TEA (lens A, the measurement) 5 findings, 2
critical. Kerem (lens C, the boundary) 5 findings, 2 critical. Codex (lens D, the ground, plus an
independent gate) 9 findings, 5 critical. **All four say do not build.**

That is the fourth consecutive do-not-build, and it is the first one that blocks `compile`. Round 2's
conclusion was that the criticals lived in `score`; revision 4 acted on it and sent `compile` to epics.
Round 3 reverses that finding. Three independent reviewers, from three lenses, each blocked the compile
half for a different reason, and none of the three is a wording problem.

Twenty-four findings reduce to **ten root causes**. Six are compile-side, one is score-side, one is
environmental, and two are cross-cutting.

Every mechanically checkable claim was verified before acceptance. **None failed.** The verification log
is at the end.

## What round 3 overturns

ADR-007 sent `compile` to epics on one stated basis: it "is the half that matches the measured
0.33-to-1.00 effect". Three reviewers falsified that sentence independently, by three different routes:

| Route | Reviewer | What it shows |
| --- | --- | --- |
| The corpus does not compile | TEA F1, Codex C3 | Every contract behind the measured effect declares an MCP interface, which AD-5 now blocks |
| The payload does not fit | Kimi F1, TEA F4 | The oracle content that *caused* the effect has no field in AD-3's structure and no seat on the brief |
| The half does not close | Kerem F2, Codex C4 | AD-31 is a stage-one requirement published from an artifact only `score` can regenerate |

Any one of these is enough to withdraw the claim. Together they say the compile/score boundary was drawn
in the wrong place — not that the split was the wrong idea. Every reviewer who commented on the split
endorsed the split and rejected the boundary. Kerem: "The compile/score split is the right decision and I
would not reverse it. But press 8 fails."

## Root causes

### RC-1 — The calibration corpus is uncompilable, and the stage that emits the calibrated artifact is not in stage one

**Critical, compile. TEA F1, Codex C3.**

AD-10 fixes v0 at `api` and fails compilation for `web`, `cli`, and `mcp`; revision 4 added the blocking
AD-5 class that makes this real for the first time. AD-3 requires the generator's templates to be
"calibrated against the experiments' actual disciplined contracts". AD-31 takes interface kind as a
predicate input. AD-38 calls stage one "the half that matches the measured claim".

Verified: all twenty phase-2 contracts declare `"interface": "MCP tool interface, reachable only through
the supplied command"`. The compiler rejects the entire calibration corpus on the first field it reads.

Verified separately, and this compounds it: the generated evaluator-facing prose that AD-3 calls "the
load-bearing artifact" is emitted by `seal`, and AD-38's stage-one list does not include `seal`. Stage one
ends at the Eval Contract, one stage before the artifact whose fidelity the whole calibration argument
turns on.

TEA showed the interface is not incidental. The MCP tool returns unstructured markdown with no
`structuredContent` block, so AD-4's quantifiers — which "range over the elements of a collection pointer"
— have no JSON array to range over. The best available check is a whole-body regex that cannot tell zero
of two rows from one of two. **The per-record discipline rule, one of the five the measured effect is
attributed to, degrades to the spot-check it exists to forbid, on the actual system where it was
measured.**

**Resolution — needs a decision, see Open decisions.** Three exits and the current text implies all
three: bring `mcp` into v0 with a declared channel model for text-shaped responses; or transcode the
measured contracts into API-shaped equivalents and state plainly that the templates are calibrated against
a translation; or withdraw AD-38's "matches the measured claim". Include `seal` in stage one either way.

### RC-2 — AD-3's structured direction cannot carry what made the disciplined arm win

**Critical, compile. Kimi F1, TEA F4. Reached independently from two different corpora.**

This is press 1, and the brief was right to rank it first.

AD-3 closes the direction at five fields: evidence targets, relation, polarity, scope, negative domain.
Prose is generated from them. Author commentary is "carried alongside as documentation that no predicate
reads". Both reviewers extracted the real disciplined oracles and classified what they actually carry
against that field set. Both found the differentiator has no field.

**Kimi, on the only clean single-variable intervention in the whole record.** Verified: the cc-h0-03 v1 and
v2 contracts differ in exactly one oracle, B-002, and the sealed comparison records PASS →
FAIL, `composedFilterRequests` 0 → 2, `detectedDefectIds` `[]` → `["D-001"]`, with
`evaluatorVisibleChange: "observableBehaviors[B-002].oracle only"`. The v2 oracle is three sentences.
Sentence 3 is the behavioural relation and fits AD-3's structure. Sentences 1 and 2 do not:

> Filter composition is observable only when the test data distinguishes a capsule matching every supplied
> filter from capsules matching only a strict subset. Evidence must exercise at least two filters together
> and include both a full match and partial matches.

Those are directives about **what must be true in the world, and what the evidence set must contain, for
the behaviour to be observable at all**. Verified that the same class recurs across the real corpus:
`as-h0-01` B-001 ("a scoped test query known to have more records than fit one page"), `as-h0-02` B-001
("scoped test data known to include at least one record of the excluded category and at least one of an
included category") and B-002 ("compare against the scoped test data's known included-category counts"),
and `cc-h0-01`'s two-account setup. Where it is not in the oracle it is in `testData.setup` — which
AD-16's brief enumeration does not carry to the evaluator at all.

**TEA, on the phase-2 disciplined arm.** Verified: twelve disciplined behaviours against six plain ones.
Six of the twelve carry a **negative-sufficiency** clause; zero of the six plain ones do. Verbatim from
`aa4320098-B-disciplined.json` B-002:

> Acceptance of a non-identifier-shaped value is a finding **even when the eventual response is harmless**,
> because the value has already reached the layer that builds the outbound request.

That is a statement about what conclusion *not* to draw from evidence that looks fine, plus a rationale
naming the downstream consumer and the wrong conclusion. A polarity is not that: polarity says whether the
expression describes correct behaviour; this says a harmless-looking response does not discharge the
check.

The dilemma AD-3 does not acknowledge: either commentary reaches the brief, in which case the free-prose
channel is still open and the scripting bypass is not closed — which is also Kerem F3's route — or it does
not, in which case the generated direction is missing the information kinds that separate the winning arm
from the losing one. AD-3's own Prevents clause names the failure: "a contract with a rigorous expression
and a lazy intent is exactly the contract that failed in the experiments."

Both reviewers were careful to say the structuring decision itself is right and they would not go back.
TEA: "the closed field set was derived from what a predicate can check rather than from what the winning
contracts contained, and nobody has compared the two until now."

**Resolution.** Extend the direction with declared dimensions rather than prose, since both are
structurable: an **evidence-precondition** dimension (world-state population requirements and evidence-set
composition requirements) and an **insufficient-evidence condition** (an expression over the same channels
which, when it holds, does not discharge the oracle), with rationale as a declared consumer-and-consequence
pair rather than free text. Carry them on the brief by extending AD-16's enumeration deliberately. AD-31
treats them as declared-presence channels, not check-corroborated ones — they have no check expression, the
same status coverage declarations already have. Then perform the calibration AD-3 promises, as a re-run
rather than new science.

### RC-3 — Stage one depends on the score half through AD-31

**Critical, compile. Kerem F2, Codex C4. This is press 8, answered mechanically.**

Verified as a closed cycle, citation by citation:

1. AD-38: "Stage one is `compile` against no corpus: it needs AD-3, AD-4, AD-5, AD-13, AD-19, AD-20, AD-22, AD-26, and AD-31, and nothing else."
2. AD-31: the fourteen predicates are "generated and published from the reference implementation", and publication means the table is "exercised against the worked example".
3. Owed item 7: the worked example "must be regenerated from the reference reducer once it exists", and cannot be hand-corrected.
4. The reducer is Owed items 1 through 3, all score-side, all covered by "No epic touches `score` until these close."

It is worse than a scheduling cycle, because AD-31 also backs a **blocking** compile error: AD-5's registry
includes "a direction whose declared evidence targets and relation do not align with its `check` under
AD-31", and a structural error emits no contract artifact. The compile half has a blocking failure class
whose predicate is, by AD-31's own words, not asserted in the spine and published only by running it
against a retracted artifact.

**Resolution.** Break it at AD-31, not at Owed item 7. The predicates are compile-side and need no run
record, no probe, and no outcome state — they read declarations and the direction/`check` pair. Publish
them against a **compile-side contract fixture corpus**, one contract per rule per
relevance-and-satisfaction combination, which stage one can produce on day one. The worked example's
end-to-end chain is the right target for AD-33 and AD-40's tables and the wrong one for AD-31's. Add the
invariant Kerem asks for: no stage-one requirement may cite an artifact produced by `score`.

### RC-4 — The scripting boundary has no reject fixtures, no codes, no width bound, and a third route through the generator

**Critical, compile. Kerem F1, F3, F5; Codex C5, H9.** Revision 4's newest blocking check, attacked from
four directions and failing all four.

**It cannot be calibrated, because the arm it calibrates against never existed.** AD-5 commits the
boundary to being "calibrated against the experiments' three actual contract arms — plain, disciplined, and
scripted — with accept fixtures from the first two and reject fixtures from the third". Verified: the
preregistration defines two arms; a grep for "scripted" across all of `phase2/` returns **zero hits**. The
word exists elsewhere in the project and means something else entirely — a pre-existing agent-eval test
suite belonging to the system under test, used as a comparison baseline — and even in the round where it
was contemplated it was never executed. So the newest blocking check in the compile half has accept
fixtures from two real arms and must invent every reject case, which is exactly "where prose guessed".

The same fact damages the justification chain. AD-39's Prevents clause says "Prescribing the path is what
the scripted condition did, and an independent evaluator choosing its own path is what beat it." Nothing
beat anything; the condition never ran. The prohibition is probably correct on first principles — the
disciplined arm's detections came from evaluator-chosen adversarial probes, which the run records do
support — but it is presented as an empirical result and it is not one. That matters more here than it
would elsewhere, because this architecture's stated method is to put the line "where the measured effect
put it".

**It has no codes.** Codex extracted every lower-kebab literal from AD-5 and found `check`, `cli`, `mcp`,
and `web` — none of them a failure code. Verified independently: the registry that opens "every
compile-time failure has a stable code in this registry" contains sixteen prose descriptions and zero
codes, while the Errors convention requires a stable machine code. Two implementations must invent
incompatible registries.

**Three of its four prohibited shapes have no predicate.** The boundary prohibits "an ordered sequence of
actions to perform, an exhaustive trace, a fixed full path through the interface, or any step whose
ordering the behaviour's meaning does not require". Only AD-39's one-level temporal bound is decidable.
The last one is a judgement about behaviour meaning, which is the exact objection AD-3 raised against
revision 3's alignment rule two decisions earlier.

**The depth bound does not bound width.** Codex built an eight-step plan with one root and seven temporal
children, and 64 independent `write-N`/`read-N` pairs; the AD-39 checker reported zero violations on both.
Every temporal edge is legal and the plan is an exhaustive action inventory.

**And there is a third scripting route, through the generator.** Kerem's, and it starts from a
contradiction that has to be resolved first. AD-3's evidence targets name "the channels and **steps** at
issue" and the prose is generated from that structure by `seal`; AD-16 says the brief carries oracle
intents and "never carries the interaction plan's step identifiers". Both cannot hold. If the generator
emits step references, AD-16's guarantee is void and ordering is readable off the brief. If it strips
them, a direction over two observations of the same operation cannot say which is which — "compare the
title you sent against the title you read back" collapses — which is the ambiguity ADR-006 was written to
remove. Assume the first, and the route opens: declare twelve steps, none deeper than one level, each a
legitimate witness relation; then populate each direction's **negative domain** with an ordered
enumeration of probes. The negative domain is an array, arrays are ordered, the generator walks it in
order. The emitted brief is an ordered list of probes across twelve named steps. No predicate fired,
because the ordering is an emergent property of array order plus template concatenation, introduced after
the last check ran.

**Resolution.** Publish the exact codes with triggering predicates, emitting stage, and one fixture each.
Reduce the boundary to what has a predicate and publish it as an executable graph check covering depth,
width, shared anchors, disjoint pairs, and exhaustive operation inventories. Move the audit point to the
generator's output, which is where AD-3 says the load-bearing artifact is, with the negative domain emitted
as an unordered set. Replace the unperformable calibration with authored adversarial reject fixtures, one
per prohibited shape. Resolve the AD-16 contradiction explicitly by giving the generator a reference
vocabulary that is not the step identifier — "the response you obtained when you sent an invalid
identifier" rather than `malformed-write`. Stop citing the scripted arm as evidence. Kerem is right that
the reference-vocabulary design belongs in an ADR.

### RC-5 — AD-40 is unimplementable as cited, and its determinism hedge rests on a false premise — but its shape is proven right

**Critical, score. Kimi F2, F3, F5; TEA F2, F5.**

Two reviewers built AD-40's mapping and ran it. The good news first, because it is substantial and it is
execution-backed: **the fix direction is right.** Kimi ran six scenarios over the spike chain and found
`missed` reachable, the revision-3 indistinguishable pair separated, false-witness fabrication rejected,
and uncited findings preserved. TEA attacked the forward direction specifically and could not break it —
the `defect`-finding restriction correctly scores the real C2 A-plain rep-1 case, where the evaluator filed
a traversal acceptance as a *confirmation*, as `missed`. Round 2's worst finding is genuinely closed in
principle.

Three things block the implementation.

**The signature cannot be written in the grammar AD-40 cites.** Settled by construction, three independent
ways. The author cannot know the identifiers — AD-26 roots every pointer at `/interactions/{stepId}/`,
stepIds are declared by the contract, and AD-40 requires the signature's author to be the probe seeder who
must never see the contract. Invented identifiers bind to nothing — verified that observations carry
`observationId`, `operationId`, and `callInputs` and no stepId at all, 0 of 5 in the worked record. And
stepIds are contract-relative while a corpus is not, so a signature rooted in contract A's `write` and
`read-back` resolves nothing against contract B's `update-note` and `verify-note`. Kimi's fix: root the
signature in **transport identity** — interface kind, operation as method plus path template, manifested
channel, and a discriminating condition over a probe-side selector grammar. Method and path are declared
per operation and are contract-independent, so the scorer resolves the signature against any contract's
operation inventory mechanically.

**The mapping has no declared operand on the finding side.** AD-23 requires a finding to carry a type and
to cite its oracle and probe; AD-24's run-record inheritance lists findings, action-log reference, resource
use, invalidation reason, recommendation, and per-finding confidence. Nothing requires a finding to carry
the evidence the signature must be matched against. Verified that the instrument's own detection rule
needed exactly that: "an arm detects a case's defect in a repetition when it returns a `defect` finding
whose **quoted evidence contains the observable signal** recorded for that case, and its verdict is FAIL or
CONCERNS." AD-40 supplies the observable signal and omits the quoted evidence. TEA ran three matcher
variants over all 19 real repetitions; the compound matcher agreed with the recorded `detected` field on
**7 of 19**, and every failure has the same shape — the sealed records preserve an orchestrator paraphrase
rather than the evaluator's quotation.

**AD-40 is also silently downstream of two recorded-open items.** The spike's seeded defect manifests only
in a *pair* of observations — its write response is perfect by design and only the read-back discriminates
— but AD-40's summary ("the interface and operation it inhabits, the observable channel it manifests in")
is single-observation shape. The pair condition needs temporal ordering and captured values, which are Owed
items 2 and 3. The one score-side question revision 4 "commits to rather than defers" is blocked on two
questions it defers. Kimi confirmed the coupling by execution: her mapping had to use array position, and
S0's `caught` flips to `missed` under reversed observation order.

**And the hedge's stated reason is false.** ADR-007 and AD-40 both justify declining determinism on the
grounds that "the instrument behind the measured effect used blinded human adjudication after sealing".
Verified: it did not. Phase 2's detection rule is the mechanical containment rule quoted above;
`phase2/harness/score.mjs` computes nothing and reads a pre-existing `detected` field written by the
orchestrator; a grep of all of `phase2/` for adjudication, blinding, raters, and inter-rater agreement
returns nothing. Blinded adjudication is real but belongs to the **earlier H0 round, on a different
system** — and even there, the cc-h0-03 comparison records its reviewer as "orchestrating Test Architect
under the disclosed no-Reviewer-B deviation", so the blinding was deviated from in the one case being
cited. Two experiments have been merged into one sentence, and the sentence is the reason half the product
is not epic-ready.

**Minor and cheap:** the worked example contains no probe artifact at all. The run record cites
`probeId: "P-001"` and nothing in the repository defines P-001, so AD-40's signature has no fixture to land
in when the chain is regenerated. Verified: six files, none of them a corpus entry.

**The two reviewers disagree on what to do about determinism — see Open decisions.**

### RC-6 — Grammar gaps: the reference set has no address, `covers-by-key` is not reconciliation, and principals cannot be bound

**High, compile. Codex C2, Kimi F4.** These are press 5 and part of press 7, reached without a dedicated
lens-B reviewer.

AD-19 requires declared reference sets so rule 6 can reconcile expected against actual. AD-4 gives
`covers-by-key` two collection pointers. AD-26 permits pointers rooted only at an interaction step.
Verified: a contract-owned reference set has **no legal address** — `/reference-sets/items` and
`/contract/referenceSets/items` are both rejected by the closed AD-26 grammar, and only
`/interactions/{stepId}/...` is accepted. The operator added to make rule 6 writable still cannot address
the declaration added to make rule 6 satisfiable.

Separately, the relation as stated is one-way. "Every element of `expected` has a distinct element of
`actual` agreeing on the named keys" is an injection, not a bijection, so it holds when `actual` also
contains unexpected rows or duplicate padding *after* every expected row has been matched. AD-4 claims it
"detects both omission and duplicate-padding"; verified by direct implementation that it detects omission
only.

And Kimi found the principal gap. The two critical-severity cross-user behaviours in the real corpus —
`cc-h0-01` B-002 and `cc-h0-03` B-004, both "act as user A, read as user B, must be denied or absent" —
need a step bound to a principal that is neither a literal (AD-19 forbids credential values in
declarations, and tokens are provisioned at runtime) nor a prior step's output (accounts are test data,
provisioned outside the observation stream). AD-19's new `header` channel names the channel and supplies no
value binding. Owed item 3's captured-value matcher is scoped to "an earlier step's scalar output", so the
two highest-severity oracles in the calibration corpus stay inexpressible even after it closes as recorded.

**Resolution.** Add a typed operand variant for a named contract reference set, kept distinct from
interaction pointers. Define reconciliation as a bijection, or require cardinality equality alongside the
one-to-one key match, with missing, duplicate, unexpected, duplicate-key, and empty-set negatives. Widen
Owed item 3's recorded fix shape to include **test-data bindings** — named principals and resources
declared in `testData` and bound by the harness at runtime, with the same cycle-free, type-checked rules as
captured values.

### RC-7 — The npm control still fails open on the real CI path, and the declared graph fails its own licence gate

**Critical, ground. Codex C1 and H6. Both reproduced independently in this triage.**

Revision 4's npm fix was round 2's headline environmental catch. It does not hold, and the reason is that
the control and the production path are different code paths.

Reproduced here on npm 11.16.0 with `min-release-age=7` active:

```
STEP 1  fresh resolution of @biomejs/biome@2.5.6 (0.59 days old)
        npm error code ETARGET
        npm error notarget No matching version found for @biomejs/biome@2.5.6 with a date before 7/22/2026

STEP 3  npm ci --ignore-scripts from a lockfile containing that same package
        added 2 packages, and audited 3 packages in 515ms
        node_modules/@biomejs/biome/package.json -> "version": "2.5.6"
```

`min-release-age` filters fresh resolution. It does not reject a young package already recorded in a
lockfile, and `npm ci` is what both workflows run. A direct-resolution canary — which is what the Stack
describes — passes while the production path installs the package the policy exists to block.

Verified separately that the declared range is also wrong: `npm view npm version engines` returns 12.0.1
with `"node": "^22.22.2 || ^24.15.0 || >=26.0.0"`. npm 12.0.1 satisfies the Stack's `>=11.15.0` and does
not support the declared Node floor of 22.20.0.

And the licence gate fails on the declared pins. Verified by registry query: `vitest@4.1.10` accepts
`vite ^6 || ^7 || ^8`, so a fresh install selects `vite@8.1.5`, whose **non-optional** dependencies include
`lightningcss ^1.32.0`, and `lightningcss@1.33.0` declares `MPL-2.0` — outside AD-25's closed allowlist,
across twelve platform entries. Verified that `vite@7.3.1` has no lightningcss dependency at all, so
Codex's proposed exact override is a working fix. The runtime graph is clean: Zod alone, as the Structural
Seed says.

**Resolution.** Pin one audited npm version exactly rather than a range, and assert exact equality before
every install. Add a lockfile publication-age audit over the full registry graph before `npm ci`, using the
CI clock. Make the canary commit a deliberately young lock and run the ordinary job path, not a
direct-resolution shortcut. Use a real `npm ci` for the git canary, since `--dry-run` returned a false
success. Set `allow-remote=none`. Decide the Vite version in the Stack and run the licence procedure over
the full development graph on both matrices. Expanding the allowlist to MPL-2.0 is a separate architecture
and legal decision, not a build fix.

### RC-8 — `additionalProperties: false` on every object rejects the arbitrary JSON the artifacts require

**High, conventions. Codex H7.**

The Consistency Conventions require `additionalProperties` false on every object and AD-13 says every
schema this project writes is strict — which is also the argument revision 4 used to correct AD-13's
output-mode reason. Applied literally to a recursive JSON value, it rejects every non-empty object.
Verified against the pin: `z.toJSONSchema(z.json())` emits an object branch of
`{"type":"object","propertyNames":{"type":"string"},"additionalProperties":{"$ref":"#"}}` — a
*schema-valued* `additionalProperties`. Replace it with `false` and `{"title":"hello"}` fails, `{}` passes,
and `[{"id":1}]` fails because its element is also a JSON value.

This is not hypothetical. Verified that the worked run record's observations carry
`"responseBody": {"ok": true, "note": {...}}` — arbitrary caller JSON — and the worked contract carries
literal operands. Equality and deep-equality operands and every ingested response body need an open value
container.

**Resolution.** Scope closed-object enforcement to artifact control objects. Define and name the recursive
`JsonValue` as an intentional open value container with schema-valued `additionalProperties`, and make the
generator's strict-object audit distinguish control shapes from value maps. Add non-empty object literals
and nested arrays of objects to AD-13's differential fixtures.

### RC-9 — AD-10's whole-response inequality is neither necessary nor sufficient for input sensitivity

**High, pre-flight. Codex H8.** Round 2 moved this check from per-interface to per-operation, which was
right and which TEA re-verified as clean. The predicate underneath it is still wrong.

AD-10 sends two distinct inputs and asserts the responses differ. Codex ran the three smallest cases: a
genuinely input-sensitive operation returning identical 404s for two distinct missing identifiers **fails**;
the same operation passes on a different input pair; and an input-blind operation whose only varying field
is a volatile `requestId` **passes**. The verdict depends on arbitrary probe values and incidental response
data, and AD-11 already has the volatile-pointer concept this check does not use.

**Resolution.** Require declared typed sensitivity witnesses per input-bearing operation, a response
projection excluding declared volatile fields, and an expected AD-4 relation over the projected responses.
Remove whole-response inequality as the universal predicate. Add positive and input-blind negative
fixtures.

### RC-10 — The architecture states its central measurement as settled fact, and the block's own decision was NOT SUPPORTED

**High, cross-cutting. TEA F3, with TEA F5 folded in as the same class of defect.**

AD-3's Prevents clause and ADR-007 both cite the 0.33-to-1.00 effect as established. Verified by reading
the experiment's own scorer output at `phase2/results/FINAL-GATE-TABLE.txt`:

```
  G3 zero false FAIL from Arm B on fixed controls : FAIL (1 false FAIL of 1 controls)

Decision: CONTRACT-DISCIPLINE NOT SUPPORTED
Valid repetitions scored: 19
```

The rates are real — pooled 0.33 against 1.00, four of five preregistered gates passed. Three facts
qualify them, all verified: the effect rests on two of three cases, since C1 detected 3/3 in both arms;
both of those cases carry a recorded measurement-layer confound, `"confound":"stub-baseline-gap"` on all
six C2 repetitions and `"confound":"stub-completeness"` on all six C3; and the gate that failed did so on a
single unreplicated control, where the preregistration asked for one per arm per case.

None of this is concealed — `PHASE2-RESULTS.md` discloses all three unprompted, and its reading that the
failure was a harness defect rather than a contract misjudgement is defensible. The finding is about the
architecture, which cites the number without its qualifications in the one AD whose rule text depends on
it, and which additionally attributes the number to a blinded adjudication that belongs to a different
experiment (RC-5). For a product whose purpose is making evaluation quality falsifiable, its own central
claim should carry its own qualifications wherever it justifies a decision.

**Resolution.** One sentence in AD-3 and one in ADR-007 recording the pooled basis, the two-case
separation, the confounds, and the NOT SUPPORTED decision on an unreplicated control. Delete the
blinded-human claim or scope it explicitly to the H0 round. Name the block-2 replication as a dependency
wherever a catch rate is calibrated against this block rather than assuming it.

## What I verified that changes the picture, and no reviewer stated

**The decisive prototype is not blocked by the MCP problem.** RC-1 and RC-2 look coupled — the calibration
corpus is uncompilable, and the calibration is what would settle RC-2 — but they are not.

Verified that the real corpus splits by interface kind:

| Corpus | Contracts | Interface | Compilable by v0 |
| --- | --- | --- | --- |
| phase 2 (the 0.33→1.00 block) | 20, three cases × two arms | all `mcp` | no |
| H0 `as-h0-*` | 2 | `mcp` | no |
| H0 `cc-h0-*`, including the v1/v2 pair | 3 | `api` | **yes** |

Kimi's F1 evidence — the only clean single-variable oracle intervention anywhere in the record, and the
cheapest decisive experiment available — comes from `cc-h0-03`, which declares `permittedInterfaces:
["api"]`. **The generator calibration re-run can be performed today, on an API-shaped contract, without
first deciding the MCP question.** Both lens-A reviewers named that re-run as their highest-value
prototype and neither noticed it was already unblocked.

Two corollaries. Kimi's F1 argues against the 0.33-to-1.00 claim using evidence from a different
experiment than the one that produced it; the conflation does not damage the finding, because TEA reached
the same payload class independently inside phase 2, but the triage should not repeat it. And the prior-art
schema this architecture ratifies already enumerates `["web","api","cli","mcp"]` and the real corpus uses
`mcp` in 22 of 25 contracts — so v0's api-only scope is a narrowing of the prior art, which strengthens
RC-1 beyond what either reviewer argued.

## Where the criticals live

| Root cause | `compile` | `score` | ground |
| --- | --- | --- | --- |
| RC-1 calibration corpus uncompilable, `seal` outside stage one | yes | — | — |
| RC-2 direction cannot carry the payload | yes | — | — |
| RC-3 stage one depends on score via AD-31 | yes | yes | — |
| RC-4 scripting boundary uncalibratable and unpredicated | yes | — | — |
| RC-5 AD-40 unimplementable as cited | partly | yes | — |
| RC-6 reference set, `covers-by-key`, principals | yes | — | — |
| RC-7 npm fails open, licence gate fails | — | — | yes |
| RC-8 closed objects reject arbitrary JSON | yes | yes | — |
| RC-9 AD-10 sensitivity predicate | yes | — | — |
| RC-10 the measurement is cited without its qualifications | yes | yes | — |

Round 2's table put five root causes in `compile` and six in `score`, with every unresolvable one in
`score`. Round 3 inverts it: **six of the ten are compile-side, and four of those are critical.**

## Reviewer disagreements worth recording

Two, and both are genuine forks rather than one reviewer being wrong.

**AD-40's determinism.** Kimi says commit to the deterministic witness-match, and backs it with the
strongest single result of the round: run over the real v2 trace, the mechanical signature found exactly
one witness — `A-013`, leaking `"CC-H0-03 Eval Capsule Second"` — which is byte-identical to the decisive
action and leaked record the human adjudication named. Her conclusion is that the hedge mislocates the
non-determinism: witness-matching is mechanical, and the honest residual is citation provenance, which
belongs in AD-32's caller-attested trust class alongside AD-12's remediation cap. TEA says keep the hedge
but restate the reason, because no run exists whose records preserve the evidence a deterministic mapping
would need — 7 of 19 agreement, every failure a paraphrase — so determinism is unvalidated rather than
unachievable.

**What the mapping matches against.** TEA wants verbatim quoted evidence with its channel as a
schema-required field on every `defect` finding. Kimi's implementation matched on cited observation
tuples instead. The worked example already carries `observationIds` on its findings, and Owed item 2's
recorded fix shape already promises selected observation identifiers on every outcome — so the
observation-citation route is closer to what the architecture is already building toward, while the quoted-
evidence route is what the instrument's own detection rule used and what would let a mapping run against
the existing 19 repetitions.

## Coverage gaps in the round itself

Lens B was assigned and nobody took it. Presses 4, 5, and 7 have no dedicated reviewer: the fail-closed
quantifier ergonomics question is **entirely unreviewed**, and press 5 and press 7 were only reached
incidentally by Codex's independent gate (RC-6) and Kimi's principal finding. Nobody authored a contract
against the changed schema for a system unlike the toy API, which was the round's second-ranked activity.
Both lens-A reviewers took the same lens; the four reports cover A, A, C, and D.

Press 4 remains open: whether AD-4's empty-collection `for-all` resolving false forces boilerplate onto
every collection oracle, or fails a correct system whose collection is legitimately empty. TEA and Kimi
both explicitly declined it as another lens's press.

## Verification log

Every mechanically checkable claim in the four reports was re-run here before acceptance. **None failed.**

| Claim | Method | Result |
| --- | --- | --- |
| No scripted arm exists | `rg -ic scripted phase2/` | 0 hits; preregistration defines two arms |
| Every measured contract is MCP | read all 20 phase-2 contracts | all declare the identical MCP interface string |
| Block decision was NOT SUPPORTED | read `FINAL-GATE-TABLE.txt` | confirmed, G3 FAIL on 1 of 1 controls |
| Confounds on the two separating cases | `rg -o '"confound":"..."' results/*.jsonl` | 6 × `stub-baseline-gap` (C2), 6 × `stub-completeness` (C3) |
| No blinded adjudication in phase 2 | grep for adjudicat/blinded/rater/masked | nothing outside `node_modules`; detection rule is mechanical containment; `score.mjs` reads a pre-set `detected` |
| cc-h0-03 v1→v2 differ by one oracle | structural diff of both contracts | only B-002 differs |
| That change caused the outcome | read the sealed comparison record | PASS→FAIL, `composedFilterRequests` 0→2, `detectedDefectIds` []→[D-001], `evaluatorVisibleChange: oracle only` |
| Population directives recur | read all five H0 contracts' oracles and `testData` | present in `as-h0-01`, `as-h0-02`, `cc-h0-01`, `cc-h0-03` |
| 12 disciplined vs 6 plain behaviours | count across the three phase-2 cases | 4 and 2 per case, confirmed |
| Negative-sufficiency clause is real | read `aa4320098-B-disciplined.json` B-002 | verbatim, and absent from the plain arm's B-002 |
| npm 12.0.1 satisfies `>=11.15.0` and excludes the floor | `npm view npm version engines --json` | `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0` |
| `min-release-age` fails open through `npm ci` | built a young lock, ran `npm ci` under the policy | ETARGET on resolution, **clean install from lock** |
| Licence gate fails on declared pins | registry query of the vitest→vite→lightningcss chain | `vite@8.1.5` hard-depends on `lightningcss ^1.32.0`, `MPL-2.0` |
| Vite 7.3.1 is a working fix | registry query of its dependencies | no lightningcss |
| AD-5 contains no codes | extract kebab literals from the AD | only `check`, `cli`, `mcp`, `web` |
| Reference sets have no address | read AD-26's closed grammar against AD-4's operands | only `/interactions/{stepId}/...` is rootable |
| `covers-by-key` is an injection, not a bijection | read the stated relation | extra and padded rows pass after all expected are matched |
| Observations carry no stepId | read the worked run record | `observationId`, `operationId`, `callInputs`; 0 of 5 carry a stepId |
| No finding-side evidence field is required | read AD-23 and AD-24 | findings cite oracle and probe; no evidence operand |
| Worked example has no probe artifact | list the directory | six files, no corpus entry defining P-001 |
| Closed objects reject arbitrary JSON | `z.toJSONSchema(z.json())` on the pin | object branch uses schema-valued `additionalProperties` |
| Run records carry arbitrary JSON | read the worked record's observations | `responseBody` is open caller JSON |
| The AD-31 cycle | follow AD-38 → AD-31 → Owed 7 → Owed 1–3 → the no-epic rule | closed cycle, and it backs a blocking AD-5 class |
| The AD-16/AD-3 contradiction | read both rules | brief carries generated intents; intents name steps; brief must not carry step identifiers |
| Repository baseline still passes | `npm run validate` | typecheck, Biome, `check:docs` 36 files, Vitest all pass |

One reviewer claim was **refined rather than accepted**: Kimi's F1 attributes the cc-h0-03 result to the
same experiment as the 0.33-to-1.00 number. They are different experiments. The finding survives on TEA's
independent phase-2 evidence, and the distinction matters because it is what makes the calibration re-run
available today.

## Dispositions applied in revision 5

Decision taken: do to `compile` what ADR-007 did to `score`. Seven root causes with concrete named fixes
are closed; RC-2 is recorded open with its two downstream consequences; **no epic touches either half.**
Recorded as [ADR-008](../ADR-008-compile-half-owed-to-calibration.md), which amends ADR-007 inline in three
places rather than superseding it. Four decisions were the user's: the shape of the revision, staying
api-only, committing AD-40's mapping to determinism while recording it unvalidated, and requiring both
finding-side operands rather than choosing between the reviewers.

| Root cause | Disposition | Where |
| --- | --- | --- |
| RC-1 calibration corpus uncompilable, `seal` outside stage one | **Accepted, split.** v0 stays `api`-only; AD-3 now states it is calibrated against API-shaped transcriptions rather than the instrument, which is a weaker and true claim. `seal` joins stage one. MCP support is deferred with the text-channel design question named rather than implied. The unwritten transcriptions become an open item | AD-3, AD-38, Deferred, Owed-calibration item 3 |
| RC-2 direction cannot carry the payload | **Accepted, recorded open.** Not settled in prose; AD-3 now says explicitly that its field set is not known to be sufficient. Fix shape named — evidence-precondition dimension, insufficient-evidence condition, both on the brief and both exempt from the alignment predicate — with the gate being a re-run rather than a review | Owed-calibration item 1, AD-3 |
| RC-3 stage one depends on score via AD-31 | **Accepted and closed.** AD-31 publishes against a compile-side contract fixture corpus instead of the worked example, and AD-38 gains the invariant that no stage-one requirement may cite a score-produced artifact | AD-31, AD-38, AD-30 |
| RC-4 scripting boundary uncalibratable and unpredicated | **Accepted and closed, all four routes.** AD-5 gains a seventeen-code table with triggering predicates and citing ADs; the boundary reduces to a published graph predicate bounding width as well as depth; reject fixtures are authored rather than drawn from an arm that never ran; and AD-16 closes the generator route with a derived reference vocabulary and unordered negative domains. The scripted-arm citation is deleted from AD-5 and AD-39. The template design that remains is downstream of RC-2 | AD-5, AD-16, AD-39, AD-30, Owed-calibration item 2 |
| RC-5 AD-40 unimplementable as cited | **Accepted and closed, with one part recorded open.** Signature rerooted in transport identity; the mapping commits to a deterministic witness match and the false blinded-adjudication premise is deleted; residual trust moves to AD-32's caller-attested class; findings carry both operands; `exercised` defined for AD-7. The match is recorded **committed but unvalidated** until a run preserves quoted evidence, and the dependency on Owed items 2 and 3 is stated in the AD | AD-40, AD-23, AD-7, AD-32, ADR-007 amendment |
| RC-6 reference set, `covers-by-key`, principals | **Accepted and closed, except principals.** AD-26 gains a typed reference-set operand kept distinct from interaction pointers; `covers-by-key` becomes a bijection, since the stated injection detects omission only. Principal binding widens Owed item 3 rather than closing, because it is a different decision than the one recorded there | AD-26, AD-4, Owed item 3 |
| RC-7 npm fails open, licence gate fails | **Accepted and closed.** npm pinned at 11.18.0 exactly with exact-equality assertion, a lockfile publication-age audit over the resolved graph before `npm ci`, canaries on the ordinary job path, a real `npm ci` for the git canary, and `allow-remote=none`. Vite pinned at 7.3.1 by override; AD-25's scan runs over the full resolved graph | Stack, Conventions, Structural Seed |
| RC-8 closed objects reject arbitrary JSON | **Accepted and closed.** The convention scopes closed objects to control objects and names `JsonValue` as the one open value container with schema-valued `additionalProperties`; AD-13's audit distinguishes them by name | Conventions, AD-13 |
| RC-9 AD-10 sensitivity predicate | **Accepted and closed.** Declared typed sensitivity witnesses per input-bearing operation over a volatile-excluded response projection, replacing whole-response inequality | AD-10, AD-30 |
| RC-10 the measurement cited without its qualifications | **Accepted and closed.** AD-3 carries the pooled basis, two-case separation, confounds, and the NOT SUPPORTED decision wherever the effect is cited, and names the block-2 replication as a dependency. The blinded-adjudication claim is deleted from AD-40 and corrected inline in ADR-007. The PRD's top-line build decision carries the same qualification | AD-3, AD-40, ADR-007, PRD |

Nothing was rejected. One reviewer proposal was **declined in favour of the alternative the user chose**:
bringing `mcp` into v0, which TEA and Codex both recommended as the honest answer. It is deferred with the
reason stated — a text-channel model is grammar work of the same size as the rest of this revision, and the
decisive calibration is performable on the `api` contracts without it.

Two reviewer disagreements were **resolved by taking both sides**: AD-40's determinism, where the rule is
committed per Kimi and the validation dependency is recorded per TEA; and the finding-side operand, where
cited observation identifiers and verbatim quoted evidence are both schema-required.

A third structural principle was added to the spine, in the same form as revision 4's: **an AD may not cite
calibration against evidence that does not exist.** Three did — AD-3, AD-5, and AD-40 — and all three were
introduced by revisions that had passed their own review.
