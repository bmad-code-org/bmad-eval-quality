---
title: 'The run record, the defect signature, and qualification'
type: 'feature'
created: '2026-09-07'
status: 'done'
review_loop_iteration: 0
context:
  - _bmad-output/implementation-artifacts/epic-9-context.md
  - _bmad-output/implementation-artifacts/9-1-the-interface-kind-shaped-operation.md
  - _bmad-output/implementation-artifacts/9-2-the-channel-vocabulary-and-the-pointer-grammar.md
  - _bmad-output/implementation-artifacts/9-3-compile-and-preflight-admit-a-command-interface.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A command contract now compiles, seals, and pre-flights, and nothing can score it. `Observation` (`src/core/schemas/sealed-run-record.ts:171-211`) records `stdout`, `stderr`, and `exitCode` and has no field for a file the system under test wrote, so Story 9.2's `artifact` channel resolves `absent` for every operand. `ObservedCallInputs` (`:153-158`) is the four HTTP transport channels, so a command's arguments, options, environment, and standard input have nowhere to be recorded and every command step's binding filter fails. And AD-40's whole detection mechanism is closed to the kind: `DefectSignature` (`src/core/schemas/defect-signature.ts:133-143`) declares `method` and `pathTemplate`, `ProbeInputBinding` (`:79-84`) is the same four HTTP channels, and `qualifyProbe` rejects every kind but `api` at `src/core/score/qualification.ts:718-726` with the detail `"<kind>" declares a method and a path template that mean nothing off an api interface`. Without a signature, AD-6 has no state to assign and every command probe is unscoreable by construction.

**Approach:** Give the observation the field its channel needs and the call-input shape its kind needs, both under one breaking bump on the sealed run record. Give the defect signature a command variant that resolves on the invocation, under one breaking bump on the probe. Then retire `signature-interface-kind-unsupported` for `cli` while keeping it for `web` and `mcp`, add the probe-side mirror of `condition-text-channel-on-api` that has never existed, and branch the four score-side sites that loop the HTTP transport channels. When this story ends, a command probe qualifies, a command signature resolves against a command contract's inventory, and the witness match runs.

## Boundaries & Constraints

**Always:**

- AD-40 fixes what a signature may be rooted in, and the command identity obeys the same rule for the same reason: "Method and path template are declared per operation under AD-19 and are contract-independent, so the scorer resolves a signature against any contract's operation inventory mechanically." Its withdrawal of AD-26's grammar is the constraint that binds hardest: "the required vocabulary consisted of identifiers its required author is forbidden to know... And step identifiers are contract-relative while a corpus is not."
- AD-9's bar is one bar. `qualification.ts:334-339` records it: "A corpus gate has no lenient mode: AD-9's 'an unqualified probe cannot enter a sealed set' states one bar, so the probe side applies the rule unconditionally."
- `QUALIFICATION_FAILURES` (`qualification.ts:49-70`) is a closed vocabulary separate from AD-5's, by that module's own header at `:6-9`: "The failure vocabulary is closed and separate from AD-5's, because AD-5 is compile-time over contracts and `compile` never sees a probe." A code added here is not an AD-5 code and does not touch the spine's registry table.
- Two BREAKING `schemaVersion` bumps, each recorded in the driving field's own `.describe()` per AD-11: sealed run record 3 → 4 and probe 2 → 3.
- AD-18 binds the artifact record as it binds every other: "Credentials, tokens, real names, email addresses, account identifiers, and transaction content are excluded; where evidence must refer to them it stores a digest or an opaque reference resolved through AD-8's manifest. This binds published examples and test fixtures as strictly as real runs."
- No source comment may contain any of `check:boundary`'s twelve forbidden strings.

**Ask First:**

