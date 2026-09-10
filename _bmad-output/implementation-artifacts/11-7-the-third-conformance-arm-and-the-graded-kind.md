---
title: 'The third conformance arm and the graded kind'
type: 'feature'
created: '2026-09-09'
status: 'in-review'
review_loop_iteration: 0
context:
  - _bmad-output/implementation-artifacts/epic-11-context.md
  - _bmad-output/implementation-artifacts/11-5-compile-and-preflight-admit-an-mcp-interface.md
  - _bmad-output/implementation-artifacts/11-13-the-port-messages-and-the-mcp-adapter.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `src/testing/probe-conformance.ts` reports one arm per mechanism, `environment-probe` at
`:393` and `command-probe` at `:665`, and both stop at `api` and `cli`. AD-37 defines a conforming
adapter by an executable suite, so the MCP adapter Story 11.13 ships has nothing to certify it.
Second, `tests/coverage/fixtures/corpus.ts:548-553` records that a whole interface kind once went
ungraded while the suite stayed green, and three of AD-31's fourteen predicates answered
confidently and wrongly for a full release. An `mcp` kind inherits that obligation and nothing in
the tree discharges it.

**Approach:** Add `runMcpProbeConformance` beside the two existing runners, with its own subject
type and its own assertion list, on the shape `runCommandLineProbeConformance`
(`probe-conformance.ts:653-666`) set. `ConformancePort` (`src/testing/conformance.ts:32-37`) and
`CONFORMANCE_OUTCOME_COUNTS` (`:40-46`) gain an `mcp-probe` entry, so no published count moves.
Grade the fourteen predicates over an `mcp` contract in a dedicated `tests/coverage/mcp-coverage.test.ts`.
Give the new arm a per-assertion non-vacuity mutant suite, and backfill the `cli` arm's, which
shipped without one.

## Boundaries & Constraints

**Always:**

- A conformance test lives under `tests/adapters`, `tests/testing`, or `tests/conformance`.
  `package.json:81` runs those three directories and nothing else.
- `CONFORMANCE_OUTCOME_COUNTS` gains one entry and every existing entry keeps its value.
  `tests/testing/conformance.test.ts:423-431` asserts the whole object as literals and moves in
  this diff.
- Every denial assertion pins `underlyingCalls() === 0`, as `probe-conformance.ts:144` and `:473`
  do, so the denial is proven to happen before the adapter touches its mechanism.
- The grading file asserts the whole verdict table over every contract it grades, for the reason
  `tests/coverage/command-coverage.test.ts:10-13` states, and compiles each contract through
  `compile(..., { strict: true })` first, as `command-coverage.test.ts:25-36` does.
- A predicate that answers wrongly for `mcp` is repaired here at its source under
  `src/core/coverage/`, the way the descriptor root at `src/core/coverage/operations.ts:47-59` was
  repaired when the command grading found it. `test:coverage` covers `src/core/**` only
  (`vitest.config.ts:14`) at 90% statements and 90% branches (`:31-33`), plus the same floor again
  for `src/core/ingest/**` (`:34`), and that floor holds through the repair.
- Documentation moves in this diff, with the sentences named in the Execution list:
  `docs/reference/cli-commands.md:227` and `:229`, and the two clauses at
  `docs/how-to/evaluate-tool-use-behavior.md:226` and `:234` this story makes false.
- `_bmad-output/project-knowledge/learning-path-step-by-step.md` gains this story's step, written to
  `_bmad-output/project-knowledge/learning-path-template.md`, after the peer review's findings are
  addressed and before the human reviews locally.
- Comments and JSDoc are pruned while written. A comment never runs longer than the declaration it
  documents, and text this change makes redundant is cut in the same pass.
- The caller-facing disclosure moves in this diff. `eval-quality/conformance` is published surface, so
  a new runner, a new subject type, a new `ConformancePort` member, and a new
  `CONFORMANCE_OUTCOME_COUNTS` entry are all things an adapter author builds against, and NFR8
  (`epics.md:54`) requires them called out. Nothing below `[Unreleased]` is edited:
  `release:prepare` (`package.json:111`) owns every dated section.
- No comment under `src/` names an epic, story, acceptance-criterion, task, or decision number.
  `scripts/check-package-boundary.ts:5-8` scans `src/`, `schemas/`, `corpus/`, and three
  `package.json` fields, and states that `tests/` never enters the tarball, so a test header may
  cite a story the way `tests/testing/conformance.test.ts:1` already does.

**Never:**

- No contract fixture and no corpus member. Decision 3 gives the derivation.
- No census constant, no `DEV_CORPUS_CONTRACTS` member, no regenerated AD table, no
  `corpus/dev/README.md` numeral. Story 11.8 owns every one of them.
- No prose rewrite of `docs/index.md`, `docs/explanation/what-ships.md`, `docs/reference/glossary.md`,
  or the tool-use guide's "Where this stands" section. Story 11.9 owns them; this story's two
  tool-use edits are factual corrections to sentences it falsifies.
- No edit to `docs/reference/cli-commands.md:223`'s "four reference adapters". Story 11.13 ships the
  adapter that moves that count and owns the sentence under the same rule.
- No widening of `runEnvironmentProbePortConformance`'s nineteen outcomes or
  `runCommandLineProbeConformance`'s fifteen.
- No spine revision and no new ADR. Every ambiguity below is settled in this file.

## I/O & Edge-Case Matrix

