---
epic: 4
story: 1
key: 4-1-pointer-resolution-and-reachability
baseline_commit: 8d84e6836dd86aac460921d039adf29e5a8ad7a7
---

# Story 4.1: Pointer resolution and reachability

Status: in-review

## Story

As the compiler's and scorer's shared eyes,
I want one implementation of the addressing grammar,
so that the reachability check and any future evaluator read the same expression identically.

## Acceptance Criteria

### AC 1: Module location, scope, and what this story does not build

**Two new modules, one small export addition to two existing files. No existing `src/` behavior changes.**

- `src/core/evaluate/evidence-resolution.ts` (new): the real `ResolveOperand` and `PointerDenotesCollection`
  implementations `resolution.ts` has carried as an injected-dependency contract since Story 3.2.
  `resolution.ts`'s own header states it directly: "Operand resolution, every pointer form including the
  bound-element `@/` form, is Story 4.1's. `ResolveOperand` and `PointerDenotesCollection` are the
  consumer-side contract it satisfies."
- `src/core/compile/reachability.ts` (new): the two compile-time checks this story owns:
  `unreachable-check-evidence`, and the bound-element scope rule (AC 5). First file under `core/compile/`;
  `failure-codes.ts`'s own comment already names that directory as where the compiler using its codes lives.
- `src/core/seal/plan-index.ts` (edit): export the two private token-decoding helpers (`decodeToken`,
  `decodeTail`) that already implement RFC 6901 unescaping correctly. `evidence-resolution.ts` needs both, for
  a bound-element pointer's own tail and for a declared collection-location pointer's tail (AC 4). A second
  private copy is the drift this codebase's own conventions warn against (`IDENTIFIER_CHARSET_SOURCE`'s
  precedent, `pointer.ts:12-13`). `reachability.ts` does not import `decodeTail`: its own reachability checks
  compare plain key strings off `target.tail`, which `parseEvidenceTarget` already decodes, and its one
  reference to a declared pointer string (the root-collection check, Decision 7) compares the raw string
  against `''` directly with no decoding needed. No other line of `plan-index.ts` changes.
- `src/core/schemas/sealed-run-record.ts` (edit): add `export type Observation = z.infer<typeof
  Observation>` immediately after the existing `export const Observation = z.strictObject({...})`. Every
  other schema this story's new modules consume by type (`Operation`, `PermittedInterface`,
  `InteractionStep`, `EvalContract`, `Expression`, `Operand`) already exports both; `Observation` is the one
  gap, because nothing outside its own artifact has needed it as a TypeScript type until now.

**What this story reuses rather than rebuilds. Read `plan-index.ts` and `derived-reference.ts` in full
before writing anything.** Story 2.1's seal module already built and shipped:

- `parseEvidenceTarget(pointer)`: parses an `InteractionPointer` string into `{ stepId, channel,
  transportChannel, tail }`, using the schema's own three-branch channel partition. This story's own
  addressing-grammar parsing need is exactly this function; it is imported, never re-implemented.
- `buildPlanIndex(interactionPlan, permittedInterfaces)` / `PlanIndex`: `stepOf`/`operationOf`/`stepsUsing`
  lookups over one contract, built once, with the duplicate-id guard reused below (Decision 12).
- `resolveStep`/`resolveOperation`: throwing wrappers over the two lookups above, for a context where an
  unresolved id is a precondition violation. This story's reachability check uses `stepOf`/`operationOf`
  directly instead (a dangling reference is the *condition being checked*, not a precondition someone else
  already ruled out), and reports it as a coded `StructuralFailure` rather than a `TypeError`.

`plan-index.ts`'s own `PlanIndex` type doc states the intent directly: "Says nothing about reachability or
channel typing; the general addressing-grammar resolver is Epic 4's." This story is that resolver, built on
top of that parser rather than beside it.

**What this story does not build, and why. Each is schema-admitted today
(`tests/schemas/ad5-admissions.test.ts`) and awaits a later story:**

1. **`unresolved-reference-set`**, and every slice of `malformed-operator-expression` besides the one named
   in AC 5: wrong arity (already schema-enforced), a rejected regex construct, a reference-set operand
   outside its three legal positions. Story 4.2's job ("AD-5's registry as code and the structural compile
   checks").
2. **`quantifier-nesting-exceeded`**, **`quantifier-over-non-collection`**, **`duplicate-operation-signature`**,
   **`undeclared-mandatory-input`**. Also Story 4.2's job or later; none is named in this story's own
   epics.md AC.
3. **`plan-exceeds-scripting-bound`**, **`nested-temporal-clause`**. Story 4.3's job (AD-39's graph
   predicate).
4. **`rubric-evidence-unreachable`** and every rubric code. AD-22 belongs to Epic 6 in `EPIC-BRIEF.md`, not
   Epic 4. A criterion's own evidence pointer poses a structurally identical reachability question to an
   oracle's, but it is a different code with a different citing AD, and the epic split drew the boundary
   there deliberately.
5. **A `compile()` orchestrating entry point.** Nothing wires this story's new checks, or any other
   compile-time check, into one call that returns a contract or a failure. AD-34's "one orchestration layer"
   is Story 4.4's; this story ships standalone, independently callable, pure functions a future orchestrator
   composes.
