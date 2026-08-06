# Triage — external review round, 2026-07-29

Three independent external passes on the accepted spine: `REVIEW-kimi-k3.local.md` (32 findings, 5
critical), `REVIEW-kerem.local.md` (20 findings, 6 critical), `REVIEW-tea.local.md` (9 findings, 3
blockers). A fourth pass (codex) is outstanding. Verdicts: CONCERNS, "would not build against this",
and gate FAIL respectively.

Sixty-one findings collapse to fifteen clusters. Overlap between the three is small, which is the
point: one judged the document, one judged it against the instrument that produced the data, one
judged it as a quality gate. The gate lens in particular found a class of defect the other two
structurally could not see.

## Claims I verified myself before accepting anything

The brief told reviewers to verify rather than trust, so the same standard applies to their reports.
Everything below was checked directly against the repository, the prior-art schemas, or an installed
Zod 4.4.3, not taken from the reports.

| Claim | Source | Result |
|---|---|---|
| Prior-art oracle is a bare prose string, no `check` field anywhere in the experiments | kerem 1 | **Confirmed.** `eval-contract.schema.json:24` is `{"type":"string","minLength":1}`; zero occurrences of `"check"` under `experiments/` |
| The eight schemas did not carry the 19 scored repetitions | kerem 3 | **Confirmed.** `STATUS.md:268` puts the H0 population at 10 condition records; `PHASE2-RESULTS.md:9,20` puts the 19 repetitions in block 1 with raw output in the private evidence root |
| The instrument ran three repetitions per arm | tea 1 | **Confirmed.** `PHASE2-RESULTS.md:28` "three repetitions each"; gate 2 reads "at least 2 of 3 repetitions" |
| Prior art contains a snake_case enum value | kerem 15, kimi L-2 | **Confirmed.** `NOT_APPLICABLE` at `h0-run-result.schema.json:24`. My "zero snake_case" is false as written |
| `forbiddenInputs` prior-art enum has seven values, not five | kimi H-8 | **Confirmed.** Adds `comparator-results` and `human-labels` at `eval-contract.schema.json:48-49` |
| Prior art has a closed severity vocabulary | kimi L-8 | **Confirmed.** `low\|material\|critical` at `eval-contract.schema.json:25-28` |
| `contains` has no Zod API, so AD-16's floor cannot round-trip | kimi C-5, kerem 5 | **Confirmed by execution.** `z.array(z.string()).contains` is `undefined`; no contain/include method on the prototype |
| A refined array exports with the constraint silently dropped | AD-13's own premise | **Confirmed by execution.** Exports as plain `{type:array,items:{type:string}}`, exit 0 |
| Zod input mode omits `additionalProperties` | kimi L-4 | **Confirmed by execution** |
| Zod 4.4.3 emits a bare `id` that the generator must strip | kerem 19 | **Rejected.** Executed both with and without `.meta({id})`, at root and nested in `$defs`: neither `id` nor `$id` is emitted. AD-13's sentence stands. `.meta({id})` does name the `$defs` key, which matters for byte-exact drift and deserves a clause |
| Mermaid diagram forbids the `ports → core/schemas` import its own text mandates | kimi M-1 | **Confirmed.** No `PORTS --> SCHEMAS` edge; prose says "`ports/` imports nothing but `core/schemas`" |
| AD-6's partition sentence is false on its own enumeration | kerem 8 | **Confirmed.** Four of ten states are in neither group |
| AD-16 defines compile-time checks outside AD-5's closed eleven | kerem 11 | **Confirmed.** Both the forbidden-input floor and the scoped-reference check |

One of my own claims is false (the 19-runs provenance), one is overstated (zero snake_case), and one
external claim is false (the Zod `id` emission). The 19-runs error is the third instance in this
project of an unexercised claim surviving review, and it sits inside the ADR that documents the
previous two.

## Cluster A — What resolves an outcome state (kerem 1, kimi H-11)

**Disposition: accept, and it is a redesign rather than an amendment.** This is the most serious
finding in the round and the only one that changes what the product measures.

The measured effect came from prose oracles read by a sealed LLM evaluator, whose free-text findings a
human mapped to adjudicated defect identifiers. AD-3 makes `check` — a machine-evaluated expression
tree with no prior art — "the only field the compiler and scorer evaluate" and makes `intent`, the
prose that carried the effect, "never parsed". Under that rule `caught` degrades to "the author wrote
an assertion that failed", which is not the measured claim. AD-23 says the opposite, that only
evaluator `defect` findings enter a detection measure. Both sentences are in the accepted spine and
they specify two incompatible scorers.

