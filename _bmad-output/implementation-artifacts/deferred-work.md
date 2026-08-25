# Deferred work

Five items are currently open under "How to use this file." The prose above that section records
how past items closed.

The `in-review`/`review` status-vocabulary drift between story files' own `Status:` line and
`sprint-status.yaml`'s `development_status` field was investigated on 2026-08-24 and found to be by
design, not closed by rule change: the two fields are owned by different mechanisms for different
purposes (the story file's `Status:` is the BMad build skill's own internal routing state, which
includes the transient `in-review`; `sprint-status.yaml`'s `development_status` is a coarser
human-facing tracker that was only ever designed to distinguish in-progress/awaiting-review/done),
the same dual-vocabulary shape already normalized here for the `Status: done` /
`development_status: review` pairing, and nothing in the codebase cross-validates the two fields.

`regexMatchStepBudget` being unvalidated where `resolveCheck`/`regexMatch` consume it was
investigated on 2026-08-24 and found to be by design: `ScoringPolicy.regexMatchStepBudget`
(`core/schemas/scoring-policy.ts`) is already `z.int().min(1)`, a guard that shipped in Story 3.1
before the deferring story (3.2) was even written, forecloses the `NaN`/negative/non-integer failure
modes at the only place a `ScoringPolicy` is ever constructed, and matches this codebase's own
convention of validating numeric policy fields once at the schema boundary with no re-validation at
downstream consumers.

`evaluatePointerReachability`'s root-collection carve-out never checking a literal array index
against the declared collection's own `expectedCardinality` was closed on 2026-08-24: the carve-out
in `src/core/compile/reachability.ts` now resolves the actual `CollectionLocation` and returns
unreachable when the index is at or past its bound (`exact.count`, or `at-most`/`page-bounded`'s
`max`), the same treatment Decision 8 already gives `stdout`/`stderr`. The fix and its reasoning live
in that function's own comment, with `tests/compile/reachability.test.ts`'s new fixture 38b covering
all three `expectedCardinality` modes both in-bounds and out-of-bounds.

Story 2.3 carried three items, all closed on 2026-08-21 in the same pass a second-round peer review
found them trivially fixable rather than genuinely deferrable: `SealedEvaluatorBrief.directions`
gained `behaviors`' own `.min(1)`; `BriefDirection` gained the `export type` alias every other schema
in the file already has; and the story's own Task 2 now names the `npm run build:shareable` step
explicitly. All three fixes and their reasoning live in
`2-3-the-emitted-brief-scripting-audit.md`'s Completion Notes.

Story 2.2 carried two items, both closed on 2026-08-21 by
`spec-harden-seal-exclusion-guarantee.md`. The fixes and their reasoning live
in `spec-2-2-brief-assembly-exclusions-and-canonical-ordering.md`'s Spec
Change Log: the module-boundary guard's file list and `seal()`'s missing
runtime self-validation.

Story 2.1 carried one item, closed on 2026-08-21: `groupResolvedTargets`'s chain-collapse logic
dropped legal disjoint pairings for after-chains of four or more steps. The fix and its reasoning
live in `2-1-the-direction-prose-generator.md`'s Decision log.

The `check-docs.mjs` ROOTS gap (carried from Story 3.2) was closed on 2026-08-24: `_bmad-output/project-knowledge`
was added to `ROOTS` alongside `_bmad-output/planning-artifacts`, raising the checked-file count from 53 to 55
with no new failures.

Epic 1 itself closed with an empty ledger. Four items were carried here and all four were closed on
2026-08-20. Each one's reasoning lives with the work rather than in this file, which is a queue and not
a record:

- Shareable HTML links usable without repository access, and validation that the export is current
  and canonical: `spec-condense-readme.md`, "Follow-up hardening, closed 2026-08-20".
- Digest-path throughput over large observation and score arrays: story 1.2, Completion Notes
  decision 25. Measured, and closed with no code change.
- Amortising the generated mutant corpus: story 1.5, Review Findings. Cached, and the cost claim
  corrected by measurement.

## How to use this file

An entry belongs here only when the work cannot be done in the pass that found it and the decision
to defer is deliberate. Give it a `source_spec`, a one-line `summary`, and the `evidence` a later
reader needs to pick it up cold. When it is done, delete the entry itself; a terse pointer to where
the outcome and reasoning live (the source spec) may stay in the closure prose above, the way every
closure on record here already does it, so a later reader is not left to guess what was once open.
The rule is about the entry, not about erasing that something was once open.

