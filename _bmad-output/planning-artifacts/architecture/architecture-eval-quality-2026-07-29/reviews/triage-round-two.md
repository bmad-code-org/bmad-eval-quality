# Round 2 triage — 50 findings from four reviewers against spine revision 3

Kerem 7 (4 critical), TEA 8 (3 blockers), Kimi K3 22 (5 critical), codex 13 (11 critical). Three said do
not build; Kimi said build `compile` first and do not build `score` yet.

Overlap was low by design and the convergences are the signal: where two reviewers arrived at the same
defect from opposite directions, the defect is real and structural. Fifty findings reduce to **ten root
causes**, and their distribution is the round's actual conclusion — nearly every critical lives in
`score`, not in `compile`.

Every mechanically checkable claim was verified before acceptance. None failed.

## First, an error of my own

Two reviewers independently found that the spike chain I declared "internally consistent end to end" is
not. Verified all three:

| Claim | Verified |
| --- | --- |
| `malformed-write` matches zero observations, yet O-005 is recorded `confirmed`/`agrees` with a disposition narrating a 400 rejection that exists in no observation | Confirmed |
| `baseline-read` and `read-back` each match two observations (`obs-001`, `obs-004`) — identical operation and inputs | Confirmed |
| `for-all` over `notes: []` is vacuously true, so per-record completeness is `confirmed` over zero records while the contract's own setup declares three | Confirmed |

My checker validated shape — dispositions present, states within the closed set, no dangling references —
and never asked whether the artifacts' content supported their own claims. It checked that the chain was
well-formed and reported that it was *correct*. That is the same class of error the product exists to
prevent, committed in the artifact meant to prove the architecture works, one turn after I wrote that
hand-authoring beats document review. It also means the round-3 self-review was weaker than it read.

## Root causes

### R1 — Detection is unfalsifiable: no finding is ever matched to the seeded defect

**Critical. Kerem 1 and codex 2, from opposite directions. The finding of the round.**

Kerem built AD-33's table and found `missed` unreachable. Take an oracle that correctly confirmed an
untouched behaviour, and one that failed to detect the seeded defect. Six of AD-33's seven declared inputs
are identical — disposition `held`, no defect finding, probe class `defect`, `expectedClean` false, steps
reached, no waiver. The seventh is check resolution, which AD-3 forbids as the source of an outcome state.
So a table obeying AD-3 must give both rows the same answer: pick `confirmed` and every non-detection
scores as success; pick `missed` and every correct confirmation scores as a behavioural failure. **The
catch rate is 1.00 by construction.**

Codex reached the same place forward: a probe citation proves which run produced a finding, not that the
finding detected that probe's target. A buggy evaluator can cite P-001 on an unrelated defect and AD-33
still yields `caught` while the seeded defect stays missed. The original instrument avoided this with
blinded reviewers mapping findings to adjudicated defect identifiers after sealing — a step the
architecture has no equivalent of.

The missing input is nameable and AD-9 already collects it: every probe declares the behaviour it
exercises and the defect it seeds. AD-33 simply does not read it.

**Resolution.** A probe owns a defect signature. A probe counts `caught` only when a mapping identifies
its seeded defect in the cited evidence. That mapping is a stage, and whether it can be deterministic or
needs a blinded artifact is the first thing the reference implementation has to settle.

### R2 — Repeated trials have no reducer, and no stage can consume more than one run

**Critical. Codex 1, Kimi C-2 and C-3, TEA blocker 3.**

AD-7 computes a rate "across the declared trial count" and never says how several outcomes for one probe
become one probe result. For `caught, missed, missed`: an any-catch reducer reports 1/1, an all-trials
reducer 0/1, a probe-trial reducer 1/3. All three fit the words, and dominance flips between them. One
reading is pass-if-any — the retry anti-pattern AD-6 spends a paragraph forbidding — and with the minimum
at three it would be the normal case.

