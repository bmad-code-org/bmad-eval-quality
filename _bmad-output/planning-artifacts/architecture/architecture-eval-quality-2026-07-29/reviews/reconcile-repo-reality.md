---
title: Reconciling the architecture spine against repository reality
type: architecture-review
subject: _bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md
date: '2026-07-29'
status: findings
---

# Reconciling the architecture spine against repository reality

Scope: whether ARCHITECTURE-SPINE.md ratifies the conventions and artifacts already established in
this repository, principally the eight hand-written Draft 2020-12 schemas under
`experiments/hypothesis-validation/schemas/` that carried 19+ scored runs, and the existing build,
lint, test, and CI configuration.

Verified by execution where possible. TypeScript 7.0.2, Vitest 4.1.10, and Zod 4.4.3 were installed
in a scratch copy of `src/`, `tests/`, `tsconfig.json`, `tsconfig-build.json`, and `vitest.config.ts`
and actually run; those results are marked **verified**.

Counts: 26 findings — 4 critical, 13 high, 8 medium, 1 low. Finding 26 has a medium part and a high
part and is counted once, as high.

Findings that genuinely match are omitted. In particular the `sha256:` digest pattern
(`^sha256:[a-f0-9]{64}$`), `additionalProperties: false` on every object, the uppercase
`PASS`/`CONCERNS`/`FAIL` verdict enum, the non-null-violation-invalidates-the-run rule, and the
Draft 2020-12 dialect are correctly ratified and are not reported.

---

## 1. Enumeration casing: the spine mandates snake_case; all eight schemas use kebab-case

**Severity: critical.**

Consistency Conventions, "Data and formats" (ARCHITECTURE-SPINE.md:183) states: *"Enumerations are
lowercase snake case, except the verdicts PASS, CONCERNS, and FAIL."*

Every multi-word enumeration value in the prior art is lowercase **kebab**-case:

- `eval-contract.schema.json:44-49` — `"original-spec"`, `"source-code"`, `"builder-transcript"`, `"implementation-logs"`, `"comparator-results"`, `"human-labels"`
- `evaluator-result.schema.json:13-17` — `"claim-evidence"`, `"semantic-checkpoints"`, `"process-outcome"`, `"first-material-error"`
- `isolation-manifest.schema.json:14` — `"self-review"`
- `h0-ground-truth.schema.json:32` — `"controlled-mutation"`
- `trace-label.schema.json:21` — `"not-checkable"`
- `private-evidence-manifest.schema.json:21-28` — `"private-input-record"`, `"raw-trace"`, `"raw-result"`, `"human-label"`, `"implementation-patch"`, `"isolation-manifest"`, `"scripted-baseline-output"`

There are zero snake_case enum values anywhere in the eight schemas. The spine's own AD-6
(ARCHITECTURE-SPINE.md:102) then writes its outcome states in snake_case — `passed_clean_control`,
`false_positive`, `oracle_error`, `infrastructure_error`, `not_applicable` — and AD-17
(ARCHITECTURE-SPINE.md:168) adds `judge_error`. This is not a ratification of prior art; it is a
silent reversal of it, and it will produce a package whose published enums do not match the enums in
the record the package cites as its evidence base.

Compounding it, `h0-run-result.schema.json:24` uses a third casing for a value the spine also uses:
`"NOT_APPLICABLE"` as a verdict, versus the spine's `not_applicable` outcome state.
`execution-inputs.yaml:4` and `:15` use the same `NOT_APPLICABLE` sentinel.

**Spine section to change:** Consistency Conventions → Data and formats (line 183). Either adopt
kebab-case and rewrite AD-6's eight outcome states and AD-17's `judge_error` accordingly, or state
explicitly that the package deliberately breaks with the experiment record's casing and say why.

---

## 2. `additionalProperties: false` on every object is incompatible with the spine's own extension story

**Severity: high.**

The spine ratifies `additionalProperties: false` (ARCHITECTURE-SPINE.md:183), and the prior art
supports it — all eight schemas set it on every object.

But the repository already recorded what that costs, and the spine has not absorbed the lesson.
`h0-run-result.schema.json:81-84` carries this description on the `note` field:

> "Added 2026-07-27: every pre-existing result record already carried this field, so under
> `additionalProperties: false` none of them validated. Declaring it is a schema correction, not a
> new convention."

That is a recorded production incident caused by exactly the convention the spine mandates, and the
spine offers no additive-extension procedure. AD-11 (ARCHITECTURE-SPINE.md:132) gives per-artifact
integer schema versions, but says nothing about whether adding an optional field is a version bump —
which is precisely the question that broke the records on 2026-07-27.

