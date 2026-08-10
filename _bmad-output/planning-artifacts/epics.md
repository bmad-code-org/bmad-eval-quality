---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-eval-quality-2026-07-17/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/EPIC-BRIEF.md
  - _bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/reviews/gate-c/FINDINGS.md
---

# evalcore (eval-quality) - Epic Breakdown

## Overview

This document decomposes the epic-ready compile-and-seal half of eval-quality v0 into implementable stories. The source of truth is ARCHITECTURE-SPINE.md revision 9 and EPIC-BRIEF.md; the PRD's VFR requirements govern product direction. Where this document and the spine disagree on a mechanic, the spine governs.

**Scope boundary, stated once:** stage one is `compile` and `seal` (AD-38). The `score` half is not epic-ready. No story in this document touches `score`, the reference reducer, outcome-state assignment (AD-33), the dominance vector (AD-7), probe qualification (AD-9), or detection mapping (AD-40). Those wait on the seven items in the spine's *Owed to the reference implementation* section.

## Requirements Inventory

### Functional Requirements

FR1 (VFR-2): The compiler converts a behaviour input into a versioned Eval Contract, enforcing discipline in three classes: structural errors fail compilation, coverage gaps score down without blocking, validated N/A is allowed and recorded with rule, rationale, machine-checkable condition, approval, and RFC 3339 expiry.
FR2 (VFR-2, AD-3): Every oracle carries a structured direction and a `check` expression; both are required. Alignment (evidence targets, relation, polarity contained in `check` after quantifier substitution) is a compile-time computation. Evaluator-facing prose is generated from the direction by `seal`, never authored free-form.
FR3 (AD-4): One closed operator vocabulary (11 operators, 3 connectives, 2 quantifiers) with fixed arity, three-valued resolution (`true`, `false`, `insufficient-evidence` introduced only by an empty-collection operand), total non-absorbing propagation, and total (never short-circuiting) evaluation.
FR4 (AD-5): One coded registry of compile-time failure codes (20 codes as of revision 9); every compile-time check cites a literal code; the published schema's failure-code enumeration is generated from the registry, never hand-maintained beside it.
FR5 (AD-19): The contract declares enough for every predicate to be decidable: behaviours with severity and observable success criteria, requirement/risk linkage, operation inventory (closed method set, `{name}` path templates, state-change marker, request shape over four transport channels, per-operation response descriptor with channel roles, nominated success indicator, volatile pointers), sibling groups (explicit empty allowed), expected cardinality (`exact` | `at-most` | `page-bounded`), reference sets, and an interaction plan.
FR6 (AD-20, AD-31): Seven discipline rules, closed by version; fourteen published relevance/satisfaction predicates run as decision procedures over declarations only, fail closed, and emit coverage-gap records naming the predicates that fired.
FR7 (VFR-3, AD-16): The sealed brief carries behaviours, generated directions, interfaces, scoped resources, budgets, and safety limits. It never carries author commentary, the interaction plan, step identifiers, or any of the seven forbidden inputs (original spec, source code, repository, builder transcript, implementation logs, comparator results, human labels).
FR8 (AD-38, seal): `seal` deterministically generates evaluator prose from direction fields using non-imperative, non-sequential templates; reordering steps and negative domains produces a byte-identical brief; an emitted-brief scripting audit rejects prose exceeding its declared probe-step bound under a stable AD-5 code.
FR9 (AD-39): The interaction plan constrains relationships between observations, never the evaluator's path: steps are selectors (identifier, operation, selection predicate with tagged `literal`/`matcher` input bindings and an optional one-level temporal clause); the published graph predicate bounds depth, width, shared anchors, disjoint pairs, and exhaustive inventories under `plan-exceeds-scripting-bound`.
FR10 (AD-26): One addressing grammar: RFC 6901 pointers rooted at `/interactions/{stepId}/` over the closed channel vocabulary; `call-inputs` roots on the four transport channels; `@/` relative form only inside quantifiers; the reference-set operand is the single-keyed `{ "referenceSet": id }` legal in exactly three positions; `absent` is an observation, never an error.
FR11 (AD-13): Every artifact schema is defined once in Zod and exported byte-exactly to self-contained JSON Schema Draft 2020-12; constraints Zod cannot express live in a named constraint-injection table, one entry per constraint, each paired with its fixture; CI runs the rejection suite, drift check, differential check, and keyword-mutation check.
FR12 (AD-27, AD-36): One canonical digest computation: SHA-256 over RFC 8785 canonical JSON with explicitly fixed number serialization and UTF-16 code-unit key sort; hashed artifacts restrict numbers to finite binary64 with safe-integer integers; cross-language vectors are required CI fixtures.
FR13 (AD-10 compile half, AD-35): Pre-flight compiles a probe plan from the contract's declared interfaces and reduces caller-supplied observations to a pure verdict; the probe port is a policed default-deny network boundary; typed sensitivity witnesses per input-bearing operation.
FR14 (VFR-8, AD-14, AD-15): Every capability is reachable through both the library and the CLI; the CLI is an adapter with no logic of its own; nothing in the package references BMad, TEA, or planning artifacts.
FR15 (AD-22): Rubrics compile under checked rules (anchored scales, named failure-mode penalties, bounded length, evidence reachable, no reasoning-prose criteria); a zero-rubric contract compiles clean.
FR16 (AD-37): A conforming port adapter is defined by a published executable conformance suite, run in CI against every shipped adapter.
FR17 (AD-24, AD-29): Every artifact declares lineage and predecessor; artifacts are immutable, created once, carrying parent digest and revision count; exactly one stage owns each artifact.

