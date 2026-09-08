---
title: 'The channel vocabulary and the pointer grammar'
type: 'feature'
created: '2026-09-07'
status: 'done'
review_loop_iteration: 0
context:
  - _bmad-output/implementation-artifacts/epic-9-context.md
  - _bmad-output/implementation-artifacts/9-1-the-interface-kind-shaped-operation.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem (CORRECTED):** Two gaps sit one level apart. The first is that AD-26's closed channel vocabulary (`src/core/schemas/pointer.ts:12-20`) has no member for a file the system under test wrote. **The claim that a written file is "the dominant output shape for a command-line tool" is measured and false**, and it is false in a way that changed this epic's order. Counting evidence pointers across the nine contracts authored against the published schema outside this repository: 110 address `stdout` with a one-segment tail, 18 address a written artifact, and 1 addresses the exit code. Standard output is the dominant shape by six to one, and the artifact channel unblocks exactly one of the nine contracts. Story 9.1 therefore took the descendable output channel and left the artifact channel here, which is why seven of the nine compile at the end of 9.1 and the ninth waits on this story. The second is that no channel is legal or illegal for anything. `evaluateReachabilityAgainstOperation` returned `reachable()` for a bare `stdout` pointer unconditionally and for `response-headers`, `response-status`, and `exit-code` unconditionally, so an api contract addressing `/interactions/write/stdout` compiled clean. Story 9.1 closed half of that: a command operation's non-nominated stream and its three response channels are now `unreachable-check-evidence`, and the descriptor descent is rooted on whichever channel the operation nominates. What is left here is the api direction, where a bare `stdout` pointer on an operation that produces no process output is still admitted. The source already names the reason: "The contract side cannot decide this: reachability rejects a tailed `stdout` pointer and returns reachable for a bare one unconditionally, because an operation carries no interface kind" (`src/core/score/qualification.ts:129-133`). Story 9.1 put the kind within reach; nothing yet reads it.

**Approach:** Add `artifact` to `EVIDENCE_CHANNELS` as a fourth partition class, identifier-rooted and tail-bearing, spelled `/interactions/<stepId>/artifact/<artifactId>/<tail>` for the reason AD-26 already gives for `call-inputs`: a channel that names one of several things needs a declared segment to resolve against, and "revision 3 rooted `call-inputs` directly on a key name, which had no declared structure to resolve against." The four command channels under `call-inputs` shipped in Story 9.1, because the grammar is parsed with no contract in hand and the alternation had to admit them before any command contract could address its own inputs; what remains here is the per-kind legality rule over them. Then make channel legality a per-kind compile-time rule under two new AD-5 codes, one for the evidence side and one for the input side, placed in the registry ahead of `unreachable-check-evidence` because a channel the kind never produces is a stronger and earlier statement than a key an operation does not declare.

## Boundaries & Constraints

**Always:**

- The channel vocabulary stays closed and its order stays load-bearing. `pointer.ts:5-11` records why: "order matters because enum order lands in the export, and the published-schema drift check pins whatever ships." `artifact` is appended, never inserted.
- The partition stays disjoint and exhaustive. `pointer.ts:45-49` says the three-way partition "is spelled out and typed against the enum rather than rebuilt from it, so a typo fails the typecheck; a test asserts it stays disjoint and exhaustive." That test is `tests/schemas/pointer.test.ts:158` and it moves from seven members to eight, with a fourth class.
- Both new AD-5 codes are appended to AD-5's registry table in the same diff that mints them, preserving `check:ad5-registry`'s set-and-order equality, exactly as `epic-7-context.md:32` records for `binding-cycle` and `captured-channel-undeclared`. `lint:spine` runs `--registry-ad 5` over that table and must stay green.
- Every code this story mints ships its thrower in the same diff. A code with no thrower is what `deferred-work.md:125-128` records AD-16's two forbidden-input checks having been for a whole epic.
- ~~The eval contract takes one BREAKING `schemaVersion` bump, 4 → 5~~ **(WRONG, see the divergence note below: one bump landed, not two.)** The eval contract's accepted language widens here, recorded in the driving field's own `.describe()`. `InteractionPointer`'s accepted language widens, which retypes every field that carries one: oracle evidence targets, every `{ pointer }` operand, every `{ captured }` binding, and every rubric criterion's evidence.
- No source comment may contain any of `check:boundary`'s twelve forbidden strings.