There is a second hole the reports do not separate out: if discipline is enforced against `check`
alone, a contract with a rigorous `check` and a lazy `intent` compiles clean while the evaluator, which
reads only `intent`, still misses the defect. The compiler would certify exactly the contract the
experiments showed fails.

Resolution: outcome state is resolved from ingested evaluator findings mapped to oracle identifiers;
`check` becomes a compile-time enforcement surface and a recorded corroboration signal, never the
state's source; disagreement between the two is recorded rather than resolved. Requires a
finding-to-oracle citation (kimi H-11, RUBRIC H-8, still open) and coverage rules that bind the
`intent`/`check` pair rather than `check` alone. Touches AD-3, AD-6, AD-7, AD-20, AD-23, AD-31.

## Cluster B — The scoring version is not computable (kimi C-1/C-2/C-3/H-6/H-7, kerem 6/7)

**Disposition: accept in full.** Five independent gaps in the identity that comparability,
immutability, and dominance all hang on.

- The evaluator configuration digest has no source artifact and no fields. Add an Evaluator
  Configuration artifact to AD-24 (sealed-brief digest, opaque evaluator identity, decoding
  parameters, tool-inventory digest, harness version; trial index excluded so trials pool), carried in
  the run record, invalidating on absence.
- AD-27 concatenates "member digest strings" and AD-11's first member is an integer. Render every
  non-digest member as its RFC 8785 serialization and digest it first, so composition is always over
  `sha256:`-prefixed strings, and say the prefix is included.
- The fixture digest has no scope. Over the plan, mutated fixtures compare equal; over raw
  observations, every run is unique. Fix as a closed projection of pre-flight observations with a
  contract-declared volatile-field mask, emitted as a required Pre-flight Verdict field (closes RUBRIC
  M-5 too).
- Who recomputes the corpus digest is unassigned, which decides whether AD-12's anti-tutoring guard is
  a mechanism or a promise. Assign recomputation from resolved bytes.
- The Scoring Policy has no required fields while moving verdicts, versions, and rejections. Enumerate
  it and ship the default as a published artifact with an identity rather than a code-resident constant.
- AD-11's "never caller-supplied" is false for three of five members. Replace with an accurate
  statement of what is caller-attested and what that costs, and require the evaluator configuration
  digest in both the run record and the isolation manifest so substitution takes two deliberate lies.

## Cluster C — Absent evidence invalidates forever (kerem 2, SEAM F-004, tea 2)

**Disposition: accept.** AD-26 resolves an unresolved pointer to `oracle-error`, AD-6 makes that
invalidating and prescribes re-execution, and every input is deterministic, so the loop never
terminates. AD-4 forbids short-circuiting and the operator set has no boolean connective, so the guard
cannot be written. A missing-field defect therefore cannot be caught — and two of the three measured
cases were a missing navigable reference and an identifier-validation failure.

Fix: `absent` becomes a first-class operand for every operator, comparison against it resolves false
and therefore `caught` on a defect probe, and `oracle-error` is reserved for genuine authoring faults.
Add boolean connectives to AD-4 so the expression tree has internal nodes at all. Independently, cap
re-execution in the scoring policy, record `invalidatedAttempts` and each reason even on a PASS, and
make cap breach a disposition that indicts the harness rather than the contract (tea 2).

## Cluster D — Clean controls cannot exist (kerem 4, kimi H-4, tea 9)

**Disposition: accept, in kerem's form.** AD-9 closes the probe classes at four and all four
qualification paths require a defect to exist, so a known-clean control cannot be declared or
qualified. That makes `passed-clean-control` and `false-positive` unreachable, strands
`false-positive`'s only stated consequence, and makes AD-30's fixture-per-state matrix unsatisfiable.

Prior art settles the form: `expectedClean` is a boolean on the record, not a class
(`h0-ground-truth.schema.json`). So clean-control becomes a declared boolean on a probe of any class,
with its own qualification path (baseline-pass evidence at a commit with no known defect in the probed
interface), contributing to no dominance axis, and `false-positive` gets a disposition independent of
class. Preferred over kimi's fifth-class option because a fifth class distorts the dominance vector.

## Cluster E — AD-13 is unsatisfiable as written (kerem 5, kimi C-5, kimi L-4)

