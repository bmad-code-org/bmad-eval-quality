---
title: 'Captured-value matchers and test-data bindings'
type: 'feature'
created: '2026-09-01'
status: 'in-progress'
baseline_commit: '0d6d5b09e0afc5a695350de585418f7efba15d2c'
review_loop_iteration: 3
context: [
  '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md',
  '{project-root}/_bmad-output/implementation-artifacts/epic-7-context.md',
  '{project-root}/_bmad-output/implementation-artifacts/7-2-a-monotonic-observation-sequence-and-declared-selector-cardinality.md',
]
---

# Story 7.3: Captured-value matchers and test-data bindings

Epic 7, story key `7-3-captured-value-matchers-and-test-data-bindings`. Closes owed item 3
(`ARCHITECTURE-SPINE.md:682-695`). Two breaking `schemaVersion` bumps under AD-11, two new AD-5
codes.

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `BindingValue` (`plan.ts:12-15`) admits `{ literal }` and `{ matcher: 'any' |
'type-violating' }` and nothing else. A `POST` returning a server-generated identifier followed by a
`GET` proving persistence cannot be written down: a literal hard-codes a resource the evaluator never
created, and `any` matches unrelated reads. The two critical-severity cross-user oracles (act as A,
read as B, must be denied or absent) need a step bound to a *principal*, which is neither a literal
(AD-19 forbids credential values in declarations) nor an earlier step's output (accounts are test
data provisioned outside the observation stream).

**Approach:** two more tagged members on `BindingValue` — `{ captured: <InteractionPointer> }` over
an earlier step's declared scalar output, and `{ principal: <name> }` — plus `TestData.principals`
and `TestData.resources` as valueless declarations keyed by name, the declared principal names
carried onto the sealed brief, two new AD-5 codes for the capture graph, one compile-time check
module, and two pure score-time reference functions built on Story 7.2's selection result.

## Boundaries & Constraints

**Always:** the union stays tagged with exactly four members and no untagged form; a principal name
is an opaque label carrying no account identifier, credential, or subject data (AD-18); `principals`
and `resources` are keyed by name and declare a kind, never a value (AD-19); the brief gains the
declared principal names and still carries no step identifier (AD-16), so `captured` renders as a
derived reference to the referenced step; AD-5's table takes three edits in the same diff as
`src/core/failure-codes.ts` — two new rows and two widened `Fires when` cells
(`unreachable-check-evidence`, `undeclared-mandatory-input`) — so `check:ad5-registry`'s
set-and-order equality holds at twenty-three; two breaking `schemaVersion`
bumps (eval-contract, sealed-evaluator-brief) with `generate:schemas` and AD-13's four checks in this
story; every existing literal `testData:` and `BindingValue` fixture across the repo still parses.

**Ask First:** none — every ambiguity is settled by construction in Design Notes, per the epic
preamble (`epics.md:529`).

**Never:** no AD-21 rung, ladder, or `--strict` wiring (Story 7.7); no probe-side selector change —
AD-40 forbids these two members in a sealed-corpus field and Story 7.4 owns the rejecting fixture; no
change to `selectObservations` itself; no third AD-5 code (FR4 fixes the registry at twenty-three
after this story); no new published document for the failure-code enumeration.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| captured happy path | `{ captured: '/interactions/write/response-body/id' }`, `id` declared `string`, referenced step matched one observation | binding resolves to that scalar | N/A |
| principal happy path | `{ principal: 'owner' }` with `owner` declared in `testData.principals` | compiles; brief carries `owner` in `principals` | N/A |
| capture cycle | any cycle over capture edges and `after` edges together that contains at least one capture edge | compilation fails | `binding-cycle` |
| non-body channel | captured pointer names any channel but `response-body` | compilation fails | `captured-channel-undeclared` |
| unresolvable capture | undeclared step, undeclared body key, tail longer than one segment, array index, or a declared type that is `object`/`array`/absent/`null` | compilation fails | `unreachable-check-evidence` |
| type mismatch | captured scalar declared `number`, bound parameter declared `string` | compilation fails | `unreachable-check-evidence` |
| undeclared principal | `{ principal: 'ghost' }`, `testData.principals` declares no `ghost` | strict compilation fails | `undeclared-mandatory-input` |
| duplicate principal name | two declarations of `owner` | unrepresentable: `principals` is keyed by name | N/A |
| absent at score time | captured pointer resolves `absent`, or its referenced step selected `none` | referencing step selects `{ result: 'none', matchedObservationIds: [] }` (AD-26: absent is an observation) | N/A |
| referenced step ambiguous | referenced step matched several under `exactly-one`/`at-most-one` | Story 7.2's named ambiguity, returned as data, no value resolved | N/A |
| referenced step `any` | referenced step declared `any`, matched several | lowest-`sequence` match, as `resolveTemporalAnchor` already does | N/A |
| candidate tuples | referencing step matched several observations differing only in call inputs | filtered by the step's own resolved bindings before the cardinality verdict | N/A |
| irreducible pair | two steps sharing an `operationId` and binding nothing | both still return `several`; a filter over zero bindings separates nothing | N/A |
| two principals, one operation | two steps binding the same key to different declared principals | both still return `several` — the record does not say which principal the harness used | N/A |
| indeterminate declared type | `type-violating` binding whose parameter type is absent or `null` | candidate filtered out; an indeterminate type cannot prove a violation | N/A |
| capture out of order | candidate's `sequence` is not strictly greater than the captured observation's | candidate filtered out; the step can select `none` | N/A |
| null observed channel | a binding names a key in a channel the observation recorded as `null` | the key is not present, so the candidate is filtered out | N/A |
| well-typed value on a `type-violating` step | observed value's JSON type equals the declared type | candidate filtered out; that call did not exercise the malformed-input behaviour | N/A |
| declared test-data resource | `testData.resources` non-empty | compilation fails, exactly as a `scopedResources` entry already does | `scoped-reference-resolves-forbidden` |

</frozen-after-approval>

## Code Map

**Schema**

- `src/core/schemas/plan.ts:5-15` -- `BindingValue` gains `{ captured: InteractionPointer }` and
  `{ principal: Identifier }`; import `InteractionPointer` from `./pointer.ts`. The JSDoc at `:5-11`
  describes a two-member union and must be rewritten: it is the one place a reader meets the grammar.
- `src/core/schemas/eval-contract.ts:114-117` -- `TestData` gains `principals` and `resources`, each
  `z.record(Identifier, z.strictObject({ kind: z.string().min(1) })).nullable()`, following
  `referenceSets`'s caller-keyed nullable record (`:159-164`). Keying by name makes a duplicate
  declaration unrepresentable; `null` versus `{}` keeps the absent-against-explicitly-empty
  distinction `ScopedResource`'s own comment (`:72-77`) depends on. `kind` stays opaque for the
  reason that comment already records: no AD supplies a value space, and inventing one is the
  unshaped-declaration defect in reverse.
- `src/core/schemas/sealed-evaluator-brief.ts:41-76` -- `principals: z.array(Identifier)`,
  non-nullable, empty legal, matching `scopedResources`'s reasoning at `:60-64`. The `.meta()`
  description at `:78-80` enumerates what the brief carries and must gain the field; that string is
  published bytes and moves the `sealed-evaluator-brief` census.
- `src/core/compile/interface-inventory.ts:48-75` -- `checkUndeclaredMandatoryInput` gains the
  value-side condition: a `{ principal }` naming no key of `testData.principals` fires the same
  `undeclared-mandatory-input` it already fires for an undeclared binding key.

**AD-5 registry**