**Ask First:**

- Removing `cli` from `checkInterfaceKind`. That is Story 9.3's.
- Widening `PlanIndex.operationOf`'s return type, or branching any check that reads `responseDescriptor` or `requestShape`. Those are Story 9.3's, and this story reads only `interfaceKindOf`.
- Changing `Observation`, `ObservedCallInputs`, or `QuotedEvidence`. Those are Story 9.4's, and the window this story opens between them is named in Decision 6.

**Never:**

- No second pointer grammar. AD-26 says "No dot-path, no wildcard, no expression language", and `defect-signature.ts:9-29` records that the signature "spends one fixed word instead of minting a fourth pointer grammar". The `artifact` channel is a fourth partition class inside the one grammar, not a fifth spelling.
- No relative addressing beyond `@/`. AD-26: "Inside a quantifier the bound element is addressed by the relative form `@/` plus a pointer, and that is the only relative addressing in the grammar."
- No AD-28 runtime fault code. This story is compile-time only.
- No spine amendment beyond AD-5's registry table, and no new ADR.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Artifact pointer, with tail | `/interactions/run/artifact/report/summary/verdict` | Parses; `parseEvidenceTarget` returns channel `artifact`, `artifactId: "report"`, tail `["summary", "verdict"]` | N/A |
| Artifact pointer, no tail | `/interactions/run/artifact/report` | Parses; tail is empty, addressing the whole artifact, exactly as `/interactions/w/call-inputs/body` does today | N/A |
| Artifact pointer, no identifier | `/interactions/run/artifact` or `/interactions/run/artifact/` | Fails to parse: the identifier segment is mandatory, on `call-inputs`' own rule | Parse failure |
| Artifact identifier outside the charset | `/interactions/run/artifact/my report/x` | Fails to parse: the segment is an `Identifier` | Parse failure |
| Command input pointer | `/interactions/run/call-inputs/option/format` on a `cli` step | Parses and is legal | N/A |
| Command input pointer on an api step | `/interactions/write/call-inputs/option/format` where `write` names an api operation | Parses; `input-channel-kind-mismatch` at compile time | Structural failure |
| HTTP input pointer on a command step | `/interactions/run/call-inputs/body/title` where `run` names a command operation | Parses; `input-channel-kind-mismatch` | Structural failure |
| Response channel on a command step | An oracle addressing `response-body`, `response-headers`, or `response-status` on a `cli` step | `evidence-channel-kind-mismatch`, naming the channel and the kind | Structural failure |
| Text or artifact channel on an api step | An oracle addressing `stdout`, `stderr`, `exit-code`, or `artifact` on an `api` step | `evidence-channel-kind-mismatch` | Structural failure |
| Both codes fireable on one contract | A contract carrying an evidence mismatch and an input mismatch | The evidence code fires, because it sits earlier in the registry and `compile.ts`'s order is AD-5's | Structural failure, deterministic |
| Kind mismatch and unreachable key | A `cli` step whose oracle addresses `response-body/x` | `evidence-channel-kind-mismatch` fires, not `unreachable-check-evidence`: the new codes sit ahead of it | Structural failure, deterministic |
| Command step binding an HTTP channel | A step whose `inputBinding` declares `body` against a `cli` operation | `input-channel-kind-mismatch`, closing the window Story 9.1 Decision 5 opened | Structural failure |
| `web` or `mcp` step | Any pointer on a step whose operation belongs to a `web` or `mcp` interface | No opinion from either new code; the contract fails at `checkInterfaceKind` as it does today | Structural failure, unchanged |
| Bound-element pointer | `@/id` inside a quantifier over a command step's stdout | No opinion: a `@/` pointer roots at no channel, exactly as `reachability.ts:225-227` already says | N/A |
| Score-time resolution | A command pointer resolved against a version-4 `Observation` | Resolves `absent`, which AD-26 makes an observation rather than an error; Story 9.4 gives it a field to resolve against | Deferred by construction |

</frozen-after-approval>

## Code Map

**The vocabulary and the grammar**

