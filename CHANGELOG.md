# Changelog

All notable changes to `eval-quality` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

Write entries under `[Unreleased]`. `npm run release:prepare` moves them into a dated version
section when a release is cut, and the publish workflow uses that section as the GitHub Release
body.

## [Unreleased]

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

