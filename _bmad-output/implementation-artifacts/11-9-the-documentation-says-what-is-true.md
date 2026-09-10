---
title: 'The documentation says what is true'
type: 'chore'
created: '2026-09-09'
status: 'draft'
review_loop_iteration: 0
context:
  - _bmad-output/implementation-artifacts/epic-11-context.md
  - _bmad-output/implementation-artifacts/11-2-the-check-that-would-catch-a-stale-tool-use-claim.md
  - _bmad-output/implementation-artifacts/11-8-the-published-surface-the-corpus-and-the-census.md
  - _bmad-output/implementation-artifacts/11-10-a-seeded-defect-scored-against-a-skill-contract.md
  - _bmad-output/implementation-artifacts/11-11-a-shipped-workflow-contract-with-a-captured-binding-and-a-fixture-reset.md
  - _bmad-output/implementation-artifacts/11-12-an-end-to-end-run-against-a-service-the-suite-starts.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Every earlier story in this epic corrects the sentences its own change makes false. Three things survive that split. First, `docs/index.md:70-84` describes the product's shape rather than any one story's change: the framing sentence at `:72` reads "Two interface kinds compile today, `api` and `cli`", the routing table at `:74-80` gives the tool-use row the verdict "Declared and refused at compile" at `:80`, and the paragraph at `:84` reads "Two kinds parse and stop at compilation under `unsupported-interface-kind`". The three State cells at `:77`, `:78` and `:79` sit inside that block and belong to the evidence stories that remove their qualifiers. Second, `docs/how-to/evaluate-tool-use-behavior.md` is 254 lines written as an inventory of what a first adopter would have to build, down to its own frontmatter description at `:3`, and no sentence fix converts it into a guide someone can follow. Third, nothing proves the epic finished. Sites across the published files, plus description and comment strings under `src/core/schemas/`, enumerate interface kinds or count adapters, arms, corpus contracts, and outcomes. The Code Map's tables are the enumeration; a count restated here goes stale every time a row is added, which it already had. A hit no earlier story claimed is a hit that ships stale, exactly as `docs/how-to/evaluate-tool-use-behavior.md:63` shipped a transcription of a module-private literal that nothing checked.

**Approach:** Rewrite the cross-cutting prose and re-author the tool-use guide, then run the sweep as the epic's closing check: every enumeration and count in `docs/`, `README.md`, and the published `.describe()` strings is read, attributed to the story that should already have fixed it, and confirmed fixed or claimed here. The acceptance is a grep, so a command's output is what settles the claim. Story 11.2's armed doc-invocation gate is what makes the tool-use guide's own commands provable, since the page is an executed input to `npm run validate`.

## Boundaries & Constraints

**Always:**

- Every proposed sentence is written to the standing de-AI rule for published pages here: plain, direct, no filler, no marketing register, no em dash or spaced hyphen joining clauses, and no clause that exists only to be rejected.
- Every number is read off the artifact it describes at the time the sentence is written. The corpus count comes from `corpus/dev/index.json`, the adapter list from `src/adapters/index.ts:12-21`, the arm list and the outcome counts from `CONFORMANCE_OUTCOME_COUNTS` at `src/testing/conformance.ts:40`, and the api-contract share from the corpus itself. Every count Story 11.8's `check:doc-counts` covers is read from that gate's own source of truth, so the sweep and the gate agree by construction.
- The sweep is attributive. Each hit in the Code Map carries the story that owns it, and the execution pass records `fixed by <story>` or `claimed here` against every row. A row that reads neither is the finding this story exists to produce.
- A published `.describe()` string is shipped prose. If the sweep finds one that no earlier story corrected, this story corrects it and inherits the consequence: `npm run generate:schemas`, `npm run check:schemas`, and the `CENSUS_BY_KEYWORD` and `CENSUS_TOTAL` move that `tests/schemas/published-census.ts` documents its own procedure for. That inheritance is recorded here in the open.
- `docs/how-to/evaluate-tool-use-behavior.md` keeps its filename and its `sidebar.order: 6`. `website/astro.config.mjs:19-45` declares `site`, `base`, `outDir`, `image`, `vite`, and `markdown` and no `redirects` key, so a rename has nothing to catch the old URL.
- The heredoc contract fence and the declared exit code on the tool-use guide belong to Stories 11.2, 11.4, and 11.5. This story reads what they left and writes the prose against it.

**Ask First:**

- A new page, a renamed page, or a deleted page. The sidebar autogenerates from directory plus `sidebar.order` (`website/astro.config.mjs:118-143`), so the navigation cost is zero while the link cost is real.
- Any change to `scripts/check-docs.mjs`'s `ROOTS`. Widening it to `docs/` is a repository-wide gate change that would fail on unrelated files and belongs to whoever wants that gate.

**Never:**

- No behaviour change under `src/`. No schema shape moves, no failure code is minted, no union branch is added or removed, and no check changes what it accepts. Anything this story finds that needs one is a finding against the story that shipped the behaviour.
- No generated file is hand-edited. `docs/ad21-verdict-decision.generated.md`, `docs/ad31-coverage-predicates.generated.md`, `docs/ad33-outcome-decision.generated.md`, and `corpus/dev/README.md` come from their generators.
- No claim that a shape is proven beyond what an artifact in the tree shows. Stories 11.10, 11.11 and 11.12 each ship the artifact that removes their own qualifier and each drafts its own replacement State cell; this story reads those artifacts and asserts the cells, and a cell whose artifact is weaker than the cell claims is a finding against that story.
- No State cell in `docs/index.md:76-79` written here. Those four rows belong to their guides: `:76` is unchanged, `:77` is Story 11.10's, `:78` is Story 11.11's, and `:79` is Story 11.12's.
- No spine revision and no new ADR.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| `grep -rn 'unsupported-interface-kind' docs/ README.md` | The finished documentation | Every hit sits in a sentence naming `web` and no other kind | A hit naming `mcp` as refused fails the story |
| `grep -rn 'refused at compile' docs/ README.md` | The same | Zero hits | Any hit fails the story |
| `npm run check:doc-invocations` | The rewritten tool-use guide | The `compile` invocation at `:137-139` is reported FAITHFUL against its declared exit code. The `preflight` and `score` fences stay UNFAITHFUL with the usage-error judgment only, per Story 11.2's Decision 4 | An invocation naming a file the page did not create keeps the usage-error judgment only, and declaring `expect-exit` on it fails (`scripts/check-doc-invocations.mjs:420`) |
| The sweep table | Each of its rows after execution | Every row reads `fixed by <story>` or `claimed here` | An unattributed row is a finding recorded against the story that should have owned it |
| The three State cells | `docs/index.md:77`, `:78`, `:79` after Stories 11.10, 11.11 and 11.12 | Each carries its own story's drafted cell, with the one-trial non-comparable limit that story records, and `:79` also carries the operational limit at `evaluate-ai-feature-behavior.md:240` | A cell claiming more than the artifact behind it shows is a finding against the story that wrote it, recorded here with the cell left standing |
| A `.describe()` correction | A published description no earlier story fixed | Corrected here, then `generate:schemas` and the census procedure | Census failure names the constant to move and the file documents how |
| `npm run docs:build` | The rewritten pages | `tools/validate-doc-links.js` passes, `llms.txt` and `llms-full.txt` regenerate, the astro build succeeds | A dead in-repo link exits before the astro build (`tools/build-docs.mjs:222-233`) |
| The learning-path check | `_bmad-output/project-knowledge/learning-path-step-by-step.md` | One `## Step N (epic11-storyM)` heading and one table row per Epic 11 story marked done, plus this story's own | A missing step is added here and the omission is recorded |

</frozen-after-approval>

## Code Map

### The sweep, run against the tree at 1.4.2

Ownership is assigned by the rule that documentation moves with the story whose change makes a sentence false. `11.9` marks prose that describes the product's shape rather than one story's change.

**Interface-kind enumerations**

| Site | Current text | Owner |
| --- | --- | --- |
| `docs/index.md:72` | "Two interface kinds compile today, `api` and `cli`, and a guide below covers each shape people put in front of them." | 11.9 |
| `docs/index.md:77` | "Gameability proven across eight contracts. No seeded-defect instance yet." | 11.10 |
| `docs/index.md:78` | "Declarable and compiling. Step binding is unit-tested, with no shipped end-to-end run." | 11.11 |
| `docs/index.md:79` | "The shape the library was designed around. No live service has been evaluated yet." | 11.12 |
| `docs/index.md:80` | "Declared and refused at compile. The guide says what a first adopter would have to build." | 11.9 |
| `docs/index.md:84` | "Two kinds parse and stop at compilation under `unsupported-interface-kind`: `web`, which has had no design pass, and `mcp`, which has one and is covered above." | 11.9 |
| `docs/explanation/what-ships.md:18` | "A contract can describe a system behind an HTTP API or one behind a command line. Both kinds compile, preflight, and score." | 11.5 |
| `docs/explanation/what-ships.md:38` | "`compile` accepts `api` and `cli`. The `mcp` kind is declared in the interface vocabulary and refused, so no contract over an MCP tool server runs today." | 11.5 |
| `docs/explanation/what-ships.md:40` | "The response descriptor is the open design question behind the deferral." | 11.3 |
| `docs/explanation/what-ships.md:42` | "`web` is refused on the same terms and has had no design pass at all." | 11.5 |
| `docs/how-to/evaluate-tool-use-behavior.md:63` | The gates table row transcribing `SUPPORTED_INTERFACE_KINDS = ['api', 'cli']` | 11.5 |
| `docs/how-to/evaluate-tool-use-behavior.md:64` | The gates table row giving the pre-flight plan `unsupported-interface-kind` again, citing `plan.ts:307` | 11.5 |
| `docs/how-to/evaluate-tool-use-behavior.md:65` | The gates table row giving probe qualification `signature-interface-kind-unsupported`, citing `qualification.ts:759` | 11.5 |
| `docs/how-to/evaluate-tool-use-behavior.md:142` | The shown rejection, `"mcp" is not supported; "api" and "cli" are (AD-10)` | 11.5 |
| `docs/how-to/evaluate-skill-behavior.md:13` | "`compile` accepts `api` and `cli`, and rejects a contract declaring `web` or `mcp` with `unsupported-interface-kind`." | 11.5 |
| `docs/how-to/evaluate-workflow-behavior.md:75` | The same sentence, inside the `operationId` bullet | 11.5 |
| `docs/how-to/evaluate-agent-behavior.md:303` | "The interface vocabulary also names `web` and `mcp`, and a contract declaring either is rejected with `unsupported-interface-kind`." | 11.5 |
| `docs/how-to/evaluate-ai-feature-behavior.md:14` | "The first three of those parse through `apiShapedInterface`, which carries the same `Operation` shape for `api`, `web`, and `mcp`." | 11.4 |
| `docs/how-to/evaluate-ai-feature-behavior.md:15` | "`compile` supports two of the four, `api` and `cli`, and rejects the rest under `unsupported-interface-kind`." | 11.5 |
| `docs/reference/glossary.md:91` | "`compile` accepts `api` ... and `cli` ... The vocabulary also names `web` and `mcp`, and a contract declaring either is rejected with `unsupported-interface-kind`." | 11.5 |
| `docs/how-to/author-behavioral-contracts.md:148` | "`kind` says which sort of interface it came from, `api` or `cli`" | 11.13 |
| `docs/how-to/evaluate-tool-use-behavior.md:72` | "`ObservedCallInputs` is one eight-key object holding both kinds' input channels (`sealed-run-record.ts:200`)" | 11.6 |
| `docs/how-to/evaluate-tool-use-behavior.md:76` | "`ProbeRequest` and `ProbeObservation` are discriminated unions with an `api` member and a `cli` member ... There is no `mcp` member" | 11.13 |
| `docs/how-to/evaluate-tool-use-behavior.md:226` | "An `mcp` adapter would need an `McpProbeRequest` and an `McpProbeObservation` ... and a third conformance arm" | 11.13, 11.7 |
| `docs/how-to/evaluate-tool-use-behavior.md:236` | The same eight-key claim inside the "Already works" paragraph, with the inline `sealed-run-record.ts` citations beside it | 11.6 |
| `docs/how-to/evaluate-tool-use-behavior.md:236` | "a tool-use signature is confined to `response-body`, `response-headers`, and `response-status`, and that confinement is decided rather than open" | 11.13 |
| `docs/how-to/evaluate-agent-behavior.md:24` | "The one component that starts a process is `createCommandLineAdapter` in `src/adapters/command-line-adapter.ts`" | 11.13 |
| `docs/how-to/evaluate-tool-use-behavior.md:242` | "Until the kind opens, the workable move is the one TEA already made: put the tool-calling agent behind a command" | 11.9, deleted with the rewrite |