The two schemas that solved it in practice did so by *documenting the deviation inline*
(`isolation-manifest.schema.json:13`, `h0-run-result.schema.json:13`, both citing
`preregistration/h0-amendment-01-mut2.yaml`, and `h0-run-result.schema.json:36` citing
`h0-amendment-02-contract-quality.yaml`). That inline-amendment convention is real prior art with no
successor in the spine.

**Spine section to change:** AD-11, plus a new row in Consistency Conventions covering additive
schema extension.

---

## 3. `B-nnn` pattern: the spine narrows an existing pattern that deliberately allowed growth

**Severity: high.**

Consistency Conventions → Identifiers (ARCHITECTURE-SPINE.md:181): *"Behaviours are `B-001`, oracles
`O-001`, probes `P-001`, waivers `W-001`, zero-padded to three digits."*

The existing pattern is `^B-[0-9]{3,}$` — three **or more** digits — in three places:
`eval-contract.schema.json:22`, `h0-ground-truth.schema.json:20`, `h0-run-result.schema.json:38`.
The `{3,}` quantifier is not an accident; it is the same shape used for `^D-[0-9]{3,}$`
(`h0-ground-truth.schema.json:19`) and `^F-[0-9]{3,}$` (`h0-run-result.schema.json:32`).

"Zero-padded to three digits" reads as `^B-[0-9]{3}$`, which caps a contract at 999 behaviours and
rejects identifiers the existing schemas accept. Either the spine means `{3,}` and should say
"zero-padded to at least three digits", or it is a real narrowing that should be argued for.

**Spine section to change:** Consistency Conventions → Identifiers (line 181).

---

## 4. Two existing identifier namespaces are dropped: `D-nnn` and `F-nnn`

**Severity: medium.**

The spine's identifier list (ARCHITECTURE-SPINE.md:181) names `B-`, `O-`, `P-`, `W-`. The prior art
has two more:

- `defectId`, `^D-[0-9]{3,}$` — `h0-ground-truth.schema.json:19`
- `findingId`, `^F-[0-9]{3,}$` — `h0-run-result.schema.json:32`

`F-nnn` matters more than it looks. Consistency Conventions → Errors (ARCHITECTURE-SPINE.md:184)
makes "finding" a first-class concept — *"A finding is data inside an artifact and carries an outcome
state"* — but assigns it no identifier pattern, while the repository has been minting `F-001`-shaped
finding IDs across 19 scored runs. `D-nnn` is the identifier that ties a known defect to the
behaviour it violates, which is what AD-9's qualified probe needs.

**Spine section to change:** Consistency Conventions → Identifiers (line 181).

---

## 5. `findingType` — the defect / observation / confirmation distinction has no successor

**Severity: high.**

`h0-run-result.schema.json:33-36` defines `findingType` with the enum
`["defect", "observation", "confirmation"]` and this description:

> "Only `defect` findings enter the H0 precision denominator. `observation` records a non-defect API
> or evidence note. `confirmation` records evidence that a behavior holds."

This is a load-bearing measurement distinction, added by amendment
(`h0-amendment-02-contract-quality.yaml`) precisely because pooling the three corrupted the metric.
`PHASE2-RESULTS.md:38` reports against it: *"Secondary measure, defect findings per repetition: 1.67
plain, 3.44 disciplined."* And the sharpest qualitative result in the whole record depends on it —
`PHASE2-RESULTS.md:54-56` describes a run that "explicitly recorded the acceptance of a
traversal-shaped identifier as a **confirmation** that the tool handles adversarial input
gracefully", i.e. a `confirmation` that should have been a `defect`.

AD-6's eight outcome states (ARCHITECTURE-SPINE.md:102) are per-check resolutions, not finding
classifications. `passed_clean_control` is the nearest thing to `confirmation` and is not the same
concept; nothing at all corresponds to `observation`. The spine cannot reproduce the secondary metric
its own evidence base reports.

**Spine section to change:** AD-6, and the evidence artifact in the Capability → Architecture Map.

---

## 6. `artifact-ref` has no successor artifact, and Zod's exporter will dissolve it

**Severity: high.**

`artifact-ref.schema.json` is the most-reused shape in the prior art — referenced by
`h0-ground-truth.schema.json:28` and `h0-run-result.schema.json:60` and `:79` via *relative
cross-file* `$ref: "artifact-ref.schema.json"`. Its description
(`artifact-ref.schema.json:5`) states the contract exactly: *"A private artifact sets
storage=private, path=null, and supplies an opaque privateRef plus its matching digest."*

That is precisely the mechanism AD-18 (ARCHITECTURE-SPINE.md:174) requires — *"where evidence must
refer to them it stores a digest or an opaque reference"* — and AD-8 (ARCHITECTURE-SPINE.md:114) —
*"A result references a sealed set by digest and never embeds case content."* The spine names eight
artifacts (Eval Contract, sealed evaluator brief, evaluator result, isolation manifest, probe,
pre-flight verdict, evidence artifact, scoring policy) and `ArtifactRef` is none of them, so the two
ADs that depend on it have no declared shape to point at.

