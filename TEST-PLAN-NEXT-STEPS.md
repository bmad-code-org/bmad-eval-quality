# v0 Release Qualification: `eval-quality`

- Author: Murat K Ozcan
- Package: `eval-quality` on npm, owned by the `bmad-code-org` organization

This plan states what must be true before `eval-quality` cuts its first release. Every item is a
check someone can run from a clean clone and read the result of. Work that belongs after the
release is collected in the last two sections.

> [!NOTE]
> **Qualification Execution Status (August 31, 2026):**
> Gates 1 through 8, Section 10 CLI qualification, and Section 11 exit criteria have all been
> executed and verified end to end (100% PASS) on a fresh dependency install. Gate 1's own stderr
> criterion caught a real defect along the way: `biome.json` pinned schema `2.5.8` against an
> installed `2.5.10` CLI, so `npm run lint` wrote a version-mismatch warning to stderr on every run.
> Fixed.
>
> Section 14.1 release mechanics are further along than this section states: GitHub Pages is live,
> the `Release tags` ruleset exists (created 2026-08-28), and `0.1.0` is published to npm. The one
> item still open is the npm Trusted Publisher, which only configures from the npmjs.com web UI by
> a package owner, not from a CLI a coding agent can drive.
>
> v0 qualification is complete. Resume next work from **Section 14.1's Trusted Publisher step**
> (manual, npm-owner-only) or **Section 12 (v1 entry criteria)**, which proceeds in the `bmad-tea`
> repository against this released v0.


## 1. The surface v0 qualifies

`package.json` declares the shipped surface. Qualification covers this and stops there.

| Surface | Value |
| --- | --- |
| Package name | `eval-quality` |
| Root entry | `eval-quality` resolves to `dist/index.js` |
| Adapters subpath | `eval-quality/adapters` resolves to `dist/adapters/index.js` |
| Conformance subpath | `eval-quality/conformance` resolves to `dist/testing/index.js` |
| Asset subpaths | `eval-quality/schemas/*`, `eval-quality/corpus/*` |
| Binary | `eval-quality` resolves to `dist/cli/main.js` |
| Commands | `compile`, `seal`, `preflight` |
| Published files | `dist`, `schemas`, `corpus`, `README.md`, `LICENSE` |

Scoring is outside v0. `src/cli/render.ts` records in its exit-code table that codes 1 and 2 report
a scored verdict, that scoring ships in a later release, and that no command in this binary reaches
either code yet. A v0 qualification run should therefore see only 0, 3, 4, 5, or 64.

## 2. Gate 1: the full validation chain

```bash
npm run validate
```

One command chains every static and dynamic check the repository owns: `typecheck`, `lint`,
`check:docs`, `check:shareable`, `lint:spine`, `check:vectors`, `check:schemas`,
`check:doc-invocations`, `check:ad5-registry`, `check:ad28-registry`, `check:ad31-table`, `check:ad33-table`,
`check:layers`, `check:lineage`, `check:boundary`, `check:corpus`, `check:website-deps`,
`test:coverage`.

Pass criterion: exit code 0 with no output on stderr from any link in the chain.

This is the gate a release blocks on. Gates 2 through 6 below are the same checks run individually,
listed separately because each one carries a v0 claim worth reading on its own. Gates 7 and 8 are
not in the chain: Gate 7 needs a build first, and Gate 8 needs code that does not exist yet.

`check:doc-invocations` deserves a sentence of its own, because it exists for a defect that already
happened. The documentation described a product this repository does not contain: a command that was
never implemented, flags no parser accepts, and a scoring stage that has not been written. The check
extracts every fenced `eval-quality ...` invocation from `README.md` and `docs/**`, runs each one
against the built binary in a temporary directory, and fails on exit 64 or on a Node stack. Exit 64
is the CLI's usage error, so a documented flag that does not exist fails the build. It skips with a
clear message when `dist/cli/main.js` is absent.

## 3. Gate 2: tests and coverage

```bash
npm run test:coverage
```

Runs the whole `tests/**/*.test.ts` suite under vitest with the v8 coverage provider.

Pass criteria:

- Every test file passes.
- Coverage over `src/core/**` holds at or above 90 percent statements and 90 percent branches.
  `vitest.config.ts` sets those thresholds and scopes them to `core/` alone, so a thick adapter
  cannot mask a thin core.

## 4. Gate 3: the published conformance suite

```bash
npm run test:conformance
```

Runs `vitest run tests/adapters tests/testing`: the four conformance runners published on the
`eval-quality/conformance` subpath, exercised against the adapters this package ships.