6. **The evidence-selection algorithm.** Which `SealedRunRecord.observations[]` entry a declared interaction
   step's input-binding predicate actually selects is AD-33/AD-40 territory, score-side, and explicitly
   deferred (`ARCHITECTURE-SPINE.md`'s Owed items 1-3; "no epic touches `score`" until they close).
   `makeResolveOperand` (AC 3) takes the result of that selection, one `Observation` already chosen per step,
   as a plain injected `Record<string, Observation>`. Picking which observation goes in that map belongs to a
   future story.
7. **Wiring `makeResolveOperand`/`makePointerDenotesCollection` into `resolveCheck`.** No production caller
   exists yet: that is the score stage itself, which this spine calls "owed to a reference implementation."
8. **Any change to `resolution.ts`, `operators.ts`, `resolved-value.ts`, or their tests.** The existing
   `tests/evaluate/fixtures/stub-resolver.ts` stays as-is. Its own header already calls itself "Test-only
   stand-ins for Story 4.1's addressing-grammar resolver," built deliberately simplified for dispatch-logic
   tests that do not need RFC 6901 fidelity (Decision 1).
9. **A bound on recursion depth for the check-tree walk `reachability.ts` adds.** `Expression`'s own
   recursive shape has no depth limit, and Story 3.2's Decision 12 already recorded this class of gap as
   "open, unowned" for `resolution.ts`'s identically-shaped recursive walk. This story's new walk inherits
   the same unfixed gap rather than resolving it here: an unusually deep tree throws a plain `RangeError`
   from stack exhaustion, not a coded `StructuralFailure`, and nothing here changes that (Decision 14).

**Purity (AD-1).** All exported functions are synchronous, deterministic, and pure: no I/O, no clock, no
randomness. `core/compile/reachability.ts` importing `core/evaluate/evidence-resolution.ts` (AC 5, for one
shared regular expression) and `core/seal/plan-index.ts` are both already-established cross-submodule imports
within `core/`: `core/evaluate/operators.ts` already imports `core/canonical/digest.ts`, and
`core/seal/scripting-audit.ts` already imports `core/failure-codes.ts` directly.

### AC 2: `plan-index.ts` export addition

Change the two private declarations to exported ones, with an updated doc comment. No other line changes:

```ts
/**
 * Exported for Story 4.1's reuse: the real addressing-grammar resolver
 * (`core/evaluate/evidence-resolution.ts`) decodes a bound-element
 * pointer's own tail and a declared collection-location pointer's tail with
 * these same two functions. A second private copy would be exactly the
 * drift this codebase's own conventions warn against
 * (`IDENTIFIER_CHARSET_SOURCE`'s own precedent).
 */
export const decodeToken = (token: string): string =>
	token.replace(/~1/g, '/').replace(/~0/g, '~')

export const decodeTail = (tailSource: string): readonly string[] =>
	tailSource === '' ? [] : tailSource.slice(1).split('/').map(decodeToken)
```

In `sealed-run-record.ts`, immediately below `export const Observation = z.strictObject({...})`, add:

```ts
export type Observation = z.infer<typeof Observation>
```

### AC 3: `makeResolveOperand`, the real `ResolveOperand`

Add to `src/core/evaluate/evidence-resolution.ts`:

```ts
/**
 * A canonical RFC 6901 array-index token: no leading zero except "0" itself,
 * no sign, digits only. Excludes the "-" token (RFC 6901's "the nonexistent
 * member after the last array element"): this grammar only ever reads, so
 * "-" can never name a value and resolves ABSENT like any other unmatched
 * token. Exported so `core/compile/reachability.ts`'s root-collection index
 * check (AC 5, Decision 7) tests reachability against the identical grammar
 * this resolver actually walks.
 */
export const ARRAY_INDEX_PATTERN = /^(?:0|[1-9][0-9]*)$/

/**
 * Walks `tail` (already `~0`/`~1`-decoded tokens) into `root`. `Object.hasOwn`
 * guards every object step: a genuine own JSON property named `__proto__` or
 * `constructor` (e.g. parsed straight out of a response body) still resolves
 * to its actual value, while the identical name, absent as an own property,
 * never falls through to whatever `Object.prototype` happens to carry
 * (Story 3.3's `keyValueOf` applies this same guard for the same reason).
 * Any miss, any type mismatch mid-walk, or a tail running past a scalar all
 * collapse to `ABSENT` uniformly: AD-26's own rule, "a pointer that does not
 * resolve yields the distinct value absent," with no special case for which
 * of the three produced it.
 */
export function walkTail(root: JsonValue, tail: readonly string[]): ResolvedValue {
	let current: JsonValue = root
	for (const token of tail) {
		if (current === null || typeof current !== 'object') return ABSENT
		if (Array.isArray(current)) {
			if (!ARRAY_INDEX_PATTERN.test(token)) return ABSENT
			const index = Number(token)
			if (!Object.hasOwn(current, index)) return ABSENT
			current = current[index] as JsonValue
			continue
		}
		if (!Object.hasOwn(current, token)) return ABSENT
		current = current[token] as JsonValue
	}
	return current
}

/**
 * `BoundElementPointer`'s own tail, decoded correctly for the zero-token
 * case (Decision 2). `BOUND_ELEMENT_POINTER_PATTERN` (`pointer.ts`) requires
 * at least one "/", so the shortest legal form is the two characters "@/",
 * addressing the bound element itself with no descent: AD-26's own words,
 * "Bare '@/' addresses the element itself." Feeding `pointer.slice(1)`
 * (`"/"`) straight into `decodeTail` does not produce that:
 * `decodeTail` only special-cases a truly empty string, and `"/"` is not
 * one, so it decodes to `['']`, a single empty-string token, which
 * `walkTail` then treats as "look up the key that is the empty string"
 * rather than "the element itself." This function special-cases exactly
 * that one input.
 */
export function decodeBoundElementTail(pointer: string): readonly string[] {
	const tailSource = pointer.slice(1)
	return tailSource === '/' ? [] : decodeTail(tailSource)
}

/**
 * Selects the channel `target` names off one `Observation`. AD-26 gives
 * `stdout`/`stderr` a tail per the schema's own tail-bearing partition even
 * though `Observation.stdout`/`stderr` are bare strings; `walkTail` already
 * resolves any non-empty tail into a string to `ABSENT` on its first
 * iteration, so no special case is needed here.
 */
function channelRoot(observation: Observation, target: EvidenceTarget): JsonValue {
	switch (target.channel) {
		case 'response-body':
			return observation.responseBody
		case 'response-headers':
			return observation.responseHeaders
		case 'response-status':
			return observation.responseStatus
		case 'stdout':
			return observation.stdout
		case 'stderr':
			return observation.stderr
		case 'exit-code':
			return observation.exitCode
		case 'call-inputs': {
			const { transportChannel } = target
			if (transportChannel === null) {
				// Unreachable: parseEvidenceTarget sets this exactly when the
				// channel is 'call-inputs'.
				throw new TypeError(
					'call-inputs evidence target carries no transport channel',
				)
			}
			return observation.callInputs[transportChannel]
		}
	}
}

/**
 * The real `ResolveOperand`. `stepObservations` is one already-selected
 * `Observation` per interaction step (AC 1 point 6). `referenceSets` mirrors
 * the contract's own declared reference sets by identifier (an unresolved
 * identifier is `unresolved-reference-set`, a compile-time concern this
 * function assumes already happened, matching every leaf operator's own
 * "assumed compile-time-prevented" convention). Both maps are looked up with
 * `Object.hasOwn` before indexing, never with `??`/plain bracket access
 * (Decision 3): `Identifier`'s own charset admits `constructor`
 * (`/^[a-z0-9]+(?:-[a-z0-9]+)*$/` matches it), and a plain-object index on a
 * missing `constructor` key returns `Object.prototype.constructor` rather
 * than `undefined`, so `map[key] ?? ABSENT` would silently return a function
 * where AD-26 requires `ABSENT`.
 */
export function makeResolveOperand(
	stepObservations: Readonly<Record<string, Observation>>,
	referenceSets: Readonly<Record<string, JsonValue[]>>,
): ResolveOperand {
	return (operand, boundElement) => {
		if ('literal' in operand) return operand.literal
		if ('referenceSet' in operand) {
			if (!Object.hasOwn(referenceSets, operand.referenceSet)) return ABSENT
			return referenceSets[operand.referenceSet] as JsonValue[]
		}
		const { pointer } = operand
		if (pointer.startsWith('@')) {
			// ABSENT means "no active binding" (Story 3.2 Decision 8). A
			// correctly-compiled contract never reaches this with boundElement
			// ABSENT (checkBoundElementScope rejects a "@/" pointer outside a
			// quantifier at compile time, AC 5), but resolveOperand stays total
			// over every input rather than throwing on this one.
			if (boundElement === ABSENT) return ABSENT
			return walkTail(boundElement, decodeBoundElementTail(pointer))
		}
		const target = parseEvidenceTarget(pointer)
		if (!Object.hasOwn(stepObservations, target.stepId)) return ABSENT
		const observation = stepObservations[target.stepId] as Observation
		return walkTail(channelRoot(observation, target), target.tail)
	}
}
```

Imports: `parseEvidenceTarget`, `decodeTail`, and the `EvidenceTarget` type from `../seal/plan-index.ts`;
`ABSENT`, `ResolvedValue` from `./resolved-value.ts`; `ResolveOperand` (type) from `./resolution.ts`;
`Observation` (type) from `../schemas/sealed-run-record.ts`; `JsonValue` from `../schemas/primitives.ts`.

### AC 4: `makePointerDenotesCollection`, the real `PointerDenotesCollection`

Add to the same file:

```ts
function tokensEqual(a: readonly string[], b: readonly string[]): boolean {
	return a.length === b.length && a.every((token, index) => token === b[index])
}

/**
 * Only `response-body` can ever answer `true`: AD-19's
 * `ResponseDescriptor.collectionLocations` is the only declared-collection
 * surface in the schema, scoped to the body alone. Builds its `PlanIndex`
 * lazily, on the first call rather than at construction (Decision 12), so a
 * factory over a contract carrying a schema-admitted duplicate step or
 * operation id does not throw before its first real use. A `@/` pointer, a
 * pointer naming an undeclared step, and a pointer whose step names an
 * undeclared operation all answer `false` rather than throwing: this is a
 * boolean predicate with no failure mode of its own for those three cases,
 * so it uses the graceful `stepOf`/`operationOf` lookups, not the throwing
 * `resolveStep`/`resolveOperation`.
 */
export function makePointerDenotesCollection(
	contract: EvalContract,
): PointerDenotesCollection {
	let index: PlanIndex | undefined
	const getIndex = (): PlanIndex => {
		index ??= buildPlanIndex(contract.interactionPlan, contract.permittedInterfaces)
		return index
	}
	return (pointer) => {
		if (pointer.startsWith('@')) return false
		const target = parseEvidenceTarget(pointer)
		if (target.channel !== 'response-body') return false
		const step = getIndex().stepOf(target.stepId)
		if (step === undefined) return false
		const operation = getIndex().operationOf(step.operationId)
		if (operation === undefined) return false
		const { collectionLocations } = operation.responseDescriptor
		if (collectionLocations === null) return false
		return collectionLocations.some((location) =>
			tokensEqual(decodeTail(location.pointer), target.tail),
		)
	}
}
```

Additional imports: `buildPlanIndex` and the `PlanIndex` type from `../seal/plan-index.ts`; `EvalContract`
(type) from `../schemas/eval-contract.ts`; `PointerDenotesCollection` (type) from `./resolution.ts`.

### AC 5: `src/core/compile/reachability.ts`, the two compile-time checks

```ts
/**
 * AD-26's compile-time reachability check (`unreachable-check-evidence`,
 * AD-19/AD-26) and the bound-element scope rule `pointer.ts`'s own
 * `BoundElementPointer` doc names as "a compile-time check (Story 4.1), not
 * a schema check": a `@/` pointer outside a quantifier's predicate is an
 * operand type no operator position legally accepts there, the same framing
 * `malformed-operator-expression`'s own AD-26 citation already applies to a
 * reference-set operand outside its three legal positions
 * (`ARCHITECTURE-SPINE.md:392`). epics.md's own AC for this story already
 * bundles "`@/` binds only inside quantifiers" into the same sentence as
 * `unreachable-check-evidence`, so enforcing it is this story's required
 * scope, not an optional extension (Decision 9).
 *
 * Both public checks walk every oracle's `check` tree once and throw
 * `StructuralFailure` on the first violation, matching
 * `auditBriefScripting`'s own fail-fast convention (`scripting-audit.ts`),
 * the only existing precedent for a structural-failure thrower in this
 * codebase. Each throw reports at most one violation per call (Decision
 * 10); `evaluatePointerReachability` is exported separately as the
 * non-throwing per-pointer core, both for a future collecting orchestrator
 * to call directly and for this story's own parity-matrix tests (AC 6) to
 * run against the identical pointers `makeResolveOperand` walks.
 */
import { ARRAY_INDEX_PATTERN } from '../evaluate/evidence-resolution.ts'
import { StructuralFailure } from '../failure-codes.ts'
import type { EvalContract } from '../schemas/eval-contract.ts'
import type { Expression, Operand } from '../schemas/expression.ts'
import {
	buildPlanIndex,
	parseEvidenceTarget,
	type PlanIndex,
} from '../seal/plan-index.ts'

// ---- shared tree walk, with an operand path for AD-5's own artifact-path
// requirement ----------------------------------------------------------

type PointerSite = {
	readonly pointer: string
	readonly path: string
	readonly insideQuantifier: boolean
}

type SiteVisitor = (site: PointerSite) => void

function visitOperand(
	operand: Operand,
	path: string,
	insideQuantifier: boolean,
	visit: SiteVisitor,
): void {
	if ('pointer' in operand) visit({ pointer: operand.pointer, path, insideQuantifier })
	// `{ literal }` and `{ referenceSet }` address no interaction evidence.
}

// Covers every one of the sixteen `op` values. `set-membership`'s second
// position is a `SetOperand` (`{ referenceSet }` or `{ literal: [...] }`,
// `expression.ts`'s own union), never a `{ pointer }`, so only its first
// operand can carry one. The nine other tuple-shaped ops (equality,
// deep-equality, containment, existence, absence, regex, ordering,
// count-tolerance, shape, covers-by-key) fall through to the default
// branch uniformly, since each declares `operands: Operand[]`.
function visitExpression(
	expression: Expression,
	path: string,
	insideQuantifier: boolean,
	visit: SiteVisitor,
): void {
	switch (expression.op) {
		case 'not':
			visitExpression(expression.operands[0], `${path}.operands[0]`, insideQuantifier, visit)
			return
		case 'all':
		case 'any':
			expression.operands.forEach((child, index) => {
				visitExpression(child, `${path}.operands[${index}]`, insideQuantifier, visit)
			})
			return
		case 'for-all':
		case 'for-any':
			// `collection` is evaluated in whatever bound-element context is
			// already open, never a fresh one (Decision 11): matches
			// `resolveQuantifier`'s own rule that a nested quantifier's
			// `collection` resolves "against whatever boundElement was already
			// in scope" (`resolution.ts`). Only `predicate` opens a new scope.
			visitOperand(expression.collection, `${path}.collection`, insideQuantifier, visit)
			visitExpression(expression.predicate, `${path}.predicate`, true, visit)
			return
		case 'set-membership':
			visitOperand(expression.operands[0], `${path}.operands[0]`, insideQuantifier, visit)
			return
		default:
			expression.operands.forEach((operand, index) => {
				visitOperand(operand, `${path}.operands[${index}]`, insideQuantifier, visit)
			})
	}
}

function forEachCheckPointer(
	contract: EvalContract,
	visit: (site: PointerSite, oracleId: string) => void,
): void {
	contract.oracles.forEach((oracle) => {
		if (oracle.check === null) return
		visitExpression(oracle.check, 'check', false, (site) => visit(site, oracle.id))
	})
}

// ---- malformed-operator-expression: @/ outside any quantifier -----------

export function checkBoundElementScope(contract: EvalContract): void {
	forEachCheckPointer(contract, (site, oracleId) => {
		if (site.pointer.startsWith('@') && !site.insideQuantifier) {
			throw new StructuralFailure(
				'malformed-operator-expression',
				`EvalContract.oracles[id=${oracleId}].${site.path}`,
				`bound-element pointer "${site.pointer}" appears outside any quantifier's predicate; "@/" binds only inside a quantifier (AD-26)`,
			)
		}
	})
}

