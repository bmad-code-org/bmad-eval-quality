---
title: 'Whether tool-use evaluation is one gap or two'
type: 'chore'
created: '2026-09-09'
status: 'done'
review_loop_iteration: 0
context:
  - _bmad-output/implementation-artifacts/epic-11-context.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `docs/index.md:80` gives the tool-use row the verdict "Declared and refused at compile", and one row is carrying two questions. Reading one asks whether an agent's tool use was correct: the system under test is the agent behind a command, the tool calls it made are a file that command wrote, and `CommandOperation.artifacts` (`src/core/schemas/interface.ts:239-243`) already declares such a file with `descriptorChannel` (`:244`) nominating which one carries declared structure. Reading two asks whether the MCP server itself is correct: the system under test is the tool server, and only the `mcp` kind can describe it. The epic sized Stories 11.3 through 11.8 against the merged pair without testing the first half, so it may be building an interface kind for a question the shipped `cli` kind already answers.

**Approach:** Attempt reading one end to end as a run. The epic sized this half by reasoning about it; this story invokes it against real bytes. Author a `cli` contract whose one operation declares a tool-call log in `artifacts`, address that log from an oracle, and put the contract through `compile`, `seal`, `preflight`, and probe qualification. Two addressing routes exist and both are attempted in order. The identifier route names the log through `/interactions/{stepId}/artifact/{id}` and is the shape the epic assumed. The descriptor-channel route is the one `qualification.ts:334-338` names, where "a signature reaches a written file through the descriptor channel of whatever operation it binds, which is kind-neutral and needs no identifier". The story ends on one of two outcomes, each carrying its transcribed evidence: reading one compiles and scores, and the story records what re-scopes; or reading one is demonstrably impossible, and the refusing code, its artifact path, and its message are quoted from the run.

## Boundaries & Constraints

**Always:**

- Every claim in this file is read from the source or transcribed from a run before it is written down. The epic register requires it, and `epic-9-context.md`'s reason holds here too: a confident wrong claim about what the shipped kind can express is worse than a gap, because it is the claim that stops anyone checking.
- Both routes are attempted, in the order the Approach gives, and the story states which one the worked example ends on. A single-route attempt cannot distinguish "reading one is impossible" from "reading one was authored one way".
- Every refusal is quoted verbatim from the run: the failure code, the `artifactPath`, and the `detail` string, in the spelling `QualificationFailure` (`src/core/score/qualification.ts:84-89`) produces.
- The finding names the story that inherits it, per the epic register's dependency section.
- The worked contract is authored against the published schema and the built CLI, so `npm run build` runs first and every invocation goes through `dist/cli/main.js`, which is the surface an adopter has.
- Documentation moves with this story. Every published sentence this story's finding makes false or incomplete is corrected in the same change, named in the Execution list with its current text, its line number, and what it becomes. The epic register's own rule is that prose the code contradicts is a defect; a finding that contradicts prose is the same defect.
- Updated is the floor. Every doc pass also prunes: text the correction makes redundant is cut in the same edit, so a page never carries the old framing beside the new one.
- The learning-path step follows `_bmad-output/project-knowledge/learning-path-template.md`, written after the peer review's findings are addressed and before the human reviews locally.
- The voice pass runs while the text is written. The banned construction is negation-then-correction in every form: "X, not Y", "X rather than Y", "X instead of Y", "X, never Y", "no longer". After editing, grep each edited file for `, not `, `rather than`, `instead of`, `as opposed to`, `, never `, `no longer` and confirm every hit is a real before/after contrast whose two halves each carry a fact.

**Ask First:**

- Deleting or deferring any of Stories 11.3 through 11.8. This story measures and records what each one would still owe; removing a planned story from the epic is the human's call.
- Any edit to `docs/index.md`'s five-shape routing table. Its tool-use verdict at `:80` stays literally true through this story, which opens nothing, and Story 11.9 owns the row.

**Never:**

- No product code, in either outcome. Nothing under `src/`, `tests/`, `corpus/`, `schemas/`, `scripts/`, or `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md` changes. The deliverable is the worked example, the corrected pages, and the recorded finding.
- No edit to `docs/how-to/evaluate-tool-use-behavior.md:84-133` or `:137-143`. The contract fence and the declared invocation are Story 11.2's, which arms them as an executed input to `npm run validate`.
- No hand-edit of a generated page. `docs/*.generated.md` and `corpus/dev/README.md` come from their generators, and this story runs none.
- No fixture and no corpus member. The authored contract, probe, and observations live in an untracked scratch directory outside the repository working tree and are quoted in this file. Whether a tool-use exemplar joins `DEV_CORPUS_CONTRACTS` (`tests/coverage/fixtures/corpus.ts:555-559`) is Story 11.8's decision.
- No new AD-5 code, no new qualification failure code, no spine revision, and no new ADR.
- No softening of a refusal. If the identifier route fails, the failure is the finding and it is recorded whole. Substituting a signature that qualifies and discriminates nothing is the move `docs/how-to/evaluate-agent-behavior.md:320` records TEA declining to make.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Reading one, as authored | A `cli` contract, one operation, `artifacts: ['tool-calls']`, `descriptorChannel: { kind: 'artifact', artifactId: 'tool-calls' }`, a descriptor declaring `calls` with a `collectionLocations` entry | `compile --in` exits 0 and emits the compiled contract | N/A |
| Oracle into the nominated log | A `for-all` over `/interactions/run/artifact/tool-calls/calls` | Reachable: the pointer descends through the operation's one descriptor (`src/core/compile/reachability.ts:405-410`) | N/A |
| Oracle into a second declared file | A tailed pointer at a declared artifact the `descriptorChannel` does not nominate | Unreachable, "declares it writes but declares no structure for" (`reachability.ts:395-402`) | Structural failure |
| Pointer at an undeclared file | `/interactions/run/artifact/transcript/...` with `transcript` absent from `artifacts` | `unresolved-artifact-reference` naming the operation (`src/core/compile/interface-inventory.ts:157-161`) | Structural failure |
| Seal over the same contract | `seal --in` | A brief whose direction names the command, exit 0 | N/A |
| Pre-flight witness over the log | A sensitivity witness whose legs address the artifact pointer, the shape `tests/schemas/fixtures/command-contract.ts:250-270` already carries | A plan of command probe requests; a witness may address an artifact freely (`docs/how-to/evaluate-agent-behavior.md:76-77`) | N/A |
| Route A: signature names the log | A defect probe whose condition names `/interactions/observed/artifact/tool-calls/calls` | `condition-artifact-channel-contract-local` (`qualification.ts:339-343`), transcribed with its path and detail | Qualification failure; AD-9 keeps the probe out of a sealed set |
| Route A, bare identifier | The same condition with no tail: `/interactions/observed/artifact/tool-calls` | The same code. The identifier alone is what the check reads (`tests/score/qualification.test.ts:876-883`) | Qualification failure |
| Route B: signature on the nominated stream | The log printed as JSON on standard output, `descriptorChannel: { kind: 'stream', channel: 'stdout' }`, the condition over `/interactions/observed/stdout/calls` | Qualifies with an empty failure list (`tests/score/qualification.test.ts:897-904`) | N/A |
| Route B with the file still declared | `artifacts` still names the log for existence assertions and witness legs while the signature rides `stdout` | Qualifies; artifact evidence stays available to the oracle and to pre-flight | N/A |
| A condition that names only what was sent | A predicate over `call-inputs` alone | `condition-channels-underspecified` (`qualification.ts:496-500`) | Qualification failure |
| Reading two, same contract | The authored contract with `kind` flipped to `mcp` | `unsupported-interface-kind`, unchanged by this story (`interface-inventory.ts:33-45`) | Structural failure |