**Disposition: accept.** Four requirements that are not jointly satisfiable. Three prior-art
conditionals survive only by restructuring as discriminated unions, which changes the published shape
from `allOf`/`if`/`then` to `oneOf` — a real obligation the spine does not state. The fourth,
`contains` on `forbiddenInputs`, has no Zod construct at all, becomes a `.refine()`, and is silently
dropped. Byte-exact drift leaves no legal place to patch it back. The negative fixture detects the loss
and cannot prevent it, so it fails permanently.

Fix: name the carrier. The generator owns a small enumerated constraint-injection table, each entry
paired with its negative fixture, and the drift check covers the patched output. Add kimi's
self-auditing completeness check: mutate each keyword out of the generated schema in CI and require a
fixture to fail per mutation. Record that three of four prior-art constraints need discriminated-union
restructuring, and that the generator must use output mode since input mode drops
`additionalProperties`.

## Cluster F — No minimum trial count, and dominance is unnormalized (tea 1, kimi M-12)

**Disposition: accept.** The strongest finding in the gate pass, and no other lens found it. The
instrument ran three repetitions per arm and that is what made 0/3 against 3/3 readable. The spine has
the doctrine ("trials, never retries") and no requirement: no minimum count, no artifact field
recording it, and trial count absent from AD-7's comparability precondition while the vector holds raw
counts. A mediocre contract over three trials therefore dominates a perfect contract over one, and no
reader can detect it.

Fix: minimum trial count in the scoring policy defaulting to 3, trial count on the run record and the
evidence artifact, dominance over catch **rate** per class with raw counts retained, and trial count in
the comparability precondition. A rate is not a weighted composite, so ADR-003 Decision 3 survives
intact. Add kimi's fourth result value `equivalent`, since component-wise equality currently reports
`incomparable` and that is exactly what a stability check produces.

## Cluster G — Verdict derivation is not total (kimi C-4/H-3/M-2/M-3, kerem 13, tea 4/5)

**Disposition: accept; one item needs a decision (see Open decisions).** An ingested evaluator
recommendation of FAIL matches no rung and lands in "PASS otherwise" — a green gate on the say-so of
the component the product most wants to hear from. A validated waiver has no path to clear the coverage
gap it exists to settle. An invalid run records "the reason", singular, so five `missed` checks behind
one `judge-error` vanish from the gate indefinitely. Compile failure and remediation-cap rejection have
no exit code. Waivers have no expiry, and there is no WAIVED verdict, so a mostly-waived run reports
PASS on a dashboard while only the file knows better.

Fix: make the recommendation mapping total; give a waiver a gap kind and an RFC 3339 expiry, with an
expired waiver reinstating its gap; require the invalid record to carry every condition that fired plus
every behavioural failure already resolved; extend the exit-code table past the verdict range; add
WAIVED between CONCERNS and PASS.

## Cluster H — Coverage predicates are not writable (kimi H-1, kerem 10)

**Disposition: accept.** Both reviewers independently tried to write the five relevance predicates from
declarations and both got three. Rule 1 needs a nominated success indicator per interface kind, which
no declaration carries. Rule 5 needs an operation or sibling inventory, which the interface-kind enum
cannot express. AD-31 then fails closed, so both are permanently relevant, and a single-operation
scalar contract can never reach PASS by any authoring effort — reintroducing the case the PRD's
three-class design existed to accommodate. Separately, what *satisfies* a relevant rule is undefined
everywhere, and the two natural readings diverge on the most common contract shape.

Fix: require the contract to nominate a success indicator per response shape and to declare sibling and
operation groups, with an explicit empty declaration permitted so a genuinely sibling-free contract is
decidably clean rather than fail-closed. Publish relevance *and* satisfaction predicates as a normative
table over a closed shape descriptor, with a positive and negative fixture per rule. Define "unspecific"
as an enumerated set of descriptor states or delete the word.

## Cluster I — Enumeration and floor gaps (kimi H-8/L-8/M-8, kerem 8/11)

**Disposition: accept.** The forbidden-input floor is five where the prior art carries seven, and the
two omitted are `comparator-results` and `human-labels` — an evaluator that saw the adjudicated answer
key is informed by definition, and AD-16 does not require withholding it. AD-5's closure clause is
violated by AD-16's own two compile-time checks, so a literal implementer ships a compiler that accepts
a contract with no forbidden-input floor. AD-6's partition sentence is false on its own enumeration, and
`false-positive` is qualified to clean controls only, so a false positive on a defect probe falls
through every rung to PASS. Severity is the one open vocabulary in a document that closes every other
enumeration. AD-26's evidence-root names are not enumerated.

