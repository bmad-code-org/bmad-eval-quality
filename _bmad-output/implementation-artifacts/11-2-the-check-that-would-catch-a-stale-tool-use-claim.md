---
title: 'The check that would catch a stale tool-use claim'
type: 'chore'
created: '2026-09-09'
status: 'in-review'
review_loop_iteration: 0
baseline_commit: '949e1cb4005638c9627a5faf1a5289069cbf0f2c'
context:
  - _bmad-output/implementation-artifacts/epic-11-context.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `docs/how-to/evaluate-tool-use-behavior.md:138` runs `node dist/cli/main.js compile --in
mcp-contract.json` and `:142` shows the `unsupported-interface-kind` rejection that this epic will
make false. The contract at `:84-133` is a plain fenced JSON block, and no `<!-- expect-exit: N -->`
is declared anywhere on the page. `realizeInput` (`scripts/check-doc-invocations.mjs:184-200`) finds
no `mcp-contract.json` in the repository and none written by an earlier command on the page, so it
substitutes `SAMPLE_INPUT` (`:76-79`, `corpus/dev/compile-seal-example/contract.json`) and marks the
run UNFAITHFUL. Measured today, that substituted run exits **0**, and the page claims 4. The check
reports `32 invocation(s) scanned across 17 doc file(s), 10 run faithfully over real inputs, 0
failures`. Opening the `mcp` kind later in this epic would not move any of those numbers, and the
false claim at `:142` would ship in silence.

**Approach:** Turn the contract fence into a `cat > mcp-contract.json <<'EOF'` heredoc so the file
the command names is one the page told its reader to create, and declare `<!-- expect-exit: 4 -->` on
the line before the bash fence in the spelling `docs/how-to/author-behavioral-contracts.md:82` and
`docs/tutorials/getting-started.md:66` already use. The heredoc body has to be a complete
`EvalContract`: the fence today holds a `PermittedInterface`, and compiling those bytes verbatim
exits 5 under `schema-parse-failure` with `Unrecognized keys: "logicalId", "kind", "operations"` and
twenty-one absent top-level fields, of which the report names nineteen and elides the rest behind
`... and 2 more`. A complete contract carrying the same interface exits 4 with bytes identical to
`:142`, `logicalId=notes-tool-server` included. Both results were measured by writing the fence bytes
at `:85-132` to a file and running them through `dist/cli/main.js` at 1.4.2, before this story was
written.

## Boundaries & Constraints

**Always:**

- The declared code is 4, measured against the built binary before it is written down.
  `EXIT_STRUCTURAL_FAILURE = 4`
  (`src/cli/exit-codes.ts:15`) and `checkInterfaceKind` (`src/core/compile/interface-inventory.ts:33-45`)
  throws `StructuralFailure`.
- The heredoc contract carries exactly one operation. `checkDuplicateOperationSignature` runs at
  `src/core/compile/compile.ts:121` and `checkInterfaceKind` at `:128`, so a second tool rendering the
  same `POST /tools/call` identity fires `duplicate-operation-signature` first, which is the message
  the page's own text fence at `:156-158` shows.
- The declaration sits on the last non-empty line before the fence. `extractActions` reads `previous`
  at `scripts/check-doc-invocations.mjs:276`, and both precedents put one blank line between the
  comment and the fence.
- Completeness is part of this story: every other page in `docs/` and `README.md` carrying the same
  unfaithful shape is found by grep, listed with its file and line in the Code Map, and marked fixed
  or left with the reason.
- Documentation moves with this story. The learning-path step is added in this diff.
- The voice pass runs while writing. The negation-then-correction antithesis is banned in
  every form: `X, not Y`, `X rather than Y`, `X instead of Y`, `X, never Y`, `as opposed to`, `no
  longer`. After editing, grep the edited files for those strings and confirm every surviving hit is
  a real before/after contrast where both halves carry a fact.
- Pruned and refined, beyond updated: text this change makes redundant is cut in the same pass.

