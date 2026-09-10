---
title: 'A shipped workflow contract with a captured binding and a fixture reset'
type: 'feature'
created: '2026-09-09'
status: 'done'
review_loop_iteration: 0
context:
  - _bmad-output/implementation-artifacts/epic-11-context.md
  - _bmad-output/implementation-artifacts/11-8-the-published-surface-the-corpus-and-the-census.md
  - _bmad-output/implementation-artifacts/11-10-a-seeded-defect-scored-against-a-skill-contract.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `docs/index.md:78` grades the workflow shape "Declarable and compiling. Step binding is unit-tested, with no shipped end-to-end run", and the guide states the gap precisely in two places. `docs/how-to/evaluate-workflow-behavior.md:222` says no contract in `corpus/dev/contracts/` and no committed chain uses a `{ captured }` binding, and `:226` says no contract there declares a `fixtureReset`. Both are true at 1.4.2: `grep -rn "captured" corpus/` returns nothing, and all 21 contracts carry `"fixtureReset":null`. So the two mechanisms the workflow shape exists for are backed by `tests/compile/bindings.test.ts`, `tests/score/bindings.test.ts`, `tests/score/binding-order.test.ts` and `tests/preflight/plan.test.ts` cases 95 through 98 and 120, and by nothing a reader can open. The guide's own worked example at `:42-69` is compiled for the page and shipped nowhere, which `:223` admits.

**Approach:** Author one `api` workflow contract into `DEV_CORPUS_CONTRACTS` declaring both mechanisms, and carry it end to end on its own generated chain, added as a third target file to the shape Story 11.10 establishes: one target file per chain, `scripts/worked-example-shared.ts` for what more than one chain needs, `buildWorkedExample` as the union of the builders' maps, and a root of its own under `_bmad-output/worked-examples/`. The chain calls `compile`, `seal`, `preflightFromObservations`, `ingest`, `score` and `emit` for real, so the four control legs and the resolved capture are return values of the shipped stages. Then correct the two passages and the routing-table cell they describe, and move the corpus numerals `check:doc-counts` names.

## Boundaries & Constraints

**Always:**

- The contract is authored where the corpus is built and reaches disk through `npm run generate:dev-corpus`. `corpus/dev/README.md` is a template literal in `scripts/dev-corpus-target.ts:106-145`, so every prose correction lands in the template.
- The contract joins `DEV_CORPUS_CONTRACTS` (`tests/coverage/fixtures/corpus.ts:555-559`) and stays out of `CORPUS_CONTRACTS`. It is a mechanism exemplar, and `CORPUS_CELLS` is one contract per discipline rule per declaration state.
- The contract compiles clean under the shipped `compile` in strict mode, so it publishes under the same rule the compiling members already do and `tests/architecture/dev-corpus.test.ts:333` stays pinned at 3 structural failures.
- The capture exercises the passing path of all three checks in `src/core/compile/bindings.ts`: the channel is the one `descriptorChannelOf` names, the captured type equals the bound parameter's declared type, and the capture and `after` edges together are acyclic.
- The chain's pre-flight verdict is computed by `preflightFromObservations` (`src/application/preflight.ts:158-197`) over authored observations. The spike chain authors its verdict at `scripts/worked-example-target.ts:1147-1155` and parses it at `:1211`; this one derives it, which is what puts the four legs in a committed artifact. Story 11.10's chain derives its own for the same reason.
- `check:boundary` scans `corpus/` as strictly as `src/`, so no identifier, description or `.describe()` byte the contract carries may name an epic, story, acceptance criterion, task or decision number.
- AD-18 binds a published example as strictly as a real run. The contract names no real executable, no real host, and no real subject.
- `assertLineageRoot` (`scripts/dev-corpus-target.ts:96-104`) requires `parentDigest: null` and `revisionCount: 0`, and the contract carries the `EVAL_CONTRACT_SCHEMA_VERSION` the tree reads when the story runs.
- Generated files are never hand-edited. A wrong byte in `corpus/dev/README.md` or in the chain is repaired at its builder and regenerated.
- The construction is Story 11.10's and this story extends it. One target file per chain, the shared helpers in `scripts/worked-example-shared.ts`, `buildWorkedExample` as the union of the builders' maps, the generator creating each key's own parent, and new chains under `_bmad-output/worked-examples/<name>/`. What that story leaves in `scripts/worked-example-target.ts` stays there.
- `CHANGELOG.md` is hand-maintained and its header (`:1-9`) puts entries under `[Unreleased]` for `release:prepare` (`package.json:111`) to stamp. NFR8 (`_bmad-output/planning-artifacts/epics.md:54`, "pre-1.0 SemVer with every caller-facing break called out") covers what the package publishes, and this story adds a corpus contract and a third committed chain to it, so this story writes its own entry.

**Ask First:**

- Any `src/` behaviour change. Every mechanism this story ships already works; a mechanism found missing here is a finding against Story 7.3 or Story 9.3.
- Any `schemaVersion` move. This story authors instances of shapes other stories own.
- Any edit to `corpus/dev/contracts/satisfied-declarations.json` or to `EXAMPLE_SEED_ID`. That contract is a cell contract, the AD-31 table reads it, `scripts/check-doc-invocations.mjs` replays every documented command against the pair built from it, and `docs/tutorials/getting-started.md` publishes the digest of the brief sealed from it.

**Never:**

- No second compile-and-seal example in the corpus. Story 9.5's Decision 3 holds and its reason is unchanged.
- No hand-typed downstream value in the new chain. Every selection, resolution, leg, check result, outcome, rate and vector is a return value of a shipped function.
- No claim that the strength vector is comparable. `score` reads one sealed run record per call, so one record is one completed trial.
- No new `DevCorpusKind`. The corpus gains a contract; the chain lives outside `corpus/`.
- No spine revision and no new ADR.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| `generate:dev-corpus` then `check:corpus` | `DEV_CORPUS_CONTRACTS` with the workflow exemplar added | One more `contract` entry in `index.json` with a digest over the exact bytes; zero orphans, zero drift | Any orphan or first-differing-offset report blocks |
| `compile` over the exemplar, strict | The authored contract | Returns it with no `structuralFailure`, so it publishes as a compiling member | A structural failure is a defect in the authored contract |
| The captured binding | `read-back` binds `path.id` to `/interactions/create/response-body/id` | `checkCapturedChannel`, `checkCapturedReachability` and `checkBindingCycle` all pass | Any throw here means the exemplar was authored wrong |
| The captured field is declared volatile | `create` declares `/id` volatile and the capture addresses `id` | The capture resolves: `resolveCapturedValue` reads the raw `Observation` at `score/bindings.ts:119` | N/A |
| The four control legs | The contract declares `fixtureReset`, and the reset interface carries a marker-true operation | `planPreflight` emits `control-observe`, `control-mutate`, `control-reset`, `control-observe` in that order | A missing observation on any control leg fails `clean-control` |
| `state-reset` | The first and fourth `control-observe` observations | Satisfied: `sameFixtureState` compares the projected evidence, so the volatile identifier is already pruned | Unequal projections fail the check and the verdict |
| The pre-flight verdict | `preflightFromObservations` over the authored observations | `passed: true`, with the four control legs and their check results recorded in committed bytes | A failed verdict blocks scoring, so the chain would not build |
| `score` over one sealed run record | The chain's record and the verdict | `strength.comparable` is `false` and the note names one trial against the policy's `minimumTrialCount` of 3 | N/A |
| `check:doc-counts` after the corpus grows | The pages Story 11.8 gated | Non-zero, naming each file, line, the word carried and the word owed | Each word is moved to what the check computes |
| `check:ad31-table`, `check:ad21-table`, `check:ad33-table` | The widened dev corpus | None needed regeneration; the exemplar is outside `CORPUS_CELLS` | Regeneration would mean the exemplar leaked into the cell matrix |
| `check:worked-example` | Every chain rebuilt in memory | All three match byte for byte, and the spike chain's bytes and Story 11.10's are untouched by this story | Any drift outside this story's own chain is investigated before it is accepted |
| The three statements counting committed chains | The tree after Story 11.10 landed | Each states what this story's tree holds, read at the time the edit is made | `tests/architecture/dev-corpus.test.ts:282`'s regex fails if the corpus README's anchoring phrases move |

