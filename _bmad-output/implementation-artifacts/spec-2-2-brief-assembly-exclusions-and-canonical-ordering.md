---
title: 'Brief assembly, exclusions, and canonical ordering'
type: 'feature'
created: '2026-08-21'
status: 'done'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md']
baseline_commit: 'f874a10d8254d748fa2aab67c8745d9003d3255c'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 2.1 renders prose for one oracle's `Direction` at a time, but nothing yet walks a compiled `EvalContract`'s oracles to assemble a full `SealedEvaluatorBrief` — no function carries through `behaviors`/`permittedInterfaces`/`scopedResources`/`budgets`/`safetyLimits`/`probeStepBound`, computes `contractDigest`, or sorts unordered declarations, so AD-16's isolation boundary (the brief carries only what an isolated evaluator may read, byte-reproducibly) is unenforced in code.

**Approach:** Add `seal(contract: EvalContract): SealedEvaluatorBrief` in `src/core/seal/seal.ts`: for each oracle, use Story 2.1's `buildPlanIndex`/`renderDirectionText` to build one `BriefDirection`, carry the remaining brief fields from the contract, sort every semantically-unordered array by a stable key, and compute `contractDigest` via the existing canonical-digest helper — relying on `SealedEvaluatorBrief`'s `strictObject` schema to make exclusion of everything AD-16 forbids structural.

## Boundaries & Constraints

**Always:** `seal()` is pure and deterministic — no filesystem, network, clock, randomness, model call, or evaluator execution (AD-1, AD-2). Every oracle's `direction` must be asserted non-null before calling `renderDirectionText` (throw, never filter/skip — a null direction is a precondition violation, matching the Null-direction row below). Reuse `buildPlanIndex`, `renderDirectionText` (`core/seal/`), and `digestArtifact` (`core/canonical/digest.ts`) — never re-implement rendering or hashing locally. `permittedInterfaces` is a per-element projection, not a carry-through: `PermittedInterface` (`schemas/interface.ts`) has an `operations` field `BriefInterface` does not, so each element maps to `{logicalId, kind}` only, dropping `operations`. `directions` (sorted by `oracleId`), `permittedInterfaces` (sorted by `logicalId`), and `scopedResources` (sorted by `reference`) are each sorted by their natural identifying string before emission, so their content is byte-identical under `interactionPlan`-step and `oracles`-array reordering. `safetyLimits` (`string[]`) is sorted lexicographically; sort-key duplicates are impossible there since equal strings are interchangeable. `behaviors` is carried through in its contract order, unsorted — its own schema doc calls it "carried through unchanged", unlike the other arrays. If two elements of `directions`/`permittedInterfaces`/`scopedResources` share a sort key (the schema enforces no uniqueness on `oracle.id`, `permittedInterface.logicalId`, or `scopedResource.reference`), throw `TypeError` rather than emit an order-dependent result — same precondition-violation convention as `plan-index.ts`'s duplicate-`stepId`/`operationId` guard. `contractDigest = digestArtifact(contract, artifactPath)`: a plain digest of the literal input, so it necessarily differs between two differently-ordered contract objects — this is correct, not a bug (see Design Notes for what "byte-identical under reordering" excludes it from). Assemble only `SealedEvaluatorBrief`'s declared fields; never spread extra contract fields onto it.

**Ask First:** None expected — sort keys are fixed above. If a future field this story didn't anticipate has no obvious unique identifying field, HALT and ask rather than guessing a key.

