---
title: 'TeA runs on the new eval-quality release'
type: 'chore'
ticket: '14-6'
created: '2026-11-26'
status: 'in-review'
baseline_revision: '93856e2f740712867eedc6284d563cd3707f3e83'
route: 'oneshot'
route_source: 'auto'
risk: 'medium'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-14-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** TeA's lockfile pins `eval-quality` 10.1.1, and `main` carries a shipped change since then (Story 14.2's README sentence), so TeA Evaluate installs a release that is behind what this repository publishes.

**Approach:** Cut a patch release from `main` with the publish workflow, verify npm, the tag and the GitHub release agree and the published members match a local pack of the tag, then refresh TeA's lockfile on a branch so `eval-quality` is the only package whose version moves, and prove zero regressions by running TeA's full chain on its base and head.

## Boundaries & Constraints

**Always:** TeA's manifest keeps `eval-quality` at `latest` and its peer floor at `>=10.1.1`. Every other TeA file changes only where TeA's own rules require it. A test that passes on TeA's base and fails on its head blocks until its cause is fixed. This story's file records the release and the TeA pull request.

**Never:** Weaken or reconfigure a gate, change TeA's fixtures, baselines, scoring policy or release wiring, release TeA, merge either pull request, touch Story 14.5's worktree or files.

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

**Order.** Story 14.6 started before Story 14.5 merged, at the repository owner's direction. That is safe because Story 14.5 ships only `_bmad-output` documents, and `package.json` `files` publishes `dist`, `schemas`, `corpus`, `README.md` and `LICENSE`. Nothing Story 14.5 adds can be a package member, so the release carries the same members it would carry after 14.5 merged. The release commit `93bad78` landed first, and Story 14.5 merged as #233 (`74f9292`) at 20:03:59Z, a minute later. `git diff --name-only 93bad78 74f9292` names only `_bmad-output/` paths.

**Shipped changes since 10.1.1.** `git diff --name-only v10.1.1 93856e2` names three paths outside `_bmad-output/`: `CHANGELOG.md`, `README.md` and `docs/how-to/evaluate-skill-behavior.md`. Only `README.md` is a package member, and `CHANGELOG.md` `[Unreleased]` already records it (Story 14.2), so no changelog pull request was needed.

**The release.** `gh workflow run publish.yml --ref main -f bump=patch` ran as run 45888028402 from `93856e2f740712867eedc6284d563cd3707f3e83` and finished green. It committed `chore: release v10.1.2 [skip ci]` as `93bad78586045dc9b963539955f64701ed2efd82`, which stamps `package.json`, `package-lock.json`, `src/index.ts`, `src/core/version.ts` and `CHANGELOG.md`.

| Source | Reads |
|---|---|
| npm `eval-quality@latest` | `10.1.2`, `gitHead` `93bad78586045dc9b963539955f64701ed2efd82`, `dist-tags.latest` `10.1.2` |
| git tag `v10.1.2` | `93bad78586045dc9b963539955f64701ed2efd82` |
| GitHub release `v10.1.2` | published 2026-11-26T20:04:51Z, not draft or prerelease, the repository's latest release, body is the `[10.1.2]` section |

