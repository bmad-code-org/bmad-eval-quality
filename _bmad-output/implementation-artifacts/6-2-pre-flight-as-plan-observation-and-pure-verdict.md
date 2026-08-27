# Story 6.2: Pre-flight as plan, observation, and pure verdict

Status: done

Epic: 6 (ports, pre-flight, and the library and CLI surface)
Story key: `6-2-pre-flight-as-plan-observation-and-pure-verdict`
Implements: AD-10 in full, AD-1's purity boundary, AD-11's fixture digest, AD-34's plan-and-reduce
pair, AD-35's probe path (through Story 6.1's port), NFR7's fixture rules, NFR9's
order-independence.

## Story

As the guard against the harness-defect class that produced the only false gate,
I want pre-flight compiled from the contract and reduced purely from observations,
so that an unverified fixture can never produce a scored run.

## Acceptance Criteria

### AC 1: Scope, module locations, and what this story does not build

This story is the whole pre-flight stage: the three contract-side declarations AD-10 needs and the
repository does not yet have, the compile checks that make those declarations honest, the pure
plan-and-reduce pair, the volatile-excluded projection and the fixture digest computed over it, and
the one orchestration function that awaits the environment-probe port.

**Every ```ts block in this file is labelled either `VERBATIM` (copy it into source as written) or
`SKETCH` (declarations only, showing the exported surface; the dev writes the bodies).**

**New files under `src/`:**

| Path | Layer | Holds |
| --- | --- | --- |
| `src/core/schemas/sensitivity-witness.ts` | `core-schemas` | `WitnessInputs`, `SensitivityWitnessLeg`, `SensitivityWitness`, `ManifestationWitness`, `FixtureReset` |
| `src/core/compile/sensitivity-witness.ts` | `core` | the three witness-legality checks |
| `src/core/preflight/projection.ts` | `core` | the volatile-excluded projection and the fixture digest |
| `src/core/preflight/witness-evidence.ts` | `core` | a projected observation as AD-4 evidence, and witness resolution |
| `src/core/preflight/plan.ts` | `core` | `planPreflight`, the `PlanStage` |
| `src/core/preflight/reduce.ts` | `core` | `reducePreflight`, the `ReduceStage` |
| `src/application/preflight.ts` | `application` | `runPreflight`, the one place a probe is awaited |

**Edited files:**

- `src/core/schemas/interface.ts`: `Operation` gains `sensitivityWitness` (AC 3).
- `src/core/schemas/probe.ts`: `Defect` gains `manifestationWitness` (AC 4).
- `src/core/schemas/eval-contract.ts`: gains `fixtureReset`, and its `.meta` description loses the
  sentence saying sensitivity witnesses are absent (AC 5).
- `src/core/schemas/port-messages.ts`: `ProbeRequestBody` is exported if it is not already (AC 2).
- `src/core/schemas/constraint-ledger.ts`: twelve `artifact: 'probe'` arity entries (AC 6).
- `src/core/compile/expression-legality.ts`: its expression enumerator generalizes so a witness
  relation gets the same checks an oracle check gets, and its callback carries an artifact-path
  prefix instead of an oracle id (AC 7).
- `src/core/compile/compile.ts`: three new checks join the fixed order, one of them strict-gated
  (AC 7).
- `src/index.ts`: the barrel exports `runPreflight` and the pre-flight types (AC 13).
- `schemas/eval-contract.schema.json`, `schemas/probe.schema.json`: regenerated (AC 13).
- `tests/schemas/**`, `tests/compile/helpers.ts`, and the eight other fixture modules AC 13 names.
- `README.md` and `_bmad-output/shareable/` (AC 13).

**This story does not build:**

- Any scoring. `PreflightVerdict` is the output; nothing here reads or writes an outcome, a verdict
  rung, or a dominance vector. AD-21's ladder and AD-6's states are Epic 7's.
- AD-40's DEFECT SIGNATURE. AC 4's manifestation witness is pre-flight's fixture-verification
  operand and is never matched against a finding. The two are distinguished in Decision 6.
- A fifth port. The reset leg goes through the environment-probe port Story 6.1 shipped
  (Decision 5).
- The `core/` coverage floor and its measurement, which Story 6.5 owns.
- Rubric compilation (6.3), artifact immutability enforcement (6.4), the CLI (6.5).

### AC 2: `src/core/schemas/sensitivity-witness.ts`  (VERBATIM)

```ts
/** AD-10's typed witnesses and the fixture-reset declaration. */
import { z } from 'zod'
import { Expression } from './expression.ts'
import { ProbeRequestBody } from './port-messages.ts'
import { Identifier, JsonObjectValue, KeyName } from './primitives.ts'

/**
 * The four transport channels one probe leg supplies, as concrete values
 * rather than as `KeyedShapeDescriptor`'s key-and-type declaration:
 * `RequestShape` declares what an operation accepts, this declares what one
 * leg sends. AD-18 binds `header` exactly as it does there, so a value here
 * names a header and never carries a credential.
 *
 * `header` and `body` are spelled as the port spells them, not as a general
 * JSON bag: a header value is a string at the boundary, and a body has to
 * distinguish an absent body from a JSON null. A leg whose inputs could not
 * be mapped onto a `ProbeRequest` without loss would be a declaration the
 * plan cannot execute.
 */
export const WitnessInputs = z
	.strictObject({
		path: JsonObjectValue,
		query: JsonObjectValue,
		header: z.record(KeyName, z.string()),
		body: ProbeRequestBody,
	})
	.meta({
		id: 'WitnessInputs',
		description:
			"One probe leg's supplied inputs, keyed by AD-19 transport channel, in the spelling the environment-probe port accepts. Shared by both witness kinds and by the fixture reset, so the export carries it once.",
	})

export type WitnessInputs = z.infer<typeof WitnessInputs>

/**
 * One half of a witness pair. `legId` roots the relation's pointers: the
 * relation addresses this leg's response as
 * `/interactions/{legId}/response-body/...`, which is why a leg identifier is
 * an `Identifier` and never free text.
 */
export const SensitivityWitnessLeg = z.strictObject({
	legId: Identifier,
	inputs: WitnessInputs,
})

export type SensitivityWitnessLeg = z.infer<typeof SensitivityWitnessLeg>

// AD-10 selects the differential channel by the operation's state-change
// marker: `path` or `query` where the marker is false, `body` where it is
// true. `header` is absent on purpose. No AD names a header differential, and
// AD-18 already bounds what a header declaration may carry.
export const WITNESS_CHANNELS = ['path', 'query', 'body'] as const

export const WitnessChannel = z.enum(WITNESS_CHANNELS)

export type WitnessChannel = z.infer<typeof WitnessChannel>

/**
 * AD-10's typed sensitivity witness: a pair of inputs and the AD-4 relation
 * their responses are expected to satisfy. Declared per operation rather than
 * per interface, because an interface-scoped check let an identifier-blind
 * read pass on the strength of a body-sensitive sibling, and is impossible to
 * perform at all on a read-only interface.
 *
 * The relation is a declared expectation rather than whole-response
 * inequality: inequality is neither necessary (two distinct nonexistent
 * identifiers both return the same 404) nor sufficient (an input-blind
 * response carrying a request identifier differs every time).
 *
 * `legs` is a length-pinned array rather than `z.tuple`. A tuple exports as
 * `prefixItems` alone, with no `minItems`, `maxItems`, or `items`, which is
 * the same export hole `constraint-ledger.ts` repairs by injection for the
 * operand tuples; `.length(2)` exports the two keywords natively and needs no
 * ledger entry.
 */
export const SensitivityWitness = z.strictObject({
	witnessId: Identifier,
	channel: WitnessChannel,
	legs: z.array(SensitivityWitnessLeg).length(2),
	relation: Expression,
})

export type SensitivityWitness = z.infer<typeof SensitivityWitness>

/**
 * AD-10's manifestation witness: which operation to probe, with what inputs,
 * and the AD-4 relation that is true exactly when the seeded fault has fired.
 *
 * Deliberately not AD-40's DEFECT SIGNATURE, which matches a scoring-side
 * finding against an observation. This operand never enters a score; it exists
 * so "every declared seeded fault being observed to fire" is decidable at
 * pre-flight, which AD-40 explicitly puts on the same footing as a vacuous
 * probe.
 */
export const ManifestationWitness = z.strictObject({
	legId: Identifier,
	interfaceId: Identifier,
	operationId: Identifier,
	inputs: WitnessInputs,
	relation: Expression,
})

export type ManifestationWitness = z.infer<typeof ManifestationWitness>

/**
 * The operation that returns the fixture to its clean state. AD-10 verifies
 * per-run state reset differentially, and the reset is an ordinary declared
 * operation probed through the same port as every other leg, so this story
 * introduces neither a fifth port nor a caller callback.
 */
export const FixtureReset = z.strictObject({
	legId: Identifier,
	interfaceId: Identifier,
	operationId: Identifier,
	inputs: WitnessInputs,
})

export type FixtureReset = z.infer<typeof FixtureReset>
```

`ProbeRequestBody` must be exported from `port-messages.ts`; if it is currently a module-private
const, export it without otherwise touching the file. No `.meta({ id })` is added to it, so the
published documents are unaffected except by the new references.

**Do not call `.describe()` on `Expression`.** This is house style, so a relation's prose lives in
the surrounding comment. It is not a toolchain constraint: `.describe()` on a schema carrying
`.meta({ id })` keeps the shared `$ref` and adds only a `description` sibling, verified against this
repository's zod 4.4.3.

### AC 3: `Operation` gains `sensitivityWitness`  (VERBATIM edit to `src/core/schemas/interface.ts`)

Add the import and one field, last in the object, immediately after `volatilePointers`:

```ts
	volatilePointers: z.array(DescriptorPointer),
	sensitivityWitness: SensitivityWitness.nullable().describe(
		"AD-10, mandatory per declared operation rather than per interface. `null` is legal only for an operation declaring no keys in any request channel; AD-10 exempts that operation and requires the exemption to be recorded, which pre-flight does as an `exempt` check. An input-bearing operation declaring `null` fails a strict compilation under `undeclared-mandatory-input`, alongside the other declaration-completeness check that code already gates.",
	),
```

`import { SensitivityWitness } from './sensitivity-witness.ts'`. This is a plain value import, not
`import type`: the schema is used in value position.

### AC 4: `Defect` gains `manifestationWitness`  (VERBATIM edit to `src/core/schemas/probe.ts`)

Add the import and one field, last in the object, immediately after `source`:

```ts
	source: z.enum(['natural', 'controlled-mutation']),
	manifestationWitness: ManifestationWitness.nullable().describe(
		"AD-10: what pre-flight probes to observe this defect fire. `null` parses, so the prior art's six-field defect still round-trips, and pre-flight records a null witness as a **failed** `seeded-fault-fired` check rather than as an exemption. A seeded fault that cannot be observed to fire is the vacuous probe AD-40 resolves to `infrastructure-error`, and pre-flight is the one place where invalidating is the cheap outcome.",
	),
```

`Probe`'s `.meta` description currently records AD-40's DEFECT SIGNATURE as deliberately absent.
That sentence stays true and is not edited: a manifestation witness is not a defect signature
(Decision 6).

**This field brings the whole expression grammar into `probe.schema.json`.** AC 6 carries the
consequence.

### AC 5: `EvalContract` gains `fixtureReset`  (VERBATIM edit to `src/core/schemas/eval-contract.ts`)

Add one field, last in the object, immediately after `probeStepBound`:

```ts
	fixtureReset: FixtureReset.nullable().describe(
		"AD-10's per-run state reset, declared as the operation that performs it, so the reset is one more probe leg through the environment-probe port. `null` selects AD-10's repeated-read immutability branch, which is also the check that catches a volatile response field the contract failed to declare.",
	),
```

And replace the last sentence of the `.meta` description:

```ts
		description:
			"The Eval Contract. Succeeds the prior-art `eval-contract` schema per AD-24. It carries every declaration AD-19 requires so that AD-31's fourteen relevance and satisfaction predicates are decidable from declarations alone. AD-10's sensitivity witnesses arrived in this version, on each operation, as the additive `schemaVersion` bump AD-11 requires; the bump is recorded in each new field's own description, since no reader in this version declares an expected version constant to compare against.",
	})
