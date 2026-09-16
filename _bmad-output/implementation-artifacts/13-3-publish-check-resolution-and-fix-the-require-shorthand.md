---
title: 'Publish check resolution, and fix the require shorthand'
type: 'feature'
created: '2026-09-16'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '3f12244cac4405afddbaa91dc710b8c1f2961662'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-13-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** TEA's Story 4.7 ran the published gates against a real consumer and found three things that keep its `dependency-direction` gate from failing honestly. First, `resolveCheck`, `makeResolveOperand`, `makePointerDenotesCollection` and `referenceSetKeysOf` are reachable only by dynamic-importing `dist/core/evaluate/...` through `pathToFileURL`, because the public surface carries none of them; the gate's exemption reaches a static import declaration only, so the consumer's choices are a private reach or a suppressed gate. Second, the gate reads the method shorthand `require(name) {` in an object literal, and a member call such as `sandbox.require('fs')`, as CommonJS require sites; a consumer renaming a mock to dodge a gate is a gate teaching the wrong lesson. Third, the two source-scanning gates read `typescript/unstable/ast`, a subpath whose own name says it may move; it exists in TypeScript 7 only, while the optional peer admits `>=5.7.0`, and a 5.x install fails today with a raw `ERR_PACKAGE_PATH_NOT_EXPORTED` stack.

**Approach:** Export the four evaluator functions and the types their signatures name through the layer barrel `application/index.ts`, the one edge `src/index.ts` may take, so `require('eval-quality')` reaches them. Teach the scanner that a `require` token preceded by a member access, or whose parenthesised list is followed by `{`, is a method and never a call, and pin it with a fixture the compliant tree fails before the fix. Put the `typescript/unstable/ast` import behind one shared loader that refuses by name on an absent package, an absent subpath, or a subpath missing a symbol the gates read, naming the installed version and the versions that carry the scanner; leave the peer range where it is, for the reason recorded in Design Notes.

## Boundaries & Constraints

**Always:** `src/index.ts` keeps its two edges, `root -> application` and `root -> core-schemas`, so the four functions ride the layer barrel and the schema types ride the second edge. No live Zod schema becomes reachable from the barrel. `resolveCheck`'s declared signature is held by an exactness test the way `compareDominance`'s is. A real `require('x')` call, `require?.('x')`, and `import X = require('x')` stay violations under `forbid` and stay edges under `check`. Every `SyntaxKind` member the three scanner modules read is in the loader's required list, and a test derives that list from the sources so it cannot drift. Both gates refuse through the one loader with one sentence shape. `docs/`, `CHANGELOG.md`, the learning path and the story move in this diff.

**Never:** No change to the dependency matrix. No change to `tsconfig-build.json`'s `include` or `rootDir`. No narrowing of the optional peer range. No spine revision and no ADR. No static import of `typescript` from a module the binary loads before the probe.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Consumer requires the barrel | `require('eval-quality')` from CommonJS on Node 22 | `resolveCheck`, `makeResolveOperand`, `makePointerDenotesCollection`, `referenceSetKeysOf` are functions; `ABSENT` is the sentinel | N/A |
| Method shorthand | `{ require(name) { ... } }` under `commonjs: "forbid"` | No violation | N/A |
| Member call | `sandbox.require('fs')`, `mock?.require('fs')` | No violation | N/A |
| Real call | `const fs = require('node:fs')` | Violation under `forbid`; an edge under `check` | Exit 1 |
| Call inside a condition | `if (require('x')) {` | Violation, since the call's own `)` is followed by `)` | Exit 1 |
| typescript absent | Loader rejects with `ERR_MODULE_NOT_FOUND` | Refusal naming the dependency and the gate | Exit 64 |
| typescript 5.x installed | Loader rejects with `ERR_PACKAGE_PATH_NOT_EXPORTED` | Refusal naming the installed version and that the scanner ships from 7.0 | Exit 64 |
| Subpath present, symbol gone | Module lacks `SyntaxKind.RequireKeyword` | Refusal naming the version and the missing name, since a missing member would switch a rule off silently | Exit 64 |
| Unrelated loader failure | Loader throws a plain error | Rethrown unchanged | Stack |