</frozen-after-approval>

## Code Map

Every line number below was read from this tree at 1.4.2.

**What declares the log**

- `src/core/schemas/interface.ts:230-252` -- `CommandOperation`. `artifacts` at `:239-243` is "the files the operation writes, as bare declared identifiers with existence semantics only"; `descriptorChannel` at `:244` says which output channel the operation's one `ResponseDescriptor` (`:45-70`) describes.
- `src/core/schemas/interface.ts:197-210` -- `CommandDescriptorChannel`, a union of `{ kind: 'stream', channel: 'stdout' | 'stderr' }` and `{ kind: 'artifact', artifactId }`. These are the two routes, at their source.
- `src/core/declared-inputs.ts:33-41,49-57,83-97` -- `descriptorChannelOf`, `descriptorArtifactOf`, `declaredArtifactsOf`. `descriptorChannelOf` collapses an artifact nomination to the bare channel name `artifact`, which is why the descriptor-channel route reaches a stream by name and reaches a file only through an identifier.

**The pointer grammar, which is where the routes diverge**

- `src/core/schemas/pointer.ts:107-108` -- `IDENTIFIER_ROOTED_CHANNEL = 'artifact'`, and `:96-106` is the reason: an artifact channel "names one of several things" so the pointer names which one before its tail.
- `src/core/schemas/pointer.ts:167` -- `INTERACTION_POINTER_PATTERN`. The artifact alternative is `artifact/{identifier}{tail}`, so the identifier segment is mandatory at the grammar level. There is no reserved spelling meaning "the artifact this operation describes".
- `src/core/schemas/pointer.ts:119-130` -- `API_RESPONSE_CHANNELS` and `COMMAND_RESPONSE_CHANNELS`. `artifact` is a command response channel, so an api signature naming one is wrong twice.

**Where the identifier route is refused**

- `src/core/score/qualification.ts:324-344` -- the check. `:325-338` is the comment the epic register quotes, including "The restriction lifts the day the vocabulary reserves an identifier meaning 'the artifact this operation describes', the way `OBSERVED_STEP_ID` reserves one for the step. Until then a signature reaches a written file through the descriptor channel of whatever operation it binds, which is kind-neutral and needs no identifier." `:339-343` is the push, `:342` the detail template.
- `src/core/score/qualification.ts:72` -- `condition-artifact-channel-contract-local` in `QUALIFICATION_FAILURES`, the closed reason set at `:59-80`.
- `src/core/score/qualification.ts:147-151` -- `foreignChannels`, which gives a `cli` signature the four command response channels and every other kind the three api ones. A `cli` signature may name `stdout`, `stderr`, `exit-code`, and `artifact`; only the last carries an identifier.
- `src/core/score/qualification.ts:473-501` -- `checkChannels`, the rule a workable signature has to satisfy alongside the artifact rule: the predicate names the declared response-side `observableChannel`, or names two channels with one on the response side.
- `src/core/score/qualification.ts:727-730` -- `qualifyProbe`, the entry point the attempt calls, and `:818-833` `sealProbeSet`, which is where AD-9's "an unqualified probe cannot enter a sealed set" is applied.

**What already proves the two routes behave as described**

- `tests/score/qualification.test.ts:824` -- the describe block. `:863-865` qualifies the command fixture as authored; `:867-874` and `:876-883` reject the tailed and the bare artifact pointer under the same code; `:885-895` pins the detail and the artifact path; `:897-904` shows `stdout` and `stderr` passing untouched.
- `tests/schemas/fixtures/command-contract.ts:191-275` -- `artifactCommandContract`, the closest existing shape to what this story authors: two declared artifacts, `verdict` nominated at `:249`, an oracle quantifying over the nominated file at `:216-238`, and a sensitivity witness whose legs address artifact pointers at `:250-270`.
- `src/core/compile/reachability.ts:378-411` -- the artifact branch. `:390` rejects an undeclared identifier, `:395-402` rejects a tail into a declared file the descriptor does not nominate, `:405-410` descends through the descriptor for the nominated one.
- `src/core/compile/interface-inventory.ts:128-163` -- `checkArtifactReferences`, both sites that mint `unresolved-artifact-reference`.

**The published sentences this story's finding lands on**

