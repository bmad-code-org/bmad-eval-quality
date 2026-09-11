---
title: 'Name the three versions the package stamps, and publish the five it only reads'
type: 'feature'
created: '2026-09-10'
status: 'review'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '4f4836f1790b9a1fe2dffe7cae3118166276df9d'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-12-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Three artifacts are stamped with a bare integer literal in the code that writes them, and five caller-produced artifacts carry the version a caller must write in no value under `src/` at all. A consumer therefore transcribes the number. TEA transcribed it wrong: its table said `sealedRunRecord` was 3 while the reader accepts 6, so it emitted records no stage could read.

**Approach:** Every artifact version this package writes or validates against becomes a named constant declared beside the schema it names, exported from the root barrel as a literal integer. Hold each constant against the parser rather than against a second transcription, wherever the artifact has a predecessor shape to fail on.

## Boundaries & Constraints

**Always:** Each constant lives beside the schema it names in `core/schemas`, which the dependency matrix already permits as a `core -> core-schemas` edge. Each is declared with no type annotation so it keeps its literal type through `dist/index.d.ts`. Every gate this story adds is watched failing before it is accepted. `docs/`, `CHANGELOG.md` and the learning path move in this same diff.

**Never:** No artifact version moves. `schemaVersion` stays a plain `z.int().min(1)` and gains no `const`, `enum` or default, so AD-28's `schema-version-mismatch` stays a named fault rather than an anonymous parse failure; TEA's plan names reversing that decision as out of scope and this story does not reverse it. The dependency matrix is not amended. `schemas/artifact-reference.schema.json` is left alone.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Consumer reads a caller-produced version | `import { SEALED_RUN_RECORD_SCHEMA_VERSION } from 'eval-quality'` | Resolves to `6`, declared as the literal `6` | N/A |
| Writer stamps an artifact | `seal`, `emit`, `preflight` run | Each reads its constant; a search for a bare `schemaVersion: <integer>` under `src/` returns nothing | N/A |
| A shape change forgets the constant | The record shape moves and the constant does not | The fixture built at the constant stops parsing and the case fails | Names the artifact and both versions |
| A bump forgets the predecessor | The constant moves and no builder case exists for the new N-1 | The case fails | Names the missing predecessor |
| A stale literal is authored anywhere | An authored artifact literal under `src`, `tests` or `scripts` carries an old stamp | The source walk fails naming the file and the stamp | N/A |
| Version-1 artifact | The artifact has never had a predecessor | The parse-behaviour case is vacuous and is recorded as such per artifact | N/A |

</frozen-after-approval>

## Code Map

Every citation below was verified by reading at `4f4836f`.

**The three stamps, and where each constant goes.** Each writing module already imports the schema module its artifact is declared in, so no import is new and no matrix edge is new; `scripts/dependency-direction.ts:79-81` returns true for `core -> core` and `core -> core-schemas`.

- `src/core/seal/seal.ts:98` stamps `2`; the constant goes in `src/core/schemas/sealed-evaluator-brief.ts`; the writer already imports it at `src/core/seal/seal.ts:14`.
- `src/core/emit/emit.ts:110` stamps `3`; constant in `src/core/schemas/evidence-artifact.ts`; import at `src/core/emit/emit.ts:17`.
- `src/core/preflight/reduce.ts:475` stamps `1`; constant in `src/core/schemas/preflight-verdict.ts`; import at `src/core/preflight/reduce.ts:18`.

**The five caller-produced artifacts**, every one validated in `src/application/score.ts` and carrying its version in no value under `src/`:

- sealed-run-record, `:99`, version 6. The number exists in `src/` only as prose in the `.meta()` description at `src/core/schemas/sealed-run-record.ts:426-430`.
- isolation-manifest, `:108`, version 1.
- evaluator-configuration, `:117`, version 1.
- scoring-policy, `:141`, version 2. The 1 to 2 bump is prose at `src/core/schemas/scoring-policy.ts:35`.
- private-artifact-manifest, `:150`, version 1.

Their authored literals live at `tests/schemas/fixtures/artifact-fixtures.ts:156`, `:311`, `:360`, `:969`, `:54`, and in the three generators `scripts/worked-example-target.ts`, `scripts/skill-example-target.ts`, `scripts/workflow-example-target.ts`.

