---
title: 'A seeded defect scored against a skill contract'
type: 'feature'
created: '2026-09-09'
status: 'done'
review_loop_iteration: 0
context:
  - _bmad-output/implementation-artifacts/epic-11-context.md
  - _bmad-output/implementation-artifacts/11-8-the-published-surface-the-corpus-and-the-census.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `docs/index.md:77` gives the skill row the state "Gameability proven across eight contracts. No seeded-defect instance yet", and `docs/how-to/evaluate-skill-behavior.md:234` says it plainly: "nobody has scored a seeded-defect probe against a skill contract." `:235` names the consequence, `strength.defect` is `null` in all eight of TEA's fragment-selection suites, "so the catch rate this shape yields today measures the degenerate reply alone". Nothing in the schema or the gate blocks the shape, and the tree already proves that: `commandProbe` (`tests/schemas/fixtures/artifact-fixtures.ts:534-561`) is a `defect`-class probe with a `cli` signature on `stdout` and `exit-code` against `fragment-selection-runner select`, and `tests/score/qualification.test.ts:863-865` asserts `qualifyProbe` returns an empty failure list for it. What no artifact in this repository carries is that probe carried through `ingest`, `score`, and `emit` to an evidence artifact whose `strength.vector.defect` holds a number.

**Approach:** Author one skill-shaped `cli` contract into `DEV_CORPUS_CONTRACTS`, and score a seeded-defect probe against that exact contract through a second generated chain at `_bmad-output/worked-examples/skill-defect/`, emitted by its own target module and riding `npm run generate:worked-example` and `npm run check:worked-example`. This story lands first of the epic's three evidence stories and therefore defines the construction the later ones extend: one target file per chain, one shared module for what more than one chain needs, and `buildWorkedExample` as the union of the builders' maps. The chain's contract is the corpus fixture itself, so the published bytes an adopter reads and the bytes the evidence artifact was produced from have one digest. Its pre-flight verdict is computed by `preflightFromObservations` over authored observations. The seeded defect manifests on the channel the operation's descriptor nominates, which is where `docs/how-to/evaluate-agent-behavior.md:78` already tells an author to plan it, and the story records both structural limits the guide names against what the run actually returns.

## Boundaries & Constraints

**Always:**

- Every claim in this file is read from the tree at 1.4.2 or transcribed from a run. Where a number this story inherits from Story 11.8 has moved by the time the work starts, the value is re-read and the difference is recorded here.
- The corpus contract and the scored contract are one object. The chain imports the fixture `DEV_CORPUS_CONTRACTS` publishes, following the precedent `scripts/generate-dev-corpus.ts:5-8` states for a script importing contract data from `tests/`: the contracts are a fixture by AD-30's own naming, so no authoring code enters `dist`.
- The seeded defect's discriminating condition names only channels a `cli` signature can address. `foreignChannels` (`src/core/score/qualification.ts:147-151`) hands a `cli` signature `API_RESPONSE_CHANNELS` as forbidden, so the legal set is `stdout`, `stderr`, `exit-code`, `artifact`, and the transport-rooted `call-inputs`; `checkObservableChannel` (`:438-461`) narrows the declared `observableChannel` to the four response-side members of that set.
- The AD-9 gate runs for real and a rejection fails the build. `scripts/worked-example-target.ts:1222-1231` is the shape: `sealProbeSet` over the authored probe, and `fail()` naming every code and artifact path on any rejection.
- Generated files reach disk through their generators. `corpus/dev/`, the chain's six files, `schemas/*.schema.json`, the three AD tables, and `_bmad-output/shareable/*.html` each have a `check:` script that proves it.
- `check:boundary` scans `corpus/`, so every string the corpus contract carries clears all twelve patterns at `scripts/package-boundary.ts:56-105`, including `bmad`, `TEA`, `story`, `epic`, and the numbered `AC`, `Task`, and `Decision` forms. AD-18 forbids naming a real executable, path, or subject, so the contract names logical identifiers only.
- Documentation moves in this same diff. Every count this story's corpus growth falsifies is corrected at its source, and every sentence about what a skill contract has been shown to do is corrected on the page that carries it.
- `CHANGELOG.md` is hand-maintained and its header (`:1-9`) puts entries under `[Unreleased]` for `release:prepare` (`package.json:111`) to stamp. NFR8 (`_bmad-output/planning-artifacts/epics.md:54`, "pre-1.0 SemVer with every caller-facing break called out") covers what the package publishes, and this story adds a second committed chain to it, so this story writes its own entry rather than leaving the epic's disclosure to a later story.
- Updated is the floor. Text the correction makes redundant is cut in the same pass, so no page carries the old framing beside the new one.
- The voice pass runs while the text is written. After editing, grep every edited file for `, not `, `rather than`, `instead of`, `as opposed to`, `, never `, `no longer` and keep only the hits where both halves carry a fact.

**Ask First:**

- Any change to `src/`. This story ships a fixture, a generated chain, and prose. A behaviour found missing here is a finding against the story that shipped it.
- Any `schemaVersion` move. Story 11.4 owns the eval contract's and Story 11.6 owns the probe's and the run record's; this story writes documents at whatever version those stories left.
- A policy carrying `minimumTrialCount: 1`. The published default artifact declares 3 (`scripts/worked-example-target.ts:143`), and lowering it to make one chain comparable would describe a policy nobody ships.
- Deleting or rewriting `docs/how-to/evaluate-skill-behavior.md`'s "In BMAD terms" section (`:241-254`). Its counts describe TEA's own repository and are read from there.

**Never:**

- No edit to `commandContract` or `artifactCommandContract` (`tests/schemas/fixtures/command-contract.ts:17`, `:191`). Both are byte-pinned into the corpus and are accept fixtures for the `cli` branch of `permittedInterfaces`; the skill exemplar is a third fixture beside them.
- No second `compile-seal-example`. `EXAMPLE_SEED_ID` (`scripts/dev-corpus-target.ts:69`) is what `scripts/check-doc-invocations.mjs` replays every documented command against, and a second example doubles that surface.
- No new fenced command in any edited documentation page. `check:doc-invocations` replays fenced commands, and every claim this story makes is about an artifact a reader can open.
- No probe, run record, or evidence artifact published into `corpus/dev/`. `DevCorpusKind` (`scripts/dev-corpus-target.ts:27-31`) is closed at four kinds, and `corpus/dev/README.md:26-39` states the division this story keeps: the corpus ships contracts and the compile-and-seal pair, and the end-to-end artifacts live in the committed chain.
- No spine revision, no new ADR, and no new AD-5 or qualification failure code.
- No signature substituted to make a run come back clean. A refusal transcribed whole is the finding, which is the move `docs/how-to/evaluate-agent-behavior.md:320` records TEA declining to skip.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| The skill contract compiles | One `cli` interface, one operation, `descriptorChannel` on `stdout`, a declared collection with a cardinality bound, a sensitivity witness | `compile` returns it unchanged, so it publishes with no `structuralFailure` entry | A structural failure raises the pin at `tests/architecture/dev-corpus.test.ts:331-333` above 3 and blocks |
| The same contract under strict compile | `compile(parsed, { strict: true })` in `tests/coverage/command-coverage.test.ts:25-31` | Clean. The declared sensitivity witness is what keeps `undeclared-mandatory-input` from firing, the same reason `commandContract` declares one | A strict-only failure means the witness is missing or unaddressed |
| The seeded-defect probe qualifies | `probeClass: 'defect'`, `expectedClean: false`, one defect with `source: 'controlled-mutation'`, `rollbackVerified: true` | `qualifyProbe` returns `failures: []` and `declarationChecksRan: true`, since the chain resolves the home operation | `sealProbeSet` rejection fails the generator with every code and artifact path printed |
| The condition's channels | `all(equality(exit-code, 0), for-any(stdout/selected, set-membership(@/, [excluded])))`, `observableChannel: 'stdout'` | `checkChannels` (`qualification.ts:473-501`) returns on the first branch: the predicate names the declared observable channel | N/A |
| The same defect addressed through the written file | The condition's pointer moved to `/interactions/observed/artifact/<id>/selected` | `condition-artifact-channel-contract-local` (`qualification.ts:339-343`), transcribed with its path and detail | Qualification failure; AD-9 keeps the probe out of a sealed set |
| The quantifier against the home operation | `for-any` over `/interactions/observed/stdout/selected` | Legal: `checkExpressionQuantifierOverNonCollection` runs with `legIds: [OBSERVED_STEP_ID]` (`qualification.ts:673-684`) and the descriptor declares `/selected` in `collectionLocations` | `condition-quantifier-over-non-collection` if the collection is undeclared |
| The selector's keys | `option: { skill: { literal: ... } }`, `stdin: { prompt: { matcher: 'any' } }` | Both declared in the operation's `requestShape`, so `checkSelectorKeys` adds nothing | `condition-selector-key-undeclared` names the channel and the key |
| The witness match | One defect finding citing the probe and citing the observation the condition satisfies | `matchProbeWitness` resolves `matched`, which is what makes the trial vote `caught` | `manifested-unclaimed` or `unwitnessed-claim` is a defect in the authored record and is fixed before the chain ships |
| The pre-flight verdict | One authored `ProbeObservation` per planned leg, handed to `preflightFromObservations` (`src/application/preflight.ts:158-197`) | `passed: true`, with every planned leg and its check result in the emitted `preflight-verdict.json`, the chain's sixth file | A failed verdict blocks scoring, so the generator fails and the chain does not build |
| The strength vector | One admitted `defect`-class probe, one exercised trial | `strength.vector.defect` is `{ caught: 1, exercised: 1, rate: 1 }`, and `gameability` and `zero-action` stay `null` | A `null` `defect` class means the probe was excluded or unexercised and the run is investigated |
| Comparability | `trials.completed` 1 against `declaredMinimum` 3 | `strength.comparable` is `false` and the note reads "Below the declared minimum of 3", per `src/core/emit/emit.ts:77-88` | N/A; this is the second structural limit and the run reports it |
| The ladder | The scored chain | A non-null verdict with its exit code, transcribed into this file. `below-minimum-trial-count` (`src/core/score/ladder.ts:690-703`) contributes a CONCERNS basis | A null verdict is AD-21's Invalid rung and fails the generator at the guard `worked-example-target.ts:1301-1305` copies |
| `generate:dev-corpus` then `check:corpus` | `DEV_CORPUS_CONTRACTS` at 23 | 23 contracts plus the compile-and-seal pair; `index.json` carries 26 entries, 24 of kind `contract`; zero orphans, zero drift | Any orphan or first-differing-offset report blocks |
| `check:ad31-table` | `CORPUS_CONTRACTS` untouched at 19 | No regeneration | A moved table means the exemplar landed in the wrong array |
| The chain's contract digest | `shasum -a 256 corpus/dev/contracts/<contractId>.json` | The hex half equals the `contractDigest` the chain's `sealed-run-record.json` carries, because the corpus writes `serializeArtifact` output straight to disk | A mismatch means the chain scored a different object than the corpus published |