```

### AC 6: the twelve `probe` arity entries in `src/core/schemas/constraint-ledger.ts`

`Expression` reaching `Probe` moves `schemas/probe.schema.json` from roughly 10 KB to roughly 33 KB
and brings twelve operand tuples with it, each exporting `prefixItems` and nothing that bounds its
length. `publish.ts` filters injection by `entry.location.artifact !== key`, and every existing
arity entry is addressed `artifact: 'eval-contract'`, so without this the published probe schema
accepts a one-operand `equality` that Zod rejects — the exact hole the ledger exists to close.

Add twelve entries mirroring the existing arity entries, identical but for
`location.artifact: 'probe'`. The `inject` disposition stays `{ minItems: arity, items: false }`.

Pins that move as a result and must be re-derived rather than guessed:
`tests/schemas/published/differential.test.ts`'s inject-entry count (13 today),
`tests/schemas/publish.test.ts`'s `CONSTRAINT_LEDGER.length - INJECT_ENTRIES.length` pin (15 today),
and `tests/schemas/constraint-ledger.test.ts`.

The alternative — keeping `Expression` out of `Probe` by declaring manifestation witnesses on the
contract and joining them to defects by `defectId` — was rejected in Decision 13: it puts a
cross-artifact join under no stage's ownership, which is a worse defect than twelve mechanical
ledger entries.

### AC 7: the witness compile checks  (SKETCH, `src/core/compile/sensitivity-witness.ts`)

```ts
export function checkSensitivityWitnessDeclared(contract: EvalContract): void
export function checkWitnessLegality(contract: EvalContract): void
export function checkWitnessLegIdentifiers(contract: EvalContract): void
```

Each throws `StructuralFailure`. **No new AD-5 code is minted.** AD-5's registry is closed at
twenty-one and `check:ad5-registry` pins it against the spine's table; a twenty-second code would be
a spine amendment, which Decision 1 declines. Each defect below is assigned to the code that already
names it.

| Defect | Code | Function | `artifactPath` |
| --- | --- | --- | --- |
| an operation declaring keys in any request channel has `sensitivityWitness: null` | `undeclared-mandatory-input` | Declared | `EvalContract.permittedInterfaces[i].operations[j]` |
| a witness leg omits a key the selected channel declares required | `undeclared-mandatory-input` | Declared | `….sensitivityWitness.legs[k]` |
| a witness leg supplies a key the selected channel does not permit | `undeclared-mandatory-input` | Declared | `….sensitivityWitness.legs[k]` |
| `channel` is `body` while `stateChangeMarker` is false | `malformed-operator-expression` | Legality | `….sensitivityWitness` |
| `channel` is `path` or `query` while `stateChangeMarker` is true | `malformed-operator-expression` | Legality | `….sensitivityWitness` |
| the two `legId`s are equal | `malformed-operator-expression` | LegIdentifiers | `….sensitivityWitness.legs` |
| the relation addresses only one of the two legs | `malformed-operator-expression` | Legality | `….sensitivityWitness.relation` |
| the relation addresses neither leg | `malformed-operator-expression` | Legality | `….sensitivityWitness.relation` |
| a relation pointer roots at a step id that is neither leg | `unreachable-check-evidence` | Legality | `….sensitivityWitness.relation` |
| a leg id collides with an interaction-plan step id | `malformed-operator-expression` | LegIdentifiers | `….legs[k].legId` |
| a leg id collides with any other leg id in the contract | `malformed-operator-expression` | LegIdentifiers | `….legs[k].legId` |
| `fixtureReset` names an operation whose `stateChangeMarker` is false | `malformed-operator-expression` | Legality | `EvalContract.fixtureReset` |
| `fixtureReset` names an interface or operation the contract does not declare | `unreachable-check-evidence` | Legality | `EvalContract.fixtureReset` |
| a manifestation witness names an `interfaceId`/`operationId` the contract does not declare | `unreachable-check-evidence` | `planPreflight` | `Probe.defects[d].manifestationWitness` |

The last row is checked where the artifact is available: `Probe` is not part of the contract, so it
runs in `planPreflight` (AC 10) and throws the same `StructuralFailure`, which is what "given a
compiled contract" means for an artifact the compiler never sees.

**`checkSensitivityWitnessDeclared` is strict-gated; the other two are not.**
`compile.ts:61` already reads `if (options.strict) checkUndeclaredMandatoryInput(contract)`, and
`tests/application/compile.test.ts:58-63` plus `tests/coverage/corpus.test.ts:507,513,524` all rely
on a non-strict compile not throwing that code. A story that made the same code fire unconditionally
would give one code two gating regimes. The three `undeclared-mandatory-input` rows therefore live
in one strict-gated function, and the shape and identifier rows, which fire different codes, run
unconditionally.

**`src/core/compile/expression-legality.ts` generalizes its enumerator.** Its five checks route
through one private `forEachOracleCheck(contract, visit)` whose callback is `(check, oracleId)`, and
all five consumers build `EvalContract.oracles[id=${oracleId}].${path}` from it. This is **not a
rename**. The callback becomes `(check, artifactPathPrefix)`; the five call sites at roughly lines
205, 216, 442, 462, and 468 pass the prefix through instead of composing it. The enumerator then
visits, in order: every `oracle.check` with prefix `EvalContract.oracles[id=…]`, then every
operation's `sensitivityWitness.relation` with prefix
`EvalContract.permittedInterfaces[i].operations[j].sensitivityWitness.relation`.

**`checkQuantifierOverNonCollection` needs a witness-aware lookup or it silently no-ops on every
legal witness.** It resolves a pointer's step through `index.stepOf(target.stepId)` against
`buildPlanIndex(contract.interactionPlan, …)` and returns early on `undefined`. A witness relation
roots at a leg id, and this AC's table makes a leg id colliding with a plan step id a compile
failure, so `stepOf` never resolves for a legal witness. Give the check the same operation-scoped
lookup AC 9's `makeWitnessPointerDenotesCollection` uses: when the visited expression came from a
witness, the operation is known, so `collectionLocations` is read directly. Without this, Decision
10 buys four checks rather than five, and fixture 34 is unsatisfiable.

**`src/core/compile/compile.ts`** gains the three checks at the end of its fixed order:
`checkSensitivityWitnessDeclared` (inside the existing `options.strict` block, immediately after
`checkUndeclaredMandatoryInput`), then `checkWitnessLegality`, then `checkWitnessLegIdentifiers`
unconditionally. Order matters: the declared check must run before the legality check, or a `null`
witness reaches a function that assumes one.

### AC 8: `src/core/preflight/projection.ts`  (SKETCH)

```ts
export const PREFLIGHT_ARTIFACT_PATH = 'PreflightVerdict'

export type ProjectedObservation = {
	readonly legId: string
	readonly interfaceId: string
	readonly operationId: string
	readonly status: number
	readonly body: ProbeObservedBody
}

export function pruneVolatile(
	body: ProbeObservedBody,
	volatilePointers: readonly string[],
	artifactPath: string,
): ProbeObservedBody

export function projectObservation(
	observation: ProbeObservation,
	operation: Operation,
	artifactPath: string,
): ProjectedObservation

export function fixtureDigest(
	projections: readonly ProjectedObservation[],
	artifactPath: string,
): string
```

Six rules the bodies must satisfy:

1. **The projection is `{ legId, interfaceId, operationId, status, body }` and nothing else.** This
   is AD-11's "named closed projection". Response headers are outside it, because
   `volatilePointers` is a `DescriptorPointer` and the response descriptor is body-scoped (the same
   boundary `collectionLocations` already draws), so no declaration can mark a header volatile;
   including unprunable headers would make the immutability branch fail on any fixture that returns
   a request identifier header. Decision 4 records the cost and the asymmetry it creates.
2. **The body keeps its `ProbeObservedBody` tag through the projection.** A `text` body carrying
   `"x"` and a `json` body carrying `"x"` must not project identically; a fixture that changed its
   content type has changed, and a digest that cannot see it is a scoring version that lies.
   Pruning applies inside the `json` branch only; `text` and `absent` pass through untouched.
3. **`pruneVolatile` removes each declared pointer from the body**, walking to the parent and
   deleting the key or splicing the array element. A pointer that resolves to nothing is a no-op,
   never an error: a volatile field the fixture did not return this time is exactly the case the
   declaration exists for. The empty-string pointer prunes the whole body to `{ kind: 'absent' }`,
   which is RFC 6901's own meaning of the empty pointer applied consistently.
4. **`pruneVolatile` never mutates its input.** `core/` is pure; clone before deleting.
   `structuredClone` is permitted (it is not in the layer checker's `IMPURE_MEMBERS`).
5. **`fixtureDigest` sorts by `legId` before digesting**, then calls
   `digestComposite({ observations: sorted }, artifactPath)`. Sorting is NFR9: array position is
   never read, and two runs whose observations arrived in different orders must produce the same
   digest. This is `digestComposite`'s first production call site; it supplies its own domain
   separation through `COMPOSITE_PROTOCOL_TAG`.
6. **`fixtureDigest` throws its own `TypeError` on an empty projection list.** It does not delegate:
   `digestComposite` throws only on an empty *field bag*, and `{ observations: [] }` has one field,
   so it would happily digest a pre-flight that verified nothing.

### AC 9: `src/core/preflight/witness-evidence.ts`  (SKETCH)

```ts
export const PREFLIGHT_REGEX_MATCH_STEP_BUDGET = 1_000_000

export function evidenceOf(
	projected: ProjectedObservation,
	observation: ProbeObservation,
	inputs: WitnessInputs,
): Observation

export function referenceSetMembers(
	contract: EvalContract,
): Readonly<Record<string, JsonValue[]>>

export function makeWitnessPointerDenotesCollection(
	operation: Operation,
): PointerDenotesCollection

export function resolveWitnessRelation(
	relation: Expression,
	legEvidence: Readonly<Record<string, Observation>>,
	operation: Operation,
	referenceSets: Readonly<Record<string, JsonValue[]>>,
	artifactPath: string,
): CheckResolutionValue
```

- `evidenceOf` maps one leg into the `Observation` shape `makeResolveOperand` already takes:
  `observationId` is the leg id, `provenance` is `'baseline'` (a pre-flight leg is pre-canned by
  definition), `responseHeaders` and `responseStatus` come from the raw observation, and
  `stdout`/`stderr`/`exitCode` are `null`. Two mappings are not identity and must be written out:
  - **`responseBody`** is `JsonValue | null`, so the projected `ProbeObservedBody` unwraps: `json`
    yields its pruned value, `text` yields its string, `absent` yields `null`. The relation
    therefore resolves over the volatile-excluded body, which is AD-10's "evaluated over that
    operation's response descriptor after excluding the volatile pointers".
  - **`callInputs`** is `ObservedCallInputs`, whose four fields are `JsonObjectValue | null`, which
    is narrower than `WitnessInputs`. `path`, `query`, and `header` map straight across (a
    `Record<KeyName, string>` is a `JsonObjectValue`); `body` yields its value when the value is a
    JSON object, and `null` for `absent` or for a non-object JSON body. That last case is a real
    loss and is stated rather than hidden: an oracle addressing
    `/interactions/{legId}/call-inputs/body` on a leg whose body is an array or a scalar resolves
    `ABSENT`.
- `referenceSetMembers` is the converter from the contract's declaration to the map
  `makeResolveOperand` wants:
  `Object.fromEntries(Object.entries(contract.referenceSets ?? {}).map(([id, set]) => [id, set.members]))`.
- `makeWitnessPointerDenotesCollection` answers `true` only for a `response-body` pointer whose tail
  equals a declared `collectionLocations` entry of **this** operation. It does not go through
  `makePointerDenotesCollection`: witness legs are not interaction-plan steps, and fabricating step
  objects to satisfy a lookup that only ever answers for one known operation is more machinery than
  the predicate. Reuse `parseEvidenceTarget` and `decodeTail`. AC 7's quantifier check uses this
  same lookup.
- `resolveWitnessRelation` calls `resolveCheck` with `makeResolveOperand(legEvidence, referenceSets)`,
  the collection predicate above, and `PREFLIGHT_REGEX_MATCH_STEP_BUDGET`. The budget is a module
  constant, not read from a scoring policy: a scoring policy is a score-side artifact and stage two
  is not epic-ready, so reading one here would give pre-flight a dependency AD-38's stage list
  forbids. The value mirrors the published default artifact's `1000000`.

### AC 10: `src/core/preflight/plan.ts`  (SKETCH)

```ts
export type PreflightPlanInput = {
	readonly contract: EvalContract
	readonly probes: readonly Probe[]
	readonly runId: string
}

export type PlannedLegPurpose =
	| 'sensitivity'
	| 'control-observe'
	| 'control-mutate'
	| 'control-reset'
	| 'seeded-fault'

export type PlannedLeg = {
	readonly legId: string
	readonly purpose: PlannedLegPurpose
	readonly request: ProbeRequest
	readonly operation: Operation
	readonly inputs: WitnessInputs
}

