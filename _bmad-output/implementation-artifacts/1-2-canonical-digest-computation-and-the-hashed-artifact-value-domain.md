---
baseline_commit: 9f27301
---

# Story 1.2: Canonical digest computation and the hashed-artifact value domain

Status: review

## Story

As an adopter integrating eval-quality artifacts into CI,
I want one canonical digest computation with an explicitly restricted numeric value domain,
so that two independent implementations never compute different digests from identical inputs and a non-TypeScript producer is told the rules rather than discovering them through a mismatch.

## Acceptance Criteria

1. **One canonicalizer, written in this repository.** An RFC 8785 (JCS) canonical JSON serializer lives under `src/core/`, written in-house with zero new dependencies (AD-27 forbids depending on an unaudited JCS implementation; AD-25's allowlist and the pin discipline make "just add a package" a violation, not a shortcut). The two rules implementers get wrong are fixed exactly as the spine states them: numbers serialize per ECMAScript `Number.prototype.toString` (shortest round-trip form, `-0` rendering as `0`, exponent form where ECMAScript produces it — note that for valid hashed artifacts only the small-magnitude exponent branch is reachable, |n| < 1e-6 down to `5e-324`, because every binary64 value ≥ 2^53 is integer-valued and therefore outside AD-36's safe-integer domain; the ≥ 1e21 rendering branch is dead code for conformant artifacts), and object keys sort by UTF-16 code unit, never by code point, never locale- or normalization-aware. Output is UTF-8 bytes with no insignificant whitespace; array order is preserved; strings serialize with JSON.stringify's escaping semantics.
2. **Artifact digests.** The digest of any JSON artifact is SHA-256 over its RFC 8785 canonical serialization, rendered as the literal string `sha256:` followed by exactly 64 lowercase hexadecimal characters. No artifact ever carries its own digest — digests live only in referring artifacts (the Artifact Reference schema arrives in Story 1.4), so the implementation has no self-exclusion rule.
3. **Composite, bytes, and directory digests.** A composite digest is SHA-256 over the canonical serialization of a domain-separated object carrying a fixed protocol tag and named fields — never a concatenation of member strings, never a mixed-type tuple. A digest over non-JSON bytes is SHA-256 over those bytes. A directory digest is a composite over its members ordered by path. The protocol tag value and composite object shape are settled by construction in this story and recorded in the Dev Agent Record plus the golden vectors, because a second implementation must reproduce them byte-for-byte.
4. **The AD-36 value domain is enforced before schema validation.** A hashed artifact admits only numbers that are finite IEEE 754 binary64 values, with integers additionally restricted to the safe-integer range (|n| ≤ 2^53 − 1); larger integers and values needing exact decimal semantics are carried as strings (the schema-side declared formats land with Stories 1.3–1.4; this story enforces the numeric domain and records the string-carriage convention). Lone surrogates and duplicate object keys are rejected **before** schema validation, which forces a lexical (raw-text) check layer distinct from value validation: `JSON.parse` silently keeps the last duplicate key and silently rounds `9007199254740993` to `9007199254740992`, so a post-parse check cannot see either violation. When input arrives as bytes, UTF-8 decoding is **fatal** (`TextDecoder('utf-8', { fatal: true })` or a byte-level scan): a non-fatal decode silently substitutes U+FFFD for invalid sequences (a Python producer's WTF-8-encoded lone surrogate becomes replacement characters and digests cleanly with no fault — the exact cross-language divergence AD-27 exists to prevent). Every domain violation throws the typed fault `non-canonicalizable-value` (AD-28's runtime fault registry — cite this literal code) carrying the machine code and the artifact path that produced it; input that does not parse at all (malformed JSON syntax, or bytes that fail fatal UTF-8 decoding) throws `schema-parse-failure`, AD-28's code for "an artifact does not parse" — both codes now have genuine throwers in this story, and no other code is minted.
5. **Cross-language canonicalization vectors pass in CI.** Positive and negative vectors are committed as language-neutral fixture files a non-TypeScript implementer can consume, and the Vitest suite runs them (CI already runs `npm test` inside `npm run validate` on both the Node 24 and the 22.20.0 floor jobs — no workflow edits are needed or wanted in this story). Positive vectors include the repository's own decimals `0.95`, `0.99`, `0.8`, `0.04`, `62.5` with their exact canonical bytes and digests, plus `1.0` (also in the repository's own artifacts, and the one whose canonical spelling changes: `1.0` → `1`); negative vectors include the integer literal `9007199254740993` (proving raw-text detection), `9007199254740992` (2^53 exactly — round-trips lexically, so it uniquely proves the bound is > 2^53 − 1 rather than "detect rounding"), a duplicate-key document, a lone-surrogate string, an overflow literal such as `1e999` (valid JSON syntax, parses to `Infinity`, must reject), and a value ≥ 1e21 (integer-valued in binary64, hence outside the safe-integer domain). Composite-digest golden vectors are included per AD-30. Every expected canonical byte sequence and digest in the fixtures is **independently derived** (RFC 8785 Appendix data, hand-derivation, or a committed second-language derivation script) and frozen — never produced by the implementation under test. Key-order invariance is proven: one object built in two insertion orders canonicalizes to identical bytes and one digest.
6. **Purity and structure hold.** All new runtime code lives under `src/core/`, is pure and deterministic, imports nothing outside `core/` per the dependency-direction rules, and touches no filesystem, network, clock, or randomness. `node:crypto` is the single permitted builtin (AD-1: digesting is deterministic and there is deliberately no digest port — do not create one). `npm run validate` (typecheck, lint, check:docs, lint:spine, test) and `npm run build` pass on Node 24, and the PR goes green on all eight existing checks (gitleaks, Node 24 validate+build, Node 22.20.0 floor, the four canaries, and the PR Gate status from `pr-gate.yml`).

