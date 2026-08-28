# Story 6.5: The library and CLI surface

Status: done

Epic: 6 (ports, pre-flight, and the library and CLI surface)
Story key: `6-5-the-library-and-cli-surface`
Implements: AD-14 in full, AD-15 in full and for the first time mechanically, AD-21's exit-code
ladder, AD-34's single-published-shape rule at the surface it names, AD-13's formatter-exclusion clause for `corpus/`,
AD-30's ninety-percent `core/` floor as a measured and gated number, and the stage-one half of
AD-38's development corpus.

**This story does not close epic 6.** AD-38 names three corpus dimensions and a four-artifact worked
example; stage one can produce one dimension and one artifact, and the rest depend on Owed items 1
and 7. Two reviewers reached that independently. So the epic's own acceptance criterion for the
development corpus stays partially met, `sprint-status.yaml`'s `epic-6` stays `in-progress`, and the
epic retrospective decides whether to accept the partial or hold the epic for `score`. Decision 12
carries the argument.

## Story

As every caller VFR-8 names,
I want each capability reachable through both surfaces with the CLI holding no logic,
so that a capability reachable one way and not the other cannot ship.

## Acceptance Criteria

### AC 1: Scope, module locations, and what this story does not build

Four prior stories deferred work here by name. `src/testing/index.ts:6-7` says the boundary
vocabulary is published at the conformance subpath "because `src/index.ts` belongs to Story 6.5", and
"6.5 decides whether the root barrel carries it too". `6-1:1239-1242` says the `root -> ports` edge
"is deliberately not added to the checker: 6.5 adds it if 6.5 decides the root barrel should carry
the port types too". `6-4:102` says "there is no `src/cli/` yet; Story 6.5 owns it". Four stories say
6.5 owns the `core/` coverage floor and its measurement (`6-1:77-78`, `6-2:67`, `6-3:652-653`,
`6-4:1180-1181`).

Three of the four things AD-14 requires of the published tarball are absent. `package.json` declares
no `bin`, no subpath for the generated JSON Schema, and no subpath for the development corpus;
`files` is `["dist", "README.md", "LICENSE"]`, so `schemas/` never leaves the repository. The
conformance subpath is the one that exists, from Story 6.1.

**Every ```ts block in this file is labelled either `VERBATIM` (copy it into source as written) or
`SKETCH` (declarations only, showing the exported surface; the dev writes the bodies).**

**New files:**

| Path | Layer | Holds |
| --- | --- | --- |
| `src/application/diagnostics.ts` | `application` | `Diagnostic`, `DiagnosticSink`, `emit` |
| `src/application/serialize.ts` | `application` | `serializeArtifact` |
| `src/application/seal.ts` | `application` | `seal`, the compile-then-seal orchestration call |
| `src/application/index.ts` | `application` | the layer barrel `cli/` and `src/index.ts` both read |
| `src/adapters/index.ts` | `adapters` | the three reference adapter factories, for `./adapters` |
| `src/cli/arguments.ts` | `cli` | the pure argument parser and its `ParsedInvocation` union |
| `src/cli/exit-codes.ts` | `cli` | AD-21's ladder as a pure total function |
| `src/cli/render.ts` | `cli` | the four output shapes |
| `src/cli/run.ts` | `cli` | the three commands, each one orchestration call plus serialization |
| `src/cli/main.ts` | `cli` | the `bin` entry: argv, streams, exit code |
| `scripts/package-boundary.ts` | script | the pure AD-15 scanner |
| `scripts/check-package-boundary.ts` | script | the wrapper behind `npm run check:boundary` |
| `scripts/dev-corpus-target.ts` | script | the corpus paths and the `kind` vocabulary, shared |
| `scripts/generate-dev-corpus.ts` | script | writes `corpus/dev/` |
| `scripts/check-dev-corpus.ts` | script | the drift check behind `npm run check:corpus` |
| `corpus/dev/**` | published data | the generated stage-one development corpus |
| `tests/cli/arguments.test.ts` | test | cases 1 through 30 |
| `tests/cli/exit-codes.test.ts` | test | cases 31 through 48 |
| `tests/cli/render.test.ts` | test | cases 49 through 56 |
| `tests/cli/run.test.ts` | test | cases 57 through 88 |
| `tests/cli/main.test.ts` | test | cases 89 through 94 |
| `tests/application/seal.test.ts` | test | cases 95 through 104 |
| `tests/application/diagnostics.test.ts` | test | cases 113 through 116 |
| `tests/application/serialize.test.ts` | test | cases 117 through 120 |
| `tests/architecture/package-boundary.test.ts` | test | cases 121 through 144 |
| `tests/architecture/package-exports.test.ts` | test | cases 145 through 158 |
| `tests/architecture/dev-corpus.test.ts` | test | cases 159 through 166 |

**Edited files:**

- `src/index.ts`: the root barrel, rewritten to the published library surface (AC 7). It was last
  rewritten by Story 6.2 in `a048c50`, which added `runPreflight` and six sensitivity-witness types;
  AC 7 rule 2 and case 153 exist so this story cannot drop them.
- `src/application/preflight.ts`: one added export, `preflightFromObservations`, and an optional
  `sink` on both entry points, with emit calls in both (AC 5).
- `tests/application/preflight.test.ts`: cases 105 through 112, the observation-fed entry.
- `src/core/schemas/verdict.ts`: **two added type aliases**, `Verdict` and `EvaluatorRecommendation`
  (AC 7 rule 3), because `src/cli/exit-codes.ts` cannot otherwise name the type. `check:schemas`
  proves a type alias changes no published byte.
- `src/core/canonical/scan-json.ts`: `Scanner`'s two constructor **parameter properties** become
  explicit field assignments (AC 16), because Node's type stripping refuses them and that makes every
  script importing `core/canonical/` die at load. `src/core/coverage/table.ts` loses the header
  paragraph documenting the workaround.
- `src/core/preflight/reduce.ts`: a guard throwing `port-contract-violation` on a repeated `probeId`
  (AC 17), which is a real defect NFR9's permutation case surfaced.

**Three non-prose `core/` edits, and no other behavioural change.** Each is listed above with the
acceptance criterion that forces it.
- Roughly 150 references across thirty-eight or more files under `src/`, for AD-15 (AC 15): the runtime
  `.describe()` / `description:` / `reason:` strings and the comments, enumerated mechanically by the
  scanner rather than by a hand list. Statements, expressions, exported names, and field names are
  unchanged.
- `schemas/*.json`: regenerated, because a published description string moves (AC 15).
- `scripts/check-ad5-registry.ts:4-8`: its comment states `files` is "dist, README.md, LICENSE",
  which AC 8 makes stale, and AC 14's whole justification cites that comment.
- `scripts/spine-lint/lint_spine.py`: the workspace default moves into the script and
  `required=True` comes off `--workspace` at `:517` (AC 15).
- `CONTRIBUTING.md`: the hook-install command beside `npm install`, because AC 15 renames `prepare`.
- `README.md`: the CLI section becomes real and the Development block gains four scripts (AC 18).
  Its relative links are **not** absolutised; Decision 15 records why.
- `_bmad-output/shareable/eval-quality-readme.html`: regenerated by `npm run build:shareable`.
- `package.json`: `bin`, four new `exports` entries, `files`, four scripts, two added `validate`
  entries and one substitution, one devDependency, the `lint:spine` command shortened by AC 15, and `prepare` moved out of the published `scripts` map (AC 8, AC 13,
  AC 14, AC 16). `prepare` runs husky and prints an allow-scripts warning on every consumer install,
  which is the same defect class as `lint:spine`'s planning-artifact path and is taken in one pass.
- `package-lock.json`: `@vitest/coverage-v8@4.1.10` plus eighteen new transitive entries.
- `vitest.config.ts`: the coverage block (AC 13).
- `biome.json`: `"!corpus"` beside the existing `"!schemas"` (AC 16).
- `.github/workflows/pr-checks.yml`: one added step in `validate-and-build`, one **replaced** step in
  `floor`, three canary jobs, and four edits to the `validate` step's `name:` string at `:65`
  (AC 13, AC 14, AC 16).
- `_bmad-output/project-knowledge/learning-path-step-by-step.md`: row 23 and Step 23 (AC 18).
- `_bmad-output/implementation-artifacts/sprint-status.yaml`: `6-5-...` to `review` (Task 15).

**Read but not edited:** `tests/coverage/fixtures/corpus.ts`, whose nineteen contracts
`scripts/generate-dev-corpus.ts` imports the way `scripts/generate-ad31-table.ts` already does.
`tests/schemas/fixtures/artifact-fixtures.ts` is **not** used: its sealed run record, isolation
manifest, and evaluator configuration are the three artifacts Decision 12 says stay absent, and
Owed item 7 forbids hand-filling them.

Every other `core/` edit is comment or `.describe()` prose. AC 19 carries the schema diff as a row.

**This story does not build:**

- An `ingest`, `score`, or `emit` command. Those stages do not exist. A command with no orchestration
  call behind it would be the logic AD-14 forbids.
- A probe adapter. AD-2 ships no network adapter in v0, so the CLI cannot hold a probe port.
  Decision 3.
- A published `PreflightPlan` artifact. The plan is a TypeScript type in `core/preflight/plan.ts`
  with no Zod schema and no place in the twelve-artifact inventory. Decision 3.
- A verdict. AD-21's ladder derives one from scored outcomes and `score` does not exist. This story
  wires the exit-code half and takes the pre-flight verdict's own `passed` boolean as its only
  verdict-shaped input. Decision 7.
- AD-38's qualified-probe half of the development corpus. Probe qualification depends on Owed items
  1 and 7, which the spine says no epic touches. AC 16 ships what stage one can produce and writes
  the absence into the corpus's own README. Decision 12.
- The other three artifacts of AD-38's worked end-to-end example. A sealed run record, an isolation
  manifest, and an evaluator configuration are ingest-side, and Owed item 7 forbids hand-filling
  downstream values. AC 16 ships a compiled-and-sealed pair under a name that does not claim AD-38's
  term. Decision 12.
- New `core/` tests. The floor is already met, measured. AC 13 is measurement and enforcement.
- Any new AD-5 or AD-28 code.

### AC 2: `src/application/diagnostics.ts`  (VERBATIM)

The Conventions Logging row is the whole requirement: "The library never writes to stdout or stderr;
diagnostics go to a caller-supplied sink, which is a plain callback rather than a port because it
returns nothing the core reads. Only the CLI adapter writes to a stream. Every diagnostic carries the
run identifier and the stage that emitted it."

```ts
/**
 * The caller-supplied diagnostic sink and the shape it receives. A plain
 * callback, never a port: it returns nothing the core reads, so there is
 * nothing to validate and nothing to await.
 *
 * Only stages carrying a run identifier emit. `compile` and `seal` take no run
 * identifier and emit nothing (Decision 5).
 */

/** One diagnostic. `stage` is the emitting stage, never the command. */
export type Diagnostic = {
	readonly runId: string
	readonly stage: 'preflight'
	readonly message: string
}

export type DiagnosticSink = (diagnostic: Diagnostic) => void

/**
 * Emits when a sink is present. A throwing sink is the caller's defect and
 * propagates: discarding it would make a broken sink look like a quiet run.
 */
export function emit(
	sink: DiagnosticSink | undefined,
	diagnostic: Diagnostic,
): void {
	if (sink !== undefined) sink(diagnostic)
}
```

`stage` is a single-member union today and widens as `ingest`, `score`, and `emit` arrive. It is a
union rather than `string` so a stage name that is not a stage fails to compile.

### AC 3: `src/application/serialize.ts`  (VERBATIM)

AD-14 says a command is "one orchestration call plus artifact serialization". The serializer is the
second half of that sentence and it belongs in `application/`, because `cli/` may not import
`core/canonical/canonicalize.ts` and because a caller writing an artifact to disk needs the same
bytes AD-27's digest is taken over.

```ts
import { canonicalize } from '../core/canonical/canonicalize.ts'

/**
 * RFC 8785 canonical bytes plus a trailing newline, as text. Strip the newline
 * and the remaining bytes are what `digestArtifact` hashes, so a caller can
 * write a file and compute its digest from the same string.
 */
export function serializeArtifact(
	artifact: unknown,
	artifactPath: string,
): string {
	return `${new TextDecoder().decode(canonicalize(artifact, artifactPath))}\n`
}
```

Case 118 states the agreement precisely, because the loose version of it is wrong:
`digestArtifact(contract, 'EvalContract')` equals `digestBytes` of the UTF-8 encoding of
`serializeArtifact(contract, 'EvalContract')` with its trailing newline removed. `digestArtifact`
returns a `sha256:`-prefixed string, so a bare `sha256sum` of the command's stdout does **not** equal
it, and the README must not claim it does.

### AC 4: `src/application/seal.ts`  (VERBATIM)

Imports are in Biome's sorted order; `biome.json` has `assist.actions.source.organizeImports` on and
`npm run lint` is `biome check .`, so an unsorted block fails the gate.

```ts
/**
 * The synchronous application boundary for the seal stage. Compiles, then
 * seals: AD-38 makes `compile` and `seal` stage one together, and sealing an
 * uncompiled contract emits a brief from declarations no discipline check has
 * seen.
 *
 * Sequencing two pure core stages is not decision logic; `preflight.ts`
 * already sequences plan and reduce. `StructuralFailure` and `RuntimeFault`
 * propagate. `core/seal` throws `TypeError` on preconditions compilation does
 * not cover, and this boundary converts those rather than letting an untyped
 * throw reach a caller (Decision 2).
 */
import { RuntimeFault } from '../core/schemas/faults.ts'
import type { SealedEvaluatorBrief } from '../core/schemas/sealed-evaluator-brief.ts'
import { seal as sealContract } from '../core/seal/seal.ts'
import { compile } from './compile.ts'

export function seal(
	input: unknown,
	options?: { readonly strict?: boolean },
): SealedEvaluatorBrief {
	const contract = compile(input, options)
	try {
		// `core/seal` validates the assembled brief and freezes it on the way
		// out, so AD-28's outbound check is already done and is not repeated.
		return sealContract(contract)
	} catch (error) {
		if (!(error instanceof TypeError)) throw error
		throw new RuntimeFault(
			'schema-parse-failure',
			'EvalContract',
			`the contract compiles but cannot be sealed: ${error.message}`,
			{ cause: error },
		)
	}
}
```

**Decision 2, corrected by execution.** The first draft claimed compiling first makes every
`core/seal/seal.ts` `TypeError` precondition unreachable. That is true of exactly two of five:

| Precondition | Pre-empted by compile? |
| --- | --- |
| `seal.ts:62`, a null oracle direction | **Yes.** `oracle-alignment.ts:12-19` throws `StructuralFailure('oracle-missing-channel')` and `compile.ts:85` runs it. |
| `src/core/seal/seal.ts:40`'s duplicate-key throw at `:112` (`oracleId`) and `:113-117` (`permittedInterfaces.logicalId`) | **No.** No AD-5 code covers either, and `seal.ts:25-27` says so itself. |
| The same throw at `:118-122` (`scopedResources.reference`) | **Yes, and not for a uniqueness reason.** `src/core/compile/forbidden-inputs.ts:21-29` throws `StructuralFailure('scoped-reference-resolves-forbidden')` on *any* scoped resource, duplicate or not, so this site is unreachable through this boundary. |
| `seal.ts:52`, `buildPlanIndex` with the default `duplicateIds: 'throw'` (`src/core/seal/plan-index.ts:161-162`) | **No.** Every compile check deliberately passes `'unresolved'`; `src/core/compile/rubrics.ts:239-241` records why. |
| `seal.ts:156`, `validateAssembledBrief` | **No, and it is reachable from ordinary input.** `EvalContract.oracles` carries no minimum (`eval-contract.ts:145-149`, "an empty list must parse") while `SealedEvaluatorBrief.directions` is `.min(1)` (`sealed-evaluator-brief.ts:53-58`), so a zero-oracle contract compiles clean and seals to `directions: []`. |

So a contract declaring two `permittedInterfaces` with one `logicalId` compiles clean and, without
the `catch`, throws a raw `TypeError` out of the published boundary with no AD-21 exit code on it.
**On the code, plainly, because a reviewer asked and the registry refutes the easy answer.** AD-28's
entry reads "`schema-parse-failure` | an artifact does not parse or does not validate against its
published schema". A contract with two `permittedInterfaces` sharing a `logicalId` **does** parse and
**does** validate — `src/core/seal/seal.ts:25-27` says the schema deliberately enforces no uniqueness
there — so calling that a parse failure is a claim AD-28's own words contradict. AD-28 carries no
precondition-violation code at all, and the other nine are worse fits.
`schema-parse-failure` is therefore taken as the **nearest available code under AC 1's no-minting
rule, with the mismatch recorded rather than argued away**. It is honest for the
`validateAssembledBrief` row, where the brief genuinely fails its published schema, and it is a
stretch for the two duplicate-key rows. Minting a code is a spine amendment; that trade is the
reason this reads as an admission instead of a justification.

**What the cases assert follows the table, and the pre-empted rows assert the opposite of the live
ones.** Case 98 drives a null oracle direction and asserts a
`StructuralFailure('oracle-missing-channel')` reaching the caller **unconverted**, because being
pre-empted is exactly what that row claims and a `RuntimeFault` there would prove the claim false.
Case 99 does the same for `scopedResources.reference`, asserting
`StructuralFailure('scoped-reference-resolves-forbidden')`. Cases 100 and 101 drive the two live
duplicate keys, `oracleId` and `permittedInterfaces.logicalId`, one contract each, and case 102
drives the zero-oracle contract that reaches `validateAssembledBrief`; all three assert a
`RuntimeFault` with `code === 'schema-parse-failure'`. The `buildPlanIndex` row gets no case of its
own: duplicating an existing step id trips compile first under `unreachable-check-evidence`, because
every compile check passes `duplicateIds: 'unresolved'` and that removes the ambiguous id, so the
only contract that reaches it carries an unreferenced step id and is a variant of case 101 rather
than a distinct one.

Case 103 asserts the brief is a lineage root (`parentDigest: null`, `revisionCount: 0`), which
`core/seal/seal.ts:93-98` already mints, so compiling internally does not break AD-29's chain.

### AC 5: `src/application/preflight.ts` — the observation-fed entry  (SKETCH)

```ts
export type PreflightFromObservationsOptions = {
	readonly contract: EvalContract
	readonly probes: readonly Probe[]
	readonly runId: string
	readonly observations: readonly ProbeObservation[]
	readonly sink?: DiagnosticSink
}

/**
 * The same pre-flight verdict for a caller who probed by some other means:
 * plans, skips the awaiting, reduces over observations it is handed.
 */
