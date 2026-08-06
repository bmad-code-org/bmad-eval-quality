# What hand-authoring exposed

One sitting, one toy Notes API, one seeded defect, the full artifact chain hand-authored against spine
revision 2. **Ten findings: three critical, three high.** None of the three criticals was found by any of
the ten prior review passes, because they only appear when you try to write a contract rather than read
about one.

The headline: **three of the five oracles I needed could not be expressed in the operator vocabulary and
addressing grammar, so the contract did not compile.** One of the three is the state-change read-back rule
that revision 2 had added hours earlier specifically to catch the defect class in this spike. The third
critical was found by writing a consistency checker over the finished chain, which reported a FAIL verdict
with zero behavioural failures.

All ten are fixed in spine revision 3, and the artifacts in this folder are the corrected chain: every
oracle now compiles and every pointer resolves to a declared interaction step. The `check` expressions here
are the first ones ever written in this language, so they are also the first evidence that it can express
what the discipline rules require.

> **Retraction, added at spine revision 4.** This document previously claimed the corrected chain was
> "internally consistent end to end". **That claim was false**, and two round-2 reviewers found it
> independently. Three defects are verified by re-running the matcher over the shipped artifacts:
>
> 1. The `malformed-write` step matches **zero** observations, yet O-005 is recorded `confirmed` with
>    corroboration `agrees`, and its disposition narrates a 400 rejection that appears in no observation.
> 2. The `baseline-read` and `read-back` steps each match **two** observations, `obs-001` and `obs-004`,
>    with identical operation and inputs — so a first-match and a last-match scorer bind different evidence
>    and can produce opposite answers from this one sealed record.
> 3. O-004's `for-all` runs over `notes: []` and is vacuously true, so per-record completeness is certified
>    over zero records while this contract's own `testData.setup` declares three seeded notes. It reports
>    `confirmed`/`agrees`.
>
> The checker I wrote validated *shape* — dispositions present, states within the closed set, no dangling
> references — and never asked whether the artifacts' content supported their own claims. It confirmed the
> chain was well-formed and I reported that it was correct. That is the same class of error this product
> exists to prevent, committed in the artifact meant to prove the architecture works, in the same document
> that argues hand-authoring beats reading. Finding 8's claim that the chain "works" and the closing
> section's confidence should both be read with that in mind.
>
> Spine revision 4 fixes defect 3 at the grammar level: AD-4 now resolves an empty-collection `for-all` to
> false rather than vacuously true. Defects 1 and 2 are downstream of observation-selection semantics that
> revision 4 records as open in *Owed to the reference implementation* rather than patching, so **this chain
> is deliberately left uncorrected** and must be regenerated from the reference reducer once it exists,
> with hand-filled downstream values forbidden. Until then these artifacts are evidence of what the
> architecture could not express, which is what they were built for — not a conforming example. Do not copy
> them as one.

## 1. Critical — the addressing grammar is single-observation; four of the seven rules are not

AD-26 fixes evidence roots at `response-body`, `response-headers`, `response-status`, `call-inputs`,
`stdout`, `stderr`, and `exit-code`. Every one of them names **one** response. There is no way to write
a pointer that means "the body of the follow-up read".

The oracle for the seeded defect has to compare the title sent to `PATCH` against the title returned by
a *later, independent* `GET`. That is the only thing that distinguishes this defect from correct
behaviour — the write's own response is perfect. It is inexpressible. So is malformed-input probing,
which needs a call with a deliberately bad input distinct from the happy-path call; so is the sibling
cross-check across two operations; so is per-record verification once the collection comes from a
different call than the payload.

Four of AD-20's seven rules — malformed input, sibling cross-check, omission and completeness, and
state-change read-back — are inherently multi-observation. The grammar underneath them is
single-observation. In this spike that leaves O-001, O-004, and O-005 with no writable `check`, and
since AD-3 requires `check` and AD-5 makes a missing one a structural error, **the contract fails
compilation**. The architecture cannot compile a contract for the defect class it was just extended to
catch.

