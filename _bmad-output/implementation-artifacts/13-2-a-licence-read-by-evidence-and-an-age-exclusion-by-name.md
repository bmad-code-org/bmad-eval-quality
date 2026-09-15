---
title: 'A licence read by evidence, and an age exclusion by name'
type: 'feature'
created: '2026-09-15'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'af224d5c8ffadeedce7e58d92c56aab919213ecd'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-13-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The first consumer of `eval-quality-gates` 3.1.0 hit two limits it cannot resolve on its side. `zod-to-ts@1.2.0`, transitive through astro 5, ships a tarball whose `package.json` has no licence field, so the lockfile records none; the registry packument says MIT and the repository carries an MIT `LICENSE`. `isAllowed()` returns false on a null licence and `isTolerated()` routes through it, so no allowlist, policy or tolerance can admit the entry. Separately, at a 7-day window `lockfile-age` trips on every release of a package the consumer pins exactly and adopts on release day; npm's own answer is `min-release-age-exclude=<name>` in `.npmrc`, and the gate has no counterpart.

**Approach:** Two settings, each data the consumer declares. The `licences` section gains `undeclared`: a list of entries whose manifest declares no licence, each naming the package prefix, the one identifier it is read as, the evidence for that reading, and a reason. The `lockfile-age` section gains `exclude`: package names, no version literal, exempt from the age window and from the registry fetch, and never from the resolved-URL check. Both are reported on every run that uses them.

## Boundaries & Constraints