Worse, verified: no stage signature consumes more than one run record. `ingest` takes one record, manifest,
and configuration. So the default three-trial minimum is unreachable, every scored run is permanently
below-minimum CONCERNS with a non-comparable vector, and the product's central output cannot be produced
as specified. The instrument itself defined detection by defect identifier across repetitions with at
least two catches in three valid repetitions; the architecture cannot express that.

**Resolution.** `score` consumes a trial set. Reduce to one result per `(probeId, trialIndex)`, then
publish the trial aggregation with invalid trials and ties handled. Record both
`caughtProbeTrials / exercisedProbeTrials` and the policy's detected-probe threshold. Fixtures for every
permutation of one, two, and three catches.

### R3 — Observation selection is ambiguous, and the temporal clause is unimplementable

**Critical. TEA blocker 1, codex 3 and 4, Kimi H-1.**

Verified: `baseline-read` and `read-back` each match two observations, so a first-match scorer and a
last-match scorer bind different evidence and can produce opposite answers from one run record. AD-39
defines no cardinality rule, no tie-break, and no field recording which observation was used — and
explicitly forbids the only tie-break available, since ADR-006 says matching is never positional while
array order is the sole fact placing the read after the write. The run record carries no sequence number,
timestamp, or causal edge.

Codex adds that cross-step resource identity is inexpressible: for `POST /jobs` returning a generated
`jobId` and `GET /jobs/{jobId}`, a literal hard-codes a resource the evaluator did not create and `any`
matches unrelated reads. That is the most common real persistence pattern there is.

**Resolution.** Observations carry an explicit monotonic sequence and, where needed, causal predecessors.
Define selector cardinality: zero resolves through the outcome table, one binds, several produce a named
ambiguity condition. Every outcome records the observation identifiers it used. Add a narrow cycle-free
captured-value matcher for earlier scalar outputs, keeping the projection ban.

### R4 — Four tables are asserted; none exists, and one is unconstructable

**Critical. Kimi C-4, codex 5, 7 and 10, Kerem 2 and 6.**

AD-21, AD-31, and AD-33 each promise a total table with a fixture per cell. AD-24 promises an exact
stage-signature table and round 1 accepted that as a correction. None of the four is present. Kimi found
AD-33's arithmetically unmeetable as specified — over a thousand cells with positive and negative fixtures
— and four cells undecidable from the spine regardless. Kerem's R1 is the proof by construction.

Codex 7 is the sharpest instance: AD-3 requires an oracle's prose intent to direct the evaluator at the
same evidence as its check, and AD-31 says the compiler decides that. There is no semantic model, parser,
or port that can decide whether arbitrary prose and an expression mean the same thing. A rigorous check
paired with the intent "verify that this operation works" passes any syntactic compiler.

**Resolution.** Stop asserting tables. Implement AD-21, AD-31, and AD-33 as pure reference functions with
exhaustively generated fixtures, then publish the tables generated from them and prove every declared cell
is reached. For AD-3, make the evaluator-facing direction structured — evidence targets, relation,
polarity, scope, negative domain — and generate the prose from it, so alignment is constructed rather than
adjudicated.

### R5 — Quantifier and completeness semantics are open, and the completeness rule is unwritable

**Critical. Codex 6, TEA blocker 2, Kerem 3, Kimi H-2.**

Empty, absent, and non-collection operands have no defined quantifier result. Verified: the only contract
in existence relies on the vacuous case and certifies per-record completeness over zero records while its
own setup declares three.

The rule added in revision 3 is worse than incomplete. A response of `[n-1, n-1, n-1]` omits two of three
records and satisfies it, because quantifiers cannot range over a literal expected set and projection is
fenced out. Reconciling expected identifiers against actual records needs either nested quantification or
projection, and the grammar bans both — so the rule I added to close the omission gap cannot be written at
all. Kerem notes this is why the spike has no rule-6 oracle: the author could not have written one.

**Resolution.** Define quantifier results for empty, absent, and non-collection operands, failing closed.
Add machine-readable expected cardinality and reference-set declarations. Add exactly one bounded
relational operator — `covers-by-key(expected, actual, expectedKey, actualKey)` — rather than opening a
general expression language. Fixtures for positive, empty, duplicate, missing, and extra records.

