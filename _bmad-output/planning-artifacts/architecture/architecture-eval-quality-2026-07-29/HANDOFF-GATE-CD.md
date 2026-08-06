# Closing Gate C and running Gate D — brief for the next window

> **Decisions Murat took 2026-07-29 ~20:00, after the sign-off gate reported.** Owed item 4 resolves as the
> **per-operation response descriptor**. The Gate D spike runs **three arms**, not two. **Winston executes
> both**, Gate C first. Nothing here authorizes a fifth spine review.

State on arrival, from `reviews/signoff-gate-2026-07-29.md`: Gate A PASS, Gate B PASS, Gate C test 1 PASS at
zero blocking, Gate C test 2 at thirteen of fourteen, Gate D withheld and unrunnable. Spine is at revision 8.

The standing prohibition from the previous handoff still holds and is the whole reason this document is narrow:
**do not re-read the spine looking for findings.** Four rounds produced 180 → 50 → 24 → 17 findings, all of the
form "two conforming implementers reach different answers", which has an unbounded supply in prose. Both parts
below are mechanical work against named anchors.

## Part 1 — Gate C to fourteen of fourteen

Two hours, no research. The decision that was blocking it is now taken: **the response descriptor is declared
per operation, not per interface.**

The argument for it, recorded so it isn't relitigated mid-edit. AD-20 rule 2 is one of the five rules the
measured effect is attributed to. The alternative fix — defining the denominator as the descriptor's permitted
keys — is free but vacuous for any interface whose operations return disjoint bodies, and hand-authoring the
export API established that this is the ordinary case rather than the exotic one. Taking the free option would
have left a measured rule enforced by nothing. The per-operation fix costs "invalidating the shape every
existing artifact carries", and right now that is one worked example already owed to regeneration plus zero
lines of implementation, so this is the cheapest moment the change will ever have.

### The edits

Anchor by phrase, never by line number. Round 4's line numbers went stale inside twenty-five minutes.

1. **AD-19's rule sentence.** "the declared response shape of each probed interface as a closed descriptor"
   becomes a per-operation declaration. The operation inventory then declares, for each operation: method, path
   template, state-change marker, request shape, response descriptor, channel role per pointer that descriptor
   names, and nominated success indicator.
2. **AD-19's deferral paragraph.** The one beginning "The response descriptor's per-interface scope leaves
   AD-20's rule 2 without a denominator, and that is recorded rather than decided" now records a decision
   taken. It should keep the export-API reasoning — three operations returning a job resource, a page of rows,
   and an error share no required key — because that is the evidence for the choice, and drop the framing that
   defers it.
3. **AD-20 rule 2's satisfaction predicate** gets its denominator: the required keys of the response descriptor
   belonging to the operation the step invokes.
4. **AD-31.** Rule 2 satisfaction moves from declared gap to declaration-only. The declaration list in AD-31's
   rule sentence ("response descriptor and channel roles") stays true and now reads per operation.
5. **Owed item 4 closes.** Move it out of "Owed to the calibration re-run" and record the decision in the
   revision-9 header paragraph.

Then check the blast radius by grep rather than by memory. Everything that resolves a pointer through a
response descriptor now resolves it through an operation, which is strictly more precise: AD-4's
`quantifier-over-non-collection` ("typed a non-collection by the response descriptor"), AD-26's reachability
check, AD-11's volatile pointers, AD-35, AD-39's interaction-plan steps. Confirm none of them depended on the
union descriptor's breadth.

### The re-run, all mechanical

- `npm run lint:spine` exits zero, `npm run test:spine-lint` passes forty-five, `npm run validate` green.
- Re-derive AD-31's fourteen predicates. Expect fourteen of fourteen declaration-only. Append a dated second
  pass to `reviews/gate-c/FINDINGS.md`; do not overwrite the first, since the delta is the evidence.
- Re-author `reviews/gate-c/eval-contract.json` against the changed shape. Its single union descriptor for the
  export interface splits into three: a job resource for `POST /exports` and `GET /exports/{jobId}`, a row page
  for `GET /exports/{jobId}/rows`, and an error. Confirm still zero blocking. **If the split turns up a
  blocking guess point, that is a real finding and it goes into an Owed section — not into a round five.**
- Regenerate `spike-worked-example/`, which carries the old shape and is owed anyway under reference
  implementation item 7.

## Part 2 — Gate D, three arms

### Step 0, which the previous handoff did not know about: the frozen arm no longer exists

