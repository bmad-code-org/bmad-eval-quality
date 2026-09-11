---
title: 'The schema-version constants, the dominance comparison, and a version that cannot drift'
type: 'feature'
created: '2026-09-10'
status: 'in-progress'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '15ee57998505893667bfd5be402b2bfa7889382b'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 3.0.0 made a stale probe stamp a `schema-version-mismatch` runtime fault in both `preflight` and `score`, and `PROBE_SCHEMA_VERSION` and `EVAL_CONTRACT_SCHEMA_VERSION` are reachable from none of the four barrels, so a consumer has to copy the number it must satisfy into its own source. `compareDominance` is in the same position: AD-7's four-valued relation is implemented and tested and cannot be imported. `VERSION` is a hand-written literal that a release script rewrites by string substitution, and the case asserting it matches the manifest reads `dist/` and skips when no build has run.

**Approach:** Export the two schema versions from the root barrel on its `root -> core-schemas` edge, re-export `compareDominance` and its vocabulary through `src/application/index.ts`, which is the one path `core/score` has to the root barrel, and write `VERSION` from `package.json` with a generator that a build-free check gates inside `validate`.

## Boundaries & Constraints

**Always:** The dependency matrix stays as it is, so `src/index.ts` keeps its two edges and a `core/score` name reaches it through `src/application/index.ts`. Each union type ships with the `as const` array it is derived from, matching `FAILURE_CODES`, `RUNTIME_FAULT_CODES`, `VERDICTS`, `EVALUATOR_RECOMMENDATIONS` and `QUALIFICATION_FAILURES`. The two schema versions keep their literal-integer declared type, so a consumer comparing against one narrows on it. `CHANGELOG.md` gains an `[Unreleased]` entry and `docs/reference/cli-commands.md` lists the new names, both in this same change.

**Never:** No artifact `schemaVersion` moves, no published JSON Schema document changes, and no stage behavior changes. No Zod schema becomes reachable from the barrel. The publish workflow is untouched. No release is cut here.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Consumer reads a schema version | `import { PROBE_SCHEMA_VERSION } from 'eval-quality'` | Resolves to `5`, declared as the literal `5` | N/A |
| Consumer compares two results | Two `ComparableResult` values and a `Severity` floor | `compareDominance` returns one of the four relation values | N/A |
| `VERSION` matches the manifest | `src/index.ts` and `package.json` agree | `npm run check:version` exits 0 and prints the version | N/A |
| `VERSION` drifts | The barrel literal and `package.json` disagree | `npm run check:version` exits 1, no build needed | Names both values and points at `npm run generate:version` |
| Barrel literal missing | `src/index.ts` declares no `export const VERSION = '...'` | `npm run check:version` and `npm run generate:version` both exit 1 | Names the file and the declaration shape expected |

</frozen-after-approval>

## Code Map

- `src/index.ts` -- the root barrel; carries `VERSION` and the `core/schemas` type exports. Its two edges are `root -> application` and `root -> core-schemas`, stated in its own header comment and enforced by `scripts/dependency-direction.ts:50`.
- `src/application/index.ts` -- the layer barrel; the only path `core/` names have to the root barrel. Already re-exports `QUALIFICATION_FAILURES` with its three types, which is the shape to copy.
- `src/core/schemas/probe.ts:90` -- `PROBE_SCHEMA_VERSION = 5`. Declared with no annotation, so TypeScript already infers the literal type and emits `= 5` into the `.d.ts`. Do not annotate it.
- `src/core/schemas/eval-contract.ts:161` -- `EVAL_CONTRACT_SCHEMA_VERSION = 5`, same shape. `Severity` and `SEVERITY_LEVELS` are declared in this file too.
- `src/core/score/strength.ts` -- `DOMINANCE_RELATIONS:23`, `DominanceRelationValue:30`, `ComparableResult:40`, `compareDominance:254`. Nothing here changes.
- `tests/architecture/package-exports.test.ts` -- the published-surface suite. `EXPORTS_BEFORE_THIS_STORY:122` is the deliberate-removal snapshot, `exportedTypeNames:63` reads type-only exports out of the barrel text, and the unnumbered `'the barrel carries the probe-qualification reason vocabulary'` case at `:299` is the pattern for a new case: a runtime read off the built barrel plus a type annotation resolved through `dist/index.d.ts`.
- `scripts/release-prepare.mjs:146-166` -- `BARREL`, `stampBarrelVersion`, and the `git add` list at `:195`. The substitution moves into the generator; the script calls it the way it already calls `scripts/stamp-changelog.mjs` at `:147`.
- `tests/architecture/release-prepare.test.ts:142` -- the fixture writes `src/index.ts` with the bare declaration and `:261` asserts the stamped result. The fixture repository has no `scripts/`, so the generator must resolve its inputs from the current working directory.
- `scripts/check-schemas.ts:1-16` -- the generate/check pair idiom, including the rule that a check never rewrites what it checks and the constraint that a script run by `node` directly may use no TypeScript enum, namespace, parameter property, or non-type re-export.
- `docs/reference/cli-commands.md:196-205` -- the library-barrel bullet list, where the new names are documented.
- `package.json:66-119` -- the script block and the `validate` chain.
- `.github/workflows/pr-checks.yml:144` -- the validate step name enumerates the checks it runs.
- `CONTRIBUTING.md:85` -- describes release-prepare as stamping `VERSION` in `src/index.ts`.

