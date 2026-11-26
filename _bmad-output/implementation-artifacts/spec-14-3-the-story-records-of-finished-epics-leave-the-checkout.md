---
title: 'The story records of finished epics leave the checkout'
type: 'chore'
ticket: '14-3'
created: '2026-11-26'
status: 'built'
baseline_revision: '2601bf5e360d4b963e89c591ba1908e70ca9cb56'
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-14-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The checkout carries the story records of Epics 1 to 11, which are `done` in the ledger and read by no current work except Story 11.1, which the doc-claims gate opens at `scripts/doc-claim-sources.ts:350-355`. At base `2601bf5` they are 55 files and 3,882,133 bytes, 26.4% of the 14,728,560 tracked bytes.

**Approach:** Remove every numbered story file of Epics 1 to 11 under `_bmad-output/implementation-artifacts/` except 11.1, in one commit with no history rewrite. Add one line at the top of `_bmad-output/project-knowledge/learning-path-step-by-step.md` saying those records are in history at tag `v10.1.1`, and repair no other reference. Move 14-2 to `done` and 14-3 to `review` in `sprint-status.yaml`.

## Boundaries & Constraints

**Always:** Keep 11.1, the story files of Epics 12, 13 and 14, `sprint-status.yaml`, `deferred-work.md`, every `epic-*-context.md`, every `spec-*.md` and the other unnumbered files (`docs-rework-brief.md`, `handover-check-resolution-and-require-shorthand.md`, `pending-release.md`). The ledger's `done` decides; a story header still saying review holds no file back. Report tracked bytes and file counts by group at base and head, with no statement about installed size. The packed tarball is identical to base.

**Never:** Touch `src/`, `schemas/`, `corpus/`, `scripts/`, `tests/`, `docs/`, `.github/`, `eval-quality.config.json` or any gate, configuration entry or fixture. Repair references one by one. Add a `CHANGELOG.md` entry: no consumer notices a change outside the package's `files` list. Rewrite history or force-push. Do Story 14.4's Shard Pro work, which runs in a separate worktree.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Member comparison | `npm pack` of base `2601bf5` and head, same locked tools | Sorted member paths, modes and SHA-256 identical; zero differences ends the package and TeA check | Any differing member blocks the PR |
| Removal set | `git ls-files` at base, story files `N-M-*.md` with N in 1..11, minus `11-1-*` | 55 files removed; `git diff --diff-filter=D --name-only` lists exactly that set | A mismatch blocks the commit |
| Doc-claims gate | `check:doc-claims` reads `11-1-whether-tool-use-evaluation-is-one-gap-or-two.md` | Exit 0 | A failure means 11.1 was removed |

</frozen-after-approval>

## Code Map

- `_bmad-output/implementation-artifacts/` -- 81 tracked files at base; 55 removed, 26 kept.
- `scripts/doc-claim-sources.ts:350-355` -- `toolUseRoutePinIsCurrent` reads the 11.1 story file; the only code reference to any story file.
- `scripts/check-docs.mjs:9-15` -- structural Markdown checks over `_bmad-output/planning-artifacts` and `_bmad-output/project-knowledge`; it checks no links, so the learning path's dangling story paths stay legal.
- `tools/validate-doc-links.js:8` -- link check rooted at `docs/`; it never reads `_bmad-output/`.
- `_bmad-output/project-knowledge/learning-path-step-by-step.md` -- 56 references to removed stories; gets the one pointer line below its title.
- Retained files that name removed stories (`deferred-work.md`, `spec-2-2-*.md`, `sprint-status.yaml` keys): left as they are.
- `package.json` `files` -- `dist`, `schemas`, `corpus`, `README.md`, `LICENSE`; `_bmad-output/` is outside it.

## Tasks & Acceptance

**Execution:**
- [x] `_bmad-output/implementation-artifacts/{1..11}-*-*.md` except `11-1-*` -- `git rm` the 55 files -- the story's removal.
- [x] `_bmad-output/project-knowledge/learning-path-step-by-step.md` -- one line after the H1 naming tag `v10.1.1`, the 11.1 exception, and how to read a record from it.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- 14-2 `done`, 14-3 `review`.
- [x] `_bmad-output/implementation-artifacts/spec-14-2-the-readme-maps-the-seven-rules-to-a-prose-skill.md` -- `status: 'done'`, matching the ledger as 14.1's spec does.

