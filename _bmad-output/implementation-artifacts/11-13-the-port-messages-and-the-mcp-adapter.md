---
title: 'The port messages and the MCP adapter'
type: 'feature'
created: '2026-09-09'
status: 'done'
review_loop_iteration: 0
context:
  - _bmad-output/implementation-artifacts/epic-11-context.md
  - _bmad-output/implementation-artifacts/11-4-the-operation-shape-for-a-tool-call.md
  - _bmad-output/implementation-artifacts/11-5-compile-and-preflight-admit-an-mcp-interface.md
  - _bmad-output/implementation-artifacts/11-6-the-tool-call-defect-signature-and-the-ninth-input-channel.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

This story and Story 11.6 are the two halves of one earlier draft, split on the line Story 11.6's
Decision 1 records. This half lands second, immediately after it. The epic's execution order is 11.1
through 11.6, then 11.13, then 11.7, 11.8, 11.10, 11.11, 11.12, and 11.9 last.

**Problem:** Stories 11.4, 11.5 and 11.6 opened the kind and left the answer half closed.
`ProbeRequest` (`src/core/schemas/port-messages.ts:135-138`) carries three members and
`ProbeObservation` (`:186-189`) carries two, so `planPreflight` builds an `McpProbeRequest` that no
shipped adapter can answer and `kindMismatch` (`preflight/reduce.ts:75-81`) reports every answer as
`port-contract-violation`. Story 11.5 named that window and left it open on purpose, and Story 11.6
closed only its qualification half: an `mcp` probe now qualifies, and nothing can produce an
observation for it to score. And `probe-policy.ts` declares an HTTP authorization at `:12` and a
command authorization at `:60`, so AD-35's "an adapter denies by default and permits only what that
mapping names" has nothing to name for a tool server.

**Approach:** Add `McpProbeObservation` and the third union member, and settle the observation-side
branches the third member forces. Then add an `McpTargetAuthorization`/`McpTargetPolicy` pair beside
the two shipped ones, a pure `evaluateMcpTarget` under `src/adapters/`, and `createMcpAdapter`, an
`EnvironmentProbePort` over MCP's stdio transport, authorized before a server starts. When this story
ends an `mcp` contract runs a pre-flight end to end against a real tool server, which closes the port
half of the window Story 11.5 opened and finishes what Story 11.6 began.

## Boundaries & Constraints

**Always:**

- The reference adapter speaks MCP's stdio transport and no other. AD-2's rule is flat: "No module in
  the package performs network I/O, and v0 ships no network adapter at all." Decision 1 records what
  that excludes and why the exclusion is stated in the source.
- AD-35 holds unchanged: the request names a logical interface identifier and a logical tool
  identifier, and never a URL, host, port, or command line. The server address is configuration
  outside the contract, held by the target policy.
- A policy denial happens before a server process starts.
- `evaluateMcpTarget` and everything that calls it lives under `src/adapters/`.
  `scripts/dependency-direction.ts:86-87` grants `adapters/` an edge to `ports/` and to `core/schemas`
  and to nothing else, and `npm run check:layers` (`package.json:94`) enforces it.
- A tool result carrying `isError: true`, and a JSON-RPC error answering `tools/call`, are both
  observations. Only a policy denial, a cap, an abort, or a failure to establish the session throws.
- Story 11.6 is read as landed: `ObservedCallInputs` and `ProbeInputBinding` carry nine keys,
  `callInputsOf` has its third arm, both artifacts read `schemaVersion: 5`, and an `mcp` defect
  signature qualifies. This story writes the observation side against those shapes.
- Every JSDoc and comment this story writes is pruned and de-AI'd while it is written. No comment runs
  longer than the declaration it documents, and the negation-then-correction construction is absent in
  every form.
- Documentation moves in this diff. Every page this story makes false is corrected here, and text the
  change makes redundant is cut in the same pass.
- The caller-facing disclosure moves in this diff too. NFR8 (`epics.md:54`) requires every
  caller-facing break called out, and this story widens a published port union and adds two subpath
  exports, so a `CHANGELOG.md` `[Unreleased]` entry ships with them. Nothing below `[Unreleased]` is
  edited: `release:prepare` (`package.json:111`) owns every dated section.
- No source comment may contain any of `check:boundary`'s forbidden strings, so no epic, story,
  acceptance-criterion, task, or decision number appears under `src/` or `corpus/`.

**Ask First:**

- Any change to `ApiProbeRequest`, `CommandProbeRequest`, `McpProbeRequest`, `ApiProbeObservation`,
  `CommandProbeObservation`, `ProbeTargetAuthorization`, `CommandTargetAuthorization`,
  `evaluateTarget`, or `evaluateCommandTarget`. This story is additive on all eight.
- Any AD-5 code, any `QUALIFICATION_FAILURES` member, or any spine registry edit. This story mints
  none.
- Any `schemaVersion` move on any artifact. Story 11.4 owns the eval contract's bump and Story 11.6
  owns the probe's second and the sealed run record's; this story takes none, because a port message
  carries no `lineageFields` and has no entry under `schemas/`.

**Never:**

- No `McpProbeRequest` and no `ProbeRequest` union member. Story 11.5 landed both, and its Decision 3
  gives the reason, checked against the tree here: opening `plan.ts:305` puts an `McpOperation` into
  `requestOf` on every leg path, and a contract with no leg throws `unreachable-check-evidence`
  first, so no `mcp` contract reaches a plan without reaching `requestOf`. Re-firing
  `unsupported-interface-kind` from inside `requestOf` would destroy the one-kind fireability margin
  11.5 exists to establish, and minting a code for the gap would put a thrower in the registry this
  story deletes.
- No `defect-signature.ts` edit, no `qualification.ts` gate edit, and no `UNION_BRANCH_FIXTURES`
  entry. Story 11.6 owns all three, and no module this story touches names `DefectSignature` at all.
- No `plan-index.ts` third map, no `resolveHomeOperation` kind test, no `requestOf` construction, and
  no rewrite of the two `qualification.ts` detail strings at `:349` and `:458`. Story 11.5's Approach
  claims all four, including removing the `operation as Operation` cast at `plan-index.ts:238`. This
  story reads them as landed and branches only what the observation union forces.
- No third conformance arm, no `McpProbeSubject` type, no `mcp-probe` entry in
  `CONFORMANCE_OUTCOME_COUNTS` (`src/testing/conformance.ts:40-46`), no `mcp` member on
  `ConformancePort` (`:32-37`), and no `tests/adapters/mcp-probe-subject.ts`. Story 11.7 owns all five
  and pins the count at 14, and its Decision 1 derives that number from this story's authorization
  shape. Decision 3 states what this story ships so the derivation holds.
- No network transport in `src/`. A Streamable HTTP or HTTP+SSE MCP client is the caller's, on AD-2's
  own terms for the `api` mechanism.
- No spine revision and no new ADR. Every ambiguity is settled below.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Authorized tool call | An `McpProbeRequest` whose `(interfaceId, toolName)` the policy names | The server starts, `initialize` completes, `tools/call` runs, and an `McpProbeObservation` echoes the four correlation fields | N/A |
| Tool reports an error | The same, answered `isError: true` | Resolves with `isError: true` and the structured result in `result` | N/A |
| JSON-RPC error to `tools/call` | The server answers `{"error":{"code":-32602,...}}` | Resolves with `isError: true` and the error object as `result`, per Decision 5 | N/A |
| Unmapped interface | An `interfaceId` no authorization names | `forbidden-target`, before a server process starts | Rejected by the policy |
| Unmapped tool | A mapped `interfaceId` with a `toolName` the authorization's `tools` map does not name | `forbidden-target`, before a server process starts | Rejected by the policy |
| `api` or `cli` request to this adapter | Either other union member | `forbidden-target`, matching `command-line-adapter.ts:356-363`'s reading of the same case | Rejected before dispatch |
| Session never establishes | The server exits at launch, or `initialize` never answers | `budget-exhausted` when `maxElapsedMs` expires, `port-failure` when the process fails to start | Thrown |
| Result past `maxOutputBytes` | A tool result frame larger than the cap | `budget-exhausted`, and the session is torn down | Thrown |
| Server logs past `maxOutputBytes` | The server writes past the cap on its own stderr | `budget-exhausted`, per Decision 4: an undrained stderr pipe deadlocks the server | Thrown |
| Abort mid-call | The caller's signal aborts during `tools/call` | Rejects `aborted` inside the shared abort budget, and the session is torn down | Thrown |
| Malformed frame | Bytes on stdout that are not a JSON-RPC message | `port-failure`: nothing answered the question | Thrown |
| Wrong-kind answer | A port answering an `mcp` leg with an `api` observation | `port-contract-violation` from `reduce.ts:79`, which already compares `leg.request.kind` to `observation.kind` | Thrown by reduce |
| Pre-flight projection | An `mcp` observation reaching `projectObservation` | `status` and `exitCode` `null`, `toolError` the flag, `body` the pruned structured result | N/A |
| Sealed evidence for an mcp leg | The same observation reaching `evidenceOf` | `responseBody` the projected result, `responseStatus` `0` when `isError` is false and `1` when it is true, `responseHeaders` `null`, the command channels unobserved | N/A |
| Oracle on the error flag | A condition whose pointer is `/response-status` on an `mcp` operation | Reachable at compile and resolves to `0` or `1`, per Decision 6 | N/A |
| Clean-control anomaly | An `mcp` control leg answered `isError: true` | `anomalyOf` reports a tool error, so the clean-control check fails as a 4xx and a non-zero exit already do | N/A |
| Tool-call inputs on an observed leg | An `mcp` leg whose `callInputs.arguments` carries the tool's arguments | Parses against Story 11.6's nine-key record; `/interactions/{stepId}/call-inputs/arguments/{key}` resolves through `channelRoot` | N/A |
| Api call inputs on an mcp observation | A record whose `callInputs.arguments` is null and whose `body` is set for an mcp operation | Parses. AD-32 makes the mismatch a cross-artifact inconsistency ingest records | Recorded by ingest |