**Ask First:**

- Any change to `scripts/check-doc-invocations.mjs`. The check's rules are the thing this story is
  measured by, and a story that edits its own gate proves nothing.
- Any change to the page's prose about what the `mcp` kind can do. That prose is Story 11.9's.

**Never:**

- No product behaviour ships here. No file under `src/` is touched, no schema moves, no failure code
  changes, and no interface kind opens.
- The page's prose still describes a refused kind, because nothing opens `mcp` until Story 11.5. The
  rejection at `:142` is true at 1.4.2 and stays on the page.
- No generated page is hand-edited. `docs/*.generated.md` and `corpus/dev/README.md` come from their
  generators.
- No second heredoc duplicating the interface. One copy of the declaration lives on the page.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| The page today | `:84-133` a `json` fence, `:138` naming `mcp-contract.json`, no declaration | `SAMPLE_INPUT` substituted, run exits 0, UNFAITHFUL, no failure recorded | Silent; this is the defect |
| Heredoc carrying the fence bytes verbatim | `cat > mcp-contract.json <<'EOF'` over `:85-132` | Exit 5, `schema-parse-failure`, `Unrecognized keys: "logicalId", "kind", "operations"`, and twenty-one absent top-level fields: nineteen named, then `... and 2 more` | Fails the check under a declared 4 |
| Heredoc carrying a complete contract | The same interface nested under `permittedInterfaces`, plus the other twenty top-level fields | Exit 4, stderr byte-identical to `:142` | Reported faithful |
| Declared code the run does not produce | `<!-- expect-exit: 5 -->` over the same run | Check exits 1: `exited 4, and the block declares expect-exit 5` (`check-doc-invocations.mjs:432`) | This is the armed gate |
| Declaration with prose between it and the fence | Comment, blank line, sentence, fence | `previous` holds the sentence, no declaration parsed, run judged against 0 and fails | Keep the comment on the last non-empty line |
| Two tool operations in the heredoc contract | Both rendering `POST /tools/call` | `duplicate-operation-signature` at `compile.ts:121` wins before `checkInterfaceKind` at `:128` | Exit 4 under the wrong code; keep one operation |
| Story 11.4 lands | The operation shape retypes | The heredoc contract stops parsing; exit 5 against a declared 4 | Story 11.4 updates the fence and the declared code in its own diff |
| Story 11.5 lands | The kind opens | The contract compiles; exit 0 against a declared 4 | Story 11.5 removes the declaration in its own diff |

</frozen-after-approval>

## Checkpoint decisions taken without the human

The build ran unattended by standing instruction, so the two gates this workflow halts at were decided here and recorded in this section.

**Multi-goal gate: single goal, no split.** The spec has one shippable deliverable, making one documented invocation faithful so its declared exit code is judged. The learning-path step and the caption edits are the same goal's own documentation, which this repository requires in the same diff.

**Token-count gate: keep the full spec.** It is well past 1600 tokens, and the excess is Code Map and recorded decisions rather than scope. Cutting it would delete the enumeration of the twenty-two unfaithful invocations, which is what Acceptance Criterion 6 is graded against, and the four decisions later stories in this epic inherit. The context-rot risk the gate names is mitigated by the story being implemented in the session that planned it.

**Open Questions: none.** The spec carried no entry, and investigation settled everything the intent left open. The one measurement the plan depended on, that a complete contract carrying the page's interface exits 4 with stderr byte-identical to the page's text fence, was rerun against the built binary before any file was edited.

## Code Map

Every `docs/how-to/evaluate-tool-use-behavior.md` line number below was written twenty-one lines
early, because Story 11.1's edits to the page landed between the spec's reading and this one. Each
citation was matched by its text and the number it carries in the tree at implementation time is
given beside it, in brackets.

**The page this story edits**

