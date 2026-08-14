---
baseline_commit: 0a5d44b
---

# Story 1.3: The Eval Contract schema — declarations, operand grammar, and plan grammar

Status: review

## Story

As a contract author (human, agent, or CI job),
I want the complete Eval Contract schema in Zod carrying every declaration AD-19 requires,
so that the fourteen discipline predicates are decidable from declarations alone and no authoring coin flip survives into implementation.

## Acceptance Criteria

### AC 1 — One Zod definition, in `src/core/schemas/`, and nothing generated

The Eval Contract is defined once in Zod 4.4.3 under `src/core/schemas/`, in `kebab-case.ts` files, one artifact or shape per file. Exported symbols are PascalCase nouns matching their schema title (`EvalContract`, `JsonValue`, `Oracle`, …) because Stories 1.4 and 1.5 import them.

This story writes **no** JSON Schema generator, creates **no** top-level `schemas/` directory, and adds **no** CI check beyond the existing `npm run validate` chain. The export and its four checks are Story 1.5; the other eleven interchange artifacts are Story 1.4. Zero new runtime dependencies.

The schema is written so Story 1.5 exports it without restructuring: **prefer native, exportable Zod constructs over refinements wherever a native construct exists.** Verified on the pin — `.refine()` and `.check()` are *silently dropped* from `z.toJSONSchema` output, so a refined constraint is invisible to every non-TypeScript consumer. `.describe()` and `.meta({ description })` **do** survive, so a decision stated in a field description is readable off the published schema.

### AC 2 — Every AD-19 declaration is present and typed

The tables below are the deliverable. Two columns are load-bearing and neither is decoration:

- **Nullable** — a required key whose value may be `null` (Consistency Conventions: an absent value is explicit `null`, never an omitted key). Spelled `.nullable()`, never `.optional()`.
- **Empty** — whether an empty collection is legal.

AD-31 distinguishes **three** declaration states, not two: a declaration that is absent, a declaration present but indeterminate, and "an explicit empty declaration [which] is an answer rather than a gap". Under the explicit-`null` convention, absent is spelled `null`.

This three-state requirement applies to the **collection-valued declarations whose empty and absent states AD-31 grades differently**, and to those only — five of them: `siblingGroups`, `referenceSets`, `channelRoles`, `collectionLocations`, `scopedResources`. Other fields are nullable for their own stated reasons and the tables govern; this clause neither adds to nor subtracts from them. Each of the five is nullable *and* empty-capable, or Story 5.3 cannot write its relevant-and-gapped fixture beside its relevant-and-answered one. It does **not** generalize: `responseDescriptor` (rule 2), `requestShape` (rule 3), `stateChangeMarker` (rule 7), and the operation inventory are all read by predicates and all correctly non-nullable — nulling the response descriptor leaves AD-20 rule 2's denominator nothing to read.

**One carve-out to the explicit-`null` convention, stated because five shapes now depend on it.** "Explicit `null`, never an omitted key" binds **control objects with fixed keys**. In a caller-keyed map a **missing key means "not declared" and is legal** — `channelRoles` is expected to be partial (AC 10) and `types` need not name every permitted key. Where "declared but indeterminate" must be distinguishable from "not declared", the **value type carries the explicit `null`**. Without this carve-out the strict-object audit and Story 1.5's differential check each have two readings for every caller-keyed map.

**Contract level**

| Field | Shape | Nullable | Empty | Source / note |
| --- | --- | --- | --- | --- |
| `schemaVersion` | `z.int().min(1)` | no | — | AD-11 — "integer under that exact name". **Not `z.literal(1)`**: verified that `z.literal(1)` exports `{"type":"number","const":1}`, losing `integer` for the non-TypeScript consumer, and pinning it turns a version-2 artifact into an anonymous `schema-parse-failure` instead of AD-28's dedicated `schema-version-mismatch` fault. Version equality belongs to the reader that throws that fault |
| `contractId` | identifier slug | no | — | charset fixed in `primitives.ts` (AC 3) |
| `parentDigest` | digest form | **yes** | — | AD-29. `null` ⟺ `revisionCount: 0`; state the biconditional in the field description, not a refinement, and ledger it |
| `revisionCount` | `z.int().min(0)` | no | — | AD-29 — one greater than the parent's |
| `sourceSpecDigest` | digest form | **yes** | — | prior art, AD-18 — a digest is permitted where the content is forbidden |
| `behaviors` | array | no | **no** (≥1) | AD-19. US-spelled, matching the prior art and both hand-authored contracts |
| `oracles` | array | no | **yes** | AD-19 is explicit that `no-observable-success-criterion` "never fires on an empty oracle list", so an empty list must parse. **No minimum** |
| `rubrics` | array | no | yes | AD-19, AD-22 — a zero-rubric contract compiles clean |
| `waivers` | array | no | yes | AD-5, FR1 — Decision 1 |
| `permittedInterfaces` | array | no | yes | AD-19, AD-35 — logical identifiers only; never a URL, host, or port |
| `referenceSets` | keyed map (AC 7) | **yes** | yes | AD-19, AD-31's three states |
| `siblingGroups` | `{ operations, parameters }` of group lists | **yes** | yes | AD-19, AD-31's three states. `[]` is the explicit empty answer; each group carries `.min(2)` members |
| `interactionPlan` | array | no | **yes** | AD-19, AD-39. An empty plan is the cheapest `unreachable-check-evidence` fixture. **No maximum** — `plan-exceeds-scripting-bound` needs the 64-pair and 8-chain plans representable |
| `scopedResources` | array of `{ reference, kind }`, opaque | **yes** | yes | AD-16, `scoped-reference-resolves-forbidden` — Decision 2. Absent, empty, and populated are three distinct answers |
| `forbiddenInputs` | array over the closed seven | no | yes | AD-16 — a short list stays representable for `forbidden-input-floor-incomplete` |
| `testData` | `{ setup, cleanup }` | no | — | both nullable strings |
| `budgets` | `{ maxToolCalls, maxWallClockMinutes, maxCostUsd }` | no | — | `maxCostUsd` is money — a **string** in a declared format, per AD-36; an undeclared "declared format" is the same unshaped-declaration defect Decision 9 is about. Declare `decimal-string` as `^-?(0\|[1-9][0-9]*)(\.[0-9]+)?$` in `primitives.ts`, and constrain **this** field to the unsigned form: a negative ceiling is not a ceiling |
| `safetyLimits` | string array | no | yes | AD-19 |
| `requiredEvidence` | string array | no | yes | AD-19 |
| `probeStepBound` | `z.int().min(0)` | **yes** | — | AD-16's "declared bound on enumerated probe steps", which Epic 2's emitted-brief scripting audit reads and which no AD gives a home — Decision 10 |

**Behaviour**

| Field | Shape | Nullable | Empty | Source |
| --- | --- | --- | --- | --- |
| `id` | `^B-[0-9]{3,}$` | no | — | Conventions |
| `description` | string | no | — | AD-19 |
| `severity` | `low` \| `material` \| `critical` | no | — | Conventions |
| `observableSuccessCriterion` | string | **yes** | — | AD-19 — `null` is the shape `no-observable-success-criterion` fires on |
| `requirementLinks` | array of `{ scheme, id }` | no | **yes** | AD-19, Conventions |
| `riskLinks` | array of `{ scheme, id }` | no | **yes** | both empty is what `missing-requirement-linkage` fires on |
| `oracles` | array of `O-` identifiers | no | yes | AD-19 |

**Oracle**

| Field | Shape | Nullable | Source |
| --- | --- | --- | --- |
| `id` | `^O-[0-9]{3,}$` | no | Conventions |
| `direction` | the Direction shape | **yes** | AD-3 — `null` is half of what `oracle-missing-channel` fires on |
| `check` | expression tree | **yes** | AD-3 — the other half |
| `polarity` | `expects-hold` \| `expects-violation` | no | AD-33 — the check's polarity, one per check |
| `commentary` | string | **yes** | AD-3 — author documentation no predicate reads and `seal` never emits |

**Direction**

| Field | Shape | Nullable | Empty | Source |
| --- | --- | --- | --- | --- |
| `evidenceTargets` | array of **spelling-1** pointers only | no | yes | AD-3 computes containment *after* quantifier substitution, so a target is always fully rooted and `@/` never appears here |
| `relation` | the sixteen-member vocabulary (AC 4) | no | — | AD-3 |
| `polarity` | `expects-hold` \| `expects-violation` | no | — | AD-3 — see coin flip (a) |
| `scope` | string | **yes** | — | AD-3 — evaluator-facing, exempt from alignment |
| `negativeDomain` | string | **yes** | — | AD-3 — exempt from alignment; `seal` renders it as an unordered set |

**Interface**

| Field | Shape | Nullable | Empty | Source |
| --- | --- | --- | --- | --- |
| `logicalId` | identifier slug | no | — | AD-35 — a logical identifier, never a URL, host, or port |
| `kind` | `api` \| `web` \| `cli` \| `mcp` | no | — | all four admitted so `unsupported-interface-kind` stays fireable |
| `operations` | array | no | yes | **no uniqueness refinement** — `duplicate-operation-signature` dies if the schema dedupes |

**Operation**

| Field | Shape | Nullable | Empty | Source / note |
| --- | --- | --- | --- | --- |
| `operationId` | identifier slug | no | — | |
| `method` | `GET` \| `HEAD` \| `POST` \| `PUT` \| `PATCH` \| `DELETE` \| `OPTIONS` | no | — | AD-19 fixes the closed seven **uppercase**; see AC 7's second enum exception |
| `pathTemplate` | brace `{name}` syntax only | no | — | AD-19 — never `:name`; two implementations must not disagree over whether `/notes/{id}` and `/notes/:id` are one template |
| `stateChangeMarker` | boolean | no | — | AD-19, AD-20 rule 7 relevance |
| `requestShape` | four-key `z.strictObject` `{ path, query, header, body }` | no | — | each channel carries `requiredKeys`, `permittedKeys`, `types`, all **empty-capable** — AD-20 rule 3 relevance needs an operation with zero typed keys across all four, which is also AD-10's "declares no inputs in any channel is exempt" case. A `header` channel names a header and its type, never a credential value (AD-18). Spelled as a strict object, not `z.record` — see AC 5 |
| `responseDescriptor` | see below | no | — | **per operation** — AD-19 |
| `volatilePointers` | array of **spelling-3** pointers | no | yes | AD-11, AD-19 |

**Response descriptor** — all pointer-valued fields use **spelling 3** (descriptor-relative).

| Field | Shape | Nullable | Empty | Source / note |
| --- | --- | --- | --- | --- |
| `requiredKeys` | string array | no | yes | **no minimum of two anywhere** in this shape — AD-20 rule 2 relevance is "the descriptor declares more than one pointer", so a one-pointer descriptor must parse |
| `permittedKeys` | string array | no | yes | |
| `types` | keyed map, key → JSON type name **or `null`** | no | yes | a missing key means "not declared"; an explicit `null` value means "declared, type not stated", which is the state `quantifier-over-non-collection` reads and the shape Decision 9's indeterminate branch would attach to |
| `successIndicator` | spelling-3 pointer | **yes** | — | AD-20 rule 1 relevance first conjunct |
| `channelRoles` | keyed map, pointer → `success-indicator` \| `diagnostic` \| `payload` \| `collection` | **yes** | **yes** | rule 1's second conjunct needs an empty or indicator-only map; AD-31's three states need the `null` as well |
| `collectionLocations` | array | **yes** | **yes** | rule 4 relevance |