Fix: floor at all seven; AD-5 to thirteen classes; rewrite the partition sentence to "no state belongs
to both groups" and make `false-positive` a behavioural failure unconditionally, which also restores
agreement with the PRD; ratify `low|material|critical`; enumerate the evidence-root vocabulary.

## Cluster J — Pre-flight is weaker than the failures it exists to catch (tea 3/8, kimi H-10/M-4)

**Disposition: accept.** Ten of ten failures across both experiment rounds lived in the measurement
layer, which makes this the highest-probability failure mode in the product on the project's own data.
AD-10 hedges request-body sensitivity with "where it applies" — and one of the ten was a
request-body-blind stub, which passes a route check and a clean-control check. The reverse direction is
unbounded: a declared seeded fault that never fires produces a vacuous defect probe, and the contract is
scored `missed` for a defect the fixture never presented, which is a fixture defect recorded as a
contract signal. Per-run reset is asserted but performed by nobody. And the vocabulary is HTTP-shaped,
so three of four interface kinds have no probe mechanics.

Fix: delete "where it applies" and make body sensitivity a differential probe fired from AD-19's
declared inputs; require every declared seeded fault to be observed firing; make reset a differential
check (observe, mutate, reset, observe, assert first equals third); name probe semantics per interface
kind or restrict v0 pre-flight to `api` honestly. All four are the same instruction: replace an asserted
property with a check against observed behaviour.

## Cluster K — Composition and port verification (kimi H-5/M-1/L-5, tea 7, kerem 17/20)

**Disposition: accept.** Ports are async and stages are pure, and nothing says who awaits. That yields
two incompatible published library surfaces for the primary integration surface. Fix by generalizing
AD-10's existing plan/apply split: stages are synchronous pure pairs, and one thin orchestration layer
is the only place a port is awaited.

Callers implement the load-bearing boundary against prose with nothing executable to check against, in a
product whose AD-13 argues that an unexecutable constraint is not a constraint. Ship a conformance suite
as a published subpath, four assertions per port minimum, including exactly-one-underlying-call to catch
the well-intentioned internal retry that SEAM F-016 showed erases the anomalies pre-flight exists to
detect. Day-one deliverable, since the first external adapter precedes any later addition.

Also: add the missing `PORTS --> SCHEMAS` edge; permit `node:crypto` in the core explicitly so nobody
invents a digest port; either admit one audited JCS dependency or pin the two rules independent
canonicalizers get wrong (number serialization, UTF-16 code-unit key sort); resolve the diagnostics sink
as a callback outside AD-1 or a port; delete the word "exception" from AD-2, since no module performs
network I/O at all.

## Cluster L — No adopter path to a scored result (kerem 12, kimi H-9)

**Disposition: accept.** Both reviewers reached the same answer to the bootstrapping press. Day one
yields exactly one thing: a compiled contract with its coverage gaps recorded. That half matches the
measured claim and is genuinely useful. `score`, which carries most of the spine's decisions, needs a
mined and qualified per-adopter corpus, and ADR-002 promised mechanical mining as part of the scoring
feature while the spine has no mining stage, no history port, and no deferral entry.

Fix: state the staged path in the spine so it drives epic order — stage one is `compile` against no
corpus; ship a starter development corpus with at least one qualified probe per class, labelled visible
and therefore not a holdout; add one worked end-to-end example (a sealed brief plus a conforming run
record and manifest) so the caller's contract surface is concrete; and either name the miner in Deferred
or commit it.

## Cluster M — Factual corrections (kerem 3/15/16/18, kimi L-1/L-2/L-3)

**Disposition: accept.** Split the 19-runs claim: conventions are ratified because they were authored
and schema-validated across the H0 population of 10 records, which is a real and sufficient reason; the
19 repetitions are cited separately as the measured effect with evidence held privately. Correct the
same sentence in the PRD. Downgrade "zero snake_case" to one, in the verdict enum, and keep the
conclusion. Say the identifier quantifier is ratified and five of eight prefixes are new. Drop the "two
changes" count from the TypeScript 7 note, list all four tsconfig items, and name `tsconfig-build.json`
as the second file. Require AD-24 succession to declare a named predecessor or an explicit "no prior
art", and record the six correspondences once. Note that the npm name `agentevals` belongs to an
unrelated package. Note that every `package.json` entry is currently a caret range, so the exact-pin
convention describes a future state.

