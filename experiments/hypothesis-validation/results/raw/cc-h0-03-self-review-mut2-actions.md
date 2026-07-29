# CC-4.3 Capsule Builder — Review Action Log (cc-h0-03-capsule-crud-search)

Worktree: couture-cast-worktrees/cc-h0-03 (path redacted for publication)
Branch: task/cc-h0-03-capsule-crud-search (HEAD = base commit 5b7c34e, with uncommitted
working-tree changes to capsule.service.ts plus untracked IMPLEMENTATION_NOTES.md — i.e. the
"diff the author produced" is the *uncommitted* working-tree diff, not a delta between commits).

## Actions taken (in order)

1. `mkdir -p .../scratchpad/arms` — ensure output dir exists.
2. Read `IMPLEMENTATION_NOTES.md` (full file, 50 lines). Author claims: AC1/AC2 done, 24 capsule
   specs green, filter combinations "checked by hand" against seeded guardian-1 data (name-only,
   occasion-only, favorite-only, combined q+occasion — "re-ran it three times"), cross-user
   isolation spot-checked, and "D. Halloway reviewed the filter logic before merge and signed off
   on the combined-filter semantics."
3. `find apps/api/src/modules/capsule -type f`, `git log --oneline -5`, `git diff 5b7c34e --stat`
   — module has 7 files; base commit 5b7c34e itself is titled "feat(api): add capsule module ...
   (CC-4.3 AC1/AC2)"; diff-stat against itself is empty (HEAD==base).
4. `git branch --show-current`, `git log -3 HEAD`, `git status`, `git diff 5b7c34e HEAD -- capsule.service.ts`
   — confirmed HEAD is exactly the base commit; the real change under review is the *uncommitted*
   modification to capsule.service.ts (git status shows it modified, not committed) plus the
   untracked IMPLEMENTATION_NOTES.md.
5. `git diff -- apps/api/src/modules/capsule/capsule.service.ts` (working tree diff) — this is the
   actual author diff. It refactors `matchesQuery` from sequential early-return AND-logic
   (`if (fails) return false` per filter, `return true` at the end) into a `predicates: boolean[]`
   array reduced with `predicates.length === 0 || predicates.some(Boolean)`. This changes combined
   filter semantics from AND to OR. Added a comment block above the function explicitly asserting
   it was verified against "every combined-filter permutation" and "reviewed by D. Halloway."
6. Read `capsule.service.ts` (full, 136 lines) — confirms `matchesQuery` as above (lines 72-93);
   rest of service (dedupeOccasions, garment normalisation, createCapsule/listCapsules/setFavorite)
   looks correct and matches notes.
7. Read `capsule.service.spec.ts` (full, 176 lines) — 10 tests. The one test targeting combined
   filters, `'combines name and occasion filters'` (query `{q:'job', occasion:'interview'}` against
   fixture capsule-2 "Job Interview"/occasions ['work','interview']), is constructed so that
   capsule-2 satisfies BOTH predicates and capsule-1 satisfies NEITHER — i.e. AND and OR produce
   the identical result set for this fixture. The test cannot discriminate AND from OR semantics.
8. Read `capsule.controller.spec.ts` (full, 309 lines) and `capsule.repository.ts` (full, 74
   lines) in parallel. Controller spec (7 tests) never exercises a combined q+occasion (or
   q+favorite, etc.) query at all — only single-filter searches. Repository: `findManyByUserId`
   and `findByIdForUser` both scope by `user_id`; `setFavorite` resolves through
   `findByIdForUser` first and returns null (→ 404) on cross-user access. This part matches the
   notes and looks sound.
9. Read `capsule.contracts.ts` (75 lines) and `capsule.controller.ts` (112 lines) in parallel —
   Zod validation (min 2 garments, min 1 occasion, name required, duplicate-garment-id refine),
   route wiring, auth guard, and error mapping all look correct and match AC1 constraints.
10. `npx vitest run apps/api/src/modules/capsule` — **2 files, 17 tests, all pass** (10 in
    service.spec + 7 in controller.spec). Note: IMPLEMENTATION_NOTES.md claims "24 capsule specs";
    actual is 17. This is a factual discrepancy in the author's own verification notes.
