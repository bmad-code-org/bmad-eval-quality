---
epic: 4
story: 4
key: 4-4-stages-as-pure-plan-and-reduce-pairs-with-one-orchestration-layer
baseline_commit: f9f6482844896b2db25aa81fbbf0501383551db5
---

# Story 4.4: Stages as pure plan-and-reduce pairs with one orchestration layer

Status: in-review

## Story

As the hexagonal boundary,
I want compile-side stages shaped as pure plan-and-reduce pairs orchestrated in one layer,
so that impurity has exactly one entry point and stages stay reproducible.

## Acceptance Criteria

### AC 1: Scope, ownership, and exact file impact

This story assembles the existing compile checks, establishes the shared application and port protocol, records the compile and seal stage signatures, and replaces the narrow seal-only import guard with repository-wide dependency enforcement.

Create:

1. `src/core/stage-contracts.ts`: compiled TypeScript conformance types for the pure `compile` and `seal` stages, plus the generic synchronous plan and reduce shapes AD-34 requires for any future stage that needs an external observation. This is not AD-24's complete six-stage ownership and lineage table.
2. `src/core/compile/compile.ts`: the pure, synchronous, fixed-order compile stage over an already parsed `EvalContract`.
3. `src/application/compile.ts`: the synchronous application boundary that parses unknown input, applies the default-on strict option, and delegates all domain decisions to `core/compile/compile.ts`.
4. `src/ports/port.ts`: the shared asynchronous port method shape only. It contains no concrete port and no adapter.
5. `src/application/invoke-port.ts`: the sole generic seam that awaits a port. It validates both sides of a port call, invokes exactly once, preserves declared runtime faults, and translates boundary failures into AD-28 faults.
6. `scripts/dependency-direction.ts`: a reusable TypeScript AST scanner and layer-rule evaluator.
7. `scripts/check-dependency-direction.ts`: the command entry point for the repository scan.
8. `scripts/check-ad28-registry.ts`: a drift check that compares the complete runtime fault tuple with AD-28's table in set and order.
9. `tests/compile/compile.test.ts`.
10. `tests/application/compile.test.ts`.
11. `tests/application/invoke-port.test.ts`.
12. `tests/architecture/dependency-direction.test.ts`.

Update:

1. `src/core/schemas/faults.ts`: replace the implementation-only subset with all ten AD-28 runtime fault codes in the architecture table's exact order. `port-failure`, `port-contract-violation`, and `aborted` gain genuine throwers in this story.
2. `src/core/seal/seal.ts`: replace its direct `zod` import with `SealedEvaluatorBrief.safeParse(...)`, preserving the existing `TypeError` contract and cause while making `core/schemas` the Zod boundary. Extract or export the smallest validation helper needed for a direct invalid-assembled-brief regression test.
3. `tests/canonical/faults.test.ts`: cover the complete ten-code runtime fault registry and preserve the existing shape tests.
4. `tests/seal/seal.test.ts`: prove the assembled-brief validation helper rejects an invalid assembled value after the `safeParse` refactor, then preserve the stage-level regression.
5. `tests/seal/plan-index.test.ts`: remove the narrow source-text check for `seal -> compile`; the repository-wide dependency checker supersedes it and correctly resolves ordinary relative imports.
6. `package.json`: add `check:layers` and `check:ad28-registry`, then run both from `validate`.
7. `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md`: clarify in the dependency rule and AD-34 that imports among modules inside the single `core` graph node are same-layer imports and remain permitted. The existing prohibition governs dependencies leaving `core`, except the named `core/schemas` edge.

Apply that narrow architecture clarification before implementing the checker so the executable rule and governing prose agree. Do not update `src/index.ts`. Story 6.5 owns the published library and CLI surface. Do not edit generated schemas or shareable documents because this story adds no artifact field or schema constraint.

### AC 2: Pure compile stage and deterministic failure order

`src/core/compile/compile.ts` exports a single-verb stage function named `compile`. It accepts a parsed `EvalContract` and an explicit `{ strict: boolean }` option, returns the same typed contract after all selected checks pass, performs no I/O, holds no state, and never catches or rewrites a `StructuralFailure`.

Run every currently implemented compile check in this exact order. The order follows AD-5 registry order. The three functions sharing `malformed-operator-expression` use the stated suborder so the result is deterministic.

1. `checkRequirementLinkage`
2. `checkObservableSuccessCriterion`
3. `checkEvidenceReachability`
4. `checkBoundElementScope`
5. `checkOperandLegality`
6. `checkRegexConstructs`
7. `checkQuantifierOverNonCollection`
8. `checkQuantifierNesting`
9. `checkReferenceSetResolution`
10. `checkDuplicateOperationSignature`
11. `checkUndeclaredMandatoryInput`, only when `strict` is `true`
12. `checkOracleChannel`
13. `checkOracleAlignment`
14. `checkInterfaceKind`
15. `checkNestedTemporalClause`
16. `checkScriptingBound`
17. `checkForbiddenInputFloor`
18. `checkScopedResourceReferences`
19. `checkWaiverCompleteness`

The function fails fast. A contract violating several checks reports the first selected check in this list. Both Story 4.3 graph checks remain independent. A nested chain reaches `checkNestedTemporalClause` first, while a caller invoking `checkScriptingBound` directly still gets `plan-exceeds-scripting-bound`.

Strict mode is default-on at the application boundary. The core stage receives a required boolean so its behavior never depends on environment state or an implicit configuration source. Setting strict mode to `false` skips only `checkUndeclaredMandatoryInput`; every other check and its order remain identical.

The compile result is an `EvalContract`. This story creates no coverage-gap field and no substitute result wrapper. Epic 5 owns declaration-only coverage predicates and their records.

### AC 3: Application compile boundary and error separation

