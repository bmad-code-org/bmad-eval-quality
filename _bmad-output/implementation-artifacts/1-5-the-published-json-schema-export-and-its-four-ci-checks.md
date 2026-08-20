---
epic: 1
story: 5
key: 1-5-the-published-json-schema-export-and-its-four-ci-checks
baseline_commit: e83a322f2fc73fd99244c70affd85703e779e425
---

# Story 1.5: The published JSON Schema export and its four CI checks

Status: done

## Story

As a non-TypeScript consumer of the published schemas,
I want the generated JSON Schema to be provably equivalent to the Zod source, constraint by constraint,
so that a constraint existing only as a Zod refinement can never be silently invisible to me.

## Acceptance Criteria

### AC 1 — One pure builder, twelve self-contained documents, `$id` synthesised

A single pure function builds a published document from an artifact key. It lives in
`src/core/schemas/publish.ts`, imports `zod`, `artifact.ts`, and `constraint-ledger.ts`, and performs
no filesystem, network, clock, or randomness work, per AD-1. It never imports a validator: the
runtime dependency set stays Zod alone per the Structural Seed, and the validator is a development
dependency reachable only from `tests/` and `scripts/`.

For each of the twelve keys of `INTERCHANGE_ARTIFACTS`, the builder:

- calls `z.toJSONSchema(schema, { io: 'output' })`. Output mode is AD-13's instruction, because the
  published schemas describe artifacts as consumers receive them. Story 1.4 already asserts that all
  twelve export byte-identically in both modes, so this is a statement of intent rather than a change
  of bytes; the assertion stays and this story does not weaken it;
- synthesises `$id`, which Zod emits at no level. The value is `urn:eval-quality:schema:{key}`
  (Decision 3);
- applies every `inject` entry of `CONSTRAINT_LEDGER` at the address that entry states (AC 2);
- emits the document with `$schema` first and `$id` second, then Zod's own key order unchanged.

Every `$defs` key is a name a schema chose through `.meta({ id })`, never a generated positional
name. That is a clause of the acceptance criteria of record and it needs an assertion of its own: a
test walks the `$defs` of all twelve documents and fails on any key that is numbered or
underscore-prefixed. The export complies today, because Stories 1.3 and 1.4 named every shared shape
for exactly this reason, so the assertion is a lock rather than a repair. Its absence is what would
let a future shared shape ship as `__schema0` and pin a positional name into the drift check.

Each document is self-contained: only local `#/$defs/...` references, no cross-file `$ref`, and
shared shapes duplicated into each file's own `$defs`. That is what calling `z.toJSONSchema` once per
artifact already produces; do not build a shared registry export, which emits cross-file references
and breaks the self-containment AD-13 requires.

`publish.ts` sits downstream of all twelve schema modules and of the ledger. **No module under
`src/core/schemas/` may import it**, for the same reason `constraint-ledger.ts` carries that rule:
the reverse edge closes an import cycle and fails at module load with a temporal-dead-zone
`ReferenceError`.

`src/index.ts` is not touched. The library and CLI surface, including the tarball's `schemas`
subpath, is Story 6.5's (Decision 8).

### AC 2 — The constraint-injection table drives the injection, by stated address

The generator consumes `CONSTRAINT_LEDGER` and writes no second list. For every entry whose
`disposition.kind` is `inject`, it resolves the address exactly as `resolve()` in
`tests/schemas/constraint-ledger.test.ts` does, and never by searching:

1. `documents[entry.location.artifact]`;
2. the document root for `kind: 'root'`, or `document.$defs[entry.location.name]` for
   `kind: 'definition'`;
3. where `entry.branch` is non-null, the `oneOf` member whose `properties.op.const` equals it;
4. where `entry.field` is non-null, that property of the located shape;
5. `Object.assign` of `disposition.keywords` onto the located site.

The generator **fails loudly** when an address does not resolve, naming the entry id and the segment
that failed. A silently skipped injection is the exact failure AD-13's arity paragraph exists to
prevent, and a warning printed into a green build is not a gate.

Note that `tests/schemas/constraint-ledger.test.ts` builds its documents with `io: 'input'` while
this generator uses `io: 'output'`. The addresses are the same only because all twelve export
identically in both modes, which `artifact-registry.test.ts` asserts. Copy the resolution order from
that test; do not copy its mode.

Before injecting, the generator asserts `disposition.dialect === 'draft-2020-12'` for every entry it
acts on, and throws otherwise. The dialect field exists because `items: false` bounds a tuple only
beside 2020-12's `prefixItems`; under draft-7 a tuple exports as `items: [...]` and the same
injection overwrites the tuple, so every operand list in the published schema would reject
everything. Read the field, do not assume it.

Every entry whose disposition is `not-expressible` is left alone. Its statement already lives in a
schema description, which survives the export, and this story adds no keyword for it.

Measured on 2026-08-20 against the working tree: the ledger holds **28 entries**, of which **13
inject** (twelve `operator-arity-*` plus `binding-channel-non-empty`) and **15 are
not-expressible**. All thirteen resolve at their stated address with zero unresolved segments. Note
that Story 1.4's Completion Notes say "16 arity entries"; the measured count is **12**, because
`TUPLE_ARITY` has twelve keys while `RELATION_VOCABULARY` has sixteen. Verify counts against the code
before repeating any of them in the Dev Agent Record.

### AC 3 — `schemas/` on disk: generated, committed, ASCII, formatter-excluded

`scripts/generate-schemas.ts` is a thin I/O wrapper over AC 1's pure builder. It writes
`schemas/{key}.schema.json` for all twelve keys and nothing else. It is run by `npm run
generate:schemas`.

Serialisation is fixed so the drift check has something byte-exact to compare:

- `JSON.stringify(document, null, 2)` plus one trailing newline;
- every code unit above U+007F escaped as `\uXXXX` after stringification, so the committed files are
  pure ASCII. Measured: the twelve documents currently carry 37 non-ASCII characters, 35 em dashes
  and 2 ellipses, all inside descriptions that quote an AD verbatim. ASCII-only files match the rule
  the test fixtures already follow and remove a byte-level encoding variable from a check whose whole
  point is byte equality;
- LF line endings. `.gitattributes` is `* text=auto eol=lf`, which already covers every file, so no
  change is needed there.

`biome.json` gains `!schemas` to its `files.includes` array, per AD-13's "`schemas/` and `corpus/` are
excluded from the formatter so lint and drift cannot fight". `corpus/` does not exist yet and its
exclusion travels with the story that creates it (Decision 9).

The twelve files are committed. Measured **bytes** with `$id` present, 2-space indent and trailing
newline, before keyword injection and before ASCII escaping: eval-contract 84,506; evidence-artifact
50,384; sealed-run-record 38,112; probe 14,462; isolation-manifest 12,584; sealed-evaluator-brief
10,530; evaluator-configuration 8,220; rubric 5,936; private-artifact-manifest 5,146;
preflight-verdict 4,609; scoring-policy 4,039; artifact-reference 2,429. About 240 KB in total.

Two of those figures are two bytes and seventy-two bytes above the corresponding UTF-16 code-unit
counts, because `String.length` is not a byte count and the two documents carrying non-ASCII are
eval-contract (36 characters) and isolation-manifest (1). Measure with `Buffer.byteLength` or
`wc -c`, never `.length`, or AC 6 reports a phantom drift. The committed sizes will differ again
once the thirteen injections and the ASCII escaping are applied; these are the pre-injection
baseline, not the target.

`package.json` gains no `files` entry and no `exports` subpath in this story (Decision 8).

### AC 4 — The AD-5 failure-code registry, bound to its table by a check

The epic's standing prohibition is "must not hand-maintain the failure-code enumeration beside AD-5's
table. It is generated from it." No artifact among the twelve carries a failure-code enumeration
today, so there is nothing in a published document to generate; what this story owes is the mechanism
that makes the prohibition mechanical before the first enumeration exists (Decision 4).

- `src/core/failure-codes.ts` exports `FAILURE_CODES`, the twenty AD-5 codes as a `readonly [...]`
  tuple with `as const`, in the table's order, plus the derived
  `type FailureCode = (typeof FAILURE_CODES)[number]`. It imports nothing but its own literals. It
  is not a Zod schema, and it is not wired into any artifact. It sits in `core/` rather than
  `core/schemas/` for that reason: the Structural Seed calls `schemas/` "Zod definitions; the single
  source of truth for every artifact", and a codes-only module is neither a Zod definition nor an
  artifact. The compiler that emits these codes lives in `core/compile/`, one directory over.
- `scripts/check-ad5-registry.ts` parses the first column of the code table inside AD-5 of
  `ARCHITECTURE-SPINE.md` and asserts **set and order equality** against `FAILURE_CODES`, reporting
  every code present on one side and absent from the other. Verified today that the block between the
  `### AD-5 ` and `### AD-6 ` headings yields exactly twenty codes with the row pattern
  `^\s*\|\s*\`([a-z0-9-]+)\`\s*\|`.
- Reading a planning artifact from a script does not violate AD-15. AD-15 binds the package, whose
  published `files` are `dist`, `README.md`, and `LICENSE`; `scripts/check-docs.mjs` already reads
  `_bmad-output/planning-artifacts` under `npm run validate` and is the precedent.
- `FAILURE_CODES` is the single source for every later consumer. Story 4.2 builds the registry as
  code on top of it and transcribes nothing; any published schema that later needs the enumeration
  writes `z.enum(FAILURE_CODES)`.
- A test asserts the tuple has exactly twenty members, that they are unique, and that every member is
  lowercase kebab-case, so the module cannot silently gain a duplicate or a mis-cased entry between
  spine parses.

### AC 5 — Check one: the rejection suite, run against the published schema

The existing Zod-side reject corpus stays exactly as it is and keeps asserting Zod issue paths and
codes. This AC adds the published-schema half of the same corpus, which is what AD-13 actually asks
for: "every negative case is a valid positive fixture mutated to violate exactly one target
constraint, and the test asserts the expected validator keyword and instance path".

