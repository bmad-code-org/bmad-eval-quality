# Epic 14 Context: a lighter repository and a shorter path to the proof

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

`eval-quality` stays TeA Evaluate's evidence and scoring engine; core BMAD can use either this package or Toolsmith's `bmad-eval`. This epic makes independent changes around the engine and leaves the engine itself alone. The skill tutorial shows its two-row result before its stage internals, and a reader can reproduce that result into a fresh, empty output directory. The README says how the seven authoring rules apply to a skill that writes documents. The story records of finished Epics 1 to 11 leave the checkout and stay in history. The Tidewater case in Shard Pro's evals gets a recorded answer to whether its rubric catches a planted defect. That case tests the claim the package rests on, that a green evaluation proves nothing until it fails on broken output, against a case written in Toolsmith's eval format. Then TeA's lockfile moves to the eval-quality release that carries these changes. At `65b24b5` the repository tracks 14,674,628 bytes, of which `_bmad-output/` is 6,681,391. The broader planning documents (PRD, architecture spine) govern the engine and contribute nothing specific to this epic beyond the standing constraints below.

## Stories

- Story 14.1: The skill tutorial shows its result first
- Story 14.2: The README maps the seven rules to a prose skill
- Story 14.3: The story records of finished epics leave the checkout
- Story 14.4: Whether the Shard Pro script runs inside the eval room
- Story 14.5: A planted defect, caught for the reason it was planted
- Story 14.6: TeA runs on the new eval-quality release

## Requirements & Constraints

- **Frozen surface.** No change to the public package API, the CLI and its exit codes, the generated schemas, the adapters, the conformance surface, the published corpus or any verdict.
- **No gate is weakened or reconfigured** to let a change pass. No gate, configuration entry or fixture changes to accommodate a removal or reorder. When a pinned `doc-claims` sentence moves, it moves with its example, or its config entry changes in the same commit.
- **No history rewrite and no force-push.** Each story is one pull request that reverts on its own.
- **No change to TeA's** fixtures, baselines, scoring policy or release wiring. Nothing is sent to another repository (BMAD-METHOD, TeA) without the owner's decision; upstream reports come after this epic, from the owner.
- **Size claims are checkout-only.** Report tracked bytes and file counts by group at base and head. Make no statement about installed size.
- **Only one published package byte change in the epic** (the npm package members; documentation pages are not members): the README sentence in Story 14.2. `CHANGELOG.md` `[Unreleased]` records it, and the shareable README export is rebuilt in the same commit.
- **Gates that must be green**: `npm run validate`, the docs build and link job, and every pull-request canary. Story-specific canaries are `canary-tutorials` and `canary-shareable`.
- **Fresh-run verification beats green gates.** A reused output directory hides a missing producer, and the tutorial canary skips the page's readback assertions. So the tutorial is verified by running the documented chain from a built checkout into an empty output directory and reading the values from the JSON that run wrote.
- **Evidence about another repository** holds commands with placeholders, exit codes and checked excerpts, and carries no absolute or machine-specific path.
- **Stories 14.4 and 14.5 change no file in BMAD-METHOD.** 14.4 makes no live model call.

## Technical Decisions

- **Pinned baselines.** `bmad-eval-quality` `main@65b24b5` (10.1.1), `BMAD-METHOD` `dev@fc034b67`, `bmad-method-test-architecture-enterprise` `main@c7dfa7cfb`. A story starting from a later commit re-reads its citations first and reports any that moved; counts such as 14.3's 55 files are recomputed at the branch's own base.
- **Package and TeA check (Stories 14.2, 14.3).** Build and pack base and head with the same locked tools, then compare sorted member paths, modes and content hashes. Zero differences ends the check. If any member differs, run the candidate against TeA:
  - `npm ci` in a disposable TeA checkout. TeA locks `eval-quality` 10.1.1, and its corpus gate requires the literal `latest` in the manifest and compares the installed version with the lock.
  - Install the packed tarball without saving it as a dependency. Then confirm that `package.json` and `package-lock.json` still match `c7dfa7cfb` and that the installed members match the tarball.
  - Run `npm run test:eval-quality-corpus` plus `test:boundary`, `test:direction`, `test:doc-claims`, `test:doc-counts`, `test:doc-invocations`, `test:lineage` and `test:lockfile-age`.
  - Any unexplained engine-member difference blocks the pull request.
