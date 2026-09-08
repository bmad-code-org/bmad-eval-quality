---
title: 'Compile and pre-flight admit a command interface'
type: 'feature'
created: '2026-09-07'
status: 'done'
review_loop_iteration: 0
context:
  - _bmad-output/implementation-artifacts/epic-9-context.md
  - _bmad-output/implementation-artifacts/9-1-the-interface-kind-shaped-operation.md
  - _bmad-output/implementation-artifacts/9-2-the-channel-vocabulary-and-the-pointer-grammar.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A command contract now parses and its pointers are addressable, and it still cannot compile. `checkInterfaceKind` throws on every kind but `api` (`src/core/compile/interface-inventory.ts:12-22`) and `planPreflight` asserts the same thing again (`src/core/preflight/plan.ts:239-250`). Behind those two gates, twenty call sites read a field a command operation does not carry, and two more render a command operation to a sealed evaluator as an HTTP endpoint. `PlanIndex.operationOf` (`src/core/seal/plan-index.ts:136`) still returns only the api-shaped `Operation`, so nothing downstream of it can even see a command operation. And the port a pre-flight probe travels through is HTTP-shaped to the bone: `ProbeRequest` declares `method` and `pathTemplate` (`src/core/schemas/port-messages.ts:73-74`) and `ProbeObservation` declares `status: z.int().min(100).max(599)` (`:102`), which no command can produce.

**Approach (CORRECTED):** Do **not** widen `PlanIndex.operationOf`. That sentence, as this story originally opened, is the sixty-four-error failure this epic already had once and had to revert. `operationOf` hands a resolved `Operation` to every downstream consumer, so widening its return type retypes seventeen files in one commit before any of them has a branch to take. Story 9.1 shipped `interfaceKindOf` and `commandOperationOf` beside it instead, plus `anyOperationOf` for the callers that read only kind-neutral fields, and every call site that had to branch was converted one at a time behind those. `operationOf` still returns an api-shaped operation and should keep doing so; a command operation resolves to `undefined` from it, which is a truthful answer to the question that accessor asks. Then work the list. Every site that reads a resolved operation is classified against the source as kind-neutral or needing a branch, and each is treated accordingly rather than defensively. `seal` learns that a command is not an endpoint. The environment-probe port's two messages become discriminated unions and the published conformance suite gains the command cases. `checkInterfaceKind` and `planPreflight` then admit `cli` and keep rejecting `web` and `mcp`, AD-5's `unsupported-interface-kind` row narrows to name two kinds, and `duplicate-operation-signature` and `captured-channel-undeclared` each widen to cover the command shape.

## Boundaries & Constraints

**Always:**

- Every classification is read from source before it is written down. `epic-9-context.md` requires this and the reason is `epic-8-context.md`'s own posture: a confident wrong claim about kind-neutrality is worse than a gap, because the branch that is not written is the one nothing will ever notice.
- `unsupported-interface-kind` keeps two firing conditions and a fixture for each. AD-10's rule stays true for `web` and `mcp`: "v0 supports `api` and fails compilation honestly under `unsupported-interface-kind` for `web`, `cli`, and `mcp` rather than leaving three kinds to implementer invention." This story removes one name from that list and the AD-5 registry row moves with the code, in the same diff, so `check:ad5-registry` and `lint:spine` stay green.
- No AD-5 code is minted here. Story 9.2 minted the two this epic needs; this story widens two existing rows and narrows one.
- AD-35 governs the port as strictly as it governs the contract: "a contract names logical interface identifiers only and never a URL, host, or port... An adapter denies by default and permits only what that mapping names." A command probe request carries the logical executable and the caller's mapping resolves it, so no contract and no port message ever carries a filesystem path.
- AD-37 binds the conformance suite: "A conforming adapter is defined by an executable suite, not by prose." A widened port contract with no widened suite is prose.
- `test:coverage` holds `src/core/**` at 90% statements and 90% branches. Every new branch this story adds is counted.
- No source comment may contain any of `check:boundary`'s twelve forbidden strings.

**Ask First:**

- Any `schemaVersion` move. This story moves none: the eval contract's two bumps are Stories 9.1 and 9.2, and the run record's and the probe's are Story 9.4. The port messages carry no `schemaVersion`, which Decision 7 records.
- Adding a coverage discipline rule, or changing `DISCIPLINE_RULES` (`src/core/coverage/rules.ts:7-14`). The seven are closed by AD-20 and both predicate tables are mapped types over them.
- Changing `Observation`, `ObservedCallInputs`, `DefectSignature`, or `QUALIFICATION_FAILURES`. Those are Story 9.4's.

**Never:**