The `mcp` arm's eight additional assertions. The six shared ones come from `runSharedAssertions`
unchanged.

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| `mcp/allow-authorized-tool-call` | a tool call the policy names, against the subject's own fixture server | resolves, and the four echoed fields come back unchanged | `echoMismatch` (`probe-conformance.ts:267-282`) fails it when the answer names a different request |
| `mcp/observe-error-result` | an authorized call the server answers with an error result | resolves, and the observation carries that result | an adapter that throws on a server-reported error fails here and nowhere else, which is the rule `docs/how-to/evaluate-tool-use-behavior.md:223` already names as the first one a tool-use adapter breaks |
| `mcp/deny-unmapped-interface` | an `interfaceId` no authorization names | rejects `forbidden-target` | `underlyingCalls() === 0` |
| `mcp/deny-unauthorized-tool` | a mapped interface, a tool name its authorization does not permit | rejects `forbidden-target` | `underlyingCalls() === 0` |
| `mcp/arguments-passed-as-declared` | an authorized call carrying a metacharacter-bearing argument value | resolves, and the server observed that key's value byte for byte | the subject exposes the declared literal, as `CommandProbeSubject.injectionArgumentValue` (`probe-conformance.ts:417`) does |
| `mcp/observe-declared-result-channel` | an authorized call whose descriptor addresses the tool result | resolves, and the observation carries the channel the descriptor names | a missing channel fails with the channel named |
| `mcp/cap-elapsed` | an authorized call answered past `maxElapsedMs` | rejects `budget-exhausted` | a `forbidden-target` here reads as "the server is off limits" when an authorized one answered slowly, which is the split `probe-conformance.ts:79-84` exists to keep |
| `mcp/cap-result-bytes` | an authorized call answered past the result byte cap | rejects `budget-exhausted` | same split |

</frozen-after-approval>

## Code Map

- `src/testing/probe-conformance.ts` -- both arms. Header `:1-22` names two and gains the third.
  `PROBE_ASSERTIONS:114-227`, `COMMAND_ASSERTIONS:447-546`, the shared `checkRejected:284-305` and
  `echoMismatch:267-282`, and the two runners at `:381-394` and `:653-666`.
- `src/testing/conformance.ts` -- `ConformancePort:32-37` and `CONFORMANCE_OUTCOME_COUNTS:40-46`
  gain `mcp-probe`. `:464` is the length term that makes a short report fail.
- `src/testing/index.ts` -- the `eval-quality/conformance` barrel. `:56` exports the counts, `:62` the subject types and `:63-66`
  the two runners; the third rides the same subpath, so `package.json` and
  `tests/architecture/package-exports.test.ts:149-154` are untouched.
- `tests/testing/conformance.test.ts` -- `:1-5` states what a mutant fixture proves, `:423-431` is
  the declared-literals assertion, `:555-674` is the `api` synthetic subject the two new ones follow,
  `:676-685` the per-arm failure helper, `:699-795` the fourteen `api` mutants.
- `tests/adapters/command-probe-subject.ts:1-9` -- the in-repository `cli` subject over the real
  shipped adapter and a real fixture, driving `tests/adapters/fixtures/command-probe-fixture.mjs`.
- `tests/adapters/command-probe-subject.test.ts:27-34` -- the real-subject run, fifteen of fifteen.
- `tests/adapters/probe-subject.test.ts:122-123` -- the same `kind` guard written twice.
- `tests/coverage/command-coverage.test.ts` -- `:1-13` the grading precedent and its reasoning,
  `:25-36` compile-then-grade, `:40-74` the whole-table assertions, `:76-88` the descriptor-root
  assertion.
- `tests/coverage/fixtures/corpus.ts:543-546` and `:548-553` -- why a kind is graded in its own file.
  `:555-559` is `DEV_CORPUS_CONTRACTS`, which this story does not touch.
- `src/core/coverage/relevance.ts:290-309` and `src/core/coverage/satisfaction.ts:738-761` -- the two
  seven-entry predicate tables the grading file runs. `src/core/coverage/operations.ts:47-59` builds
  the descriptor root every pointer-building rule reads.
- `scripts/generate-ad31-table.ts:17-18` and `:33-34` -- the generated table reads `CORPUS_CELLS` and
  `CORPUS_CONTRACTS`, which is why a corpus member would move a generated file.
- `scripts/check-docs.mjs:9-15` -- the roots it scans. `docs/` is not among them, so nothing
  mechanical catches a stale count on a published page.
- Documentation describing the suite, the arms, or AD-31 grading, every hit from a grep of `docs/`
  and `README.md`:
  - `docs/reference/cli-commands.md:227` -- "a second arm for `EnvironmentProbePort`'s two
    mechanisms" plus the runner list. **This story.**
  - `docs/reference/cli-commands.md:229` -- the five per-port counts. **This story.**
  - `docs/how-to/evaluate-tool-use-behavior.md:226` -- "and a third conformance arm beside
    `runEnvironmentProbePortConformance` and `runCommandLineProbeConformance`". **This story.**
  - `docs/how-to/evaluate-tool-use-behavior.md:234` -- "**Missing.** ... a conformance arm ...".
    **This story**, for its own item.
  - `docs/reference/cli-commands.md:223` -- "four reference adapters". **Story 11.13.**
  - `docs/explanation/what-ships.md:20` -- "four reference adapters ... and a port conformance suite
    at `eval-quality/conformance`". Adapter count is **Story 11.13**; the suite clause is kind-neutral
    and stays.
  - `docs/explanation/what-ships.md:38` -- "the conformance arm an adapter would need". **Story 11.9.**
  - `docs/reference/cli-commands.md:186`, `:225`, `README.md:228`, `:245` -- kind-neutral
    descriptions of the subpath and the suite. Verified true after this change; no edit.
  - `docs/reference/glossary.md:67` -- "The fourteen predicates that decide relevance and
    satisfaction". Still fourteen; no edit.
- `_bmad-output/implementation-artifacts/deferred-work.md:3-17` -- the one open item, which says the
  suite "has no command arm" and that the gap "is stated in `src/testing/probe-conformance.ts`'s own
  header". Epic 10 closed both, and the header at `:1-22` now describes two working arms.