Do not change: `src/core/score/strength.ts`, any file under `schemas/` or `corpus/`, `.github/workflows/publish.yml`, and the dependency matrix.

## Tasks & Acceptance

**Execution:**

- [x] `src/index.ts` -- export `PROBE_SCHEMA_VERSION` and `EVAL_CONTRACT_SCHEMA_VERSION` from `core/schemas`, and keep `VERSION` as the one literal the generator writes -- the root barrel holds the `root -> core-schemas` edge, so these need no layer hop. `Severity` travels with the dominance group through `src/application/index.ts`; see Design Notes.
- [x] `src/application/index.ts` -- re-export `compareDominance` and `DOMINANCE_RELATIONS` from `core/score/strength.ts`, `SEVERITY_LEVELS` from `core/schemas/eval-contract.ts`, and the types `ComparableResult`, `DominanceRelationValue` and `Severity` -- `core/score` reaches the root barrel only through this file. `Severity` is a type-only export: `eval-contract.ts:39` declares a Zod schema value under that same name, and exporting the value would put a live schema on the barrel, which `tests/architecture/package-exports.test.ts` case 152 refuses. Use explicit named clauses, never `export *`, for the same reason.
- [x] `scripts/generate-version.ts` -- new; read `package.json` from the working directory, rewrite the `export const VERSION = '...'` declaration in `src/index.ts`, and fail when the declaration is absent -- makes `package.json` the one writer of the number.
- [x] `scripts/check-version.ts` -- new; compare the same two and exit non-zero on a disagreement, rewriting nothing -- a gate that needs no build, unlike case 156.
- [x] `package.json` -- add `generate:version` and `check:version`, and put `check:version` into `validate` -- the check runs on every pull request.
- [x] `scripts/release-prepare.mjs` -- replace `stampBarrelVersion` with a call to the generator, the way `stamp-changelog.mjs` is already called -- one substitution, in one place.
- [x] `scripts/release-prepare.mjs:152-155` -- rewrite the docblock so it names the gate that actually holds the agreement -- it currently says "A test asserts the two agree, which catches it after the release branch exists" without naming it, and the test it means reads `dist/` and skips when no build has run, so the sentence overstates what holds.
- [x] `tests/architecture/package-exports.test.ts` -- add a case asserting every new name is on the built barrel, that both schema versions are declared as literal integers, and that `compareDominance` is callable -- the acceptance the story names.
- [x] `tests/architecture/release-prepare.test.ts` -- keep the existing assertions passing against the generator-backed path and cover the absent-declaration refusal.
- [x] `docs/reference/cli-commands.md` -- list the new names in the library-barrel section.
- [x] `CONTRIBUTING.md` -- name the generator where the text describes the stamp.
- [x] `CHANGELOG.md` -- an `[Unreleased]` entry saying what a consumer gains.
- [x] `_bmad-output/project-knowledge/learning-path-step-by-step.md` -- one line for the rule this story establishes; the document ends at Step 59, so this is Step 60.
- [x] `.github/workflows/pr-checks.yml:144` -- add `check:version` to the validate step name, and add `check:doc-counts` and `check:doc-claims`, which that line already omits -- found incidentally while adding the new entry, and the repository does not defer a defect it is standing in.

**Acceptance Criteria:**

