---
epic: 5
story: 1
key: 5-1-the-seven-relevance-predicates
baseline_commit: 430d3b7578d2cf262bb16acb011a1ecfc9a17dfd
---

# Story 5.1: The seven relevance predicates

Status: in-review

## Story

As the compiler's judgment of what applies,
I want each AD-20 rule's relevance predicate as a decision procedure over declarations only,
so that relevance never requires a run record or a reviewer.

## Acceptance Criteria

### AC 1: Module location, scope, and what this story does not build

Two new source files under `src/core/coverage/`:

- `src/core/coverage/rules.ts`: AD-20's seven discipline rules as identifiers, plus the relevance
  predicate identifier derived from each.
- `src/core/coverage/relevance.ts`: the seven relevance predicates and the aggregate that runs all
  seven in registry order.

Two new test files: `tests/coverage/relevance.test.ts` and `tests/coverage/rules.test.ts`.

`src/core/coverage/` and `tests/coverage/` do not exist at the baseline commit.
`scripts/dependency-direction.ts:53` already classifies anything under `src/core/` as the `core`
layer, so no change to the layer graph, the checker, or `tests/architecture/dependency-direction.test.ts`
is required or permitted.

**This story does not build:**

1. Any satisfaction predicate. All seven are Story 5.2's, including rule 2's operation-scoped
   denominator, rule 3's `type-violating` matcher pairing, rule 6's `expectedCardinality.mode`
   branch, and rule 7's `call-inputs`-to-`response-body` relation.
2. Any `CoverageGap` record. The shape already exists at
   `src/core/schemas/evidence-artifact.ts:148-159` and is filled once both halves exist, which is
   Story 5.2 at the earliest.
3. The published predicate table, its CI regeneration, or the contract fixture corpus. Those are
   Story 5.3's, and AD-31 forbids publishing them against the historical worked example.
4. Any change to `src/core/compile/compile.ts`, its nineteen-call order, or its `EvalContract`
   return type. Story 4.4 shipped `compile` returning a bare contract and reserved coverage records
   for Epic 5; a coverage record needs a satisfaction verdict, so nothing is wired this story.
5. Any change to `src/index.ts`. Story 6.5 owns the published surface, matching every Epic 3 and
   Epic 4 story.
6. Any AD-5 code. Coverage gaps never block compilation (`ARCHITECTURE-SPINE.md:251`), so no rule
   here throws `StructuralFailure` and `FAILURE_CODES` stays at twenty-one members.
7. Any schema change. `EvalContract` already carries every declaration these seven read, and its own
   `.meta` description says so (`src/core/schemas/eval-contract.ts:195`).

### AC 2: `src/core/coverage/rules.ts`

Already in Biome's format and import order. Transcribing it should produce no diff under
`biome check --write`.

```ts
/** AD-20's seven discipline rules as identifiers, in AD-20's enumeration order. */

// AD-20 enumerates its seven rules in prose and assigns them no identifiers,
// which is why `Waiver.rule` and `CoverageGap.rule` are opaque strings. This is
// that vocabulary, minted once, spelled as the Gate C contract's own
// `oracles[].rule` values (reviews/gate-c/eval-contract.json:267-446). Reading
// such a label off a contract is what the schema rejected; naming the rules a
// predicate decides reads no contract field.
export const DISCIPLINE_RULES = [
	'success-indicator-separation',
	'whole-body',
	'malformed-input',
	'per-record',
	'sibling-cross-check',
	'omission-and-completeness',
	'state-change-read-back',
] as const

export type DisciplineRule = (typeof DISCIPLINE_RULES)[number]

/** `relevancePredicate` on a coverage-gap record. Derived so a new rule cannot arrive without one. */
export const relevancePredicateId = (rule: DisciplineRule): string =>
	`${rule}-relevance`
```

**Corrected in implementation:** the doc comments in both source files were pruned and de-AI'd
after review, per this repository's standing comment style. Every statement, expression, and
exported name is unchanged; only comment prose differs from the AC blocks. See the Dev Agent Record.

### AC 3: `src/core/coverage/relevance.ts`, header, verdict shape, shared helpers

```ts
/**
 * AD-31's seven relevance predicates: decision procedures over AD-19's
 * declarations and nothing else. No run record, no probe, no outcome state,
 * and no oracle, since AD-31 computes relevance from declarations only.
 *
 * Every predicate returns a verdict and none throws. A coverage gap emits the
 * artifact with the gap recorded and never blocks (AD-5), so there is no
 * failure code here. Failing closed means answering `relevant` on an absent
 * declaration.
 */
import type { EvalContract } from '../schemas/eval-contract.ts'
import type { Operation } from '../schemas/interface.ts'
import { TRANSPORT_CHANNELS } from '../schemas/pointer.ts'
import {
	DISCIPLINE_RULES,
	type DisciplineRule,
	relevancePredicateId,
} from './rules.ts'

export type RelevanceVerdict = {
	readonly rule: DisciplineRule
	readonly predicate: string
	readonly relevant: boolean
	/** why this verdict, for the diagnosable half of AD-31's gap record. */
	readonly reason: string
}

const verdict = (
	rule: DisciplineRule,
	relevant: boolean,
	reason: string,
): RelevanceVerdict => ({
	rule,
	predicate: relevancePredicateId(rule),
	relevant,
	reason,
})

/** Every declared operation, flattened. Six of the seven rules range over this list. */
const operationsOf = (contract: EvalContract): readonly Operation[] =>
	contract.permittedInterfaces.flatMap((declared) => declared.operations)

/** Decision 10: no operation declared leaves the six operation-scoped rules nothing to read. */
export const NO_OPERATION =
	'the contract declares no operation, so the declaration this rule reads is absent'
```

**Corrected in implementation:** a `plural(count, noun)` helper sits between `verdict` and
`operationsOf` in the shipped file. AC 4's rule 4 and AC 5's rule 5 route their count nouns through
it, and so does AC 4's rule 2, whose count is always at least two. See the Review Findings section.

### AC 4: `src/core/coverage/relevance.ts`, rules 1 through 4

```ts
/**
 * Rule 1, relevance: `successIndicator` is declared and at least one other
 * pointer carries a channel role. An operation nominating no indicator answers
 * relevant: the field is a nullable pointer with no third spelling, so `null`
 * is absence. `channelRoles: {}` is the explicit empty answer on the second
 * conjunct.
 */
export function successIndicatorSeparationRelevance(
	contract: EvalContract,
): RelevanceVerdict {
	const rule = 'success-indicator-separation'
	const operations = operationsOf(contract)
	if (operations.length === 0) return verdict(rule, true, NO_OPERATION)
	for (const operation of operations) {
		const { successIndicator, channelRoles } = operation.responseDescriptor
		// Compared against `null`, never for truthiness: `DescriptorPointer`
		// admits the empty string, which nominates the whole response body.
		if (successIndicator === null) {
			return verdict(
				rule,
				true,
				`operation ${operation.operationId} nominates no success indicator`,
			)
		}
		if (channelRoles === null) {
			return verdict(
				rule,
				true,
				`operation ${operation.operationId} declares no channel roles`,
			)
		}
		const other = Object.keys(channelRoles).find(
			(pointer) => pointer !== successIndicator,
		)
		if (other !== undefined) {
			return verdict(
				rule,
				true,
				`operation ${operation.operationId} gives pointer ${other} a channel role beside its success indicator`,
			)
		}
	}
	return verdict(
		rule,
		false,
		'every operation nominates a success indicator and gives no other pointer a channel role',
	)
}

/**
 * Rule 2, relevance: the response descriptor declares more than one pointer,
 * counted over distinct `requiredKeys`. That is the set rule 2's own
 * satisfaction denominator reads, and AD-20 says coverage is never computed
 * against permitted keys. Distinct, because `requiredKeys` carries no
 * uniqueness constraint and one key repeated is one pointer.
 */
export function wholeBodyRelevance(contract: EvalContract): RelevanceVerdict {
	const rule = 'whole-body'
	const operations = operationsOf(contract)
	if (operations.length === 0) return verdict(rule, true, NO_OPERATION)
	for (const operation of operations) {
		const distinct = new Set(operation.responseDescriptor.requiredKeys)
		if (distinct.size > 1) {
			return verdict(
				rule,
				true,
				`operation ${operation.operationId} declares ${distinct.size} distinct required response keys`,
			)
		}
	}
	return verdict(
		rule,
		false,
		'no operation declares more than one distinct required response key',
	)
}

/**
 * Rule 3, relevance: some operation declares a request key on any of AD-19's
 * four transport channels. The site is the whole channel triple: a key with no
 * `types` entry has an absent type and a key typed `null` has AD-31's
 * indeterminate one, and AD-31 grades both relevant, so an author cannot buy
 * irrelevance by declaring an input and refusing to type it.
 */
export function malformedInputRelevance(
	contract: EvalContract,
): RelevanceVerdict {
	const rule = 'malformed-input'
	const operations = operationsOf(contract)
	if (operations.length === 0) return verdict(rule, true, NO_OPERATION)
	for (const operation of operations) {
		for (const channel of TRANSPORT_CHANNELS) {
			const shape = operation.requestShape[channel]
			// `Object.keys` rather than a keyed lookup: `KeyName` admits
			// `constructor`, and own-key enumeration never reaches the prototype.
			const key =
				shape.requiredKeys[0] ??
				shape.permittedKeys[0] ??
				Object.keys(shape.types)[0]
			if (key !== undefined) {
				return verdict(
					rule,
					true,
					`operation ${operation.operationId} declares ${channel} key ${key}`,
				)
			}
		}
	}
	return verdict(
		rule,
		false,
		'no operation declares a request key on any transport channel',
	)
}

/**
 * Rule 4, relevance: the descriptor declares at least one collection location.
 * `null` is absent and answers relevant; `[]` is the explicit empty answer and
 * does not.
 */
export function perRecordRelevance(contract: EvalContract): RelevanceVerdict {
	const rule = 'per-record'
	const operations = operationsOf(contract)
	if (operations.length === 0) return verdict(rule, true, NO_OPERATION)
	for (const operation of operations) {
		const { collectionLocations } = operation.responseDescriptor
		if (collectionLocations === null) {
			return verdict(
				rule,
				true,
				`operation ${operation.operationId} declares no collection-location list, so no collection is declared to range over`,
			)
		}
		if (collectionLocations.length > 0) {
			return verdict(
				rule,
				true,
				`operation ${operation.operationId} declares ${collectionLocations.length} collection location(s)`,
			)
		}
	}
	return verdict(
		rule,
		false,
		'every operation declares an explicitly empty collection-location list',
	)
}
```