</frozen-after-approval>

## Code Map

**The contract and the corpus**

- `tests/coverage/fixtures/corpus.ts:555-559` -- `DEV_CORPUS_CONTRACTS`, 21 today, `CORPUS_CONTRACTS` plus `commandContract` and `artifactCommandContract`. Its docblock at `:536-554` states the rule the exemplar inherits: a published corpus that could not show a shape "would leave an adopter with no worked example of the shape this version opened".
- `tests/coverage/fixtures/corpus.ts:514-534` -- `CORPUS_CONTRACTS`, 19 cell contracts in cell order, unchanged by this story.
- `tests/schemas/fixtures/command-contract.ts:1-7` -- the precedent for a corpus member authored in its own file with a header saying what it is evidence for, and the precedent for the directory: a corpus member authored as a fixture lives under `tests/schemas/fixtures/`. Story 11.10's skill exemplar follows it and so does this one.
- `corpus/dev/contracts/satisfied-declarations.json` -- the shape the exemplar is derived from: `create-thing` `POST /things` with `stateChangeMarker` true, response types `{ id: string, ok: boolean, error: string }`, `successIndicator` `/ok` and `volatilePointers: ['/id']`; `list-things` `GET /things` with `query.limit` typed `number`. Read, and left alone.
- `tests/coverage/corpus.test.ts:311-335` -- case 170 compares five inherited top-level fields across `CORPUS_CONTRACTS` only, so an exemplar outside the cells falls outside its scope. Read and confirmed.
- `tests/schemas/eval-contract-version.test.ts:97-111` -- reads the emitted dev-corpus bytes and asserts every one carries the current version, so the exemplar's `schemaVersion` is pinned by the bytes on disk. `:113` asserts the same over `buildWorkedExampleChain`, which is the spike chain's builder and stays that way.

**Where the capture and the reset are decided**

- `src/core/compile/bindings.ts:40-52` -- an orphaned docblock. It documents `CAPTURABLE_CHANNEL`, a constant Story 9.3 deleted in favour of `descriptorChannelOf`; `grep -rn "CAPTURABLE_CHANNEL" src/ tests/ docs/` returns nothing, and the docblock now floats above `CapturedBinding`, which it does not describe. Corrected by this story.
- `src/core/compile/bindings.ts:212-261` -- `checkCapturedChannel`, whose own docblock carries the same rule the orphan does, read against the declaration through `descriptorChannelOf` and `targetsDescribedChannel`.
- `src/core/compile/bindings.ts:280-317` -- `capturedType`, reading `operation.responseDescriptor.types[key]` at `:305` after refusing a tail longer or shorter than one segment and an array index.
- `src/core/compile/bindings.ts:327-357` -- `boundParameterType`, reading the bound key's declared type through `requestShapeOf(operation, capture.transportChannel)` at `:334` and abstaining on an undeclared channel or an undeclared key.
- `src/core/declared-inputs.ts:33-41` -- `descriptorChannelOf`, which returns `response-body` for every non-command operation and reads `descriptorChannel` for a command one. This is the kind-relative half Story 9.3's Decision 4 settled, and it is what Decision 1 below is decided against.
- `src/core/score/bindings.ts:101-123` -- `resolveCapturedValue`. `:119` is `walkTail(channelRoot(source, target), target.tail)` over the raw `Observation`, so a captured field the contract declares volatile still resolves.
- `src/core/preflight/plan.ts:251-285` -- `selectControl`: the observed operation is the first marker-false operation anywhere in the contract that can be given inputs, and the mutating one is the first marker-true operation on the interface `fixtureReset` names.
- `src/core/preflight/plan.ts:233-241` -- `controlInputs`, which takes the operation's first sensitivity-witness leg's inputs, or empty inputs when AD-10 exempts the operation. `targetOf` at `:243-249` is what turns a `null` from it into no control target at all.
- `src/core/preflight/plan.ts:375-439` -- the control block: the four legs in order, the `state-reset` check over the first and the fourth, and the `clean-control` check over all of them at `:438`.
- `src/core/preflight/reduce.ts:327-346,347-367` -- `state-reset` comparing projected evidence through `sameFixtureState`, and `clean-control` failing on a missing observation or an anomaly.
- `src/core/schemas/sensitivity-witness.ts:177-182` -- `FixtureReset`: `legId`, `interfaceId`, `operationId`, `inputs`.
- `src/core/schemas/sensitivity-witness.ts:93-96` -- `API_WITNESS_CHANNELS`, and `legalChannels` at `src/core/compile/sensitivity-witness.ts:314-317`, which returns `MUTATING_CHANNELS` (`['body']`, `:302`) where the marker is true and `READ_CHANNELS` (`['path', 'query']`, `:303`) where it is false. This decides which channel each declared witness may use.
- `tests/preflight/plan.test.ts:98-158,244-282` -- cases 95 through 98 and 120, the four-leg branch's only exercise today, over `resetContract` in `tests/preflight/fixtures/observations.ts`.

**The chain**

Story 11.10 lands first and defines the construction; the citations below are to the tree at 1.4.2 and are re-read at this story's own boundary, where the shared helpers have moved.