**Members.** `npm pack` of a clean `npm ci` checkout at `v10.1.2` and `npm pack eval-quality@10.1.2` from the registry each hold 351 files, with zero differences in sorted path, mode and SHA-256. Against the published 10.1.1 tarball, six of 351 members differ: `package/README.md` (Story 14.2's sentence) and five that change only the version string, `package/package.json`, `dist/index.js`, `dist/index.d.ts`, `dist/core/version.js` and `dist/core/version.d.ts` (`VERSION` and `ENGINE_VERSION` from `10.1.1` to `10.1.2`).

**TeA's lockfile.** `npm update eval-quality --package-lock-only` moved `eval-quality` and also pruned two optional mongoose peers, `node_modules/mongoose/node_modules/gcp-metadata` and `google-logging-utils`, which TeA #497 kept on purpose in its commit "fix(deps): keep the lockfile's optional mongoose peers". The lock edit keeps only the `node_modules/eval-quality` entry's `version`, `resolved` and `integrity`, which is what TeA #519 changed when it adopted 10.1.1. `package.json` keeps `"eval-quality": "latest"` and the peer floor `>=10.1.1`.

**TeA's pull request.** [bmad-method-test-architecture-enterprise#530](https://github.com/bmad-code-org/bmad-method-test-architecture-enterprise/pull/530), branch `chore/eval-quality-10-1-2` from `c7dfa7cfbb605ca59b046f2982085f2a07cdcf26`, three commits: the lock, the re-measured baselines and seals, and the tutorial line.

**The engine version reaches TeA's fixtures.** The lock alone failed 22 TeA scripts, every one before its first case: `test:evaluate-authoring` asserts "re-record current-engine seals with tools/refresh-evaluate-seals.js" (`'10.1.1' !== '10.1.2'`), and each `test:evaluate-pr-*` and `test:evaluate-ci-*` script refuses "the baseline was recorded on eval-quality 10.1.1, the installed release is 10.1.2; re-record it with compare --accept". TeA records the engine version in its current-engine seal manifest and its accepted baselines, so the epic's "no change to TeA's fixtures, baselines" cannot hold for any engine release, a version-only patch included. TeA's own process covers this, as #497 and #519 show: `node tools/refresh-evaluate-baselines.js --source c7dfa7cfb` re-scored the fourteen accepted baselines from their original sealed observations with no target or model run, and refuses to accept unless the score is zero with identical evidence and strength decisions. `node tools/refresh-evaluate-seals.js --source c7dfa7cfb` refuses a seal that changed beyond direction wording, and changed only `test/fixtures/evaluate-engine-seals/manifest.json`'s source and engine. Of the 302 files the refresh touched, 108 are the evidence artifacts and every one is a 100% rename into its new score invocation. After normalizing invocation ids, digests, timestamps and the version, the added and removed lines are identical except the receipt's `originalScoringEngine`, which now reads `10.1.1`, the engine the replaced baselines were measured on. All 22 scripts then pass.

**A pre-existing macOS failure, fixed in the same pull request.** `test:docs-tutorial` fails on `c7dfa7cfb` on macOS. Since TeA 4.6.1 the `run` summary on macOS reads `… sealed over clean, mutated:M-001; the sandbox refused every ungranted read, but macOS logs only some refusals, so the observed reads listed for these 6 trials are a lower bound (…); score them …`, and the tutorial's key line expects `mutated:M-001; score them` with no wildcard between. TeA's CI runs only on `ubuntu-latest`. The key line now reads `mutated:M-001…; score them`, the page says why macOS adds the note, and `CHANGELOG.md` `[Unreleased]` records it under Fixed, as TeA's CONTRIBUTING asks of a documentation fix.

**A pre-existing macOS failure, diagnosed and not in the pull request.** `test:evaluate-preflight` fails 28 of 430 checks on `c7dfa7cfb` and on the head, on macOS only, with `exit 12` and "the audit's log stream lacks a report of the trial that the report meter's stream delivered". The product is right and the case is stale. Its observer stub, `test/fixtures/evaluate/drop-log.cjs`, drops ` deny` lines from the sandbox's token stream and passes them to the report meter's stream, which is the loss TeA #529's `reconcile()` exists to refuse. #529 moved the run suite's cases on that stub to expect exit 12 and missed this Darwin-only preflight case. A fix that gives the stub a reader argument, runs the old case over a drop both streams see and adds a case that must still exit 12, passes 471 of 471 preflight checks and every confinement and run suite. It sits uncommitted on `fix/macos-audit-missed` because its commit was refused by the session's permission check, and goes to the owner.

**TeA's other files.** Only the ones above change. `CHANGELOG.md` carries the tutorial entry and none for the lock. TeA's CONTRIBUTING asks for user-facing, documentation, CI, release and bug-fix entries, and TeA's npm `files` (`skills`, `cli`, `.claude-plugin`, `README.md`, `LICENSE`) leave out `package-lock.json`, `test/` and `docs/`, so no installed byte changes for a TeA user. #519 wrote "Require eval-quality 10.1.1" because it moved the peer floor, and this change leaves the floor alone. `.lockfile-age-cache.json`: the gate reads a cached publication time and fetches what is missing, and `eval-quality.config.json` excludes `eval-quality` from `lockfile-age` by name, so the gate never asks for it. The cache has held `eval-quality@10.1.0` since #519 moved the lock to 10.1.1.

**No TeA release follows from this.** TeA's `publish.yaml` is a manual dispatch, and the owner has dispatched one after most merges: #497 shipped as 4.3.0 and #519 as 4.4.0, each with changes under `cli/` and `skills/`. This pull request changes nothing TeA's npm `files` publish, so a release cut for it would publish the 4.6.1 contents under a new version. The tutorial fix reaches readers through the documentation site, which `docs.yaml` builds, and its `[Unreleased]` entry rides with the next release that does change the package.

## Verification

**Commands:**
- `gh workflow run publish.yml --ref main -f bump=patch` -- expected: the run completes green.
- `npm view eval-quality version dist-tags.latest gitHead` -- expected: the new version twice and the tag's commit.
- `npm pack` at the tag, compared with `npm pack eval-quality@<version>` by sorted member path, mode and SHA-256 -- expected: zero differences.
- In TeA, `git diff c7dfa7cfb -- package-lock.json` -- expected: only `node_modules/eval-quality` version, resolved and integrity.
- TeA's `npm ci` and every script of its `npm test` chain on base and head -- expected: no script passes on base and fails on head.
