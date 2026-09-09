---
title: 'Whether tool-use evaluation is one gap or two'
type: 'chore'
created: '2026-09-09'
status: 'draft'
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

- [ ] `npm run build` -- build first, so every invocation below runs the published CLI surface an adopter has.
- [ ] `$SCRATCH/tool-use-contract.json` -- author reading one on the identifier route: one `cli` interface, one operation invoking the agent, `artifacts` naming the tool-call log, `descriptorChannel` nominating it, a descriptor declaring the call list as a collection with a cardinality bound, one behavior, and oracles over the calls. `$SCRATCH` is untracked and outside the repository working tree.
- [ ] `compile` and `seal` -- run both against that file, transcribe the exit codes, and quote the compiled interface block and the direction sentence the brief renders for the command.
- [ ] `$SCRATCH/tool-use-probes.json` and `$SCRATCH/tool-use-observations.json` -- a defect probe whose condition names the log through the artifact pointer, plus the observations pre-flight needs, so `preflight --contract --probes --observations` runs against real bytes.
- [ ] `$SCRATCH/qualify.ts` -- a script that imports `qualifyProbe` from `src/core/score/qualification.ts` and prints the failure list for each authored probe. `score` needs eight inputs and answers a different question; qualification is the gate under test and is called directly.
- [ ] Route A -- run qualification against the artifact-pointer signature and transcribe the code, `artifactPath`, and `detail` verbatim into this file.
- [ ] Route B -- re-author the operation with the log on the nominated stream, keep the file declared in `artifacts` for the oracle and the witness legs, re-run compile, seal, preflight, and qualification, and transcribe the result.
- [ ] This file -- record the finding in `Decisions settled by construction`: which route the worked example ends on, what reading one can and cannot express, what that leaves as the `mcp` gap, and what each of Stories 11.3 through 11.8 still owes.
- [ ] `docs/how-to/evaluate-tool-use-behavior.md` -- separate the two readings on the page that merges them, in four places. `:3`'s description names both readings and which kind answers each. `:10-13`'s "That is the declared home for tool-use behavior" becomes the split: reading one's system under test is the agent behind a command, whose home is `cli`; reading two's is the tool server, whose home is `mcp`. `:18`'s "Tool-use behavior asks three questions" says which reading those three belong to and routes a reader of reading one to the agent-behavior guide. `:242`'s "the workable move is the one TEA already made" carries this story's result: the route the worked example ends on, and the one restriction that shaped it. Cut what the correction makes redundant, including whichever of `:252-254`'s three lines the new framing already says. Leave `:84-133` and `:137-143` alone; they are Story 11.2's.
- [ ] `docs/how-to/evaluate-agent-behavior.md` -- `:30`'s "There is no transcript channel, no per-turn record, and no tool-call log" names a channel gap and denies a declaration the schema carries. It becomes the accurate pair: no transcript channel and no per-turn record, and a tool-call log the agent writes to a declared file is addressable, under the restriction `:67-82` already states. Check `:67-82` and `:319-321` against the run and correct anything the finding contradicts.
- [ ] `docs/how-to/evaluate-skill-behavior.md:41-43` -- verify the artifact restriction as written against the run; correct it only where the finding contradicts it, and record that it was checked either way.
- [ ] Every page edited above -- run the voice pass while editing, then grep each file for `, not `, `rather than`, `instead of`, `as opposed to`, `, never `, `no longer` and confirm every remaining hit is a before/after contrast whose two halves each carry a fact.
- [ ] `_bmad-output/project-knowledge/learning-path-step-by-step.md` -- add this story's step following `_bmad-output/project-knowledge/learning-path-template.md`: the six headings in order, `In plain terms` free of every path and schema name, and one row added to the table at the top of the file. Written after the peer review's findings are addressed and before the human reviews locally.

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
Each of Stories 11.3 through 11.8 carries an obligation about the `mcp` kind's own declarations: the response descriptor for an unstructured tool result, the operation shape with a transport identity AD-40 can bind, the three gates at `interface-inventory.ts:31`, `preflight/plan.ts:305`, and `qualification.ts:753-763`, the port union members, the third conformance arm, the AD-31 grading file, and the six census constants. A `cli` contract compiling discharges none of them, because none of them is reachable from a `cli` contract. What a working reading one changes is the epic's justification: the five-shape promise at `docs/index.md:80` stops being the reason to build the kind, and reading two being genuinely undescribable becomes the reason. The story writes that down with the measurement so nobody re-derives it, and the human decides whether the epic keeps its definition of done. Downstream consequence: Story 11.9 inherits the finding and is the story whose rewrite changes shape, and Story 11.8 inherits the one open question a working reading one raises, which is whether the tool-use exemplar that joins `DEV_CORPUS_CONTRACTS` is a `cli` contract, an `mcp` contract, or both.

**Decision 5: qualification is called directly and `score` is not run.**
`qualifyProbe` (`qualification.ts:727-730`) takes a probe and its home operation, and `sealProbeSet` (`:818-833`) is where AD-9's admission rule is applied. The `score` command requires eight inputs (`src/cli/arguments.ts:52-62`), including a sealed run record, an isolation manifest, and a pre-flight verdict, and it answers a rung question; the gate under test answers an admission question. Assembling all eight to reach one gate would make the attempt's failure modes ambiguous: a missing input and a refused signature would both come back as a non-zero exit. So `compile`, `seal`, and `preflight` run through `dist/cli/main.js`, and qualification is called through a script against the same authored probe. Downstream consequence: the story's evidence for the qualification half is a printed failure list, quoted whole, while the other three halves are exit codes.

**Decision 6: this story corrects the pages its own finding touches, and the line between it and Stories 11.2 and 11.9 is drawn by what each one changes.**
The tool-use guide merges the two readings in four places (`docs/how-to/evaluate-tool-use-behavior.md:3,10-13,18,242`), and separating them is this story's whole output, so this story corrects them. The contract fence at `:84-133` and the invocation at `:137-143` belong to Story 11.2, which makes them a heredoc with a declared exit code and turns them into an executed input to `npm run validate`; editing them here would collide with that. The five-shape routing table at `docs/index.md:74-80` and the deferral sentence at `docs/explanation/what-ships.md:38-40` both describe what compiles, this story opens nothing, and both stay literally true, so Story 11.9 keeps them. `docs/how-to/evaluate-agent-behavior.md:30` is this story's because its worked example is the counterexample to the sentence. Downstream consequence: Story 11.9 inherits the cross-cutting five-shape prose and the pages no earlier story touched, with the tool-use guide's framing already correct when it arrives.

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