- `scripts/worked-example-target.ts:1-18` -- the header stating that nothing downstream of the evaluator's own evidence is hand-typed, and the `node`-direct type-stripping constraint every import inherits. Each target file carries its own version of both.
- `scripts/worked-example-target.ts:59-79` -- `WORKED_EXAMPLE_LABEL`, `WORKED_EXAMPLE_ROOT`, and `WORKED_EXAMPLE_FILES`, the five files the spike builder owns. `keyOf` at `:81` prefixes the label, which is what makes a third label a third directory with no other change.
- `scripts/worked-example-target.ts:135-147` -- `POLICY`, `minimumTrialCount: 3` at `:143`. Story 11.10 moves it to `scripts/worked-example-shared.ts` and this chain imports it there.
- `scripts/worked-example-target.ts:111-123` and `:1167-1169` -- `renderJson`, `digestPlaceholder` and `fail`, which move to the same shared module.
- `scripts/worked-example-target.ts:1147-1155` -- `authoredPreflightVerdict`, the hand-authored verdict the spike chain parses at `:1211` and scores under. That chain calls `compile` at `:1193`, `seal` at `:1194`, `sealProbeSet` at `:1222` and `score` at `:1289`, and never calls a pre-flight stage. This chain computes its own, per Decision 3.
- `scripts/worked-example-target.ts:1192-1327` -- `buildWorkedExampleChain`, including the `bindingOrder` acyclicity assertion at `:1249` and the `resolveCapturedBindings` call at `:1253`, which today resolves nothing because the spike plan declares no capture. It is the shape this story's builder follows, in its own file.
- `scripts/worked-example-target.ts:1334-1374` -- `buildWorkedExample`, returning `Map<repo-relative path, text>`, with the key-set check at `:1361-1372`. Story 11.10 makes it the union of the builders' maps, and this story adds a third builder to that union.
- `scripts/generate-worked-example.ts:37-42` and `scripts/check-worked-example.ts:30-45` -- both drive `buildWorkedExample()` and iterate the map. Story 11.10 replaces the single `mkdir` at `:37` with one per key's parent and makes both log lines label-independent, so a third chain needs neither script edited again.
- `scripts/check-docs.mjs:9-14` -- `ROOTS`: `README.md`, `_bmad-output/planning-artifacts`, `_bmad-output/project-knowledge`, and two `experiments/` files. `_bmad-output/worked-examples/` is outside all five.
- `src/application/preflight.ts:158-197` -- `preflightFromObservations`, synchronous, returning a parsed `PreflightVerdict`.
- `tests/score/worked-example.test.ts` -- value-level assertions on the spike builder's output, per its own header, and the posture this story's own chain test follows in its own file.

**Documentation and counts**

- `docs/index.md:78` -- the workflow row's State cell, owned by this story.
- `docs/how-to/evaluate-workflow-behavior.md:71-72` -- "That plan compiles clean, exit `0` ... It is `corpus/dev/contracts/satisfied-declarations.json` with one operation and one step added." The second sentence becomes false when the plan ships as a contract of its own.
- `docs/how-to/evaluate-workflow-behavior.md:221-223` and `:225-226` -- the two passages, owned by this story and quoted with their replacements in Decision 5.
- `docs/how-to/evaluate-workflow-behavior.md:104-126` -- the three compile-check demonstrations, whose messages name `read-back`, `list` and `create`. They stay correct only while the shipped contract keeps those step identifiers.
- `scripts/dev-corpus-target.ts:65,108,114,115` -- the numeral sites in the `EXAMPLE_SEED_ID` docblock and the README template: six spelled-out words on four lines, because `:114` carries the corpus total and "Nineteen" and `:115` carries "two" and "Eighteen". `:117`'s "Three fail compilation by design" is a seventh word that holds all epic. This story moves four of the six: the total at `:65`, `:108` and `:114`, and "Eighteen" at `:115`. "two" at `:115` is the command-contract count and belongs to Story 11.10; "Nineteen" is `CORPUS_CONTRACTS`' size and moves in no story.
- `scripts/dev-corpus-target.ts:137-144` -- the README template's "Three of the four artifacts in an end-to-end example are absent here" paragraph, whose `:141` reads "Only the run record among them is committed, as `spike-worked-example/sealed-run-record.json`". That is the first of three statements counting committed chains, and it reaches disk as `corpus/dev/README.md:32-39`.
- `README.md:240` -- "| the committed worked chain | `npm run generate:worked-example` | `npm run check:worked-example` |", the second statement, singular in the generated-artifact table.
- `tests/architecture/dev-corpus.test.ts:280-283` -- the third statement, a pinned regex over the corpus README's paragraph. `:282` is `/Three of the four artifacts[\s\S]*inputs the shipped[\s\S]*ingest[\s\S]*stage\s+consumes/`, and it sits inside the `absences` array at `:271-289`.
- `scripts/check-doc-counts.ts` -- Story 11.8's gate, covering fourteen numerals across seven pages: the corpus total at `README.md:180`, `what-ships.md:20`, `cli-commands.md:233`, `author-behavioral-contracts.md:94`, `evaluate-ai-feature-behavior.md:234` and `getting-started.md:12`, the compiling count, the failing-by-design count, the `api`-declaring count, and the command-contract count at `evaluate-agent-behavior.md:294`, which Story 11.8 added as the fourteenth entry so Story 11.10's move of that word from two to three is caught by the gate. This story adds no entry.
- `_bmad-output/project-knowledge/learning-path-step-by-step.md` -- 3730 lines, 44 steps, the last being Step 44 (epic10-story1) at `:3698`.
- `_bmad-output/project-knowledge/learning-path-template.md` -- the shape, and the ban on repository vocabulary in `In plain terms`.

**The disclosure**

- `CHANGELOG.md:1-9` -- the header, which says entries go under `[Unreleased]` and that `npm run release:prepare` (`package.json:111`) moves them into a dated section. `:11` is the current `[Unreleased]`.
- `CHANGELOG.md:285-290` and `:311-313` -- Epic 9's own artifact bullets, the shape an entry follows.
- `CHANGELOG.md:578` -- the standing statement that the `schemaVersion` number gates nothing in either direction in v0. This story moves no `schemaVersion` and does not restate it.

## Tasks & Acceptance

**Execution:**