### NonFunctional Requirements

NFR1 (AD-1): `core/` is pure and deterministic; no filesystem, network, clock, subprocess, or randomness; impurity enters only through ports awaited in `application/`; `node:crypto` is the one permitted builtin.
NFR2 (AD-2): The package executes nothing: no agent, evaluator, judge, or system under test; no provider SDK dependency; no network I/O in any module; v0 ships no network adapter.
NFR3 (AD-25): Every dependency across the full runtime and development transitive graph is permissively licensed (MIT, Apache-2.0, ISC, BSD-2-Clause, BSD-3-Clause, 0BSD); CI reports the exact dependency path for a violation.
NFR4 (Stack): Node floor `>=22.20.0` with a CI job on exactly 22.20.0; development and CI on Node 24; npm pinned 11.18.0 exactly and asserted in every CI job before install; TypeScript 7.0.2, Zod 4.4.3, Vitest 4.1.10 with Vite 7.3.1 override, Biome 2.5.5, @types/node 22.20.1; exact pins everywhere, no ranges.
NFR5 (Stack, supply chain): lockfile publication-age audit over every resolved registry entry runs before `npm ci`; canaries (young lockfile, git dependency, remote tarball) run the ordinary job path; `allow-git=none`, `allow-remote=none`, `min-release-age=7`.
NFR6 (AD-18): Secrets and subject data never enter a package artifact, published example, or test fixture; publication is blocked by an explicit release-workflow guard until the IP question is resolved in writing.
NFR7 (Epic 6 done-when): `core/` reaches 90 percent statement and branch coverage, tested only with in-memory fixtures and faked ports; no filesystem I/O outside a temporary directory; no network beyond AD-37's loopback fixture server.
NFR8 (VFR-8): ESM, Apache-2.0, unscoped npm name `eval-quality`, pre-1.0 SemVer with every caller-facing break called out.
NFR9 (standing constraint): the permutation fixture family runs against every stage that consumes an observation array: byte-identical evidence on repeat, identical outcomes under permutation.
NFR10 (standing constraint): the spine linter (`npm run lint:spine`) runs in CI with all three rules enabled; the four installed copies stay byte-identical.

### Additional Requirements

- Buildable order: `compile` + `seal` together are stage one (AD-38); `ingest`, `preflight`, `score`, `emit`, `cli` follow. Epics are sequenced so no story depends on a later epic's output.
- Repository housekeeping travels with the first story that touches the manifest and barrel: the package description, keywords, and `src/index.ts` comment describe the superseded engine and are rewritten, not left standing (Structural Seed).
- `schemas/` and `corpus/` are excluded from the formatter so lint and drift cannot fight (AD-13).
- Three Gate C authoring coin flips are settled by construction in the first schema story and recorded: oracle polarity declared once or twice, `set-membership` literal-array operand spelling, and requirement/risk linkage location (per behaviour vs. contract-level array).
- The TypeScript 7.0.2 migration changes four compiler behaviors across `tsconfig.json` and `tsconfig-build.json` (baseUrl removal, empty `types` default, `noUncheckedSideEffectImports`, `rootDir` default) and forbids disabling `esModuleInterop`, `allowSyntheticDefaultImports`, `alwaysStrict`.
- The API-shaped transcribed calibration corpus is fixture debt, not an epic gate; `mcp` interface support stays deferred.