export type PlannedCheck =
	| { readonly kind: 'interface-present'; readonly operationId: string; readonly legIds: readonly string[] }
	| { readonly kind: 'input-sensitivity'; readonly operationId: string; readonly witness: SensitivityWitness | null; readonly operation: Operation }
	| { readonly kind: 'state-reset'; readonly legIds: readonly [string, string] }
	| { readonly kind: 'clean-control'; readonly legIds: readonly string[] }
	| { readonly kind: 'seeded-faults-scoped'; readonly defectId: string; readonly witness: ManifestationWitness; readonly operation: Operation; readonly cleanLegIds: readonly string[] }
	| { readonly kind: 'seeded-fault-fired'; readonly defectId: string; readonly witness: ManifestationWitness | null; readonly operation: Operation | null }

export type PreflightPlan = {
	readonly runId: string
	readonly legs: readonly PlannedLeg[]
	readonly checks: readonly PlannedCheck[]
	readonly referenceSets: Readonly<Record<string, JsonValue[]>>
}

export const planPreflight: PlanStage<PreflightPlanInput, PreflightPlan>
```

**The plan carries everything `reducePreflight` needs.** `ReduceStage` takes a plan and observations
and nothing else, so the contract is not available at reduce time; the operation, the witness, and
the reference-set map ride on the plan. That is the point of AD-34's split, and it is why
`PlannedCheck` embeds `operation` rather than an operation id. The `state-reset` and `clean-control`
variants carry only leg ids, because the reducer compares projections and reads statuses and needs
no operation for either.

What the plan derives, per AD-10's "the plan derives from the interfaces the contract's probes
exercise":

1. For each `api` operation of each permitted interface with a non-null `sensitivityWitness`: two
   legs of purpose `sensitivity`, one per witness leg, plus one `input-sensitivity` check. An
   operation with a `null` witness contributes an `input-sensitivity` check with `witness: null`,
   which reduce records `exempt`.
2. For each operation, one `interface-present` check naming every leg planned against it.
3. Control legs, planned once per contract. If `contract.fixtureReset` is non-null **and** the same
   interface declares an operation with `stateChangeMarker: true`: four legs in order,
   `control-observe` → `control-mutate` → `control-reset` → `control-observe`, with the
   `state-reset` check naming the first and last. Otherwise: two `control-observe` legs repeating
   the same safe read, with the check naming both. AD-10 counts the first form's observations as
   first-and-third because the reset is not an observation; here it is a leg like any other, so the
   check names the first and the fourth. Either way the assertion is that the two named legs'
   projections are identical.
   **Selection is by declaration order:** the observed operation is the first operation in the
   contract's declaration order whose `stateChangeMarker` is false and whose witness inputs give it
   a leg to reuse; the mutating operation is the first whose marker is true on the interface
   `fixtureReset` names. Fixture 98 pins this, so a later change to the rule is visible.
4. One `clean-control` check naming every `control-*` leg. It does **not** name `sensitivity` legs:
   AD-10's own worked example is two distinct nonexistent identifiers both returning 404, so a
   contract following the architecture verbatim would otherwise get a satisfied `input-sensitivity`
   and a failed `clean-control` on the same two observations. Its `operationId` is `null`, which
   `PreflightCheck` already admits.
5. For each defect of each probe with `expectedClean: false`: one `seeded-fault` leg from its
   manifestation witness, one `seeded-faults-scoped` check, and one `seeded-fault-fired` check. A
   defect whose witness is `null` contributes a `seeded-fault-fired` check with `witness: null` and
   no leg.
6. A `web`, `cli`, or `mcp` interface never reaches here: `checkInterfaceKind` already threw
   `unsupported-interface-kind` at compile. `planPreflight` asserts the kind anyway and throws the
   same code, because the plan is reachable from a caller who assembled a contract by hand.

`planPreflight` is synchronous and pure. It mints `probeId` on each `ProbeRequest` equal to the
leg id, which is what NFR9's correlation-by-identifier requires and what the port echoes back.

### AC 11: `src/core/preflight/reduce.ts`  (SKETCH)

```ts
export type PreflightObservations = {
	readonly observations: readonly ProbeObservation[]
}

export const reducePreflight: ReduceStage<
	PreflightPlan,
	PreflightObservations,
	PreflightVerdict
>
```

The reducer is pure over observations and emits one `PreflightCheck` per `PlannedCheck` — so a
contract with no seeded faults emits no seeded-fault checks, and the six kinds are what it *may*
emit rather than what it always emits. It indexes observations by `probeId`, never by array
position. `passed` is `checks.every((check) => check.outcome !== 'failed')`, so `exempt` does not
sink a verdict and `failed` always does. `fixtureDigest` covers the projections of every leg that
produced an observation. Lineage is constant: `schemaVersion: 1`, `parentDigest: null`,
`revisionCount: 0` — a pre-flight verdict is an origin artifact, and AD-29's revision machinery is
Story 6.4's.

| Kind | `satisfied` when | `failed` when | `exempt` when |
| --- | --- | --- | --- |
| `interface-present` | every leg planned for the operation produced an observation whose echoed `interfaceId`, `operationId`, and `probeId` match the request | any planned leg has no observation, or an echoed identifier differs | never |
| `input-sensitivity` | the witness relation resolves `true` | it resolves `false`, **or** `insufficient-evidence` | the operation declares no keys in any request channel |
| `state-reset` | the two named legs' projections are deep-equal | they differ | never |
| `clean-control` | every `control-*` leg observed a non-anomalous status | any `control-*` leg observed an anomalous status | never |
| `seeded-faults-scoped` | the defect's witness resolves non-`true` on every clean leg of its operation | it resolves `true` on any clean leg | never |
| `seeded-fault-fired` | the witness resolves `true` on its own fault leg | the witness is `null`, its leg has no observation, or the relation resolves `false` or `insufficient-evidence` | never |

**Anomalous** means `status >= 400`. The word is already the repository's: Story 6.1's conformance
suite asserts `probe/observe-anomalous-status`, and `ProbeObservation.status` is already bounded to
100–599 at the port, so nothing new is assumed about the protocol here.

**`seeded-faults-scoped` and `seeded-fault-fired` are disjoint by construction.** The scoped row
reads only clean legs; the fired row reads only the fault leg. An earlier draft made the scoped row
also require the fault leg to fire, which made every `seeded-fault-fired` mutant flip both checks
and left a state (`false` on the fault leg and `false` everywhere else) that was neither satisfied
nor failed, which `PreflightCheck.outcome` cannot represent. Fixture 62 asserts the disjointness
directly.

`insufficient-evidence` failing rather than passing is AD-10's own sentence and is the story's
single most load-bearing line: a sensitivity check that examined nothing has not established
sensitivity.

### AC 12: `src/application/preflight.ts`  (SKETCH)

```ts
export type RunPreflightOptions = {
	readonly contract: EvalContract
	readonly probes: readonly Probe[]
	readonly runId: string
	readonly port: EnvironmentProbePort
	readonly signal: AbortSignal
}

export async function runPreflight(
	options: RunPreflightOptions,
): Promise<PreflightVerdict>
```

Order, mirroring `compile.ts` and `invoke-port.ts`:

1. `EvalContract.safeParse` and `z.array(Probe).safeParse` on the inputs; failure throws
   `RuntimeFault('schema-parse-failure', 'EvalContract' | 'Probe', …, { cause })`. Artifacts are
   validated in both directions per AD-28.
2. `planPreflight({ contract, probes, runId })`. `StructuralFailure` propagates unchanged.
3. For each leg **in plan order**, `await invokePort({ request: leg.request, requestParser:
   probeParsers.request, responseParser: probeParsers.response, port: options.port.probe, signal,
   requestPath: 'ProbeRequest', responsePath: 'ProbeObservation' })`. Sequential, never
   `Promise.all`: the control legs are ordered by construction and a parallel run would reset the
   fixture underneath another operation's witness.
4. `RuntimeFault` from a leg propagates unchanged. A failed pre-flight is a verdict; a failed
   *probe* is a fault, and AD-10's "a failed pre-flight invalidates rather than becoming a contract
   signal" is about the verdict, not about swallowing transport faults.
5. `reducePreflight(plan, { observations })`, then `PreflightVerdict.safeParse` on the result;
   failure throws `RuntimeFault('schema-parse-failure', 'PreflightVerdict', …)`.
6. No decision logic lives here. Every branch above is a parse, an await, or a rethrow.

### AC 13: the regenerated schemas, the re-pinned censuses, the barrel, and the docs

- `npm run generate:schemas`, then `npm run check:schemas`. `schemas/eval-contract.schema.json` and
  `schemas/probe.schema.json` both move; the probe document roughly triples.
- `tests/schemas/published/keyword-mutation.test.ts`: re-pin `CENSUS_BY_DOCUMENT['eval-contract']`
  (line 108), `CENSUS_BY_DOCUMENT['probe']` (line 114), every affected `CENSUS_BY_KEYWORD` entry,
  and `CENSUS_TOTAL` (line 143, 1953 today). **Re-derive every number from the regenerated
  documents. Do not carry any figure from this story forward as a pin.**
- `tests/schemas/published/differential.test.ts`: the reject-case total (112 today) and the
  inject-entry count (13 today) both move. `tests/schemas/publish.test.ts`'s ledger pin (15 today)
  moves with AC 6.
- **Reject cases are derived, not listed.** `keyword-mutation.test.ts` deletes *every* keyword
  occurrence and demands a verdict change, so every added occurrence needs a corpus member that
  kills it. The additions are large — the probe document alone gains on the order of thirty
  `additionalProperties`, thirty-four `$ref`, sixteen `const`, and twelve `pattern` occurrences.
  Generate the survivor list from the regenerated documents, then write one reject case per
  survivor. Fixture 37 is the assertion that no survivor remains.
- **No `.optional()` and no `.default()` anywhere in AC 2 through AC 5.**
  `tests/schemas/artifact-registry.test.ts:273-285` asserts, for every control object at every
  depth, that `required` equals `Object.keys(properties)`, and lines 258-266 compare input and
  output mode. The repository's convention is a required key that is `.nullable()`.
- Accept fixtures that must gain the new keys — every literal constructing an `Operation`, a
  `Defect`, or an `EvalContract`: `tests/schemas/fixtures/artifact-fixtures.ts`,
  `tests/schemas/fixtures/gate-c-contract.ts`, `tests/schemas/fixtures/relevance-contracts.ts`,
  `tests/schemas/fixtures/reject-cases.ts`, `tests/schemas/fixtures/artifact-reject-cases.ts`,
  `tests/schemas/published/mutant-generator.ts`, `tests/compile/helpers.ts`,
  `tests/compile/interface-inventory.test.ts`, `tests/coverage/fixtures/satisfaction-contracts.ts`,
  `tests/coverage/corpus.test.ts`, `tests/seal/fixtures.ts`, `tests/seal/seal.test.ts`,
  `tests/seal/scripting-audit.test.ts`. Grep for `volatilePointers`, `probeStepBound`, and
  `'controlled-mutation'` to confirm the list is complete before starting.
  `cleanPopulatedContract()` declares input-bearing operations, so it needs a **real** witness, not
  `null`, or every strict compile test fails on `undeclared-mandatory-input`. That is the intended
  cost, and it is what makes the new check non-vacuous. The three contracts compiled under
  `strict: false` in `tests/coverage/corpus.test.ts:507,513,524` keep passing by construction.
- `src/index.ts` exports `runPreflight` and re-exports the pre-flight types. Its header comment
  already says pre-flight reduces observations; that sentence stops being a forward reference and is
  rewritten to describe what ships. `src/core/stage-contracts.ts`'s header names this story as
  `PlanStage`/`ReduceStage`'s first concrete consumer; rewrite that sentence too.
- `README.md` already lists pre-flight among the pure stages (line 94) and among the capabilities
  (line 81), so the change is one sentence rather than a new entry: state that a contract declaring
  a fixture reset requires the caller's probe policy to authorize that operation's method, which is
  Decision 5's cost and otherwise has nowhere to land. Then `npm run build:shareable` regenerates
  `_bmad-output/shareable/eval-quality-readme.html`; `check:shareable` fails on a stale export.
- `_bmad-output/project-knowledge/learning-path-step-by-step.md`: append row 20 to the table after
  **line 62** (`| 19 | epic6-story1 | …`; line 61 is row 18) and add
  `## Step 20 (epic6-story2): …` after Step 19, following `learning-path-template.md`.

### AC 14: fixtures and tests

One `it` per numbered fixture. The fixture number opens the test name.

**`tests/schemas/` — the schema additions (1–17)**