Also state what a scripted or baseline-only run reports, since the prior art needed a fourth verdict
value there and AD-21 closes at three.

## Cluster N — Deferrals (kimi press 1 and M-11, kerem over-specification section)

**Disposition: accept.** Both reviewers independently concluded the count is not the problem and both
named the same two candidates for removal. AD-29's revision lineage has no producing stage in a linear
six-stage pipeline, and AD-12's remediation cap is enforced against a counter the caller supplies in the
artifact being capped, so the cap is caller-enforceable only. Say that plainly rather than stating
"exceeding the cap rejects the contract" as if it were a mechanism; the package can verify chain
consistency, not global compliance. EnginePort is a named seam with no shape and no integration behind
it, so drop it from the seed until an adapter exists.

Kerem's summary is the one to carry into epic order: the spine is precise about mechanisms nothing can
run yet and imprecise about the one mechanism that could ship next week.

## Cluster O — Rejected

- **kerem 19** (Zod emits a bare `id`). Executed against the pin: neither `id` nor `$id` is emitted, at
  root or nested. AD-13 stands. Keep one added clause noting `.meta({id})` names the `$defs` key, which
  is a live drift-check hazard.

## Second round — codex (18 findings, 13 critical)

Verdict: reject before implementation. Substantial overlap with clusters A through N, and six findings
no earlier pass produced. Three are load-bearing enough to change the rewrite's scope.

### Cluster P — The oracle expression has no polarity (codex 4)

**Disposition: accept. New, critical, and nobody else found it.** No rule says whether a `check`
resolving `true` means the expected behaviour held or the defect was detected. Given
`equality(/status, 200)` against a defect response of 500, one implementer reads `false` as `caught`
because expected behaviour failed, another reads it as `missed` because the check did not fire. Both
comply with the current prose and the two invert the score.

Cluster A's decision does not close this: with findings authoritative, `check` still needs a defined
polarity to serve as a corroboration signal, and the disagreement rule needs to know which direction
agreement means. Fix: one declared polarity for every check, plus a total table from expression result
and probe role to outcome state, with a fixture per cell. Codex also notes that an observed `"200"`
against an expected `200` becomes `oracle-error` under AD-26, so a runtime type defect is re-executed
as a broken measurement instead of caught — the same shape as cluster C and folded into it.

### Cluster Q — Canonical JSON is not closed over the published number domain (codex 13)

**Disposition: accept. New, critical, verified.** AD-27 mandates RFC 8785, which requires numbers
expressible as IEEE 754 doubles, while the published Draft 2020-12 schemas admit arbitrary-precision
integers. Verified directly: `9007199254740993` parses in JavaScript as `9007199254740992`. A
non-JavaScript producer can therefore emit an artifact its own parser preserves, its schema accepts, and
a JavaScript scorer silently rounds before hashing — so two conforming implementations disagree on the
canonical bytes of the same artifact. Fix: make JCS compatibility a schema invariant, restrict hashed
integers to the safe range, encode larger values as strings, reject lone surrogates and duplicate keys
before validation, and add cross-language canonicalization vectors to CI.

### Cluster R — The negative-fixture guard does not prove what it claims (codex 12)

**Disposition: accept; supersedes the weaker fix in cluster E.** Asserting that the published schema
rejects a violating fixture does not prove the intended constraint caused the rejection. A reject-all
schema passes every negative fixture, and a fixture violating three constraints is still rejected after
one silently vanishes. Fix: derive every negative case from a valid positive fixture by a single
mutation violating only the target constraint, and assert the expected validator keyword and instance
path. Positive cases for every conditional branch, plus differential tests comparing Zod acceptance
against published-schema acceptance. This is the correct form of the guard; cluster E's version detects
only the crudest failure.

### Cluster S — The probe port is an unpoliced network boundary (codex 15)

**Disposition: accept. New, high, and the only security finding in the round.** Pre-flight plans derive
from contract-declared interfaces, and a contract arriving through a pull request can declare a route at
loopback, a private address, or a cloud metadata endpoint, which a permissive reference adapter then
probes with the CI runner's network authority. Request-body sensitivity checks compound it by issuing
state-changing requests. The evaluator's network allowlist does not govern the prober. Fix: contracts
name logical interface identifiers only, the caller maps them to authorized base URLs outside the
contract, and the default denies loopback, private, link-local, and metadata addresses, with schemes and
methods constrained, redirects and resolved addresses revalidated, and time and byte caps.

