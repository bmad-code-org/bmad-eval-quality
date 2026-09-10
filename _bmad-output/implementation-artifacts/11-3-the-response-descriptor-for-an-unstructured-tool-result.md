---
title: 'The response descriptor for an unstructured tool result'
type: 'chore'
created: '2026-09-09'
status: 'in-review'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '5b351b65ba6c150c378b9b5a0bd3de2fa4f87bc7'
context:
  - _bmad-output/implementation-artifacts/epic-11-context.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `ResponseDescriptor` (`src/core/schemas/interface.ts:45-70`) carries six fields and every one of them is about a JSON body: `requiredKeys` at `:46-50`, `permittedKeys` at `:51`, `types` at `:52-54` (a `KeyTypeMap`, `primitives.ts:150-155`, keyed by plain key name and valued in `JsonTypeName`), `successIndicator` at `:55-57`, `channelRoles` at `:58-63`, and `collectionLocations` at `:64-69`. A real MCP tool result is `content: [{type: "text", text: "..."}]` beside `isError`, and the text is markdown a person reads. AD-4 needs a JSON array for `for-all` and `for-any` to range over, and `bindings.ts:44-48` states the same thing from the capture side: the six fields "are about the channel the operation nominates". No field in the shape closes that gap, which is why `ARCHITECTURE-SPINE.md:656` records "Bringing `mcp` into v0 remains Deferred" and `:756` records the reason as "real responses are unstructured markdown with no JSON collection for AD-4's quantifiers". Every schema story after this one builds to whatever answer this question gets, so the answer has to exist before Story 11.4 declares an operation shape.

**Approach:** Record the answer and change no schema. The kind's first version describes an MCP tool's **structured** result, `ResponseDescriptor` describes it unchanged, and a tool that returns only markdown is outside this version. The two options turned down are recorded with what each would have cost: a descriptor over the MCP envelope, which makes all fourteen AD-31 predicates answer truthfully about transport framing and falsely about the tool, and a caller-declared markdown-to-JSON projection, which breaks AD-31's declaration-only rule and AD-32's trust boundary in one move. No AD-5 code is minted, because the three codes that already carry the condition already have throwers. The decision is written into AD-19's own response-descriptor paragraph and the Deferred entry it answers, and the two published sentences calling this an open question are corrected in the same diff.

## Boundaries & Constraints

**Always:**

- Every `file:line` in this story was read from this tree at 1.4.2 and is corrected where the epic register was stale. `apiShapedInterface` is `interface.ts:281-286`, and `:296` is where it hands `mcp` the api-shaped `Operation`.
- The decision goes into the register of the existing ADs as the mechanical consequence of opening a kind, the same way minting an AD-5 code appends a row to AD-5's table. AD-19's `**The response descriptor is per operation.**` paragraph (`ARCHITECTURE-SPINE.md:352`) is where a rule about the descriptor lives, and the Deferred entry at `:756` is the sentence this decision answers.
- Documentation moves in the story whose change makes a sentence false. Every published sentence this decision makes false is corrected here, quoted with its line number, with what it becomes.
- Prose the code contradicts is a defect. This story names each such sentence it found and fixes it in the same diff.
- The de-AI pass runs while the text is written, over every sentence this story adds to the spine, the two documentation pages, and the one source comment. A comment never runs longer than the declaration it documents.
- `check:boundary` scans `src/` and `corpus/` for host-project vocabulary. The one source comment this story corrects cites no epic, story, task, or decision number.

**Ask First:**

- Any change to `ResponseDescriptor`, `CollectionLocation`, `ChannelRole`, `ExpectedCardinality`, or `KeyTypeMap`. This story changes none of the five and its whole claim is that none needs changing.
- Any change to `EVIDENCE_CHANNELS` (`src/core/schemas/pointer.ts:12-21`). A channel for the prose half of a tool result is the deferred half of this decision and is nobody's in this epic.
- Minting an AD-5 code. Decision 4 records why none is needed and what a fourth code would have overlapped.

**Never:**

- No schema change. The eval contract takes no `schemaVersion` bump here; Story 11.4 owns the breaking one.
- No spine revision number is bumped and no new ADR is opened. The repository has a standing rule against escalating an ambiguity into either, and this story settles its ambiguity by construction and names Story 11.4 as the story that inherits it.
- No AD-5 code minted. A code with no thrower is the state `deferred-work.md:166` records AD-16's two forbidden-input checks having carried for a whole epic, and the cheapest way not to repeat it is to mint nothing.
- No kind is opened. `SUPPORTED_INTERFACE_KINDS` (`src/core/compile/interface-inventory.ts:31`) stays `['api', 'cli']`, `planPreflight`'s assertion at `src/core/preflight/plan.ts:305` stays as it is, and `qualifyProbe`'s check at `src/core/score/qualification.ts:753-762` stays as it is. All three are Story 11.5's.
- `ARCHITECTURE-SPINE.md:656`, "Bringing `mcp` into v0 remains Deferred", is left standing. It is true until Story 11.5 opens the kind, and Story 11.5 owns it.
- No operation shape is declared. `McpOperation`, its tool identity, its request channel, and its descriptor channel are all Story 11.4's, and this story hands that story a settled descriptor and a set of defaults to build to.

## I/O & Edge-Case Matrix

