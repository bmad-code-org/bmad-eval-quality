# v0 Release Qualification: `eval-quality`

- Author: Murat K Ozcan
- Package: `eval-quality` on npm, owned by the `bmad-code-org` organization

This plan states what must be true before `eval-quality` cuts its first release. Every item is a
check someone can run from a clean clone and read the result of. Work that belongs after the
release is collected in the last section.

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
`check:doc-invocations`, `check:ad5-registry`, `check:ad28-registry`, `check:ad31-table`,
`check:layers`, `check:lineage`, `check:boundary`, `check:corpus`, `check:website-deps`,
`test:coverage`.

Pass criterion: exit code 0 with no output on stderr from any link in the chain.

This is the gate a release blocks on. Gates 2 through 6 below are the same checks run individually,
listed separately because each one carries a v0 claim worth reading on its own.

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

## 8. CLI qualification against committed inputs

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

## 9. Exit criteria

v0 ships when all of the following hold on a clean clone of the release commit:

1. `npm run validate` exits 0.
2. `npm run test:conformance` is green and the four runners report 43 outcomes in total.
3. `npm run check:boundary` reports 0 violations.
4. `npm run check:corpus` reports no digest drift.
5. `npm pack --dry-run` produces a tarball whose contents satisfy every `exports` and `bin` path.
6. The `compile` and `seal` invocations in section 8 succeed against committed corpus files.
7. `README.md` names the package as `eval-quality`, documents `compile`, `seal`, and `preflight`,
   and claims no scoring behavior.

## 10. After v0

Harness integration comes first once v0 is out. `eval-quality` compiles behavioral contracts and
checks the evidence a caller hands it. Producing that evidence is the harness's job, and the BMad
test-architecture skills (`bmad-tea`) plus the `BMAD-METHOD` core workflows are the first harnesses
positioned to do it. The work there is defining `eval-contract` documents for existing harnesses,
starting with fragment selection across the test-architecture skills and the planted-defect
`test-review` suite, then rolling forward through trace, NFR, ATDD, and test-design. That work lives
in those repositories and depends on `eval-quality` only through its published entry points, so it
can proceed against a released v0 with no further changes here.

Production-system evaluation follows. An `EnvironmentProbePort` adapter aimed at an MCP server or an
HTTP API would let `preflight` check target reachability, AD-35 target policy compliance, and input
sensitivity against a live service; the conformance runner for that port already ships, so the
adapter is the only missing piece. The full evaluation matrix waits on scoring, which v0 does not
include: a trial reducer, the qualified-probe dimensions `corpus/dev/README.md` records as absent,
and the multi-run stability checks a release-candidate CI tier would need. Until scoring lands, CI
stays at the single tier described above, which is `npm run validate` on every pull request.
