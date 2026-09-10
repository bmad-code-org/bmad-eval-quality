---
title: 'An end-to-end run against a service the suite starts'
type: 'feature'
created: '2026-09-09'
status: 'done'
review_loop_iteration: 0
route: 'dispatch'
context:
  - _bmad-output/implementation-artifacts/epic-11-context.md
  - _bmad-output/implementation-artifacts/11-8-the-published-surface-the-corpus-and-the-census.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `docs/index.md:79` gives the AI-feature shape the state "The shape the library was designed around. No live service has been evaluated yet", and `docs/how-to/evaluate-ai-feature-behavior.md:227-229` says exactly why: the one complete chain in the repository is a toy Notes API "with no running service behind it, and its observations are authored evidence". Everything downstream of those observations is a shipped function's return value, rebuilt by `npm run check:worked-example` on every validate. The link upstream of them has never been exercised: no probe in this tree has ever issued a real request at a real service and handed what came back to the chain. FR38 (`_bmad-output/planning-artifacts/epics.md:154`) names that as one of the epic's three evidence gaps.

**Approach:** Stand up the Notes API the worked contract already describes on loopback, in two builds, one clean and one carrying D-001. Drive pre-flight and both arms through `createProbeSubjectAdapter` (`tests/adapters/probe-subject.ts:260`), the `EnvironmentProbePort` implementation that already passes all nineteen published conformance assertions over a real server (`tests/adapters/probe-subject.test.ts:34-40`). Map what the probe observed onto a sealed run record, score it through `ingest`, `score` and `emit`, and assert the verdict, the witness match, and both AD-30 determinism families over the record the live run produced. Nothing new ships under `src/`.

## Boundaries & Constraints

**Always:**

- The run is real HTTP over a loopback server the test started itself. NFR7 (`_bmad-output/planning-artifacts/epics.md:53`) permits it by naming AD-37's loopback fixture server, and Decision 5 records this run as a second use of AD-30's carve-out at `ARCHITECTURE-SPINE.md:448`.
- The port implementation the run drives is `createProbeSubjectAdapter`, the AD-37 subject. The run adds routes and a policy; it adds no second HTTP client.
- The AD-35 authorization names one exact target: scheme, host, the ephemeral port read back from the listening socket, one address, and an enumerated method set. The deny-by-default entries `buildSubjectPolicy` (`tests/adapters/probe-subject.ts:602-630`) already carries stay in the policy the run uses, so the denial paths remain live in the same object.
- Every artifact handed to a `core/` stage is an in-memory value. No test reads or writes a file, per AD-30.
- The chain's inputs come from `buildWorkedExampleChain()` (`scripts/worked-example-target.ts:1192`), imported as values on the precedent `tests/score/worked-example.test.ts:9-12` sets: "read as values, not bytes, so nothing here touches the filesystem".
- Every comment and `.describe()` this story writes gets the voice pass while it is written. After editing, grep the edited files for `, not `, `rather than`, `instead of`, `as opposed to`, `, never `, `no longer` and keep only the hits where both halves carry a fact.
- `check:boundary` scans `src/` and `corpus/` for epic, story, acceptance-criterion, task and decision numbers. This story writes under `tests/` and `docs/`, and it introduces no such token anywhere.

**Ask First:**

- Any file under `src/adapters/`. Decision 1 settles that this story adds none, and a shipped `api` adapter would reverse a published product decision.
- Any change to `scripts/worked-example-target.ts` or the five committed files at `WORKED_EXAMPLE_FILES` (`:73-79`). The authored chain is the control this run is measured against.
- Any dev-corpus member, any census constant, any spelled-out numeral. Decision 6 states this story's arithmetic as zero.

**Never:**

- No reference `EnvironmentProbePort` for `api` under `src/adapters/`. `docs/reference/cli-commands.md:223` states "there is no reference `EnvironmentProbePort` for `api`, because probing a live HTTP environment is the part only you can write", and that sentence survives this story unchanged.
- No weakening of AD-2. `docs/explanation/what-ships.md:30` reads "It executes nothing... and it ships no network adapter", and it stays true byte for byte: `tsconfig-build.json` excludes `tests/`, so the adapter this run drives never reaches `dist/`.
- No claim that a third-party production AI feature has been evaluated. Nobody has, and Decision 7's replacement prose says so in both places.
- No closing of the two items at `docs/how-to/evaluate-ai-feature-behavior.md:236-238`. The held-out probe corpus and the second experiment round stay owed, worded as `docs/explanation/what-ships.md:48-49` already words them.
- No new committed bytes under a byte gate. A live run inside a generator would make committed bytes depend on a listening socket.
- No spine revision and no new ADR. Every ambiguity below is settled here.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Pre-flight over the clean build | The compiled worked contract and its probe, the live server, the run's policy | `runPreflight` issues every planned leg through the port and returns `passed: true`; the two `get-note` sensitivity legs get different bodies for `n-1` and `n-2`, so the witness relation holds on observed bytes | A failed verdict is investigated as a fixture defect before the run is accepted |
| The mutated arm | The build where `PATCH /notes/{id}` returns the updated note and never writes | The read-back `GET` observes the pre-update title, so D-001 manifests over the wire | A mutated arm that passes means the seed did not take, and the run fails loudly |
| Scoring the live record | The sealed run record built from observed evidence | `emit` returns a contract-scoring artifact whose verdict and whose AD-40 witness match equal the authored chain's | A divergence from the authored chain is named with its cause before it is accepted |
| Repeat determinism | The same live record scored twice | Byte-identical evidence, per AD-30's first fixture family (`ARCHITECTURE-SPINE.md:450`) | Any difference is a defect in `core/` and is fixed there |
| Permutation determinism | The same live record with `observations` permuted | Identical outcome states and identical verdict, per the second family | Same |
| An unauthorized target | A request naming an interface the run's policy does not authorize | `forbidden-target` throws before any socket opens, and the hop counter stays at 0 | The fault is the expected result |
| Two servers in one vitest run | `listen(0)` per server | Distinct ports, each authorization minted from its own reported port | A fixed port collides under parallel workers and the flake reads as a policy failure |
| Response over the run's byte cap | A notes list larger than the authorization's `maxResponseBytes` | `budget-exhausted` throws | The run's caps are sized to the Notes payloads, so this is a regression signal |