**Why no constant can be derived.** `src/core/schemas/lineage.ts:20-25` declares `schemaVersion` as `z.int().min(1)` and its description states why a `z.literal` is refused: the literal exports as `{"type":"number","const":1}`, losing `integer` for a non-TypeScript consumer, and it would turn a version-2 artifact into an anonymous parse failure instead of AD-28's dedicated fault. Eleven of the twelve published documents declare the field as a bare integer with no `const`, `enum` or default, and `schemas/artifact-reference.schema.json` carries no `schemaVersion` at all, and every `.meta()` call carries only `id` and `description`. So no accepted version is readable from any schema object.

**The model to generalise.** `tests/schemas/eval-contract-version.test.ts` pins one constant, walks emitted corpus and chain bytes at `:96-118`, and source-walks `src`, `tests` and `scripts` at `:126-174` for any `: EvalContract = {` or `} satisfies EvalContract` literal carrying a stale stamp. Two stale items in it: `:60` declares its own `const EVAL_CONTRACT_SCHEMA_VERSION = 5` rather than importing the one Story 12.1 exported, and its docblock at `:22-27` still asserts that no reader declares an expected version constant, which `src/core/compile/compile.ts:102-104` falsifies.

**The gate that will fire on any new version reader.** `scripts/check-doc-claims.ts:537-583` and `:663-669` require every `src/` file performing version equality to be named in `VERSION_READER_BY_FILE` or its exemption, and hold `docs/explanation/what-ships.md`'s "The stages that perform that comparison are …" against exactly that set, with `tokenShape` `/^(?:compile|preflight|score)$/` at `:667`. Also `docs/explanation/what-ships.md:58` reads "The remaining artifacts have no such reader", which this story invalidates.

**The exemption to leave alone.** `carriesLineage` is declared at `src/core/schemas/artifact.ts:28` and is `false` for `artifact-reference` alone at `:73`. Asserted by `tests/schemas/artifact-registry.test.ts:117-123`, `:125-131`, `:133-145` and `:146-157`, and by `tests/schemas/artifacts.test.ts:788-800`.

**Existing gates over a stamp.** Changing `seal.ts`'s `2` to `3` fails `tests/seal/seal.test.ts:85-87`, `npm run check:worked-example` and `npm run check:corpus`. Changing the sealed-run-record version fails nothing, because there is no reader.

**The export idiom and its census.** `src/index.ts:29` and `:39` export the two Story 12.1 constants straight off the `root -> core-schemas` edge, one named export per line beside the artifact's `export type`. All eight new constants live in `core/schemas`, so they take that same form. The census that holds them is `tests/architecture/package-exports.test.ts:335-352`, which asserts both the runtime value and the literal declared type through `dist/index.d.ts`.

Do not change: `src/core/schemas/lineage.ts`, any file under `schemas/` or `corpus/` by hand, `scripts/dependency-direction.ts`, and `schemas/artifact-reference.schema.json`.

## Tasks & Acceptance

**Execution:**