export function preflightFromObservations(
	options: PreflightFromObservationsOptions,
): PreflightVerdict
```

Rules, each with a case:

1. Every input is parsed at the boundary in both directions (AD-28): `EvalContract`, `Probe[]`,
   `ProbeObservation[]` in, `PreflightVerdict` out. A failure throws
   `RuntimeFault('schema-parse-failure', ...)` naming the schema. Cases 105 through 108.
2. It calls `planPreflight` then `reducePreflight` and holds no branch of its own. Case 110 asserts
   the call order.
3. It returns `freezeArtifact(parsed.data)`, matching `runPreflight`. Case 109.
4. **`runPreflight` gains emission, not just a parameter.** `src/application/preflight.ts:46-97` has
   no sink and emits nothing today; the dev adds an `emit` call around each `await` and a closing
   one, mirroring `preflightFromObservations`. Both then emit identical text for identical inputs,
   which case 111 asserts by running both over one fixture and comparing the collected sinks. The
   fixture must be **fully observed**: `invokePort` either returns an observation or throws, so
   `runPreflight` can never produce the `no observation` line, and `reducePreflight` binds by
   `probeId` to `leg.legId` (`reduce.ts:109-115`) rather than by array position.
5. **An observation array that matches no planned leg is a fault, not a verdict.**
   `src/core/preflight/reduce.ts:299-304` throws `RuntimeFault('port-contract-violation', ...)` when
   `states.size === 0`, because `ProbeRequest.probeId` is echoed unchanged by contract and a wholly
   unanswered plan means the port broke it. A **partial** array is different: the per-leg lookup at
   `:116` does `continue` on a missing observation, so a caller who probed some legs gets a failed
   verdict. Cases 78, 79, 80, and 112 pin all three shapes. The first draft of this story had rule 5
   backwards and a reviewer found it by execution; it is spelled out here so it cannot revert.

Both entry points type their artifact fields and parse them, which is the repository's existing
answer and AD-28's requirement. AD-34's "one published shape rather than two" is not satisfied by
these two entry points and Decision 3 records that as a deviation with its four differences named.

### AC 6: `src/application/index.ts` — the layer barrel  (VERBATIM)

This file exists because of the import matrix, and getting it wrong is how the first draft of this
story acquired two `check:layers` violations. `scripts/dependency-direction.ts:51-52` classifies
`src/core/schemas/**` as `core-schemas` and **everything else under `src/core/` as `core`**.
`isAllowedEdge('root', ...)` grants `application` and `core-schemas` only, and
`isAllowedEdge('cli', ...)` grants `application` and `adapters` only. So neither `src/index.ts` nor
`src/cli/*` may import `core/failure-codes.ts` or `core/lineage/chain.ts`. `application` may import
`core`, so everything routes through here.

```ts
/**
 * The application layer's published surface. `cli/` may import this layer and
 * `adapters/` and nothing else; `src/index.ts` may import this layer and
 * `core/schemas` and nothing else. Anything either of them needs out of
 * `core/` is re-exported here rather than reached for directly, which is what
 * keeps the dependency matrix unamended.
 */
export {
	digestArtifact,
	digestBytes,
	digestComposite,
} from '../core/canonical/digest.ts'
export type { FailureCode } from '../core/failure-codes.ts'
export { FAILURE_CODES, StructuralFailure } from '../core/failure-codes.ts'
export type {
	LineageChainReport,
	LineageFinding,
} from '../core/lineage/chain.ts'
export { validateLineageChain } from '../core/lineage/chain.ts'
export { INTERCHANGE_ARTIFACT_KEYS } from '../core/schemas/artifact.ts'
export type { RuntimeFaultCode } from '../core/schemas/faults.ts'
export { RUNTIME_FAULT_CODES, RuntimeFault } from '../core/schemas/faults.ts'
export type {
	EvaluatorRecommendation,
	Verdict,
} from '../core/schemas/verdict.ts'
export {
	EVALUATOR_RECOMMENDATIONS,
	VERDICTS,
} from '../core/schemas/verdict.ts'
export { compile } from './compile.ts'
export type { Diagnostic, DiagnosticSink } from './diagnostics.ts'
export type {
	PreflightFromObservationsOptions,
	RunPreflightOptions,
} from './preflight.ts'
export { preflightFromObservations, runPreflight } from './preflight.ts'
export { seal } from './seal.ts'
export { serializeArtifact } from './serialize.ts'
```

`INTERCHANGE_ARTIFACT_KEYS` (`src/core/schemas/artifact.ts:98`) is a plain string array.
`INTERCHANGE_ARTIFACTS` is **not** exported from here or anywhere published: each of its twelve
entries carries `schema: z.ZodType` (`artifact.ts:23`, `:41`), so exporting the registry would hand
every consumer our Zod instance and couple them to zod 4.4.3. The published JSON Schema is the
supported parsing route. Decision 14.

`digestArtifact` and `digestBytes` are published because AC 3's serializer is only useful next to
them, and because a caller cannot construct the lineage chain `validateLineageChain` reads without
computing digests.

**The order is Biome's, not a preference.** `biome.json` turns on
`assist.actions.source.organizeImports`, which sorts `export ... from` statements too: `../core/*`
specifiers sort before `./*`, and within one specifier `export type {...}` sorts before
`export {...}`. `npm run lint` is `biome check .`, so any other order fails the gate. A reviewer
wrote an earlier draft of this block into a clone and got
`src/application/index.ts:8:1 assist/source/organizeImports x Sort these exports.`

**Four names are deliberately not published.**

- `emit` is how `application/` writes to a sink the caller supplied; a caller holds its own sink and
  never needs it. It would also collide at the package root with `emit` the pipeline stage, which
  `src/index.ts`'s own header names.
- `invokePort` is the port-awaiting helper. Publishing it at the package root contradicts the
  reasoning AC 7 rule 5 uses to keep the port vocabulary at `./conformance`, and its only parameter
  type, `InvokePortOptions`, lives in `ports/` where neither `root` nor `cli` may reach — so a
  consumer could call it and could not declare a variable of its options type.
- **`reviseArtifact` cannot be named here at all.** Story 6.4's `check:lineage` scanner flags the
  bare identifier anywhere outside `src/core/schemas/` and `src/core/lineage/`, a re-export included
  (`scripts/lineage-ownership.ts:21`, `:256-265`). A reviewer wrote AC 6 as first drafted and got
  `src/application/index.ts:23 reviseArtifact: reviseArtifact() sets both lineage fields, so naming
  it outside the AD-24 table is the same violation one line further out (AD-29)`, exit 1. Dropping
  the name clears it: `92 file(s) scanned under src/, 0 violations`. The alternative was to add
  `src/application/index.ts` to a Story 6.4 gate's allowlist, which is a worse trade: the gate is
  right, and a caller who wants to mint a revision can compute the digest and the count from
  `digestArtifact` and the parent's own fields, which are both published here.
- `LINEAGE_DEFECT_CODES` and `LineageDefectCode`. `src/core/lineage/chain.ts:8-11` calls the nine
  codes "a module-local vocabulary in neither registry", so neither `check:ad5-registry` nor
  `check:ad28-registry` pins them and nothing would govern their stability once published as a named
  export. The union still reaches a consumer structurally through `LineageFinding.code`, which is
  disclosure under AD-11 without a registry claim the repository cannot back.

### AC 7: `src/index.ts`, `src/adapters/index.ts`, and two type aliases

**Rule 1 — the root barrel is `application/index.ts` plus artifact types.** It imports
`./application/index.ts` and `./core/schemas/*` and nothing else, which is exactly what the matrix
grants and what the file's own existing header already says.

```ts
export * from './application/index.ts'

export type { EvalContract } from './core/schemas/eval-contract.ts'
export type { SealedEvaluatorBrief } from './core/schemas/sealed-evaluator-brief.ts'
export type {
	PreflightCheck,
	PreflightVerdict,
} from './core/schemas/preflight-verdict.ts'
export type { Probe } from './core/schemas/probe.ts'
// ... one type export per key in INTERCHANGE_ARTIFACT_KEYS, plus rule 2's carry-overs
export const VERSION = '0.0.0'
```

**Rule 2 — nothing currently exported is removed.** `src/index.ts` was last rewritten by Story 6.2
in commit `a048c50`, which added `runPreflight`, `RunPreflightOptions`, `PreflightCheck`,
`PreflightVerdict` **and six sensitivity-witness types**: `FixtureReset`, `ManifestationWitness`,
`SensitivityWitness`, `SensitivityWitnessLeg`, `WitnessChannel`, `WitnessInputs`. None of the six is
an interchange artifact, so a completeness rule derived from `INTERCHANGE_ARTIFACT_KEYS` would not
notice them going missing. Case 153 asserts every name in a **committed snapshot** of the export set is still exported, so a
removal is a deliberate act with a failing test in front of it rather than an oversight. It is a
snapshot rather than a git merge-base because no job in `pr-checks.yml` sets `fetch-depth`, so every
checkout is depth 1 and there is no base commit to diff against; editing the snapshot is how a future
story records a deliberate removal.
Removing a published export is a caller-facing break under AD-11 and NFR8.

**Rule 3 — `src/core/schemas/verdict.ts` gains two type aliases.**

```ts
export type Verdict = z.infer<typeof Verdict>
export type EvaluatorRecommendation = z.infer<typeof EvaluatorRecommendation>
```

Every other interchange artifact already has its `z.infer` alias; these two are the only ones that do
not, and without them `import type { Verdict }` fails with `TS2749: 'Verdict' refers to a value, but
is being used as a type here`. `npm run check:schemas` after the edit proves a type alias is erased
before the schema builder runs, the same proof Story 6.4 recorded for its `LineageChain` export.

**Rule 4 — `src/adapters/index.ts`  (VERBATIM).**

```ts
/**
 * The reference adapters, published at the `./adapters` subpath. AD-28 calls
 * them conveniences and never a required path, so they sit behind their own
 * subpath and the root barrel keeps the `root -> adapters` edge the matrix
 * does not grant.
 */
export { createLocalCorpusAdapter } from './local-corpus-adapter.ts'
export type { CorpusMechanism } from './local-corpus-adapter.ts'
export { createNodeFileSystemAdapter } from './node-file-system-adapter.ts'
export type { FileSystemMechanism } from './node-file-system-adapter.ts'
export { createSystemClockAdapter } from './system-clock-adapter.ts'
export type { ClockMechanism } from './system-clock-adapter.ts'
```

**Rule 5 — no matrix edge is added.** Story 6.1 left `root -> ports` open for this story and the
answer is no: `RunPreflightOptions.port` types through transitively, and an adapter author reads the
port vocabulary at `./conformance`, where AD-37 says the conformance definition lives. `root -> core`
and `cli -> core` are likewise not added; AC 6 is why they are not needed. AC 19's `check:layers` row
is the proof. Decisions 8 and 9.

### AC 8: `package.json`

```jsonc
"bin": { "eval-quality": "dist/cli/main.js" },
"files": ["dist", "schemas", "corpus", "README.md", "LICENSE"],
"exports": {
  ".":              { "types": "./dist/index.d.ts",          "default": "./dist/index.js" },
  "./adapters":     { "types": "./dist/adapters/index.d.ts", "default": "./dist/adapters/index.js" },
  "./conformance":  { "types": "./dist/testing/index.d.ts",  "default": "./dist/testing/index.js" },
  "./schemas/*":    "./schemas/*",
  "./corpus/*":     "./corpus/*",
  "./package.json": "./package.json"
}
```

**The wildcard target is `./schemas/*`, not `./schemas/*.json`.** The generated files are named
`<kind>.schema.json`, so a `*.json` target makes the natural specifier
`eval-quality/schemas/rubric.schema.json` resolve to `rubric.schema.json.json` and fail, while
granting only the dangling `eval-quality/schemas/rubric.schema`. Verified against a real
`npm pack` and install: with `./schemas/*` mapped to `./schemas/*`, both
`eval-quality/schemas/rubric.schema.json` and `eval-quality/corpus/dev/README.md` both resolve under
`createRequire(...).resolve`, which is the form AC 17 case 145 uses and the only one that stats. The same argument applies to `./corpus/*`, and the README matters there because AC 16 rule 4
makes it load-bearing for AD-38's disclosure.

`./package.json` is exported because tooling that reads a package's own manifest through the exports
map is otherwise blocked.

**Four new scripts:** `test:coverage`, `check:boundary`, `generate:dev-corpus`, `check:corpus`.
**Three new `validate` entries:** `check:boundary` and `check:corpus` appended after `check:lineage`,
and the chain's final `npm run test` becomes `npm run test:coverage`.

**Each `validate` entry lands in the task that creates the script it calls**, never earlier: an entry
pointing at a file that does not exist makes `npm run validate` crash on a missing module rather than
fail a check. So Task 8 adds the `bin`, `exports`, `files`, and `test:coverage`'s entry; Task 9 adds
`check:boundary` and its entry; Task 11 adds `generate:dev-corpus`, `check:corpus`, and its entry.
`npm run validate` is not runnable end to end until Task 11, and it stays red through Task 9 on the
real AD-15 violations until Task 10 clears them. Tasks 8 through 10 say so rather than discovering
it.

**`dist/cli/main.js` needs a shebang.** `src/cli/main.ts` carries `#!/usr/bin/env node` as its first
line; `tsc` preserves it as the first line of the emitted file even above imports, and
`tsconfig-build.json` needs no change. `tsc` emits mode `0644`; `npm install` chmods the `bin` target
to `0755`, so case 155 asserts the built file exists and case 92 asserts the installed
`node_modules/.bin/eval-quality` runs. Neither asserts a mode `tsc` never sets.

### AC 9: `src/cli/arguments.ts` — the parser  (SKETCH)

Pure and synchronous over an `argv` array. No filesystem, no `process`, no environment.

```ts
export type Command = 'compile' | 'seal' | 'preflight'

export type InputKey = 'in' | 'contract' | 'probes' | 'observations'

export type ParsedInvocation =
	| { readonly kind: 'help'; readonly command: Command | null }
	| { readonly kind: 'version' }
	| { readonly kind: 'usage-error'; readonly message: string }
	| {
			readonly kind: 'run'
			readonly command: Command
			readonly inputs: Readonly<Partial<Record<InputKey, string>>>
			readonly out: string | null
			readonly runId: string | null
			readonly strictInputs: boolean
			readonly strict: boolean
	  }

export function parseArguments(argv: readonly string[]): ParsedInvocation
```

`InputKey` is closed, so a usage error can name a flag and case 66's read count is derivable from the
key set rather than from prose. A key absent from `inputs` means stdin.

**The grammar, exactly:**

```
eval-quality compile          [--in <path>] [--out <target>]
                              [--strict-inputs | --no-strict-inputs] [--strict]
eval-quality seal             [--in <path>] [--out <target>]
                              [--strict-inputs | --no-strict-inputs] [--strict]
eval-quality preflight         --contract <path> --probes <path> --observations <path>
                               --run-id <id> [--out <target>] [--strict]
eval-quality --help | -h | help [<command>]
eval-quality --version | -V
```

**Three commands, and the rule that fixes the number is AD-14's own sentence: a command exists where
one orchestration call produces an interchange artifact to serialize.** `compile`, `seal`, and
`preflight` each do. `validateLineageChain`, `reviseArtifact`, `serializeArtifact`, and the three
digest functions do not, and are library helpers rather than stage capabilities. Decision 4 records
why a `validate-lineage` command was drafted and then withdrawn.

Rules, each with a case:

1. **`--strict` is AD-21's gate-promotion flag**, accepted on every command, and
   `--strict-inputs`/`--no-strict-inputs` is AD-4's compile mode, default on. AD-21 spells the
   promotion flag `--strict` three times on `ARCHITECTURE-SPINE.md:368` and seven
   times across the spine; AD-4 and the Configuration convention name none, and the spine carries
   exactly two backticked flags, `--dry-run` and `--strict`. Decision 6. Cases 8 through 10 assert
   `--strict` parses on all three commands; cases 11 and 12 cover the input mode and last-flag-wins.
2. A missing input key means stdin. `--in -` means stdin explicitly. At most one input may be `-`,
   because one stdin cannot serve two readers; two is a usage error naming both flags. Cases 13, 14,
   and 15.
3. `--in=<value>` equals-form is accepted for every value-taking flag, which is the spelling that
   makes a path beginning with `-` expressible. Case 16. `--` ends flag parsing and no command takes
   a positional, so a token after it is a usage error naming that token. Case 17.
4. Every command is non-interactive. No prompt, no TTY check, no behaviour that differs when stdin is
   a terminal. Case 24 scans the module source for `isTTY`; case 25 scans it for `node:fs` and
   `node:path`.
5. Six usage-error shapes, each with its own case and each asserting the `message` names the
   offending token: an unknown flag (18), a flag missing its value (19), a repeated single-value flag
   with two different values (20), a missing required `preflight` input (21), an unknown command
   (22), and an empty argv (23).
6. The parser never reads a file and never resolves a path. `inputs` holds the strings as given.
   Case 25.

### AC 10: `src/cli/exit-codes.ts` — AD-21's ladder  (VERBATIM)

```ts
/**
 * AD-21's exit codes, as a total function over what a command produced.
 *
 * Zero, one, and two are the verdict range. A command that produced no verdict
 * never takes one or two, so a CI runner reading a two knows a verdict said
 * FAIL rather than that a compile failed (Decision 7). Zero stays plain
 * success for every outcome, verdict or not.
 */
import type { Verdict } from '../application/index.ts'

export const EXIT_OK = 0
export const EXIT_CONCERNS_PROMOTED = 1
export const EXIT_FAIL = 2
export const EXIT_INVALID = 3
export const EXIT_STRUCTURAL_FAILURE = 4
export const EXIT_FAULT = 5
/** sysexits.h EX_USAGE. Outside the verdict range and outside AD-21's codes. */
export const EXIT_USAGE = 64

export type CommandOutcome =
	| { readonly kind: 'artifact' }
	| { readonly kind: 'preflight'; readonly passed: boolean }
	| {
			readonly kind: 'verdict'
			readonly verdict: Verdict
			readonly evidenceConditionsOnly: boolean
	  }
	| { readonly kind: 'structural-failure' }
	| { readonly kind: 'fault' }
	| { readonly kind: 'usage-error' }

function verdictExit(
	outcome: Extract<CommandOutcome, { kind: 'verdict' }>,
	strict: boolean,
): number {
	if (outcome.verdict === 'FAIL') return EXIT_FAIL
	// `--strict` promotes CONCERNS to one, "except a CONCERNS whose only firing
	// conditions are evidence conditions, which `--strict` never promotes"
	// (AD-21). A thinner measurement is not a claim about the system.
	if (
		outcome.verdict === 'CONCERNS' &&
		strict &&
		!outcome.evidenceConditionsOnly
	) {
		return EXIT_CONCERNS_PROMOTED
	}
	return EXIT_OK
}