Each row is what the code in this tree already answers about the declaration in column two. The story ships no code, so the matrix is an inspection list, and every verdict below was read from the file named.

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Structured tool result, described | An `mcp` operation whose descriptor declares the keys of the tool's structured result | Every one of the six fields keeps the meaning its own `.describe()` states; `descriptorChannelOf` (`declared-inputs.ts:33-40`) already answers `response-body` for any operation carrying no `invocation`, and `descriptorRootOf` (`coverage/operations.ts:47-59`) already builds `/response-body` from it | N/A |
| Quantifier over a declared array | `for-all` over a key the descriptor types `array` | Compiles: `checkQuantifiersAgainst` (`expression-legality.ts:613-641`) throws only on a declared non-array | N/A |
| Quantifier over a markdown blob | `for-all` over a key the descriptor types `string` | `quantifier-over-non-collection` at `expression-legality.ts:636-640`, an existing code with an existing thrower | Structural failure |
| Quantifier over a channel with no declared structure | `for-all` over a pointer at the prose half of a tool result | The pointer names a channel this version gives `mcp` no spelling for, so it is `unreachable-check-evidence` at `reachability.ts:502-506` | Structural failure |
| Descent into an undescribed channel | A one-segment tail on a channel the operation's descriptor does not describe | `descendThroughDescriptor` is never reached; `evaluateReachabilityAgainstOperation` returns unreachable on the channel test, the same shape `reachability.ts:437-446` already uses for a command operation addressing an HTTP channel | Structural failure |
| Capture from the prose half | A step capturing a scalar out of a tool's text content | `captured-channel-undeclared` at `bindings.ts:255`, whose rule at `:41-52` is already "whichever channel the referenced operation's own response descriptor describes" | Structural failure |
| `collectionLocations` over a structured result | A location naming a pointer the descriptor types `array`, with an `expectedCardinality` | Means exactly what it means on an `api` operation: `makePointerDenotesCollection` (`evidence-resolution.ts:217-248`) matches the location's tokens against the target tail, and `descendThroughDescriptor`'s root-collection branch bounds an index against the declared cardinality | N/A |
| `collectionLocations` over a markdown result | A location naming a pointer that resolves to a string at run time | Nothing declares it illegal, and at score time `resolveQuantifier` (`resolution.ts:226-237`) folds ABSENT, a non-array, and an empty array onto one `empty-collection` value, so the check resolves `insufficient-evidence`, `abstained` under AD-6, and PASS is unreachable under AD-21 | Fails closed at score time, with no compile-time code |
| `collectionLocations: []` on a markdown-only tool | The honest declaration for a tool with no collection | `perRecordRelevance` (`relevance.ts:162-187`) and `omissionAndCompletenessRelevance` (`:229-260`) both grade an explicit empty list irrelevant, so two of the seven rules score clean over a result nobody checked. This is the state AD-31's Prevents clause names, and it is the reason this version does not admit such a tool | N/A, and it is why the restriction exists |
| A contract claiming structured content for a tool that has none | Any `mcp` contract, since the compiler never sees the tool | No compile-time answer is available and none is invented. The observation's `responseBody` (`sealed-run-record.ts:242-244`) is `null`, every pointer into it resolves ABSENT, comparisons resolve false under AD-26, and a quantifier resolves `insufficient-evidence` | Fails closed at score time under AD-32's declared-versus-observed rule |

</frozen-after-approval>

## Checkpoint decisions taken without the human

The build ran unattended by standing instruction, so the three checkpoints this workflow halts at were decided here and recorded in this section.

**Multi-goal gate: single goal, no split.** The deliverable is one recorded answer to one question, written into the AD that owns the descriptor and into the two published sentences that contradicted it. The corrected source comment, the learning-path step, and the regenerated projection are that same goal's own documentation, which this repository requires in the same diff.

**Token-count gate: keep the full spec.** It is well past 1600 tokens. The excess is the Code Map and the recorded decisions, and the scope stays one goal. Cutting it would delete the priced comparison of the three options, which is the deliverable rather than commentary on it, and the defaults Decision 7 hands to Story 11.4. The context-rot risk the gate names is mitigated by the story being implemented in the session that planned it.

**Open Questions: none.** The spec carried no entry. Every `file:line` in it was re-read against this tree before any file was edited, and the two the tool-use guide had moved were remapped by content after Story 11.2's heredoc landed: `:169-174` is now `:241-246` and `:240` is now `:313`. The intent matched exactly at both.

## Code Map

Nothing below is edited for behaviour. Each entry is what the decision was read against, and the last two groups are the text this story does edit.

**The shape the decision is about**

- `src/core/schemas/interface.ts:45-70` -- `ResponseDescriptor`, the six fields. `:49` records why no minimum of two sits on `requiredKeys`; `:53` records that `types` is caller-keyed by plain key name and that a missing key and an explicit `null` are two answers; `:56` records that `successIndicator: null` must stay representable for rule 1's relevance; `:62` records that `null`, `{}`, and a populated `channelRoles` map are three distinct answers; `:68` records the same three-way reading for `collectionLocations`.
- `src/core/schemas/interface.ts:31-37` -- `CollectionLocation`, whose `referenceSet` at `:34-36` is what makes AD-20 rule 6 relevant. `:25-29` is `ExpectedCardinality`'s three modes, and `:13-18` is `ChannelRole`'s closed four.
- `src/core/schemas/primitives.ts:150-155` -- `KeyTypeMap`, a record from `KeyName` to a nullable `JsonTypeName` (`:99`). Every collection claim in the descriptor bottoms out here.
- `src/core/schemas/interface.ts:197-208,230-250` -- `CommandDescriptorChannel` and `CommandOperation`, the precedent for how a non-HTTP kind got a descriptor. `:213-228` is the reasoning: one descriptor per operation, a tag saying which channel it describes, and no second success-indicator concept.
- `src/core/schemas/interface.ts:281-286,293-302` -- `apiShapedInterface` and `PermittedInterface`. `:296` is where `mcp` takes the HTTP-shaped `Operation` today, which is what Story 11.4 replaces.

**What consumes a descriptor, and why the answer costs nothing**