</frozen-after-approval>

## Code Map

**What the run drives, all of it already in the tree**

- `tests/adapters/probe-subject.ts:1-16` -- the header recording that this file is AD-37's in-repository subject and "the only place here that uses AD-30's carve-out", and that it lives under `tests/`, "which `tsconfig-build.json` excludes, so it never reaches `dist/` and AD-2's 'v0 ships no network adapter at all' holds literally".
- `:129` `nodeHttpMechanism` -- the real hop over `node:http`, with the byte-counted response cap and the validated-address connect.
- `:260` `createProbeSubjectAdapter` -- the `EnvironmentProbePort`. Policy first, then the hop, with every redirect revalidated.
- `:462` `startFixtureServer` -- binds `127.0.0.1:0` and reads the port back, with its own socket set so a hung connection cannot outlive the test.
- `:602` `buildSubjectPolicy` and `:632` `buildSubjectTargets` -- one authorized entry at `:605-617` and six denial entries at `:618-627`, with `buildSubjectTargets` adding an eighth target the policy never names. That is the shape the run's own policy copies.
- `:39-42` `MAX_REDIRECTS`, `MAX_ELAPSED_MS` (250), `MAX_RESPONSE_BYTES` (256), `MAX_REQUEST_BYTES` -- sized for the conformance fixtures. The Notes payloads need their own numbers.
- `tests/adapters/probe-subject.test.ts:34-40` -- the nineteen-outcome conformance pass over a live loopback server, which is what certifies it as a subject.

**The chain**

- `src/application/preflight.ts:111` `runPreflight` -- the one place a probe is awaited. It plans, issues every leg in plan order, reduces, and returns a parsed verdict.
- `src/core/preflight/plan.ts:43-48` `PlannedLegPurpose` -- five members: `sensitivity`, `control-observe`, `control-mutate`, `control-reset`, `seeded-fault`. The worked contract's `fixtureReset` is `null`, so no reset leg is planned and Story 11.11 keeps that evidence.
- `scripts/worked-example-target.ts:1178-1186` `WorkedExampleChain` and `:1192` `buildWorkedExampleChain` -- the compiled contract, the sealed brief, the signed probe, the authored record, and the authored artifact, all as values.
- `src/core/schemas/port-messages.ts:151-161` `ApiProbeObservation` -- `status`, `headers`, tagged `body`.
- `src/core/schemas/sealed-run-record.ts:222-272` `Observation` -- thirteen fields, none of them a clock, a duration, or an address. `:233-237` `provenance` carries AD-23's `baseline` and `evaluator-chosen` split, which Decision 3 settles for this run. `:295-308` `ResourceUse` carries the two values a live harness would otherwise vary.
- `src/core/score/witness.ts` `matchProbeWitness` -- the AD-40 match the live run has to reproduce.

**The rules**

- `ARCHITECTURE-SPINE.md:448` (AD-30) -- "no test performs filesystem I/O outside a temporary directory or network I/O beyond a loopback fixture server it started itself — that carve-out exists solely for AD-37's suite, which cannot assert a network policy without a network."
- `:450` -- the two determinism families: byte-identical evidence on repeat, identical outcomes under permutation. NFR9 restates them at `_bmad-output/planning-artifacts/epics.md:55`.
- `:486` (AD-35) -- "loopback, private, link-local, and metadata addresses are denied unless the mapping explicitly authorizes that exact target — explicitly, because a fixture on localhost is the normal case and a blanket loopback ban would make the product untestable."
- `:528` (AD-40) -- "a probe is exercised when the *evaluator* invoked its signature's home operation", and "an operation appearing solely in a harness baseline, a fixture set-up call, or an aborted in-flight call the run record shows never completing is not the evaluator having exercised anything". An unexercised probe's required check resolves `not-applicable`. This is the rule Decision 3's provenance choice answers to.
- `_bmad-output/planning-artifacts/epics.md:53` (NFR7) -- "no network beyond AD-37's loopback fixture server". Its wording names the server; AD-30's names the suite. Decision 5 turns on that difference.
- `_bmad-output/planning-artifacts/epics.md:784` -- the epic's own settlement: this story "uses the loopback fixture server NFR7 already carves out for AD-37's suite and adds no `api` adapter under `src/adapters/`".
- `package.json:81` -- `test:conformance` runs `tests/adapters tests/testing tests/conformance`. `package.json`'s `validate` ends in `test:coverage`, which is the whole suite, so a file under `tests/adapters/` runs in both.

**The documentation this story owns**

- `docs/index.md:79` -- the AI-feature row's State cell.
- `docs/how-to/evaluate-ai-feature-behavior.md:225-233` -- the "Where this stands" block, less its last line. `:234` carries the corpus total and the `api`-declaring count, which Story 11.8 corrects and its `check:doc-counts` table then gates, so this story reads it and leaves it. `:236-238` and `:240` stay.
- Handed to Story 11.9 by name and untouched here: `docs/index.md:72` and `:84`, and every tool-use sentence.
- Handed to Stories 11.4 and 11.5 by name and untouched here: the accepted-kinds transcription at `docs/how-to/evaluate-ai-feature-behavior.md:12-16`. `:14` is Story 11.4's under the epic's ownership table, because 11.4's operation branch is what falsifies "`apiShapedInterface` carries `api`, `web` and `mcp`"; `:15`'s supported-kinds sentence follows Story 11.5, which opens the kind.