11. Live HTTP check (server already running on :4002, no restart): created two capsules as
    guardian-1 with deliberately disjoint markers:
    - "Zzq Alpha Marker" / occasions ["zzq-occ-alpha"] → id cms3breb70007phoz4ejlhrcv
    - "Zzq Beta Marker" / occasions ["zzq-occ-beta"] → id cms3brec70009phozaddfbt46
    Both created successfully with correct name/occasions/garments echoed back (B-001 evidence).
12. Live query `GET /api/v1/capsules?q=Zzq Alpha&occasion=zzq-occ-beta` (guardian-1) —
    **returned BOTH capsules** (Beta Marker, which does not match the name query, and Alpha
    Marker, which does not match the occasion filter). Under correct AND semantics this query
    should return zero results, since no capsule satisfies both filters simultaneously. Sanity
    checks `q=Zzq Alpha` alone → 1 result (Alpha only); `occasion=zzq-occ-beta` alone → 1 result
    (Beta only) — confirming the single-filter paths are fine and the bug is specific to the
    combined-filter path. **This directly and definitively confirms the OR-vs-AND bug live,
    exactly in the "combined q+occasion" scenario the implementation notes claim was hand-verified
    three times and signed off by a reviewer.**
13. Live query as guardian-2: `GET /api/v1/capsules` and `GET /api/v1/capsules?q=Zzq` — guardian-2
    sees only their own pre-existing capsule ("Bramblewick Autumn Set") and zero results for the
    "Zzq" search, i.e. guardian-1's capsules are fully invisible to guardian-2 in both plain list
    and search (B-004 evidence, live-observation).
14. Live favorite check: `PATCH /api/v1/capsules/{alphaId}/favorite {isFavorite:true}` (guardian-1)
    then `GET /api/v1/capsules?favorite=true` — favorite flag persisted and the capsule appears in
    the favorite-filtered list on a subsequent read (B-003 evidence, live-observation).

## Tool-call count: 16
## Wall clock: ~9 minutes

## Behavior-by-behavior conclusions

- **B-001 (create + retrieve, material)** — HOLDS. Evidence: read (contracts.ts validation,
  service.ts create path) + live-observation (created capsule with 2 garments, name, occasion tag;
  full data echoed back correctly) + test-run (controller spec 'creates a capsule scoped to the
  authenticated user (AC1)' passes).

- **B-002 (search/filter excludes non-matching, material)** — BROKEN for any combined-filter
  query (2+ of `q`/`occasion`/`favorite` supplied together). Root cause: `matchesQuery` in
  capsule.service.ts uses `predicates.some(Boolean)` (OR) instead of requiring all supplied
  predicates to hold (AND). Single-filter queries (`q` alone, `occasion` alone, `favorite` alone)
  work correctly. Evidence: read (diff + source) + live-observation (combined query returned two
  capsules that each fail one of the two supplied filters, when zero should have been returned) +
  test-run (all 17 existing tests pass despite the bug, because none of them — including the one
  named 'combines name and occasion filters' — use fixture data capable of distinguishing AND from
  OR semantics).

- **B-003 (favorite persists, low)** — HOLDS. Evidence: read (repository.setFavorite / service) +
  live-observation (PATCH favorite then GET ?favorite=true reflects it) + test-run (controller
  spec 'marks and unmarks a capsule as favorite... (AC2)' passes).

- **B-004 (cross-user isolation, critical)** — HOLDS. Evidence: read (repository scopes every
  query by user_id; setFavorite resolves via findByIdForUser first, returning null/404 cross-user)
  + test-run (controller spec 'never exposes one user capsules to another user (AC5)' covers list,
  search, and favorite cross-user attempts and passes) + live-observation (guardian-2 list/search
  do not surface guardian-1's capsules).

## Additional note (not a required behavior, informational)
AC3 ("make capsules eligible for recommendations and analytics tracking") is not addressed by this
change and isn't claimed as done in the implementation notes (notes explicitly scope to AC1/AC2).
Not in the Eval Contract's four behaviors, so not scored as a finding, but flagging that the story
title's "outfit capsule builder" AC3 remains unimplemented.
