---
title: "Harden seal()'s exclusion guarantee"
type: 'chore'
created: '2026-08-21'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'f874a10d8254d748fa2aab67c8745d9003d3255c'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 2.2's review left two closure items open in `deferred-work.md`. First, `tests/seal/plan-index.test.ts`'s module-boundary guard hand-maintains a fixed file list instead of reading `core/seal/`'s directory, so the next file added there goes unchecked unless someone remembers to extend the array. Second, `seal()` (`src/core/seal/seal.ts`) never runtime-validates its own return against `SealedEvaluatorBrief` — only TypeScript's compile-time excess-property check on the literal return object enforces AD-16's exclusion guarantee, with no backstop should a future non-literal construction path replace it.

**Approach:** Switch the module-boundary guard to `readdirSync` over `src/core/seal/`. On the runtime-validation question: decide yes, scoped to `seal()` only, since it is currently the sole package-boundary-artifact-minting function in `core/` and today the only enforcement layer for AD-16 (Epic 6's publish surface, the next layer that could re-check the brief, is still backlog). Implement `SealedEvaluatorBrief.parse()` inside `seal()` immediately before return, rethrowing a validation failure as `TypeError` per this file's existing precondition-violation convention.

## Boundaries & Constraints

**Always:** Keep the module-boundary guard's precise import-specifier check (`matchAll` on `from ['"]...['"]`) and its `core/compile` exclusion assertion; only the file-list source changes, from a hand-written array to a `readdirSync` listing of `src/core/seal/` filtered to `.ts` files. `seal()`'s new self-validation call validates the fully-assembled object and, on failure, throws `TypeError` — never lets a bare `ZodError` escape, never mints a new AD-28 fault code. Record both decisions and their reasoning in this spec's Design Notes so a later reader does not re-litigate them.

**Ask First:** None expected — both closures are scoped exactly as described above.

**Never:** Extend runtime self-validation to any other `core/` function in this pass — this closes `seal()`'s gap only; when the next package-boundary-artifact-minting function is built (if any, before Epic 6), that function's own story decides its posture. Do not escalate the runtime-validation question into a new `ARCHITECTURE-SPINE.md` revision or ADR.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| New file added to `core/seal/` | A future `.ts` file lands in `src/core/seal/` | Module-boundary test picks it up automatically, no test-file edit needed | N/A |
| `seal()` on a valid contract | `sealableGateCContract` / `populatedContract` (existing fixtures) | Return value passes `SealedEvaluatorBrief.parse()` internally; output identical to before this change | N/A |
| Hypothetical internal corruption | `seal()`'s assembled object fails `SealedEvaluatorBrief.parse()` (unreachable today, given literal construction) | Throws `TypeError`, never a leaked malformed brief | Precondition violation, matching `seal.ts`'s existing convention |

</frozen-after-approval>

## Code Map

- `tests/seal/plan-index.test.ts:254-276` -- `describe('module boundary', ...)` -- replace the hand-written `files` array with a `readdirSync` listing of `src/core/seal/`
- `src/core/seal/seal.ts:86-128` -- `seal()`'s return statement -- validate the assembled object via `SealedEvaluatorBrief.parse()`, catch `ZodError`, rethrow `TypeError`
- `src/core/schemas/sealed-evaluator-brief.ts` -- `SealedEvaluatorBrief` -- newly imported into production code (`seal.ts`); today only test fixtures call `.parse()`/`.safeParse()` anywhere in this repo
- `tests/seal/seal.test.ts:295-329` -- existing reject-fixture tests already call `SealedEvaluatorBrief.safeParse()` directly; unaffected, add one new assertion alongside them
- `_bmad-output/implementation-artifacts/deferred-work.md` -- delete both closed entries per the file's own "How to use this file" convention
- `_bmad-output/implementation-artifacts/spec-2-2-brief-assembly-exclusions-and-canonical-ordering.md` -- append a Spec Change Log entry recording both outcomes

## Tasks & Acceptance

**Execution:**
- [x] `tests/seal/plan-index.test.ts` -- swap the `files` array for a `readdirSync`-driven, `.ts`-filtered listing of `src/core/seal/` -- closes the "next file goes unchecked" gap
- [x] `src/core/seal/seal.ts` -- import `SealedEvaluatorBrief`, validate the assembled brief via `.parse()` before return, rethrow a validation failure as `TypeError` -- closes the runtime-validation gap for `seal()`
- [x] `tests/seal/seal.test.ts` -- add one assertion that `seal()`'s output round-trips through `SealedEvaluatorBrief.safeParse()` successfully, documenting the new internal invariant
- [x] `_bmad-output/implementation-artifacts/spec-2-2-brief-assembly-exclusions-and-canonical-ordering.md` -- append a Spec Change Log entry recording the decision and its reasoning
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- delete both closed entries

**Acceptance Criteria:**
- Given a new file added to `src/core/seal/`, when `tests/seal/plan-index.test.ts` runs, then it is scanned for a `core/compile` import with no test-file edit required.
- Given any existing valid contract fixture, when `seal()` runs, then its return value is unchanged from before this change and internally satisfies `SealedEvaluatorBrief.parse()`.
- Given both deferred items closed, when `npm run validate` runs, then it is green and `deferred-work.md` carries no open entries.

## Spec Change Log

## Design Notes

**Why `seal()` and not every `core/` function.** No production code anywhere in this repository calls `.parse()`/`.safeParse()` today — confirmed by search; schemas are compile-time contracts and test-fixture guards, not a runtime-validated boundary, anywhere yet. `seal()` is the principled exception: its entire job, per its own doc comment and AD-16, is minting "the only artifact that reaches the executing caller" — the isolation boundary the epic's central measured claim depends on. Today that boundary's only enforcement is the TS excess-property check on `seal()`'s literal return; nothing later in the pipeline re-checks it, since Epic 6's publish surface (the layer that could) is still backlog. That makes `seal()`, uniquely among current `core/` functions, a package-boundary-artifact mint rather than an internal pure transform — the same distinction that already separates `schemas/`+`canonical/` from the rest of `core/`. Extending self-validation to every `core/` function would be undirected defensive programming with no boundary to point at; scoping it to `seal()` alone follows the one line the codebase already draws, rather than inventing an arbitrary carve-out. Whether the next boundary-minting function adopts the same posture is that function's own story's call, not pre-mandated here.

**Why the added `.parse()` call needs no separate benchmark.** `seal()` runs once per contract, not in a hot loop: adding one more pass over a call already dominated by other work is negligible by construction, not by measurement. In the same call, `seal()` already runs `digestArtifact` over the entire input `contract`: a strictly larger object than the assembled brief, since the brief is a projection that drops fields (`interactionPlan`, `commentary`, `forbiddenInputs`) and never adds any. `digestArtifact` itself does more work per byte than a schema parse: it canonicalizes (recursively walks and key-sorts) the whole contract, then hashes the canonical bytes. `SealedEvaluatorBrief.parse()` walks a smaller object once with no hashing at all. The new validation pass is therefore the same order of magnitude of work `seal()` was already unconditionally paying for on every call, over a smaller input, so no separate benchmark is warranted here.

## Verification

**Commands:**
- `npm run validate` -- expected: green
- `npm test -- tests/seal/` -- expected: all seal tests pass, including the directory-driven module-boundary test and the new self-validation assertion

## Suggested Review Order

**Runtime self-validation**

- Entry point: assembles the brief, then validates it against `SealedEvaluatorBrief` before returning.
  [`seal.ts:55`](../../src/core/seal/seal.ts#L55)

- The `try`/`catch` closing the gap: `ZodError` becomes a one-line `TypeError` with `{ cause }`; anything else is an unreachable defensive rethrow.
  [`seal.ts:150`](../../src/core/seal/seal.ts#L150)

- The literal keeps its explicit type annotation, so TypeScript's compile-time check still runs alongside the new runtime one.
  [`seal.ts:94`](../../src/core/seal/seal.ts#L94)

**Directory-driven module-boundary guard**

- `readdirSync` replaces the hand-maintained file array; `withFileTypes`/`isFile()` guards against a hypothetical `*.ts`-named directory.
  [`plan-index.test.ts:256`](../../tests/seal/plan-index.test.ts#L256)

**Self-validation test coverage**

- Asserts `seal()`'s output round-trips through `SealedEvaluatorBrief.safeParse()`; comment is explicit about what this test can't prove.
  [`seal.test.ts:295`](../../tests/seal/seal.test.ts#L295)

- The `.data` equality check, not just `.success`: a free, stronger assertion given no schema in the chain transforms.
  [`seal.test.ts:315`](../../tests/seal/seal.test.ts#L315)

**Documentation closure**

- The runtime-validation decision, recorded as its own bullet separate from the module-boundary closure.
  [`spec-2-2-brief-assembly-exclusions-and-canonical-ordering.md:71`](./spec-2-2-brief-assembly-exclusions-and-canonical-ordering.md#L71)

- `deferred-work.md`'s own convention reconciled with what every closure on record there actually does.
  [`deferred-work.md:24`](./deferred-work.md#L24)