- `docs/how-to/evaluate-tool-use-behavior.md:3` -- the page description, "What the mcp interface kind declares today, how close a tool call sits to the operation shape it inherits, and what a first adopter would have to build". It names one reading and the page carries two.
- `docs/how-to/evaluate-tool-use-behavior.md:10-13` -- "The system under test is an agent that reaches its capabilities through tools. ... `PermittedInterface` declares four interface kinds and one of them is `mcp` (`src/core/schemas/interface.ts:264`). That is the declared home for tool-use behavior." Reading one's system under test is the agent behind a command, and its home is the `cli` kind that ships.
- `docs/how-to/evaluate-tool-use-behavior.md:18-42` -- "Tool-use behavior asks three questions, and a contract has a different declaration for each", followed by three questions that are all reading one, answered in api-shaped channels on a page about a kind that does not compile.
- `docs/how-to/evaluate-tool-use-behavior.md:242` -- "Until the kind opens, the workable move is the one TEA already made: put the tool-calling agent behind a command, declare a `cli` interface, and evaluate the run through its arguments, its streams, and the files it writes." This story is the run that tests that sentence.
- `docs/how-to/evaluate-tool-use-behavior.md:252-254` -- "That is the same evaluation shape a tool-use contract needs. ... What is missing for tool use is the interface kind that lets you say the choice was a tool call."
- `docs/how-to/evaluate-agent-behavior.md:30` -- "There is no transcript channel, no per-turn record, and no tool-call log", four lines above `:36-37`'s "Anything the agent did not write down", which already carries the qualification the sentence at `:30` drops.
- `docs/how-to/evaluate-agent-behavior.md:67-82` -- "The restriction that bites here", which states the split this story is measuring: pre-flight can read the file, the scoring-side signature cannot, and a seeded defect's signature should live on `exit-code` or on the stream the descriptor nominates. `:319-321` records TEA's gameability probe landing on the Invalid rung for exactly this.
- `docs/how-to/evaluate-skill-behavior.md:41-43` -- the same restriction, stated as a limit on which skills can carry a gameability probe. Verified against the finding and corrected only if the run contradicts it.
- `docs/index.md:72-84` and `docs/explanation/what-ships.md:38-40` -- checked and left standing, per Decision 6.

## Tasks & Acceptance

**Execution:**

- [x] `npm run build` -- build first, so every invocation below runs the published CLI surface an adopter has.
- [x] `$SCRATCH/tool-use-contract.json` -- author reading one on the identifier route: one `cli` interface, one operation invoking the agent, `artifacts` naming the tool-call log, `descriptorChannel` nominating it, a descriptor declaring the call list as a collection with a cardinality bound, one behavior, and oracles over the calls. `$SCRATCH` is untracked and outside the repository working tree.
- [x] `compile` and `seal` -- run both against that file, transcribe the exit codes, and quote the compiled interface block and the direction sentence the brief renders for the command.
- [x] `$SCRATCH/tool-use-probes.json` and `$SCRATCH/tool-use-observations.json` -- a defect probe whose condition names the log through the artifact pointer, plus the observations pre-flight needs, so `preflight --contract --probes --observations` runs against real bytes.
- [x] `$SCRATCH/qualify.ts` -- a script that imports `qualifyProbe` from `src/core/score/qualification.ts` and prints the failure list for each authored probe. `score` needs eight inputs and answers a different question; qualification is the gate under test and is called directly.
- [x] Route A -- run qualification against the artifact-pointer signature and transcribe the code, `artifactPath`, and `detail` verbatim into this file.
- [x] Route B -- re-author the operation with the log on the nominated stream, keep the file declared in `artifacts` for the oracle and the witness legs, re-run compile, seal, preflight, and qualification, and transcribe the result.
- [x] This file -- record the finding in `Decisions settled by construction`: which route the worked example ends on, what reading one can and cannot express, what that leaves as the `mcp` gap, and what each of Stories 11.3 through 11.8 still owes.
- [x] `docs/how-to/evaluate-tool-use-behavior.md` -- separate the two readings on the page that merges them, in four places. `:3`'s description names both readings and which kind answers each. `:10-13`'s "That is the declared home for tool-use behavior" becomes the split: reading one's system under test is the agent behind a command, whose home is `cli`; reading two's is the tool server, whose home is `mcp`. `:18`'s "Tool-use behavior asks three questions" says which reading those three belong to and routes a reader of reading one to the agent-behavior guide. `:242`'s "the workable move is the one TEA already made" carries this story's result: the route the worked example ends on, and the one restriction that shaped it. Cut what the correction makes redundant, including whichever of `:252-254`'s three lines the new framing already says. Leave `:84-133` and `:137-143` alone; they are Story 11.2's.
- [x] `docs/how-to/evaluate-agent-behavior.md` -- `:30`'s "There is no transcript channel, no per-turn record, and no tool-call log" names a channel gap and denies a declaration the schema carries. It becomes the accurate pair: no transcript channel and no per-turn record, and a tool-call log the agent writes to a declared file is addressable, under the restriction `:67-82` already states. Check `:67-82` and `:319-321` against the run and correct anything the finding contradicts.
- [x] `docs/how-to/evaluate-skill-behavior.md:41-43` -- verify the artifact restriction as written against the run; correct it only where the finding contradicts it, and record that it was checked either way.
- [x] Every page edited above -- run the voice pass while editing, then grep each file for `, not `, `rather than`, `instead of`, `as opposed to`, `, never `, `no longer` and confirm every remaining hit is a before/after contrast whose two halves each carry a fact.
- [x] `_bmad-output/project-knowledge/learning-path-step-by-step.md` -- add this story's step following `_bmad-output/project-knowledge/learning-path-template.md`: the six headings in order, `In plain terms` free of every path and schema name, and one row added to the table at the top of the file. Written after the peer review's findings are addressed and before the human reviews locally.

**Acceptance Criteria:**

- Given the contract authored on the identifier route, when `compile --in` and `seal --in` run against it, then both exit 0 and the story quotes the emitted interface block and the rendered direction, which is the evidence that reading one is expressible in the shipped `cli` kind.
- Given a defect probe whose discriminating condition names the tool-call log by identifier, when `qualifyProbe` runs, then the failure list is transcribed whole into this file with its code, artifact path, and detail, and no substitute signature is authored to make the run come back clean.
- Given the descriptor-channel route, when the same defect is expressed with the log on the channel the descriptor nominates, then the story states whether qualification returns an empty failure list, and that answer is the story's verdict on whether reading one scores.
- Given both runs, when the finding is written, then it names which of Stories 11.3 through 11.8 change scope and by how much, states which stay unchanged and why each one's obligation survives, and names Story 11.9 as the story that inherits the finding.
- Given the four sentences the Execution list quotes from `docs/how-to/evaluate-tool-use-behavior.md` and the one from `docs/how-to/evaluate-agent-behavior.md`, when the finding is recorded, then each is corrected in this same change and no page carries the old framing beside the new one, so Story 11.9 inherits only the cross-cutting prose no earlier story owns.
- Given every page this story edits, when the voice pass grep runs over it, then each hit on `, not `, `rather than`, `instead of`, `as opposed to`, `, never `, or `no longer` is a before/after contrast whose two halves each carry a fact, and every other hit is gone.
- Given `learning-path-template.md`, when this story's step is added, then it carries the six headings in that order with `In plain terms` free of paths and schema names, one table row is added at the top of the file, and the step is written after the peer review's findings are addressed.
- Given the whole attempt, when `git status --porcelain` runs at the end, then the tracked files that changed are this story file, the doc pages the Execution list names, and the learning-path file, in either outcome.
- Given `npm run validate`, when it runs, then it exits 0 with nothing on stderr, with `check:docs` and `check:doc-invocations` green over the edited pages, which is the check that this story shipped documentation and no code.