- Any AD-5 code, any change to `FAILURE_CODES`, or any spine registry-table edit. This story mints none: its new failure is a `QUALIFICATION_FAILURES` member.
- Any change to `compile`, `seal`, or `preflight`. Those are Story 9.3's and are done.
- Any change to `AD-33`'s outcome procedure, `AD-21`'s ladders, or the AD-7 reducer. None of the three reads a transport field, and Decision 6 records the verification.

**Never:**

- No operation identifier in a defect signature. AD-40 withdrew a contract-relative vocabulary once and `defect-signature.ts:124-128` records the ruling in the source; Decision 2 settles the command case on the same grounds.
- No third pointer grammar, no probe-side channel vocabulary of its own, and no second relation language. `defect-signature.ts:101-112` is explicit: "The predicate is the shipped `Expression` in AD-4's closed operator vocabulary, never a second relation language."
- No file content on an observation. An artifact record carries a digest and a declared body projection, never the bytes of a file the package never read.
- No spine amendment and no new ADR.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Command observation | An observation of a command step recording arguments, options, environment, stdin, both streams, an exit code, and two artifacts | Parses; every command pointer Story 9.2 mints resolves against it | N/A |
| Artifact pointer resolution | `/interactions/run/artifact/report/summary` against an observation carrying an artifact `report` | Resolves the declared value, not `absent`, which closes Story 9.2's Decision 6 window | N/A |
| Artifact pointer, no such artifact | The same pointer against an observation recording no `report` | Resolves `absent`, which AD-26 makes an observation rather than an error | N/A |
| Api observation | Any observation already in `tests/` or the worked chain | Parses unchanged apart from its `schemaVersion` stamp | N/A |
| Command call inputs on an api observation | An observation whose `callInputs` carries `option` while its operation is api | Parses. The record is caller-supplied and AD-32 makes the mismatch a cross-artifact inconsistency ingest records, never a parse failure | Recorded by ingest |
| Command signature | A probe whose signature declares `interfaceKind: "cli"` and an invocation | Qualifies, if its predicate and selector are legal | N/A |
| `web` or `mcp` signature | Same with either other kind | `signature-interface-kind-unsupported`, unchanged | Rejected by the gate |
| Command signature declaring a method | `interfaceKind: "cli"` carrying `method` and `pathTemplate` | Fails to parse: the branch rejects the unrecognized keys | Parse failure |
| Response channel in a command predicate | A `cli` signature whose predicate addresses `response-body` | `condition-response-channel-on-cli`, the mirror that has never existed | Rejected by the gate |
| Text or artifact channel in an api predicate | An `api` signature addressing `stdout`, `stderr`, `exit-code`, or `artifact` | `condition-text-channel-on-api`, widened to the fourth channel | Rejected by the gate |
| Command observable channel | `observableChannel: "artifact"` on a `cli` signature | Accepted: it names what came back | N/A |
| `call-inputs` as observable channel | Either kind | `signature-observable-channel-not-response-side`, unchanged | Rejected by the gate |
| Command signature resolving home operation | A signature whose invocation matches one command operation of a contract | Resolves that operation, and never an api operation, because identities are compared within a kind | N/A |
| Command selector key undeclared | A selector binding an option the operation declares in neither list | `condition-selector-key-undeclared` naming the command channel | Rejected by the gate |
| Command binding filter at score time | A command step's binding against a command observation | Matches on the command channels; a `null` observed channel against a non-null binding fails, as today | N/A |
| Quotation on the artifact channel | A defect finding quoting text from a written report | Witnessed if the text appears in any artifact the cited observation records; the condition cannot name which file, exactly as it cannot for `call-inputs` | Recorded by ingest |

</frozen-after-approval>

## Code Map

**The run record**