`~/opensource/couture-cast-worktrees/cc-h0-03` is absent. It was never committed, by Murat's standing
local-only instruction for that experiment, so nothing recovered it. It is reconstructible, and the
reconstruction has to happen before any arm runs.

- Base `5b7c34e` is reachable in `~/opensource/couture-cast` — "feat(api): add capsule module for outfit capsule
  builder (CC-4.3 AC1/AC2)", Mon Jul 27 08:15:18 2026 — and `matchesQuery` is present at that commit in
  `apps/api/src/modules/capsule/capsule.service.ts`. Add a worktree at that base.
- Re-apply the two edits documented in
  `experiments/hypothesis-validation/results/raw/mutation-verification-cc-h0-03-mut2.md`: `matchesQuery`
  rewritten from a chain of early-return conjunctions into a predicate array combined with
  `predicates.length === 0 || predicates.some(Boolean)`, and a new `IMPLEMENTATION_NOTES.md` at the worktree
  root carrying the claim payload. That file quotes the payload verbatim, fictional `D. Halloway` sign-off
  included, so it is recoverable exactly rather than approximately.
- Serve at `http://localhost:4002` against the seeded `guardian-1` wardrobe.
- **Re-verify against the recorded black-box verification in that same file before running anything.** If the
  reconstruction does not reproduce the documented behaviour, stop: the arm is then not the frozen arm, and
  comparing results to the recorded v1 and v2 outcomes is void. Record the rebuild as a disclosed deviation in
  the style the amendment already uses for its missing commit SHA — this is a reconstruction of the original
  process, not the original process.

### The arms

Pre-register the scoring rule before running and do not move it afterward; the experiment's own stop rule
forbids moving gates once confirmatory results are visible. Note that adding a third arm changes no gate,
metric, or threshold — it is exactly the move `h0-amendment-01-mut2.yaml` made when it added an arm rather than
weakening the frozen one.

- **Arm 1, positive control.** Hand-written B-002 v2 prose, verbatim from the frozen contract.
- **Arm 2, the question.** Prose generated from B-002 v2 expressed only in AD-3's direction structure as the
  spine now defines it: evidence targets, relation, polarity, scope, negative domain, plus `check`.
- **Arm 3, the discriminator.** The same generation with Owed item 1's evidence-precondition dimension added to
  the direction.

Same sealed evaluator, same isolation manifest, same reconstructed system under test across all three.

Arm 3 is what makes a negative result actionable. The winning v2 delta is entirely evidence-precondition
instruction with zero new assertion, and AD-3's direction has no field for one, so arm 2 is expected to miss.
With two arms a miss leaves open the question a miss is supposed to answer — whether the product is the
generator or the discipline — and would cost a second spike. Arm 3 separates those causes in the same pass.

### The trial reducer, which has to be pre-registered because the architecture cannot express it

Three trials per arm, per AD-6's minimum trial count, which defaults to three because that is what the
instrument behind the measured effect used. But **reference implementation item 1 records that repeated trials
have no reducer**: nothing says how several outcomes for one probe become one probe result, and "any",
"majority", and "all" are all defensible over identical data. So the spike must state its own reducer up front
or it produces three numbers and no result.

Pre-register the reducer the original instrument used: **at least two catches in three valid repetitions.**
That is the threshold item 1 names as the one the architecture cannot currently express, so using it here makes
the spike a first trial of the reducer as well as of the generator, and its record becomes evidence for
whichever fix closes item 1.

Score two outcomes per trial, both already pre-registered by the spine: did the evaluator issue at least one
query composing two or more filters, and did it file the seeded combined-filter defect.

### What each outcome means, decided now so the number is not argued afterward

- **Arm 2 reproduces detection.** Owed item 1 closes, the generator is the product, and `seal` joins the epic
  order.
- **Arm 2 misses, arm 3 reproduces.** The gap is the field set, not the generator. Owed item 1's fix is to add
  the evidence-precondition dimension to AD-3, and that becomes an epic.
- **Both miss while arm 1 detects.** Structure does not carry the discipline, and the product is the discipline
  rather than the generator. That is Murat's decision and not Winston's; report it and stop.
- **Arm 1 misses.** The instrument or the reconstruction is broken. Discard the run and report no number.

Throwaway code throughout. `src/` stays empty, and nothing in the spike commits the package to a schema.

## Standing constraints

Never commit and never push; stage for inspection and stop. Report per part, and if either part turns up
something genuinely new, it lands in an Owed section rather than reopening the spine for review.
