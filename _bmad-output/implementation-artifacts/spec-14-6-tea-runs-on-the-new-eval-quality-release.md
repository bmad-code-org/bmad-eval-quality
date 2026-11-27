---
title: 'TeA runs on the new eval-quality release'
type: 'chore'
ticket: '14-6'
created: '2026-11-26'
status: 'done'
baseline_revision: '93856e2f740712867eedc6284d563cd3707f3e83'
route: 'oneshot'
route_source: 'auto'
risk: 'medium'
review: 'thorough'
review_source: 'pinned'
lenses_ran: ['codex']
review_loop_iteration: 5
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-14-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** TeA's lockfile pins `eval-quality` 10.1.1, and `main` carries a shipped change since then (Story 14.2's README sentence), so TeA Evaluate installs a release that is behind what this repository publishes.

**Approach:** Cut a patch release from `main` with the publish workflow, verify npm, the tag and the GitHub release agree and the published members match a local pack of the tag, then refresh TeA's lockfile on a branch so `eval-quality` is the only package whose version moves, and prove zero regressions by running TeA's full chain on its base and head.

## Boundaries & Constraints

**Always:** TeA's manifest keeps `eval-quality` at `latest` and its peer floor at `>=10.1.1`. Every other TeA file changes only where TeA's own rules require it. A test that passes on TeA's base and fails on its head blocks until its cause is fixed. This story's file records the release and the TeA pull request.

**Never:** Weaken or reconfigure a gate, change TeA's fixtures, baselines, scoring policy or release wiring, release TeA, merge either pull request, touch Story 14.5's worktree or files.

**Decisions (the repository owner, through the Epic 14 coordinator, 2026-11-26):** The release may run before Story 14.5 merges, because 14.5 ships only `_bmad-output` documents. The "no change to TeA's fixtures, baselines" boundary is amended for this story only, and only so far as re-measuring TeA's engine-version baselines and current-engine seal manifest with TeA's own `tools/refresh-evaluate-baselines.js` and `tools/refresh-evaluate-seals.js`, as TeA #497 and #519 did, with all 108 evidence artifacts byte-identical and every evidence and strength decision unchanged. Nothing else in TeA's fixtures or baselines changes. The pre-existing macOS tutorial fix goes to TeA in its own pull request, and the lockfile pull request is stacked on it. The coordinator's words: "Open the macOS docs-tutorial fix as its own TeA PR, rebase #530 onto it". Rebasing an open pull request rewrites its branch, so that instruction is the owner's exception to Epic 14's "no history rewrite and no force-push", limited to #530's feature branch `chore/eval-quality-10-1-2`, pushed once with a lease on `e92c7cd8a`. No commit on `main` in either repository was rewritten, and the replaced commits `9c11f4d61`, `e822d8d42` and `e92c7cd8a` are named below.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Release | `publish.yml` dispatched on `main` with `bump=patch` | npm `latest`, tag `vX.Y.Z` and the GitHub release name one version; the npm tarball equals a local pack of the tag | A mismatch is reported and the TeA step waits |
| Lock refresh | TeA `c7dfa7cfb`, lock at 10.1.1 | `package-lock.json` changes only the `eval-quality` entry's version, resolved URL and integrity | Any other moved package is reverted |
| Lockfile age | Release younger than TeA's 7-day window | `test:lockfile-age` passes, because `eval-quality.config.json` excludes `eval-quality` by name | The gate is never edited |
| Regressions | Every script in TeA's `npm test` chain run on base and head | No script passes on base and fails on head | A head-only failure is fixed at its cause |

</frozen-after-approval>

## Implementation Notes

Oneshot: the change is a release dispatch, a four-line lockfile edit in TeA and this record.