- `docs/how-to/evaluate-tool-use-behavior.md:84-133` [`:105-154`] -- the `json` fence. Lines `85-132` are a
  `PermittedInterface` with `logicalId: "notes-tool-server"` and one operation, `search-notes`, whose
  `sensitivityWitness` at `:113-129` is what keeps `checkUndeclaredMandatoryInput` and
  `checkSensitivityWitnessDeclared` (`compile.ts:122-125`, strict-mode only) quiet. This fence becomes
  the heredoc.
- `docs/how-to/evaluate-tool-use-behavior.md:135` [`:156`] -- the caption, "Compile a contract carrying it and
  you get the one coded rejection". It now introduces the contract the reader writes, so it moves by
  one sentence and the `:81-82` caption above the fence moves with it.
- `docs/how-to/evaluate-tool-use-behavior.md:137-139` [`:158-160`] -- the bash fence. `<!-- expect-exit: 4 -->` and
  one blank line go above `:137`.
- `docs/how-to/evaluate-tool-use-behavior.md:141-143` [`:162-164`, `:191-193` after the edit] -- the text fence carrying the rejection.
  Unchanged, and it is what the declared 4 pins.
- `docs/how-to/evaluate-tool-use-behavior.md:203-207,209-216` [`:253-257,259-266` after the edit] -- the `preflight` and `score` fences.
  They name `eval-contract.json`, `probes.json`, `observations.json`, and six more files the page
  never writes, so both stay UNFAITHFUL and both keep the usage-error judgment only. This story
  leaves them: making them faithful means authoring a probe list, an observation list, a sealed run
  record, a scoring policy, an isolation manifest, and an evaluator configuration on a page whose
  subject is a kind that compiles for nobody. Decision 4 records the choice, and Story 11.9 cites it
  when it narrows its faithfulness acceptance criterion.

**The check that judges it**

- `scripts/check-doc-invocations.mjs:20-34` -- the FAITHFUL and UNFAITHFUL rules in full. `:23` is
  "a faithful run is the page's own claim, so it has to exit 0"; `:29-31` is the declared-code rule
  in both directions; `:32-34` is the stand-in rule this page falls under today.
- `:36-41` -- document-order replay per page. `cat > path <<'EOF'`, `echo ... > path`, and `mkdir -p`
  take effect, and every path is rebased into a per-page sandbox first.
- `:73` `ROOTS = ['README.md', 'docs']`; `:76-79` `SAMPLE_INPUT`; `:104` `INSTALLED_PREFIX`; `:106`
  `EXPECT_EXIT_PATTERN`; `:161-172` `createPageSandbox`; `:184-200` `realizeInput`, whose branch
  order is installed prefix, repository-shipped, sandbox-authored, then stand-in; `:276` the
  declaration read off `previous`; `:298` the heredoc regex, which requires the delimiter to be a
  bare word; `:417-425` the unfaithful branch; `:426-434` the judged branch.
- `package.json:113` -- `validate`, with `check:doc-invocations` fifth in the chain.

**The two precedents, and why the difference matters**

- `docs/how-to/author-behavioral-contracts.md:82` -- `<!-- expect-exit: 4 -->`, blank line, then a
  bash fence at `:84-86` running `compile --in corpus/dev/contracts/empty-request-shapes.json`. That
  path is repository-shipped, so `realizeInput` resolves it at `:193-194` and the run is faithful
  without a heredoc.
- `docs/tutorials/getting-started.md:66` -- the same spelling, blank line, fence at `:68-70` running
  `compile --in node_modules/eval-quality/corpus/dev/contracts/no-state-change-marker.json`, resolved
  through `INSTALLED_PREFIX` at `:188-190`.
- Neither precedent needs a heredoc, because neither names a file only its reader has. The tool-use
  page names `mcp-contract.json`, so its only route to faithful is `realizeInput`'s sandbox-authored
  branch at `:196-197`, which the heredoc is what fills.
