---
epic: 5
story: 3
key: 5-3-the-contract-fixture-corpus-and-the-regenerated-table
baseline_commit: 95ed961f8e7595fa13f9ce8406501d5848525257
---

# Story 5.3: The contract fixture corpus and the regenerated table

Status: review

## Story

As the proof the predicates work,
I want a hand-authored contract corpus exercising every AD-20 rule in every relevance-and-satisfaction
combination,
so that the published table is emitted by the implementation rather than maintained beside it.

## Acceptance Criteria

### AC 1: Module location, scope, and what this story does not build

Two new source files under `src/core/coverage/`:

- `src/core/coverage/coverage.ts` (NEW): `evaluateCoverage`, which pairs the two verdict arrays into
  `CoverageGap` records, and `coverageSeverity`, the declaration-only severity derivation the record
  needs.
- `src/core/coverage/table.ts` (NEW): the pure builder that renders the AD-31 document from a corpus
  it is handed. No filesystem, no clock, no randomness (AD-1).

One new fixture module:

- `tests/coverage/fixtures/corpus.ts` (NEW): the nineteen hand-authored contracts and the
  twenty-eight-cell index over them.

Two new scripts and one generated document:

- `scripts/generate-ad31-table.ts` (NEW): the thin I/O writer. `npm run generate:ad31-table`.
- `scripts/check-ad31-table.ts` (NEW): the byte-exact drift check. `npm run check:ad31-table`.
- `docs/ad31-coverage-predicates.generated.md` (NEW, generated, committed).

Three new test files:

- `tests/coverage/corpus.test.ts` (NEW): fixtures 151 through 190.
- `tests/coverage/coverage.test.ts` (NEW): fixtures 191 through 212.
- `tests/coverage/table.test.ts` (NEW): fixtures 213 through 231.

Six edited files:

- `package.json` (UPDATE): two script entries, and both added to the `validate` chain.
- `.github/workflows/pr-checks.yml` (UPDATE): a named step in `validate-and-build`, a named step in
  `floor`, the `validate` step's own `name:` string, and one new `canary-ad31-table` job.
- `README.md` (UPDATE): one paragraph naming the generated document, following the paragraph the
  README already carries for `schemas/`.
- `tests/schemas/fixtures/artifact-fixtures.ts` (UPDATE): the one `CoverageGap` fixture's two
  predicate strings, moved to the spellings this package actually emits. See Decision 9.
- `src/core/schemas/eval-contract.ts` (UPDATE): one line, `export type Severity =
  (typeof SEVERITY_LEVELS)[number]`, beside `export type ForbiddenInput` at `:94`.
  **Deviation, implementation:** the alias ships beside `export const Severity` rather than at
  `:94`, following that file's own `:29-35` instruction that the severity vocabulary is spelled
  once in one place. The pattern is `ForbiddenInput`'s; the location is the `Severity` declaration.
  **Deviation, implementation:** `src/core/schemas/evidence-artifact.ts` is a seventh edited file,
  gaining `export type CoverageGap = z.infer<typeof CoverageGap>` beside the schema at `:159`. AC 5's
  `import type { z } from 'zod'` in `core/coverage/` fails `check:layers` with "core/ (excluding
  core/schemas) may not import an external module or Node builtin", which AC 11 requires at zero
  violations. Task 3's own subtask asked for exactly this reuse. Measured: `check:schemas` still
  reports twelve, and `check:layers` reports 59 files and 0 violations. The file exports
  `Severity` as a Zod value only, so `import { type Severity }` resolves to the schema object's type
  rather than the three-member union, and `coverageSeverity`'s declared return type does not compile
  without this. Measured: `npm run check:schemas` still reports twelve, because a type alias emits no
  JSON Schema byte. See AC 5.
- `_bmad-output/project-knowledge/learning-path-step-by-step.md` (UPDATE): Step 18 and its index row.

`src/core/coverage/` and `tests/coverage/` exist at the baseline commit and carry Stories 5.1 and
5.2's five files. `scripts/dependency-direction.ts:53` classifies anything under `src/core/` as the
`core` layer and `isAllowedEdge` permits `core` to import `core`, so `coverage.ts` and `table.ts` may
import from `core/coverage/`, `core/compile/`, `core/seal/`, and `core/schemas/` with no change to
the layer graph, the checker, or `tests/architecture/dependency-direction.test.ts`.

**This story does not build:**

1. Any change to `src/core/coverage/relevance.ts` or `src/core/coverage/satisfaction.ts`. The
   fourteen predicates ship unchanged, byte for byte. This story is their publication, and a story
   that both changes a predicate and publishes it cannot tell a corrected predicate from a corrected
   table.
2. Any change to `src/core/coverage/rules.ts`. `DISCIPLINE_RULES`, `relevancePredicateId`, and
   `satisfactionPredicateId` are exactly what the table renders; the module needs nothing added.
3. Any change to `tests/coverage/relevance.test.ts`, `tests/coverage/satisfaction.test.ts`,
   `tests/coverage/rules.test.ts`, or `tests/coverage/fixtures/satisfaction-contracts.ts`. Stories
   5.1 and 5.2's 150 fixtures ship unchanged. `corpus.ts` imports `satisfiedContract` from the
   existing fixture module rather than copying it (Decision 3).
4. Any change to `src/core/compile/compile.ts`, its nineteen-call order, its `EvalContract` return
   type, `src/core/stage-contracts.ts`, or `src/application/compile.ts`. Decision 8 states why the
   coverage record is not wired into the compile stage and which story inherits the wiring.
5. Any change to `src/index.ts`. Story 6.5 owns the published surface, matching every Epic 3, Epic 4,
   and Epic 5 story so far.