**Corrected in implementation:** rule 2's and rule 4's count nouns go through the `plural` helper
noted under AC 3, so a reason reads `1 collection location` and `2 collection locations` rather than
carrying the `(s)` escape. See the Review Findings section.

### AC 5: `src/core/coverage/relevance.ts`, rules 5 through 7 and the aggregate

```ts
/**
 * Rule 5, relevance: a sibling group over operations or parameters is
 * non-empty. The only contract-level rule of the seven. A group of one cannot
 * exist, since `SIBLING_GROUP_MINIMUM` is two.
 */
export function siblingCrossCheckRelevance(
	contract: EvalContract,
): RelevanceVerdict {
	const rule = 'sibling-cross-check'
	const groups = contract.siblingGroups
	if (groups === null) {
		return verdict(rule, true, 'the contract declares no sibling groups')
	}
	if (groups.operations.length > 0) {
		return verdict(
			rule,
			true,
			`the contract declares ${groups.operations.length} operation sibling group(s)`,
		)
	}
	if (groups.parameters.length > 0) {
		return verdict(
			rule,
			true,
			`the contract declares ${groups.parameters.length} parameter sibling group(s)`,
		)
	}
	return verdict(
		rule,
		false,
		'the contract declares explicitly empty operation and parameter sibling groups',
	)
}

/**
 * Rule 6, relevance: a declared collection location names a reference set. The
 * site is `collectionLocations`, never the contract-level `referenceSets` map,
 * so an explicitly empty location list stays an answer. A location naming an
 * identifier the contract does not declare still names one.
 */
export function omissionAndCompletenessRelevance(
	contract: EvalContract,
): RelevanceVerdict {
	const rule = 'omission-and-completeness'
	const operations = operationsOf(contract)
	if (operations.length === 0) return verdict(rule, true, NO_OPERATION)
	for (const operation of operations) {
		const { collectionLocations } = operation.responseDescriptor
		if (collectionLocations === null) {
			return verdict(
				rule,
				true,
				`operation ${operation.operationId} declares no collection-location list, so no location can name a reference set`,
			)
		}
		for (const location of collectionLocations) {
			if (location.referenceSet !== null) {
				return verdict(
					rule,
					true,
					`operation ${operation.operationId} names reference set ${location.referenceSet} for collection ${location.pointer}`,
				)
			}
		}
	}
	return verdict(
		rule,
		false,
		'no declared collection location names a reference set',
	)
}

/**
 * Rule 7, relevance: some operation declares `stateChangeMarker: true`. The one
 * rule with no absent state to grade: the marker is a required boolean, both
 * values are legal, and neither is a default.
 */
export function stateChangeReadBackRelevance(
	contract: EvalContract,
): RelevanceVerdict {
	const rule = 'state-change-read-back'
	const operations = operationsOf(contract)
	if (operations.length === 0) return verdict(rule, true, NO_OPERATION)
	for (const operation of operations) {
		if (operation.stateChangeMarker) {
			return verdict(
				rule,
				true,
				`operation ${operation.operationId} declares stateChangeMarker: true`,
			)
		}
	}
	return verdict(rule, false, 'no operation declares stateChangeMarker: true')
}

/**
 * One predicate per rule. A mapped type rather than a switch, matching
 * `operatorHandlers` in `core/evaluate/resolution.ts`: adding a member to
 * `DISCIPLINE_RULES` fails the typecheck until its predicate exists. No
 * `Object.hasOwn` guard, unlike that map, because the key comes from a
 * compile-time tuple rather than from parsed input.
 */
export const RELEVANCE_PREDICATES: {
	readonly [Rule in DisciplineRule]: (
		contract: EvalContract,
	) => RelevanceVerdict
} = {
	'success-indicator-separation': successIndicatorSeparationRelevance,
	'whole-body': wholeBodyRelevance,
	'malformed-input': malformedInputRelevance,
	'per-record': perRecordRelevance,
	'sibling-cross-check': siblingCrossCheckRelevance,
	'omission-and-completeness': omissionAndCompletenessRelevance,
	'state-change-read-back': stateChangeReadBackRelevance,
}

/** All seven verdicts, in `DISCIPLINE_RULES` order, over declarations alone. */
export function evaluateRelevance(
	contract: EvalContract,
): readonly RelevanceVerdict[] {
	return DISCIPLINE_RULES.map((rule) => RELEVANCE_PREDICATES[rule](contract))
}
```

**Corrected in implementation:** rule 5's two count nouns go through the same `plural` helper. See
the Review Findings section.

### AC 6: The relevance verdicts for the four whole-contract fixtures

The derived truth table, stated here so a regression that moves one cell fails an assertion. The
populated and Gate C columns are all-relevant, so between them the four columns catch a fail-closed
regression on any rule and a fail-open one only through the absent and explicitly-empty columns; the
per-rule negatives below carry the rest of that weight.

| Rule | `absentContract` | `explicitlyEmptyContract` | `populatedContract` | `gateCContract` |
| --- | --- | --- | --- | --- |
| 1 success-indicator-separation | relevant | relevant | relevant | relevant |
| 2 whole-body | not relevant | not relevant | relevant | relevant |
| 3 malformed-input | not relevant | not relevant | relevant | relevant |
| 4 per-record | relevant | not relevant | relevant | relevant |
| 5 sibling-cross-check | relevant | not relevant | relevant | relevant |
| 6 omission-and-completeness | relevant | not relevant | relevant | relevant |
| 7 state-change-read-back | not relevant | not relevant | relevant | relevant |

Why each non-obvious cell falls where it does:

- `absentContract` is relevant on rule 1 because its single operation nominates no success
  indicator. The first conjunct is checked first, so `channelRoles: null` is never reached.
- `absentContract` is not relevant on rules 2 and 7 because neither declaration has a nullable
  spelling: `requiredKeys` is `['value']`, one distinct key, and the one operation declares
  `stateChangeMarker: false`.
- `absentContract` is not relevant on rule 3 because all four transport channels are built from
  `emptyChannel`, whose `requiredKeys`, `permittedKeys`, and `types` are all empty. That is the
  explicit empty answer, and it is the only shape rule 3 grades irrelevant.
- `explicitlyEmptyContract` is relevant on rule 1 for the same reason as `absentContract`, and for
  no other reason: `successIndicator` is a nullable pointer with no explicit-empty spelling, so the
  rule has no irrelevant case on an operation that nominates none. Its `channelRoles: {}` is the
  explicit empty answer the second conjunct grades, unreached here.
- `gateCContract` is relevant on rule 2 through `submit-export`, whose descriptor declares four
  required keys. `get-export` declares three and `list-export-rows` declares one.
