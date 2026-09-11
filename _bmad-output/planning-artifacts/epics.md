---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-eval-quality-2026-07-17/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/EPIC-BRIEF.md
  - _bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/reviews/gate-c/FINDINGS.md
  - _bmad-output/planning-artifacts/epic-11-handoff.md
---

# evalcore (eval-quality) - Epic Breakdown

## Overview

This document decomposes the epic-ready compile-and-seal half of eval-quality v0 into implementable stories. The source of truth is ARCHITECTURE-SPINE.md revision 9 and EPIC-BRIEF.md; the PRD's VFR requirements govern product direction. Where this document and the spine disagree on a mechanic, the spine governs.

**Scope boundary for Epics 1 through 6, stated once:** stage one is `compile` and `seal` (AD-38). No story in Epics 1 through 6 touches `score`, the reference reducer, outcome-state assignment (AD-33), the dominance vector (AD-7), probe qualification (AD-9), or detection mapping (AD-40). Those waited on the seven items in the spine's *Owed to the reference implementation* section. Epics 1 through 6 shipped as `eval-quality@0.1.0` and qualified under `TEST-PLAN-NEXT-STEPS.md`.

**Scope boundary for Epic 7, which opens v1.** Epic 7 is the work that closes those seven items: pure reference functions with generated fixtures for AD-21, AD-33, and AD-40, run against the worked chain plus synthetic records, with the tables emitted rather than promised. It delivers reference implementations and their generated tables. It does not ship the `score` or `emit` stages or a `score` CLI command; `stage-table.ts` still carries `module: null` for both when the epic ends, and epic 8 is what fills them in. Two shipped surfaces do move: the generated AD-21 ladder carries an exit code and a `--strict` column because a ladder without them is not AD-21's table, and mode entering `ScoringVersionInputs` makes every scoring version computed before the epic non-comparable with every one after. Epic 7's own preamble states both.

**Scope boundary for Epic 8, which finishes v1.** Epic 8 fills in the three stages Epic 7 left at `module: null` — `ingest`, `score`, and `emit` — and puts a `score` command and a library call on top of them. Everything it composes already exists as a pure reference function; what it adds is the one orchestration path through them, the validation `ingest` owns, the evidence artifact `emit` mints, and the adapter AD-14 permits. It closes the remaining half of owed item 1 by changing `score`'s stage-table row to consume a trial set in the same story that gives `score` a module. When it ends, `scripts/worked-example-target.ts` no longer hand-composes the chain: it calls the shipped stages, which is what makes the worked example evidence rather than a parallel implementation.

## Requirements Inventory

### Functional Requirements

FR1 (VFR-2): The compiler converts a behaviour input into a versioned Eval Contract, enforcing discipline in three classes: structural errors fail compilation, coverage gaps score down without blocking, validated N/A is allowed and recorded with rule, rationale, machine-checkable condition, approval, and RFC 3339 expiry.
FR2 (VFR-2, AD-3): Every oracle carries a structured direction and a `check` expression; both are required. Alignment (evidence targets, relation, polarity contained in `check` after quantifier substitution) is a compile-time computation. Evaluator-facing prose is generated from the direction by `seal`, never authored free-form.
FR3 (AD-4): One closed operator vocabulary (11 operators, 3 connectives, 2 quantifiers) with fixed arity, three-valued resolution (`true`, `false`, `insufficient-evidence` introduced only by an empty-collection operand), total non-absorbing propagation, and total (never short-circuiting) evaluation.
FR4 (AD-5): One coded registry of compile-time failure codes (21 codes as of revision 9, 23 after Story 7.3); every compile-time check cites a literal code; the published schema's failure-code enumeration is generated from the registry, never hand-maintained beside it.
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
- The API-shaped transcribed calibration corpus does not exist. The measured contracts declare MCP interfaces, and `mcp` compiles and pre-flights since epic 11, so the calibration evidence establishes that this package admits the contracts behind the measured effect in the interface kind they were written in, and leaves unmeasured whether the effect survives an interface change. What stays deferred for `mcp` is the text channel, per AD-19.

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

Out of scope for Epics 1 through 6, recorded: VFR-7 scoring mechanics (score-side, owed), VFR-5 verdict derivation and emit (score-side), VFR-6 engine reuse (not in v0, no seam), VFR-1 detection (lives in the TEA client, outside this package).

### v1 requirements, added with Epic 7

FR18 (AD-24, Owed 6, remaining half): the sealed run record carries a required mode supplied at ingest and never derived, which is the one half of the stage-signature item Story 6.4 left open.
FR19 (AD-39, Owed 2): the run record carries a recorded monotonic sequence, every step declares its selector cardinality, and every outcome records the observation identifiers it was resolved against.
FR20 (AD-19, Owed 3): input bindings admit a cycle-free captured-value matcher over an earlier step's scalar output and `testData` bindings for named principals and resources, under one set of cycle-free type-checked rules.
FR21 (AD-40): a probe declares a defect signature rooted in transport identity, and detection is a deterministic witness match over cited observation identifiers with quotation audited against them.
FR22 (AD-33, AD-6): outcome states are resolved by a total reference decision procedure whose enumerated table is generated from the procedure and covered by fixtures over the input space.
FR23 (AD-7, Owed 1): `score` consumes a trial set, reduces to one result per probe under a published aggregation, and emits a rate vector under a four-valued dominance relation with no weighting.
FR24 (AD-21, AD-11, Owed 4 and 5): production and contract scoring have separate input types and separate total ladders, mode enters version identity, cross-mode comparison is rejected, and an uncited defect finding has a rung in each mode.
FR25 (Owed 7): the worked chain and its probe corpus entry are regenerated from the reference functions as a CI-checked command, with hand-filled downstream values forbidden.
FR26 (AD-11, AD-13, NFR8): every interchange schema Epic 7 touches is bumped and republished with AD-13's four checks green in the story that touched it, and the epic's caller-facing breaks are disclosed once under pre-1.0 SemVer.

| Requirement | Covered by |
| --- | --- |
| FR18 | Epic 7 (Story 7.1) |
| FR19 | Epic 7 (Story 7.2) |
| FR20 | Epic 7 (Story 7.3) |
| FR21 | Epic 7 (Story 7.4) |
| FR22 | Epic 7 (Story 7.5) |
| FR23 | Epic 7 (Story 7.6) |
| FR24 | Epic 7 (Stories 7.7, 7.8) |
| FR25 | Epic 7 (Story 7.9) |
| FR26 | Epic 7 (Stories 7.1-7.8 per-story bumps, Story 7.10 disclosure) |

Also added with Epic 7: FR21 covers AD-9's per-class qualification record and the gate that rejects an unqualified probe, which the shipped probe schema records as enforced by nothing in v0.

### v1 requirements, added with Epic 8