`src/application/compile.ts` exports `compile(input: unknown, options?: { readonly strict?: boolean }): EvalContract`.

1. Parse with the existing `EvalContract.safeParse(input)` schema. Do not parse JSON text, read a file, inspect environment variables, or discover configuration.
2. A schema rejection throws `RuntimeFault('schema-parse-failure', 'EvalContract', detail, { cause })`. The cause is the original Zod error.
3. Successful parsing delegates to the core `compile` function with `strict: options.strict ?? true`.
4. Return the parsed contract from the core stage. Zod parsing supplies the boundary clone, so the returned object shares no mutable nested collection with the caller's input.
5. Allow `StructuralFailure`, `RuntimeFault`, `TypeError`, and any unexpected internal error to propagate unchanged. Never turn a structural failure into a runtime fault or an in-band result.
6. Keep the application function synchronous. Compile needs no external observation and therefore needs no artificial plan object, reducer, promise, port, or `await`.

The application layer performs boundary validation and delegation only. Check selection, ordering, and structural decisions stay in `core/compile/compile.ts`.

### AC 4: Compile and seal conformance types and the AD-34 conditional pair rule

`src/core/stage-contracts.ts` defines conformance types for the two stage implementations in scope:

1. `CompileOptions` with required readonly `strict: boolean`.
2. `CompileStage`: `(contract: EvalContract, options: CompileOptions) => EvalContract`.
3. `SealStage`: `(contract: EvalContract) => SealedEvaluatorBrief`.
4. `PlanStage<InputArtifact, RequestDescription>`: a synchronous pure function from artifacts to a request description.
5. `ReduceStage<RequestDescription, Observation, OutputArtifact>`: a synchronous pure function from a plan and observations to the next artifact.

Type-level assignments in tests prove the existing core `compile` and `seal` implementations conform to `CompileStage` and `SealStage`.

AD-34 makes plan-and-reduce conditional on a stage needing external observation. Compile and seal need none, so both remain single synchronous pure functions. Pre-flight is the first concrete plan-and-reduce consumer and remains Story 6.2.

Do not claim this file closes AD-24's missing complete stage-signature table. That table must cover all six stages, exact inputs, one owned output per stage, owners, and lineage edges. Epic 6 owns AD-24. Story 6.4 must complete that table alongside cross-stage immutability and lineage enforcement. These compile and seal types become two inputs to that later table.

### AC 5: Shared port method and the only seam that awaits ports

`src/ports/port.ts` defines these exact generic shapes:

```ts
export type BoundaryParseResult<Value> =
	| { readonly success: true; readonly data: Value }
	| { readonly success: false; readonly error: unknown }

export type BoundaryParser<Value> = {
	readonly safeParse: (input: unknown) => BoundaryParseResult<Value>
}

export type PortMethod<Request, Response> = (
	request: Request,
	signal: AbortSignal,
) => Promise<Response>

export type InvokePortOptions<Request, Response> = {
	readonly request: unknown
	readonly requestParser: BoundaryParser<Request>
	readonly responseParser: BoundaryParser<Response>
	readonly port: PortMethod<Request, unknown>
	readonly signal: AbortSignal
	readonly requestPath: string
	readonly responsePath: string
}
```

It also defines the smallest structural parser interface `invokePort` needs for two-way boundary validation. Do not import Zod into `ports/`; a Zod schema satisfies the structural parser interface without making the port layer depend on the runtime library by name.

`src/application/invoke-port.ts` exports this exact function:

```ts
export async function invokePort<Request, Response>(
	options: InvokePortOptions<Request, Response>,
): Promise<Response>
```

Its behavior is fixed:

1. Reject an already-aborted signal with `RuntimeFault('aborted', requestPath, ...)` before invoking the port.
2. Validate the outbound request before the call. Invalid request input throws `schema-parse-failure` with the request parser error as cause.
3. Call the supplied port method exactly once with the parsed request and the same `AbortSignal` object.
4. Preserve any `RuntimeFault` thrown or rejected by the port without wrapping it.
5. Translate an undeclared thrown or rejected value to `port-failure`, preserving the original value as cause. If the signal became aborted before that rejection, translate it to `aborted`.
6. Validate the resolved value before returning it. A partial result, in-band error object, or other invalid result throws `port-contract-violation` with the response parser error as cause.
7. Return the parsed response. Perform no retry, back-off, fallback call, logging, caching, mutation, or verdict conversion.

Fault paths created by `invokePort` are fixed. Pre-call `aborted` and invalid outbound request faults carry `requestPath`. Newly translated `port-failure`, post-call `aborted`, and `port-contract-violation` faults carry `responsePath`. Every translated fault preserves its original error or parser error as `cause`. A `RuntimeFault` received from the port retains its original code, artifact path, message, cause, and object identity.

A schema-valid response is data. `invokePort` does not guess that a field named `error` is an in-band failure. Concrete response schemas and the Story 6.1 conformance suite must exclude such shapes where applicable.

Make `RUNTIME_FAULT_CODES` the complete AD-28 registry in this exact table order:

1. `schema-parse-failure`
2. `schema-version-mismatch`
3. `non-canonicalizable-value`
4. `digest-mismatch`
5. `budget-exhausted`
6. `port-failure`
7. `port-contract-violation`
8. `forbidden-target`
9. `aborted`
10. `operator-cannot-accept-operand`

`scripts/check-ad28-registry.ts` reads the current architecture spine named by `lint:spine`, extracts AD-28's first code table, and asserts exact set and order equality with `RUNTIME_FAULT_CODES`. It fails if the architecture workspace and `lint:spine` path disagree. This supersedes the older implementation-only subset convention because AD-28 defines a published normative registry, and Story 4.4 is the Epic 4 owner of AD-28.