### R6 — The scripted-arm prohibition is unenforceable, by two independent routes

**Critical. Kimi C-5, codex 8, Kerem 5.**

AD-39's distinction holds on its own terms and is enforced only against instruction. Two routes go around
it.

**Through the intent channel.** The evaluator receives `intent`, AD-3 requires it to direct the evaluator
at multi-step evidence, and no registry can parse prose. My own shipped O-001 intent is an imperative
script: "Change a note's title… then read that note back… The read must be an independent call." A literal
AD-5 compiler rejects the canonical contract; an AD-39 compiler accepts it. Both readings are supported by
normative text, and hiding step identifiers changes neither.

**Through punishment rather than instruction.** Kerem's route, and the more elegant one. Nothing bounds
plan length or `after` depth. Declare eight chained steps and write oracles naming late ones: every rule is
satisfied, and an evaluator that takes a different path leaves those oracles `unreached`, which routes to
CONCERNS, which `--strict` promotes to exit 1. The contract cannot command a path but can fail the build of
every evaluator that does not follow it — and because AD-16 keeps step identifiers out of the brief, the
evaluator is graded against a script it cannot see. AD-39's only defence names no predicate, no bound, and
no AD-5 code.

**Resolution.** Replace "prescribed action sequence anywhere" with a compiler-checkable boundary
calibrated against the actual plain, disciplined, and scripted experiment contracts, with accept and reject
fixtures in AD-5. Restrict `after` to naming a step that has no `after` of its own, permitting
read-after-write and forbidding chains. Remove `unreached` from `--strict` promotion, since AD-21 already
calls it an evidence condition rather than a claim about the system.

### R7 — Mode separation is incomplete

**Critical. Codex 9, Kerem 2, Kimi H-4.**

AD-21 says a scoring-mode recommendation is recorded without promotion, then carries unqualified FAIL and
CONCERNS rungs that promote every ingested recommendation. Verified in the text: the same artifact derives
CONCERNS or FAIL depending on which sentence is obeyed, two exit codes apart. Mode is also absent from the
sealed run record and from AD-11's identity inputs, appearing first in the evidence artifact — so the same
sealed run can be relabelled after ingest and scored under the same scoring version.

**Resolution.** Separate `ProductionAssessment` and `ContractAssessment` input types with their own total
tables. Mode is declared before ingest and enters identity. Cross-mode comparison is rejected. The
contract table never reads the system recommendation as a verdict input.

### R8 — `requestShape` has no transport structure

**High. Kerem 4.**

`requestShape` is required keys, permitted keys, and per-key JSON type, with no notion of path parameter,
query parameter, header, or body. So `call-inputs` is unspecified as an evidence root, no header can ever
be declared or addressed, and the authorization and tenant-scoping rules AD-20 defers to v0.1 need a
principal that lives in a header. That deferral is therefore a breaking grammar change, not the additive
version bump AD-20 anticipates.

**Resolution.** Give the request shape declared channels and make `call-inputs` address them, before the
grammar has consumers.

### R9 — Uncited defect findings route nowhere, and they are the product's own success metric

**High. TEA mitigate 6.**

Revision 3 correctly retains a finding that cites no oracle. Then nothing consumes it: no outcome state, no
rate, no verdict rung. SM-D4 in the PRD is "at least one defect is found through an evaluator-chosen action
absent from the pre-canned baseline" — the differentiating result of the whole experiment. An evaluator that
discovers a genuine uncontemplated defect produces a line in an array and exit code 0. On the one run that
exists, this already happened.

**Resolution.** Give an uncited `defect` finding a rung. In production mode it is at least CONCERNS. In
contract-scoring mode it is the strongest available evidence of a coverage gap and should record one, which
is precisely what VFR-7 exists to report.

### R10 — Environment, registry, and enforcement gaps

All verified; each individually cheap.

