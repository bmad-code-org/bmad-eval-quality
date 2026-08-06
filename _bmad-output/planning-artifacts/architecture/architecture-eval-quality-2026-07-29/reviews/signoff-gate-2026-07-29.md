# eval-quality sign-off gate — result

Run 2026-07-29 against spine revision 7 on branch `docs/adr`, which the gate advanced to revision 8.
Four gates, reported pass or fail and nothing else. No round-five review of the spine was performed:
findings below come from a grep, a linter, and two executed tests, never from reading prose for
things to notice.

**Verdict: three of four gates pass, and the sign-off is withheld on Gate D, which has not been
run.** Gate D is the one that cannot be substituted by a document edit, and the handoff's rule is
not to sign off before it exists.

## Gate A — the four round-four findings are closed. PASS

Checked by anchor phrase, never by line number, since round four's line numbers went stale inside
twenty-five minutes.

| # | Finding | Result | Anchor |
| --- | --- | --- | --- |
| F1 | Fail-closed doctrine not closed under its own vocabulary | PASS | AD-4 states resolution as three-valued with the third value "an invariant over operands rather than a rule about particular operators", one closed introduction condition, `not`/`all`/`any` named as propagating with no absorption, terminal under both polarities including `expects-violation`. AD-6 defines `abstained` as where it lands and keeps the state set closed at twelve. AD-33 keeps it distinct from `not-evaluable`. |
| F2 | AD-19 omits three fields other ADs' blocking checks read | PASS | AD-19's rule sentence enumerates a per-operation `method`, `pathTemplate`, and state-change marker, and a per-behaviour observable success criterion, each with a value space. AD-40's "declared per operation under AD-19" is now true. |
| F3 | The epic gate forbids the work that closes the epic gate | PASS | "The calibration spike is exempt from that gate, and it is the next unit of work", with a stated acceptance criterion and "either result closes item 1, because a negative result is the finding". |
| F4 | Rule 6 satisfiable only below one page | PASS | Both routes present. AD-26 makes a reference-set operand legal to `set-membership` and `containment` including inside a quantifier predicate; AD-20 names the injection form as rule 6's satisfaction for a page. |

F1 was the one at risk of a fourth instance patch rather than a class fix. It is a class fix: the
introduction condition is a property of the operand, so a future operator inherits the value without
a further decision, and the absent-collection case is inside the invariant rather than beside it.

## Gate B — the three lint rules exist and pass. PASS

`lint_spine.py` gains three rules. The suite is 45 tests, all passing, each rule proven both ways: it
fires on the class that motivated it and stays quiet on the conforming spelling.

The authoritative copy is now `scripts/spine-lint/`, run as `npm run lint:spine` and wired into both
`validate` and `pr-checks.yml`. That move is part of the gate rather than tidying: the linter lived
only under `.agents/skills/bmad-architecture/scripts/`, all three installed skill directories are
gitignored as local agent tooling, and the gate's whole claim is that these classes become CI
permanently. A rule that exists on one laptop enforces nothing, so the claim was false until the
script was tracked. All four copies are byte-identical.

1. **`code_citation`** — a sentence stating a compile-time prohibition cites a literal code from
   AD-5's table. The registry AD is exempt from its own rule, and the trigger is the consequence
   shape rather than any mention of compilation, so "a compile-time failure is a structural error"
   is not a finding.
2. **`declaration_citation`** — a field an AD says another AD declares appears in that AD. Scoped to
   the declaration-claim shape only, with a proximity bound, plural tolerance, and plain-prose
   enumerations after a claim.
3. **`artifact_path`** — a cited repository path resolves on disk. A token counts as a path only
   with a file extension or an existing first segment, so the designed-but-unbuilt module tree stays
   out of scope.

Two `--fail-on` modes were added so the historical always-exit-zero contract still holds by default
and continuous integration can hard-fail on high severity.

**The rules found three live defects the four review rounds did not**, all of the classes they
police: AD-3, AD-10 and AD-38 each stated that a `web`, `cli` or `mcp` interface fails at compile
time without naming `unsupported-interface-kind`, while a fourth site in Deferred named it. All three
now cite it. A fourth finding, AD-31 reading a channel-roles declaration AD-19 did not enumerate, is
covered under Gate C because that is where its fix belongs.

Proven by mutation against the real spine rather than only against fixtures: re-injecting each of
the three uncoded prohibitions, a faithful reconstruction of F2, and a dangling artifact path each
produces exactly one finding of the expected category, and the unmutated spine produces none.

## Gate C — falsification by execution. PARTIAL: test 1 passes, test 2 misses by one

Full record and artifacts in `gate-c/`.

**Test 1, hand-author one contract for a system unlike the toy API: zero blocking. PASS.** A
cursor-paginated, soft-delete-filtered, 202-then-poll asynchronous export API. Nine points needed a
guess: zero blocking, seven ambiguous, two friction. The two friction points are the architecture
working as designed and cost nothing.

