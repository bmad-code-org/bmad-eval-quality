# Epic 12 Context: the exports a downstream consumer reads

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

3.0.0 made a stale probe stamp a `schema-version-mismatch` runtime fault at exit `5` in both `preflight` and `score`, and it gave no caller a way to read the number that decides it.
`PROBE_SCHEMA_VERSION` (`src/core/schemas/probe.ts:90`) and `EVAL_CONTRACT_SCHEMA_VERSION` (`src/core/schemas/eval-contract.ts:161`) are declared, exported from their own modules, and reachable from none of the four barrels.
The `exports` map carries no wildcard, so a deep import is refused with `ERR_PACKAGE_PATH_NOT_EXPORTED`, and a consumer has to copy the integer into its own source to satisfy a rule this package enforces.
That copy is the drift the constants were introduced to end.
`compareDominance` (`src/core/score/strength.ts:254`) sits in the same position: AD-7's four-valued relation is implemented, tested, and unreachable.
`VERSION` is a hand-written literal at the bottom of `src/index.ts` that a release script rewrites by string substitution, and the one case asserting it matches the manifest reads `dist/` and skips when no build has run.
When the epic ends, a consumer on a released version reads both schema versions and runs the dominance comparison through `import ... from 'eval-quality'` with no deep import and no copied literal, and `VERSION` is written from `package.json` by a generator behind a gate that needs no build.

## Stories

- Story 12.1: The schema-version constants, the dominance comparison, and a version that cannot drift
- Story 12.2: A comment that claims a verification names the case that performs it

## Requirements & Constraints

- **This epic exists because a downstream consumer cannot reach values this package enforces.** The consumer is TEA, a separate repository, and its authoritative requirements are three. Both schema-version constants resolve from a public entry point. `compareDominance` resolves from a public entry point along with `ComparableResult`, `DominanceRelationValue` and `Severity`. `VERSION` tells the truth, because the consumer read `2.0.0` off the published build while the manifest declared `3.0.0`. That repository is read-only for this epic; nothing in it is edited here.
- **The consumer's own work is blocked on the second of the three.** Its dominance-comparison feature has no way to run until `compareDominance` is reachable, and its version check against `VERSION` is silently wrong until the third lands.
- **Each constant's declared type is the literal integer.** A consumer comparing against one narrows on it, so a widened `number` fails the requirement even though the value is right.
- **Each union type ships with the `as const` array it derives from**, the way `FAILURE_CODES`, `RUNTIME_FAULT_CODES`, `VERDICTS`, `EVALUATOR_RECOMMENDATIONS` and `QUALIFICATION_FAILURES` already ship.
- **A capability reachable one way and not the other is a defect.** The library and the CLI expose the same surface, and the library is where a programmatic consumer lives.
- **AD-11 puts the version comparison on the reader.** A reader accepts an equal `schemaVersion` only and throws `schema-version-mismatch` outside that. Each constant is the single place its number is written, which is why publishing it is the reader obligation seen from the caller's side.
- **The package boundary holds.** `src/index.ts` keeps its two edges, `root -> application` and `root -> core-schemas` (`scripts/dependency-direction.ts:92-93`), so nothing here amends the dependency matrix.
- **Nothing measured moves.** No artifact `schemaVersion` bumps, no published JSON Schema document changes, and no stage behavior changes.
- **Documentation moves in the same diff.** The published-surface section of `docs/reference/cli-commands.md` lists every new name, `CHANGELOG.md`'s `[Unreleased]` records what a consumer gains, and the story adds its own step to `_bmad-output/project-knowledge/learning-path-step-by-step.md`. The learning path ends at Step 59, so this epic is Step 60.
- **Prose the code contradicts is a defect.** Every sentence describing the old surface moves with the change, and the story says which ones it found.
- **The release is part of the definition of done.** The consumer depends on a published version, and the bump is minor, since every change here is additive or a correction.

## Technical Decisions

- **`compareDominance` reaches the root barrel through `src/application/index.ts`.** That layer barrel is the one path `core/score` has, and it already re-exports `QUALIFICATION_FAILURES` off `core/score/qualification.ts`, so the precedent and the mechanism both exist.
- **The two schema-version constants ride the `root -> core-schemas` edge directly**, beside the artifact type exports `src/index.ts` already carries on that edge.
- **`Severity` is declared twice under one name.** `src/core/schemas/eval-contract.ts:37` declares `SEVERITY_LEVELS`, `:39` declares a Zod schema value called `Severity`, and `:42` declares the union type called `Severity`. A `export type { Severity }` clause publishes the type and keeps the schema value off the runtime barrel. The story decides which of the two the barrel publishes and records the reason.
- **`DOMINANCE_RELATIONS` (`strength.ts:23`) is the `as const` array behind `DominanceRelationValue` (`:30`).** `ComparableResult` (`:40`) is a read projection over fields that already live on `EvidenceArtifact`, so it ships as a type with no runtime companion.
- **One mechanism writes the version number.** `stampBarrelVersion` in `scripts/release-prepare.mjs` rewrites the barrel literal by substitution and fails the release when the literal does not match the manifest. The generator takes that job and `release-prepare` calls it, so the substitution exists in one place.
- **Three committed cases pin the current shape and move with it.** `tests/architecture/release-prepare.test.ts:144` and `:255-261` assert the barrel literal is stamped during a release. `tests/architecture/package-exports.test.ts:269-271` is the build-dependent case a build-free gate supersedes. `tests/index.test.ts:6` asserts only that `VERSION` is a string, which is why the drift survived.
- **`EXPORTS_BEFORE_THIS_STORY` (`tests/architecture/package-exports.test.ts:122-134`) is a committed snapshot of the barrel, and adding a name to it records a deliberate removal.** The new exports are asserted as present; that list stays as it is.
- **`check:doc-claims` class 2 holds every backticked identifier on a published page against a declaration under `src/`**, so the new names may be listed on `docs/reference/cli-commands.md` as soon as they exist. The Enumerations bullet there is not a registered transcribed list, so the gate holds the names and leaves the bullet's completeness to the reader.
- **A new `check:version` needs a `validate` entry and a workflow entry.** The validate step name at `.github/workflows/pr-checks.yml:144` enumerates the checks it runs and already omits `check:doc-counts` and `check:doc-claims`; the story fixes that line while adding its own.

## Cross-Story Dependencies

- Story 12.2 follows Story 12.1 and depends on it: 12.1 establishes the convention that a comment claiming a verification names the case performing it, and 12.2 is the gate that enforces the convention.
- It depends on the score stage for the comparison it publishes and on the preceding epic for the barrel and the corpus state it inherits.
- It depends on nothing in the consumer repository. The consumer's stories wait on the release this epic produces, and the sequencing runs one way only.