**Collection location** — `pointer` (spelling 3), `expectedCardinality`, `referenceSet` (**nullable** identifier — rule 6 relevance).

**Expected cardinality** — a discriminated union on `mode`: `{ mode: 'exact', count }` | `{ mode: 'at-most', max }` | `{ mode: 'page-bounded', max }`. Use `z.int()`: verified that it natively emits `type: "integer"` with `minimum: -9007199254740991` / `maximum: 9007199254740991`, which is AD-36's safe-integer rule exported for free.

**Reference-set declaration**

| Field | Shape | Nullable | Empty | Source |
| --- | --- | --- | --- | --- |
| `keys` | string array | no | no (≥1) | AD-19 — the key names members are compared on |
| `members` | array of objects carrying at least those keys | no | yes | AD-19 fixes members as objects rather than scalars so one declared form serves both `covers-by-key` and `set-membership` |
| `commentary` | string | **yes** | — | the Gate C fixture's `note`, named as commentary so Epic 2 has something explicit to exclude |

**Waiver** — `id` (`^W-[0-9]{3,}$`) plus `rule`, `rationale`, `condition`, `approval`, `expiresAt` (RFC 3339 UTC). Every part except the identifier is a required key with a **nullable** value, so an incomplete waiver stays representable for `waiver-incomplete`. One clarification Story 4.2's fixture author needs: AD-5 requires "a machine-checkable context condition **where one exists**", so `condition: null` is a **complete** waiver; `null` on any of the other four is incomplete.

**Rubric body**

| Field | Shape | Nullable | Empty | Source |
| --- | --- | --- | --- | --- |
| `id` | `^R-[0-9]{3,}$` | no | — | AD-22 — "rubrics and criteria are addressable identifiers so a finding can cite one" |
| `scaleLevels` | anchored levels | **yes** | **yes** | AD-22 — `rubric-unanchored` must stay fireable |
| `failureModePenalties` | named penalties | **yes** | **yes** | AD-22 — same |
| `maxLength` | `z.int().min(1)` | **yes** | — | AD-22 — an unbounded length is `null` |
| `criteria` | array of `{ id: ^RC-[0-9]{3,}$, text, evidence: spelling-1 pointer }` | no | yes | `rubric-evidence-unreachable` reads the evidence pointer |

### AC 3 — Three pointer spellings, each with its own pattern, each assigned to its consumers

There are **three**, not two, and the third is Gate C authoring point 7 — whose *scope* the second pass closed ("resolve through the operation the step names") without ever giving it a *syntax*:

1. **Interaction-rooted** — `/interactions/{stepId}/` followed by one of the closed channel vocabulary `response-body`, `response-headers`, `response-status`, `call-inputs`, `stdout`, `stderr`, `exit-code`, with `call-inputs` requiring exactly one of `path` | `query` | `header` | `body` as its next segment, and `response-status` / `exit-code` taking no tail. RFC 6901 escapes (`~0`, `~1`) permitted in the tail. **Consumers:** `{ pointer }` operands, `direction.evidenceTargets`, rubric criterion evidence.
2. **Bound-element relative** — `@/…`, admitting bare `@/`. **Consumers:** `{ pointer }` operands inside a quantifier predicate only. Never `evidenceTargets` (AD-3 computes containment after substitution).
3. **Descriptor-relative** — plain RFC 6901 pointers into one operation's response descriptor. **Consumers:** `successIndicator`, every `channelRoles` key, `collectionLocations[].pointer`, `volatilePointers`.

`shape`'s descriptor keys are plain key names, not pointers — state that so the third spelling does not get applied there by analogy.

All three are native `pattern` regexes and therefore export. The patterns are **syntax only**: step existence, evidence reachability, and "`@/` binds only inside a quantifier" are Epic 4's (`unreachable-check-evidence`, Story 4.1).

A single shared identifier charset lives in `primitives.ts` and is what makes spelling 1 decidable as a regex — `stepId` must exclude `/` and `~`. The same charset fixes `contractId`, `operationId`, `logicalId`, and reference-set identifiers, which the hand-authored contracts spell as kebab slugs (`exports-api`, `expected-export-rows`) and which no AD constrains.

### AC 4 — The operand union, the operator vocabulary, and arity discipline

**Operands** are single-keyed strict objects: `{ pointer }` | `{ literal: JsonValue }` | `{ referenceSet: <identifier> }`. The reference-set operand carries nothing else — AD-26 records that a two-key and a one-key spelling produce schemas that reject each other's contracts.

**`check`** is a recursive discriminated union on `op` (verified: `z.discriminatedUnion` + `z.lazy` recurses and rejects both arity ends on this pin).

**The tuple criterion, stated so it sorts its own table:** a tuple position holds a **member of the operand union**, or — for the three connectives — a nested expression. Anything spelled as a bare string, number, or boolean is a **named field beside** the tuple, never a tuple position, because a tuple position silently makes `{ pointer }` legal where a bare value was meant.

**Operand typing per position is the compiler's, not the schema's.** Every tuple position takes the **full operand union**. AD-26 says the reference-set form "in any position other than the three named above fails under `malformed-operator-expression`", which only stays fireable if the other positions admit it — narrowing a position in Zod deletes that code's operand-type limb and falsifies AC 8's own closing sentence. The "legal type" column below is what Epic 4 enforces.

**Exactly one position is deliberately narrowed, pre-settled here so the dev does not trip over it:** `set-membership`'s set operand carries `.min(1)` on its literal-array form (coin flip (b)). The cost, named: a `{ literal: [] }` and a `{ pointer }` in the set position become schema rejections rather than `malformed-operator-expression`. Any *other* narrowing the dev adds is a decision recorded with the code it costs.

| Form | Tuple arity | Legal operand types (Epic 4 enforces) | Named fields |
| --- | --- | --- | --- |
| `equality`, `deep-equality` | 2 | pointer or literal | — |
| `containment` | 2 | container: pointer; set: pointer, literal, or reference-set | — |
| `existence`, `absence` | 1 | pointer | — |
| `regex` | 1 | pointer | `pattern` (string) — a named field so Epic 4's backreference and lookbehind check has one place to look rather than a `{ literal: JsonValue }` that may hold any JSON. AD-4 says the dialect is "always fully anchored" and gives a code only for backreferences and lookbehind, so under the admit-rule's second clause **anchoring is the schema's**: require a leading `^` and trailing `$`, natively and exportably |
| `set-membership` | 2 | value: pointer; set: reference-set or `{ literal: [...] }` array, `.min(1)` | — |
| `ordering` | 1 | collection pointer | `key` (string), `order`: `ascending` \| `descending` — named `order`, not `direction`, which is the oracle's five-field structure |
| `count-tolerance` | 1 | collection pointer | `expected` (int), `tolerance` (int), `relative` (boolean) — AD-4 says the flag is *declared* |
| `shape` | 1 | pointer | `descriptor`: typed strict object of required keys, permitted keys, per-key JSON type. AD-4: a closed descriptor, "never an embedded JSON Schema" — typing it is what makes that structural. Deliberate divergence from the Gate C fixture's `{ literal: {...} }` spelling |
| `covers-by-key` | 2 | `expected`: reference-set; `actual`: collection pointer | `expectedKey`, `actualKey` (strings) |
| `not` | 1 expression | — | — |
| `all`, `any` | n expressions | — | settle and record the minimum; `.min(n)` exports `minItems` natively |
| `for-all`, `for-any` | — | — | `collection` (operand), `predicate` (expression) — not a tuple |

The **direction's `relation`** is drawn from the **full sixteen-member vocabulary** — eleven operators, three connectives, two quantifiers — not the eleven operators. Verified against the Gate C contract: six of its eight oracles declare `all`, `not`, or `for-all` as the relation. Typing `relation` to the operators alone makes the primary accept fixture fail on six of eight.

This is the schema-side half of AD-4 only. Resolution semantics are Epic 3.

### AC 5 — The plan grammar

A step declares exactly three things: an identifier, the operation it refers to, and a selection predicate composed of an input binding and a **nullable `after`** naming an earlier step.

`inputBinding` is a **four-key `z.strictObject` with each channel nullable**, not a `z.record` keyed by the channel enum. Verified on the pin: `z.record(z.enum(['path','query','header','body']), X).safeParse({ body: … })` **fails with three `invalid_type` issues, one per missing channel** — a record over an enum key requires every member — and five of the Gate C fixture's six steps carry a partial binding (`{body}`, `{path}`, `{path, query}`). `z.partialRecord` exists on this pin and accepts the partial, but it reintroduces the omitted-key spelling the Consistency Conventions ban. The strict-object spelling requires all four keys present with `null` for the unbound ones, which is what the convention demands; record the fixture re-spelling. `requestShape` is the same shape one level up and takes the same spelling — it is unaffected in practice, since the fixture declares all four channels on every operation.

**One spelling, not two, for "this channel binds nothing":** `null`. An empty map `{}` is rejected. A binding channel has no meaningful declared-and-empty state distinct from unused — unlike a `requestShape` channel, where `{ requiredKeys: [], permittedKeys: [], types: {} }` genuinely means "declared, no keys" and is legal. No AD-5 code fires on an empty binding map, so under the admit-rule's second clause the schema is the enforcement point.

Binding values are the **tagged** union `{ literal: JsonValue }` | `{ matcher: 'any' | 'type-violating' }` and nothing else. An untagged value must be **unrepresentable**: AD-39 records the untagged spelling as having flipped a witness match between `caught` and `missed` on one record, and the schema is where that dies.

Not enforced here, each for a named reason in AC 8: the one-level temporal bound, the graph predicate, plan width and depth, and any agreement between binding keys and the operation's `requestShape`.

### AC 6 — The three Gate C coin flips are settled by construction and recorded

Each of (a) polarity once or twice, (b) `set-membership`'s literal-array set operand, and (c) linkage location is settled in the schema, stated in the affected field's `.describe()` so a non-TypeScript consumer reads the decision off the published schema (verified: descriptions survive the export), and recorded in the Dev Agent Record with its reasoning. Dev Notes carry a recommendation and reasoning for each; a different choice is legitimate if the reasoning is recorded.

### AC 7 — The Consistency Conventions hold, and every exception is named

Every control object is `z.strictObject`. `JsonValue` is the named recursive value container.