- `src/core/declared-inputs.ts:33-40` -- `descriptorChannelOf`, which answers `response-body` for every operation carrying no `invocation`. An `mcp` operation with no `invocation` field already resolves here, so a descriptor over the structured result needs no branch. `:70-78` is `targetsDescribedChannel`, whose header records that comparing the channel alone "was a defect at three separate sites".
- `src/core/declared-inputs.ts:99-101` -- `isCommandOperation`, which decides the shape by the presence of `invocation`, since an operation carries no kind field of its own; its header at `:94-98` says so. Its two-way answer becomes a three-way question in Story 11.4, and `isApiOperation` at `:104-106` has no consumer in `src/` today, which is what makes the widening cheap. Two callers live outside `src/`, at `tests/coverage/table.test.ts:317` and `tests/preflight/fixtures/observations.ts:355`, so Story 11.4 repairs the predicate and keeps it.
- `src/core/compile/reachability.ts:457-506` -- `descendThroughDescriptor`, the one descent rule, reached from whichever channel the operation nominates. `evaluateReachabilityAgainstOperation` (`:515-635`) is what reaches it and what tests the channel first: `:583-592` is the command branch refusing the three HTTP channels, which is the shape Story 11.4 mirrors for `mcp`, and `:632-634` is the residue that returns reachable for `response-headers`, `response-status`, and `exit-code`, so it is the line the new branch has to precede. `checkExpressionLegChannel` (`:307-336`) is a second site and is easy to miss: `:314-316` builds a witness leg's carried channels from `isCommandOperation` alone, so an `mcp` operation is told its leg carries `response-headers`.
- `src/core/compile/expression-legality.ts:613-641` -- `checkQuantifiersAgainst`, which resolves the operation, asks `targetsDescribedChannel`, and throws `quantifier-over-non-collection` on a declared non-array. This is the check AD-4's quantifiers rest on and the reason a markdown blob is not describable.
- `src/core/compile/bindings.ts:41-52,226-268` -- the capturable-channel rule and `checkCapturedChannel`. `:280-317` is `capturedType`, which requires a one-segment tail and a declared scalar, with the scalar test at `:311` reading `SCALAR_TYPES` (`:264-266`).
- `src/core/coverage/operations.ts:47-59,96-110` -- `descriptorRootOf` and `resolveOperations`. The root is `/${channel}` off any non-artifact channel, so an `mcp` operation already resolves to `/response-body` with no new case.
- `src/core/coverage/relevance.ts:50-96,98-125,162-187,229-260` -- the four relevance predicates that read the descriptor: rule 1 reads `successIndicator` and `channelRoles`, rule 2 reads `requiredKeys`, rule 4 reads `collectionLocations`, rule 6 reads `collectionLocations[].referenceSet`.
- `src/core/coverage/satisfaction.ts:80-100,244-316,318-383,430-480,592-693` -- `stepRoot`, `bodyPointer`, `keyPointer`, and the four satisfaction predicates that build pointers off `resolved.descriptorRoot`. The comment at `:83-87` states the property this decision leans on: the root travels on the resolved operation, so a kind whose response arrives elsewhere is one change in `operations.ts` and none at the call sites.
- `src/core/evaluate/evidence-resolution.ts:217-248` -- `makePointerDenotesCollection`, which tests the channel against the operation's own descriptor. Its inner comment at `:236-242` records why the body was un-hardcoded.
- `src/core/evaluate/resolution.ts:210-251` -- `resolveQuantifier`, whose guard at `:226-237` folds ABSENT, a non-array, and an empty array onto `empty-collection`. This is what makes a false structured-content claim fail closed at score time with no new code.
- `src/core/score/qualification.ts:148-151` -- `foreignChannels`, which gives every kind but `cli` the api response channels, so an `mcp` defect signature is already confined to `response-body`, `response-headers`, and `response-status`. That is the signature-side admissible set and it is wider than the oracle-side reachable set Decision 4 states, which is `response-body` and `response-status`. Story 11.6 narrows the signature side when it takes `McpDefectSignature`.
- `src/core/schemas/sealed-run-record.ts:242-254` -- `Observation.responseBody` and `responseStatus`. `:253` already disclaims an HTTP reading of the status and says why: "bounding this to HTTP would encode a protocol assumption the artifact outlives."
- `src/core/failure-codes.ts:11-38` -- the twenty-six codes. This story adds none, so the tuple and AD-5's table stay as they are.

**Spine text this story edits**

- `ARCHITECTURE-SPINE.md:352` -- AD-19's `**The response descriptor is per operation.**` paragraph. The decision lands here as the rule about which result an `mcp` operation's one descriptor describes, and what this version does not admit.
- `ARCHITECTURE-SPINE.md:756` -- the Deferred entry, `**`web`, `cli`, and `mcp` interface support, and the text-channel model `mcp` needs.**` Two things in it are now wrong: `cli` shipped in Epic 9, and "Supporting `mcp` is more than an enum entry: real responses are unstructured markdown with no JSON collection for AD-4's quantifiers" is the question this story answers. The entry narrows to the half that stays deferred, which is the text-channel model a markdown-only tool result needs.
- `_bmad-output/shareable/eval-quality-architecture-spine.html` -- the committed projection of the spine, written by `scripts/build-shareable.mjs` and compared byte for byte by `check:shareable`, step 6 of `validate` (`package.json:102,113`). Both spine edits above reach it. It is regenerated by `npm run build:shareable` and never hand-edited.

**Published prose this story's decision makes false**

- `docs/explanation/what-ships.md:40` -- "The response descriptor is the open design question behind the deferral. A tool that returns a markdown `content` array gives AD-4's quantifiers no JSON collection to range over, and no field in the shape closes that gap." The first sentence stops being true the moment the decision is recorded. `:38` and `:42` stay as they are: the kind is still refused until Story 11.5, and `web` is untouched here.
- `docs/how-to/evaluate-tool-use-behavior.md:241-247` -- the `**The response descriptor wants JSON that MCP does not promise.**` block, at `:169-174` before Story 11.2's heredoc moved it. `:242-243` and `:245` are accurate and stay. `:241`'s bold lead-in, `:244`'s citation of the architecture calling this "the open design question", and `:246`'s "no field in the shape closes that gap" are all superseded by the recorded restriction.
- `docs/how-to/evaluate-tool-use-behavior.md:313` -- "the third is the design question the architecture named and left open", at `:240` before Story 11.2's heredoc moved it. The third item becomes the settled restriction and what it excludes.
- Not this story's, confirmed by reading each: `evaluate-tool-use-behavior.md:35,53,104-110,160-167` describe the borrowed api-shaped operation and are Story 11.4's; `docs/reference/glossary.md:91` and `:106` enumerate which kinds compile and are Story 11.5's and Story 11.9's; `evaluate-ai-feature-behavior.md:154,172`, `evaluate-skill-behavior.md:33,52`, `evaluate-agent-behavior.md:57`, and `evaluate-workflow-behavior.md:105` each describe the `api` or `cli` descriptor correctly and are untouched.

**One stale source comment, found while reading**

- `src/core/evaluate/evidence-resolution.ts:209-210` -- "Only `response-body` can ever answer `true` (AD-19: `collectionLocations` is the only declared-collection surface, scoped to the body alone)." The function's own inner comment at `:236-242` says the opposite and describes what the code does. The header is prose the code contradicts, it is the sentence a reader of this decision would land on first, and it is corrected here.

## Tasks & Acceptance

**Execution:**

- [x] `ARCHITECTURE-SPINE.md:352` -- extend AD-19's response-descriptor paragraph with the recorded rule: an `mcp` operation's one descriptor describes the tool's structured result, `collectionLocations` names a JSON array inside it, and a tool result carrying only text is outside this version of the kind. No revision number moves and no ADR opens.
- [x] `ARCHITECTURE-SPINE.md:756` -- narrow the Deferred entry. Drop `cli`, which shipped in Epic 9; drop the question this story answered; keep the half that stays deferred, which is the text-channel model a markdown-only tool result needs, and say that the structured-result restriction is what defers it.
- [x] `npm run build:shareable` -- rerun it after both spine edits and commit the regenerated
      `_bmad-output/shareable/eval-quality-architecture-spine.html`. `scripts/build-shareable.mjs`
      projects `ARCHITECTURE-SPINE.md` into that file, and `check:shareable` compares the committed
      copy byte for byte as step 6 of `validate` (`package.json:102,113`), so a spine edit without
      the rebuild leaves `npm run validate` red. The HTML is generated and is never hand-edited.