## Decisions settled by construction

**Decision 1: the identifier route is refused by construction, and the run is still required.**
`qualifyProbe` walks every fully-rooted pointer in a signature's condition (`qualification.ts:310-344`) and pushes `condition-artifact-channel-contract-local` whenever `target.channel === IDENTIFIER_ROOTED_CHANNEL` (`:324,339-343`). The check reads the channel, so the tail is irrelevant and the bare pointer is refused too, which `tests/score/qualification.test.ts:876-883` already pins. `docs/how-to/evaluate-agent-behavior.md:319-321` records a shipped instance: TEA's gameability probe quantifies over `/interactions/observed/artifact/verdict/findings` and lands on the Invalid rung with exit 3. The run is still required, because the question this story answers is whether the whole of reading one collapses under that refusal or only the one signature does, and that is decided by what the descriptor-channel route can express.

**Decision 2: the descriptor-channel route reaches a stream by name and reaches a file only through an identifier, and that asymmetry is the finding's shape.**
`descriptorChannelOf` (`declared-inputs.ts:33-41`) collapses an artifact nomination to the bare channel name `artifact`, and `INTERACTION_POINTER_PATTERN` (`pointer.ts:167`) makes the identifier segment mandatory after it. So the sentence at `qualification.ts:336-338` is true today for `stdout` and `stderr` and is aspirational for a file: the comment itself says the restriction lifts "the day the vocabulary reserves an identifier meaning 'the artifact this operation describes'", and nothing reserves one. The worked example therefore tests the file-shaped and the stream-shaped spellings of the same defect, and the story records which one carries the scoring-side signature. The option turned down is reserving that identifier here, because it changes `EVIDENCE_CHANNELS`, the pointer pattern, the published schema, and the census, which is a schema story and this one ships no code.

**Decision 3: `artifacts` stays declared in the route the example ends on, whichever it is.**
An artifact declaration serves three consumers beyond a signature. Oracles address it, `checkArtifactReferences` (`interface-inventory.ts:128-163`) resolves it, and a sensitivity witness may address it freely because it is bound to one contract and one leg (`docs/how-to/evaluate-agent-behavior.md:76-77`), which `tests/schemas/fixtures/command-contract.ts:250-270` already exercises. So the split the story is measuring is narrow: pre-flight reads the file, and the portable scoring-side signature does not. Recording it as narrow matters, because "a defect signature cannot address a written file" reads as "reading one does not work" and those are different claims. Downstream consequence: every page that carries the headline sentence carries the split with it, which is what the documentation task above is for.

**Decision 4: the story measures scope and records it; it removes no story from the epic.**
Each of Stories 11.3 through 11.8 and Story 11.13 carries an obligation about the `mcp` kind's own declarations: the response descriptor for an unstructured tool result, the operation shape with a transport identity AD-40 can bind, the three gates at `interface-inventory.ts:31`, `preflight/plan.ts:305`, and `qualification.ts:753-763`, the port union members, the third conformance arm, the AD-31 grading file, and the six census constants. A `cli` contract compiling discharges none of them, because none of them is reachable from a `cli` contract. What a working reading one changes is the epic's justification: the five-shape promise at `docs/index.md:74-80` stops being the reason to build the kind, and reading two being genuinely undescribable becomes the reason. The story writes that down with the measurement so nobody re-derives it, and the human decides whether the epic keeps its definition of done. Downstream consequence: Story 11.9 inherits the finding and is the story whose rewrite changes shape, and Story 11.8 inherits the one open question a working reading one raises, which is whether the tool-use exemplar that joins `DEV_CORPUS_CONTRACTS` is a `cli` contract, an `mcp` contract, or both. Decision 7 carries that question's arithmetic.

**Decision 5: qualification is called directly and `score` is not run.**
`qualifyProbe` (`qualification.ts:727-730`) takes a probe and its home operation, and `sealProbeSet` (`:818-833`) is where AD-9's admission rule is applied. The `score` command requires eight inputs (`src/cli/arguments.ts:52-62`), including a sealed run record, an isolation manifest, and a pre-flight verdict, and it answers a rung question; the gate under test answers an admission question. Assembling all eight to reach one gate would make the attempt's failure modes ambiguous: a missing input and a refused signature would both come back as a non-zero exit. So `compile`, `seal`, and `preflight` run through `dist/cli/main.js`, and qualification is called through a script against the same authored probe. Downstream consequence: the story's evidence for the qualification half is a printed failure list, quoted whole, while the other three halves are exit codes.

**Decision 6: this story corrects the pages its own finding touches, and the line between it and Stories 11.2 and 11.9 is drawn by what each one changes.**
The tool-use guide merges the two readings in four places (`docs/how-to/evaluate-tool-use-behavior.md:3,10-13,18,242`), and separating them is this story's whole output, so this story corrects them. The contract fence at `:84-133` and the invocation at `:137-143` belong to Story 11.2, which makes them a heredoc with a declared exit code and turns them into an executed input to `npm run validate`; editing them here would collide with that. The five-shape routing table at `docs/index.md:74-80` and the deferral sentence at `docs/explanation/what-ships.md:38-40` both describe what compiles, this story opens nothing, and both stay literally true, so Story 11.9 keeps them. `docs/how-to/evaluate-agent-behavior.md:30` is this story's because its worked example is the counterexample to the sentence. `epic-11-context.md:164` assigns `docs/how-to/evaluate-tool-use-behavior.md:242`, the "workable move" sentence, to Story 11.9 with the note "Deleted as part of the guide's rewrite", and this story rewrote it instead. The reassignment is deliberate and recorded here rather than left to be discovered. The line is the one sentence on the page that makes a claim about reading one, this story is the run that tests that claim, and a finding that leaves its own subject sentence for a later story is the deferral the epic register forbids. Story 11.9 keeps the paragraph and may still delete it; what it inherits is a sentence that is true.

Downstream consequence: Story 11.9 inherits the cross-cutting five-shape prose and the pages no earlier story touched, with the tool-use guide's framing already correct when it arrives.