export function exitCodeFor(
	outcome: CommandOutcome,
	options: { readonly strict: boolean },
): number {
	switch (outcome.kind) {
		case 'artifact':
			return EXIT_OK
		// A failed pre-flight invalidates the run rather than becoming a
		// contract verdict (AD-10), so it takes the invalid code and never two.
		case 'preflight':
			return outcome.passed ? EXIT_OK : EXIT_INVALID
		case 'verdict':
			return verdictExit(outcome, options.strict)
		case 'structural-failure':
			return EXIT_STRUCTURAL_FAILURE
		case 'fault':
			return EXIT_FAULT
		case 'usage-error':
			return EXIT_USAGE
	}
}
```

Cases 31 through 48: one per outcome kind, one per verdict crossed with `strict`, the
evidence-condition carve-out in both directions, an exhaustiveness case feeding a value cast outside
the union and asserting `undefined` rather than a wrong number, and a sweep asserting no outcome kind
other than `verdict` ever returns 1 or 2.

### AC 11: `src/cli/render.ts` and `src/cli/run.ts`  (SKETCH)

**`render.ts`** holds four output shapes and nothing else.

```ts
/** Delegates to `serializeArtifact`; the canonical bytes are not re-derived here. */
export function renderArtifact(artifact: unknown, artifactPath: string): string

/** `eval-quality: <stage>: <runId>: <message>` */
export function renderDiagnostic(diagnostic: Diagnostic): string

/** `eval-quality: <code>: <artifactPath>: <detail>` for either error class. */
export function renderError(error: unknown): string

/** `eval-quality: usage: <message>` */
export function renderUsage(message: string): string
```

`renderArtifact` **delegates**; it is one line over `serializeArtifact`. Stating it matters because
the whole argument for putting the serializer in `application/` is that `cli/` may not import
`core/canonical/canonicalize.ts`, and an independently implemented `renderArtifact` either duplicates
the canonicalization or reaches into `core/`. Case 49 asserts byte equality with `serializeArtifact`
over a fixture. `renderError` reads `.code` and `.artifactPath` off either error class and falls back
to `String(error)`, which is what a defect in our own code looks like from outside; cases 52, 53, 54.

**`run.ts`** is the whole of the command logic, and it is deliberately thin.

```ts
export type RunEnvironment = {
	readonly readInput: (source: string | null) => Promise<string>
	readonly writeArtifact: (path: string, body: string) => Promise<void>
	readonly writeOut: (body: string) => void
	readonly writeDiagnostic: (line: string) => void
	readonly resolvePath: (path: string) => string
	readonly version: string
}

export type RunResult = { readonly outcome: CommandOutcome }

export async function run(
	invocation: ParsedInvocation,
	environment: RunEnvironment,
): Promise<RunResult>
```

Rules, each with a case:

1. **`run` is total over `ParsedInvocation`**, `help` and `version` included, so `main.ts` holds no
   branch of its own. It never touches `process`, `node:fs`, `node:path`, or a stream: every effect
   is a member of `RunEnvironment`, which is what makes cases 57 through 88 in-memory. `resolvePath`
   exists so rule 6's collision check can compare resolved paths without `run` importing
   `node:path`, and `version` exists because `cli/` may not import `src/index.ts` where `VERSION`
   lives, so the binary's own version has to arrive as data. `main.ts` is the only file that
   constructs a real environment and it reads the version from its own `package.json`.
2. Each command is: read inputs, `JSON.parse` them, make **exactly one** call into
   `application/`, serialize, write, return an outcome. Cases 61 through 64 assert the call count by
   injecting a recording facade over the three application entry points and asserting exactly one
   invocation with the expected arguments. Cases 65 and 66 assert the I/O counts separately, because
   an I/O count says nothing about how many orchestration calls happened.
3. **A `JSON.parse` failure is a fault, not a usage error.** AD-28's registry entry reads
   "`schema-parse-failure` | an artifact **does not parse** or does not validate against its
   published schema", and the CLI is the boundary that deserializes. `run` throws
   `RuntimeFault('schema-parse-failure', <the artifact path for that input key>, ...)`, which maps to
   `{ kind: 'fault' }` and exit 5. Case 71. The first draft called this a usage error and exit 64; a
   reviewer read AD-28's first clause and was right.
4. A `StructuralFailure` becomes `{ kind: 'structural-failure' }`; a `RuntimeFault` becomes
   `{ kind: 'fault' }`; both are rendered to the diagnostic stream through `renderError`. `run`
   catches these two and rethrows everything else, so a defect in our own code surfaces as a stack
   rather than as exit 5. Cases 72, 73, 74.
5. With `--out <dir>`, the artifact is written to `<dir>/<kind>.json` where `kind` is
   `eval-contract`, `sealed-evaluator-brief`, or `preflight-verdict`, and **nothing** goes to stdout.
   Without it, the artifact goes to stdout and nothing is written. Diagnostics go to the diagnostic
   stream in both cases. The caller scopes the directory to a run; the CLI mints no identifier and
   creates no nested path, because a minted identifier makes two identical invocations produce
   different trees. Cases 65 and 66; rule 9 owns the target-shape half.
6. An input is never mutated in place. `run` compares `resolvePath(<dir>/<kind>.json)` against
   `resolvePath` of every input path and returns `{ kind: 'usage-error' }` with a message naming both
   sides when they collide. Case 75.
7. `preflight` passes `--run-id` through as `PreflightVerdict.runId` and installs a sink routing
   every diagnostic to `writeDiagnostic`. Cases 76, 77.
8. `compile` and `seal` write no diagnostic on success. They carry no run identifier, so any line
   they wrote would be a stream write with no run id and no stage, which the Conventions Logging row
   forbids of a diagnostic. Silence on success is the machine-readable default AD-14 asks for.
   Case 86. Decision 5.
9. **`--out <target>` is a directory when it has no `.json` suffix and a file path when it does.**
   AD-14 says commands "accept and emit every artifact as either a file path or stdin and stdout";
   the epic's own acceptance criterion says "outputs go to a run-scoped directory". Accepting both
   satisfies both, and the suffix is the whole classifier because the CLI does not stat the
   filesystem. A directory target writes `<target>/<kind>.json`, joined through `RunEnvironment`'s
   `joinPath` because rule 1 bars `run` from `node:path`; a file target writes `<target>` exactly.
   `kind` is `eval-contract`, `sealed-evaluator-brief`, or `preflight-verdict`,
   one per command. Cases 67 and 68.
10. **The two strict flags map to two different places and share a word.** `run` passes
    `invocation.strictInputs` into the application call's `options.strict`, which is AD-4's input
    strictness (`src/application/compile.ts` reads `options?.strict ?? true`), and passes
    `invocation.strict` into `exitCodeFor`'s `options.strict`, which is AD-21's gate promotion. The
    application layer's option keeps the name it already has; the mapping is stated here because the
    two are one keystroke apart and Decision 6 exists to stop exactly this confusion. Cases 83, 84,
    and 85.

### AC 12: `src/cli/main.ts`  (SKETCH)

The `bin` entry, and the only file in the package that reads `process.argv`, reads stdin, or writes
to stdout or stderr.

```ts
#!/usr/bin/env node
export async function main(argv: readonly string[]): Promise<void>

