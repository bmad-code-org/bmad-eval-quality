---
title: 'The port messages and the MCP adapter'
type: 'feature'
created: '2026-09-09'
status: 'draft'
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
  `observation.kind === 'api'` at `:120`, `:129`, and `:130`. Decision 6 settles the sixth field.
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

- [ ] `src/core/schemas/port-messages.ts` -- add `McpProbeObservation` (`kind: 'mcp'`, `isError`,
      `result`) spreading `probeCorrelation`, add it to `ProbeObservation`, and add the inferred type
      exports.
- [ ] `src/core/preflight/projection.ts` -- add the `mcp` arm and the `toolError` field per Decision 6;
      correct the "five fields and no others" comment above the type.
- [ ] `src/core/preflight/witness-evidence.ts` -- add the `mcp` arm to `evidenceOf`: `responseBody` the
      projected result, `responseStatus` the `isError` projection as 0 or 1 with the projection stated
      in the source per Decision 6, `responseHeaders` `null`, `callInputs.arguments` filled through
      Story 11.6's `callInputsOf`, the command channels unobserved.
- [ ] `src/core/preflight/reduce.ts` -- give `anomalyOf` its third arm over `isError`.
- [ ] `src/core/schemas/probe-policy.ts` -- add `McpTargetAuthorization` and `McpTargetPolicy` carrying
      the server launch target and its arguments, the `tools` identifier-to-wire-name map,
      `cwd`, `serverEnvironment`, `maxElapsedMs`, and `maxOutputBytes`, each field's rule in its own
      `.describe()`.
- [ ] `src/adapters/mcp-target-policy.ts` -- new: `MCP_DENIAL_REASONS`, `McpResolvedTarget`,
      `McpPolicyDecision`, and the pure `evaluateMcpTarget`, on `command-target-policy.ts`'s
      declaration-order and first-match rules.
- [ ] `src/adapters/mcp-adapter.ts` -- new: `McpMechanism` with one `callTool` method,
      `nodeStdioMcpMechanism`, and `createMcpAdapter`, with a header carrying the four rules that
      answer "what is a tool server allowed to do".
- [ ] `src/adapters/index.ts` and `src/testing/index.ts` -- export the adapter, its mechanism, and
      `McpTargetPolicy` on the two existing subpaths.
- [ ] `src/testing/probe-conformance.ts` -- correct the two failure details at `:135` and `:464` so
      each names the kind it actually observed.
- [ ] `src/adapters/command-line-adapter.ts` -- correct the denial detail at `:361` so it names every
      kind this adapter refuses.
- [ ] `tests/adapters/mcp-adapter.test.ts` and `tests/adapters/mcp-target-policy.test.ts` -- new: one
      case per I/O Matrix row, including a real stdio session, both caps, the session-failure split,
      and every denial reason. The adapter test also builds a local `PortSubject` and asserts
      `runSharedAssertions` returns six passes, per Decision 7.
- [ ] `tests/preflight/reduce.test.ts` -- widen fixture 129 to the six ordered mismatch pairs.
- [ ] `tests/testing/conformance.test.ts` -- parameterise `probeRequest()`, `observation()`, and
      `breakEcho` over the kind, and update the `/observed kind "cli"/` expectation at `:804` to match
      whichever kind the case substitutes.
- [ ] `tests/preflight/fixtures/probe-port.ts` -- leave `echoPort()` answering `api` and add the
      `mcp`-answering counterpart, so no existing `runPreflight` fixture moves.
- [ ] `tests/preflight/fixtures/observations.ts` -- an `McpProbeObservation` builder beside
      `observationsFor` (`:553-570`, which hard-returns `kind: 'api'` at `:566`), carrying `isError`
      and `result`, read by the `mcp`-answering port double above and by the widened fixture 129.
      Nothing this story adds lands in `tests/schemas/fixtures/artifact-fixtures.ts`:
      `port-messages.ts` produces none of the twelve published documents, so its shapes have no
      accept fixture to seed, and the sealed run record fixture carrying `callInputs.arguments` is
      Story 11.6's, landed in the diff that publishes the ninth key.
- [ ] `tests/preflight/` and `tests/evaluate/` -- one case per branch this story adds, including the
      `mcp` arms in `projectObservation`, `evidenceOf`, and `anomalyOf`, and an oracle resolving
      `/response-status` to `0` and to `1`.