- `gateCContract` is relevant on rule 3 through `submit-export`'s `header.permittedKeys`, which
  declares `Idempotency-Key`, before its `body` channel is reached.
- `gateCContract` is relevant on rules 4 and 6 through `submit-export`'s `collectionLocations: null`,
  reached before `list-export-rows`'s populated list. Both paths answer relevant, and the assertion
  pins the verdict rather than the reason.

### AC 7: Fixtures and tests

Fixtures 1 through 56 live in `tests/coverage/relevance.test.ts`; 57 and 58 in
`tests/coverage/rules.test.ts`.

Every per-rule fixture clones `absentContract` unless it names another base. `absentContract`
declares exactly one operation with every nullable axis absent, which is the fewest-mutation
starting point for rules 1 through 4, 6, and 7. A fixture reading "two operations" clones
`populatedContract`, which declares two.

Whole-contract positives:

1. `evaluateRelevance(EvalContract.parse(absentContract))` returns exactly seven verdicts whose
   `rule` values equal `DISCIPLINE_RULES` element by element, in order.
2. `absentContract`: the seven `relevant` values equal AC 6's column, asserted as one array so a
   single cell moving fails.
3. `explicitlyEmptyContract`: the same, against its column.
4. `populatedContract`: the same, against its column.
5. `gateCContract`: the same, against its column.
6. Every verdict's `predicate` equals `relevancePredicateId(verdict.rule)`, imported from
   `rules.ts` rather than re-spelled as a template literal, over all four contracts.
7. Every verdict's `reason` is a non-empty string, over all four contracts.

Declaration-only, proved by mutation:

8. `populatedContract` with `oracles: []` produces seven verdicts deep-equal to the unmutated run.
   This is AD-31's "never inferred from the oracles" and the reason `oracles[].rule` does not exist.
9. `gateCContract` with `oracles: []` likewise, against the only hand-authored contract.
10. `populatedContract` with `interactionPlan: []` produces seven verdicts deep-equal to the
    unmutated run. Relevance reads no step; Story 5.2's satisfaction predicates do, and this pins
    the boundary against a later story leaking backwards.
11. `populatedContract` with `waivers: []` and `rubrics: []` likewise.
12. `populatedContract` with every `behaviors[].severity` changed to `critical` likewise. Severity
    routes a gap under AD-21 and never decides relevance. **Corrected in implementation:** that one
    rewrite is a no-op on this fixture, so the test walks all three `SEVERITY_LEVELS`. See the Dev
    Agent Record.

Rule 1, success-indicator-separation:

13. `successIndicator: null`, `channelRoles: {}`: relevant, `reason` naming the operation and the
    missing indicator.
14. `successIndicator: '/ok'`, `channelRoles: null`: relevant.
15. `successIndicator: '/ok'`, `channelRoles: {}`: not relevant. Paired with 14, this pins absent
    against explicit empty on the second conjunct.
16. `successIndicator: '/ok'`, `channelRoles: { '/ok': 'success-indicator' }`: not relevant, because
    the only roled pointer is the indicator itself.
17. `successIndicator: '/ok'`,
    `channelRoles: { '/ok': 'success-indicator', '/error': 'diagnostic' }`: relevant. Paired with
    16, this pins "at least one **other** pointer" against a regression to "at least one pointer".
18. `successIndicator: ''`, `channelRoles: { '': 'success-indicator' }`: **not** relevant. The empty
    pointer is RFC 6901's whole document and a declared answer, per `pointer.ts:111-116`'s own
    description, so a regression from `=== null` to `!successIndicator` fails here.
19. `successIndicator: ''`, `channelRoles: { '': 'success-indicator', '/error': 'diagnostic' }`:
    relevant. Paired with 18, so the empty indicator is proved read rather than skipped.
20. `populatedContract` with `create-thing` fully answering the rule (`channelRoles` reduced to
    `{ '/ok': 'success-indicator' }`) and `list-things` set to `successIndicator: null`: relevant,
    `reason` naming `list-things`. Pins the operation loop against a first-operation-only regression.

Rule 2, whole-body:

21. `requiredKeys: ['only']`: not relevant.
22. `requiredKeys: ['a', 'b']`: relevant. Boundary pair with 21, pinning `> 1` against `>= 1`.
23. `requiredKeys: ['a', 'a']`: not relevant. One key repeated is one pointer, and the schema
    carries no uniqueness constraint to stop the fixture existing.
24. `requiredKeys: []`, `permittedKeys: ['a', 'b', 'c']`: not relevant. AD-20 says coverage is never
    computed against permitted keys, and relevance reads the same set.
25. `requiredKeys: ['only']` with
    `channelRoles: { '/only': 'payload', '/error': 'diagnostic' }`: not relevant. Pins Decision 6
    against the literal transliteration of the Gate C row, which would count roled pointers.
26. `populatedContract`, `create-thing.requiredKeys` reduced to `['ok']`: relevant, `reason` naming
    `list-things`. Pins the operation loop. **Corrected in implementation:** `list-things` declares
    one required key of its own, so that single mutation answers not relevant; the test also gives
    `list-things` two required keys. See the Dev Agent Record.

Rule 3, malformed-input:

27. All four channels with empty `requiredKeys`, `permittedKeys`, and `types`: not relevant.
28. `body.requiredKeys: ['name']` with `body.types: {}`: relevant. A required key with no type entry
    is an absent type, which AD-31 grades relevant; this is the shape Decision 7 exists to close.
29. `body.types: { name: 'string' }` with empty key lists: relevant, `reason` naming `body`.
30. `query.permittedKeys: ['limit']` with empty `types`: relevant, `reason` naming `query`.
31. `header.types: { 'X-Tenant': null }`: relevant, `reason` naming `header`. The indeterminate type
    is still a declared key.
32. `path.requiredKeys: ['id']`: relevant, `reason` naming `path`. Fixtures 29 through 32 together
    prove all four transport channels are read; any three would pass with one channel hard-coded.
33. `populatedContract` with `create-thing`'s four channels emptied: relevant, `reason` naming
    `list-things`. Pins the operation loop.

Rule 4, per-record:

34. `collectionLocations: null`: relevant.
35. `collectionLocations: []`: not relevant. Paired with 34, this is the absent against
    explicit-empty grading AD-31 turns on.
36. `collectionLocations` with one entry: relevant. **Extended in implementation:** the same
    fixture asserts the two-entry reason, so both branches of the `plural` helper are pinned. See
    the Review Findings section.
37. `populatedContract` with `create-thing.collectionLocations` set to `[]`: relevant, `reason`
    naming `list-things`. Pins the operation loop.

Rule 5, sibling-cross-check:

38. `siblingGroups: null`: relevant.
39. `siblingGroups: { operations: [], parameters: [] }`: not relevant. Paired with 38.
40. `siblingGroups: { operations: [['create-thing', 'list-things']], parameters: [] }`: relevant,
    `reason` naming the operations axis. **Extended in implementation:** the same fixture asserts a
    two-group reason, since this call site would otherwise only ever run `plural`'s singular branch.
41. `siblingGroups: { operations: [], parameters: [['cursor', 'limit']] }`: relevant, `reason`
    naming the parameters axis. Paired with 40, this proves both axes are read.

Rule 6, omission-and-completeness:

42. `collectionLocations: null`: relevant.
43. `collectionLocations: []`: not relevant.
44. One location with `referenceSet: null`: not relevant. This is the shape
    `interface.ts:33-35`'s own description names as making the rule irrelevant.
45. One location with `referenceSet: 'expected-things'`: relevant. Paired with 44.
46. One location naming a reference-set identifier the contract's `referenceSets` does not declare:
    relevant. No AD-5 code covers a dangling location-side name.
47. Two locations on one operation, the first with `referenceSet: null` and the second naming one:
    relevant, `reason` naming the second location's pointer. Pins the inner location loop.
48. `populatedContract` with `create-thing.collectionLocations` set to one location whose
    `referenceSet` is `null`: relevant, `reason` naming `list-things`. Pins the operation loop,
    which fixture 47 does not.

Rule 7, state-change-read-back:

49. Every operation `stateChangeMarker: false`: not relevant.
50. One operation `stateChangeMarker: true`: relevant, `reason` naming it. Paired with 49.
51. Two interfaces, only the second interface's operation marked `true`: relevant. Pins the flatMap
    across interfaces, not just across one interface's operations.

The empty inventory, which is the precise shape of AD-31's stated Prevents:

52. `absentContract` with `permittedInterfaces: []`: rules 1, 2, 3, 4, 6, and 7 are all relevant and
    each `reason` is `NO_OPERATION`, imported from `relevance.ts` rather than re-spelled; rule 5
    follows `siblingGroups` alone and stays relevant, unchanged from fixture 2's column.