- source_spec: `_bmad-output/implementation-artifacts/4-2-the-ad-5-registry-as-code-and-the-structural-compile-checks.md`
  summary: AD-16's `forbidden-input-floor-incomplete` and `scoped-reference-resolves-forbidden` codes have no thrower anywhere in `src/`, and no epic currently owns closing that gap.
  evidence: AD-16 binds "brief emission, ingest, isolation-manifest validation," never "compiler," so Epic 4 (which names exactly AD-26, AD-5, AD-28, AD-34, AD-39) correctly excludes it; FR7's own coverage-map row assigns AD-16 to Epic 2 alone, but Epic 2 is already `done` in `sprint-status.yaml` with neither code implemented. Story 4.2's own AC 1 named this gap explicitly but, by this project's standing convention against widening an already-scoped story, did not file it here — filed now so a later reader is not left to guess what was once open.

- source_spec: `_bmad-output/implementation-artifacts/4-2-the-ad-5-registry-as-code-and-the-structural-compile-checks.md`
  summary: No compile-check tree walk (Story 4.1's `reachability.ts`, Story 4.2's `expression-legality.ts` and `oracle-alignment.ts`) caps recursion depth over nested `not`/`all`/`any` expressions, so an adversarially deep `check` tree crashes with an uncaught stack-overflow `RangeError` instead of a coded `StructuralFailure`.
  evidence: `expression-legality.ts`'s `walkExpression` and `oracle-alignment.ts`'s `collectTargets` both recurse once per nested connective with no depth guard, generalizing the identical unguarded shape already present in Story 4.1's `reachability.ts`; no AD-4/AD-5 code names a nesting-depth-exceeded failure for connectives (only `quantifier-nesting-exceeded` is bounded), so today the only failure mode for excessive connective nesting is an uncoded engine crash.

- source_spec: `_bmad-output/implementation-artifacts/4-2-the-ad-5-registry-as-code-and-the-structural-compile-checks.md`
  summary: Strict `buildPlanIndex` callers can still throw a raw uncaught `TypeError` on a schema-legal contract where two `permittedInterfaces` entries declare the same `operationId`.
  evidence: `core/schemas/sealed-run-record.ts:171` states that `Operation.operationId` is scoped to one `PermittedInterface`, so two interfaces may declare the same one. Story 4.2's `checkQuantifierOverNonCollection` and `checkUndeclaredMandatoryInput` now select the index's duplicate-tolerant `unresolved` mode, which keeps those standalone checks total. Story 4.1's compile checks and other strict callers still use the default throw, and the contract grammar still has no interface identifier on an interaction step with which to disambiguate the operation. That remaining cross-artifact design gap stays open here.

- source_spec: `_bmad-output/implementation-artifacts/4-2-the-ad-5-registry-as-code-and-the-structural-compile-checks.md`
  summary: `checkOracleAlignment`'s relation-containment check (Decision 2) degenerates to near-vacuous whenever `direction.relation` names a connective or quantifier op, since almost any non-trivial `check` tree contains that op somewhere; no fixture demonstrates whether a genuine connective-relation mismatch is actually caught.
  evidence: seven of the eight oracles in the shipped `gateCContract` fixture declare `relation: 'all'`, `'not'`, or `'for-all'` rather than a leaf operator; `ops.has(direction.relation)` (`oracle-alignment.ts`) passes as soon as that op name appears anywhere in the tree, with no requirement that it structurally correspond to the direction's own evidence targets. AC 7's own fixture 12 only exercises the leaf-operator case (`relation: 'existence'`).

- source_spec: `_bmad-output/implementation-artifacts/4-2-the-ad-5-registry-as-code-and-the-structural-compile-checks.md`
  summary: `checkQuantifierOverNonCollection` silently skips a nested quantifier's own bound-element-relative (`@`-prefixed) `collection` pointer instead of substituting it against the enclosing quantifier's bound element, so a nested quantifier over an actual scalar field goes structurally undetected.
  evidence: `expression-legality.ts`'s `checkQuantifierOverNonCollection` returns early whenever `collection.pointer.startsWith('@')`; `oracle-alignment.ts`'s `substitutePointer` already solves the identical substitution problem for direction/check alignment but is not reused here. Decision 3 documents the check's `response-body`-channel scoping but never mentions this `@`-prefix narrowing, so it is undocumented as well as unenforced. `checkQuantifierNesting` permits one level of quantifier nesting, so the gap is reachable under today's own admitted grammar.
