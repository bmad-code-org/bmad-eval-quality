---
title: 'The tool-call defect signature and the ninth input channel'
type: 'feature'
created: '2026-09-09'
status: 'done'
review_loop_iteration: 2
route: 'dispatch'
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

Verified against the tree at 8e814c6, after Stories 11.4 and 11.5 landed. Where the drafted map named
a line the tree no longer carries, the current line is given and Decision 5 records why.

**The two record shapes that were eight keys wide**

- `src/core/schemas/sealed-run-record.ts:200-209` -- `ObservedCallInputs`. Its comment at `:191-199`
  gives the reason the shape is keyed by channel at all, and says "A four-key strict object" at
  `:195`, which eight keys already falsified.
- `src/core/schemas/sealed-run-record.ts:222-272` -- `Observation`, flat over the evidence channels
  with no kind discriminator. Thirteen fields, counted. `responseBody`'s published `.describe()` at
  `:243` says "all ten observation fields".
- `src/core/schemas/defect-signature.ts:73-95` -- `ProbeInputBinding` and the comment stating the
  invariant: the two shapes agree "on channel names, on the eight-key strict form, and on flatness".
  `:109` is the consumption inside `ProbeStepSelector`.
- `src/core/score/witness.ts:135-155` -- `selectorAdmits`, looping `INPUT_CHANNELS`.
- `src/core/score/bindings.ts:290-300` -- `satisfiesBindings`, reading `boundChannelsOf`.
- `src/core/evaluate/evidence-resolution.ts:126-145` -- `channelRoot`'s `call-inputs` case.
- `src/core/declared-inputs.ts:208-253` -- `channelEntryOf` and `channelEntryOrAbsent`, the bridge
  Story 11.4 landed so a nine-member loop stayed total against an eight-key record. Its own docblock
  says both shapes "stop at the eight channels the first two kinds accept" and that the bridge holds
  "until" the ninth key lands. Decision 6 is what this story does with it.
- `src/core/preflight/witness-evidence.ts:63-100` -- `callInputsOf`. Story 11.4 already gave it three
  arms; the mcp arm returns the eight-key `empty` literal with a comment naming this story as the
  reconciliation.
- `src/core/schemas/pointer.ts:71-90` -- `MCP_CHANNELS` and `INPUT_CHANNELS`, nine members.
  `TransportChannel`'s `.describe()` at `:43` calls the transport four "the four keys an
  observation's recorded call inputs are keyed by".
- `tests/schemas/fixtures/artifact-fixtures.ts:134-143` -- `emptyCallInputs`; `:152` the sealed run
  record stamp; `:457`, `:539`, `:611` the three probe stamps; `:1156` `UNION_BRANCH_FIXTURES`.
- `tests/schemas/artifacts.test.ts:751-763` -- the assertion pinning the eight-versus-nine gap.
- `tests/evaluate/evidence-resolution.test.ts:271-305` -- fixture 17b, the only case that told
  `channelEntryOf` and `channelEntryOrAbsent` apart.
- `tests/schemas/published-census.ts` -- `CENSUS_BY_DOCUMENT:20`, `CENSUS_BY_KEYWORD:36`,
  `CENSUS_TOTAL:64`, `DEFS_BY_DOCUMENT:67`, `REJECT_CASE_COUNTS:88`, `ACCEPT_FIXTURE_COUNTS:100`.

**The defect signature and the qualification gate**

- `src/core/schemas/defect-signature.ts:140-152` -- `signatureCommon`'s docblock, which describes
  AD-40's four declarations in the api spelling and was already falsified by the `cli` branch.
- `src/core/schemas/defect-signature.ts:156-167` -- `ApiDefectSignature`'s comment: "`web` and `mcp`
  share the shape and are still rejected by the qualification gate", plus the byte-identity argument
  Decision 3 answers.
- `src/core/schemas/defect-signature.ts:168-173` -- `ApiDefectSignature`, `interfaceKind` at `:169`.
- `src/core/schemas/defect-signature.ts:175-186` -- `CommandDefectSignature`, the model
  `McpDefectSignature` follows.