- `CHANGELOG.md:1-9` -- the header, which says entries go under `[Unreleased]` and that
  `release:prepare` (`package.json:111`) stamps them into a dated section at release time. The file is
  hand-maintained. `eval-quality/conformance` is caller-facing surface, named as such since 0.1.0
  (`CHANGELOG.md:619-623`), so NFR8 (`epics.md:54`) puts this story's runner and its count entry in
  the changelog.
  `_bmad-output/implementation-artifacts/9-5-the-published-surface-the-corpus-and-the-disclosed-breaks.md:127`
  is the one Epic 9 story that carried the entry as its own checklist item, and it is the precedent
  for making this a task. Epic 9's own bullets at `CHANGELOG.md:285-290` and `:311-313` are the shape
  a break bullet takes; this story's is an addition plus one widening, so it leads with `### Added`
  and names the widening inside it.

## Tasks & Acceptance

**Execution:**

- [x] `src/testing/conformance.ts` -- add `'mcp-probe'` to `ConformancePort` (`:32-37`) and
  `'mcp-probe': 14` to `CONFORMANCE_OUTCOME_COUNTS` (`:40-46`) -- a new entry leaves every published
  count where it is.
- [x] `src/testing/probe-conformance.ts` -- add `McpProbeSubject`, `MCP_ASSERTIONS`,
  `checkMcpResolved`, `checkMcpCalls`, `runMcpProbeAssertion`, and `runMcpProbeConformance` returning
  `reportOf(subject.name, 'mcp-probe', ...)` -- the arm is what a future MCP adapter author has to
  satisfy, so it is written after both existing arms are read.
- [x] `src/testing/probe-conformance.ts` -- rewrite the header at `:1-22` to describe three arms and
  cut the sentences the third makes redundant -- the header is the file's own map and it currently
  reads as an exhaustive two-arm list.
- [x] `src/testing/index.ts` -- export `runMcpProbeConformance` and `McpProbeSubject` beside the two
  at `:62-65` -- the `./conformance` subpath is where AD-37 puts the definition an adapter author reads.
- [x] `tests/adapters/mcp-probe-subject.ts` -- the in-repository `mcp` subject over Story 11.13's
  shipped adapter and a real fixture server, on the shape `tests/adapters/command-probe-subject.ts:1-9`
  set -- a synthetic mechanism would prove nothing about the thing the adapter exists to get right.
- [x] `tests/adapters/fixtures/mcp-probe-fixture.mjs` -- the fixture the subject drives, scripting
  the error result, the argument echo, the declared result channel, and both overruns.
- [x] `tests/adapters/mcp-probe-subject.test.ts` -- run `runMcpProbeConformance` against it and
  assert fourteen of fourteen with an empty failure list, as
  `tests/adapters/command-probe-subject.test.ts:27-34` does.
- [x] `tests/testing/conformance.test.ts` -- move the declared-literals assertion at `:423-431` to
  include `'mcp-probe': 14`; add a synthetic `mcp` subject with one knob per assertion and eight
  mutant fixtures; add a synthetic `cli` subject and nine mutant fixtures -- Decision 5.
- [x] `tests/coverage/mcp-coverage.test.ts` -- grade the fourteen predicates over the `mcp` accept
  fixture, asserting the whole verdict table per contract and the `descriptorRoot` directly, as
  `tests/coverage/command-coverage.test.ts:40-90` does.
- [x] `src/core/coverage/` -- repair any predicate the grading finds answering wrongly for `mcp`, at
  its source, in this diff.
- [x] `tests/adapters/probe-subject.test.ts` -- delete the duplicated guard at `:123`.
- [x] `docs/reference/cli-commands.md` -- `:227` becomes "There is one runner per port, and
  `EnvironmentProbePort` has one arm per mechanism:", with `runMcpProbeConformance` (the `mcp` arm)
  appended to the runner list; `:229`'s count list gains "`mcp-probe` 14".
- [x] `docs/how-to/evaluate-tool-use-behavior.md` -- `:226` names `runMcpProbeConformance` as the arm
  an MCP adapter certifies against, and the sentence is deleted outright if Story 11.13 already
  removed its two port-message clauses; `:234` loses its "a conformance arm" item, and the
  "**Missing.**" line is deleted if that empties it.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md:3-17` -- close the open item, which
  Epic 10 satisfied and which now reads as false in two places.
- [x] `CHANGELOG.md` `[Unreleased]` -- one `### Added` bullet naming `runMcpProbeConformance` and
  `McpProbeSubject` on `eval-quality/conformance`, and `CONFORMANCE_OUTCOME_COUNTS` gaining
  `'mcp-probe': 14` with every existing count unchanged, stated so the silence is not read as an
  oversight. It also names the `ConformancePort` widening, which breaks an exhaustive switch an
  adapter author wrote over the five members.
- [x] The five pairs -- walk them against the tree at this story's start and record the result in the
  story: three third files written here, one written by Story 11.13, and
  `tests/preflight/mcp-plan.test.ts` either landed by Story 11.5 or written here under the fallback
  the Design Notes names.
- [x] `_bmad-output/project-knowledge/learning-path-step-by-step.md` -- add the next unused step,
  tagged `(epic11-story7)`, plus its row in the step table, following
  `learning-path-template.md`. The `In plain terms` hook is that a whole interface kind went
  ungraded once while the test suite stayed green, and three checks answered confidently and wrongly
  for a full release.
- [x] Every file this story edits -- grep for `, not `, `rather than`, `instead of`, `as opposed to`,
  `, never `, and `no longer`, and confirm each surviving hit is a before/after where both halves
  carry a fact.

**Acceptance Criteria:**

- Given the published suite, when `npm run test:conformance` runs, then three environment-probe arms
  report, and the in-repository `mcp` subject over the shipped adapter passes fourteen of fourteen
  with an empty failure list.
- Given `CONFORMANCE_OUTCOME_COUNTS`, when the declared-literals assertion runs, then `corpus` 6,
  `clock` 6, `file-system` 12, `environment-probe` 19, and `command-probe` 15 are unchanged and
  `mcp-probe` is 14.