**Proposed fix.** The contract declares a named interaction plan — steps with identifiers — and the
pointer root extends to `/interactions/{stepId}/response-body/...`. Pointers stay RFC 6901, `check`
stays a pure function over ingested observations, and all four rules become expressible. It touches
AD-4, AD-19, AD-26, and the contract schema.

**And it lands on a boundary the spine has to draw explicitly.** AD-4 forbids `ordering` from encoding
"a sequence of actions the evaluator must perform", and AD-16 forbids a prescribed action sequence in
the brief — that prohibition is load-bearing, because prescribing the path is what the scripted arm did
and what the independent evaluator beat. A declared interaction plan looks exactly like the thing being
forbidden. The distinction the architecture must state: the plan declares **what relationship between
observations constitutes the behaviour**, and does not declare **what the evaluator must do to obtain
them**. The evaluator still chooses its own path; the contract only says which pairs of observations, if
obtained, would settle the question. Getting this sentence wrong reintroduces the scripted arm, so it
belongs in an ADR rather than in an implementation story.

## 2. Critical — no element quantifier, so per-record verification is inexpressible

AD-4's `all` and `any` are connectives over expression **nodes**. They do not quantify over collection
**elements**. "Every note in the collection carries all five fields" cannot be written; only "the first
one does" can.

Per-record verification rather than spot-check is one of the five original rules — one of the five the
measured 0.33-to-1.00 effect is actually attributed to. The vocabulary cannot express a rule the
product's central claim rests on.

**Proposed fix.** Add `for-all` and `for-any` over a collection pointer with a bound element variable,
and a relative pointer form for the element. Note the cost honestly: a bound variable is a step toward
the expression language AD-26 refuses, so the extension has to be exactly this and stop here.

## 3. High — an oracle with no finding has no defined state

Three oracles drew no finding at all. I had to write something, and wrote `abstained` — but that is a
guess, and AD-6 makes `abstained` a behavioural failure that prevents PASS. "The evaluator filed
nothing about this oracle" and "the evaluator declined to judge it" are different, and so is "the
evaluator checked it, found it fine, and did not bother filing a confirmation". The experiments carried
a `confirmation` finding type precisely to separate these, and revision 2 preserved the type without
preserving the obligation.

AD-17 requires a conforming run record to show a judge scoring every named rubric criterion. Nothing
imposes the equivalent on the evaluator for oracles. **Fix:** require one disposition per required
oracle in the run record, and make a missing disposition an invalidating condition under AD-21 rather
than a silent `abstained`. This decides whether a real run reads FAIL or invalid, and it is currently
undefined.

## 4. High — no state means "correctly confirmed correct behaviour"

O-002 drew a `confirmation` on a probe that carries a defect elsewhere. Nothing was caught, nothing was
missed, and `passed-clean-control` is reserved by AD-9 for a known-clean control. I wrote
`passed-clean-control` in the evidence artifact and it is wrong.

This is not an edge case: on any defect probe, most oracles correctly confirm the behaviours the defect
does not touch. That is the common case and the closed ten-state set has no state for it. **Fix:**
either add a `confirmed` state, or state in AD-6 that confirmations on non-control probes are excluded
from counts the way `not-applicable` is. The first is cleaner, because "excluded" would discard the
evidence that the contract's other oracles were exercised at all.

## 5. High — below-minimum trial count has no rung in a table declared total

AD-6 has the policy declare a minimum trial count, defaulting to three. AD-7 computes rates "across the
declared trial count". This run completed one. AD-21 declares its table total over every condition, and
there is no rung for "fewer trials than the policy requires" — so it falls through to PASS on its own
terms, which is precisely the defect class the fourth review round found and revision 2 claimed to
close. I wrote "reported and not comparable" into the artifact, which is invention, not derivation.

**Fix:** an explicit rung. A run below the declared minimum should be CONCERNS at most and its vector
marked non-comparable, or invalid outright — pick one and write it down.