- [x] `docs/explanation/what-ships.md:40` -- replace the open-question sentence with the settled one: the kind's first version describes a tool's structured result, a tool returning only markdown is outside it, and the deferral that remains is the text channel. Cut what the new sentence makes redundant.
- [x] `docs/how-to/evaluate-tool-use-behavior.md:241-247,313` -- rewrite `:172` and `:174` to the recorded restriction and rewrite `:240`'s third item from an open question to a stated boundary. `:170-171` and `:173` stay, since each is still exactly true.
- [x] `src/core/evaluate/evidence-resolution.ts:209-210` -- correct the header sentence to the rule the function implements, which is the channel the operation's own descriptor describes. Keep it shorter than the declaration it documents and delete the inner comment's duplicate half at `:236-242` if the corrected header already carries it.
- [x] De-AI and prune pass, run while each of the five edits above is written. Then grep the diff for `, not `, `rather than`, `instead of`, `as opposed to`, `, never `, and `no longer`, and confirm every surviving hit is a contrast whose two halves both carry a fact. BMad story files are exempt; `docs/*.generated.md` and `corpus/dev/README.md` are regenerated and never hand-edited.
- [x] `_bmad-output/project-knowledge/learning-path-step-by-step.md` -- add this story's step at the next unused number after whatever Stories 11.1 and 11.2 added, labelled `epic11-story3`, following `learning-path-template.md`, which is the authority on the step's shape, and add its row to the table at the top of the file. The teaching point is that a markdown blob gives a quantifier nothing to range over, which is the whole reason a kind sat deferred, and `In plain terms` carries no file path, no schema name, and no AD number.
- [x] No file under `src/core/schemas/` is edited. No generator runs. `FAILURE_CODES` (`src/core/failure-codes.ts:11-38`) stays at twenty-six.

**Acceptance Criteria:**

- Given AD-19's response-descriptor paragraph after the edit, when a reader asks which result an `mcp` operation's descriptor describes, then the paragraph answers it in the AD that owns the descriptor, and no revision number and no ADR moved.
- Given `git diff` over the branch, when the schema directory is inspected, then `src/core/schemas/` is unchanged, so the decision is reviewable without a schema review.
- Given the two questions this story owes, when the decisions section is read, then each is answered in its own decision with the code that decides it named: what an oracle may assert about a markdown tool result, and whether `collectionLocations` means anything for one.
- Given AD-5's registry, when it is compared against `FAILURE_CODES`, then both still hold twenty-six codes and no code was minted without a thrower.
- Given `docs/explanation/what-ships.md` and `docs/how-to/evaluate-tool-use-behavior.md` after the edits, when each is grepped for "open design question", "left open", and "no field in the shape closes that gap", then there are no hits, and every surviving sentence about the deferral is about the text channel.
- Given `_bmad-output/project-knowledge/learning-path-step-by-step.md`, when the new step is read against `learning-path-template.md`, then it carries the template's headings in order, its `In plain terms` block uses no repository vocabulary, and its table row is present.
- Given `npm run validate`, when it runs, then it exits 0 with nothing on stderr, which for this story is a statement that moving spine and documentation prose broke none of its 21 steps, `check:shareable` at step 6 included.

## Decisions settled by construction

**Decision 1: the kind's first version describes a tool's structured result, and a tool that returns only markdown is outside it. This is the recorded answer to the deferral.**

`ResponseDescriptor` is unchanged and every consumer keeps its shipped reading, which is the whole test of whether an answer is cheap. `descriptorChannelOf` (`declared-inputs.ts:33-40`) already returns `response-body` for any operation carrying no `invocation`, `descriptorRootOf` (`coverage/operations.ts:47-59`) already builds `/response-body` from it, `descendThroughDescriptor` (`reachability.ts:457-506`) already descends it, `makePointerDenotesCollection` (`evidence-resolution.ts:217-248`) already tests a collection location against it, and `foreignChannels` (`qualification.ts:148-151`) already gives a non-`cli` kind the api response channels. An `mcp` operation whose descriptor describes a structured tool result therefore inherits all fourteen AD-31 predicates working exactly as they do for `api`, with zero new branches in the four coverage-reading modules.

The restriction is what the MCP protocol itself moved toward: a tool that declares an output schema returns its result as structured content, and that content is JSON by the protocol's own definition. Restricting the kind's first version to those tools takes the half of the protocol that AD-4 can already reason about and leaves the half it cannot.

The restriction is enforced by the declaration rather than by a check, on Story 9.1's own precedent for AD-35: "`Identifier` is what makes AD-35 structural instead of advisory." An `McpOperation` declares one descriptor and nominates the channel it describes, and Story 11.4 ships that nomination as a tagged union carrying one member. A contract for a text-only tool has nothing to spell.

Downstream consequence: Story 11.4 declares `McpOperation` with `responseDescriptor: ResponseDescriptor` unchanged, exactly as `CommandOperation:245` carries it, and the tagged descriptor channel with its single member. Story 11.7's AD-31 grading file for `mcp` grades the same fourteen predicates against a structured-result contract, with no predicate needing a kind-specific reading.

**Decision 2: what an oracle may assert about a markdown tool result, answered.**

Over the described structured result, every operator in AD-4's closed set. Over a channel carrying markdown, three things and no more, and each is already decided by shipped code: the channel's presence or absence, since `existence` and `absence` read the root; a whole-string relation such as `regex` or `containment`, since the root resolves to the string itself; and nothing else. It cannot be descended into, because `descendThroughDescriptor` gates the first tail token on `requiredKeys` and `permittedKeys` and a string declares neither. It cannot be quantified over, because `checkQuantifiersAgainst` (`expression-legality.ts:613-641`) throws `quantifier-over-non-collection` on a declared string and `resolveQuantifier` (`resolution.ts:226-237`) folds a non-array onto `empty-collection` at score time. It cannot be captured from, because `capturedType` (`bindings.ts:280-317`) requires a one-segment tail with a declared scalar type. It cannot be an operand of `covers-by-key`, which AD-4 defines as a bijection over two collections.