**Always:** An undeclared entry with no `undeclared` row still fails, and the failure line says the entry declares no licence. A row whose `readAs` is outside the effective allowlist (the allowlist plus the lockfile's policy `also`) still fails, and the line says the identifier was read by evidence. The run output names an entry admitted this way as read by evidence, with the evidence and the reason printed, and never lists it among `tolerated:`. A row applies only to an entry whose manifest declares no licence; an entry under the same prefix that declares one is held to its declaration. `exclude` takes names the schema holds to npm's package-name charset, so `left-pad@1.3.0` is refused at exit 64. An excluded entry is printed as excluded on every run, passing or failing, and the count line still carries the number scanned. An excluded entry whose `resolved` is not its own registry tarball still fails. This repository's own `eval-quality.config.json` keeps passing unchanged. `docs/`, `CHANGELOG.md` and the learning path move in this diff.

**Never:** No change to the flag path of `audit-lockfile-age.mjs` (`.github/actions/audit-lockfile-age` runs it before `npm ci`). No import from `node_modules` in either `.mjs` gate. No new spine revision and no ADR. No `marker`, `optional` or expression syntax on an `undeclared` row: one identifier, held by the rule every other entry is held by. Tolerances do not stack on a `readAs` identifier.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Undeclared entry, no row | Lock entry with no `license`; section carries no `undeclared` | Violation line `declares no licence`, with dependency path | Exit 1 |
| Undeclared entry, matching row | Same entry; row `prefix` matches, `readAs: "MIT"`, MIT allowlisted | Pass; `read by evidence: name@version as MIT`, then its `evidence:` and `because:` lines; not under `tolerated:` | Exit 0 |
| Row reads as an identifier outside the allowlist | `readAs: "GPL-3.0-only"`, allowlist without it | Violation line naming the identifier as read by evidence | Exit 1 |
| Row prefix matches a declared entry | Entry under the prefix carries `license: "GPL-3.0-only"` | Violation on the declared licence; the row is not consulted | Exit 1 |
| Row names an undeclared lockfile | `lockfiles: ["nope.json"]` | Refusal naming the lockfiles the section declares | Exit 64 |
| Row `readAs` is a version pin or an expression | `readAs: "left-pad@1.3.0"` or `"(MIT OR ISC)"` | Refusal: an SPDX short identifier was expected | Exit 64 |
| Excluded name, young | `exclude: ["fixture-pinned"]`; entry published today | Pass; `excluded: fixture-pinned@x (path)`; count line carries every entry scanned; no fetch for that name | Exit 0 |
| Unexcluded name, young | Same section; another entry published today | Age violation on that entry; the excluded one still printed as excluded | Exit 1 |
| Excluded name, off-registry | `exclude` names it; `resolved` is a mirror URL | Fails closed on the resolved URL | Exit 1 |
| Version literal in `exclude` | `exclude: ["fixture-pinned@4.2.0"]` | Refusal: a package name was expected | Exit 64 |

</frozen-after-approval>

## Code Map

Every citation verified at `af224d5`.

- `scripts/gate-config.ts` -- the published Zod schema. `LicenceTolerance` (line 116) is the shape to sit beside: `reason`, `lockfiles`, `prefix`, `license`. `SpdxIdentifier` (line 74) is the identifier charset; reuse it for `readAs`. `LockfileAgeSection` (line 83) gains `exclude`. The `superRefine` on `LicencesSection` (line 175) already holds every `tolerances[i].lockfiles` value to the declared list; extend it to `undeclared`. `GateConfiguration` (line 220) is what `check-doc-claims.ts` parses the documented example through, so the doc example must carry both new settings.
- `scripts/check-licenses.mjs` -- `licenseStringOf` (line 104) returns null for an absent field; `isAllowed` (line 90) returns false on null; `isTolerated` (line 129) routes through it. The scan loop (line 297) is where an undeclared entry is matched against `options.undeclared` before tolerances, and the read-as identifier is then held by `isAllowed` against the same `allowlist` set. The report shape at line 327 gains `readByEvidence`. The violation object at line 321 gains a `reason` for the undeclared cases so the CLI prints it through its existing `(${violation.reason})` slot.
- `scripts/audit-lockfile-age.mjs` -- `auditLockfileAge` (line 197) takes `exclude` (default `[]`), partitions `entries` into `excludedEntries` after the off-registry split and before `uniqueNames`, and returns `excludedEntries`. The `main()` flag path (line 268) stays as it is.
- `scripts/gates-cli.ts` -- `AgeReport` (line 133) and `LicenceReport` (line 149) state the `.mjs` result shapes; extend both. `runLockfileAge` (line 246) prints the count line at line 273 and `runLicences` (line 340) prints `tolerated:` at line 375. `Tolerance` (line 118) is the pattern for an `Undeclared` row type.
- `scripts/fixtures/consumer/` -- one directory per fixture, each `eval-quality.config.json` plus `package-lock.json`. `compliant/` and `lockfile-age-seeded/` are the shapes to copy. Every entry's `resolved` must be `https://registry.npmjs.org/<name>/-/<basename>-<version>.tgz` or the resolved-URL check fails it first.
- `tests/architecture/published-gates.test.ts` -- `runGates`, `configOf`, `lockfileOf`, `temporaryConfig` (line 90) and `compliantTimeMaps` (line 100) are the helpers. Loader refusals sit under `the gate configuration loader`; module-level cases under `the licences gate` and `the lockfile-age gate`.
- `docs/how-to/run-the-gates-on-your-repository.md` -- the worked configuration (line 34) and the two gate sections (line 150, line 165). One sentence per line.
- `scripts/check-doc-claims.ts` line 1366 parses the worked configuration through `GateConfiguration`; `scripts/check-doc-counts.ts` line 759 onward holds the page's numerals. Neither needs a new entry.
- `CHANGELOG.md` -- `[Unreleased]` is empty; add an `### Added` with one bullet per feature. `_bmad-output/project-knowledge/learning-path-step-by-step.md` -- append Step 64 in the Step 62 shape (line 4443): plain terms, what, why, read order, story link, rules, watch out.
- Do not change: `package.json`, `tsconfig-gates.json`, `.github/`, `scripts/fixtures/age-canary/`, `scripts/fixtures/licence-canary/`, `eval-quality.config.json` at the root.

## Tasks & Acceptance

**Execution:**

- [x] `scripts/gate-config.ts` -- add `UndeclaredLicence` (`reason`, `lockfiles`, `prefix`, `readAs: SpdxIdentifier`, `evidence`, all required, strict) and `LicencesSection.undeclared` (optional array); add `PackageName` (npm's URL-safe name charset, refusing `@` anywhere after a leading scope) and `AgeExclusion` rows (`name`, `reason`, `lockfiles`) under `LockfileAgeSection.exclude`, mirroring `min-release-age-exclude`; hold `undeclared[i].lockfiles` and `exclude[i].lockfiles` to the declared lockfiles.
- [x] `scripts/check-licenses.mjs` -- `options.undeclared`; an entry whose `licenseStringOf` is null or blank consults the first row whose `prefix` matches, holds `readAs` through `isAllowed` against the allowlist set, and on success records `{ entry, readAs, evidence, reason }` in `readByEvidence` (sorted by entry); on failure pushes a violation with `reason` saying the identifier was read by evidence and is outside the allowlist; an undeclared entry with no row pushes a violation with `reason: 'declares no licence'`. Tolerances are not consulted for an undeclared entry.
- [x] `scripts/audit-lockfile-age.mjs` -- `exclude` option; excluded registry entries are neither fetched nor aged; `excludedEntries` in the result; `entries` still carries every scanned entry.
- [x] `scripts/gates-cli.ts` -- pass `section.exclude` and `section.undeclared` (filtered to rows naming this lockfile) through; print `excluded:` lines on every outcome and a count line that carries the scanned total; print `read by evidence:` with `evidence:` and `because:` on a pass, distinct from `tolerated:`; print `license=null` violations through their `reason`.
- [x] `scripts/fixtures/consumer/licences-undeclared-seeded/` and `licences-undeclared-by-evidence/` -- the same lockfile carrying `fixture-unlicensed@1.0.0` with no `license` field; the first configuration carries no `undeclared`, the second reads it as MIT with evidence.
- [x] `scripts/fixtures/consumer/lockfile-age-excluded/` and `lockfile-age-excluded-seeded/` -- the first carries `fixture-pinned@4.2.0` at its registry URL with `exclude: ["fixture-pinned"]`, so the binary passes with no network; the second carries the same name excluded and resolved to a mirror, so the binary fails closed.
- [x] `tests/architecture/published-gates.test.ts` -- one case per matrix row: the four fixture runs through `runGates`, the loader refusals through `temporaryConfig`, the young-unexcluded and declared-under-prefix rows at module level with `readTimeMap`; assert the excluded line, the scanned count, the `read by evidence` line, and the absence of `tolerated:` on the evidence run.
- [x] `docs/how-to/run-the-gates-on-your-repository.md` -- both settings in the worked configuration; a paragraph in each gate section saying what the setting takes, what it does not exempt, and how it prints.
- [x] `CHANGELOG.md` -- two `### Added` bullets under `[Unreleased]`, in the register of the 3.1.0 entries.
- [x] `_bmad-output/project-knowledge/learning-path-step-by-step.md` -- Step 65 (epic13-story2), numbered after the documentation gates' Step 64 once #136 landed first.

**Acceptance Criteria:**

- Given this repository's own configuration, when `npm run check:licences` and `npm run check:lockfile-age` run after `npm run build`, then both pass with the same output as before this change.
- Given the worked configuration on the docs page, when `npm run check:doc-claims` runs, then it parses through `GateConfiguration` with both new settings present.
- Given either feature reverted, when `npm test` runs, then at least one fixture case fails for that feature.

## Implementation Notes

- The implementation subagent wrote every file the task list names and stopped on a usage limit before reporting; the diff was verified against the spec from the staged patch, formatted with Biome, and completed here.
- `readAs` is a backticked identifier on the docs page that nothing under `src/` declares, so `check-doc-claims.ts` gained a `FOREIGN_IDENTIFIERS` entry for it beside `windowDays` and `reportOnly`.
- Revert proof: with `check-licenses.mjs` and `audit-lockfile-age.mjs` at `af224d5` and everything else at this change, 14 cases fail, among them every fixture case for both features.
- `package-lock.json`'s root entry gains the `eval-quality-gates` bin and the `typescript` optional peer that `package.json` declared in 3.1.0; `npm install` wrote the sync and it is kept.
- Empty-string and whitespace-only `license` values are read as undeclared: a field with nothing in it declares nothing.
- Blank-licence handling, the sort order of `readByEvidence`, and the two count-line shapes are the implementation's; the Intent leaves them open and no consumer reads them as a contract.
- After review, `exclude` became rows with `name`, `reason` and `lockfiles`, the shape every other exception in the format has; a bare name list printed an exemption with no why and could not scope to one lockfile. The exclusion is read over every entry, so an excluded entry resolved off the registry prints as excluded and fails on the URL, which is what the Always clause says. A row nothing holds, an exclusion no entry carries or an undeclared row that reaches no undeclared entry, is refused at exit 64 after every lockfile has reported. The undeclared branch is taken on an absent, null or blank field only, so `license: ["MIT"]` fails as declared with the raw field printed. Both kinds of exception print on failing runs.
- The `prefix` rule on an undeclared row is the tolerance's plain string prefix, stated on the docs page and in the schema and pinned by a case, so `zod-to-ts` reaches `zod-to-ts-plugin`; a boundary rule for this row alone would give two settings named `prefix` two meanings.

## Spec Change Log

## Review Triage Log

Four layers ran as subagents on the first diff: blind hunter, edge-case hunter, verification-gap reviewer, acceptance auditor. Sixteen findings: thirteen patched, two decided against with the reason stated, one noted with no change.

The first reviewer peer session, `eq-s22-rev`, ran no review. Its transcript shows both briefs answered with the account's session-limit message and no tool call, after which it went idle and was closed as finished. A second peer, `eq-s22-rev2`, hit the same notice, was sent `/low-priority`, and then ran `bmad-review` with real tool calls, reproducing each finding through the binary. The coordinator read the diff cold in a second session as well. CodeRabbit posted only a rate-limit notice on the pull request, so no bot finding was worked here.

Peer findings, all verified by the peer against fixtures it built:

- high, patched: a stale-row refusal after the loop exited 64 even when the run had found a violation, so a caller branching on the code read a real finding as a configuration error. The gate failure now outranks the refusal, which prints as a diagnostic; the usage code is for a run that would otherwise have passed.
- medium, patched: an undeclared row was credited only after the resolved-URL check, so a tampered entry the row documented produced a false "reaches nothing" refusal beside the real finding. Rows are credited by reach before that check.
- medium, patched: a row naming two lockfiles was cleared as soon as it reached an entry in one, so a scope where it reached nothing was never flagged. Staleness is held per row and lockfile, and the refusal names the lockfile.
- medium, patched: two exclusion rows with one name, or two undeclared rows with one prefix, on one lockfile confused the credit and let a dead sibling hide. The schema refuses the duplicate: one exemption carries one reason, one package is read as one licence.
- low, patched: a blank `license` field printed `license="   " (declares no licence)`; the reason now says the field is blank.
- low, patched: a failure over overlapping rows named only the first reading tried; every distinct reading is named.
- low, patched: no case paired a violation with a stale row; two cases do now, one per gate, plus cases for the tampered documented entry, the per-lockfile scope, the duplicates, and a nested duplicate under an excluded name.
- medium, decided against: scope an exclusion by version or path so a nested duplicate at another version is not exempt. The setting is name-based as npm's own is, every entry under the name is printed with its path, and the docs and schema say so; a version here would be the pin the format refuses.
- prose, patched: the changelog's misplaced modifier, its licences-before-lockfile-age order against every neighbour, `Astro` as the framework's name, a missing comma; the docs page now names the resolved-URL check where it first describes it; the learning-path watch-out no longer restates the rule above it.

- high, patched: a row admitted `license: ["MIT"]`, `[{type}]` and `{url}` because the branch tested the reader's null. Now taken on an absent, null or blank field only; unread shapes fail with the raw field. (blind, edge)
- medium, patched: `exclude` carried no reason and no lockfile scope while every sibling exception carries both. Rows now. (blind)
- medium, patched: a row or an exclusion matching nothing loaded clean and printed nothing. Refused at exit 64 after every lockfile reports. (blind, edge)
- medium, patched: three sentences said every excluded entry prints on every run while an off-registry excluded entry never reached the split. The exclusion is now read over every entry and the seeded case asserts both the `excluded:` line and the failure. (blind, acceptance)
- medium, patched: `read by evidence` printed on failing runs and `tolerated:` did not; neither had a failing-run case. Both print, one case covers both. (blind, verification)
- medium, patched: an undeclared row's `lockfiles` scope had no case over two lockfiles. Case added. (verification)
- low, patched: the blank-string branch had no case; an unread-shape case and a blank case added. (blind, verification)
- low, patched: no scoped or aliased exclusion case and no docs sentence on alias names. Case and sentence added. (blind)
- low, patched: two matching rows with the first outside the allowlist failed on order; the first admitted row now wins, as a tolerance does. (edge)
- low, patched: a non-array `exclude` from a JavaScript caller built a set of characters; guarded with a thrown message. (edge)
- low, patched: `PackageName` refused `~!*'()`, which npm admits, and its JSDoc did not record why uppercase is admitted. Charset widened, JSDoc states it. (edge, acceptance)
- low, patched: the docs example's evidence cited the repository while the tarball itself ships `package/LICENSE`, verified from the 1.2.0 tarball. Example names the tarball's file. (blind)
- low, patched: the fixture name `licences-undeclared-tolerated` blurred the distinction the story draws. Renamed `licences-undeclared-by-evidence`. (acceptance)
- medium, decided against: match `prefix` on a name boundary. The row keeps the tolerance's plain-prefix rule so one word means one thing; the rule is stated in the schema, on the page, and pinned by a case. (blind, edge)
- false: the flag path of `audit-lockfile-age.mjs` lacks `--exclude`. The Never clause keeps that path unchanged; this repository's own CI runs it with no exclusion and a consumer runs the binary. (edge)
- noted, no change: `package-lock.json` and `sprint-status.yaml` were absent from the reviewed patch. Both are in the working tree and the pull request carries them. (blind, acceptance)

## Design Notes

**Why `undeclared` is its own list.** A tolerance adds an identifier to the allowlist for a family that declares one, under a condition the gate can re-read. An undeclared entry declares nothing, so there is no expression to widen; the row supplies the reading and the evidence for it. Folding that into `tolerances` with a discriminator would let `optional` and `marker` sit on a row they mean nothing for.

**Why the read-as identifier is held by the ordinary rule.** `readAs` says what the manifest would have said. Holding it through `isAllowed` against the effective allowlist means a consumer cannot admit GPL by writing it into a row, and a policy `also` still applies. Stacking tolerances on top would make one row's reading depend on another row's condition.

**Why an exclusion exempts the window and never the resolved URL.** `min-release-age-exclude` says a package's young releases are accepted. It says nothing about which tarball the install fetches; a substituted `resolved` under an excluded name is the defect the URL check exists for.

**Output shapes:**

```text
licences package-lock.json: passed against the allowlist, 3 entrie(s), all allowlisted.
  read by evidence: fixture-unlicensed@1.0.0 as MIT
    evidence: the registry packument for fixture-unlicensed@1.0.0 declares MIT
    because: the tarball omits the field
lockfile-age package-lock.json: passed, 3 entrie(s), 2 published before <cutoff> and 1 excluded by name.
  excluded: fixture-pinned@4.2.0 (node_modules/fixture-pinned)
    because: pinned exactly and adopted on release day
```

**Writing style for every line of prose this change lands:** no em dash and no spaced hyphen as a clause connector; no construction whose only job is to reject a half ("not X but Y", "X rather than Y", "X, never Y"); one sentence per line in markdown; code comments lean, saying why once.

## Verification

**Commands:**
- `npm run build && npm run typecheck && npm run lint` -- expected: clean.
- `npx vitest run tests/architecture/published-gates.test.ts` -- expected: every case passes, including the built-binary cases.
- `npm run check:licences && npm run check:lockfile-age` -- expected: this repository's own configuration passes.
- `npm run check:doc-claims && npm run check:doc-counts && npm run check:docs` -- expected: clean.
- `npm run validate` -- expected: green before the pull request opens.