53. `absentContract` with one interface whose `operations` is `[]`: the same six relevant. Pins the
    site as the flattened operation list rather than the interface count.

Own-key enumeration, purity, totality:

54. `body.types: { constructor: 'string' }`: rule 3 relevant, `reason` naming the key `constructor`.
    `KeyName` is `z.string().min(1)` and admits it. This mutant is deliberately not re-parsed,
    since the predicate is what is under test.
55. Two independent `EvalContract.parse` calls on `populatedContract` produce deep-equal verdict
    arrays, every `reason` string included. Purity over two parses rather than two calls on one
    parse, which `.map` makes trivially true.
56. `Object.keys(RELEVANCE_PREDICATES)` equals `DISCIPLINE_RULES` as a set, so no predicate is
    orphaned and none is missing. This lives in `relevance.test.ts` with the map it guards, which is
    the one deliberate crossing of the mirror rule.

`tests/coverage/rules.test.ts`:

57. `DISCIPLINE_RULES` has exactly seven members, all unique, all matching
    `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`, and `relevancePredicateId` maps them to seven distinct
    identifiers.
58. `DISCIPLINE_RULES` equals the seven distinct `oracles[].rule` values the Gate C contract carried,
    asserted as a literal array so a rename fails here rather than forking the vocabulary from
    `Waiver.rule` and every historical record.

### AC 8: The gate

`npm run validate` passes end to end, including `check:layers` reporting 56 files scanned with zero
violations, up from the baseline 54. `npm run build` passes separately, since `validate` does not
build.

No new dependency, no change to `package.json`, no change to `schemas/`, no change to
`FAILURE_CODES` or `RUNTIME_FAULT_CODES`, so `check:schemas`, `check:ad5-registry`, and
`check:ad28-registry` must report the story 4.4 baseline unchanged: 12 schema files, 21 codes, and
10 codes.

## Tasks / Subtasks

- [x] Task 1: Preflight the baseline (AC 8)
  - [x] Confirm the working tree has no untracked `src/core/coverage/` or `tests/coverage/` left
        from story creation, then record the baseline. The 4.4 baseline is 49 test files, 1924
        tests, and `check:layers` 54 files.
  - [x] `npm run check:docs` reports 55 files and does not read this story: `scripts/check-docs.mjs`
        ROOTS covers README, planning artifacts, project knowledge, and two experiment files, and
        `_bmad-output/implementation-artifacts` is outside it. Record the number as a baseline only.
- [x] Task 2: `src/core/coverage/rules.ts` (AC 2)
- [x] Task 3: `src/core/coverage/relevance.ts` (AC 3, AC 4, AC 5)
  - [x] Transcribe AC 3, AC 4, and AC 5's code blocks in that order into one file.
  - [x] The AC blocks are already in Biome's format and import order, so `biome check --write`
        should report no fixes. If it changes anything, treat the change as a finding and record it.
- [x] Task 4: `tests/coverage/relevance.test.ts` (AC 7 fixtures 1 through 56)
  - [x] One `it` per numbered fixture, the fixture number opening the test name.
- [x] Task 5: `tests/coverage/rules.test.ts` (AC 7 fixtures 57 and 58)
- [x] Task 6: Run the gate (AC 8)
  - [x] `npm run validate`, then `npm run build`.
  - [x] Record the new counts and attribute every delta to named fixtures.
- [x] Task 7: Close out
  - [x] Fill the Dev Agent Record: model, debug log, completion notes, file list.
  - [x] Once the implementation is green and reviewed, add Step 16 `(epic5-story1)` to
        `_bmad-output/project-knowledge/learning-path-step-by-step.md` following
        `learning-path-template.md`'s exact shape, plus one row appended to the table at line 58.
  - [x] Set `sprint-status.yaml`'s `5-1-the-seven-relevance-predicates` to `review` when handing off
        for code review, and to `done` on merge. `epic-5` is already `in-progress`.

## Decisions taken during story creation

Each is settled with a stated default and its downstream consequence. Per this project's standing
convention, settle ambiguities in the story or the code, record the reasoning, and do not escalate
to a new architecture revision. Proceed unless the user amends one; record the outcome in the Dev
Agent Record.

Decisions 4, 7, 10, and 13 fire wider than the Gate C row's literal text. The licence is
`epics.md:14`, "Where this document and the spine disagree on a mechanic, the spine governs", and
the governing sentence is AD-31's: "Where a declaration is absent, or is present but resolves to an
enumerated indeterminate descriptor state, the rule is relevant and its absence is a coverage gap."

1. **The module lives at `src/core/coverage/`.** AD-5 calls AD-20's rules "coverage classes", the
   emitted record is `CoverageGap`, and the epics document's FR coverage map lists Epic 5 as
   "coverage classes". Considered and rejected: `src/core/discipline/`, which names the rules rather
   than what they produce, and `src/core/compile/`, whose every module throws `StructuralFailure`
   for one AD-5 code. Rejected because a coverage gap never blocks compilation, so a non-throwing
   predicate sitting among nineteen throwers invites a future caller to add it to `compile`'s call
   list. **Consequence:** Story 5.2's satisfaction predicates and Story 5.3's table generator land
   in the same directory, and `tests/coverage/` mirrors it.

2. **Epic 5 mints the discipline-rule identifier vocabulary, and the spellings are the Gate C
   contract's own.** `Waiver.rule` and `CoverageGap.rule` are both opaque strings, each saying an
   enum there would mint a vocabulary AD-20 declined to and Epic 5 has to match. The seven live at
   `.../reviews/gate-c/eval-contract.json` lines 267, 289, 323, 347, 395, 418, and 446. Considered
   and rejected: numbering the rules one through seven, matching the Gate C findings table. Rejected
   because a coverage-gap record carrying `rule: "6"` is not diagnosable, and AD-31's whole point is
   that a gap names the predicate that fired. **Consequence:** fixture 57 pins the arity and
   spelling shape, and fixture 58 pins the seven literal strings against a rename that would fork
   the vocabulary from `Waiver.rule`.

3. **Minting the vocabulary does not reopen the `oracles[].rule` re-spelling.** The Gate C contract
   carried an author-attested rule label, deleted because reading it would turn fourteen decision
   procedures into self-assessment (`tests/schemas/fixtures/gate-c-contract.ts:34-39`). Considered
   and rejected: reading that label back as a relevance input now that Epic 5 owns the vocabulary.
   Rejected because AD-31 computes relevance from declarations only, and an author-supplied label is
   the self-assessment channel the deletion closed. Naming the rules a predicate decides reads no
   contract field. **Consequence:** fixtures 8 and 9 prove oracle-blindness by mutation, so the
   deletion stays enforced by test rather than by convention.

4. **An absent declaration answers relevant; an explicit empty one answers not relevant.** AD-31,
   quoted in the preamble above. Considered and rejected: reading the Gate C relevance rows
   literally, so `siblingGroups: null` and `collectionLocations: null` both answer not relevant.
   Rejected because AD-31's stated Prevents is a contract that declares almost nothing from
   rendering every rule irrelevant and scoring clean, and the literal reading produces exactly that.
   **Consequence:** `absentContract` and `explicitlyEmptyContract` disagree on rules 4, 5, and 6,
   which is what the three-state fixture triple was built to make expressible; fixtures 34/35,
   38/39, and 42/43 pin it.

5. **Relevance is one contract-level verdict per rule, existential over the flattened operation
   list.** `CoverageGap` carries a rule and two predicate names and no operation identifier, so a
   per-operation verdict has nowhere to land. Considered and rejected: returning one verdict per
   operation per rule. Rejected because Story 5.2's rule 2 denominator is already per addressed
   step, so the operation-scoped detail arrives there with a step to hang it on, and duplicating it
   here would give two answers to one gap record. **Consequence:** the `reason` string names the
   witnessing operation, so the detail is diagnosable without being structural. Fixtures 20, 26, 33,
   37, 48, and 51 pin the operation loop for rules 1, 2, 3, 4, 6, and 7; fixture 47 separately pins
   rule 6's inner loop over locations, which is a different branch.

   **Second consequence, recorded during code review: one operation's absent declaration and a
   different operation's present one land on the same contract-level verdict.** `populatedContract`
   is rule 4 relevant through `create-thing.collectionLocations: null`, while `list-things` is the
   only operation that can satisfy rule 4 at all; rule 6 has the same shape on the same fixture, and
   so does `gateCContract`, where `submit-export` and `get-export` are both `null` and
   `list-export-rows` carries the only location. If Story 5.2 makes satisfaction a contract-level
   existential too, `list-things` satisfying the rule discharges `create-thing`'s absence and
   under-declaration earns a clean result, which is the direction AD-31 forbids. This story settles
   the relevance half only, and it settles it as contract-level, because `CoverageGap` carries no
   operation identifier for a per-operation verdict to land on. **Story 5.2 inherits the
   requirement, stated as a quantifier:** satisfaction must hold for every operation the rule is
   relevant for. The single operation a `reason` names is a diagnostic pointer to one of them and
   carries no scope: every predicate short-circuits on the first operation that answers, so the
   witness is an artifact of array order. Put `list-things` before `create-thing` in
   `populatedContract` and rule 4 witnesses `list-things` instead, with the same verdict, so a 5.2
   requirement resting on the witness would evaluate a different operation for the same contract.
   **Consequence for Story 5.3's corpus:** under the quantifier, `gateCContract`'s `submit-export`
   and `get-export` both declare `collectionLocations: null`, so rules 4 and 6 are permanent gaps on
   the only hand-authored contract until those two nulls are rewritten to `[]`. That is AD-31
   working as designed, and it is written down here so 5.2 and 5.3 meet it as a decision instead of
   as a surprise.