## 6. Medium — the corroboration signal has no closed vocabulary

AD-33 says a `check` disagreeing with a finding is "recorded as a corroboration mismatch". Filling the
artifact forced me to invent `agrees`, `check-would-have-failed`, and `unavailable-no-check`. The field
needs a closed enumeration — at minimum agrees, disagrees, and not-evaluable-on-this-run — plus a rule
for whether a disagreement affects the verdict. It currently sounds like it must be recorded and
ignored, which is probably right but is not stated.

## 7. Medium — a contract with zero rubrics compiles, and nothing says whether that is intended

`rubrics: []` satisfies everything the spine requires. That makes the entire judge path optional, which
is defensible and undocumented, and it makes AD-17's "one judge call scoring all named rubric criteria"
vacuous rather than false. One sentence in AD-19 or AD-22 settles it.

## 8. Low — the volatile-pointer mechanism works, and is the one thing that fit

Worth recording a success. `/note/updatedAt` changes on every call, and AD-11's declared-volatile-pointer
rule handled it without friction: declare it, pre-flight excludes it from the fixture digest, and the
scoring version stays stable across runs. That mechanism was added on reviewer pressure and it is the
only part of the chain that behaved exactly as specified when used in anger.

## 9. Critical — the gate verdict and the contract verdict were the same field

Found not by authoring but by writing a script to check the finished chain for consistency. It reported
**verdict FAIL with zero behavioural failures**, which read as a bug in the checker and was not.

The verdict came out FAIL because the evaluator recommended FAIL — correctly, since the system under test
has a seeded critical defect. But every outcome state says the contract performed perfectly: one
`caught`, four `confirmed`. Two different questions were sharing one field:

- **Is the system shippable?** Driven by defects found. This is VFR-5's gate verdict.
- **Is the contract strong enough?** Driven by caught against missed. This is VFR-7's whole purpose.

In a scoring run the probe is *knowingly* defective, so the system-directed answer is always FAIL and
carries no information. Revision 2 shipped a scorer whose verdict field is meaningless in precisely the
mode the scorer exists for, and AD-21 called its table total without run mode as an input.

**Fixed in revision 3.** The run declares `production` or `contract-scoring`; in scoring mode the verdict
is about contract adequacy and the system recommendation is recorded as an input, never promoted to a
rung. The corrected artifact reads CONCERNS on the contract — it caught the defect, but carries an
unsatisfied sibling-cross-check gap at material severity and ran one trial against a declared minimum of
three.

## 10. Low — the addressing grammar is now uniformly step-rooted

A consequence rather than a defect. Once pointers root at an interaction step, the two single-observation
oracles had to name a step too. That is more verbose for the simple case and it is the right trade: one
form and no default step to disagree about.

This finding originally ended by claiming step-rooting left "no ambiguity when a contract has several
observations of the same operation". **Withdrawn at revision 4.** Naming a step removed the ambiguity about
*which channel* a pointer addresses and introduced a new one about *which observation* a step selects, which
is retraction defect 2 above. The trade was still right; the claim about ambiguity was not.

## What this says about the review strategy

Ten review passes over documents found roughly 180 findings and left both critical defects standing.
Writing one contract found them in an afternoon, because the grammar's single-observation limit is
invisible when reading AD-26 and unmissable when trying to write O-001.

**Revision 4 adds the sequel, and it cuts against the confident version of that lesson.** Round 2 then found
three defects in *this* chain, and the two that mattered came from reviewers who wrote code against the
artifacts — one built a step-to-observation matcher, one built a consistency checker — rather than from
anyone reading them. My own checker had passed. So the ranking is not "authoring beats reading" but
something narrower and less flattering: **executing a decision procedure over the artifacts beats
inspecting them, and that includes inspecting your own.** Hand-authoring found what the grammar could not
express. Only execution found what the chain got wrong.

The chain is deliberately left in place, contradictions and all, so the corrections can be checked
against a concrete case rather than argued in the abstract.
