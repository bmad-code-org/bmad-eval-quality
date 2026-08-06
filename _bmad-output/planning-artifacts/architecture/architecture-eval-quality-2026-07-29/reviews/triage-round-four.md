# Triage — round 4, the final review

One reviewer, four findings, and the first verdict in four rounds that is neither "do not build" nor "build
as scoped": **build `compile` after a named minimum set of edits, and make the next unit of work the
half-day calibration spike rather than an epic.** The review is `REVIEW-kerem-final.local.md`, held locally.

Unlike previous rounds this one was worked interactively. The reviewer wrote acceptance criteria for each
finding *before* any edit was made, then checked the applied edits against his own criteria across three
passes. That is recorded here because it changed the outcome twice: two of the three passes found the fix
had closed the named instance and left the class open, which is the defect the review is about.

## Verification

All four findings were reproduced against the committed revision-6 spine before any edit.

| Finding | Check | Result |
| --- | --- | --- |
| F1 — fail-closed doctrine not closed under `not` | AD-4 resolves `for-any` over empty to false; `not` is in the connective set | Confirmed. `not(for-any([]))` is true, so the natural English spelling of every soft-delete, tenant-isolation and leak oracle certifies over no evidence |
| F2 — AD-19 omits three fields others read | Read AD-19's enumeration against AD-40, AD-20 rule 7, AD-5's blocking code, AD-10 | Confirmed. No method, no path template, no state-change marker, no observable success criterion, while four decisions read them and two assert AD-19 declares them |
| F3 — the gate forbids its own exit | Read the gate sentence against the closing rule and AD-38 | Confirmed. Item 1 closes by implementing the generator, the generator is `seal`, AD-38 puts `seal` in stage one, which the gate blocks |
| F4 — rule 6 unsatisfiable on a page | Searched the spine for pagination vocabulary; read `covers-by-key`'s cardinality clause against AD-26's legality restriction | Confirmed. Zero occurrences of "pagination", "cursor", "page" or "paginated"; the bijection rejects any page and every alternative route is closed by a different sentence |

## Dispositions

**F1 — closed by an invariant, not a fourth patch.** Resolution becomes three-valued. `insufficient-evidence`
is introduced by one operand property — a collection operand that is empty, including a collection-typed
pointer resolving `absent` — never by an operator-specific rule, so every operator now in the closed set and
every operator a future version adds inherits it. It propagates through `not`, `all` and `any` without being
absorbed, is terminal under both polarities, and resolves to `abstained`, a behavioural failure that
prevents PASS. The `count-tolerance` escape hatch is struck in both places it appeared, because it
reintroduced the `notes: []` defect it was prescribed to avoid. Downstream: AD-6 defines `abstained` for the
first time, AD-33 reads three values and keeps `not-evaluable` distinct, AD-10 fails pre-flight on it, AD-40
fixes what it means for signature manifestation. `absent` on a *scalar* pointer is deliberately excluded and
AD-26's rule stands, because a missing field is a detected defect and one of the three measured cases.

**F2 — closed by four fields inside the enumeration.** Per-operation method as a closed verb set,
path template with `{name}` parameter syntax stated, a per-operation state-change marker, and a
per-behaviour observable success criterion distinguished from the nominated success indicator. All four
citing sites were re-read and reworded rather than left pointing at the list.

**F3 — closed by an explicit carve-out.** The gate sentence is untouched and the spike is exempted from it
by name, with its subject, acceptance criterion, half-day budget, throwaway footing, and three
non-commitments. AD-38 states that the spike is not a stage. Either result closes item 1, since a negative
result is the finding.

**F4 — closed by widening the operand.** A reference-set operand is legal as `set-membership`'s or
`containment`'s set operand, including inside a quantifier predicate, so the injection form is writable for
a page. The bijection is unchanged as the completeness property for a collection returned whole, and AD-20
loses the word "only".

## What the reviewer caught in the fixes themselves

Recorded because it is the same pattern three times and the pattern is the point.

1. First pass: AD-4's `absent` introduction condition was qualified by "where the operator's meaning depends
   on evidence being present" — a judgement about operators inside an invariant written to eliminate them —
   and it collided with AD-26's unamended rule, giving the missing-field case two dispositions.
2. Second pass: narrowing fixed the collision and moved the hole. `covers-by-key`'s absent case was resolved
   by name while the quantifiers' was dropped in the rewrite, so `not(for-any(absentPointer, …))` certified
   against a response with no collection field at all — F1's defect relocated one operand over.
3. AD-40's vacuous probe was left as an "invalidating condition" with no AD-6 state and no AD-21 rung, which
   is the defect AD-40 had fixed for the unexercised probe two paragraphs earlier.

## The stopping rule

The reviewer's central claim is not a finding and is not disputed here. Findings per round have run
180 → 50 → 24 → 17 → 4, all of one form: two competent implementers read a sentence and behave differently.
Prose has an unbounded supply of that form. The spine says the answer three times — AD-31's predicates are
"generated from the reference implementation, not asserted here", AD-33's table likewise, AD-37's conforming
adapter "is defined by an executable suite, not by prose" — and applies it to three predicates while
refusing to apply it to itself.

So no fifth review round is commissioned. The next artifact is code: the half-day calibration spike, then
the first epic on the twenty-two decisions that need no run record and no calibration outcome. Any further
instance of this class is closed by a fixture. The two the reviewer named are `for-all` and
`not(for-any(…))` over an absent collection pointer, asserted to resolve identically.