- No new interface kind. `web` and `mcp` gain nothing here.
- No branch that guesses. A site whose behaviour on a command operation is undecided is settled in this story's decisions with its reasoning, never left to a `?? []` that makes a predicate silently vacuous.
- No spine amendment beyond AD-5's three registry rows, and no new ADR.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Command contract, clean | A `cli` contract whose oracles address command channels and whose steps bind command channels | Compiles; `compile` returns the contract | N/A |
| `web` interface | Today's shape under `kind: "web"` | `unsupported-interface-kind` with the kind named in the detail | Structural failure |
| `mcp` interface | Same under `kind: "mcp"` | Same | Structural failure |
| Two command operations, one invocation | Two `cli` operations sharing an executable and a subcommand path | `duplicate-operation-signature`, naming both operation ids and the shared identity | Structural failure |
| Command and api operations colliding | A command identity and an HTTP identity that render to the same string | No collision: the two identities are compared within their own kind and the rendered forms are disjoint by construction | N/A |
| Captured binding on a command step | A step capturing from an earlier command step's stdout | Compiles, if the captured pointer names a declared scalar; `captured-channel-undeclared` otherwise | Structural failure |
| Captured binding, response body on a command step | A `cli` step capturing `/interactions/x/response-body/id` | `evidence-channel-kind-mismatch` fires first, from Story 9.2's earlier registry position | Structural failure |
| Sealed brief over a command contract | `seal` over a compiled command contract | A direction naming "the review command" rather than "the review endpoint", and binding clauses that name the command channels the step binds | N/A |
| Brief scripting audit | The same brief | `brief-exceeds-scripting-bound` fires on the same declared bound as today; no new bound is minted | Structural failure when exceeded |
| Pre-flight plan over a command contract | A `cli` contract with sensitivity witnesses | A plan of command probe requests, each carrying the logical invocation and its command channels | N/A |
| Pre-flight over a `web` contract | Any | `unsupported-interface-kind`, unchanged | Structural failure |
| Conformance suite, command case | A caller's `EnvironmentProbePort` implementation | The suite exercises both request shapes and both observation shapes and reports per-case | Suite failure, reported |
| Coverage over a command contract | A compiled command contract | Each of the seven rules is relevant or not by the same AD-20 reading, computed from the command declarations | N/A |
| Coverage rule with no command reading | A rule whose relevance predicate reads only an HTTP declaration | The rule is irrelevant, recorded with the same `NO_OPERATION`-style reason the shipped predicates already use, never silently satisfied | N/A |

</frozen-after-approval>

## Code Map

Every verdict below was read from the file named. A site marked kind-neutral was checked against what it reads, not against what it is called.

**The index everything resolves through**

- `src/core/seal/plan-index.ts:134-138` -- `PlanIndex`. `operationOf` stays narrow; `interfaceKindOf`, `commandOperationOf`, and the free `anyOperationOf` arrived in Story 9.1 and are what a kind-aware caller reads. `:177-196` is where `buildPlanIndex` fills the three maps, including the duplicate-id handling that `:144-149` explains, which now removes an ambiguous id from all three together.
- `src/core/seal/plan-index.ts:221-233` -- `resolveOperation`, which throws a `TypeError` on a miss. It stays narrow with `operationOf`; a caller that needs either kind reads `anyOperationOf` and handles the miss itself, which is what `compile/bindings.ts` now does.

**Compile: needs a branch**

- `src/core/compile/interface-inventory.ts:12-22` -- `checkInterfaceKind`. The rejection at `:14` becomes a set membership over the unsupported kinds, and the detail at `:18` names the two that remain.
- `src/core/compile/interface-inventory.ts:36-41,44-60` -- `operationSignature` and `checkDuplicateOperationSignature`. `operationSignature` takes `{ method, pathTemplate }` deliberately, "since AD-40's corpus-side signature declares the same pair and must produce the same string from it or the comparison is not a comparison" (`:32-35`). A command counterpart joins the executable and subcommand path with one separator declared once, and `checkDuplicateOperationSignature` keys per kind so the two rendered forms never collide across kinds.
- `src/core/compile/interface-inventory.ts:77-115` -- `checkUndeclaredMandatoryInput`, looping `TRANSPORT_CHANNELS` at `:87` against `operation.requestShape[channel]` at `:90`. Strict-mode only (`compile.ts:92-93`). Branches on kind to loop the right channel tuple.
- `src/core/compile/reachability.ts:250-351` -- `evaluateReachabilityAgainstOperation`. `:257-266` is the `stdout`/`stderr` tail rule, which today rejects a tail on a bare string; under a declared stdout structure it must consult the output descriptor instead. `:268-313` is the `response-body` branch reading `operation.responseDescriptor` at `:277-278`. `:315-346` is the `call-inputs` branch reading `operation.requestShape[transportChannel]` at `:330-331`. `:348-350` returns reachable for the three shapeless channels. The whole function branches on kind, and Story 9.1's blanket deferral and Story 9.2's narrowed one both come out here.
- `src/core/compile/bindings.ts:65-84` -- `capturedBindings`, looping `TRANSPORT_CHANNELS` at `:69`.
- `src/core/compile/bindings.ts:49,216-227` -- `CAPTURABLE_CHANNEL` and `checkCapturedChannel`. The constant is `'response-body'` and `:38-48` gives the reason: it is "the one channel it declares", every `ResponseDescriptor` field being about the body. That reason is kind-relative and Decision 4 settles the command counterpart.
- `src/core/compile/bindings.ts:246-277,287-313` -- `capturedType` reading `operation.responseDescriptor.types[key]` at `:265`, and `boundParameterType` reading `operation.requestShape[capture.transportChannel]` at `:294`.
- `src/core/compile/expression-legality.ts:550-566` -- `checkQuantifiersAgainst`, which returns at `:557` unless the channel is `response-body` and reads `operation.responseDescriptor.types[firstToken]` at `:564`. `:557` is a silent skip today, so a quantifier over a `stdout` pointer is already unchecked.
- `src/core/compile/expression-legality.ts:246-273` -- `checkOperandAtPosition`, whose second rule tests `parseEvidenceTarget(operand.pointer).channel === 'call-inputs'` at `:266`. It tests the channel root only, never a segment, so it stays correct unchanged under Story 9.2's shared `call-inputs` branch. Verified rather than assumed.
- `src/core/compile/sensitivity-witness.ts:38-48,76-105,133-157,191-209` -- `suppliedKeys` (whose signature parameter is `TransportChannelName` at `:41` and whose `:42` special-cases `body`), `checkInputsAgainstShape` (looping `TRANSPORT_CHANNELS` at `:82`), `checkSensitivityWitnessDeclared`, and `legalChannels` at `:192`, which is `operation.stateChangeMarker ? ['body'] : ['path', 'query']`. AD-10's own sentence is "a path or query parameter where the marker is false, a body where it is true", and Decision 5 settles the command reading.
- `src/core/declared-inputs.ts:16-31` -- `declaresNoRequestKeys` and its sibling, both looping `TRANSPORT_CHANNELS` at `:17` and `:29`. AD-10's exemption for an operation declaring no inputs reads through here.