</frozen-after-approval>

## Code Map

Every line number below was read from this tree at 1.4.2. Counts marked "after Story 11.8" are that story's stated result and are re-read before they are used.

**Why the shape is reachable**

- `src/core/score/qualification.ts:147-151` -- `foreignChannels`. `kind === 'cli'` forbids `API_RESPONSE_CHANNELS`, so a `cli` signature may name `stdout`, `stderr`, `exit-code`, `artifact` (`COMMAND_RESPONSE_CHANNELS`, `src/core/schemas/pointer.ts:125-130`) and `call-inputs`, which belongs to neither side.
- `src/core/score/qualification.ts:438-461` -- `checkObservableChannel`. The declared channel must be in `RESPONSE_SIDE` (`:145`, built from `RESPONSE_SIDE_CHANNELS` at `pointer.ts:153-156`) and must not be foreign, which leaves exactly `stdout`, `stderr`, `exit-code`, `artifact` for a `cli` signature.
- `src/core/score/qualification.ts:320-344` -- the artifact rule, and the asymmetry this story turns on. The refusal fires inside the predicate walk on `target.channel === IDENTIFIER_ROOTED_CHANNEL`, so `observableChannel: 'artifact'` is admitted by the declaration check above while every pointer reaching that file is refused. The comment at `:334-338` states the lift condition: an identifier meaning "the artifact this operation describes", which nothing reserves.
- `src/core/score/qualification.ts:473-501` -- `checkChannels`. Naming the declared observable channel is the first branch, so a predicate on `stdout` with `observableChannel: 'stdout'` returns before the two-channel rule is consulted.
- `tests/schemas/fixtures/artifact-fixtures.ts:480-561` -- `fragmentSelectionSignature` (`:490`) and `commandProbe` (`:534-561`). A `defect`-class probe, `cli` signature, `observableChannel: 'stdout'`, condition over `exit-code` and `stdout/fragments`, `route: 'controlled-mutation'`, `rollbackVerified: true`. `tests/score/qualification.test.ts:863-865` asserts it qualifies with an empty failure list, and `:897-904` asserts the two stream channels pass untouched where the artifact pointer at `:867-883` does not.

**What computes the number the documentation calls `null`**

- `src/core/score/strength.ts:111-130` -- `buildStrengthVector` over `admitted` and the per-probe trial results, one `ClassStrength` per class.
- `src/core/score/strength.ts:58-63` -- `vectorEligible`, which drops `canary` and every `expectedClean: true` probe. A `defect`-class probe with `expectedClean: false` is what puts a value in the `defect` slot.
- `src/core/score/strength.ts:75-102` -- `classStrengthOf`. A class with no eligible probe is `null`, which is what all eight of TEA's suites report; a class with an exercised probe is `{ exercised, caught, rate }`.
- `src/core/score/reduce-trials.ts:113-153` -- `reduceTrialSet`. `exercised` is `validCount > 0` and `caught` is `caughtCount / validCount > catchThreshold`, strict, so a tie is unreachable.
- `src/core/emit/emit.ts:77-88` -- `comparable` and `strengthNote`. `trials.completed >= trials.declaredMinimum` with no `unreached` oracle, and the note names the shortfall.

**The trial-set limit, and which surface owns it**

- `src/application/score.ts:252-283` -- `runScore` parses one `--record` and calls `score(contract, [validated], ...)`. One record per invocation is the command's shape.
- `src/core/score/score.ts:372-377` -- `score` takes `trials: readonly ValidatedObservations[]`, and `:696-700` sets `completed: votes.length` against `declaredMinimum: policy.minimumTrialCount`. The library folds a trial set of any size; the CLI supplies one.
- `src/core/score/ladder.ts:690-703` -- `below-minimum-trial-count`, a CONCERNS row whose reason names both numbers.
- `scripts/worked-example-target.ts:135-147` -- `POLICY`, the published default artifact, `minimumTrialCount: 3` at `:143`.
- `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/spike-worked-example/evidence-artifact.json` -- the spike chain's own result: `trials.completed` 1, `declaredMinimum` 3, `strength.comparable` false, `strength.vector.defect` `{ caught: 1, exercised: 1, rate: 1 }`. The precedent for every number this story expects.

**The chain this story adds, and the construction it defines for the epic**

- `scripts/worked-example-target.ts:59-79` -- `WORKED_EXAMPLE_LABEL`, `WORKED_EXAMPLE_ROOT`, and `WORKED_EXAMPLE_FILES`, the five files the spike builder owns beside three hand-authored prose files. `keyOf` at `:81` prefixes the label, so a chain's root is its label and nothing else.
- `scripts/worked-example-target.ts:111-123` -- `renderJson` and `digestPlaceholder`, the two byte helpers, with the round-trip guard `:116-118` that catches a re-indent reordering canonical keys. Both move to `scripts/worked-example-shared.ts`.
- `scripts/worked-example-target.ts:135-147` -- `POLICY`, the published default artifact, `minimumTrialCount: 3` at `:143`, which also moves to the shared module so every chain scores under one declared policy.
- `scripts/worked-example-target.ts:1167-1169` -- `fail`, the generator's own abort, declared as a function rather than an arrow so TypeScript narrows on it. It moves with the byte helpers.
- `scripts/worked-example-target.ts:1213-1231` -- `homeOperationOf` and `sealProbeSet`, the AD-9 gate run for real, and `:1287-1305` the `ingest` / `score` / null-verdict guard sequence. Both are copied by shape rather than shared, because each chain names its own probe and contract.
- `scripts/worked-example-target.ts:1329-1374` -- `buildWorkedExample`, and the key-set check at `:1361-1372` that fails when the emitted map disagrees with the declared file list. It becomes the union of the builders' maps, and each builder keeps its own key-set check against its own file list.
- `scripts/generate-worked-example.ts:37-42` and `scripts/check-worked-example.ts:30-45` -- the I/O wrapper and the byte-exact drift check, both reading one builder today. `:37` is the single `mkdir` over one fixed root, which becomes a `mkdir` of each key's own parent.
- `src/application/preflight.ts:158-197` -- `preflightFromObservations`, synchronous, returning a parsed `PreflightVerdict`. The spike chain never calls it: `worked-example-target.ts` calls `compile` at `:1193`, `seal` at `:1194`, `sealProbeSet` at `:1222` and `score` at `:1289`, and parses an authored verdict at `:1211`. This chain calls it, per Decision 9.
- `scripts/check-docs.mjs:9-14` -- `ROOTS`: `README.md`, `_bmad-output/planning-artifacts`, `_bmad-output/project-knowledge`, and two `experiments/` files. `_bmad-output/worked-examples/` is outside all five, which is what makes it a legal home for generated chain bytes.
- `package.json:113` -- `validate`, which runs `check:corpus` and `check:worked-example` among its steps. `:99-100` are the two scripts, and neither moves.

**The corpus and its counts**