- Given the `mcp` and `cli` arms, when each mutant fixture runs, then exactly one qualified outcome
  id goes red and it is the id the fixture names.
- Given AD-31's fourteen predicates, when `tests/coverage/mcp-coverage.test.ts` runs, then the whole
  relevance-and-satisfaction table is asserted per graded contract and the descriptor root is
  asserted directly.
- Given the one-file-per-kind pattern, when the five pairs are walked, then three carry a third file
  written here and two carry a written justification naming the story that owns the third file, and
  the walk records whether `tests/preflight/mcp-plan.test.ts` arrived from Story 11.5 or from this
  story's named fallback.
- Given `CHANGELOG.md`'s `[Unreleased]`, when read, then it names `runMcpProbeConformance`,
  `McpProbeSubject`, the `'mcp-probe': 14` count entry, the five counts that did not move, and the
  `ConformancePort` widening. NFR8 (`epics.md:54`) is what requires it.
- Given the published pages, when `docs/reference/cli-commands.md:227` and `:229` and
  `docs/how-to/evaluate-tool-use-behavior.md:226` and `:234` are read after this change, then each
  describes the shipped suite and carries no sentence the change made redundant.
- Given the learning path, when the new step is read, then it follows `learning-path-template.md`'s
  headings and its `In plain terms` block uses no repository vocabulary.
- Given every comment and JSDoc this story writes or edits, when the seven banned-construction
  patterns are grepped, then each surviving hit carries a fact in both halves, and no comment runs
  longer than the declaration it documents.

## Decisions settled by construction

**Decision 1: the arm's assertion count is derived from the authorization's own shape, and it is
eight.** Both shipped arms carry one denial per authorization-scoped field: the `api` arm has
interface, four address classes, method, and scheme (`probe-conformance.ts:138-187`); the `cli` arm
has interface, executable, and subcommand path (`:467-490`), because Story 10.1 keyed its
authorization on `(interfaceId, executable)`. An MCP interface's operations all reach one server,
since every MCP call shares the transport identity `tools/call`, so Story 11.13's authorization is
keyed on `interfaceId` with a permitted-tool allowlist and carries two authorization-scoped fields.
Four assertions are kind-independent and copy the two arms exactly (an authorized call resolves, a
server-reported error is an observation, the elapsed cap, the size cap), and two prove the adapter
carries declared content across the boundary. Eight additional plus the six shared gives
`CONFORMANCE_OUTCOME_COUNTS['mcp-probe'] = 14`. Downstream consequence: if Story 11.13's shipped
authorization declares a third authorization-scoped field, such as a resolved address list for an
HTTP transport, the arm gains that field's denial and the literal moves in the same diff, because
the derivation rule and the literal have to agree.

**Decision 2: the third arm shares two helpers and copies two.** `probe-conformance.ts:284` records
that `checkRejected` reads only `id` and `title`, so every arm's assertion shape satisfies it
structurally, and `echoMismatch` (`:267-282`) takes the two port messages and no subject. Both are
reused. `checkCommandCalls`'s comment at `:577` records why the call-count checker could not be
shared: a function parameter type is checked contravariantly, so an arm's
`(subject) => number | string` cannot be widened across subject types. The resolve-side checker has
the same shape problem, since `CommandExpectation`'s `check` takes the subject (`:428-437`). So the
`mcp` arm carries its own `checkMcpResolved` and `checkMcpCalls`. A generic over the subject type
would remove the duplication and add a type parameter to every assertion record for no assertion it
makes possible.

**Decision 3: the grading file needs no corpus member, and this story adds no contract fixture.**
`tests/coverage/command-coverage.test.ts:20-23` imports its two contracts from
`tests/schemas/fixtures/command-contract.ts`, a schema accept fixture. A member added to
`CORPUS_CELLS` or `CORPUS_CONTRACTS` would move a generated file, because
`scripts/generate-ad31-table.ts:17-18` and `:33-34` read exactly those two, and
`tests/coverage/fixtures/corpus.ts:543-546` rules it out on its own terms: a kind's contracts are
not declaration-state exemplars, so they have no cell in a matrix of declaration states. A member
added to `DEV_CORPUS_CONTRACTS` (`:555-559`) moves six spelled-out numerals on four lines of
`scripts/dev-corpus-target.ts` (`:65`, `:108`, and two words each on `:114` and `:115`, with `:117`'s
"Three" holding) and the byte-checked `corpus/dev/README.md`, which is Story 11.8's work.

So `tests/coverage/mcp-coverage.test.ts` imports `tests/schemas/fixtures/mcp-contract.ts`. Story 11.4
authors that file as a task in its own Execution list, on the `command-contract.ts` precedent, and it
carries two distinct tools, a sensitivity witness, and a structured-result descriptor. This story
imports it exactly as `command-coverage.test.ts:20-23` imports its own two contracts.

What the grading file needs from that fixture, stated here so its author can satisfy it:

- It parses as an `EvalContract` and survives `compile(parsed, { strict: true })`. `gradeOf`
  (`command-coverage.test.ts:25-36`) compiles before grading, on the stated ground that a table
  grading a contract the compiler rejects cannot be mistaken for coverage, so a strict-mode failure
  reads here as a grading failure.
- All fourteen predicates answer from declarations the fixture actually carries, so no cell in the
  asserted verdict table is a verdict about an absent declaration. `stateChangeReadBackRelevance`
  (`relevance.ts:266-282`) answers `true` and names an operation when one declares
  `stateChangeMarker: true`, and `successIndicatorSeparationRelevance` (`:50-90`) reads each
  operation's descriptor, so the fixture declares a state-change marker, a success indicator, and
  channel roles. `siblingCrossCheckRelevance` (`:195-222`) reads `contract.siblingGroups`; naming a
  sibling pair takes the second tool.
- Its descriptor is on `response-body`. `descriptorChannelOf` answers `response-body` for an `mcp`
  operation, which Story 11.5's Decision 2 settles, so the descriptor root
  `src/core/coverage/operations.ts:47-59` builds for the kind is `/response-body` and the grading
  file asserts that root directly.