- [ ] `docs/reference/cli-commands.md:223`, `docs/explanation/what-ships.md:20`,
      `docs/how-to/author-behavioral-contracts.md:148`,
      `docs/how-to/evaluate-tool-use-behavior.md:76,226,236`,
      `docs/how-to/evaluate-agent-behavior.md:24`
      -- make each sentence true, re-read every inline `file:line` citation on those lines against the
      tree, and cut the text the change makes redundant. On `:236` only the confinement clause is
      this story's; Story 11.6 already corrected the key count.
- [ ] `CHANGELOG.md` `[Unreleased]` -- one entry naming the third `ProbeObservation` union member,
      which breaks an outside `EnvironmentProbePort` implementation the way Story 9.3's widening did,
      and what is added to the published subpaths: `createMcpAdapter` and its mechanism on
      `eval-quality/adapters`, `McpTargetPolicy` and `McpTargetAuthorization` on
      `eval-quality/conformance`. No `schemaVersion` bump is named here; Story 11.6's entry carries
      both of them.
- [ ] Comment pass -- prune every JSDoc and comment written here while writing it, then grep the
      edited files for `, not `, `rather than`, `instead of`, `as opposed to`, `, never `, and
      `no longer`, and confirm each surviving hit is a real contrast whose halves both carry a fact.
- [ ] `_bmad-output/project-knowledge/learning-path-step-by-step.md` -- add the next unused step,
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
  every outcome, verdict, and emitted byte is unchanged, and no published schema document moves.
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
1, and `ProjectedObservation` gains a sixth field for the flag.**
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
	tools: z.record(Identifier, z.string().min(1)), // allowlist and wire mapping
	cwd: z.string().min(1),
	serverEnvironment: z.record(KeyName, z.string()),
	maxElapsedMs: z.int().min(1),
	maxOutputBytes: z.int().min(1),
})
```

Two of those eight authorization fields are authorization-scoped, `interfaceId` and `tools`, and the
other six are what an authorized call runs with. That count is the premise Story 11.7's Decision 1
derives its fourteen outcomes from, and the split did not move it.

## Verification

**Commands:**

- `npm run typecheck` -- expected: exit 0. Every observation branch is present, and Story 11.6's nine
  keys are already in place.
- `npx vitest run tests/adapters tests/preflight tests/evaluate` -- expected: green, one case per I/O
  Matrix row, including a real stdio session, both caps, and every denial reason.
- `npm run test:conformance` -- expected: green. `environment-probe` stays 19/19, `command-probe` stays
  15/15, and the adapter test's six shared assertions all pass.
- `npm run check:layers` -- expected: exit 0, 0 violations, proving `evaluateMcpTarget`'s placement
  mechanically.
- `npm run check:boundary` -- expected: exit 0, 0 violations.
- `npm run check:schemas` -- expected: exit 0 with no regeneration. A port message carries no
  `lineageFields` and has no entry under `schemas/`, so no published document moves in this story.
- `npx vitest run tests/schemas` -- expected: green with no census constant moved, which is what
  proves the previous line.
- `npm run check:worked-example` -- expected: exit 0 with no difference. Story 11.6 moved the record's
  stamp; this story moves nothing the worked chain reads.
- `npm run check:ad33-table` and `npm run check:ad21-table` -- expected: exit 0 with no regeneration,
  proving the outcome procedure and both ladders read no transport field.
- `npm run check:doc-invocations` and `npm run check:docs` -- expected: exit 0. Story 11.2 armed the
  tool-use guide as an executed input, so this story's edits to it are executed and checked.
- `grep -nE ', not |rather than|instead of|as opposed to|, never |no longer' src/adapters/mcp-adapter.ts src/adapters/mcp-target-policy.ts src/core/schemas/port-messages.ts src/core/schemas/probe-policy.ts src/core/preflight/projection.ts src/core/preflight/witness-evidence.ts`
  -- expected: every hit is a contrast whose two halves each carry a fact, checked by reading, and
  every other hit removed.
- `git diff CHANGELOG.md` -- expected: every hunk sits under `[Unreleased]` and nothing below it is
  touched, since `release:prepare` owns every dated section.
- `npm run test:coverage` -- expected: exit 0 with `src/core/**` at or above 90% statements and 90%
  branches.
- `npm run validate` -- expected: exit 0 with no output on stderr, over the 21 steps `package.json:113`
  declares at this boundary; Story 11.8 adds the twenty-second, `check:doc-counts`, later. Five of the
  21 read this story's changes: `check:layers`, `check:boundary`, `check:docs`,
  `check:doc-invocations`, and `test:coverage`. `check:schemas` runs and finds nothing moved, which is
  the mechanical proof that this half of the split touches no published document.