- [x] `tests/schemas/fixtures/workflow-contract.ts` -- NEW, in the directory `command-contract.ts` sets as the precedent for a corpus member authored as a fixture, which is where Story 11.10 puts its skill exemplar too. Author the exemplar: one `api` interface carrying `create-thing` (marker true, response `id` typed `string`, `/id` volatile), `get-thing` (`GET /things/{id}`, marker false, `path.id` typed `string`), and `reset-things` (marker true), each with a sensitivity witness on the channel `legalChannels` allows it; a two-step plan whose `read-back` binds `path.id` to `/interactions/create/response-body/id` with `after: "create"`; a `fixtureReset` naming `reset-things`; and oracles that address the read-back body and compare it with the write's call inputs. Shipped as a seven-step plan with seven oracles over six behaviors, per Decision 10: a two-step plan leaves `malformed-input`, `whole-body` and `state-change-read-back` unsatisfied on a member the corpus README calls a rule index.
- [x] `tests/coverage/fixtures/corpus.ts` -- add the exemplar to `DEV_CORPUS_CONTRACTS` and extend the docblock at `:536-554` to say why a mechanism exemplar ships without a cell. Leave `CORPUS_CONTRACTS` at 19.
- [x] `tests/coverage/workflow-coverage.test.ts` -- NEW. Grade AD-31's fourteen predicates over the exemplar as one whole verdict table, following `tests/coverage/command-coverage.test.ts`'s construction and its reason, so no dev-corpus member outside the cell matrix ships ungraded.
- [x] `scripts/dev-corpus-target.ts` -- move the corpus total at `:65`, `:108` and `:114` and the compiling count at `:115` against what `DEV_CORPUS_CONTRACTS` holds when this story runs, and name the workflow exemplar in "What is here" beside the clauses Stories 11.8 and 11.10 left there. Leave `:114`'s "Nineteen", `:115`'s "two" and `:117`'s "Three" alone. `corpus/dev/README.md` is generated, so this template is where its bytes are edited and `npm run generate:dev-corpus` is what writes them.
- [x] `scripts/dev-corpus-target.ts:141` -- the committed-run-record clause in the same template. Read what the tree holds after Story 11.10 landed and name each committed run record by path, keeping every phrase `tests/architecture/dev-corpus.test.ts:282`'s regex anchors on, per Decision 8.
- [x] `README.md:240` -- the generated-artifact table's "the committed worked chain" row, read against the same tree.
- [x] `npm run generate:dev-corpus && npm run check:corpus` -- regenerate; expect zero orphans and zero drift.
- [x] `scripts/workflow-example-target.ts` -- NEW, the third target file in the shape Story 11.10 established. It imports `renderJson`, `digestPlaceholder`, `fail` and `POLICY` from `scripts/worked-example-shared.ts`, and owns its own label `_bmad-output/worked-examples/workflow-capture`, its own root, its own six-file list, its own key-set check, the authored probe, the authored observations for every planned leg, the `preflightFromObservations` call, and the same `ingest` → `score` → `emit` sequence the spike chain runs. `scripts/worked-example-target.ts` takes no edit, and neither does `scripts/skill-example-target.ts`.
- [x] `scripts/generate-worked-example.ts` and `scripts/check-worked-example.ts` -- add this builder's map to the union `buildWorkedExample` returns. Story 11.10 already made the generator create each key's own parent and both log lines label-independent, so nothing else in either script moves.
- [x] `npm run generate:worked-example && npm run check:worked-example` -- regenerate; expect the spike chain's five files and Story 11.10's six byte-identical, and this chain's six files written.
- [x] `tests/score/workflow-worked-example.test.ts` -- NEW, following `tests/score/worked-example.test.ts`'s posture of reading the builder's values and touching no file. Assert this chain's values: the resolved captured value equals the identifier the write returned, the pre-flight verdict's control legs read `control-observe`, `control-mutate`, `control-reset`, `control-observe`, `state-reset` is satisfied, `strength.comparable` is `false` with the note naming one trial, and the emitted key set is exactly the declared one. The control legs are asserted off `planPreflight` rather than off the verdict, per Decision 12. The key set moved to `tests/score/worked-example.test.ts`'s existing registry case, which Story 11.10 wrote for exactly this and which goes red on a builder left out of the union.
- [x] `src/core/compile/bindings.ts` -- delete the orphaned docblock at `:40-52`, first moving into `checkCapturedChannel`'s docblock the one reason it carries that the latter does not: `Observation.responseHeaders` admits objects, arrays and numbers, so a header capture compiled as a `string` could resolve to an object at score time.
- [x] `docs/index.md:78` and `docs/how-to/evaluate-workflow-behavior.md:71-72,221-226` -- the cell and the three passages, per Decision 5.
- [x] The corpus numerals -- run `npm run check:doc-counts`, move every word it names, and re-run until it exits 0. It named thirteen; six more entries were added for the sentences this story leaves behind, per Decision 15, and the gate now holds 29 numerals across 9 files.
- [x] `CHANGELOG.md` `[Unreleased]` -- one `### Added` bullet naming this story's own additions and nothing else: the workflow exemplar now published in `corpus/dev/contracts/`, the first shipped contract carrying a `{ captured }` binding and a `fixtureReset`, and the third committed chain at `_bmad-output/worked-examples/workflow-capture/` whose pre-flight verdict records the four control legs. Story 11.10's bullet discloses the second chain and this one does not restate it. The corpus-digest non-comparability statement is stated once for this epic by the first story that moves the corpus, which is Story 11.8, and this bullet does not restate that either. No `schemaVersion` moves here, so `CHANGELOG.md:578` stands untouched.
- [x] `_bmad-output/project-knowledge/learning-path-step-by-step.md` -- one step and one table row, per `learning-path-template.md`, numbered from the file's last step at the time this story runs. The file ends at Step 44 (epic10-story1) today, and under the epic's execution order of 11.1 through 11.8, then 11.10 through 11.12, then 11.9, that is Step 54.

**Acceptance Criteria:**

- Given `npm run check:corpus` after regeneration, when it runs, then it reports zero orphans and zero drift, and `index.json` carries a `contract` entry for the workflow exemplar with a digest over the exact bytes on disk.
- Given the exemplar, when `compile` runs over it in strict mode, then it returns with no `structuralFailure`, and the three checks in `src/core/compile/bindings.ts` each take their passing path over its capture.
- Given the exemplar's `fixtureReset`, when `planPreflight` runs, then the control block is four legs in the order `control-observe`, `control-mutate`, `control-reset`, `control-observe`, the `state-reset` check names the first and the fourth, and `clean-control` names all four.
- Given the new chain's authored observations, when `preflightFromObservations` runs, then the emitted `preflight-verdict.json` reads `passed: true` and records every control leg and its check result, so the four legs are in committed bytes for the first time.
- Given the new chain's sealed run record, when `score` runs, then the resolved captured value equals the identifier `create` returned, and `strength.comparable` is `false` with a note naming one completed trial against the policy's `minimumTrialCount` of 3.
- Given `npm run check:worked-example`, when it runs, then every chain matches its builder byte for byte, and the spike chain's five files and Story 11.10's six are unchanged by this story.
- Given `CHANGELOG.md`'s `[Unreleased]`, when read, then it carries one `### Added` bullet naming the workflow exemplar, both mechanisms it is the first shipped contract to declare, and the third committed chain, and `git diff CHANGELOG.md` touches nothing below `[Unreleased]`, since `release:prepare` owns the dated sections.
- Given the three statements counting committed chains, when each is read after this story, then each states the number the tree holds, `tests/architecture/dev-corpus.test.ts` is green with its regex at `:282` unedited, and no statement carries a number predicted from another story's plan.
- Given `npm run check:ad31-table`, `check:ad21-table` and `check:ad33-table`, when they run, then none needed regeneration, proving the exemplar stayed out of the cell matrix.
- Given `npm run check:doc-counts`, when it runs after the corpus grows, then it first names each stale word with its file, line and owed value, and after the edits it exits 0.
- Given `docs/index.md:78` and the three corrected passages in the workflow guide, when read against the tree, then every claim names a file that exists and a value the build computes, and no sentence says the capture half or the control branch is unshipped.
- Given `npm run validate`, when it runs, then it exits 0 with nothing on stderr across every step, `check:boundary` included over the new corpus bytes.

## Decisions settled by construction