- `docs/how-to/author-behavioral-contracts.md:150-161` -- the one heredoc in the published docs today,
  `cat > /tmp/eval-quality-run/observations.json <<'JSON'` inside a ```bash fence, one object per
  line. That is the compaction precedent for this story's scaffolding fields.

**Every other unfaithful invocation, checked against the same shape**

Twenty-two of the thirty-two scanned invocations are unfaithful. Each was read against its page to
see whether the page fences the input the command names.

- `README.md:140,142,144,148` -- `contract.json`, `probes.json`, `observations.json`, `record.json`,
  `probe.json`, `preflight-verdict.json`, `policy.json`. `README.md:133-152` is the only fenced
  region near them and it holds commands. The page fences no input. Not the same shape.
- `docs/how-to/author-behavioral-contracts.md:219` and `:318,319,325,328,338,344` -- the score example
  and the mutation-round recipe, naming `sealed-run-record.json`, `contract.json`,
  `clean-probes.json`, `mutated-probes.json`, `clean-record.json`, `mutated-record.json`. No fence on
  that page carries any of them. Not the same shape.
- `docs/how-to/evaluate-agent-behavior.md:262,277` -- the page's three `json` fences at `:89`, `:191`,
  and `:230` are a `PermittedInterface`, a probe leg, and a defect signature, introduced at `:87`,
  `:189`, and `:228` as schema shapes. None is named by a command. Not the same shape.
- `docs/how-to/evaluate-ai-feature-behavior.md:206,213` -- fences at `:51` and `:118` are a
  `PermittedInterface` and one oracle expression. Not the same shape.
- `docs/how-to/evaluate-skill-behavior.md:203,214` -- fences at `:57`, `:125`, and `:138` are a
  `PermittedInterface` and two oracle halves. Not the same shape.
- `docs/how-to/evaluate-workflow-behavior.md:193,203` -- the fence at `:42` is an `InteractionStep`
  array. Not the same shape.
- `docs/how-to/evaluate-tool-use-behavior.md:138` [`:159`, `:188` after the edit] -- the one page where a fenced input and a command
  naming it sit five lines apart, and where the text fence beneath reads as that command's own
  output. This story fixes this one, because it is the claim the epic's behaviour change contradicts.

**Prose about the check, read and confirmed unchanged**

- `scripts/check-doc-invocations.mjs:3-44` -- the header describes the rule, and arming one page does
  not change the rule. Nothing moves.
- `_bmad-output/project-knowledge/learning-path-step-by-step.md:2188-2189` -- "The documentation site
  is generated from `docs/`, and `npm run check:doc-invocations` runs every fenced CLI line in it
  against the built binary." True before and after.
- `docs/reference/cli-commands.md` -- grepped for `doc-invocations` and `faithful`; no hit. Nothing
  published describes what the check guarantees, so nothing there moves.

**The learning path**

- `_bmad-output/project-knowledge/learning-path-step-by-step.md:3698` -- Step 44 is the highest
  heading, `epic10-story1`, in a 3730-line file. The step table runs `:43-88` and its last row is
  Step 44's, added on this branch. The table is current, so this story adds one row, its own.
- `_bmad-output/project-knowledge/learning-path-template.md` -- the shape to follow, including the
  ban on repository vocabulary inside `In plain terms`.

## Tasks & Acceptance

**Execution:**

- [x] `docs/how-to/evaluate-tool-use-behavior.md` -- turn the `:84-133` fence into a ```bash fence
      holding `cat > mcp-contract.json <<'EOF'`, a complete `EvalContract`, and `EOF`. The `mcp`
      interface stays pretty-printed and nests under `permittedInterfaces`; the other twenty
      top-level fields are written compactly, one field per line where the value is a scalar or a
      short collection, following `author-behavioral-contracts.md:150-161`. One operation only.
- [x] `docs/how-to/evaluate-tool-use-behavior.md` -- add `<!-- expect-exit: 4 -->` and one blank line
      above the bash fence at `:137`.
- [x] `docs/how-to/evaluate-tool-use-behavior.md` -- move the captions at `:81-82` and `:135` so they
      introduce a contract the reader writes, and cut whatever those two sentences now say twice.