- `src/core/schemas/sealed-run-record.ts:171-211` -- `Observation`. `:189` says of `responseBody` that the redundant null branch "is kept so all ten observation fields read the same way", and the count moves to eleven. `:203-204` are `stdout` and `stderr`, bare nullable strings. `:205-210` is `exitCode`, "Signed on purpose, unlike `responseStatus`: a process terminated by a signal is conventionally reported as a negative code, and this field records what was observed rather than what is tidy" -- already written for a command. `:194-197` is `responseStatus`, whose own description says it is "Deliberately not bounded to a protocol range... AD-19 declares four interface kinds and v0 rejects three of them at compile time under `unsupported-interface-kind`, so bounding this to HTTP would encode a protocol assumption the artifact outlives", which this epic proves right.
- `src/core/schemas/sealed-run-record.ts:144-158` -- `ObservedCallInputs`, whose comment says "A flat map would break pointer addressing: AD-26 keys `call-inputs` by transport channel, so a pointer like `/interactions/write/call-inputs/body/title` needs that segment to resolve against." That sentence is the reason the command channels need the same shape.
- `src/core/schemas/sealed-run-record.ts:179-181` -- `operationId`'s description, which already records the cross-artifact rule ingest owns: "`Operation.operationId` is scoped to a `PermittedInterface`, so two interfaces may declare the same one; that collision is a cross-artifact rule with no AD-5 code."
- `src/core/schemas/sealed-run-record.ts:27-35` -- `QuotedEvidence`, carrying a quote and a channel and no location. Story 9.2's Decision 5 settled that it gains no artifact identifier and this story carries that through to `projectChannel`.

**The defect signature**

- `src/core/schemas/defect-signature.ts:133-143` -- `DefectSignature`: `interfaceKind` at `:134-136` with the description that names exactly what this story retires ("the qualification gate rejects every kind but `api`: `Operation` carries no interface kind and requires a method and a path template with no per-kind variation, so a `cli` or `mcp` signature would declare a meaningless `POST /path`"), `method` at `:137`, `pathTemplate` at `:138`, `observableChannel` at `:139-141`, `condition` at `:142`.
- `src/core/schemas/defect-signature.ts:120-132` -- the block comment giving AD-40's reason for method and path template and for parameter erasure. Decision 2 is the command reading of it.
- `src/core/schemas/defect-signature.ts:73-84` -- `ProbeInputBinding`, "The four transport channels, spelled exactly as `InputBinding` and `ObservedCallInputs` spell them. The three shapes agree on channel names, on the four-key strict form, and on flatness, so the selector filters recorded call inputs with no shape to bridge." All three move together in this epic and that agreement is what must be preserved.
- `src/core/schemas/defect-signature.ts:9-30` -- `OBSERVED_STEP_ID`, the reserved word every predicate pointer roots at, and the reasoning for spending one fixed word rather than minting a fourth grammar. Unchanged.
- `src/core/schemas/defect-signature.ts:86-99` -- `ProbeStepSelector`, whose comment records that a pair-defect signature "is a future need `preflight/witness-evidence.ts` already records". Unchanged.
- `src/core/schemas/probe.ts:98-100` -- `defectSignature`'s own description, carrying the probe's 1 → 2 bump note. The 2 → 3 note lands here and in the artifact `.meta` at `:106-110`.

**Qualification**

