# Changelog

All notable changes to `eval-quality` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

Write entries under `[Unreleased]`. `npm run release:prepare` moves them into a dated version
section when a release is cut, and the publish workflow uses that section as the GitHub Release
body.

## [Unreleased]

### Added

- A contract can describe a system under test that runs behind a command. `permittedInterfaces` is
  now a union discriminated on `kind`. The `api`, `web`, and `mcp` branches carry the shipped
  operation shape, so every existing contract parses unchanged; `web` and `mcp` still
  fail compilation under `unsupported-interface-kind`, which is how AD-10 says an undeclared kind
  fails. The `cli` branch carries a command operation: a logical `invocation` of an executable plus
  a subcommand path in place of a method and a path template, a `requestShape` over `argument`,
  `option`, `environment`, and `stdin`, an `artifacts` list of the files it writes, a
  `descriptorChannel` naming the output channel its one `responseDescriptor` describes, and the
  same `stateChangeMarker`, `volatilePointers`, and `sensitivityWitness` an api operation carries.
  `invocation.executable` is an `Identifier`, so `/usr/local/bin/tool`, `./tool`, and
  `http://host/tool` are parse errors: AD-35's rule that a contract never names a target is
  enforced by the schema rather than by a check nobody wrote.
- An operation's declared output channel is descendable through its response descriptor. AD-19
  gives every operation one descriptor, and `descriptorChannel` says which channel it describes, so
  `/interactions/{stepId}/stdout/{key}` resolves against a command operation's descriptor exactly
  as `/interactions/{stepId}/response-body/{key}` resolves against an api operation's. Reachability,
  the captured-pointer channel rule, and `quantifier-over-non-collection` all ask the operation
  which channel that is instead of assuming the response body. A tailed pointer at the stream an
  operation does not nominate is still `unreachable-check-evidence`.
- `call-inputs` addresses the four command channels as well as the four transport channels, so a
  command contract can address its own declared inputs. The channel partition is unchanged.
- `interfaceKindOf` and `commandOperationOf` join `PlanIndex` beside `operationOf`, which keeps
  returning an api-shaped operation. A caller that reads a kind-specific field asks the kind first.
- `artifact` is an eighth evidence channel, spelled `/interactions/{stepId}/artifact/{artifactId}`
  plus a tail. It takes a declared identifier segment before its tail for the reason AD-26 gives for
  `call-inputs`: a channel that names one of several things needs something to resolve against. The
  identifier resolves against the operation's own `artifacts` list, and a name absent from it fails
  compilation under `unresolved-artifact-reference` rather than resolving absent, on AD-26's
  precedent for a dangling reference-set identifier. `descriptorChannel` gains its `artifact` arm,
  so an operation may nominate a written file as the channel its response descriptor describes.
- `unresolved-artifact-reference` and `irreducible-step-reference` join AD-5's registry, which now
  carries twenty-five codes. The second reports two steps of one direction that render to the same
  derived reference even fully escalated: that was a bare `TypeError` out of `seal`, the one
  authoring fault in the package that reached a caller as a stack trace rather than a code and a
  path, and `compile` now reports it before `seal` is called.
- The environment-probe port carries two request shapes and two observation shapes, discriminated on
  `kind`. A command request names a logical `executable` and a `subcommandPath` and carries the four
  command channels; a command observation carries `exitCode`, `stdout`, `stderr`, and the files the
  run wrote. AD-35's rule is enforced the same way on both: the adapter maps the logical name to
  something runnable and builds the argument vector, and is never handed one to execute.
  `planPreflight` admits a command interface and plans command legs; the reducer reads a non-zero
  exit as the clean-control anomaly a 4xx is on the other kind.
- The sealed run record records what a command run produced: `Observation` gains `artifacts`, keyed
  by the declared artifact identifier, and `stdout`/`stderr` become tagged values so a nominated
  output channel a harness captured as JSON is descendable at score time rather than resolving
  absent. `callInputs` carries all eight input channels.
