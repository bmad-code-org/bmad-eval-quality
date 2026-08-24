# Deferred work

One item is currently open (below, under "How to use this file"): the `in-review`/`review`
status-vocabulary drift between epic-2 story files and `sprint-status.yaml`'s documented vocabulary.
It stays open because fixing it means changing the BMad skill's own routing keywords, out of any one
story's scope.

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

- source_spec: `_bmad-output/implementation-artifacts/2-3-the-emitted-brief-scripting-audit.md`
  summary: Story files' `Status:` line uses `in-review` (this story and `2-1-the-direction-prose-generator.md`), a value `sprint-status.yaml`'s own documented vocabulary does not recognize (it documents `backlog`/`ready-for-dev`/`in-progress`/`review`/`done`, no `in-review`).
  evidence: `sprint-status.yaml`'s STATUS DEFINITIONS header lists only `review`, never `in-review`, but both epic-2 stories written so far use `in-review` in their own `Status:` line; the drift is pre-existing (introduced by Story 2.1, not this story) and worth a single terminology decision so future stories don't keep choosing between the two. Left open: fixing it means changing the BMad skill's own routing keywords, out of a story's scope.