</frozen-after-approval>

## Code Map

**The port messages**

- `src/core/schemas/port-messages.ts:71-79` -- `probeCorrelation`, the four echoed fields every branch
  spreads. The observation branch spreads the same object.
- `src/core/schemas/port-messages.ts:62-70` -- the AD-35 and AD-18 block comment above it, already
  kind-neutral: "authorization material is the adapter's, supplied by the same mapping that authorizes
  the target." Decision 3 spends that sentence.
- `src/core/schemas/port-messages.ts:177-184` -- `CommandProbeObservation`, whose `exitCode` describe
  records the rule Decision 5 mirrors for a tool error.
- `src/core/schemas/port-messages.ts:186-189` -- `ProbeObservation`. One member is added.
- `src/core/schemas/port-messages.ts` -- `McpProbeRequest`, landed by Story 11.5, read here for the
  tool identity and the `arguments` channel this story's observation has to correlate with.
- `src/core/schemas/probe-body.ts:22-26` -- `ProbeObservedBody`, the three-arm tagged body the `result`
  reuses.

**The branches the observation union forces**

- `src/core/preflight/projection.ts:35-44` -- `ProjectedObservation`, whose comment at `:23-34` opens
  "The five fields and no others". `:110-133` is `projectObservation`, reading
  `observation.kind === 'api'` at `:120`, `:129`, and `:130`. Decision 6 settles the tool-error field.
- `src/core/preflight/witness-evidence.ts:101-150` -- `evidenceOf`, seven `observation.kind === 'api'`
  tests at `:133-146`, writing the sealed `Observation`'s channels. `:135` is `responseStatus`, which
  Decision 6 fills for an `mcp` observation. `callInputsOf` in the same file is Story 11.6's and is
  read here as landed.
- `src/core/preflight/reduce.ts:42-55` -- `anomalyOf`, `observation.kind === 'api'` at `:49` with a
  binary fallthrough to `exitCode` at `:54`. Needs a third arm over `isError`.
- `src/core/preflight/reduce.ts:64-81` -- `kindMismatch`, already total: it compares
  `leg.request.kind === observation.kind`, so a third kind takes the ordered mismatch pairs from two to
  six with no source change. Test-side only.
- `src/testing/probe-conformance.ts:130-136` -- the `api` arm's anomalous-status check, whose detail
  says "a command observation" for every non-`api` kind.
- `src/testing/probe-conformance.ts:459-465` -- the `cli` arm's non-zero-exit check, whose detail says
  "an api observation" for every non-`cli` kind.
- `src/testing/probe-conformance.ts:267-282` -- `echoMismatch`, comparing the four echoed fields
  including `kind`. Total already.
- `src/adapters/command-line-adapter.ts:355-363` -- `parsed.kind !== 'cli'`, total already. Its detail
  names `api` explicitly and needs the third kind named.

**Landed before this story, read here as context**

- `src/core/schemas/sealed-run-record.ts:200-209` and `src/core/schemas/defect-signature.ts:86-95` --
  `ObservedCallInputs` and `ProbeInputBinding`, both at nine keys after Story 11.6. Neither is edited
  here; the `mcp` observation arm fills the ninth key those shapes already declare.
- `src/core/seal/plan-index.ts` -- the third operation map, `mcpOperationOf`, and the removal of the
  `operation as Operation` cast at `:238`. Story 11.5's Approach claims all three, and its Decision on
  the cast is the reason roughly half the downstream sites now fail a typecheck, where before its
  removal each compiled clean and answered wrongly.
- `src/core/score/qualification.ts:115-134` -- `resolveHomeOperation`'s three-way kind test.
- `src/core/score/qualification.ts:349`, `:458` -- the two details that told a tool-use author their
  signature sits on "an api interface".
- `src/core/score/qualification.ts:148-151` -- `foreignChannels`. Confirmed unchanged by Story 11.5 and
  re-read here: `kind === 'cli' ? API_RESPONSE_CHANNELS : COMMAND_RESPONSE_CHANNELS` is a total binary,
  so an `mcp` signature is confined to `response-body`, `response-headers`, and `response-status`. Two
  of those three carry a value once this story's adapter runs, per Decision 6.
- `src/core/compile/reachability.ts:437-446` -- Story 11.5's refusal of `response-headers` on an `mcp`
  operation. `response-body` and `response-status` stay reachable, which is what makes Decision 6's
  `isError` projection addressable and leaves the adapter no reason to invent a header map.
- `src/core/preflight/plan.ts:99-152` and `:305-311` -- `requestOf`'s `mcp` construction and the
  hand-assembled-plan gate.

**The policy and the adapter**

- `src/core/schemas/probe-policy.ts:60-102` -- `CommandTargetAuthorization`, including the `artifacts`
  identifier-to-path map Decision 3 mirrors and the two caps Decision 4 reads.
- `src/adapters/command-target-policy.ts:1-12` -- the header stating why an evaluator an adapter calls
  is adapter-owned. `:19-23` is `COMMAND_DENIAL_REASONS`, `:60-98` the evaluator and its
  first-match-in-declaration-order rule.
- `src/adapters/command-line-adapter.ts:1-36` -- the four numbered rules that are the whole "what is a
  command allowed to do" answer. The MCP header carries its own four.
- `src/adapters/command-line-adapter.ts:150-158` -- `bodyFromText`, the JSON-shaped-text heuristic.
- `src/adapters/command-line-adapter.ts:342-435` -- `createCommandLineAdapter` and its use of
  `runPortMethod`, `probeParsers`, and the `forbidden`/`capped` fault helpers at `:160-166`.
- `src/adapters/index.ts:7-21` -- the `./adapters` barrel. `tests/architecture/package-exports.test.ts`
  pins no adapter export list, so `package.json` is untouched.
- `src/testing/index.ts:32-35` -- where `CommandTargetPolicy` is re-exported for a subject author.
- `scripts/dependency-direction.ts:86-87` -- `case 'adapters': return to === 'ports' || to === 'core-schemas'`.
  This one line places the evaluator.
- `src/testing/conformance.ts:63-75` -- `PortSubject`, the four fields the shared six need.
  `:94-101` is `SHARED_ASSERTION_IDS`; `:434-451` is `runSharedAssertions`; `:454-467` is `reportOf`,
  whose length term is why no `mcp` report exists before Story 11.7.

**Test sites that move with the observation union**

- `tests/preflight/reduce.test.ts:562-593` -- fixture 129, pinning
  `/asked for a "api" probe and was answered with a "cli" observation/` at `:591`. Story 11.5's
  Decision 3 states it left this untouched.
- `tests/testing/conformance.test.ts:483-502` -- `probeRequest()`, hard-returning `kind: 'api'` at `:492`.
- `tests/testing/conformance.test.ts:504-514` -- `observation()`, hard-returning `kind: 'api' as const`.
- `tests/testing/conformance.test.ts:516-540` -- `breakEcho`, whose `kind` branch hand-builds a whole
  `cli` observation because a command observation carries stdout, stderr, and an exit code in place of
  a status and headers.
- `tests/testing/conformance.test.ts:804` -- `expect(outcome?.detail).toMatch(/observed kind "cli"/)`.
- `tests/testing/conformance.test.ts:681` and `:692` -- the per-arm outcome counts, `19` for
  `environment-probe`. `:423-431` is fixture 58, unchanged here.
- `tests/preflight/fixtures/probe-port.ts:29-42` -- `echoPort()`, hard-returning `kind: 'api'` at `:35`.
- `tests/preflight/fixtures/observations.ts:553-570` -- `observationsFor`, the shared builder every
  `tests/preflight/` file reads, hard-returning `kind: 'api'` at `:566`. The `mcp` builder lands
  beside it, which is where a port-message fixture belongs: `port-messages.ts` produces none of the
  twelve published documents, so `tests/schemas/fixtures/` has nothing to seed for this union.
- `tests/adapters/command-probe-subject.ts:1-9` and `:139-141` -- the in-repository `cli` subject, read
  as the model. Its MCP counterpart is Story 11.7's.

**Documentation this story owns**

Story 11.9's ownership tables at `:71-100` and `:104-118` assign the first five sites below to the
story that ships the adapter and the port union, which is this one, one owner each, and they carry
`docs/how-to/evaluate-agent-behavior.md:24` with the same owner. The site marked **partly this
story's** is split between two owners on 11.9's own terms. Every row those tables name this story on
is fixed in this diff, which is 11.9's rule that a sentence moves with the change that falsifies it.

- `docs/reference/cli-commands.md:223` -- "ships four reference adapters, `createLocalCorpusAdapter`,
  `createNodeFileSystemAdapter`, `createSystemClockAdapter`, and `createCommandLineAdapter`". Becomes
  five, naming `createMcpAdapter`, its stdio-only scope, and the `McpTargetPolicy` that authorizes it.
  The trailing clause "there is no reference `EnvironmentProbePort` for `api`, because probing a live
  HTTP environment is the part only you can write" stays true and gains the transport reason.