This story creates no `CorpusPort`, `EnvironmentProbePort`, `ClockPort`, `FileSystemPort`, adapter, network implementation, or conformance suite. Story 6.1 owns those concrete types and tests.

### AC 6: Mechanically enforced dependency direction

`npm run check:layers` recursively discovers every TypeScript file under `src/` and parses it with the already pinned TypeScript compiler API. It checks static imports, type-only imports, re-exports, and dynamic `import()` calls. It reports every violation with source file, line, imported specifier, and violated rule, then exits nonzero.

First apply AC 1's narrow architecture clarification. Then enforce this layer graph:

1. `core/` may import other modules inside the same `core` layer. It may never import `application/`, `ports/`, `adapters/`, or `cli/`.
2. `ports/` may import `core/schemas` only.
3. `application/` may import `core/`, `ports/`, and `core/schemas`.
4. `adapters/` may import `ports/` and `core/schemas`.
5. `cli/` may import `application/` and `adapters/`.
6. Nothing may import `cli/`.
7. The root `src/index.ts` may expose `application/` and schema types when Story 6.5 arrives. It may never bypass the application layer to expose a domain-stage implementation.

For external modules under `core/`, permit `zod` only from `core/schemas/`. Permit only `createHash` from `node:crypto`, and only in `src/core/canonical/digest.ts`. Reject every other external or Node builtin import from non-schema core modules. In particular, reject `node:fs`, `node:child_process`, `node:net`, `node:http`, `node:https`, random crypto APIs, and namespace imports from `node:crypto`.

The scanner rejects every `async` function and every `AwaitExpression` under `core/`. Application is the only layer that may await ports. Adapters may await their underlying I/O mechanism while implementing a port, and CLI may await application calls. The import graph permits port imports only in application and adapters. The package contains no clock read or randomness today; add explicit AST checks for `Date.now`, `new Date`, `Math.random`, and Node random APIs under `core/` so later changes cannot silently violate AD-1.

Import analysis fails closed:

1. Resolve every literal relative specifier against its containing file, including `.ts` extension and `index.ts` rules used by this repository.
2. Reject a relative import that escapes `src/` or cannot be resolved to a source file.
3. Reject a dynamic `import()` whose argument is not a string literal.
4. Reject TypeScript import-equals declarations and CommonJS `require` anywhere under `src/`; this ESM package needs neither.
5. Collect and report all violations in one run instead of stopping at the first.

`tests/architecture/dependency-direction.test.ts` uses in-memory synthetic source snippets to prove every allowed edge and every forbidden edge, including type imports, re-exports, literal and non-literal dynamic imports, import-equals, `require`, unresolved imports, paths escaping `src/`, forbidden builtins, clock reads, randomness, core async functions, core awaits, adapter-local awaits, CLI application awaits, and multiple violations in one scan. It also runs the real repository scan. The production gate remains `check:layers`; the test proves the checker rejects mutations rather than merely passing the current tree.

Remove the old `tests/seal/plan-index.test.ts` module-boundary block. Its matcher looks for `core/compile` text and misses the normal relative spelling `../compile/foo.ts`; keeping two guards would preserve a weaker, misleading source of truth.

### AC 7: Integration tests and regression preservation

`tests/compile/compile.test.ts` must prove orchestration rather than retest every internal algorithm in depth:

1. `populatedContract` and `gateCContract` compile successfully in default strict mode.
2. One reused negative mutation reaches each of the 19 wired functions through `core/compile/compile.ts`. Assert the exact code and meaningful artifact path. Use separate fixtures for `checkBoundElementScope`, `checkOperandLegality`, and `checkRegexConstructs`, even though they share `malformed-operator-expression`.
3. A multi-defect contract pins registry-order precedence. A second multi-defect contract pins the three malformed-expression subchecks.
4. The Story 4.3 nested-chain fixture reports `nested-temporal-clause` through orchestration, while direct `checkScriptingBound` remains covered by its existing tests.
5. Strict `true` and default strict behavior reject an undeclared input. Strict `false` accepts that exact fixture. Adding another defect to the same non-strict fixture still rejects under the other defect's code.
6. Two calls over the same frozen parsed contract return byte-identical canonical values, never mutate the input, and throw the same failure code for the same invalid input.
7. Existing Story 4.3 graph behavior remains unchanged: duplicate IDs remain distinct graph nodes, dangling temporal references remain permissive, the four numeric bounds remain unchanged, and the schema still admits the adversarial plans.

`tests/application/compile.test.ts` must prove:

1. Invalid input throws `RuntimeFault` with `code: 'schema-parse-failure'`, `artifactPath: 'EvalContract'`, and the Zod error as cause.
2. A structural defect throws the original `StructuralFailure` instance shape without conversion.
3. Default strict mode is true. Explicit false reaches the core stage as false.
4. A valid caller-owned input is deep-cloned at parse time and remains unchanged.
5. The return is synchronous and is never a `Promise`.

`tests/application/invoke-port.test.ts` must prove:

1. Valid request and response, one call, same signal, parsed response returned.
2. Invalid outbound request, zero calls, `schema-parse-failure`.
3. Invalid resolved response, one call, `port-contract-violation`.
4. Plain thrown `Error`, rejected promise, and non-Error rejection each become `port-failure` with cause.
5. A declared `RuntimeFault` is returned as the exact same thrown instance.
6. Pre-aborted signal gives `aborted` with zero calls. Abortion before an undeclared rejection gives `aborted`.
7. No fixture observes a retry or a second underlying call.
8. Request-side faults carry the exact `requestPath`; response-side faults carry the exact `responsePath`.

Keep all existing compile, seal, canonical, and schema tests green. No test performs network I/O. Architecture tests may read source files because they validate source topology, while core behavior tests remain in-memory.

