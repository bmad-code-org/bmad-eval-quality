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