- `tests/coverage/fixtures/corpus.ts:514-534` -- `CORPUS_CONTRACTS`, 19 entries, exactly the AD-31 cell contracts in cell order. It does not move.
- `tests/coverage/fixtures/corpus.ts:536-559` -- `DEV_CORPUS_CONTRACTS`, 21 today, 22 after Story 11.8, 23 after this one. Its docblock at `:537-546` gives the rule the skill exemplar inherits, and `:548-553` records that a kind not covered by the AD-31 cells is graded in its own coverage file.
- `tests/coverage/command-coverage.test.ts:1-13,39-70` -- the fourteen predicates graded per command contract, whole verdict table asserted. The file's own header records the cost of leaving a corpus contract ungraded.
- `scripts/dev-corpus-target.ts:65,108,114,115` -- the numeral sites in the README template: six spelled-out words on four lines, because `:114` carries the corpus total and "Nineteen" and `:115` carries "two" and "Eighteen". `:117`'s "Three fail compilation by design" is a seventh word that holds all epic. All of them are mirrored byte-checked at `corpus/dev/README.md:3,9-12`.
- `scripts/dev-corpus-target.ts:137-144` -- the README template's second absence paragraph, mirrored at `corpus/dev/README.md:32-39`. It says the end-to-end example's inputs are "authored for the worked example in `scripts/worked-example-target.ts`" and that "Only the run record among them is committed, as `spike-worked-example/sealed-run-record.json`". A second chain in a second module with a second committed run record makes both clauses incomplete. The paragraph is generated, so the edit lands in the template and never in `corpus/dev/README.md`, and case 163's third pattern (`dev-corpus.test.ts:280-283`, `/Three of the four artifacts[\s\S]*inputs the shipped[\s\S]*ingest[\s\S]*stage\s+consumes/`) has to keep matching after this rewrite and after Story 11.11's.
- `scripts/dev-corpus-target.ts:131-135` -- the first absence paragraph, "The qualified-probe dimensions are absent". It stays true: this story publishes no probe into `corpus/dev/`, and the sentence is about that directory's own gate.
- `corpus/dev/index.json` -- 24 entries today: 22 `contract`, 1 `sealed-evaluator-brief`, 1 `readme`. Read off the file, with 18 published contracts declaring `api`, 2 declaring `cli`, and one declaring no interface.
- `tests/architecture/dev-corpus.test.ts:314-334` -- case 165, which pins `structuralFailure` entries at exactly 3, and `:267-293` case 163, whose four absence patterns this story leaves matching.

**The published sentences this story lands on**

- `docs/index.md:77` -- "Gameability proven across eight contracts. No seeded-defect instance yet." This story's cell.
- `docs/how-to/evaluate-skill-behavior.md:41-43` -- "A defect signature cannot address a file the command wrote. ... A skill whose decision is visible only inside a written file can still carry oracles; it cannot carry the gameability probe that makes those oracles worth trusting." The restriction is right and the last clause is narrow: the refusal is on any signature's pointers, so a seeded-defect probe is refused on the same terms.
- `docs/how-to/evaluate-skill-behavior.md:229-239` -- the whole "Where this stands" section, including `:234`'s "Not proven", `:235`'s `strength.defect` claim, `:238`'s trial-set limit, and `:239`'s written-file limit.
- `docs/how-to/author-behavioral-contracts.md:237` -- "The repository commits one complete chain, generated by running the shipped stages over authored inputs", immediately above the `CHAIN=` assignment at `:240`. Read at 1.4.2: an earlier draft of this story cited `:236`, which is the blank line above it.
- `docs/how-to/author-behavioral-contracts.md:233` -- "One record per invocation is a trial set of one. Whenever your policy's declared minimum exceeds one, the strength vector comes out reported and marked non-comparable." Correct about the command, and the sentence this story checks its own framing against.
- `README.md:240` -- the generated-artifact table row, `| the committed worked chain | npm run generate:worked-example | npm run check:worked-example |`. Only the first cell moves: Decision 5 keeps both script names and both script files, so the Rebuild and Guard columns are unchanged and `package.json:99-100` and `:113` take no edit.
- `docs/how-to/evaluate-agent-behavior.md:294` -- "`corpus/dev/contracts/` ships two contracts describing a system behind a command." Story 11.8 lists this as holding at two; this story's diff makes it three.
- `docs/how-to/evaluate-agent-behavior.md:78` -- "Plan the seeded defect so its signature lives on `exit-code`, or on the stream the descriptor nominates." The instruction this story's chain follows, checked and left standing.

**The disclosure**

- `CHANGELOG.md:1-9` -- the header, which says entries go under `[Unreleased]` and that `npm run release:prepare` (`package.json:111`) moves them into a dated section. `:11` is the current `[Unreleased]`.
- `CHANGELOG.md:285-290` and `:311-313` -- Epic 9's own artifact bullets, the shape an entry follows: what moved, what a caller holding the old thing sees, and what still works.
- `CHANGELOG.md:578` -- the standing statement that the `schemaVersion` number gates nothing in either direction in v0. This story moves no `schemaVersion`, so it neither restates that nor relies on it.

**The counts this story moves**

The composition is in Decision 6; the sites are:

- `scripts/dev-corpus-target.ts:65,108,114` -- the corpus total, on its second move. Story 11.8 moved it first.
- `scripts/dev-corpus-target.ts:115` -- two words on one line. "Eighteen", the compiling count, is on its second move. "two", the command-contract count, is on its only move: Story 11.8's exemplar declares `mcp` and leaves it alone.
- `scripts/dev-corpus-target.ts:114`'s "Nineteen" and `:117`'s "Three" -- read and left, because `CORPUS_CONTRACTS` stays at 19 and the failing-by-design count is pinned at 3.
- `docs/reference/cli-commands.md:233`, `docs/how-to/author-behavioral-contracts.md:94`, `docs/how-to/evaluate-ai-feature-behavior.md:234`, `docs/explanation/what-ships.md:20`, `docs/tutorials/getting-started.md:12`, `README.md:180`, `docs/how-to/evaluate-agent-behavior.md:294` -- the hand-written page counts, all seven pages gated by `check:doc-counts` after Story 11.8.
- `scripts/check-doc-counts.ts` -- Story 11.8's gate, fourteen numerals across those seven pages from that story's boundary onward. Every one of them recomputes from the published corpus, `evaluate-agent-behavior.md:294`'s command-contract count included, which Story 11.8 added as the fourteenth entry so this story's move from two to three is caught by the gate. This story adds no entry and edits no gate code; it moves the words the gate names.

## Tasks & Acceptance

**Execution:**

- [x] `tests/schemas/fixtures/skill-contract.ts` -- author the skill exemplar on `command-contract.ts`'s model, wrapping the interface `docs/how-to/evaluate-skill-behavior.md:57-113` already publishes as compiling at exit 0: one `cli` interface, one operation whose invocation is the guide's own at `:64`, executable `skill-runner` with `subcommandPath` empty, `descriptorChannel` on `stdout`, a response descriptor declaring the selection as a collection with a cardinality bound, and the sensitivity witness the strict compile needs. Two behaviors, each with exactly one oracle, so `designatedOracleIdOf` (`src/core/score/score.ts:168-178`) resolves: the inclusion half and the exclusion half the guide describes at `:118-170`. Every string clears `check:boundary`'s twelve patterns and AD-18's excluded content.
- [x] `tests/coverage/fixtures/corpus.ts` -- add the exemplar to `DEV_CORPUS_CONTRACTS` and leave `CORPUS_CONTRACTS` at 19. Extend the docblock at `:537-546` to say what a third contract behind a command is here for, and cut what the extension makes redundant.
- [x] `tests/coverage/command-coverage.test.ts` -- a third grading case over the exemplar, whole verdict table asserted, following the file's own rule that naming only the interesting rules lets the next one through.
- [x] `scripts/worked-example-shared.ts` -- NEW. Extract `renderJson`, `digestPlaceholder`, `fail` and `POLICY` from `worked-example-target.ts`, so every chain renders bytes one way and is scored under one declared policy artifact. This module is what more than one chain needs and nothing else. `check:worked-example` proves the extraction moved no spike-chain byte.
- [x] `scripts/skill-example-target.ts` -- NEW, and one target file per chain is the rule this story sets: `worked-example-target.ts` keeps the spike chain and never learns about a second. This module imports the corpus fixture as its contract, authors the probe, the sealed run record, the isolation manifest, the evaluator configuration, and one `ProbeObservation` per planned leg; computes its pre-flight verdict through `preflightFromObservations`; runs `sealProbeSet`, `ingest`, `score` and `emit` for real; and fails on a rejected probe or a null verdict. It owns its own label `_bmad-output/worked-examples/skill-defect`, its own six-file list, and its own key-set check. Its digest placeholders continue the spike chain's ordinal sequence so no two placeholders in the repository collide.
- [x] `scripts/generate-worked-example.ts` and `scripts/check-worked-example.ts` -- `buildWorkedExample` becomes the union of the builders' maps, and the generator creates each key's own parent directory where today it creates one fixed root at `:37`. Neither script learns which chain a key belongs to, and each reports every label it wrote or compared. One `generate:` script and one `check:` step still cover both chains, so `validate` gains no step.
- [x] `npm run generate:worked-example && npm run check:worked-example` -- regenerate and verify. The spike chain's five files are byte-identical; any difference is investigated before it is accepted.
- [x] `tests/score/skill-worked-example.test.ts` -- NEW. Value-level assertions on the second chain, following `tests/score/worked-example.test.ts`'s posture of reading the builder's values and touching no file: the probe qualified, the witness match resolved `matched`, the computed pre-flight verdict reads `passed: true`, `strength.vector.defect` carries its three values, `strength.comparable` is `false` with the note naming the declared minimum, and the emitted key set is exactly the declared one.
- [x] `npm run generate:dev-corpus && npm run check:corpus` -- regenerate; expect 26 index entries, 24 of kind `contract`, zero orphans, zero drift, and the `structuralFailure` pin still at 3.
- [x] `scripts/dev-corpus-target.ts` -- move the corpus total at `:65`, `:108` and `:114`, and both words at `:115`, the command-contract count and the compiling count; leave `:114`'s "Nineteen" and `:117`'s "Three" alone. Describe the skill contract in "What is here" and cut what that makes redundant. This is published prose and gets the voice pass at its source.
- [x] `scripts/dev-corpus-target.ts:137-144` -- rewrite the second absence paragraph for two committed chains: name both target modules and both committed run records, keep the claim that the isolation manifest and the evaluator configuration reach `ingest` as authored values only, and keep case 163's third pattern matching. The paragraph is a template literal that reaches disk through `npm run generate:dev-corpus`, so `corpus/dev/README.md` is never hand-edited. Then regenerate and re-run `tests/architecture/dev-corpus.test.ts`.
- [x] The seven hand-written page counts -- move each at its source per the Code Map, then `npm run build:shareable && npm run check:shareable` for `README.md`'s projection.
- [x] `docs/how-to/evaluate-agent-behavior.md:294` -- "two contracts describing a system behind a command" becomes three. Story 11.8's gate already carries this line as its fourteenth entry, so `check:doc-counts` names the word before the edit and exits 0 after; this story adds no gate entry and edits no gate code.
- [x] `docs/index.md:77` -- the skill row's State cell becomes Decision 10's cell.
- [x] `docs/how-to/evaluate-skill-behavior.md:41-43` -- widen the last clause from the gameability probe to any probe carrying a signature, since the refusal reads the channel of a condition's pointer and is indifferent to the probe class.
- [x] `docs/how-to/evaluate-skill-behavior.md:229-239` -- rewrite "Where this stands" against the run: what the chain proves, where a reader opens it, the three values `strength.vector.defect` carries, the rung and exit code, and the two limits restated per Decisions 3 and 4. Cut the sentences the rewrite makes redundant.
- [x] `docs/how-to/author-behavioral-contracts.md:237` and `README.md:240` -- both say the repository commits one chain. Each names two, with one line saying which question each answers, and each is written so Story 11.11 changes a count and no framing. `README.md:240`'s Rebuild and Guard cells keep their two script names; only the first cell moves.
- [x] `CHANGELOG.md` `[Unreleased]` -- one `### Added` bullet naming the second committed chain: what it holds, where it lives, that the corpus contract it scores is the same object the tarball publishes and its digest proves it, and that its strength vector is one trial and marked non-comparable. It says nothing about the corpus digest's effect on scoring-version comparability, which Story 11.8 states once for this epic as the first story that moves the corpus, and nothing about a `schemaVersion`, which this story does not move.
- [x] Voice pass -- grep every file this story edited for the six banned constructions and keep only the hits where both halves carry a fact.
- [x] `_bmad-output/project-knowledge/learning-path-step-by-step.md` -- add this story's step as the next number after the highest in the file, marked `(epic11-story10)`, plus its table row, following `_bmad-output/project-knowledge/learning-path-template.md`. Written after the peer review's findings are addressed and before the human reviews locally.