- `src/core/schemas/pointer.ts:12-20` -- `EVIDENCE_CHANNELS`, the closed seven in AD-26's own order, with the note at `:5-11` that order lands in the export and the drift check pins it. `:24-28` is the `EvidenceChannel` enum with `id: 'EvidenceChannel'`, so this enum is a `$defs` entry two published artifacts reference.
- `src/core/schemas/pointer.ts:50-63` -- the three-way partition: `TAIL_BEARING_CHANNELS` (`response-body`, `response-headers`, `stdout`, `stderr`), `SCALAR_CHANNELS` (`response-status`, `exit-code`), and `TRANSPORT_ROOTED_CHANNEL` (`call-inputs`). Each is `satisfies readonly EvidenceChannelName[]`, so a typo fails the typecheck.
- `src/core/schemas/pointer.ts:65-75` -- `TOKEN`, `TAIL`, and `INTERACTION_POINTER_PATTERN`, a three-branch alternation. The fourth branch is the identifier-rooted one, and it uses `IDENTIFIER_CHARSET_SOURCE` (`primitives.ts`) for its identifier segment, the same source the step id uses at `:74`.
- `src/core/schemas/pointer.ts:30-43` -- `TRANSPORT_CHANNELS` and the note that `call-inputs` alone "has no declared structure to resolve against (the defect AD-26 revision 3 records), so a transport channel is mandatory immediately after it." That is the sentence the `artifact` channel inherits.
- `src/core/schemas/pointer.ts:85-90` -- `InteractionPointer`'s `.describe()`, which enumerates the grammar for a non-TypeScript reader and must gain the two new forms.
- `src/core/seal/plan-index.ts:30-32` -- `EVIDENCE_TARGET_PATTERN`, the same three-branch partition respelled with named capture groups, with the note at `:23-29` that a flatter grammar "once silently accepted `/interactions/poll/response-status/oops` (a schema reject) by discarding the bogus trailing segment". The fourth branch is added here in lockstep.
- `src/core/seal/plan-index.ts:57-62` -- `EvidenceTarget`, whose `transportChannel` carries the comment "non-null exactly when channel is 'call-inputs'". `artifactId` is added on exactly that pattern.
- `src/core/seal/plan-index.ts:71-125` -- `parseEvidenceTarget`, three branches plus an unreachable fallthrough at `:121-124`. The fourth branch goes before it.

**The two total switches this story must satisfy**

- `src/core/evaluate/evidence-resolution.ts:78-107` -- `channelRoot`, an exhaustive switch with no default. Adding a channel fails the typecheck until an `artifact` case exists. `:104` reads `observation.callInputs[transportChannel]`, which is `ObservedCallInputs` and is Story 9.4's to widen; until then the `artifact` case resolves to `null`, and `walkTail` (`:38-56`) collapses any tail over `null` to `ABSENT` (`:44`).
- `src/core/score/quotation.ts:59-87` -- `projectChannel`, the second exhaustive switch. `:85-86` serializes the whole `callInputs` object for the `call-inputs` channel, which is the precedent Decision 5 leans on.

**The kind the checks read**

- `src/core/seal/plan-index.ts:134-138` -- `PlanIndex`, gaining `interfaceKindOf` and `declaresOperation` in Story 9.1. This story reads `interfaceKindOf` only, so `operationOf`'s return type is untouched and no existing caller changes.
- `src/core/compile/reachability.ts:221-241` -- `evaluatePointerReachability`, carrying Story 9.1's blanket non-api deferral. This story replaces the `cli` half of that deferral with the real rule and leaves `web` and `mcp` deferring.
- `src/core/compile/reachability.ts:103-113` -- `forEachCheckPointer`, which walks every oracle's `check`. It is the walk the evidence-side check reuses. The other two evidence sites are `Oracle.direction.evidenceTargets` (`src/core/schemas/oracle.ts:14`) and `RubricCriterion.evidence` (`src/core/schemas/rubric.ts:40`), and `src/core/compile/rubrics.ts` already walks the second of those for `rubric-evidence-unreachable`.
- `src/core/compile/bindings.ts:65-84` -- `capturedBindings`, which loops `TRANSPORT_CHANNELS` at `:69` against `step.inputBinding[transportChannel]`. Under Story 9.1's union that loop is one of the input-side sites, and `bindings.ts:208-215`'s own comment becomes false here: it says `stdout`, `stderr`, and `exit-code` are "process channels no operation surviving `unsupported-interface-kind` produces".