- `docs/explanation/what-ships.md:20` -- "four reference adapters at `eval-quality/adapters`". Becomes
  five. The corpus count in the same sentence is Story 11.8's.
- `docs/how-to/author-behavioral-contracts.md:148` -- "`kind` says which sort of interface it came
  from, `api` or `cli`". Becomes three kinds. The six fixture observations at `:153-158` stay `api`.
- `docs/how-to/evaluate-tool-use-behavior.md:76` -- "`ProbeRequest` and `ProbeObservation` are
  discriminated unions with an `api` member and a `cli` member ... There is no `mcp` member". Becomes
  the shipped three-member statement with re-read line numbers.
- `docs/how-to/evaluate-tool-use-behavior.md:226` -- "An `mcp` adapter would need an `McpProbeRequest`
  and an `McpProbeObservation` ... and a third conformance arm". Shared with 11.7. The port-message
  half ships here and its speculative framing is cut; a past-tense restatement duplicates the shipped
  text beside it. The conformance-arm half stays owed and names Story 11.7.
- `docs/how-to/evaluate-tool-use-behavior.md:236` -- **partly this story's.** Story 11.6 corrects the
  eight-key claim on this line. The remaining clause, that a tool-use signature's confinement to
  `response-body`, `response-headers`, and `response-status` "is decided rather than open", is this
  story's, since Decision 6 decides what two of those three carry.
- `docs/how-to/evaluate-agent-behavior.md:24` -- **this story's.** "The one component that starts a
  process is `createCommandLineAdapter` in `src/adapters/command-line-adapter.ts`". A stdio MCP server
  is a second process this package starts.
- `docs/how-to/evaluate-agent-behavior.md:163`, `:270`, `:296` -- three `CommandTargetPolicy` and port
  statements. Read and left standing where each stays true; `:296`'s cap list is the model for the
  MCP paragraph on the adapter page.
- `docs/reference/cli-commands.md:185`, `README.md:228`, `README.md:245` -- the adapters subpath row
  and the two conformance lines. Read and confirmed true, so untouched.
- `docs/explanation/what-ships.md:30` and `docs/how-to/evaluate-ai-feature-behavior.md:229` -- "it
  ships no network adapter". Both stay true under Decision 1, which is one reason Decision 1 goes the
  way it does.
- `docs/reference/cli-commands.md:227`, `:229` -- the runner list and the outcome counts. **Story 11.7's.**
- `docs/*.generated.md` and `corpus/dev/README.md` -- generated, never hand-edited.
- `CHANGELOG.md:1-9` -- the header: entries go under `[Unreleased]` and `release:prepare`
  (`package.json:111`) stamps them into a dated section at release time. Hand-maintained, so NFR8's
  disclosure ships with the change that causes it. Story 9.5's file, at `:127`, is the one Epic 9
  story that carried the entry as a checklist item, and `CHANGELOG.md:619-623` is 0.1.0's own
  definition of the caller-facing surface, which names `eval-quality/adapters` and
  `eval-quality/conformance` and is what makes this story's additions disclosable.

## Tasks & Acceptance

**Execution:**

- [x] `src/core/schemas/port-messages.ts` -- add `McpProbeObservation` (`kind: 'mcp'`, `isError`,
      `result`) spreading `probeCorrelation`, add it to `ProbeObservation`, and add the inferred type
      exports.
- [x] `src/core/preflight/projection.ts` -- add the `mcp` arm and the `toolError` field per Decision 6;
      correct the "five fields and no others" comment above the type.
- [x] `src/core/preflight/witness-evidence.ts` -- add the `mcp` arm to `evidenceOf`: `responseBody` the
      projected result, `responseStatus` the `isError` projection as 0 or 1 with the projection stated
      in the source per Decision 6, `responseHeaders` `null`, `callInputs.arguments` filled through
      Story 11.6's `callInputsOf`, the command channels unobserved.
- [x] `src/core/preflight/reduce.ts` -- give `anomalyOf` its third arm over `isError`.
- [x] `src/core/schemas/probe-policy.ts` -- add `McpTargetAuthorization` and `McpTargetPolicy` carrying
      the server launch target and its arguments, the `tools` allowlist (Decision 9 supersedes the
      identifier-to-wire-name map this line first named), `cwd`, `serverEnvironment`, `maxElapsedMs`,
      and `maxOutputBytes`, each field's rule in its own `.describe()`.
- [x] `src/adapters/mcp-target-policy.ts` -- new: `MCP_DENIAL_REASONS`, `McpResolvedTarget`,
      `McpPolicyDecision`, and the pure `evaluateMcpTarget`, on `command-target-policy.ts`'s
      declaration-order and first-match rules.
- [x] `src/adapters/mcp-adapter.ts` -- new: `McpMechanism` with one `callTool` method,
      `nodeStdioMcpMechanism`, and `createMcpAdapter`, with a header carrying the four rules that
      answer "what is a tool server allowed to do".
- [x] `src/adapters/index.ts` and `src/testing/index.ts` -- export the adapter, its mechanism, and
      `McpTargetPolicy` on the two existing subpaths.
- [x] `src/testing/probe-conformance.ts` -- correct the two failure details at `:135` and `:464` so
      each names the kind it actually observed.
- [x] `src/adapters/command-line-adapter.ts` -- correct the denial detail at `:361` so it names every
      kind this adapter refuses.
- [x] `tests/adapters/mcp-adapter.test.ts` and `tests/adapters/mcp-target-policy.test.ts` -- new: one
      case per I/O Matrix row, including a real stdio session, both caps, the session-failure split,
      and every denial reason. The adapter test also builds a local `PortSubject` and asserts
      `runSharedAssertions` returns six passes, per Decision 7.
- [x] `tests/preflight/reduce.test.ts` -- widen fixture 129 to the six ordered mismatch pairs.
- [x] `tests/testing/conformance.test.ts` -- parameterise `probeRequest()`, `observation()`, and
      `breakEcho` over the kind, and update the `/observed kind "cli"/` expectation at `:804` to match
      whichever kind the case substitutes.
- [x] `tests/preflight/fixtures/probe-port.ts` -- leave `echoPort()` answering `api` and add the
      `mcp`-answering counterpart, so no existing `runPreflight` fixture moves.
- [x] `tests/preflight/fixtures/observations.ts` -- an `McpProbeObservation` builder beside
      `observationsFor` (`:553-570`, which hard-returns `kind: 'api'` at `:566`), carrying `isError`
      and `result`, read by the `mcp`-answering port double above and by the widened fixture 129.
      Nothing this story adds lands in `tests/schemas/fixtures/artifact-fixtures.ts`:
      `port-messages.ts` produces none of the twelve published documents, so its shapes have no
      accept fixture to seed, and the sealed run record fixture carrying `callInputs.arguments` is
      Story 11.6's, landed in the diff that publishes the ninth key.
- [x] `tests/preflight/` and `tests/evaluate/` -- one case per branch this story adds, including the
      `mcp` arms in `projectObservation`, `evidenceOf`, and `anomalyOf`, and an oracle resolving
      `/response-status` to `0` and to `1`.
- [x] `docs/reference/cli-commands.md:223`, `docs/explanation/what-ships.md:20`,
      `docs/how-to/author-behavioral-contracts.md:148`,
      `docs/how-to/evaluate-tool-use-behavior.md:76,226,236`,
      `docs/how-to/evaluate-agent-behavior.md:24`
      -- make each sentence true, re-read every inline `file:line` citation on those lines against the
      tree, and cut the text the change makes redundant. On `:236` only the confinement clause is
      this story's; Story 11.6 already corrected the key count.
- [x] `CHANGELOG.md` `[Unreleased]` -- one entry naming the third `ProbeObservation` union member,
      which breaks an outside `EnvironmentProbePort` implementation the way Story 9.3's widening did,
      and what is added to the published subpaths: `createMcpAdapter` and its mechanism on
      `eval-quality/adapters`, `McpTargetPolicy` and `McpTargetAuthorization` on
      `eval-quality/conformance`. No `schemaVersion` bump is named here; Story 11.6's entry carries
      both of them.
- [x] Comment pass -- prune every JSDoc and comment written here while writing it, then grep the
      edited files for `, not `, `rather than`, `instead of`, `as opposed to`, `, never `, and
      `no longer`, and confirm each surviving hit is a real contrast whose halves both carry a fact.
- [x] `_bmad-output/project-knowledge/learning-path-step-by-step.md` -- add the next unused step,
      tagged `(epic11-story13)`, plus its row in the step table, following `learning-path-template.md`.
      The epic's steps now run 45 through 57, since it carries thirteen stories.

**Acceptance Criteria:**

- Given an `mcp` contract, its probes, and a real stdio tool server behind `createMcpAdapter`, when
  `runPreflight` drives the plan end to end, then a verdict is produced and its `interface-present`,
  `state-reset`, and `clean-control` checks each read the `mcp` evidence, which closes the port half of
  the window Story 11.5 opened deliberately and Story 11.6 half closed.
- Given `createMcpAdapter` wrapped as a `PortSubject` over that server, when
  `runSharedAssertions('probe', subject, probeParsers.response)` runs, then all six outcomes pass: a
  typed fault, exactly one underlying call on success and on failure, a prompt abort, no in-band
  error, and a schema-valid return.
