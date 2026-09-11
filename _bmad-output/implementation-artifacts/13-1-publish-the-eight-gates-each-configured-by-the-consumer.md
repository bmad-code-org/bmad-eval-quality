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

**Execution, pull request 2:**

- [x] `scripts/dependency-direction.ts` -- becomes a scanner over a supplied graph: `compileGraph`, `classifyLayer`, `scanSources`. Keeps the static `typescript/unstable/ast` import; reachable only through a dynamic import taken after the peer is probed.
- [x] `scripts/check-dependency-direction.ts` -- the gate module: `DependencyDirectionSection` (Zod), the refusals, `runDependencyDirection`. Reaches `typescript` nowhere on its own load path.
- [x] `scripts/discover-source-files.ts` -- walks multiple declared roots, each with its own extension filter, in place of one hard-coded `src/`.
- [x] `scripts/package-boundary.ts` -- the scanned-set composition and the twelve forbidden patterns both become consumer data: `paths` (root, recursive, extensions, optional), `manifest.fields`, and an ordered `patterns` array each carrying its own `reason`. `MAX_PATTERN_LENGTH`, `MAX_PATTERNS` and a flag restriction bound a consumer-supplied regular expression; backreferences are refused outright.
- [x] `scripts/check-package-boundary.ts` -- deleted. Its one job, run this repository's own values through the scanner, is now `eval-quality-gates package-boundary` with no section-specific code, matching the treatment `check-licenses.mjs`'s CLI already got in pull request 1.
- [x] `scripts/lineage-ownership.ts` -- generalized from lineage enforcement to a field-ownership check: which fields, which paths may declare them, which modules may write them, which helper identifiers count as a write. Reaches the token scanner through a dynamic import behind the same peer probe as the direction gate.
- [x] `scripts/check-lineage-ownership.ts` -- deleted, for the same reason as its boundary counterpart.
- [x] `scripts/gate-config.ts` -- three more sections: `DependencyDirectionSection`, `PackageBoundarySection`, `FieldOwnershipSection`. `GATE_NAMES` grows from two to five.
- [x] `scripts/gates-cli.ts` -- three more gates dispatched, the `typescript`-peer refusal mapped to exit 64 on both new gates that need it, report-only handled as its own outcome kind rather than as a special case of pass.
- [x] `package.json` -- `peerDependencies.typescript` (optional, via `peerDependenciesMeta`); `check:layers`, `check:lineage` and `check:boundary` all point at the gates binary, matching `check:licences`.
- [x] `tsconfig-gates.json` -- the six new gate sources added to `files`.
- [x] `eval-quality.config.json` -- this repository's own `dependency-direction`, `package-boundary` and `field-ownership` sections.
- [x] `scripts/fixtures/consumer/direction-*`, `boundary-*`, `lineage-*` (new) -- a compliant and a seeded fixture per gate, each seed worded from outside its gate's trigger vocabulary.
- [x] `tests/architecture/dependency-direction.test.ts`, `package-boundary.test.ts`, `lineage-ownership.test.ts` -- rewritten against the new data-driven scanners; 168, and the file's own counts, respectively.
- [x] `tests/architecture/dev-corpus.test.ts` -- case 166 reads this repository's boundary patterns from `eval-quality.config.json` instead of an exported constant, since the gate no longer carries one.
- [x] `tests/score/outcome.test.ts` -- one call site updated for `discoverSourceFiles`'s new multi-root signature.
- [x] `tests/architecture/published-gates.test.ts` -- a case per new gate over its compliant and its seeded fixture, plus a report-only case asserting exit 0 with a non-zero count in the output.
- [x] `scripts/check-doc-claims.ts`, `scripts/check-doc-counts.ts` -- the FENCES intro widened from "both gates" to "all five gates"; the gate-count numeral and the ordering-witness and scanned-line-bound numerals held against their constants.
- [x] `docs/how-to/run-the-gates-on-your-repository.md` -- sections for the direction, boundary and field-ownership gates; states which three direction-gate rules are not configurable and why.
- [x] `CHANGELOG.md` `[Unreleased]` and `_bmad-output/project-knowledge/learning-path-step-by-step.md` Step 63.

**Acceptance Criteria, pull request 2:**

- Given the transcribed layer graph run against this repository's own tree, when compared against the code's verdict, then they agree: 128 files, 0 violations.
- Given the two nesting layer rows swapped, when the schema is asked to accept it, then it refuses at 64 rather than silently re-layering, and the measured violation count under the old permissive behavior is 78.
- Given TEA's Story 4.7 needs a first run that reports without failing, when `reportOnly` is set, then the run exits 0 and the summary always carries the violation count, including zero, so a report-only run is never silent.
- Given `check-dependency-direction.ts` and `check-lineage-ownership.ts` reach `typescript` at runtime while it is a devDependency, when either is invoked with `typescript` unresolvable, then it refuses by name, naming both the missing dependency and the gate that needs it.
- Given a seeded fixture worded from outside each gate's trigger vocabulary, when the gate runs, then it fails on it, and the compliant fixture passes clean.
- Given the whole change, when `npm run validate` runs, then it is green and all five gates run through the published path.

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