- `src/core/score/qualification.ts:49-70` -- `QUALIFICATION_FAILURES`, nineteen members. One is added.
- `src/core/score/qualification.ts:718-726` -- the rejection this story retires for `cli` and keeps for `web` and `mcp`.
- `src/core/score/qualification.ts:120-127` -- `RESPONSE_SIDE_CHANNELS`, already carrying `stdout`, `stderr`, and `exit-code`. `artifact` joins it.
- `src/core/score/qualification.ts:129-138` -- `TEXT_CHANNELS` and the comment that is the epic's own thesis in miniature: "The contract side cannot decide this: reachability rejects a tailed `stdout` pointer and returns reachable for a bare one unconditionally, because an operation carries no interface kind. The signature's own declared kind is what makes the rule decidable, so it is spent here rather than left as prose." Story 9.3 gave the contract side the kind, so this comment is corrected here.
- `src/core/score/qualification.ts:270-322` -- `checkOperandsAndCollectChannels`, whose per-kind test at `:311-320` fires `condition-text-channel-on-api`. The mirror goes beside it.
- `src/core/score/qualification.ts:343-388` -- `checkSelectorKeys`, looping `TRANSPORT_CHANNELS` at `:350` and reading `operation.requestShape[channel]` at `:353-354`. Its header at `:334-339` records why the probe side is stricter than the contract side.
- `src/core/score/qualification.ts:387-424` -- `checkObservableChannel` (declared at `:401`), whose second rule at `:415-423` is the declaration-side twin of the pointer rule and needs the same mirror.
- `src/core/score/qualification.ts:437-460` -- `checkChannels`, AD-40's "name the response channel or at least two channels" made decidable. It reads `RESPONSE_SIDE_CHANNELS` only and is kind-neutral once that set carries `artifact`.
- `src/core/score/qualification.ts:104-116` -- `resolveHomeOperation`, comparing through `operationSignature`. Story 9.3 gave that function a command counterpart; this is where the signature side consumes it.
- `src/core/score/qualification.ts:725-732` -- the call sequence inside `qualifyProbe`, and `:734-738` the returned `declarationChecksRan`, whose meaning ("an admission granted without an operation inventory skipped the three checks that read declared shapes") is unchanged.

**Score-side sites that loop the HTTP transport channels**

- `src/core/score/witness.ts:133-158` -- `selectorAdmits`, looping `TRANSPORT_CHANNELS` at `:138`, reading `observation.callInputs[channel]` at `:140` and `operation.requestShape[channel].types[key]` at `:153`.
- `src/core/score/bindings.ts:280-317` -- `satisfiesBindings`, looping at `:287`, reading `observation.callInputs[channel]` at `:290` and `operation?.requestShape[channel].types[key]` at `:313`.
- `src/core/score/bindings.ts` -- `bindingSiteKey`, which keys a resolution by `(stepId, channel, key)` and needs no change beyond the widened channel type.
- `src/core/evaluate/evidence-resolution.ts:95-105` -- `channelRoot`'s `call-inputs` case, reading `observation.callInputs[transportChannel]`, and the `artifact` case Story 9.2 left returning `null`.
- `src/core/score/quotation.ts:59-87` -- `projectChannel`, whose `artifact` case Story 9.2 added and this story gives a real value.

**Things verified kind-neutral rather than assumed**

- `src/core/score/outcome.ts` -- `resolveOutcome` and `INVALIDATING_CONDITIONS`. The procedure reads findings, dispositions, the match result, selection, check resolution, probe class, `expectedClean`, waiver state, judge conduct, and the evaluation-fault signal, and none of the ten is a transport field. Confirm by reading before writing this claim down.
- `src/core/score/reduce-trials.ts` and `src/core/score/strength.ts` -- AD-7's reducer and rate vector, over outcome states and probe classes.
- `src/core/score/ladder.ts` -- both AD-21 ladders, over assessment inputs.
- `src/core/ingest/ingest.ts` and `conditions.ts` -- the eleven ingest conditions, over identifiers, digests, allowlists, and citations.

**Tests**

- `tests/schemas/fixtures/artifact-fixtures.ts:139` `sealedRunRecordFixture` at `schemaVersion: 3` (`:144`), and `:431`/`:459` the two probe fixtures at `schemaVersion: 2`. The file's own convention is that each fixture is "the only place a ... version number is written down, which is what makes each bump visible".
- `tests/score/qualification.test.ts` -- the gate's own suite, which needs a command case per rule.
- AD-13's four checks and the five census literals, as in every schema story of this epic.

## Tasks & Acceptance

**Execution:**

