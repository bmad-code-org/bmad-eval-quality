---
title: 'The tool-call defect signature and the ninth input channel'
type: 'feature'
created: '2026-09-09'
status: 'draft'
review_loop_iteration: 0
context:
  - _bmad-output/implementation-artifacts/epic-11-context.md
  - _bmad-output/implementation-artifacts/11-4-the-operation-shape-for-a-tool-call.md
  - _bmad-output/implementation-artifacts/11-5-compile-and-preflight-admit-an-mcp-interface.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

This story and Story 11.13 are the two halves of one earlier draft, split on the line Decision 1
records. This half lands first. The epic's execution order is 11.1 through 11.6, then 11.13, then
11.7, 11.8, 11.10, 11.11, 11.12, and 11.9 last.

**Problem:** Story 11.4 grew the input vocabulary and left two of its three consumers behind. Its
Decision 5 made `arguments` the ninth member of `INPUT_CHANNELS` (`schemas/pointer.ts:71-76`), while
`ObservedCallInputs` (`schemas/sealed-run-record.ts:200-209`) and `ProbeInputBinding`
(`schemas/defect-signature.ts:86-95`) both still declare eight keys, so `witness.ts:140-143`,
`bindings.ts:295`, and `evidence-resolution.ts:133` each index a nine-member channel name into an
eight-key object, and `callInputsOf` (`preflight/witness-evidence.ts:63-92`) tests
`'body' in inputs` over a union that now has three members and reads `inputs.argument` on the false
arm. Second, the corpus side is closed to the kind: `DefectSignature`
(`schemas/defect-signature.ts:189-192`) has two branches, `ApiDefectSignature.interfaceKind` still
carries `mcp` at `:164` on a branch that declares a method and a path template, and the qualification
gate at `score/qualification.ts:754-763` still raises `signature-interface-kind-unsupported` for the
kind. So a probe written against the contract Story 11.5 admits cannot qualify.

**Approach:** Widen both record shapes to nine keys, give `callInputsOf` its third arm, and take the
sealed run record's and the probe's BREAKING bumps for the retyping. Give `DefectSignature` its own
`mcp` branch, narrow `ApiDefectSignature.interfaceKind` to `['api','web']`, open the qualification
gate for `mcp` while it stays shut for `web`, and land the `UNION_BRANCH_FIXTURES` seed that keeps
AD-13's sweep green in the same diff. When this story ends, an `mcp` probe qualifies and a sealed run
record can carry a tool call's arguments, which closes the qualification half of the window Story
11.5 opened on purpose. The port half of that window stays open until Story 11.13: `planPreflight`
still builds an `McpProbeRequest` no shipped adapter can answer, and `kindMismatch`
(`preflight/reduce.ts:75-81`) reports every answer as `port-contract-violation`.

## Boundaries & Constraints

**Always:**

- Two BREAKING `schemaVersion` bumps, each recorded in the driving field's own `.describe()` per
  AD-11: sealed run record 4 to 5 and probe 4 to 5. Story 11.4 takes the probe's 3 to 4 move for the
  `WitnessInputs` widening, and Decision 2 records why the second lands here.
- The qualification gate opens for `mcp` and stays shut for `web`. `qualification.ts:754-763` reads
  the pair `('api', 'cli')` today; `mcp` joins the admitted set and `web` keeps
  `signature-interface-kind-unsupported` fireable with a detail that names it.
- The signature branch and its `UNION_BRANCH_FIXTURES` seed ship in one diff. Decision 3 gives the
  mechanical reason.
- AD-13's four checks move together: the rejection suite, `check:schemas`, the differential, and the
  keyword-mutation sweep. Every census constant in `tests/schemas/published-census.ts` the two schema
  changes move is moved by reading the failure, per Decision 4.
- Every JSDoc and comment this story writes is pruned and de-AI'd while it is written. No comment runs
  longer than the declaration it documents, and the negation-then-correction construction is absent in
  every form.
- Documentation moves in this diff. Every page this story makes false is corrected here, and text the
  change makes redundant is cut in the same pass.
- The caller-facing disclosure moves in this diff too. NFR8 (`epics.md:54`) requires every
  caller-facing break called out, and this story lands two BREAKING bumps and a narrowed published
  enum, so a `CHANGELOG.md` `[Unreleased]` entry ships with them. Nothing below `[Unreleased]` is
  edited: `release:prepare` (`package.json:111`) owns every dated section.
- No source comment may contain any of `check:boundary`'s forbidden strings, so no epic, story,
  acceptance-criterion, task, or decision number appears under `src/` or `corpus/`.

**Ask First:**

- Any AD-5 code, any `QUALIFICATION_FAILURES` member (`qualification.ts:59-80`), or any spine
  registry edit. This story mints none: opening `signature-interface-kind-unsupported` for `mcp`
  narrows an existing code's firing set and adds no row.