- Given an authorized `McpProbeRequest`, when the adapter answers it, then the observation echoes
  `kind`, `probeId`, `interfaceId`, and `operationId` unchanged, so `echoMismatch` passes.
- Given a request whose `interfaceId` or `toolName` the policy does not name, when the adapter runs it,
  then it throws `forbidden-target` and no server process starts.
- Given a tool result carrying `isError: true` and a JSON-RPC error answering `tools/call`, when each
  reaches the adapter, then both resolve to a schema-valid `McpProbeObservation`, so a seeded fault
  stays visible to AD-10.
- Given a session that never establishes and a result past `maxOutputBytes`, when each runs, then the
  first throws `budget-exhausted` on the elapsed cap or `port-failure` on a failure to start, and the
  second throws `budget-exhausted`, so a denial and a cap are never conflated.
- Given a leg that asked for an `mcp` probe and an observation of either other kind, when
  `reducePreflight` runs, then `port-contract-violation` names both kinds, for all six ordered pairs.
- Given an `mcp` observation reporting `isError`, when `evidenceOf` writes the sealed `Observation`,
  then `responseStatus` is `1` for a reported error and `0` otherwise, and a condition pointing at
  `/response-status` resolves that value.
- Given an `mcp` leg's observation, when `evidenceOf` writes `callInputs`, then `arguments` carries the
  tool call's arguments against the nine-key record Story 11.6 landed, and no schema version moves.
- Given the shipped `McpTargetAuthorization`, when its authorization-scoped fields are counted, then
  there are exactly two, the interface and the tool allowlist, which is the premise Story 11.7's
  Decision 1 derives `CONFORMANCE_OUTCOME_COUNTS['mcp-probe'] = 14` from.
- Given every existing `api` and `cli` fixture and the worked chain, when the whole suite runs, then
  every outcome and every emitted byte is unchanged and no published schema document moves, with one
  disclosed exception: `PreflightVerdict.fixtureDigest` and the `scoringVersion` derived from it take
  new values on every kind, because Decision 6's tool-error projection field is inside the digest. The
  `CHANGELOG.md` entry names it as a caller-facing break and Decision 11 records why the field is
  worth that.
- Given `CHANGELOG.md`'s `[Unreleased]`, when read, then it names the widened observation union as a
  caller-facing break and names the two subpath additions, and it names no `schemaVersion` bump. NFR8
  (`epics.md:54`) is what requires it.
- Given `npm run check:layers` and `npm run check:boundary`, when each runs, then both exit 0 with 0
  violations.
- Given `npm run validate`, when it runs, then it exits 0 with nothing on stderr.

## Decisions settled by construction

**Decision 1: the reference adapter speaks MCP's stdio transport, and Streamable HTTP is excluded
because it would reopen AD-2.**
AD-2's rule is unconditional: "No module in the package performs network I/O, and v0 ships no network
adapter at all — the environment-probe port is the only interface across which observations of a live
system enter, and every implementation of it is the caller's." Epic 10 did not reopen it, because a
child process is not a network call and no socket was opened. MCP is the first kind where the
transport is a live choice: stdio launches the server as a subprocess and speaks JSON-RPC over its
standard streams, and Streamable HTTP with its legacy HTTP+SSE variant speaks the same JSON-RPC over
HTTP to a URL. The stdio half is mechanically what `command-line-adapter.ts` already ships and reopens
nothing. The HTTP half is exactly the network adapter AD-2 deletes, and AD-2's own history is why it
cannot be narrowed for one kind: "Revision 1 named the prober as 'the single exception' while shipping
a fetch adapter, which meant the package both did and did not perform network I/O; the exception is
deleted rather than narrowed." So the reference adapter supports stdio, its header states the
exclusion and the reason in the source, and an adopter whose server sits behind a URL writes their own
`EnvironmentProbePort` and proves it with AD-37's suite, which is the same division that already
leaves `api` with no reference adapter. Downstream consequence: `docs/explanation/what-ships.md:30`
and `docs/how-to/evaluate-ai-feature-behavior.md:229` both keep the sentence "it ships no network
adapter" with no edit, and Story 11.7's Decision 1 keeps `mcp-probe` at 14 because no resolved-address
authorization field exists to assert a denial against. Known-bad state avoided: a package whose own AD
says it performs no network I/O while `src/adapters/` holds an HTTP client.

**Decision 2: the evaluator lives at `src/adapters/mcp-target-policy.ts` and the declared shapes live
in `core/schemas/probe-policy.ts`.**
`scripts/dependency-direction.ts:86-87` grants `adapters/` an edge to `ports/` and to `core-schemas`
and to nothing else, so a decision function a shipped adapter calls cannot live under `core/`.
`command-target-policy.ts:1-12` records the same finding from Epic 10, where the first draft put the
evaluator beside the HTTP one under `core/probe/` and `check:layers` failed it. Repeating that was
avoidable by reading one line, so this story reads it first and records the result. The Zod shapes go
in `core/schemas/probe-policy.ts` beside the other two, because `core/schemas` sits on the permitted
edge and keeping all three authorizations in one file is what makes the three mappings comparable at a
glance. Downstream consequence: Story 11.7's arm imports the policy type through
`src/testing/index.ts:32-35`, exactly as the `cli` arm does.

**Decision 3: the authorization is keyed by `interfaceId` alone, and its `tools` map is both the
allowlist and the identifier-to-wire-name mapping.**
The `cli` authorization is keyed by `(interfaceId, executable)` because `CommandInvocation` is declared
per operation and one CLI interface may name two executables. MCP has no such split: a session is
opened against one server and every tool the session offers belongs to it, so the interface identifier
is the server identity and one authorization answers for the whole interface, which is how the HTTP
authorization is keyed too. Story 11.4's Decision 3 reaches the same conclusion from the contract side
and leaves the server's identity out of the defect signature for AD-40's reasons. The tool side then
needs a map, and `Identifier` (`primitives.ts:8-20`) forces it: the pattern is
`[a-z0-9]+(?:-[a-z0-9]+)*`, real MCP tool names carry underscores and camel case, and Story 11.4's
Decision 4 turned down widening `Identifier` because it types every operation id and pointer segment
in the tree. So the authorization carries `tools: Record<Identifier, string>` mapping each declared
logical tool identifier to the name sent on the wire, and a `toolName` this map does not name is
denied before a server starts. That is one field doing the work `permittedSubcommandPaths` and
`artifacts` do separately on the command side, and it draws AD-35's same disclosure boundary: a tool
absent from the map is unreachable through this adapter. The authorization also carries
`serverEnvironment`, because a tool call's only channel is its arguments and a stdio server needing
credentials has nowhere else to receive them; `port-messages.ts:66-70` already places that material
here, saying "authorization material is the adapter's, supplied by the same mapping that authorizes
the target." The base environment is `{ PATH: process.env.PATH }` overridden by `serverEnvironment`,
which is `command-line-adapter.ts:134-140`'s rule unchanged. Downstream consequence, stated for Story
11.7's count derivation and unchanged by the split: the shipped authorization declares exactly two
authorization-scoped fields, the interface and the tool allowlist, so
`CONFORMANCE_OUTCOME_COUNTS['mcp-probe']` stays at 14. The server target, its arguments, `cwd`,
`serverEnvironment`, and the two caps are what an authorized call runs with and produce no denial
assertion, the same way `cwd`, `artifacts`, and the caps sit on the command authorization without
adding one.

**Decision 4: one session per port invocation, `maxElapsedMs` covering the whole invocation, and
`maxOutputBytes` applied to the result frame and to the server's own stderr independently.**
Three things decide it. AD-37's `single-underlying-call-on-success` counts the underlying mechanism, so
the mechanism exposes one `callTool` method and the session lifecycle sits inside it; a reused session
would make the count depend on which invocation happened to be first. AD-35's caps are per-invocation,
and a session held across legs leaves one hung server with no cap to catch it on the legs that follow.
And AD-10's state-reset differential compares two legs that must describe the same fixture state, so
adapter-side state carried between them is a confound on the one measurement the differential exists
to make. `maxElapsedMs` therefore bounds the whole invocation from the adapter's first byte through
server launch, `initialize`, `tools/call`, and teardown, because a handshake that never completes and a
tool call that never answers are the same event to the caller, and both throw `budget-exhausted`.
`maxOutputBytes` applies to the tool-result frame and, separately, to the bytes the server writes on
its own stderr: MCP's stdio transport reserves server stderr for logging, an undrained pipe deadlocks
the server once the OS buffer fills, and a drained one with no cap is an unbounded allocation. That is
Epic 10's Decision 7 applied to the two streams this transport actually has. Downstream consequence:
the cost is a process launch per leg, which the `cli` adapter already pays, and Story 11.7's arm pins
both caps the way the `cli` arm does at `probe-conformance.ts:533-545`.