**Acceptance Criteria:**

- Given the skill exemplar, when `compile` runs over it in the corpus builder and again under `{ strict: true }` in the coverage test, then both return clean, so `tests/architecture/dev-corpus.test.ts:331-333` still reads 3 structural failures.
- Given the seeded-defect probe, when the chain builder calls `sealProbeSet`, then the probe is admitted with an empty failure list and `declarationChecksRan` is `true`, and this file transcribes the result; a rejection is transcribed whole with its code, artifact path and detail, and no substitute signature is authored.
- Given the contract's operation and the probe's defect signature, when `commandSignature` (`src/core/compile/interface-inventory.ts:81-91`) renders each, then the two strings are equal, `resolveHomeOperation` returns the operation rather than `null`, and `declarationChecksRan` is `true` because of it.
- Given the chain's authored observations, when `preflightFromObservations` runs, then the emitted `preflight-verdict.json` reads `passed: true` and records every planned leg with its check result, and no verdict field in this chain is hand-typed.
- Given the emitted evidence artifact, when `strength.vector.defect` is read, then it is a `ClassStrength` object with `exercised` 1, `caught` 1 and `rate` 1, which is the number `docs/how-to/evaluate-skill-behavior.md:235` reports as `null` today.
- Given the same artifact, when `strength.comparable` is read, then it is `false` and `strength.note` names the shortfall against the declared minimum of 3, and the story states what claim that leaves the documentation able to make.
- Given the same artifact, when its verdict and exit code are read, then this file records both, together with every basis the ladder returned.
- Given `shasum -a 256` over the published corpus contract, when its hex is compared with the `contractDigest` in the chain's `sealed-run-record.json`, then the two agree, so the contract an adopter reads is the contract the evidence was produced from.
- Given `npm run check:worked-example`, when it runs after regeneration, then it is green over both chains and every byte of the spike chain is unchanged from before this story, including after the shared-module extraction.
- Given `_bmad-output/worked-examples/skill-defect/`, when it is listed after regeneration, then it holds the six files the builder declares and nothing else, and `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/spike-worked-example/` holds the same eight files it held before.
- Given `npm run check:corpus` after regeneration, when it runs, then it reports zero orphans and zero drift over 23 contracts plus the compile-and-seal pair, and `index.json` names the skill contract with a digest over the exact bytes on disk.
- Given `npm run check:ad31-table`, `check:ad21-table` and `check:ad33-table`, when they run, then none needed regeneration, proving no coverage cell, ladder row or outcome cell moved.
- Given the regenerated `corpus/dev/README.md`, when `tests/architecture/dev-corpus.test.ts` case 163 runs, then all four absence patterns still match, and the second absence paragraph names both committed chains and both run records.
- Given `docs/how-to/author-behavioral-contracts.md:237`, `README.md:240` and the corpus README's second absence paragraph, when each is read after this story, then each states two committed chains, and each is phrased so Story 11.11 changes a number and no surrounding sentence.
- Given `npm run check:doc-counts`, when it runs over the corrected pages, then it exits 0 across all fourteen entries on all seven pages, and flipping any one gated numeral by hand exits non-zero naming the file, the line, the word carried and the word owed.
- Given `CHANGELOG.md`'s `[Unreleased]`, when read, then it carries one `### Added` bullet naming the second committed chain, where it lives, and the one-trial non-comparable limit its vector carries, and `git diff CHANGELOG.md` touches nothing below `[Unreleased]`, since `release:prepare` owns the dated sections.
- Given `docs/index.md:77` and `docs/how-to/evaluate-skill-behavior.md:229-239`, when read together, then neither claims more than the run returned, both name the trial-set limit, and the written-file limit is stated as a limit on a signature's pointers.
- Given `learning-path-template.md`, when this story's step is added, then it carries the six headings in that order with `In plain terms` free of paths and schema names, and one table row is added at the top of the file.
- Given `npm run validate`, when it runs, then it exits 0 with nothing on stderr, and the step count is unchanged from what Story 11.8 left, because this story adds no `check:` script.

## Decisions settled by construction

**Decision 1: the seeded defect is reachable for a skill shape, and the gate already proves it, so this story ships evidence and no `src/` change.**
`foreignChannels` (`qualification.ts:147-151`) forbids a `cli` signature the three api response channels and nothing else, `checkObservableChannel` (`:438-461`) admits `stdout`, `stderr`, `exit-code` and `artifact` as declared channels, and `checkChannels` (`:473-501`) is satisfied the moment the predicate names the declared one. `commandProbe` (`artifact-fixtures.ts:534-561`) is already a `defect`-class probe on exactly that shape and `tests/score/qualification.test.ts:864` asserts it qualifies. So the sentence at `docs/how-to/evaluate-skill-behavior.md:234` describes a missing artifact, and the artifact is this story's deliverable. Downstream consequence: nothing in this story can discharge an obligation of Stories 11.3 through 11.7, because none of their code is reachable from a `cli` contract.

**Decision 2: the defect lands on the nominated stream, and the written-file route is transcribed from the gate.**
Story 11.1 expects both addressing routes and its matrix states the expected result: an artifact pointer is refused under `condition-artifact-channel-contract-local` whether it carries a tail or not, and a signature on the nominated stream qualifies with an empty failure list. Story 11.1 has not run, so every claim below is read from the gate as the tree carries it today, and this story diverges from that expectation in one place, which is the scope of the refusal. The check fires inside the predicate walk on `target.channel` (`qualification.ts:324`), so it reads a pointer and never reads `observableChannel`; `checkObservableChannel` admits `artifact` as a declared channel because it is response-side and not foreign for `cli`. The restriction therefore lands on the discriminating condition alone, and the guide's sentence at `:239` is true for the reason underneath it: a condition that cannot address the file cannot discriminate on its content, and a declared channel alone discriminates nothing. Downstream consequence: the lift condition stays where `qualification.ts:334-338` puts it, a reserved identifier meaning "the artifact this operation describes", and whoever reserves it changes `EVIDENCE_CHANNELS`, the pointer pattern, the published schema and the census.

