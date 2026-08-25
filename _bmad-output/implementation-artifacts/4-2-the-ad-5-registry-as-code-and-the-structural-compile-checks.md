---
epic: 4
story: 2
key: 4-2-the-ad-5-registry-as-code-and-the-structural-compile-checks
baseline_commit: 3970062e0e9c82f89b4b103e89d153adf88cd9c6
---

# Story 4.2: The AD-5 registry as code and the structural compile checks

Status: done

## Story

As every AD that names a blocking code,
I want the registry implemented as the single generated-from source with each structural check emitting its literal code,
so that two compilers cannot invent incompatible failure vocabularies.

## Acceptance Criteria

### AC 1: Module location, scope, and what this story does not build

**Five new modules under `src/core/compile/`, thirteen new exported check functions across twelve of AD-5's twenty-one codes. No existing `src/` behavior changes.**

- `src/core/compile/declarations.ts` (new): `checkRequirementLinkage` (`missing-requirement-linkage`), `checkObservableSuccessCriterion` (`no-observable-success-criterion`). AD-19's two per-behaviour declaration checks.
- `src/core/compile/oracle-alignment.ts` (new): `checkOracleChannel` (`oracle-missing-channel`), `checkOracleAlignment` (`direction-check-misaligned`). AD-3's oracle-direction checks; the second is the "containment computed after quantifier substitution" work both `epics.md` and `EPIC-BRIEF.md` name explicitly as this epic's, unclaimed by any other Epic 4 story.
- `src/core/compile/expression-legality.ts` (new): `checkOperandLegality` and `checkRegexConstructs` (both `malformed-operator-expression`, completing what Story 4.1 left open), `checkQuantifierOverNonCollection` (`quantifier-over-non-collection`), `checkQuantifierNesting` (`quantifier-nesting-exceeded`), `checkReferenceSetResolution` (`unresolved-reference-set`). The biggest module: all five share one tree-walk over `check`.
- `src/core/compile/interface-inventory.ts` (new): `checkInterfaceKind` (`unsupported-interface-kind`), `checkDuplicateOperationSignature` (`duplicate-operation-signature`), `checkUndeclaredMandatoryInput` (`undeclared-mandatory-input`).
- `src/core/compile/waivers.ts` (new): `checkWaiverCompleteness` (`waiver-incomplete`).

**What this story reuses rather than rebuilds. Read `reachability.ts` and `evidence-resolution.ts` in full before writing anything.** Story 4.1 already built and shipped the infrastructure every module above sits on:

- `StructuralFailure`/`FAILURE_CODES` (`core/failure-codes.ts`): unchanged. AD-5's "registry as code" half is Story 4.1's own scaffolding, already complete — the tuple, `scripts/check-ad5-registry.ts`'s drift check against the spine table, and `StructuralFailure.code: FailureCode` typing every thrower against it. No artifact schema anywhere carries a compile-time failure code as a data field (compile-time failures are thrown, never serialized), so "the published schema's failure-code enumeration is generated from this table" is satisfied exactly as it already is: one TypeScript source (`FAILURE_CODES`) both the spine-drift check and every `StructuralFailure` call site read. This story adds no new wiring here, only new callers of the existing `StructuralFailure` constructor.
- `parseEvidenceTarget`, `buildPlanIndex`/`PlanIndex`, `decodeTail` (`core/seal/plan-index.ts`): reused unchanged for every pointer parse and step/operation lookup below.
- `makePointerDenotesCollection` (`core/evaluate/evidence-resolution.ts`): reused directly by `checkQuantifierOverNonCollection` rather than reimplementing the root-collection carve-out `reachability.ts`'s own `evaluatePointerReachability` already got right in Story 4.1 (Decision 7 there). One function answering "does this pointer denote a declared collection" now has two callers instead of one.
- `EvalContract`, `Expression`, `Operand`, `SetOperand`, `Oracle`, `Waiver`, `Operation`, `PermittedInterface`, `InteractionStep` (all `core/schemas/`): read, never edited.

**What this story does not build, and why. Each is named rather than silently dropped:**

1. **`nested-temporal-clause`, `plan-exceeds-scripting-bound`.** Story 4.3's job (AD-39's graph predicate), per both `epics.md` and `EPIC-BRIEF.md`.
2. **`rubric-unanchored`, `rubric-evidence-unreachable`, `rubric-scores-reasoning-prose`.** Epic 6's job: FR15's own coverage-map row reads "Epic 1 (rubric schema), Epic 6 (rubric compile checks)" — never Epic 4. Story 4.1's AC 1 already named this same exclusion for the identical reason.
3. **`forbidden-input-floor-incomplete`, `scoped-reference-resolves-forbidden`.** AD-16 binds "brief emission, ingest, isolation-manifest validation" — never "compiler" — and Epic 4's own intro line in both planning documents names exactly five ADs it implements (AD-26, AD-5, AD-28, AD-34, AD-39); AD-16 is not among them. FR7's coverage-map row assigns AD-16 to Epic 2 alone. **Neither code has a thrower anywhere in `src/` today**, and Epic 2 is marked `done` in `sprint-status.yaml` — this is a real, pre-existing gap in Epic 2's delivered scope, surfaced here rather than silently worked around, but implementing it would be scope creep past Epic 4's own stated boundary. Recorded for visibility, not fixed in this story (per this project's standing convention: settle by construction and record the decision, do not widen an already-scoped story to close a different epic's gap).
4. **`brief-exceeds-scripting-bound`.** Already shipped: Story 2.3's `auditBriefScripting` (`core/seal/scripting-audit.ts`).
5. **`unreachable-check-evidence`, and the bound-element-scope slice of `malformed-operator-expression`.** Already shipped: Story 4.1's `reachability.ts`.
6. **A `compile()` orchestrating entry point, and any `strict`-mode flag threaded through these checks.** AD-34's "one orchestration layer" is Story 4.4's, exactly as Story 4.1's own AC 1 recorded for its two checks. AD-4 states strict mode is "selected only by explicit argument or flag" at the caller; whether `checkUndeclaredMandatoryInput` is even invoked is that future caller's decision, not a parameter on the function itself (Decision 6 below).
7. **A defined ordering across this story's thirteen new functions, or against Story 4.1's two.** Every function is independently correct for the one code it names; a contract invalid under two codes at once reports whichever code's function a caller reaches first. Story 4.4's orchestrator owns call order (Decision 7 below).
8. **Editing `check-ad5-registry.ts`, `failure-codes.ts`, or any spine text.** This story adds callers of existing codes; it adds no new `FailureCode` member and settles no new spine ambiguity.

**Purity (AD-1).** Every exported function is synchronous, deterministic, and pure: no I/O, no clock, no randomness. Cross-submodule imports within `core/` (`compile/` importing `evaluate/` and `seal/`) are the same already-established pattern Story 4.1 used for the identical reason.

### AC 2: `src/core/compile/declarations.ts`

AD-19's two per-behaviour checks. Both walk `contract.behaviors` once and throw on the first violation.

```ts
/**
 * AD-19's two per-behaviour declaration checks: `missing-requirement-linkage`
 * (a behaviour with neither a requirement nor a risk identifier) and
 * `no-observable-success-criterion` (a behaviour with no observable success
 * criterion at all — never on an empty oracle list, a separately legal shape
 * AD-19 states explicitly). Both walk `contract.behaviors` once and throw
 * `StructuralFailure` on the first violation, matching `reachability.ts`'s
 * fail-fast convention.
 */
import { StructuralFailure } from '../failure-codes.ts'
import type { EvalContract } from '../schemas/eval-contract.ts'

/** `missing-requirement-linkage`: both link arrays empty on one behaviour. */
export function checkRequirementLinkage(contract: EvalContract): void {
	for (const behavior of contract.behaviors) {
		if (
			behavior.requirementLinks.length === 0 &&
			behavior.riskLinks.length === 0
		) {
			throw new StructuralFailure(
				'missing-requirement-linkage',
				`EvalContract.behaviors[id=${behavior.id}]`,
				'declares neither a requirementLinks nor a riskLinks entry (AD-19)',
			)
		}
	}
}

/** `no-observable-success-criterion`: a `null` criterion. Never fires on an empty oracle list. */
export function checkObservableSuccessCriterion(contract: EvalContract): void {
	for (const behavior of contract.behaviors) {
		if (behavior.observableSuccessCriterion === null) {
			throw new StructuralFailure(
				'no-observable-success-criterion',
				`EvalContract.behaviors[id=${behavior.id}].observableSuccessCriterion`,
				'declares no observable success criterion (AD-19)',
			)
		}
	}
}
```

### AC 3: `src/core/compile/oracle-alignment.ts`

`checkOracleChannel` is a simple two-null-check. `checkOracleAlignment` is this story's most architecturally significant piece: AD-3's structural containment, computed **after quantifier substitution**, matching the spine's own worked example (`@/status` inside a `for-any` only contains a direction target once the bound variable is substituted against the quantifier's own `collection` pointer).