### UX Design Requirements

None. The product is a library and a non-interactive CLI; there is no UI surface in v0 (VFR-8, AD-14).

### FR Coverage Map

| Requirement | Covered by |
| --- | --- |
| FR1, FR4 | Epic 4 (registry as code, structural checks); Epic 5 (coverage classes) |
| FR2 | Epic 1 (schema fields), Epic 2 (generation), Epic 4 (alignment computation) |
| FR3 | Epic 1 (arity in schema), Epic 3 (evaluation) |
| FR5 | Epic 1 |
| FR6 | Epic 5 |
| FR7, FR8 | Epic 2 |
| FR9 | Epic 1 (plan grammar in schema), Epic 4 (graph predicate) |
| FR10 | Epic 1 (operand shapes), Epic 4 (resolution and reachability) |
| FR11 | Epic 1 |
| FR12 | Epic 1 |
| FR13 | Epic 6 |
| FR14 | Epic 6 |
| FR15 | Epic 1 (rubric schema), Epic 6 (rubric compile checks) |
| FR16 | Epic 6 |
| FR17 | Epic 1 (lineage fields), Epic 6 (immutability enforcement) |
| NFR1, NFR2 | every epic; enforced structurally in Epic 4 (orchestration) and Epic 6 (ports) |
| NFR3, NFR4, NFR5 | Epic 1 (Story 1.1) |
| NFR6 | Epic 1 (Story 1.1 release guard), Epic 2 (brief content) |
| NFR7 | Epic 6 |
| NFR8 | Epic 1 (Story 1.1), Epic 6 (surface) |
| NFR9 | every epic's test strategy; first binds in Epics 2-3, when a stage first consumes an observation array |
| NFR10 | already wired (`lint:spine` runs in CI); kept green by Epic 1 (Story 1.1) |

Out of scope, recorded: VFR-7 scoring mechanics (score-side, owed), VFR-5 verdict derivation and emit (score-side), VFR-6 engine reuse (not in v0, no seam), VFR-1 detection (lives in the TEA client, outside this package).

## Epic List

- Epic 1: Zod schemas and the published JSON Schema export (5 stories)
- Epic 2: seal and deterministic brief emission (3 stories)
- Epic 3: the AD-4 evaluator, three-valued (3 stories)
- Epic 4: the addressing grammar and the compiler's structural checks (4 stories)
- Epic 5: the discipline-rule predicates and their contract fixture corpus (3 stories)
- Epic 6: ports, pre-flight, and the library and CLI surface (5 stories)

## Epic 1: Zod schemas and the published JSON Schema export

Implements AD-13, AD-19, AD-25, AD-26, AD-27, AD-36, AD-39, and the operator-arity half of AD-4. First because it is the only epic that settles field shapes by construction: every ambiguity Gate C's hand-authoring found that is not already fixed disappears the moment one schema exists. Done when every artifact schema is defined once in Zod and exported byte-exactly to self-contained JSON Schema Draft 2020-12, the constraint-injection table has one entry per constraint Zod cannot express, the differential check reports zero disagreements, the keyword-mutation check kills every generated keyword, and CI runs all four checks. Must not hand-maintain the failure-code enumeration beside AD-5's table.

### Story 1.1: Align the toolchain and supply chain to the Stack

As the maintainer,
I want the repository's toolchain, dependency graph, and CI pinned and audited exactly as the spine's Stack section requires,
So that every subsequent story builds on the verified dependency graph and the licence and supply-chain gates actually enforce instead of failing open.

**Acceptance Criteria:**

**Given** `package.json` currently carries caret ranges and the superseded engine's description,
**When** the manifest is aligned to the Stack,
**Then** every dependency entry is an exact pin: TypeScript 7.0.2, Zod 4.4.3 (new runtime dependency, the only one), Vitest 4.1.10, Biome 2.5.5, @types/node 22.20.1, with Vite resolved to 7.3.1 by override,
**And** a fresh install resolves zero `lightningcss` lock entries and the licence scan over every lock entry reports no violations,
**And** the description, keywords, and `src/index.ts` barrel comment describe the compile-and-seal product with no runner, assertion-DSL, grader, or trajectory language remaining.