</frozen-after-approval>

## Code Map

Verified at `3f12244`, the 3.2.0 release.

- `src/application/index.ts` -- the layer barrel; re-exports from `core/` land here. Add value exports `resolveCheck` (`core/evaluate/resolution.ts:757`), `makeResolveOperand`, `makePointerDenotesCollection`, `referenceSetKeysOf` (`core/evaluate/evidence-resolution.ts:172,225,202`), `ABSENT` (`core/evaluate/resolved-value.ts:9`), and type exports `ResolveOperand`, `PointerDenotesCollection`, `ReferenceSetKeys`, `ResolvedValue`, `PlanIndex` (`core/seal/plan-index.ts:161`).
- `src/index.ts` -- type-only exports on the `core-schemas` edge for the types those signatures name: `Expression`, `Operand` (`core/schemas/expression.ts`), `CheckResolutionValue` (`core/schemas/evidence-artifact.ts:50`), `Observation` (`core/schemas/sealed-run-record.ts:283`, a Zod schema shares the name, so type-only), `JsonValue` (`core/schemas/primitives.ts:149`).
- `tests/architecture/package-exports.test.ts` -- case 152 refuses a live Zod schema on the barrel; the `compareDominance` case at line 436 is the exactness pattern to copy for `resolveCheck`; add a `createRequire` case for the CommonJS reach.
- `docs/reference/cli-commands.md` line 199 -- the barrel list; add an **Evaluation** bullet and a paragraph.
- `scripts/dependency-direction.ts:734` -- the `RequireKeyword` arm. Before it decides, look back one token for `.` or `?.` and forward past the matching `)` for `{`.
- `scripts/fixtures/consumer/direction-compliant/lib/service/` -- add `sandbox.ts` with the shorthand and the member call; the compliant fixture then fails at `3f12244` and passes after. `tests/architecture/dependency-direction.test.ts:412` is the `forbid` describe for the unit cases.
- `scripts/check-dependency-direction.ts:384` `probeTypeScript` and `scripts/lineage-ownership.ts:58` `importTokenScanner`/`loadTokenScanner` -- the two places the subpath is reached; both handle `ERR_MODULE_NOT_FOUND` only and rethrow everything else. `scripts/token-scan.ts:24` imports it statically and is reached only after a probe.
- `scripts/typescript-scanner.ts` (new) -- the one loader. `tsconfig-gates.json` lists every gate source by name and `tests/architecture/published-gates.test.ts` 'emits every module the binary loads' lists every emitted file; both gain it.
- `typescript/package.json` is exported by the package, so the installed version is read from there with `import(..., { with: { type: 'json' } })`.
- `docs/how-to/run-the-gates-on-your-repository.md:329,510` -- the two peer-dependency paragraphs.

## Tasks & Acceptance

**Execution:**

- [x] `src/application/index.ts`, `src/index.ts` -- the exports above, with a comment on why the sentinel ships.
- [x] `tests/architecture/package-exports.test.ts` -- the four functions and `ABSENT` on the built barrel, the `resolveCheck` exactness test, and a `createRequire` case.
- [x] `scripts/dependency-direction.ts` -- the two look-arounds, with the reason in a comment.
- [x] `scripts/fixtures/consumer/direction-compliant/lib/service/sandbox.ts` and unit cases -- shorthand, member call, and a real call in a condition.
- [x] `scripts/typescript-scanner.ts` -- `loadTypeScriptScanner(gate, load?, readVersion?)`, `REQUIRED_SYNTAX_KINDS`, `TYPESCRIPT_UNAVAILABLE`; `check-dependency-direction.ts` and `lineage-ownership.ts` route through it; `tsconfig-gates.json` and the emitted-module list name it.
- [x] `tests/architecture/published-gates.test.ts` or a new `typescript-scanner.test.ts` -- the four refusal rows, and the required list held equal to the `SyntaxKind.` names in `token-scan.ts`, `dependency-direction.ts` and `lineage-ownership.ts`.
- [x] `docs/reference/cli-commands.md`, `docs/how-to/run-the-gates-on-your-repository.md`, `CHANGELOG.md`, learning path Step 66.