`src/testing/index.ts` exports four runners.

| Runner | Signature | Outcomes |
| --- | --- | --- |
| `runCorpusPortConformance` | `(subject: PortSubject<CorpusResolveRequest>) => Promise<ConformanceReport>` | 6 |
| `runClockPortConformance` | `(subject: PortSubject<ClockReadRequest>) => Promise<ConformanceReport>` | 6 |
| `runFileSystemPortConformance` | `(readSubject: PortSubject<FileReadRequest>, writeSubject: PortSubject<FileWriteRequest>) => Promise<ConformanceReport>` | 12 |
| `runEnvironmentProbePortConformance` | `(subject: ProbeSubject) => Promise<ConformanceReport>` | 19 |

Total: 43 outcomes. The numbers come from `CONFORMANCE_OUTCOME_COUNTS` in
`src/testing/conformance.ts`, and the source agrees with them: the shared assertion set emits six
outcomes per port method, so corpus and clock take 6 each, file-system runs the set over `readFile`
and `writeFile` for 12, and the probe runner adds 13 policy outcomes to its shared 6 for 19.
`reportOf` marks a report passed only when `outcomes.length` equals the declared count for that
port, so a runner that silently skips an assertion produces a failed report.

Pass criteria:

- The suite is green. The measured baseline on `feat/epic6-story5` is 5 files, 53 tests, all
  passing.
- The three shipped adapters pass their port's runner: `createLocalCorpusAdapter`
  (`src/adapters/local-corpus-adapter.ts`), `createSystemClockAdapter`
  (`src/adapters/system-clock-adapter.ts`), and `createNodeFileSystemAdapter`
  (`src/adapters/node-file-system-adapter.ts`).
- `runEnvironmentProbePortConformance` passes against the in-repository probe subject in
  `tests/adapters/probe-subject.ts`, driven over a loopback fixture server by
  `tests/adapters/probe-subject.test.ts`. No `EnvironmentProbePort` adapter ships in
  `src/adapters/` for v0; the port and its conformance runner ship, and an adapter author supplies
  the implementation.

## 5. Gate 4: package boundary

```bash
npm run check:boundary
```

Scans `src/`, `schemas/`, `corpus/`, and three published `package.json` fields for vocabulary that
must not cross the package boundary. This is the check that keeps the shipped artifact free of
host-project terms.

Pass criterion: 0 violations, with the scanned-entry count printed.

## 6. Gate 5: corpus integrity

```bash
npm run check:corpus
```

Verifies `corpus/dev/` byte for byte against the AD-27 digests recorded in `corpus/dev/index.json`.
The corpus is generated by `npm run generate:dev-corpus`, and a hand edit to any file under
`corpus/dev/` fails this gate.

Pass criteria:

- Every entry in `corpus/dev/index.json` matches the bytes on disk.
- The 19 contracts under `corpus/dev/contracts/` and the compile-seal pair under
  `corpus/dev/compile-seal-example/` are all present.

## 7. Gate 6: packaging

```bash
npm pack --dry-run
```

`prepack` runs `npm run clean && npm run build`, so this gate rebuilds `dist/` from
`tsconfig-build.json` before listing the tarball.

Pass criteria:

- The build succeeds and the tarball contains `dist`, `schemas`, `corpus`, `README.md`, and
  `LICENSE`, matching the `files` array.
- Every path named in `exports` exists inside the tarball, `dist/testing/index.js` included.
- `dist/cli/main.js` is present, since `bin` points at it.
- `tests/`, `scripts/`, `_bmad-output/`, and `website/` are absent.

Publishing itself runs `prepublishOnly`, which calls `scripts/assert-publish-authorized.mjs`.
Releasing is two steps: `npm run release:prepare -- patch|minor|major` opens the version-bump pull
request so the bump lands on `main` through the normal gate, and `npm run release:publish` then
dispatches `.github/workflows/publish.yml` from `main`. The workflow refuses to run twice for one
version and skips any step whose effect already exists, so a re-run after a partial failure is safe.
`CONTRIBUTING.md` carries the first-publish bootstrap, which matters here because `eval-quality` has
never been published and npm's Trusted Publisher form only appears for a package that exists.

## 8. Gate 7: the installed tarball

```bash
npm run build && npx vitest run tests/cli/main.test.ts
```