- Any eval-contract `schemaVersion` move. Story 11.4 owns that artifact's bump and this story takes
  none.
- Any change to `CommandDefectSignature` or to `ApiDefectSignature`'s `method` and `pathTemplate`.
  This story is additive on the first and narrows exactly one enum on the second.

**Never:**

- No `McpProbeObservation`, no `ProbeObservation` union member, and no arm in `projection.ts`,
  `witness-evidence.ts`'s observation branches, or `reduce.ts`'s `anomalyOf`. Story 11.13 owns the
  observation union and every branch it forces. The one `witness-evidence.ts` edit this story makes is
  `callInputsOf`'s third arm, which Story 11.4's `WitnessInputs` union forces and which reads no
  observation at all.
- No adapter, no `McpTargetAuthorization`, no `McpTargetPolicy`, no `evaluateMcpTarget`, and no
  export on `eval-quality/adapters`. Story 11.13 owns all five.
- No third conformance arm, no `McpProbeSubject`, no `mcp-probe` entry in
  `CONFORMANCE_OUTCOME_COUNTS`. Story 11.7 owns them and derives the count from Story 11.13's
  authorization shape.
- No `plan-index.ts` third map, no `resolveHomeOperation` kind test, no `requestOf` construction, and
  no rewrite of the two `qualification.ts` detail strings at `:349` and `:458`. Story 11.5 claims all
  four. The one `qualification.ts` edit this story makes is the gate at `:754-763`, which Story 11.5
  leaves closed for `mcp` by construction.
- No spine revision and no new ADR. Every ambiguity is settled below.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| An mcp probe qualifies | A probe whose `defectSignature` is an `McpDefectSignature` over a declared tool | Qualifies. The gate at `qualification.ts:754-763` admits the kind | N/A |
| A web probe still does not | A probe whose signature declares `interfaceKind: 'web'` | `signature-interface-kind-unsupported`, detail naming `web` and naming the three admitted kinds | Rejected by the gate |
| An mcp signature on the api branch | A signature carrying `interfaceKind: 'mcp'` beside a `method` and a `pathTemplate` | Fails to parse: `ApiDefectSignature.interfaceKind` is `['api','web']` and `McpDefectSignature` declares a tool identity | Parse failure |
| MCP selector binding | A `cli`-shaped `ProbeInputBinding` on an `mcp` signature | Fails `condition-selector-key-undeclared` against an operation declaring one channel | Rejected by the gate |
| Signature channel confinement | An `mcp` defect signature addressing `stdout` | `condition-text-channel-on-api`, unchanged: `foreignChannels` (`qualification.ts:148-151`) already hands every non-`cli` kind the command channels as foreign | Rejected by the gate |
| Tool-call inputs recorded | A record whose `callInputs.arguments` carries a tool call's arguments | Parses; `/interactions/{stepId}/call-inputs/arguments/{key}` resolves through `channelRoot` | N/A |
| Selector over the ninth channel | A `ProbeInputBinding` binding `arguments` | `selectorAdmits` and `satisfiesBindings` both filter on that channel | N/A |
| A witness leg's mcp inputs | An `McpWitnessInputs` leg reaching `callInputsOf` | Returns a nine-key record with `arguments` filled and the other eight `null` | N/A |
| Api call inputs on an mcp operation | A record whose `callInputs.arguments` is null and whose `body` is set for an mcp operation | Parses. AD-32 makes the mismatch a cross-artifact inconsistency ingest records | Recorded by ingest |
| Existing record at version 4 | Any sealed run record in `tests/` or `corpus/` | Fails to parse against version 5, which is what makes the bump breaking and visible | Parse failure |
| Existing probe at version 4 | Any probe left at Story 11.4's stamp | Fails to parse against version 5, on the same terms | Parse failure |

</frozen-after-approval>

## Code Map

**The two record shapes that are still eight keys wide**

- `src/core/schemas/sealed-run-record.ts:200-209` -- `ObservedCallInputs`, whose comment at `:191-199`
  gives the reason the shape is keyed by channel at all: "AD-26 keys `call-inputs` by transport
  channel, so a pointer like `/interactions/write/call-inputs/body/title` needs that segment to
  resolve against" (`:192-195`). The same comment still says "A four-key strict object" at `:195-196`,
  which Epic 9's fifth through eighth keys already falsified, so the ninth key's pass corrects it.
- `src/core/schemas/sealed-run-record.ts:222-272` -- `Observation`, flat over the evidence channels
  with no kind discriminator. It declares thirteen fields, counted: `observationId`, `sequence`,
  `operationId`, `provenance`, `principal`, `callInputs`, `responseBody`, `responseHeaders`,
  `responseStatus`, `stdout`, `stderr`, `exitCode`, `artifacts`. `responseBody`'s published
  `.describe()` at `:243` says "all ten observation fields", which is false in the tree before this
  epic reaches the file. `:415` is the artifact `.meta` carrying the version history prose.