- `Observation.principal` records the declared account the harness acted as. A `{ principal }` input
  binding is presence-only by construction, so without it two steps of one operation binding `owner`
  and `other-user` both matched every observation and both resolved `several`, which left the two
  critical-severity cross-user behaviours expressible and unscoreable.
- A defect signature may name a command operation. `DefectSignature` is a union of the shape that
  declares a method and a path template and one that declares an invocation, and qualification
  admits a `cli` signature on the same terms it admits an `api` one.
- Two command contracts ship in `corpus/dev/`, one describing its output on standard output and one
  through a file it writes. The corpus is twenty-one contracts now, eighteen of which compile.

### Changed

- **BREAKING** The eval contract's `schemaVersion` is 4. `permittedInterfaces` is a union rather
  than a single shape, `interactionPlan[].inputBinding` is a union of the transport and command
  spellings, and a sensitivity witness leg's `inputs` is a union of the same two. Every version-3
  contract parses on the api branch with no edit other than its stamp. The published
  `eval-contract` schema names `Operation` as a shared definition, so a consumer that read the
  operation shape inline now follows one `$ref`.
- `unsupported-interface-kind` fires on two kinds rather than three. AD-10 closes a kind until its
  probe semantics are declared, and a command's are; `web` and `mcp` are unchanged.
- A witness leg's standard input is a three-arm tagged value, `json`, `text`, or `absent`, matching
  the observed body rather than the request body. Standard input is a byte stream, so a command
  that reads a prompt receives text that was never JSON, and routing it through the `json` arm as a
  JSON string would make the leg claim a serialisation the command never sees. A leg supplying text
  is exempt from that channel's key comparison, because nothing on the leg says which of the
  channel's declared keys the text fills.
- The interaction pointer's `call-inputs` segment accepts four more channel names, which widens the
  pattern the `probe` and `rubric` schemas embed. Both documents move; no field is retyped and
  every existing document still parses, so neither artifact's `schemaVersion` changes.
- `undeclared-mandatory-input` now says what an operation with no exemption to claim can do when its
  output is insensitive to its declared inputs by design. AD-10's relation is the author's to choose
  and need not assert the two legs differ, so such an operation declares a witness whose relation
  says so and gets the weaker guarantee that follows.
- A witness leg supplying a channel as opaque text fills the one key that channel declares. A
  `KeyedShapeDescriptor` can say what keys a channel carries and cannot say "one opaque stream", so
  a command that reads a prompt is declared by naming the one thing the stream carries. A channel
  declaring no required key, or more than one, has nothing for the text to be or no way to say which
  it fills, and both are `undeclared-mandatory-input` rather than a comparison that abstains.
- **BREAKING** The sealed run record's `schemaVersion` is 4 and the probe's is 3. The record retypes
  `stdout`, `stderr`, and `callInputs` and adds `artifacts` and `principal`; the probe retypes its
  defect signature and widens the signature selector's input binding.
- `seal` calls a command a command. Every operation rendered to an evaluator as "the *n* endpoint",
  which told the evaluator something false about what it was reading, and the noun follows the kind
  now. The brief's own shape is unchanged and takes no bump.
- Two hand-maintained channel sets in qualification are derived from the channel vocabulary rather
  than transcribed. They were `ReadonlySet<string>`, so adding a channel to the enum did not fail
  the typecheck there and the new channel would have answered "no" to both questions silently.
- `IsolationManifest.violation` and its three observed-value arrays reject an empty string. An empty
  violation invalidated a run while naming nothing, and an empty observed value rendered a basis
  line with nothing after its colon.
- `atOrAboveFloor` looks up both operands before comparing them. `indexOf` answers `-1` for a value
  the severity ladder does not name, and `-1 >= -1` read as "at or above the floor" for two values
  on no ladder at all.