- **npm at the declared floor silently disables both supply-chain controls (codex 13, high).** Node 22.20.0
  bundles npm 10.9.3. `min-release-age` arrived in npm 11.10.0 and `allow-git` in 11.15.0, so the floor CI
  job accepts both keys and ignores their behaviour. Verified against the Node tag. Pin npm ≥11.15,
  bootstrap it before dependency resolution, and add a canary proving a too-young package is rejected.
- **AD-36's "exactly representable decimal" rejects its own reference artifacts (codex 11, critical).**
  Verified: `0.95`, `0.99`, `0.8`, `0.04`, and even `62.5` all fail a literal exact-decimal reading. Define
  the domain as finite binary64 plus safe-integer semantics and carry exact-decimal values as strings.
- **Unsupported interface kind has no AD-5 code (codex 12, high).** AD-10 requires compilation to fail for
  `web`, `cli`, and `mcp`; AD-5 is the closed registry and has no such class, so the settled API-only scope
  has no conforming implementation path.
- **Body sensitivity was over-corrected in round 1 (TEA mitigate 4).** Deleting the "where it applies"
  hedge was right; binding the check to the interface rather than the operation means an id-blind read stub
  passes via a body-sensitive sibling, and on a read-only interface the mandatory check cannot be performed
  at all under AD-35's safe-method rule. Bind per operation.
- **Three dispositions cannot separate an evaluator that chose not to act from a system that never
  responded (TEA mitigate 5).**
- **Burn-in covers the wrong non-determinism (TEA monitor 7).** Both burn-in and the no-quarantine rule are
  round-1 fixes of mine aimed at flaky tests; the non-determinism that will hurt is in the scorer. Add two
  fixture families: score a fixed record N times and assert byte-identical evidence, and score it with the
  observation array permuted and assert identical outcomes. The second would have caught R3.
- **The development corpus is required to cover probe classes but not discipline rules (TEA monitor 8,
  Kerem 6).** On the one contract that exists, AD-31 under-fires on two of seven rules and nothing surfaces
  it. AD-30 should require the worked example to exercise every AD-20 rule as satisfied or gapped.
- **AD-13's stated reason for output mode does not hold for the schemas the conventions mandate (Kerem 7).**
  Verified on an install: on `.strict()` objects both modes emit `additionalProperties` identically, and the
  conventions require strict everywhere. The decision is right and the recorded reason would mislead the
  next maintainer; the byte-exact drift check is what actually protects the keyword.

## Empirical claims that held

Reported because four rounds of verification have produced exactly one false factual claim, and knowing
which parts are solid is worth as much as knowing which are not. Zod 4.4.3 confirmed on execution for
output-mode behaviour, absent `$id` across five variants, silently dropped refinements with zero bytes on
stderr, absent native array `contains`, discriminated-union export, and `.meta({ id })` naming `$defs`. The
`9007199254740993` rounding case reproduces. All four TypeScript 7 migration changes land on real
repository state, including TS2882 and TS5011 reproduced on execution. Biome's one-patch lag is genuinely
the seven-day window, and 2.5.6 is intentionally too young. The AD-25 licence allowlist matches the current
lockfile. Spine lint, `npm run validate`, `check:docs`, and Biome all pass — and, as three reviewers noted
unprompted, exercise the one-file scaffold rather than any architecture mechanic.

## Where the criticals live

| Root cause | `compile` | `score` |
| --- | --- | --- |
| R1 detection unfalsifiable | — | yes |
| R2 no trial reducer | — | yes |
| R3 observation selection | partly | yes |
| R4 tables absent | yes | yes |
| R5 quantifiers and completeness | yes | — |
| R6 scripted-arm unenforceable | yes | partly |
| R7 mode separation | — | yes |
| R8 request shape | yes | — |
| R9 uncited findings | — | yes |
| R10 environment and registry | yes | — |

`compile` carries five root causes, all of them specification gaps with named resolutions. `score` carries
six, and three of those — R1, R2, R3 — are not specification gaps. They are questions about how a
measurement instrument behaves, and prose has now failed to settle them across four rounds.