Three assertions is not enough to grade a tool call, and that is the finding. AD-20 rule 2 asks an oracle to cover every required key of the descriptor, and a descriptor over a blob has none. AD-20 rule 4 asks for a per-record check rather than a spot-check, and a blob has no records. Two of the seven discipline rules are unwritable over a markdown result, so a contract over one is graded on five rules and reports clean, which is the state AD-31's own Prevents clause names: "a contract that declares almost nothing rendering every rule irrelevant and scoring clean."

Downstream consequence: this is the paragraph Story 11.9 draws the rewritten tool-use guide's boundary section from. The advice that follows from it is to put the tool-calling agent behind a command and declare `cli`, which reaches the same three assertions plus everything `stdout`, `stderr`, `exit-code`, and the artifact channel carry. Story 11.9 owns every line of that guide's prose and decides where the advice lands on the rewritten page, so this decision states the reasoning and claims no line.

**Decision 3: `collectionLocations` means nothing for a markdown tool result, and that is the load-bearing half of the restriction.**

For a structured result it means what it means on an `api` operation, verified at both ends: `makePointerDenotesCollection` (`evidence-resolution.ts:217-248`) compares `decodeTail(location.pointer)` against the target's tail and answers true only when the operation's own descriptor describes that channel, and `descendThroughDescriptor`'s root-collection branch (`reachability.ts:472-490`) bounds an array index against the declared `expectedCardinality`. For a markdown result neither operation has an operand: a text channel has no tail to match tokens against, and a string has no indices to bound.

The declaration a markdown-only tool would honestly carry is `collectionLocations: []`, and that spelling is representable and is the trap. `interface.ts:68` states the rule it trips: "AD-31 grades an absent declaration and an explicitly empty one differently, so `null` and `[]` are distinct answers." `perRecordRelevance` (`relevance.ts:162-187`) and `omissionAndCompletenessRelevance` (`:229-260`) both grade `[]` as the explicit empty answer and return irrelevant, so rules 4 and 6 score clean over a result nobody checked. `null` is no better, since it makes both rules relevant and permanently unsatisfiable, which is a permanent coverage gap on every MCP contract in existence. Two spellings, two wrong answers, and no third spelling: that is the descriptor gap stated exactly, and it is why the boundary is one the schema enforces.

Downstream consequence: Story 11.7's grading file asserts the whole fourteen-verdict table for `mcp` and pins rules 4 and 6 as decidable, which is the evidence that the restriction did the work claimed for it.

**Decision 4: no AD-5 code is minted, and three existing codes carry every condition the restriction produces.**

`unreachable-check-evidence` (thrown from `evaluateReachabilityAgainstOperation`, `reachability.ts:515-635`) fires on a pointer at a channel an MCP tool does not produce, which after Story 11.4 is every channel but `response-body` and `response-status`. Story 11.4 mirrors the branch at `reachability.ts:583-592` that already refuses the three HTTP channels for a command operation, and the code's own AD-5 row already reads "addresses evidence unreachable through the declared interfaces", so the row needs no widening. `quantifier-over-non-collection` (thrown at `expression-legality.ts:636-640`) fires on a quantifier over a key the descriptor types a non-array, and its row already reads "typed a non-collection by the invoked operation's response descriptor", which is kind-neutral as written. `captured-channel-undeclared` (thrown at `bindings.ts:255`) fires on a capture from a channel the descriptor does not describe, and its row already reads "any channel but the one its operation's response descriptor describes", widened to that wording by Story 9.3.

The condition with no compile-time code is the interesting one, and it needs none: a contract that declares structured content for a tool that returns only markdown is making a claim about a system the compiler never sees. AD-32 fixes what the package does about such a claim, which is to verify declared-versus-observed consistency and fail loudly. It already does. The tool answers with no structured result, `Observation.responseBody` (`sealed-run-record.ts:242-244`) is `null`, every pointer into it resolves ABSENT, AD-26 makes every comparison false and `existence` false, and any quantifier resolves `insufficient-evidence` through `resolution.ts:226-237`, which is `abstained` under AD-6 and makes PASS unreachable under AD-21. A false claim about the tool's shape is caught on the first run.

The alternative considered was a `descriptor-channel-unsupported` code fired at compile when an `mcp` contract nominates a channel this version does not admit. It was turned down for two reasons. Story 11.4's tagged descriptor channel makes that state a parse failure rather than a compile finding, so the code would have nothing to fire on. And a fourth code overlapping three existing ones is what AD-5's own Prevents clause describes: "two compilers each inventing their own answer to what fails compilation." `FAILURE_CODES` therefore stays at twenty-six, `check:ad5-registry` needs no row, and no story in this epic inherits an obligation to write a thrower. That last sentence is the point: `deferred-work.md:166` records AD-16's two forbidden-input checks carrying a code with no thrower for a whole epic, and minting nothing is the only version of that mistake that cannot be made.

**Decision 5: the descriptor over the MCP envelope is the option turned down, and its cost is that AD-31 answers confidently and wrongly.**

The option was to declare the descriptor over the tool result envelope, with `content` and `isError` as its keys and each content block's `text` treated as a scalar channel. It is the cheapest of the three and it needs no schema change at all, which is exactly what makes it dangerous.

Priced against the fourteen predicates: `requiredKeys` becomes `['content']` for every MCP tool that will ever be written, so AD-20 rule 2's denominator is one, and a single oracle addressing `/response-body/content` satisfies whole-body coverage. `collectionLocations` naming `/content` makes rule 4 relevant and satisfiable by a quantifier over content blocks, which asserts that the envelope has blocks. `successIndicator` becomes `/isError`, and `successIndicatorSeparationRelevance` (`relevance.ts:50-96`) then needs one other pointer carrying a channel role, which can only be `/content`, so rule 1 grades satisfied on the pair. Every one of those verdicts is true of the declaration and says nothing about the tool. `tests/coverage/command-coverage.test.ts:1-13` records what that cost the last time it happened: "a whole interface kind went ungraded while the suite stayed green" over three of the fourteen predicates for a full release, which is why a new kind is owed its own grading file at all.

The second cost is the one that decides it. Contracts authored against an envelope descriptor cannot be moved to a structured one without retyping every `requiredKeys`, `types`, `successIndicator`, and `collectionLocations` value in the field, and AD-11 makes that a breaking `schemaVersion` bump with no migration. The restriction in Decision 1 goes the other way: admitting markdown later adds a member to a tagged union, which AD-11 makes additive. Taking the cheap option now buys a shape that cannot be corrected, and the correction is the thing this story exists to make possible.

