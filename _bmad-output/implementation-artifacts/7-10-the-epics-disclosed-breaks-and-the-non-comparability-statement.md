---
title: "The epic's disclosed breaks and the non-comparability statement"
type: 'feature'
created: '2026-09-03'
status: 'done'
baseline_commit: '7210fa04da7ed313725bf0b7b568ca2e61981e5b'
review_loop_iteration: 2
context: [
  '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md',
  '{project-root}/_bmad-output/implementation-artifacts/epic-7-context.md',
  '{project-root}/_bmad-output/implementation-artifacts/7-1-the-run-mode-source-and-the-sealed-run-records-mode-field.md',
  '{project-root}/_bmad-output/implementation-artifacts/7-7-mode-separation-with-two-input-types-and-two-generated-ladders.md',
]
---

# Story 7.10: The epic's disclosed breaks and the non-comparability statement

Epic 7, story key `7-10-the-epics-disclosed-breaks-and-the-non-comparability-statement`. Last story
of the last epic. Stories 7.1-7.8 each bumped a `schemaVersion` and recorded the bump only in the
field's own `.describe()`, deferring the caller-facing disclosure NFR8's pre-1.0 SemVer rule
requires to this story by name (`7-1-...md:76-80`). No code change: this story writes the disclosure
into the one release-facing surface the repository already has, `CHANGELOG.md`'s `[Unreleased]`
section, and completes AD-11's disclosure sentence, which named neither the probe schema nor the
scoring policy.

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A caller pinned to `0.1.x` has no single place stating that epic 7 broke five
interchange schemas across nine `schemaVersion` bumps, plus the scoring policy, and made every
scoring version computed before it non-comparable with every version after it. `CHANGELOG.md`'s
`[Unreleased]` section is empty; `ARCHITECTURE-SPINE.md`'s AD-11 disclosure sentence names neither
the probe schema, which this epic gave its first `schemaVersion`, nor the scoring policy.

**Approach:** Write one `### Changed` block into `CHANGELOG.md`'s `[Unreleased]` section disclosing
every schema bump this epic made, each named with its old and new `schemaVersion` and whether the
change is additive or breaking, plus the non-comparability statement lifted from the epic's own
planning text. Add the probe schema and the scoring policy to AD-11's enumerated disclosure
surface.

## Boundaries & Constraints

**Always:**
- `CHANGELOG.md`'s `[Unreleased]` section gains one `### Changed` block, Keep-a-Changelog style
  matching the `[0.1.0]` section immediately below it. **The numbers are the epic's net move from
  the pre-epic version a `0.1.x` caller actually holds, not the last story's increment**, and three
  of the six schemas were bumped twice, so each of those three names both driving fields:
  - sealed run record **1→3** — `mode` required (Story 7.1, 1→2) and `sequence` required
    (Story 7.2, 2→3). `artifact-fixtures.ts:140-144`'s own comment is the proof: "neither a
    version-1 nor a version-2 record parses."
  - eval contract **1→3** — `InteractionStep.cardinality` required (Story 7.2, 1→2) and
    `testData.principals`/`testData.resources` required (Story 7.3, 2→3, per `7-3-...md:405`).
  - evidence artifact **1→3** — `ScoringVersionInputs.mode` (Story 7.7, 1→2) and the
    contract-scoring branch's `uncitedFindingGaps` (Story 7.8, 2→3).
  - sealed evaluator brief **1→2** — `principals` required (Story 7.3).
  - probe **1→2** — AD-9's `qualification` record and AD-40's `defectSignature` both required
    (Story 7.4).
  Nine bumps across those five schemas, not five. Every one is BREAKING under AD-11's rule
  (`ARCHITECTURE-SPINE.md:291`, "removing or retyping is breaking"): each added a *required* field,
  so no prior-version document parses, which is a retyping of the shape rather than the additive
  optional-field case that rule contrasts it with.
- `ScoringPolicy` (**1→2**, `catchThreshold` required, Story 7.6, `7-6-...md:543`) is disclosed in
  the same block. It is outside `epics.md`'s AC's named five and outside AD-11's current enumerated
  surface, but NFR8's plain text is "every caller-facing break," not a five-item list, and
  `ScoringPolicy` ships as one of the twelve published JSON Schema documents in the tarball
  (`schemas/scoring-policy.schema.json`, disclosed as a surface in `CHANGELOG.md:118`), so it is
  caller-facing on the repository's own published definition. Settled by construction here rather
  than escalated: name it, with this paragraph's reasoning carried into the story's own decisions
  section.
