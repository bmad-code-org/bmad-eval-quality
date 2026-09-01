# Deferred work

No items are currently open under "How to use this file." The list below records how each
past item closed.

All five items Story 4.2's own step-04 review opened were closed the same day, 2026-08-25, once
pushed on rather than left queued:

- **AD-16's two forbidden-input checks had no thrower.** Closed in `src/core/compile/forbidden-
  inputs.ts`. `checkForbiddenInputFloor` checks all seven mandatory floor members, and
  `checkScopedResourceReferences` rejects any populated scoped resource list, matching the schema's
  declared failure shape. `tests/compile/forbidden-inputs.test.ts` covers every floor member plus
  null, empty, and populated scoped resources.
- **Unbounded recursion depth over nested `not`/`all`/`any` expressions.** Closed as out of v0's
  stated scope, not as unaddressed: the spine states plainly, twice, that "the package treats a
  caller as a possibly-buggy integration, not as an adversary," that an adversarial trust model
  "would require independent attestation or a runner boundary the package owns," ruled out for v0 by
  ADR-004, and that "upgrading the trust model is a spine amendment, not a hardening exercise." A
  stack-depth guard against an adversarially deep `check` tree is exactly that hardening; it is not
  this or any other v0 story's work to add quietly. Revisit only alongside an actual trust-model
  change.
- **`buildPlanIndex`/`parseEvidenceTarget` could throw a raw `TypeError` on a schema-legal duplicate
  `operationId`.** Closed: `plan-index.ts`'s `buildPlanIndex` now takes a `duplicateIds: 'throw' |
  'unresolved'` option (default `'throw'`, preserving every existing strict caller); Story 4.2's two
  new checks already selected `'unresolved'`, and `reachability.ts`'s `checkEvidenceReachability` now
  does too, so every `core/compile/` caller is total against this schema-legal shape. Its own
  `evaluatePointerReachability` already handled an unresolved step or operation gracefully as
  `unreachable`, so this was a one-line extension of infrastructure already proven correct, not a new
  design. `tests/seal/plan-index.test.ts` covers the option directly.
- **`checkOracleAlignment`'s relation-containment read as near-vacuous for a connective/quantifier
  relation, with nothing proving otherwise.** Closed by demonstration, not by redesign: the "appears
  anywhere in check" semantics are AD-3's own stated rule ("check may be stronger than the
  direction"), not an oversight, so the fix was closing the missing-fixture gap the entry actually
  named. `tests/compile/oracle-alignment.test.ts` now asserts `direction.relation` set to `for-all`,
  `all`, or `not` against a check naming only `for-any`/`existence` still throws — proving the
  containment check is not vacuous, it correctly rejects a relation that is genuinely absent even
  among several other connective/quantifier ops — alongside a positive case where the relation is
  genuinely present, nested one level down.
- **`checkQuantifierOverNonCollection` silently skipped a nested quantifier's own `@`-prefixed
  collection pointer.** Closed: it now walks with the same bound-element substitution
  `oracle-alignment.ts`'s `collectTargets` already threads for direction/check alignment (that file's
  `substitutePointer` is now exported for this reuse), so a nested quantifier's own collection
  pointer resolves to an absolute one before its declared type is checked, rather than being skipped.
  `tests/compile/expression-legality.test.ts` covers both the general substitution case and the bare
  `@/` special case.

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

- source_spec: `7-2-a-monotonic-observation-sequence-and-declared-selector-cardinality.md`
  summary: The published-schema census numbers (`CENSUS_BY_DOCUMENT`, `CENSUS_BY_KEYWORD`,
    `CENSUS_TOTAL`, and the reject-case-length counters) are hand-maintained integer literals
    duplicated across five test files, each cross-referencing the others in a comment; a shared
    derived constant would remove the duplication.
  evidence: Story 7.2's blind-hunter review layer confirmed the pattern spans
    `tests/schemas/constraint-ledger.test.ts`, `publish.test.ts`, `differential.test.ts`,
    `keyword-mutation.test.ts`, and `published-rejection.test.ts`. The pattern predates this story
    (7.1's AC 7 already followed it) and this story only extended it by one more schema change, so
    it is not this story's problem to fix, but every future schema change now has five places to
    update in lockstep and the risk compounds with each one.

- source_spec: `7-3-captured-value-matchers-and-test-data-bindings.md`
  summary: A sealed run record carries no field naming which principal the harness acted as, so
    `selectWithBindings` cannot separate two steps that differ only in the principal they bind. The
    observation-side principal label is the missing half of owed item 3's cross-user case.
  evidence: `{ principal }` matching is presence-only by construction (`src/core/score/bindings.ts`,
    `satisfiesBindings`): the contract declares a name, and the value behind it is provisioned by the
    harness at runtime, which is the whole reason the binding exists rather than a literal. So two
    steps binding `authorization` on one operation, one to `owner` and one to `other-user`, both
    return `several` against a record that exercised both — which is exactly the act-as-A-read-as-B
    shape the two critical-severity cross-user oracles need. Closing it means a new field on
    `Observation` recording the principal label the harness used, which is a third breaking
    `schemaVersion` bump this story's Boundaries exclude. The half this story owns is
    expressibility: those oracles can now be written down at all, and their steps compile and seal.

- source_spec: `7-3-captured-value-matchers-and-test-data-bindings.md`
  summary: `seal` throws a bare `TypeError` when two steps in one direction render to the same
    derived reference after full escalation. It should be a compile-time check reporting a coded
    `StructuralFailure` with an artifact path, the way every other authoring fault does.
  evidence: `renderStepReference` (`src/core/seal/derived-reference.ts`) throws a
    precondition-violation `TypeError` on a tie, and nothing at compile time predicts it, so a
    contract passing all twenty-three checks can still fail at seal time with a stack trace instead
    of a code. `tests/seal/fixtures.ts`'s `irreducibleCollisionPair` is the shape that already did
    this before owed item 3. Captured bindings widen it: two predecessors sharing one operation and
    binding nothing make two siblings capturing from them irreducible too, which is a second way to
    reach the same throw. Closing it means a compile check that runs the escalation ladder over
    each direction's own sibling set and reports a coded failure, which is new scope rather than a
    fix to what owed item 3 built.