**Decision 6: the caller-declared parsed projection is the second option turned down, and it breaks two ADs before it writes a line.**

The option was to admit a projection: the caller declares how markdown becomes JSON, and the descriptor describes the projection's output.

It breaks AD-31 at the root. AD-31's rule is that "relevance is computed from declarations only" and that "all fourteen relevance-and-satisfaction predicates are therefore declaration-only." A projection is a computation, and the shape of its output is not readable from any declaration, so the fourteen predicates would be grading a descriptor over a body that does not exist until a parser has run. It breaks AD-32 in the same move: the caller performs the projection, so the descriptor describes a value the package never sees produced, and the declared-versus-observed check that catches Decision 4's false claim has nothing left to compare.

Its build cost is the largest of the three and is stated for completeness: a markdown-to-JSON declaration grammar, its published schema entries, an AD-5 code for a projection that does not type-check, a thrower for that code, mutation fixtures under AD-13's sweep for every keyword the grammar publishes, and two implementations of one parser, which is precisely the risk AD-4's own record names when it rejects an open string for a comparison ("two implementations must not disagree"). Its only advantage over Decision 1 is that it admits markdown-only tools now, and Decision 1 admits the same tools later by adding a union member, so nothing is lost by waiting and a grammar is not written on a guess about what an author would want to extract.

**Decision 7: the defaults Story 11.4 inherits, recorded here so that story decides an operation shape and inherits this one settled.**

Four things follow from Decision 1 and each is settled here with its reasoning, per the epic's rule that an ambiguity is settled by construction in the story that finds it with the later story named.

The evidence channel is `response-body` and no channel is added. `EVIDENCE_CHANNELS` (`pointer.ts:12-21`) is AD-26's closed vocabulary, adding a member moves the published census in the six places `tests/schemas/published-census.ts` pins, and it buys no decidability: `Observation.responseBody` already carries a JSON value, `channelRoot` (`evidence-resolution.ts:107-156`) already resolves it, and `descriptorChannelOf` already answers it for an operation carrying no `invocation`.

The descriptor channel ships as a tagged union with one member, following `CommandDescriptorChannel` (`interface.ts:197-208`) and Story 9.1's stated reason for shipping that tag with one member: an added member is additive under AD-11 and a retyped bare field is breaking. Here the second member is known in advance, since it is exactly the markdown channel Decision 6 defers, so the tag earns its keep on the first day.

`isError` is carried on `response-status` as 0 or 1. `Observation.responseStatus` is `z.int().min(0).nullable()` (`sealed-run-record.ts:248-254`) and its own description at `:253` already disclaims an HTTP reading, `foreignChannels` (`qualification.ts:148-151`) already admits `response-status` for a non-`cli` kind so a defect signature can name it, and it keeps the protocol's error flag out of `requiredKeys`, which is where Decision 5's whole failure came from. Story 11.13's adapter is what performs that projection.

The prose half of a tool result has no channel in this version, so a pointer at it is `unreachable-check-evidence` through the branch Story 11.4 mirrors from `reachability.ts:583-592`. That branch closes `response-headers` and `exit-code` for `mcp` and leaves `response-body` and `response-status` open, matching Decision 4's list exactly: an MCP tool call carries no HTTP headers and no process exit code, and `response-status` is where `isError` lands. `reachability.ts:632-634` is the residue that returns reachable for all three of `response-headers`, `response-status`, and `exit-code` today, so it is the line the new branch has to precede.

That branch alone is half the job, and the review found the other half. `checkExpressionLegChannel` (`reachability.ts:307-336`) builds a witness leg's carried channels at `:314-316` from `isCommandOperation` alone, so an `mcp` operation takes the api arm and is told its leg carries `response-headers`. It is called from `sensitivity-witness.ts:389` for every witness relation, so a witness addressing `/response-headers/...` on a tool call passes reachability unless this site is closed too. Story 11.4 closes both. `response-status` on that arm is already right, since Decision 7 puts `isError` there.

`isCommandOperation` (`declared-inputs.ts:99-101`) reads `invocation` and answers a two-way question that becomes three-way, and two more of its callers move with it. `operationReference` (`seal/derived-reference.ts:73-76`) renders any non-command operation as "the <name> endpoint", so an MCP tool would reach a sealed evaluator's brief as "the search notes endpoint", which is prose the evaluator reads. `foreignChannels` (`qualification.ts:148-151`) is `kind === 'cli' ? API_RESPONSE_CHANNELS : COMMAND_RESPONSE_CHANNELS` over a bare `string` parameter, so it gives `mcp` the right answer through its default arm rather than by declaration; correct today and correct for this decision, and worth knowing once Story 11.4 opens a kind through that arm. `boundChannelsOf` (`declared-inputs.ts:120`, with `:145`) is the one request-side site, and it hands an `mcp` operation all four `TRANSPORT_CHANNELS`, so a tool call is modelled as declaring `path`, `query` and `header` alongside `body`. That is the ceremony the tool-use guide already names, it is outside this story's response-side scope, and it is the first site Story 11.4 touches when it declares the request channel.

**Decision 8: what Story 11.4 inherits, restated against the tree as it is now.** Story 11.2 handed three
things forward, and one of them moved while this story was in flight. Each is recorded here so Story 11.4
reads the current truth rather than reconstructing it.

The tool-use page's example contract still carries a second fault behind the kind, and this story does not
touch it. Flip `kind` to `api` and it exits 4 under `malformed-operator-expression`: the tool call carries
its arguments in `body`, and AD-10 gives a non-mutating operation `path` or `query` for its witness
(`legalChannels`, `sensitivity-witness.ts:319-322`, thrown at `:331-338`). That is a request-side question, and every declaration this story
settles is response-side, so nothing here makes an `mcp` operation able to declare a legal sensitivity
witness. Story 11.4's operation shape still has to solve it, on the precedent of `COMMAND_WITNESS_CHANNELS`,
which admitted all four channels for `cli` because AD-10's marker rule decides nothing for a command.

The frozen matrix's prediction that Story 11.5 sees exit 0 stays wrong for that same reason, and Story
11.2's Decision 6 carries the correction. Opening the kind clears `checkInterfaceKind` and hands the
contract to `checkWitnessLegality`, so Story 11.5 keeps whatever code Story 11.4 leaves declared and removes
the `<!-- expect-exit: 4 -->` line only once `compile` over that page's contract really exits 0.