- `src/core/schemas/defect-signature.ts:86-95` -- `ProbeInputBinding`, whose comment at `:73-85` states
  the invariant the ninth key has to preserve: the three shapes agree "on channel names, on the
  eight-key strict form, and on flatness". `:109` is the consumption inside `ProbeStepSelector`,
  which is why the ninth channel and the signature branch below are one file and one diff.
- `src/core/score/witness.ts:140-143` -- `selectorAdmits`, looping `INPUT_CHANNELS` and indexing
  `observation.callInputs[channel]`. Total once the ninth key lands.
- `src/core/score/bindings.ts:290-295` -- `satisfiesBindings`, reading `boundChannelsOf` and indexing
  the same object. Total on the same terms.
- `src/core/evaluate/evidence-resolution.ts:125-133` -- `channelRoot`'s `call-inputs` case, indexing by
  the parsed channel. Total on the same terms.
- `src/core/preflight/witness-evidence.ts:63-92` -- `callInputsOf`, which builds an
  `ObservedCallInputs` from an eight-key `empty` literal behind a two-arm `'body' in inputs` test.
  Story 11.4's three-member `WitnessInputs` makes the false arm a union whose `inputs.argument` read
  fails the typecheck, so this function takes a third arm here. It reads no observation, which is why
  it belongs to this half.
- `src/core/schemas/pointer.ts:71-76` -- `INPUT_CHANNELS`, nine members after Story 11.4. Its own
  comment says the grammar "admits all eight", which Story 11.4 owns.
- `tests/schemas/fixtures/artifact-fixtures.ts:148-151` -- the sealed run record fixture at
  `schemaVersion: 4`, with the file's own note that it "is the only place a Sealed Run Record version
  number is written down, which is what makes each bump visible".
- `tests/schemas/fixtures/artifact-fixtures.ts:453`, `:535`, `:564` -- the three probe fixtures, at
  `schemaVersion: 3` in the tree today and at 4 once Story 11.4 lands. Story 11.4 also adds a probe
  accept fixture to this file, so every line number here is re-read before it is edited.
- `tests/schemas/published-census.ts` -- the pinned constants, each moved by reading the failure and
  following the procedure that file documents. `ACCEPT_FIXTURE_COUNTS` is at `:100-107`,
  `CENSUS_BY_DOCUMENT` at `:20-33`, `CENSUS_BY_KEYWORD` at `:36-56`, `CENSUS_TOTAL` at `:64`,
  `DEFS_BY_DOCUMENT` at `:67-80`, `REJECT_CASE_COUNTS` at `:88-92`. Decision 4 states the arithmetic.

**The defect signature and the qualification gate**

- `src/core/schemas/defect-signature.ts:151-162` -- `ApiDefectSignature`'s comment. `:152-155` says
  "`web` and `mcp` share the shape and are still rejected by the qualification gate", which this story
  makes false for `mcp`. `:157-161` is the byte-identity argument for one api-shaped branch over three
  kinds, which Decision 3 reads and answers.
- `src/core/schemas/defect-signature.ts:163-168` -- `ApiDefectSignature`, whose `interfaceKind` at
  `:164` is `z.enum(['api', 'web', 'mcp'])` and becomes `z.enum(['api', 'web'])`.
- `src/core/schemas/defect-signature.ts:170-181` -- `CommandDefectSignature`, the precedent
  `McpDefectSignature` follows: a literal kind, one contract-independent transport identity, and
  `...signatureCommon`. Its comment at `:171-175` gives the reason the identity is declared rather
  than an operation identifier.
- `src/core/schemas/defect-signature.ts:183-188` -- the union comment, whose `:185` reads "the
  api-shaped branch carries three values for it". Two after the narrowing, and the union at `:189-192`
  takes a third member.
- `src/core/schemas/defect-signature.ts:194-200` -- the inferred type exports, which gain
  `McpDefectSignature`.
- `src/core/score/qualification.ts:754-763` -- the gate. `:754-757` is the two-clause condition
  spelling `('api', 'cli')`, `:759` the `code` field, `:761` the detail that says the kind "declares a
  method and a path template with no per-kind semantics behind them", which stays word for word true
  of `web` and stops being true of `mcp`.
- `tests/schemas/fixtures/artifact-fixtures.ts:1109` -- `UNION_BRANCH_FIXTURES`. `:1136-1142` is the
  `probe/command-signature` entry the `mcp` entry follows, and `:480-488` is the `cli` signature
  fixture whose comment at `:486-488` states why a branch needs a seed at all: "a branch nothing
  exercises is a branch AD-13's sweep reports as unprotected".
- `tests/schemas/published/keyword-mutation.test.ts:190-193` -- the assertion that fails on any
  published keyword occurrence no fixture flips. This is why the seed cannot wait for Story 11.8.