await main(process.argv.slice(2))
```

The top-level `await main(...)` is what makes the file executable; without it the `bin` target loads
and does nothing. `main` returns `void` and communicates through `process.exitCode`, so there is one
exit mechanism rather than two.

Rules:

1. It builds a `RunEnvironment` over `node:fs/promises`, `node:path`, `process.stdin`,
   `process.stdout`, and `process.stderr`, and fills `version` by reading its own `package.json`.
   **Artifacts, help, and the version go to stdout; diagnostics and errors go to stderr.** Help and
   the version are the command's output rather than a diagnostic, so `eval-quality --version` is
   pipeable. Cases 69 and 70 assert the split through the environment's two writers.
2. It calls `parseArguments`, then `run` for **every** kind including `help` and `version` — AC 11
   rule 1 makes `run` total over `ParsedInvocation`, so `main` holds no branch of its own — then sets
   `process.exitCode` from `exitCodeFor`. It calls `process.exit` **nowhere**, so a pending stdout
   write is never truncated. Cases 89 and 90.
3. `help` and `version` return `{ kind: 'artifact' }`, so their exit code is derived through
   `exitCodeFor` like every other outcome rather than left to `process.exitCode`'s default. Neither
   is a failure, and `EXIT_OK` is what AD-21 gives a command that did what was asked.
4. `--help` prints the grammar block from AC 9 verbatim followed by AC 10's seven exit codes with one
   line each; `help <command>` prints that command's grammar line and its flags. `--version` prints
   `environment.version` and nothing else. Cases 87 and 88 assert both through `run`'s environment;
   case 92 asserts the real binary. The exit-code table `--help` prints and the one AC 18 puts in the
   README are the same seven lines, written once in `render.ts`.
5. Reading stdin is a single read to end, not a stream transform. An artifact is small and a
   canonical JSON document has no incremental meaning. Cases 63 and 64 assert `readInput` is called
   exactly once per input key.

### AC 13: the coverage floor, measured and gated

AD-30: "Statement and branch coverage on `core/` is at least 90 percent ... `adapters/` and `cli/`
are excluded from that floor and covered by AD-37's conformance suite instead."

**The dependency.** `@vitest/coverage-v8` at exactly `4.1.10`, the exact-match optional peer vitest
4.1.10 declares (`node_modules/vitest/package.json`, `package-lock.json:2507`). Licence MIT.
Published 2026-07-06, past `.npmrc`'s `min-release-age=7`. It adds **eighteen** transitive lockfile
entries, not the six the first draft named: `magicast`, `istanbul-reports`, `@bcoe/v8-coverage`,
`ast-v8-to-istanbul`, `istanbul-lib-report`, `istanbul-lib-coverage`, `@babel/helper-string-parser`,
`@babel/helper-validator-identifier`, `@babel/parser`, `@babel/types`, `@jridgewell/resolve-uri`,
`@jridgewell/trace-mapping`, `has-flag`, `html-escaper`, `js-tokens`, `make-dir`, `semver`,
`supports-color`. Licences are MIT with BSD-3-Clause on the `istanbul-*` packages and ISC on
`semver`, all on AD-25's allowlist. Both gates were run against the real install: `Licence scan
passed: 179 entries` and `Lockfile age audit passed: 179 entries`. AD-25 evaluates the whole resolved
graph, which is why the count matters.

**A trap Task 1 must not fall into:** `node_modules/` already carries the package unlocked, so
`npm i -D @vitest/coverage-v8@4.1.10` can report "up to date" and add nothing while CI's `npm ci` has
no provider at all. Task 1 confirms the **lockfile** grew by nineteen entries, the provider plus
its eighteen transitives, rather than that the install printed something.

**`vitest.config.ts` (VERBATIM).**

```ts
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		environment: 'node',
		include: ['tests/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			// AD-30's floor is `core/` alone. `adapters/` and `cli/` are covered
			// by AD-37's conformance suite and the CLI's own tests, and counting
			// them here would let a well-tested adapter mask a thin core.
			include: ['src/core/**'],
			reporter: ['text-summary', 'json-summary'],
			// Outside the repository. Writing into `./coverage` intermittently
			// fails with "Something removed the coverage directory", and a flake
			// there reads as a threshold failure.
			reportsDirectory: join(tmpdir(), 'eval-quality-coverage'),
			thresholds: { statements: 90, branches: 90 },
		},
	},
})
```

`thresholds` makes vitest itself the gate: it exits non-zero when either falls below 90, so the check
is the test run rather than a second script reading a report.

**Wiring.** `"test:coverage": "vitest run --coverage"`, and `validate`'s final `npm run test` becomes
`npm run test:coverage`, so the floor is enforced on every local gate. `.gitignore` already carries
`/coverage`.

**The measured baseline**, taken on the tree at `98eb281`, 73 test files and 2625 tests:

| Axis | Measured | Floor |
| --- | --- | --- |
| Statements | 96.81% (2857/2951) | 90% |
| Branches | 92.13% (1628/1767) | 90% |
| Functions | 99.80% (517/518) | — |
| Lines | 97.87% (2585/2641) | — |

Branches is the tight axis: 2.13 points over 1767 branches, roughly thirty-seven uncovered branches
from red.

**That table is a pre-edit measurement.** AC 1's three `core/` edits add two statements and two
branches, so the number after them is 96.78% (2858/2953) and 92.08% (1629/1769) — measured, both well
clear of the floor. Read the difference as the edits rather than as a regression. The
duplicate-`probeId` guard's throw branch is uncovered until case 82 exists, which is why AC 1 can put
"new `core/` tests" on the does-not-build list and still land a `core/` guard: case 82 covers it at
the boundary.

**The measured set is `src/core/**` and the alternative was measured too.** AD-30 excludes
`adapters/` and `cli/` from the floor and does not say whether `application/`, `ports/`, and
`testing/` are in it. Measured both ways at `98eb281`: `include: ['src/core/**']` gives 96.81/92.13;
`src/**` minus `adapters` and `cli` gives 96.42/91.08. Neither is below 90, so this is not the
reading that passes; `core/**` is chosen because AD-30's sentence names `core/` as the subject twice
and because the wider set halves the branch headroom, from 2.13 points to 1.08, roughly twenty
uncovered branches from red rather than thirty-seven. The rejected number is recorded so a later
story widening the set knows what it costs. (`all: true` is not a `CoverageOptions` key in vitest 4
and is silently ignored; `include` already counts files no test imports, which is why
`probe-policy.ts` shows as 0%.)

**Eleven `core/` files sit below 90 on an axis and are recorded rather than fixed:**
`probe-policy.ts` (0% statements, a module the runtime never enters), `projection.ts` (76.92/71.79),
`canonicalize.ts` (81.66/72.09), `scan-json.ts`, `derived-reference.ts`, `plan-index.ts`,
`reduce.ts`, `target-policy.ts`, `seal.ts`, `plan.ts`, `publish.ts`. AD-30 states one aggregate floor
over `core/` and no per-file floor, so adding one would be this story minting a constraint the
architecture does not have, and it would fail the build on a types-only module. Decision 10.

**CI.** A named step in `validate-and-build`, after "Port conformance suite" and before "Validate":

```yaml
      - name: Coverage floor (NFR7)
        run: npm run test:coverage
```

and in the `floor` job the same command **replaces** its existing `- name: Test` / `npm run test`
step at `pr-checks.yml:111-112`. The floor job never runs `npm run validate`, so adding the step only
to `validate-and-build` would run coverage twice on Node 24 and zero times on the declared engine
floor, which is the opposite of what AD-30's last sentence asks for; adding it *beside* the existing
Test step would run the suite twice in one job for nothing. Measured: `npm run test` 42 s,
`vitest run --coverage` 63 s, so replacing costs the floor job about 20 s and adding would cost 63.

A canary proves the threshold blocks, modelled on `canary-ad31-table`: raise
`thresholds.statements` to 100, assert `npm run test:coverage` fails **and** that the output contains
`does not meet global threshold`, restore, re-run clean. Two details the first draft got wrong:
`vitest.config.ts` is TypeScript, so the edit uses `sed -i` the way `canary-ad31-table` does at
`pr-checks.yml:545` rather than `node -e`; and the job runs the full suite twice at roughly sixty
seconds each plus `npm ci`, which is tight against `timeout-minutes: 10`, so it gets fifteen.
Grepping the message is the load-bearing part, because a syntax error in the config also exits
non-zero. The exact line is
`ERROR: Coverage for statements (96.81%) does not meet global threshold (100%)`, emitted while the
suite still reports 2625 passed, so it discriminates as intended.

**Why `reportsDirectory` is in the block rather than in a note.** Running `vitest --coverage` into the
in-repository `./coverage` intermittently fails with
`Error: Something removed the coverage directory ".../coverage/.tmp"`. A reviewer ran the config
seven times without reproducing it, and another hit it twice in three runs — which is what a flake
looks like. The first draft named the flake and then shipped the default anyway; the remedy the
paragraph itself names belongs in the config. The canary uses the same config.

### AC 14: `npm run check:boundary` — AD-15, mechanically

AD-15 has never been enforced. The only occurrence of the string `AD-15` under `src/`, `scripts/`,
`tests/`, or `.github/` is a comment in `scripts/check-ad5-registry.ts:4-8` arguing that a *script*
reading a planning artifact is fine because `files` is `dist`, `README.md`, `LICENSE`. That argument
is sound and it is also what makes this check necessary: by its own reasoning, whatever lands in the
tarball is inside the boundary. AC 8 changes `files`, so that comment is updated in the same pass.

**`scripts/package-boundary.ts` (SKETCH).** Pure and synchronous over a file map, the shape
`scripts/dependency-direction.ts` and `scripts/lineage-ownership.ts` already use, so one function
backs both the real scan and the synthetic test maps.

```ts
export type BoundaryViolation = {
	readonly file: string
	readonly line: number
	readonly pattern: string
	readonly text: string
}

export function scanPackageBoundary(
	files: ReadonlyMap<string, string>,
): BoundaryViolation[]
```

**The eleven forbidden patterns, closed and named.** The first draft used `\bStory \d` and `\bEpic \d`
and a reviewer proved by execution that they miss nine real violations, because JSDoc in this
repository wraps at about eighty columns and `Story` followed by a newline and ` * 1.5` is the normal
shape, and because numberless forms are common ("a later story", "the epic's acceptance criteria",
"epic-mandated", "the corpus epic"). Widening to the bare words roughly triples the census. `src/` has no legitimate use of either word.

**Patterns 9, 10, and 11 rest on an inference, and it is stated rather than glossed.** AD-15 forbids
"an epic or story format". An acceptance-criterion number, a task number, and a story-local decision
number are that format's vocabulary as much as `Story 6.3` is: none has a stable identity a reader
outside this repository can resolve, which is the property AD numbers have and these do not. Pattern
11 exempts `ADR-nnn Decision N`, because an ADR is a published decision record with an identifier.
Three reviewers independently proposed patterns 9 through 11 and none disputed the inference; it is
written down here so a later reader can dispute it.

**Precedence is declared and one violation is reported per logical line.** The patterns are ordered
as numbered and the first match wins, because `bmad` otherwise shadows `_bmad-output` and every
`_bmad-output` hit would be reported under the wrong pattern name. `BoundaryViolation.text` carries
the **joined** run, not the physical line, so a dev working the reported list sees the whole comment
rather than a fragment.

**The count is recorded from the scanner's own first run.** Three reviewers implemented these rules
independently and converged: roughly **100 logical lines across 38 files** under `src/`, from about
109 physical lines, plus one in `package.json`'s `lint:spine` value, before pattern 11 is added.
Pattern 11 adds 45 more logical lines across 12 files, and the eleven together give **136 logical
lines across 40 files, which the script prints as 154 file-line-pattern records** because a joined run
can carry more than one pattern. Per pattern: 6 fires 60 times, 11 fires 45, 9 fires 27, 10 fires
once, and 1 through 5 and 8 fire zero times. Patterns 1 through 5 and 8 fire zero times
under `src/` today and are preventive. The first draft's two narrow patterns found 53 to 56 lines
across 27 files, so the widening roughly triples the work. AC 19 records what `check:boundary`
actually prints and Task 10 works that list; budget Task 10 for around 150 edits.

| # | Pattern | Why AD-15 forbids it |
| --- | --- | --- |
| 1 | `bmad`, case-insensitive | "no module references BMad" |
| 2 | `\bTEA\b` | "no module references ... TEA" |
| 3 | `_bmad-output` | a planning-artifact path |
| 4 | `planning-artifact` | a planning-artifact path |
| 5 | `implementation-artifact` | a planning-artifact path |
| 6 | `\bstor(y\|ies)\b`, case-insensitive | "an epic or story format" |
| 7 | `\bepics?\b`, case-insensitive | "an epic or story format" |
| 8 | `sprint-status` | the same format's tracking file |
| 9 | `\bAC \d` | an acceptance-criterion reference |
| 10 | `\bTask \d` | the same format's task numbering |
| 11 | `\bDecision \d` not preceded by `ADR-nnn ` | a story-local decision number with no stable identity |

**Wrapped comments are joined before matching.** For each file the scanner builds logical lines: a
run of consecutive lines whose trimmed form starts with `//`, `*`, or `/*` is joined with single
spaces and matched once, attributed to the first line of the run. Every other line is matched on its
own. Case 143 is a synthetic map with `Story` on one line and `1.5` on the next and asserts the
violation is reported at the first line.

**What it scans, and how the map carries three different things.** `scanPackageBoundary` takes one
path-to-text map, so `scripts/check-package-boundary.ts` assembles it from three sources and the
pure function stays a pure function:

- Every file under `src/`, via the existing `discoverSourceFiles(repoRoot)` walk, so the gate and the
  test read the same set by construction. Real paths.
- Every `.ts` file under `src/` is what the first bullet reaches, because
  `scripts/discover-source-files.ts:35` filters to `.ts` and `:41` hardcodes the `src/` walk, and it
  throws on an empty result.
- Every file under `corpus/` when the directory exists, via the wrapper's own recursive,
  extension-unfiltered walk, because `discoverSourceFiles` can reach neither `corpus/dev/*.json` nor
  `corpus/dev/README.md`. AC 16 promotes test fixtures to published data and those fixtures were
  never written under an AD-15 gate. **`check:boundary` therefore reports zero for `corpus/` until
  Task 11 creates it, and Task 11's exit condition includes re-running it.**
- `package.json`'s `scripts`, `description`, and `keywords` values, as **synthetic entries** keyed
  `package.json#scripts.<name>`, `package.json#description`, `package.json#keywords`, each holding
  that value's text. `BoundaryViolation.file` admits those keys and `line` is 1 for all of them,
  because a JSON value has no line of its own. The synthetic form is what lets the scanner read a
  field subset without teaching the pure function about JSON.

**The package's own coordinates are exempt, and this is the finding that would otherwise have made
`npm run validate` unreachable.** `package.json` carries `bmad-code-org` in `homepage`,
`repository.url`, and `bugs.url`. Those cannot be changed: `scripts/build-shareable.mjs:28` hardcodes
the canonical URL and `scripts/check-shareable.mjs:36-48` derives it from `repository.url` and fails
on a mismatch. A package's own coordinates are its identity, not a reference across the boundary.
Decision 11. The canary therefore seeds `TEA` into `description`, never into a URL field.

**What it does not scan:** `scripts/`, `tests/`, `.github/`, `docs/`, `_bmad-output/`, and
`README.md`. The first five never enter the tarball. `README.md` does, and Decision 15 is why it is
exempt.

**`scripts/check-package-boundary.ts`** is `scripts/check-lineage-ownership.ts` with one function
swapped: same `repoRoot` resolution, same discovery-failure path, same sort by file then line, same
`process.exit(1)`, same success line naming the scanned count and `0 violations`. Wired as
`"check:boundary"` and appended to `validate` after `check:lineage`.

**A canary:** seed `// Story 9.9` into a `src/` file with `sed -i`, assert `check:boundary` fails and
that the output names that file and the pattern rather than failing for a missing-file reason,
restore, re-run clean; then seed `TEA` into `package.json`'s `description` and repeat.

**The `validate` step's `name:` string** at `pr-checks.yml:65` lists the checks and is already wrong:
it omits `check:lineage`. Four edits land there — `check:lineage`, `check:boundary`, `check:corpus`,
and `test` becoming `test:coverage`. That is a correction to a list that is already stale, and AC 19
carries it as a row.

### AC 15: the AD-15 prose pass

**The inventory is generated, not hand-listed.** The first draft enumerated twenty-seven line
numbers, called them twenty-eight, included one line with no violation on it, and mislabelled three
`disposition.reason` strings and one `const` as `.describe()` calls. The dev runs
`npm run check:boundary` against the unfixed tree and works the reported list, which is the same list
the gate will re-check. AC 19 records the starting count from that first run and the ending count
(0).

**The rewrite rule, and it is the same rule every time.** A story or epic reference stands in for
something the reader can check. Replace it with that thing; delete the clause when there is nothing
behind it but project bookkeeping.

| Reference | Replace with |
| --- | --- |
| "a Story 1.5 differential disagreement" | "a disagreement in the published-schema differential check" |
| "Epic 4 enforces the legality stated here" | "compilation enforces the legality stated here" |
| "Story 6.3 settled both halves" | the settled rule itself, which the sentence already states |
| "this story carries both" | "this schema carries both" |
| "so Epic 2 has one word to exclude from the sealed brief" | "so the sealed brief has one word to exclude" |
| "The Epic 6 ingest story either validates ..." | "An ingesting reader either validates ..." |
| "The AD-5 code that audit fires is Epic 2's to mint" | "The AD-5 code that audit fires is `brief-exceeds-scripting-bound`" |
| "so a later story can walk the list" | "so a later reader can walk the list" |
| "the two epic-mandated adversarial shapes" | "the two adversarial shapes AD-5 mandates" |
| "under AC 8's named exception that rule is unenforced in v0" | "under the named exception below, that rule is unenforced in v0" — and note this one is a `.describe()` in `eval-contract.ts:68` that already ships an `AC 8` string into two published documents |
| "Task 6 wires this" | the thing the task produced, named directly |
| a section divider such as `// ---- AC 2, point 3 ----` | the divider's subject, e.g. `// ---- the derived reference vocabulary ----`; there are four in `derived-reference.ts` |
| "Decision 5 records why" | the reason itself, or an `ADR-nnn` citation where one exists |
| `src/testing/index.ts:6-7`'s "6.5 decides whether the root barrel carries it too" | the answer, which AC 7 rule 5 gives: the root barrel does not carry the port vocabulary, because `./conformance` is where AD-37 puts it |

AD numbers stay. They are the architecture's stable identifiers, they already appear throughout the
published schemas, and AD-15 forbids "an epic or story format", not a decision record. So do file
paths under `src/`, fault codes, and failure codes.

**Four existing tests constrain the rewrites, and the grep the first draft prescribed finds none of
them.** `grep -rn "Story \|Epic " tests/` returns eighty-five lines of comments and fixture prose.
The ones that matter are:

- `tests/schemas/artifact-registry.test.ts:78-88` asserts every root description exceeds 120
  characters and `toContain(entry.priorArt ?? 'no prior art')`, so `probe.ts:99` must keep
  `h0-ground-truth` and `sealed-evaluator-brief.ts:80` must keep the literal `no prior art`.
- `tests/schemas/publish.test.ts:199-203` needs an em dash to survive somewhere in `eval-contract`.
- `tests/schemas/constraint-ledger.test.ts:325-345` and `tests/schemas/artifacts.test.ts:504` assert
  description substrings the pass does not touch; check them anyway.

No test compares `schemas/*.json` bytes. `scripts/check-schemas.ts` alone does that.

**Regenerate and prove (Decision 13).** `npm run generate:schemas`, then `npm run check:schemas` must pass and
`git diff --stat schemas/` must show changes only where a published description moved. AC 19 carries
the file list and the byte delta. Note that three of the strings the first draft listed live in
`constraint-ledger.ts`'s `disposition.reason` values, which do **not** reach the published documents,
so a smaller schema diff than the source diff is expected rather than a defect.

**`package.json` and the spine linter.** `lint:spine` carries
`--workspace _bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29`, and
npm never strips `scripts`, so that path rides into every consumer's `node_modules`. The path becomes
the `--workspace` default in `scripts/spine-lint/lint_spine.py` and `required=True` comes off that
argument at `:517`; the two changes go together and neither works alone. `npm run lint:spine` and
`npm run test:spine-lint` must both still pass. **`prepare` is renamed, not deleted, and this is not the same defect class as `lint:spine`.** npm
publishes the whole `scripts` map, and a consumer install prints an allow-scripts warning whenever a
lifecycle key is present at all — verified across six variants, including `"prepare": "exit 0"`.
Only a non-lifecycle name avoids it, so `prepare` becomes `"hooks:install": "husky"`. That silently
disables pre-commit for a fresh clone, because `git config core.hooksPath` is `.husky/_`, so
`CONTRIBUTING.md:18` gains the command beside `npm install` and AC 1 lists that file. `lint:spine`
carries a string the scanner reports; `prepare` carries none, and it is taken here because the pass
is already in the manifest.

### AC 16: `corpus/dev/` — the development corpus

AD-14 requires the tarball to export the development corpus. AD-38 says it ships "a visible
development corpus with at least one qualified probe per class, per `expectedClean` state, and per
AD-20 discipline rule", and separately "one worked end-to-end example — a sealed brief, a conforming
sealed run record, an isolation manifest, and an evaluator configuration".

**What ships, and what does not (Decision 12).** The discipline-rule dimension ships: AD-38 glosses
it as "a contract exercising each discipline rule as satisfied or gapped", and Story 5.3's nineteen
contracts are exactly that. The qualified-probe dimensions do not: probe qualification needs a trial
reducer, which **Owed item 1** says does not exist, and a defect signature for a probe, which
**Owed item 7** says is missing for the only probe the repository names. Those are the two items to
cite; the first draft cited "1 through 5" and Decision 12 cited "1 through 5" while the load-bearing
one is 7.

**The example directory is named `compile-seal-example/`, not `worked-example/`.** AD-38's "worked
end-to-end example" is four artifacts and stage one can honestly produce one of them. The other three
are ingest-side, and Owed item 7 is explicit that the chain "must be regenerated from the reference
reducer once it exists, with hand-filled downstream values forbidden" — so hand-authoring a run
record and calling it the worked example is the specific thing that AD is forbidding. Taking the AD's
term for one quarter of the thing would be worse than not taking it.

**`scripts/generate-dev-corpus.ts` cannot run under bare `node`, and fixing that is part of this
story.** `src/core/canonical/scan-json.ts:49-52` declares `Scanner`'s fields as constructor parameter
properties, which Node's type stripping refuses, so any script importing `core/canonical/digest.ts`
dies at load with `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` — verified, and
`src/core/coverage/table.ts:1-11` already documents the trap and routes around it. The generator
needs digests (rule 2) and the shipped `compile` and `seal` (rule 3), so it cannot route around it.
**The fix is at the source: rewrite `Scanner`'s two parameter properties as explicit
`private readonly` fields assigned in the constructor body.** That is mechanical, changes no
behaviour, keeps `check:schemas` byte-identical, and removes the trap for every future script rather
than teaching one more script to avoid `core/canonical/`. It is the third and last `core/` edit in
this story and AC 1 lists it. `table.ts`'s header comment loses the paragraph that went with it.

Otherwise the generator follows `scripts/generate-ad31-table.ts`: its fixture **data** comes from
`tests/` and never from `src/`, so no authoring code enters `dist`, while it imports the shipped
`compile` and `seal` from `src/application/`, which is what rule 3 requires. It writes,
deterministically and sorted, with canonical bytes and one trailing newline per JSON file:

```
corpus/dev/README.md                         what this is, what is absent, and why
corpus/dev/index.json                        the manifest: every file, its kind, its digest
corpus/dev/contracts/<contractId>.json       the nineteen AD-31 contracts
corpus/dev/compile-seal-example/contract.json   the input
corpus/dev/compile-seal-example/brief.json      the same contract compiled and sealed
```

Rules, each with a case:

1. Every JSON file is `serializeArtifact(...)` output, so the corpus is byte-reproducible and its
   digests are AD-27 digests of exactly the bytes on disk. Cases 159 and 161.
   **Each of the nineteen contracts goes through the shipped `compile` before it is serialized**, for
   the same reason rule 3 routes the example that way and for one more: `tests/coverage/fixtures/
   satisfaction-contracts.ts:27-30` declares `schemaVersion`, `parentDigest`, and `revisionCount` as
   literals and `corpus.ts:23` spreads all nineteen from it, and AD-29 says "no other stage may set
   them". `check:lineage` walks `src/` only so it never saw those literals; publishing them as
   package data would ship the thing Story 6.4 built a gate against. Routing through `compile` also
   makes the corpus prove the compiler. Three of the nineteen (`no-operation-inventory`,
   `empty-request-shapes`, `no-state-change-marker`) throw `StructuralFailure` by design; those three
   ship as authored input with their expected failure code recorded in `index.json`, which is what
   makes them useful as a corpus rather than a defect in the generator.
2. `index.json` carries `{ entries: [{ path, kind, digest }] }` sorted by `path`. **No
   `schemaVersion` and no timestamp.** A timestamp makes the generator non-idempotent. A
   `schemaVersion` would make the manifest an artifact under AD-11 and then AD-13 would require a Zod
   schema and a published JSON Schema for it — which is the same objection AC 1 raises against
   emitting `PreflightPlan`. The manifest is corpus packaging, and `kind` is a closed vocabulary in
   `scripts/dev-corpus-target.ts`. Case 160.
3. The example is produced by calling the shipped `compile` and `seal`, so it cannot drift from the
   code. Its seed is the corpus's `fully-satisfied` contract, named here because three of the
   nineteen do not compile and picking one at generation time would be a silent choice. Case 162.
4. `corpus/dev/README.md` states that AD-38's qualified-probe dimensions are absent, names Owed items
   1 and 7 as the reason, states that the three other artifacts of AD-38's end-to-end example are
   absent and that Owed item 7 forbids hand-filling them, and labels the contracts visible and
   diagnostic rather than a holdout, in AD-38's own words. Case 163 asserts the README names all
   four absences.

**`scripts/dev-corpus-target.ts` (SKETCH).** The paths and the vocabulary both the generator and the
check import, so neither can name a file the other does not.

```ts
/** One entry's kind. Closed, because `index.json` is packaging and has no schema. */
export type DevCorpusKind = 'contract' | 'sealed-evaluator-brief' | 'readme' | 'index'

export type DevCorpusEntry = {
	readonly path: string
	readonly kind: DevCorpusKind
	readonly digest: string
}