The constraint that Story 11.4 keep exactly one operation in the page's heredoc is now enforced rather than
trusted. `check:doc-invocations` compares the `text` fence under a declared-exit command against that run's
stderr, so a second operation colliding under `duplicate-operation-signature` turns the gate red naming the
mismatch, where before it passed at the shared exit 4 with the page stale. Story 11.4 still edits the fence
in the same diff when it changes what the contract declares; what changed is that forgetting is now a build
failure. The gate also reads the page's own heredoc ahead of any file at the same path in the clone, so a
leftover `mcp-contract.json` at a clone root no longer decides the verdict.

**Decision 9: the stale interface-kind count in `src/core/schemas/` ships as its own change, and Story 11.4 does not inherit it.**

The review found `sealed-run-record.ts:253`'s `responseStatus` description reading "AD-19 declares four interface kinds and v0 rejects three of them at compile time under `unsupported-interface-kind`". Two are rejected. `sensitivity-witness.ts:73` in the same directory already reads "`api` and `cli`, rejecting `web` and `mcp`", so the two files contradict each other. It is Epic 9 staleness, surfaced because this story is sweeping the same claim out of four places in the spine.

It cannot be fixed here. A `.describe()` string is published into `schemas/sealed-run-record.schema.json`, which `check:schemas` compares byte for byte, so correcting the sentence means running the schema generator and committing a schema-document diff. This story's frozen block says "No file under `src/core/schemas/` is edited. No generator runs." Reading that as scoped to schema shape rather than to comments is a plausible reading and it is still a session reinterpreting a sentence a human froze to constrain it, so it was escalated instead.

Three options were put up and the second was turned down explicitly, which is the part worth recording. Handing it to Story 11.4 looked free, because that story already retypes `interface.ts` and already takes a breaking `schemaVersion` bump, so the generator runs there anyway. It was refused: a finding moved into a later story is deferred work whether or not the story has an owner, and the argument for moving it was development cost, which is not what decides this. Epic 11 has already handed work forward twice, and both times the receiving session had to be told to take it. The ruling is that it ships as its own change from this session, immediately after this story merges, with its own generator run and its own gate.

Two constraints ride with it. The fix was scoped as a repository-wide sweep on the suspicion that two disagreeing files in one directory meant a family; the peer's grep of `src/` found only this one string, since `sensitivity-witness.ts:73` is already correct, `defect-signature.ts:157` counts the three kinds sharing the api operation shape and says nothing about compilation, and `cli/run.ts:200` counts flags. The sweep is that one string plus the regeneration, and the search is still run before the fix is written. And each corrected sentence is phrased so that Story 11.5 changes a numeral and nothing else when it opens `mcp`, the same discipline the epic sets for the committed-chain count. Any sentence that cannot be phrased that way is named for Story 11.5 in that change's own record.

## Design Notes

The organising idea is that this repository already answered this question once, for a different kind, and the answer generalised. Story 9.1 found `reachability.ts` hard-coding `response-body`, and the repair was `descriptorChannelOf`: one rule, several roots, with the operation itself saying which root it means. `descriptorRootOf` in `coverage/operations.ts` is the same move on the coverage side, and its own comment says what it bought, which is that a kind whose response arrives on another channel costs one change and none at the five call sites that build pointers.

So the descriptor is a declaration of structure over whichever channel an operation nominates, and it has been that since Epic 9, while the deferral's own sentence at `ARCHITECTURE-SPINE.md:756` still describes it as a JSON-body shape. What it genuinely cannot describe is a channel with no structure, and a markdown blob is that channel. Reading the gap that way turns the question from "how do we make the descriptor fit markdown" into "which tool results have structure", and the second question has an answer the protocol itself supplies.

The three candidate options are, in that light, three different places to put the boundary. Option 1 puts it around the envelope and gets structure that is real and irrelevant. Option 2 puts it around a parser and gets structure that is invented by the caller. Option 3 puts it around the tools that already have structure, which is the only one of the three where the thing described is the thing evaluated.

## Verification

This story ships prose, so most of the verification is inspection. Every command below is a check that reads the text this story moves.

**Commands:**

- `npm run lint:spine` -- expected: exit 0. It runs with `--registry-ad 5 --fail-on high` (`package.json:76`) and this story adds no AD-5 row, so it is checking that the AD-19 and Deferred edits left the document's structure intact.
- `npm run check:ad5-registry` -- expected: exit 0. `scripts/check-ad5-registry.ts:96` parses the first column only, and this story adds no row and edits no code name, so the twenty-six in `src/core/failure-codes.ts:11-38` still match the table.
- `npm run check:docs` and `npm run check:doc-invocations` -- expected: exit 0. The tool-use guide is an executed input to every gate run once Story 11.2 lands, and this story edits its prose without touching its heredoc contract at `:84-133` or its declared exit code at `:137-143`.
- `npm run check:shareable` -- expected: exit 0. It is step 6 of `validate` (`package.json:113`) and
  compares `_bmad-output/shareable/eval-quality-architecture-spine.html` byte for byte against a
  fresh projection of the spine, so this is the check that catches a spine edit shipped without
  `npm run build:shareable`.
- `npm run check:boundary` -- expected: exit 0 against the one corrected source comment.
- `npm run validate` -- expected: exit 0 with nothing on stderr. It runs 21 steps at this story's
  boundary, unchanged from 1.4.2, since this story adds no script.

**Manual checks:**

- `git diff --stat` shows no file under `src/core/schemas/`, no file under `schemas/`, and no file under `corpus/`. The one file under `src/` is `src/core/evaluate/evidence-resolution.ts`, and its diff is comment text. `_bmad-output/shareable/eval-quality-architecture-spine.html` appears, and its diff is the projection of the two spine edits, produced by `npm run build:shareable`.
- `ARCHITECTURE-SPINE.md` frontmatter still reads `revision: 9` at `:11`, and the `updated` field at `:10` is unchanged. No file was added under the ADR directory.
- AD-19's response-descriptor paragraph answers, in the AD that owns the descriptor, which result an `mcp` operation's descriptor describes and what this version excludes.
- `ARCHITECTURE-SPINE.md:756` names neither `cli` nor the question this story answered, and names the text-channel model as the half that stays deferred.
- Grepping `docs/` for `open design question`, `left open`, and `closes that gap` returns nothing. Grepping for `unsupported-interface-kind` and `refused at compile` returns the same hits it did before this story, since no kind opened here.
- The learning-path step matches `learning-path-template.md`'s headings in order, its `In plain terms` block contains no file path, no schema name, and no AD number, and the table row at the top of the file is present.
- The de-AI grep over the diff (`, not `, `rather than`, `instead of`, `as opposed to`, `, never `, `no longer`) returns only hits where both halves of the contrast carry a fact.