**Decision 1: the exemplar declares an `api` interface, and the command capture stays owed.**
Three readings decide it. First, the guide's own worked example at `docs/how-to/evaluate-workflow-behavior.md:42-69` is api-shaped, and `:223` says it "was compiled for this page and is not shipped in the corpus". Shipping that shape retires `:223` by shipping the example the page already prints, and it keeps the three compile-check messages at `:109`, `:117` and `:125` naming the same steps and fields a reader can now open. A different kind would leave `:223` true and force the page's example to be rewritten in a story that owns two sentences of it. Second, `descriptorChannelOf` (`src/core/declared-inputs.ts:33-41`) returns `response-body` for every non-command operation and reads a per-operation `descriptorChannel` for a command one, so an api capture's legal channel follows from the kind while a command capture's follows from a second declaration the reader has to resolve first. The corpus already publishes both command descriptor shapes, a stream in `corpus/dev/contracts/fragment-selection.json` and an artifact in `corpus/dev/contracts/review-corpus.json`, so the kind-relative half of the rule has published examples; the capture has none, and putting it on the kind whose capturable channel is fixed keeps the example about the capture. Third, `selectControl` needs a marker-false read and a marker-true operation on the reset's interface, and one api interface supplies both from the same three operations the capture needs. What this leaves owed is recorded here: Story 9.3's Decision 4 stated as a downstream consequence that "Story 9.5's corpus carries a command contract capturing from stdout", and `grep -rn "captured" corpus/` returns nothing, so that consequence never landed and this story does not land it either. Downstream consequence: a command capture from `stdout` and a capture from the `artifact` channel are both still unexercised by any shipped contract, and the story that ships one inherits the sentence in the guide at `:105` that already describes both.

**Decision 2: the evidence gets its own chain, added as a third target file to the shape Story 11.10 established.**
Story 11.10 lands first and its Decision 5 settles the construction for the epic: one target file per chain, `scripts/worked-example-shared.ts` for `renderJson`, `digestPlaceholder`, `fail` and `POLICY`, `buildWorkedExample` as the union of the builders' maps, the generator creating each key's own parent directory, and new chains rooted at `_bmad-output/worked-examples/<name>/`. This story adds `scripts/workflow-example-target.ts` and the label `_bmad-output/worked-examples/workflow-capture` to that shape and changes nothing about it.

Two options were read against the tree and turned down, and both readings survive Story 11.10's arrival. Extending the spike chain in place is attractive because `buildWorkedExampleChain` already imports `bindingOrder`, `resolveCapturedBindings` and `selectWithBindings` and resolves zero captures with them today. It fails because the spike directory holds three hand-authored files, `FINDINGS.md`, `README.md` and `system-under-test.md`, which describe that spike's own system under test and which no builder repairs, and because `docs/how-to/evaluate-workflow-behavior.md:216-219` publishes the spike chain's plan, pointer and defect rate as the proof of the temporal half. Changing that contract moves every digest in it and falsifies four sentences this story does not own. That is also the reason new chains get their own root rather than a second label under the spike's directory, which is the reasoning Story 11.10's Decision 5 adopts. Putting the chain under `corpus/dev/` fails because `check-dev-corpus.ts` orphan-sweeps the whole tree, so the files would have to be emitted by `dev-corpus-target.ts`, `DevCorpusKind` is closed at four kinds, and `index.json`'s entry arithmetic is Story 11.8's.

What a third chain costs on Story 11.10's shape is one target file, one label constant, one root constant, one file list and one entry in the union. It adds no npm script, so `validate`'s step count does not move and `check:boundary`'s `package.json#scripts.*` surface gains nothing, and `_bmad-output/worked-examples/` is outside `check:docs`' five roots (`scripts/check-docs.mjs:9-14`). Downstream consequence: Story 11.12 pays the same price for a fourth chain, and `check:worked-example` grows with each at no cost.

**Decision 3: the chain computes its pre-flight verdict, which is what puts the four control legs in committed bytes.**
The spike chain authors its verdict at `scripts/worked-example-target.ts:1147-1155` and parses it at `:1211`, and its header lists the verdict among the evaluator-authored inputs, so nothing there ever calls `planPreflight`: that module calls `compile` at `:1193`, `seal` at `:1194`, `sealProbeSet` at `:1222` and `score` at `:1289`, and no pre-flight stage at all. A shipped `fixtureReset` whose four legs live only in a hand-typed verdict would prove no more than `tests/preflight/plan.test.ts` case 96 already proves, which is the exact gap `docs/how-to/evaluate-workflow-behavior.md:226` names. So this chain authors one `ProbeObservation` per planned leg and calls `preflightFromObservations` (`src/application/preflight.ts:158-197`), and the verdict it emits is the stage's own return value. Story 11.10's chain derives its verdict on the same argument, so neither evidence chain inherits the spike's unrun stage. That is what a shipped contract adds over the unit test: the unit test reads a plan and asserts four purposes in order, and the chain runs the plan's legs through the reducer, satisfies `state-reset` over two real projections and `clean-control` over four real observations, and hands the resulting verdict to `score`, which reads `passed` and `fixtureDigest` off it. Downstream consequence: `preflight-verdict.json` is a sixth file in this chain where the spike chain has five, and a later story wanting a derived verdict for the spike chain has the construction to copy.

**Decision 4: one sealed run record is one completed trial, so the vector is reported and marked non-comparable.**
`score` reads one sealed run record per call. The chain's policy is the shipped `POLICY` at `scripts/worked-example-target.ts:135-147`, which Story 11.10 moves to `scripts/worked-example-shared.ts` so every chain is scored under one declared policy artifact, and whose `minimumTrialCount` is 3, so `Strength.comparable` comes out `false` and the note says so, exactly as the spike chain's does at one admitted probe over one completed trial. The chain's probe seeds one defect on the persistence oracle and the contract catches it, so the defect vector reads `caught: 1`, `exercised: 1`, `rate: 1`, with `gameability` and `zero-action` `null`. The claim this supports is stated to that width: the shape runs end to end on shipped bytes and its chain is regenerated and byte-checked on every build. A comparable reading needs three completed trials, which needs three sealed run records and a caller that aggregates them, and neither is in this story. Downstream consequence: the routing-table cell and the guide's "Where this stands" section both carry the one-trial limit in their own words, so a reader who arrives at either page learns it without opening the artifact.

**Decision 5: the three passages this story owns, quoted with what each becomes.**
`docs/index.md:78` reads "Declarable and compiling. Step binding is unit-tested, with no shipped end-to-end run." It becomes:

> Proven. A shipped contract binds a step to a captured value and declares a fixture reset, on a chain regenerated and byte-checked every build, one trial, marked non-comparable.

The one-trial clause is there because Decision 4 records that limit as surviving this story, and the cell has to carry it so a reader who never opens the guide still meets it. `docs/how-to/evaluate-workflow-behavior.md:221-223` reads "The capture half has narrower evidence. No contract in `corpus/dev/contracts/` and no committed chain uses a `{ captured }` binding, so what backs it is the schema, the three compile checks demonstrated above, and the unit tests in `tests/compile/bindings.test.ts`, `tests/score/bindings.test.ts`, and `tests/score/binding-order.test.ts`. The worked example in this guide was compiled for this page and is not shipped in the corpus." It becomes a paragraph naming the shipped contract by path, naming the chain by path, saying the plan printed above is that contract's plan, keeping the three unit-test files as the narrow-case evidence, and stating the one-trial limit from Decision 4. `:225-226` reads "The four-leg control branch is in the same position. No contract in `corpus/dev/contracts/` declares a `fixtureReset`, so the `control-mutate` and `control-reset` legs are exercised by `tests/preflight/plan.test.ts` and by no shipped contract." It becomes a paragraph saying the exemplar declares a `fixtureReset`, that its committed pre-flight verdict records the four legs in order, and that `state-reset` reads the first and the fourth. `:71-72`'s second sentence, "It is `corpus/dev/contracts/satisfied-declarations.json` with one operation and one step added", is made false by the exemplar and is rewritten to name the shipped file. Story 11.9 owns no sentence on either page beyond the cross-cutting prose it already carries.