**Acceptance Criteria:**

- Given the compliant direction fixture at `3f12244` with `sandbox.ts` added, when the gate runs, then it fails; given this change, it passes.
- Given `npm run validate`, then it is green, and `npm run check:layers` holds this repository's own tree with the new exports.

## Implementation Notes

- Handed over at `cb85b20` with the code, fixtures and tests in and the docs, changelog, learning path, review layers, validate and pull request remaining; `handover-check-resolution-and-require-shorthand.md` beside this file carries the state and the item 3 reasoning.
- The ordering witness moved from 78 to 80: `src/index.ts` gained two new source files' worth of type imports from `core/schemas` (`expression.ts`, `primitives.ts`), and under the swapped rows each newly-imported specifier is an edge root may not take. `ORDERING_WITNESS_VIOLATIONS` and the docs sentence moved together. The handover recorded this as 82; that number was never verified against the running test (confirmed by running the same test on the handover commit before this session's rebase) and the real count is 80.
- The `:` after a `require(...)` list is told apart from a ternary by scanning backward for a `?` at depth zero; a walk forward through the return type was written first and dropped, because an object type literal and a body both open with `{`.
- The loader's required-member list was 73 names at handover; adversarial review during this session found that a `require(...)` used as a `switch` `case` or `default` label produces the same trailing `:` as a return-type annotation, and the backward scan had no check for the `case`/`default` keyword immediately preceding the call, so it read the switch body's own opening `{` as proof of a method definition and let a real `require` call through uncaught. Fixed by returning `false` on `SyntaxKind.CaseKeyword` or `SyntaxKind.DefaultKeyword` at depth zero, which needed two more `SyntaxKind` members.
- A second, more serious gap surfaced by the same review pass: the `{`-follows-close-paren branch returned `true` (method, not a call) unconditionally, with no check at all on what precedes `require`. A real call, `const y = require('x')`, immediately followed by an unrelated block statement with no semicolon between them -- valid, if unusual, JavaScript under ASI -- tokenizes identically to a method body and passed through uncaught. Fixed with `isDeclarationPosition`, a backward scan from `require` that skips recognized member modifiers (`async`, `static`, `get`, `set`, `readonly`, an access modifier, `*`) and then requires the next token to be a real declaration boundary (`{`, `,`, `;`, `case`, `default`, `function`, or start of file); anything else, including `=` or `return`, means a call. This needed six more `SyntaxKind` members (`GetKeyword`, `PrivateKeyword`, `ProtectedKeyword`, `PublicKeyword`, `SetKeyword`, `StaticKeyword`), so the required-member list is 81 names now. One shape is still undecidable this way and is documented as such on `isDeclarationPosition`: a `;` or `}` immediately before `require` is ambiguous between a prior class member and a prior unrelated statement, and telling them apart needs knowing what kind of block `require` sits in, which a flat token stream does not carry. Regression tests: `tests/architecture/dependency-direction.test.ts`, "a require() call followed by an unrelated block is still rejected", plus two added shapes ("no return type" function declaration and a comma-preceded object member) in "a method shorthand named require is not a require site".
- `probeTypeScript` (`check-dependency-direction.ts`) and `loadTokenScanner` (`lineage-ownership.ts`) each still carried their own `ERR_MODULE_NOT_FOUND` refusal branch from before the shared-loader refactor; both are unreachable through their real default composition, since `loadTypeScriptScanner` already recodes that error as `TYPESCRIPT_UNAVAILABLE` before either site's own catch runs, and the existing tests for them only exercised the dead branch by injecting a raw resolver error that bypasses the shared loader. Removed both dead branches (`probeTypeScript` now checks only `TYPESCRIPT_UNAVAILABLE` via the shared `isCode` helper and rethrows anything else; `loadTokenScanner` is a thin `return load()`), and rewrote both tests to inject the shape `loadTypeScriptScanner` actually produces.
- `readVersion()`'s two call sites in `typescript-scanner.ts` now guard with `.catch(() => null)`: an injected `readVersion` that rejects previously replaced the intended named refusal with an unrelated unhandled rejection.