**Decision 5: a tool error and a JSON-RPC error are both observations; a failure to establish the
session throws.**
`ApiProbeObservation`'s header states the rule for a 500 and `CommandProbeObservation`'s states it for
a non-zero exit: "Every response the system returns is an observation, at any status. Only a policy
denial, a cap, an abort, or a transport failure throws." A tool result carrying `isError: true` is the
direct analogue and resolves. A JSON-RPC error answering `tools/call` is the harder case and also
resolves, because the server answered: a server that refuses a tool the contract declares is precisely
the defect an oracle should be able to assert on, and throwing would make it invisible, which is the
failure `environment-probe-port.ts:21-25` already names for a non-2xx. It lands as `isError: true` with
the error object as the `result` payload, so one flag answers "did this call go through" for both cases
and `anomalyOf` needs a single arm. The line is drawn at whether anything answered: a process that
fails to start, a stream that closes before `initialize` completes, and bytes on stdout that are not a
JSON-RPC message all throw `port-failure`, and an elapsed cap during any of that throws
`budget-exhausted`. Known-bad state avoided: a pre-flight reporting every check satisfied because the
adapter threw on the one refusal the probe was written to catch.

**Decision 6: `result` carries the structured tool result, `responseStatus` carries `isError` as 0 or
1, and `ProjectedObservation` gains a field for the flag.**
Story 11.3's Decision 1 restricted the kind's first version to tools returning structured content, so
the descriptor is declared over the structured result and `descriptorChannelOf` answers `response-body`
for an `mcp` operation. Story 11.5's Decision 2 refuses `response-headers` at
`reachability.ts:437-446` and leaves `response-status` reachable. So an `mcp` observation has two
addressable response channels and this story fills both: `result` is the structured tool result and
lands on `responseBody`, and `responseStatus` is `0` when `isError` is false and `1` when it is true.
`responseHeaders` is `null`, which is the only truthful value for a transport with no header map.

The projection is stated in the source on the field that carries it, because a `0` in a channel typed
`number | null` is otherwise indistinguishable from a transport status of zero. AD-26 fixed
`response-status` as a number before this kind existed, so the flag is spelled there as `0` and `1`
and the field's description says which is which. What it buys is a real oracle: an author can assert
that a tool did not report an error, the one thing the MCP envelope offers beyond the result itself,
and `foreignChannels` already admits that channel for the kind. Left as `null`, `foreignChannels`
would be handing an `mcp` signature a permitted channel every observation writes empty, which is a
permission with nothing behind it and an oracle that resolves absent every time it runs.

Folding the flag into `result` was the first draft and is turned down: `result` is what the descriptor
describes, so putting the envelope's flag inside it would make the descriptor's `requiredKeys` and
`permittedKeys` describe a shape the server never returned under that name. So `isError` is also a
typed boolean on the port message, read by `anomalyOf`, and `ProjectedObservation` gains
`toolError: boolean | null` beside `status` and `exitCode`. Those three are one family, one per kind,
each `null` off its own kind, and the projection's stated test for membership is whether a declaration
can prune the field; none of the three is prunable and all three answer "did the call go through". A
projection blind to the flag would digest two legs identical when one errored and one did not, which
is the state-reset check reporting a reset that never happened. The projection keeps the boolean and
the sealed record keeps the integer, because the projection is an internal shape this package owns
while the evidence channel's type is published. Downstream consequence: `response-body` stays the
kind's one descriptor channel, so Story 11.7's AD-31 grading is unchanged by this, and Story 11.8's
dev-corpus exemplar can carry an oracle asserting the tool reported no error.

**Decision 7: this story ships the six shared assertions from inside its own adapter test and creates
no shared subject module.**
`reportOf` (`conformance.ts:454-467`) computes `passed` from
`outcomes.length === CONFORMANCE_OUTCOME_COUNTS[port]`, so an `mcp` conformance report is
unconstructible until an `mcp-probe` entry exists, and Story 11.7 owns that entry and pins it at 14.
Story 11.7 also claims `tests/adapters/mcp-probe-subject.ts` explicitly, on the ground that the subject
"cannot exist before the arm does", and it assigns `tests/adapters/mcp-adapter.test.ts` and
`tests/adapters/mcp-target-policy.test.ts` to this story. So the acceptance is discharged from inside
the adapter's own unit test: it builds a `PortSubject` locally over the real stdio fixture, calls
`runSharedAssertions('probe', subject, probeParsers.response)`, and asserts six passes. Story 11.7 then
writes the reusable subject its arm certifies. Known-bad state avoided: two stories each creating
`mcp-probe-subject.ts`, and a published count entry added by a story that ships no assertions to
justify it.

**Decision 8: this story is the second half of a split, and Story 11.6's Decision 1 holds the
argument.**
An earlier draft carried this work and Story 11.6's in one file, at three times the length of every
other story in the epic. The split line, the two-direction source evidence for it, and the forced
ordering are recorded once, in Story 11.6's Decision 1, and are not restated here. What this story
inherits from it: `ObservedCallInputs` and `ProbeInputBinding` already carry nine keys, `callInputsOf`
already has its third arm, both artifacts already read `schemaVersion: 5`, and an `mcp` defect
signature already qualifies. What this story owes back to it: nothing, since no module here names
`DefectSignature` and no published schema document moves. Downstream consequence: this story's
`CHANGELOG.md` entry names no `schemaVersion` bump, and Story 11.7's count derivation reads
Decision 3's two-field authorization in this file.

**Decision 9: `tools` is an allowlist of published tool names, which supersedes Decision 3's
identifier-to-wire-name map.**
Decision 3 argued for `tools: Record<Identifier, string>` on the ground that `Identifier`'s pattern
forbids the underscores and camel case real MCP tool names carry, so a mapping was needed. Read from
the tree that premise is stale. Story 11.4 minted `ToolName` for exactly this problem
(`primitives.ts:28`, `^[A-Za-z0-9_-]+$`), `McpOperation.toolName` is a `ToolName`, and `requestOf`
(`preflight/plan.ts`) puts `operation.toolName` straight onto `McpProbeRequest.toolName` in the
server's own spelling. So no logical tool identifier exists anywhere on the request side, and a map
keyed by one would introduce a second spelling nothing produces and force the evaluator into a
reverse lookup by value, where two keys mapping to one wire name would be silently ambiguous. The
field is `z.array(ToolName).min(1)`, compared literally, which is the role
`permittedSubcommandPaths` plays on the command side. Everything else Decision 3 settled holds
unchanged: the authorization is keyed by `interfaceId` alone, `serverEnvironment` carries the
authorization material AD-18 keeps out of the contract, and the base environment is
`{ PATH: process.env.PATH }` overridden by it. Downstream consequence: the shipped authorization
still declares exactly two authorization-scoped fields, the interface and the tool allowlist, so
Story 11.7's `CONFORMANCE_OUTCOME_COUNTS['mcp-probe'] = 14` derivation is unaffected.

**Decision 10: the three hand-narrowed casts in `buildPlanIndex` are gone, and Story 11.5's
Decision 10 is superseded.**
Story 11.5's Decision 10 recorded the casts as staying and named a grep as the standing answer for
this story's exhaustiveness sweep. That answer is retired. `PermittedInterface` is a
`z.discriminatedUnion('kind', ...)` whose branches each declare their own `operations` element type,
so an arm that narrows on `iface.kind` **before** reading `iface.operations` gets
`CommandOperation[]`, `McpOperation[]` or `Operation[]` with no cast. What forced the casts was one
line earlier: `operationsOf(iface)` has signature `(iface: PermittedInterface) => readonly
AnyOperation[]` and discards the kind-to-shape correlation before any kind test runs, so no later
narrowing could recover it.

The switch now narrows first, and the three arms `continue`, so the statement after it is reachable
only when a kind has no arm; `iface satisfies never` there is what fails the typecheck. Verified
mechanically rather than by reading: deleting `case 'web'` produces
`plan-index.ts: error TS1360: Type '{ ... kind: "web" ... }' does not satisfy the expected type
'never'`, and restoring it returns the typecheck to exit 0.

The real cost, and the reason 11.5 did not take it opportunistically, is that the duplicate-operation
bookkeeping is shared by all three kinds. It is hoisted into one `claim` closure rather than repeated
three times, and it keeps the behaviour that makes `operationOf` answer `undefined` for an id two
permitted interfaces both declare. That behaviour now has its own case in
`tests/seal/plan-index.test.ts`, over a collision across two different kinds, which is the case the
per-arm spelling could have broken while every same-kind case stayed green.

`operationsOf` keeps its keep: every other call site reads it for the widened element type, across `compile/`, `score/`, `coverage/`, and `preflight/`.
Its comment at `interface.ts` claimed TypeScript "will not iterate `iface.operations` directly",
which is true of `.map` on an un-narrowed union and untrue of a `for...of` inside a narrowed arm. The
comment now says which, and names `buildPlanIndex` as the one site that wants the opposite.
Downstream consequence: a fifth interface kind fails the build at `plan-index.ts` instead of being
sorted into the api map by exhaustion, and Story 11.7's kind work starts from a failing build.

**Decision 11: the projection's key count moved, and two assertions moved with it.**
Decision 6 puts `toolError` on `ProjectedObservation`, which makes it seven keys and changes every
AD-11 fixture digest, since the digest is computed over the whole projection. Two assertions in
`tests/preflight/projection.test.ts` carry that: the key-count case, and the golden digest literal,
which is re-frozen from this pass's first green run on the same terms the original was written under.

No committed artifact moved with them. `check:schemas`, `check:worked-example`, `check:corpus`, and
`check:ad33-table` all exit 0 with no regeneration, which is the mechanical proof that nothing in
this repository carries a fixture digest.