```ts
/**
 * AD-3's oracle-direction checks. `checkOracleChannel` fires
 * `oracle-missing-channel` when either half of an oracle's two required
 * channels — `direction` or `check` — is `null`. `checkOracleAlignment`
 * fires `direction-check-misaligned` when the direction's declared evidence
 * targets, relation, or polarity are not structurally contained in `check`,
 * computed after quantifier substitution rather than over surface pointer
 * text. `checkOracleAlignment` assumes `checkOracleChannel` already passed
 * and silently skips an oracle carrying a `null` direction or check,
 * matching `reachability.ts`'s own `forEachCheckPointer` precedent for the
 * identical precondition.
 */
import { StructuralFailure } from '../failure-codes.ts'
import type { EvalContract } from '../schemas/eval-contract.ts'
import type { Expression, Operand } from '../schemas/expression.ts'

export function checkOracleChannel(contract: EvalContract): void {
	for (const oracle of contract.oracles) {
		if (oracle.direction === null || oracle.check === null) {
			throw new StructuralFailure(
				'oracle-missing-channel',
				`EvalContract.oracles[id=${oracle.id}]`,
				`omits its ${oracle.direction === null ? 'direction' : 'check'} (AD-3)`,
			)
		}
	}
}

/**
 * Rewrites a `@/…` pointer against the fully-rooted pointer its enclosing
 * quantifier's bound element resolves to. Pure string substitution — never
 * decode/re-encode — since the raw tail source after "@" is already RFC 6901
 * -escaped exactly as written, so concatenating it onto `boundElementRoot`
 * reproduces valid escaping with no re-encoding step. `tailSource === '/'` is
 * bare `@/`, addressing the bound element itself (AD-26's own words);
 * appending it verbatim would add a spurious trailing slash, so it resolves
 * to `boundElementRoot` unchanged instead — the identical special case
 * Story 4.1's `decodeBoundElementTail` already carries (its own Decision 2).
 * `boundElementRoot === null` (a `@/…` pointer with nothing bound) returns
 * the pointer unrewritten: it will not match any declared evidence target,
 * the conservative, non-crashing answer for input outside this function's
 * own precondition (`checkBoundElementScope` and this story's own
 * `checkOperandLegality` own that condition).
 */
function substitutePointer(
	pointer: string,
	boundElementRoot: string | null,
): string {
	if (!pointer.startsWith('@')) return pointer
	if (boundElementRoot === null) return pointer
	const tailSource = pointer.slice(1)
	return tailSource === '/' ? boundElementRoot : `${boundElementRoot}${tailSource}`
}

function operandPointer(
	operand: Operand,
	boundElementRoot: string | null,
): string | null {
	if (!('pointer' in operand)) return null
	return substitutePointer(operand.pointer, boundElementRoot)
}

/**
 * Collects every fully-rooted pointer target and every `op` name appearing
 * anywhere in `expr`, substituting `@/…` pointers against whatever bound
 * element is open at each node. `boundElementRoot` starts `null` at the
 * check's own root; a `for-all`/`for-any` node re-derives it from its own
 * `collection` operand — itself substituted against whatever was already
 * open, so nested quantifiers compose — before descending into `predicate`.
 */
function collectTargets(
	expr: Expression,
	boundElementRoot: string | null,
	targets: Set<string>,
	ops: Set<string>,
): void {
	ops.add(expr.op)
	switch (expr.op) {
		case 'not':
			collectTargets(expr.operands[0], boundElementRoot, targets, ops)
			return
		case 'all':
		case 'any':
			for (const child of expr.operands)
				collectTargets(child, boundElementRoot, targets, ops)
			return
		case 'for-all':
		case 'for-any': {
			const collectionPointer = operandPointer(expr.collection, boundElementRoot)
			if (collectionPointer !== null) targets.add(collectionPointer)
			collectTargets(expr.predicate, collectionPointer, targets, ops)
			return
		}
		case 'set-membership': {
			const value = operandPointer(expr.operands[0], boundElementRoot)
			if (value !== null) targets.add(value)
			// operands[1] is a SetOperand, never a pointer: nothing further here.
			return
		}
		default:
			for (const operand of expr.operands) {
				const pointer = operandPointer(operand, boundElementRoot)
				if (pointer !== null) targets.add(pointer)
			}
	}
}

/** `direction-check-misaligned`: AD-3's structural containment, post-substitution. */
export function checkOracleAlignment(contract: EvalContract): void {
	for (const oracle of contract.oracles) {
		const { direction, check } = oracle
		if (direction === null || check === null) continue
		const targets = new Set<string>()
		const ops = new Set<string>()
		collectTargets(check, null, targets, ops)
		for (const target of direction.evidenceTargets) {
			if (!targets.has(target)) {
				throw new StructuralFailure(
					'direction-check-misaligned',
					`EvalContract.oracles[id=${oracle.id}].direction.evidenceTargets`,
					`"${target}" is not contained in check, even after quantifier substitution (AD-3)`,
				)
			}
		}
		if (!ops.has(direction.relation)) {
			throw new StructuralFailure(
				'direction-check-misaligned',
				`EvalContract.oracles[id=${oracle.id}].direction.relation`,
				`"${direction.relation}" does not appear anywhere in check (AD-3)`,
			)
		}
		if (direction.polarity !== oracle.polarity) {
			throw new StructuralFailure(
				'direction-check-misaligned',
				`EvalContract.oracles[id=${oracle.id}].direction.polarity`,
				`"${direction.polarity}" disagrees with the oracle's own polarity "${oracle.polarity}" (AD-3, AD-33)`,
			)
		}
	}
}
```

**Verified against every already-shipped oracle in both whole-contract fixtures before writing this AC**, not just asserted: `populatedContract`'s O-001 (`covers-by-key`, no quantifier) matches directly. `gateCContract`'s O-004 is the load-bearing proof the substitution is necessary at all — its direction target `/interactions/first-page/response-body/rows/retractedAt` appears **nowhere as raw text** in its check tree (`not(for-any(collection=.../rows, predicate=existence(@/retractedAt)))`); only substitution produces it (`.../rows` + `/retractedAt`). O-005's bare `@/` (`shape(@/)`) exercises the `tailSource === '/'` branch. O-002/O-003/O-007/O-008 are flat `all` trees where every target is literal, unaffected by substitution but proving the plain case still passes.

### AC 4: `src/core/compile/expression-legality.ts`

The largest module: `malformed-operator-expression`'s remaining scope (per-position operand-kind legality, and the two rejected regex constructs), `quantifier-over-non-collection`, `quantifier-nesting-exceeded`, and `unresolved-reference-set`. All five share one recursive walk over `check`, generalizing `reachability.ts`'s own `visitOperand`/`visitExpression`/`forEachCheckPointer` trio (which only ever needed to report a pointer site) to also report each operand's `op`/position and the live quantifier-nesting depth.

```ts
/**
 * AD-4/AD-26's remaining `check`-tree structural checks that Story 4.1 did
 * not build: the operand-type-per-position half of
 * `malformed-operator-expression` (4.1 only built the `@/`-scope half, in
 * `reachability.ts`), the two rejected regex constructs, `quantifier-over-
 * non-collection`, `quantifier-nesting-exceeded`, and `unresolved-reference-
 * set`. Each public function walks every oracle's `check` tree once and
 * throws `StructuralFailure` on the first violation it finds, matching
 * `reachability.ts`'s fail-fast convention. The walk itself is shared
 * through one small visitor — the same DRY shape `reachability.ts` already
 * uses between its own two checks — widened here to report op, operand
 * position, and quantifier-nesting depth alongside the operand.
 */
import { makePointerDenotesCollection } from '../evaluate/evidence-resolution.ts'
import { StructuralFailure } from '../failure-codes.ts'
import type { EvalContract } from '../schemas/eval-contract.ts'
import type { Expression, Operand, SetOperand } from '../schemas/expression.ts'
import { JsonTypeName } from '../schemas/primitives.ts'
import {
	buildPlanIndex,
	parseEvidenceTarget,
	type PlanIndex,
} from '../seal/plan-index.ts'

// ---- the shared walk --------------------------------------------------

type OperandPosition = 0 | 1 | 'collection'

type Visitor = {
	onOperand?: (
		operand: Operand,
		op: string,
		position: OperandPosition,
		path: string,
		quantifierDepth: number,
	) => void
	onSetOperand?: (setOperand: SetOperand, path: string) => void
	onQuantifier?: (
		expr: { op: 'for-all' | 'for-any'; collection: Operand; predicate: Expression },
		path: string,
		quantifierDepth: number,
	) => void
	onCoversByKey?: (path: string, quantifierDepth: number) => void
	onRegex?: (pattern: string, path: string) => void
}

function walkExpression(
	expr: Expression,
	quantifierDepth: number,
	path: string,
	visitor: Visitor,
): void {
	switch (expr.op) {
		case 'not':
			walkExpression(expr.operands[0], quantifierDepth, `${path}.operands[0]`, visitor)
			return
		case 'all':
		case 'any':
			expr.operands.forEach((child, index) =>
				walkExpression(child, quantifierDepth, `${path}.operands[${index}]`, visitor),
			)
			return
		case 'for-all':
		case 'for-any':
			visitor.onOperand?.(expr.collection, expr.op, 'collection', `${path}.collection`, quantifierDepth)
			visitor.onQuantifier?.(expr, path, quantifierDepth)
			walkExpression(expr.predicate, quantifierDepth + 1, `${path}.predicate`, visitor)
			return
		case 'set-membership':
			visitor.onOperand?.(expr.operands[0], expr.op, 0, `${path}.operands[0]`, quantifierDepth)
			visitor.onSetOperand?.(expr.operands[1], `${path}.operands[1]`)
			return
		case 'covers-by-key':
			visitor.onCoversByKey?.(path, quantifierDepth)
			expr.operands.forEach((operand, index) =>
				visitor.onOperand?.(operand, expr.op, index as 0 | 1, `${path}.operands[${index}]`, quantifierDepth),
			)
			return
		case 'regex':
			visitor.onRegex?.(expr.pattern, path)
			expr.operands.forEach((operand, index) =>
				visitor.onOperand?.(operand, expr.op, index as 0, `${path}.operands[${index}]`, quantifierDepth),
			)
			return
		default:
			expr.operands.forEach((operand, index) =>
				visitor.onOperand?.(operand, expr.op, index as 0 | 1, `${path}.operands[${index}]`, quantifierDepth),
			)
	}
}

function forEachOracleCheck(
	contract: EvalContract,
	visit: (check: Expression, oracleId: string) => void,
): void {
	contract.oracles.forEach((oracle) => {
		if (oracle.check === null) return
		visit(oracle.check, oracle.id)
	})
}

// ---- malformed-operator-expression: legal operand kinds per (op, position) --

type OperandKind = 'pointer' | 'literal' | 'referenceSet'

function kindOf(operand: Operand): OperandKind {
	if ('pointer' in operand) return 'pointer'
	if ('literal' in operand) return 'literal'
	return 'referenceSet'
}