**Decision 7: reading one is expressible end to end, so the epic's justification moves and its scope does not.**
The run is the evidence. Reading one compiles, seals, pre-flights with all six checks satisfied, and carries a scoring-side defect signature on the descriptor-channel route with an empty failure list. What reading one can express: the agent as the system under test, the tool-call log as a declared artifact with structure, an oracle quantifying over the calls with a cardinality bound, a sensitivity witness proving the agent reads its task, a manifestation witness reading the log, and a defect signature on the nominated stream. What it cannot express: a portable scoring-side signature naming the log by identifier, and anything at all about the tool server. So the `mcp` gap is reading two, whole and unnarrowed: a transport identity for a tool call, a descriptor for a text-shaped tool result, a port message pair, an adapter, a conformance arm, and an AD-31 grading file. What changes is the reason to build it. `docs/index.md:74-80`'s five-shape promise stops being the justification, because the shape most readers mean by tool use already runs; reading two being undescribable is the justification that survives.

Stories 11.3 through 11.8 keep their obligations, and each survives for the same reason: none is reachable from a `cli` contract. Story 11.3's descriptor for an unstructured tool result is unreached, since a `cli` operation's descriptor describes a JSON stream or a JSON file it declares. Story 11.4's operation shape with a transport identity AD-40 can bind is unreached, since `CommandInvocation` is the `cli` identity and binds no tool name. Story 11.5's three gates stay shut, and the run transcribes the first of them firing. Story 11.6's signature branch and ninth `arguments` channel are unreached, since a `cli` signature declares an invocation. Story 11.13's port union members are unreached, since the run's observations are `CommandProbeObservation`. Story 11.7's conformance arm and AD-31 grading file are unreached, since there is no `mcp` adapter to certify. Story 11.8's census and corpus enumerations are unreached, since no count moved. The human decides whether the epic keeps its definition of done; this story removes nothing.

Downstream consequences, named. Story 11.9 inherits the finding and is the story whose rewrite changes shape, because the tool-use guide's framing is now correct and its five-shape prose is what remains. Story 11.8 inherits the one open question a working reading one raises: whether the tool-use exemplar that joins `DEV_CORPUS_CONTRACTS` is a `cli` contract, an `mcp` contract, or both, and the run's Route B contract is a ready shape for the `cli` half. That answer carries arithmetic: `epic-11-context.md:62` runs the count 21 today, 22 after Story 11.8, 23 after Story 11.10, and 24 after Story 11.11, so a "both" answer makes Story 11.8's move 21 to 23 and shifts every numeral after it by one.

**Decision 8: the worked example ends on the descriptor-channel route, and the file stays declared beside it.**
Route B is the answer to the third acceptance criterion: qualification returns an empty failure list when the same seeded defect is expressed with the log on the channel the descriptor nominates. The contract that ships that route still declares `tool-calls` in `artifacts`, and the run proves what that buys: the `O-001` existence oracle addresses the bare artifact pointer, the sensitivity witness legs address it, and pre-flight resolves both at exit 0. The manifestation witness moved to the nominated stream alongside the signature, so under Route B it is the sensitivity witness alone that keeps the file in evidence. The option turned down is moving the log off `artifacts` entirely once the signature rides `stdout`, because that would delete the existence assertion and the sensitivity witness's evidence to buy nothing. Downstream consequence: an adopter authoring reading one declares the file and prints it, and the guide now says so.

## The run

Every exit code, code name, artifact path, and detail string below was transcribed from a run of `dist/cli/main.js` at 1.4.2 against files authored in an untracked scratch directory outside this working tree. `npm run build` ran first and exited 0.

**Reading one, on the identifier route.** `tool-use-contract.json` declares one `cli` interface `release-agent-runner`, one operation `run-agent` invoking `release-agent run`, `artifacts: ["tool-calls"]`, `descriptorChannel: { "kind": "artifact", "artifactId": "tool-calls" }`, a response descriptor declaring `calls` as a collection at `/calls` with `{ "mode": "at-most", "max": 8 }`, one behavior, and two oracles over `/interactions/run/artifact/tool-calls/calls`, one `existence` and one `for-all` whose predicate reads `@/tool`.

```
$ node dist/cli/main.js compile --in $SCRATCH/tool-use-contract.json   # exit 0
$ node dist/cli/main.js seal    --in $SCRATCH/tool-use-contract.json   # exit 0
```

The compiled contract carries the operation's declaration half, with `stateChangeMarker`, `requestShape`, `responseDescriptor`, `volatilePointers`, and `sensitivityWitness` elided here:

```json
{
  "artifacts": ["tool-calls"],
  "descriptorChannel": { "artifactId": "tool-calls", "kind": "artifact" },
  "invocation": { "executable": "release-agent", "subcommandPath": ["run"] },
  "operationId": "run-agent"
}
```

The sealed brief renders the two directions, and both name the command and the file:

```
O-001  The calls field of the tool-calls it wrote from the run agent command (with the
       supplied stdin task) is asserted to be present. The declared polarity expects this
       relation to hold. One release-note run for one repository. A run whose log names no
       call at all is treated as a defect.

O-002  Every element reachable through the calls field of the tool-calls it wrote from the
       run agent command (with the supplied stdin task) is asserted to meet the declared
       condition. The declared polarity expects this relation to hold. Every call the agent
       recorded. A recorded call naming no tool is treated as a defect.
```

**Pre-flight, on the identifier route.** Five legs planned and five observed, at exit 0:

```
eval-quality: preflight: run-1: reduced 5 leg(s): passed
interface-present: satisfied     input-sensitivity: satisfied
state-reset: satisfied           clean-control: satisfied
seeded-faults-scoped: satisfied  seeded-fault-fired: satisfied
```

`input-sensitivity` is the sensitivity witness, whose two legs compare `/interactions/leg-changelog-task/artifact/tool-calls/calls` against `/interactions/leg-tag-task/artifact/tool-calls/calls`. `seeded-fault-fired` is the manifestation witness, whose relation is `absence` over `/interactions/tool-log-fault/artifact/tool-calls/calls`. Both resolved through artifact pointers, which is the run's evidence for Decision 3.

**Route A, the scoring-side signature by identifier.** `qualifyProbe` was called directly against the contract's own operation, once per spelling. The tailed pointer:

```json
{
  "code": "condition-artifact-channel-contract-local",
  "artifactPath": "Probe[probeId=P-101].defectSignature.condition.predicate.operands[1].operands[0]",
  "detail": "\"/interactions/observed/artifact/tool-calls/calls\" names artifact \"tool-calls\"; an artifact identifier is minted per contract, so a signature carrying one resolves only against the contract it was authored on, which is what AD-40 dropped operationId to avoid"
}
```

The bare pointer, same code, same reason:

```json
{
  "code": "condition-artifact-channel-contract-local",
  "artifactPath": "Probe[probeId=P-102].defectSignature.condition.predicate.operands[1].operands[0]",
  "detail": "\"/interactions/observed/artifact/tool-calls\" names artifact \"tool-calls\"; an artifact identifier is minted per contract, so a signature carrying one resolves only against the contract it was authored on, which is what AD-40 dropped operationId to avoid"
}
```

`sealProbeSet([P-101], () => runAgent)` returns `{ "admitted": [], "rejected": [ ... ] }`, so AD-9's admission rule holds the probe out of the sealed set exactly as the matrix predicted. No substitute signature was authored.

**Route B, the descriptor-channel route.** The same operation with `descriptorChannel: { "kind": "stream", "channel": "stdout" }` and `artifacts` unchanged. Four pointers moved, and the run separates the one move that was forced from the three that were authoring choices.

`O-001` dropped its tail, from `/interactions/run/artifact/tool-calls/calls` to the bare `/interactions/run/artifact/tool-calls`, and that move was forced. A variant keeping the tail exits 4:

```
unreachable-check-evidence: EvalContract.oracles[id=O-001].check.operands[0]:
"/interactions/run/artifact/tool-calls/calls" addresses a field inside the "tool-calls"
artifact, which operation "run-agent" declares it writes but declares no structure for
```

`O-002` moved to `/interactions/run/stdout/calls` for the same reason, since the structure it quantifies over now lives on the nominated stream. The manifestation witness moved to `/interactions/tool-log-fault/stdout/calls` to sit beside the signature. The sensitivity witness legs dropped their tails too, from `/interactions/leg-changelog-task/artifact/tool-calls/calls` to `/interactions/leg-changelog-task/artifact/tool-calls`, and that one was a choice. A variant keeping the tailed witness pointers compiles at exit 0 and pre-flights at exit 0 with all six checks satisfied. Two different mechanisms produce that, and they are worth separating.

The reachability gate genuinely does not see a witness. `forEachCheckPointer` (`reachability.ts:116`) iterates `contract.oracles` alone, and both reachability sites (`:181` and `:494`) go through it, so `unreachable-check-evidence` cannot fire on a witness relation.

`checkArtifactReferences` does see one, and misses for a different reason. It walks `forEachArtifactPointer` (`interface-inventory.ts:147`), which reaches each operation's `sensitivityWitness.relation` (`reachability.ts:164-171`), and its own docblock at `:127-129` says the wider walk is deliberate: "an artifact identifier is an authoring fault at every site that names one". What stops it is the step lookup at `interface-inventory.ts:150-151`. It resolves `target.stepId` through `index.stepOf`, returns when that is `undefined`, and a witness leg identifier is not a step in the interaction plan, so the lookup misses and the check bails before it compares anything against `declaredArtifactsOf`.

**A gap this story found and does not close.** The consequence is sharper than the tail case. A sensitivity witness may name an artifact the contract declares nowhere at all, and compilation succeeds. Transcribed:

```
$ node dist/cli/main.js compile --in $SCRATCH/variant-witness-undeclared-artifact.json
exit 0
```

That variant is the Route B contract with both witness legs repointed at `/interactions/leg-changelog-task/artifact/transcript/turns` and `/interactions/leg-tag-task/artifact/transcript/turns`, with `transcript` absent from `artifacts` entirely. The same artifact name on an oracle pointer is `unresolved-artifact-reference` at exit 4, transcribed in the boundaries below.

`interface.ts:204-206` calls a dangling artifact name "an authoring fault the compiler can see", and that sentence is about `descriptorChannel.artifactId`, where the enforcement is real: `interface-inventory.ts:133-139` throws `unresolved-artifact-reference` on a nomination the operation does not declare. The phrase is borrowed here to name the standard the witness site falls short of, and it is not the code's own claim about witnesses.

**It is recorded and deliberately unassigned.** This story ships no product code in either outcome, so the gap is not closed here. It is also not this epic's. The defect is kind-neutral and live today: it bites every `api` and `cli` contract in the tree, including `corpus/dev/contracts/review-corpus.json`, whose sensitivity witness addresses artifact pointers and would compile just as clean if `verdict` were renamed in `artifacts` and left alone in the witness. Nothing about it waits on `mcp`. Story 11.13 is the wrong home despite owning `witness-evidence.ts`, because `interface-inventory.ts` is absent from the eight kind-discriminating modules `epic-11-context.md:93` lists, so its checklist never reaches the file the bug is in; `witness-evidence.ts` is a pre-flight module and this miss is a compile-side check two layers away. Story 11.5 opens the kind gate at `interface-inventory.ts:31` and touches nothing in `checkArtifactReferences`, and Story 11.9 ships prose. Adding an obligation to a planned story is the same class of move as removing one, which this story's Ask First list reserves for the human, so the finding goes to the human unassigned. If it must have a home in this epic, Story 11.8 is the least wrong, since it already runs the published-surface and corpus sweep.


**Closed, 9 September, ahead of Story 11.2.** The gap above is fixed rather than carried. The second fix shape is the one taken: `forEachArtifactPointer`'s callback gained a third parameter carrying the operation a site belongs to, supplied only at a sensitivity-witness relation, and `checkArtifactReferences` prefers it over the plan lookup where present. The cheaper shape was turned down because comparing against the union of every operation's declared artifacts answers a weaker question than the one the code asks everywhere else: it would accept a witness naming a file some other operation writes, and the error message could not name an operation. The exit-0 transcript above reproduces on the parent commit and returns exit 4 with `unresolved-artifact-reference` at `sensitivityWitness.relation.operands[0].operands[0]` after the fix, and `corpus/dev/contracts/review-corpus.json` still compiles at exit 0.
Two fix shapes, for whoever takes it. The cheap one compares the pointer's artifact identifier against the union of every operation's declared artifacts when the step lookup misses. The better one widens `forEachArtifactPointer`'s callback, which today is `(pointer, artifactPath) => void` (`reachability.ts:133-135`) and drops the operation it already holds at `:164-171`; passing that operation through gives the exact answer for one parameter.

```
$ node dist/cli/main.js compile   --in $SCRATCH/tool-use-contract-route-b.json   # exit 0
$ node dist/cli/main.js seal      --in $SCRATCH/tool-use-contract-route-b.json   # exit 0
$ node dist/cli/main.js preflight --contract ... --probes ... --observations ...  # exit 0
```