6. **Rule 2 counts distinct `requiredKeys`.** AD-20's operation-scoped denominator paragraph says
   coverage is never computed against permitted keys, and the schema's own description of rule 2
   relevance sits on `requiredKeys` (`interface.ts:48`). Considered and rejected, first:
   `requiredKeys` unioned with `permittedKeys`, following Story 4.1's Decision 5. Rejected because
   that decision governs reachability, which asks whether a pointer can resolve at all, and using it
   here would make the rule relevant on a descriptor whose satisfaction denominator is one key.
   Considered and rejected, second: `Object.keys(channelRoles)`, the pointer set AD-19 line 341 says
   the descriptor literally names, which is the closest transliteration of the Gate C row. Rejected
   because the schema's own rule-2 sentence sits on `requiredKeys`, and because `channelRoles` is
   nullable, which would give rule 2 an absent state AD-31 grades relevant and for which rule 2 has
   no denominator at all. **Consequence:** the witnessing operation has a denominator of at least
   two. That is all this reading buys, and the sentence this bullet first carried claimed more:
   relevance is one contract-level existential over the flattened operation list (Decision 5) while
   AD-20's denominator is scoped to the operation an addressed step names, and the two scopes do not
   compose. Story 5.2 will meet a relevant rule 2 whose addressed step's operation has an empty
   denominator, by two shapes this story's own fixtures already exhibit: fixture 52's empty
   inventory answers relevant with no operation to take a denominator from at all, and fixture 24
   proves `requiredKeys: []` parses, so a contract declaring two required keys on one operation and
   none on another is relevant while a whole-body oracle addressing the second has nothing to
   divide by. Story 5.2 owns both cases, and the Gate C `underspecified` row for rule 2 satisfaction
   is not closed by this story. Corrected during code review; see the Review Findings section.
   Fixture 25 pins the rejected `channelRoles` reading.

7. **Rule 3's site is the whole channel triple, not `types` alone.** `KeyTypeMap` says a missing key
   means "not declared" and an explicit `null` value means "declared, type not stated", naming that
   as AD-31's enumerated indeterminate descriptor state. A key in `requiredKeys` or `permittedKeys`
   with no `types` entry has an absent type. Considered and rejected: the Gate C row's literal "at
   least one typed key", requiring a definite JSON type. Rejected because it lets an author buy
   irrelevance on the malformed-input rule by declaring an input and refusing to type it, which is
   under-declaration earning a clean result. **Consequence:** rule 3 is irrelevant only for an
   operation that declares no input at all on any channel, and fixture 28 is the shape that would
   have escaped under the literal reading. The `reason` names the channel and key rather than the
   type, since under this site the key may carry no type entry.

8. **Rule 6's site is `collectionLocations`, and the contract-level `referenceSets` map is not a
   relevance site.** The Gate C row's Reads column lists both, but `referenceSets` is where a named
   set resolves rather than where the rule becomes applicable. Considered and rejected: treating
   `referenceSets: null` as an absent declaration that makes rule 6 relevant. Rejected because it
   would fire the completeness rule on a contract that declared `collectionLocations: []`, which is
   an explicit answer that there is no collection to reconcile. **Consequence:** rule 6 is not
   relevant on `explicitlyEmptyContract` even though its `referenceSets` is `{}`, which fixture 3's
   column assertion pins, with fixture 43 as its per-rule isolate.

9. **A collection location naming a reference-set identifier the contract does not declare still
   makes rule 6 relevant.** `unresolved-reference-set` is defined over a reference-set *operand*,
   not over `CollectionLocation.referenceSet`, so no AD-5 code covers this shape. Considered and
   rejected: treating the dangling name as no name. Rejected because Story 4.3's Decision 4 declined
   to invent a condition no code names, and because reading a dangling name as no name is the
   fail-open direction. **Consequence:** fixture 46 pins it, and if a later story mints a code for
   the dangling case, this decision is what it supersedes.

10. **An empty operation inventory makes all six operation-scoped rules relevant.** A contract with
    no operation has declared nothing for them to read, which is the absent case of Decision 4 taken
    to its limit. Considered and rejected: answering not relevant because there is nothing to check.
    Rejected because it is the precise shape of AD-31's stated Prevents. **Consequence:**
    `NO_OPERATION` is one exported constant so fixture 52 can import it rather than re-spell it, and
    so Story 5.2 can distinguish an empty-inventory gap from a declared-absence gap. Rule 5 stays
    independent of the inventory.

11. **The predicates return a verdict record and never throw.** A coverage gap emits the artifact
    with the gap recorded and never blocks, so there is no failure code and nothing to throw.
    Considered and rejected: the `checkX(contract): void` thrower shape every `core/compile/` module
    uses. Rejected because that shape is bound to an AD-5 code and this story mints none.
    **Consequence:** `tests/coverage/` does not import `structuralFailureOf` from
    `tests/compile/helpers.ts`. The nearest non-throwing precedent is `evaluatePointerReachability`,
    though this story flattens its discriminated union into one flat record, so `reason` is present
    on both verdicts and fixture 7 can assert it unconditionally.

12. **Nothing is wired into `core/compile/compile.ts` and `compile`'s return type is unchanged.**
    Story 4.4 shipped `compile` returning a bare `EvalContract` and stated that Epic 5 owns coverage
    predicates and their records. A gap record needs a satisfaction verdict, which does not exist
    until Story 5.2. Considered and rejected: adding a coverage pass now and filling
    `satisfactionPredicate` with a placeholder. Rejected because
    `CoverageGap.satisfactionPredicate` is `z.string().min(1)` and a placeholder that parses is
    worse than an absence that does not. **Consequence:** the seven predicates are reachable only
    from tests until a later story wires them, which is the position `evaluatePointerReachability`
    held between Stories 4.1 and 4.4.

13. **`successIndicator: null` is absence, so rule 1 is relevant on any operation that nominates no
    indicator.** The Consistency Conventions spell an absent value as explicit `null`, and AD-19
    makes a nominated success indicator a required declaration. Considered and rejected: treating
    `null` as the explicit empty answer, the way `channelRoles: {}` and `collectionLocations: []`
    are treated under Decision 4. Rejected because those two have a third spelling that separates
    absent from empty, and a nullable pointer has only two, so reading `null` as an answer would
    leave rule 1 with no absent state at all. **Consequence:** rule 1 is the one rule relevant on
    both `absentContract` and `explicitlyEmptyContract`, which is why AC 6's table is stated rather
    than left to be re-derived. The second conjunct is where this rule's irrelevant case lives, and
    fixture 15 pins it.

14. **Rule 1's second conjunct means a pointer other than the success indicator, carrying any of the
    four channel roles.** The Gate C row says "at least one other pointer carries a channel role"
    and names no role. Considered and rejected: requiring the other pointer's role to be something
    other than `success-indicator`. Rejected because a descriptor may legitimately mark two pointers
    as indicator-bearing, and the row constrains the pointer rather than the role. **Consequence:**
    fixtures 16 and 17 are the paired proof, and a regression to "at least one pointer carries a
    role" fails 16.

## Dev Notes

### Read these files before writing anything

1. `ARCHITECTURE-SPINE.md` AD-31 (447-456): the governing rule. Relevance is computed from
   declarations only and never inferred from the oracles; a coverage-gap record names the relevance
   predicate that fired; an absent or indeterminate declaration is relevant and an explicit empty
   one is an answer.