**Test 2, re-derive AD-31's fourteen predicates: 13 of 14 declaration-only. FAIL**, against 11 of 14
in round four. Rule 7 relevance is closed by F2's fix. Rule 3 satisfaction is derivable through
AD-39's `type-violating` matcher, which round four's objection did not consider. Rule 6 satisfaction
became derivable once expected cardinality got a mode. Rule 2 satisfaction remains open and is a
schema-shape decision rather than a repair, recorded as Owed to the calibration re-run item 4 and
gating nothing.

Four of test 1's ambiguities were one class, and it was F2's: a declaration named or cited with no
shape, read by a published predicate. Three are fixed in AD-19. The fourth is item 4.

Per the handoff's pre-commitment, none of this is a round five. Everything fixed was a defect inside
the twenty-two ungated decisions, which is the only condition that justifies a document change, and
the one finding that is a product decision was recorded rather than decided.

## Gate D — the calibration spike. NOT RUN

Cannot pass in this session and cannot be substituted. The spike requires the generator, the
generator is `seal`, and `src/` contains one file. The run itself is a sealed evaluator against a
live system under test, budgeted at half a day.

What was verified is that the instrument is as sharp as round four claimed, by reading the artifacts:

- `cc-h0-03-capsule-crud-search.json` and `…-contract-quality-v2.json` both declare
  `permittedInterfaces: ["api"]`, so v0 compiles them with no MCP decision and no transcription.
- They differ in exactly one of four observable behaviours, B-002. Every other field is byte-equal.
- The delta is **entirely evidence precondition with zero new assertion**. v2 adds "Filter
  composition is observable only when the test data distinguishes a capsule matching every supplied
  filter from capsules matching only a strict subset. Evidence must exercise at least two filters
  together and include both a full match and partial matches." The assertion itself is present in
  both, differently worded.
- The frozen mut2 arm, its adjudicated labels, isolation manifests, action logs and HTTP traces are
  all on disk under `experiments/hypothesis-validation/`.

One observation worth carrying into the spike rather than discovering during it: AD-3's direction is
closed at evidence targets, relation, polarity, scope, and negative domain, and the winning delta is
an evidence precondition, which is none of those. Owed item 1 says as much and names the fix. So a
generator emitting from today's field set has no field to emit the delta from, and the spike's
likely result is a negative one. That is still worth half a day, because a negative result closes
item 1 and because "likely" is not a measurement. It does mean the outcome to plan for is adding the
evidence-precondition dimension, not discovering whether one is needed.

## What the passing set entitles the claim to be

**Entitled.** The compile half is buildable, the authoring discipline is enforceable, and the
twenty-two ungated decisions can ship as a tested package: AD-1, AD-2, AD-4, AD-13, AD-14, AD-15,
AD-18, AD-19, AD-20, AD-22, AD-24, AD-25, AD-26, AD-27, AD-28, AD-29, AD-30, AD-34, AD-35, AD-36,
AD-37, AD-39. Three of four gates pass, the fourth is unrun rather than failed, and the classes that
produced three of four review rounds' most repeated findings are now enforced by a script in the
repository rather than by a reviewer's attention.

**Not entitled.** Any claim that the 0.33 to 1.00 effect survives into this product. That number is
pooled over three cases with separation on two, both confounded at the measurement layer, from a
block whose own preregistered decision was `CONTRACT-DISCIPLINE NOT SUPPORTED` on an unreplicated
control. Gate D is the only thing that begins to connect it to the artifact, and passing Gate D
connects the generator to one behaviour of one case.

**And the scope limit, stated rather than quietly dropped.** This is not "the ADR is what we wanted
to build". That is a product judgement and it is Murat's. What this is: these gates pass, here is
what the passing set entitles him to claim, and here is the epic brief the passing set unlocks.

## Closure appended 2026-07-30

This section preserves the original withheld verdict above and records the separately executed closure
under `HANDOFF-GATE-CD.md`. No fifth architecture review was performed.

**Gate C: PASS.** Spine revision 9 applies the accepted per-operation response descriptor. The
re-authored export contract has zero blocking authoring points. AD-31 re-derives at 14 of 14
declaration-only predicates. Owed-to-calibration item 4 is closed. The historical worked example was
not hand-edited.

**Gate D: PASS.** The missing mut2 arm was reconstructed from base `5b7c34e`, reproduced all five
recorded black-box observations, and retained 17 of 17 passing capsule tests. Three pre-registered arms
ran three valid repetitions each under the same sealed evaluator and reducer of at least two catches
in three:

- hand-written v2 positive control: composed actions 3/3, seeded-defect catches 3/3;
- generated from current AD-3 fields: composed actions 3/3, seeded-defect catches 3/3;
- generated with evidence precondition: composed actions 3/3, seeded-defect catches 3/3.

The predetermined Arm 2 branch applies: calibration item 1 closes, no evidence-precondition field is
added from this spike, and `seal` joins the stage-one epic order.

**Final state: SIGN-OFF PASS.**