### AC 8: Validation gate and completion evidence

Before editing, record the current baseline:

1. `npm run check:docs`: 55 files pass.
2. `npm test`: 44 files and 1715 tests pass.
3. `npm run typecheck`: pass.
4. `npm run build`: pass.
5. Worktree clean at `f9f6482`.

After implementation:

1. Run targeted compile, application, architecture, seal, and fault tests.
2. Run `npm run check:layers` directly and record the scanned file count.
3. Run `npm run check:ad28-registry` directly.
4. Run `npm run validate`.
5. Run `npm run build` separately because `validate` does not build.
6. Record final file and test counts in the Dev Agent Record.
7. Leave the story status at the implementation workflow's review state and update sprint tracking through the normal build workflow.

## Tasks / Subtasks

- [x] Task 1: Establish stage signatures and the pure compile stage (AC 2, 4)
  - [x] Add `src/core/stage-contracts.ts`.
  - [x] Add `src/core/compile/compile.ts` with all 19 calls and the fixed order.
  - [x] Preserve the existing standalone check exports.
- [x] Task 2: Add the application compile boundary (AC 3)
  - [x] Parse with `EvalContract.safeParse`.
  - [x] Translate schema rejection to `schema-parse-failure`.
  - [x] Delegate synchronously with default-on strict mode.
- [x] Task 3: Add the shared port protocol and await seam (AC 5)
  - [x] Add `src/ports/port.ts`.
  - [x] Add `src/application/invoke-port.ts`.
  - [x] Replace `RUNTIME_FAULT_CODES` with AD-28's complete ten-code registry in table order.
  - [x] Add the AD-28 registry drift gate against the configured architecture spine.
- [x] Task 4: Enforce layer direction (AC 6)
  - [x] Clarify same-layer core imports in the architecture spine before encoding the rule.
  - [x] Add the TypeScript AST checker and command entry point.
  - [x] Add `check:layers` and `check:ad28-registry` to `package.json` and `validate`.
  - [x] Replace the narrow seal boundary test.
  - [x] Remove the direct Zod import from `core/seal/seal.ts` through `safeParse`.
- [x] Task 5: Add integration and mutation-proof tests (AC 7)
  - [x] Add 19 compile wiring fixtures and the two priority fixtures.
  - [x] Add application compile boundary tests.
  - [x] Add port invocation protocol tests.
  - [x] Add in-memory architecture rule mutations plus the real-tree scan.
- [x] Task 6: Run all gates and complete the record (AC 8)
  - [x] Run targeted tests.
  - [x] Run `npm run check:layers`.
  - [x] Run `npm run check:ad28-registry`.
  - [x] Run `npm run validate`.
  - [x] Run `npm run build`.

## Dev Notes

### Governing interpretation

The architecture spine revision 9 governs mechanics. The PRD's same-day readiness withdrawal and the older product brief's engine claims are historical context. The later spine, Epic Brief, and epics artifact define this implementation sequence.

AD-34's pair rule is conditional. A stage that needs an external observation splits into pure plan and reduce functions. Compile and seal need no observation, so manufacturing a pair for either would add an empty abstraction and an incompatible surface. The generic pair signatures record the rule for pre-flight without building pre-flight early.

The literal phrase "`core/` imports `core/schemas` alone" conflicts with the dependency diagram's single `core` node and the delivered cross-submodule reuse. Resolve that ambiguity in the governing spine before encoding the rule. The clarification must state that imports among modules inside the single `core` graph node are permitted same-layer dependencies. The prohibition applies to dependencies leaving core for ports, application, adapters, or CLI, plus direct external dependencies outside the two named exceptions. If a later architecture amendment defines core subdirectories as separate layers, that amendment must pair the stricter checker rule with the required core refactor.

### What to reuse

Read every file under `src/core/compile/` before editing. Do not combine, copy, or privately reimplement the checks. The orchestration layer calls their public functions.

Reuse these current conventions:

1. `StructuralFailure` remains the AD-5 failure type. Its code and artifact path propagate unchanged.
2. `RuntimeFault` remains the AD-28 fault type. The registries stay disjoint.
3. `EvalContract.safeParse` supplies runtime boundary validation and a deep-cloned typed result.
4. `populatedContract` and `gateCContract` remain the positive whole-contract fixtures.
5. Negative contract mutations follow `structuredClone(fixture) as any` and reuse the exact shapes already proven in the individual compile tests.
6. `structuralFailureOf` from `tests/compile/helpers.ts` remains the shared assertion helper.

### Current state of UPDATE files

`src/core/schemas/faults.ts` currently carries four implementation-backed AD-28 codes. Replace that subset with the complete normative ten-code table in the exact architecture order. `invoke-port.ts` supplies genuine throwers for `port-failure`, `port-contract-violation`, and `aborted`; other codes may remain registry members before their producing stages arrive. Preserve `RuntimeFault`'s constructor, cause, code, artifact path, and message shape. The drift script prevents the code registry from silently diverging from the architecture table.

`src/core/seal/seal.ts` is pure and already validates its assembled brief. Its only architecture violation is a direct runtime import from `zod` for `ZodError` and `toDotPath`. Switch to the schema's `safeParse` result, summarize the first issue without importing Zod, and preserve the existing thrown `TypeError` plus cause. Expose the smallest validation helper needed for a direct invalid-value regression so removing the validation call makes a test fail. Keep canonical ordering, contract digest, lineage, isolation projection, and `auditBriefScripting` behavior unchanged.

`tests/seal/plan-index.test.ts` contains a filesystem-backed import check scoped to `core/seal/`. It parses imports with a regular expression and checks a spelling ordinary relative imports never use. Remove that block and its now-unused Node filesystem imports after the global checker lands. Preserve every plan-index behavior test.