- `src/core/schemas/defect-signature.ts:188-205` -- the union comment ("the api-shaped branch carries
  three values for it"), the union, and the inferred type exports.
- `src/core/score/qualification.ts:818-828` -- the gate, spelling `('api', 'cli')` as a two-clause
  condition. This is the fourth transcription Story 11.5's Decision 1 left for this story.
- `src/core/compile/interface-inventory.ts:35-47` -- `SUPPORTED_INTERFACE_KINDS`,
  `isSupportedInterfaceKind`, and `SUPPORTED_KINDS_CLAUSE`, all exported by Story 11.5.
- `src/core/score/qualification.ts:112-134` -- `declaredIdentityOf`, the switch whose `mcp` arm
  returns `null`. `interface-inventory.ts:137-139` is `mcpSignature`, the rendering it takes.
- `src/core/score/qualification.ts:181-202` -- `foreignChannels`, three arms after Story 11.5, with
  `response-headers` foreign for `mcp`.
- `tests/score/qualification.test.ts:246-260` -- `it.each(['web', 'mcp'])`.
- `tests/schemas/mcp-interface.test.ts:540-620` -- two cases building an api-shaped signature that
  declares `mcp`. The narrowing makes both stop parsing, so both are rewritten.
- `tests/schemas/published/published-rejection.test.ts:215-217` and `:222` -- two stale enumeration
  comments.

**Documentation this story owns**

- `docs/how-to/evaluate-tool-use-behavior.md` -- the guide moved under Stories 11.2, 11.4 and 11.5,
  so the drafted `:72` and `:236` are now `:104` and `:294`. Six passages this story falsifies:
  the gate table at `:88-97`, the probe-side paragraph at `:98-100`, the eight-key claims at `:104`
  and `:294`, the "Blocked"/"Missing" pair at `:290-292`, and the first-adopter list at `:296`.
- `CHANGELOG.md` `[Unreleased]` -- this story's two bumps and the opened gate, plus the two
  forward-looking sentences in Stories 11.4's and 11.5's own entries that this story falsifies.
- `_bmad-output/project-knowledge/learning-path-step-by-step.md` -- Step 50 and its table row.

**Read here as context, changed by no story of this half**

- `src/core/compile/reachability.ts:437-446` -- Story 11.5's refusal of `response-headers`.
- `src/core/compile/interface-inventory.ts:142-169` -- `anyOperationSignature` and
  `signatureFamilyOf`, both three-way after Story 11.4.

## Tasks & Acceptance

**Execution:**

- [x] `src/core/schemas/sealed-run-record.ts` -- `arguments` added as the ninth nullable key, with the
      4 to 5 BREAKING bump recorded in its own `.describe()` and restated in the artifact `.meta`.
      Both stale counts corrected by deletion rather than by a new numeral, per the Design Notes.
- [x] `src/core/schemas/defect-signature.ts` -- the same ninth key on `ProbeInputBinding`, its width
      sentence corrected, and the probe's 4 to 5 BREAKING bump recorded on that shape's own
      `.describe()` naming both causes.
- [x] `src/core/schemas/defect-signature.ts` -- `McpDefectSignature` added on
      `CommandDefectSignature`'s model, answering the byte-identity argument in Decision 3's terms.
- [x] `src/core/schemas/defect-signature.ts` -- `ApiDefectSignature.interfaceKind` narrowed to
      `['api', 'web']`, the union and the inferred types extended, and the three comments the change
      falsifies rewritten, `signatureCommon`'s docblock included.
- [x] `src/core/score/qualification.ts` -- the gate opened for `mcp` by reading
      `isSupportedInterfaceKind`, with the detail rendered from `SUPPORTED_KINDS_CLAUSE`. No
      `QUALIFICATION_FAILURES` member moved.
- [x] `src/core/score/qualification.ts` -- `declaredIdentityOf`'s `mcp` arm returns `mcpSignature`,
      per Story 11.5's Decision 11. `resolveHomeOperation`'s `null` short circuit is gone with it.
- [x] `src/core/preflight/witness-evidence.ts` -- `callInputsOf`'s mcp arm writes `arguments` and the
      `empty` literal takes the ninth key.
- [x] `src/core/declared-inputs.ts` and its four call sites -- the width bridge deleted, per
      Decision 6.
- [x] `tests/schemas/fixtures/artifact-fixtures.ts` -- `toolCallProbe`, its `UNION_BRANCH_FIXTURES`
      entry with `discriminator: 'interfaceKind'`, the four version literals moved, `arguments: null`
      on `emptyCallInputs`, and a fifth observation on `sealedRunRecordFixture` carrying a tool
      call's arguments.
- [x] `npm run generate:schemas` -- `sealed-run-record.schema.json` and `probe.schema.json` are the
      only two documents that moved. Every census constant read off its own failure; Decision 7
      states the numbers.
- [x] `tests/schemas/fixtures/artifact-reject-cases.ts` -- four single-mutation reject fixtures, one
      per new published constraint.
- [x] `tests/score/qualification.test.ts` -- the `it.each` pair narrowed to `web` with its detail
      asserted, plus four `mcp` cases: a qualifying tool-call probe, two confined channels, and a
      command-shaped selector.
- [x] `tests/schemas/published/published-rejection.test.ts` -- both stale enumeration comments
      rewritten to the numbers this run reports.
- [x] `tests/score/`, `tests/evaluate/`, `tests/preflight/` -- one case per branch: the `arguments`
      pointer resolving through `channelRoot`, `selectorAdmits` and `satisfiesBindings` filtering on
      the channel, `callInputsOf`'s mcp arm, `foreignChannels` for an mcp signature, and the
      qualification cases the I/O Matrix names.
- [x] `docs/how-to/evaluate-tool-use-behavior.md` -- six passages corrected and every inline citation
      re-read against the tree.
- [x] `CHANGELOG.md` `[Unreleased]` -- one disclosure block naming both BREAKING bumps, the narrowed
      enum, the ninth channel, and the opened gate, plus the two forward-looking sentences in the
      earlier entries this story falsifies.
- [x] Comment pass -- every JSDoc and comment written here pruned while written, then grepped for the
      negation-then-correction forms over the `src/` diff. Nine added lines carry one: three are
      pre-existing text this pass only re-wrapped or re-worded, and six are decision records naming
      the option turned down and why. One tenth was written and then trimmed, since its rejected half
      restated a failure mode the sentence before it already named.
- [x] `_bmad-output/project-knowledge/learning-path-step-by-step.md` -- Step 50 `(epic11-story6)` and
      its table row, plus one stale numeral in Step 48's rule list.

**Acceptance Criteria:**

Every criterion below is met and its command is in the Verification section.

- An `McpDefectSignature` over a declared tool qualifies (`tests/score/qualification.test.ts`), and
  the same probe declaring `web` raises `signature-interface-kind-unsupported` with a detail naming
  `web` and the three admitted kinds. Both keep a fixture.
- A signature carrying `interfaceKind: 'mcp'` beside a `method` and a `pathTemplate` fails to parse,
  proved by `probe-api-signature-declaring-the-tool-kind` and by
  `tests/schemas/mcp-interface.test.ts`.
- A pointer at `/interactions/{stepId}/call-inputs/arguments/{key}` resolves the recorded value, and
  `selectorAdmits` and `satisfiesBindings` both filter on the channel.
- `callInputsOf` returns a nine-key record with `arguments` filled and the other eight `null`, and
  `npm run typecheck` exits 0.
- Every sealed run record and probe fixture at the old stamp fails to parse until its stamp moves,
  which is what makes both bumps breaking and visible: the compiler named all 35 literals and the
  reject fixtures name the two required keys.
- AD-13's four checks pass and every published keyword the `mcp` signature branch adds is killed by
  the seed this diff adds. The sweep reports no survivor and no unreachable occurrence.
- Every moved census constant was read off a failure. `unionBranches` moved 10 to 11 and
  `distinctInstances` 24 to 25, and the two enumeration comments name the same numbers.
- Every existing `api` and `cli` outcome is unchanged apart from the version stamps and the ninth
  key: `check:worked-example` matches byte for byte after regeneration, `check:corpus` is untouched,
  and all 3956 tests pass.
- `CHANGELOG.md`'s `[Unreleased]` names both BREAKING bumps with their moves, says which of the two
  probe bumps this one is, and names the narrowed enum and the ninth channel.
- `npm run check:boundary` exits 0 with 0 violations, and `npm run validate` exits 0.

## Decisions settled by construction

Decisions 1 through 4 are recorded in the drafted story above and each held. Decisions 5 through 11
are this pass's own.

**Decision 5: three of the drafted Problem statement's claims were stale before the pass began, and
the frozen block keeps them.**
The frozen Problem statement says `witness.ts`, `bindings.ts`, and `evidence-resolution.ts` "each
index a nine-member channel name into an eight-key object", and that `callInputsOf` "tests
`'body' in inputs` over a union that now has three members and reads `inputs.argument` on the false
arm". Neither is true in the tree at 8e814c6. Story 11.4 closed all four sites in its own diff: it
landed `channelEntryOf` and `channelEntryOrAbsent` for the three indexing sites and gave
`callInputsOf` a third arm returning the eight-key `empty` literal. `npm run typecheck` exits 0 on
main, so the acceptance criterion reading "with the three indexing sites Story 11.4 left failing now
compiling" describes a state that never existed.

The frozen block is human-owned and is left byte for byte as approved. What the staleness changes is
the framing rather than the work: the ninth key still has to land on both shapes, and this decision
is what stops a reviewer reading the Problem statement as a description of the tree. The same
correction is why Decision 6 exists at all, since the bridge Story 11.4 built is the thing the ninth
key retires. Downstream consequence: Story 11.13's own Problem statement is written against a tree
where every call-inputs site indexes directly, and it inherits no bridge.

**Decision 6: the width bridge comes down with the gap it bridged.**
`channelEntryOf` and `channelEntryOrAbsent` (`declared-inputs.ts:208-253`) exist for one stated
reason, written in their own docblock: `ObservedCallInputs` and `ProbeInputBinding` "both stop at the
eight channels the first two kinds accept, while the pointer grammar and the loops that walk it now
run over nine", and the bridge "is what keeps a loop over the vocabulary total until" the ninth key
lands. This story lands it, so both shapes declare one key per member of `INPUT_CHANNELS` and every
loop over that vocabulary indexes either shape directly with no helper.

Keeping them would leave two exported functions whose docblocks describe a state the tree no longer
has, which is the defect class the epic register names as "prose the code contradicts". It would also
cost the exhaustiveness this repository keeps buying elsewhere: `channelEntryOrAbsent` answers ABSENT
for a key a record does not declare, so a tenth channel joining `INPUT_CHANNELS` without joining the
record would resolve absent at score time and every oracle over it would report the same answer on
every run, which is the silent-pass failure `reachability.ts:362-368` describes. A direct index fails
the typecheck at all four sites instead. So both helpers and their private `hasChannel` are deleted,
and `qualification.ts:446`, `witness.ts:141` and `:143`, `bindings.ts:299`, and
`evidence-resolution.ts:140` index their record.

One test moved with them. `tests/evaluate/evidence-resolution.test.ts`'s fixture 17b was "a channel
the record has no key for resolves ABSENT rather than null", and its own comment said the ninth
channel "is the only one that tells `channelEntryOf` and `channelEntryOrAbsent` apart". Once the
record declares the key there is no such channel and the case is unconstructible from a typed
observation, so it is rewritten as the ninth channel's own resolution case: `arguments` filled
resolves the recorded object and a tail into it resolves one argument. The artifact channel's own
ABSENT guard in the same file is untouched and keeps its cases. Downstream consequence: Story 11.13
writes observation arms against a record with no width gap, and a fifth kind's channel is a compiler
error at four named sites.

**Decision 7: the census moved seven keyword counts, two document counts, and the reject total, and
every number came off a failure.**
`ACCEPT_FIXTURE_COUNTS.unionBranches` 10 to 11 and `.distinctInstances` 24 to 25, exactly as
Decision 4 predicted from Story 11.4's state. `CENSUS_BY_DOCUMENT` moved `probe` 616 to 632 and
`sealed-run-record` 381 to 387, `CENSUS_TOTAL` 3233 to 3255, and `CENSUS_BY_KEYWORD` moved
`additionalProperties` 334 to 339, `anyOf` 161 to 162, `const` 109 to 110, `pattern` 193 to 194,
`propertyNames` 68 to 69, `required` 266 to 270, and `type` 1407 to 1416. `REJECT_CASE_COUNTS`
moved `artifact` 106 to 110 and `total` 161 to 165 with this story's four reject fixtures.

`DEFS_BY_DOCUMENT` did not move, and that is the answer to the conditional Decision 4 left open.
`McpDefectSignature` takes no `.meta({ id })`, on the same reasoning `CommandDefectSignature` and
`ApiDefectSignature` already follow and that `sensitivity-witness.ts:44-50` states in full: two
`$ref`'d definitions under one `anyOf` report `#/required` at the same instance path, and AD-13's
sweep cannot attribute a keyword deletion to one of them. The branch is spelled in place, so its
keywords are attributable and its seed flips them. `publish.test.ts`'s `DEFS_BY_DOCUMENT` assertion
passing unchanged is the proof.

`SWEEP_TIMEOUT_MS` (`keyword-mutation.test.ts:43`) stays at 600 s. It scales with the largest
published document, which is `eval-contract` at 1304 occurrences, and this story moves no
eval-contract byte. Downstream consequence: Story 11.8's regeneration starts from these numbers, and
the timeout is a decision only a story that grows the eval contract has to make.

**Decision 8: one accept fixture carries the branch and one observation carries the channel, and they
are two different fixtures.**
`toolCallProbe` is the `UNION_BRANCH_FIXTURES` seed for `DefectSignature`'s `mcp` branch, and its
selector binds `arguments`, so the branch and the ninth selector channel are protected by one seed.
Its `discriminator` reads `interfaceKind` rather than `expectedClean`, which is Story 11.4's
Decision 10: `tests/schemas/artifacts.test.ts:103-115` counts probe entries naming `expectedClean`
against that union's two branches, so a third such entry turns `validate` red.

The recorded side needed a second fixture, because a signature seed carries no observation.
`sealedRunRecordFixture` takes a fifth observation, `obs-006`, a tool call whose `arguments` channel
is populated and whose `responseStatus` is 0. Filling `arguments` on one of the four existing
observations was the smaller edit and was turned down: each of those names an api or command
operation, so a populated tool-call channel there would be the cross-artifact inconsistency AD-32
leaves to ingest, written into the corpus's own clean accept fixture. One test moved with the
addition, `tests/ingest/ingest.test.ts:183-188`, which enumerates the record's observation
identifiers. Downstream consequence: Story 11.8's dev-corpus exemplar has a recorded tool call to
model, and Story 11.13's port-message fixture is a different shape in a different file.

**Decision 9: the fourth transcription of the supported-kind list is collapsed, and the detail is
rendered from the tuple.**
Story 11.5's Decision 1 kept the qualification gate's own two-clause condition and recorded that this
story "collapses the fourth transcription onto the same constant when it opens the qualification
gate". It does. The gate calls `isSupportedInterfaceKind` and interpolates `SUPPORTED_KINDS_CLAUSE`,
so the admitted set is written down once and a message cannot claim a set the check does not enforce.
`score/qualification.ts` already imports from `compile/interface-inventory.ts` for
`anyOperationSignature` and `signatureFamilyOf`, so `check:layers` judges no new edge.

The detail keeps the clause the drafted story required word for word, "declares a method and a path
template with no per-kind semantics behind them", which was true of `web` and `mcp` together and is
true of `web` alone now. Downstream consequence: Story 11.9's grep for surviving
`unsupported-interface-kind` claims has one source of truth on both sides of the artifact boundary,
and `web` is the only kind any of the three gates refuses.

**Decision 10: the two `mcp-interface.test.ts` cases are replaced rather than repaired, and one of
them becomes the narrowing's own fixture.**
Both cases built an api-shaped signature declaring `interfaceKind: 'mcp'` and asserted that
`resolveHomeOperation` returned `null`. Story 11.5's Decision 11 explains why they were green: the
two-way ternary returned `null` by arithmetic, since `operationSignature` renders a space and
`ToolName` forbids one. The narrowing makes both inputs unparseable, so neither case can be repaired
in place.

Four cases replace them and they split the two questions the originals conflated. One asserts that
`DefectSignature.safeParse` refuses the api-shaped signature declaring the kind, which is the
narrowing itself. Three assert resolution over a real `McpDefectSignature`: it binds no api
operation, it binds the tool it names, and it binds nothing when it names a tool no contract
declares. That last one is the case the originals could not express, because before this story no
signature could name a tool. Downstream consequence: Story 11.7's AD-31 grading reads a resolution
that binds rather than one that returns `null` by construction.

**Decision 11: Steps 48 and 49 of the learning path keep their forward references, and one numeral
in Step 48 is corrected.**
Step 48's "Watch out" says `ObservedCallInputs` still has eight keys and names the sealed run
record's ninth key as what closes it; Step 49's says the probe side "opens in the step after this
one". Both are accurate descriptions of the state at their own step and both already point at Step
50, which is the file's own idiom for a change that lands across steps. Rewriting them would erase
the sequence the document exists to teach.

One sentence in Step 48 is not step-scoped and is corrected: its rule list read "The eval contract's
`schemaVersion` is 5 and the probe's is 4", which reads as a standing fact and stops being one here.
It now says the probe's "moves to 4 here", which is what the step did. Downstream consequence: a
later story bumping either artifact corrects its own step's rule the same way rather than every
earlier step's.

**Decision 12: this story edits `qualification.ts` in five places, and the frozen Never list predicts
one.**
The frozen block says "The one `qualification.ts` edit this story makes is the gate at `:754-763`".
The diff makes five: the import list, `declaredIdentityOf`'s `mcp` arm, `resolveHomeOperation`'s
`null` short circuit, `checkSelectorKeys`' index of `inputBinding`, and the gate.

Every one of the four extra edits is authorised elsewhere and none reopens a decision the frozen
block reserved. `declaredIdentityOf` is Story 11.5's Decision 11 handing this story "one arm of one
switch" by name, and `resolveHomeOperation`'s short circuit is dead code the moment that arm returns
a string. `checkSelectorKeys`' index is one of the five call sites Decision 6 unbridges. The import
list follows from the other three. The frozen sentence was written against the file as Story 11.5
left it, before Decision 6 existed. It is recorded here rather than edited, because the block is
human-owned; a reviewer reading it should read this decision beside it.

**Decision 13: `EvidenceTarget.transportChannel` is renamed to `inputChannel`, and so is every
sibling field of the same name.**
The field is typed `InputChannelName | null` and, after Decision 6, is the direct index key into a
nine-key record, so a name saying "transport" describes four of the nine values it can hold. The same
name held the same wrong concept in four other places: `CapturedBinding` (`compile/bindings.ts`),
`bindings.ts`'s resolved-capture shape, `derived-reference.ts`'s `TransportEntry`, and
`coverage/operations.ts`'s `transportChannels` list. Renaming only the one this story indexes would
have made the tree less consistent, so all five moved together, along with the regex named group,
`TRANSPORT_ROOTED_CHANNEL` (now `INPUT_ROOTED_CHANNEL`), and the two throw messages that spelled it
out.

`TRANSPORT_CHANNELS` keeps its name: that tuple really is AD-19's four transport channels, and
`pointer.ts`'s prose about them is correct as written. The rename is behaviour-free, which
`check:worked-example` proves: the caller-facing strings `derived-reference.ts` renders read the
channel's *value*, so no rendered byte moved. Downstream consequence: Story 11.13's observation arms
and Story 11.7's conformance arm read one name for one concept.

**Decision 14: the tool-call accept fixture's seeded predicate was unprovable, and the fix is a
scalar.**
`toolCallProbe`'s condition first asserted `absence` over `/response-body/matches`, then equality
against an empty array. Both resolve `insufficient-evidence`: the first because the tool's response
descriptor declares `matches` a required key, so a body without it is malformed rather than
defective; the second because AD-4 resolves a check over an empty collection under
`empty-collection`, which is exactly the degenerate case that rule exists to catch. Either way
`matchProbeWitness` returned `vacuous` and the corpus presented no defect to detect.

The predicate now reads `totalCount`, the scalar the tool publishes beside the list, so the seeded
defect is "reports no error and counts zero matches" and it resolves `true` against an observation
that manifests it. `tests/score/witness.test.ts` asserts `manifested-unclaimed` on the positive arm
and `not-triggered` on the negative one, which is the first end-to-end proof in the tree that a
seeded tool-use defect is catchable. The rule generalises past this fixture and is now written into
the tool-use guide in two halves. Assert over a scalar the tool publishes beside a collection rather
than over the collection's emptiness, and declare that scalar in the descriptor's `requiredKeys`: a
server free to omit the field the signature turns on reports the seeded defect as `not-triggered`,
which is a worse answer than `vacuous`, since `vacuous` at least announces that the corpus presented
nothing. Making `totalCount` required is what forced `O-001` in the mcp contract fixture to cover it,
because AD-20 counts rule 2's coverage over required keys alone. The contract now declares, the
oracle now reads, and the signature now asserts on the same field.

**Decision 15: the peer review found no defect in a shipped code path, and every finding it did
raise was fixed in this pass.**
Twenty-two findings across four review layers. Two were merge-blocking, both published stale
descriptions that ship inside `probe.schema.json`: the `Probe` artifact `.meta()` still said a
seeded MCP defect "is still refused at qualification" and that every version-3 probe parses, and
`ManifestationWitness.inputs`' 3 to 4 `.describe()` still said the matching signature "is not
declarable in this version". Both are corrected and the `Probe` meta gained its version-5 paragraph.

The rest were counts, prose, and test precision, and are listed against their fixes in the
Verification section. Three are worth naming because they changed the shipped artefact rather than
its description: Decision 13's rename, Decision 14's predicate, and one test that passed vacuously
(`Object.values(rest).every(...)` over a possibly-empty rest, which now names the eight channels).
Two findings the review raised and then rejected itself are not chased: `probeId: 'P-005'` colliding
with `historicalProbe` follows the file's existing pattern, and the guide's `defect-signature.ts:172`
citation follows the page's own convention of citing declaration lines. Nothing was deferred.

## Design Notes

The organising idea in the drafted story holds: a vocabulary that outran its consumers. What the pass
found is that it had outrun them by less than the draft assumed. Story 11.4 had already bridged the
three indexing sites and given `callInputsOf` its arm, so this story's job was to land the key and
retire the bridge rather than to repair four broken call sites. Decision 5 and Decision 6 are the two
halves of that correction.

**A sentence that counts a shape's own keys goes stale silently.** The drafted Design Notes predicted
four such sentences and prescribed a grep. The grep found six. Two were the predicted source comments
(`ObservedCallInputs` called a four-key object, `Observation` called ten fields) and two the predicted
guide sentences. The two the prediction missed were `ProbeInputBinding`'s "eight-key strict form" and
`TransportChannel`'s published `.describe()`, which called the transport four "the four keys an
observation's recorded call inputs are keyed by". A seventh, in `defect-signature.ts`'s
`ProbeBindingChannel` comment, recorded a past verification "at four addresses" and over "three of the
four channels"; it was generalised rather than renumbered, since the number was incidental to the
point.

Four of the six were repaired by deletion. A sentence saying what the fields are for needs no census
of them, and the census is the half that rots.

## Verification

Every command below was run and the result is recorded.

- `npm run typecheck` -- exit 0. The compiler named all 35 object literals missing the ninth key,
  across `scripts/`, `tests/fixtures/`, and eleven test files, which is the sweep Decision 6 keeps.
- `npx vitest run tests/schemas` -- green. Four version literals moved plus five outside that file
  (`tests/preflight/fixtures/observations.ts`, `tests/score/strength.test.ts`,
  `tests/score/fixtures/probe-witness.ts`, `tests/application/fixtures/score-fixtures.ts`, and two in
  `scripts/worked-example-target.ts`).
- `npx vitest run tests/schemas/published/keyword-mutation.test.ts` -- green in 115 s, no survivor and
  no unreachable occurrence on either moved document.
- `npx vitest run tests/score/qualification.test.ts` -- green, 57 cases.
- `npm run generate:schemas && npm run check:schemas` -- exit 0, with
  `sealed-run-record.schema.json` and `probe.schema.json` as the only two documents that moved.
- `npm run check:boundary` -- exit 0, 0 violations. It caught one violation first: the word "epic" in
  `ProbeInputBinding`'s published `.describe()`, which reached three occurrences in
  `probe.schema.json`. The sentence was rewritten without it.
- `npm run generate:worked-example && npm run check:worked-example` -- exit 0. The record and the
  probe each took the ninth key and their stamps moved to 5; nothing else in the chain changed.
- `npm run check:ad33-table`, `check:ad21-table`, `check:ad31-table` -- exit 0 with no regeneration.
- `npm run check:doc-invocations` and `npm run check:docs` -- exit 0, 32 invocations across 17 files.
- `npm run validate` -- exit 0 before the peer review and again after every finding was addressed.

**Peer review round, all twenty-two findings addressed.**

| Finding | Fix |
|---|---|
| `probe.ts:109` artifact `.meta()` stale in three ways, no version-5 paragraph | Version-5 paragraph added, the two version-4 sentences corrected, "a method and a path template" generalised to "its transport identity" |
| `sensitivity-witness.ts:193` probe 3 to 4 `.describe()` says the signature is undeclarable | Rewritten to name version 5 as where it landed, and to say which versions stop parsing |
| `interface-inventory.ts:32` and `:45` name two readers of the tuple | Both name the third, `score/qualification.ts` |
| An mcp signature and a cli operation of the same name render byte-identical identities | Case added over `search-notes`, the name both charsets admit; only the family filter separates them |
| "four call sites" in Step 50 and in the task list | Five sites across four files, counted |
| `docs/index.md:78` tool-use State cell contradicts the guide | Row now reads "Compiles, plans a pre-flight, and scores a probe" |
| `worked-example-artifacts.ts:19` header says 66 and 20 | 96 and 20 |
| CHANGELOG's probe 3 to 4 entry says every version-3 probe parses, inside a block that moves it to 5 | Entry now says the widening alone broke nothing and points at the version-5 entry for the migration |
| `artifacts.test.ts` pins key order against `INPUT_CHANNELS` but not the tuple's composition | Case added asserting `INPUT_CHANNELS` equals the three sub-tuples concatenated |
| Guide lead-in "one shape has half a problem" contradicts the two sentences under it | "Both shapes downstream carry the kind" |
| Guide cites `qualification.ts:819`, the `code:` line | `:818`, the admitting `if` |
| Witness test asserts identifiers and never the result value | Asserts `manifested-unclaimed` and `not-triggered`, which surfaced Decision 14 |
| Case 83b passes vacuously over an empty rest | Names the other eight channels |
| CHANGELOG probe 4 to 5 entry has no migration recipe | Both edits spelled out |
| CHANGELOG "the entry below carries it" twice, positional | Both name the entry |
| `EvidenceTarget.transportChannel` holds an input channel | Decision 13 |
| The probe gate and the contract gates now share one predicate | Comment records the coupling as deliberate and what a future divergence needs |
| Two reject cases assert an identical union-node failure | Comment records what tells them apart and that both still catch a revert |
| `condition-selector-key-undeclared` untested for an undeclared argument name; two of four foreign channels unexercised | Both added; the `it.each` now runs all four |
| The guide claims "Scores a probe" and shows no `McpDefectSignature` | JSON example added, with the scalar-over-collection rule Decision 14 established |
| `condition-text-channel-on-api` fires for a channel that is neither text nor api | Known imprecision recorded in the source, on Story 11.5's Decision 4 terms |
| Story predicts one `qualification.ts` edit and miscounts the antithesis survivors | Decision 12, and the task line corrected to nine lines |

**Re-verify round, all six follow-up findings addressed.**

The peer's narrowed re-verify confirmed both merge-blockers closed against the regenerated
`schemas/probe.schema.json` rather than against the source, and confirmed Decision 13's rename touched
nothing that genuinely means the transport four and moved no caller-facing rendered string. Six
follow-ups came back and all six are fixed.

| Finding | Fix |
|---|---|
| `totalCount` is only a permitted key, so a conforming server may omit the field the whole signature turns on and the probe reports `not-triggered` with nothing saying the evidence was missing | `totalCount` moved into `requiredKeys` in the fixture contract and in the guide's example, with the reason in the fixture. That made discipline rule 2 unsatisfied, since AD-20 counts coverage over required keys alone, so `O-001` gained the pointer in its `evidenceTargets` and an `existence` operand in its check |
| The guide's scalar-over-collection rule carries no requiredness clause | Clause added: declare that scalar in the descriptor's `requiredKeys` |
| Guide `:246` says two pointers are addressable while the example declares three, and the signature block twenty lines below uses the third | Says three and names `totalCount` |
| `derived-reference.ts`'s `TransportEntry` keeps the old name while its own field is `inputChannel` | Renamed to `InputEntry`, eight occurrences |
| Two `plan-index.test.ts` names and one `pointer.test.ts` label still say transport channel | All three say input channel |
| Two `pointer.test.ts` reject labels say "not one of the four channels" against a nine-member vocabulary | Both say nine |

- `npm run validate` after both rounds -- exit 0. 119 test files, 3961 tests, `src/core/**` at 96.94%
  statements and 92.21% branches.