The brief's first direction shows the bare artifact pointer rendering as an existence claim over the file itself, and the second shows the structure moving to the stream:

```
O-001  The tool-calls it wrote from the run agent command (with the supplied stdin task) is
       asserted to be present. ...
O-002  Every element reachable through the calls field of its standard output from the run
       agent command (with the supplied stdin task) is asserted to meet the declared
       condition. ...
```

Qualification of the same seeded defect, with its condition on `/interactions/observed/stdout/calls` and `observableChannel: "stdout"`:

```
=== P-103 (declarationChecksRan=true)
[]
```

**A shipped contract already has this shape.** `corpus/dev/contracts/review-corpus.json` declares `artifacts: ["verdict", "report"]`, nominates `verdict` with `descriptorChannel`, carries an existence oracle over `/interactions/select/artifact/verdict/fragments`, and carries a sensitivity witness whose two legs compare artifact pointers. It ships in the dev corpus and passes `check:corpus`. So reading one is not merely authorable against the schema; the repository has been shipping an instance of its shape since Epic 9, which is the strongest available evidence that the epic sized Stories 11.3 through 11.8 against a question the `cli` kind already answers.

**The verdict.** Reading one compiles, seals, pre-flights, and carries a qualifying defect signature. `score` was not run, per Decision 5. The descriptor-channel route is the one the worked example ends on, and it carries that signature with an empty failure list while the file stays declared for the existence oracle and the sensitivity witness legs.

**The compile-side boundaries, transcribed.** Three refusals were run to fix where reading one stops. The first two quote the same pointer under different codes, and the difference is the whole point of the pair: the first run declares `artifacts: ["tool-calls", "transcript"]`, so `transcript` is declared and unstructured, and the second leaves `artifacts: ["tool-calls"]`, so `transcript` is not declared at all.

```
exit 4  unreachable-check-evidence: EvalContract.oracles[id=O-001].check.operands[0]:
        "/interactions/run/artifact/transcript/turns" addresses a field inside the
        "transcript" artifact, which operation "run-agent" declares it writes but declares
        no structure for

exit 4  unresolved-artifact-reference: EvalContract.oracles[id=O-001].check.operands[0]:
        "/interactions/run/artifact/transcript/turns" names the "transcript" artifact, which
        operation "run-agent" does not declare it writes (AD-26)

exit 4  unsupported-interface-kind: EvalContract.permittedInterfaces[logicalId=release-agent-runner].kind:
        "mcp" is not supported; "api" and "cli" are (AD-10)
```

## Divergences from the I/O matrix, recorded

Three rows of the frozen matrix predicted something the run corrected. Each is a fact about check order rather than about reading one.

**"Reading two, same contract" needs the operation shape moved too.** The matrix says flipping `kind` to `mcp` on the authored contract yields `unsupported-interface-kind`. It yields exit 5 `schema-parse-failure` instead, because `PermittedInterface` is discriminated on `kind` and the `mcp` branch is `apiShapedInterface`, so the parser reports eight errors naming a missing `method`, a missing `pathTemplate`, an api-shaped `requestShape`, and the three unrecognized keys `invocation`, `artifacts`, and `descriptorChannel`. Reaching `unsupported-interface-kind` needs an api-shaped operation, which the run then authored, and that variant does exit 4 under the code the matrix names. This is the same trap `epic-11-context.md` finding 8 records for the guide's own fenced contract: the check that fires is decided by what parses first.

**The unreachable-tail row names a detail, and the code is `unreachable-check-evidence`.** The matrix quotes the sentence at `reachability.ts:395-402` without naming the AD-5 code the run emits. It is `unreachable-check-evidence`, raised at `reachability.ts:503`, and `docs/how-to/evaluate-agent-behavior.md:36-37` publishes the same code for a neighbouring trigger: that sentence is about a behavior leaving no mark in any channel, while the run's case is a tailed pointer into a file that is declared and unstructured.

**A condition over `call-inputs` alone raises two codes.** The matrix predicts `condition-channels-underspecified`. The run returns that code second, behind `signature-observable-channel-not-response-side` at `.defectSignature.observableChannel` with the detail "declares observableChannel \"call-inputs\", which records what was sent rather than what came back, so no defect manifests in it (AD-40)". Both fire because the authored probe declared `call-inputs` as its observable channel as well as naming it in the predicate.


## The published pages, checked against the run

Every line number in this section is the **pre-edit** address, matching the Execution list and the epic register. The post-edit addresses are given at the end of the section.

- `docs/how-to/evaluate-tool-use-behavior.md:3,10-13,20,242,252-254` -- corrected. The description names both readings and which kind answers each. The opening splits them by system under test and routes a reader of reading one to the agent-behavior guide. The Execution list wrote `:18` for "Tool-use behavior asks three questions"; the sentence is at `:20` and `:18` is the section heading. That sentence now says both readings answer all three questions, names the declarations below as reading two's, and a new closing block gives reading one's shapes from the run. The "workable move" paragraph carries the run's result, both routes and the one restriction. The three closing lines lost the sentence the new framing already says and now name reading two as what is owed.
- `docs/how-to/evaluate-agent-behavior.md:30` -- corrected. "There is no transcript channel, no per-turn record, and no tool-call log" denied a declaration the schema carries and the run exercises. It is now the accurate pair plus the qualification the restriction section already states.
- `docs/how-to/evaluate-agent-behavior.md:67-82` -- checked, unchanged. Every sentence holds against the run: `qualifyProbe` refuses the artifact pointer under `condition-artifact-channel-contract-local`, the manifestation witness addresses the file freely, and the split is pre-flight reading the file while the scoring-side signature does not. The section's advice to put the seeded defect's signature on `exit-code` or on the nominated stream is what Route B did.
- `docs/how-to/evaluate-agent-behavior.md:318-320` -- checked, unchanged. TEA's gameability probe hitting the Invalid rung is the same refusal this story transcribed, at the same code.
- `docs/how-to/evaluate-agent-behavior.md:323` -- one voice-pass trim. "findings about the contract rather than about the runs" became "findings about the contract". The rejected half carried no fact of its own, so it failed the voice rule the story sets.
- `docs/how-to/evaluate-skill-behavior.md:41-43` -- checked, unchanged. "A defect signature cannot address a file the command wrote" and its consequence for a gameability probe are both true of the run. The run contradicts nothing there.
- `docs/how-to/evaluate-tool-use-behavior.md:236` -- one voice-pass trim only. "that confinement is decided rather than open" became "a confinement the code decides". The eight-key clause on the same line is Story 11.6's and the confinement clause's meaning is Story 11.13's; neither meaning moved.
- `docs/index.md:72-84` and `docs/explanation/what-ships.md:38-40` -- checked and left standing, per Decision 6. The tool-use row's verdict "Declared and refused at compile" is the exit 4 this story transcribed.

