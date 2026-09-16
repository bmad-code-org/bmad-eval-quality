# Handover: publish check resolution, and fix the require shorthand

**TEA Story 4.7 cannot close until this ships and a release carries it.** TEA's two call sites that reach the evaluator privately are `test/test-contract-oracles.js:226` and `test/test-contracts.js:113` in the TEA repository (worktree `/Users/murat/opensource/_wt/tea-s46` at handover). Each dynamic-imports `dist/core/evaluate/resolution.js` and `dist/core/evaluate/evidence-resolution.js` through `pathToFileURL`, and TEA's own `dependency-direction` gate flags the reach. Once `eval-quality` exports the four functions and a release carries them, TEA replaces the reach with `require('eval-quality')` and flips the gate to failing.

Branch `feat/publish-check-resolution-and-fix-require-shorthand`, off `origin/main` at `3f12244` (the 3.2.0 release). Story file: `13-3-publish-check-resolution-and-fix-the-require-shorthand.md` beside this one; its Code Map, matrix and design notes are the working record. Sprint status carries `13-3` as `in-progress`.

## Where each item stands

### 1. Export the evaluator. Code and tests done.

`src/application/index.ts` exports `resolveCheck`, `makeResolveOperand`, `makePointerDenotesCollection`, `referenceSetKeysOf` and `ABSENT` as values, with `ResolveOperand`, `PointerDenotesCollection`, `ReferenceSetKeys`, `ResolvedValue` and `PlanIndex` as types. `src/index.ts` adds type-only `Expression`, `Operand`, `CheckResolutionValue`, `Observation` and `JsonValue` on the `core-schemas` edge. The dependency matrix is unchanged: root still takes its two edges, and `npm run check:layers` passes over this repository's own tree.

`tests/architecture/package-exports.test.ts` case 156 holds the four functions and the sentinel on the built barrel, holds `resolveCheck`'s declared signature by the same exactness test `compareDominance` has, and calls it once; case 157 reaches the four through `createRequire`, which is TEA's path.

One consequence to know: the ordering witness moved. Swapping the two nesting layer rows over this repository's own tree now reports 82 violations, four more than the 78 the docs page and `ORDERING_WITNESS_VIOLATIONS` stated, because `src/index.ts` gained four imports from `core/schemas`. Both are updated to 82; `check:doc-counts` holds them equal.

### 2. The require shorthand. Code, fixture and tests done.

`scripts/dependency-direction.ts`, the `RequireKeyword` arm: a `require` preceded by `.` or `?.` is a member call and never a site; one whose parenthesised list is followed by `{` is a method body; one followed by `:` is told apart from a ternary's else by scanning backward at bracket depth zero for a `?`, since a member declaration has none before its own `{`, `,` or `;`. `isMethodDefinition` carries the reasoning.

`scripts/fixtures/consumer/direction-compliant/lib/service/sandbox.ts` is the fixture that fails before the fix: at `3f12244` the compliant fixture reports two violations on it, and after the fix it passes. Unit cases sit in `tests/architecture/dependency-direction.test.ts` under the `forbid` and `check` describes: seven method shapes, two member-call shapes, a condition and both ternary arms still rejected.

### 3. The unstable TypeScript subpath. Decided and implemented; the decision is below.

`scripts/typescript-scanner.ts` is the one loader both gates reach TypeScript through, registered in `tsconfig-gates.json` and the emitted-module list. `probeTypeScript` in `check-dependency-direction.ts` and `loadTokenScanner` in `lineage-ownership.ts` route through it; `TYPESCRIPT_UNAVAILABLE` is declared there and re-exported from `lineage-ownership.ts` so the binary's exit mapping is unchanged. `tests/architecture/typescript-scanner.test.ts` covers the three refusals, the rethrow, and holds `REQUIRED_SYNTAX_KINDS` equal to the members the three scanner sources read.

## The decision on item 3, and why

**Facts established by reading the installed packages.** `typescript/unstable/ast` exists in TypeScript 7 only: the 7.0.2 export map carries it and the 5.9 export map does not. The 7.x main entry exports nothing usable, two keys, so there is no stable path to the scanner. The optional peer range is `>=5.7.0`. So a consumer on TypeScript 5 who runs either gate today gets `ERR_PACKAGE_PATH_NOT_EXPORTED` rethrown as a raw stack, because both probes handled `ERR_MODULE_NOT_FOUND` alone. The range promised something the gates could never do.

**The two options as posed.** Pin the optional peer to `>=7.0.0 <8`, or guard the import behind a shape check that refuses clearly.

**Landed on the guard, and left the peer range as it is.** The reasoning:

- The honest range is `>=7.0.0 <8`, and writing it breaks `npm install` for the wrong people. npm skips an optional peer that is absent and still resolves one that is present, so a consumer with TypeScript 5 in its tree and no interest in the two scanner gates would hit `ERESOLVE` on install. For a package whose purpose is holding supply chains steady, that is the wrong failure in the wrong place. The same applies to an upper bound when TypeScript 8 arrives.
- The version fact belongs at the one moment it matters, which is when a consumer runs one of the two gates. The loader names the installed version, read from `typescript/package.json`, and the version the scanner ships from, and tells the consumer to install 7 or drop the section.
- A pin alone would still leave the quiet failure open. The subpath's own name says it may move, and a moved or renamed `SyntaxKind` member reads as `undefined`; `token.kind === undefined` never matches, so the rule it guarded switches off with every gate green. Only a member list catches that, and the loader refuses when any of the 73 members the scanners read is missing, naming it. A test derives the list from the three sources so it is never a copy a hand maintains.

Three refusals, each with its own repair: the package is absent; the package is a version with no such subpath; the subpath is there and lacks a member. Anything else is rethrown unchanged. The documentation still has to say, where it names the peer, that the two source-scanning gates read the scanner TypeScript 7 ships and that a 5.x install refuses by name.

## What remains

- Docs: `docs/reference/cli-commands.md` barrel list gains an evaluation bullet and a paragraph; `docs/how-to/run-the-gates-on-your-repository.md` peer-dependency paragraphs at the dependency-direction and field-ownership sections say TypeScript 7 and the refusal shapes. `check:doc-claims` may hold the barrel list as a transcribed list; run it.
- `CHANGELOG.md` under `[Unreleased]`: Added for the exports, Fixed for the shorthand, Changed for the loader's refusals. Learning path Step 66 (`epic13-story3`); Step 65 is the last today.
- Story file: check the task boxes, fill Implementation Notes and the Review Triage Log.
- Review: the four subagent layers (blind hunter, edge-case hunter, verification-gap, acceptance auditor) plus one Sonnet reviewer peer, `/low-priority` if it comes back limited, and its transcript read for real tool calls before its reply is trusted.
- `npm run validate` green, then the pull request against `main` with a conventional title and a short body, CodeRabbit worked or absent, then a release, because TEA cannot close 4.7 without one.

State at handover: `npm run build`, `npm run typecheck`, `npm run lint`, `npm run check:layers` and `npx vitest run tests/architecture` (483 cases) are green on `cb85b20`. The full `npm run validate` has not been run on this branch.