### Cluster T — Stage products and artifact ownership (codex 8, codex 6 additions)

**Disposition: accept.** The closed eleven-artifact set omits the pre-flight plan, probe observations,
and ingested observations that its own pipeline requires, and the Evidence Artifact has two owners —
verified: several ADs bind it to the scorer while the seed assigns `emit/` its assembly. Fix: publish an
exact stage-signature table with every input, output, owner, and lineage edge, decide whether AD-24
closes public interchange artifacts or every internal artifact, and give the Evidence Artifact one stage.

Codex also adds two dominance defects beyond cluster F. The counted unit is unspecified, so ten
redundant oracles mapped to one probe yield either ten catches or one depending on the implementer — an
interop defect on the product's central output. And with severity excluded from comparison, a contract
catching nine cosmetic probes and missing the critical one dominates a contract that caught the critical
one. The severity decision already taken routes the verdict; this argues it also belongs as a dominance
dimension or a hard critical-miss constraint, neither of which requires a scalar.

### Cluster U — Licence allowlist rejects the repository's own toolchain (codex 17)

**Disposition: accept. Verified.** AD-25 permits MIT and Apache-2.0 only. The lockfile already carries
ISC (`picocolors`, `siginfo`, `signal-exit`, `yaml`) and BSD-3-Clause (`source-map-js`), and Biome
declares the dual expression `MIT OR Apache-2.0`, which a literal matcher also rejects. A CI check
implementing AD-25 literally fails on the first run. Fix: an explicit SPDX allowlist covering MIT,
Apache-2.0, ISC, BSD-2-Clause, BSD-3-Clause, and 0BSD, dual expressions handled, scanning the full
transitive graph and reporting the exact dependency path.

### Cluster V — The type surface is wider than the declared floor (codex 14)

**Disposition: accept.** Pinning `@types/node` to the 22 line was meant to stop typechecking against
APIs the floor lacks, and it does not go far enough: 22.20.1 describes APIs added throughout the line,
including `node:sqlite` from 22.5.0, while `>=22` promises support from 22.0.0. Code can typecheck and
fail on a permitted runtime. Fix: floor at `>=22.20.0` with the floor CI job on exactly 22.20.0.

### Cluster W — Cardinalities frozen while the core contracts stay open (codex 18, 3)

**Disposition: accept, and it reframes the rewrite.** The sharpest statement of the
over-specification question in the round, and it is self-demonstrating: codex findings 1, 3, 8, 9, and
10 each require adding or changing artifacts that AD-24 already closed by amendment rule. The spine
freezes an exact artifact count, an exact runtime-dependency count, and a directory tree while the trust
model, stage signatures, oracle polarity, coverage predicates, and attempt ledger are unresolved. Fix:
ADs keep the load-bearing contracts — trust and attestation, oracle semantics, stage signatures,
lineage, score identity, comparison semantics, coverage predicates, security boundaries — and the
peripheral cardinalities move to Structural Seed, with promotion to an AD only when two independently
built units could choose incompatibly.

On statelessness, codex goes past the earlier passes: a corpus digest detects changed bytes and cannot
detect that unchanged probe content was revealed to the author and reused, so "immutable for its scoring
version" is an identity statement rather than an enforcement mechanism. Either an append-only Evaluation
Session or Attempt Ledger with one stateful port holding authority, or the claims narrow to validating a
supplied chain while the caller owns enforcement.

## Open decisions

Four judgment calls that should not be resolved by an implementer, and two of them touch ADR-003.

1. **Exit-code policy.** tea 4 argues PASS and CONCERNS both exit 0, with `--strict` promoting CONCERNS,
   because exit 1 is indistinguishable from a crash and the predictable adopter response to a noisy gate
   is `|| true`, which discards FAIL too. This contradicts the PRD's "an exit code that reflects the gate
   verdict". Everyone agrees CONCERNS must move off 1 and that compile failure and faults need codes
   above the verdict range.
2. **Severity in the verdict.** tea 6 accepts refusing a severity-weighted strength score and rejects
   refusing severity in the *gate*, on the grounds that a gate treating a missed critical behaviour
   identically to a missed cosmetic one is as unbacked as an invented weight, and that AD-21 already
   admits one numeric bound of that shape. This partially reopens ADR-003 Decision 3.