**Compile: kind-neutral, verified**

- `src/core/compile/scripting-bound.ts:36-46,161-181` -- `checkNestedTemporalClause` and `checkScriptingBound`. The graph predicate reads step ids and `after` edges and never dereferences an operation at all: `planIndexOf` (`:25-31`) is built but only `stepOf` is called, at `:22`. `computeGraphMetrics` (`:87-158`) uses array positions, parent edges, child counts, undirected components, and `plan.length`. The four bounds at `:62-65` are policy calibrated against two api fixtures, and Decision 6 settles whether they carry over.
- `src/core/compile/oracle-alignment.ts:10-26,28-47,92-120` -- all three exports. `collectTargets` (`:49-86`) treats every operand pointer as an opaque string and never calls `parseEvidenceTarget`, so a `stdout`-rooted evidence target aligns by the same containment rule a `response-body` one does.
- `src/core/compile/forbidden-inputs.ts:7-26,28-47` -- both exports. `FORBIDDEN_INPUT_FLOOR`'s seven members (`src/core/schemas/eval-contract.ts:85-93`) are evidence-provenance names with no transport content.
- `src/core/compile/expression-legality.ts:54-141,294-311,313-337,439-457,459-481,635-661` -- `walkExpression`, `checkExpressionRegexConstructs`, `checkExpressionQuantifierNesting`, `checkRegexConstructs`, `checkQuantifierNesting`, and `checkReferenceSetResolution`. None reads an operation.
- `src/core/compile/sensitivity-witness.ts:287-336` -- `checkWitnessLegIdentifiers`, and its helper `addressedStepIds` (`:159-188`), which reads only `parseEvidenceTarget(pointer).stepId` at `:168`.
- `src/core/compile/declarations.ts` -- `checkRequirementLinkage` and `checkObservableSuccessCriterion`, both over behaviour fields.
- `src/core/compile/waivers.ts` -- `checkWaiverCompleteness`, over waiver fields.
- `src/core/compile/rubrics.ts` -- the four rubric checks. `checkRubricEvidenceReachability` routes through `evaluatePointerReachability` and inherits its branch rather than needing one; `:233-234`'s comment is corrected in Story 9.2.

**Coverage: the seven relevance predicates**

- `src/core/coverage/relevance.ts:42-43` -- `operationsOf`, which flattens `contract.permittedInterfaces.flatMap((declared) => declared.operations)` and never reads `declared.kind`. Every predicate ranges over both kinds indiscriminately today; this helper is where the kind becomes available, and every branch below reads it from here.
- `:55` `successIndicatorSeparationRelevance` -- **needs a branch**, `:62` reads `operation.responseDescriptor` for `successIndicator` and `channelRoles`.
- `:103` `wholeBodyRelevance` -- **needs a branch**, `:108` reads `responseDescriptor.requiredKeys`.
- `:131` `malformedInputRelevance` -- **needs a branch**, `:138-139` loops `TRANSPORT_CHANNELS` against `operation.requestShape[channel]`.
- `:166` `perRecordRelevance` -- **needs a branch**, `:171` reads `responseDescriptor.collectionLocations`.
- `:199` `siblingCrossCheckRelevance` -- **kind-neutral**, reads `contract.siblingGroups` only at `:203,207,214`, over operation ids and parameter key names.
- `:233` `omissionAndCompletenessRelevance` -- **needs a branch**, `:240` reads `responseDescriptor.collectionLocations` and `:249` `location.referenceSet`.
- `:270` `stateChangeReadBackRelevance` -- **kind-neutral**, `:277` reads `operation.stateChangeMarker`, a required boolean on both operation shapes.
- `:294` `RELEVANCE_PREDICATES` and `:309` `evaluateRelevance` -- kind-neutral dispatch.