| # | Asserts |
| --- | --- |
| 1 | a `SensitivityWitness` with two legs and a relation parses |
| 2 | a witness with one leg is rejected by the Zod schema |
| 3 | a witness with three legs is rejected by the Zod schema |
| 4 | the **published** `eval-contract` document rejects one leg and three legs, proving `minItems`/`maxItems` reached the export |
| 5 | `channel: 'header'` is rejected |
| 6 | `WitnessInputs` with an unknown channel key is rejected |
| 7 | `WitnessInputs.body` parses on both the `json` and the `absent` branch |
| 8 | `WitnessInputs.header` rejects a non-string value |
| 9 | `Operation` with `sensitivityWitness: null` parses |
| 10 | `Operation` omitting `sensitivityWitness` is rejected (required, not optional) |
| 11 | `Defect` with `manifestationWitness: null` parses |
| 12 | `Defect` omitting `manifestationWitness` is rejected |
| 13 | `EvalContract` with `fixtureReset: null` parses |
| 14 | `EvalContract` omitting `fixtureReset` is rejected |
| 15 | in both regenerated documents, `required` equals the `properties` keys at every new depth |
| 16 | `WitnessInputs` is a single `$def` in the eval-contract export, referenced three times |
| 17 | the probe export carries `$defs.Expression`, and each of its twelve operand tuples carries the injected `minItems` and `items: false` |

**`tests/compile/sensitivity-witness.test.ts` (18–36)** — one per row of AC 7's table, each a single
mutation of `cleanPopulatedContract()`, asserting `code` **and** `artifactPath`:

| # | Asserts |
| --- | --- |
| 18 | `null` witness on an input-bearing operation → `undeclared-mandatory-input` under `strict: true` |
| 19 | the same contract compiles clean under `strict: false` |
| 20 | a leg omitting a required key of the selected channel → `undeclared-mandatory-input` |
| 21 | a leg supplying an unpermitted key → `undeclared-mandatory-input` |
| 22 | `channel: 'body'` with `stateChangeMarker: false` → `malformed-operator-expression` |
| 23 | `channel: 'path'` with `stateChangeMarker: true` → `malformed-operator-expression` |
| 24 | the two `legId`s equal → `malformed-operator-expression` |
| 25 | the relation addresses only one leg → `malformed-operator-expression` |
| 26 | the relation addresses neither leg → `malformed-operator-expression` |
| 27 | a relation pointer rooting at a third step id → `unreachable-check-evidence` |
| 28 | a leg id colliding with an interaction-plan step id → `malformed-operator-expression` |
| 29 | a leg id colliding with another operation's leg id → `malformed-operator-expression` |
| 30 | `fixtureReset` naming a non-mutating operation → `malformed-operator-expression` |
| 31 | `fixtureReset` naming an undeclared operation → `unreachable-check-evidence` |
| 32 | an operation declaring no keys in any channel with a `null` witness compiles clean |
| 33 | a well-formed witness compiles clean |
| 34 | a **leg-rooted** witness relation quantifying over a non-collection fires `quantifier-over-non-collection` |
| 35 | a witness relation naming an undeclared reference set fires `unresolved-reference-set` |
| 36 | fixtures 34 and 35 carry an `artifactPath` naming the witness relation, not an oracle |

Fixtures 34 and 35 are the only proof the generalized enumerator reaches witness relations, and
fixture 36 is the only proof the artifact-path prefix threaded through. Revert the
`expression-legality.ts` change locally and confirm all three go red.

**`tests/schemas/` (37)**

| # | Asserts |
| --- | --- |
| 37 | the published-schema mutation sweep reports zero unprotected survivors for both regenerated documents |

**`tests/preflight/reduce.test.ts` (38–68)**

| # | Asserts |
| --- | --- |
| 38 | `interface-present` satisfied |
| 39 | failed when a planned leg produced no observation |
| 40 | failed when the echoed `operationId` differs from the request |
| 41 | `input-sensitivity` satisfied on a body differential (`stateChangeMarker: true`) |
| 42 | satisfied on a **path-parameter-only safe read**, which is AD-10's named shape |
| 43 | satisfied on a query differential |
| 44 | failed, input-blind negative, on that same path-parameter-only safe read |
| 45 | failed when the relation resolves `false` on the body differential |
| 46 | **failed** when the relation resolves `insufficient-evidence` |
| 47 | exempt for an operation with no keys in any channel |
| 48 | `state-reset` satisfied on the repeated-read branch |
| 49 | failed when the two projections differ |
| 50 | satisfied on the four-leg branch with a declared `fixtureReset` |
| 51 | failed when the fixture returns an **undeclared** volatile field, which is AD-11's loud failure |
| 52 | satisfied when that same field **is** declared volatile, which is 51's paired positive |
| 53 | `clean-control` satisfied |
| 54 | failed on a 500 on a control leg |
| 55 | satisfied at the boundary: status 399 |
| 56 | failed at the boundary: status 400 |
| 57 | **unaffected by a 404 on a sensitivity leg**, which is AD-10's own worked example |
| 58 | `seeded-faults-scoped` satisfied |
| 59 | failed when the witness resolves `true` on a clean leg |
| 60 | satisfied even when the witness resolves `false` on its own fault leg |
| 61 | `seeded-fault-fired` satisfied |
| 62 | failed when the relation resolves `false`, **while `seeded-faults-scoped` stays satisfied** |
| 63 | failed when `manifestationWitness` is `null` |
| 64 | failed when the relation resolves `insufficient-evidence` |
| 65 | two defects failing produce two checks distinguishable by `note` |
| 66 | `passed` is `false` when any check failed, and `true` when every check is `satisfied` or `exempt` |
| 67 | the verdict carries `schemaVersion: 1`, `parentDigest: null`, `revisionCount: 0` |
| 68 | a contract with no seeded faults emits no seeded-fault checks at all |

Fixtures 60 and 62 are the disjointness pair. Each `failed` fixture is a single mutation of its
`satisfied` sibling; verify by executing the mutation that it flips **one** check's outcome.

**`tests/preflight/projection.test.ts` (69–81)**

| # | Asserts |
| --- | --- |
| 69 | `pruneVolatile` removes a declared object key |
| 70 | it splices a declared array element |
| 71 | a pointer resolving to nothing is a no-op, not an error |
| 72 | the empty-string pointer prunes the whole body to `{ kind: 'absent' }` |
| 73 | `pruneVolatile` does not mutate its input |
| 74 | the projection carries exactly five keys and no headers |
| 75 | a `text` body and a `json` body carrying the same string project differently |
| 76 | `fixtureDigest` is stable under observation reordering |
| 77 | it changes when a non-volatile body field changes |
| 78 | it does **not** change when a declared volatile field changes |
| 79 | it does **not** change when a response header changes, which is Decision 4's cost as a test |
| 80 | `fixtureDigest` throws its own `TypeError` on an empty projection list |
| 81 | the digest is `sha256:`-formed and matches a literal golden value carried in the test |

**`tests/preflight/witness-evidence.test.ts` (82–90)**

| # | Asserts |
| --- | --- |
| 82 | `evidenceOf` puts the **pruned** body on `responseBody` and the raw headers on `responseHeaders` |
| 83 | it maps an `absent` body to `null` on both `responseBody` and `callInputs.body`, and a JSON object body through to both |
| 84 | a relation pointing at `/interactions/{legId}/response-headers/x` resolves against the raw header |
| 85 | `referenceSetMembers` returns `{}` for a `null` declaration and the members for a populated one |
| 86 | `makeWitnessPointerDenotesCollection` is `true` for a declared collection location and `false` for its sibling |
| 87 | it is `false` for a `response-headers` pointer even when the tail matches |
| 88 | it is `false` for a `@/` bound-element pointer |
| 89 | `resolveWitnessRelation` returns `insufficient-evidence` for a quantifier over an empty collection |
| 90 | a regex relation over a pathological pattern is bounded by `PREFLIGHT_REGEX_MATCH_STEP_BUDGET` |

**`tests/preflight/plan.test.ts` (91–104)**

| # | Asserts |
| --- | --- |
| 91 | two legs per witness, with `probeId` equal to `legId` |
| 92 | the `ProbeRequest` carries the operation's method and path template unchanged |
| 93 | `WitnessInputs` map onto `ProbeRequest.channels` with no conversion loss |
| 94 | an operation with a `null` witness plans no legs and one `exempt`-bound check |
| 95 | the repeated-read branch is planned when `fixtureReset` is `null` |
| 96 | the four-leg branch is planned, in order, when `fixtureReset` and a mutating operation both exist |
| 97 | the four-leg branch is **not** planned when no operation on that interface has `stateChangeMarker: true` |
| 98 | the control operations are selected in declaration order |
| 99 | one leg per defect of an `expectedClean: false` probe |
| 100 | zero legs for an `expectedClean: true` probe |
| 101 | a defect with a `null` manifestation witness plans no leg and one check |
| 102 | a manifestation witness naming an undeclared operation throws `unreachable-check-evidence` |
| 103 | a `web` interface throws `unsupported-interface-kind` |
| 104 | the plan is deterministic: two calls on the same input produce deep-equal plans |

**`tests/application/preflight.test.ts` (105–112)**

| # | Asserts |
| --- | --- |
| 105 | a fake probe port is called exactly once per planned leg |
| 106 | the legs are awaited in plan order, asserted on the recorded call sequence |
| 107 | an already-aborted signal rejects with `RuntimeFault('aborted', 'ProbeRequest', …)` before any call |
| 108 | a port throwing a plain `Error` surfaces as `RuntimeFault('port-failure', 'ProbeObservation', …)` |
| 109 | a port returning a shape that fails `ProbeObservation` surfaces as `port-contract-violation` |
| 110 | an unparseable contract throws `RuntimeFault('schema-parse-failure', 'EvalContract', …)` |
| 111 | a `StructuralFailure` from the plan propagates unchanged, with its code intact |
| 112 | the returned verdict parses against `PreflightVerdict` and carries the run id and a fixture digest |

**Testing rules carried from Story 6.1, restated because they are the ones this story can break:**

- A `RuntimeFault` or `StructuralFailure` assertion pins `code` and `artifactPath`, never only the
  message.
- An assertion never re-derives its expected value from the function under test. Fixture 81 carries
  a literal digest; fixtures 38–68 carry literal outcome tuples.
- Every numeric or arity comparison gets a paired at-bound and over-bound fixture. This story's are
  the anomaly threshold (55 and 56), the `legs` arity (2, 3, 4), and the regex budget (90).
- `core/` tests use in-memory fixtures and faked ports only. No network, no filesystem, no clock.
- Do not import across test files. `tests/preflight/fixtures/` is a shared helper module inside its
  own directory, matching `tests/coverage/fixtures/`.

### AC 15: the gate

`npm run validate` and `npm run build` both pass. Measured on this branch at story-creation time,
against commit `bb4bf5c`, and independently re-measured during the story review:

| Command | Before | After (measured) |
| --- | --- | --- |
| `npm run check:layers` | 73 files, 0 violations | 82 files, 0 violations |
| `npx vitest run` | 61 files, 2271 tests | 67 files, 2462 tests |

