# Changelog

All notable changes to `eval-quality` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

Write entries under `[Unreleased]`. `npm run release:prepare` moves them into a dated version
section when a release is cut, and the publish workflow uses that section as the GitHub Release
body.

## [Unreleased]

### Added

- The `ingest` stage at `src/core/ingest/`, which turns a caller's sealed run record, isolation
  manifest, and evaluator configuration into validated observations plus every cross-artifact
  condition it detected. It enforces the rules six shipped schema fields and AD-16 name `core/ingest`
  as the enforcement point for, and it is reachable from no published surface: neither
  `src/index.ts` nor `src/application/index.ts` exports it, and the CLI still has three commands.
  Eight of its eleven conditions have no rung on either verdict ladder yet and carry an explicit
  null target. A later story adds the rungs.
- Documentation for the two published subpaths that had none: `eval-quality/adapters` and
  `eval-quality/conformance` are covered by a new "Ports, adapters, and the conformance suite" page.

- Two compile-time failure codes in AD-5's registry, the closed enumeration `compile` reports
  against: `binding-cycle`, for a cycle over a compiled plan's capture edges and `after` edges taken
  together, and `captured-channel-undeclared`, for a captured pointer naming any channel but
  `response-body`. The registry's move from 21 entries to 23 is itself a break for an exhaustive
  match; see **Changed** below.

### Changed

- **Pre-1.0 SemVer: the next release is `0.2.0`, and a `0.1.x` range no longer holds.** Every item
  marked BREAKING below breaks against `0.1.0`. Pin exactly, or move the range to `0.2.x` once you
  have read the two runtime statements below: none of these breaks announces itself as a version
  mismatch while your program is running.
- **BREAKING: nine `schemaVersion` bumps across six of the twelve interchange artifacts.** AD-11,
  which fixes version identity and requires a break to be disclosed on release, reads "adding an
  optional field is a `schemaVersion` bump recorded in the field's own description; removing or
  retyping is breaking". Each of the nine bumps added a required field, which retypes the shape. The
  numbers below are each artifact's net move from the version a caller pinned to `0.1.x` holds.
  Except where a bullet says otherwise, no document at the older version parses.
  - **BREAKING** sealed run record **1 → 3**. `mode` became required: AD-21's run mode, `production`
    or `contract-scoring`, supplied by the caller on the record, with no schema default and never
    derived, recomputed, or defaulted afterwards. Then `sequence` became required on every
    observation, so ordering is read from that field and never from array position. It must be a
    positive integer, unique within the record; it need not start at 1 and need not be contiguous,
    so `[5, 12, 40]` is a valid set of sequences. Uniqueness is a cross-observation rule that JSON
    Schema cannot express, so `schemas/sealed-run-record.schema.json` publishes `sequence` as a
    required positive integer and nothing more: a validator driven by the published schema alone
    accepts a record with duplicate sequences that this package rejects. Neither a version-1 nor a
    version-2 record parses.
  - **BREAKING** eval contract **1 → 3**. `InteractionStep.cardinality` became required
    (`exactly-one`, `at-most-one`, `any`). Then `testData.principals` and `testData.resources`
    became required keys that accept `null`: a contract declaring neither writes `null` for both,
    and omitting the keys fails to parse.
  - **BREAKING** evidence artifact **1 → 3**. `ScoringVersionInputs` gained a required sixth field,
    `mode`. Then the contract-scoring branch gained a required `uncitedFindingGaps` array, where
    `[]` is legal and the key itself is what is mandatory. That second bump is branch-scoped: a
    version-2 *production* evidence artifact still parses under version 3, since the production
    branch never carries the key.
  - **BREAKING** sealed evaluator brief **1 → 2**. `principals` became required, carrying the
    contract's `testData.principals` names, sorted, as opaque labels with no credential value. It is
    not nullable; a contract declaring none produces `[]`.
  - **BREAKING** probe **1 → 2**. AD-9's `qualification` record, the per-class route and mutation
    and rollback evidence that lets a probe enter a sealed corpus, became required on every probe,
    which is what stops any version-1 probe from parsing. AD-40's `defectSignature`, the
    machine-readable interface kind, home operation, observable channel, and discriminating
    condition, became required on the `expectedClean: false` branch only, and a clean control
    carrying one is rejected. The key is what is mandatory there: `null` is a legal value and is
    what a `canary` carries, since a canary's job is to indict the fixture and it seeds no defect
    for a signature to describe.
  - **BREAKING** scoring policy **1 → 2**. `catchThreshold` became required: AD-7's trial-set reducer
    counts a probe as caught only when its caught-trial count is strictly greater than this fraction
    of its valid-trial count, so an exact tie never counts as caught. There is no schema default, so
    the value must be supplied. `schemas/scoring-policy.schema.json` ships in the tarball, so a
    policy document written against version 1 stops parsing.