## Tasks & Acceptance

**Execution:**

- [x] `tests/adapters/notes-service.ts` -- the fixture server for the worked contract's three operations, in two builds selected by a flag: clean, and one where `PATCH /notes/{id}` validates, returns the updated note with `ok: true` and status 200, and skips the write. Seed at least `n-1` and `n-2` with different titles so the `get-note` sensitivity relation resolves on observed bytes. Bind `127.0.0.1:0` and report the port, following `startFixtureServer`'s socket-set teardown.
- [x] `tests/adapters/notes-service.ts` -- the run's `ProbeTargetPolicy` and target map: one authorization keyed on the contract's `notes-api` logical id, minted from the reported port, with `addresses: ['127.0.0.1']`, `methods`/`safeMethods` covering exactly `GET` and `PATCH`, and caps sized to the Notes payloads, since `MAX_RESPONSE_BYTES` is 256 and a notes list exceeds it. Carry `buildSubjectPolicy`'s denial entries through, so the deny-by-default half is exercised by the same object.
- [x] `tests/adapters/live-api-chain.test.ts` -- pre-flight: `runPreflight` over the clean build through `createProbeSubjectAdapter`, asserting `passed: true` and one observation per planned leg.
- [x] `tests/adapters/live-api-chain.test.ts` -- the two arms: replay the authored chain's interaction plan through the same port against the clean build and the mutated build, and map each `ApiProbeObservation` to an `Observation` per Decision 3, copying `observationId`, `sequence`, `provenance` and `principal` from the authored observation at the same position.
- [x] `tests/adapters/live-api-chain.test.ts` -- the score: assemble the sealed run record from the observed evidence and the authored dispositions and findings, run `ingest`, `score` and `emit`, and assert the verdict, the AD-40 witness match, and `strength` against the authored chain's.
- [x] `tests/adapters/live-api-chain.test.ts` -- both AD-30 families over the live record: score it twice and compare serialized bytes; score it with `observations` permuted and compare outcome states and verdict.
- [x] `tests/adapters/live-api-chain.test.ts` -- the denial case: one request naming an unauthorized target, asserting `forbidden-target` and zero hops.
- [x] `docs/index.md` -- replace the AI-feature State cell with Decision 7's cell.
- [x] `docs/how-to/evaluate-ai-feature-behavior.md` -- replace the "Where this stands" opening with Decision 7's block. `:234`, `:236-238` and `:240` are re-read and left as written.
- [x] `_bmad-output/project-knowledge/learning-path-step-by-step.md` -- one step following `learning-path-template.md`, numbered next after the last Epic 11 step present, plus its table row.

**Acceptance Criteria:**

- Given the live server and the run's policy, when `runPreflight` runs over the clean build, then it returns `passed: true`, every leg was answered by a real socket, and no leg was answered from a fake.
- Given the mutated build, when the arm's read-back `GET` runs after a `PATCH` that reported success, then the observed body carries the pre-update title, so D-001 manifests over the wire.
- Given the sealed run record built from the live observations, and given Decision 3's premise that each observation carries the authored chain's `provenance` so the two records differ only in the bytes a socket produced, when it is scored, then the verdict, the witness match and the strength vector equal the authored chain's, and any difference is named with its cause in this story's own record before it is accepted.
- Given that same record, when it is scored twice, then the serialized evidence is byte-identical; and when its `observations` array is permuted, then the outcome states and the verdict are identical.
- Given `git grep` over the diff, when it runs, then no file under `src/adapters/` is added or changed, and `docs/reference/cli-commands.md:223` and `docs/explanation/what-ships.md:30` are unchanged.
- Given `npm run validate`, when it runs, then it exits 0 with nothing on stderr, `check:worked-example` needed no regeneration, and the `src/core/**` coverage floor is unmoved because this story adds no `src/` code.
- Given `docs/index.md:79` and `docs/how-to/evaluate-ai-feature-behavior.md:225-233` after the edit, when read, then neither claims a third-party production feature has been evaluated, neither claims the package executes anything under evaluation, the guide block says the evaluator is not real and the findings are authored, both carry the one-trial non-comparable limit, and both name what the caller writes. Given `git diff` over the same two pages, then no numeral `check:doc-counts` gates was touched, `:234` included.

## Decisions settled by construction

**Decision 1: no `api` adapter ships, and the run is driven by the AD-37 test subject. Both options are priced here because the answer decides the whole story.**
Option A ships something like `createHttpProbeAdapter` under `src/adapters/`. It costs four published reversals for zero additional evidence. `docs/reference/cli-commands.md:223` says the absence is deliberate and gives the reason. `docs/explanation/what-ships.md:30` says the package "ships no network adapter", and `epic-11-context.md:136` records that AD-2's own history deleted the network exception where narrowing it was the option on the table. The reference-adapter count at `what-ships.md:20` and `cli-commands.md:223` is one of the numerals Story 11.8's `check:doc-counts` gates, so an adapter would collide with that story's table. And a shipped adapter inherits AD-37's obligation of its own arm and its own `CONFORMANCE_OUTCOME_COUNTS` entry (`src/testing/conformance.ts:40-46`).
Option B drives `createProbeSubjectAdapter` (`tests/adapters/probe-subject.ts:260`). It is a real `EnvironmentProbePort` over `node:http`, it validates every target and every redirect against AD-35's policy, and it passes all nineteen published conformance assertions over a live loopback server (`tests/adapters/probe-subject.test.ts:34-40`). Measured against the claim this story exists to earn, real HTTP and a real probe, Option B delivers the same evidence and reverses nothing. Take Option B. `_bmad-output/planning-artifacts/epics.md:784` settles it the same way, and if a later story concludes an `api` adapter is genuinely required, that is a product decision to reopen in the open, under its own story.