- [x] `_bmad-output/project-knowledge/learning-path-step-by-step.md` -- add this story's step per
      `learning-path-template.md`, teaching why a documented example naming a file only its reader
      has proves nothing. Add the step's own table row at `:43-88`, below Step 44's.
- [x] Voice and prune pass over every line of prose this story writes, done while writing. Then grep
      the edited files for `, not `, `rather than`, `instead of`, `as opposed to`, `, never `, and
      `no longer`, and confirm every hit is a real before/after contrast with a fact on both sides.

**Acceptance Criteria:**

- Given the edited page, when `npm run check:doc-invocations` runs, then it reports 32 invocations
  scanned across 17 doc files and **11** run faithfully, up from 10, with 0 failures.
- Given `<!-- expect-exit: 4 -->` flipped to a code the run does not produce, when the check runs,
  then it exits 1 naming `docs/how-to/evaluate-tool-use-behavior.md` and the declared code, which is
  what proves the gate is armed; the declaration is then restored.
- Given the heredoc contract, when `compile` runs over it, then stderr is byte-identical to the text
  fence at `:141-143`, including `logicalId=notes-tool-server`, so the page's shown output and its
  executed output are the same bytes.
- Given `npm run validate`, when it runs, then it exits 0, and no file under `src/` appears in the
  diff, so the story ships documentation alone.
- Given `npm run docs:build`, when it runs, then it exits 0 over the changed fence language.
- Given `docs/` and `README.md`, when they are grepped for a fenced input a later command names
  without a heredoc, then the Code Map lists every unfaithful invocation with its file and line and
  says for each whether this story fixes it and why.
- Given the learning path, when the step is read, then it follows `learning-path-template.md`, its
  `In plain terms` block carries no repository vocabulary, and its table row is present.
- Given the edited files, when they are grepped for the banned constructions, then every surviving
  hit is a contrast where both halves carry a fact.

## Decisions settled by construction

**Decision 1: the heredoc carries a complete `EvalContract`, and the fence's teaching content
survives inside it.** The fence at `:84-133` is a `PermittedInterface`. Written to disk verbatim and
compiled, it exits 5 under `schema-parse-failure` reporting `Unrecognized keys: "logicalId", "kind",
"operations"` and twenty-one absent top-level fields, so a heredoc over those bytes would arm the gate against
the wrong code and the page's own text fence at `:142` would still be unproven. Both routes out were
weighed. A second heredoc beside the existing fence duplicates the forty-eight-line interface on one
page, and two copies drift. Nesting the same interface inside a complete contract keeps one copy, and
the fence a reader copies becomes the one that runs. The cost is measured: a minimal complete
contract is 224 pretty-printed lines against 48 today, so the twenty scaffolding fields are written
compactly and the interface keeps its indentation, because the interface is the page's subject. The
fence language moves from `json` to `bash`, which is the honest label for a block whose first line is
a shell command and is what `author-behavioral-contracts.md:150` already uses for its heredoc.
Downstream consequence: Stories 11.4 and 11.5 edit one fence each.

**Decision 2: arming this gate makes the page an executed input to every later story in the epic, and
each later story pays for that in its own diff.** `check:doc-invocations` is fifth in
`validate` (`package.json:113`), so from this story onward every gate run in Epic 11 compiles the
tool-use page's contract and compares the exit code with the declared 4. Two later stories break that
deliberately. **Story 11.4** gives `mcp` its own operation shape, and the page's HTTP-shaped contract
stops parsing: the run exits 5 against a declared 4 and the check fails. Story 11.4 rewrites the
heredoc's operation and updates the declared code in the same diff. **Story 11.5** opens the kind at
`checkInterfaceKind`, and the declared rejection stops firing: the contract compiles at exit 0 against
a declared 4 and the check fails again. Story 11.5 removes the `<!-- expect-exit: 4 -->` line in the
same diff, since `check-doc-invocations.mjs:427` judges an undeclared faithful run against 0. Each
story therefore leaves `npm run validate` green at its own boundary, and neither may defer its fence
edit. The prose rewrite that retires the page's refused-kind narrative stays in Story 11.9, which
depends on this story for its proof.