**Decision 6: this story owns the third move of the total and the only move of the `api`-declaring count, and the whole epic's composition is written out so no numeral is claimed twice.**
`DEV_CORPUS_CONTRACTS` holds 21 today, 19 cell contracts plus two command contracts, of which 18 compile and 3 fail by design. Three stories add one contract each, in the epic's execution order of 11.1 through 11.8, then 11.10 through 11.12, then 11.9:

| Site | 1.4.2 | after 11.8 | after 11.10 | after this story |
| --- | --- | --- | --- | --- |
| corpus contracts in `DEV_CORPUS_CONTRACTS` | 21 | 22 | 23 | 24 |
| `index.json` entries / of kind `contract` | 24 / 22 | 25 / 23 | 26 / 24 | 27 / 25 |
| declaring `api` / `cli` / `mcp` / no interface | 18 / 2 / 0 / 1 | 18 / 2 / 1 / 1 | 18 / 3 / 1 / 1 | 19 / 3 / 1 / 1 |
| compiling / failing by design | 18 / 3 | 19 / 3 | 20 / 3 | 21 / 3 |

Story 11.8 owns the first move of the total and the compiling count, Story 11.10 the second and the only move of the `cli` count, and this story the third and the only move of the `api` count. This story leaves "Nineteen are one per discipline rule in each declaration state" alone, because `CORPUS_CONTRACTS` stays at 19, and it leaves "Three fail compilation by design" alone, which `tests/architecture/dev-corpus.test.ts:333` pins and which holds because all three exemplars compile. Story 11.12 ships no corpus member, so this is the epic's final composition. The mechanism that keeps two stories from claiming one edit is Story 11.8's `check:doc-counts`: it computes each gated numeral from `DEV_CORPUS_CONTRACTS` at run time and names the file, the line, the word carried and the word owed, so each story moves the word to what its own tree produces rather than to a number copied from this table. Story 11.9 is the last story in the epic and reads them last as part of its sweep.

**Decision 7: a dev-corpus member outside the cell matrix is graded whole, whichever kind it declares.**
`tests/coverage/command-coverage.test.ts:1-13` records why the rule exists: `CORPUS_CELLS` is one contract per discipline rule per declaration state, the generated AD-31 table is the only artifact that runs all fourteen predicates and it reads the cells, so "a whole interface kind went ungraded while the suite stayed green" over three predicates that answered confidently and wrongly. The kind is what made that instance expensive, and the mechanism is the corpus membership: any member outside the cells is graded by nothing. This exemplar declares `api`, a kind nineteen cell contracts already grade, and it declares two things no cell contract declares, a `{ captured }` binding and a `fixtureReset`. `bindsTypeViolating` (`src/core/coverage/satisfaction.ts:371`) discriminates by `'matcher' in value`, so a captured binding answers false there, and no predicate reads `fixtureReset`; both readings are cheap to assert and expensive to assume. So the exemplar gets `tests/coverage/workflow-coverage.test.ts`, asserting the whole fourteen-predicate verdict table for the reason its sibling's header gives: naming only the rules that happen to be interesting today would let the next one through. Downstream consequence: Story 11.10's skill exemplar inherits the same obligation, and Story 11.7 discharges it for the `mcp` kind in its own file.

**Decision 8: the committed-chain count is composed the way the corpus numerals are, and its regex is a constraint this story shares with Story 11.10.**
Three published statements say this repository commits one end-to-end chain. `scripts/dev-corpus-target.ts:141` is the source of `corpus/dev/README.md:36`, "Only the run record among them is committed, as `spike-worked-example/sealed-run-record.json`". `README.md:240` names "the committed worked chain" in the singular in the generated-artifact table. `tests/architecture/dev-corpus.test.ts:282` pins a regex over the corpus README paragraph that carries the first. Story 11.10 ships a generated chain and takes the singular to two; this story ships a second and takes two to three. Neither story writes the other's number: each reads the committed state when its own edit is made and states what it finds, which is the same rule Decision 6 applies to the corpus numerals and for the same reason. `corpus/dev/README.md` is generated, so both edits land at the template and reach disk through `npm run generate:dev-corpus`.

Two traps are stated because the paragraph carries two unrelated numbers. `dev-corpus.test.ts:282` anchors on four fragments in order, "Three of the four artifacts", "inputs the shipped", "ingest", and "stage consumes", and every one of them has to survive both stories' edits, so both stories carry the regex as a constraint on their own diff and Story 11.10 leaves it green for this one. And the "Three of the four" in it counts the artifacts of an end-to-end example, which is a different quantity from how many chains commit a run record; it does not move in this epic, and editing it would falsify the sentence and break the regex at once. The clause that moves is the path list at `:141`, which the regex does not reach. Downstream consequence: Story 11.12 inherits the same composition if it ships a fourth chain, and Story 11.9's closing sweep reads all three statements last.

**Decision 9: the frozen Intent describes a tree that no longer exists, and this is the divergence record.**
The `<frozen-after-approval>` Intent opens on two sentences being true at 1.4.2: that no contract in
`corpus/dev/contracts/` uses a `{ captured }` binding, and that none declares a `fixtureReset`. Both
are false in the tree this story ran against. Story 11.8 promoted `tests/schemas/fixtures/mcp-contract.ts`
into the corpus as `corpus/dev/contracts/notes-tool-server.json`, and Story 11.4 had authored it with
a captured binding on its `read-back` step and a `fixtureReset` on `create-note`, the latter being the
accept fixture for the tool-call arm of `FixtureReset.inputs` and reachable from no other declaration.
Story 11.8 corrected the two published sentences its own change falsified, at
`docs/how-to/evaluate-workflow-behavior.md:222` and `:226`, and corrected `epic-11-context.md:50`.

The block is human-owned so it is left exactly as written. What this story actually adds, stated here
because the Intent no longer states it: the first **api-shaped** capture in a shipped contract, the
first `fixtureReset` on that kind, and the first **committed end-to-end chain** over either mechanism.
The `cli` capture from `stdout` and the capture from the `artifact` channel stay unexercised by any
shipped contract, which Decision 1 already recorded and which the guide now says in those words.

Two consequences follow. The guide's "Where this stands" section counts two shipped contracts for each
mechanism rather than one, and it says which axis each covers. And the `api`-declaring numeral is the
only per-kind count this story moves, which is what Decision 6's last column already predicted.