**Coverage: the seven satisfaction predicates**

The three private pointer builders are where every HTTP spelling in this file is made: `bodyPointer` (`:81-82`, literal `/response-body`), `keyPointer` (`:85-86`, literal `/response-body/`), and `parameterPointer` (`:89-94`, `/call-inputs/${channel}` over `TRANSPORT_CHANNELS`). `stepRoot` (`:78`) is kind-neutral.

- `:231` `successIndicatorSeparationSatisfaction` -- **needs a branch**, `:240` descriptor, `:272,274` `bodyPointer`.
- `:301` `wholeBodySatisfaction` -- **needs a branch**, `:310` `requiredKeys`, `:318` `keyPointer`.
- `:366` `malformedInputSatisfaction` -- **needs a branch** in both halves, `:341-342` and `:352-353` loop `TRANSPORT_CHANNELS`; its oracle half at `:384` uses `stepRoot` and is neutral.
- `:410` `perRecordSatisfaction` -- **needs a branch**, `:419` `collectionLocations`, `:431` `bodyPointer`.
- `:461` `siblingCrossCheckSatisfaction` -- **half and half**. The operation-group half (`:476-494`) uses `stepRoot` at `:484` and is neutral; the parameter-group half (`:495-518`) loops `TRANSPORT_CHANNELS` at `:502` and builds `parameterPointer` at `:504-508`.
- `:566` `omissionAndCompletenessSatisfaction` -- **needs a branch**, `:575` `collectionLocations`, `:589` `bodyPointer`, and its `reconciles` helper at `:539-560` reads `location.expectedCardinality.mode`.
- `:646` `stateChangeReadBackSatisfaction` -- **needs a branch** in its witness test only. The site selector at `:655` reads `stateChangeMarker` and `readBackStepsFor` (`:615-624`) reads `step.after` and the marker, both neutral; `relates` at `:634-635` builds `${stepRoot(write)}/call-inputs` and `${stepRoot(read)}/response-body` and is HTTP-only.
- `:689` `SATISFACTION_PREDICATES` and `:705` `evaluateSatisfaction` -- kind-neutral dispatch.
- `src/core/coverage/coverage.ts:24-31,33-49` -- both exports kind-neutral in themselves; `:40-43` carries a live assertion that "`!relevant.relevant` is unfalsifiable today: a rule relevant for no site answers satisfied vacuously". Decision 3 is about keeping that true.
- `src/core/coverage/rules.ts:7-14` -- `DISCIPLINE_RULES`, closed at seven, with both predicate tables mapped over it. Two of the seven names are HTTP-shaped in wording only (`'whole-body'` at `:9`, `'per-record'` at `:11`).

**Seal**

- `src/core/seal/derived-reference.ts:59-61` -- `operationReference` returns `` `the ${operation.operationId.split('-').join(' ')} endpoint` ``. Every command operation is described to a sealed evaluator as an endpoint. `:55-58` records why method and path template are never printed: "AD-16 withholds the operation inventory from the brief", which is unchanged and applies equally to an invocation.
- `src/core/seal/derived-reference.ts:83-88,93-105` -- `TRANSPORT_ORDER`, a hardcoded four-member HTTP list, and `bindingEntries`, which iterates it against `step.inputBinding[transportChannel]`. A command step's bindings render as nothing, so the escalation ladder at `:65-75` has no entries to escalate and two command steps on one operation collapse to the same phrase, which reaches `renderStepReference`'s tie throw that `deferred-work.md` already records as a bare `TypeError`.
- `src/core/seal/derived-reference.ts:110-112` -- `entryName`, which prefixes the transport channel so `path.id` and `query.id` do not both render as "the supplied id". The same argument holds for `argument.file` and `option.file`.

**Pre-flight and the port**