Seven new source files (AC 1's table) and six new test files:
`tests/preflight/{projection,witness-evidence,plan,reduce}.test.ts`,
`tests/compile/sensitivity-witness.test.ts`, and `tests/application/preflight.test.ts`.
`tests/preflight/fixtures/observations.ts` is a helper and is not a test file. Of the 112 numbered
fixtures, 18 land in existing `tests/schemas/` files (1–17 and 37) and 94 land in the six new ones:
+112 tests. Report the actual figures rather than reconciling them by editing this table.

## Decisions taken during story creation

**Decision 1 — no twenty-second AD-5 code, and no spine revision.** AD-10 names failure conditions
without naming codes for them. The standing rule in this repository is to settle such an ambiguity by
construction in the story rather than to amend the architecture, so AC 7 assigns every witness defect
to one of the twenty-one codes that already names it. Two rows stretch the reading and are recorded
as stretched rather than glossed: a leg-id equality and a leg-id/step-id collision are identifier
collisions, and `malformed-operator-expression` is the closest available code because the expression
is illegal in its position once its operands cannot be told apart. The cost is that
`undeclared-mandatory-input` now fires on two conditions rather than one, and that a reader looking
for "witness malformed" in the registry will not find it. The benefit is that `check:ad5-registry`
keeps passing against the spine's table unchanged.

**Decision 2 — witnesses live on `Operation`, not on the contract root.** AD-10 is explicit that the
check is "mandatory per declared operation" and that binding it to the interface was the defect
revision 3 introduced: an identifier-blind read passed on the strength of a body-sensitive sibling.
Per-operation placement also makes the exemption decidable in one place, since "declares no inputs in
any channel" is a property of `RequestShape`.

**Decision 3 — the witness relation is an `Expression` over two synthetic step identifiers.** The
alternative was a new comparison grammar for witness pairs. Reusing AD-4 buys the whole resolver, the
three-valued result `insufficient-evidence` semantics depend on, and the existing operator set, at
the cost of one convention: a leg identifier occupies the same namespace as an interaction-plan step
identifier, so AC 7 checks the collision. `resolveCheck`, `makeResolveOperand`, and `walkTail` are
used unchanged; nothing in `core/evaluate/` is edited.

**Decision 4 — the projection is `{ legId, interfaceId, operationId, status, body }` and response
headers are outside it.** `volatilePointers` is a `DescriptorPointer`, and the response descriptor is
body-scoped: `collectionLocations` draws the same boundary, and `makePointerDenotesCollection`'s own
comment says only `response-body` can ever answer `true` because the body is the only
declared-collection surface. No declaration can therefore mark a header volatile. Including headers
in a projection nothing can prune would make the repeated-read immutability branch fail on any
fixture returning a request-identifier header, which is most of them.

Two costs, both recorded rather than discovered later. First, two fixture versions differing only in
a response header produce the same fixture digest and therefore the same scoring version; fixture 79
states that as a test. Second, the projection and the witness relation disagree about what an
observation is: `evidenceOf` hands the relation the raw headers, so a relation can address a header
(fixture 84) that `state-reset` and `fixtureDigest` cannot see. That asymmetry is deliberate — a
relation addressing a header is the author asserting that header is stable, and the projection is
about what the *fixture* is, not about what the author chose to read — but it is the kind of
asymmetry that reads as a bug to the next person, so it is named here.

**Decision 5 — the fixture reset is a declared operation probed through the environment-probe
port.** AD-10 requires the reset be verified differentially but does not say who performs it. Three
options were live: a fifth port, a caller-supplied async callback awaited in `application/`, and a
contract declaration naming the operation that resets. The first reopens a port set Story 6.1 closed
and that AD-37's conformance suite enumerates by name. The second puts impurity into `application/`
through something that is not a port, which AD-1 forbids in substance even where it passes the layer
checker. The third adds one nullable contract field, needs no new machinery, and keeps every leg on
the one path AD-35's policy already guards. Its cost is that the caller's probe policy must authorize
the reset operation's method, which is a real constraint and lands in the README per AC 13.

**Decision 6 — a manifestation witness is not AD-40's defect signature.** AD-40's signature matches a
scoring-side *finding* to the observations it cites, and `Probe`'s own schema description records it
as deliberately absent with no fixture to land in. AC 4's witness answers a different question:
did the seeded fault fire at all, in the fixture, before anything was scored. It is consumed only by
`reducePreflight`, never by a scorer, and the `Probe` description's sentence about AD-40 is left
standing unedited so a later reader does not conclude the signature arrived early.

**Decision 7 — a null manifestation witness fails rather than exempts.** The alternative reading is
that a defect with no declared witness is simply not checked. AD-10 requires *every* declared seeded
fault to be observed to fire, and AD-40 puts a fault that never manifests on the same footing as a
vacuous probe, which resolves `infrastructure-error` and invalidates the run. Exempting it would let
an unverifiable fixture produce a scored run, which is the exact failure mode this story exists to
prevent. The cost is that every probe fixture in the repository must declare witnesses before it can
pass pre-flight; today none do, and none is used in a scored path.

**Decision 8 — `anomalous` is `status >= 400`, and `clean-control` reads only control legs.** AD-10
says "the declared seeded faults being the only anomalous responses in scope" and never defines
anomalous. A status threshold is decidable from what the port already returns, and 400 is where the
existing vocabulary already sits: Story 6.1's conformance suite ships
`probe/observe-anomalous-status`, and `ProbeObservation.status` is bounded to 100–599 at the port, so
HTTP is already assumed at that boundary rather than newly assumed here.

The threshold alone is not enough, and the first draft of this story got it wrong. AD-10's own
canonical sensitivity example is "two distinct nonexistent identifiers both return the same 404", so
a `clean-control` check that read sensitivity legs would fail on a contract that followed the
architecture verbatim while `input-sensitivity` passed on the same two observations. `clean-control`
therefore reads only the `control-*` legs, and fixture 57 is the regression guard.

**Decision 9 — pre-flight owns its regex budget as a constant.** `regexMatchStepBudget` lives on
`ScoringPolicy`, a score-side artifact. AD-38 makes stage one's requirement list closed and forbids a
stage-one requirement citing an artifact `score` produces. Reading a scoring policy at pre-flight
would violate that, so `PREFLIGHT_REGEX_MATCH_STEP_BUDGET` is a module constant mirroring the
published default's `1000000`. If a later story gives pre-flight a policy input, this constant is the
one place to change.

**Decision 10 — `expression-legality.ts`'s enumerator generalizes rather than being duplicated.**
A witness relation that escaped the expression checks would be exactly the vacuous-fixture class
Stories 5.1 and 5.2 each paid for twice in review: the declaration would look checked and would not
be. Generalizing the enumerator costs one callback-signature change across five call sites and buys
five checks, but only if `checkQuantifierOverNonCollection` also gets the witness-aware operation
lookup AC 7 specifies — without it that check resolves nothing for a leg-rooted pointer and the
purchase is four checks, not five. Fixtures 34, 35, and 36 are the tripwires.

**Decision 11 — legs are awaited sequentially.** The control legs are ordered by construction and a
parallel run would reset the fixture underneath another operation's witness. Sequential awaiting also
keeps the observation array's arrival order irrelevant, which is what NFR9 wants proven rather than
merely arranged; fixture 76 asserts the digest is stable under reordering anyway.

**Decision 12 — the `schemaVersion` bump is recorded in prose only.** AD-11 requires an additive
field to bump `schemaVersion`, and `lineage.ts` records that "version equality belongs to the reader
that throws that fault". No reader in this version declares an expected version constant, so there is
nothing in code to increment; the bump is recorded in each new field's own description and in
`EvalContract`'s `.meta`, which is exactly what AD-11's sentence asks for. Accept fixtures keep
`schemaVersion: 1` because no reader compares it.

**Decision 13 — the manifestation witness stays on `Defect`, and the ledger grows twelve entries.**
Embedding an `Expression` in `Probe` roughly triples `probe.schema.json` and carries twelve operand
tuples whose arity the eval-contract-scoped ledger entries do not repair, because `publish.ts`
filters injection by artifact. The alternative was to declare manifestation witnesses on the contract
and join them to defects by `defectId`. That was rejected: a cross-artifact join keyed by an
identifier belongs to no stage under AD-24's ownership rule, and inventing one to avoid twelve
mechanical ledger entries trades a schema-size cost for a structural one. AC 6 carries the twelve
entries and names the three pins that move.

**Decision 14 — `legs` is `z.array(...).length(2)`, not `z.tuple`.** A Zod tuple exports as
`prefixItems` with no length keyword at all, which `constraint-ledger.ts` already records in the
repository's own words for the operand tuples and repairs by injection. Using a length-pinned array
exports `minItems` and `maxItems` natively, needs no ledger entry, needs no `.meta({ id })` on
`SensitivityWitness` to give the ledger a location to address, and gives fixture 4 something real to
assert. The cost is that the inferred type is an array rather than a two-tuple, so any code wanting
a pair destructures with an explicit length check.

**Decision 15 — `WitnessInputs` is spelled the way the port spells it.** `header` is
`Record<KeyName, string>` and `body` is `ProbeRequestBody` rather than a general JSON bag, because a
witness leg that could not be mapped onto a `ProbeRequest` without loss would be a declaration the
plan cannot execute — and a general JSON body cannot express the difference between an absent body
and a JSON null, which `port-messages.ts` deliberately separates. The cost is one lossy mapping in
the other direction, onto `ObservedCallInputs`, which AC 9 writes out rather than leaving to be
discovered.

## Tasks / Subtasks

- [ ] **Task 1 — the schema module.** Export `ProbeRequestBody` from `port-messages.ts` if it is not
      already exported, then write `src/core/schemas/sensitivity-witness.ts` from AC 2 verbatim.
      Confirm `npm run check:layers` still reads 0 violations before going further.
- [ ] **Task 2 — the three schema edits.** AC 3, AC 4, AC 5. Run `npm run typecheck`; every accept
      fixture that constructs an `Operation`, a `Defect`, or an `EvalContract` now fails to compile.
      Fix all of them in this pass (AC 13's list, verified by grep) rather than deferring.
- [ ] **Task 3 — the ledger.** AC 6's twelve `artifact: 'probe'` arity entries, then re-derive the
      three moved pins from the regenerated documents.
- [ ] **Task 4 — regenerate and re-pin.** `npm run generate:schemas`, `npm run check:schemas`, then
      re-derive `keyword-mutation.test.ts`'s three censuses and `differential.test.ts`'s totals from
      the newly generated documents. Generate the survivor list, write one reject case per survivor,
      and confirm fixture 37 is green.
- [ ] **Task 5 — the compile checks.** `src/core/compile/sensitivity-witness.ts` per AC 7, the
      `expression-legality.ts` callback change across its five call sites, the witness-aware
      quantifier lookup, and the three entries in `compile.ts`'s fixed order with the strict gate on
      the first. Give `cleanPopulatedContract()` a real witness. Fixtures 18–36.
- [ ] **Task 6 — the projection.** `src/core/preflight/projection.ts` per AC 8. Fixtures 69–81.
      Fixture 81's golden digest is written from the first green run and then treated as a literal.
- [ ] **Task 7 — witness evidence.** `src/core/preflight/witness-evidence.ts` per AC 9.
      Fixtures 82–90.
- [ ] **Task 8 — the plan.** `src/core/preflight/plan.ts` per AC 10. Fixtures 91–104.
- [ ] **Task 9 — the reducer.** `src/core/preflight/reduce.ts` per AC 11. Fixtures 38–68. Verify by
      executing each mutation that a `failed` fixture flips exactly one check's outcome; fixtures 60
      and 62 are the pair that proves the two seeded-fault checks stayed disjoint.
- [ ] **Task 10 — the orchestration.** `src/application/preflight.ts` per AC 12 and the barrel
      export. Fixtures 105–112.
- [ ] **Task 11 — docs and the gate.** README's one sentence plus `npm run build:shareable`,
      learning-path row 20 after line 62 and Step 20, then `npm run validate` and `npm run build`.
      Record the actual `check:layers` and test counts in AC 15's table.

## Dev Notes

### Read these files before writing anything

- `src/core/schemas/preflight-verdict.ts` in full. It is 51 lines, it already ships, and its
  `PreflightCheck.outcome` description already assigns this story its semantics. Nothing in it
  changes, which is why Decision 3's `defectId` lives in `note` rather than in a new field.
- `src/core/schemas/port-messages.ts`, the `ProbeRequest` and `ProbeObservation` halves, including
  `ProbeRequestBody`'s and `ProbeObservedBody`'s tagged branches. Note that `ProbeRequest.probeId` is
  an `Identifier`, **not** `probe.ts`'s `P-nnn` `ProbeId`; the two are different namespaces and the
  plan mints the former from a leg id.
- `src/core/schemas/constraint-ledger.ts`, the arity entries and their `inject` disposition, and
  `src/core/schemas/publish.ts` around the `entry.location.artifact !== key` filter. AC 6 depends on
  both.
- `src/core/evaluate/resolution.ts:606` (`resolveCheck`) and
  `src/core/evaluate/evidence-resolution.ts:113` (`makeResolveOperand`) and `:151`
  (`makePointerDenotesCollection`). AC 9 reuses the first two unchanged and deliberately does not use
  the third.
- `src/core/compile/expression-legality.ts`, the private enumerator and all five consumers. The
  callback change in AC 7 touches every one of them.
- `src/core/schemas/sealed-run-record.ts`'s `Observation` and `ObservedCallInputs`, which are the
  shapes `evidenceOf` produces and the reason AC 9 spells out two lossy mappings.
- `src/core/canonical/digest.ts`. `digestComposite` throws on an empty field bag and on a field
  literally named `protocol`, and neither throw covers an empty observation list.
- `src/application/invoke-port.ts:47-69` for the exact fault translation `runPreflight` inherits, and
  `src/application/compile.ts` for the shape of an orchestration function.
- `src/core/stage-contracts.ts`. Its header names this story as `PlanStage`/`ReduceStage`'s first
  concrete consumer; that sentence stops being a forward reference and is rewritten in Task 10.

### Previous-story intelligence

1. **Story 6.1's Deviation 2 is now settled convention:** `isAllowedEdge` returns `true` for a
   same-layer import. `src/core/preflight/` importing `src/core/evaluate/` and `src/core/canonical/`
   is a same-layer `core -> core` edge and is permitted; the story review confirmed
   `dependency-direction.ts:54-55` classifies `src/core/preflight/` as `core` with no script change.
2. **`check:layers` purity-scopes `core/` and `core-schemas/`.** No `async`, no `await`, no `Date`,
   no `Math.random`, no Node builtin, no external import. Everything under `src/core/preflight/` is
   synchronous. `structuredClone` is not in `IMPURE_MEMBERS` and is legal. The single external
   carve-out in the whole repository is `digest.ts` importing `createHash`.
3. **Stories 5.1, 5.2, and 6.1 each took most of their review findings on fixtures that could not
   fail, and this story's own creation review found four more before a line was written**: the two
   seeded-fault checks were not disjoint, `clean-control` failed on AD-10's own example, fixture 29
   could not fire against a leg-rooted pointer, and the `legs` arity was unenforced in the export.
   All four are closed by construction above. The places still most exposed are fixtures 51 and 52
   (an undeclared volatile field must actually change the projection, or both are decorative),
   fixtures 60 and 62 (the disjointness pair), and fixtures 34–36 (the only proof the enumerator
   change took effect). Check each by executing the mutation, not by reading the assertion.
4. **Story 4.3's Decision 7 is standing convention:** every numeric or arity comparison needs a
   paired at-bound and over-bound fixture. This story's are listed at the end of AC 14.
5. **`deferred-work.md` carries no open items and this story opens none.** If it opens one, the
   file's "No items are currently open" header prose changes with it.
6. **Story 4.1's story file still carries thirteen unchecked Review Findings items**, three
   verifiably open in `core/compile/reachability.ts` and `core/evaluate/`. This story reads both
   modules and edits neither; noted so the next reader finds them rather than inheriting them
   silently.

### Project structure notes

New directories: `src/core/preflight/`, `tests/preflight/`, `tests/preflight/fixtures/`.
`core/preflight` is named in the Structural Seed's capability map (VFR-7 maps to `core/preflight` and
the environment-probe port), so no Decision is needed for its existence. `tests/` mirrors `src/`.

Naming: files are kebab-case, one concern per file. Zod schemas and their inferred types share a
`PascalCase` name; `as const` tuples are `SCREAMING_SNAKE`; functions are `camelCase`. Every file
opens with a doc comment carrying the AD citation and the reason a shape was chosen, kept no longer
than the declaration it documents. Imports carry the explicit `.ts` extension.

A Zod schema and its `z.infer` alias share one identifier, so a module importing both the type and
the value uses a plain `import`; Biome's `useImportType: error` fires only when every use is a type.
Biome's `quoteStyle` is single, but an apostrophe inside a string flips it to double quotes; write
`"One probe leg's …"` rather than `'One probe leg\'s …'` or `npm run lint` reflows it.

### Testing requirements

- One `it` per numbered fixture; the fixture number opens the test name.
- `any` is permitted in `tests/` and forbidden in `src/`. `it.only` is a lint error and fails
  `validate`.
- No coverage provider is installed and no threshold is configured. Do not run `--coverage`; Story
  6.5 owns NFR7's measurement.
- Fixtures are cloned with `structuredClone` and mutated locally, never shared mutably.
- Thrown-error assertions use the try/catch-into-`let thrown: unknown` pattern, then assert
  `toBeInstanceOf`, `.code`, `.artifactPath`, and `.cause`.
- Fakes are hand-written closures satisfying the structural type, with `vi.fn<PortMethod<…>>` where
  a call count or a call order is asserted (fixtures 105, 106).

### References

- Epic and story text: `_bmad-output/planning-artifacts/epics.md` lines 414-416 (Epic 6 preamble) and
  430-440 (Story 6.2 through its `Then` clause). Neighbouring stories: 418-428 (6.1), 442-452 (6.3).
- `ARCHITECTURE-SPINE.md`: AD-10 (277-283), AD-11 (285-291), AD-19 (337-352), AD-34 (471-476), AD-35
  (477-482), AD-37 (489-494), AD-38 (495-501), AD-30 (439-446), AD-40's vacuous-probe paragraph
  (525), AD-1 (163-168), AD-2 (169-174); dependency direction (133-160); Structural Seed (580-612);
  capability map VFR-7 (623).
- Existing shapes: `src/core/schemas/preflight-verdict.ts:1-51`,
  `src/core/schemas/port-messages.ts` (`ProbeRequest`, `ProbeRequestBody`, `ProbeObservation`,
  `ProbeObservedBody`), `src/core/schemas/interface.ts:44-131`,
  `src/core/schemas/probe.ts` (`Defect`, `Probe`), `src/core/schemas/eval-contract.ts:128-199`,
  `src/core/schemas/lineage.ts`, `src/core/schemas/sealed-run-record.ts:151-166`,
  `src/core/schemas/constraint-ledger.ts:64-84`, `src/core/schemas/publish.ts:174`,
  `src/core/stage-contracts.ts`, `src/core/failure-codes.ts:11-32`,
  `src/core/canonical/digest.ts:18-91`, `src/core/evaluate/resolution.ts:606`,
  `src/core/evaluate/evidence-resolution.ts:113,151`,
  `src/core/compile/expression-legality.ts:138-147,421-448`, `src/core/compile/compile.ts:61`,
  `src/core/seal/plan-index.ts:47-72`, `src/application/invoke-port.ts:27-80`,
  `src/ports/environment-probe-port.ts:33-40`.
- Gates: `scripts/dependency-direction.ts:54-55,83-88,497-511,534`, `scripts/generate-schemas.ts`,
  `scripts/check-schemas.ts`, `scripts/check-ad5-registry.ts`, `scripts/check-shareable.mjs`,
  `scripts/check-docs.mjs`, `tests/schemas/artifact-registry.test.ts:258-266,273-285`,
  `tests/schemas/published/keyword-mutation.test.ts:108,114,143,173`,
  `tests/schemas/published/differential.test.ts:33,132`,
  `tests/application/compile.test.ts:58-63`, `tests/coverage/corpus.test.ts:507,513,524`.
- House style: `tests/application/invoke-port.test.ts`, `tests/compile/helpers.ts`,
  `tests/coverage/relevance.test.ts:1-40`,
  `6-1-ports-and-the-published-conformance-suite.md`,
  `4-4-stages-as-pure-plan-and-reduce-pairs-with-one-orchestration-layer.md`.
- Learning path: `_bmad-output/project-knowledge/learning-path-template.md` (shape),
  `learning-path-step-by-step.md` line 62 (the row to append after) and lines 1353+ (Step 19's
  format).

## Suggested Review Order

1. **AC 11's verdict table against AD-10's rule sentence, clause by clause.** Every clause must map
   to a row and every row to a clause. The clause most easily lost is "the declared seeded faults
   being the only anomalous responses in scope", which is `seeded-faults-scoped`.
2. **Fixtures 60 and 62 as a pair.** They are the only proof the two seeded-fault checks are
   disjoint, which the first draft of this story got wrong. If 62's mutation flips both checks, the
   split in AC 11 did not take.
3. **Fixture 57 against Decision 8.** AD-10's canonical example is a 404 on a sensitivity leg. If
   `clean-control` reads sensitivity legs, a contract that follows the architecture verbatim fails
   pre-flight.
4. **Fixtures 51 and 52 as a pair, against AC 8 rules 2 and 3.** 51 is the only fixture proving the
   undeclared-volatile detector works, and it is meaningful only if 52 shows the declared case
   passing. If pruning is a no-op, both pass and neither means anything.
5. **Fixtures 34, 35, and 36 against the `expression-legality.ts` change.** Revert the change
   locally and confirm all three go red. 34 must root at a leg id, not at an interaction-plan step
   id, or it is asserting on a doubly-broken contract.
6. **Fixture 17 against AC 6.** Twelve `artifact: 'probe'` arity entries, twelve repaired tuples in
   the probe export. If the count is eleven, one operator's arity is unenforced in the published
   document and nothing else catches it.
7. **Fixture 4 against Decision 14.** `minItems`/`maxItems` must be in the generated document, not
   only in the Zod schema. Fixtures 2 and 3 pass either way.
8. **AC 7's table against `src/core/failure-codes.ts:11-32`, and its strict-gating split against
   `compile.ts:61`.** Every code must be one of the twenty-one, and the three
   `undeclared-mandatory-input` rows must all sit inside the strict gate; a non-strict compile that
   newly throws that code breaks `tests/application/compile.test.ts:58-63`.
9. **AC 9's two lossy mappings.** `WitnessInputs.body` is a tagged union and `ObservedCallInputs.body`
   is `JsonObjectValue | null`. Check the story says what happens to an array body and to a JSON
   null, and that fixture 83 asserts it.
10. **Decision 4's asymmetry.** A witness relation can read a header the digest cannot see. Is that
    acceptable, or should header addressing be dropped from witness relations so the two views agree?
    This is the cheapest decision to overturn now and the most expensive after the fixtures exist.
11. **AC 10's plan against AC 11's reducer: does the plan carry everything the reducer reads?**
    `ReduceStage` gets the plan and the observations and nothing else.
12. **AC 15's two tables against actual command output**, not against arithmetic.

## Story Review Record

One peer review pass against the story before implementation, in a separate Claude Code session. It
executed rather than reasoned from prose: it transcribed every ```ts block into a scratch project
wired to a copy of `src/`, compiled it with the repository's own `typescript@7.0.2` under a copy of
`tsconfig.json`, formatted it with Biome 2.5.8 against a copy of `biome.json`, applied the schema
edits and **regenerated the published documents** to measure the real keyword deltas, and re-ran both
gate baselines. It reported 8 HIGH, 12 MEDIUM, and 6 LOW findings. All 26 are closed in the text
above; nothing was deferred.

**The four that changed the design rather than the prose:**

1. **`seeded-faults-scoped` and `seeded-fault-fired` were not disjoint** (HIGH). The scoped row's
   first conjunct was the whole of the fired row, so every fired-row mutant flipped both checks, and
   a witness resolving `false` on its own fault leg and `false` everywhere else was neither
   satisfied nor failed — a state `PreflightCheck.outcome` cannot represent. The scoped row now reads
   only clean legs. Fixtures 60 and 62 assert the disjointness.
2. **`clean-control` failed on AD-10's own worked example** (HIGH). AD-10's canonical sensitivity
   case is two distinct nonexistent identifiers both returning 404; with `clean-control` reading
   sensitivity legs, a contract following the architecture verbatim got a satisfied
   `input-sensitivity` and a failed `clean-control` on the same two observations. `clean-control` now
   reads only `control-*` legs, is one check per contract with a `null` `operationId`, and fixture 57
   is the guard.
3. **The `legs` tuple shipped an unenforced arity** (HIGH). `z.tuple([A, A])` exports `prefixItems`
   alone — verified directly against zod 4.4.3 and through the real publish pipeline — which
   `constraint-ledger.ts:64-68` already records in the repository's own words for the operand tuples.
   The published document would have accepted a one-leg and a three-leg witness. Now
   `z.array(...).length(2)`, which exports both keywords natively (Decision 14).
4. **`ManifestationWitness.relation` drags the expression grammar into `probe.schema.json` with
   twelve unrepaired arity holes** (HIGH). The regenerated probe document goes from 10,383 to 33,152
   bytes and gains twelve `prefixItems`; `publish.ts:174` filters injection by artifact and every
   arity entry is addressed `eval-contract`, so a one-operand `equality` would validate. AC 6 adds
   twelve `artifact: 'probe'` entries and Decision 13 records why the witness stays on `Defect`.

**Four more that would have failed the build or a gate:** an epic-AC clause with no fixture (AD-10's
path-parameter-only safe read; now fixtures 42 and 44); `undeclared-mandatory-input` firing
unconditionally when `compile.ts:61` gates its code-mate behind `strict`, which would have broken
`tests/application/compile.test.ts:58-63`; `evidenceOf` not typechecking, because
`WitnessInputs.body` was a general `JsonValue` where `ObservedCallInputs.body` is
`JsonObjectValue | null` and `ProbeRequest.channels.header` demands `string` values, and because
`ProbeObservedBody`'s tag was being discarded so a `text` and a `json` body digested identically
(Decision 15, AC 8 rule 2, AC 9's two mappings); and fixture 29's original form being unsatisfiable,
because `checkQuantifierOverNonCollection` resolves through `buildPlanIndex` and a leg id never
resolves there — which also revealed that the `expression-legality.ts` change is a callback-signature
change across five call sites rather than the rename the story called it.

**Corrected without design impact:** `fixtureDigest` does not inherit an empty-input throw from
`digestComposite` (AC 8 rule 6); the verdict had no source for its three lineage fields (AC 11);
`PreflightCheck` has nowhere to put a `defectId`, so defect identity lives in `note` and fixture 65
asserts two defects stay distinguishable; nine more fixture modules break on the required fields
(AC 13); the AC 2 block's escaped apostrophe fails `npm run lint`; fixtures 25 and 26 had no
definition because AC 7's compound rows were counted as one each; the state-reset operation selection
was unspecified while fixture 104 asserted determinism (AC 10 rule 3, fixture 98); `fixtureReset` was
never checked against a declared operation (AC 7 row 13); the reject-case list is derived from the
regenerated documents rather than from a ten-item prose list; and AC 15's file arithmetic was off by
one.

**Confirmed by execution, no change needed:** both AC 15 baselines are exact (73 files / 0
violations; 61 files / 2271 tests). Every AC 2–AC 5 block compiles with zero `tsc` errors against a
copy of `src/`, with no import cycle. `WitnessInputs` resolves to a single `$def` with three `$ref`s
(fixture 16). Every AD-5 code cited is one of the twenty-one. The layer rules permit every import AC
8, AC 9, and AC 12 need, and `structuredClone` is not an impure member. `EnvironmentProbePort`
exposes only `probe`, and AC 12's fault translation matches `invoke-port.ts` exactly, including which
artifact path each fault carries. AD-40's vacuous-probe sentence is at spine line 525 as cited, so
Decision 7 rests on real text. `digestComposite` genuinely has no production call site today.
Twenty-two file:line citations were checked individually and found exact.

**One claim in the story was empirically false and is now deleted rather than softened:** the
original AC 2 warned that `.describe()` on a schema carrying `.meta({ id })` clones the definition
and breaks `$ref` sharing. It does not — the reviewer regenerated with a `.describe()` added and
found `$defs.Expression` intact, the seven `$ref` occurrences unchanged, and the document 73 bytes
larger. The prohibition survives as house style; the false reason is gone, because a dev would have
carried it forward as a fact about the toolchain.

**Left open for the implementation review, deliberately:** review order item 10. A witness relation
can address a response header that `state-reset` and `fixtureDigest` cannot see. Decision 4 argues
the asymmetry is correct and names it; the alternative is to forbid header addressing in witness
relations so the two views agree. That is cheaper to overturn before the fixtures exist than after.


## Dev Agent Record

### Agent Model Used

Claude Opus 5 (`claude-opus-5[1m]`), Claude Code, `/bmad-build`.

### Debug Log References

Things executed rather than reasoned about.

- **Baselines re-measured before the first edit.** `npm run check:layers` → 73 files, 0 violations.
  `npx vitest run` → 61 files, 2271 tests. Both match AC 15's "before" column exactly.
- **The AC 2 import cycle, reproduced.**
  `node --experimental-strip-types -e "import('./src/core/schemas/eval-contract.ts')"` failed with
  `Cannot access 'HttpMethod' before initialization` as soon as AC 3's import landed. Re-run after
  the `probe-body.ts` extraction: resolves. This is Completion Note 1.
- **Tripwire, review order item 5 (fixtures 34, 35, 36).** The `expression-legality.ts` enumerator
  was reverted locally, twice, and the fixtures re-run each time:
  - witness relations skipped entirely: 34, 35, and 36 all red (3 failed / 17 passed).
  - enumerator kept, witness-scoped operation lookup in `checkQuantifierOverNonCollection` removed:
    34 and 36 red, 35 green (2 failed / 18 passed).
  That is exactly Decision 10's prediction: without the lookup the change buys four checks, not five.
- **Single-flip verification, review order items 2, 3, and 4.** Every `failed` fixture's mutation was
  executed against the base verdict and the differing check lines printed. Eleven of the twelve
  mutations flip exactly one check. The two that flip two are reported rather than reconciled:
  fixture 39 (a missing observation) flips both `interface-present` and `input-sensitivity` for that
  operation, which is correct and unavoidable; and patching the status of a single control-observe
  leg flipped `state-reset` as well as `clean-control`, because status is inside the projection, so
  fixtures 54, 55, and 56 now patch both control legs and 55/56 additionally assert `state-reset`
  stayed satisfied. Fixture 62's mutation flips `seeded-fault-fired` alone, with
  `seeded-faults-scoped` still satisfied: the disjointness pair holds.
- **Fixtures 51 and 52 executed as a pair.** Same observations, two contracts. Undeclared
  `/servedAt` → `state-reset` failed; the same field declared volatile → satisfied. Pruning is real
  in both directions.
- **The published-document survivor sweep, run rather than predicted.** After regeneration the sweep
  reported five unprotected survivors, all from one cause in
  `tests/schemas/published/keyword-occurrences.ts` (Completion Note 9). The generator's `sites` map
  was instrumented to confirm the occurrences were reachable and the mutants were being dropped at
  `tryCandidate`, and the ajv error list was printed directly
  (`schemaPath: "#/additionalProperties"` against a deep `instancePath`) to identify the ambiguity.
  After the fix: zero survivors on both documents, and `unreachable` equals `exempt` again.
- **Censuses re-derived from the regenerated documents, never carried from the story.**
  `CENSUS_BY_DOCUMENT`: eval-contract 668 → 725, probe 119 → 381. `CENSUS_TOTAL` 1953 → 2272.
  `maxItems` moved 1 → 2, which is `legs`'s own arity reaching the export (fixture 4).
  Inject entries 13 → 25; `CONSTRAINT_LEDGER.length - INJECT_ENTRIES.length` is still 15, so that
  pin did not move after all. `$defs` counts: eval-contract 5 → 6, probe 1 → 5.
- **Reject cases: none needed.** AC 13 anticipated one hand-written reject case per survivor. The
  schema-directed generator reaches every new occurrence once the matcher is correct, so the
  survivor list is empty with no hand-written case added. Fixture 37 is the assertion.
- **Self-mutation sweep before handing the diff to review.** Twelve deliberate breakages of the new
  sources, each run against the pre-flight and compile suites: `pruneVolatile` made a no-op (6 red),
  the digest left unsorted (1), the anomaly threshold moved (1), `passed` forced true (1), `probeId`
  decoupled from the leg id (6), `clean-control` widened to the sensitivity legs (1), `cleanLegIds`
  emptied (1), headers dropped from the evidence (2), the collection predicate forced true (1), the
  leg/step collision check disabled (1), the channel/marker check disabled (2). All caught. One gap
  surfaced and was closed before review: deleting the `insufficient-evidence` branch changed no
  outcome, because `false` and `insufficient-evidence` both land on `failed`, so fixtures 46 and 64
  now assert the note that separates them.
- **Review-response mutation sweep.** Each of the eight code fixes below was reverted and the suites
  re-run, to confirm a fixture holds it rather than the fix merely being present: H1a (1 red), H1b
  (1), H2 (2), H3 (5), M1 (2), M2 (1, fixture 124), M4 (1), M5 (1).
- **Final gate.** `npm run validate` passes end to end; `npm run build` passes separately.
  `npm run check:layers` → 82 files, 0 violations. `npx vitest run` → 67 files, 2462 tests.

### Completion Notes List

Every deviation from the story, reported rather than reconciled by editing the story's numbers.

1. **AC 2's import of `ProbeRequestBody` from `port-messages.ts` closes a module-evaluation cycle.**
   `port-messages.ts` reads `HttpMethod` and `PathTemplate` from `interface.ts`, and AC 3 makes
   `interface.ts` read `sensitivity-witness.ts`, so `interface.ts → sensitivity-witness.ts →
   port-messages.ts → interface.ts` throws `Cannot access 'HttpMethod' before initialization` at
   import time. The Story Review Record's "no import cycle" line is empirically false. Settled by
   construction: `ProbeRequestBody` and `ProbeObservedBody` moved to a new leaf module
   `src/core/schemas/probe-body.ts` and are re-exported from `port-messages.ts`, so every existing
   import site is unchanged. Neither union carries `.meta({ id })`, so no published byte moved
   (`check:schemas` confirms). `sensitivity-witness.ts` imports from `./probe-body.ts`; that is the
   only line of AC 2's VERBATIM block that differs. Cost: one more file under `src/`, which is why
   `check:layers` reads 81 rather than AC 15's predicted 80.
2. **`compile.ts` runs `checkWitnessLegIdentifiers` before `checkWitnessLegality`**, the reverse of
   AC 7's stated order. A duplicated or plan-colliding leg id makes the legality check's question
   ("does the relation address both legs?") unanswerable, so with legality first a leg-id fixture
   reports `unreachable-check-evidence` on a contract whose actual defect is the collision, and
   fixtures 24, 28, and 29 would each need a second mutation to reach their own code. AC 14 requires
   each to be a single mutation. The story's own stated ordering constraint (declared before
   legality) is unaffected and still holds.
3. **AC 11's `state-reset` row, taken literally, can never be satisfied.** It says the two named
   legs' projections are deep-equal, but `legId` is one of the projection's five fields and
   necessarily differs between the two legs being compared. `reducePreflight` compares every field
   except `legId`; `sameFixtureState` in `reduce.ts` carries the reasoning.
4. **AC 11's `seeded-faults-scoped` row needed an evidence-keying rule the story did not state.**
   The relation addresses `/interactions/{witness.legId}/…`, so resolving it against a clean leg
   requires keying that leg's evidence by the *witness's* leg id rather than the observing leg's.
   Keyed the other way every pointer resolves `ABSENT` and the check could never fail. Recorded at
   `resolveAgainst`.
5. **The barrel cannot export the pure plan-and-reduce pair.** AC 13 asks `src/index.ts` to
   re-export the pre-flight types, but `scripts/dependency-direction.ts`'s `isAllowedEdge` grants
   `root` exactly `application` and `core-schemas`, so importing `core/preflight/` from the barrel is
   a layer violation (`check:layers` caught it). The barrel exports `runPreflight`,
   `RunPreflightOptions`, `PreflightVerdict`, `PreflightCheck`, and the five witness types. The
   consequence is that `planPreflight` and `reducePreflight` are not reachable through the package's
   `exports` map; that is left as it stands rather than routed around, and is flagged for the review.
6. **Two checks are emitted conditionally rather than unconditionally**, because the unconditional
   form is a check that cannot fail. `interface-present` is emitted only for an operation that has at
   least one planned leg (AC 10 rule 2 says "for each operation"; an operation with no legs would get
   a vacuously satisfied check). `state-reset` and `clean-control` are emitted only when control legs
   could be planned at all, which is the same reasoning AC 11 already applies to the seeded-fault
   kinds.
7. **Two AD-10 conditions the story's tables did not name are enforced here rather than deferred**,
   because each would give two legs one `probeId` and the reducer indexes observations by `probeId`:
   a `fixtureReset.legId` colliding with a witness leg id, checked in `checkWitnessLegIdentifiers` at
   `EvalContract.fixtureReset.legId` (fixture 113, the one fixture outside AC 14's 112); and any
   duplicate leg id across the assembled plan, checked in `planPreflight` and reported at the
   offending leg's own artifact path. Both fire `malformed-operator-expression`, on Decision 1's
   reasoning.
8. **AC 7's key-completeness rows are read as scoped to the selected channel only**, which is what
   the table says. A leg whose non-selected channel omits a required key is not a failure here. A
   witness body that is `absent`, or JSON that is not an object, supplies no keys and therefore
   omits every required key rather than being exempt from the comparison; `suppliedKeys` records it.
9. **`planPreflight` mints its two `control-observe` leg ids**, since AD-10 names no declaration for
   them. They are `preflight-control-observe` and `preflight-control-observe-2`, deterministically
   suffixed away from every identifier the contract already spends (plan step ids, witness leg ids,
   the reset leg id). Fixture 104 pins the determinism.
10. **The mutating control operation must also declare a witness.** AC 10 rule 3 selects "the first
    whose marker is true on the interface `fixtureReset` names", but the mutate leg needs inputs and
    the only declared source of inputs is a witness leg. An interface whose only mutating operations
    declare no witness falls back to the repeated-read branch.
11. **`reducePreflight` records a null witness on an input-bearing operation as `failed`.** AC 11's
    table gives `input-sensitivity` no row for that state, because a strict compile rejects it. At
    reduce time the contract may not have been strictly compiled, and `exempt` there would let an
    unverified fixture produce a scored run, which is the failure mode the story exists to prevent.
12. **Fixture 16's count is two, not three.** AC 14 predicted three `WitnessInputs` references in the
    eval-contract export; the third belongs to `ManifestationWitness`, which rides on `Defect` and
    lands in the probe document. Measured: two in eval-contract (a witness leg and the fixture
    reset), two in probe (`Probe` is a union on `expectedClean`, so its `Defect` shape exports once
    per branch). The fixture asserts both documents.
13. **`pointerMatchesSchemaPath` in `tests/schemas/published/keyword-occurrences.ts` was wrong, not
    merely out of date.** Its conservative guard refused the `$defs` reading of an ajv `schemaPath`
    whenever the same relative path also named a node at the document root, and its own comment
    already recorded that a wrongly refused match surfaces as an unreachable-versus-exempt
    inequality. AD-10's shapes made that ordinary: `$defs/WitnessInputs` opens with the same `type`,
    `required`, and `additionalProperties` the eval-contract root carries, and
    `$defs/Expression/oneOf/*` shadows the probe root's own `oneOf`. Five occurrences had no
    reachable mutant as a result. The fix disambiguates the two readings by the error's instance
    path: a root reading is admissible only when the applicator steps in the schema path imply the
    instance path ajv actually reported. Both call sites now pass `error.instancePath`.
14. **Two census tests were rewritten from skip lists into exact two-way censuses** rather than
    widened. `tests/schemas/ad5-admissions.test.ts` fixture 16 asserted that no document but
    eval-contract carries a keyed shape descriptor; the expression grammar now reaches `probe`
    through `shape`'s descriptor, so it asserts the carrying set is exactly
    `['eval-contract', 'probe']` and that the `requiredKeys`/`permittedKeys` pair travels together.
    `tests/schemas/artifact-registry.test.ts`'s "adds no seventh caller-keyed control map" is now
    "carries a caller-keyed control map only at the addresses named here", with all twelve addresses
    pinned per document. `WitnessInputs.header` is a genuinely new caller-keyed control map, and it
    is string-valued because a header value is a string at the boundary.
15. **`tests/coverage/fixtures/corpus.ts`'s `no-state-change-marker` variant also moves its witness
    channel** from `body` to `query`. The variant flips the marker AD-10 selects the channel by, so
    leaving the witness on `body` is the contradiction `checkWitnessLegality` rejects. The contract
    is about AD-31 rule 7's relevance, not about that.
16. **No reject case was hand-written for AC 13's survivor list.** Once note 13's matcher is correct,
    the schema-directed generator reaches every added keyword occurrence and the survivor list is
    empty. Fixture 37 is the assertion that no survivor remains, and it reuses the sweep through a
    per-document cache so it costs no additional runtime.
17. **Review order item 10, left open by the story, is settled as Decision 4 argued it.** Header
    addressing stays legal in a witness relation and headers stay outside the projection. Fixture 84
    proves a relation can read a header; fixture 79 proves the digest cannot see one. The asymmetry
    is deliberate: the projection is about what the fixture is, and a relation addressing a header is
    the author asserting that header is stable. Forbidding header addressing would delete a real
    expressive case to buy symmetry between two views that answer different questions.
18. **AC 15's counts, measured rather than reconciled.** The final figures are in AC 15's table: 82
    source files (AC 15 predicted 80) and 2462 tests across 67 test files (AC 15 predicted 2383).
    Two of the eighty-two are files the story did not name: `probe-body.ts` from note 1 and
    `declared-inputs.ts` from note 28. The test surplus is fixtures that assert more than one thing
    where the story named one `it`, plus fixtures 113 through 124 and two unnumbered guards
    (`runPreflight` on an unparseable probe, and the pre-flight fixture contract parsing against
    `EvalContract`). At peer-review time, before the review's own fixes landed, the same commands
    read 81 files and 2435 tests.
19. **`deferred-work.md` is untouched and this story opens no item.**

### Findings from the implementation review, and what changed

One peer review pass against the working-tree diff, in a separate Claude Code session. It
re-measured both gate baselines, ran twelve of its own mutations, and constructed four scratch
contracts. It reported 3 HIGH, 6 MEDIUM, and 7 LOW, verified every one of the twelve Suggested
Review Order items, and confirmed each of the nineteen notes above. All sixteen findings are closed;
nothing was deferred. Every fix below is held by a fixture that goes red when the fix is reverted.

**The three that were real defects rather than presentation:**

20. **`reducePreflight` threw a bare `TypeError` where AD-10 promises a verdict (HIGH).** Reachable
    two ways: a contract whose every operation is exempt planned zero legs, and a port echoing a
    wrong `probeId` on every leg left zero legs matched. Both reached `fixtureDigest`'s empty-list
    throw from inside the returned object literal, so `runPreflight` leaked an untyped crash and, in
    the second case, discarded the `interface-present: failed` row computed to catch exactly that
    port. Split and typed: `planPreflight` now throws
    `StructuralFailure('unreachable-check-evidence', 'EvalContract.permittedInterfaces')` when the
    plan would probe nothing, since AD-11 makes the fixture digest required and a contract offering
    nothing to probe has no fixture; `reducePreflight` throws
    `RuntimeFault('port-contract-violation', 'PreflightVerdict')` when the plan named legs and no
    observation echoed one, since `ProbeRequest.probeId` is echoed unchanged by contract. Fixtures
    121 and 122.
21. **The immutability branch was unreachable for the contract that most needs it (HIGH).**
    `selectControl` sourced the control-observe leg's inputs from `sensitivityWitness.legs[0].inputs`
    and skipped an operation with no witness. AD-10 exempts a keyless operation from carrying one, so
    a read-only contract whose only safe read is a parameterless GET planned no control leg, emitted
    no `state-reset` and no `clean-control`, and passed with no immutability evidence at all. Control
    inputs now come from the operation's own request shape: a witness supplies them when there is
    one, an operation with no required key gets empty inputs, and only an operation whose required
    keys nothing can fill is skipped. Fixture 119.
22. **Only the witness's selected channel was validated (HIGH).** `planPreflight` copies all four
    `WitnessInputs` channels onto the `ProbeRequest` and the port sends them, so a leg carrying
    `header: { authorization: … }` on an operation declaring no header keys compiled clean and went
    out on the wire, against `WitnessInputs`'s own AD-18 comment. `checkUndeclaredMandatoryInput`
    already applies the rule to all four channels of an interaction step's binding, so the asymmetry
    had no defence. `checkInputsAgainstShape` now checks required and permitted keys on every channel
    of every witness leg, of `fixtureReset.inputs`, and of each `ManifestationWitness.inputs` (the
    last in `planPreflight`, since `Probe` is not part of the contract). Fixtures 115, 116, 118.

**The rest:**

23. **`legIdsByOperation` was keyed by `operationId` alone (MEDIUM).** `Operation.operationId` is
    scoped to a `PermittedInterface` and its own schema description says two interfaces may declare
    the same one. Keyed by operation id alone, one interface's legs became another's clean legs, so a
    manifestation witness resolved against an unrelated interface's observations. Keyed compositely
    now, and `interface-present` and `input-sensitivity` carry `interfaceId` on the plan. The emitted
    `PreflightCheck` still carries `operationId` alone, because that is what the shipped schema
    admits. Fixture 123.
24. **`state-reset` compared projections with `JSON.stringify` (MEDIUM), which is key-order
    sensitive.** Two adapters serialising one body's keys in different orders would have invalidated
    a run over a difference that is not one, in the one place AD-11 makes canonical comparison the
    point. Both sides now go through `digestArtifact`. Fixture 124.
25. **Fixtures 105 and 106 re-derived their expected values from `planPreflight` (MEDIUM)**, the
    story's own banned pattern one layer out: a plan reduced to zero legs would have satisfied
    `toHaveBeenCalledTimes(plan.legs.length)`, and a reversed order would have flipped both sides
    together. Both now pin literals, the way fixture 81 pins the digest.
26. **`selectControl` required the fixture reset's interface to be the observed read's (MEDIUM).**
    AC 10 rule 3 says the mutating operation is the first marker-true one "on the interface
    `fixtureReset` names", which says nothing about where the observed read lives. A cross-interface
    reset silently got the repeated-read branch and never issued the reset leg. Resolved
    independently now. Fixture 120.
27. **Nothing checked that the two witness legs actually differ on the selected channel (MEDIUM).**
    AD-10's predicate is a differential, and two legs supplying the same value establish nothing.
    `checkWitnessLegality` gains that row, firing `malformed-operator-expression` at
    `….sensitivityWitness.legs`. Fixture 117. The review found the first instance in the repository:
    note 15's corpus edit had produced exactly that degenerate pair, so `no-state-change-marker` now
    declares `sensitivityWitness: null` instead, which is the truthful answer for an operation whose
    only declared input channel AD-10 can express no witness over once its marker is false.
28. **`declaresNoRequestKeys` moved out of `core/compile/` (LOW)** into `src/core/declared-inputs.ts`,
    beside `declaresNoRequiredKeys` which note 21 needed, so the reducer no longer imports the
    compiler's module.
29. **Fixture 17 re-derived its arity (LOW).** It read `minItems` back off `prefixItems.length` and
    counted against `Object.keys(TUPLE_ARITY).length`, so it stayed green against a tuple that lost
    an operand or a tuple dropped from the table. It pins twelve and `TUPLE_ARITY[op]` now, which is
    what review order item 6 asks for.
30. **`rootReadingCouldProduce` had no direct test (LOW).** Sixteen cases now exercise the applicator
    table by hand, including the composition-index skip, `propertyNames` staying at the object, the
    schema-valued `additionalProperties` descent, and the unknown-step widening, plus the pair of
    readings of one path that had no reachable mutant before note 13's fix.
31. **Three comments were wrong or unclear (LOW).** The caller-keyed-map census said six declarations
    and listed ten addresses, without saying `KeyTypeMap` is reached at six of them; `ARITY_ARTIFACTS`
    did not say why the two artifacts' entry ids are asymmetric (the eval-contract ids are stable
    citations); and `projection.ts` named Decision 4's cost without carrying its reason. All three
    now say it.
32. **A minted control leg id could collide with a manifestation witness's (LOW).** `declaredLegIds`
    did not see the probes, so the duplicate scan reported the collision against the probe's leg for
    a collision the minting caused. The probes' leg ids are in the avoid set now.
33. **Review order item 9's fixture had a gap (LOW).** Fixture 83 covered an absent body and an array
    body but not `{ kind: 'json', value: null }`, which is the case `ProbeRequestBody`'s tagged union
    exists to keep distinct. Covered.
34. **Review order item 1 is closed with a sentence rather than a change.** AD-10's clause "the
    declared seeded faults being the only anomalous responses in scope" is discharged by
    `seeded-faults-scoped`, which asks whether the declared fault manifests outside its own leg;
    `clean-control` discharges the separate "known-clean control behaviour" clause, and its
    status-threshold reading of "anomalous" is Decision 8's. Two readings of one word live in one
    file, so which check discharges which clause is recorded here.
35. **Review order item 10, left open by the story, is settled as Decision 4 argued it** (see note
    17). The reviewer independently reached the same conclusion and asked only that the reason live
    in the code; `projection.ts` now carries it.

### File List

**New, `src/`:**

- `src/core/schemas/sensitivity-witness.ts`
- `src/core/declared-inputs.ts` (review note 28)
- `src/core/schemas/probe-body.ts` (Completion Note 1)
- `src/core/compile/sensitivity-witness.ts`
- `src/core/preflight/projection.ts`
- `src/core/preflight/witness-evidence.ts`
- `src/core/preflight/plan.ts`
- `src/core/preflight/reduce.ts`
- `src/application/preflight.ts`

**New, `tests/`:**

- `tests/compile/sensitivity-witness.test.ts`
- `tests/preflight/fixtures/observations.ts`
- `tests/preflight/projection.test.ts`
- `tests/preflight/witness-evidence.test.ts`
- `tests/preflight/plan.test.ts`
- `tests/preflight/reduce.test.ts`
- `tests/application/preflight.test.ts`

**Edited, `src/`:**

- `src/core/schemas/interface.ts`, `src/core/schemas/probe.ts`,
  `src/core/schemas/eval-contract.ts`, `src/core/schemas/port-messages.ts`,
  `src/core/schemas/preflight-verdict.ts`, `src/core/schemas/sealed-run-record.ts`,
  `src/core/schemas/constraint-ledger.ts`
- `src/core/compile/expression-legality.ts`, `src/core/compile/compile.ts`
- `src/core/stage-contracts.ts`, `src/index.ts`

**Edited, `tests/`:**

- `tests/schemas/eval-contract.test.ts`, `tests/schemas/ad5-admissions.test.ts`,
  `tests/schemas/artifact-registry.test.ts`, `tests/schemas/constraint-ledger.test.ts`,
  `tests/schemas/publish.test.ts`
- `tests/schemas/published/keyword-occurrences.ts`,
  `tests/schemas/published/keyword-mutation.test.ts`,
  `tests/schemas/published/differential.test.ts`,
  `tests/schemas/published/mutant-generator.ts`
- `tests/schemas/fixtures/artifact-fixtures.ts`, `tests/schemas/fixtures/gate-c-contract.ts`,
  `tests/schemas/fixtures/relevance-contracts.ts`
- `tests/coverage/fixtures/satisfaction-contracts.ts`, `tests/coverage/fixtures/corpus.ts`
- `tests/seal/fixtures.ts`

**Generated and documentation:**

- `schemas/eval-contract.schema.json`, `schemas/probe.schema.json`
- `README.md`, `_bmad-output/shareable/eval-quality-readme.html`
- `_bmad-output/project-knowledge/learning-path-step-by-step.md` (row 20 and Step 20)
