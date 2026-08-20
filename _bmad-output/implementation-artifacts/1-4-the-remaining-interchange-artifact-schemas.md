---
baseline_commit: f76ad86
---

# Story 1.4: The remaining interchange artifact schemas

Status: review

## Story

As an adopter producing or consuming eval-quality artifacts,
I want every interchange artifact in the inventory defined in Zod with its lineage and prior-art correspondence declared,
so that the caller-facing boundary is fully typed before any pipeline stage exists.

## Acceptance Criteria

### AC 1 — Twelve artifacts, one registry, and nothing generated

The eleven remaining interchange artifacts are defined once in Zod 4.4.3 under `src/core/schemas/`, in `kebab-case.ts` files, one artifact per file, exported as PascalCase nouns matching the schema title. The Structural Seed's inventory is the closed list and it is twelve.

The registry is the data behind AC 3's prior-art test and AC 17's ledger generation, so it carries more than the schema:

```ts
// src/core/schemas/artifact.ts — a pure consumer. It imports the twelve and
// nothing imports it. See AC 2: the lineage spelling must NOT live here.
export const INTERCHANGE_ARTIFACTS = {
  'eval-contract':            { schema: EvalContract,           priorArt: 'eval-contract',             carriesLineage: true  },
  rubric:                     { schema: Rubric,                 priorArt: null,                        carriesLineage: true  },
  'sealed-evaluator-brief':   { schema: SealedEvaluatorBrief,   priorArt: null,                        carriesLineage: true  },
  'sealed-run-record':        { schema: SealedRunRecord,        priorArt: 'h0-run-result',             carriesLineage: true  },
  'isolation-manifest':       { schema: IsolationManifest,      priorArt: 'isolation-manifest',        carriesLineage: true  },
  'evaluator-configuration':  { schema: EvaluatorConfiguration, priorArt: null,                        carriesLineage: true  },
  probe:                      { schema: Probe,                  priorArt: 'h0-ground-truth',           carriesLineage: true  },
  'artifact-reference':       { schema: ArtifactReference,      priorArt: 'artifact-ref',              carriesLineage: false },
  'private-artifact-manifest':{ schema: PrivateArtifactManifest,priorArt: 'private-evidence-manifest', carriesLineage: true  },
  'preflight-verdict':        { schema: PreflightVerdict,       priorArt: null,                        carriesLineage: true  },
  'scoring-policy':           { schema: ScoringPolicy,          priorArt: null,                        carriesLineage: true  },
  'evidence-artifact':        { schema: EvidenceArtifact,       priorArt: null,                        carriesLineage: true  },
} as const
```

File names are the registry keys plus `.ts`; `eval-contract.ts` and `rubric.ts` already exist and are extended rather than replaced. A test asserts the registry has exactly twelve entries and that its key set equals a hand-written list transcribed from the Structural Seed. Story 1.5 walks this registry to decide what to export; it authors no second list, exactly as it consumes `CONSTRAINT_LEDGER` rather than re-deriving it.

`priorArt` has exactly six non-null values matching the Structural Seed's six correspondences. `artifact.ts` also exports the absence phrase as a constant:

```ts
export const NO_PRIOR_ART = 'no prior art'   // wording is the author's; the constant is the contract
```

so AC 3's test checks a null-`priorArt` description against one exported string rather than hard-coding six phrases in the test file, which would be the second list the registry exists to prevent.

**`carriesLineage` is verified against the schemas, not merely counted.** A count assertion catches a flag flipped to `true` on an artifact with no `parentDigest` only because AC 17's resolution test fails downstream; it catches a flag flipped to `false` on an artifact that does carry lineage nowhere at all — no entry is generated, nothing is missing from any list anyone checks, and the constraint silently leaves the ledger. So the test computes the flag from each schema and asserts the literal equals it:

```ts
const branchShapes = (s) => ('shape' in s ? [s.shape] : s.options.map((o) => o.shape))
const computed = (s) => branchShapes(s).every((shape) => shape.parentDigest !== undefined)
```

Every branch, not the first: a union whose branches disagree about lineage is itself a defect this catches.

This story writes **no** JSON Schema generator, creates **no** top-level `schemas/` directory, and adds **no** CI check beyond the existing `npm run validate` chain. It creates no `core/compile/`, `core/seal/`, `core/ingest/`, `core/score/`, `core/emit/`, `ports/`, `adapters/`, or `corpus/dev/`. It does not touch `src/index.ts`: the public barrel is Epic 6's. Zero new runtime dependencies.

The rule Story 1.3 worked under holds: **prefer native, exportable Zod constructs over refinements wherever a native construct exists.** `.refine()` and `.check()` are silently dropped from `z.toJSONSchema`; `.describe()` and `.meta({ description })` survive.

### AC 2 — Lineage and artifact version, spelled once, in a leaf module

AD-11 requires an integer `schemaVersion` under that exact name on every artifact. AD-29 requires a parent digest and a revision count, owned by the producing stage and set by no other.

`EvalContract` already spells all three flat at its root. A second spelling is the drift the Conventions exist to prevent, so the three fields are lifted into one exported object literal and **spread** into the eleven strict objects that carry lineage:

```ts
// src/core/schemas/lineage.ts — a LEAF module. It imports zod and primitives.ts
// and nothing else, and it must not be merged into artifact.ts.
export const lineageFields = {
  schemaVersion: z.int().min(1).describe(/* AD-11 … */),
  parentDigest: Digest.nullable().describe(/* AD-29 … */),
  revisionCount: z.int().min(0).describe(/* AD-29 … */),
}
```

**The lineage spelling must not live in the same module as the registry.** `artifact.ts` imports twelve schema modules to build `INTERCHANGE_ARTIFACTS`, and every one of those modules imports the lineage spelling. Putting both in one file is an import cycle that fails at module load with `ReferenceError: Cannot access 'X' before initialization` — a temporal-dead-zone error with no visible connection to this story, thrown by whichever artifact module a test imports first. A leaf module for the fields and a pure consumer for the registry keeps the graph acyclic.

Spread rather than nested, for two reasons that are both load-bearing. Nesting would change `EvalContract`'s shape and invalidate the Story 1.3 reject fixtures that name `['schemaVersion']` and `['parentDigest']` as issue paths. And AD-13 requires each exported file to be self-contained with shared shapes duplicated into local definitions, so a nested `$defs` entry shared across eleven files buys nothing the export can keep.

**Two of the eleven lineage-bearing artifacts have discriminated-union roots** — `Probe` (on `expectedClean`) and `EvidenceArtifact` (on `mode`). The spread lands **inside every branch**, not at the union level; a union has no property bag to spread into and the attempt is a type error. (`ArtifactReference` is union-rooted too, on `storage`, but carries no lineage — three of the twelve are unions, two of the eleven.) That the spread lands per branch is what forces AC 17's union-aware ledger address.

`eval-contract.ts` is refactored to use the spread. **The three existing field descriptions move verbatim** — including the `z.literal(1)` rationale and the `parentDigest`/`revisionCount` biconditional sentence — because they are published constraint statements and rewriting them changes the export bytes. The exported JSON Schema must be unchanged by this refactor, and **no Story 1.3 test may need editing to accommodate it.** That rule is scoped to the lineage spread alone; AC 16 lists five assertions that other parts of this story do change deliberately.

`schemaVersion` is `z.int().min(1)` and never `z.literal(1)`, for the reason already recorded on `EvalContract`.