**Decision 3: the heredoc contract carries one operation, and the reason is check order.**
`checkDuplicateOperationSignature` runs at `compile.ts:121`, seven checks ahead of `checkInterfaceKind`
at `:128`. The page at `:152-158` teaches that two MCP tools declared honestly collide under
`duplicate-operation-signature` on the shared `POST /tools/call` identity, and a heredoc contract
carrying both tools would fire that code and exit 4 for a reason the text fence at `:142` does not
describe. Two invocations exiting 4 for two different reasons is a gate that passes while the page is
wrong, which is the failure class this story exists to close. So the contract declares `search-notes`
alone, and the collision stays where it is today, in an unexecuted text fence. Downstream
consequence: Story 11.9, which owns the page's prose, keeps the collision example as prose and does
not promote it to a second heredoc.

**Decision 4: twenty-one of the twenty-two unfaithful invocations stay unfaithful, and each is
recorded.** Twenty-two of the thirty-two scanned invocations are unfaithful today, this page's
`compile` at `:138` among them. That one becomes faithful, and the remaining twenty-one do not. The
Code Map lists every one with its file and line. None shares this page's shape: every other `json`
fence in `docs/` is a schema fragment introduced as one, and no command on any of those pages names
it as a file.

Two of the twenty-one are on the page this story arms, so name them exactly. The `preflight` fence at
`docs/how-to/evaluate-tool-use-behavior.md:253-257` and the `score` fence at `:259-266` both stay
UNFAITHFUL after this story, and both keep the usage-error judgment at
`check-doc-invocations.mjs:413-416` and no exit-code judgment. Making them faithful costs six
authored artifacts: a probe list, an observation list, a sealed run record, a scoring policy, an
isolation manifest, and an evaluator configuration, each one a schema-valid document that would then
need maintaining through every schema bump this epic ships. Those two fences document command
grammar, and the usage-error judgment already holds the grammar. Story 11.9 owns the page's prose and
cites this decision when it narrows its faithfulness acceptance criterion to the invocations that
are faithful, which after this story is the `compile` fence at `:187-189` alone. One near-miss is
recorded and left:
`docs/how-to/evaluate-skill-behavior.md:55` claims its fence "compiles at exit 0" over a block that is
a `PermittedInterface`, and because no command on that page names the block, `check:doc-invocations`
cannot reach the claim. It is a prose defect with no invocation behind it, and it belongs to whoever
owns that guide's evidence. Downstream consequence: this epic's later stories inherit one armed page,
so a failing `check:doc-invocations` in Epic 11 always points at `evaluate-tool-use-behavior.md`.

## Design Notes

The organising idea is that this check has two judgments and only one of them was reaching this page.
Every invocation is judged for usage errors and crashes, because those are about the command line
alone. Only a faithful invocation is judged for its exit code, because only then is the exit code the
page's own claim. `docs/how-to/evaluate-tool-use-behavior.md:138` was getting the first judgment and
skipping the second, so the page could show a 4 while the check silently observed a 0 over a
substituted contract that compiles cleanly. The heredoc is what moves the invocation from the first
judgment to the second, and the declaration is what tells the second judgment which number to expect.

Two numbers make the before and after concrete. Before: `32 invocation(s) scanned across 17 doc
file(s), 10 run faithfully over real inputs, 0 failures`, with the tool-use compile exiting 0 inside
that silent twenty-two. After: 32 scanned, 11 faithful, 0 failures. The scanned count holds because a
heredoc pushes a `kind: 'write'` action at `check-doc-invocations.mjs:307-311`, and only `kind: 'run'`
actions reach the counter at `:381`.