**Decision 3: the second structural limit stands, and the sentence that states it gets one qualification.**
`docs/how-to/evaluate-skill-behavior.md:238` reads "One `score` invocation reads one sealed run record, a trial set of one, so a policy declaring a minimum above one produces a strength vector marked non-comparable." That is exactly true of the command: `runScore` (`src/application/score.ts:252-283`) parses one `--record` and calls `score(contract, [validated], ...)`. It is not true of the library: `score` (`src/core/score/score.ts:372-377`) takes `trials: readonly ValidatedObservations[]`, `:698` sets `completed: votes.length`, and `reduceTrialSet` folds the set. So the sentence names which surface owns the limit, and the rest of it stands. This chain scores one trial under the published default policy, `minimumTrialCount: 3` (`worked-example-target.ts:143`, moving to `worked-example-shared.ts`), so `strength.comparable` comes out `false` with the note `emit.ts:81-83` renders, and the ladder carries `below-minimum-trial-count` as a CONCERNS basis. The option turned down is authoring three trials into this chain to make one comparable vector: it would prove the reducer over a skill corpus and it would describe evidence no adopter can reproduce with the `score` command, and the spike chain's own committed result at `evidence-artifact.json` sets the honest precedent at one trial and `comparable: false`. Downstream consequence: the documentation may claim a measured defect catch rate for a skill contract and may not claim two skill contracts can be compared, and a later story that wants comparability needs the CLI to accept several records.

**Decision 4: the corpus contract and the scored contract are one object, and the digest is what proves it.**
`scripts/generate-dev-corpus.ts:5-8` records the precedent for a script importing contract data from `tests/`: the contracts are a fixture by AD-30's own naming, so no authoring code enters `dist`. The chain imports the same fixture, which buys a property the spike chain does not have. `dev-corpus-target.ts:176` writes `serializeArtifact` output straight to disk, so the published bytes are canonical and `shasum -a 256` over the published contract reproduces the `contractDigest` the sealed run record carries. An adopter can therefore open the corpus contract, hash it, and confirm the evidence artifact was produced from that exact object. The spike chain re-indents its files (`worked-example-target.ts:83-110`) and trades that reproducibility for readability, which is a different choice for a different purpose and is recorded there. This chain inherits `renderJson` from the shared module and re-indents too, so the property holds through the corpus bytes rather than through the chain's own copy of the contract. Downstream consequence: a later story editing the skill fixture moves both the corpus digest and the chain's bytes, and `check:corpus` and `check:worked-example` both fail until it regenerates.

**Decision 5: the chain rides the existing generator, gets its own module and its own root under `_bmad-output/worked-examples/`, and no probe reaches `corpus/dev/`.**
This story lands first of the epic's three evidence stories, so its construction is the one Stories 11.11 and 11.12 extend, and it is written out here in four parts.

*The home.* Three were available. `corpus/dev/` is closed at four kinds (`dev-corpus-target.ts:27-31`), its orphan sweep walks the whole tree, and its README states the division at `corpus/dev/README.md:26-39`: the corpus ships contracts and the compile-and-seal pair, and the end-to-end artifacts live in the committed chain. The spike directory was turned down: it holds three hand-authored files, `FINDINGS.md`, `README.md` and `system-under-test.md`, which describe that spike's own system under test and which no builder repairs, and `docs/how-to/evaluate-workflow-behavior.md:216-219` publishes the chain in it as the proof of the temporal half, naming its plan, its pointer and its defect rate. Four sentences there describe one chain in one directory, and a second chain's bytes landing under that root makes each of them read against a directory holding two. So new chains live at `_bmad-output/worked-examples/<name>/`, this one at `_bmad-output/worked-examples/skill-defect/`, which is outside `check:docs`' five roots (`scripts/check-docs.mjs:9-14`) and outside `check:boundary`'s and `check:corpus`' scans. The spike chain does not move, for the same four sentences.

*The scripts.* A new `generate:` and `check:` pair would add a step to `validate` for a chain the existing pair already knows how to build and compare, so `generate:worked-example` emits it and `check:worked-example` compares it. `buildWorkedExample` becomes the union of the builders' maps and the generator creates each key's own parent directory, which is the whole cost of a third chain later.

*The modules.* One target file per chain. `scripts/worked-example-target.ts` keeps the spike chain and learns nothing about a second; `scripts/skill-example-target.ts` is this one's. What more than one chain needs moves to `scripts/worked-example-shared.ts`: `renderJson`, `digestPlaceholder`, `fail` and `POLICY`. Exporting those from `worked-example-target.ts` was the smaller diff and would leave the spike chain's module as an unnamed shared dependency of a sibling, so that a change made for the spike chain would reach every other chain through a file that says it belongs to one.

Downstream consequence: Story 11.11 adds a third target file and a third label to this shape rather than a second chain inside anyone's module, and `corpus/dev/README.md`'s "the qualified-probe dimensions are absent" stays true with case 163's four absence patterns matching, both asserted here with a run.

**Decision 6: this story moves the inherited counts a second time and the command-contract count for the first, and the composition is written out so no numeral is claimed twice.**
Story 11.8 moves the corpus from 21 contracts to 22 for the `mcp` exemplar. The dev-corpus README template carries six spelled-out numeral words on four lines, `scripts/dev-corpus-target.ts:65`, `:108`, `:114` with two words and `:115` with two; Story 11.8 moves four of the six and leaves `:115`'s "two" alone, because its exemplar declares `mcp` and the command-contract count is not its to move. This story moves five of the six, the four again plus that one, and the two sets of edits are disjoint per word:

| Site | 1.4.2 | after Story 11.8 | after this story |
| --- | --- | --- | --- |
| corpus contracts in `DEV_CORPUS_CONTRACTS` | 21 | 22 | 23 |
| `index.json` entries / of kind `contract` | 24 / 22 | 25 / 23 | 26 / 24 |
| declaring `api` / `cli` / `mcp` / no interface | 18 / 2 / 0 / 1 | 18 / 2 / 1 / 1 | 18 / 3 / 1 / 1 |
| compiling / failing by design | 18 / 3 | 19 / 3 | 20 / 3 |
| `dev-corpus-target.ts:65,108,114` total | twenty-one | twenty-two | twenty-three |
| `:114` "Nineteen are one per discipline rule" | Nineteen | Nineteen | Nineteen |
| `:115` "two describe a system ... behind a command" | two | two | three |
| `:115` compiling count | Eighteen | Nineteen | Twenty |
| `:117` "Three fail compilation by design" | Three | Three | Three |
| `evaluate-agent-behavior.md:294` contracts behind a command | two | two | three |

Story 11.8 owns the corpus total and the compiling count on their first move and this story owns their second; the command-contract count at `:115` and at `evaluate-agent-behavior.md:294` is untouched by 11.8 and moves once, here. The discipline-rule count and the failing-by-design count move in neither story. Downstream consequence: Story 11.11 adds one compiling `api` contract and owns the third move of the total and the compiling count and the only move of the `api`-declaring count, taking the corpus to 24 with `index.json` at 27 entries and 25 of kind `contract`, `api` 19 / `cli` 3 / `mcp` 1 / none 1, and 21 compiling against 3 failing by design. That is the epic's final composition, and it starts from this table's last column.

**Decision 7: this story owns the skill row and the skill guide's standing section, and hands everything else to Story 11.9 by name.**
The split follows Story 11.8's rule, by cause. A sentence this story's own run falsifies moves in this diff: `docs/index.md:77`'s skill cell, `docs/how-to/evaluate-skill-behavior.md:229-239`, the narrowing at `:41-43`, the two "one chain" sentences at `docs/how-to/author-behavioral-contracts.md:237` and `README.md:240`, and the counts in Decision 6. Everything else on those pages is checked and left, with the reason recorded: `docs/index.md:72`, `:76`, `:78`, `:79`, `:80`, `:82` and `:84` describe compilation and the other four shapes, which this story does not touch; `docs/how-to/evaluate-skill-behavior.md:3`'s page description and `:241-254`'s "In BMAD terms" describe TEA's own repository and are read from there; `docs/how-to/evaluate-agent-behavior.md:78` is the instruction this chain follows and stays as written; `docs/how-to/author-behavioral-contracts.md:233` is correct about the command and Decision 3 checks this story's framing against it. Downstream consequence: Story 11.9 arrives with the skill row already true, and the cross-cutting five-shape prose is the only part of the index it still owns.

**Decision 8: this story moves the committed-chain count from the singular to two, and Story 11.11 moves it from two to three.**
Two stories in this epic add a generated end-to-end chain. This one adds the skill chain at `_bmad-output/worked-examples/skill-defect/`, and Story 11.11 adds a workflow chain at `_bmad-output/worked-examples/workflow-capture/`. Execution order puts this story first, so the sentences that today say "one" are rewritten here to say two, and Story 11.11 changes the number it finds. Neither story predicts the other's value: each reads the committed state at the moment it runs and writes what it finds, which is the same rule Decision 6 applies to the corpus numerals. The three sites are `docs/how-to/author-behavioral-contracts.md:237`, `README.md:240`'s first table cell, and the corpus README template's second absence paragraph at `scripts/dev-corpus-target.ts:137-144`. Two constraints are shared and are written here so whoever implements second inherits them: the corpus README is generated, so both edits land in the template and `corpus/dev/README.md` is never touched by hand; and case 163's third pattern at `tests/architecture/dev-corpus.test.ts:280-283` matches across line breaks over that paragraph and has to keep matching after both rewrites. This story writes the sentences so Story 11.11's edit is a numeral swap. Downstream consequence: `npm run check:corpus` and `tests/architecture/dev-corpus.test.ts` both fail for Story 11.11 until it regenerates the corpus README, which is the signal that tells it the paragraph is its to move.