/**
 * Every operator's own operand-type declaration, transcribed from
 * `expression.ts`'s `operandTypes(...)` doc text on each op — AD-4's own
 * words, "each operator declares a fixed arity and operand types in the
 * published schema," stated as text there specifically because narrowing
 * the schema structurally would delete this code's operand-type limb.
 * `set-membership` position 1 has no entry: it is a `SetOperand`, not an
 * `Operand`, already schema-narrowed to exactly its two legal shapes.
 * `for-all`/`for-any` key on the string `'collection'`, a named field
 * rather than a tuple member.
 */
const OPERAND_LEGALITY: Record<string, Partial<Record<string, ReadonlySet<OperandKind>>>> = {
	equality: { 0: new Set(['pointer', 'literal']), 1: new Set(['pointer', 'literal']) },
	'deep-equality': { 0: new Set(['pointer', 'literal']), 1: new Set(['pointer', 'literal']) },
	containment: { 0: new Set(['pointer']), 1: new Set(['pointer', 'literal', 'referenceSet']) },
	existence: { 0: new Set(['pointer']) },
	absence: { 0: new Set(['pointer']) },
	regex: { 0: new Set(['pointer']) },
	'set-membership': { 0: new Set(['pointer']) },
	ordering: { 0: new Set(['pointer']) },
	'count-tolerance': { 0: new Set(['pointer']) },
	shape: { 0: new Set(['pointer']) },
	'covers-by-key': { 0: new Set(['referenceSet']), 1: new Set(['pointer']) },
	'for-all': { collection: new Set(['pointer']) },
	'for-any': { collection: new Set(['pointer']) },
}

export function checkOperandLegality(contract: EvalContract): void {
	forEachOracleCheck(contract, (check, oracleId) => {
		walkExpression(check, 0, 'check', {
			onOperand: (operand, op, position, path) => {
				const legal = OPERAND_LEGALITY[op]?.[String(position)]
				if (legal === undefined) return
				const kind = kindOf(operand)
				if (!legal.has(kind)) {
					throw new StructuralFailure(
						'malformed-operator-expression',
						`EvalContract.oracles[id=${oracleId}].${path}`,
						`"${op}" does not accept a ${kind} operand at position ${position} (AD-4, AD-26)`,
					)
				}
			},
		})
	})
}

// ---- malformed-operator-expression: rejected regex constructs ---------------