The six gates this pull request does not publish still call `process.exit`. Each normalizes in the pull request that publishes it, because the change is a control-flow restructure per gate: the old `check-package-boundary.ts` exited inside a `catch` whose fall-through would run the scan with an unassigned `files`, so substituting the assignment was a defect rather than a normalization when that file was read for pull request 2.

### `check:layers` was seconds from becoming a vacuous pass

`check:layers` ran `node scripts/check-dependency-direction.ts`. Pull request 2 turned that file from a script with an entry point into a gate module: a Zod schema and some functions, imported rather than run. Nothing about the file changed to say so, and nothing about the npm script changed to notice: `node` on a module with no top-level side effect exits 0 having done nothing, which is indistinguishable from a gate that scanned the tree and found it clean.

It was caught in the handoff between two sessions building this pull request, by reading the wiring rather than by any check firing, because no check was in a position to fire: a script that reports nothing has nothing for `npm run validate` to disagree with. `check:layers`, `check:lineage` and `check:boundary` now all point at the gates binary, the same as `check:licences` already did, so each npm script runs the gate through the one path that actually executes it.

### The layer graph: transcribed, measured, and one edge left open for the repository owner

Turning the layer graph from code into data meant writing this repository's own architecture down for the first time in a form other than a `switch`. Before building anything on it, the transcription was run against this repository's own `src/` tree and compared to what the code decides today: 128 files, 0 violations, every observed edge and external permitted under the table. The eight prefix tests, the per-layer `switch` and the three hard-coded special cases together express exactly what the table expresses.

The graph had also already been written down once, independently: `tests/architecture/dependency-direction.test.ts` carries its own adjacency map and compares 63 of the 64 cells against `isAllowedEdge` on every run, the 64th being `root` importing itself, which cannot be constructed. The transcription matches it cell for cell. So this pull request re-sites an existing artifact rather than authoring a first one.

**The layers are an ordered array, and the order is load-bearing.** Every file under `src/core/schemas/` matches both that prefix and `src/core/`, and the narrower one has to be tested first. Swapping those two rows was run against this repository's own tree and produces exactly 78 violations where there are none today: 30 `zod` imports the reordered `core` layer would now deny, plus 23, 13, 8 and 4 more from `root`, `adapters`, `testing` and `ports`. The schema refuses the mistake outright rather than accepting an unordered map or a map that gets sorted for tidiness: `"src/core/schemas/" is unreachable: layers[1] "core" matches "src/core/" and every path under it, and it is listed first`. A configuration error at exit 64 replaces a silent re-layering.

**One edge the old `switch` granted is transcribed as it stands, and it is not this pull request's decision to narrow.** `isAllowedEdge`'s `case 'core-schemas': case 'core':` fall-through grants `core -> core-schemas` and `core-schemas -> core` both, and no file in this repository exercises the reverse direction. `ARCHITECTURE-SPINE.md:150` reads "`core/` imports `core/schemas` and nothing else outside itself" and `:593` repeats it, which grants only the forward edge; but the sentence immediately after `:150` describes `CORE` as one node whose interior, `core/schemas` included, permits an import between any two modules inside it, which read strictly covers the reverse direction too. The spine supports two readings and nothing here decides between them, so the configuration keeps the edge the code has always granted. Changing no verdict today, since nothing exercises it either way, is what makes leaving it open costless.

The same paragraph carries a second open question, found by the same transcription and worth deciding alongside the first because both turn on one question: whether this repository's layers are a directed graph of leaf nodes or a tree with permeable interiors. `src/cli/render.ts:9` imports the external `zod` while the graph denies `cli -> core-schemas`, so the command line may reach the library `zod` depends on and may not reach this package's own Zod boundary. Transcribed as it stands, for the repository owner to answer with both questions in view.

### Two more seeded defects, each a real defect no configuration could reach by naming what the gate already checks

The boundary and field-ownership gates needed the same discipline as the direction gate's reference-directive seed: not an obviously-wrong instance, but the shape of defect the gate's own vocabulary has no word for.

**Boundary: a location rather than a document.** The twelve forbidden patterns this repository declares name a process vocabulary, planning artifacts, story and epic references, a specific filename once caught by hand. None of them names a place. The seed points a shipped module at a path the published file list does not carry and at an absolute build-machine path, neither of which any of the twelve patterns can see, because the class of thing they look for is a word in the text and this defect is a location the text merely states correctly. The test asserts both halves: the seeded tree fails its own configuration on all three injected patterns, and scans clean under this repository's twelve.