## Recommendation

**Stop writing architecture for `score`.** Four rounds and roughly 230 findings, and the score half keeps
producing new criticals of the same kind because it is being specified in prose rather than built. Every
reviewer who proposed a next step for it proposed the same one independently, and so did I: implement
AD-21, AD-31, and AD-33 as pure reference functions with generated fixtures, run them against the spike
chain and synthetic records, and let the tables be output rather than promise. Kimi estimates half a day
for the AD-33 procedure and notes it would have prevented the chain inconsistency.

Close the `compile` root causes in a revision 4 — R5, R6, R8, R10, and the compile half of R4 all have
concrete resolutions — and take `compile` into epics, which is where AD-38 already puts the first one.
Leave `score` at revision 3 with its defects recorded, and let the reference implementation write its
architecture.

## Dispositions applied in revision 4

Decision taken: split the spine as recommended, with R1 as the one score-side question settled now rather
than deferred. Recorded as [ADR-007](../ADR-007-compile-score-split.md).

| Root cause | Disposition | Where |
| --- | --- | --- |
| R1 detection unfalsifiable | **Accepted and closed.** New AD-40: probes declare a machine-readable defect signature, and a probe resolves `caught` only when a mapping identifies its seeded defect among the findings cited against it. Deliberately does not claim the mapping is mechanical | AD-40, AD-9, AD-33, AD-7 |
| R2 no trial reducer | **Accepted, recorded open.** Not settled in prose; AD-7 now says explicitly that it has not been settled | Owed item 1 |
| R3 observation selection | **Accepted, recorded open.** AD-39's claim that matching was decided is withdrawn. Cross-step resource identity recorded separately | Owed items 2 and 3 |
| R4 tables absent | **Accepted, split.** The compile-side half is closed: AD-3's direction is structured so AD-31's predicate is computable rather than adjudicated, and AD-31's table is generated from the implementation. The score-side halves become generated output or open items | AD-3, AD-31, AD-33, Owed item 6 |
| R5 quantifiers and completeness | **Accepted and closed.** Empty and absent operands resolve false; non-collection operands are a compile error; `covers-by-key` added; AD-19 declares expected cardinality and reference sets | AD-4, AD-19, AD-20, AD-5 |
| R6 scripted-arm unenforceable | **Accepted and closed, both routes.** The prohibition becomes a checkable witness-relation boundary calibrated against the experiments' three arms; `after` is bounded to one level; `--strict` no longer promotes an evidence-only CONCERNS | AD-5, AD-3, AD-39, AD-21 |
| R7 mode separation | **Accepted, recorded open.** AD-21 now states the contradiction rather than reading as though it were resolved | Owed item 4 |
| R8 request shape | **Accepted and closed.** Four declared transport channels; `call-inputs` addresses them | AD-19, AD-26 |
| R9 uncited findings | **Accepted, recorded open.** Also flagged in the PRD against SM-D4 | Owed item 5 |
| R10 environment and registry | **Accepted and closed.** npm ≥11.15.0 pinned and asserted with a policy canary; numeric domain is finite binary64; `unsupported-interface-kind` added to AD-5 along with two codes revision 3 owed; input sensitivity moves to per-operation; scorer determinism and permutation fixtures added; corpus covers each discipline rule; AD-13's output-mode reason corrected | Stack, AD-36, AD-5, AD-10, AD-30, AD-38, AD-13 |
| Spike chain inconsistency | **Accepted, retraction published, chain left uncorrected.** Two of the three defects are downstream of R2 and R3, so a hand-fix would fabricate conformance. Regenerated from the reference reducer or not at all | `spike-worked-example/FINDINGS.md`, Owed item 7 |

Nothing was rejected. Four table promises were withdrawn rather than answered, which is a disposition the
previous rounds had no category for.

Verified after application: 40 ADs in sequence with no gaps, every referenced AD declared, `check:docs`
passing on 31 files, Biome clean, tests passing, and eleven HTML artifacts rebuilt including ADR-007.