- **The `schemaVersion` number gates nothing in either direction in v0, so none of these breaks
  announces itself as a version mismatch.** A pre-bump artifact is rejected for the required fields
  it lacks, and it surfaces as an ordinary schema parse failure; AD-28's `schema-version-mismatch`,
  the runtime-fault registry's dedicated code for exactly this, never fires on ingest. The reason is
  that v0 ships no ingest-side version comparison at all. The only comparison against a version a
  reader expects is `readMembers` in `core/lineage/chain.ts`, which takes its
  `acceptedSchemaVersion` from the caller and runs over artifacts that have already parsed. The one
  other comparison in the package, `reviseArtifact` in the same file, checks a revision body against
  its own parent on AD-29's mint path and throws a `TypeError`, so it is a programmer-error guard in
  neither code registry and never sees a caller's ingest. Both directions follow from that absence.
  An
  artifact carrying a *higher* `schemaVersion` than the reader expects, but the right fields, parses
  and is accepted silently. So does a stale stamp in the other direction, and the package ships
  twenty live examples of it: the nineteen contracts under `corpus/dev/contracts/` and
  `corpus/dev/compile-seal-example/contract.json` each carry `schemaVersion: 1` against an
  eval-contract schema now at 3, satisfy that schema's version-3 shape in full, and ship in the
  tarball. The one lever a caller has is `validateLineageChain` in `core/lineage/chain.ts`:
  pass **your own** expected version as `acceptedSchemaVersion` and a chain member outside it throws
  `schema-version-mismatch`. Passing the artifact's own `schemaVersion` there makes the check
  tautological, which is what the repository's generated worked example does today.
- **BREAKING: scoring versions do not compare across this release.** Mode entering AD-11's identity
  inputs changes `ScoringVersionInputs`, so every scoring version computed before this release is
  non-comparable with every version after it. A stored version names five inputs where the current
  one names six, and `ScoringVersionInputs` is a closed object with no legacy branch, so a
  five-input record surfaces as an unnamed parse failure, with no signal naming the version gap as
  the cause. The artifact's own `comparabilityKey` and `strength.comparable` are a different axis:
  they say whether two results scored under the same version may be compared, and neither reports a
  version mismatch. Recompute before comparing anything against a stored version.
- **BREAKING: AD-5's compile-time failure-code registry moves from 21 entries to 23.** The two new
  codes are listed under **Added** above. This registry is one of the two code registries AD-11
  requires disclosed on release, and the enumeration is itself the caller-facing surface: an
  exhaustive match over it stops being exhaustive.
- **Unchanged in this release, stated so the silence is not read as an oversight.** The other code
  registry, AD-28's runtime faults, stays at its ten codes, and the CLI command, flag, and exit-code
  contract published in `0.1.0` is untouched. Those are the remaining members of AD-11's
  caller-facing surface.

## [0.1.0] - 2026-08-28

### Added

- The library surface: `eval-quality` exports the contract schema, the oracle vocabulary, the
  compiler, `seal`, the pre-flight (`runPreflight`, `preflightFromObservations`), the diagnostics
  sink, `serializeArtifact`, and the artifact types. `eval-quality/adapters` carries the three
  reference adapter factories; `eval-quality/conformance` carries the port types and the
  conformance suite an adapter author runs against their own implementation.
- The `eval-quality` CLI with `compile`, `seal`, and `preflight`, each a single call into the
  library plus artifact serialization. Every command reads stdin when an input flag is left out,
  writes the artifact to stdout without `--out`, and keeps diagnostics on stderr. The exit-code
  ladder (`0` success, `1` CONCERNS promoted by `--strict`, `2` FAIL, `3` pre-flight did not pass,
  `4` structural failure, `5` runtime fault, `64` usage error) is published as part of the contract.
- The twelve generated JSON Schema documents at `eval-quality/schemas/*` and the stage-one
  development corpus at `eval-quality/corpus/*`, both shipped in the tarball.
- The package-boundary check (`npm run check:boundary`) proving the published tarball carries
  exactly the manifest fields, files, and subpaths the surface declares, and the dev-corpus drift
  check (`npm run check:corpus`).

### Changed

- `core/` is measured against a ninety-percent statement and branch coverage floor, and the floor
  gates `npm run validate`.
- `Scanner` in `core/canonical/scan-json.ts` assigns its fields explicitly so Node's type stripping
  can load every script that imports `core/canonical/`.

### Fixed

- The pre-flight reducer throws `port-contract-violation` on a repeated `probeId` instead of
  silently taking the last observation.