**Given** the Stack's npm pin and the `.npmrc` policies,
**When** any CI job runs,
**Then** the job asserts `npm --version` equals 11.18.0 exactly before any install,
**And** a lockfile publication-age audit over every registry entry in the resolved graph runs before `npm ci` against the CI clock,
**And** the three supply-chain canaries (deliberately young lockfile, git dependency, remote tarball) run the ordinary job path and fail the way the policy requires.

**Given** AD-25's SPDX allowlist,
**When** CI runs the licence gate,
**Then** the scan covers the full runtime, development, optional, and platform transitive graph, passes on the allowlist (MIT, Apache-2.0, ISC, BSD-2-Clause, BSD-3-Clause, 0BSD, disjunctions satisfied by any operand), and reports the exact dependency path on a violation.

**Given** the TypeScript 7.0.2 migration notes in the Stack,
**When** `tsconfig.json` and `tsconfig-build.json` are updated,
**Then** `baseUrl` is deleted, `"types": ["node"]` is added, the `rootDir` interaction with `tsconfig-build.json` is resolved, and `npm run validate` (typecheck, lint, docs check, spine lint, tests) passes on Node 24 with a CI job proving the floor on exactly Node 22.20.0.

**Given** AD-18's publication gate,
**When** the release workflow is touched,
**Then** publication is blocked by an explicit guard in the workflow, not by policy prose.

### Story 1.2: Canonical digest computation and the hashed-artifact value domain

As an adopter integrating eval-quality artifacts into CI,
I want one canonical digest computation with an explicitly restricted numeric value domain,
So that two independent implementations never compute different digests from identical inputs and a non-TypeScript producer is told the rules rather than discovering them through a mismatch.

**Acceptance Criteria:**

**Given** any JSON artifact,
**When** its digest is computed,
**Then** the result is SHA-256 over the RFC 8785 canonical serialization, rendered as `sha256:` plus 64 lowercase hex characters, with numbers serialized per ECMAScript `Number.prototype.toString` and object keys sorted by UTF-16 code unit,
**And** composite digests are domain-separated objects with a fixed protocol tag, never concatenations; non-JSON bytes and directories have their stated digest forms.

**Given** AD-36's value domain,
**When** a hashed artifact is validated,
**Then** every number is a finite binary64 value, integers are within the safe range, larger integers and exact decimals are strings with declared formats, and lone surrogates and duplicate object keys are rejected before schema validation.

**Given** the cross-language risk,
**When** CI runs,
**Then** positive and negative canonicalization vectors pass, including the repository's own decimals (0.95, 0.99, 0.8, 0.04, 62.5) and the negative vector 9007199254740993.

### Story 1.3: The Eval Contract schema: declarations, operand grammar, and plan grammar

As a contract author (human, agent, or CI job),
I want the complete Eval Contract schema in Zod carrying every declaration AD-19 requires,
So that the fourteen discipline predicates are decidable from declarations alone and no authoring coin flip survives into implementation.

**Acceptance Criteria:**

**Given** AD-19's declaration list,
**When** the Eval Contract Zod schema is written,
**Then** it carries behaviours (severity, requirement/risk linkage, observable success criterion), oracles (structured direction plus `check`, both required), optional rubrics, permitted interfaces with logical identifiers, and a per-interface operation inventory declaring method (closed seven-member set), path template (`{name}` syntax only), state-change marker, request shape over the four transport channels, per-operation closed response descriptor, channel role per descriptor pointer (closed four-member set), nominated success indicator, and volatile pointers,
**And** sibling groups admit an explicit empty group, expected cardinality is a tagged mode (`exact` with count, `at-most` and `page-bounded` with bound), and reference sets declare identifier, key names, and object members.

**Given** AD-39 and AD-26,
**When** the plan and operand grammars are encoded,
**Then** interaction-plan steps declare identifier, operation, and selection predicate with input bindings tagged `{ "literal": ... }` or `{ "matcher": "any" | "type-violating" }` (never untagged), temporal clauses nest at most one level, evidence operands are RFC 6901 pointers rooted at `/interactions/{stepId}/` over the closed channel vocabulary, and the reference-set operand is the single-keyed `{ "referenceSet": id }`,
**And** operator arity is enforced in Zod as fixed-length tuples per operator (the schema-side half of AD-4; evaluation semantics are Epic 3).