`package.json` uses exact pins and has no architecture gate. Add a script without changing any dependency or version. Keep `validate`'s existing checks and insert `check:layers` before the test suite.

### Previous-story intelligence

Story 4.3 left the orchestration seam intentionally open. Its two graph checks are standalone and overlapping by design. Preserve all 26 adversarial fixtures and these implementation facts:

1. Graph nodes use array positions, never `stepId`, because duplicate IDs are schema-legal.
2. A dangling `after`, including a parent whose own `after` is dangling, contributes no graph edge.
3. Forward references, self-loops, and empty plans keep their recorded behavior.
4. The reporting priority inside `checkScriptingBound` remains depth, width, shared anchors, disjoint pairs, then total step count.
5. Bounds remain width 2, shared anchors 2, disjoint pairs 4, and step count 16.
6. No `.max()` enters the interaction-plan schema. The adversarial plans must parse before compilation can reject them.

Story 4.2 established the individual check convention: synchronous, deterministic, independently callable, and fail-fast. Its story file says 15 checks because it predates the two review-added forbidden-input functions. Repository reality now contains 19 functions. Use the source tree as the count of record.

Recent commits preserve a clean layering trend:

1. `f9f6482`: Story 4.3 added the graph predicate and 26 fixtures.
2. `e38169b`: Story 4.2 added the structural checks, shared helpers, and forbidden-input closure.
3. `46edfca`: Story 4.1 added reachability and the shared evidence resolver.

No recent commit changed the public barrel or runtime dependency set.

### Project structure and ownership boundaries

This story does not build:

1. The three rubric checks. Story 6.3 owns `rubric-unanchored`, `rubric-evidence-unreachable`, and `rubric-scores-reasoning-prose`.
2. `brief-exceeds-scripting-bound` orchestration. `seal` already owns the post-generation audit.
3. Epic 5's fourteen relevance and satisfaction predicates or coverage-gap records.
4. Concrete port interfaces, adapters, default-deny probing, or the published conformance suite. Story 6.1 owns them.
5. Pre-flight planning and reduction. Story 6.2 owns them.
6. Artifact lineage enforcement across stages. Story 6.4 owns it.
7. The complete AD-24 six-stage input, output, owner, and lineage table. Story 6.4 owns it; this story supplies only compile and seal conformance types.
8. `src/application/seal.ts`, `src/index.ts`, package exports, CLI commands, serialization, exit codes, or public subpaths. Story 6.5 owns the remaining application and publication surface.
9. Any score-side reducer, verdict mapping, dominance logic, probe qualification, detection mapping, engine seam, judge port, digest port, or network adapter.

### Testing and engineering requirements

1. TypeScript `noUncheckedIndexedAccess` applies to Zod issue paths, AST child access, file arrays, and import specifier extraction. Guard every indexed access.
2. Biome's `useImportType` and `useExportType` remain errors. Use type-only imports and exports where required.
3. Architecture discovery must recurse. A hand-maintained file list recreates the weakness the existing seal check attempted to avoid.
4. Parse TypeScript into an AST. Avoid a regular expression that misses multiline imports, re-exports, dynamic imports, or relative paths.
5. The layer checker may read the repository. Core behavior tests remain in-memory, and port tests use fakes only.
6. No test calls a network, clock, subprocess, model, evaluator, judge, or system under test.
7. Preserve exact pins. Add no dependency.

### Latest technical information

The repository pins Zod 4.4.3, TypeScript 7.0.2, Vitest 4.1.10, Vite 7.3.1, and Biome 2.5.8. Repository pins govern implementation. Do not upgrade or downgrade during this story.

Zod 4's official API documents that `safeParse` returns a discriminated result containing parsed data or `ZodError`, while successful parsing returns a deep clone. This supports synchronous boundary validation without a direct `ZodError` import in non-schema core code.

Biome supports `noRestrictedImports` patterns on the installed major. Use the TypeScript AST gate here because this story must encode a source-layer-dependent graph, detect dynamic imports, and reject `await` placement and impurity expressions in the same command. No Biome configuration change is needed.

The pinned TypeScript package exposes `SourceFile` ASTs through the compiler API. Use that installed parser rather than maintaining an import grammar in a regular expression.

### References

1. `_bmad-output/planning-artifacts/epics.md`: Epic 4 and Story 4.4, lines 321 through 372.
2. `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md`: Design Paradigm and dependency graph, lines 102 through 157.
3. Same spine: AD-5 and strict mode, lines 201 through 241.
4. Same spine: AD-24 stage signatures, lines 372 through 376, and Owed item 6, lines 711 through 716.
5. Same spine: AD-28 runtime faults and port protocol, lines 400 through 421.
6. Same spine: AD-34 plan, reduce, and application boundary, lines 461 through 465.
7. Same spine: Structural Seed and capability map, lines 570 through 617.
8. `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/EPIC-BRIEF.md`: Epic 4, lines 112 through 131.
9. `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ADR-004-execution-boundary.md`: pure stages and execution boundary, lines 35 through 69.
10. `_bmad-output/implementation-artifacts/4-1-pointer-resolution-and-reachability.md`: compile orchestrator exclusion, lines 79 through 82.
11. `_bmad-output/implementation-artifacts/4-2-the-ad-5-registry-as-code-and-the-structural-compile-checks.md`: compile ordering and strict-mode ownership, lines 37 through 48 and 808 through 810.
12. `_bmad-output/implementation-artifacts/4-3-the-scripting-bound-graph-predicate-and-its-adversarial-fixtures.md`: orchestrator exclusion, decisions, review findings, and preservation requirements.
13. `src/core/compile/*.ts`, `src/core/schemas/faults.ts`, `src/core/seal/seal.ts`, `tests/seal/plan-index.test.ts`, and `package.json`.
14. Zod official documentation: `https://zod.dev/basics`.
15. Biome official `noRestrictedImports` documentation: `https://next.biomejs.dev/linter/rules/no-restricted-imports/javascript/`.
16. TypeScript official compiler API documentation: `https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API`.