- [ ] `src/core/schemas/sealed-run-record.ts` -- add `artifacts` to `Observation`: an array of records, each carrying an `Identifier` matching the operation's declared artifact, a `Digest` of the file's bytes, and the observed body as the value container, so a pointer into it resolves the way `responseBody` does. `null` is the "no artifacts observed" spelling and `[]` is "observed none", on `collectionLocations`' own three-answer reasoning (`interface.ts:64-69`). Update `:189`'s field count.
- [ ] `src/core/schemas/sealed-run-record.ts` -- `ObservedCallInputs` becomes a union of the shipped four-key HTTP shape and a four-key command shape over `COMMAND_CHANNELS`, structural rather than discriminated, for the reason Story 9.1's Decision 5 gives.
- [ ] `src/core/schemas/sealed-run-record.ts` -- record the 3 → 4 BREAKING bump on `Observation.artifacts`' own `.describe()` and restate it in the artifact `.meta`.
- [ ] `src/core/schemas/defect-signature.ts` -- `DefectSignature` becomes a union discriminated on `interfaceKind` with four members: `api`, `web`, and `mcp` carrying `method` and `pathTemplate` unchanged, and `cli` carrying the invocation. `ProbeInputBinding` becomes a union on `ObservedCallInputs`' terms, preserving the three-shape agreement `:73-78` states.
- [ ] `src/core/schemas/probe.ts` -- record the 2 → 3 BREAKING bump on `defectSignature`'s `.describe()` and in the artifact `.meta`.
- [ ] `src/core/evaluate/evidence-resolution.ts` -- `channelRoot`'s `artifact` case resolves the target's `artifactId` against the observation's artifact list and returns that artifact's body, or `null` when no artifact matches, so a miss is `absent` rather than a throw.
- [ ] `src/core/score/quotation.ts` -- `projectChannel`'s `artifact` case serializes every recorded artifact's body, per Story 9.2's Decision 5.
- [ ] `src/core/score/qualification.ts` -- add `condition-response-channel-on-cli` to `QUALIFICATION_FAILURES`; add `artifact` to `RESPONSE_SIDE_CHANNELS`; add the api-illegal `artifact` case to `TEXT_CHANNELS`; add the mirror rule beside `:311-320` and beside `:415-423`; narrow `:718-726` to `web` and `mcp`; branch `checkSelectorKeys`' channel loop; route `resolveHomeOperation` through the per-kind identity.
- [ ] `src/core/score/qualification.ts:129-133` -- correct the comment that says the contract side cannot decide the channel rule, naming what Story 9.3 built.
- [ ] `src/core/score/witness.ts` and `src/core/score/bindings.ts` -- branch the two selector loops on the operation's kind.
- [ ] `tests/schemas/fixtures/artifact-fixtures.ts` -- move the three version literals; add a command observation and a command signature fixture.
- [ ] `npm run generate:schemas` -- regenerate `sealed-run-record.schema.json` and `probe.schema.json`; update the five census literals.
- [ ] `tests/schemas/fixtures/artifact-reject-cases.ts` -- one single-mutation reject fixture per new published constraint, per AD-13 and AD-30.
- [ ] `tests/score/qualification.test.ts`, `tests/score/witness.test.ts`, `tests/evaluate/`, `tests/score/quotation.test.ts` -- one case per I/O Matrix row.
- [ ] `_bmad-output/project-knowledge/learning-path-step-by-step.md` -- add this story's step per `learning-path-template.md`.

**Acceptance Criteria:**