- The strength vector counts probe identifiers rather than entries. Nothing below it enforces one
  entry per identifier, and a repeated one counted its trial-set result twice on both sides of one
  ratio, which left the rate right and the raw counts wrong.
- A rubric criterion scored twice in one record is a `duplicate-record-identifier` condition under a
  fourth subject, `judge-result`. That is AD-17's record-decidable half; the other half, that a
  scored criterion is one the cited rubric declares, needs the rubric artifact, which no stage row
  names as an input, and is the caller's on the terms AD-12 already states for the remediation cap.

### Comparability

- **Every score computed under 0.2.0 is incomparable with every score computed after this release,
  including scores of contracts that speak HTTP and never touch a command.** AD-11 computes the
  scoring version from a domain-separated object whose first named field is the contract schema
  version, and that field moves from 3 to 4 for every contract in the tree. A run scored before and
  a run scored after therefore carry different scoring versions by construction, and AD-12's rule
  that a sealed set is immutable for its scoring version means the earlier results are not
  invalidated: they remain true of the version they were computed under, and no comparison spans
  the two. Rotate the corpus rather than re-scoring against the old version.
- The comparability key is unaffected in shape. It is the scoring policy digest plus the corpus
  digest restricted to the probes both results cover, and neither moved for a reason of this
  release's own; the corpus digest moves because the corpus gained two contracts, which narrows a
  comparison to the intersection and records the excluded probes, exactly as AD-7 intends.
- Eleven of the twelve interchange artifacts carry a `schemaVersion` and three of them moved: the
  eval contract 3 to 4, the sealed run record 3 to 4, and the probe 2 to 3.
- **Nothing rejects a stale `schemaVersion`, and the consequence is worse than a parse failure would
  be.** AD-11 says a reader accepts an equal version only and throws `schema-version-mismatch`
  outside it. No shipped stage does. `schemaVersion` is a plain `z.int()`, the one reader that
  compares versions is `validateLineageChain`, and no caller passes it an `acceptedSchemaVersion`.
  So a version-3 contract whose shape is still legal parses, compiles clean under `--strict`, and
  reaches `emit`, where its stale `3` goes straight into the scoring version as
  `contractSchemaVersion`. The score that comes back is well-formed, carries a scoring version
  nothing else will ever equal, and gives no sign anything is wrong. **Check the stamp yourself
  before scoring against this release; the package will not check it for you.** Closing that is a
  change to what every stage accepts and is not made here.
- AD-5's registry grew from twenty-three codes to twenty-five and `unsupported-interface-kind`
  narrowed from three firing conditions to two. A caller matching on the registry's length or on
  that code's exhaustive set of kinds needs both.
- The published `eval-contract` schema names `Operation` as a shared definition, so a non-TypeScript
  consumer that read the operation shape inline now follows one `$ref`.

### Fixed

- `set-membership` against a declared reference set now answers. A `{ referenceSet }` operand in
  the set position resolved to the declared members themselves, and members are objects, so the
  operator compared a whole object against the scalar the value operand resolved to and answered
  `false` for every correct system. The negated spelling, which is how "none of these appear" is
  written, answered `true` for every system forever. The operand now resolves to the set's single
  declared key, which is the behaviour `ReferenceSetDeclaration` has always documented, so
  `for-all(rows, set-membership({ pointer: "@/id" }, { referenceSet: "..." }))` reconciles a page
  against a declared set as AD-20 rule 6 intends. Compilation now reports
  `malformed-operator-expression` when a reference set used in that position declares more than one
  key or carries a member missing the declared key: both were previously accepted and cannot be
  projected. The grammar is unchanged, so no `schemaVersion` moved and no published schema
  changed. A contract relying on the old always-`false` answer will start reporting real results.
- Compilation now reports `malformed-operator-expression` when a `covers-by-key` reference set
  carries a member missing `expectedKey`. That member made the operator answer `false` for the
  whole collection, which reads as a detected defect in the system under test, and the compiler
  walked past exactly that shape.