3. **Whether AD-20's five rules stay closed.** Four missing classes were proposed independently:
   authorization and tenant scoping, state-change read-back, omission and completeness, and idempotency
   and state pollution. All four share a shape — every one of the five existing rules inspects a single
   present response. Omission is the sharpest, since the operator vocabulary has `absence` and no rule
   points an author at it. Options are to extend now, or to state that the five are exactly the classes
   the measured effect is attributed to and that cross-call and cross-principal probing is knowingly out
   of v0.
4. **Cluster A's direction.** Confirming that outcome state resolves from evaluator findings, with
   `check` demoted to compile-time enforcement plus corroboration, is the reading that preserves the
   measured claim. The alternative is to keep `check` authoritative and state plainly in ADR-003 that v0
   measures assertion authorship rather than the effect ADR-002 was built on.

### Resolved 2026-07-29

All four were decided in the user's favour of the recommended option: findings are authoritative with
`check` demoted to compile-time enforcement plus corroboration; PASS and CONCERNS both exit 0 with
`--strict` promoting CONCERNS; severity routes the verdict on the ratified `low|material|critical`
vocabulary while staying out of dominance; AD-20 gains omission and state-change read-back, with
authorization and idempotency held for v0.1 and the boundary stated.

### Second set, raised by codex

1. **The trust model.** Findings 1, 3, and 15 all resolve differently depending on whether a caller is a
   trusted recorder, a possibly buggy integration, or an adversary. Nothing in the spine states which,
   and the answer sets how much attestation machinery is worth building.
2. **The attempt ledger.** Either an append-only session artifact with one stateful port holding
   authority, or an explicit narrowing of AD-12 and AD-29 to chain validation with enforcement owned by
   the caller. Follows from the trust model.
3. **Spine restructuring.** Whether to demote the peripheral cardinalities to Structural Seed as codex,
   kimi, and kerem all independently recommended.
4. **The adoption bridge.** Kerem, kimi, and codex converged on a companion that produces a conforming
   run record, shipped as a sibling package so AD-2 stays intact. Codex goes furthest, wanting a corpus
   qualification command and a tutorial corpus as well.

## Dispositions applied 2026-07-29

All clusters are closed in `ARCHITECTURE-SPINE.md` revision 2, with the eight substantive decisions
recorded in `ADR-005-review-round-corrections.md`, three amendment notes added to ADR-003, and five to
the PRD. The spine went from 31 decisions to 38 while becoming less restrictive: seven new ADs cover the
trust model, outcome resolution and polarity, stage signatures and the orchestration layer, the probe
port's network policy, the canonical value domain, the port conformance suite, and the adoption path,
while the artifact count, the runtime-dependency count, the directory tree, and the reserved engine seam
stopped being amendment-controlled.

Four defects of the reviewers' own kind were then found in revision 2 by self-review before it was
declared done, and are fixed in it: AD-1 claimed core functions were *total* while AD-5 and the error
convention have core throw faults; AD-2 forbade all network I/O in the package while the Structural Seed
still shipped a fetch adapter, so v0 now ships no network adapter at all and the conformance suite is
what makes a caller-owned prober practical; AD-35's default-deny would have banned loopback outright,
which is where nearly every real fixture lives, so authorization is now explicit per target rather than
implicit by address class; and revision 1's fixed mapping of a satisfied zero-action probe to `caught`
had been dropped when AD-33 replaced it with a table, so it is restored as a named cell.

## Sequencing

Clusters A, B, and H touch the same decisions, and Cluster A changes what AD-6, AD-7, and AD-23 mean, so
a single rewrite is cheaper and safer than two passes. Codex's cluster W changes the rewrite's shape
rather than its content: several accepted fixes add artifacts that AD-24 currently freezes, so the
demotion of cardinalities should happen first or the rewrite spends its effort amending its own closure
clauses.

## What none of the three could settle

All three converged on the same limit, independently: nobody has authored a contract in this schema or
produced a conforming run record, so the shape of the caller's boundary is unvalidated. Kimi's estimate
is that one afternoon hand-authoring a brief and a conforming run record against a toy system would have
caught C-1, H-2, and H-11 before any review did. That is the cheapest next experiment and it belongs
before or inside the first epic, not after it.