**Caller-keyed maps are named explicitly, not left implicit.** Verified: `z.record(k, v)` exports `{"type":"object","propertyNames":{…},"additionalProperties":{…}}` — schema-valued, not `false`. **Six** shapes are caller-keyed, and the count and the list must agree: (1) `channelRoles`, (2) the per-channel `types` maps inside `requestShape`, (3) the response descriptor's `types` map, (4) `shape`'s descriptor per-key type map, (5) `referenceSets`, (6) **each `inputBinding` channel's parameter-name-to-binding-value map**. Note what AC 5 does and does not settle: it makes the four-key *containers* of `inputBinding` and `requestShape` strict objects, which does not make their contents fixed-key — the Gate C fixture's `{"body": {"datasetId": …, "filters": …}}` keys on the author's own words, and that map appears in every interaction step of the primary accept fixture. Either re-spell the six as arrays of strict `{ key, value }` entries, or keep them as maps and name each one in the strict-object audit's exemption list with its `propertyNames` pattern and strict value schema. Recommendation: keep the maps (both hand-authored contracts use them and an array-of-pairs spelling is worse to author), record each by name, and record whether that reads as an amendment to the "single named exception" sentence.

**Two enumeration exceptions, both named.** Enumeration values are lowercase kebab-case, *except* the four uppercase verdicts (which do not appear in this artifact) and **HTTP `method`, which AD-19 fixes as the uppercase closed seven and which AD-40 compares against**. Do not let a strict-enum audit lowercase it.

Dates are RFC 3339 **UTC** — `z.iso.datetime()` with no offset (verified: accepts `Z`, rejects `+02:00`). Nullability is `.nullable()` on a required key, never `.optional()` (verified: `.default()` diverges input and output mode, dropping the key from `required` in input mode).

All **eight** identifier prefixes named in the AC of record — `B-`, `O-`, `P-`, `W-`, `D-`, `F-`, `R-`, `RC-` — are defined as patterns in `primitives.ts` requiring three or more zero-padded digits, so Story 1.4 imports rather than re-spells them. This artifact uses five (`B-`, `O-`, `W-`, `R-`, `RC-`); record why `P-`, `D-`, and `F-` are defined but unused here.

Digest-valued fields reuse Story 1.2's `sha256:` + 64-lowercase-hex form. The contract's schema description names the prior-art schema it succeeds (`eval-contract`) per AD-24.

### AC 8 — The schema admits every shape an AD-5 code fires on

The load-bearing rule:

> Where AD-5 gives the compiler a literal code, the schema **admits** the shape and Epic 4 or Epic 5 rejects it. Where no code exists, the schema is the enforcement point.

A schema tightened past an AD-5 code does not make the product safer: it converts a coded, artifact-path-carrying structural error into an anonymous `schema-parse-failure` **fault** (AD-5: schema-parse failure is a fault, not a structural error; the two vocabularies are disjoint) and deletes the fixture Story 4.2 owes.

All twenty codes, each with the shape that must stay representable. The dev records the walk and marks any pre-emption as a decision.

| Code | Shape that must stay representable |
| --- | --- |
| `missing-requirement-linkage` | both link arrays empty on a behaviour |
| `no-observable-success-criterion` | `null` criterion. Separately: an **empty oracle list** must parse and must **not** fire this code — AD-19 says it "never fires on an empty oracle list", which was the other defensible reading and produced a different schema |
| `oracle-missing-channel` | `null` `direction` or `null` `check` |
| `direction-check-misaligned` | a direction whose targets, relation, or polarity differ from `check` — **do not refine cross-field agreement** |
| `unreachable-check-evidence` | a pointer naming an undeclared step; an empty `interactionPlan` |
| `malformed-operator-expression` | a reference-set operand in any position outside AD-26's three — hence AC 4's full-union tuple positions; a regex with a backreference or lookbehind |
| `quantifier-over-non-collection` | a quantifier whose collection pointer the descriptor types as a scalar |
| `quantifier-nesting-exceeded` | a quantifier inside a quantifier, and `covers-by-key` inside one |
| `unresolved-reference-set` | a reference-set operand naming an undeclared identifier — the identifier is **not** a `z.enum` of declared sets and **not** refined against `referenceSets` |
| `duplicate-operation-signature` | two operations colliding on method plus path template after parameter-name erasure — **no uniqueness refinement on `operations`** |
| `undeclared-mandatory-input` | a step binding a key the operation's `requestShape` does not declare — **do not refine `inputBinding` keys against `requestShape`** |
| `nested-temporal-clause` | a temporal clause naming a step that carries one |
| `plan-exceeds-scripting-bound` | the 64 `write-N`/`read-N` pairs and the 8-step single-root chain — **no `.max()` on `interactionPlan`, no cap on `after` chains** |
| `unsupported-interface-kind` | `kind` of `web`, `cli`, or `mcp` |
| `waiver-incomplete` | a waiver missing any part |
| `forbidden-input-floor-incomplete` | a forbidden-input list short of the seven |
| `scoped-reference-resolves-forbidden` | a scoped resource reference at all — hence AC 2's `scopedResources` |
| `rubric-unanchored` | an unanchored scale, unbounded length, or missing failure-mode penalties |
| `rubric-evidence-unreachable` | a criterion whose evidence pointer resolves nowhere |
| `rubric-scores-reasoning-prose` | a criterion whose text scores reasoning prose |

**Operator arity is the one deliberate exception**, and the epic chose it, not this story: Epic 1's AC says arity is enforced in Zod as fixed-length tuples, and AD-13 verified the injection specifically for arity. Record the consequence for Story 4.2: `malformed-operator-expression`'s arity limb is schema-covered in v0; its live limbs are the rejected regex constructs and the operand-type violations the schema deliberately does not narrow.

The same reasoning binds one AD-28 **runtime fault**: `schema-version-mismatch` needs a non-equal `schemaVersion` to be parseable, which is why AC 2 uses `z.int().min(1)` rather than `z.literal(1)`.

**The second clause has one named exception, and it is a gap rather than an oversight.** "Where no code exists, the schema enforces" collides with AC 10's "prefer pushing cross-field rules to the compiler": a cross-field rule with no AD-5 code would then be enforced nowhere. That is the accepted outcome for v0, and the instances are named rather than silently dropped — chiefly **a behaviour naming an oracle identifier no oracle declares**, and a rubric criterion or waiver referencing something absent. Record each as unenforced in v0, the same treatment arity gets, so a later epic adds a code deliberately instead of discovering the hole.

### AC 9 — Every relevance axis has all three declaration states

Story 5.3 needs one contract per discipline rule per relevance-and-satisfaction combination, and AD-31 grades under-declaration as a gap while treating an explicit empty declaration as an answer. So each axis needs **absent (`null`), explicit-empty, and populated** to be distinguishable.

| Rule | Relevance reads | What the schema must allow |
| --- | --- | --- |
| 1 | success indicator declared **and** ≥1 other pointer carries a channel role | `successIndicator` nullable; `channelRoles` nullable **and** empty-capable |
| 2 | the response descriptor declares more than one pointer | a descriptor with exactly one pointer — **no minimum of two** on `requiredKeys` / `permittedKeys` / `types` |
| 3 | some operation declares a request shape with ≥1 typed key | an operation with zero typed keys across all four channels — also AD-10's "declares no inputs in any channel is exempt" case |
| 4 | the descriptor declares ≥1 collection location | `collectionLocations` nullable and empty-capable |
| 5 | a sibling group over operations or parameters is non-empty | `siblingGroups` nullable; `[]` as the explicit empty answer; `.min(2)` members per group |
| 6 | a declared collection location names a reference set | `referenceSet` nullable on the location; `referenceSets` nullable and empty-capable |
| 7 | some operation declares `stateChangeMarker: true` | a plain boolean, both values legal |

A representative "everything absent", "everything explicitly empty", and "everything populated" contract all parse, and all three ship as accept fixtures.

### AC 10 — A constraint ledger records what the export cannot carry

Every `.refine()` / `.check()` this story adds is entered in a named, machine-readable ledger under `src/core/schemas/` — one entry per constraint, carrying the constraint identifier, where it applies, and its disposition for Story 1.5: either the JSON Schema keyword and value to inject, or an explicit `not-expressible` marker with the reason. Story 1.5 **consumes** this ledger and never re-authors a second list.

- **Operator arity**: one entry per tuple, injecting `minItems` **and** `items: false`. Verified: `z.tuple([a, b])` exports `prefixItems` alone with no `minItems`, no `maxItems`, and no `items`, so the published schema accepts one-operand and three-operand `equality` that Zod rejects.
- **AD-36's numeric domain**: `z.int()` carries the safe-integer bound natively; `z.number()` rejects NaN and Infinity at parse time but exports as a bare `type: "number"`; numbers inside `JsonValue` are unconstrained by construction. Recommendation: do not re-walk `JsonValue` in Zod (Story 1.2's scanner already rejects `1e999` and unsafe integers before any parse, and JSON Schema cannot express finiteness). **AD-36 requires the restriction be *expressed* in the published schema, and a ledger entry is not an expression** — so put the domain statement in `JsonValue`'s own description. Verified placement: on a `z.json()`-based container the text lands at each *use site* as a sibling of `$ref`, duplicated per literal position and absent from the shared definition; on the hand-rolled `z.lazy(…).meta({ id, description })` it lands once on `$defs.JsonValue`, which is where AD-36 wants it. Record the consequence for Story 1.5: its differential check must not generate non-finite or unsafe-integer literals inside `JsonValue` and call the result a disagreement.
- **`parentDigest: null ⟺ revisionCount: 0`**: state it in the field description; ledger it as `not-expressible` rather than refining it.
- Prefer pushing cross-field rules to the compiler over encoding them as Zod refinements. A refinement is invisible to a non-TypeScript consumer and becomes a Story 1.5 differential disagreement unless it can be injected. Specifically do **not** refine "every descriptor key has a channel role" — no AD-5 code names it, the AD-31 predicates degrade gracefully on partial roles, and it buys nothing an export can carry.

Expect roughly four entry classes. A ledger much larger than that is a signal the schema over-refined.

### AC 11 — Fixtures, tests, and the gate