- The same block states plainly that **in v0 the version number gates nothing in either direction**,
  and gives the consequence rather than only the mechanism:
  - A pre-bump artifact is rejected because it *lacks the new required fields*, not because of its
    number, and it surfaces as a generic parse failure rather than AD-28's
    `schema-version-mismatch`.
  - The reason is that v0 ships no ingest-side version comparison at all. The only comparison in
    `src/` is `lineage/chain.ts:115-122`'s `readMembers`, which takes `acceptedSchemaVersion` from
    its caller and runs over artifacts that already parsed, so the dedicated fault is unreachable on
    ordinary ingest today. Do **not** write that `z.int().min(1)` was chosen so the fault never
    fires: `lineage.ts:20-25`'s own `.describe()` says the opposite — the literal was rejected
    precisely so a version-2 artifact could reach `schema-version-mismatch` instead of becoming an
    anonymous parse failure, and AD-11 (`:291`) says "readers accept an equal `schemaVersion` only
    and throw `schema-version-mismatch` outside that." The gap is that v0 has no such reader yet.
  - The forward direction is the half a caller cannot guess and must be stated: an artifact carrying
    a *higher* `schemaVersion` than the reader expects, but the right fields, parses and is accepted
    silently. The repository ships a live example — `spike-worked-example/eval-contract.json` carries
    `schemaVersion: 1` against an eval-contract schema now at 3 and passes `npm run validate` on
    every run.
- The same block states the non-comparability consequence: mode entering `ScoringVersionInputs` as
  its sixth field makes every scoring version computed before this epic non-comparable with every
  version after it. Lift the sentence from `epics.md`'s own epic-preamble text rather than
  re-deriving it — it is already correct there, just not yet caller-facing.
- The same block names the two new AD-5 codes (`binding-cycle`, `captured-channel-undeclared`) and
  the regenerated 23-entry failure-code enumeration among the disclosed surfaces, satisfying AD-11's
  existing "both code registries" clause with this epic's actual additions — no new document, no
  registry change, this story only names what already shipped in Stories 7.2/7.3.
- `ARCHITECTURE-SPINE.md`'s AD-11 rule paragraph (`:291`, the "Breaking changes are disclosed on
  release" sentence) gains **both the probe schema and the scoring policy** to its enumerated
  surface list. The probe is what the AC names, "because it did not name one." The scoring policy is
  the same omission found by the same test: that sentence enumerates contract schema, sealed brief,
  sealed run record, isolation manifest, evaluator configuration, evidence artifact, both code
  registries, and the CLI contract — and this story is about to disclose a `ScoringPolicy` break
  under NFR8 on the argument that it is a caller-facing surface. Disclosing the break while leaving
  the surface list unable to name it would leave the next reader with the same gap the AC is fixing
  for the probe. Settled by construction: one clause, both nouns. A one-clause addition to an
  existing sentence, not a new revision: the spine's `revision: 9` frontmatter and `updated` date
  stay as they are, matching how every other epic-7 story closed an owed item inside the existing
  revision rather than opening a new one.
- The spine edit is not free of CI: `ARCHITECTURE-SPINE.md` sits under `check:docs`'s `ROOTS`
  (`scripts/check-docs.mjs:11`, `_bmad-output/planning-artifacts`) and is separately gated by
  `npm run lint:spine` (`scripts/spine-lint/lint_spine.py --fail-on high`, `package.json:76`), both
  of which run inside `npm run validate` (`package.json:110`). Run both after the edit rather than
  assuming a prose change is inert.

**Ask First:** none anticipated. Settle any further ambiguity by construction in this story's own
decisions section rather than escalating it.

**Never:**
- No `src/` change of any kind: every schema, function, and test this story discloses already
  shipped in Stories 7.1-7.9. This story only writes the disclosure.
