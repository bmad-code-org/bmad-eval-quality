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
> **A fourth defect, added by the spine's owed item 7 at round 3 and never written into this block until
> now.** The run record cites `probeId: "P-001"` and nothing in the repository defined P-001: no probe
> artifact, no AD-9 qualification record, no AD-40 defect signature. The chain therefore reported a score
> computed against a probe the reader could not inspect, and AD-40's signature schema had no fixture to
> land in.
>
> The checker I wrote validated *shape* — dispositions present, states within the closed set, no dangling
> references — and never asked whether the artifacts' content supported their own claims. It confirmed the
> chain was well-formed and I reported that it was correct. That is the same class of error this product
> exists to prevent, committed in the artifact meant to prove the architecture works, in the same document
> that argues hand-authoring beats reading. Finding 8's claim that the chain "works" and the closing
> section's confidence should both be read with that in mind.

> **Closed by regeneration.** All four defects are closed. The five JSON files in this folder are now
> generated: `npm run generate:worked-example` emits `eval-contract.json`, `brief.json`, `probe.json`,
> `sealed-run-record.json`, and `evidence-artifact.json` by running the shipped functions over the chain,
> and `npm run check:worked-example` compares the committed bytes against a rebuild on every
> `npm run validate`.
>
> Which functions, precisely, because "the reference functions" is too loose to check. Four come from the
> compile half and the core modules beside it: `compile` and `seal` produce the contract and the brief,
> `digestArtifact` computes every digest the chain pins itself with, `evaluateCoverage` produces the
> coverage gaps, and `validateLineageChain` produces `remediation.lineageChain`. The rest are epic 7's
> score-side functions: `sealProbeSet`, `bindingOrder`, `resolveCapturedBindings`, `selectWithBindings`,
> `resolveCheck`, `mapFindings`, `matchProbeWitness`, `resolveOutcome`, `uncitedFindingIds`,
> `uncitedDefectFindingGaps`, `reduceTrialSet`, `buildStrengthVector`, and `resolveContractVerdict`.
>
> The evaluator's own evidence is still authored, because there is no live Notes API here to run against:
> the contract, the probe's declarations, and the run record's raw observations, dispositions, and
> findings. **Nine further inputs are hand-declared too, and the claim has to say so.** `resolveOutcome`
> takes `waiver`, `judgeConduct`, `evaluationFault`, and `required` per oracle; AD-21's ladder takes
> `preflightPassed`, `overTruncated`, `unavailable`, `internallyInconsistent`, and `isolationViolation`.
> Several of those feed AD-21's Invalid tier, so a different declaration would change the verdict. They
> are declared because no artifact in this chain carries them: the spike ran no pre-flight, produced no
> isolation-manifest violation, and recorded no AD-26 evaluation fault. So the accurate claim is narrower
> than "everything downstream is computed": every value the reference functions can derive from the
> evidence is derived, and the nine that arrive declared are named here.
>
> What each defect now reads as:
>
> 1. **Closed.** `malformed-write` still matches zero observations, and O-005's disposition still cites
>    none. `resolveOutcome` reads that: the state is `unreached` where the hand-typed artifact read
>    `confirmed`, and the corroboration is `disagrees` where it read `agrees`. The rule that produced the
>    corroboration is `disposition-unsupported`, first in AD-33's corroboration table, ahead of both
>    check-derived rules, so the disposition is not believed. The same input also comes back from
>    `resolveOutcome` as the `unsupported-disposition` invalidating condition. **The artifact does not
>    show either.** `Outcome` carries no field for the rule that fired, the waiver rule, the corroboration
>    rule, the invalidating conditions, or the declined findings, so a reader opening
>    `evidence-artifact.json` sees the state and the corroboration and has to take this paragraph's word
>    for what produced them. Story 7.7's own record names those missing fields as owed.
> 2. **Closed.** Only `baseline-read` genuinely matches two observations, and it declares `cardinality:
>    "any"`, which is what several legitimate matches are declared with. `read-back` carries `after:
>    "write"`, and the binding-aware selector floors its candidates at the anchor's `sequence`, so it
>    matches exactly `obs-004` under `exactly-one`. The temporal clause is what separates the two reads,
>    which keeps the read-back oracle the seeded defect turns on bound to one particular read. Finding
>    10's withdrawal below closes with this defect.
> 3. **Fixed at the grammar level in spine revision 4, and observable in this chain for the first time
>    here.** AD-4's three-valued resolution makes an empty-collection quantifier terminal: O-004's
>    `for-all` over `notes: []` now resolves `insufficient-evidence` carrying the `empty-collection`
>    introduction condition, and AD-6 lands that on `abstained` where the hand-typed artifact read
>    `confirmed`. The state change is visible in the verdict too: `abstained` is a behavioural failure at
>    the policy's severity floor, so the regenerated chain scores **FAIL** where the hand-typed one claimed
>    CONCERNS. *(One wording note. The spine's revision-4 sentence says the fix resolves the quantifier to
>    `false`. The shipped grammar resolves it to `insufficient-evidence`, which closes the same hole by the
>    same rule: the quantifier no longer certifies, and AD-4's third value is what carries the closure.)*
> 4. **Closed.** `probe.json` defines P-001: its class, its `expectedClean` flag, the seeded defect D-001,
>    an authored AD-9 qualification record on the controlled-mutation route, and an AD-40 defect signature.
>    The signature is homed on `GET /notes/{id}` rather than on the update, because `system-under-test.md`
>    records that the update's own response "is indistinguishable from a correct one": the defect manifests
>    on the independent read that returns the stale title, which is the observation F-001 cites. The
>    generator runs `sealProbeSet` and fails the build if P-001 lands in `rejected`, so the gate is a
>    condition of publishing the chain.
>
> **Three readings of the regenerated artifact will surprise a reader.**
>
> *Every outcome carries `resolvedFrom: null`, O-001 included.* The hand-typed artifact recorded
> `resolvedFrom: "F-001"` on O-001, and O-001 is still `caught` with F-001 still citing it. The link
> disappears because AD-33's ladder marks only four rows as resolving from a citation, and `witness-matched`
> is not one of them: the state came from AD-40's signature match over the observations, so no finding
> produced it. The finding is still reachable through `sealed-run-record.json`.
>
> *O-005 publishes `checkResolution.resolution: "false"` with two `false` children, over zero observations.*
> AD-26 resolves an absent pointer to a decisive `false` inside `equality`, so a check whose step matched
> nothing reads on disk as though the API answered something other than 400. Only `state: "unreached"`,
> several fields away, records that nothing was observed at all. AD-26 states that rule outright, so the
> chain is behaving as declared here, and this is the clearest case in the folder for reading a check
> resolution beside its outcome state.
>
> *`corpusDigest` and `fixtureDigest` in `scoringVersionInputs` are placeholders.* They sit beside genuine
> computed digests and are all zeros but for a final nibble, because no corpus or fixture artifact exists
> here for a caller to attest. `comparabilityKey` is computed over one of them, so it is a well-formed key
> that compares nothing. Read it as a shape; a run scored against a real corpus would carry a real one.
> `callerAttestedInputs` names all three attested inputs, which is what that field is for.
>
> These artifacts are now a worked example. What they are still not is a *passing* example: the regenerated
> verdict is FAIL, computed from the evidence, and `README.md` in this folder lists what must still not be
> copied out of here.

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
rung.

The hand-typed artifact then read CONCERNS on the contract. **The regenerated one reads FAIL**, and the
change is the point: O-004 resolves `abstained` over the empty collection, which is a behavioural failure
at the policy's severity floor, and the contract-scoring ladder routes that to FAIL. The
`systemRecommendationRecorded` field still carries the evaluator's own FAIL about the system, unpromoted,
which is what this finding asked for. The two questions now have two fields and two answers, and both are
computed.

**The coverage gaps moved with it.** The hand-typed artifact carried one gap, `sibling-cross-check` at
`material`. The regenerated artifact carries three, all at `critical`, and all three are true positives
AD-31's predicates find in this contract:

- `success-indicator-separation`. The satisfaction predicate wants an oracle addressing every operation's
  nominated success indicator beside another roled pointer. Only `patch-note` has such an oracle, through
  O-002; `get-note` and `list-notes` nominate `/ok` and no oracle reads it, so two of three operations are
  uncovered.
- `malformed-input`. The plan declares `malformed-write` with a `type-violating` binding, and O-005 asserts
  the rejection, but the step matched no observation, so the rule has no witness in this run.
- `sibling-cross-check`. `siblingGroups` declares `get-note` and `list-notes` as siblings and `title` and
  `body` as sibling parameters, and no oracle addresses both members of either group. This is the gap the
  hand-typed artifact already recorded.

AD-31's predicates are contract-level and oracle-blind, so a gap takes the highest declared behaviour
severity, which B-001 sets at `critical`. The hand-typed artifact's single gap carried `material`, a
hand-typed value with no predicate behind it.

**`verdictBasis` shrank from three lines to one, and no condition disappeared.** AD-21's ladder is
first-match-wins across tiers: the FAIL tier fires on O-004, so the CONCERNS tier is never evaluated and
its reasons never reach the basis. Three CONCERNS conditions hold on this run and are readable elsewhere in
the same artifact: the three unsatisfied coverage gaps at or above the floor, in `coverageGaps`; one
completed trial against a declared minimum of three, in `trials`; and O-005 `unreached`, in `outcomes`.
`verdictBasis` records what decided the rung, and the artifact records the rest.

## 10. Low — the addressing grammar is now uniformly step-rooted

A consequence rather than a defect. Once pointers root at an interaction step, the two single-observation
oracles had to name a step too. That is more verbose for the simple case and it is the right trade: one
form and no default step to disagree about.

This finding originally ended by claiming step-rooting left "no ambiguity when a contract has several
observations of the same operation". **Withdrawn at revision 4.** Naming a step removed the ambiguity about
*which channel* a pointer addresses and introduced a new one about *which observation* a step selects, which
is retraction defect 2 above. The trade was still right; the claim about ambiguity was not.

**The withdrawal closes with retraction defect 2.** A step now declares its own selector cardinality, and
the selector filters the operation's observations through the step's input bindings and its temporal
clause, so which observation a step selects is a declared answer. Several matches under a single-valued
cardinality is a named condition the selector returns as data for a caller to route.

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