- `src/core/failure-codes.ts:11-32` -- `binding-cycle` and `captured-channel-undeclared` inserted
  after `plan-exceeds-scripting-bound` (index 13), taking indices 14 and 15.
- AD-5's table -- two new rows at the same position, plus two widened `Fires when` cells:
  `unreachable-check-evidence` (`:223`) gains the binding site and the type-mismatch condition, and
  `undeclared-mandatory-input` (`:229`) gains "or a binding naming a principal it did not declare", since the shipped thrower
  fires on an undeclared binding KEY and the principal case has a declared key with an undeclared
  value reference. `scripts/check-ad5-registry.ts:96` parses the first column only, so both
  second-cell edits are free.
  `ARCHITECTURE-SPINE.md:217`'s "the other twenty" becomes "the other twenty-two".
- Seven stale "twenty-one" sites, not one: `src/core/failure-codes.ts:1`, `:9`,
  `src/core/compile/sensitivity-witness.ts:7`, `tests/schemas/failure-codes.test.ts:10` (a comment),
  `:13` (the test title) and `:14` (the assertion), `tests/schemas/ad5-admissions.test.ts:1`.
- `tests/schemas/ad5-admissions.test.ts` -- an `admits()` case per new code.
- `_bmad-output/shareable/eval-quality-architecture-spine.html` -- the spine renders byte-for-byte
  into this committed file and `npm run check:shareable` (inside `validate`) compares it. Run
  `npm run build:shareable` and commit, or `validate` fails on the table edit alone.

**Compile**

- `src/core/compile/bindings.ts` -- NEW. `checkBindingCycle` and `checkCapturedBindings`. Reuses
  `evaluatePointerReachability` (`compile/reachability.ts:167`) for the step, operation, body-key,
  and scalar-descent half only; the scalar determination, the one-segment tail rule, and type
  equality are this module's own. No topological sort exists in the repo yet, and
  `nested-temporal-clause` only doubles as the `after` graph's cycle guard
  (`tests/compile/scripting-bound.test.ts:305`), so the capture-graph walk is genuinely new code.
- `src/core/compile/compile.ts:73,88-89` -- split by registry position. `checkCapturedReachability`
  fires the shipped `unreachable-check-evidence`, whose registry rung is third, so it runs beside
  `checkEvidenceReachability` at `:73`; only `checkBindingCycle` and `checkCapturedChannel` run at
  the inserted position after `checkScriptingBound`. Running captured reachability late would let a
  lower-ranked code win on a contract carrying both defects and would falsify the module's own
  documented priority (`:6-14`). A multi-defect precedence test pins it.
- `tests/compile/compile.test.ts:46,367` -- the describe title pins "each of the 26 wired functions,
  in call order", and case 24 is cited by ordinal at `:367`. Two more checks make it 28, and every
  numbered case after `checkScriptingBound` (17) shifts by two.
- `src/core/compile/forbidden-inputs.ts:20-29` -- `checkScopedResourceReferences` reads
  `contract.scopedResources` first, then `contract.testData.resources`, each with its own message and
  artifact path. The second is spelled `EvalContract.testData.resources[${JSON.stringify(name)}]`,
  matching the one shipped precedent for a caller-keyed address
  (`interface-inventory.ts:69`), and the `undeclared-mandatory-input` principal message uses the same
  form so the two new paths agree with the one already in the tree.

**Seal and brief**

- `src/core/seal/derived-reference.ts:22,143-177` -- the local `BindingValue` alias widens
  automatically, so `renderBindingValue`'s final `return ... entry.value.literal` becomes an
  unguarded read. It becomes an exhaustive dispatch, with a rendering per form per escalation level
  (Design Notes carries the table). `isTypeViolating` (`:114-116`) is already correct on the new
  forms.
- `src/core/seal/seal.ts:83-134` -- `principals: [...names].sort()`, matching `safetyLimits`
  (`:124-126`) rather than `sortedByKey`: equal strings are interchangeable, so there is no key to
  guard.
- `src/core/seal/seal.ts:96` -- the brief's `schemaVersion: 1`, the one place a brief version is
  written down, moves to 2 with its comment. `tests/seal/seal.test.ts:83-85` pins it, and `:83`'s
  test title carries the number too.

**Score**

- `src/core/score/binding-order.ts` -- NEW. `bindingOrder(plan)`: Kahn tiers over the capture graph,
  ascending `stepId` within a tier.
- `src/core/score/bindings.ts` -- NEW. `resolveCapturedValue(pointer, index, observations)` and
  `selectWithBindings(step, observations, index, resolved)`, where `index` is a `PlanIndex`
  (`seal/plan-index.ts`) supplying the operation's declared request types and `resolved` is the map
  `bindingOrder`'s tiers fill in. That map is the interface between the two new modules and needs a
  richer value than `ResolvedValue` (`evaluate/resolved-value.ts:9-11`), which is
  `JsonValue | ABSENT` and has nowhere to put the source observation, its `sequence`, or the
  named-ambiguity case: `{ status: 'resolved', value, observationId, sequence } | { status: 'absent' }
  | { status: 'ambiguous', matchedObservationIds }`, keyed by binding site (step id, transport
  channel, parameter key), since one step can carry several captured bindings. Wraps `selectObservations`
  (`score/selection.ts:58`) and reuses `walkTail` (`evaluate/evidence-resolution.ts:39`).
  `channelRoot` (`evidence-resolution.ts:75`) is module-private and must be exported rather than
  re-spelled.
- `src/core/score/selection.ts:51-57` -- the shipped JSDoc points at owed item 3 as unfinished and
  calls `irreducibleCollisionPair` "distinguishable only by input binding", which is false: that
  fixture's two steps bind nothing at all (`tests/seal/fixtures.ts:357-381`). The paragraph is
  corrected as well as redirected — candidate-tuple resolution now lives in `selectWithBindings`,
  and that fixture stays undisambiguated because there is nothing to filter on. Same obligation
  `epics.md:553` put on 7.2's `Observation` JSDoc.

**Fixtures carrying `testData:`** (five literal sites, four files)

- `tests/schemas/fixtures/relevance-contracts.ts:73` and `:381-384` (the second inside
  `populatedContract`, the eval-contract accept fixture, `schemaVersion` at `:117`)
- `tests/schemas/fixtures/gate-c-contract.ts:838`
- `tests/coverage/fixtures/satisfaction-contracts.ts:478` (the dev-corpus seed, `schemaVersion: 1` at
  `:27`; `tests/coverage/fixtures/corpus.ts` spreads from it and needs no edit)
- `tests/preflight/fixtures/observations.ts:302`
- `tests/coverage/corpus.test.ts:310-333` -- a `toStrictEqual` over every corpus contract's
  `testData` against the seed's; a snapshot over exactly the field this story changes

**Fixtures carrying a brief literal**

- `tests/schemas/fixtures/artifact-fixtures.ts:646-674` (`sealedEvaluatorBriefFixture`,
  `schemaVersion` at `:647`)
- `tests/seal/scripting-audit.test.ts:23-50` (`minimalBrief`)
- Spread-from-valid sites need no field: `tests/seal/seal.test.ts:375-402`,
  `tests/schemas/artifacts.test.ts:229-245`

**AD-13 corpus and pinned counters**

