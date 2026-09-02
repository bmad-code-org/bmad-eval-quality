---
title: 'The AD-40 defect signature, corpus qualification, and the witness match'
type: 'feature'
created: '2026-09-01'
status: 'done'
baseline_commit: '93f8d4907e36ac9687cb830b4b6f38f8f5534f50'
review_loop_iteration: 3
context: [
  '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md',
  '{project-root}/_bmad-output/implementation-artifacts/epic-7-context.md',
  '{project-root}/_bmad-output/implementation-artifacts/7-2-a-monotonic-observation-sequence-and-declared-selector-cardinality.md',
  '{project-root}/_bmad-output/implementation-artifacts/7-3-captured-value-matchers-and-test-data-bindings.md',
]
---

# Story 7.4: The AD-40 defect signature, corpus qualification, and the witness match

Epic 7, story key `7-4-the-ad-40-defect-signature-corpus-qualification-and-the-witness-match`.
Implements AD-40 (`ARCHITECTURE-SPINE.md:515-527`) and the AD-9 qualification record
(`ARCHITECTURE-SPINE.md:273-277`). One breaking `schemaVersion` bump under AD-11. No new AD-5 code:
AD-40's compile-time need is the shipped `duplicate-operation-signature`.

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `probe.ts:99` states the cost in the shipped schema: "AD-9's 'an unqualified probe
cannot enter a sealed set' is enforced by nothing in v0: not this schema, not an AD-5 code, and not
an AD-21 rung," and AD-40's defect signature is absent beside it. Without the signature, AD-33's
inputs cannot tell an oracle that correctly confirmed an untouched behaviour from one that failed to
detect the seeded defect, so `missed` is unreachable and the catch rate is 1.00 by construction —
the worst defect any review of this architecture produced (`ARCHITECTURE-SPINE.md:518`).

**Approach:** Two required declarations on the probe — an AD-9 qualification record as a five-route
tagged union, and an AD-40 defect signature of interface kind, home operation (method plus path
template), observable channel, and a discriminating condition. Two pure reference functions beside
them: a corpus-qualification gate that keeps an unqualified probe out of a sealed set, and a witness
match that partitions the candidate observations by AD-4 resolution and returns one of six results
per probe with the observation identifiers it read. Neither assigns an AD-6 outcome state; AD-33
does that in Story 7.5.

## Boundaries & Constraints

**Always:** the signature is contract-independent — its home operation is a method and an erased path
template, never a step identifier, and its condition's pointers are rooted at a reserved step id that
no contract supplies; both reference functions return every verdict and every ambiguity as data,
matching `selection.ts:1-18`, and a thrown `RuntimeFault` propagates undecorated because the spine's
Conventions table (`ARCHITECTURE-SPINE.md:545`) states that a fault never becomes a verdict;
qualification is what keeps the ordinary path total, so every operand class that can fault the
shipped evaluator is rejected by the gate; the
probe-side selector admits `literal` and `matcher` only, as its own type rather than a reuse of
`BindingValue`, which since Story 7.3 also admits `captured` and `principal`; the AD-4 predicate is
the shipped `Expression` and its shipped evaluator, never a second relation vocabulary, and it
passes a probe-side legality pass built from the shipped contract-side checks rather than from a
re-derivation of them; the `Probe` `.meta()` description and `ad5-admissions.test.ts`'s admission 13
both stop recording the two constructions as absent and additive; the `schemaVersion` bump is
breaking under AD-11 because both fields are required.

**Ask First:** none — ambiguities are settled by construction in **Decisions settled by
construction**, per the epic preamble (`epics.md:529`).

**Never:** no AD-6 outcome state, no AD-33 procedure, no AD-21 rung or ladder (Stories 7.5 and 7.7);
no change to `stage-table.ts`'s `score` row inputs (`epics.md:523` puts that in epic 8); no new AD-5
code and no AD-5 registry edit; no probe entering `corpus/dev/` and no fifth `DevCorpusKind` (Story
7.9 owns the corpus probe entry); no regeneration of the worked chain (Story 7.9); no `story`,
`epic`, `Decision <n>`, or `ARCHITECTURE-SPINE.md` reference in any `src/` comment, which
`check:boundary` fails on (`tests/architecture/package-boundary.test.ts` cases 126, 127, 131, 144) —
source comments cite AD numbers only, and the decision references stay in this file.

## I/O & Edge-Case Matrix

`matchProbeWitness` takes a probe whose `defectSignature` is non-null. `C` is the candidate set,
partitioned by AD-4 resolution into `T` (`true`), `F` (`false`), and `U` (`insufficient-evidence`).
Rows 1-11 are `matchProbeWitness`; rows 12-14 are `mapFindings`; row 15 is `auditQuotation`; rows
16-22 are `qualifyProbe`; row 23 belongs to the schema rather than to any of the four.

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| detection | `T` non-empty, a defect finding cites a member of `T` | `matched` with that observation's id | N/A |
| non-detection | `T` non-empty, no defect finding cites a member | `manifested-unclaimed` — what makes `missed` reachable | N/A |
| false claim | a defect finding cites home-operation observations, none in `T` | `unwitnessed-claim` (AD-32), whether `T` is empty or not | N/A |
| never invoked | no evaluator-chosen observation of the home operation | `unexercised` | N/A |
| no such operation | the contract declares no operation matching the signature | `unexercised`, `homeOperationResolved: false` | N/A |
| never triggered | exercised, `C` empty | `not-triggered` | N/A |
| correct behaviour | `T` empty, `F` non-empty | `not-triggered` — AD-6's `confirmed` case | N/A |
| nothing examinable | `C` non-empty, `T` and `F` empty, `U` is all of `C` | `vacuous` — AD-40's verbatim definition | N/A |
| evaluation fault | the evaluator throws `budget-exhausted` or `non-canonicalizable-value` | the `RuntimeFault` propagates undecorated to AD-21's invalid rung and exit 5 | never caught here |
| permuted record | the same observations, array permuted or `sequence` reversed | see AC 7 — result identical either way | N/A |
| resolution ordering | any of the above | the verdict reads cited identifiers only, never quotation (ADR-009 Decision 2) | N/A |
| off-operation citation | a defect finding whose cited observations never touch the home operation | returned as an unmapped finding, never a catch | N/A |
| dangling probe id | a defect finding whose `probeId` names no probe in the set | returned as a dangling citation, AD-32 cross-artifact | N/A |
| signature-less probe | a defect finding cited to a canary or a clean control | returned in its own bucket for Story 7.5 | N/A |
| unquoted claim | a defect finding's quoted evidence appears in no cited observation | reported by `auditQuotation` over every defect finding in the record; the invalidation is ingest's, and ingest is unbuilt | N/A |
| underspecified condition | condition names neither the observable channel nor two channels | qualification fails | reason code |
| contract-relative pointer | condition pointer rooted at any step id but the reserved one | qualification fails | reason code |
| unwritable pointer | condition pointer the home operation does not declare | qualification fails | reason code |
| illegal operand | a `{ referenceSet }` operand, or any AD-4 legality violation | qualification fails | reason code |
| text channel on `api` | condition pointer into `stdout`, `stderr`, or `exit-code` | qualification fails | reason code |
| route mismatch | route incompatible with the probe's class or `expectedClean` | qualification fails; the schema admits it | reason code |
| missing signature | `expectedClean: false`, class not `canary`, signature null | qualification fails; the schema admits it | reason code |
| probe-side `captured` | signature selector binding uses `{ captured }` or `{ principal }` | parse rejection | Zod `invalid_union` |

</frozen-after-approval>

## Code Map

Read-only evidence, no change needed:

- `src/core/evaluate/resolution.ts:610-623` -- `resolveCheck(expression, resolveOperand,
  pointerDenotesCollection, regexMatchStepBudget, artifactPath)`. It throws in seven places: plain
  `Error` at `:594`, `:341`, `:433`, `:505`; `RuntimeFault` from `operators.ts:229,245,255` and from
  `canonicalize.ts:25` via `structurallyEqual` (`operators.ts:38-44`)
- `src/core/evaluate/evidence-resolution.ts:78-107,116-139` -- `channelRoot`, `makeResolveOperand`;
  keyed by step id with `Object.hasOwn`, and `@/` operands never touch the map (`:127-133`)
- `src/core/preflight/witness-evidence.ts:32,59-92,116-129` -- `PREFLIGHT_REGEX_MATCH_STEP_BUDGET`,
  `evidenceOf`, `makeWitnessPointerDenotesCollection(operation)`. The last is the right collection
  predicate for the evaluator; the plan-rooted `makePointerDenotesCollection` is the trap, returning
  `false` on a step-id miss (`evidence-resolution.ts:170-171`) and suppressing the empty-collection
  introduction condition. `:120-122`'s `startsWith('@')` guard before `parseEvidenceTarget` is copied
  verbatim by the qualification gate
- `tests/preflight/fixtures/observations.ts:362-369` -- the working precedent for the reserved step
  id: a live `Expression` rooted at a synthetic non-plan leg id that parses and resolves
- `src/core/compile/sensitivity-witness.ts:287-334` -- the collision guard for a synthetic id sharing
  the plan's namespace, and why it matters
- `src/core/score/selection.ts:1-18,64-84` -- the purity contract and the permutation-safe sort
- `src/core/score/bindings.ts:273-316` -- `satisfiesBindings`, whose rules the probe-side selector
  follows rather than re-derives: the key-presence check at `:292` is shared by all four members, a
  `null` observed channel against a non-null binding channel returns `false` at `:288`, and an
  indeterminate declared type fails closed at `:311` (pinned by `tests/score/bindings.test.ts:709,726`)
- `src/core/schemas/sealed-run-record.ts:27-35,40-47,78-117,169-207` -- `QuotedEvidence`, `Finding`
  (`oracleId` nullable, `probeId` required on every branch; the `defect` branch requires
  `observationIds.min(1)` and `quotedEvidence.min(1)`, both since epic 1 at `schemaVersion: 1`),
  `ObservedCallInputs`, `Observation` (eleven fields; the "ten fields" comment at `:187` predates
  `sequence`)
- `src/core/schemas/interface.ts:93-101,103-116,118-135,152` -- `HttpMethod`,
  `PATH_TEMPLATE_PATTERN` and the AD-40 comment at `:103-108`, `Operation` (which carries no
  interface kind — that lives on `PermittedInterface.kind`), `PathTemplate`