- No new file: `CHANGELOG.md` is hand-maintained (confirmed: no semantic-release, no changesets,
  no CI check validates its content beyond `release-prepare.mjs`'s mechanical section-move), already
  wired into the publish workflow as the GitHub Release body source, and story 7.1's own text already
  named it as this story's destination. No `BREAKING_CHANGES.md`, no `MIGRATION.md`.
- No addition to `scripts/check-docs.mjs`'s or `scripts/check-doc-invocations.mjs`'s `ROOTS`:
  neither script scans `CHANGELOG.md` today and this story does not put it in scope for either.
- No change to the spine's `revision`/`updated` frontmatter, and no edit to any AD paragraph other
  than AD-11's one enumerated-surface sentence.

</frozen-after-approval>

## Code Map

**Read-only evidence:**
- `ARCHITECTURE-SPINE.md:291` — AD-11's Rule paragraph. One long line, so all three clauses this
  story reads live on it: "Adding an optional field is a `schemaVersion` bump ... removing or
  retyping is breaking"; "Readers accept an equal `schemaVersion` only and throw
  `schema-version-mismatch` outside that"; and the "Breaking changes are disclosed on release"
  sentence whose enumerated surface names neither the probe nor the scoring policy. (`:290` is the
  `**Prevents:**` bullet and carries none of them.)
- `_bmad-output/planning-artifacts/epics.md:51` — NFR8 verbatim; `:515` — the epic preamble's own
  non-comparability sentence, to lift near-verbatim; `:525` — "Story 7.10 collects only ... NFR8's
  caller-facing disclosure and the scoring-version non-comparability statement."
- `epic-7-context.md:7` — the same non-comparability sentence, second citation.
- `CHANGELOG.md:1-9` — header (points `npm run release:prepare` and the publish workflow at
  `[Unreleased]`); `:11` — the currently-empty `[Unreleased]` heading; `:13-43` — the `[0.1.0]`
  section, the `### Added`/`### Changed`/`### Fixed` format to match; `:118` — the twelve published
  JSON Schema documents, the repository's own statement of what is caller-facing.
- `.github/workflows/publish.yml:187,215-230` — the Release body is read from the CHANGELOG section
  `release:prepare` stamped and falls back to `[Unreleased]` when no tagged section exists
  (`:226`, "No CHANGELOG.md entry for $TAG; using [Unreleased] notes"). This is what makes
  `[Unreleased]` the correct destination now, before a release is cut, rather than a holding pen.
  `scripts/release-prepare.mjs:147` is the stamp that later moves it.
- `7-1-...md:76-80` — "Nothing in this story writes a release note ... Story 7.10 collects the
  caller-facing disclosure for the whole epic," confirming this story's destination was decided at
  epic-planning time, not invented here.
- `src/core/schemas/lineage.ts:20-25` — `schemaVersion`'s `.describe()`. Read it before writing the
  disclosure bullet: it argues `z.int().min(1)` *so that* a version-2 artifact reaches
  `schema-version-mismatch` rather than becoming an anonymous parse failure, which is the reverse of
  "the field was typed loosely so the fault never fires."
- `src/core/lineage/chain.ts:53,115-122` — `acceptedSchemaVersion` and `readMembers`'s throw: the
  only place `schema-version-mismatch` (`src/core/schemas/faults.ts:13`) is raised anywhere in
  `src/`, scoped to an already-parsed artifact's lineage-chain validation, never ordinary ingest.
- `src/core/schemas/evidence-artifact.ts:89-96,103-110` — `SCORING_VERSION_INPUT_NAMES` (six
  fields, `mode` last) and `ScoringVersionInputs`, source for the non-comparability claim's technical
  grounding.
- `src/core/failure-codes.ts:11-35` — `FAILURE_CODES`, 23 entries, `binding-cycle`/
  `captured-channel-undeclared` at `:26-27`; `7-3-...md:403` records the registry moving 21→23.
- `scripts/check-docs.mjs:9-15` (`ROOTS` includes `_bmad-output/planning-artifacts`, so the spine is
  in scope and `CHANGELOG.md` is not) and `scripts/check-doc-invocations.mjs:41`
  (`ROOTS = ['README.md', 'docs']`, so neither file is in scope).
- Bump evidence per schema, cross-checked against current fixtures. Nine bumps, six schemas; three
  schemas moved twice, so the epic-net old→new is 1→3 for those, not 2→3:
  - sealed run record 1→2 then 2→3 (`7-1-...md:126` "moves to `schemaVersion: 2`";
    `7-2-...md:153-155` "moved 2 -> 3 ... a second breaking bump on top of 7.1's mode bump");
    `tests/schemas/fixtures/artifact-fixtures.ts:140-144` reads 3 and its comment names both.
  - eval contract 1→2 then 2→3 (`7-2-...md:153` "moved 1 -> 2"; `7-3-...md:405` "eval-contract
    `schemaVersion` ... 2 | 3 | `TestData` gained two required fields");
    `tests/schemas/fixtures/relevance-contracts.ts:117` reads 3.
  - evidence artifact 1→2 then 2→3 (`7-7-...md:108` "bumps 1 → 2"; `7-8-...md:23` "a BREAKING
    `schemaVersion` bump from 2 to 3"); `artifact-fixtures.ts:707` reads 3.
  - sealed evaluator brief 1→2 (`7-3-...md:405-406`); `artifact-fixtures.ts:861` reads 2.
  - probe 1→2 (`7-4-...md:20,212`); `artifact-fixtures.ts:431,459` read 2.
  - scoring policy 1→2 (`7-6-...md:23,341,543`); `artifact-fixtures.ts:693` reads 2.
- `spike-worked-example/eval-contract.json` — ships `schemaVersion: 1` against an eval-contract
  schema at 3 and passes `npm run validate`; the in-repo demonstration that the version number gates
  nothing today.

**New:** none.

**Changed:**
- `CHANGELOG.md` — one `### Changed` block under `[Unreleased]`.
- `ARCHITECTURE-SPINE.md` — AD-11's disclosure sentence, probe schema and scoring policy added.
- `_bmad-output/shareable/eval-quality-architecture-spine.html` — regenerated by
  `npm run build:shareable`. Not anticipated by the spec; see Decision 1.

## Tasks & Acceptance

**Execution:**
- [x] `CHANGELOG.md` — add `[Unreleased]` `### Changed` block: six schemas, nine bumps, each schema
  stated as the epic's net old→new (sealed run record 1→3, eval contract 1→3, evidence artifact 1→3,
  sealed evaluator brief 1→2, probe 1→2, `ScoringPolicy` 1→2), naming every driving field — two for
  each of the three twice-bumped schemas — and BREAKING on each
- [x] `CHANGELOG.md` — the two new AD-5 codes and the failure-code registry moving 21→23
- [x] `CHANGELOG.md` — the version-number-gates-nothing statement, both directions: a pre-bump
  artifact is rejected for its missing required fields as a generic parse failure rather than
  `schema-version-mismatch`, and a forward-version artifact carrying the right fields is accepted
  silently
- [x] `CHANGELOG.md` — the non-comparability statement, lifted from `epics.md:515`
- [x] `ARCHITECTURE-SPINE.md:291` — add the probe schema and the scoring policy to AD-11's
  enumerated disclosure surface, in the one sentence, changing nothing else on the line
- [x] `npm run check:docs && npm run lint:spine` after the spine edit, before the full `validate`
- [x] `npm run build:shareable` — a third spine gate the spec did not name; see Decision 1

**Acceptance Criteria:**
- Given the `schemaVersion` bumps Stories 7.1-7.8 made, when `CHANGELOG.md`'s `[Unreleased]` section
  is read, then every one of the five interchange schemas named in `epics.md`'s AC (sealed run
  record, eval contract, probe, evidence artifact, sealed evaluator brief) appears with its old and
  new `schemaVersion` and is marked BREAKING.
- Given that the sealed run record, the eval contract, and the evidence artifact were each bumped
  twice inside this epic, when `CHANGELOG.md` is read, then each is stated as 1→3 with both driving
  fields named, so a caller pinned to `0.1.x` — who holds version-1 artifacts — reads the number
  that describes their own documents rather than only the last story's increment.
- Given `ScoringPolicy`'s Story 7.6 bump, when `CHANGELOG.md` is read, then it appears as 1→2 with
  `catchThreshold` named and marked BREAKING.
- Given AD-11's disclosure sentence previously named neither the probe schema nor the scoring policy,
  when `ARCHITECTURE-SPINE.md` is read after this story, then it names both, and no other clause on
  `:291` has moved.
- Given the two new AD-5 codes minted in Stories 7.2/7.3, when `CHANGELOG.md` is read, then both are
  named alongside the failure-code registry moving from 21 to 23 entries.
- Given a caller presenting a pre-bump artifact, when `CHANGELOG.md` is read, then it states that
  ingest rejects it for the required fields it lacks, surfacing as a generic parse failure and never
  as `schema-version-mismatch`, and that the reason is that v0 ships no ingest-side version
  comparison — the only one is `chain.ts`'s lineage-chain validation over already-parsed artifacts.
- Given a caller presenting an artifact whose `schemaVersion` is *higher* than the reader's but whose
  fields are current, when `CHANGELOG.md` is read, then it states that the artifact is accepted
  silently, because nothing compares the number in either direction today.
- Given `ScoringVersionInputs`' new sixth field, when `CHANGELOG.md` is read, then it states that
  every scoring version computed before this epic is non-comparable with every version after it.
- Given `npm run validate`, when run after this story, then it stays green. No `src/` file changed
  and no pinned counter moved, but this is not a no-op run: `check:docs` and `lint:spine` both read
  the spine file this story edits.

## Spec Change Log

- **Finding:** a peer review of this ready-for-dev spec (before any edit existed) found three of the
  six old→new `schemaVersion` numbers wrong, each understating the epic's move by one bump. Three
  schemas were bumped twice inside epic 7, not once: the sealed run record (`mode`, Story 7.1, 1→2;
  `sequence`, Story 7.2, 2→3 — `artifact-fixtures.ts:140-144`'s comment says outright "neither a
  version-1 nor a version-2 record parses", and `7-2-...md:155` calls it "a second breaking bump on
  top of 7.1's mode bump"), the eval contract (`cardinality`, Story 7.2, 1→2; `testData.principals`/
  `resources`, Story 7.3, 2→3 per `7-3-...md:405`), and the evidence artifact
  (`ScoringVersionInputs.mode`, Story 7.7, 1→2 per `7-7-...md:108`; `uncitedFindingGaps`, Story 7.8,
  2→3 per `7-8-...md:23`). The spec disclosed all three as "2→3". That is precisely the wrong number
  for this story's stated audience: a caller pinned to `0.1.x` holds version-1 artifacts, so "2→3"
  describes a document they do not have and hides the bump that broke them. The single-field framing
  ("each naming the field that drove the bump") also cannot carry two driving fields.
  **Amended:** Boundaries now list nine bumps across six schemas with each schema's epic-net old→new
  and every driving field; the Code Map cites the story file and fixture line proving each half of
  each double bump; Tasks and a new AC state the 1→3 cases explicitly and say why the pre-epic number
  is the one a `0.1.x` caller needs. **Avoids:** shipping the epic's one caller-facing disclosure
  with three of its six version numbers describing the wrong document.
- **Finding:** the same review found the `schema-version-mismatch` bullet's *reasoning* inverted
  against source. The spec argued the fault never fires "because `lineage.ts`'s `schemaVersion` field
  (`z.int().min(1)`, not `z.literal(1)`) is read by ordinary `.parse()` before any version comparison
  runs." `lineage.ts:20-25`'s own `.describe()` argues the opposite: the literal was rejected
  *because* it "would turn a version-2 artifact into an anonymous schema-parse failure instead of
  AD-28's dedicated `schema-version-mismatch` fault," and AD-11 (`:291`) states "readers accept an
  equal `schemaVersion` only and throw `schema-version-mismatch` outside that." The conclusion holds
  and the reason does not: the fault is unreachable on ordinary ingest because v0 ships no
  ingest-side reader that compares versions, the only comparison being `chain.ts:115-122`'s
  `readMembers` over already-parsed artifacts. The review also found the consequence stated in one
  direction only — a pre-bump artifact fails on its *missing required fields*, not its number, and a
  *forward*-version artifact carrying current fields parses and is accepted silently, which is the
  half a caller cannot infer. The repository ships a live example of it: `spike-worked-example/
  eval-contract.json` carries `schemaVersion: 1` against a schema at 3 and passes `npm run validate`.
  **Amended:** the bullet now gives the correct reason, carries an explicit instruction not to write
  the inverted one, states both directions, and cites the in-repo example; two ACs replace the single
  one. **Avoids:** a published disclosure that misstates the architecture's own intent about a fault
  code, and that leaves silent forward-version acceptance undisclosed.
- **Finding:** the same review found AD-11's enumerated surface omits the scoring policy on exactly
  the test that catches the probe. The sentence at `:291` names contract schema, sealed brief, sealed
  run record, isolation manifest, evaluator configuration, evidence artifact, both code registries,
  and the CLI contract. The spec argued at length that `ScoringPolicy` is a caller-facing break worth
  disclosing, then amended the enumeration for the probe alone, which leaves the next reader the same
  gap the AC is closing. The review also confirmed the `ScoringPolicy` argument itself is sound and
  strengthened its grounding: `schemas/scoring-policy.schema.json` is one of the twelve published
  JSON Schema documents the tarball ships, disclosed as a caller-facing surface by `CHANGELOG.md:118`,
  so the claim rests on the repository's own published definition rather than on inference from NFR8's
  wording. **Amended:** the spine bullet, the Tasks item, and the AC now cover both nouns in the one
  sentence; the Design Note cites the published-schema fact. **Avoids:** disclosing a break under a
  surface list that cannot name the surface it broke.
- **Finding:** the same review found the "no `src/` change, validate stays green" framing treats the
  run as inert when two of its steps read the file this story edits. `ARCHITECTURE-SPINE.md` sits
  under `check:docs`'s `ROOTS` (`scripts/check-docs.mjs:11`) and is separately gated by
  `npm run lint:spine` (`scripts/spine-lint/lint_spine.py --fail-on high`, `package.json:76`), both
  inside `validate` (`package.json:110`). **Amended:** a Boundaries bullet names both gates, Tasks
  adds a targeted run of the two before the full chain, and the AC says plainly that the run is not a
  no-op. **Avoids:** a spine prose edit discovered to be CI-gated only when the full chain fails.
- Four citations were also corrected against source: AD-11's "adding an optional field ... removing
  or retyping is breaking" clause is on `:291`, the same single line as the disclosure sentence, not
  `:290` (which is the `**Prevents:**` bullet); `CHANGELOG.md`'s header runs `:1-9` with
  `[Unreleased]` at `:11` and `[0.1.0]` at `:13-43`, not `:1-10` and `:12-29`;
  `SCORING_VERSION_INPUT_NAMES` begins at `evidence-artifact.ts:89`, not `:85`; and the
  `schema-version-mismatch` throw is at `chain.ts:115-122`, with `:53` carrying only the
  `acceptedSchemaVersion` declaration. The `failure-codes.ts:11-35` and `:26-27` citations and the
  two `ROOTS` claims were checked and are correct as written. The Code Map gained
  `.github/workflows/publish.yml:187,215-230`, whose `[Unreleased]` fallback at `:226` is the actual
  evidence that `[Unreleased]` is the right destination before a release is cut.

## Design Notes

**Why `ScoringPolicy` is disclosed even though neither the AC nor AD-11's current sentence names
it.** NFR8 is "every caller-facing break," not the five-item list `epics.md`'s AC happens to name for
this story; the PRD's fuller VFR-8 text names the caller-facing surface by category, not by an
exhaustive enumeration that would exclude a policy object. The decisive fact is not an inference from
NFR8's wording, though: `scoring-policy.schema.json` is one of the twelve generated JSON Schema
documents the tarball ships, and `CHANGELOG.md:118` already published those twelve as part of the
`0.1.0` surface. A document the package publishes to callers and then breaks is a caller-facing
break by the repository's own definition. Its Story 7.6 bump (`catchThreshold` required) is exactly
as breaking as any of the five. Leaving it out because the AC's own enumeration happened not to name
it would be under-disclosing a real break for a reason that has nothing to do with whether the break
is real — and that same reasoning is why AD-11's enumerated surface gains it alongside the probe
rather than only the probe.

**Why this story edits AD-11's sentence but not the spine's revision counter.** The spine's own
`revision: 9` is a document-level version for rounds of adversarial architecture review; this is a
one-clause completion of an enumeration the spine itself says is incomplete ("because it did not name
one"), the same class of edit several other epic-7 stories made to spine prose without opening a new
revision.

## Decisions settled by construction

Per the epic preamble's rule that an ambiguity found mid-story is settled where the work happens.

1. **The spine edit trips a third gate the spec did not name, and the generated page is regenerated
   rather than left stale.** Boundaries names `check:docs` and `lint:spine` as the two gates that
   read the edited spine. There is a third: `_bmad-output/shareable/eval-quality-architecture-spine.html`
   is a generated projection of the same file, and `npm run check:shareable`
   (`scripts/check-shareable.mjs`, `package.json:110`) compares every committed page against a fresh
   build byte for byte. The first full `validate` failed there and named the exact clause:
   `stale at byte offset 94237 ... committed " evidence artifact, <strong>both code re" / rebuilt
   " evidence artifact, probe schema, scorin"`. `npm run build:shareable` rewrites all twenty-one
   pages; only the spine page's bytes moved, and the diff is the one line. The file is tool-owned
   with its builder in-repo, so regenerating it is the only correct response. The Code Map's Changed
   list carries it, and the Never bullet forbidding a `src/` change is untouched.
2. **The lifted non-comparability sentence says "before this release" where `epics.md:515` says
   "before this epic".** One substitution on an otherwise verbatim lift. `CHANGELOG.md` is the
   caller-facing surface, and a caller pinned to `0.1.x` has no epic numbering to resolve; the claim,
   its subject (`ScoringVersionInputs` gaining `mode` as AD-11's sixth identity input) and its scope
   (every version before, against every version after) are unchanged. The `[Unreleased]` block is
   what a release will publish, which is what makes "release" the reader's own frame.
3. **Every schema sub-bullet carries its own `BREAKING` marker, not only the block header.** The
   acceptance criteria test each schema individually for the marker, and the sub-bullets are what a
   reader skimming for their own schema stops on. Repeating the word six times is the cost of each
   line standing alone.

### Review round 1: three divergences from the frozen Boundaries

Step-04's three review layers ran fourteen `patch` findings over the first diff. Eleven were carried
out inside the Boundaries as written. Three contradict a frozen sentence and are recorded here with
the source that forced each.

4. **The forward-direction example is the shipped corpus, and it demonstrates the stale-stamp
   direction rather than the forward one.** Boundaries instructs the block to cite
   `spike-worked-example/eval-contract.json` as the in-repo demonstration. Two things are wrong with
   it. The file carries `schemaVersion: 1` against a schema at 3, which is a *lower* number, so it
   proves a stale stamp on current-shape fields is accepted and says nothing about a higher one. And
   it lives under `_bmad-output/planning-artifacts/`, a tree `package.json`'s `files`
   (`dist`, `schemas`, `corpus`, `README.md`, `LICENSE`) excludes, so a caller reading the published
   CHANGELOG cannot open it. The replacement is the shipped corpus: twenty published contracts,
   nineteen under `corpus/dev/contracts/` plus `corpus/dev/compile-seal-example/contract.json`, each
   carrying `schemaVersion: 1` with version-3 fields (`cardinality` on every step,
   `testData.principals` and `testData.resources` present as `null`). They satisfy the current schema
   by construction, since `scripts/generate-dev-corpus.ts` builds them from `EvalContract`-typed
   literals, and `check:corpus` proves the committed bytes still match that builder on every run. The higher-version half is now stated as what it is: a consequence
   of there being no ingest-side comparison in either direction, which no in-repo artifact
   demonstrates because nothing in the repository carries a forward stamp.
5. **AD-11's enumerated surface gains five nouns and an exemption, not two nouns.** Boundaries says
   the sentence gains "both the probe schema and the scoring policy". That closes the gap the AC
   names and leaves the same gap open three more times, by the same test: `INTERCHANGE_ARTIFACTS`
   (`src/core/schemas/artifact.ts:41-93`) holds twelve entries, eleven with `carriesLineage: true`
   and therefore a `schemaVersion` to break, and the amended sentence named eight. `rubric`,
   `private-artifact-manifest`, and `preflight-verdict` each ship in `schemas/` and each carry one.
   The sentence now names the rule (every interchange artifact carrying a `schemaVersion`, eleven of
   the twelve), enumerates the eleven, and names `artifact-reference` as the exemption with its
   reason, so a reader counting twelve against eleven has the answer in the same clause.
   `artifact-reference.ts`'s own `.meta` description already states that exemption, so this is the
   spine catching up to shipped source. Still one sentence; the `revision`, the frontmatter, and
   every other clause on `:291` are untouched.
6. **The block is `### Added` plus `### Changed`, not one `### Changed` block.** Boundaries says one
   `### Changed` block. `binding-cycle` and `captured-channel-undeclared` are new members of a
   published enumeration, and the file header commits to Keep a Changelog, whose `Added` is exactly
   that. They are listed under `### Added`; the registry's 21 → 23 move and its
   exhaustive-match consequence stay under `### Changed` and cross-reference. The disclosure is
   whole either way, and the heading a reader scans for a new code is `Added`.

### Review round 2: an adversarial peer review of the finished commit, in two parallel layers

All nine bumps re-derived from source, including the three double-bumped schemas, and all nine hold.
Adversarial parses confirmed the three claims that turn on branch and nullability: a version-2
*production* evidence artifact still parses under version 3 while the same document on the
contract-scoring branch is rejected, and a production artifact carrying `uncitedFindingGaps` is
rejected by `strictObject`; a clean control carrying a `defectSignature` is rejected; an eval
contract omitting `testData.principals`/`resources` is rejected while both set to `null` parses.
AD-11's amended sentence was diffed byte for byte against the old one: the first 1670 characters and
the whole trailing clause are identical, the eleven names it enumerates map one-to-one onto the
eleven `INTERCHANGE_ARTIFACTS` entries carrying `carriesLineage: true`, `artifact-reference` is the
twelfth and its own `.meta` already states the exemption, and the spine's `revision` and `updated`
frontmatter are untouched. Both facts the round-1 notes said were corrected mid-review check out
against source. Ten further checks passed as written: ten runtime fault codes, twenty-three compile
codes with exactly `binding-cycle` and `captured-channel-undeclared` added this epic, six
`ScoringVersionInputs` fields with `mode` last, no CLI or `src/application` change since `v0.1.0`,
the tautological `acceptedSchemaVersion` at `worked-example-target.ts:1341`, and all twenty version-1
corpus contracts validating clean against the published version-3 `eval-contract.schema.json` under
ajv.

Seven findings, all fixed in this pass.

7. **Five of the nine bumps had no note in the driving field's own `.describe()`, not two.** The
   deferred-work entry named `TestData.principals`/`resources` and `SealedEvaluatorBrief.principals`
   and stopped there. A recount against source added three more: `ScoringVersionInputs.mode`
   (evidence artifact 1 -> 2), `Probe.qualification` and `Probe.defectSignature` (probe 1 -> 2), and
   `ScoringPolicy.catchThreshold` (scoring policy 1 -> 2). Fixing only the two named would have left
   this story's own CHANGELOG claim that every bump is "recorded in the field's own description"
   false for three of nine, which is the exact defect the fix exists to close, so all five are
   closed. Six `.describe()` calls gained additive text; `schemas/eval-contract.schema.json`,
   `sealed-evaluator-brief.schema.json`, `evidence-artifact.schema.json`, `probe.schema.json`, and
   `scoring-policy.schema.json` were regenerated from them. No `schemaVersion` moved and no field
   changed shape.
8. **The CHANGELOG's most checkable sentence was false.** "The only comparison in the package is
   `readMembers` in `core/lineage/chain.ts`" misses `reviseArtifact` at `chain.ts:313`, which
   compares a revision body's `schemaVersion` against its parent's, in the same file, two hundred
   lines below the one the sentence cites. The conclusion survives and the sentence did not: it now
   says "the only comparison against a version a reader expects", names `reviseArtifact` as AD-29's
   mint-path guard, and records that it throws a `TypeError` and so belongs to neither code
   registry.
9. **The probe bullet read as though every non-clean probe must carry a signature.** `defectSignature`
   is `DefectSignature.nullable()`: the key is required on the seeding branch and `null` is the legal
   value a `canary` carries. The two neighbouring bullets disclose nullability explicitly, so the
   silence here was the misleading half of an otherwise careful set. Stated now.
10. **The sealed run record's uniqueness rule does not ship.** `sequence` uniqueness is a Zod
    `.refine()`, which JSON Schema cannot express, so `schemas/sealed-run-record.schema.json`
    publishes the field as a required positive integer and nothing more. A validator driven by the
    published schema alone accepts a record with duplicate sequences that this package rejects. That
    is a caller-facing fact about a shipped schema and the bullet now carries it.
11. **The non-comparability bullet overreached.** "There is no named non-comparability signal" is
    true of the version gap and false as written, since the artifact ships `comparabilityKey` and
    `strength.comparable`. The bullet now says which axis it means and states plainly that neither
    of those two reports a version mismatch.
12. **`deferred-work.md`'s header said no items were open while fifteen were.** Corrected, with the
    correction stated rather than silently applied, since the file's whole purpose is to be trusted
    as a queue.
13. **Four of this story's own `CHANGELOG.md` line citations were stale on the commit that wrote
    them,** and the `:27-28` citation for the twelve published JSON Schema documents pointed at the
    bullet this story's own eighty added lines pushed down. All eight references re-pointed.

**Reported and deliberately not fixed.** `src/core/schemas/scoring-policy.ts` says five times that
"the published default artifact carries" a value, and no such artifact ships: `package.json`'s
`files` publishes `dist`, `schemas`, `corpus`, `README.md`, and `LICENSE`, and none holds a
`ScoringPolicy` instance. The prose exports verbatim into `schemas/scoring-policy.schema.json`, so
the tarball points a caller at a document that was never built. This is Story 1.4's recorded design
intent, quoting the Consistency Conventions' "the default policy ships as a published artifact
referenced by digest rather than as constants in a function", so closing it means either shipping
that artifact or reversing that decision. Neither is a review fix and neither belongs to this story.

## Verification

**Commands:**
- `npm run check:docs && npm run lint:spine` — green. `check-docs: 44 file(s) OK`; the spine linter
  reported `"ok": true, "total_findings": 0`
- `npm run build:shareable` — required by the spine edit, see Decision 1. `check:shareable` then
  reports all twenty-one committed pages matching the builder byte for byte
- `npm run validate` — green end to end: 99 test files, 3339 tests, statements 97.05 percent and
  branches 92.64 percent, both above the ninety-percent floor. No pinned counter moved, since no
  `src/` file changed
- `git diff CHANGELOG.md ARCHITECTURE-SPINE.md` — manual read: nine bumps across six of the twelve
  interchange artifacts with epic-net old→new numbers, every driving field and its migration note,
  the two branch-scoped qualifications (`uncitedFindingGaps`, `defectSignature`), the
  version-gates-nothing statement in both directions with `validateLineageChain` named as the one
  lever, the non-comparability statement with its parse-failure consequence, the `0.2.0` release
  implication, the unchanged-surface line, and AD-11's sentence now naming eleven of the twelve
  artifacts plus the `artifact-reference` exemption

**Second run, after review round 1's fourteen patch findings:** `check:docs` 44 files OK,
`lint:spine` `"ok": true` with zero findings, `build:shareable` regenerated for the widened AD-11
sentence, and `npm run validate` green end to end at 99 files / 3339 tests, 97.05 percent statements
and 92.64 percent branches. No `src/` file changed in either round.

## Suggested Review Order

**The disclosure, in the order a caller reads it**

- Entry point. What the next release is, and that a `0.1.x` range stops holding.
  [`CHANGELOG.md:23`](../../CHANGELOG.md#L23)

- The nine bumps, each artifact's net move from the version a pinned caller actually holds.
  [`CHANGELOG.md:27`](../../CHANGELOG.md#L27)

- The half a caller cannot infer: nothing compares the number, in either direction.
  [`CHANGELOG.md:67`](../../CHANGELOG.md#L67)

- Scoring versions stop comparing, and a stale record fails without saying why.
  [`CHANGELOG.md:87`](../../CHANGELOG.md#L87)

- The registry break: an exhaustive match over 21 codes stops being exhaustive.
  [`CHANGELOG.md:95`](../../CHANGELOG.md#L95)

- What did not move, said aloud so the silence is not read as an omission.
  [`CHANGELOG.md:99`](../../CHANGELOG.md#L99)

- The two new codes filed as additions, matching `[0.1.0]`'s Keep-a-Changelog sections.
  [`CHANGELOG.md:13`](../../CHANGELOG.md#L13)

**The architecture rule the disclosure answers to**

- AD-11's surface list, now derived from a rule instead of an enumeration that drifted.
  [`ARCHITECTURE-SPINE.md:291`](../planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md#L291)

- The inventory the rule reads: eleven of twelve carry a `schemaVersion`.
  [`artifact.ts:42`](../../src/core/schemas/artifact.ts#L42)

**Peripherals**

- The spine's shareable mirror, byte-gated by `check:shareable`.
  [`eval-quality-architecture-spine.html:898`](../shareable/eval-quality-architecture-spine.html#L898)

- Five findings this story surfaced and could not close inside its own boundaries.
  [`deferred-work.md`](deferred-work.md)