**Decision 9: the chain computes its pre-flight verdict through `preflightFromObservations`.**
The spike chain hand-authors its verdict: `scripts/worked-example-target.ts` calls `compile` at `:1193`, `seal` at `:1194`, `sealProbeSet` at `:1222` and `score` at `:1289`, and parses an authored `PreflightVerdict` at `:1211` from the literal at `:1147-1155`, so it never calls a pre-flight stage at all. A chain that claims to run end to end while leaving a shipped stage unrun claims more than it holds, and a hand-authored verdict would prove no more than the pre-flight suite already proves in memory. This contract has a sensitivity witness and therefore control legs, so there is a real plan to observe. The chain authors one `ProbeObservation` per planned leg and calls `preflightFromObservations` (`src/application/preflight.ts:158-197`), and the verdict it emits is that stage's own return value: the reducer decides each check, and `score` reads `passed` and `fixtureDigest` off the result rather than off a literal. The option turned down is copying the spike chain's authored verdict, which is the smaller diff and would leave the story's own "runs end to end" claim resting on a value nobody computed. Downstream consequence: `preflight-verdict.json` is a sixth file where the spike chain has five, Story 11.11 inherits the same construction for its four control legs, and a later story wanting a derived verdict for the spike chain has it written here.

**Decision 10: the replacement State cell, drafted here so the claim is reviewed before the run exists.**
`docs/index.md:77` reads "Gameability proven across eight contracts. No seeded-defect instance yet." It becomes:

> Proven. A seeded defect is caught and scored against a shipped skill contract, on a chain regenerated and byte-checked every build, one trial, marked non-comparable.

Three things are deliberate. It says "shipped" because the scored contract is the corpus contract an adopter can open, which Decision 4's digest is what proves. It carries the one-trial non-comparable limit, which is the limit Decision 3 records as surviving this story and which the cell has to carry so a reader who never opens the guide still meets it. It drops the gameability sentence rather than keeping it beside the new one, because the guide's "Where this stands" section carries the gameability numbers and the routing table's job is one verdict per row. The written-file limit stays out of the cell: it is a constraint on which skills can carry a signature at all, and `docs/how-to/evaluate-skill-behavior.md:41-43` and `:229-239` are where it belongs. Downstream consequence: Story 11.9 finds this row already unqualified and owns only the framing prose around the table.

**Decision 11: the seeded defect declares a manifestation witness, which the frozen block never named and pre-flight requires.**
Decision 9 commits the chain to computing its verdict through `preflightFromObservations`, and the I/O matrix expects `passed: true`. Neither says anything about `Probe.defects[].manifestationWitness`, and the spike chain this story models leaves it `null`. Against the reducer as the tree carries it, `null` is fatal: `reducePreflight`'s `seeded-fault-fired` arm returns `failed` with the note "the defect declares no manifestation witness, so it cannot be observed to fire", `passed` is `checks.every(outcome !== 'failed')`, and the chain would abort at its own guard. So the defect declares one, `skill-defect-leg` against `run-skill` on `skill-runner`, whose relation is the signature's discriminating half rooted at that leg instead of at the reserved observation identifier. That gives pre-flight two questions it can answer separately: `seeded-fault-fired` asks whether the relation fires on the fault leg, and `seeded-faults-scoped` asks whether it stays quiet on every clean leg of the same operation. Both come back satisfied. Downstream consequence: Story 11.11's chain inherits the same requirement, and a chain whose defect declares no witness cannot pass a pre-flight it actually runs.

**Decision 12: the interaction plan binds the prompt by literal, because the record carries two runs of one operation.**
The Design Notes spell the probe's selector as `option: { skill: { literal: ... } }, stdin: { prompt: { matcher: 'any' } }`, and the chain ships that selector unchanged. The contract's own interaction step is a different question the frozen block does not settle. A step binding `stdin.prompt` with a matcher selects every observation of `run-skill`, and `selectWithBindings` returns `several` under `cardinality: 'exactly-one'`, which `score` reads as `selectorAmbiguity` and `resolveOutcome` turns into `infrastructure-error` on a row that outranks `witness-matched`. The step therefore binds the frontend prompt by literal.

What that buys is the reason it is worth writing down rather than collapsing the record to one observation. The evaluator exercises the operation on both cases the sensitivity witness declares. The backend run behaves, the probe's selector admits it, and the condition resolves `false` over it, so the witness partition comes back `satisfying: ['obs-002'], refuting: ['obs-001'], inconclusive: []`. A partition holding only satisfying members is equally consistent with a condition true of every candidate the selector admits, and this one is not. Downstream consequence: a chain with one observation on its home operation proves the condition fires and proves nothing about whether it discriminates, and Story 11.11 inherits the same shape.

**Decision 13: `buildWorkedExample` is a registry at the foot of `worked-example-target.ts`, and the spike chain's own builder is `buildSpikeExample`.**
Decision 5 says two things that read as a conflict once the code exists: `buildWorkedExample` becomes the union of the builders' maps, and `worked-example-target.ts` keeps the spike chain and never learns about a second. Three placements were available. A union inside `worked-example-shared.ts` is circular, because both target modules import it. A new module holding nothing but the union is a fourth file for eight lines. Exporting each builder and merging the two maps at both call sites duplicates the merge and puts the collision check in two places.

So the union stays where the Code Map put it, as the last function in `worked-example-target.ts`, with a docblock saying it is the registry and that everything above it is the spike chain. The spike chain's own map is `buildSpikeExample`, exported so `tests/score/worked-example.test.ts` keeps asserting the five keys that belong to it. The registry fails the build when two chains emit one path, since the drift check iterates the union and would report the loser as missing rather than as overwritten. Downstream consequence: Story 11.11 adds one target module and one entry to the list in that function, and `tests/score/worked-example.test.ts` carries the assertion that the union is exactly what the builders emit, so a chain dropped from the registry reddens there.

**Decision 14: the reproducible hash needs the file's trailing newline stripped, and the frozen block's command does not do that.**
The I/O matrix and the Verification section both give `shasum -a 256 corpus/dev/contracts/<contractId>.json` and expect the hex half to equal the chain's `contractDigest`. It does not, and the reason is one byte. `serializeArtifact` returns `canonicalize` output plus a trailing newline and its own docblock says so; `digestArtifact` hashes `canonicalize` output. The corpus writes `serializeArtifact` output to disk, so the file carries a byte the digest does not cover.

The property Decision 4 claims holds, and the command that demonstrates it is `printf '%s' "$(cat corpus/dev/contracts/checklist-selection.json)" | shasum -a 256`, which returns `db47672fee36bd18d5b7d42ac24cc11dc3d5c46ed0a7be86617676f2ebb9841c`, the hex half of the `contractDigest` in the chain's `sealed-run-record.json`. Hashing the file as written returns `4395b261...`, which is the value `corpus/dev/index.json` records for that entry, so both numbers are real and they answer different questions. The published prose says which one to compute, and `tests/score/skill-worked-example.test.ts` asserts the stripped form against the record's digest so the claim is held by a test rather than by a sentence. Downstream consequence: Story 11.11's chain inherits the same one-byte trap if it imports a corpus fixture.

**Decision 15: five statements in the frozen block were stale or off by a line when this story ran, and each is recorded here rather than edited.**
The block was written against 1.4.2 and Story 11.8 landed between. None of the five changed what this story had to do.

1. The gate. The Code Map describes `check:doc-counts` as "fourteen numerals across those seven pages". Story 11.8's peer review took it to twenty-three numerals across nine files, `corpus/dev/README.md` and `scripts/dev-corpus-target.ts` among them. That is a help rather than a divergence in substance: the gate named every stale word this story owed, including the two in the corpus README template that no earlier draft of this story listed.
2. The README template's numeral sites. The Code Map gives `scripts/dev-corpus-target.ts:65,108,114,115` and says `:115` carries the compiling count. In the tree this story met, the compiling count is at `:119` ("The other nineteen are published only after") and `:115` carries the `cli` count alone. Five words moved and the two the story reserves, the discipline-rule count and the failing-by-design count, stayed.
3. `docs/how-to/evaluate-agent-behavior.md:294` is `:295`.
4. `docs/how-to/evaluate-ai-feature-behavior.md:234` is `:243`, and the `api`-declaring count on that line did not move: the exemplar declares `cli`, so `Eighteen` stands and only the total moved.
5. Every line number the Code Map gives inside `scripts/worked-example-target.ts` moved when the shared module was extracted. `POLICY`, `renderJson`, `digestPlaceholder` and `fail` are in `scripts/worked-example-shared.ts` now, which is what the story's own task asked for.

**Decision 16: the guide's fence spells the witness legs' stdin as text and the corpus contract spells it as a declared key, and the fence is left alone.**
`docs/how-to/evaluate-skill-behavior.md:97-98` gives each sensitivity leg `"stdin": { "kind": "text", "value": "..." }`. Both spellings parse and both compile clean under `{ strict: true }`, checked. The exemplar takes the keyed form, `{ kind: 'json', value: { prompt } }`, following `commandContract`'s shipped precedent, because `callInputsOf` records a JSON stdin as a call input and drops a text one: with the text form the chain's own selector on `stdin.prompt` would have nothing to match on a pre-flight leg. The fence stays as written, since nothing this story's run does makes it false. Downstream consequence: an author copying the guide's fence gets a contract that compiles and a witness leg whose inputs are invisible to a selector, which is worth a sentence on that page the day someone needs it.