**AD-5's registry**

- `src/core/failure-codes.ts:11-35` -- `FAILURE_CODES`, twenty-three codes in the table's order, with the header at `:1-10` naming `scripts/check-ad5-registry.ts` as the checker and `tests/schemas/failure-codes.test.ts` as the place the tuple's own invariants (count, uniqueness, kebab-case) are locked.
- `src/core/compile/compile.ts:77-118` -- the fixed call order, whose header at `:6-8` says "Call order is AD-5's registry order, the only published stable priority: a contract violating several checks reports whichever runs first." `checkObservableSuccessCriterion` is at `:82` and `checkEvidenceReachability` at `:83`; the two new calls go between them.
- `src/core/score/qualification.ts:62` and `:311-320` -- `condition-text-channel-on-api`, the probe-side half of this rule that already ships, firing when an `api` signature's predicate addresses `stdout`, `stderr`, or `exit-code`. It is a `QUALIFICATION_FAILURES` member rather than an AD-5 code because, as `qualification.ts:6-9` says, "AD-5 is compile-time over contracts and `compile` never sees a probe." Its mirror is Story 9.4's.

**Comments that become false in this story and must be corrected at their source**

- `src/core/compile/bindings.ts:211-212` -- "`stdout`, `stderr`, and `exit-code` are process channels no operation surviving `unsupported-interface-kind` produces".
- `src/core/compile/rubrics.ts:233-234` -- "a criterion rooted at `stdout` compiles on an `api`-kind contract that can never produce one". This one states the defect this story closes and its correction is the record that it closed.
- `src/core/coverage/satisfaction.ts:339` -- "The site condition rule 3 relevance reads: a key on any of the four channels."

**Tests**

- `tests/schemas/pointer.test.ts:132,141,158` -- the pinned seven-member list, the size assertion, and the partition's disjoint-and-exhaustive case. All three move.
- `tests/seal/derived-reference.test.ts:556` -- a loop over `EVIDENCE_CHANNELS`, which gains an eighth iteration.
- `tests/schemas/failure-codes.test.ts` -- the tuple's count, uniqueness, and casing invariants; the count moves from 23 to 25.
- `scripts/check-ad5-registry.ts:81-185` -- parses AD-5's table out of the spine and compares it to `FAILURE_CODES` as a set and as an order.

## Tasks & Acceptance

**Execution:**