**Decision 2: the run authorizes its own fixture server by naming it exactly, and that is the branch AD-35 wrote for this case.**
`ARCHITECTURE-SPINE.md:486` denies a loopback address "unless the mapping explicitly authorizes that exact target", and the clause immediately after gives the reason: "a fixture on localhost is the normal case and a blanket loopback ban would make the product untestable, while an implicit loopback allowance is what lets a pull-requested contract reach an unintended local service". The run's authorization is one entry naming `http`, `localhost`, the exact port the socket reported, `addresses: ['127.0.0.1']`, and `GET` plus `PATCH`. It is minted per run from a port the process itself owns, so it cannot name a port another process holds. Nothing in `src/` gains a loopback exemption, no wildcard is introduced, and the six denial entries `buildSubjectPolicy` carries at `:618-627` stay in the policy object the run uses, so the deny-by-default half is exercised alongside the allowed one. The policy is data handed to an adapter, which is precisely where AD-35 puts authorization.

**Decision 3: the arms run through the same port, the mapping from observation to record is the test's, and observation provenance is copied from the authored chain.**
`ApiProbeObservation` (`port-messages.ts:151-161`) carries `status`, `headers` and a tagged `body`; `Observation` (`sealed-run-record.ts:222-272`) wants `responseStatus`, `responseHeaders` and an untagged `responseBody`. The mapping unwraps the tag: `json` yields its value, `text` yields its string, `absent` yields `null`. Request channels become `callInputs`, and `stdout`, `stderr`, `exitCode` and `artifacts` take the empty shapes an api observation has: `{ kind: 'absent' }`, `null`, and `{}`. `observationId`, `sequence`, `provenance` and `principal` are copied from the authored chain's observation at the same position, and that copy is decided here.

`provenance` (`sealed-run-record.ts:233-237`) is the one of those four the scorer reads. AD-23 splits `baseline` from `evaluator-chosen` and its `.describe()` calls that split "the one the product's central finding rests on". AD-40 at `ARCHITECTURE-SPINE.md:528` makes it load-bearing: a probe is exercised only when the evaluator invoked its signature's home operation, and "an operation appearing solely in a harness baseline" is not that, so a record labelling all five legs `baseline` leaves every probe unexercised, resolves each required check `not-applicable`, and returns a different verdict and a different strength vector from the authored chain's. The authored chain labels `obs-001` and `obs-002` `baseline` and `obs-003` through `obs-005` `evaluator-chosen` (`scripts/worked-example-target.ts:892`, `:919`, `:943`, `:970`, `:997`), `principal` is `null` in all five, and `sequence` runs 1 through 5 in plan order. The test issues those same five legs in that same order, so carrying the four fields forward describes the run the test performed and leaves the observed bytes as the only thing that moved.

The option turned down is having the harness mint provenance itself. No evaluator runs in this test, so a label it invented would be a value with nothing behind it, and the equality acceptance would then be testing the harness's guess as well as the service's responses. Copying keeps the acceptance a test of the bytes. The cost is stated in the open: this record's provenance is inherited, so the run proves the transport hop and reuses the authored chain's account of which observations an evaluator would have chosen. Decision 7's guide block says that in the published prose, and the acceptance criterion for the verdict, the witness match and the strength vector names this copy as its premise.

This mapping is the sealing step `what-ships.md:30` assigns to the caller. Writing it in the test file is what keeps the boundary visible: a library function doing the same work would be the package sealing a run. Downstream consequence: whoever writes the first real adapter writes this same twenty-line mapping and supplies real provenance from a real evaluator, and this file is what they can read.

**Decision 4: the chain stays deterministic because the shipped stages read no clock, and nothing is excluded from the byte check.**
`grep -rn "Date.now\|new Date\|Math.random\|crypto.randomUUID" src/core src/application` returns nothing, so every stage is a pure function of its artifacts. `Observation`'s thirteen fields carry no timestamp, no duration and no address, and the `EvidenceArtifact` carries none either. AD-35 keeps host and port out of the contract, so the ephemeral port never enters a hashed artifact. That leaves one place a live run could inject variance: `ResourceUse.wallClockSeconds` and `costUsd` (`sealed-run-record.ts:295-308`), which the harness declares. The arms are unbilled and no scoring predicate reads either field, so the harness pins both to the authored chain's values, and the record it produces is a deterministic function of the service's responses. Both AD-30 families at `ARCHITECTURE-SPINE.md:450` then run over that record with nothing excluded. What is deliberately not byte-gated is the run itself: the test asserts values, on the same reasoning `tests/score/worked-example.test.ts:9-12` states for the authored chain.

**Decision 5: this is a second use of the loopback carve-out beyond the conformance suite, NFR7 is the permitting text, and the widening is recorded here.**
`ARCHITECTURE-SPINE.md:448` permits "network I/O beyond a loopback fixture server it started itself" and scopes the carve-out to "AD-37's suite, which cannot assert a network policy without a network". `tests/adapters/live-api-chain.test.ts` is a new test whose purpose is an end-to-end evaluation, so on the strict reading of that sentence it is a second use of the carve-out for a purpose the sentence does not name. This story says so plainly and does not claim AD-30's letter.