- `containment`'s documentation now states that a `{ referenceSet }` candidate matches whole
  declared members, so a container element carrying any field the set does not declare never
  matches, and points to `covers-by-key` or the projected `set-membership` for reconciling rows
  against a declared set. Behaviour is unchanged.

### Changed

- A failed schema parse now prints the issues it already carried. `compile`, `seal`, `preflight`,
  and `score` all raise `schema-parse-failure` with the Zod error attached as the fault's `cause`,
  and the renderer discarded it, so the whole message an author outside this repository got was
  `schema-parse-failure: EvalContract: input does not conform to the EvalContract schema`. It now
  prints one indented `<location>: <message>` line per issue under that first line, located by an
  RFC 6901 pointer over the failing value, sorted so two runs over the same input print the same
  bytes, and capped at twenty issues followed by a count of the rest. The first line is unchanged,
  so anything matching on it still matches.
- `publish.yml` pushes the release commit with a GitHub App token instead of the job's own
  `GITHUB_TOKEN`. A `GITHUB_TOKEN` cannot be granted a ruleset bypass and an App can, and
  `protect-main` carries a `code_coverage` rule that refuses direct pushes to `main` with
  `GH013 ... Code coverage checks require merging via API or UI`. Publish run 34245836441 hit that
  and stopped with `0.3.0` committed inside the runner and nothing pushed. The token is minted from
  `RELEASE_APP_ID` and `RELEASE_APP_PRIVATE_KEY` only for a run that actually bumps, so a
  `bump=none` publish still runs on `GITHUB_TOKEN` alone. It is the same mechanism, and the same
  App, that releases `bmad-method-test-architecture-enterprise`. npm authentication is untouched:
  trusted publishing over OIDC, no npm token anywhere.

## [0.2.0] - 2026-09-04

### Added

- The `ingest` stage at `src/core/ingest/`, which turns a caller's sealed run record, isolation
  manifest, and evaluator configuration into validated observations plus every cross-artifact
  condition it detected. It enforces the rules six shipped schema fields and AD-16 name `core/ingest`
  as the enforcement point for. It is reached through the `score` command and `runScore` below, and
  each of its eleven conditions lands on the Invalid rung of both verdict ladders.
- Documentation for the two published subpaths that had none: `eval-quality/adapters` and
  `eval-quality/conformance` are covered by a new "Ports, adapters, and the conformance suite" page.

- Two compile-time failure codes in AD-5's registry, the closed enumeration `compile` reports
  against: `binding-cycle`, for a cycle over a compiled plan's capture edges and `after` edges taken
  together, and `captured-channel-undeclared`, for a captured pointer naming any channel but
  `response-body`. The registry's move from 21 entries to 23 is itself a break for an exhaustive
  match; see **Changed** below.
- **The `score` command, an addition to `0.2.0`'s surface.** `eval-quality score`
  runs `ingest` → `score` → `emit` over a sealed run record and mints an `EvidenceArtifact`. Required
  flags: `--record`, `--contract`, `--probe`, `--preflight-verdict`, `--policy`, `--corpus-digest`.
  Optional: `--isolation-manifest`, `--evaluator-configuration`, `--private-manifest`,
  `--corpus-root`, `--out`, `--strict`. It exits **0, 1, 2, 3, 4, 5,** or **64**: the ladder's own
  0/2/3, `1` when `--strict` promotes a CONCERNS, `4` on a structural failure and `5` on a runtime
  fault (both reachable the same way every other command's catch block reaches them), and `64` on a
  usage error. `runScore` (`RunScoreOptions`/`RunScoreResult`) is exported alongside it from
  `eval-quality`'s library surface.

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
  registry, AD-28's runtime faults, stays at its ten codes, and the three commands, their flags, and
  the exit-code table published in `0.1.0` are untouched; `score` is an addition beside them. Those
  are the remaining members of AD-11's caller-facing surface.

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