Downstream consequence: this story grades one contract. The command file grades two because a command
operation describes either a stream or a written artifact; an `mcp` operation has one describable
response channel, so a second contract would repeat the first's descriptor root.

**Decision 4: `docs/reference/cli-commands.md:227` and `:229` are this story's edit.** Story 11.9's
criteria claim the conformance-arm count and outcome counts in the CLI reference, and nothing
mechanical would catch them in the meantime: `scripts/check-docs.mjs:9-15` scans `README.md`,
`_bmad-output/planning-artifacts`, `_bmad-output/project-knowledge`, and two experiment files, and
never reads `docs/`. The epic register's rule binds the story that changes the behaviour, so a false
published sentence would otherwise stand from this story's merge until the epic's last one.
Downstream consequence: Story 11.9 inherits a check on those two lines and spends its edit on
`:223`'s adapter count, which Story 11.13 moves, and `:233`'s corpus counts, which Story 11.8 moves.

**Decision 5: the `cli` arm's non-vacuity proof is backfilled here.**
`tests/testing/conformance.test.ts:1-5` states what a mutant fixture is for: each flips one
behaviour and asserts which qualified outcome id went red. The `api` arm has fourteen such fixtures
at `:699-795`. The `cli` arm has none, and `tests/adapters/command-probe-subject.test.ts:27-34` runs
the real subject and asserts fifteen of fifteen, which proves the arm passes and says nothing about
whether any single assertion can fail. That is the same shape as the defect this story exists to
close on the AD-31 side: a suite staying green while a check answers confidently and wrongly.
Writing an `mcp` mutant suite while the `cli` arm stays unproven would ship the third arm with the
second arm's hole still open, so the synthetic subject scaffolding is written once and both arms get
their fixtures. Downstream consequence: a fourth arm owes its mutant suite in its own story, and
`conformance.test.ts` grows one synthetic subject and one knob record per arm.

**Decision 6: `deferred-work.md`'s one open item is closed here.** `:3-17` describes the missing
command authorization and the missing command arm, and states that the gap "is stated in
`src/testing/probe-conformance.ts`'s own header". Epic 10 shipped both, and the header at `:1-22`
describes two working arms. This story rewrites that header, so it is the change that makes the
entry's last true sentence false, and closing the entry in the same diff keeps the file's claim that
it records what is actually owed.

**Decision 7: Decision 2 is superseded, and all three arms now share one assertion shape, one
runner, one resolve-side checker and one call-count checker.**
Decision 2 recorded that `checkCommandCalls`'s own comment explains why a call-count checker cannot
be shared, that the resolve-side checker has the same problem, and that a generic "would remove the
duplication and add a type parameter to every assertion record for no assertion it makes possible."
The contravariance half of that is correct and the conclusion does not follow from it. The problem
is real when the generic is put on the assertion *record*, which is what that sentence describes and
what it rightly turns down. Put on the *helper* instead, TypeScript infers the subject from the
`subject` argument at each call site and the records stay concrete: `ArmAssertion<ProbeSubject>`,
`ArmAssertion<CommandProbeSubject>`, `ArmAssertion<McpProbeSubject>`, no type parameter written
anywhere a list of assertions is authored.

Taking it collapsed four types (`Expectation`, `ProbeAssertion`, `CommandExpectation`,
`CommandAssertion`) into one, three near-identical runners into `runArmAssertion` and `runArm`, two
resolve-side checkers into `checkResolvedFor`, and three call-count checkers into `checkCallCount`.
The `api` arm's `check` takes only `(observation)` and satisfies the two-parameter signature, since a
function of fewer parameters is assignable to one of more. Writing the third arm the way Decision 2
described would have shipped a third copy of each.

Verified as a behaviour-preserving change rather than argued: `npm run typecheck` exits 0, and the
whole of `tests/testing/conformance.test.ts`, including the `api` arm's fourteen mutant fixtures, plus
`tests/adapters/command-probe-subject.test.ts`'s real fifteen-of-fifteen run, were green across the
edit before any new assertion existed. Downstream consequence: a fourth mechanism writes a subject
type and a list of assertions and inherits the machinery, which is the shape this story wanted for
its own arm and would otherwise have owed the next one.

**Decision 8: Story 11.13's Decision 21 is weighed here and the two wide field types stay wide, and
the third arm's equivalent is wide too.**
11.13 deliberately left `ProbeSubject.faultingRequest` and `CommandProbeSubject.nonZeroExitRequest`
typed over the whole three-member request union, made both arms' non-matching detail strings
reachable that way, gave each a case, and handed the narrowing decision to this story on the ground
that this story owns the conformance surface. Read with the third arm in hand, the answer is to keep
them wide. `McpProbeSubject.errorResultRequest` is declared the same way, its non-`mcp` arm names the
observed kind, and it has its own case.

Three reasons, in the order they decide it. The suite is published for adapter authors to run against
their own subjects, and nothing obliges such an author to be using TypeScript at all; a narrowed
field type is invisible to a JavaScript caller, while the runtime detail naming the kind it observed
works for every caller. Narrowing is a caller-facing break on a published type for zero assertions
gained, since the assertion it would make unnecessary is a mis-wired subject the suite already
reports precisely. And it would delete three reachable branches and the three cases that cover them,
trading a message that says what went wrong for a compile error one class of caller sees.

Downstream consequence: a fourth arm declares its own kind-specific request over the request union
too, and owes the same non-matching case. The alternative turned down is recorded here rather than in
the source, since the source now carries only what holds.