**Given** the three Gate C coin flips,
**When** the schema is written,
**Then** each is settled by construction and recorded in the story's dev notes and schema descriptions: whether polarity lives once or twice on an oracle, whether `set-membership` admits a `{ "literal": [...] }` set operand alongside the reference-set form, and whether requirement/risk linkage lives per behaviour or contract-level,
**And** the settled shape keeps `missing-requirement-linkage` and AD-3's alignment predicate decidable.

**Given** the Consistency Conventions,
**When** any control object is defined,
**Then** it is `.strict()`, the named `JsonValue` container is the single schema-valued exception, enums are lowercase kebab-case except the four uppercase verdicts, dates are RFC 3339 UTC, absent values are explicit `null`, and identifier prefixes (`B-`, `O-`, `P-`, `W-`, `D-`, `F-`, `R-`, `RC-`) enforce three-plus zero-padded digits.

### Story 1.4: The remaining interchange artifact schemas

As an adopter producing or consuming eval-quality artifacts,
I want every interchange artifact in the inventory defined in Zod with its lineage and prior-art correspondence declared,
So that the caller-facing boundary is fully typed before any pipeline stage exists.

**Acceptance Criteria:**

**Given** the Structural Seed's twelve-artifact inventory,
**When** the schemas are written,
**Then** Rubric, Sealed Evaluator Brief, Sealed Run Record, Isolation Manifest, Evaluator Configuration, Probe, Artifact Reference, Private Artifact Manifest, Pre-flight Verdict, Scoring Policy, and Evidence Artifact are each defined once in Zod alongside the Eval Contract,
**And** each declares in its description the prior-art schema it succeeds or an explicit absence of prior art, per AD-24.

**Given** the ADs that require specific fields,
**When** the schemas are reviewed against them,
**Then** the Sealed Run Record carries findings with per-finding confidence, one disposition per required oracle, observation identifiers and verbatim quoted evidence with channel on every `defect` finding (AD-23), the Isolation Manifest enumerates required fields seeded from the prior art's fifteen and accounts for each forbidden input by name (AD-16), the Evaluator Configuration carries the AD-24 field list with trial index deliberately excluded, and the Scoring Policy enumerates severity floor, confidence threshold, minimum trial count, re-execution cap, and remediation cap,
**And** every artifact carries lineage fields (parent digest, revision count) per AD-29.

### Story 1.5: The published JSON Schema export and its four CI checks

As a non-TypeScript consumer of the published schemas,
I want the generated JSON Schema to be provably equivalent to the Zod source, constraint by constraint,
So that a constraint existing only as a Zod refinement can never be silently invisible to me.

**Acceptance Criteria:**

**Given** the Zod schemas of Stories 1.3 and 1.4,
**When** the export generator runs,
**Then** each artifact exports to a self-contained JSON Schema Draft 2020-12 file under `schemas/` in output mode, with shared shapes duplicated into local definitions, `$id` synthesized by the generator, `$defs` keys named via `.meta({ id })`, and `schemas/` excluded from the formatter,
**And** the failure-code enumeration in the published schema is generated from the AD-5 registry table, never hand-maintained.

**Given** constraints Zod cannot express,
**When** the constraint-injection table is built,
**Then** it is named and enumerated with one entry per constraint paired with its fixture, operator arity among them with `minItems` alongside `items: false` per `prefixItems` tuple.

**Given** the four CI checks,
**When** CI runs,
**Then** the rejection suite passes with every negative case being a valid positive fixture mutated to violate exactly one constraint, asserting the expected validator keyword and instance path,
**And** the byte-exact drift check, the differential check (zero disagreements between Zod acceptance and published-schema acceptance over generated inputs), and the keyword-mutation check (every removed keyword kills at least one fixture) all pass and are wired into `pr-checks.yml`.

## Epic 2: seal and deterministic brief emission

Implements AD-3, AD-16, AD-38, and the brief-facing half of AD-39. Done when `seal` deterministically generates evaluator prose from AD-3's direction fields, the brief carries what AD-16 permits and nothing else, reordering produces byte-identical output, and the emitted-brief scripting audit rejects prose exceeding its bound. Must not call a model, execute an evaluator, expose step identifiers, or copy the throwaway Gate D generator into the package.

### Story 2.1: The direction-prose generator

As a sealed evaluator,
I want directions generated from declared structure using non-imperative, non-sequential templates,
So that I receive the oracle content that produced the measured effect without receiving a script.

**Acceptance Criteria:**