NFR7 (`_bmad-output/planning-artifacts/epics.md:53`) is the text that permits it: "no network beyond AD-37's loopback fixture server". Its wording is scoped to the server, where AD-30's is scoped to the suite, and this run starts that server. It uses `startFixtureServer`'s construction (`probe-subject.ts:462`), it drives `createProbeSubjectAdapter` (`:260`), which is AD-37's own certified subject, and it lives in `tests/adapters/`, the directory `package.json:81` already names for `test:conformance`. `_bmad-output/planning-artifacts/epics.md:784` settles the same thing at epic level: this story "uses the loopback fixture server NFR7 already carves out for AD-37's suite".

The widening is recorded by construction in this story, with no spine revision and no ADR. Downstream consequence: the carve-out now has two named uses, the conformance suite and this evaluation, each in `tests/adapters/`, each starting its own server, each driving the same certified subject. A later story wanting a third cites this decision and names its own purpose the same way. The day that list stops being enumerable in a story is the day AD-30's sentence is worth reopening.

**Decision 6: this story moves no count, and it transcribes none.**
It adds no dev-corpus member, so `DEV_CORPUS_CONTRACTS` (`tests/coverage/fixtures/corpus.ts:555-559`) is untouched, `corpus/dev/index.json` keeps its entry count, and none of the spelled-out numerals in `scripts/dev-corpus-target.ts` (`:65`, `:108`, `:114`, `:115`, `:117`) moves. It adds no entry to Story 11.8's `check:doc-counts` table and changes none of the numerals that table gates. It moves no census constant and no conformance outcome count, because it adds no assertion to a published suite.

The corpus total and the `api`-declaring count at `docs/how-to/evaluate-ai-feature-behavior.md:234` sit inside the block this story rewrites, and this story writes neither of them down. Stories 11.8, 11.10 and 11.11 each move the corpus, each states its own arithmetic, and `check:doc-counts` holds the result from Story 11.8's boundary onward. A count copied into this file would be the post-11.8 state and false by the time this story runs, so Decision 7's replacement block stops at `:233` and leaves `:234` to the gate. The implementation pass re-reads the tree, confirms the gate is green over that line, and asserts every total it inherits unchanged. Zero is this story's whole contribution.

**Decision 7: the exact replacement sentences, written here so the claim is reviewed before the code exists.**
`docs/index.md:79`'s State cell becomes:

> Proven end to end against a loopback fixture the suite starts: a real probe observes a seeded defect over HTTP and the chain scores it, one trial, marked non-comparable. No third-party AI feature has been evaluated; pointing this at yours is the adapter and the two arms you write.

Four things in that cell are load-bearing. "Loopback fixture" says the service is the toy Notes API this repository ships, with no AI in it. "Observes" gives the probe the transport hop and leaves the catch to the oracle and the score stage, which are what resolve it. "One trial, marked non-comparable" carries the operational limit at `docs/how-to/evaluate-ai-feature-behavior.md:240`, which this story leaves as written and which Stories 11.10 and 11.11 carry in their own cells. And the second sentence keeps the design boundary `_bmad-output/planning-artifacts/epics.md:784` reserves for this story.

`docs/how-to/evaluate-ai-feature-behavior.md:225-233` becomes:

> Be clear about what this page proves.
>
> **The shape runs end to end against a loopback fixture.** The test suite starts the toy Notes API on loopback in two builds, seeds D-001 into one of them, probes both over real HTTP through a port implementation that passes the published conformance suite, and scores the run record those observations produce down to a verdict. The observations are measured. No evaluator runs: the test replays the interaction plan the contract declares, and the dispositions, the findings, and each observation's provenance label are carried over from the authored chain. One record is one trial, so the strength vector comes out reported and marked non-comparable. `npm run validate` runs it.
>
> **No third-party AI feature has been evaluated with this library.** The package executes nothing under evaluation: it ships no network adapter, and the port implementation above lives in the test suite, which is where AD-2 puts it. Pointing this at your own feature means an `EnvironmentProbePort` you write, plus the two arms and the evaluator.
>
> What is proven downstream of the evidence is unchanged and is proven twice over now. The chain's selections, check resolutions, witness match, outcome states, verdict, and strength vector are the return values of the shipped functions, called for real, and `npm run check:worked-example` rebuilds the authored chain on every validate. The empty-collection rule is exercised in that chain and lands a `FAIL`.

Four things those sentences deliberately refuse. They never say a production service has been evaluated, because none has. They never say the package runs anything, because it does not. They never let "runs end to end" stand for a real evaluator, because the evaluator is the one part of the chain this run does not exercise. And they carry no count: the block stops at `:233`, so `:234`'s corpus total and `api`-declaring count are Story 11.8's line under `check:doc-counts`, and `:236-238` and `:240` are untouched, which leaves the held-out probe corpus, the second experiment round and the one-trial limit standing in every place that records them.