- [x] `src/core/schemas/sealed-evaluator-brief.ts`, `evidence-artifact.ts`, `preflight-verdict.ts` -- declare `SEALED_EVALUATOR_BRIEF_SCHEMA_VERSION = 2`, `EVIDENCE_ARTIFACT_SCHEMA_VERSION = 3`, `PREFLIGHT_VERDICT_SCHEMA_VERSION = 1`, unannotated so each keeps its literal type, each with a docblock in the register `probe.ts:80-90` uses.
- [x] `src/core/seal/seal.ts:98`, `src/core/emit/emit.ts:110`, `src/core/preflight/reduce.ts:475` -- read the constant. Afterwards a search for a bare `schemaVersion: <integer>` assignment under `src/` returns nothing.
- [x] `src/core/schemas/sealed-run-record.ts`, `isolation-manifest.ts`, `evaluator-configuration.ts`, `scoring-policy.ts`, `private-artifact-manifest.ts` -- declare the five caller-produced constants, same shape. The value each takes is the version the current schema shape accepts; read the `.meta()` description and the fixture to confirm it before writing it.
- [x] `src/index.ts` -- export all eight on the `root -> core-schemas` edge, beside the artifact type each names.
- [x] `tests/schemas/artifact-version.test.ts` (new, or generalise `eval-contract-version.test.ts` in place) -- one source walk covering every constant, so an authored literal carrying a stale stamp under `src`, `tests` or `scripts` fails, plus the emitted-bytes walk the existing file performs.
- [x] Parse-behaviour holding, per artifact where a predecessor shape exists -- a fixture built at the constant parses and one built at the constant minus one does not, both built from the constant so a shape change that forgets the constant fails and a bump with no predecessor case fails. `sealed-run-record` is the required one: its predecessor adds `invalidReason` and is one field. Apply it to any other artifact whose predecessor is a single documented field. Where the artifact is at version 1 the question is vacuous and that is recorded per artifact; where a predecessor exists and is impractical to construct, record which artifact and why.
- [x] `tests/schemas/eval-contract-version.test.ts` -- import the exported constant in place of its local copy at `:60`, and correct the docblock at `:22-27`, which asserts no reader declares an expected version constant.
- [x] `scripts/check-doc-claims.ts` and `docs/explanation/what-ships.md` -- move `VERSION_READER_BY_FILE`, the `tokenShape` at `:667` and the transcribed sentence together if this story changes which files perform version equality, and correct `:58`'s "The remaining artifacts have no such reader". Resolved: this story adds no file that performs version equality, so the registry, the pattern and the transcribed sentence all stand unchanged, which `npm run check:doc-claims` confirms. Only `:58` moved.
- [x] `tests/architecture/package-exports.test.ts` -- assert each new name on the built barrel with its literal declared type, in the case at `:335-352`.
- [x] `docs/reference/cli-commands.md` -- list the eight constants in the library-barrel section beside the two already there.
- [x] `CHANGELOG.md` -- an `[Unreleased]` entry saying what a consumer gains.
- [x] `_bmad-output/project-knowledge/learning-path-step-by-step.md` -- Step 61.
- [x] `examples/bmad-tea-contract.json` -- found incidentally: it stamps `schemaVersion: 1` and carries a `metadata` key against a `strictObject`, so it fails `EvalContract.parse` at every version. Nothing references it and `examples/` is not in `package.json`'s `files`. Correct it or delete it, and say which and why.

**Acceptance Criteria:**

- Given a consumer on the published package, when it imports any of the eight constants from `eval-quality`, then each resolves and each is typed as the literal integer.
- Given a shape change that moves an artifact and forgets its constant, when the suite runs, then the parse-behaviour case for that artifact fails.
- Given an authored artifact literal anywhere under `src`, `tests` or `scripts` carrying a stale stamp, when the suite runs, then the source walk fails naming the file.
- Given `schemas/artifact-reference.schema.json`, when this story runs, then it is unchanged and every exemption assertion still passes.
- Given the whole change, when `npm run validate` runs, then it is green.

## Implementation Notes

### Eight constants, and what holds each

`SEALED_EVALUATOR_BRIEF_SCHEMA_VERSION` 2, `EVIDENCE_ARTIFACT_SCHEMA_VERSION` 3 and `PREFLIGHT_VERDICT_SCHEMA_VERSION` 1 are the three the package stamps, each declared beside its schema and read by its writer.
`SEALED_RUN_RECORD_SCHEMA_VERSION` 6, `ISOLATION_MANIFEST_SCHEMA_VERSION` 1, `EVALUATOR_CONFIGURATION_SCHEMA_VERSION` 1, `SCORING_POLICY_SCHEMA_VERSION` 2 and `PRIVATE_ARTIFACT_MANIFEST_SCHEMA_VERSION` 1 are the five a caller assembles and `score` validates.
A search for a bare `schemaVersion: <integer>` assignment under `src/` returns nothing.

`tests/schemas/artifact-version.test.ts` holds all ten constants, the eight here plus the two Story 12.1 exported, two ways and neither is a copy of the number.
The source walk reads every authored artifact literal under `src`, `tests` and `scripts` and holds its stamp against the constant.
The parse-behaviour cases hold six constants against the parser, for the six artifacts with a predecessor shape: sealed-run-record, sealed-evaluator-brief, evidence-artifact, scoring-policy, probe and eval contract.
The four artifacts at version 1 have no predecessor and the method has nothing to say about them, which each constant's own docblock records rather than implying a coverage it does not have.

### The walk found a real stale stamp before any gate was watched failing

`tests/score/score.test.ts` carried a scoring policy stamped `1` while declaring the version-2 shape.
That is the drift this story exists to stop, sitting in the tree, found by the walk on its first run.

### The frozen-literal fix was watched working, in the exact scenario that defeated the first version