**Decision 9: the fixture server needed no change, and the Execution list item that asks for one is
recorded as already landed.**
The Execution list asks this story to write `tests/adapters/fixtures/mcp-probe-fixture.mjs`,
"scripting the error result, the argument echo, the declared result channel, and both overruns."
Story 11.13 shipped the file with all four already in it: `failing_tool` returns a result carrying
`isError: true`, `search_notes` returns `echo` carrying the query it received, its structured result
carries `ok`, `matches`, `totalCount` and `echo`, `oversize_tool` writes past a byte cap on demand,
and `hanging_tool` never answers. The subject drives those five tools and the file is untouched by
this diff.

The argument-echo assertion reads `echo`, which is a scalar the tool publishes beside `matches`. That
is deliberate and it is the AD-4 trap: a check over a collection that came back empty resolves to
insufficient evidence under `empty-collection`, so an assertion spelled over `matches` would report
vacuous and could never witness a dropped or re-encoded argument. `McpProbeSubject`'s own comment
carries the rule.

**Decision 10: no predicate under `src/core/coverage/` answered wrongly for `mcp`, and the grading
file proves that rather than asserting it.**
The Execution list carries "repair any predicate the grading finds answering wrongly for `mcp`, at
its source". None does. All seven relevance predicates answer `true` and all seven satisfaction
predicates answer `true` over `tests/schemas/fixtures/mcp-contract.ts`, which is a different shape
from either command contract, where four rules are irrelevant. The difference is the fixture's own
richness: it declares a success indicator beside two other channel roles, two type-violating
bindings, a collection location naming a reference set, a sibling group, and a state-change marker,
so no rule has an absent declaration to be irrelevant about.

A table of seven `true, true` rows is the table most easily green for the wrong reason, so
`tests/coverage/mcp-coverage.test.ts` carries a second block that removes one oracle at a time and
names which rules go unsatisfied. Six removals, and every rule is accounted for: dropping O-001 or
O-003 leaves `success-indicator-separation` and `whole-body` unsatisfied, dropping O-002 leaves
`per-record` and `omission-and-completeness`, dropping O-006 and O-007 leaves `malformed-input`,
dropping O-005 leaves `sibling-cross-check`, and dropping O-004 leaves `state-change-read-back`.
Every mutant still compiles under `strict`, so the predicates run on all of them.

The root the command grading found broken is right here for the same reason it was wrong there:
`descriptorChannelOf` answers `response-body` for an `mcp` operation and `descriptorRootOf` builds
`/response-body`, which is the prefix a real evidence pointer such as
`/interactions/search/response-body/matches` starts with. The grading file asserts both operations'
roots and kinds directly.

**Decision 11: the five pairs, walked against the tree at this story's start. Every pair has its
third file and the named fallback did not fire.**
1. `tests/preflight/mcp-plan.test.ts` **arrived from Story 11.5**, so this story's fallback was not
   needed. Its own header claimed `ProbeObservation` "carries no tool-call member yet", which Story
   11.13 falsified; the header is corrected in place here and now points at the end-to-end pre-flight
   that lives beside the adapter.
2. `tests/adapters/mcp-probe-subject.ts` **written here**.
3. `tests/adapters/mcp-probe-subject.test.ts` **written here**;
   `tests/adapters/mcp-adapter.test.ts`, the other half of that pair as this story's Design Notes
   splits it, **arrived from Story 11.13**.
4. `tests/adapters/mcp-target-policy.test.ts` **arrived from Story 11.13**.
5. `tests/coverage/mcp-coverage.test.ts` **written here**.

**Decision 12: Decision 6 is amended. The deferred-work entry is rescoped here and stays open, with
a named owner.**
Decision 6 said this story closes `deferred-work.md`'s one open item, on the ground that Epic 10
satisfied it and that this story's header rewrite makes its last true sentence false. The first half
is nearly right and the second half is exactly right. Epic 10 shipped `CommandTargetPolicy`,
`CommandTargetAuthorization` and the fifteen-outcome `command-probe` arm, which covers every
assertion the entry named as its closing condition. One sub-item survived: the entry also asked the
command authorization to name "the environment keys it may carry", and it names none.
`CommandProbeRequest.channels.environment` is contract-declared and `buildEnv` spreads it into the
child with no allowlist anywhere, so every other command channel is default-deny and this one is
default-allow.

The entry is therefore rewritten down to that item, with its `source_spec`, its evidence, and what
closing it costs: a `permittedEnvironmentKeys` field, an enforcement point in
`command-line-adapter.ts`, and a tenth command assertion moving
`CONFORMANCE_OUTCOME_COUNTS['command-probe']` from 15 to 16, which is a caller-facing disclosure.
Its stale evidence pointers are corrected in the same pass, and the file's own contradiction between
"One item is open" at the top and "**Nothing is open.**" further down is resolved.

The closure was held back on an explicit ruling rather than forgotten, and the entry says so. The fix
moves a published count on a mechanism this story does not touch, and the epic coordinator owns it as
one post-epic pull request after Story 11.9. Recording the owner and the cost is what separates this
from the deferred-work pattern the repository owner objects to.

The `mcp` mechanism does not inherit the gap and the entry says that too: `McpProbeRequest` declares
no environment channel, and `McpTargetAuthorization.serverEnvironment` is the adapter's own launch
environment under AD-18, which is authorization material rather than a contract-declared channel.

**Decision 13: `tests/adapters/mcp-probe-subject.test.ts` sweeps no pids, and the file says why.**
Story 11.13 leaked two server processes onto a developer machine because its teardown case recorded a
pid, asserted the process was dead, and had no cleanup on the path where that assertion fails. The
rule that came out of it is that a test which starts a process cleans up on its failing path. This
file starts six servers per run and needs no sweep, for a reason worth stating rather than assuming:
every session the subject opens is closed in `callToolOverStdio`'s own `finally`, which ends the
server's stdin and kills its process group, and that runs on the cap path and the throw path as much
as the clean one. No case here launches through a launcher or passes `--linger`, so there is no
grandchild for a failed assertion to strand. The file header carries the argument, so the next reader
does not have to re-derive it or add a sweep over nothing.