**Verified:** Zod 4.4.3's `toJSONSchema` inlines a reused sub-schema into `$defs` and emits
`"$ref": "#/$defs/ArtifactRef"`. Under AD-13 the cross-file `$ref` convention the eight schemas use —
and which the README records as validated (`README.md:96-97`: *"all eight schemas registered by
`$id`"* under Ajv 8.17.1 strict) — is not reproducible. Each generated file gets its own private copy
of `ArtifactRef`, and the standalone `artifact-ref.schema.json` disappears.

**Spine section to change:** AD-13 (state whether the published schema set is one file per artifact
with cross-file `$ref`, or self-contained files with duplicated `$defs`), and the artifact list.

---

## 7. Zod silently drops `if`/`then` and `contains` constraints that three existing schemas depend on

**Severity: critical.**

AD-13 (ARCHITECTURE-SPINE.md:140-144) makes Zod the source of truth and the JSON Schema a generated,
drift-checked artifact. Its stated escape hatch: *"a constraint enforceable only in a refinement is
implemented in the compiler and labelled compiler-enforced in the schema description."*

Four constraints in the prior art are currently expressed natively in JSON Schema and are therefore
enforceable by any consumer:

- `artifact-ref.schema.json:25-44` — `allOf`/`if`/`then` binding `storage: "public"` to a non-null `path` and a null `privateRef`, and the inverse for `"private"`
- `h0-ground-truth.schema.json:57-62` — `if expectedClean === true then defects.maxItems === 0`
- `h0-run-result.schema.json:97-105` — verdict restricted to `PASS|CONCERNS|FAIL` unless `condition === "scripted"`
- `eval-contract.schema.json:52` — `"contains": { "const": "original-spec" }` on `forbiddenInputs`

The last one is not incidental. AD-16 (ARCHITECTURE-SPINE.md:162) states as a rule: *"The contract's
forbidden-input list always contains the original spec."* That rule is today machine-checked by a
JSON Schema `contains` keyword.

**Verified:** Zod 4.4.3's `toJSONSchema` does **not** throw or warn on a `.refine()`; it silently
emits a schema with the constraint absent. `unrepresentable: 'any'` changes nothing. So AD-13's
prevention clause — *"a constraint that exists only as a Zod refinement being believed by a
non-TypeScript consumer who cannot see it"* — describes the exact default behaviour of the tool the
spine selects, and the drift check AD-13 mandates will pass happily on a schema that has lost the
constraint, because it compares committed output against regenerated output, not against intent.

Migrating to Zod as written converts four machine-checkable constraints into prose descriptions, and
AD-16 loses its only current enforcement.

**Spine section to change:** AD-13. It needs either a mandated post-generation constraint-injection
step with a fixture-based test that a rejected input is actually rejected by the *published* schema,
or a rule that any constraint of this class stays hand-authored.

---

## 8. `h0-run-result` — the actual sealed-run record — has no successor

**Severity: high.**

`h0-run-result.schema.json` is the record that carried the 19 scored runs. Its required fields
(`:86-96`) are `runId`, `taskId`, `condition`, `verdict`, `findings`, `actionsArtifact`,
`resourceUse`, `isolationManifestArtifact`, `invalidReason`.

The spine's "evaluator result" maps to `evaluator-result.schema.json`, not to this. Concretely lost:

- `resourceUse` (`:61-78`) — `toolCalls`, `inputTokens`, `outputTokens`, `wallClockSeconds`, `costUsd`. See finding 11.
- `invalidReason` (`:80`, `["string","null"]`) — the field that records *why* a run was invalidated. AD-6 (ARCHITECTURE-SPINE.md:102) requires invalidation on `infrastructure_error` or failed pre-flight but declares no field to carry the reason. `isolation-manifest.schema.json:68` has the equivalent `violation` field and the spine keeps that one; the run-level twin is dropped.
- `actionsArtifact` (`:60`) — the pointer to the run's action log. Real files exist: `results/raw/cc-h0-03-independent-mut2-actions.md`, `cc-h0-03-self-mut2-actions.md`, `cc-h0-03-self-review-mut2-actions.md`.
- `condition` (`:14-20`, `deterministic|scripted|self|self-review|independent`) — the arm label that makes a paired comparison a paired comparison. The spine has no notion of an experimental arm.

**Spine section to change:** the artifact list and the evidence artifact under VFR-5 in the
Capability → Architecture Map.

---

## 9. `trace-label` and `rubric.md` have no successor, yet the Deferred list depends on them

**Severity: high.**

`trace-label.schema.json` defines the human/adjudicated label shape: `claims[]` with
`grounded|unsupported|contradicted|not-checkable` (`:21`), `acceptedCheckpoints[]` with dependency
edges (`:29-44`), `firstMaterialErrorStepId` (`:45`), `pathSound`, `outcomeCorrect`,
`evidenceCorrect`. `rubric.md` is its (placeholder) companion.

The spine's Deferred list (ARCHITECTURE-SPINE.md:247) says: *"Judge calibration against human
agreement baselines. ... the adjudicated labels from both rounds are its seed data."* The spine
therefore explicitly plans to consume `trace-label` records and names no artifact, no schema, and no
owner for them.

Separately, AD-17 (ARCHITECTURE-SPINE.md:168) mandates *"One judge call scores all named rubric
criteria"* and *"Rubrics are self-contained"* — making a rubric a required input to the judge port —
but "rubric" is not in the spine's artifact set and has no schema. `rubric.md:10-16` already
enumerates the fields it will need.

**Spine section to change:** the artifact list, AD-17, and the Deferred entry at line 247.

---

## 10. `private-evidence-manifest` has no successor, and it is live configuration

**Severity: high.**

`private-evidence-manifest.schema.json` and its instance
`experiments/hypothesis-validation/private-evidence-manifest.json` are the public-safe index of
private artifacts. `execution-inputs.yaml:79-83` is live config pointing at it:

```text
privateEvidence:
  storage: outside-public-repository
  manifestRef: "~/opensource/eval-quality-private-experiment/artifact-index.json"
  manifestDigest: null
  sanitizationPolicy: "Strip any real person name, email, customer/account ID, ..."
```

AD-8 (ARCHITECTURE-SPINE.md:110-114) requires sealed sets to resolve "through the corpus-provider
port from a caller-owned location outside the repository", and AD-18 requires digests or opaque
references. Neither declares the index that maps opaque reference to digest to artifact type — which
is what this schema is. The `artifactType` enum
(`private-evidence-manifest.schema.json:20-29`) is the existing taxonomy of private artifact kinds and
disappears with it.

Note also `sanitizationPolicy` is a *recorded policy string* in the prior art, whereas AD-18 states
the same rule only in prose. The spine's "scoring policy" artifact is the natural home and does not
mention sanitization.

**Spine section to change:** AD-8, AD-18, and the scoring-policy artifact definition.

---

## 11. Budgets and resource accounting exist in three places in the prior art and nowhere in the spine

**Severity: high.**

`budgets` is a **required** top-level field of the Eval Contract
(`eval-contract.schema.json:63-72`, required at `:97`): `maxToolCalls`, `maxWallClockMinutes`,
`maxCostUsd`. The isolation manifest requires both `resourceCeilings` and `actualResourceUse`
(`isolation-manifest.schema.json:32-67`, required at `:83-85`), each with five fields.
`execution-inputs.yaml:68-73` sets them for the real runs.
`PHASE2-RESULTS.md:35` reports "equal model, budget" as a controlled variable.

The spine's Eval Contract has no budget concept, and AD-2 (ARCHITECTURE-SPINE.md:78) removes
execution from the package — which explains why nobody is spending the budget, but not why the
contract stops *declaring* it. The caller executes; the caller needs the ceiling; the sealed brief is
the only channel. AD-16 (ARCHITECTURE-SPINE.md:162) lists the brief's contents as *"the contract,
scoped resource references, and permitted interfaces only"* — budgets are not in that list, so as
written the brief cannot carry them.

Meanwhile the isolation manifest, which the spine does keep, *requires* `resourceCeilings` and
`actualResourceUse`. So the caller must report resource use against a ceiling the brief never
transmitted.

**Spine section to change:** AD-16 (brief contents) and the Eval Contract definition.

---

## 12. Severity is required in four existing schemas and absent from the spine

**Severity: medium.**

`severity` with enum `["low","material","critical"]` is a required field in:
`eval-contract.schema.json:25-28` (per observable behaviour, required at `:30`),
`h0-ground-truth.schema.json:22-25` (per defect), `h0-run-result.schema.json:39-42` (per finding).
`trace-label.schema.json:48-51` uses a four-value variant, `["none","low","material","critical"]`.

The spine never mentions severity except to forbid weighting it: AD-7 (ARCHITECTURE-SPINE.md:108)
*"No weighting, no percentage, no severity-weighted composite anywhere in the artifact"*, and Deferred
(ARCHITECTURE-SPINE.md:245) *"Any single-number contract strength score, including severity
weighting."* Both sentences presuppose severity exists as recorded data. No artifact declares it.

The existing three-value/four-value split is itself an unresolved inconsistency the spine could have
settled and did not.

**Spine section to change:** AD-7, and the Eval Contract and evidence artifact definitions.

---

## 13. `expectedClean` / clean-control ground truth has no declared shape, yet AD-7 gates on it

**Severity: medium.**

AD-7 (ARCHITECTURE-SPINE.md:108) makes clean controls a gate condition: *"The gate verdict derives
only from the hard rules in AD-6 plus zero `false_positive` on clean controls."* AD-6 has a
`passed_clean_control` outcome state.

The prior art's clean-control ground truth is `h0-ground-truth.schema.json` — `expectedClean`
(`:12`), `expectedGate` (`:45`), and the conditional at `:57-62` forcing `defects` empty when
`expectedClean` is true. This is the schema whose gate failed in round 2
(`PHASE2-RESULTS.md:46`: *"Gate 3. Zero false FAIL from the disciplined arm on fixed-code controls —
FAIL, 1 of 1 control"*), so it is the single most operationally important schema in the record.

AD-9 (ARCHITECTURE-SPINE.md:120) describes probe qualification in terms the existing schema does not
carry — "recorded fail-before and pass-after evidence", "baseline pass, mutated fail, and verified
rollback", "source and operator, target artifact, expected observable failure". `h0-ground-truth` has
only `source: natural|controlled-mutation` (`:30-33`) and `oracleEvidence: ArtifactRef[]` (`:26-29`).
AD-9 is a genuine improvement, but it is written as if from scratch rather than as an extension, and
the spine's "probe" artifact does not say it is `H0GroundTruth`'s successor.

**Spine section to change:** AD-9, and the probe artifact definition.

---

## 14. `evaluator-result` maps onto the spine's "evaluator result" by name but not by content

**Severity: medium.**

`evaluator-result.schema.json:5` describes itself as *"One semantic-prototype evaluator's verdict for
one confirmatory corpus case"* and its `evaluator` enum (`:12-18`) is the four Phase C semantic
prototypes: `claim-evidence`, `semantic-checkpoints`, `process-outcome`, `first-material-error`. Its
fields are `stepIds`, `evidenceStepIds`, `confidence`, `rationale` — trace-oriented.

The spine's "evaluator result" (ARCHITECTURE-SPINE.md:39, 232) is the output of a sealed evaluator
executing against a system under test — which is `h0-run-result`, not this. The name collision will
mislead anyone reading both documents, and it disguises finding 8 (that `h0-run-result` is lost).

Note that `evaluator-result`'s own content belongs to the Phase C work the spine defers
(ARCHITECTURE-SPINE.md:246), and the README confirms Phase C never ran
(`experiments/hypothesis-validation/README.md:64-68`). Deferring it is right; reusing its name for a
different thing is not.

**Spine section to change:** the artifact list and the Design Paradigm diagram (line 39).

---

## 15. AD-11's per-artifact schema version is followed by only two of eight existing schemas, under two different field names

**Severity: medium.**

AD-11 (ARCHITECTURE-SPINE.md:132): *"per-artifact integer schema versions govern artifact shape."*

Prior art: `eval-contract.schema.json:9` has `"contractVersion": { "const": 1 }`;
`private-evidence-manifest.schema.json:9` has `"manifestVersion": { "const": 1 }`. The other six —
`evaluator-result`, `isolation-manifest`, `h0-ground-truth`, `h0-run-result`, `trace-label`,
`artifact-ref` — carry no version field at all.

So AD-11 mandates a convention that two-eighths of the prior art follows, and the two that do follow
it disagree on the field name (`<artifact>Version` vs `<noun>Version`, and neither is
`schemaVersion`). The spine names no field-naming rule, so the generator will have to invent one.

**Spine section to change:** AD-11, plus a Consistency Conventions row for the version field name.

---

## 16. TypeScript 7.0.2 removes `baseUrl`; `npm run typecheck` and `npm run build` both fail today

**Severity: critical.**

Stack table (ARCHITECTURE-SPINE.md:195) pins TypeScript 7.0.2. `package.json:71` has `"typescript":
"^5.9.3"`.

**Verified** — installing TypeScript 7.0.2 against the repository's actual `tsconfig.json` and
`tsconfig-build.json`:

```text
tsconfig.json(8,3): error TS5102: Option 'baseUrl' has been removed. Please remove it from your
  configuration.
  Use '"paths": {"*": ["./*"]}' instead.
```

`npm run typecheck` exits 1, `npm run build` exits 2. The offending line is `tsconfig.json:8`,
`"baseUrl": "./"`, inherited by `tsconfig-build.json:2` via `extends`. `pr-checks.yml:24-31` runs
both, so PR CI goes red on the version bump alone.

**Verified fix and verified clean afterwards:** deleting `tsconfig.json:8` is sufficient. With
`baseUrl` removed, TypeScript 7.0.2 typechecks and builds this repository with exit 0 and emits
`dist/index.js` and `dist/index.d.ts`. Every other option in both tsconfigs is accepted, including
`moduleResolution: "Bundler"` (`:7`), `allowImportingTsExtensions` (`:10`),
`rewriteRelativeImportExtensions` (`tsconfig-build.json:8`), `noUncheckedIndexedAccess` (`:19`), and
`skipDefaultLibCheck` (`:21`). No `paths` replacement is needed — nothing in `src/` or `tests/` uses a
non-relative internal import.

**Also verified:** Vitest 4.1.10 runs `tests/index.test.ts` unchanged (1 file, 1 test, passing),
including its extensioned `import { VERSION } from '../src/index.ts'` (`tests/index.test.ts:2`).

**Spine section to change:** none required for the pin itself, but the Stack table should record that
the TypeScript 7 move is gated on removing `baseUrl` from `tsconfig.json:8`.

---

## 17. `.npmrc` `min-release-age=7` makes two of the spine's five pins uninstallable today

**Severity: critical.**

`.npmrc:9` sets `min-release-age=7`, which blocks any package version published within the last seven
days. Attempting `@biomejs/biome@2.5.6` inside this repository fails:

```text
npm error code ETARGET
npm error notarget No matching version found for @biomejs/biome@2.5.6 with a date before
  7/22/2026, 10:08:06 AM.
```

Publish timestamps against today, 2026-07-29:

| Pin | Published | Installable now? |
| --- | --- | --- |
| `typescript@7.0.2` | 2026-07-08 | yes |
| `zod@4.4.3` | 2026-05-04 | yes |
| `vitest@4.1.10` | 2026-07-06 | yes |
| `@biomejs/biome@2.5.6` | 2026-07-28 | **no**, unblocks 2026-08-04 |
| `@types/node@26.1.2` | 2026-07-27 | **no**, unblocks 2026-08-03 |

`npm ci` in `pr-checks.yml:19` and `publish.yml:48` runs with the repository `.npmrc`, so this is a
CI failure, not just a local one. The two blocked pins are also the two the spine has the weakest
reason to pin at the bleeding edge.

**Spine section to change:** Stack table (lines 198-199). Either drop back one patch on Biome and one
minor on `@types/node`, or state the pin is contingent on the `.npmrc` release-age window.

---

## 18. `@types/node` 26 against a Node 22 floor and a Node 24 dev runtime

**Severity: high.**

The Stack table pins three mutually inconsistent Node facts:

- runtime floor `>=22` (ARCHITECTURE-SPINE.md:193)
- development and CI `24` (line 194)
- `@types/node` `26.1.2` (line 199)

`@types/node@26.x` describes the Node 26 API surface. Typechecking against it while the declared floor
is Node 22 means `tsc` will accept calls to APIs that do not exist on Node 22 or Node 24, and the
package will ship a type surface it cannot honour at its own stated minimum. `.nvmrc:1` is `24`, so
even the development runtime is two majors behind the types.

The current `package.json:67` value, `"@types/node": "^22.10.0"`, is correctly aligned to a Node 22
floor. The spine's change makes this worse, not better.

**Spine section to change:** Stack table line 199. Pin `@types/node` to the major matching the
declared floor (22.x), or raise the floor.

---

## 19. Node engines floor: `>=20` must become `>=22`, and nothing currently enforces it

**Severity: medium.**

`package.json:47-49` declares `"engines": { "node": ">=20" }`. The spine's floor is `>=22`
(ARCHITECTURE-SPINE.md:193). `.nvmrc:1` is `24` and matches the spine's dev/CI row, and both
`pr-checks.yml:15` and `publish.yml:43` use `node-version-file: ".nvmrc"` — so CI tests only on 24 and
would never catch a Node 22 regression at the floor.

**Concretely required:** change `package.json:49` to `">=22"`, and note that the floor is asserted but
untested. `CONTRIBUTING.md:9` says only "Node.js (version specified in `.nvmrc`)" and needs no change.

**Spine section to change:** the Deployment paragraph (line 225) should either commit to a matrix
build at the floor or state that the floor is a declaration rather than a tested guarantee.

---

## 20. Zod is not a dependency; `package.json` has no `dependencies` key at all

**Severity: medium.**

ARCHITECTURE-SPINE.md:204: *"Zod is the only runtime dependency."* `package.json:65-73` contains only
`devDependencies`. There is no `dependencies` block.

**Concretely required:** add `"dependencies": { "zod": "4.4.3" }`. Note `.npmrc:12` sets
`save-exact=true`, so it will be pinned exactly — consistent with the spine's exact pins but
inconsistent with the seven existing `^`-ranged devDependencies, which nobody has reconciled.

Also unlisted in the Stack table but present and load-bearing: `marked@18.0.7` (`package.json:70`,
consumed by `scripts/build-shareable.mjs:13`), `husky@^9.1.7`, `lint-staged@^16.4.0`. The spine's
*"Everything else is a development dependency"* is true but the table reads as exhaustive and is not.

---

## 21. `biome.json` `$schema` is pinned to 2.5.4 and will not match a 2.5.6 install

**Severity: low.**

`biome.json:2` is `"https://biomejs.dev/schemas/2.5.4/schema.json"` while `package.json:66` allows
`^2.3.13` and the spine pins 2.5.6 (ARCHITECTURE-SPINE.md:198). Bumping the dependency without
bumping the `$schema` URL leaves editors validating against a stale schema. Cosmetic, but it is a
one-line change that goes with the pin.

---

## 22. A committed root `schemas/` directory will be reformatted by Biome and will fight AD-13's drift check

**Severity: high.**

Structural Seed (ARCHITECTURE-SPINE.md:221): `schemas/  # generated JSON Schema, committed,
drift-checked in CI`. Also `corpus/dev/` at line 222.

`biome.json:9-21` lists the excluded paths. `experiments` is excluded (`:20`) — which is why the eight
hand-written schemas survive byte-for-byte, and `experiments/hypothesis-validation/README.md:103-106`
records exactly why that matters:

> "`biome.json` excludes `experiments/` entirely from formatting. Byte-level formatting changes to the
> Eval Contracts, labels, raw results, isolation manifests, and the digest-recorded H0 ground-truth
> schema would invalidate their recorded SHA-256 values."

A new root-level `schemas/` and `corpus/` are **not** in that exclude list, so `biome check .`
(`package.json:55`, run by `pr-checks.yml:22`) will format them, with `indentStyle: "tab"`
(`biome.json:25`). AD-13's drift check compares the committed file against a fresh generation. Unless
the generator emits tab-indented JSON with Biome's exact trailing-newline and key-ordering behaviour,
lint and drift check will disagree permanently, and each will "fix" what the other broke.

The digest problem compounds it: AD-11 (ARCHITECTURE-SPINE.md:132) makes the scoring version a tuple
of digests, and AD-13 commits a formatter-owned file into that dependency chain. The experiment record
already learned this lesson once.

**Spine section to change:** AD-13 and the Structural Seed. State the byte-exact serialization the
generator produces and add `schemas/` and `corpus/` to the Biome exclude list, or make Biome the
formatter of record and have the drift check compare post-format output.

---

## 23. AD-13's drift check does not exist, and `check:docs` exists but CI never runs it

**Severity: high.**

AD-13 (ARCHITECTURE-SPINE.md:144): *"continuous integration fails when the committed schema differs
from a fresh generation."* ARCHITECTURE-SPINE.md:225 asserts CI runs *"using the existing `pr-checks`
and `publish` workflows."*

`.github/workflows/pr-checks.yml:21-31` runs exactly four steps: Lint, Typecheck, Test, Build. There
is no drift check and no script to invoke — `scripts/` contains only `build-shareable.mjs`,
`check-docs.mjs`, and `shareable-template.css`. The spine treats "the existing workflows" as
sufficient when AD-13 requires a fifth step and a new script that does not exist.

Separately and independently: `package.json:62` defines
`"validate": "npm run typecheck && npm run lint && npm run check:docs && npm run test"`, and
`README.md:148` advertises `npm run validate  # typecheck + lint + docs check + test`. But
`pr-checks.yml` never calls `validate` and never calls `check:docs`. So `scripts/check-docs.mjs` —
which enforces frontmatter structure and whitespace across `_bmad-output/planning-artifacts`
(`check-docs.mjs:9-14`), including the spine itself — is enforced only by whoever remembers to run it
locally. `CONTRIBUTING.md:27` compounds the confusion by describing `validate` as "typecheck + lint +
test", omitting the docs check.

**Concretely required:** add a `check:schemas` (or equivalent) step and script, and either add
`check:docs` to `pr-checks.yml` or replace the four steps with `npm run validate`.

**Spine section to change:** AD-13 and the Deployment paragraph (line 225).

---

## 24. `src/index.ts` documents a module set that AD-2 forbids, and `package.json` describes the package the same way

**Severity: high.**

`src/index.ts` is the only file under `src/`. It contains no code the spine's tree conflicts with —
one export, `VERSION` (`:14`) — but its committed barrel comment (`:3-9`) names a completely different
architecture:

```text
//   runner      - drive an agent (provider-agnostic) and capture the transcript
//   assertions  - the Expect.* DSL (tool calls, sequence, params, performance)
//   graders     - deterministic-first, judge-second pipeline; pass@k aggregation
//   trajectory  - the differentiator: faithfulness / grounding / path quality /
//                 process-vs-outcome judging / reference-trajectory scoring
//   reporting   - evidence artifacts (summary + machine-readable result)
```

`runner - drive an agent` is precisely what AD-2 (ARCHITECTURE-SPINE.md:74-78) prohibits:
*"eval-quality never executes an evaluator, an agent, a judge, or the system under test."* None of
the six named modules corresponds to any of the spine's seven `core/` stages (`compile`, `seal`,
`ingest`, `preflight`, `score`, `emit`).

The same framing is in the published metadata: `package.json:4` describes the package as *"A
provider-agnostic harness that scores an agent's trajectory"* and `package.json:12-24` lists keywords
including `llm-as-judge`, `trajectory`, `agent-eval`. "Harness" and "llm-as-judge" describe a package
that runs things; AD-2 and AD-15 describe one that does not.

`README.md:111` has the same problem in the user-facing docs: `eval-quality score  # seed known
defects, report per-oracle outcomes`. Seeding a defect is a write to the system under test, which
AD-1 (ARCHITECTURE-SPINE.md:72) forbids the core from doing and AD-2 places outside the package.

Nobody has noticed these, and they are the first thing a reader of the repository sees.

**Spine section to change:** none — the spine is right and the repository is stale. But the spine's
Structural Seed should state that `src/index.ts`'s barrel comment and `package.json`'s description and
keywords are superseded, so the contradiction is closed rather than left standing.

---

## 25. `package.json` cannot ship AD-14's CLI or AD-13's published schema

**Severity: high.**

Three concrete gaps against the spine's delivery claim (*"The unit of delivery is one npm package
containing the library and the CLI"*, ARCHITECTURE-SPINE.md:225):

- **No `bin`.** `package.json` has no `bin` field. AD-14 (ARCHITECTURE-SPINE.md:146-150) requires a command surface, and `README.md:108-112` already documents `eval-quality compile|preflight|score`. Without `bin`, none of it is reachable after install.
- **`files` excludes the schemas.** `package.json:25-29` is `["dist", "README.md", "LICENSE"]`. AD-13 calls the JSON Schema the *published* artifact and the Structural Seed puts it at root `schemas/`; it will not be in the tarball. Same for `corpus/dev/`, which AD-8 says the repository ships as the visible development set.
- **`exports` has one entry.** `package.json:30-35` exports only `"."`. A consumer wanting the raw JSON Schema (the whole point of AD-13's non-TypeScript consumer) has no subpath to import it from.

---

## 26. AD-18 as written is contradicted by a committed file, and nothing blocks the publish the spine says is blocked

**Severity: medium (AD-18 scope), high (publish).**

**AD-18 scope.** ARCHITECTURE-SPINE.md:174: *"Credentials, tokens, real names, email addresses,
account identifiers, and transaction content are excluded ... This binds example artifacts and test
fixtures as strictly as real runs."* `experiments/hypothesis-validation/execution-inputs.yaml:16`
contains a literal credentialled connection string:

```text
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

plus real filesystem paths at `:11` (`~/opensource/couture-cast`) and `:81`
(`~/opensource/eval-quality-private-experiment/artifact-index.json`), and a real commit SHA at `:12`.
`.gitleaks.toml:14-18` allowlists only `package-lock.json`, `dist/`, and `coverage/`, so this file is
scanned and currently passes — the value is a local default and gitleaks does not flag it. The point
is that AD-18's "binds ... as strictly as real runs" sweeps in a closed experiment record it was
probably never meant to govern, and as written it declares a committed file a defect. Scope AD-18 to
package artifacts and published examples, or exempt the experiment tree explicitly.

**Publish.** ARCHITECTURE-SPINE.md:225: *"Publication to npm stays blocked until the work-related
intellectual-property question is resolved in writing."* Nothing in the repository implements that
block. `package.json:7` is `"private": false`; `package.json:44-46` sets
`publishConfig.access: "public"`; `.github/workflows/publish.yml:8-9` is a `workflow_dispatch` on
`main` that runs `npm publish --access public` (`:104`) and then verifies against npmjs.org (`:112`).
One person clicking "Run workflow" publishes the package the spine says must not be published. The
spine states a constraint and the repository actively contradicts it with a one-click path.

**Concretely required:** set `"private": true` until the IP question is resolved, or add an explicit
guard step to `publish.yml`. `"private": true` would also disable `publishConfig`, so the guard is the
lower-friction option if the pipeline must stay warm.

**Spine section to change:** AD-18 (scope sentence, line 174) and the Deployment paragraph (line 225,
which should name the enforcement mechanism rather than state the policy).
