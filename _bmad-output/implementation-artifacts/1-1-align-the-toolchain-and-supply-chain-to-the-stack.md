---
baseline_commit: 75b956dea2658dc51149176d297e02d8ded7a78d
---

# Story 1.1: Align the toolchain and supply chain to the Stack

Status: review

## Story

As the maintainer,
I want the repository's toolchain, dependency graph, and CI pinned and audited exactly as the spine's Stack section requires,
so that every subsequent story builds on the verified dependency graph and the licence and supply-chain gates actually enforce instead of failing open.

## Acceptance Criteria

1. **Manifest pinned to the Stack.** Every `package.json` dependency entry is an exact pin, no ranges: TypeScript 7.0.2, Zod 4.4.3 (the only runtime dependency, newly added), Vitest 4.1.10, Biome 2.5.5, @types/node 22.20.1, with Vite resolved to 7.3.1 via `overrides`; husky pinned `9.1.7`, lint-staged `16.4.0` (marked is already exact at `18.0.7`). A fresh install resolves `vite@7.3.1` with no installable `lightningcss` package (no `"node_modules/lightningcss"` key in the lockfile; the bare string still appears in Vite's peer-dependency metadata and that is fine), and the licence scan reports no violations. The `package.json` description and keywords and the `src/index.ts` barrel comment describe the compile-and-seal product with no runner, assertion-DSL, grader, or trajectory language (already true in the repo; verify, do not rewrite).
2. **npm asserted and the age audit real.** Every job that runs any npm install — the Node 24 job, the Node 22.20.0 floor job, all three canary jobs, and publish — first runs `npm i -g npm@11.18.0` and asserts `npm --version` prints exactly `11.18.0` before any dependency install. A lockfile publication-age audit runs before every `npm ci`: it checks the publication age of every registry entry in the resolved lockfile and fails on any entry younger than the seven-day window, failing closed with the entry's name on unfetchable metadata. The three supply-chain canaries run the ordinary job path (the same audit script and a real `npm ci`, never a resolution shortcut or `--dry-run`) and each asserts failure **for the policy reason**, matching the expected error output, never bare nonzero exit.
3. **Licence gate over the full graph.** The licence scan reads the `license` field of every entry in `package-lock.json` (lockfileVersion 3 carries it for every entry, including platform binaries never installed on the runner), so it covers every runtime, development, optional, and platform entry regardless of runner OS. The SPDX allowlist is MIT, Apache-2.0, ISC, BSD-2-Clause, BSD-3-Clause, 0BSD; an `OR` expression passes when any operand is allowlisted, an `AND` only when all are, balanced outer parentheses are stripped, and a missing, unparseable, `UNLICENSED`, or `WITH`-exception licence fails closed. A violation fails the build and reports the exact dependency path.
4. **TypeScript 7.0.2 migration complete and the floor proven.** `tsconfig.json` deletes `baseUrl`, adds `"types": ["node"]`, and accounts for `noUncheckedSideEffectImports` defaulting true; `tsconfig-build.json`'s explicit `"rootDir": "src"` is verified against the new `rootDir` default. The Node 24 CI job runs the full `npm run validate` chain (typecheck, lint, check:docs, lint:spine, test) plus build, wiring `check:docs` into CI for the first time per the spine's deployment additions, and CI runs the install-build-test path on exactly Node 22.20.0 as a separate floor job.
5. **Publication blocked by a mechanism.** `publish.yml` contains an explicit guard step that fails the workflow unless a deliberately-set repository setting unblocks it, with a comment naming the unresolved intellectual-property question as the reason (AD-18). Manual dispatch alone is not the guard.
6. **`.npmrc` completed.** `allow-remote=none` is added alongside the existing `allow-git=none`, `min-release-age=7`, `save-exact=true`. The stale `legacy-peer-deps=true` is removed if a fresh install succeeds without it, or kept with a comment recording why it is needed.

## Tasks / Subtasks

- [x] Task 1: Pin the dependency graph (AC: 1, 6)
  - [x] Add `zod: "4.4.3"` under `dependencies` (first and only runtime dependency)
  - [x] Rewrite `devDependencies` to exact pins: `typescript: "7.0.2"`, `vitest: "4.1.10"`, `@biomejs/biome: "2.5.5"`, `@types/node: "22.20.1"`, `husky: "9.1.7"`, `lint-staged: "16.4.0"` (`marked: "18.0.7"` is already exact)
  - [x] Add `"overrides": { "vite": "7.3.1" }` so Vitest resolves Vite 7, never 8 (Vite 8 pulls MPL-2.0 `lightningcss`)
  - [x] Update `.npmrc`: add `allow-remote=none`; resolve `legacy-peer-deps=true` (remove if install is clean without it)
  - [x] Regenerate `package-lock.json` with npm 11.18.0 exactly; verify `vite@7.3.1` resolved and no installable lightningcss: `! grep -q '"node_modules/lightningcss"' package-lock.json`. Check the package key, never the bare string: Vite 7's own lock entry legitimately mentions `lightningcss` under `peerDependencies`/`peerDependenciesMeta` without installing it, and a bare-string grep fails on the correct lockfile
  - [x] Update `biome.json`: bump the schema URL from `2.5.4` to `2.5.5` alongside the Biome pin, and add `"!scripts/fixtures"` to `files.includes` so npm-generated fixture JSON cannot fight the formatter
- [x] Task 2: TypeScript 7.0.2 migration (AC: 4)
  - [x] `tsconfig.json`: delete `"baseUrl": "./"`, add `"types": ["node"]`
  - [x] Audit both tsconfigs against TS 7 removals and stricter defaults: `esModuleInterop`/`allowSyntheticDefaultImports` are already true (cannot be false in TS 7, no change needed); confirm `moduleResolution: "Bundler"` remains valid; verify `rewriteRelativeImportExtensions` still exists in TS 7 and adjust the build config if it was removed or renamed
  - [x] Run `npm run typecheck` and `npm run build`; fix any TS 7 fallout in the two config files (source is one barrel file; app-code fallout is not expected)
- [x] Task 3: CI supply-chain hardening in `pr-checks.yml` (AC: 2, 3, 4)
  - [x] Add an npm setup step to every job that installs (Node 24 job, floor job, all three canaries; publish gets it in Task 4): `npm i -g npm@11.18.0` followed by an assertion that `npm --version` prints exactly `11.18.0`, before any dependency install (the global npm upgrade itself is performed by the bundled npm and is exempt from the assertion; it ignores project `.npmrc` and 11.18.0 is far outside the age window)
  - [x] Write `scripts/audit-lockfile-age.mjs`: parse `package-lock.json`, fetch the registry `time` map once per package name (not per entry) in a single bounded-parallel pass with bounded retries, fail listing every entry whose version's publish timestamp is younger than 7 days at the clock; the clock defaults to now and accepts an explicit `--now <RFC3339>` override so the canary can exercise the identical code path; the script prints the effective clock, and ordinary jobs assert it is within 24 hours of `date -u` (so a clock-parsing bug cannot make every entry "old" forever); an entry whose metadata cannot be fetched after retries fails closed with its name; wire it before `npm ci`
  - [x] Write `scripts/check-licenses.mjs`: read the `license` field of every entry in `package-lock.json` (this covers platform binaries never installed on the runner; do not walk `node_modules`, which silently misses foreign-platform optional deps); pass on the six-member allowlist with `OR` satisfied by any operand, `AND` only by all, balanced outer parentheses stripped; a missing, unparseable, `UNLICENSED`, or `WITH`-exception licence fails closed; every failure prints the exact dependency path (walk lockfile dependency edges or `npm ls <name>`); needs no install, wire it beside the audit
  - [x] Make the Node 24 job run `npm run validate` plus `npm run build` (this wires `check:docs` into CI for the first time; keep the Python setup steps for `lint:spine`)
  - [x] Add a floor job running install, build, and test on exactly Node 22.20.0
  - [x] Add the three canary jobs on the ordinary job path, no `continue-on-error`, each asserting failure for the policy reason via an output match, not bare nonzero exit (any-reason inversion "passes" on a typo'd path or crashed script): (a) age canary: run the audit with `--now` pinned to the fixture entry's publish date plus one day and assert the output names the young entry; its fixture lockfile contains exactly one registry entry, and the audit fails an entry published later than `--now` minus 7 days (a fixture judged against the real clock rots after seven days and starts failing CI in the wrong direction); note this canary asserts the audit fails, its `npm ci` is not the subject; (b) git canary: `npm ci` against the git-dependency fixture must fail and the output must match npm's git-blocked policy error; (c) remote canary: same with the remote-tarball fixture and the remote-blocked error. Use a real `npm ci`, never `--dry-run` (verified false success against a locked git dependency)
  - [x] Canary fixture mechanics, both traps verified by execution: npm does not read the repo-root `.npmrc` inside a fixture directory (the fixture's own dir is the project prefix), so each canary job copies the live root policy in at runtime (`cp "$GITHUB_WORKSPACE/.npmrc" <fixture-dir>/`) before `npm ci`; committing a static `.npmrc` copy would let the canary keep testing the copy after someone edits the real one. And the git/remote fixture lockfiles cannot be generated while the policy is active, so generate each once in a temp dir without the policy file, then commit both `package.json` and the in-sync `package-lock.json` (an `npm ci` with a missing or out-of-sync lockfile exits nonzero for an unrelated reason, `EUSAGE`, which is exactly the wrong-reason pass the output match exists to prevent)
- [x] Task 4: Harden `publish.yml` (AC: 2, 5)
  - [x] Add a first step that exits nonzero unless a repository variable (e.g. `vars.PUBLICATION_UNBLOCKED == 'true'`) is set, with a comment: publication is blocked until the work-related IP question is resolved in writing (AD-18)
  - [x] Close the local-publish bypass: add a `prepublishOnly` script that refuses to publish unless an environment variable only the guarded workflow sets is present (a token-holder running `npm publish` from a laptop otherwise skips the workflow guard entirely)
  - [x] Give publish the same install discipline as pr-checks: npm 11.18.0 install-and-assert plus the lockfile age audit before its `npm ci` (the spine requires the audit before installing, and publish installs)
- [x] Task 5: Housekeeping verification (AC: 1)
  - [x] Confirm `package.json` description and keywords carry no runner/assertion-DSL/grader/trajectory language (current text is already correct; verify rather than rewrite)
  - [x] Confirm the `src/index.ts` barrel comment matches the compile-and-seal product (already rewritten; verify)
- [x] Task 6: Prove the whole gate (AC: 1-6)
  - [x] `npm run validate` green locally on Node 24
  - [x] Open a PR (pr-checks triggers on `pull_request` to main only; a bare branch push runs nothing) and confirm every new job passes (Node 24 validate+build, floor job, age audit, licence scan, npm assertions) and every canary fails for its asserted reason
  - [x] Exercise the publish guard once by manual dispatch with the repository variable unset and confirm the guard step fails before any install
  - [x] Record resolved versions and the lock-entry count in the Dev Agent Record (the spine's verified figure of 124 entries is historical, from 2026-07-29 before TypeScript 7 and Zod entered the graph; a fresh resolve of this story's pin set lands around 156, dominated by TS 7's ~20 platform binaries; treat large deviations from ~156, not from 124, as a resolution anomaly)

## Dev Notes

### Why this story exists

Both of this repository's supply-chain controls have already failed open twice (spine, Stack section): the Node floor bundles npm 10.9.3, which silently ignores `min-release-age` and `allow-git` (they need npm 11.10+/11.15+), and `min-release-age` filters resolution while CI runs `npm ci`, so a young package already in the lockfile installs cleanly under an active policy. Every mechanism in this story exists to close a verified fail-open, not as ceremony. A control that fails open is worse than an absent one.

### Version pins are load-bearing, not preferences

| Pin | Why exactly this |
| --- | --- |
| npm 11.18.0 exactly | `>=11.15.0` admits npm 12, whose `engines` excludes Node 22.20.0. 11.18.0 was the newest 11.x clearing the 7-day window at verification (2026-07-29). Assert equality, never a range. |
| Vite 7.3.1 via override | `vitest@4.1.10` accepts `vite ^6 || ^7 || ^8`; a fresh resolve picks 8.x, which depends on `lightningcss` (MPL-2.0, 12 lock entries, outside the allowlist). No Vite 7.x carries lightningcss. 7.3.1 is the version verified end to end: 124 lock entries, zero violations. |
| Biome 2.5.5 | One patch behind newest at verification to satisfy the age window. |
| @types/node 22.20.1 | The type surface must name the same patch as the runtime floor; `@types/node` 22.x describes APIs added through the 22 line (`node:sqlite` arrived in 22.5.0), so floor and types must agree at 22.20.x. |
| TypeScript 7.0.2, Zod 4.4.3, Vitest 4.1.10 | Verified by execution in the spine (Zod's JSON Schema emission behavior on this exact pin backs AD-13's export design, consumed by Stories 1.3-1.5). Do not bump silently. |

Pins may move forward only when the new version clears the 7-day window AND the verification is re-run (licence scan, lockfile check, and for Zod the AD-13 emission checks). If a pin now fails the age audit's own math (all pins are older than 7 days by now; this should not happen), stop and surface it rather than bumping.

### Current state of every file this story touches

- `package.json`: devDependencies are caret ranges (`^5.9.3` typescript, `^3.2.4` vitest, `^2.3.13` biome, `^22.10.0` @types/node, `^9.1.7` husky, `^16.4.0` lint-staged) except `marked: "18.0.7"`, already exact; no runtime deps; no `overrides`; `engines.node >=22.20.0` already correct. Description and keywords are already product-correct. Preserve the scripts block: `validate` chains typecheck, lint, check:docs, lint:spine, test; `lint:spine` invokes python3, `prepare` guards husky.
- `tsconfig.json`: carries `"baseUrl": "./"` (must delete), no `types` array (must add `["node"]`), `moduleResolution: "Bundler"`, strict family already on, `esModuleInterop`/`allowSyntheticDefaultImports` already true.
- `tsconfig-build.json`: extends base, `"rootDir": "src"` explicit (safe against the TS 7 `rootDir` default change), `rewriteRelativeImportExtensions: true` (verify against TS 7; source imports use `.ts` extensions so this flag matters for build output).
- `.github/workflows/pr-checks.yml`: single job on `.nvmrc` (Node 24), plain `npm ci`, no npm-version assertion, no age audit, no licence scan, no floor job, no canaries. Python 3.12 setup and spine-lint steps exist and must be preserved.
- `.github/workflows/publish.yml`: manual `workflow_dispatch`, no publication guard step. Also runs `npm ci`; it gets the npm assertion too.
- `.github/workflows/gitleaks-check.yml`: leave unchanged.
- `.npmrc`: has `legacy-peer-deps=true` (origin unknown, likely stale scaffolding), `allow-git=none`, `min-release-age=7`, `save-exact=true`; missing `allow-remote=none`.
- `.nvmrc`: `24`. Keep; the floor job pins its own Node version explicitly.
- `src/index.ts` and `tests/index.test.ts`: one barrel constant and one test; barrel comment already correct.

### What must be preserved

- The `validate` chain and all existing scripts (`check:docs`, `lint:spine`, `test:spine-lint`, `build:shareable`) keep working; spine-lint runs in CI with all three rules (NFR10) and is already wired.
- The gitleaks workflow, husky/lint-staged hooks, and the publish workflow's version-bump/PR mechanics stay intact; this story only prepends the guard and npm assertion to publish.
- ESM (`"type": "module"`), Apache-2.0, unscoped name, `files` allowlist, `engines` floor: unchanged.

### Constraints and guardrails (architecture-binding)

- **AD-25:** allowlist is MIT, Apache-2.0, ISC, BSD-2-Clause, BSD-3-Clause, 0BSD. The scan covers the whole transitive graph including platform-specific optional deps (Biome's platform binaries and friends). Report the dependency path, not just the package name. [Source: ARCHITECTURE-SPINE.md#AD-25]
- **Consistency Conventions, Dependencies row:** exact pins everywhere including toolchain; a pin must be older than the 7-day window; age is audited over the resolved lockfile, never trusted to resolution. [Source: ARCHITECTURE-SPINE.md#Consistency-Conventions]
- **AD-30:** CI runs at the exact runtime floor (22.20.0) and at the development version (24), so the floor is a tested guarantee. [Source: ARCHITECTURE-SPINE.md#AD-30]
- **AD-18:** publication is blocked by an explicit guard in the release workflow, not by policy prose. [Source: ARCHITECTURE-SPINE.md#AD-18]
- **AD-1/AD-2 do not bind CI scripts** (they bind `src/`), so `scripts/*.mjs` may use `node:fs` and network freely; keep them out of `src/`.
- New scripts follow the existing pattern: plain `.mjs` under `scripts/` (see `scripts/check-docs.mjs`), invoked via npm scripts, no new dependencies for tooling. The age audit needs registry metadata; `npm view <pkg>@<version> time --json` or a direct registry fetch are both acceptable. CI network access for the audit is fine; it is not package code.
- Do not add any dependency to implement the licence scan or age audit without running it through the same allowlist and age window it enforces. Zero-dependency scripts avoid the bootstrapping problem entirely and are preferred.

### Target CI shape after this story

| Job | npm 11.18.0 assert | Age audit | Licence scan | Runs |
| --- | --- | --- | --- | --- |
| pr-checks, Node 24 | yes | yes, before `npm ci` | yes | `npm run validate` + `npm run build` (Python setup kept for `lint:spine`) |
| pr-checks, floor Node 22.20.0 | yes | yes, before `npm ci` | no (one scan suffices) | install, build, test |
| canary: age | yes | the subject: audit with pinned `--now` must fail naming the entry | no | audit only; `npm ci` not the subject |
| canary: git dep | yes | no | no | `npm ci` in fixture must fail with git-blocked error |
| canary: remote tarball | yes | no | no | `npm ci` in fixture must fail with remote-blocked error |
| publish | yes | yes, before `npm ci` | no | guard step first, then existing bump/build/publish |
| gitleaks | unchanged | no | no | unchanged |

### Latest-tech notes (researched 2026-08-10)

- TypeScript 7 (Go-native compiler line) confirms the spine's migration list externally: `baseUrl` unsupported, `types` defaults to empty, stricter config defaults; breakage is config-and-tooling, not application code. One external source claims `rootDir` defaults to `./src` (spine says `./`, verified on the pin); irrelevant here because the build config sets `rootDir` explicitly. Trust the spine where sources disagree.
- Verified by execution during story review (2026-08-10): the exact migration in Task 2 (delete `baseUrl`, add `types: ["node"]`, keep `moduleResolution: "Bundler"` and `rewriteRelativeImportExtensions`) typechecks, builds, and tests green on TypeScript 7.0.2 against this repo, every Task 1 pin exists on the registry with engines admitting Node 22.20.0, and the fresh pinned graph's licences are all allowlisted. Task 2's "verify" bullets are confirmation, not exploration.
- Zod 4 ships first-party `z.toJSONSchema()` with a `draft-2020-12` target and an `io: "output"` mode; the third-party `zod-to-json-schema` is unmaintained. This story only installs Zod; Stories 1.3-1.5 consume it. Do not add `zod-to-json-schema`.

### Testing requirements

- The canaries are tests of the gates, and they assert failure for the right reason: a gate that cannot be shown to fail is a gate that fails open, and a canary that accepts any nonzero exit "passes" on a typo'd fixture path or a crashed script. Each canary runs the identical command path a real job runs and matches the expected error output. The verified traps, all found by running the real commands: a resolution-shortcut canary passes while `npm ci` accepts the young package; `npm ci --dry-run` reports false success against a locked git dependency; a young-lockfile fixture judged against the real clock rots after seven days (hence the pinned `--now`); npm ignores the repo-root `.npmrc` inside fixture directories (hence the runtime copy); and a fixture without an in-sync committed lockfile fails `npm ci` with `EUSAGE`, a wrong-reason failure.
- The age audit gets a unit-style check: run it against a committed fixture lockfile containing one deliberately young entry and assert nonzero exit naming that entry.
- The licence scan gets the same: a fixture with a known-violating licence string asserts nonzero exit with the dependency path in output.
- Vitest 4 continues running the existing `tests/index.test.ts`; no coverage floor applies to this story (NFR7's 90 percent binds `core/`, which does not exist yet).

### Project Structure Notes

- No `src/` layout changes in this story. The Structural Seed's `core/`, `ports/`, `adapters/` tree starts in later stories; creating empty scaffolding directories now would outrun the schemas they exist to hold.
- New files land in `scripts/` (audit-lockfile-age.mjs, check-licenses.mjs) and canary fixtures under `scripts/fixtures/` (one directory per canary), plus workflow edits. Nothing else moves.
- NFR9's permutation fixture family has no binding stage yet (nothing consumes an observation array until Epics 2-3); recorded deliberately so reviewers do not hunt for it in this story.

### References

- [Source: _bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md#Stack] (pins, npm rationale, TS 7 migration list, supply-chain failure history)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md#AD-25] (licence allowlist)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md#AD-30] (floor + dev CI matrix)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md#AD-18] (publication guard)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md#Consistency-Conventions] (exact-pin and age-window rules)
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.1] (acceptance criteria of record)
- [Source: _bmad-output/planning-artifacts/prds/prd-eval-quality-2026-07-17/prd.md#VFR-8] (packaging terms, npm pin history)

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- Fresh `npm install` under npm 11.18.0 (after deleting `node_modules`/`package-lock.json`) resolved cleanly with `legacy-peer-deps=true` removed: `npm ls` shows zero unmet-peer warnings, confirming the flag was stale.
- Resolved lockfile: **156 total lock entries** (155 excluding the root `""` entry), matching the story's ~156 prediction (dominated by TypeScript 7's platform binaries). Vite resolved to exactly `7.3.1`; `! grep -q '"node_modules/lightningcss"' package-lock.json` passes (no installable lightningcss; the string only appears under Vite 7's own `peerDependenciesMeta`).
- Resolved pin versions and their real registry publish dates (all >7 days before 2026-08-10, the age window's own math holds): typescript@7.0.2 (2026-07-08), zod@4.4.3 (2026-05-04), vitest@4.1.10 (2026-07-06), @biomejs/biome@2.5.5 (2026-07-21), @types/node@22.20.1 (2026-07-08), husky@9.1.7 (2024-11-18), lint-staged@16.4.0 (2026-03-14), vite@7.3.1 override (2026-01-07).
- Licence sweep of all 155 non-root lockfile entries: 119 MIT, 22 Apache-2.0, 9 "MIT OR Apache-2.0", 4 ISC, 1 BSD-3-Clause. Zero violations, zero missing `license` fields.
- `scripts/check-licenses.mjs` and `scripts/audit-lockfile-age.mjs` were exercised against synthetic red-path fixtures (nested-dependency GPL violation, AND/OR/WITH/missing licence shapes, an unfetchable package name, and a real package pinned young via `--now`) before being pointed at the real lockfile; all reds correctly failed with the right reason, then the real lockfile passed clean.
- Canary shell logic (age/git/remote) was dry-run locally under `bash` byte-for-byte matching the workflow's embedded scripts, against the actual `scripts/fixtures/*` fixtures, before being committed: `EALLOWGIT` and `EALLOWREMOTE` are npm's real error codes for the git/remote-blocked cases, confirmed by execution, not assumed.
- `npm run validate` (typecheck, lint, check:docs, lint:spine, test) and `npm run build` are green locally on Node 24.18.0 / npm 11.18.0. `npm run test:spine-lint` (45 pytest cases) also green.
- Live CI proof, PR #6 (`feat/epic1-story1` -> `main`, https://github.com/bmad-code-org/bmad-eval-quality/pull/6): all 6 checks passed - gitleaks, `Node 24 (validate + build)`, `Node 22.20.0 (floor)`, and all three canaries (`Canary: lockfile age audit fails on a young entry`, `Canary: npm ci blocks a git dependency`, `Canary: npm ci blocks a remote-tarball dependency`). PR squash-merged to `main`.
- Publish guard proof: dispatched `publish.yml` off `main` (run 31439285309) with the `PUBLICATION_UNBLOCKED` repository variable unset. The `Publication guard (AD-18)` step failed at position 1 of 13 - before checkout, npm setup, or any install step ran - with the exact message "Publication is blocked: the AD-18 intellectual-property question is not yet resolved in writing." Confirms manual `workflow_dispatch` alone does not bypass the guard.

### Completion Notes List

- Task 1-2 (pins, TS 7 migration): all six pins are exact, `overrides.vite` pins Vite to 7 to avoid Vite 8's MPL-2.0 `lightningcss`, `.npmrc` gained `allow-remote=none` and lost the stale `legacy-peer-deps=true`, `biome.json` bumped its schema pin and excludes `scripts/fixtures` from formatting. `tsconfig.json` migrated off `baseUrl` onto `types: ["node"]`; `rewriteRelativeImportExtensions` and `rootDir: "./src"` both confirmed still valid under TS 7 via `--showConfig`.
- Task 3 (CI hardening): wrote `scripts/audit-lockfile-age.mjs` (one registry request per unique package name, bounded 8-way concurrency, 3 retries, fails closed on unfetchable metadata) and `scripts/check-licenses.mjs` (SPDX-ish OR/AND/paren evaluator over the lockfile, zero install, BFS over lockfile dependency edges for the exact dependency path). `pr-checks.yml` gained a Node 24 `validate-and-build` job (npm assert → age audit with clock-drift check → licence scan → validate → build), a Node 22.20.0 `floor` job, and three canary jobs (`canary-age`, `canary-git`, `canary-remote`), each asserting failure via an output match on the real policy-reason string (`zod@4.4.3` / `EALLOWGIT` / `EALLOWREMOTE`), never bare nonzero exit.
- Task 4 (publish hardening): `publish.yml` now opens with an AD-18 guard step gated on the `PUBLICATION_UNBLOCKED` repository variable, gained the same npm-assert + age-audit discipline before its `npm ci`, and the publish step sets `EVAL_QUALITY_PUBLISH_AUTHORIZED=true`, which `scripts/assert-publish-authorized.mjs` (wired as `prepublishOnly`) requires - closing the laptop-bypass path.
- Task 5: `package.json` description/keywords and the `src/index.ts` barrel comment were already compile-and-seal-product-correct; verified, not rewritten.
- No dependencies were added beyond the story's own pin set; both new audit scripts and the publish guard are zero-dependency `.mjs`, consistent with the Dev Notes' bootstrapping-problem guidance.

### File List

- `package.json` (dependencies/devDependencies pinned exact, `overrides.vite`, `prepublishOnly`)
- `package-lock.json` (regenerated under npm 11.18.0)
- `.npmrc` (`allow-remote=none` added, `legacy-peer-deps=true` removed)
- `biome.json` (schema bump to 2.5.5, `!scripts/fixtures` excluded)
- `tsconfig.json` (`baseUrl` removed, `types: ["node"]` added)
- `.github/workflows/pr-checks.yml` (npm assert, age audit, licence scan, Node 24 validate+build job, Node 22.20.0 floor job, three canary jobs)
- `.github/workflows/publish.yml` (AD-18 guard step, npm assert + age audit before install, `EVAL_QUALITY_PUBLISH_AUTHORIZED` env on the publish step)
- `scripts/audit-lockfile-age.mjs` (new)
- `scripts/check-licenses.mjs` (new)
- `scripts/assert-publish-authorized.mjs` (new)
- `scripts/fixtures/age-canary/package.json`, `scripts/fixtures/age-canary/package-lock.json` (new)
- `scripts/fixtures/git-canary/package.json`, `scripts/fixtures/git-canary/package-lock.json` (new)
- `scripts/fixtures/remote-canary/package.json`, `scripts/fixtures/remote-canary/package-lock.json` (new)

## Change Log

- 2026-08-10: Implemented Tasks 1-6. Dependency pins, TS 7 migration, CI supply-chain hardening (two new audit scripts, three canary jobs), and publish.yml's AD-18 guard. `npm run validate` and `npm run build` green locally on Node 24. Opened PR #6, all 6 checks passed live on GitHub Actions, squash-merged to `main`. Dispatched `publish.yml` off `main` and confirmed the AD-18 guard blocks it before any install. All acceptance criteria satisfied; story ready for review.