- Given an observation recording two written artifacts, when a pointer addresses one of them by identifier and walks a tail into it, then it resolves the declared value; and given a pointer naming an artifact the observation does not record, then it resolves `absent`, so Story 9.2's deferred window is closed in both directions.
- Given a `cli` defect signature whose invocation matches one command operation of a compiled command contract, when `resolveHomeOperation` runs, then it returns that operation, and given the same invocation against a contract declaring only api operations, then it returns `null`, so identities never cross kinds.
- Given a `cli` signature carrying a `method`, when it parses, then it fails; and given an `api` signature carrying an invocation, then it fails, so neither identity is reachable on the wrong branch.
- Given a `cli` signature whose predicate addresses `response-body`, when it qualifies, then `condition-response-channel-on-cli` fires; and given an `api` signature whose predicate addresses `artifact`, then `condition-text-channel-on-api` fires, so the rule is symmetric where it was one-directional.
- Given a `web` or `mcp` signature, when it qualifies, then `signature-interface-kind-unsupported` still fires, so the code narrows rather than disappearing.
- Given a command probe, a command contract, and a record of a command run, when the witness match runs, then it produces one of AD-40's five results from the command evidence, which is the first time a non-api probe can resolve an AD-6 outcome state at all.
- Given every existing api fixture and the worked chain, when the whole suite runs, then every outcome, every verdict, and every emitted byte is unchanged apart from the two version stamps, so the widening is provably additive on the api path.
- Given the regenerated `sealed-run-record.schema.json` and `probe.schema.json`, when AD-13's four checks run, then all four pass and every new published keyword has a fixture that kills it under mutation.
- Given `npm run test:coverage`, when it runs, then `src/core/**` is at or above 90% statements and 90% branches.
- Given `npm run validate`, when it runs, then it exits 0 with nothing on stderr.

## Decisions settled by construction

**Decision 1: an artifact record carries an identifier, a digest, and the observed body, and never the file's bytes as a blob.**
Three things decide the shape. AD-18 forbids the package's artifacts from carrying credentials or subject data and says "where evidence must refer to them it stores a digest or an opaque reference resolved through AD-8's manifest", and a command's written report is exactly the kind of file that may carry either. AD-36 restricts the value domain to what both sides can canonicalize, so a body is the value container and not a byte string of unknown encoding. And AD-26 requires the channel to be addressable: a pointer tail has to walk into something, which is why the body is a value rather than a digest alone. The digest is carried beside the body rather than instead of it because AD-32's trust boundary makes the caller "a possibly-buggy integration", and a body with no digest cannot be checked against the file it claims to be. Downstream consequence: Story 9.5's corpus records artifact digests computed from the authored bodies, and the private-artifact-manifest recomputation `deferred-work.md` already tracks gains a second kind of subject.

**Decision 2: the command defect signature resolves on the invocation alone, and the settled design's "operation identifier and invocation" is corrected here rather than built.**
The design this epic was written from named "the operation identifier and invocation" as the command signature's resolution key. The source rules that out in the same words AD-40 uses. `defect-signature.ts:124-128`: "Method and path template rather than an operation identifier, because AD-19 declares both per operation and both are contract-independent: an identifier is contract-local and would bind nothing against a second contract." AD-40 states the general form: the signature's author "must never see the contract, so the required vocabulary consisted of identifiers its required author is forbidden to know... a signature rooted in one contract's `write` and `read-back` resolves nothing against another's `update-note` and `verify-note`." An `operationId` is precisely such an identifier. Including it would either make the resolution contract-local, which reintroduces the defect AD-40 withdrew, or make it decorative, which is worse because a decorative field on a sealed-corpus artifact invites an author to rely on it. So the command signature carries the invocation and nothing else as its identity, and Story 9.1's `CommandInvocation` was shaped as an `Identifier` executable plus an `Identifier` subcommand path exactly so it can play that role. Known-bad state avoided: a corpus signature that binds against the contract it was authored beside and against no other, with the catch rate reading 1.00 on the first and 0.00 on the second.

**Decision 3: the erasure has no command counterpart and identities are compared within a kind.**
Story 9.1's Decision 3 settled that a subcommand path carries no parameters, so nothing is erased before comparing. This story adds the second half: an api identity and a command identity are never compared with each other, even if their rendered forms could be made to collide. `checkDuplicateOperationSignature` keys per kind (Story 9.3) and `resolveHomeOperation` filters to the signature's own kind before comparing. Without that filter, a command signature whose rendered identity happened to equal an HTTP one would resolve an api operation, and the selector would then be checked against a request shape from the wrong kind, producing `condition-selector-key-undeclared` on a perfectly good signature. Downstream consequence: `AD-5`'s `duplicate-operation-signature` becomes a within-kind rule, which Story 9.3's row widening already states.