## Checkpoint decisions taken without the human

- **All four Ask First items were declined, which is what the story predicted.** The diff under `src/` is empty. No `schemaVersion` moved. No policy carrying `minimumTrialCount: 1` was authored; the chain is scored under the published default at 3 and reports the shortfall. `docs/how-to/evaluate-skill-behavior.md`'s "In BMAD terms" section is unedited.
- **The learning-path step is 55.** Main ended at Step 54 when this story rebased. A sibling session working the epic's tail has 55 written on its own branch and unmerged, so whichever branch merges second renumbers; this one re-checks the committed file immediately before merging.
- **The chain's own test asserts a value-level property the story's task list did not name:** that `preflightVerdict.fixtureDigest` equals the fixture digest on the emitted artifact. That is the one link between the pre-flight half and the scoring half, and without it a chain could compute a verdict and score under a different one.

## Review Findings

`/bmad-code-review` in a peer session over `git diff b0ea14d..HEAD`, in two rounds. Round one at
1a415e7: one blocking finding, twelve non-blocking. Round two at a82862d: one blocking, five
non-blocking, and two of those five were round one's own fixes going wrong. Every finding is
addressed in this pass. The review ran its mutations in a detached worktree after the first round
collided with this session's uncommitted edits in the shared one.

**The blocking finding, both times, was the same assertion.** Round one: the chain test asserted
O-001's state and check resolution, and O-002's disposition, and no oracle's `corroboration`.
Flipping O-001's authored disposition from `held` to `violated` left all 94 tests green while the
emitted artifact carried `corroboration: 'disagrees'`; only `check:worked-example` reddened, and only
on bytes. Cutting obs-002's selection to `['timing-rules', 'mobile-rules']` reddened the resolution
line and left the state line green, because `confirmed` is the outcome table's catch-all row.

The first fix was wrong in an instructive way and the second round caught it. It pinned the authored
disposition on both oracles and dropped `corroboration`, on the premise that `corroboration` is a
function of the disposition and the resolution and therefore unmovable once both are pinned. The
premise is false. `CORROBORATION_RULES` is eight rows and the first three read neither field: one
fires when a disposition of `held` or `violated` cites no observation at all, one reads whether a
defect finding cites the oracle, one reads that finding's bucket. Emptying either disposition's
`observationIds` leaves `state`, `disposition` and `checkResolution` all unchanged and moves
`corroboration` alone, and with `corroboration` dropped that mutation passed the entire suite. So the
chain could ship a run record whose oracle disposition cites nothing, and only a byte check would
notice.

What ships is four fields per oracle: `state`, `checkResolution.resolution`, `disposition` and
`corroboration`. Four of the eight lines are the sole catcher of a named mutation, measured: both
`corroboration` lines catch an emptied citation, O-001's `disposition` catches a flip to
`not-attempted`, and O-001's `state` catches the probe repointed at the other behaviour. The other
four are not, because `corroboration` is derived partly from the two lines beside it, so a flipped
disposition or a differently-read reply moves a pair together and whichever line comes first is the
one that reds.

The asymmetry between the two oracles has a cause worth recording. No defect finding cites O-001, so
its `corroboration` is `agrees` exactly when its check is satisfied; F-001 and F-002 both cite O-002,
so its disposition and its resolution each move its `corroboration` too. That is a fact about this
chain's finding set rather than about the fields.

Two claims about these lines were wrong before this one. Round one recorded O-001's `state` as the
sole catcher of nothing, which the `behaviorId` mutation disproves. The first re-verify fix recorded
all eight lines as sole catchers, which was wrong the day it landed for three of them. Both are
recorded here rather than quietly corrected, because an exclusivity claim over eight assertions is a
joint property of `CORROBORATION_RULES`, the outcome table and this chain's finding set, nothing
makes it fail when it stops being true, and this file is the third place it has had to be re-measured
in one pass.

**Three assertions removed because they could not fail**, and re-verified as safe. `witness.basis`
and `strength.basis` are each typed to one literal with one producer. `witnessObservationIds` and
`unwitnessedFindingIds` are both entailed by `result: 'matched'` over a pinned partition, and a
non-empty `unwitnessedFindingIds` forces a different result and aborts the build. The second
registry case in `tests/score/worked-example.test.ts` went the same way: the registry copies each
builder's entries and fails on a collision, so a value can only differ by a missing key.

**Two assertions kept although they duplicate a builder guard**, `preflightVerdict.passed` and
`witness.result`, each with a comment saying so.

**Two dead guards deleted, and one deleted then restored.** The null-signature guard ahead of
`matchProbeWitness` is genuinely dead: `sealProbeSet` refuses it first under `signature-absent`. The
`leg.request.kind !== 'cli'` guard in the observation walk is unreachable while the contract declares
one `cli` interface, and a second interface of another kind makes `reducePreflight` throw
`port-contract-violation` naming both kinds, which says more than the guard could. The
`expectedClean` guard was deleted on the same reasoning and put back, because the reasoning was
wrong: `Probe` parses all eight class-and-`expectedClean` pairings on purpose, and of the four
classes declared clean only three are rejected under `qualification-route-incompatible`. A
`zero-action` clean control is admitted with `declarationChecksRan` true, reaches
`matchProbeWitness`, and throws `TypeError: Cannot read properties of undefined (reading
'interfaceKind')` out of `src/`, because `defectSignature` is not a key on that branch. Reproduced
here directly against `sealProbeSet` before restoring the guard.

**Six prose corrections.** The widened sentence at `docs/how-to/evaluate-skill-behavior.md:43` said
"either kind" over a refusal that reads no class at all; the first correction said "every one of the
four", which names a number the page never enumerates, and it reads "every probe class" now. A
voice-pass hit survived at `:240` and lost its rejected half. `docs/index.md:77` and the guide's
standing section both now say the chain's observations are authored, because the two rows beside the
skill row read "in a real corpus" and "a real probe observes a seeded defect over HTTP" and the
column's frame made the unqualified sentence read as a live run. The sentence this story added to the
corpus README's "What is here" bullet said "the committed end-to-end chain" in the same generated
file whose absence paragraph says two are committed; it reads "one of the two committed end-to-end
chains" now, so Story 11.11 swaps a numeral there as well. And
`docs/how-to/author-behavioral-contracts.md` invited a reader to point `CHAIN` at the second chain and
read the same values: three of the four readers do, and the observation reader does not, because it
prints an HTTP request body and response body a command-shaped chain does not carry. The invitation
says which.

**One correction to this file.** The corpus composition this story returned is the last column of
Decision 6's table, not the middle one.

**A dead assertion outside this story's diff, fixed here.** `tests/architecture/dev-corpus.test.ts`
case 163's first pattern was a strict prefix of its second, so no README could falsify it while
satisfying that one and it certified nothing across two epics. It is anchored on the paragraph's own
bold heading now. The review then ran six mutations over the generated README and confirmed all four
patterns are independently falsifiable, and that neither the wrap nor the paragraph order is
load-bearing: splitting the paragraph after the heading and swapping the two absence paragraphs both
still match all four.

**One finding found and routed rather than fixed here.** `SealedRunRecord.invalidReason` has no
reader anywhere in `src/`: it appears once, in its own schema declaration. The review set it to a
non-null string on this chain's record and the run still scored `trials.completed: 1`,
`invalidatedAttempts: []` and a measured defect rate of 1, with the whole suite green. So the record
carries a working invalidation mechanism the caller cannot reach, `invalidatedAttempts` computed
internally from vote states, beside a caller-facing field that does nothing. Wiring it is a `src/`
change this story's Boundaries make Ask First, with its own AD-21 rung question and its own reject
cases. The ruling was to keep it out of this diff and hand it to the session clearing the epic's
leftovers, on its own branch and its own pull request, rather than to record it unowned or to hand it
forward to a story that did not plan for it. Nothing was added to `deferred-work.md`.

**What the review confirmed rather than found.** No reachable silent vacuum under AD-4's
empty-collection rule: an emptied selection on obs-002 sends the condition to
`insufficient-evidence` and the witness to `unwitnessed-claim`, and an emptied sensitivity leg fails
`input-sensitivity`, so both abort the build. The one shape that slips every guard is obs-001 coming
back empty, which moves it from `refuting` to `inconclusive`, and the partition assertion is its sole
catcher. The pre-flight walk reads both minted control identifiers off `plan.legs`;
`seeded-faults-scoped` examines all four clean legs and drops none, because the fault leg's request
carries a different prompt. Decisions 11 through 16 were each checked against the tree, both digests
in Decision 14 reproduced, and both stdin spellings in Decision 16 confirmed to compile clean under
`{ strict: true }`. Read as a whole, the five surfaces that describe this chain, the index row, the
guide, the corpus README, the authoring guide and the changelog, all say its inputs are authored.

## Design Notes