**Decision 10: the plan is seven steps, and the exemplar satisfies every rule its declarations make
relevant.**
The task list said "a two-step plan". Two steps carry the capture and nothing else: `malformed-input`
answers relevant for every operation declaring a request key, `whole-body` for every operation
declaring more than one required response key, and `state-change-read-back` for every marker-true
operation, so a two-step plan would publish a corpus member failing three of the seven discipline
rules while the corpus README calls the set a rule index. The plan is therefore `create`, `read-back`,
`reset`, `reset-read-back`, and one type-violating step per operation, and the contract declares seven
oracles against six behaviors.

The result is `success-indicator-separation`, `whole-body`, `malformed-input`, `sibling-cross-check`
and `state-change-read-back` all relevant and satisfied. `per-record` and `omission-and-completeness`
come out irrelevant, and Decision 13 records why that is the honest answer rather than a gap.

**Decision 11: the reset names a third operation, so the mutating leg and the reset leg are different
calls.**
`selectControl` (`src/core/preflight/plan.ts:290-319`) takes the mutating control leg from the first
marker-true operation on the interface the reset names, and the reset leg from the operation the reset
itself names. On `notes-tool-server.json` those resolve to one operation, `create-note`, so the
shipped four-leg branch has never had an example where the mutation and the restoration are separate
calls. Declaring `reset-things` as a third operation is what makes the committed plan read
`create-thing`, then `reset-things`, which is the shape the branch exists for.

The cost is that `reset-things` is an operation like any other to every predicate that walks the
inventory, so it needs its own sensitivity witness, its own type-violating step, its own
whole-response oracle and its own read-back. All four are declared. Its witness relation reads the
whole response body, and `seededName` is required rather than merely permitted for the reason the
tool-server contract states about `totalCount`: a service free to omit the field would leave both legs
answering `{ ok: true }` and the relation resolving false against a service doing its job.

**Decision 12: `PreflightVerdict` records no leg list, so the acceptance criterion is met by two check
rows rather than by four leg entries.**
An acceptance criterion states that the emitted `preflight-verdict.json` "records every control leg
and its check result". It does not, and cannot: `PreflightVerdict` carries `schemaVersion`, the
lineage pair, `runId`, `fixtureDigest`, `passed` and `checks`, and a `PlannedLeg` never reaches it.
What the committed bytes carry of the four legs is `state-reset` satisfied and `clean-control`
satisfied, which `planPreflight` emits only when control legs could be planned at all
(`plan.ts:409-472`), plus a `fixtureDigest` computed over the projection of every leg including those
four. The leg identifiers and their order are values on the plan, and
`tests/score/workflow-worked-example.test.ts` asserts them off `planPreflight` directly.

The guide says this in the same words rather than implying the file lists the legs. No schema moves
here: widening `PreflightVerdict` to carry a leg record is a shape change another story owns, and it
would be an AD-11 bump for a field this story does not need.

**Decision 13: the two collection rules are irrelevant, and a positive control is what proves the
absent declaration is why.**
`per-record` and `omission-and-completeness` both read `collectionLocations`, and this contract
declares none: every operation answers with one record or with a verdict about one call. Adding a
list operation to make the two rules relevant would add a fourth operation, its witness, its
type-violating step and two more oracles to a contract whose subject is the capture and the reset.

An assertion that a rule is irrelevant is satisfied by a predicate that answers irrelevant to
everything, so `tests/coverage/workflow-coverage.test.ts` carries a positive control: one collection
location and the reference set it names are added to the read's descriptor, nothing else moves, and
both rules come back relevant. That is what separates "this contract declares no collection" from
"these predicates stopped firing".

**Decision 14: `create` binds by literal, so all three type-violating steps are observed and every
oracle is reached.**
The first build left the three `at-most-one` type-violating steps unobserved, which made `O-003`
resolve `unreached`, gave its authored `held` disposition `corroboration: 'disagrees'`, and put
`oracle O-003 resolved unreached` in the emitted `verdictBasis`. The reason recorded for that was the
plan the guide prints: `create` bound `body.name` with `{ matcher: 'any' }`, which binds whatever was
sent, so a second `create-thing` observation carrying a type-violating name would make
`selectWithBindings` return `several` under `exactly-one` and the outcome would be an infrastructure
error rather than a verdict about the contract.

The peer review turned that reasoning over and it was wrong about the cost. Binding `create` with
`{ literal: 'a thing the run created' }` separates the two steps at one token: `create` then selects
exactly one call and `malformed-create` still selects only the type-violating one under its own
matcher. The printed plan changes by that one token and nothing else, the three compile-check
demonstrations do not read the binding form, and the block at
`docs/how-to/evaluate-workflow-behavior.md:42-69` stays byte-identical to the published contract's
first two steps, which is what Decision 1 actually rests on.

So the run makes all three calls, each answering 400 with `ok: false`, `O-003` scores `confirmed` with
its corroboration agreeing, and `verdictBasis` is one entry, the trial-set shortfall. The first
shipped api workflow exemplar no longer ships a chain leaving three of its seven steps unexercised.
Downstream consequence: `obs-malformed-read` is a `get-thing` observation the probe's selector admits,
so the witness partition gains a second refuting member and the chain test asserts both.

**Decision 18: the seeded fault is a dropped field, because a create-shaped silent write cannot be
observed at pre-flight.**
The first build seeded the spike chain's fault, a write that reports success and reaches no store, and
the peer review found that its evidence contradicted the contract's own `testData.setup`: a read at the
identifier the write returned answered 200 carrying a record, which a store that was never written
cannot hold. The setup declared one seeded thing, and two authored reads answered for records it ruled
out.

Widening the setup to admit those records was the cheap repair and it is the wrong one, because the
contradiction is not in the prose. A pre-flight leg is one call with fixed inputs and cannot write and
then read back, so a fault in the write is observable on a leg only against a record the write itself
filed; and the fault has to be input-conditional, since every create leg of a mutated build exhibits
it and `seeded-faults-scoped` fails when the relation fires on a clean leg of the same operation.

The fault this story ships instead is a dropped field: the write files the record, drops the name it
was sent, and the store fills in its own placeholder, while the handler answers from the request it
was given. Three properties follow, and each is what some part of the chain needs. The write's own
response still echoes the name it was sent, so it stays indistinguishable from a correct one and the
signature stays homed on the read. The record exists at the identifier the write returned, so the
read-back's 200 is what a store in that state answers. And the fixture can hold a record filed through
the write, which is what the manifestation witness reads: `testData.setup` declares `t-8` as filed
through the write under test rather than placed directly, and the relation over that leg is true only
of a build that drops the field. Downstream consequence: `testData.setup` is now load-bearing for the
pre-flight plan rather than only for a human running the fixture, and a later story that changes the
seeded fault has to move it with the evidence.