**Decision 4: the probe-side mirror is a `QUALIFICATION_FAILURES` member, not an AD-5 code, and it fires on both the pointer walk and the declared channel.**
`qualification.ts:6-9` states the boundary: "The failure vocabulary is closed and separate from AD-5's, because AD-5 is compile-time over contracts and `compile` never sees a probe." So `condition-response-channel-on-cli` joins the closed nineteen and the spine's registry table is untouched. It fires in both places its api twin does, because `checkObservableChannel`'s second rule at `:415-423` exists for a reason its own comment gives: "leaving it unchecked would make an unchecked field load-bearing", and a `cli` signature declaring `observableChannel: "response-status"` is the same unchecked field one kind over. The name mirrors `condition-text-channel-on-api` rather than generalising both into one kind-parameterised code, because `qualification.ts`'s vocabulary is a flat closed list a caller routes to a rung, and a code whose meaning depends on a field the caller has to read separately is harder to route than two codes. Downstream consequence: the closed vocabulary moves from nineteen to twenty, which Story 9.5 discloses alongside the AD-5 registry's move.

**Decision 5: a command observation whose call inputs are HTTP-shaped is an ingest condition, not a parse failure.**
`ObservedCallInputs` becomes a structural union, so an observation may carry either shape and the schema cannot see which kind its `operationId` belongs to; that is the same cross-subtree limit Story 9.1's Decision 5 settled for `InputBinding`, and here it lands on the caller's own record. AD-32 decides the disposition: the package "verifies everything internally verifiable... schema validity, cross-artifact agreement, recomputed digests, lineage consistency, and declared-versus-observed consistency, each failing loudly and invalidating rather than degrading a verdict." An observation whose recorded channels do not match its operation's declared kind is declared-versus-observed inconsistency, which is `ingest`'s. This story does not add that condition, and says so plainly rather than implying the check exists: it is recorded in `deferred-work.md` with `ingest` named as the owner, joining the `operationId` collision rule that `sealed-run-record.ts:179-181` already routes there. Known-bad state avoided: a silently passing run where every command binding filter returned false because the record used the wrong channel names, reported as a probe that was never triggered.

**Decision 6: the outcome procedure, the reducer, the rate vector, and both ladders are kind-neutral, and that is checked before it is claimed.**
`resolveOutcome`'s declared inputs under AD-33 are ingested findings, per-oracle disposition, the AD-40 match result, the selection result, AD-4's three-valued check resolution, probe class, `expectedClean`, waiver state, AD-17's judge-conduct state, and AD-26's evaluation-fault signal. Not one is a transport field, and the same holds of AD-7's reducer, which counts outcome states per probe class, and of both AD-21 ladders, which read assessment inputs. This story therefore touches none of the four, and the acceptance criterion about unchanged api outputs is what proves the claim rather than asserting it. It is written down because "kind-neutral" is the sort of claim that is cheap to make and expensive to be wrong about, and because a reader looking for the command branch in `outcome.ts` should find this sentence instead of concluding it was forgotten.