**Never:** Build the emitted-brief scripting audit (Story 2.3 — separate, downstream). Import from `core/compile/` (doesn't exist yet, Epic 4). Carry `oracle.commentary`, `contract.interactionPlan`, or any step identifier onto the brief. Mint a new AD-5 or AD-28 fault code — use the `TypeError` precondition-violation convention Story 2.1 already established (e.g., for a null `Direction` reaching `seal()`).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Full contract | `gateCContract` (populated, oracles with non-null directions) | Brief with one `BriefDirection` per oracle, `contractDigest` set, arrays sorted, `permittedInterfaces` elements carry no `operations` | N/A |
| Reordered steps/oracles | Same contract, `interactionPlan` steps and the `oracles` array reordered | `canonicalize()` of the two briefs' content fields (`behaviors`/`directions`/`permittedInterfaces`/`scopedResources`/`budgets`/`safetyLimits`/`probeStepBound` — excluding `contractDigest` and lineage, which legitimately track the literal input) is byte-identical; the sorting actually exercised is over `directions`/`permittedInterfaces`/`scopedResources`/`safetyLimits` — `negativeDomain` has no internal members to reorder at its current single-string shape (see Design Notes) | N/A |
| Repeat call | Same contract, called twice | Byte-identical output on every field, `contractDigest` included (same literal input both times) | N/A |
| Null direction | An oracle's `direction` is `null` when it reaches `seal()` | Throws `TypeError`, no partial brief emitted | Precondition violation, not a silent skip |
| Duplicate sort key | Two oracles share `id`, or two `permittedInterfaces`/`scopedResources` elements share `logicalId`/`reference` | Throws `TypeError` | Precondition violation — sort-stability would otherwise silently break byte-identity under reordering |
| Empty scopedResources | `contract.scopedResources === null` | Brief's `scopedResources` is `[]` (brief field is non-nullable) | N/A |
| Excluded fields | Contract has non-null `oracle.commentary` and a populated `interactionPlan` | Neither appears anywhere on the emitted brief | `strictObject` rejects any accidental leak at parse time |

</frozen-after-approval>

## Code Map

- `src/core/schemas/sealed-evaluator-brief.ts` -- target schema: `BriefDirection` (`oracleId`, `text`), `BriefInterface` (`logicalId`, `kind`), `SealedEvaluatorBrief` (`strictObject`: lineage fields, `contractDigest`, `behaviors`, `directions`, `permittedInterfaces`, `scopedResources`, `budgets`, `safetyLimits`, `probeStepBound`)
- `src/core/schemas/eval-contract.ts` -- input schema: `EvalContract` (`oracles`, `behaviors`, `permittedInterfaces`, `scopedResources` nullable, `interactionPlan` [excluded], `budgets`, `safetyLimits`, `probeStepBound`, `forbiddenInputs` [structurally excluded — brief has no field for it])
- `src/core/schemas/oracle.ts` -- `Oracle.direction` (nullable, must be non-null by the time `seal` reads it), `Oracle.commentary` (excluded), `Direction` type
- `src/core/schemas/interface.ts` -- `PermittedInterface` (`logicalId`, `kind`, `operations`) -- `operations` is the per-element field `BriefInterface` drops; no uniqueness constraint on `logicalId`
- `src/core/seal/plan-index.ts` -- `buildPlanIndex(interactionPlan, permittedInterfaces): PlanIndex` -- reuse as-is
- `src/core/seal/direction-prose.ts` -- `renderDirectionText(direction, index): string` -- reuse as-is; throws `TypeError` on an empty `evidenceTargets`
- `src/core/canonical/digest.ts` -- `digestArtifact(value, artifactPath): string` (`"sha256:..."`) -- reuse for `contractDigest`
- `src/core/canonical/canonicalize.ts` -- `canonicalize(value, artifactPath): Uint8Array` -- use for byte-identical test assertions
- `tests/schemas/fixtures/gate-c-contract.ts` (`gateCContract`), `tests/schemas/fixtures/relevance-contracts.ts` (`populatedContract`) -- existing schema-valid full-contract fixtures `seal()` can consume directly
- `src/core/seal/seal.ts` -- NEW: `seal(contract): SealedEvaluatorBrief`
- `tests/seal/seal.test.ts` -- NEW

## Tasks & Acceptance

**Execution:**
- [x] `src/core/seal/seal.ts` -- implement `seal(contract: EvalContract): SealedEvaluatorBrief` -- one `buildPlanIndex` call, one `renderDirectionText` call per oracle, remaining fields carried/defaulted from the contract, arrays sorted, `contractDigest` computed
- [x] `tests/seal/seal.test.ts` -- full-contract assembly test against `gateCContract`/`populatedContract` (including a `permittedInterfaces` element assertion that `operations` is absent); repeat-call (fully byte-identical, `contractDigest` included) and reordered-steps/negative-domains (content fields byte-identical, `contractDigest` excluded from that comparison) tests via `canonicalize()`; `scopedResources`/`safetyLimits` sort-order tests; null-direction and duplicate-sort-key `TypeError` tests; reject-fixture tests proving `commentary`/`interactionPlan`/a step id cannot appear on the brief; empty-`scopedResources` carry-through test

**Acceptance Criteria:**
- Given a compiled contract, when `seal` emits the brief, then it carries behaviours, generated directions, interfaces (identity only, no operation inventory), scoped resources, budgets, and safety limits, and excludes author commentary, the interaction plan, step identifiers, and all seven forbidden inputs.
- Given `directions`, `permittedInterfaces`, `scopedResources`, and `safetyLimits` — the semantically unordered declarations (`behaviors` stays in contract order) — when the brief is emitted, then they render in canonical sorted order. `negativeDomain` itself is a single opaque string with no internal members to sort at the current shape, so the "canonical sorted order" requirement over it is satisfied vacuously (see Design Notes).
- Given contract steps and negative domains reordered, when `seal` runs on both orderings, then the two briefs' content fields are byte-identical (`contractDigest` and lineage excluded from that comparison, since they correctly track the literal input).

## Spec Change Log

- **2026-08-21, review loop 1 (blind-hunter finding).** Boundaries & Constraints cited "(AD-1, AD-38)" for `seal()`'s purity/no-model-call/no-evaluator-execution rule; AD-38 is "The adoption path is staged, and the caller's boundary ships as a worked example" and is unrelated. Corrected to "(AD-1, AD-2)" (AD-1: core purity; AD-2: never executes an evaluator/agent/judge/system-under-test) in both this spec and `src/core/seal/seal.ts`'s own doc comment. No behavioral consequence — citation only.
- **2026-08-21, review loop 1 (blind-hunter finding).** Boundaries & Constraints falsely claimed "Story 2.1's `renderDirectionText` already canonically sorts a direction's own negative domain internally." This contradicted Story 2.1's own Decision 2, which left the negative-domain sorting requirement as an explicit two-way choice for this story to close rather than leave silent. Amended: removed the false claim from Boundaries, softened AC2 and the "Reordered steps/oracles" I/O-matrix row to stop implying `negativeDomain` members get reordered, and added a Design Notes paragraph explicitly closing Story 2.1's Decision 2 (satisfied vacuously by the current single-string shape, no schema change, nothing deferred). No code change was needed — `seal.ts` never touched `negativeDomain` and was already correct. **KEEP:** the closing statement in Design Notes below is the authoritative record; do not reopen this as ambiguous in a future revision without a new finding.
- **2026-08-21, closing review-deferred item 1 of 2 (`spec-harden-seal-exclusion-guarantee.md`).** Story 2.2's review left this open in `deferred-work.md`, closed in that follow-up chore rather than by amending this story's own code beyond what is recorded here. `tests/seal/plan-index.test.ts`'s module-boundary guard switched from a hand-maintained file list to a `readdirSync` listing of `src/core/seal/` filtered to `.isFile()` entries whose name ends in `.ts`, so a future file added to that directory is scanned automatically with no test edit required.
- **2026-08-21, closing review-deferred item 2 of 2 (`spec-harden-seal-exclusion-guarantee.md`).** `seal()` (`src/core/seal/seal.ts`) now validates its fully-assembled return via `SealedEvaluatorBrief.parse()` immediately before returning, rethrowing any `ZodError` as a one-line `TypeError` (issue count plus the first offending path, with the original error attached via `{ cause: error }`) per this file's precondition-violation convention, and never letting a bare `ZodError` escape. The object literal itself keeps an explicit `SealedEvaluatorBrief` type annotation so TypeScript's compile-time excess-property check still runs too: the runtime `.parse()` is a backstop for a future non-literal construction path, not a replacement for the compile-time check. This closes `seal()`'s gap only: it is not extended to any other `core/` function in this pass, since `seal()` is today the sole package-boundary-artifact-minting function in `core/` (Epic 6's publish surface, the next layer that could re-check the brief, is still backlog); the next such function's own story decides its own posture. Both decisions and their reasoning are recorded here rather than escalated into a new `ARCHITECTURE-SPINE.md` revision or ADR, per this repository's standing policy against spine churn over settleable ambiguities. No behavioral change for any valid contract: `seal()`'s output is unchanged, and `npm run validate` is green.