- `src/core/preflight/plan.ts:239-250` -- the second kind assertion, whose comment says "Already thrown at compile; asserted again because the plan is reachable from a caller who assembled a contract by hand."
- `src/core/preflight/plan.ts:88-108` -- `requestOf`, which builds a `ProbeRequest` from `operation.method` at `:96`, `operation.pathTemplate` at `:97`, and the four HTTP channels at `:98-`.
- `src/core/schemas/port-messages.ts:67-85` -- `ProbeRequest`, with `method` at `:73`, `pathTemplate` at `:74`, and `channels` at `:75-84`. `:57-66` is the AD-35 and AD-18 note that carries onto the command branch verbatim.
- `src/core/schemas/port-messages.ts:98-109` -- `ProbeObservation`, with `status: z.int().min(100).max(599)` at `:102`, an HTTP header map at `:103-107`, and `body` at `:108`. A command produces an exit code, two streams, and files, and none of the four fields can carry them.
- `src/core/preflight/witness-evidence.ts:78-91` -- the observation projection, which hardcodes `stdout: null`, `stderr: null`, and `exitCode: null` at `:88-90`. For a command probe those three are the whole observation.
- `src/core/preflight/witness-evidence.ts:116-129` -- `makeWitnessPointerDenotesCollection`, reading `operation.responseDescriptor` at `:119` and returning false unless the channel is `response-body` at `:123`.
- `src/ports/environment-probe-port.ts` and `src/testing/probe-conformance.ts` -- the port contract and AD-37's published suite. No adapter in `src/adapters/` implements this port: the directory holds the corpus, file-system, and clock adapters only, and `TEST-PLAN-NEXT-STEPS.md:332-341` records an environment-probe adapter as work after v0. So the widened contract breaks the published conformance suite's shape and no shipped adapter.
- `src/core/preflight/reduce.ts:179` -- the exemption message "The operation declares no inputs in any channel.", which reads through `declaresNoRequestKeys` and stays true once that function knows both channel tuples.

**AD-5 registry rows this story edits**

- `unsupported-interface-kind` -- "a declared interface kind is `web`, `cli`, or `mcp`" becomes the two remaining kinds.
- `duplicate-operation-signature` -- "two declared operations share a method and path template after parameter-name erasure" widens to the per-kind transport identity, on `undeclared-mandatory-input`'s own precedent for a widened row (`interface-inventory.ts:68-72`).
- `captured-channel-undeclared` -- "a captured input binding names any channel but `response-body`, the one channel a response descriptor declares structure for" widens to the kind's own capturable channel, per Decision 4.

## Tasks & Acceptance

**Execution:**

- [ ] `src/core/seal/plan-index.ts` -- nothing. Both accessors stay narrow; see the corrected Approach. The sites this story converts read `anyOperationOf`, `interfaceKindOf`, or `commandOperationOf`, one at a time.
- [ ] `src/core/compile/interface-inventory.ts` -- kind-aware `checkInterfaceKind`; a command counterpart to `operationSignature` with its separator declared once; per-kind keying in `checkDuplicateOperationSignature`; per-kind channel tuple in `checkUndeclaredMandatoryInput`.
- [ ] `src/core/compile/reachability.ts` -- branch `evaluateReachabilityAgainstOperation` on kind: an `artifact` pointer resolves its identifier against the declared artifact list and then its tail against that artifact's body declaration; `stdout` and `stderr` consult the output descriptor's stream declarations instead of rejecting every tail; `exit-code` stays shapeless. Remove Story 9.1's deferral for `cli` and keep it for `web` and `mcp`.
- [ ] `src/core/compile/bindings.ts` -- per-kind channel tuple in `capturedBindings`; per-kind capturable channel in `checkCapturedChannel`; per-kind descriptor reads in `capturedType` and `boundParameterType`.
- [ ] `src/core/compile/expression-legality.ts` -- branch `checkQuantifiersAgainst` so a quantifier over a command collection is checked rather than skipped at `:557`, and leave `checkOperandAtPosition` unchanged with a comment recording that it tests the channel root only.
- [ ] `src/core/compile/sensitivity-witness.ts` and `src/core/declared-inputs.ts` -- per-kind channel tuples in `declaresNoRequestKeys`, `suppliedKeys`, and `checkInputsAgainstShape`, and a per-kind `legalChannels` per Decision 5.
- [ ] `src/core/coverage/relevance.ts` -- carry the kind out of `operationsOf`; branch the five predicates the Code Map names; leave `siblingCrossCheckRelevance` and `stateChangeReadBackRelevance` unbranched with a comment saying why each is neutral.
- [ ] `src/core/coverage/satisfaction.ts` -- add per-kind counterparts to `bodyPointer`, `keyPointer`, and `parameterPointer`; branch the six predicates and the one half-predicate the Code Map names.
- [ ] `src/core/seal/derived-reference.ts` -- a per-kind noun in `operationReference`; a per-kind `TRANSPORT_ORDER` in `bindingEntries`; `entryName` unchanged, since prefixing the channel is what keeps two same-named bindings distinct on either kind.
- [ ] `src/core/schemas/port-messages.ts` -- `ProbeRequest` and `ProbeObservation` become discriminated unions on a `kind` field, carrying the api branches unchanged and adding command branches: the request carries the invocation and the four command channels, and the observation carries `exitCode`, `stdout`, `stderr`, and the artifacts written, with `status` and `headers` living on the api branch alone.
- [ ] `src/ports/environment-probe-port.ts` -- the port signature over the widened messages.
- [ ] `src/testing/probe-conformance.ts` -- command cases in AD-37's suite, one per behaviour the api cases already cover, so a conforming adapter is defined for both kinds by execution rather than by prose.
- [ ] `src/core/preflight/plan.ts` -- kind-aware assertion; a command branch in `requestOf`; per-kind leg construction.
- [ ] `src/core/preflight/witness-evidence.ts` -- a command observation projection filling `stdout`, `stderr`, `exitCode`, and the artifacts instead of hardcoding three nulls; a per-kind `makeWitnessPointerDenotesCollection`.
- [ ] `ARCHITECTURE-SPINE.md` AD-5 registry table -- narrow `unsupported-interface-kind`'s row, widen `duplicate-operation-signature`'s and `captured-channel-undeclared`'s, in the same diff as the code.
- [ ] `tests/compile/`, `tests/coverage/`, `tests/seal/`, `tests/preflight/`, `tests/conformance/` -- one case per I/O Matrix row, and one command fixture per branched predicate so each branch fails independently.
- [ ] `npm run generate:ad31-table` -- the AD-31 table is built from `CORPUS_CONTRACTS` and `CORPUS_CELLS`; if this story adds no corpus member the table does not move, and that is asserted rather than assumed.
- [ ] `_bmad-output/project-knowledge/learning-path-step-by-step.md` -- add this story's step per `learning-path-template.md`.

