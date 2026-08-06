---
id: ADR-009
title: The adversarial gate's determinacy corrections, and the read-back brief joins the owed set
status: accepted
date: 2026-07-29
amends: ADR-006, ADR-008
---

# ADR-009: The adversarial gate's determinacy corrections, and the read-back brief joins the owed set

## Status

Accepted 2026-07-29. Enforced by spine revision 6: AD-5 gains three failure codes and back-citations from
every commanding AD, AD-40 gains a response-side operand and an operand precedence rule, AD-6 admits
`not-applicable` for an unexercised probe, and AD-16's derived reference vocabulary is withdrawn for
temporal pairs into **Owed to the calibration re-run** item 2. Amends ADR-006's interaction-plan claims and
extends ADR-008's owed set.

## Context

Revision 5 was written to answer round 3, and it did. Two adversarial reviewers were then run against
revision 5 itself, under one instruction: construct two implementations that obey every rule to the letter
and still produce different bytes from the same input. Between them they produced seventeen such pairs,
every one of which reproduced against the spine text. That is a different class of finding from the four
previous rounds, which mostly found claims that were false. These findings are about claims that are true
and insufficient — rules that determine nothing.

Two of the seventeen were introduced by revision 5 rather than inherited, and both are the same mistake in
different places: a fix written into one paragraph without re-reading the paragraph it depends on.

**AD-40 enumerated a discriminating condition it then required to do something the enumeration forbids.**
The grammar was operation, input binding, and optional ordering — three selectors over what was *sent* —
and the qualification rule two paragraphs later demanded the same condition "name the response channel or
at least two channels". Under the grammar as written a condition can only say which call was made, so a
probe seeding a 500 on a malformed title is satisfied by the observation in which the system correctly
returned 400. A finding about an unrelated defect that cites that observation resolves `caught`. That is a
catch rate of 1.00 read off the evidence that the system behaved correctly — which is the exact failure
this AD was created to close, arriving through the field created to close it. Read the other way, no
condition can name a channel at all, every signature fails corpus qualification, and AD-6 invalidates
every run.

**AD-5's registry was cited by nothing.** The rule says an AD imposing a compile-time check cites the
literal code. Counting all seventeen revision-5 codes across the document, thirteen occurred exactly once —
inside the table. The `Cited by` column asserted citations the named ADs did not contain, and three
commanded checks had no code at all.

The remaining findings are inherited underspecification the previous rounds did not reach: structural
containment left undefined over quantifier-bound variables, `covers-by-key` left undetermined over empty
collections one paragraph after the identical hazard was fixed for quantifiers, input-binding literals and
matchers sharing an untagged value space, path templates compared as strings, and the two required operands
of a finding left unranked against each other.

One finding is not underspecification and cannot be fixed by writing more precisely.

## Decision

Seven corrections close, and one opens.

**1. The discriminating condition is a selector plus a response predicate, and the predicate reuses AD-4.**
The selector stays AD-39's tagged grammar duplicated corpus-side; the predicate is an expression in AD-4's
closed operator vocabulary over AD-26's response channels, rooted at the selected observation rather than
at a step identifier. Reusing AD-4 rather than defining a probe-side relation language avoids maintaining a
second set of degenerate cases, and AD-4's are already fixed and fixtured. Probe-side rooting preserves the
contract independence that ADR-008 established.

**2. Cited identifiers govern the witness match; quotation audits it.** AD-23 requires both operands and
revision 5 never ranked them, which left a finding citing `o1` while quoting text from `o2` resolving
`missed`, `caught`, or invalid depending on which sentence of AD-40 an implementer read. The match resolves
over identifiers alone. Quoted evidence that appears in no cited observation invalidates the run as an
AD-32 declared-versus-observed inconsistency, because a finding whose own operands disagree is evidence
about the reporting path rather than about the system. Quotation-containment survives for one purpose,
re-deriving detection from records predating the identifier requirement, and such a result is recorded as
reconstructed rather than measured.