- [ ] `src/core/schemas/pointer.ts` -- append `artifact` to `EVIDENCE_CHANNELS`; add `IDENTIFIER_ROOTED_CHANNEL = 'artifact' as const satisfies EvidenceChannelName` beside `TRANSPORT_ROOTED_CHANNEL`; add the fourth alternation branch to `INTERACTION_POINTER_PATTERN`; extend `InteractionPointer`'s `.describe()` with both new forms -- the partition is spelled out and typed against the enum, never rebuilt from it, per `:45-49`.
- [ ] `src/core/schemas/pointer.ts` -- extend the `call-inputs` branch so its segment alternation is `TRANSPORT_CHANNELS` plus `COMMAND_CHANNELS` -- one branch rather than two, because a pointer's own text cannot say which kind of step it addresses and the grammar is a syntax, not a legality rule. Which of the eight is legal is the compile check below.
- [ ] `src/core/seal/plan-index.ts` -- add the fourth named-capture branch to `EVIDENCE_TARGET_PATTERN`, add `artifactId: string | null` to `EvidenceTarget` with the "non-null exactly when channel is 'artifact'" comment, widen `transportChannel`'s type to the eight-member union, and add `parseEvidenceTarget`'s fourth branch ahead of the unreachable fallthrough.
- [ ] `src/core/evaluate/evidence-resolution.ts` -- add the `artifact` case to `channelRoot`, returning `null` until Story 9.4 gives `Observation` a field, with a comment naming that story's field as the replacement -- the typecheck is what forces this case to exist and the `null` is what makes an unresolved artifact `absent` rather than a throw, which AD-26 requires.
- [ ] `src/core/score/quotation.ts` -- add the `artifact` case to `projectChannel`, on Decision 5's terms.
- [ ] `src/core/failure-codes.ts` -- insert `evidence-channel-kind-mismatch` and `input-channel-kind-mismatch` after `no-observable-success-criterion` and before `unreachable-check-evidence`; registry moves 23 to 25.
- [ ] `ARCHITECTURE-SPINE.md` AD-5 registry table -- append the two rows in the same positions, with their firing conditions and `Cited by` back-references, so `check:ad5-registry`'s set-and-order equality holds and `lint:spine` stays green.
- [ ] `src/core/compile/interface-kind-channels.ts` (new) -- the two checks. `checkEvidenceChannelKind` walks every oracle `check` pointer, every direction evidence target, and every rubric criterion's evidence, resolves the step's declaring kind through `interfaceKindOf`, and throws when the pointer's channel is not in that kind's legal set. `checkInputChannelKind` walks every interaction step's `inputBinding`, every sensitivity-witness leg's `inputs`, and the fixture reset's, and throws when a declared channel is not in that kind's legal set. Both skip a step whose kind is `web` or `mcp`, and both skip a `@/` pointer.
- [ ] `src/core/compile/compile.ts` -- call both between `checkObservableSuccessCriterion` (`:82`) and `checkEvidenceReachability` (`:83`), and extend the header's ordering paragraph with why they sit there.
- [ ] `src/core/compile/reachability.ts` -- narrow Story 9.1's blanket non-api deferral so it covers `web` and `mcp` only, and leave `cli` deferring on the descriptor-shaped branches until Story 9.3 -- record in the comment which story removes the remainder.
- [ ] `src/core/compile/bindings.ts`, `src/core/compile/rubrics.ts`, `src/core/coverage/satisfaction.ts` -- correct the three comments named in the Code Map at their source.
- [x] `src/core/schemas/eval-contract.ts` -- record this change under the epic's single 3 → 4 bump, not a second one. The driving field is `InteractionPointer`'s accepted language, which no single contract field owns, so the note goes on `oracles` (the field whose operands carry the grammar) and is restated in the artifact `.meta`, matching how the sealed brief's bump is recorded both in a field and in a code comment.
- [ ] `tests/schemas/eval-contract-version.test.ts` -- raise `EVAL_CONTRACT_SCHEMA_VERSION` to 5 and move every literal its failures name.
- [ ] `npm run generate:schemas` -- regenerate; update the five census literals `deferred-work.md`'s first open entry names.
- [ ] `tests/schemas/pointer.test.ts`, `tests/schemas/failure-codes.test.ts`, `tests/seal/derived-reference.test.ts` -- move the pinned counts and lists.
- [ ] `tests/compile/interface-kind-channels.test.ts` (new) -- one case per I/O Matrix row, plus a case per legal channel on each kind so the legal sets are pinned positively as well as negatively.
- [ ] `tests/schemas/fixtures/reject-cases.ts` -- one single-mutation reject fixture per new published constraint, per AD-13.
- [ ] `_bmad-output/project-knowledge/learning-path-step-by-step.md` -- add this story's step per `learning-path-template.md`.

**Acceptance Criteria:**

- Given `EVIDENCE_CHANNELS`, when the change lands, then it carries eight members in AD-26's order with `artifact` appended, the four partition classes are disjoint and their union is the eight, and `tests/schemas/pointer.test.ts`'s exhaustiveness case proves both.
- Given `/interactions/run/artifact/report/summary`, when `parseEvidenceTarget` runs, then it returns channel `artifact`, `artifactId: "report"`, and tail `["summary"]`; given `/interactions/run/artifact`, then it fails to parse, so the identifier segment is mandatory the way the transport segment already is.
- Given an oracle addressing `response-body` on a step whose operation belongs to a `cli` interface, when `compile` runs, then it throws `evidence-channel-kind-mismatch` with the artifact path naming the oracle and the operand position, and the detail naming both the channel and the kind.
- Given the same contract where the addressed key is also undeclared, when `compile` runs, then `evidence-channel-kind-mismatch` is what it reports, never `unreachable-check-evidence`, because the new code sits earlier in AD-5's order and `compile.ts` calls in that order.
- Given a step binding `body` against a `cli` operation, when `compile` runs, then it throws `input-channel-kind-mismatch`, which closes the window Story 9.1's Decision 5 deliberately opened.
- Given a `web` or `mcp` contract, when `compile` runs, then neither new code fires and `unsupported-interface-kind` is still what it reports, so this story adds no second answer for a kind that already has one.
- Given `npm run check:ad5-registry` and `npm run lint:spine`, when they run, then both are green against a twenty-five-code registry, proving the tuple and the spine table agree as a set and as an order.
- Given every existing api contract, corpus member, and fixture, when `compile` runs over each, then none of them fires either new code, so the rule is provably additive over the shipped corpus.
- Given `npm run validate`, when it runs, then it exits 0 with nothing on stderr.