Artifacts callers hold do move, and that is the disclosable half. `fixtureDigest` (`projection.ts`)
digests whole projections, `reducePreflight` writes it to `PreflightVerdict.fixtureDigest`, and
`emit.ts` feeds that into `scoringVersionInputs`. So a caller re-running an unchanged `api` contract
after this release gets a different verdict digest and a different `scoringVersion`. NFR8 requires
that called out, so the `CHANGELOG.md` entry names both fields and says to re-run a pre-flight rather
than compare across the boundary. `comparabilityKey` does not move: `emit.ts` digests the scoring
policy digest and the probe identifiers, and takes no fixture digest. The acceptance criterion that
read "every outcome, verdict, and emitted byte is unchanged" is corrected to match, since it was
written before Decision 6 existed.

The type's own comment opened "The five fields and no others" while the type carried six and its test
counted six, so the census in that sentence was already stale before this story touched it. It is
deleted rather than renumbered, which is what Story 11.6's Design Notes found works: a sentence
saying what the fields are for needs no census of them, and the census is the half that rots.

**Decision 12: one of the four detail corrections the task list names was already landed, and it is
recorded here rather than left looking undone.**
The Execution list asks for `command-line-adapter.ts:361`'s denial detail to name every kind the
adapter refuses. Story 11.6 landed it: the message interpolates `parsed.kind`, and
`tests/adapters/command-line-adapter.test.ts` sends an `McpProbeRequest` and asserts the message
names `mcp`. This story makes the analogous edit in the new MCP adapter and leaves the command one
untouched. The two `probe-conformance.ts` details at the `api` arm's anomalous-status check and the
`cli` arm's non-zero-exit check were genuinely owed, and both now interpolate the observed kind
instead of resolving a binary ternary to the other kind's name.

**Decision 13: only `breakEcho` parameterises over the kind in `tests/testing/conformance.test.ts`.**
The Execution list names `probeRequest()`, `observation()`, and `breakEcho`. The first two stay
api-shaped, because `runEnvironmentProbePortConformance` is the `api` arm and its subject answers api
requests; `probe-conformance.ts`'s own header states the rule this follows, that a subject presenting
for one mechanism is not asked to fake another's scenarios, and rewriting those two builders over the
kind would break every one of the arm's nineteen assertions. What actually varies at that site is the
kind the port answers **with**, which is exactly what `echoMismatch` reads, so `breakEcho` takes the
substituted kind and the outcome-detail case runs over both `cli` and `mcp`. Downstream consequence:
Story 11.7's third arm builds its own request and observation builders, and inherits no half-generic
pair here.

**Decision 14: AD-2's rule sentence is corrected in place, and no spine revision is opened.**
`ARCHITECTURE-SPINE.md`'s AD-2 rule read "the environment-probe port is the only interface across
which observations of a live system enter, and every implementation of it is the caller's". Epic 10
falsified the second clause when it shipped `createCommandLineAdapter`, and this story falsifies it
further. The clause is narrowed to the implementations that reach a live system over a network, and
the two shipped implementations are named beside it, both of which launch a child process and open no
socket. The `adapters/` line in the source-tree sketch, which still listed two of the five shipped
adapters, is corrected in the same pass. Both edits are one clause each, `lint:spine` reports 0
findings, and `npm run build:shareable` regenerated the committed HTML that `check:shareable`
compares byte for byte. The spine stays at revision 9 and no ADR is minted.

**Decision 15: `maxOutputBytes` bounds each of the server's two streams, and the field says so.**
Decision 4 describes the cap as applying to "the result frame" and to stderr. The adapter enforces it
on the accumulated bytes of stdout and, separately, of stderr, which is a stricter and simpler
reading: the handshake frame and the result frame share one stream, and a server that answered
`initialize` with megabytes has already made the allocation the cap exists to prevent. The field's
own `.describe()` states it that way, so a policy author reads what the adapter does. Nothing else in
Decision 4 moves: the session is per invocation, `maxElapsedMs` covers launch through teardown, and
stderr is drained because an unread pipe deadlocks the server once the OS buffer fills.

**Decision 16: a result with no structured content is an absent body, and it is a case rather than an
error.**
Story 11.3's Decision 1 scopes the kind's first version to tools returning structured content, so the
adapter reads `structuredContent` off the tool result and records `{ kind: 'absent' }` when the
server returned none. Throwing would make a prose-only tool a port failure, which is a claim about
the adapter rather than about the tool, and AD-10's own rule is that the answer is payload. An absent
body is what every downstream reader already handles: `pruneVolatile` passes it through, `evidenceOf`
writes `responseBody: null`, and an oracle over the descriptor resolves absent, which the compile-time
reachability rules already describe. `tests/adapters/mcp-adapter.test.ts` covers it against a real
server through `silent_tool`.

**Decision 17: the frozen Never list predicts the `plan-index.ts` casts were already gone, and they
were not; the divergence is recorded here rather than edited into the block.**
The frozen block reserves `plan-index.ts` from this story on the ground that "Story 11.5's Approach
claims all four, including removing the `operation as Operation` cast at `plan-index.ts:238`. This
story reads them as landed." Three of the four did land. The cast removal did not: Story 11.5's own
Decision 10 records that it kept all three casts and substituted a grep for the compiler sweep, so the
frozen sentence describes a state the tree never reached.

The repository owner directed this story to close them, on a finding the Story 11.5 session verified
by compiling a standalone probe against the real types under `--strict` rather than by reasoning about
it. Decision 10 above carries the mechanism and the cost. The block is human-owned and is left byte
for byte as approved; a reviewer reading its `plan-index.ts` line should read Decision 10 and this one
beside it. The block's other three reservations hold as written: this story adds no third operation
map, gives `resolveHomeOperation` no kind test, constructs nothing in `requestOf`, and rewrites
neither `qualification.ts` detail string.

The frozen Problem statement's two line citations have also drifted, `ProbeRequest` at `:135-138` and
`ProbeObservation` at `:186-189`, because Story 11.5 added `McpProbeRequest` above both. The claims
those citations carry are still true of the tree this story started from, so nothing but the numerals
moved and neither is edited.

**Decision 18: a refused `initialize` throws `port-failure`, and the fixture server is what makes
every handshake assertion load-bearing.**
The first pass awaited the handshake frame and discarded it, so a server answering `initialize` with
a JSON-RPC error, which is the ordinary shape of a protocol-version disagreement, went on to
`tools/call` and had whatever came back recorded as a clean observation with `isError: true`. That
contradicts Decision 5, which draws the line at whether anything answered: a server that refused the
session answered a different question, and nothing observed the system. `callToolOverStdio` now reads
the handshake's error and throws, which reaches the caller as `port-failure` alongside a failure to
start and a malformed frame.

The peer review found the guard by finding its absence: deleting both the `initialize` request and
the `notifications/initialized` notification left the whole suite green, because the fixture server
dispatched on method with no session state. It is stateful now, refusing `tools/call` with the
SDK-standard `server not initialized` error until it has seen `initialize`. That makes every
successful case in `mcp-adapter.test.ts` a handshake assertion: re-running the same deletion now
turns ten of them red, which is recorded in Verification. A separate case speaks the fixture's
protocol directly and asserts the refusal, so the guard on the guard is armed too.

**Decision 19: what the server is launched with is asserted against a real server, and the assertion
is a marker rather than a key set.**
`serverEnvironment` and `cwd` had no falsifying test: every authorization declared `{}` and
`process.cwd()`, so spreading the whole host environment into a spawned server, dropping the declared
overrides, or dropping `cwd` from the spawn options each left the suite green. That is a gap on the
one field AD-18 designates for credentials.

The fixture publishes an `env_tool` returning its own environment and working directory, one
authorization declares `{ NOTES_TOKEN: ... }` and a `cwd` under the system temporary directory, and
the test asserts the declared token, the inherited `PATH`, the declared working directory, and the
absence of a marker variable the host process carries and the mapping does not. The marker is what
the assertion turns on rather than an exact key-set comparison, because macOS injects
`__CF_USER_TEXT_ENCODING` into a child environment whatever the `env` option says, and a key-set
assertion would be green on one platform and red on another for no behavioural reason.

**Decision 20: teardown closes the server's stdin and then kills its process group.**
`close()` killed the direct child only. `npx -y <package>` is the ordinary MCP launch shape, so the
process the authorization names is routinely a launcher and the server is its child; killing the
launcher leaves the server running, which is the state rule 3 exists to prevent. The child is spawned
`detached: true` so it leads its own group, and teardown ends its stdin first, which is the stdio
transport's own order and enough on its own for a server that exits when its input closes, then kills
the group. Windows has no process groups and throws on the negative pid, so the direct child is the
fallback.

Proved by mutation, and the proof needed a second fixture. A launcher fixture records its
grandchild's pid, and the test asserts the grandchild is gone after the elapsed cap fires. The first
version of that test passed under both implementations, because ending stdin was enough to end a
server whose only open handle was its input; the fixture takes a `--linger` flag that holds a timer
open, and with it the group kill is the only thing that ends the grandchild. Reverting to
`child.kill('SIGKILL')` turns the case red.

**Decision 21: the two conformance details this story corrected are reachable, and each has a test
that turns red on the string it replaced.**
Decision 12 records correcting the `api` arm's anomalous-status detail and the `cli` arm's
non-zero-exit detail so each names the kind it observed. The first attempt to test them concluded
both arms were unreachable, on the ground that `checkProbeResolved` calls `echoMismatch` first and
`echoMismatch` compares `kind`. That reasoning holds only for the mutation it was written against,
which substitutes the OBSERVATION's kind while the request stays `api`.