**Acceptance Criteria:**
- Given `git diff 2601bf5 --stat`, when read, then it shows the 55 deletions, the learning-path line, the ledger lines, the 14.2 spec status and this spec, and nothing else.
- Given `npm run validate`, `npm run docs:build` and `npm run docs:validate-links`, when run, then all exit 0 with no gate, configuration entry or fixture changed.

## Implementation Notes

Oneshot route: three edits plus a mechanical deletion; no code.

**Base measure (`2601bf5`), tracked files and bytes from `git ls-tree -r -l`:**

| Group | Files | Bytes |
|---|---:|---:|
| repository | 906 | 14,728,560 |
| `src/` | 145 | 1,346,812 |
| `_bmad-output/` | 157 | 6,733,023 |
| `_bmad-output/implementation-artifacts/` | 81 | 4,407,435 |
| Epics 1 to 11 story files except 11.1 | 55 | 3,882,133 |
| story files kept (11.1, Epics 12 to 14) | 6 | 280,967 |
| other implementation artifacts | 20 | 244,335 |
| rest of repository | 604 | 6,648,725 |

The 55 files and 3,882,133 bytes match the epic's count at `65b24b5`. The repository grew by 3 files and 53,932 bytes since then: the 3 files are the Epic 14 context and the 14.1 and 14.2 specs, and the largest byte growth is `epics.md` (+19,968). So the share is 26.4% at this base against the epic's 26.5%. Citations re-read at `2601bf5`: `scripts/doc-claim-sources.ts:350-355` still names the 11.1 file; nothing moved.

**Head measure, same method:**

| Group | Files | Bytes |
|---|---:|---:|
| repository | 852 | 10,855,216 |
| `src/` | 145 | 1,346,812 |
| `_bmad-output/` | 103 | 2,859,679 |
| `_bmad-output/implementation-artifacts/` | 27 | 533,923 |
| Epics 1 to 11 story files except 11.1 | 0 | 0 |
| story files kept (11.1, Epics 12 to 14) | 6 | 280,967 |
| other implementation artifacts | 21 | 252,956 |
| rest of repository | 604 | 6,648,725 |

The other implementation artifacts gain this spec; the learning-path line and the two status edits account for the rest of the `_bmad-output/` difference.

**Evidence (2026-11-26):** all 55 removed paths exist at `v10.1.1` (`git cat-file -e`), and the staged deletions equal the removal set exactly. `npm run validate` exit 0 (5,466 tests, 157 files); `npm run docs:build` and `npm run docs:validate-links` exit 0. Package check: base `2601bf5` (fresh worktree, `npm ci`, `npm run build`) and head packed with Node 24.22.3 and npm 11.19.1 give 351 file members each, with identical sorted paths, modes and SHA-256. Zero member differences ends the package and TeA check, so TeA was not run.

## Verification

**Commands:**
- `npm run validate` -- expected: exit 0 (includes `check:docs`, `check:doc-claims`, `check:shareable`).
- `npm run docs:build && npm run docs:validate-links` -- expected: exit 0.
- Package check (scratchpad): pack base `2601bf5` from a fresh worktree after `npm ci && npm run build`, pack head the same way with the same Node and npm, then compare sorted member paths, modes and SHA-256 -- expected: zero differences, which ends the package and TeA check.
- Measure script (scratchpad) at head -- expected: the removed group at 0 files, every other group unchanged except `_bmad-output/` and the repository total.

## Review Triage Log

Quick lens, pass 1 (high 0, medium 3, low 3, false 0, maybe-false 0). All patched.

- medium, patch: the learning-path line said the records of Epics 1 to 11 left the checkout, which is false for 11.1, still tracked and still named at line 3775. The line now names the 11.1 exception.
- medium, patch: the head measure the story requires was missing. Recorded above after the commit's tree was measured.
- medium, patch: the package check and gate runs had no recorded results and the tasks were unticked. The evidence paragraph records them and the tasks are ticked.
- low, patch: spec `status` said in-progress while the ledger said review. Now `built`.
- low, patch: the ledger marks 14-2 `done` while its spec said `built`. The 14.2 spec now says `done`, as 14.1's does, and the diff-stat criterion names that edit.
- low, patch: the growth since `65b24b5` was attributed to the wrong files; `epics.md` (+19,968) is the largest share. Corrected.