## Decisions Taken During Story Creation

1. **The core compile stage owns check order.** Application parses and delegates. This keeps structural decisions in core while preserving application as the only layer that awaits ports.
2. **AD-5 registry order is compile failure priority.** It is the only published stable order already shared by implementers. Three functions sharing `malformed-operator-expression` run bound-element scope, operand legality, then regex constructs.
3. **Strict mode defaults true at the application boundary and is required in the core signature.** This implements AD-4's default-on rule while keeping core configuration explicit.
4. **Compile and seal remain single synchronous stages.** AD-34 requires a pair only when external observation exists. Generic pair types record the future rule without inventing empty plans.
5. **This story creates a shared generic port method and executable await seam.** Concrete port names and their conformance suite remain in Story 6.1. The seam gives AD-28's three port-boundary codes real throwers and avoids a vacuous "all zero ports conform" claim.
6. **The runtime fault registry becomes the complete normative AD-28 table.** The ten-code tuple follows the architecture's exact order. A drift gate keeps it synchronized even when some producing stages arrive later.
7. **Dependency direction is a script gate backed by mutation tests.** A source-reading core test would violate the purpose of AD-30's in-memory core tests. A production gate in `validate` also catches violations when targeted tests are skipped.
8. **The architecture clarification precedes the dependency checker.** It records core as one graph layer and permits same-layer imports among its modules. The checker then enforces the clarified spine, including the prohibition on outer-layer imports and unapproved external dependencies.
9. **The existing seal implementation loses its direct Zod import.** `safeParse` preserves validation and cause handling while making the architecture rule true instead of encoding a one-file exception.
10. **The public barrel remains untouched.** Story 6.5 publishes application calls and CLI adapters together, preventing a temporary public core API from becoming compatibility debt.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

None. No test or gate required a debug session; failures encountered during implementation (biome formatting drift, two over-strict test assertions on `import X = require(...)` double-reporting, a stale `check:shareable` snapshot after the spine edit) were each resolved directly against source.

### Completion Notes List

- Baseline recorded before editing: `npm run check:docs` 55 files, `npm test` 44 files / 1715 tests, `npm run typecheck` pass, `npm run build` pass, worktree clean at `f9f6482`.
- All 19 compile checks wired into `core/compile/compile.ts` in exact AD-5 registry order, with `checkUndeclaredMandatoryInput` gated on `options.strict`, matching AC 2.
- `application/compile.ts` added as the sole synchronous parse-and-delegate boundary (AC 3); `RuntimeFault('schema-parse-failure', 'EvalContract', ...)` on a schema rejection, `strict: options?.strict ?? true` otherwise.
- `core/stage-contracts.ts` added with `CompileOptions`, `CompileStage`, `SealStage`, `PlanStage`, `ReduceStage` (AC 4). Added type-level conformance proofs (`const stage: CompileStage = compile` / `const stage: SealStage = seal`, each called through the typed alias) to `tests/compile/compile.test.ts` and `tests/seal/seal.test.ts` — the one AC 4 requirement the prior interrupted run had not yet covered.
- `src/ports/port.ts` (structural port/parser shapes, no Zod import) and `src/application/invoke-port.ts` (the sole `await`-a-port seam) added per AC 5's exact signatures and fault-path rules.
- `RUNTIME_FAULT_CODES` in `src/core/schemas/faults.ts` replaced with the complete ten-code AD-28 table in exact order; `scripts/check-ad28-registry.ts` added as the drift gate against the spine section `lint:spine` names.
- `scripts/dependency-direction.ts` (pure AST scanner/evaluator, built on `typescript/unstable/ast`'s `createScanner` since pinned TypeScript 7.0.2 no longer ships an in-process parser) and `scripts/check-dependency-direction.ts` (the repository-walking entry point) added; `check:layers` and `check:ad28-registry` wired into `package.json`'s `validate` script.
- `ARCHITECTURE-SPINE.md` clarified (AC 1 item 7) before the checker was written: imports among `core/`'s own submodules, `core/schemas` included, are same-layer and permitted; the prohibition binds only dependencies leaving `core/`.
- `core/seal/seal.ts` lost its direct `zod` import; `validateAssembledBrief` (exported) now drives validation through `SealedEvaluatorBrief.safeParse`, preserving the `TypeError`-plus-cause contract.
- `tests/seal/plan-index.test.ts`'s filesystem-backed `core/compile` substring guard removed in favor of the repository-wide checker, per AC 6.
- The only gap found against a prior interrupted run's work: `tests/architecture/dependency-direction.test.ts` did not exist. Added it with a full allowed/forbidden edge matrix across all 7 declared layers (driven by an `ALLOWED` table transcribed independently from AC 6's prose, not from the checker's own `isAllowedEdge`, so the test doesn't just check the implementation against itself), plus dedicated coverage for type-only imports, all three re-export shapes, literal and non-literal dynamic `import()`, `import =`/`require`, unresolved and `src/`-escaping specifiers, the `zod`/`createHash` external allowlist, clock/randomness/async/await purity rules under `core/`, string/comment false-positive resistance, multi-violation collection, and a real-repository-tree scan (91 tests total in that file).
- One real defect surfaced and fixed in test authoring, not in the checker: `import Foo = require('./x.ts')` genuinely trips both the import-equals rule and the CommonJS-require rule at the token level (two true, independent findings on one statement) — the test was corrected to expect both rather than the checker being weakened to suppress one.

### Review Pass (post-implementation)