**Counts**

| Site | Current text | Owner |
| --- | --- | --- |
| `docs/reference/cli-commands.md:223` | "ships four reference adapters, `createLocalCorpusAdapter`, `createNodeFileSystemAdapter`, `createSystemClockAdapter`, and `createCommandLineAdapter`" | 11.13 |
| `docs/explanation/what-ships.md:20` | "four reference adapters at `eval-quality/adapters`" | 11.13 |
| `docs/reference/cli-commands.md:227` | "one runner per port, plus a second arm for `EnvironmentProbePort`'s two mechanisms" | 11.7 |
| `docs/reference/cli-commands.md:229` | "`corpus` 6, `clock` 6, `file-system` 12, `environment-probe` 19, `command-probe` 15" | 11.7 |
| `docs/reference/cli-commands.md:233` | "ships twenty-one contracts ... Eighteen contracts compile. Three fail by design" | 11.8 |
| `docs/explanation/what-ships.md:20` | "a twenty-one-contract development corpus" | 11.8 |
| `docs/how-to/author-behavioral-contracts.md:94` | "twenty-one contracts: nineteen covering the seven discipline rules, one per declaration state, and two describing a system under test that runs behind a command. Eighteen compile, and three fail by design." | 11.8 |
| `docs/how-to/evaluate-ai-feature-behavior.md:234` | "Eighteen of the twenty-one contracts in `corpus/dev/contracts/` declare an `api` interface" | 11.8 |
| `docs/tutorials/getting-started.md:12` | "The package ships twenty-one of them" | 11.8 |
| `README.md:180` | "you can read twenty-one real contracts and one compiled-and-sealed pair" | 11.8 |
| `docs/how-to/evaluate-agent-behavior.md:294` | "`corpus/dev/contracts/` ships two contracts describing a system behind a command" | 11.10 |
| `docs/how-to/author-behavioral-contracts.md:237` | "The repository commits one complete chain, generated by running the shipped stages over authored inputs" | 11.10, then 11.11 |
| `README.md:240` | "\| the committed worked chain \| `npm run generate:worked-example` \| `npm run check:worked-example` \|", one row for one chain | 11.10, then 11.11 |

Every row above except the last two is held by `check:doc-counts`, the gate Story 11.8 ships. The corpus total in those rows moves three times inside the epic, 21 to 22 in Story 11.8, 22 to 23 in Story 11.10 and 23 to 24 in Story 11.11, and the gate recomputes it from `corpus/dev/index.json` on every one, so the owner column names the story that writes the first move and the gate holds the rest. `author-behavioral-contracts.md:237` and `README.md:240` count committed chains, which no gate in the tree computes, so they stay story-owned and the sweep is what holds them.

**Passages recording something unproven, which the evidence stories close**

Each of these says in the guide's own voice that a shape lacks evidence. The story that ships the evidence rewrites the passage in the same diff, and this story reads the rewrite against the artifact.

| Site | Current text | Owner |
| --- | --- | --- |
| `docs/how-to/evaluate-skill-behavior.md:41-43` | "A defect signature cannot address a file the command wrote ... it cannot carry the gameability probe that makes those oracles worth trusting" | 11.10 |
| `docs/how-to/evaluate-skill-behavior.md:229-239` | "Where this stands", including `:234` "Not proven: nobody has scored a seeded-defect probe against a skill contract" and `:235` "`strength.defect` is `null` in all eight of those suites" | 11.10 |
| `docs/how-to/evaluate-workflow-behavior.md:71-72` | "It is `corpus/dev/contracts/satisfied-declarations.json` with one operation and one step added", said of a contract the corpus does not carry | 11.11 |
| `docs/how-to/evaluate-workflow-behavior.md:221-223` and `:225-226` | "No contract in `corpus/dev/contracts/` and no committed chain uses a `{ captured }` binding" at `:222`, "The worked example in this guide was compiled for this page and is not shipped in the corpus" at `:223`, and "No contract in `corpus/dev/contracts/` declares a `fixtureReset`" at `:226` | 11.11 |
| `docs/how-to/evaluate-ai-feature-behavior.md:225-233` | "**No live AI feature has been evaluated with this library.**" at `:227`, and the authored-evidence sentences at `:228-232`. `:234` sits below the block and stays out of it, because its numeral is `check:doc-counts`'s and Story 11.12 transcribes no gated count | 11.12 |
| `docs/how-to/evaluate-ai-feature-behavior.md:240` | "One operational limit: the command and `runScore` take one record per call, so a scored run completes one trial" | Holds. It is the limit Story 11.12's State cell carries |

**Published `.describe()` strings and source comments under `src/core/schemas/`**

One of these was already found stale on 9 September, so a published description is treated as shipped surface.