## Review Triage Log

Four reviews ran: a peer Claude Code session with its own read of the tree, plus the blind-hunter, edge-case and verification-gap layers. Every finding gets a row. Nothing is routed to deferred work: the repository owner's standing rule is that a finding is fixed in the pass that finds it, so the one finding this story may not touch is recorded in Decision 9 with its ruling and its owner named.

| Verdict | Finding | Evidence and disposition |
| --- | --- | --- |
| high | Six `reachability.ts` spans in this story point at the wrong function, off by roughly 145 lines | Verified by reading the file: `descendThroughDescriptor` is `:457-514` and the story said `:311-359`, which is `checkExpressionLegChannel`; the command branch refusing HTTP channels throws at `:583-592` and the story said `:437-446`, which is step resolution; the reachable residue is `:632-634` and the story said `:486-488`, which is a cardinality bound. Corrected in the Code Map and in Decisions 1, 3, 4 and 7. Story 11.4 is the reader those addresses exist for. |
| high | The diff makes the spine contradict itself about `cli` | Verified at three sites the diff did not touch: AD-5's registry row (`:232`), AD-13's probe-semantics sentence (`:288`), and AD-3's calibration paragraph (`:191`), plus the narrative at `:657`. All four said `cli` is refused while the edited Deferred entry now says it compiles, and the code sides with the entry. All four corrected and the projection regenerated. `check:ad5-registry` reads the first column only, so the registry row's description column was safe to edit. |
| medium | `checkExpressionLegChannel` is a second site needing the `mcp` branch and Decision 7 did not name it | `reachability.ts:314-316` builds a witness leg's carried channels from `isCommandOperation`, so an `mcp` operation is told its leg carries `response-headers`; called from `sensitivity-witness.ts:389` for every witness relation. Named in Decision 7 so Story 11.4 closes both sites. |
| medium | The bold lead-in at `evaluate-tool-use-behavior.md:241` was left stale | "The response descriptor wants JSON that MCP does not promise" contradicts the body under it after this change. It is the sentence a skimmer takes away. Rewritten. |
| medium | The page's own example descriptor is the option Decision 5 turns down | The heredoc declares a descriptor over `content` and `isError` with `collectionLocations: []`, which is the envelope option and one of the two wrong spellings. A first adopter copies it. The page now names both and says what each costs. |
| medium | Step 47's `collectionLocations: []` bullet reads as a recommendation | The template designates `Rules` as lookup material read out of order, so the bullet is read alone. It now names the spelling as the trap. |
| medium | Step 47 claimed no verdict can reach PASS over an absent body | `absence(ABSENT)` returns true (`operators.ts:59-61`) and `resolveAbsenceNode` runs in total mode, so an absence oracle over the missing body holds. The bullet now says the checks that read the result collapse. |
| medium | This story's `evaluate-tool-use-behavior.md` citations were stale against its own baseline | Story 11.2's heredoc grew the page after this spec was written: `:169-174` is `:241-247` and `:240` is `:313`. Both corrected in the Code Map and the task list, each naming the pre-11.2 span so the drift is legible. |
| medium | `src/core/schemas/sealed-run-record.ts:253` says v0 rejects three interface kinds | Verified; two are rejected, and `sensitivity-witness.ts:73` in the same directory disagrees with it. Cannot be fixed here: the string is published into a byte-checked schema document and this story's frozen block forbids both a `src/core/schemas/` edit and a generator run. Escalated and ruled on. See Decision 9. |
| medium | `what-ships.md` stated a narrower rule than the spine records | "the JSON an MCP tool returns when it declares an output schema" excludes a tool that returns structured content without declaring one, which the spine admits. Reworded to test the result rather than the schema declaration. |
| low | The rewritten inner comment in `evidence-resolution.ts` stopped saying what the line does | The kept text opened with the history and sat above the guard it explains. One clause restored naming the current test, with the history after it. |
| low | The dropped `cli` clause left the spine carrying neither the AD-2 question nor its answer | The Deferred entry's removed half asked whether running a binary is fixture probing or execution. Epic 10 answered it in code. The narrowed entry now records the answer in one clause rather than dropping the subject. |
| low | The AD-19 paragraph promised an additive change against a shape that has no such field | The api-shaped `Operation` `mcp` uses today carries no descriptor-channel tag, so the tag arrives on the breaking bump that opens the kind and only a later member is additive. The paragraph now says so. |
| low | Decision 8 cited `sensitivity-witness.ts:314-317`, the middle of a comment | The rule is `legalChannels` at `:319-322` and the throw at `:331-338`. Corrected. The claimed behaviour was right. |
| low | Step 47's read list gave one entry with no path, and one rule counted fault codes without naming them | Both are template rules. The spine entry carries its full path and the rule names `unreachable-check-evidence`, `quantifier-over-non-collection`, and `captured-channel-undeclared`. |
| low | Step 47's `Watch out` misdescribed the docs home page routing table | The routing table's tool-use row reads "Declared and refused at compile"; the `api`-and-`cli` claim is the prose above it, and What Ships carries no table. Step 45 quotes the same row correctly. Corrected. |
| low | Step 47's text-channel rule was present tense about a channel this version does not spell | Reworded to the conditional, since Decision 7 says the prose half has no channel here. |
| low | `seal/derived-reference.ts:73` renders a tool call as "the <name> endpoint" | A third `isCommandOperation` caller, and it is prose a sealed evaluator reads. Named in Decision 7's inheritance list. |
| low | No `[Unreleased]` changelog entry for two published-doc changes | `CONTRIBUTING.md` asks for one for anything a consumer would notice, and 1.4.2's `Changed` section is entirely documentation prose. Added. |
| false | Nothing in `src/` refuses a text-only `mcp` descriptor, so add a compile check | The restriction is carried by the declaration by design, recorded in Decision 1, and the kind is refused at compile until Story 11.5, so no contract can reach the state a check would guard. Adding one is also forbidden by this story's frozen Never. Rejected on the refutation. |
| false | The story's central claim that a structured-result `mcp` operation needs zero new branches in the coverage-reading modules | The peer verified it site by site: `isCommandOperation` is `'invocation' in operation`, so an `mcp` operation resolves through the api arm in `descriptorChannelOf`, `descriptorRootOf`, `makePointerDenotesCollection` and `foreignChannels`. The claim holds as written. The sites that do need a branch are all outside those four modules and are now all named in Decision 7. |