**Acceptance Criteria:**

- Given a command contract whose oracles and steps use only command channels, when `compile` runs, then it returns the contract, which is the first time in the package's history a non-api contract compiles.
- Given a `web` contract and an `mcp` contract, when each compiles, then each throws `unsupported-interface-kind` naming its own kind, so the code keeps two firing conditions and both are fixtured.
- Given every existing api contract, corpus member, and fixture, when the whole suite runs, then every verdict, every rendered brief byte, and every generated table is unchanged, so the branching is provably additive.
- Given each of the seven relevance predicates and each of the seven satisfaction predicates over a command contract, when they run, then each returns a verdict computed from a command declaration or an explicit irrelevance carrying the reason, and no predicate returns satisfied over a site it did not read.
- Given `coverage.ts:40-43`'s stated invariant, when the branched predicates run over the command fixture corpus, then no rule pairs `relevant: false` with `satisfied: false`, so the assertion the source calls unfalsifiable stays unfalsified, or the comment is corrected with the case that falsifies it.
- Given a sealed brief over a command contract, when it is generated, then no direction calls a command an endpoint, every binding clause names its command channel, and `brief-exceeds-scripting-bound` fires on the same declared bound as it does for an api contract.
- Given the published conformance suite, when an adapter author runs it against a command-capable implementation, then the suite exercises the command request and observation shapes, so AD-37's "defined by an executable suite, not by prose" holds for both kinds.
- Given `npm run check:ad5-registry` and `npm run lint:spine`, when they run, then both are green against the three edited rows.
- Given `npm run test:coverage`, when it runs, then `src/core/**` is at or above 90% statements and 90% branches with every new branch counted.
- Given `npm run validate`, when it runs, then it exits 0 with nothing on stderr.

## Decisions settled by construction

**Decision 1: the two kind-neutral relevance predicates stay unbranched, and that is a claim about what they read.**
`siblingCrossCheckRelevance` (`relevance.ts:199`) reads `contract.siblingGroups` at `:203,207,214` and nothing else; `SiblingGroups` (`eval-contract.ts:109-112`) is over `Identifier` operation ids and `KeyName` parameter names, neither of which is transport-shaped, so AD-20 rule 5's "cross-check sibling parameters and operations for the same asymmetry" is as true of two options on one command as of two query parameters on one endpoint. `stateChangeReadBackRelevance` (`:270`) reads `operation.stateChangeMarker` at `:277`, which Story 9.1 carries onto the command operation with its description verbatim, because AD-20 rule 7's relevance predicate and AD-10's channel selection both read it and neither is transport-specific. Both are recorded here rather than left silent, because an unbranched predicate is indistinguishable from a forgotten one in a diff. Downstream consequence: Story 9.5's corpus needs no cell for either predicate beyond the ones the shipped table already carries, since neither branches.

**Decision 2: a satisfaction predicate whose relevance predicate branched must branch too, and the parameter half of the sibling predicate is the one that catches this out.**
`siblingCrossCheckRelevance` is kind-neutral and `siblingCrossCheckSatisfaction` is not: its operation-group half (`satisfaction.ts:476-494`) uses `stepRoot` and is neutral, while its parameter-group half (`:495-518`) loops `TRANSPORT_CHANNELS` at `:502` and builds `/call-inputs/{path|query|header|body}` at `:504-508`. Left alone, a command contract declaring a parameter sibling group would be graded relevant and then found unsatisfied for every possible oracle, because the pointer the predicate looks for cannot exist on that kind. That is the exact failure `relevance.ts`'s own design avoids by making relevance decidable from declarations: an under-declared contract should cost coverage, and an inexpressible one should not. So the parameter half branches on kind and looks for the command channels. Downstream consequence: Story 9.5's corpus carries a command contract with a parameter sibling group, so the branch has a positive fixture rather than only a negative one.