Every gate above this one runs from a clone. Gate 6 lists what a tarball would contain and never
installs one, so nothing above proves that an adopter's install works. The block titled "the packed
and installed tarball" in `tests/cli/main.test.ts` does. It packs with `--ignore-scripts` and
`--pack-destination`, writes a scratch consumer whose lockfile carries `zod`'s resolved URL and
integrity copied from this repository's own lockfile, installs with `--offline`, and runs
`node_modules/.bin/eval-quality`.

What it proves, and nothing else in the suite proves any of it:

- The `bin` mapping resolves and npm's shim executes.
- The executable bit is set. `tsc` writes `dist/cli/main.js` unexecutable and the install is what
  fixes it, so the case asserts mode `0` on the built file and non-zero on the installed one.
- The install performs no network I/O. `--offline` is the NFR7 assertion, and the hand-written
  consumer lockfile is what lets it hold: without the resolved `zod` entry, npm reads a packument,
  `npm ci` caches tarballs and never packuments, and `--offline` fails on a clean machine with
  `ENOTCACHED`.
- `corpus/` reached the tarball. The case reads a contract out of the install, so a corpus missing
  from the tarball fails it.

Pass criteria:

- The installed shim prints the version, exits 0, and writes nothing to stderr.
- `--help` from the installed binary contains the exit-code table compiled from `src/cli/render.ts`,
  which is what pins the install to the tree the test ran against.
- The installed binary exits 4 on a structural failure.

The block skips with a clear message when `dist/` is absent, so `npm run build` comes first. Running
`npm run test` without a build leaves this gate unexercised and green, which is why it is called out
here as its own step.

## 9. Gate 8: an outside adapter against the published conformance suite

> **Status:** VERIFIED PASS (2026-08-28 — Implemented and passing via `tests/conformance/outside-clock-adapter.test.ts`)
>
> **Finding closed (2026-08-31):** the gate passed in 2026-08-28 by hand-rolling the AD-28 fault
> codes as string literals, because `src/testing/index.ts` did not re-export `RUNTIME_FAULT_CODES`
> or `RuntimeFaultCode`, only the internal conformance runner imported them from `src/core/schemas/`.
> That is exactly the finding this gate exists to surface: the published suite was not fully
> self-sufficient. Fixed by exporting both from the `eval-quality/conformance` subpath;
> `outside-clock-adapter.test.ts` now types its fault codes against the published
> `RuntimeFaultCode` instead of a bare string, still importing from nothing but that subpath.

AD-37's claim is that the published conformance suite is sufficient documentation for an outside
implementer. Nothing in this repository tests that claim, because every port implementation here is
ours and every one of them was written by someone who could read `src/ports/` and the tests. An
adapter author outside this repository has `eval-quality/conformance` and the README, and no way to
know whether that is enough.

The gate: one minimal adapter written outside `src/adapters/`, importing from
`eval-quality/conformance` and from nothing else in this package, passing its port's runner with no
change to the suite.

`ClockPort` is the cheapest subject. Its runner reports 6 outcomes, the smallest of the four, and a
clock adapter has no I/O to arrange. The suite already ships at the `eval-quality/conformance`
subpath, so the adapter is the only missing piece.

Pass criteria:

- The adapter lives outside `src/adapters/` and imports only `eval-quality/conformance`.
- `runClockPortConformance` reports all 6 outcomes satisfied.
- No change to `src/testing/**` was needed to make it pass. A change there is the finding: it means
  the published suite was not sufficient, which is the thing AD-37 asserts.

Whether this lands before or after the first publish is Murat's call. Before publish it qualifies
AD-37's claim ahead of anyone relying on it. After publish it can be written against the real
registry package, which is a stronger test of the same claim.

## 10. CLI qualification against committed inputs

> **Status:** VERIFIED PASS (2026-08-28 — Invocations for `compile` and `seal` verified against committed corpus files)

The binary must work on the files this package publishes. Both commands below read inputs that ship
in the tarball, so an adopter can reproduce them without cloning.

```bash
npm run build

# Compile a contract the compiler admits.
node dist/cli/main.js compile --in corpus/dev/contracts/satisfied-declarations.json --out ./dist/eval-out

# Compile and seal the same contract through the published example.
node dist/cli/main.js seal --in corpus/dev/compile-seal-example/contract.json --out ./dist/eval-out
```

Pass criteria:

- `compile` exits 0 and writes `eval-contract.json` under the `--out` directory.
- `seal` exits 0 and writes `sealed-evaluator-brief.json` whose bytes match
  `corpus/dev/compile-seal-example/brief.json`, which is the brief this package's compile-then-seal
  boundary produced from that contract.