6. Any AD-5 code. Coverage gaps never block compilation (`ARCHITECTURE-SPINE.md:251`: "a coverage gap
   emits the artifact with the gap recorded and never blocks"), so nothing here throws
   `StructuralFailure` and `FAILURE_CODES` stays at twenty-one members.
7. Any change to a schema's *shape*. `CoverageGap` (`src/core/schemas/evidence-artifact.ts:148-159`)
   already carries every field the record needs, and adding a `reason` field would change the
   published JSON Schema, its byte-exact drift check, and its reject corpus for a field no AD
   requires. Decision 6. The one `eval-contract.ts` edit above adds a type alias and no field, so
   `check:schemas` stays at twelve; that was measured, not assumed.
8. Any repair to the historical worked example. `spike-worked-example/*.json` and
   `tests/schemas/fixtures/worked-example-artifacts.ts` are untouched. AD-31 forbids publishing
   against them and Owed item 7 (`ARCHITECTURE-SPINE.md:728-741`) forbids hand-patching them into
   apparent conformance.
9. Any `corpus/` directory. The Structural Seed's `corpus/dev/` (`ARCHITECTURE-SPINE.md:600`) is
   AD-38's visible probe corpus, is score-side, and is not this. Decision 2 states where AD-31's
   corpus lives and why.

### AC 2: `tests/coverage/fixtures/corpus.ts`, the four declaration states and the cell index

AD-31's own sentence supplies the state space (`ARCHITECTURE-SPINE.md:455`):

> Where a declaration is absent, or is present but resolves to an enumerated indeterminate descriptor
> state, the rule is relevant and its absence is a coverage gap; "unspecific" is that enumerated set
> and nothing broader. Under-declaration therefore costs coverage rather than earning a clean result,
> while an explicit empty declaration is an answer rather than a gap.

That is three declaration states, and a populated declaration splits into witnessed and unwitnessed,
giving four:

| State | Declaration | Relevant | Satisfied | Meaning |
| --- | --- | --- | --- | --- |
| `absent` | in its `null` state, or the operation inventory itself empty | `true` | `false` | under-declaration costs coverage |
| `explicitly-empty` | present and empty | `false` | `true` | an explicit empty declaration is an answer |
| `witnessed` | populated, and an oracle reads it | `true` | `true` | the rule is discharged |
| `unwitnessed` | populated, and no oracle reads it | `true` | `false` | the gap AD-31 exists to surface |

Seven rules times four states is twenty-eight cells. Story 5.2 Decision 11
(`5-2-the-seven-satisfaction-predicates.md:1736-1738`) expected this story to extend fixture 67's
invariant "against twenty-eight more contracts"; that sentence counts contracts, and this corpus is
nineteen contracts across twenty-eight cells, so the two numbers are not the same claim and the
match is a coincidence rather than a prediction fulfilled. Fixture 168 measures the real count:
twenty-three contracts. The fourth *literal*
relevance-and-satisfaction combination, relevance `false` with satisfaction `false`, occupies no cell
and cannot; Decision 4 states why and fixture 168 proves it.

The vocabulary is owned by `src/core/coverage/table.ts` (AC 4), and this module imports it:

```ts
// AD-31's contract fixture corpus: nineteen hand-authored contracts covering
// every AD-20 rule in every declaration state. This is the publication target
// AD-31 names in place of the historical worked example, which stays
// deliberately inconsistent (Owed item 7) and appears nowhere here.
//
// Contracts are built by spread from the seed, which is Story 5.2's
// `satisfiedContract` parsed once. Parsing is what makes the seed assignable
// to `EvalContract`, and it de-aliases `satisfaction-contracts.ts:20-24`,
// where several transport channels are one object. Nothing here clones: a
// clone keeps that aliasing. Every override replaces a whole sub-object.
//
// Five contracts occupy a cell for more than one rule, because two rules can
// read the same declaration. Decision 5 lists them.

import type { DisciplineRule } from '../../../src/core/coverage/rules.ts'
import type { DeclarationState } from '../../../src/core/coverage/table.ts'
import { EvalContract } from '../../../src/core/schemas/eval-contract.ts'
import type { Operation } from '../../../src/core/schemas/interface.ts'
import { satisfiedContract } from './satisfaction-contracts.ts'
```

`EvalContract` is a value import here, not a type import: the seed goes through `EvalContract.parse`
for the reason the builder block below states.

Three builders, and nothing else constructs a contract in this file:

```ts
// The seed, once, through the schema. `satisfiedContract` carries a
// `satisfies EvalContract` annotation rather than a type annotation, so its
// inferred type keeps every literal, and spreading it into a value annotated
// `EvalContract` fails the typecheck: the two operations' `responseDescriptor.types`
// objects widen to a union carrying `items?: undefined`, which no
// `Record<string, KeyType>` accepts. Parsing settles that and de-aliases
// `satisfaction-contracts.ts:20-24`'s shared channel object in the same step.
const seed: EvalContract = EvalContract.parse(satisfiedContract)

const seedInterfaceOf = (): EvalContract['permittedInterfaces'][number] => {
	const declared = seed.permittedInterfaces[0]
	if (declared === undefined) throw new Error('seed declares no interface')
	return declared
}

const seedInterface = seedInterfaceOf()

const [createThing, listThings] = seedInterface.operations as [
	Operation,
	Operation,
]

/** The seed's one interface with its two operations replaced. */
const withOperations = (
	create: Operation,
	list: Operation,
): EvalContract['permittedInterfaces'] => [
	{ logicalId: 'thing-api', kind: 'api', operations: [create, list] },
]

/** One operation with named response-descriptor fields replaced. */
const withDescriptor = (
	operation: Operation,
	patch: Partial<Operation['responseDescriptor']>,
): Operation => ({
	...operation,
	responseDescriptor: { ...operation.responseDescriptor, ...patch },
})

/** One operation with named top-level fields replaced. */
const withOperation = (
	operation: Operation,
	patch: Partial<Operation>,
): Operation => ({ ...operation, ...patch })

/** The seed under a new identifier, with named top-level fields replaced. */
const variant = (
	contractId: string,
	patch: Partial<EvalContract>,
): EvalContract => ({ ...seed, contractId, ...patch })

/** A fresh channel per call, matching `satisfaction.test.ts:74-88`. */
const emptyChannel = () => ({ requiredKeys: [], permittedKeys: [], types: {} })

const emptyRequestShape = (): Operation['requestShape'] => ({
	path: emptyChannel(),
	query: emptyChannel(),
	header: emptyChannel(),
	body: emptyChannel(),
})
```

`withOperation` exists because two of the nineteen overrides are operation-level rather than
descriptor-level: `no-state-change-marker` replaces `stateChangeMarker` and `empty-request-shapes`
replaces `requestShape`, and `withDescriptor` reaches neither.

**Deviation, implementation:** three more helpers ship, for the same reason `withOperation` does.
`oracles` and `interactionPlan` have no partial spelling and none of the AC's helpers reach either,
so `withOracle(id, replacement)`, `withoutOracle(id)` and `withStep(stepId, replacement)` supply the
whole array. The replacement is a parameter, which is what gives an inline oracle or step its
contextual type: the AC's own note about a hoisted `const` losing that context is why the helper
takes it as an argument rather than building it internally.

**Deviation, implementation:** `unnamed-reference-set` and `wrong-cardinality-form` spell their one
collection location as a literal rather than patching the seed's. Reading the seed's location back
out needs a guarded accessor for a three-field object, and `withDescriptor`'s parameter type gives
the literal its contextual typing against the `ExpectedCardinality` discriminated union.

`seed.permittedInterfaces[0]` and `seedInterface.operations[n]` are both unchecked index accesses:
`permittedInterfaces` and `operations` are arrays in the schema, not tuples, so under
`noUncheckedIndexedAccess` each yields `| undefined`. That was measured against this repository's
own `tsconfig.json` with `tsc 7.0.2`, so the guard above and the tuple assertion are the shipped
spelling rather than a fallback. `biome.json:65-77` permits a non-null assertion under `tests/**` if
the dev prefers one for the interface; the throwing accessor is preferred here because a corpus whose
seed silently became `undefined` would emit a table rather than fail.

Every `variant` patch replaces a whole top-level field. `siblingGroups`, `oracles`, and
`interactionPlan` have no partial spelling, so an override naming one supplies the entire value, and
the AC 3 tables below are read that way. Oracle replacements are written inline inside the `variant`
patch, where `Partial<EvalContract>` gives them their contextual type; a replacement oracle hoisted
to a standalone `const` loses that context and fails the typecheck against the `Relation` and
`Polarity` enums.

The exported surface:

```ts
export type CorpusCell = {
	readonly rule: DisciplineRule
	readonly state: DeclarationState
	readonly contractId: string
}

/** Every distinct contract, in the order the emitted matrix reads them. */
export const CORPUS_CONTRACTS: readonly EvalContract[]

/** One entry per rule per state. Twenty-eight, and the generator fails if not. */
export const CORPUS_CELLS: readonly CorpusCell[]
```

`CORPUS_CELLS` is ordered by `DISCIPLINE_RULES` then by `DECLARATION_STATES`, so a reader scanning it
reads the coverage table's rows in the order they are rendered. `CORPUS_CONTRACTS` is ordered by
first appearance in `CORPUS_CELLS`, which makes both orders a function of the two exported tuples
rather than of authoring accident.

### AC 3: `tests/coverage/fixtures/corpus.ts`, the nineteen contracts

Each is one `variant` call with the smallest override that moves its rule into its state. The
`Override` column is exactly what the dev writes; the `Why` column is what the reader needs and is
not code.

**The witnessed contract.** `satisfiedContract` itself, `contractId: 'satisfied-declarations'`,
exported from Story 5.2's fixture module unchanged. It occupies the `witnessed` cell for all seven
rules: Story 5.2's AC 7 truth table and fixtures 59 through 129 already prove every one of its
fourteen verdicts, so this story asserts the seven pairs again in fixture 151 and adds no new claim
about it.

**The four `absent` contracts.**

| Contract | Rules it occupies | Override |
| --- | --- | --- |
| `absent-success-indicator` | 1 | `permittedInterfaces: withOperations(withDescriptor(createThing, { successIndicator: null }), listThings)` |
| `absent-collection-locations` | 4, 6 | `permittedInterfaces: withOperations(withDescriptor(createThing, { collectionLocations: null }), listThings)` |
| `absent-sibling-groups` | 5 | `siblingGroups: null` |
| `no-operation-inventory` | 2, 3, 7 | `permittedInterfaces: []` |

Rules 2, 3, and 7 read declarations with no `null` state of their own: `requiredKeys` is a required
array, `requestShape`'s four channels are required objects, and `stateChangeMarker` is a required
boolean whose two values are both legal (`relevance.ts:266-270`: "The one rule with no absent state
to grade"). The absent state of the declaration those three read is therefore the absence of the
operation inventory itself, which is exactly what `NO_OPERATION` and `NO_OPERATION_WITNESS` name.
Story 5.2 Decision 4 exported both constants "so Story 5.3 can tell an empty-inventory gap from a
declared-absence gap"; `no-operation-inventory` is where that distinction is spent.

`no-operation-inventory` keeps the seed's four-step `interactionPlan`, whose steps now name
operations no interface declares. That parses, and `buildPlanIndex` is called with
`duplicateIds: 'unresolved'` (`satisfaction.ts:62-66`), so nothing throws. It does not compile:
`checkInterfaceKind` and `checkDuplicateOperationSignature` have nothing to read and
`checkEvidenceReachability` fails first, under `unreachable-check-evidence`, on O-001's operand
`/interactions/list/response-body/items`, whose step names `list-things`. Fixture 190 records that,
and Decision 7 states why a corpus contract is not required to compile.

`no-operation-inventory` moves six of the seven rules, not seven. Rule 5's two predicates read
`siblingGroups` and resolve step identifiers through the plan index built from `interactionPlan`,
neither of which the interface inventory reaches, so the seed's operation and parameter groups stay
witnessed by O-004 and O-005 and rule 5 answers relevant and satisfied. That was measured, and
fixture 197 asserts the six.

**The seven `explicitly-empty` contracts.**

| Contract | Rule | Override |
| --- | --- | --- |
| `empty-channel-roles` | 1 | both operations' `channelRoles: {}` |
| `single-required-response-key` | 2 | `createThing`'s `requiredKeys: ['ok']` |
| `empty-request-shapes` | 3 | both operations' four request channels replaced with a fresh empty channel each |
| `empty-collection-locations` | 4 | `listThings`'s `collectionLocations: []` |
| `empty-sibling-groups` | 5 | `siblingGroups: { operations: [], parameters: [] }` |
| `unnamed-reference-set` | 6 | `listThings`'s one collection location with `referenceSet: null` |
| `no-state-change-marker` | 7 | `createThing`'s `stateChangeMarker: false` |

`empty-request-shapes` must build **four distinct** empty-channel objects, not four references to
one. The fixture module Story 5.2 shipped carries a single `emptyChannel` reused across slots
(`satisfaction-contracts.ts:20-24`), which is safe there because nothing writes through it; a corpus
that reuses it is safe for the same reason, but the dev must not reach for `structuredClone` here,
because a clone preserves the aliasing and a later reader will write through it. Author a local
`emptyChannel()` factory, matching `satisfaction.test.ts:74-88`. AC 2's `EvalContract.parse` on the
seed already de-aliases the seed's own shared channel, which was measured; the factory is what keeps
the corpus's own four slots distinct.

`empty-request-shapes` is the second corpus contract that does not compile. Emptying every request
channel of both operations makes O-005's `/interactions/create/call-inputs/body/name` and
`/interactions/list/call-inputs/query/limit` address fields no operation declares, so
`checkEvidenceReachability` fails under `unreachable-check-evidence`. The repair would be deleting
O-005, which is rule 5's parameter-group witness, so the contract would occupy a second cell and stop
being attributable. Measured; Decision 7 names both contracts and fixtures 189 and 190 count them.

`empty-channel-roles` is the explicit-empty answer and not the absent one: `channelRoles: {}` leaves
`successIndicator` nominated, so `Object.keys({}).find(...)` is `undefined`, relevance falls through
its loop, and satisfaction's `roles.some(([pointer]) => pointer !== successIndicator)` is false so
the operation is not a site. `channelRoles: null` would be the absent state and would land in a
different cell.

**The seven `unwitnessed` contracts.** Each keeps every declaration populated and removes exactly
one oracle's witness. The `Collateral` column names what the dev must verify stays put, because the
seed's seven oracles witness overlapping rules and a careless override moves two cells at once.

| Contract | Rule | Override | Collateral |
| --- | --- | --- | --- |
| `split-indicator-oracle` | 1 | O-002 is reduced to the indicator alone: `direction.evidenceTargets` becomes `['/interactions/create/response-body/ok']`, `direction.relation` becomes `'existence'`, and `check` becomes a bare `existence` on the same pointer | rule 2 also loses its witness here, which is why rule 2's own unwitnessed contract is a different shape; assert rule 2's cell on `per-key-split-oracles` |
| `per-key-split-oracles` | 2 | O-002 keeps `/ok` and `/error` in both channels under `all`; a new O-008 addresses `/id` alone, `direction.relation: 'existence'` to match its bare `existence` check | rule 1 stays witnessed, because O-002 still reads the indicator beside a `diagnostic`-roled pointer at step `create` |
| `no-type-violating-step` | 3 | step `malformed-create`'s `body.name` binding becomes `{ matcher: 'any' }` | `malformed-list` keeps its `type-violating` binding, so the predicate fails on `create-thing`, its first site |
| `no-collection-quantifier` | 4 | O-007 is removed from `oracles` | rule 6 keeps O-001's `covers-by-key`, which is not a quantifier node |
| `unaddressed-parameter-sibling` | 5 | `siblingGroups.parameters: [['limit', 'offset']]`, and no step binds `offset` | the operations group stays witnessed by O-004 and O-006, so the failing site is the parameter group and the reason names `limit and offset` |
| `wrong-cardinality-form` | 6 | `listThings`'s collection location keeps `referenceSet: 'expected-things'` and its `expectedCardinality` becomes `{ mode: 'page-bounded', max: 20 }` | rule 4 is unaffected: `perRecordSatisfaction` reads the quantifier's collection pointer and never the cardinality mode |
| `no-read-back-relation` | 7 | O-006 is removed from `oracles` | rule 5's operations group stays witnessed by O-004, which addresses `malformed-create` and `malformed-list` in both channels |

Both rows carry a compile constraint the shape has to respect. `all` requires two or more operands
(`expression.ts:373-379`, `CONNECTIVE_MINIMUM_ARITY`), so an oracle reduced to one assertion cannot
stay wrapped in `all`; and `checkOracleAlignment` requires `direction.relation` to appear somewhere
in the check tree, so a bare `existence` check needs `relation: 'existence'` beside it. Written any
other way both contracts fail `direction-check-misaligned` at compile and fixture 189 fails with
them. Both were measured.

Dropping only `/id` from O-002 does **not** move rule 1. `channelRoles` gives `/error` the
`diagnostic` role, so `/error` stays in the rule's `others` set, and an O-002 still addressing `/ok`
beside `/error` in both channels witnesses the separation. Rule 1 breaks only when the indicator is
the sole pointer the oracle reads at that step, which is why the override strips the check to one
operand. Measured: with `/error` left in place rule 1 answers relevant and satisfied and only rule 2
moves.

`unaddressed-parameter-sibling` deliberately does not break the operations group. Breaking it would
mean weakening O-004 or O-006, and O-004 is rule 3's only witness while O-006 is rule 7's, so the
contract would occupy three cells and stop being attributable. The parameter group is the one axis
rule 5 owns alone.

`wrong-cardinality-form` is the only unwitnessed contract that leaves its oracle in place. It is the
fixture that catches `reconciles` (`satisfaction.ts:539-553`) losing its mode branch, which Story
5.2's Task 7 measured as failing fixtures 113 through 117; keeping the same shape in the corpus means
the emitted table moves under that regression too.

`behaviors[0].oracles` lists O-001 through O-007 and is deliberately not refined against the declared
oracle list (`eval-contract.ts:64`), so `no-collection-quantifier` and `no-read-back-relation` leave
it alone rather than editing a linkage no code reads.

### AC 4: `src/core/coverage/table.ts`

Every block below was run through `biome check` at this file's path during story review and produces
no diff. The import order in particular is Biome's own: `./coverage.ts` before
`../schemas/eval-contract.ts` is wrong, and the order printed below is right.

```ts
/**
 * AD-31's published predicate table, emitted by the implemented predicates.
 *
 * A pure function of the corpus it is handed, so `generate-ad31-table.ts` and
 * `check-ad31-table.ts` cannot disagree about bytes, which is the split
 * `publish.ts` and its two scripts already use. Nothing here reads the
 * filesystem or the clock (AD-1).
 *
 * The historical worked example is not a publication target
 * (ARCHITECTURE-SPINE.md:455) and this builder has no way to reach it: its
 * only input is the corpus argument.
 */
import type { EvalContract } from '../schemas/eval-contract.ts'
import { evaluateCoverage } from './coverage.ts'
import { evaluateRelevance } from './relevance.ts'
import {
	DISCIPLINE_RULES,
	type DisciplineRule,
	relevancePredicateId,
	satisfactionPredicateId,
} from './rules.ts'
import { evaluateSatisfaction } from './satisfaction.ts'

/**
 * AD-31's three declaration states, plus the split of a populated declaration
 * into witnessed and unwitnessed. Ordered as the coverage table's columns.
 */
export const DECLARATION_STATES = [
	'absent',
	'explicitly-empty',
	'witnessed',
	'unwitnessed',
] as const

export type DeclarationState = (typeof DECLARATION_STATES)[number]

/** The verdict pair each state asserts. `absent` and `unwitnessed` share one; the reason tells them apart. */
export const STATE_VERDICTS: {
	readonly [State in DeclarationState]: {
		readonly relevant: boolean
		readonly satisfied: boolean
	}
} = {
	absent: { relevant: true, satisfied: false },
	'explicitly-empty': { relevant: false, satisfied: true },
	witnessed: { relevant: true, satisfied: true },
	unwitnessed: { relevant: true, satisfied: false },
}

export type CoverageCell = {
	readonly rule: DisciplineRule
	readonly state: DeclarationState
	readonly contractId: string
}
```

The renderer's byte rules, spelled once:

```ts
/**
 * A markdown cell. `|` is escaped because a reason string is free text today
 * and a contract identifier could carry one tomorrow; a broken table would
 * still be byte-stable and would still pass the drift check, so the escape is
 * the only thing standing between the two.
 */
const cell = (text: string): string => text.replace(/\|/g, '\\|')

const row = (cells: readonly string[]): string =>
	`| ${cells.map(cell).join(' | ')} |`

const table = (
	headers: readonly string[],
	rows: readonly (readonly string[])[],
): readonly string[] => [
	row(headers),
	`| ${headers.map(() => '---').join(' | ')} |`,
	...rows.map(row),
]

const code = (text: string): string => `\`${text}\``

const yesNo = (value: boolean): string => (value ? 'yes' : 'no')
```

The builder, and the three diagnoses it throws:

```ts
/**
 * The whole document. Throws a worded diagnosis rather than emitting a table
 * that lies: an unoccupied cell is the exact failure AD-31 exists to prevent,
 * and a silent blank would publish as coverage.
 */
export function coveragePredicateTable(
	contracts: readonly EvalContract[],
	cells: readonly CoverageCell[],
): string
```

Its checks, in order, each naming what failed:

1. Every member of `contracts` has a distinct `contractId`. Otherwise:
   `coveragePredicateTable: two corpus contracts share the identifier {contractId}`.
2. Every `cells[].contractId` resolves to a member of `contracts`. Otherwise:
   `coveragePredicateTable: cell {rule}/{state} names contract {contractId}, which the corpus does not carry`.
3. Every `(rule, state)` pair in `DISCIPLINE_RULES` × `DECLARATION_STATES` appears exactly once.
   Otherwise: `coveragePredicateTable: no corpus contract occupies cell {rule}/{state}` or
   `... occupies cell {rule}/{state} more than once ({ids})`.
   **Deviation, implementation:** the AC left the second message's subject as `...`; the shipped
   spelling is `coveragePredicateTable: the corpus occupies cell {rule}/{state} more than once
   ({ids})`, keeping the AC's tail verbatim. Fixture 225 asserts the whole string.
4. Every cell's contract actually produces `STATE_VERDICTS[state]` for that rule. Otherwise:
   `coveragePredicateTable: {contractId} places {rule} at relevant={a}/satisfied={b}, but cell {state} asserts relevant={c}/satisfied={d}`.

The distinctness check runs **first** because every check after it resolves a `contractId` to a
contract. With two contracts sharing an identifier that resolution is ambiguous, so checks 2 through
4 would silently grade whichever one the lookup happened to keep, and fixture 227 would pass or fail
for a reason other than the one it names.

Check 4 is the one that makes the document evidence rather than decoration: it re-runs the predicates
and refuses to render a claim the predicates do not support.

The document, section by section. Prose lines outside the tables are fixed strings; everything inside
a table is computed.

```markdown
# AD-31 coverage predicates

Generated by `npm run generate:ad31-table`. Do not edit: `npm run check:ad31-table` compares this
file byte for byte against the builder and fails on any difference.

AD-20's seven discipline rules, each with a relevance predicate and a satisfaction predicate, run
over the hand-authored contract corpus AD-31 names as their publication target. The historical
worked example is not a publication target and appears nowhere below.

## The fourteen predicates

<7 rows: Rule | Relevance predicate | Satisfaction predicate>

## Declaration-state coverage

<7 rows: Rule | Absent | Explicitly empty | Witnessed | Unwitnessed>

Each cell names the corpus contract that occupies it. Relevance `false` with satisfaction `false`
occupies no cell and cannot: a rule that is relevant for no site is satisfied vacuously, so a
relevance predicate answering `false` forces its satisfaction twin to answer `true`.

## Coverage gaps

One `CoverageGap` record per corpus contract per rule where relevance fired and satisfaction failed.

<N rows: Contract | Rule | Relevance predicate | Satisfaction predicate | Severity | Why relevance fired | Why satisfaction failed>

## The full matrix

Every corpus contract against every rule.

<19 x 7 = 133 rows: Contract | Rule | Relevant | Satisfied | Gap | Relevance reason | Satisfaction reason>
```

**Deviation, implementation:** the coverage table's four column headers are derived from
`DECLARATION_STATES` (hyphens to spaces, first letter capitalised) rather than written as fixed
strings, so a new declaration state arrives with its own header instead of a silently missing one.
The emitted bytes are the AC's `Rule | Absent | Explicitly empty | Witnessed | Unwitnessed`, measured.

Row order is `contracts` order, then `DISCIPLINE_RULES` order, in both the gaps section and the
matrix. The coverage table's row order is `DISCIPLINE_RULES` and its column order is
`DECLARATION_STATES`. Nothing sorts by a string, so no locale enters.

Serialization: the returned string joins its lines with `\n` and ends with exactly one `\n`. No line
carries trailing whitespace and no two blank lines are adjacent. Those three are exactly what
`scripts/check-docs.mjs:44-55`'s `fixWhitespace` enforces, honoured even though `docs/` is not one of
that script's roots, so that moving the file later is a one-line change rather than a fight between
two checks. Every character being ASCII is this story's own fourth rule and not one of that script's:
`check-docs.mjs` has no character-set rule at all. It is here because the drift check compares bytes,
and a non-ASCII character is the one difference an editor or a locale can introduce without anyone
touching a predicate.

### AC 5: `src/core/coverage/coverage.ts`

```ts
/**
 * AD-31's coverage-gap records: the conjunction of the two predicate families.
 *
 * A gap is a rule whose relevance fired and whose satisfaction failed
 * (ARCHITECTURE-SPINE.md:455). A rule that is not relevant produces no record,
 * and neither does a rule that is relevant and satisfied: AD-21 reads
 * `coverageGaps` as the gap list and would misfire on a satisfied entry.
 *
 * Nothing here throws. A coverage gap never blocks compilation
 * (ARCHITECTURE-SPINE.md:251), so there is no AD-5 code and no
 * `StructuralFailure`.
 */
import type { z } from 'zod'
import type { EvalContract } from '../schemas/eval-contract.ts'
import { SEVERITY_LEVELS, type Severity } from '../schemas/eval-contract.ts'
import type { CoverageGap } from '../schemas/evidence-artifact.ts'
import { evaluateRelevance } from './relevance.ts'
import { evaluateSatisfaction } from './satisfaction.ts'

export type CoverageGapRecord = z.infer<typeof CoverageGap>
```

**Deviation, implementation:** the block above does not ship. `import type { z } from 'zod'`
typechecks but fails `check:layers`, which forbids `core/` outside `core/schemas/` from importing an
external module and which AC 11 requires at zero violations. The shipped header imports
`EvalContract`, `SEVERITY_LEVELS` and `Severity` from `../schemas/eval-contract.ts` and the
`CoverageGap` **type** from `../schemas/evidence-artifact.ts`, and spells the record as
`export type CoverageGapRecord = CoverageGap`. The `z.infer` moves into
`evidence-artifact.ts`, which already imports Zod, exactly as the `Severity` alias does in
`eval-contract.ts`. Everything the three paragraphs below say about `tsc 7.0.2` was reproduced; the
layer checker is what settles the spelling.

Three things in that block were measured rather than assumed, because the draft got each of them
wrong and `tsc 7.0.2` rejects the file without all three.

`import type { z } from 'zod'` is required: `z.infer` is a type-level use, `zod` exports `z` as a
namespace as well as a value, and a type-only import keeps `core/coverage/` free of a runtime Zod
dependency it does not otherwise have. Without it the file fails with `TS2503: Cannot find namespace
'z'`. `CoverageGap` stays a type-only import; `typeof` over a type-only-imported binding is legal.

`evidence-artifact.ts` exports **no** `CoverageGap` type alias, only the Zod value at `:148`, so
`z.infer` is the spelling and there is nothing to reuse.

`eval-contract.ts` likewise exports `Severity` as a Zod value only, so `import { type Severity }`
resolves to the schema object's type and `coverageSeverity` fails with `TS2749: 'Severity' refers to
a value, but is being used as a type here`. The fix is the one line AC 1 adds to `eval-contract.ts`:
`export type Severity = (typeof SEVERITY_LEVELS)[number]`, beside the `ForbiddenInput` alias that
file already carries at `:94` for the same reason. Naming it there rather than in `core/coverage/`
follows that file's own instruction at `:29-35`, which says the severity vocabulary is spelled once
because six copies would be the drift the Consistency Conventions warn about.

```ts
/**
 * The gap's severity. AD-19 declares severity in exactly one place, per
 * behaviour, and `behaviors` carries `.min(1)`, so the maximum is total.
 *
 * The maximum rather than any other reduction because the predicates are
 * contract-level and oracle-blind, so no rule-to-behaviour join exists to draw
 * a narrower one from; and because AD-21 records a gap below the severity
 * floor without moving the verdict, so a minimum would let a contract buy a
 * silent gap by declaring one trivial behaviour beside its critical ones.
 */
export function coverageSeverity(contract: EvalContract): Severity {
	let rank = 0
	for (const behavior of contract.behaviors) {
		rank = Math.max(rank, SEVERITY_LEVELS.indexOf(behavior.severity))
	}
	return SEVERITY_LEVELS[rank]
}
```

`SEVERITY_LEVELS` is `['low', 'material', 'critical']` (`eval-contract.ts:36`), already ordered
ascending, which is why an index comparison is the whole ordering and no second table exists.
`SEVERITY_LEVELS[rank]` needs a non-null assertion under `noUncheckedIndexedAccess`;
`biome.json:56-64` turns `noNonNullAssertion` off under `src/**`, and `rank` is an index this
function produced from the same tuple. Measured: `return SEVERITY_LEVELS[rank]!` passes both
`tsc --noEmit` and `biome check` at this file's path.

```ts
/**
 * One record per rule that is relevant and not satisfied, in
 * `DISCIPLINE_RULES` order. The two verdict arrays are both returned in that
 * order, so the pairing is positional and no lookup is built.
 */
export function evaluateCoverage(
	contract: EvalContract,
): readonly CoverageGapRecord[] {
	const relevance = evaluateRelevance(contract)
	const satisfaction = evaluateSatisfaction(contract)
	const severity = coverageSeverity(contract)
	const gaps: CoverageGapRecord[] = []
	for (const [index, relevant] of relevance.entries()) {
		const satisfied = satisfaction[index]
		if (satisfied === undefined || !relevant.relevant || satisfied.satisfied) {
			continue
		}
		gaps.push({
			rule: relevant.rule,
			relevancePredicate: relevant.predicate,
			satisfactionPredicate: satisfied.predicate,
			satisfied: false,
			severity,
		})
	}
	return gaps
}
```

`satisfied === undefined` is unreachable, since both arrays are `DISCIPLINE_RULES.map(...)`. It is
present because `noUncheckedIndexedAccess` requires the narrowing and a non-null assertion here would
assert something the type system can see is true only through two other modules. Fixture 199 pins
that the two arrays agree in rule order, which is the statement the guard would otherwise hide.

`relevant.rule` fills `CoverageGap.rule`, which is an opaque `z.string().min(1)` by design
(`evidence-artifact.ts:150-153`), and the seven `DISCIPLINE_RULES` spellings are the Gate C
contract's own `oracles[].rule` values, so a gap joins a waiver on the same vocabulary
(`rules.ts:3-6`).

### AC 6: `scripts/generate-ad31-table.ts` and `scripts/check-ad31-table.ts`

Both open with the type-stripping header every `node scripts/*.ts` in this repository carries, and
both inherit it transitively: `tests/coverage/fixtures/corpus.ts` and
`tests/coverage/fixtures/satisfaction-contracts.ts` are loaded by Node's stripper too, so neither may
gain a TypeScript enum, namespace, parameter property, or non-type re-export.

The same constraint binds `table.ts` and `coverage.ts`, and there it has a live tripwire.
`src/core/canonical/scan-json.ts:50` uses a constructor parameter property, and `core/compile/`
reaches it through `core/canonical/digest.ts`. `check:layers` permits `core` to import `core`, so
nothing in the layer graph stops a later edit from importing `compile` into `table.ts` for a
"does it compile" column, and the first symptom would be both scripts dying at load with
`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` rather than a typecheck or lint failure. Neither new source file
imports from `core/compile/` or `core/canonical/`, and that is a constraint rather than an accident.
Measured: with the imports AC 4 and AC 5 declare, `node scripts/generate-ad31-table.ts` loads and
runs.

```ts
// Writes AD-31's published predicate table to
// `docs/ad31-coverage-predicates.generated.md`. A thin I/O wrapper over the
// pure builder in `core/coverage/table.ts` (AD-1); the byte rules live there
// too, so this writer and `check-ad31-table.ts` cannot disagree about bytes.
//
// The corpus is a test fixture by AD-30's own naming ("AD-31's contract
// fixture corpus", ARCHITECTURE-SPINE.md:443), so it is imported from
// `tests/`, not shipped in `dist`. `tsconfig.json` includes `tests` and
// `scripts`, so both are typechecked.
//
// Usage:
//   npm run generate:ad31-table
```

The writer resolves the output through `new URL('../docs/ad31-coverage-predicates.generated.md',
import.meta.url)`, creates `docs/` with `mkdir({ recursive: true })` because the directory is
untracked and empty at the baseline, guards the builder call so a thrown diagnosis prints as a
message rather than a Node stack, and logs
`generate-ad31-table: wrote docs/ad31-coverage-predicates.generated.md (N bytes)`.

The checker rebuilds through the same function, compares byte for byte, and reports the first
differing byte offset with a twenty-byte window on each side, copying `scripts/check-schemas.ts:98-112`.
Its three failure modes, each with its own message and its own repair:

- missing: `docs/ad31-coverage-predicates.generated.md: missing; run \`npm run generate:ad31-table\``
- drifted: `docs/ad31-coverage-predicates.generated.md: drift at byte offset N (committed A bytes, rebuilt B bytes)` plus the two windows
- builder failed: the diagnosis, prefixed `check-ad31-table: the builder failed: `

Success prints `check-ad31-table: the committed AD-31 table matches the builder byte for byte (N corpus contracts, 28 cells)`.

**No `--write` flag.** `scripts/check-schemas.ts:8-9` states the rule this repository already paid
for: "It never rewrites a file, on purpose: a check that can repair what it checks is not a gate."

There is no orphan check. `check-schemas` needs one because `schemas/` holds twelve registry-named
files; `docs/` holds one file this story names, and a second file there is a documentation decision
rather than drift.

### AC 7: `docs/ad31-coverage-predicates.generated.md`

Committed. Not published: `package.json`'s `files` is `["dist", "README.md", "LICENSE"]`, so `docs/`
never enters the tarball, and AD-15 is satisfied by the same reading `scripts/check-ad5-registry.ts:4-8`
already records for a script reading planning artifacts.

`docs/` is already excluded from Biome (`biome.json:19`, `"!docs"`), so no `biome.json` change is
needed and lint and the drift check cannot fight, which is the rule AD-13 states for `schemas/`
(`ARCHITECTURE-SPINE.md:301`). It is not one of `scripts/check-docs.mjs`'s roots
(`check-docs.mjs:9-15`), so `check:docs` stays at 55 files.

The `.generated.` infix is load-bearing: `.coderabbit.yaml:89` excludes `!**/*.generated.*`, so a
133-row emitted table does not arrive in every pull request as review surface.

### AC 8: `package.json` and CI wiring

Two scripts, placed beside the pair they copy:

```json
"generate:ad31-table": "node scripts/generate-ad31-table.ts",
"check:ad31-table": "node scripts/check-ad31-table.ts",
```

`validate` gains `check:ad31-table` after `check:ad28-registry` and before `check:layers`:

```
npm run typecheck && npm run lint && npm run check:docs && npm run check:shareable && npm run lint:spine && npm run check:vectors && npm run check:schemas && npm run check:ad5-registry && npm run check:ad28-registry && npm run check:ad31-table && npm run check:layers && npm run test
```

`.github/workflows/pr-checks.yml`:

1. `validate-and-build` gains, after the AD-5 registry step (`:41-42`):

   ```yaml
   - name: AD-31 coverage predicate table drift check (byte-exact against docs/)
     run: npm run check:ad31-table
   ```

2. The `validate` step's `name:` at `:54` gains `check:ad31-table` in its enumeration, between
   `check:ad28-registry` and `check:layers`. That string is a list of what runs; leaving it stale
   makes a red build name the wrong gate.

3. `floor` gains the same named step after its AD-5 registry step (`:89-90`). The reason is the one
   the file already gives at `:81-85`: this is a third `node scripts/*.ts`, and the declared engines
   floor is unproven for exactly the files that depend on Node's own type stripper unless it runs
   there.

4. A new `canary-ad31-table` job, `name: "Canary: AD-31 table check fails on a mutated byte and on a
   changed predicate"`, with the same runner, timeout, checkout, setup-node, npm-version assertion,
   and `npm ci` preamble as `canary-schema-drift` (`:254-272`). Three steps:

   - **Mutated byte.** Append one byte to the committed document, assert the check exits non-zero,
     restore with `git checkout --`, and `grep -q "ad31-coverage-predicates.generated.md: drift at byte offset"`.
     Match the drift line specifically, for the reason `:291-293` already gives: a missing-file
     failure also exits non-zero and would pass a bare exit-code test for the wrong reason.
   - **Changed predicate.** Rewrite `relevancePredicateId`'s suffix in `src/core/coverage/rules.ts`
     from `-relevance` to `-relevance-x` with `sed -i`, assert the check exits non-zero naming a byte
     offset, and restore with `git checkout --`. This is the canary that proves the table is emitted
     by the predicates rather than kept beside them, which is the sentence AD-31 turns on. A byte
     mutation alone would pass under a hand-maintained table.
   - **Fixed point.** `npm run --silent generate:ad31-table > /dev/null`, then
     `git diff --exit-code -- docs/`, then `npm run --silent check:ad31-table`, copying `:313-320`
     exactly. Regeneration is the repair every message above names, so it is proven to be a fixed
     point rather than assumed.

   `pr-gate.yml:1-4` recomputes the gate verdict from CI completion events, so the new job gates the
   merge with no branch-protection edit.

### AC 9: `README.md`

**Deviation, implementation:** `README.md` is one of `build:shareable`'s roots, so
`_bmad-output/shareable/eval-quality-readme.html` is an eighth edited file. `check:shareable` fails
with `stale at byte offset 29487` until `npm run build:shareable` runs, and that check sits in
`validate` ahead of everything this story adds. The AC named neither. Two more lines were added to
the README's command block for `generate:ad31-table` and `check:ad31-table`, matching the
`generate:schemas` and `check:schemas` pair beside them, and that block's `validate` comment was
corrected: it enumerated "schemas, AD-5 registry" and now reads "schemas, registries, AD-31 table".

One paragraph in the development section, following the shape the README already uses for `schemas/`:
name the file, name the generator, name the checker, and say the file is never hand-edited. Keep it
to the same length as the `schemas/` paragraph. `README.md` is one of `check:docs`'s roots, so the
paragraph must carry no trailing whitespace and no double blank line; the count stays 55.

### AC 10: Fixtures and tests

One `it` per numbered fixture, the fixture number opening the test name, matching Stories 5.1 and
5.2. Numbering continues the epic's single monotonic sequence: 1 through 56 relevance, 57 and 58 and
130 and 131 rules, 59 through 129 and 132 through 150 satisfaction, and this story from **151**.

Where a fixture asserts a positive, it asserts the deciding string too. `satisfied: true` alone
cannot tell a witnessed rule from a rule that stopped having a site, and `relevant: true` alone
cannot tell a populated declaration from an absent one. Story 5.2's Dev Note states it as a rule and
its review found four fixtures that failed it; this story's corpus makes the failure mode worse,
because a corpus contract that stops occupying its cell still produces a table.

**`tests/coverage/corpus.test.ts` (151 through 190).**

| # | Assertion |
| --- | --- |
| 151 | `satisfiedContract` places all seven rules at `witnessed`: `relevant: true`, `satisfied: true`, and each rule's witnessed reason verbatim. |
| 152 | Every member of `CORPUS_CONTRACTS` parses under `EvalContract.parse`. One `it`, iterating. |
| 153 | `CORPUS_CONTRACTS` carries nineteen contracts with nineteen distinct `contractId` values. |
| 154 | `CORPUS_CELLS` carries twenty-eight entries. |
| 155 | Every `(rule, state)` in `DISCIPLINE_RULES` × `DECLARATION_STATES` appears in `CORPUS_CELLS` exactly once. |
| 156 | Every `CORPUS_CELLS` entry's `contractId` is one of `CORPUS_CONTRACTS`'s. |
| 157 | `CORPUS_CELLS` is ordered by `DISCIPLINE_RULES` then `DECLARATION_STATES`. |
| 158 | `CORPUS_CONTRACTS` is ordered by first appearance in `CORPUS_CELLS`. |
| 159 | Every cell's contract produces `STATE_VERDICTS[cell.state]` for `cell.rule`, run through `evaluateRelevance` and `evaluateSatisfaction`. One `it`, iterating all twenty-eight. |
| 160-166 | Per rule, the `absent` cell's satisfaction reason is a declaration-absence reason: `NO_OPERATION_WITNESS` for rules 2, 3, 7, and a reason naming the null declaration for rules 1, 4, 5, 6. Seven `it`s, one per rule, each asserting the string verbatim. |
| 167 | Per rule, the `unwitnessed` cell's satisfaction reason is a no-witness reason and is **not** `NO_OPERATION_WITNESS` and not the cell's `absent` twin's reason. This is what separates the two states that share a verdict pair. One `it`, iterating. |
| 168 | Over every contract in `CORPUS_CONTRACTS` plus the three in `RELEVANCE_CONTRACTS` (`relevance-contracts.ts:314-318`, whose entries are `{ name, contract }` pairs) and `gateCContract`, no rule is both not relevant and not satisfied. Twenty-three distinct contracts, measured. The invariant Story 5.2's fixture 67 opened over five, and the proof that the fourth combination is unoccupiable rather than merely unoccupied. |
| 169 | Over the same set, a rule that is not relevant is satisfied with `NO_RELEVANT_SITE` exactly, never with a witnessed reason. |
| 170 | Every `CORPUS_CONTRACTS` member descends from the seed: its `testData`, `budgets`, `safetyLimits`, `requiredEvidence`, and `probeStepBound` are `toStrictEqual` to `satisfiedContract`'s. Paired in the same `it` with the negative that gives it teeth: the same five-field comparison against `{ ...satisfiedContract, probeStepBound: 99 }` fails. Without the negative this fixture passes for every contract `variant` can produce and can only fail if a later dev hand-authors a twentieth contract, which no regression in Task 10 does. |
| 171 | `EvalContract.parse` rejects a corpus contract with a `rule` field added to one oracle, and the issue path names `oracles`. AD-31 computes relevance from declarations only, and the Gate C fixture deleted that field for exactly this reason (`gate-c-contract.ts:34-39`); `Oracle` is a `z.strictObject`, so the schema is what forbids it. Asserted as a rejection rather than as "no corpus contract declares it": `CORPUS_CONTRACTS` is `EvalContract`-typed and already parsed, so the positive form cannot fail without fixture 152 failing first. |
| 172-178 | Per rule, the four cells' contracts are pairwise distinct where the table says they are, and shared where it says they are shared. Seven `it`s. |
| 179 | `absent-collection-locations` occupies both rule 4's and rule 6's `absent` cell, and both cells name the same `contractId`. |
| 180 | `no-operation-inventory` occupies rules 2, 3, and 7's `absent` cells, and all three name the same `contractId`. |
| 181 | `split-indicator-oracle` places rule 1 at `unwitnessed` and rule 2 at `unwitnessed` as well, and rule 2's cell is not this contract. The collateral the AC 3 table names, asserted rather than assumed. Assert rule 1's reason verbatim: the draft's weaker override left rule 1 witnessed while moving only rule 2, and `relevant: true` with a bare `satisfied: false` on the pair would not have caught it. |
| 182 | `per-key-split-oracles` places rule 1 at `witnessed` and rule 2 at `unwitnessed`. The pair that proves the split is real. |
| 183 | `unaddressed-parameter-sibling` places rule 3 and rule 7 at `witnessed` while rule 5 is `unwitnessed`, and its rule 5 reason names `limit and offset`. |
| 184 | `no-read-back-relation` places rule 5 at `witnessed` while rule 7 is `unwitnessed`. |
| 185 | `no-collection-quantifier` places rule 6 at `witnessed` while rule 4 is `unwitnessed`. |
| 186 | `wrong-cardinality-form` places rule 4 at `witnessed` while rule 6 is `unwitnessed`, and its rule 6 reason names `page-bounded`. |
| 187 | `empty-channel-roles` places rule 1 at `explicitly-empty` and not at `absent`: relevance is `false`, which `channelRoles: null` would not be. |
| 188 | `empty-request-shapes` builds four distinct channel objects per operation: mutating one channel of a `structuredClone` of it leaves the other three unchanged. The aliasing trap Story 5.1 and 5.2 both recorded, pinned rather than restated. |
| 189 | Every corpus contract except `no-operation-inventory` and `empty-request-shapes` compiles clean under `compile(contract, { strict: false })`. Seventeen of nineteen, measured. |
| 190 | Both exceptions fail under `unreachable-check-evidence`, and each message names its own site: O-001's collection operand for `no-operation-inventory`, O-005's `call-inputs` body operand for `empty-request-shapes`. Asserting the code alone would let one contract start failing for the other's reason. Decision 7. |

**`tests/coverage/coverage.test.ts` (191 through 212).**

| # | Assertion |
| --- | --- |
| 191 | `evaluateCoverage(satisfiedContract)` returns an empty array: the all-witnessed contract has no gap. |
| 192 | Every record `evaluateCoverage` returns parses under `CoverageGap.parse`. Iterated over the whole corpus. |
| 193 | Every returned record carries `satisfied: false`. |
| 194 | For every corpus contract, the returned rules are exactly the rules where relevance fired and satisfaction failed, computed independently from `evaluateRelevance` and `evaluateSatisfaction`. |
| 195 | Records come back in `DISCIPLINE_RULES` order. |
| 196 | Each record's `relevancePredicate` is `relevancePredicateId(rule)` and its `satisfactionPredicate` is `satisfactionPredicateId(rule)`, asserted against the fourteen literals `tests/coverage/rules.test.ts:19-38` already pins rather than against the functions. Story 5.1 finding 2: an assertion that re-derives its expected value from the function under test proves nothing. |
| 197 | `no-operation-inventory` yields a record for six rules, all but `sibling-cross-check`. **Deviation, implementation:** a record cannot name `NO_OPERATION_WITNESS`, because `CoverageGap` carries no reason field (Decision 6); the six reasons are asserted on `evaluateSatisfaction`'s verdicts in the same `it`. The maximal-gap case. Rule 5 is excluded because its two predicates read `siblingGroups` and the plan index, neither of which the operation inventory reaches, so it stays relevant and satisfied. Measured; asserting seven here is wrong. |
| 198 | A contract with every rule at `explicitly-empty` yields no record at all, which is the shape AD-31 exists to catch scoring clean. Built by composing the seven explicitly-empty overrides, and asserted alongside fixture 199 so the composition is not read as a pass. |
| 199 | For that same all-empty contract, `evaluateRelevance` answers `false` on all seven, so the empty record list is the vacuous-truth case and not a bug. The pair 198/199 is what stops 198 from being a fixture that cannot fail. |
| 200 | `evaluateRelevance` and `evaluateSatisfaction` return arrays of equal length whose `rule` fields agree positionally, over every corpus contract. The statement `evaluateCoverage`'s `undefined` guard would otherwise hide. |
| 201 | `coverageSeverity` returns `critical` for `satisfiedContract`, whose single behaviour is `critical`. |
| 202 | `coverageSeverity` returns the maximum over three behaviours declared `low`, `critical`, `material`, in that order, and again with the order reversed. The paired at-bound and over-bound convention applied to an ordering. |
| 203 | `coverageSeverity` returns `low` for a contract whose only behaviour is `low`. |
| 204 | `coverageSeverity` returns `material` where behaviours are `low` and `material`, proving the result is not pinned to either end of the tuple. |
| 205 | Every record from one contract carries the same severity, since the derivation is contract-level. Run over `no-operation-inventory`, whose six records make the claim non-vacuous; over a one-gap contract it holds trivially. **Deviation, implementation:** the assertion is that the severity set has size one, not that it equals `critical`. Asserting the level made 205 fail under Task 10's first regression, which Task 10 states it must not; measured both ways. |
| 206 | `evaluateCoverage` does not mutate its input: clone the contract, run, and compare the clone to a fresh clone with `toStrictEqual`. Story 5.1 finding 4's clone-and-compare form, not a double parse. |
| 207 | `evaluateCoverage` called twice on one contract returns deeply equal arrays. |
| 208 | `coverageSeverity` reads no field but `behaviors[].severity`: mutating `oracles`, `rubrics`, `waivers`, `permittedInterfaces`, and `siblingGroups` leaves the answer unchanged. |
| 209 | A record's `rule` is a member of `DISCIPLINE_RULES`, over the whole corpus. |
| 210 | The union of the seven rules over the whole corpus is all seven: no rule is unreachable as a gap. |
| 211 | Every rule appears as a gap in at least two distinct corpus contracts, one `absent` and one `unwitnessed`, so a rule that stopped producing gaps fails here rather than quietly shrinking the table. |
| 212 | `evaluateCoverage` throws nothing on any corpus contract, including `no-operation-inventory`. |

**`tests/coverage/table.test.ts` (213 through 231).**

This file drives the pure builder with in-memory corpora, the way
`tests/architecture/ad28-registry.test.ts` drives `scripts/ad28-registry.ts`. It never reads the
filesystem: `docs/` is the script's business, and AD-30 forbids test filesystem I/O outside a
temporary directory.

| # | Assertion |
| --- | --- |
| 213 | The document ends with exactly one `\n` and no line carries trailing whitespace. |
| 214 | Every character is ASCII. **Deviation, implementation:** written as a code-point filter rather than a character-class regex. The regex form trips `lint/suspicious/noControlCharactersInRegex`, and the suppression Biome then wants is itself reported as unused. |
| 215 | No two adjacent lines are both blank. |
| 216 | The document carries the four expected `## ` headings, in order. |
| 217 | The fourteen-predicate table has seven rows and its cells are the fourteen literals `rules.test.ts` pins. |
| 218 | The declaration-state table has seven rows and four columns, and every cell names the `contractId` `CORPUS_CELLS` assigns. |
| 219 | The matrix has one row per contract per rule: nineteen times seven. |
| 220 | The gaps section has one row per `evaluateCoverage` record across the corpus, and the count matches summing `evaluateCoverage` over `CORPUS_CONTRACTS` independently. Measured at eighteen for the corpus AC 3 specifies; assert the independent sum rather than the literal, and record the literal in the Dev Agent Record. |
| 221 | Building twice returns identical strings. |
| 222 | Building with `contracts` permuted permutes the matrix rows **and** the gap rows, both of which are ordered by `contracts` then `DISCIPLINE_RULES`, and leaves the fourteen-predicate table and the declaration-state table byte-identical, since those are ordered by `DISCIPLINE_RULES` and `DECLARATION_STATES` alone. Building with `contracts` in its declared order is a fixed point. AD-30's permutation family, applied to the one array whose order is an input. |
| 223 | A cell naming a `contractId` the corpus does not carry throws, and the message names the cell and the identifier. |
| 224 | A missing `(rule, state)` cell throws, and the message names the rule and the state. |
| 225 | A duplicated `(rule, state)` cell throws, and the message names both contracts. |
| 226 | A cell whose contract produces the wrong verdict pair throws, and the message names both pairs. Built by pointing rule 1's `witnessed` cell at `absent-success-indicator`. |
| 227 | Two corpus contracts sharing a `contractId` throws. |
| 228 | A contract identifier containing `\|` is escaped in the rendered cell, and the row still has the expected column count. |
| 229 | A satisfaction reason containing `\|` is escaped the same way. |
| 230 | The rendered document contains none of `P-001`, `F-003`, or `siblingGroups.parameters non-empty`. The first two are the worked example's probe and uncited finding (`worked-example-artifacts.ts:69`, `:383`); the third is the hand-written predicate spelling its coverage gap carries at `:387`, and it appearing in this document would mean the document was not emitted by `rules.ts`. `worked-example-artifacts.ts` declares no `contractId` and `O-005` is an oracle the corpus seed also declares, so neither is a usable witness. AD-31's publication-target prohibition, asserted on the output rather than argued in prose. |
| 231 | Every gap row's relevance-predicate and satisfaction-predicate cell equals the corresponding `evaluateCoverage` record's field, over the whole corpus. A builder that spelled the fourteen identifiers as literals rather than calling the derivation renders a document that still passes 217 and fails here, which is the in-memory twin of the CI canary's second step. Asserted against `evaluateCoverage`'s output rather than against `relevancePredicateId`, which fixture 196 already pins to literals. |

The file ends at 231.

### AC 11: The gate

`npm run validate` and `npm run build` pass. Every count changes exactly as follows, and any other
delta is a finding:

| Check | Baseline at `95ed961` | After |
| --- | --- | --- |
| `check:layers` | 57 files, 0 violations | 59 files, 0 violations |
| `check:docs` | 55 files | 55 files |
| `check:schemas` | 12 | 12 |
| `check:ad5-registry` | 21 codes | 21 codes |
| `check:ad28-registry` | 10 codes | 10 codes |
| `check:ad31-table` | absent | 19 corpus contracts, 28 cells |
| `vitest run` | 52 files, 2074 tests | 55 files, 2155 tests |

Every baseline in the left column was re-measured at `95ed961` during story review and every one
matched.

The test arithmetic: 40 fixtures in `corpus.test.ts` (151-190), 22 in `coverage.test.ts` (191-212),
19 in `table.test.ts` (213-231), total 81, against one `it` per fixture. 2074 + 81 = 2155.

`check:layers` counts source files under `src/`, so it rises by two, not three: the corpus is a test
fixture and `tests/` is not scanned. The `eval-contract.ts` edit adds a type alias to an existing
file and moves neither count; `check:schemas` stays at twelve, measured.

Three properties of the emitted document were measured during story review against the corpus AC 3
specifies. Record the observed values in the Dev Agent Record and treat a difference as a finding:
133 matrix rows (19 x 7), **18 gap rows**, and 17 of 19 corpus contracts compiling clean. A
different gap count means a contract stopped occupying its cell, which the table would still render.

## Tasks / Subtasks

- [ ] Task 1: Preflight the baseline (AC 11)
  - [ ] Confirm a clean working tree at `95ed961` with no untracked `src/core/coverage/coverage.ts`,
        `src/core/coverage/table.ts`, `tests/coverage/fixtures/corpus.ts`, `scripts/*ad31*`, or
        `docs/` additions left from story creation.
  - [ ] Record the baseline: `check:layers` 57 files 0 violations, `check:docs` 55 files,
        `check:schemas` 12, `check:ad5-registry` 21 codes, `check:ad28-registry` 10 codes,
        `vitest run` 52 files / 2074 tests. All six were measured at `95ed961` during story creation;
        confirm rather than assume.
- [ ] Task 2: `src/core/coverage/table.ts` (AC 4)
  - [ ] Transcribe AC 4's declarations and renderer helpers, then write `coveragePredicateTable` and
        its four diagnoses.
  - [ ] The AC blocks were run through `biome check` during story review. If `biome check --write`
        still changes anything, treat the change as a finding and record it.
  - [ ] Comments in the AC blocks are pruned to this repository's standard. Transcribe them as
        written; if one still reads as machine-written, fix it and record the deviation.
- [ ] Task 3: `src/core/coverage/coverage.ts` (AC 5)
  - [ ] Check whether `evidence-artifact.ts` already exports a `CoverageGap` type alias and reuse it
        rather than re-spelling a `z.infer`.
- [ ] Task 4: `tests/coverage/fixtures/corpus.ts` (AC 2, AC 3)
  - [ ] Write the three builders first, then the nineteen contracts, then `CORPUS_CELLS`.
  - [ ] Assert every contract parses before writing a single verdict assertion against it. A
        `satisfies EvalContract` annotation catches most of it at typecheck time.
  - [ ] Author a local `emptyChannel()` factory. Do not reach for `structuredClone`.
- [ ] Task 5: `tests/coverage/corpus.test.ts` (AC 10, fixtures 151 through 190)
- [ ] Task 6: `tests/coverage/coverage.test.ts` (AC 10, fixtures 191 through 212)
- [ ] Task 7: `tests/coverage/table.test.ts` (AC 10, fixtures 213 through 231)
- [ ] Task 8: The two scripts and the generated document (AC 6, AC 7)
  - [ ] Write `generate-ad31-table.ts`, run it, and read the output end to end before committing it.
        A generated file nobody read is how the worked example happened.
  - [ ] Write `check-ad31-table.ts`, then prove it fails on a mutated byte locally before wiring CI.
- [ ] Task 9: Wiring (AC 8, AC 9)
  - [ ] `package.json`: two scripts, `validate` chain.
  - [ ] `pr-checks.yml`: the `validate-and-build` step, the `validate` step's `name:` string, the
        `floor` step, and the `canary-ad31-table` job.
  - [ ] `README.md`: one paragraph.
  - [ ] `tests/schemas/fixtures/artifact-fixtures.ts`: the two predicate strings (Decision 9).
  - [ ] `src/core/schemas/eval-contract.ts`: the `Severity` type alias (AC 1, AC 5). Re-run
        `npm run check:schemas` and confirm it still reports twelve.
- [ ] Task 10: Prove the fixture list is not passing vacuously
  - [ ] Introduce each regression below against the finished code, confirm it fails the fixtures
        named beside it, and revert it. Record the result in the Dev Agent Record. A regression that
        fails a different set is itself a finding.
    - `coverageSeverity` returning `SEVERITY_LEVELS[0]` unconditionally: 201, 202, 204. Not 205:
      a constant severity is still one severity per contract, so 205 passes under it.
    - `coverageSeverity` taking the minimum instead of the maximum: 202, 204. Not 201 or 203, whose
      contracts declare one behaviour each, where the minimum and the maximum agree.
    - `evaluateCoverage` computing severity inside the loop from the rule rather than the contract:
      205. That is the only regression 205 catches, and it is why 205 runs over a six-gap contract.
    - `evaluateCoverage` emitting a record for every rule rather than for gaps only: 191, 193, 194,
      198, 220.
    - `evaluateCoverage` dropping the `!relevant.relevant` conjunct: 194, 198, 220.
    - `evaluateCoverage` dropping the `satisfied.satisfied` conjunct: 191, 194, 220.
    - `coveragePredicateTable`'s cell-completeness check removed: 224.
    - Its verdict-agreement check removed: 226.
    - Its duplicate-cell check removed: 225.
    - The `|` escape removed from `cell`: 228, 229.
    - The trailing-newline rule dropped: 213.
    - Matrix rows ordered by `contracts` reversed: 222.
    - `relevancePredicateId`'s suffix changed to `-relevance-x`: 196, 217, and the CI canary. Not
      231, which now asserts the document against `evaluateCoverage`'s records and moves with them.
    - `coveragePredicateTable` spelling the fourteen identifiers as literals instead of calling
      `relevancePredicateId` and `satisfactionPredicateId`: 231 alone.
    - Rule 5's `unaddressed-parameter-sibling` override reverted to the seed's parameter group: 159,
      183.
    - Rule 6's `wrong-cardinality-form` mode reverted to `exact`: 159, 186.
    - Rule 2's `per-key-split-oracles` collapsed back to one oracle: 159, 182.
    - Any `absent` contract's override reverted to the seed's declaration: 159, and that rule's own
      fixture among 160 through 166.
- [ ] Task 11: Run the gate (AC 11)
  - [ ] `npm run validate`, then `npm run build`.
  - [ ] Record the new counts and attribute every delta to named fixtures.
  - [ ] Record the emitted document's byte size and its gap-row count in the Dev Agent Record, and
        record the full 19-by-7 matrix as measured output rather than re-deriving it by hand. Story
        5.2's review found one wrong cell in a hand-derived table of thirty-five; this one is 133.
- [ ] Task 12: Close out
  - [ ] Fill the Dev Agent Record: model, debug log, completion notes, file list.
  - [ ] Once the implementation is green and the peer review's findings are addressed, add Step 18
        `(epic5-story3)` to `_bmad-output/project-knowledge/learning-path-step-by-step.md` following
        `learning-path-template.md`'s exact shape, plus one row appended to the table after the Step
        17 row at line 60.
  - [ ] Set `sprint-status.yaml`'s `5-3-the-contract-fixture-corpus-and-the-regenerated-table` to
        `review` when handing off for code review, and to `done` on merge. `epic-5` is already
        `in-progress`. Epic 5 has three stories, so mark `epic-5: done` on this merge.

## Decisions taken during story creation

Each is settled with a stated default and its downstream consequence. Per this project's standing
convention, settle ambiguities in the story or the code, record the reasoning, and do not escalate to
a new architecture revision. Proceed unless the user amends one; record the outcome in the Dev Agent
Record.

The governing texts are AD-31 (`ARCHITECTURE-SPINE.md:447-455`), AD-20 (`:351-360`), AD-30's fixture
floor (`:443`), AD-38's stage-one invariant (`:499`), AD-13's drift-check pattern (`:301`), and the
Gate C table (`reviews/gate-c/FINDINGS.md:49-64` and `:129-131`).

1. **The four declaration states are the corpus axis, and they are AD-31's own trichotomy plus the
   witnessed case.** AD-31's closing sentence grades an absent declaration, an explicit empty
   declaration, and a populated one differently; a populated declaration then splits on whether an
   oracle reads it. Considered and rejected: taking "relevance-and-satisfaction combination"
   literally as the four cells of a two-by-two, which yields three reachable cells and one that
   cannot exist. Rejected because a corpus with an empty column publishes a hole where AD-31 wants
   evidence, and because the literal reading loses the distinction the spine's own sentence turns on:
   under-declaration costing coverage while an explicit empty declaration is an answer.
   **Consequence:** twenty-eight cells across nineteen contracts, and the
   unreachable literal combination is stated in the emitted document and pinned by fixture 168
   instead of being left to a reader to notice. Story 5.2 Decision 11's "twenty-eight more contracts"
   counts contracts rather than cells and is a different number that happens to match; the measured
   contract count fixture 168 reaches is twenty-three.

2. **The corpus lives in `tests/coverage/fixtures/corpus.ts`, not in `src/`.** AD-30 names it "AD-31's
   contract fixture corpus" (`ARCHITECTURE-SPINE.md:443`) and AD-31 calls it "a set of hand-authored
   contracts", so it is a fixture by the architecture's own naming. Considered and rejected: putting
   it under `src/core/coverage/` so the table builder is a pure function of source alone. Rejected
   because `package.json`'s `files` ships `dist`, so nineteen hand-authored contracts would land in
   every consumer's node_modules to serve a document that is not published at all, and because
   `core/` gaining a data module invites a later story to import it at runtime. **Consequence:** both
   scripts import from `tests/`, which `tsconfig.json` already typechecks. That direction is new:
   `tests/architecture/ad28-registry.test.ts` and `tests/architecture/dependency-direction.test.ts`
   import from `scripts/`, and no script imports from `tests/` today, so these two are the first.
   Nothing forbids it. `check:layers` scans `src/` alone, `tsconfig-build.json` includes `src` alone
   so `dist` never sees the corpus, and `tsconfig.json` typechecks both directories already. `src/core/coverage/table.ts` stays a pure function
   of its argument, which is what lets `table.test.ts` drive it with adversarial corpora in memory.

3. **The witnessed contract is Story 5.2's `satisfiedContract`, imported, not copied.**
   `corpus.ts` imports it from `tests/coverage/fixtures/satisfaction-contracts.ts` and builds the
   other eighteen from it by spread. Considered and rejected: authoring a fresh seed so the corpus is
   self-contained. Rejected because Story 5.2's ninety fixtures are written against that exact
   contract and a second seed would let the two drift, and because Story 5.2's AC 6 already named it
   "the seed 5.3 may lift". **Consequence:** `satisfaction-contracts.ts` is unchanged, byte for byte,
   and a change to the seed moves both stories' fixtures at once, which is the coupling that keeps
   them honest.

4. **Relevance `false` with satisfaction `false` is unoccupiable, and the document says so.** Both
   families short-circuit on the same site enumeration: a rule that is relevant for no site returns
   `NO_RELEVANT_SITE` with `satisfied: true`, so `relevant: false` forces `satisfied: true`. Story
   5.2 Decision 11 kept the two enumerations separate deliberately and pinned their agreement with
   fixture 67. Considered and rejected: authoring a contract for the fourth combination anyway.
   Rejected because it cannot be authored; the honest artifact is a stated impossibility with a test
   behind it. **Consequence:** fixture 168 extends 5.2's invariant from the five whole contracts fixture 67
   covers to twenty-three, and Story 5.2's suggestion that "the case for extraction can be re-made on
   evidence" now has that evidence: twenty-three contracts, one hundred and sixty-one rule verdicts,
   and no disagreement. Verified by execution during story review, function by function against both
   site enumerations as well: `relevant: false` forces `satisfied: true` for all seven rules, and the
   reason in that case is always `NO_RELEVANT_SITE`, which is fixture 169.

5. **Five contracts occupy a cell for more than one rule, and the corpus is nineteen contracts across
   twenty-eight cells.** Rules 4 and 6 both read `collectionLocations`, so its `null` state is one
   contract; rules 2, 3, and 7 read declarations with no `null` state of their own, so their absent
   state is the empty operation inventory, one contract; the witnessed cell is one contract for all
   seven rules. Considered and rejected: twenty-eight distinct contracts, five of them identical but
   for `contractId`. Rejected because a corpus carrying near-duplicates teaches a reader that the
   duplication is meaningful when it is an artifact of the declaration space. **Consequence:** the
   emitted coverage table names the occupying contract per cell rather than counting contracts, and
   fixtures 179 and 180 assert the sharing explicitly so it is a recorded fact rather than an
   accident a later edit could silently undo.

6. **`CoverageGap` gains no `reason` field, and the record carries no diagnosis string.** Both verdict
   types carry a `reason` and the schema has nowhere to put it. Considered and rejected: adding
   `reason` to `CoverageGap`. Rejected because the schema is Epic 1's caller-facing shape, adding a
   field changes the published JSON Schema, its byte-exact drift check, its reject corpus, and the
   two shipped evidence-artifact fixtures, and no AD asks for it; AD-31's diagnosability requirement
   is satisfied by the pair of predicate identifiers, which is exactly what its sentence names.
   Story 5.1 finding 12 already corrected the claim that a reason "lands verbatim in a coverage-gap
   record". **Consequence:** the reasons are published in the emitted document instead, which is where
   a human reads them, and a machine consumer gets the two identifiers the spine asked for. A later
   story wanting the reason on the record inherits a schema change, not a rewrite.

7. **A corpus contract is not required to compile, and two of the nineteen do not.**
   `no-operation-inventory` fails `checkEvidenceReachability` because a plan naming operations no
   interface declares is exactly what an absent operation inventory means. `empty-request-shapes`
   fails the same check because emptying every request channel makes O-005's two `call-inputs`
   pointers address fields no operation declares, and that is exactly what an explicitly empty
   request shape means. Both were measured, and both report `unreachable-check-evidence`.
   Considered and rejected: emptying the interaction plan as well, and deleting O-005, so both
   contracts compile. Rejected because each repair moves other rules at once (the plan carries rule
   3's and rule 7's witnesses, O-005 carries rule 5's parameter group) and the contract would stop
   being attributable to one cell; and because AD-31's predicates are explicitly defined over
   declarations whether or not compilation would succeed: a coverage gap "never blocks", so a gap on
   an uncompilable contract is a meaningful measurement rather than a contradiction.
   **Consequence:** fixture 189 asserts the other seventeen compile clean and fixture 190 records
   both codes with their differing sites, so the exception is two named contracts rather than a
   standing exemption.

8. **`evaluateCoverage` is not wired into `compile`.** `CompileStage`
   (`src/core/stage-contracts.ts:18-21`) is Story 4.4's conformance type and returns `EvalContract`;
   changing it to carry coverage records would move `src/application/compile.ts`, the stage
   conformance fixture, and Story 4.4's nineteen-call test for a consumer that does not exist until
   the evidence artifact is assembled. Considered and rejected: returning
   `{ contract, coverageGaps }` now. Rejected because AD-31 asks for the predicates to be *published*,
   which the table generator does, and because a compile stage that returns a non-blocking record
   alongside nineteen blocking checks invites a reader to treat the record as one of them.
   **Consequence:** the fourteen predicates now have a caller in `src/` for the first time
   (`table.ts` through `coverage.ts`), and Epic 6's evidence-artifact assembly inherits the wiring
   into a produced artifact. Story 5.2 Decision 12 says the predicates "are reachable only from tests until Story 5.3 wires
   them" and names `compile`, `src/index.ts`, and the `CoverageGap` record as the three things it
   left undone; it asks for none of the three by name. This story does the record and gives the
   predicates a `src/` caller, which is what that sentence needed, and leaves the other two where
   5.2 left them.

9. **`tests/schemas/fixtures/artifact-fixtures.ts`'s coverage gap moves to the derived spellings; the
   worked-example mirror does not.** That fixture's record carries
   `relevancePredicate: 'siblingGroups.parameters non-empty'`, a prose sentence written before
   `rules.ts` existed. The identical record in `worked-example-artifacts.ts:384-392` stays untouched,
   because AD-31 and Owed item 7 forbid hand-patching the worked example into apparent conformance.
   Considered and rejected: leaving both, since `CoverageGap.relevancePredicate` is an opaque
   `z.string().min(1)` and both spellings validate. Rejected because the repository would then carry
   two spellings for what this package emits with nothing saying which is its own, and the accept
   fixture is the one a reader copies. **Consequence:** the accept corpus agrees with
   `evaluateCoverage`'s output, the worked example continues to disagree with everything, and the
   difference between the two is now visible rather than a coincidence.

10. **`coverageSeverity` is the maximum declared behaviour severity.** Considered and rejected: a
    per-rule severity constant, which mints exactly the vocabulary AD-20 declined and
    `CoverageGap.rule` is an opaque string to avoid; reading a scoring policy, which is caller-supplied
    and absent at compile time; and a fixed `low`, which makes every gap invisible under any floor.
    Rejected in favour of the maximum because AD-21 records a gap below the severity floor without
    moving the verdict, so a minimum or a fixed value is a way to buy a silent gap, and failing
    closed is AD-31's stated posture. **Consequence:** every gap from one contract carries one
    severity (fixture 205), which is honest about the fact that the predicates are contract-level and
    oracle-blind. A later story that declares a per-behaviour or per-rule severity supersedes this
    one; until then, a contract declaring one `critical` behaviour beside nine `low` ones scores its
    gaps `critical`, and that is the intended direction of the error.

11. **The emitted document lives at `docs/ad31-coverage-predicates.generated.md`.** Considered and
    rejected: `_bmad-output/planning-artifacts/`, which `check:docs` polices for whitespace and would
    put two checks in charge of one file's bytes, the exact fight AD-13 excludes `schemas/` from the
    formatter to avoid; `schemas/`, where `check-schemas` reports any non-registry file as an orphan;
    and a new top-level `corpus/`, which the Structural Seed reserves for AD-38's score-side probe
    corpus. `docs/` is already Biome-excluded, is not a `check:docs` root, and is not in
    `package.json`'s `files`. **Consequence:** `check:docs` stays at 55 and `biome.json` is unchanged.
    The `.generated.` infix takes the file out of CodeRabbit's path filter
    (`.coderabbit.yaml:89`), so a 133-row emitted table is not review surface on every pull request.

12. **The builder validates and throws rather than rendering what it is given.** Four diagnoses, and
    the fourth re-runs the predicates to confirm each cell's claimed verdict pair. Considered and
    rejected: rendering the corpus as handed and leaving validation to the tests. Rejected because
    the document is the published artifact and the scripts are its only production path; a test that
    validates the corpus does not stop `generate:ad31-table` from writing a table with a blank cell.
    **Consequence:** the generator has a guarded call site (AC 6) so a diagnosis prints as a message
    rather than a Node stack, matching `scripts/generate-schemas.ts:33-43`, and fixtures 223 through
    227 are the negatives for each diagnosis.

13. **The CI canary mutates a predicate, not only a byte.** `canary-schema-drift` mutates a committed
    byte, which proves the check compares. AD-31's claim is stronger: the table is emitted by the
    implemented predicates. A hand-maintained table would pass a byte-mutation canary unchanged.
    **Consequence:** the second canary step rewrites `relevancePredicateId`'s suffix and asserts the
    check fails, which is the only test in the repository that would notice the table being
    hand-kept. Fixture 231 is its in-memory twin.

14. **The 19-by-7 matrix is emitted, not asserted cell by cell in this story.** Story 5.2's AC 7 hand-
    derived thirty-five cells and its review found one wrong, which the fixture list then inherited.
    Considered and rejected: writing all 133 cells into an AC. Rejected because the error rate on
    hand-derived truth tables is the thing this story's own gate exists to remove. **Consequence:**
    the twenty-eight *claimed* cells are asserted (fixture 159) and the other 105 are pinned by the
    byte-exact drift check, which fails on any predicate change; Task 11 requires the measured matrix
    be recorded in the Dev Agent Record so a reviewer reads real output rather than a derivation.

## Dev Notes

### Read these files before writing anything

- `src/core/coverage/relevance.ts` and `src/core/coverage/satisfaction.ts`, whole. Every corpus
  override in AC 3 is aimed at a specific branch, and the reason strings the tests assert are in
  those files verbatim. Do not read the AC code blocks of Stories 5.1 and 5.2 for the signatures:
  Story 5.2's CodeRabbit finding CR1 added a threaded `SatisfactionContext` default parameter after
  the AC was written, so the shipped signatures differ from that story's prose.
- `tests/coverage/fixtures/satisfaction-contracts.ts`, whole. It is the seed, and its header comment
  maps each oracle to the rules it witnesses, which is what AC 3's `Collateral` column is derived
  from.
- `tests/coverage/satisfaction.test.ts:32-137`, the helper block. `mutantOf`, `parsedMutant`,
  `emptyChannel()` and `emptyRequestShape()` (`:74-88`), `operationNamed`, `descriptorOf`,
  `oracleNamed`, `stepNamed`, and `verdictFor` are the idioms this story's three test files copy.
  Note what those helpers do about typing: they navigate an `any` clone and re-parse. The corpus
  cannot use that route, because its contracts are exported as `EvalContract` and consumed by the
  two scripts, which is why AC 2's builders are typed instead. Test files here do
  not import from each other (`satisfaction.test.ts:32-33`), so copy rather than import.
- `scripts/generate-schemas.ts` and `scripts/check-schemas.ts`, whole. The two new scripts are these
  two with a different builder, and the failure-message shapes, the guarded builder call, and the
  refusal to add `--write` all come from there.
- `.github/workflows/pr-checks.yml:254-320`, the `canary-schema-drift` job. The new canary job is
  that one with a third step.
- `src/core/schemas/evidence-artifact.ts:148-159` and `:275`. `CoverageGap` and where it is consumed.
- `src/core/schemas/eval-contract.ts:36-38` and `:103-107`. `SEVERITY_LEVELS` and
  `SIBLING_GROUP_MINIMUM`.

### Previous-story intelligence

- **A fixture that cannot fail is a defect.** Story 5.1's review found two, and a review of Story
  5.2's first draft found four more. Where a fixture asserts a positive, assert the deciding string
  as well.
- **Never re-derive an expected value from the function under test** (Story 5.1 finding 2). Fixture
  196 asserts against the fourteen literals `tests/coverage/rules.test.ts:19-38` already pins, not
  against `relevancePredicateId`.
- **Purity is asserted by clone-and-compare, never by two parses** (Story 5.1 finding 4). A predicate
  writing to its input writes to both parses alike. Fixture 206.
- **`toStrictEqual` over `toEqual`** for non-mutation assertions (Story 5.1 finding 15): a stray
  `undefined`-valued property would otherwise pass.
- **Paired at-bound and over-bound fixtures** are a standing convention (Story 4.3 Decision 7,
  restated in Story 5.1). Applied here to the severity ordering, fixtures 202 and 204.
- **`structuredClone` preserves shared references.** Both prior stories recorded it and both shipped
  an `emptyChannel()` factory because of it. The corpus builds by spread and never clones, so the
  trap does not fire during authoring; it fires in the tests, which is why fixture 188 pins it.
- **Every deviation from an AC code block is annotated in place, at the AC, and recorded in the Dev
  Agent Record** (Story 5.1 finding 13). Story 5.2 recorded three.
- **The learning-path step ships in the story's own pull request** (Story 5.1 finding 11). The
  template's "only after a story is marked done" line is the stale part; all four Epic 4 story
  commits carried theirs.
- Story 4.1 still carries thirteen unchecked Review Findings items, three of them verifiably open, in
  `core/compile/reachability.ts` and `core/evaluate/`. This story touches neither. Carried forward so
  the next reader finds them.
- `deferred-work.md` carries no open items and Story 5.2 deferred nothing to this story. If this
  story opens one, the file's "No entries are currently open" header prose must change with it. The
  standing preference is to fix findings in the pass that finds them rather than to open an entry.

### Project structure notes

`tests/coverage/` mirrors `src/core/coverage/`, so `corpus.test.ts`, `coverage.test.ts`, and
`table.test.ts` sit beside `relevance.test.ts`, `satisfaction.test.ts`, and `rules.test.ts`, and
`corpus.ts` sits beside `satisfaction-contracts.ts` in `tests/coverage/fixtures/`.

Files are kebab-case, one concern per file. Zod schemas and their inferred types share a `PascalCase`
name; `as const` tuples are `SCREAMING_SNAKE`; functions are `camelCase`. Imports carry the explicit
`.ts` extension and type-only imports use `import type`, which Biome enforces as an error. Biome
formats with tabs, single quotes, and no trailing semicolons, at its default 80-column width.

Under `core/`: no `async`, no `await`, no `Date`, no `Math.random`, no Node builtin, no external
import beyond Zod. Confirm with `npm run check:layers` rather than by reading. Under `scripts/`,
Node builtins are the point, and the type-stripping restriction applies to the script and to
everything it imports.

`any` is permitted in `tests/` and forbidden in `src/`. `it.only` and `describe.only` are lint errors
and fail `validate`. There is no coverage threshold and no provider installed; do not run
`--coverage`.

### Testing requirements

`vitest.config.ts` includes `tests/**/*.test.ts`, environment `node`, no setup file, no globals.
Import `{ describe, expect, it } from 'vitest'` as the first import in every test file.

One `it` per numbered fixture, the fixture number opening the test name, including fixtures whose
body iterates over the whole corpus. The `it`'s body iterates; the test count does not. That rule is
what makes AC 11's arithmetic checkable.

Whole-contract positives go through `EvalContract.parse`. Per-cell mutants for the negative builder
fixtures (223 through 227) are built in the test file, not in `corpus.ts`: the corpus is the
published input and must stay valid.

AD-30 forbids filesystem I/O in tests outside a temporary directory, which is why `table.test.ts`
drives the pure builder and the two scripts own every byte that reaches disk.

AD-30's permutation family binds here through fixture 222: the corpus array's order is an input to
the emitted document, so permuting it must change only the matrix row order, and the declared order
must be a fixed point.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 5.3`] the acceptance criterion this story
  implements.
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md:447-455`]
  AD-31: the fourteen predicates, publication by emission and CI regeneration, the compile-side
  fixture corpus, the coverage-gap record's two named predicates, and the absent/empty/populated
  trichotomy.
- [Source: `.../ARCHITECTURE-SPINE.md:351-360`] AD-20: the seven rules and rule 2's operation-scoped
  denominator.
- [Source: `.../ARCHITECTURE-SPINE.md:443`] AD-30: "AD-31's contract fixture corpus, one contract per
  discipline rule per relevance-and-satisfaction combination", the per-predicate positive and
  negative fixture floor, and the no-filesystem-I/O rule.
- [Source: `.../ARCHITECTURE-SPINE.md:499`] AD-38: no stage-one requirement may cite an artifact
  produced by `score`.
- [Source: `.../ARCHITECTURE-SPINE.md:251`] a coverage gap emits the artifact with the gap recorded
  and never blocks.
- [Source: `.../ARCHITECTURE-SPINE.md:301`] AD-13: the byte-exact drift check, and generated
  directories excluded from the formatter so lint and drift cannot fight.
- [Source: `.../ARCHITECTURE-SPINE.md:728-741`] Owed item 7: the worked example is regenerated, never
  hand-patched.
- [Source: `.../reviews/gate-c/FINDINGS.md:49-64`, `:129-131`] the fourteen-row predicate table and
  the second-pass rule 2 row.
- [Source: `.../EPIC-BRIEF.md:139-154`] the epic's own statement of the corpus and the
  must-not.
- [Source: `_bmad-output/implementation-artifacts/5-1-the-seven-relevance-predicates.md:744-748`]
  the quantifier's permanent gaps on `gateCContract`, which this story's corpus does not inherit
  because it builds from `satisfiedContract`.
- [Source: `_bmad-output/implementation-artifacts/5-2-the-seven-satisfaction-predicates.md:796-798`,
  `:1601-1605`, `:1621-1631`, `:1638-1645`, `:1727-1738`, `:1747-1754`] the seed, the generator's
  directory, the gap as a conjunction, the two absence constants, fixture 67's invariant, and the
  deferral of the record and the table to this story.
- [Source: `src/core/coverage/relevance.ts`, `src/core/coverage/satisfaction.ts`,
  `src/core/coverage/rules.ts`] the fourteen predicates, unchanged by this story.
- [Source: `scripts/generate-schemas.ts`, `scripts/check-schemas.ts`,
  `.github/workflows/pr-checks.yml:254-320`] the generate/check/canary pattern this story copies.

## Suggested Review Order

1. Decision 1 against AD-31's closing sentence, then Decision 4 against `relevance.ts` and
   `satisfaction.ts`'s site enumerations, function by function. If the fourth combination is in fact
   reachable for any rule, the corpus axis is wrong and fixture 168 is wrong with it.
2. AC 3's nineteen contracts, cell by cell, against the two predicate files. Every override is aimed
   at one branch; run each one rather than reasoning from the prose. The `Collateral` column is the
   part most likely to be wrong, because it asserts what a mutation does *not* move.
3. Decision 5's sharing claims against fixtures 179, 180, and 172 through 178. A cell that turns out
   to be shared where the table says it is distinct makes the coverage table lie.
4. Decision 10 against AD-21's severity-floor rungs (`ARCHITECTURE-SPINE.md:368`) and against
   `SEVERITY_LEVELS`' declared order. If the maximum is wrong, fixtures 201 through 205 are wrong
   with it.
5. Decision 6 against AD-31's diagnosability sentence and against Story 5.1 finding 12. This is the
   decision most likely to be reopened by a reviewer who wants the reason on the record.
6. AC 4's four diagnoses against fixtures 223 through 227: is each one reachable, and does each
   fixture fail if its check is removed rather than if a different one is?
7. Fixture 231 and the second canary step together. They are the only two things asserting the table
   is emitted rather than kept, and if either is weaker than it reads, AD-31's central claim is
   unproven.
8. AC 11's arithmetic: 81 fixtures, one `it` each, 2074 plus 81. And `check:layers` rising by two
   rather than three, since the corpus is under `tests/`.
9. Settled during story review: Story 5.2 Decision 12 asks only that the predicates stop being
   reachable from tests alone, and names `compile`, `src/index.ts`, and the `CoverageGap` record as
   what it left undone without requiring any of the three. Decision 8 satisfies it. `CompileStage`
   (`stage-contracts.ts:18-21`) returning `EvalContract` was confirmed against the shipped file.

## Story Review Record

One peer review pass against the story before implementation, in a separate Claude Code session. It
built a throwaway copy of `src/`, `tests/`, `scripts/`, and the configs under its own scratchpad with
`node_modules` symlinked, transcribed AC 2, AC 3, AC 4, AC 5, and AC 6 into it, wired them to the
shipped `relevance.ts`, `satisfaction.ts`, `rules.ts`, `compile.ts`, and `satisfaction-contracts.ts`,
and **executed** all nineteen contracts against both predicate families and against `compile` rather
than reasoning from the prose. It typechecked the blocks under the repository's own `tsconfig.json`
with tsgo 7.0.2, ran `biome check` against a copy of `biome.json`, ran the generator end to end under
`node` to prove type stripping holds, and re-measured every baseline at `95ed961`.

Confirmed with no change needed: all twenty-eight cells produce their `STATE_VERDICTS` pair, measured
one at a time; Decision 4's unoccupiable combination, checked function by function against both site
enumerations and then executed over twenty-three contracts and one hundred and sixty-one rule
verdicts with zero violations, together with fixture 169's stronger claim that the reason in that
case is always `NO_RELEVANT_SITE`; Decision 5's three sharing claims, all three by execution; the
`Collateral` column for `no-type-violating-step`, `no-collection-quantifier`,
`unaddressed-parameter-sibling`, `wrong-cardinality-form`, and `no-read-back-relation`, including
that rule 4 does not move when the cardinality mode does and that rule 6 does not move when O-007
goes; every `ARCHITECTURE-SPINE.md` citation (`:251`, `:301`, `:351-360`, `:368`, `:443`, `:447-455`,
`:455`, `:499`, `:600`, `:728-741`); the Gate C citations at `:49-64` and `:129-131`, which Story
5.2's review found drifted and which are correct here; every `pr-checks.yml` citation (`:41-42`,
`:54`, `:81-85`, `:89-90`, `:254-272`, `:291-293`, `:313-320`), all exact; the four script citations;
`dependency-direction.ts:53`; `check-docs.mjs:9-15` and `:44-55`; `.coderabbit.yaml:89`;
`package.json`'s `files`; `evidence-artifact.ts:148-159` and `:275`; `stage-contracts.ts:18-21`;
`worked-example-artifacts.ts:384-392`; `gate-c-contract.ts:34-39`; all six baselines (57 files, 55,
12, 21, 10, and 52 files / 2074 tests); the fixture arithmetic 40 + 22 + 19 = 81 and 2074 + 81 =
2155; `check:layers` rising by two rather than three; `check:docs` staying at 55, read out of
`ROOTS`; the canary's second step being sufficient, since the emitted document renders
`relevancePredicateId`'s output in two sections and a hand-kept table would not move; and Decisions
6, 10, 11, 13, and 14 against their cited sources.

Twenty-four findings, all addressed in this file.

1. **High.** `split-indicator-oracle`'s override did not move rule 1. Dropping `/id` from O-002
   leaves `/error`, whose `diagnostic` role keeps it in the rule's `others` set, so O-002 still
   addressed the indicator beside another roled pointer in both channels. Measured: rule 1 answered
   relevant and satisfied and only rule 2 moved, so rule 1's `unwitnessed` cell was unoccupied and
   fixtures 159, 172, and 181 would all have failed. The override now reduces O-002 to the indicator
   alone, which was executed and produces the pair the cell asserts.
2. **High.** `per-key-split-oracles` did not compile. O-008 carried `direction.relation: 'all'`
   against a bare `existence` check, which `checkOracleAlignment` rejects under
   `direction-check-misaligned`, so fixture 189 would have failed. The row now sets
   `relation: 'existence'`. The same trap binds the corrected `split-indicator-oracle`, and AC 3 now
   states both constraints, including that `all` needs two operands
   (`CONNECTIVE_MINIMUM_ARITY`), so a one-assertion oracle cannot stay wrapped in it.
3. **High.** `empty-request-shapes` does not compile either, so fixture 189's "every corpus contract
   except `no-operation-inventory`" was false and Decision 7's "one named contract" was one short.
   Emptying every request channel makes O-005's two `call-inputs` pointers unreachable. Every repair
   moves another rule, so the honest answer is two exceptions: 189 now says seventeen of nineteen,
   190 names both sites, and Decision 7 argues both.
4. **High.** Fixture 197 asserted `no-operation-inventory` yields a record for all seven rules. It
   yields six. Rule 5's two predicates read `siblingGroups` and resolve steps through the plan index,
   neither of which the operation inventory reaches, so the seed's groups stay witnessed. Measured.
   197 now asserts six and names the exclusion, and AC 3 states why.
5. **High.** AC 5's code block does not compile. `z.infer` was used with no `z` in scope
   (`TS2503: Cannot find namespace 'z'`), and `import { type Severity }` resolves to the Zod schema
   object's type rather than the three-member union (`TS2749: 'Severity' refers to a value, but is
   being used as a type here`), so `coverageSeverity`'s return type is wrong. Both were reproduced
   under `tsc 7.0.2`. The block now carries `import type { z } from 'zod'`, and AC 1 adds one line to
   `eval-contract.ts` naming the `Severity` union beside the `ForbiddenInput` alias that file already
   carries. `check:schemas` still reports twelve, measured.
6. **High.** AC 2's builder block does not compile either, in three ways. `variant`'s
   `{ ...satisfiedContract, ... }` annotated `EvalContract` is rejected because the seed's two
   operations widen to a union whose `responseDescriptor.types` carries `items?: undefined`, which no
   `Record<string, KeyType>` accepts; `seedInterface` and both destructured operations are unchecked
   index accesses under `noUncheckedIndexedAccess`, so the AC's claim that "the destructuring needs
   no index guard" is wrong on both; and `withDescriptor` cannot build `no-state-change-marker` or
   `empty-request-shapes`, which are operation-level. The seed now goes through `EvalContract.parse`,
   which also de-aliases `satisfaction-contracts.ts:20-24`'s shared channel, a fourth builder
   `withOperation` is added, and the guarded interface accessor and tuple assertion are the shipped
   spelling rather than a fallback. The corrected block typechecks clean.
7. **Medium.** AC 4 ran the distinct-`contractId` check last, after three checks that resolve a
   `contractId` to a contract. With a duplicate identifier that resolution is ambiguous, so fixture
   227 could pass for a reason other than the one it names and a wrong-verdict diagnosis could fire
   first. It is now check 1, and the AC says why. Decision 12's "the third re-runs the predicates"
   is now "the fourth".
8. **Medium.** Fixture 171 could not fail. `Oracle` is a `z.strictObject` and `CORPUS_CONTRACTS` is
   `EvalContract`-typed and already parsed, so an `oracles[].rule` field is caught by fixture 152
   first and 171 asserts a property the type system makes unrepresentable. Restated as the rejection
   it actually protects: `EvalContract.parse` refuses an oracle carrying `rule`, and the issue path
   names it.
9. **Medium.** Fixture 231 was a strict subset of fixture 217 and moved under exactly the same
   regression, which Task 10 recorded by listing both under one mutation. AD-31's central claim needs
   a fixture that distinguishes an emitted table from a hand-kept one, so 231 now asserts the gap
   rows against `evaluateCoverage`'s records, which a builder spelling the fourteen identifiers as
   literals fails while still passing 217. Task 10's regression list is updated accordingly.
10. **Medium.** Fixture 170 could not fail under any regression Task 10 lists: every contract is a
    `variant` spread and none of the five fields is ever patched. Paired with the negative that gives
    it teeth, following this repository's at-bound and over-bound convention.
11. **Medium.** Fixture 222 said permuting `contracts` "changes the matrix row order and nothing
    else". The gaps section is ordered by `contracts` then `DISCIPLINE_RULES` too, so it moves as
    well. Restated, with the two tables that genuinely do not move named.
12. **Medium.** Fixture 230 named `O-005`, which the corpus seed also declares, and "the worked
    example's `contractId`", which `worked-example-artifacts.ts` does not carry. Replaced with three
    identifiers that exist and discriminate, the sharpest being the hand-written predicate spelling
    `siblingGroups.parameters non-empty` at `:387`.
13. **Medium.** Task 10 mis-attributed three severity regressions. Fixture 205 does not fail under a
    constant `coverageSeverity`, since a constant is still one severity per contract; fixtures 201
    and 203 do not fail under a minimum, since their contracts declare one behaviour each. Corrected,
    and the regression 205 actually catches is now named.
14. **Medium.** AC 4 attributed the ASCII rule to `scripts/check-docs.mjs:44-55`. That script has no
    character-set rule at all; it enforces trailing whitespace, repeated blank lines, and the final
    newline. The ASCII rule is this story's own and the AC now says so, with its real reason.
15. **Medium.** AC 4's `row` helper reflows under `biome format`, against the AC's claim that
    transcription produces no diff. The formatted two-line shape is now in the block, so a dev
    records no false deviation. Every other block in AC 4 and AC 5 was confirmed format-clean and
    import-order-clean at its own path.
16. **Medium.** AC 6 warned about type stripping in the fixtures and missed the live tripwire in
    `src/`. `src/core/canonical/scan-json.ts:50` is a constructor parameter property, `core/compile/`
    reaches it, and `check:layers` permits `core` to import `core`, so importing `compile` into
    `table.ts` would kill both scripts at load with `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` rather than
    failing a typecheck or a lint. Reproduced, and now stated as a constraint on the two new source
    files.
17. **Low.** AC 1 said `table.test.ts` carries fixtures 213 through 232 while AC 10 ends at 231 and
    AC 11 counts nineteen. AC 1 corrected to 231.
18. **Low.** Three `biome.json` citations had drifted: `"!docs"` is at `:19` rather than `:17`, the
    `src/**` override at `:56-64` rather than `:49-55`, and the `tests/**` override at `:65-77`
    rather than `:56-67`. Corrected.
19. **Low.** `relevance.ts:265-268` is `:266-270` and `satisfaction.test.ts:76-88` is `:74-88`.
    Corrected. Every other file-and-line citation in the story resolved to what the story says it
    does.
20. **Low.** Decision 2 claimed `scripts/` and `tests/` are already a two-way street. Only
    tests-import-scripts exists today; these two scripts are the first in the other direction.
    Nothing forbids it, and the decision now says so with the three checks that confirm it.
21. **Low.** Decision 4's "from four contracts to twenty-six" is from five, fixture 67's whole-contract
    set, to twenty-three. Both numbers corrected against the measured count.
22. **Low.** AC 2 and Decision 1 read Story 5.2 Decision 11's "twenty-eight more contracts" as a
    prediction of twenty-eight cells. That sentence counts contracts; the match is a coincidence.
    Both places now say so.
23. **Low.** Decision 8 said it supersedes Story 5.2 Decision 12's expectation of wiring into
    `compile` specifically. Decision 12 names three things it left undone and requires none of them
    by name, so there is nothing to supersede. Reworded, and the Suggested Review Order's open
    question closed.
24. **Low.** Three fixtures were under-specified rather than wrong: 205 is vacuous on a one-gap
    contract and now names the six-gap one; 190 asserted a code both exceptions share and now names
    their differing sites; 220's independently measured count, eighteen, is recorded. Fixture 168's
    `RELEVANCE_CONTRACTS` exists at `relevance-contracts.ts:314-318` and its entries are
    `{ name, contract }` pairs, which the fixture row now states.

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context), `claude-opus-5[1m]`.

### Debug Log References

Baseline re-measured at `95ed961` before any edit, all six as the story states: `check:layers` 57
files 0 violations, `check:docs` 55 files, `check:schemas` 12, `check:ad5-registry` 21 codes,
`check:ad28-registry` 10 codes, `vitest run` 52 files / 2074 tests.

The corpus was executed against both predicate families and against `compile` before a single
assertion was written, one contract at a time, and every cell, every `Collateral` claim and both
compile exceptions matched AC 3 with no correction needed. `node scripts/generate-ad31-table.ts`
loads and runs, which is the type-stripping proof AC 6 asks for; the tripwire the same AC names
fired for real while measuring, because a scratch script importing `core/compile/` died at load with
`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` on `scan-json.ts:50`.

All three failure modes of `check:ad31-table` were run locally: a mutated byte reports
`drift at byte offset 38871 (committed 38872 bytes, rebuilt 38871 bytes)`, a removed file reports
`missing; run \`npm run generate:ad31-table\``, and a corpus contract that stops occupying its cell
reports the builder diagnosis
`coveragePredicateTable: wrong-cardinality-form places omission-and-completeness at
relevant=true/satisfied=true, but cell unwitnessed asserts relevant=true/satisfied=false`. The
canary's second step was run locally with its exact `sed`: rewriting `relevancePredicateId`'s suffix
produces `drift at byte offset 638`.

### Completion Notes List

**AC 11, the gate.** `npm run validate` and `npm run build` both pass. Every count matches the
table and nothing else moved:

| Check | Baseline at `95ed961` | Measured after |
| --- | --- | --- |
| `check:layers` | 57 files, 0 violations | 59 files, 0 violations |
| `check:docs` | 55 files | 55 files |
| `check:schemas` | 12 | 12 |
| `check:ad5-registry` | 21 codes | 21 codes |
| `check:ad28-registry` | 10 codes | 10 codes |
| `check:ad31-table` | absent | 19 corpus contracts, 28 cells |
| `check:shareable` | 21 pages | 21 pages |
| `vitest run` | 52 files, 2074 tests | 55 files, 2155 tests |

**The emitted document.** 38871 bytes. 133 matrix rows (19 x 7), **18 gap rows**, and 17 of 19
corpus contracts compiling clean. All three are the values the story predicted.

**The measured 19-by-7 matrix**, read out of the emitted document rather than derived by hand.
`R` is relevant, `S` is satisfied; `.` in either position is the negative. Rules are in
`DISCIPLINE_RULES` order, contracts in `CORPUS_CONTRACTS` order.

| Contract | R1 | R2 | R3 | R4 | R5 | R6 | R7 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `absent-success-indicator` | R. | RS | RS | RS | RS | RS | RS |
| `empty-channel-roles` | .S | RS | RS | RS | RS | RS | RS |
| `satisfied-declarations` | RS | RS | RS | RS | RS | RS | RS |
| `split-indicator-oracle` | R. | R. | RS | RS | RS | RS | RS |
| `no-operation-inventory` | R. | R. | R. | R. | RS | R. | R. |
| `single-required-response-key` | RS | .S | RS | RS | RS | RS | RS |
| `per-key-split-oracles` | RS | R. | RS | RS | RS | RS | RS |
| `empty-request-shapes` | RS | RS | .S | RS | RS | RS | RS |
| `no-type-violating-step` | RS | RS | R. | RS | RS | RS | RS |
| `absent-collection-locations` | RS | RS | RS | R. | RS | R. | RS |
| `empty-collection-locations` | RS | RS | RS | .S | RS | .S | RS |
| `no-collection-quantifier` | RS | RS | RS | R. | RS | RS | RS |
| `absent-sibling-groups` | RS | RS | RS | RS | R. | RS | RS |
| `empty-sibling-groups` | RS | RS | RS | RS | .S | RS | RS |
| `unaddressed-parameter-sibling` | RS | RS | RS | RS | R. | RS | RS |
| `unnamed-reference-set` | RS | RS | RS | RS | RS | .S | RS |
| `wrong-cardinality-form` | RS | RS | RS | RS | RS | R. | RS |
| `no-state-change-marker` | RS | RS | RS | RS | RS | RS | .S |
| `no-read-back-relation` | RS | RS | RS | RS | RS | RS | R. |

No cell reads `..`, which is fixture 168's claim as output rather than as an assertion.

**Deviations from an AC code block.** Eight, each annotated in place at its AC:

1. AC 5's import block does not ship. `import type { z } from 'zod'` typechecks and fails
   `check:layers`: `core/` outside `core/schemas/` may not import an external module. The `z.infer`
   moved to `evidence-artifact.ts` as `export type CoverageGap = z.infer<typeof CoverageGap>`, and
   `coverage.ts` spells `export type CoverageGapRecord = CoverageGap`. That is what Task 3's own
   subtask asked for. `check:schemas` still twelve, `check:layers` 59 files and 0 violations.
2. AC 1's `Severity` alias ships beside `export const Severity` rather than at `:94`, following that
   file's `:29-35` instruction about spelling the vocabulary once.
3. AC 2 gains three builders, `withOracle`, `withoutOracle` and `withStep`. `oracles` and
   `interactionPlan` have no partial spelling and none of the AC's helpers reach either.
4. AC 3's `unnamed-reference-set` and `wrong-cardinality-form` spell their collection location as a
   literal rather than patching the seed's.
5. AC 4's duplicate-cell diagnosis had its subject left as `...`; shipped as
   `coveragePredicateTable: the corpus occupies cell {rule}/{state} more than once ({ids})`.
6. AC 4's coverage-table headers are derived from `DECLARATION_STATES` rather than written as fixed
   strings. Emitted bytes identical, measured.
7. AC 9 misses `_bmad-output/shareable/eval-quality-readme.html`. `README.md` is a `build:shareable`
   root and `check:shareable` runs inside `validate`, so the export is regenerated here. Two command
   lines were added to the README's own block and its stale `validate` enumeration corrected.
8. AC 10's fixtures 197, 205 and 214 ship in a different shape, each for a reason recorded at its
   row: a record carries no reason string, asserting `critical` broke a Task 10 regression mapping,
   and the ASCII regex needs a Biome suppression Biome then reports as unused.

**Task 10, the regression sweep.** Every regression below was introduced against the finished code,
run, and reverted. The working tree was confirmed clean afterwards. Six of the story's mappings did
not reproduce; each is recorded as a finding rather than smoothed over.

| Regression | Story predicted | Measured |
| --- | --- | --- |
| `coverageSeverity` returns `SEVERITY_LEVELS[0]` unconditionally | 201, 202, 204 | 201, 202, 204 |
| `coverageSeverity` returns a fixed `low` | (not listed) | 201, 202, 204 |
| `coverageSeverity` takes the minimum | 202, 204 | 202, 204 |
| severity computed inside the loop from the rule | 205 | 205 |
| a record for every rule rather than for gaps only | 191, 193, 194, 198, 220 | 191, 194, 197, 198, 205 |
| the `!relevant.relevant` conjunct dropped | 194, 198, 220 | **none** |
| the `satisfied.satisfied` conjunct dropped | 191, 194, 220 | 191, 194, 197, 205 |
| cell-completeness check removed | 224 | 224 |
| verdict-agreement check removed | 226 | 226 |
| duplicate-cell check removed | 225 | 225 |
| the `\|` escape removed from `cell` | 228, 229 | 228, 229 |
| the trailing-newline rule dropped | 213 | 213 |
| matrix rows ordered by `contracts` reversed | 222 | **231** |
| the builder sorts `contracts` internally | (not listed) | 222, 231 |
| `relevancePredicateId` suffix to `-relevance-x` | 196, 217, canary; not 231 | 196, 217, canary; not 231 |
| the fourteen identifiers spelled as literals | 231 alone | 231 alone |
| rule 5's parameter group reverted to the seed's | 159, 183 | 159, 167, 183, 211 |
| rule 6's cardinality mode reverted to `exact` | 159, 186 | 159, 167, 186, 211 |
| rule 2's two oracles collapsed back to one | 159, 182 | 159, 167, 182, 211 |
| `absent-success-indicator` reverted to the seed | 159, 160 | 159, 160, 211 |
| `absent-collection-locations` reverted to the seed | 159, 163/165 | 159, 163, 165, 211 |
| `absent-sibling-groups` reverted to the seed | 159, 164 | 159, 164, 211 |
| `no-operation-inventory` reverted to the seed | 159, 161/162/166 | 159, 161, 162, 166, 190, 197, 205, 211 |

Six deltas, and what each one means:

1. **The `!relevant.relevant` conjunct is unfalsifiable by any fixture, and stays.** It selects
   nothing `satisfied.satisfied` does not, because a rule relevant for no site answers satisfied
   vacuously. That is fixture 168's invariant, now measured over twenty-three contracts and one
   hundred and sixty-one rule verdicts. The conjunct is the conjunction AD-31 states and is what
   would stop a future predicate pair that broke the invariant from silently recording a gap for a
   rule that never fired, so it ships with a comment at the conjunct naming fixture 168 as the thing
   that would catch such a change. Recorded rather than deleted, and rather than opened as deferred
   work.
2. **Fixture 220 does not move under any `evaluateCoverage` regression.** AC 10 requires it to
   assert the independent sum of `evaluateCoverage` over the corpus rather than the literal, so both
   sides of the comparison move together. That is the right shape for what 220 checks (the builder
   renders one row per record) and the wrong shape for catching a change to the records themselves,
   which fixtures 191 through 197 already do. The literal AC 10 asked to be recorded here is
   **eighteen**.
3. **Fixture 193 cannot move under "a record for every rule".** The pushed record hardcodes
   `satisfied: false`, so widening which rules are pushed never produces a record carrying `true`.
4. **"Matrix rows ordered by `contracts` reversed" fails 231, not 222.** Reversing the loop reverses
   the gap rows with the matrix rows, and fixture 222 compares a permuted build against the declared
   build, so a symmetric reversal leaves both of its claims true. The regression 222 does catch is a
   builder that sorts `contracts` internally, which makes the corpus order stop being an input:
   measured, and it fails 222 and 231.
5. **"The fourteen identifiers spelled as literals" fails 231 alone only when the literal differs
   from the record.** Hardcoding the same string renders byte-identical output, which no fixture can
   see and which changes nothing. Measured both ways; the discriminating mutation is in the table.
6. **Every corpus regression also fails 167 and 211, and the inventory one also fails 190, 197 and
   205.** Those are supersets of the story's list rather than mis-attributions: 167 asserts an
   unwitnessed reason differs from its absent twin, 211 asserts every rule gaps in both its absent
   and its unwitnessed contract, and the inventory contract is the one three other fixtures count.

**Settled during implementation, not escalated.** Two ambiguities were settled in the code and
recorded here rather than routed back to the architecture, per this project's standing convention.
The `Severity` and `CoverageGap` type aliases both live in `core/schemas/`, which is the only layer
permitted to import Zod, and that placement is what makes `check:layers` and `check:schemas` both
hold. The duplicate-cell diagnosis's subject is the corpus, because the AC left it unspelled and
fixture 225 needs a whole string to assert.

### Review Findings

#### Adversarial code review, separate session

One pass in a separate Claude Code session against the uncommitted working tree. It built a
throwaway copy of `src/`, `tests/`, `scripts/` and the configs under its own scratchpad with
`node_modules` symlinked, ran exact-string mutations against the new modules, and parsed the failing
fixture numbers out of `npx vitest run tests/coverage --reporter=json`. Every finding it filed was a
measured survivor. It applied nothing.

Eight findings, all addressed here. Each repair was re-measured with the reviewer's own mutation.

1. **High. Twelve of the fourteen data columns in the two large tables were asserted by no fixture.**
   Only the gap table's two predicate columns were pinned, by fixture 231. The reviewer applied four
   column mutations together, regenerated, and the whole gate passed on a document whose Gap column
   read `no` in all 133 matrix rows while the predicates recorded eighteen gaps, and whose coverage
   table headers read `absent`, `explicitly empty` rather than the published spellings. The drift
   check only ever compared the committed bytes, so one regeneration laundered it.
   **Fixed:** three new fixtures. 232 asserts every gap row's contract, rule, severity and two
   reasons against `evaluateCoverage` and the two verdict families looked up independently; 233
   asserts all seven matrix columns the same way, including the gap flag as
   `relevant && !satisfied`; 234 asserts all four tables' header rows verbatim plus the title and
   the two fixed prose lines. Re-measured: all fourteen of the reviewer's mutations now fail, 232
   catching the six gap-row ones, 233 the five matrix ones, 234 the three prose and header ones.

2. **Medium. The builder's verdict-agreement check cannot tell `absent` from `unwitnessed`.**
   Both states are `{relevant: true, satisfied: false}` and check 4 compares booleans only, so the
   reviewer swapped rule 1's two occupants and the coverage table rendered exactly inverted with all
   four checks green.
   **Partly fixed, and the remainder is recorded rather than claimed.** Check 5 now throws when a
   rule's `absent` and `unwitnessed` occupants decide that rule on the same satisfaction reason,
   which catches an unwitnessed cell filled by its own absent occupant (fixture 235). It does **not**
   catch the reviewer's swap, and the first repair attempt was written believing it did; fixture 235
   failed on the first run and is what caught the mistake. The builder cannot decide that case: its
   only inputs are the contracts and the cell index, and separating a missing declaration from an
   unwitnessed one needs either the rule-to-declaration vocabulary AD-20 declined to mint or a
   grep over `satisfaction.ts`'s reason prose, which would make the builder throw whenever a
   predicate reworded a reason. The swap is caught by corpus fixtures 158, 160, 167, 172 and 211,
   which the reviewer verified, and `validate` runs `check:ad31-table` and `test` together, so no
   swapped document can reach a commit. Recorded here rather than deferred.

3. **Medium. The canary's fixed-point step passed vacuously if the two scripts' paths diverged, and
   the generator reported a path it had not written to.** The filename was spelled twice as two
   independent `new URL(...)` literals, and `git diff --exit-code -- docs/` does not report untracked
   files. The reviewer pointed the generator at `...generated2.md` and the whole gate stayed green
   with both files on disk and the success line naming the wrong one.
   **Fixed:** `scripts/ad31-table-target.ts` spells the path once and both scripts import it; the
   generator's success line derives its filename from the same constant `writeFile` used; and the
   canary's third step is now `[ -z "$(git status --porcelain -- docs/)" ]`. Re-measured: an
   untracked stray in `docs/` passes `git diff --exit-code` and fires the porcelain guard.

4. **Low. Fixture 228 asserted an escape for an input the schema forbids.** `contractId` is an
   `Identifier`, whose pattern excludes `|`, so no parseable contract can carry one in either
   identifier column. **Fixed:** 228 now asserts that rejection, and asserts that
   `DescriptorPointer` does admit `|`, which is what makes the reason column the escape's only live
   input. `table.ts`'s comment on `cell` was corrected to say so and to cite fixture 229.

5. **Low. `cellsOf`'s un-escape step was dead.** Deleting it failed nothing: both escape fixtures
   asserted on the raw rendered line. **Fixed:** 229 now reads the un-escaped reason back out of
   `cellsOf(row)[6]`, so reversibility is the claim rather than presence. Re-measured: deleting the
   un-escape fails 229.

6. **Low. Fixture 212 could not fail alone.** `evaluateCoverage` has no throw path, and a thrown
   error failed thirteen fixtures at once because everything from 192 on already calls it across the
   corpus. **Fixed:** 212 now asserts totality over the four contract fixtures nothing else in the
   file reaches, the three `RELEVANCE_CONTRACTS` entries and `gateCContract`, and that their records
   parse. Re-measured: a throw scoped to `exports-api-v1` fails 212 alone, as does one scoped to a
   contract outside the corpus.

7. **Low. The unfalsifiable conjunct was documented in one of the two places it appears.** The
   reviewer confirmed the decision to keep `!relevant.relevant` in `evaluateCoverage` and the
   comment naming fixture 168, and reproduced the Dev Agent Record's measurements independently.
   `table.ts` carried the same conjunct in the matrix's gap column with no comment.
   **Fixed:** one line there citing `coverage.ts`. The two `noUncheckedIndexedAccess` guards the
   reviewer also measured as unfalsifiable need no comment, being forced by the compiler.

8. **Low. A contract occupying no cell rendered silently**, adding seven matrix rows and 1530 bytes
   with no throw. **Fixed:** check 6 throws naming the contract (fixture 236). Re-measured: removing
   check 6 fails 236 alone.

The reviewer also reported one reading note rather than a defect: `table.test.ts` built the document
at import time, so a corpus the builder rejects collapsed all nineteen fixtures into a load error
and fixture 223, which asserts that very diagnosis, never ran. Fixed in the same pass: the document
is built on first use behind `documentOf()`.

Verified with no finding, and worth keeping: the canary YAML and its `sed` quoting, which cannot pass
vacuously because a non-matching `sed` leaves the check green and the step's own exit-code test
fires; all four test helpers, whose silent-wrong versions each fail loudly; and the eight fixtures
this story's own notes listed as likely-vacuous, each falsified with a measured mutation.

**Fixture count.** AC 10 ends at 231 and AC 11 predicts 2155 tests. Five fixtures were added here,
232 through 236, so the file ends at 236 and the suite reports **2160**. The count moved because a
review found real holes, which is the sequence working as intended.

#### CodeRabbit, on pull request #32

**CR1. Minor, Security and Privacy.** `.github/workflows/pr-checks.yml` declared no `permissions:`
block, so all eleven jobs ran with the default `GITHUB_TOKEN` scope, and the new `canary-ad31-table`
job checked out with credentials persisted into `.git/config` while running `sed -i`, `npm ci` and
`git checkout` over the tree. Backed by zizmor 1.29.0: `excessive-permissions` and `artipacked`.

Fixed, and widened to the whole file for consistency. A workflow-level `permissions: contents: read`
sits beside the existing `env:` block, and every one of the eleven checkouts now carries
`persist-credentials: false`; ten did not before. Checked first: no job in the file pushes, fetches,
posts a comment or a status, uploads an artifact, or reads a secret, and `setup-node`'s cache needs
read alone. `canary-ad28-registry`'s job-level `permissions: contents: read` was removed as
redundant once the workflow-level block covers it, so the file now declares its scope in exactly one
place. `pr-gate.yml` and `publish.yml` are untouched and out of scope.

### File List

New:

- `src/core/coverage/coverage.ts`
- `src/core/coverage/table.ts`
- `tests/coverage/fixtures/corpus.ts`
- `tests/coverage/corpus.test.ts`
- `tests/coverage/coverage.test.ts`
- `tests/coverage/table.test.ts`
- `scripts/generate-ad31-table.ts`
- `scripts/check-ad31-table.ts`
- `scripts/ad31-table-target.ts` (code-review finding 3)
- `docs/ad31-coverage-predicates.generated.md` (generated, committed)

Edited:

- `package.json`
- `.github/workflows/pr-checks.yml`
- `README.md`
- `_bmad-output/shareable/eval-quality-readme.html` (regenerated, AC 9 deviation)
- `src/core/schemas/eval-contract.ts`
- `src/core/schemas/evidence-artifact.ts` (AC 1 and AC 5 deviation)
- `tests/schemas/fixtures/artifact-fixtures.ts`
- `_bmad-output/project-knowledge/learning-path-step-by-step.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

Unchanged, deliberately: `src/core/coverage/relevance.ts`, `src/core/coverage/satisfaction.ts`,
`src/core/coverage/rules.ts`, `tests/coverage/fixtures/satisfaction-contracts.ts`, the three Epic 5
test files that preceded this story, `src/core/compile/compile.ts`, `src/core/stage-contracts.ts`,
`src/application/compile.ts`, `src/index.ts`, `biome.json`, and every worked-example artifact.