Three parallel review layers (blind-hunter, edge-case-hunter, verification-gap) ran against the
implementation diff. Every finding was re-verified against the code before it was acted on; the ones
that turned out to be real are listed with their fix, the ones that did not are listed with the
evidence that settled them.

**Fixed: the dependency-direction scanner (`scripts/dependency-direction.ts`) failed open in eight
places.** Each was reproduced against the real scanner before the fix and is now pinned by a
synthetic fixture in `tests/architecture/dependency-direction.test.ts`.

1. `import crypto, { createHash } from 'node:crypto'` was accepted under `digest.ts`'s exception,
   because the clause check only inspected tokens between the braces. The exception now requires the
   whole clause to be that one brace group, optionally type-only.
2. A trailing comma inside that clause (`{ createHash, }`, which a Biome reformat could introduce)
   was wrongly rejected. Commas are filtered before the binding list is measured.
3. `export type * from '...'` was invisible: the re-export detector only treated `type` as a
   re-export starter when a brace followed. All four wildcard forms are now recognized, including
   `export * as ns from` and `export type * as ns from`.
4. Ambient `crypto.randomUUID()`, `crypto.getRandomValues()`, `crypto.randomBytes()`,
   `crypto.webcrypto.*`, and `performance.now()` under `core/` bypassed both the import check (they
   need no import) and the identifier check (which only knew `Date` and `Math`). AC 6 names "Node
   random APIs" explicitly, so these are in scope; the check is now a member table covering clock
   and randomness together.
5. `async *gen() {}` and `async ['computed']() {}` under `core/` escaped the async-function check,
   which only looked for `function`, `(`, or a plain identifier after `async`. Generator, computed,
   and quoted method names are covered, and the computed form requires the trailing `(` so an index
   access on a variable named `async` stays a non-finding.
6. `import('x', { with: { type: 'json' } })` was misreported as a non-literal argument, because the
   check assumed the closing paren sat immediately after the string. A comma is now accepted there.
7. `require?.('x')` bypassed the CommonJS-require check. The optional-call form is covered.
8. A `.ts` file directly under `src/` outside every layer directory was skipped entirely: it
   classified to no layer, so the scan returned before applying a single rule to it. It is now
   reported, and `tests/architecture/dependency-direction.test.ts` asserts the real tree contains no
   such file.

**Fixed: the bounded token scan gave up silently.** `MAX_LOOKAHEAD` exhaustion, and a `from` followed
by something other than a string literal, both returned "nothing to check". AC 6 says import analysis
fails closed, so both now report a violation naming the statement. `import.meta` is exempted
explicitly, and `export { x }` with no `from` is distinguished from an unreadable statement by
matching the clause's closing brace rather than by running off the end of the token stream.

**Fixed: `ports/` had no external-import gate.** AC 5 states "Do not import Zod into `ports/`" and
nothing enforced it. Generalized to every external module and Node builtin, since `ports/` declares
shapes only: no concrete port, no adapter, no I/O. `adapters/` and `cli/` stay unrestricted, because
an adapter exists to reach the I/O mechanism its port describes.

**Fixed: `dotPath` in `core/seal/seal.ts` had no test reaching its loop body.** The only
`validateAssembledBrief` rejection test used an excess key, whose Zod issue path is always `[]`, so
every path-formatting branch was unexecuted. Two fixtures now assert the real message:
`directions[0].text` (array index bracketed, object key dotted) and `safetyLimits[0]`.

**Fixed: `scripts/check-ad28-registry.ts` had no proof its own detection worked.** Its sibling
`check-ad5-registry.ts` has a CI canary; this one had neither canary nor test, so a passing run could
not distinguish a working checker from a no-op. The extraction and comparison moved to
`scripts/ad28-registry.ts` (the same pure-module / entry-point split this story already uses for the
layer checker), `tests/architecture/ad28-registry.test.ts` proves they reject a dropped code, a
transposed pair, a missing section, and an unparseable row, and `canary-ad28-registry` in
`.github/workflows/pr-checks.yml` mirrors `canary-ad5-registry` for the shipped command. Both canary
mutations were run locally against a backed-up copy of `faults.ts` and confirmed to exit nonzero
naming the drift.

**Fixed: two pieces of duplication the story's own conventions rule out.**
`cleanPopulatedContract()` and its twenty-line justification comment were copied between
`tests/compile/compile.test.ts` and `tests/application/compile.test.ts`; both now import it from
`tests/compile/helpers.ts`, beside `structuralFailureOf`. The `src/` directory walk was duplicated
between `scripts/check-dependency-direction.ts` and the architecture test's real-tree scan; it moved
to `scripts/discover-source-files.ts`, which both import, keeping `scripts/dependency-direction.ts`
filesystem-free. That walk also fails closed now on a symlink (which could point outside `src/`) and
on an empty result (a scan of nothing otherwise reports zero violations for the wrong reason).

**Fixed: AC 7 item 7's other three sub-claims were proven only by direct-call suites.**
`tests/compile/compile.test.ts` now re-proves them through `compile()`: the four numeric bounds at
and one past each limit (step count 16/17, width 2/3, shared anchors 2/3, disjoint pairs 4/5),
duplicate `stepId`s staying distinct graph nodes (Story 4.3 fixture 20's discriminating shape, which
passes if the nodes wrongly merge), and the schema admitting an adversarial plan that only
compilation rejects. Every fixture appends to `populatedContract`'s own two steps rather than
replacing the plan, because oracle O-001 cites `/interactions/list/...` and
`checkEvidenceReachability` runs nine positions earlier: a replaced plan stops there and proves
nothing about the graph bounds.

**Fixed: comment length in `core/seal/seal.ts`.** `validateAssembledBrief`'s JSDoc ran eighteen lines
over a nine-line function, against this repository's standing "a JSDoc block should not be longer
than the function it documents" bar. Trimmed, with the em-dash clause connectors removed.