**Decision 14: three sentences outside this story's named documentation list were falsified by this
change or by 11.13's, and all three are corrected here.**
Rule: a story corrects the sentences its own change falsifies, in its own diff.
`_bmad-output/project-knowledge/learning-path-step-by-step.md`'s step 51 closed with "the conformance
suite still has two arms" and "the third arm, and the count that goes with it, land in the next
story", which this diff makes false; it now states what was true when 11.13 landed and points at step
52. `tests/preflight/mcp-plan.test.ts`'s header claimed `ProbeObservation` carries no tool-call
member, which 11.13 falsified and no story corrected. `tests/adapters/probe-subject.test.ts` carried
its `expected an api observation` guard twice on consecutive lines, which the Execution list already
names, and one copy is deleted.

## Design Notes

**The five pairs, walked against the tree.** Every pair exists. Three get a third file here and two
are handed to the story that owns the module under test.

1. `tests/preflight/plan.test.ts` with `tests/preflight/command-plan.test.ts`. **Story 11.5's, with a
   fallback here.** `command-plan.test.ts:1-7` proves a command interface plans a leg, hands the port
   a command request, and reduces back; Story 9.3 wrote it in the same diff that opened pre-flight
   for `cli`. Story 11.5 is the story that opens pre-flight for `mcp`, so
   `tests/preflight/mcp-plan.test.ts` is its deliverable and 11.5 has been asked to claim it or say
   why not.

   The handoff is deliberate and the fallback is named as one so a reader can tell the difference
   between a file assigned elsewhere and a file nobody owns. If 11.5's diff lands without it, this
   story writes it, because a pre-flight path that no test drives end to end is the same silence this
   story exists to close on the conformance and grading sides. The walk records which of the two
   happened, so the story's own history says whether the fallback fired.
2. `tests/adapters/probe-subject.ts` with `tests/adapters/command-probe-subject.ts`.
   **Written here** as `tests/adapters/mcp-probe-subject.ts`. It is the subject the new arm certifies
   and it cannot exist before the arm does.
3. `tests/adapters/probe-subject.test.ts` with `tests/adapters/command-line-adapter.test.ts`. **The
   pair as the epic states it is two pairs, and the correction matters.**
   `tests/adapters/command-probe-subject.test.ts:1-3` names itself "the command-probe arm's own
   version of `probe-subject.test.ts` fixtures 85-88", so it is `probe-subject.test.ts`'s real
   counterpart, and its third file, `tests/adapters/mcp-probe-subject.test.ts`, is **written here**.
   `command-line-adapter.test.ts` is the shipped adapter's own unit test and has no `api`
   counterpart, because no `api` adapter ships (`docs/reference/cli-commands.md:223`); the `api`
   adapter under test is `tests/adapters/probe-subject.ts` itself, which is why
   `probe-subject.test.ts:88-273` carries adapter-level assertions the command file does not. That
   pair's third file is an MCP adapter unit test, and it is **Story 11.13's**, written beside the
   adapter as Story 10.1 wrote `command-line-adapter.test.ts` beside `createCommandLineAdapter`.
4. `tests/probe/target-policy.test.ts` with `tests/adapters/command-target-policy.test.ts`.
   **Story 11.13's.** `command-target-policy.test.ts:1-10` is the unit test of
   `src/adapters/command-target-policy.ts`, and Story 10.1 shipped the evaluator and its test in one
   diff. Story 11.13 writes the MCP authorization and its evaluator, so it writes the test. A unit
   test for a module this story does not write would pin an interface it does not own.
5. `tests/coverage/coverage.test.ts` with `tests/coverage/command-coverage.test.ts`. **Written here**
   as `tests/coverage/mcp-coverage.test.ts`. This is the story's second half.

**Why the whole table.** `command-coverage.test.ts:10-13` gives the reason and this file follows it:
a predicate that stops firing, starts firing, or flips its answer is the failure the file exists to
catch, and naming only today's interesting rules lets the next one through. `:76-88` asserts the
descriptor root directly for the same reason: `src/core/coverage/operations.ts:47-59` builds it, and
a wrong root makes several rules answer against a pointer no evidence pointer can equal, each
reading as an ordinary unsatisfied verdict.

## Verification

**Commands:**

- `npm run typecheck` -- exit 0. The third `ConformancePort` member makes `reportOf`'s port argument
  and the counts object agree.
- `npm run build` -- exit 0. `test:conformance` runs it first (`package.json:81`).
- `npm run test:conformance` -- green over `tests/adapters tests/testing tests/conformance`. Three
  environment-probe reports: `environment-probe` 19/19, `command-probe` 15/15, `mcp-probe` 14/14,
  each with an empty failure list.
- `npx vitest run tests/coverage` -- green. `mcp-coverage.test.ts` grades the fourteen predicates per
  contract and asserts the descriptor root.
- `npx vitest run tests/testing/conformance.test.ts` -- green. Every new mutant fixture flips exactly
  the id it names, and fixture 58 reads six declared literals.
- `npm run check:boundary` -- exit 0, 0 violations. The rewritten `probe-conformance.ts` header
  carries no epic, story, acceptance-criterion, task, or decision number.
- `npm run check:layers` -- exit 0, 0 violations.
- `npm run test:coverage` -- the `src/core/**` floor holds at 90% statements and 90% branches
  (`vitest.config.ts:31-33`). The arm and the subject live outside `src/core/**`, so the floor sees
  only the `src/core/coverage/` repair, which the grading file that found it covers.
- `npm run validate` -- exit 0 with no output on stderr, over the 21 steps `package.json:113` declares
  at this story's boundary; Story 11.8 adds the twenty-second, `check:doc-counts`, after this one. The
  steps this story's changes reach are `typecheck` and `build` (the third `ConformancePort` member),
  `check:boundary` (the rewritten `probe-conformance.ts` header), `check:docs` and
  `check:doc-invocations` over the tool-use guide, which Story 11.2 armed as an executed input, and
  `test:coverage`, which is where the grading file and the `src/core/coverage/` repair land. No schema
  document, census constant, or generated table moves here, so `check:schemas`, `check:ad31-table` and
  `check:corpus` are green with nothing regenerated.