- `tests/schemas/fixtures/reject-cases.ts:43` (`REJECT_CASES`, 46) and
  `artifact-reject-cases.ts:867-915` (the brief's four cases, `ARTIFACT_REJECT_CASES` 72)
- `tests/schemas/published/published-rejection.test.ts:81-88` pins 46, 72, and 118 in one `it` whose
  title carries the 118; `differential.test.ts:27-34` re-pins the total and carries the `46/72/118`
  comment. `published-rejection.test.ts:127-136` requires `errorParams` on any case whose keyword is
  `required`, `additionalProperties`, or `propertyNames`, and pins the count as "eleven today".
- `tests/schemas/published/keyword-mutation.test.ts:120-157` -- `CENSUS_BY_DOCUMENT`
  (`eval-contract` 727, `sealed-evaluator-brief` 98, the latter read again at `:250-254`),
  `CENSUS_BY_KEYWORD`, `CENSUS_TOTAL` 2279; the "727" also appears in prose at `:28-31`.
- `tests/schemas/published/keyword-mutation.test.ts:222-245` -- the real cost of the two schema
  changes: deleting ANY new keyword occurrence must flip some corpus member's verdict. Every new
  branch's `type`/`required`/`additionalProperties` and every new `pattern`/`minLength` needs a
  killing reject case, which is more than the four the acceptance criteria name.
- `tests/schemas/fixtures/reject-cases.ts:366-386` and `tests/schemas/plan.test.ts:27-33` -- both pin
  a Zod issue path against a two-branch `anyOf`; four branches change ajv's error set and may change
  the issue count.
- `tests/schemas/artifact-registry.test.ts:230-249,284` -- `CALLER_KEYED_CONTROL_MAPS` is an
  exhaustively pinned allowlist asserted with `toEqual` in both directions, so the two new records
  add `/properties/testData/properties/principals/anyOf/0` and `.../resources/anyOf/0` or
  `validate` fails. The narrative comment at `:212-225` counts declarations and addresses in prose
  (six, then seven, then ten for eval-contract); all three numbers move.
- `tests/schemas/artifact-registry.test.ts:288-300` -- input-mode and output-mode exports must be
  identical, which is what forbids `.default()` and `.optional()` on the new fields. They are
  required-and-nullable.
- `CONSTRAINT_LEDGER` (25 inject / 16 not-expressible) does **not** move: this story adds no Zod-only
  constraint. Its pins at `publish.test.ts:211-214`, `differential.test.ts:134-136`, and the `+ 4`
  arithmetic at `constraint-ledger.test.ts:106` stay as they are.
- `WORKED_EXAMPLE_RECORD_ISSUES` (66) and `WORKED_EXAMPLE_EVIDENCE_ISSUES` (19) do **not** move: that
  fixture carries no eval-contract and no brief instance.
- `corpus/dev/` -- 22 of 23 files regenerate (`npm run generate:dev-corpus`);
  `scripts/dev-corpus-target.ts:84-99`'s `assertLineageRoot` still holds, since the corpus seed is
  `satisfaction-contracts.ts` at `schemaVersion: 1`, not `populatedContract`.

**Documentation with no gate behind it**

- `docs/explanation/behavioral-evaluation-contracts.md:77` and `docs/reference/glossary.md:38` both
  enumerate the brief's eleven top-level fields and both assert the test data "has no place in that
  shape". `principals` makes the count wrong and the sentence half wrong. `check:docs` never reads
  `docs/`, and `check:doc-invocations` executes fenced commands without reading prose, so nothing
  fails if these are skipped.

## Tasks & Acceptance

**Execution:**
- [x] `plan.ts` -- two new tagged `BindingValue` members and the rewritten union JSDoc
- [x] `eval-contract.ts` -- `TestData.principals`/`resources` as nullable caller-keyed records
- [x] `sealed-evaluator-brief.ts` + `seal.ts` -- `principals` on the brief, sorted, the `.meta()`
      description corrected, the brief `schemaVersion` at `seal.ts:96` moved to 2
- [x] `failure-codes.ts` + AD-5's table -- two rows, two widened cells, seven "twenty-one" sites
- [x] `src/core/compile/bindings.ts` + `compile.ts` -- the cycle and captured-pointer checks
- [x] `interface-inventory.ts` -- undeclared principal under `undeclared-mandatory-input`
- [x] `forbidden-inputs.ts` -- the check reaches `testData.resources`, with its own message and path
- [x] `derived-reference.ts` -- exhaustive four-form dispatch across all three escalation levels
- [x] `src/core/score/binding-order.ts`, `src/core/score/bindings.ts` -- tiering, captured
      resolution, candidate-tuple filtering, `none` on absent; export `channelRoot`; rewrite
      `selection.ts:51-57`
- [x] `npm run generate:schemas` -- confirm exactly two files change
- [x] `npm run build:shareable` and `npm run generate:dev-corpus`
- [x] fixtures -- bump both accept fixtures, add `principals`/`resources` to every `testData:`
      literal and `principals` to every brief literal, add reject cases sufficient for the
      keyword-mutation sweep, record every moved counter in the Spec Change Log
- [x] docs -- the three ungated pages, including `docs/tutorials/getting-started.md:111`
- [x] `deferred-work.md` -- the observation-side principal label
- [x] tests -- one file per new module plus the whole I/O matrix
- [x] `npm run check:layers` as soon as `bindings.ts` first imports `channelRoot`, not at the end
- [x] `npm run validate` green end to end; leave changes uncommitted

**Acceptance Criteria:**
- Given an eval contract, when `BindingValue` parses, then it admits exactly four tagged members and
  no untagged form, and each new member has its own AD-13 reject case.
- Given a `{ principal }` naming a principal `testData.principals` does not declare, when `compile`
  runs in strict mode, then it throws `undeclared-mandatory-input`; two declarations sharing a name
  are unrepresentable.
- Given a capture cycle, when `compile` runs, then it throws `binding-cycle`; given a captured
  pointer on `call-inputs`, `stdout`, `stderr`, or `exit-code`, `captured-channel-undeclared`; given
  any other unresolvable or wrongly-typed captured pointer, `unreachable-check-evidence`.
- Given `src/core/failure-codes.ts` and AD-5's table after this story, when `check:ad5-registry` and
  `lint:spine` run, then both pass with twenty-three codes, set- and order-equal.
- Given a contract declaring principals, when it is sealed, then the brief carries the declared names
  sorted, carries no step identifier, and a `captured` binding renders as a derived reference to the
  referenced step at every escalation level.
- Given a captured pointer resolving `absent`, when `selectWithBindings` runs on the referencing
  step, then it returns `{ result: 'none', matchedObservationIds: [] }`.
- Given `tests/seal/fixtures.ts`'s `literalCollisionPair` (`:318-356`) — two steps sharing one
  `operationId` and binding the same key to different literals — when `selectWithBindings` runs,
  then the two steps select different observations, which `selectObservations` alone cannot do.
  Given `irreducibleCollisionPair` (`:362-390`), whose two steps bind nothing, both still return
  `several`: a filter over zero bindings separates nothing, and that is the honest answer.
- Given two steps binding one key to two different declared principals, when `selectWithBindings`
  runs, then both return `several`, and `deferred-work.md` carries the entry naming what would close
  it.
- Given a plan whose capture graph has two tiers, when `bindingOrder` runs on any permutation of the
  plan array, then every step lands in the same tier by membership. The order WITHIN a tier is the
  plan's declaration order and moves with the permutation, by the decision recorded below: an
  authored `interactionPlan` is the author's own declaration, and permuting it yields a different
  contract with a different digest, so NFR9's permutation invariance is not what this returns.
  Draft 0 asserted byte-identical tiers, which the declaration-order tie-break falsifies.
- Given `npm run generate:schemas`, `npm run build:shareable`, `npm run generate:dev-corpus`, and
  AD-13's four checks, when run after this story, then all pass, and every pinned counter this story
  moved is recorded with its exact before and after.

## Spec Change Log

**Review loop 1** — two independent pre-implementation reviews (a peer Claude Code session and a
blast-radius subagent) against draft 0. Findings addressed, by what they
changed:

1. **The declared-principal check moved off a root `.refine()`.** Measured before it was written into
   draft 0, and independently reproduced by the peer session:
   `z.toJSONSchema(EvalContract, { io: 'output' })` returns
   `['$schema','type','properties','required','additionalProperties','description','$defs']` today
   and `['$schema','$ref','$defs']` once the root carries a refinement, and re-attaching
   `.meta({ id: 'EvalContract' })` afterwards throws `Duplicate schema id "EvalContract"`. The peer
   also verified a working placement — refine between the object literal and `.meta()` — which
   exports byte-identically. It was still turned down: a cross-subtree Zod-only constraint
   (`interactionPlan[].inputBinding.*.<key>.principal` against `testData.principals`) is a
   Zod-rejects-ajv-accepts disagreement that `differential.test.ts:66-84` sweeps over generated
   mutants, and 7.2's `observation-sequence-unique` entry could argue inertness only because the
   mutant walk is keyword-driven and never clones an `observations` item. Here the mechanism is
   concrete rather than hypothetical: `corpusOf` (`tests/schemas/published/corpus.ts:109-115`)
   includes `generationOf(key).witnesses`, which `mutant-generator.ts:38-45` describes as valid
   instances synthesised **for union branches**. A four-branch `BindingValue` gets a synthesised
   `principal` witness carrying an `Identifier`-shaped string no contract declares, which a root
   refine rejects and ajv accepts. `undeclared-mandatory-input` needs no ledger entry, no census churn, and no such proof.
2. **AD-5's `unreachable-check-evidence` row is widened, not silently reused.** The row reads "an
   oracle's `check` addresses evidence unreachable through the declared interfaces"
   (`ARCHITECTURE-SPINE.md:220`), AD-26 (`:400`) scopes it to an operand, and the shipped thrower
   fires it only from `forEachCheckPointer` with an `EvalContract.oracles[id=...]` path
   (`reachability.ts:288-297`). Draft 0 quoted the row with its subject removed. The `Fires when`
   cell now names the binding site too, which `check:ad5-registry` ignores (it parses column one) and
   which stays inside the epic's registry-append budget.
3. **"Earlier step" is defined, and it is not `after`.** See Design Notes.
4. **Candidate-tuple disambiguation is implemented rather than deferred.** `selection.ts:51-57`
   assigns it to this story by name; draft 0's Boundaries refused it while claiming to close owed
   item 3.
5. **"The published failure-code enumeration regenerates" was vacuous** and is deleted. No published
   document carries the enumeration: the only match in `schemas/*.json` is prose inside an
   `eval-contract` description. AD-5's and FR4's "generated from the table" is satisfied today by
   `check:ad5-registry` alone. Kept as a `Never`, so no implementer mints a thirteenth artifact.
6. **`captured-channel-undeclared`'s firing condition is recorded as a reinterpretation.** See
   Design Notes.
7. **`evaluatePointerReachability` decides three of the five residue conditions, not four.** An
   empty-tail `response-body` pointer returns `reachable()` at `:200`, and nothing there reads
   `types` for equality.
8. **Deep tails, array indices, and header tails are each decided explicitly** rather than left to
   two readings. See Design Notes.
9. **The AD-5 position no longer rests on a false claim** that `compile.ts` calls checks in strict
   registry order; it does not (`:97-103` deliberately runs the two witness checks last, and `:83`
   runs a strict-only check inside the strict block).
10. Blast-radius and precision corrections folded into the Code Map: the brief `.meta()` description,
    `[...names].sort()` over `sortedByKey`, the two-list precedence and message shape in
    `forbidden-inputs.ts`, six stale "twenty-one" sites, the 72 counter and two test titles, the
    `check:ad31-table` expectation, the escalation-level table, the principal channel question, the
    projection ban, AD-39's now-false enumeration sentence and `plan.ts`'s union JSDoc, the brief
    carrying names without kinds, `selectWithBindings`'s exact return on absent, the shareable HTML
    rebuild, `seal.ts:96`, the `compile.test.ts` ordinals, the keyword-mutation sweep's
    per-occurrence cost, `check:boundary`'s vocabulary ban, and the two ungated documentation pages.

**Review loop 2** — a Codex session (gpt-5.6-sol), fifteen findings, run against iteration 1 after
the two Claude rounds had closed. Cross-model review earned its keep: eight of the fifteen were
things neither Claude pass had seen. Captures narrowed to `response-body` alone, which removed an
invented header type that `Observation.responseHeaders` contradicts; `binding-cycle` widened to the
union of capture and `after` edges, which a capture-only graph leaves unsatisfiable; the compile
checks split by registry position so `unreachable-check-evidence` still reports at its own rung; the
temporal half of the selector restored to `selectWithBindings`; the resolution map given a real type,
since `ResolvedValue` cannot carry a source observation or an ambiguity; tier tie-break moved from
`stepId` to plan declaration order, which is what the criterion's "sequence order within a tier" can
mean at compile time; `captured`'s top rung restored to a real derived reference after the previous
round had flattened it; and the principal-disambiguation gap named rather than left implicit. Two
findings were accepted as limitations rather than fixed — the principal gap and `testData.resources`
being declarable-but-never-compilable — both recorded below with a `deferred-work.md` entry. One was
declined: minting a third AD-5 code for the type mismatch, which FR4 and the criterion both forbid.

**Implementation loop** — every pinned counter, measured after the change rather than predicted.

| Counter | Where pinned | Before | After | What accounts for the delta |
| --- | --- | --- | --- | --- |
| `eval-contract` keyword census | `keyword-mutation.test.ts` `CENSUS_BY_DOCUMENT` | 727 | 761 | 34: two `BindingValue` branches at 5 each plus `TestData.principals`/`resources` at 12 each |
| `sealed-evaluator-brief` keyword census | same | 98 | 102 | 4: the array's `type`, `items`, the item's `type`, and the item's `pattern`. Adding a name to the existing root `required` array adds no occurrence |
| `CENSUS_TOTAL` | `keyword-mutation.test.ts` | 2279 | 2317 | the two document deltas above |
| `additionalProperties` | `CENSUS_BY_KEYWORD` | 193 | 199 | 2 new union branches plus 2 records plus 2 declaration objects |
| `anyOf` | same | 126 | 128 | the two nullable records |
| `items` | same | 129 | 130 | the brief's `principals` array |
| `minLength` | same | 89 | 91 | the two `kind` fields |
| `pattern` | same | 151 | 156 | 2 branch patterns, 2 `propertyNames` patterns, 1 on the brief's items |
| `propertyNames` | same | 27 | 29 | the two caller-keyed records |
| `required` | same | 166 | 170 | the two new `BindingValue` branches, plus the `required: ["kind"]` inside each of the two declaration objects. The two `TestData` field names join an existing array and contribute nothing |
| `type` | same | 1003 | 1019 | 16 across the six new subtrees |
| `REJECT_CASES` | `published-rejection.test.ts`, `differential.test.ts` | 46 | 55 | 9 new: 3 on `BindingValue`, 6 on `TestData` |
| `ARTIFACT_REJECT_CASES` | same | 72 | 74 | 2 new on the brief's `principals` |
| `PUBLISHED_REJECT_CASES` | same | 118 | 129 | the two above |
| parent-reporting cases carrying `errorParams` | `published-rejection.test.ts` comment | 11 | 17 | 5 of the new cases report `required`, `propertyNames`, or `additionalProperties`; the comment read "eleven" while the derived set was already 12, so it was stale before this change |
| `CALLER_KEYED_CONTROL_MAPS['eval-contract']` | `artifact-registry.test.ts` | 10 addresses | 12 addresses | `testData.principals` and `testData.resources` |
| caller-keyed DECLARATIONS, in that file's prose | same | 7 | 9 | the same two |
| AD-5 registry size | `failure-codes.test.ts`, `check:ad5-registry` | 21 | 23 | `binding-cycle`, `captured-channel-undeclared` |
| wired compile checks | `compile.test.ts` describe title | 26 | 29 | `checkCapturedReachability` at rung 4, `checkBindingCycle` and `checkCapturedChannel` at 19 and 20 |
| eval-contract `schemaVersion` | `relevance-contracts.ts` `populatedContract` | 2 | 3 | `TestData` gained two required fields |
| brief `schemaVersion` | `seal.ts`, `artifact-fixtures.ts`, `scripting-audit.test.ts` | 1 | 2 | the brief gained a required `principals` |
| brief top-level fields, in prose | three `docs/` pages | eleven | twelve | `principals` |
| dev-corpus files regenerated | `generate:dev-corpus` | n/a | 22 of 23 | every contract and the example brief; `index.json` moved too |

The two document deltas decompose exactly. Each new `BindingValue` branch is five occurrences
(`type` twice, `pattern`, `required`, `additionalProperties`), so ten. Each new `TestData` record is
twelve (`anyOf`, the object `type`, `propertyNames` with its own `type` and `pattern`, the
schema-valued `additionalProperties` with its `type`, `kind`'s `type` and `minLength`, the inner
`required` and `additionalProperties`, and the `null` branch's `type`), so twenty-four. Ten plus
twenty-four is thirty-four. The brief's four are the array `type`, the `items` `type`, `items`, and
`pattern`; adding a name to an existing `required` array adds no occurrence, since the walk counts
the keyword and not its members.

One measured result contradicted what the specification expected, and the measurement wins:

1. **The keyword-mutation sweep needed no new reject case to pass.** The specification predicted
   "more reject cases than the acceptance criteria enumerate". Measured: with the census updated and
   before a single new reject case was written, all fourteen sweep assertions passed, because
   `corpusOf` includes `generationOf(key).mutants`, which are synthesised per keyword occurrence and
   already kill every new one. The eleven reject cases here were written to satisfy the acceptance
   criterion that each new member carries its own AD-13 case, which is an authoring obligation
   independent of the sweep.

## Decisions taken during implementation

1. **`checkCapturedReachability` returns early on a non-`response-body` capture.** Splitting the
   checks by registry position (Codex finding 3) and narrowing captures to the body (finding 1)
   collide: `evaluatePointerReachability` returns unreachable for `/interactions/x/stdout/id`, so a
   reachability check at rung 4 would fire `unreachable-check-evidence` on a pointer the matrix says
   fires `captured-channel-undeclared`. Owning the body residue alone keeps both true, and registry
   priority still holds where it matters: a contract carrying a body type mismatch and a `stdout`
   capture reports the mismatch, code index 2 beating index 15.
2. **`selectWithBindings` returns `none` when a declared `after` anchor resolves nothing.** "No
   anchor exists" and "the anchor cannot be pinned down" are different facts. A `null` clause and a
   clause naming an undeclared step both impose no constraint, per AD-39's permissive dangling
   reference; a declared anchor that matched no observation, or matched several under a single-valued
   cardinality, fails closed and rules every candidate out.
3. **The resolution map is keyed by `JSON.stringify([stepId, transportChannel, key])`.** A parameter
   key is arbitrary caller-supplied text, so any delimiter join can collide.
4. **`score/bindings.ts` also exports `resolveCapturedBindings`.** Without a driver that walks
   `bindingOrder`'s tiers and fills the map, the tiering is load-bearing for nothing and the NFR9
   criterion has nothing end-to-end to exercise.
5. **`renderCaptured` falls back to the `kind` phrase when the index cannot resolve the pointer's
   step or operation.** `seal()` runs after `compile`, which rejects such a pointer under
   `unreachable-check-evidence`, so the fallback covers a directly-driven caller and adds no throw
   path `seal()` does not already have.
6. **`checkBindingCycle` and `bindingOrder` both walk in plan declaration order.** The tier tie-break
   decision (Codex finding 6) applies to the cycle walk for the same reason, so which binding a
   cyclic plan reports follows from the authored array.
7. **`capturedBindings` lives in `core/compile/bindings.ts` and both score modules import it.**
   `core/compile/` and `core/score/` are the same layer node, so the import is intra-node and legal,
   and one spelling of "which bindings are captures" beats two that can drift.
8. **`populatedContract` declares `principals: { owner: { kind: 'account' } }` and `resources: {}`.**
   A populated `resources` fires `scoped-reference-resolves-forbidden` by construction, so the accept
   fixture carries the explicitly-empty answer and the reject fixture supplies the populated one.

## Design Notes

**The cycle check spans both edge kinds.** A capture edge and an `after` edge both mean "this step's
observation comes after that one", so a capture B→A together with `A.after = B` is unsatisfiable
while each graph alone stays acyclic. `binding-cycle` therefore fires on any cycle in the union of
the two edge sets that contains at least one capture edge; a cycle made only of `after` edges stays
`nested-temporal-clause`'s, which already catches every one of them. A mixed-edge fixture pins it.

**What "an earlier step" means, and why it is not the `after` anchor.** The acceptance criteria say a
captured pointer is "rooted at an earlier step", and the plan's only shipped ordering notion is
AD-39's temporal clause. Reusing it was considered and is impossible: `nested-temporal-clause`
already rejects every `after` cycle (`tests/compile/scripting-bound.test.ts:305` fixture 15, and the
self-loop at fixture 22), so if a capture had to follow an `after` edge, `binding-cycle` could never
fire and FR4's twenty-third code would be dead on arrival. The capture graph is therefore its own
graph over the plan, "earlier" means earlier in its topological order, and `binding-cycle` is what
makes that order exist. AD-39's one-level bound is untouched, because it bounds `after` chains and
this is not one.

At score time the ordering is carried by `sequence`, not by the plan: the referenced step's
observation is selected by Story 7.2's function, and if the evaluator never produced it — or produced
nothing matching — the pointer resolves `absent` and the referencing step selects `none` under
AD-26's rule that absent is an observation. So a capture from a step the evaluator happened to
exercise later is not an error and not undefined; it is a `none`.

**Why no third code, and what the residue fires.** FR4 (`epics.md:27`) fixes the registry at
twenty-three, and AD-5 forbids describing a check without a code. The two new codes take the two
conditions the epic names. Every other captured-pointer failure fires `unreachable-check-evidence`
with the row widened as recorded above: an unresolvable step segment, a body key the response
descriptor declares in neither `requiredKeys` nor `permittedKeys`, a body tail longer than one
segment, an array index, a declared type that is absent, `null`, `object`, or `array`, and a declared
type that does not equal the bound parameter's. `evaluatePointerReachability` supplies the step,
operation, key, and scalar-descent half; `bindings.ts` supplies the rest.

**A captured pointer may name `response-body` and nothing else.** `ResponseDescriptor`
(`interface.ts:45-70`) declares `requiredKeys`, `permittedKeys`, `types`, `successIndicator`,
`channelRoles`, and `collectionLocations` — every one of them about the body. So the criterion's "a
channel the referenced operation's response descriptor does not declare" is satisfied literally by
the narrowest reading: the body is the one channel the descriptor declares, and the other six fire
`captured-channel-undeclared`. An earlier draft admitted `response-headers` and `response-status` as
"response channels" and had to invent their types by fiat; that was wrong on its own terms, because
`Observation.responseHeaders` is `JsonObjectValue.nullable()` and admits objects, arrays, numbers,
and `null`, so a capture compiled as a `string` could resolve to an object at score time. Narrowing
to the body removes the invention and the hole together.

**Type equality, made total.** The captured type is `responseDescriptor.types[key]`, which must be
present, non-`null`, and scalar, and the tail must be exactly one segment: `types` is keyed by plain
key name (`interface.ts:52`), so a nested segment like `/response-body/note/title` has no declared
type to compare against. An array index is excluded for the same reason — `reachability.ts:207-228`
admits `/response-body/0` against a root `collectionLocation`, but no declaration gives that element
a type. Equality is against the bound parameter's own declared type in
`requestShape[channel].types[key]`; an indeterminate type on either side is not equal to anything and
fails closed, which is AD-31's disposition for an indeterminate descriptor.

A mismatch fires `unreachable-check-evidence`, and that is the weakest link in this story's registry
reasoning, so it is recorded rather than glossed: both operands can be perfectly reachable and still
have incompatible declared types, which the code's name does not describe. Minting a distinct code
was the honest alternative and was rejected because FR4 (`epics.md:27`) and the criterion both fix
the registry at twenty-three, and a story does not renegotiate the criterion it implements. The row's
`Fires when` cell is therefore widened to name the type condition explicitly, so the registry stays
true about every way the code fires, and a later revision that wants a distinct code has the
condition already written down in one place.

**Why an undeclared principal is a compile check, and why its registry row is widened too.** The
placement reasoning is in the Spec Change Log above. The code is `undeclared-mandatory-input`, whose
row reads "strict mode meets an input the contract did not declare" — but the shipped thrower fires
on an undeclared binding *key* (`interface-inventory.ts:65-73`), and in the principal case the key is
declared while the value's referenced name is not. That is a different predicate wearing the same
code, the exact defect corrected on the `unreachable-check-evidence` row, so this row's `Fires when`
cell is widened in the same diff and on the same zero-cost argument.
`checkUndeclaredMandatoryInput` already walks every binding entry, so the value-side condition is one
more clause in the loop it already runs. The application boundary defaults
`strict` to true (`src/application/compile.ts`), so the default path enforces it, and strict-only is
AD-4's own disposition for this code.

**Which channel a `{ principal }` may bind.** Any of the four. Owed item 3 names AD-19's `header`
channel as the case that motivated the binding, not as a restriction, and the harness decides how a
principal reaches the system under test. One consequence follows from shipped code and is stated so
nobody rediscovers it: `checkUndeclaredMandatoryInput` requires the bound *key* to appear in the
operation's declared `requestShape` for that channel, so a contract must declare, say, an
`authorization` header key before it can bind a principal to it. Declaring the key is not declaring a
credential value, so AD-19's prohibition and AD-18 both hold.

**The projection ban holds by construction.** Owed item 3 requires the fix to keep AD-4's ban on
arithmetic, projection, and user-defined functions (`ARCHITECTURE-SPINE.md:199`). A captured pointer
is an RFC 6901 address resolving to a declared scalar with no transform applied; the scalar-only
requirement is what enforces it, and the grammar has no place for a transform to be written.

**AD-39's enumeration sentence is superseded, and the spine is not edited.** AD-39 reads
"input-binding values are literals or one of the closed matchers `any` and `type-violating`"
(`:507`). Four members falsify it. Owed item 3 is AD-39's own listed unfinished business and
prescribes exactly this widening, so the sentence is superseded by the item it defers to. The spine
stays at revision 9 and this story is the citable record, per `epics.md:529` and `:531`, which put
only the registry table in scope. `plan.ts:5-11`'s JSDoc is the one place a reader meets the union
and is rewritten in this diff.

**Binding order.** Kahn tiers over the capture graph; within a tier, the order the steps are
declared in `interactionPlan`. That is what the criterion's "topological evaluation over the
reference graph and then sequence order within a tier" can mean at compile time, where no observation
`sequence` exists yet. ADR-006 bans reading order off array position in a *run record*, where the
array is an ingest artifact nobody authored; a contract's `interactionPlan` is the author's own
declaration, and permuting it yields a different contract with a different digest, so there is no
permutation invariance to preserve. `{ literal }`, `{ matcher }`, and `{ principal }` are all tier
zero.

**Candidate tuples, both halves.** Two different ambiguities share the word. The *referenced* step's
is Story 7.2's: several matches under a single-valued cardinality is the named ambiguity and no value
resolves. The *referencing* step's is the one `selection.ts:51-57` assigns here — and that JSDoc is
wrong about its own example. `irreducibleCollisionPair` (`tests/seal/fixtures.ts:357-390`) binds
nothing in any channel on either step, so no binding filter can separate the two; it stays `several`,
and the honest fixture for the disambiguation is `literalCollisionPair` (`:318-356`), whose two steps
bind one key to two different literals.

`selectWithBindings` resolves a whole AD-39 selector, which is an input binding **and** an optional
temporal clause, in one fixed order: resolve `after` through `resolveTemporalAnchor`; drop every
candidate whose `sequence` is not strictly greater than the anchor's; drop every candidate whose
`sequence` is not strictly greater than each captured value's source observation; apply the binding
filters below; then compute `none`/`one`/`several`. Filtering on bindings alone would leave the
temporal half of the selector unread, which is half of what AD-39 says a step is.

The binding filters are five rules with one shared precondition: every one of
`observation.callInputs`'s four channels is nullable (`sealed-run-record.ts:151-156`), and a `null`
channel means the key is not present, so every rule filters the candidate out — fail closed, matching
this story's own absent-is-a-`none` disposition and AD-26.

- `{ literal: v }` — the observed value equals `v` by deep structural equality over the JSON value,
  key order irrelevant, since `BindingValue`'s literal is `JsonValue` (`plan.ts:13`) and admits
  objects and arrays. AD-4 separates `equality` from `deep-equality`; this is the deep one, spelled
  locally in `bindings.ts` rather than reaching into `core/evaluate`'s operator set.
- `{ captured: p }` — the observed value equals the resolved captured value, same equality.
- `{ matcher: 'any' }` and `{ principal: n }` — the key is present, and nothing more. Neither
  declares a value the contract knows: a principal's value is provisioned by the harness at runtime,
  which is the whole reason the binding exists.
- `{ matcher: 'type-violating' }` — the observed value's JSON type differs from the operation's
  declared type for that key. When that declared type is absent or `null` — AD-19's "declared, type
  not stated" — no violation can be proven and the candidate is filtered out, the same fail-closed
  disposition every other indeterminate case here takes.

The last rule is the one nothing asked for, and it is kept deliberately. Presence-only filtering
cannot separate `gate-c-contract.ts`'s own `submit` (`filters: { matcher: 'any' }`) from
`malformed-submit` (`filters: { matcher: 'type-violating' }`): both bind `filters` on one operation,
so a run exercising both would leave both steps `several` forever. It also changes a measurement — a
`type-violating` step whose observation carried a well-typed value now selects `none` rather than
`one` — and that is the correct reading: such a call did not exercise the malformed-input behaviour
AD-31 rule 3 grades, so it is not that step's observation. It gets its own I/O row and its own
fixture.

**Ordering is enforced at score time, not only at compile time.** A capture graph that is acyclic
still says nothing about which observation came first, and the persistence read-back that motivates
this story is exactly a claim about order: a record whose `GET` sits at `sequence` 2 and whose `POST`
sits at `sequence` 9 would otherwise satisfy the binding and pass an oracle proving the opposite.
So `selectWithBindings` drops any candidate whose `sequence` is not strictly greater than the
`sequence` of the observation each captured value was resolved from. Both are `Observation`s and both
carry the field (`sealed-run-record.ts:169`), so it is one comparison per captured binding, and it is
what gives "earlier" a runtime meaning rather than leaving it a compile-time word.

`selectObservations` is untouched, so 7.2's own tests and its permutation guarantee stand.

**The derived-reference ladder, per form and level.** `renderBindingValue` has three levels and four
forms. `type-violating` keeps its level-independent "a malformed {name} value".

| form | `generic` | `kind` | `literal` |
| --- | --- | --- | --- |
| `{ matcher: 'any' }` | the supplied {name} | the supplied {name} | the supplied {name} |
| `{ literal: v }` | the supplied {name} | the stated {name} | the {name} {json} |
| `{ principal: p }` | the supplied {name} | the {name} of the {p} account | the {name} of the {p} account |
| `{ captured: ptr }` | the supplied {name} | the {name} you obtained earlier | the {name} you obtained as {local target} from {operation} |

**`captured`'s top rung is a real derived reference, and it does not call `renderStepReference`.**
Two failure modes had to be avoided at once. Flattening the top rung to generic wording waters down
the criterion and leaves two sibling steps capturing from different predecessors rendering
identically, which is the tie `renderStepReference` throws on (`:220-223`) — a new `seal()` throw
path with nothing guarding it at compile time. Calling `renderStepReference` is worse: it needs a
*direction-scoped* sibling list, and `:199-204` records that the scoping is AD-16's, so the captured
step is generally not in the direction's own target set and widening to a plan-wide list is the
disclosure that comment exists to prevent; `bindingClause` also calls `renderBindingValue` for every
entry, so a two-tier capture graph would recurse.

The rendering therefore reuses the two functions that already produce AD-16-safe phrases and never
print a `stepId`: `localTargetPhrase(target)` and `operationReference(operation)`, giving "the body
id you obtained as its id field from the create note endpoint". It needs only the `PlanIndex`,
threaded into `renderBindingValue` from the existing call sites, and it discriminates two captures by
either their referenced operation or their addressed field. `principal` tops out at the declared
name, which is an opaque label and therefore safe on the brief.

**What a principal binding cannot do, and what closes it.** Presence-only matching means
`{ principal: 'owner' }` and `{ principal: 'other-user' }` accept the same calls, so two steps on one
operation differing only by principal both return `several` — precisely the act-as-A-read-as-B shape
this story exists for. The gap is not in the filter: nothing in a sealed run record says which
principal the harness used, and the values that would distinguish them are exactly the credentials
AD-18 keeps out of every artifact. Closing it needs an opaque principal label recorded on the
`Observation`, a third breaking `schemaVersion` bump this story's boundaries exclude, so it goes to
`deferred-work.md` rather than in by the back door. What this story does close is the criterion it
was given: the two cross-user oracles become writable at all, which they were not before. The
score-time half is named, not silently absent.

**`testData.resources` is declarable and never compilable, and that is what the criterion asks for.**
`checkScopedResourceReferences` (`forbidden-inputs.ts:20-29`) fires on *any* declared scoped resource,
because v0 ships no resolver and an unresolved reference cannot be shown not to be a forbidden input.
Reaching `testData.resources` with the same check keeps that stance honest and makes the field a
shape with no working path — which is exactly what the criterion mandates, since it requires the
field and requires the code to fire on either list. `principals` is the half this story makes usable.
`deferred-work.md` carries the resolver that would make the other half work.

**`seal` can still throw a bare `TypeError` on an irreducible captured pair.** Two predecessor steps
sharing one operation and binding nothing, with two siblings capturing from them, render identically
at every rung, so `renderStepReference` throws its precondition-violation `TypeError` out of `seal()`
on a contract every compile check accepts. The tie is genuine, and the same answer
`irreducibleCollisionPair` already gets, so this is a failure-mode gap rather than a correctness
defect: the author sees a stack trace where they should see a coded `StructuralFailure`. It is a
widening of a hole that predates this work, and hoisting `seal`'s render-collision check to compile
time is real new scope on an already-large diff, so it is recorded in `deferred-work.md` instead.

**Why the brief carries names without kinds.** The caller needs to know which principals to provision
and which one a direction is talking about. `kind` is the author's own opaque vocabulary with no
value space any AD declares, so shipping it would put uninterpretable text on the one artifact AD-16
keeps minimal. If a real caller turns out to need it, adding it is an additive bump.

**Two documentation pages go stale with no gate to catch them.**
`docs/explanation/behavioral-evaluation-contracts.md:77` and `docs/reference/glossary.md:38` both
enumerate the brief's eleven top-level fields and both assert the test data "has no place in that
shape". `check:docs` reads only `README.md`, the planning artifacts, the project knowledge, and two
`experiments/` files; `check:doc-invocations` executes fenced commands and never reads prose. Nothing
fails if these are skipped, which is exactly why they are named.

**`core/` writing rules the new modules must respect.** `npm run check:boundary` rejects the words
"story", "stories", "epic", and "epics" anywhere under `src/**` and `corpus/**`, comments included,
so the new modules describe their reasoning in owed-item and AD vocabulary, as Story 7.1 was forced
to. `core/` also admits no external module, no Node builtin, no `async`/`await`, and no
`Date`/`Math.random`. `core/compile/` and `core/score/` are the same layer node
(`scripts/dependency-direction.ts:48-97`), so imports between them and into `core/evaluate/` are
intra-node and legal, and no barrel entry is needed.

## Verification

**Commands:**
- `npm run validate` -- expected: green end to end
- `npm run generate:schemas` -- expected: exactly two files change
  (`eval-contract.schema.json`, `sealed-evaluator-brief.schema.json`)
- `npm run build:shareable` -- required after the AD-5 table edit; `check:shareable` compares the
  committed HTML byte for byte
- `npm run generate:dev-corpus` -- expected: 22 of 23 files regenerate, no hand edits
- `npm run check:ad31-table` -- expected: unchanged. `bindsTypeViolating`
  (`src/core/coverage/satisfaction.ts:351`) discriminates by `'matcher' in value` and no AD-31
  predicate reads `testData`.

## Story Review Record

Three independent pre-implementation reviews, three rounds.

- **Round 1** — a peer Claude Code session (23 findings, 6 HIGH) and a blast-radius subagent (34
  items). Dispositions are in the Spec Change Log above; the draft was rewritten rather than
  patched.
- **Round 2** — the same peer session re-verified the rewrite against the four dispositions it had
  not proposed itself: 13 findings, 4 HIGH. It confirmed the `.refine()` rejection (and supplied the
  stronger mechanism now recorded: the union-branch witness synthesiser), confirmed that
  `checkNestedTemporalClause` catches cycles of every length so capture-follows-`after` really would
  strand `binding-cycle`, and found three things the rewrite got wrong: `irreducibleCollisionPair`
  binds nothing so it cannot be the disambiguation fixture, the `captured` top rung is not renderable
  through `renderStepReference`, and `undeclared-mandatory-input`'s own row needed the same widening
  the story had already applied to `unreachable-check-evidence`. All thirteen are addressed above.
- **Round 3** — a Codex session (gpt-5.6-sol) against iteration 1, fifteen findings, eight of them
  unseen by either Claude round. Dispositions in the Spec Change Log's "Review loop 2" entry: twelve
  applied, two accepted as recorded limitations with a `deferred-work.md` entry, one declined.

## Implementation Review Record

**Round 1** — an independent peer Claude Code session against the finished working tree, briefed
adversarially and told to skip anything a gate already catches. Ten findings, two HIGH, plus four
suspicions it could not turn into failing inputs. All ten addressed in the same pass; `npm run
validate` green before and after.

1. **HIGH — `renderCaptured` still tied two siblings, and `seal()` threw.** The literal rung named
   the captured-from OPERATION, which does not separate two predecessors sharing one operation and
   one body key, so two steps capturing from them collided at every rung and `renderStepReference`
   threw a `TypeError` out of `seal()` on a contract that compiles clean. The comment claiming the
   rung fixed exactly that problem was false. Fixed by recursing one level: the rung now renders the
   referenced step through `stepReferenceAtLevel`, so the predecessor's own binding clause is what
   separates them, bounded at `CAPTURE_RENDER_DEPTH` 1 and printing no step identifier. Two
   predecessors that are themselves irreducible still tie, and the throw there is correct.
2. **HIGH — the tier walk was inert and captures could not see past a collision pair.**
   `resolveCapturedValue` and `temporalFloor` both selected the referenced step through
   `resolveTemporalAnchor`, which is `selectObservations` underneath and matches on `operationId`
   alone. So a capture from either half of a literal-bound collision pair resolved `ambiguous`, a
   two-link capture chain broke at the second link, and `resolveCapturedBindings`'s tier walk had no
   effect on its own output, which falsified both its docstring and decision 4. Both resolvers now
   select through `selectFiltered`, the same binding filter this module implements, reading the
   partially-filled map. A `guard` set carries the steps already being reduced, so an `after` cycle
   in an uncompiled plan terminates instead of recursing; `checkNestedTemporalClause` rejects every
   such plan at compile time, so the guard covers only a directly-driven caller.
3. **MEDIUM — registry-order inversion on an unresolvable off-body pointer.**
   `checkCapturedReachability` returned early on any non-`response-body` capture before resolving
   the step, so `/interactions/ghost/stdout/x` fired `captured-channel-undeclared` (index 15) where
   AD-5 gives `unreachable-check-evidence` (index 2), and the emitted message asserted a fact about
   a response descriptor no declared operation supplies. Step and operation are now resolved before
   the channel test.
4. **MEDIUM — a captured binding on a wholly undeclared key hard-failed a non-strict compile.**
   `boundParameterType` treated "no declared type" as captured-pointer residue, but a key in neither
   `requiredKeys` nor `permittedKeys` is `undeclared-mandatory-input`, which AD-4 makes strict-only.
   The same key bound to a literal still compiled. `boundParameterType` now skips an undeclared key
   the way it already skips an unresolved operation.
5. **MEDIUM — AD-5's `unreachable-check-evidence` row omitted two firing paths.** The unresolvable
   step or operation case and the indeterminate-bound-type case were both outside the widened cell.
   The row now names all four conditions, and the shareable HTML was rebuilt.
6. **MEDIUM — the `bindingOrder` acceptance criterion was stale.** It still demanded byte-identical
   tiers under any permutation, which the declaration-order tie-break falsifies. Restated over tier
   membership, with the reason.
7. **MEDIUM — three decompositions in the counter table were wrong** while every total was right.
   Corrected to 5 per binding branch, 12 per test-data record, and the brief's four occurrences;
   `required` gains nothing from a name joining an existing array.
8. **LOW — `cyclic` was misdescribed.** Kahn's residue holds every unplaced id, so a step merely
   downstream of a cycle lands there too. Documented, and pinned by a case.
9. **LOW — the `ambiguous` arm carried a payload nothing reads.** Kept: after finding 2 the arm is
   both reachable and meaningful, and reporting the ids as data is 7.2's own policy. The type now
   says both consumers treat it as `absent`.
10. **LOW — eight new em dashes as clause connectors** against eleven across the other hundred
    source files. Removed from all three new modules.

Also acted on the reviewer's first suspicion, which it could not turn into a failing input.
`checkBindingCycle`'s depth-first walk was complete only because `capturedBindings` happened to be
enumerated before the `after` edge; with the two swapped, its own harness found 513 misses in
300,000 random graphs. That is an invariant nothing stated. The walk was replaced with Tarjan's
strongly connected components: a cycle lies inside one component, so "some cycle contains a capture
edge" is exactly "some capture edge has both endpoints in one component", which no edge order can
change. A mixed cycle entered along an `after` edge is now pinned by its own case. Its other three
suspicions (`deepEquals` over the JSON domain, an AD-16 leak through the captured phrase, and an
empty binding-channel map) were each verified sound and needed no change.


**Round 2** — the same peer session re-verified the round-1 fixes and found two more, both real,
both introduced by those fixes rather than surviving them. It also closed four of its own round-1
suspicions with proofs: the Tarjan equivalence is proven in both directions and differentially
tested against the old walk over 600,000 plans with zero discrepancies, the score-side mutual
recursion is proven terminating by the guard-set argument, the diamond case is unaffected, and the
registry-position residue split is correct including its early-return path.

1. **HIGH — the depth-1 render bound was wrong rather than merely narrow.** A two-link capture chain
   whose every link is genuinely distinguishable still threw: at depth one only the immediate
   predecessor's binding shows, and that is exactly the half two siblings share when the two mid
   steps call one operation and bind one key. `CAPTURE_RENDER_DEPTH` is gone. `stepReferenceAtLevel`
   now carries a `ReadonlySet<string>` of the steps on the render path, adds its own before building
   its clause, and `renderCaptured` falls back to the level-independent phrase only on a capture back
   into that set. Each recursion adds one id, so the depth is bounded by the plan, which
   `plan-exceeds-scripting-bound` bounds too, and the mutual and self-capture cycles terminate on the
   first hop exactly as the fixed bound did. Same guard shape the score module already uses for an
   `after` chain. `capturedChainPair` pins it.
2. **HIGH — `bindingOrder` omitted the `after` edge, which round 1's own fix had just made
   load-bearing.** Once `temporalFloor` resolved its anchor through the resolution map, a step could
   read an anchor whose own capture site its tier had not written yet, so swapping two same-tier
   steps' declaration order flipped a verdict between `none` and one match. `bindingOrder` now tiers
   the same union graph `checkBindingCycle` builds. It is sound for that check's own reason: a
   compiled contract's union graph is acyclic, since `binding-cycle` covers every mixed cycle and
   `nested-temporal-clause` every pure-`after` one, so an `after` cycle lands in `cyclic` under the
   existing fail-closed policy. The module JSDoc said the opposite and is corrected.
3. **MEDIUM — `seal` still throws a bare `TypeError` on an irreducible captured pair.** Taken as a
   recorded limitation rather than fixed: the tie is genuine, the throw is the right answer, and only
   its shape is wrong. Recorded in Design Notes above and in `deferred-work.md`, which names hoisting
   `seal`'s render-collision check to compile time. Building that check now is new scope on an
   already-large diff.

One comment added while in `renderCaptured`, for a future scan rather than for a defect: a
response-body key an author happened to name the same as a step prints in the phrase, because
`localTargetPhrase` prints the pointer's tail. That is the author's own declared key rather than a
plan identifier, and it is what every ordinary evidence target has always printed.

## Peer Review Record