The peer's re-verify supplied the case it missed. `ProbeSubject.faultingRequest` and
`CommandProbeSubject.nonZeroExitRequest` are both typed `ProbeRequest`, the whole three-member union,
so a subject may declare a tool call there and answer it correlated. `echoMismatch` then passes,
`check` runs, and the non-matching arm fires with the kind it observed. Two cases exercise exactly
that, one per arm, and reverting either literal to the string it replaced turns its case red.

Both mutations are recorded rather than only the conclusion: substituting the observation's kind is
reported as a correlation failure and has its own pair of cases, and substituting the request's kind
reaches the status and exit comparisons. The source comment at each arm says which is which, so the
next reader is not told a reachable branch is dead. Tightening the two fields to their own kind would
make the earlier claim true by construction, and it is turned down here: both are published surface
an outside subject author implements, so narrowing them is a caller-facing break, and Story 11.7 is
the story that owns the conformance surface and can weigh it with the third arm in hand.

**Decision 22: one authorization per `interfaceId`, and the evaluator consults only the first.**
The first pass filtered every authorization naming the interface and took the first that named the
tool, copying `evaluateCommandTarget`'s ordering rule. That rule is safe on the command side because
its entries are keyed by `(interfaceId, executable)`, so every candidate it considers runs the same
executable. Here the key is the interface alone, and the schema's own description says the interface
identifier is the server identity, so searching on past a non-matching tool list would let one
logical interface resolve to two different binaries depending on which tool was asked for.

`evaluateMcpTarget` now finds the first authorization naming the interface and answers from that one,
and `McpTargetPolicy` refines its array to reject a second entry naming the same interface, with the
reason in the message. That gives the shape a runtime check a caller who parses the policy actually
sees, which is also the first runtime coverage this file's `min(1)` bounds and strict-object
rejection have had.

**Decision 23: five framing and decoding defects the peer review reproduced, all fixed at the
adapter.**
Each was found by running the adapter against a server built to exhibit it, and each has a case in
`mcp-adapter.test.ts` or a bound in the declaration.

A complete frame arriving with no trailing newline was thrown away, because the buffer flushed only
on `\n` and nothing flushed the residue on stream end; a fully received, parseable response became
`port-failure`. The stdout stream's `end` now flushes what is left. A chunk boundary inside a
multi-byte character corrupted the payload silently: `chunk.toString('utf8')` per data event replaced
the split character with U+FFFD, `JSON.parse` still succeeded, and the mangled value would have
reached the observation body an oracle asserts on and the fixture digest covers. A `StringDecoder`
holds the partial sequence across chunks. A response echoing its id as a JSON-RPC-legal string was
dropped and the call then burned its whole elapsed budget to report a cap for what was a correlation
mismatch; the pending map is keyed by the id as text. A frame carrying an explicit `"error": null`
beside a valid result forced `isError: true` and discarded the result; the error test is now against
`undefined` and `null` together. A non-object `structuredContent` was recorded as `null` and became
an absent body indistinguishable from Decision 16's no-structured-content case; `McpCallToolResult`
carries the structured result as an optional field, so absent means the call published none and a
`null` means the server published one.

Two smaller ones travel with them: `maxElapsedMs` is bounded above at 2,147,483,647, because a larger
value is silently clamped by the timer to one millisecond and turns a generous budget into an
immediate cap, and `close()` sets the session's broken flag as well as its closed flag, so a late
over-cap chunk cannot reject a session that already settled.

**Decision 24: the three branched observation readers keep binary tails, and the reason is recorded
rather than patched.**
`projectObservation`, `evidenceOf`, and `anomalyOf` each test two kinds and let the third fall
through, so a fifth kind would inherit an arm written for another. The peer review raised giving each
an exhaustive tail the way `buildPlanIndex` now has one, and it is turned down here. `ProbeObservation`
is a `z.discriminatedUnion`, so a fifth member cannot arrive without an edit to `port-messages.ts`,
and that edit is what the next kind's story does; the forcing function that matters is at the site
that sorts by kind, which Decision 10 gave one. Adding three more guarded branches to guard a state
the union closes buys an exhaustiveness the compiler already gives at the declaration and costs three
functions their shape. A story that adds a fifth observation member should read this decision and
decide again with its own kind in hand.

**Decision 25: the environment-probe port's four normative rules are widened to the mechanisms it
now has.**
`environment-probe-port.ts` states four rules an implementation must follow, and all four were
written in HTTP terms: "before any network call", "keep the original host in the `Host` header",
"verify TLS against that host". That prose is what an external adapter author reads, and this story
deleted the documentation sentence that pointed at it precisely because it does not describe a
mechanism that starts a process. Rules 1 and 2 now state the obligation once and give the HTTP and
process-launching specifics under it, rule 3 says "a failure to reach the system at all" where it
said "a transport failure", and rule 4 names a non-zero exit and a tool error beside a 4xx. No rule
changed what it requires; each one now says it for every mechanism the port has.

**Decision 26: a test that starts a process cleans it up on its failure path, and the fixture bounds
its own lifetime.**
The teardown case records a launched server's pid and asserts it is dead. Its failing run is by
definition the run where that server is still alive, and it had no cleanup, so a failed assertion
leaked a process. The `--linger` flag made that permanent: it held an interval open, and an interval
never elapses. The peer found two orphaned servers on the machine, one of them twelve minutes old and
from this session's own mutation check.

Two changes, and both are needed. The fixture's `--linger` is a `setTimeout` that exits, so any leak
is bounded at sixty seconds whatever the harness does. The test file kills every pid it recorded in
an `afterAll`, whatever the assertions did, and the pid files live in a directory minted per run with
`mkdtempSync` rather than at a fixed path, so a watch run beside a CI run cannot read the other's pid
and assert against the wrong process.

**Decision 27: a handshake frame carrying neither a result nor an error is a refusal.**
Decision 18 reads the handshake's `error` and throws. JSON-RPC requires exactly one of `result` and
`error`, so a frame with neither is malformed and says nothing about whether the session opened;
accepting it is the same failure as accepting an explicit refusal, one step quieter. The handshake
now also requires a `result`, the fixture takes an `--empty-initialize` flag, and a case asserts the
`port-failure` and its message. Rule 4 in the file header claims the session must be established, and
this is the second half of what establishing it means.

**Decision 28: the abort path proves the group teardown too.**
Decision 20's case drives teardown through the elapsed cap. The abort path reaches `close()`
differently: the spawn's own signal handling kills the direct child with `SIGTERM` first, and
`killProcessGroup` runs afterwards from the mechanism's `finally`. A process group outlives its
leader while any member is alive, so the negative pid still reaches the grandchild, and a second case
against a launcher with the full elapsed budget asserts it rather than leaving the reasoning
unchecked.

## Design Notes

The organising idea is that the port was already built for a third kind and had one assumption left in
it. `probeCorrelation` is kind-neutral, `echoMismatch` compares `kind` as one of four fields, and
`kindMismatch` in `reduce.ts` compares the request's kind to the observation's with no enumeration.
What was HTTP-shaped was the authorization and the two-arm fallthrough in three pure functions, where
`kind === 'api'` and its `else` meant `cli` by exhaustion. Story 11.5 spent the request half of that
work, Story 11.6 spent the recorded-input half, and this story spends the answer half.

The shapes, for orientation only:

```ts
export const McpProbeObservation = z.strictObject({
	...probeCorrelation,
	kind: z.literal('mcp'),
	isError: z.boolean(), // the envelope flag anomalyOf reads
	result: ProbeObservedBody, // the structured result the descriptor describes
})

export const McpTargetAuthorization = z.strictObject({
	interfaceId: Identifier, // the server, and the whole authorization key
	target: z.string().min(1),
	targetArgs: z.array(z.string()),
	tools: z.array(ToolName).min(1), // the allowlist, per Decision 9
	cwd: z.string().min(1),
	serverEnvironment: z.record(KeyName, z.string()),
	maxElapsedMs: z.int().min(1).max(2_147_483_647),
	maxOutputBytes: z.int().min(1),
})
```

Two of those eight authorization fields are authorization-scoped, `interfaceId` and `tools`, and the
other six are what an authorized call runs with. That count is the premise Story 11.7's Decision 1
derives its fourteen outcomes from, and the split did not move it.

## Verification

Every command below was run and the result is recorded.

- `npm run typecheck` -- exit 0. Adding `McpProbeObservation` to the union named exactly the four
  sites the Code Map predicted and no fifth: `projection.ts` twice, `reduce.ts`, and
  `witness-evidence.ts`.
- The exhaustiveness of `buildPlanIndex`'s switch, proved by breaking it: deleting `case 'web'`
  produces `src/core/seal/plan-index.ts(271,9): error TS1360: Type '{ ... kind: "web" ... }' does not
  satisfy the expected type 'never'`, and restoring it returns the typecheck to exit 0.
- `npx vitest run tests/adapters` -- green, 79 tests across 9 files. `mcp-adapter.test.ts` runs a real
  stdio server per case: the authorized call, a shell-metacharacter argument reaching the tool
  verbatim inside the JSON-RPC frame, a result with no structured content, a tool error, a JSON-RPC
  error, both denials, an `api` and a `cli` request refused by kind, a denial proved to reach no
  mechanism, both caps, a server that fails to start, a server that exits at launch, a malformed
  frame, a mid-call abort, the six shared assertions, and a full `runPreflight` end to end.
