# Story 6.4: Artifact immutability and lineage enforcement

Status: done

Epic: 6 (ports, pre-flight, and the library and CLI surface)
Story key: `6-4-artifact-immutability-and-lineage-enforcement`
Implements: AD-29 in full, AD-12's three named chain checks and its remediation cap, and AD-24's
stage-signature table as compiled code. Closes the spine's "Owed to the reference implementation"
item 6 (`ARCHITECTURE-SPINE.md:721-726`, "The stage-signature table AD-24 asserts does not exist"),
whose own prescribed fix is "publish it as compiled TypeScript interface fixtures before any stage
is written". It closes the table half of that item and records in AC 1 which half stays open.

## Story

As the audit trail,
I want artifacts created once with explicit lineage,
so that a revision is a new artifact and history cannot be rewritten in place.

## Acceptance Criteria

### AC 1: Scope, module locations, and what this story does not build

AD-29 has shipped as prose in eleven schema descriptions and as two hand-written comments since
Story 2.2. `src/core/schemas/lineage.ts:27-28` states the `parentDigest`/`revisionCount`
biconditional and says a refinement would be invisible to a non-TypeScript consumer;
`src/core/schemas/constraint-ledger.ts:128-154` generates one `not-expressible` ledger entry per
lineage-bearing artifact and closes with "left to the reader that validates a presented chain". This
story is that reader.

Its output shape is already published and already required. `src/core/schemas/evidence-artifact.ts:
217-221` declares `LineageChain` as three booleans — `lengthConsistent`, `noRepeatedDigest`,
`noGap` — transcribed from AD-12's own sentence, and `Remediation.lineageChain`
(`evidence-artifact.ts:236`) makes it required on every Evidence Artifact. So this story does not
invent a verdict shape; it computes the one `emit` will serialize, and carries the finding
vocabulary that says which of three ways a chain failed.

`src/core/stage-contracts.ts:6-7` names this story by number as the owner of AD-24's table.