- The Gate C export-API contract (`reviews/gate-c/eval-contract.json`, re-spelled to the settled schema) is the primary **accept** fixture — the only contract ever hand-authored against revision 9, and the only evidence the grammar expresses what the discipline rules require. Every re-spelling is recorded; each one is a place the schema and the only hand-authored contract disagreed.
- The five `check` expressions of `spike-worked-example/eval-contract.json` are re-checked (ADR-006 names them as the grammar's only expressiveness evidence). Expect failures and record them rather than repairing the artifact: O-001 roots `call-inputs` directly on a key name, which AD-26 names as revision 3's defect, and the `shape` oracles fail once the descriptor is a typed named field. **The worked example is deliberately stale and is not hand-edited into conformance.**
- The AC 9 "everything absent", "everything explicitly empty", and "everything populated" contracts are accept fixtures.
- Reject fixtures are per constraint: each a valid accept fixture mutated to violate exactly one constraint, asserting the Zod issue's `path` and `code` — never a bare `.success === false`. Verified issue shapes: an operand-union failure gives `code: 'invalid_union'` at the union's own path with per-branch errors nested under `issues[0].errors`; a discriminated-union failure gives `code: 'invalid_union'` at `path: ['op']`; tuple arity gives `too_small` under-length and `too_big` over-length on the array path.
- Fixture arrays are enumerated programmatically so a committed fixture no test exercises cannot go silently dead (the Story 1.2 precedent).
- Fixtures are importable JSON or TypeScript data under `tests/`, in-memory only, no filesystem reads at test runtime (AD-30). `biome.json`'s existing exclusion is `!tests/fixtures/*.json` and is non-recursive; fixtures in a subdirectory need `!tests/fixtures/**/*.json`.
- `npm run validate` and `npm run build` green on Node 24; the PR goes green on all eight existing checks. No workflow, pin, or `.npmrc` change is expected — if one seems necessary, stop and re-check the approach.

## Tasks / Subtasks

- [x] Task 1: Module layout and shared primitives (AC: 1, 3, 7)
  - [x] Create `src/core/schemas/` modules, one shape per `kebab-case.ts` file. Suggested split, settle and record: `primitives.ts` (identifier charset and the eight prefix patterns, digest form, RFC 3339 UTC, `JsonValue`, JSON type names, the `decimal-string` money format), `pointer.ts` (the three spellings), `expression.ts`, `interface.ts`, `plan.ts`, `oracle.ts`, `rubric.ts`, `waiver.ts`, `eval-contract.ts`, `constraint-ledger.ts`
  - [x] Settle `JsonValue`'s spelling. Recommendation: hand-rolled `z.lazy(() => z.union([...])).meta({ id: 'JsonValue', description: <AD-36 domain> })`, because `z.json().meta({ id })` emits `$defs.JsonValue = { "$ref": "#/$defs/__schema0" }` **plus** `__schema0` (so the drift check pins a generated name) and its description duplicates at every use site instead of landing on the shared definition
  - [x] `z.strictObject` for every control object; caller-keyed maps per AC 7
  - [x] Reuse, do not re-spell, Story 1.2's digest form. `DIGEST_FORM` is currently a **private, unexported** const in `src/core/canonical/digest.ts`; moving it to `primitives.ts` and importing it there is a real edit to a merged Story 1.2 file. `core/` may import `core/schemas`, never the reverse. Verify Story 1.2's tests stay green
  - [x] `.ts` extensions on relative imports; do not touch `src/index.ts`; tests import from `src/core/schemas/` directly

- [x] Task 2: The declaration surface (AC: 2, 7, 9)
  - [x] Build every table in AC 2, field by field. **The Nullable and Empty columns are the specification, not annotation** — a field that lands non-nullable where the table says nullable deletes an AD-5 fixture or an AD-31 declaration state
  - [x] `scopedResources`: AD-19's list omits it, AD-16 puts it on the sealed brief, AD-5 fires `scoped-reference-resolves-forbidden` on one, and Story 2.2 must exclude what it cannot name. Neither hand-authored contract carries it. Record the deviation from AD-19's list
  - [x] Oracle `commentary` and reference-set `commentary`: AD-3 requires author commentary that no predicate reads and that never reaches the brief. Each description forbids predicate reads
  - [x] Do **not** carry `strictMode`. AD-4 and the Configuration convention make strict mode an explicit argument or policy artifact, never a declaration; the Gate C fixture carries it as an artifact of hand-authoring. Record the removal
  - [x] Settle `sourceSpecDigest` (recommended: keep, nullable, digest-typed) and record

- [x] Task 3: Pointer grammar (AC: 3)
  - [x] Three native patterns, each assigned to its consumers per AC 3, with reject fixtures in both wrong directions — a descriptor-relative pointer where an interaction-rooted one belongs, and the reverse; and `@/` in `evidenceTargets`
  - [x] Fix the shared identifier charset first; spelling 1 is undecidable without it

- [x] Task 4: Operand union and expression tree (AC: 4, 8, 10)
  - [x] Operand union: three single-keyed strict objects. Every tuple position takes the full union; per-position legality is Epic 4's. Record any position deliberately narrowed and the code that narrowing costs
  - [x] Recursive discriminated union on `op` via a getter or `z.lazy`
  - [x] Fill in and record AC 4's table, including the `all` / `any` minimum
  - [x] Structurally **admit** a quantifier inside a quantifier and `covers-by-key` inside one. A quantifier-free predicate type would be elegant and would delete `quantifier-nesting-exceeded` from Epic 4 along with its fixture. Record that the shape is deliberately admitted
  - [x] The reference-set operand's identifier is a plain identifier string — **not** a `z.enum` of declared sets, **not** refined against `referenceSets`

- [x] Task 5: Plan grammar (AC: 5, 8)
  - [x] Step shape per AC 5, with nullable `after` and `inputBinding` as a four-key strict object with nullable channels — a `z.record` over the channel enum fails five of the Gate C fixture's six steps (AC 5 carries the verification)
  - [x] Do **not** enforce the one-level temporal bound in Zod. `nested-temporal-clause` is Epic 4's code, and epics.md's Story 1.3 AC of record does mention the bound — a **named deviation from the AC of record** (Decision 5), recorded rather than silent
  - [x] Do not bound plan length, depth, width, shared anchors, or disjoint pairs; Story 4.3 owns the graph predicate
  - [x] Do not refine binding keys against `requestShape`; `undeclared-mandatory-input` fires there

- [x] Task 6: Oracles, direction, rubrics, waivers (AC: 2, 6, 8)
  - [x] Direction's `relation` types to the **sixteen-member** vocabulary
  - [x] Do **not** carry a `rule` field naming the AD-20 discipline rule on an oracle. The Gate C fixture carries one for readability; AD-31 computes relevance from declarations only and **never** infers it from the oracles, so an author-attested rule label is a standing invitation for Epic 5 to read it and turn fourteen decision procedures into self-assessment. If kept for documentation, its description must forbid predicate reads. Record
  - [x] Rubric: define `RubricBody` here for embedding; Story 1.4's published `Rubric` is body plus `schemaVersion`, lineage, and prior-art description. Do not implement AD-22's compile checks — Story 6.3 owns them
  - [x] Waiver per AC 2, all parts but the identifier nullable

- [x] Task 7: The two walks (AC: 8, 9)
  - [x] Walk all twenty AD-5 codes plus `schema-version-mismatch`; record one line each in the Dev Agent Record. Record separately the cross-field rules with no code that end up enforced nowhere (AC 8's named exception)
  - [x] Walk the seven relevance axes; prove absent, explicitly empty, and populated are each representable; record
  - [x] Settle the three coin flips per AC 6, with reasoning, in field descriptions and the Dev Agent Record

- [x] Task 8: The constraint ledger (AC: 10)
  - [x] Typed data, not prose, under `src/core/schemas/`. Story 1.5 consumes it and authors no second list

- [x] Task 9: Fixtures, tests, gate (AC: 11)
  - [x] Re-spell and land the Gate C contract; record every re-spelling
  - [x] Re-check the worked example's five expressions; record which fail and why; do not repair the artifact
  - [x] The three AC 9 contracts
  - [x] Per-constraint reject fixtures asserting `path` and `code`
  - [x] Programmatic enumeration; recursive Biome exclusion if fixtures move into a subdirectory
  - [x] `npm run validate` and `npm run build` green; PR to `main`; all eight checks pass

## Dev Notes

### Scope boundary

No JSON Schema generator, no `schemas/` directory, no drift/differential/mutation checks (Story 1.5). No other interchange artifact (Story 1.4). No compiler, no AD-5 registry as code, no pointer resolution, no reachability (Epic 4). No operator evaluation (Epic 3). No discipline predicates (Epic 5). No rubric compile checks (Story 6.3). No `src/index.ts` export (Epic 6). The deliverable is a Zod schema, a constraint ledger, and fixtures.

Epic 1 is first because it is "the only epic that settles field shapes by construction"; this story does the settling, and Story 5.3's per-rule corpus is unbuildable if a declaration state is not expressible (AC 9).

### The three coin flips — recommendations and reasoning

**(a) Polarity once or twice. Recommendation: twice.** AD-3 names polarity as one of the direction's five fields and one of the three axes the alignment predicate binds; AD-33 says "every `check` declares one polarity". Two ADs put a polarity on two different objects. Declaring it once makes AD-3's alignment predicate vacuous on a third of its content, and polarity is the axis where the two channels most dangerously drift — telling the sealed evaluator "confirm this holds" while the machine channel asserts `expects-violation`. Duplication is what makes drift detectable. Spell the check's polarity at oracle level, never inside the expression node. Both required and explicit: AD-4 calls `expects-hold` the default, but `.default()` diverges input and output mode (verified) and the explicit-`null` convention forbids implicit absence. **Consequence, and it is not optional: do not refine `direction.polarity === oracle.polarity`, nor target or relation containment** — the disagreement must stay representable or `direction-check-misaligned` loses the limbs the duplication was for.

**(b) `set-membership`'s literal-array set operand. Recommendation: admit it.** AD-26 states where the *reference-set* operand is legal; it states no prohibition on a literal. The Gate C contract could not otherwise be written — its state oracle needs the four-value enum `["queued","running","succeeded","failed"]`, which is not a collection location and has no business being a declared reference set. Constrain what is natively constrainable: the literal set operand is a JSON array with `.min(1)` (exports as `minItems`), because `set-membership` against an empty set is unfalsifiable authoring rather than an observation about the world. This is the **one deliberately narrowed operand position** in the whole grammar, and AC 4 names it as such with its cost — do not read it as licence to narrow others.

**(c) Linkage location. Recommendation: per behaviour.** The epic brief says the code as written decides this one, and it does: `missing-requirement-linkage` fires when "**a behaviour** declares no requirement or risk identifier". A contract-level array cannot make that predicate decidable per behaviour. The Conventions fix the shape — "external requirement and risk linkage is an opaque caller-supplied string paired with its scheme" — so the entries are `{ scheme, id }` objects, named `requirementLinks` / `riskLinks` rather than `…Ids`, since they are not bare identifiers. The Gate C fixture's contract-level `linkage` array does not survive. Both arrays are required keys admitting empty: the code fires when both are empty, and a schema demanding non-empty makes it fire never.

### Verified facts about Zod 4.4.3 on this pin — do not rediscover these

Run against the repository's installed `zod@4.4.3`, independently re-verified across two review rounds:

- `.refine()` and `.check()` are **silently dropped** from `z.toJSONSchema` output. `.describe()` and `.meta({ description })` **survive**.
- `z.tuple([a, b])` exports `prefixItems` **alone** — no `minItems`, no `maxItems`, no `items`. The published schema accepts one-operand and three-operand `equality` that Zod rejects.
- `z.array(x).min(1)` exports `minItems: 1`. `z.int()` exports `type: "integer"` with `minimum: -9007199254740991` / `maximum: 9007199254740991`. `z.int().min(1)` keeps `type: "integer"` and sets `minimum: 1`.
- `z.literal(1)` exports `{"type":"number","const":1}` — **not** `integer`.
- `z.number()` rejects `NaN` and `Infinity` at parse time but exports as a bare `type: "number"`; JSON Schema cannot express finiteness.
- `z.strictObject` emits `additionalProperties: false` identically in `io: 'input'` and `io: 'output'`. `.default()` does **not**: input mode drops the key from `required`, output mode keeps it.
- `z.record(k, v)` exports `propertyNames` plus a **schema-valued** `additionalProperties` — never `false`.
- `z.record(z.enum([...]), v)` **requires every enum member at parse time**: `.safeParse({ body: … })` over a four-member key enum fails with three `invalid_type` issues, one per missing channel. `z.partialRecord` accepts the partial but reintroduces the omitted-key spelling the Conventions ban. A four-key `z.strictObject` with nullable values requires all four keys present and is the convention-conformant spelling.
- `z.json().meta({ id: 'JsonValue' })` emits `$defs.JsonValue = { "$ref": "#/$defs/__schema0" }` **plus** `__schema0`, and a `.describe()` on it lands at every use site as a sibling of `$ref` rather than on the definition. A hand-rolled `z.lazy(() => z.union([...])).meta({ id, description })` emits one clean self-referential `$defs.JsonValue` carrying the description. Zod emits no `$id` at any level.
- `z.iso.datetime()` accepts `2026-08-13T00:00:00Z` and rejects `+02:00`; `{ offset: true }` accepts both.
- `z.discriminatedUnion` composes with `z.lazy` and rejects both arity ends.
- Issue shapes: operand union → `code: 'invalid_union'` at the union's path, per-branch errors under `issues[0].errors`; discriminated union → `invalid_union` at `path: ['op']`; tuple → `too_small` / `too_big` on the array path.

### Fields the Gate C fixture carries that should not survive

The Gate C contract is the best evidence available and it is a hand-authored artifact, not a schema:

- `strictMode: true` — a flag or policy artifact, never a declaration. Drop.
- `rule: "per-record"` on oracles — AD-31 never infers relevance from oracles. Drop, or keep as documentation whose description forbids predicate reads.
- contract-level `linkage` alongside per-behaviour identifiers — one fact in two places. Fold into the behaviour.
- `note` inside a reference-set declaration — rename to `commentary` so Epic 2 has something explicit to exclude.
- `budgets.maxCostUsd: 1.5` — money as a JSON number. AD-36 names money as the case that travels as a string with a declared format.

One spelling worth keeping deliberately: `collectionLocations` nested inside the response descriptor. The per-operation descriptor is what makes collection typing, channel roles, and volatile-pointer exclusion resolve through the operation an interaction step names.

### Previous story intelligence (Story 1.2)

- `src/core/schemas/faults.ts` exists, carrying `RuntimeFault` with codes `non-canonicalizable-value` and `schema-parse-failure`. Do **not** add AD-5 compile-time codes to it — the registries are disjoint, and AD-5's registry as code is Story 4.2. `schema-version-mismatch` is an AD-28 fault whose thrower arrives with a reader, not with this schema.
- `src/core/canonical/` exports `digestArtifact`, `digestJson`, `digestBytes`, `digestComposite`, `digestDirectory`, `canonicalize`, `assertHashedArtifactValue`, `assertDomainNumber`, `assertDomainString`, `MAX_NESTING_DEPTH`. The AD-36 numeric domain is already enforced there for anything digested.
- Conventions verified in merged code: tabs, single quotes, semicolons as-needed, `.ts` extensions on relative imports, ESM only.
- Story 1.1's transferable lesson, restated by 1.2: **a gate that cannot be shown to fail is a gate that fails open.** A reject fixture asserting only "did not parse" proves nothing about the constraint it is named for.
- The Gate C contract is valuable precisely because it predates the schema; an accept fixture written by reading the schema proves only that the schema agrees with itself.
- PR discipline: squash-merge to `main`, conventional commit titles, all eight checks green; `pr-checks.yml` runs on `pull_request` only.
- Working-tree convention here: leave the change uncommitted for review rather than committing unprompted.

### Git intelligence

`2bc3bb3` (Story 1.2) is the shape to follow: pure modules under `src/core/`, tests mirrored under `tests/<area>/`, fixture data under `tests/fixtures/`, a targeted `biome.json` exclusion where the formatter fights fixture data, no workflow or pin changes. `275b84c` and both prior story files show the house response to review findings: patch, record in the story file, keep the audit trail including dismissals.

Working branch: `feat/epic1-story3`.

### Project structure notes

- `src/core/schemas/` exists and holds only `faults.ts`. The Structural Seed names it "Zod definitions; the single source of truth for every artifact".
- Do not create `core/compile/`, `core/seal/`, `ports/`, or `adapters/`.
- `schemas/` (generated output) and `corpus/dev/` are not this story's.
- `tests/` holds `index.test.ts`, `canonical/`, and `fixtures/`. Add `tests/schemas/`.

### Testing requirements

- Vitest 4, in-memory fixtures only, no filesystem or network I/O (AD-30).
- Every reject fixture asserts the issue `path` and `code`, never bare failure. Every accept fixture asserts success and, where a shape is discriminated, that it parsed into the intended branch.
- Both directions matter for the tagged binding: `{"title": "type-violating"}` must fail, and `{"title": {"matcher": "type-violating"}}` and `{"title": {"literal": "type-violating"}}` must both succeed and stay distinguishable.
- Arity fixtures cover both ends per operator — these are what Story 1.5's injection is later proven against.
- NFR7's 90 percent `core/` coverage floor formally binds at Epic 6; a schema module with fixtures on every branch has no honest reason to land below it now.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.3] — acceptance criteria of record; FR2, FR3, FR5, FR9, FR10, FR11, FR15, FR17
- [Source: architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md#AD-19] — the declaration list, method / path template / state-change marker / success criterion, the three value spaces, the per-operation response descriptor, the four transport channels
- [Source: …#AD-4] — closed vocabulary, fixed arity, quantifier nesting bound, `covers-by-key` as a bijection, `shape` as a closed descriptor, strict mode as a flag
- [Source: …#AD-26] — pointer root and closed channel vocabulary, `@/`, the single-keyed reference-set operand and its three legal positions
- [Source: …#AD-39] — step as selector, tagged bindings, one-level temporal clause, the 64-pair and 8-chain rejects
- [Source: …#AD-3] — the five direction fields, alignment on targets/relation/polarity, containment after quantifier substitution, author commentary
- [Source: …#AD-16] — scoped resource references, the seven forbidden inputs
- [Source: …#AD-5] — the twenty-code registry
- [Source: …#AD-11] / [#AD-28] — `schemaVersion` as an integer under that exact name; `schema-version-mismatch` as a runtime fault
- [Source: …#AD-13] — Zod as source of truth, the constraint-injection table, the arity verification
- [Source: …#AD-31] — relevance from declarations only; the three declaration states and the unenumerated "unspecific" set (Decision 9)
- [Source: …#AD-36] — finite binary64, safe-integer bound, money and large integers as strings, the restriction expressed in the published schema
- [Source: …#AD-10] — typed sensitivity witnesses (Decision 3)
- [Source: …#AD-22] / [#AD-29] / [#AD-24] — rubric fields and identifiers; lineage; prior-art correspondence (`eval-contract`)
- [Source: …#Consistency-Conventions] — strict control objects, the value container, enum casing, RFC 3339 UTC, explicit `null`, the eight identifier prefixes, digest form
- [Source: …#Structural-Seed] — directory tree, dependency direction, the twelve-artifact inventory
- [Source: …/reviews/gate-c/FINDINGS.md] — nine authoring points, three coin flips, the fourteen predicates
- [Source: …/reviews/gate-c/eval-contract.json] — the primary accept fixture
- [Source: …/spike-worked-example/eval-contract.json] — the five original `check` expressions, deliberately stale
- [Source: …/EPIC-BRIEF.md#Epic-1] / [Source: …/ADR-006-interaction-plan.md]
- [Source: _bmad-output/implementation-artifacts/1-2-canonical-digest-computation-and-the-hashed-artifact-value-domain.md]

## Decisions taken during story creation

Each is settled with a stated default. Proceed unless the epic or the user amends it; record the outcome in the Dev Agent Record.

1. **Waivers land in this story.** AD-5, FR1, and Story 4.2 require the shape and neither Story 1.3's nor Story 1.4's AC names it. `Waiver` is absent from the Structural Seed's twelve-artifact inventory, so it is not an interchange artifact and not 1.4's; it is a contract-carried declaration.
2. **`scopedResources` lands in this story.** AD-19's list omits it; AD-16 and `scoped-reference-resolves-forbidden` require it; no later story is scoped to add an Eval Contract field.
3. **`sensitivityWitnesses` are deferred wholesale, not half-landed.** AD-10 makes them mandatory per declared operation and gives their shape (a pair of inputs plus the AD-4 relation their responses must satisfy over the volatile-excluded projection); AD-19's list omits them and Epic 6 owns AD-10. A nullable field with no declared value space would be a declaration named without a shape — the F2 defect Gate C found four times. AD-11 makes adding an optional field an **additive** `schemaVersion` bump recorded in the field's own description, so deferring costs a version bump and not a break. Record the deferral and the expected bump.
4. **`schemaVersion` and lineage land on the Eval Contract here**, as `z.int().min(1)` rather than a literal — see AC 2 and AC 8.
5. **The one-level temporal bound is not enforced in Zod.** epics.md's Story 1.3 AC of record mentions it; `nested-temporal-clause` is an AD-5 code owned by Epic 4. A **named deviation from the AC of record**, recorded rather than silent.
6. **The Rubric is defined once, split.** `RubricBody` here for embedding; Story 1.4's published `Rubric` is body plus artifact identity.
7. **`ordering` and `count-tolerance` arities are settled here** (AC 4) since AD-4 leaves them unstated and the Gate C contract exercises neither. Record that the pairwise reading of `ordering` — pointer a precedes pointer b — was considered and rejected in favour of collection-plus-key-plus-order, because Epic 3 inherits the semantics and the pairwise reading is the one a second implementer would otherwise pick.
8. **Field-name spelling is US (`behaviors`)**, matching the prior art and both hand-authored contracts.
9. **The "unspecific" indeterminate state is not invented here, and is raised instead.** AD-31 says "where a declaration is absent, **or is present but resolves to an enumerated indeterminate descriptor state**, the rule is relevant and its absence is a coverage gap; 'unspecific' is that enumerated set and nothing broader" — and then enumerates nothing, in any AD. This is the F2 signature Gate C found four times: a declaration a published predicate reads, named without a shape, and Epic 5 reads it fourteen times. **The house remedy for this exact defect is that the spine supplies the value space** — channel roles, expected cardinality, and the reference-set declaration all got theirs in revision 8, none invented by an author. Follow it.

   **Settled here, and the spine is not amended.** The explicit `null` on a descriptor `types` value **is** the indeterminate state: it spells "this pointer is declared and its type is not", which is exactly what AD-31's branch needs and what `quantifier-over-non-collection` already reads. No enumerated set is invented, no new vocabulary is minted, and nothing else in the descriptor carries an indeterminate member — `channelRoles` models absence by a missing key per AC 2's carve-out.

   **Consequence to record, the way arity records its consequence for Story 4.2:** Story 5.3's "relevant because indeterminate" contract is written against a `null` `types` value. If a later revision widens the state to `channelRoles` as well, that is an additive change to the corpus, not a rewrite.

10. **AD-16's declared probe-step bound has no home either, and it is a two-part escalation.** AD-16 says the brief-side scripting audit "carries its own AD-5 code and a declared bound on enumerated probe steps"; EPIC-BRIEF's Epic 2 done-when repeats it; the Configuration convention's policy-artifact list omits it; and **AD-5's twenty-code table contains no brief-side scripting code**, which by AD-5's own audit rule ("an AD that commands a compile-time check without adding a code here is a defect in that AD") makes the second half a defect in AD-16. Epic 2 is next and cannot read a bound nothing declares. **Settled here, and the spine is not amended:** `probeStepBound` lands on the contract beside `budgets` and `safetyLimits`, a nullable non-negative integer — the shape is obvious, so declaring it invents no vocabulary. The missing brief-side AD-5 code is **Epic 2's to mint** when Story 2.3 implements the audit that fires it, recorded against that story rather than routed back into the spine; AD-5's registry is defined as extensible by amendment to AD-5 alone, so adding the code where its only thrower lives costs nothing here.

## Dev Agent Record

### Agent Model Used

claude-opus-5[1m] (Claude Opus 5, 1M context), via the `bmad-dev-story` skill.

### Debug Log References

- `npm run validate` (typecheck, Biome, docs check, spine lint, canonicalization vectors, Vitest): green on Node 24.19.0 / npm 11.17.0.
- `npm run build`: green.
- Test totals: 17 files, 527 tests, all passing. This story adds 11 modules under `src/core/schemas/` and, under `tests/schemas/`, 10 test files carrying 326 tests.
- Zod 4.4.3 facts were re-executed against the installed pin from a scratch `.mjs` inside the repository before any module was written; every claim in the story's "Verified facts" list reproduced, including `z.record` over an enum key failing with one `invalid_type` issue per missing member. The scratch file was deleted afterwards.
- Pre-existing defect fixed along the way: `README.md` failed `npm run check:docs` on the branch before this story's first edit (repeated blank lines and a missing final newline). Fixed with the repository's own `npm run check:docs -- --fix`; it is unrelated to this story but the chain cannot be green without it.

### Completion Notes List

**Module layout (Task 1).** The story's suggested split was adopted with one addition: `reference-set.ts`. The reference-set declaration is a contract-level shape reached through `referenceSets` rather than through an interface, so folding it into `interface.ts` or `eval-contract.ts` would have put two unrelated shapes in one file. `interface.ts` holds the operation-inventory cluster (interface, operation, request shape, response descriptor, collection location, expected cardinality) because every one of those is reached only through an interface and the Conventions' "one artifact per file" rule addresses artifacts rather than every nested shape.

`KeyedShapeDescriptor` is defined once in `primitives.ts` and shared by the request-shape channels and the `shape` operator's descriptor. AD-4 and AD-19 spell the same triple — required keys, permitted keys, per-key JSON type — and two spellings of one triple is the drift the Conventions exist to prevent. The `null` type value reads identically in both: the key is declared and its type is not.

`DIGEST_FORM` moved from `src/core/canonical/digest.ts` (where Story 1.2 held it private) to `primitives.ts`, and `digest.ts` now imports it. Dependency direction holds: `core/canonical` imports `core/schemas`, never the reverse. Story 1.2's tests stay green.

`JsonValue` is the hand-rolled `z.lazy(...).meta({ id, description })` the story recommended. Verified: it emits one clean self-referential `$defs.JsonValue` carrying the AD-36 domain statement exactly once, where `z.json().meta({ id })` would have emitted a generated `__schema0` and duplicated the description at every use site. A test asserts the "once, on the definition" property so a later refactor cannot silently regress it.

**The three coin flips (AC 6), settled and stated in field descriptions.**

(a) *Polarity twice.* Declared on the direction and on the oracle. AD-3 names polarity as one of the three axes the alignment predicate binds and AD-33 gives every check one; declaring it once makes AD-3's alignment predicate vacuous on a third of its content, and polarity is the axis where the two channels most dangerously drift. Duplication is what makes drift detectable. Consequence taken deliberately and not optional: no refinement asserts `direction.polarity === oracle.polarity`, nor target or relation containment, because `direction-check-misaligned` needs the disagreement representable. A test in the AD-5 walk asserts a fully misaligned oracle parses.

(b) *`set-membership` admits a literal-array set operand,* constrained to `.min(1)`. AD-26 states where the reference-set operand is legal and states no prohibition on a literal, and the Gate C contract's state oracle needs the four-value enum `["queued","running","succeeded","failed"]`, which is not a collection location and has no business being a declared reference set. This is the one deliberately narrowed operand position in the grammar. Cost, named and tested: `{ "literal": [] }` and a `{ "pointer" }` in the set position are schema rejections rather than `malformed-operator-expression`.

(c) *Linkage per behaviour,* as `requirementLinks` and `riskLinks`, each an array of `{ scheme, id }`. The code decides it: `missing-requirement-linkage` fires when "a behaviour declares no requirement or risk identifier", which a contract-level array cannot make decidable per behaviour. The Gate C fixture's contract-level `linkage` array does not survive. Both arrays are required keys admitting empty, because a schema demanding non-empty makes the code fire never.

All three land in `.describe()` text, and a test asserts each phrase survives `z.toJSONSchema`, so a non-TypeScript consumer reads the decision off the published schema.

**The AD-5 walk (Task 7, AC 8).** All twenty codes plus AD-28's `schema-version-mismatch` are walked as executable admission tests in `tests/schemas/ad5-admissions.test.ts`, one test per code (several codes carry more than one shape). Every coded shape parses: both link arrays empty; a null success criterion and, separately, an empty oracle list; a null direction and a null check; a fully misaligned direction; a pointer naming an undeclared step and an empty interaction plan; a reference-set operand outside AD-26's three legal positions and regexes carrying a backreference and a lookbehind; a quantifier over a scalar-typed pointer; a quantifier inside a quantifier and `covers-by-key` inside one; an undeclared reference-set identifier; two operations colliding on method and path template; a step binding a key the request shape does not declare; a temporal clause naming a step that carries one; the sixty-four `write-N`/`read-N` pairs and the eight-step single-root chain; `web`, `cli`, and `mcp` interfaces; a waiver with any of its four required parts null (and the reminder that `condition: null` is complete); a forbidden-input list short of the seven and an empty one; a scoped resource reference; an unanchored scale, a null scale, a null length bound and null penalties; an unreachable rubric-evidence pointer; a criterion scoring reasoning prose; and a `schemaVersion` of 2.

*Operator arity is the one deliberate exception,* chosen by the epic rather than by this story: AD-13 verified the constraint injection specifically for arity, and Epic 1's acceptance criteria of record require fixed-length tuples. Consequence for Story 4.2, recorded: `malformed-operator-expression`'s arity limb is schema-covered in v0, so its live limbs are the rejected regex constructs and the operand-type violations the schema deliberately does not narrow.

**Cross-field rules with no AD-5 code, unenforced in v0 (AC 8's named exception).** Each is named rather than silently dropped, and each has an admission test, so a later epic adds a code deliberately instead of discovering the hole: a behaviour naming an oracle identifier no oracle declares; a collection location naming a reference set the contract does not declare; a plan step naming an operation the inventory does not declare; a reference-set member missing a declared comparison key; a descriptor key carrying no channel role (deliberately not refined, per AC 10 — the AD-31 predicates degrade gracefully on partial roles); and a lineage root whose `revisionCount` disagrees with its `parentDigest`, which is stated in the field description and ledgered as not expressible.

**The relevance walk (Task 7, AC 9).** All seven axes have absent, explicitly empty, and populated states, proven in `tests/schemas/relevance-axes.test.ts` and carried by three whole-contract accept fixtures. Rule 1 reads a nullable `successIndicator` beside a nullable, empty-capable `channelRoles`; rule 2 has no minimum of two on `requiredKeys`, `permittedKeys`, or `types`; rule 3 has an operation with zero typed keys across all four channels, which is also AD-10's exemption case; rule 4 and rule 6 have nullable, empty-capable `collectionLocations` and `referenceSets` plus a nullable `referenceSet` on the location; rule 5 has nullable `siblingGroups`, `[]` as the explicit empty answer, and `.min(2)` per group; rule 7 has a plain boolean with both values legal.

*One reading recorded.* AD-19 permits "an explicit empty sibling group". The story settles this twice as the empty group *list* with `.min(2)` members per group, and that reading is implemented: a group of one has no sibling to cross-check against and so cannot make rule 5 relevant, while `[]` is what makes a genuinely sibling-free contract decidably clean.

**Decisions 1 through 10, outcomes.** 1: waivers landed, all parts but the identifier nullable. 2: `scopedResources` landed as an opaque `{ reference, kind }` pair — AD-19's list omits it, so the deviation from that list is recorded here; no AD supplies a value space for `kind`, so it stays an opaque caller-supplied string rather than an invented enum. 3: `sensitivityWitnesses` deferred wholesale; the deferral and the expected additive `schemaVersion` bump are recorded in the contract's own schema description. 4: `schemaVersion` is `z.int().min(1)`. 5: the one-level temporal bound is not enforced in Zod, a named deviation from the epic's acceptance criteria of record, stated in the `after` field's description and covered by an admission test. 6: `RubricBody` defined here for embedding; Story 1.4 adds artifact identity. 7: `ordering` is collection-plus-key-plus-order and `count-tolerance` is one operand plus three named fields; the pairwise reading of `ordering` was considered and rejected, because Epic 3 inherits the semantics and the pairwise form cannot express "this page is sorted by capturedAt", which is the only thing AD-4 says `ordering` is for. 8: US spelling (`behaviors`) throughout, including in code symbols. 9: the explicit `null` on a descriptor `types` value is the indeterminate state; no enumerated set invented; `channelRoles` models absence by a missing key. 10: `probeStepBound` landed as a nullable non-negative integer beside `budgets` and `safetyLimits`; the missing brief-side AD-5 code is Epic 2's Story 2.3 to mint alongside its only thrower, and its absence is named in the field's description.

**Settled by construction, recorded here rather than escalated.**

- `all` and `any` carry a minimum of two operands. AD-4 leaves connective arity unstated. Zero operands makes `all` certify vacuously, which is the fail-open shape AD-4's three-valued resolution exists to prevent; one operand is the identity, and two spellings of one tree defeat the structural containment AD-3's alignment predicate computes. `.min(2)` exports as `minItems` natively, so it costs the ledger nothing.
- A path template's literal segments exclude `:` so the `:name` spelling is a syntax error rather than a literal segment beginning with a colon.
- `z.int().min(0)` rather than bare `z.int()` on expected cardinality, budgets, and `probeStepBound`. No AD-5 code fires on a negative cardinality or a negative ceiling, so under the admit-rule's second clause the schema is the enforcement point; the lower bound and AD-36's safe-integer upper bound both export natively.
- Request-shape channels are non-nullable declared triples. A request channel's "declared, no keys" state already has a spelling — three empties — which is exactly the distinction AC 5 draws against an input-binding channel, where that state is indistinguishable from unused and `null` is therefore the only spelling.
- An interaction step spells its selection predicate as its two members (`inputBinding` and `after`) on the step itself rather than under a nested key, matching the only hand-authored contract.
- Reference-set members are `JsonValue` objects rather than a seventh caller-keyed control map. The Consistency Conventions place them there by name: the value container covers "expression literals, declared reference-set members, and every ingested response body". The caller-keyed count therefore stays at the six AC 7 lists.
- `FailureModePenalty` is a name plus a description and carries no magnitude. AD-22 requires "named failure-mode penalties" and states no magnitude; inventing one would mint a scoring semantic this story has no authority for, and Story 6.3 owns AD-22's compile checks.
- A waiver's `rule` is an opaque string. AD-20 enumerates its seven rules in prose and assigns them no identifiers, so an enum here would invent a vocabulary Epic 5 has to match.
- All eight identifier prefixes are defined in `primitives.ts` though this artifact uses five (`B-`, `O-`, `W-`, `R-`, `RC-`). `P-`, `D-`, and `F-` are defined so Story 1.4's Probe, Evidence Artifact, and finding shapes import the `{3,}` quantifier rather than re-spelling it; a second spelling of that quantifier is the drift the convention forbids.

**One story-context claim corrected by execution.** AC 4 says "six of its eight oracles declare `all`, `not`, or `for-all` as the relation". The Gate C contract carries **seven** of eight; only O-001, whose relation is `deep-equality`, is a bare operator. The correction strengthens the conclusion it was offered for — typing `relation` to the eleven operators alone would fail seven of eight — and the test asserts seven.

**The Gate C contract (AC 11).** Landed as `tests/schemas/fixtures/gate-c-contract.ts`, typed against `EvalContract` so a re-spelling that drifts fails the typecheck before it reaches a test. Twelve re-spellings are enumerated in that file's exported `RESPELLINGS` table with the reason for each, and a test asserts the table is non-empty and every entry carries a reason. The substantive ones: contract-level `linkage` folded into per-behaviour links; `strictMode` dropped; the oracle `rule` label dropped; reference-set `note` renamed to `commentary`; `maxCostUsd` from the JSON number `1.5` to the string `"1.5"`; partial input bindings filled to four channels with explicit nulls; and the one `shape` oracle, O-005, re-spelled from a `{ literal }` operand to a typed `descriptor` field. O-004's operator is `not`, not `shape`. On that last re-spelling, `permittedKeys` was filled with the four declared row fields plus `retractedAt` so that O-005 stays independent of O-004, whose whole purpose is detecting `retractedAt`; `types` was left `{}`, which is the descriptor's "no per-key type declared" answer. It does **not** keep the original check's meaning, and the `RESPELLINGS` entry says so: the hand-authored check was open over any additional key and this one is closed over five.

**The worked example (AC 11).** Re-checked, not repaired. Two of the five `check` expressions parse unchanged (O-002 and O-005). Three fail, each for a reason the architecture already records: O-001 roots `call-inputs` directly on a key name, which AD-26 names as revision 3's defect; O-003 and O-004 carry the `shape` descriptor as a `{ literal }` operand, which AD-4's "closed descriptor, never an embedded JSON Schema" turns into a typed named field. The artifact is deliberately stale and was not edited.

**Fixtures and tests.** All fixtures are in-memory TypeScript modules under `tests/schemas/fixtures/`, so no filesystem read happens at test runtime (AD-30) and **no `biome.json` change was needed** — the non-recursive `!tests/fixtures/*.json` exclusion is untouched because no JSON fixture was added. Fixture arrays are enumerated programmatically with `it.each`, so a committed fixture no test exercises cannot go silently dead: the forty-four reject cases, the sixteen expression forms, the twelve arity entries, the three relevance contracts, and the five worked-example checks are all driven off exported arrays whose completeness is itself asserted. Every reject fixture asserts the Zod issue's `path` and `code` and asserts the issue count is exactly one, which is what makes it a single-constraint mutation rather than a bare "did not parse".

**The constraint ledger (AC 10).** Fifteen entries in four classes, matching the story's "roughly four entry classes" expectation: twelve arity entries generated from `TUPLE_ARITY` so the ledger cannot drift from the schema, each injecting `minItems` and `items: false`; one `minProperties: 1` injection for the non-empty binding channel, which is the only `.refine()` this story adds; and two `not-expressible` entries with reasons, for AD-36's numeric domain and the `parentDigest` / `revisionCount` biconditional. The ledger's premises are themselves tested against `z.toJSONSchema` output — that a tuple exports `prefixItems` alone, that the binding-channel check is dropped, that the AD-36 statement lands once on the shared definition, and that `additionalProperties` is `false` on control objects and `{ "$ref": "#/$defs/JsonValue" }` on the value container.

**Coverage.** NFR7's 90 percent `core/` floor binds formally at Epic 6. It was not measured here because `@vitest/coverage-v8` is not installed and this story adds zero dependencies. Every branch of every new module is exercised by a named fixture, and the reject corpus asserts a specific issue on each.

**Peer review round 1, and what it changed.** A fresh-context session reviewed the whole change against the story file and re-executed the claims against the pin. It confirmed the AC 8 admit-rule holds everywhere except the two exceptions the story names, confirmed AC 2 field by field, and confirmed the ledger has no missing entry — the one candidate it chased, RFC 3339 UTC, turned out to export natively, because `z.iso.datetime()` emits `format: "date-time"` plus a pattern ending `(?:Z))$`. Eleven findings were raised and all eleven are addressed.

*Blocking.* `Expression` carried no `.meta({ id })`, so the whole check tree exported as the generated `$defs.__schema0` — the exact defect the story rejects `z.json()` for on `JsonValue`, applied to two of the three recursive shapes instead of three. Three consequences, not one: Story 1.5's drift check would have pinned a positional generated name; the ledger's twelve arity entries addressed `Expression/<op>`, which resolved nowhere; and it contradicts AC 1's "written so Story 1.5 exports it without restructuring". `Expression` now carries `.meta({ id })`, and so do `Operand` and the input-binding channel, which were the two other shapes a ledger entry or a reader needed to name. Verified: `$defs` is now exactly `Expression`, `InputBindingChannel`, `JsonValue`, `Operand`, and the export shrank from 65,710 to 43,927 bytes because `Operand` stopped being inlined at seventeen sites. A discriminated union exports as `oneOf`, so a ledger entry now names its branch by the `op` const rather than by index.

The review also caught that the old ledger test hid this: its helper walked the entire exported document hunting for a branch, so it passed without ever proving the entry's stated address resolved. The ledger entry now carries `shape`, `branch`, and `field` as a machine-resolvable address, and the test resolves every entry exactly the way Story 1.5 must — by the stated address, never by searching.

*Should-fix, all taken.* The ledger's arity injection hardcoded 2020-12 keywords with no dialect named; under draft-7 a tuple exports as `items: [...]` and injecting `items: false` there overwrites the tuple rather than bounding it, so every operand list in the published schema would reject everything, silently and totally. `ConstraintDisposition` now carries a `dialect` field so Story 1.5 asserts against it rather than reading prose. `count-tolerance`'s `expected` and `tolerance` carried an unrecorded and untested `.min(0)`; both are now recorded here, tested in both directions, and the field description states that a relative tolerance is read as whole percentage points, since AD-4 supplies no value space for the magnitude and an integer cannot express 2.5 percent — widening it later is an additive bump under AD-11 and was not taken because `z.number()` exports as a bare `type: "number"` and would cost a ledger entry for a case no declaration needs yet. The worked-example test asserted bare success, which is precisely the failure mode Story 1.1's transferable lesson names; each of the three failing checks now asserts its exact issue paths and codes, so the recorded finding cannot quietly stop being true. Same shape, smaller: the zero-operand `all`/`any` case now asserts `too_small` rather than bare failure.

*The O-005 re-spelling, corrected rather than defended.* The reviewer accepted the `permittedKeys` choice and challenged the claim around it, and the challenge is right. The hand-authored O-005 declared `requiredKeys` only and said nothing about any other key, so it was open; the re-spelled one is closed over five keys, and a row carrying a sixth field now fails a check that previously ignored it. "Keeps its original meaning" was true only relative to O-004. The entry now says what actually happened: the descriptor is closed over five keys, the original was open, and the grammar has no spelling for "these keys are required and extras are unconstrained" because AD-4 calls the descriptor closed. That is a place where the only hand-authored contract cannot be expressed exactly, and the re-spelling table exists to surface exactly that rather than smooth it over.

*Nits, all taken.* `ANCHORED_PATTERN_FORM` checks the first and last character and cannot decide full anchoring: verified on the pin that `^a|b$` parses as `(^a)|(b$)` and passes, and that `^foo\$` passes while matching any string starting with `foo$`. Deciding it needs a regex parser, which does not belong in a schema, so the residual is now stated in the comment, in the field description, and in two tests that record the escapes as admitted — joining backreferences and lookbehind as Epic 4's. The stale "six of eight" comment in `expression.ts` is corrected to seven, which matters because that comment is the justification for the sixteen-member vocabulary. `ResponseDescriptor.types` re-spelled the key-type map that `KeyedShapeDescriptor` already carried, which is the drift the shared descriptor exists to prevent; both now use one `KeyTypeMap` const and each use site adds its own description. `DescriptorPointer` admits the empty string, and the description now says what that means: RFC 6901's whole document, so a success indicator says success is visible in the response taken as a whole. `permittedKeys` not covering `requiredKeys` joins the cross-field rules unenforced in v0 and now has an admission test, making that list seven rather than six. The `duplicate-operation-signature` admission used two literally identical templates and now uses `/things/{id}` against `/things/{identifier}`, so the fixture Story 4.2 inherits exercises parameter-name erasure rather than the trivial case.

Test count moved from 527 to 549.

**Peer review round 2, independent second reader, for quorum.** A second reviewer went over the same tree with instructions not to take round 1 on trust. It reported **no blocking findings**, re-derived round 1's clearances independently and agreed with every one of them, and added six should-fix and seven nits. All thirteen are addressed. Two of its confirmations are worth keeping: it structurally diffed the Gate C fixture against the source JSON and found 75 leaf differences, **every one mapping to a recorded `RESPELLINGS` entry**, with no silent value change; and it confirmed the input-mode and output-mode exports are byte-identical at 42,524 bytes each, which proves the no-`.default()` claim harder than the story did.

*AD-4's operand types were declared nowhere a consumer could read them.* This is the finding most likely to have been settled differently by a second implementer, and it is the same argument the story already accepts for AD-36: AD-4 requires each operator to declare "a fixed arity and operand types **in the published schema**", and AC 4's legality table lived only in this story file, which Epic 4 has no reason to read. Arity was structural; the types were not expressed at all. Each branch's `operands` now carries its legal operand forms in a description that survives the export, alongside one shared sentence explaining why every position still admits the full union. A fifth ledger entry, `operator-operand-types`, records the split as `not-expressible` with the consequence for Epic 4 named: the operand-type limb of `malformed-operator-expression` is entirely its own, with no schema-side partial coverage to lean on.

*The anchoring form is wrong in both directions, and only one was recorded.* Round 1 caught the false accepts. The reviewer found the false **rejects**, which are the ones that cost something: `(?:^a$)` and `(^a$)` are rejected although both are fully anchored ECMA-262, so a legal contract becomes an anonymous `schema-parse-failure` — the exact conversion AC 8 exists to prevent. Verified both on the pin. It is accepted rather than fixed, because AC 4 assigns anchoring to the schema and requires it natively and exportably, and deciding anchoring properly needs a regex parser that neither belongs in a schema nor exports. Both directions are now stated in the module comment, in the field description, and in tests, with the exact workaround: write `^(?:a|b)$` rather than `(?:^a$|^b$)`.

*The ledger address still needed out-of-band knowledge.* `shape` was documented as a `$defs` name, but Zod emits no `$id` and puts the root schema inline, so `EvalContract` is not in `$defs` and the lineage entry resolved to nothing by the documented rule. The test passed only because the test file hardcoded the special case — round 1's finding one level up. `shape` is now a structural `location: { kind: 'root' } | { kind: 'definition', name }`, and the test's resolver has no special case left.

*The drift guard ran one way only.* Every arity test walked `TUPLE_ARITY` outward and the count test compared the ledger against `TUPLE_ARITY`, so both would have stayed green if `TUPLE_ARITY` itself drifted from the union — a seventeenth tuple-carrying operator would have shipped as an unbounded array in the published schema with nothing failing. A test now walks the export back: every branch whose `operands` carries `prefixItems` must have a ledger entry with a matching `minItems`, and the branch count must equal the vocabulary.

*A test that passed for the wrong reason.* The "shape's descriptor is typed rather than a literal" test passed two operands to a one-tuple, so arity dominated and it would have stayed green with `descriptor: z.any()` — precisely the property it is named for. It now passes one operand and asserts the four `descriptor` issues. Same class as the worked-example finding round 1 caught; this instance was missed. The fractional-tolerance test likewise asserted bare failure under one flag value and now asserts code and path under both.

*`ScaleLevel`'s value space was minted here and not recorded.* AD-22 says only "anchored scale levels". `{ level, anchor }` is invented, which Decision 9 says to record, and `FailureModePenalty` two lines below was recorded while this was not. It is now in the settled-by-construction list, and its consequence joins the unenforced-in-v0 list, which is now eight: `level` is unbounded and unordered, so a negative level and two levels sharing an ordinal both parse, and `rubric-unanchored` fires on a missing anchor rather than on a duplicate ordinal. There is an admission test.

*Nits, all seven.* The binding-channel entry's prose told Story 1.5 to inject on the object branch while its machine address pointed at the `anyOf` wrapper; since `minProperties` is ignored on a non-object instance, injecting at the definition root is correct JSON Schema and the entry now says that instead. The Completion Notes said "the two `shape` oracles" — the Gate C contract has exactly one, O-005, since O-004's operator is `not` — and still carried the "keeps its original meaning" claim the `RESPELLINGS` entry had already retracted; both are corrected. The fixture said five of six steps carried a partial binding; it is six of six, and AC 5's five was inherited. `ResponseDescriptor.types` overrode `KeyTypeMap`'s description and dropped the "never by pointer" clause, which is worth most in exactly that shape, where `requiredKeys` sits beside a pointer-keyed `channelRoles`; it is restored and sharpened. `Operand`'s description claimed it was named so a ledger entry could address it, which no entry does; the real reason, seventeen inline copies, replaces it. The learning-path document is added to the File List.

*One regression the new tests caught immediately, worth recording because it is the same trap as B1.* Attaching `.describe()` directly to `Expression` and `Operand` at a use site — which is what declaring the quantifier operand types naively looks like — wraps a schema that already carries `.meta({ id })`, and Zod responds by extracting the inner union as `$defs.__schema0` and reducing `$defs.Expression` to a `$ref` at it. The "names every shared definition" test failed on the spot. The fix is to describe the branch object rather than the id-carrying schema. Recorded so Story 1.4 and Story 1.5 do not rediscover it: **never call `.describe()` on a schema that carries `.meta({ id })`.**

Test count moved from 549 to 553.

### File List

New, `src/core/schemas/`:

- `primitives.ts`
- `pointer.ts`
- `expression.ts`
- `interface.ts`
- `plan.ts`
- `oracle.ts`
- `rubric.ts`
- `waiver.ts`
- `reference-set.ts`
- `eval-contract.ts`
- `constraint-ledger.ts`

New, `tests/schemas/`:

- `fixtures/gate-c-contract.ts`
- `fixtures/relevance-contracts.ts`
- `fixtures/reject-cases.ts`
- `fixtures/expression-nodes.ts`
- `fixtures/worked-example-checks.ts`
- `primitives.test.ts`
- `pointer.test.ts`
- `expression.test.ts`
- `plan.test.ts`
- `eval-contract.test.ts`
- `relevance-axes.test.ts`
- `ad5-admissions.test.ts`
- `reject-fixtures.test.ts`
- `constraint-ledger.test.ts`
- `worked-example.test.ts`

Modified:

- `src/core/canonical/digest.ts` — `DIGEST_FORM` moved to `src/core/schemas/primitives.ts` and imported from there
- `README.md` — pre-existing `check:docs` whitespace failure, fixed with the repository's own `--fix`
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — story status
- `_bmad-output/project-knowledge/learning-path-step-by-step.md` — Step 3 for this story, per that document's own template
- `_bmad-output/implementation-artifacts/1-3-the-eval-contract-schema-declarations-operand-grammar-and-plan-grammar.md` — this record

## Change Log

- 2026-08-14: Peer code review, round 2, independent second reader for quorum. No blocking findings; round 1's clearances re-derived independently and confirmed, including a structural diff of the Gate C fixture against the source JSON showing all 75 leaf differences map to a recorded re-spelling. Six should-fix and seven nits, all addressed. Chiefly: AD-4's per-operator operand types are now declared in the published schema rather than only in this story file, with a fifth ledger entry recording that enforcement is Epic 4's; the anchoring form's false-*reject* direction is recorded and tested alongside the false-accept one; the ledger address became a structural `location` so the document root no longer needs a special case in test code; a reverse drift guard walks the export back to the ledger; two tests that passed for the wrong reason were fixed; and `ScaleLevel`'s minted value space joined the settled-by-construction and unenforced-in-v0 lists. Also recorded: calling `.describe()` on a schema that carries `.meta({ id })` reintroduces `$defs.__schema0`, which the new definition-naming test caught during this round. 549 tests to 553.
- 2026-08-14: Peer code review, round 1, fresh context. One blocking finding, four should-fix, six nits; all eleven addressed. Blocking: `Expression` exported as the generated `$defs.__schema0` for want of a `.meta({ id })`, which pinned a positional name into Story 1.5's drift check and left the ledger's twelve arity entries unaddressable. `Expression`, `Operand`, and the input-binding channel are now named definitions; the export dropped from 65,710 to 43,927 bytes; ledger entries carry a machine-resolvable `shape` / `branch` / `field` address and a `dialect`, and the ledger test now resolves each entry by its stated address instead of searching for it. Also: `count-tolerance` magnitudes recorded and tested with a stated relative-tolerance reading; the worked-example test upgraded from bare success to exact issue paths and codes; the O-005 re-spelling entry corrected to say it closed a check that was open; the regex anchoring residual stated rather than assumed closed; one stale comment fixed; the key-type map de-duplicated; the empty descriptor pointer given a meaning; `permittedKeys` versus `requiredKeys` added to the unenforced-in-v0 list; and the `duplicate-operation-signature` fixture changed to exercise parameter-name erasure. 527 tests to 549, `npm run validate` and `npm run build` green.
- 2026-08-13: Implemented. Eleven Zod modules under `src/core/schemas/` carrying every AD-19 declaration, the three pointer spellings, the operand union, the recursive expression tree with fixed-length operator tuples, the plan grammar with tagged bindings, and a typed constraint ledger. Ten test files, 326 tests: the Gate C contract re-spelled and landed as the primary accept fixture with its twelve re-spellings recorded, three whole-contract relevance fixtures for the absent, explicitly-empty, and populated states, forty-four per-constraint reject fixtures each asserting an exact issue path and code, an executable walk of all twenty AD-5 codes plus `schema-version-mismatch`, and a re-check of the worked example's five expressions recording three failures rather than repairing the artifact. Three coin flips settled in field descriptions that survive the export. Zero new dependencies; no workflow, pin, or `.npmrc` change; `npm run validate` and `npm run build` green on Node 24. One story-context claim corrected by execution: the Gate C contract carries seven of eight non-operator relations, not six. One pre-existing `check:docs` failure in `README.md` fixed with the repository's own `--fix`.
- 2026-08-13: Story context created, then revised across two independent validation rounds (peer session, `.claude/skills/bmad-create-story/checklist.md`). Round 1, twelve criticals: `direction`/`check` nullable so `oracle-missing-channel` stays fireable; `scopedResources` and oracle `commentary` added as otherwise-unfillable holes; the descriptor-relative pointer spelling named; arity restated as operands-in-tuples / parameters-in-named-fields; `direction.relation` corrected to the sixteen-member vocabulary; relevance axes extended to seven rules; caller-keyed maps named; rubric fields brought under the admit-rule; the `.meta({ id })` rationale corrected by re-verification. Round 2, eight criticals: the AD-5 walk completed to twenty codes with `undeclared-mandatory-input` and `plan-exceeds-scripting-bound` and their "do not refine" consequences; per-position operand typing handed to Epic 4 so `malformed-operator-expression`'s operand-type limb survives; `schemaVersion` changed from `z.literal(1)` to `z.int().min(1)` after verifying the literal exports as `number` and pre-empts `schema-version-mismatch`; AD-31's third declaration state (absent versus explicitly empty) propagated through AC 2 and AC 9; the unenumerated "unspecific" set raised as Decision 9 rather than invented; Direction, Interface, Operation, Response descriptor, Reference set, and Rubric body given tables with Nullable and Empty columns; HTTP `method` named as the second enum-casing exception. Decision 3 overturned to a wholesale deferral on the AD-11 additive-bump argument. Round 3, seven findings: `inputBinding` re-spelled from a channel-keyed record to a four-key strict object after verifying a record over an enum key demands every member and would fail five of the Gate C fixture's six steps; AC 2's three-state preamble narrowed to the five collection-valued declarations it actually governs, with the response descriptor, request shape, and state-change marker named as correctly non-nullable; a carve-out stated for the explicit-`null` convention inside caller-keyed maps; `types` values made nullable so "declared, type not stated" has a spelling; `set-membership`'s `.min(1)` pre-settled as the one deliberately narrowed operand position with its cost named; the caller-keyed map count reconciled with its list; `regex` anchoring assigned to the schema; the no-code cross-field gap named as an accepted v0 exception; and Decision 10 opened for AD-16's probe-step bound, which is a missing declaration *and* a missing AD-5 code. Round 4 verification, one regression and two nits: the caller-keyed map list corrected to six after the `inputBinding` container fix obscured that each channel's parameter-name map is still caller-keyed; `null` settled as the only spelling for an unbound binding channel; AC 2's three-state clause scoped so it cannot be read as the complete nullability rule.