- `npx vitest run tests/preflight tests/evaluate tests/application` -- green. `mcp-observation.test.ts`
  covers the three branched pure functions and the oracle: `/response-status` resolves `true` against
  a clean call asserting `0` and against an errored one asserting `1`, and `false` in both other
  directions, read off `CheckResolutionValue.resolution` rather than off an identifier list.
- `npx vitest run tests/preflight/reduce.test.ts` -- green, 47 tests. Fixture 129 is now six ordered
  mismatch pairs over three plans, one per kind, and each asserts the fault message names both kinds.
- `npm run test:conformance` -- green. `environment-probe` stays 19/19 and `command-probe` stays
  15/15, and the adapter test's six shared assertions all pass.
- `npm run check:layers` -- exit 0, 128 files, 0 violations, which is the mechanical proof of
  `evaluateMcpTarget`'s placement under `adapters/`.
- `npm run check:boundary` -- exit 0, 216 entries, 0 violations.
- `npm run check:schemas` -- exit 0 with no regeneration, and `npx vitest run tests/schemas` green
  with no census constant moved. Together they prove no published document moved, which is what a
  port message that produces none of the twelve should do.
- `npm run check:worked-example` -- exit 0, 5 files byte for byte. This is also the proof that no
  committed artifact carries an AD-11 fixture digest, which matters because Decision 6's sixth
  projection field changes every one of those digests.
- `npm run check:ad33-table`, `check:ad21-table`, `check:ad31-table`, `check:ad5-registry`,
  `check:ad28-registry`, `check:corpus` -- all exit 0 with no regeneration.
- `npm run lint:spine` -- exit 0, 0 findings against the two edited AD-2 sentences.
- `npm run build:shareable && npm run check:shareable` -- the build rewrote
  `_bmad-output/shareable/eval-quality-architecture-spine.html` from the edited spine and the check
  reports 21 committed pages matching byte for byte. The regenerated file is committed.
- `npm run check:doc-invocations` and `npm run check:docs` -- exit 0. Story 11.2 armed the tool-use
  guide as an executed input, so this story's edits to it are executed and checked.
- `grep -nE ', not |rather than|instead of|as opposed to|, never |no longer'` over every source file
  this story wrote or edited -- every surviving hit read and kept only where both halves carry a fact.
  One was removed: `mcp-adapter.ts`'s JSON-RPC response type was documented "as opposed to a
  notification or a server-initiated request", which is now stated as what the shape carries.
  The same grep over the new learning-path step returns nothing.
- `git diff CHANGELOG.md` -- two hunks, both under `[Unreleased]`. Nothing below it is touched, since
  `release:prepare` owns every dated section. One of the two corrects Story 11.5's own entry, whose
  closing clause said `ProbeObservation` is unchanged and no adapter can answer an mcp leg yet.
- `npm run test:coverage` -- exit 0. 122 test files, 4009 tests, `src/core/**` at 96.91% statements
  and 92.23% branches.
- `npm run validate` -- exit 0 with nothing on stderr, all 21 steps green.
- `npm run build` -- exit 0.

**Peer review round: 33 findings raised, 33 addressed.**

A sibling session ran `/bmad-code-review` over both commits with seven reviewers and verified every
claim at the cited line, reproducing four of them by running the adapter against a server built to
exhibit the defect. Four were merge-blocking, eleven medium, eighteen low, and four it raised and
rejected itself. Nothing was deferred.

| Finding | Fix |
|---|---|
| The new projection field moves `fixtureDigest` and `scoringVersion` for every existing api and cli run, and the CHANGELOG discloses nothing | `CHANGELOG.md` entry naming both fields as a caller-facing break, the acceptance criterion corrected, Decision 11 rewritten to separate committed artifacts from artifacts callers hold |
| A refused `initialize` is treated as an established session | Decision 18: the handshake's error is read and throws `port-failure` |
| The handshake has no verification at all, and one test's title claims it does | Decision 18: the fixture refuses `tools/call` before `initialize`, so deleting the handshake now turns ten cases red |
| `serverEnvironment` and `cwd` have zero coverage on the field AD-18 designates for credentials | Decision 19: an `env_tool`, a declared token and working directory, and a host-only marker asserted absent |
| A complete frame with no trailing newline at EOF is thrown away | Decision 23: the stdout stream's `end` flushes the residue, with a case over `unframed_tool` |
| UTF-8 corruption across stdout chunk boundaries | Decision 23: `StringDecoder`, with a case over a frame split inside `é` |
| Grandchildren are orphaned by teardown | Decision 20: `detached: true`, stdin closed then the process group killed, proved by a launcher fixture |
| Two sentences in the rewritten guide still say the kind is owed | The frontmatter description and the closing line both corrected |
| A sentence this diff added is arithmetically wrong and names a channel outside its own list | All three of the confined channels carry a value; `response-headers` is named as foreign rather than empty |
| The three `port-failure` tests are mutually indistinguishable | Each reads the cause the session carries; a fourth case covers a crash during `tools/call` |
| The literal-comparison policy test asserts only `allowed === false` | Asserts `tool-not-authorized` and the detail |
| The stderr-cap test races two pipes and can flake | `noisy_tool` never answers |
| Two new assertions cannot see the failure they are written for | Case 113 pins eight port calls and every check by kind and outcome; the plan-index case gained a positive control |
| Two authorizations for one `interfaceId` may name different binaries | Decision 22 |
| Both conformance detail corrections are untested | Decision 21: unreachable through their own runners, recorded in the source, with the reachable behaviour asserted instead |
| `maxElapsedMs` has no ceiling and a timer clamps a large value to 1ms | Bounded at 2,147,483,647, with a reject case |
| A response whose id is a legal string is dropped | Keyed by the id as text |
| An explicit `"error": null` forces `isError: true` | Tested against `undefined` and `null` together |
| A non-object `structuredContent` is recorded as absent | Carried as the value it is; absent now means the call published none |
| `close()` never sets the broken flag | It does |
| The close handler names no phase | It names the method the session was waiting on |
| Three stale citations in the tool-use guide | `sealed-run-record.ts:255`, `qualification.ts:832`, `interface.ts:365` |
| `README.md` says the conformance suite runs against every shipped adapter | Says it runs over the shipped adapters |
| `cli-commands.md` says the port has two mechanisms | Names the HTTP and command arms, which is what the sentence is about |
| The story's census of `operationsOf` call sites is off | The census is deleted, per Decision 11's own argument |
| The Execution list and Design Notes still show `tools` as a map | Both point at Decision 9 |
| `mcpEchoPort`'s `isError` parameter is never passed | Case 114 drives it and asserts a failed verdict |
| The breakEchoKind case asserts the detail and never the outcome | Asserts `outcome.passed` and `report.passed` |
| The duplicate-operation-id throw is asserted only as `TypeError` | Asserts the message naming the id |
| `McpTargetAuthorization` has no runtime coverage | Seven parse cases, including the strict-object rejection |
| Nothing asserts the two authorization-scoped fields the next story's count rests on | A case pins the eight-field key set |
| Negation-then-correction in three lines this commit added | Rewritten |
| The port's four normative rules are HTTP-only prose | Decision 25 |

The reviewer also confirmed the two supersessions against the tree, found no socket anywhere under
`src/adapters/`, found no never-settling frame, listener leak, unhandled rejection, double-settle, or
cap evasion in the session, and confirmed the `buildPlanIndex` refactor is semantics-preserving in
both duplicate modes. Its four self-rejected findings are not chased, except the observation-reader
one, which Decision 24 settles as a recorded decision.

**Re-verify round: six follow-ups, all addressed.**

The peer's narrowed re-verify reproduced both of this pass's mutations independently, put the
handshake mutation's blast radius at sixteen failing cases across four directories rather than the
ten counted in one file, traced the `fixtureDigest` disclosure to `EvidenceArtifact`'s
`scoringVersionInputs` and confirmed `comparabilityKey` and the state-reset comparison are unmoved,
and agreed with Decisions 22 and 24 as written. It returned two findings that were still wrong and
four smaller ones.

| Finding | Fix |
|---|---|
| The unreachability claim in Decision 21 and in two source comments is false: both `faultingRequest` and `nonZeroExitRequest` are typed over the whole request union, so a subject may declare another kind there and reach the arm | Decision 21 rewritten, both comments corrected, and one case per arm added; reverting either literal turns its case red |
| The teardown case leaks a process permanently on its failure path, and it already had, twice on this machine | Decision 26 |
| The launcher pid file is a fixed path two runs would share | Decision 26: a per-run directory from `mkdtempSync` |
| A handshake frame carrying neither a result nor an error is read as consent | Decision 27 |
| `CHANGELOG.md` calls `toolError` a sixth field on a projection carrying seven keys | The ordinal is deleted, in five places, on Decision 11's own argument that the census is the half that rots |
| The abort path and the launcher are never combined, so the group kill after a `SIGTERM` is unproven | Decision 28 |

The reviewer's one optional strengthening, denying inside `evaluateMcpTarget` when more than one
authorization names an interface, is not taken: `McpTargetPolicy`'s refine states the rule where the
shape is declared, and a second copy in the evaluator would be the transcription Story 11.5's
Decision 1 spent itself removing.