**Decision 3: an irrelevant rule carries its reason, and `coverage.ts:40-43`'s invariant is checked rather than assumed.**
The source asserts that "`!relevant.relevant` is unfalsifiable today: a rule relevant for no site answers satisfied vacuously, which fixture 168 pins over 23 contracts." Several satisfaction predicates return `false` from an early guard before counting sites (`satisfaction.ts:241-247`, `:248-254`, `:420-425`, `:576-581`), so a branch that makes a relevance predicate `false` for a command operation while leaving those guards reading an HTTP field produces exactly the `relevant: false, satisfied: false` pairing the comment says cannot occur, and `evaluateCoverage` would then record a gap for a rule that never fired. Every branch in this story therefore pairs the relevance guard and the satisfaction guard on the same field, and the acceptance criterion above is what proves it over the command corpus. If a genuine case is found, the comment is corrected with it rather than the case suppressed. Known-bad state avoided: a coverage gap recorded against a command contract for a rule that was never relevant to it, which under AD-20 is a discipline finding about the author rather than about the contract.

**Decision 4: a command step's capturable channel is `stdout`, and `captured-channel-undeclared`'s row widens rather than a new code being minted.**
`CAPTURABLE_CHANNEL` (`bindings.ts:49`) is `'response-body'` and `:38-48` gives the reason in full: the response descriptor "declares `requiredKeys`, `permittedKeys`, `types`, `successIndicator`, `channelRoles`, and `collectionLocations`, every one of them about the body, so the body is the one channel it declares", and admitting `response-headers` and `response-status` "was tried and dropped: their types would have to be invented by fiat". That reasoning is a rule about which channel carries a declared type, not about HTTP. On a command operation, Story 9.1's output descriptor declares structure for standard output and for each artifact, and declares nothing for standard error or the exit code beyond a value space. So the capturable set is `stdout` plus the `artifact` channel, and `stderr` and `exit-code` are excluded on exactly the argument that excluded `response-headers`. This widens the existing code's row rather than minting a new one, because the condition is unchanged in kind: a captured pointer naming a channel the referenced operation's own output declaration does not give a type. Downstream consequence: Story 9.5's corpus carries a command contract capturing from stdout, which is the shape a two-step command behaviour needs.

**Decision 5: AD-10's differential channel for a command is the argument channel when the marker is false and the standard-input channel when it is true, and `header` has no command counterpart in the witness.**
AD-10's rule is "a path or query parameter where the marker is false, a body where it is true", and `sensitivity-witness.ts:44-46` records the shipped reading, including that "`header` is absent on purpose; no AD names a header differential." The command mapping follows the same shape rather than the same words: a read-only command varies by what it is told to look at, which is its arguments and options, and a state-changing command varies by what it is fed, which is standard input. Environment variables are excluded for the reason `header` is: no AD names an environment differential, and an environment variable is the command channel most likely to carry authorization material, which AD-18 keeps out of a declaration. So `WITNESS_CHANNELS`' command counterpart is `argument`, `option`, and `stdin`, and `legalChannels` (`compile/sensitivity-witness.ts:192`) selects `['stdin']` when the marker is true and `['argument', 'option']` when it is false. Downstream consequence: a command operation declaring keys only in its environment channel is not exempt under AD-10 and cannot declare a legal witness either, which is a real authoring dead end; it is recorded here and Story 9.5's corpus carries the shape so the failure is visible rather than theoretical.

**Decision 6: the scripting bound's four numbers carry over unchanged, and the calibration question is recorded rather than answered.**
`scripting-bound.ts:62-65` declares `WIDTH_MAX = 2`, `SHARED_ANCHOR_MAX = 2`, `DISJOINT_PAIR_MAX = 4`, and `STEP_COUNT_MAX = 16`, each calibrated in its own comment against `gateCContract` and `populatedContract`, both api fixtures. AD-5's own rule says the boundary "is calibrated against authored adversarial fixtures" and that "Reject fixtures are authored deliberately, one per shape the graph predicate rejects, held in the repository, and the count that gets through them is the boundary's stated strength." Nothing in that rule is transport-specific, and the predicate itself reads no operation field at all: `computeGraphMetrics` (`:87-158`) uses step ids, `after` edges, child counts, components, and plan length. So the numbers carry over by construction and this story changes none of them. What is genuinely open is whether a command contract's natural plan shape sits inside them, and that is answerable only against a real command contract, which is Story 9.5's. If Story 9.5's contract exceeds a bound, the finding is that the bound was calibrated on one kind, and it is recorded there with the measurement rather than pre-empted here with a guess. Downstream consequence: Story 9.5's acceptance carries the measurement either way.