- `tests/schemas/published/corpus.ts:28-47` -- `seedsOf`, which draws the sweep's seeds from five
  lists. Three are closed against a new member, which is why every new accept fixture in this epic
  lands in `UNION_BRANCH_FIXTURES` and why Decision 4's arithmetic reads the way it does.
- `tests/score/qualification.test.ts:249-259` -- `it.each(['web', 'mcp'])` expecting
  `['signature-interface-kind-unsupported']`, with the comment at `:247-248` saying "`web` and `mcp`
  still have no declared probe semantics". This story is what makes both false for `mcp`. Story 11.4
  claims the matching `tests/schemas/ad5-admissions.test.ts:272-279`, which runs the same pair
  through `admits` (`:14-20`) and which its operation branch breaks first.
- `tests/schemas/published/published-rejection.test.ts:215-217` and `:222` -- two comments already
  stale in the tree: "six union branches" against a pinned 8, and "Thirty listings, twenty distinct
  instances" against a pinned 22 and an `ACCEPT_FIXTURE_TOTAL` of 32. This story's seed moves both
  again, so both are re-read and rewritten to the numbers its own run reports.

**Read here as context, changed by no story of this half**

- `src/core/score/qualification.ts:148-151` -- `foreignChannels`.
  `kind === 'cli' ? API_RESPONSE_CHANNELS : COMMAND_RESPONSE_CHANNELS` is a total binary, so an `mcp`
  signature is confined to `response-body`, `response-headers`, and `response-status` with no source
  change. Story 11.13's Decision 6 decides what two of those three carry.
- `src/core/score/qualification.ts:115-134` and `:349`, `:458` -- `resolveHomeOperation`'s three-way
  kind test and the two details Story 11.5 rewrites.
- `src/core/compile/reachability.ts:437-446` -- Story 11.5's refusal of `response-headers` on an `mcp`
  operation, with `response-body` and `response-status` left reachable.

**Documentation this story owns**

Story 11.9's ownership tables at `:71-100` and `:104-118` assign both sites below to this story, and
they split `:236` between the eight-key half here and Story 11.13's confinement clause. Every other
documentation site the earlier combined draft claimed belongs to Story 11.13, which ships the adapter
and the port union those sentences describe.

- `docs/how-to/evaluate-tool-use-behavior.md:72` -- "`ObservedCallInputs` is one eight-key object
  holding both kinds' input channels (`sealed-run-record.ts:200`)". The ninth key falsifies it. The
  inline citation is re-read at the same time.
- `docs/how-to/evaluate-tool-use-behavior.md:236` -- the same eight-key claim inside the "Already
  works" paragraph, plus an inline `sealed-run-record.ts:222` citation that a key added inside
  `ObservedCallInputs` moves. **The eight-key half of this line is this story's.** The same line's
  claim that a tool-use signature's confinement "is decided rather than open" is Story 11.13's, whose
  Decision 6 changes what two of the three confined channels carry.
- `docs/*.generated.md` and `corpus/dev/README.md` -- generated, never hand-edited.
- `CHANGELOG.md:1-9` -- the header: entries go under `[Unreleased]` and `release:prepare`
  (`package.json:111`) stamps them into a dated section at release time. Hand-maintained, so NFR8's
  disclosure ships with the change that causes it.
- `CHANGELOG.md:285-290` and `:311-313` -- Epic 9's artifact-bump bullets, the shape to copy: a
  `**BREAKING**` lead, the artifact and its new number, what was retyped, and what a holder of the
  previous version sees. `:311-313` is the closest model, carrying the sealed run record and the probe
  in one bullet. `:578` already states that the `schemaVersion` number gates nothing in either
  direction in v0, which covers both bumps here, so this entry does not restate it. Story 9.5's file,
  at `:127`, is the one Epic 9 story that carried the entry as a checklist item; 9.1, 9.2 and 9.3 cite
  the file in prose and carry no task, which is how a disclosure gets left to a closing story.

## Tasks & Acceptance

**Execution:**

- [ ] `src/core/schemas/sealed-run-record.ts` -- add `arguments` to `ObservedCallInputs` as the ninth
      nullable key; record the 4 to 5 BREAKING bump in that field's own `.describe()` and restate it
      in the artifact `.meta`. In the same pass correct the two stale counts the Code Map names above,
      each verified by counting the declaration: `ObservedCallInputs` is called a four-key object and
      `Observation` is called ten fields. `description` is absent from `CENSUS_BY_KEYWORD`'s nineteen
      counted keywords, so the second edit moves no census constant and rides the `generate:schemas`
      and `check:schemas` pass this story already runs.
- [ ] `src/core/schemas/defect-signature.ts` -- add the same ninth key to `ProbeInputBinding` and
      correct its "eight-key strict form" sentence to nine; record the probe's 4 to 5 BREAKING bump
      per Decision 2, naming both changes that break it.