// ---- unreachable-check-evidence ------------------------------------------

type ReachabilityResult =
	| { readonly reachable: true }
	| { readonly reachable: false; readonly reason: string }

const reachable = (): ReachabilityResult => ({ reachable: true })
const unreachable = (reason: string): ReachabilityResult => ({ reachable: false, reason })

const SCALAR_TYPES = new Set(['string', 'number', 'boolean', 'null'])

// A declared field's own type blocks any further descent only when it is
// definitely a scalar (Decision 6). `undefined` (not declared) and `null`
// (declared, type not stated) both stay permissive: nothing rules out
// descent, so this compiler is no more discerning than the declarations let
// it be, the same default Decision 5 applies to a channel with no shape at
// all.
function descendsIntoDeclaredScalar(
	types: Readonly<Record<string, string | null | undefined>>,
	tail: readonly string[],
	firstToken: string,
): boolean {
	if (tail.length <= 1) return false
	const declaredType = types[firstToken]
	return declaredType !== undefined && declaredType !== null && SCALAR_TYPES.has(declaredType)
}

/**
 * The non-throwing core `checkEvidenceReachability` wraps and AC 6's
 * parity-matrix tests call directly, over the identical pointer set
 * `makeResolveOperand`'s own walk resolves (Decision 9's own header note).
 */
export function evaluatePointerReachability(
	pointer: string,
	index: PlanIndex,
): ReachabilityResult {
	// Relative to a bound element, not rooted at an interaction: nothing
	// declared to check reachability against (`makePointerDenotesCollection`,
	// `evidence-resolution.ts`, is the closest analogue and is runtime-side).
	if (pointer.startsWith('@')) return reachable()

	const target = parseEvidenceTarget(pointer)
	const step = index.stepOf(target.stepId)
	if (step === undefined) {
		return unreachable('names a step the interaction plan does not declare')
	}
	const operation = index.operationOf(step.operationId)
	if (operation === undefined) {
		return unreachable(
			`names step "${target.stepId}", which names operation "${step.operationId}", not declared by any permitted interface`,
		)
	}

	if (target.channel === 'stdout' || target.channel === 'stderr') {
		// Observation.stdout/stderr are always bare strings (Decision 8):
		// no declared or possible shape ever admits a tail into either, so a
		// non-empty tail here is not merely unchecked, it is provably always
		// ABSENT under any conforming resolver.
		if (target.tail.length > 0) {
			return unreachable(
				`addresses a field inside ${target.channel}, which never carries structure to descend into`,
			)
		}
		return reachable()
	}

	if (target.channel === 'response-body') {
		if (target.tail.length === 0) return reachable()
		const firstToken = target.tail[0]
		if (firstToken === undefined) {
			// Unreachable: the length check above guarantees an element.
			throw new TypeError('evidence-target tail is non-empty but has no first token')
		}
		const { requiredKeys, permittedKeys, types, collectionLocations } =
			operation.responseDescriptor
		// A root-declared collection (`pointer: ''`, the response body itself
		// is the array) indexes directly, bypassing the object-key check below
		// (Decision 7): `requiredKeys`/`permittedKeys` name object fields and
		// have nothing to say about an array index.
		const rootIsCollection = collectionLocations?.some((location) => location.pointer === '')
		if (rootIsCollection === true && ARRAY_INDEX_PATTERN.test(firstToken)) return reachable()
		if (!requiredKeys.includes(firstToken) && !permittedKeys.includes(firstToken)) {
			return unreachable(
				`addresses response-body field "${firstToken}", which operation "${operation.operationId}" declares in neither requiredKeys nor permittedKeys`,
			)
		}
		if (descendsIntoDeclaredScalar(types, target.tail, firstToken)) {
			return unreachable(
				`descends into response-body field "${firstToken}", which operation "${operation.operationId}" declares a scalar with no further structure`,
			)
		}
		return reachable()
	}

	if (target.channel === 'call-inputs') {
		if (target.tail.length === 0) return reachable()
		const { transportChannel } = target
		if (transportChannel === null) {
			// Unreachable: parseEvidenceTarget's own guarantee.
			throw new TypeError('call-inputs evidence target carries no transport channel')
		}
		const firstToken = target.tail[0]
		if (firstToken === undefined) {
			throw new TypeError('evidence-target tail is non-empty but has no first token')
		}
		const { requiredKeys, permittedKeys, types } = operation.requestShape[transportChannel]
		if (!requiredKeys.includes(firstToken) && !permittedKeys.includes(firstToken)) {
			return unreachable(
				`addresses call-inputs ${transportChannel} field "${firstToken}", which operation "${operation.operationId}" declares in neither requiredKeys nor permittedKeys`,
			)
		}
		if (descendsIntoDeclaredScalar(types, target.tail, firstToken)) {
			return unreachable(
				`descends into call-inputs ${transportChannel} field "${firstToken}", which operation "${operation.operationId}" declares a scalar with no further structure`,
			)
		}
		return reachable()
	}

	// response-headers, response-status, exit-code: AD-19 declares no shape
	// for any of them (Decision 8), so an operation that resolves is the
	// entire compile-time check available.
	return reachable()
}

/** `unreachable-check-evidence`: an interaction-rooted pointer the declared interfaces cannot produce. */
export function checkEvidenceReachability(contract: EvalContract): void {
	let index: PlanIndex | undefined
	forEachCheckPointer(contract, (site, oracleId) => {
		index ??= buildPlanIndex(contract.interactionPlan, contract.permittedInterfaces)
		const result = evaluatePointerReachability(site.pointer, index)
		if (!result.reachable) {
			throw new StructuralFailure(
				'unreachable-check-evidence',
				`EvalContract.oracles[id=${oracleId}].${site.path}`,
				`"${site.pointer}" ${result.reason}`,
			)
		}
	})
}
```

### AC 6: Fixtures and tests

**`tests/evaluate/evidence-resolution.test.ts` (new).**

`walkTail`/`decodeBoundElementTail`, tested directly:

1. Empty tail returns the root unchanged, including where the root is JSON `null`.
2. A nested object field two levels deep, and an array element by canonical index.
3. A key containing a literal `/` and `~` via the RFC 6901 `~1`/`~0` escapes: the one case the existing
   test-only stub explicitly does not handle (`stub-resolver.ts`'s own header: "No `~0`/`~1` unescaping,
   since these fixtures' pointers never carry a literal `/` or `~` in a key").
4. A double-slash tail (`/a//b`, an empty-string middle token) walks into an object carrying a genuine key
   that is the empty string, rather than short-circuiting.
5. A non-canonical array-index token (`"01"`, `"+1"`, `"1.0"`, `" 1"`) against an array resolves `ABSENT`.
6. The RFC 6901 `"-"` token against an array resolves `ABSENT` (this grammar only reads; `"-"` never names an
   existing element).