The organising idea is Story 8.5's, pointed at a different kind: a chain that calls the shipped stages is evidence, and a claim without one is an assertion. The skill shape's claim has been half evidence and half assertion since the gameability probe landed. The gameability half runs in TEA and its numbers are published; the seeded-defect half has a schema, a gate that admits it, a fixture that passes the gate, and no artifact anywhere carrying the result. This story turns the last of those into a file.

The seeded defect is the exclusion oracle's own negation, which is what makes the pair coherent. The oracle at `docs/how-to/evaluate-skill-behavior.md:138-166` says no item the rules exclude may appear in the selection. The signature says one did:

```json
{
  "interfaceKind": "cli",
  "invocation": { "executable": "skill-runner", "subcommandPath": [] },
  "observableChannel": "stdout",
  "condition": {
    "selector": { "inputBinding": { "option": { "skill": { "literal": "checklist-selection" } }, "stdin": { "prompt": { "matcher": "any" } } } },
    "predicate": { "op": "all", "operands": [
      { "op": "equality", "operands": [{ "pointer": "/interactions/observed/exit-code" }, { "literal": 0 }] },
      { "op": "for-any", "collection": { "pointer": "/interactions/observed/stdout/selected" },
        "predicate": { "op": "set-membership", "operands": [{ "pointer": "@/" }, { "literal": ["<the excluded items>"] }] } }
    ] }
  }
}
```

`ProbeInputBinding` (`src/core/schemas/defect-signature.ts:86-95`) is a strict object over all eight input channels, so the six the selector binds nothing in are elided above and each carries a required `null`. The `exit-code` conjunct is what separates the seeded defect from a crash: a run that exits non-zero told the truth about failing, and the defect this probe seeds is a clean exit carrying a wrong selection.

The invocation above is spelled exactly as the contract's operation spells it, which is the guide's own spelling at `docs/how-to/evaluate-skill-behavior.md:64`: executable `skill-runner`, `subcommandPath` empty. That agreement is load-bearing. `commandSignature` (`src/core/compile/interface-inventory.ts:81-91`) joins the executable and the subcommand path into one string, and `resolveHomeOperation` matches the signature's rendering against each operation's. A `subcommandPath` of `["run"]` on one side and `[]` on the other renders two strings, `resolveHomeOperation` returns `null`, `homeOperationOf` hands `sealProbeSet` nothing, `declarationChecksRan` comes out `false`, and this story's own acceptance criterion on that field fails. One spelling in both places is what keeps it true.

## Verification

**Commands:**

- `npm run generate:dev-corpus && npm run check:corpus` -- expected: exit 0, zero orphans, zero drift, 26 index entries with 24 of kind `contract`.
- `npm run generate:worked-example && npm run check:worked-example` -- expected: exit 0 over both chains, with every spike-chain byte unchanged.
- `node -e "const a=require('./_bmad-output/worked-examples/skill-defect/evidence-artifact.json');console.log(JSON.stringify(a.strength,null,2),a.exitCode,a.verdictBasis)"` -- expected: `vector.defect` `{ exercised: 1, caught: 1, rate: 1 }`, `comparable` false, and the note naming the declared minimum. Every value is transcribed into this file.
- `node -e "const v=require('./_bmad-output/worked-examples/skill-defect/preflight-verdict.json');console.log(v.passed, v.checks.map(c=>[c.kind,c.state]))"` -- expected: `true`, and every planned check in a resolved state, all of it computed by `preflightFromObservations`.
- `shasum -a 256 corpus/dev/contracts/<contractId>.json` -- expected: the hex half equals the `contractDigest` in the chain's `sealed-run-record.json`.
- `npm run check:ad31-table && npm run check:ad21-table && npm run check:ad33-table` -- expected: exit 0 with no regeneration for any of the three.
- `npm run check:boundary` -- expected: exit 0, with the published skill contract among the scanned `corpus/` entries.
- `npm run check:doc-counts` -- expected: non-zero before the edits, naming each stale word; exit 0 after, across all fourteen entries on all seven pages. Flip one numeral by hand and expect a non-zero exit naming the file, the line, the word carried and the word owed.
- `npx vitest run tests/score/skill-worked-example.test.ts` -- expected: green, including the assertion that `commandSignature` over the contract's operation equals `commandSignature` over the defect signature's invocation, and that `sealProbeSet` reported `declarationChecksRan: true`.
- `npm run check:docs && npm run check:doc-invocations` -- expected: exit 0, with every page's invocation judged exactly as it was before this story, since no fenced command changes.
- `npm run build:shareable && npm run check:shareable` -- expected: exit 0 after regenerating the `README.md` projection.
- `npm run test:coverage` -- expected: exit 0, with the third command-coverage grading case and the new chain test green.
- `grep -nE ', not |rather than|instead of|as opposed to|, never |no longer' <every edited file>` -- expected: every hit is a before/after contrast whose two halves each carry a fact, checked by reading each one.
- `npm run validate` -- expected: exit 0 with nothing on stderr, at the same step count Story 11.8 left.

**Manual checks:**

- `corpus/dev/README.md`'s four absence patterns still match `tests/architecture/dev-corpus.test.ts:271-288`, read after regeneration.
- `docs/index.md:77` and `docs/how-to/evaluate-skill-behavior.md:229-239` read together claim no more than the emitted artifact carries.
- `git diff CHANGELOG.md` touches nothing below `[Unreleased]`, since `release:prepare` owns the dated sections.
- `git status` over `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/spike-worked-example/` reports no change, which is what the four sentences at `docs/how-to/evaluate-workflow-behavior.md:216-219` need.

## What the run returned

Every value below is transcribed from a run of this branch, not predicted.

**The probe qualified.** `sealProbeSet` over `[P-001]` returned one admitted entry and an empty
rejected list, with `declarationChecksRan: true`, which the builder asserts and fails the build on.
`commandSignature` over the signature's invocation and over the contract's operation render the same
string, so `resolveHomeOperation` returns the operation.

**The pre-flight verdict, computed by `preflightFromObservations`.** `passed: true` over six checks,
each satisfied: `interface-present`, `input-sensitivity`, `state-reset`, `clean-control`,
`seeded-faults-scoped`, `seeded-fault-fired`. Five legs were planned and five observations authored,
one per leg: the two sensitivity legs, the two minted `preflight-control-observe` legs, and
`skill-defect-leg`. The observations are built by walking `planPreflight`'s own leg list, so the two
minted identifiers are read rather than transcribed.

**The witness match.** `matched`, basis `measured`, `homeOperationResolved: true`, partition
`{ satisfying: ['obs-002'], refuting: ['obs-001'], inconclusive: [] }`, `witnessObservationIds:
['obs-002']`, `unwitnessedFindingIds: []`.

**The two oracles.** `O-001` resolved `confirmed` with `checkResolution.resolution: 'true'` and
disposition `held`. `O-002` resolved `caught` with `checkResolution.resolution: 'false'` and
disposition `violated`. The same reply satisfies the inclusion half and violates the exclusion half,
which is the pair working.

**The strength vector.** `strength.vector.defect` is `{ caught: 1, exercised: 1, rate: 1 }`.
`gameability` and `zero-action` are both `null`. `strength.basis` is `measured`.
`strength.comparable` is `false` and `strength.note` reads "1 admitted probe over 1 completed trial.
Below the declared minimum of 3. The vector is reported and marked non-comparable."

**The ladder.** `contractVerdict: 'CONCERNS'` at `exitCode: 0`, on three bases:

```text
coverage gap malformed-input unsatisfied at or above the severity floor
coverage gap sibling-cross-check unsatisfied at or above the severity floor
1 completed trials below the declared minimum of 3
```

**The corpus.** `generate:dev-corpus` then `check:corpus`: 27 committed corpus files matching byte
for byte, zero orphans. `index.json` carries 26 entries, 24 of kind `contract`, and 3 of those carry
a `structuralFailure`, so the pin at `tests/architecture/dev-corpus.test.ts` is unmoved. The
composition is 18 declaring `api`, 3 declaring `cli`, 1 declaring `mcp`, and 1 declaring none, which
is the last column of Decision 6's table.

**The digest.** `printf '%s' "$(cat corpus/dev/contracts/checklist-selection.json)" | shasum -a 256`
returns `db47672fee36bd18d5b7d42ac24cc11dc3d5c46ed0a7be86617676f2ebb9841c`, and the chain's
`sealed-run-record.json` carries `contractDigest`
`sha256:db47672fee36bd18d5b7d42ac24cc11dc3d5c46ed0a7be86617676f2ebb9841c`. See Decision 14 for why the
frozen block's own spelling of that command is off by one byte.

**The chains.** `check:worked-example` reports 11 committed files across both roots matching byte for
byte, and `git status` over the spike directory reports no change, so the shared-module extraction
moved no spike byte.

**The count gate.** `check:doc-counts` exits 0: "23 numerals across 9 files agree with their source,
plus 6 per-port conformance counts". Before the edits it exited 1 naming 14 stale words across 8
files, each with the word carried and the word owed.

**The AD tables.** `check:ad31-table`, `check:ad21-table` and `check:ad33-table` all exit 0 with no
regeneration, so no coverage cell, ladder row or outcome cell moved.

**The gate.** `npm run validate` exits 0. 127 test files, 4148 tests, statements 97.09%, branches
92.32%, functions 99.9%, lines 98.29%. The step count is what Story 11.8 left; this story adds no
`check:` script.