## Tasks / Subtasks

- [x] Task 1: Scaffold `src/core/` and the typed fault (AC: 4, 6)
  - [x] Create `src/core/schemas/faults.ts` defining the typed fault shape of the Errors convention: a thrown error class carrying a stable machine `code` and the `artifactPath` that produced it. Define the two codes this story genuinely throws: `non-canonicalizable-value` (the four value-domain violations) and `schema-parse-failure` (input that does not parse — malformed JSON syntax or a fatal UTF-8 decode failure). Do NOT pre-populate the other AD-28 codes; a registry entry with no thrower is dead vocabulary. Later AD-28 fault work extends this table — but AD-5's compile-time code registry (Story 4.2) is a **separate, disjoint registry** per the Errors convention ("two disjoint kinds, never merged"; AD-28: "neither becomes the other's dumping ground"): the shared thing is at most the typed-error base shape (code + artifactPath), never one code table
  - [x] Place the fault in `core/schemas/` deliberately: `ports/` imports `core/schemas` only (`adapters/` imports `ports/` and `core/schemas`), and AD-28 requires ports to throw these same typed faults, so any location deeper in `core/` would force an import-rule violation later. Record this placement decision in the Dev Agent Record
  - [x] Use `.ts` extensions on relative imports (the repo compiles with `allowImportingTsExtensions` + `rewriteRelativeImportExtensions`; `tests/index.test.ts` shows the pattern)