7. An out-of-range canonical index (`"5"` against a three-element array) resolves `ABSENT`.
8. Walking a tail into a scalar (a string, a number, a boolean, `null`) resolves `ABSENT` at the first
   further segment.
9. A genuine own JSON property named `__proto__` or `constructor` (constructed via `JSON.parse` of a literal
   object containing that key, not an object-literal spread, so it lands as a real own property rather than
   triggering the special `__proto__` accessor) resolves to its actual value. A *different* object with no
   such own key resolves `ABSENT` for the same pointer, never the inherited `Object.prototype` value. State
   both cases explicitly in one test each: this is the corrected version of an earlier draft of this fixture,
   which described only the second half and read as though every `__proto__`/`constructor` key is always
   missing.
10. `decodeBoundElementTail('@/')` is `[]`; `decodeBoundElementTail('@/x')` is `['x']`; `decodeBoundElementTail('@/a/b')`
    is `['a', 'b']`. Pin all three directly, independent of `walkTail`, since this is the one place a
    plausible off-by-one produces a silently wrong empty-tail answer (the bug this function exists to fix).

`makeResolveOperand`:

11. `{ literal }` resolves to itself (any JSON shape, including `null`, `[]`, and a nested object).
12. `{ referenceSet }` resolves the declared array, or `ABSENT` for an identifier the map omits.
13. `{ referenceSet: 'constructor' }` against a `referenceSets` map with no own `constructor` key resolves
    `ABSENT`, not `Object.prototype.constructor`. Pair with a positive case: `referenceSets` carrying a
    genuine own `constructor` entry resolves that declared array correctly.
14. `{ pointer: '/interactions/no-such-step/...' }` against a `stepObservations` map with no own key of that
    name resolves `ABSENT`, including where the name is `constructor` (same guard as 13, the pointer path
    rather than the reference-set path).