Artifact **identity** is not shared and is not part of this shape. `EvalContract`, `SealedRunRecord`, `IsolationManifest`, `Probe`, `ScoringPolicy`, `PreflightVerdict`, `EvidenceArtifact`, and `Rubric` name themselves in their own vocabulary. **`SealedEvaluatorBrief`, `EvaluatorConfiguration`, and `PrivateArtifactManifest` deliberately carry no identity field**: every artifact that refers to them does so by digest (`sealedBriefDigest`, `evaluatorConfigurationDigest`, and AD-8's resolve-by-digest), so an identifier would be a second name nothing reads. Say so in each description.

### AC 3 — Prior-art correspondence, per AD-24

Every artifact carries an artifact-level `.meta({ id, description })` at the end of its chain. The description names either the prior-art schema it succeeds or an explicit absence of prior art. Verified on the pin: `.meta({ id, description })` on a `z.discriminatedUnion` exports as `{ $schema, oneOf, description }`, so the root description survives for the three union-rooted artifacts too.

A test walks `INTERCHANGE_ARTIFACTS` and asserts, for each entry, that the exported root `description` is non-empty and contains `priorArt` where it is non-null, or the exported `NO_PRIOR_ART` constant where it is null. A description that merely restates the title fails the intent of AD-24 and fails this test.

Where a successor **diverges** from its prior art, the divergence is named in the field's own description. **The table's inclusion rule: renames, drops, and the two additions an AD commands by name.** A field this story adds because an AD independently requires it — `trialIndex`, `oracleDispositions`, `observations`, `judgeResults`, `evidenceDisclosure`, per-finding `confidence` and `observationIds` and `quotedEvidence` and `findingType`, the probe's root-level `behaviorId`, `artifactDigest`, and `commitDigest`, and every lineage field — is documented in its own description against the AD that commands it, not here. A dev auditing this table against the prior art will find roughly a dozen unlisted additions; they are not oversights, and this sentence is why.

| Divergence | Artifact | Where recorded |
| --- | --- | --- |
| `sha256` → `digest` | ArtifactReference, PrivateArtifactManifest entries | Decision 3 |
| `manifestVersion: const 1` → `schemaVersion` | PrivateArtifactManifest | AC 4 |
| `artifactType` → `artifactKind` (members ratified unchanged) | PrivateArtifactManifest | AC 4 |
| `sanitizationPolicy` added | PrivateArtifactManifest | Decision 8 |
| `condition` enum → opaque `conditionArm` | SealedRunRecord, IsolationManifest | Decision 4 |
| `verdict` → `evaluatorRecommendation`, `NOT_APPLICABLE` dropped | SealedRunRecord | Decision 5 |
| `taskId` dropped | SealedRunRecord, Probe | AC 5, AC 8 |
| `taskId` → `contractId` | IsolationManifest | Decision 7 |
| `note` dropped | SealedRunRecord | AC 5 |
| `actionIds` dropped | SealedRunRecord findings | AC 5 |
| `evaluatorConfigurationDigest` added | SealedRunRecord, IsolationManifest | Decision 6 |
| money as string, not number | SealedRunRecord, IsolationManifest | Decision 9 |
| `implementationSha` → `implementationDigest` | Probe | AC 8 |
| `expectedGate` dropped | Probe | Decision 10 |

### AC 4 — Artifact Reference and Private Artifact Manifest

**`ArtifactReference`** succeeds `artifact-ref`, whose four fields carry two `if`/`then` branches. AD-13 is explicit: *"Conditional prior-art constraints are re-expressed as discriminated unions, which changes the published shape from `if`/`then` to `oneOf`; that restructuring is expected, not a surprise mid-epic."* So:

```ts
export const ArtifactReference = z.discriminatedUnion('storage', [
  z.strictObject({ storage: z.literal('public'),  path: z.string().min(1), privateRef: z.null(),            digest: Digest }),
  z.strictObject({ storage: z.literal('private'), path: z.null(),          privateRef: z.string().min(1),   digest: Digest }),
])
```

Both branches keep every prior-art key so the correspondence is readable, and `z.null()` on the inapplicable member preserves the explicit-`null` convention rather than omitting the key.

`ArtifactReference` carries **no lineage and no `schemaVersion`** (Decision 12), which is why its registry entry is the one `carriesLineage: false`. The exemption is named in its description and asserted by a test.

**`PrivateArtifactManifest`** succeeds `private-evidence-manifest`. Entries carry `privateRef` (opaque, `.min(1)`), `digest`, `artifactKind` (the prior art's eight members, ratified unchanged), `publicSafeRunId` (nullable), and `sanitizationPolicy` (Decision 8). The manifest carries `schemaVersion` in place of the prior art's `manifestVersion: const 1`, plus AC 2's lineage.

AD-8's *"a manifest digest is never a trusted label"* is not a schema constraint and must not become one: the core recomputes digests from resolved bytes and a mismatch is an AD-28 `digest-mismatch` fault. Record it in the description, enforce nothing.

AD-18 binds this artifact hardest: it *"never contains a private path, credential, or domain value."* Unenforceable in a schema over opaque strings. State it in the description and record it in the ledger as not expressible.

### AC 5 — The Sealed Run Record

Succeeds `h0-run-result`. AD-24 fixes the carry-over list: *"keeps its run identifier, condition arm — retained as an opaque caller label with no product semantics — findings, action-log reference, resource use, invalidation reason, evaluator recommendation as a closed enum, and per-finding confidence on a declared scale."*

**Record level.** `runId` (opaque caller string, per the Conventions), `conditionArm` (opaque string, **not** the prior art's five-member enum — AD-24 demotes it), `trialIndex` (Decision 13), `contractDigest`, `sealedBriefDigest`, `evaluatorConfigurationDigest` (Decision 6), `evaluatorRecommendation` (Decision 5), `oracleDispositions`, `findings`, `observations`, `judgeResults`, `actionsArtifact` (`ArtifactReference`), `isolationManifestArtifact` (`ArtifactReference`), `resourceUse`, `evidenceDisclosure`, `invalidReason` (nullable), plus AC 2's lineage. The prior art's `taskId` and `note` do not survive: the contract is pinned by `contractDigest`, and an unstructured orchestrator annotation is the free-prose channel the Conventions close everywhere else.

**Findings are a discriminated union on `findingType`.** AD-23 requires that *"every `defect` finding **additionally** carries the identifiers of the observations it relies on and its verbatim quoted evidence with that evidence's channel, both schema-required"*. A nullable field on a flat shape does not express "required on one kind and not the others"; a discriminated union does, and AD-13 names that restructuring as the house treatment for a conditional.

- Common to all three branches: `findingId` (`F-`), `findingType`, `oracleId` (**nullable**), `probeId` (**required**, Decision 14), `behaviorId` (nullable), `severity`, `summary`, `confidence`, `observationIds` (`z.array(Identifier)`), `evidenceArtifacts` (`z.array(ArtifactReference)`).
- `defect` branch only: `observationIds` tightened to `.min(1)`, and `quotedEvidence: z.array(QuotedEvidence).min(1)` where `QuotedEvidence` is `{ quote: string, channel: EvidenceChannel }`.

**`observationIds` is declared on every branch, not only on `defect`.** AD-23's word is *additionally* — a floor on `defect`, not a prohibition on the other two — and the architecture's own record uses the wider shape: `F-002` (`confirmation`) carries `["obs-001","obs-003"]` and `F-003` (`observation`) carries `["obs-005"]`. A defect-only field turns those into `unrecognized_keys` failures for no AD reason. The union still expresses the required/not-required split through `.min(1)`, which is the argument for using a union at all.

`oracleId` is nullable because AD-23 is explicit that *"a finding citing no oracle is retained as an uncited finding rather than discarded"*. That carve-out is oracle-only and is not extended to `probeId` (Decision 14).

**`evidenceArtifacts` is `z.array(ArtifactReference)`** and has nothing to do with this story's `EvidenceArtifact`, which is the scored output of `emit`. Two unrelated things one word apart; say so in the field description or a dev will reach for the wrong type.

**`confidence`** is `z.number().min(0).max(1)` on every branch (Decision 15).

**The two citation operands are not equal.** ADR-009 Decision 2 settled their precedence after revision 5 left a finding that cites `o1` while quoting text from `o2` resolving three different ways: *"Cited identifiers govern the witness match; quotation audits it."* Quoted evidence appearing in no cited observation is an AD-32 declared-versus-observed inconsistency that invalidates at ingest — a cross-artifact rule with no AD-5 code, so it joins AC 16's list.

The prior art's `actionIds` does not survive: AD-23 requires observation identifiers, the action log is referenced once at record level, and two citation vocabularies on one finding is the ambiguity ADR-009 just removed.

**`oracleDispositions[]`** is `{ oracleId, disposition: 'held' | 'violated' | 'not-attempted', observationIds: Identifier[], note: string | null }`. The vocabulary is AD-23's own three words. `observationIds` is required and **may be empty**, because AD-33 requires *"every disposition citing supporting observations, and an unsupported disposition invalidating cross-artifact agreement rather than being believed"* — an unsupported disposition has to stay representable so the scorer can invalidate it. That one disposition exists per required oracle is not refined: AD-23 makes a missing disposition an AD-21 invalidating condition, so the schema admits the shape and ingest fires the rung.

**`observations[]`** carries the closed AD-26 channel set, so every pointer in the addressing grammar has something to resolve against: `observationId`, `operationId`, `provenance` (`baseline` | `evaluator-chosen`), `callInputs` (a four-key strict object over the transport channels, each `JsonObjectValue` or `null`), `responseBody` (`JsonValue`, nullable), `responseHeaders` (`JsonValue`, nullable), `responseStatus` (`z.int()`, nullable), `stdout`, `stderr` (string, nullable), `exitCode` (`z.int()`, nullable).

The worked example's flat `callInputs: { id: "n-1" }` does **not** survive: AD-26 fixes that *"under `call-inputs` the next segment is one of the four transport channels"*, and a flat map makes `/interactions/write/call-inputs/body/title` resolve against nothing.

**`judgeResults[]`** is `{ rubricId, criterionId, score: z.int().nullable(), note: string | null }`. The score is an integer because AD-22 puts the scale on the rubric's own anchored levels and `ScaleLevel.level` is already `z.int()` — no second scale is minted. A `null` score is the shape AD-6's `judge-error` fires on, so it must parse.

**`resourceUse`** keeps the prior art's five members, with money as `UnsignedDecimalString` (Decision 9). `wallClockSeconds` stays a number: a measured duration is not currency, and 62.5 is an exact binary64.

**`evidenceDisclosure`** is `{ truncationBound: z.int().min(0).nullable(), reportedIncomplete: z.boolean() }`, and it exists because AD-21's FAIL rung reads *"evidence that is incomplete, over-truncated, unavailable, or internally inconsistent under AD-17"* against fields no artifact declares. `null` is untruncated. The bound's unit is left to the description, following the `RubricBody.maxLength` precedent Story 1.3 set for AD-22's equally unitless "bounded length".

Name the operand each of the four conditions reads, so a later story is not left inferring it: **incomplete** reads `reportedIncomplete`; **over-truncated** compares `truncationBound` against the evidence carried in this same artifact, which is why the disclosure and the evidence must travel together; **unavailable** is an `ArtifactReference` that does not resolve through the corpus port; **internally inconsistent** is the cross-artifact agreement check of AD-32. Only the first two are declared. AD-17's *"must retain evidence contradicting the leading verdict"* is not decidable by any of them and is on AC 16's list.

**Trial recording splits across two artifacts.** AD-6 says *"Every artifact records its trial count, its invalidated attempts, and each attempt's reason, including on a PASS."* A Sealed Run Record is one trial, so it records **which** trial it is; the Evidence Artifact aggregates (AC 11). Reading "every artifact" as putting an aggregate count on a single-trial record would ask one run to know about its siblings, which Owed item 1 says no stage signature can do.

**Run mode and observation ordering are deliberately absent** — see the absences table in Dev Notes.

### AC 6 — The Isolation Manifest

Succeeds `isolation-manifest`. AD-16: *"The isolation manifest's required fields are enumerated in its schema, seeded from the prior art's fifteen, and account for each forbidden input by name."*

The prior art's `required` array has **sixteen** members, not fifteen. Settled by construction (Decision 2): the fifteen are the fields that describe the run and `violation` is the sixteenth, the invalidation outcome. All sixteen are carried and the discrepancy is recorded in the description.

Carried from the prior art: `runId`, `conditionArm`, `modelSnapshot`, `systemPromptDigest`, `contractDigest`, `workspaceIdentity`, `allowedMounts`, `observedMounts`, `networkAllowlist`, `observedNetworkTargets`, `toolAllowlist`, `observedToolCalls`, `resourceCeilings`, `actualResourceUse`, `violation` (nullable). The prior art's `taskId` becomes `contractId` (Decision 7). Added: `evaluatorConfigurationDigest` (Decision 6), `forbiddenInputAccounting`, and AC 2's lineage.

**`resourceCeilings` keeps the prior art's five members and is not `Budgets`.** They are different concerns and the story says so rather than leaving a dev to guess: `Budgets` is the contract's three-key declared ceiling that AD-16 puts on the brief so the executing caller knows what it may spend; `resourceCeilings` is the isolation harness's record of what it actually enforced, and it carries the two token counts the contract never declares. Reusing one for the other would make a declaration and an observation the same field. Money in both `resourceCeilings` and `actualResourceUse` becomes `UnsignedDecimalString` per Decision 9.

**`forbiddenInputAccounting`** is the field AD-16 adds and the prior art lacks. It is a **seven-key strict object generated from `FORBIDDEN_INPUT_FLOOR`**, which `eval-contract.ts` already exports:

```ts
export const ForbiddenInputAccounting = z.strictObject({
  withheld: z.boolean(),
  note: z.string().nullable(),
})

// Declared AFTER the shape it references, and cast so the seven literal keys
// survive into `z.infer`: `Object.fromEntries` alone widens to an index
// signature and a typed accept fixture stops catching a missing member.
const accountingShape = Object.fromEntries(
  FORBIDDEN_INPUT_FLOOR.map((member) => [member, ForbiddenInputAccounting]),
) as Record<ForbiddenInput, typeof ForbiddenInputAccounting>
```

Generated, not transcribed, for the reason the constraint ledger generates its arity entries from `TUPLE_ARITY`: a hand-written second list of the seven is drift waiting to happen, and AD-16 makes an incomplete floor a coded compile-time failure precisely because the list has one home.

A strict object rather than `z.record(ForbiddenInput, …)`. The record spelling does demand every enum member at parse time, but its totality is a parse-time behaviour and the export carries `propertyNames` plus a schema-valued `additionalProperties` instead of a `required` array — so the constraint would be invisible to exactly the non-TypeScript consumer AD-13 exists to protect. This is the reasoning that made `RequestShape` a four-key object, reached from the opposite direction.

`withheld: false` must parse: AD-16 makes a prohibited input an invalidating condition at ingest, not a parse failure.

An **absent, unparseable, or incomplete** manifest is AD-16's own invalidating condition, handled by `core/ingest`. A schema rejection is the correct expression of "unparseable" and "incomplete", so nothing is admitted for their sake.

### AC 7 — The Evaluator Configuration

No prior art. AD-24 fixes the field list: *"the sealed-brief digest, opaque evaluator identity, model snapshot, system-prompt digest, decoding and sampling parameters, tool and permission inventory, budgets, seed where supported, and judge configuration, **with the trial index deliberately excluded so trials pool into one scoring version**."*

`sealedBriefDigest`, `evaluatorIdentity` (opaque string), `modelSnapshot` (string), `systemPromptDigest`, `decodingParameters` (`JsonObjectValue`), `toolInventory` (`string[]`), `permissionInventory` (`string[]`), `budgets` (reuse `Budgets` from `eval-contract.ts`), `seed` (`z.int().nullable()` — "where supported" is spelled `null`), `judgeConfiguration` (nullable; `{ modelSnapshot: string | null, systemPromptDigest: Digest | null }`), plus AC 2's lineage.

`decodingParameters` is one field carrying the caller's own keys in the value container, not a minted enum of temperature and top-p. AD-2 forbids any provider or model SDK knowledge in the package, so a closed parameter vocabulary would be knowledge this package is not allowed to have, and `JsonObjectValue` already sits inside AD-36's value domain, which matters because this artifact's digest enters the scoring version. "Decoding and sampling parameters" is one concern under two words; splitting it would draw a boundary no AD draws.

AD-18 binds this artifact hard: *"Credentials, tokens, real names, email addresses, account identifiers, and transaction content are excluded."* A tool and permission inventory is exactly where a caller would paste an API key. No schema over opaque strings stops that, so the prohibition goes in the description and into the ledger as not expressible; `evaluatorIdentity` is named *opaque* by AD-24 for the same reason.

**The trial-index exclusion is a testable negative and the AC requires the test.** Because every control object is `.strict()`, `EvaluatorConfiguration.safeParse({ …valid, trialIndex: 1 })` fails with `unrecognized_keys` at path `[]`. Assert the code and the path. This is the one place in the story where a *missing* field is the requirement, and a test that cannot show it failing is a gate that fails open.

### AC 8 — The Probe

Succeeds `h0-ground-truth`. **This artifact is defined at the level the epic's acceptance criteria of record command and no further** — see Decision 1 and the absences table.

`probeId` (`P-`), `probeClass`, `expectedClean`, `behaviorId`, `systemId`, `implementationDigest`, `artifactDigest`, `commitDigest`, `rationale`, `defects`, plus AC 2's lineage. `systemId`, `implementationDigest` (the prior art's `implementationSha`), and `rationale` come from the prior art, not from AD-9; `artifactDigest` and `commitDigest` are AD-9's *"All carry artifact and commit digests"*, read as per-probe and placed at root, which matches the prior art's record-level `implementationSha` and costs one spelling instead of five. The prior art's `taskId` does not survive.

**`probeClass`** is `z.enum(['defect','gameability','zero-action','canary'])` — AD-9's closed four, exactly one per probe. It is in scope even though the rest of AD-9 is not, because AC 11's strength vector is keyed by probe class and a key set with no vocabulary behind it is meaningless.

**`Defect`** is the prior art's six fields: `defectId` (`D-`), `behaviorId`, `summary`, `severity`, `oracleEvidence` (`z.array(ArtifactReference)`), `source` (`z.enum(['natural','controlled-mutation'])`).

**The prior art's `expectedClean` conditional is re-expressed as a discriminated union**, per AD-13. The `expectedClean: true` branch carries `defects: z.array(Defect).max(0)`. The `false` branch carries `defects: z.array(Defect)` with **no minimum**: AD-9 states none, and a minimum would make a canary — which indicts the fixture rather than seeding a defect — unrepresentable. AC 2's lineage spreads into both branches.

The prior art's `expectedGate` does not survive (Decision 10).

**Two AD-9/AD-40 constructions are deliberately absent**: the per-class qualification record and the machine-readable defect signature. Both are recorded in the absences table with the AD they owe and the expected additive bump.

### AC 9 — The Pre-flight Verdict

No prior art. AD-10 bounds the verdict to a closed list of checks and requires the fixture digest as a **required** field.

`runId` (opaque), `fixtureDigest` (required — AD-11's fixture digest is one of the scoring version's five named inputs), `passed` (boolean), `checks[]`, plus AC 2's lineage.

Each check is `{ kind, operationId: Identifier | null, outcome, note: string | null }`. The `kind` enum is transcribed from AD-10's own prose, not invented: `interface-present`, `input-sensitivity`, `state-reset`, `clean-control`, `seeded-faults-scoped`, `seeded-fault-fired`. The `outcome` enum is `satisfied | failed | exempt`; `exempt` exists because AD-10 says *"An operation declaring no inputs in any channel is exempt and records the exemption"*, and an exemption with no spelling is an exemption nobody records.

`operationId` is nullable because AD-10 scopes input sensitivity and state reset per operation and interface presence per interface.

That a failed pre-flight invalidates the run, and that a sensitivity witness resolving `insufficient-evidence` fails rather than passes, are AD-10 semantics for `core/preflight` in Epic 6. The schema carries the outcome and refines nothing.

### AC 10 — The Scoring Policy

No prior art. The epic's AC of record names five fields and the Configuration convention explains why they are an artifact rather than constants.

`policyId` (`Identifier`), `severityFloor` (`z.enum(['low','material','critical'])`), `confidenceThreshold` (`z.number().min(0).max(1)`, the same scale as a finding's confidence, or AD-21's *"a finding whose confidence falls below the policy threshold"* compares two different scales), `minimumTrialCount` (`z.int().min(1)`), `reExecutionCap` (`z.int().min(0)`), `remediationCap` (`z.int().min(0)`), plus AC 2's lineage.

**No `.default()` anywhere, and no default values in the schema.** The Conventions are explicit: *"the default policy ships as a published artifact referenced by digest rather than as constants in a function, so 'the default' has an identity and a no-op edit cannot move a scoring version."* AD-6's three-trial minimum, its two-execution cap, and AD-12's three-revision remediation cap are recorded in the field descriptions as what the published default artifact carries, and are absent from the schema. `.default()` is additionally banned because it diverges input-mode and output-mode exports.

**`strictMode` and `corpusLocation` are deliberately not fields.** The Conventions list them alongside the policy as *"explicit arguments **or** an explicit policy artifact"*, and AD-14 fixes strict mode as a CLI flag while AD-8 puts the corpus behind `CorpusPort`. Adding either here would give one concern two homes.

### AC 11 — The Evidence Artifact

No prior art. Owned by `emit` per AD-24; `score` produces the outcome and verdict values it serializes.

**The two modes are a discriminated union on `mode`, because AD-21 says the two verdicts never share a field.** Taken literally, that is a structural requirement:

- `{ mode: 'production', productionVerdict: Verdict, … }`
- `{ mode: 'contract-scoring', contractVerdict: Verdict, systemRecommendationRecorded: EvaluatorRecommendation, systemRecommendationNote: string | null, … }`

`Verdict` is the four uppercase members `PASS`, `WAIVED`, `CONCERNS`, `FAIL`. It and `EvaluatorRecommendation` (Decision 5) live in **`src/core/schemas/verdict.ts`, a leaf module beside `lineage.ts`**, imported by both `evidence-artifact.ts` and `sealed-run-record.ts`. Not in `evidence-artifact.ts`: that would make the caller's inbound artifact depend on the outbound one, inverting the pipeline direction for a two-line enum, and it puts a shared vocabulary inside a consumer — the same shape as the cycle AC 2's leaf module exists to avoid, one step short of being one. AC 2's lineage spreads into both branches.

This expresses AD-21's settled sentence and no more. Owed item 4's remaining half — mode fixed before ingest and entering AD-11's identity inputs — stays open, and the run record still carries no mode.

Common to both branches: `runId`, `scoringVersion`, `scoringVersionInputs`, `comparabilityKey`, `excludedProbeIds`, `exitCode` (`z.int()`), `verdictBasis` (`string[]`), `callerAttestedInputs`, `trials`, `outcomes`, `uncitedFindings`, `coverageGaps`, `strength`, `remediation`.

- **`scoringVersionInputs`** is AD-11's five named fields, transcribed: `{ contractSchemaVersion: z.int().min(1), corpusDigest: Digest, fixtureDigest: Digest, evaluatorConfigurationDigest: Digest, scoringPolicyDigest: Digest }`. Carrying only the resulting digest leaves a reader unable to recompute it or see what was compared, and it discharges AD-8's *"A result references a sealed set … by digest and opaque reference, never by content or path."* **These five key names are the canonical field names of AD-11's domain-separated object, and Epic 6 computes the scoring version over this shape rather than a parallel one.** AD-11 chose a named object over a concatenated tuple precisely because revision 1 *"let two conforming scorers compute different versions from identical inputs"*; if the scorer hashes one spelling and this artifact publishes another, the published pre-image does not reproduce the published digest and the field is worse than absent.
- **`callerAttestedInputs`** is `z.array(z.enum([…the five key names…]))` rather than free strings, because AD-32 requires an artifact to state *which* inputs were caller-attested and an unconstrained string cannot be checked against anything. AD-11 names the three that are. The worked example's `["corpusDigest","fixtureDigest","evaluatorConfigurationDigest"]` parses unchanged.
- **`excludedProbeIds`** is `z.array(ProbeId)`, from AD-7: comparability *"is deliberately weaker than the AD-11 scoring version, so adding a probe narrows a comparison to the intersection and **records the excluded probes** rather than voiding every prior result."* Empty is the ordinary case.
- **`trials`**: `{ declaredMinimum, completed, invalidatedAttempts: [{ attempt: z.int().min(1), reason: string }] }`. AD-6 requires all three *"including on a PASS"*, so none is nullable.
- **`outcomes[]`**: `{ oracleId, probeId (nullable), state, severity, disposition, resolvedFrom (nullable), corroboration, selectedObservationIds, checkResolution }`. `state` is AD-6's closed twelve, exported as `OUTCOME_STATES` with a test asserting the length. `corroboration` is AD-33's closed three. **`not-evaluable` and `insufficient-evidence` are different conditions and AD-33 forbids merging them**, so both vocabularies appear on one outcome; say so in both descriptions.
- **`selectedObservationIds`** is `z.array(Identifier)`. AD-40 names the cited observation identifiers as *"what the witness match resolves against and what AD-33 records on the outcome"*, and AD-33 states it as a present requirement. It is independent of Owed item 2, which is about selection *determinism* — a monotonic sequence and declared selector cardinality — not about whether the selection is recorded.
- **`checkResolution`** is required by AD-4: *"Each node's resolution and, where it is `insufficient-evidence`, the introduction condition that fired, are recorded in the evidence."* A recursive record mirroring the oracle's `check` tree, nullable at the outcome level for an oracle whose check never ran: `{ resolution: 'true' | 'false' | 'insufficient-evidence', introductionCondition: 'empty-collection' | null, children: CheckResolution[] }`. The introduction vocabulary has one member because AD-4 closes the introduction set at one. `.meta({ id: 'CheckResolution' })` because it is self-referential. Epic 3 populates it.
- **`coverageGaps[]`**: `{ rule: string, relevancePredicate: string, satisfactionPredicate: string, satisfied: boolean, severity }`. `rule` is opaque and not an enum, for the reason `Waiver.rule` is: AD-20 enumerates its seven rules in prose and assigns them no identifiers.
- **`strength`**: `{ denominator: string, basis, vector, comparable: boolean, note: string | null }`. The vector is a **fixed three-key object** — `defect`, `gameability`, `zero-action` — because AD-7 says *"Canary probes and clean controls never enter the vector."* Each value is nullable, so a class with no exercised probe is explicit `null`. Each present entry is `{ caught: z.int().min(0), exercised: z.int().min(0), rate: z.number().min(0).max(1).nullable() }`; `rate` is nullable because `exercised` may be zero and a rate over an empty denominator is undefined, not zero. **There is no separate `rawCounts`**: AD-7 wants raw counts recorded alongside the rate so a consumer can recompute, and the per-class entry already carries both — a second copy is one more thing to disagree with itself.
- **`basis`** is `z.enum(['measured','reconstructed'])`. AD-40 forbids pooling a containment-reconstructed detection with a measured catch rate; without the field the two are identical on disk and pooling is the default reading.
- **`remediation`**: `{ revisionCount: z.int().min(0), cap: z.int().min(0), capSource: z.literal('caller-attested'), lineageChain }`. **This `revisionCount` is AD-12's remediation count, not AD-29's lineage `revisionCount`** — the two are distinguished only by nesting, so say it in both descriptions. `capSource` is a literal because AD-12 states the package cannot enforce the cap.
- **`lineageChain`** is `{ lengthConsistent: z.boolean(), noRepeatedDigest: z.boolean(), noGap: z.boolean() }`, transcribed from AD-12's own three checks: the package *"validates a caller-presented lineage chain — length consistent with the declared revision, no repeated digest, no gap — and emits evidence of compliance."* Three named checks are a vocabulary the AD supplies, so enumerating them is transcription, the same move AC 9 makes for the pre-flight check kinds and AC 11 makes for the introduction condition. A single boolean would tell a reader that a chain failed and not which of three ways, on an artifact whose purpose is to be read. AD-21's FAIL rung reads the conjunction.

### AC 12 — The Sealed Evaluator Brief

No prior art, and the tightest exclusion rules in the inventory. AD-16 fixes what it carries — *"the contract's behaviours, the generated evaluator-facing directions of AD-3, permitted interfaces, and scoped resource references — plus budgets and safety limits"* — and what it never carries: *"author commentary, the interaction plan, or the plan's step identifiers"*, and never a prescribed action sequence.

`contractDigest` (binding the brief to the contract it seals), `behaviors` (reuse `Behavior`), `directions[]`, `permittedInterfaces[]`, `scopedResources` (reuse `ScopedResource`), `budgets` (reuse `Budgets`), `safetyLimits` (`string[]`), `probeStepBound` (`z.int().min(0).nullable()`), plus AC 2's lineage.

**`directions[]` is `{ oracleId, text }`.** Oracle identifiers reach the evaluator and step identifiers do not, and the reason is decisive: AD-23 requires every finding to cite the oracle it belongs to, the evaluator writes the findings, and an identifier it never saw is one it cannot cite. AD-16's prohibition names step identifiers specifically. No `behaviorId`: `Behavior.oracles` is an array, so two behaviours may cite one oracle and a single behaviour identifier on a direction cannot be truthful.

**`permittedInterfaces[]` on the brief is `{ logicalId, kind }` and carries no operation inventory** (Decision 11). AD-35 binds it as it binds the contract: *"a contract names logical interface identifiers only and never a URL, host, or port."* The brief is the artifact that actually reaches the executing caller, so a URL leaking onto it defeats the mapping AD-35 keeps outside. Reuse `Identifier` and the four-member kind enum; state the prohibition in the description.

**The exclusions are tested as negatives, not assumed from strictness.** Because the object is `.strict()`, a brief carrying `interactionPlan`, `commentary`, or a `stepId` fails with `unrecognized_keys`; the AC requires one reject fixture per excluded key asserting that code and path. A test that only checks a valid brief parses proves nothing about what the brief keeps out.

### AC 13 — The published Rubric

Story 1.3 split the rubric deliberately: *"`RubricBody` here for embedding; Story 1.4's published `Rubric` is body plus `schemaVersion`, lineage, and its prior-art declaration."*

`Rubric` is `z.strictObject({ ...RubricBody.shape, ...lineageFields }).meta({ id: 'Rubric', description })`, in `rubric.ts`, declaring no prior art. `RubricBody` keeps its current shape and its current use inside `EvalContract` unchanged, and **gains `.meta({ id: 'RubricBody' })`** so the shared body has a stable `$defs` name distinct from the artifact called `Rubric`; without it the two collide in Story 1.5's drift check under a generated positional name. Do not re-spell the criteria, the scale levels, or the failure-mode penalties.

### AC 14 — Shared vocabularies exported once, and derived rather than rebuilt

Two vocabularies this story needs exist today only as private regex fragments. Each gets one exported home, and the shape that already consumes it **derives from that home by name** — it is not regenerated wholesale.

1. **`EVIDENCE_CHANNELS` / `EvidenceChannel`** — AD-26's closed seven, in AD-26's own order: `response-body`, `response-headers`, `response-status`, `call-inputs`, `stdout`, `stderr`, `exit-code`. Order matters because enum order lands in the export and Story 1.5's drift check pins whatever ships.
2. **`TRANSPORT_CHANNELS` / `TransportChannel`** — AD-19's four: `path`, `query`, `header`, `body`.

Both live in `pointer.ts`. **`INTERACTION_POINTER_PATTERN` is not rebuilt from a flat list.** It is built from a three-way partition — channels that take a tail, scalar channels that take none, and `call-inputs` with its own transport segment — and a seven-member enum does not carry that partition. Derive the partitions from the enum **by naming their members**, keep the pattern's structure hand-written, and assert in a test that every enum member appears in the pattern source and that the partitions are disjoint and exhaustive over the enum.

**`RequestShape` is not regenerated from `TRANSPORT_CHANNELS`.** Its four keys are hand-written today and its `header` key carries a published AD-18 statement — *"a header channel declaration names a header and its type and never carries a credential value"* — that a generated loop would delete, changing the `EvalContract` export bytes. Keep the object; assert its key set equals the enum.

`OUTCOME_STATES` (AD-6's closed twelve) is exported from `evidence-artifact.ts` with a test asserting the count.

### AC 15 — The Consistency Conventions hold, and every exception is named

Everything Story 1.3 established binds here unchanged, and the audit lists it maintained are extended rather than restarted:

- Every control object is `z.strictObject`. `JsonValue` remains the single schema-valued exception.
- **Caller-keyed maps: the count and the list must agree.** Story 1.3 named exactly six. This story adds each new one to that list with its `propertyNames` pattern, or adds none and says so. `decodingParameters`, `responseBody`, and `responseHeaders` are `JsonValue`-typed rather than caller-keyed control maps, so they do not join it — state that, do not leave it inferable.
- Nullability is `.nullable()` on a required key, never `.optional()`, never `.default()`.
- Enumeration values are lowercase kebab-case, with **two** named exceptions: the four uppercase verdicts and HTTP method. `EvaluatorRecommendation` is not a third — it is the verdict vocabulary minus `WAIVED` (Decision 5), and it reuses the existing exception rather than creating one.
- Dates are `Rfc3339Utc`. **Every field whose name ends in `Digest`, and every field the ACs above name as a digest, is the `Digest` primitive** — stated as a rule so the ACs need not repeat the type at each of the dozen sites. Identifier prefixes come from `primitives.ts` — `ProbeId`, `DefectId`, `FindingId`, `RubricId`, `RubricCriterionId` were defined in Story 1.3 **for this story** so the `{3,}` quantifier has one spelling. Import them.
- Money is `UnsignedDecimalString`. Integers use `z.int()`, which exports AD-36's safe-integer bounds for free; prefer `z.int().min(0)` where a negative is meaningless.
- Every shared or self-referential shape carries `.meta({ id })`, or it exports as a positional `__schema0` that Story 1.5's drift check would pin. **Never call `.describe()` on a schema that already carries `.meta({ id })`** — describe the branch object instead.
- Reuse, do not re-derive: `Budgets`, `Behavior`, `ScopedResource`, `FORBIDDEN_INPUT_FLOOR`, `ForbiddenInput`, `RubricBody`, `JsonObjectValue`, `JsonValue`, `Identifier`, `Digest`, `Rfc3339Utc`, `UnsignedDecimalString`, and the identifier prefixes.

### AC 16 — The admit-rule holds, and every code keeps a shape to fire on

Story 1.3's rule is inherited wholesale: **where AD-5 gives the compiler a literal code, the schema admits the shape and a later epic rejects it; where no code exists, the schema is the enforcement point.** A schema tightened past a code converts a coded, artifact-path-carrying structural error into an anonymous `schema-parse-failure` fault and deletes the fixture that code's owning story owes.

`faults.ts` gains no new codes. Its two members have throwers; the rest of AD-28's registry arrives with the readers and ports that throw them. AD-5's registry as code is Story 4.2.

Story 1.3 shipped an eight-entry list of cross-field rules unenforced in v0, each with an admission test proving the shape parses. This story **extends that list**. Additions, each needing an admission test:

1. A run record whose `oracleDispositions` omit a required oracle (AD-23 makes it an AD-21 invalidating condition).
2. Two dispositions naming one oracle.
3. A finding citing an `observationId` no observation declares.
4. A `defect` finding whose `quotedEvidence` appears in none of its cited observations (ADR-009 Decision 2 makes this an AD-32 inconsistency at ingest).
5. A judge result citing a `criterionId` no rubric declares, and more than one judge call (AD-17).
6. An isolation manifest whose observed mounts, network targets, or tool calls exceed their allowlist (AD-16 makes this a violation recorded at ingest).
7. `evaluatorConfigurationDigest` or `contractDigest` disagreeing between the run record and the isolation manifest (AD-32; a schema cannot see two artifacts at once).
8. A private-artifact-manifest entry whose digest does not match the resolved bytes (AD-8 makes it a `digest-mismatch` fault).
9. An evidence artifact whose `strength.rate` disagrees with its own `caught` over `exercised`.
10. `expectedClean: true` on a probe whose `probeClass` is `defect`, and the converse (AD-7 excludes clean controls from the vector and AD-9 fixes their legal states at two, so the scorer reads the pair; no AD-5 code names the contradiction).
11. `observations[].operationId` colliding across two interfaces (`Operation.operationId` is scoped to a `PermittedInterface` and `duplicate-operation-signature` covers method plus path template only).
12. AD-18's prohibition on credentials, private paths, and domain values in any artifact.
13. **An unqualified probe.** AD-9 says *"An unqualified probe cannot enter a sealed set"*, and with the qualification record deferred (Decision 1) neither the schema, nor an AD-5 code, nor an AD-21 rung catches one. This is the accepted cost of that deferral and it is named rather than dropped. The spine's Deferred section already puts *"corpus mining and qualification tooling"* outside v0, so there is no stage to enforce it in either; it arrives with the corpus epic.
14. **`probe.behaviorId` disagreeing with a `defects[].behaviorId`.** AD-9 puts the behaviour on the probe, the prior art puts one on each defect, and this story carries both.
15. **AD-17's *"must retain evidence contradicting the leading verdict"***, which no field on any artifact can decide.
16. `permittedKeys` not covering `requiredKeys` on any newly declared descriptor (already on the list; confirm no new instance escapes it).

**Five existing test assertions change, and each is a drift guard doing its job.** All are in `tests/schemas/constraint-ledger.test.ts` except where noted:

- `expect(CONSTRAINT_LEDGER).toHaveLength(arityEntries.length + 4)` — AC 17 changes the count.
- `it.each(['json-value-numeric-domain', 'lineage-root-biconditional', 'operator-operand-types'])` — `lineage-root-biconditional` no longer exists under that id (AC 17).
- `expect(resolve(constraintLedgerEntry('lineage-root-biconditional')!)).toEqual(exported.properties.parentDigest)` — the non-null assertion throws a `TypeError` inside `resolve` once the id is gone. Retarget it to `lineage-eval-contract`.
- The ledger's address-resolution helper walks the `EvalContract` export only; AC 17's per-artifact addresses need it to resolve against the artifact its `location.artifact` names.
- The `$defs` key-set assertion `['Expression','InputBindingChannel','JsonValue','Operand']`. **The AC 2 lineage refactor must not change it** — spreading a plain object literal adds no `$defs` entry, which is one reason the spread was chosen. If it breaks, the refactor nested something it should not have. It *does* change if `RubricBody` gains `.meta({ id })` (AC 13) and remains reachable from `EvalContract`; expect `RubricBody` to join the set and update it deliberately.

### AC 17 — The constraint ledger grows, with resolvable addresses

`ConstraintLocation` is currently `{ kind: 'root' } | { kind: 'definition'; name: string }`. That was unambiguous while `EvalContract` was the only root. **With twelve roots it is not**, and the ledger's reason for existing — Story 1.5 resolving an entry *by its stated address, never by searching* — fails silently the moment two artifacts carry the same rule.

Widen it to `{ kind: 'root'; artifact: string } | { kind: 'definition'; artifact: string; name: string }`, where `artifact` is a key of `INTERCHANGE_ARTIFACTS`.

The existing `lineage-root-biconditional` entry becomes **eleven generated entries**, ids `lineage-${artifactKey}`, produced by filtering the registry on `carriesLineage` — eleven, not twelve, because `ArtifactReference` has no `parentDigest` for the address to resolve against. Generated from the registry the way the arity entries are generated from `TUPLE_ARITY`.

**The filter alone is not enough, and this is the part that is easy to miss.** Two of those eleven are union-rooted (AC 2), and a union root exports `{ $schema, oneOf, description }` with **no `properties` object** — the same Zod fact AC 3 relies on for its root-description test is what breaks the address. `resolve()` in `tests/schemas/constraint-ledger.test.ts` reads `exported.properties?.[entry.field]`, gets `undefined` for `lineage-probe` and `lineage-evidence-artifact`, and the "fails if the address does not resolve" assertion goes red.

**Give `resolve()` a union fallback**: where the located schema carries `oneOf` rather than `properties`, require `field` to be present in **every** branch and return the first branch's copy. That is faithful to what the entry means — the biconditional binds both branches because AC 2 spreads lineage into both — and it keeps the address readable and the count at eleven.

Two details, because the ambiguous evidence for each is in the file you will be editing:

- **`oneOf`, not `anyOf`.** All three union roots are `z.discriminatedUnion`, which exports `oneOf`; a plain `z.union` exports `anyOf`. Both keywords already appear in `tests/schemas/constraint-ledger.test.ts` — the arity walk reads `exported.$defs.Expression.oneOf` at line 163 and the `additionalProperties` test reads `definition.anyOf.find(...)` at line 227, against `JsonValue`, which is a `z.union` under `z.lazy`. A fallback keyed on `anyOf` resolves nothing for the two artifacts it exists for, and fails silently.
- **Return the first branch's copy, and do not deep-compare.** The branches carry the *same* schema object: AC 2 spreads one `lineageFields` literal into each, so the copies are identical by construction rather than by coincidence. Requiring presence in every branch is the guard; picking one is then arbitrary and safe.

Do **not** reach for the existing `branch` field to solve this. Its matcher is `definition.oneOf?.find((c) => c.properties?.op?.const === entry.branch)`: the discriminator key `op` is hard-coded and `branch` is typed `string | null`, while `Probe`'s discriminator values are booleans. `branch` is the arity mechanism and stays `op`-specific by design. Two alternatives were considered and are recorded so a later reader does not re-derive them: addressing the rule at the artifact with `field: null` and the field names in `statement`, which resolves under both root kinds but costs AC 16's retarget of the third assertion; and widening `ConstraintLocation` with a general `{ discriminator, branchValue }`, which is more work and widens a type four other entry classes do not need.

**No module under `src/core/schemas/` may import `constraint-ledger.ts`.** The ledger now imports `artifact.ts` and therefore sits downstream of all twelve schema modules. The existing direction is correct — `plan.ts` exports `BINDING_CHANNEL_NON_EMPTY` *to* the ledger — and a future author reaching the other way for a stable id closes the loop.

New entries this story owes, each with a resolvable address and a `dialect` where it injects:

- The lineage biconditional, per lineage-bearing artifact. Not expressible; a cross-field rule.
- AD-18's prohibition on credentials, private paths, and domain values, on `PrivateArtifactManifest` and `EvaluatorConfiguration`. Not expressible over opaque strings.
- Any `.refine()` the implementation cannot avoid. Story 1.3 needed exactly one; aim for zero, and if one is unavoidable it lands here with an injectable keyword or a stated reason, never silently.

A test resolves every entry by its stated address against the exported document and fails if the address does not resolve. Extend the existing test; do not add a parallel one.

### AC 18 — Fixtures, tests, and the gate

- One **accept fixture per artifact** in `tests/schemas/fixtures/artifact-fixtures.ts`, typed against its schema so a re-spelling fails the typecheck before it reaches a test.
- One **reject case per constraint the schema itself enforces**, in `tests/schemas/fixtures/artifact-reject-cases.ts`, following the existing `RejectCase` shape exactly: each is an accept fixture mutated to violate **one** constraint, asserting the Zod issue's `path` **and** `code` and that the issue count is exactly one. A bare `success === false` is not a test. Most will assert `invalid_format`, which is what a failed `.regex()` produces.
- **A positive fixture per branch of every discriminated union**: `ArtifactReference`'s two, the finding's three, `Probe`'s two, `EvidenceArtifact`'s two.
- Fixtures are enumerated with `it.each` off exported arrays whose completeness is itself asserted, so a committed fixture no test exercises cannot go silently dead.
- **The worked-example artifacts are a known-nonconforming corpus, and the story does not pretend otherwise.** `spike-worked-example/sealed-run-record.json` and `evidence-artifact.json` fail this story's shapes in roughly a dozen places, and only some are the retractions the spine records. Transcribe each as a fixture with its **full expected issue list** — paths and codes, following the `worked-example.test.ts` precedent, which asserts exact paths and codes for three of five checks — and exempt them by name from the one-issue rule above, which applies to single-constraint mutations and cannot hold for a document that fails many ways. Known failures include the flat `callInputs`, finding-level `provenance`, absent `parentDigest` and `revisionCount`, the `{ kind, reference, digest, visibility }` artifact-reference shape, `resourceUse.costUsd` as a number, dispositions without `observationIds`, outcomes without `checkResolution` or `selectedObservationIds`, `strength` without `basis`, and a one-key `strength.vector`. **Do not repair the worked example.**
- All fixtures are in-memory TypeScript modules; no filesystem read at test runtime, per AD-30. If a JSON fixture is added under a subdirectory, note that `biome.json`'s existing `!tests/fixtures/*.json` exclusion is **non-recursive** and would need `**`.
- Fixtures on disk stay pure ASCII, with non-ASCII written as `\uXXXX` escapes.
- `npm run validate` passes: typecheck, lint, `check:docs`, `lint:spine`, `check:vectors`, test. Check `check:docs` **before the first edit** — Story 1.3 lost time to a pre-existing `README.md` whitespace failure that blocked the chain.
- No workflow, pin, or `.npmrc` change is expected. If one seems necessary, stop and re-check the approach.

## Tasks / Subtasks

- [x] Task 1: Shared foundations (AC 1, 2, 14)
  - [x] Add `src/core/schemas/lineage.ts` and `src/core/schemas/verdict.ts` as leaf modules (`lineageFields`; `Verdict` and `EvaluatorRecommendation`)
  - [x] Refactor `eval-contract.ts` to spread it, moving the three descriptions verbatim; confirm every Story 1.3 test passes **unmodified**
  - [x] Export `EVIDENCE_CHANNELS` and `TRANSPORT_CHANNELS` from `pointer.ts`; derive the pattern partitions by name and assert agreement
- [x] Task 2: Reference shapes (AC 4)
  - [x] `artifact-reference.ts` as a discriminated union on `storage`, no lineage, exemption asserted
  - [x] `private-artifact-manifest.ts` with `sanitizationPolicy` and the ratified eight-member kind enum
- [x] Task 3: The caller's inbound boundary (AC 5, 6, 7)
  - [x] `sealed-run-record.ts`: findings union, dispositions, seven-channel observations, judge results, `evidenceDisclosure`
  - [x] `isolation-manifest.ts`: sixteen prior-art fields, `evaluatorConfigurationDigest`, and `forbiddenInputAccounting` generated from `FORBIDDEN_INPUT_FLOOR`
  - [x] `evaluator-configuration.ts` plus the trial-index exclusion test asserting `unrecognized_keys`
- [x] Task 4: The corpus and environment artifacts (AC 8, 9)
  - [x] `probe.ts`: prior-art fields, `probeClass`, `Defect`, the `expectedClean` union; qualification and defect signature deliberately absent with both absences described
  - [x] `preflight-verdict.ts`: required fixture digest, six check kinds, three outcomes
- [x] Task 5: The scored outputs (AC 10, 11)
  - [x] `scoring-policy.ts`: five fields, no defaults in the schema
  - [x] `evidence-artifact.ts`: mode union, `Verdict`, `EvaluatorRecommendation`, `OUTCOME_STATES`, `CheckResolution`, three-class strength vector
- [x] Task 6: The outbound boundary (AC 12, 13)
  - [x] `sealed-evaluator-brief.ts` with identity-only interfaces, plus one reject fixture per excluded key
  - [x] `Rubric` in `rubric.ts`; `RubricBody` gains `.meta({ id })`
- [x] Task 7: Registry, ledger, conventions audit (AC 1, 15, 16, 17)
  - [x] `src/core/schemas/artifact.ts` with the twelve-entry registry and `NO_PRIOR_ART`; assert count, key set, `priorArt` tally, and `carriesLineage` against the computed flag
  - [x] Widen `ConstraintLocation`; generate eleven lineage entries; give `resolve()` its union fallback; update the five changed assertions
  - [x] Extend the caller-keyed-map list and the unenforced-in-v0 list; add an admission test per new entry
- [x] Task 8: Fixtures and the gate (AC 18)
  - [x] Accept fixtures, reject cases, per-branch positives, worked-example nonconforming corpus
  - [x] `npm run validate` green; record test counts before and after
- [x] Task 9: Documentation
  - [x] Add Step 4 to `_bmad-output/project-knowledge/learning-path-step-by-step.md` per `learning-path-template.md`, plus its table row
  - [x] Flip this story to `in-progress` in `sprint-status.yaml` when you pick it up, and to `review` when you open the PR. (`1-3` was already corrected from `review` to `done` at story-creation time; it had merged in `f76ad86`.)

### Review Findings

Adversarial review, 2026-08-19, against the uncommitted working tree at baseline `f76ad86`. `npm run validate` re-run independently and green (774 tests, 21 files). AC 2 verified byte-for-byte in a scratch worktree: only `properties.rubrics` differs (now a `$ref` whose `RubricBody` definition is byte-identical to the old inline body minus its new description), `contractId` moved second to fourth (inert; no test reads property order), bytes 50457 to 50795, `required` set unchanged, root description unchanged. No high-severity findings; nothing blocks.

- [x] [Review][Decision] ResourceCeilings silently loosens two prior-art bounds: the prior art declares `exclusiveMinimum: 0` on `maxWallClockMinutes` and `maxCostUsd`; the new schema carries `z.number().min(0)` and `UnsignedDecimalString`, so a zero ceiling now parses. The reject case `manifest-ceiling-below-one` cites "the prior art's minima" while covering only the three `.min(1)` fields. AC 3's rule is that a divergence is named in the field's own description; this one is named nowhere. Either restore the exclusive bounds or record the loosening as a deliberate divergence. [src/core/schemas/isolation-manifest.ts:20]
- [x] [Review][Decision] JudgeConfiguration gives the no-judge state two spellings: the field-level `null` is documented as the no-judge state "rather than an object of nulls", yet `{ modelSnapshot: null, systemPromptDigest: null }` parses. Either tighten the inner fields or document which partial states are meaningful. [src/core/schemas/evaluator-configuration.ts:11]
- [x] [Review][Patch] The production evidence accept fixture contradicts AD-21's own exit-code rule: `productionVerdict: 'FAIL'` beside `exitCode: 0`, while `verdict.ts` records that FAIL exits two. The verdict-versus-exit-code agreement is also absent from the unenforced-in-v0 admissions list, unlike its sibling cross-field rules. [tests/schemas/fixtures/artifact-fixtures.ts:470]
- [x] [Review][Patch] `canaryProbe` is a dead fixture: exported, imported by nothing, in neither enumerated corpus, so the `canary` class value is never parsed by any test and the "a minimum would make a canary unrepresentable" rationale in probe.ts is proven by nothing. Violates AC 18's enumeration rule. [tests/schemas/fixtures/artifact-fixtures.ts:382]
- [x] [Review][Patch] Three of four root discriminators lack an out-of-set reject case: `storage` has `reference-storage-outside-the-two`, but `mode`, `expectedClean`, and `findingType` have none, and the only mode-mismatch test asserts a bare `success === false`. [tests/schemas/fixtures/artifact-reject-cases.ts]
- [x] [Review][Patch] The two Consistency-Convention walks miss nested lax objects: the strictness test checks `additionalProperties` on document roots only, and the required-versus-declared collector only visits nodes that already carry `additionalProperties: false`, so a future nested plain `z.object` or `.optional()` inside it is invisible to both. [tests/schemas/artifact-registry.test.ts:164]
- [x] [Review][Patch] The "keeps the two verdicts on separate branches" test passes for the wrong reason: the mutated document also lacks `productionVerdict`, so the test stays green even if the branches regressed to sharing verdict fields. Assert the `unrecognized_keys` issue for the foreign verdict field. [tests/schemas/artifacts.test.ts:372]
- [x] [Review][Patch] Count drift in the Dev Agent Record: it claims 58 reject cases; the file holds 56. The story's own rule is to verify counts against code before recording them. [tests/schemas/fixtures/artifact-reject-cases.ts]
- [x] [Review][Patch] The learning-path Step 4 mermaid diagram draws `lineage.ts --> artifact-reference.ts`, an import that does not exist and that contradicts the doc's own no-lineage bullet. [_bmad-output/project-knowledge/learning-path-step-by-step.md]
- [x] [Review][Patch] The three unit-interval fields (`confidence`, `confidenceThreshold`, `rate`) are boundary-tested only from above; no case covers the `too_small` side. [tests/schemas/fixtures/artifact-reject-cases.ts:158]
- [x] [Review][Patch] `verdictBasis` admits empty-string members while `InvalidatedAttempt.reason` requires `.min(1)` on the stated reasoning that an empty reason says nothing; the same reasoning applies to a fired-condition string. [src/core/schemas/evidence-artifact.ts:267]
- [x] [Review][Patch] No fixture ever parses a failing pre-flight: `outcome: 'failed'` and `passed: false` have no positive coverage, though the failing state is the one the artifact exists to report. [tests/schemas/fixtures/artifact-fixtures.ts:390]
- [x] [Review][Patch] `systemRecommendationRecorded: 'WAIVED'` is never shown to fail; the one member separating `Verdict` from `EvaluatorRecommendation` is reject-tested only via the run record's `NOT_APPLICABLE` case. [tests/schemas/fixtures/artifact-reject-cases.ts]
- [x] [Review][Patch] Duplicate `invalidatedAttempts` attempt numbers parse and the rule appears in neither the constraint ledger nor the admissions list, whose policy is "named rather than silently dropped". [src/core/schemas/evidence-artifact.ts:108]
- [x] [Review][Patch] Observation value domains are looser than the surrounding discipline and only `responseBody` says so: `responseStatus` is an unbounded integer (a negative status parses) and `responseHeaders: JsonValue` admits scalars a `response-headers` pointer tail then addresses into. State the deliberateness or bound them. [src/core/schemas/sealed-run-record.ts:190]

Dismissed as designed-per-story (2): the union fallback returning the first branch's copy without deep comparison (AC 17 commands exactly that); `Rubric` spreading the body before lineage (AC 13 spells that literal order).

Review verdicts on the implementer's six requested scrutiny areas: (1) wrong-reason tests found are the three listed above; (2) AC 2 confirmed byte-level, position change inert; (3) the `resolve()` union fallback cannot certify a half-resolvable address, and its own mutation test proves it; (4) `carriesLineage` computation covers every union branch, and a disagreeing-branch flag is caught jointly by the exactly-one-out test; (5) no schema tightens past an AD-5 code; the one deliberate tightening (`EvaluatorRecommendation`) is Decision 5 with its consequence recorded, and the only fidelity drift runs the other direction (the ResourceCeilings loosening above); (6) none of the twelve root descriptions overstates what the schema enforces.

## Dev Notes

### Scope boundary, and the reading it rests on

This story defines **shapes**. It implements no stage, no predicate, no evaluation, and no scoring.

The epic brief says: *"AD-6, AD-7, AD-9, AD-11, AD-12, AD-21, AD-23, AD-32, AD-33, and AD-40 are score-side or depend on the reference reducer, and no epic touches `score` until its seven owed items close."* Nine of those ten bind artifacts in this story. **The reading this story takes, stated so it is arguable rather than assumed: the exclusion bars implementing those ADs' semantics; the epic's acceptance criteria of record command their shapes.** epics.md explicitly requires AD-23's run-record fields, AD-16's manifest, AD-24's configuration list, the Scoring Policy's five fields, and lineage on every artifact. Defining a `state` enum is AD-24 work; deriving a state is AD-33 work.

Where the AC of record does **not** command a shape and the AD behind it is on the excluded list, this story defines nothing. That is why the Probe stops at the prior art plus `probeClass` (Decision 1).

### Deliberate absences

Each is recorded in the owning artifact's own `.meta` description with the AD it owes and the expectation that it arrives as an **additive `schemaVersion` bump** under AD-11 — the treatment Story 1.3 gave `sensitivityWitnesses`. **Argue each one once, in the description; the ACs above do not repeat them.**

| Absent | Artifact | Owed to | Why not now |
| --- | --- | --- | --- |
| Run mode | SealedRunRecord | Owed item 4 | Score-side open defect; its fix is separate input types with separate ladders |
| Observation ordering | SealedRunRecord | Owed item 2 | Score-side open defect; ADR-006 forbids using array position and the fix is a monotonic sequence |
| Probe qualification record | Probe | AD-9 | Five prose routes with no field names; the AC of record does not command it, AD-9 is excluded, and no probe artifact exists to fixture it against |
| Defect signature | Probe | AD-40 | Same, plus Owed item 7: *"AD-40's signature schema has no fixture to land in"* |
| Sensitivity witnesses | EvalContract | AD-10 | Inherited from Story 1.3, unchanged |

### Read these files before writing anything

1. `src/core/schemas/primitives.ts` — every identifier, digest, date, decimal, and value-container shape you need, including `ProbeId`, `DefectId`, and `FindingId`, defined in Story 1.3 **for this story** and still unused.
2. `src/core/schemas/eval-contract.ts` — the artifact-level pattern, the lineage fields you are about to lift, and `Budgets`, `Behavior`, `ScopedResource`, `FORBIDDEN_INPUT_FLOOR`.
3. `src/core/schemas/pointer.ts` — three pointer spellings; you export two vocabularies out of it without rebuilding its pattern.
4. `src/core/schemas/interface.ts` — `RequestShape`, whose `header` description you must not delete.
5. `src/core/schemas/rubric.ts` — `RubricBody`, already split for you.
6. `src/core/schemas/constraint-ledger.ts` — the address shape you widen.
7. `tests/schemas/fixtures/reject-cases.ts` and `tests/schemas/reject-fixtures.test.ts` — copy this pattern exactly.
8. `tests/schemas/constraint-ledger.test.ts` — the five assertions AC 16 changes.

### Prior art, verbatim, in this repository

Do not reconstruct these from the spine; they are files under `experiments/hypothesis-validation/schemas/`: `h0-run-result.schema.json`, `h0-ground-truth.schema.json`, `isolation-manifest.schema.json`, `artifact-ref.schema.json`, `private-evidence-manifest.schema.json`.

A real populated isolation manifest is at `experiments/hypothesis-validation/independent-evaluator/isolation-manifests/cc-h0-03-independent-mut2.json`. Worth reading in full: it is the only record of what a sealed evaluator actually did, and its `observedToolCalls` list is the evidence behind Decision 11.

`experiments/` is exempt from AD-18 and is a closed record. Never edit it.

### Superseded statements you will meet in the ADRs

The ADRs are correction rounds and several still carry the text they overturned:

- **ADR-001 Decision 3 lists five forbidden inputs.** ADR-005 corrected it to seven, adding comparator results and human labels. `FORBIDDEN_INPUT_FLOOR` is the seven. Do not encode the five.
- **ADR-003 Decision 9 and ADR-002 say "a closed eleven-artifact set."** ADR-005 Decision 7 overturned it: the Evaluator Configuration joined, and the inventory is twelve and explicitly provisional.
- **ADR-007's determinism hedge is struck by ADR-008**, and four of its table promises are withdrawn — including AD-24's stage-signature table, which does not exist and is Owed item 6. Nothing here may cite that table as though it did.

### Two cross-cutting readings this story settles

**Every one of the twelve is a hashed artifact.** AD-36 restricts numbers "in a hashed artifact" and AD-27 defines an artifact digest over any artifact's canonical serialization; the spine never draws a line. Read the restriction as universal. It costs nothing — `z.int()` already exports the safe-integer bounds — and the alternative is a per-artifact judgement with no rule behind it. This is why Decision 9 converts money in the isolation manifest too, not only in the run record.

**The forbidden-input `contains` constraint needs no ledger entry.** AD-13 names it as something Zod cannot express: *"`z.array()` exposes no `contains` API at all."* Under the admit-rule it needs no expression at all: AD-16 makes an omitted floor member the coded failure `forbidden-input-floor-incomplete`, so a short list must parse and the compiler rejects it. Recorded so nobody adds the injection AD-13's example seems to invite.

### Verified facts about Zod 4.4.3 on this pin — do not rediscover these

- `.refine()` and `.check()` are silently dropped from `z.toJSONSchema`. `.describe()` and `.meta({ description })` survive.
- `z.strictObject` emits `additionalProperties: false` identically in input and output mode. `.default()` does not — it drops the key from `required` in input mode only.
- `z.tuple([a, b])` exports `prefixItems` alone: no `minItems`, no `maxItems`, no `items`.
- `z.int()` → `type: "integer"` with safe-integer bounds. `z.literal(1)` → `{"type":"number","const":1}`, losing `integer`.
- `z.array(x).min(1)` → `minItems: 1`; `.max(0)` → `maxItems: 0`.
- `z.record(k, v)` exports `propertyNames` plus a schema-valued `additionalProperties`, never a `required` array. `z.record(enumSchema, v)` demands every enum member at parse time.
- `z.discriminatedUnion` exports as `oneOf`; address a branch by its discriminator const, never by index. A boolean literal discriminator parses, so `Probe`'s `expectedClean` union is sound. `.meta({ id, description })` on a union exports `{ $schema, oneOf, description }`, so AC 3's root-description test works for all three union-rooted artifacts.
- `z.iso.datetime()` accepts a trailing `Z` and rejects a numeric offset.
- Zod emits no `$id` at any level; the root schema is inline rather than in `$defs`. `.meta({ id })` names the `$defs` key.
- Issue codes you will assert against: **`invalid_format` for a failed `.regex()`** — not `invalid_type`, and it is what most reject cases need — plus `unrecognized_keys` (path `[]` for a root-level extra key), `invalid_union`, `too_small`, `too_big`, `invalid_type`, `invalid_value`.
- `noUncheckedIndexedAccess` is on, so `result.error.issues[0]` is possibly-undefined. `noExplicitAny` is off only under `tests/**`. `noFocusedTests` is an error, so a stray `it.only` fails lint.

### Previous story intelligence (Story 1.3)

- Story-text counts are estimates until executed. Story 1.3's own ACs miscounted twice. Verify every count in this document against the code before repeating it in the Dev Agent Record.
- Review round 2 found three tests that passed for the wrong reason, all the same shape: a test asserting an outcome the schema would have produced anyway. One passed two operands to a one-tuple, so arity dominated and it would have stayed green with `descriptor: z.any()`. **Write each test so it fails if the property it names is removed.**
- Naming `Expression`, `Operand`, and the input-binding channel with `.meta({ id })` shrank the Story 1.3 export from 65,710 to 43,927 bytes. Eleven new artifacts will inline shared shapes aggressively; name the shared ones.
- Coverage is not measured: `@vitest/coverage-v8` is not installed and zero new dependencies are allowed. AD-30's 90 percent floor binds at Epic 6. Every branch is instead exercised by a named fixture, which is why AC 18's enumeration requirement is not optional.

### Testing requirements

Per AD-30: `core/` is tested only with in-memory artifact fixtures. No filesystem I/O at test runtime, no network. Every published constraint has its single-mutation negative fixture, and every conditional branch has a positive case.

### References

- [Source: _bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md#Structural-Seed] — the twelve-artifact inventory and the six prior-art correspondences
- [Source: …#Consistency-Conventions] — strictness, the `JsonValue` exception, enum casing, RFC 3339 UTC, explicit `null`, identifier prefixes, the Configuration rule that puts policy in an artifact
- [Source: …#AD-2] — the package ingests a run record, an isolation manifest, and an evaluator configuration as three separate inputs
- [Source: …#AD-4] — three-valued resolution, the single introduction condition, per-node recording in the evidence
- [Source: …#AD-6] — the closed twelve outcome states, trial count, invalidated attempts and reasons
- [Source: …#AD-7] — the per-class catch-rate vector, named denominator, excluded probes, canary and clean-control exclusion
- [Source: …#AD-8] — private-artifact manifest, sanitization policy, digests recomputed from resolved bytes, results referencing a sealed set by digest
- [Source: …#AD-9] — probe class, `expectedClean`, the qualification routes this story defers
- [Source: …#AD-10] — pre-flight's bounded check list, the exemption, the required fixture digest
- [Source: …#AD-11] — `schemaVersion`, the scoring version's five inputs, additive-bump discipline
- [Source: …#AD-12] — remediation cap, caller-attested, presented lineage chains
- [Source: …#AD-13] — Zod as source of truth, conditionals become discriminated unions, the constraint-injection table
- [Source: …#AD-16] — the isolation manifest's fields, the forbidden-input floor, what the brief carries and excludes
- [Source: …#AD-17] — judge results inside the run record, `judge-error`, truncation disclosed with its bound
- [Source: …#AD-18] — no secrets or subject data in any artifact
- [Source: …#AD-21] — the four verdicts, the two modes, "the two verdicts never share a field", the evidence-integrity FAIL rung
- [Source: …#AD-22] — anchored scale levels, named penalties, bounded length
- [Source: …#AD-23] — provenance, finding types, dispositions, observation identifiers and quoted evidence on `defect`
- [Source: …#AD-24] — prior-art correspondence, the run record's carry-over list, the evaluator configuration's field list, the trial-index exclusion
- [Source: …#AD-26] — the closed channel vocabulary and the four transport channels
- [Source: …#AD-27] — digest form; no artifact carries its own digest
- [Source: …#AD-29] — parent digest and revision count, owned by the producing stage
- [Source: …#AD-32] — the possibly-buggy caller; the evaluator configuration digest agreeing across two artifacts; caller-attested inputs
- [Source: …#AD-33] — the closed corroboration set, and why `not-evaluable` and `insufficient-evidence` are never merged
- [Source: …#AD-35] — logical interface identifiers only; never a URL, host, or port
- [Source: …#AD-36] — the value domain, money and large integers as strings
- [Source: …#AD-40] — the defect signature this story defers, and the measured-versus-reconstructed distinction
- [Source: …#Owed-to-the-reference-implementation] — items 2, 4, and 7
- [Source: …/EPIC-BRIEF.md#Epic-1] — done-when, must-not, and the not-in-scope AD list
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.4] — the acceptance criteria of record
- [Source: _bmad-output/implementation-artifacts/1-3-…md] — the admit-rule, the caller-keyed-map list, the unenforced-in-v0 list, the Zod facts

## Decisions taken during story creation

Each is settled with a stated default and its downstream consequence. Proceed unless the epic or the user amends it; record the outcome in the Dev Agent Record.

1. **The Probe stops at the prior art plus `probeClass`.** AD-9's five-route qualification record and AD-40's defect signature are deferred. Three things point the same way: the epic's AC of record commands neither — its second clause enumerates required fields for exactly four artifacts and the Probe is not among them — both ADs are on the epic brief's not-in-scope list, and Owed item 7 records that the repository contains no probe at all, `P-001` being cited by the worked record and defined nowhere, so AD-40's signature "has no fixture to land in". Defining a five-branch union and a four-part signature against no artifact is the construction this story refuses for run mode and observation ordering. **What the deferral buys, beyond scope:** a clean control is identified by `expectedClean: true` alone, which is what AD-9 says the boolean is for — *"ratifying the prior art's record-level field rather than adding a fifth class"* — and AD-7's vector exclusion reads directly as `probeClass !== 'canary' && !expectedClean` instead of reaching into a qualification branch. **What it costs:** AD-9's "an unqualified probe cannot enter a sealed set" is enforced nowhere in v0, which is AC 16 entry 13. **Consequence:** the epic that builds the corpus owns both, each arriving as an additive `schemaVersion` bump recorded in the field's own description.

2. **The isolation manifest's "fifteen" is sixteen.** The prior art's `required` array has sixteen members. The fifteen describe the run; `violation` is the invalidation outcome. All sixteen are carried and the discrepancy is recorded so nobody re-derives it.

3. **`sha256` becomes `digest`.** The prior art names the field `sha256` and its value already begins with `sha256:`. One shared `Digest` primitive, one field name. An AD-24 divergence; the value form is byte-identical.

4. **`conditionArm` is an opaque string on both the run record and the manifest.** AD-24 demotes it explicitly: *"retained as an opaque caller label with no product semantics."* The prior art's five-member enum does not survive, and its `self-review` extension history is the reason — an enum a local amendment had to widen once will be widened again.

5. **`EvaluatorRecommendation` is `PASS | CONCERNS | FAIL`, and that closes an AD-21 rung.** AD-24 commands a closed enum; the prior art's `NOT_APPLICABLE` was legal only for the `scripted` arm, which has no successor. AD-21's Invalid rung for *"an unrecognised evaluator recommendation value"* is thereby unreachable for a schema-valid artifact: an unrecognised value fails to parse and becomes an AD-28 `schema-parse-failure`, and a fault never becomes a verdict. It is the verdict vocabulary minus `WAIVED`, so it reuses the existing uppercase exception rather than adding one. **Consequence to hand forward:** the Epic 6 ingest story either validates the recommendation leniently and maps an unrecognised value to the rung, or accepts that the rung fires only as a fault.

6. **`evaluatorConfigurationDigest` is a bare digest on both the run record and the isolation manifest.** AD-32 requires the digest to *agree* between the two, and neither prior art carries the field, so an agreement rule was asserted over two fields that did not exist. An `ArtifactReference` on one side against a bare digest on the other makes the comparison lopsided; AD-2 already has ingest receiving the Evaluator Configuration as its own input, so nothing needs resolving through a reference. Both required and non-nullable, which is what makes the substitution cost two contradictions rather than one omission.

7. **`taskId` becomes `contractId` on the manifest and is dropped from the run record and the probe.** "Task" is experiment vocabulary with no product meaning. The manifest keeps an identifier because it is the artifact `core/ingest` matches against a run; the run record and probe already pin what they describe by digest.

8. **`sanitizationPolicy` is per entry and is an opaque non-empty string, nullable.** AD-8's *"carrying the sanitization policy applied to **it**"* takes the entry as its nearest antecedent, and per-entry is the only reading that survives a manifest holding a raw trace beside a human label — different artifacts get different treatment. Opaque rather than an enum for the reason `ScopedResource.kind` is opaque: no AD supplies a value space, and inventing one is the unshaped-declaration defect in reverse. `null` spells "none applied", which must stay representable.

9. **Money is `UnsignedDecimalString` everywhere, including the isolation manifest.** Decision 18's universal value domain requires it, and the prior art's `costUsd`-as-number in `resourceCeilings` and `actualResourceUse` does not survive. An AD-24 divergence in three places, each with a description.

10. **`expectedGate` does not survive.** The prior art carries an expected verdict on a ground-truth record. AD-40 makes detection a signature match rather than a verdict comparison, and AD-7 keeps comparisons inside the dominance vector. Carrying an expected gate invites a comparison the architecture forbids.

11. **The brief carries interface identity, not the operation inventory.** AD-16 says "permitted interfaces" and AD-5's graph predicate names *"exhaustive operation inventories"* as a scripting shape. Shipping the inventory on the brief hands the evaluator the action list AD-39 exists to keep from it, one artifact over from where the predicate looks. The evidence it costs nothing is in the repository: `cc-h0-03-independent-mut2.json` records the independent evaluator discovering the search parameter by trying `?search=`, `?query=`, and `?q=` in turn, and that arm detected the defect. **Consequence:** Epic 2's `seal` renders `{ logicalId, kind }`; if a fixture later proves an evaluator cannot proceed without more, the addition is an additive bump.

12. **`ArtifactReference` carries no lineage and no `schemaVersion`.** This reads AD-11's *"Every artifact carries an integer `schemaVersion`"* narrowly, and the narrowing is the decision: `ArtifactReference` is a reference shape embedded in other artifacts rather than one that crosses the boundary alone, and versioning every embedded reference adds a key to every finding and every manifest entry for no reader. It is in the Structural Seed's inventory because it is published, not because it is exchanged. The exemption is named in its description, carried as `carriesLineage: false` in the registry, and asserted.

13. **`trialIndex` lands on the Sealed Run Record.** AD-24 excludes it from the Evaluator Configuration *"so trials pool into one scoring version"*, which requires it elsewhere, and Owed item 1 reduces results per `(probeId, trialIndex)`. The run record is the only artifact that carries one trial. `z.int().min(1)`, one-based, matching the only instance that exists. **Consequence:** Owed item 1's reducer inherits a one-based index.

14. **`probeId` on a finding is required; only `oracleId` is nullable.** AD-23 carves out the no-oracle case and nothing else, and the only uncited finding in the repository — worked record `F-003` — carries `oracleId: null` alongside `probeId: "P-001"`. A finding arises during some probe's run, so citing the probe is always possible; a finding that answers no declared oracle is the case AD-23 preserves.

15. **Confidence is the closed unit interval.** AD-24 requires *"per-finding confidence on a declared scale"* and declares no scale — the F2 unshaped-declaration signature. `z.number().min(0).max(1)` exports `minimum` and `maximum` natively, matches the worked example's `0.95`, and gives AD-21's confidence-threshold comparison two operands on one scale. The scoring policy's `confidenceThreshold` uses the same shape.

16. **`ConstraintLocation` gains an `artifact` name, and the lineage entries are generated.** `{ kind: 'root' }` was unambiguous with one root and is ambiguous with twelve, which defeats the ledger's purpose. Eleven entries, ids `lineage-${artifactKey}`, filtered on `carriesLineage`. **Consequence for Story 1.5:** it reads `location.artifact` to pick a file, and a hand-written twelfth entry is a bug.

17. **`observationIds` is on every finding branch; `quotedEvidence` is defect-only.** AD-23's word is *additionally*, a floor on `defect` rather than a prohibition elsewhere, and the architecture's own record puts observation identifiers on `confirmation` and `observation` findings. The union still expresses the required/not-required split through `.min(1)`.

18. **The value domain is universal across the twelve.** The spine never separates hashed from non-hashed artifacts, so the restriction binds all of them. Cheap to hold and it removes a per-artifact judgement nothing governs.

19. **The Evidence Artifact records a per-node check resolution.** AD-4 requires it in terms that name the artifact, and omitting it erases the distinction the three-valued resolution exists to carry. Recursive and named; Epic 3 fills it. The introduction vocabulary is one member because AD-4 closes the introduction set at one.

20. **`strength.basis` distinguishes measured from reconstructed, and there is no separate `rawCounts`.** AD-40 forbids pooling a containment-reconstructed detection with a measured rate. AD-7's "raw counts alongside" is satisfied by the per-class entry carrying `caught` and `exercised` beside `rate`; a second copy is one more thing to disagree with itself.

21. **AD-17's truncation disclosure lands on the Sealed Run Record as two fields.** AD-21 gates FAIL on four evidence-integrity conditions and no artifact declared any of them. Two are caller statements and go on the record the caller produces; two are derived. The bound is an integer with its unit in the description, matching how Story 1.3 handled AD-22's equally unitless "bounded length".

22. **The Evidence Artifact carries the scoring version's five inputs, not just the computed digest**, and `callerAttestedInputs` is an enum over those five key names so the attestation is checkable. A bare digest leaves a reader unable to recompute it and leaves AD-8's sealed-set reference and AD-32's attestation statement with nothing to point at.

23. **AD-12's lineage-chain compliance is three named booleans, not one.** The AD supplies the vocabulary in the same sentence the field comes from — *"length consistent with the declared revision, no repeated digest, no gap"* — so enumerating them is transcription, which is what AC 9 does for the pre-flight check kinds and AC 11 does for the introduction condition. A single boolean would tell a reader that a chain failed and not which of three ways, on an artifact whose whole purpose is to be read. AD-21's FAIL rung reads the conjunction.

24. **`selectedObservationIds` is recorded on every outcome now, not deferred.** AD-40 names it as *"what the witness match resolves against and what AD-33 records on the outcome"*, and AD-33 states it as a present requirement. Owed item 2 is about selection determinism, which is a different question from whether the selection is recorded.

25. **`resourceCeilings` is not `Budgets`.** `Budgets` is the contract's declared three-key ceiling that AD-16 puts on the brief; `resourceCeilings` is the harness's five-key record of what it enforced, including two token counts the contract never declares. One shape for both would make a declaration and an observation the same field.

## Dev Agent Record

### Agent Model Used

claude-opus-5[1m] (Claude Opus 5, 1M context), via the `bmad-dev-story` workflow.

### Debug Log References

No blocking failures. Four checkpoints worth recording:

1. `npm run check:docs` was run before the first edit, per AC 18. It was green (53 files), so the
   Story 1.3 whitespace problem did not repeat.
2. Zod behaviour on the pin was re-verified rather than assumed, before any schema was written:
   reused schema instances inline with no `__schema0` (only `.meta({ id })` and self-reference
   produce a `$defs` entry); `.meta({ id, description })` on a discriminated union exports
   `{ $schema, oneOf, description }` with no `properties`; a boolean literal discriminator parses and
   exports `const: true`; a spread object literal adds no `$defs` entry; a root-level extra key gives
   `unrecognized_keys` at path `[]`.
3. After the AC 2 lineage refactor the full Story 1.3 suite passed unmodified (553 tests), which is
   what AC 2 requires. Exactly the four assertions AC 16 predicted then failed once the registry and
   the widened ledger landed, and no others.
4. The 58 reject cases and the 79 worked-example issues were run against the real schemas rather than
   hand-predicted; every asserted path and code is what the parser actually produced.

### Completion Notes List

**What shipped.** Eleven artifact schemas, two leaf vocabulary modules (`lineage.ts`, `verdict.ts`),
the twelve-entry registry, and a widened constraint ledger. `npm run validate` is green end to end:
typecheck, lint, `check:docs`, `lint:spine` (0 findings), `check:vectors`, and the test suite.

**Test counts, measured.** 553 tests in 17 files before, **799 tests in 21 files after** (+246).
The reject corpus for the eleven new artifacts is **68 cases**; the worked-example corpus asserts 60
issues on the run record and 19 on the evidence artifact. (The pre-review record said 58 cases; that
was the reject file's *test* count, which is the 56 cases it then held plus its two meta-assertions.
Review caught it, and it is exactly the mistake the story's own rule about verifying counts against
code exists to prevent.)

**Every decision in the story was taken as written.** Decisions 1 through 25 stand; none was
overturned during implementation. Four things the story left open were settled by construction and
are recorded here.

1. **A shared `Severity`, and a shared `InterfaceKind`.** AC 15's reuse list names twelve shapes and
   omits the three-member severity vocabulary, which five new sites needed, and the four-member
   interface-kind vocabulary, which the brief needed. Six and two copies of one closed vocabulary is
   the drift the Conventions exist to prevent, so `SEVERITY_LEVELS`/`Severity` are exported from
   `eval-contract.ts` beside `Behavior` and `INTERFACE_KINDS`/`InterfaceKind` from `interface.ts`.
   Verified byte-neutral: an enum carrying no `.meta({ id })` inlines at each use site exactly as the
   inline literal did.
2. **`ORACLE_DISPOSITIONS` is exported from `sealed-run-record.ts` and imported by
   `evidence-artifact.ts`.** An outcome's `disposition` is the evaluator's own statement carried
   through, so it is one vocabulary. The direction is the pipeline direction, ingest to emit, and is
   therefore the opposite of the dependency AC 11 forbids when it moves `Verdict` out to
   `verdict.ts`; the outbound artifact may read the inbound one's vocabulary, never the reverse.
3. **The accept fixture for the clean-control probe branch is `zero-action`, not `defect`.** A
   `defect` class beside `expectedClean: true` is exactly the contradiction AC 16 entry 10 names as
   unenforced, so it belongs in the admissions list rather than in an accept fixture.
4. **The "no schema module imports `constraint-ledger.ts`" rule is documented, not tested.** A test
   proving it would have to read source files, and AD-30 forbids filesystem I/O at test runtime. The
   rule is stated at the `ConstraintLocation` declaration with the failure it prevents; the graph is
   acyclic today and a cycle would fail at module load, which every test in the suite would surface.

**AC 2, measured rather than asserted.** The `EvalContract` export was compared property by property
against `HEAD` in a scratch worktree. Every property schema is byte-identical and the `required` set
is unchanged. Two differences, neither from the lineage spread: `properties.rubrics` became a `$ref`
because AC 13 names `RubricBody`, and `contractId` moved from second to fourth position because the
spread groups the three lineage fields. Property order in a JSON Schema `properties` object is not
semantic and no test reads it. Bytes went 50,457 to 50,795, the cost of `RubricBody`'s new
description. **Story-text byte counts are stale**: Dev Notes quote 43,927 for the Story 1.3 export;
the measured figure at `HEAD` was 50,457.

**AC 15's caller-keyed map list: this story adds none, and it is asserted rather than stated.** The
count stays at Story 1.3's six. `decodingParameters`, `responseBody`, and `responseHeaders` are
`JsonValue`-typed and sit inside the value container, on the same reasoning that kept reference-set
members out of the list; `forbiddenInputAccounting` is a seven-key strict object and exports a
`required` array rather than `propertyNames`. A test walks all twelve exports for a `propertyNames`
keyword whose value schema is not `JsonValue` and requires the result to be empty.

**AC 16's list grew by sixteen, each with an admission test** in `tests/schemas/ad5-admissions.test.ts`.
Three of the sixteen are recorded rather than exercised as mutations, because there is no shape to
mutate: AD-9's unqualified probe (nothing catches one in v0, the accepted cost of Decision 1),
AD-18's prohibition (a credential-shaped opaque string parses), and AD-17's retain-disconfirming rule
(no field on any artifact decides it). Entry 16 is confirmed rather than added: this story declares
no new keyed shape descriptor, asserted by scanning every export for `requiredKeys`/`permittedKeys`.

**The ledger.** 16 arity entries plus 3 fixed plus 11 generated lineage entries plus 2 AD-18 secrets
prohibitions. `resolve()` takes the union fallback AC 17 specifies, keyed on `oneOf`, requiring the
field in every branch, returning the first branch's copy; a test removes the field from one branch
and requires the address to stop resolving, so the fallback cannot certify a half-resolvable address.

**Prose style.** New comments and schema descriptions avoid the em dash as a clause connector, per
standing instruction. Three remain, all inside verbatim quotations from AD-12 and AD-23 that must
stay byte-exact.

### Review round 1, all fifteen findings addressed

Adversarial review ran in a separate session against this working tree and confirmed AC 2
byte-for-byte, the ledger's union fallback, the `carriesLineage` computation, the admit-rule, and all
twelve root descriptions. Fifteen findings, two of them decision-needed. None deferred.

**Decision 1: the two loosened prior-art bounds are restored, not renamed.** The prior art declares
`exclusiveMinimum: 0` on `resourceCeilings.maxWallClockMinutes` and `maxCostUsd`; both had become
inclusive, so a zero ceiling parsed and the divergence was recorded nowhere. Restoring beats naming:
AD-24 makes an unnamed divergence the defect, and a ceiling of zero is not a ceiling. The wall-clock
bound is now `z.number().gt(0)`, which exports `exclusiveMinimum` natively. The money bound needed a
new primitive, because Decision 9 retyped money from a JSON number to a string and
`UnsignedDecimalString` admits `"0"`: **`PositiveDecimalString`** in `primitives.ts`, whose pattern
is written as an alternation rather than with a negative lookahead, since JSON Schema's `pattern` is
ECMA-262 but several non-JavaScript validators compile with engines that have no lookahead, and AD-13
publishes this schema for exactly those consumers. Four reject cases cover both bounds, including
`"0.00"` so every spelling of zero is excluded rather than just the bare one. `Budgets.maxCostUsd` on
the contract is deliberately NOT changed: its prior art is the eval-contract schema, which sets no
such bound, and touching it would move the Story 1.3 export.

**Decision 2: `JudgeConfiguration.modelSnapshot` becomes required and non-nullable.** The no-judge
state had two spellings, the field-level `null` and an object of nulls, and the description claimed
only the first. `systemPromptDigest` stays nullable because a judge invoked with no system prompt of
its own is a real configuration rather than an absent one. Now the absent-judge state belongs to the
field and the partial state belongs to the shape, with no overlap.

**Three tests passed for the wrong reason and were rewritten.** The two-verdicts test flipped `mode`
on a document that also lacked the other branch's verdict, so it would have stayed green if the
branches regressed to sharing both; it is now asserted as `unrecognized_keys` in both directions.
`canaryProbe` was exported and imported by nothing, so the `canary` class was never parsed and
`probe.ts`'s own "a minimum would make a canary unrepresentable" rationale was proven by nothing;
`PROBE_CLASS_FIXTURES` now enumerates all four classes and asserts the set equals `PROBE_CLASSES`,
which needed a fourth fixture for `gameability`. Three of four root discriminators had no out-of-set
reject case; `mode`, `expectedClean`, and `findingType` now have one each.

**Two convention walks were checking less than they read.** The strictness walk checked document
roots only, so a lax object nested three levels down would have passed, and the required-versus-
declared walk only visited nodes that already carried `additionalProperties: false`, which is the
property the other test exists to establish. Both now walk every control object at every depth,
sharing one collector, with an aggregate assertion proving the walk actually descends rather than
stopping at twelve roots.

**Observation value domains are tightened where they were loose and stated where they stay loose.**
`responseHeaders` becomes `JsonObjectValue`: AD-26 gives `response-headers` a pointer tail, so a
scalar there leaves `/interactions/x/response-headers/Content-Type` addressing nothing, which is the
same defect the flat `callInputs` map carries. `responseStatus` gains `.min(0)` and says in its own
description why the upper end stays open. `exitCode` stays signed and says why. Regenerating the
worked-example corpus after the `responseHeaders` change moved five issue codes from `invalid_union`
to `invalid_type`; the count stays at 60 and 19.

**Remaining patches.** The production evidence fixture paired `productionVerdict: 'FAIL'` with
`exitCode: 0`, contradicting the AD-21 rule `verdict.ts` states, so `exitCode` moved out of the
shared block into each branch; verdict-versus-exit-code and duplicate `invalidatedAttempts` numbers
joined the unenforced-in-v0 list, which is now eighteen entries. `verdictBasis` members take
`.min(1)`, on the reasoning already carried by `InvalidatedAttempt.reason`. The three unit-interval
fields gained `too_small` cases. `WAIVED` as a recorded system recommendation is now shown to fail.
A failing pre-flight verdict finally has a positive fixture, and the two pre-flight fixtures together
cover all three outcomes. The learning-path mermaid drew a `lineage.ts -> artifact-reference.ts`
import that does not exist and contradicted the doc's own no-lineage bullet; the edge is gone.

**Counts after review:** reject corpus 56 to **68 cases**, suite 774 to **799 tests** in 21 files.
`npm run validate` green.

### File List

New, `src/core/schemas/`:

- `lineage.ts`
- `verdict.ts`
- `artifact-reference.ts`
- `private-artifact-manifest.ts`
- `sealed-run-record.ts`
- `isolation-manifest.ts`
- `evaluator-configuration.ts`
- `probe.ts`
- `preflight-verdict.ts`
- `scoring-policy.ts`
- `evidence-artifact.ts`
- `sealed-evaluator-brief.ts`
- `artifact.ts`

Modified, `src/core/schemas/`:

- `eval-contract.ts` (lineage spread; `SEVERITY_LEVELS`/`Severity`; `ForbiddenInput` type export)
- `rubric.ts` (published `Rubric`; `RubricBody` gains `.meta({ id })`)
- `pointer.ts` (`EVIDENCE_CHANNELS`, `TRANSPORT_CHANNELS`, the three-way partition)
- `interface.ts` (`INTERFACE_KINDS`/`InterfaceKind`)
- `constraint-ledger.ts` (`ConstraintLocation` gains `artifact`; generated lineage and AD-18 entries)

New, `tests/schemas/`:

- `artifact-registry.test.ts`
- `artifacts.test.ts`
- `artifact-reject-fixtures.test.ts`
- `worked-example-artifacts.test.ts`
- `fixtures/artifact-fixtures.ts`
- `fixtures/artifact-reject-cases.ts`
- `fixtures/worked-example-artifacts.ts`

Modified, `tests/schemas/`:

- `constraint-ledger.test.ts` (per-artifact documents, union fallback, the five changed assertions)
- `ad5-admissions.test.ts` (sixteen new unenforced-in-v0 admissions)
- `pointer.test.ts` (channel vocabularies and partition agreement)

Modified, elsewhere:

- `_bmad-output/project-knowledge/learning-path-step-by-step.md` (Step 4 and its table row)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (1-4 to in-progress, then review)

No change to `src/index.ts`, `package.json`, `package-lock.json`, `.npmrc`, `biome.json`, or any
workflow. Zero new dependencies.

## Change Log

- 2026-08-19: Review round 1 addressed, all fifteen findings, none deferred. Two decisions taken:
  the prior art's two exclusive resource-ceiling bounds are restored rather than renamed, which
  needed a `PositiveDecimalString` primitive to survive Decision 9's move of money to a string; and
  `JudgeConfiguration.modelSnapshot` becomes required so the no-judge state has one spelling. Three
  tests that passed for the wrong reason rewritten, both Consistency-Convention walks made total,
  `responseHeaders` retyped to a name-to-value map, and twelve reject cases added. 774 tests to 799.
- 2026-08-19: Implemented. Eleven artifact schemas, two leaf vocabulary modules, the twelve-entry
  registry, and the widened constraint ledger. 553 tests to 774. `npm run validate` green. Four
  points settled by construction and recorded in the Completion Notes: a shared `Severity` and
  `InterfaceKind`, the disposition vocabulary exported ingest-side and read emit-side, a
  `zero-action` clean-control accept fixture, and the ledger-import rule documented rather than
  tested under AD-30.

- 2026-08-19: Peer review round 3, wording pass over the union fallback. Two precisions, both taken: the fallback keys on `oneOf` because all three union roots are `z.discriminatedUnion`, with the `anyOf` counter-example named because both keywords appear in the same test file a dev will be editing; and it returns the first branch's copy without deep-comparing, because AC 2 spreads one shared literal into every branch.
- 2026-08-19: Peer review round 2, same fresh context, against the rewrite. One blocking finding, seven major, six minor; all addressed. Blocking: filtering the generated lineage ledger entries on `carriesLineage` fixed the twelfth address and left two of the remaining eleven unresolvable, because `Probe` and `EvidenceArtifact` are union-rooted and a union exports `oneOf` with no `properties` — `resolve()` now takes a union fallback requiring the field in every branch, and the two alternatives considered are recorded so they are not re-derived. Also: `carriesLineage` is verified against the schemas rather than counted, since a false-negative flag would silently drop a constraint from the ledger; AD-12's compliance evidence became its three transcribed checks rather than one boolean, on the story's own transcription precedent; `Verdict` moved to a `verdict.ts` leaf so the inbound artifact does not depend on the outbound one; `NO_PRIOR_ART` exported so AC 3's test does not hard-code six phrases; AC 3's divergence table gained its inclusion rule; AD-9's unenforced qualification rule, the probe-versus-defect behaviour disagreement, and AD-17's retain-disconfirming rule joined the unenforced list; and one stale cross-reference from the renumbering was corrected.
- 2026-08-19: Peer review round 1, fresh context. Four blocking findings, seventeen major, fourteen minor; all addressed. Blocking: the prescribed `artifact.ts` was an import cycle that fails at module load, so the lineage spelling moved to its own leaf module; the generated lineage ledger entries were twelve where one artifact carries no lineage, now eleven filtered on a registry flag; AC 15 sent the dev after a reject fixture that does not exist, since `EvidencePointer` has exactly one consumer and no case covers it; and the `EvidencePointer` widening was withdrawn entirely along with the AD-40 predicate it existed for — it did the thing EPIC-BRIEF's Epic 4 forbids, rested on an AD-5 code that does not fire on an unrooted pointer, and offered a false choice between widening and forking `expression.ts`. Also: `observationIds` moved to every finding branch, `probeId` became required, the scoring version's five inputs and AD-7's excluded probes and AD-40's selected observation identifiers were added, `rawCounts` dropped, six unnamed prior-art divergences recorded, the worked-example fixture instruction corrected from two failures to a full expected-issue corpus, and five changed test assertions named where the story had claimed three.
- 2026-08-19: Story created. Eleven artifact schemas scoped against the Structural Seed inventory, with twenty-five decisions settled by construction and five deliberate absences recorded against open items in *Owed to the reference implementation* and the epic brief's excluded ADs.