- [ ] `src/core/schemas/defect-signature.ts` -- add `McpDefectSignature`, a literal
      `interfaceKind: 'mcp'`, the tool identity Story 11.4's `McpOperation` declares, and
      `...signatureCommon`, on `CommandDefectSignature`'s model. Its comment answers the existing
      byte-identity argument in the terms Decision 3 sets.
- [ ] `src/core/schemas/defect-signature.ts` -- narrow `ApiDefectSignature.interfaceKind` from
      `['api', 'web', 'mcp']` to `['api', 'web']`; add the branch to the `DefectSignature` union and
      the inferred type; correct the two comments the change falsifies, the one saying `mcp` shares
      the api shape and the one saying the api-shaped branch carries three values.
- [ ] `src/core/score/qualification.ts` -- open the gate for `mcp`: the condition admits it beside
      `api` and `cli`, and the detail keeps firing for `web` and names the three admitted kinds. No
      `QUALIFICATION_FAILURES` member moves.
- [ ] `src/core/preflight/witness-evidence.ts` -- give `callInputsOf` its third arm over
      `McpWitnessInputs`, writing `arguments` and leaving the other eight channels `null`, and add
      `arguments: null` to the `empty` literal so the two existing arms stay total.
- [ ] `tests/schemas/fixtures/artifact-fixtures.ts` -- add the `mcp` signature accept fixture and its
      `UNION_BRANCH_FIXTURES` entry beside `probe/command-signature`, in this diff. The keyword sweep
      fails on any published keyword no fixture flips, so the branch and its seed cannot be split
      across two stories. The entry's `discriminator` reads `interfaceKind`, on
      `probe/command-signature`'s own terms: `tests/schemas/artifacts.test.ts:103-115` counts only
      the probe entries naming the root discriminator `expectedClean` against that union's two
      branches, so a seed naming `expectedClean` makes the count 3 against 2 and turns `validate`
      red. Story 11.4's Decision 10 records the rule.
- [ ] `npm run generate:schemas` -- regenerate `sealed-run-record.schema.json` and `probe.schema.json`;
      move every census constant in `tests/schemas/published-census.ts` the two documents move, by
      reading each failure. Decision 4 states which ones and what each move is.
- [ ] `tests/schemas/fixtures/artifact-fixtures.ts` -- move the four version literals (`:151` for the
      sealed run record, `:453`, `:535`, `:564` for the probes, each line re-read after Story 11.4's
      edits to this file), add `arguments: null` to the `emptyCallInputs` literal at `:134`, and fill
      `callInputs.arguments` on one observation of `sealedRunRecordFixture` so the ninth key ships
      with the accept seed AD-13's sweep reads for it. This story owns that fixture and it is the
      only one: `Observation` (`sealed-run-record.ts:222-272`) declares no interface kind, so a
      filled `arguments` channel is the whole of what makes a sealed observation tool-shaped, and the
      keyword and its seed land in one diff. Story 11.13's port-message fixture is a different shape
      in a different file.
- [ ] `tests/schemas/fixtures/artifact-reject-cases.ts` -- one single-mutation reject fixture per new
      published constraint, per AD-13 and AD-30, including one for the narrowed
      `ApiDefectSignature.interfaceKind` so a fixture proves the removed enum member is refused.
- [ ] `tests/score/qualification.test.ts` -- narrow the `it.each` pair to `web` alone, add the `mcp`
      case asserting no failure code, and correct the comment above it, which says both kinds have
      undeclared probe semantics.
- [ ] `tests/schemas/published/published-rejection.test.ts` -- rewrite the two stale enumeration
      comments the Code Map names to the counts this story's run reports.
- [ ] `tests/score/`, `tests/evaluate/`, `tests/preflight/` -- one case per branch this story adds: the
      `arguments` pointer resolution through `channelRoot`, the three `callInputs` indexing sites,
      `callInputsOf`'s third arm, the `foreignChannels` confinement for an `mcp` signature, and the
      three qualification cases the I/O Matrix names.
- [ ] `docs/how-to/evaluate-tool-use-behavior.md:72` and `:236` -- correct the eight-key claim in both
      and re-read the inline `sealed-run-record.ts` citations against the tree. The confinement
      sentence on `:236` stays for Story 11.13.
- [ ] `CHANGELOG.md` `[Unreleased]` -- one disclosure block, on the shape `CHANGELOG.md:1-9` sets and
      Story 9.5 followed. It names both BREAKING bumps this story lands, the probe's 4 to 5 as the
      second of the epic's two with Story 11.4's 3 to 4 named as the first, and the sealed run
      record's 4 to 5. It names the narrowed `ApiDefectSignature.interfaceKind`, so a corpus probe
      carrying `interfaceKind: 'mcp'` beside a method and a path template stops parsing. It names the
      ninth `arguments` key on both record shapes. The adapter and the observation union are Story
      11.13's entry and are not mentioned here.
- [ ] Comment pass -- prune every JSDoc and comment written here while writing it, then grep the
      edited files for `, not `, `rather than`, `instead of`, `as opposed to`, `, never `, and
      `no longer`, and confirm each surviving hit is a real contrast whose halves both carry a fact.