15. A pointer naming a step the `stepObservations` map genuinely does not carry resolves `ABSENT` (the
    ordinary, expected "the evaluator never reached this step" case, not a thrown error; AD-21's `unreached`).
16. Empty tail on each of the seven channels returns the channel's own root value unchanged, including where
    that value is JSON `null` (`responseStatus: null` resolves `null`, not `ABSENT`, a recorded fact rather
    than a missing one). Include an explicit empty-tail `call-inputs/{transport}` case for each of the four
    transport channels.
17. `call-inputs/{transport}` selects the right one of the four `ObservedCallInputs` channels; a `null`
    channel (declared-but-unused) walks to `ABSENT` on any non-empty tail, `null` on an empty one.
18. `@/` with an active `boundElement` walks the bound element itself (bare `@/`, empty tail) and into a
    nested field, reusing the escape and array-index cases above.
19. `@/` with `boundElement === ABSENT` resolves `ABSENT` (the defensive, never-thrown case).
20. Purity/determinism: the same operand, the same context, the same result across repeated calls.

`makePointerDenotesCollection`, built once per test group over `populatedContract` unless stated otherwise:

21. `/interactions/list/response-body/items` resolves `true` (the one declared collection location in this
    codebase's own fixtures).
22. `/interactions/create/response-body/ok` (a scalar field on a different operation's descriptor) resolves
    `false`.
23. `/interactions/list/response-headers/x-total-count` and `/interactions/create/call-inputs/body/name`
    resolve `false`: neither channel has a declared-collection surface at all.
24. Any `@/…` pointer resolves `false` unconditionally, matching `PointerDenotesCollection`'s own documented
    contract.
25. A pointer naming an undeclared step, and one naming a step whose operation is undeclared, resolve
    `false`, not a thrown error. Contrast directly against `checkEvidenceReachability` throwing over the
    identical two shapes (AC 6 fixtures 28 and 30 below), to make the graceful-versus-throwing split explicit
    rather than implied.
26. `collectionLocations: null` (nothing declared) and `collectionLocations: []` (declared, explicitly none)
    both resolve `false`, over two separately-mutated contracts, so the two distinct declaration states are
    each pinned rather than assumed equivalent.
27. Two declared collection locations on one operation's descriptor; the pointer matching the *second* entry
    still resolves `true` (the `.some()` search is not accidentally short-circuited to only the first).
28. A declared collection location whose own pointer contains an escaped `~1`/`~0` segment resolves `true`
    against the matching decoded target pointer, proving `decodeTail` is applied to the declared side too,
    not only to the resolved side.

**`tests/compile/reachability.test.ts` (new).**

Positive, whole-fixture regression anchors, proving zero false positives against every already-shipped,
already-passing check tree in this codebase:

29. `checkEvidenceReachability(populatedContract)` and `checkEvidenceReachability(gateCContract)` both return
    with no throw.
30. `checkBoundElementScope(populatedContract)` and `checkBoundElementScope(gateCContract)` both return with
    no throw. `gateCContract`'s O-004 (`not(for-any(page, existence(@/retractedAt)))`) is this codebase's
    real worked example of `@/` used correctly inside a quantifier; O-005's `shape(@/)` and O-006's
    `set-membership(@/…, …)` are two more, each a different `@/` shape inside a different quantifier form.

`checkEvidenceReachability` negative fixtures, each `structuredClone(populatedContract)` plus one mutation
to `oracles[0].check`, matching `ad5-admissions.test.ts`'s own established mutation style. Fixtures 31 and 32
are the two shapes that file already admits at the schema level and leaves for this story to reject:

31. A pointer naming an undeclared step (`/interactions/no-such-step/response-body/items`) throws
    `StructuralFailure` with `code: 'unreachable-check-evidence'`.
32. An empty `interactionPlan` (`contract.interactionPlan = []`) throws, the same code, over the same O-001
    check: every step becomes undeclared at once.
33. A step declared in the plan but naming an operation no permitted interface declares
    (`contract.interactionPlan[1].operationId = 'no-such-operation'`, the `list` step O-001's own pointer
    roots at) throws, the same code (Decision 4: this goes further than the "no AD-5 code" schema-admission
    test at `ad5-admissions.test.ts`, which never attaches an oracle to the dangling step, so it stays true
    regardless of this story's own behavior).
34. `response-body` pointer naming a key in neither `requiredKeys` nor `permittedKeys`
    (`/interactions/list/response-body/notAField`) throws, the same code.
35. `call-inputs/body` pointer naming a key `create-thing`'s request shape does not declare
    (`/interactions/create/call-inputs/body/notAField`) throws, the same code.
36. Positive contrast for Decision 5 (the `requiredKeys ∪ permittedKeys` union, not `permittedKeys` alone):
    mutate `list-things`' descriptor so `permittedKeys` no longer contains `'items'` while `requiredKeys`
    still does, and assert O-001's own `/interactions/list/response-body/items` pointer still passes.
37. A pointer descending past a field the descriptor declares a scalar type
    (`/interactions/create/response-body/ok/nested`, `ok` declared `boolean`) throws
    `unreachable-check-evidence`. A sibling case where the field's type is undeclared or declared `null`
    (type not stated) does *not* throw over the identical two-level tail, proving the permissive default
    stays permissive exactly where nothing rules descent out.
38. A pointer indexing a root-declared collection (`collectionLocations: [{ pointer: '', ... }]` on a cloned
    operation, checked pointer `/interactions/list/response-body/0`) does not throw, and the mirror case with
    `collectionLocations: null` on the same operation does throw over the identical pointer, proving the
    root-collection carve-out fires only when actually declared.
39. `stdout`/`stderr` pointers with a non-empty tail throw `unreachable-check-evidence`; the same two
    channels with an empty tail do not.
40. `response-status`, `exit-code`, `response-headers`, and a `response-body` empty-tail pointer all pass
    once step and operation resolve, with no declared shape to check further against; one small hand-built
    `existence` check per channel, each replacing `contract.oracles[0].check` wholesale.
41. Every violation in the contract fires on the first oracle and pointer found, not the last: two oracles,
    each with its own unreachable pointer, still throws once, and the thrown error's `artifactPath` names
    the first oracle's id.
42. The `artifactPath` on a thrown error names the exact operand position, not only the oracle: a violation
    inside a `for-all`'s `predicate.operands[0]` reports a path ending `.check.predicate.operands[0]`, and a
    violation in a top-level `covers-by-key`'s second operand reports `.check.operands[1]`.

`checkBoundElementScope` fixtures:

43. `contract.oracles[0].check = { op: 'existence', operands: [{ pointer: '@/x' }] }` (no enclosing
    quantifier at all) throws `StructuralFailure` with `code: 'malformed-operator-expression'`.
44. The exact nested-quantifier shape `ad5-admissions.test.ts` already uses for its own
    `quantifier-nesting-exceeded` fixture (`for-all` over `/interactions/list/response-body/items`, predicate
    `for-any` over `@/children`, predicate `existence(@/id)`) does **not** throw here: `@/children` is the
    outer quantifier's own `collection`-position pointer, inheriting context (Decision 11); `@/id` is inside
    the inner predicate, also legal.
45. A `@/` pointer as the first operand of a top-level `covers-by-key` (no quantifier at all) throws, the
    same code, proving the walk covers every operand-bearing `op`, not only `existence`.

**Parity matrix (Decision 9).** One shared table of pointer strings against `gateCContract` and
`populatedContract`, each run through both `evaluatePointerReachability` (given a `PlanIndex` built once over
the same contract) and `makeResolveOperand`'s walk (given a hand-built `Record<string, Observation>` whose
shape matches the pointer's own target). Assert the two never disagree in the direction that matters:

46. Every pointer `evaluatePointerReachability` marks unreachable, when run through `makeResolveOperand`
    against a plausibly-populated `Observation` map, resolves `ABSENT` (never throws, and never resolves a
    concrete value): the undeclared-step, undeclared-operation, undeclared-field, scalar-descent, and
    stdout/stderr-tail shapes from fixtures 31-35 and 37, 39.
47. Every pointer `evaluatePointerReachability` marks reachable resolves to either a concrete value or
    `ABSENT` without throwing: the root-collection index case (fixture 38's positive half) and the
    escaped-key case (fixture 3/28's pointer, run through both functions against matching data).

### AC 7: The gate

- `npm run check:docs` and `npm test` run and the baseline is recorded **before the first edit**.
- `npm run validate` passes at the end: typecheck, lint, check:docs, check:shareable, `lint:spine`,
  `check:vectors`, `check:schemas`, `check:ad5-registry`. This story touches no spine text and adds no new
  `FailureCode`/`RuntimeFaultCode` member (both `'unreachable-check-evidence'` and
  `'malformed-operator-expression'` are already in `FAILURE_CODES`), so `lint:spine` and
  `check:ad5-registry` are expected no-ops. Run them anyway.
- `src/index.ts` is not touched: none of this story's exports is part of the published library surface yet.

## Tasks / Subtasks

- [x] Task 1: preflight (AC 7)
  - [x] Run `npm run check:docs` and `npm test`; record the baseline test count before the first edit.
- [x] Task 2: reuse, not rebuild (AC 2)
  - [x] `src/core/seal/plan-index.ts`: export `decodeToken`/`decodeTail`, update their doc comment. No other
        line changes.
  - [x] `src/core/schemas/sealed-run-record.ts`: add `export type Observation = z.infer<typeof Observation>`.
- [x] Task 3: the real resolver (AC 3, AC 4)
  - [x] `src/core/evaluate/evidence-resolution.ts`: `ARRAY_INDEX_PATTERN`, `walkTail`,
        `decodeBoundElementTail`, `channelRoot`, `makeResolveOperand`, `tokensEqual`,
        `makePointerDenotesCollection`.
- [x] Task 4: the two compile-time checks (AC 5)
  - [x] `src/core/compile/reachability.ts`: the shared tree walk (`visitOperand`, `visitExpression`,
        `forEachCheckPointer`), `checkBoundElementScope`, `evaluatePointerReachability`,
        `checkEvidenceReachability`.
- [x] Task 5: fixtures and tests (AC 6)
  - [x] `tests/evaluate/evidence-resolution.test.ts`: fixtures 1-28.
  - [x] `tests/compile/reachability.test.ts`: fixtures 29-47.
- [x] Task 6: the gate (AC 7)
  - [x] `npm run validate` green.
- [x] Task 7: record
  - [x] `_bmad-output/project-knowledge/learning-path-step-by-step.md`: one new row, following
        `learning-path-template.md`'s exact shape, after this story is marked done.
  - [x] Dev Agent Record: measured counts, any decision that moved from this story's default.

### Review Findings

- [ ] [Review][Decision] The bound-element grammar cannot address one empty-string object key: bare `@/`
  is reserved for the bound element itself, while `@//` currently decodes as two empty tokens. Decide
  whether to give the empty key an explicit spelling or declare empty keys unaddressable through `@/`.
- [ ] [Review][Patch] Reject non-canonical indices after fields declared as arrays in response-body and
  call-inputs reachability [src/core/compile/reachability.ts:261]
- [ ] [Review][Patch] Reject non-index tokens when the response body is declared as a root collection
  [src/core/compile/reachability.ts:248]
- [ ] [Review][Patch] Add fixture 25's required direct contrast against `checkEvidenceReachability` for
  undeclared steps and operations [tests/evaluate/evidence-resolution.test.ts:334]
- [ ] [Review][Patch] Exercise both `~1` and `~0` decoding on the declared collection-location side in
  fixture 28 [tests/evaluate/evidence-resolution.test.ts:386]
- [ ] [Review][Patch] Add the required `stderr` tail case to unreachable parity fixture 46
  [tests/compile/reachability.test.ts:398]
- [ ] [Review][Patch] Assert fixture 47's resolver outputs are concrete values or `ABSENT`, rather than
  asserting only that resolution does not throw [tests/compile/reachability.test.ts:474]
- [ ] [Review][Patch] Add negative traversal tests for bad pointers beneath `not`, `all`, and `any`,
  including a later sibling [tests/compile/reachability.test.ts:56]
- [ ] [Review][Patch] Prove call-input reachability selects each of path, query, header, and body from its
  own request shape [tests/compile/reachability.test.ts:126]
- [ ] [Review][Patch] Add the missing call-input scalar-descent half of Decision 6
  [tests/compile/reachability.test.ts:144]
- [ ] [Review][Patch] Pin Decision 8's permissive non-empty response-header tail behavior
  [tests/compile/reachability.test.ts:209]
- [ ] [Review][Patch] Correct the learning-path claims that the real resolver replaces the stub and that
  unwired checks already catch failures before evaluation
  [_bmad-output/project-knowledge/learning-path-step-by-step.md:823]
- [ ] [Review][Patch] Add `deferred-work.md` to the Dev Agent Record file list
  [_bmad-output/implementation-artifacts/4-1-pointer-resolution-and-reachability.md:1217]

## Decisions taken during story creation

Each is settled with a stated default and its downstream consequence. Per this project's standing
convention (settle ambiguities in the story or the code, record the reasoning, do not escalate to a new
architecture revision), proceed unless the user amends one; record the outcome in the Dev Agent Record.

1. **The existing `tests/evaluate/fixtures/stub-resolver.ts` is left untouched, and `resolution.test.ts`/
   `operators.test.ts` are not migrated to the real resolver.** The stub's own header already frames itself
   as a deliberately simplified stand-in for this story's eventual work. Considered and rejected: replacing
   it now that the real thing exists, on the reasoning that one implementation is simpler to reason about
   than two. Rejected because `resolution.test.ts`'s own fixtures test connective and quantifier *dispatch*
   logic, not pointer-walking fidelity, and migrating `resolution.test.ts` and `operators.test.ts` (1357 and
   761 lines, about 2100 combined) of already-passing, already-reviewed tests to a new dependency is unscoped
   churn against Story 3.1-3.3's own settled work for no behavioral gain. **Consequence:** two
   `ResolveOperand` implementations coexist by design: the stub for dispatch-logic tests, the real one (this
   story) for addressing-grammar tests and, eventually, score-side production use.

2. **`decodeBoundElementTail` special-cases the bare `@/` input rather than feeding `pointer.slice(1)`
   straight into `decodeTail`.** `decodeTail`'s own contract treats a truly empty string as "zero tokens" and
   anything else as "a leading slash plus at least one token." `pointer.slice(1)` on the bare form `@/`
   produces the single character `"/"`, not `""`, so a direct pass-through decodes to `['']` (one empty-string
   token) rather than `[]` (zero tokens), and `walkTail` would then look up a literal empty-string key on the
   bound element instead of returning the bound element itself. AD-26's own text is explicit that bare `@/`
   "addresses the element itself." Considered and rejected: changing `decodeTail` itself to special-case a
   lone `"/"`. Rejected because `decodeTail` is shared with the interaction-rooted pointer parser in
   `plan-index.ts`, where a lone `"/"` never arises (a channel with no tail captures the empty string, not a
   slash), and special-casing it there would be a change to already-shipped, already-tested code for a
   condition that function never actually meets. **Consequence:** `decodeBoundElementTail` is its own small
   function, used everywhere `makeResolveOperand` decodes a `@/` pointer; AC 6 fixture 10 pins all three
   shapes (`@/`, `@/x`, `@/a/b`) directly.

3. **`makeResolveOperand`'s two map lookups (`referenceSets`, `stepObservations`) use `Object.hasOwn` before
   indexing, never `map[key] ?? ABSENT`.** `Identifier`'s own regex (`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`) admits
   `constructor` as a legal reference-set identifier or step id, and a plain-object index on a missing
   `constructor` key returns the inherited `Object.prototype.constructor` function, which is not `undefined`
   and not nullish, so `?? ABSENT` never fires and the resolver would silently return a function where AD-26
   requires `ABSENT`. Considered and rejected: building both maps with `Object.create(null)` at the call site
   instead, which would also close the gap. Rejected because that pushes a defensive requirement onto every
   future caller of `makeResolveOperand` rather than onto the one function that owns the lookup, and a
   caller-supplied plain object literal (`{ 'expected-things': [...] }`, this codebase's own convention
   everywhere else, including the existing stub resolver) is exactly the shape this function should accept
   without imposing a special construction rule. **Consequence:** both lookups guard with `Object.hasOwn`
   before indexing, with an `as` cast after the guard proves the key present, the same pattern Story 3.3's
   `keyValueOf` and its own reviewed fix already established; AC 6 fixtures 13-14 pin the `constructor` case
   on both the reference-set and the interaction-pointer path.

4. **A pointer rooted at a declared step whose own `operationId` names no declared operation fails
   `unreachable-check-evidence`, even though the schema-admission suite separately documents that exact
   dangling-`operationId` shape as carrying "no AD-5 code" when nothing references it.** AD-19/AD-26's own
   language for this code is "evidence unreachable through the declared interfaces": a step whose operation is
   not declared has no declared interface behind it at all, so a pointer addressing it is unreachable in the
   plainest reading of that sentence. Considered and rejected: treating a dangling `operationId` as entirely
   out of this story's scope. Rejected because the existing schema-admission fixture
   (`ad5-admissions.test.ts`, "admits a step naming an operation the inventory does not declare") never
   attaches an oracle to the dangling step, so it stays true under this story's behavior regardless; there is
   no fixture this decision breaks, only one this decision goes further than, and going further is the more
   fail-closed reading of an already-coded rule rather than the invention of a new one. **Consequence:**
   `evaluatePointerReachability`'s `operation === undefined` branch fires the same code as every other
   reachability failure; AC 6 fixture 33 pins it.

5. **Reachability against a `response-body`/`call-inputs` field checks membership in `requiredKeys ∪
   permittedKeys`, not `permittedKeys` alone.** `KeyedShapeDescriptor.permittedKeys`'s own schema comment
   states it is "the closed set of keys the shape admits" and is "deliberately not refined to be a superset of
   `requiredKeys`," a known, separately schema-admitted gap (`ad5-admissions.test.ts`: "admits a descriptor
   whose permitted keys do not cover its required keys"). Considered and rejected: checking `permittedKeys`
   alone. Rejected because doing so would let that pre-existing, already-accepted authoring gap produce a
   second, spurious defect: rejecting a field the descriptor's own `requiredKeys` unambiguously declares
   present, merely because its separately unenforced `permittedKeys` happens not to repeat it.
   **Consequence:** both reachability branches test the union; AC 6 fixture 36 pins the case where
   `permittedKeys` alone would give the wrong answer.

6. **A pointer descending past a field the descriptor declares a definite scalar type (`string`, `number`,
   `boolean`, or `null`) fails reachability; an undeclared or type-not-stated field stays permissive.** The
   declared response descriptor and request shape are flat: neither names any structure below the first key,
   so a compiler can never validate a *second* tail level against a declared nested shape. It can, however,
   rule out descent entirely where the first level is a known scalar, since a scalar has no field to descend
   into regardless of what the tail names. Considered and rejected: leaving every tail past the first token
   unchecked, on the reasoning that "the descriptor is flat" means nothing past the first key is ever
   decidable. Rejected because that conflates "not decidable in full" with "not decidable at all": a declared
   scalar type is itself a complete answer for the one question this check can ask (can anything be below
   this key), and skipping it would pass a pointer that any conforming resolver, given the declared type,
   provably resolves `ABSENT`. **Consequence:** `descendsIntoDeclaredScalar` gates both the `response-body`
   and `call-inputs` branches; an undeclared or `null`-typed (type not stated) first field stays permissive,
   matching the same "under-declaration costs coverage, not correctness" default the rest of this check
   already applies; AC 6 fixture 37 pins both the rejection and the permissive contrast.

7. **A `response-body` pointer indexing directly into a root-declared collection
   (`collectionLocations[].pointer === ''`) is reachable without a `requiredKeys`/`permittedKeys` check.** A
   root collection location means the operation's response body is itself a bare JSON array; `requiredKeys`
   and `permittedKeys` name object fields and have nothing to say about an array index, so applying the
   ordinary object-key check to this shape would always fail a legitimate pointer. Considered and rejected:
   leaving this case unhandled, since a response shaped as a bare array is an unusual, if schema-legal, case.
   Rejected because "unusual but legal" is exactly the shape a compile-time check exists to get right, and the
   fix (checking whether a declared collection location's own pointer is the empty string, and if so admitting
   an array-index tail directly) costs one small branch reusing `ARRAY_INDEX_PATTERN`, the same grammar the
   real resolver walks (Decision 9's own parity concern). **Consequence:** the `response-body` branch checks
   for a root collection location before applying the object-key check; AC 6 fixture 38 pins both the
   root-declared-collection pass and the mirror case (no root declared) still failing over the identical
   pointer.

8. **`response-headers`, `response-status`, and `exit-code` stay reachable unconditionally once step and
   operation resolve, with no further check; `stdout`/`stderr` reject any non-empty tail outright.** These
   five channels split into two genuinely different cases, not one. `interface.ts`'s `Operation` schema
   declares a shape for exactly `response-body` and, per transport, `call-inputs`; nothing declares a shape
   for headers, status, or exit code, so those three get the same "no declared shape, no further check"
   treatment reachability applies everywhere under-declaration exists. `stdout`/`stderr` are different in
   kind, not merely undeclared: `sealed-run-record.ts`'s own `Observation` schema types both fields as a bare
   `string | null` unconditionally, so no conforming resolver can ever produce anything but `ABSENT` for a
   tail into either, regardless of what any contract declares. Considered and rejected: treating all five
   channels identically as "no shape, no check," which an earlier draft of this story did. Rejected because
   that earlier framing conflated "the compiler cannot tell" with "the compiler can prove the answer is
   always the same," and a check that can prove a pointer is always unreachable and does not say so is
   leaving a real, decidable defect unreported. **Consequence:** `evaluatePointerReachability` special-cases
   `stdout`/`stderr` before falling through to the permissive default the other three channels still use; AC
   6 fixture 39 pins the rejection, and fixture 40 pins the three genuinely-undeclared channels staying
   permissive.

9. **A `@/` pointer used outside any quantifier's predicate fails `malformed-operator-expression`.** epics.md's
   own acceptance criterion for this story states "`@/` binds only inside quantifiers" in the same sentence as
   `unreachable-check-evidence`, so enforcing it is this story's required scope rather than a discretionary
   addition. `pointer.ts`'s own `BoundElementPointer` doc names the rule as "a compile-time check (Story
   4.1), not a schema check," but AD-5's registry table gives it no dedicated code of its own.
   `malformed-operator-expression`'s own "Fires when" text reads "wrong arity, an operand type the operator
   does not accept, or a rejected regex construct," cited by both AD-4 and AD-26; a `@/`-form pointer outside
   the one position AD-4 admits it (a quantifier's own predicate subtree) is exactly "an operand type the
   operator does not accept," the identical framing the spine text already applies to a reference-set operand
   outside its own three legal positions under this same code. Considered and rejected: escalating the
   missing dedicated code as a spine question before proceeding. Rejected under this project's standing
   convention against opening a new architecture revision for a gap construction can settle, and because the
   analogy to the reference-set case is exact rather than approximate. **Consequence:** `checkBoundElementScope`
   fires `'malformed-operator-expression'`; AC 6 fixtures 43 and 45 pin it, and fixture 44 pins the one shape a
   naive implementation could get wrong in the opposite direction.

10. **Both compile-time checks throw on the first violation found rather than collecting every violation into
    an array, and this story does not claim a future orchestrator can recover every violation by simply
    wrapping either function in a single try/catch.** This codebase's one existing precedent for a
    structural-failure thrower, `auditBriefScripting` (`scripting-audit.ts`), throws a single error, and
    `StructuralFailure` itself models one failure rather than a collection; matching that shape keeps these
    two new functions callable the same way as the one that already exists. An earlier draft of this story
    additionally claimed that "an eventual `compile()` that wants every violation… can already do that itself
    by calling each function inside its own try/catch." That overstates what a single try/catch buys:
    wrapping `checkEvidenceReachability` once recovers only the *first* violation the function itself
    encounters before its own internal throw stops the walk, not every violation the contract actually
    contains; recovering all of them needs either a fix-one-rerun loop (catch, note the failure, ask the
    caller to fix that one pointer, run again) or a future collecting variant this story does not build.
    **Consequence:** `checkBoundElementScope`/`checkEvidenceReachability` both return `void` and throw once;
    AC 6 fixture 41 pins the first-violation-wins behavior so a future orchestrator's author does not assume
    a single wrapped call recovers a complete list.

11. **A quantifier's own `collection` operand is evaluated in whatever bound-element scope was already open,
    never a freshly-reset one, so a nested quantifier's `collection` field can legally carry a `@/` pointer
    referencing the outer bound element.** This is not a new rule invented for this story: `resolution.ts`'s
    own `resolveQuantifier` already implements it at runtime, resolving `collection` "against whatever
    `boundElement` was already in scope… an outer quantifier's element if nested, `ABSENT` at the root."
    Considered and rejected: resetting the bound-element context to "outside" every time a `collection` field
    is visited, on the reasoning that `collection` is structurally a sibling of `predicate` and should share
    its scoping treatment. Rejected because it would make `checkBoundElementScope` disagree with
    `resolveNode`'s own already-shipped runtime behavior on the identical shape, rejecting at compile time a
    pointer the scorer would resolve correctly at runtime, exactly the false positive this story's own user
    story exists to prevent ("the reachability check and any future evaluator read the same expression
    identically"). **Consequence:** `visitExpression`'s `for-all`/`for-any` branch visits `collection` at the
    current `insideQuantifier` value, not a reset one; AC 6 fixture 44 pins it, reusing the exact fixture
    shape `ad5-admissions.test.ts` already ships for an unrelated code.

12. **`makePointerDenotesCollection` and `checkEvidenceReachability` both build their `PlanIndex` lazily, on
    first use, rather than eagerly at construction.** Neither `InteractionStep.stepId` nor `Operation.operationId`
    carries a uniqueness constraint in the schema, and `buildPlanIndex` (already-shipped, unchanged by this
    story) throws a plain `TypeError` on a duplicate of either. Built eagerly, that throw would fire before a
    caller ever asks either function a real question: `makePointerDenotesCollection`'s factory call would
    throw before its documented graceful-boolean contract applies to a single pointer, and
    `checkEvidenceReachability` would throw over an unrelated duplicate even against a contract with zero check
    pointers to examine. Considered and rejected: leaving both eager, on the reasoning that `seal.ts` already
    calls `buildPlanIndex` eagerly with no complaint, so this story's own two new callers should match that
    precedent exactly. Rejected because `seal.ts`'s own call sits inside a stage that is already committed to
    processing the whole contract regardless, while `makePointerDenotesCollection`'s own documentation
    promises a graceful per-pointer predicate and `checkEvidenceReachability` should not fail a contract with
    nothing to check over a defect unrelated to what it actually validates. Building lazily does not remove
    the throw: a contract that genuinely carries a duplicate id and is actually queried still throws, exactly
    as `buildPlanIndex` and every other consumer of it already accept; it only defers the throw to the point
    where the ambiguity actually matters. **Consequence:** both functions hold a `let index: PlanIndex |
    undefined` and populate it with `??=` on first use; no new fixture is required beyond the existing
    positive fixtures already exercising both functions end to end, since a lazily-built index behaves
    identically to an eagerly-built one for every contract without a duplicate id.

13. **Each thrown `StructuralFailure`'s `artifactPath` names the exact operand position within the offending
    oracle's `check` tree, not only the oracle itself.** `scripting-audit.ts`'s own precedent
    (`auditBriefScripting`) names only a field (`direction.text`), not a position within it, because its own
    check has no tree to descend into. This story's check trees are recursive and can be many operands deep,
    and AD-5 states every code "carries the artifact path that produced it." Considered and rejected: matching
    `scripting-audit.ts`'s coarser granularity exactly, naming only `EvalContract.oracles[id=...].check` for
    every violation regardless of where inside the tree it occurred. Rejected because a multi-operand check
    tree with one bad pointer among several is exactly the case where "which operand" is the information a
    reader needs, and the tree walk already visits each operand's position on its way to finding the pointer,
    so tracking it costs one extra string parameter threaded alongside `insideQuantifier`, not a second pass.
    **Consequence:** `visitExpression`/`visitOperand` build a path string (`.operands[0]`, `.collection`,
    `.predicate.operands[1]`, and so on) as they recurse; both public checks append it to the oracle's own
    path segment; AC 6 fixture 42 pins two distinct nested positions.

14. **This story does not bound the check-tree walk's recursion depth.** `Expression`'s own recursive shape
    admits arbitrary nesting depth (bounded in practice only by `quantifier-nesting-exceeded`, a different,
    not-yet-built code), and Story 3.2's own Decision 12 already recorded the identical class of gap as "open,
    unowned" for `resolution.ts`'s structurally identical recursive walk. Considered and rejected: converting
    `visitExpression` to an iterative, explicit-stack walk so a pathological tree fails predictably rather
    than exhausting the call stack. Rejected as disproportionate scope for this story: no other tree-walker in
    this codebase (`resolveNode`, `renderEvidenceReferences`) is iterative either, a bound on tree depth or
    node count is explicitly out of scope everywhere else it has come up, and rewriting one walker
    iteratively while every sibling stays recursive would produce an inconsistency of its own with no
    matching precedent. **Consequence:** an unusually deep check tree throws a plain `RangeError` from stack
    exhaustion rather than a coded `StructuralFailure`; this is named here as an inherited, unfixed gap
    (AC 1 point 9) rather than left undocumented.

## Dev Notes

### Read these files before writing anything

1. `src/core/seal/plan-index.ts` and `derived-reference.ts`, in full: the addressing-grammar parser and
   plan-lookup index this story reuses rather than rebuilds (AC 1). `parseEvidenceTarget`'s own
   `EvidenceTarget` shape is what both new modules key every branch on.
2. `src/core/evaluate/resolution.ts`, in full: the `ResolveOperand`/`PointerDenotesCollection` consumer
   contract (its own header names this story explicitly), `resolveQuantifier`'s bound-element scoping rule
   (Decision 11), and Story 3.2/3.3's "assumed compile-time-prevented" convention this story's own resolver
   also relies on.
3. `src/core/evaluate/operators.ts`: `keyValueOf`'s `Object.hasOwn` guard, the pattern `walkTail` and the two
   map lookups in `makeResolveOperand` all copy (Decisions 2, 3).
4. `src/core/seal/scripting-audit.ts`: `auditBriefScripting`, the one existing `StructuralFailure`-throwing
   precedent both this story's compile-time checks match (fail-fast, single throw, Decision 10), and its own
   `artifactPath` string convention (`` `Type.field[key=value].leaf` ``), which this story extends with an
   operand-position suffix (Decision 13).
5. `src/core/schemas/interface.ts`: `ResponseDescriptor`, `RequestShape`, `Operation`. Confirm which channels
   carry a declared shape and which do not (Decision 8), and how `types`/`collectionLocations` are keyed
   (Decisions 6, 7) before writing `evaluatePointerReachability`'s branches.
6. `src/core/schemas/sealed-run-record.ts`: `Observation`, `ObservedCallInputs`. This is the per-step
   evidence shape `makeResolveOperand` walks, already built by Story 1.4, not a new type this story invents.
7. `src/core/schemas/pointer.ts`: `EVIDENCE_CHANNELS`, `TRANSPORT_CHANNELS`, the tail-bearing/scalar
   partition, `BOUND_ELEMENT_POINTER_PATTERN` (the exact regex behind Decision 2), and `BoundElementPointer`'s
   own doc comment (the sentence assigning the `@/`-scope rule to this story).
8. `tests/schemas/ad5-admissions.test.ts`: the two `unreachable-check-evidence` schema-admission fixtures
   this story's own reachability check now rejects, and every admitted-shape entry naming a code this story
   explicitly does not build (AC 1), so a reviewer can tell a deliberate scope boundary from an oversight.
9. `tests/evaluate/fixtures/stub-resolver.ts`: read, do not edit (Decision 1). The contrast between its ad
   hoc pointer walk and this story's RFC-6901-correct one is what AC 6's early fixtures pin.
10. `tests/schemas/fixtures/relevance-contracts.ts` and `gate-c-contract.ts`: `populatedContract` and
    `gateCContract` are this story's own two positive whole-contract regression fixtures (AC 6 fixtures
    29-30). Read both fully to reuse their step ids, operation ids, and declared shapes accurately in every
    negative mutation fixture.
11. `_bmad-output/implementation-artifacts/3-3-covers-by-key-as-a-bijection.md`: house style, and the
    `Object.hasOwn`/precondition-`TypeError`/"assumed compile-time-prevented" conventions this story inherits
    without restating their own reasoning.

### Project structure notes

- Two new files (`src/core/evaluate/evidence-resolution.ts`, `src/core/compile/reachability.ts`), two new
  test files (`tests/evaluate/evidence-resolution.test.ts`, `tests/compile/reachability.test.ts`), two
  one-declaration edits (`plan-index.ts`'s two exports, `sealed-run-record.ts`'s one type export). No file
  this story touches is deleted or renamed.
- `core/compile/` is a new top-level directory under `src/core/`, matching `core/evaluate/`, `core/seal/`,
  `core/canonical/`'s own existing pattern; `failure-codes.ts`'s own header comment already names this
  directory as where it belongs.
- No `core/schemas/` edit beyond the one `export type` addition: no new declaration, no new value space, no
  spine text implicated.
- `src/index.ts` not touched (AC 7), same rule as every Epic 3 story.

### Testing requirements

- `tsconfig.json`'s `noUncheckedIndexedAccess` applies to every array index in the new code
  (`target.tail[0]`, `current[index]` inside `walkTail`) and to every object-map index this story's own
  `Object.hasOwn` guards precede; guard each with an explicit check or an `as` cast after the guard, matching
  the pattern this story's own code blocks show.
- `biome.json`'s `useImportType`/`useExportType`: `EvidenceTarget`, `Observation`, `EvalContract`,
  `ResolveOperand`, `PointerDenotesCollection`, `Expression`, `Operand`, `PlanIndex` are type-only imports
  everywhere they are used only as types.
- No configured coverage threshold, matching every prior story's own note: the proxy is AC 6's fixture list
  plus assertions specific enough to fail if the property they name is removed.

### References

- `_bmad-output/planning-artifacts/epics.md`: Epic 4 intro (321-323), Story 4.1 (325-335).
- `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md`:
  AD-5 (203-241, the registry table and `malformed-operator-expression`/`unreachable-check-evidence` rows),
  AD-19 (327-339, the response descriptor and request shape declarations reachability reads), AD-26
  (384-392, the addressing grammar in full).
- `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/EPIC-BRIEF.md`: Epic 4
  (112-131).
- `src/core/seal/plan-index.ts`, `derived-reference.ts`, `scripting-audit.ts`.
- `src/core/evaluate/resolution.ts`, `operators.ts`, `resolved-value.ts`.
- `src/core/schemas/pointer.ts`, `interface.ts`, `plan.ts`, `expression.ts`, `eval-contract.ts`,
  `sealed-run-record.ts`.
- `tests/schemas/ad5-admissions.test.ts`, `tests/schemas/fixtures/relevance-contracts.ts`,
  `tests/schemas/fixtures/gate-c-contract.ts`, `tests/evaluate/fixtures/stub-resolver.ts`.
- `_bmad-output/implementation-artifacts/3-3-covers-by-key-as-a-bijection.md`.

## Suggested Review Order

**The reused parser first, to confirm nothing was duplicated**

- `plan-index.ts`'s diff: exactly two `export` keywords added, one doc comment updated, nothing else. Any
  larger diff here is out of scope.

**The two decode fixes, because they are the two places a small off-by-one produces a silently wrong answer**

- `decodeBoundElementTail`: confirm the bare `@/` case specifically (Decision 2), against AC 6 fixture 10.
- The `Object.hasOwn` guards on both map lookups in `makeResolveOperand` (Decision 3), against AC 6 fixtures
  13-14: confirm a missing `constructor` key resolves `ABSENT`, and a genuine own `constructor` key resolves
  its actual value.

**The real resolver's walk**

- `walkTail`: RFC 6901 correctness, specifically the array-index token grammar (reject `"01"`, `"+1"`, and
  the `"-"` token; accept `"0"` and canonical positive integers), the `Object.hasOwn` guard's own two-sided
  correctness (fixture 9), and scalar-descent-is-ABSENT.
- `channelRoot`: all seven channels, and Decision 8's split between the three genuinely-undeclared channels
  and stdout/stderr's provably-always-scalar shape.

**The two compile-time checks**

- `visitExpression`'s `for-all`/`for-any` branch specifically: verify `collection` is visited at the
  inherited `insideQuantifier` value, not a reset one (Decision 11). This is the one place a plausible, wrong
  implementation would pass every fixture except 44.
- `evaluatePointerReachability`'s branch order: the root-collection carve-out (Decision 7) checked before the
  ordinary key check, the scalar-descent check (Decision 6) checked after it, and the stdout/stderr special
  case (Decision 8) checked before either. Verify against fixtures 37-39 specifically.
- Both checks' lazy index construction (Decision 12): confirm neither throws at factory/call-entry time over
  an unrelated duplicate id when nothing in the contract actually needs the index yet.
- The `artifactPath` threading (Decision 13): confirm fixture 42's two distinct nested positions render
  correctly.
- Both checks' fail-fast behavior (Decision 10): fixture 41 specifically, two independently-unreachable
  oracles in one contract, asserting only the first is named in the thrown error, and that Decision 10's own
  corrected limitation statement matches what the code actually does.

**Fixtures**

- The two whole-fixture positive regressions (fixtures 29-30): the load-bearing proof that neither check
  produces a false positive against real, already-shipped, already-passing check trees.
- The parity-matrix fixtures (46-47): confirm every pointer the compile-time check rejects, the runtime
  resolver also fails to resolve to a concrete value, and vice versa.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5), via Claude Code.

### Debug Log References

- Preflight baseline (before the first edit): `npm run check:docs` → "53 file(s) OK"; `npm test` → 35
  files, 1533 tests passing.
- Post-implementation: `npm run validate` green end to end — typecheck, lint (one pre-existing biome
  schema-version info, unrelated to this story and present on `biome.json` before any edit here),
  `check:docs` (53 files, unchanged), `check:shareable`, `lint:spine` (0 findings), `check:vectors`,
  `check:schemas`, `check:ad5-registry` (21 codes, set- and order-equal), and `npm test` → 37 files,
  1581 tests passing (35→37 files, 1533→1581 tests: exactly the two new test files and 48 new fixtures
  this story adds, 29 in `evidence-resolution.test.ts` and 19 in `reachability.test.ts`).
- Post-review (see Review Findings below): `npm run validate` re-run green end to end, same shape as
  above; `npm test` → 37 files, 1584 tests passing (1581→1584: the three review-added fixtures in
  `reachability.test.ts`, which now carries 22 tests).

### Completion Notes List

- Implemented exactly the code in AC 2-5 as specified, verbatim aside from Biome's own reflow (line
  wraps and import-statement ordering only; confirmed no logic changed by re-diffing against the
  spec's code blocks after `biome check --write`).
- All 14 decisions in "Decisions taken during story creation" were taken as stated; none moved from
  its recorded default.
- Implemented all 47 AC 6 fixtures. Fixture 9 (the `__proto__`/`constructor` own-property case) is
  split into two `it` blocks, one per key, for a clearer failure message per key; every other fixture
  is one `it` block. Total: 29 tests in `tests/evaluate/evidence-resolution.test.ts` (fixtures 1-28,
  with fixture 9 counted twice), 19 tests in `tests/compile/reachability.test.ts` (fixtures 29-47).
- For the parity-matrix fixtures (46-47), built each pointer/contract/observation-map case
  individually rather than literally reusing `gateCContract`/`populatedContract` unmutated throughout:
  several of the named shapes (undeclared operation, scalar descent, root-collection index, the
  escaped-key case) need a small mutation to exist at all in either base fixture. Each case still
  cites which numbered fixture's shape it reuses, and one case (scalar descent) is sourced from
  `gateCContract` specifically so the matrix exercises both base fixtures, not only
  `populatedContract`.
- `EvalContract.parse(...)` (not a type cast) is used wherever a genuinely `EvalContract`-typed value
  is needed without mutation (the fixtures-29/30 positive regressions, and one parity-matrix case
  sourced from `gateCContract`), matching the existing `tests/seal/seal.test.ts` idiom. A direct `as
  EvalContract` cast on `populatedContract`/`gateCContract` does not typecheck: both fixtures are
  declared `satisfies EvalContract`, and the resulting literal-union type Zod infers for their
  `operations[]` array does not structurally cast to `EvalContract` directly (a pre-existing property
  of `satisfies`-typed fixtures in this codebase, not something this story's own code introduced).
  Every mutated contract clone instead follows `tests/schemas/ad5-admissions.test.ts`'s own
  `structuredClone(...) as any` convention, which sidesteps the same issue by construction.
- No AC, Task, or Decision was left incomplete. Nothing in `src/index.ts` was touched. No existing
  `src/` file's behavior changed: the only edits to already-shipped files are the two `export`
  keywords and one doc-comment update in `plan-index.ts` (AC 2) and the one `export type Observation`
  addition in `sealed-run-record.ts` (AC 2).

### Review Findings

Internal review (blind-hunter + edge-case-hunter + verification-gap) ran against this story's diff.
Five findings were real and trivially fixable; all five are applied. Every other finding was rejected
as by-design/out-of-scope, or deferred.

**Applied:**

1. `reachability.ts`: `visitExpression`'s default-branch comment miscounted its own listed ops as
   "nine" when it lists ten (equality, deep-equality, containment, existence, absence, regex,
   ordering, count-tolerance, shape, covers-by-key). Fixed to "ten".
2. `reachability.ts`: `SCALAR_TYPES` was a second, independently-spelled copy of a subset of
   `JsonTypeName`'s six-member value space (`primitives.ts`). Now derived from
   `JsonTypeName.options`, filtering out the two compound types (`object`, `array`), so the two can
   never drift apart, the same anti-duplication convention this story already applies to
   `decodeToken`/`decodeTail`.
3. `evidence-resolution.ts`: `makeResolveOperand`'s returned closure silently dropped
   `ResolveOperand`'s third `artifactPath` parameter. Added it back as `_artifactPath`, matching
   `operators.ts`'s own stated convention ("every function takes `artifactPath: string` last, even
   when unused"). No behavior change; the parameter stays unused.
4. `reachability.test.ts`: added the base-case complement to fixture 44. Fixture 44 proves a *nested*
   quantifier's `collection` may legally inherit the outer bound element; the new fixture proves a
   *top-level* quantifier's own `collection` (nothing enclosing it) is not itself inside quantifier
   scope, and a `@/` pointer there throws `malformed-operator-expression`.
5. `reachability.test.ts`: added a dedicated `set-membership` fixture for each check.
   `visitExpression`'s `set-membership` case is special-cased to visit only `operands[0]`; no prior
   fixture exercised that branch specifically, so a regression there (wrong operand, or skipped
   entirely) would have gone undetected. One fixture proves `checkEvidenceReachability` walks it (an
   unreachable pointer in `operands[0]` throws), one proves `checkBoundElementScope` walks it (a
   `@/` pointer there, outside any quantifier, throws).

All five are additive: no AC 6 fixture's assertion changed, and `tests/compile/reachability.test.ts`
grew from 19 to 22 tests (fixtures 29-47 plus the three new ones above), `tests/evaluate/
evidence-resolution.test.ts` unchanged at 29.

**Rejected (by-design or out of scope), one later closed:**

- The root-collection index carve-out did not validate the literal index against the declared
  collection's own `expectedCardinality`. Real gap, but not this story's declared scope (AC 1 never
  names collection-cardinality reachability, and AC 6 fixture 38 only proved the carve-out fires when
  declared, not that it bounds the index), so it was deferred to `deferred-work.md`. A later pass in
  this same session closed it directly in `evaluatePointerReachability` (the root-collection branch
  now resolves the `expectedCardinality` and rejects an index at or past its bound), with fixture 38b
  added to `tests/compile/reachability.test.ts`; see `deferred-work.md`'s own closure note for the
  full account.
- Every other finding matched an existing named exclusion or decision on record in this story
  (AC 1's "what this story does not build" list, or one of the 14 numbered Decisions above) and was
  rejected on that basis rather than re-litigated here.

### File List

- `src/core/evaluate/evidence-resolution.ts` (new)
- `src/core/compile/reachability.ts` (new)
- `src/core/seal/plan-index.ts` (edited: `decodeToken`/`decodeTail` exported, doc comment updated)
- `src/core/schemas/sealed-run-record.ts` (edited: `export type Observation` added)
- `tests/evaluate/evidence-resolution.test.ts` (new)
- `tests/compile/reachability.test.ts` (new)
- `_bmad-output/project-knowledge/learning-path-step-by-step.md` (edited: Step 12 row and section added)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (edited: this story's status → `review`)