- **Package `files` list** has five entries, one of them `README.md`. `_bmad-output/` is outside it, so 14.3 must show zero member differences.
- **Tutorial invariants (14.1).** Executable order stays: setup, compile, both preflights, both scores, both readbacks, because `score` reads the compiled contract and its arm's preflight verdict. The three exit-annotated transcript pairs that `check:doc-invocations` compares line for line must keep their form: one invocation, its `text` block, and only blank lines between them. `examples/tutorials/skill/` (15 generated files held by `check:tutorials`) and its generator stay byte-identical. The page keeps its URL and generator, and the advanced detail goes under one "Advanced" heading. The expected result: inclusion passes on both arms, exclusion passes honest and fails degenerate, and the gameability probe is qualified, exercised and caught. CONCERNS on both arms is acceptable, and the page keeps saying so.
- **Record retention (14.3).** Remove every numbered story file of Epics 1 to 11 except 11.1, which the doc-claims gate opens. The ledger's `done` decides; a story header still saying review does not hold a file back. Keep Epics 12 to 14 story files, `sprint-status.yaml`, `deferred-work.md`, the epic context files and `spec-*.md`. Add one line atop the learning-path file pointing at tag `v10.1.1`, and repair no reference one by one.
- **Shard Pro mechanics (14.4, 14.5).** `shard_tool.py` loads `<project-root>/_bmad/scripts/frontmatter.py` before any subcommand, and the eval runner stages only the skill and case fixtures. The expected failure without an install is exit 2, "Run bmad setup for this project". `--help` is not evidence, because it returns before the import. The preflight uses an isolated project root with no customization resolver, selects `tidewater-prd`, and requires exactly one skipped case and exit 3; zero jobs fails the step. The overlay copies `frontmatter.py` from `fc034b67` into `_bmad/scripts/` and adds that path to a copy of the cases file. Its interpreter must carry PyYAML. It lives outside BMAD-METHOD and outside any installable skill directory, stays identical across arms, and has its staged digest verified.
- **The TeA move (14.6).** After 14.1 to 14.5 merge, the publish workflow runs with `bump=patch`, and npm, the git tag and the GitHub release show the same version. In a TeA branch, `eval-quality` is the only package whose locked version changes, its manifest entry stays `latest` with the peer floor `>=10.1.1`, and other files change only where TeA's rules require, such as `CHANGELOG.md` or `.lockfile-age-cache.json`. `npm ci`, `test:eval-quality-corpus`, the seven gate scripts and TeA's pull request checks pass with no change to its fixtures, baselines, scoring policy or release wiring.
- **14.5 validity.** A counted trial shows harness status `ok`, evidence that the staged script completed the build, a successful `check --rebuild`, and an observable final reply. Harness, model, rubric and timeout are fixed before the first smoke run. The grader reads a neutral folder layout with the reference fixture outside the artifacts folder. Three fresh valid runs per arm support a case-specific observation; zero exercised variants is inconclusive.

## Cross-Story Dependencies

- 14.1 and 14.2 go first; 14.3 follows them. 14.4 is independent and can start any time.
- 14.5 follows a passing 14.4 preflight and reuses 14.4's overlay, with the staged helper's digest verified in both arms. Its harness is Claude Code through `run_evals.py --harness`, unless the preflight shows it cannot run the case, in which case the record says why and names the harness used. Live runs wait for the owner's live-run budget, and grader calls count against it. It ends with a short summary for the owner to send to Toolsmith's maintainer; a rubric that already catches the defect is left as it is.
- 14.6 starts after 14.1 to 14.5 merge: a `bump=patch` release from this repository, then a TeA pull request in which `eval-quality` is the only package whose locked version changes, the manifest stays `latest`, and TeA's lockfile-age gate passes unchanged, or the pull request waits until it does.
- 14.2 and 14.3 both run the shared package and TeA check; 14.2 is the only one expected to show a member difference (`README.md`).
- Upstream candidates for BMAD-METHOD (the missing-helper report, any warranted rubric addition, a known-bad variant recipe for Toolsmith's eval format) come after this epic, and the owner decides their content from the evidence of 14.4 and 14.5. BMAD-METHOD lets a small fix go straight to a pull request; a feature or large change needs maintainer alignment first.