2. `ARCHITECTURE-SPINE.md` AD-20 (351-360): the seven rules in the order this story's identifier
   tuple uses, and rule 2's operation-scoped denominator.
3. `ARCHITECTURE-SPINE.md` AD-19 (337-349): the declarations, with the value spaces revision 8
   supplied for channel roles, expected cardinality, and reference sets.
4. `ARCHITECTURE-SPINE.md` AD-5 (251): coverage classes are AD-20's rules fired by AD-31, and a
   coverage gap emits the artifact with the gap recorded and never blocks. This is why nothing here
   throws.
5. `.../reviews/gate-c/FINDINGS.md` lines 46-64 and 126-141: the Gate C table. Lines 51, 53, 55, 57,
   59, 61, and 63 are the seven relevance rows this story implements. Line 126 records that the
   thirteen declaration-only predicates from the first pass are unchanged, so those seven rows are
   final as of revision 9.
6. `src/core/schemas/interface.ts` in full: every field six of the seven rules read, and every
   `.describe()` on it states which rule reads it and which state makes the rule irrelevant. These
   descriptions are the closest thing to a spec the repository has for this story.
7. `src/core/schemas/eval-contract.ts` lines 96-121 and 155-170: `SIBLING_GROUP_MINIMUM`,
   `SiblingGroups`, and the three-state descriptions on `referenceSets` and `siblingGroups`.
8. `src/core/schemas/primitives.ts` lines 111 and 151-167: `KeyName` is `z.string().min(1)`, so
   `constructor` is an admissible key, and `KeyTypeMap` names the indeterminate state.
9. `src/core/schemas/pointer.ts` lines 105-116: `DescriptorPointer` admits the empty string, which
   nominates the whole response body. Fixtures 18 and 19 exist because of that sentence.
10. `src/core/schemas/evidence-artifact.ts` lines 148-159: `CoverageGap`, the record this story's
    `predicate` identifier eventually fills, and its stated reason for `rule` being opaque.
11. `tests/schemas/fixtures/relevance-contracts.ts` in full: the three-state triple built in Epic 1
    for exactly this story. Its header states Story 5.3's corpus is unbuildable if any one of the
    three is not expressible. Note lines 8-19, where all four transport channels of the absent and
    explicitly-empty contracts share one `emptyChannel` object.
12. `tests/schemas/relevance-axes.test.ts` in full: one describe block per rule, already asserting
    the three states parse and are distinguishable. This story asserts what the predicates make of
    them; do not duplicate the parse assertions.
13. `tests/schemas/fixtures/gate-c-contract.ts` lines 1-95 (the `RESPELLINGS` table) and its
    interface inventory: the only contract hand-authored against revision 9, and the record of why
    `oracles[].rule` was deleted.
14. `src/core/evaluate/resolution.ts` lines 243-247 and 555-594: the totality-checked handler map
    idiom `RELEVANCE_PREDICATES` copies. Its `Object.hasOwn` guard at line 590 is deliberately not
    copied: that key arrives from parsed input, while `evaluateRelevance` indexes only with members
    of the `DISCIPLINE_RULES` tuple, so a runtime guard here would be unreachable code.
15. `src/core/compile/reachability.ts` lines 130-170: `ReachabilityResult` and
    `evaluatePointerReachability`, the reason-carrying non-throwing predicate shape this story
    follows, flattened per Decision 11.
16. `4-4-stages-as-pure-plan-and-reduce-pairs-with-one-orchestration-layer.md` in full: the layer
    gate this story runs under, and the two places it names Epic 5's ownership.
17. `4-1-pointer-resolution-and-reachability.md` in full: house style, the `Object.hasOwn` and
    precondition conventions, and the exact shape a Decisions section and a Dev Agent Record take in
    this codebase.

### Previous-story intelligence

1. `npm run check:layers` is in `validate` as of Story 4.4. Under `core/`: no `async`, no `await`,
   no `Date`, no `Math.random`, no Node builtin, no external import. A `.ts` file directly under
   `src/` outside every layer directory is itself a violation. `src/core/coverage/` classifies as
   `core` with no checker change.
2. `src/core/compile/compile.ts` calls nineteen checks in fixed AD-5 registry order, fail-fast.
   Story 4.2's story file says fifteen because it predates two review-added forbidden-input
   functions. Use the source tree as the count of record.
3. The recurring review failure mode across all four Epic 4 stories lands in the tests and the
   prose. Every one of them transcribed the AC code block correctly and passed on the first run, and
   every one of them then took review findings. The four repeat offenders this story's fixture list
   is shaped against: a special-cased branch with no fixture aimed at it; a boundary proved one-past
   but not at-bound; a constant re-spelled instead of imported; and prose drifting from code.
4. Story 4.3's Decision 7 is now a standing convention: every numeric or arity comparison needs a
   paired at-bound and over-bound fixture, because a mutation from `>` to `>=` ships undetected
   otherwise. Rule 2's `> 1` is the only such comparison here, and fixtures 21 and 22 are its pair.
5. Story 4.2's Decision 3, quoted from `ad5-admissions.test.ts`: a schema tightened past a code does
   not make the product safer. The analogue here is a predicate fired past its Gate C row. Every
   place this story fires wider is recorded in Decisions 4, 7, 10, and 13 with the AD-31 sentence
   that licenses it, and nowhere else.
6. `operationsOf` is local rather than `buildPlanIndex` from `core/seal/plan-index.ts:150`, even
   though `core/coverage` to `core/seal` is an allowed edge. That function takes `interactionPlan`
   as its first argument, which fixture 10 pins as unread here, and it throws `TypeError` on a
   duplicate operation identifier, which Decision 11 forbids.
7. Story 4.1's story file carries a Review Findings checklist with thirteen unchecked items, none of
   which is in `deferred-work.md`. Several are verifiably still open: fixture 25's direct contrast
   against `checkEvidenceReachability` is absent from `tests/evaluate/evidence-resolution.test.ts`,
   fixture 28 at that file's line 386 exercises `~1` without `~0` on the declared side, and
   `src/core/compile/reachability.ts:216` still admits a non-index token against a root-declared
   collection, falling through to the object-key check instead of rejecting it. They belong to
   `core/compile/reachability.ts` and `core/evaluate/`, which this story does not touch, and they
   are recorded here so the next reader finds them rather than inheriting them silently.
8. `deferred-work.md` carries no open items and this story opens none. If it opens one, the file's
   "no items are currently open" header prose must change with it.
9. Recent commits, for the shape of the tree this lands on: `430d3b7` added the orchestration layer,
   the two registry checks, and the layer gate; `f9f6482` added the scripting-bound graph predicate;
   `e38169b` added the AD-5 registry as code.

### Project structure notes

New files:

- `src/core/coverage/rules.ts`
- `src/core/coverage/relevance.ts`
- `tests/coverage/relevance.test.ts`
- `tests/coverage/rules.test.ts`

Edited files: none in `src/`. `_bmad-output/project-knowledge/learning-path-step-by-step.md` and
`_bmad-output/implementation-artifacts/sprint-status.yaml` change in Task 7.

`src/index.ts` is not touched, matching every Epic 3 and Epic 4 story. `package.json`, `schemas/`,
`biome.json`, `vitest.config.ts`, both tsconfigs, and everything under `scripts/` are unchanged.

Naming: files are kebab-case, one concern per file. Zod schemas and their inferred types share a
`PascalCase` name; `as const` tuples are `SCREAMING_SNAKE`; functions are `camelCase`. Every file
opens with a doc comment carrying the AD citation and the reason a shape was chosen, kept no longer
than the declaration it documents. Imports carry the explicit `.ts` extension and type-only imports
use `import type`, which Biome enforces as an error.

### Testing requirements

- `tests/coverage/` mirrors `src/core/coverage/`, matching how `tests/compile/` mirrors
  `src/core/compile/`. Fixture 56 is the one deliberate crossing, stated in its own text.
- One `it` per numbered fixture, the fixture number opening the test name. Reserve `it.each` for a
  small homogeneous family; fixtures 1 through 7 over the four whole-contract fixtures are the
  natural candidate, and everything per-rule is one `it` each.
- Whole-contract positives go through `EvalContract.parse`. A bare `as EvalContract` cast on the
  shipped fixtures does not typecheck, because they are declared `satisfies EvalContract`.
- Per-rule negatives are `structuredClone(fixture) as any` with the fewest mutations the fixture's
  stated shape requires, matching `tests/schemas/ad5-admissions.test.ts`'s style. Where that file
  already admits the shape being mutated, reuse its exact mutation rather than approximating it.