A required field added to `SealedRunRecord`, every authored record literal updated the way ordinary work updates them, and the constant left at 6.
Before the literals were frozen this was green.
It now gives `sealed-run-record: the shape built at 6 does not parse, so the schema moved and the constant did not`.

### Three mutations watched failing

A constant moved from 6 to 7 with no shape behind it gives six failures, including `sealed-run-record: the constant reads 7 and no builder case declares that version's shape` and `sealed-run-record: the version-6 shape still parses, so the bump to 7 broke nothing the parser can see`.

The version-6 shape reverted by readmitting `invalidReason`, with the constant left at 6, gives `sealed-run-record: the version-5 shape still parses, so the bump to 6 broke nothing the parser can see`.

A constant exported from the barrel and left out of `VERSION_BY_ARTIFACT_TYPE` gives `expected [ 'RUBRIC_SCHEMA_VERSION' ] to deeply equal []`.
That case exists because the map is hand-written, so a constant added tomorrow and left out of it would be walked by nothing while every other case stayed green.
It derives the expected set from the barrel's own source text, so it needs no build.

A fourth mutation, adding a required key to the record, fails the file at module load, because the committed chain builders parse a record on import.
That is a loud failure with a less specific message, and it is recorded here so the next reader knows which mutation exercises which case.

### `examples/bmad-tea-contract.json` is deleted

It stamped version 1 and carried a `metadata` key against a `strictObject`, so it failed `EvalContract.parse` at every version this package has shipped.
Nothing referenced it and `examples/` is not in `package.json`'s `files`, so it reached no consumer.
Correcting it would have recreated the state that let it rot, since nothing would have parsed it afterwards either, and an example nothing validates drifts again at the next schema move.
Deleting it is the answer that does not need a gate.

### Two instances of this story's own class, one created tonight

`tests/schemas/eval-contract-version.test.ts:60` declared its own `const EVAL_CONTRACT_SCHEMA_VERSION = 5`, hours after Story 12.1 exported exactly that constant from the barrel.
The transcription class this repository is closing reproduced itself inside the file whose job is to catch it.

Its docblock asserted that no reader declares an expected version constant to compare a stamp against, which was true when written and stopped being true when `src/core/compile/compile.ts:102-104` landed.
`docs/explanation/what-ships.md:58`'s "The remaining artifacts have no such reader" is the same shape, and this story invalidates it for five artifacts.

### One incidental in a file this story otherwise does not touch

`src/testing/probe-conformance.ts:6` described the `api` arm as "thirteen assertions" while the published `CONFORMANCE_OUTCOME_COUNTS['environment-probe']` declares 19.
Both numbers are correct: thirteen is AD-35's arm-specific assertions and nineteen is those plus the six shared, which `:444` in the same file spells out.
A consumer comparing the published `.d.ts` against the published constant sees thirteen against nineteen with nothing in view to reconcile them, which is what happened.
The sentence now names which thirteen.
Fixed here rather than left for Story 12.2, because a shipped docblock reading against a shipped constant should not wait for a gate.

### The subagent implementing this story stalled on a permission classifier

It had finished the substantive work and wedged on `npx tsc --noEmit`, which no brief can pre-authorize.
The subagent was stopped, which cancels the prompt, and every verification command was rerun in the owning session.
One typecheck error survived it: the predecessor builder for the evidence artifact destructured `uncitedFindingGaps` off a fixture typed as the union, and that key sits on one branch, so the rest pattern did not compile against the other. It deletes off a copy now, with the reason in a comment.
Two placement defects were also found by reading the diff: the new scoring-policy constant was inserted between the `ScoringPolicy` docblock and its declaration, orphaning it, and the `probe-conformance.ts` comment edit left a line well past the file's width.


## Spec Change Log

Peer review round 1 returned twenty findings. The one that changed the design rather than the text is recorded in Design Notes above: the parse-behaviour builders spread type-annotated fixtures, so the typechecker forced the fixture to move with the schema and the case passed green. Each version's shape is a frozen literal now.

Four other findings widened the story's scope inside its own subject. `Probe` and `EvalContract` were in the constant map and in neither the predecessor list nor the version-1 list, with no structural link to catch the next one; both now have predecessor cases and a case asserts the map's keys equal the union of the two lists. The source walk could not see a `Type.parse({ ... })` literal and one lives in `scripts/worked-example-shared.ts`; that form is walked now. Two hand-transcribed lists of the ten constant names in the published documentation were held by nothing, which is this story's own class landing in its own documentation; `check:doc-claims` holds both against the barrel's source text and `check:doc-counts` holds the numerals beside them. And `src/core/schemas/isolation-manifest.ts`'s docblock claimed the artifact had never moved, which is false and is now Story 12.4.