## Decisions settled by construction

**Decision 1: two codes, not one, and neither rides `unreachable-check-evidence` or `undeclared-mandatory-input`.**
The reuse case is real and was considered on its merits. AD-5's row for `unreachable-check-evidence` reads "an oracle's `check` addresses evidence unreachable through the declared interfaces", and a `response-body` pointer on a command step is literally that; the row already carries four conditions joined by "or", and `undeclared-mandatory-input`'s row was widened to carry two (`interface-inventory.ts:68-72`: "The two conditions share one code and are not the same predicate... AD-5's row is widened to say so"). So precedent for widening exists. Three things decide against it. First, `checkUndeclaredMandatoryInput` runs only under `options.strict` (`compile.ts:92-93`), and a binding channel the operation's kind does not have must fail in every mode, because there is no shape to bind against at all; riding that code would leave a non-strict command contract compiling with a binding nothing can ever resolve. Second, the priority is wrong in the other direction: `unreachable-check-evidence` sits at registry index 2 and its check reads a response descriptor, so on a command step it would have to answer a question about a field the operation does not carry, and a code cannot outrank the check that establishes its own precondition. Third, the fix differs and the fix is the product: `TEST-PLAN-NEXT-STEPS.md:315-321` says "The authoring discipline is the product", and an author told "the operation declares this in neither requiredKeys nor permittedKeys" will go and declare the key, which is the wrong repair for a channel that does not exist on that kind. Two codes rather than one because the two conditions read different operands, fire at different call sites, and send an author to different fields: one is about what an oracle reads and one is about what a step sends. Downstream consequence: Story 9.3 adds no further AD-5 code, and Story 9.5's disclosure states the registry moved from 23 to 25 and that `unsupported-interface-kind` narrowed.

**Decision 2: the two codes sit ahead of `unreachable-check-evidence` in the registry.**
AD-5's order is the published priority and `compile.ts:6-8` says so. The question is whether a kind mismatch outranks an unreachable key. It does, for a mechanical reason rather than a taste one: every rule inside `evaluateReachabilityAgainstOperation` (`reachability.ts:250-351`) is a statement about a shape the operation declares, and on a step whose channel the kind does not have, there is no such shape to consult. Reporting "the operation declares this key in neither list" about a channel the operation has no concept of is a false statement, and a check that must not run cannot outrank the check that establishes it must not. Placing them at indices 2 and 3 rather than after `unsupported-interface-kind` at 11 also keeps the two evidence-side codes adjacent, which is what makes the priority readable. Downstream consequence: Story 9.3's per-kind branching inside reachability can assume every surviving pointer names a channel its kind produces, which is what lets those branches be total rather than defensive.

**Decision 3: `artifact` is identifier-rooted, and the grammar gains a fourth partition class rather than a fifth spelling.**
AD-26 fixed this exact shape once already for `call-inputs`: "Under `call-inputs` the next segment is one of the four transport channels AD-19 declares... revision 3 rooted `call-inputs` directly on a key name, which had no declared structure to resolve against." A command may write several files and each has its own declared structure, so a channel rooting directly on a key name has the same defect one artifact over. The segment is an `Identifier` rather than a free token because it resolves against the operation's declared artifact list (Story 9.1's `outputDescriptor.artifacts`), and `IDENTIFIER_CHARSET_SOURCE` is what the step-id segment already uses at `pointer.ts:74`, so the pattern gains no new charset. It stays inside the one grammar because AD-26 says "No dot-path, no wildcard, no expression language" and `defect-signature.ts:9-29` records the project's own precedent for spending a fixed word rather than minting a grammar. Downstream consequence: `EvidenceTarget.artifactId` is the field Story 9.4's `Observation.artifacts` is keyed by, and Story 9.3's reachability branch resolves it against the declared artifact list.