- **`structuredClone` preserves shared references.** `relevance-contracts.ts:8-19` builds all four
  transport channels of `absentContract` and `explicitlyEmptyContract` from one `emptyChannel`
  object, and a clone keeps them aliased. Every rule 3 channel mutation must **replace** the channel
  object outright, as in `shape.body = { requiredKeys: [], permittedKeys: [], types: { name: 'string' } }`.
  Writing through it changes all four channels at once, and `malformedInputRelevance` then reports
  `path` first, which silently breaks fixtures 29 through 32 on their `reason` assertion while
  fixture 28 still passes.
- `tests/schemas/relevance-axes.test.ts:21-37` already carries `operationsOf`, `firstOperation`, and
  `operationNamed` as file-private helpers. Do not import across test files. If `tests/coverage/`
  needs them, put one copy in a new `tests/coverage/helpers.ts` and note in its header that
  `relevance-axes.test.ts` holds an equivalent private copy.
- Do not import `structuralFailureOf` from `tests/compile/helpers.ts`; nothing here throws.
- `any` is permitted in `tests/` and forbidden in `src/`. `it.only` and `describe.only` are lint
  errors and therefore fail `validate`.
- No configured coverage threshold, matching every prior story's own note: the proxy is AC 7's
  fixture list plus assertions specific enough to fail if the property they name is removed. Do not
  run `--coverage`; no provider is installed.

### References

- Epic and story text: `_bmad-output/planning-artifacts/epics.md` lines 374-388 (Epic 5 preamble and
  Story 5.1 through its `Then` clause), line 27 (FR6's full statement), line 74 (FR6 maps to Epic
  5), line 14 (the spine-governs clause).
- `ARCHITECTURE-SPINE.md` AD-31 (447-456), AD-20 (351-360), AD-19 (337-349), AD-5 (213-251),
  AD-26 (394-402), AD-4 (195-212), Structural Seed (580-612).
- Gate C: `.../reviews/gate-c/FINDINGS.md` lines 46-64 (first-pass table) and 126-141 (second pass
  and closure counts); `.../reviews/gate-c/eval-contract.json` lines 267-446 (the seven
  `oracles[].rule` spellings).
- Schemas: `src/core/schemas/interface.ts:11-158`, `src/core/schemas/eval-contract.ts:96-198`,
  `src/core/schemas/primitives.ts:111,151-167`, `src/core/schemas/pointer.ts:35-40,105-116`,
  `src/core/schemas/evidence-artifact.ts:148-159`, `src/core/schemas/waiver.ts:12-29`.
- Shape precedents: `src/core/compile/reachability.ts:130-170`,
  `src/core/evaluate/resolution.ts:243-247,555-594`, `src/core/failure-codes.ts:1-32`.
- Fixtures: `tests/schemas/fixtures/relevance-contracts.ts`,
  `tests/schemas/fixtures/gate-c-contract.ts`, `tests/schemas/relevance-axes.test.ts`.
- House style: `tests/compile/scripting-bound.test.ts` in full,
  `4-1-pointer-resolution-and-reachability.md`,
  `4-4-stages-as-pure-plan-and-reduce-pairs-with-one-orchestration-layer.md`.