- [ ] `_bmad-output/project-knowledge/learning-path-step-by-step.md` -- add the next unused step,
      tagged `(epic11-story6)`, plus its row in the step table, following `learning-path-template.md`.
      The epic's steps now run 45 through 57, since it carries thirteen stories.

**Acceptance Criteria:**

- Given a probe whose defect signature is an `McpDefectSignature` over a declared tool, when
  `qualifyProbe` runs, then it qualifies; and given the same probe with `interfaceKind: 'web'`, then
  `signature-interface-kind-unsupported` fires with a detail naming `web`. Both gates keep a fixture.
- Given a signature carrying `interfaceKind: 'mcp'` beside a `method` and a `pathTemplate`, when it is
  parsed, then it fails, so a fixture proves the narrowing.
- Given a record recording `callInputs.arguments`, when a pointer addresses
  `/interactions/{stepId}/call-inputs/arguments/{key}`, then it resolves the recorded value, and
  `selectorAdmits` and `satisfiesBindings` both filter on that channel.
- Given an `McpWitnessInputs` leg, when `callInputsOf` runs, then it returns a nine-key record with
  `arguments` filled and the other eight `null`, and `npm run typecheck` exits 0 with the three
  indexing sites Story 11.4 left failing now compiling.
- Given every sealed run record and probe fixture at the old stamp, when the suite runs, then each
  fails to parse until its stamp moves, which is what makes both bumps breaking and visible.
- Given the regenerated `sealed-run-record.schema.json` and `probe.schema.json`, when AD-13's four
  checks run, then all four pass and every new published keyword has a fixture that kills it under
  mutation, including every keyword the `mcp` signature branch publishes.
- Given `tests/schemas/published-census.ts`, when the suite runs, then every moved constant was read
  off a failure, `ACCEPT_FIXTURE_COUNTS.unionBranches` and `.distinctInstances` each moved by one from
  Story 11.4's state, and the two enumeration comments in `published-rejection.test.ts` name the same
  numbers the constants do.
- Given every existing `api` and `cli` fixture and the worked chain, when the whole suite runs, then
  every outcome, verdict, and emitted byte is unchanged apart from the two version stamps.
- Given `CHANGELOG.md`'s `[Unreleased]`, when read, then it names both BREAKING bumps with their moves,
  says which of the epic's two probe bumps this one is, and names the narrowed signature enum and the
  ninth input channel as caller-facing breaks. NFR8 (`epics.md:54`) is what requires it.
- Given `npm run check:boundary`, when it runs, then it exits 0 with 0 violations.
- Given `npm run validate`, when it runs, then it exits 0 with nothing on stderr.

## Decisions settled by construction

**Decision 1: the split was taken, it runs one way, and this half lands first.**
An earlier draft carried this work and Story 11.13's in one file, at three times the length of every
other story in the epic. Story 9.3's Decision 8 is the precedent for pricing that, and the split line
was checked against the source in both directions before it was taken.

The coupling is a single one-way edge. No module under `src/core/preflight/`, `src/adapters/`, or
`src/testing/` names `DefectSignature` at all, so the port half never reads this half's branch or its
gate. Nothing under `src/core/score/` or `src/core/evaluate/`, and nothing in `defect-signature.ts`,
imports `port-messages.ts`, so this half never reads the observation union. The one edge is
`ObservedCallInputs.arguments`: `callInputsOf` (`witness-evidence.ts:63-92`) builds that record and
its third arm writes the ninth key, so the key has to exist before Story 11.13's observation arms are
written against it. That is why this half is first and why `callInputsOf` sits in it.

Each half is independently green. This one closes all four sites Story 11.4 leaves failing a
typecheck, ships the seed with the branch it protects, and carries both artifact bumps and every
census move. Story 11.13 moves no published document, since `ProbeRequest` and `ProbeObservation` are
port messages with no `lineageFields` and no entry under `schemas/`, which is the finding Story 9.3
recorded when it widened them.

What a caller holds between the two: an `mcp` contract that compiles, plans a pre-flight, and whose
probes qualify, plus a sealed run record that can carry a tool call's arguments and a selector that
can filter on that channel. What they cannot do is produce an observation, so `runPreflight` against a
real server still ends in `port-contract-violation`. That is a strictly smaller gap than the one Story
11.5 already leaves open, and it is the same shape. Known-bad state avoided: one story a dev agent
cannot hold in context while implementing it, which is the failure the `bmad-build` spec template's
own size guidance names.