**Order.** Story 14.6 started before Story 14.5 merged, at the repository owner's direction. The coordinator's brief: "The owner wants it now: release eval-quality and move TeA onto the latest release with ZERO regressions. Story 14.5 ... is still running in another worktree; do not wait for it". That is safe because Story 14.5 ships only `_bmad-output` documents, and `package.json` `files` publishes `dist`, `schemas`, `corpus`, `README.md` and `LICENSE`. Nothing Story 14.5 adds can be a package member, so the release carries the same members it would carry after 14.5 merged. The release commit `93bad78` landed first, and Story 14.5 merged as #233 (`74f9292`) at 20:03:59Z, a minute later. `git diff --name-only 93bad78 74f9292` names only `_bmad-output/` paths. Story 14.7, added to the epic after this story started and independent of it, merged as #235 (`10eba24`), and `git diff --name-only 74f9292 10eba24` names only `_bmad-output/` paths too, so 10.1.2 also carries every package member the epic's seven stories ship.

**Shipped changes since 10.1.1.** `git diff --name-only v10.1.1 93856e2` names three paths outside `_bmad-output/`: `CHANGELOG.md`, `README.md` and `docs/how-to/evaluate-skill-behavior.md`. Only `README.md` is a package member, and `CHANGELOG.md` `[Unreleased]` already records it (Story 14.2), so no changelog pull request was needed.

**The release.** `gh workflow run publish.yml --ref main -f bump=patch` ran as run 45888028402 from `93856e2f740712867eedc6284d563cd3707f3e83` and finished green. It committed `chore: release v10.1.2 [skip ci]` as `93bad78586045dc9b963539955f64701ed2efd82`, which stamps `package.json`, `package-lock.json`, `src/index.ts`, `src/core/version.ts` and `CHANGELOG.md`.

| Source | Reads |
|---|---|
| npm `eval-quality@latest` | `10.1.2`, `gitHead` `93bad78586045dc9b963539955f64701ed2efd82`, `dist-tags.latest` `10.1.2` |
| git tag `v10.1.2` | `93bad78586045dc9b963539955f64701ed2efd82` |
| GitHub release `v10.1.2` | published 2026-11-26T20:04:51Z, not draft or prerelease, the repository's latest release, body is the `[10.1.2]` section |