**Field ownership: a write that is not an assignment.** Every one of the scanner's triggers is a name somebody wrote down: an owned field, a literal assignment, a helper identifier. The seed moves both owned fields through a second helper one directory away inside a declared path, naming no owned field directly and assigning nothing the scanner's assignment pattern matches. The test asserts both halves too: it fails once the helper is named in `helpers`, and reports clean with the same defect still in the tree once the name is dropped. The one residual the gate cannot reach under any configuration, a property copy from an object built elsewhere, is stated in the documentation instead of seeded, because a seed for something no configuration can catch would be theatre.

None of the three PR 2 seeds could have been written by asking the gate what it checks. Each was written by asking what the gate's vocabulary has no word for.

### `MAX_SCANNED_LINE` was sized for the wrong threat, and running the gate on this repository's own tree is what found it

The boundary gate bounds the length of the text a consumer-supplied pattern is matched against, so a minified bundle or an embedded data URI cannot hand a pattern a megabyte. The first value chosen, 4096 characters, was sized against that threat model in the abstract. Running the gate against this repository's own declared paths, which include `corpus/` unfiltered, found the actual threat model was the wrong one to size against: this repository's own committed behavioral contracts are one JSON object per physical line, and the longest today is 13,333 characters. The gate failed on its own tree, with 25 false violations, before it failed on anyone else's.

The bound is now 65,536 characters, comfortably past the worst case on hand and still well short of an actual megabyte-scale bundle, which is what the constant exists to stop. The other half of the protection, the refusal of backreferences and of `g`/`y` flags plus the caps on pattern count and length, is unchanged and is doing the real work; the line bound is the secondary guard, and its number should track this repository's own content rather than a round number picked before anyone had run it.

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

### Field ownership is a different product from lineage enforcement, and the documentation says so

`lineage-ownership.ts` carried one repository's own concept: which two fields AD-29 reserves, which two paths may declare a schema carrying them, which modules AD-24's stage table names as writers. Parameterized, what is left is a generic thing, a check that a set of fields is written only by a declared set of modules, in a declared set of ways. That is a real capability and it is not the same claim as "your lineage is correct", so the published documentation names it as field ownership and states plainly what a consumer with no lineage concept gets from it: a way to keep a small set of fields, api keys, feature flags, anything with exactly one place it should be set, out of a second call site nobody meant to add.

**The writer list cannot be derived through the published configuration, and the drift fails a gate instead of going unheld.** `LINEAGE_WRITER_MODULES` is computed at module load from `STAGE_SIGNATURES`, a TypeScript table; JSON has no equivalent computation to hand a consumer. So this repository's own `field-ownership.writers` in `eval-quality.config.json` is a transcription, and `tests/architecture/lineage-ownership.test.ts` holds it equal to the derived list in both directions, so a stage that starts or stops minting a lineage-bearing artifact fails validate until the configuration moves with it. This is the repository's own standing treatment for a value nothing can derive: declare it, and gate the drift.

**`typescript` is reached through a dynamic import behind a capability probe, on both gates that need it, so neither carries a static dependency on a package that may not be installed.** `probeTypeScript` (direction) and the field-ownership gate's own `loadTokenScanner` both attempt the import, catch `ERR_MODULE_NOT_FOUND`, and rethrow a coded refusal naming the missing dependency and the gate that needs it. The refusal is exit 64, a configuration error, on the reasoning that a consumer who adopted the other three gates and did not install `typescript` has not made a mistake about a rule; they have not opted in yet, and the gate says so by name rather than crashing.

**Report-only lives in the configuration file, not as a command-line flag.** A flag is an invocation detail nobody reading the committed configuration can see, and nothing reminds a maintainer it is on. A committed `"reportOnly": true` is a line a reviewer sees in the diff that adds it and the diff that removes it, which is what TEA's Story 4.7 needs: the first run's report-only state is itself part of the record of how the fix was sized before it was committed to.

## Verification

**Commands:**

- `npm run build` -- expected: `dist/gates/` carries all five gates' compiled or copied output.
- `npm run typecheck` -- expected: green.
- `npm run check:layers`, `npm run check:lineage`, `npm run check:boundary` -- expected: green, each running through the gates binary.
- `npx vitest run tests/architecture` -- expected: green.
- `node scripts/gates-cli.ts --help` -- expected: five gates listed, exit 0.
- `node scripts/gates-cli.ts dependency-direction` -- expected: `128 file(s) scanned across 1 root(s), 0 violations`.
- A scratch configuration with the two `core-schemas`/`core` rows swapped -- expected: refused at 64, naming the row and the reason.
- Each seeded fixture (`direction-seeded`, `boundary-seeded`, `lineage-seeded`) -- expected: exit 1, naming exactly the injected defect.
- A report-only configuration over the seeded fixture -- expected: exit 0, with the violation count and the violation line both printed.
- `npm run validate` -- expected: green.