**Decision 8: pre-flight over the contract's own probe returns `passed: false`, and the frozen
matrix's `passed: true` is stale.**
The frozen I/O matrix's first row and the first acceptance criterion both expect `runPreflight` over
the compiled contract and its probe to return `passed: true`. It returns false, and the cause is in
the probe rather than in the fixture. `D-001` declares `manifestationWitness: null`
(`worked-example-target.ts`'s `AUTHORED_PROBE.defects[0]`), `planPreflight` emits a
`seeded-fault-fired` check with a null witness for exactly that case, and `reducePreflight` answers
it `failed` with "the defect declares no manifestation witness, so it cannot be observed to fire".
No fixture can satisfy that check, because nothing about the running service is what it reads. The
published guide already says so at `docs/how-to/evaluate-ai-feature-behavior.md`: "A defect declaring
`manifestationWitness: null` records a **failed** `seeded-fault-fired` check rather than an
exemption, because a fault nobody can observe firing is a vacuous probe." So the frozen block
contradicts a sentence this repository had already published, and no documentation edit is owed for
this: the page is right and the frozen expectation was wrong.

Recorded rather than worked around, and the run asserts both halves so the divergence is visible in
the suite. With no probe handed in, the plan is six legs and seven checks and the verdict passes:
two sensitivity legs each for `get-note` and `patch-note`, two minted control-observe legs, and
`list-notes` exempt because AD-10 exempts an operation declaring no required key in any channel.
With the probe handed in, the same seven check outcomes hold and one more check fails, and the
assertion names `D-001` in the failure note. Dropping the probe silently would have reported a green
pre-flight over evidence the run never asked for, which is the shape this epic exists to close.
Downstream consequence: a story wanting a green pre-flight over this chain has to give `D-001` a
manifestation witness first, which is a change to `scripts/worked-example-target.ts` and outside
this story's boundaries.

**Decision 9: the fixture answers `GET /notes` with an empty list in both builds, and that is a
property of the fixture rather than a second seeded defect.**
The authored `obs-002` carries `notes: []` while `testData.setup` declares "Seed exactly three notes
with ids n-1, n-2, n-3". The worked example's own `README.md` records that as deliberate and says
why: nothing at scoring time compares an observation against a declared cardinality, so a response
short of its declared count surfaces through whatever oracle touches the collection, which here is
O-004's abstain. That abstain is the single line of `verdictBasis` the FAIL rests on.

So the live fixture reproduces it, in both builds, and the source says so where the route is
implemented. It is not D-001 and not selected by the build flag, because tying it to the flag would
claim the silent write caused it. Verified by mutation: making the route answer with the seeded
three reds the collection assertion, the verdict basis, the outcome table, and the byte equality,
which is the evidence that the short response is load-bearing rather than incidental.

**Decision 10: the four caller-side artifacts the score runs under are reconstructed in the test,
and three of the four are pinned by digest.**
`WorkedExampleChain` publishes the contract, the brief, the probe, the record, the artifact, the
witness match and the selections. It publishes neither the isolation manifest, the evaluator
configuration, the scoring policy, nor the pre-flight verdict, and all four are module-private in a
file this story's Boundaries put behind "Ask First". So the test authors all four, which is also
what the task list already asked for when it said to assemble the record.

Three are pinned against values the committed chain carries, so a reconstruction that drifts reds
this file rather than scoring the live run under something else. `digestArtifact(POLICY)` is
asserted equal to `artifact.scoringVersionInputs.scoringPolicyDigest`.
`digestArtifact(configuration)` is asserted equal to the record's own
`evaluatorConfigurationDigest`, and `ingest` recomputes the same digest, so a drift lands as an
`evaluator-configuration-digest-mismatch` condition and moves the verdict as well as reddening the
assertion. The corpus digest and the fixture digest are read off `scoringVersionInputs` rather than
retyped, so no placeholder literal appears in this diff at all. The manifest is the fourth and is
unpinned by construction: `ingest` reads its declared violation, its three observed-versus-allowed
arrays, its forbidden-input accounting and its three agreement fields, and none of those is a
digest, so there is nothing to pin it against and the source says which four fields carry the work.

**Decision 11: the live run reproduces the committed evidence artifact byte for byte, so the
equality acceptance is one assertion rather than a list.**
The acceptance asked for the verdict, the witness match and the strength vector. All three hold, and
so does more: `serializeArtifact` over the artifact the live run emits equals `serializeArtifact`
over the committed one. That is possible because the emitted artifact carries no observed byte. It
carries outcome states, check resolutions, selected observation identifiers, quoted evidence copied
from the findings, the strength vector, the trial counts, the coverage gaps and four digests, and
every one of those is either derived from the observations or supplied by the call site. So the two
records differ in their response headers and agree on everything the artifact reads.

The named assertions stay beside the byte comparison rather than being folded into it. A byte
comparison that reds says one thing; the verdict, the witness identifiers, the strength vector and
the outcome table say which. Both were confirmed non-vacuous by mutation, and the byte assertion is
the one that catches a divergence nobody predicted.

One block inside that comparison is circular, and the peer review is what found it.
`scoringVersionInputs` carries five values, and four of them are handed to `emit` from the committed
artifact or from the shared contract: the corpus digest, the fixture digest, the evaluator
configuration digest and the contract schema version. Only `scoringPolicyDigest` is computed from an
artifact this file authors, and that one is separately pinned. So that block of the comparison can
only agree, and the claim is narrowed to match: everything the emitted artifact derives from the
observations is covered by the byte assertion, and the scoring-version block is covered by the two
digest pins beside it.

Two things reach the artifact from nowhere at all, and both get their own assertion for that reason.
The fifth leg's observation is one: its step matches no observation, O-005 scores `unreached` with an
empty selection, and nothing about `obs-005` reaches the artifact, so the byte equality says nothing
about it. The other is the second write's timestamp, which lives only in that observation.

**Decision 11a: the verdict and the catch are asserted apart.**
`verdictBasis` is one line, "oracle O-004 resolved abstained at or above the severity floor", so the
FAIL rests entirely on the empty collection. The seeded defect lands as O-001 `caught`, agreeing with
its disposition and selecting `obs-003` and `obs-004`, and it contributes nothing to the verdict. A
reader meeting a FAIL beside a seeded defect would take the one for the other, so the run asserts
both and the published prose claims only what the cell can carry: a real probe observes a seeded
defect over HTTP and the chain scores it.

**Decision 12: the clean arm resolves AD-21's Invalid rung, and that is what it asserts.**
The frozen matrix wanted the clean arm as the control that says the seed took. Scored with the same
authored dispositions and findings, it does more than that. The read-back agrees with the write, so
O-001's check resolves `true` against a `violated` disposition, F-001 quotes `"title":"Original"`
and no observation in the clean record carries it, and the detection claim is unwitnessed. AD-21
lands all three on the Invalid rung and no contract verdict is reached at all.

So the clean arm is asserted at the ladder rather than at a verdict: `ladder.verdict` is null and
`ladder.basis` names the infrastructure error, the unwitnessed detection claim and the unwitnessed
quotation, in that order. The witness match over the same record resolves `unwitnessed-claim` with
`F-001` named and no witnessing observation. That is a stronger control than "the title differs",
because it says the authored findings are false of the clean build in three independent ways.

**Decision 13: the record carries no clock, and two constructions are what keep it that way.**
Decision 4 argued the chain is deterministic because the shipped stages read none. Two clocks sit
upstream of them and both were found by running rather than by reading. The fixture stamps
`updatedAt` from a write counter, so the first write carries `10:05` and the second `10:06`, which
is what the authored record's two writes carry. And Node stamps a `Date` header from the system
clock on every response, which lands in `responseHeaders` and makes the record a different value on
every run; `sendDate` is a property of the response rather than of the server, so the flag is set
per answer and the test asserts no observation carries a `date` header.

Both stamps are pinned by assertion, and the reason is worth stating because the determinism
families read as though they cover it. They do not. Both families re-score one record that was
already captured, so neither re-runs the HTTP and neither can see run-to-run variance in observed
bytes. What covers that is the two literal timestamps, `10:05` on the write the seeded arm's third
leg made and `10:06` on the write its fifth leg made, plus the `date`-header assertion. The peer
review found the second stamp unpinned and a clock behind it invisible to the whole suite.

**Decision 14: every server is registered before its caller can touch it, and teardown checks its
own work.**
A test that starts something needs cleanup on its failing path, because that is the run that leaks.
`startService` pushes the server into the teardown set before returning it, so a failure between the
start and the first assertion still leaves it in the set. `afterAll` closes every one and then
probes each port for a refused connection, so the check is that the close happened rather than that
it was requested. `startNotesService` also calls `server.unref()`: a listening server holds the
event loop open, and unreferenced it cannot outlive the run that started it.

Verified rather than assumed. Removing the close call reds the teardown with `port <n> still
answers`. A deliberately failed run leaves no listener behind, checked with
`lsof -nP -iTCP -sTCP:LISTEN` after the run rather than only after a passing one, on three separate
failing paths: a reddened assertion, a throw inside the file-level `beforeAll` after two servers were
already up, and a throw inside the denial block's own `beforeAll`. Six servers are started per run:
one for each of the two pre-flight measurements, one per arm, one shared by the two denial cases, and
one for the malformed-body assertion. The teardown holds six distinct ports and probes all six.

`startNotesService` rejects on a failed `listen`, and the listener that does it is removed once the
socket is bound. Leaving it attached would swallow a mid-run server error, since a reject on a
settled promise is a no-op, and the failure would then surface as whatever assertion happened to
notice with the cause gone. Unlistened, an error event takes the worker down and says why. Measured
on both sides: pointing `listen` at an address this host does not hold fails in under half a second
naming `EADDRNOTAVAIL`, where before it hung to the thirty-second `beforeAll` timeout with no cause
at all.

**Decision 15: `check:doc-counts` is not in the tree at this story's base, and nothing here needs
it.**
The Verification list names `npm run check:doc-counts` as the gate proving this story transcribes no
count. Story 11.8 ships that script and has not merged, so `package.json` carries no such entry and
the command does not run. What it would gate is unchanged all the same. The corpus-total line in the
guide sits inside the section this story rewrites and is re-read and left byte for byte, the block
above it carries no count, and the AI-feature State cell carries none either. `npm run validate`
runs every gate that does exist and exits 0.

**Decision 16: the value assertions were proved non-vacuous by mutation, one mutation per claim.**
A green assertion that can be deleted without anything reddening pins nothing, so each claim was
checked against a deliberate break rather than argued. Making the collection route answer with the
seeded three reds four assertions. Making the seeded build persist its write reds eight, including
the read-back title, the verdict, the witness match, the strength vector, the byte equality and both
determinism families. Minting `provenance` in the mapping instead of copying it reds six, which is
the mechanical form of Decision 3's argument that AD-40's exercised denominator reads that label.
Removing the teardown's close call reds the teardown probe.

One structural change came out of that pass. The emitted artifact was originally built once in
`beforeAll`, and the second mutation made `emitScored` throw there, which skipped all twenty-one
tests instead of reddening the eight that read it. It is emitted per assertion now, so a divergence
reaching the Invalid rung names the assertions it broke.

**Decision 17: the peer review's eleven findings, and what each one turned out to be.**
Every one is closed in this pass. The two high findings were both a value nothing asserted.

*The fifth leg's response was compared to nothing.* Two independent mutations left the suite green:
renaming the `n-2` seed, and dropping the unknown-key echo so the update applied only `title`. That
left F-003's whole claim, "PATCH accepts an unknown field 'colour' and echoes it back", unwitnessed
by a run whose point is witnessing. Closed with one assertion over `obs-005`, carrying the seed, the
echoed key and the second write's stamp. All three mutations now red.

*The write clock was pinned for the first write only.* A `stampFor` returning the authored `10:05`
for the first write and a reading of the system clock for every later one left the suite green, which
made Decision 13's "the record carries no clock" rest on one literal. Closed by the same `obs-005`
assertion, and Decision 13 now says why the determinism families cannot cover this.

*Three medium findings, each a claim outrunning its evidence.* The score runs under the committed
chain's pre-flight verdict while the pre-flight the run performs returns `passed: false` and a
different fixture digest, and the published guide did not say so; the guide block now names both
authored links. `scoringVersionInputs` inside the byte equality is four-fifths circular, which
Decision 11 now records. And `tagsViolateType`, the `malformed-body` catch and the 405 branch were
all unreachable while their comment claimed B-004 was reproduced; the tags guard now has its own
assertion outside the five legs, and the other two are labelled as guards.

*Six low findings.* `startNotesService` could not reject, so a `listen` failure would have hung to
the `beforeAll` timeout with no cause: it registers an `error` listener now. The fixture-digest
assertion said only that the digest was not a placeholder of zeros; it now asserts the two pre-flight
runs, over two different servers on two different ephemeral ports, produced one digest, which is
what a digest describing a fixture does and a digest of a socket cannot. The permutation family
asserted outcome states and the verdict where the whole artifact is in fact byte-identical under the
reversal, so it asserts that too. The collection route now names the one place the fixture and the
toy system's own spec disagree. And three prose hits were reworded: "A counter, never a clock", "by a
second one", "assume it", each a rejected half carrying no fact of its own.

The peer confirmed four things the run already had: the empty collection carries no assertion that
rests on it, the hop counter's zero is proved by the allowed request through the same counter,
teardown holds on three separate failing paths, and the reconstructed policy and configuration pins
are real, with `evaluatorIdentity` drift reddening eight assertions.

**Decision 18: the second review round, and the one assertion it found doing more than it was
written to do.**
The re-verify confirmed all eleven round-1 fixes by mutation, each reddening exactly the test it was
written for and nothing else, and raised three findings, all low. Two are fixed above: the `error`
listener is now removed once the socket is bound, so a mid-run server error stays loud, and
Decision 14's server count is corrected from five to six.

The third is a subsumption note rather than a defect, and it is kept deliberately. The O-001
assertion is covered by the whole-outcome-table comparison in the next test, so deleting it reds
nothing. Decision 11a is why it stays: `verdictBasis` is one line about O-004's abstain, and a reader
meeting a FAIL beside a seeded defect will read the FAIL as the catch unless something says
otherwise. An assertion whose job is to separate two things for a reader earns its place without
carrying unique coverage.

The finding worth recording for a later story is what the fixture-digest equality turned out to
catch. It was written to say the digest describes a fixture rather than a socket. Made to fail
deliberately, by having `GET /notes/{id}` echo the server's own local port into its body, it reds
alone: the other twenty-three stay green, byte equality included, because an extra key in a read body
moves no oracle. So it is the only assertion in the file that notices a socket-derived value reaching
the observations at all, and a story adding a second live run inherits that as the shape worth
copying.

## Design Notes

The organising idea is the one Story 8.5 established and Story 9.5 restated: evidence is a chain that calls the shipped functions, and anything else is a parallel derivation. The authored chain proved everything from the observations forward. This story proves the one hop before them, and it does so by swapping exactly one input: the same compiled contract, the same signed probe, the same defect signature, with observations that a socket produced. That is why the acceptance is an equality against the authored chain: a fresh set of expected values would prove only that the test author could predict the fixture. If the live verdict and the authored verdict agree, the authored observations were a faithful description of what a real Notes API does, and the worked example stops being a self-consistent fiction. If they disagree, the disagreement is the finding.

The swap is confined to the response bytes, and Decision 3 says where it stops. Each observation's provenance label is carried over from the authored chain, because no evaluator runs here and AD-40's exercised denominator reads that label. So this run adds the transport hop and inherits the account of which observations an evaluator chose. Naming that in the guide block is what keeps "runs end to end" from being read as an evaluated AI feature, which is the failure mode this whole epic exists to close.

The second idea is about where a boundary is allowed to sit. AD-2's "the package executes nothing" reads like a limitation and works like a design: the caller owns the adapter, so the caller owns what gets contacted, and AD-35 can be a policy over a mapping the caller supplies. This story is what lets the documentation say that plainly. Before it, "we ship no network adapter" and "no live service has been evaluated" sat one line apart and read as one excuse. After it, the first is a decision and the second is a fact about production services only.

## Verification

**Commands:**

- `npx vitest run tests/adapters/live-api-chain.test.ts` -- expected: green, with the pre-flight, both arms, the score, both determinism families, and the denial case each asserted.
- `npm run test:conformance` -- expected: green, with `environment-probe` still 19 and `command-probe` still 15.
- `npm run check:worked-example` -- expected: exit 0 with no regeneration, proving the authored chain's five files did not move.
- `npm run check:corpus` -- expected: exit 0, zero orphans, zero drift, with the corpus count this story inherits unchanged by it.
- `npm run check:layers && npm run check:boundary` -- expected: exit 0, 0 violations.
- `npm run check:doc-invocations && npm run check:docs` -- expected: exit 0 over the edited pages.
- `npm run check:doc-counts` -- expected: exit 0, with `docs/how-to/evaluate-ai-feature-behavior.md:234` still matching its source of truth after the block above it is replaced. This is the gate that proves Decision 6's claim that the story transcribes no count.
- `npm run validate` -- expected: exit 0 with no output on stderr, and the `src/core/**` coverage floor unmoved.
- `git diff --name-only` -- expected: no path under `src/`.