**Members.** `npm pack` of a clean `npm ci` checkout at `v10.1.2` and `npm pack eval-quality@10.1.2` from the registry each hold 351 files, with zero differences in sorted path, mode and SHA-256. Against the published 10.1.1 tarball, six of 351 members differ: `package/README.md` (Story 14.2's sentence) and five that change only the version string, `package/package.json`, `dist/index.js`, `dist/index.d.ts`, `dist/core/version.js` and `dist/core/version.d.ts` (`VERSION` and `ENGINE_VERSION` from `10.1.1` to `10.1.2`). Against a clean pack of `93856e2`, the commit the release was cut from and the tree Story 14.3's package and TeA check measured, all 351 paths and modes match and the same five version members are the only differences. The README sentence is the one Story 14.2's package and TeA check passed (`spec-14-2-the-readme-maps-the-seven-rules-to-a-prose-skill.md`).

**TeA's lockfile.** `npm update eval-quality --package-lock-only` moved `eval-quality` and also pruned two optional mongoose peers, `node_modules/mongoose/node_modules/gcp-metadata` and `google-logging-utils`, which TeA #497 kept on purpose in its commit "fix(deps): keep the lockfile's optional mongoose peers". The lock edit keeps only the `node_modules/eval-quality` entry's `version`, `resolved` and `integrity`, which is what TeA #519 changed when it adopted 10.1.1. `package.json` keeps `"eval-quality": "latest"` and the peer floor `>=10.1.1`.

**TeA's pull requests.** Both start from `c7dfa7cfbb605ca59b046f2982085f2a07cdcf26` and merge in this order.

| Pull request | Branch | Commits |
|---|---|---|
| [#531](https://github.com/bmad-code-org/bmad-method-test-architecture-enterprise/pull/531), the tutorial line | `docs/tutorial-macos-run-line` | `97fa2308e` |
| [#530](https://github.com/bmad-code-org/bmad-method-test-architecture-enterprise/pull/530), the lock and the re-measurement | `chore/eval-quality-10-1-2`, stacked on #531 | `97fa2308e`, `87e08b041` (the lock), `6b9ea8cdb` (the baselines and seals) |

#530 first carried all three changes on one branch as `9c11f4d61`, `e822d8d42` and `e92c7cd8a`. When the tutorial fix moved to #531, its branch was rebuilt on #531 and force-pushed with a lease. The rebuilt head's tree, `43c3d0f3`, equals the old head's.

**Merging them.** TeA allows merge commits, squash and rebase. #531 merges first with a merge commit, the one method that keeps `97fa2308e` itself on `main`; a squash or a rebase gives `main` a different commit and leaves the tutorial change inside #530's diff. Before #530 merges, in a TeA checkout after `git fetch origin`, `git merge-base --is-ancestor 97fa2308ed8020252e8ddd918afb0fdb0f3b045f origin/main` exits 0, and `gh api --paginate 'repos/bmad-code-org/bmad-method-test-architecture-enterprise/pulls/530/files?per_page=100' --jq '.[].filename'` names only `package-lock.json`, `test/evaluate-baseline-refresh.json`, `test/fixtures/evaluate-engine-seals/manifest.json` and the re-measured `baseline/` folders. `gh pr diff` cannot serve this check: GitHub refuses a pull request diff above 300 files (HTTP 406, `too_large`), and #530 changes 303.

**The engine version reaches TeA's fixtures.** On the lock-only commit `9c11f4d611d92657fffd22f5d50984bc066c88a5` the chain failed 24 scripts. Two are the macOS failures below, which fail on base too. The other 22 refuse the engine version, each with the first diagnostic its log shows:

| Scripts | First diagnostic |
|---|---|
| `test:evaluate-authoring`, `test:evaluate-gap-loop` | "re-record current-engine seals with tools/refresh-evaluate-seals.js" (`'10.1.1' !== '10.1.2'`) |
| `test:evaluate-ci-gates` and the seven `test:evaluate-ci-repositories:*` scripts | "\<evaluation\>: the baseline was recorded on another engine release; re-record it with compare --accept" |
| `test:evaluate-ci-tiers` and the eleven `test:evaluate-pr-*` scripts | "\<evaluation\>: the baseline was recorded on eval-quality 10.1.1, the installed release is 10.1.2; re-record it with compare --accept" |

`test:evaluate-ci-render` passed on that commit. TeA records the engine version in its current-engine seal manifest and its accepted baselines, so the epic's "no change to TeA's fixtures, baselines" cannot hold for any engine release, a version-only patch included. TeA's own process covers this, as #497 and #519 show: `node tools/refresh-evaluate-baselines.js --source c7dfa7cfb` re-scored the fourteen accepted baselines from their original sealed observations with no target or model run, and refuses to accept unless the score is zero with identical evidence and strength decisions. `node tools/refresh-evaluate-seals.js --source c7dfa7cfb` refuses a seal that changed beyond direction wording, and changed only `test/fixtures/evaluate-engine-seals/manifest.json`'s source and engine. Of the 302 files the refresh touched, 108 are the evidence artifacts and every one is a 100% rename into its new score invocation. After normalizing invocation ids, digests, timestamps and the version, the added and removed lines are identical except the receipt's `originalScoringEngine`, which now reads `10.1.1`, the engine the replaced baselines were measured on. All 22 scripts then pass on `e822d8d42`.

**A pre-existing macOS failure, fixed in #531.** `test:docs-tutorial` fails on `c7dfa7cfb` on macOS. Since TeA 4.6.1 the `run` summary on macOS reads `… sealed over clean, mutated:M-001; the sandbox refused every ungranted read, but macOS logs only some refusals, so the observed reads listed for these 6 trials are a lower bound (…); score them …`, and the tutorial's key line expects `mutated:M-001; score them` with no wildcard between. TeA's CI runs the full chain, and so the tutorial, only in shards on `ubuntu-latest`; its one `windows-latest` job runs focused supervision checks, and no job runs on macOS. The key line now reads `mutated:M-001…; score them`, the page says why macOS adds the note, and `CHANGELOG.md` `[Unreleased]` records it under Fixed, as TeA's CONTRIBUTING asks of a documentation fix.

**A pre-existing macOS failure, diagnosed and not in the pull request.** `test:evaluate-preflight` fails 28 checks on `c7dfa7cfb` (of 430) and on the head (of 423), with the same 28 messages, on macOS only, with `exit 12` and "the audit's log stream lacks a report of the trial that the report meter's stream delivered". The product is right and the case is stale. Its observer stub, `test/fixtures/evaluate/drop-log.cjs`, drops ` deny` lines from the sandbox's token stream and passes them to the report meter's stream, which is the loss TeA #529's `reconcile()` exists to refuse. #529 moved the run suite's cases on that stub to expect exit 12 and missed this Darwin-only preflight case. A fix that gives the stub a reader argument, runs the old case over a drop both streams see and adds a case that must still exit 12, passes 471 of 471 preflight checks and every confinement and run suite. It sits uncommitted on `fix/macos-audit-missed` because its commit was refused by the session's permission check, and goes to the owner.

**TeA's other files.** Only the ones above change. `CHANGELOG.md` carries the tutorial entry and none for the lock. TeA's CONTRIBUTING asks for user-facing, documentation, CI, release and bug-fix entries, and TeA's npm `files` (`skills`, `cli`, `.claude-plugin`, `README.md`, `LICENSE`) leave out `package-lock.json`, `test/` and `docs/`, so no installed byte changes for a TeA user. #519 wrote "Require eval-quality 10.1.1" because it moved the peer floor, and this change leaves the floor alone. `.lockfile-age-cache.json`: the gate reads a cached publication time and fetches what is missing, and `eval-quality.config.json` excludes `eval-quality` from `lockfile-age` by name, so the gate never asks for it. The cache has held `eval-quality@10.1.0` since #519 moved the lock to 10.1.1.

**Regressions.** Every script of TeA's 190-script `npm test` chain ran on its own, so one failure does not stop the chain, after `npm ci` on each revision, with Node 24.22.3 and npm 11.19.1 on macOS. Base is `c7dfa7cfb` with eval-quality 10.1.1, and head is #530's tree `43c3d0f3` (first run as `e92c7cd8a`) with 10.1.2. A script that failed was rerun alone.

| | Base | Head |
|---|---|---|
| First pass | 187 of 190 | 185 of 190 |
| After serial reruns | 188 of 190 | 189 of 190 |
| Fails after reruns | `test:evaluate-preflight`, `test:docs-tutorial` | `test:evaluate-preflight` |
| Passes on base, fails on head | | none |

`npm ci`, `test:eval-quality-corpus` and the seven gates (`test:boundary`, `test:direction`, `test:doc-claims`, `test:doc-counts`, `test:doc-invocations`, `test:lineage`, `test:lockfile-age`) pass on both. The Codex reviewer's independent run of the same chain on both revisions found 187 and 189 after its retries, with no head-only failure; its base fails `test:evaluate-preflight`, `test:docs-tutorial` and `test:evaluate-private`, and its head fails `test:evaluate-preflight`.

The first-pass failures that a rerun cleared:

- `test:evaluate-confinement-history` (base), "a confined run whose trial-mutated-M-001-1 workspace probed git exited 0; expected 3", ran while the head chain ran on the same host, and passed 353 of 353 when rerun alone. The cause is not established.
- `test:evaluate-compare` and `test:evaluate-guidance` (head) hit `ENOSPC` while three chains and a fixture refresh shared the disk. Both pass alone.
- `test:evaluate-guidance`, `test:evaluate-tool-use` and `test:evaluate-promptfoo` (head) failed alone too, with `[run-integrity] ... lies outside this run directory, runs/engine-refresh-86666/`. `tools/refresh-evaluate-baselines.js` moves each replaced baseline to `runs/engine-refresh-<pid>` and never deletes it. `runs/` is ignored, so the folder is never committed, but a suite that copies a fixture folder scores it. Deleting the fourteen leftover folders, all named for the refresh's pid 86666, passed all three. A fresh checkout, as in CI, never has them. The tool could delete the retired folders once its receipt is written, which is a follow-up for TeA.

One base-only failure stays open. In the reviewer's run, `test:evaluate-private` failed on base twice, first "preflight did not report killed command parent …" and then "the next preflight did not reclaim the verified immutable parent after release", and passed on head. It passed in this story's base run, so it is intermittent on base, and its cause is not established. It is not a regression, because the head passes it.

**Hosted checks.** All 31 checks pass on each pull request's exact head: #531 at `97fa2308e` in [run 45910919941](https://github.com/bmad-code-org/bmad-method-test-architecture-enterprise/actions/runs/45910919941) and #530 at `6b9ea8cdb` in [run 45910961031](https://github.com/bmad-code-org/bmad-method-test-architecture-enterprise/actions/runs/45910961031), each with the 21 chain shards and the merged coverage. CodeRabbit reviewed #531 with no actionable comment and skipped #530: "304 files exceed the limit of 100".

**No TeA release follows from this.** TeA's `publish.yaml` is a manual dispatch, and the owner has dispatched one after most merges: #497 shipped as 4.3.0 and #519 as 4.4.0, each with changes under `cli/` and `skills/`. Neither pull request changes anything TeA's npm `files` publish, so a release cut for them would publish the 4.6.1 contents under a new version. The tutorial fix reaches readers through the documentation site, which `docs.yaml` builds, and its `[Unreleased]` entry rides with the next release that does change the package.

## Review Triage Log

The coordinator pinned review to the Codex reviewer, round by round, with each round's file in the review folder (`14-6-review-r<N>.md`).

- **Round 1, TeA `c7dfa7cfb..e92c7cd8a`: changes requested, 3.** (1) The release predates Story 14.5's merge: high, process. Closed by recording the owner's approval of the order. (2) The baseline and seal refresh against the epic's fixture boundary: high, process. Closed by recording the owner's scope amendment, limited to the re-measurement. (3) The tutorial fix should be its own pull request: medium, revertability. Patched: #531 carries it and #530 is stacked on it.
- **Round 2, TeA `c7dfa7cfb..6b9ea8cdb`: changes requested, 1.** The rebuild of #530 force-pushed against Epic 14's "no force-push": high, process. Closed by recording the coordinator's instruction as the owner's exception, limited to #530's branch.
- **Round 3, TeA `c7dfa7cfb..6b9ea8cdb`: approved, zero findings.**
- **Round 4, eval-quality `74f9292..dc18f3e`: changes requested, 6, all in this record.** (1) Verification told a reader to dispatch another release: medium. Patched to read back run 45888028402, with both TeA revisions pinned. (2) The merge order lacked the method that keeps `97fa2308e` on TeA's `main`: medium. Patched with the merge-commit requirement and the ancestry and diff checks. (3) The lock-only failures were over-generalised: low. Patched with the 22 scripts and their diagnostics, and `test:evaluate-ci-render` passing. (4) The hosted checks were missing, and the Ubuntu statement was too broad: low. Patched with both runs and the Windows job. (5) The reviewer's base `test:evaluate-private` failure carried an unproven cause: low. Patched as an open, intermittent, base-only failure. (6) The member check omitted the pack of `93856e2`: low. Patched with that comparison.
- **Round 5, eval-quality `10eba24..9d2b89b`: changes requested, 1.** The pre-merge `gh pr diff 530 --name-only` fails with HTTP 406 above 300 files: medium. Patched to the paginated files API, with the ancestry check run after a fetch.

## Verification

The release ran once, as run 45888028402; these commands read back what it and the TeA pull requests left, and none of them publishes.

**Commands:**
- `gh run view 45888028402 --repo bmad-code-org/bmad-eval-quality --json conclusion,headSha` -- expected: `success` at `93856e2f740712867eedc6284d563cd3707f3e83`.
- `npm view eval-quality@10.1.2 version gitHead` and `npm view eval-quality dist-tags.latest` -- expected: `10.1.2`, `93bad78586045dc9b963539955f64701ed2efd82`, `10.1.2`.
- `npm pack` of a clean `npm ci` checkout at `v10.1.2`, compared with `npm pack eval-quality@10.1.2` by sorted member path, mode and SHA-256 -- expected: zero differences.
- In TeA, `git diff c7dfa7cfbb605ca59b046f2982085f2a07cdcf26 87e08b041ca34f6caf97431fc5af802c25642d54 -- package-lock.json` -- expected: only `node_modules/eval-quality` version, resolved and integrity.
- TeA's `npm ci` and every script of its `npm test` chain at `c7dfa7cfbb605ca59b046f2982085f2a07cdcf26` and `6b9ea8cdb771ddb5488db0f1a680cb70ac5fa608` -- expected: no script passes on base and fails on head.