**Not a defect, verified:**

1. `dotPath` treating a digit-leading word (`"0abc"`) and an empty-string segment as bare identifiers
   is exactly what zod's own `toDotPath` does (`node_modules/zod/v4/core/errors.js:155`, which tests
   `/[^\w$]/` and falls through to the dotted branch on both). The function documents itself as a
   mirror, so matching those edges is the requirement, not a divergence. The comment now says so.
2. Two Markdown tables back to back with no blank line between them do not merge into one silently:
   the second table's header row fails the code-row pattern and is reported as an unparsed row. GFM
   would render them as one table anyway, so the checker and the renderer agree.
3. `invokePort` returning a success when the signal aborts after the port already resolved is what
   AC 5 item 5 specifies: abort translation is tied to the rejection path only. Left as written.
4. A `requestParser`/`responseParser` whose `safeParse` itself throws propagates unhandled. That is
   the `BoundaryParser` contract being violated by the caller, not a boundary failure `invokePort`
   is asked to translate.
5. Six of the ten `RUNTIME_FAULT_CODES` have no thrower yet. AD-28 fixes the registry independently
   of implementation order, exactly as AD-5 already does for `FAILURE_CODES`; the story's Dev Notes
   call this out and `check:ad28-registry` is what keeps it honest.
6. `_bmad-output/shareable/eval-quality-architecture-spine.html` was mechanically regenerated, not
   hand-edited: `npm run check:shareable` reports all 21 committed pages matching the builder byte
   for byte.

**Decisions recorded in this pass:**

1. **The external-import allowlist stays scoped to `core/` and `ports/`.** AC 6's layer items read
   as an internal-edge graph, and its external paragraph names `core/` explicitly. Extending the
   allowlist to `adapters/` would forbid the Node builtins an adapter exists to use, which cannot be
   the intent of the same list that says "adapters/ may import ports/ and core/schemas". `ports/` is
   the one non-core layer with a stated external prohibition (AC 5), so it is the one non-core layer
   gated here. Story 6.1, which builds the concrete ports and adapters, inherits this reading.
2. **`dotPath` stays a private mirror of zod's formatter.** Its symbol and non-word-key branch is
   unreachable through `SealedEvaluatorBrief`, which has no free-form record field, so no test drives
   it. Exporting the function purely to reach that branch would widen a `core/` module's surface for
   a case the schema cannot produce. The branch stays because a later brief-schema field with
   free-form keys would need it, and the JSDoc now records that the mirror is deliberate down to its
   edges.

### File List

Created:
- `src/core/stage-contracts.ts`
- `src/core/compile/compile.ts`
- `src/application/compile.ts`
- `src/application/invoke-port.ts`
- `src/ports/port.ts`
- `scripts/dependency-direction.ts`
- `scripts/discover-source-files.ts` (review pass: the one `src/` walk shared by the gate and the test)
- `scripts/check-dependency-direction.ts`
- `scripts/ad28-registry.ts` (review pass: the pure extraction and comparison behind the AD-28 gate)
- `scripts/check-ad28-registry.ts`
- `tests/compile/compile.test.ts`
- `tests/application/compile.test.ts`
- `tests/application/invoke-port.test.ts`
- `tests/architecture/dependency-direction.test.ts`
- `tests/architecture/ad28-registry.test.ts` (review pass: drift-detection proof for the AD-28 gate)

Modified:
- `src/core/schemas/faults.ts`
- `src/core/seal/seal.ts`
- `tests/canonical/faults.test.ts`
- `tests/seal/seal.test.ts`
- `tests/seal/plan-index.test.ts`
- `tests/compile/helpers.ts` (review pass: now also owns the shared `cleanPopulatedContract` fixture)
- `package.json`
- `.github/workflows/pr-checks.yml` (review pass: `canary-ad28-registry`, and the `Validate` step name now lists the two new checks)
- `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md`
- `_bmad-output/shareable/eval-quality-architecture-spine.html` (regenerated via `npm run build:shareable` after the spine edit)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Final Gate Evidence (AC 8)

Recorded after the review pass above.

- Targeted suites: `tests/compile/compile.test.ts` (43 tests), `tests/architecture/dependency-direction.test.ts` (122 tests), `tests/architecture/ad28-registry.test.ts` (8 tests), `tests/seal/seal.test.ts` (27 tests), plus `tests/application/*` and `tests/canonical/faults.test.ts` — all pass.
- `npm run check:layers`: `54 file(s) scanned under src/, 0 violations`.
- `npm run check:ad28-registry`: `10 codes, set- and order-equal between the AD-28 table and src/core/schemas/faults.ts`.
- `npm run check:shareable`: `21 committed page(s) match the builder byte for byte`.
- `npm run lint:spine`: `total_findings: 0`.
- `npm run validate`: full gate passes: `typecheck`, `lint`, `check:docs` (55 files), `check:shareable`, `lint:spine`, `check:vectors`, `check:schemas`, `check:ad5-registry` (21 codes), `check:ad28-registry` (10 codes), `check:layers` (54 files), `test` (49 files / 1924 tests).
- `npm run build`: passes independently (`validate` does not build).
- Final counts: 49 test files, 1924 tests. Baseline was 44 files / 1715 tests; implementation added 4 files and 157 tests, and the review pass added 1 file and 52 tests.
- Both `canary-ad28-registry` mutations were also run locally against a backed-up copy of `src/core/schemas/faults.ts`: the dropped code exits 1 naming `` `aborted` is in the AD-28 table but missing ``, and the transposed pair exits 1 naming `order mismatch at position 5`. GitHub Actions is not on a paid plan for this repository, so the local run is the proof that matters.