- `RejectCase` and `ArtifactRejectCase` each gain two required fields: `keyword` (the JSON Schema
  validation keyword the published schema must report) and `instancePath` (the RFC 6901 pointer into
  the instance, in the validator's spelling, for example `/oracles/0/check/operands`). Ajv 8 spells
  the error field `instancePath`; `dataPath` is the ajv 6 name and appears in a great deal of stale
  documentation.
- A new test compiles each artifact's published document and, for every reject case belonging to that
  artifact, asserts the instance is rejected **and** that the reported error set contains an error
  whose `keyword` and `instancePath` match the declared pair.
- **Assert containment, not a single error.** Measured: with `allErrors: true`, a one-operand
  `equality` against the eval-contract document produces well over two hundred errors, because
  `Expression` exports as a sixteen-branch `oneOf` and every branch reports its own failure. The
  Zod-side "exactly one issue" rule is a Zod-side rule and does not carry over. Setting
  `allErrors: false` does not help either: the first error reported for a union is whichever branch
  the validator tried first, which is rarely the target constraint.
- Every accept fixture validates clean against its own published document: the twelve of
  `ARTIFACT_ACCEPT_FIXTURES`, the four of `PROBE_CLASS_FIXTURES`, the six of
  `UNION_BRANCH_FIXTURES`, and the three of `RELEVANCE_CONTRACTS`. Measured today against the
  injected documents: all twelve accept fixtures validate clean, and so do all thirteen of the
  branch, probe-class, and relevance positives, with zero rejections.
- The corpus size, measured: **112 reject cases**, 44 in `reject-cases.ts` against the Eval Contract
  and 68 in `artifact-reject-cases.ts` across the other eleven. Every one of them needs its two new
  fields. Derive them by running the validator rather than by prediction, the way Story 1.4 derived
  its 79 worked-example issues.

### AC 6 — Check two: the byte-exact drift check

`scripts/check-schemas.ts`, exposed as `npm run check:schemas`, rebuilds all twelve documents in
memory through AC 1's builder, serialises them through AC 3's exact rules, and compares the result
byte for byte against the committed files. It reports, per file, the first differing byte offset and
a short context window on both sides; it never rewrites a file.

A `--write` flag is **not** added to this script. Regeneration is `npm run generate:schemas`, and a
check that can silently repair what it is checking is not a gate.

The check fails when a committed file is missing, when an extra `*.schema.json` is present that no
registry key names, and when any byte differs.

This is the one check that reads the filesystem, which is why it is a script rather than a Vitest
test: AD-30 forbids a test performing filesystem I/O outside a temporary directory, and the other
three checks are pure and stay in Vitest (Decision 7).

### AC 7 — Check three: the differential check over generated inputs

Zero disagreements between Zod acceptance and published-schema acceptance over a generated input
corpus.

- For every corpus member and its owning artifact, compute `schema.safeParse(instance).success` and
  the validator's verdict on the published document. A disagreement in either direction fails the
  check and is reported with the artifact key, the corpus member's identifier, both verdicts, and the
  validator's first three errors.
- The corpus is AC 9's generated corpus plus every accept fixture and every hand-written reject case.
- Two known-legitimate asymmetries are handled at the generator rather than excused at the
  comparison:
  - **The AD-36 numeric domain.** `json-value-numeric-domain` is a ledger entry marked
    not-expressible: JSON Schema cannot express finiteness, and Story 1.2's lexical scanner rejects
    `1e999` and unsafe integers before any parse. The generator must therefore never emit a
    non-finite or unsafe-integer literal inside a `JsonValue`. The ledger says this in the entry's
    own `reason`; read it there.
  - **Cross-field rules.** The eleven `lineage-*` entries and the two `secrets-prohibition-*` entries
    are not-expressible and are not enforced by Zod either, so they produce no disagreement. Confirm
    that rather than assume it: a mutant that sets `parentDigest` to `null` alongside
    `revisionCount: 3` must be accepted by both sides.
- **Each injected entry is paired with its own fixture, explicitly.** AD-13 asks for a table with
  "one entry per constraint, each paired with its fixture", and a corpus that happens to cover them
  is not the same as a pairing that is asserted. A test walks the thirteen `inject` entries and, for
  each, requires at least one corpus member rejected with that entry's injected keyword at that
  entry's stated address. The `minProperties` case below is that assertion for one entry; generalise
  it to all thirteen rather than leaving twelve of them to the mutation sweep's transitive coverage.
- The one `.refine()` in the source tree is `plan.ts`'s non-empty input-binding channel, and the
  ledger repairs it with `minProperties: 1`. Verified today: with the injection applied, an empty
  channel map is rejected with keyword `minProperties` at instance path
  `/interactionPlan/0/inputBinding/query`, and `null` is still accepted. That single case is the
  proof-of-concept for the whole differential check; make sure the corpus contains it.

### AC 8 — Check four: the keyword-mutation check

For every mutable keyword occurrence in every published document: delete that occurrence, recompile,
and require at least one corpus member to change verdict. A keyword whose removal changes nothing is
a keyword no fixture protects, and the check names it.

- **Mutable** means every key that is not one of `$schema`, `$id`, `$defs`, `$ref`, `description`,
  `title`, `properties`, and `definitions`, and that is not a member name inside a `properties` or
  `$defs` map. Walking a `properties` map must descend into values without treating the property
  names as keywords, or the check tries to delete a field called `type` from an artifact and reports
  nonsense. `properties` is on the exclusion list rather than the mutation list because deleting a
  whole `properties` object is not a single-constraint mutation: it removes every keyword beneath it
  at once, which is the multi-violation shape AD-13's per-constraint proof rule exists to forbid.
  There are exactly 133 `properties` occurrences; the census below is 1,949 with them excluded and
  2,082 with them counted, so a dev who reads the exclusion list loosely will reproduce neither the
  total nor any per-document figure.
- A mutation that produces an uncompilable document is reported as such and counted separately. It is
  not a pass.
- **Measured keyword census, 2026-08-20**, so the size is known before the first line is written:
  1,949 occurrences in total. eval-contract 668, evidence-artifact 409, sealed-run-record 287,
  isolation-manifest 134, probe 119, sealed-evaluator-brief 97, evaluator-configuration 69, rubric 51,
  preflight-verdict 34, private-artifact-manifest 31, scoring-policy 29, artifact-reference 21. By
  keyword: `type` 873, `additionalProperties` 152, `pattern` 135, `required` 133, `anyOf` 117, `items`
  110, `minimum` 99, `maximum` 97, `minLength` 81, `enum` 53, `const` 34, `minItems` 22,
  `propertyNames` 19, `prefixItems` 12, `oneOf` 8, and one each of `format`, `minProperties`,
  `exclusiveMinimum`, and `maxItems`.
- **The hand-written corpus alone does not come close, and this is the sizing fact of the story.**
  Kill rates sampled on five documents using only the accept fixture plus that artifact's
  hand-written reject cases: artifact-reference 5 of 21, scoring-policy 5 of 29, preflight-verdict 4
  of 34, rubric 6 of 51, probe 6 of 119. Roughly one keyword in ten. The denominators are the
  per-document census figures below; the numerators come from one sweep on one machine and are
  indicative, so treat the ratio as the sizing signal rather than the individual numbers. Writing about 1,800 more reject fixtures by hand is not
  the answer; AC 9 is.
- **Runtime budget, indicative rather than measured.** Compile time is machine-dependent: one
  machine averaged 24.3 ms for the eval-contract document and 3.6 ms for scoring-policy, a second
  measured 37.8 ms cold and 0.7 ms. Same order of magnitude either way, so a full sweep of 1,949
  mutations lands in the tens of seconds. Run the
  sweep per artifact against only that artifact's corpus, and give the Vitest case an explicit
  timeout well above the measured figure rather than leaving the default to decide.
- The failure report lists survivors as `artifact` plus the keyword's path within the document, so a
  reader can go straight to the shape that needs a fixture.

**Some keyword occurrences are structurally unkillable, and the check must exempt them by rule rather
than fail forever.** The largest group is the `JsonValue` container, which is the Consistency
Conventions' named exception and exports as `anyOf` over string, number, boolean, null, array of
itself, and object of itself. That subschema admits every JSON instance, so no mutant can violate any
keyword inside it and no deletion inside it changes a verdict. AC 9's generator cannot produce "a
value matching no branch" when the branches are all of JSON.

Compute the exempt set, never hand-list it. A keyword occurrence is exempt when any of the following
holds, and the check derives the set from the document rather than from a committed list:

1. it sits inside a `$defs` entry structurally equal to the universal-JSON acceptor above, or inside
   a subschema reached only through a `$ref` to it;
2. it is a `propertyNames` whose value is exactly `{ "type": "string" }`, or the `type` inside any
   `propertyNames`. A JSON object key is always a string, so neither constrains anything;
3. it is `format`, which AC 10 registers as always-true, so its deletion is a no-op by construction;
4. it is an `items` or `additionalProperties` whose value is the bare `{ "$ref": "#/$defs/JsonValue" }`,
   which left its members unconstrained before the deletion and after it.

Those four were written before the sweep ran, and the sweep found three more shapes that no fixture
can kill either. They were settled by construction during implementation rather than escalated, and
this AC records them because a reader of the AC alone would otherwise get a rule set the code does
not implement. Each is computed from the document exactly like the first four:

5. it is a `type` beside a sibling `const` or `enum` whose every member is of the stated type. Zod
   exports `z.literal('x')` as `{"type":"string","const":"x"}` and `z.enum` likewise, so any instance
   the `type` rejects is already rejected by the sibling and the deletion changes no verdict. This is
   the largest of the three at 87 occurrences;
6. it sits inside a vacuous nullable value container: a node carrying nothing but an `anyOf` in which
   one branch is the bare `{ "$ref": "#/$defs/JsonValue" }` admits every instance, so the `anyOf` and
   its sibling branches constrain nothing. This is rule 1's "reached only through a `$ref` to it"
   clause, computed rather than argued: 2 occurrences, in `responseBody`;
7. it is an `items` under `maxItems: 0`, or anything inside that item schema: the array must be empty
   for the node to admit anything, so no element ever exists for the item schema to constrain. 14
   occurrences, all in the clean-control probe branch's `defects`.

Both AC 8's survivor list and AC 9's unreachable list are then asserted **equal to** that computed
set, not merely disjoint from it and not merely non-empty. Equality is the point: a survivor outside
the set is a missing fixture and fails the check, and an exempt occurrence that suddenly becomes
killable means a schema changed under the exemption and also fails, which is what stops the exemption
from quietly widening into a hole.

Measured by the seven rules on the current export: **168 of the 1,949 occurrences are exempt**, about
nine percent: `eval-contract` 60, `sealed-run-record` 40, `probe` 24, `evidence-artifact` 22,
`evaluator-configuration` 14, `sealed-evaluator-brief` 2, `artifact-reference` 2, `preflight-verdict`
2, `private-artifact-manifest` 1, `scoring-policy` 1, and none in `rubric` or `isolation-manifest`.
The first four rules alone yield exactly 65, concentrated in `sealed-run-record` (26),
`eval-contract` (25) and `evaluator-configuration` (14), which is the figure this AC carried before
the sweep ran. Re-derive the figures rather than trusting them, and record the measured numbers in
the Dev Agent Record.

### AC 9 — The generated mutant corpus that serves checks three and four

One generated corpus serves both the differential check and the mutation check, which is what makes
AC 8 tractable and what makes AC 7's inputs meaningful rather than arbitrary.

A schema-directed mutant generator walks a published document alongside a positive fixture and, for
each mutable keyword occurrence reachable from that fixture, produces one instance that violates that
keyword and, as far as it can, nothing else.

Keep the two mutations straight, because they run in opposite directions and share a vocabulary. AC 8
mutates the **schema**: it deletes a keyword occurrence from the document. This generator mutates the
**instance**: it produces a value that the intact keyword rejects. The pairing is what makes AC 8
decidable, because deleting keyword K is expected to make exactly the instance built to violate K
start passing. The table below is the instance side:

| Keyword | Mutation |
| --- | --- |
| `type` | replace with a value of a type no sibling branch admits |
| `const`, `enum` | an out-of-set value of the right primitive type |
| `pattern` | a string of the right type that the pattern rejects |
| `minLength` | a string one code unit shorter than the bound |
| `minimum`, `maximum` | the bound displaced by one |
| `exclusiveMinimum` | the boundary value itself |
| `required` | delete one named key; one mutant per member |
| `additionalProperties: false` | add one key the shape does not declare |
| `propertyNames` | add one key that violates the name schema |
| `minItems`, `maxItems` | an array one element short or one element long |
| `items: false` | append one element past the tuple |
| `prefixItems` | replace element `i` with a wrong-typed value; one mutant per index |
| `minProperties` | the empty object |
| `anyOf`, `oneOf` | a value matching no branch |

- **Seed from every positive fixture, not one per artifact.** A keyword inside a union branch the
  primary fixture does not take is unreachable from that fixture. Story 1.4 already supplies the
  branch coverage: `UNION_BRANCH_FIXTURES`, `PROBE_CLASS_FIXTURES`, and `RELEVANCE_CONTRACTS`. Use
  all of them.
- **Determinism.** No `Math.random`, no clock. Where a choice is needed, derive it from the keyword's
  path within the document, so the corpus is a pure function of the schemas and the fixtures and two
  runs produce byte-identical inputs.
- **Report what it could not reach, and compare it against the exempt set.** Keyword occurrences for
  which the generator produced no mutant are listed by artifact and path, and that list is asserted
  equal to AC 8's computed exempt set. Not a subset and not merely non-empty: equal. An unreachable
  occurrence outside the exempt set means the generator has a gap and the check fails; an exempt
  occurrence the generator did reach means the exemption rule is wrong and the check also fails.
  Silent truncation would make a partial sweep read as a complete one, which is the failure this
  whole story exists to prevent one level up.
- The generator lives under `tests/schemas/` and is pure, so it is exercised by Vitest with no
  filesystem access. It has its own tests: a handful of hand-checked mutants asserted against the
  keyword they target, so the generator itself is not trusted on its own say-so.

### AC 10 — The validator, and what its strict mode is allowed to be told to ignore

A third-party JSON Schema validator is a hard requirement of the differential check, not a
convenience. A validator written in this repository would be co-designed with the generator and would
agree with it by construction, which proves nothing about the consumer AD-13 exists to protect.

- `ajv` at **8.20.0** exactly, as a development dependency, using its Draft 2020-12 entry point
  `ajv/dist/2020.js`. Verified: `ajv@8.20.0` is MIT, published 2026-04-24 and therefore well outside
  the seven-day age window, and its four transitive dependencies are `fast-uri` (BSD-3-Clause),
  `fast-deep-equal` (MIT), `require-from-string` (MIT), and `json-schema-traverse` (MIT). All five
  licences are on AD-25's allowlist. Five packages added.
- `ajv-formats` is **not** added (Decision 6).
- Validator options, each with a reason, all verified today:
  - `strict: true`. Keep it. Ajv's strict mode independently reported AD-13's predicted arity defect
    against the uninjected export: `strict mode: "prefixItems" is 2-tuple, but minItems or
    maxItems/items are not specified or different at path "#/oneOf/0/properties/operands"`. That is a
    third party reproducing the exact hole the constraint ledger exists to fill, and it is worth
    keeping as a standing check on future exports.
  - `strictTypes: false`. Required, with a recorded reason. The `minProperties: 1` injection lands at
    the root of `InputBindingChannel`, which exports as `{ anyOf: [ objectBranch, { type: "null" } ] }`
    and therefore carries no `type` of its own. Ajv reports `strict mode: missing type "object" for
    keyword "minProperties"`. The schema is correct: `minProperties` is ignored on a non-object
    instance, which is precisely why the ledger addresses the definition root and says so in its
    `statement`. `strictTypes` is an ajv style opinion; `strictTuples`, which caught the real defect
    above, is a separate flag and stays on.
  - `formats: { 'date-time': true }`. Registering the format as always-true silences ajv's unknown-
    format complaint without weakening anything, because the constraint is carried by `pattern`, not
    by `format`. Verified: `z.iso.datetime()` exports **both** `format: "date-time"` and a pattern
    that admits a trailing `Z` and rejects a numeric offset, and `2026-01-01T00:00:00+02:00` is
    rejected by `pattern` at instance path `/waivers/0/expiresAt`. Do not reach for `ajv-formats`
    here: its `date-time` accepts numeric offsets and would therefore disagree with Zod, manufacturing
    a differential failure out of a format keyword that JSON Schema treats as an annotation by
    default anyway.
  - `allErrors: true` for the rejection suite, so the target keyword is present in the error set;
    `allErrors: false` is acceptable for the mutation sweep, where only the verdict is read.
- Compile each document with a fresh validator instance, or register all twelve on one instance. The
  synthesised `$id`s are unique across the twelve, so both work; a fresh instance per mutation is what
  the mutation sweep needs anyway.

### AC 11 — Continuous integration

- `package.json` gains `generate:schemas` and `check:schemas`, and `validate` gains
  `check:schemas` and the AD-5 registry check. Keep `validate`'s existing order and append rather
  than reshuffle, so a failure in the new checks is distinguishable from a regression in the old
  ones.
- `pr-checks.yml` runs the new checks. `npm run validate` already runs inside the
  `validate-and-build` job and picks up the drift and registry checks through the script; the three
  Vitest-side checks arrive through `npm run test`. Add a **named** step for the schema checks rather
  than leaving them invisible inside `validate`, so a red build says which gate failed. The Node
  22.20.0 floor job runs `npm run test`, so the three pure checks run there too.
- The generator and the check scripts are TypeScript run directly by Node's built-in type stripping.
  Verified on Node 24.19.0: `node scripts/foo.ts` importing `src/core/schemas/artifact.ts` and
  `src/core/schemas/constraint-ledger.ts` works with no flag and no loader. Type stripping is
  unflagged from Node 22.18.0, so the 22.20.0 floor job is covered; do not add a flag, and do not add
  a transpile step.
- `tsconfig.json`'s `include` gains `"scripts"` so the new `.ts` scripts are typechecked. That picks
  up `.ts` files only, so the existing `.mjs` scripts and the Python linter are unaffected, and
  `tsconfig-build.json` still includes `src` alone so nothing new reaches `dist`.
- Node's type stripping erases types only. Do not use a TypeScript `enum`, a `namespace`, a parameter
  property, or a non-`type` re-export in a file a script loads, or the script fails at load with a
  syntax error that the typechecker will not have warned about.

### AC 12 — Fixtures, tests, and the gate

- Every new test enumerates its corpus with `it.each` off an exported array whose completeness is
  itself asserted, matching the pattern the existing suite uses, so a committed fixture no test
  exercises cannot go silently dead.
- Write each test so it fails if the property it names is removed. Story 1.3's review round two found
  three tests that passed for the wrong reason, all the same shape; this story's mutation check is
  literally an automated form of that concern and should not itself be the thing that passes for the
  wrong reason.
- `npm run validate` passes: typecheck, lint, `check:docs`, `lint:spine`, `check:vectors`,
  `check:schemas`, the AD-5 registry check, and the test suite. Run `npm run check:docs` **before the
  first edit**, per the habit Story 1.3 paid for and Story 1.4 kept.
- Baseline measured today: **799 tests in 21 files, all green**; `schemas/` does not yet exist.
- The worked-example corpus is a known-nonconforming corpus and stays that way. Do not repair
  `spike-worked-example/*.json`, and do not add its documents to the accept fixtures.
- `experiments/` is a closed record. Never edit it.
- No `.npmrc` change and no pin change beyond the single `ajv` addition is expected. If one seems
  necessary, stop and re-check the approach.

## Tasks / Subtasks

- [x] Task 1: preflight (AC 12)
  - [x] Run `npm run check:docs` and `npm test` and record the baseline before the first edit.
- [x] Task 2: the pure builder (AC 1, AC 2)
  - [x] `src/core/schemas/publish.ts`: `publishedDocument(key)` and the twelve-key map, with the
        `$id` synthesis, the ledger injection by stated address, the dialect assertion, and a loud
        failure on an unresolved address.
  - [x] Tests: every injected keyword lands at the ledger's stated address; every not-expressible
        entry injects nothing; an entry with a deliberately broken address throws.
- [x] Task 3: `schemas/` on disk (AC 3)
  - [x] `scripts/generate-schemas.ts`; the ASCII-escaping serialiser; `biome.json` gains `!schemas`;
        commit the twelve files.
- [x] Task 4: the AD-5 registry binding (AC 4)
  - [x] `src/core/failure-codes.ts` and `scripts/check-ad5-registry.ts`, plus the
        twenty-member, unique, kebab-case test.
- [x] Task 5: the mutant generator (AC 9)
  - [x] The schema-directed generator under `tests/schemas/`, its own hand-checked tests, and the
        unreachable-keyword report.
- [x] Task 6: the four checks (AC 5, AC 6, AC 7, AC 8)
  - [x] `keyword` and `instancePath` on all 112 reject cases, derived by running the validator.
  - [x] The published-schema rejection suite, the differential check, and the mutation sweep in
        Vitest; the drift check in `scripts/check-schemas.ts`.
- [x] Task 7: wiring and the gate (AC 10, AC 11, AC 12)
  - [x] `ajv@8.20.0` as a development dependency; the new npm scripts; `tsconfig.json` include;
        `pr-checks.yml` named steps; `npm run validate` green.
- [x] Task 8: record
  - [x] Learning-path Step 5, one line in the table and a short section, per the doc's own brevity
        rule; the Dev Agent Record with counts measured against the code.

### Review Findings

Second independent review pass, 2026-08-20, against the working tree at baseline `e83a322`.
Four layers: blind hunter, edge-case hunter, verification-gap, acceptance auditor. Every finding
below was re-verified against the code before it was written down; seven further findings were
dismissed and are listed at the end with the evidence that dismissed them.

- [x] [Review][Decision] **Resolved: declare, do not revert.** Out-of-scope, undeclared edits ride along in the diff: `README.md` is
      modified (three heading and prose rewrites, and a `text` block replaced with a mermaid
      diagram) yet appears nowhere in the File List; `learning-path-step-by-step.md` carries four
      prose rewrites in Steps 1, 2 and 4 while the File List declares only "(Step 5)"; and
      `sprint-status.yaml` moves the `epic-2` through `epic-6` markers across blank lines for all
      five epics, beyond the declared "(1-5 to review)". None of it breaks a gate. The choice is
      whether to revert them to keep the story's scope fence honest or to declare them in the File
      List. Every one of them is a user-requested edit made outside this story: the README diagram
      replaced a bare `TEA -> eval-quality` arrow a reader had flagged as unclear, the README and
      learning-path prose rewrites are a `/de-ai` pass over both files, and the `sprint-status.yaml`
      hunks are cosmetic blank-line placement from story creation plus story 1.4 moving to `done`
      now that `e83a322` is merged. They are declared in the File List under "Unrelated
      working-tree changes, declared" rather than reverted.
- [x] [Review][Decision] **Resolved: intended, no change.** The story's own status contradicts the
      tracking file it updates: story front-matter reads `Status: done` while `sprint-status.yaml`
      reads `review`. This is by design in the build workflow: the spec front-matter records that
      implementation finished, and `review` in sprint vocabulary means awaiting human code review
      and merge. Both stay as they are.

- [x] [Review][Patch] HIGH. The keyword census is unpinned, so a silently narrowed sweep passes
      green [tests/schemas/published/keyword-mutation.test.ts:106]. The test named "finds the full
      census" asserts only `total > 1900` against a measured 1,949 and `occurrences.length > 15`
      per artifact against a real range of 21 to 668. Demonstrated: deleting `'propertyNames'` from
      `SCHEMA_VALUE_KEYWORDS` in `keyword-occurrences.ts` drops the sweep from 1,949 occurrences to
      1,921, and all 923 tests under `tests/schemas/` still pass, because the keyword-set equality
      still holds and the three-way survivors/unreachable/exempt equality simply recomputes against
      the smaller set. `prefixItems` (12 occurrences) and the `additionalProperties` descent are
      exposed the same way. AC 8's per-document and per-keyword census is the story's most-cited
      measurement and nothing asserts it; AC 12 requires each test to fail when the property it
      names is removed. Fix: assert the exact per-document totals and the exact per-keyword
      histogram, both of which reproduce today.
- [x] [Review][Patch] Neither new gate has a negative canary, against four in this repo that exist
      for exactly this reason [.github/workflows/pr-checks.yml:38]. `canary-age`, `canary-git`,
      `canary-remote` and `canary-licence` each prove their gate fails for the right reason.
      `check:schemas` and `check:ad5-registry` get none, and `generate:schemas` never runs in CI at
      all, so nothing proves generate-then-check is a fixed point. Both gates do fail correctly
      today (verified by hand against a mutated byte, an orphan `*.schema.json`, a stray non-schema
      file, a dropped code and a reordered code), so this is about durability rather than a present
      hole. It is also the rule this same diff restates in the learning-path doc: a gate that never
      blocks anything protects nothing.
- [x] [Review][Patch] The Node 22.20.0 floor job never runs either type-stripped script
      [.github/workflows/pr-checks.yml:57]. AC 11 records that "the 22.20.0 floor job is covered",
      but the `floor` job runs `npm run build` and `npm run test` only. `build` goes through `tsc`
      and `test` through Vite's transform, so neither exercises Node's type stripper. The two named
      steps were added to `validate-and-build`, which resolves Node from `.nvmrc` (24). If anything
      in the graph `scripts/check-schemas.ts` to `artifact.ts` to the twelve schema modules to
      `publish.ts` acquires syntax the Node 22 stripper rejects, both jobs stay green while a
      contributor on the declared floor gets a load-time SyntaxError. Fix: add the two named steps
      to the `floor` job as well.
- [x] [Review][Patch] The two tests that pay for eval-contract mutant generation run on Vitest's
      5 s default [tests/schemas/published/differential.test.ts:30,
      tests/schemas/published/mutant-generator.test.ts:42]. `vitest.config.ts` sets no
      `testTimeout`, and these two are each their file's first call to `generationOf('eval-contract')`,
      so they pay the full cold-cache cost. Their siblings carry explicit budgets (`120_000` and
      `SWEEP_TIMEOUT_MS = 240_000`); these carry none. Measured: at `--testTimeout=900` exactly
      those two fail, at 1,077 ms and 1,126 ms. A roughly 4x margin on a CPU-bound task, on a
      shared runner where the 240 s sweep is competing for the same cores, is how checks three and
      four go red for a timing reason rather than a schema reason.
- [x] [Review][Patch] A gitignored file in `schemas/` wedges `npm run validate`, and the repair the
      error names does not clear it [scripts/check-schemas.ts:43]. Reproduced: `touch
      schemas/.DS_Store` makes `check:schemas` exit 1 with "present on disk but no registry key
      names it"; `npm run generate:schemas`, the only repair the error text and the surrounding
      comments name, deliberately removes `*.schema.json` alone and leaves it. `.DS_Store` is in
      `.gitignore` and the developer is on darwin, so this is a likely local wedge with no visible
      cause. The summary line also misreports it as "1 file(s) drifted or missing" for a file that
      is neither. Fix: skip dot-prefixed entries, which git already ignores, and separate the
      "unexpected file" count from the "drifted or missing" one.
- [x] [Review][Patch] AC 8's exemption rule was never amended to match the code it governs. The AC
      states a closed four-clause rule and "65 of the 1,949 occurrences are exempt ... the other
      nine documents have none". `exemptOccurrencePointers` implements seven clauses and exempts
      168, across ten of twelve documents. Clauses 1 to 4 do reproduce the predicted 65 exactly;
      clause 5 adds 87, clause 6 adds 2, clause 7 adds 14. All three additions are sound and
      computed from the document, Completion Notes item 3 records them, and the learning-path doc
      already says 168. Only AC 8 still carries the superseded figure, a false distribution claim
      and a rule set the code does not implement. Fix in the story text, per the standing rule that
      settles this kind of gap in place rather than in a new spine revision.
- [x] [Review][Patch] The thirteenth inject entry is named wrong in two places in this story. Its
      id is `binding-channel-non-empty` (`src/core/schemas/plan.ts:19`), not
      `input-binding-channel-non-empty` as AC 2 and Completion Notes item 1 both state. This is the
      exact defect class the story's own "Previous story intelligence" calls the most reliably
      repeated one in the epic.
- [x] [Review][Patch] The `$defs` naming walk clears its floor with room to spare
      [tests/schemas/publish.test.ts:94]. `expect(walked).toBeGreaterThan(10)` against a real total
      of 15 leaves 5 of headroom, so eval-contract's or sealed-run-record's five definitions could
      stop being emitted and the walk would still pass. Same family as the census finding above.
- [x] [Review][Patch] Eight of the 112 published-side reject pairs do not identify which member the
      mutation touched [tests/schemas/fixtures/artifact-reject-cases.ts]. Four assert
      `keyword: 'required'` and four assert `keyword: 'additionalProperties'`; for both, ajv puts
      the discriminating detail in `params.missingProperty` and `params.additionalProperty`, and
      nothing under `tests/schemas/published/` reads `.params`. Mutating a different required key
      at the same instance path would still satisfy the published half. The Zod-side `issuePath`
      still pins it, so the pair is weaker rather than unbound.
- [x] [Review][Patch] The rejection suite does not use the schema-address matcher this same change
      wrote [tests/schemas/published/published-rejection.test.ts:77]. It matches
      `(keyword, instancePath)` by containment inside an error set the file's own comment says can
      exceed two hundred entries for the sixteen-branch `oneOf`, so a mutation rejected for an
      unrelated reason can coincidentally carry the declared pair from another branch.
      `pointerMatchesSchemaPath` exists and is used in `differential.test.ts`; the check that most
      directly stands in for a consumer does not use it.
- [x] [Review][Patch] `pointerMatchesSchemaPath` documents a containment guarantee its most
      important call site does not provide [tests/schemas/published/keyword-occurrences.ts:37]. The
      JSDoc contains the residual `$defs` ambiguity by asserting that "every call site also pins
      the instance path". `mutant-generator.ts:531` and `:555` do. `differential.test.ts:182`, the
      thirteen-entry ledger-pairing assertion that AD-13's pairing requirement rests on, matches on
      `error.keyword` plus the schema path alone. No false witness exists in the current export;
      the comment claims a guard that is absent exactly where it matters most.
- [x] [Review][Patch] The orphan sweep builds filesystem paths from disk-provided names through
      `new URL` [scripts/generate-schemas.ts:40]. Verified: `a#b.schema.json` and `a?b.schema.json`
      both resolve to the path `schemas/a`, and `a%2Fb.schema.json` throws
      `ERR_INVALID_FILE_URL_PATH`. So the cleanup would target the wrong path or abort the run. It
      also calls `rm` without `{ recursive: true }`, which throws on a directory whose name ends
      `.schema.json`; `check-schemas.ts` already guards that case with `entry.isFile()` and the
      writer does neither. Fix: `readdir(..., { withFileTypes: true })` plus `join(fileURLToPath(directory), name)`.
- [x] [Review][Patch] Both scripts let the injector's carefully worded failure print as a raw stack
      [scripts/check-schemas.ts:68, scripts/generate-schemas.ts:24].
      `serializePublishedDocument(publishedDocument(key))` sits unguarded at top level in each. An
      unresolved ledger address throws the `constraint "..." does not resolve` Error into an
      unhandled top-level rejection, where Node prints a stack rather than the gate's own
      diagnosis. Both scripts wrap their filesystem calls in tailored messages already.
- [x] [Review][Patch] The AD-5 table parser is brittle in both directions and untested in both
      [scripts/check-ad5-registry.ts:56]. The header row is recognised only by the literal
      `/^\|\s*Code\s*\|/`, so renaming or bolding that column turns the header itself into a
      reported "unparsed data row" and reddens the build for a cosmetic doc edit. In the other
      direction, a fenced code block or a second table inside the AD-5 section whose first cell is
      a backticked kebab slug is absorbed into the code list with no signal, which is the silent
      direction the script exists to prevent. Fix: skip fenced blocks, and recognise the header by
      position rather than by column name.
- [x] [Review][Patch] The dated spine path is now hardcoded in two places
      [scripts/check-ad5-registry.ts:23]. It embeds
      `.../architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md`, duplicating the same dated
      workspace path already hardcoded in `package.json`'s `lint:spine`. Re-dating the architecture
      workspace breaks one or both, and neither reads a shared constant.
- [x] [Review][Patch] `biome.json` is edited in this change and left pinned to the wrong schema
      version [biome.json:2]. It declares `.../2.5.5/schema.json` while the devDependency is
      `@biomejs/biome@2.5.7`, so `npm run lint` emits `Expected: 2.5.7 / Found: 2.5.5` on every
      run. The mismatch arrived with the dependabot bump rather than with this story, but this diff
      already touches the file and the noise sits inside a gate's output.
- [x] [Review][Patch] The README and the workflow step label both misdescribe what `validate` runs
      [README.md:197, .github/workflows/pr-checks.yml:51]. README line 197 reads
      `npm run validate # typecheck + lint + docs check + test`, omitting `lint:spine`,
      `check:vectors` and now the two new checks; the workflow step is named
      "Validate (typecheck, lint, check:docs, lint:spine, test)". README is one of the three
      published files, it gains cosmetic edits in this diff, and it never mentions `schemas/`,
      `generate:schemas`, `check:schemas` or `check:ad5-registry` at all.
- [x] [Review][Patch] The "twenty-five positives" enumeration counts 19 distinct instances
      [tests/schemas/published/published-rejection.test.ts:123]. Measured by object identity, six
      entries are the same object listed twice: `accept/probe` equals both `probe-class/defect` and
      `probe/seeded`, `probe-class/zero-action` equals `probe/clean-control`,
      `accept/artifact-reference` equals `artifact-reference/public`, `accept/evidence-artifact`
      equals `evidence-artifact/production`, and `accept/eval-contract` equals
      `relevance/everything populated`. `seedsOf` in `corpus.ts` dedupes by identity for exactly
      this reason; this enumeration does not, so its assertion reads as broader coverage than it is.
- [x] [Review][Patch] `compileDocument` carries an unused parameter and a rationale describing a
      use that does not exist [tests/schemas/published/validator.ts:47]. No caller ever passes
      `options`, and the JSDoc's "keeps the synthesised `$id`s from colliding when a test compiles
      variants of one document" describes nothing that happens: it is called exactly once per
      artifact from behind a cache.
- [x] [Review][Patch] `injectConstraint` takes the first branch matching a discriminator without
      checking it is the only one [src/core/schemas/publish.ts:95]. `branches?.find(...)` on a
      duplicated `op` const would inject into one branch and skip the rest, which is the silent
      skip every other path in this function throws to prevent. A `filter` plus a length check
      costs one line.
- [x] [Review][Patch] The numeric synthesiser can clamp below its own lower bound
      [tests/schemas/published/mutant-generator.ts:231]. `Math.min(value, node.maximum)` is applied
      after the `exclusiveMinimum`- or `minimum`-derived floor, so a node whose `maximum` sits
      below that floor yields a value violating the lower bound. The invalid synthetic is then
      dropped by the keep criterion and the occurrences beneath it surface as an exempt-set
      inequality, which is loud but points at the wrong place; the file's own comment predicts
      exactly this confusion for its unhandled keywords.
- [x] [Review][Patch] Three small consistency items. `mutant-generator.ts`'s `items` case computes
      `const index = value.length > 0 ? 0 : value.length` where both arms are `0`; the same case
      wraps a string in a redundant template literal, `violating(`${occurrence.pointer}`)`; and
      `differential.test.ts` repeats a bare `120_000` at two call sites while
      `keyword-mutation.test.ts` names the same kind of budget `SWEEP_TIMEOUT_MS`.

- [x] [Review][Defer] The mutant corpus is regenerated once per test file
      [tests/schemas/published/corpus.ts:96]: `corpusOf` is now cached, matching `generationOf`.
      The finding's cost claim did not survive measurement, and the record below says so.

      The claim was that re-cloning 112 reject instances and rebuilding ~2,248 mutant wrappers on
      every call is the suite's dominant cost. Instrumented on 2026-08-20, assembling all twelve
      corpora takes **3 ms** in total, against **2,331 ms** to generate the mutants those corpora
      are assembled from and roughly **32 s** for the four published-schema test files. Caching it
      moved the suite from 32.25 s to 32.01 s, which is noise. The cache is kept because repeating
      work that cannot change is wrong, not because it bought anything.

      The real cost is where the finding's second sentence pointed: mutant generation, 2,331 ms per
      test file, paid three times because Vitest isolates modules per file. Amortising that needs
      `isolate: false` across the suite, which trades a real isolation guarantee for about five
      seconds. Not taken, and recorded here so the next reader does not re-derive it. Note also that
      the cached corpus members are now SHARED rather than per-call clones; a caller that mutates
      one must `structuredClone` it first, which the differential tests already do.

**Dismissed, with the evidence that dismissed them.** The published export is unreachable from the
tarball (no `files` entry, no `exports` subpath, `src/index.ts` untouched), which is Decision 8 and
belongs to Story 6.5. `definitions` is a census blind spot, but Zod's 2020-12 export emits `$defs`
and never `definitions`, and AC 8's exclusion list names it. `$ref` is excluded from the census, but
AC 8's definition of "mutable" excludes it by name. `structuredClone` in the sweep preserves
aliasing, so one occurrence's fixture could kill another: measured zero aliased nodes across all
twelve documents. `addressPointer` and `expectedUncompilable` throw on ledger shapes
`injectConstraint` supports (the union-root fallback, a branch-addressed entry with a null field),
which is a loud failure by design. `sprint-status.yaml` also flips story 1-4 to `done`, which is
correct bookkeeping now that `e83a322` is merged. Nothing asserts structurally that a published
`prefixItems` carries a sibling bound, but every document is compiled under `strict: true`, so
ajv's `strictTuples` fails the compile and reddens every check for that artifact.


## Dev Notes

### Scope boundary, and what this story is not

This story publishes and proves the schemas Stories 1.3 and 1.4 defined. It defines no new artifact
shape, adds no field, changes no existing Zod schema, and implements no stage, predicate, evaluator,
or compile check.

**If a check fails because a Zod schema is wrong, that is a finding, not a licence to change the
schema.** Story 1.4 landed after two adversarial review rounds and its export is asserted
byte-for-byte in the existing suite. A differential disagreement is far more likely to be a defect in
the generator, the injection, or the mutant corpus. Where a schema genuinely must change, say so
explicitly in the Dev Agent Record with the AC of record that requires it, and expect the existing
Story 1.3 and 1.4 assertions to move with it.

The one deliberate exception is the two new fields on the reject-case types, which are additive and
touch no schema.

### Read these files before writing anything

1. `src/core/schemas/constraint-ledger.ts`. The whole file. Its comments already tell you what Story
   1.5 must do with each disposition, what the dialect field is for, and why the address is
   structural.
2. `tests/schemas/constraint-ledger.test.ts`, specifically `resolve()`. Copy its resolution order
   exactly, including the `oneOf` union fallback and the reason it is `oneOf` rather than `anyOf`.
3. `src/core/schemas/artifact.ts`. The twelve-key registry and the `carriesLineage` flag.
4. `tests/schemas/fixtures/reject-cases.ts` and `tests/schemas/fixtures/artifact-reject-cases.ts`.
   The `RejectCase` shape you extend, and the 112 cases you are about to annotate.
5. `tests/schemas/fixtures/artifact-fixtures.ts`, ending at `ARTIFACT_ACCEPT_FIXTURES`,
   `PROBE_CLASS_FIXTURES`, and `UNION_BRANCH_FIXTURES`. These are the mutant generator's seeds.
6. `tests/schemas/artifact-registry.test.ts`. The input-versus-output-mode equality assertion lives
   here and must stay green.
7. `scripts/check-licenses.mjs` and `scripts/audit-lockfile-age.mjs`. The house style for a check
   script: no dependencies, a comment at the top naming the hole it plugs, an exact error string, and
   a report that names the path.
8. `.github/workflows/pr-checks.yml`. Where the named steps go.

### Verified facts about this pin, measured on 2026-08-20. Do not rediscover these

- All twelve artifacts export cleanly under `z.toJSONSchema(schema, { io: 'output' })` with no
  unrepresentable-type throw.
- Zod emits no `$id` at any level. `.meta({ id })` at the root does not put the root in `$defs`; the
  root schema is inline. `.meta({ id })` on a nested shape names its `$defs` key.
- `z.toJSONSchema` accepts an `override` hook receiving `{ zodSchema, jsonSchema, path }`. Its `path`
  is the path through the *instance* shape, not the `$defs` address: a shared definition is visited
  at `['properties','a','properties','x']` rather than at its `$defs` key. That makes the hook a poor
  fit for ledger-addressed injection. Post-process the emitted document instead, which is what the
  ledger's address shape was designed for.
- `z.iso.datetime()` exports `format: "date-time"` **and** a pattern encoding RFC 3339 UTC: a trailing
  `Z` is accepted, a numeric offset is rejected, and fractional seconds are accepted.
- `z.tuple([a, b])` exports `prefixItems` alone. Ajv strict mode reports this as a defect by itself,
  which is the third-party confirmation of the ledger's arity entries.
- With the thirteen injections applied, all twelve documents compile under ajv 8.20.0 with
  `{ strict: true, strictTypes: false, formats: { 'date-time': true } }`. All twelve accept fixtures
  validate clean, as do the six `UNION_BRANCH_FIXTURES`, the four `PROBE_CLASS_FIXTURES`, and the
  three `RELEVANCE_CONTRACTS` entries: thirteen positives, zero rejections.
- A one-operand `equality` is rejected with keyword `minItems` at instance path
  `/oracles/0/check/operands`, and the same instance produces more than two hundred errors under
  `allErrors: true` because of the sixteen-branch `oneOf`.
- An empty input-binding channel map is rejected with keyword `minProperties` at
  `/interactionPlan/0/inputBinding/query`; `null` is accepted.
- `z.toJSONSchema(EvalContract, { io: 'output' })` is deterministic across calls in one process and
  serialises minified to 50,795 UTF-16 code units, which is the figure Story 1.4 measured, and to
  **50,867 bytes**. The drift check has a stable baseline, and the two numbers differ by exactly
  twice the document's 36 non-ASCII characters.
- Ajv's 2020-12 entry point works under both `import { Ajv2020 } from 'ajv/dist/2020.js'` and a
  default import; the named form is the one to use. Types ship at `ajv/dist/2020.d.ts` and resolve
  under this repository's `moduleResolution: "Bundler"`.
- Node 24.19.0 runs `node scripts/foo.ts` with imports of `src/core/schemas/*.ts` and no flag.
- Ledger: 28 entries, 13 injecting, 15 not-expressible, zero unresolved addresses.
- `TUPLE_ARITY` has 12 keys; `RELATION_VOCABULARY` has 16.
- Reject corpus: 44 plus 68, so 112.
- Suite: 799 tests in 21 files, green.
- Keyword census: 1,949 mutable occurrences; the per-document and per-keyword breakdowns are in AC 8.
- Kill rate with the hand-written corpus alone, sampled on five documents: 5/21, 5/29, 4/34, 6/51,
  6/119. Indicative, from one sweep.
- Ajv compile time is machine-dependent and was measured at 24.3 ms and 37.8 ms for eval-contract on
  two machines. Do not treat it as a fixed figure.
- 168 of the 1,949 keyword occurrences are structurally unkillable under AC 8's seven-rule exemption:
  eval-contract 60, sealed-run-record 40, probe 24, evidence-artifact 22, evaluator-configuration 14,
  and one or two each in four more. The first four rules alone yield 65: sealed-run-record 26,
  eval-contract 25, evaluator-configuration 14, and none elsewhere.
- Non-ASCII in the twelve documents: 37 characters, 35 em dashes and 2 ellipses.

### Previous story intelligence

- **Verify every count against the code before repeating it.** Story 1.4's Completion Notes state
  "16 arity entries"; the measured figure is 12. Story 1.4's own Dev Notes quote a stale byte count
  from Story 1.3 and say so. Story 1.3 miscounted twice. This is the most reliably repeated defect in
  this epic.
- Story 1.4's round-one review found three tests that passed for the wrong reason and two convention
  walks that checked less than they read, because they stopped at document roots. Any walk this story
  writes over a published document must descend to every depth, and must carry an aggregate assertion
  proving it descended.
- Coverage is not measured: `@vitest/coverage-v8` is not installed and AD-30's 90 percent floor binds
  at Epic 6. Enumerated fixtures are the substitute, which is why AC 9's unreachable-keyword report is
  not optional.
- `noUncheckedIndexedAccess` is on, so `errors[0]` is possibly-undefined. `noExplicitAny` is off only
  under `tests/**`. `noFocusedTests` is an error, so a stray `it.only` fails lint.
- Fixtures on disk stay pure ASCII with non-ASCII written as `\uXXXX`. `biome.json`'s existing
  `!tests/fixtures/*.json` exclusion is non-recursive.

### Testing requirements

Per AD-30: `core/` is tested only with in-memory fixtures and faked ports, and no test performs
filesystem I/O outside a temporary directory. Three of the four checks are pure and live in Vitest.
The drift check reads committed files and therefore lives in a script, which is the whole reason for
the split.

Every published constraint has its single-mutation negative fixture, and every conditional branch has
a positive case. The mutation check is the mechanical audit of exactly that claim, which is why its
survivor list is a failure rather than a report, once the structurally unkillable occurrences AC 8
exempts by rule are accounted for.

### References

- [Source: ARCHITECTURE-SPINE.md#AD-13] the four checks, output mode, `$id` synthesis, the
  constraint-injection table, the arity exception, the per-constraint proof rule, the formatter
  exclusion
- [Source: ARCHITECTURE-SPINE.md#AD-5] the twenty-code table this story binds `FAILURE_CODES` to
- [Source: ARCHITECTURE-SPINE.md#AD-1] `core/` is pure; the builder does no I/O
- [Source: ARCHITECTURE-SPINE.md#AD-25] the SPDX allowlist the ajv subtree clears
- [Source: ARCHITECTURE-SPINE.md#AD-30] the test strategy, the filesystem rule, the fixture corpora
- [Source: ARCHITECTURE-SPINE.md#AD-36] the numeric value domain the differential generator respects
- [Source: ARCHITECTURE-SPINE.md#Consistency-Conventions] strictness, the `JsonValue` exception,
  Draft 2020-12
- [Source: ARCHITECTURE-SPINE.md#Structural-Seed] `schemas/` generated, committed, formatter-excluded,
  drift- and rejection-checked; runtime dependencies are Zod alone
- [Source: ARCHITECTURE-SPINE.md#Stack] the pins, the age window, the npm assertion
- [Source: EPIC-BRIEF.md#Epic-1] done-when, and the standing prohibition on a hand-maintained
  failure-code enumeration
- [Source: epics.md#Story-1.5] the acceptance criteria of record

## Decisions taken during story creation

Each is settled with a stated default and its downstream consequence. Proceed unless the user amends
one; record the outcome in the Dev Agent Record.

1. **A third-party validator is added, and it is `ajv@8.20.0`.** The differential check compares Zod
   acceptance against published-schema acceptance; a validator written here would be co-designed with
   the generator and would agree with it by construction, which is exactly the independence AD-13
   exists to buy. Ajv is the only mature Draft 2020-12 validator whose whole subtree clears AD-25's
   allowlist, and it earned its place before it was chosen by independently reporting the arity
   defect. `@cfworker/json-schema@4.1.1` was the runner-up: MIT, zero dependencies, 2020-12, and
   therefore a smaller supply-chain footprint, but it has no strict mode, so the arity defect would
   have gone unreported and one of this story's two most useful signals would not exist.
   **Consequence:** five development-dependency lock entries, exact-pinned, and the licence scan and
   age audit must be re-run after the install.
2. **The four checks are not four scripts.** Three are pure and run in Vitest; only the byte-exact
   drift check reads the filesystem and lives in a script. Splitting on purity rather than on the
   number four keeps AD-30's filesystem rule intact and gives the three expensive checks Vitest's
   reporting. **Consequence:** `pr-checks.yml` gains one named step for the script side, and the
   Vitest side arrives through the existing `npm run test`, including on the Node 22.20.0 floor job.
3. **`$id` is `urn:eval-quality:schema:{key}`.** A URN is an identifier rather than a locator, which
   is honest: every document is self-contained with only local `#/$defs/...` references, so the base
   never needs to resolve. An `https://` form would promise a retrievable document at a URL nothing
   serves, and pinning it to a branch would make it mutable. The version is deliberately absent from
   the identifier because `schemaVersion` is an in-band integer field rather than a per-artifact
   constant, so there is no version for the generator to read; AD-11's additive-bump discipline keeps
   the identifier stable across bumps. Verified that ajv accepts it. **Consequence:** if Story 6.5
   later publishes the schemas at a real URL, the `$id` changes and the drift check catches it, which
   is the correct place for that decision.
4. **The AD-5 registry lands as a codes-only module with a parse check, not as a schema
   enumeration.** No published artifact carries a failure-code enumeration today, so a literal
   reading of the AC is vacuous; deferring the whole thing to Story 4.2 means twenty codes get
   transcribed by hand at the exact moment the epic's standing prohibition says they must not be.
   `FAILURE_CODES` plus a spine-table parse check makes the prohibition mechanical now, costs one
   twenty-line module, and gives Story 4.2 something to build on instead of something to transcribe.
   The alternative considered and rejected was generating the module's TypeScript source from the
   table and drift-checking its bytes: Biome would then format a generated source file and fight the
   byte comparison, which is precisely the collision AD-13 keeps `schemas/` out of the formatter to
   avoid. **Consequence:** Story 4.2 imports `FAILURE_CODES` and writes no second list, and the first
   schema to need the enumeration writes `z.enum(FAILURE_CODES)`.
5. **The mutant corpus is generated, not hand-written, and one corpus serves two checks.** The
   measured kill rate of the hand-written corpus is about one keyword in ten, so a hand-written route
   would mean roughly 1,800 new fixtures. A schema-directed generator makes the mutation check's
   claim true by construction for every keyword it can reach, and its reachability report is what
   turns "every constraint has a fixture" into a statement with a failure mode. The same corpus is
   the differential check's generated input, which is what AD-13 means by "generated inputs".
   **Consequence:** the generator is itself code that can be wrong, so it carries hand-checked tests
   of its own, and the unreachable list is a gate rather than a note. The exemption for structurally
   unkillable keywords is computed by rule and asserted by equality, so it cannot widen into a hole:
   168 of the 1,949 occurrences qualify today under AC 8's seven rules; the 65 covered by its first
   four sit inside the `JsonValue` universal acceptor, a vacuous `propertyNames`, the always-true
   `format`, or a bare `$ref` to `JsonValue`.
6. **`ajv-formats` is not added, and `date-time` is registered as always-true.** Its `date-time`
   accepts numeric offsets while `z.iso.datetime()` rejects them, so adding it would manufacture a
   differential disagreement out of a keyword JSON Schema treats as an annotation by default. The
   constraint is carried by the exported `pattern`, which was verified to reject the offset spelling.
   **Consequence:** one fewer dependency, and the rejection suite asserts `pattern` rather than
   `format` for every date field.
7. **`strictTypes` is off and `strict` stays on.** The `minProperties` injection at a nullable union
   root is correct JSON Schema and trips only ajv's type-style opinion. `strictTuples`, which caught
   the real defect, is a separate flag. **Consequence:** the option set is recorded in one place with
   a comment per flag, so a future author does not silence a genuine finding by widening the wrong
   one.
8. **`package.json` gains no `files` entry and no `exports` subpath for `schemas/`.** AD-14's tarball
   surface, including the schema subpath and the conformance-suite subpath, is one decision and it
   belongs to Story 6.5. Half-declaring it now, with `files` but no `exports`, ships bytes nothing
   can address. Publication is blocked by the AD-18 guard in any case. **Consequence:** Story 6.5
   adds `schemas` to `files` and the `./schemas/*` export together.
9. **`biome.json` excludes `schemas` and not `corpus`.** The spine names both, and `corpus/` does not
   exist; an exclusion for a directory no story has created is a line nobody can verify. **Consequence:**
   the story that creates `corpus/` adds its exclusion in the same change.
10. **The drift check has no `--write`.** Regeneration is a separate, explicitly named script. A gate
    that can silently repair what it is checking is not a gate, which is the lesson this repository
    already paid for twice in its supply-chain controls.

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5)

### Debug Log References

None retained; the two empirical detours are recorded in Completion Notes items 3 and 4.

### Completion Notes List

1. All counts below were measured against the code on 2026-08-20, per the previous-story rule.
   Ledger: 28 entries, 13 inject (twelve `operator-arity-*` plus
   `binding-channel-non-empty`), 15 not-expressible. Reject corpus: 44 + 68 = 112, all
   annotated with validator-derived `keyword` and `instancePath` pairs. Keyword census: 1,949
   mutable occurrences, matching AC 8's total and every per-document and per-keyword figure.
   Suite: 799 tests in 21 files before, 1,108 in 27 files after.
2. The four checks land as Decision 2 states: the rejection suite
   (`tests/schemas/published/published-rejection.test.ts`), the differential
   (`differential.test.ts`, zero disagreements over 2,622 corpus members), and the mutation sweep
   (`keyword-mutation.test.ts`) in Vitest; the byte-exact drift check in `scripts/check-schemas.ts`
   with no `--write`. `generate:schemas`, `check:schemas`, and `check:ad5-registry` are npm
   scripts; `validate` appends `check:schemas` and `check:ad5-registry` between `check:vectors`
   and `test`; `pr-checks.yml` gains two named steps.
3. **The exempt set measured 168, not the 65 AC 8 first predicted, and the exemption rule gained
   three computed clauses, settled by construction per the standing decision rule and written back
   into AC 8 during the second review round.** The 65 under the
   four written rules reproduce exactly. On top of them: (a) 87 `type` occurrences beside a
   `const` or `enum` whose members are all of the stated type - Zod exports `z.literal('x')` as
   `{"type":"string","const":"x"}` and `z.enum` likewise, and any instance the `type` rejects is
   already rejected by the sibling, so the deletion can change no verdict; (b) 2 occurrences
   inside a vacuous nullable value container (`responseBody`'s bare `anyOf` over
   `{$ref JsonValue}` and null admits every instance), which is AC 8's own "reached only through
   a $ref to it" clause, computed; (c) 14 occurrences inside the clean-control probe branch's
   `defects` item schema, dead code under that branch's `maxItems: 0`. All three are derived from
   the document in `tests/schemas/published/keyword-occurrences.ts`, never hand-listed, and the
   three-way equality (survivors == unreachable == exempt) holds for all twelve documents.
4. Two empirical facts the checks had to absorb: ajv reports `schemaPath` relative to the
   enclosing `$defs` resource, not the document root, so occurrence matching aligns def-relative
   suffixes (`pointerMatchesSchemaPath`); and deleting either injected arity keyword leaves a
   tuple ajv's strictTuples refuses to compile, so those 24 deletions are counted separately as
   uncompilable per AC 8 - their fixtures are asserted through the explicit thirteen-entry
   ledger-pairing test instead, which covers every injected keyword at its stated address.
5. The generated corpus: 2,248 mutants plus 243 accepted witnesses (valid instances synthesised
   for union branches and empty containers no fixture populates, needed because deleting
   `prefixItems` beside `items: false` narrows the schema and only an accepted member can flip on
   it). One special pairing: the boolean `oneOf` discriminator (`Probe.expectedClean`) admits no
   rejected single-violation mutant - the flipped boolean is the sibling branch's discriminator -
   so its pair is a flip witness accepted intact and verified rejected once the const is deleted.
6. The probe fixture flip works because the clean branch's `defects` carries `max(0)` while the
   seeded branch's does not; nothing else in this story depended on branch asymmetry.
7. `ajv@8.20.0` added exact-pinned as the one new development dependency; five lockfile entries
   (ajv, fast-uri, fast-deep-equal, require-from-string, json-schema-traverse); licence scan and
   lockfile-age audit re-run green (160 entries).
8. The committed `schemas/` files measure, post-injection and post-escaping: eval-contract 85,348
   bytes, evidence-artifact 50,384, sealed-run-record 38,112, probe 14,462, isolation-manifest
   12,587, sealed-evaluator-brief 10,530, evaluator-configuration 8,220, rubric 5,936,
   private-artifact-manifest 5,146, preflight-verdict 4,609, scoring-policy 4,039,
   artifact-reference 2,429. All pure ASCII; `wc -c` and `Buffer.byteLength` agree by
   construction.
9. Decisions 1-10 taken as written; no schema changed; `src/index.ts` untouched; `experiments/`
   untouched; no `.npmrc` change; the worked-example corpus untouched.
10. Adversarial review round, all fourteen patch findings applied: injection sites deduped by
    object identity (structuredClone preserves internal aliasing, so the clone comment was
    corrected too) and the previously unreachable union-root fallback driven by three fabricated
    tests; every ajv construction now spreads the one `VALIDATOR_OPTIONS` set; the sweep's
    expected-uncompilable pointers and the pairing test's `addressPointer` are derived from each
    entry's stated address with loud throws on unresolvable shapes; `pointerMatchesSchemaPath`
    percent-decodes ajv's fragment and refuses a def-relative reading whose path also resolves at
    the document root, with the residual same-suffix-across-defs slack documented; witness
    dedup marks only on acceptance; the JSON-clean assertion uses `toStrictEqual` so an
    `undefined`-valued property cannot pass; `check-ad5-registry.ts` anchors its headings at line
    starts, fails on any table row that does not parse as a code row, and reports an unreadable
    spine exactly; `check-schemas.ts` flags anything in `schemas/` the registry does not name and
    distinguishes non-ENOENT readdir errors; `generate-schemas.ts` removes orphan
    `*.schema.json` files a removed registry key would strand; the serialiser gained thirteen
    pure unit tests independent of the drift check (ASCII-only, exactly one trailing newline,
    lossless parse round trip, and the `\u2014` escape provably present in eval-contract);
    `synthesize` documents its unhandled keywords and their failure mode; the tripwire counts
    (112 = 44 + 68, 13/15, 20) carry cross-references at every pin site; and all three
    type-stripped scripts state the no-enum/namespace/parameter-property constraint. Suite after
    the round: 1,124 tests in 27 files, `npm run validate` green.
11. **Second independent review round (four layers: blind hunter, edge-case hunter,
    verification-gap, acceptance auditor), two decisions resolved and all twenty-two patch findings
    applied.** The one high-severity finding was that AC 8's census was pinned only by a floor
    (`total > 1900` against 1,949, `> 15` per artifact against a real 21 to 668), so a narrowed walk
    passed green: deleting `propertyNames` from the walk's descent list dropped the sweep to 1,921
    occurrences with all 923 `tests/schemas/` tests still passing, because the keyword-set equality
    still held and the three-way survivors/unreachable/exempt equality simply recomputed against the
    smaller set. The census is now pinned exactly, per document and per keyword, and the sweep
    asserts it swept the whole document; the same narrowing now fails with the per-document map
    named. The `$defs` naming walk is pinned per document for the same reason (a floor of ten
    against a real fifteen).

    The other twenty-one: named canary jobs for both new gates, proving `check:schemas` blocks a
    mutated byte and an orphan file and that `generate:schemas` is a fixed point, and that
    `check:ad5-registry` blocks a dropped code and a transposition (the latter reaches only the
    order comparison, since set equality survives a transposition); the two type-stripped scripts
    added to the Node 22.20.0 floor job, which ran neither and so left the declared engines floor
    unproven for exactly the files that depend on it; explicit budgets on the tests that pay for
    cold-cache eval-contract generation, which were the only ones left on Vitest's 5 s default;
    `check:schemas` now skips dot-prefixed entries (a gitignored `.DS_Store` wedged
    `npm run validate` on darwin, and `generate:schemas`, the repair every message names, could not
    clear it) and separates "unexpected entry" from "drifted or missing"; AC 8's exemption rule
    amended from four clauses and 65 to the seven clauses and 168 the code implements; the
    thirteenth inject entry corrected to `binding-channel-non-empty` in AC 2 and note 1; nine
    parent-reporting reject cases gained `errorParams`, and every case now cross-checks its ajv
    instance path against its Zod issue path; the ledger-pairing test looks its witness up by
    occurrence pointer and pins the instance path, which is the guard
    `pointerMatchesSchemaPath`'s own comment claimed at every call site; `injectConstraint` throws
    on a discriminator matching more than one branch, driven by a fabricated document;
    `generate-schemas.ts` builds removal paths with `fileURLToPath` plus `join` and skips
    non-files; both scripts guard the builder so an unresolved ledger address prints as the gate's
    diagnosis rather than a Node stack; the AD-5 parser skips fenced blocks, reads tables by
    position rather than by the literal column name, and refuses a second table in the section; the
    dated spine workspace is cross-checked against `package.json`'s `lint:spine`; the numeric
    synthesiser reports FAIL rather than clamping below its own lower bound; `compileDocument` lost
    a parameter no caller passed; `biome.json`'s schema pin, the README development section, and
    the workflow's validate step label were brought up to date; and the twenty-five-positive
    enumeration now also pins its nineteen distinct instances. One finding was deferred (the mutant
    corpus is rebuilt once per test file) and seven were dismissed with evidence, including the
    tarball surface (Decision 8), the `$ref` and `definitions` census exclusions (both named in AC
    8's own definition of "mutable"), and a `structuredClone` aliasing concern in the sweep (zero
    aliased nodes measured across all twelve documents).

### File List

- `src/core/schemas/publish.ts` (new): the pure builder, the ledger injection, the serialiser.
- `src/core/failure-codes.ts` (new): the twenty AD-5 codes as a tuple.
- `scripts/generate-schemas.ts` (new), `scripts/check-schemas.ts` (new),
  `scripts/check-ad5-registry.ts` (new).
- `schemas/*.schema.json` (new, twelve files, generated and committed).
- `tests/schemas/publish.test.ts`, `tests/schemas/failure-codes.test.ts` (new).
- `tests/schemas/published/validator.ts`, `keyword-occurrences.ts`, `mutant-generator.ts`,
  `corpus.ts` (new helpers); `published-rejection.test.ts`, `differential.test.ts`,
  `keyword-mutation.test.ts`, `mutant-generator.test.ts` (new tests).
- `tests/schemas/fixtures/reject-cases.ts`, `tests/schemas/fixtures/artifact-reject-cases.ts`
  (modified: the two new required fields on all 112 cases).
- `package.json` (scripts, ajv devDependency), `package-lock.json`, `biome.json` (`!schemas`),
  `tsconfig.json` (`scripts` in include), `.github/workflows/pr-checks.yml` (two named steps).
- `_bmad-output/project-knowledge/learning-path-step-by-step.md` (Step 5),
  `_bmad-output/implementation-artifacts/sprint-status.yaml` (1-5 to review).

**Unrelated working-tree changes, declared.** Three edits in the same working tree belong to
requests made outside this story, and are recorded here rather than reverted so the diff has no
undeclared content: `README.md` (a mermaid diagram replacing the bare `TEA -> eval-quality` arrow a
reader had flagged as unclear, plus a `/de-ai` prose pass; the Development section was then updated
by this story's review round to name `schemas/` and the three new scripts), the same `/de-ai` pass
over Steps 1, 2 and 4 of `learning-path-step-by-step.md`, and cosmetic blank-line placement of the
`epic-2` through `epic-6` markers in `sprint-status.yaml` from story creation. `sprint-status.yaml`
also moves story 1-4 from `review` to `done`, which is ordinary tracking: 1.4 merged at this story's
baseline commit.

## Change Log

- 2026-08-20: Second independent code review (four layers), run in a fresh session against the
  working tree. One high finding, five medium, sixteen low; all twenty-two patched, one deferred,
  seven dismissed with evidence, and both decision-needed items resolved (unrelated working-tree
  edits declared rather than reverted; the `done`/`review` split left as designed). The high one:
  the keyword census was floored rather than pinned, so a narrowed walk passed green. `npm run
  validate` green after the round.
- 2026-08-20: Implemented. All twelve ACs land; `npm run validate` green (1,108 tests in 27
  files). The exempt set re-derived at 168 with three computed extensions to AC 8's rule,
  recorded in Completion Notes item 3 rather than escalated.
- 2026-08-20: Adversarial review of the implementation, fourteen patch findings, all applied
  (Completion Notes item 10); two findings rejected by the reviewer as out of scope (tarball
  `files` is Story 6.5's per Decision 8, and test-only floor coverage is accepted). 1,124 tests
  in 27 files, `npm run validate` green.

- 2026-08-20: Adversarial review round 1, fresh context against the working tree. One blocking
  finding, three major, three minor; all addressed, none deferred. Blocking: about three percent of
  the published keyword occurrences are structurally unkillable, almost all of them inside the
  `JsonValue` universal acceptor, so check four as written could never go green; AC 8 now defines the
  exemption by computed rule and asserts both the survivor list and the generator's unreachable list
  equal to it. Also: `properties` was missing from AC 8's exclusion list, which put the stated
  definition 133 occurrences away from the census it quotes; the AC of record's "`$defs` keys named
  via `.meta({ id })`" clause had no home and now carries its own assertion; the per-file sizes were
  UTF-16 code-unit counts labelled as bytes, wrong by 72 and 2 on the two documents carrying
  non-ASCII, which in a story whose AC 6 is byte-exact would have sent the dev chasing a phantom
  drift. The kill rates and ajv timings are relabelled indicative, `failure-codes.ts` moves out of
  `core/schemas/` since it is not a Zod definition, the thirteen injected ledger entries each gain an
  explicit paired-fixture assertion, and AC 2 records that the ledger test resolves in input mode
  while the generator exports in output mode.
- 2026-08-20: Story created. The published export, its four checks, and ten decisions settled by
  construction, including a third-party validator, a generated mutant corpus sized against a measured
  1,949-keyword census and a measured one-in-ten kill rate for the hand-written corpus, and the AD-5
  code registry bound to its spine table by a parse check.

## Suggested Review Order

**The pure builder and ledger injection**

- Entry point: one pure function per artifact key; `$id` synthesis and key order live here
  [`publish.ts:150`](../../src/core/schemas/publish.ts#L150)

- Ledger-addressed injection with loud failure on any unresolved segment; dialect asserted before writing
  [`publish.ts:61`](../../src/core/schemas/publish.ts#L61)

- The byte contract: 2-space indent, one trailing newline, `\uXXXX` escapes to pure ASCII
  [`publish.ts:191`](../../src/core/schemas/publish.ts#L191)

**The committed export and its drift gate**

- Thin I/O wrapper; removes orphan files a deleted registry key would strand
  [`generate-schemas.ts:1`](../../scripts/generate-schemas.ts#L1)

- Byte-exact comparison, first differing offset reported; no `--write` by design
  [`check-schemas.ts:1`](../../scripts/check-schemas.ts#L1)

- Largest generated document; spot-check `$id`, injected `minItems`/`items`, ASCII escapes
  [`eval-contract.schema.json:1`](../../schemas/eval-contract.schema.json#L1)

**The AD-5 failure-code registry**

- Twenty codes as a `readonly` tuple; the single source every later consumer imports
  [`failure-codes.ts:19`](../../src/core/failure-codes.ts#L19)

- Spine-table parse with anchored headings; every unparsed pipe row fails the gate
  [`check-ad5-registry.ts:40`](../../scripts/check-ad5-registry.ts#L40)

**Validator and corpus infrastructure**

- The one option set, each flag with its recorded reason; all checks flow from it
  [`validator.ts:35`](../../tests/schemas/published/validator.ts#L35)

- Keyword census walk reproducing the story's 1,949 count; exclusion list is load-bearing
  [`keyword-occurrences.ts:98`](../../tests/schemas/published/keyword-occurrences.ts#L98)

- Computed exempt set for structurally unkillable occurrences; equality asserted, never hand-listed
  [`keyword-occurrences.ts:197`](../../tests/schemas/published/keyword-occurrences.ts#L197)

- Deterministic schema-directed mutant generator; seeds from every fixture, no randomness
  [`mutant-generator.ts:143`](../../tests/schemas/published/mutant-generator.ts#L143)

- One corpus serving checks three and four; 2,622 members per artifact assembly
  [`corpus.ts:96`](../../tests/schemas/published/corpus.ts#L96)

**The four checks**

- Check one: 112 reject cases asserted by keyword and instance path, containment not single-error
  [`published-rejection.test.ts:52`](../../tests/schemas/published/published-rejection.test.ts#L52)

- Check three: zero Zod-vs-ajv disagreements over the generated corpus
  [`differential.test.ts:60`](../../tests/schemas/published/differential.test.ts#L60)

- Each of the thirteen injected entries paired with its own asserted fixture (AD-13)
  [`differential.test.ts:118`](../../tests/schemas/published/differential.test.ts#L118)

- Check four: delete each keyword, require a verdict change; survivors equal the exempt set
  [`keyword-mutation.test.ts:137`](../../tests/schemas/published/keyword-mutation.test.ts#L137)

- Serialization asserted independently of the drift check, escape branch provably exercised
  [`publish.test.ts:162`](../../tests/schemas/publish.test.ts#L162)

- The union-root fallback driven with a fabricated document, aliasing dedupe included
  [`publish.test.ts:356`](../../tests/schemas/publish.test.ts#L356)

**Peripherals**

- `RejectCase` gains required `keyword` and `instancePath`; all 112 annotations validator-derived
  [`reject-cases.ts:21`](../../tests/schemas/fixtures/reject-cases.ts#L21)

- Two named CI steps so a red build says which gate failed
  [`pr-checks.yml:38`](../../.github/workflows/pr-checks.yml#L38)

- New scripts, `validate` appended not reshuffled, `ajv@8.20.0` exact-pinned
  [`package.json:65`](../../package.json#L65)

- `!schemas` formatter exclusion; `scripts` added to typecheck include
  [`biome.json:1`](../../biome.json#L1)