FR27 (AD-16, AD-23, AD-24): `ingest` validates a sealed run record against its isolation manifest, evaluator configuration, and private artifact manifest, produces the validated observations `score` consumes, and records every invalidation condition it finds as data rather than throwing.
FR28 (AD-7, AD-24, Owed 1's remaining half): `score` consumes a trial set, orchestrates Epic 7's reference functions into the outcome and verdict values `emit` serializes, and its stage-table row declares both that trial set and its own module.
FR29 (AD-24, AD-29): `emit` mints the evidence artifact from the scored outcomes and verdict and is its sole producer, with the lineage edge the stage table already declares.
FR30 (AD-14, AD-21, AD-34): a `score` command translates its arguments into one application call and serialization, takes its exit code from the ladder's own resolution, honours `--strict` through the ladder's strict-promotion flag, and reaches no capability the library cannot.
FR31 (AD-11, AD-38, NFR8): the worked chain and the development corpus are regenerated through the shipped stages rather than a parallel composition, and the epic's caller-facing CLI and library surface change is disclosed on release.

| Requirement | Covered by |
| --- | --- |
| FR27 | Epic 8 (Story 8.1) |
| FR28 | Epic 8 (Story 8.2) |
| FR29 | Epic 8 (Story 8.3) |
| FR30 | Epic 8 (Story 8.4) |
| FR31 | Epic 8 (Story 8.5) |

Still out of scope after Epic 7: the shipped `score` and `emit` stages and their CLI surface (epic 8), VFR-6 engine reuse, VFR-1 detection, and every entry in the spine's *Deferred* section.

Still out of scope after Epic 8: VFR-6 engine reuse, VFR-1 detection, and every entry in the spine's *Deferred* section, whose first item names `agentevals` by name.

### v1 requirements, added with Epic 11

FR32 (AD-10, AD-19): the `mcp` interface kind declares its probe semantics: a per-kind operation shape carrying a tool identity AD-40 can resolve a defect signature against, a request shape over the one channel a tool call has, and a response descriptor with a stated answer for an unstructured tool result.
FR33 (AD-10): `compile` and pre-flight admit an `mcp` interface, and `web` alone keeps failing under `unsupported-interface-kind` with the same code and the same message.
FR34 (AD-35, AD-37): `ProbeRequest` and `ProbeObservation` carry an `mcp` member, and a reference MCP adapter implements `EnvironmentProbePort` for the mechanism under a deny-by-default target policy whose authorized targets live in configuration outside the contract.
FR35 (AD-37, AD-31): a third conformance arm defines what any future MCP adapter author has to satisfy, and AD-31's fourteen predicates are graded for the kind in its own coverage file rather than through the cell table.
FR36 (AD-13, AD-11, AD-5): the published schema census, the fixture corpus, the dev corpus, the worked example, and the AD registries carry the third kind, every one of them regenerated through its generator rather than hand-edited.
FR37 (VFR-8, documentation truth): every page describing what eval-quality can be pointed at is true without a qualifier, and the doc-invocation check reports the tool-use guide's own invocation faithful rather than substituting a stand-in for it.
FR38 (evidence, five shapes): each of the three system shapes whose guide records something unproven carries shipped evidence, so a seeded defect scores against a skill contract with `strength.defect` a real number, a dev-corpus contract declares a `{ captured }` binding and a `fixtureReset` and runs end to end through its four control legs, and an `api`-kind chain runs against a service the suite starts with observations produced by a real probe. The package still executes nothing under evaluation, so pointing it at a third-party production service stays the caller's adapter by design.

| Requirement | Covered by |
| --- | --- |
| FR32 | Epic 11 (Stories 11.1, 11.3, 11.4, 11.6) |
| FR33 | Epic 11 (Story 11.5) |
| FR34 | Epic 11 (Story 11.13) |
| FR35 | Epic 11 (Story 11.7) |
| FR36 | Epic 11 (Story 11.8) |
| FR37 | Epic 11 (Stories 11.2, 11.9) |
| FR38 | Epic 11 (Stories 11.10, 11.11, 11.12) |

Still out of scope after Epic 11: the `web` kind, which keeps failing under `unsupported-interface-kind` and has had no design pass; the held-out probe corpus; the second experiment round; VFR-6 engine reuse; and every remaining entry in the spine's *Deferred* section. A harness that supplies the parts this package refuses to ship is recorded as a bmad-tea idea in `_bmad-output/planning-artifacts/after-eval-quality-a-bmad-tea-evaluate-skill.md` and belongs to that repository rather than this one.

## Epic List

- Epic 1: Zod schemas and the published JSON Schema export (5 stories)
- Epic 2: seal and deterministic brief emission (3 stories)
- Epic 3: the AD-4 evaluator, three-valued (3 stories)
- Epic 4: the addressing grammar and the compiler's structural checks (4 stories)
- Epic 5: the discipline-rule predicates and their contract fixture corpus (3 stories)
- Epic 6: ports, pre-flight, and the library and CLI surface (5 stories)
- Epic 7: the score reference implementation (10 stories) — v1
- Epic 8: the shipped ingest, score, and emit stages and their CLI surface (5 stories) — v1
- Epic 9: the interface kind a contract can describe (5 stories) — v1, shipped. Its register is `_bmad-output/implementation-artifacts/epic-9-context.md`.
- Epic 10: a real adapter for the environment-probe port (1 story) — v1, shipped. Its register is `_bmad-output/implementation-artifacts/epic-10-context.md`.
- Epic 11: the fifth interface kind, the evidence for the other four, and the documentation that describes them (13 stories) — v1

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

## Epic 7: the score reference implementation

Implements AD-6, AD-7, AD-9, AD-11, AD-21, AD-23, AD-32, AD-33, AD-39's binding half, and AD-40. This is the epic the spine's *Owed to the reference implementation* section prescribes, quoted: "implement AD-21, AD-31, AD-33, and AD-40 as pure reference functions with generated fixtures, run them against the worked chain plus synthetic records, and let the tables be output rather than promise." Four consecutive review rounds converged on that step independently.

**Why this epic is writable now, and what it may not do.** The spine's rule is "no epic touches `score` until these close," and this epic is the work that closes them. It delivers pure reference functions and the tables those functions emit. It does not ship the `score` or `emit` stages, a `score` CLI command, or any wiring of a verdict into a process exit: `src/core/lineage/stage-table.ts` carries `module: null` for `ingest`, `score`, and `emit` at the start of this epic and still does at the end. Epic 8 is what fills those in, and it becomes writable when this epic's tables exist.

**Two things this epic does change on shipped surfaces, stated up front because the first draft of this preamble denied both.** The AD-21 ladder table it generates carries an exit code per rung and a column saying whether `--strict` promotes that rung, because a ladder without them is not the table AD-21 specifies; what stays in epic 8 is the CLI reading those columns, and `--strict` itself already ships at `src/cli/arguments.ts:104`. And mode entering AD-11's identity inputs changes `ScoringVersionInputs`, so every scoring version computed before this epic is non-comparable with every version after it. Story 7.10 states that break rather than letting a reader discover it.

**AD-31 is absent from this epic on purpose.** Revision 9 freed AD-31's fourteen predicates to stage one by moving their publication target from the worked example to a compile-side contract fixture corpus, and Story 5.3 delivered that: `src/core/coverage/`, `scripts/generate-ad31-table.ts`, and `check:ad31-table` in `npm run validate`. The spine's quoted sentence predates the move. Re-opening AD-31 here would rebuild shipped work. AD-12 is likewise absent: its validated half shipped in `src/core/lineage/chain.ts` and nothing here adds to it.

**AD-9 is in scope for one reason.** Its per-class qualification record is deliberately absent from the shipped probe schema, which names the cost plainly: "AD-9's 'an unqualified probe cannot enter a sealed set' is enforced by nothing in v0." AD-40's discriminating-condition rule is checked "at corpus qualification time," so the gate has to exist before Story 7.4's rule can fire. Story 7.4 builds both.

**Owed-item coverage, stated with its one exception.** Item 6 is half closed already — Story 6.4 shipped the stage-signature table as `src/core/lineage/stage-table.ts`, and its `score` row names the outcome-and-verdict containing type. Only the run-mode half stayed open, and Story 7.1 closes that half and restates nothing else. Item 2 closes in 7.2, item 3 in 7.3, item 4 in 7.7, item 5 in 7.8, item 7 in 7.9.

Item 1 closes only halfway here, and the epic says so rather than claiming a clean sweep. Its two verified halves are the missing reducer and the fact that no stage signature consumes more than one run record. Story 7.6 closes the first as a pure reference function. The second is a change to `score`'s row in the stage table, and `score` has `module: null` for the whole of this epic, so changing its declared inputs before anything reads them would put a signature in the table that no code satisfies. It lands in epic 8, in the same story that gives `score` a module. The reference reducer is what makes that change safe to write, which is the order the spine asks for.

**Schema breaks travel with the story that causes them.** Five published interchange schemas change here: the sealed run record, the eval contract, the probe, the evidence artifact, and the sealed evaluator brief. The first four are each already annotated in shipped source as owing the change; the brief is the one the first draft of this epic missed, and Story 7.3 carries it, because AD-19 exists to stop a contract compiling while omitting fields the executing caller depends on and the brief is the only channel to that caller. Every story that touches a schema carries its own `schemaVersion` bump, its `npm run generate:schemas` regeneration, and AD-13's four checks in its own acceptance criteria, so no story depends on a later one to be releasable. Story 7.10 collects only what is genuinely epic-level: NFR8's caller-facing disclosure and the scoring-version non-comparability statement.

**One spine edit is in scope, and it is a registry append.** AD-5's own rule is that "an AD that commands a compile-time check without adding a code here is a defect in that AD", and `scripts/check-ad5-registry.ts` asserts set *and* order equality between AD-5's table and `src/core/failure-codes.ts`. So the two codes Story 7.3 mints cannot land without two new rows in that table, and `npm run validate` fails until they do. Story 7.3 ships those rows in its own diff. That is a registry entry rather than a decision change: no AD's reasoning moves, and the spine's revision number does not.

**Decisions recorded here rather than as spine amendments.** Owed item 3 says of the cross-step identity gap "That is an ADR, and no story can absorb it." Story 7.3 absorbs it and decides every open behaviour by construction rather than naming them as decisions someone else will make. Story 7.2's selector-ambiguity condition is routed to AD-21's Invalid rung rather than to an AD-5 code, because AD-5 is compile-time only and `compile` never sees a run record; AD-28's fault vocabulary is disjoint from AD-5's and does not cover it either. Story 7.8 mints a score-side gap record distinct from AD-31's `CoverageGap`, because AD-31's relevance is "computed from declarations only, never inferred from the oracles" and its record requires a relevance predicate and a satisfaction predicate a runtime-discovered gap has neither of. In each case the reasoning is the spine's own: a decision written where the work happens is checkable against a fixture.

### Story 7.1: The run-mode source and the sealed run record's mode field

As the run that can currently be relabelled after ingest,
I want mode carried by the sealed record itself,
So that the source of a scored run's mode is one named field rather than nothing.

**Acceptance Criteria:**

**Given** owed item 6's remaining half and the shipped stage table at `src/core/lineage/stage-table.ts`, which this story does not restate,
**When** the run record schema is bumped,
**Then** the sealed run record carries a required `mode` whose value space is exactly `production` and `contract-scoring`, the value is supplied by the caller at ingest and never derived, recomputed, or defaulted afterwards, a record with no mode fails ingest validation as a schema error rather than degrading a verdict, `stage-table.ts`'s `ingest` row names mode among its inputs, the `schemaVersion` bump is breaking under AD-11 because the field is required, `npm run generate:schemas` regenerates the published export, and AD-13's rejection, drift, differential, and keyword-mutation checks all pass with a fixture for the new constraint.

### Story 7.2: A monotonic observation sequence and declared selector cardinality

As the guarantee that one sealed record produces one selection,
I want observation ordering recorded and selector cardinality declared,
So that a first-match scorer and a last-match scorer cannot bind different evidence.

**Acceptance Criteria:**

**Given** a run record and an AD-39 step selector,
**When** the reference selection procedure runs,
**Then** every observation carries a required strictly-increasing integer `sequence` that ordering reads and array position is read nowhere, AD-39's one-level temporal clause resolves from that sequence alone with the story recording why causal predecessors are not required for a one-level clause and what would reopen them, a temporal clause whose anchor step declared `any` and matched several takes the lowest-sequence match with that rule stated in the criterion, every `InteractionStep` declares a selector cardinality from `exactly-one`, `at-most-one`, and `any`, the procedure is pure and returns the matched observation identifiers in sequence order with a result of `none`, `one`, or `several` and assigns no AD-6 outcome state, `several` under `exactly-one` or `at-most-one` is a named ambiguity condition routed to AD-21's Invalid rung with the routing registered by Story 7.7 and the reason recorded here, permuting the observation array leaves the returned identifiers identical under the NFR9 permutation fixture family, the `Observation` JSDoc in `src/core/schemas/sealed-run-record.ts` stops calling this an additive bump, both `schemaVersion` bumps are breaking under AD-11 because both fields are required, and `generate:schemas` plus AD-13's four checks pass.

### Story 7.3: Captured-value matchers and test-data bindings

As the two critical-severity cross-user behaviours the calibration corpus cannot express,
I want a step bound to an earlier step's scalar output or to a named principal,
So that persistence read-backs and act-as-A-read-as-B oracles can be written down at all.

**Acceptance Criteria:**

**Given** the shipped `BindingValue` at `src/core/schemas/plan.ts:12`, a closed two-member tagged union whose tagging exists because AD-39 records that an untagged spelling flipped a witness match between `caught` and `missed` on one record,
**When** the grammar is extended,
**Then** the union gains exactly two tagged members and no untagged form — `{ captured: <AD-26 pointer> }`, whose pointer is rooted at an earlier step under `/interactions/{stepId}/` and must resolve to a scalar, and `{ principal: <name> }`, a fourth binding kind so all four resolve through one path — the principal name is an opaque label the harness maps to an account, carrying no account identifier and no subject data so AD-18 does not bite on the first real contract, `TestData` gains `principals` and `resources` as named typed declarations carrying no values so AD-19's prohibition on credential values in declarations still holds, `TestData.resources` is declared disjoint from the shipped `scopedResources` with the story stating that AD-16's forbidden-input check reaches both and `scoped-reference-resolves-forbidden` fires on either, the sealed evaluator brief gains the declared principal names so the executing caller has the channel AD-19 exists to guarantee, `src/core/seal/derived-reference.ts` gains the two new escalation-ladder renderings with `captured` rendered as a derived reference to the earlier step and never as that step's identifier because AD-16 keeps step identifiers off the brief, binding order is a topological evaluation over the reference graph and then sequence order within a tier, type equality requires the captured scalar's JSON type to equal the referenced parameter's declared type with a mismatch failing compilation, a captured pointer resolving `absent` at score time makes the referencing step select `none` under AD-26's rule that absent is an observation, multiple candidate tuples resolve through Story 7.2's declared cardinality on the referenced step so the two ambiguities have one answer, a reference cycle fails compilation under a new AD-5 code `binding-cycle` and a captured pointer naming a channel the referenced operation's response descriptor does not declare fails under a second new code `captured-channel-undeclared`, both added to `src/core/failure-codes.ts` and to AD-5's table in the same diff at a named position so `check:ad5-registry`'s set-and-order equality holds, the published failure-code enumeration is regenerated from the table, and the eval-contract and sealed-brief `schemaVersion` bumps plus `generate:schemas` and AD-13's four checks all land in this story.

### Story 7.4: The AD-40 defect signature, corpus qualification, and the witness match

As the reason `missed` is reachable at all,
I want detection proven by matching a finding to the defect its probe seeded,
So that the catch rate stops being 1.00 by construction.

**Acceptance Criteria:**

**Given** the shipped probe schema, which records AD-9's qualification record and AD-40's defect signature as deliberately absent,
**When** both land and the reference mapping runs,
**Then** a non-canary probe carries a required AD-9 qualification record and a required defect signature of interface kind, home operation as method and path template, observable channel, and a discriminating condition that is an AD-39 selector paired with an AD-4 predicate over AD-26 response channels rooted at the selected observation, the probe-side selector admits `literal` and `matcher` only with a fixture rejecting the two members Story 7.3 adds contract-side because AD-40 forbids contract-relative identifiers in a sealed-corpus field, template resolution erases parameter names before comparing so `/notes/{id}` binds `/notes/{noteId}` and a post-erasure collision fails compilation under the shipped `duplicate-operation-signature`, corpus qualification rejects a condition naming neither the response channel nor at least two channels and an unqualified probe cannot enter a sealed set, the mapping is pure and returns per probe exactly one of `matched`, `manifested-unclaimed`, `unwitnessed-claim`, `unexercised`, and `vacuous` together with the cited observation identifiers and assigns no AD-6 outcome state, `unwitnessed-claim` is AD-32's declared-versus-observed inconsistency and covers both of its forms — a detection claim whose cited observations satisfy no discriminating condition, and quoted evidence appearing in no cited observation — because AD-40 makes both invalidating and neither is a contract failure, a probe is exercised only when the evaluator itself invoked the signature's home operation with harness baselines, fixture set-up, and aborted calls the record shows never completing all excluded, `vacuous` is the signature resolving `insufficient-evidence` against every observation of its home operation, a defect finding matching no seeded signature is returned as an unmapped finding and never as a catch, the containment procedure over quotation exists only for records predating the identifier requirement and its results are labelled reconstructed, the reversed-order `matched`-to-`manifested-unclaimed` flip is fixtured on a synthetic two-observation record because the worked chain is not evidence until Story 7.9 regenerates it, the `Probe` JSDoc stops calling the qualification record and the defect signature additive bumps, and the probe `schemaVersion` bump plus `generate:schemas` and AD-13's four checks land here.

### Story 7.5: AD-33 as a total reference decision procedure with generated fixtures

As the single scorer the two incompatible scorers of revision 1 collapsed into,
I want every outcome state resolved by one total function whose table is output,
So that an expression's resolution has one defined meaning across two implementations.

**Acceptance Criteria:**

**Given** ingested findings, per-oracle dispositions, Story 7.4's match result, Story 7.2's selection result, AD-4 three-valued check resolutions, probe class, `expectedClean`, waiver state, the judge-conduct state AD-17 records on ingest, and the evaluation-fault signal AD-26 raises for an impossible operator application,
**When** the procedure runs,
**Then** it is the only component that assigns an AD-6 state and it is total over the input space with reachability resolving before disposition, `manifested-unclaimed` resolves `missed`, `unexercised` resolves `not-applicable`, `vacuous` resolves `infrastructure-error`, `unwitnessed-claim` routes to AD-21's Invalid rung and never to `missed`, because AD-40 makes an unwitnessed detection claim evidence that the reporting path is broken and scoring it as a contract failure is two exit codes away from the truth, the last two declared inputs exist so `judge-error` and `oracle-error` are derivable at all, `bypassed` is decided here by construction as an oracle whose waiver was applied without its condition being met with the reasoning recorded in the story, every disposition cites supporting observations and an unsupported disposition invalidates cross-artifact agreement rather than being believed, every `check` declares one polarity with `expects-hold` as the default, a satisfied `zero-action` probe resolves `caught` and never `passed-clean-control`, a finding citing no oracle is recorded as an uncited finding and routed by Story 7.8, every outcome carries a corroboration value from `agrees`, `disagrees`, `not-evaluable` with a check resolving `insufficient-evidence` recording `disagrees` where a finding was filed and `agrees` where none was and never `not-evaluable`, the generated fixture set reaches all twelve AD-6 states at least once and covers every feasible pairwise combination of the declared inputs with the infeasible pairs enumerated and asserted infeasible, the achieved counts are pinned in a committed baseline file that CI compares against so a drop fails the build, and the table is emitted by the procedure in CI rather than asserted in a document.

### Story 7.6: The trial-set reducer and the AD-7 rate vector

As the three-trial minimum that is currently unreachable,
I want a reference reducer over a trial set,
So that the product's central output can be computed rather than described.

**Acceptance Criteria:**

**Given** several trials of one probe,
**When** the reference reducer runs,
**Then** it is a pure function over a trial set rather than a change to any stage's shipped signature, results reduce to one per `(probeId, trialIndex)` and then to one per probe by requiring the catch in a strict majority of valid trials with the scoring policy able to declare a different threshold, the pass-if-any reading is rejected in code with its rejection fixtured because it is the retry anti-pattern AD-6 forbids, an invalid trial leaves both numerator and denominator and is recorded with its reason, a tie is impossible under a strict majority and the reducer asserts that rather than leaving it open, the emitted vector holds per probe class the catch rate over unique qualified probe identifiers with raw counts and the trial count alongside and the denominator named in the artifact, the relation is four-valued with `incomparable` reachable, a contract missing a behaviour at or above the severity floor never dominates one that caught it, comparability is the scoring-policy digest plus the corpus digest restricted to the shared probes with excluded probes recorded, canary probes and clean controls never enter the vector, and a check over the emitted vector's schema asserts that no field carries a weight, a percentage, or a severity-weighted composite.

### Story 7.7: Mode separation with two input types and two generated ladders

As the two exit codes that currently depend on which sentence a reader obeys,
I want production and contract scoring to have separate types and separate ladders,
So that one sealed artifact cannot derive both CONCERNS and FAIL.

**Acceptance Criteria:**

**Given** Story 7.1's mode field and AD-21's incomplete separation,
**When** the reference ladders run and their table is generated,
**Then** `ProductionAssessment` and `ContractAssessment` are separate input types, mode is read from the sealed record and is added to `SCORING_VERSION_INPUT_NAMES` and `ScoringVersionInputs` as a sixth field so a relabelled run cannot rescore under the same scoring version, `callerAttestedInputs` is widened with it because a caller-supplied mode is caller-attested under AD-32 and the test pinning the count at five moves with it, the story records that AD-11's five-field sentence is superseded by owed item 4's "mode ... entering identity" and that this is the supersession the spine asked for rather than a drift, cross-mode comparison is rejected and a `production` record paired with a `contract-scoring` artifact is rejected in both directions as an AD-32 cross-artifact disagreement, which is the agreement Story 7.1 could not place because no module held both artifacts at once, the Invalid rung gains the two conditions this epic's own stories create — Story 7.2's selector ambiguity and Story 7.4's `unwitnessed-claim` — so AD-21's enumerated list stays closed and complete, no rung promotes an ingested evaluator recommendation in a mode whose own text forbids it, each ladder is a pure total function over outcome state, evidence-integrity state, evaluator recommendation, coverage condition, waiver state, remediation state, and pre-flight state with first-match precedence and PASS as a rung rather than an `otherwise`, the generated table carries per rung its verdict, its exit code from the closed set PASS zero, WAIVED zero, CONCERNS zero, FAIL two, invalid three, structural compile failure four, thrown fault five, and whether `--strict` promotes it, with a CONCERNS whose only firing conditions are evidence conditions never promoted, no CLI file and no `emit` module changes in this story, and the evidence-artifact `schemaVersion` bump plus `generate:schemas` and AD-13's four checks land here.

### Story 7.8: A rung for uncited defect findings, and the record it writes

As SM-D4, the differentiating result of the whole experiment,
I want an evaluator-discovered defect that cites no oracle to move something,
So that finding a genuine uncontemplated defect stops producing exit code zero.

**Acceptance Criteria:**

**Given** an ingested defect finding citing no oracle,
**When** each ladder derives its verdict,
**Then** production mode resolves at least CONCERNS, contract-scoring mode records an `UncitedFindingGap` on the contract-scoring branch of the evidence artifact carrying the finding identifier, its cited observation identifiers, its quoted evidence, and its severity, that record is deliberately distinct from AD-31's `CoverageGap` because AD-31 computes relevance from declarations only and its record requires a relevance and a satisfaction predicate this gap has neither of, with the distinction and its reasoning recorded in the story, the finding is retained under AD-23 rather than discarded or forced into an AD-6 state, the rung appears in both generated ladder tables, the fixture is a synthetic record rather than the existing worked chain because owed item 7 forbids treating that chain as evidence until Story 7.9 regenerates it, and the evidence-artifact `schemaVersion` bump plus `generate:schemas` and AD-13's four checks land here.

### Story 7.9: Regenerate the worked chain and its probe corpus entry

As the reader who cannot inspect P-001,
I want the worked example regenerated from the reference functions,
So that the chain demonstrates a score rather than a promise.

**Acceptance Criteria:**

**Given** the reference functions of Stories 7.1 through 7.8,
**When** the chain is regenerated,
**Then** the probe corpus carries P-001 with Story 7.4's qualification record and defect signature, the run record carries Story 7.1's mode and Story 7.2's sequence, the contract, brief, run record, and evidence artifact are all emitted as output with no hand-filled downstream value, the step previously recorded `confirmed`/`agrees` while matching zero observations resolves through the Story 7.5 procedure instead, the two steps that each matched two observations resolve through Story 7.2's declared cardinality, the response shape revision 9 invalidated is reissued from the current schema, Story 7.4's reversed-order flip is re-run against the regenerated chain so the synthetic fixture is joined by the real one, `spike-worked-example/FINDINGS.md` records which of its retractions this closes and which stand, and regeneration is a CI-checked command rather than a one-time edit.

### Story 7.10: The epic's disclosed breaks and the non-comparability statement

As every caller pinned to `0.1.x`,
I want one place that states what this epic broke,
So that a version bump is a disclosure rather than a surprise.

**Acceptance Criteria:**

**Given** the `schemaVersion` bumps Stories 7.1 through 7.8 each made,
**When** the release notes are written,
**Then** every caller-facing break is called out under NFR8's pre-1.0 SemVer rule naming the artifact, the field, and whether the change is additive or breaking, the five touched interchange schemas — sealed run record, eval contract, probe, evidence artifact, sealed evaluator brief — each appear with their new `schemaVersion`, the probe schema is added to the surfaces AD-11's disclosure sentence enumerates because it did not name one, the two new AD-5 codes and the regenerated failure-code enumeration are listed among those surfaces, the disclosure states plainly that a pre-bump record reaches a caller as a parse failure and never as AD-28's `schema-version-mismatch`, since `src/core/schemas/lineage.ts` deliberately keeps `schemaVersion` as `z.int().min(1)` and nothing compares versions, and the statement that mode entering `ScoringVersionInputs` makes every scoring version computed before this epic non-comparable with every version after it is written down rather than left silently true.

## Epic 8: the shipped ingest, score, and emit stages and their CLI surface

Implements AD-14, AD-16's enforcement point, AD-23's ingest-side rules, AD-24's three unbuilt stage rows, AD-34's single published shape, and the remaining half of owed item 1. This is the epic Epic 7's preamble names three times: "Epic 8 is what fills those in, and it becomes writable when this epic's tables exist."

**Why this epic is writable now.** Every function it composes exists and is covered. `src/core/score/` holds thirteen modules and `npm run validate` is green over all of them. What does not exist is any path from a caller to any of them: nothing under `src/` imports `src/core/score/`, `src/application/index.ts` re-exports no score symbol, `src/index.ts` re-exports no score symbol, and `src/cli/arguments.ts:8` types `Command` as `'compile' | 'seal' | 'preflight'`. The one place the whole chain is composed is `scripts/worked-example-target.ts:1071`, a build script outside the package's own dependency graph, which assembles `OutcomeInputs` by hand at lines 1247-1272 and hardcodes `waiver`, `judgeConduct`, `evaluationFault`, and `preflightPassed` because no shipped code derives them. That script is the evidence this epic is buildable and the reason it must be built: a second composition living in `scripts/` is the parallel implementation AD-14's *Prevents* clause exists to stop.

**What Epic 7 left that this epic is obliged to pick up.** Three code-review findings were deferred with an explicit epic-8 trigger rather than closed, and each names the moment it fires. `src/core/score/reduce-trials.ts:98-105` has no runtime guard on a vote state outside the closed twelve, deferred as "worth a defensive `default` branch when the reducer is actually wired to a caller in epic 8". `src/core/score/reduce-trials.ts:92-95,115` never range-checks `catchThreshold`, deferred as "revisit when epic 8 wires a caller". `src/core/score/strength.ts:168-177` silently drops the earlier of two `Outcome` entries sharing one `probeId`, deferred until "the epic 8 artifact-emission code starts building `outcomes` arrays for real". Story 8.2 wires the first two callers and Story 8.3 is that artifact-emission code, so all three close inside this epic rather than moving again.

**One inherited claim is not true as written, and Story 8.4 settles it.** Epic 7's preamble states that the generated AD-21 ladder table "carries an exit code per rung and a column saying whether `--strict` promotes that rung". The data exists — `LADDER_EXIT_CODES` at `src/core/score/ladder.ts:156-162` and `LadderResolution.exitCode` and `.strictPromotable` at `:139-146` — but `docs/ad21-verdict-decision.generated.md` renders four columns, `Condition`, `Rung`, `Guard`, and `Evidence condition`, and no exit code appears in either ladder's table. `Evidence condition` is the strict column under another name, since `strictPromotable` is computed from `LadderConditionRow.evidenceCondition` at `ladder.ts:618-627`. The exit-code column is genuinely absent. Story 8.4 is the story that makes the CLI read those columns, so it is the story that adds the column the claim already promised.

**What this epic may not do.** No new interchange artifact and no `schemaVersion` bump. `validated-observations` and `scored-outcomes-and-verdict` are internal stage products that AD-24 exempts from publication, and `stage-table.ts` already carries both with `ownsInterchange: null`. No AD-5 code and no AD-28 code is minted: AD-28's ten-code registry already carries `non-canonicalizable-value`, the one fault that reaches a caller through `ingest`, and `schema-parse-failure`, which the application boundary raises before `ingest` sees anything, and AD-5 is compile-time only. No spine amendment and no new ADR: an ambiguity found mid-story is settled by construction in that story, as Epic 7 established. VFR-6 engine reuse stays deferred, and the spine's *Deferred* list, whose first entry is "Any engine integration, including agentevals", is untouched.

**The one architectural decision this epic must not get wrong, stated up front.** `ingest` returns what it found as data and raises nothing. AD-16's rule text names `core/ingest` as "the enforcement point: an absent, unparseable, incomplete, or violating manifest invalidates the run and records the reason", and AD-24 says ingest "computes its digest from the artifact and invalidates the run when it is absent or incomplete". Invalidation is a rung on AD-21's ladder; a thrown `RuntimeFault` is exit code 5. Two exceptions are named rather than assumed: `schema-parse-failure` is raised at the application boundary before `ingest` sees anything, following every shipped artifact parse, and `non-canonicalizable-value` propagates out of `auditQuotation` when a parsed record carries a value `core/canonical` rejects.

**Four conditions have no rung, and Story 8.2 owes them one.** Story 8.1 detects a dangling citation, a record-versus-manifest disagreement, an admitted prohibited input, and a malformed judge result, and neither shipped ladder has a row for any of them. AD-32 says its checks fail "invalidating rather than degrading a verdict", AD-17 says a malformed judge response "invalidates the run rather than becoming a low score", and AD-16's title carries a prohibited-input clause AD-21's Invalid enumeration never picked up. None may be routed to the FAIL row at `ladder.ts:404-412`, whose guard reads "internally inconsistent under AD-17". So Story 8.1 records them against a `null` ladder target and Story 8.2 adds the rows, which is a real dependency between the two rather than a deferral.

### Story 8.1: The ingest stage and the conditions it records

As the six schema fields and one AD that name `ingest` as their enforcement point and have no enforcer,
I want the stage built,
So that a sealed run record becomes validated observations with every condition named in the shape its consumer already declares.

**Acceptance Criteria:**

**Given** `stage-table.ts:89-104`'s `ingest` row, which already declares `sealed-run-record`, `isolation-manifest`, and `evaluator-configuration` as inputs, `mode` as its value input, and `validated-observations` as its owned internal product,
**When** the stage is built at `src/core/ingest/`,
**Then** the row's `module` names it and `src/core/stage-contracts.ts` gains a generic `IngestStage<Product>` on the `ReduceStage` pattern so the file keeps importing schemas only; the stage receives already-parsed artifacts and never parses, since every shipped `schema-parse-failure` over an artifact is raised in `application/`; it enforces cited-identifier resolution, quotation witnessing through the existing `auditQuotation`, an absent isolation manifest, a violating one, forbidden-input accounting admitting any of the seven floor members, record-versus-manifest agreement over `runId`, `contractDigest`, and `evaluatorConfigurationDigest` but not over `conditionArm`, which both schemas call an opaque label with no product semantics, and AD-17's record-decidable judge half where `JudgeResult.score` is `null`; each condition is a discriminated-union variant carrying its consumer's declared payload, mapped under a total record keyed off an exported `INGEST_CONDITION_KINDS` tuple onto the literal target union `'isolationViolation' | 'unwitnessedQuotations' | null`, with the four `null` targets pinned by a case so a fifth fails the build; nothing is thrown except AD-28's `non-canonicalizable-value` propagating out of `auditQuotation`, and no code is added to either registry; ingest's condition identifiers are asserted disjoint from `outcome.ts`'s shipped `INVALIDATING_CONDITIONS`; the three checks whose inputs the row does not declare are routed into `deferred-work.md` with named owners; `mode` is read off the record and nowhere later; observations are exposed in ascending `sequence`; and no generated table moves, which `check:ad21-table` proves.

### Story 8.2: The score stage over a trial set

As owed item 1's remaining half and thirteen reference functions no caller reaches,
I want `score` to be one orchestration over them,
So that the composition living in a build script becomes the product.

**Acceptance Criteria:**

**Given** Story 8.1's validated observations and the reference functions of Stories 7.2 through 7.8,
**When** the stage is built at `src/core/score/score.ts`,
**Then** `stage-table.ts`'s `score` row names the module and declares a trial set rather than a single run's observations, closing owed item 1's second half in the same story that gives `score` a module as the epic breakdown requires; the orchestration is the one at `scripts/worked-example-target.ts:1071-1381` rather than a second design, covering probe sealing, plan indexing, captured-binding resolution, selection, the witness match, per-oracle check resolution, `resolveOutcome`, `reduceTrialSet`, `buildStrengthVector`, coverage evaluation, and the mode's own ladder; the four `OutcomeInputs` fields that script hardcodes — `waiver`, `judgeConduct`, `evaluationFault`, and `probeQualified` — are each derived from a declared input or are a documented caller-supplied argument, with `judgeConduct`'s derivation consuming Story 8.1's `judge-result-unscored` condition and performing the criterion-to-oracle mapping that needs the contract's rubrics; `preflightPassed` is read from a real `PreflightVerdict` rather than assumed; **the eight rows Story 8.1's rungless conditions require are added to both ladders — a repeated record identifier, a dangling citation from a finding, a dangling citation from an oracle disposition, a record-versus-manifest disagreement, an admitted prohibited input under AD-16's first clause, an absent evaluator configuration, an evaluator configuration whose recomputed digest disagrees with the record's declaration, and a malformed judge result — each with its ladder input and its fixture, with `docs/ad21-verdict-decision.generated.md` regenerated and `check:ad21-table` green**, since AD-32's "invalidating rather than degrading a verdict", AD-17's "invalidates the run rather than becoming a low score", AD-16's two-clause title, and AD-24's "invalidates the run when it is absent or incomplete" each close the FAIL route; **the malformed-judge row reads Story 8.1's condition directly and is an independent invalidation path**, not the basis-naming row `ladder.ts:218-223` records for `selector-ambiguity` and `unwitnessed-claim`: those coincide with `infrastructure-error` by construction, while a `judgeResults` entry whose `criterionId` maps to no oracle produces the condition and no per-oracle `judge-error`, so `invalidating-state` never fires and nothing else invalidates the run; **`LadderTarget` widens to name the eight new `EvidenceIntegrityInputs` fields alongside the two existing targets, each still built with `Extract` against its own `keyof` union, `null` is removed from the union entirely, and Story 8.1's mapping is re-pointed onto the new fields**, since a row whose `reasons()` reads a field nothing populates is worse than the condition it replaced, and deleting `null` from the type makes a ninth rungless condition a compile error rather than a test failure; `EvidenceIntegrityInputs.isolationViolation` widens from `string | null` to `readonly string[]`, which is the shape `ladder.ts:192-197` was written for and the shape Story 8.1's product already ships, so the widening is the ladder catching up rather than a conversion; the row additions change behaviour and republish a generated table rather than moving any surface AD-11 enumerates, so they are release-noted rather than disclosed as a schema, registry, or exit-code break; the `operationId` collision routed out of Story 8.1 is enforced here, where `eval-contract` is a declared input; `reduceTrialSet` gains the `default` branch and the `catchThreshold` range check its two deferred findings name; and the mode-specific assessment type is chosen from the record's own `mode` with `checkModeAgreement` enforced rather than merely exported.

### Story 8.3: The emit stage and the evidence artifact it mints

As the artifact AD-24 gives to `emit` alone and nothing in `src/` has ever built,
I want the stage that mints it,
So that a scored run leaves the package as a versioned artifact with its lineage.

**Acceptance Criteria:**

**Given** Story 8.2's outcomes and verdict and `stage-table.ts`'s `emit` row, which already declares `lineage: 'mints'`,
**When** the stage is built at `src/core/emit/`,
**Then** the row's `module` names it, `emit` is the sole producer of the evidence artifact as `ARTIFACT_PRODUCERS` already declares, the artifact it builds parses under the shipped schema at its current `schemaVersion` with no bump, `parentDigest` and `revisionCount` are written here and by no other module so `check:lineage`'s derived allowlist stays true, `ScoringVersionInputs.mode` appears in `callerAttestedInputs` because it is the one field that can only be caller-supplied, the duplicate-`probeId` drop at `strength.ts:168-177` is guarded now that outcome arrays are built for real, and the seven-place hand-assembly at `scripts/worked-example-target.ts:1417-1480` is deleted rather than left as a second builder.

### Story 8.4: The score command, the application call, and the published surface

As VFR-8's parity rule, which defines a capability reachable through one surface and not the other as a defect,
I want `score` on both surfaces at once,
So that the library and the CLI publish one shape.

**Acceptance Criteria:**

**Given** AD-14's rule that a command is "one orchestration call plus artifact serialization" holding no validation, scoring, or policy logic, and AD-34's rule that both surfaces sit on `application/`,
**When** the surface is added,
**Then** `src/application/score.ts` is the single orchestration entry, it is re-exported from `application/index.ts` and reachable from `src/index.ts` under the same dependency matrix the barrel comment already fixes, `Command` gains `'score'` with its input flags and its `--strict` behaviour declared in the same exhaustive records the existing three commands use (`INPUT_KEYS`, `TAKES_STRICT_INPUTS`, `TAKES_RUN_ID`, `EMITTED`, and `COMMAND_USAGE` are the five the compiler catches), the dispatch at `src/cli/run.ts:262-276` stops being a two-branch ternary whose `else` silently runs `seal` for any command it does not name, and `COMMANDS` at `arguments.ts:27` and the `USAGE` synopsis at `run.ts:94-102`, neither of which the compiler checks, are updated in the same diff, the command's exit code is `LadderResolution.exitCode` read from the ladder rather than recomputed, `--strict` promotes through `LadderResolution.strictPromotable` so `cli/exit-codes.ts`'s `evidenceConditionsOnly` and the ladder's own column can no longer disagree, `docs/ad21-verdict-decision.generated.md` gains the exit-code column Epic 7's preamble already claims for it with `check:ad21-table` green, the CLI writes the artifact to `<target>/evidence-artifact.json` under the existing convention, `README.md`'s exit-code table and its sentence that "scoring ships in a later release" and `docs/explanation/roadmap.md`'s "Nothing in the current release computes contract strength" are each corrected in this diff, and `check:doc-invocations` runs every newly documented `score` invocation against the built binary.

### Story 8.5: The worked chain through the shipped stages, and the release disclosure

As the build script that still holds a second implementation of the pipeline,
I want it to call the product,
So that the worked example is evidence rather than a parallel derivation.

**Acceptance Criteria:**

**Given** Stories 8.1 through 8.4 and `scripts/worked-example-target.ts`'s existing 400-line derivation,
**When** the chain is regenerated,
**Then** `buildWorkedExampleChain` calls the shipped `ingest`, `score`, and `emit` stages for every value it currently derives by hand, the committed `spike-worked-example/` bytes are byte-identical to the pre-change bytes or every difference is named with its cause, `npm run check:worked-example` and `npm run check:dev-corpus` are green with no hand-filled downstream value remaining, `npm run generate:dev-corpus` reproduces the corpus through the same path with `scripts/dev-corpus-target.ts:134-136`'s "a probe cannot yet be scored once admitted" corrected at its source rather than in the generated `corpus/dev/README.md`, and the release notes disclose the epic's caller-facing surface change under NFR8 naming the new command, its flags, its exit codes, and the newly exported library entry, stating plainly that this is an addition to `0.2.0`'s surface rather than a break in any shipped artifact, since no `schemaVersion` moves in this epic.

## Epic 11: the fifth interface kind, the evidence for the other four, and the documentation that describes them

Implements AD-10's opening condition for a second time, AD-19's per-operation declaration for a third interface kind, AD-40's transport identity for a call that has no HTTP one, AD-37's conformance obligation for a third arm, AD-31's grading obligation for a new kind, and AD-13's four checks over every schema it moves. Epic 9 opened `cli` and Epic 10 gave that kind a real adapter. This epic does both jobs for `mcp` and then makes every published page that describes the product true.

**Why this epic exists.** `docs/index.md:72` reads "Two interface kinds compile today, `api` and `cli`, and a guide below covers each shape people put in front of them", and the routing table at `:74-80` lists five system shapes with a how-to guide each. Four of the five run. The fifth, an MCP server answering tool calls, carries the verdict "Declared and refused at compile" at `:80`, because `SUPPORTED_INTERFACE_KINDS` (`src/core/compile/interface-inventory.ts:31`) is `['api', 'cli']`. A page framing five guides one per system shape while one of the five cannot compile is the same defect class this repository closed at six other sites on 9 September: prose stating what the schema will not accept. This epic closes the last one by building the feature.

**Definition of done, in three parts, all required.** First: a contract declaring an `mcp` interface compiles, seals, pre-flights, scores, and ships in the dev corpus, exercised by a real adapter, covered by a third conformance arm, and graded by AD-31 in its own coverage file. Second: each of the three shapes whose guide records something unproven carries shipped evidence, so a seeded defect scores against a skill contract, a corpus contract declares a captured binding and a fixture reset and runs end to end, and an api-kind chain runs against a service the suite starts with a real probe. Third: every documentation page describing what eval-quality can be pointed at is true without a qualifier, with `npm run check:doc-invocations` reporting the tool-use guide's own invocation faithful.

**The sentence the epic exists to make true, stated once so every story can be measured against it.** When Epic 11 ends, eval-quality can be pointed at agent behavior, skill behavior, tool-use behavior, workflow behavior, and end-to-end AI feature behavior, and no row in the "State" column at `docs/index.md:74-80` still says the shape is unproven. Two kinds of qualifier are different things and the distinction is the epic's whole point. The unproven-claim qualifiers go, because this epic produces the evidence they were waiting on. Two measured limits stay in the cells because they are true: a scored run completes one trial, so a strength vector comes out marked non-comparable, and the package executes nothing under evaluation, so pointing it at a third-party production service is the adapter and the two arms the caller writes. Each evidence story drafts its own cell carrying its own surviving limit, and Story 11.12 owns the boundary sentence.

**What this epic may not do.** `web` stays refused, and AD-10's sentence stays true of it alone. AD-2 stays whole: the package executes nothing under evaluation and ships no network adapter, so Story 11.12's end-to-end run uses the loopback fixture server NFR7 already carves out for AD-37's suite and adds no `api` adapter under `src/adapters/`. The held-out probe corpus and the second experiment round stay owed, exactly as the What Ships page already records them. The three evidence gaps the original scoping deferred to a later epic are now in scope as Stories 11.10 through 11.12, because the epic's purpose is a promise the documentation can keep and four shapes with a qualifier do not keep it.

**One category needs nothing, confirmed against the source.** The package boundary does not move. `src/index.ts:14-20` grants the root barrel `root -> application` and `root -> core-schemas` only, and it exports no interface kinds, no probe messages, no adapters, and no conformance runners. `McpProbeRequest`, `McpProbeObservation`, and a third conformance arm ride the existing `./conformance` subpath, and an MCP adapter rides `./adapters`, so `package.json` and `tests/architecture/package-exports.test.ts:122-153` are untouched. `website/src/content/docs` is a symlink to `docs/` and `website/astro.config.mjs:120-142` autogenerates navigation, so a new guide needs no website change.

**How the architecture record is kept, settled up front.** Opening an interface kind forces mechanical edits to spine text that names the accepted kinds, in the same way that minting an AD-5 code appends a row to AD-5's table. Those edits ship in the story that changes the behaviour they describe. No spine revision number is bumped, no new ADR is opened, and every ambiguity found mid-story is settled by construction in that story's own decisions section with the later story that inherits it named, as Epics 7 through 10 each established.

**The gate Story 11.2 arms is live for the rest of the epic, which is a real constraint on Stories 11.4 and 11.5.** `check:doc-invocations` runs inside `npm run validate` (`package.json`), so once the tool-use guide's contract is a heredoc with a declared exit code, that page is an executed input to every later story's gate run. Story 11.4 gives `mcp` its own operation shape, which makes the page's HTTP-shaped contract stop parsing, and Story 11.5 opens the kind, which makes the page's declared rejection stop firing. Each of those stories therefore updates the guide's contract fence and its declared exit code in the same diff, so `npm run validate` is green at every story boundary. The guide's prose rewrite stays in Story 11.9. This is what the armed gate is for: a behaviour change that contradicts a published page fails the build in the story that made the change.

**One consequence to state out loud rather than let the next reader discover.** `tests/application/preflight.test.ts:139` sets `kind = 'mcp'` deliberately, and its comment at `:136-138` says why: a command interface compiles now, so flipping to `cli` would be a parse failure rather than the structural failure under test. Opening `mcp` leaves `web` as the only remaining api-shaped mutation that can fire `unsupported-interface-kind` end to end. That check's fireability becomes a one-kind margin, and Story 11.5 says so in the source it edits.

**Documentation moves with every story, and so does the learning path.** Each story in this epic fixes the published sentences its own change makes false, adds its own step to `_bmad-output/project-knowledge/learning-path-step-by-step.md` following `learning-path-template.md`, and prunes and de-AIs every JSDoc, comment and `.describe()` string it writes while it writes them. The learning path currently ends at Step 44, so this epic's thirteen stories are Steps 45 through 57. Story 11.9 keeps only the cross-cutting prose no single earlier story owns, which is the landing page's routing table and framing, and the tool-use guide's rewrite from a description of unbuilt work into a followable guide. Its sweep for unclaimed sentences is the epic's closing check. Generated pages come from their generators and are never hand-edited, and BMad story files are exempt from the voice pass.

**Story order, which is not the numbering.** Story 11.1 runs first because its finding can shrink Stories 11.3 through 11.8 and Story 11.13. Story 11.2 runs second because it is the check that proves the epic finished, and it has to be live before any behaviour changes. Story 11.3 runs third because the design decision shapes the schema. Stories 11.4 through 11.6 follow in order, then Story 11.13, then Stories 11.7 and 11.8. Then Stories 11.10, 11.11 and 11.12 produce the evidence for the skill, workflow and AI-feature shapes. Story 11.13 carries a number out of sequence because it was split out of Story 11.6 late, after a review found the two halves independent in both directions with one coupling edge that forces the schema half first. Story 11.9 runs last, because it is the story that states what is true and it can only do that once the evidence exists. The three evidence stories all move dev-corpus counts, so each states its arithmetic against the others and says which lands last.

### Story 11.1: Whether tool-use evaluation is one gap or two

As the tool-use guide that describes a capability nobody can run,
I want the two readings of "evaluate tool use" separated and each tested against the shipped schema,
So that the epic builds a new interface kind only for the reading that genuinely needs one.

**Acceptance Criteria:**

**Given** two readings the guide currently merges: reading one asks whether an agent's tool use was correct, where the system under test is the agent behind a command and the tool calls it made are a file that command wrote, which `CommandOperation.artifacts` (`src/core/schemas/interface.ts:239-243`) already declares; and reading two asks whether an MCP server itself is correct, where the system under test is the tool server and only the `mcp` kind can describe it,
**When** reading one is attempted end to end as a worked example rather than reasoned about,
**Then** a `cli` contract is authored whose operation declares the tool-call log in `artifacts`, an oracle addresses it, and the contract is put through `compile`, `seal`, and probe qualification; the attempt records which of the two artifact addressing routes it took, because `qualification.ts:325-343` refuses a defect signature naming an artifact identifier under `condition-artifact-channel-contract-local` while that same comment at `:336-338` states "a signature reaches a written file through the descriptor channel of whatever operation it binds, which is kind-neutral and needs no identifier", so the descriptor-channel route may succeed where the identifier route provably fails; the story ends on one of two outcomes, each carrying its evidence, either reading one compiles and scores, in which case Story 11.9's rewrite of the tool-use guide is re-scoped around it and the epic records in this story which of Stories 11.3 through 11.8 and Story 11.13 shrink and by how much, or reading one is demonstrably impossible, in which case the refusing code, its artifact path, and its message are quoted verbatim and the epic proceeds unchanged; and the finding is recorded in this story's own decisions section naming the story that inherits it, with no code shipped by this story in either outcome.

### Story 11.2: The check that would catch a stale tool-use claim

As the doc-invocation check that reports the tool-use guide's rejection as unfaithful,
I want the guide's contract to be a real file and its exit code declared,
So that opening the `mcp` kind fails `npm run validate` instead of shipping a false claim in silence.

**Acceptance Criteria:**

**Given** `docs/how-to/evaluate-tool-use-behavior.md:137-139`, which runs `node dist/cli/main.js compile --in mcp-contract.json`, and `:141-143`, which shows the `unsupported-interface-kind` rejection that opening the kind will make false, and the block at `:84-133`, which is a plain fenced JSON block with no `<!-- expect-exit: N -->` declared anywhere on the page, and which is a `PermittedInterface` fragment rather than the whole contract the command below it names, so a heredoc over those bytes verbatim exits 5 under `schema-parse-failure` instead of the 4 the page claims,
**When** the page is measured against `scripts/check-doc-invocations.mjs:20-34`, whose rule is that an invocation is FAITHFUL only when every input it names resolved to real bytes and that anything else "keeps the usage-error judgment and no more",
**Then** the fence becomes a `cat > mcp-contract.json <<'EOF'` heredoc carrying a complete single-operation `EvalContract` so the file the command names is one the page told its reader to create and the exit code is the one the page claims, with a single operation because `checkDuplicateOperationSignature` runs at `src/core/compile/compile.ts:121` ahead of `checkInterfaceKind` at `:128` and two `mcp` tools would raise the wrong code, `<!-- expect-exit: 4 -->` is declared on the line before the bash fence in the spelling `docs/how-to/author-behavioral-contracts.md:82` and `docs/tutorials/getting-started.md:66` already use, `npm run check:doc-invocations` reports the run as faithful, and flipping the declared code to one the run does not produce fails the check, which is what proves the gate is armed; the page's prose still describes a refused kind, since nothing opens it until Story 11.5; and the story ships no product change, so `npm run validate` is green on the documentation change alone.

### Story 11.3: The response descriptor for an unstructured tool result

As the design question the deferral was actually about,
I want a recorded answer to what an oracle may assert about a markdown tool result,
So that every schema story after this one builds to one settled shape.

**Acceptance Criteria:**

**Given** `ResponseDescriptor` (`src/core/schemas/interface.ts:45-70`), whose six fields `requiredKeys`, `permittedKeys`, `types`, `successIndicator`, `channelRoles`, and `collectionLocations` are each about a JSON body, AD-4's quantifiers, which need a JSON collection to range over, a real MCP tool result, which is `content: [{type: "text", text: "..."}]` alongside `isError`, and `ARCHITECTURE-SPINE.md:656`, which records "Bringing `mcp` into v0 remains Deferred" for this reason,
**When** the option is chosen from three candidates, none of them preferred going in: the descriptor declared over the MCP envelope with each content block's `text` treated as a scalar channel; an admitted parsed projection where the caller declares how markdown becomes JSON and the descriptor describes the projection; or a first version restricted to tools returning structured content, with the restriction carried by the declaration Story 11.4 ships,
**Then** the decision is recorded in the register of the existing ADs in `ARCHITECTURE-SPINE.md` as the mechanical consequence of opening a kind, with no revision number bumped and no new ADR opened, naming the option taken, the options turned down, and what each one would have cost; it answers two questions explicitly, what an oracle can assert about a markdown tool result and whether `collectionLocations` means anything for one; it names the AD-5 code that fires when a contract declares a descriptor the chosen option cannot support, or records that no new code is needed and why, since a code minted with no thrower is the defect `deferred-work.md:166` records AD-16's two forbidden-input checks having carried for a whole epic; `docs/explanation/what-ships.md:40`, which currently calls the response descriptor "the open design question behind the deferral", is rewritten here, because this story's decision is what answers it; and no schema changes in this story, so the decision is reviewable on its own, with `npm run build:shareable` run in the same diff because `check:shareable` compares the committed spine projection byte for byte inside `validate`.

### Story 11.4: The operation shape for a tool call

As the HTTP-shaped `Operation` that `mcp` borrows today,
I want the kind to declare its own operation,
So that a tool call carries a transport identity AD-40 can bind against and no dead channels.

**Acceptance Criteria:**

**Given** `apiShapedInterface` (`src/core/schemas/interface.ts:281-286`), which hands `mcp` the HTTP-shaped `Operation` at `:296`, and four things that shape gets wrong for a tool call: `method` is required over the seven HTTP verbs and a tool call has none; `pathTemplate` is the only place a tool name could go, so two tools declared as `POST /tools/call` collide under `duplicate-operation-signature` (`src/core/compile/interface-inventory.ts:108`) after parameter-name erasure in `operationSignature` (`:59`), and the kind ships no convention for the spelling that would avoid it; three of the four request channels are dead because a tool call has arguments only; and `responseDescriptor` is whatever Story 11.3 settled,
**When** the kind gets its own operation shape on the precedent `CommandOperation` (`interface.ts:230-252`) set for `cli`, which Epic 9 chose over bending the HTTP one,
**Then** an `McpOperation` is declared beside it carrying a tool identity, the arguments channel, Story 11.3's descriptor under a one-member tagged `descriptorChannel` on the `CommandDescriptorChannel` precedent, since Story 11.3's decision to mint no AD-5 code depends on that tag making the bad state a parse failure, and the kind-neutral `stateChangeMarker`, `volatilePointers`, and `sensitivityWitness` every operation shape already carries; `AnyOperation` (`interface.ts:255`) widens to three members and the consumers that read only kind-neutral fields keep compiling; the AD-40 reasoning is recorded here and the branch itself is handed to Story 11.6: `defect-signature.ts:165-166` resolves on `method` and `pathTemplate`, so an `mcp` signature keeping them would render `POST /tools/call` and compare it against a tool name, which puts contract-independence out of reach and forces a branch of its own beside the `cli` literal at `:178`, while `ProbeInputBinding` at `:86` is consumed at `:109` so that branch and the ninth `arguments` channel are one change shipping together; this story's `WitnessInputs` widening reaches `probe.schema.json` through `src/core/schemas/probe.ts:36`, so it takes the probe's first breaking bump and ships a probe accept fixture carrying an `mcp` manifestation-witness leg, without which `keyword-mutation.test.ts:190-193` fails on the new keywords; `tests/schemas/command-interface.test.ts:118-123` and `tests/application/preflight.test.ts:139` each assert on an api-shaped `mcp` mutation and become parse failures under the new branch, so both move to `web` in this diff and `npm run validate` stays green at this boundary; `tests/schemas/fixtures/mcp-contract.ts` is authored here with two tools, a witness and a structured-result descriptor, since Story 11.7 imports it and Story 11.8 promotes it into the dev corpus; an `mcp` contract declaring two distinct tools parses and the two do not collide under the duplicate-signature check, which is the acceptance test; the eval contract takes its breaking `schemaVersion` bump recorded in the driving field's own `.describe()` under AD-11, with `src/core/schemas/eval-contract.ts:161`'s `EVAL_CONTRACT_SCHEMA_VERSION = 4` and the pinned copy at `tests/schemas/eval-contract-version.test.ts:60` raised first so the failures name every literal that has not moved; and `apiShapedInterface` is left with `web` as its only member, which the story states in the source rather than leaving for the next reader; and the tool-use guide's heredoc contract at `docs/how-to/evaluate-tool-use-behavior.md:84-133` is updated to the new operation shape with its declared exit code still correct, because Story 11.2 armed that page as an executed input to `npm run validate` and an HTTP-shaped `mcp` contract stops parsing here.

### Story 11.5: Compile and pre-flight admit an MCP interface

As the compile and pre-flight gates that refuse the kind after Stories 11.3 and 11.4 have declared its semantics,
I want both opened for `mcp` and left closed for `web`,
So that a tool-use contract compiles and AD-10's sentence stays true of the one kind it still describes.

**Acceptance Criteria:**

**Given** three refusals in the source, `SUPPORTED_INTERFACE_KINDS = ['api', 'cli']` at `src/core/compile/interface-inventory.ts:31`, module-private and never exported, checked at `:36`; the hand-assembled-plan assertion `if (iface.kind !== 'api' && iface.kind !== 'cli')` at `src/core/preflight/plan.ts:305`; and `signature-interface-kind-unsupported` at `src/core/score/qualification.ts:754-763`, which stays closed here and is Story 11.6's to open alongside `McpDefectSignature`; plus `src/core/schemas/sensitivity-witness.ts:73`, whose comment names the accepted kinds and the two it rejects,
**When** the kind is opened on AD-10's own condition, which is that probe semantics are declared per interface kind and a kind fails honestly under `unsupported-interface-kind` while its semantics are undeclared,
**Then** an `mcp` contract compiles and pre-flights while a probe against it still fails qualification, a window this story names with Story 11.6 as its closer on the precedent Story 9.2 set when command pointers resolved `absent` until Story 9.4, `web` still fails at all three gates with the same code and a message that names it correctly, and the only transcription of the compile literal outside `src/`, at `docs/how-to/evaluate-tool-use-behavior.md:63`, moves with it; the sensitivity-witness comment is corrected to name three accepted kinds and one rejected; `tests/schemas/command-interface.test.ts:117` reads `describe('the three kinds whose probe semantics are still undeclared')` while enumerating two, and becomes one, which is a stale count fixed at its source rather than carried forward; the story states in the source it edits that `web` is now the only api-shaped mutation that can fire `unsupported-interface-kind` end to end, so `tests/application/preflight.test.ts:139`'s deliberate `mcp` mutation and its comment at `:136-138` move to `web` with the reason rewritten; AD-10's spine text is edited in this same diff to name the kinds it now accepts, along with `ARCHITECTURE-SPINE.md:232` and `:656`, whose "Bringing `mcp` into v0 remains Deferred" this story is what falsifies, with `npm run build:shareable` run in the same diff because `check:shareable` compares the committed projection byte for byte inside `validate`; and the tool-use guide's invocation at `docs/how-to/evaluate-tool-use-behavior.md:137-143` moves with the behaviour, since the rejection it declares stops firing here and Story 11.2's armed gate turns that into a build failure, so the declared exit code and the shown output become the ones the kind now produces while the guide's prose rewrite stays in Story 11.9.

### Story 11.6: The tool-call defect signature and the ninth input channel

As AD-40's resolution key, which has nothing to bind against for a tool call,
I want the signature branch and the input channel that carries a tool's arguments,
So that a probe against an MCP contract qualifies and the window Story 11.5 leaves is closed.

**Acceptance Criteria:**

**Given** `src/core/schemas/defect-signature.ts`, where `ApiDefectSignature.interfaceKind` at `:164` still admits `mcp` over a `method` and a `pathTemplate` that a tool call does not have, where `CommandDefectSignature` at `:170-181` is the precedent for a kind declaring its own identity, and where `ProbeInputBinding` at `:86-95` is consumed through `ProbeStepSelector.inputBinding` at `:109` into `signatureCommon` at `:144-149`, so the branch and the channel are one file and one change,
**When** the signature side is built,
**Then** `McpDefectSignature` is declared on the `CommandDefectSignature` precedent and `ApiDefectSignature.interfaceKind` narrows to `['api', 'web']`, with the byte-identity argument at `:157-161` answered rather than ignored, since a tool-identity branch is byte-identical to nothing and AD-13's sweep can attribute a keyword deletion to it; `ProbeInputBinding` and `ObservedCallInputs` gain the ninth `arguments` key that Story 11.4's ninth input channel forces, and `callInputsOf` (`src/core/preflight/witness-evidence.ts:63-92`) gains the third arm its two-arm `'body' in inputs` test can no longer cover; `signature-interface-kind-unsupported` at `src/core/score/qualification.ts:754-763` opens for `mcp` while staying closed for `web`, which closes the window Story 11.5 named; the union-branch seed for the signature ships in this same diff, because `tests/schemas/published/keyword-mutation.test.ts:190-193` fails on any published keyword no fixture flips, moving `ACCEPT_FIXTURE_COUNTS.unionBranches` 10 to 11 and `.distinctInstances` 24 to 25 from the post-11.4 state; the probe takes its second breaking `schemaVersion` bump and the sealed run record its first, each recorded in the driving field's own `.describe()` under AD-11; four published sentences counting a shape's own keys are corrected at their source, `sealed-run-record.ts:195-196` reading four against eight and `:243` reading ten observation fields against thirteen, both already false before this epic reached them, and the two eight-key claims in the tool-use guide; and `CHANGELOG.md`'s `[Unreleased]` discloses both bumps.

### Story 11.13: The port messages and the MCP adapter

As `ProbeRequest` and `ProbeObservation`, which are discriminated unions over two kinds,
I want a third member and a reference adapter that speaks it,
So that a tool call is a message the port can carry and an adapter can answer.

**Acceptance Criteria:**

**Given** `ProbeRequest` (`src/core/schemas/port-messages.ts:135-138`) and `ProbeObservation` (`:186-189`), each a discriminated union over `api` and `cli` only, so there is no message an MCP adapter could be handed and none it could return, and eight files under `src/` that discriminate on the kind and stop compiling when a third branch lands, `src/core/seal/plan-index.ts`, `src/core/score/qualification.ts`, `src/core/preflight/projection.ts`, `src/core/preflight/witness-evidence.ts`, `src/core/preflight/reduce.ts`, `src/core/preflight/plan.ts`, `src/testing/probe-conformance.ts`, and `src/adapters/command-line-adapter.ts`,
**When** `McpProbeObservation` is added beside the `McpProbeRequest` Story 11.5 already landed, and the adapter is written on the model of `src/adapters/command-line-adapter.ts`, the most recent adapter added and the one whose deny-by-default target policy, elapsed and output bounds, and rule that a non-zero exit is an observation rather than a fault all need an MCP equivalent,
**Then** the eight-file exhaustiveness list is worked as a checklist with each branch decided against its own module rather than by analogy, since that exhaustiveness is the feature that stops a consumer being forgotten silently; the adapter's authorization shape names what it may connect to and what bounds it enforces, and AD-35 holds, so a contract names a logical identifier and an MCP server address is configuration outside it; `Observation` needs nothing, since the sealed run record does not discriminate it on kind, and `ObservedCallInputs`' ninth `arguments` key is already landed by Story 11.6, and `foreignChannels` in `qualification.ts` gives every non-`cli` kind the API response channels, so a tool-use defect signature is confined to `response-body`, `response-headers`, and `response-status`; the six test sites that move with the union are each updated, `tests/preflight/reduce.test.ts:562-592` where fixture 129 pins `/asked for a "api" probe and was answered with a "cli" observation/` and a third kind turns two mismatch pairs into six, `tests/testing/conformance.test.ts:483-501` and `:503-513` where the `probeRequest()` and `observation()` builders hard-return `kind:'api'`, `:524-539` where `breakEcho`'s kind branch hand-builds a whole `cli` observation because a command observation carries stdout, stderr, and an exit code in place of a status and headers, `:804` where `expect(detail).toMatch(/observed kind "cli"/)`, `:681-691` where per-arm counts are pinned, and `tests/preflight/fixtures/probe-port.ts:35` where `echoPort()` hard-returns `kind:'api'`; the adapter speaks MCP's stdio transport only, with Streamable HTTP and HTTP+SSE excluded in the source and their reason given, since AD-2 prohibits network I/O outright and a stdio server is a child process on the reading Epic 10 already settled; `evaluateMcpTarget` lives under `src/adapters/` because the dependency-direction check grants that layer an edge to `ports/` and `core/schemas` only, while the declared authorization shapes sit in `src/core/schemas/probe-policy.ts` beside the two already shipped; no artifact `schemaVersion` moves here and no published document changes, since the port messages carry no `lineageFields` and have no entry under `schemas/`, which Story 9.3 already established; and the acceptance is that the MCP adapter passes the port conformance suite.

### Story 11.7: The third conformance arm and the graded kind

As the conformance suite with one arm per kind and the coverage file a new kind is owed,
I want a third arm and a dedicated AD-31 grading file,
So that a future MCP adapter author has a definition to satisfy and no predicate answers confidently and wrongly.

**Acceptance Criteria:**

**Given** `src/testing/probe-conformance.ts`, which reports one arm per mechanism at `:393` and `:665`, `package.json:81`, whose `test:conformance` runs only `tests/adapters tests/testing tests/conformance` and so constrains where a new conformance test may live, and the written precedent that a new kind is graded in its own file, recorded in `tests/coverage/command-coverage.test.ts:1-13` because skipping it already cost a release, with "a whole interface kind went ungraded while the suite stayed green" over three of the fourteen AD-31 predicates that answered "confidently and wrongly", and restated as a rule at `tests/coverage/fixtures/corpus.ts:548-553`,
**When** the third arm is written after reading both existing arms, since the arm defines what any future adapter author has to satisfy,
**Then** the suite runs three arms, the reference MCP adapter passes its own, `CONFORMANCE_OUTCOME_COUNTS` gains an `mcp-probe` entry rather than an existing entry changing so nothing already published moves, and `tests/testing/conformance.test.ts:423-424`'s declared-literals assertion moves with it; AD-31's fourteen predicates are graded for `mcp` in a dedicated coverage file that asserts the whole verdict table rather than the rules that happen to be interesting, following `command-coverage.test.ts`'s own reasoning; and the one-file-per-kind pattern is followed through the five pairs it already runs in, `tests/preflight/plan.test.ts` with `tests/preflight/command-plan.test.ts`, `tests/adapters/probe-subject.ts` with `command-probe-subject.ts`, `tests/adapters/probe-subject.test.ts` with `command-line-adapter.test.ts`, `tests/probe/target-policy.test.ts` with `tests/adapters/command-target-policy.test.ts`, and `tests/coverage/coverage.test.ts` with `command-coverage.test.ts`, with each third file either written or its absence justified in the story against the pair it would have joined.

### Story 11.8: The published surface, the corpus, and the census

As every enumeration of interface kinds that a generator owns,
I want each one to carry its third entry through its own generator,
So that the published schema, the corpus, and the AD tables agree with the code that produces them.

**Acceptance Criteria:**

**Given** the frozen census in `tests/schemas/published-census.ts`, which holds six pinned constants rather than two, `CENSUS_BY_DOCUMENT:20`, `CENSUS_BY_KEYWORD:36`, `CENSUS_TOTAL = 3023` at `:64`, `DEFS_BY_DOCUMENT:67`, `REJECT_CASE_COUNTS:88`, and `ACCEPT_FIXTURE_COUNTS:100` with `ACCEPT_FIXTURE_TOTAL` derived at `:109-114`, and the machinery that will fail against them, `tests/schemas/published/keyword-mutation.test.ts:119-144` walking all 3023 mutable keyword occurrences across twelve documents and requiring each deletion to flip a verdict, `published-rejection.test.ts:214-239` as the union-branch census, `publish.test.ts:62-66` and `:87-104` as the document census, and `differential.test.ts` as the Zod-to-JSON-Schema equivalence,
**When** the third kind is carried through every generator, `npm run generate:schemas` checked by `npm run check:schemas`, which is a script rather than a test because AD-30 forbids test filesystem I/O outside a temporary directory, and `npm run generate:dev-corpus` checked by `npm run check:corpus`,
**Then** each census constant is moved by reading the failure and following the procedure its own file documents; the union-branch seeds are already landed by the stories that declared their branches, two in Story 11.4 for `PermittedInterface`'s `mcp` branch and the probe's `mcp` manifestation-witness leg, and one in Story 11.6 for `DefectSignature`'s, so this story starts from the post-11.6 census state and adds none, because `artifact-fixtures.ts:486-488` records that the `cli` signature is "the only seed that reaches those keywords: a branch nothing exercises is a branch AD-13's sweep reports as unprotected"; the constraint prose at `tests/schemas/fixtures/artifact-reject-cases.ts:1271` catches up with `reject-cases.ts:135`, while the reject-case counts hold because `INTERFACE_KINDS` stays four and this epic changes only what `compile` admits; a third exemplar joins `DEV_CORPUS_CONTRACTS` (`tests/coverage/fixtures/corpus.ts:555-559`), `tests/architecture/dev-corpus.test.ts:333`'s pinned count of exactly 3 structural failures is checked against the new total, and six spelled-out words on four lines of the README template move at their source, at `scripts/dev-corpus-target.ts:65`, `:108`, `:114` and `:115`, with `:117`'s "Three" holding, with `corpus/dev/README.md:3` and `:9-12` following byte for byte through the generator; `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/spike-worked-example/probe.json:35` keeps `"interfaceKind": "api"`, because the chain's subject is the api contract, so `npm run check:worked-example` is rerun and nothing there moves; the five AD registry checks `check:ad5-registry`, `check:ad28-registry`, `check:ad21-table`, `check:ad31-table`, and `check:ad33-table` are green, `ARCHITECTURE-SPINE.md:232` and `:656` are asserted to read correctly rather than edited, since Story 11.5 fixes both when it opens the kind and `scripts/check-ad5-registry.ts:96` parses the first column only so nothing else would catch them; the `mcp` exemplar is taken end to end through `compile`, `seal`, `preflight` and `score`, which is the half of the epic's definition of done no other story's acceptance covers; a new gate closes the hole that lets a hand-written documentation count drift, since `scripts/check-docs.mjs` reads frontmatter and whitespace only and Epic 9's intended count test never landed, and it ships as a script wired into `validate` carrying its own closed word table with the counts it does not cover enumerated; and the acceptance is `npm run validate` green and `npm run docs:build` green separately, because validate does not build the website.

### Story 11.10: A seeded defect scored against a skill contract

As the skill row that reads "No seeded-defect instance yet" while the capability already exists,
I want a skill contract in the corpus whose seeded defect qualifies and scores,
So that the catch rate this shape yields is measured rather than absent.

**Acceptance Criteria:**

**Given** `docs/how-to/evaluate-skill-behavior.md:234`, which states that "nobody has scored a seeded-defect probe against a skill contract", and `:235`, which records `strength.defect` as `null` in all eight of TEA's fragment-selection suites so the catch rate "measures the degenerate reply alone", and the tree's own proof that this is a missing artifact: `foreignChannels` (`src/core/score/qualification.ts:147-151`) forbids a `cli` signature only the three api response channels, and `tests/schemas/fixtures/artifact-fixtures.ts` already carries a `defect`-class probe with a `cli` signature that `qualifyProbe` accepts,
**When** the artifact is shipped,
**Then** a skill contract joins `DEV_CORPUS_CONTRACTS` wrapping the interface the guide already prints at `docs/how-to/evaluate-skill-behavior.md:57-113`, with one spelling of its invocation in the contract and in the signature so `commandSignature` renders one string and `resolveHomeOperation` binds; a second generated chain scores it through `ingest`, `score` and `emit`, computing its pre-flight verdict through `preflightFromObservations` rather than authoring one, since an authored verdict proves no more than `tests/preflight/plan.test.ts` case 96 already proves; the chain lives under `_bmad-output/worked-examples/` on the construction this story establishes for the epic, a shared module plus one target file per chain with `buildWorkedExample` as the union of their maps; `strength.vector.defect` comes out a real rate; the two structural limits survive and the story says so, the trial-set limit which belongs to `runScore` rather than to `score` since `score` already takes an array, and the written-file limit whose true scope is the discriminating condition alone because the refusal fires on the predicate walk's `target.channel` and never reads `observableChannel`; the corpus total moves 22 to 23 and the command-contract count 2 to 3, which is this story's only claim on that chain; the committed-chain count moves from the singular to two at `docs/how-to/author-behavioral-contracts.md:237`, `README.md:240` and the generated corpus README, phrased so Story 11.11's edit is a numeral swap and leaving `dev-corpus.test.ts:282`'s four-fragment regex matching; the replacement `docs/index.md` State cell is drafted here carrying the one-trial limit; and `CHANGELOG.md`'s `[Unreleased]` discloses the second committed chain.

### Story 11.11: A shipped workflow contract with a captured binding and a fixture reset

As the workflow row that reads "no shipped end-to-end run" while two features run only in unit tests,
I want a corpus contract that declares both and runs end to end,
So that the shape is proven by something an adopter can open.

**Acceptance Criteria:**

**Given** `docs/how-to/evaluate-workflow-behavior.md:222-223`, which records that no corpus contract and no committed chain uses a `{ captured }` binding and that the guide's own worked example "was compiled for this page and is not shipped in the corpus", and `:225-226`, which records that no contract declares a `fixtureReset` so the `control-mutate` and `control-reset` legs run in `tests/preflight/plan.test.ts` alone,
**When** the contract is shipped,
**Then** an `api`-kind contract joins `DEV_CORPUS_CONTRACTS` declaring both, chosen `api` because shipping the guide's own printed shape is what retires `:223`, because `descriptorChannelOf` answers `response-body` for every non-command operation while a command capture needs a second per-operation declaration, and because `selectControl` needs a marker-false read beside a marker-true operation on the reset's interface; it runs end to end on a third target file in the construction Story 11.10 established, with its verdict computed through `preflightFromObservations`; `src/core/compile/bindings.ts:40-52` is deleted as an orphaned docblock for the `CAPTURABLE_CHANNEL` Story 9.3 removed, its one surviving sentence moved into `checkCapturedChannel`'s own docblock; Story 9.3's Decision 4 recorded a corpus capture that never landed and this story is what lands it, with the `cli` capture from `stdout` and the one from the `artifact` channel named as still unexercised; the corpus total moves 23 to 24 and the api count 18 to 19, which is this story's only claim on that chain; the committed-chain count moves from two to three, leaving `dev-corpus.test.ts:282`'s regex matching and leaving "Three of the four artifacts" untouched, since that numeral counts the artifacts of an example rather than the chains that commit a run record; the strength vector comes out `comparable: false` against `minimumTrialCount: 3` and the drafted State cell says so; and the release note discloses the third chain.

### Story 11.12: An end-to-end run against a service the suite starts

As the AI-feature row that reads "No live service has been evaluated yet",
I want one chain driven by a real probe against a real HTTP service,
So that the shape is proven end to end and the boundary that remains is stated rather than implied.

**Acceptance Criteria:**

**Given** `docs/how-to/evaluate-ai-feature-behavior.md:227-230`, which states that no live AI feature has been evaluated and that the one complete chain is a toy API with no running service behind it and authored observations, and AD-2 and `docs/reference/cli-commands.md:223`, which keep a reference `api` probe adapter deliberately absent because "probing a live HTTP environment is the part only you can write",
**When** the run is built,
**Then** it is driven by `createProbeSubjectAdapter` (`tests/adapters/probe-subject.ts:260`), already a real `EnvironmentProbePort` over `node:http` that validates every target and redirect against AD-35's policy and passes the published conformance assertions over a live loopback server, and **nothing ships under `src/adapters/`**, since an `api` adapter would reverse four published statements for no additional evidence; the loopback use is recorded by construction as a second use of the carve-out beyond AD-37's suite, permitted by NFR7's server-scoped wording rather than by AD-30's suite-scoped sentence, with no spine revision and no ADR; determinism holds without excluding anything from the byte check, since no clock, address or random source reaches a hashed artifact; the guide block says plainly that the evaluator is not real, that the test replays the interaction plan, and that the findings are authored, with observation provenance decided in the story rather than left to the harness; the story transcribes no count that `check:doc-counts` gates and moves no corpus member; and the drafted State cell names the fixture, the single trial, and the boundary, so a reader of the index alone cannot conclude that a third-party AI feature was evaluated.

### Story 11.9: The documentation says what is true

As eight published pages that describe a product with four working shapes out of five,
I want each sentence corrected against the shipped kind,
So that the promise the site makes is one the schema keeps.

**Acceptance Criteria:**

**Given** Story 11.2's live doc-invocation gate, which is what makes this story provable rather than asserted, and the pages that carry the claim, `docs/index.md:72` reading "Two interface kinds compile today", `:80` carrying the tool-use verdict "Declared and refused at compile", and `:84` reading "Two kinds parse and stop at compilation under `unsupported-interface-kind`"; `docs/explanation/what-ships.md:36-42`, whose tool-use section describes a refused kind and names the response descriptor as the open design question; `docs/how-to/evaluate-tool-use-behavior.md`, written as what a first adopter would have to build, including the accepted-kinds table at `:61-65` and the invocation at `:137-143`; `docs/reference/cli-commands.md:223` reading "ships four reference adapters", `:227` describing "a second arm for `EnvironmentProbePort`'s two mechanisms", `:229` pinning the per-port outcome counts, and `:233` carrying the corpus counts; `docs/how-to/author-behavioral-contracts.md:148` reading "`kind` says which sort of interface it came from, `api` or `cli`"; `docs/how-to/evaluate-ai-feature-behavior.md:234` reading "Eighteen of the twenty-one contracts"; and `docs/reference/glossary.md:91` and `:106`, which list which kinds compile and which the vocabulary names,
**When** every one of those is corrected against the code that now ships,
**Then** the index says three kinds compile and its routing table gives tool-use a verdict describing a shipped kind; the What Ships tool-use section describes what ships and its blocker list is gone; the tool-use guide is rewritten into one a reader can follow, with its accepted-kinds transcription current and its invocation already correct because Stories 11.4 and 11.5 moved it under Story 11.2's armed gate, which is the change that would have shipped silently without that story; the adapter count, the conformance-arm count and outcome counts, and the corpus counts in the CLI reference all move; the observation-`kind` sentence in the authoring guide gains its third value while the six `{"kind":"api"}` example lines at `:153-158` stay correct as examples; the glossary's two entries move; the generated tables `docs/ad21-*`, `ad31-*`, and `ad33-*.generated.md` are confirmed to contain no kind enumeration and are left alone; and the acceptance is that grepping the documentation for `unsupported-interface-kind` and for "refused at compile" leaves every surviving hit about `web` alone, with the epic's three deliberate omissions restated at the end of the story so the next reader does not read them as misses: `web` stays refused with `unsupported-interface-kind` fireability narrowed to that one kind, a scored run completes one trial so every strength vector comes out marked non-comparable, the package still executes nothing under evaluation so pointing it at a third-party service is the caller's adapter, and the held-out probe corpus and the second experiment round stay owed.

## Epic 12: the exports a downstream consumer reads

Implements AD-11's reader obligation from the caller's side and AD-7's dominance relation as a published comparison. Epic 8 shipped the score stage and Epic 11 shipped the fifth interface kind. This epic makes the values those stages enforce reachable from a published entry point, so a consumer states them once by importing them.

**Why this epic exists.** 3.0.0 made a stale probe stamp a `schema-version-mismatch` runtime fault at exit `5` in both `preflight` and `score`, and `PROBE_SCHEMA_VERSION` (`src/core/schemas/probe.ts:90`) and `EVAL_CONTRACT_SCHEMA_VERSION` (`src/core/schemas/eval-contract.ts:161`) are reachable from none of the four barrels. The exports map carries no wildcard, so a deep import is refused with `ERR_PACKAGE_PATH_NOT_EXPORTED`. A consumer therefore has to copy the number into its own source to satisfy a rule this package enforces, which is the drift the constants were introduced to end. `compareDominance` (`src/core/score/strength.ts:254`) is in the same position: AD-7's four-valued relation is implemented, tested, and unreachable.

**Definition of done.** A consumer on a released version reads both schema versions and runs the dominance comparison through `import ... from 'eval-quality'`, with no deep import and no copied literal. `VERSION` is written from `package.json` by a generator rather than by hand, and a gate that needs no build fails when the two disagree. A source comment claiming a verification names the case that performs it, and a gate holds that convention.

**What this epic may not do.** No artifact `schemaVersion` moves, no published JSON Schema document changes, and no stage behavior changes. The package boundary holds: `src/index.ts` keeps its two edges, `root -> application` and `root -> core-schemas`, so a name from `core/score` reaches the root barrel through `src/application/index.ts` and nothing amends the dependency matrix.

### Story 12.1: The schema-version constants, the dominance comparison, and a version that cannot drift

As a consumer of `eval-quality`,
I want the package to export the versions it enforces, the comparison it defines, and a version string that matches the release,
So that I read all three from the package instead of copying them or being unable to reach them at all.

**Acceptance Criteria:**

**Given** `PROBE_SCHEMA_VERSION` and `EVAL_CONTRACT_SCHEMA_VERSION` are reachable from none of the four barrels,
**When** each is exported from the root barrel on its `root -> core-schemas` edge,
**Then** both resolve from `eval-quality` and each is declared as the literal integer, so a consumer comparing against one narrows on it.

**Given** `compareDominance` is absent from the root barrel and cannot be deep-imported,
**When** it is re-exported through `src/application/index.ts`, which is the one path `core/score` has to the root barrel,
**Then** it resolves from `eval-quality` along with `ComparableResult`, `DominanceRelationValue` and `Severity`, each union type accompanied by the `as const` array it is derived from, the way `FAILURE_CODES`, `RUNTIME_FAULT_CODES`, `VERDICTS`, `EVALUATOR_RECOMMENDATIONS` and `QUALIFICATION_FAILURES` already ship.

**Given** `VERSION` is a hand-written literal in `src/index.ts` that `scripts/release-prepare.mjs` rewrites by string substitution, and the case that asserts it matches the manifest reads `dist/` and skips when no build has run,
**When** the number is written by `npm run generate:version` from `package.json` and checked by `npm run check:version` inside `validate`,
**Then** the gate fails on a disagreement without needing a build, and `release-prepare` calls the generator rather than carrying its own copy of the substitution.

**Given** the new exports exist,
**When** `npm run validate` runs,
**Then** `tests/architecture/package-exports.test.ts` asserts each new name is present on the built barrel, the published-surface section of `docs/reference/cli-commands.md` lists them, and `CHANGELOG.md`'s `[Unreleased]` records what a consumer gains.

### Story 12.2: A comment that claims a verification names the case that performs it

As a reader checking a claim a source comment makes about this repository,
I want the comment to name the test case it is pointing at,
So that the claim is one I can run rather than one I have to take on trust.

**Acceptance Criteria:**

**Given** `scripts/release-prepare.mjs:153` read "A test asserts the two agree" while naming no test, and the case it meant, `tests/architecture/package-exports.test.ts:269`, reads `dist/` and skips when no build has run, so a reader running `npm test` saw the claim pass without the assertion executing,
**When** the convention Story 12.1 established is made enforceable,
**Then** a gate reads every comment under `src/` and `scripts/` that asserts a verification exists, requires each to name a test case identifier, and fails when the named case is absent from the suite.

**Given** `check:doc-claims` resolves eight classes of published-page claim against an artifact and its own header scopes it to `docs/`,
**When** the new gate is written,
**Then** it follows the same shape, resolving each matched comment against the suite, and `check:doc-claims` stays scoped to `docs/` with no change.

**Given** case numbering is hand-maintained and already irregular, with `case 147b` alongside two unnumbered cases sitting between 157 and 158, so a gate matching on a case number inherits that fragility and eventually fails for the wrong reason or passes for the wrong reason,
**When** the identifier the gate matches on is chosen,
**Then** the choice is settled with evidence about how stable each candidate is, starting from the quoted case title that Story 12.1's interim gate already matches on; if titles prove no more stable than numbers, the story's content becomes giving cases a durable identifier at all, and that is decided here rather than halfway through.

**Given** three more instances in one docblock, `src/testing/probe-conformance.ts` reading "the `api` arm: thirteen assertions" against a published `CONFORMANCE_OUTCOME_COUNTS['environment-probe']` of 19, "the `cli` arm: ten" against a `command-probe` of 16, and "the `mcp` arm: eight" against an `mcp-probe` of 14, where every number is correct because each is the arm's own count beside the six shared, and the sentence reconciling them sits four hundred lines away at `:444`,
**When** the gate's reach is settled,
**Then** the story states plainly what a source-comment gate can and cannot hold. It can hold a claim naming something the repository resolves: a test case, a symbol, a failure code, a count with a source. A claim whose defect is ambiguity rather than falsity is outside any pattern worth writing, because the number agrees with something and only the missing unit makes it misread. Saying so is the deliverable; a gate that appears to cover it is worse than one that declares the boundary.

**Given** the ambiguity class is stated as out of reach, and one crude heuristic might still reach part of it, a numeral in a docblock with no noun naming what it counts within a short window, which would have flagged `probe-conformance.ts:6`,
**When** the boundary is written,
**Then** that heuristic is trialled against the tree and its false-positive count measured before it is adopted or dropped, the way Story 12.1 measured `RELEASE_STATE`'s blast radius at zero before widening a trigger. A short look decides it; a wall of false positives means it is dropped and the boundary statement stands alone, and that outcome is recorded rather than left as an untried idea.

**Given** the trigger-recall lesson Story 12.1 earned on `check:doc-claims`, where a verification verb vocabulary could not reach a release announcement and a three-component version pattern could not reach a two-component version,
**When** this gate's triggers are written,
**Then** they are tested for recall rather than for confirmation: for each trigger, name an instance of the defect the vocabulary cannot reach, and seed at least one fixture whose wording is drawn from outside it. The two instances on record are a claim about a verification (`release-prepare.mjs`) and a claim about a number (`probe-conformance.ts`), and a gate written against either alone misses the other.

**Given** a gate that cannot fire looks exactly like one that can,
**When** the gate ships,
**Then** its failure is proven by removing a named case and watching the gate fail, and the proof is recorded in the story.

**Given** the gate is new,
**When** `npm run validate` runs,
**Then** it is green with the gate wired into the chain and into the validate step name in `.github/workflows/pr-checks.yml`.

### Story 12.3: Name the three versions the package stamps, and publish the five it only reads

As a maintainer of `eval-quality`,
I want each artifact version this package writes or validates against to be a named, exported constant,
So that the number cannot disagree with itself between the writer and the reader, and a consumer stops transcribing it.

Originates in TEA's Story 2.2 and requirements FR11 and FR13.
It blocks TEA's Story 2.6, which replaces a five-entry `SCHEMA_VERSIONS` table with reads of these exports; TEA hand-corrected `sealedRunRecord` from 3 to 6 on 10 September because it was emitting records no stage could read, and that correction stays a literal until this ships.

**Acceptance Criteria:**

**Given** the package stamps exactly three artifacts with a bare literal, `sealed-evaluator-brief` at `src/core/seal/seal.ts:98`, `evidence-artifact` at `src/core/emit/emit.ts:110`, and `preflight-verdict` at `src/core/preflight/reduce.ts:475`, and each writing module already imports the schema module its artifact is declared in, which `scripts/dependency-direction.ts:79-81` permits as a `core -> core-schemas` edge,
**When** each literal is replaced by a named constant declared beside the schema it stamps,
**Then** the writer reads the constant, a search for a bare `schemaVersion: <integer>` assignment under `src/` returns nothing, and the dependency matrix is unamended.

**Given** `sealed-run-record`, `isolation-manifest`, `evaluator-configuration`, `scoring-policy` and `private-artifact-manifest` are caller-produced, validated at `src/application/score.ts:99`, `:108`, `:117`, `:141` and `:150`, and carry their versions in no value under `src/`,
**When** the version a caller must write is published for each,
**Then** all five constants are exported from the root barrel on the `root -> core-schemas` edge beside the two Story 12.1 shipped, each declared as the literal integer.

**Given** `src/core/schemas/lineage.ts:20-25` keeps `schemaVersion` a plain `z.int().min(1)` so a stale artifact raises AD-28's `schema-version-mismatch` rather than an anonymous parse failure, and every published document declares the field as a bare integer with no `const`, `enum` or default, so no accepted version is readable from any schema object,
**When** the constants are held against something other than a second transcription,
**Then** each constant whose artifact has a predecessor shape is held by parse behaviour: a record built at the constant parses and one built at the constant minus one does not, with both fixtures built from the constant so a shape change that forgets the constant fails. Where the artifact is at version 1 there is no predecessor and the question is vacuous, which is recorded per artifact rather than papered over.

**Given** `tests/schemas/eval-contract-version.test.ts` already pins one constant, walks emitted corpus and chain bytes, and source-walks `src`, `tests` and `scripts` for a stale stamp in an authored literal,
**When** that treatment is generalised,
**Then** every new constant is covered the same way, and the file's two stale items are corrected: it declares its own local copy of `EVAL_CONTRACT_SCHEMA_VERSION` rather than importing the one Story 12.1 exported, and its docblock still asserts that no reader declares an expected version constant, which `src/core/compile/compile.ts:102-104` falsifies.

**Given** `scripts/check-doc-claims.ts:537-583` and `:663-669` require every `src/` file performing version equality to be named in `VERSION_READER_BY_FILE`, with a `tokenShape` of `/^(?:compile|preflight|score)$/` and a matching sentence in `docs/explanation/what-ships.md`,
**When** this story changes which files carry a version,
**Then** that registry, that pattern and that sentence move together, and `docs/explanation/what-ships.md:58`'s "The remaining artifacts have no such reader" is corrected, since this story publishes versions for five of them.

**Given** `schemas/artifact-reference.schema.json` deliberately carries no `schemaVersion`, asserted against the registry's `carriesLineage` flag by `tests/schemas/artifact-registry.test.ts:125-131` and `:146-157`,
**When** this story runs,
**Then** that artifact is left alone and both assertions still pass.

**Given** the caller-produced artifacts carry their versions in authored fixtures and generators,
**When** this story runs,
**Then** `rubric` stays out of scope with its reason recorded, because the package never parses it and the eval contract embeds `RubricBody` rather than the versioned artifact.

**Given** the whole change,
**When** `npm run validate` runs,
**Then** it is green, and `tests/architecture/package-exports.test.ts` asserts each new name on the built barrel with its literal declared type.

### Story 12.4: The isolation manifest's undeclared breaking change

As the maintainer of a published package,
I want the decision about an artifact whose shape broke without a version bump made deliberately and recorded,
So that a consumer's version check against it means what the consumer thinks it means.

**This story carries a decision the repository owner makes. It is written so that decision can be taken from the story alone.**

**The evidence, verified in the tree.** At `cb1cae8` (PR #74, "describe a system under test that runs behind a command") six fields on `IsolationManifest` narrowed from `z.array(z.string())` to `z.array(NonEmptyLabel)`: `allowedMounts`, `observedMounts`, `networkAllowlist`, `observedNetworkTargets`, `toolAllowlist` and `observedToolCalls`. `violation` gained `.min(1)` in the same commit. That commit is contained in v0.3.0 and every release since. AD-11's rule is that "adding an optional field is a `schemaVersion` bump recorded in the field's own description; removing or retyping is breaking", so this is a breaking retype. A manifest carrying `allowedMounts: ['']` parsed before v0.3.0 and fails now, and `ISOLATION_MANIFEST_SCHEMA_VERSION` reads 1 on both sides of that break.

The same commit bumped the eval contract from 3 to 4, the sealed run record from 3 to 4 and the probe from 2 to 3. So the omission is specific to this artifact rather than a period when the rule was not being followed.

**The second-order effect, which is easy to miss.** Because the number never moved, there is no version-N-minus-one to build a predecessor from. Story 12.3's parse-behaviour method holds a constant by asserting that a record at the constant parses and one at the constant minus one does not; this artifact has a shape history that method cannot reach at all, and it is the one version-1 artifact where the question is not vacuous.

**The decision, with both options and what each costs.**

*Retro-bump the manifest to 2.* The number then tells the truth about the shape, and a consumer comparing against `ISOLATION_MANIFEST_SCHEMA_VERSION` learns something real. The cost lands on every existing writer: a caller emitting a version-1 manifest is emitting a stamp this build would then refuse, and every such caller has to move in step with the release. The break is already in the code, so the bump declares an existing break rather than creating one; what it creates is a new refusal for artifacts that parse today.

*Leave the number at 1 and document the undeclared break.* Nothing a consumer has written stops working, and the CHANGELOG carries the break against the version it actually shipped in. The cost is that the version number stays silent about a shape change AD-11 says it should carry, and a future reader comparing v0.2.x and v0.3.0 manifests finds two different shapes under one number with only prose to separate them.

**One question that narrows the cost, unconfirmed and to be answered before the decision is taken.** What writes an isolation manifest today, and is any of it outside this machine? The reading offered by the session that raised this, explicitly unverified: the only current consumer of `eval-quality` is TEA, and the planned adoption order after it is BMad's `evaluate` skill, then `seontechnologies/seon-claude-marketplace`, then the SEON MCP server, then the Internal AI Assistant much later, none of which has started. If that holds, a retro-bump breaks one known writer that is being actively worked on rather than an unknown population, which changes the cost materially. Confirm it by reading the npm dependents and by checking whether anything in TEA writes a manifest. It is a question here rather than an answer, because a wrong reassurance is worse than none.

**Acceptance Criteria:**

**Given** the decision is the repository owner's,
**When** this story runs,
**Then** it starts by putting both options above in front of him and proceeds on his answer, and the answer is recorded in the story with its reasoning.

**Given** whichever option is chosen,
**When** it is applied,
**Then** `CHANGELOG.md` records the break against `v0.3.0` where it actually shipped, naming the six fields and `violation`, so the record is complete whether or not the number moves.

**Given** Story 12.3 corrected `ISOLATION_MANIFEST_SCHEMA_VERSION`'s docblock to say the shape has moved once under a released retype with no bump,
**When** this story closes,
**Then** that docblock says what was decided and why, and the parse-behaviour consequence is stated: with a bump the artifact joins `SHAPES` with a version-1 predecessor built on `allowedMounts: ['']`; without one it stays outside the method with the reason recorded.

**Given** this artifact is the one that was missed,
**When** the story runs,
**Then** every other artifact's history is swept the same way, by reading each schema's commit history for a retype or a removal against the version it carried at the time, so a second instance is found here rather than by a consumer. The sweep runs in both directions: a version that moved where nothing breaking changed is the same defect, a number that does not mean what it claims, and it costs nothing extra to look for while the history is open.

### Story 12.5: The file-system mechanism a consumer cannot wrap

As a consumer certifying an adapter against the published conformance suite,
I want the default mechanism each reference adapter wraps to be published too,
So that what I certify is the thing this package ships rather than my reconstruction of it.

Originates in TEA's Story 3.4, where tea-s61 certified `createNodeFileSystemAdapter`.

**Why this exists.** `eval-quality/adapters` exports `nodeCommandMechanism` and `nodeStdioMcpMechanism` and no file-system equivalent. `runFileSystemPortConformance` requires each `PortSubject` to supply `build(scenario)` returning `{ port, underlyingCalls }`, where `underlyingCalls` counts, so the mechanism has to be one the test supplies. For the command arm a consumer wraps the published mechanism and counts through the wrapper, so the thing certified is the mechanism the package ships. For the file-system arm there is nothing to wrap, so the consumer writes the `node:fs/promises` calls it believes the default makes and counts those. What that leaves uncertified is whether the default is the pair of calls the consumer believes it is, and six of the twelve assertions rest on that belief. The consumer stated the limit in its own header rather than leaving it implicit, which is why nothing downstream is blocked.

**Acceptance Criteria:**

**Given** `nodeCommandMechanism` and `nodeStdioMcpMechanism` ship from `eval-quality/adapters`,
**When** the file-system default is published,
**Then** `nodeFileSystemMechanism` ships from the same entry point in the same shape, and a consumer wrapping it counts the calls the shipped adapter actually makes.

**Given** the asymmetry was found one port at a time,
**When** this story runs,
**Then** every port is checked for the same shape rather than assumed clean: whether `ClockPort` and `CorpusPort` have a comparable default a consumer would otherwise reconstruct, and the answer is recorded per port. The version-history sweep in Story 12.4 is the precedent; finding the next instance here costs less than a consumer finding it.

**Given** this package runs its own conformance suite,
**When** its own subjects are read,
**Then** the story says whether any of them wraps a real default that a consumer cannot reach. A package holding itself to a standard its consumers cannot reach is the shape Story 2.5 exists to close for the gates, and it is worth knowing whether it repeats here.

**Given** the new export,
**When** `npm run validate` runs,
**Then** it is green, `tests/architecture/package-exports.test.ts` asserts the name on the built adapters barrel, and `docs/reference/cli-commands.md` lists it beside the two already there.