| Site | Current text | Owner |
| --- | --- | --- |
| `src/core/schemas/eval-contract.ts:193` | `permittedInterfaces` description: "The `api`, `web`, and `mcp` branches carry the shipped operation shape unchanged ... the `cli` branch carries a command operation" plus the `schemaVersion` 3 -> 4 record | 11.4 (AD-11 puts the bump in the driving field's own description) |
| `src/core/schemas/interface.ts:140` | `Operation` description: "Carried by the `api`, `web`, and `mcp` branches alike, so the export names it once instead of inlining three copies that could drift apart." | 11.4 |
| `src/core/schemas/interface.ts:276-280` | "`web` and `mcp` carry the api operation shape unchanged. A two-member union would make either one a parse failure" | 11.4 |
| `src/core/schemas/defect-signature.ts:152` | "A signature against an interface that speaks HTTP. `web` and `mcp` share the ..." | 11.4 |
| `src/core/schemas/probe.ts:109` | `Probe` description: "Version 3 opened the signature to a second interface kind" | 11.4, if `mcp` takes its own signature branch |
| `src/core/schemas/sensitivity-witness.ts:73` | "`api` and `cli`, rejecting `web` and `mcp` under `unsupported-interface-kind`." | 11.5 (its acceptance names this line) |

**Verified false positives, left alone and recorded so a later reader does not re-open them**

- `src/core/schemas/interface.ts:258` and `:264` -- "AD-19's four interface kinds" over `INTERFACE_KINDS = ['api', 'web', 'cli', 'mcp']`. The vocabulary stays four. Only the accepted set moves.
- `docs/reference/glossary.md:106` -- "`PermittedInterface` declares four kinds: `api`, `web`, `cli`, and `mcp`". True before and after.
- `docs/how-to/evaluate-ai-feature-behavior.md:13` -- "declares four interface kinds in `INTERFACE_KINDS`: `api`, `web`, `cli`, and `mcp`". True.
- `docs/how-to/evaluate-ai-feature-behavior.md:16` -- "a contract stamped `web` parses against the schema and stops at compilation". True and more true after the epic.
- `docs/how-to/evaluate-agent-behavior.md:294` -- moved out of this list. Story 11.8's exemplar is `mcp` so the sentence held at that boundary, and Story 11.10's skill contract declares `cli`, so it reads three by the time this story runs. It is in the counts table above with 11.10 as its owner and `check:doc-counts` as its gate.
- `docs/how-to/author-behavioral-contracts.md:52` -- "requires twenty-one top-level fields". This counts eval-contract fields rather than corpus members. Story 11.4 retypes `permittedInterfaces` and adds no top-level field, so it stays twenty-one. Confirm.
- `docs/ad21-verdict-decision.generated.md`, `docs/ad31-coverage-predicates.generated.md`, `docs/ad33-outcome-decision.generated.md` -- `grep -niE '\bapi\b|\bcli\b|\bmcp\b|\bweb\b|interface kind'` over all three returns zero hits. Nothing to do, verified rather than assumed.

### The Phase 1 inventory, run against the tree at b0ea14d

Five parallel sweeps read every claim on every published surface and checked each one against the
artifact that decides it. The surfaces are `README.md`, all of `docs/`, `CHANGELOG.md`'s Unreleased
and most recent released sections, the CLI's own user-visible strings under `src/cli/`, the shareable
HTML builder and its gate, and the published `.describe()` strings under `src/core/schemas/`. A claim
is any sentence or table cell asserting what the product can be pointed at, what compiles or is
refused and under which code, a count of anything, a transcription of a source literal or a
`path.ts:N` citation, that a named symbol exists, or that something is owed, deferred, or not yet
true.

Nothing was fixed in Phase 1 except the two claims the new gate refuses to let pass, which is
Decision 8. The rest is Phase 2's, against final main.

## Found by the guard, on its first run

| Site | Claim | Why it is false | Owner |
| --- | --- | --- | --- |
| `docs/how-to/evaluate-tool-use-behavior.md:322` | "**Missing.** A dev-corpus exemplar, and a channel model for a text-shaped tool result." | `corpus/dev/contracts/notes-tool-server.json` ships and declares `["mcp"]`, so the exemplar is not missing. | 11.8, which added the exemplar |

Fixed in this pass to `**Missing.** A channel model for a text-shaped tool result.`

## Found by reading, README / index / explanation

| Site | Claim | Why it is false | Owner |
| --- | --- | --- | --- |
| `README.md:34` | the contract declares "the probes the evaluator should perform" | `EvalContract` has no `probes` field (`src/core/schemas/eval-contract.ts:171-232`). Probes are their own artifact with their own CLI flag (`src/cli/arguments.ts:55-62`), and `README.md:103` already says a contract carries no prescribed action sequence. | pre-epic |
| `docs/index.md:78` | workflow behavior State cell: "with no shipped end-to-end run" | The temporal half is proven end to end by the committed `spike-worked-example/` chain, which `docs/how-to/evaluate-workflow-behavior.md:216` says in the guide's own voice. Only the capture half has no shipped chain. | 11.11 |
| `docs/404.md:8` | "The whole site is these seven pages" | The Starlight sidebar autogenerates the whole `how-to/` directory (`website/astro.config.mjs:130-133`), so twelve hand-written pages ship. The list omits all five `evaluate-*` guides that `docs/index.md:76-80` links to. | pre-epic |

## Found by reading, reference and tutorial

| Site | Claim | Why it is false | Owner |
| --- | --- | --- | --- |
| `docs/reference/glossary.md:95` | sibling groups are read by "several discipline rules" | One rule reads them: `siblingCrossCheckRelevance` (`src/core/coverage/relevance.ts:195-199`) and `siblingCrossCheckSatisfaction` (`src/core/coverage/satisfaction.ts:482-487`), both for `sibling-cross-check`. | pre-epic |
| `docs/reference/cli-commands.md:206` | "the option and result types of each entry point" ship as type-only exports | `compile` and `seal` take an inline anonymous `{ readonly strict?: boolean }` (`src/application/compile.ts:18`, `src/application/seal.ts:20`) and export no options type. Only `runPreflight`, `preflightFromObservations` and `runScore` have one. | pre-epic |
| `docs/reference/cli-commands.md:98` | "On every other rung the artifact's own `exitCode` field carries the number the command returns" | `src/core/emit/emit.ts:120` writes the ladder's exit code, which is 0 for CONCERNS, while `src/cli/exit-codes.ts:44-49` returns 1 for a promotable CONCERNS under `--strict`. The page's own `:112` states the exception. | pre-epic |

## Notes that are not verdicts

- `README.md:212`'s "nine decision records" is numerically right; the nine sit across two dated
  architecture directories, seven beside the spine and two under
  `architecture-eval-quality-2026-07-22/`.
- `docs/reference/glossary.md:57`, `:62`, `:67` and `docs/404.md:21-23` spell the three generated
  pages' published slugs. Nothing in the tree renders the route, so no gate covers them, and the
  link checker skips them because they are code spans rather than markdown links.

## Found by reading, CLI help text, CHANGELOG, shareable report, published schemas

| Site | Claim | Why it is false | Owner |
| --- | --- | --- | --- |
| `src/core/schemas/interface.ts:343` (`OPERATIONS_DESCRIPTION`) | "two operations colliding on their transport identity after parameter-name erasure is `duplicate-operation-signature`" | The one string is attached to all four branches (`:356`, `:371`, `:376`) and ships on all four in `schemas/eval-contract.schema.json`. No erasure happens for `cli` or `mcp`: `interface-inventory.ts:112-119` says "There is no erasure step", `:135-141` says "There is nothing to erase", and `:202-205` scopes the clause to the api family. The only false claim in this sweep that reaches the published JSON Schema. | 11.4, which gave `mcp` its own operation shape |
| `CHANGELOG.md:167-170`, Unreleased | "two are refused since `cli` shipped" | One kind is refused: `UNSUPPORTED_INTERFACE_KINDS = ['web']`. The same Unreleased block is what opened `mcp`, so the entry contradicts its own section. | 11.5 |
| `src/cli/run.ts:377` | "A defect in our own code surfaces as a stack, never as exit 5" | `main.ts:145-148` turns the rethrown error into `{kind:'fault'}`, which `exit-codes.ts:68` maps to `EXIT_FAULT = 5`. `main.ts:125-127` states the opposite in the same package. | pre-epic |
| `src/cli/render.ts:117` | "AD-21's seven exit codes" | AD-21 assigns six (`ARCHITECTURE-SPINE.md:375`). 64 is `EX_USAGE`, and both `exit-codes.ts:17-18` and `main.ts:23-24` say it sits outside AD-21. This string ships in `--help` and is mirrored in `README.md:158-166`. | pre-epic |
| `src/cli/render.ts:3` | "Every line the CLI emits is produced here" | `main.ts:145-147` writes `error.stack ?? error.message` to stderr with no renderer, which `main.ts:125-126` says. | pre-epic |
| `src/core/schemas/probe.ts:26` | "the prior art's six-field seeded defect, carried unchanged" | `Defect` (`:27-39`) declares seven fields; `manifestationWitness` at `:36` is the seventh, and its own describe at `:37` acknowledges it. | pre-epic |
| `CHANGELOG.md:196-198`, 1.4.2 | `mutationOperator` "was the only field in that route without one" | `probe-qualification.ts:87` `expectedObservableFailure` also carries no description. | pre-epic |
| `scripts/build-shareable.mjs:290` | "only h2/h3 are worth a table-of-contents entry" | `:294` pushes every heading with `depth <= 4`, and the comment at `:293` says h4 earns one too. | pre-epic |

## Wording worth sharpening, recorded rather than scored false

- `src/core/schemas/eval-contract.ts:238`: "version 4 opens `permittedInterfaces` to a second
  interface kind" is true only on the "second compiling kind" reading. As a count over the field it
  is wrong, because at version 4 that field already parsed `api`, `web` and `mcp`.
- The probe's and the sealed run record's `schemaVersion` numbers are asserted in prose with no
  constant and no reader anywhere in the tree to settle them, unlike `EVAL_CONTRACT_SCHEMA_VERSION`.
  `lineage.ts:20-25` declares the field a bare `z.int().min(1)`.
- `scripts/build-shareable.mjs:66` says the spine carries "two sections recording what four review
  rounds proved cannot be settled in prose". The spine has three trailing status sections
  (`:636` Calibration closure, `:665` Owed, `:751` Deferred) and designates no pair.

## Found by reading, the tool-use, agent and AI-feature guides

| Site | Claim | Why it is false | Owner |
| --- | --- | --- | --- |
| `docs/how-to/evaluate-agent-behavior.md:231-250` | the `defectSignature` JSON block, presented as a working example | The block's `selector.inputBinding` declares eight channels. `ProbeInputBinding` requires nine (`src/core/schemas/defect-signature.ts:86-97`) since the probe's 4-to-5 bump. `CommandDefectSignature.safeParse` fails with `condition.selector.inputBinding.arguments: expected record, received undefined`. One added `"arguments": null` fixes it, matching the tool-use page's own block. | 11.4, which added the ninth channel |
| `docs/how-to/evaluate-tool-use-behavior.md:276` | "AD-4 resolves a check over an empty collection to `insufficient-evidence`, so 'the list came back empty' can never witness a defect" | The pre-1.4.0 rule. `count-tolerance`, `existence` and `absence` pass `'total'` and resolve over a present, empty collection (`src/core/evaluate/resolution.ts:76-93,518,529,679`), and signature predicates use the same `resolveCheck` (`src/core/score/witness.ts:25`). `evaluate-ai-feature-behavior.md:158-161` states the qualified rule correctly. | pre-epic, 1.4.0 |

## Found by reading, the skill, workflow and authoring guides

| Site | Claim | Why it is false | Owner |
| --- | --- | --- | --- |
| `docs/how-to/evaluate-workflow-behavior.md:76` | "`inputBinding` is `ApiInputBinding` over `path`, `query`, `header`, and `body`, or `CommandInputBinding` over `argument`, `option`, `environment`, and `stdin`" | `src/core/schemas/plan.ts:128-132` makes `InputBinding` a three-member union including `McpInputBinding` over `arguments` (`:108-110`). The same page's `:75` says `mcp` compiles and `:222` names a corpus contract whose every step binds `arguments`. | 11.4 |
| `docs/how-to/evaluate-workflow-behavior.md:102` | "Each message below is the real output of `node dist/cli/main.js compile` on the plan above with one field changed" | True of the first two quoted messages. The third does not reproduce. | pre-epic |
| `docs/how-to/evaluate-workflow-behavior.md:122-126` | the `binding-cycle` worked example | Two defects. The prose describes a capture from `read-back` while the quoted pointer is `/interactions/create/response-body/name`, a self-capture. Neither reproduces from the plan above with one field changed: both exit 4 under `unreachable-check-evidence`, because no response descriptor in that contract declares `name`. Adding `name` to the descriptors reproduces the quoted `binding-cycle` line exactly, so the failure code, the exit and the template are right and the setup around them is not. | pre-epic |

## Totals

Five parallel sweeps over every published surface: `README.md`, all of `docs/`, `CHANGELOG.md`'s
Unreleased and most recent released sections, the CLI's own user-visible strings under `src/cli/`,
the shareable HTML builder and its gate, and the published `.describe()` strings under
`src/core/schemas/`.

712 claims read and checked against an artifact. 20 false. 60 with no artifact in the tree that could
settle them, which is the class the gate's `DATED_CLAIMS` registry now enumerates. The remainder
verified true, including every numeral `check:doc-counts` holds.

Two of the 20 were found by `check:doc-claims` rather than by reading, and both are fixed in this
pass. The other 18 are Phase 2's, and their owners are in the tables above: three land on Story 11.4,
one on 11.5, one on 11.8, one on 11.11, and twelve predate the epic.


### What Phase 2 inherits beyond the inventory

Three items that are not truth defects and that the sweep turned up anyway.

- `docs/index.md:82` reads "a 'state' column entry is the guide's own verdict rather than a roadmap
  promise". That sentence is this story's by the frozen Execution list, and its second half rejects a
  hypothetical rather than naming a fact, which the repository's writing rule bans. The affirmative
  half stands on its own.
- Story 11.10 hands over one item it declined by name: `evaluate-skill-behavior.md`'s "Where this
  stands" opens with an unqualified "a seeded defect is caught and scored" and the word "authored"
  arrives two paragraphs later, while `evaluate-ai-feature-behavior.md` qualifies in the same breath.
  A one-clause edit, and it is this story's because it is about consistency across two guides.
- The three generated pages' published slugs are spelled at `docs/reference/glossary.md:57`, `:62`,
  `:67` and `docs/404.md:21-23`. No gate covers them: the link checker matches markdown links and
  these are code spans, and no built site exists in the tree to resolve the route against. Recorded
  as review-held rather than added to `check:doc-claims`, because deciding them would mean building
  the site inside a `validate` step.

### The gates, and what each one actually scans

- `scripts/check-docs.mjs:9-15` -- `ROOTS` is `README.md`, `_bmad-output/planning-artifacts`, `_bmad-output/project-knowledge`, and two `experiments/` files. `docs/` is not scanned. What it checks is frontmatter structure (`:25-42`) and trailing whitespace, repeated blank lines, and the final newline (`:44-55`). It checks no counts and no prose, so it catches nothing this story is about, on any file this story edits except `README.md`.
- `scripts/check-doc-invocations.mjs:73` -- `ROOTS = ['README.md', 'docs']`. Story 9.5's Code Map recorded this at `:41`; the file grew and the line moved. The FAITHFUL rule is at `:20-34`, `EXPECT_EXIT_PATTERN` at `:106`, and `:420` refuses an `expect-exit` declared on an invocation that names a file only a reader has.
- `docs/how-to/author-behavioral-contracts.md:82` and `docs/tutorials/getting-started.md:66` -- the only two `<!-- expect-exit: 4 -->` declarations in the tree today. Story 11.2 adds the third on the tool-use guide.
- `package.json:105` -- `"docs:build": "node tools/build-docs.mjs"`. It runs `tools/validate-doc-links.js` first (`tools/build-docs.mjs:33,222-233`), then generates `llms.txt` and `llms-full.txt` from `docs/` (`:48-58,72+`), then the astro build. A dead in-repo link exits before the astro build.
- `package.json:113` -- `validate` chains twenty-one steps at 1.4.2, `check:docs` and `check:doc-invocations` among them, with `check:shareable` as step 6. Story 11.8 wires in `check:doc-counts`, so it is twenty-two steps at this story's boundary. It does not build the website, so `docs:build` is a separate gate.
- `scripts/check-doc-counts.ts` -- Story 11.8's count gate, wired into `validate`. It holds one entry per gated sentence: the file, a regex capturing the spelled-out numeral, the expression that computes the value from its source of truth, and the rendering, with a pattern matching nothing failing as a dead entry. It covers fourteen numerals across seven pages, plus one entry capturing the five `CONFORMANCE_OUTCOME_COUNTS` digits at `cli-commands.md:229`, which is every count in this story's counts table except the two chain counts at `author-behavioral-contracts.md:237` and `README.md:240`. The sweep reads the gate rather than re-deriving it: a gated row that disagrees with its source fails `validate` before this story runs.
- No test gates a published count. `grep -rn "twenty-one" tests/` returns nothing, and the only doc-facing assertion in `tests/architecture/dev-corpus.test.ts:216-265` compares digest-shaped literals under `docs/`. That gap was real at 1.4.2 and Story 11.8 closed it with a script, on the reasoning that AD-30 makes every filesystem-reading gate in this repository a script. What stays ungated is what the gate's own uncovered list names, and this story's sweep is the mechanism for that remainder.

### The website

- `website/src/content/docs` -- a symlink to `../../../docs`. Confirmed with `ls -la website/src/content/`.
- `website/astro.config.mjs:118-143` -- the sidebar autogenerates per directory, ordered by each page's `sidebar.order` frontmatter. No page is listed by name except `index`, at `:120-122`.
- `website/astro.config.mjs:19-45` -- no `redirects` key. A renamed guide has nothing to catch its old URL.
- In-repo links to the tool-use guide: `docs/index.md:80` and `docs/explanation/what-ships.md:38`. Both are the only ones, and both move with their own rewrites.

### The learning path

- `_bmad-output/project-knowledge/learning-path-step-by-step.md` -- 3730 lines, 44 steps, the last being `## Step 44 (epic10-story1)` at `:3698`, with its table row at `:88`. Epic 11's thirteen stories are Steps 45 through 57, so this story's own step is the next number after the last Epic 11 step present.
- `_bmad-output/project-knowledge/learning-path-template.md:10-25` -- the shape: `In plain terms`, `What`, `Why`, optional `The shape`, `Read in this order`, `Story`, then `### Reference` with `Rules` and optional `Watch out`, plus one row in the table at the top. `:30-33` bans every repository term from `In plain terms`. `:61` bans the em dash and the spaced hyphen.

## Tasks & Acceptance

**Execution:**

- [ ] `docs/index.md:70-84` -- rewrite the framing sentence at `:72` to name the kinds that compile, the tool-use row at `:80`, and the closing paragraph at `:84` about `web` alone. The State cells at `:77`, `:78` and `:79` are Stories 11.10, 11.11 and 11.12's and this story leaves the text they wrote; `:76` is unchanged. The table structure and the sentence at `:82` about what a State entry means are this story's.
- [ ] `docs/index.md:77`, `:78`, `:79` -- read each cell against the artifact its story shipped: a scored seeded-defect probe with a real `strength.defect`, a corpus contract carrying a `{ captured }` binding and a `fixtureReset` with a committed chain behind it, and a chain run against the loopback fixture the suite starts. Record `fixed by <story>` against each. A cell claiming more than its artifact shows is written up as a finding against that story, with the cell left standing.
- [ ] `docs/how-to/evaluate-tool-use-behavior.md` -- re-author the page as a guide. Read what Stories 11.4 and 11.5 left in the contract fence at `:84-133` and the invocation at `:137-143` first, and write against those bytes rather than replacing them. Rewrite the frontmatter `description` at `:3`, which still says "what a first adopter would have to build" and travels into the site meta and `llms-full.txt`.
- [ ] `docs/explanation/what-ships.md:36-42` -- read the section after Stories 11.3 and 11.5 have edited it, and claim any sentence in it that still describes a refused kind or a blocker.
- [ ] The sweep -- run the grep commands in Verification, walk every row of the Code Map tables, and record `fixed by <story>` or `claimed here` against each. Fix here anything unclaimed, and record the finding against the story that owned it. The gated count rows are read through `npm run check:doc-counts` rather than by eye, since that gate computes each value from its source.
- [ ] The five unproven-claim passages -- `evaluate-skill-behavior.md:41-43` and `:229-239`, `evaluate-workflow-behavior.md:71-72` and `:221-223` with `:225-226`, and `evaluate-ai-feature-behavior.md:225-233`. Each is read against the evidence its story shipped. `evaluate-ai-feature-behavior.md:240`'s one-trial operational limit is confirmed as still true and left standing.
- [ ] `_bmad-output/project-knowledge/learning-path-step-by-step.md` -- verify one step and one table row per Epic 11 story marked done, add any missing one, then add this story's own step per `learning-path-template.md`.
- [ ] What the epic leaves standing -- restate it at the end of the story's built section so a reader auditing the pages knows what is there by decision.

**Acceptance Criteria:**

- Given `grep -rn 'unsupported-interface-kind' docs/ README.md`, when it runs on the finished documentation, then every hit sits in a sentence that names `web` and names no other kind as refused.
- Given `grep -rn 'refused at compile' docs/ README.md`, when it runs, then it returns nothing.
- Given the Code Map's four sweep tables, when the execution pass finishes, then every row carries `fixed by <story>` or `claimed here`, and every row in the false-positive list carries a confirmation read from the tree.
- Given `docs/index.md:74-80`, when the State column is read, then no cell carries an unproven claim, and the measured limits each story records stay: each of `:77`, `:78` and `:79` carries the cell its own story drafted with that story's one-trial non-comparable limit, and `:79` also carries the operational limit at `evaluate-ai-feature-behavior.md:240`.
- Given `docs/how-to/evaluate-tool-use-behavior.md`, when a reader follows it top to bottom with the CLI installed, then they author a tool-server contract, compile it, pre-flight it, and score it, with no section describing what somebody would have to build.
- Given `npm run check:doc-invocations`, when it runs, then the tool-use guide's `compile` invocation at `:137-139` is reported FAITHFUL and its declared exit code is the one the run produces. The `preflight` fence at `:203-207` and the `score` fence at `:209-216` are reported UNFAITHFUL with the usage-error judgment and no exit-code judgment, which is what Story 11.2's Decision 4 settled: making them faithful costs six authored artifacts, a probe list, an observation list, a sealed run record, a scoring policy, an isolation manifest, and an evaluator configuration, each one maintained through every schema bump this epic ships. Those two fences document command grammar and the usage-error judgment already holds the grammar.
- Given `npm run docs:build`, when it runs, then the link check passes over both links to the tool-use guide, and `llms-full.txt` carries the rewritten page.
- Given `_bmad-output/project-knowledge/learning-path-step-by-step.md`, when read after this story, then the number of `## Step N (epic11-storyM)` headings equals the number of Epic 11 stories marked done, each has a table row, and this story's own step follows the template.

## Decisions settled by construction

**Decision 1: the guide keeps its filename, and the reason is recorded so nobody re-opens it.**
The page's title stops matching its content once the kind ships, which argues for a rename. Three things say no. `website/astro.config.mjs:19-45` declares no `redirects` key, so the old URL resolves to nothing and the site has no mechanism to add one without a new dependency or a config change outside this story's scope. `tools/build-docs.mjs:33` runs `tools/validate-doc-links.js` before the astro build, so the two in-repo links would have to move in the same commit, which is cheap, while every external link and every copy of `llms-full.txt` already published would not. And the sidebar orders by `sidebar.order` (`website/astro.config.mjs:118-143`), so the filename carries no navigation weight. The slug `evaluate-tool-use-behavior` describes what the page is for in both states. Downstream consequence: whoever renames a published guide later inherits the redirect problem, and this is the record that it was priced rather than missed.

**Decision 2: the sweep is attributive, and an unattributed hit is the deliverable.**
The alternative is a flat correction pass that fixes everything it finds and reports a count. That hides the thing worth knowing. The epic's standing constraint is that the story changing behaviour fixes the prose its change falsifies, and the only way to know whether that constraint held is to name the owner of every hit and check. So the Code Map carries the owner per row and the execution pass carries the verdict per row. A row that reads `claimed here` where an earlier story should have fixed it is recorded as a finding against that story by name. Downstream consequence: the next epic that opens a kind gets a worked template for its closing check, and it gets the measurement of whether per-story documentation actually worked this time.

**Decision 3: a stale published `.describe()` is fixed here, and the census consequence is stated up front.**
Five description strings under `src/core/schemas/` enumerate kinds, and one description in this repository was already found stale on 9 September, so the class is real. Each of the five is owned by Story 11.4 or 11.5. If one survives them, leaving it is the same defect the epic exists to close, filed one layer down where a JSON Schema consumer reads it. So this story fixes it, and the fix is not free: a description byte moves `schemas/*.schema.json`, which moves `CENSUS_BY_KEYWORD` and `CENSUS_TOTAL` in `tests/schemas/published-census.ts`, whose own file documents the procedure. The story runs `npm run generate:schemas` and follows that procedure, so a red census is expected work. This is the only circumstance in which this story writes under `src/`, and the diff is description-only. Downstream consequence: whoever reviews this story checks whether the `src/` diff is description-only.

**Decision 4: the tool-use State cell is composed from artifacts, and the other three cells are read against theirs.**
Every row in the table carries a verdict its own guide justifies, and the tool-use row has to earn one the same way. So that row's entry is composed at execution time by reading three things: whether `corpus/dev/index.json` carries an `mcp` contract with no `structuralFailure`, what `src/adapters/` ships for the kind, and whether the third conformance arm passes. If any of the three is weaker than the epic planned, the row says the weaker thing. The draft in Design Notes is a starting point that the artifacts overrule.

The three evidence rows work the same way with a different author. Stories 11.10, 11.11 and 11.12 each ship the artifact and each drafts its own replacement cell, which puts the claim under review before the run exists and keeps the cell in the diff that earns it. This story reads each cell against its artifact and records the verdict. Downstream consequence: `docs/index.md:82`'s promise that "a 'state' column entry is the guide's own verdict rather than a roadmap promise" keeps holding for all five rows, and a story that overclaims is caught by a reader who has both the cell and the artifact in front of them.

**Decision 5: `check:docs`' `ROOTS` is left alone, and `check:doc-counts` is the gate this sweep reads.**
Widening `scripts/check-docs.mjs:9-15` to `docs/` would put every published page under a whitespace and frontmatter gate in the same commit that rewrites two of them, and it gates formatting rather than counts, so it would not have caught a single hit in this sweep. That is the whole of the case against widening it, and it is unchanged.

The counts themselves are gated. Story 9.5 proposed a test that reads the corpus and asserts each document's number and `grep -rn "twenty-one" tests/` shows it never landed; Story 11.8 shipped the same idea as a script, `scripts/check-doc-counts.ts`, wired into `validate`, on the reasoning that AD-30 makes every filesystem-reading gate in this repository a script. So the corpus counts, the per-kind splits, the adapter count and the five outcome digits are held by the build, and this story's sweep reads that gate rather than re-deriving what it already proves. What the sweep still holds by hand is the remainder the gate's own uncovered list names: the two committed-chain counts at `author-behavioral-contracts.md:237` and `README.md:240`, every kind enumeration, and every claim that is not a count. Downstream consequence: a gated row that goes stale fails `npm run validate` before this story runs, so an unattributed row in the sweep is now evidence about prose rather than about arithmetic.

**Decision 6: a prose gate is buildable, and this is where its boundary falls.**
Story 11.7's Decision 18 handed this story the open question of whether anything mechanical could
catch a false prose claim on a published page, and asked for the boundary rather than a verdict.
`scripts/check-doc-claims.ts` is the answer, wired into `validate` as `check:doc-claims` after
`check:doc-counts`. Six classes, each of which resolves against an artifact this repository already
holds.

1. **Citations.** Every `path.ts:N` on a published page resolves to a file under `src/`, the line is
   in range, and at least one backticked identifier from the same sentence that the cited file
   actually declares sits within four lines of the cited range. A bare `plan.ts` resolves to the last
   fully-qualified citation of that basename on the same page, which is how a reader resolves it and
   which two files named `plan.ts` would otherwise make ambiguous. Twenty-one citations, sixteen
   anchored.
2. **Symbols.** Every backticked token shaped like a code identifier appears under `src/`. Three
   hundred and seventy-four tokens, three exceptions, each carrying its reason in
   `FOREIGN_IDENTIFIERS`.
3. **Transcribed lists.** Nine sentences that spell out a set the source owns are compared against
   the source: the kinds `compile` accepts, the kinds it refuses, the interface vocabulary, the five
   `create*Adapter` exports, and the six `run*Conformance` exports. This is the shape Decision 18
   named as derivable, and the runner list is the specific sentence it named.
4. **Time-sensitive claims.** A pattern finds sentences saying a thing is true "today" or not yet
   true, and each one must carry a `DATED_CLAIMS` entry saying how it is settled. Twenty-six
   registered: eleven by a predicate this script runs, fifteen by a recorded human reading with the
   reason no artifact in the tree decides it.
5. **Named codes.** Where a page says a code is raised, thrown, reported as, or refused under, the
   code has to be in `FAILURE_CODES` or `RUNTIME_FAULT_CODES` or spelled as a string literal under
   `src/`. Twenty-one such claims.
6. **Worked JSON.** Every published JSON block introduced as an example parses against the schema
   the prose names. Ten blocks.

Every class fails a dead entry the way `check-doc-counts.ts` does: an exemption, a list pattern, a
registry key, or a fence intro that matches nothing is a failure, so a rewritten sentence cannot
escape its own gate by drifting out from under the pattern.

What stays outside all six, and is therefore held by review: editorial judgment, design rationale,
any claim about the world beyond this tree, and any claim about runtime behaviour that only executing
the code would settle. The script's header states that boundary and `REPORT` prints the count of what
is review's, so the remainder is visible rather than assumed away. Downstream consequence: the next
story that adds an unproven claim to a page fails `validate` until it registers the claim with a
reason, which is the discipline this epic was enforcing by hand.

**Decision 7: class 4 registers a claim it cannot decide, and that is the point.**
"No live server has been scored end to end yet" is not decidable from this repository, so no check
can settle it. The alternative considered was to leave the whole class out, which is what the tree
had, and the cost of that is what this epic paid: an unproven claim went stale invisibly and a person
found it by reading. What a check can decide is that the sentence exists and that somebody wrote down
who holds it and why. So the pattern's job is to find candidates, which it does mechanically, and the
registry's job is to force a decision per sentence. Rewriting a registered sentence fails the gate as
a dead entry, which is the re-read the claim needs.

The pattern was tuned against the tree rather than guessed. `missing`, `blocked`, `so far` and `at
present` were dropped because they fire on "the missing flags", "a missing value" and "the missing
page", none of which is a dated claim. `**Missing.**` survives as a bolded heading form, which is how
the tool-use guide spells it. Twenty-six registered claims is the registry's size at this boundary.

**Decision 8: the gate found two false published claims on its first two runs, and both are fixed
here.**
Class 4's predicate over the corpus found `docs/how-to/evaluate-tool-use-behavior.md`'s "**Missing.**
A dev-corpus exemplar, and a channel model for a text-shaped tool result", which was false because
`corpus/dev/contracts/notes-tool-server.json` ships and declares `mcp`. Class 6 found
`docs/how-to/evaluate-agent-behavior.md`'s defect-signature block, which stopped parsing when the
probe's input binding gained its ninth channel: `CommandDefectSignature` rejects it with
`condition.selector.inputBinding.arguments: expected record, received undefined`. Both are corrected
in this pass. The second is the more useful finding, because a reader copies a JSON block and the
only thing standing between them and a parse error was a person noticing.

**Decision 9: the gate is proven by mutation rather than by its own green run.**
A gate nobody has seen fail is a gate nobody knows is armed, which is the lesson `check:doc-counts`
records about `check:corpus` proving bytes without reading words. Twelve mutations were applied and
reverted, at least one per class and one per dead-entry rule: a citation past the end of its file, a
citation moved off its symbol, a renamed symbol, a list member dropped, a list pattern reworded dead,
an unregistered time-sensitive sentence, a registered claim reworded, an invented failure code, a
worked JSON block that stops parsing, a worked JSON block that stops being JSON, and a fence intro
reworded dead. All twelve failed the gate with a message naming the file, the line and the thing that
moved. Downstream consequence: a later story widening this gate is expected to mutate what it adds.

**Decision 10: `check:docs`' `ROOTS` is still left alone, and this is why a new script was the right
shape.**
The frozen Ask First block requires asking before widening `scripts/check-docs.mjs`'s `ROOTS` to
`docs/`, and Decision 5 already priced that as a repository-wide formatting gate that would not have
caught a single hit in this sweep. Nothing about building a prose gate changes that: `check:docs`
gates frontmatter and whitespace, and `check:doc-claims` gates claims. They are two gates over the
same files with nothing to share, so the new script leaves `ROOTS` untouched and the Ask First
boundary is not crossed.

**Decision 11: the frozen block is stale in six places, and the staleness is the epic's own success.**
The `<frozen-after-approval>` block is human-owned and stays as written. It was approved against the
tree at 1.4.2 and six of its statements no longer describe the tree at this story's base, b0ea14d.
They are recorded here rather than edited, which is the sixth time in this epic a story has found its
own frozen block overtaken.

- The Intent quotes `docs/index.md:72` as "Two interface kinds compile today, `api` and `cli`". It
  reads "Three interface kinds compile today, `api`, `cli`, and `mcp`". Story 11.5 wrote it.
- The Intent quotes `:80`'s tool-use verdict as "Declared and refused at compile" and `:84` as "Two
  kinds parse and stop at compilation". Both are rewritten, and `:84` now names `web` alone.
- The Intent describes `docs/how-to/evaluate-tool-use-behavior.md` as "254 lines written as an
  inventory of what a first adopter would have to build". The page is 351 lines and is re-authored as
  a guide with the kind shipped. Its frontmatter description at `:3` was rewritten with it.
- The I/O matrix's first two rows are the story's acceptance greps, and both already pass at the
  base: `grep -rn 'refused at compile' docs/ README.md` returns nothing, and every
  `unsupported-interface-kind` hit sits in a sentence naming `web` and no other kind.
- The matrix and the Verification section give the tool-use guide's `compile` invocation at
  `:137-139` and its `preflight` and `score` fences at `:203-207` and `:209-216`. Those line numbers
  moved with the rewrite. The judgments they assert are what matters and `check:doc-invocations` is
  green, so the rows hold on their content.
- The Verification section says `validate` chains twenty-two steps. It chains twenty-two at the base
  and twenty-three with `check:doc-claims` wired in.

The Execution checklist inherits the same shift: three of its seven items describe rewriting
sentences that Stories 11.5 and 11.7 already rewrote, which is Decision 2's measurement answering in
the affirmative. What is left for the Phase 2 sweep is what those stories did not cause, and the
Phase 1 inventory below is the list of it.

**Decision 12: sixteen of the twenty false claims are corrected in this pass, and two are held for a
reason each.**
Held: `docs/index.md:78`'s workflow State cell, which is Story 11.11's under the epic's ownership
rule and which this story's frozen Never forbids it to write. Held: `src/core/schemas/interface.ts:343`,
whose fix moves `schemas/eval-contract.schema.json` and therefore `CENSUS_BY_KEYWORD` and
`CENSUS_TOTAL`, while Stories 11.10 and 11.11 are moving census and corpus numbers in other
worktrees. It lands in the final pass, after they merge. The other two of the twenty were fixed in
Phase 1 because `check:doc-claims` refuses to pass them and a gate cannot land red.

Three of the sixteen are under `src/` and all three are description-only: `run.ts:377`, `render.ts:3`
and `render.ts:117` are comments, and `probe.ts:26` is a docblock over `Defect`. No schema shape
moves, no code is minted, no check changes what it accepts.

**Decision 13: the printed exit-code header is corrected as prose, and here is the evidence that it
was prose.**
`EXIT_CODE_TABLE` printed `Exit codes (AD-21):` over a table whose rows include 64, and the
repository states twice in source that 64 is not AD-21's: `src/cli/exit-codes.ts:17` says of the
constant "Outside the verdict range and outside AD-21's codes", and `src/cli/main.ts:22-23` says it
"sits outside every code AD-21 assigns". The header now reads
`Exit codes (AD-21's six, plus 64 from sysexits.h):`.

No exit code was added, removed, renamed, or repointed. 64 still exists, still means `EX_USAGE`, and
still fires on the same paths, so nothing about behaviour moved and only a label that over-claimed
its scope did. `tests/cli/render.test.ts:219-236` compares the seven `  N  text` rows against
`README.md` and never reads the header, so it stays green untouched, and
`docs/reference/cli-commands.md:150` is the one other copy and moves with it. Downstream consequence:
a reviewer checking this story's `src/` diff for behaviour change has this paragraph to check it
against.

**Decision 14: a released CHANGELOG section is left as it shipped.**
`CHANGELOG.md`'s 1.4.2 entry says `mutationOperator` "was the only field in that route without one",
and `src/core/schemas/probe-qualification.ts:87`'s `expectedObservableFailure` still carries no
description, so the sentence was wrong when it shipped. It is left standing. A released section is
the record of what a release said, and editing it silently rewrites a note somebody may already have
read against a version they are running. The Unreleased section is a different case and its own
false count was corrected here: it said two interface kinds were refused, in the same block that
opened `mcp` and left one.

Leaving the released text alone lets the falsehood stand as the last word, so the coordinator's
addition is that the `[Unreleased]` section carries a correction naming the 1.4.2 entry and what was
actually true. That satisfies both halves at once: the history stays as it shipped, and a reader who
follows the claim finds the correction beside it. Downstream consequence: a false statement in a
released section is corrected forward rather than edited in place, and the next story that finds one
has this shape to copy rather than a choice to re-litigate.

**Decision 15: the worked example that did not reproduce was rebuilt and run rather than reasoned
about.**
`docs/how-to/evaluate-workflow-behavior.md:102` said all three quoted `compile` messages come from
"the plan above with one field changed", and the third did not: both the prose's spelling and the
quoted pointer exited 4 under `unreachable-check-evidence`, because no response descriptor in that
contract declares `name`. The contract was reconstructed from
`corpus/dev/contracts/satisfied-declarations.json` with the guide's `get-thing` operation and
`read-back` step added, and it compiles at exit 0 as the page claims. Adding a `name` key to
`create-thing`'s response descriptor and capturing `/interactions/create/response-body/name` into
`create`'s own `body.name` reproduces the quoted `binding-cycle` line byte for byte at exit 4. The
prose now says that, and the quoted message was already right. Downstream consequence: the failure
code, the artifact path and the message template in that fence are verified rather than inherited.

**Decision 16: class 7 is the narrowing that closes the epic's own defect, and the peer review is
what produced it.**
The Phase 1 gate held the epic's class as an inventory: nine enumerated sentences in `LISTS`. The
peer review demonstrated the hole by writing a new sentence of exactly the epic's shape,
"A contract declaring `mcp` is rejected with `unsupported-interface-kind`, so an MCP tool server
cannot be evaluated", on a page no entry covered, and the gate passed it. It invents no symbol, cites
no line, names a code that exists, and carries no dated vocabulary.

Class 7 reads `SUPPORTED_INTERFACE_KINDS` and `UNSUPPORTED_INTERFACE_KINDS` and has nothing to
register. A kind in prose is classified by the nearest verb before it in its own sentence, and by the
nearest verb after it when nothing precedes, which is what carries "a contract declaring `web` is
rejected". Sentence boundaries stop a verb reaching across a full stop, `used to reject` is skipped
because the tense makes it a statement about the past, and a verb inside backticks is skipped because
`compile` is the command's name rather than a verb governing the kind beside it. Thirty kind mentions
across the published pages classify, with no false positive at this tree. Downstream consequence: the
next epic that opens a kind gets this check for free, and the six `LISTS` entries over kind sets are
now belt and braces rather than the only guard.

**Decision 17: the peer review's trigger-vocabulary finding is recorded as a divergence rather than
taken.**
The review asked that the `TIME_SENSITIVE` alternatives matching nothing today be held to the same
dead-entry rule the gate imposes on `LISTS` and `DATED_CLAIMS`, and named seven. That rule is right
for an entry, which points at one sentence that either exists or does not, and wrong for a trigger,
whose whole job is to fire on a sentence nobody has written yet. `\bno [a-z-]+ (?:has|have)\b` matches
nothing at this tree and is what caught the mutation "No adapter has been written for a live tool
server yet", which is the canonical shape of the claim this class exists for. Trimming the vocabulary
to what currently fires would leave the class holding only the sentences already registered, which is
the inventory the same review criticised elsewhere.

What the review was right about is the live false positive. `\bwould (?:have to|need)\b` fires on
timeless explanatory prose, so it is gone, and `\bdeferred\b` is narrowed to `\bDeferred until\b` and
`\bstays deferred\b`. Removing them cost two registrations their trigger, which is how the third
mechanism arrived: a heading saying the section is about what the project owes now makes every bullet
under it a dated claim, whatever words the bullet uses. That holds `what-ships.md`'s "Two things the
project still owes itself" section, whose bullets carry the claim in the heading, and it added one
registration the sentence-level trigger had never reached. Downstream consequence: a whole owed
section can be added and every bullet in it needs a reason on record.

**Decision 18: the four findings the review called must-change are all taken, and one of them was
invisible.**
`flatten` discarded the only useful message on a discriminated-union mismatch, so class 6 reported an
empty parenthesis on exactly the failure the epic is about, a JSON block declaring a `kind` the union
no longer carries. It now keeps the issue when a union reports no branch errors and picks the branch
that reached deepest into the value rather than the one with the fewest complaints. `DATED_CLAIMS`
gained the duplicate guard `LISTS` already had, so a new and false dated claim can no longer ride in
on a short key such as `**Missing.**`. `IDENTIFIER_SHAPE` gained single-word PascalCase, which brings
`Rubric`, `Probe`, `Observation` and `Expression` under class 2 at a cost of two
`FOREIGN_IDENTIFIERS` entries. And four literal NUL bytes were sitting in the source as composite
`Set` separators, which made `file(1)` call the script `data` and would have been silently normalised
by any tool that touches control characters; the keys are `JSON.stringify` now.

**Decision 19: the second review found two of the sixteen corrections wrong, and a documentation pass
that cannot be told that is worth less than the pass itself.**
Both were mine and both were introduced by this story rather than inherited. The `[Unreleased]`
`responseStatus` entry gained a clause saying `sensitivity-witness.ts` "read its own set from the
source", which is the opposite of true: that file imports `zod`, `expression.ts`, `primitives.ts` and
`probe-body.ts`, imports nothing from `interface-inventory.ts`, and hand-spells `api`, `cli` and
`mcp` in a JSDoc comment at `:87`. A stale-prone sentence was replaced with a wrong one, inside an
entry whose subject is a sentence that went stale. The clause carried no weight and is cut. And the
`check:doc-claims` entry named three checks and then said a claim "fell through all four", which is a
numeral wrong in a diff whose subject is numerals being wrong.

`src/core/schemas/sensitivity-witness.ts:87` was recorded here as an instance of the epic's own class
sitting in source, where class 7 does not look. It is fixed in this pass instead, and Decision 23
carries the count behind leaving the class on the published pages.

**Decision 20: class 7's first version answered wrongly on negation, tense, and a comma.**
The review reached five edges by appending one sentence to a page, and three of them were reachable
by ordinary editing rather than by contrivance. "`compile` does not accept `mcp`" is false and
passed, because "accept" is not a refusal verb. "`compile` does not accept `web`" is true and failed.
"A contract declaring `mcp` is no longer rejected" is true, is the sentence the next kind opening
will write, and failed. "Before Epic 11, `compile` rejected `mcp`" is a page narrating its own
history and failed. And "`web` is rejected, and `mcp` compiles" failed on `mcp`, because the sentence
split was on the full stop alone and the preceding verb reached across the comma.

Three narrowings, all read off the sentence and none needing an entry. A verb the sentence negates or
puts in the past decides nothing, so `not`, `never`, `no longer`, `cannot`, `nor` and `used to` in
the twenty-four characters before it skip the verb, which leaves the mention undecided rather than
answered wrongly. A bare `rejected` or `refused` is past tense and is read only after a present `be`,
so `was rejected` and `rejected` are skipped while `is rejected` counts. And the governing verb is
now the nearer of the one before and the one after, except that a preceding verb with another kind
between it and this one governs the whole enumeration it opens. That last clause is what separates
"`compile` accepts `api`, `cli`, and `mcp`, and rejects `web`", where `accepts` governs all three
across two commas and an "and", from "`web` is rejected, and `mcp` compiles", where the comma is a
clause boundary and the following verb is the right one. Splitting the sentence on `, and ` would
have broken the first to fix the second, since a list and a clause join use the same token.

A third review round then defeated it three more times, and two of the three were vocabulary rather
than logic. `KIND_VERB` carried every refusal verb's past participle and not one acceptance verb's,
so "a contract declaring `web` is accepted" held no verb at all, went undecided, and passed. The
class guarded refusal and left acceptance open, in the simplest passive phrasing a glossary row
reaches for. And `PRESENT_BE` was anchored to the character before the participle, so one adverb
reopened the same hole: "a contract declaring `mcp` is still rejected" passed, with `still` being this
repository's own word, as `what-ships.md:42` writes it. Both are fixed, and the docblock now says
that a verb the vocabulary does not carry is undecided, so the next reader knows the vocabulary holds
as much of the guarantee as the logic.

The third was the enumeration rule, which made a preceding verb sticky with no way for the second
clause's own verb to govern its own subject: "`compile` accepts `api` and `cli`, and `web` is
rejected" failed on a true sentence. The span between the verb and the kind cannot separate those
cases, since a list and a clause join read the same. The span on the other side can: a list member is
followed by punctuation, and a subject is followed by an auxiliary, so a following verb now wins over
an enumeration when only whitespace and auxiliaries lie between the kind and it.

Twenty-six sentences now behave correctly, all eight edges among them, with thirty kind mentions
classifying on the real tree and no false positive. Twenty of the twenty-six are answered; six are
skipped as undecided by the negation and tense rules, measured by the mention count not moving. Two
of those six are false about the tree and pass green, "`compile` does not accept `mcp`" and "a
contract declaring `web` is not rejected", because deciding a negated sentence needs scope reasoning
this class does not do. That is the one place where the class passes a plainly false claim rather
than having nothing to go on, and the docblock's boundary list now says so. One shape stays wrong and is recorded in the
docblock rather than chased: a list used as a subject with its verb after it puts the governing verb
past the intervening kinds, so "`web` is rejected and `api`, `cli`, and `mcp` compile" reads the
first two members as refused. It fails a true sentence rather than passing a false one, and no page
in `docs/` writes a kind list that way. Downstream consequence: the class decides less than its first
version did and is right more often, and what it declines to decide is in the docblock rather than
answered by accident.

**Decision 21: the docblock claimed a drift-proofing that did not exist, so the check was built
rather than the claim softened.**
`render.ts`'s docblock said "The `--help` output and the README table are this text, so the two
cannot drift." Two things were wrong. `README.md:158-166` is a markdown table with pipe cells, and
`tests/cli/render.test.ts:219-236` compares row content rather than the string; the verbatim second
copy is `docs/reference/cli-commands.md:150`. And nothing held that copy at all: the reviewer changed
`runtime fault` to `runtime failure` on that page and every gate stayed green.

The cheap fix was to delete the claim. Instead `check:doc-claims` gained class 8, which holds a page
that reprints a string the binary emits against the string itself, and the docblock now says what
each of the two gates holds. `EXIT_CODE_TABLE` is already exported so no source change was needed;
`COMMAND_USAGE` and `IO_RULES` are module-private and their four transcriptions stay ungated, which
is a real remainder and is why the docblock names only what is checked. Downstream consequence: a
story that wants the usage blocks gated exports them and adds two entries.

**Decision 22: Story 11.11's fix to the workflow guide supersedes this story's, and this story drops
its own at rebase.**
Both stories corrected the same three defects at `docs/how-to/evaluate-workflow-behavior.md:76`,
`:102` and `:122-126`. This story's version kept the page's synthetic contract and made the prose
describe the descriptor key the third message needs. Story 11.11 moved the page's provenance to
`corpus/dev/contracts/captured-read-back.json`, a contract it ships, and regenerated both wrong
messages against a real `compile` call, which makes the umbrella sentence true with no caveat and
lets a reader run all three cases from what the page shows. That is the better fix and this story
takes it.

The rebase reads the merged sentences rather than checking whether this story's edits survived, which
is the test the coordinator set and the only one that means anything when two texts differ.

**Decision 23: class 7 stays on the published pages, and the population under `src/` is one.**
The obvious next move after class 7 is to point it at source comments, since a comment naming which
kinds compile goes stale exactly the way a page does. It is declined, and the case rests on a count
that was taken three times, because the first two were both wrong.

This story grepped lines and found five. The coordinator's ruling to fix the one instance rather than
widen the gate carried its own line-level grep and reported five as well, so two independent
undercounts agreed and neither was measuring the right thing. A comment block is the unit, since a
sentence about two kinds routinely wraps and a line scan reads half a paragraph, and the peer review
scanned blocks and found ten. Ten is the number in this decision; the five in the coordinator's
instruction is a line-level undercount and is recorded here so nobody re-derives it. Eight of the ten state a structural
relationship a fifth kind would not falsify: `interface.ts:359` and `probe-policy.ts:117` contrast
operation and key shapes, `interface-inventory.ts:156` and `:177` say `api` and `web` share a
signature family, and `probe-conformance.ts:1`, `:454`, `:518`, `command-target-policy.ts:1` and
`mcp-adapter.ts:1` name a mechanism to say what a file covers.

One was a transcription of the admitted set living in a different file from the source, and it is
fixed in this pass rather than recorded. `sensitivity-witness.ts:87` said "`preflight/plan.ts` admits
`api`, `cli`, and `mcp`, rejecting `web` under `unsupported-interface-kind`", which is the tuple this
epic spent thirteen stories collapsing onto one source, restated in the file the gate was built to
protect the rest of the repository from. It now names `isSupportedInterfaceKind` as the answer's
source and states the invariant the paragraph was reaching for, that the leg shape carries one member
per port member, so opening a kind adds one to each. That survives a fifth kind untouched.
`npm run check:schemas` is green after it, since a JSDoc over a type reaches no published schema byte
and the census does not move.

One states the partition and stays: `interface-inventory.ts:24-27`, "`cli` and `mcp` declare theirs,
so both run; `web` declares none and fails here". That is the accept-and-refuse split written out,
which is what the sentence just fixed was. Two things make it the one place a list is allowed. It
sits two lines above the tuples it describes, so a reader changing one sees the other, and its own
second paragraph names the guard, "a test asserts the partition". The docblock on the source of truth
is where stating the split is most of the point.

So the honest number is one, not zero, and what holds it is proximity and a named test rather than a
gate. Widening class 7 to `src/` would mean eight exemptions to guard one sentence that is already
held. Downstream consequence: a later story that wants source comments gated has the scan, the eight
exemptions it would need, and the one instance it would be buying.

**Observation, recorded and not acted on.** `src/testing/probe-conformance.ts:6-19` states three
counts in prose: thirteen assertions for the `api` arm, nine for `cli`, eight for `mcp`. All three
are right today, and `PROBE_ASSERTIONS`, `COMMAND_ASSERTIONS` and `MCP_ASSERTIONS` hold 13, 9 and 8
entries. Nothing computes them. `check:doc-counts` holds the same shape of numeral on the published
pages and `check:doc-claims` now holds the prose there, so the numeral half of this epic's problem
has the same asymmetry the kind half had: gated in `docs/`, ungated in `src/`. Reading three array
lengths is a few lines, and it is a story rather than a paragraph in this one.

**Decision 24: the fixer is the worst reader of the fix.**
Two of the sixteen corrections in this pass were themselves false, both written by this story. The
worse of the two was inside `CHANGELOG.md`'s `[Unreleased]` entry about the `responseStatus`
description, whose own subject is a sentence that went stale from transcribing a count: the
correction added a clause claiming `sensitivity-witness.ts` "read its own set from the source", and
that file imports nothing from `interface-inventory.ts` and hand-spells the set in a comment. A
documentation pass introduced a false claim into the changelog entry about a false claim, and every
gate in the repository stayed green, because no gate reads a changelog entry's prose. The second was
a numeral: three checks named, "all four" written, in a diff whose subject is numerals being wrong.

Neither was caught by this story's own re-reading, by `check:doc-claims`, or by `npm run validate`.
Both were caught by an independent reader given the diff and asked whether each correction was itself
true. That is the whole of the lesson and it is why the second review pass was run rather than
declared unnecessary after the first came back clean on the gate.

**Decision 25: every review-held registration was audited against the test "is a predicate actually
available", and three of sixteen failed it.**
Story 11.10 got one assertion wrong twice in opposite directions and drew the conclusion this story
adopts: an exclusivity claim over a set of assertions is a joint property of several tables, and
nothing makes it fail when it stops being true. Applied to `DATED_CLAIMS`, the question is whether
any entry marked `'read'` had a predicate available and was registered as a human reading out of
convenience. Sixteen were marked `'read'` and three of them did.

`evaluate-agent-behavior.md:301`'s "a defect signature still cannot address a written file, so a
defect whose only observable is file content has no scoring-side signature today" was registered with
the reason that no predicate reads the union shape. The union is the wrong place to look. The claim
is that the qualification gate refuses an `artifact`-channel signature, and that refusal has a
published code, `condition-artifact-channel-contract-local` in `QUALIFICATION_FAILURES`. The entry
reads the registry now. Removing the code from the tuple fails the gate with the sentence named.

`what-ships.md:48`'s "A held-out probe corpus" bullet rests on a half that is a fact about the
committed tree: every contract in `corpus/dev/` is published to be read. The entry now reads
`corpus/dev/index.json` and fails if a contract the manifest names is not on disk. The other half,
whether a probe set was held out from its authors, is a fact about how it was produced and stays with
the reader, which the reason says.

`evaluate-tool-use-behavior.md:239` should not have been registered at all. "the grammar admits all
nine channels because a pointer is parsed with no contract in hand" is a statement about when parsing
happens and is true whatever compiles. It was caught by a trigger meant for "no contract in
`corpus/dev/contracts/` declares ...", so the trigger is narrowed to that and the entry is gone. A
registration that settles nothing is worse than no registration, because it puts a reason on record
for a claim that never needed one.

One upgrade was tried and reverted, and the reason is the useful part.
`evaluate-ai-feature-behavior.md:247`'s "which is implemented and not yet replicated" looks like the
same shape, and a predicate over `src/core/score/witness.ts` was written for it. The mutation test
killed it: removing the module crashed the script during import resolution before the predicate ran,
because this script imports the scoring path transitively. A predicate a real removal bypasses is not
a predicate. It is back to `'read'`, with the reason naming where each half is actually held: the
typecheck and `tests/score/witness.test.ts` hold the implemented half, and a round that was never run
leaves no artifact for the other. Downstream consequence, and it is the general form rather than a fact about this file: a guard that
cannot fire is worth nothing and looks exactly like one that can. A check asking whether something
still exists is worthless when the check itself depends on the thing existing, because the removal
it is testing for takes the check down before it can answer; here the dependency was a transitive
import and the failure was a resolution crash. The same defect reaches the tree from the other
direction, and the tail session found that one: a Zod refinement that refuses a value is worth
nothing when nothing parses the schema, since a refinement leaves no trace in the TypeScript type
and a caller hands the adapter a plain object. Both looked green. Every gate this epic found
certifying nothing had that shape, passing for a reason other than the one its name claimed, and the
only way to tell the two apart is to break the thing the gate exists to catch and watch whether it
fails.

Thirteen of twenty-six entries now settle by predicate, up from eleven of twenty-seven, and every one
of the remaining thirteen carries a reason naming what would have to exist for a check to decide it.

**Decision 26: the published pages state limits and never debts, and converting one into the other
empties six registry entries.**
`docs/explanation/what-ships.md` carried a section headed "Two things the project still owes itself",
and `docs/how-to/evaluate-ai-feature-behavior.md:245` carried the same pair in miniature. The
repository owner's instruction is that the section should not exist, because nothing should be owed.
The facts underneath were true and stay published; the framing was the defect.

The test the instruction supplies is sharp enough to apply by hand: a limit tells a reader how to
interpret a result, and a debt tells them to wait for a better version. So `corpus/dev/` being
readable is published as what a strength number measured against it means, which is that the contract
catches probes its author could read while writing it. The witness-match rule having been derived
from the records in `experiments/hypothesis-validation/` is published as the range a number it
produces covers. Both pages say those two things, the what-ships section under "How far a strength
number carries", and neither says anybody owes anybody anything.

Four other sentences failed the same test and are restated. `what-ships.md:34` and `README.md:216`
said four capabilities were "deferred until the contract layer is in real use", which tells a reader
to wait; they now say the capabilities are outside the package and that each needs a contract layer
in real use before its shape is decidable, which is the same fact as a reason. The tool-use section's
"the half that stays deferred" is now the text channel being undesigned. `docs/index.md:80` said no
live server has been scored "yet" and now says the evidence is the suite's own fixture. And
`docs/index.md:82`'s "the guide's own verdict rather than a roadmap promise" loses a rejected half
that named nothing real, which the repository's writing rule already banned and which this
instruction makes doubly wrong, since the roadmap promise is the thing being removed.

The mechanical consequence is the interesting one. Six `DATED_CLAIMS` entries went dead in one pass,
and none of them moved: a limit is not time-sensitive, so it trips no trigger and needs no
registration. The registry went from twenty-six entries to nineteen, and the sentences it lost are
the ones that stopped implying a future in which they would be false. `check:doc-claims` found every
one of the six and named it, which is the gate doing the job it was built for on a change nobody
built it for.

Two checks were retired with them and both are held elsewhere, which was verified rather than
assumed. The predicate reading `corpus/dev/index.json` for missing contracts is redundant with
`check:corpus`, which answers `corpus/dev/contracts/notes-tool-server.json: missing; run
`npm run generate:dev-corpus`` when a named contract is gone. The `web` design-pass entry is
redundant with class 7, which holds the kind's refusal from the source tuples.

Downstream consequence: the `OWED_HEADING` mechanism now guards a shape the repository has decided
against rather than one it uses, which makes it more useful rather than less. A section headed with
what the project owes fails the gate until every bullet under it is registered, and registering one
is now the moment to ask whether it should be a limit instead.

## Design Notes

The proposed replacements, written to the de-AI rule and offered as drafts for the execution pass to confirm against the artifacts.

`docs/index.md:72`:

> An eval contract describes a system through a declared interface. Three interface kinds compile today, `api`, `cli`, and `mcp`, and a guide below covers each shape people put in front of them.

`docs/index.md:80`, subject to Decision 4:

> | An MCP server answering tool calls | [Tool-use behavior](/how-to/evaluate-tool-use-behavior/) | Compiles, pre-flights, and scores. A corpus contract declares a tool server and a reference adapter passes its conformance arm. No live MCP server has been evaluated. |

`docs/index.md:84`:

> `web` is the one kind that parses and stops at compilation, under `unsupported-interface-kind`. It has had no design pass.

The cross-reference to What Ships goes, because the sentence it pointed at ("carries what tool-use support would take") describes a page section that Story 11.3 and Story 11.5 delete.

`docs/reference/glossary.md:91` carried a draft here in an earlier version of this story. It is Story 11.5's line, because opening the kind is what falsifies it, so the draft is gone and the sweep table is where this story tracks it.

The tool-use guide's shape after the rewrite. Six sections, in reading order.

1. **What you are evaluating.** The three questions the current page opens with survive almost intact: which tool was chosen (`InteractionStep`'s `operationId` and `cardinality`), whether the arguments were right (`inputBinding` and the `call-inputs` channel), and whether the result was used correctly (the response descriptor and the read-back). The fourth, `sensitivityWitness`, survives too. These paragraphs are the strongest part of the page today and the rewrite keeps them, retargeted from the borrowed HTTP shape to the operation shape Story 11.4 declared.
2. **Declaring a tool server.** The heredoc contract Stories 11.2, 11.4, and 11.5 left, with prose walking its fields.
3. **Compiling it.** The invocation and the output those stories left, unchanged by this story.
4. **Writing oracles over a tool call.** The pointer grammar section, retargeted to the descriptor Story 11.3 settled, including what an oracle may assert about a text-shaped tool result and what `collectionLocations` means for one.
5. **Running it.** Pre-flight and score, plus the adapter: what it connects to, what bounds it enforces, and the rule that a tool error result is an observation the seeded-fault check reads.
6. **Where this stands.** What ships, and one honest unproven claim, kept from the current `:238`: the calibration record behind this project's central measurement is MCP-shaped, 22 of 25 of those contracts declare an MCP tool interface, they were transcribed into API shape to be compiled here, and that block has not been re-measured against the shipped kind.

Deleted outright: "What the `mcp` kind gives you today" (`:44-77`), the three-gates table's framing, the four-bends inventory at `:145-174`, "Blocked" and "Missing" at `:232-234`, "What a first adopter hits" at `:240`, and the closing workaround at `:242`. The "In BMAD terms" section stays, corrected: TEA's contracts still declare `cli`, and the sentence that the missing piece is an interface kind for tool calls is now wrong and goes.

## Verification

**Commands:**

- `grep -rn 'unsupported-interface-kind' docs/ README.md` -- expected: every line printed is a sentence naming `web` and no other kind as refused. This is half the acceptance test.
- `grep -rn 'refused at compile' docs/ README.md` -- expected: no output, exit 1. This is the other half.
- `grep -rniE '(two|three|four|five) (interface )?kinds|api and cli' docs/ README.md` -- expected: every hit is either current or on the verified false-positive list.
- `grep -rniE 'reference adapters|conformance arm|second arm|third arm|CONFORMANCE_OUTCOME_COUNTS|twenty-one|twenty-two|nineteen|eighteen' docs/ README.md` -- expected: every count matches the artifact it describes.
- `grep -rn 'mcp' src/core/schemas/` -- expected: nine lines at 1.4.2, five of them description or comment prose and four of them code. Each prose line is current against the shipped union.
- `grep -rni 'interface kind' src/core/schemas/` -- expected: it reaches `probe.ts:109`, the one description that enumerates kinds without spelling `mcp`, whose "Version 3 opened the signature to a second interface kind" moves if Story 11.4 gave `mcp` its own signature branch.
- `grep -niE '\bapi\b|\bcli\b|\bmcp\b|\bweb\b|interface kind' docs/ad21-verdict-decision.generated.md docs/ad31-coverage-predicates.generated.md docs/ad33-outcome-decision.generated.md` -- expected: no output, exit 1, confirming the generated tables carry no kind enumeration.
- `npm run check:docs` -- expected: exit 0. It scans `README.md` and the `_bmad-output` trees for frontmatter structure and whitespace, so it gates the `README.md` edit and the learning-path edit and nothing else this story writes.
- `npm run check:doc-invocations` -- expected: exit 0, with the tool-use guide's `compile` invocation at `:137-139` reported FAITHFUL and its declared exit code matching the run, and the `preflight` and `score` fences at `:203-207` and `:209-216` reported UNFAITHFUL with the usage-error judgment, per Story 11.2's Decision 4.
- `npm run check:doc-counts` -- expected: exit 0. Story 11.8 ships it and wires it into `validate`; this story reads its output rather than re-deriving the counts it holds.
- `npm run validate` -- expected: exit 0 with nothing on stderr across all twenty-two steps. `package.json:113` chains twenty-one at 1.4.2 with `check:shareable` as step 6, and Story 11.8 adds `check:doc-counts` as the twenty-second. Re-read `package.json:113` before writing the number down, because this story runs after Stories 11.10 through 11.12.
- `npm run docs:build` -- expected: exit 0. The link check passes, `llms.txt` and `llms-full.txt` regenerate, and the astro build succeeds.

**Manual checks:**

- Read `docs/how-to/evaluate-tool-use-behavior.md` top to bottom as somebody who has installed the CLI and has an MCP server. Every instruction is one they can carry out, and no section describes work somebody else would have to do first.
- Read `_bmad-output/project-knowledge/learning-path-step-by-step.md`'s Epic 11 steps against the Epic 11 stories marked done in `_bmad-output/implementation-artifacts/`. One step and one table row each.

## What the finished documentation still says, and why

Three statements survive the epic by decision. They are restated here, at the close of the epic's last story, so a reader auditing the pages knows each is there on purpose.

**`web` stays refused.** AD-10's condition for opening a kind is that its probe semantics are declared, and nobody declared `web`'s. It fails at all three gates under `unsupported-interface-kind` with a message that names it correctly. The epic narrows that code's fireability to one kind: after Story 11.5, `web` is the only api-shaped mutation that can fire it end to end, which is why `tests/application/preflight.test.ts:139`'s deliberate mutation moved to `web` with its reason rewritten. Every surviving `unsupported-interface-kind` sentence in the documentation is about `web`, which is the acceptance test this story runs.

**Every State cell carries a verdict its own artifact supports, and the limits each story measured stay.** The three shapes whose guides recorded an evidence gap now carry shipped evidence: Story 11.10 scores a seeded defect against a skill contract with a real `strength.defect`, Story 11.11 ships a corpus contract carrying a `{ captured }` binding and a `fixtureReset` with a committed chain behind it, and Story 11.12 runs an `api` chain against a loopback fixture the suite starts. Three limits survive and each cell states its own: one `score` invocation reads one sealed run record, so every one of the three is a trial set of one marked non-comparable (`evaluate-ai-feature-behavior.md:240`); a skill whose only deliverable is a written file still cannot carry a qualifying defect signature (`evaluate-skill-behavior.md:41-43`); and the package executes nothing under evaluation, so pointing it at a third-party service is the adapter and the two arms the caller writes. `docs/index.md:82` states the rule that makes all of this readable: a state-column entry is the guide's own verdict.

**The held-out probe corpus and the second experiment round stay owed.** `docs/explanation/what-ships.md:44-49` already records both: `corpus/dev/` is visible and diagnostic, so measuring a contract against probes its author can read is a weaker claim than measuring it against probes they cannot, and the rule deciding whether a finding detected the defect its probe seeded is implemented and not yet replicated on fresh records. This epic adds four contracts to that corpus and changes neither claim.