- A contract that fails compilation by design, such as
  `corpus/dev/contracts/empty-request-shapes.json`, exits 4 and reports the structural failure code
  `index.json` records for it.

### No preflight example ships in v0

`preflight` requires `--contract`, `--probes`, and `--observations`, and it is the only command that
takes `--run-id`. The repository has no probes document and no observations document a CLI can read:
`corpus/dev/` holds contracts and the compile-seal pair only, and the preflight fixtures at
`tests/preflight/fixtures/observations.ts` and `tests/preflight/fixtures/probe-port.ts` are
TypeScript builders that vitest imports in process. Writing a command line against either would name
a path that does not exist.

So v0 qualifies `preflight` through its test suite: `tests/preflight/plan.test.ts`,
`projection.test.ts`, `reduce.test.ts`, and `witness-evidence.test.ts`, all covered by Gate 2. A
runnable `preflight` example arrives with the corpus entry that publishes probes and observations as
JSON.

## 11. Exit criteria

v0 ships when all of the following hold on a clean clone of the release commit:

1. `npm run validate` exits 0.
2. `npm run test:conformance` is green and the four runners report 43 outcomes in total.
3. `npm run check:boundary` reports 0 violations.
4. `npm run check:corpus` reports no digest drift.
5. `npm pack --dry-run` produces a tarball whose contents satisfy every `exports` and `bin` path.
6. `npm run build` then `npx vitest run tests/cli/main.test.ts` is green, so the packed tarball
   installs offline and `node_modules/.bin/eval-quality` runs.
7. The `compile` and `seal` invocations in section 10 succeed against committed corpus files.
8. `npm run check:doc-invocations` reports 0 usage errors, so every documented invocation in
   `README.md` and `docs/**` runs against the built binary.
9. `README.md` names the package as `eval-quality` and documents `compile`, `seal`, and `preflight`.

Criterion 8 mechanizes the runnable half of what used to be one criterion. The other half is a human
read and is listed separately here because it cannot be automated: **someone reads `README.md` and
`docs/**` end to end and confirms they claim no scoring behavior.** A grep does not settle it. The
defect this catches is prose that describes a working scorer in sentences that name no command.

## 12. Entry criterion for v1: the first eval-contract authored elsewhere

The first `eval-contract` written for `bmad-tea` is the first time anyone authors one against the
published schema without this repository's fixtures at hand. Every contract that exists today was
written by someone who could open `tests/`, read a passing fixture, and copy its shape. An author
outside this repository has `schemas/eval-contract.schema.json`, the compiler's failure codes, and
the corpus. The authoring discipline is the product, and this is the first test of it.

Pass condition: one `eval-contract` document authored in the `bmad-tea` repository, against the
published `eval-quality/schemas/*` subpath, compiling clean under `eval-quality compile` with no
change to this package. A change needed here is the finding, and it names which part of the schema
or which failure code did not carry enough information to author against.

The subject is fragment selection across the test-architecture skills, then the planted-defect
`test-review` suite. That work lives in those repositories and reaches this one only through its
published entry points, so it proceeds against a released v0 with no further changes here.

## 13. After v0

Production-system evaluation is the work after that. An `EnvironmentProbePort` adapter aimed at an MCP server or an
HTTP API would let `preflight` check target reachability, AD-35 target policy compliance, and input
sensitivity against a live service; the conformance runner for that port already ships, so the
adapter is the only missing piece. The full evaluation matrix waits on scoring, which v0 does not
include: a trial reducer, the qualified-probe dimensions `corpus/dev/README.md` records as absent,
and the multi-run stability checks a release-candidate CI tier would need. Until scoring lands, CI
stays at the single tier described above, which is `npm run validate` on every pull request.

## 14. What remains, and what epic 7 turned out to be

Stage one is complete. Compile, seal, and pre-flight ship, along with the published surface section 1
describes, and epics 1 through 6 are that work. What is left splits into three kinds of work that
look alike in a backlog and are not alike at all. The file states them separately because conflating
them is how someone ends up writing epic 7 before the architecture can answer it.

### 14.1 Release mechanics

Operational steps, none of them an epic. Each is a command someone runs once.

> **Status (2026-08-31):** three of four are done. Verified live against the real repo and registry:
> `gh api repos/bmad-code-org/bmad-eval-quality/pages` returns a live Pages site, `gh api
> repos/bmad-code-org/bmad-eval-quality/rulesets` lists both `protect-main` and `Release tags`
> (tag ruleset, created 2026-08-28), and `npm view eval-quality` resolves `0.1.0`. Only the Trusted
> Publisher remains, and it is a one-time step on npmjs.com no CLI can drive.