const BACKREFERENCE_PATTERN = /\\(?:[1-9][0-9]*|k<[^>]+>)/
const LOOKBEHIND_PATTERN = /\(\?<[=!]/

/**
 * AD-4 rejects a backreference or a lookbehind at compile time;
 * `AnchoredPattern`'s own schema comment states plainly that this half is
 * Epic 4's, since deciding it needs parsing no JSON Schema keyword can
 * express. This is a syntactic scan over the pattern text, not a parse, and
 * can be fooled by either construct's spelling appearing inside a character
 * class — the same honestly-stated imperfection `AnchoredPattern`'s own
 * anchoring check already carries in both directions (Decision 8 below).
 */
export function checkRegexConstructs(contract: EvalContract): void {
	forEachOracleCheck(contract, (check, oracleId) => {
		walkExpression(check, 0, 'check', {
			onRegex: (pattern, path) => {
				if (BACKREFERENCE_PATTERN.test(pattern)) {
					throw new StructuralFailure(
						'malformed-operator-expression',
						`EvalContract.oracles[id=${oracleId}].${path}.pattern`,
						`regex pattern "${pattern}" carries a backreference, a rejected construct (AD-4)`,
					)
				}
				if (LOOKBEHIND_PATTERN.test(pattern)) {
					throw new StructuralFailure(
						'malformed-operator-expression',
						`EvalContract.oracles[id=${oracleId}].${path}.pattern`,
						`regex pattern "${pattern}" carries a lookbehind, a rejected construct (AD-4)`,
					)
				}
			},
		})
	})
}

// ---- quantifier-nesting-exceeded --------------------------------------------

export function checkQuantifierNesting(contract: EvalContract): void {
	forEachOracleCheck(contract, (check, oracleId) => {
		walkExpression(check, 0, 'check', {
			onQuantifier: (_expr, path, quantifierDepth) => {
				if (quantifierDepth >= 1) {
					throw new StructuralFailure(
						'quantifier-nesting-exceeded',
						`EvalContract.oracles[id=${oracleId}].${path}`,
						"a quantifier appears inside another quantifier's predicate; quantifiers may not nest more than one level (AD-4)",
					)
				}
			},
			onCoversByKey: (path, quantifierDepth) => {
				if (quantifierDepth >= 1) {
					throw new StructuralFailure(
						'quantifier-nesting-exceeded',
						`EvalContract.oracles[id=${oracleId}].${path}`,
						"covers-by-key appears inside a quantifier's predicate, where it may never nest (AD-4)",
					)
				}
			},
		})
	})
}

// ---- quantifier-over-non-collection ------------------------------------------

const SCALAR_TYPES: ReadonlySet<string> = new Set(
	JsonTypeName.options.filter((name) => name !== 'object' && name !== 'array'),
)

/**
 * `quantifier-over-non-collection`: a quantifier's `collection` operand is
 * typed a definite scalar by the invoked operation's response descriptor.
 * Reuses `makePointerDenotesCollection` (Story 4.1) rather than
 * reimplementing the root-collection carve-out. Scoped to `response-body`
 * pointers only, matching AD-5's own "invoked operation's response
 * descriptor" wording (Decision 3 below); every other channel, and any
 * pointer `checkEvidenceReachability` would already reject as unreachable,
 * stays permissive here — that check owns unreachable pointers, this one
 * owns reachable-but-scalar ones. Only a legal `pointer`-kind collection
 * operand is checked: `checkOperandLegality` already reports an illegal-kind
 * collection operand under `malformed-operator-expression`, and this
 * function does not double-report the same defect under a second code.
 */
export function checkQuantifierOverNonCollection(contract: EvalContract): void {
	const denotesCollection = makePointerDenotesCollection(contract)
	let index: PlanIndex | undefined
	forEachOracleCheck(contract, (check, oracleId) => {
		walkExpression(check, 0, 'check', {
			onQuantifier: (expr, path) => {
				const { collection } = expr
				if (!('pointer' in collection) || collection.pointer.startsWith('@')) return
				if (denotesCollection(collection.pointer)) return
				index ??= buildPlanIndex(contract.interactionPlan, contract.permittedInterfaces)
				const target = parseEvidenceTarget(collection.pointer)
				if (target.channel !== 'response-body') return
				const step = index.stepOf(target.stepId)
				if (step === undefined) return
				const operation = index.operationOf(step.operationId)
				if (operation === undefined) return
				if (target.tail.length !== 1) return // flat descriptor: only one level is decidable
				const firstToken = target.tail[0]
				if (firstToken === undefined) return
				const declaredType = operation.responseDescriptor.types[firstToken]
				if (
					declaredType !== undefined &&
					declaredType !== null &&
					SCALAR_TYPES.has(declaredType)
				) {
					throw new StructuralFailure(
						'quantifier-over-non-collection',
						`EvalContract.oracles[id=${oracleId}].${path}.collection`,
						`"${collection.pointer}" is declared "${declaredType}" by operation "${operation.operationId}", a scalar, not a collection (AD-4)`,
					)
				}
			},
		})
	})
}

// ---- unresolved-reference-set ------------------------------------------------

/**
 * `unresolved-reference-set`: a `{ referenceSet }` operand naming an
 * identifier `contract.referenceSets` does not declare. Checked at every
 * `{ referenceSet }`-shaped operand this walk visits, regardless of whether
 * `checkOperandLegality` would also reject the position: this function only
 * ever looks at the shape, never the position, so the two functions overlap
 * only when a `{ referenceSet }` operand is both illegal-position and
 * undeclared, an edge case neither function needs to special-case away
 * (Decision 7 below). `Object.hasOwn`, not `??`/bracket indexing: `Identifier`
 * admits `constructor` as a legal reference-set id, matching Story 4.1's own
 * Decision 3 for the identical trap.
 */
export function checkReferenceSetResolution(contract: EvalContract): void {
	const declared = contract.referenceSets ?? {}
	const isDeclared = (id: string): boolean => Object.hasOwn(declared, id)
	forEachOracleCheck(contract, (check, oracleId) => {
		const reject = (id: string, path: string): void => {
			throw new StructuralFailure(
				'unresolved-reference-set',
				`EvalContract.oracles[id=${oracleId}].${path}`,
				`referenceSet "${id}" is not declared on the contract (AD-26)`,
			)
		}
		walkExpression(check, 0, 'check', {
			onOperand: (operand, _op, _position, path) => {
				if ('referenceSet' in operand && !isDeclared(operand.referenceSet)) {
					reject(operand.referenceSet, path)
				}
			},
			onSetOperand: (setOperand, path) => {
				if ('referenceSet' in setOperand && !isDeclared(setOperand.referenceSet)) {
					reject(setOperand.referenceSet, path)
				}
			},
		})
	})
}
```

**Verified against both whole-contract fixtures**: `populatedContract`'s only `referenceSet` operand (`covers-by-key`'s `expected`, position 0) is both legal and declared. `gateCContract`'s O-006 (`set-membership`'s `SetOperand` position carrying `{ referenceSet: 'expected-export-rows' }`, declared) exercises `onSetOperand`'s positive path — the one branch `checkOperandLegality` never reaches, since that position has no `OPERAND_LEGALITY` entry by design. No oracle in either fixture nests a quantifier or places `covers-by-key` inside one, so `checkQuantifierNesting` passes both. No oracle's `for-all`/`for-any` collection resolves to a scalar-typed field, so `checkQuantifierOverNonCollection` passes both (`gateCContract`'s O-004/O-005/O-006 all quantify over `list-export-rows`' declared `/rows` collection location).

### AC 5: `src/core/compile/interface-inventory.ts`

`unsupported-interface-kind`, `duplicate-operation-signature` (across the whole operation inventory, not one interface), `undeclared-mandatory-input`.

```ts
/**
 * AD-19's interface-and-plan-inventory checks: `unsupported-interface-kind`
 * (a permitted interface declaring anything but `api`), `duplicate-
 * operation-signature` (two operations across every permitted interface
 * colliding on method plus path template after parameter-name erasure —
 * AD-40 resolves a defect signature against the contract's whole inventory,
 * not one interface's), and `undeclared-mandatory-input` (an interaction
 * step's input binding naming a key the bound operation's request shape
 * does not declare).
 */
import { StructuralFailure } from '../failure-codes.ts'
import type { EvalContract } from '../schemas/eval-contract.ts'
import type { Operation } from '../schemas/interface.ts'
import { TRANSPORT_CHANNELS } from '../schemas/pointer.ts'
import { buildPlanIndex } from '../seal/plan-index.ts'

/** `unsupported-interface-kind`: a declared interface kind other than `api`. */
export function checkInterfaceKind(contract: EvalContract): void {
	for (const iface of contract.permittedInterfaces) {
		if (iface.kind !== 'api') {
			throw new StructuralFailure(
				'unsupported-interface-kind',
				`EvalContract.permittedInterfaces[logicalId=${iface.logicalId}].kind`,
				`"${iface.kind}" is not supported in v0; only "api" is (AD-10)`,
			)
		}
	}
}

/**
 * AD-19's parameter-name erasure: every `{name}` segment collapses to the
 * same placeholder, so `/things/{id}` and `/things/{identifier}` erase to
 * one string and collide. `PathTemplate`'s own regex already guarantees a
 * parameter is spelled exactly `{name}` in braces, so a bracket-balanced
 * regex replace is sufficient; no path-segment parser is needed.
 */
const PARAMETER_SEGMENT_PATTERN = /\{[A-Za-z0-9_-]+\}/g
const erase = (pathTemplate: string): string =>
	pathTemplate.replace(PARAMETER_SEGMENT_PATTERN, '{}')

export function checkDuplicateOperationSignature(contract: EvalContract): void {
	const seen: { logicalId: string; operation: Operation; signature: string }[] = []
	for (const iface of contract.permittedInterfaces) {
		for (const operation of iface.operations) {
			const signature = `${operation.method} ${erase(operation.pathTemplate)}`
			const collision = seen.find((entry) => entry.signature === signature)
			if (collision !== undefined) {
				throw new StructuralFailure(
					'duplicate-operation-signature',
					`EvalContract.permittedInterfaces[logicalId=${iface.logicalId}].operations[operationId=${operation.operationId}]`,
					`collides with permittedInterfaces[logicalId=${collision.logicalId}].operations[operationId=${collision.operation.operationId}] after parameter-name erasure ("${signature}") (AD-19, AD-40)`,
				)
			}
			seen.push({ logicalId: iface.logicalId, operation, signature })
		}
	}
}

/**
 * `undeclared-mandatory-input`: an input-binding channel names a key its
 * step's operation does not declare in either `requiredKeys` or
 * `permittedKeys` for that transport channel. Silently skips a step naming
 * an undeclared operation: that shape is a separately named, deliberately
 * unenforced cross-field rule ("admits a step naming an operation the
 * inventory does not declare", `ad5-admissions.test.ts`) — no AD-5 code
 * names it, and this function is not the place to invent one. Builds its
 * `PlanIndex` eagerly, not lazily: unlike Story 4.1's checks, every call
 * needs it immediately, since every step is visited regardless of whether
 * any binding is even present.
 */
export function checkUndeclaredMandatoryInput(contract: EvalContract): void {
	const index = buildPlanIndex(contract.interactionPlan, contract.permittedInterfaces)
	for (const step of contract.interactionPlan) {
		const operation = index.operationOf(step.operationId)
		if (operation === undefined) continue
		for (const channel of TRANSPORT_CHANNELS) {
			const binding = step.inputBinding[channel]
			if (binding === null) continue
			const { requiredKeys, permittedKeys } = operation.requestShape[channel]
			for (const key of Object.keys(binding)) {
				if (!requiredKeys.includes(key) && !permittedKeys.includes(key)) {
					throw new StructuralFailure(
						'undeclared-mandatory-input',
						`EvalContract.interactionPlan[stepId=${step.stepId}].inputBinding.${channel}.${key}`,
						`operation "${operation.operationId}" declares "${key}" in neither requiredKeys nor permittedKeys of its ${channel} channel (AD-4)`,
					)
				}
			}
		}
	}
}
```

**Verified against both whole-contract fixtures**: `populatedContract`'s two operations (`POST /things`, `GET /things`) and `gateCContract`'s three (`POST /exports`, `GET /exports/{jobId}`, `GET /exports/{jobId}/rows`) erase to six pairwise-distinct signatures. Every bound key in both fixtures' `interactionPlan`s (`name`, `limit`, `datasetId`, `filters`, `jobId`) is declared in its step's operation's matching transport channel.

### AC 6: `src/core/compile/waivers.ts`

```ts
/**
 * AD-5/AD-6/AD-21's `waiver-incomplete`: a waiver missing any of its four
 * required parts. `condition` is deliberately excluded: AD-5 requires a
 * machine-checkable context condition "where one exists", so a `null`
 * condition is a complete waiver, not an incomplete one — `Waiver`'s own
 * schema comment states this explicitly.
 */
import { StructuralFailure } from '../failure-codes.ts'
import type { EvalContract } from '../schemas/eval-contract.ts'

const REQUIRED_WAIVER_PARTS = ['rule', 'rationale', 'approval', 'expiresAt'] as const

export function checkWaiverCompleteness(contract: EvalContract): void {
	for (const waiver of contract.waivers) {
		for (const part of REQUIRED_WAIVER_PARTS) {
			if (waiver[part] === null) {
				throw new StructuralFailure(
					'waiver-incomplete',
					`EvalContract.waivers[id=${waiver.id}].${part}`,
					`a waiver requires ${part}; AD-5 requires the named rule, an explicit rationale, the recorded approval, and an RFC 3339 expiry`,
				)
			}
		}
	}
}
```

`populatedContract`'s one waiver (`W-001`) carries all four required parts non-null (`condition` is `null` by design and must not fire), so it is this check's own positive regression fixture.

### AC 7: Fixtures and tests

One test file per module, mirroring `tests/compile/reachability.test.ts`'s own conventions: `EvalContract.parse(...)` for whole-fixture positive regressions, `structuredClone(...) as any` plus one mutation for negative fixtures (matching `ad5-admissions.test.ts`'s own style), a `structuralFailureOf` helper to assert both the thrown type and its `code`.

**`tests/compile/declarations.test.ts` (new).**

1. `checkRequirementLinkage(populatedContract)` and `checkRequirementLinkage(gateCContract)` do not throw.
2. `checkObservableSuccessCriterion(populatedContract)` and `(gateCContract)` do not throw.
3. `ad5-admissions.test.ts`'s "missing-requirement-linkage: both link arrays empty on a behaviour" mutation now throws `StructuralFailure` with `code: 'missing-requirement-linkage'` and an `artifactPath` naming `behaviors[id=B-001]`.
4. A behaviour with `requirementLinks` populated and `riskLinks` empty (and the mirror) does **not** throw: only both-empty fires.
5. `ad5-admissions.test.ts`'s "no-observable-success-criterion: a null criterion" mutation throws `code: 'no-observable-success-criterion'`.
6. `ad5-admissions.test.ts`'s "an empty oracle list parses and is not this code" mutation (`contract.oracles = []; contract.behaviors[0].oracles = []`) does **not** throw either check: proves the empty-oracle-list case stays clean, matching AD-19's own explicit statement.
7. Two behaviours, the first clean and the second violating `missing-requirement-linkage`: the thrown error's `artifactPath` names the second behaviour's id, not the first (first-violation-wins, matching Story 4.1's own Decision 10 convention).

**`tests/compile/oracle-alignment.test.ts` (new).**

8. `checkOracleChannel(populatedContract)` and `(gateCContract)` do not throw.
9. `ad5-admissions.test.ts`'s two `oracle-missing-channel` mutations (`direction = null`, `check = null`) each throw `code: 'oracle-missing-channel'`.
10. `checkOracleAlignment(populatedContract)` and `checkOracleAlignment(gateCContract)` do not throw — the eight-oracle proof this check produces zero false positives against every already-shipped, already-passing oracle in this codebase, including O-004's substitution-dependent target (Decision 1 below spells out why this fixture is load-bearing).
11. `ad5-admissions.test.ts`'s `direction-check-misaligned` mutation (all three fields disagreeing) throws `code: 'direction-check-misaligned'` with `artifactPath` ending `.direction.evidenceTargets` (evidence-target containment is checked first).
12. A direction whose `evidenceTargets` are correct but whose `relation` disagrees with every op in `check` throws, `artifactPath` ending `.direction.relation`.
13. A direction whose `evidenceTargets` and `relation` are correct but whose `polarity` disagrees with `oracle.polarity` throws, `artifactPath` ending `.direction.polarity`.
14. A hand-built oracle whose check is `for-all(collection: { pointer: '/interactions/list/response-body/items' }, predicate: for-any(collection: { pointer: '@/children' }, predicate: existence(@/id)))` and whose direction declares `evidenceTargets: ['/interactions/list/response-body/items/children/id']` does **not** throw: proves nested-quantifier substitution composes (this shape is separately rejected under `quantifier-nesting-exceeded` by AC 4's own check, a different function; this fixture proves `checkOracleAlignment` in isolation still computes the substitution correctly, per Story 4.1's "each function is independently correct for its own condition" convention, Decision 7 below).
15. An oracle with `direction === null` and one with `check === null` both pass through `checkOracleAlignment` with no throw (the skip-on-precondition-not-met branch), proving it does not crash on the shape `checkOracleChannel` owns.

**`tests/compile/expression-legality.test.ts` (new).**

16. `checkOperandLegality`, `checkRegexConstructs`, `checkQuantifierNesting`, `checkQuantifierOverNonCollection`, and `checkReferenceSetResolution` **all five** pass with no throw against `populatedContract` and `gateCContract`.
17. `ad5-admissions.test.ts`'s "malformed-operator-expression: a reference-set operand outside AD-26 three legal positions" mutation (`equality` with two `referenceSet` operands) throws under `checkOperandLegality`, `code: 'malformed-operator-expression'`.
18. The same file's two regex-construct mutations (backreference, lookbehind) each throw under `checkRegexConstructs`, `code: 'malformed-operator-expression'`.
19. A pattern carrying neither construct (e.g. `'^[a-z]+$'`) does not throw under `checkRegexConstructs`.
20. `ad5-admissions.test.ts`'s "quantifier-over-non-collection" mutation throws under `checkQuantifierOverNonCollection`, `code: 'quantifier-over-non-collection'`.
21. A `for-all` quantifying over `/interactions/create/response-body/error` (declared `string`, undeclared as a collection location, same operation as fixture 20 but a different field) also throws, proving the check is not accidentally scoped to one field name.
22. A `for-all` quantifying over a pointer whose first token is **undeclared** in the response descriptor does not throw under `checkQuantifierOverNonCollection` (permissive default; `checkEvidenceReachability` from Story 4.1 owns rejecting it as unreachable, a separate code from a separate function).
23. Both `ad5-admissions.test.ts` `quantifier-nesting-exceeded` mutations (nested quantifier, `covers-by-key` inside one) throw under `checkQuantifierNesting`, `code: 'quantifier-nesting-exceeded'`.
24. Two **sibling** `for-all`s under a top-level `all` (neither nested in the other's `predicate`, both reached at `quantifierDepth` 0) do **not** throw: proves nesting depth is scoped per-branch of the recursive walk, not a single shared mutable counter that would incorrectly carry over from one sibling into the next. (`collection` cannot itself carry a nested quantifier — it is typed `Operand`, never `Expression` — so this is the real edge case the depth-tracking needs to get right, not a literal "quantifier inside a collection field," which the type system already makes unrepresentable.)
25. `ad5-admissions.test.ts`'s `unresolved-reference-set` mutation throws under `checkReferenceSetResolution`, `code: 'unresolved-reference-set'`.
26. A `set-membership` whose `SetOperand` position carries `{ referenceSet: 'never-declared' }` throws under `checkReferenceSetResolution` via the `onSetOperand` branch specifically (the one branch fixture 25 does not exercise).
27. `contract.referenceSets = null` with any `{ referenceSet }` operand present throws (the nullable-map case, `declared ?? {}`).
28. The `artifactPath` on a thrown `malformed-operator-expression` from `checkOperandLegality` names the exact operand position (e.g. `.check.operands[0]`), not only the oracle — reusing Story 4.1's Decision 13 convention.

**`tests/compile/interface-inventory.test.ts` (new).**

29. All three checks pass with no throw against `populatedContract` and `gateCContract`.
30. `it.each(['web', 'cli', 'mcp'])`, reusing `ad5-admissions.test.ts`'s own three mutations, each throws under `checkInterfaceKind`, `code: 'unsupported-interface-kind'`.
31. `ad5-admissions.test.ts`'s `duplicate-operation-signature` mutation (parameter-name erasure collision) throws under `checkDuplicateOperationSignature`, `code: 'duplicate-operation-signature'`, with `artifactPath` naming both colliding `operationId`s in its message.
32. Two operations with identical method and **identical** (not merely erasure-equivalent) path templates also collide (the trivial case, contrasted against fixture 31's erasure-dependent one).
33. Two operations differing only by method (same erased path template) do **not** collide.
34. `ad5-admissions.test.ts`'s `undeclared-mandatory-input` mutation throws under `checkUndeclaredMandatoryInput`, `code: 'undeclared-mandatory-input'`.
35. A step whose `operationId` names no declared operation does not throw (the documented, deliberately unenforced cross-field gap), contrasted directly against fixture 34 over the identical `undeclaredKey` shape.
36. A bound key declared in `permittedKeys` but not `requiredKeys` does not throw (the union check, mirroring Story 4.1's own Decision 5 for reachability).

**`tests/compile/waivers.test.ts` (new).**

37. `checkWaiverCompleteness(populatedContract)` does not throw (`W-001`'s `condition: null` must not fire).
38. `it.each(['rule', 'rationale', 'approval', 'expiresAt'])`, reusing `ad5-admissions.test.ts`'s own four mutations, each throws `code: 'waiver-incomplete'` with `artifactPath` ending in that exact part's name.
39. `contract.waivers[0].condition = null` alone (`ad5-admissions.test.ts`'s own "a null condition is a complete waiver" fixture) does not throw.
40. Two waivers, the first complete and the second missing `approval`: the thrown error's `artifactPath` names the second waiver's id.

### AC 8: The gate

- `npm run check:docs` and `npm test` run and the baseline is recorded **before the first edit**.
- `npm run validate` passes at the end: typecheck, lint, `check:docs`, `check:shareable`, `lint:spine`, `check:vectors`, `check:schemas`, `check:ad5-registry`. This story touches no spine text and adds no new `FailureCode` member (every code this story's new functions throw is already in `FAILURE_CODES`), so `lint:spine` and `check:ad5-registry` are expected no-ops. Run them anyway.
- `src/index.ts` is not touched: none of this story's exports is part of the published library surface yet, matching Story 4.1's own identical note.

## Tasks / Subtasks

- [x] Task 1: preflight (AC 8)
  - [x] Run `npm run check:docs` and `npm test`; record the baseline test count before the first edit.
- [x] Task 2: declarations (AC 2)
  - [x] `src/core/compile/declarations.ts`: `checkRequirementLinkage`, `checkObservableSuccessCriterion`.
- [x] Task 3: oracle alignment (AC 3)
  - [x] `src/core/compile/oracle-alignment.ts`: `checkOracleChannel`, `substitutePointer`, `operandPointer`, `collectTargets`, `checkOracleAlignment`.
- [x] Task 4: expression legality (AC 4)
  - [x] `src/core/compile/expression-legality.ts`: the shared `walkExpression`/`forEachOracleCheck`, `checkOperandLegality`, `checkRegexConstructs`, `checkQuantifierNesting`, `checkQuantifierOverNonCollection`, `checkReferenceSetResolution`.
- [x] Task 5: interface inventory (AC 5)
  - [x] `src/core/compile/interface-inventory.ts`: `checkInterfaceKind`, `checkDuplicateOperationSignature`, `checkUndeclaredMandatoryInput`.
- [x] Task 6: waivers (AC 6)
  - [x] `src/core/compile/waivers.ts`: `checkWaiverCompleteness`.
- [x] Task 7: fixtures and tests (AC 7)
  - [x] `tests/compile/declarations.test.ts`: fixtures 1-7.
  - [x] `tests/compile/oracle-alignment.test.ts`: fixtures 8-15.
  - [x] `tests/compile/expression-legality.test.ts`: fixtures 16-28.
  - [x] `tests/compile/interface-inventory.test.ts`: fixtures 29-36.
  - [x] `tests/compile/waivers.test.ts`: fixtures 37-40.
- [x] Task 8: the gate (AC 8)
  - [x] `npm run validate` green.
- [x] Task 9: record
  - [x] `_bmad-output/project-knowledge/learning-path-step-by-step.md`: one new row, following `learning-path-template.md`'s exact shape, after this story is marked done.
  - [x] Dev Agent Record: measured counts, any decision that moved from this story's default.

## Decisions taken during story creation

Each is settled with a stated default and its downstream consequence. Per this project's standing convention (settle ambiguities in the story or the code, record the reasoning, do not escalate to a new architecture revision), proceed unless the user amends one; record the outcome in the Dev Agent Record.

1. **`checkOracleAlignment`'s containment is computed by substituting `@/…` pointers against their enclosing quantifier's `collection` pointer via raw string concatenation, never by decoding to RFC 6901 tokens and re-encoding.** The alternative — reuse `decodeBoundElementTail`/`decodeTail` and re-encode with a new `encodeToken` this story would have to add — is unneeded: the raw substring after `@` in a `@/…` pointer is already valid RFC 6901 escaping exactly as authored, so concatenating it onto a fully-rooted pointer string reproduces valid escaping with zero decode/re-encode round trip. Considered and rejected: adding an `encodeToken`/`encodeTail` pair mirroring Story 4.1's decode pair, for symmetry. Rejected because it is unneeded work solving a problem string concatenation does not have, and this codebase's own conventions (Story 3.3's `keyValueOf`, Story 4.1 throughout) favor the smallest correct mechanism over a symmetrical-looking one. **Consequence:** `substitutePointer` is nine lines with no dependency on `plan-index.ts`'s decode helpers at all; verified directly against `gateCContract`'s O-004, the one already-shipped oracle whose direction target is unreachable by raw-text scan and only produced by this exact substitution (AC 3's own note explains why that fixture is load-bearing, not merely convenient).

2. **`checkOracleAlignment` treats `direction.relation` containment as "appears anywhere in `check`'s set of `op` values," not "is `check`'s root op."** AD-3's own text says structural containment, and `check` "may be stronger" than the direction — read literally, a direction naming `existence` as its relation is satisfied by a `check` that performs an `existence` test anywhere inside a larger `all`, not only when `existence` is the whole tree. Every already-shipped oracle in both whole-contract fixtures happens to declare `relation` as its check's own root op (O-002/O-003/O-007/O-008 all declare `all`, matching their root), so this reading is unverified against a case where the two diverge; it is still the literal reading of AD-3's own words and the more permissive of the two candidates. Considered and rejected: requiring `relation` to equal `check.op` at the root exactly. Rejected as a narrower reading than AD-3's own "may be stronger" sentence supports, and one that would fail every `all`-wrapped oracle in `gateCContract` the instant its direction named the wrapped operator rather than `all` itself — a reading with no positive fixture to justify it and a plausible one to break. **Consequence:** `collectTargets` accumulates every node's `op`, including connectives and quantifiers, into one flat set; a future story finding a case this reading gets wrong has a single function to correct.

3. **`checkQuantifierOverNonCollection` checks the `response-body` channel only, never `call-inputs` or any other channel.** AD-5's own "Fires when" text for this code says "the invoked operation's response descriptor" by name; nothing in the spine's `covers-by-key`/quantifier discussion suggests a request-side quantifier is even meaningful practice, and `AD-19`'s request shape carries no `collectionLocations` concept at all (that field lives only on `ResponseDescriptor`), so there is no declared-collection surface to reconcile a `call-inputs` pointer against even if the check tried. Considered and rejected: extending the same scalar-type check to `call-inputs`, reusing `RequestShape`'s own per-channel `types` map. Rejected because AD-5's literal wording names one descriptor, and inventing a second enforcement surface the spine never states risks rejecting a contract the spine itself would accept — exactly the over-tightening `ad5-admissions.test.ts`'s own header warns against ("A schema tightened past a code does not make the product safer"). **Consequence:** `checkQuantifierOverNonCollection` returns permissively (no throw) for any `collection` pointer whose channel is not `response-body`, before reaching the type lookup at all; AC 7 fixture 16's whole-fixture regression is the only proof this permissive default does not silently swallow a real defect, since neither fixture contract quantifies over a `call-inputs` pointer.

4. **`checkDuplicateOperationSignature` compares every operation across every `permittedInterfaces` entry, not within one interface at a time.** AD-19's own text: "Two operations whose method and path template collide after parameter-name erasure fail under `duplicate-operation-signature`, because AD-40 resolves a defect signature against this inventory" — "this inventory" is stated once, over the whole declaration list, with no per-interface scoping language anywhere in AD-19, AD-5, or AD-40. `buildPlanIndex` (Story 4.1) already treats `operationId` as unique across every interface combined (throwing `TypeError` on a cross-interface collision), which is the identical whole-contract scoping applied to a different key. Considered and rejected: scoping the check to one `PermittedInterface`'s own `operations` array at a time, matching how `duplicate-operation-signature`'s admitted fixture happens to mutate operations that already share one interface. Rejected because the fixture's shape is consistent with either reading (both operations happen to live in the contract's one interface) and does not distinguish them, while AD-40's own stated purpose — resolving a defect signature unambiguously against the inventory a probe's response was actually read against — has no reason to stop caring about a collision the moment it crosses an interface boundary; a caller invoking two interfaces against one target could still receive an ambiguous response. **Consequence:** `checkDuplicateOperationSignature` flattens every interface's operations into one linear scan; AC 7 fixture 31 uses the existing single-interface admitted fixture (consistent with either reading) and this decision is recorded so a future story finding a genuine cross-interface case has the reasoning already on record rather than reopening it.

5. **`unresolved-reference-set`'s `Object.hasOwn(declared, id)` check is skipped entirely — no throw — for a `{ referenceSet }` operand at an illegal position that `checkOperandLegality` would also reject, and vice versa: the two functions do not coordinate.** Every admitted fixture in `ad5-admissions.test.ts` happens to isolate the two conditions cleanly (the `unresolved-reference-set` fixture uses an undeclared id at a *legal* position; the `malformed-operator-expression` reference-set fixture uses a *declared* id at an illegal position), so no existing fixture exercises the double-violation case, and this story does not invent one. Considered and rejected: having `checkReferenceSetResolution` skip a `{ referenceSet }` operand whose position `OPERAND_LEGALITY` marks illegal, so only one of the two codes could ever fire for one operand. Rejected because it would import `checkOperandLegality`'s own table into a module whose entire point is being independently, self-sufficiently correct for its one named condition — exactly the coupling Story 4.1's Decision 10 and AC 1 item 7 both already reject for this codebase's compile-time checks in general. **Consequence:** an operand that is both illegal-position and unresolved-id throws whichever code's function a caller reaches first; this is the same general "no cross-function ordering" characteristic Decision 7 below states once, not a special case of this pairing.

6. **`checkUndeclaredMandatoryInput` takes no `strict` parameter and always enforces.** AD-4 states strict mode is "a compile-and-score mode, on by default... selected only by explicit argument or flag" — that is caller-level configuration, and no schema field anywhere on `EvalContract` carries a strict-mode toggle (`Budgets`, `ScoringPolicy`, and every other configuration surface this codebase has built so far live outside the contract, per the Consistency Conventions' own Configuration row). Considered and rejected: adding an `options: { strict?: boolean }` parameter defaulting to `true`, so a future non-strict caller could opt out without needing this function changed. Rejected as speculative: no other compile-time check in this codebase (Story 4.1's two, or this story's other eleven) takes a mode parameter, `compile()` itself does not exist yet (Story 4.4's), and adding one parameter this story cannot itself exercise with a real caller is exactly the kind of interface guess AD-1's purity discipline and this codebase's "no defaults that vary by machine" convention both caution against. **Consequence:** whether `checkUndeclaredMandatoryInput` is even called is entirely Story 4.4's orchestrator's decision; this function has no opinion on strict mode and enforces unconditionally whenever invoked.

7. **This story defines no ordering among its thirteen new functions, or against Story 4.1's two.** Every function is independently correct for the one AD-5 code it names, matching every one of Story 4.1's own thirteen decisions that assume the same about its two functions (most explicitly Decision 10 there). A contract invalid under two or more codes at once — for instance, an oracle with both a `missing-requirement-linkage` behaviour and an unrelated `waiver-incomplete` waiver — reports whichever code's check function a caller happens to invoke first; this story ships thirteen standalone functions, not a `compile()` that would need to make that call. Considered and rejected: adding a `runAllStructuralChecks(contract)` convenience export that calls every function from both this story and Story 4.1 in a fixed order, so at least this story's own thirteen have *some* stated order relative to each other even without full orchestration. Rejected because it is a small, unrequested slice of AD-34's "one orchestration layer" — Story 4.4's own stated job — built early and by a different story than the epic assigns it to, and a convenience function nobody asked for is more likely to be half-replaced by Story 4.4's real orchestrator than reused by it. **Consequence:** thirteen new exports, zero new call-order guarantees; Story 4.4 is where "first match wins" (AD-21's own phrase, stated there for verdict derivation and reused here by analogy) gets decided for compile-time codes as a whole.

8. **`checkRegexConstructs`'s backreference and lookbehind detection is a syntactic scan (`/\\(?:[1-9][0-9]*|k<[^>]+>)/`, `/\(\?<[=!]/`), not a parse, and can be fooled by either spelling appearing inside a character class (e.g. a pattern containing the literal text `[\1]`, meant as an escaped digit-in-brackets rather than a backreference, would still be rejected).** `AnchoredPattern`'s own schema comment already states its sibling anchoring check is "a positional check" that is "wrong in both directions" for the identical reason — deciding either property correctly needs parsing the pattern, which no JSON Schema keyword, and no small regex, can express precisely. Considered and rejected: pulling in a regex-syntax-aware parser dependency to detect these two constructs exactly. Rejected as disproportionate: this codebase's runtime dependency set is deliberately Zod alone (AD-25's own recorded minimality), and `AnchoredPattern`'s own precedent already establishes that an honestly-imperfect syntactic check, documented as such, is this project's accepted tradeoff for this exact class of problem one field over. **Consequence:** both patterns are documented in `checkRegexConstructs`'s own comment as heuristic, matching `AnchoredPattern`'s own honesty; AC 7 fixture 19 pins one pattern that must **not** false-positive, and no fixture claims the heuristic is complete.

## Dev Notes

### Read these files before writing anything

1. `src/core/compile/reachability.ts`, in full: the one existing precedent for a compile-time check in this codebase. `visitOperand`/`visitExpression`/`forEachCheckPointer`'s shared-walk shape is what AC 4's `walkExpression`/`forEachOracleCheck` generalizes; `evaluatePointerReachability`'s non-throwing-core-plus-throwing-wrapper split and its fail-fast, first-violation-wins convention both carry over unchanged.
2. `src/core/evaluate/evidence-resolution.ts`, in full, especially `makePointerDenotesCollection`: reused directly by AC 4 rather than reimplemented.
3. `src/core/schemas/expression.ts`, in full: `operandTypes(...)`'s doc text on every operator is `OPERAND_LEGALITY`'s only source; get each operator's legal operand kinds by reading its own `.describe(...)` call, not by inference.
4. `src/core/schemas/oracle.ts`: `Direction`, `Oracle`. The duplicated-polarity comment on `Direction.polarity` states directly why `direction-check-misaligned` needs the two polarities to stay independently representable.
5. `ARCHITECTURE-SPINE.md` AD-3 (165-183) and AD-4 (185-202) in full: AD-3's worked example (`@/status` inside `for-all`) is the exact shape AC 3's `collectTargets` implements; AD-4's own operand-legality prose (the `covers-by-key`, `set-membership`, quantifier-nesting paragraphs) is `OPERAND_LEGALITY`'s cross-check against `expression.ts`'s doc text.
6. `tests/schemas/ad5-admissions.test.ts`, in full: every negative fixture this story's checks must now reject was already admitted there by an earlier story, with a one-line comment naming which future code owns it. Reuse its exact mutations rather than inventing new ones wherever the comment names this story.
7. `tests/schemas/fixtures/relevance-contracts.ts` and `gate-c-contract.ts`, in full: `populatedContract` and `gateCContract` are this story's two positive whole-contract regression fixtures, exactly as they were Story 4.1's. AC 3-6's own "verified against both whole-contract fixtures" notes above were checked by hand against these two files' literal content while writing this story; re-verify them against the files as actually read, not against this story's paraphrase, before writing the fixtures.
8. `_bmad-output/implementation-artifacts/4-1-pointer-resolution-and-reachability.md`, in full: house style, the `Object.hasOwn`/precondition-skip/"assumed compile-time-prevented" conventions this story inherits without restating their own reasoning, and the exact shape a Decisions section and a Dev Agent Record take in this codebase.

### Project structure notes

- Five new files under `src/core/compile/` (matching `reachability.ts`'s existing location), five new test files under `tests/compile/`. No file this story touches is deleted or renamed.
- No `core/schemas/` edit at all: no new declaration, no new value space, no spine text implicated, no `FailureCode` member added.
- `src/index.ts` not touched (AC 8), same rule as every Epic 3 and Story 4.1 story.

### Testing requirements

- `tsconfig.json`'s `noUncheckedIndexedAccess` applies to every array/tuple index and every object-map index this story's new code touches (`target.tail[0]`, `OPERAND_LEGALITY[op]?.[...]`, `types[firstToken]`); guard each with an explicit check or an `as` cast after the guard, matching the pattern Story 4.1's own code blocks show throughout.
- `biome.json`'s `useImportType`/`useExportType`: every type-only import (`EvalContract`, `Expression`, `Operand`, `SetOperand`, `Operation`, `PlanIndex`, and so on) is imported with `type` wherever it is used only as a type.
- No configured coverage threshold, matching every prior story's own note: the proxy is AC 7's fixture list plus assertions specific enough to fail if the property they name is removed.

### References

- `_bmad-output/planning-artifacts/epics.md`: Epic 4 intro (321-323), Story 4.1 (325-335), Story 4.2 (337-347).
- `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md`: AD-3 (165-183), AD-4 (185-202), AD-5 (203-241, the registry table), AD-16 (305-313, why forbidden-input codes stay out of scope), AD-19 (327-339), AD-20 (341-352, rule 2's operation-scoped denominator), AD-26 (384-392).
- `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/EPIC-BRIEF.md`: Epic 4 (112-131, the "containment... computed after quantifier substitution" line this story implements).
- `src/core/compile/reachability.ts`, `src/core/failure-codes.ts`, `scripts/check-ad5-registry.ts`.
- `src/core/evaluate/evidence-resolution.ts`, `resolution.ts`.
- `src/core/schemas/expression.ts`, `oracle.ts`, `eval-contract.ts`, `interface.ts`, `plan.ts`, `waiver.ts`, `reference-set.ts`, `pointer.ts`, `primitives.ts`.
- `tests/schemas/ad5-admissions.test.ts`, `tests/schemas/fixtures/relevance-contracts.ts`, `tests/schemas/fixtures/gate-c-contract.ts`, `tests/compile/reachability.test.ts`.
- `_bmad-output/implementation-artifacts/4-1-pointer-resolution-and-reachability.md`.

## Suggested Review Order

**`oracle-alignment.ts`'s substitution first, because it is the one place a subtle bug produces a plausible-looking wrong answer**

- `substitutePointer`: confirm the bare `@/` case (`tailSource === '/'`) resolves to `boundElementRoot` unchanged, and every other case is plain concatenation with no decode/re-encode step (Decision 1).
- `collectTargets`'s `for-all`/`for-any` branch: confirm `collection` is visited and added to `targets` at the *current* `boundElementRoot`, and the *substituted* collection pointer (not the raw `@/` form) becomes the new root passed into `predicate` — this is the one line that makes `gateCContract`'s O-004 fixture pass at all.
- `checkOracleAlignment` against `gateCContract`'s O-004 specifically: confirm it does not throw, and understand why a naive raw-text-scan implementation would have thrown here.

**`expression-legality.ts`'s shared walk next, since every other check in the file depends on it being right**

- `walkExpression`'s `for-all`/`for-any` case: `quantifierDepth` passed to `onQuantifier` is the *ambient* depth (before this node adds anything), and `predicate` descends at `quantifierDepth + 1` while `collection` stays at the ambient depth — verify against AC 7 fixture 24 (two sibling top-level quantifiers must not trip nesting on each other; depth must not leak across branches of the recursion).
- `OPERAND_LEGALITY`: spot-check three entries against `expression.ts`'s own `operandTypes(...)` text directly, not against this story's transcription of it — `containment` (asymmetric: position 0 pointer-only, position 1 all three kinds) is the one entry most likely to be mistyped.
- `checkQuantifierOverNonCollection`'s channel scoping (Decision 3): confirm it returns permissively for any non-`response-body` collection pointer before reaching the type lookup, and reuses `makePointerDenotesCollection` rather than reimplementing the root-collection check.

**Every other module**

- `checkDuplicateOperationSignature`'s cross-interface scoping (Decision 4): confirm the linear scan covers every interface's operations in one flat list, not one interface at a time.
- `checkUndeclaredMandatoryInput`: confirm it silently skips a step naming an undeclared operation (AC 5's own documented exception) rather than throwing `TypeError` or a coded failure.
- `checkWaiverCompleteness`: confirm `condition` is excluded from `REQUIRED_WAIVER_PARTS` and AC 7 fixture 39 is present and passing.

**Fixtures**

- Every "verified against both whole-contract fixtures" claim in AC 2-6: re-run `populatedContract`/`gateCContract` through the actual implementation and confirm zero throws, rather than trusting this story's own hand-verification.
- Every `ad5-admissions.test.ts` fixture this story's AC 7 claims to reuse: confirm the mutation is copied faithfully (same field path, same mutated value) rather than approximated.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5), via Claude Code.

### Debug Log References

- Preflight baseline (before the first edit): `npm run check:docs` → "55 file(s) OK"; `npm test` →
  37 files, 1585 tests passing.
- Post-implementation: `npm run validate` green end to end — typecheck, lint (one pre-existing biome
  schema-version info, unrelated to this story and present on `biome.json` before any edit here),
  `check:docs` (55 files, unchanged), `check:shareable`, `lint:spine` (0 findings, expected no-op per
  AC 8), `check:vectors`, `check:schemas`, `check:ad5-registry` (21 codes, set- and order-equal,
  expected no-op per AC 8), and `npm test` → 42 files, 1630 tests passing (37→42 files, 1585→1630
  tests: exactly the five new test files and 45 new fixtures this story adds).
- Two rounds of `npm run lint`/`lint:fix` were needed after transcribing the story's own code blocks
  verbatim: Biome's formatter reflowed several multi-argument call sites (no logic change), and its
  `useIterableCallbackReturn` rule flagged four `expr.operands.forEach((operand, index) =>
  visitor.onOperand?.(...))` arrow-expression bodies in `expression-legality.ts`'s `walkExpression`
  (the callback's implicit return value, even though `onOperand` itself returns `void`). Converted
  those four to block-bodied arrows (`=> { visitor.onOperand?.(...) }`); no behavior change, confirmed
  by re-running the affected fixtures before and after.
- Post-review (see Review Findings below): `npm run validate` re-run green end to end, same shape as
  above; `npm test` → 42 files, 1631 tests passing (1630→1631: the one review-added fixture in
  `interface-inventory.test.ts`, which now carries 11 tests).
- Codex follow-up review: reproduced 15 failures at the standalone structural-check boundary before
  editing production code. After all accepted patches, `npm run validate` passed end to end and
  `npm test` reported 42 files, 1669 tests passing (1631→1669: 38 focused regression cases). The
  pre-existing Biome schema-version info encountered during that gate was also closed by aligning
  `biome.json` with the installed 2.5.8 CLI.

### Completion Notes List

- Implemented exactly the code in AC 2-6 as specified, aside from Biome's own reflow and the four
  `forEach` callback bodies noted above (both purely mechanical, no logic changed).
- All 8 decisions in "Decisions taken during story creation" were taken as stated; none moved from its
  recorded default.
- Implemented all 40 AC 7 fixtures, one `it` block per fixture except where `it.each` combines a small
  family (fixture 30's three interface kinds, fixture 38's four waiver parts) into one block per the
  story's own precedent. Total: 45 tests across `tests/compile/declarations.test.ts` (7),
  `oracle-alignment.test.ts` (8), `expression-legality.test.ts` (13), `interface-inventory.test.ts`
  (10), and `waivers.test.ts` (7).
- Fixture 33 ("two operations differing only by method... do not collide") needed a method distinct
  from every operation already in `populatedContract`, not merely from the operation it was cloned
  from: `populatedContract` already declares `POST /things` (`create-thing`), so a naive `PUT`-free
  choice would have collided by accident with a fixture the test never intended to touch. Used `PUT`,
  documented in the test's own comment.
- `EvalContract.parse(...)` (not a type cast) is used wherever a genuinely `EvalContract`-typed value
  is needed without mutation (every "positive whole-fixture regression" fixture), matching Story 4.1's
  own precedent; every mutated-contract fixture follows `ad5-admissions.test.ts`'s own
  `structuredClone(...) as any` convention.
- No AC, Task, or Decision was left incomplete. Nothing in `src/index.ts` was touched. No existing
  `src/` file's behavior changed: this story only adds five new files under `src/core/compile/` and
  five new test files under `tests/compile/`.
- Story Status set to `done` and `sprint-status.yaml`'s entry for this story set to `review`, matching
  Story 4.1's own recorded convention (a story file reading `done` while `sprint-status.yaml` reads
  `review` is by design, pending peer review).
- `_bmad-output/implementation-artifacts/deferred-work.md` was left untouched during implementation:
  this story surfaced no new gap beyond the one AC 1 already names and declines to fix (AD-16's two
  forbidden-input codes). At implementation time it appeared to still carry unrelated uncommitted
  merge-conflict markers predating this story's work; step-04 review found the working copy already
  clean (no markers, all three of that side's items independently closed elsewhere in the file), so
  the earlier observation was stale rather than acted on. Step-04 itself later appended five new
  `defer` entries to this file (see Review Findings) for gaps the review surfaced.

### Review Findings

Step-04 review found 3 patch-level findings on this story's diff. All three were real and fixed.

1. `tests/compile/interface-inventory.test.ts`: no fixture exercised Decision 4's cross-interface
   scope for `checkDuplicateOperationSignature`. Fixtures 29 and 31-33 only ever populate one
   `permittedInterfaces` entry, so a regression to per-interface scoping (checking `seen` fresh per
   interface instead of once across all of them) would have passed every existing fixture. Added one:
   a second `permittedInterfaces` entry whose one operation collides by method plus erased path
   template with an operation already declared under the first, asserting the thrown failure's
   `artifactPath` names the new interface's operation and its message names the original's.
2. `_bmad-output/project-knowledge/learning-path-step-by-step.md`: Step 13's mermaid diagram drew
   `PLANIDX2 --> ORACLE`, implying `oracle-alignment.ts` imports `plan-index.ts`. It doesn't:
   `oracle-alignment.ts` imports only `failure-codes.ts` and `schemas/*`. Edge removed.
3. `src/core/compile/expression-legality.ts`: three doc comments cited "(Decision 3 there)",
   "(Decision 5 below)", "(Decision 8 below)" as if some file in the source tree defines "Decision
   N", when the decisions exist only in this story's own markdown, and "there" versus "below" was
   inconsistent for the same kind of reference. Reworded all three to "(see Story 4.2's Decision N)",
   matching the phrasing this file's own `checkReferenceSetResolution` comment and `oracle-
   alignment.ts` already use for a Story 4.1 decision citation.

Five real, pre-existing-pattern findings were classified `defer` (not this story's root cause, no
loopback triggered) and appended to `deferred-work.md`: the still-unowned AD-16 gap; unbounded
`not`/`all`/`any` recursion depth across every compile-check tree walk (inherited from Story 4.1's
`reachability.ts`); `buildPlanIndex`/`parseEvidenceTarget` throwing a raw `TypeError` instead of a
coded `StructuralFailure` on a schema-legal duplicate `operationId` across interfaces (root cause in
Story 4.1's `plan-index.ts`, reused unchanged here); `checkOracleAlignment`'s relation-containment
check degenerating to near-vacuous when `direction.relation` names a connective/quantifier op (7 of
8 shipped Gate C oracles); and `checkQuantifierOverNonCollection` silently skipping a nested
quantifier's own `@`-prefixed collection pointer instead of substituting it. Several lower-confidence
findings (an OPERAND_LEGALITY future-op gap, waiver-message specificity, an O(n²) dedup scan, a
missing false-positive-pinning fixture, AC 4's code sample lagging a mechanical Biome reformat) were
classified `reject` as noise or already-adequate.

The Codex follow-up closed the Story 4.2 portion of the duplicate-index issue: the index now has an
opt-in `unresolved` duplicate policy, and this story's two standalone checks use it so ambiguous IDs
stay non-crashing and permissive. Existing strict callers retain the default throw, so the broader
cross-artifact design gap remains accurately queued in `deferred-work.md`.

#### Codex follow-up review (2026-08-25)

- [x] [Review][Patch] Reject duplicate `covers-by-key` values in the referenced expected set [src/core/compile/expression-legality.ts:200]
- [x] [Review][Patch] Reject syntactically invalid ECMA-262 regex patterns during compilation [src/core/compile/expression-legality.ts:234]
- [x] [Review][Patch] Reject patterns whose whole expression is not anchored [src/core/compile/expression-legality.ts:234]
- [x] [Review][Patch] Treat every declared non-array JSON type as non-collection, even when `collectionLocations` contradicts it [src/core/compile/expression-legality.ts:286]
- [x] [Review][Patch] Keep structural checks total when schema-legal step or operation identifiers repeat [src/core/seal/plan-index.ts:148]
- [x] [Review][Patch] Reject `ordering` over `call-inputs`, since ordering is output-only [src/core/compile/expression-legality.ts:200]
- [x] [Review][Patch] Point `oracle-missing-channel` at the exact missing field [src/core/compile/oracle-alignment.ts:17]
- [x] [Review][Patch] Encode caller keys unambiguously in mandatory-input artifact paths [src/core/compile/interface-inventory.ts:88]
- [x] [Review][Patch] Make the operand-legality table exhaustive at compile time [src/core/compile/expression-legality.ts:172]
- [x] [Review][Patch] Replace quadratic duplicate-signature lookup with a map [src/core/compile/interface-inventory.ts:41]
- [x] [Review][Patch] Cover every operand-bearing operator and position with a negative legality fixture [tests/compile/expression-legality.test.ts:32]
- [x] [Review][Patch] Cover named backreferences and negative lookbehind [tests/compile/expression-legality.test.ts:65]
- [x] [Review][Patch] Cover `for-any` over a scalar response field [tests/compile/expression-legality.test.ts:97]
- [x] [Review][Patch] Cover the inherited `constructor` reference-set trap [tests/compile/expression-legality.test.ts:187]
- [x] [Review][Patch] Cover erasure of every parameter in a multi-parameter path [tests/compile/interface-inventory.test.ts:40]
- [x] [Review][Patch] Cover undeclared bindings in all four transport channels [tests/compile/interface-inventory.test.ts:137]
- [x] [Review][Patch] Correct the deferred-work header now that open entries exist [_bmad-output/implementation-artifacts/deferred-work.md:3]

### File List

- `src/core/compile/declarations.ts` (new)
- `src/core/compile/oracle-alignment.ts` (new)
- `src/core/compile/expression-legality.ts` (new)
- `src/core/compile/interface-inventory.ts` (new)
- `src/core/compile/waivers.ts` (new)
- `src/core/evaluate/evidence-resolution.ts` (edited: accepts a caller-supplied plan index)
- `src/core/seal/plan-index.ts` (edited: opt-in duplicate IDs as unresolved)
- `biome.json` (edited: schema URL aligned with Biome 2.5.8)
- `tests/compile/declarations.test.ts` (new)
- `tests/compile/oracle-alignment.test.ts` (new)
- `tests/compile/expression-legality.test.ts` (new)
- `tests/compile/interface-inventory.test.ts` (new)
- `tests/compile/waivers.test.ts` (new)
- `tests/seal/plan-index.test.ts` (edited: duplicate-tolerant index fixture)
- `_bmad-output/project-knowledge/learning-path-step-by-step.md` (edited: Step 13 row and section added)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (edited: this story's status → `done`)
- `_bmad-output/implementation-artifacts/deferred-work.md` (edited: 5 new `defer` entries from step-04 review)

## Suggested Review Order

**Quantifier-substitution oracle alignment (AD-3)**

- Entry point: AD-3's structural containment, computed after quantifier substitution rather than over surface pointer text.
  [`oracle-alignment.ts:114`](../../src/core/compile/oracle-alignment.ts#L114)

- The substitution walk `checkOracleAlignment` depends on: rewrites `@/…` pointers against each open quantifier's bound element as it descends `check`.
  [`oracle-alignment.ts:73`](../../src/core/compile/oracle-alignment.ts#L73)

- The pure string-substitution primitive both `collectTargets` and `checkQuantifierOverNonCollection` (below) build on.
  [`oracle-alignment.ts:45`](../../src/core/compile/oracle-alignment.ts#L45)

- Simpler sibling check: fires when either of an oracle's two required channels is `null`.
  [`oracle-alignment.ts:17`](../../src/core/compile/oracle-alignment.ts#L17)

**Shared check-tree walk and its five derived checks**

- The one recursive visitor all five `expression-legality.ts` checks share, generalizing `reachability.ts`'s own walk.
  [`expression-legality.ts:51`](../../src/core/compile/expression-legality.ts#L51)

- Most complex derived check: reuses Story 4.1's `makePointerDenotesCollection` rather than reimplementing the collection carve-out.
  [`expression-legality.ts:304`](../../src/core/compile/expression-legality.ts#L304)

- Per-position operand-kind legality, transcribed from each operator's own schema doc comment.
  [`expression-legality.ts:200`](../../src/core/compile/expression-legality.ts#L200)

- Bounds quantifier and `covers-by-key` nesting to one level via the shared visitor's depth counter.
  [`expression-legality.ts:259`](../../src/core/compile/expression-legality.ts#L259)

- Resolves `{ referenceSet }` operands against `contract.referenceSets`, using `Object.hasOwn` to dodge the `constructor` trap.
  [`expression-legality.ts:358`](../../src/core/compile/expression-legality.ts#L358)

- Syntactic (not parsed) rejection of backreferences and lookbehinds, an honestly-documented imperfect scan.
  [`expression-legality.ts:234`](../../src/core/compile/expression-legality.ts#L234)

**Interface inventory checks (AD-19, AD-40)**

- Scans the whole operation inventory as one flat list, not per-interface, so a signature can collide across two different `permittedInterfaces`.
  [`interface-inventory.ts:41`](../../src/core/compile/interface-inventory.ts#L41)

- Cross-interface scope this function depends on, closed by review: proves the flat-list scan actually catches a two-interface collision.
  [`interface-inventory.test.ts:88`](../../tests/compile/interface-inventory.test.ts#L88)

- Flags an input-binding key the bound operation's request shape declares in neither `requiredKeys` nor `permittedKeys`.
  [`interface-inventory.ts:72`](../../src/core/compile/interface-inventory.ts#L72)

**Per-behaviour declarations and waiver completeness**

- AD-19's requirement-or-risk linkage check: fires only when both link arrays are empty.
  [`declarations.ts:14`](../../src/core/compile/declarations.ts#L14)

- AD-19's sibling: fires on a `null` criterion, never on an empty oracle list.
  [`declarations.ts:30`](../../src/core/compile/declarations.ts#L30)

- AD-5/AD-6/AD-21's four-part completeness check; `condition` deliberately excluded since AD-5 permits it absent.
  [`waivers.ts:18`](../../src/core/compile/waivers.ts#L18)

**Peripherals**

- The load-bearing regression proof: O-004's direction target appears nowhere as raw text in its check tree, only substitution produces it.
  [`oracle-alignment.test.ts:47`](../../tests/compile/oracle-alignment.test.ts#L47)

- Positive/negative fixtures for every `expression-legality.ts` export.
  [`expression-legality.test.ts:1`](../../tests/compile/expression-legality.test.ts#L1)

- Positive/negative fixtures for the two `declarations.ts` checks.
  [`declarations.test.ts:1`](../../tests/compile/declarations.test.ts#L1)

- Positive/negative fixtures for `checkWaiverCompleteness`, including the `condition: null` non-fire case.
  [`waivers.test.ts:1`](../../tests/compile/waivers.test.ts#L1)

- Step 13 added for this story's five modules; a review-found wrong dependency edge was removed.
  [`learning-path-step-by-step.md`](../project-knowledge/learning-path-step-by-step.md)

- Five new `defer` entries from step-04 review, plus five older entries' closures consolidated.
  [`deferred-work.md`](deferred-work.md)