**Decision 7: `responseStatus`, `stdout`, `stderr`, and `exitCode` all stay on one flat observation rather than moving onto a per-kind branch.**
`Observation` could have become a union on kind, with the api branch carrying the three response fields and the command branch carrying the streams and the exit code. It is turned down. An observation carries no interface kind and cannot be given one without duplicating a fact the contract already holds, which is the same argument Story 9.1's Decision 5 made against putting a kind on an interaction step. `channelRoot` (`evidence-resolution.ts:82-106`) reads the fields by channel and its switch is total over the vocabulary rather than over a kind, so a union would put a discriminator check in front of a switch that does not need one. And `responseStatus`' own description already anticipated this: it is "deliberately not bounded to a protocol range" precisely so the artifact outlives a protocol assumption. The cost is that a command observation carries three `null` response fields and an api observation carries four `null` command fields, which is exactly what the shipped record already does with `stdout`, `stderr`, and `exitCode` today. Downstream consequence: the "all eleven observation fields read the same way" convention at `:189` survives, and the `null`-vs-absent ambiguity that comment records for `responseBody` extends to the artifact list on the same accepted terms.

## Design Notes

The organising idea is that AD-40's detection mechanism was already written to be kind-independent and had one contract-local dependency left in it. The signature's predicate roots at a reserved word, its selector duplicates AD-39's grammar rather than borrowing the contract's, and its channel rules read a closed vocabulary. Only the identity was HTTP, and only because AD-19 had nothing else to offer. Story 9.1 gave it something else; this story spends it.

The shape, for orientation only:

```ts
export const ObservedArtifact = z.strictObject({
	artifactId: Identifier, // the operation's own declared artifact
	digest: Digest, // AD-32: a body with no digest cannot be checked
	body: JsonValue.nullable(), // AD-26: a pointer tail has to walk into something
})

export const DefectSignature = z.discriminatedUnion('interfaceKind', [
	/* api */ httpSignature('api'),
	/* web */ httpSignature('web'),
	/* mcp */ httpSignature('mcp'),
	/* cli */ z.strictObject({
		interfaceKind: z.literal('cli'),
		invocation: CommandInvocation, // AD-40: contract-independent, no operationId
		observableChannel: EvidenceChannel,
		condition: DiscriminatingCondition,
	}),
])
```

## Verification

**Commands:**

- `npm run typecheck` -- expected: exit 0.
- `npx vitest run tests/score tests/evaluate` -- expected: green, one case per I/O Matrix row.
- `npx vitest run tests/schemas` -- expected: green with the two version stamps moved.
- `npm run generate:schemas && npm run check:schemas` -- expected: exit 0 after regeneration.
- `npm run check:ad33-table` -- expected: exit 0 with no regeneration, proving the outcome procedure did not move.
- `npm run check:ad21-table` -- expected: exit 0 with no regeneration, proving no ladder row moved.
- `npm run check:worked-example` -- expected: exit 0 after the record's stamp moves, with the stamp as the only difference.
- `npm run test:coverage` -- expected: exit 0 with `src/core/**` at or above 90/90.
- `npm run validate` -- expected: exit 0 with no output on stderr.

## Built, and where it diverged

`ObservedCallInputs` is one eight-key object rather than a union, which is the opposite of the choice
`InputBinding` makes on the contract side, and the difference is that "unused" already has a spelling
here. A declaration cannot tell an unused channel from an empty one, so those two spellings had to
stay apart; an observation writes `null` for every channel the run did not use, so one object is
unambiguous and makes `callInputs[channel]` total for every channel name a pointer can carry.
`ProbeInputBinding` follows it for the same reason.

**`stdout` and `stderr` are tagged rather than bare strings.** Without that, a command contract
compiled with a tailed `stdout` oracle and then resolved `ABSENT` at score time, because the record
carried a string and a tail over a string resolves absent. The three arms are the observed body's,
so a harness that captured JSON records it as JSON and the tail walks into it.

**`DefectSignature` is a plain union, not a discriminated one.** The discriminator would have to be
`interfaceKind`, and the api-shaped branch carries three values for it; three identical branches
would also make AD-13's mutation sweep unable to attribute a keyword deletion to any one of them.

**`Observation.principal` landed here**, closing owed item 3's other half rather than leaving it in
the deferred register: a `{ principal }` binding is presence-only by construction, so the two
critical-severity cross-user behaviours were expressible and unscoreable without it.