- Given a consumer on the published package, when it imports `PROBE_SCHEMA_VERSION` or `EVAL_CONTRACT_SCHEMA_VERSION` from `eval-quality`, then both resolve and each is typed as the literal integer.
- Given a consumer holding two results and a severity floor, when it calls `compareDominance` imported from `eval-quality`, then it gets one of `DOMINANCE_RELATIONS`.
- Given `src/index.ts` and `package.json` disagree on the version, when `npm run check:version` runs without a build, then it exits non-zero and names both values.
- Given the gate is claimed to fail on a disagreement, when the disagreement is created in a scratch copy and the check is run against it, then the observed failure output is recorded in Implementation Notes; reading the assertion is not the proof.
- Given the whole change, when `npm run validate` runs, then it is green.

## Implementation Notes

### The gate was watched failing, in a scratch copy

`package.json`, `src/` and `scripts/` were copied to a scratch directory outside the worktree and the manifest version there was set to `3.0.1`, with the barrel left at `3.0.0`.
No build was run in that copy and `dist/` was never created.

```
$ npm run check:version
> eval-quality@3.0.1 check:version
> node scripts/check-version.ts

check-version: src/index.ts declares VERSION '3.0.0' and package.json declares version '3.0.1'
  run `npm run generate:version` to write the manifest version into the barrel
exit=1
```

The other three rows of the matrix were watched in the same copy.
`npm run generate:version` answered `generate-version: src/index.ts 3.0.0 -> 3.0.1` and `npm run check:version` then exited 0 with `check-version: src/index.ts and package.json both declare 3.0.1`.
With the declaration line deleted from `src/index.ts`, both scripts exited 1 with ``src/index.ts: declares no `export const VERSION = '<version>'` on a line of its own``.

### The new barrel case was watched failing too

Two mutations in a second scratch copy, each rebuilt before the suite ran.

Annotating `PROBE_SCHEMA_VERSION: number` in `src/core/schemas/probe.ts` widens the declared type in `dist/core/schemas/probe.d.ts`, and `npm run typecheck` then reports `tests/architecture/package-exports.test.ts(347,9): error TS2322: Type 'number' is not assignable to type '5'`.
That is the second assignment in the new case, which is the one holding the literal-integer acceptance criterion.

Exporting `Severity` as a value clause from `src/application/index.ts` reddens case 152 with `expected [ 'Severity' ] to deeply equal []` and the new case with `expected [ 'FailureCode', …(16) ] to include 'Severity'`.
That is the mistake the type-only clause exists to prevent, and both gates catch it.

### The dominance signature is held by assignability, and that was watched failing too

The call in the new case goes through `barrel.compareDominance as Expected`, and a cast proves nothing about what `dist/index.d.ts` declares.
A mutual-assignability assertion sits in front of it: the declared type and the expected shape have to accept each other.
Changing the expected return type from `DominanceRelationValue` to `string` gives `tests/architecture/package-exports.test.ts(382,9): error TS2322: Type 'true' is not assignable to type 'false'` and the file was restored afterwards.

### `scripts/version-target.ts` is a third file the task list does not name

The two scripts share the declaration pattern, the two paths, and the reading that locates the declaration.
Spelling those twice is the drift this story exists to close, one directory over from where it closed it.
The module follows the `*-target.ts` idiom `scripts/ad21-table-target.ts` and `scripts/dev-corpus-target.ts` already use for exactly this: a writer and its drift check importing one module so neither can address what the other does not.

### A pre-existing `check:doc-claims` failure was found and closed in this change

`check:doc-claims` rejected `docs/how-to/evaluate-tool-use-behavior.md:332`, which pinned "was run end to end against the built CLI at 2.0.0" while `package.json` declares 3.0.0.
The same failure reproduces on a clean checkout of the baseline commit `15ee579`, so it arrived with the 3.0.0 release and this change is standing in it.
`pinnedVersionIsCurrentMajor` requires the pinned major to equal the published major and requires that same version string to appear in `_bmad-output/implementation-artifacts/11-1-whether-tool-use-evaluation-is-one-gap-or-two.md`, which is the half that refuses typing the new numeral over the old one.