**Addresses that moved, for the stories holding the old ones.** The rewritten opening grew the tool-use guide from 254 lines to 284, so every later address on that page shifted. Each pair below was read off the post-edit file at the end of the pass, after the peer review's and CodeRabbit's fixes landed.

| What | Owner | Pre-edit | Post-edit |
|---|---|---|---|
| The `mcp` contract fence | 11.2, then 11.4 and 11.5 | `:84-133` | `:105-154` |
| The declared `compile` invocation | 11.2 | `:137-139` | `:158-160` |
| The rejection the page shows | 11.2 | `:141-143` | `:162-164` |
| The eight-key `ObservedCallInputs` line | 11.6 | `:72` | `:93` |
| The `foreignChannels` confinement line | 11.6 and 11.13 | `:236` | `:257` |
| The "workable move" paragraph | reassigned to 11.1 above | `:242` | `:263` |

Both `:84-133` and `:137-143` are byte-identical, verified by the absence of a diff hunk in that range. This story's Never list and Decision 6 name the pre-edit numbers because they were written against the pre-edit file. `docs/how-to/evaluate-agent-behavior.md` grew by one line at `:31`, so its `:67-82` restriction section is now `:68-83` and its `:318-320` TEA paragraph is now `:319-321`. `epic-11-context.md:42`, `:147`, and `:164` carry the pre-edit tool-use numbers; they are the epic register's, and Story 11.9's sweep is where they get reconciled.

**One string Story 11.13 will grep for is gone.** The voice-pass trim on the confinement line replaced "that confinement is decided rather than open" with "a confinement the code decides". The meaning did not move and the clause is still Story 11.13's, but the old wording no longer appears, so a grep for it returns nothing. Search for `foreignChannels` on that page instead.

**One tracked file changed that acceptance criterion `:136` does not enumerate.** `_bmad-output/implementation-artifacts/sprint-status.yaml` moves `epic-11` to `in-progress` and this story to `done`. It is sprint bookkeeping the pipeline writes on every story rather than an output of this story's finding, so it sits outside that criterion's accounting; the criterion's purpose is proving no code changed, and it does.

## Design Notes

The two readings differ in what the system under test is, and everything else follows from that. Under reading one the system under test is the agent, the tool calls are output the agent produced, and the shipped `cli` kind already declares that output twice over: `artifacts` for a file it wrote and `descriptorChannel` for the channel whose structure the operation's one descriptor describes. Under reading two the system under test is the tool server, the tool call is the request, and there is no operation shape that carries a tool identity, no response descriptor for a markdown `content` array, and no port message an adapter could answer.

The shape the worked example is testing, in one operation, with the kind-neutral `stateChangeMarker`, `requestShape`, `volatilePointers`, and `sensitivityWitness` elided:

```json
{
  "operationId": "run-agent",
  "invocation": { "executable": "release-agent", "subcommandPath": ["run"] },
  "artifacts": ["tool-calls"],
  "descriptorChannel": { "kind": "artifact", "artifactId": "tool-calls" },
  "responseDescriptor": {
    "requiredKeys": ["calls"],
    "collectionLocations": [{ "pointer": "/calls", "expectedCardinality": { "mode": "at-most", "max": 8 }, "referenceSet": null }]
  }
}
```

An oracle over `/interactions/run/artifact/tool-calls/calls` resolves through that descriptor. A defect signature over the same pointer does not, and the second half of the attempt is what that costs.

## Verification

**Commands:**

- `npm run build` -- expected: exit 0, so every invocation below runs the published CLI.
- `node dist/cli/main.js compile --in $SCRATCH/tool-use-contract.json` -- expected: exit 0 on the authored contract; the exit code and any structural failure are transcribed either way.
- `node dist/cli/main.js seal --in $SCRATCH/tool-use-contract.json` -- expected: exit 0, with the rendered direction quoted in this file.
- `node dist/cli/main.js preflight --contract $SCRATCH/tool-use-contract.json --probes $SCRATCH/tool-use-probes.json --observations $SCRATCH/tool-use-observations.json` -- expected: a verdict, with the witness legs that address the log resolving.
- `node $SCRATCH/qualify.ts` -- expected: the failure list for each authored probe, printed and transcribed. Route A returns `condition-artifact-channel-contract-local`; Route B's result is the story's verdict.
- `grep -nE ', not |rather than|instead of|as opposed to|, never |no longer' docs/how-to/evaluate-tool-use-behavior.md docs/how-to/evaluate-agent-behavior.md docs/how-to/evaluate-skill-behavior.md` -- expected: every hit is a before/after contrast whose two halves each carry a fact, checked by reading each one.
- `npm run check:docs` and `npm run check:doc-invocations` -- expected: exit 0 over the edited pages, with the tool-use guide's invocation judged exactly as it was before this story, since `:84-133` and `:137-143` are untouched.
- `git status --porcelain` -- expected: this story file, the doc pages the Execution list names, and the learning-path file.
- `npm run validate` -- expected: exit 0 with nothing on stderr, which is what proves the code side is untouched.

**Commands as run.** The plan above was written before the probe set split in two. `preflight` requires `--run-id` and exits 64 without it, and each route needs its own probe file, because two probes carrying the same manifestation-witness `legId` collide under `malformed-operator-expression`. The recipe that reproduces the transcript:

```bash
node dist/cli/main.js compile --in $SCRATCH/tool-use-contract.json
node dist/cli/main.js seal    --in $SCRATCH/tool-use-contract.json
node dist/cli/main.js preflight --contract $SCRATCH/tool-use-contract.json \
  --probes $SCRATCH/probes-route-a.json \
  --observations $SCRATCH/tool-use-observations.json --run-id run-1

node dist/cli/main.js compile --in $SCRATCH/tool-use-contract-route-b.json
node dist/cli/main.js seal    --in $SCRATCH/tool-use-contract-route-b.json
node dist/cli/main.js preflight --contract $SCRATCH/tool-use-contract-route-b.json \
  --probes $SCRATCH/probes-route-b.json \
  --observations $SCRATCH/observations-route-b.json --run-id run-2

node $SCRATCH/qualify.ts       # all four probes, both contracts
node $SCRATCH/seal-probes.ts   # AD-9 admission over the Route A probe
```