**Decision 4: the command transport channels share `call-inputs`' one grammar branch, and legality is a check rather than a syntax.**
A pointer's own text cannot say which kind of interface its step's operation belongs to; only the contract can. Splitting the grammar into an HTTP `call-inputs` branch and a command one would make `/interactions/run/call-inputs/option/format` a syntax error in a contract where it is perfectly meaningful, decided by a pattern that cannot see the declaration that makes it meaningful. `InteractionPointer`'s own `.describe()` already draws this line: "Syntax only: whether the step exists and whether the evidence is reachable are compile-time checks, not schema checks." So the alternation carries all eight segments and `input-channel-kind-mismatch` decides which four are legal on a given step. Downstream consequence: the published `eval-contract.schema.json` accepts a pointer naming any of the eight, and a validator driven by the published schema alone accepts a pointer this package rejects at compile time, which is the same shape of gap `CHANGELOG.md:68-72` already discloses for observation sequence uniqueness and is disclosed the same way in Story 9.5.

**Decision 5: `projectChannel`'s `artifact` case projects every written artifact, and `QuotedEvidence` gains no artifact identifier.**
`QuotedEvidence` (`sealed-run-record.ts:27-35`) carries a quote and a channel, and every other channel projects the whole channel: `call-inputs` serializes the entire four-key object (`quotation.ts:85-86`) rather than one transport channel's value. An `artifact` quotation names the channel on the same terms, and the audit asks whether the quoted text appears in any artifact the observation records. Adding a nullable `artifactId` to `QuotedEvidence` was the other option and is turned down here: it is a second breaking field on the run record, it makes the audit's key `(findingId, quoteIndex, artifactId)` where AD-40's own rule is "at least one observation satisfying the condition", and it buys precision the audit does not use, since a quotation that appears in the wrong file still appears in the run and the identifier-governed witness match is what decides detection (ADR-009 Decision 2: "cited identifiers govern the witness match; quotation audits it"). Downstream consequence, stated rather than left to be discovered: an unwitnessed-quotation condition on the `artifact` channel names the finding and the channel and cannot name which file was expected to carry the text, exactly as it cannot today for `call-inputs`. Story 9.4 carries this into `Observation.artifacts`' own shape.

**Decision 6: a command pointer resolves `absent` at score time until Story 9.4, and that window is named rather than closed here.**
`channelRoot`'s `artifact` case returns `null` and `walkTail` collapses any tail over `null` to `ABSENT` (`evidence-resolution.ts:44`), so between this story and Story 9.4 a compiled command oracle resolves `absent` for every artifact operand. AD-26 makes that an observation rather than an error: "A pointer that does not resolve yields the distinct value `absent`... `existence` resolves false against it, `absence` resolves true, and every comparison resolves false." Closing the window here means widening `Observation`, which is the sealed run record's bump and belongs with the other run-record work rather than split across two stories that would then both bump one artifact. The window is bounded by `checkInterfaceKind` in any case: no command contract compiles until Story 9.3, so no command oracle can reach a scorer before Story 9.4 lands. That containment is the reason this is a recorded window rather than a defect. Downstream consequence: Story 9.4's acceptance carries a case that the same pointer resolves a real value once `Observation` carries the field, and Story 9.5's worked chain is the first end-to-end evidence of it.