So the route was run again against the built CLI at 3.0.0.
Eight invocations, every command line with its stdout, stderr and exit code captured as it ran.
Route A and Route B each compile at exit 0, seal at exit 0, and pre-flight at exit 0 with all six checks satisfied over the same five legs.
`qualifyProbe` returns `condition-artifact-channel-contract-local` for both artifact-pointer spellings and `sealProbeSet` admits neither, and the stdout-nominated probe qualifies with an empty failure list.
The two boundary refusals the published paragraph asserts both come back as `unreachable-check-evidence` at exit 4.
Four rendered direction sentences, four qualification details and two refusal messages returned byte-identical to what the record wrote down at 1.4.2 and at 2.0.0.
3.0.0's probe-stamp comparison cost the route nothing, because both probe files stamp 5.

The reading is written into that record as `## Re-verified at 3.0.0, 10 September`, naming which parts of the reproduction were reconstructed, since the scratch fixtures were never committed.
`docs/how-to/evaluate-tool-use-behavior.md:332` moves to 3.0.0 and nothing else on the page moves, because no published sentence was contradicted.
`CHANGELOG.md` gets no entry for it: a re-verification that holds every claim changes nothing a consumer sees.

`npm run validate` is green: 129 test files, 4210 tests, statements 97.1%, branches 92.32%.

## Spec Change Log

## Review Triage Log

## Design Notes

`Severity` is declared in `core/schemas/eval-contract.ts`, so the root barrel could export it directly on its second edge. It travels with the rest of the dominance vocabulary through `src/application/index.ts` instead, because a consumer reaching for it is reaching for `compareDominance`'s third parameter, and splitting one call's vocabulary across two files for a layer reason the consumer cannot see makes the surface harder to read than the matrix makes it hard to write. Both routes satisfy the dependency matrix.

`VERSION` stays a literal in `src/index.ts` rather than moving to a generated module of its own, because `scripts/dependency-direction.ts:50` classifies `src/index.ts` as the whole `root` layer by exact path and returns `undefined` for any other file directly under `src/`. A new top-level source file would need a layer rule, which means amending the architecture matrix for a constant.

The gate over `VERSION` already exists and is narrower than `scripts/release-prepare.mjs:153` implies. `tests/architecture/package-exports.test.ts:269` is case 156, `` `VERSION` equals the manifest version ``, and it compares the built barrel's export against `package.json`. It reads `dist/`, so it skips when no build has run, and `npm run validate` builds first, which is why it holds on a pull request and not on a bare `npm test`. The script's docblock states that a test asserts the two agree without naming it, and a reader checking the claim has no way to reach case 156 from that sentence. The new `check:version` is the build-free half, and case 156 stays as the check over what was actually built and published.

The class this belongs to is a source comment asserting a fact about the repository. `check:doc-claims` does not cover it and the hole is in its declared scope statement rather than its implementation: its own header limits it to `docs/`, and every one of its eight classes resolves a published page against an artifact. No gate in `validate` reads a source comment. Closing that class means a new gate over `src/` and `scripts/` prose, and it is scheduled as Story 12.2 in `_bmad-output/planning-artifacts/epics.md` with its own acceptance criteria. This story corrects the one sentence and establishes the convention 12.2 enforces: a comment claiming a verification names the case that performs it.

The version drift FR17 reported is already closed for the published package: `eval-quality@3.0.0`'s tarball declares `VERSION = "3.0.0"` and its manifest reads `3.0.0`, verified by unpacking the published tarball. The drift FR17 read was real at 2.0.0 and `stampBarrelVersion` is what closed it. What stays open, and what this story closes, is that the number is still written by hand into a source file, and the only gate over it reads `dist/` and skips when no build has run.

### Writing style for every line of prose this change lands

No em dash and no spaced hyphen as a clause connector; use a period, colon, or semicolon.
No construction whose only job is to reject a half, including "not X but Y", "X rather than Y", "X, never Y", "X instead of Y", and the same pair split by a full stop; delete the rejected half and keep the affirmative.
One sentence per line in markdown source.
No filler and no hedging.
This applies to the changelog entry, the documentation edits, code comments, and JSDoc.
Code comments and JSDoc stay lean: say why, once, and stop.

## Verification

**Commands:**

- `npm run check:version` -- expected: exits 0 and prints the agreed version.
- Copy the tree to a scratch directory, change `package.json`'s version there, run `npm run check:version` in the copy -- expected: exit 1 with both values named. Record the exact output in Implementation Notes.
- `npm run validate` -- expected: green, including the new barrel case and `check:version`.
- `npx vitest run tests/architecture/release-prepare.test.ts` -- expected: green against the generator-backed stamp.