## Review Triage Log

## Design Notes

**No constant here can be derived from a value, and that is a finding rather than a shortfall.** `lineage.ts` refuses `z.literal` on stated grounds, so the accepted version exists in no schema object, in no published document, and in no `.meta()` field. The number lives in prose and in the reader that compares against it. TEA's plan names reversing that decision as explicitly out of scope, so the constant is declared, and what it is held against is the question this story answers.

**Holding a constant against a second transcription is what fixture 58 does.** `CONFORMANCE_OUTCOME_COUNTS` is compared to a copy of itself in `tests/testing/conformance.test.ts:436`, and two of its six entries drifted from their runners because nothing linked them. A declared constant plus a gate comparing it to another declaration repeats that shape.

**So the constant is held against the parser, and the shape at each version is a frozen literal.** A record built at `SEALED_RUN_RECORD_SCHEMA_VERSION` must parse and one built at `SEALED_RUN_RECORD_SCHEMA_VERSION - 1` must not. Two parse assertions alone would pin the shape boundary and say nothing about its name, because `schemaVersion` is an unvalidated integer and a constant reading 6 against a parser that had moved to 7 would satisfy both. Building the fixtures from the constant is what closes that: a shape change that forgets the constant leaves the fixture the constant names unparseable, and a bump that moves the constant without adding the predecessor's shape leaves the builder with no case for the new N-1.

**Why the shape literals are frozen, which is the whole of what makes this work.** The first version of these builders spread the live fixtures from `artifact-fixtures.ts`, every one of which carries an explicit schema-derived type annotation. `npm run typecheck` runs inside `validate`, so a type-visible shape change forced the fixture to move in the same commit as ordinary mechanical work, and once it moved the version-N case built from the updated fixture and parsed. The method fired only on a runtime-only constraint the typechecker cannot see, such as adding `.min(1)`. It was reported as holding "a shape change that forgets the constant" and held a far narrower class than that.

Each version's shape is now a frozen literal typed `Readonly<Record<string, unknown>>`, declared in the test file and built from the schema text rather than copied from a fixture. Nothing drags it along when the schema moves, which is what makes the case an independent witness. Refactoring these back into a fixture spread as a tidy-up takes the method with it.

**The residual, stated because it is the limit of the method.** A breaking shape change that edits the frozen literal for N to the new shape in the same commit and does not bump N passes everything. At that point nothing outside the change knows what the version ought to be, and no gate that reads only behaviour can. That escape is now a deliberate edit to a literal whose docblock says why it is frozen, which is a different risk class from the drift this story closes; before the literals were frozen the escape was the ordinary path, which is what the first version of this note got wrong. This is the argument a future proposal to pin `schemaVersion` with a `const` will reach for, and it is recorded here so that proposal starts from an understood limit.

**Where a version-1 artifact is concerned the question is vacuous**, since nothing was released before version 1 and there is no predecessor shape to fail on. Three of the five caller-produced artifacts are at version 1. For those the source walk is the whole holding. The emitted-bytes walk reaches the brief, the record, the evidence artifact, the probe, the contract and the spike chain's verdict, and the chain builders expose no isolation manifest, evaluator configuration, private artifact manifest or scoring policy, so it reaches three of the four. The story says so per artifact rather than implying a coverage it does not have.

### Writing style for every line of prose this change lands

No em dash and no spaced hyphen as a clause connector; use a period, colon, or semicolon.
No construction whose only job is to reject a half, including "not X but Y", "X rather than Y", "X, never Y", and the same pair split by a full stop; delete the rejected half and keep the affirmative.
One sentence per line in markdown source, except on pages that already run one paragraph per line, where the page's own convention wins.
No filler and no hedging. Code comments and JSDoc stay lean: say why, once, and stop.

## Verification

**Commands:**

- `grep -rn "schemaVersion: [0-9]" src/` -- expected: no output.
- `npx vitest run tests/schemas tests/seal tests/emit tests/preflight tests/architecture` -- expected: green.
- Mutation proof for each new gate: move a constant, or move a shape and leave its constant, in a scratch copy, run the suite, record the failure text in Implementation Notes. A gate only watched passing is not accepted.
- `npm run validate` -- expected: green.