**Given** an oracle's structured direction (evidence targets, relation, polarity, scope, negative domain),
**When** `seal` generates its prose,
**Then** the output is deterministic, names observations through the derived reference vocabulary (operation plus selection predicate, never step identifiers), emits no imperative sequence, and the Gate D generated-current-fields prose passes as an accept fixture.

**Given** the temporal read-back collision recorded in AD-16,
**When** the generator renders a temporal pair,
**Then** it emits a relational dependency phrase that names what must be compared without prescribing sequence, or, if no candidate survives the authored adversarial fixtures, records a bounded ordering disclosure and AD-39 is amended explicitly rather than the choice hiding in a template.

### Story 2.2: Brief assembly, exclusions, and canonical ordering

As the isolation boundary's owner,
I want the sealed brief to carry exactly what AD-16 permits, in canonical order,
So that the seal is real and byte-reproducible.

**Acceptance Criteria:**

**Given** a compiled contract,
**When** `seal` emits the brief,
**Then** it carries behaviours, generated directions, interfaces, scoped resources, budgets, and safety limits, and excludes author commentary, the interaction plan, step identifiers, and all seven forbidden inputs,
**And** negative-domain members and every semantically unordered declaration render in canonical sorted order,
**And** reordering contract steps and negative domains produces a byte-identical brief, proven by the brief-diffing check.

### Story 2.3: The emitted-brief scripting audit

As the discipline's enforcement point,
I want a post-generation audit over the emitted brief,
So that generated prose cannot smuggle in the enumerated path the declaration-side predicate cannot see.

**Acceptance Criteria:**

**Given** an emitted brief,
**When** the scripting audit runs,
**Then** prose exceeding the declared bound on enumerated probe steps is rejected under a stable AD-5 code, and the audit runs after generation as `seal` acceptance work, not as a declaration-side substitute.

## Epic 3: the AD-4 evaluator, three-valued

Implements AD-4 in full: the closed operator vocabulary, connectives, quantifiers, `covers-by-key` as a bijection, and three-valued resolution. Must not map `insufficient-evidence` onto an outcome state; this epic stops at resolution and records it.

### Story 3.1: Scalar operators over the evidence domain

As the enforceable half of every oracle,
I want the eleven scalar and structural operators implemented as pure functions with fully specified semantics,
So that two implementations cannot resolve one expression differently.

**Acceptance Criteria:**

**Given** the closed operator set,
**When** each operator is implemented,
**Then** `equality`, `deep-equality` (structural over canonical JSON), `containment`, `existence`, `absence`, `regex` (ECMA-262, fully anchored, backreferences and lookbehind rejected at compile time, match-step budget breach is a fault), `set-membership`, `ordering` (observed output only), `count-tolerance` (absolute unless `relative`), and `shape` (closed descriptor, never embedded JSON Schema) resolve per AD-4,
**And** `absent` operands resolve per AD-26 (`existence` false, `absence` true, comparisons false), type mismatches resolve false without coercion.

### Story 3.2: Connectives, quantifiers, and three-valued resolution

As the discipline's fail-closed guarantee,
I want three-valued resolution with total, non-absorbing propagation,
So that logically equivalent spellings of one intent agree on empty evidence and no oracle is discharged by an absence of evidence.

**Acceptance Criteria:**

**Given** any expression tree,
**When** it resolves,
**Then** every node resolves `true`, `false`, or `insufficient-evidence`, the third arising on exactly one condition: an operand denoting an empty collection, including a pointer the response descriptor types as a collection that resolves `absent`,
**And** propagation is total over `not`, `all`, `any` with no absorption (`all` keeps a genuine false decisive; `any` is deliberately weaker than disjunction), the value is terminal under both polarities including `expects-violation`, evaluation is total and never short-circuits, and every node's resolution plus any fired introduction condition is recorded.

**Given** the soft-delete pair that motivated the invariant,
**When** the fixture suite runs,
**Then** `for-all(page, absence(@/retractedAt))` and `not(for-any(page, existence(@/retractedAt)))` agree on a populated collection, an empty collection, and an absent collection.

### Story 3.3: covers-by-key as a bijection

As the completeness rule's only writable form,
I want `covers-by-key` implemented as a bijection with its degenerate cases inherited from the invariant,
So that omission, duplicate padding, and unexpected extras are all detected and an empty reconciliation never certifies.

**Acceptance Criteria:**