## Spec Change Log

## Review Triage Log

Layers run: blind hunter, edge-case hunter, verification-gap, acceptance auditor (both as standalone forked subagents and again as `/bmad-code-review`'s own four layers, eight passes total), `/bmad-testarch-test-review` against the changed test files, and one Sonnet peer session (`eq-checkres-rev`) running `/bmad-review` adversarially, read-only. Every layer converged independently on the two correctness findings below within the first few minutes of each other, which is the strongest signal in this pass that both were real rather than a single reviewer's artifact.

**Fixed:**

- Real `require()` call used as a `switch` `case`/`default` label bypassed `commonjs: "forbid"` and was dropped as an edge under `check`. Found by every layer. Fixed in `scripts/dependency-direction.ts`'s `isMethodDefinition`; see Implementation Notes.
- Real `require()` call immediately followed by an unrelated block statement (no semicolon, ASI) bypassed the same way. Found by the peer session with a runnable repro; independently corroborated by two `/bmad-code-review` layers reading the same live fix mid-session. This is the more serious of the two: unlike the `case`/`default` shape, no operator or keyword is needed, only the absence of a semicolon before a following block. Fixed with `isDeclarationPosition`; see Implementation Notes. One shape (`;`/`}` immediately before `require`) stays undecidable by a token scanner and is documented as a known limitation rather than fixed.
- `probeTypeScript` and `loadTokenScanner` each carried a dead `ERR_MODULE_NOT_FOUND` branch left over from before the shared-loader refactor, tested only by a double that bypassed the loader. Found by five of the eight code-review passes plus the peer session. Removed both; tests rewritten to inject the shape the loader actually produces.
- `docs/reference/cli-commands.md`'s new `resolveCheck` paragraph omitted `regexMatchStepBudget`, `artifactPath`, `makePointerDenotesCollection`'s `providedIndex` parameter, and `resolveCheck`'s throw behavior on a misbehaving caller-supplied resolver. Found by the blind hunter. Paragraph rewritten to name the full signature and the throw contract.
- `readVersion()` calls in `typescript-scanner.ts` were unguarded; an injected `readVersion` that rejects replaced the named refusal with an unrelated unhandled rejection. Found by the edge-case hunter. Guarded with `.catch(() => null)`; `probeTypeScript`'s own error-shape check now reuses the shared `isCode` helper instead of an unguarded cast.
- `src/index.ts`'s type-only-export comment named `Observation` and `Expression` as colliding with same-named Zod schemas but not `JsonValue`, which has the identical collision. Found by the peer session. Comment corrected.
- The backward-scan doc comment for the `:` branch said the boundary was `{`, `,` or `;` but the code also treats an enclosing `(`/`[`/`{` at depth zero as an equivalent boundary. Found by the peer session, flagged as unproven rather than a demonstrated bug. Comment corrected to name both cases; behavior unchanged.
- `handover-check-resolution-and-require-shorthand.md` still stated the ordering witness as 82 after the story file's own Implementation Notes had already corrected it to 80. Found by the blind hunter. Corrected with a note pointing to the authoritative figure.
- `CHANGELOG.md`'s "Fixed" entry didn't mention the `switch`/`case`/`default` shape. Found by the peer session. Entry extended.

**Answered, not changed (reason stated):**

- `TYPESCRIPT_PEER_MISSING` is returned as the single usage code for all three of the loader's refusal reasons (absent, wrong version, missing member), even though only the first is actually "missing." This is by design: the frozen I/O & Edge-Case Matrix maps all three refusal rows to the same exit `64`, with the message text carrying the distinction, not the exit code. Renaming or splitting the exported code this late would be a breaking change to a public constant for a naming nitpick against an intentional design; declined.
- `scripts/lineage-ownership.ts`'s `ast.SyntaxKind as unknown as Syntax` loses type precision the direct import had before this refactor. Confirmed with the compiler that a single assertion is rejected (`error TS2352: ... neither type sufficiently overlaps`) because `loadTypeScriptScanner` necessarily types `SyntaxKind` as a generic `Readonly<Record<string, number>>` for its own runtime shape check. The double cast is the correct idiom for "a runtime check already proved this," not sloppiness; added a comment explaining why instead of a structural change.
- `loadTypeScriptScanner`'s shape check validates the scanner module's static exports but not the scanner *instance* `createScanner(...)` returns (`scan`, `getTokenText`, and the other methods `token-scan.ts` calls). Real gap, but validating an instance's method surface means calling into the scanner speculatively during a "is this installed correctly" check, and the frozen Boundaries only require every `SyntaxKind` member to be in the required list, not the scanner instance's own API. Left for a future story.
- `tests/architecture/published-gates.test.ts` checks the built artifact exists rather than running the built gates binary end-to-end against a real TypeScript-unavailable scenario. The three refusal shapes are already unit-tested directly at `loadTypeScriptScanner`; no other gate in this repository is independently retested through the built CLI binary either, so this would be a new testing pattern, not a gap in this one. Declined.
- The derived-member-list regex (`/\b(?:SyntaxKind|syntax)\.([A-Za-z]+)/g`) only matches static dot access, so a future `kinds[name]` computed read or a destructured `const { RequireKeyword } = SyntaxKind` would silently escape the "cannot drift" guarantee. Confirmed as a real structural fragility with no current instance triggering it. Left as a follow-up rather than widening the regex under review-pass time pressure, since a wrong widening could itself introduce false matches in the derivation test.

## Design Notes

**Why the peer range stays `>=5.7.0`.** The honest range for the two scanner gates is `>=7.0.0 <8`, and writing it would break `npm install` for every consumer that has TypeScript 5 in its tree and never runs those gates: npm skips an optional peer that is absent and still resolves one that is present, so a present 5.9 against a `>=7` range is an `ERESOLVE`. That is the wrong failure in the wrong place for a package whose purpose is holding supply chains steady. The loader carries the version fact instead: it names the installed version and the range the scanner ships in, at the moment a consumer runs one of the two gates, which is the only moment the fact matters. A future TypeScript 8 that moves the subpath fails the same way, by name, and no consumer's install breaks.

**Why a required-member list.** A renamed enum member reads as `undefined`, and `token.kind === undefined` never matches, so the rule it guarded switches off with every gate green. Refusing on a missing name is the only shape check that catches that, and deriving the list from the sources in a test is what keeps it from being a copy a hand maintains.

**Why look-around and never a rename.** A method named `require` is ordinary JavaScript; a mock of a sandbox's `require` is the common case. The call site the gate exists for is `require(` where `require` is the free identifier and the list is followed by anything except `{`.

**Writing style for every line of prose this change lands:** no em dash and no spaced hyphen as a clause connector; no construction whose only job is to reject a half; one sentence per line in markdown; code comments lean, saying why once.

## Verification

**Commands:**
- `npm run build && npm run typecheck && npm run lint` -- expected: clean.
- `npx vitest run tests/architecture` -- expected: green.
- `node scripts/gates-cli.ts dependency-direction --config scripts/fixtures/consumer/direction-compliant/eval-quality.config.json` -- expected: exit 0 after the fix.
- `npm run validate` -- expected: green before the pull request opens.