## Design Notes

`SealedEvaluatorBrief.scopedResources` is non-nullable while `EvalContract.scopedResources` is nullable — the schema's own intent is that `seal` always resolves an answer, so `null` on the contract carries through as `[]` on the brief, not `null`. Sort keys are the natural unique identifier already on each element (`oracleId`, `logicalId`, `reference`) — no new comparator abstraction needed, `Array.prototype.sort()` on that string field is sufficient and matches the plain-comparator style already used in `core/seal/`.

**Closing Story 2.1's negative-domain sorting choice (its Decision 2): satisfied vacuously by the current shape, not deferred.** `Direction.negativeDomain` is one opaque `z.string().nullable()` — verbatim pass-through text, never a collection — so there is nothing for `renderDirectionText`, or `seal`, to reorder within it. AD-16, `oracle.ts`'s field description, and epics.md's Story 2.2/EPIC-BRIEF language all describe "negative-domain members" rendering in canonical sorted order; against the shape Story 1.3 actually shipped, a single string has exactly one member and no ordering to vary, so verbatim pass-through already is byte-identical under reordering. Story 2.1 left this open as an explicit two-way choice rather than pre-empting it (either record the requirement as vacuously satisfied and close it, or raise an additive schema change making `negativeDomain` array-shaped under AD-11 and sort its members). This story takes the first branch: closed as-is, no schema change, nothing deferred to a later story. What this story's own sorting work actually exercises — the genuine multi-element arrays — is `directions`, `permittedInterfaces`, `scopedResources`, and `safetyLimits`; `seal.ts` correctly never touches `negativeDomain` directly, since it is already embedded verbatim inside each direction's rendered `text` by Story 2.1's `renderDirectionText` before `seal()` runs.

