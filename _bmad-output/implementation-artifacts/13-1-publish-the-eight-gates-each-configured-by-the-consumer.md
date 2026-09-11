---
title: 'Publish the eight gates, each configured by the consumer'
type: 'feature'
created: '2026-09-10'
status: 'in-progress'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '85758ceaeddf2a626f982c8e06c862de09988559'
context: ['{project-root}/_bmad-output/planning-artifacts/epics.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Eight gates live under `scripts/` and reach no consumer, because `files` is `["dist","schemas","corpus","README.md","LICENSE"]` and nothing under `scripts/` is emitted into `dist`. A repository that wants any of them copies the file, and a copy drifts from the day it is made.

**Approach:** A second binary, emitted by a second tsconfig into `dist/gates/`, dispatching on a gate name. Each gate's rules become data the consumer supplies in one JSON file validated by a published Zod schema. A gate whose rules stay this repository's own decisions expressed as code is not published until they are data.

**This story ships in three pull requests, and all three are the story.** This file records all three and is written as each lands. Pull request 1 establishes the configuration format and the build target and publishes the two gates TEA's Story 4.6 needs. Pull request 2 publishes the three its Story 4.7 needs. Pull request 3 publishes the three documentation gates.

## Boundaries & Constraints

**Always:** `tsconfig-build.json` keeps `include: ["src"]` and `rootDir: "src"`, so no emitted library path moves. Every gate published runs on this repository's own trees through the published path, with this repository's values in its own `eval-quality.config.json`. Every gate has a compliant fixture it passes and a seeded fixture it fails, and at least one seed per gate is worded from outside the trigger vocabulary. `docs/`, `CHANGELOG.md` and the learning path move in this same diff.

**Never:** No gate ships with a fallback to this package's own values. No setting is a value a hand maintains in step with something else: no date, no package-and-version pin, no second copy of a list. No gate source moves under `src/`, and the dependency matrix is not amended.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Consumer runs a configured gate | `eval-quality-gates licences` with a `licences` section | The gate runs over every lockfile the section names | Exit 0 or 1 |
| Consumer runs an unconfigured gate | A file carrying only `lockfile-age` | Refusal naming the file, the gate, and what the file does configure | Exit 64 |
| Configuration file absent | No `eval-quality.config.json` | Refusal naming the resolved path and `--config` | Exit 64 |
| Section present and malformed | `lockfiles: []` | Refusal naming each setting and what was expected | Exit 64 |
| Another gate's section malformed | `lockfile-age` malformed, `licences` valid | `licences` runs | N/A |
| Configuration names an absent lockfile | `lockfiles: ["nope.json"]` | Refusal naming the path and the setting that named it | Exit 64 |
| No gate given, or an unknown one | `eval-quality-gates`, `eval-quality-gates licence` | Usage error naming the gate set | Exit 64 |
| Allowlist entry is a version pin | `allowlist: ["left-pad@1.3.0"]` | Refusal: the charset admits an SPDX short identifier | Exit 64 |

</frozen-after-approval>

## Code Map

Every citation below was verified by reading at `85758ce`.

**The build target.** `tsconfig-build.json:3` is `include: ["src"]` with `rootDir: "src"` at `:12`. Widening either shifts every emitted path and breaks `main`, `types`, both `bin` entries and all six `exports` targets at once.

**The two gates published here.** `scripts/audit-lockfile-age.mjs` carries no fact about this repository; its flags were already its whole configuration. `scripts/check-licenses.mjs` carried three local policies, all data-shaped: the SPDX allowlist at `:18`, the two-policy split at `:46`, and the `@img/sharp-*` tolerance at `:65` with its live condition at `:333`.

**Where the gate entry points run with nothing installed.** `.github/actions/audit-lockfile-age/action.yml` runs the age audit before `npm ci`, and `pr-checks.yml`'s `canary-licence` job ran the licence scan against a bare checkout. Those two paths may import nothing from `node_modules`, which is what keeps the Zod-backed loader out of the `.mjs` entry points.

**The five call sites that pass the age flags.** The composite action, and `pr-checks.yml:35`, `:165`, `:246`, plus `docs.yaml:60` and `publish.yml:127` through the action. The `--lockfile`, `--window-days` and `--now` flags keep working unchanged.

**The exit-code shape to copy.** `src/cli/arguments.ts:8` declares a `Command` union, `:42-46` the `COMMANDS` array, `:133` "no command given; expected one of ...", `:141` "unknown command ...", and `src/cli/exit-codes.ts:18` `EXIT_USAGE = 64`. `src/cli/main.ts:7-9` records why this repository calls `process.exit` nowhere.

**The forbidden script-name patterns.** `scripts/package-boundary.ts:56-105` holds the twelve, and `scripts/check-package-boundary.ts:109-111` is what scans `package.json`'s `scripts` values against them.

Do not change: `tsconfig-build.json`'s `include` and `rootDir`, `package.json`'s `files`, and any of the six gates this pull request does not publish.

## Tasks & Acceptance

**Execution, pull request 1:**

- [x] `tsconfig-gates.json` (new) -- `rootDir: "scripts"`, `outDir: "dist/gates"`, extending the base, with an explicit `include` naming only the gate sources.
- [x] `tsconfig.json` -- `allowJs: true`, so a `.ts` gate may import a `.mjs` one and `npm run typecheck` reads it. `tsconfig-build.json` sets `allowJs: false`, so the library build stays TypeScript-only.
- [x] `package.json` -- `build` runs both projects; `bin` gains `eval-quality-gates`; `check:website-deps` becomes `check:lockfile-age` and `check:licences`, both inside `validate`.
- [x] `scripts/gate-config.ts` (new) -- the Zod schema, the four refusals, one section validated per call.
- [x] `scripts/gates-cli.ts` (new) -- the multiplexer, `process.exitCode` only.
- [x] `scripts/audit-lockfile-age.mjs` -- exports `WINDOW_DAYS_DEFAULT` and takes `readTimeMap`, the seam that lets a case supply the registry's answers.
- [x] `scripts/check-licenses.mjs` -- the allowlist, the policy split and the tolerance become parameters; the flag path and the hardcoded policies are removed.
- [x] `eval-quality.config.json` (new) -- this repository's own values for both gates.
- [x] `scripts/fixtures/consumer/` (new) -- a compliant fixture and one seeded fixture per gate.
- [x] `scripts/fixtures/licence-canary/eval-quality.config.json` (new) -- the CI canary's own configuration.
- [x] `.github/workflows/pr-checks.yml` -- both gates run through the published path; `canary-licence` installs, because the gate now validates through Zod.
- [x] `tests/architecture/published-gates.test.ts` (new) -- the refusals, the usage errors, each gate over each fixture, and the built binary.
- [x] `tests/architecture/package-exports.test.ts` -- case 155 holds both `bin` targets.
- [x] `scripts/check-doc-claims.ts` and `scripts/check-doc-counts.ts` -- the new page's worked configuration parses against the published schema, and its three numerals are computed.
- [x] `docs/how-to/run-the-gates-on-your-repository.md` (new) and `docs/reference/cli-commands.md` -- the consumer's page, and the second binary in the package-exports section.
- [x] `CHANGELOG.md` `[Unreleased]` and `_bmad-output/project-knowledge/learning-path-step-by-step.md` Step 62.

**Acceptance Criteria:**

- Given a consumer that has only installed the package, when it runs `eval-quality-gates <gate>` in its own repository with a configuration for that gate, then the gate runs over its trees.
- Given a consumer adopting one gate, when it writes that gate's section, then it reads and writes no other gate's.
- Given a gate invoked with no section for it, when it runs, then it refuses naming the file and the gate, and reaches none of this package's values.
- Given a seeded fixture worded from outside a gate's trigger vocabulary, when the gate runs, then it fails on it.
- Given the whole change, when `npm run validate` runs, then it is green and both gates run through the published path.

## Implementation Notes

### The per-gate verdict, for the two this pull request publishes

`audit-lockfile-age` **ships unchanged in mechanism**. No fact about this repository was in it. What it gained is a `readTimeMap` seam and an exported window default; what it lost is nothing.

`check-licenses` **ships with its rules as consumer data**. Its allowlist, its two-policy split and its one scoped exception left the source and became `eval-quality.config.json`. What it lost is its flag path and its `main`, because a policy-free scanner has nothing to be invoked with.

### Why a second tsconfig, and not a move under `src/`

A gate source under `src/` becomes subject to `check:layers`. `scripts/dependency-direction.ts:49` classifies every `src/` file by layer and fails closed on one it cannot classify, so a gate there would need a new architecture layer invented for tooling. That is a layer graph created to satisfy a build, which is the wrong reason to have one.

Widening `tsconfig-build.json` was the other option and it is worse for a mechanical reason: `rootDir` is the prefix every emitted path is relative to, so widening it to the repository root moves `dist/index.js` to `dist/src/index.js` and breaks `main`, `types`, `bin` and all six `exports` targets in one edit.

A second tsconfig costs one file and one `&&` in `build`. `files` already carries `dist`, so the published root does not change and `npm pack` carries exactly the roots case 157 asserts.

### Why the `.mjs` gate entry points stay free of the loader

The composite action audits the root lockfile **before** `npm ci`, and the licence canary ran against a bare checkout. Both are deliberate: an audit that needs an install has already installed the thing it was auditing. The loader validates through Zod, and Zod is in `node_modules`.

So the two `.mjs` gates import nothing from `node_modules` and the multiplexer is the only entry that reads a configuration. The age gate keeps its flags for the pre-install path. The licence canary moved to the published path and gained an `npm ci`, because a policy-free scanner has no flags left to drive it and the canary is better for running what a consumer runs.

The cost is one duplicated number: `WINDOW_DAYS_DEFAULT` in the `.mjs` and `LOCKFILE_WINDOW_DAYS_DEFAULT` in the schema. A case holds them equal, which is the shape Epic 12 settled for a constant that cannot be shared.

### Four refusals, and why the document is never parsed whole

The loader reads the file, parses the JSON, checks the top level is an object, finds the named section, and validates that section alone. Each step has its own refusal because each has a different repair.

Validating the whole document would make a malformed `lockfile-age` section block a `licences` run, which is the opposite of the incremental-adoption property. So the top-level object is not parsed as a schema at all: `GateConfiguration` exists to carry the format's description into a published JSON Schema, and the loader validates one section per call.

An unknown key inside a section is refused, because it is a misspelled setting for a gate you are running. An unknown key at the top level is not, because it is a gate this build does not publish and the by-name refusal already says so precisely.

### Which seed is the adversarial one, per gate

**licences: `Apache-2.0 WITH LLVM-exception`.** Nothing in it reads as disallowed. It contains an allowlisted identifier in full, so a substring test, a prefix test, or an operand split that forgot `WITH` all pass it. The correct reading fails it, because an exception is part of the licence and the allowlist names no exception. The vocabulary the rule was written in is "GPL", "copyleft", "not in the allowlist"; this seed uses none of it.

**lockfile-age: an entry resolved off the npm registry.** The fixture carries no young package at all. Its one entry is an ordinary-looking MIT package at a settled version whose `resolved` points at an internal mirror. The gate's trigger vocabulary is publication age, and this seed says nothing about age: it exercises the fail-closed branch that exists because a lockfile edit can relabel an entry's metadata while `npm ci` pulls the tarball from somewhere else. It also needs no network, because an off-registry entry is refused before any fetch is attempted.

### Why the age gate's compliant case supplies the registry's answers

The gate's one effect is a registry fetch per unique package name. A case that reaches the network fails when the network does and says nothing about the gate when it passes. `readTimeMap` is the seam: the compliant case supplies an ancient timestamp and the young case supplies now, and both run offline. The seeded case needs no seam at all.

The real networked path is held by `npm run validate`, which runs both gates over this repository's own two lockfiles, and by `canary-age` in CI.

### The exit convention

The multiplexer sets `process.exitCode` and calls `process.exit` nowhere, and both gates it publishes already did. `EXIT_USAGE` is declared in `scripts/gates-cli.ts` rather than imported, because the gates build roots at `scripts/` and cannot reach `src/cli/exit-codes.ts`; a case holds the two numbers equal.

The six gates this pull request does not publish still call `process.exit`. Each normalizes in the pull request that publishes it, because the change is a control-flow restructure per gate: `check-package-boundary.ts:150` exits inside a `catch` whose fall-through would run the scan with an unassigned `files`, so substituting the assignment is a defect rather than a normalization.

### Writing style for every line of prose this change lands

No em dash and no spaced hyphen as a clause connector; use a period, colon, or semicolon.
No construction whose only job is to reject a half, including "not X but Y", "X rather than Y", "X, never Y", and the same pair split by a full stop; delete the rejected half and keep the affirmative.
One sentence per line in markdown source, except on pages that already run one paragraph per line, where the page's own convention wins.
No filler and no hedging. Code comments and JSDoc stay lean: say why, once, and stop.

## Spec Change Log

## Review Triage Log

## Design Notes

### The network call on every `validate`, decided rather than inherited

Publishing the lockfile-age gate and running this repository through it doubled the gate's network surface: `validate` now reaches the registry for both lockfiles where it previously did the website one only. A gate that fetches on every run will eventually be flaky, and flakiness in this repository is a defect to fix on sight rather than a cost to tolerate, so the question is answered here instead of the first time CI goes red on a blip.

Fail-closed does not require a live call, and the reason is that the gate's two inputs are both immutable or monotone.

A package's publication time is fixed the moment it is published, so a reading of `name@version` taken once is correct forever. And the predicate is monotone in time: the gate fails an entry that is younger than the window, so an entry that passes today passes every day after. Neither input can change in a direction that turns a pass into a failure.

So a cache keyed on `name@version` holding the publication timestamp is sound with no staleness bound at all, which is a stronger property than the staleness-bounded cache the obvious design reaches for. The only entries needing a live fetch are the ones absent from the cache, which are exactly the dependencies a change added. Fail-closed holds unchanged: an uncached entry whose fetch fails still fails the gate, because nothing has established its age.

The cache ships in pull request 3 of this story rather than here, because pull request 1 is the configuration format and the build target and adding a cache layer to it would mix two subjects. It is inside this story rather than deferred to a new one, on the same rule that makes all three pull requests the story.

What is decided, so pull request 3 implements rather than rediscovers: the cache is keyed on `name@version`, it carries no staleness bound, an absent entry is a live fetch, and a failed fetch for an absent entry fails the gate.



**The build target: a second tsconfig emitting into `dist/gates/`.** Recorded above under "Why a second tsconfig". The decision outlives this story: pull requests 2 and 3 add their gate sources to `tsconfig-gates.json`'s `include` and nothing else about the build moves.

**`allowJs: true` in the base tsconfig is what lets a `.ts` gate import a `.mjs` one.** The alternative was converting the two `.mjs` gates to TypeScript, which is a better end state and a larger diff than this pull request should carry: it moves five CI call sites and annotates about twenty-seven functions. `allowJs` is one flag, reversible, and `checkJs` stays off so the two files are read for their shapes and never type-checked. `tsconfig-build.json` sets `allowJs: false` so the library build cannot pick up a JavaScript file by accident. A later pull request may convert them; nothing here depends on their extension.

**The result shape of each `.mjs` gate is declared at the boundary in `gates-cli.ts`.** Inferring it from an unchecked JavaScript module would make the binary's types depend on what that module happened to return on the day it was read. Declaring `AgeReport` and `LicenceReport` in the consumer states what the binary depends on, and a shape change in either gate lands as a type error in one place.

**Paths in a configuration resolve against the configuration file, not the working directory.** A file that means one thing from the repository root and another from a subdirectory cannot be tested, and a consumer keeping a configuration outside its root would have to write paths that only work from one place. The trade is that a configuration file is not portable across directories without its lockfiles, which is the right way round.

**A policy and a tolerance each carry their own reason, and the reason is required.** The two sentences that justified this repository's `MPL-2.0` addition and its `@img/sharp-*` exception were code comments; moving the values to data without the reasons would have deleted them. `reason` is a required field on both, printed on every run that uses them, so a widening cannot be written without saying why.

**A tolerance's marker is what keeps it honest.** The original exception read `website/astro.config.mjs` on every run and withdrew itself if `passthroughImageService` had gone. That property is generic: an exception names a file and the text that has to be in it, and an absent or unreadable file withdraws it. Encoding the condition rather than a boolean is what keeps the setting out of the class a hand maintains.

**`policies` extends the allowlist with `also` instead of restating it.** A per-path policy carrying its own full list would be a second copy of the allowlist that a hand keeps in step, which is exactly what the story's third property bars. One list and one delta cannot drift.

**No `exports` subpath was added for the schema.** The consumer surface of this pull request is the binary. A `./gates` subpath would need declaration emit from a build that includes JavaScript, and a consumer importing the schema has no use for it that the binary does not already serve. Pull request 2 or 3 can add one if a consumer needs to validate a configuration itself.

**`check:doc-invocations` does not execute the documented gate commands.** Its three spellings match the `eval-quality` binary, and `eval-quality-gates` matches none of them, so the new page's fences are not run. Extending the checker would mean giving its sandbox a consumer repository to run against, which is a larger change than this pull request should carry. What holds the page instead: its worked configuration parses against the published schema through `check:doc-claims`, and its three numerals are computed through `check:doc-counts`.

## Verification

**Commands:**

- `npm run build` -- expected: `dist/gates/` carries `gates-cli.js`, `gate-config.js`, `audit-lockfile-age.mjs` and `check-licenses.mjs`.
- `npm run typecheck` -- expected: green with `allowJs` on.
- `npx vitest run tests/architecture/published-gates.test.ts tests/architecture/package-exports.test.ts` -- expected: green.
- `node scripts/gates-cli.ts --help` -- expected: the usage text, exit 0.
- `node scripts/gates-cli.ts licences --config scripts/fixtures/consumer/licences-seeded/eval-quality.config.json` -- expected: exit 1 naming `fixture-runtime@3.1.0`.
- `npm run validate` -- expected: green.