**Decision 19: what the peer review found, and the two findings that were errors in shipped prose.**
The review returned thirteen findings over the first build. Two were factual errors in prose a reader
would open: the claim that this chain is the only one whose pre-flight verdict is computed, which the
skill chain shipped one story earlier falsifies, and the fixture contradiction Decision 18 records.
Four more were overclaims about what `preflight-verdict.json` records, which Decision 12 had already
settled for the guide and which the chain builder's own header still carried in the wrong words. Three
were assertions that pinned nothing, found by deleting them and then applying the mutation each was
supposed to catch: an assertion on `contract.fixtureReset.operationId` that the control-leg row above
it already read through the planner, and two "with nothing removed" controls in the coverage file that
the whole-table verdict already determined in both columns.

Two of its checks are worth carrying forward as method. It attacked a claim by reading the file the
claim points at rather than the claim: the tool-server citation named a test whose own docblock says
it does not restate the leg count, and the file that pins it is
`tests/application/preflight.test.ts` case 113. And it found that a sentence I had gated in the corpus
README was left ungated in the guide, which is the page an adopter actually reads; both now have
entries, and the gate holds 31 numerals across 10 files.

One finding was declined on its first reading and then taken. Decision 14 records that exchange.

**Decision 15: `check:doc-counts` gains six entries, and the committed-chain count is read off the
registry.**
Three published sentences count committed chains and a fourth was added by Story 11.10 inside the
corpus README's "What is here" bullet. All four now have gate entries, and the value comes from
`buildWorkedExample()`'s own key set rather than from a list of chain labels kept in the gate: a chain
added to that registry and left out of such a list would leave all four sentences stale with nothing
to notice, which is the drift the gate exists to stop.

Two more entries cover the mechanism counts this story's own sentence in the corpus README states, the
number of published contracts carrying a `{ captured }` binding and the number declaring a
`fixtureReset`. Both are computed by walking the published JSON's `interactionPlan` bindings and
`fixtureReset` field rather than by matching the word in the file text, so a contract whose oracle
commentary happened to spell "captured" is not counted. All six patterns are built with the file's own
`WRAP` constant where they read the wrapped README, so no capture can come from the paragraph above
the sentence being gated.

**Decision 16: the guide's three compile-check demonstrations are regenerated against the shipped
contract, and two of them were false before.**
`docs/how-to/evaluate-workflow-behavior.md:102` says each quoted message is the real output of
`compile` on the plan above with one field changed. The channel message was true. The type message
named a `list` step and a `limit` parameter the plan above does not declare, and the cycle message
quoted `/interactions/create/response-body/name`, a self-capture that reproduces
`unreachable-check-evidence` rather than the `binding-cycle` the page shows, because no response
descriptor in that contract declares `name`.

Both are now produced from `captured-read-back` with one field changed and were captured from a real
`compile` call: the type message captures the boolean `ok` into `read-back`'s own `string` `id`, and
the cycle message makes `create` capture `/interactions/read-back/response-body/error`, a declared
string, while `read-back.after` is `create`. Story 11.9's Phase 1 sweep reported the same two defects
independently while this story was in flight, along with `:76` claiming `InputBinding` is a two-member
union where `src/core/schemas/plan.ts:128-132` makes it three. That third one is corrected here too,
since this story was already editing the sentence's own page.

**Decision 17: the exemplar is parsed into `DEV_CORPUS_CONTRACTS` for the reason the tool-server
contract is.**
Its operations declare different keys per channel, so an empty `types: {}` beside a populated one
infers `{ id?: undefined }` and the array literal stops being assignable to `readonly EvalContract[]`.
`EvalContract.parse` at the array site is the shipped answer to that and it is what
`corpus.ts` already does for `mcpContract`; the comment there now names both.

## Design Notes

The organising idea is Story 9.5's. That story applied it to an interface kind; this one applies it to a mechanism. A chain that calls the shipped stages is evidence, and a claim about a mechanism no shipped artifact exercises is an assertion. Two sentences in the workflow guide say plainly that the capture form and the four-leg control branch are in that position, and the only thing that moves them is one contract declaring both, going through `compile` → `seal` → `preflight` → `ingest` → `score` → `emit`, producing bytes a byte gate compares.

The volatile-identifier interaction is the part worth stating, because it looks like a contradiction and is not. `create-thing` declares `/id` volatile, so `preflight/projection.ts` prunes it and `sameFixtureState` never sees it, which is what lets `state-reset` compare two reads of a store that minted a new identifier in between. The capture reads the same field and resolves it, because `resolveCapturedValue` walks the raw `Observation` at `score/bindings.ts:119`. A server-minted identifier is exactly what a capture exists for and exactly what a fixture-state comparison has to ignore, and one contract holding both is the clearest place to show it.

The orphaned docblock at `src/core/compile/bindings.ts:40-52` is the small find. It documents a constant Story 9.3 deleted, sits above an unrelated type, and repeats a rule `checkCapturedChannel`'s own docblock already carries. One sentence in it is unique and moves; the rest goes.

Both of this story's findings are carried in the epic register at `_bmad-output/implementation-artifacts/epic-11-context.md:48-49`, the orphaned docblock and Story 9.3's Decision 4 consequence that never landed. Read against this story, the register states both correctly, including that the `cli` capture from `stdout` and the one from the `artifact` channel stay unexercised by a shipped contract. Nothing there needs correcting.

## Verification

**Commands:**

- `npm run generate:dev-corpus && npm run check:corpus` -- expected: exit 0, zero orphans, zero drift, one more `contract` entry in `index.json`.
- `npm run generate:worked-example && npm run check:worked-example` -- expected: exit 0 over all three chains, with the spike chain's five files and Story 11.10's six byte-identical to their committed form.
- `npm run check:ad31-table && npm run check:ad21-table && npm run check:ad33-table` -- expected: exit 0 with no regeneration for any of the three.
- `npm run check:schemas` -- expected: exit 0 with no regeneration; this story changes no schema.
- `npm run check:doc-counts` -- expected: non-zero before the numeral edits, naming each file, line, word carried and word owed; exit 0 after.
- `npm run check:doc-invocations` -- expected: exit 0, unchanged; this story adds no fenced command and edits no existing one.
- `npm run check:boundary` -- expected: exit 0, with the new corpus bytes scanned.
- `npm run validate` -- expected: exit 0 with nothing on stderr across every step.
- `grep -rn "captured" corpus/` -- expected: the exemplar's binding, where it returns nothing today.
- `grep -n "fixtureReset" corpus/dev/contracts/*.json | grep -v null` -- expected: the exemplar, where it returns nothing today.
- `grep -rn ", not \|rather than\|instead of\|as opposed to\|, never \|no longer" tests/schemas/fixtures/workflow-contract.ts tests/coverage/workflow-coverage.test.ts tests/score/workflow-worked-example.test.ts scripts/workflow-example-target.ts scripts/dev-corpus-target.ts src/core/compile/bindings.ts` -- expected: every hit is a before-and-after where both halves carry a fact.

**Manual checks:**

- `git diff CHANGELOG.md` touches nothing below `[Unreleased]`, since `release:prepare` owns the dated sections.
- `git status` over `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/spike-worked-example/` and `_bmad-output/worked-examples/skill-defect/` reports no change, so neither earlier chain moved.
- `docs/index.md:78` and the corrected passages in the workflow guide read together claim no more than the emitted artifacts carry, and both carry the one-trial limit.