- `npm run docs:build` -- exit 0. `website/src/content/docs` is a symlink to `docs/` and the
  navigation is autogenerated, so the two edited pages need no configuration change.

**Manual checks:**

- Grep the edited files for `, not `, `rather than`, `instead of`, `as opposed to`, `, never `, and
  `no longer`; every surviving hit names a real before/after with both halves carrying a fact.
- `git diff CHANGELOG.md`: every hunk sits under `[Unreleased]` and nothing below it is touched, since
  `release:prepare` owns every dated section.
- Read the new step in `learning-path-step-by-step.md` against `learning-path-template.md`: the
  heading order, no repository vocabulary in `In plain terms`, no bullet longer than two lines.


## Completion Notes

**Gate.** `npm run validate` exit 0 over 124 test files and 4063 tests, coverage 97.03% statements
and 92.23% branches against `vitest.config.ts`'s 90/90 floor. `npm run build` exit 0. `npx biome
check src tests scripts` reports no fixes over 325 files.

**The arm, measured.** `npx vitest run tests/testing tests/adapters tests/coverage` is 409 tests
green. `runMcpProbeConformance` reports fourteen outcomes in report order, the six shared under
`probe/` then the eight under `mcp/`, and the in-repository subject over the shipped adapter and a
real stdio server passes all fourteen with an empty failure list.

**What the assertions actually see.** Each of the eight was checked against the real observation
before the arm was trusted, since a green suite is the thing this story exists to distrust.
`failing_tool` answers with `isError: true` and a structured reason. The metacharacter argument
`$(echo pwned); rm -rf / #` comes back on `echo` byte for byte, with `matches` mangled by the
fixture's own slug function, which is why the assertion reads the scalar. `search_notes` carries all
four declared result keys. Both denials throw `forbidden-target` with the interface or the tool named,
before any process starts. `hanging_tool` throws `budget-exhausted` naming `maxElapsedMs (300ms)` and
`oversize_tool` throws it naming `maxOutputBytes (8192)` on stdout, so the cap and the denial stay
distinguishable in the message as well as in the code.

**The mutants.** Seventeen, eight for the `mcp` arm and nine backfilled for the `cli` arm, each
asserting exactly one outcome id goes red. Every knob is keyed to its own `operationId`, which is
what keeps the two result-reading `mcp` assertions disjoint: a mutant that emptied the result for
every request would flip both and neither would be measuring what its id says. Two further cases
assert the failure detail rather than the flip, and one asserts the non-matching arm of
`observe-error-result` names the kind it observed.

**Four assertions proved against the shipped adapter by mutation, not only against a synthetic
subject.** The synthetic suite proves each assertion is individually falsifiable; these prove the
same assertions are falsifiable against the code an adopter runs. Reverting `bodyOf`
(`src/adapters/mcp-adapter.ts`) to always answer `{ kind: 'absent' }` turns
`mcp/observe-declared-result-channel` red with "the result channel carried {\"kind\":\"absent\"},
expected the structured result carrying [\"ok\",\"matches\",\"totalCount\",\"echo\"]", and
`mcp/arguments-passed-as-declared` with it, since one `bodyOf` serves both requests in the real
adapter. Sending `arguments: {}` instead of the declared channel turns only
`mcp/arguments-passed-as-declared` red, with "the tool reported receiving null on \"echo\", expected
the declared literal". Making `evaluateMcpTarget` allow every interface and every tool turns exactly
`mcp/deny-unmapped-interface` and `mcp/deny-unauthorized-tool` red, each reporting both halves:
"resolved instead of rejecting with \"forbidden-target\"; underlyingCalls() was 1, expected 0", which
is the call-count pin doing its own work rather than riding on the code check.

That the two result-reading assertions flip together against the real adapter and separately in the
synthetic suite is the expected split and worth stating: the real adapter has one projection serving
both requests, while the synthetic subject keys each mutant to its own `operationId`, which is what
the one-flip-per-mutant rule is about.

**The grading, and why its table of fourteen `true`s is not vacuous.** Six oracle-removal cases,
covering all seven rules: O-001 and O-003 each carry `success-indicator-separation` and `whole-body`
for their own operation, O-002 carries `per-record` and `omission-and-completeness`, O-006 with
O-007 carries `malformed-input`, O-005 carries `sibling-cross-check`, and O-004 carries
`state-change-read-back`. Every mutant still compiles under `strict`, so the predicates run on all of
them. Both operations' descriptor roots are asserted directly at `/response-body`, which is the
prefix `/interactions/search/response-body/matches` starts with; the command grading found that root
wrong at `/artifact`, and it is the same failure this assertion forecloses for the kind.

**What moved outside `src/testing/`.** `tests/adapters/probe-subject.test.ts` loses its duplicated
guard. `tests/preflight/mcp-plan.test.ts`'s header loses a claim Story 11.13 falsified.
`_bmad-output/project-knowledge/learning-path-step-by-step.md` gains step 52 and step 51's closing
Watch out is corrected. `docs/reference/cli-commands.md` gains the third runner and the sixth count;
`docs/how-to/evaluate-tool-use-behavior.md` loses the sentence saying the arm is owed and loses the
conformance-arm item from its Missing list. `CHANGELOG.md` gains one `### Added` bullet under
`[Unreleased]` with the `ConformancePort` widening as its BREAKING sub-bullet. Nothing below
`[Unreleased]` is touched.

**What did not move, and why the silence is deliberate.** No schema document, census constant,
generated table, corpus member or contract fixture. `check:schemas`, `check:ad31-table`,
`check:corpus` and `check:worked-example` are green with nothing regenerated, which is the mechanical
proof. Story 11.8 owns every count this story could otherwise have moved.