**Given** the operator's contract,
**When** it resolves,
**Then** it holds only on equal cardinality plus a distinct match per expected element on the named keys, two empty collections resolve `insufficient-evidence`, an `absent` operand resolves false, response-side duplicate keys resolve false, and contract-side duplicate keys failed compilation upstream,
**And** fixtures cover positive, missing, duplicate, unexpected, duplicate-key, and empty-set cases.

## Epic 4: the addressing grammar and the compiler's structural checks

Implements AD-26 resolution, AD-5's registry as code, AD-28, AD-34, and AD-39's plan predicate. Must not widen the pointer root to sometimes mean the contract.

### Story 4.1: Pointer resolution and reachability

As the compiler's and scorer's shared eyes,
I want one implementation of the addressing grammar,
So that the reachability check and any future evaluator read the same expression identically.

**Acceptance Criteria:**

**Given** an evidence operand,
**When** it resolves,
**Then** RFC 6901 pointers root at `/interactions/{stepId}/` over the closed channel vocabulary, `call-inputs` continues into the four transport channels, `@/` binds only inside quantifiers, unresolvable pointers yield the distinct value `absent`, and an operand addressing evidence unreachable through declared interfaces fails compilation under `unreachable-check-evidence`.

### Story 4.2: The AD-5 registry as code and the structural compile checks

As every AD that names a blocking code,
I want the registry implemented as the single generated-from source with each structural check emitting its literal code,
So that two compilers cannot invent incompatible failure vocabularies.

**Acceptance Criteria:**

**Given** the twenty-code registry,
**When** `compile` runs against a defective contract,
**Then** each structural check fires its literal code carrying the artifact path that produced it, coverage gaps record without blocking, waivers missing any required part fail under `waiver-incomplete`, and the published-schema enumeration and the compiler share one source.

### Story 4.3: The scripting-bound graph predicate and its adversarial fixtures

As the boundary between witness relations and scripts,
I want the published executable graph predicate with authored reject fixtures,
So that the line is drawn by a predicate a second implementer can run rather than a phrase they must interpret.

**Acceptance Criteria:**

**Given** a declared interaction plan,
**When** the predicate runs,
**Then** depth, width, shared anchors, disjoint pairs, and exhaustive operation inventories are bounded, violations fail under `plan-exceeds-scripting-bound`, temporal nesting past one level fails under `nested-temporal-clause`,
**And** the authored reject fixtures include the eight-step single-root chain and the sixty-four `write-N`/`read-N` pairs, accept fixtures come from the two transcribed real arms, and the count passing through the reject set is the boundary's stated strength.

### Story 4.4: Stages as pure plan-and-reduce pairs with one orchestration layer

As the hexagonal boundary,
I want compile-side stages shaped as pure plan-and-reduce pairs orchestrated in one layer,
So that impurity has exactly one entry point and stages stay reproducible.

**Acceptance Criteria:**

**Given** AD-34 and AD-28,
**When** the compile-side pipeline is assembled,
**Then** `application/` is the only layer that awaits ports and holds no decision logic, `core/` imports only `core/schemas`, every port shares the AD-28 contract shape (throws typed faults with machine codes, never in-band errors), and the dependency-direction rules are enforced by lint or test.

## Epic 5: the discipline-rule predicates and their contract fixture corpus

Implements AD-20's seven rules and all fourteen AD-31 predicates over AD-19's declarations. Must not publish the predicate table against the historical worked example.

### Story 5.1: The seven relevance predicates

As the compiler's judgment of what applies,
I want each rule's relevance predicate as a decision procedure over declarations only,
So that relevance never requires a run record or a reviewer.

**Acceptance Criteria:**

**Given** a compiled contract's declarations,
**When** the relevance predicates run,
**Then** all seven resolve per the Gate C table (success indicator plus channel roles; descriptor pointer count; typed request keys; collection locations; sibling groups with explicit empty as an answer; reference-set-naming collections; `stateChangeMarker: true`), reading declarations only.

### Story 5.2: The seven satisfaction predicates

As the enforcement of the measured taxonomy,
I want each rule's satisfaction predicate implemented with its exact denominator and branch rules,
So that a coverage claim is never satisfiable by reading nothing.

**Acceptance Criteria:**

**Given** the Gate C second-pass table,
**When** the satisfaction predicates run,
**Then** rule 2 covers every required key of the per-operation response descriptor of each addressed step's operation (never an interface-wide union, never permitted keys), rule 3 reads the `type-violating` matcher pairing, rule 6 branches on `expectedCardinality.mode` (`exact` requires `covers-by-key`; `page-bounded` and `at-most` require the injection form), rule 7 relates a state-changing step's `call-inputs` to a non-state-changing later step's `response-body`, and all fourteen predicates are declaration-only.