export const CORPUS_ROOT: string          // <repoRoot>/corpus/dev
export const CORPUS_CONTRACTS_DIR: string // <CORPUS_ROOT>/contracts
export const CORPUS_EXAMPLE_DIR: string   // <CORPUS_ROOT>/compile-seal-example
export const CORPUS_INDEX: string         // <CORPUS_ROOT>/index.json
export const CORPUS_README: string        // <CORPUS_ROOT>/README.md
/** Repository-relative, for `index.json` entries and violation messages. */
export const CORPUS_LABEL = 'corpus/dev'
```

This mirrors `scripts/ad31-table-target.ts`, which holds the same three things for the AD-31
document: an absolute path to write, a directory to create, and a repository-relative label the
messages print.

**`scripts/check-dev-corpus.ts`** is the byte-exact drift check, modelled on `scripts/check-schemas.ts`
and `check-ad31-table.ts`: regenerate in memory, compare against the committed bytes, report the first
differing byte offset with context, report an orphan file separately from a stale one, exit 1 on
either. Wired as `"check:corpus"` and appended to `validate`. `"generate:dev-corpus"` is its pair, the
same way `generate:ad31-table` pairs with `check:ad31-table`.

**A canary**, the three-step shape: mutate a byte in a committed corpus file and assert the check
names the offset; change a field in the seed contract the corpus is generated *from* and assert the
check fails, which is what proves the corpus is emitted rather than kept beside the code; then assert
generate-then-check is a fixed point with `git status --porcelain -- corpus/`.

**`biome.json`** gains `"!corpus"` beside `"!schemas"`, per AD-13's "`schemas/` and `corpus/` are
excluded from the formatter so lint and drift cannot fight". Verified: without it a top-level
`corpus/` is formatted and the drift check fails on the next run.

**AD-18 screens the promotion.** AC 16 turns test fixtures into published data, and AD-18 says it
"binds published examples and test fixtures as strictly as real runs". AC 19 carries a row: a grep of
`corpus/dev/**` for address-shaped and credential-shaped strings, plus the statement that the
nineteen contracts are synthetic and were authored under AD-18 in Story 5.3.

### AC 17: tests

**One hundred and sixty-six cases across twelve files: eleven new and one edited**
(`tests/application/preflight.test.ts`, which gains cases 105 through 112). The suite therefore goes
from 73 files and 2625 tests to 84 files and 2791 tests. Ranges are contiguous, non-overlapping, and
each group below states its own count so the arithmetic is checkable rather than asserted.

**`tests/cli/arguments.test.ts`, cases 1 through 30.** Three accepts, one per command with every flag
it takes (1-3). Four defaults: stdin with no input key, stdout with no `--out`, `--strict-inputs` on,
`--strict` off (4-7). `--strict` accepted on each of the three commands (8-10).
`--strict-inputs`/`--no-strict-inputs`, and last-flag-wins (11-12). Three stdin cases: `--in -`, the
one-`-`-only rule, the two-`-` collision (13-15). The `--in=-name.json` equals form, and a positional
after `--` (16-17). The six usage-error shapes, each asserting the `message` names the offending
token (18-23). Two source scans: no `isTTY`, no `node:fs` or `node:path` (24-25). Help with no
command, help with a command, `--version` (26-28). `--out` and `--run-id` carried through as given,
unresolved (29-30). Count: 3+4+3+2+3+2+6+2+3+2 = 30.

**`tests/cli/exit-codes.test.ts`, cases 31 through 48.** The six `CommandOutcome` kinds, one case each,
and the five that are not `verdict` each additionally assert their code is outside {1, 2} (31-36). Four verdicts crossed with `strict` on and off (37-44). The evidence-conditions-only
carve-out in both directions (45-46). The exhaustiveness case, feeding a value cast outside the union
and asserting `undefined` rather than a wrong number (47). A sweep asserting no outcome kind other
than `verdict` returns 1 or 2 (48). Count: 6+8+2+1+1 = 18.

**`tests/cli/render.test.ts`, cases 49 through 56.** `renderArtifact` byte-equal to
`serializeArtifact` over a fixture, which is what pins the delegation (49). Its trailing newline
(50). `renderDiagnostic`'s format (51). `renderError` over `StructuralFailure`, `RuntimeFault`, and a
plain `Error` (52-54). `renderUsage`'s format (55). The digest agreement of AC 3, stated as
`digestArtifact` equalling `digestBytes` of the encoded string minus its trailing newline (56).

**`tests/cli/run.test.ts`, cases 57 through 88.** Three happy paths asserting exact bytes, one per
command (57-59). Three exactly-one-orchestration-call cases, one per command, each **spying the
application facade** rather than the environment and asserting one invocation with the expected
arguments (60-62). The I/O counts as a separate pair, because an I/O count says nothing about how
many orchestration calls happened (63-64). Stdout by default; `--out` writing and stdout staying
silent (65-66). `--out` as a directory writing `<target>/<kind>.json`, and `--out` as a `.json` file
path writing that path exactly (67-68). Two stream-split cases: an artifact reaches `writeOut` and
never `writeDiagnostic`, and a diagnostic the reverse (69-70). Malformed JSON producing
a `RuntimeFault('schema-parse-failure', ...)` and exit 5 (71). `StructuralFailure` mapped,
`RuntimeFault` mapped, a seeded `TypeError` rethrown (72-74). The input-output collision (75). The
pre-flight run-id passthrough and its diagnostics (76-77). The three observation shapes: a partial
array giving a failed verdict, an empty array giving `port-contract-violation`, an array whose
`probeId`s answer no leg giving the same fault (78-80). **NFR9's two families at the boundary: the same input
twice giving byte-identical serialized output, and a permuted observation array giving an identical
verdict** (81-82). `--strict-inputs` reaching the application call's
`options.strict`, both ways (83-84). `--strict` reaching `exitCodeFor` and never the application call
(85). `compile` and `seal` writing nothing to the
diagnostic stream on success (86). Help and version rendering through the environment's writers, help carrying AC 10's seven exit codes
(87-88). Count: 3+3+2+2+2+2+1+3+1+2+3+2+2+1+1+2 = 32, sixteen groups.

NFR9 binds because `epics.md:50` says the permutation family "runs against every stage that consumes
an observation array". Story 6.2 discharged it at the projection level (fixture 76,
`tests/preflight/projection.test.ts:116`); cases 81 and 82 do it end to end at the boundary.

**And running it surfaced a real defect this story fixes rather than tests around.**
`reducePreflight` builds `byProbeId` with `for (const observation of observations)
byProbeId.set(observation.probeId, observation)` (`src/core/preflight/reduce.ts:109-111`), so two
observations sharing a `probeId` collapse to whichever arrived last, and a permutation over such an
array changes the verdict. Over a unique-`probeId` fixture case 82 passes trivially; over a
duplicate-`probeId` fixture it goes red. AD-30:445 names exactly this class — "an arbitrary tie-break
is stable within a process. The permutation family is the one that catches it." A `probeId` echoed
twice is not an echo, so the fix belongs beside the empty-plan guard: `reducePreflight` throws
`RuntimeFault('port-contract-violation', ...)` naming the repeated `probeId`. That is the fourth
`core/` edit in this story, AC 1 lists it, and case 82 uses the duplicate fixture so the case that
found the defect is the case that pins the fix.

**`tests/cli/main.test.ts`, cases 89 through 94.** A stdout write larger than a pipe buffer, read back
whole (89). A source scan asserting `process.exitCode` is set and `process.exit` is never called (90).
The shebang as the first line of the built file (91). **A packed and installed tarball, invoked as
`node_modules/.bin/eval-quality`** — the only case that exercises the `bin` mapping, the npm shim, and
the executable bit that `npm install` sets and `tsc` does not (92). It runs
`npm pack --ignore-scripts --pack-destination <tmpdir>` and `npm install --offline`, and **both flags
are load-bearing rather than tidiness**: `prepack` is `npm run clean && npm run build`, so a pack
without `--ignore-scripts` deletes `dist/` underneath the parallel test file that reads it (measured:
two files failing, fifteen sampled windows with no `dist/index.js`), and an install without
`--offline` reaches `registry.npmjs.org` for `zod`, which NFR7's "no network beyond AD-37's loopback
fixture server" forbids. Both CI jobs run `npm ci` first, so the cache is warm and `--offline`
succeeds in under half a second; it is the flag that *proves* compliance rather than one that hides a
violation. `--pack-destination` matters because `*.tgz` is not in `.gitignore`. The installed binary's exit code
on a structural failure (93). Stdin end to end (94).

**`tests/application/seal.test.ts`, cases 95 through 104.** The brief equalling
`seal(compile(contract))` called directly (95). The frozen return (96). The parse fault on a
non-contract input (97). Then AC 4's five-row precondition table, one real contract
each. The two rows compilation pre-empts assert a `StructuralFailure` reaching the caller
**unconverted**: a null oracle direction giving `oracle-missing-channel` (98), and a scoped resource
giving `scoped-reference-resolves-forbidden` (99). The three live rows assert a `RuntimeFault` with
`code === 'schema-parse-failure'`: a duplicate `oracleId` (100), a duplicate
`permittedInterfaces.logicalId` (101), and a zero-oracle contract reaching `validateAssembledBrief`
(102). The brief as a lineage root (103). Strict passthrough both ways in one case (104).
Count: 1+1+1+2+3+1+1 = 10. The `buildPlanIndex` row gets no case of its own; AC 4 says why.

**`tests/application/preflight.test.ts`, cases 105 through 112.** The four boundary parses (105-108).
The frozen return (109). The plan-then-reduce call order (110). The diagnostic-stream equality
between `runPreflight` and `preflightFromObservations` over a fully-observed fixture (111). A partial
observation array giving a failed verdict at the library level (112).

**`tests/application/diagnostics.test.ts`, cases 113 through 116.** `emit` with a sink, `emit` without
one, a throwing sink propagating, and a `Diagnostic` carrying both `runId` and `stage`.

**`tests/application/serialize.test.ts`, cases 117 through 120.** Canonical bytes plus one trailing
newline, the digest agreement, canonical key ordering, and a throw on a non-canonicalizable value.

**`tests/architecture/package-boundary.test.ts`, cases 121 through 144.** Eleven synthetic maps, one
per pattern, each proving the pattern fires (121-131). Eleven near-misses, one per pattern, each
proving it does not over-fire — `"teardown"` for the `TEA` word boundary, `"epicenter"`, `"history"`
for `stories`, `ADR-004 Decision 2` for pattern 11's exemption, and so on (132-142). The
wrapped-comment join, with `Story` on one line and `1.5` on the next, asserted at the first line of
the run (143). The real-tree scan asserting zero violations (144), which is red until AC 15 lands.

**This range is `2 x patterns + 2`.** It moved twice already, once per pattern-table growth. A twelfth
pattern makes it twenty-six and shifts every range after it, so add the pattern and the arithmetic in
one edit.

Note that `"Story"` with no digit is now a **positive** case rather than a near-miss, because pattern
6 is the bare word. That inversion is the whole point of the widening.

**`tests/architecture/package-exports.test.ts`, cases 145 through 158.** Six subpath resolutions, one
per `exports` entry (145-150), through
`createRequire(import.meta.url).resolve(...)` against the repository's own package by self-reference —
which Node grants because `exports` exists, so these need no pack and no install.
**`import.meta.resolve` must not be used**: it never stats, so
`eval-quality/schemas/THIS-DOES-NOT-EXIST.json` resolves happily and the case proves nothing, not even
that `corpus/` shipped. `createRequire(...).resolve` honours the same `exports` map and fails with
`MODULE_NOT_FOUND`. The barrel's type completeness derived from
`INTERCHANGE_ARTIFACT_KEYS` rather than restated (151). No live Zod schema reachable from the barrel,
walking one level into every exported object so a registry of schemas cannot hide behind a plain
wrapper (152). **Every export present before this story is still exported** (153),
which is the case that catches Story 6.2's six sensitivity-witness types going missing. It reads a
**committed snapshot** of the export set rather than a git merge-base: no job in `pr-checks.yml` sets
`fetch-depth`, so every checkout is depth 1 and on a `pull_request` event there is no `origin/main`
to diff against, and a case that silently cannot run is worse than no case. The snapshot is a plain
list in the test file, and adding to it is how a future story records a deliberate removal. `files` covering every path
`exports` names (154). The `bin` target existing after a build (155). `VERSION` equalling
`package.json`'s `version` (156). The packed tarball's top-level entries, `package.json` included, from
`npm pack --dry-run --ignore-scripts` so the pack does not delete `dist/` under the neighbouring
cases (157). The `./corpus/*` specifiers including `corpus/dev/README.md`, resolved the same way, plus a negative:
`eval-quality/schemas/NOPE.json` must fail (158).

**`tests/architecture/dev-corpus.test.ts`, cases 159 through 166.** Every file being
`serializeArtifact` output (159). `index.json` sorted with no timestamp and no `schemaVersion` (160).
Each manifest digest matching the bytes on disk (161). The example brief equalling
`seal(compile(contract))` (162). The README naming all four absences (163). Generator idempotence over
a synthetic target (164). Every contract parsing against `EvalContract` (165). The corpus carrying no AD-15 pattern **and** none of AD-18's six
named categories — credentials, tokens, real names, email addresses, account identifiers, transaction
content (166). AD-18 says it "binds published examples and test fixtures as strictly as real runs",
and a one-shot grep in a gate table is screened once by hand and never again; a case runs every time.
The fixtures are clean today: the only near-hits across every fixture module are `inputTokens` and
`outputTokens`, which are budget integers.

**Reject cases are verified by reverting their rule**; near-misses are verified the other way, by
widening the pattern and watching the near-miss go red.

**On AD-30's filesystem sentence.** AD-30 says no test performs filesystem I/O outside a temporary
directory, "that carve-out exists solely for AD-37's suite". Eighteen of these cases read the real tree,
built output, or the committed corpus (24, 25, 90, 91, 92, 93, 144, 145 through 150, 154 through
158), the eight corpus cases compare committed bytes, and case 92 spawns a process. The reading this story takes, and records rather
than assumes: AD-30's sentence binds `core/` tests, which is the subject of its own paragraph, and
`tests/architecture/` already reads the real `src/` tree from disk under that reading
(`lineage-ownership.test.ts:270`, `dependency-direction.test.ts:805`). Case 92's subprocess is new and
is the second architecture-visible exception; it uses a temporary directory and is skipped with a
clear message when `dist/` is absent, so `npm run test` before a build stays green.

### AC 18: docs

**`README.md`.** `## Using it` currently shows three aspirational commands, one of which (`score`)
does not exist. It is rewritten to the four that ship, with a real `npx eval-quality` invocation, the
input and output rules, the exit-code table, and a JSON-subpath example in the working form
(`import spec from 'eval-quality/schemas/eval-contract.schema.json' with { type: 'json' }`, because
ESM on Node 22 and 24 both throw `ERR_IMPORT_ATTRIBUTE_MISSING` without the attribute, and AD-14
sells the JSON Schema as the supported non-TypeScript route). `## Development` gains `test:coverage`,
`check:boundary`, `generate:dev-corpus`, and `check:corpus`. Then `npm run build:shareable`, because
editing `README.md` makes `_bmad-output/shareable/` stale and `check:shareable` fails the build;
stories 6.2, 6.3, and 6.4 each hit this.

**The README's relative links stay relative.** They are broken for an npm consumer, sixteen
`_bmad-output` targets across six lines plus four `experiments/` targets and three repository policy
files. Absolutising them regresses a working feature: `scripts/build-shareable.mjs:274-282` rewrites a
relative in-repository link to a sibling `.html` page precisely so "a recipient without repository
access can still follow the evidence", and `rewriteLink` passes an `https?:` URL through unchanged.
The README's article body carries twenty-three such sibling links; absolutising would turn about
fifteen of them into external GitHub links, and `check:shareable` would stay green because its
canonical-URL regex matches only the repository prefix. Two readers want opposite things and the
shareable reader is the one the repository already built machinery for. Decision 15.

**`_bmad-output/project-knowledge/learning-path-step-by-step.md`.** Row 23 and Step 23, following
`learning-path-template.md`: the plain-terms paragraph with no repository vocabulary, then `What`,
`Why`, `The shape` (a mermaid flow from argv through the parser, the one application call, the
serializer, and the exit code), `Read in this order` with its file-graph diagram, `Story`, then
`### Reference` holding `Rules` and `Watch out`. Written after the peer review's findings are
addressed and before the human review, per the template's own timing rule.

### AC 19: the gate

Every row is filled from actual command output, never from arithmetic.

| Check | Command | Expected |
| --- | --- | --- |
| Full gate | `npm run validate` | passes, including the three new checks |
| Build | `npm run build` | passes; `dist/cli/main.js` exists with its shebang at byte 0 |
| Coverage | `npm run test:coverage` | statements and branches both at or above 90; record both |
| Test census | `npm run test` | 84 files / 2791 tests: the 73-file, 2625-test baseline plus eleven new files and 166 cases |
| Layers | `npm run check:layers` | 0 violations, with `src/cli/` and the two new barrels present |
| Lineage | `npm run check:lineage` | 0 violations |
| Boundary | `npm run check:boundary` | record the first-run count and file count, 0 after Task 10, re-run after Task 11 with `corpus/` in scope and still 0 |
| Corpus | `npm run check:corpus` | no drift, no orphan |
| Corpus AD-18 | case 166, not a one-shot grep | none of AD-18's six categories |
| Schemas | `npm run check:schemas` | 12 documents match after `generate:schemas` |
| Schema delta | `git diff --stat schemas/` | changes only where a published description moved |
| Licences | `node scripts/check-licenses.mjs` | passes with the provider and its eighteen transitives |
| Lockfile age | the `audit-lockfile-age` action | passes on the grown lockfile |
| Spine lint | `npm run lint:spine` and `npm run test:spine-lint` | both pass after the default moves |
| Shareable | `npm run check:shareable` | passes after `build:shareable` |
| Conformance | `npm run test:conformance` | passes |
| Pack contents | `npm pack --dry-run --ignore-scripts` | `dist`, `schemas`, `corpus`, `README.md`, `LICENSE`, `package.json`, nothing else |
| Installed bin | `npm pack --ignore-scripts --pack-destination <tmp>`, `npm install --offline`, run `node_modules/.bin/eval-quality --version` | prints the version, exit 0, no `.tgz` left in the repository |
| CI name string | `pr-checks.yml:65` | lists every check `validate` runs |
| AD-31 table | `git diff --exit-code -- docs/` | clean; this story does not touch the table |
| Compile census | `tests/compile/compile.test.ts:46` | unchanged at 26 |

## Decisions taken during story creation

Decisions 2, 3, 6, 7, 11, 12, and 15 were rewritten after a review round in which three independent
reviewers, two of them executing against the tree, found the first draft's version wrong. Each says
what the first version claimed so the argument is not silently re-run.

1. **The four deliverables stay in one story.** The epic's acceptance criterion names all four and
   NFR7 is the epic's done-when. Splitting would leave epic 6 open on a technicality.

2. **`application/seal.ts` compiles first, and converts the `TypeError` that compiling does not
   pre-empt.** The first version claimed compiling makes all four of `core/seal`'s `TypeError`
   preconditions unreachable. Execution showed only one of four is pre-empted, and that a contract
   with two `permittedInterfaces` sharing a `logicalId` compiles clean and throws a raw `TypeError`
   out of the published boundary. AC 4's table is the corrected finding and the `catch` is the fix:
   the boundary promises typed faults, so it converts to `RuntimeFault('schema-parse-failure', ...)`,
   an existing AD-28 code, rather than minting one AC 1 forbids.

3. **The CLI's `preflight` takes observations, and the plan never becomes an artifact.** AD-2 ships no
   network adapter, so a CLI cannot hold a probe port; a command line cannot carry a closure. The
   plan is a TypeScript type with no Zod schema and no place in the twelve-artifact inventory, so
   emitting it would mint a thirteenth interchange artifact and a published schema for it.
   **AD-34's Prevents clause is the objection to answer** and the first draft never named it: it
   forbids "two incompatible published library surfaces ... one where a stage is async and takes
   ports, one where it is sync over resolved artifacts", and it enumerates the differences that make
   two surfaces incompatible: "signature, imports, error paths, and test boundaries".

   **All four hold here, so this is recorded as a deviation rather than argued into conformance.** The
   signatures differ (async against sync, two disjoint option types); the imports differ
   (`runPreflight` pulls `ports/environment-probe-port.ts` and `invoke-port.ts`, the new entry pulls
   neither); the error paths differ (`runPreflight` can never produce the `no observation` line, and
   the sync entry has three observation-array outcomes the async one cannot reach); and the test
   boundaries differ, which case 111 admits by needing a specially fully-observed fixture to make the
   two comparable at all. Claiming conformance here would be the form of the claim that cannot be
   reviewed later.

   The deviation is accepted because the alternative is worse in a way AD-34 does not price: one
   entry point with a discriminated observation source (`{kind:'port', port} | {kind:'observations',
   observations}`) would change `runPreflight`'s published signature, which AD-11 makes a
   caller-facing break, to buy a uniformity no caller asked for. Both entries land on one
   `reducePreflight` and return one `PreflightVerdict`, so there is one artifact and one stage even
   though there are two shapes. A later story that owns a `schemaVersion` bump should fold them.

   `preflightFromObservations` **types its three artifact fields the way `runPreflight` does** and
   parses them as well. An earlier draft typed them `unknown` on the grounds that they arrive from
   `JSON.parse`; that reasoning applies word for word to `runPreflight`, which types *and* parses
   (`src/application/preflight.ts:24-30`, `:50-59`, under the comment "Artifacts are validated in both
   directions (AD-28)"). A parameter typed `unknown` also carries nothing a consumer's typechecker
   can break against, so a later narrowing would be undisclosable under AD-11.

4. **A `validate-lineage` command was drafted and withdrawn; the criterion that settles it is
   AD-14's own sentence.** A reviewer's round-one finding was that `validateLineageChain` and
   `reviseArtifact` are pure synchronous functions over JSON that AC 6 publishes, that AD-12 states
   chain validation as a package capability, and that a capability on the library and not the CLI is
   the defect AD-14's Prevents clause names. The same reviewer withdrew it in round two after
   executing against the code, and it was right to. `validateLineageChain` returns a
   `LineageChainReport` with no Zod schema, no `schemaVersion`, and no entry in
   `INTERCHANGE_ARTIFACTS`, so `--out` would write the un-schema'd published document AC 1 forbids
   for `PreflightPlan` and AC 16 rule 2 forbids for `index.json`. `LineageChainOptions`
   (`src/core/lineage/chain.ts:51-59`) requires an `artifactPath`, an accepted schema version, a
   declared revision count, and a remediation cap, two of which come from the declared revision and
   the scoring policy; defaulting them inside the CLI is the policy logic AD-14 forbids.
   `chain.ts:16-18` requires each member to be "a whole artifact already parsed against one published
   schema", and picking which of twelve is the validation logic AD-14 forbids. And AD-12's Rule
   (`ARCHITECTURE-SPINE.md:295`) names the emission shape: it "emits evidence of compliance", which
   `src/core/schemas/evidence-artifact.ts:209-224` defines as the `LineageChain` object `emit`
   serializes, and AD-24 gives the Evidence Artifact to `emit`, a stage AC 1 says this story does not
   build.

   **So the command set is fixed by a criterion rather than by a list: a command exists where one
   orchestration call produces an interchange artifact to serialize.** That is AD-14's sentence read
   literally. `compile`, `seal`, and `preflight` pass it; `validateLineageChain`, `reviseArtifact`,
   `serializeArtifact`, and the three digest functions are library helpers and fail it. Without the
   criterion, Decision 4's first version proved too much: `reviseArtifact` and `digestArtifact` are
   equally pure, equally synchronous, equally over JSON, and equally published, and nothing in the
   argument stopped at one command. Lineage validation gets a command when `emit` owns the Evidence
   Artifact AD-12 names as its output.

5. **The diagnostic sink lands on the pre-flight entries only, and `compile` and `seal` are silent on
   success.** The Conventions Logging row requires every diagnostic to carry the run identifier and
   the stage. `compile` and `seal` take no run identifier, and minting one would make two identical
   invocations differ. The first version added "the CLI writes its own line instead", which is
   untypeable — `renderDiagnostic` needs a `runId` and a `stage` — and would have been a stream write
   carrying neither. Silence on success is also the machine-readable default AD-14 asks for. When
   `ingest`, `score`, and `emit` arrive they carry a run id by construction; `Diagnostic.stage` is a
   union so widening it is a compile error until someone does it deliberately.

6. **`--strict` is AD-21's gate-promotion flag; AD-4's compile mode is `--strict-inputs`.** The first
   version had these the other way round and minted `--gate-strict`. AD-21 spells the promotion flag
   `--strict` three times on `:368` and seven times across the spine; AD-4 and the Configuration
   convention name no flag for compile mode at
   all; a grep of every backticked flag in the spine finds exactly two, `--dry-run` and `--strict`.
   AD-11 puts "the CLI command, flag, and exit-code contract" inside the disclosed surface, so
   swapping them would have been a contract rename shipped as a naming preference. The
   `evidenceConditionsOnly` input is not computed by anything in this story: AD-21's two evidence
   conditions are a run completing fewer trials than the policy's declared minimum and any oracle
   resolving `unreached`, both score-side. The carve-out's shape is fixed here and its predicate is
   owed, which is written down so the later story does not rediscover it.

7. **Exit codes: the barred region is one and two, and zero is plain success.** AD-21 says "a command
   producing no verdict never exits inside the verdict range". The strict reading, that zero is in
   the range and therefore barred, is a reductio: 3, 4, and 5 are assigned to invalid, structural
   failure, and fault, AD-21 assigns nothing else, and a successful compile would have no expressible
   code. Zero carries no verdict information, because AD-21 gives it to PASS, WAIVED, and CONCERNS
   alike; 1 and 2 do carry it. So a structural failure takes 4 and a fault takes 5 and neither can be
   misread as FAIL, which is what the sentence is for. A usage error takes 64, `sysexits.h`'s
   `EX_USAGE`, outside every code AD-21 assigns.

8. **The root barrel is a two-layer re-export and no matrix edge is added.** The first version
   exported `StructuralFailure` and the lineage functions straight from `src/index.ts` and asserted
   the matrix allowed it. It does not: `src/core/failure-codes.ts` and `src/core/lineage/chain.ts`
   classify as `core`, and `root` is granted `application` and `core-schemas` only. Three reviewers
   found this, one of them by writing the barrel and running `check:layers`. `application/index.ts`
   holds the legal `application -> core` edge and both `src/index.ts` and `src/cli/*` read it.
   Story 6.1's open `root -> ports` question is answered the same way: no, because the port
   vocabulary is published at `./conformance` where AD-37 puts it.

9. **The reference adapters ship at `./adapters`, not in the root barrel.** AD-28 calls them
   conveniences and never a required path. A subpath keeps that structurally true and keeps the
   `root -> adapters` edge out of the checker.

10. **No per-file coverage threshold, and the measured set is `src/core/**`.** AD-30 states one
    aggregate floor over `core/`. Eleven files sit below 90 on an axis, `probe-policy.ts` at 0%
    statements because the runtime never enters it; a per-file floor would mint a constraint the
    architecture does not have and would fail the build on a types-only module. The wider set
    (`src/**` minus `adapters` and `cli`) was measured at 96.42/91.08 and rejected because it halves
    the branch headroom while AD-30 names `core/` as the subject twice.

11. **The package's own coordinates are exempt from the boundary scanner.** `homepage`,
    `repository.url`, and `bugs.url` carry `bmad-code-org`. They are identity coordinates, changeable
    only as a repository migration: `repository.url` is mechanically pinned, because
    `scripts/check-shareable.mjs:36-48` checks it against `scripts/build-shareable.mjs:28`'s
    hardcoded constant and `CONTRIBUTING.md:15` is a third coordinated edit, while `homepage` and
    `bugs.url` are read by nothing and are exempt on the identity argument alone rather than on a
    mechanical one. A package's own coordinates are not a reference across the boundary. The first version scanned `package.json` as
    plain text, which made `check:boundary` unable to reach zero and `npm run validate` unreachable;
    two reviewers found it independently by applying the story's own pattern table.

12. **`corpus/dev/` ships the discipline-rule dimension and names every absence.** AD-38 asks for
    qualified probes per class and per `expectedClean` state, a contract per discipline rule, and a
    four-artifact worked end-to-end example. Stage one can produce the contracts and a compiled-and-
    sealed pair. Probe qualification needs the trial reducer **Owed item 1** says does not exist and
    the defect signature **Owed item 7** says is missing; the first version cited items 1 through 5
    and missed 7, which is the load-bearing one. The example directory is `compile-seal-example/`
    rather than `worked-example/` because Owed item 7 forbids hand-filling downstream values, so
    hand-authoring a run record and calling it AD-38's example is the specific thing that item
    prohibits. Story 5.3 kept the nineteen contracts out of the tarball on a cost argument made
    before anyone noticed AD-14 requires a corpus export; 28 KB against a 1.1 MB `dist` does not
    survive the requirement.

13. **`.describe()` edits are prose-only and the schema drift check is the proof.** Every AC 15 edit
    changes a description string. `generate:schemas` then `git diff --stat schemas/` shows which
    documents moved, and `check:schemas` proves the generator and the committed bytes agree
    afterwards. A field name, an enum member, or a constraint in that diff is a finding. Expect a
    smaller schema diff than source diff: `constraint-ledger.ts`'s `disposition.reason` values do not
    reach the published documents.

14. **`INTERCHANGE_ARTIFACTS` is not published; `INTERCHANGE_ARTIFACT_KEYS` is.** Each of the
    registry's twelve entries carries `schema: z.ZodType` holding a live schema
    (`src/core/schemas/artifact.ts:23`, `:41`), so exporting it would hand every consumer our Zod
    instance and couple them to zod 4.4.3, which is the thing case 152 exists to prevent. The first
    version exported the registry and asserted the test that forbids it in the same AC. The published
    JSON Schema is the supported parsing route for a non-TypeScript consumer, and
    `INTERCHANGE_ARTIFACT_KEYS` (`artifact.ts:98`) is the plain string array case 151's derivation
    needs.

15. **The README's relative links stay relative and it stays out of the scanner.** Two separate
    conclusions with one cause. On the links: absolutising them regresses
    `scripts/build-shareable.mjs:274-282`, which rewrites a relative in-repository link to a sibling
    `.html` page so a recipient without repository access can follow the evidence, and which passes an
    `https?:` URL through untouched. Twenty-three such sibling links sit in the README's own article body, thirty-seven across the whole generated page, and
    `check:shareable` would not catch the regression. On the scanner: the README ships and names BMad
    and TEA in a section whose whole content is the one-way dependency AD-15 asserts, so scanning it
    would force deleting the plainest statement of the rule from the only document an adopter reads.
    The first version proposed absolutising seven links, undercounted them by more than half, and
    would have shipped the regression.

## Tasks / Subtasks

- [ ] **Task 1 — baseline and the dependency.** `npm run validate` and `npm run build`; confirm the
      recorded baseline rather than trusting it (73 test files / 2625 tests, `check:layers` and
      `check:lineage` 86 files / 0 violations, 12 schema documents). Then
      `npm i -D @vitest/coverage-v8@4.1.10` and **confirm `package-lock.json` grew by nineteen
      entries** — `node_modules/` already carries the package unlocked, so a bare install can report
      "up to date" and leave CI's `npm ci` with no provider. Then `node scripts/check-licenses.mjs`
      and AC 13's `vitest.config.ts`. Record the first measured coverage numbers with
      `npx vitest run --coverage` directly, because `test:coverage` is one of AC 8's scripts and
      Task 8 adds it.
- [ ] **Task 2 — the application layer's new modules.** `diagnostics.ts` (AC 2), `serialize.ts`
      (AC 3), `seal.ts` (AC 4), then `preflightFromObservations` and the sinks, **including the emit
      calls inside `runPreflight`** (AC 5). Cases 95 through 120. `check:layers` 0 violations.
- [ ] **Task 3 — the two type aliases and the three barrels.** `src/core/schemas/verdict.ts`'s
      `Verdict` and `EvaluatorRecommendation` aliases, then `npm run check:schemas` to prove a type
      alias is erased before the builder runs. Then `src/application/index.ts` (AC 6),
      `src/adapters/index.ts` and `src/index.ts` (AC 7). `npm run check:layers` and
      `npm run typecheck` are the gate on this task; both were red in the first draft's design.
- [ ] **Task 4 — the parser.** `src/cli/arguments.ts` (AC 9) and cases 1 through 30. Each reject
      verified by reverting its rule.
- [ ] **Task 5 — the ladder.** `src/cli/exit-codes.ts` (AC 10) and cases 31 through 48.
- [ ] **Task 6 — the output shapes.** `src/cli/render.ts` (AC 11) and cases 49 through 56, case 49
      being the one that pins `renderArtifact` to `serializeArtifact` rather than to a second
      canonicalizer.
- [ ] **Task 7 — the commands.** `src/cli/run.ts` (AC 11) and cases 57 through 88. Cases 61 through
      64 spy the application facade; cases 81 and 82 are NFR9.
- [ ] **Task 8 — the binary and the manifest.** `src/cli/main.ts` (AC 12), then `package.json`'s
      `bin`, `exports`, `files`, the `test:coverage` script and its `validate` entry, and the
      `prepare` move (AC 8). `npm run build`, then cases 89 through 94 and 145 through 158. The
      `./corpus/*` resolution cases and case 154 stay red until Task 11 generates the corpus, and
      that is expected. From here `npm run validate` is not runnable end to end until Task 11; run
      the individual checks instead.
- [ ] **Task 9 — the boundary scanner.** `scripts/package-boundary.ts`,
      `scripts/check-package-boundary.ts`, the `check:boundary` script and its `validate` entry
      (AC 14), then cases 121 through 144. Case 144 is red at this point and that is expected.
      Record the starting violation count from the first run; AC 14 declines to fix it in advance.
- [ ] **Task 10 — the AD-15 prose pass.** Work the list `check:boundary` reports (AC 15), plus
      `package.json`'s `lint:spine`, `scripts/spine-lint/lint_spine.py`'s default and its
      `required=True`, and `scripts/check-ad5-registry.ts:4-8`'s stale `files` comment. Then
      `npm run generate:schemas`, `npm run check:schemas`, `npm run lint:spine`,
      `npm run test:spine-lint`, and `check:boundary` clean. Check the four constraining tests AC 15
      names before assuming the suite is green.
- [ ] **Task 11 — the corpus.** `scripts/dev-corpus-target.ts`, `scripts/generate-dev-corpus.ts`,
      `scripts/check-dev-corpus.ts`, `biome.json`'s `"!corpus"`, the `generate:dev-corpus` and
      `check:corpus` scripts and the `check:corpus` `validate` entry (AC 16), then cases 159 through
      166 and the exports cases Task 8 left red. `npm run generate:dev-corpus` twice, with
      `git status --porcelain -- corpus/` clean the second time. **`npm run validate` is runnable
      end to end again from here**, and running it is this task's exit condition.
- [ ] **Task 12 — README, before the gate.** AC 18's rewrite, then `npm run build:shareable`. This
      comes before the gate deliberately: `check:shareable` is inside `validate`, and stories 6.2,
      6.3, and 6.4 each learned that a README edit without a rebuild fails it.
- [ ] **Task 13 — CI.** The two coverage steps (`validate-and-build` **and** `floor`), the three
      canary jobs, and the four edits to the `validate` step's `name:` string at `pr-checks.yml:65`
      (AC 13, AC 14, AC 16). The coverage canary uses `sed -i` and gets `timeout-minutes: 15`.
- [ ] **Task 14 — the gate.** `npm run validate`, `npm run build`, `npm run test:coverage`,
      `npm pack --dry-run`, and the pack-and-install case. AC 19's table filled from actual output.
- [ ] **Task 15 — the learning path, last.** Mark the story done and set `sprint-status.yaml`'s
      `6-5-the-library-and-cli-surface` to `review`, then row 23 and Step 23 per
      `learning-path-template.md`, with a de-AI pass over the new section.

## Dev Notes

### Read these files before writing anything

- `src/application/compile.ts` in full, thirty-five lines. `seal.ts` is that file with one more call
  and a `catch`, and its comment about `parsed.data` being Zod's own deep clone is why neither layer
  copies anything.
- `src/application/preflight.ts` in full, ninety-seven lines. The sequential-legs comment at `:67`
  says why the loop is not parallel. This file gains emit calls, not just a parameter.
- `src/core/preflight/plan.ts:27-32` and `:78`; `src/core/preflight/reduce.ts:31-33`, `:109-116`, and
  `:298`. Line 116's `continue` is the partial-observation branch, `:299-304` is the empty-plan fault, and
  `:109-111` is the last-write-wins `Map` AC 17 turns into a guard.
  Both matter to AC 5 rule 5, and the first draft had them the wrong way round.
- `src/core/seal/seal.ts` in full, and specifically `:40`, `:52`, `:62`, `:112`, `:113-117`,
  `:118-122`, `:156`. AC 4's table is a claim about these seven lines; check it rather than trusting
  it, because the first draft's version of that claim was wrong about three of its four rows and missed a fifth.
- `scripts/dependency-direction.ts:49-58` (the layer classifier) and `:73-95` (`isAllowedEdge`).
  `src/core/schemas/**` is `core-schemas`; **everything else under `src/core/` is `core`**. That one
  line is what makes AC 6 necessary.
- `scripts/check-lineage-ownership.ts` in full and `scripts/lineage-ownership.ts`'s header. AC 14's
  two scripts are those two with one predicate swapped.
- `scripts/generate-ad31-table.ts` and `scripts/ad31-table-target.ts` in full. AC 16's generator is
  that shape with a directory instead of a file, including the "imported from `tests/`" comment.
- `scripts/check-schemas.ts` for the byte-offset drift report AC 16's check mirrors.
- `scripts/build-shareable.mjs:274-282` and `:28`. Decision 15 turns on these two.
- `.github/workflows/pr-checks.yml:500-568`, the AD-31 table canary, and `:71-116`, the `floor` job.
  All three new canaries are that job with different commands, and the floor job is why the coverage
  step lands twice.

### Previous-story intelligence

1. **A README edit makes `_bmad-output/shareable/` stale** and `check:shareable` fails inside
   `validate`. Stories 6.2, 6.3, and 6.4 all hit it. Task 12 comes before Task 14 for this reason
   alone.
2. **Story 6.4's `check:lineage` rejects a lineage field written outside its two owner modules.**
   Nothing in `src/cli/` or the new `application/` files writes `parentDigest` or `revisionCount`. If
   a corpus fixture literal carries the words, the fix is that the generator emits them rather than a
   source file declaring them.
3. **Story 6.4 extracted `scripts/token-scan.ts`** as the shared tokenizer, and it throws on a regex
   containing `#` or a backtick. AC 14's scanner is a line-and-pattern scan over text rather than a
   token scan, so it neither uses the tokenizer nor inherits those limits. Say so in its header,
   because the next reader will assume otherwise.
4. **Story 6.3 found the `compile.ts` census stale** because 6.2 had not updated it. This story wires
   no new `compile.ts` check, so `tests/compile/compile.test.ts:46`'s 26-case census is untouched and
   AC 19 carries it as a row.
5. **A script may import `src/` and `tests/`.** `scripts/generate-ad31-table.ts` already imports both
   under bare `node` with type stripping only.
6. **The `floor` job runs `npm run test`, never `npm run validate`.** Adding a check to `validate`
   alone leaves it unrun on the declared engine floor.

### Project structure notes

- `src/cli/` is unrestricted in external modules: `scripts/dependency-direction.ts:215` exempts every
  layer but `core` from the builtin restriction. `node:fs/promises`, `node:path`, and `node:process`
  are available and no argument-parsing dependency is needed or wanted.
- `scripts/` runs under `node` with type stripping only. No enum, no namespace, no parameter
  property, no non-type re-export in anything a check script imports transitively.
- The detail-string convention is lowercase, no trailing period, identifiers in double quotes, a
  trailing `(AD-nn)` citation. `BoundaryViolation` follows it.
- Comments and JSDoc in this repository are lean and carry no negation-then-correction construction.
  That binds every ```ts block above: if a pruned comment differs from the block, record it as a
  deviation stating that statements, expressions, exported names, and `.describe()` strings are
  unchanged and only comment prose differs. Note that AC 15 is itself a comment-prose pass, so the
  two conventions meet here: rewrite for AD-15 and prune for length in one edit, not two.

### Testing requirements

- Vitest, `tests/**/*.test.ts`. `noExplicitAny` is off under `tests/**` only.
- The coverage floor is `include: ['src/core/**']`. Every file this story adds sits outside it by
  design, so a thin CLI test does not move the number; their coverage is asserted by case, not by
  percentage.
- **The packing cases must not race the `dist/`-reading cases.** `package.json`'s `prepack` is
  `npm run clean && npm run build`, and `clean` is `rm -rf dist`, so cases 92 and 157 delete `dist/`
  while cases 91, 145 through 150, 154, and 155 are reading it — and vitest runs test files in
  parallel. Cases 92 and 157 copy the repository into a temporary directory and pack there, so the
  working tree's `dist/` is never removed by a test. Skipping when `dist/` is absent turns the race
  into a silent skip and is not the fix; the copy is.
- Case 92 spawns a process. It is skipped with a clear message when a build has not run, so
  `npm run test` before a build stays green. AC 17's closing paragraph records the AD-30 reading that
  permits it.
- Every reject case is verified by reverting its rule; every near-miss in cases 132 through 142 is
  verified by widening its pattern.

### References

- `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md`:
  AD-14 (`:303-307`), AD-15 (`:309-313`), AD-21 (`:362-368`, the ladder, the exit codes, the
  `--strict` carve-out), AD-34 (`:471-475`, and especially the Prevents clause at `:474`), AD-30
  (`:439-445`), AD-13 (`:297-301`, the published-subpath and formatter-exclusion halves), AD-38
  (`:497-501`), AD-12 (`:293`), AD-11 (`:289`, the disclosed surface), AD-18 (`:331-335`), AD-28
  (`:414-431`), AD-2 (`:173`), the Conventions Logging row (`:545`), the Structural Seed source tree
  (`:584-601`), the VFR-8 row (`:624`), and "Owed to the reference implementation" items 1 and 7
  (`:671-680`, `:728-741`).
- `_bmad-output/planning-artifacts/epics.md:466-472` (Story 6.5), `:48` (NFR7), `:50` (NFR9).
- `_bmad-output/implementation-artifacts/epic-6-context.md:46`, the Story 6.5 dependency sentence.

## Suggested Review Order

1. **AC 4's precondition table against `src/core/seal/seal.ts`, row by row.** Five rows, two of them
   "Yes", each a claim
   about whether compilation pre-empts a specific `TypeError`. The first draft got three of four
   wrong and shipped a published boundary that throws an untyped error on a contract that compiles.
   Re-derive each row from the source rather than from the table.
2. **Decision 7 against AD-21's sentence.** "A command producing no verdict never exits inside the
   verdict range." The story reads the barred region as {1, 2}. If a reviewer can defend {0, 1, 2},
   every command needs a success code AD-21 does not assign, and AC 10 goes with it.
3. **Decision 3 against AD-34's Prevents clause at `:474`.** It forbids "two incompatible published
   library surfaces ... one where a stage is async and takes ports, one where it is sync over
   resolved artifacts". That is a literal description of `runPreflight` beside
   `preflightFromObservations`. The story argues they are one surface with two entry points onto one
   reducer. Decide whether that survives the word "incompatible".
4. **Decision 4's criterion against the whole published surface.** A command exists where one
   orchestration call produces an interchange artifact to serialize. Walk every value AC 6 and AC 7
   publish and check the criterion sorts each into command or helper without a special case. If it
   does not, the command set is settled by a list again and Decision 4 is back where it started.
5. **AC 14's ten patterns against the real tree.** Implement them and run them. AC 14 declines to
   fix a number and says roughly a hundred lines across thirty-eight files; confirm the order of
   magnitude and, more importantly, look for an AD-15 reference the ten patterns plus the
   wrapped-comment join still miss. The first draft's two narrow patterns missed nine, all of them
   by line wrapping or by dropping the number. Look for an eleventh shape.
6. **Decision 11 against `scripts/check-shareable.mjs:36-48`.** The claim is that `homepage`,
   `repository.url`, and `bugs.url` cannot change. If they can, the exemption is unnecessary and the
   scanner should cover them.
7. **AC 8's `exports` map against a real pack and install.** `npm pack`, install the tarball into a
   scratch directory, and resolve every subpath by its literal specifier. A wildcard that resolves in
   the repository and not in an install is the classic version of this bug, and the first draft's
   `./schemas/*.json` target granted only `eval-quality/schemas/rubric.schema`.
8. **Decision 12 against AD-38's three dimensions.** The story ships one and names two absences with
   Owed items behind them. Decide whether a corpus with one of three dimensions is "the development
   corpus" AD-14 requires, or a named partial that should not close the epic's AC.
9. **Cases 61 through 64 against AC 11 rule 2.** They must spy the application facade, not the
   environment. An I/O count is compatible with four orchestration calls, and the first draft's
   version of this case proved nothing about the AD-14 sentence it existed for.
10. **AC 17's arithmetic.** Twelve files, 166 cases, each group stating its own count. Add the group
    counts per file and check they equal the range width. The first draft's version was wrong in four
    of eight files.
11. **Decision 15 against `build-shareable.mjs:274-282`.** The claim is that absolutising README links
    regresses the sibling-page rewrite and that `check:shareable` would not catch it. Verify by making
    one link absolute and diffing the rebuilt HTML.

## Story Review Record

Two rounds before implementation, against three independent reviewers each round: a sibling Claude
Code session running six parallel lenses, a Codex session (cross-model), and subagent passes on
architecture conformance, feasibility-by-execution, and mechanical consistency. Ninety-nine findings.
Most were verified by execution against the tree rather than reasoned from the story's prose, which
is what caught the ones a careful reading would have ratified. Every finding is closed in the text
above. Nothing was deferred.

**Round one, the nine that changed the design rather than the prose:**

1. **The root barrel adds two `root -> core` edges the matrix denies** (HIGH, three reviewers, two by
   execution). `src/core/failure-codes.ts` and `src/core/lineage/chain.ts` classify as layer `core`
   (`scripts/dependency-direction.ts:51-52`), and `root` is granted `application` and `core-schemas`
   only. A reviewer wrote the barrel into a clone and got two `check:layers` violations. AC 6 now
   exists: `src/application/index.ts` holds the legal `application -> core` edge and both the root
   barrel and `src/cli/*` read it. Decision 8.
2. **`Verdict` has no TypeScript type, so the exit-code module did not compile** (HIGH, by execution).
   `src/core/schemas/verdict.ts` exports Zod values only; it and `EvaluatorRecommendation` are the two
   names in the barrel without a `z.infer` alias. `error TS2749`. AC 7 rule 3 adds the aliases and
   AC 1 carves them out of "no `core/` change".
3. **`check:boundary` could never exit zero, so `npm run validate` was unreachable** (HIGH, two
   reviewers). `package.json` carries `bmad-code-org` in three URL fields that cannot move. AC 14
   exempts the package's own coordinates. Decision 11.
4. **`reducePreflight` throws on an unmatched observation array; the story said it returns a failed
   verdict** (HIGH, by execution). `src/core/preflight/reduce.ts:299-304`. AC 5 rule 5 now
   distinguishes partial from empty and pins all three shapes.
5. **`--strict` was bound to the wrong flag** (HIGH, three reviewers). AD-21 spells the gate-promotion
   flag `--strict` seven times across the spine; AD-4 names none. The draft gave `--strict` to AD-4's
   compile mode and minted `--gate-strict`. AD-11 puts the flag contract inside the disclosed surface,
   so that was a contract rename shipped as a naming preference. Decision 6.
6. **The exports wildcard granted only a specifier nobody would guess** (HIGH, by execution).
   `./schemas/*.json` over files named `<kind>.schema.json` resolves `eval-quality/schemas/x.schema`
   and fails the literal filename. AC 8 uses `./schemas/*` after both candidate forms were packed and
   installed.
7. **`INTERCHANGE_ARTIFACTS` carries live Zod schemas** (HIGH, two reviewers). Exporting it would
   couple every consumer to zod 4.4.3 — the thing case 152 exists to prevent — while the same AC
   asserted the test that forbids it. `INTERCHANGE_ARTIFACT_KEYS` instead. Decision 14.
8. **The barrel rewrite would silently delete six published types** (HIGH, by execution). `git log`
   shows Story 6.2's `a048c50` added the sensitivity-witness types; the draft claimed the file was
   untouched since Story 1.1 and its completeness rule, derived from the artifact registry, would not
   have noticed. AC 7 rule 2 and case 153.
9. **NFR9's permutation family was never applied to the stage this story publishes** (HIGH). AC 17
   cases 81 and 82.

**Round two, the six that changed the design again:**

10. **The layer barrel turned `check:lineage` red** (HIGH, by execution). Story 6.4's scanner flags
    the bare identifier `reviseArtifact` outside its owner modules, a re-export included. AC 6 drops
    the name and says why the alternative — widening a Story 6.4 allowlist — is the worse trade.
11. **`validate-lineage` was drafted on a round-one finding and withdrawn on a round-two one** (HIGH,
    by execution, same reviewer both times). Six independent problems, and the criterion that settles
    the command set is AD-14's own sentence. Decision 4 records both directions.
12. **`schema-parse-failure` is not defensible for the rows the conversion exists for** (HIGH). AD-28
    has no precondition-violation code; a duplicate `logicalId` parses and validates. AC 4 records the
    mismatch as an admission under AC 1's no-minting rule rather than arguing it away.
13. **Three of `seal`'s four preconditions are not pre-empted, and one of the three named keys is**
    (HIGH, by execution, two rounds). `forbidden-inputs.ts:21-29` throws on any scoped resource.
    AC 4's table is now five rows and the cases assert per row.
14. **The corpus generator cannot run under bare `node`** (HIGH, by execution).
    `src/core/canonical/scan-json.ts:49-52`'s constructor parameter properties make every script
    importing `core/canonical/` die at load. AC 16 fixes it at the source.
15. **AD-34's Prevents clause enumerates four differences and all four hold** (HIGH). Decision 3 now
    records an explicit deviation rather than claiming conformance, which is the form a later reader
    can review.

**Also closed, without changing the design:** the AD-15 pattern set went from two narrow patterns to
eleven with a wrapped-comment join, after three reviewers independently showed the narrow set misses
nine real violations that ship in `dist` (JSDoc wraps at eighty columns, so `Story` and `1.5` land on
different lines) and that an `AC 8` string already ships in two published schema documents; the
census stopped being a fixed number the story asserts and became one `check:boundary` records, after
no reviewer could reproduce the claimed figure; `npm pack` gained `--ignore-scripts` after a reviewer
proved `prepack` deletes `dist/` under the parallel test file that reads it, and `--offline` after
another proved the install silently contacts the registry, which NFR7 forbids; `import.meta.resolve`
was replaced by `createRequire(...).resolve` after a reviewer showed the former never stats and
passes for files that do not exist; case 153 dropped its git merge-base for a committed snapshot,
because no CI job sets `fetch-depth` and a case that cannot run is worse than no case; the coverage
config gained the `reportsDirectory` the same AC had named as the remedy for a flake it then shipped
without; the `floor` job replaces its Test step rather than adding beside it; the nineteen corpus
contracts now route through the shipped `compile`, because they carry hand-declared lineage fields
that AD-29 forbids and `check:lineage` never saw; `reducePreflight` gained a duplicate-`probeId`
guard, a real defect the permutation case surfaced; `prepare` is renamed rather than deleted, with
`CONTRIBUTING.md` gaining the hook-install command, after six packed variants showed the warning
follows the lifecycle key's presence; the README's relative links stay relative after a reviewer
showed absolutising them regresses `build-shareable.mjs`'s sibling-page rewrite invisibly to
`check:shareable`; both barrels' export order was corrected to Biome's, which sorts exports as well as
imports; the test census, the lockfile growth, the sub-90 file count, the sibling-link count, the
`--strict` occurrence count, and eight file:line citations were each corrected against measurement;
and the story stopped claiming to close the epic, because two reviewers independently showed a
one-dimension corpus cannot satisfy AD-38 and close its epic at once.

**Verified clean by execution, and worth recording because each was a specific suspicion:** the case
arithmetic (twelve files, 166 cases, contiguous, every group count equal to its sub-range width,
checked twice by two methods); `freezeArtifact` on a contract does not break `core/seal`, which copies
before every sort; `dependency-direction.ts` does detect a bare `export * from`; the shebang survives
`tsc` at byte 0 and `npm install` chmods the bin to 0755; `biome.json`'s `"!corpus"` is necessary;
the coverage baseline reproduces to the digit; the nineteen contracts and twenty-two published
fixtures are already clean of all eleven AD-15 patterns and of AD-18's six categories; and every
`npm pack --dry-run` entry matches AC 19's row.

## Implementation Review Record

Three rounds after the gate first went green, each finding verified by execution and each fixed in
this pass. Nothing is deferred.

**Round one, the implementer's own end-to-end pass over the built binary.** One HIGH.

1. **A path the invocation named that the filesystem will not give us escaped as a raw Node stack
   and exit 1** (HIGH). `node dist/cli/main.js compile --in missing.json` printed
   `node:internal/fs/promises:697` and eleven stack frames, then exited 1. So did
   `seal --in contract.json --out ./nodir` when the directory was absent. Exit 1 is
   `EXIT_CONCERNS_PROMOTED`, and AD-21 says "a command producing no verdict never exits inside the
   verdict range", so a missing file was reporting itself as a promoted CONCERNS. `run` catches
   `StructuralFailure` and `RuntimeFault` and rethrows everything else by design (AC 11 rule 4), and
   `main.ts` had no handler above it. Fixed in `main.ts`, which is the only file in the package that
   touches the filesystem: a `NodeJS.ErrnoException` whose `code` is one of seven path errors is
   rendered through `renderUsage` and takes `EXIT_USAGE`. The caller chose the path, so a usage error
   is what it is, and 64 is outside every code AD-21 assigns. Cases 167 and 168 pin both directions
   and assert the stack is gone.

**Round two, a Codex cross-model pass** (`codex exec`, its own clean clone of the tree). One HIGH,
found by reproducing CI's step order rather than by reading.

2. **`npm run validate` could not pass on a clean checkout, and neither could two CI jobs** (HIGH, by
   execution). `tests/architecture/package-exports.test.ts` resolved `eval-quality` through
   `createRequire(...).resolve` at **module load** and awaited the built barrel there.
   `createRequire(...).resolve` stats, which is the whole reason AC 17 chose it over
   `import.meta.resolve`, so on a tree with no `dist/` the file threw before any case ran:
   `Cannot find module '.../dist/index.js'`, `Test Files 1 failed (1)`, `Tests no tests`. `validate`
   ends in `test:coverage`, and in `validate-and-build` the `Build` step ran **after** `Validate`,
   so the Node 24 job would have gone red on every pull request. `canary-coverage` ran
   `npm run test:coverage` straight after `npm ci` with no build at all. The `floor` job was
   unaffected: it already builds before it tests. Two fixes, both needed:
   - The eight `dist/`-reading cases now resolve lazily and skip with a clear message when
     `dist/index.js` is absent, which is the pattern `tests/cli/main.test.ts` already used for its
     four. Measured on an unbuilt tree: `84 passed`, `2778 passed | 15 skipped`.
   - A skip inside a green gate is a hole, so CI never takes that path. `validate-and-build`'s
     `Build` step moved ahead of the coverage and validate steps, and `canary-coverage` gained a
     build after `npm ci`. Every job that runs the suite now builds first.

**Round three, an adversarial peer review session** with its own subagent fleet, briefed to verify by
execution: three HIGH, eleven MEDIUM, and fourteen LOW, every one reproduced before it was reported.
All twenty-eight are closed in this pass. They are listed in the Peer Review Record below, with what
changed.

**One observation recorded rather than fixed.** `--strict=true` reports "unknown flag". `--strict`
takes no value, so the equals form falls through to the unknown-flag branch and the message names a
flag that does exist. AC 9 rule 3 gives the equals form to "every value-taking flag" and says nothing
about the boolean ones, so this is inside the grammar; the message could be kinder.

The `coverage.reportsDirectory` collision recorded here after round two is **fixed** rather than
accepted: the peer review reached the same finding independently and showed that AC 13's tmpdir path
is worse than the `./coverage` it replaced, because a machine-global path collides across every
checkout and terminal on the host where a repository-local one collided only within a checkout. The
path is now per-process.

## Peer Review Record

One round, after the gate was green, against two independent reviewers.

**A Codex cross-model pass** (`codex exec`, its own clean clone) produced the one HIGH recorded as
round two above and then hit an account usage limit before writing a summary. The finding it did
produce was the release blocker in the set: it reproduced CI's step order in a clean tree instead of
reading the workflow, and found that `npm run validate` could not pass on a fresh checkout.

**An adversarial peer Claude Code session** with eight subagents in parallel, briefed to verify by
execution and to leave the tree untouched. It returned **three HIGH, eleven MEDIUM, and fourteen
LOW**, each reproduced before it was reported, with the command output attached. It also re-ran the
whole gate at the end and confirmed the working tree was byte-for-byte as it found it. Every one of
the twenty-eight is closed here; nothing is deferred. Four subagents worked them in parallel and each
fix was reproduced-then-verified against the defect it closes.

**The three HIGH.**

1. **The CLI overwrote its own input.** `main.ts`'s `resolvePath` returned an absolute path verbatim,
   so `collides` compared raw strings and three aliasing spellings each destroyed the file they were
   reading. Measured, with a 16,549-byte input: `--in $D/./q1.json --out $D/q1.json` exited 0 and
   left 9,031 bytes; `--in $D/d/../q2.json` the same; a symlinked `--in` the same. Case 75 was green
   because the in-memory fake supplied a hand-written normaliser that folds `.`, `..`, and `//` on
   absolute paths — the test double was stronger than production, and nothing exercised production's
   own `resolvePath`. Two fixes, because a string fold cannot reach a symlink or a case-insensitive
   filesystem: `resolvePath` is now `resolve(path)` unconditionally, and `RunEnvironment` gained
   `sameFile`, which `main.ts` implements by comparing device and inode and which `collides` consults
   after the string check. `run` still imports no `node:fs`. Cases 172, 173, 174, and 176 pin the
   three aliases and the `sameFile` consultation; 175 is the control. Re-measured: 16,549 bytes
   before, 16,549 after, exit 64.
2. **The boundary check failed open and still claimed it had scanned.** `discoverCorpusFiles` wrapped
   `readdir` in `catch { return }` at every depth, swallowing EACCES and EIO alongside the ENOENT it
   was written for, while the success line still named `corpus/`. Measured: a seeded reference under
   an unreadable subdirectory reported `153 entr(ies) scanned ... 0 violations` at exit 0. Now only
   ENOENT on the root walk is swallowed and everything else reaches the top-level handler; the same
   seed under `chmod 000` reports `EACCES: permission denied` and exits 1. The success line carries
   per-source counts, so a silently empty source is visible in the output.
3. **AD-18 screening covered `corpus/dev/`; the tarball ships all of `corpus/`.** `package.json`'s
   `files` carries `corpus`, while the drift check and the AD-18 case both walked `corpus/dev/`.
   Measured: a planted `corpus/holdout/leak.json` holding an email address and an API key left
   `check:corpus` green, left the eight corpus cases green, and packed into the tarball. A new
   `CORPUS_PACKAGE_ROOT` is now walked by both, so anything under `corpus/` the builder does not
   produce is an orphan and is screened. The same planted file now fails the check by name and turns
   cases 159, 161, and 166 red.

**The eleven MEDIUM, each closed.** The spine-workspace cross-check had become a substring search
over a 550-line Python file and would pass while the scripts and the linter read different documents;
it now asserts the `DEFAULT_WORKSPACE` assignment and that `--workspace` defaults to it, with a
distinct message per failure. An errno outside `main.ts`'s seven-code path allowlist exited 1, which
is `EXIT_CONCERNS_PROMOTED`; every escape from `run` is now an outcome that `exitCodeFor` assigns, a
non-path errno takes the fault code, and `parseArguments` and the manifest read moved inside the try.
AC 4's precondition table was missing a live sixth row: `Direction.evidenceTargets` carries no
`.min(1)` and AD-3's alignment predicate is a universal over it, so an empty list compiles clean and
converts at the seal boundary; `direction-prose.ts`'s JSDoc said the shape was unreachable and now
says where it is converted. `ARCHITECTURE-SPINE.md` was a planning-artifact path the eleven patterns
missed, at four sites under `src/` and five in `dist/`; it is pattern twelve and all four sites are
cleared. A value-taking flag swallowed the next flag token, so `--out --strict` bound `--strict` as a
path and silently dropped the flag, and `--out=` bound an empty value; both are usage errors now,
with bare `-` still legal and the equals form still the way to spell a dash-leading path. `--strict`
cannot change any exit code the binary produces, because no command constructs a verdict outcome;
`--help` and the README now say so in the same seven-line table. AC 16 rule 1's stated reason for
routing the corpus through `compile` was false — `compile` is `carries-through` and normalizes
nothing — so the comment and the corpus README say what is true, and `buildDevCorpus` asserts the
root lineage shape before writing, which makes the invariant real. The corpus canary declared success
on a no-op edit; a `git diff --quiet` guard now fails that. The coverage canary's grep did not name
the axis its echo claimed, and now does. `reportsDirectory` is per-process. And twelve prose rewrites
that changed meaning are corrected, each against the code or the spine line it cites, plus two more
of the same class the reviewer found outside the rewrite set.

**The fourteen LOW, each closed.** The scanner gained `/i` on its three numbered patterns, plural and
hyphenated spellings, the spaced compounds `planning artifact` / `implementation artifact` /
`sprint status`, and a second match attempt against the empty-joined form of a wrapped comment run,
which is what catches a reference broken across a line at a hyphen. `scanPackageBoundary`'s
one-violation-per-logical-line reading is now pinned by a case. `renderArtifact` was dead in the CLI
path and is now what `emitArtifact` calls, which makes `render.ts`'s claim true and gives case 49
something to constrain. The README exit-code table is compared against `EXIT_CODE_TABLE` by a case.
The `.json` classifier is case-insensitive. `validate-and-build` no longer runs the coverage suite
twice. `canary-boundary` gained a `corpus/` arm. The `floor` job runs the two new type-stripped
scripts. The two corpus path derivations agree and go through `relative`. The `index` kind's doc
comment says why it exists and is never an entry value. `--out ''` is a usage error. `help <unknown>`
names the command list, and the stdin-collision message counts its subjects. The lines figure in the
Debug Log is corrected to 97.91% (2588/2643), and AC 19's stale line reference and census are
corrected above. `canary-dev-corpus` gained a first step asserting `corpus/` is committed, so
"never committed" reports as itself rather than as a pathspec error — **that step is red until the
directory is added, which is the one thing this branch still needs before a pull request.**

**One proposal declined, with its reasoning.** The review proposed a thirteenth pattern,
`/\bOwed item \d/i`, on the same argument that carries patterns 9 through 11. It is declined: "Owed
to the reference implementation" is a numbered section of the architecture spine, so `Owed item 7` is
architecture vocabulary of the same class as an AD number, which AD-15's own "AD numbers stay"
carve-out permits — and AC 16 rule 4 requires the published corpus README to name Owed items 1 and 7
as the reason two of AD-38's dimensions are absent. A pattern forbidding the phrase would forbid a
sentence another acceptance criterion mandates. The reasoning is recorded in `BOUNDARY_PATTERNS`'
own doc comment so a later reader can dispute it.

**One numbering decision.** AC 17 says `package-boundary.test.ts`'s range is `2 x patterns + 2` and
that adding a pattern shifts every range after it. Renumbering three test files and every case
citation in a 2,150-line document, at this stage, is churn with no reader benefit, so the twelve
cases these rounds added are appended as 167 through 178 and every existing number is untouched. The
invariant still holds on the count: twelve patterns, twenty-six pattern cases, plus one structural
case for the per-line reading. The file header records it.

**What the review verified clean, and how**, because a silent area reads as an unexamined one: AC 4's
five original rows, each re-derived from `src/core/seal/seal.ts` and probed with real contracts under
both strict modes, with the case assertions shown to discriminate between the two error classes; the
published-schema diff, checked twice — every changed line matching `"description"`, and a structural
walk over key paths and non-description values byte-identical across all nine files; the pattern
precedence settlement, with `_bmad-output` confirmed as the only pattern unreachable under strict
numbered order; AC 11's other nine rules, each driven through the built binary; AC 9's grammar,
against roughly 110 argv vectors through both the parser and the binary; the corpus, including
regeneration idempotence, all twenty-two digests reproduced independently with Python's `hashlib`,
and an AD-18 sweep of `corpus/dev/` that came back empty; the three canaries, proved load-bearing by
neutering each guard in a committed copy rather than by reading the comments; and the case
arithmetic, file by file.

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context), running the implementation directly and fanning out to fourteen
subagents: five for the AD-15 prose pass, one per source directory, and nine for the test files.

### Debug Log References

Every number below is command output taken on the finished tree, not arithmetic.

| Check | Command | Result |
| --- | --- | --- |
| Full gate | `npm run validate` | exit 0, all fifteen checks |
| Build | `npm run build` | exit 0; `dist/cli/main.js` carries `#!/usr/bin/env node` at byte 0 |
| Coverage | `npm run test:coverage` | statements 96.85% (2860/2953), branches 92.25% (1632/1769), functions 99.8% (517/518), lines 97.91% (2588/2643) |
| Test census | `npm run test` | 84 files / 2803 tests, from the 73-file / 2625-test baseline |
| Layers | `npm run check:layers` | 96 files scanned, 0 violations |
| Lineage | `npm run check:lineage` | 96 files scanned, 0 violations |
| Boundary | `npm run check:boundary` | first run 137 violations across 41 entries under eleven patterns; 0 after the prose pass and after the twelfth pattern, across 153 entries (96 from `src/`, 23 from `corpus/`, 34 synthetic manifest entries) |
| Corpus | `npm run check:corpus` | 23 committed corpus files match the builder byte for byte, and `corpus/` holds 23 files and nothing else |
| Schemas | `npm run check:schemas` | 12 documents match after `generate:schemas` |
| Schema delta | `git diff --stat schemas/` | 9 files, 61 insertions, 61 deletions, every changed line a `"description"` value |
| Licences | `node scripts/check-licenses.mjs` | passed, 179 entries |
| Lockfile age | `node scripts/audit-lockfile-age.mjs` | passed, 179 entries |
| Spine lint | `npm run lint:spine`, `npm run test:spine-lint` | zero findings; 45 pytest cases pass |
| Shareable | `npm run check:shareable` | 21 pages match after `build:shareable` |
| Conformance | `npm run test:conformance` | 53 tests pass |
| Pack contents | `npm pack --dry-run --ignore-scripts` | `LICENSE README.md corpus dist package.json schemas`, 230 files, 1,309,698 bytes unpacked |
| Installed bin | pack into a temp copy, `npm install --offline`, run the shim | prints `0.0.0`, exit 0, no `.tgz` in the repository |
| AD-31 table | `git diff --exit-code -- docs/` | clean |
| Compile census | `tests/compile/compile.test.ts:46` | unchanged at 26 |

The boundary census by pattern, from the scanner's own first run: `story` 60, `Decision n` 36,
`AC n` 22, `epic` 18, `_bmad-output` 1. The three lockfile facts: 19 added entries, the provider
plus its eighteen transitives, confirmed by diffing `package-lock.json`'s `packages` keys against
`HEAD`.

The three canaries were each run locally before being written into the workflow, then each was
re-run after review hardening, with its guard neutered to prove the guard is what makes it pass. The
coverage canary emits `ERROR: Coverage for statements (96.85%) does not meet global threshold (100%)`
while the suite still reports 2803 passed. The boundary canary's three seeds produce
`src/core/failure-codes.ts:1 [story]`, `package.json#description:1 [TEA]`, and
`corpus/dev/boundary-canary.md:1 [_bmad-output]`. The corpus canary's seed change produces
`corpus/dev/compile-seal-example/brief.json: drift at byte offset 74`.

**Two rows of AC 19 are stale against the finished tree and are corrected here rather than in the
criterion.** Its CI-name-string row cites `pr-checks.yml:65`; the `Validate` step is at `:75` after
the `Build` step moved ahead of it. Its test-census row expects 84 files and 2789 tests against
AC 17's 164 cases; the count is 84 files and 2803 tests against 178 cases, which is AC 17's 166 plus
the twelve added during the review rounds below.

### Completion Notes List

**Deviations from the story text, each with its reason.**

1. **`run` takes an optional third parameter.** AC 11's sketch shows `run(invocation, environment)`,
   and AC 17 cases 60 through 62 require spying the application facade rather than the environment.
   `run(invocation, environment, application = APPLICATION)` is what makes that possible while
   leaving every two-argument call valid.
2. **`RunEnvironment` carries `joinPath`.** AC 11's sketch lists six members; rule 9 names a seventh,
   `joinPath`, and says why (`run` may not import `node:path`). The sketch and the rule disagree and
   the rule is the load-bearing half.
3. **`scripts/dev-corpus-target.ts` exports `URL`s and a builder.** AC 16's sketch annotates the
   paths `string`; `scripts/ad31-table-target.ts`, which the same paragraph says this module mirrors,
   exports `URL`s. The module also exports the pure `buildDevCorpus`, because the generator and the
   drift check must agree about bytes and a shared builder is the only way they cannot disagree.
4. **`DevCorpusEntry` carries an optional `structuralFailure`.** AC 16 rule 1 requires the three
   uncompilable contracts ship "with their expected failure code recorded in `index.json`"; rule 2
   gives the entry shape as `{ path, kind, digest }`. The optional field satisfies rule 1 and leaves
   the other nineteen entries exactly rule 2's shape.
5. **`index.json` is not an entry in itself.** An entry carries the digest of its own bytes and a
   manifest cannot hold its own. `index` stays in the closed `DevCorpusKind` vocabulary as what the
   drift check calls the manifest when it reports an orphan.
6. **The example seed is `satisfied-declarations`.** AC 16 rule 3 names `fully-satisfied`, which is
   not a `contractId` in `tests/coverage/fixtures/corpus.ts`. The contract whose declarations satisfy
   every discipline rule is `satisfied-declarations`, and that is the seed.
7. **The spine linter holds the workspace path, and both registry cross-checks follow it there.**
   AC 15 moves the path out of `package.json`'s `lint:spine` into `lint_spine.py`'s
   `--workspace` default. `scripts/check-ad5-registry.ts` and `scripts/check-ad28-registry.ts` both
   asserted that `package.json`'s `lint:spine` value names the workspace, so both would have failed
   the moment the path left. They now cross-check `lint_spine.py`'s `DEFAULT_WORKSPACE`, which is the
   same guarantee against the new single source. `scripts/spine-lint/README.md` records that this
   copy differs from the gitignored skill copies in exactly that one line.
8. **`--help` and `-h` are accepted after a command.** AC 9's grammar puts them in leading position
   only. `eval-quality compile --help` reaching "unknown flag" is a worse command line for no
   benefit, and accepting them post-command breaks no case AC 17 lists.
9. **The AD-15 pattern precedence is declared most-specific-first.** AC 14 says "the patterns are
   ordered as numbered and the first match wins, because `bmad` otherwise shadows `_bmad-output`".
   Those two clauses contradict each other: under the table's numbering, pattern 1 (`bmad`) matches
   every `_bmad-output` string before pattern 3 can, so pattern 3 is unreachable and case 123 could
   never pass. `BOUNDARY_PATTERNS` therefore lists `_bmad-output`, `planning-artifact`,
   `implementation-artifact`, and `sprint-status` ahead of the bare `bmad` word, which is the reading
   that makes every pattern reachable and matches the sentence's stated purpose. The test file
   records the contradiction and which half the code honours.
10. **Comment prose differs from four VERBATIM blocks.** The repository's convention bars
    negation-then-correction, and AD-15's own gate rejects a `Decision N` reference in `src/`. The
    blocks in AC 2, AC 4, AC 6, and AC 10 carry both. Statements, expressions, exported names,
    `.describe()` strings, and field names are unchanged; only comment prose differs, and each
    pruned clause was replaced by the fact it stood for rather than deleted.
11. **The exit-code table lives in `src/cli/render.ts`.** AC 12 rule 4 requires the `--help` table
    and the README table be the same seven lines written once, and `render.ts` is the module both
    reach. AC 11 calls `render.ts` "four output shapes and nothing else"; the table is a fifth
    export there.

**Two defects in the story text, found by execution and not repaired here.**

- **AC 17's seal paragraph contradicts AC 4's corrected table.** It says cases 99 through 102 are
  "the three duplicate-key throws — `oracleId`, `permittedInterfaces.logicalId`,
  `scopedResources.reference` — plus the `buildPlanIndex` duplicate, each asserting a `RuntimeFault`"
  and that "`validateAssembledBrief` gets no case". AC 4 says the opposite on both counts, and AC 4
  is what the source supports: driven through the published boundary, a duplicate
  `scopedResources.reference` throws `StructuralFailure('scoped-reference-resolves-forbidden')`
  unconverted, `buildPlanIndex` is the row with no case, and `validateAssembledBrief` is case 102.
  The cases follow AC 4.
- **Case 101 needs a construction AC 4 does not spell out.** Duplicating a whole
  `permittedInterface` never reaches `seal.ts:113-117`: it duplicates the operations too, the plan
  index goes `unresolved`, and compile throws `StructuralFailure('unreachable-check-evidence')`
  first. The second interface must share the `logicalId` and declare **no** operations
  (`operations: []` parses; `interface.ts:155` sets no minimum). That is the unreferenced-id variant
  AC 4's `buildPlanIndex` paragraph predicts, so the claim holds; the contract just has to be built
  that way. The case comment records it.

**One numbering collision.** `tests/application/preflight.test.ts` already numbered Story 6.2's cases
`105.` through `112.`, and this story's cases for the same file are also 105 through 112. The two
sets are distinguished by `NNN.` against `case NNN:`. Nothing renames 6.2's block, because renaming
committed case numbers breaks every reference to them; the collision is recorded here instead.

**One test-harness note.** `tests/cli/main.test.ts` skips cases 89, 91, and 94 as well as 92 when
`dist/` is absent. All four read or spawn the built binary, so skipping only 92 would still leave
`npm run test` red before a build.

### File List

**New source:** `src/application/diagnostics.ts`, `src/application/serialize.ts`,
`src/application/seal.ts`, `src/application/index.ts`, `src/adapters/index.ts`,
`src/cli/arguments.ts`, `src/cli/exit-codes.ts`, `src/cli/render.ts`, `src/cli/run.ts`,
`src/cli/main.ts`.

**New scripts:** `scripts/package-boundary.ts`, `scripts/check-package-boundary.ts`,
`scripts/dev-corpus-target.ts`, `scripts/generate-dev-corpus.ts`, `scripts/check-dev-corpus.ts`.

**New published data:** `corpus/dev/` — twenty-two entries plus the manifest: nineteen contracts,
`compile-seal-example/contract.json`, `compile-seal-example/brief.json`, `README.md`, `index.json`.

**New tests**, with the case count each carries after the review rounds:
`tests/cli/arguments.test.ts` (30), `tests/cli/exit-codes.test.ts` (18),
`tests/cli/render.test.ts` (9), `tests/cli/run.test.ts` (33), `tests/cli/main.test.ts` (13),
`tests/application/seal.test.ts` (10), `tests/application/diagnostics.test.ts` (4),
`tests/application/serialize.test.ts` (4), `tests/architecture/package-boundary.test.ts` (27),
`tests/architecture/package-exports.test.ts` (14), `tests/architecture/dev-corpus.test.ts` (8).
That is AC 17's 166 cases plus twelve the review rounds added, numbered 167 through 178.

**Edited tests:** `tests/application/preflight.test.ts` (+8, cases 105 through 112).

**Edited source, behavioural:** `src/index.ts`, `src/application/preflight.ts`,
`src/core/schemas/verdict.ts` (two type aliases), `src/core/canonical/scan-json.ts` (parameter
properties), `src/core/preflight/reduce.ts` (the duplicate-`probeId` guard). `src/cli/main.ts` and
`src/cli/run.ts` carry the review's `sameFile` collision check and the terminal-outcome handler;
`src/cli/render.ts` carries the shared exit-code table.

**Edited source, prose only:** thirty-six files under `src/core/` plus `src/testing/index.ts` and
`src/core/coverage/table.ts`, for the AD-15 pass.

**Edited configuration and docs:** `package.json`, `package-lock.json`, `vitest.config.ts`,
`biome.json`, `.github/workflows/pr-checks.yml`, `README.md`, `CONTRIBUTING.md`,
`scripts/check-ad5-registry.ts`, `scripts/check-ad28-registry.ts`,
`scripts/spine-lint/lint_spine.py`, `scripts/spine-lint/README.md`, nine files under `schemas/`, two
files under `_bmad-output/shareable/`, and `_bmad-output/implementation-artifacts/sprint-status.yaml`.

`_bmad-output/project-knowledge/learning-path-step-by-step.md` is deliberately untouched; it is
written after this record.