**Decision 2: the probe bumps twice in this epic, and this story takes the second.**
Story 11.4 takes the first. Its `WitnessInputs` widening reaches `probe.schema.json` through
`src/core/schemas/probe.ts:36`, where `Defect.manifestationWitness` carries `ManifestationWitness`, so
a third witness-inputs branch retypes the published probe and moves it 3 to 4. This story takes the
second, 4 to 5, covering both of its own breaking changes to that artifact: `McpDefectSignature` with
the `ApiDefectSignature.interfaceKind` narrowing, and `ProbeInputBinding`'s ninth `arguments` key.
Both land in one file and one diff, so one stamp answers for both. The move is recorded in
`ProbeInputBinding`'s own `.describe()` under AD-11 and restated in the artifact `.meta`, naming both
causes.

Two bumps in one epic is Epic 9's own rule: the eval contract moved 3 to 4 in Story 9.1 and 4 to 5 in
Story 9.2, because each story that retypes an artifact takes its own bump and stays independently
releasable. Folding this story's changes into 11.4's stamp would make 11.4's merge a release nobody
can cut without this one. The sealed run record's 4 to 5 move lands here too, recorded on
`ObservedCallInputs.arguments`. Downstream consequence: at this boundary both artifacts read version
5, Story 11.13 moves neither, and Story 11.8's corpus regeneration starts from that. Known-bad state
avoided: a probe corpus written against an earlier stamp that parses against a schema the version has
moved past, surfacing as a selector that filters everything out and a probe reported `not-triggered`.

**Decision 3: `mcp` gets its own signature branch, `ApiDefectSignature` narrows to `['api', 'web']`,
and the branch, the qualification gate, and the union-branch seed are one diff.**
`ApiDefectSignature`'s comment gives the argument for one api-shaped branch over three kinds, and the
argument is about byte identity: three branches carrying the same `method` and `pathTemplate` would
publish three byte-identical subschemas, and AD-13's sweep cannot attribute a keyword deletion to one
of several identical branches. That holds for `web`, which declares a method and a path template and
means them. It does not reach `mcp`, which declares a tool identity: the published `McpDefectSignature`
subschema shares no keyword shape with the api-shaped one, so a deleted keyword in it is attributable
and a fixture can flip it. Leaving `mcp` on the api branch would keep the kind declaring a method and
a path template a tool call has neither of, and the gate could not open without admitting that pair as
the tool's identity. So the branch is minted and the enum narrows in one edit, since a branch is only
correct once the value it claims is gone from the other one.

The gate opens with it. Its detail says the kind "declares a method and a path template with no
per-kind semantics behind them", word for word true of `web` and false of `mcp` from the moment the
branch lands, so opening the gate and minting the branch are one change described twice.

The `UNION_BRANCH_FIXTURES` seed ships in the same diff, and the sequencing is forced. The sweep
asserts that every published keyword occurrence outside the computed exempt set has a fixture whose
deletion it flips, so a branch landing without its seed leaves `npm run validate` red between the two
merges. The `cli` branch's own fixture records the rule: "a branch nothing exercises is a branch
AD-13's sweep reports as unprotected". Downstream consequence: Story 11.7's `mcp` grading and Story
11.8's dev-corpus exemplar both read a signature branch that already parses and already qualifies.

**Decision 4: every census number is read off the failure, starting from Story 11.4's state, and the
`ObservedCallInputs` "needs nothing" claim is withdrawn here.**
`ACCEPT_FIXTURE_COUNTS` reads `unionBranches: 8` and `distinctInstances: 22` in the tree today. Story
11.4 lands two seeds, an `mcp` eval-contract fixture and an `mcp` probe accept fixture, and both have
to join `UNION_BRANCH_FIXTURES`, because `seedsOf` draws the sweep's seeds from five lists and three
are closed against a new member: `ARTIFACT_ACCEPT_FIXTURES` is one entry per interchange artifact key,
`PROBE_CLASS_FIXTURES` is asserted equal to the closed class set, and `QUALIFICATION_ROUTE_FIXTURES`
is one per AD-9 route. So Story 11.4 moves both counts 8 to 10 and 22 to 24, and this story's
`DefectSignature` seed moves them to 11 and 25. Each number is read off the assertion that fails,
following the procedure `published-census.ts:1-17` documents for itself, so a number nobody could
produce from a failure is a number that was predicted. The two schema changes also move the document
census: `CENSUS_BY_DOCUMENT` for `probe` and `sealed-run-record`, the keyword totals in
`CENSUS_BY_KEYWORD`, `CENSUS_TOTAL`, and `DEFS_BY_DOCUMENT` if the `mcp` branch takes a named `$defs`
key, plus `REJECT_CASE_COUNTS` with this story's reject fixtures. Every one is read off its own
failure the same way.

The ninth `arguments` key on `ObservedCallInputs` withdraws the epic register's claim that
`ObservedCallInputs` needs nothing, and its cause is Story 11.4's ninth input channel: once
`INPUT_CHANNELS` has nine members, the three indexing sites the Code Map names read a nine-member
channel name into an eight-key record and fail the typecheck. The register's bullet and the matching
`epics.md` acceptance criterion are struck by the epic owner; this story states the move so the reason
lives with the change.