**Every ```ts block in this file is labelled either `VERBATIM` (copy it into source as written) or
`SKETCH` (declarations only, showing the exported surface; the dev writes the bodies).**

**New files:**

| Path | Layer | Holds |
| --- | --- | --- |
| `src/core/lineage/stage-table.ts` | `core` | AD-24's six-stage signature table, the twelve-artifact producer map, and `deriveLineageWriterModules` |
| `src/core/lineage/freeze.ts` | `core` | `freezeArtifact` |
| `src/core/lineage/chain.ts` | `core` | `validateLineageChain`, `reviseArtifact`, `LINEAGE_DEFECT_CODES` |
| `scripts/token-scan.ts` | script | the tokenizer both source-scanning gates share (Decision 13) |
| `scripts/lineage-ownership.ts` | script | the pure scanner: who writes the two lineage fields |
| `scripts/check-lineage-ownership.ts` | script | the CLI wrapper behind `npm run check:lineage` |
| `tests/preflight/fixtures/probe-port.ts` | test fixture | the probe-port fake and its body table, extracted so AC 11 case 14 reuses one subject |
| `tests/lineage/stage-table.test.ts` | test | cases 1 through 10 |
| `tests/lineage/freeze.test.ts` | test | cases 11 through 15 |
| `tests/lineage/chain.test.ts` | test | cases 16 through 40 |
| `tests/architecture/lineage-ownership.test.ts` | test | cases 41 through 51 |
| `tests/architecture/token-scan.test.ts` | test | cases 52 through 58 |

**Edited files:**

- `src/core/schemas/evidence-artifact.ts`: one added type export, `LineageChain` (AC 7).
- `src/core/seal/seal.ts`: freeze the returned brief (AC 6).
- `src/core/preflight/reduce.ts`: freeze the returned verdict (AC 6).
- `src/application/compile.ts`: freeze the returned contract (AC 6).
- `src/application/preflight.ts`: freeze the returned verdict (AC 6).
- `src/core/stage-contracts.ts`: the JSDoc sentence that defers to this story (AC 10).
- `scripts/dependency-direction.ts`: its tokenizer moves to `scripts/token-scan.ts` and its module
  header loses the paragraph that went with it (Decision 13).
- `tests/application/preflight.test.ts`: import the extracted probe fake instead of its file-local
  copy (AC 11).
- `package.json`: one script, one entry in `validate` (AC 9).
- `biome.json`: one override turning `noTemplateCurlyInString` off for
  `tests/architecture/token-scan.test.ts`, whose fixtures are source text carrying `${`.
- `README.md` and `_bmad-output/shareable/eval-quality-readme.html` (AC 12).
- `_bmad-output/project-knowledge/learning-path-step-by-step.md` (AC 12).

**No `.describe()` string changes and no generated-document changes.** The one schema edit is a type
export, which Story 6.3 proved is erased before the schema builder runs. `schemas/` must stay
byte-identical; AC 13 carries it as a row rather than a claim.

**This story does not build:**

- A new code in AD-5's or AD-28's registry. Decision 1 is the argument, and it is the decision most
  likely to be re-opened by a reviewer.
- Lineage tracking across invocations. AD-29 says the package "validates a presented chain and does
  not track lineage across invocations, per AD-12". `validateLineageChain` takes the whole chain as
  one argument and holds no state between calls.
- Any merge, rebase, or resolution of a conflict. AD-29 says a conflict is "to surface, never to
  merge"; the report names it and stops.
- Enforcement of the remediation cap across evaluations. AD-12 is explicit that the package "does
  not and cannot enforce the remediation cap globally". AC 7 checks the presented chain against a
  caller-supplied cap, which is the whole of what AD-12 asks for, and the `capSource:
  'caller-attested'` field that records the limit of that check already exists on the Evidence
  Artifact (`evidence-artifact.ts:230-235`).
- The verdict rung. AD-21's FAIL rung reads "a presented lineage chain that is internally
  inconsistent under AD-12" and AD-32 lists lineage consistency among the checks that invalidate.
  Both are score-side, and the epic's stage-one scope excludes `score`. Decision 12 records the
  tension so the story that wires the rung inherits it stated rather than has to rediscover it.
- The second half of the spine's Owed item 6. That item names two defects: the missing table, and
  "the source of run mode is absent". AC 3 names `score`'s owned output so the first is closed; run
  mode belongs to AD-21's mode separation, which is score-side and stays open.
- The CLI half of the epic's acceptance criterion. There is no `src/cli/` yet; Story 6.5 owns it.
  AC 6 and AC 11 enforce the half that exists: the library boundary hands back a frozen artifact
  that shares no structure with its input.
- `ingest`, `score`, and `emit`. Their rows in AC 3's table are declarations with `module: null`,
  which is what makes the table a contract for the stages that do not exist yet.
- The barrel. `src/index.ts` is untouched, and AC 13 carries a `git diff --exit-code` row for it.

### AC 2: `src/core/lineage/stage-table.ts` — the exported surface  (SKETCH)

```ts
/**
 * AD-24's stage-signature table and AD-29's producer map, as data. Six stages,
 * each with its inputs, its single owned output, and the lineage edge it
 * writes; twelve interchange artifacts, each with exactly one producer.
 *
 * Data rather than prose because three readers need it: this story's tests,
 * the `check:lineage` scanner that derives its allowlist from `module`, and
 * the stages themselves once `ingest`, `score`, and `emit` are written.
 *
 * The registry import is type-only, which keeps zod and twelve schema modules
 * off the `check:lineage` load path.
 */
import type { InterchangeArtifactKey } from '../schemas/artifact.ts'

export const PIPELINE_STAGES = [
	'compile',
	'seal',
	'ingest',
	'preflight',
	'score',
	'emit',
] as const

export type PipelineStage = (typeof PIPELINE_STAGES)[number]

/** typed stage products that no schema publishes (AD-24). */
export const INTERNAL_PRODUCTS = [
	'probe-plan',
	'probe-observations',
	'validated-observations',
	'scored-outcomes-and-verdict',
] as const

export type InternalProduct = (typeof INTERNAL_PRODUCTS)[number]

/** what a stage does to the two AD-29 fields on the artifact it owns. */
export type LineageEdge = 'mints' | 'carries-through' | 'none'

/** who produces an interchange artifact. */
export type ArtifactProducer = PipelineStage | 'caller' | 'embedded'

export type StageSignature = {
	readonly inputs: readonly (InterchangeArtifactKey | InternalProduct)[]
	readonly owns: InterchangeArtifactKey | InternalProduct
	/** the owned output's registry key, or null when the output is an internal product. */
	readonly ownsInterchange: InterchangeArtifactKey | null
	readonly lineage: LineageEdge
	/** the module that writes the artifact, or null while the stage is unbuilt. */
	readonly module: string | null
}

export const STAGE_SIGNATURES: Record<PipelineStage, StageSignature>

export const ARTIFACT_PRODUCERS: Record<InterchangeArtifactKey, ArtifactProducer>

/** the modules permitted to write `parentDigest` or `revisionCount`, derived from a table. */
export function deriveLineageWriterModules(
	signatures: Record<PipelineStage, StageSignature>,
): readonly string[]

export const LINEAGE_WRITER_MODULES: readonly string[]
```

`LINEAGE_WRITER_MODULES` is `deriveLineageWriterModules(STAGE_SIGNATURES)`, never a hand-written
array: every row whose `lineage` is `mints` contributes its `module`, and a `null` module
contributes nothing. The derivation is exported as its own function because a module-level constant
is evaluated once at import, so a test cannot mutate the table and watch the constant follow. Case 6
calls the function with a mutated copy, which is the only shape that distinguishes a derivation from
a literal that happens to hold the same two strings today.

The module holds no other exports, no runtime imports, and no other functions.

### AC 3: the six-stage signature table  (VERBATIM)

```ts
export const STAGE_SIGNATURES: Record<PipelineStage, StageSignature> = {
	compile: {
		inputs: ['eval-contract'],
		owns: 'eval-contract',
		ownsInterchange: 'eval-contract',
		lineage: 'carries-through',
		module: 'src/core/compile/compile.ts',
	},
	seal: {
		inputs: ['eval-contract'],
		owns: 'sealed-evaluator-brief',
		ownsInterchange: 'sealed-evaluator-brief',
		lineage: 'mints',
		module: 'src/core/seal/seal.ts',
	},
	ingest: {
		inputs: [
			'sealed-run-record',
			'isolation-manifest',
			'evaluator-configuration',
		],
		owns: 'validated-observations',
		ownsInterchange: null,
		lineage: 'none',
		module: null,
	},
	preflight: {
		inputs: ['eval-contract', 'probe', 'probe-plan', 'probe-observations'],
		owns: 'preflight-verdict',
		ownsInterchange: 'preflight-verdict',
		lineage: 'mints',
		module: 'src/core/preflight/reduce.ts',
	},
	score: {
		inputs: [
			'eval-contract',
			'validated-observations',
			'probe',
			'preflight-verdict',
			'scoring-policy',
		],
		owns: 'scored-outcomes-and-verdict',
		ownsInterchange: null,
		lineage: 'none',
		module: null,
	},
	emit: {
		inputs: ['scored-outcomes-and-verdict'],
		owns: 'evidence-artifact',
		ownsInterchange: 'evidence-artifact',
		lineage: 'mints',
		module: null,
	},
}
```

Every row is settled by a citation, and the dev should open each before transcribing:

| Row | Settled by |
| --- | --- |
| `seal` owns `sealed-evaluator-brief` | `sealed-evaluator-brief.ts:63`, "this artifact is generated by `seal`" |
| `preflight` owns `preflight-verdict` | `preflight-verdict.ts:50`, "a pure function of the observations the environment-probe port returned" |
| `emit` owns `evidence-artifact` | AD-24, "the Evidence Artifact belongs to `emit`"; `evidence-artifact.ts:316` repeats it |
| `ingest` and `score` own internal products | AD-24, "internal stage products such as the probe plan and ingested observations are typed but need not be published" |
| `score`'s output is named `scored-outcomes-and-verdict` | AD-24, "`score` produces the outcome **and verdict** values `emit` serializes". Owed item 6's stated defect is that this type is unnamed; naming both halves is what closes it. |
| `preflight`'s inputs carry the plan and the observations | AD-34 splits the stage into `plan(contract, probes)` and `reduce(plan, observations)`; both halves' inputs are the stage's inputs |
| `emit`'s only input is `score`'s output | the Structural Seed's transformation line, "outcomes -> Evidence Artifact" |
| `compile`'s row is an identity | Decision 3 |
| `preflight`'s module is `reduce.ts`, not `plan.ts` | only the reduce half returns an artifact, so only it writes lineage |

`module` names the file that writes the artifact, which is why `compile`'s is
`src/core/compile/compile.ts` rather than the application wrapper. The application layer awaits and
validates; it never mints.

`emit`'s `module` is `null` while `src/core/emit/` does not exist. AC 9's scanner treats a `null`
module as "contributes no writer", so an unbuilt stage cannot widen the allowlist.

### AC 4: the twelve-artifact producer map  (VERBATIM)

```ts
export const ARTIFACT_PRODUCERS: Record<InterchangeArtifactKey, ArtifactProducer> =
	{
		'eval-contract': 'compile',
		rubric: 'caller',
		'sealed-evaluator-brief': 'seal',
		'sealed-run-record': 'caller',
		'isolation-manifest': 'caller',
		'evaluator-configuration': 'caller',
		probe: 'caller',
		'artifact-reference': 'embedded',
		'private-artifact-manifest': 'caller',
		'preflight-verdict': 'preflight',
		'scoring-policy': 'caller',
		'evidence-artifact': 'emit',
	}
```

The seven `caller` rows divide into two kinds, and the story says which is which rather than
claiming all seven are equally settled:

| Key | Evidence | Kind |
| --- | --- | --- |
| `sealed-run-record` | `sealed-run-record.ts:301`, "as the caller presents it" | stated |
| `isolation-manifest` | `isolation-manifest.ts:13`, "the harness's record of what it actually enforced" | stated |
| `private-artifact-manifest` | `private-artifact-manifest.ts:1`, the index "this repository" keeps | stated |
| `rubric` | `eval-contract.ts:150` embeds `RubricBody`; `rubric.ts:85-89` shows the published artifact is that body plus lineage. No stage constructs one. | stated |
| `evaluator-configuration` | `evaluator-configuration.ts:57` names ingest as the reader that digests it and names no producer | argued from absence |
| `scoring-policy` | `scoring-policy.ts:1` names the scorer as its reader and calls it a published artifact | argued from absence |
| `probe` | reaches the package as a `runPreflight` argument (`src/application/preflight.ts:25`); under AD-8 its bytes resolve through the corpus port, so "caller" means the caller supplies both the artifact and the port | argued from absence |

Three rows are therefore an inference from a schema that names a reader and no producer. That is
recorded here rather than smoothed over, because the alternative reading — a producer the package
does not have — would require inventing a stage.

`artifact-reference` is the one `embedded` row, and it is the one registry entry flagged
`carriesLineage: false` (`artifact.ts:69-73`, the flag at `:72`). Case 9 asserts both directions, so
the exemption is cross-checked rather than restated.

### AC 5: `src/core/lineage/freeze.ts`  (VERBATIM)

```ts
/**
 * AD-29's "created once and never edited in place", made mechanical. A stage
 * freezes the artifact it owns, and `application/` freezes what crosses the
 * package boundary.
 */

/**
 * Arrays and plain objects, which is every node of an AD-27 JSON artifact. A
 * `Date`, `Map`, `Set`, or typed array is left alone: freezing one protects
 * nothing it holds, and `Object.freeze` on a non-empty typed array throws.
 */
function isJsonContainer(value: unknown): value is object {
	if (value === null || typeof value !== 'object') return false
	if (Array.isArray(value)) return true
	const prototype = Object.getPrototypeOf(value)
	return prototype === Object.prototype || prototype === null
}

/**
 * Deep-freezes a parsed artifact in place and returns it. Call it on a value
 * you own: every wired site hands it a Zod clone or a freshly built literal.
 * An already-frozen node is returned untouched, which terminates the walk on a
 * cycle and leaves a hand-frozen subtree's descendants as they were.
 */
export function freezeArtifact<T>(value: T): T {
	if (!isJsonContainer(value)) return value
	if (Object.isFrozen(value)) return value
	Object.freeze(value)
	// An array's indices are its enumerable own keys, so this covers both.
	for (const member of Object.values(value)) freezeArtifact(member)
	return value
}
```

Four properties the dev must not lose while transcribing:

1. **`isJsonContainer` runs first.** `Object.freeze` on a non-empty `Uint8Array` throws
   (`TypeError: Cannot freeze array buffer views with elements`), and the port messages already
   carry one (`src/core/schemas/port-messages.ts:26,44,49`). Freezing a `Date`, `Map`, or `Set`
   protects nothing they hold, so a half-freeze would be worse than leaving them. Case 12 asserts
   both halves.
2. **`Object.freeze` runs before the recursion.** A cyclic value would otherwise recurse forever.
   Case 13 is a cycle, because a shared subtree under two parents does not distinguish the guarded
   walk from an unguarded one: both terminate. A cycle is the only input that does.
3. **The return type is `T`, not `Readonly<T>` or a deep-readonly mapped type.** Decision 4.
4. **`Object.values` covers arrays.** An array's indices are its enumerable own keys, so no
   `Array.isArray` branch is needed inside the walk. Case 11 asserts a nested array element is
   frozen, because that is the branch a "simplification" would delete.

Freezing is silent on a non-strict write and throws on a strict one. Every module here is ESM, which
is always strict, so a caller writing to a frozen artifact gets a `TypeError`. Case 11 asserts the
throw rather than `Object.isFrozen` alone.

The function mutates its argument, which is an effect on something outside it in AD-1's literal
sense. Conformance rests on call-site discipline, so the module JSDoc states the precondition
("call it on a value you own") and case 15 holds it for the one site where the question is live.

### AC 6: the four freeze sites  (VERBATIM edits)

| File | Edit |
| --- | --- |
| `src/core/seal/seal.ts` | `return validateAssembledBrief(brief)` becomes `return freezeArtifact(validateAssembledBrief(brief))` |
| `src/core/preflight/reduce.ts` | the returned object literal is wrapped: `return freezeArtifact({ … })` |
| `src/application/compile.ts` | `return compileContract(parsed.data, { … })` becomes `return freezeArtifact(compileContract(parsed.data, { … }))` |
| `src/application/preflight.ts` | `return parsedVerdict.data` becomes `return freezeArtifact(parsedVerdict.data)` |

Two of the four carry a comment, and neither repeats the general rule, which lives in `freeze.ts`'s
module JSDoc. `application/preflight.ts` freezes a second time because `PreflightVerdict.safeParse`
returns a fresh unfrozen object, so the core freeze does not survive boundary validation.
`src/core/seal/seal.ts` records Decision 5's aliasing argument, which is a different fact and the
one a reader is most likely to doubt.

`application/compile.ts` freezes although `compile` mints nothing: the contract it returns is Zod's
deep clone of the caller's input (`compile.ts:28-29` already says so), and freezing makes the
clone's independence visible to the caller instead of only true.

**This wiring was executed against a scratch copy of the tree before the story was approved.** The
full gate ran green with all four sites wired: 68 test files / 2563 tests, `tsc --noEmit` clean,
`check:layers` 0 violations, `check:schemas` 12 documents byte-identical. Decision 5 records the one
aliasing question that had to be answered to get there.

Layer direction: `application/` may import `core/` (`scripts/dependency-direction.ts:87-88`), and
`core/seal` and `core/preflight` importing `core/lineage` is a same-layer edge `isAllowedEdge`
already returns `true` for (`scripts/dependency-direction.ts:76,80`).

### AC 7: `src/core/lineage/chain.ts` — the presented-chain reader  (SKETCH)

```ts
import { digestArtifact } from '../canonical/digest.ts'
import type { LineageChain } from '../schemas/evidence-artifact.ts'
import { RuntimeFault } from '../schemas/faults.ts'
import { freezeArtifact } from './freeze.ts'

export const LINEAGE_DEFECT_CODES = [
	'lineage-root-invalid',
	'lineage-duplicate-artifact',
	'lineage-no-root',
	'lineage-multiple-roots',
	'lineage-parent-absent',
	'lineage-revision-not-successor',
	'lineage-revision-conflict',
	'lineage-length-inconsistent',
	'lineage-remediation-cap-exceeded',
] as const

export type LineageDefectCode = (typeof LINEAGE_DEFECT_CODES)[number]

/** the three fields `lineage.ts` spreads, as the shape this module reads. */
export type LineageFields = {
	readonly schemaVersion: number
	readonly parentDigest: string | null
	readonly revisionCount: number
}

export type LineageFinding = {
	readonly code: LineageDefectCode
	readonly artifactPath: string
	readonly detail: string
}

export type LineageChainOptions = {
	readonly artifactPath: string
	readonly acceptedSchemaVersion: number
	readonly declaredRevisionCount: number
	readonly remediationCap: number | null
}

export type LineageChainReport = {
	readonly artifactPath: string
	readonly findings: readonly LineageFinding[]
	readonly checks: LineageChain
	readonly passed: boolean
}

/** which of AD-12's three booleans each code clears; null for the cap. */
export const CHECK_PROJECTION: Record<
	LineageDefectCode,
	keyof LineageChain | null
>

/** Validates one presented chain of revisions of a single artifact type. */
export function validateLineageChain<T extends LineageFields>(
	artifacts: readonly T[],
	options: LineageChainOptions,
): LineageChainReport

/** Mints the next revision of `parent`: a new artifact, never an edit of the old one. */
export function reviseArtifact<T extends LineageFields>(
	parent: T,
	body: Omit<T, 'parentDigest' | 'revisionCount'>,
	artifactPath: string,
): T
```

**`CHECK_PROJECTION` is exported and is a `Record` over the code union.** That is what makes the
projection total by construction: a tenth code is a compile error in this file before it can reach a
report with no boolean to affect. Case 31 asserts the same thing at runtime and names the one
deliberate null.

**Preconditions, stated because the parameter type cannot carry them.** Each member is a whole
artifact already parsed against one published schema, which is the precondition every `core/`
function has: `application/` validates artifacts in both directions (AD-28) and `core/` reads parsed
values. The type parameter `T` is what stops a caller narrowing a member to the three lineage
fields, because a member's digest is `digestArtifact(member, options.artifactPath)` over the
**whole** object, and a narrowed member digests differently. Case 36 is that difference, executed.

`declaredRevisionCount`, and `remediationCap` when non-null, must each be a non-negative safe
integer; anything else is a `TypeError` before any member is read. Without that guard a `NaN`
declared count fails the length check and silently escapes the cap check, since `NaN > cap` is
false. Case 33.

**The two thrown faults, and why they are not a contradiction of Decision 1.**

| Fault | Thrown when | Commanded by |
| --- | --- | --- |
| `schema-version-mismatch` | a member's `schemaVersion` differs from `options.acceptedSchemaVersion` | AD-11, "readers accept an equal `schemaVersion` only and throw" |
| `non-canonicalizable-value` | a member carries a value outside AD-36's domain; propagated unchanged from `digestArtifact` | AD-36, AD-27 |

Both are already in AD-28's table. Neither is an AD-29 chain defect. A caller-presented chain can
carry both, so the story names them instead of leaving the first `RuntimeFault` out of a "pure
report" function to surprise a reader.

**The nine codes:**

| Code | Fires when | `artifactPath` suffix |
| --- | --- | --- |
| `lineage-root-invalid` | a member has a null `parentDigest` with a non-zero `revisionCount`, or a non-null `parentDigest` with `revisionCount` 0 | `[digest=…]` |
| `lineage-duplicate-artifact` | two or more members digest identically | `[digest=…]` |
| `lineage-no-root` | no member has `revisionCount` 0 | none |
| `lineage-multiple-roots` | more than one member has `revisionCount` 0 | none |
| `lineage-parent-absent` | a member's **non-null** `parentDigest` matches no member's digest | `[digest=…]` |
| `lineage-revision-not-successor` | a member's `revisionCount` is not one greater than its present parent's | `[digest=…]` |
| `lineage-revision-conflict` | two or more members with **differing digests** share a `parentDigest` and a `revisionCount` | `[parent=…,revision=n]` |
| `lineage-length-inconsistent` | `artifacts.length !== declaredRevisionCount + 1` | none |
| `lineage-remediation-cap-exceeded` | `remediationCap` is non-null and `declaredRevisionCount > remediationCap` | none |

`lineage-parent-absent` must say **non-null**, or every root fires it. `lineage-revision-conflict`
must say **differing digests**, or a duplicated member is reported twice: once as a duplicate and
once as a conflict with itself, which is not AD-29's sentence ("different content").

`lineage-revision-conflict` is addressed by its conflicting group, so an n-way conflict is one
finding naming n digests, sorted lexicographically inside the detail.

**`passed` is `findings.length === 0`.** Nothing else derives it. The whole report is frozen before
it is returned, so a caller cannot edit a verdict it was handed; case 32.

**`checks` is a total projection of the nine codes onto AD-12's three booleans:**

| Boolean | False when any of these fired |
| --- | --- |
| `noRepeatedDigest` | `lineage-duplicate-artifact` |
| `noGap` | `lineage-root-invalid`, `lineage-no-root`, `lineage-multiple-roots`, `lineage-parent-absent`, `lineage-revision-not-successor`, `lineage-revision-conflict` |
| `lengthConsistent` | `lineage-length-inconsistent` |

`lineage-remediation-cap-exceeded` maps onto no boolean by design: AD-12 records the cap in
`Remediation.cap` beside `lineageChain`, outside the three. Case 25 covers the cap code and asserts
all three booleans stay true. A consumer reading the serialized `lineageChain` alone therefore sees
a clean chain on a cap breach, which is AD-12's own field layout; `passed` is what carries it.

**Every finding is collected; nothing short-circuits.** A chain with three problems reports three,
which is the difference between a report and a throw. Case 26 pins it.

**Findings are sorted by `LINEAGE_DEFECT_CODES` index, then by `artifactPath`, with an explicit tie.**
Digests are content-derived, so the order is identical for any permutation of the input array. Two
findings *can* share an address: two byte-identical members produce one digest, so a duplicated
member yields two `lineage-root-invalid` findings at one address. Their details are identical too,
so the tie is genuine and the comparator returns `0` on it. A comparator that returned `1` there
would not be a total order, which is the defect the first draft carried under a claim of address
uniqueness. Case 27 runs both a spread-address chain and a tied-address chain through every rotation
and one reversal; case 29 asserts the tie exists and that the codes still come out in registry rank.

**Connectivity needs no separate check.** With exactly one root, no duplicate digests, every
non-root's parent present, and every `revisionCount` one greater than its parent's, every member
sits on the single path down from the root: a second component bottoms out at a member with no
present parent (`lineage-parent-absent`) or at a second zero (`lineage-multiple-roots`), and a fork
gives two members one `(parentDigest, revisionCount)` pair (`lineage-revision-conflict`). A cycle of
any length is excluded by arithmetic: summing the successor rule around a loop of length k gives
`0 = k`. That argument is what removed the tenth code the first draft carried; Decision 6.

**An empty chain** fires `lineage-no-root` and, for any `declaredRevisionCount` of 0 or more,
`lineage-length-inconsistent`. Case 30 pins it, because "what does it do on `[]`" is the first
question a caller asks.

### AC 8: `reviseArtifact`

Returns

```ts
freezeArtifact(
	structuredClone({
		...body,
		parentDigest: digestArtifact(parent, artifactPath),
		revisionCount: parent.revisionCount + 1,
	}),
) as T
```

The `structuredClone` is load-bearing and is not defensive coding. `{ ...body }` is a shallow copy,
so its nested subtrees are the caller's; `freezeArtifact` deep-freezes in place, so without the
clone the call would freeze the caller's own `body` as a side effect. Case 37 asserts `body`'s
nested members stay unfrozen.

Throws a `TypeError` on five programmer errors, checked in this order:

1. `parent` fails the biconditional. Revising a malformed parent mints a malformed child and pushes
   the defect one generation down the chain.
2. `parent.revisionCount` is not a non-negative safe integer (`Number.isSafeInteger` plus `>= 0`).
   Reachable only past guard 1, so the case that exercises it hands in a parent carrying a digest.
3. `parent.revisionCount + 1` is outside the safe-integer range. Guard 2 admits
   `Number.MAX_SAFE_INTEGER`, whose successor is not representable; bounding the parent alone would
   mint a child whose count no later reader can trust.
4. `body.schemaVersion` differs from `parent.schemaVersion`. A revision at another version mints a
   chain `validateLineageChain` then throws `schema-version-mismatch` on, which puts the defect one
   call further from its cause.
5. `body` carries a `parentDigest` or a `revisionCount` own key. The type forbids it and a cast
   defeats the type, so the runtime guard is what holds the line: without it a caller's stale
   `revisionCount` wins or loses depending on spread order.

`TypeError` and not a registry code, for the reason `digestComposite` throws one
(`src/core/canonical/digest.ts:45,48`) and `validateAssembledBrief` throws one
(`src/core/seal/seal.ts:153-156`): these are misuse of the function, not a defect in an artifact.
Decision 9. The messages follow those two: lowercase, no `(AD-nn)` citation, artifact path last.

The parent is digested with `digestArtifact`, the plain artifact digest. AD-27 reserves composites
for domain-separated multi-field objects; a parent digest is a digest of one artifact.

### AC 9: `check:lineage`, the mechanical half of "no other stage may set them"

AD-29 says "the stage that produces an artifact owns those two fields per AD-24's table, and no
other stage may set them". A test cannot see a violation that does not exist yet; a scanner can, the
moment someone writes it. This mirrors `check:layers`, including the file split.

**`scripts/lineage-ownership.ts`** — pure, filesystem-free, one export plus its two types:

```ts
export type LineageViolation = {
	readonly file: string
	readonly line: number
	/** the field, the call, or the allowlist entry the violation is about. */
	readonly subject: string
	readonly rule: string
}

export type ScanOptions = {
	readonly wholeTree: boolean
}

export function scanLineageWrites(
	files: ReadonlyMap<string, string>,
	options: ScanOptions,
): LineageViolation[]
```

It reads the token stream from `scripts/token-scan.ts` (Decision 13). Permitted paths are
`src/core/schemas/` (the declarations), `src/core/lineage/` (this story's table and constructor),
and any file in `LINEAGE_WRITER_MODULES`. It reports five things:

1. **A bare-identifier write outside the permitted paths.** The identifier `parentDigest` or
   `revisionCount` followed by **any assignment operator** (`=` through `&&=`, the whole
   `FirstAssignment`–`LastAssignment` range) is an in-place assignment, which is AD-29's literal
   subject. The same identifier is a declaration when it **opens a member** of an object or type
   literal and the token after it is `:`, `,` or `}`. A member opens after `{`, `,`, `;`,
   `readonly`, or a line break, because this repository's formatter writes type members
   newline-separated with no separator. A read through a dot (`parent.revisionCount + 1`) is
   neither, and so is a name bound by a destructuring and used later, which is how `emit` will read
   the two fields.
2. **A string spelling a lineage field outside the permitted paths.** A computed key
   (`{ ['parentDigest']: d }`), a bracket assignment, `Object.defineProperty`, and `Reflect.set` all
   reach the field through a string and are indistinguishable at this level, so any of them is
   reported. A backtick-quoted key is the same route under the same rule.
3. **The identifier `reviseArtifact` outside the permitted paths.** It sets both fields, so naming
   it at all is the same violation one line further out. Matching the bare identifier covers the
   call, the import, and an aliased import (`import { reviseArtifact as mint }`), which a call-site
   rule alone would miss.
4. **A missing write inside the allowlist.** Every `LINEAGE_WRITER_MODULES` file **that is present
   in the input map** must contain both fields in the shape that mints: the field, a `:`, and a
   value that is not a type name. Deleting `parentDigest: null` from `seal.ts` would otherwise pass
   every check in the repository. Rule 1 still reports a shorthand and a type member; neither counts
   here, because neither mints, and a gutted writer module can otherwise pass on one type
   annotation, one destructured parameter, or one type literal reached through `<…>`. The "present
   in the map" clause is what keeps the synthetic-source-map cases writable; without it every one of
   them gains four spurious violations.
5. **An allowlist entry with no file, on a whole-tree scan.** The wrapper passes `wholeTree: true`
   and a synthetic map passes `false`; on a whole-tree scan an unmatched entry is a violation, which
   is what catches a rename that silently empties the allowlist. Decision 10.

**Which literal a member sits in is decided by the nearest unmatched opening bracket**, found by a
bounded backward walk. A `{` introduced by `const`, `let`, `var`, or `import` is a binding pattern
and its names are reads. A `(` or `[` reached first is a parameter list or an index, also a read. A
`{` whose statement carries `type` or `interface` is a type literal, and so is one preceded by `:`
**unless the name before that colon is itself a member**: `lineage: { parentDigest: null }` is a
nested value, and reading it as a type would fail a writer module that nested its own two fields.
Anything else is a value literal. An unresolved shape within the window is reported, which is the
branch a parameter list longer than the window reaches; case 51.

**A type literal is reported and does not count as minting.** `type X = { revisionCount: number }`
in an unpermitted file is a violation, because a type redeclaring a lineage field outside
`core/schemas/` is worth looking at, and it is kept out of rule 4's count so it cannot stand in for
a write. The tree already carries the homonym this makes concrete: `evidence-artifact.ts:224`
declares AD-12's remediation `revisionCount`, a different field with the same name, permitted only
because it sits under `schemas/`. Case 48 records the behaviour.

**Two routes stay invisible to any token scanner** and are named in `token-scan.ts` rather than
implied away: a key built at runtime (`o['parent' + 'Digest']`) and one parsed out of JSON. A
destructured parameter carries no token-level marker separating it from an object-literal argument,
so it is reported; case 48 records that too.

The tokenizer's own contract is that it refuses rather than guesses. It decides regex-versus-division
the way the parser does and throws on three shapes it cannot read: a token that makes no progress,
an unterminated literal, and a stream that ends with an unbalanced brace or an open template.

**`scripts/check-lineage-ownership.ts`** is the wrapper: `discoverSourceFiles` →
`scanLineageWrites(files, { wholeTree: true })` → one sorted `console.error` per violation in the
form `${file}:${line} ${subject}: ${rule}` → `process.exit(1)`; on success one line reading
`check:lineage: N file(s) scanned under src/, 0 violations`. The line carries no verb, because rules
4 and 5 report an absence and "writes X … and it writes none" reads as nonsense.

Run by `node` directly, so that file's stated constraint applies: no TypeScript enum, namespace,
parameter property, or `export type` re-export in it or in anything it imports. `stage-table.ts` is
plain data with a type-only import and satisfies it.

**`package.json`:** one script, `"check:lineage": "node scripts/check-lineage-ownership.ts"`, and
one entry in `validate` immediately after `check:layers`, since the two are the same kind of gate
over the same file set.

### AC 10: `src/core/stage-contracts.ts` — the deferral, discharged

The module JSDoc currently ends:

> This is not AD-24's complete six-stage input/output/owner/lineage table: Story 6.4 owns that.
> These two conformance types become two of its inputs.

Replace the two sentences with one naming where the table landed and what the two files divide:
`stage-contracts.ts` holds the stage **shapes** TypeScript checks an implementation against, and
`core/lineage/stage-table.ts` holds the **table** AD-24 fixes. Neither imports the other; a shape is
a type and a table is data.

Nothing else in the file changes. `CompileOptions`, `CompileStage`, `SealStage`, `PlanStage`, and
`ReduceStage` keep their definitions and their five importers (`compile/compile.ts:24`,
`preflight/plan.ts:24`, `preflight/reduce.ts:20`, `tests/seal/seal.test.ts:7`,
`tests/compile/compile.test.ts:11`).

### AC 11: tests

Fifty-eight numbered cases across five files. Every rule is verified by reverting it locally and
confirming that exact test goes red; a case that stays green under a reverted rule pins nothing.

**`tests/lineage/stage-table.test.ts`:**

1. `STAGE_SIGNATURES` has exactly the keys in `PIPELINE_STAGES`, in that order.
2. The six `owns` values are distinct. Two stages owning one output is the defect AD-24 names in its
   own `Prevents` line ("revision 1 gave the Evidence Artifact to both `score` and `emit`").
3. `ARTIFACT_PRODUCERS` is total over `INTERCHANGE_ARTIFACT_KEYS` and in registry order.
4. For every artifact whose producer is a stage, that stage's `ownsInterchange` is that artifact and
   no other stage's is, asserted in both directions.
5. Every `owns` that is not an `InterchangeArtifactKey` is in `INTERNAL_PRODUCTS`, and every
   `INTERNAL_PRODUCTS` member is some stage's `owns` or some stage's input.
6. `deriveLineageWriterModules` called with a mutated copy of the table follows the mutation: flip
   `seal`'s `lineage` to `none` and the result loses `seal.ts`; give `emit` a module and the result
   gains it. This is the case that distinguishes a derivation from a literal.
7. `LINEAGE_WRITER_MODULES` equals `deriveLineageWriterModules(STAGE_SIGNATURES)`, and today that is
   exactly `src/core/seal/seal.ts` and `src/core/preflight/reduce.ts`.
8. Every `mints` row's `ownsInterchange` is an artifact the registry marks `carriesLineage: true`;
   every `none` row's `ownsInterchange` is `null`.
9. `artifact-reference` is the only `embedded` producer and the only registry entry with
   `carriesLineage: false`. One assertion, both directions.
10. Every `inputs` entry is an `InterchangeArtifactKey` or an `INTERNAL_PRODUCTS` member.

**`tests/lineage/freeze.test.ts`:**

11. A nested object and a nested array element are both frozen; writing to either throws a
    `TypeError`.
12. Primitives, `null`, and `undefined` pass through, and so do a `Uint8Array` and a `Date`, both
    unfrozen. Deleting `isJsonContainer` makes the typed-array arm throw.
13. A cyclic object terminates and is returned. Deleting the `Object.isFrozen` guard must turn this
    case into a `RangeError`; a shared subtree under two parents does not, which is why the case is
    a cycle.
14. The four wired sites — `seal(...)`, `reducePreflight(...)`, `compile(...)` from
    `src/application/compile.ts`, and `await runPreflight(...)` — each return a frozen artifact,
    asserted by a throwing write, one `it` per site. `runPreflight` uses the probe fake extracted to
    `tests/preflight/fixtures/probe-port.ts`.
15. `seal(contract)` leaves the caller's contract untouched: `Object.isFrozen(contract.behaviors[0])`
    is false afterwards. Decision 5 is the argument; this case keeps it true.

**`tests/lineage/chain.test.ts`:**

16. Three accept shapes — a lone root, a root plus one revision, a five-member chain — each
    reporting `passed: true`, zero findings, and all three `checks` booleans true.
17. through 25. One reject case per code, in `LINEAGE_DEFECT_CODES` order, each asserting `code`,
    `artifactPath`, and the affected `checks` boolean. Assert a substring of `detail` only where the
    test is about what the message names: case 23's conflict must name every digest in its group.
    Case 25, the cap, must additionally assert all three `checks` booleans stay true.
26. A chain carrying several separate defects reports every one of them.
27. Permutation stability, run over two fixtures: a chain whose findings all have distinct
    addresses, and a chain with a duplicated member whose findings tie. All rotations plus one
    reversal, with `JSON.stringify(report)` byte-identical. Verify by sorting by input index locally
    and watching the case go red.
28. Repeat stability: the same chain validated twice produces byte-identical reports. AD-30 names
    both halves of the family and case 27 is only one of them.
29. The address tie: a duplicated-member chain produces two findings at one address, and the codes
    still come out in registry rank. This is the case the first draft got wrong by asserting
    uniqueness on a fixture that could not contain a tie.
30. An empty chain reports `lineage-no-root` and `lineage-length-inconsistent`.
31. `CHECK_PROJECTION` covers every code exactly once, and `lineage-remediation-cap-exceeded` is the
    only null.
32. The returned report is frozen, asserted by a throwing write and a throwing `push`.
33. A `NaN`, a negative, or a fractional `declaredRevisionCount` or `remediationCap` throws a
    `TypeError`.
34. A chain mixing `schemaVersion` 1 and 2 throws `RuntimeFault` with code
    `schema-version-mismatch`.
35. A member carrying a non-finite number propagates `non-canonicalizable-value` from
    `digestArtifact` unchanged.
36. A chain of whole artifacts validates clean while the same chain narrowed to the three lineage
    fields does not, which is the executable statement of AC 7's precondition.
37. `reviseArtifact` mints `revisionCount` one greater and a `parentDigest` equal to
    `digestArtifact(parent, path)`; the result is frozen; the caller's `body` and its nested members
    are not.
38. A `reviseArtifact` result validated with its parent reports `passed: true`. The constructor and
    the reader are the two halves of AD-29 and this is the only case that proves they agree.
39. AC 8's five `TypeError` guards, one assertion each. Guards 2 and 3 need a parent carrying a
    non-null `parentDigest`, or guard 1 catches the input first and they never run.
40. Revising a frozen parent works. Every emitted artifact is frozen, so a constructor needing a
    mutable parent would be unusable.

**`tests/architecture/lineage-ownership.test.ts`** — synthetic source maps, the shape
`tests/architecture/dependency-direction.test.ts` uses:

41. A write in each of the three permitted classes produces no violation.
42. A write in an unpermitted file produces one violation per field, naming the field and the line.
43. An allowlist file present in the map and missing one field produces one violation; missing both
    produces two; and a file whose only mention of both fields is a type annotation, a destructured
    parameter, a generic argument, or an `extends` clause still owes both writes.
44. An allowlist entry absent from a whole-tree scan produces one violation, and the same entry
    absent from a synthetic map does not.
45. `reviseArtifact` called, imported, and imported under an alias each produce one violation.
46. `=`, `??=`, `+=`, and the shorthand form each produce one violation.
47. A computed key, a bracket assignment, `Object.defineProperty`, and a backtick-quoted key each
    produce one violation.
48. Reads produce nothing: a dotted read, a dotted read inside an object literal, a destructuring
    binding, a parameter annotation, a name bound by a destructuring and used later, and a named
    import. A type alias produces one violation, and so does a destructured parameter; the
    newline-separated and `readonly`-prefixed forms this repository's formatter writes produce two.
49. A real-tree scan through `discoverSourceFiles` returns zero violations.
50. A nested value literal (`lineage: { parentDigest: null }`) reads as a value in both directions:
    reported in an unpermitted file, and satisfying the minting rule in a writer module.
51. A parameter list longer than the lookback window reaches the fail-closed fallback and reports.

**`tests/architecture/token-scan.test.ts`** — the shared tokenizer, which two gates now depend on
and which neither can test on its own, because a derailed tokenizer produces *fewer* findings and a
"finds nothing in the real tree" case cannot see that:

52. Code after a template with one substitution is still tokenized.
53. The same for a nested template, a tagged template, an object literal inside `${}`, and a `"}"`
    string inside `${}`. Deleting the `depth--` branch must make the object-literal arm go red.
54. An unterminated literal throws with the offset, for a template and for a string.
55. A source that makes the raw scanner emit a zero-width token forever throws with the offset.
    Reverting this guard hangs the file rather than failing it, which is the point.
56. `lineOf` reports the right line for a token at column 0, the boundary its binary search gets
    wrong and the number both gates print on every violation.
57. A regex is told from division by the token before the slash: `/^#/`, a backtick, an escaped
    slash inside a template substitution, and `/[*+?{]/` all tokenize as regexes, while `a / b` and
    `(a) / b / c` stay division.
58. A stream ending with an unbalanced brace throws. This is the backstop for a desync neither
    other guard sees.

### AC 12: docs

**`README.md`**, one new line in the Development block after `check:ad5-registry`:

```
npm run check:lineage       # fail if a module outside the stage table writes an artifact's lineage fields
```

and one new paragraph of two sentences after the `schemas/` paragraph, saying that every artifact
the library returns is deep-frozen and that a revision is minted as a new artifact carrying its
parent's digest. Two sentences; the mechanism lives in `freeze.ts` and `chain.ts`.

Then `npm run build:shareable`, because editing `README.md` makes `_bmad-output/shareable/` stale
and `check:shareable` fails the build. Stories 6.2 and 6.3 both hit this.

**`_bmad-output/project-knowledge/learning-path-step-by-step.md`**: row 22 in the table and Step 22,
following `learning-path-template.md`. Write it after the review findings are closed and before the
local review, per that template's timing rule. The plain-terms paragraph has a ready subject: a
document you can edit in place has no history, and the fix is that you never edit it, you write a
new one that names the old one.

### AC 13: the gate

Filled from actual command output.

| Check | Before | After |
| --- | --- | --- |
| `npm run validate` | passes | passes |
| `npm run test` | 68 files / 2563 tests | 73 files / 2624 tests |
| `npm run check:layers` | 83 files, 0 violations | 86 files, 0 violations |
| `npm run check:lineage` | does not exist | 86 files, 0 violations |
| `npm run check:schemas` | 12 documents match | 12 documents match, byte-identical |
| `git status` under `schemas/` | clean | clean |
| `git diff --exit-code src/index.ts` | clean | clean |
| `tests/compile/compile.test.ts` census | 26 cases | 26 cases |
| `npm run build` | passes | passes |

`schemas/` staying clean and the census staying at 26 are the two claims AC 1 makes that are most
likely to be false by accident, so both are rows. `generate:schemas` was not run: the only schema
edit is a type export, and `check:schemas` passing byte for byte is the proof it is erased before
the builder runs.

## Decisions taken during story creation

**1. No new code in either registry; chain defects are returned and two existing faults are thrown.**
AD-29 commands no compile-time code and no runtime fault. AD-5 and AD-28 both carry the same audit
rule — an AD that commands a failure without adding a code there is a defect in that AD — and both
registries are checked against the spine byte for byte by `check:ad5-registry` and
`check:ad28-registry`, so adding a code means amending the spine. The standing decision in this
project is to settle an ambiguity in the story rather than open a tenth spine revision. So
`validateLineageChain` returns a report whose nine codes are a module-local vocabulary, prefixed
`lineage-` so no reader mistakes them for registry codes, with the module JSDoc saying they are in
neither registry and why.

The existing registries were checked before deciding. `digest-mismatch`'s row scopes it to "bytes
resolved through the corpus port do not match the manifest digest", which AD-8 confirms;
`schema-parse-failure` cannot fire, because the biconditional is deliberately left unrefined
(`lineage.ts:27-28`) and recorded `not-expressible` (`constraint-ledger.ts:149-153`). Neither fits.

The report shape is also the honest reading of AD-29's own verb. A conflict is "to surface, never to
merge": a throw surfaces one defect and hides the rest, and a chain with three problems has three.
The shape follows `ConformanceReport` (`src/testing/conformance.ts:46-51`), which is the
repository's existing answer to "a verdict about a subject the caller supplied".

Two faults are still thrown, and naming them is part of this decision rather than an exception to
it. AD-11 commands a reader to throw `schema-version-mismatch` on an unequal version, and
`digestArtifact` propagates `non-canonicalizable-value` from a member outside AD-36's domain. Both
codes exist; neither is an AD-29 defect; both are reachable from a caller-presented chain. A "pure
report" function that threw without saying so would be worse than one that says so.

**2. The story computes AD-12's published `LineageChain`, not a shape of its own.**
The first draft invented a report with a findings array and nothing else. `LineageChain` already
exists at `evidence-artifact.ts:217-221` with the three booleans AD-12 names, it is already required
on every Evidence Artifact through `Remediation.lineageChain`, and its own JSDoc says "AD-21's FAIL
rung reads the conjunction". Inventing a second shape would have left `emit` deriving three booleans
from a findings array by hand.

So the report carries both: `checks` is the published projection, `findings` is the vocabulary that
says which of the three failed and why. AC 7's projection table is total over the nine codes, which
is what stops a later code being added with no boolean to land in.

The same reading pulled in two fields the first draft had no answer for. `lengthConsistent` needs a
declared revision count, which is `Remediation.revisionCount` and arrives as an option; and AD-12's
remediation cap "is checked against the presented chain", which is this reader and nothing else, so
`remediationCap` arrives the same way. Neither is enforcement: AD-12 says plainly that the package
cannot enforce the cap globally, and `capSource: 'caller-attested'` already records that limit.

**3. `compile` owns `eval-contract` and its lineage edge is `carries-through`.**
Two readings were live. The Structural Seed's transformation line (`compile/ # behaviour input ->
Eval Contract`) and AD-24's "exactly one stage owns each artifact" both put the contract under
`compile`. The code disagrees in spirit: `src/core/compile/compile.ts:105` returns the caller's
parsed contract unchanged, and the caller authored all three lineage fields before the package saw
them.

The `lineage` field is what lets one row record both. `compile` is the owner for AD-24's purpose
(one stage, one output, no ambiguity about who returns a contract), and `carries-through` records
that it writes neither field. The scanner reads `lineage`, so `compile` gets no write permission and
a future edit adding `parentDigest:` to `compile.ts` fails `check:lineage`. Its row is an identity —
`eval-contract` in, `eval-contract` out — because the transformation the Seed describes is unbuilt,
and recording an identity is more honest than inventing a `behaviour-input` product nothing produces.

The vocabulary is `mints | carries-through | none` and not a boolean, because AD-24 asks for lineage
**edges**. `mints` covers minting a root and minting a revision, since both write the two fields;
there is deliberately no fourth value for revising, because no row has one today and an unreachable
member of a published vocabulary invites a handler for a case that cannot occur.

**4. `freezeArtifact` returns `T`, not a deep-readonly type.**
The tempting signature is `freezeArtifact<T>(v: T): DeepReadonly<T>`, which makes immutability
visible to the type checker. Three things break. `SealStage` (`stage-contracts.ts:24`) and
`ReduceStage` (`:38-41`) declare exact return types; `seal` is checked against the first by
assignment at `tests/seal/seal.test.ts:369`, and `reducePreflight` is checked against the second by
its own annotation at `src/core/preflight/reduce.ts:103`. `PreflightVerdict.safeParse` and
`runPreflight`'s declared `Promise<PreflightVerdict>` would both need the same treatment, and
`src/index.ts` re-exports those types. And every artifact type in the repository already carries
`readonly` members through Zod's inference, so the mapped type would mostly restate the schema.

The cost is that the type system does not stop a write. The runtime does, and case 11 asserts the
`TypeError` rather than `Object.isFrozen`, which is the assertion that matches the guarantee.

**5. Freezing `seal`'s output does not reach the caller's contract, and the story says why.**
This was raised as a defect and investigated by execution before being closed. `seal` assembles a
brief whose members alias the caller's objects — `behaviors: [...contract.behaviors]`
(`seal.ts:110`) is a shallow copy — so a deep freeze of that literal would freeze the caller's
`Behavior` objects. It never sees that literal. `seal.ts:130` returns
`validateAssembledBrief(brief)`, which returns `SealedEvaluatorBrief.safeParse(brief).data`
(`seal.ts:148-149`): Zod's own deep clone, sharing no structure with the input. The freeze lands on
the clone.

The full gate was run against a scratch copy with all four sites wired and stayed green at 68 files
and 2563 tests, including the two `structuredClone` mutation tests at `tests/seal/seal.test.ts:336`
and `:348`, because `structuredClone` of a frozen value returns an unfrozen clone. Case 15 is what
keeps the property true rather than accidentally true.

**6. Connectivity is implied and there is no eighth structural code.**
The first draft carried `lineage-unreachable-member` and it was unreachable itself: no input
produces it that the other codes do not already produce. An unreachable code in a published
vocabulary is worse than a missing one, because a reader writes a handler for it. AC 7 carries the
argument, including the cycle case, which is excluded by arithmetic (`0 = k` around a loop of length
k) and not by any property of SHA-256.

**7. Findings are sorted by code then by artifact path, and every finding's address is unique.**
Sorting by input index would have been simpler and would have made case 27 impossible. AD-30 names
byte-identical repeat output and permutation invariance as the two families that exist because "the
non-determinism that will hurt this product is in the scorer rather than in the tests", and a chain
presented in a different order is that shape; `epic-6-context.md` binds the same pair to pre-flight's
reduce, which is the precedent.

The sort is only total because a conflict finding is addressed by its group
(`[parent=…,revision=n]`) rather than by a member. The first draft addressed it by a member and left
two independent conflicts with identical keys, which `Array.prototype.sort` then ordered by input
position. Case 29 asserts uniqueness so the property is checked rather than argued.

**8. The producer map has three kinds, and three of its seven `caller` rows are inferences.**
`ArtifactProducer` is `PipelineStage | 'caller' | 'embedded'`. Forcing all twelve artifacts onto the
six stages would require inventing a producer for seven of them. Four of those seven have a schema
sentence that settles it; three name a reader and no producer, and AC 4 marks them "argued from
absence" rather than claiming otherwise. `embedded` exists for one artifact and is cross-checked
against the registry's own `carriesLineage: false` flag.

**9. `reviseArtifact` throws `TypeError`, which is in neither registry.**
The repository already has this convention for exactly this situation: a caller handing a function
something the function's contract forbids. `digestComposite` throws `TypeError` on an empty
composite and on a reserved field name (`src/core/canonical/digest.ts:45,48`), and
`validateAssembledBrief` throws one with a `ZodError` cause (`src/core/seal/seal.ts:153-156`).
Neither is a registry code and neither should be.

**10. The ownership scanner checks four directions, not one.**
The obvious scanner catches a write in the wrong file. It would miss three things that matter more.
A deletion in the right file is the likelier regression: someone refactoring `seal.ts` drops the two
lines, `SealedEvaluatorBrief.parse` fails, and the fix that "makes the test pass" adds them back
somewhere convenient. A rename empties an allowlist entry silently, so an unmatched entry on a
whole-tree scan is itself a violation. And a stage that mints through `reviseArtifact` writes
neither token in its own file, so without a call-site rule the one supported way to set the fields
is the one way the scanner cannot see. All four cost a few lines each.

Widening the token predicate past `ColonToken` follows the same reasoning in the other direction:
AD-29's own sentence is about editing in place, and `record.parentDigest = digest` is that sentence's
literal subject. A scanner that policed only object literals would police the tidy case and miss the
dangerous one.

**11. The table's `module` for `preflight` is the reduce half.**
AD-34 splits a stage needing external observation into a pure `plan` and a pure `reduce`, and only
`reduce` returns the artifact. Naming `plan.ts` would have made the allowlist wrong in a way no test
would notice, since `plan.ts` writes no lineage field today and would simply have been permitted to.
The stage's `inputs` still carry both halves' inputs, because AD-24 asks for the stage's inputs and
not for one function's parameters.

**12. The verdict rung is score-side, and the story records the tension rather than resolving it.**
AD-21's FAIL rung names "a presented lineage chain that is internally inconsistent under AD-12".
AD-32 lists lineage consistency among the checks that "fail loudly and invalidate rather than
degrade a verdict". Those are two different rungs for the same condition, and neither is reachable
from stage one, which touches no `score`. The story therefore emits `checks` and `findings` and
assigns no rung. The story that wires AD-21's ladder inherits the question stated: a chain defect is
FAIL under AD-21's own text and invalid under AD-32's, and one of the two sentences has to give.

**13. The tokenizer is extracted, because `check:lineage` could not be written without it.**
`scripts/dependency-direction.ts` built its own token stream from `createScanner`, and that stream
derails on a template literal with a substitution: the closing `}` of `${…}` comes back as a
`CloseBraceToken`, the template's tail is then read as code, and its closing backtick opens a second
template that swallows the rest of the file. Measured on this tree, `src/core/preflight/reduce.ts`
yields 1126 tokens raw against 1277 re-scanned, and **zero** of its two lineage writes are visible in
the raw stream. `check:lineage` reported two spurious violations against it and the gate failed.

So the tokenizer moved to `scripts/token-scan.ts`, gained the template re-scan and a no-progress
guard, and both gates read it. That silently repaired a latent defect in `check:layers`, which had
been scanning truncated streams since Story 6.1: with a template-bearing file, a forbidden import
placed after it was invisible. On an injected corpus the new scanner's findings are a strict
superset of the old one's, 70 against 0 on the templates-then-forbidden-import case.

The first draft of that module documented two limits instead of closing them, and a second peer
round showed the documentation was the defect. Every one of them — `#`, a backtick, an escaped
slash, a `{` inside a character class — is the same root cause: the scanner cannot tell division
from a regex, so each regex body leaks its characters into the stream as code. `src/core/evaluate/
operators.ts:168` carries `/[*+?{]/`, and that brace shifted brace depth for every line after it on
a file both gates scan. A regex inside a template substitution went further and silently swallowed
the rest of its file, so a lineage write after one was invisible.

`scanTokens` now decides regex-versus-division the way the parser does, from the previous token, and
196 repository files tokenize clean where five used to throw. Three guards remain as backstops and
each throws with an offset: a token that makes no progress, an unterminated literal, and a stream
ending with an unbalanced brace or an open template. Cases 52 through 58 are what stop the tokenizer
regressing silently.

**14. The scanner's reach is set by how a lineage field can actually be set, not by one token shape.**
The first draft matched an identifier followed by a colon. That misses every compound and logical
assignment, every string-keyed route (`{ ['parentDigest']: d }`, `o['parentDigest'] = d`,
`Object.defineProperty`, `Reflect.set`), and an aliased import of `reviseArtifact`. Each was
executed against the draft and each returned no violation. AC 9 now carries five rules, and every
one of them has a case that goes red when the rule is reverted.

Widening the reach cost precision in one direction, so the context rule pays it back. A bare
`parentDigest` followed by `:` or `}` is a write only when the nearest unmatched opening bracket is a
`{` that no `const`, `let`, or `var` precedes. That is what keeps `const { parentDigest,
revisionCount } = artifact` clean, which is how `emit` will read the fields, and a gate that fired on
that would be switched off within a story.

## Tasks / Subtasks

- [x] **Task 1 — baseline.** `npm run validate`, and confirm the recorded baseline rather than
      trusting it. Confirmed: 68 test files / 2563 tests, `check:layers` 83 files / 0 violations,
      `check:schemas` 12 documents, `tests/compile/compile.test.ts` census 26 cases.
- [x] **Task 2 — the type export.** AC 7's `export type LineageChain` in
      `src/core/schemas/evidence-artifact.ts`, then `npm run check:schemas`: all twelve documents
      still match byte for byte, which is the proof a type export is erased before the builder runs.
- [x] **Task 3 — the table.** `src/core/lineage/stage-table.ts` per AC 2 through AC 4, then cases 1
      through 10. `check:layers` 0 violations.
- [x] **Task 4 — freeze.** `src/core/lineage/freeze.ts` per AC 5 and cases 11 through 13.
- [x] **Task 5 — the freeze wiring.** AC 6's four sites, the extracted probe fake, and cases 14 and
      15. Full suite green with no change to any existing test.
- [x] **Task 6 — the chain reader.** `src/core/lineage/chain.ts` per AC 7 and AC 8, then cases 16
      through 40, each reject case verified by reverting its rule.
- [x] **Task 7 — the tokenizer.** `scripts/token-scan.ts` and cases 50 through 53, with
      `scripts/dependency-direction.ts` switched onto it. Decision 13 is why this task exists; it
      was not in the approved AC 1 and the story now records it.
- [x] **Task 8 — the scanner.** `scripts/lineage-ownership.ts` and
      `scripts/check-lineage-ownership.ts` per AC 9, then cases 41 through 49.
      `npm run check:lineage` 0 violations against the real tree.
- [x] **Task 9 — the wiring and the deferral.** `package.json`'s script and its `validate` entry,
      and AC 10's `stage-contracts.ts` JSDoc edit.
- [x] **Task 10 — the gate.** `npm run validate` and `npm run build`. AC 13's table is filled from
      actual output, including the two `git` rows.
- [x] **Task 11 — README.** AC 12's command line and paragraph, then `npm run build:shareable`.
- [x] **Task 12 — the learning path, last.** Marked the story done, then row 22 and Step 22 per the
      template, with a de-AI pass over the new section.

## Dev Notes

### Read these files before writing anything

- `src/core/schemas/lineage.ts` in full. Thirty-four lines, and the whole declaration side of this
  story. The `parentDigest` description states the biconditional and says why it is stated rather
  than refined.
- `src/core/schemas/evidence-artifact.ts:209-236`. `LineageChain`, its JSDoc transcribing AD-12's
  sentence, and the `Remediation` object that carries it beside `cap` and `capSource`. This is the
  consumer AC 7 computes for.
- `src/core/schemas/constraint-ledger.ts:128-154`. The eleven generated lineage entries and the
  sentence closing "left to the reader that validates a presented chain". Do not edit them: a ledger
  entry describing a constraint as `not-expressible` stays accurate once a reader exists, because
  the disposition is about the published schema and not about the package.
- `src/core/schemas/artifact.ts` in full, one hundred lines. `INTERCHANGE_ARTIFACTS`,
  `INTERCHANGE_ARTIFACT_KEYS`, and the `carriesLineage` flag AC 4 and cases 8 and 9 cross-check
  against.
- `scripts/dependency-direction.ts`: the module header, `tokenize` (`:132`), `lineOf` (`:148`),
  `isAllowedEdge` (`:76`, the same-layer return at `:80`), and `scanSources` (`:714`). AC 9's
  scanner is the same three pieces with a different predicate.
- `scripts/check-dependency-direction.ts` in full, forty-seven lines. AC 9's wrapper is that file
  with one function swapped.
- `tests/architecture/dependency-direction.test.ts:1-60` for the synthetic-source-map pattern cases
  38 through 44 use.
- `src/core/seal/seal.ts:85-100`, `:130`, `:148-149`, and `src/core/preflight/reduce.ts:305-319`.
  The `reduce.ts` comment says AD-29's revision machinery belongs to a later story; this is that
  story. Leave both comments in place.
- `src/testing/conformance.ts:24-51` for the report shape AC 7 mirrors.

### Previous-story intelligence

1. **Story 6.3's Decision 1 is the template for Decision 1 here.** A registry is checked against the
   spine byte for byte, so a story that wants a new code is a story that wants a spine revision. 6.3
   drew its three codes from the existing table; this story has none to draw from and says so in the
   module that would have used one.
2. **Story 6.3 found the `compile.ts` census stale because Story 6.2 had not updated it.** This
   story wires no new `compile.ts` check, so the 26-case census (`tests/compile/compile.test.ts:46`)
   is untouched. AC 13 carries it as a row rather than an assumption.
3. **Editing `README.md` makes `_bmad-output/shareable/` stale** and `check:shareable` fails the
   build. Stories 6.2 and 6.3 both hit this; run `npm run build:shareable`.
4. **Story 6.1's same-layer import rule holds.** `isAllowedEdge` returns `true` for a same-layer
   import, so `core/seal` and `core/preflight` importing `core/lineage` is permitted, the same edge
   six `core/compile` modules already have onto `core/seal/plan-index.ts` (`rubrics.ts`,
   `reachability.ts`, `sensitivity-witness.ts`, `scripting-bound.ts`, `expression-legality.ts`,
   `interface-inventory.ts`).
5. **The `application` layer may import `core`** (`scripts/dependency-direction.ts:87-88`), so
   `application/compile.ts` and `application/preflight.ts` importing `core/lineage/freeze.ts` is a
   declared edge.
6. **A script may import `src/`.** `scripts/check-schemas.ts:18` already loads the schema registry
   under bare `node`, so AC 9's wrapper reaching `stage-table.ts` is an established path.

### Project structure notes

- `core/` is pure and synchronous. `freezeArtifact`, `validateLineageChain`, and `reviseArtifact`
  read values and return values. No I/O, no clock, no randomness, no `await`.
- `core/lineage/` may import `core/canonical/digest.ts` and `core/schemas/`; both are same-layer or
  `core-schemas` edges the matrix allows.
- The detail-string convention across `core/` is lowercase, no trailing period, identifiers in
  double quotes, and a trailing `(AD-nn)` citation. `LineageFinding.detail` follows it.
- Artifact paths use the `[key=value]` addressing form. A lineage member has no id, so its address
  is its digest: `SealedEvaluatorBrief[digest=sha256:…]`.
- `scripts/` runs under `node` with type stripping only. No enum, no namespace, no parameter
  property, no non-type re-export in anything the check script imports transitively.

### Testing requirements

- Vitest, `tests/**/*.test.ts`. No coverage tooling in this repository yet; Story 6.5 owns the
  `core/` floor and its measurement.
- Assert `code` and `artifactPath` on a `LineageFinding`, and the affected `checks` boolean. Assert
  a substring of `detail` only where the test is about what the message names.
- `noExplicitAny` is off under `tests/**` only, which is what makes case 33's third guard reachable.
- Every reject case must be verified by reverting its rule and watching that test go red.
- Cases 6, 13, 27, and 29 each have a stated wrong implementation to check against; run each against
  that wrong implementation, not only against the right one.

### References

- `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md`:
  AD-29 (`:437`, the rule), AD-12 (`:294`, the three named checks and the remediation cap), AD-24
  (`:386`, the stage-signature table and one owner per artifact), AD-11 (`:289`, the version
  equality a reader throws on), AD-27 (what a digest is), AD-28 (`:414-430`, the fault registry and
  why a new code is a spine amendment), AD-30 (the two determinism families), AD-34 (why
  `preflight`'s module is the reduce half), AD-21 (`:368`, the FAIL rung Decision 12 defers),
  AD-32 (the invalidating reading of the same condition), and "Owed to the reference implementation"
  item 6 (`:721-726`).
- `_bmad-output/planning-artifacts/epics.md`, Story 6.4's acceptance criteria.
- `_bmad-output/implementation-artifacts/epic-6-context.md`, the Story 6.4 dependency sentence:
  "enforces lineage fields the Epic 1 schemas already declare and the stage-ownership table the
  architecture fixes, adding enforcement rather than redefining either".

## Suggested Review Order

1. **Decision 1 against AD-28's audit rule and AD-5's**, then against the two faults AC 7 throws. If
   a reviewer can show that AD-29's chain defects belong in an existing registry code, the report
   shape changes and AC 7 goes with it. `digest-mismatch` is the closest candidate and its spine row
   scopes it to the corpus port; decide whether that is a scope or an example.
2. **Decision 2 against `evidence-artifact.ts:209-236`.** The claim is that `LineageChain` is the
   published output of this reader and that AC 7's projection is total over the nine codes. Check
   the projection table cell by cell: a code in no bucket or two buckets is a defect.
3. **AC 4's twelve rows against the twelve schema descriptions**, one at a time. The three rows
   marked "argued from absence" are the story's own admission; check whether any of the four marked
   "stated" belongs in that column too.
4. **Decision 3 against `src/core/compile/compile.ts:105`.** The claim is that `compile` owns the
   contract and mints nothing. If a reviewer reads AD-24 as requiring the owner to be the minter,
   the row is wrong and `eval-contract`'s producer is `caller`.
5. **AC 7's induction argument.** It is why there are nine codes and not ten. Try to construct a
   chain that is defective and produces none of them; heterogeneous members and mixed
   `schemaVersion` were the two holes the first draft had, and AC 7 closes them with a precondition
   and a fault respectively. Look for a third.
6. **Decision 5 against `seal.ts:110` and `:148-149`.** The claim is that the freeze lands on Zod's
   clone and never on the caller's contract. Case 15 is the only thing holding it; delete the case
   and check nothing else notices.
7. **AC 9's four scanner directions.** Each exists because of a specific bypass. For each, write the
   bypass and confirm the rule catches it. The `reviseArtifact` call-site rule is the one most
   likely to have been added without a matching case.
8. **Case 6 against a hard-coded allowlist.** Replace `LINEAGE_WRITER_MODULES` with the same two
   strings written by hand; case 6 must still go red, because it calls the derivation. If it stays
   green the case tests a value and not a derivation.
9. **Case 27 against a sort by input index, and case 29 against a member-addressed conflict
   finding.** Both must go red. These two are the whole of Decision 7.
10. **AC 13's table against actual command output**, not against arithmetic.

## Story Review Record

Three independent pre-implementation review passes against the draft, run in parallel: one on
executability, one on design fidelity to the architecture, and one on internal consistency and
count accuracy. The Codex session that normally carries the cross-model pass was rate-limited and is
held for the post-implementation round. Two of the three executed rather than reasoned from prose:
one rebuilt the tree in a scratch copy, implemented AC 5 and AC 6 verbatim, and ran the full gate;
the other ran `wc -l`, `grep -c`, and Biome against every count and every citation the story makes.

Every finding is closed in the text above. Nothing was deferred.

**The eight that changed the design rather than the prose:**

1. **The output shape already existed and the story invented a second one** (HIGH). `LineageChain`
   at `evidence-artifact.ts:217-221` is AD-12's three booleans, required on every Evidence Artifact
   through `Remediation.lineageChain`, and the draft neither produced it nor mentioned it. It also
   had no answer for `lengthConsistent`, which needs a declared revision count, or for AD-12's
   remediation cap, which that AD says is "checked against the presented chain". The report now
   carries `checks` alongside `findings`, the code list went from seven to nine, and AC 7 carries a
   projection table that is total over all nine. Decision 2.
2. **The sort key was not a total order and the permutation case was vacuous** (HIGH, two
   reviewers, one by execution). Two independent `lineage-revision-conflict` findings both carried
   the bare chain path, so `Array.prototype.sort`'s stability leaked input order into the report. A
   conflict finding is now addressed by its group, case 29 asserts address uniqueness, and case 27's
   fixture is a defective chain rather than the clean five-member one the draft named. Decision 7.
3. **The scanner had three bypasses, one of them opened by this story's own constructor** (HIGH and
   MEDIUM). A stage minting through `reviseArtifact` writes neither token in its own file; an
   in-place `record.parentDigest = digest` is AD-29's literal subject and the `ColonToken`-only
   predicate walked past it; and a rename would silently empty an allowlist entry. AC 9 now reports
   four directions and Decision 10 records each bypass beside the rule that closes it.
4. **Case 6 could not distinguish a derivation from a literal** (HIGH, by execution). A
   module-level constant is evaluated once at import, so mutating a local copy of the table changes
   nothing, and a hard-coded array holding the same two strings is value-identical. The derivation
   is now an exported function the case calls with a mutated table.
5. **Case 12's cycle guard was proven vacuous** (HIGH, by execution). The shared-subtree shape the
   draft described terminates with or without the `Object.isFrozen` guard; only a cycle
   distinguishes them, and without the guard it raises `RangeError`. Case 13 is a cycle.
6. **`reviseArtifact` froze the caller's own `body`** (MEDIUM). `{ ...body }` is a shallow copy and
   `freezeArtifact` freezes in place, so the constructor had the side effect the story's own
   boundary claim disclaims. AC 8 clones, and case 31 asserts `body`'s members stay unfrozen.
7. **Two holes in the induction argument** (MEDIUM). A heterogeneous chain and a chain mixing
   `schemaVersion` values were both defective and produced none of the codes. The first is closed by
   a stated precondition and the generic `T` that enforces whole artifacts, with case 37 as its
   executable form; the second by throwing AD-11's existing `schema-version-mismatch`, which needed
   no registry amendment.
8. **`LineageEdge` conflated two axes and the allowlist derived from the wrong one** (MEDIUM). The
   draft's `mints-root` would have excluded a stage that mints a revision, which is the case AD-29
   exists for. The vocabulary is `mints | carries-through | none`, and a fourth value for revising
   was deliberately not added, because no row has one.

**Also closed, without changing the design:** the freeze wiring was executed against a scratch copy
and is green at 68 files and 2563 tests, which closed the raised objection that freezing `seal`'s
output would freeze the caller's contract (Zod's parse returns a deep clone; Decision 5 and case 15
record it); the spike record's "finding 6" was the wrong document and is now cited as the spine's
Owed item 6, whose second half about run mode is recorded as still open; AC 3's `inputs` arrays were
wrong for `preflight`, `score`, and `emit`, and `score`'s output is now named to cover the verdict
values AD-24 says it produces; `stage-table.ts`'s value import of `INTERCHANGE_ARTIFACTS` was unused
and failed `biome check`, so it is type-only, which also keeps zod off the `check:lineage` load
path; case 5's assertion against `stage-contracts.ts` was unimplementable, since that file names two
stages and not six; the probe fake case 14 was told to reuse is not exported, so it is extracted to
a fixture file AC 1 now lists; `validateLineageChain` never said how a member's digest is computed;
`passed`, the empty chain, and AD-30's repeat half were all unstated; the missing-write rule would
have added four spurious violations to every synthetic-map case; the wrapper's violation-line format
was unspecified; three of AC 4's seven `caller` rows are inferences and now say so; AC 12's README
anchor did not exist; Decision 4's line citations and its "four breakages" claim were both wrong;
AC 13 gained rows for the census and for `src/index.ts`; the baselines are measured at 68 files /
2563 tests and 83 scanned files; and eleven line citations across `dependency-direction.ts`,
`digest.ts`, `artifact.ts`, `constraint-ledger.ts`, `compile.ts`, and `stage-contracts.ts` were off
by one to eighty-two lines and are corrected.

## Implementation Review Record

Two independent post-implementation review passes against the working-tree diff, run in parallel:
one on correctness of the code, one on fidelity to this story and to the architecture. Both executed
against scratch copies of the repository: one rebuilt the tree, mutated the tokenizer and the
scanner rule by rule, fuzzed the reader over 500 shuffles, and reconstructed the old tokenizer from
`git show HEAD:` to compare findings; the other re-ran every gate and checked every count and
citation the story makes. The Codex session that normally carries the cross-model pass was
rate-limited for this story and the Peer Review Record below says what stood in for it.

Every finding is closed. Nothing was deferred.

**The six that changed the code:**

1. **The tokenizer hangs on a regex literal containing `#`, and this story widened the exposure**
   (HIGH). `scan()` returns a zero-width `PrivateIdentifier` at one offset forever, and the loop
   pushed without a progress check until V8 aborted. Both `check:layers` and `check:lineage` exit
   134 on a 27-character file. Worse, the template re-scan *enlarged* the reach: four repository
   files carrying a `/^### AD-… /m` regex used to terminate only because the derail swallowed their
   tails. None sits under `src/`, so no gate reaches them, and `scanTokens` throws with the offset
   either way.
2. **Three routes set a lineage field with the scanner blind to all of them** (MEDIUM, executed).
   `o.revisionCount += 1` and every other compound or logical assignment; every string-keyed route;
   and `import { reviseArtifact as mint }`. AC 9 went from three rules to five, and Decision 14
   records that the reach follows how the field can be set.
3. **The comparator was not a total order and the case meant to pin it was vacuous** (HIGH, both
   reviewers). Two byte-identical members produce two findings at one address, so `(code,
   artifactPath)` is not unique; the comparator returned `1` on an equal key, and case 29's fixture
   had no duplicate member and could not see it. The comparator returns `0` on a tie, case 27 runs
   both fixtures, and case 29 asserts the tie exists.
4. **`freezeArtifact` threw on a non-empty typed array and half-froze a `Date` or a `Map`** (MEDIUM).
   `Object.freeze(new Uint8Array([1,2,3]))` throws, and the port messages already carry one. The
   walk now recurses into arrays and plain objects and leaves every other value alone, which is the
   honest behaviour for a JSON-artifact primitive.
5. **`reviseArtifact`'s count guard was dead under the suite and did not bound the successor**
   (MEDIUM). Case 33's fixtures all had a null `parentDigest`, so guard 1 caught them and guard 2
   never ran; and a parent at `Number.MAX_SAFE_INTEGER` minted a child whose count is not a safe
   integer. Guard 3 bounds the successor, guard 4 pins the schema version, and case 39 reaches every
   one of the five.
6. **The projection's totality was a prose claim with no enforcement** (HIGH). A tenth code would
   have landed in no bucket and left every `checks` boolean true on a failing chain. `CHECK_PROJECTION`
   is now an exported `Record` over the code union, so a tenth code is a compile error, and case 31
   asserts the same thing at runtime.

**Also closed, without changing behaviour:** the reader now refuses a `NaN`, negative, or fractional
`declaredRevisionCount` or `remediationCap`, which a `NaN` had used to slip past the cap check
silently; the returned report is frozen and case 32 says so; `probe-plan` and `probe-observations`
carry a comment naming what produces them, since neither is a stage's owned output; the wrapper's
violation line lost its verb, because two of the five rules report an absence and "writes X … and it
writes none" reads as nonsense; `dependency-direction.ts`'s module header lost the tokenizer
paragraph that moved out of it; `check-lineage-ownership.ts`'s inherited "non-type re-export"
sentence was factually wrong about its own import graph; `stage-table.ts` no longer claims the
Consistency Conventions fix a *buildable* order; case 12 became non-vacuous by testing the values
the container guard actually decides; `add` returns void; detail strings quote every identifier
consistently; the `TypeError` messages match `digest.ts`'s and `seal.ts`'s shape with no `(AD-nn)`
citation; "artefact" became "artifact"; and thirteen comments carrying a negation-then-correction
were rewritten to keep the affirmative half.

**Verified clean by execution, and worth recording because each was a specific suspicion:** no
aliasing at any of the four freeze sites, including that `compile` leaves `input.behaviors[0]`
unfrozen and `reducePreflight` leaves the plan and the observations alone; permutation invariance
over 500 shuffles of a six-member defective chain, zero mismatches; the only chain that is defective
and produces no finding needs `revisionCount: Infinity`, which `digestArtifact` rejects first;
`check:layers` produces identical output to the pre-extraction scanner on the real tree and on
injected corpora, and strictly more findings on template-bearing files; nested, tagged, and
brace-bearing template substitutions all tokenize correctly; `reviseArtifact`'s guards reject a
non-enumerable own `parentDigest` and ignore an inherited one; and `__proto__` from `JSON.parse`
pollutes nothing.

**Mutation coverage.** Thirty-seven rules were reverted one at a time and the exact expected case
went red for each: nine reader codes, the sort, the conflict address, the clone, the version fault,
the container guard, the cycle guard, the recursion, each of the four freeze sites, the allowlist
derivation, all five scanner rules, the context rule, the template re-scan, the depth bookkeeping,
and the report freeze. The no-progress guard is the one exception that cannot be scored that way:
reverting it hangs the test file rather than failing it, which is the finding.

## Peer Review Record

A third round, run in a separate Claude Code session against the finished diff and briefed to skip
everything the first two rounds had closed. The standing cross-model peer for this repository is a
Codex session; its quota was exhausted for the whole of this story's window, so it reviewed neither
the draft nor the diff, and this pass stood in for it. That is a weaker guarantee than a cross-model
read and the story records it as such.

The peer rebuilt the tree in a scratch copy and verified by execution throughout: 8000 randomised
chain presentations, 3000 shuffles of a nine-member defective chain, a deep reachability walk over
every frozen node at the four freeze sites, and a mutation per rule. Eight findings, all closed.

**The five that changed behaviour:**

1. **A type annotation let a gutted writer module pass rule 4** (HIGH). Deleting both lineage writes
   from `seal.ts` and adding one line naming the fields in a type position returned 0 violations,
   with the negative control returning 2. Rule 1 and rule 4 shared one set, and `writeKind` returns
   a declaration for a type literal by design. `writeKind` now has a third verdict, `type`, which
   rule 1 still reports and rule 4 never counts.
2. **A backtick inside a regex literal blinded both gates to the rest of a file** (HIGH). The
   scanner reaches end of file with one unterminated template token, so the no-progress guard cannot
   see it; two in-place lineage writes after such a line returned nothing. `scanTokens` now throws
   on `isUnterminated()`, and case 53 covers it. `token-scan.ts` documented the limit and nothing
   failed closed on it, which is the gap.
3. **A backtick-quoted key walked past rule 2** (MEDIUM). `o[`+"`"+`parentDigest`+"`"+`] = d` is a
   `NoSubstitutionTemplateLiteral`, and the branch keyed on `StringLiteral` alone.
4. **Three reads were reported as writes** (MEDIUM). A name bound by a destructuring and used later
   is the shape AC 9 itself predicts for `emit`; a named import and a destructured parameter were
   the other two. The declaration rule now also requires the token before the name to be `{` or `,`,
   and `import` joined the binder set. A destructured parameter stays reported and AC 9 says so.
5. **`reducePreflight`'s freeze had no non-aliasing test** (MEDIUM). Inserting `freezeArtifact(plan)`
   at the top of the reducer left the whole suite green, while the same mutation at the other three
   sites was caught. Case 14's reduce arm now asserts the plan and the observations stay unfrozen.

**Also closed:** `lineOf` moved into `token-scan.ts` untested, and a one-token off-by-one in its
binary search survived the suite (case 55); the bounded-lookback fallback was unreachable by any
case and flipping it to `read` stayed green (case 50); an escaped identifier
(`\u0070arentDigest`) bypassed the scanner, so the identifier branch reads `token.value` like the
string branch; the runtime-built key and the JSON-parsed key are named as limits in `token-scan.ts`
rather than implied away; one comment carried a negation-then-correction split across a full stop,
in a test title; AC 1 called the extracted probe fixture a single export when it has two; and the
Implementation Review Record's count of files whose regexes now reach the tokenizer was two, not
four.

**Verified clean by the peer, by execution:** 8000 randomised presentations produced no defective
chain with zero findings and no spurious finding on a sound one, every accepted set being a linear
chain under an independent oracle; 3000 shuffles of a nine-member chain carrying a conflict pair, an
orphan, a second root, a broken biconditional, and two duplicates produced zero byte differences;
the report and its `findings` and `checks` are all deep-frozen; and no frozen node is reachable from
the caller at any of the four freeze sites.

**Mutation coverage from this round:** eight more rules reverted one at a time with the expected
case going red each time, which brings the story's total to 45.

### Round two

The peer re-ran its own round-one fixtures against the fixed tree, confirmed all eight closed, and
found six more. Two were HIGH and one of those was live in the repository.

1. **A regex inside a template substitution silently blinded both gates for the rest of a file**
   (HIGH). Traced token by token: `/^\//` leaks its escaped slash, the following `//` opens a line
   comment that eats to end of line, the substitution's `}` is then re-scanned as a template tail
   that swallows the next block, and whether the file eventually throws or goes quiet is luck about
   where the swallow lands. A lineage write after such a line returned nothing. The unterminated
   guard caught only the subset that happened to end in an unterminated literal.
2. **`src/core/evaluate/operators.ts:168` desynced the tokenizer on the real tree** (HIGH).
   `/[*+?{]/` emits its brace as an `OpenBraceToken`, so brace depth ran +1 from that line to end of
   file on a file both gates scan. Nothing was lost yet, and the property case 53 pins was already
   false on the repository.

   One change closes both, and it is the root cause of every derail the story had documented as a
   limit: `scanTokens` re-scans a slash whose previous token cannot end an expression. Measured
   after: 196 repository files tokenize clean where five threw, `a / b` still reads as division, and
   every file satisfies an end-of-stream balance invariant that `operators.ts` did not. That
   invariant is now the third guard.
3. **Rule 4 was still satisfiable by a module that mints nothing** (MEDIUM). A destructured
   parameter, a type literal inside `Array<…>`, and one inside an `extends` clause each let a gutted
   `seal.ts` pass, because all three classify as declarations and declarations fed the count. The
   count now takes the minting shape: field, colon, a value that is not a type name.
4. **A nested value literal read as a type** (MEDIUM). `lineage: { parentDigest: null }` classified
   as a type position, so a writer module that nested its two fields under a sub-object would have
   failed its own gate with the wrong reason on the line. A `{` after a colon is a type only when
   the name before that colon is not itself a member.
5. **The type rule missed this repository's own formatting** (MEDIUM). Requiring `{` or `,` before a
   member start, which is how round one's false-positive cure was written, meant a type whose
   members are newline-separated and `readonly`-prefixed scanned to nothing — including
   `chain.ts`'s own `LineageFields` block. A member start now also follows `;`, `readonly`, and a
   line break.
6. **The unterminated guard's refusal set was wider than its header described** (LOW), and moot once
   the re-scan landed: every shape it had been refusing now tokenizes.

Six more rules mutation-verified, which brings the story's total to 51.

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context) for planning and implementation, with five adversarial subagents across
the two review rounds.

### Debug Log References

- Baseline: `npm run validate` at 68 test files / 2563 tests, `check:layers` 83 files / 0
  violations.
- The freeze wiring was implemented and gated in a scratch copy during the story review, before the
  story was approved, which is why AC 6 carries its result.
- Two mutation sweeps, 37 rules in total, each reverted in place with the affected test file re-run
  and restored. Every rule has a case that goes red.
- `check:lineage` failed on its first real-tree run with two spurious violations against
  `src/core/preflight/reduce.ts`. That failure is what surfaced the tokenizer derail behind
  Decision 13.

### Completion Notes List

- The story's approved AC 1 did not list `scripts/token-scan.ts` or the edit to
  `scripts/dependency-direction.ts`. Both shipped, Decision 13 is the argument, and AC 1 and Task 7
  were amended after the fact rather than the scope being stretched silently.
- AC 3 and AC 5 are labelled VERBATIM and shipped with comment prose that differs. Statements,
  expressions, exported names, field values, and control flow are unchanged; only comments differ,
  and they differ because they were pruned to the repository's own length and de-AI standard while
  being written. A reader diffing the AC block against the shipped file finds nothing else.
- The chain reader's nine codes are a module-local vocabulary and are in neither AD-5's registry nor
  AD-28's. Decision 1 is the argument. `check:ad5-registry` and `check:ad28-registry` both still
  pass, which is the mechanical statement of the same thing.
- `schemas/` is byte-identical to `HEAD` and `src/index.ts` is untouched, both asserted in AC 13.

### File List

**New**

- `src/core/lineage/stage-table.ts`
- `src/core/lineage/freeze.ts`
- `src/core/lineage/chain.ts`
- `scripts/token-scan.ts`
- `scripts/lineage-ownership.ts`
- `scripts/check-lineage-ownership.ts`
- `tests/lineage/stage-table.test.ts`
- `tests/lineage/freeze.test.ts`
- `tests/lineage/chain.test.ts`
- `tests/architecture/lineage-ownership.test.ts`
- `tests/architecture/token-scan.test.ts`
- `tests/preflight/fixtures/probe-port.ts`

**Edited**

- `src/core/schemas/evidence-artifact.ts`
- `src/core/seal/seal.ts`
- `src/core/preflight/reduce.ts`
- `src/core/stage-contracts.ts`
- `src/application/compile.ts`
- `src/application/preflight.ts`
- `scripts/dependency-direction.ts`
- `tests/application/preflight.test.ts`
- `package.json`
- `biome.json`
- `README.md`
- `_bmad-output/shareable/eval-quality-readme.html`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