- Learning path: `_bmad-output/project-knowledge/learning-path-template.md` (shape),
  `_bmad-output/project-knowledge/learning-path-step-by-step.md` line 58 (the table row to append)
  and line 1054 (Step 15's heading, the format Step 16 follows).

## Suggested Review Order

1. AC 6's truth table against AC 4 and AC 5's predicates and the four shipped fixtures. If one cell
   is wrong, the fixture list is wrong with it, and every downstream assertion inherits the error.
2. Decision 4 against AD-31's sentence on absent and explicitly empty declarations, then Decisions
   7, 8, 10, and 13, which are all that sentence applied to a specific site.
3. Decision 6 against AD-20's rule 2 denominator paragraph, against Story 4.1's Decision 5 which it
   deliberately does not follow, and against the `channelRoles` reading fixture 25 pins.
4. Fixtures 8 through 12: the declaration-only proof. If any one of them can pass while a predicate
   reads an oracle, the story's central claim is untested.
5. The paired fixtures, each of which exists because one half alone passes under a regression the
   other half catches: 16/17, 18/19, 21/22, 34/35, 38/39, 42/43, 44/45, 49/50, and 29 through 32 as
   a four-way set.
6. The operation-loop fixtures 20, 26, 33, 37, 48, and 51 against Decision 5, and fixture 47 against
   rule 6's inner loop, which is a different branch.
7. The Testing requirements note on `structuredClone` aliasing, then fixtures 29 through 32's actual
   mutations, which are the ones it protects.
8. `check:layers` reporting 56 files, and the unchanged 12 / 21 / 10 from `check:schemas`,
   `check:ad5-registry`, and `check:ad28-registry`.

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (`claude-opus-5[1m]`)

### Debug Log References

None. No fixture needed a debug session. Two AC 7 fixtures were vacuous as written and are corrected
below; both were caught by reading the shipped fixture data rather than by a failing run, which is
why they would have shipped green.

### Completion Notes List

- Baseline recorded at `430d3b7` with a clean tree and no leftover `src/core/coverage/` or
  `tests/coverage/`: `check:layers` 54 files 0 violations, `check:docs` 55 files, `check:schemas` 12,
  `check:ad5-registry` 21 codes, `check:ad28-registry` 10 codes, `vitest run` 49 files / 1924 tests.
- AC 2, AC 3, AC 4, and AC 5 were transcribed verbatim into `src/core/coverage/rules.ts` and
  `src/core/coverage/relevance.ts`. `biome check src/core/coverage` reported no fixes on the first
  run, so the AC blocks shipped byte-for-byte as written.
- Nothing outside the four new files changed. `core/compile/compile.ts`, `src/index.ts`,
  `package.json`, `schemas/`, `scripts/`, and both tsconfigs are untouched.
- **Fixture 12 corrected.** AC 7 fixture 12 rewrites every `behaviors[].severity` to `critical`, but
  `populatedContract` declares one behaviour and it is already `critical`
  (`relevance-contracts.ts:125`), so the mutation is a no-op and the assertion proves nothing. The
  test walks all three members of `SEVERITY_LEVELS`, imported from
  `src/core/schemas/eval-contract.ts` rather than re-spelled, and asserts deep equality against the
  unmutated run at each level. Strictly stronger than the stated fixture and non-vacuous.
- **Fixture 26 corrected.** AC 7 fixture 26 reduces `create-thing.requiredKeys` to `['ok']` and
  expects rule 2 relevant with `list-things` as the witness. `list-things` declares one required key
  of its own (`requiredKeys: ['items']`), so under that single mutation rule 2 answers **not**
  relevant and the fixture would have failed. The test also sets
  `list-things.requiredKeys` to `['items', 'error']`, both already in that descriptor's
  `permittedKeys`, which is the fewest mutations the fixture's stated shape needs: a witness past
  the first operation. The reason assertion pins `list-things`.
- Fixture 46 additionally asserts `contract.referenceSets` is `{}` before asserting the verdict, so
  "names an identifier the contract does not declare" is proved by the fixture rather than assumed
  from `absentContract`'s `referenceSets: null`.
- Rule 3's mutations replace the channel object outright, per the story's `structuredClone` aliasing
  note. A local `emptyChannel()` factory returns a fresh triple per call so no mutation can write
  through the shared object `relevance-contracts.ts:8-19` builds all four channels from.
- The navigation helpers (`firstOperation`, `firstDescriptor`, `operationNamed`) are file-private in
  `tests/coverage/relevance.test.ts` and no `tests/coverage/helpers.ts` was created: one test file
  needs them, so a shared module would add a fifth file to a four-file story for no second consumer.
  The header notes `tests/schemas/relevance-axes.test.ts:21-37` holds an equivalent private copy.
- Per-rule mutants are re-parsed through `EvalContract.parse`, so every assertion speaks about a
  contract the schema accepts. Fixture 54 is the one exception, stated in its own AC text and
  repeated in a comment at the fixture.
- Seven deliberate regressions were introduced against the finished predicates and reverted, to
  confirm the fixture list is not passing vacuously. Each was caught by the fixtures the story names
  for it: `> 1` to `>= 1` failed 21, 23, 25, 26 (and columns 2 and 3); `=== null` to `!successIndicator`
  failed 18 and 19; dropping the "other pointer" filter failed 16, 17, 18, 19, 20; reading `types`
  alone on rule 3 failed 28 and 32; treating `collectionLocations: null` as an answer failed the
  columns; ignoring rule 5's parameters axis failed 41; and truncating the operation list to its
  first member failed 20, 26, 33, 37, 48, 51.
- After the review passes closed, the doc comments in `rules.ts`, `relevance.ts`, and both test
  files were pruned and de-AI'd, which is the fourth and last deviation from the AC code blocks. The
  AC blocks' comment prose carried the constructions this repository's style bans, chiefly the
  negation-then-correction shape ("compared against `null`, never for truthiness", "a mapped type
  rather than a switch"), and several comments ran longer than the declaration they document. Code
  is byte-identical apart from the `plural` helper recorded above: same statements, same
  expressions, same exported names, and all 58 fixtures pass unchanged. `learning-path-step-by-step.md`
  Step 16 went through the same pass.
- Final gate: `npm run validate` green end to end, then `npm run build` green separately.
  `check:layers` 56 files 0 violations, up from 54 by the two new source files. `vitest run` 51 files
  / 1982 tests, up from 49 / 1924 by the two new test files and their 58 fixtures. `check:docs` 55,
  `check:schemas` 12, `check:ad5-registry` 21, `check:ad28-registry` 10, all unchanged as AC 8
  requires.

### Review Findings

One peer code-review pass (`/bmad-code-review`, separate Claude Code session) against the four new
files and the story bookkeeping. It re-derived all 28 cells of AC 6's truth table against the shipped
fixture data and found them correct, confirmed the `structuredClone` aliasing note is honored by
fixtures 28 through 33, confirmed both implementation-time fixture corrections, and found no
correctness defect in any of the seven predicates. Nine findings, all addressed in this pass.

1. **High. Decision 6's stated consequence was false.** It claimed Story 5.2 never meets a relevant
   rule 2 with an empty denominator. Relevance is a contract-level existential (Decision 5) and
   AD-20's denominator is scoped to the addressed step's operation, so the scopes do not compose;
   fixture 52's empty inventory and fixture 24's `requiredKeys: []` are both counterexamples this
   story already ships. Decision 6 now states what the reading actually buys and hands the two open
   cases to Story 5.2, with the Gate C `underspecified` row for rule 2 satisfaction recorded as
   still open. No code change: the predicate was never wrong, only the prose about its consequence.
2. **Medium-high. Fixture 6 was an identity.** `expect(verdict.predicate).toBe(relevancePredicateId(verdict.rule))`
   re-derives the expected value from the function under test, and nothing else pinned the
   `-relevance` suffix, so it could have changed to anything with all 58 fixtures green while
   `CoverageGap.relevancePredicate` and Story 5.3's table forked. `tests/coverage/rules.test.ts` now
   carries the seven identifiers as literals, the way fixture 58 carries `GATE_C_RULES`, asserted
   inside fixture 57. Fixture 6 stays as the cross-check that a verdict carries the identifier.
   Verified by flipping the suffix to `${rule}-x`, which fails fixture 57 alone.
3. **Medium. Decision 5's scope let one operation's absence be masked by another's declaration.**
   `populatedContract` is rule 4 relevant through `create-thing`'s absent location list while
   `list-things` is the only operation that can satisfy the rule; `gateCContract` has the same shape.
   The relevance half is settled as contract-level and unchanged, since `CoverageGap` carries no
   operation identifier. Decision 5 now records the masking and the requirement it puts on Story
   5.2: satisfaction is witnessed by the operation that witnessed relevance.
4. **Medium. Fixture 55 could not detect input mutation.** A predicate writing to its input would
   write to both independently-parsed contracts alike and leave the arrays deep-equal. It now clones
   the parsed contract and asserts the contract is unchanged after `evaluateRelevance`. Verified by
   writing a stray property onto the contract inside `siblingCrossCheckRelevance`, which fails
   fixture 55 alone.
5. **Medium-low. The File List declared a learning-path edit the diff did not contain.** That step
   lands after the story is marked done, per Task 7. The File List now separates what is in this
   diff from what Task 7 still owes.
6. **Low. The `(s)` plural escape reached a diagnosable reason string.** Three reasons read
   "1 collection location(s)" and "1 operation sibling group(s)", asserted verbatim by fixtures 36,
   37, 40, and 41. A local `plural` helper in `relevance.ts` now agrees the count noun with its
   count, and fixture 36 pins both branches. This is a third deviation from the AC code blocks,
   recorded here for the same reason as the other two.
7. **Low. AC 6 overstated what its table proves.** The populated and Gate C columns are both
   all-relevant, so a fail-open regression is caught by the two left columns and the per-rule
   negatives. AC 6 says so now, and the test file carries the same note beside the two columns.
8. **Low. Fixture 56 cannot fail while `RELEVANCE_PREDICATES`'s mapped type stands.** Kept, since it
   is what catches that annotation being loosened to a `Record<string, ...>` later, with a comment
   at the fixture saying that is the whole of its job.
9. **Low. AC 7's text for fixtures 12 and 26 still read the pre-correction way.** Both are now
   annotated in place with a pointer to this record.

A second verification pass over those fixes closed all nine and opened seven smaller items, each
addressed here in turn.

10. **Medium. Decision 5's new requirement was order-dependent as worded.** "Witnessed by the
    operation that witnessed relevance" cannot bind Story 5.2, because every predicate
    short-circuits on the first operation that answers, so the witness follows array order. Reorder
    `populatedContract`'s two operations and rule 4 witnesses `list-things` with the same verdict.
    The requirement is now stated as a quantifier, satisfaction holds for every operation the rule
    is relevant for, with the `reason`'s single operation named as a diagnostic pointer. Decision 5
    also records what the quantifier costs Story 5.3's corpus: `gateCContract`'s `submit-export` and
    `get-export` both carry `collectionLocations: null`, so rules 4 and 6 are permanent gaps on the
    only hand-authored contract until those nulls become `[]`.
11. **Medium-low. Finding 5's fix had inverted.** The learning-path step landed in this diff while
    the File List still filed it as owed. It is back under Edited, both Task 7 checkboxes are ticked,
    and the File List records why the step ships in the story's own pull request: all four Epic 4
    story commits carried theirs, so `learning-path-template.md`'s "only after a story is marked
    done" line is the stale part.
12. **Medium-low. The `plural` doc comment overclaimed.** It said a reason "lands verbatim in a
    coverage-gap record". `CoverageGap` is a strict object carrying `rule`, `relevancePredicate`,
    `satisfactionPredicate`, `satisfied`, and `severity` (`evidence-artifact.ts:148-159`), and no
    reason field, so as shipped the string is test-visible only. The comment now says the reason is
    the verdict's diagnostic half and that a later story decides whether the gap record carries it.
    Count-noun agreement is worth having either way.
13. **Low. The third deviation had a record but no annotation at the site.** AC 3, AC 4, AC 5, AC 7
    fixture 36, and AC 7 fixture 40 are now annotated in place, the way fixtures 12 and 26 were, so
    a reader diffing the AC blocks against the shipped file finds each difference marked where it
    is.
14. **Low. Rule 2's count noun was the one left unrouted.** It now goes through `plural` like its
    three neighbours. The guard is `distinct.size > 1`, so the helper's singular branch is
    unreachable from that call site; uniformity is the point.
15. **Low. `plural`'s two sibling-group call sites only ever ran the singular branch.** Fixture 40
    now asserts a two-group reason as well, following Story 4.3's Decision 7 convention on paired
    at-bound and over-bound fixtures. Fixture 55's non-mutation assertion moved to `toStrictEqual`,
    which a stray `undefined`-valued property would otherwise pass.
16. **Low. Step 16's first Rules bullet ran three lines and its diagram routed one edge wrong.** The
    bullet is inside the template's two-line guidance now. The diagram draws `interface.ts` and
    `pointer.ts` as direct edges into `relevance.ts`, matching the file's actual imports
    (`Operation` and `TRANSPORT_CHANNELS`).

Re-run after every fix: `npm run validate` green end to end, `npm run build` green separately,
`check:layers` 56 files 0 violations, `vitest run` 51 files / 1982 tests, and `check:docs` 55,
`check:schemas` 12, `check:ad5-registry` 21, `check:ad28-registry` 10 all unchanged.

### File List

New:

- `src/core/coverage/rules.ts`
- `src/core/coverage/relevance.ts`
- `tests/coverage/relevance.test.ts`
- `tests/coverage/rules.test.ts`

Edited:

- `_bmad-output/implementation-artifacts/5-1-the-seven-relevance-predicates.md` (this record)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (`5-1` set to `review`)
- `_bmad-output/project-knowledge/learning-path-step-by-step.md` (Step 16 plus one table row)

Task 7's learning-path step lands in this diff, matching all four Epic 4 story commits, each of
which carried its own step. `learning-path-template.md`'s "add a step only after a story's dev-story
workflow marks it done" line is the stale part; the step is written once the implementation is
green and reviewed, and it ships in the story's own pull request.