## Design Notes

The organising idea is a vocabulary that outran two of its three consumers. Story 11.4 made
`arguments` the ninth input channel and widened the contract-side shape; the recorded and the
probe-side shapes stayed at eight, which is why three call sites index a nine-member name into an
eight-key object today and a fourth reads a two-arm union that now has three members.

The corpus side lands in the same story because it lands in the same file. Both the ninth selector
channel and the `mcp` signature branch are edits to `defect-signature.ts`, and the two reach the
published probe document through one chain: `ProbeInputBinding` at `:86-95` is read by
`ProbeStepSelector` at `:109`, which `DiscriminatingCondition` reads at `:125`, which `signatureCommon`
reads at `:148`, which both signature branches spread. One file, one stamp, one diff, and the
qualification gate opens on the branch the same edit mints.

**A sentence that counts a shape's own keys goes stale silently.** This pass found four such sentences
over two shapes: two source comments calling `ObservedCallInputs` a four-key object and `Observation`
ten fields, and two guide sentences calling `ObservedCallInputs` an eight-key object. Nothing gates any
of them. `check:schemas` compares bytes and cannot read a numeral for sense, `check:docs` never scans
`docs/`, and the count reads plausible at every value, so a reader gets no signal and the sentence
survives each shape change that falsifies it. So the implementation pass greps for the pattern, which
catches more than these four: over the files this story edits, find every numeral sitting next to a
shape's name, count the declaration, and correct or delete it. Deleting is often the better repair,
since a sentence saying what the fields are for needs no census of them.

The shapes, for orientation only:

```ts
export const McpDefectSignature = z.strictObject({
	interfaceKind: z.literal('mcp'),
	toolName: ToolName, // the contract-independent identity, AD-40's rule
	...signatureCommon,
})
```

## Verification

**Commands:**

- `npm run typecheck` -- expected: exit 0. The three `callInputs` indexing sites and `callInputsOf`
  all compile once the ninth key and the third arm land.
- `npx vitest run tests/schemas` -- expected: green with the four version literals moved and every
  census constant the two documents moved updated, each read off its own failure.
- `npx vitest run tests/schemas/published/keyword-mutation.test.ts` -- expected: green. Every keyword
  the `mcp` signature branch publishes is killed by the seed this diff adds.
- `npx vitest run tests/score/qualification.test.ts` -- expected: green with an `mcp` probe that
  qualifies and a `web` probe that still raises `signature-interface-kind-unsupported`.
- `npx vitest run tests/score tests/evaluate tests/preflight` -- expected: green, one case per I/O
  Matrix row.
- `npm run generate:schemas && npm run check:schemas` -- expected: exit 0 after regeneration, with
  `sealed-run-record.schema.json` and `probe.schema.json` as the only two documents that moved.
- `npm run check:boundary` -- expected: exit 0, 0 violations.
- `npm run check:worked-example` -- expected: exit 0 after the record's stamp moves, with the stamp as
  the only difference.
- `npm run check:ad33-table` and `npm run check:ad21-table` -- expected: exit 0 with no regeneration,
  proving the outcome procedure and both ladders read no signature branch.
- `npm run check:doc-invocations` and `npm run check:docs` -- expected: exit 0. Story 11.2 armed the
  tool-use guide as an executed input, so this story's two edits to it are executed and checked.
- `grep -nE ', not |rather than|instead of|as opposed to|, never |no longer' src/core/schemas/sealed-run-record.ts src/core/schemas/defect-signature.ts src/core/score/qualification.ts src/core/preflight/witness-evidence.ts`
  -- expected: every hit is a contrast whose two halves each carry a fact, checked by reading, and
  every other hit removed.
- `grep -nEi '[a-z]+-key|[0-9]+ (fields|keys|members|channels)|(four|eight|nine|ten|twelve|thirteen) (fields|keys)' src/core/schemas/*.ts docs/how-to/evaluate-tool-use-behavior.md`
  -- expected: every surviving numeral was checked by counting the declaration it describes. This is
  the Design Notes' pattern grep.
- `git diff CHANGELOG.md` -- expected: every hunk sits under `[Unreleased]` and nothing below it is
  touched, since `release:prepare` owns every dated section.
- `npm run test:coverage` -- expected: exit 0 with `src/core/**` at or above 90% statements and 90%
  branches.
- `npm run validate` -- expected: exit 0 with no output on stderr, over the 21 steps `package.json:113`
  declares at this boundary; Story 11.8 adds the twenty-second, `check:doc-counts`, later. Six of the
  21 read this story's changes: `check:schemas`, `check:boundary`, `check:worked-example`,
  `check:docs`, `check:doc-invocations`, and `test:coverage`, which is `vitest run --coverage` over
  the whole suite (`package.json:80`) and therefore where the keyword-mutation sweep runs. The seed
  shipping in this same diff is what keeps that sweep green at the boundary.
