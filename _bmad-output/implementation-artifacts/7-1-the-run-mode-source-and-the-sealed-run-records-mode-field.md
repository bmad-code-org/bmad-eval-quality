---
baseline_commit: d05adac8a532fe0a165eae1abd9ae4b9f1d6c856
---

# Story 7.1: The run-mode source and the sealed run record's mode field

Status: review

Epic: 7 (the score reference implementation)
Story key: `7-1-the-run-mode-source-and-the-sealed-run-records-mode-field`
Implements: the remaining half of the spine's "Owed to the reference implementation" item 6
(`ARCHITECTURE-SPINE.md:721-726`, "`score` produces outcome and verdict values for `emit` whose
containing type is unnamed, and the source of run mode is absent"), and the first clause of owed
item 4 (`ARCHITECTURE-SPINE.md:694-700`, "Mode is absent from the sealed run record"). Carries an
AD-11 breaking `schemaVersion` bump on the Sealed Run Record and AD-13's four published-schema
checks for the new constraint.

**This story closes owed item 6 and does not close owed item 4.** Item 6 has two halves. Story 6.4
shipped the stage-signature table as `src/core/lineage/stage-table.ts` and its `score` row already
names the outcome-and-verdict containing type; this story supplies the source of run mode and item 6
is then whole. Item 4 has four clauses — mode on the record, mode in AD-11's identity inputs,
separate `ProductionAssessment`/`ContractAssessment` types with their own ladders, and cross-mode
comparison rejected. This story lands the first. Story 7.7 lands the other three and owns the
epic preamble's stated consequence, that every scoring version computed before Epic 7 is
non-comparable with every version after it.

## Story

As the run that can currently be relabelled after ingest,
I want mode carried by the sealed record itself,
so that the source of a scored run's mode is one named field rather than nothing.

## Acceptance Criteria

### AC 1: Scope, module locations, and what this story does not build

The gap is stated in shipped source, not only in the spine. `src/core/schemas/sealed-run-record.ts:301`
says two constructions are "deliberately absent and each is owed to an open item: the run MODE,
which AD-21 requires to be fixed before ingest and to enter AD-11's identity inputs rather than
appearing first in the evidence artifact (Owed item 4), and observation ORDERING, which ADR-006
forbids reading off array position (Owed item 2)". `src/core/schemas/evidence-artifact.ts:320` says
the same thing from the other side: "Owed item 4's remaining half stays open, namely mode being
fixed before ingest and entering AD-11's identity inputs rather than appearing first here; and the
Sealed Run Record still carries no mode."

This story makes the second half of each sentence false and corrects both. The ORDERING half of the
run record's sentence belongs to Story 7.2 and stays exactly as written.

**Every ```ts block in this file is labelled either `VERBATIM` (copy it into source as written) or
`SKETCH` (declarations only, showing the exported surface; the dev writes the bodies).**

**No new files.** Four source files and six test files change.

| Path | Change |
| --- | --- |
| `src/core/schemas/sealed-run-record.ts` | `RUN_MODES`, `RunModeValue`, and the required `mode` field |
| `src/core/schemas/evidence-artifact.ts` | one description sentence corrected; no shape change |
| `src/core/lineage/stage-table.ts` | `STAGE_VALUE_INPUTS`, `StageValueInput`, and a `valueInputs` column |
| `schemas/sealed-run-record.schema.json`, `schemas/evidence-artifact.schema.json` | regenerated, never hand-edited |
| `tests/schemas/fixtures/artifact-fixtures.ts` | the run-record fixture gains `mode` and moves to `schemaVersion: 2` |
| `tests/schemas/fixtures/artifact-reject-cases.ts` | two reject cases for the new constraint |
| `tests/schemas/fixtures/worked-example-artifacts.ts` | one more recorded failure; the JSON is not repaired |
| `tests/schemas/worked-example-artifacts.test.ts` | the count moves from sixty to sixty-one |
| `tests/schemas/artifacts.test.ts` | the value-space, no-default, and evidence-branch-agreement cases |
| `tests/lineage/stage-table.test.ts` | two cases for the new column |
| `tests/schemas/published/published-rejection.test.ts`, `differential.test.ts` | the pinned reject-corpus sizes |
| `tests/schemas/published/keyword-mutation.test.ts` | the pinned keyword census |

**Out of scope, and each clause is owned by a named later story.**

| Not in this story | Owner |
| --- | --- |
| `mode` in `ScoringVersionInputs`; `ProductionAssessment`/`ContractAssessment`; the two ladders; cross-mode comparison rejected | 7.7 |
| the observation `sequence` field and selector cardinality | 7.2 |
| any `score` or `emit` module; `stage-table.ts` keeps `module: null` for `ingest`, `score`, and `emit` | 8 |
| NFR8's caller-facing break disclosure and the non-comparability statement | 7.10 |

Nothing in this story writes a release note, a CHANGELOG entry, or a migration guide. The bump is
recorded where AD-11 puts it — in the field's own description — and Story 7.10 collects the
caller-facing disclosure for the whole epic.

### AC 2: `src/core/schemas/sealed-run-record.ts` — the value space  (VERBATIM)

Place this immediately above `export const SealedRunRecord`, after `EvidenceDisclosure`.

```ts
/**
 * AD-21's two modes, closed. In `production` the subject is the system under
 * test; in `contract-scoring` the subject is the contract, the probe is
 * knowingly defective, and a `caught` outcome is the contract succeeding.
 *
 * Exported from the record rather than from the evidence artifact because this
 * is where mode is now fixed: AD-21 requires mode "fixed before ingest",
 * and an evidence artifact is `emit`'s output, four stages downstream of the
 * only place a caller can supply one.
 */
export const RUN_MODES = ['production', 'contract-scoring'] as const

export type RunModeValue = (typeof RUN_MODES)[number]

export const RunMode = z.enum(RUN_MODES)
```

### AC 3: the `mode` field, and where it sits in the shape  (VERBATIM)

Insert `mode` into `SealedRunRecord`'s property bag between `conditionArm` and `trialIndex`.

```ts
		mode: RunMode.describe(
			'AD-21\'s run mode, supplied by the caller on the record and never derived, recomputed, or defaulted afterwards. AD-21 requires mode to be "fixed before ingest", and owed item 4 records what its absence costs: the same sealed run could be relabelled after ingest and scored under the same scoring version. Required rather than optional, which makes this a BREAKING `schemaVersion` bump under AD-11, whose rule is that "adding an optional field is a `schemaVersion` bump recorded in the field\'s own description; removing or retyping is breaking". A version-1 record carries no mode, and no default may repair one into a version-2 record, because a defaulted mode is the relabelling this field exists to stop. A record presenting no mode fails to parse, which AD-28 makes a `schema-parse-failure` fault rather than an AD-21 verdict or an AD-5 code, the same routing `evaluatorRecommendation` already records for an unrecognised value. This field is where mode is read from; the evidence artifact restates it and is never the source.',
		),
```

The description names no story number, and the quoting is single-quoted with escaped
apostrophes, because `check:boundary` and `biome` respectively require it; Decision 9 carries both.

The record's own `.meta` description is corrected in the same edit: its "two constructions are
deliberately absent" sentence named the run MODE as one of them, and that half is now false. The
ORDERING half stays, worded as owed item 2's.

Three consequences follow from the position and must all land:

1. `schemas/sealed-run-record.schema.json` gains `mode` in `properties` and in `required`, both
   between `conditionArm` and `trialIndex`, because the export preserves declaration order.
2. `tests/schemas/fixtures/artifact-fixtures.ts:139` gains `mode: 'contract-scoring'` and moves to
   `schemaVersion: 2`. The fixture is the only place in the repository where a Sealed Run Record
   version number is written down, so it is where the bump is visible. `contract-scoring` and not
   `production`, because the fixture's `evaluatorRecommendation` is already `'FAIL'` against a
   knowingly defective probe and the evidence-artifact fixture it pairs with is already the
   `contract-scoring` branch; a `production` fixture here would pair a system-directed FAIL with a
   mode whose ladder promotes it, which is the conflation AD-21 exists to prevent.
3. The spike worked example fails one more way. `WORKED_EXAMPLE_RECORD_ISSUES` gains
   `{ path: ['mode'], code: 'invalid_value' }` immediately after the `revisionCount` entry — Zod
   reports in declaration order, and `mode` precedes `oracleDispositions` — and
   `tests/schemas/worked-example-artifacts.test.ts:22,26` moves from sixty to sixty-one, with the
   `it` title updated to match. **The JSON at
   `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/spike-worked-example/sealed-run-record.json`
   is not touched.** Owed item 7 forbids hand-correcting it; Story 7.9 regenerates it. The fixture
   is that file verbatim and stays verbatim.

No `.default()`, no `.optional()`, no `.catch()`, and no `.nullable()` anywhere on this field. Each
of the four would reintroduce the defect: three of them supply a mode nobody declared, and the
fourth makes "no mode" a legal parse.

### AC 4: `src/core/schemas/evidence-artifact.ts` — one sentence, no shape  (VERBATIM edit)

The final sentence of the `EvidenceArtifact` `.meta` description becomes false the moment AC 3
lands. Replace the trailing clause so the description reads:

```ts
		description:
			"The scored output, owned by `emit` per AD-24, with no prior art; `score` produces the outcome and verdict values it serializes. The two modes are separate branches because AD-21 requires that the production verdict and the contract verdict never share a field. Mode is no longer first stated here: the Sealed Run Record now carries a required `mode`, where AD-21's \"fixed before ingest\" puts it, so this artifact restates a mode the sealed record already fixed and is never the source. Owed item 4's remaining clauses stay open, namely mode entering AD-11's identity inputs, the two assessment input types with their own ladders, and cross-mode comparison rejected.",
```

**This is a description change, not a shape change, so the evidence artifact does NOT bump its
`schemaVersion` here.** AD-11 bumps on fields; descriptions are carried into the published document
and so the regenerated `schemas/evidence-artifact.schema.json` changes bytes, which the drift check
requires and which is not a break. Story 7.7 owns the evidence artifact's next bump and the fixture
value that expresses it.

### AC 5: `src/core/lineage/stage-table.ts` — the `ingest` row names mode  (VERBATIM)

Owed item 6's words are "the source of run mode is absent" from the stage-signature table. A row
naming `sealed-run-record` alone says which bytes arrive, not which value fixes the run's mode. Add
a closed column rather than widening `inputs`, whose element type is
`InterchangeArtifactKey | InternalProduct` and which three consumers already read as artifacts —
test case 5's internal-product walk, test case 10's membership assertion, and the `check:lineage`
allowlist derivation.

Add above `StageSignature`:

```ts
/**
 * Values a stage receives at its boundary that are not artifacts. AD-24 writes
 * the table in artifacts, and owed item 6 records the source of run mode as
 * absent from it. Closed rather than free text, so the column cannot become a
 * notes field.
 */
export const STAGE_VALUE_INPUTS = ['mode'] as const

export type StageValueInput = (typeof STAGE_VALUE_INPUTS)[number]
```

Add to `StageSignature`, after `inputs`:

```ts
	/** non-artifact values the stage receives; see STAGE_VALUE_INPUTS. */
	readonly valueInputs: readonly StageValueInput[]
```

Give every stage the column. Five carry `valueInputs: []`. `ingest` carries:

```ts
	ingest: {
		inputs: [
			'sealed-run-record',
			'isolation-manifest',
			'evaluator-configuration',
		],
		// Mode arrives on the sealed run record and is named here because owed
		// item 6 asks the table for the source of run mode. `ingest` is the last
		// stage that may read it from the caller and the first that may reject
		// its absence; no later stage derives, recomputes, or defaults it.
		valueInputs: ['mode'],
		owns: 'validated-observations',
		ownsInterchange: null,
		lineage: 'none',
		module: null,
	},
```

`module` stays `null` for `ingest`, `score`, and `emit`. The epic preamble is explicit that Epic 7
does not fill them in.

### AC 6: regeneration

Run `npm run generate:schemas`. Two files change: `schemas/sealed-run-record.schema.json` (the new
property, the new `required` entry, the new `enum`) and `schemas/evidence-artifact.schema.json` (the
corrected root description). Never hand-edit either; `npm run check:schemas` compares committed bytes
against the same builder that wrote them, so a hand edit fails the drift check by construction.

### AC 7: AD-13's four checks, with a fixture for the new constraint

Two reject cases in `tests/schemas/fixtures/artifact-reject-cases.ts`, in the
`---- sealed-run-record ----` block, each a valid positive fixture mutated to violate exactly one
constraint:

```ts
	{
		id: 'record-mode-absent',
		artifact: 'sealed-run-record',
		constraint: "the run mode is required (AD-21, owed item 4)",
		mutate: (record) => {
			delete record.mode
		},
		issuePath: ['mode'],
		// A missing key on an enum member resolves `undefined` against the two
		// values, so Zod reports `invalid_value` where a missing string reports
		// `invalid_type`. The published schema still reports `required`.
		issueCode: 'invalid_value',
		keyword: 'required',
		instancePath: '',
		errorParams: { missingProperty: 'mode' },
	},
	{
		id: 'record-mode-outside-the-two',
		artifact: 'sealed-run-record',
		constraint: "the run mode is AD-21's production or contract-scoring",
		mutate: (record) => {
			record.mode = 'shadow'
		},
		issuePath: ['mode'],
		issueCode: 'invalid_value',
		keyword: 'enum',
		instancePath: '/mode',
	},
```

`instancePath: ''` with `errorParams` on the first, because `required` reports at the parent and
names the dropped key in `params`; `published-rejection.test.ts` already handles the three
parent-reporting keywords and `preflight-fixture-digest-absent` is the precedent to copy.

All four AD-13 checks must pass with no other edit:

1. **Rejection suite** — `artifact-reject-fixtures.test.ts` runs the Zod half and
   `published-rejection.test.ts` the published half; both enumerate `ARTIFACT_REJECT_CASES`, so the
   two new cases are picked up with no registration step.
2. **Drift** — `npm run check:schemas`, green only after AC 6 has been run and both regenerated
   files committed.
3. **Differential** — `differential.test.ts` compares Zod acceptance against published-schema
   acceptance over the generated corpus. The new `enum` and the new `required` entry are ordinary
   keywords with native exports, so **no constraint-ledger entry is added**: the ledger is for
   constraints the export cannot carry, and this one it carries.
4. **Keyword mutation** — `keyword-mutation.test.ts` deletes each keyword occurrence and requires a
   corpus member to change verdict. Occurrences are computed from the document and mutants are
   generated, so `/properties/mode/enum` and the `required` array are swept automatically; the two
   hand-written cases above are what kill them if the generator's mutant does not.

If the sweep reports a survivor at a `mode` pointer, the fix is a fixture, never an exemption. The
exemption set is computed and asserted equal to the survivor list precisely so a hand-added
exemption cannot hide a missing fixture.

Four pinned counters move with the two new fixtures and the two new keyword occurrences, and each
is pinned on purpose so it cannot drift silently:

| Counter | From | To |
| --- | --- | --- |
| `ARTIFACT_REJECT_CASES` length | 68 | 70 |
| `PUBLISHED_REJECT_CASES` length | 112 | 114 |
| `CENSUS_BY_DOCUMENT['sealed-run-record']` | 287 | 289 |
| `CENSUS_TOTAL`, with `enum` 56→57 and `type` 1000→1001 | 2272 | 2274 |

### AC 8: tests

**`tests/schemas/artifacts.test.ts`**, in the Sealed Run Record describe block:

1. The value space is exactly the two members: `expect(RUN_MODES).toEqual(['production', 'contract-scoring'])`
   and both parse through `SealedRunRecord`.
2. The field carries no default and no optional wrapper. Assert the schema node's own type rather
   than only that a missing key fails, because `.default()` would still fail a bare `undefined` in
   some spellings while silently supplying a value at parse time:
   `expect(SealedRunRecord.shape.mode.def.type).toBe('enum')`.
3. A record with no mode fails, with issue code `invalid_value` at `['mode']` — the AC's "fails
   ingest validation as a schema error" clause, with the comment recording that a parse failure is
   AD-28's `schema-parse-failure` fault and never an AD-21 rung.
4. The evidence artifact's two branch discriminators equal `RUN_MODES`, walking
   `EvidenceArtifact.options` and reading each branch's `mode` literal. This is the drift guard
   between the two spellings; see Decision 2 for why the union keeps its literals.

**`tests/lineage/stage-table.test.ts`**, continuing the numbered cases:

11. Every `valueInputs` member is in `STAGE_VALUE_INPUTS`, for every stage.
12. `ingest` is the only stage naming `mode`, and it names it — the table-level form of "one stage
    fixes the run's mode".

**`tests/schemas/worked-example-artifacts.test.ts`**: sixty becomes sixty-one, in the assertion and
in the `it` title.

No new test file. Every case belongs in a suite that already exists and already enumerates the
thing it is extending.

### AC 9: the gate

`npm run validate` is green end to end. The steps this story can move are `typecheck` (the new
column makes every `STAGE_SIGNATURES` entry incomplete until `valueInputs` is added to all six),
`check:schemas` (fails until AC 6 runs), `check:lineage` (reads `LINEAGE_WRITER_MODULES`, which the
new column must not disturb), and `test:coverage` (the `core/` floor is ninety percent statement and
branch; a schema field and a data column add no branches).

## Decisions taken during story creation

**1. `mode` sits between `conditionArm` and `trialIndex`, and the position is load-bearing.**
Declaration order is the export order and the Zod issue order, so the position decides three
downstream facts: where `mode` appears in `properties` and `required` in the published file, and
where the new entry goes in `WORKED_EXAMPLE_RECORD_ISSUES`. Placing it beside `conditionArm` groups
the two labels that say what kind of run this was, and keeps it ahead of `trialIndex`, which is
about which run this is rather than what it means. Any other position works mechanically; this one
is chosen so a reader of the published schema meets mode before the digests.

**2. `RUN_MODES` lives on the record; the evidence artifact keeps its literals and gains a test.**
`evidence-artifact.ts` already imports `OracleDispositionValue` from `sealed-run-record.ts`, so
importing `RUN_MODES` and writing `z.literal(RUN_MODES[0])` would type-check and export
byte-identically. It is not done. A discriminated union is read branch by branch and
`mode: z.literal('production')` says which branch this is at a glance, where `RUN_MODES[0]` makes
the reader resolve an index to find out. The drift risk that indirection would close is closed
instead by AC 8 case 4, which asserts the union's two discriminators equal `RUN_MODES` — a failing
test names the drift, where the indirection would only have prevented one spelling of it. The second
reason is diff hygiene: Story 7.7 owns this file's next real change, and an unrelated structural
edit here would muddy that diff.

**3. The evidence artifact's description is corrected here rather than in 7.7.** Its current text
asserts "the Sealed Run Record still carries no mode", which this story makes false. Shipping a
schema whose published description states the opposite of the schema beside it is worse than a
regenerated byte diff. It changes no field, so it is not an AD-11 break and does not consume 7.7's
bump; AC 4 says so in the file itself so a later reader does not mistake the byte change for one.

**4. `valueInputs` is a new closed column, not a widened `inputs`.** `inputs` is typed
`readonly (InterchangeArtifactKey | InternalProduct)[]` and three consumers read it as artifacts:
test case 5 walks it for internal-product reachability, test case 10 asserts every member is one of
the two registries, and the lineage-writer derivation walks the table beside it. Putting a value
into that array would either break case 10 or force a third member into the union type, which would
let a future edit name a value where an artifact belongs. A closed one-member vocabulary that Story
7.2 and 7.7 can extend costs one type and one column and keeps both readings honest.

**5. The bump is expressed as the fixture's version value, because the repository has no per-artifact
version constant.** `lineage.ts:20-25` deliberately keeps `schemaVersion` as `z.int().min(1)` rather
than `z.literal(1)`, so no schema pins a version, and `INTERCHANGE_ARTIFACTS` records prior art and
lineage but not versions. The only written-down Sealed Run Record version is the accept fixture's,
so that value moving from 1 to 2 is the bump. A version registry would be a real improvement and a
real scope increase; it is not minted here, and the argument is recorded so a later story can pick
it up with the reasoning intact rather than rediscovering it.

**6. "Never derived, recomputed, or defaulted afterwards" is enforced by three mechanisms and one
inherited obligation, and the story says which is which.** Mechanically: the schema carries no
default or optional wrapper and AC 8 case 2 asserts the node type; a missing mode fails to parse and
AC 7's `record-mode-absent` fixture holds that in both the Zod and the published suites; and the
stage table names mode on `ingest` alone, with AC 8 case 12 asserting no other stage claims it.
Inherited: no `score` or `emit` module exists to derive a mode in, so the rule has no code to police
yet, and Story 7.7 is where "mode is read from the sealed record rather than from the evidence
artifact" becomes executable. A token scanner in the shape of `check:lineage` was considered and
rejected: `mode` is a common identifier, the scanner's declaration-path exemption would blanket
`src/core/schemas/` where both current writers live, and it would police a surface that is currently
empty. Recorded here rather than escalated, per the epic preamble's own rule that a decision written
where the work happens is checkable against a fixture.

**7. A record with no mode is a fault, not a verdict, and the precedent is already in the tree.**
`verdict.ts:25` records the same routing for an unrecognised `evaluatorRecommendation`: the value
fails to parse, which is an AD-28 `schema-parse-failure` fault, and "a fault never becomes a
verdict". Exit code five, outside AD-21's verdict range, which is what the AC's "rather than
degrading a verdict" asks for. No AD-5 code is minted: AD-5 is compile-time only and `compile` never
sees a run record, which is the same reasoning the epic preamble applies to Story 7.2's
selector-ambiguity condition.

**8. The fixture's mode is `contract-scoring`.** Stated in AC 3 with its reason; repeated here
because it is the one value choice in the story that a reviewer could reasonably have made
differently. The pairing argument decides it: the run-record fixture already carries
`evaluatorRecommendation: 'FAIL'` and pairs with a `contract-scoring` evidence fixture, and AD-21 is
explicit that a system-directed FAIL is an input in that mode rather than a signal.

**9. No shipped description names a story number, and the reason is a gate rather than a style
preference.** The first draft of both descriptions cited "Story 7.1" and "Story 7.7" so a reader
could find the owner of each remaining clause. `npm run check:boundary` rejected all six sites:
AD-15 forbids the package knowing about BMad, TEA, or planning artifacts, and the scanner's `story`
token covers the word wherever it appears in `src/`, `schemas/`, `corpus/`, or `package.json`. The
descriptions now carry the owed-item number and the AD, which is the vocabulary the rest of the
schema layer already uses and which survives a renumbering of the epic. A second gate shapes the
same string: `biome` prefers single quotes and rewrites a double-quoted description whose escaped
double quotes outnumber its apostrophes, which is why the `mode` description is single-quoted with
escaped apostrophes while its neighbours are not.

**10. A missing enum key reports `invalid_value`, not `invalid_type`.** The reject fixture and the
schema test were both written against `invalid_type` on the precedent of
`preflight-fixture-digest-absent`, whose absent field is a string. Zod resolves a missing key by
running `undefined` through the member schema, and an enum answers with `invalid_value` where a
string answers with `invalid_type`. The published side is unaffected: ajv reports `required` at the
parent for both. Recorded because the same trap waits for every later story that makes an
enum-valued field required, which Story 7.2's selector cardinality is.

## Tasks / Subtasks

- [x] Task 1: the value space and the field (AC 2, AC 3)
  - [x] Add `RUN_MODES`, `RunModeValue`, and `RunMode` to `sealed-run-record.ts`
  - [x] Add `mode` between `conditionArm` and `trialIndex` with the AC 3 description
  - [x] Move the accept fixture to `schemaVersion: 2` and give it `mode: 'contract-scoring'`
- [x] Task 2: the two files the field falsifies (AC 4, AC 3 consequence 3)
  - [x] Correct the `EvidenceArtifact` description; change no field
  - [x] Add the `['mode']` entry to `WORKED_EXAMPLE_RECORD_ISSUES` after `revisionCount`
  - [x] Move sixty to sixty-one in `worked-example-artifacts.test.ts`, title included
  - [x] Leave `spike-worked-example/sealed-run-record.json` untouched
- [x] Task 3: the stage table (AC 5)
  - [x] Add `STAGE_VALUE_INPUTS`, `StageValueInput`, and the `valueInputs` column
  - [x] Give all six stages the column; `ingest` gets `['mode']`, the rest `[]`
- [x] Task 4: regeneration (AC 6)
  - [x] `npm run generate:schemas`; confirm exactly two files changed
- [x] Task 5: fixtures and tests (AC 7, AC 8)
  - [x] Two reject cases in the `sealed-run-record` block
  - [x] Four cases in `artifacts.test.ts`, two in `stage-table.test.ts`
- [x] Task 6: the gate (AC 9)
  - [x] `npm run validate` green end to end
  - [x] Leave every change uncommitted on the current branch

## Dev Notes

### Read these files before writing anything

| Path | Why |
| --- | --- |
| `src/core/schemas/sealed-run-record.ts:257-303` | the property bag and the `.meta` description that names the gap |
| `src/core/schemas/lineage.ts:19-33` | why `schemaVersion` is `z.int().min(1)` and not a literal |
| `src/core/schemas/evidence-artifact.ts:289-321` | the mode union and the description being corrected |
| `src/core/lineage/stage-table.ts:45-115` | `StageSignature` and the six rows |
| `tests/schemas/fixtures/artifact-fixtures.ts:139-254` | the run-record accept fixture |
| `tests/schemas/fixtures/artifact-reject-cases.ts:135-245, 556-568` | the record block and the `required`-keyword precedent |
| `tests/schemas/published/published-rejection.test.ts:57-70` | the three parent-reporting keywords |
| `tests/lineage/stage-table.test.ts` | the ten numbered cases this story extends |
| `ARCHITECTURE-SPINE.md:285, 297, 362, 382, 694-700, 721-726` | AD-11, AD-13, AD-21, AD-24, owed items 4 and 6 |

### Previous-story intelligence

Story 6.4 built `stage-table.ts` and its ten test cases; its own AC 1 recorded which half of owed
item 6 it left open, and that half is this story. Its table is data with a derivation function over
it (`deriveLineageWriterModules`), and case 6 exists to prove the derivation reads whichever table it
is handed rather than a module-level snapshot. The new column must not disturb that: it is data on
the same rows, read by nothing but the two new tests.

Story 6.5 shipped `--strict` at `src/cli/arguments.ts:104` and the exit-code ladder at
`src/cli/exit-codes.ts`. Neither is touched here. The epic preamble names them so a later story does
not rebuild them, and it is worth knowing they exist before reading AD-21 and reaching for the CLI.

Story 1.5 built the four AD-13 checks. Its central lesson is in the keyword-mutation header comment:
survivors and the generator's unreachable list are asserted *equal* to a computed exemption set, so
the way to fix a survivor is a fixture and never a list entry.

### Project structure notes

`src/core/schemas/` is the declaration layer; `check:layers` enforces the direction, and
`evidence-artifact.ts` importing from `sealed-run-record.ts` is an existing intra-layer edge that is
already permitted. `schemas/` and `corpus/` are excluded from the formatter per AD-13, which is why
a regenerated file is never reformatted by `lint:fix`.

### Testing requirements

Vitest, run through `npm run test:coverage` inside `validate`; `core/` is gated at ninety percent
statement and branch. Reject fixtures assert the Zod issue path and code on the Zod side and the
validator keyword and instance path on the published side — a bare "did not parse" is what AD-13
calls a suite that stays green while the constraint vanishes.

### References

- `ARCHITECTURE-SPINE.md:285` — AD-11: version identity, the bump rule, the disclosure list
- `ARCHITECTURE-SPINE.md:297` — AD-13: the four checks and the per-constraint proof rule
- `ARCHITECTURE-SPINE.md:362` — AD-21: "every run declares its mode, and the mode is an input to derivation"; "mode has to be fixed before ingest and enter identity"
- `ARCHITECTURE-SPINE.md:382` — AD-24: the stage-signature table
- `ARCHITECTURE-SPINE.md:694-700` — owed item 4, mode separation
- `ARCHITECTURE-SPINE.md:721-726` — owed item 6, the stage table and the source of run mode
- `_bmad-output/planning-artifacts/epics.md` — Epic 7 preamble and Story 7.1

## Suggested Review Order

1. `src/core/schemas/sealed-run-record.ts` — the value space, the field, and its description
2. `src/core/lineage/stage-table.ts` — the column and the `ingest` row
3. `src/core/schemas/evidence-artifact.ts` — one sentence, no shape
4. `schemas/*.schema.json` — regenerated; confirm two files and no hand edits
5. `tests/schemas/fixtures/` — the accept fixture's two new lines, the two reject cases
6. `tests/schemas/artifacts.test.ts`, `tests/lineage/stage-table.test.ts` — the six new cases
7. `tests/schemas/fixtures/worked-example-artifacts.ts` and its test — sixty-one, and the JSON untouched

## Story Review Record

## Implementation Review Record

## Peer Review Record

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context), `claude-opus-5[1m]`.

### Debug Log References

`npm run validate` green end to end: build, typecheck, lint, check:docs, check:doc-invocations,
check:shareable, lint:spine, check:vectors, check:schemas, check:ad5-registry, check:ad28-registry,
check:ad31-table, check:layers, check:lineage, check:boundary, check:corpus, check:website-deps,
test:coverage. 86 test files, 2829 tests, 0 failures. Coverage 96.85 percent statements, 92.25
percent branches, against the ninety-percent `core/` floor.

Three gates fired during implementation and each is recorded as a decision rather than worked
around:

1. `npm run check:boundary` rejected six sites where a description named "Story 7.1" or
   "Story 7.7" (AD-15, the scanner's `story` token). Both descriptions were rewritten in owed-item
   and AD vocabulary. Decision 9.
2. `biome check` rewrote the `mode` description to single quotes with escaped apostrophes, because
   its escaped double quotes outnumber its apostrophes. Decision 9.
3. The reject fixture and the schema test asserted `invalid_type` for a missing `mode`; Zod reports
   `invalid_value` for a missing enum key. Decision 10.

Four pinned counters moved with the change, all listed in AC 7: two reject-corpus sizes and two
keyword-census numbers.

### Completion Notes List

- `SealedRunRecord` carries a required `mode` over the closed value space `production` and
  `contract-scoring`, declared as `RUN_MODES` / `RunModeValue` / `RunMode` on the record itself.
  The field sits between `conditionArm` and `trialIndex`, which is where it lands in `properties`
  and `required` in the published document.
- The bump is breaking and is expressed as the accept fixture's `schemaVersion` moving from 1 to 2,
  with the reason written into the field's own description as AD-11 requires. Decision 5 records
  why the fixture is the only place a version number lives.
- `stage-table.ts` gains a closed `valueInputs` column; `ingest` names `mode` and no other stage
  does, which is owed item 6's "the source of run mode is absent" answered in the table itself.
  `module` stays `null` for `ingest`, `score`, and `emit`.
- Two descriptions that asserted the gap were corrected: the record's "two constructions are
  deliberately absent" sentence keeps only its ORDERING half, and the evidence artifact's "the
  Sealed Run Record still carries no mode" clause is replaced. No evidence-artifact field changed,
  so its `schemaVersion` is untouched and Story 7.7's bump is intact. Decision 3.
- AD-13's four checks are green with two new reject fixtures (`record-mode-absent`,
  `record-mode-outside-the-two`), and six new test cases across `artifacts.test.ts` and
  `stage-table.test.ts`.
- The spike worked example is not repaired. It now fails in sixty-one recorded ways rather than
  sixty; the JSON under `spike-worked-example/` was not touched, per owed item 7.
- Nothing was escalated to a spine revision or an ADR. Every open question is settled by
  construction and recorded in Decisions 1 through 10.

### File List

Source:

- `src/core/schemas/sealed-run-record.ts` — `RUN_MODES`, `RunModeValue`, `RunMode`, the required
  `mode` field, and the corrected `.meta` description
- `src/core/schemas/evidence-artifact.ts` — one description sentence; no shape change
- `src/core/lineage/stage-table.ts` — `STAGE_VALUE_INPUTS`, `StageValueInput`, the `valueInputs`
  column on all six rows

Generated, never hand-edited:

- `schemas/sealed-run-record.schema.json`
- `schemas/evidence-artifact.schema.json`

Tests and fixtures:

- `tests/schemas/fixtures/artifact-fixtures.ts`
- `tests/schemas/fixtures/artifact-reject-cases.ts`
- `tests/schemas/fixtures/worked-example-artifacts.ts`
- `tests/schemas/artifacts.test.ts`
- `tests/schemas/worked-example-artifacts.test.ts`
- `tests/lineage/stage-table.test.ts`
- `tests/schemas/published/published-rejection.test.ts`
- `tests/schemas/published/differential.test.ts`
- `tests/schemas/published/keyword-mutation.test.ts`

Tracking:

- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/7-1-the-run-mode-source-and-the-sealed-run-records-mode-field.md`

## Change Log

| Date | Change |
| --- | --- |
| 2026-08-31 | Story created, implemented, and `npm run validate` green. Status: review. |

## Decision 11: the record-versus-artifact mode agreement is named, not enforced

Raised by CodeRabbit on PR #47: `SealedRunRecord.mode` is authoritative, `EvidenceArtifact`
validates only its own mode, and no producer compares the two, so a `production` record can pair
with a `contract-scoring` artifact.

The finding is correct and the check does not belong in this story. `score` and `emit` both carry
`module: null` in `src/core/lineage/stage-table.ts` for the whole of Epic 7, so no code holds both
artifacts at once and there is nowhere to put a comparison that would ever run. `serializeArtifact`
takes one artifact and never a pair. Writing the check against `unknown` at the serialization
boundary would put a cross-artifact rule in an adapter, which AD-1 and AD-34 both forbid.

What this story does instead is what `src/core/schemas/probe.ts` does for AD-9's unenforced
qualification rule: name the cost in the schema description so a reader finds it, and give it an
owner. Story 7.7's acceptance criteria now carry the rejection in both directions, because 7.7 is
where a producer first reads mode off the record to choose a ladder. The vocabulary agreement that
*can* be checked today is checked: `tests/schemas/artifacts.test.ts` asserts that `RUN_MODES` equals
the evidence artifact's two branch discriminators, so the two spellings cannot drift apart.