**Why `contractDigest` sits outside the byte-identical-under-reordering guarantee:** `digestArtifact` hashes canonicalized bytes, and `canonicalize()` preserves array order by design (only object keys sort) — so two contracts differing only in array order necessarily digest differently, by construction, not by omission. Making `contractDigest` order-invariant would mean hashing a normalized copy instead of the actual input, which breaks its own stated job ("binds this brief to the contract it seals" — the literal one passed in, for lineage/audit purposes elsewhere in the system). The epic's byte-identical guarantee is about the brief's *content* — the part an isolated evaluator reads — not about content-addressing metadata that is supposed to track the specific input. The permutation test therefore compares content fields only; a full-object `toEqual` across differently-ordered inputs is the wrong assertion and would never pass.

## Verification

**Commands:**
- `npm run validate` -- expected: green, includes the new `tests/seal/seal.test.ts`
- `npm test -- tests/seal/seal.test.ts` -- expected: all new tests pass

## Suggested Review Order

**Brief assembly**

- Entry point: walks every oracle, assembles the brief, computes `contractDigest`.
  [`seal.ts:55`](../../src/core/seal/seal.ts#L55)

- Shared sort-with-duplicate-guard helper backing `directions`/`permittedInterfaces`/`scopedResources`.
  [`seal.ts:35`](../../src/core/seal/seal.ts#L35)

- `permittedInterfaces` is a per-element projection, not a carry-through — drops `operations`.
  [`seal.ts:80`](../../src/core/seal/seal.ts#L80)

- `behaviors`/`budgets` copied (not aliased) so the sealed brief can't be mutated via the source contract.
  [`seal.ts:118`](../../src/core/seal/seal.ts#L118)

- `contractDigest` deliberately digests the literal input; see Design Notes for why it sits outside the byte-identical-under-reordering guarantee.
  [`seal.ts:111`](../../src/core/seal/seal.ts#L111)

**Determinism and exclusion tests**

- Full-contract assembly: one direction per oracle, digest set, `operations` absent.
  [`seal.test.ts:50`](../../tests/seal/seal.test.ts#L50)

- Reordering `interactionPlan`/`oracles` leaves content fields byte-identical; `contractDigest` legitimately differs.
  [`seal.test.ts:129`](../../tests/seal/seal.test.ts#L129)

- Sort-order coverage for every semantically-unordered array.
  [`seal.test.ts:157`](../../tests/seal/seal.test.ts#L157)

- `behaviors` order-preservation, using a deliberately-descending fixture so a sort regression is actually catchable.
  [`seal.test.ts:211`](../../tests/seal/seal.test.ts#L211)

- Direct `probeStepBound` passthrough assertions (null and non-null cases).
  [`seal.test.ts:109`](../../tests/seal/seal.test.ts#L109)

- Reject-fixture proof that `strictObject` rejects `commentary`/`interactionPlan`/a step id/the forbidden-input floor.
  [`seal.test.ts:319`](../../tests/seal/seal.test.ts#L319)

**Peripherals**

- Module-boundary guard extended to cover `seal.ts` alongside the other three `core/seal/` files.
  [`plan-index.test.ts:257`](../../tests/seal/plan-index.test.ts#L257)

- Sprint tracking and story 2.1's status flip (both settled as part of this session, ahead of this story).
  [`sprint-status.yaml`](sprint-status.yaml) · [`2-1-the-direction-prose-generator.md`](2-1-the-direction-prose-generator.md)

- Two review findings deliberately deferred rather than fixed in this pass.
  [`deferred-work.md`](deferred-work.md)