**Decision 7: the code names are subject-first and pair, and `interface-kind` is the shared stem.**
`unsupported-interface-kind` already owns that stem, and the two new codes are its neighbours in condition and in registry position, so `evidence-channel-kind-mismatch` and `input-channel-kind-mismatch` read as one family without colliding with it. Both are kebab-case noun phrases, matching every one of the twenty-three shipped codes, and `tests/schemas/failure-codes.test.ts` enforces the casing. The alternative shapes considered were a single `channel-kind-mismatch` (rejected under Decision 1) and names built on the kind rather than the operand, such as `cli-channel-illegal` (rejected because a code naming one kind stops being true the moment a second kind is admitted, which is the mistake `unsupported-interface-kind`'s own row avoided by naming the condition rather than the three kinds).

## Design Notes

The organising idea is that AD-26 already solved the shape twice and this story applies the same solution a third time. A channel that names one of several things takes a declared segment before its tail; that is what `call-inputs` does with a transport channel and what `artifact` does with an artifact identifier. And a rule that needs a declaration the pointer cannot carry is a compile-time check rather than a syntax; that is what `InteractionPointer`'s own description already says of step existence and evidence reachability, and it is what makes per-kind channel legality a code rather than a pattern.

The two legal sets, for orientation only:

```ts
// Every channel an interface kind can produce or accept. Total over the kinds
// that compile; `web` and `mcp` have no entry because no operation shape is
// declared for them and nothing may be checked against a shape that does not
// exist.
const EVIDENCE_CHANNELS_BY_KIND = {
	api: ['response-body', 'response-headers', 'response-status', 'call-inputs'],
	cli: ['stdout', 'stderr', 'exit-code', 'artifact', 'call-inputs'],
} as const

const INPUT_CHANNELS_BY_KIND = {
	api: TRANSPORT_CHANNELS, // path, query, header, body
	cli: COMMAND_CHANNELS, // argument, option, environment, stdin
} as const
```

`call-inputs` appears on both evidence lists because it is the one channel both kinds produce; which of its eight segments is legal is the second table's question, which is exactly why the two codes are separate.

## Verification

**Commands:**

- `npm run typecheck` -- expected: exit 0. The two exhaustive switches over `EvidenceChannelName` fail first if the `artifact` case is missing, which is the intended forcing function.
- `npx vitest run tests/schemas/pointer.test.ts` -- expected: green with eight channels and four partition classes.
- `npx vitest run tests/compile` -- expected: green, one case per I/O Matrix row.
- `npm run check:ad5-registry` -- expected: exit 0 against a twenty-five-code registry.
- `npm run lint:spine` -- expected: exit 0, proving the appended AD-5 rows parse and rank.
- `npm run generate:schemas && npm run check:schemas` -- expected: exit 0 after regeneration.
- `npm run check:boundary` -- expected: exit 0.
- `npm run validate` -- expected: exit 0 with no output on stderr.

## Built, and where it diverged

**The second `schemaVersion` bump this story specified did not happen, and should not have.** The
story reads 4 → 5 because the plan gave the epic two breaking bumps on the rule that each story be
independently releasable. The epic shipped as one release, so a version 4 carrying the interface
union but not the pointer grammar never existed for any consumer to hold, and disclosing a
transition nobody can be on is churn rather than disclosure. One bump, 3 → 4, covers every retype in
the epic, and the artifact's own `.meta` names what version 4 added.

The change this story makes to the contract is also weaker than the story assumed. Widening
`InteractionPointer`'s accepted language retypes nothing: every pointer legal under version 3 is
still legal, so the field accepts a strict superset. It travels under the same breaking bump as the
union retypes because it ships in the same release, not because it is breaking on its own.

The artifact channel shipped as the fourth partition class this story named, spelled
`/interactions/{stepId}/artifact/{artifactId}` plus a tail, with `IDENTIFIER_ROOTED_CHANNEL` beside
`TRANSPORT_ROOTED_CHANNEL` in `pointer.ts`. The difference from `call-inputs` is that the segment is
an open identifier rather than a closed enum, and the reason is AD-26's own: a channel that names one
of several things needs a declared segment to resolve against, and the artifact names are the
contract author's.

**One code was minted rather than three.** `unresolved-artifact-reference` covers both sites that
name an artifact identifier, an evidence pointer's segment and an operation's own
`descriptorChannel`, because both are the same authoring fault and neither reader benefits from
telling them apart by code rather than by artifact path. The two per-kind channel-legality codes this
story planned were not minted: reachability already reports a pointer at a channel the operation's
kind does not produce, under `unreachable-check-evidence`, and a second code for the same condition
would have made which one fired depend on registry order rather than on the defect.

**The command channels under `call-inputs` shipped in the previous step**, because the grammar is
parsed with no contract in hand and the alternation had to admit them before any command contract
could address its own inputs.

**The descent rule was not written here.** Making a declared output channel descendable through its
operation's response descriptor landed one step earlier, and the artifact channel is a third case of
that rule rather than a fourth rule of its own: `descriptorChannelOf` answers which channel an
operation's one descriptor describes, and `response-body`, `stdout`, and an artifact are three roots
reaching the same descent. Two extra conditions are the artifact channel's own: an identifier the
operation declares but the descriptor does not nominate is known to exist and declares no structure,
so a tail on it is unreachable and a bare pointer at it is fine.