### Story 5.3: The contract fixture corpus and the regenerated table

As the proof the predicates work,
I want a hand-authored contract corpus exercising every rule in every relevance-and-satisfaction combination,
So that the published table is emitted by the implementation rather than maintained beside it.

**Acceptance Criteria:**

**Given** the fourteen predicates,
**When** the corpus and CI check are built,
**Then** one contract exists per rule per relevance-and-satisfaction combination, the predicate table is emitted by the implemented predicates and regenerated in CI, coverage-gap records name the relevance predicate that fired and the satisfaction predicate that failed, and the historical worked example is not a publication target.

## Epic 6: ports, pre-flight, and the library and CLI surface

Implements AD-1, AD-2, AD-10's pre-flight half, AD-14, AD-15, AD-18, AD-22, AD-24, AD-29, AD-30, AD-35, AD-37. Must not reserve an engine-reuse seam.

### Story 6.1: Ports and the published conformance suite

As the first external adapter author,
I want every port defined by an executable conformance suite,
So that the load-bearing boundary is implementable against something checkable.

**Acceptance Criteria:**

**Given** the port set (CorpusPort, EnvironmentProbePort, ClockPort, FileSystemPort),
**When** the conformance suite runs,
**Then** it asserts typed-fault throwing, exactly one underlying call per invocation, prompt abort rejection, and schema-valid returns, the probe port additionally proves default-deny including on redirect, CI runs the suite against every shipped adapter plus the in-repository probe adapter that exists as the suite's subject, and the suite is published at a documented subpath.

### Story 6.2: Pre-flight as plan, observation, and pure verdict

As the guard against the harness-defect class that produced the only false gate,
I want pre-flight compiled from the contract and reduced purely from observations,
So that an unverified fixture can never produce a scored run.

**Acceptance Criteria:**

**Given** a compiled contract,
**When** pre-flight runs,
**Then** the plan derives from declared interfaces, probing happens only through the environment-probe port, typed sensitivity witnesses (pair of inputs plus expected AD-4 relation over the volatile-excluded projection) exist per input-bearing operation with positive and input-blind negative fixtures per operation shape including a path-parameter-only safe read, a witness resolving `insufficient-evidence` fails the pre-flight, state reset is verified differentially with the repeated-read immutability branch, every declared seeded fault is observed to fire, the verdict is pure over observations and carries the fixture digest, and a failed pre-flight invalidates rather than becoming a contract signal.

### Story 6.3: Rubric compilation under checked rules

As the judge path's discipline,
I want rubric authoring rules enforced at compile time,
So that a rubric can never ask a sealed evaluator a question it cannot answer from observable evidence.

**Acceptance Criteria:**

**Given** a contract with rubrics,
**When** it compiles,
**Then** unanchored scales, unbounded length, or missing named failure-mode penalties fail under `rubric-unanchored`, unreachable criterion evidence fails under `rubric-evidence-unreachable`, reasoning-prose criteria fail under `rubric-scores-reasoning-prose`, rubrics and criteria are addressable identifiers, and a zero-rubric contract compiles clean.

### Story 6.4: Artifact immutability and lineage enforcement

As the audit trail,
I want artifacts created once with explicit lineage,
So that a revision is a new artifact and history cannot be rewritten in place.

**Acceptance Criteria:**

**Given** any artifact-producing stage,
**When** it emits,
**Then** artifacts are never edited in place, carry parent digest and revision count, exactly one stage owns each artifact type, and no command mutates an input in place.

### Story 6.5: The library and CLI surface

As every caller VFR-8 names,
I want each capability reachable through both surfaces with the CLI holding no logic,
So that a capability reachable one way and not the other cannot ship.

**Acceptance Criteria:**

**Given** AD-14 and AD-15,
**When** the surface ships,
**Then** each CLI command translates arguments into one orchestration call plus serialization, commands are non-interactive with machine-readable default output, inputs arrive by path or stdin and outputs go to a run-scoped directory with diagnostics on stderr, the package declares a `bin` entry and exports the library, the generated-schema subpath, the conformance-suite subpath, and the development corpus, `core/` reaches 90 percent statement and branch coverage on in-memory fixtures, and nothing references BMad, TEA, or planning artifacts.