- ~~GitHub Pages is not enabled.~~ Live at the repo's Pages URL.
- ~~The tag ruleset does not exist.~~ `Release tags` ruleset is active on `refs/tags/v*`.
- ~~The first-publish bootstrap has not been executed.~~ `eval-quality@0.1.0` is published.
- ~~The version to publish has not been chosen.~~ `0.1.0` shipped.
- **The npm Trusted Publisher is still not configured.** `npm view eval-quality` shows the publish
  came from a personal npm user (`muratkeremozcan`) with no provenance attestation, so every release
  still needs a manual OTP and ships without SLSA provenance. Configure it from npmjs.com > Packages
  > `eval-quality` > Settings > Trusted Publisher (organization `bmad-code-org`, repository
  `bmad-eval-quality`, workflow `publish.yml`, no environment), per `CONTRIBUTING.md`.

### 14.2 v0 test work

One item needs code written: **Gate 8, the outside adapter**. Every other gate in this file is a
command that already runs against the tree as it stands. That is the whole of the remaining v0 test
scope.

### 14.3 The score half, blocked by the architecture

`ARCHITECTURE-SPINE.md` closes its "Owed to the reference implementation" preamble with one sentence:
"No epic touches `score` until these close." The seven items there are open defects, which is the
section's own classification of them, and each one is verified. Story 6.4 closed half of item 6, the
stage-signature table; the run-mode half of that item stayed open.

1. **Repeated trials have no reducer**, and no stage signature consumes more than one run record. The
   default three-trial minimum is therefore unreachable, so every scored run is permanently
   below-minimum CONCERNS carrying a non-comparable strength vector.
2. **Observation selection is ambiguous** and the temporal clause is unimplementable. Two conforming
   scorers bind different evidence from one sealed record.
3. **Cross-step resource identity and principal identity are inexpressible.** The two
   critical-severity cross-user behaviours in the real corpus cannot be written down at all.
4. **Mode separation is incomplete.** The same sealed artifact derives CONCERNS or FAIL depending on
   which sentence a reader obeys. Those are two exit codes apart.
5. **Uncited defect findings route nowhere** while being the product's own success metric under
   SM-D4. An evaluator that discovers a genuine uncontemplated defect produces a line in an array and
   exit code zero.
6. **The run-mode source is absent.** Nothing names where a scored run's mode comes from.
7. **The worked example is inconsistent** and must be regenerated from the reference reducer once one
   exists. Hand-filled downstream values are forbidden, so it cannot be patched.

### 14.4 The sequence epic 7 was written from

This is a sequence, and the order carries the argument.

> **Closed 2026-08-31.** Epic 7 is written and lives in
> `_bmad-output/planning-artifacts/epics.md` as ten stories. The three paragraphs below are the
> sequence it was derived from, kept because the order carries the argument and because a reader
> checking the epic against the architecture needs it.

**First, the calibration re-run. Done.** It is a separate owed section from the seven above.
`ARCHITECTURE-SPINE.md:69` records ADR-009's exemption, "under which the calibration spike is the
next unit of work and no review round is." Gate D ran on 2026-07-30 under a pre-registered
three-arm, three-repetition design and closed former calibration items 1 and 4, so the spike is
behind us and the reference implementation is the next unit of work.

**Then the reference implementation the spine prescribes**, quoting it: "implement AD-21, AD-31,
AD-33, and AD-40 as pure reference functions with generated fixtures, run them against the worked
chain plus synthetic records, and let the tables be output rather than promise." The spine records
that four review rounds converged on this independently. It closes items 1, 2, 4, 5, and 7.

**Item 3 is a separate decision, and it is settled in the story rather than in an ADR.** It needs a
grammar extension, a cycle-free captured-value matcher together with test-data bindings. Story 7.3
fixes it by construction and records the decision in its own acceptance criteria, ahead of Story 7.4
because AD-40's pair-defect signatures are unexpressible without it.

The reading that had to be settled before any of this could be written is "across the declared trial
count," which admits three defensible interpretations that disagree on identical data and one of
which is the retry anti-pattern AD-6 spends a paragraph forbidding. Story 7.6 settles it: results
reduce to one per `(probeId, trialIndex)` under a published aggregation, and the pass-if-any reading
is rejected in the code with its rejection fixtured. Epic 7 delivers reference functions and their
generated tables and nothing else; the shipped `score` and `emit` stages and their CLI surface are
epic 8, writable once those tables exist.