**3. A probe is exercised only by the evaluator, and an unexercised probe resolves `not-applicable`.**
Harness baselines and calls the record shows never completing do not count, because counting them made a
probe the evaluator never touched score `missed` and fail a strict build — punishing the contract for the
evaluator's path choice, which ADR-006 removed one level down. `not-applicable` is chosen over `unreached`
because AD-21 treats `unreached` as an evidence condition about a *declared step*, and over leaving the
check stateless because AD-6's state set is closed. AD-6's waiver restriction on `not-applicable` is
amended to name this second case explicitly rather than widened.

**4. Operation resolution erases parameter names, and colliding operations fail compilation.** A corpus
signature on `/notes/{id}` binds a contract declaring `/notes/{noteId}`, since parameter naming is the
contract-local choice ADR-008 moved the signature off. Two operations colliding after erasure fail under
the new `duplicate-operation-signature` rather than binding by inventory order.

**5. Containment is computed after quantifier substitution.** The literal reading rejects the canonical
per-record oracle, which is the shape AD-4 admitted quantifiers for.

**6. `covers-by-key` fails closed on its degenerate cases**, on the doctrine AD-4 already states one
paragraph above: two empty collections resolve false rather than vacuously true.

**7. Literals and matchers are tagged.** `{ "literal": … }` and `{ "matcher": … }`, because the untagged
form gave the string `type-violating` no unambiguous spelling and propagated into AD-40.

**8. Open: a direction cannot distinguish two observations of one operation without disclosing their
order.** AD-39 makes the temporal clause part of a step's selection predicate and AD-16 derives the
evaluator-facing phrase from that predicate. Rendering the clause puts the ordering on the brief, which is
the leak AD-39 relies on AD-16 to prevent; omitting it collapses the baseline read and the read-back into
one phrase, which is the ADR-006 ambiguity AD-16 exists to resolve; reorder-invariance forbids a positional
escape. Read after write is the only case AD-39 admits the clause for and one of AD-20's seven rules, so
this is not an edge. It is recorded in **Owed to the calibration re-run** item 2 with the shape of a fix —
a relational phrasing naming the data dependency without the sequence, or an explicit finding that
read-back costs a bounded ordering disclosure — and AD-39's no-ordering claim is limited to briefs whose
oracles need no temporal disambiguation.

## Consequences

**The gate condition does not move.** ADR-008 already put both halves behind the calibration re-run, so
nothing here changes what is build-ready: nothing was, and nothing is. What changes is whether the re-run's
output would have meant anything. Under revision 5 the catch rate was computable as 1.00 by construction,
which is the measurement the re-run exists to produce.

**Item 2's scope grows and its difficulty is now visible.** It previously held template design and the
brief-side scripting audit, both of which read as unwritten work. It now holds a case with no known
satisfiable answer, and the honest reading is that the reference vocabulary needs its own ADR after the
re-run rather than before it.

**Two of seventeen were self-inflicted, and the pattern is worth naming.** Both came from editing one
paragraph without re-reading its dependency, which is also what produced revision 5's AD-13 contradiction
and its stale "first epic" references. Revision-scale edits to this document need a dependency pass, not
just a rubric pass.

## Alternatives considered

**A separate probe-side relation language for the discriminating condition.** Keeps corpus and contract
grammars independent, which has some appeal given how hard ADR-008 worked to decouple them. Rejected
because independence was needed for *identifiers*, not for relations: a second vocabulary means a second
set of degenerate-operand answers, and AD-4 spent two revisions getting the first set right.

**Quotation-primary matching.** Attractive because quotation is what makes a match auditable and what the
historical records carry. Rejected because it lets a finding score a catch off an observation it never
claimed to rely on, which is a weaker version of the fabrication AD-32 already declares as a trust class.

**Fixing the read-back vocabulary in place, by deriving from operation and input binding only.** Rejected
as a decision because it is a claim about prose an evaluator reads, and this architecture has spent three
rounds learning that such claims are measured rather than asserted. Recorded as owed instead.