- `src/core/schemas/evidence-artifact.ts:46-50,196-200,277-281` -- `CheckResolutionValue`'s genuine
  tri-state, `Strength.basis` (set by nothing in `src/` today), `uncitedFindings` (Story 7.8's)
- `src/core/schemas/port-messages.ts:94-96` -- "Only a policy denial, a cap, an abort, or a transport
  failure throws", the reason an aborted call never becomes an `Observation`
- `ARCHITECTURE-SPINE.md:545` (Conventions, Errors) and `:417` (AD-28) -- "A fault never becomes a
  verdict, and a finding never throws"; "a port fault during probing or ingest is an invalidating
  condition under AD-21 rather than a behavioural result". `resolution.ts:577-580` says the same of
  itself, and all five `instanceof RuntimeFault` sites in `src/` are re-throw guards; the only
  terminal catch is the CLI boundary at `src/cli/run.ts:281-292`, which converts to `EXIT_FAULT = 5`
- `src/core/schemas/sealed-run-record.ts:32` -- `QuotedEvidence.quote`'s own description: whether the
  quote appears in a cited observation "is NOT checked here; it is an AD-32 declared-versus-observed
  inconsistency that invalidates at ingest, and ADR-009 Decision 2 settles the precedence: 'cited
  identifiers govern the witness match; quotation audits it.'"
- `src/core/lineage/stage-table.ts:89-103` -- `ingest` carries `module: null`, so the stage that owns
  the quotation invalidation does not exist yet and this story supplies the procedure without
  claiming the stage
- `tests/schemas/fixtures/artifact-fixtures.ts:88-94` -- the two committed `QuotedEvidence` shapes
  the projection must answer: a JSON-serialized body quoted as a string, and an integer channel
  quoted as a string
- `src/core/compile/interface-inventory.ts:12-22,24-41,55-62` -- `checkInterfaceKind`; the erasure
  and the inline signature build; the shipped precedent for enforcing in the compiler what a schema
  refinement would lose on export
- `scripts/dependency-direction.ts:49-59` -- `core/compile`, `core/preflight`, `core/score`,
  `core/evaluate` are one layer node, so the new imports are intra-node. `core/` may import no
  external module and no Node builtin, and the purity scan bans `await`, `async`, `new Date`,
  `Date.now`, and `Math.random` in the new files

Changed:

- `src/core/schemas/plan.ts:43-48` -- export the `literal` and `matcher` union members individually.
  A bare `export const` with no `.meta()` changes zero schema bytes; adding `.meta({ id })` would
  collapse the branches to `$ref`s and mint new `$defs`, so do not
- `src/core/score/bindings.ts:202-228` -- export `deepEquals` and `jsonTypeOf`. Without them the
  probe-side selector duplicates roughly 35 of `satisfiesBindings`'s 40 lines, and a drift between
  two copies of `deepEquals` flips a witness match silently
- `src/core/schemas/defect-signature.ts` -- NEW: `OBSERVED_STEP_ID`, `ProbeBindingValue`,
  `PROBE_BINDING_CHANNEL_NON_EMPTY`, `ProbeInputBinding`, `ProbeStepSelector`,
  `DiscriminatingCondition`, `DefectSignature`
- `src/core/schemas/probe-qualification.ts` -- NEW: `QUALIFICATION_ROUTES`, `ProbeQualification`
  (five-branch discriminated union on `route`, every branch a `strictObject`, no `.default()`, no
  `.optional()`, inlined rather than given a `.meta({ id })` — see Decision 12)
- `src/core/schemas/probe.ts:39-59,70-100` -- `qualification` into `probeCommonFields`;
  `defectSignature: DefectSignature.nullable()` onto the `expectedClean: false` branch only; no
  union-level refinement (Decision 11); `.meta()` description rewritten
- `src/core/schemas/constraint-ledger.ts:203-236` -- two `not-expressible` entries, each with a
  stated re-verification trigger, following `observation-sequence-unique` at `:231-235`
- `src/core/compile/expression-legality.ts:49-137,161-187,203-262,352-395,458-504` -- extract
  per-`Expression` entry points out of the contract-shaped enumerator. `walkExpression` (`:49-137`)
  is contract-free and a superset of the three other walkers in `core/compile/`; reuse it rather
  than adding a fifth
- `src/core/compile/reachability.ts:116-126,167-281` -- `checkBoundElementScope`, and
  `evaluatePointerReachability` whose non-throwing core touches the index at exactly two lines
  (`:176`, `:180`); dropping those yields `evaluateReachabilityAgainstOperation(pointer, operation)`
- `src/core/compile/interface-inventory.ts:24-41` -- extract `operationSignature(operation)` from the
  inline build at `:34`. Safe: no test asserts the message fragment and no barrel enumerates compile
  exports
- `src/core/score/qualification.ts` -- NEW: `qualifyProbe`, `sealProbeSet`, `QUALIFICATION_FAILURES`
- `src/core/canonical/canonicalize.ts:28` -- export `serialize`. `canonicalize` returns a
  `Uint8Array` and `core/` may import no Node builtin, so the quotation projection needs the string
  form directly rather than decoding bytes
- `src/core/score/witness.ts` -- NEW: `matchProbeWitness`, `mapFindings`, `PROBE_WITNESS_RESULTS`,
  `PROBE_REGEX_MATCH_STEP_BUDGET`
- `src/core/score/quotation.ts` -- NEW: `auditQuotation`, the per-channel projection, and the
  containment procedure Decision 8 labels `reconstructed`
- `src/application/preflight.ts:48-54` -- runs `Probe.array().safeParse` on caller-supplied probes,
  so the two new required fields reject every existing caller's corpus. This is the story's real
  runtime break and it is named here rather than left to a caller to discover
- `tests/score/qualification.test.ts`, `tests/score/witness.test.ts` -- NEW
- `tests/schemas/fixtures/artifact-fixtures.ts:378-430,738-788` -- the four probes gain
  `qualification`; `seededProbe` and `gameabilityProbe` gain their own `defectSignature` and
  `canaryProbe` overrides it to `null` (all three spread `seededProbe`, so an un-overridden field is
  shared, and `gameabilityProbe` additionally shares `seededDefect` by reference); a fifth probe
  covers the `historical` route in its own `QUALIFICATION_ROUTE_FIXTURES` list, because
  `tests/schemas/artifacts.test.ts:413-417` asserts `PROBE_CLASS_FIXTURES`'s classes equal
  `PROBE_CLASSES` exactly and a fifth entry there fails it; `schemaVersion` 1 -> 2 at `:379`, `:395`
- `tests/schemas/published/corpus.ts:26-48` -- `seedsOf('probe')` enumerates exactly
  `PROBE_CLASS_FIXTURES` and `UNION_BRANCH_FIXTURES`, so the new fixture list is invisible to the
  sweep until this file names it. Without this edit the fifth probe is not a seed and
  `keyword-mutation.test.ts:230-233,243-246` still fail
- `tests/schemas/fixtures/artifact-reject-cases.ts:544-608` -- new probe reject cases with explicit
  `issueCount` where a nested discriminator mutation raises several issues
- `tests/preflight/fixtures/observations.ts:345,371,394` -- the single `schemaVersion` site, inside
  the `probeCommon` spread at `:344-355`, and the two `Probe.parse` fixtures
- `tests/schemas/ad5-admissions.test.ts:532-542,566-576` -- `:532-542`'s mutation must also
  `delete probe.defectSignature`, or flipping into the `expectedClean: true` strict branch raises
  `unrecognized_keys`; admission 13 changes rather than simply inverting (Decision 9's note)
- `scripts/dev-corpus-target.ts:125-129`, `tests/architecture/dev-corpus.test.ts:229-256` -- the
  "qualified-probe dimensions are absent" paragraph narrows to Owed item 1, its case entry at
  `:234-237` goes, and `:238-241`'s `Owed item 1 … Owed item 7` regex is re-checked after
- `corpus/dev/README.md`, `corpus/dev/index.json` -- regenerated by `generate:dev-corpus`; editing
  the script alone fails `check:corpus` and case 161's digest-vs-disk assertion
- `schemas/probe.schema.json` -- regenerated by `generate:schemas`

Regression tripwires for the `expression-legality.ts` extraction, none of which the story may break:

- `tests/compile/sensitivity-witness.test.ts:328-386` -- cases 34-36, whose doc comment names itself
  the tripwire for the generalized enumerator and asserts exact `artifactPath` strings
- `tests/compile/expression-legality.test.ts` -- imports the five named exports and asserts exact
  paths; `:308-321` pins that a declared non-array `types` entry beats a contradictory
  `collectionLocations`; `:353-361` pins the permissive undeclared-token default
- `tests/compile/reachability.test.ts` -- pins `evaluatePointerReachability(pointer, index)`'s
  signature and carries a parity matrix at `:416-500` against `makeResolveOperand`/`ABSENT`
- `tests/compile/compile.test.ts:46,421-470` -- "29 wired functions, in call order", and the three
  `malformed-operator-expression` subchecks' suborder

Pinned counters and gates that move:

- `tests/schemas/published/keyword-mutation.test.ts:120-157` -- `CENSUS_BY_DOCUMENT['probe']` (381),
  `CENSUS_BY_KEYWORD`, `CENSUS_TOTAL` (2317); `:230-233` and `:243-246` fail on any keyword with no
  seed. Note `probeCommonFields` is spread into both root branches, so an inlined `qualification` is
  emitted twice in `probe.schema.json` — the same reason `eval-contract.test.ts:311` pins probe's
  `WitnessInputs` `$ref` at exactly 2
- `tests/schemas/published/differential.test.ts:33` -- the corpus total (129)
- `tests/schemas/published/published-rejection.test.ts:85-88` -- the three reject-case lengths;
  `:205` -- the accept census (`12 + 4 + 6 + 3`)
- `tests/schemas/publish.test.ts:212-213` -- the ledger inject/not-expressible split
- `tests/schemas/constraint-ledger.test.ts:106-108` -- the total is
  `arityEntries.length + 4 + lineageCarriers.length + 2`, two bare literals naming no groups; two new
  `not-expressible` entries move the total by two, and the story records which literal was chosen
  rather than guessing. `:170-182`'s `it.each` goes from 8 ids to 10; `:133`, `:206-209` --
  address resolution
- `tests/schemas/artifact-registry.test.ts:166-184,188-199,233-253,290,296-304,311-323` --
  `additionalProperties: false` at every depth (five `strictObject` branches pass this),
  `CALLER_KEYED_CONTROL_MAPS` pins probe's two pointers and asserts `toEqual`, input/output-mode byte
  equality (no `.default()`), every declared key in `required` (no `.optional()`; nullability is
  `.nullable()` only)
- `tests/schemas/eval-contract.test.ts:311,328` -- probe's `WitnessInputs` `$ref` count (2) and its
  repaired `Expression` tuple branches (12)
- `tests/schemas/artifact-reject-fixtures.test.ts:42` -- one Zod issue per reject case unless
  `issueCount` says otherwise
- `tests/architecture/package-boundary.test.ts` cases 126, 127, 131, 144 -- the source-comment ban
- `vitest.config.ts:14,24` -- both new `src/core/score/` files sit inside the 90% floor

No new `$defs` and no new arity ledger entries: `probe.schema.json` already carries `Expression`,
`Operand`, and `JsonValue` through AD-10's `manifestationWitness` (`sensitivity-witness.ts:89`), and
`ARITY_ARTIFACTS` already includes `'probe'` (`constraint-ledger.ts:70-101`).

## Tasks & Acceptance

**Execution:**
- [x] `src/core/schemas/plan.ts`, `src/core/score/bindings.ts` -- export the two union members and
      the two helpers -- one spelling of `{ literal }`, `{ matcher }`, `deepEquals`, and
      `jsonTypeOf` beats two that can drift
- [x] `src/core/schemas/defect-signature.ts` -- the signature, its probe-side selector, and
      `OBSERVED_STEP_ID`
- [x] `src/core/schemas/probe-qualification.ts` -- AD-9's five routes as a tagged union
- [x] `src/core/schemas/probe.ts` -- wire both in and rewrite `.meta()` so it records a breaking bump
      instead of two absences
- [x] `src/core/schemas/constraint-ledger.ts` -- the two new entries, each ending with
      its re-verification trigger -- required by AD-13 and by `constraint-ledger.test.ts:133`, not by
      the generator, which skips non-`inject` entries at `publish.ts:173-177`
- [x] `src/core/compile/expression-legality.ts`, `reachability.ts` -- extract per-`Expression` and
      per-`Operation` entry points -- without them a probe condition skips every check a contract
      expression must pass
- [x] `src/core/compile/interface-inventory.ts` -- extract `operationSignature`
- [x] `src/core/score/qualification.ts` -- `qualifyProbe`, `sealProbeSet`, and the closed
      `QUALIFICATION_FAILURES` set
- [x] `src/core/score/witness.ts` -- the candidate partition, the six results, `mapFindings`'s four
      buckets
- [x] `src/core/canonical/canonicalize.ts`, `src/core/score/quotation.ts` -- export `serialize`, then
      `auditQuotation` and its per-channel projection -- a separate module because ADR-009 Decision 2
      keeps quotation out of the verdict path
- [x] `npm run generate:schemas` -- confirm exactly `schemas/probe.schema.json` changes
- [x] `npm run generate:dev-corpus` -- commit `corpus/dev/README.md` and `index.json` together
- [x] fixtures -- five probes across two lists, `tests/schemas/published/corpus.ts` taught the new
      list, both new fields, the reject cases, `tests/preflight/fixtures/observations.ts`, and the
      moved counters recorded before -> after
- [x] `tests/score/qualification.test.ts`, `tests/score/witness.test.ts` -- the I/O matrix above,
      both permutation families, the citation triad, and the full partition table
- [x] `ad5-admissions.test.ts`, `dev-corpus-target.ts`, `dev-corpus.test.ts` -- the prose and
      admission sites that assert the absence this story closes
- [x] `npm run validate` green end to end

**Acceptance Criteria:**
1. Given a probe, when it parses, then it carries an AD-9 qualification record on every branch, and
   a `defectSignature` on the `expectedClean: false` branch that is nullable at the schema level and
   required by qualification for every class but `canary`; a clean control carries no
   `defectSignature` field at all, because its branch already forbids seeded defects.
2. Given a defect signature, when its selector parses, then a `{ captured }` or `{ principal }`
   binding is rejected, and the rejection is fixtured in the published reject corpus with its
   published-side keyword and instance path named alongside the Zod issue.
3. Given a signature and a contract's operation inventory, when the home operation resolves, then
   the comparison erases parameter names first, so `/notes/{id}` binds `/notes/{noteId}`, and a
   post-erasure collision inside one contract has already failed compilation under the shipped
   `duplicate-operation-signature`.
4. Given a probe, when `qualifyProbe` runs, then every failure comes back as a code from one closed
   set covering: an absent signature on a class that needs one, an incompatible route (Decision 2's
   table), a `defects` array whose sources no single route agrees with, a condition naming neither
   the declared observable channel nor at least two channels, a pointer rooted at any step id but
   the reserved one, a pointer the home operation does not declare, a pointer into a text channel on
   an `api` signature, an interface kind other than `api`, a `{ referenceSet }` operand, and every
   contract-side AD-4 legality violation that has a probe-side form — the two that do not, the
   `covers-by-key` `expectedKey` uniqueness rule and `checkReferenceSetResolution`, govern only
   `{ referenceSet }` operands, which are banned outright; and `sealProbeSet` admits only probes that
   pass, returning the exclusions rather than dropping them.
5. Given a probe with a signature, a contract, and a sealed run record, when `matchProbeWitness`
   runs, then it partitions the candidates into `T`/`F`/`U` and returns exactly one of
   `unexercised`, `unwitnessed-claim`, `matched`, `manifested-unclaimed`, `not-triggered`, `vacuous`
   — `PROBE_WITNESS_RESULTS`'s declaration order is that evaluation order — carrying the observation
   identifiers it read and the partition sizes, deciding from cited identifiers alone and never from
   quotation, and assigning no AD-6 outcome state.
6. Given a probe whose home operation the evaluator never invoked, when the match runs, then the
   result is `unexercised`; `provenance: 'evaluator-chosen'` is the whole exclusion mechanism, and
   the story records that fixture set-up is excluded only where the caller recorded it as
   `baseline`, which is caller-attested under AD-32.
7. Given a run record, when the match runs against the same observations with the array permuted,
   then the result and the returned identifiers are identical including their order (the NFR9
   family); and when it runs against the same observations with their `sequence` values reversed,
   then the result and the identifier set are identical while the order follows the new sequence,
   ascending with `observationId` as tiebreak.
8. Given the same two-observation record, when a defect finding cites the satisfying observation,
   the non-satisfying one, or no defect finding is filed at all, then the results are `matched`,
   `unwitnessed-claim`, and `manifested-unclaimed` respectively.
9. Given every defect finding in the record, when `auditQuotation` runs, then each channel projects
   by the rule Decision 17 fixes, a quote appearing in no cited observation's projection is reported
   as an AD-32 declared-versus-observed inconsistency independently of which `mapFindings` bucket the
   finding falls into, and no witness verdict reads the result — ADR-009 Decision 2 gives the verdict
   to cited identifiers and leaves quotation as the audit, which invalidates at ingest.
10. Given a defect finding whose cited observations never touch the signature's home operation, when
    `mapFindings` runs, then it is returned as an unmapped finding and never counted as a catch; a
    finding whose `probeId` names no probe in the set is returned separately as a dangling citation;
    and a finding cited to a probe carrying no signature is returned in its own bucket for Story 7.5.
11. Given a record ingested from outside this package's schema, when the containment procedure runs,
    then it resolves by quotation and labels its result `reconstructed`; every record the shipped
    reader can accept resolves by cited identifiers and is labelled `measured`, and v0 emits
    `reconstructed` from nowhere.
12. Given the shipped evaluator throwing a `RuntimeFault` on a candidate, when the match runs, then
    the fault propagates undecorated and no result is returned, because the Conventions table forbids
    a fault becoming a verdict and AD-28 routes it to AD-21's invalid rung; the test asserts the
    throw and its code rather than a domain value.
13. Given `npm run generate:schemas` and AD-13's four checks, when run after this story, then all
    four pass, with a fixture per qualification route reachable from `seedsOf('probe')` so the
    keyword-mutation sweep has a seed for every branch.

## Spec Change Log

**Round 1 — peer story review before implementation.** 11 HIGH, 12 MEDIUM, 7 LOW. The
spec-changing ones: a sixth witness result was needed because the draft folded "exercised, condition
`false` everywhere" into `vacuous`, which Story 7.5 maps to `infrastructure-error`, invalidating
every run containing a defect probe whose seeded defect did not fire — AD-6's "common case on any
defect probe", which it assigns `confirmed`. Selector match semantics were absent entirely.
`matchProbeWitness` could not be total, since `resolveCheck` throws in seven places and three were
reachable from the draft's own call shape. No operand-legality gate reached the probe-side
condition, so an unchecked condition admitted `existence` over a literal — always true, catch rate
1.00 by construction, the exact defect AD-40 exists to close arriving through the field added to
close it. The legacy-record version constant had no referent. "All six response channels null" was
unsound both ways. A union-level refinement is dropped from the published export, so Zod and ajv
would disagree. Two AD-40 sentences conflict on a finding that witnesses nothing and the draft
picked one silently. Two acceptance criteria contradicted each other on ordering. The route table
decided five of eight cells.

**Round 2 — same peer, re-verify against the rewrite.** Four round-1 HIGHs fully closed, seven
closed in substance; 6 HIGH, 12 MEDIUM, 4 LOW new. The spec-changing ones:

- **The six results were neither disjoint nor exhaustive.** An empty candidate set satisfied
  `vacuous`'s "insufficient-evidence on every candidate" vacuously *and* the matrix's
  `not-manifested` row, and precedence picked the one the matrix rejected — the same failure class
  as round 1's H1, one level in, with the same maximal divergence (run invalid versus run scores).
  Separately, mixed `false`/`insufficient-evidence` across candidates fitted no result at all.
  Replaced the precedence list with the `T`/`F`/`U` partition in Decision 10, which is exhaustive
  and disjoint over the whole input space and also fixes the fault-masking hole.
- **The legality pass named the wrong field.** `checkQuantifierOverNonCollection` reads
  `operation.responseDescriptor.types`, not `collectionLocations`, and
  `tests/compile/expression-legality.test.ts:308-321` already pins that a declared non-array type
  beats a contradictory collection location — so the draft's gate would have disagreed with the
  compiler on a shipped fixture. It also omitted the check with the biggest payoff: evidence
  reachability, whose non-throwing core is already exported and needs two lines removed to work
  against an operation. Fixed in Decision 6.
- **The quotation procedure was undefined and, after Decision 9, skipped for two of three buckets.**
  Nothing in `src/` compares a quote to an observation today, so there was no precedent to inherit
  and no serialization choice made. Spine `:531` makes the rule a property of the finding, not of
  which probe it maps to. Fixed in Decision 17.
- **`not-manifested` collided with AD-40's own prose**, which calls the *vacuous* case "never
  manifested at all". Renamed `not-triggered`.
- **The fault disposition destroyed an input Story 7.5 declares.** 7.5's AC names AD-26's
  evaluation-fault signal as its own input; folding it into `vacuous` swallowed it, and catching a
  `RuntimeFault` silently converts AD-21's exit 5 into exit 3. Fixed in Decision 5.
- **The source-to-route mapping regressed** out of the rewrite, and the `historical` route has no
  fixture to land on — no fixture anywhere in the repo uses `Defect.source: 'natural'`. Restored in
  Decision 2 with the mixed-source case decided.
- **Two blast-radius misses that fail CI without changing what gets built:** the fifth probe cannot
  join `PROBE_CLASS_FIXTURES` (`artifacts.test.ts:413-417` asserts exact class equality) and a new
  list is invisible to `seedsOf('probe')` without an edit to `tests/schemas/published/corpus.ts`,
  which appeared in no Code Map; and the `expression-legality.ts` refactor has named tripwires in
  `tests/compile/` that neither the Code Map nor the iterate command reached.

**Round 2 addendum — a late subagent, four items.** Two of them changed the shape of the story:

- **Catching a `RuntimeFault` is forbidden, not merely inelegant.** Three texts say so — the
  Conventions table's "a fault never becomes a verdict", AD-28's "an invalidating condition under
  AD-21 rather than a behavioural result", and AD-28's disjoint-vocabularies clause, which storing a
  `RuntimeFaultCode` inside a result runs backwards. `resolution.ts:577-580` says the same of itself
  and there is no catching precedent anywhere in `src/`. Faults now propagate; Decision 5 shrank to
  its correct half and the fault-scope question disappeared with it.
- **The quotation check is already assigned.** `sealed-run-record.ts:32` puts it at ingest and cites
  ADR-009 Decision 2 for the precedence. Split in Decision 17: the verdict reads identifiers, the
  audit ships here as its own function over the whole record, and ingest — still `module: null` —
  owns the invalidation. Also corrected the procedure's foundation: `containment` returns `false` on
  an object haystack and `canonicalize`'s `serialize` is unexported, so neither was reusable as
  assumed.
- Decision 12 is now conditional and measured: inlining costs about +98 census occurrences against
  +49 for `$defs`, and the `$defs` route would falsify `keyword-occurrences.ts:106-109` because
  AD-9's routes all carry `ArtifactReference` evidence. Inlining stands, with the numbers recorded
  as a shape rather than an answer.

KEEP — confirmed across both rounds and required to survive any re-derivation: the reserved
`observed` step id and its evaluator path; `makeWitnessPointerDenotesCollection` over the plan-rooted
variant; the flat `expectedClean` union with no second discriminator; qualification required on
every probe; `unwitnessed-claim` beating a competing `matched`; no new AD-5 code; AC 7's two
permutation families; Decision 11's gate-side enforcement; Decision 12's inlining, which passes the
depth-wise strictness walk; and reading the AC's "reversed-order flip" as a flip to be asserted
absent.

## Decisions settled by construction

Per the epic preamble (`epics.md:529`), each of these is decided here rather than escalated.

1. **Qualification is required on every probe; the signature on every non-canary probe that seeds.**
   The epic reads "every non-canary probe declares an AD-9 qualification record and an AD-40 defect
   signature". AD-9 spells a route for all five kinds and closes "an unqualified probe cannot enter
   a sealed set" with no exception, so exempting the canary from qualification would leave the route
   AD-9 writes for it with nothing to write it in. The exemption attaches to the signature, which is
   AD-40's field.

2. **The full route table, `probeClass` x `expectedClean`, with `expectedClean` deciding first.**
   The table is enforced by `qualifyProbe`, not by the schema: all eight cells parse, and
   `ad5-admissions.test.ts:532-542` deliberately constructs an illegal one and asserts zero issues.

   | class | `expectedClean: false` | `expectedClean: true` |
   | --- | --- | --- |
   | `defect` | `historical` where every seeded `Defect.source` is `natural`, `controlled-mutation` where every source is `controlled-mutation` | illegal — a probe classed `defect` that seeds nothing |
   | `zero-action` | same source-to-route rule | `clean-control` |
   | `gameability` | `gameability` | illegal — the degenerate-response opportunity is what it seeds |
   | `canary` | `canary`, and no signature | illegal — nothing to fail to detect |

   A `defects` array mixing `natural` and `controlled-mutation` sources agrees with no single route
   and is its own qualification failure, rather than being resolved by majority or by first entry.
   `expectedClean` is the schema's discriminator and is read first, so a canary clean control is an
   illegal cell rather than a probe owing two routes. Gameability needs a signature because AD-7
   excludes only canaries and clean controls from the dominance vector, so a gameability probe's
   outcome must be computable, and AD-33 assigns an outcome only from a signature match.

3. **A sixth result, and `vacuous` stays at AD-40's verbatim definition.** AD-40's own Backward
   argument is that the signature is the input that tells `confirmed` from `missed`; AD-6 calls
   `confirmed` "the common case on any defect probe". A probe exercised whose condition resolved
   `false` everywhere is exactly that case, and the AC's five names have no member for it. Folding it
   into `vacuous` sends it to `infrastructure-error` and invalidates the run, punishing the contract
   for the evaluator's path choice — the route AD-39 was rewritten to remove and AD-40:527 refuses in
   the neighbouring sentence. Folding it into `unexercised` contradicts AD-40's own definition of
   exercised. So the AC's "exactly one of five" is knowingly widened to six, recorded here rather
   than escalated. The sixth is named `not-triggered` rather than `not-manifested`, because AD-40
   already calls the *vacuous* case "never manifested at all" and two documents must not use one
   phrase for two states that route to opposite verdicts. Story 7.5 inherits the mapping and must add
   `not-triggered` to `confirmed` beside its `vacuous` to `infrastructure-error` row.

4. **The candidate set is the selector's, and the predicate runs over it.** Candidates are the
   observations of the resolved home operation whose `provenance` is `evaluator-chosen` and whose
   `callInputs` satisfy the selector's input binding. Satisfaction follows the shipped
   `satisfiesBindings` (`bindings.ts:273-316`) rather than a re-derivation of it, minus the two
   members the probe side does not admit — so the key-presence check binds all members including
   `literal` and `type-violating`, a `null` observed channel against a non-null binding channel
   fails, and an indeterminate declared type fails closed. The declared type comes from the
   signature's own home operation, since a probe has no `PlanIndex`; `ObservedCallInputs` and
   `InputBinding` agree on channel names, on the four-key strict shape, and on flatness, so there is
   no shape to bridge, and `{}` and `null` stay non-equivalent on the binding side, which is why
   `PROBE_BINDING_CHANNEL_NON_EMPTY` is kept. Exercised is decided at operation granularity per
   AD-40, so a probe whose operation was invoked but whose selector matched nothing is exercised and
   resolves `not-triggered`, and it stays in AD-7's denominator; that consequence is AD-40's own.

5. **A fault propagates; it never becomes a result.** `resolveCheck` throws in seven places.
   `qualifyProbe` rejects the operand classes that make four of them reachable — `{ referenceSet }`
   operands above all, which resolve `ABSENT` against the probe side's empty reference-set map and
   then throw a plain `Error` at `resolution.ts:434,505` — and `operator-cannot-accept-operand`
   becomes unreachable once the regex-construct check runs. The two that remain genuinely
   data-dependent are `budget-exhausted` and `non-canonicalizable-value`, and both leave the
   function undecorated. An earlier draft caught them and folded the candidate into `U`, which three
   texts forbid: the Conventions table (`ARCHITECTURE-SPINE.md:545`) says "a fault never becomes a
   verdict, and a finding never throws"; AD-28 (`:417`) makes a fault "an invalidating condition
   under AD-21 rather than a behavioural result"; and AD-28 (`:429`) keeps the two vocabularies
   disjoint, so storing a `RuntimeFaultCode` as data inside a result runs that clause backwards.
   There is no precedent for the catch either — all five `instanceof RuntimeFault` sites in `src/`
   are re-throw guards, the only terminal catch is the CLI boundary converting to `EXIT_FAULT = 5`,
   and `src/application/preflight.ts:13` states the policy for the nearest analogous stage in four
   words: "RuntimeFault from a leg propagates." Propagating also reaches the outcome the story wants
   — AD-21's invalid rung — through the mechanism the architecture already owns, keeps AD-26's
   evaluation-fault signal intact for Story 7.5 rather than pre-collapsing it, and removes the
   per-candidate-versus-whole-match scope question entirely. `RuntimeFault` already carries
   `artifactPath`, which is where the probe is named in the diagnostic.

6. **`qualifyProbe` runs a probe-side legality pass built from the shipped checks.** Without it the
   gate's channel rules let `existence` over `{ literal: 5 }` through — always true, so every
   observation satisfies the signature and the catch rate is 1.00 by construction. The pass covers
   operand legality per operator position (`OPERAND_LEGALITY`), the `ordering`-over-`call-inputs`
   rule that sits beside that table in the same function (`expression-legality.ts:251-262`) and
   crosses over because it is bare-`Expression` runnable, regex anchoring, the quantifier nesting
   bound, quantifier-over-non-collection, `@/` operands only inside a quantifier
   (`reachability.ts:116-126`), and evidence reachability. Three construction rules, each of which a
   re-derivation gets wrong:
   - quantifier-over-non-collection reads `operation.responseDescriptor.types[firstToken]`, inspects
     only a one-token tail, and is permissive on an undeclared token; it does **not** read
     `collectionLocations`, and `tests/compile/expression-legality.test.ts:308-321` pins that a
     declared non-array type beats a contradictory collection location. Its `operationFor` lookup
     needs the probe-side equivalent of the witness branch's `scope.legIds`, which is `['observed']`;
     omit it and the check silently no-ops, as `expression-legality.ts:464-467` warns.
   - evidence reachability comes from `evaluatePointerReachability` (`reachability.ts:167-281`),
     whose only index touches are `:176` and `:180`; dropping them yields
     `evaluateReachabilityAgainstOperation(pointer, operation)` verbatim. It is the check with the
     largest payoff: without it a condition addressing an undeclared channel or key resolves
     `ABSENT`, every comparison resolves `false`, and the probe reports `not-triggered` and then
     `confirmed` — a silently passing run on a signature that was never writable.
   - `walkExpression` (`expression-legality.ts:49-137`) is contract-free and a superset of the three
     other expression walkers under `core/compile/`; the gate reuses it rather than adding a fifth.

   Failures are qualification reasons, never AD-5 codes: AD-5 is compile-time over contracts and
   `compile` never sees a probe.

7. **Exercised is `provenance: 'evaluator-chosen'` on an observation of the home operation, and
   nothing else.** An aborted in-flight call never becomes an `Observation` —
   `port-messages.ts:94-96` records that an abort throws — so there is no completion predicate to
   write, and a "no response channel is set" predicate would exclude legitimately sparse completed
   calls (a 204, a payload-free `mcp` response) while catching nothing. AD-40's three exclusions
   therefore run through two mechanisms, not three: harness baselines and fixture set-up are excluded
   only where the caller recorded them as `baseline`, which is caller-attested under AD-32 and is
   stated as trust rather than assumed.

8. **The containment procedure is defined for records from outside this package's schema, and v0
   never enters it.** `observationIds.min(1)` has been on the defect branch since epic 1 at
   `schemaVersion: 1`, so no version of this schema predates the identifier requirement, and AD-11
   makes a reader reject an unequal version anyway. The spine's sentence is about re-deriving
   detection from foreign records. So: the procedure exists, its test constructs its input below the
   schema boundary with a typed cast, its result is labelled `reconstructed`, and nothing in v0
   calls it.

9. **Off-operation citations are unmapped; on-operation citations that fail the condition are
   `unwitnessed-claim`.** AD-40 says both that an unwitnessed detection claim invalidates (`:527`)
   and that a finding mapping to no seeded signature is an unexpected real defect preserved under
   AD-23 (`:519`). A finding cited to probe P but reporting a different defect on a different
   operation satisfies both descriptions, and collapsing them invalidates the run over the SM-D4
   discovery case. The home operation is the discriminator: a citation that never touches it is not
   a claim about this signature. A finding whose `probeId` names no probe in the set is a third
   thing, a dangling cross-artifact reference under AD-32, returned separately rather than dressed up
   as a discovery. The AD-23 uncited case proper (`oracleId: null`) is Story 7.8's, through
   `EvidenceArtifact.uncitedFindings`. Note for the `ad5-admissions.test.ts` edit: admission 13 does
   not simply invert. After Decision 11 the schema rejects a probe *missing* `qualification`, and
   still admits an incompatible route and a signature-less non-canary — so the admission narrows to
   what the gate rather than the schema now catches.

10. **The result is a partition, not a precedence list.** `C` is the candidate set, partitioned by
    AD-4 resolution into `T` (`true`), `F` (`false`), and `U` (`insufficient-evidence`). There is no
    fault member: per Decision 5 a fault leaves the function. `E` is exercised per Decision 7. A
    "bogus claim" is a defect finding cited to this probe whose cited observations touch the home
    operation and include no member of `T`.

    | condition | result |
    | --- | --- |
    | `¬E` | `unexercised` |
    | `E`, `T ≠ ∅`, a bogus claim exists | `unwitnessed-claim` |
    | `E`, `T ≠ ∅`, a defect finding cites a member of `T` | `matched` |
    | `E`, `T ≠ ∅`, otherwise | `manifested-unclaimed` |
    | `E`, `T = ∅`, a bogus claim exists | `unwitnessed-claim` |
    | `E`, `T = ∅`, no bogus claim, `C = ∅` or `F ≠ ∅` | `not-triggered` |
    | `E`, `T = ∅`, no bogus claim, `C ≠ ∅` and `F = ∅` (so `U = C`) | `vacuous` |

    Exhaustive and totally ordered over the whole input space — first match wins, and rows 2 and 3
    deliberately overlap where one finding cites a member of `T` while another is a bogus claim,
    which is the case the story resolves in `unwitnessed-claim`'s favour. It puts the empty candidate
    set on the
    `not-triggered` side explicitly rather than letting `vacuous`'s universal quantifier be
    vacuously true over it; it gives mixed `F`/`U` a home, which a six-way precedence list did not;
    and it keeps one faulted candidate from masking a `matched` on another. AD-40 backs the split:
    `insufficient-evidence` "never counts as detection" and "does not manifest the signature", while
    a `false` resolution is the system examined and behaving. `unwitnessed-claim` beats `vacuous`
    here for the same reason it beats `matched` — an invalidating AD-32 inconsistency must not be
    masked — and because AD-21 requires the record to carry every condition that fired, the result
    carries the partition sizes alongside the verdict rather than only the verdict.
    `PROBE_WITNESS_RESULTS` is declared in the table's evaluation order so a reader cannot mistake
    the constant for a different ordering.

11. **The canary exemption is enforced by the gate, not by a schema refinement.** Verified on the
    pin: a union-level `superRefine` exports byte-identically, so Zod would reject a signature-less
    non-canary probe that ajv accepts, and `differential.test.ts` exists to fail on exactly that
    disagreement — with a witness the mutant generator manufactures trivially from `seededProbe`,
    unlike `observation-sequence-unique`, whose ledger entry argues the corpus cannot synthesise
    one. The shipped precedent is `interface-inventory.ts:55-62`, which put the principal check in
    the compiler for the same reason. `defectSignature` is therefore `.nullable()` on the branch and
    the constraint is a `not-expressible` ledger entry plus a qualification reason. Both new ledger
    reasons end with a stated re-verification trigger, as `constraint-ledger.ts:231-235` does.

12. **`qualification` is inlined rather than given a `.meta({ id })`, and the cost is measured
    rather than guessed.** `keyword-occurrences.ts:98-109` records that two `$defs` sharing an
    internal path are indistinguishable from `schemaPath` alone and that no such collision exists in
    the current export. That premise is half true: ajv inlines a ref-free `$defs` entry and reports
    its full path, which is why a ref-free `$defs/Qualification` would collide with nothing. But
    AD-9's five routes all rest on recorded evidence, so every branch carries an `ArtifactReference`
    — the entry is not ref-free, its occurrences share def-relative suffixes with `Expression` and
    `ArtifactReference`, and `pointerMatchesSchemaPath`'s instance-path test separates def-from-root
    and never def-from-def. Taking the `$defs` route therefore makes
    `keyword-occurrences.ts:106-109`'s stated invariant false and puts a comment rewrite in this
    story's diff. Inlining keeps the invariant true and costs, on a representative five-branch union
    planted into a clone of the shipped document: `CENSUS_BY_DOCUMENT['probe']` 381 -> about 479
    against about 430 for `$defs`, `CENSUS_TOTAL` 2317 -> about 2415, with the per-keyword shape
    roughly `type` +42, `minLength` +16, `additionalProperties` +10, `const` +10, `required` +10,
    `enum` +4, and `oneOf`/`maximum`/`minimum` +2 each. Exactly double the `$defs` figure, because
    `probeCommonFields` is spread into both root branches and Zod emits every common field inline in
    each — the same reason `eval-contract.test.ts:311` pins probe's `WitnessInputs` `$ref` at
    exactly 2. Those numbers are the shape of the move and not the answer; transcribe the real ones
    from a census run once the real shape lands. Second-order cost, worth naming because it is a
    time budget rather than a count: `computeSweep` (`keyword-mutation.test.ts:73-88`) compiles the
    whole 49 KB document once per occurrence against 240 seconds, so this is roughly 98 extra full
    ajv compiles rather than 49.

13. **`sealProbeSet` is construction-time, and score never re-filters.** AD-9's sentence is a corpus
    invariant. Silently dropping an unqualified probe at score time would shrink AD-7's denominator
    and desynchronise the AD-8 corpus digest from the probes actually scored, while AD-7 makes
    comparability the corpus digest restricted to the probes both results cover. So `sealProbeSet`
    returns `{ admitted, rejected }` at construction, and a sealed set that nonetheless contains an
    unqualified probe is an invalidating condition for Story 7.5 rather than something the match
    quietly repairs.

14. **"Names the response channel or at least two channels" is the set of distinct
    `EvidenceChannel` values appearing in the predicate's fully-rooted pointers** — the selector's
    bindings do not count, since they describe what was sent. It passes if that set contains the
    signature's declared `observableChannel`, or has cardinality two or more with at least one
    response-side member. The rule exists to reject "the evidence contains the string I sent", so
    `call-inputs` twice must not pass and does not.

15. **On an `api` signature, a pointer into `stdout`, `stderr`, or `exit-code` is a qualification
    failure, and an interface kind other than `api` is another.** `Operation` carries no interface
    kind and requires a method and a path template with no per-kind variation, so a `cli` or `mcp`
    signature would declare a meaningless `POST /path`. The contract side cannot decide the text
    channels either — `evaluatePointerReachability:187-196` rejects a tailed `stdout` pointer but
    returns reachable for a bare one unconditionally — and the signature's own declared
    `interfaceKind` is precisely what makes the probe-side rule decidable, so it is spent rather than
    left as prose. v0 keeps all four kinds in the enum so `unsupported-interface-kind` stays fireable
    contract-side (`interface-inventory.ts:12-22`).

16. **`PROBE_REGEX_MATCH_STEP_BUDGET = 1_000_000`, a named module constant.** `resolveCheck`'s
    fourth parameter is a bare required `number` whose declared home is
    `ScoringPolicy.regexMatchStepBudget`, and a probe is not scored under a policy at qualification
    time. Pre-flight hit this and answered the same way at `witness-evidence.ts:32`; following the
    precedent keeps two implementations from choosing two budgets and disagreeing about
    `budget-exhausted`.

17. **Quotation audits, identifiers govern, and the split is already settled.** The epic AC assigns
    both forms of unwitnessed claim to this story, and ADR-009 Decision 2 (`ADR-009:66-73`) gives
    the verdict to one of them: "The match resolves over identifiers alone. Quoted evidence that
    appears in no cited observation invalidates the run as an AD-32 declared-versus-observed
    inconsistency." One function cannot satisfy both sentences, so the story picks the ADR and says
    so rather than smuggling the choice: the witness verdict reads cited identifiers only, and the
    quotation check still ships here, as `auditQuotation` — a separate pure function over the whole
    record whose result no verdict path reads. The ADR fixes the split and not the stage; the stage
    comes from `sealed-run-record.ts:32`, which places the invalidation at ingest. `ingest` carries
    `module: null` (`stage-table.ts:89-103`), so `auditQuotation` ships with no caller, by design.

    That leaves the invalidation itself without an owner inside epic 7, and the gap is named rather
    than left for a reader to find. Story 7.7's acceptance criterion registers "the two conditions
    this epic's own stories create — Story 7.2's selector ambiguity and Story 7.4's
    `unwitnessed-claim`", which under this split carries one form and not the other. Story 7.7 must
    therefore register a **third** Invalid-rung condition, an unwitnessed quotation, alongside those
    two; AD-32 makes it invalidating and 7.7 owns the ladders that say so. Until then the procedure
    exists, is tested, and fires for nobody.

    Scope follows from the same reading: the audit runs over every defect finding in the record
    regardless of which `mapFindings` bucket it lands in, because spine `:531` makes an unwitnessed
    quote a property of the finding rather than of the probe it maps to.

    The procedure itself is constructed here, because `quotedEvidence` has no use site in `src/`
    beyond its own schema field and there is nothing to inherit. Two shipped mechanisms look like
    candidates and are not: AD-4's `containment` operator falls through to `false` on an object
    haystack (`operators.ts:154`) rather than serializing it, and `canonicalize` returns a
    `Uint8Array` with its `serialize` unexported. So: `auditQuotation` projects the named channel to
    a string and asks for `quote` as an exact substring, per channel — `stdout` and `stderr` project
    as themselves, `response-status` and `exit-code` through `Number.prototype.toString`,
    `response-body`, `response-headers`, and `call-inputs` through the shipped RFC 8785
    serialization, newly exported. A `null` channel projects to nothing and witnesses nothing. No
    case folding and no whitespace normalization: AD-23 requires the evidence verbatim, and a
    normalizing match would accept a quote the record does not contain. The consequence is stated
    rather than hidden: canonical serialization re-spells a body with sorted keys and no whitespace,
    so a quote taken from a pretty-printed rendering is not a substring of it. That is correct — the
    record stores JSON values and has no pretty-printed form to quote — and the committed fixture at
    `artifact-fixtures.ts:88-94` already quotes the compact form. Should canonicalization itself
    throw `non-canonicalizable-value` on a caller's record, the fault propagates under Decision 5,
    which is what keeps this procedure from being circular with it.

## Decisions taken during implementation

1. **`probe-binding-channel-non-empty` ships as an INJECT ledger entry, not as the second
   `not-expressible` one.** The Code Map predicted two `not-expressible` entries; the
   published-schema differential proved one of them wrong before it was written. Left inlined at four
   addresses, the probe-side channel's non-empty rule is Zod-only, and the mutant generator
   synthesises a witness carrying `{}` in three of the four channels from the signature's own
   `anyOf` branches — fourteen `zod=false published=true` disagreements on `probe`, exactly the
   failure Decision 11 argues the canary exemption away from. So `ProbeBindingChannel` carries
   `.meta({ id: 'ProbeInputBindingChannel' })`, the ledger injects `minProperties: 1` at that one
   definition address, and the synthesiser (which reads `minProperties`) now builds a one-key map
   instead. The ledger total still moves by two; the split moves from 25/16 to 26/17 rather than
   25/18, and `publish.test.ts:212-213` and `differential.test.ts:134` move with it. Decision 11's
   own entry, `defect-signature-required`, stays `not-expressible` as written, and both new entries
   still end with a stated re-verification trigger.

2. **`qualifyProbe(probe, homeOperation)` takes the operation as an explicit parameter, and reports
   whether the declaration-dependent checks ran.** Decision 6 requires two checks that read declared
   shapes — quantifier-over-non-collection and evidence reachability — while AD-9 qualification is a
   corpus-side act and a corpus holds no operation inventory. Rather than pick one and hide the
   other, the gate takes `Operation | null` and returns `declarationChecksRan`, so a caller
   qualifying against no contract is told which two checks did not run instead of being handed a pass
   that concealed them. `sealProbeSet(probes, homeOperationOf)` takes a resolver, defaulting to one
   that resolves nothing, and `resolveHomeOperation(signature, interfaces)` is exported beside them
   so the match and the gate share one binding rule.

3. **Two reason codes beyond AC 4's list, both enforcing cells of Decision 2's own table.**
   `signature-present-on-canary` covers the table's "canary, and no signature" clause, which is a
   different fact from an incompatible route; `qualification-evidence-unverified` covers a
   `historical` record stating its oracle was not stable across revisions, and a
   `controlled-mutation` record stating its rollback was not verified. Both flags parse as `false` on
   purpose — a route that cannot record its own unmet precondition cannot be audited — so the gate is
   where they are read. AC 4 says the closed set "covers" its list rather than equals it, so the set
   is closed at more codes than AC 4 lists rather than at exactly its list. The code review added
   three more for the same reason, each closing a way a signature could qualify and then discriminate
   nothing: `signature-observable-channel-not-response-side`, `condition-selector-key-undeclared`, and
   `condition-disjunct-without-response-channel`. The shipped set is nineteen, every one of them is
   reachable by some probe, and `tests/score/qualification.test.ts` exercises each.

4. **The probe document gains two `$defs`, and the boolean discriminator loses its flip witness.**
   `EvidenceChannel` arrives with `observableChannel` and `ProbeInputBindingChannel` with the
   injection above, so `publish.test.ts`'s per-document `$defs` count for `probe` moves 5 -> 7.
   Separately, the two `expectedClean` branches are no longer shape-identical: `defectSignature` sits
   on the seeding branch alone, so a clean control with the discriminator flipped is missing a
   required key and a seeded probe flipped the other way carries an undeclared one. Both `const`
   occurrences therefore acquire an ordinary rejected mutant and the `#flip` witness pairing
   disappears; `mutant-generator.test.ts`'s case is rewritten to assert the stronger property rather
   than deleted.

5. **The measured census, transcribed rather than estimated.** Decision 12 asked for the real numbers
   once the real shape landed. `CENSUS_BY_DOCUMENT['probe']` 381 -> 508 and `CENSUS_TOTAL`
   2317 -> 2444, with `type` +55, `required` +16, `additionalProperties` +17, `minLength` +11,
   `const` +10, `enum` +6, `pattern` +5, `anyOf` +3, `propertyNames` +1, `oneOf` +2, and
   `minProperties` +1. Lower than Decision 12's projected 479 for the qualification union alone
   because the selector channel became a `$defs` entry rather than eight inlined copies, and higher
   than it because the signature itself is new weight the projection did not price.

6. **`serialize` is exported with defaults for its three recursion parameters.** `canonicalize` calls
   it with `('$', new Set(), 0)`; an outside caller passes the same two arguments `canonicalize`
   takes, so the quotation projection reads `serialize(value, artifactPath)` and no call site has to
   know about the recursion state.

7. **Seven probe reject cases, not the "new probe reject cases" the Code Map left uncounted.** The
   qualification record absent and its route outside the five; the selector carrying `{ captured }`
   and carrying `{ principal }` (AC 2's fixtures, both landing `anyOf` at the Zod path); the selector
   channel empty, which fixtures the injection from decision 1; the observable channel outside
   AD-26's seven; and a colon-spelled path template. Every one produces exactly one Zod issue, so
   none needs `issueCount`. `ARTIFACT_REJECT_CASES` 74 -> 81 and the corpus total 129 -> 136.

8. **The dev-corpus README narrows rather than losing a paragraph.** The qualified-probe dimension is
   still absent, and the reason is now Owed item 1 alone: the schema carries both halves qualification
   needs and the gate admits a probe only when they agree, but a probe cannot be scored until the
   trial reducer exists. `dev-corpus.test.ts`'s second case now asserts that pairing (`qualified-probe`
   followed by `Owed item 1`) rather than the old "Owed items 1 and 7", which the README no longer
   claims; the case count stays at four.

9. **A canary may carry seeded defects, and pre-flight will plan checks for them.** The gate does not
   reject a `canary` probe whose `defects` array is non-empty. AD-9 does not forbid it, Decision 2's
   table is silent on the cell, and `probe.ts`'s own comment explains why the `expectedClean: false`
   branch carries no maximum on `defects` — a canary indicts the fixture rather than seeding, so a
   minimum would make it unrepresentable, and a maximum was never the counterpart. Inventing a gate
   rule the architecture does not state is what the epic preamble forbids, so none was added. The
   consequence is recorded rather than left for a reader to find: `preflight/plan.ts:378-380` filters
   on `expectedClean` alone with no `probeClass` guard, so every defect a canary carries produces a
   `seeded-fault-fired` check, and with `manifestationWitness: null` that check is recorded as failed.
   A canary carrying defects therefore makes pre-flight assert something about a fault its own AD-9
   route makes no claim about. Nothing downstream of the score side misreads it — a canary carries no
   signature, so the witness match never runs on it, and AD-7 excludes canaries from the dominance
   vector — so the cell is undecided with a live pre-flight consequence rather than undecided and
   inert. Whoever revisits AD-9's canary route owns it.

10. **The qualification gate is syntactic, and one degenerate signature survives it by design.** A
    condition can be true of every conformant response without naming a sent-side channel, without a
    disjunct, and without an illegal operand: `existence` over
    `/interactions/observed/response-body/ok`, where `ok` is a declared `requiredKey` of the home
    operation's response descriptor. It qualifies with zero failures, and the match then reports
    `matched` on a finding citing the observation where the system behaved correctly — the catch rate
    1.00 by construction, arrived at honestly. Every rule the gate has is satisfied, because the
    condition really does examine what came back; it is degenerate for a different reason, which is
    that the contract has already guaranteed the answer.

    The narrow syntactic rule that closes it — reject a bare `existence` whose sole operand names a
    declared required key with a one-token tail — is sound and blocks nothing real, since the
    legitimate spelling for "the endpoint stopped returning `ok`" is `absence`. It is not added,
    because it closes one spelling out of an open class and would read as closing the class.
    `equality(/interactions/observed/response-body/ok, false)` against an implementation that always
    returns `ok: false` is the same defect with no syntactic tell at all, and no analysis over the
    expression alone reaches it.

    What does reach the whole class is empirical rather than syntactic, and the architecture already
    ships its analogue one artifact over: `preflight/reduce.ts:260-274` fails a check when AD-10's
    manifestation witness resolves `true` on a clean leg, which is exactly "your discriminator is
    satisfied by correct behaviour", answered by observation. AD-40's `defectSignature` has no such
    check because nothing yet evaluates a signature against a clean leg. That check is the mechanism
    that closes the class, it is pre-flight work rather than score work, and it is outside every story
    epic 7 declares. Story 7.9 is where it first becomes observable, since that is the first point a
    corpus signature meets a pre-flight run; whoever adds a probe to `corpus/dev/` inherits the
    question with it.

    So the stopping point is stated rather than implied: the gate closes every degeneracy visible in
    the expression's own structure, and it does not close degeneracy that depends on what the
    contract declares or on what the implementation actually returns.

## Design Notes

**The signature is rooted at a reserved step identifier, not at a fourth pointer grammar.** AD-40
requires the condition's predicate to be "rooted at the selected observation rather than at a step
identifier", and the shipped `Expression` addresses evidence only through `InteractionPointer`,
which is rooted at `/interactions/{stepId}/`. Rather than mint a channel-rooted pointer — a third
spelling of fragments `pointer.ts` and `plan-index.ts:14-19` already spell twice — the signature
roots every pointer at the literal identifier `observed`:

```
/interactions/observed/response-status
/interactions/observed/response-body/error/code
```

`observed` is a fixed reserved word, so no contract-local choice reaches the corpus and the three
failures AD-40's withdrawn AD-26 citation carried stay closed. `qualifyProbe` rejects any pointer
whose step segment is not `observed`, which makes contract-independence a checked property rather
than a claim. Evaluation is the shipped path with no adapter: `makeResolveOperand({ observed:
observation }, {})`, `makeWitnessPointerDenotesCollection(homeOperation)`, `resolveCheck`.
`tests/preflight/fixtures/observations.ts:362-369` is the working precedent — a live `Expression`
rooted at a synthetic non-plan leg id that parses and resolves.

`observed` is a legal `Identifier` and nothing in `src/` reserves it, so a contract may declare a
step by that name. The design is safe because the resolver map is built fresh with exactly one key
and never merged with a plan's observations — that is a stated invariant, not an accident.
`compile/sensitivity-witness.ts:287-334` exists for the same collision one level in and throws
`malformed-operator-expression` on it.

**Why the probe-side selector has no ordering clause.** An ordinal over the home operation's own
observations would be contract-independent and perfectly fillable, so the honest reason is not that
the field could not exist. It is that no corpus signature needs it: a state-corruption defect that
only fires on a second call is already expressible as a manifestation predicate over any single
observation, and AD-40's mapping is per probe rather than per call sequence. What would reopen it is
pair-defect signatures across the monotonic sequence, the future need `witness-evidence.ts:70-76`
already records.

**Golden example — the two-observation record that makes `missed` reachable.** One probe seeding a
500 on a malformed title, two observations of `POST /notes`, one finding:

```
obs-1  sequence 1  callInputs.body.title = 42   responseStatus 400   (correct rejection)
obs-2  sequence 2  callInputs.body.title = 42   responseStatus 500   (the defect fired)
selector:  body.title = { matcher: 'type-violating' }   -> both are candidates
condition: equality(/interactions/observed/response-status, 500)
                                                -> T = {obs-2}, F = {obs-1}, U = {}
finding F-1 (defect, probeId PX-1) cites obs-2  -> matched
finding F-1 cites obs-1 instead                 -> unwitnessed-claim
no defect finding filed                         -> manifested-unclaimed
both titles well-formed strings instead         -> C = {}, so not-triggered
```

Permuting the array changes none of the four results and none of the returned identifier orders.
Reversing the two `sequence` values changes no result and no identifier set; the returned order
follows the new sequence. A first-match scorer would flip `matched` to `manifested-unclaimed` on
either, and these fixtures pin that the flip does not happen. The probe id is fixture-local rather
than `P-001`, which belongs to the retracted worked chain Story 7.9 regenerates.

**Two separate claims about the version bump, which must not be read as one.** The `schemaVersion`
*number* is a fixture-data edit and nothing detects a missing one: `probe.ts` has no version of its
own, `schemaVersion` arrives through `...lineageFields` as `z.int().min(1)` rather than
`z.literal(1)` (`lineage.ts:24`), there is no migration registry, and the published schema is
byte-identical for a v1 and a v2 probe. The *break* is real and runtime-visible:
`src/application/preflight.ts:48-54` runs `Probe.array().safeParse` on caller-supplied probes, so
two new required fields reject every existing caller's corpus. The bump number lives in three
fixture sites — `artifact-fixtures.ts:379`, `:395`, and `tests/preflight/fixtures/observations.ts:345`
— and the discipline behind it is the reviewer's, not the gate's.

## Verification

**Commands:**
- `npm run generate:schemas` -- expected: exactly `schemas/probe.schema.json` changes
- `npm run generate:dev-corpus` -- expected: `corpus/dev/README.md` and `index.json` change together
- `npx vitest run tests/score tests/schemas tests/compile tests/preflight tests/architecture` --
  expected: green while iterating. `tests/compile` and `tests/preflight` are not optional: this story
  edits `expression-legality.ts`, `reachability.ts`, `interface-inventory.ts`, and
  `tests/preflight/fixtures/observations.ts`
- `npm run validate` -- expected: green, including `check:schemas`, `check:corpus`, `check:boundary`,
  `check:ad5-registry`, and the 90% coverage floor

## Suggested Review Order

1. `src/core/schemas/defect-signature.ts` and `probe-qualification.ts` -- the two new declarations
2. `src/core/schemas/probe.ts` and the ledger entries -- what the schema enforces and what it does not
3. `src/core/compile/expression-legality.ts` and `reachability.ts` -- the extractions, whether the
   probe-side pass matches the contract-side one field for field, and the `tests/compile/` tripwires
4. `src/core/score/qualification.ts` -- the gate and its closed reason set
5. `src/core/score/witness.ts` -- the partition and the candidate rules, and that no fault is caught
6. `src/core/score/quotation.ts` -- the per-channel projection, and that no verdict reads it
7. `tests/score/witness.test.ts` -- the full partition table, the citation triad, both permutation
   families
8. fixtures across two lists, `tests/schemas/published/corpus.ts`, moved counters, dev-corpus

## Story Review Record

**Round 1 — peer Claude Code session, spec before implementation.** 11 HIGH, 12 MEDIUM, 7 LOW, each
verified against shipped source rather than against the spec text. Verdict: not ready, with H1 and H4
changing what gets built.

**Round 2 — same session, re-verify against the rewrite.** Four round-1 HIGHs fully closed and seven
closed in substance, with 6 HIGH, 12 MEDIUM, 4 LOW new — two of the round-1 fixes had introduced
defects at their own boundaries, and one named the wrong field in shipped code. Verdict: not ready,
blocking on the partition (R1, R2), the legality pass's wrong field and missing reachability check
(R3), and the undefined quotation procedure (R4). A late addendum upgraded the fault disposition to
blocking (R8), making five. All five are closed above in Decisions 10, 6, 17, and 5; every MEDIUM
and LOW is folded into the Code Map, the Decisions, or Verification. Round 2 also confirmed nine
constructions as correct and cleared the strictness, byte-equality, and required-key walks against a
nested union, all listed under KEEP in the Spec Change Log.

**Round 3 — same session, final verify.** Verdict: ready for development. All five blockers verified
closed against source, including a full walk of the partition table's input space and a chase of all
four plain-`Error` sites in `resolveCheck` confirming that banning `{ referenceSet }` closes every
one of them, leaving exactly the two `RuntimeFault`s Decision 5 lets propagate. One MEDIUM and two
LOWs were raised and are fixed above: Decision 17 now names Story 7.7 as owing a third Invalid-rung
condition rather than leaving the quotation invalidation ownerless inside the epic; Decision 10 says
"totally ordered" rather than "disjoint", since rows 2 and 3 deliberately overlap; Decision 6's pass
list now names the `ordering`-over-`call-inputs` rule beside `OPERAND_LEGALITY`; and the matrix
preamble accounts for all 23 rows. The review also corrected one citation: ADR-009 fixes the
identifiers-govern split, and `sealed-run-record.ts:32` is what places the invalidation at ingest.

## Dev Agent Record

`npm run validate` green end to end: build, typecheck, lint, check:docs, check:doc-invocations,
check:shareable, lint:spine, check:vectors, check:schemas, check:ad5-registry, check:ad28-registry,
check:ad31-table, check:layers, check:lineage, check:boundary, check:corpus, check:website-deps,
test:coverage. 92 test files, 3146 tests, 0 failures. Coverage 96.74 percent statements, 92.05
percent branches, against the ninety-percent `core/` floor. Those are the post-review numbers; the
pre-review run was 3127 tests at 96.67 / 92.02, and the nineteen tests added since are the code-review
rounds', listed in the Implementation Review Record. `npm run generate:schemas` changed
exactly one file (`schemas/probe.schema.json`); `npm run generate:dev-corpus` regenerated
`corpus/dev/README.md` and `corpus/dev/index.json` together, and `check:corpus` confirms the 23
committed corpus files match the builder byte for byte.

### Moved counters, before -> after

Nine pinned sites moved. Two the Code Map named were checked and did not move, recorded here so a
later reader does not go looking for a change that never happened.

| Site | Before | After |
| --- | --- | --- |
| `keyword-mutation.test.ts` `CENSUS_BY_DOCUMENT['probe']` | 381 | 508 |
| `keyword-mutation.test.ts` `CENSUS_TOTAL` | 2317 | 2444 |
| `keyword-mutation.test.ts` `CENSUS_BY_KEYWORD` | `type` 1019, `required` 170, `additionalProperties` 199, `minLength` 91, `const` 54, `enum` 58, `pattern` 156, `anyOf` 128, `oneOf` 11, `propertyNames` 29, `minProperties` 1 | 1074, 186, 216, 102, 64, 64, 161, 131, 13, 30, 2 |
| `differential.test.ts:33` reject-corpus total | 129 | 136 |
| `differential.test.ts` inject-entry walk | 25 | 26 |
| `published-rejection.test.ts:85-88` | 55 / 74 / 129 | 55 / 81 / 136 |
| `published-rejection.test.ts:205` accept census | `12 + 4 + 6 + 3` (25 listings, 19 distinct) | `12 + 4 + 5 + 6 + 3` (30 listings, 20 distinct) |
| `publish.test.ts:212-213` ledger split | 25 inject / 16 not-expressible | 26 / 17 |
| `publish.test.ts` per-document `$defs` count for `probe` | 5 | 7 |
| `constraint-ledger.test.ts:106-108` bare literal | `arityEntries.length + 4 + lineageCarriers.length + 2` | `+ 6 +` |
| `constraint-ledger.test.ts:170-182` not-expressible `it.each` | 8 ids | 9 ids |
| `artifact-registry.test.ts` `CALLER_KEYED_CONTROL_MAPS.probe` | 2 addresses | 3 |
| `eval-contract.test.ts:311` probe `WitnessInputs` `$ref` count | 2 | 2, unmoved |
| `artifact-reject-fixtures.test.ts:42` one Zod issue per case | no `issueCount` on any probe case | unmoved; all seven new cases raise exactly one issue |

The Code Map predicted the `it.each` at `constraint-ledger.test.ts:170-182` would go from 8 ids to
10. It went to 9, because the second new ledger entry became an `inject` rather than a
`not-expressible` one (decision 1 above).

### File List

Source:

- `src/core/schemas/defect-signature.ts` -- NEW: `OBSERVED_STEP_ID`, `ProbeBindingValue`,
  `PROBE_BINDING_CHANNEL_NON_EMPTY`, `ProbeBindingChannel`, `ProbeInputBinding`, `ProbeStepSelector`,
  `DiscriminatingCondition`, `DefectSignature`
- `src/core/schemas/probe-qualification.ts` -- NEW: `QUALIFICATION_ROUTES`, `QualificationRoute`,
  `ProbeQualification`
- `src/core/score/qualification.ts` -- NEW: `QUALIFICATION_FAILURES`, `qualifyProbe`,
  `resolveHomeOperation`, `sealProbeSet`
- `src/core/score/witness.ts` -- NEW: `PROBE_WITNESS_RESULTS`, `PROBE_REGEX_MATCH_STEP_BUDGET`,
  `matchProbeWitness`, `mapFindings`
- `src/core/score/quotation.ts` -- NEW: `projectChannel`, `quotationWitnessed`, `auditQuotation`,
  `reconstructDetection`
- `src/core/schemas/probe.ts` -- `qualification` on both branches, `defectSignature` on the seeding
  branch, `.meta()` description rewritten
- `src/core/schemas/plan.ts` -- `LiteralBindingValue` and `MatcherBindingValue` exported individually
- `src/core/schemas/constraint-ledger.ts` -- `defect-signature-required` (not-expressible) and
  `probe-binding-channel-non-empty` (inject)
- `src/core/score/bindings.ts` -- `deepEquals` and `jsonTypeOf` exported
- `src/core/compile/expression-legality.ts` -- `walkExpression` exported; per-`Expression` entry
  points `checkExpressionOperandLegality`, `checkExpressionRegexConstructs`,
  `checkExpressionQuantifierNesting`, `checkExpressionQuantifierOverNonCollection`
- `src/core/compile/reachability.ts` -- `checkExpressionBoundElementScope`,
  `forEachExpressionPointer`, `checkExpressionEvidenceReachability`,
  `evaluateReachabilityAgainstOperation`; `evaluatePointerReachability(pointer, index)` keeps its
  pinned signature
- `src/core/compile/interface-inventory.ts` -- `operationSignature` extracted
- `src/core/canonical/canonicalize.ts` -- `serialize` exported with defaults for its three recursion
  parameters

Generated, never hand-edited:

- `schemas/probe.schema.json`
- `corpus/dev/README.md`, `corpus/dev/index.json`

Scripts and prose:

- `scripts/dev-corpus-target.ts` -- the qualified-probe absence narrows to Owed item 1

Tests and fixtures:

- `tests/score/qualification.test.ts`, `tests/score/witness.test.ts`, `tests/score/fixtures/probe-witness.ts` -- NEW
- `tests/schemas/fixtures/artifact-fixtures.ts` -- five probes across two lists,
  `QUALIFICATION_ROUTE_FIXTURES`, `schemaVersion` 1 -> 2
- `tests/schemas/fixtures/artifact-reject-cases.ts` -- seven new probe reject cases
- `tests/schemas/published/corpus.ts` -- `seedsOf('probe')` taught the second list
- `tests/preflight/fixtures/observations.ts` -- `qualification`, `defectSignature`, `schemaVersion`
- `tests/schemas/ad5-admissions.test.ts` -- admissions 10 and 13
- `tests/schemas/artifacts.test.ts` -- route-fixture coverage beside the class coverage
- `tests/schemas/artifact-registry.test.ts`, `tests/schemas/constraint-ledger.test.ts`,
  `tests/schemas/publish.test.ts`, `tests/schemas/published/differential.test.ts`,
  `tests/schemas/published/keyword-mutation.test.ts`,
  `tests/schemas/published/published-rejection.test.ts`,
  `tests/schemas/published/mutant-generator.test.ts` -- the moved counters and the discriminator
  witness
- `tests/architecture/dev-corpus.test.ts` -- case 163's second absence

## Implementation Review Record

**Round 1** -- an independent peer Claude Code session against the finished working tree, briefed
adversarially, given the three prior spec-review rounds as context for what had already been attacked,
and told to verify against shipped source rather than against the story's prose. Eighteen findings:
2 HIGH, 8 MEDIUM, 8 LOW, each with a reproduction run against the real fixtures. All eighteen
addressed in the same pass, nothing deferred; `npm run validate` green before and after (3127 tests
before, 3138 after).

1. **HIGH -- the channel rule had a bypass that reinstated the defect AD-40 exists to close.**
   `checkChannels` returned early on `channels.has(signature.observableChannel)` before the
   two-channel test ran, so a signature declaring `observableChannel: 'call-inputs'` passed on a
   predicate whose only pointer was a `call-inputs` pointer. Reproduced: that probe qualifies clean,
   the condition then resolves `true` on the observation where the system correctly returned 400, and
   any defect finding citing either observation reports `matched` -- catch rate 1.00 by construction,
   arriving through the field added to close it. Decision 14 says the opposite verbatim. Fixed twice
   over: `checkObservableChannel` rejects a non-response-side `observableChannel` outright under the
   new code `signature-observable-channel-not-response-side`, and `checkChannels`'s early return is
   guarded on the same set so the rule holds inside that function on its own.
2. **HIGH -- the default `sealProbeSet` path skipped the two declaration-dependent checks and then
   discarded the evidence that it had.** `homeOperationOf` defaulted to `() => null`, so the path a
   caller reaches by writing less was the unchecked one, and `SealedProbeSet.admitted` was
   `readonly Probe[]`, which drops `declarationChecksRan` at the seal. Reproduced on a signature whose
   pointer addresses an undeclared response-body key: rejected with an inventory, admitted without one,
   and the match then reports `not-triggered`, which Story 7.5 maps to `confirmed` -- the silently
   passing run on a signature that was never writable. Fixed both halves: the resolver is required, and
   `admitted` carries `{ probe, result }` like `rejected` does, so a half-checked admission is
   distinguishable from a full one.
3. **MEDIUM -- `TEXT_CHANNELS` was applied to the predicate's pointers and never to
   `observableChannel`.** An `api` signature declaring `stdout` observable qualified clean.
   `condition-text-channel-on-api` now fires on the declaration too. Knock-on recorded rather than
   hidden: the pre-existing pointer test declares `stdout` observable AND points at `stdout`, so it
   now reports that code twice; its expectation was widened rather than its fixture narrowed, and a
   separate case isolates the declaration half with response-side pointers.
4. **MEDIUM -- `admissibleRoutes` handed both routes to a seeding-class probe that seeds nothing.**
   Both source rules read "every seeded source is X", vacuously true of an empty array in both
   directions, so a `defect`-class probe with `defects: []` qualified under `historical` and under
   `controlled-mutation`, and a corpus author could attach either route's evidence to a defect that
   does not exist. The `default:` branch now returns `[]` on an empty array.
5. **MEDIUM -- `unwitnessedFindingIds` was ordered by array position**, the one output the module left
   in insertion order while `witnessObservationIds` was deliberately re-sorted into partition order to
   hold the same line. Not an AC violation: AC 7 names the observations array only. It is the module
   contradicting its own stated invariant, and `findings` carries no ordering field, which is the same
   situation `sequence` was added to fix for observations. `unwitnessedFindingIds` and all four
   `mapFindings` buckets are now sorted by `findingId`, with a third permutation family testing it.
6. **MEDIUM -- the gate never inspected `condition.selector.inputBinding` at all.** A selector binding
   a key the home operation declares nowhere matches no observation, so every candidate is filtered
   out, the probe reports `not-triggered`, and a typo becomes a silently passing run: the same shape
   the predicate's writability check exists to close, reached through the selector. New code
   `condition-selector-key-undeclared`, declaration-dependent, mirroring
   `checkUndeclaredMandatoryInput`'s predicate exactly. Deliberately stricter than the contract side:
   AD-4 makes the contract-side rule strict-only because a contract may be compiled either way, and
   AD-9's "an unqualified probe cannot enter a sealed set" states one bar with no lenient mode.
7. **MEDIUM -- the replacement discriminator assertion was a tautology, and the flip path went
   globally dead.** `mutantFor` with the default suffix matches `mutant.id === pointer` exactly, so
   `expect(mutant?.id.endsWith('#flip')).toBe(false)` could never fail. Worse, `probe.schema.json`
   carried the only two boolean `const`s in the twelve documents and both now kill ordinary mutants,
   so roughly 28 lines of flip-witness synthesis in `mutant-generator.ts` were exercised by nothing
   and the coverage floor could not see it (`vitest.config.ts` scopes thresholds to `src/core/**`).
   The tautology is deleted. The generator's fallback was kept rather than removed -- it is correct and
   general, and a future artifact declaring two branches identical but for a boolean discriminator
   would need it -- and is now driven against a synthetic two-branch document that has exactly that
   shape.
8. **MEDIUM -- the dev-corpus regex could not check the claim in its own label.**
   `/qualified-probe[\s\S]*Owed\s+item 1/` neither excluded "Owed item 7", still present in the next
   absence paragraph, nor anchored on the absence sentence; the old regex still matched the new README,
   so nothing had forced the change. Now
   `/qualified-probe\s+dimensions\s+are\s+absent[\s\S]*trial\s+reducer[\s\S]*Owed\s+item 1/`.
9. **MEDIUM -- Decision 10's fifth row was untested.** Both `unwitnessed-claim` cases ran with a
   non-empty satisfying set, while the I/O matrix's false-claim row says "whether `T` is empty or not".
   The code was right; the coverage was not. New case with one refuting candidate and a claim on it.
10. **MEDIUM -- the selector's key-presence rule and its `{ matcher: 'any' }` branch were uncovered.**
    Two of Decision 4's three inherited rules had tests and the third did not, because the fixture
    selector uses `type-violating`. New case binding `{ matcher: 'any' }` against an observation that
    does and does not carry the key.
11. **LOW, eight of them, all confirmed and all fixed.** The dead `ExpressionVisitor` export;
    `evaluateReachabilityAgainstOperation` and `quotationWitnessed` exported with no importer, both
    un-exported (`projectChannel` and `reconstructDetection` stay exported, since the tests drive them
    directly); `publish.test.ts`'s "25/16 split" comment against a 26/17 assertion; the constraint-ledger
    title's "seven besides" where the convention gives six; admission 10's dead `??` fallback on a
    fixture field that is never nullish; a `witness.test.ts` comment saying both observations land in
    `U` beside assertions that say `F` and `U`; the empty-admissible-routes diagnostic blaming the class
    pairing for a mixed-source array, now routed through `emptyRouteReason`; and the Code Map citing
    `resolution.ts:434` for a throw that is at `:433`.

Two of the fixes tripped `check:boundary`, which fails on the word `Decision <n>` in a `src/` comment:
the new doc comments on `checkSelectorKeys` and `checkObservableChannel` cited Decisions 6 and 15.
Both rewritten to name the rule rather than its decision number, which is what the boundary rule is for.

**Round 1 clean results, stated because a silent dig target reads as an unchecked one.** The reviewer
confirmed, with its own reproductions rather than from the story: the implemented first-match order is
exactly Decision 10's seven rows, total and disjoint over the whole input space with no input falling
through; no `RuntimeFault` is caught anywhere in the new code, and all four plain-`Error` sites in
`resolveCheck` are genuinely closed by the `{ referenceSet }` ban, each by a different mechanism, with
`:505` closed because `SetOperand` admits no pointer member at all; the three compile extractions are
behaviour-preserving, verified by diffing each file's string-literal multiset old against new -- every
pre-existing literal survives unedited, and all three named tripwires hold, including `rubrics.test.ts`'s
byte-comparison of two reason tails; `walkExpression`'s superset claim was confirmed mechanically by
driving all 16 `Expression` op kinds through it and through the three narrower walkers; `serialize`'s
default `ancestors: Set<object> = new Set()` is a default-parameter expression evaluated afresh per
call, so no state is shared; and no existing expectation was loosened anywhere in the change -- every
moved counter is arithmetically explained by its cause, and the eleven per-keyword census deltas sum to
exactly the +127 the document total moved by.

One consequence the reviewer surfaced that is correct as built and was not stated: `homeOperationIds`
is built from every home-operation observation including `baseline` ones, while the satisfying set can
only hold `evaluator-chosen` ones, so a defect finding whose only home-operation citation is a baseline
observation is guaranteed `unwitnessed-claim`. That follows Decision 10's "cited observations touch the
home operation" exactly, and a mixed citation still resolves `matched`.

One aside was examined and declined rather than fixed: a `canary` probe carrying a non-empty `defects`
array qualifies with zero failures. AD-9 does not forbid a canary seeding defects, Decision 2's table
is silent on the cell, and `probe.ts`'s own comment explains why the `expectedClean: false` branch
carries no maximum on `defects`. Nothing downstream misreads it either -- a canary carries no signature,
so the witness match never runs on it, and AD-7 excludes canaries from the vector. Inventing a gate rule
the architecture does not state is the move the epic preamble forbids, so the cell is recorded here as
examined rather than closed by a new code.

**Round 2 — the same peer, narrowed re-verify against the fixes.** All eighteen round-1 findings
verified closed on the reviewer's own reproductions rather than on this record's description. The
fixes introduced four new findings — 2 MEDIUM, 2 LOW — which is what a second round exists to catch;
all four are closed here, and `npm run validate` is green again (3146 tests, 96.74 percent statements,
92.05 percent branches).

1. **MEDIUM — the selector-key fix and the code it protects used two different definitions of
   "declared".** `checkSelectorKeys` read `requiredKeys ∪ permittedKeys`; `selectorAdmits`'s
   `type-violating` branch reads `requestShape[channel].types[key]`, where `interface.ts:53` states a
   missing key means "not declared". Those are different sets, and a key may be permitted while
   carrying no declared type. Reproduced: a `type-violating` binding on such a key qualifies clean,
   then fails closed on every observation, so every candidate is filtered out and the probe reports
   `not-triggered` — byte for byte the outcome the new code was added to prevent, reached through the
   other definition. `checkSelectorKeys` now applies the type-map rule as a second condition scoped to
   the one member that reads it; `{ literal }` and `{ matcher: 'any' }` never read `types` and
   deliberately get no rule.
2. **MEDIUM — the channel rule is syntactic, so an always-true disjunct still qualified.** Reproduced
   with zero failures: `observableChannel: 'response-body'` and
   `any(existence(call-inputs/body/title), existence(response-body/message))`. Two channels, one
   response-side, so the rule passes — while the first disjunct is true of every candidate, because
   the selector's own binding guarantees that key is present on anything that became a candidate at
   all. The condition then resolves `true` on the observation where the system correctly returned 400
   and a finding citing it reports `matched`: catch rate 1.00 by construction, the same class as
   round-1 finding 1, one level in. Closed with a new reason code,
   `condition-disjunct-without-response-channel`, scoped to `any` and nothing else: only a
   disjunction lets one operand carry the verdict alone, and under `all` a sent-side conjunct is the
   legitimate half of the two-channel conditions AD-40's wording exists to admit. Syntactic and
   decidable from the expression, rather than an attempt to decide what a predicate's truth depends
   on, which quantifiers make undecidable. The reviewer offered recording the gap instead; it was
   closed rather than recorded, because a gate whose whole purpose is to stop the catch rate being
   1.00 by construction cannot ship with a demonstrated input that makes it so. The first cut of that
   rule carried a false positive of its own, found and fixed before the next round rather than
   shipped: a bound-element pointer roots at no step identifier, so a disjunct made entirely of `@/`
   comparisons inside a quantifier over a response-body collection looked like it read nothing at all
   and was rejected. `channelsNamedBy` now takes the channel of the nearest enclosing quantifier's
   collection and a `@/` pointer contributes that, which is what it actually reads. A sent-side
   disjunct inside the same quantifier is still rejected, and both shapes are fixtured.
3. **LOW — the "two declaration-dependent checks" count was wrong at seven sites**, and at one of
   them wrong on substance: `checkSelectorKeys` is a third, and it catches a selector that matches
   nothing rather than a signature that was never writable, so a reader of `declarationChecksRan`
   would have underestimated what was skipped. All seven corrected.
4. **LOW — the doubled `condition-text-channel-on-api` assertion pinned a count, not a pair.** The two
   failures come from different checks and carry different artifact paths; the test now asserts both
   paths, so it says which check produced which.

Round 2 also confirmed, with its own runs rather than from this record: every route path still behaves
after the empty-defects rule (`gameability` and `canary` reach their fixed routes before the guard and
clean controls never reach the switch); the `artifactPath` decision to keep all three empty-route
details at `.qualification.route` is right, because splitting one code across two addresses is worse
for a caller building a rung table than one address with three details; sorting the `mapFindings`
buckets broke no insertion-order assertion; the new flip-path test genuinely drives
`mutant-generator.ts`'s synthesis block and cannot pass vacuously; the new dev-corpus regex fails
correctly under two independent mutations of the README where the old one failed under none; and no
`src/` comment cites a story, an epic, a story Decision, or the spine — the three surviving
"ADR-009 Decision 2" citations predate this story and are what `check:boundary` permits.

One shape both rounds left untested on both sides and neither changed: a signature selecting on a path
parameter that the contract does not list in `requestShape.path.requiredKeys`. The probe side now
rejects it and a strict-compiled contract binding the same key already fails
`undeclared-mandatory-input`, so the parity holds either way; no fixture exercises the path channel at
all, which is a fixture gap rather than a code one.

**Round 3 — the same peer, verifying the round-2 fixes.** Verdict: ship it. No new findings. The two
structural fixes were checked where they were most likely to break rather than taken on their
description.

`walkAnyNodes`'s traversal is correct on all four shapes, with the emitted artifact paths quoted from
real runs rather than reasoned about: an `any` inside a quantifier's predicate, inside a `not`, inside
another `any` (handled correctly in both roles), and one whose operands are literals only. No
`Expression` shape carrying an `any` escapes it — only five node kinds carry a sub-expression, and
`covers-by-key` carries two `Operand`s and two key strings rather than a nested one, so the walk's
`default` is exhaustive and stays exhaustive short of a grammar change. Path spellings are byte-equal
to `walkExpression`'s and `visitExpression`'s, including routing `not` through the same `forEach`
branch rather than an arity-1 special case.

The `@/` inheritance is sound and does not over-inherit, verified in three directions: a `@/`-only
disjunct under a response-side collection qualifies, the same shape with one sent-side disjunct is
still rejected, and a `@/`-only disjunct under a *sent-side* collection is still rejected — which is
what proves the inheritance is a test rather than a blanket pass. The structural reason unconditional
inheritance is right: a `@/` pointer resolves only against the bound element, `checkBoundElementScope`
guarantees one exists, and the bound element is by construction an element of the collection the
pointer names, so the channel it reads is exactly the collection's, always. The reviewer had built the
false positive independently before the addendum reached it and watched the pre-fix walker reject the
same input, so the fix is confirmed against a reproduction authored without knowledge of it.

Three of the four remaining always-true spellings were run and die on the channel rule before
`checkDisjuncts` is reached: `not(absence(call-inputs/...))`, `count-tolerance` over a sent-side
pointer, and `shape` over one. The `not` case is worth naming — an always-true subtree under a `not`
makes the condition always *false*, which is the `not-triggered` silent pass rather than the `matched`
one, and the channel rule catches it either way. A `for-any` or `for-all` over a response-side
collection whose predicate reads only `call-inputs` qualifies and resolves `matched`, but was examined
and cleared: the verdict is contingent rather than constructed, since the same signature returns an
empty satisfying set when the collection is absent, so the quantifier is a genuine statement about
what came back. Rejecting a quantifier whose predicate contains no `@/` pointer would block
"the response returned a non-empty collection", which has no better spelling in this grammar.

The R2-M1 parity was re-checked exhaustively rather than by sampling: `selectorAdmits` reads exactly
one declaration, `requestShape[channel].types[key]`, and only on the `type-violating` branch;
everything else it consults is runtime state of the observation. The gate's checks are a strict
superset of that with exact coverage of the one read that fails closed, so there is no fourth
divergence. One candidate was examined and deliberately left open: a `{ literal: v }` whose JSON type
contradicts a determinate declared type can only match a non-conformant observation, but nothing under
`core/compile/` compares a literal binding against a declared type either, selecting exactly the
non-conformant call is a legitimate authoring intent, and adding the rule probe-side would break the
parity the gate was built to hold.

One finding survives as decision 10 above rather than as a fix, on the reviewer's argument and against
the instinct that closed round 2's residual: `existence` over a declared required response key
qualifies clean and satisfies on correct behaviour. The narrow rule that closes it is sound and blocks
nothing real, and it was still declined, because it closes one spelling of a class whose other members
have no syntactic tell, and the mechanism that closes the class — a clean-leg evaluation of the
signature, by analogy to the shipped `manifestation-witness-clean` check — is pre-flight work outside
this epic. The gate's stopping point is now stated in the story rather than left for the next reviewer
to rediscover.

## Peer Review Record

Three post-implementation rounds against the finished working tree, all with one sibling Claude Code
session (`epic7-story4-bmad-code-review`, spawned into its own workspace for this story and kept alive
across the rounds so each one carried the previous one's context). No Codex. In-process subagents ran
alongside as an extra layer, not as a substitute: one produced the `tests/compile/` tripwire inventory
that the extraction audit was checked against.

| Round | Brief | Result |
| --- | --- | --- |
| 1 | Full adversarial review, seven named dig targets plus four nits I had already found, told to verify against shipped source rather than against the story | 2 HIGH, 8 MEDIUM, 8 LOW; all four nits confirmed, one related worry dismissed |
| 2 | Narrowed re-verify: confirm each fix on its own reproduction, then hunt what the fixes broke | 18/18 closed; 2 MEDIUM and 2 LOW introduced by the fixes |
| 3 | Verify the two round-2 structural fixes, attack the new traversal, hunt remaining false negatives | Ship it; no new findings, one residual recorded as decision 10 |

Every finding was addressed in the same pass it was raised. Nothing went to a later story, and nothing
went to `deferred-work.md`. The one item that is recorded rather than fixed — decision 10's degenerate
`existence` signature — is recorded because the fix that closes it closes one spelling of an open
class while the mechanism that closes the class is pre-flight work outside this epic; the reviewer
argued that position and the argument is reproduced in the round-3 entry rather than summarised away.

Two things the rounds were worth beyond the findings themselves. Round 2 existed to catch regressions
from round 1's fixes and caught four, two of them the same defect class the original finding named,
one level in — which is the pattern the three pre-implementation spec rounds had already shown twice
on this story. And round 3's independent reconstruction of the bound-element false positive, built
before it knew the fix existed, is stronger evidence than a confirmation of my own account would have
been.