- [x] Task 2: Lexical pre-parse validation of raw JSON text (AC: 4)
  - [x] When input arrives as bytes, decode with `TextDecoder('utf-8', { fatal: true })` (or scan at byte level) and throw `schema-parse-failure` on a decode failure — a non-fatal decode replaces invalid sequences (including a producer's WTF-8-encoded lone surrogate) with U+FFFD and digests the corrupted text cleanly, the silent cross-language divergence this whole story exists to prevent
  - [x] Write a minimal recursive-descent JSON scanner (pure, zero-dependency) over the decoded text. Malformed JSON syntax throws `schema-parse-failure`. Domain violations throw `non-canonicalizable-value`: duplicate keys within one object (compare **unescaped** key strings — `{"A":1,"A":2}` is a duplicate), lone-surrogate escapes without a valid pair (in string values AND object keys), integer-syntax literals (no fraction, no exponent, after sign) whose value exceeds the safe-integer range (compare the digits, e.g. `BigInt(literal) > 2n ** 53n - 1n` — BigInt in the scanner is fine, it is not a hashed value), and any numeric literal whose parsed value is non-finite (e.g. `1e999`)
  - [x] Decide and record the disposition of integer-valued non-integer-syntax literals (`9007199254740993.0`, `9.007199254740993e15`): the safe rule is that any literal whose binary64 value is an unsafe integer is rejected regardless of spelling, since two producers must not disagree; record the choice and cover it with a vector either way
  - [x] The scanner returns the parsed value on success so validation and parsing are one pass; callers holding raw bytes never call bare `JSON.parse` for hashed artifacts
- [x] Task 3: In-memory value-domain validation (AC: 4)
  - [x] Validate an in-memory JS value (an artifact produced in-process has no raw text): reject non-finite numbers, numbers that are integers outside the safe range (`Number.isInteger(n) && !Number.isSafeInteger(n)` — values like 2^53 + 2 are representable and must be caught), and unpaired surrogate code units in string values AND object keys. Duplicate keys cannot exist in-memory; that check belongs to the lexical layer only
  - [x] Reject non-plain objects: any object whose prototype is not `Object.prototype` or `null`, or that carries a `toJSON` method (`Date`, `Map`, `Set`, class instances — a hand-rolled recursive serializer renders a `Date` as `{}`, a silent coercion two implementations will disagree on), and detect cycles — all throwing `non-canonicalizable-value`
  - [x] Both layers throw the same `non-canonicalizable-value` fault with the artifact path
- [x] Task 4: The RFC 8785 canonicalizer (AC: 1, 6)
  - [x] Implement canonicalization recursively: `null`/`true`/`false` as literals, numbers via ECMAScript number-to-string (native `JSON.stringify`/`String` semantics — do not hand-roll Ryū), strings via `JSON.stringify` escaping, arrays in order, objects with keys sorted by UTF-16 code unit (plain `<`/`sort()` on JS strings IS code-unit order — never `localeCompare`, never `Intl`, never `.normalize()`), no whitespace, result encoded to UTF-8 bytes. Call `JSON.stringify` only on individual numbers and strings, never on a whole value — whole-value stringify drops `undefined` properties, honours `toJSON`, and does not sort keys
  - [x] The canonicalizer validates its input's value domain (Task 3) before serializing, and defensively throws `non-canonicalizable-value` on anything unrepresentable it meets (`undefined`, functions, `bigint`, symbols, lone surrogates) rather than silently coercing — silent coercion is exactly the two-implementations-disagree failure AD-27 exists to prevent
- [x] Task 5: Digest computation (AC: 2, 3, 6)
  - [x] `digestArtifact(value, artifactPath)` → `sha256:` + 64 lowercase hex over the canonical UTF-8 bytes, via `node:crypto` `createHash('sha256')` (`digest('hex')` is already lowercase; assert the `sha256:` + 64-char form in tests anyway)
  - [x] `digestBytes(bytes: Uint8Array)` → same rendering over raw bytes (non-JSON artifacts)
  - [x] Composite digest: a function taking a fixed protocol tag and named member fields, building the domain-separated object, canonicalizing, hashing. Settle the tag shape by construction — e.g. `{ "protocol": "eval-quality/composite/v1", ...named fields }` — and record the exact chosen tag string and object shape in the Dev Agent Record and the golden vectors
  - [x] Directory digest: a composite taking `Record<path, digest>` — each member's value is that entry's `sha256:` digest string (the only workable choice; `core/` cannot read files). Canonical key sorting orders members by path automatically, but note and record: "ordered by path" therefore means UTF-16 code-unit order, which disagrees with the UTF-8 byte order git and `sort` produce for supplementary-plane characters — the golden directory vector should include a path pair that discriminates (e.g. one containing `דּ`, one containing `😀`)
  - [x] Do not add a digest port, a digest field on any artifact, or an exclusion rule; do not expand the `src/index.ts` public barrel (the published library surface is Epic 6's, AD-14/AD-34 — tests import from `src/core/` paths directly)
- [x] Task 6: Cross-language vectors and tests (AC: 5)
  - [x] Commit vectors as language-neutral fixture data under `tests/fixtures/` (new directory; settle exact layout and record it). Each positive vector carries input, expected canonical text (human-readable), the expected canonical bytes **as lowercase hex** (`expectedCanonicalHex` — the field tests compare against; comparing JS strings happens before UTF-8 encoding and would hide encoding bugs, and the digest assertion alone only covers vectors that assert a digest), and expected digest. Each negative text vector carries the raw input **as an escaped JSON string field** (a document with duplicate keys cannot itself round-trip through `JSON.parse`, and separate raw files would need `?raw` imports or fs reads — keep everything importable as modules; `resolveJsonModule` is on) plus the expected fault code. Byte-level vectors (invalid UTF-8 for the fatal-decode rejection, `digestBytes` goldens) carry their input **as hex** (`inputHex`) — a JSON string field cannot hold invalid UTF-8; whatever escape is written decodes to valid text before the scanner sees it. Tests decode hex to `Uint8Array` and feed the bytes API. No filesystem reads at test runtime, keeping AD-30's in-memory rule
  - [x] **Expected values are independently derived, then frozen.** Computing a vector's expected canonical bytes or digest by running the new `src/core` implementation and pasting its output turns the golden vectors into snapshot tests: they prove the implementation agrees with itself, which is zero evidence against the two-implementations-diverge failure AD-27 exists to prevent. Derive expected values at authoring time from an independent source — RFC 8785 Appendix test data where it overlaps, hand-derivation plus `shasum -a 256` for simple vectors, or a throwaway ~30-line derivation script in a second language (Python's `json.dumps(sort_keys=True)` is NOT JCS-conformant; the script must implement the two AD-27 rules itself). Commit the derivation script beside the fixtures as documentation (it is not package code; AD-1 does not bind it). Regenerating expected values from `src/core` output is forbidden and the fixtures README says so
  - [x] Add `tests/fixtures/README.md`: the fixture schema (field meanings, hex encodings), the independence rule above, and the dead-branch note (the ≥ 1e21 exponent branch is unreachable for conformant artifacts) — the vectors are the published contract for non-TypeScript implementers per AD-27/AD-36, so they must be readable without the test suite
  - [x] If Biome fights any fixture formatting, extend `biome.json` `files.includes` with a targeted exclusion (the `!scripts/fixtures` pattern from Story 1.1 is the precedent) rather than hand-massaging fixtures
  - [x] Required vectors — positive: the five repository decimals plus `1.0` → `1` (exact canonical bytes and digests); `-0` → `0`; `1e-7` and `5e-324` (the only reachable exponent-rendering branch — see Dev Notes); `9007199254740991` (safe max, passes); key-order invariance (two insertion orders, one digest); empty object, empty array, empty string; a key-sorting vector that discriminates code-unit from code-point order — the pair must be a BMP key in U+E000–U+FFFF against a surrogate-pair key, e.g. `"דּ"` (דּ) vs `"😀"` from RFC 8785 §3.2.3 itself, asserting the code-unit order (`😀` first); a lower key like `"é"` sorts the same under both comparators and proves nothing
  - [x] Required vectors — negative (each asserting its fault code): `9007199254740993` (lexical, `JSON.parse` rounds it invisibly); `9007199254740992` (2^53 exactly — round-trips lexically, uniquely proves the bound is > 2^53 − 1); a value ≥ 1e21 (integer-valued, unsafe); literal duplicate keys AND the escaped form `{"A":1,"\u0041":2}` (proves comparison happens on unescaped keys); a lone-surrogate escape in a string value and one in an object key; invalid UTF-8 bytes (fatal-decode rejection, `schema-parse-failure`); malformed JSON syntax (`schema-parse-failure`); `1e999`
  - [x] Tests enumerate the fixture arrays programmatically (one parametrized test per vector entry), never cherry-pick named vectors — a committed vector that no test exercises is silently dead, the same fail-open shape as an unwired gate
  - [x] Determinism test: canonicalize and digest the same values twice and across permuted insertion orders, asserting byte-identical output (this is the story-appropriate analogue of NFR9's permutation family; the full observation-array family still binds nothing until Epics 2–3)
  - [x] Unit tests for every fault path asserting the fault's `code` is literally `non-canonicalizable-value` or `schema-parse-failure` (whichever that path owes) and the artifact path is carried — plus fault tests for the in-memory silent-coercion paths (`Date`, `Map`, `toJSON` carrier, cyclic object, `undefined`, `bigint`)
- [x] Task 7: Prove the gate (AC: 6)
  - [x] `npm run validate` and `npm run build` green locally on Node 24
  - [x] Open a PR to `main` (pr-checks triggers on `pull_request` only) and confirm all eight checks pass: gitleaks, Node 24 validate+build, Node 22.20.0 floor, and the four canaries (age, git, remote, licence). No workflow file should need to change in this story; if one does, stop and re-check the approach
  - [x] Record in the Dev Agent Record: the chosen composite protocol tag, module layout, integer-spelling disposition, the string-carriage convention for large integers and exact decimals (the schema-side declared formats consume it in Stories 1.3–1.4), the directory-path-order semantics (UTF-16 code-unit, not byte order), the syntax-fault disposition (`schema-parse-failure` for malformed input), and the exact digest values of the repository decimals

## Dev Notes

### Why this story exists, and why second

Every scoring version, sealed-set integrity check, lineage chain, and comparability key in this architecture is a digest (AD-8, AD-11, AD-12, AD-29). If two implementations compute different digests from identical inputs, every comparison is `incomparable`, every sealed set looks mutated, and the product's evidence chain is worthless — and the failure is verified, not hypothetical: `9007199254740993` parses in JavaScript as `9007199254740992`, so a conforming non-JS producer and a JS scorer silently disagree on the canonical bytes of one artifact (AD-36). This story lands before the schema stories because Stories 1.3–1.5 need the value-domain rules to express in Zod and the digest computation to reference; it is the first story that creates `src/core/`.

### Constraints and guardrails (architecture-binding)

- **AD-27:** digest = SHA-256 over RFC 8785 canonical JSON; `sha256:` + 64 lowercase hex; no artifact carries its own digest; composite digests are domain-separated tagged objects, never concatenations; bytes and directory forms as stated; canonicalizer written in-house; numbers per ECMAScript `Number.prototype.toString`; keys sorted by UTF-16 code unit; cross-language vectors are a required CI fixture. [Source: architecture/…/ARCHITECTURE-SPINE.md#AD-27]
- **AD-36:** numbers are finite binary64; integers within safe range; larger integers and exact decimals travel as strings with declared formats; lexical pre-parse checks are stated separately from value validation; lone surrogates and duplicate keys are rejected before schema validation; the restriction will be expressed in the published schema (Stories 1.3–1.5) so producers are told rather than burned. [Source: ARCHITECTURE-SPINE.md#AD-36]
- **AD-28 fault registry:** `non-canonicalizable-value` is thrown when "a hashed artifact carries a non-finite number, an unsafe integer, a lone surrogate, or a duplicate object key" — commanded by AD-36 and AD-27. Faults are thrown typed errors carrying a stable machine code and the artifact path; they are disjoint from AD-5's compile-time codes and from findings. Use this literal code; do not invent `invalid-number` or similar. [Source: ARCHITECTURE-SPINE.md#AD-28]
- **AD-1:** `core/` is pure; no fs/network/clock/subprocess/randomness; `node:crypto` is the one permitted builtin, precisely because digesting is deterministic; there is deliberately **no digest port** — do not add one. [Source: ARCHITECTURE-SPINE.md#AD-1]
- **Dependency direction:** `core/` imports `core/schemas` and nothing else; `ports/` imports `core/schemas` only — which is why the fault type must live in `core/schemas/`, since ports throw these faults under AD-28. [Source: ARCHITECTURE-SPINE.md#Invariants-&-Rules]
- **AD-30:** composite-digest and cross-language canonicalization golden vectors are required fixtures, "including the exact decimals this repository's own artifacts carry" — that is the origin of 0.95, 0.99, 0.8, 0.04, 62.5. Tests are in-memory; no fs I/O outside a temp dir. [Source: ARCHITECTURE-SPINE.md#AD-30]
- **Consistency Conventions:** every digest is the literal form `sha256:` + 64 lowercase hex "computed per AD-27 over the value domain of AD-36"; files are `kebab-case.ts`; JSON only, UTF-8. [Source: ARCHITECTURE-SPINE.md#Consistency-Conventions]
- **AD-25 / Stack:** zero new dependencies. The runtime graph is Zod alone and this story does not change that (it does not even need Zod). Any candidate JCS/canonicalize package is both unaudited (AD-27's stated reason) and a supply-chain event this repo's own gates would interrogate. Write it; it is ~60 lines.

### RFC 8785 mechanics the implementer must not rediscover

- **Numbers:** ECMAScript's native number-to-string IS the JCS algorithm (shortest round-trip, Ryū). `String(n)` / `JSON.stringify(n)` are conformant; do not hand-roll. Edge renderings to fixture: `-0` → `"0"`, `1e-7` → `"1e-7"`, `5e-324` → `"5e-324"`, `0.000001` → `"0.000001"` (the exponent threshold sits exactly below 1e-6), `9007199254740991` → itself. The large-exponent branch (`1e21` → `"1e+21"`) exists in the serializer but is unreachable for valid artifacts: every binary64 ≥ 2^53 is integer-valued (`Number.isInteger(1.5e300)` is `true`), so AD-36's safe-integer rule rejects the entire magnitude range ≥ 2^53 whatever its spelling — worth stating in the vector README so a non-TS implementer does not burn time round-tripping a branch no conformant artifact can exercise. NaN/Infinity are unreachable if the value domain ran first; throw the fault defensively anyway.
- **Key sort:** plain JS string comparison (`a < b`, default `Array.prototype.sort`) compares UTF-16 code units, which is exactly the required order. The trap is "improving" it: `localeCompare`, `Intl.Collator`, or comparing by code point all produce a different order for keys containing surrogate pairs vs BMP characters near the surrogate range. Sort the **unescaped** key strings.
- **Strings:** `JSON.stringify` escaping is conformant (`\"`, `\\`, `\b`, `\t`, `\n`, `\f`, `\r`, `\u00XX` for other control characters). Since ES2019 well-formed `JSON.stringify` escapes lone surrogates instead of emitting invalid UTF-8 — but a lone surrogate must have been rejected by the value domain before the canonicalizer ever sees it.
- **Structure:** no whitespace anywhere; arrays keep order; the canonical text is encoded to UTF-8 and the digest is over those bytes, not over a JS string.
- **Why `JSON.parse` cannot do the lexical layer:** it keeps the last duplicate key, accepts lone-surrogate escapes, and rounds unsafe integers — all three silently (`JSON.parse('-9007199254740993')` rounds too, so the sign handling matters). The raw-text scanner is not optional plumbing; it is the entire mechanism behind "rejected before schema validation".
- **Why decoding must be fatal:** a lone surrogate cannot exist in valid UTF-8; a producer that writes one emits WTF-8 bytes, and Node's default (non-fatal) decode replaces them with U+FFFD — the input is accepted, silently changed, and digested. `TextDecoder('utf-8', { fatal: true })` throws instead, which becomes `schema-parse-failure`.

### Decisions this story settles by construction (record each in the Dev Agent Record)

1. **Module layout under `src/core/`.** Suggested: `src/core/canonical/` holding `canonicalize.ts`, `digest.ts`, `value-domain.ts` (or `scan-json.ts` for the lexical layer), with the fault in `src/core/schemas/faults.ts`. The Structural Seed names no digest directory, so the layout is this story's to fix; whatever is chosen, later stories inherit it.
2. **The composite protocol tag.** Fixed string + object shape; must appear in the golden vectors so a second implementation can reproduce it.
3. **Integer-spelling disposition** for unsafe-integer values written with a fraction or exponent (see Task 2 — note the in-memory layer catches the value regardless of spelling, since the scanner hands its parsed value to the value-domain check).
4. **Fixture layout** under `tests/fixtures/`: escaped-string carriage for raw-text vectors, hex carriage for byte-level vectors, the `expectedCanonicalHex` comparison field, and the derivation source of every frozen expected value (recorded in the fixtures README).
5. **Syntax-fault disposition:** malformed JSON and fatal-decode failures throw `schema-parse-failure`, keeping `non-canonicalizable-value` strictly for AD-28's four enumerated domain violations.
6. **Directory path order:** "ordered by path" = JCS key order = UTF-16 code-unit order, which differs from UTF-8 byte order for supplementary-plane paths; the golden vector pins it.

These are the same class as Story 1.3's three Gate C coin flips: ambiguities that disappear the moment one implementation exists, provided the choice is recorded rather than implied.

### Previous story intelligence (Story 1.1)

- The toolchain is fully pinned and hardened: TypeScript 7.0.2, Zod 4.4.3, Vitest 4.1.10 (Vite 7.3.1 via override), Biome 2.5.5, npm 11.18.0 asserted in every CI job, lockfile age audit + licence scan before every `npm ci`, four canaries. **Do not touch any pin, workflow, or `.npmrc` in this story.** Adding a dependency would trip the age audit and licence scan by design.
- Repo conventions verified in the merged code: tabs, single quotes, semicolons as-needed (Biome enforces); `.ts` extensions on relative imports (`rewriteRelativeImportExtensions` handles build output); ESM only; `src/` currently contains exactly one barrel file, so this story's `src/core/` tree is greenfield with no regression surface.
- Story 1.1's peer review found that both audit scripts had a silent no-op entry-point bug — the general lesson that transfers: **a gate that cannot be shown to fail is a gate that fails open.** Every fault path in this story gets a test that proves it fires, for the stated reason (assert the literal code), not bare `toThrow()`.
- PR discipline: squash-merge to `main`, conventional commit titles, all eight checks green; pr-checks runs only on `pull_request` events, so a bare branch push proves nothing.
- The formatter/fixture collision pattern and its fix (`!scripts/fixtures` in `biome.json`) is established precedent if vector fixtures need it.

### Project Structure Notes

- First story to create the Structural Seed's `src/core/` tree. Create only what this story needs (`core/schemas/`, `core/canonical/` or equivalent) — empty `compile/`, `seal/`, `ports/` etc. directories would outrun the stories that own them (Story 1.1 recorded the same restraint).
- `tests/` mirrors nothing yet; `tests/index.test.ts` is the only test file. Add test files beside it (`tests/canonical/…` or flat `tests/canonicalize.test.ts` style — settle and record). Vitest picks up `tests/**` per the existing config.
- `schemas/` (generated JSON Schema output) does not exist yet and is Story 1.5's; do not create it here.
- No workflow, script, or manifest changes expected. If `package.json` needs anything, it is at most a no-op; the `validate` chain already runs the new tests via `npm test`.

### Testing requirements

- Vitest 4, in-memory fixtures only, no network, no fs beyond module imports of committed fixtures.
- Every fault path asserts the literal machine code `non-canonicalizable-value` and the presence of the artifact path — wrong-reason passes are the failure mode Story 1.1's canaries exist to prevent, one layer down.
- Golden vectors are the contract with future non-TypeScript implementers: input, canonical bytes, digest, all committed. A vector that only lives inside a `.test.ts` assertion is not language-neutral; keep the data in fixture files and the assertions thin. Expected values are independently derived and frozen (see Task 6) — a fixture whose expected output was produced by the code under test is a rubber stamp, the same fail-open shape Story 1.1's canaries exist to prevent.
- Assertions compare canonical output at the byte level (hex of the UTF-8 bytes), not as JS strings; the human-readable canonical-text field exists for the second implementer, not for the comparison.
- Optional depth, not blocking: a deterministic enumerated-input generator (fixed seed table, no randomness — `core/` tests must stay deterministic) asserting key-order invariance and parse-reserialize stability across generated structures. fast-check is off the table (zero-dependency discipline); the discriminating vectors already carry most of this value.
- Determinism/permutation tests per Task 6. NFR7's 90% `core/` coverage floor formally binds at Epic 6, but this code is pure functions over in-memory values — there is no honest reason to land below it now.

### References

- [Source: _bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md#AD-27] (digest computation, composite/bytes/directory forms, canonicalizer rules)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md#AD-36] (value domain, lexical pre-parse, the 9007199254740993 verification, repository decimals)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md#AD-28] (runtime fault registry, `non-canonicalizable-value`, fault shape)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md#AD-1] (core purity, `node:crypto` permission, no digest port)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md#AD-30] (required golden-vector fixtures, in-memory test rule)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md#Consistency-Conventions] (digest string form, naming, error kinds)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md#Structural-Seed] (directory tree, dependency rules)
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.2] (acceptance criteria of record, FR12)
- [Source: _bmad-output/implementation-artifacts/1-1-align-the-toolchain-and-supply-chain-to-the-stack.md] (toolchain state, conventions, review lessons)

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Fable 5)

### Debug Log References

- `npm run validate` green on Node 24 (typecheck, lint, check:docs, lint:spine, test — 152 tests across 7 files); `npm run build` green.
- `python3 tests/fixtures/derive_vectors.py --check` verifies every frozen expected value against the independent Python derivation.
- Spot cross-check with a third source: `printf '0.95' | shasum -a 256` and `printf '{"a":1,"b":[2,3],"c":{"d":true}}' | shasum -a 256` match the fixtures.

### Completion Notes List

Decisions settled by construction (per Dev Notes "Decisions this story settles"):

1. **Module layout.** `src/core/schemas/faults.ts` (typed fault), `src/core/canonical/scan-json.ts` (lexical layer), `src/core/canonical/value-domain.ts` (in-memory layer), `src/core/canonical/canonicalize.ts` (RFC 8785 serializer), `src/core/canonical/digest.ts` (digest forms). Tests in `tests/canonical/*.test.ts`, fixtures in `tests/fixtures/`.
2. **Fault placement.** `RuntimeFault` lives in `core/schemas/` because `ports/` imports `core/schemas` only and AD-28 requires ports to throw these same typed faults; any deeper location would force an import-rule violation later. Shape: `Error` subclass carrying readonly `code` (`'non-canonicalizable-value' | 'schema-parse-failure'`) and readonly `artifactPath`. No other AD-28 codes pre-populated; AD-5's compile-time registry stays disjoint.
3. **Composite protocol tag.** `{"protocol":"eval-quality/composite/v1", ...named fields}`. A field named `protocol` throws `TypeError` (caller programming error, not an artifact-domain violation — no fault code stretched). Directory digests use a distinct tag for domain separation: `{"protocol":"eval-quality/directory/v1","members":{<path>:<digest>}}`; nesting members under `members` makes path/tag collision impossible. Both tags frozen in `composite-vectors.json` and the fixtures README.
4. **Integer-spelling disposition.** Any literal whose binary64 value is an unsafe integer is rejected regardless of spelling (`9007199254740993`, `9007199254740993.0`, `9.007199254740993e15`, `1e21` all throw `non-canonicalizable-value`); integer-syntax literals are additionally compared on their digits via BigInt so `JSON.parse`-style silent rounding can never hide a violation. Covered by negative vectors.
5. **String-carriage convention.** Integers outside the safe range and values needing exact decimal semantics travel as JSON strings; the schema-side declared formats land with Stories 1.3–1.4 (recorded in the fixtures README value-domain section).
6. **Syntax-fault disposition.** Malformed JSON syntax and fatal UTF-8 decode failures throw `schema-parse-failure`; `non-canonicalizable-value` stays strictly for the four AD-28 domain violations. A leading UTF-8 BOM is content (fails JSON syntax → `schema-parse-failure`), never silently stripped: `TextDecoder('utf-8', { fatal: true, ignoreBOM: true })`.
7. **Directory path order.** "Ordered by path" = JCS key order = UTF-16 code-unit order, which differs from the UTF-8 byte order git/`sort` produce for supplementary-plane paths; pinned by the `directory-code-unit-path-order` golden vector (`vectors/😀.json` before `vectors/דּ.json` U+FB33).
8. **Repository decimal digests** (canonical bytes are the shortest round-trip rendering):
   - `0.95` → `sha256:22fa3ce4995af8d96fcd771f0e1f5d74d8a98f36c3eec8e95bdf7524926b0141`
   - `0.99` → `sha256:b45898ec08623bcb9a13a8656cf546137cd5aaf7526fc3eb83e4a3f3b8e4b924`
   - `0.8` → `sha256:1e9d7c27c8bbc8ddf0055c93e064a62fa995d177fee28cc8fa949bc8a4db06f4`
   - `0.04` → `sha256:a888fe9e2469182b8e3e3bca241d3189dc144349bc2d0ac64c56c444276e9763`
   - `62.5` → `sha256:bff1c57ce1058197ad064590893a945a6729b9a15769d826f422128eabb6438d`
   - `1.0` → canonical `1` → `sha256:6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b`
9. **Independence of golden vectors.** Every expected canonical byte sequence and digest was produced by `tests/fixtures/derive_vectors.py`, a second-language (Python) implementation of the two JCS rules (ECMAScript `Number::toString` reformatting over Python's shortest round-trip repr digits; UTF-16 code-unit key sort via `utf-16-be` encoding), then frozen; `--check` re-verifies. Regeneration from `src/core` output is forbidden and the fixtures README says so.
10. **Scanner details.** `__proto__` keys land as own properties via `Object.defineProperty` (plain assignment would mutate the prototype — a divergence `JSON.parse` avoids and the scanner must too). Lone-surrogate detection uses `String.prototype.isWellFormed()` on the unescaped string, covering literal and escaped surrogates in values and keys alike. Non-plain objects (prototype not `Object.prototype`/`null`), `toJSON` carriers, and cycles are rejected by the in-memory layer.

Implementation followed red-green-refactor per task: failing tests written and confirmed red before each module landed; every fault path asserts the literal machine code and the carried artifact path.

### File List

New files:

- `src/core/schemas/faults.ts`
- `src/core/canonical/scan-json.ts`
- `src/core/canonical/value-domain.ts`
- `src/core/canonical/canonicalize.ts`
- `src/core/canonical/digest.ts`
- `tests/canonical/faults.test.ts`
- `tests/canonical/scan-json.test.ts`
- `tests/canonical/value-domain.test.ts`
- `tests/canonical/canonicalize.test.ts`
- `tests/canonical/digest.test.ts`
- `tests/canonical/vectors.test.ts`
- `tests/fixtures/README.md`
- `tests/fixtures/derive_vectors.py`
- `tests/fixtures/positive-vectors.json`
- `tests/fixtures/negative-vectors.json`
- `tests/fixtures/byte-vectors.json`
- `tests/fixtures/composite-vectors.json`

Modified files (story tracking only):

- `_bmad-output/implementation-artifacts/1-2-canonical-digest-computation-and-the-hashed-artifact-value-domain.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

No workflow, manifest, pin, or `src/index.ts` barrel changes.

## Change Log

- 2026-08-11: Story 1.2 implemented — in-house RFC 8785 canonicalizer, AD-36 value domain (lexical + in-memory layers), typed faults `non-canonicalizable-value`/`schema-parse-failure`, artifact/bytes/composite/directory digests with frozen protocol tags, and independently derived cross-language golden vectors (152 tests green, `npm run validate` + `npm run build` pass on Node 24).