The deliberate-failure step is the only evidence that the gate is armed. A green check proves the
declared code matched; it does not prove a declaration was read at all, since an absent declaration
also passes when the run exits 0. Flipping the code and watching `check-doc-invocations.mjs:432`
report `exited 4, and the block declares expect-exit 5` is what separates those two states.

## Verification

**Commands:**

- `npm run build` -- expected: exit 0. `check-doc-invocations.mjs:64-70` skips itself when
  `dist/cli/main.js` is absent, so an unbuilt tree reports a pass that means nothing.
- `npm run check:doc-invocations` -- expected: exit 0 reporting 32 invocations scanned across 17 doc
  files, 11 run faithfully, 0 failures.
- Flip `<!-- expect-exit: 4 -->` to `<!-- expect-exit: 5 -->`, run `npm run check:doc-invocations`
  again -- expected: exit 1, one failing invocation, reason `exited 4, and the block declares
  expect-exit 5`, located at `docs/how-to/evaluate-tool-use-behavior.md`. Restore the 4 and confirm
  the check returns to exit 0. This is the step that proves the gate is armed.
- `node dist/cli/main.js compile --in <the heredoc body written to a file>` -- expected: exit 4 and
  stderr byte-identical to the page's text fence at `:141-143`.
- `npm run docs:build` -- expected: exit 0. `validate` does not build the website, and the fence
  language changed.
- `grep -nE ', not |rather than|instead of|as opposed to|, never |no longer' docs/how-to/evaluate-tool-use-behavior.md _bmad-output/project-knowledge/learning-path-step-by-step.md`
  -- expected: every hit is a before/after contrast with a fact on both sides, checked by reading.
- `git diff --name-only` -- expected: no path under `src/`, `schemas/`, or `corpus/`.
- `npm run validate` -- expected: exit 0 with nothing on stderr.

**Measured, against the tree at this commit.** Every expectation above held.

- `npm run build` -- exit 0.
- `npm run check:doc-invocations` -- exit 0, `32 invocation(s) scanned across 17 doc file(s), 11 run
  faithfully over real inputs, 0 failures`, up from 10 faithful before the edit.
- The armed-gate step -- with the declaration flipped to 5, exit 1 and one failure:
  `docs/how-to/evaluate-tool-use-behavior.md:188 [exited 4, and the block declares expect-exit 5]
  node dist/cli/main.js compile --in mcp-contract.json`. Restored to 4, exit 0 and 11 faithful again.
- The heredoc body extracted from the page and compiled -- exit 4, and `diff` against the page's text
  fence reports no difference, `logicalId=notes-tool-server` included. Same result under `--strict`.
- The two measurements Decisions 1 and 3 rest on were rerun rather than inherited. The interface
  object alone exits 5 under `schema-parse-failure` with `Unrecognized keys: "logicalId", "kind",
  "operations"` and `... and 2 more` at the end of the list. A second tool rendering `POST
  /tools/call` exits 4 under `duplicate-operation-signature`, before the kind check.
- `npm run docs:build` -- exit 0.
- The banned-construction grep over the added lines only -- no hits. The hits in the two files as a
  whole are all pre-existing lines this story did not write.
- `git diff --name-only` -- `docs/how-to/evaluate-tool-use-behavior.md`,
  `_bmad-output/project-knowledge/learning-path-step-by-step.md`, this file, and
  `_bmad-output/implementation-artifacts/sprint-status.yaml`. Nothing under `src/`, `schemas/`, or
  `corpus/`.
- `npm run validate` -- exit 0, nothing on stderr, 116 test files and 3787 tests passing.

**One divergence from the Code Map, recorded.** Every line number the spec cites for
`docs/how-to/evaluate-tool-use-behavior.md` is off by twenty-one: the fence is at `:105-154`, the
caption at `:156`, the bash fence at `:158-160`, and the text fence at `:162-164`. Story 11.1's
edits to the page landed between the spec's reading and this one. The content each citation names is
unambiguous and was matched by text, so nothing else in the plan moved. After this story the
declaration sits at `:185` and the compile fence at `:187-189`.