**Decision 7: the port messages become unions and carry no `schemaVersion`, and the break is to the published conformance surface rather than to an artifact.**
`ProbeRequest` and `ProbeObservation` (`port-messages.ts:67-110`) are port messages, not interchange artifacts: they carry no `lineageFields`, they are absent from `schemas/`, and AD-11's disclosure list names "every interchange artifact that carries a `schemaVersion`, which is eleven of the twelve" and does not include them. So no version moves. The break is real and lands elsewhere: `eval-quality/conformance` publishes these types and the suite an adapter author runs, and `CHANGELOG.md:145-148` records that subpath as part of the 0.1.0 surface. No adapter in `src/adapters/` implements `EnvironmentProbePort`, so nothing in this repository breaks; an outside adapter author's implementation stops typechecking against the widened contract, which Story 9.5 discloses under AD-11's "the CLI command, flag, and exit-code contract" neighbour clause for the library surface.

**Decision 8: this story is large and was not split, and the alternative that was considered is recorded.**
The compile half, the coverage half, the seal half, and the port half are four separable pieces, and splitting them was considered on the same grounds Stories 8.2, 8.3, 8.4, and 8.5 each recorded for their own size. It was turned down on the ground that the split lines all run through one typecheck, because widening `PlanIndex.operationOf` breaks every one of the twenty sites at once. That premise is withdrawn along with the widening: with `operationOf` narrow and the kind-aware accessors beside it, the sites are independent and Story 9.1 already converted the ones that reach `compile`. What remains genuinely couples through the discriminated union's own shape rather than through an accessor's return type, which is a smaller coupling and does not force one commit. The one genuinely separable piece is the port and the conformance suite, and that is the piece a caller may choose to defer: `planPreflight` could keep rejecting `cli` while `compile` admits it, at the cost of one code answering two different questions about one kind and a command contract that compiles but cannot be pre-flighted, which under AD-10 means it cannot be run at all. That cost is why the port is in scope here; the alternative is stated so the choice is visible rather than assumed.

## Design Notes

The organising idea is that the twenty sites divide cleanly by what they read, and the division is already visible in the source. A site that reads a step id, an operation id, a behaviour, a sibling group, a waiver, or a graph edge is kind-neutral, and five whole files are neutral for that reason. A site that reads `method`, `pathTemplate`, `requestShape`, or `responseDescriptor` needs a branch, and every one of those reads is one dereference deep off a resolved operation. Nothing in between exists, which is what makes the widened `operationOf` a sufficient forcing function: the typecheck finds every site in the second group and no site in the first.

The one thing the compiler cannot find is `seal`, because `derived-reference.ts` reads `operation.operationId` and a hardcoded channel list, both of which typecheck perfectly against a command operation and both of which produce prose that is wrong. That is why the two seal sites are named explicitly in the Code Map rather than left to the build to discover.

## Verification

**Commands:**

- `npm run typecheck` -- expected: exit 0. The widened `operationOf` is what surfaces the work; a green typecheck with an unbranched predicate means the predicate was neutral, and each such case is recorded.
- `npx vitest run tests/compile tests/coverage tests/seal tests/preflight` -- expected: green, with a command fixture per branched predicate.
- `npm run test:conformance` -- expected: green, with the command cases exercised.
- `npm run check:ad5-registry` -- expected: exit 0 against the three edited rows.
- `npm run lint:spine` -- expected: exit 0.
- `npm run check:ad31-table` -- expected: exit 0 with no regeneration, proving the coverage table did not move on a story that adds no corpus member.
- `npm run check:worked-example` -- expected: exit 0 with no regeneration, proving the api worked chain is byte-identical under the branching.
- `npm run test:coverage` -- expected: exit 0 with `src/core/**` at or above 90/90.
- `npm run validate` -- expected: exit 0 with no output on stderr.

## Built, and where it diverged

`PlanIndex.operationOf` was never widened; see the corrected Approach above. Every site that had to
branch reads `interfaceKindOf`, `commandOperationOf`, or the free `anyOperationOf`, and the twenty
call sites this story enumerated were converted one at a time behind them across three steps rather
than in one commit.

**`seal` calls a command a command.** `operationReference` rendered every operation as "the *n*
endpoint", which told an evaluator something false about what it was reading; the noun follows the
kind now. `TRANSPORT_ORDER` is gone: `boundChannelsOf` orders a step's bound channels by
`INPUT_CHANNELS`, which is deterministic for both kinds and is the one place that ordering is
spelled. `BriefInterface` was verified kind-neutral as this story predicted and takes no bump.

**The port was widened here rather than deferred.** `ProbeRequest` and `ProbeObservation` are each a
union discriminated on `kind`. AD-35's analogue for a command is settled by construction and is the
same rule the executable's `Identifier` already enforces on the contract side: the request names a
logical executable and a subcommand path, the adapter maps it to something runnable from
configuration outside the contract, and the adapter builds the argument vector rather than being
handed one to execute. The in-repository HTTP adapter under `tests/` declines a command request
rather than half-serving it, which is honest for an adapter that speaks HTTP and keeps AD-2's "v0
ships no network adapter at all" literally true of the package.
